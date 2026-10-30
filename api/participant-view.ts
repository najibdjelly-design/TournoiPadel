import { createClient } from '@supabase/supabase-js';
import { env } from 'node:process';
import type { MatchScore, Tournament } from '../src/types/tournament';
import type {
  ParticipantViewData,
  PublicParticipantMatch,
  PublicParticipantPair,
  PublicPool,
} from '../src/types/participantView';

// Copie locale : un import runtime depuis src/ échoue en ESM sur Vercel (extensions manquantes).
function formatScore(score?: MatchScore): string {
  if (!score || !score.sets || score.sets.length === 0) return 'Non joué';
  if (score.isWalkover) return 'Victoire par WO';
  return score.sets
    .map(s => `${s.pair1}-${s.pair2}${s.tieBreak ? `(${s.tieBreak})` : ''}`)
    .join(' ');
}

interface ApiRequest {
  method?: string;
  url?: string;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
  headersSent?: boolean;
}

function getPairName(
  pairId: string | undefined,
  pairsById: Map<string, PublicParticipantPair>
): string {
  if (!pairId) return 'À déterminer';
  const pair = pairsById.get(pairId);
  return pair
    ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
    : 'À déterminer';
}

function createParticipantView(tournament: Tournament): ParticipantViewData {
  const confirmedPairs = tournament.pairs.filter(pair => pair.status === 'confirmed');
  const pairsById = new Map<string, PublicParticipantPair>();
  const participants = confirmedPairs.map(pair => {
    const pool = tournament.pools.find(
      candidate => candidate.id === pair.poolId || candidate.pairIds.includes(pair.id)
    );
    const participant: PublicParticipantPair = {
      player1: {
        firstName: pair.player1.firstName,
        lastName: pair.player1.lastName,
        club: pair.player1.club,
      },
      player2: {
        firstName: pair.player2.firstName,
        lastName: pair.player2.lastName,
        club: pair.player2.club,
      },
      totalWeight: pair.totalWeight,
      seedRank: pair.seedRank,
      placement: pool?.name ?? (pair.isDirectTableau ? 'Accès direct au tableau' : 'Affectation à venir'),
    };
    pairsById.set(pair.id, participant);
    return participant;
  }).sort((a, b) => a.totalWeight - b.totalWeight);

  const allMatches = [
    ...tournament.pools.flatMap(pool => pool.matches),
    ...tournament.bracketMatches,
    ...tournament.consolanteMatches,
  ];
  const matches: PublicParticipantMatch[] = allMatches.map(match => ({
    matchNumber: match.matchNumber,
    roundName: match.roundName,
    status: match.status,
    matchFormat: match.matchFormat,
    scheduledTime: match.scheduledTime,
    courtName: tournament.courts.find(court => court.id === match.courtId)?.name,
    pair1: getPairName(match.pair1Id, pairsById),
    pair2: getPairName(match.pair2Id, pairsById),
    score: match.score ? formatScore(match.score) : undefined,
  })).sort((a, b) =>
    (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99') ||
    a.matchNumber - b.matchNumber
  );

  const pools: PublicPool[] = tournament.pools.map(pool => ({
    name: pool.name,
    standings: pool.standings.map((standing, index) => ({
      rank: standing.rank || index + 1,
      pairName: getPairName(standing.pairId, pairsById),
      points: standing.points,
      won: standing.won,
      lost: standing.lost,
      setDiff: standing.setDiff,
      gameDiff: standing.gameDiff,
      qualified: index < pool.qualifiedCount,
    })),
  }));

  return {
    tournament: {
      name: tournament.name,
      club: tournament.club,
      city: tournament.city,
      category: tournament.category,
      gender: tournament.gender,
      startDate: tournament.dates.start,
      endDate: tournament.dates.end,
    },
    participants,
    matches,
    pools,
    updatedAt: tournament.updatedAt,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Méthode non autorisée.' });
      return;
    }

    const token = new URL(req.url ?? '/', 'https://participant-view.invalid')
      .searchParams.get('token');
    if (
      !token ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
    ) {
      res.status(404).json({ error: 'Lien participant invalide ou expiré.' });
      return;
    }

    const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Configuration du partage participant manquante côté serveur.', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      res.status(500).json({ error: 'La vue participants est temporairement indisponible.' });
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from('tournaments')
      .select('data')
      .eq('public_share_token', token)
      .maybeSingle();
    if (error) {
      console.error('Hôte Supabase utilisé :', new URL(supabaseUrl).hostname.slice(0, 8));
      throw error;
    }
    if (!data?.data) {
      res.status(404).json({ error: 'Lien participant invalide ou expiré.' });
      return;
    }

    res.status(200).json(createParticipantView(data.data as Tournament));
  } catch (error) {
    console.error('Erreur lors du chargement de la vue participants :', error);
    if (!res.headersSent) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(500).json({ error: 'Impossible de charger les informations du tournoi.' });
    }
  }
}

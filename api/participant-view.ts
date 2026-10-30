import { createClient } from '@supabase/supabase-js';
import { env } from 'node:process';
import type { Pair, Player, Tournament } from '../src/types/tournament';
import type { ParticipantViewData } from '../src/types/participantView';

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

// Seules les informations publiques d'un joueur sont conservées.
function sanitizePlayer(player: Player): Player {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    club: player.club,
    ranking: player.ranking,
    isPresent: player.isPresent,
    licenseNumber: '',
    email: '',
    phone: '',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    paidAmount: 0,
  };
}

function sanitizePair(pair: Pair): Pair {
  return {
    id: pair.id,
    tournamentId: pair.tournamentId,
    player1: sanitizePlayer(pair.player1),
    player2: sanitizePlayer(pair.player2),
    totalWeight: pair.totalWeight,
    seedRank: pair.seedRank,
    entryPosition: pair.entryPosition,
    poolId: pair.poolId,
    isDirectTableau: pair.isDirectTableau,
    status: pair.status,
    createdAt: pair.createdAt,
  };
}

function createParticipantView(tournament: Tournament): ParticipantViewData {
  return {
    tournament: {
      ...tournament,
      entryFee: 0,
      publicShareToken: undefined,
      convocations: [],
      convocationMessageTemplates: undefined,
      pairs: tournament.pairs.filter(pair => pair.status === 'confirmed').map(sanitizePair),
    },
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

    // VITE_SUPABASE_URL prioritaire : SUPABASE_URL peut venir d'une intégration Vercel vers une autre base.
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
    if (error) throw error;
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

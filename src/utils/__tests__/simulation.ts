import type { Match, MatchScore, Pair, Tournament } from '../../types/tournament';
import {
  isMatchPlayable,
  resolveBracketByes,
  resolveMatchOutcomeReferences,
  compactConsolanteLoserSlots,
} from '../padelSchedule';

export type Random = () => number;

// Deterministic PRNG so a failing simulation can be replayed with its seed
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePairs(count: number): Pair[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pair_${i + 1}`,
    tournamentId: 't1',
    player1: {
      id: `p${i + 1}a`, firstName: `A${i + 1}`, lastName: 'Joueur', licenseNumber: '', ranking: (i + 1) * 10,
      email: '', phone: '', club: '', isPresent: true, paymentStatus: 'paid', paymentMethod: 'cash', paidAmount: 0,
    },
    player2: {
      id: `p${i + 1}b`, firstName: `B${i + 1}`, lastName: 'Joueur', licenseNumber: '', ranking: (i + 1) * 10 + 5,
      email: '', phone: '', club: '', isPresent: true, paymentStatus: 'paid', paymentMethod: 'cash', paidAmount: 0,
    },
    totalWeight: (i + 1) * 20 + 5,
    isDirectTableau: true,
    status: 'confirmed',
    createdAt: new Date(0).toISOString(),
  }));
}

export function makeTournament(
  pairs: Pair[],
  bracketMatches: Match[],
  consolanteMatches: Match[],
  bracketSize: number
): Tournament {
  return {
    id: 't1',
    pairs,
    pools: [],
    courts: [],
    bracketMatches,
    consolanteMatches,
    bracketSize,
    bracketEntrantCount: pairs.length,
    dates: { start: '2026-01-01' },
  } as unknown as Tournament;
}

function scoreFor(winnerSide: 'pair1' | 'pair2', winnerId: string, random: Random): MatchScore {
  const loserGames = () => Math.floor(random() * 6);
  const sets =
    winnerSide === 'pair1'
      ? [{ pair1: 6, pair2: loserGames() }, { pair1: 6, pair2: loserGames() }]
      : [{ pair1: loserGames(), pair2: 6 }, { pair1: loserGames(), pair2: 6 }];
  return { sets, winnerPairId: winnerId };
}

/**
 * Mirrors App.handleSaveScore for bracket / consolante matches: stores the score,
 * routes winner and loser to their next matches, resolves references and byes.
 */
export function applyBracketScore(tournament: Tournament, matchId: string, score: MatchScore): Tournament {
  const winnerPairId = score.winnerPairId;
  let bracket = tournament.bracketMatches;
  let consolante = tournament.consolanteMatches;
  ({ bracketMatches: bracket, consolanteMatches: consolante } = resolveMatchOutcomeReferences(
    bracket,
    consolante,
    tournament.pairs
  ));
  ({ bracketMatches: bracket, consolanteMatches: consolante } = compactConsolanteLoserSlots(bracket, consolante));

  const all = [...bracket, ...consolante];
  const target = all.find(m => m.id === matchId);
  if (!target) throw new Error(`Match introuvable: ${matchId}`);
  const loserPairId = winnerPairId === target.pair1Id ? target.pair2Id : target.pair1Id;
  const hasWinnerRoute = all.some(
    m =>
      (m.pair1SourceMatchId === target.id && m.pair1SourceOutcome === 'winner') ||
      (m.pair2SourceMatchId === target.id && m.pair2SourceOutcome === 'winner')
  );
  const hasLoserRoute = all.some(
    m =>
      (m.pair1SourceMatchId === target.id && m.pair1SourceOutcome === 'loser') ||
      (m.pair2SourceMatchId === target.id && m.pair2SourceOutcome === 'loser')
  );

  const update = (list: Match[]): Match[] =>
    list.map(m => {
      if (m.id === matchId) {
        return { ...m, score, winnerPairId, status: 'completed' as const, completedAt: new Date(0).toISOString() };
      }
      const next = { ...m };
      const winnerSlots = (['pair1', 'pair2'] as const).filter(
        slot => m[`${slot}SourceMatchId`] === target.id && m[`${slot}SourceOutcome`] === 'winner'
      );
      const loserSlots = (['pair1', 'pair2'] as const).filter(
        slot => m[`${slot}SourceMatchId`] === target.id && m[`${slot}SourceOutcome`] === 'loser'
      );
      if (winnerPairId && winnerSlots.length) {
        winnerSlots.forEach(slot => (next[`${slot}Id`] = winnerPairId));
      } else if (!hasWinnerRoute && target.nextMatchId === m.id && winnerPairId && target.nextMatchSlot) {
        next[`${target.nextMatchSlot}Id`] = winnerPairId;
      }
      if (loserPairId && loserSlots.length) {
        loserSlots.forEach(slot => (next[`${slot}Id`] = loserPairId));
      } else if (!hasLoserRoute && target.loserNextMatchId === m.id && loserPairId && target.loserNextMatchSlot) {
        next[`${target.loserNextMatchSlot}Id`] = loserPairId;
      }
      return next;
    });

  bracket = update(bracket);
  consolante = update(consolante);

  const first = resolveMatchOutcomeReferences(bracket, consolante, tournament.pairs);
  const byes = resolveBracketByes(first.bracketMatches, first.consolanteMatches);
  const second = resolveMatchOutcomeReferences(byes.bracketMatches, byes.consolanteMatches, tournament.pairs);
  return { ...tournament, bracketMatches: second.bracketMatches, consolanteMatches: second.consolanteMatches };
}

/** Plays every playable match with random winners until nothing is left to play. */
export function playAllMatches(
  initial: Tournament,
  random: Random,
  chooseWinner: (match: Match) => 'pair1' | 'pair2' = () => (random() < 0.5 ? 'pair1' : 'pair2')
): { tournament: Tournament; played: number } {
  let tournament = initial;
  let played = 0;
  for (let guard = 0; guard < 500; guard++) {
    const next = [...tournament.bracketMatches, ...tournament.consolanteMatches].find(
      m => m.status !== 'completed' && m.status !== 'walkover' && isMatchPlayable(m) && m.pair1Id && m.pair2Id
    );
    if (!next) break;
    const side = chooseWinner(next);
    const winnerId = side === 'pair1' ? next.pair1Id! : next.pair2Id!;
    tournament = applyBracketScore(tournament, next.id, scoreFor(side, winnerId, random));
    played++;
  }
  return { tournament, played };
}

import type { Match, Pair, Tournament } from '../types/tournament';
import { computePoolStandings } from './padelCalculations';

type Slot = 'pair1' | 'pair2';

export interface ClearScoreResult {
  tournament: Tournament;
  error?: string;
}

const resetMatch = (match: Match): Match => {
  const { score: _score, winnerPairId: _winner, completedAt: _completedAt, startedAt: _startedAt, ...rest } = match;
  return { ...rest, status: 'scheduled' };
};

const overwrite = (match: Match, next: Match) => {
  for (const key of Object.keys(match)) delete (match as unknown as Record<string, unknown>)[key];
  Object.assign(match, next);
};

/**
 * Cancels the score of a match: the match goes back to "scheduled" and the winner / loser that
 * were pushed into the following matches are taken back. Refused when a following match that
 * received one of them is already in progress or played.
 */
export function clearMatchScore(tournament: Tournament, matchId: string): ClearScoreResult {
  const pairsMap = new Map<string, Pair>(tournament.pairs.map(pair => [pair.id, pair]));
  const poolWithMatch = tournament.pools.find(pool => pool.matches.some(match => match.id === matchId));
  if (poolWithMatch) {
    return {
      tournament: {
        ...tournament,
        pools: tournament.pools.map(pool => {
          if (pool.id !== poolWithMatch.id) return pool;
          const updated = { ...pool, matches: pool.matches.map(match => (match.id === matchId ? resetMatch(match) : match)) };
          return { ...updated, standings: computePoolStandings(updated, pairsMap) };
        }),
      },
    };
  }

  const bracket = tournament.bracketMatches.map(match => ({ ...match }));
  const consolante = tournament.consolanteMatches.map(match => ({ ...match }));
  const all = [...bracket, ...consolante];
  const target = all.find(match => match.id === matchId);
  if (!target) return { tournament, error: 'Match introuvable.' };

  let error: string | undefined;

  const release = (source: Match, winnerId?: string, loserId?: string) => {
    const targets: Array<{ match: Match; slot: Slot; pairId: string }> = [];
    for (const outcome of ['winner', 'loser'] as const) {
      const pairId = outcome === 'winner' ? winnerId : loserId;
      if (!pairId) continue;
      const explicit = all.flatMap(match =>
        (['pair1', 'pair2'] as const)
          .filter(slot => match[`${slot}SourceMatchId`] === source.id && match[`${slot}SourceOutcome`] === outcome)
          .map(slot => ({ match, slot, pairId }))
      );
      if (explicit.length) {
        targets.push(...explicit);
        continue;
      }
      const nextId = outcome === 'winner' ? source.nextMatchId : source.loserNextMatchId;
      const nextSlot = outcome === 'winner' ? source.nextMatchSlot : source.loserNextMatchSlot;
      const next = nextId ? all.find(match => match.id === nextId) : undefined;
      if (next && nextSlot) targets.push({ match: next, slot: nextSlot, pairId });
    }

    for (const { match, slot, pairId } of targets) {
      if (match[`${slot}Id`] !== pairId) continue;
      if (match.status === 'completed' || match.status === 'in_progress') {
        error ??= `Impossible : le match #${match.matchNumber} (${match.roundName}) est déjà en cours ou joué. Annulez d'abord son score.`;
        continue;
      }
      match[`${slot}Id`] = undefined;
      if (match.status === 'walkover') {
        // The pair had advanced automatically through a bye: take it back further
        const advanced = match.winnerPairId;
        overwrite(match, resetMatch(match));
        release(match, advanced, undefined);
      }
    }
  };

  const winnerId = target.winnerPairId;
  const loserId = winnerId ? (winnerId === target.pair1Id ? target.pair2Id : target.pair1Id) : undefined;
  release(target, winnerId, loserId);
  if (error) return { tournament, error };

  overwrite(target, resetMatch(target));
  return { tournament: { ...tournament, bracketMatches: bracket, consolanteMatches: consolante } };
}

import { describe, expect, it } from 'vitest';
import { buildFftBracketTournament } from '../fftBracket';
import { computeCompleteFinalStandings, computePoolStandings, distributePairsBySerpentine, generatePoolMatches } from '../padelCalculations';
import { findSamePoolClashes, parseQualifierPlaceholder, resolvePoolQualifiers } from '../poolQualifiers';
import type { Match, Pool } from '../../types/tournament';
import { makePairs, makeTournament, playAllMatches, seededRandom } from './simulation';

describe('Placeholders de qualifiés', () => {
  it('lit le rang et la poule', () => {
    expect(parseQualifierPlaceholder('1er Poule A')).toEqual({ rank: 1, poolName: 'Poule A' });
    expect(parseQualifierPlaceholder('2e Poule B')).toEqual({ rank: 2, poolName: 'Poule B' });
    expect(parseQualifierPlaceholder('Vainqueur M1')).toBeNull();
    expect(parseQualifierPlaceholder(undefined)).toBeNull();
  });
});

function finishedPool(name: string, ids: string[], random: () => number): Pool {
  const matches = generatePoolMatches('t1', name, name, ids).map(m => {
    const p1Wins = random() < 0.5;
    return {
      ...m,
      status: 'completed' as const,
      score: { sets: p1Wins ? [{ pair1: 6, pair2: 3 }, { pair1: 6, pair2: 2 }] : [{ pair1: 2, pair2: 6 }, { pair1: 3, pair2: 6 }] },
      winnerPairId: p1Wins ? m.pair1Id : m.pair2Id,
    };
  });
  return { id: name, tournamentId: 't1', name, pairIds: ids, matches, standings: [], qualifiedCount: 2 };
}

describe('Tournoi complet: poules puis tableau', () => {
  it('1er et 2e de chaque poule rejoignent les bons emplacements, sans doublon, et le tableau se termine', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = seededRandom(seed);
      const pairs = makePairs(16);
      const map = new Map(pairs.map(p => [p.id, p]));
      const groups = distributePairsBySerpentine(pairs.map(p => p.id), 4);
      const pools = groups.map((ids, i) => {
        const pool = finishedPool(`Poule ${String.fromCharCode(65 + i)}`, ids, random);
        return { ...pool, standings: computePoolStandings(pool, map) };
      });

      // 8 qualifiers (1st + 2nd of 4 pools) go into an 8-place bracket as placeholders
      const draw = buildFftBracketTournament('t1', pairs.slice(0, 8), 8, random);
      const labels: string[] = pools.flatMap(p => [`1er ${p.name}`, `2e ${p.name}`]);
      const realIds = new Set(pairs.slice(0, 8).map(p => p.id));
      let label = 0;
      const placeholdered: Match[] = draw.bracketMatches.map(m => {
        const next = { ...m };
        if (m.pair1Id && realIds.has(m.pair1Id)) {
          next.pair1Id = undefined;
          next.pair1Placeholder = labels[label++];
        }
        if (m.pair2Id && realIds.has(m.pair2Id)) {
          next.pair2Id = undefined;
          next.pair2Placeholder = labels[label++];
        }
        return next;
      });
      expect(label).toBe(8);

      const incomplete = resolvePoolQualifiers(placeholdered, [{ ...pools[0], matches: [{ ...pools[0].matches[0], status: 'scheduled' }, ...pools[0].matches.slice(1)] }, ...pools.slice(1)]);
      expect(incomplete.pendingPools).toEqual(['Poule A']);
      expect(incomplete.filled).toBe(6);

      const { matches, filled, pendingPools } = resolvePoolQualifiers(placeholdered, pools);
      expect(filled).toBe(8);
      expect(pendingPools).toEqual([]);

      const slotted = matches.flatMap(m => [m.pair1Id, m.pair2Id]).filter((id): id is string => Boolean(id));
      const expected = pools.flatMap(p => [p.standings[0].pairId, p.standings[1].pairId]);
      expect([...slotted].sort()).toEqual([...expected].sort());
      const tournament = makeTournament(pairs.slice(0, 8), matches, draw.consolanteMatches, 8);
      const { tournament: done } = playAllMatches(tournament, random);
      expect(computeCompleteFinalStandings(done).length).toBe(8);
    }
  });

  it("un 2e de poule n'est jamais remplacé par le vainqueur de la poule", () => {
    const random = seededRandom(5);
    const pairs = makePairs(4);
    const map = new Map(pairs.map(p => [p.id, p]));
    const pool = finishedPool('Poule A', pairs.map(p => p.id), random);
    pool.standings = computePoolStandings(pool, map);
    const bracket = [{ id: 'b1', tournamentId: 't1', type: 'bracket', roundName: 'Finale', matchNumber: 1, pair1Placeholder: '1er Poule A', pair2Placeholder: '2e Poule A', status: 'scheduled' }] as Match[];
    const { matches } = resolvePoolQualifiers(bracket, [pool]);
    expect(matches[0].pair1Id).toBe(pool.standings[0].pairId);
    expect(matches[0].pair2Id).toBe(pool.standings[1].pairId);
  });
});

describe('Même poule au premier tour', () => {
  it("détecte deux qualifiés d'une même poule qui se rencontrent", () => {
    const base = { tournamentId: 't1', type: 'bracket', roundName: '1/4', matchNumber: 1, status: 'scheduled' } as const;
    const clash = { ...base, id: 'a', pair1Placeholder: '1er Poule A', pair2Placeholder: '2e Poule A' } as Match;
    const fine = { ...base, id: 'b', pair1Placeholder: '1er Poule A', pair2Placeholder: '2e Poule B' } as Match;
    expect(findSamePoolClashes([clash, fine]).map(m => m.id)).toEqual(['a']);
  });
});

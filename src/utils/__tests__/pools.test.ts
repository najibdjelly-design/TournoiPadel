import { describe, expect, it } from 'vitest';
import {
  computePoolStandings,
  distributePairsByRankTier,
  distributePairsBySerpentine,
  generatePoolMatches,
} from '../padelCalculations';
import type { Match, Pool } from '../../types/tournament';
import { makePairs, seededRandom } from './simulation';

function playPool(pairIds: string[], random: () => number, winner?: (m: Match) => 'pair1' | 'pair2'): Pool {
  const matches = generatePoolMatches('t1', 'poolA', 'Poule A', pairIds).map(m => {
    const side = winner ? winner(m) : random() < 0.5 ? 'pair1' : 'pair2';
    const loserGames = Math.floor(random() * 6);
    const sets =
      side === 'pair1'
        ? [{ pair1: 6, pair2: loserGames }, { pair1: 6, pair2: loserGames }]
        : [{ pair1: loserGames, pair2: 6 }, { pair1: loserGames, pair2: 6 }];
    return {
      ...m,
      status: 'completed' as const,
      score: { sets },
      winnerPairId: side === 'pair1' ? m.pair1Id : m.pair2Id,
    };
  });
  return { id: 'poolA', tournamentId: 't1', name: 'Poule A', pairIds, matches, standings: [], qualifiedCount: 2 };
}

describe('Répartition en poules', () => {
  it('serpentin: toutes les paires placées une fois, poules équilibrées (écart max 1)', () => {
    for (let n = 4; n <= 40; n++) {
      for (let pools = 2; pools <= 8 && pools * 2 <= n; pools++) {
        const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
        const result = distributePairsBySerpentine(ids, pools);
        expect(result.flat().sort()).toEqual([...ids].sort());
        const sizes = result.map(p => p.length);
        expect(Math.max(...sizes) - Math.min(...sizes), `${n}/${pools}`).toBeLessThanOrEqual(1);
        // top seeds are never in the same pool when there are enough pools
        const topSeedPools = result.map(p => p.filter(id => Number(id.slice(1)) <= pools).length);
        expect(Math.max(...topSeedPools)).toBe(1);
      }
    }
  });

  it('chapeaux: toutes les paires placées une fois', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `p${i + 1}`);
    const result = distributePairsByRankTier(ids, 4);
    expect(result.flat().sort()).toEqual([...ids].sort());
  });
});

describe('Matchs et classement de poule', () => {
  it('round-robin: n(n-1)/2 matchs, chaque paire rencontre chaque autre une fois', () => {
    for (let n = 2; n <= 8; n++) {
      const ids = makePairs(n).map(p => p.id);
      const matches = generatePoolMatches('t1', 'poolA', 'Poule A', ids);
      expect(matches.length).toBe((n * (n - 1)) / 2);
      const keys = matches.map(m => [m.pair1Id, m.pair2Id].sort().join('|'));
      expect(new Set(keys).size).toBe(matches.length);
      expect(new Set(matches.map(m => m.id)).size).toBe(matches.length);
    }
  });

  it('simulation: points, joués, rangs cohérents pour 3 à 6 paires', () => {
    for (let n = 3; n <= 6; n++) {
      const pairs = makePairs(n);
      const map = new Map(pairs.map(p => [p.id, p]));
      for (let seed = 1; seed <= 50; seed++) {
        const pool = playPool(pairs.map(p => p.id), seededRandom(seed));
        const standings = computePoolStandings(pool, map);
        expect(standings.map(s => s.rank)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(standings.every(s => s.played === n - 1)).toBe(true);
        expect(standings.reduce((sum, s) => sum + s.points, 0)).toBe(3 * pool.matches.length);
        expect(standings.reduce((sum, s) => sum + s.won, 0)).toBe(pool.matches.length);
        for (let i = 1; i < standings.length; i++) expect(standings[i - 1].points).toBeGreaterThanOrEqual(standings[i].points);
      }
    }
  });

  it('un favori qui gagne tout termine premier', () => {
    const pairs = makePairs(5);
    const map = new Map(pairs.map(p => [p.id, p]));
    const idx = (id?: string) => Number(id!.split('_')[1]);
    const pool = playPool(pairs.map(p => p.id), seededRandom(1), m => (idx(m.pair1Id) < idx(m.pair2Id) ? 'pair1' : 'pair2'));
    expect(computePoolStandings(pool, map).map(s => s.pairId)).toEqual(pairs.map(p => p.id));
  });

  it('égalité à deux strictement: le résultat du match direct prime sur la différence de sets/jeux', () => {
    const four = makePairs(4);
    const [pa, pb, pc, pd] = four.map(p => p.id);
    const map = new Map(four.map(p => [p.id, p]));
    const mk = (id: string, p1: string, p2: string, s: Array<[number, number]>): Match => ({
      id, tournamentId: 't1', type: 'pool', poolId: 'poolA', roundName: id, matchNumber: 1,
      pair1Id: p1, pair2Id: p2, status: 'completed',
      score: { sets: s.map(([x, y]) => ({ pair1: x, pair2: y })) },
      winnerPairId: s.filter(([x, y]) => x > y).length > s.length / 2 ? p1 : p2,
    });
    // C beats A, B, D -> 3W. A beats B, D -> 2W. B beats D -> 1W. D 0W: no tie. Build tie for 2nd/3rd:
    const pool: Pool = {
      id: 'poolA', tournamentId: 't1', name: 'Poule A', pairIds: [pa, pb, pc, pd], standings: [], qualifiedCount: 2,
      matches: [
        mk('ab', pa, pb, [[7, 6], [7, 6]]),   // A beats B narrowly
        mk('ac', pc, pa, [[6, 0], [6, 0]]),   // C beats A heavily
        mk('ad', pa, pd, [[6, 4], [6, 4]]),   // A beats D
        mk('bc', pb, pc, [[6, 0], [6, 0]]),   // B beats C heavily
        mk('bd', pb, pd, [[6, 0], [6, 0]]),   // B beats D heavily
        mk('cd', pd, pc, [[6, 4], [6, 4]]),   // D beats C
      ],
    };
    // A 2W (B,D), B 2W (C,D), C 1W (A), D 1W (C): A vs B tie on points; B has far better diff but A won the direct match
    const standings = computePoolStandings(pool, map);
    expect(standings.slice(0, 2).map(s => s.pairId)).toEqual([pa, pb]);
  });
});

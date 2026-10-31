import { describe, expect, it } from 'vitest';
import { buildFftCascadeTournament, drawFftBracketRanks, isFftCascadeSupported } from '../fftDraw';
import { computeCompleteFinalStandings, generateFullClassificationTournament } from '../padelCalculations';
import { makePairs, makeTournament, playAllMatches, seededRandom } from './simulation';

describe('drawFftBracketRanks', () => {
  it('places TS1 at the bottom, TS2 at the top and gives byes to the best seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { ranks } = drawFftBracketRanks(16, 13, seededRandom(seed));
      expect(ranks[ranks.length - 1]).toBe(1);
      expect(ranks[0]).toBe(2);
      // every team 1..13 appears exactly once, the rest are byes (> 13)
      const teams = ranks.filter(rank => rank <= 13).sort((a, b) => a - b);
      expect(teams).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
      // TS3 and TS4 end up in different halves
      const half = (rank: number) => (ranks.indexOf(rank) < 8 ? 0 : 1);
      expect(half(3)).not.toBe(half(4));
      // byes face TS1..TS3 only
      for (let slot = 0; slot < 16; slot += 2) {
        const pair = [ranks[slot], ranks[slot + 1]];
        if (pair.some(rank => rank > 13)) expect(Math.min(...pair)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps every quarter holding one of TS5-TS8 for a 32 draw', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { ranks } = drawFftBracketRanks(32, 32, seededRandom(seed));
      const quarter = (rank: number) => Math.floor(ranks.indexOf(rank) / 8);
      const quarters = [5, 6, 7, 8].map(quarter);
      expect(new Set(quarters).size).toBe(4);
    }
  });
});

function checkFinalStandings(entrants: number, size: 8 | 16 | 24, label: string, random: () => number) {
  const pairs = makePairs(entrants);
  const draw =
    size === 24 && isFftCascadeSupported(entrants)
      ? buildFftCascadeTournament('t1', pairs, random)
      : generateFullClassificationTournament('t1', size, entrants);
  let tournament = makeTournament(pairs, draw.bracketMatches, draw.consolanteMatches, size);

  // Pair ids are assigned by the draw only in the cascade; legacy generator uses placeholders
  if (!isFftCascadeSupported(entrants)) return undefined;

  const result = playAllMatches(tournament, random);
  tournament = result.tournament;

  const unplayed = [...tournament.bracketMatches, ...tournament.consolanteMatches].filter(
    m => m.status !== 'completed' && m.status !== 'walkover'
  );
  expect(unplayed.map(m => m.roundName), `${label}: matchs non joués`).toEqual([]);

  const standings = computeCompleteFinalStandings(tournament);
  expect(standings.length, label).toBe(entrants);
  expect(standings.every(item => item.status === 'confirmed'), `${label}: places non attribuées`).toBe(true);
  const ranked = standings.map(item => item.pairId);
  expect(new Set(ranked).size, `${label}: équipe classée deux fois`).toBe(entrants);
  return result.played;
}

describe('Cascade FFT 17-20 équipes: tournoi complet simulé', () => {
  for (const entrants of [17, 18, 19, 20]) {
    it(`${entrants} équipes: tous les matchs jouables et classement 1..${entrants}`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        checkFinalStandings(entrants, 24, `n=${entrants} seed=${seed}`, seededRandom(seed));
      }
    });
  }

  it('les têtes de série TS1-TS4 ne se rencontrent pas avant les quarts', () => {
    for (const entrants of [17, 18, 19, 20]) {
      for (let seed = 1; seed <= 20; seed++) {
        const pairs = makePairs(entrants);
        const draw = buildFftCascadeTournament('t1', pairs, seededRandom(seed));
        const early = draw.bracketMatches.filter(m => (m.bracketRound ?? 1) < (draw.bracketMatches.at(-1)?.bracketRound ?? 99) - 2);
        const topSeeds = new Set(['pair_1', 'pair_2', 'pair_3', 'pair_4']);
        for (const match of early) {
          expect(topSeeds.has(match.pair1Id ?? '') && topSeeds.has(match.pair2Id ?? '')).toBe(false);
        }
      }
    }
  });
});

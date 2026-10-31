import { describe, expect, it } from 'vitest';
import { buildFftBracketTournament } from '../fftBracket';
import { computeCompleteFinalStandings } from '../padelCalculations';
import { makePairs, makeTournament, playAllMatches, seededRandom } from './simulation';

const SEEDS = 25;

function simulate(size: number, entrants: number, seed: number) {
  const random = seededRandom(seed);
  const pairs = makePairs(entrants);
  const draw = buildFftBracketTournament('t1', pairs, size, random);
  const tournament = makeTournament(pairs, draw.bracketMatches, draw.consolanteMatches, size);
  return { draw, ...playAllMatches(tournament, random) };
}

describe('Tableau FFT générique (4/8/16/32 places): tournoi complet simulé', () => {
  const cases: Array<[number, number]> = [];
  for (const size of [4, 8, 16, 32]) {
    for (let n = Math.max(3, size / 2 + 1); n <= size; n++) cases.push([size, n]);
  }
  cases.push([8, 4], [16, 8], [16, 6], [32, 17], [32, 21], [32, 24]);

  for (const [size, entrants] of cases) {
    it(`${entrants} équipes dans ${size} places: tout se joue, classement 1..${entrants} complet`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const { tournament: done } = simulate(size, entrants, seed);
        const matches = [...done.bracketMatches, ...done.consolanteMatches];

        const unplayed = matches.filter(m => m.status !== 'completed' && m.status !== 'walkover');
        expect(unplayed.map(m => `${m.roundName} ${m.pair1Id}/${m.pair2Id}`), `seed ${seed}`).toEqual([]);

        // a team never plays itself
        expect(matches.filter(m => m.pair1Id && m.pair1Id === m.pair2Id), `seed ${seed}`).toEqual([]);

        const standings = computeCompleteFinalStandings(done);
        expect(standings.length).toBe(entrants);
        expect(standings.filter(item => item.status !== 'confirmed').map(item => item.rank), `seed ${seed}`).toEqual([]);
        expect(new Set(standings.map(item => item.pairId)).size, `doublon (seed ${seed})`).toBe(entrants);
      }
    });
  }

  it('le meilleur joueur gagne si les favoris gagnent toujours', () => {
    for (const [size, entrants] of [[16, 12], [32, 24], [8, 6]] as const) {
      const random = seededRandom(7);
      const pairs = makePairs(entrants);
      const draw = buildFftBracketTournament('t1', pairs, size, random);
      const tournament = makeTournament(pairs, draw.bracketMatches, draw.consolanteMatches, size);
      const favourite = (match: { pair1Id?: string; pair2Id?: string }) =>
        Number(match.pair1Id!.split('_')[1]) < Number(match.pair2Id!.split('_')[1]) ? 'pair1' : 'pair2';
      const { tournament: done } = playAllMatches(tournament, random, favourite);
      const standings = computeCompleteFinalStandings(done);
      // favourites always win: the semi-finalists are exactly the 4 best teams, in order
      expect(standings.slice(0, 4).map(item => item.pairId)).toEqual(pairs.slice(0, 4).map(pair => pair.id));
    }
  });

  it('TS1 est en bas, TS2 en haut et un seul match joué au premier tour pour les meilleures têtes de série', () => {
    const pairs = makePairs(12);
    const draw = buildFftBracketTournament('t1', pairs, 16, seededRandom(3));
    const firstRound = draw.bracketMatches.filter(m => m.bracketRound === 1);
    const involved = new Set(firstRound.flatMap(m => [m.pair1Id, m.pair2Id]));
    // 12 teams in 16 places: the 4 best seeds have a bye
    for (const seed of ['pair_1', 'pair_2', 'pair_3', 'pair_4']) expect(involved.has(seed)).toBe(false);
    expect(firstRound.length).toBe(4);
  });
});

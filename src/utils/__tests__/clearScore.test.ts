import { describe, expect, it } from 'vitest';
import { buildFftBracketTournament } from '../fftBracket';
import { clearMatchScore } from '../clearScore';
import { isMatchPlayable } from '../padelSchedule';
import type { Match, Tournament } from '../../types/tournament';
import { applyBracketScore, makePairs, makeTournament, seededRandom } from './simulation';

const all = (t: Tournament) => [...t.bracketMatches, ...t.consolanteMatches];
const state = (t: Tournament) =>
  all(t).map(m => `${m.id}|${m.pair1Id ?? ''}|${m.pair2Id ?? ''}|${m.status}|${m.winnerPairId ?? ''}`);

const playable = (t: Tournament): Match | undefined =>
  all(t).find(m => m.status !== 'completed' && m.status !== 'walkover' && isMatchPlayable(m) && m.pair1Id && m.pair2Id);

function play(t: Tournament, match: Match, random: () => number): Tournament {
  const side = random() < 0.5 ? 'pair1' : 'pair2';
  const winnerPairId = side === 'pair1' ? match.pair1Id! : match.pair2Id!;
  const sets = side === 'pair1' ? [{ pair1: 6, pair2: 2 }, { pair1: 6, pair2: 3 }] : [{ pair1: 2, pair2: 6 }, { pair1: 3, pair2: 6 }];
  return applyBracketScore(t, match.id, { sets, winnerPairId });
}

describe('Annulation de score', () => {
  it('annuler le dernier match joué ramène exactement l\'état précédent (avec ou sans byes)', () => {
    for (const [size, entrants] of [[8, 8], [16, 12], [16, 16], [32, 21], [8, 6]] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const random = seededRandom(seed);
        const pairs = makePairs(entrants);
        const draw = buildFftBracketTournament('t1', pairs, size, random);
        let tournament = makeTournament(pairs, draw.bracketMatches, draw.consolanteMatches, size);
        for (let step = 0; step < 200; step++) {
          const next = playable(tournament);
          if (!next) break;
          const before = state(tournament);
          const after = play(tournament, next, random);
          const { tournament: undone, error } = clearMatchScore(after, next.id);
          expect(error, `${entrants}/${size} seed ${seed} step ${step}`).toBeUndefined();
          expect(state(undone), `${entrants}/${size} seed ${seed} step ${step}`).toEqual(before);
          tournament = after;
        }
      }
    }
  });

  it("refuse d'annuler un match si le match suivant est déjà joué", () => {
    const random = seededRandom(1);
    const pairs = makePairs(8);
    const draw = buildFftBracketTournament('t1', pairs, 8, random);
    let tournament = makeTournament(pairs, draw.bracketMatches, draw.consolanteMatches, 8);
    const first = playable(tournament)!;
    tournament = play(tournament, first, random);
    // play until the match fed by `first` is played
    const nextId = first.nextMatchId!;
    for (let i = 0; i < 20; i++) {
      const m = playable(tournament);
      if (!m) break;
      tournament = play(tournament, m, random);
      if (all(tournament).find(x => x.id === nextId)?.status === 'completed') break;
    }
    const result = clearMatchScore(tournament, first.id);
    expect(result.error).toMatch(/déjà en cours ou joué/);
    expect(result.tournament).toBe(tournament);
  });
});

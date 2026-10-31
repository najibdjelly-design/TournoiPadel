import type { Match, Pair } from '../types/tournament';
import { drawFftBracketRanks, roundLabel } from './fftDraw';

type Random = () => number;
type Entry = Match | Pair | undefined;
interface Feed {
  match: Match;
  outcome: 'winner' | 'loser';
}

const isMatch = (entry: Entry): entry is Match => Boolean(entry && 'roundName' in entry);

function phaseName(matchCount: number, teamCount: number): string {
  if (teamCount % 2 === 1 && matchCount === 1) return 'Tour';
  if (matchCount === 2) return 'Demi-finale';
  if (matchCount === 4) return 'Quart';
  if (matchCount === 8) return '1/8e';
  return 'Tour';
}

/**
 * Single-elimination bracket of `size` slots (4, 8, 16, 32) drawn with the FFT placement rules.
 * Teams without an opponent in the first round simply enter the next round (no bye match).
 * Every eliminated team is then placed through classification matches, so that all `n` teams
 * end up with an exact rank from 1 to n whatever the number of entrants.
 */
export function buildFftBracketTournament(
  tournamentId: string,
  pairsBestFirst: Pair[],
  size: number,
  random: Random = Math.random
): { bracketMatches: Match[]; consolanteMatches: Match[]; seededCount: number } {
  const n = pairsBestFirst.length;
  const levels = Math.log2(size);
  const { ranks, seedCount } = drawFftBracketRanks(size, n, random);
  const timestamp = Date.now();
  let matchNumber = 1;
  const bracket: Match[] = [];
  const consolante: Match[] = [];

  const base = (
    id: string,
    type: Match['type'],
    roundName: string,
    round: number,
    slotIndex: number,
    range: string
  ): Match => ({
    id,
    tournamentId,
    type,
    roundName,
    matchNumber: matchNumber++,
    bracketRound: round,
    bracketSlotIndex: slotIndex,
    status: 'scheduled',
    classificationRankRange: range,
  });

  const feed = (source: Match, target: Match, slot: 'pair1' | 'pair2', outcome: 'winner' | 'loser') => {
    const label = outcome === 'winner' ? 'Vainqueur' : 'Perdant';
    target[`${slot}Placeholder`] = `${label} ${source.roundName.replace(/ \(#\d+\)$/, '')} #${source.matchNumber}`;
    target[`${slot}SourceMatchId`] = source.id;
    target[`${slot}SourceOutcome`] = outcome;
    if (outcome === 'winner') {
      source.nextMatchId = target.id;
      source.nextMatchSlot = slot;
    } else {
      source.loserNextMatchId = target.id;
      source.loserNextMatchSlot = slot;
    }
  };

  const attach = (target: Match, slot: 'pair1' | 'pair2', entry: Entry) => {
    if (isMatch(entry)) feed(entry, target, slot, 'winner');
    else if (entry) target[`${slot}Id`] = entry.id;
  };

  const classify = (entries: Feed[], start: number, depth: number) => {
    const count = entries.length;
    if (count === 0) return;
    if (count === 1) {
      const { match, outcome } = entries[0];
      if (outcome === 'loser') match.targetRankLoser = start;
      else match.targetRankWinner = start;
      return;
    }
    const end = start + count - 1;
    const matchCount = Math.floor(count / 2);
    const created: Match[] = [];
    for (let i = 0; i < matchCount; i++) {
      const name =
        count === 2
          ? `Match pour la ${start}e place`
          : `${phaseName(matchCount, count)} ${start}e-${end}e (#${i + 1})`;
      const match = base(`m_fft_c${start}_d${depth}_${i}_${timestamp}`, 'consolante', name, depth, i, `${start}-${end}`);
      for (const [slot, offset] of [['pair1', 0], ['pair2', 1]] as const) {
        const source = entries[i * 2 + offset];
        feed(source.match, match, slot, source.outcome);
      }
      consolante.push(match);
      created.push(match);
    }
    const winners: Feed[] = created.map(match => ({ match, outcome: 'winner' as const }));
    // With an odd number of teams, the last one waits for the winners of the first round
    if (count % 2 === 1) winners.push(entries[count - 1]);
    const losers: Feed[] = created.map(match => ({ match, outcome: 'loser' as const }));
    classify(winners, start, depth + 1);
    classify(losers, start + winners.length, depth + 1);
  };

  const seedIds = new Set(pairsBestFirst.slice(0, seedCount).map(pair => pair.id));
  const isSeed = (entry: Entry) => Boolean(entry && !isMatch(entry) && seedIds.has(entry.id));
  // FFT presentation rule: a seed (TS) is shown in the top slot of its match in the upper half
  // of the draw, and in the bottom slot in the lower half
  const orient = (a: Entry, b: Entry, upperHalf: boolean): [Entry, Entry] => {
    if (isSeed(a) === isSeed(b)) return [a, b];
    const seedFirst = upperHalf;
    return isSeed(a) === seedFirst ? [a, b] : [b, a];
  };

  let entries: Entry[] = ranks.map(rank => (rank <= n ? pairsBestFirst[rank - 1] : undefined));
  const roundMatches: Match[][] = [];

  for (let level = 1; level <= levels - 2; level++) {
    const label = roundLabel(levels - 2 - level);
    const next: Entry[] = [];
    const created: Match[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const a = entries[i];
      const b = entries[i + 1];
      if (!a || !b) {
        next.push(a ?? b);
        continue;
      }
      const match = base(`m_fft_main_r${level}_${created.length}_${timestamp}`, 'bracket', `${label} (#${created.length + 1})`, level, created.length, `1-${n}`);
      const [top, bottom] = orient(a, b, i < entries.length / 2);
      attach(match, 'pair1', top);
      attach(match, 'pair2', bottom);
      bracket.push(match);
      created.push(match);
      next.push(match);
    }
    roundMatches.push(created);
    entries = next;
  }

  const semis: Match[] = [];
  const finalists: Entry[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const a = entries[i];
    const b = entries[i + 1];
    if (!a || !b) {
      finalists.push(a ?? b);
      continue;
    }
    const match = base(`m_fft_main_sf${semis.length}_${timestamp}`, 'bracket', `Demi-finale (#${semis.length + 1})`, levels - 1, semis.length, '1-4');
    const [top, bottom] = orient(a, b, i < entries.length / 2);
    attach(match, 'pair1', top);
    attach(match, 'pair2', bottom);
    bracket.push(match);
    semis.push(match);
    finalists.push(match);
  }

  const final = base(`m_fft_main_f_${timestamp}`, 'bracket', 'Grande Finale', levels, 0, '1-2');
  attach(final, 'pair1', finalists[0]);
  attach(final, 'pair2', finalists[1]);
  final.targetRankWinner = 1;
  final.targetRankLoser = 2;
  bracket.push(final);

  if (semis.length === 2) {
    const thirdPlace = base(`m_fft_main_pf_${timestamp}`, 'bracket', 'Petite Finale (Match 3e place)', levels, 1, '3-4');
    feed(semis[0], thirdPlace, 'pair1', 'loser');
    feed(semis[1], thirdPlace, 'pair2', 'loser');
    thirdPlace.targetRankWinner = 3;
    thirdPlace.targetRankLoser = 4;
    bracket.push(thirdPlace);
  } else if (semis.length === 1) {
    semis[0].targetRankLoser = 3;
  }

  let nextRank = 3 + semis.length;
  for (let index = roundMatches.length - 1; index >= 0; index--) {
    const losers: Feed[] = roundMatches[index].map(match => ({ match, outcome: 'loser' as const }));
    classify(losers, nextRank, 1);
    nextRank += losers.length;
  }

  return { bracketMatches: bracket, consolanteMatches: consolante, seededCount: seedCount };
}

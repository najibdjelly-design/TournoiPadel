type Random = () => number;
import type { Match, Pair } from '../types/tournament';

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Seed layout with 1 on top and 2 at the bottom, halves/quarters balanced
function buildStandardSeedOrder(size: number): number[] {
  let order = [1, 2];
  for (let current = 2; current < size; current *= 2) {
    order = order.flatMap((seed, index) =>
      index % 2 === 0 ? [seed, current * 2 + 1 - seed] : [current * 2 + 1 - seed, seed]
    );
  }
  return order;
}

// Seed groups drawn together: [1], [2], [3-4], [5-8], [9-16], ...
function getSeedGroups(seedCount: number): number[][] {
  const groups: number[][] = [[1], [2]];
  for (let start = 3, length = 2; start <= seedCount; start += length, length *= 2) {
    groups.push(Array.from({ length }, (_, i) => start + i));
  }
  return groups.map(group => group.filter(seed => seed <= seedCount)).filter(group => group.length);
}

/**
 * FFT-style draw for a bracket of `size` slots holding `entrantCount` teams.
 * Returns, for each slot from top to bottom, the 1-based rank of the team placed there.
 * A rank greater than `entrantCount` means a bye. TS1 is at the bottom, TS2 at the top,
 * TS3-4 are drawn one per half, TS5-8 one per quarter, etc.; byes go to the best seeds.
 */
export function drawFftBracketRanks(
  size: number,
  entrantCount: number,
  random: Random = Math.random,
  forcedSeedCount?: number
): { ranks: number[]; seedCount: number } {
  const seedCount = forcedSeedCount ?? Math.min(entrantCount, Math.max(2, size / 2));
  const ranks = buildStandardSeedOrder(size).reverse();

  for (const group of getSeedGroups(seedCount)) {
    if (group.length < 2) continue;
    const slots = ranks.flatMap((rank, slot) => (group.includes(rank) ? [slot] : []));
    const drawn = shuffle(group, random);
    slots.forEach((slot, index) => {
      ranks[slot] = drawn[index];
    });
  }

  const unseeded = Array.from(
    { length: Math.max(0, entrantCount - seedCount) },
    (_, i) => seedCount + 1 + i
  );
  const unseededSlots = ranks.flatMap((rank, slot) =>
    rank > seedCount && rank <= entrantCount ? [slot] : []
  );
  const drawnUnseeded = shuffle(unseeded, random);
  unseededSlots.forEach((slot, index) => {
    ranks[slot] = drawnUnseeded[index];
  });

  return { ranks, seedCount };
}

export function shuffleItems<T>(items: T[], random: Random = Math.random): T[] {
  return shuffle(items, random);
}

export const FFT_CASCADE_MIN_ENTRANTS = 17;
export const FFT_CASCADE_MAX_ENTRANTS = 20;

export function isFftCascadeSupported(entrantCount: number): boolean {
  return entrantCount >= FFT_CASCADE_MIN_ENTRANTS && entrantCount <= FFT_CASCADE_MAX_ENTRANTS;
}

const CHAINS = 4;

function roundLabel(stepsBeforeQuarter: number): string {
  if (stepsBeforeQuarter <= 0) return 'Quart de finale';
  return `1/${8 * 2 ** (stepsBeforeQuarter - 1)} de Finale`;
}

/**
 * Staggered-entry draw: 4 chains of matches. The weakest teams play the first round,
 * and each following round (1/16, 1/8, quarter-finals) lets 4 better seeds enter against
 * the chain winners. Every loser group then plays a small classification bracket so that
 * all teams get an exact rank from 1 to n.
 */
export function buildFftCascadeTournament(
  tournamentId: string,
  pairsBestFirst: Pair[],
  random: Random = Math.random
): { bracketMatches: Match[]; consolanteMatches: Match[]; seededCount: number } {
  const n = pairsBestFirst.length;
  const tiers = Math.ceil((n - 8) / CHAINS);
  const firstRoundTeams = n - CHAINS * tiers;
  const realFirstRound = firstRoundTeams - CHAINS;
  const timestamp = Date.now();
  let matchNumber = 1;

  const entrantsByTier: Pair[][] = [];
  for (let tier = 0; tier < tiers; tier++) {
    const group = pairsBestFirst.slice(tier * CHAINS, tier * CHAINS + CHAINS);
    if (tier === 0) {
      const middle = shuffle([group[2], group[3]], random);
      entrantsByTier.push([group[1], middle[0], middle[1], group[0]]);
    } else {
      entrantsByTier.push(shuffle(group, random));
    }
  }

  const firstRoundPairs = pairsBestFirst.slice(CHAINS * tiers);
  const byeTeams = shuffle(firstRoundPairs.slice(0, CHAINS - realFirstRound), random);
  const playingTeams = shuffle(firstRoundPairs.slice(CHAINS - realFirstRound), random);
  const matchChains = new Set(shuffle([0, 1, 2, 3], random).slice(0, realFirstRound));

  const bracket: Match[] = [];
  const consolante: Match[] = [];
  const roundMatches = new Map<number, Match[]>();
  const quarterRound = tiers + 1;
  const byId = new Map<string, Match>();

  const base = (
    id: string,
    type: Match['type'],
    roundName: string,
    round: number,
    slotIndex: number,
    range?: string
  ): Match => {
    const match: Match = {
      id,
      tournamentId,
      type,
      roundName,
      matchNumber: matchNumber++,
      bracketRound: round,
      bracketSlotIndex: slotIndex,
      status: 'scheduled',
      classificationRankRange: range,
    };
    byId.set(id, match);
    return match;
  };

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

  const feeders: (Match | Pair | undefined)[] = [];
  let byeIndex = 0;
  let playingIndex = 0;
  for (let chain = 0; chain < CHAINS; chain++) {
    if (matchChains.has(chain)) {
      const match = base(
        `m_fft_main_r1_c${chain}_${timestamp}`,
        'bracket',
        `${roundLabel(tiers)} (#${chain + 1})`,
        1,
        chain
      );
      match.pair1Id = playingTeams[playingIndex++].id;
      match.pair2Id = playingTeams[playingIndex++].id;
      match.classificationRankRange = `1-${n}`;
      bracket.push(match);
      roundMatches.set(1, [...(roundMatches.get(1) ?? []), match]);
      feeders.push(match);
    } else {
      feeders.push(byeTeams[byeIndex++]);
    }
  }

  for (let round = 2; round <= quarterRound; round++) {
    const tier = quarterRound - round;
    const label = roundLabel(round === quarterRound ? 0 : quarterRound - round);
    for (let chain = 0; chain < CHAINS; chain++) {
      const match = base(
        `m_fft_main_r${round}_c${chain}_${timestamp}`,
        'bracket',
        `${label} (#${chain + 1})`,
        round,
        chain,
        `1-${n}`
      );
      match.pair1Id = entrantsByTier[tier][chain].id;
      const feeder = feeders[chain];
      if (feeder && 'roundName' in feeder) feed(feeder, match, 'pair2', 'winner');
      else if (feeder) match.pair2Id = feeder.id;
      bracket.push(match);
      roundMatches.set(round, [...(roundMatches.get(round) ?? []), match]);
      feeders[chain] = match;
    }
  }

  const semiRound = quarterRound + 1;
  const semis = [0, 1].map(index => {
    const match = base(`m_fft_main_sf${index}_${timestamp}`, 'bracket', `Demi-finale (#${index + 1})`, semiRound, index, `1-4`);
    feed(feeders[index * 2] as Match, match, 'pair1', 'winner');
    feed(feeders[index * 2 + 1] as Match, match, 'pair2', 'winner');
    bracket.push(match);
    return match;
  });
  const final = base(`m_fft_main_f_${timestamp}`, 'bracket', 'Grande Finale', semiRound + 1, 0, '1-2');
  final.targetRankWinner = 1;
  final.targetRankLoser = 2;
  const thirdPlace = base(`m_fft_main_pf_${timestamp}`, 'bracket', 'Petite Finale (Match 3e place)', semiRound + 1, 1, '3-4');
  thirdPlace.targetRankWinner = 3;
  thirdPlace.targetRankLoser = 4;
  semis.forEach((semi, index) => {
    feed(semi, final, index === 0 ? 'pair1' : 'pair2', 'winner');
    feed(semi, thirdPlace, index === 0 ? 'pair1' : 'pair2', 'loser');
  });
  bracket.push(final, thirdPlace);

  // Classification of each loser group so that every team gets an exact rank.
  for (let round = 1; round <= quarterRound; round++) {
    const losersSources = roundMatches.get(round) ?? [];
    const start = 5 + CHAINS * (quarterRound - round);
    const count = losersSources.length;
    const rangeEnd = start + count - 1;
    const tag = `${start}e-${rangeEnd}e`;
    if (count === 0) continue;
    if (count === 1) {
      losersSources[0].targetRankLoser = start;
      continue;
    }
    if (count === 2) {
      const match = base(`m_fft_c${start}_${timestamp}`, 'consolante', `Match pour la ${start}e place`, 1, 0, `${start}-${rangeEnd}`);
      match.targetRankWinner = start;
      match.targetRankLoser = start + 1;
      feed(losersSources[0], match, 'pair1', 'loser');
      feed(losersSources[1], match, 'pair2', 'loser');
      consolante.push(match);
      continue;
    }
    const semiMatches = Array.from({ length: Math.floor(count / 2) }, (_, index) => {
      const match = base(`m_fft_c${start}_sf${index}_${timestamp}`, 'consolante', `Demi-finale ${tag} (#${index + 1})`, 1, index, `${start}-${rangeEnd}`);
      feed(losersSources[index * 2], match, 'pair1', 'loser');
      feed(losersSources[index * 2 + 1], match, 'pair2', 'loser');
      consolante.push(match);
      return match;
    });
    const rankFinal = base(`m_fft_c${start}_f_${timestamp}`, 'consolante', `Match pour la ${start}e place`, 2, 0, `${start}-${start + 1}`);
    rankFinal.targetRankWinner = start;
    rankFinal.targetRankLoser = start + 1;
    feed(semiMatches[0], rankFinal, 'pair1', 'winner');
    if (semiMatches[1]) {
      feed(semiMatches[1], rankFinal, 'pair2', 'winner');
      const rankThird = base(`m_fft_c${start}_pf_${timestamp}`, 'consolante', `Match pour la ${start + 2}e place`, 2, 1, `${start + 2}-${start + 3}`);
      rankThird.targetRankWinner = start + 2;
      rankThird.targetRankLoser = start + 3;
      feed(semiMatches[0], rankThird, 'pair1', 'loser');
      feed(semiMatches[1], rankThird, 'pair2', 'loser');
      consolante.push(rankFinal, rankThird);
    } else {
      // 3 losers: the odd one waits for the winner of the only semi-final
      semiMatches[0].targetRankLoser = start + 2;
      feed(losersSources[2], rankFinal, 'pair2', 'loser');
      consolante.push(rankFinal);
    }
  }

  return { bracketMatches: bracket, consolanteMatches: consolante, seededCount: CHAINS * tiers };
}

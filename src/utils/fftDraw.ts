type Random = () => number;

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

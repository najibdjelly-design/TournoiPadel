import type { Match, Pool } from '../types/tournament';

const QUALIFIER_PLACEHOLDER = /^\s*(\d+)\s*(?:er|re|e|ème|eme|nd|nde)\s+(.+?)\s*$/i;

export function parseQualifierPlaceholder(placeholder?: string): { rank: number; poolName: string } | null {
  const found = placeholder ? QUALIFIER_PLACEHOLDER.exec(placeholder) : null;
  return found ? { rank: Number(found[1]), poolName: found[2] } : null;
}

export function isPoolComplete(pool: Pool): boolean {
  return (
    pool.matches.length > 0 &&
    pool.matches.every(match => match.status === 'completed' || match.status === 'walkover')
  );
}

/**
 * Fills bracket slots labelled "1er Poule A", "2e Poule B"... with the matching pool standing.
 * Only finished pools are used, and only empty slots are filled.
 */
export function resolvePoolQualifiers(
  bracketMatches: Match[],
  pools: Pool[]
): { matches: Match[]; filled: number; pendingPools: string[] } {
  const byName = new Map(pools.map(pool => [pool.name, pool]));
  const pending = new Set<string>();
  let filled = 0;

  const pick = (placeholder?: string): string | undefined => {
    const parsed = parseQualifierPlaceholder(placeholder);
    if (!parsed) return undefined;
    const pool = byName.get(parsed.poolName);
    if (!pool) return undefined;
    if (!isPoolComplete(pool)) {
      pending.add(pool.name);
      return undefined;
    }
    return pool.standings[parsed.rank - 1]?.pairId;
  };

  const matches = bracketMatches.map(match => {
    const next = { ...match };
    if (!next.pair1Id) {
      const id = pick(next.pair1Placeholder);
      if (id) {
        next.pair1Id = id;
        filled++;
      }
    }
    if (!next.pair2Id) {
      const id = pick(next.pair2Placeholder);
      if (id) {
        next.pair2Id = id;
        filled++;
      }
    }
    return next;
  });

  return { matches, filled, pendingPools: [...pending] };
}

/** Matches where two qualifiers of the same pool would meet right away (FFT: to be avoided). */
export function findSamePoolClashes(bracketMatches: Match[]): Match[] {
  return bracketMatches.filter(match => {
    const first = parseQualifierPlaceholder(match.pair1Placeholder);
    const second = parseQualifierPlaceholder(match.pair2Placeholder);
    return Boolean(first && second && first.poolName === second.poolName);
  });
}

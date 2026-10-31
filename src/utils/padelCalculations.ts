import { Match, MatchScore, Pair, Pool, PoolStanding, Tournament, FinalStandingItem } from '../types/tournament';

/**
 * Calculates total weight for a pair (Rank 1 + Rank 2).
 * In Padel, lower total weight corresponds to higher seed priority.
 */
export function calculatePairWeight(pair: Pair): number {
  const r1 = pair.player1?.ranking || 99999;
  const r2 = pair.player2?.ranking || 99999;
  return r1 + r2;
}

/**
 * Sorts pairs by total weight ascending and assigns seed numbers to top pairs.
 */
export function rankAndSeedPairs(pairs: Pair[], seedCount: number = 8): Pair[] {
  const sorted = [...pairs].sort((a, b) => a.totalWeight - b.totalWeight);
  return sorted.map((p, idx) => ({
    ...p,
    seedRank: idx < seedCount ? idx + 1 : undefined,
  }));
}

/**
 * Formats a MatchScore into a clean human readable string (e.g., "6-4 3-6 10-8")
 */
export function formatScore(score?: MatchScore): string {
  if (!score || !score.sets || score.sets.length === 0) return 'Non joué';
  if (score.isWalkover) return 'Victoire par WO';
  return score.sets
    .map(s => {
      let str = `${s.pair1}-${s.pair2}`;
      if (s.tieBreak) str += `(${s.tieBreak})`;
      return str;
    })
    .join(' ');
}

/**
 * Recomputes standings for a single pool based on completed matches
 */
export function computePoolStandings(pool: Pool, pairsMap: Map<string, Pair>): PoolStanding[] {
  const stats = new Map<string, PoolStanding>();

  // Initialize
  for (const pairId of pool.pairIds) {
    stats.set(pairId, {
      pairId,
      played: 0,
      won: 0,
      lost: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      points: 0,
      rank: 1,
    });
  }

  for (const match of pool.matches) {
    if (match.status !== 'completed' || !match.score || !match.pair1Id || !match.pair2Id) {
      continue;
    }

    const p1Stats = stats.get(match.pair1Id);
    const p2Stats = stats.get(match.pair2Id);
    if (!p1Stats || !p2Stats) continue;

    p1Stats.played += 1;
    p2Stats.played += 1;

    let p1Sets = 0;
    let p2Sets = 0;
    let p1Games = 0;
    let p2Games = 0;

    for (const set of match.score.sets) {
      p1Games += set.pair1;
      p2Games += set.pair2;
      if (set.pair1 > set.pair2) p1Sets += 1;
      else if (set.pair2 > set.pair1) p2Sets += 1;
    }

    p1Stats.setsWon += p1Sets;
    p1Stats.setsLost += p2Sets;
    p2Stats.setsWon += p2Sets;
    p2Stats.setsLost += p1Sets;

    p1Stats.gamesWon += p1Games;
    p1Stats.gamesLost += p2Games;
    p2Stats.gamesWon += p2Games;
    p2Stats.gamesLost += p1Games;

    if (match.winnerPairId === match.pair1Id) {
      p1Stats.won += 1;
      p1Stats.points += 2; // FFT Padel rule: 2 pts win
      p2Stats.lost += 1;
      p2Stats.points += match.score.isWalkover ? 0 : 1; // 1 pt loss, 0 if WO
    } else if (match.winnerPairId === match.pair2Id) {
      p2Stats.won += 1;
      p2Stats.points += 2;
      p1Stats.lost += 1;
      p1Stats.points += match.score.isWalkover ? 0 : 1;
    }
  }

  // Calculate differentials
  for (const item of stats.values()) {
    item.setDiff = item.setsWon - item.setsLost;
    item.gameDiff = item.gamesWon - item.gamesLost;
  }

  // Sort by points, then ties are broken on the matches between the tied pairs (FFT head-to-head),
  // then global set diff -> game diff -> weight
  const byPoints = Array.from(stats.values()).sort((a, b) => b.points - a.points);
  const list: PoolStanding[] = [];
  for (let start = 0; start < byPoints.length; ) {
    let end = start + 1;
    while (end < byPoints.length && byPoints[end].points === byPoints[start].points) end++;
    const group = byPoints.slice(start, end);
    if (group.length > 1) {
      const ids = new Set(group.map(item => item.pairId));
      const mini = new Map(group.map(item => [item.pairId, { wins: 0, sets: 0, games: 0 }]));
      for (const match of pool.matches) {
        if (match.status !== 'completed' || !match.score || !match.pair1Id || !match.pair2Id) continue;
        if (!ids.has(match.pair1Id) || !ids.has(match.pair2Id)) continue;
        const m1 = mini.get(match.pair1Id)!;
        const m2 = mini.get(match.pair2Id)!;
        for (const set of match.score.sets) {
          m1.games += set.pair1 - set.pair2;
          m2.games += set.pair2 - set.pair1;
          if (set.pair1 > set.pair2) { m1.sets += 1; m2.sets -= 1; }
          else if (set.pair2 > set.pair1) { m2.sets += 1; m1.sets -= 1; }
        }
        if (match.winnerPairId === match.pair1Id) m1.wins += 1;
        else if (match.winnerPairId === match.pair2Id) m2.wins += 1;
      }
      group.sort((a, b) => {
        const ma = mini.get(a.pairId)!;
        const mb = mini.get(b.pairId)!;
        if (mb.wins !== ma.wins) return mb.wins - ma.wins;
        if (mb.sets !== ma.sets) return mb.sets - ma.sets;
        if (mb.games !== ma.games) return mb.games - ma.games;
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        const weightA = pairsMap.get(a.pairId)?.totalWeight ?? 99999;
        const weightB = pairsMap.get(b.pairId)?.totalWeight ?? 99999;
        return weightA - weightB;
      });
    }
    list.push(...group);
    start = end;
  }

  // Assign ranks
  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

/**
 * Generate standard round-robin matches for pool pairs
 */
export function generatePoolMatches(
  tournamentId: string,
  poolId: string,
  poolName: string,
  pairIds: string[],
  startMatchNum: number = 1
): Match[] {
  const matches: Match[] = [];
  let mIndex = 1;

  for (let i = 0; i < pairIds.length; i++) {
    for (let j = i + 1; j < pairIds.length; j++) {
      matches.push({
        id: `match_${poolId}_${i}_${j}_${Date.now()}_${mIndex}`,
        tournamentId,
        type: 'pool',
        poolId,
        roundName: `${poolName} - Match ${mIndex}`,
        matchNumber: startMatchNum + mIndex - 1,
        pair1Id: pairIds[i],
        pair2Id: pairIds[j],
        status: 'scheduled',
      });
      mIndex++;
    }
  }

  return matches;
}

/**
 * Distribute pairs using Serpentine algorithm (1, 2, 3, 4, 4, 3, 2, 1...)
 */
export function distributePairsBySerpentine(pairIds: string[], poolsCount: number): string[][] {
  const pools: string[][] = Array.from({ length: poolsCount }, () => []);
  let currentIdx = 0;
  let direction = 1;

  for (let i = 0; i < pairIds.length; i++) {
    pools[currentIdx].push(pairIds[i]);
    currentIdx += direction;
    if (currentIdx >= poolsCount) {
      currentIdx = poolsCount - 1;
      direction = -1;
    } else if (currentIdx < 0) {
      currentIdx = 0;
      direction = 1;
    }
  }
  return pools;
}

/**
 * Distribute pairs by Rank Tiers (Chapeau 1, Chapeau 2, Chapeau 3...)
 * E.g., for 6 pools, pairs 0-5 in row 1, 6-11 in row 2, etc.
 */
export function distributePairsByRankTier(pairIds: string[], poolsCount: number): string[][] {
  const pools: string[][] = Array.from({ length: poolsCount }, () => []);
  for (let i = 0; i < pairIds.length; i++) {
    const poolIdx = i % poolsCount;
    pools[poolIdx].push(pairIds[i]);
  }
  return pools;
}

/**
 * Generate a single-elimination knockout bracket with winner progression wiring.
 * Supports size 4, 8, 16, 24, 32.
 * Specially designed for 24 teams: 8 round 1 matches (16 teams) + 8 top seeds with Byes directly into 1/8th finals.
 */
export function generateKnockoutBracket(
  tournamentId: string,
  size: 4 | 8 | 16 | 24 | 32,
  type: 'bracket' | 'consolante' = 'bracket'
): Match[] {
  const matches: Match[] = [];
  const prefix = type === 'bracket' ? 'tab' : 'cons';

  // Specialized 24 teams knockout tree (FFT tournament standard)
  if (size === 24) {
    const timestamp = Date.now();
    let mCounter = 1;

    // Tour 1: 1/16 de finale (8 matches, 16 pairs)
    const r1Matches: Match[] = [];
    for (let s = 0; s < 8; s++) {
      r1Matches.push({
        id: `match_${prefix}_r0_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type,
        roundName: `1/16 de Finale (#${s + 1})`,
        matchNumber: r1Matches.length + 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Qualifié / Rang ${s * 2 + 9}`,
        pair2Placeholder: `Qualifié / Rang ${s * 2 + 10}`,
        nextMatchSlot: 'pair2',
      });
    }

    // Tour 2: 1/8 de finale (8 matches: TS 1-8 receive Bye and meet winners of R1)
    const r2Matches: Match[] = [];
    for (let s = 0; s < 8; s++) {
      r2Matches.push({
        id: `match_${prefix}_r1_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type,
        roundName: `1/8 de Finale (#${s + 1})`,
        matchNumber: r1Matches.length + r2Matches.length + 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Tête de Série ${s + 1} (Exempt)`,
        pair2Placeholder: `Vainqueur 1/16e M#${s + 1}`,
      });
    }

    // Wire R1 -> R2
    for (let s = 0; s < 8; s++) {
      r1Matches[s].nextMatchId = r2Matches[s].id;
      r1Matches[s].nextMatchSlot = 'pair2';
    }

    // Tour 3: Quarts de finale (4 matches)
    const r3Matches: Match[] = [];
    for (let s = 0; s < 4; s++) {
      r3Matches.push({
        id: `match_${prefix}_r2_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type,
        roundName: `Quart de finale (#${s + 1})`,
        matchNumber: r1Matches.length + r2Matches.length + r3Matches.length + 1,
        bracketRound: 3,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur 1/8e M#${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur 1/8e M#${s * 2 + 2}`,
      });
    }

    // Wire R2 -> R3
    for (let s = 0; s < 8; s++) {
      r2Matches[s].nextMatchId = r3Matches[Math.floor(s / 2)].id;
      r2Matches[s].nextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
    }

    // Tour 4: Demi-finales (2 matches)
    const r4Matches: Match[] = [];
    for (let s = 0; s < 2; s++) {
      r4Matches.push({
        id: `match_${prefix}_r3_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type,
        roundName: `Demi-finale (#${s + 1})`,
        matchNumber: r1Matches.length + r2Matches.length + r3Matches.length + r4Matches.length + 1,
        bracketRound: 4,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur QF #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur QF #${s * 2 + 2}`,
      });
    }

    // Wire R3 -> R4
    for (let s = 0; s < 4; s++) {
      r3Matches[s].nextMatchId = r4Matches[Math.floor(s / 2)].id;
      r3Matches[s].nextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
    }

    // Tour 5: Finale (1 match)
    const r5Matches: Match[] = [
      {
        id: `match_${prefix}_r4_s0_${timestamp}_${mCounter++}`,
        tournamentId,
        type,
        roundName: type === 'bracket' ? 'Grande Finale' : 'Finale Consolante',
        matchNumber: r1Matches.length + r2Matches.length + r3Matches.length + r4Matches.length + 1,
        bracketRound: 5,
        bracketSlotIndex: 0,
        status: 'scheduled',
        pair1Placeholder: 'Vainqueur 1/2 Finale 1',
        pair2Placeholder: 'Vainqueur 1/2 Finale 2',
      },
    ];

    // Wire R4 -> R5
    r4Matches[0].nextMatchId = r5Matches[0].id;
    r4Matches[0].nextMatchSlot = 'pair1';
    r4Matches[1].nextMatchId = r5Matches[0].id;
    r4Matches[1].nextMatchSlot = 'pair2';

    return [...r1Matches, ...r2Matches, ...r3Matches, ...r4Matches, ...r5Matches];
  }

  // Standard power-of-2 knockout trees (4, 8, 16, 32)
  const getRoundLabel = (roundSize: number): string => {
    if (roundSize === 32) return '1/16 Finale';
    if (roundSize === 16) return '1/8 Finale';
    if (roundSize === 8) return 'Quart de finale';
    if (roundSize === 4) return 'Demi-finale';
    return type === 'bracket' ? 'Grande Finale' : 'Finale Consolante';
  };

  const roundsCount = Math.log2(size);
  let matchCounter = 1;

  // Store match IDs by [roundIndex][slotIndex]
  const idMatrix: string[][] = [];

  for (let r = 0; r < roundsCount; r++) {
    const roundSlots = size / Math.pow(2, r + 1);
    idMatrix[r] = [];
    for (let s = 0; s < roundSlots; s++) {
      idMatrix[r][s] = `match_${prefix}_r${r}_s${s}_${Date.now()}_${matchCounter++}`;
    }
  }

  // Create matches and wire nextMatchId
  for (let r = 0; r < roundsCount; r++) {
    const roundSlots = size / Math.pow(2, r + 1);
    const roundLabel = getRoundLabel(roundSlots * 2);

    for (let s = 0; s < roundSlots; s++) {
      const matchId = idMatrix[r][s];
      const hasNext = r < roundsCount - 1;
      const nextMatchId = hasNext ? idMatrix[r + 1][Math.floor(s / 2)] : undefined;
      const nextMatchSlot = hasNext ? (s % 2 === 0 ? 'pair1' : 'pair2') : undefined;

      matches.push({
        id: matchId,
        tournamentId,
        type,
        roundName: `${roundLabel} ${roundSlots > 1 ? `(#${s + 1})` : ''}`,
        matchNumber: matches.length + 1,
        bracketRound: r + 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: r === 0 ? `Tête de série ${s * 2 + 1}` : `Vainqueur R${r} M${s * 2 + 1}`,
        pair2Placeholder: r === 0 ? `Tête de série ${s * 2 + 2}` : `Vainqueur R${r} M${s * 2 + 2}`,
        nextMatchId,
        nextMatchSlot,
      });
    }
  }

  return matches;
}

/**
 * Generates a full tournament draw with main championship bracket AND complete automatic
 * classification brackets for all losing pairs, giving every team an exact rank from 1 to N.
 * (e.g. 1 to 24 for 24 teams, 1 to 16 for 16 teams, 1 to 8 for 8 teams, 1 to 4 for 4 teams).
 */
export function generateFullClassificationTournament(
  tournamentId: string,
  size: 4 | 8 | 16 | 24 | 32 = 24,
  entrantCount: number = size
): { bracketMatches: Match[]; consolanteMatches: Match[] } {
  const timestamp = Date.now();
  let mCounter = 1;

  // -------------------------------------------------------------
  // CASE 1: 24 TEAMS (FFT standard for P500/P250 tournaments)
  // -------------------------------------------------------------
  if (size === 24) {
    // 1. Tour 1: 1/16e de finale (8 matches, 16 pairs)
    const r1Main: Match[] = [];
    for (let s = 0; s < 8; s++) {
      r1Main.push({
        id: `m_main_r1_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `1/16 de Finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Qualifié / Rang ${s * 2 + 9}`,
        pair2Placeholder: `Qualifié / Rang ${s * 2 + 10}`,
        classificationRankRange: '1-24',
      });
    }

    // 2. Consolante Places 17 à 24 (12 matches total)
    // 2a. Quarts 17-24 (4 matches)
    const c1724Quarts: Match[] = [];
    for (let s = 0; s < 4; s++) {
      c1724Quarts.push({
        id: `m_c1724_qf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Quart 17e-24e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant 1/16e #${s * 2 + 1}`,
        pair2Placeholder: `Perdant 1/16e #${s * 2 + 2}`,
        classificationRankRange: '17-24',
      });
    }

    // Wire R1 losers -> Quarts 17-24
    for (let s = 0; s < 4; s++) {
      r1Main[s * 2].loserNextMatchId = c1724Quarts[s].id;
      r1Main[s * 2].loserNextMatchSlot = 'pair1';
      r1Main[s * 2 + 1].loserNextMatchId = c1724Quarts[s].id;
      r1Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    // 2b. Demis 17-20 (2 matches, winners of Quarts 17-24)
    const c1720Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c1720Demis.push({
        id: `m_c1720_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 17e-20e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart 17-24 #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart 17-24 #${s * 2 + 2}`,
        classificationRankRange: '17-20',
      });
    }

    // 2c. Demis 21-24 (2 matches, losers of Quarts 17-24)
    const c2124Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c2124Demis.push({
        id: `m_c2124_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 21e-24e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s + 2,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart 17-24 #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart 17-24 #${s * 2 + 2}`,
        classificationRankRange: '21-24',
      });
    }

    // Wire Quarts 17-24 to Demis 17-20 and 21-24
    for (let s = 0; s < 4; s++) {
      c1724Quarts[s].nextMatchId = c1720Demis[Math.floor(s / 2)].id;
      c1724Quarts[s].nextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
      c1724Quarts[s].loserNextMatchId = c2124Demis[Math.floor(s / 2)].id;
      c1724Quarts[s].loserNextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
    }

    // 2d. Finales de classement 17 à 24 (4 matches)
    const match17e: Match = {
      id: `m_c1718_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 17e place (17e vs 18e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 17-20 #1',
      pair2Placeholder: 'Vainqueur Demi 17-20 #2',
      classificationRankRange: '17-18',
      targetRankWinner: 17,
      targetRankLoser: 18,
    };

    const match19e: Match = {
      id: `m_c1920_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 19e place (19e vs 20e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 17-20 #1',
      pair2Placeholder: 'Perdant Demi 17-20 #2',
      classificationRankRange: '19-20',
      targetRankWinner: 19,
      targetRankLoser: 20,
    };

    const match21e: Match = {
      id: `m_c2122_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 21e place (21e vs 22e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 2,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 21-24 #1',
      pair2Placeholder: 'Vainqueur Demi 21-24 #2',
      classificationRankRange: '21-22',
      targetRankWinner: 21,
      targetRankLoser: 22,
    };

    const match23e: Match = {
      id: `m_c2324_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 23e place (23e vs 24e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 3,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 21-24 #1',
      pair2Placeholder: 'Perdant Demi 21-24 #2',
      classificationRankRange: '23-24',
      targetRankWinner: 23,
      targetRankLoser: 24,
    };

    // Wire Demis 17-20 & 21-24 to finals
    c1720Demis[0].nextMatchId = match17e.id;
    c1720Demis[0].nextMatchSlot = 'pair1';
    c1720Demis[0].loserNextMatchId = match19e.id;
    c1720Demis[0].loserNextMatchSlot = 'pair1';

    c1720Demis[1].nextMatchId = match17e.id;
    c1720Demis[1].nextMatchSlot = 'pair2';
    c1720Demis[1].loserNextMatchId = match19e.id;
    c1720Demis[1].loserNextMatchSlot = 'pair2';

    c2124Demis[0].nextMatchId = match21e.id;
    c2124Demis[0].nextMatchSlot = 'pair1';
    c2124Demis[0].loserNextMatchId = match23e.id;
    c2124Demis[0].loserNextMatchSlot = 'pair1';

    c2124Demis[1].nextMatchId = match21e.id;
    c2124Demis[1].nextMatchSlot = 'pair2';
    c2124Demis[1].loserNextMatchId = match23e.id;
    c2124Demis[1].loserNextMatchSlot = 'pair2';

    // 3. Tour 2: 1/8 de finale (8 matches: Seeds 1-8 Exempts vs Vainqueurs 1/16e)
    const r2Main: Match[] = [];
    for (let s = 0; s < 8; s++) {
      r2Main.push({
        id: `m_main_r2_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `1/8 de Finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Tête de Série ${s + 1} (Exempt)`,
        pair2Placeholder: `Vainqueur 1/16e #${s + 1}`,
        classificationRankRange: '1-16',
      });
      // Wire R1 winners into R2 slot 2
      r1Main[s].nextMatchId = r2Main[s].id;
      r1Main[s].nextMatchSlot = 'pair2';
    }

    // 4. Consolante Places 9 à 16 (12 matches total)
    // 4a. Quarts 9-16 (4 matches)
    const c916Quarts: Match[] = [];
    for (let s = 0; s < 4; s++) {
      c916Quarts.push({
        id: `m_c916_qf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Quart 9e-16e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant 1/8e #${s * 2 + 1}`,
        pair2Placeholder: `Perdant 1/8e #${s * 2 + 2}`,
        classificationRankRange: '9-16',
      });
    }

    // Wire R2 losers -> Quarts 9-16
    for (let s = 0; s < 4; s++) {
      r2Main[s * 2].loserNextMatchId = c916Quarts[s].id;
      r2Main[s * 2].loserNextMatchSlot = 'pair1';
      r2Main[s * 2 + 1].loserNextMatchId = c916Quarts[s].id;
      r2Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    // 4b. Demis 9-12 (2 matches)
    const c912Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c912Demis.push({
        id: `m_c912_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 9e-12e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart 9-16 #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart 9-16 #${s * 2 + 2}`,
        classificationRankRange: '9-12',
      });
    }

    // 4c. Demis 13-16 (2 matches)
    const c1316Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c1316Demis.push({
        id: `m_c1316_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 13e-16e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s + 2,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart 9-16 #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart 9-16 #${s * 2 + 2}`,
        classificationRankRange: '13-16',
      });
    }

    // Wire Quarts 9-16 to Demis 9-12 and 13-16
    for (let s = 0; s < 4; s++) {
      c916Quarts[s].nextMatchId = c912Demis[Math.floor(s / 2)].id;
      c916Quarts[s].nextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
      c916Quarts[s].loserNextMatchId = c1316Demis[Math.floor(s / 2)].id;
      c916Quarts[s].loserNextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
    }

    // 4d. Finales de classement 9 à 16 (4 matches)
    const match9e: Match = {
      id: `m_c910_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 9e place (9e vs 10e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 9-12 #1',
      pair2Placeholder: 'Vainqueur Demi 9-12 #2',
      classificationRankRange: '9-10',
      targetRankWinner: 9,
      targetRankLoser: 10,
    };

    const match11e: Match = {
      id: `m_c1112_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 11e place (11e vs 12e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 9-12 #1',
      pair2Placeholder: 'Perdant Demi 9-12 #2',
      classificationRankRange: '11-12',
      targetRankWinner: 11,
      targetRankLoser: 12,
    };

    const match13e: Match = {
      id: `m_c1314_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 13e place (13e vs 14e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 2,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 13-16 #1',
      pair2Placeholder: 'Vainqueur Demi 13-16 #2',
      classificationRankRange: '13-14',
      targetRankWinner: 13,
      targetRankLoser: 14,
    };

    const match15e: Match = {
      id: `m_c1516_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 15e place (15e vs 16e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 3,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 13-16 #1',
      pair2Placeholder: 'Perdant Demi 13-16 #2',
      classificationRankRange: '15-16',
      targetRankWinner: 15,
      targetRankLoser: 16,
    };

    // Wire Demis 9-12 & 13-16 to finals
    c912Demis[0].nextMatchId = match9e.id;
    c912Demis[0].nextMatchSlot = 'pair1';
    c912Demis[0].loserNextMatchId = match11e.id;
    c912Demis[0].loserNextMatchSlot = 'pair1';

    c912Demis[1].nextMatchId = match9e.id;
    c912Demis[1].nextMatchSlot = 'pair2';
    c912Demis[1].loserNextMatchId = match11e.id;
    c912Demis[1].loserNextMatchSlot = 'pair2';

    c1316Demis[0].nextMatchId = match13e.id;
    c1316Demis[0].nextMatchSlot = 'pair1';
    c1316Demis[0].loserNextMatchId = match15e.id;
    c1316Demis[0].loserNextMatchSlot = 'pair1';

    c1316Demis[1].nextMatchId = match13e.id;
    c1316Demis[1].nextMatchSlot = 'pair2';
    c1316Demis[1].loserNextMatchId = match15e.id;
    c1316Demis[1].loserNextMatchSlot = 'pair2';

    // 5. Tour 3: Quarts de finale Main (4 matches)
    const r3Main: Match[] = [];
    for (let s = 0; s < 4; s++) {
      r3Main.push({
        id: `m_main_r3_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Quart de finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 3,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur 1/8e #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur 1/8e #${s * 2 + 2}`,
        classificationRankRange: '1-8',
      });
      // Wire R2 winners into R3
      r2Main[s * 2].nextMatchId = r3Main[s].id;
      r2Main[s * 2].nextMatchSlot = 'pair1';
      r2Main[s * 2 + 1].nextMatchId = r3Main[s].id;
      r2Main[s * 2 + 1].nextMatchSlot = 'pair2';
    }

    // 6. Consolante Places 5 à 8 (4 matches total)
    // 6a. Demis 5-8 (2 matches, losers of Quarts)
    const c58Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c58Demis.push({
        id: `m_c58_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 5e-8e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart #${s * 2 + 2}`,
        classificationRankRange: '5-8',
      });
      // Wire R3 losers into Demis 5-8
      r3Main[s * 2].loserNextMatchId = c58Demis[s].id;
      r3Main[s * 2].loserNextMatchSlot = 'pair1';
      r3Main[s * 2 + 1].loserNextMatchId = c58Demis[s].id;
      r3Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    // 6b. Finales de classement 5 à 8 (2 matches)
    const match5e: Match = {
      id: `m_c56_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 5e place (5e vs 6e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 5-8 #1',
      pair2Placeholder: 'Vainqueur Demi 5-8 #2',
      classificationRankRange: '5-6',
      targetRankWinner: 5,
      targetRankLoser: 6,
    };

    const match7e: Match = {
      id: `m_c78_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 7e place (7e vs 8e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 5-8 #1',
      pair2Placeholder: 'Perdant Demi 5-8 #2',
      classificationRankRange: '7-8',
      targetRankWinner: 7,
      targetRankLoser: 8,
    };

    // Wire Demis 5-8 to match 5e & 7e
    c58Demis[0].nextMatchId = match5e.id;
    c58Demis[0].nextMatchSlot = 'pair1';
    c58Demis[0].loserNextMatchId = match7e.id;
    c58Demis[0].loserNextMatchSlot = 'pair1';

    c58Demis[1].nextMatchId = match5e.id;
    c58Demis[1].nextMatchSlot = 'pair2';
    c58Demis[1].loserNextMatchId = match7e.id;
    c58Demis[1].loserNextMatchSlot = 'pair2';

    // 7. Tour 4: Demi-finales Main (2 matches)
    const r4Main: Match[] = [];
    for (let s = 0; s < 2; s++) {
      r4Main.push({
        id: `m_main_r4_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Demi-finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 4,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart #${s * 2 + 2}`,
        classificationRankRange: '1-4',
      });
      // Wire R3 winners to R4
      r3Main[s * 2].nextMatchId = r4Main[s].id;
      r3Main[s * 2].nextMatchSlot = 'pair1';
      r3Main[s * 2 + 1].nextMatchId = r4Main[s].id;
      r3Main[s * 2 + 1].nextMatchSlot = 'pair2';
    }

    // 8. Tour 5: Grande Finale (1-2) et Petite Finale (3-4)
    const grandeFinale: Match = {
      id: `m_main_r5_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Grande Finale (Championnat)',
      matchNumber: mCounter - 1,
      bracketRound: 5,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi-finale #1',
      pair2Placeholder: 'Vainqueur Demi-finale #2',
      classificationRankRange: '1-2',
      targetRankWinner: 1,
      targetRankLoser: 2,
    };

    const petiteFinale: Match = {
      id: `m_main_r5_pf_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Petite Finale (Match 3e place)',
      matchNumber: mCounter - 1,
      bracketRound: 5,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi-finale #1',
      pair2Placeholder: 'Perdant Demi-finale #2',
      classificationRankRange: '3-4',
      targetRankWinner: 3,
      targetRankLoser: 4,
    };

    // Wire Demis to Grande Finale & Petite Finale
    r4Main[0].nextMatchId = grandeFinale.id;
    r4Main[0].nextMatchSlot = 'pair1';
    r4Main[0].loserNextMatchId = petiteFinale.id;
    r4Main[0].loserNextMatchSlot = 'pair1';

    r4Main[1].nextMatchId = grandeFinale.id;
    r4Main[1].nextMatchSlot = 'pair2';
    r4Main[1].loserNextMatchId = petiteFinale.id;
    r4Main[1].loserNextMatchSlot = 'pair2';

    const bracketMatches = [
      ...r1Main,
      ...r2Main,
      ...r3Main,
      ...r4Main,
      grandeFinale,
      petiteFinale,
    ];

    let consolanteMatches = [
      // Places 5 à 8
      ...c58Demis,
      match5e,
      match7e,
      // Places 9 à 16
      ...c916Quarts,
      ...c912Demis,
      ...c1316Demis,
      match9e,
      match11e,
      match13e,
      match15e,
      // Places 17 à 24
      ...c1724Quarts,
      ...c1720Demis,
      ...c2124Demis,
      match17e,
      match19e,
      match21e,
      match23e,
    ];

    if (entrantCount <= 16) {
      consolanteMatches = consolanteMatches.filter(
        match => {
          const upperRank = Number((match.classificationRankRange ?? '').split('-')[1]);
          return Number.isFinite(upperRank) && upperRank <= 16;
        }
      );
      r1Main.forEach(match => {
        match.loserNextMatchId = undefined;
        match.loserNextMatchSlot = undefined;
      });
      r2Main.forEach(match => {
        match.loserNextMatchId = undefined;
        match.loserNextMatchSlot = undefined;
      });
      for (let slot = 0; slot < 4; slot++) {
        r1Main[slot].loserNextMatchId = c916Quarts[slot].id;
        r1Main[slot].loserNextMatchSlot = 'pair1';
        r2Main[slot].loserNextMatchId = c916Quarts[slot].id;
        r2Main[slot].loserNextMatchSlot = 'pair2';
      }
    }

    return { bracketMatches, consolanteMatches };
  }

  // -------------------------------------------------------------
  // CASE 2: 16 TEAMS
  // -------------------------------------------------------------
  if (size === 16) {
    // 1. Tour 1: 1/8 de finale (8 matches)
    const r1Main: Match[] = [];
    for (let s = 0; s < 8; s++) {
      r1Main.push({
        id: `m_main_r1_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `1/8 de Finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Tête de série ${s * 2 + 1}`,
        pair2Placeholder: `Tête de série ${s * 2 + 2}`,
        classificationRankRange: '1-16',
      });
    }

    // 2. Consolante Places 9 à 16 (12 matches total)
    const c916Quarts: Match[] = [];
    for (let s = 0; s < 4; s++) {
      c916Quarts.push({
        id: `m_c916_qf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Quart 9e-16e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant 1/8e #${s * 2 + 1}`,
        pair2Placeholder: `Perdant 1/8e #${s * 2 + 2}`,
        classificationRankRange: '9-16',
      });
      // Wire R1 losers into Quarts 9-16
      r1Main[s * 2].loserNextMatchId = c916Quarts[s].id;
      r1Main[s * 2].loserNextMatchSlot = 'pair1';
      r1Main[s * 2 + 1].loserNextMatchId = c916Quarts[s].id;
      r1Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    const c912Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c912Demis.push({
        id: `m_c912_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 9e-12e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart 9-16 #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart 9-16 #${s * 2 + 2}`,
        classificationRankRange: '9-12',
      });
    }

    const c1316Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c1316Demis.push({
        id: `m_c1316_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 13e-16e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s + 2,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart 9-16 #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart 9-16 #${s * 2 + 2}`,
        classificationRankRange: '13-16',
      });
    }

    for (let s = 0; s < 4; s++) {
      c916Quarts[s].nextMatchId = c912Demis[Math.floor(s / 2)].id;
      c916Quarts[s].nextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
      c916Quarts[s].loserNextMatchId = c1316Demis[Math.floor(s / 2)].id;
      c916Quarts[s].loserNextMatchSlot = s % 2 === 0 ? 'pair1' : 'pair2';
    }

    const match9e: Match = {
      id: `m_c910_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 9e place (9e vs 10e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 9-12 #1',
      pair2Placeholder: 'Vainqueur Demi 9-12 #2',
      classificationRankRange: '9-10',
      targetRankWinner: 9,
      targetRankLoser: 10,
    };

    const match11e: Match = {
      id: `m_c1112_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 11e place (11e vs 12e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 9-12 #1',
      pair2Placeholder: 'Perdant Demi 9-12 #2',
      classificationRankRange: '11-12',
      targetRankWinner: 11,
      targetRankLoser: 12,
    };

    const match13e: Match = {
      id: `m_c1314_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 13e place (13e vs 14e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 2,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 13-16 #1',
      pair2Placeholder: 'Vainqueur Demi 13-16 #2',
      classificationRankRange: '13-14',
      targetRankWinner: 13,
      targetRankLoser: 14,
    };

    const match15e: Match = {
      id: `m_c1516_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 15e place (15e vs 16e)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 3,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 13-16 #1',
      pair2Placeholder: 'Perdant Demi 13-16 #2',
      classificationRankRange: '15-16',
      targetRankWinner: 15,
      targetRankLoser: 16,
    };

    c912Demis[0].nextMatchId = match9e.id;
    c912Demis[0].nextMatchSlot = 'pair1';
    c912Demis[0].loserNextMatchId = match11e.id;
    c912Demis[0].loserNextMatchSlot = 'pair1';

    c912Demis[1].nextMatchId = match9e.id;
    c912Demis[1].nextMatchSlot = 'pair2';
    c912Demis[1].loserNextMatchId = match11e.id;
    c912Demis[1].loserNextMatchSlot = 'pair2';

    c1316Demis[0].nextMatchId = match13e.id;
    c1316Demis[0].nextMatchSlot = 'pair1';
    c1316Demis[0].loserNextMatchId = match15e.id;
    c1316Demis[0].loserNextMatchSlot = 'pair1';

    c1316Demis[1].nextMatchId = match13e.id;
    c1316Demis[1].nextMatchSlot = 'pair2';
    c1316Demis[1].loserNextMatchId = match15e.id;
    c1316Demis[1].loserNextMatchSlot = 'pair2';

    // 3. Tour 2: Quarts de finale Main (4 matches)
    const r2Main: Match[] = [];
    for (let s = 0; s < 4; s++) {
      r2Main.push({
        id: `m_main_r2_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Quart de finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur 1/8e #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur 1/8e #${s * 2 + 2}`,
        classificationRankRange: '1-8',
      });
      r1Main[s * 2].nextMatchId = r2Main[s].id;
      r1Main[s * 2].nextMatchSlot = 'pair1';
      r1Main[s * 2 + 1].nextMatchId = r2Main[s].id;
      r1Main[s * 2 + 1].nextMatchSlot = 'pair2';
    }

    // 4. Consolante Places 5 à 8 (4 matches)
    const c58Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c58Demis.push({
        id: `m_c58_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 5e-8e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart #${s * 2 + 2}`,
        classificationRankRange: '5-8',
      });
      r2Main[s * 2].loserNextMatchId = c58Demis[s].id;
      r2Main[s * 2].loserNextMatchSlot = 'pair1';
      r2Main[s * 2 + 1].loserNextMatchId = c58Demis[s].id;
      r2Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    const match5e: Match = {
      id: `m_c56_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 5e place (5e vs 6e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 5-8 #1',
      pair2Placeholder: 'Vainqueur Demi 5-8 #2',
      classificationRankRange: '5-6',
      targetRankWinner: 5,
      targetRankLoser: 6,
    };

    const match7e: Match = {
      id: `m_c78_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 7e place (7e vs 8e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 5-8 #1',
      pair2Placeholder: 'Perdant Demi 5-8 #2',
      classificationRankRange: '7-8',
      targetRankWinner: 7,
      targetRankLoser: 8,
    };

    c58Demis[0].nextMatchId = match5e.id;
    c58Demis[0].nextMatchSlot = 'pair1';
    c58Demis[0].loserNextMatchId = match7e.id;
    c58Demis[0].loserNextMatchSlot = 'pair1';

    c58Demis[1].nextMatchId = match5e.id;
    c58Demis[1].nextMatchSlot = 'pair2';
    c58Demis[1].loserNextMatchId = match7e.id;
    c58Demis[1].loserNextMatchSlot = 'pair2';

    // 5. Tour 3: Demi-finales Main (2 matches)
    const r3Main: Match[] = [];
    for (let s = 0; s < 2; s++) {
      r3Main.push({
        id: `m_main_r3_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Demi-finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 3,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart #${s * 2 + 2}`,
        classificationRankRange: '1-4',
      });
      r2Main[s * 2].nextMatchId = r3Main[s].id;
      r2Main[s * 2].nextMatchSlot = 'pair1';
      r2Main[s * 2 + 1].nextMatchId = r3Main[s].id;
      r2Main[s * 2 + 1].nextMatchSlot = 'pair2';
    }

    // 6. Tour 4: Finales (Grande & Petite)
    const grandeFinale: Match = {
      id: `m_main_r4_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Grande Finale (Championnat)',
      matchNumber: mCounter - 1,
      bracketRound: 4,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi-finale #1',
      pair2Placeholder: 'Vainqueur Demi-finale #2',
      classificationRankRange: '1-2',
      targetRankWinner: 1,
      targetRankLoser: 2,
    };

    const petiteFinale: Match = {
      id: `m_main_r4_pf_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Petite Finale (Match 3e place)',
      matchNumber: mCounter - 1,
      bracketRound: 4,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi-finale #1',
      pair2Placeholder: 'Perdant Demi-finale #2',
      classificationRankRange: '3-4',
      targetRankWinner: 3,
      targetRankLoser: 4,
    };

    r3Main[0].nextMatchId = grandeFinale.id;
    r3Main[0].nextMatchSlot = 'pair1';
    r3Main[0].loserNextMatchId = petiteFinale.id;
    r3Main[0].loserNextMatchSlot = 'pair1';

    r3Main[1].nextMatchId = grandeFinale.id;
    r3Main[1].nextMatchSlot = 'pair2';
    r3Main[1].loserNextMatchId = petiteFinale.id;
    r3Main[1].loserNextMatchSlot = 'pair2';

    return {
      bracketMatches: [...r1Main, ...r2Main, ...r3Main, grandeFinale, petiteFinale],
      consolanteMatches: [
        ...c58Demis,
        match5e,
        match7e,
        ...c916Quarts,
        ...c912Demis,
        ...c1316Demis,
        match9e,
        match11e,
        match13e,
        match15e,
      ],
    };
  }

  // -------------------------------------------------------------
  // CASE 3: 8 TEAMS
  // -------------------------------------------------------------
  if (size === 8) {
    const r1Main: Match[] = [];
    for (let s = 0; s < 4; s++) {
      r1Main.push({
        id: `m_main_r1_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Quart de finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Tête de série ${s * 2 + 1}`,
        pair2Placeholder: `Tête de série ${s * 2 + 2}`,
        classificationRankRange: '1-8',
      });
    }

    const c58Demis: Match[] = [];
    for (let s = 0; s < 2; s++) {
      c58Demis.push({
        id: `m_c58_sf_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'consolante',
        roundName: `Demi-finale 5e-8e (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 1,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Perdant Quart #${s * 2 + 1}`,
        pair2Placeholder: `Perdant Quart #${s * 2 + 2}`,
        classificationRankRange: '5-8',
      });
      r1Main[s * 2].loserNextMatchId = c58Demis[s].id;
      r1Main[s * 2].loserNextMatchSlot = 'pair1';
      r1Main[s * 2 + 1].loserNextMatchId = c58Demis[s].id;
      r1Main[s * 2 + 1].loserNextMatchSlot = 'pair2';
    }

    const match5e: Match = {
      id: `m_c56_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 5e place (5e vs 6e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi 5-8 #1',
      pair2Placeholder: 'Vainqueur Demi 5-8 #2',
      classificationRankRange: '5-6',
      targetRankWinner: 5,
      targetRankLoser: 6,
    };

    const match7e: Match = {
      id: `m_c78_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'consolante',
      roundName: 'Match pour la 7e place (7e vs 8e)',
      matchNumber: mCounter - 1,
      bracketRound: 2,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi 5-8 #1',
      pair2Placeholder: 'Perdant Demi 5-8 #2',
      classificationRankRange: '7-8',
      targetRankWinner: 7,
      targetRankLoser: 8,
    };

    c58Demis[0].nextMatchId = match5e.id;
    c58Demis[0].nextMatchSlot = 'pair1';
    c58Demis[0].loserNextMatchId = match7e.id;
    c58Demis[0].loserNextMatchSlot = 'pair1';

    c58Demis[1].nextMatchId = match5e.id;
    c58Demis[1].nextMatchSlot = 'pair2';
    c58Demis[1].loserNextMatchId = match7e.id;
    c58Demis[1].loserNextMatchSlot = 'pair2';

    const r2Main: Match[] = [];
    for (let s = 0; s < 2; s++) {
      r2Main.push({
        id: `m_main_r2_s${s}_${timestamp}_${mCounter++}`,
        tournamentId,
        type: 'bracket',
        roundName: `Demi-finale (#${s + 1})`,
        matchNumber: mCounter - 1,
        bracketRound: 2,
        bracketSlotIndex: s,
        status: 'scheduled',
        pair1Placeholder: `Vainqueur Quart #${s * 2 + 1}`,
        pair2Placeholder: `Vainqueur Quart #${s * 2 + 2}`,
        classificationRankRange: '1-4',
      });
      r1Main[s * 2].nextMatchId = r2Main[s].id;
      r1Main[s * 2].nextMatchSlot = 'pair1';
      r1Main[s * 2 + 1].nextMatchId = r2Main[s].id;
      r1Main[s * 2 + 1].nextMatchSlot = 'pair2';
    }

    const grandeFinale: Match = {
      id: `m_main_r3_f_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Grande Finale (Championnat)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 0,
      status: 'scheduled',
      pair1Placeholder: 'Vainqueur Demi-finale #1',
      pair2Placeholder: 'Vainqueur Demi-finale #2',
      classificationRankRange: '1-2',
      targetRankWinner: 1,
      targetRankLoser: 2,
    };

    const petiteFinale: Match = {
      id: `m_main_r3_pf_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: 'Petite Finale (Match 3e place)',
      matchNumber: mCounter - 1,
      bracketRound: 3,
      bracketSlotIndex: 1,
      status: 'scheduled',
      pair1Placeholder: 'Perdant Demi-finale #1',
      pair2Placeholder: 'Perdant Demi-finale #2',
      classificationRankRange: '3-4',
      targetRankWinner: 3,
      targetRankLoser: 4,
    };

    r2Main[0].nextMatchId = grandeFinale.id;
    r2Main[0].nextMatchSlot = 'pair1';
    r2Main[0].loserNextMatchId = petiteFinale.id;
    r2Main[0].loserNextMatchSlot = 'pair1';

    r2Main[1].nextMatchId = grandeFinale.id;
    r2Main[1].nextMatchSlot = 'pair2';
    r2Main[1].loserNextMatchId = petiteFinale.id;
    r2Main[1].loserNextMatchSlot = 'pair2';

    return {
      bracketMatches: [...r1Main, ...r2Main, grandeFinale, petiteFinale],
      consolanteMatches: [...c58Demis, match5e, match7e],
    };
  }

  // -------------------------------------------------------------
  // CASE 4: 4 TEAMS OR FALLBACK
  // -------------------------------------------------------------
  const r1Main: Match[] = [];
  for (let s = 0; s < 2; s++) {
    r1Main.push({
      id: `m_main_r1_s${s}_${timestamp}_${mCounter++}`,
      tournamentId,
      type: 'bracket',
      roundName: `Demi-finale (#${s + 1})`,
      matchNumber: mCounter - 1,
      bracketRound: 1,
      bracketSlotIndex: s,
      status: 'scheduled',
      pair1Placeholder: `Tête de série ${s * 2 + 1}`,
      pair2Placeholder: `Tête de série ${s * 2 + 2}`,
      classificationRankRange: '1-4',
    });
  }

  const grandeFinale: Match = {
    id: `m_main_r2_f_${timestamp}_${mCounter++}`,
    tournamentId,
    type: 'bracket',
    roundName: 'Grande Finale (Championnat)',
    matchNumber: mCounter - 1,
    bracketRound: 2,
    bracketSlotIndex: 0,
    status: 'scheduled',
    pair1Placeholder: 'Vainqueur Demi-finale #1',
    pair2Placeholder: 'Vainqueur Demi-finale #2',
    classificationRankRange: '1-2',
    targetRankWinner: 1,
    targetRankLoser: 2,
  };

  const petiteFinale: Match = {
    id: `m_main_r2_pf_${timestamp}_${mCounter++}`,
    tournamentId,
    type: 'bracket',
    roundName: 'Petite Finale (Match 3e place)',
    matchNumber: mCounter - 1,
    bracketRound: 2,
    bracketSlotIndex: 1,
    status: 'scheduled',
    pair1Placeholder: 'Perdant Demi-finale #1',
    pair2Placeholder: 'Perdant Demi-finale #2',
    classificationRankRange: '3-4',
    targetRankWinner: 3,
    targetRankLoser: 4,
  };

  r1Main[0].nextMatchId = grandeFinale.id;
  r1Main[0].nextMatchSlot = 'pair1';
  r1Main[0].loserNextMatchId = petiteFinale.id;
  r1Main[0].loserNextMatchSlot = 'pair1';

  r1Main[1].nextMatchId = grandeFinale.id;
  r1Main[1].nextMatchSlot = 'pair2';
  r1Main[1].loserNextMatchId = petiteFinale.id;
  r1Main[1].loserNextMatchSlot = 'pair2';

  return {
    bracketMatches: [...r1Main, grandeFinale, petiteFinale],
    consolanteMatches: [],
  };
}

/**
 * Computes official final ranking from 1 to N from all completed classification and main matches.
 */
export function computeCompleteFinalStandings(tournament: Tournament): FinalStandingItem[] {
  const allMatches = [...tournament.bracketMatches, ...tournament.consolanteMatches];
  const confirmedTeams = tournament.pairs.filter(pair => pair.status === 'confirmed').length;
  const configuredMaxTeams = tournament.bracketSize ??
    (tournament.bracketMatches.length >= 20 ? 24 : tournament.bracketMatches.length >= 10 ? 16 : 8);
  const maxTeams = tournament.bracketEntrantCount ??
    (confirmedTeams > 0 ? Math.min(configuredMaxTeams, confirmedTeams) : configuredMaxTeams);

  const standings: FinalStandingItem[] = [];

  for (let r = 1; r <= maxTeams; r++) {
    // Find match with targetRankWinner === r or targetRankLoser === r
    const deciderMatch = allMatches.find(
      (m) => m.targetRankWinner === r || m.targetRankLoser === r
    );

    if (!deciderMatch) {
      standings.push({
        rank: r,
        status: 'pending',
        detail: `Place #${r} non attribuée`,
      });
      continue;
    }

    const isWinnerRank = deciderMatch.targetRankWinner === r;

    if (deciderMatch.status === 'completed' && deciderMatch.winnerPairId) {
      const winnerId = deciderMatch.winnerPairId;
      const loserId =
        winnerId === deciderMatch.pair1Id ? deciderMatch.pair2Id : deciderMatch.pair1Id;
      const pairId = isWinnerRank ? winnerId : loserId;

      let detail = `Match terminé (${deciderMatch.roundName})`;
      if (r === 1) detail = 'Champion du tournoi 🏆';
      else if (r === 2) detail = 'Finaliste (Vice-champion) 🥈';
      else if (r === 3) detail = '3ème place 🥉';
      else if (isWinnerRank) detail = `Vainqueur ${deciderMatch.roundName}`;
      else detail = `Perdant ${deciderMatch.roundName}`;

      standings.push({
        rank: r,
        pairId,
        status: 'confirmed',
        detail,
      });
    } else {
      // Pending or in progress
      let detail = `Déterminé par : ${deciderMatch.roundName}`;
      if (deciderMatch.pair1Id && deciderMatch.pair2Id) {
        detail = `En lice : ${deciderMatch.roundName}`;
      }
      standings.push({
        rank: r,
        status: deciderMatch.status === 'in_progress' ? 'in_progress' : 'pending',
        detail,
      });
    }
  }

  return standings;
}

/**
 * Generates WhatsApp click-to-chat URL for player convocation
 */
export function buildWhatsAppLink(
  phone: string,
  message: string
): string {
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '33' + cleanPhone.slice(1);
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates SMS link
 */
export function buildSmsLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
}

/**
 * Generates regular time slots based on start time and duration in minutes
 */
export function generateTimeSlots(
  startTime: string = '09:00',
  durationMinutes: number = 75,
  slotsCount: number = 10
): string[] {
  const parts = startTime.split(':').map(Number);
  const startH = isNaN(parts[0]) ? 9 : parts[0];
  const startM = isNaN(parts[1]) ? 0 : parts[1];
  let totalMin = startH * 60 + startM;
  const list: string[] = [];

  for (let i = 0; i < slotsCount; i++) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    list.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    totalMin += durationMinutes;
  }
  return list;
}

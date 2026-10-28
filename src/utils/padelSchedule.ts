import type { Court, Match, Pair, Pool } from '../types/tournament';

export interface ScheduleAssignment {
  courtId: string;
  time: string;
  scheduledAt: string;
}

export interface ScheduleOptions {
  currentTime?: Date;
  scheduleDate?: string;
}

function isByePlaceholder(placeholder?: string): boolean {
  return Boolean(placeholder && /\b(?:bye|exempt)\b/i.test(placeholder));
}

function matchHasBye(match: Match, slot: 'pair1' | 'pair2'): boolean {
  return !match[`${slot}Id`] && isByePlaceholder(match[`${slot}Placeholder`]);
}

function setMatchSlot(match: Match, slot: 'pair1' | 'pair2', pairId?: string): Match {
  return {
    ...match,
    [`${slot}Id`]: pairId,
    [`${slot}Placeholder`]: pairId ? undefined : 'Bye',
  };
}

export function resolveBracketByes(
  bracketMatches: Match[],
  consolanteMatches: Match[]
): { bracketMatches: Match[]; consolanteMatches: Match[] } {
  let main = bracketMatches.map(match => ({ ...match }));
  let consolation = consolanteMatches.map(match => ({ ...match }));
  let changed = true;

  while (changed) {
    changed = false;
    const allMatches = [...main, ...consolation];

    for (const match of allMatches) {
      if (match.status === 'completed' || match.status === 'walkover') continue;

      const pair1IsBye = matchHasBye(match, 'pair1');
      const pair2IsBye = matchHasBye(match, 'pair2');
      if (!pair1IsBye && !pair2IsBye) continue;

      const winnerPairId = pair1IsBye
        ? (pair2IsBye ? undefined : match.pair2Id)
        : match.pair1Id;
      if ((!pair1IsBye || !pair2IsBye) && !winnerPairId) continue;

      const resolved: Match = {
        ...match,
        status: 'walkover',
        winnerPairId,
        score: { sets: [], winnerPairId, isWalkover: true },
        courtId: undefined,
        scheduledTime: undefined,
        scheduledAt: undefined,
      };

      const updateMatch = (candidate: Match): Match => {
        if (candidate.id === match.id) return resolved;
        if (!match.nextMatchId || candidate.id !== match.nextMatchId) return candidate;
        const targetSlot = match.nextMatchSlot;
        return targetSlot ? setMatchSlot(candidate, targetSlot, winnerPairId) : candidate;
      };
      main = main.map(updateMatch);
      consolation = consolation.map(updateMatch);
      changed = true;
    }
  }

  return { bracketMatches: main, consolanteMatches: consolation };
}

export function normalizeSixteenTeam24Draw(
  bracketMatches: Match[],
  consolanteMatches: Match[],
  confirmedPairCount: number
): { bracketMatches: Match[]; consolanteMatches: Match[] } {
  if (
    confirmedPairCount > 16 ||
    bracketMatches.filter(match => match.bracketRound === 1).length !== 8 ||
    bracketMatches.filter(match => match.bracketRound === 2).length !== 8 ||
    consolanteMatches.filter(match => match.classificationRankRange === '9-16').length !== 4
  ) {
    return { bracketMatches, consolanteMatches };
  }

  const legacyAwareBracket = bracketMatches.map(match => {
    if (
      match.bracketRound === 1 &&
      !match.pair1Id &&
      !match.pair2Id
    ) {
      return {
        ...match,
        pair1Placeholder: 'Bye',
        pair2Placeholder: 'Bye',
      };
    }
    return match;
  });
  const resolvedLegacyByes = resolveBracketByes(legacyAwareBracket, consolanteMatches);
  const firstRound = resolvedLegacyByes.bracketMatches
    .filter(match => match.bracketRound === 1)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const secondRound = resolvedLegacyByes.bracketMatches
    .filter(match => match.bracketRound === 2)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const activeMatches = (matches: Match[]) => matches.filter(match =>
    match.status !== 'walkover' &&
    !matchHasBye(match, 'pair1') &&
    !matchHasBye(match, 'pair2') &&
    isMatchSchedulable(match)
  );
  const classificationQuarters = resolvedLegacyByes.consolanteMatches
    .filter(match => match.classificationRankRange === '9-16')
    .sort((a, b) => a.matchNumber - b.matchNumber);
  if (classificationQuarters.some(match =>
    match.status === 'completed' || match.status === 'in_progress'
  )) {
    return resolvedLegacyByes;
  }

  const sources = [...activeMatches(firstRound), ...activeMatches(secondRound)]
    .sort((a, b) => a.matchNumber - b.matchNumber);
  if (sources.length !== classificationQuarters.length * 2) {
    return { bracketMatches, consolanteMatches };
  }

  let updatedBracket = resolvedLegacyByes.bracketMatches.map(match =>
    match.bracketRound === 1 || match.bracketRound === 2
      ? { ...match, loserNextMatchId: undefined, loserNextMatchSlot: undefined }
      : match
  );
  const updatedConsolante = resolvedLegacyByes.consolanteMatches.filter(match => {
    const upperRank = Number((match.classificationRankRange ?? '').split('-')[1]);
    return Number.isFinite(upperRank) && upperRank <= 16;
  }).map(match => ({ ...match }));

  sources.forEach((source, index) => {
    const target = classificationQuarters[Math.floor(index / 2)];
    const slot = index % 2 === 0 ? 'pair1' : 'pair2';
    const sourceIndex = updatedBracket.findIndex(match => match.id === source.id);
    if (sourceIndex >= 0) {
      updatedBracket[sourceIndex] = {
        ...updatedBracket[sourceIndex],
        loserNextMatchId: target.id,
        loserNextMatchSlot: slot,
      };
    }

    const targetIndex = updatedConsolante.findIndex(match => match.id === target.id);
    if (targetIndex < 0) return;
    const loserPairId = source.winnerPairId
      ? source.winnerPairId === source.pair1Id ? source.pair2Id : source.pair1Id
      : undefined;
    updatedConsolante[targetIndex] = {
      ...updatedConsolante[targetIndex],
      [`${slot}Id`]: loserPairId,
      [`${slot}Placeholder`]: `Perdant Match #${source.matchNumber}`,
    };
  });

  return { bracketMatches: updatedBracket, consolanteMatches: updatedConsolante };
}

function hasParticipant(pairId?: string, placeholder?: string): boolean {
  const label = placeholder?.trim();
  return Boolean(
    pairId ||
    (label && !/(exempt|bye)/i.test(label))
  );
}

export function isMatchSchedulable(
  match: Pick<Match, 'pair1Id' | 'pair1Placeholder' | 'pair2Id' | 'pair2Placeholder'>
): boolean {
  return (
    hasParticipant(match.pair1Id, match.pair1Placeholder) ||
    hasParticipant(match.pair2Id, match.pair2Placeholder)
  );
}

export function isMatchPlayable(
  match: Pick<Match, 'pair1Id' | 'pair1Placeholder' | 'pair2Id' | 'pair2Placeholder'>
): boolean {
  return Boolean(match.pair1Id && match.pair2Id);
}

export const isConsolanteMatchSchedulable = isMatchPlayable;

function getOutcomeReference(
  target: Match,
  slot: 'pair1' | 'pair2',
  bracketMatches: Match[]
): { pairId?: string; placeholder?: string } | undefined {
  const placeholder = target[`${slot}Placeholder`] ?? '';
  const sourceMatchId = target[`${slot}SourceMatchId`];
  const sourceOutcome = target[`${slot}SourceOutcome`];
  const isLoserReference = sourceOutcome
    ? sourceOutcome === 'loser'
    : /^perdant\b/i.test(placeholder);
  if (!/^(?:vainqueur|perdant)\b/i.test(placeholder)) return undefined;

  const getScoreWinnerSlot = (match: Match): 'pair1' | 'pair2' | undefined => {
    const setWins = match.score?.sets.reduce(
      (wins, set) => {
        if (set.pair1 > set.pair2) wins.pair1 += 1;
        if (set.pair2 > set.pair1) wins.pair2 += 1;
        return wins;
      },
      { pair1: 0, pair2: 0 }
    );
    if (!setWins || setWins.pair1 === setWins.pair2) return undefined;
    return setWins.pair1 > setWins.pair2 ? 'pair1' : 'pair2';
  };
  const getWinnerSlot = (match: Match) => {
    const winnerPairId = match.winnerPairId || match.score?.winnerPairId;
    if (winnerPairId && winnerPairId === match.pair1Id) return 'pair1';
    if (winnerPairId && winnerPairId === match.pair2Id) return 'pair2';
    return getScoreWinnerSlot(match);
  };

  const explicitReference = placeholder.match(/(?:Match\s*#|M#)\s*(\d+)\b/i);
  let sourceMatch = sourceMatchId
    ? bracketMatches.find(match => match.id === sourceMatchId)
    : explicitReference
    ? bracketMatches
        .filter(
          match =>
            match.type !== 'consolante' &&
            Number(match.matchNumber) === Number(explicitReference[1])
        )
        .find(
          match =>
            (match.status === 'completed' || match.status === 'walkover') &&
            getWinnerSlot(match)
        )
    : undefined;

  if (sourceMatchId && !sourceMatch) return undefined;

  if (!sourceMatchId && sourceMatch?.nextMatchId === target.id && sourceMatch.nextMatchSlot !== slot) {
    const routedSource = bracketMatches.find(
      match => match.nextMatchId === target.id && match.nextMatchSlot === slot
    );
    if (routedSource) sourceMatch = routedSource;
  }

  if (!sourceMatchId && isLoserReference && sourceMatch?.loserNextMatchId === target.id) {
    const routedLoserSource = bracketMatches.find(
      match => match.loserNextMatchId === target.id && match.loserNextMatchSlot === slot
    );
    if (routedLoserSource) sourceMatch = routedLoserSource;
  }

  if (!sourceMatch && /vainqueur du tour précédent/i.test(placeholder)) {
    sourceMatch = bracketMatches.find(
      match => match.nextMatchId === target.id && match.nextMatchSlot === slot
    );

    if (!sourceMatch) {
      const previousRound = (target.bracketRound ?? 1) - 1;
      const previousRoundMatches = bracketMatches
        .filter(match => (match.bracketRound ?? 1) === previousRound)
        .sort((a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0));
      const sourceIndex =
        (target.bracketSlotIndex ?? 0) * 2 + (slot === 'pair1' ? 0 : 1);
      sourceMatch = previousRoundMatches[sourceIndex];
    }
  }

  if (
    !sourceMatch ||
    (sourceMatch.status !== 'completed' && sourceMatch.status !== 'walkover')
  ) {
    return undefined;
  }

  const winnerSlot = getWinnerSlot(sourceMatch);
  if (!winnerSlot) return undefined;
  const outcomeSlot = isLoserReference
    ? winnerSlot === 'pair1' ? 'pair2' : 'pair1'
    : winnerSlot;
  return {
    pairId: sourceMatch[`${outcomeSlot}Id`] || undefined,
    placeholder: sourceMatch[`${outcomeSlot}Placeholder`] || undefined,
  };
}

export function resolveMatchOutcomePlaceholder(
  target: Match,
  slot: 'pair1' | 'pair2',
  bracketMatches: Match[]
): string | undefined {
  const outcome = getOutcomeReference(target, slot, bracketMatches);
  return outcome?.pairId ? undefined : outcome?.placeholder;
}

export function resolveMatchOutcomeReferences(
  bracketMatches: Match[],
  consolanteMatches: Match[],
  pairs: Pair[] = []
): { bracketMatches: Match[]; consolanteMatches: Match[] } {
  const pairIdByLabel = new Map(
    pairs.map(pair => [
      `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase(),
      pair.id,
    ])
  );
  const findPairId = (pairId?: string, label?: string) =>
    pairId ||
    (label
      ? pairIdByLabel.get(label.replace(/\s+/g, ' ').trim().toLocaleLowerCase())
      : undefined);

  const resolveMatches = (matches: Match[]) =>
    matches.map(match => {
      const pair1Outcome = getOutcomeReference(match, 'pair1', bracketMatches);
      const pair2Outcome = getOutcomeReference(match, 'pair2', bracketMatches);
      const slotHasOutcomePlaceholder = (slot: 'pair1' | 'pair2') =>
        Boolean(match[`${slot}SourceMatchId`]) ||
        /^(?:vainqueur|perdant)\b/i.test(match[`${slot}Placeholder`] ?? '');

      const resolveSlot = (
        slot: 'pair1' | 'pair2',
        currentPairId: string | undefined,
        outcome: { pairId?: string; placeholder?: string } | undefined
      ) => {
        const routedPairId = findPairId(outcome?.pairId, outcome?.placeholder);

        if (slotHasOutcomePlaceholder(slot)) {
          return routedPairId ?? currentPairId;
        }

        if (currentPairId) return currentPairId;
        return routedPairId ?? currentPairId;
      };

      const resolvedPair1Id = resolveSlot('pair1', match.pair1Id, pair1Outcome);
      const resolvedPair2Id = resolveSlot('pair2', match.pair2Id, pair2Outcome);
      if (
        resolvedPair1Id === match.pair1Id &&
        resolvedPair2Id === match.pair2Id
      ) {
        return match;
      }

      return {
        ...match,
        pair1Id: resolvedPair1Id,
        pair2Id: resolvedPair2Id,
      };
    });

  return {
    bracketMatches: resolveMatches(bracketMatches),
    consolanteMatches: resolveMatches(consolanteMatches),
  };
}

export function compactConsolanteLoserSlots(
  bracketMatches: Match[],
  consolanteMatches: Match[]
): { bracketMatches: Match[]; consolanteMatches: Match[] } {
  const consolanteById = new Map(consolanteMatches.map(match => [match.id, match]));
  const groups = new Map<string, { sources: Match[]; targets: Match[] }>();

  for (const source of bracketMatches) {
    if (!source.loserNextMatchId) continue;
    const target = consolanteById.get(source.loserNextMatchId);
    if (!target) continue;
    const groupKey = `${target.classificationRankRange ?? target.roundName}:${target.bracketRound ?? 1}`;
    const group = groups.get(groupKey) ?? { sources: [], targets: [] };
    group.sources.push(source);
    if (!group.targets.some(match => match.id === target.id)) group.targets.push(target);
    groups.set(groupKey, group);
  }

  let updatedBracket = bracketMatches;
  let updatedConsolante = consolanteMatches;

  for (const { sources, targets } of groups.values()) {
    if (!sources.some(source => source.status === 'walkover')) continue;

    const orderedSources = [...sources].sort((a, b) => a.matchNumber - b.matchNumber);
    const orderedTargets = [...targets].sort((a, b) => a.matchNumber - b.matchNumber);
    const playableSources = orderedSources.filter(isMatchPlayable);
    if (playableSources.length > orderedTargets.length * 2) continue;
    if (orderedTargets.some(target => target.status === 'completed' || target.status === 'in_progress')) {
      continue;
    }

    const sourceSlots = new Map<string, { targetId: string; slot: 'pair1' | 'pair2' }>();
    playableSources.forEach((source, index) => {
      const target = orderedTargets[Math.floor(index / 2)];
      const slot = index % 2 === 0 ? 'pair1' : 'pair2';
      sourceSlots.set(source.id, { targetId: target.id, slot });
    });

    updatedBracket = updatedBracket.map(source => {
      if (!sources.some(groupSource => groupSource.id === source.id)) return source;
      const assignment = sourceSlots.get(source.id);
      return assignment
        ? { ...source, loserNextMatchId: assignment.targetId, loserNextMatchSlot: assignment.slot }
        : { ...source, loserNextMatchId: undefined, loserNextMatchSlot: undefined };
    });

    const loserFor = (source: Match) => {
      if (!source.winnerPairId) return undefined;
      return source.winnerPairId === source.pair1Id ? source.pair2Id : source.pair1Id;
    };

    updatedConsolante = updatedConsolante.map(target => {
      if (!orderedTargets.some(groupTarget => groupTarget.id === target.id)) return target;
      const assignedSources = playableSources.filter(
        source => sourceSlots.get(source.id)?.targetId === target.id
      );
      const pair1Source = assignedSources[0];
      const pair2Source = assignedSources[1];
      return {
        ...target,
        pair1Id: pair1Source ? loserFor(pair1Source) : undefined,
        pair2Id: pair2Source ? loserFor(pair2Source) : undefined,
        pair1Placeholder: pair1Source ? `Perdant Match #${pair1Source.matchNumber}` : 'Exempt (Bye)',
        pair2Placeholder: pair2Source ? `Perdant Match #${pair2Source.matchNumber}` : 'Exempt (Bye)',
      };
    });
  }

  return { bracketMatches: updatedBracket, consolanteMatches: updatedConsolante };
}

function parseTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getScheduleStart(startTime: string, options: ScheduleOptions): Date {
  if (options.currentTime) return new Date(options.currentTime);
  const date = options.scheduleDate || new Date().toISOString().slice(0, 10);
  const minutes = parseTime(startTime) ?? 9 * 60;
  const start = new Date(`${date}T00:00:00`);
  start.setMinutes(minutes);
  return start;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function createConflictFreeSchedule(
  pools: Pool[],
  bracketMatches: Match[],
  consolanteMatches: Match[],
  courts: Court[],
  startTime: string,
  slotDuration: number,
  options: ScheduleOptions = {}
): Map<string, ScheduleAssignment> {
  if (!courts.length) throw new Error('Au moins un terrain est nécessaire.');

  const scheduleStart = getScheduleStart(startTime, options);
  const assignments = new Map<string, ScheduleAssignment>();
  const allMatches = [
    ...pools.flatMap(pool => pool.matches),
    ...bracketMatches,
    ...consolanteMatches,
  ];
  const mutableMatches = new Map(allMatches.map(match => [match.id, { ...match }]));
  const incoming = new Map<string, { sourceId: string; outcome: 'winner' | 'loser' }>();
  for (const match of allMatches) {
    if (match.nextMatchId && match.nextMatchSlot) {
      incoming.set(`${match.nextMatchId}:${match.nextMatchSlot}`, {
        sourceId: match.id,
        outcome: 'winner',
      });
    }
    if (match.loserNextMatchId && match.loserNextMatchSlot) {
      incoming.set(`${match.loserNextMatchId}:${match.loserNextMatchSlot}`, {
        sourceId: match.id,
        outcome: 'loser',
      });
    }
  }

  const pairAvailableAt = new Map<string, number>();
  const participantBySlot = new Map<string, string>();
  const participantAvailableAt = new Map<string, number>();
  const courtAvailableAt = new Map(courts.map(court => [court.id, scheduleStart.getTime()]));
  const startMs = scheduleStart.getTime();
  const nowMs = options.currentTime?.getTime();
  const slotKey = (matchId: string, slot: 'pair1' | 'pair2') => `${matchId}:${slot}`;
  const scheduledStart = (match: Match): number | undefined => {
    if (!match.courtId || !match.scheduledTime || !courtAvailableAt.has(match.courtId)) {
      return undefined;
    }
    const storedTime = match.scheduledAt ? Date.parse(match.scheduledAt) : NaN;
    if (Number.isFinite(storedTime)) return storedTime;
    const minutes = parseTime(match.scheduledTime);
    if (minutes === null) return undefined;
    const date = new Date(scheduleStart);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(minutes);
    return date.getTime();
  };

  const setParticipant = (
    matchId: string,
    slot: 'pair1' | 'pair2',
    participant: string,
    availableAt: number
  ) => {
    const key = slotKey(matchId, slot);
    participantBySlot.set(key, participant);
    participantAvailableAt.set(
      participant,
      Math.max(participantAvailableAt.get(participant) ?? startMs, availableAt)
    );
  };

  const poolPhases = [...new Set(pools.map(pool => pool.phase ?? 1))].sort((a, b) => a - b);
  const poolStages: Match[][] = [];

  for (const phase of poolPhases) {
    const phasePoolIds = new Set(
      pools.filter(pool => (pool.phase ?? 1) === phase).map(pool => pool.id)
    );
    poolStages.push(allMatches.filter(match =>
      match.type === 'pool' &&
      match.poolId !== undefined &&
      phasePoolIds.has(match.poolId)
    ));
  }

  const stagedPoolMatchIds = new Set(poolStages.flat().map(match => match.id));
  const otherPoolMatches = allMatches.filter(match =>
    !stagedPoolMatchIds.has(match.id) &&
    match.type === 'pool' &&
    isMatchSchedulable(match)
  );
  if (otherPoolMatches.length) poolStages.unshift(otherPoolMatches);

  const getMatchEndAt = (match: Match): number | undefined => {
    if (match.status === 'completed' || match.status === 'walkover') {
      const completedAt = match.completedAt ? Date.parse(match.completedAt) : NaN;
      if (Number.isFinite(completedAt)) return completedAt;
      const fixedStart = scheduledStart(match);
      if (fixedStart !== undefined) {
        return fixedStart + (match.durationMinutes ?? slotDuration) * 60_000;
      }
      return nowMs ?? startMs;
    }
    if (match.status === 'in_progress' || match.status === 'warmup') {
      const startedAt = match.startedAt ? Date.parse(match.startedAt) : NaN;
      const fixedStart = scheduledStart(match);
      const start = Number.isFinite(startedAt)
        ? startedAt
        : fixedStart ?? nowMs ?? startMs;
      return Math.max(
        nowMs ?? start,
        start + (match.durationMinutes ?? slotDuration) * 60_000
      );
    }
    const assignment = assignments.get(match.id);
    if (!assignment) return undefined;
    const start = Date.parse(assignment.scheduledAt);
    return Number.isFinite(start)
      ? start + (match.durationMinutes ?? slotDuration) * 60_000
      : undefined;
  };

  for (const match of allMatches) {
    for (const slot of ['pair1', 'pair2'] as const) {
      const pairId = match[`${slot}Id`];
      const placeholder = match[`${slot}Placeholder`];
      if (pairId) {
        setParticipant(match.id, slot, `pair:${pairId}`, startMs);
      } else if (placeholder && !/(exempt|bye)/i.test(placeholder) && !incoming.has(slotKey(match.id, slot))) {
        setParticipant(match.id, slot, `placeholder:${match.id}:${slot}`, startMs);
      }
    }

    const duration = (match.durationMinutes ?? slotDuration) * 60_000;
    if (match.status === 'completed' || match.status === 'walkover') {
      const completedAt = match.completedAt ? Date.parse(match.completedAt) : startMs;
      const availableAt = Number.isFinite(completedAt) ? completedAt : startMs;
      if (match.pair1Id) pairAvailableAt.set(match.pair1Id, Math.max(pairAvailableAt.get(match.pair1Id) ?? startMs, availableAt));
      if (match.pair2Id) pairAvailableAt.set(match.pair2Id, Math.max(pairAvailableAt.get(match.pair2Id) ?? startMs, availableAt));
      continue;
    }

    if (match.status !== 'in_progress' && match.status !== 'warmup') continue;
    const startedAt = match.startedAt ? Date.parse(match.startedAt) : NaN;
    const scheduledAt = match.scheduledAt ? Date.parse(match.scheduledAt) : NaN;
    const start = Number.isFinite(startedAt)
      ? startedAt
      : Number.isFinite(scheduledAt)
        ? scheduledAt
        : (nowMs ?? startMs);
    const availableAt = Math.max(nowMs ?? start, start + duration);
    if (match.pair1Id) pairAvailableAt.set(match.pair1Id, Math.max(pairAvailableAt.get(match.pair1Id) ?? startMs, availableAt));
    if (match.pair2Id) pairAvailableAt.set(match.pair2Id, Math.max(pairAvailableAt.get(match.pair2Id) ?? startMs, availableAt));
    if (match.courtId && courtAvailableAt.has(match.courtId)) {
      courtAvailableAt.set(
        match.courtId,
        Math.max(courtAvailableAt.get(match.courtId) ?? startMs, availableAt)
      );
    }
  }

  const propagateOutcome = (
    source: Match,
    outcome: 'winner' | 'loser',
    targetId: string | undefined,
    targetSlot: 'pair1' | 'pair2' | undefined,
    availableAt: number,
    simulated: boolean
  ) => {
    if (!targetId || !targetSlot) return;
    const target = mutableMatches.get(targetId);
    if (!target) return;
    const pairId = outcome === 'winner'
      ? source.winnerPairId
      : source.winnerPairId
        ? source.winnerPairId === source.pair1Id ? source.pair2Id : source.pair1Id
        : undefined;
    const participant = pairId
      ? `pair:${pairId}`
      : simulated
        ? `${outcome}:${source.id}`
        : undefined;
    if (!participant) return;
    setParticipant(target.id, targetSlot, participant, availableAt);
    if (pairId) target[`${targetSlot}Id`] = pairId;
  };

  for (const match of allMatches) {
    if (match.status !== 'completed' && match.status !== 'walkover') continue;
    const completedAt = match.completedAt ? Date.parse(match.completedAt) : startMs;
    const availableAt = Number.isFinite(completedAt) ? completedAt : startMs;
    if (match.winnerPairId) {
      propagateOutcome(match, 'winner', match.nextMatchId, match.nextMatchSlot, availableAt, false);
      propagateOutcome(match, 'loser', match.loserNextMatchId, match.loserNextMatchSlot, availableAt, false);
    }
  }

  const scheduledPending = allMatches.filter(match =>
    match.status !== 'completed' &&
    match.status !== 'walkover' &&
    match.status !== 'in_progress' &&
    match.status !== 'warmup'
  );
  const getMatchSchedulingPriority = (match: Match): number =>
    match.type === 'bracket' ? 1 : 0;
  const scheduleReadyMatches = (pending: Match[], startBarrier: number): boolean => {
    while (pending.length > 0) {
      let best: {
        match: Match;
        court: Court;
        startAt: number;
      } | undefined;

      for (const match of pending) {
        const pair1 = participantBySlot.get(slotKey(match.id, 'pair1'));
        const pair2 = participantBySlot.get(slotKey(match.id, 'pair2'));
        if (!pair1 || !pair2) continue;

        const pairReadyAt = Math.max(
          startMs,
          participantAvailableAt.get(pair1) ?? startMs,
          participantAvailableAt.get(pair2) ?? startMs,
          match.pair1Id ? pairAvailableAt.get(match.pair1Id) ?? startMs : startMs,
          match.pair2Id ? pairAvailableAt.get(match.pair2Id) ?? startMs : startMs
        );

        for (const court of courts) {
          const startAt = Math.max(
            pairReadyAt,
            startBarrier,
            courtAvailableAt.get(court.id) ?? startMs
          );
          if (
            !best ||
            startAt < best.startAt ||
            (startAt === best.startAt && (
              getMatchSchedulingPriority(match) > getMatchSchedulingPriority(best.match) ||
              (getMatchSchedulingPriority(match) === getMatchSchedulingPriority(best.match) &&
                match.matchNumber < best.match.matchNumber)
            ))
          ) {
            best = { match, court, startAt };
          }
        }
      }

      if (!best) return false;

      const duration = (best.match.durationMinutes ?? slotDuration) * 60_000;
      const availableAt = best.startAt + duration;
      assignments.set(best.match.id, {
        courtId: best.court.id,
        time: formatTime(new Date(best.startAt)),
        scheduledAt: new Date(best.startAt).toISOString(),
      });
      courtAvailableAt.set(best.court.id, availableAt);
      for (const pairId of [best.match.pair1Id, best.match.pair2Id]) {
        if (pairId) pairAvailableAt.set(pairId, availableAt);
      }
      propagateOutcome(
        best.match,
        'winner',
        best.match.nextMatchId,
        best.match.nextMatchSlot,
        availableAt,
        true
      );
      propagateOutcome(
        best.match,
        'loser',
        best.match.loserNextMatchId,
        best.match.loserNextMatchSlot,
        availableAt,
        true
      );
      pending.splice(pending.findIndex(match => match.id === best!.match.id), 1);
    }

    return true;
  };

  let previousPoolPhaseEnd = startMs;
  for (const phase of poolStages) {
    const phasePending = scheduledPending.filter(match => phase.includes(match));
    if (!scheduleReadyMatches(phasePending, previousPoolPhaseEnd)) return assignments;
    const phaseEnds = phase.map(getMatchEndAt);
    if (phaseEnds.some(endAt => endAt === undefined)) return assignments;
    previousPoolPhaseEnd = Math.max(previousPoolPhaseEnd, ...phaseEnds as number[]);
  }

  const bracketAndConsolanteMatches = scheduledPending.filter(match => match.type !== 'pool');
  scheduleReadyMatches(bracketAndConsolanteMatches, previousPoolPhaseEnd);

  return assignments;
}

export function applyScheduleAssignments(
  matches: Match[],
  assignments: Map<string, ScheduleAssignment>,
  clearUnassigned = false
): Match[] {
  return matches.map(match => {
    const assignment = assignments.get(match.id);
    if (assignment) {
      return {
        ...match,
        courtId: assignment.courtId,
        scheduledTime: assignment.time,
        scheduledAt: assignment.scheduledAt,
      };
    }
    if (
      clearUnassigned &&
      match.status !== 'completed' &&
      match.status !== 'walkover' &&
      match.status !== 'in_progress' &&
      match.status !== 'warmup'
    ) {
      return {
        ...match,
        courtId: undefined,
        scheduledTime: undefined,
        scheduledAt: undefined,
      };
    }
    return match;
  });
}

export function rescheduleMatchesFromNow(
  pools: Pool[],
  bracketMatches: Match[],
  consolanteMatches: Match[],
  courts: Court[],
  startTime: string,
  slotDuration: number,
  options: ScheduleOptions = {}
): {
  pools: Pool[];
  bracketMatches: Match[];
  consolanteMatches: Match[];
} {
  const requestedStart = options.currentTime ?? new Date();
  const currentTime = new Date(requestedStart);
  currentTime.setSeconds(0, 0);
  if (currentTime.getTime() < requestedStart.getTime()) {
    currentTime.setMinutes(currentTime.getMinutes() + 1);
  }

  const assignments = createConflictFreeSchedule(
    pools,
    bracketMatches,
    consolanteMatches,
    courts,
    startTime,
    slotDuration,
    { ...options, currentTime }
  );

  return {
    pools: pools.map(pool => ({
      ...pool,
      matches: applyScheduleAssignments(pool.matches, assignments, true),
    })),
    bracketMatches: applyScheduleAssignments(bracketMatches, assignments, true),
    consolanteMatches: applyScheduleAssignments(consolanteMatches, assignments, true),
  };
}

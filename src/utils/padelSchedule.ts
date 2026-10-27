import type { Court, Match, Pool } from '../types/tournament';

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

  for (const match of allMatches) {
    const fixedStart = scheduledStart(match);
    if (
      fixedStart !== undefined &&
      match.status !== 'completed' &&
      match.status !== 'walkover' &&
      match.status !== 'in_progress' &&
      match.status !== 'warmup'
    ) {
      const fixedEnd = fixedStart + (match.durationMinutes ?? slotDuration) * 60_000;
      courtAvailableAt.set(
        match.courtId!,
        Math.max(courtAvailableAt.get(match.courtId!) ?? startMs, fixedEnd)
      );
      for (const pairId of [match.pair1Id, match.pair2Id]) {
        if (pairId) pairAvailableAt.set(pairId, Math.max(pairAvailableAt.get(pairId) ?? startMs, fixedEnd));
      }
    }

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

  const pending = allMatches.filter(match =>
    !scheduledStart(match) &&
    match.status !== 'completed' &&
    match.status !== 'walkover' &&
    match.status !== 'in_progress' &&
    match.status !== 'warmup'
  );

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

  const fixedMatches = allMatches
    .map(match => ({ match, start: scheduledStart(match) }))
    .filter((item): item is { match: Match; start: number } =>
      item.start !== undefined &&
      item.match.status !== 'completed' &&
      item.match.status !== 'walkover' &&
      item.match.status !== 'in_progress' &&
      item.match.status !== 'warmup'
    )
    .sort((a, b) => a.start - b.start);
  for (const { match, start } of fixedMatches) {
    if (
      !participantBySlot.has(slotKey(match.id, 'pair1')) ||
      !participantBySlot.has(slotKey(match.id, 'pair2'))
    ) continue;
    const availableAt = start + (match.durationMinutes ?? slotDuration) * 60_000;
    propagateOutcome(match, 'winner', match.nextMatchId, match.nextMatchSlot, availableAt, true);
    propagateOutcome(match, 'loser', match.loserNextMatchId, match.loserNextMatchSlot, availableAt, true);
  }

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
        const startAt = Math.max(pairReadyAt, courtAvailableAt.get(court.id) ?? startMs);
        if (
          !best ||
          startAt < best.startAt ||
          (startAt === best.startAt && match.matchNumber < best.match.matchNumber)
        ) {
          best = { match, court, startAt };
        }
      }
    }

    if (!best) break;

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

  return assignments;
}

export function applyScheduleAssignments(
  matches: Match[],
  assignments: Map<string, ScheduleAssignment>
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
    return match;
  });
}

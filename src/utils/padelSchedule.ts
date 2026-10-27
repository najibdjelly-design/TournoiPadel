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
      if (!pair1IsBye || !pair2IsBye) {
        if (!winnerPairId) continue;
      }

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

function hasParticipant(pairId?: string, placeholder?: string): boolean {
  const label = placeholder?.trim();
  return Boolean(
    pairId ||
    (label && !/(exempt|bye)/i.test(label) && !/^qualifi[eé]\s*\/\s*rang\b/i.test(label))
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
  const pairAvailableAt = new Map<string, number>();
  const courtAvailableAt = new Map(courts.map(court => [court.id, scheduleStart.getTime()]));
  const startMs = scheduleStart.getTime();
  const nowMs = options.currentTime?.getTime();

  const setPairAvailability = (pairId: string | undefined, timestamp: number) => {
    if (!pairId) return;
    pairAvailableAt.set(pairId, Math.max(pairAvailableAt.get(pairId) ?? startMs, timestamp));
  };

  for (const match of allMatches) {
    const duration = (match.durationMinutes ?? slotDuration) * 60_000;
    if (match.status === 'completed' || match.status === 'walkover') {
      const completedAt = match.completedAt ? Date.parse(match.completedAt) : startMs;
      const availableAt = Number.isFinite(completedAt) ? completedAt : startMs;
      setPairAvailability(match.pair1Id, availableAt);
      setPairAvailability(match.pair2Id, availableAt);
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
    setPairAvailability(match.pair1Id, availableAt);
    setPairAvailability(match.pair2Id, availableAt);
    if (match.courtId && courtAvailableAt.has(match.courtId)) {
      courtAvailableAt.set(
        match.courtId,
        Math.max(courtAvailableAt.get(match.courtId) ?? startMs, availableAt)
      );
    }
  }

  const pending = allMatches.filter(match =>
    match.status !== 'completed' &&
    match.status !== 'walkover' &&
    match.status !== 'in_progress' &&
    match.status !== 'warmup' &&
    isMatchPlayable(match)
  );

  while (pending.length > 0) {
    let best: {
      match: Match;
      court: Court;
      startAt: number;
    } | undefined;

    for (const match of pending) {
      const pairReadyAt = Math.max(
        startMs,
        pairAvailableAt.get(match.pair1Id!) ?? startMs,
        pairAvailableAt.get(match.pair2Id!) ?? startMs
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
    setPairAvailability(best.match.pair1Id, availableAt);
    setPairAvailability(best.match.pair2Id, availableAt);
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
    if (
      match.status === 'completed' ||
      match.status === 'walkover' ||
      match.status === 'in_progress' ||
      match.status === 'warmup'
    ) return match;
    return {
      ...match,
      courtId: undefined,
      scheduledTime: undefined,
      scheduledAt: undefined,
    };
  });
}

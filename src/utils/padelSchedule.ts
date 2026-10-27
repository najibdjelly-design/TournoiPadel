import type { Court, Match, Pool } from '../types/tournament';

export interface ScheduleAssignment {
  courtId: string;
  time: string;
}

export function isMatchSchedulable(
  match: Pick<Match, 'pair1Id' | 'pair1Placeholder' | 'pair2Id' | 'pair2Placeholder'>
): boolean {
  const hasParticipant = (pairId?: string, placeholder?: string) =>
    Boolean(pairId || (placeholder?.trim() && !/(exempt|bye)/i.test(placeholder)));

  return (
    hasParticipant(match.pair1Id, match.pair1Placeholder) ||
    hasParticipant(match.pair2Id, match.pair2Placeholder)
  );
}

export function isConsolanteMatchSchedulable(
  match: Pick<Match, 'pair1Id' | 'pair1Placeholder' | 'pair2Id' | 'pair2Placeholder'>
): boolean {
  const hasParticipant = (pairId?: string, placeholder?: string) =>
    Boolean(pairId || (placeholder?.trim() && !/(exempt|bye)/i.test(placeholder)));

  return (
    hasParticipant(match.pair1Id, match.pair1Placeholder) &&
    hasParticipant(match.pair2Id, match.pair2Placeholder)
  );
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
    if (!sources.some(source => !isMatchSchedulable(source))) continue;

    const orderedSources = [...sources].sort((a, b) => a.matchNumber - b.matchNumber);
    const orderedTargets = [...targets].sort((a, b) => a.matchNumber - b.matchNumber);
    const playableSources = orderedSources.filter(isMatchSchedulable);
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

function formatTime(startTime: string, slotIndex: number, durationMinutes: number): string {
  const start = parseTime(startTime) ?? 9 * 60;
  const totalMinutes = start + slotIndex * durationMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function createConflictFreeSchedule(
  pools: Pool[],
  bracketMatches: Match[],
  consolanteMatches: Match[],
  courts: Court[],
  startTime: string,
  slotDuration: number
): Map<string, ScheduleAssignment> {
  if (!courts.length) throw new Error('Au moins un terrain est nécessaire.');

  let slotIndex = 0;
  const assignments = new Map<string, ScheduleAssignment>();
  const pairLastSlot = new Map<string, number>();
  const pairMatchCount = new Map<string, number>();

  const scheduleStage = (stageMatches: Match[]) => {
    const pending = stageMatches
      .filter(isMatchSchedulable)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    while (pending.length > 0) {
      const usedPairs = new Set<string>();
      let courtIndex = 0;
      let scheduledThisSlot = 0;

      while (courtIndex < courts.length) {
        const eligible = pending
          .filter(match => {
            const pairIds = [match.pair1Id, match.pair2Id].filter(
              (pairId): pairId is string => Boolean(pairId)
            );
            return pairIds.every(pairId => !usedPairs.has(pairId));
          })
          .sort((a, b) => {
            const priority = (match: Match) => {
              const ids = [match.pair1Id, match.pair2Id].filter(
                (pairId): pairId is string => Boolean(pairId)
              );
              return {
                playedCount: ids.reduce(
                  (total, id) => total + (pairMatchCount.get(id) ?? 0),
                  0
                ),
                lastPlayed: Math.max(-1, ...ids.map(id => pairLastSlot.get(id) ?? -1)),
              };
            };
            const first = priority(a);
            const second = priority(b);
            return (
              first.playedCount - second.playedCount ||
              first.lastPlayed - second.lastPlayed ||
              a.matchNumber - b.matchNumber
            );
          });

        const nextMatch = eligible[0];
        if (!nextMatch) break;

        const court = courts[courtIndex++];
        assignments.set(nextMatch.id, {
          courtId: court.id,
          time: formatTime(startTime, slotIndex, slotDuration),
        });
        for (const pairId of [nextMatch.pair1Id, nextMatch.pair2Id]) {
          if (!pairId) continue;
          usedPairs.add(pairId);
          pairLastSlot.set(pairId, slotIndex);
          pairMatchCount.set(pairId, (pairMatchCount.get(pairId) ?? 0) + 1);
        }
        pending.splice(pending.findIndex(match => match.id === nextMatch.id), 1);
        scheduledThisSlot++;
      }

      if (scheduledThisSlot === 0) {
        throw new Error('Le planificateur ne peut pas affecter les matches restants.');
      }
      slotIndex++;
    }
  };

  const poolPhases = [...new Set(pools.map(pool => pool.phase ?? 1))].sort((a, b) => a - b);
  for (const phase of poolPhases) {
    scheduleStage(
      pools
        .filter(pool => (pool.phase ?? 1) === phase)
        .flatMap(pool => pool.matches)
    );
  }

  const bracketRounds = [...new Set(
    bracketMatches.map(match => match.bracketRound ?? 1)
  )].sort((a, b) => a - b);
  const consolanteRounds = [...new Set(
    consolanteMatches.map(match => match.bracketRound ?? 1)
  )].sort((a, b) => a - b);
  const knockoutRounds = [...new Set([...bracketRounds, ...consolanteRounds])]
    .sort((a, b) => a - b);
  for (const round of knockoutRounds) {
    scheduleStage(
      bracketMatches.filter(match => (match.bracketRound ?? 1) === round)
    );
    scheduleStage(
      consolanteMatches
        .filter(match => (match.bracketRound ?? 1) === round)
        .filter(isConsolanteMatchSchedulable)
    );
  }

  return assignments;
}

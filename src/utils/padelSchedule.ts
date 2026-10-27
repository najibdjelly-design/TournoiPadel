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
    scheduleStage(consolanteMatches.filter(match => (match.bracketRound ?? 1) === round));
  }

  return assignments;
}

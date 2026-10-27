import React, { useState, useMemo } from 'react';
import { Tournament, Match, Pair, Court, MatchStatus } from '../../types/tournament';
import { formatScore } from '../../utils/padelCalculations';
import {
  compactConsolanteLoserSlots,
  createConflictFreeSchedule,
  isMatchSchedulable,
} from '../../utils/padelSchedule';
import {
  CalendarDays,
  Clock,
  Flame,
  CheckCircle,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Sliders,
  Check,
  CheckCheck,
  HelpCircle,
  Pencil,
  Trash2,
  Repeat,
  X,
  GripVertical,
} from 'lucide-react';

interface ProgrammeModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
  onOpenScoreModal: (match: Match) => void;
}

// Generates time slots based on user customizable duration in minutes
function generateTimeSlots(
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

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export const ProgrammeModule: React.FC<ProgrammeModuleProps> = ({
  tournament,
  onUpdateTournament,
  onOpenScoreModal,
}) => {
  const [selectedCourtId, setSelectedCourtId] = useState<string>('all');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningSlot, setAssigningSlot] = useState<{ courtId: string; time: string } | null>(null);
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);

  // Customizable slot duration in minutes (e.g. 45, 60, 75, 90)
  const [slotDuration, setSlotDuration] = useState<number>(
    tournament.slotDurationMinutes || 75
  );
  const [startTime, setStartTime] = useState<string>(
    tournament.firstMatchTime || '09:00'
  );
  const [showOptimizerPanel, setShowOptimizerPanel] = useState<boolean>(false);
  const [optimizationReport, setOptimizationReport] = useState<string | null>(null);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));

  // Compute time slots based on slot duration in minutes
  const timeSlots = useMemo(() => {
    const scheduledMatches = [
      ...tournament.pools.flatMap(pool => pool.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ].filter(match => match.scheduledTime);
    const startMinutes = timeToMinutes(startTime) ?? 9 * 60;
    const lastScheduledSlot = scheduledMatches.reduce((lastSlot, match) => {
      const minutes = timeToMinutes(match.scheduledTime!);
      if (minutes === null) return lastSlot;
      return Math.max(lastSlot, Math.floor((minutes - startMinutes) / slotDuration));
    }, -1);
    return generateTimeSlots(startTime, slotDuration, Math.max(10, lastScheduledSlot + 2));
  }, [startTime, slotDuration, tournament]);

  // All tournament matches
  const allMatches: Match[] = useMemo(() => {
    return [
      ...tournament.pools.flatMap(p => p.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ];
  }, [tournament]);

  // Matches not yet scheduled with time or court
  const schedulableMatches = allMatches.filter(isMatchSchedulable);
  const unscheduledMatches = schedulableMatches.filter(m => !m.scheduledTime || !m.courtId);

  // Save slot duration / start time in tournament
  const handleUpdateDurationSettings = (newDuration: number, newStart: string) => {
    setSlotDuration(newDuration);
    setStartTime(newStart);
    onUpdateTournament({
      ...tournament,
      slotDurationMinutes: newDuration,
      firstMatchTime: newStart,
    });
  };

  // Status changer for a match
  const handleSetMatchStatus = (matchId: string, status: MatchStatus) => {
    const updateMatchInArray = (arr: Match[]) =>
      arr.map(m => (m.id === matchId ? { ...m, status } : m));

    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(p => ({
        ...p,
        matches: updateMatchInArray(p.matches),
      })),
      bracketMatches: updateMatchInArray(tournament.bracketMatches),
      consolanteMatches: updateMatchInArray(tournament.consolanteMatches),
    });
  };

  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [editingCourtName, setEditingCourtName] = useState<string>('');
  const [courtToDelete, setCourtToDelete] = useState<Court | null>(null);
  const [courtWarningMessage, setCourtWarningMessage] = useState<string | null>(null);
  const [matchToUnassign, setMatchToUnassign] = useState<Match | null>(null);

  // Unassign match from its court and time slot (with in-app modal)
  const handleRequestUnassignMatch = (match: Match) => {
    setMatchToUnassign(match);
  };

  const handleConfirmUnassignMatch = () => {
    if (!matchToUnassign) return;
    const matchId = matchToUnassign.id;

    const updateMatchInArray = (arr: Match[]) =>
      arr.map(m =>
        m.id === matchId ? { ...m, courtId: undefined, scheduledTime: undefined } : m
      );

    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(p => ({
        ...p,
        matches: updateMatchInArray(p.matches),
      })),
      bracketMatches: updateMatchInArray(tournament.bracketMatches),
      consolanteMatches: updateMatchInArray(tournament.consolanteMatches),
    });

    setMatchToUnassign(null);
  };

  const handleUnassignMatchDirect = (matchId: string) => {
    const updateMatchInArray = (arr: Match[]) =>
      arr.map(m =>
        m.id === matchId ? { ...m, courtId: undefined, scheduledTime: undefined } : m
      );

    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(p => ({
        ...p,
        matches: updateMatchInArray(p.matches),
      })),
      bracketMatches: updateMatchInArray(tournament.bracketMatches),
      consolanteMatches: updateMatchInArray(tournament.consolanteMatches),
    });
  };

  // Assign or Replace match in slot
  const handleAssignMatchToSlot = (newMatchId: string) => {
    if (!assigningSlot) return;

    const { courtId, time } = assigningSlot;

    const updateMatchInArray = (arr: Match[]) =>
      arr.map(m => {
        // If another match was already in this slot, release it
        if (m.courtId === courtId && m.scheduledTime === time && m.id !== newMatchId) {
          return { ...m, courtId: undefined, scheduledTime: undefined };
        }
        // Assign target match
        if (m.id === newMatchId) {
          return { ...m, courtId, scheduledTime: time };
        }
        return m;
      });

    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(p => ({
        ...p,
        matches: updateMatchInArray(p.matches),
      })),
      bracketMatches: updateMatchInArray(tournament.bracketMatches),
      consolanteMatches: updateMatchInArray(tournament.consolanteMatches),
    });

    setIsAssignModalOpen(false);
    setAssigningSlot(null);
  };

  const handleMoveMatchToSlot = (matchId: string, courtId: string, time: string) => {
    const sourceMatch = allMatches.find(match => match.id === matchId);
    if (
      !sourceMatch?.courtId ||
      !sourceMatch.scheduledTime ||
      sourceMatch.status === 'in_progress' ||
      sourceMatch.status === 'completed'
    ) {
      return;
    }

    const targetMatch = allMatches.find(
      match => match.courtId === courtId && match.scheduledTime === time
    );
    if (
      targetMatch &&
      (targetMatch.status === 'in_progress' || targetMatch.status === 'completed')
    ) {
      return;
    }

    const updateMatchInArray = (arr: Match[]) =>
      arr.map(match => {
        if (match.id === sourceMatch.id) {
          return { ...match, courtId, scheduledTime: time };
        }
        if (targetMatch && match.id === targetMatch.id) {
          return {
            ...match,
            courtId: sourceMatch.courtId,
            scheduledTime: sourceMatch.scheduledTime,
          };
        }
        return match;
      });

    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(pool => ({
        ...pool,
        matches: updateMatchInArray(pool.matches),
      })),
      bracketMatches: updateMatchInArray(tournament.bracketMatches),
      consolanteMatches: updateMatchInArray(tournament.consolanteMatches),
    });
    setDraggedMatchId(null);
    setDragOverSlotKey(null);
  };

  // Add a new court
  const handleAddCourt = () => {
    const newCourtNum = tournament.courts.length + 1;
    const newCourt: Court = {
      id: `court_${Date.now()}_${newCourtNum}`,
      name: `Terrain ${newCourtNum}`,
      surface: 'indoor',
    };

    onUpdateTournament({
      ...tournament,
      courtsCount: newCourtNum,
      courts: [...tournament.courts, newCourt],
    });
  };

  // Rename a court
  const handleStartRenameCourt = (court: Court) => {
    setEditingCourtId(court.id);
    setEditingCourtName(court.name);
  };

  const handleSaveRenameCourt = (courtId: string) => {
    if (!editingCourtName.trim()) return;
    const updatedCourts = tournament.courts.map(c =>
      c.id === courtId ? { ...c, name: editingCourtName.trim() } : c
    );
    onUpdateTournament({
      ...tournament,
      courts: updatedCourts,
    });
    setEditingCourtId(null);
  };

  // Request Court Deletion (in-app confirmation)
  const handleRequestDeleteCourt = (court: Court) => {
    if (tournament.courts.length <= 1) {
      setCourtWarningMessage('Impossible de supprimer ce terrain : le tournoi doit disposer d’au moins un terrain pour la programmation des matchs.');
      return;
    }
    setCourtToDelete(court);
  };

  // Confirm delete a court and unassign its matches
  const handleConfirmDeleteCourt = () => {
    if (!courtToDelete) return;
    const court = courtToDelete;

    const unassignInArray = (arr: Match[]) =>
      arr.map(m =>
        m.courtId === court.id ? { ...m, courtId: undefined, scheduledTime: undefined } : m
      );

    const updatedCourts = tournament.courts.filter(c => c.id !== court.id);

    onUpdateTournament({
      ...tournament,
      courtsCount: updatedCourts.length,
      courts: updatedCourts,
      pools: tournament.pools.map(p => ({
        ...p,
        matches: unassignInArray(p.matches),
      })),
      bracketMatches: unassignInArray(tournament.bracketMatches),
      consolanteMatches: unassignInArray(tournament.consolanteMatches),
    });

    if (selectedCourtId === court.id) {
      setSelectedCourtId('all');
    }
    setCourtToDelete(null);
  };

  // -------------------------------------------------------------
  // DEPENDENCY CHECKER & OPTIMAL SCHEDULING ALGORITHM
  // -------------------------------------------------------------
  const scheduleDiagnostics = useMemo(() => {
    const warnings: string[] = [];
    const getPhase = (phase: number | undefined) => phase ?? 1;
    const scheduledPools = tournament.pools
      .map(pool => ({
        pool,
        times: pool.matches
          .filter(match => match.scheduledTime)
          .map(match => timeToMinutes(match.scheduledTime!))
          .filter((time): time is number => time !== null),
      }))
      .filter(item => item.times.length > 0);

    const phaseFinishes = new Map<number, number>();
    for (const { pool, times } of scheduledPools) {
      const phase = getPhase(pool.phase);
      phaseFinishes.set(phase, Math.max(phaseFinishes.get(phase) ?? -1, ...times));
    }
    for (let phase = 1; phase < Math.max(0, ...phaseFinishes.keys()); phase++) {
      const previousFinish = phaseFinishes.get(phase);
      const nextStarts = scheduledPools
        .filter(item => getPhase(item.pool.phase) === phase + 1)
        .flatMap(item => item.times);
      if (previousFinish !== undefined && nextStarts.length && Math.min(...nextStarts) <= previousFinish) {
        warnings.push(`Conflit de phase : les matches de la phase ${phase + 1} commencent avant la fin de la phase ${phase}.`);
      }
    }

    const latestPoolFinish = Math.max(-1, ...phaseFinishes.values());
    const scheduledBracketTimes = tournament.bracketMatches
      .filter(match => match.scheduledTime)
      .map(match => timeToMinutes(match.scheduledTime!))
      .filter((time): time is number => time !== null);
    if (latestPoolFinish >= 0 && scheduledBracketTimes.some(time => time <= latestPoolFinish)) {
      warnings.push('Conflit de dépendance : un match du tableau commence avant la fin des poules.');
    }

    const allScheduled = allMatches
      .filter((match): match is Match & { scheduledTime: string; courtId: string } =>
        Boolean(match.scheduledTime && match.courtId)
      )
      .map(match => ({
        match,
        start: timeToMinutes(match.scheduledTime),
        duration: match.durationMinutes ?? slotDuration,
      }))
      .filter((item): item is typeof item & { start: number } => item.start !== null);

    const courtIntervals = new Map<string, typeof allScheduled>();
    for (const item of allScheduled) {
      const intervals = courtIntervals.get(item.match.courtId) ?? [];
      intervals.push(item);
      courtIntervals.set(item.match.courtId, intervals);
    }
    for (const [courtId, intervals] of courtIntervals) {
      intervals.sort((a, b) => a.start - b.start);
      for (let index = 1; index < intervals.length; index++) {
        const previous = intervals[index - 1];
        const current = intervals[index];
        if (current.start < previous.start + previous.duration) {
          const courtName = tournament.courts.find(court => court.id === courtId)?.name ?? courtId;
          warnings.push(`Conflit terrain : ${previous.match.roundName} et ${current.match.roundName} se chevauchent sur ${courtName}.`);
        }
      }
    }

    const pairIntervals = new Map<string, typeof allScheduled>();
    for (const item of allScheduled) {
      for (const pairId of [item.match.pair1Id, item.match.pair2Id]) {
        if (!pairId) continue;
        const intervals = pairIntervals.get(pairId) ?? [];
        intervals.push(item);
        pairIntervals.set(pairId, intervals);
      }
    }
    for (const [pairId, intervals] of pairIntervals) {
      intervals.sort((a, b) => a.start - b.start);
      for (let index = 1; index < intervals.length; index++) {
        const previous = intervals[index - 1];
        const current = intervals[index];
        if (current.start < previous.start + previous.duration) {
          const pair = pairsMap.get(pairId);
          const pairName = pair
            ? `${pair.player1.lastName}/${pair.player2.lastName}`
            : 'Équipe';
          warnings.push(`Chevauchement impossible : ${pairName} est programmée sur plusieurs terrains à la fois.`);
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }, [allMatches, tournament.pools, tournament.bracketMatches, pairsMap, tournament.courts, slotDuration]);

  // Automated Optimal Schedule Generator
  const handleGenerateOptimalSchedule = () => {
    if (tournament.courts.length === 0) {
      alert("Veuillez d'abord ajouter au moins un terrain.");
      return;
    }
    if (timeToMinutes(startTime) === null || slotDuration < 30 || slotDuration > 120) {
      alert('Vérifiez l’heure de début (HH:MM) et choisissez un créneau entre 30 et 120 minutes.');
      return;
    }

    const compactedConsolante = compactConsolanteLoserSlots(
      tournament.bracketMatches,
      tournament.consolanteMatches
    );
    const scheduledMatches = createConflictFreeSchedule(
      tournament.pools,
      compactedConsolante.bracketMatches,
      compactedConsolante.consolanteMatches,
      tournament.courts,
      startTime,
      slotDuration
    );

    const applySchedule = (matches: Match[]) =>
      matches.map(match => {
        const assignment = scheduledMatches.get(match.id);
        if (assignment) {
          return { ...match, courtId: assignment.courtId, scheduledTime: assignment.time };
        }
        return isMatchSchedulable(match)
          ? match
          : { ...match, courtId: undefined, scheduledTime: undefined };
      });
    const updatedPools = tournament.pools.map(pool => ({
      ...pool,
      matches: applySchedule(pool.matches),
    }));
    const updatedBracket = applySchedule(compactedConsolante.bracketMatches);
    const updatedConsolante = applySchedule(compactedConsolante.consolanteMatches);

    onUpdateTournament({
      ...tournament,
      slotDurationMinutes: slotDuration,
      firstMatchTime: startTime,
      pools: updatedPools,
      bracketMatches: updatedBracket,
      consolanteMatches: updatedConsolante,
    });

    const totalScheduled = scheduledMatches.size;
    const endTime = [...scheduledMatches.values()].reduce((latest, assignment) => {
      const minutes = timeToMinutes(assignment.time) ?? -1;
      return minutes > latest.minutes ? { time: assignment.time, minutes } : latest;
    }, { time: startTime, minutes: timeToMinutes(startTime) ?? 0 }).time;
    setOptimizationReport(
      `Succès : ${totalScheduled} matches répartis sur ${tournament.courts.length} terrain(s), de ${startTime} à ${endTime}. Aucun joueur n’est programmé en même temps sur deux terrains.`
    );
    setShowOptimizerPanel(true);
  };

  const qualifyingMatchCount = tournament.pools
    .filter(pool => (pool.phase ?? 1) === 1)
    .reduce((count, pool) => count + pool.matches.length, 0);
  const classificationMatchGroups = tournament.pools
    .filter(pool => (pool.phase ?? 1) > 1)
    .reduce((groups, pool) => {
      const label = pool.classification || pool.name || `Phase ${pool.phase}`;
      groups.set(label, (groups.get(label) ?? 0) + pool.matches.length);
      return groups;
    }, new Map<string, number>());
  const scheduledMatchCount = schedulableMatches.filter(match => match.scheduledTime && match.courtId).length;

  const displayedCourts =
    selectedCourtId === 'all'
      ? tournament.courts
      : tournament.courts.filter(c => c.id === selectedCourtId);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Programme des Matchs & Affectation des Pistes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Créneaux personnalisables en minutes, vérification des dépendances Poules &rarr; Tableau et optimisation anti-attente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Slot Duration & Start Time Form Inputs */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 p-1.5 rounded-lg text-xs shadow-xs">
            <span className="text-slate-600 pl-1 font-medium">Créneau :</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="30"
                max="120"
                step="5"
                value={slotDuration}
                onChange={(e) =>
                  handleUpdateDurationSettings(parseInt(e.target.value) || 75, startTime)
                }
                className="w-14 px-1.5 py-0.5 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-500 font-mono pr-1">min</span>
            </div>

            <span className="text-slate-300">|</span>

            <span className="text-slate-600 pl-1 font-medium">Début :</span>
            <input
              type="text"
              value={startTime}
              onChange={(e) =>
                handleUpdateDurationSettings(slotDuration, e.target.value)
              }
              placeholder="09:00"
              className="w-14 px-1.5 py-0.5 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Optimizer Trigger Button */}
          <button
            onClick={handleGenerateOptimalSchedule}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            title="Génère une proposition optimale respectant l'ordre des poules et minimisant l'attente"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proposition Optimale</span>
          </button>

          {/* Add Court */}
          <button
            onClick={handleAddCourt}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ajouter Terrain</span>
          </button>
        </div>
      </div>

      <section aria-label="Résumé de la programmation" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Terrains disponibles</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{tournament.courts.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Poules qualificatives</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{qualifyingMatchCount} <span className="text-xs font-semibold text-slate-500">matches</span></p>
        </div>
        {[...classificationMatchGroups.entries()].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 shadow-xs">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-amber-800">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-amber-950">{count} <span className="text-xs font-semibold">matches</span></p>
          </div>
        ))}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800">Tableau final</p>
          <p className="mt-1 text-lg font-extrabold text-indigo-950">{tournament.bracketMatches.length} <span className="text-xs font-semibold">matches</span></p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Consolante</p>
          <p className="mt-1 text-lg font-extrabold text-sky-950">{tournament.consolanteMatches.length} <span className="text-xs font-semibold">matches</span></p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Déjà programmés</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-950">{scheduledMatchCount}/{schedulableMatches.length}</p>
        </div>
      </section>

      {/* Optimizer Report / Diagnostic Card */}
      {scheduleDiagnostics.warnings.length > 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Vérification Dépendances : {scheduleDiagnostics.warnings.length} avertissement(s) détecté(s)</span>
            </div>
            <button
              onClick={handleGenerateOptimalSchedule}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px] transition-colors shadow-xs"
            >
              Corriger automatiquement
            </button>
          </div>
          <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-1">
            {scheduleDiagnostics.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Dépendances vérifiées :</strong> L'ordre chronologique des poules et du tableau final est optimal. Zéro conflit détecté.
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-800 font-semibold">
            Créneaux : {slotDuration} min · {timeSlots[0]} à {timeSlots[timeSlots.length - 1]}
          </span>
        </div>
      )}

      {optimizationReport && (
        <div className="p-3 bg-white border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between shadow-xs">
          <span>{optimizationReport}</span>
          <button
            onClick={() => setOptimizationReport(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Unscheduled Match Alert if any */}
      {unscheduledMatches.length > 0 && (
        <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>
              Il reste <strong>{unscheduledMatches.length} match(s)</strong> non planifiés. Cliquez sur &ldquo;Proposition Optimale&rdquo; ou assignez-les manuellement.
            </span>
          </div>
          <button
            onClick={handleGenerateOptimalSchedule}
            className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline font-semibold"
          >
            Planifier tous les matchs &rarr;
          </button>
        </div>
      )}

      {/* Courts Filter Buttons */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs max-w-full overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setSelectedCourtId('all')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
            selectedCourtId === 'all'
              ? 'bg-white text-emerald-700 font-semibold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tous les terrains ({tournament.courts.length})
        </button>
        {tournament.courts.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCourtId(c.id)}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
              selectedCourtId === c.id
                ? 'bg-white text-emerald-700 font-semibold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {c.name.split(' - ')[0]}
          </button>
        ))}
      </div>

      {/* Courts Scheduling Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayedCourts.map((court) => {
          return (
            <div
              key={court.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col space-y-4 shadow-xs"
            >
              {/* Court Header */}
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                {editingCourtId === court.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={editingCourtName}
                      onChange={(e) => setEditingCourtName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRenameCourt(court.id);
                        if (e.key === 'Escape') setEditingCourtId(null);
                      }}
                      autoFocus
                      className="w-full px-2 py-1 text-xs bg-white border border-emerald-500 rounded text-slate-900 font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRenameCourt(court.id)}
                      className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      title="Enregistrer le nom"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCourtId(null)}
                      className="p-1.5 rounded bg-slate-100 text-slate-600 hover:text-slate-900"
                      title="Annuler"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <div>
                      <div className="flex items-center gap-1.5 group">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{court.name}</h3>
                        <button
                          type="button"
                          onClick={() => handleStartRenameCourt(court)}
                          className="opacity-70 hover:opacity-100 p-0.5 text-slate-400 hover:text-emerald-700 transition-opacity"
                          title="Modifier le nom du terrain"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 capitalize font-medium">
                        Piste {court.surface}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRequestDeleteCourt(court)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title={`Supprimer le ${court.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-3 flex-1">
                {timeSlots.map((time) => {
                  const slotKey = `${court.id}:${time}`;
                  const match = allMatches.find(
                    m => m.courtId === court.id && m.scheduledTime === time
                  );

                  const p1 = match?.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                  const p2 = match?.pair2Id ? pairsMap.get(match.pair2Id) : undefined;

                  const isLive = match?.status === 'in_progress';
                  const isFinished = match?.status === 'completed';
                  const isWarmup = match?.status === 'warmup';

                  return (
                    <div
                      key={time}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isLive
                          ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300/60'
                          : isFinished
                          ? 'bg-slate-50 border-slate-200 text-slate-500'
                          : isWarmup
                          ? 'bg-amber-50 border-amber-300'
                          : dragOverSlotKey === slotKey
                          ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                          : match
                          ? 'bg-white border-slate-200 shadow-xs'
                          : 'bg-slate-50/60 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 cursor-pointer'
                      }`}
                      onDragOver={(event) => {
                        if (!draggedMatchId) return;
                        event.preventDefault();
                        setDragOverSlotKey(slotKey);
                      }}
                      onDragLeave={() => setDragOverSlotKey(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const matchId = draggedMatchId || event.dataTransfer.getData('text/plain');
                        if (matchId) handleMoveMatchToSlot(matchId, court.id, time);
                        setDragOverSlotKey(null);
                      }}
                      onClick={() => {
                        if (!match) {
                          setAssigningSlot({ courtId: court.id, time });
                          setIsAssignModalOpen(true);
                        }
                      }}
                    >
                      {/* Slot Header */}
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                        <span className="font-bold text-slate-800">{time}</span>
                        {match ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                isLive
                                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                                  : isFinished
                                  ? 'bg-slate-200 text-slate-700'
                                  : isWarmup
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isLive
                                ? 'En direct'
                                : isFinished
                                ? 'Terminé'
                                : isWarmup
                                ? 'Échauffement'
                                : 'Planifié'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-medium">+ Assigner</span>
                        )}
                      </div>

                      {/* Match Details */}
                      {match ? (
                        <div
                          className={`space-y-1.5 ${
                            !isLive && !isFinished ? 'cursor-grab active:cursor-grabbing' : ''
                          }`}
                          draggable={!isLive && !isFinished}
                          onDragStart={(event) => {
                            if (isLive || isFinished) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.setData('text/plain', match.id);
                            event.dataTransfer.effectAllowed = 'move';
                            setDraggedMatchId(match.id);
                          }}
                          onDragEnd={() => {
                            setDraggedMatchId(null);
                            setDragOverSlotKey(null);
                          }}
                          title={!isLive && !isFinished ? 'Glisser-déposer pour déplacer ce match' : undefined}
                        >
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            {!isLive && !isFinished && <GripVertical className="w-3 h-3 shrink-0" />}
                            {match.roundName}
                          </p>
                          <div className="font-semibold text-slate-900 space-y-0.5">
                            <p className="truncate">
                              {p1
                                ? `${p1.player1.lastName} / ${p1.player2.lastName}`
                                : match.pair1Placeholder}
                            </p>
                            <p className="truncate text-slate-500">
                              vs{' '}
                              {p2
                                ? `${p2.player1.lastName} / ${p2.player2.lastName}`
                                : match.pair2Placeholder}
                            </p>
                          </div>

                          {match.score && (
                            <p className="font-mono text-emerald-700 font-bold text-xs pt-1">
                              {formatScore(match.score)}
                            </p>
                          )}

                          {/* Quick Controls */}
                          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[10px] gap-1 flex-wrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              {!isLive && !isFinished && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetMatchStatus(match.id, 'in_progress');
                                  }}
                                  className="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded font-medium flex items-center gap-1"
                                  title="Démarrer le match en direct"
                                >
                                  <Play className="w-2.5 h-2.5" /> Lancer
                                </button>
                              )}
                              {isLive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetMatchStatus(match.id, 'completed');
                                  }}
                                  className="px-2 py-0.5 bg-slate-200 text-slate-800 hover:bg-slate-300 rounded font-medium flex items-center gap-1"
                                >
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600" /> Clôturer
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningSlot({ courtId: court.id, time });
                                  setIsAssignModalOpen(true);
                                }}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium flex items-center gap-1"
                                title="Remplacer par un autre match"
                              >
                                <Repeat className="w-2.5 h-2.5" /> Remplacer
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestUnassignMatch(match);
                                }}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium flex items-center gap-0.5"
                                title="Retirer ce match du créneau"
                              >
                                <X className="w-2.5 h-2.5" /> Retirer
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenScoreModal(match);
                              }}
                              className="text-emerald-700 hover:text-emerald-800 hover:underline font-bold"
                            >
                              Score &rarr;
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic py-1">Piste libre</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Match Modal */}
      {isAssignModalOpen && assigningSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Affecter un match</h3>
                <p className="text-xs text-slate-500">
                  Créneau : {assigningSlot.time} ({slotDuration} min) · Piste {tournament.courts.find(c => c.id === assigningSlot.courtId)?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssigningSlot(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 text-base leading-none"
              >
                &times;
              </button>
            </div>
            {/* If slot already occupied */}
            {(() => {
              const occupying = allMatches.find(
                m => m.courtId === assigningSlot.courtId && m.scheduledTime === assigningSlot.time
              );
              if (!occupying) return null;
              const occP1 = occupying.pair1Id ? pairsMap.get(occupying.pair1Id) : undefined;
              const occP2 = occupying.pair2Id ? pairsMap.get(occupying.pair2Id) : undefined;
              return (
                <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-amber-900 block">Match actuellement sur ce créneau :</span>
                    <p className="text-slate-800 text-xs truncate">
                      {occupying.roundName} ({occP1 ? `${occP1.player1.lastName}/${occP1.player2.lastName}` : occupying.pair1Placeholder} vs {occP2 ? `${occP2.player1.lastName}/${occP2.player2.lastName}` : occupying.pair2Placeholder})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleUnassignMatchDirect(occupying.id);
                      setIsAssignModalOpen(false);
                      setAssigningSlot(null);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shrink-0 shadow-xs"
                  >
                    Vider ce créneau
                  </button>
                </div>
              );
            })()}

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {allMatches.map((m) => {
                const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;

                return (
                  <button
                    key={m.id}
                    onClick={() => handleAssignMatchToSlot(m.id)}
                    className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 transition-all text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-semibold text-slate-800">{m.roundName}</span>
                      <span className="font-mono text-[10px]">Match #{m.matchNumber}</span>
                    </div>
                    <p className="font-medium text-slate-900 truncate">
                      {p1 ? `${p1.player1.lastName} / ${p1.player2.lastName}` : m.pair1Placeholder} vs{' '}
                      {p2 ? `${p2.player1.lastName} / ${p2.player2.lastName}` : m.pair2Placeholder}
                    </p>
                    {m.scheduledTime && (
                      <p className="text-[10px] text-amber-700 font-medium">
                        Déjà programmé à {m.scheduledTime}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal: Delete Court */}
      {courtToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Supprimer le {courtToDelete.name} ?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer définitivement ce terrain du tournoi ?
                </p>
                {(() => {
                  const affectedCount = allMatches.filter(m => m.courtId === courtToDelete.id).length;
                  if (affectedCount > 0) {
                    return (
                      <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs leading-relaxed">
                        <span className="font-bold text-amber-800">Attention : {affectedCount} match(s)</span> actuellement programmés sur ce terrain seront automatiquement désassignés et remis dans la liste des matchs à planifier. Aucun match ni score ne sera supprimé.
                      </div>
                    );
                  }
                  return (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Aucun match n&apos;est actuellement programmé sur ce terrain.
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCourtToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourt}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal: Cannot delete last remaining court */}
      {courtWarningMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Suppression non autorisée
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {courtWarningMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCourtWarningMessage(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Unassign match */}
      {matchToUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Retirer de la programmation ?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Êtes-vous sûr de vouloir retirer le match <strong>{matchToUnassign.roundName} (#{matchToUnassign.matchNumber})</strong> de son créneau ?
                  Il sera remis dans la file d&apos;attente des matchs non planifiés.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMatchToUnassign(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmUnassignMatch}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Retirer du créneau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

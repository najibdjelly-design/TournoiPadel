import React, { useState, useMemo } from 'react';
import { Tournament, Match, Pair, Pool } from '../../types/tournament';
import { formatScore, generateTimeSlots, computeCompleteFinalStandings } from '../../utils/padelCalculations';
import { PairPoolHistoryModal } from '../modals/PairPoolHistoryModal';
import {
  Flame,
  Search,
  Maximize2,
  Calendar,
  Grid3X3,
  GitBranch,
  Trophy,
  Radio,
  History,
  LayoutGrid,
  List,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface PublicLiveModuleProps {
  tournament: Tournament;
  onExitPublic?: () => void;
}

export const PublicLiveModule: React.FC<PublicLiveModuleProps> = ({
  tournament,
  onExitPublic,
}) => {
  const [activeTab, setActiveTab] = useState<'courts' | 'schedule' | 'pools' | 'bracket'>('courts');
  const [searchPlayer, setSearchPlayer] = useState('');
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'list'>('grid');
  const [bracketSubTab, setBracketSubTab] = useState<'main' | 'consolante' | 'standings'>('main');

  // Pair history modal
  const [selectedPairHistory, setSelectedPairHistory] = useState<Pair | null>(null);
  const [selectedPoolForHistory, setSelectedPoolForHistory] = useState<Pool | undefined>(undefined);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));

  const allMatches: Match[] = useMemo(() => {
    return [
      ...tournament.pools.flatMap(p => p.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ];
  }, [tournament]);

  // Generate standardized time slots
  const timeSlots = useMemo(() => {
    return generateTimeSlots(
      tournament.firstMatchTime || '09:00',
      tournament.slotDurationMinutes || 75,
      10
    );
  }, [tournament.firstMatchTime, tournament.slotDurationMinutes]);

  const liveMatches = allMatches.filter(m => m.status === 'in_progress');
  const upcomingMatches = allMatches.filter(m => m.status === 'scheduled');
  const finishedMatches = allMatches.filter(m => m.status === 'completed');

  // Strictly filter bracket matches
  const mainBracketMatches = useMemo(() => {
    return tournament.bracketMatches.filter(m => m.type !== 'consolante');
  }, [tournament.bracketMatches]);

  const consolanteMatches = useMemo(() => {
    return tournament.consolanteMatches.filter(m => m.type === 'consolante');
  }, [tournament.consolanteMatches]);

  // Group bracket matches by round
  const activeBracketMatches = bracketSubTab === 'main' ? mainBracketMatches : consolanteMatches;
  const bracketRoundsMap = useMemo(() => {
    const map = new Map<number, Match[]>();
    activeBracketMatches.forEach(m => {
      const r = m.bracketRound || 1;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return map;
  }, [activeBracketMatches]);

  const sortedRoundNumbers = Array.from(bracketRoundsMap.keys()).sort((a, b) => a - b);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Search filtered matches
  const playerFilteredMatches = searchPlayer.trim()
    ? allMatches.filter((m) => {
        const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
        const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
        const q = searchPlayer.toLowerCase();
        return (
          p1?.player1.lastName.toLowerCase().includes(q) ||
          p1?.player2.lastName.toLowerCase().includes(q) ||
          p2?.player1.lastName.toLowerCase().includes(q) ||
          p2?.player2.lastName.toLowerCase().includes(q)
        );
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Public Header Banner */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="font-mono text-emerald-700 font-bold">LIVE SCORE & TOURNOI</span>
            <span>·</span>
            <span className="text-slate-900 font-semibold">{tournament.category} {tournament.gender}</span>
            <span>·</span>
            <span>{tournament.club}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{tournament.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Multi-screen live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-mono font-medium shadow-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
            <span>Mise à jour instantanée</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors font-medium shadow-xs"
            title="Activer mode plein écran TV"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Plein Écran TV</span>
          </button>
        </div>
      </div>

      {/* Quick Player Match Finder Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-emerald-600 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Joueur : tapez votre nom pour trouver immédiatement vos matchs et votre piste..."
          value={searchPlayer}
          onChange={(e) => setSearchPlayer(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
        />
        {searchPlayer && (
          <button
            onClick={() => setSearchPlayer('')}
            className="absolute right-4 top-3 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Effacer
          </button>
        )}
      </div>

      {/* If Player searched */}
      {playerFilteredMatches && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Résultats pour &ldquo;{searchPlayer}&rdquo; ({playerFilteredMatches.length} match(s))
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playerFilteredMatches.map((m) => {
              const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
              const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
              const court = tournament.courts.find(c => c.id === m.courtId);

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">{m.roundName}</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {court ? court.name : 'Piste à confirmer'} · {m.scheduledTime || 'Horaire à confirmer'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    <span
                      onClick={() => p1 && setSelectedPairHistory(p1)}
                      className={p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                    >
                      {p1 ? `${p1.player1.lastName}/${p1.player2.lastName}` : m.pair1Placeholder}
                    </span>{' '}
                    vs{' '}
                    <span
                      onClick={() => p2 && setSelectedPairHistory(p2)}
                      className={p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                    >
                      {p2 ? `${p2.player1.lastName}/${p2.player2.lastName}` : m.pair2Placeholder}
                    </span>
                  </p>
                  {m.score && (
                    <p className="font-mono text-emerald-700 font-bold">
                      Score : {formatScore(m.score)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation tabs for spectator */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium max-w-full overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('courts')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'courts'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Sur les Terrains ({tournament.courts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'schedule'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Programmation des Matchs</span>
        </button>

        <button
          onClick={() => setActiveTab('pools')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'pools'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Poules & Classements ({tournament.pools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bracket')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'bracket'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Tableau Final & Consolante</span>
        </button>
      </div>

      {/* Tab 1: Live Courts */}
      {activeTab === 'courts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tournament.courts.map((court) => {
            const activeMatch = allMatches.find(m => m.courtId === court.id && m.status === 'in_progress');
            const nextMatch = allMatches.find(m => m.courtId === court.id && m.status === 'scheduled');

            const p1 = activeMatch?.pair1Id ? pairsMap.get(activeMatch.pair1Id) : undefined;
            const p2 = activeMatch?.pair2Id ? pairsMap.get(activeMatch.pair2Id) : undefined;

            return (
              <div
                key={court.id}
                className={`p-5 rounded-2xl border transition-all shadow-xs ${
                  activeMatch
                    ? 'bg-white border-emerald-400 shadow-sm ring-1 ring-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">{court.name}</h3>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                      activeMatch
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeMatch ? 'EN DIRECT' : 'DISPONIBLE'}
                  </span>
                </div>

                {activeMatch ? (
                  <div className="space-y-3">
                    <span className="text-xs text-slate-500 font-mono block">
                      {activeMatch.roundName} · Début {activeMatch.scheduledTime}
                    </span>

                    {/* Team 1 */}
                    <div className="flex items-center justify-between text-sm">
                      <span
                        onClick={() => p1 && setSelectedPairHistory(p1)}
                        className={`font-bold text-slate-900 truncate ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                      >
                        {p1 ? `${p1.player1.lastName} / ${p1.player2.lastName}` : activeMatch.pair1Placeholder}
                      </span>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-between text-sm">
                      <span
                        onClick={() => p2 && setSelectedPairHistory(p2)}
                        className={`font-bold text-slate-900 truncate ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                      >
                        {p2 ? `${p2.player1.lastName} / ${p2.player2.lastName}` : activeMatch.pair2Placeholder}
                      </span>
                    </div>

                    {/* Score display */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Score en direct :</span>
                      <span className="font-mono font-bold text-base text-emerald-700 tabular-nums">
                        {formatScore(activeMatch.score)}
                      </span>
                    </div>
                  </div>
                ) : nextMatch ? (
                  <div className="py-4 text-center space-y-1">
                    <span className="text-xs text-slate-400 uppercase font-mono font-medium">Prochain match</span>
                    <p className="font-mono text-sm font-bold text-emerald-700">{nextMatch.scheduledTime}</p>
                    <p className="text-xs text-slate-700 font-medium truncate">{nextMatch.roundName}</p>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Piste libre pour échauffement
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Programming / Schedule (Tableau par Terrain + Liste) */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Schedule view toggle & info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Programmation par terrain ({tournament.courts.length} pistes)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Créneau de {tournament.slotDurationMinutes || 75} minutes par rencontre · Cliquez sur les noms pour voir les historiques
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScheduleViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  scheduleViewMode === 'grid'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tableau par Terrain</span>
              </button>
              <button
                type="button"
                onClick={() => setScheduleViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  scheduleViewMode === 'list'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste Chronologique</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: Grid Table by Court */}
          {scheduleViewMode === 'grid' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-3 px-4 text-left font-mono font-bold text-emerald-800 uppercase tracking-wider w-24">
                        Horaire
                      </th>
                      {tournament.courts.map(court => (
                        <th key={court.id} className="py-3 px-4 text-left font-bold text-slate-900 border-l border-slate-200">
                          <div className="flex items-center justify-between">
                            <span>{court.name}</span>
                            <span className="text-[10px] font-normal text-slate-500 capitalize">
                              {court.surface}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {timeSlots.map(time => (
                      <tr key={time} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 align-top bg-slate-50/50 border-r border-slate-200">
                          <span className="inline-block px-2 py-1 rounded bg-slate-100 text-emerald-800">
                            {time}
                          </span>
                        </td>
                        {tournament.courts.map(court => {
                          const match = allMatches.find(
                            m => m.courtId === court.id && m.scheduledTime === time
                          );
                          const p1 = match?.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                          const p2 = match?.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                          const isLive = match?.status === 'in_progress';
                          const isFinished = match?.status === 'completed';

                          return (
                            <td
                              key={court.id}
                              className="py-2.5 px-3 border-l border-slate-100 align-top"
                            >
                              {match ? (
                                <div
                                  className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                                    isLive
                                      ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-1 ring-emerald-300/60'
                                      : isFinished
                                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-semibold text-slate-500 truncate">
                                      {match.roundName}
                                    </span>
                                    {isLive && (
                                      <span className="font-mono font-bold text-emerald-700 animate-pulse flex items-center gap-1">
                                        <Radio className="w-2.5 h-2.5" /> LIVE
                                      </span>
                                    )}
                                    {isFinished && (
                                      <span className="font-mono text-slate-400">Terminé</span>
                                    )}
                                  </div>

                                  <div className="font-semibold space-y-0.5">
                                    <p
                                      onClick={() => p1 && setSelectedPairHistory(p1)}
                                      className={`truncate ${
                                        match.winnerPairId === match.pair1Id
                                          ? 'text-slate-900 font-bold'
                                          : 'text-slate-700'
                                      } ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                      title={p1 ? "Cliquer pour voir l'historique" : undefined}
                                    >
                                      {p1
                                        ? `${p1.player1.lastName} / ${p1.player2.lastName}`
                                        : match.pair1Placeholder}
                                    </p>
                                    <p
                                      onClick={() => p2 && setSelectedPairHistory(p2)}
                                      className={`truncate ${
                                        match.winnerPairId === match.pair2Id
                                          ? 'text-slate-900 font-bold'
                                          : 'text-slate-500'
                                      } ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                      title={p2 ? "Cliquer pour voir l'historique" : undefined}
                                    >
                                      vs{' '}
                                      {p2
                                        ? `${p2.player1.lastName} / ${p2.player2.lastName}`
                                        : match.pair2Placeholder}
                                    </p>
                                  </div>

                                  {match.score && (
                                    <div className="pt-1 border-t border-slate-100 font-mono font-bold text-[11px] text-emerald-700">
                                      {formatScore(match.score)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400 italic">
                                  Piste libre
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: Chronological List */}
          {scheduleViewMode === 'list' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-xs">
              {upcomingMatches.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Aucun match à venir programmé.
                </div>
              ) : (
                upcomingMatches.map((m) => {
                  const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                  const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
                  const court = tournament.courts.find(c => c.id === m.courtId);

                  return (
                    <div key={m.id} className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm font-bold text-emerald-700 w-16">
                          {m.scheduledTime || 'À suivre'}
                        </span>
                        <div>
                          <span className="text-slate-500 text-[11px] block">{m.roundName}</span>
                          <div className="font-semibold text-slate-900 text-sm">
                            <span
                              onClick={() => p1 && setSelectedPairHistory(p1)}
                              className={p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                            >
                              {p1 ? `${p1.player1.lastName} / ${p1.player2.lastName}` : m.pair1Placeholder}
                            </span>{' '}
                            vs{' '}
                            <span
                              onClick={() => p2 && setSelectedPairHistory(p2)}
                              className={p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                            >
                              {p2 ? `${p2.player1.lastName} / ${p2.player2.lastName}` : m.pair2Placeholder}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-slate-700 font-medium">
                        {court ? court.name : 'Terrain à confirmer'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pools */}
      {activeTab === 'pools' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tournament.pools.map((pool) => (
            <div key={pool.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{pool.name}</h3>
                  <span className="text-[11px] text-slate-500">
                    Cliquez sur une équipe pour voir son historique des matchs et scores
                  </span>
                </div>
                <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Top {pool.qualifiedCount} qualifié(s)
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-2 text-center">Rg</th>
                    <th className="py-2.5 px-2">Équipe</th>
                    <th className="py-2.5 px-2 text-center">Pts</th>
                    <th className="py-2.5 px-2 text-center">V/D</th>
                    <th className="py-2.5 px-2 text-center">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pool.standings.map((st, idx) => {
                    const pair = pairsMap.get(st.pairId);
                    const isQualif = idx < pool.qualifiedCount;

                    return (
                      <tr
                        key={st.pairId}
                        className={`transition-colors cursor-pointer hover:bg-slate-50 ${
                          isQualif ? 'bg-emerald-50/40' : ''
                        }`}
                        onClick={() => {
                          if (pair) {
                            setSelectedPairHistory(pair);
                            setSelectedPoolForHistory(pool);
                          }
                        }}
                      >
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5 group">
                            <span className="group-hover:text-emerald-700 group-hover:underline">
                              {pair
                                ? `${pair.player1.lastName} / ${pair.player2.lastName}`
                                : 'Paire'}
                            </span>
                            <History className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-emerald-700" />
                            {isQualif && (
                              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-semibold rounded">
                                Qualifié
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">
                          {st.points}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                          {st.won}/{st.lost}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                          {st.setDiff > 0 ? `+${st.setDiff}` : st.setDiff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Bracket (Strict separation of Main and Consolante) */}
      {activeTab === 'bracket' && (
        <div className="space-y-4">
          {/* Sub-tabs: Tableau Principal vs Tableau Consolante */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs max-w-full overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => setBracketSubTab('main')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                bracketSubTab === 'main'
                  ? 'bg-white text-emerald-800 border border-slate-200 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Tableau Principal ({mainBracketMatches.length} m.)</span>
            </button>

            {consolanteMatches.length > 0 && (
              <button
                type="button"
                onClick={() => setBracketSubTab('consolante')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                  bracketSubTab === 'consolante'
                    ? 'bg-white text-amber-800 border border-slate-200 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Matchs de Classement ({consolanteMatches.length} m.)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBracketSubTab('standings')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                bracketSubTab === 'standings'
                  ? 'bg-white text-indigo-800 border border-slate-200 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>Classement Général</span>
            </button>
          </div>

          {bracketSubTab === 'standings' ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 w-16 text-center">Rang</th>
                      <th className="py-3 px-4">Équipe</th>
                      <th className="py-3 px-4 hidden md:table-cell">Club</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {computeCompleteFinalStandings(tournament).map((item) => {
                      const pair = item.pairId ? pairsMap.get(item.pairId) : undefined;
                      const isPodium = item.rank <= 3;

                      return (
                        <tr
                          key={item.rank}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isPodium ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-black text-sm text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono ${
                                item.rank === 1
                                  ? 'bg-amber-400 text-amber-950 shadow-xs'
                                  : item.rank === 2
                                  ? 'bg-slate-300 text-slate-900'
                                  : item.rank === 3
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {pair ? (
                              <span>
                                {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">En attente de résultat</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 hidden md:table-cell font-medium">
                            {pair ? pair.player1.club : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {item.status === 'confirmed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Confirmé</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">En attente</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs hidden sm:table-cell">
                            {item.detail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Swipe Hint */}
              {activeBracketMatches.length > 0 && (
                <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                  <span>👈 Glissez horizontalement pour naviguer entre les tours 👉</span>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 overflow-x-auto touch-pan-x shadow-xs">
            {activeBracketMatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Aucun match dans ce tableau pour le moment.
              </div>
            ) : (
              <div className="flex items-stretch gap-6 min-w-[700px]">
                {sortedRoundNumbers.map((roundNum) => {
                  const roundMatches = bracketRoundsMap.get(roundNum) || [];
                  const sampleMatch = roundMatches[0];

                  return (
                    <div key={roundNum} className="flex-1 min-w-[220px] flex flex-col space-y-3">
                      <div className="text-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">
                          {sampleMatch?.roundName.split(' #')[0] || `Tour ${roundNum}`}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {roundMatches.length} rencontre(s)
                        </span>
                      </div>

                      <div className="flex flex-col justify-around flex-1 space-y-4">
                        {roundMatches.map((m) => {
                          const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                          const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;

                          return (
                            <div
                              key={m.id}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 hover:border-slate-300 transition-colors shadow-xs"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Match #{m.matchNumber}</span>
                                {m.scheduledTime && (
                                  <span className="text-emerald-700 font-bold">{m.scheduledTime}</span>
                                )}
                              </div>

                              {/* Team 1 */}
                              <div
                                onClick={() => p1 && setSelectedPairHistory(p1)}
                                className={`p-2 rounded-lg flex items-center justify-between transition-colors ${
                                  m.winnerPairId === m.pair1Id
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200'
                                    : 'text-slate-800'
                                } ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                title={p1 ? "Cliquer pour voir l'historique" : undefined}
                              >
                                <span className="truncate">
                                  {p1 ? `${p1.player1.lastName} / ${p1.player2.lastName}` : m.pair1Placeholder || 'Position 1'}
                                </span>
                                {m.winnerPairId === m.pair1Id && (
                                  <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                )}
                              </div>

                              {/* Team 2 */}
                              <div
                                onClick={() => p2 && setSelectedPairHistory(p2)}
                                className={`p-2 rounded-lg flex items-center justify-between transition-colors ${
                                  m.winnerPairId === m.pair2Id
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200'
                                    : 'text-slate-800'
                                } ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                title={p2 ? "Cliquer pour voir l'historique" : undefined}
                              >
                                <span className="truncate">
                                  {p2 ? `${p2.player1.lastName} / ${p2.player2.lastName}` : m.pair2Placeholder || 'Position 2'}
                                </span>
                                {m.winnerPairId === m.pair2Id && (
                                  <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                )}
                              </div>

                              {/* Score */}
                              {m.score && (
                                <div className="text-center pt-1.5 border-t border-slate-200 font-mono font-bold text-emerald-700 text-xs">
                                  {formatScore(m.score)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )}

      {/* Modal Match History for Pair */}
      <PairPoolHistoryModal
        isOpen={Boolean(selectedPairHistory)}
        pair={selectedPairHistory}
        pool={selectedPoolForHistory}
        allMatches={allMatches}
        allPairs={tournament.pairs}
        onClose={() => {
          setSelectedPairHistory(null);
          setSelectedPoolForHistory(undefined);
        }}
      />
    </div>
  );
};

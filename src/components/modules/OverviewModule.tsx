import React from 'react';
import { Tournament, Match, Pair } from '../../types/tournament';
import { NavigationModule } from '../Sidebar';
import {
  Users,
  Grid3X3,
  GitBranch,
  Calendar,
  CreditCard,
  Send,
  Trophy,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { formatScore } from '../../utils/padelCalculations';

interface OverviewModuleProps {
  tournament: Tournament;
  onNavigate: (module: NavigationModule) => void;
  onOpenScoreModal: (match: Match) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  tournament,
  onNavigate,
  onOpenScoreModal,
}) => {
  const pairsCount = tournament.pairs.length;
  const confirmedPairs = tournament.pairs.filter(p => p.status === 'confirmed');
  const allMatches: Match[] = [
    ...tournament.pools.flatMap(p => p.matches),
    ...tournament.bracketMatches,
    ...tournament.consolanteMatches,
  ];

  const completedMatches = allMatches.filter(m => m.status === 'completed');
  const inProgressMatches = allMatches.filter(m => m.status === 'in_progress');

  // Finances
  const totalExpected = tournament.entryFee * (pairsCount * 2);
  const totalCollected = tournament.pairs
    .flatMap(p => [p.player1, p.player2])
    .filter(pl => pl.paymentStatus === 'paid')
    .reduce((acc, pl) => acc + (pl.paidAmount || tournament.entryFee), 0);

  const checkedInCount = tournament.pairs
    .flatMap(p => [p.player1, p.player2])
    .filter(pl => pl.isPresent).length;

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Page Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="text-emerald-700 font-semibold">{tournament.category} {tournament.gender}</span>
            <span>·</span>
            <span>{tournament.club}</span>
            <span>·</span>
            <span>{tournament.matchFormat}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tournament.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md font-mono font-medium">
            Statut : {tournament.status === 'in_progress' ? 'En cours' : tournament.status === 'completed' ? 'Terminé' : 'En préparation'}
          </span>
          <button
            onClick={() => onNavigate('public')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-xs"
          >
            <span>Ouvrir Écran TV Live</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Inscriptions */}
        <div
          onClick={() => onNavigate('inscriptions')}
          className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Inscriptions & Paires</span>
            <Users className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {confirmedPairs.length}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {tournament.maxPairs} paires</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (confirmedPairs.length / tournament.maxPairs) * 100)}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {checkedInCount} / {pairsCount * 2} joueurs émargés
          </p>
        </div>

        {/* KPI 2: Matchs joués */}
        <div
          onClick={() => onNavigate('programme')}
          className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Progression Matchs</span>
            <Calendar className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {completedMatches.length}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {allMatches.length} matchs</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-600 h-full rounded-full transition-all"
              style={{
                width: allMatches.length > 0 ? `${(completedMatches.length / allMatches.length) * 100}%` : '0%',
              }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {inProgressMatches.length} match(s) en cours en direct
          </p>
        </div>

        {/* KPI 3: Poules & Tableau */}
        <div
          onClick={() => onNavigate('tableau')}
          className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tableau Final</span>
            <GitBranch className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {tournament.bracketMatches.length}
            </span>
            <span className="text-xs text-slate-500">rencontres KO</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 truncate font-medium">
            {tournament.pools.length} poules qualificatives actives
          </p>
        </div>

        {/* KPI 4: Caisse & Émargement */}
        <div
          onClick={() => onNavigate('caisse')}
          className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Caisse & Recettes</span>
            <CreditCard className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
              {totalCollected} €
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {totalExpected} €</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all"
              style={{
                width: totalExpected > 0 ? `${(totalCollected / totalExpected) * 100}%` : '0%',
              }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Reste à encaisser : {totalExpected - totalCollected} €
          </p>
        </div>
      </div>

      {/* Courts Live Status Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Disponibilité des Terrains & Direct</h2>
          </div>
          <button
            onClick={() => onNavigate('programme')}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold transition-colors"
          >
            Gérer la programmation &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {tournament.courts.map((court) => {
            const activeMatch = allMatches.find(m => m.courtId === court.id && m.status === 'in_progress');
            const nextMatch = allMatches.find(m => m.courtId === court.id && m.status === 'scheduled');

            const p1 = activeMatch?.pair1Id ? pairsMap.get(activeMatch.pair1Id) : undefined;
            const p2 = activeMatch?.pair2Id ? pairsMap.get(activeMatch.pair2Id) : undefined;

            return (
              <div
                key={court.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  activeMatch
                    ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300/50'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-900">{court.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                      activeMatch
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {activeMatch ? 'EN DIRECT' : 'LIBRE'}
                  </span>
                </div>

                {activeMatch ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : activeMatch.pair1Placeholder} vs{' '}
                      {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : activeMatch.pair2Placeholder}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-700 font-bold tabular-nums">
                        {formatScore(activeMatch.score)}
                      </span>
                      <button
                        onClick={() => onOpenScoreModal(activeMatch)}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold"
                      >
                        Score
                      </button>
                    </div>
                  </div>
                ) : nextMatch ? (
                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Prochain : </span>
                    <span className="font-mono text-slate-800 font-medium">{nextMatch.scheduledTime || 'À suivre'}</span>
                    <p className="truncate text-[11px] text-slate-500 mt-0.5">{nextMatch.roundName}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucun match programmé</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: Quick Actions & Live Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launchpad Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">Actions Directes Juge-Arbitre</h2>
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('inscriptions')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Calculer les Poids de Paires & Têtes de Série</p>
                  <p className="text-[11px] text-slate-500">Classer les équipes par somme des classements</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate('poules')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Grid3X3 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Tirage & Gestion des Poules</p>
                  <p className="text-[11px] text-slate-500">3 méthodes : Serpentin, Rang ou Manuel</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate('convocations')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Convocations WhatsApp & SMS</p>
                  <p className="text-[11px] text-slate-500">Envoyer les horaires et terrains en 1 clic</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate('caisse')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Émargement & Caisse Tournoi</p>
                  <p className="text-[11px] text-slate-500">Pointer la présence et encaisser les droits</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* Recent Results / Matches Stream */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Derniers Matchs & Scores Validés</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {completedMatches.length} match(s) terminé(s)
            </span>
          </div>

          {completedMatches.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-xs font-medium">Aucun match terminé pour le moment.</p>
              <p className="text-[11px] mt-1 text-slate-400">Les scores validés apparaîtront ici en direct.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {completedMatches.slice(-5).reverse().map((m) => {
                const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
                const winnerIs1 = m.winnerPairId === m.pair1Id;
                const winnerIs2 = m.winnerPairId === m.pair2Id;

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-1">
                        <span className="font-medium">{m.roundName}</span>
                        <span>·</span>
                        <span>Match #{m.matchNumber}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className={`flex items-center gap-1.5 ${winnerIs1 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {winnerIs1 && <Trophy className="w-3 h-3 text-emerald-600 shrink-0" />}
                          <span className="truncate">
                            {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : m.pair1Placeholder}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${winnerIs2 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {winnerIs2 && <Trophy className="w-3 h-3 text-emerald-600 shrink-0" />}
                          <span className="truncate">
                            {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : m.pair2Placeholder}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                        {formatScore(m.score)}
                      </div>
                      <button
                        onClick={() => onOpenScoreModal(m)}
                        className="text-[10px] text-slate-500 hover:text-emerald-700 hover:underline mt-1 block font-medium"
                      >
                        Modifier score
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

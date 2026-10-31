import React from 'react';
import { Tournament } from '../types/tournament';
import {
  LayoutDashboard,
  Users,
  Grid3X3,
  GitBranch,
  CalendarDays,
  Send,
  CreditCard,
  Tv,
  X,
  Layers,
  Play,
} from 'lucide-react';

export type NavigationModule =
  | 'overview'
  | 'inscriptions'
  | 'poules'
  | 'tableau'
  | 'programme'
  | 'matchs'
  | 'convocations'
  | 'caisse'
  | 'public';

interface SidebarProps {
  currentModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  tournament?: Tournament;
  onOpenTournamentsManager?: () => void;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  tournament,
  onOpenTournamentsManager,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
}) => {
  const confirmedPairsCount = tournament?.pairs.filter(p => p.status === 'confirmed').length || 0;
  const poolsCount = tournament?.pools.length || 0;
  const bracketMatchesCount = tournament?.bracketMatches.length || 0;
  const scheduledMatchesCount =
    (tournament?.pools.flatMap(p => p.matches).length || 0) +
    (tournament?.bracketMatches.length || 0);
  const liveMatchesCount = tournament
    ? [
        ...tournament.pools.flatMap(p => p.matches),
        ...tournament.bracketMatches,
        ...tournament.consolanteMatches,
      ].filter(m => m.status === 'in_progress').length
    : 0;
  const pendingConvocationsCount =
    tournament?.convocations.filter(c => c.status === 'ready').length || 0;
  const unpaidPlayersCount =
    tournament?.pairs
      .flatMap(p => [p.player1, p.player2])
      .filter(pl => pl.paymentStatus === 'pending').length || 0;

  const navItems: {
    id: NavigationModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number | string;
    alert?: boolean;
  }[] = [
    {
      id: 'overview',
      label: "Vue d'ensemble",
      icon: LayoutDashboard,
    },
    {
      id: 'inscriptions',
      label: 'Inscriptions & Paires (24 éq.)',
      icon: Users,
      count: confirmedPairsCount,
    },
    {
      id: 'poules',
      label: 'Poules (3 méthodes)',
      icon: Grid3X3,
      count: poolsCount > 0 ? `${poolsCount} poules` : undefined,
    },
    {
      id: 'tableau',
      label: 'Tableau & Consolante Auto',
      icon: GitBranch,
      count: bracketMatchesCount > 0 ? `${bracketMatchesCount} m.` : undefined,
    },
    {
      id: 'programme',
      label: 'Programme & Terrains',
      icon: CalendarDays,
      count: scheduledMatchesCount > 0 ? `${scheduledMatchesCount} m.` : undefined,
    },
    {
      id: 'matchs',
      label: 'Matchs (lancer & scores)',
      icon: Play,
      count: liveMatchesCount > 0 ? `${liveMatchesCount} live` : undefined,
      alert: liveMatchesCount > 0,
    },
    {
      id: 'convocations',
      label: 'Convocations (WhatsApp)',
      icon: Send,
      count: pendingConvocationsCount > 0 ? pendingConvocationsCount : undefined,
      alert: pendingConvocationsCount > 0,
    },
    {
      id: 'caisse',
      label: 'Caisse & Émargement',
      icon: CreditCard,
      count: unpaidPlayersCount > 0 ? `${unpaidPlayersCount} att.` : 'À jour',
      alert: unpaidPlayersCount > 0,
    },
    {
      id: 'public',
      label: 'Écran Public (Live TV)',
      icon: Tv,
    },
  ];

  const handleItemClick = (id: NavigationModule) => {
    onSelectModule(id);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const renderContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white text-slate-800">
      {/* Tournament Info */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        {isMobile && (
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200">
            <span className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">Navigation & Modules</span>
            <button
              onClick={onCloseMobileDrawer}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {tournament ? (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-semibold">
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                {tournament.category} {tournament.gender}
              </span>
              <span>{tournament.dates.start}</span>
            </div>
            <h2 className="text-sm font-extrabold text-slate-900 truncate" title={tournament.name}>
              {tournament.name}
            </h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {tournament.club} · {tournament.city}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Aucun tournoi sélectionné</p>
        )}

        {onOpenTournamentsManager && (
          <button
            onClick={() => {
              if (onCloseMobileDrawer) onCloseMobileDrawer();
              onOpenTournamentsManager();
            }}
            className="mt-2 text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5 font-bold"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tous les tournois créés &rarr;</span>
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] text-xs rounded-xl transition-all text-left ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.count !== undefined && (
                <span
                  className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded font-bold ${
                    item.alert
                      ? 'bg-amber-100 text-amber-800'
                      : isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-slate-500 bg-slate-100'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500 bg-slate-50/40">
        <div className="flex items-center justify-between font-bold text-slate-700">
          <span>Format : FFT Padel 2026</span>
          <span className="text-emerald-700">24 Équipes</span>
        </div>
        <p className="mt-1 text-slate-500">Poules & Tableau KO · Saisie Facile · Convocations</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 shadow-2xs">
        {renderContent(false)}
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobileDrawer}
          />
          {/* Drawer sheet */}
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
};

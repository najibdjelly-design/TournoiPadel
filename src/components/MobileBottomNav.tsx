import React from 'react';
import { NavigationModule } from './Sidebar';
import {
  LayoutDashboard,
  Users,
  Grid3X3,
  GitBranch,
  CalendarDays,
  Play,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  onOpenMobileDrawer: () => void;
  pairsCount?: number;
  poolsCount?: number;
  bracketMatchesCount?: number;
  scheduledMatchesCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentModule,
  onSelectModule,
  onOpenMobileDrawer,
  pairsCount,
  poolsCount,
  bracketMatchesCount,
  scheduledMatchesCount,
}) => {
  const items: {
    id: NavigationModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Bord',
      icon: LayoutDashboard,
    },
    {
      id: 'inscriptions',
      label: 'Paires',
      icon: Users,
      count: pairsCount,
    },
    {
      id: 'poules',
      label: 'Poules',
      icon: Grid3X3,
      count: poolsCount,
    },
    {
      id: 'tableau',
      label: 'Tableau',
      icon: GitBranch,
      count: bracketMatchesCount,
    },
    {
      id: 'programme',
      label: 'Terrains',
      icon: CalendarDays,
      count: scheduledMatchesCount,
    },
    {
      id: 'matchs',
      label: 'Matchs',
      icon: Play,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1 flex items-center justify-around shadow-lg safe-area-pb"
      aria-label="Navigation mobile"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentModule === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelectModule(item.id)}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors relative ${
              isActive
                ? 'text-emerald-700 font-extrabold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
              {item.count !== undefined && item.count > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[9px] font-mono font-extrabold rounded-full px-1 min-w-[14px] text-center leading-tight">
                  {item.count > 99 ? '99+' : item.count}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-1 truncate max-w-[56px]">
              {item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
            )}
          </button>
        );
      })}

      {/* Menu Drawer Toggle */}
      <button
        onClick={onOpenMobileDrawer}
        className="flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
        title="Ouvrir le menu complet"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] tracking-tight mt-1">Menu</span>
      </button>
    </nav>
  );
};

import React, { useRef } from 'react';
import { Tournament } from '../types/tournament';
import { Plus, Download, Upload, Radio, RotateCcw, Eye, Shield, Layers, Menu, LogOut } from 'lucide-react';

interface HeaderProps {
  tournaments: Tournament[];
  activeTournament?: Tournament;
  onSelectTournament: (id: string) => void;
  onOpenNewModal: () => void;
  onOpenTournamentsManager: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onResetSeed: () => void;
  isPublicMode: boolean;
  onTogglePublicMode: () => void;
  userEmail: string;
  onSignOut: () => void;
  onOpenMobileDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tournaments,
  activeTournament,
  onSelectTournament,
  onOpenNewModal,
  onOpenTournamentsManager,
  onExport,
  onImport,
  onResetSeed,
  isPublicMode,
  onTogglePublicMode,
  userEmail,
  onSignOut,
  onOpenMobileDrawer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) onImport(text);
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-200 shadow-2xs shrink-0">
      {/* Zone 1: Brand wordmark & Mobile Menu Trigger */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile menu trigger */}
        {onOpenMobileDrawer && (
          <button
            onClick={onOpenMobileDrawer}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Brand wordmark (Clickable to open all tournaments) */}
        <button
          onClick={onOpenTournamentsManager}
          className="text-xs sm:text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap flex items-center gap-1.5 sm:gap-2 hover:text-emerald-700 transition-colors group cursor-pointer"
          title="Cliquez pour voir et gérer tous les tournois créés"
        >
          <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 bg-emerald-600 rounded-sm inline-block group-hover:scale-110 transition-transform shrink-0"></span>
          <span className="hidden xs:inline">PADEL PRO TOURNAMENT</span>
          <span className="xs:hidden">PADEL PRO</span>
        </button>

        {/* All Tournaments manager trigger badge */}
        <button
          onClick={onOpenTournamentsManager}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 text-[11px] sm:text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors whitespace-nowrap"
          title="Consulter la liste de tous les tournois créés"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden sm:inline">Tous les tournois</span>
          <span className="font-mono text-emerald-700 font-extrabold">({tournaments.length})</span>
        </button>
      </div>

      {/* Zone 2: Tournament Context Selector & Realtime Sync Indicator */}
      <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
        <div className="flex items-center gap-2">
          <label htmlFor="tournament-select" className="text-xs text-slate-500 whitespace-nowrap font-medium">
            Épreuve active :
          </label>
          <select
            id="tournament-select"
            value={activeTournament?.id || ''}
            onChange={(e) => onSelectTournament(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 hover:border-slate-400 focus:outline-none focus:border-emerald-600 max-w-xs truncate shadow-2xs"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name} ({t.gender === 'H' ? 'Messieurs' : t.gender === 'D' ? 'Dames' : 'Mixte'})
              </option>
            ))}
          </select>
        </div>

        {/* Realtime Sync Badge */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="font-mono text-[11px] text-emerald-700 font-semibold">Sync Club en direct</span>
        </div>
      </div>

      {/* Zone 3: Primary Actions & View Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Toggle Public / Admin View */}
        <button
          onClick={onTogglePublicMode}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap min-h-[38px] ${
            isPublicMode
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
          }`}
          title={isPublicMode ? 'Basculer vers la console Juge-Arbitre' : 'Afficher la vue Live Joueurs / Spectateurs'}
        >
          {isPublicMode ? (
            <>
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Console Arbitre</span>
              <span className="sm:hidden">Arbitre</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Vue Joueurs (Live)</span>
              <span className="sm:hidden">Live</span>
            </>
          )}
        </button>

        {/* Export JSON (desktop/tablet) */}
        <button
          onClick={onExport}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          title="Exporter la base de tournois (JSON)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Import JSON (desktop/tablet) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          title="Importer un fichier de tournoi (JSON)"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>

        {/* Reset Demo Data (desktop) */}
        <button
          onClick={onResetSeed}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          title="Réinitialiser les données de démonstration"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Primary CTA: New Tournament */}
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors whitespace-nowrap shadow-xs min-h-[38px]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau Tournoi</span>
          <span className="sm:hidden">Créer</span>
        </button>
        <button
          onClick={onSignOut}
          aria-label={`Se déconnecter de ${userEmail}`}
          title={`Connecté en tant que ${userEmail}`}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Tournament } from '../../types/tournament';
import {
  Trophy,
  X,
  Search,
  Plus,
  CheckCircle2,
  Trash2,
  Copy,
  Calendar,
  Users,
  Grid3X3,
  Layers,
  ArrowRight,
  MapPin,
} from 'lucide-react';

interface TournamentsManagerModalProps {
  isOpen: boolean;
  tournaments: Tournament[];
  activeTournamentId?: string;
  onClose: () => void;
  onSelectTournament: (id: string) => void;
  onOpenNewModal: () => void;
  onDeleteTournament: (id: string) => void;
  onDuplicateTournament: (tournament: Tournament) => void;
}

export const TournamentsManagerModal: React.FC<TournamentsManagerModalProps> = ({
  isOpen,
  tournaments,
  activeTournamentId,
  onClose,
  onSelectTournament,
  onOpenNewModal,
  onDeleteTournament,
  onDuplicateTournament,
}) => {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredTournaments = tournaments.filter((t) => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.club.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  const handleConfirmDelete = (id: string) => {
    onDeleteTournament(id);
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Tous mes Tournois</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {tournaments.length} épreuve(s)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Gérez, basculez, dupliquez ou créez vos tournois de Padel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenNewModal();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Tournoi</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par nom, club, ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto text-xs w-full sm:w-auto">
            {['all', 'P25', 'P100', 'P250', 'P500', 'P1000', 'P2000'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1.5 rounded-md transition-colors font-medium whitespace-nowrap ${
                  filterCategory === cat
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'Toutes catégories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tournaments Grid List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {filteredTournaments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Trophy className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium">Aucun tournoi trouvé pour cette recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTournaments.map((t) => {
                const isActive = t.id === activeTournamentId;
                const confirmedCount = t.pairs.filter((p) => p.status === 'confirmed').length;

                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between shadow-xs ${
                      isActive
                        ? 'bg-emerald-50/40 border-emerald-400 ring-1 ring-emerald-300 shadow-sm'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {t.category}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {t.gender === 'H' ? 'Messieurs' : t.gender === 'D' ? 'Dames' : 'Mixte'}
                          </span>
                        </div>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Épreuve en cours
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            {t.status === 'in_progress' ? 'En cours' : t.status === 'completed' ? 'Terminé' : 'Préparation'}
                          </span>
                        )}
                      </div>

                      {/* Tournament Name */}
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1" title={t.name}>
                        {t.name}
                      </h3>

                      {/* Club and Dates */}
                      <div className="space-y-1 mt-1 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{t.club} · {t.city}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Du {t.dates.start} au {t.dates.end}</span>
                        </p>
                      </div>

                      {/* Stats Strip */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 my-3 border-y border-slate-100 text-center font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Paires</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {confirmedCount} / {t.maxPairs}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Poules</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {t.pools.length}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Pistes</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {t.courtsCount || t.courts.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicateTournament(t)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Dupliquer ce tournoi pour créer une nouvelle épreuve similaire"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {tournaments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeletingId(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Supprimer ce tournoi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isActive ? (
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                        >
                          Déjà sélectionné
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTournament(t.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-xs"
                        >
                          <span>Ouvrir</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-900">
            <span className="font-medium">
              Êtes-vous certain de vouloir supprimer définitivement ce tournoi ? Cette action est irréversible.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => handleConfirmDelete(deletingId)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

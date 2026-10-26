import React, { useState } from 'react';
import { Tournament, TournamentCategory, TournamentGender } from '../../types/tournament';
import { X, Trophy, Layers } from 'lucide-react';

interface NewTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tournament: Tournament) => void;
}

export const NewTournamentModal: React.FC<NewTournamentModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('Open P250 Padel Club');
  const [club, setClub] = useState('Tennis Padel Club');
  const [city, setCity] = useState('Lyon');
  const [category, setCategory] = useState<TournamentCategory>('P250');
  const [gender, setGender] = useState<TournamentGender>('H');
  const [entryFee, setEntryFee] = useState<number>(20);
  const [maxPairs, setMaxPairs] = useState<number>(24);
  const [courtsCount, setCourtsCount] = useState<number>(4);
  const [matchFormat, setMatchFormat] = useState('Format 2 (2 sets standard + super tie-break 10 pts)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const courts = Array.from({ length: courtsCount }).map((_, idx) => ({
      id: `court_new_${Date.now()}_${idx + 1}`,
      name: idx === 0 ? 'Terrain 1 - Central' : `Terrain ${idx + 1}`,
      surface: (idx % 2 === 0 ? 'panoramic' : 'indoor') as 'panoramic' | 'indoor',
    }));

    const newTournament: Tournament = {
      id: `tourn_${category.toLowerCase()}_${Date.now()}`,
      name,
      club,
      city,
      dates: {
        start: new Date().toISOString().split('T')[0],
        end: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      },
      category,
      gender,
      entryFee,
      maxPairs,
      status: 'draft',
      matchFormat,
      courtsCount,
      courts,
      pairs: [],
      pools: [],
      bracketMatches: [],
      consolanteMatches: [],
      convocations: [],
      updatedAt: new Date().toISOString(),
    };

    onCreate(newTournament);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nouveau Tournoi Padel</h3>
              <p className="text-xs text-slate-500">Homologation FFT / FIP & paramétrage initial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nom de l'épreuve
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              placeholder="Ex: Open P500 Padel Horizon"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Club d'accueil
              </label>
              <input
                type="text"
                required
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Ville / Département
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Catégorie homologuée
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TournamentCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="P25">P25 (Loisir / Débutants)</option>
                <option value="P100">P100 (Intermédiaire)</option>
                <option value="P250">P250 (Compétition régionale)</option>
                <option value="P500">P500 (Compétition nationale)</option>
                <option value="P1000">P1000 (Élite)</option>
                <option value="P2000">P2000 (Top niveau)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Tableau / Division
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as TournamentGender)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="H">Hommes (Double Messieurs)</option>
                <option value="D">Dames (Double Dames)</option>
                <option value="Mixte">Mixte (Mixte H/F)</option>
              </select>
            </div>
          </div>

          {/* Courts, Pairs, Fee */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Pistes / Terrains
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={courtsCount}
                onChange={(e) => setCourtsCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Max Paires (24 rec.)
              </label>
              <input
                type="number"
                min="4"
                max="64"
                value={maxPairs}
                onChange={(e) => setMaxPairs(parseInt(e.target.value) || 8)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Frais / joueur (€)
              </label>
              <input
                type="number"
                min="0"
                value={entryFee}
                onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Format de jeu (Règlement FFT)
            </label>
            <select
              value={matchFormat}
              onChange={(e) => setMatchFormat(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="Format 2 (2 sets standard + super tie-break 10 pts)">
                Format 2 : 2 sets gagnants standard + Super Tie-Break 10 pts au 3e
              </option>
              <option value="Format 1 (2 sets standard 6 jeux)">
                Format 1 : 2 sets gagnants complets standard 6 jeux
              </option>
              <option value="Format 4 (2 sets courts à 4 jeux)">
                Format 4 : 2 sets courts à 4 jeux + Super Tie-Break
              </option>
              <option value="Format 7 (1 set standard à 9 jeux)">
                Format 7 : 1 set à 9 jeux (Point décisif)
              </option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              <Layers className="w-4 h-4" /> Créer le Tournoi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

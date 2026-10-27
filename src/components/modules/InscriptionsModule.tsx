import React, { useState } from 'react';
import { Tournament, Pair } from '../../types/tournament';
import { rankAndSeedPairs } from '../../utils/padelCalculations';
import { CsvImportModal } from '../modals/CsvImportModal';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Sparkles,
  Trophy,
  Trash2,
  FileSpreadsheet,
  UploadCloud,
  ChevronRight,
  Shield,
  Layers,
  Phone,
  Mail,
  X,
} from 'lucide-react';

interface InscriptionsModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
}

export const InscriptionsModule: React.FC<InscriptionsModuleProps> = ({
  tournament,
  onUpdateTournament,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'waiting_list'>('all');
  const [isAddPairModalOpen, setIsAddPairModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);

  // New Pair Form State
  const [p1FirstName, setP1FirstName] = useState('');
  const [p1LastName, setP1LastName] = useState('');
  const [p1License, setP1License] = useState('');
  const [p1Rank, setP1Rank] = useState('150');
  const [p1Club, setP1Club] = useState(tournament.club);
  const [p1Phone, setP1Phone] = useState('0612345678');

  const [p2FirstName, setP2FirstName] = useState('');
  const [p2LastName, setP2LastName] = useState('');
  const [p2License, setP2License] = useState('');
  const [p2Rank, setP2Rank] = useState('200');
  const [p2Club, setP2Club] = useState(tournament.club);
  const [p2Phone, setP2Phone] = useState('0623456789');

  const [isDirectTableau, setIsDirectTableau] = useState(false);

  // Manual seed modification for a pair
  const handleSetPairSeed = (pairId: string, seedRank?: number) => {
    const updated = tournament.pairs.map((p) => {
      if (p.id === pairId) {
        return { ...p, seedRank };
      }
      if (seedRank !== undefined && p.seedRank === seedRank) {
        return { ...p, seedRank: undefined };
      }
      return p;
    });
    onUpdateTournament({ ...tournament, pairs: updated });
  };

  // Recalculate weights and auto-assign seeds
  const handleRecalculateWeightsAndSeeds = () => {
    const recomputed = tournament.pairs.map((p) => ({
      ...p,
      totalWeight: Number(p.player1.ranking) + Number(p.player2.ranking),
    }));
    const seedQuota = recomputed.length >= 16 ? 8 : 4;
    const sortedAndSeeded = rankAndSeedPairs(recomputed, seedQuota);
    onUpdateTournament({
      ...tournament,
      pairs: sortedAndSeeded,
    });
  };

  const handleAddPair = (e: React.FormEvent) => {
    e.preventDefault();
    const newPair: Pair = {
      id: `pair_${Date.now()}`,
      tournamentId: tournament.id,
      totalWeight: Number(p1Rank) + Number(p2Rank),
      isDirectTableau,
      status: tournament.pairs.length < tournament.maxPairs ? 'confirmed' : 'waiting_list',
      createdAt: new Date().toISOString().split('T')[0],
      player1: {
        id: `pl_${Date.now()}_1`,
        firstName: p1FirstName,
        lastName: p1LastName,
        licenseNumber: p1License || `LIC${Math.floor(Math.random() * 899999 + 100000)}`,
        ranking: Number(p1Rank),
        email: `${p1FirstName.toLowerCase()}.${p1LastName.toLowerCase()}@club.fr`,
        phone: p1Phone,
        club: p1Club,
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
      player2: {
        id: `pl_${Date.now()}_2`,
        firstName: p2FirstName,
        lastName: p2LastName,
        licenseNumber: p2License || `LIC${Math.floor(Math.random() * 899999 + 100000)}`,
        ranking: Number(p2Rank),
        email: `${p2FirstName.toLowerCase()}.${p2LastName.toLowerCase()}@club.fr`,
        phone: p2Phone,
        club: p2Club,
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
    };

    const updatedPairs = [...tournament.pairs, newPair];
    const seedQuota = updatedPairs.length >= 16 ? 8 : 4;
    onUpdateTournament({
      ...tournament,
      pairs: rankAndSeedPairs(updatedPairs, seedQuota),
    });

    setIsAddPairModalOpen(false);
    setP1FirstName('');
    setP1LastName('');
    setP2FirstName('');
    setP2LastName('');
  };

  const handleQuickImportPairs = () => {
    const samplePack: Pair[] = [
      {
        id: `pair_imp_${Date.now()}_1`,
        tournamentId: tournament.id,
        totalWeight: 260,
        isDirectTableau: false,
        status: 'confirmed',
        createdAt: new Date().toISOString().split('T')[0],
        player1: {
          id: `p_${Date.now()}_a`,
          firstName: 'Guillaume',
          lastName: 'Casalta',
          licenseNumber: '7482910A',
          ranking: 120,
          email: 'g.casalta@padel.fr',
          phone: '0619283746',
          club: 'TC Nice Padel',
          isPresent: true,
          paymentStatus: 'paid',
          paymentMethod: 'card',
          paidAmount: tournament.entryFee,
        },
        player2: {
          id: `p_${Date.now()}_b`,
          firstName: 'Vincent',
          lastName: 'Ferrara',
          licenseNumber: '8392019B',
          ranking: 140,
          email: 'v.ferrara@padel.fr',
          phone: '0628394012',
          club: 'TC Nice Padel',
          isPresent: true,
          paymentStatus: 'paid',
          paymentMethod: 'card',
          paidAmount: tournament.entryFee,
        },
      },
      {
        id: `pair_imp_${Date.now()}_2`,
        tournamentId: tournament.id,
        totalWeight: 380,
        isDirectTableau: false,
        status: 'confirmed',
        createdAt: new Date().toISOString().split('T')[0],
        player1: {
          id: `p_${Date.now()}_c`,
          firstName: 'Alexandre',
          lastName: 'Boilevin',
          licenseNumber: '9201928C',
          ranking: 180,
          email: 'a.boilevin@club.fr',
          phone: '0637485920',
          club: '4Padel Toulouse',
          isPresent: true,
          paymentStatus: 'paid',
          paymentMethod: 'transfer',
          paidAmount: tournament.entryFee,
        },
        player2: {
          id: `p_${Date.now()}_d`,
          firstName: 'Robin',
          lastName: 'Haziza',
          licenseNumber: '1029384D',
          ranking: 200,
          email: 'r.haziza@club.fr',
          phone: '0648592031',
          club: '4Padel Toulouse',
          isPresent: false,
          paymentStatus: 'pending',
          paymentMethod: 'cash',
          paidAmount: 0,
        },
      },
    ];

    const combined = [...tournament.pairs, ...samplePack];
    const seedQuota = combined.length >= 16 ? 8 : 4;
    onUpdateTournament({
      ...tournament,
      pairs: rankAndSeedPairs(combined, seedQuota),
    });
  };

  const handleImportCsvPairs = (importedPairs: Pair[], replaceExisting: boolean) => {
    let newPairs: Pair[];
    if (replaceExisting) {
      newPairs = importedPairs;
    } else {
      newPairs = [...tournament.pairs, ...importedPairs];
    }
    const confirmedPairs = newPairs.filter(pair => pair.status === 'confirmed');
    const waitingPairs = newPairs.filter(pair => pair.status !== 'confirmed');
    const seedQuota = confirmedPairs.length >= 16 ? 8 : 4;
    const seeded = [
      ...rankAndSeedPairs(confirmedPairs, seedQuota),
      ...waitingPairs.map(pair => ({ ...pair, seedRank: undefined })),
    ];

    onUpdateTournament({
      ...tournament,
      pairs: seeded,
    });
  };

  const toggleDirectTableau = (pairId: string) => {
    const updated = tournament.pairs.map((p) => {
      if (p.id === pairId) {
        return { ...p, isDirectTableau: !p.isDirectTableau };
      }
      return p;
    });
    onUpdateTournament({ ...tournament, pairs: updated });
  };

  // Safe delete with confirmation
  const removePair = (pairId: string) => {
    const target = tournament.pairs.find(p => p.id === pairId);
    const names = target
      ? `${target.player1.firstName} ${target.player1.lastName} / ${target.player2.firstName} ${target.player2.lastName}`
      : 'cette paire';
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'inscription de ${names} ? Cette action est irréversible.`)) {
      return;
    }

    const updated = tournament.pairs.filter((p) => p.id !== pairId);
    const seedQuota = updated.length >= 16 ? 8 : 4;
    onUpdateTournament({
      ...tournament,
      pairs: rankAndSeedPairs(updated, seedQuota),
    });
  };

  const filteredPairs = tournament.pairs.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      p.player1.lastName.toLowerCase().includes(query) ||
      p.player1.firstName.toLowerCase().includes(query) ||
      p.player2.lastName.toLowerCase().includes(query) ||
      p.player2.firstName.toLowerCase().includes(query) ||
      p.player1.club.toLowerCase().includes(query) ||
      p.player2.club.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Inscriptions & Poids des Paires
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Format 24 équipes (ou 8, 16, 32). Calcul du poids réglementaire (Rang J1 + Rang J2) et têtes de série TS 1 à 8.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Import */}
          <button
            onClick={() => setIsCsvImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-xl transition-colors shadow-2xs"
            title="Importer un fichier export FFT / Ten'Up (Liste des participants)"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
            <span>Importer FFT (CSV / XLSX)</span>
          </button>

          <button
            onClick={handleQuickImportPairs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            title="Ajouter des paires de démonstration"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
            <span>Lot Démo</span>
          </button>

          <button
            onClick={handleRecalculateWeightsAndSeeds}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            title="Recalculer les poids et réassigner TS 1 à 8"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recalculer Têtes de Série</span>
          </button>

          <button
            onClick={() => setIsAddPairModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Inscrire une Paire</span>
          </button>
        </div>
      </div>

      {/* FFT Import Banner */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900">
              Compatible Ten&apos;Up & Gestion Sportive FFT (&ldquo;Liste des participants padel&rdquo;)
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Importez les onglets Tableau final et Liste d&apos;attente depuis un fichier XLSX FFT/Ten&apos;Up ou un CSV.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCsvImportModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Parcourir...
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher joueur, club, licence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterStatus === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Toutes ({tournament.pairs.length})
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterStatus === 'confirmed' ? 'bg-white text-emerald-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Confirmées ({tournament.pairs.filter(p => p.status === 'confirmed').length})
          </button>
          <button
            onClick={() => setFilterStatus('waiting_list')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterStatus === 'waiting_list' ? 'bg-white text-amber-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attente ({tournament.pairs.filter(p => p.status === 'waiting_list').length})
          </button>
        </div>
      </div>

      {/* Pairs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-3 w-16 text-center">Pos.</th>
                <th className="py-3 px-3 w-16 text-center">T.S.</th>
                <th className="py-3 px-4">Joueur 1 (Capitaine)</th>
                <th className="py-3 px-4">Joueur 2 (Partenaire)</th>
                <th className="py-3 px-3 text-right">Poids Paire</th>
                <th className="py-3 px-3 text-center">Tableau Direct</th>
                <th className="py-3 px-3 text-center">Statut</th>
                <th className="py-3 px-3 text-center">Émargement</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredPairs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucune paire trouvée.
                  </td>
                </tr>
              ) : (
                filteredPairs.map((pair) => {
                  const p1 = pair.player1;
                  const p2 = pair.player2;

                  return (
                    <tr
                      key={pair.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-700">
                          {pair.entryPosition ?? '—'}
                        </span>
                      </td>

                      {/* Seed Selector */}
                      <td className="py-3 px-3 text-center">
                        <select
                          value={pair.seedRank !== undefined ? pair.seedRank.toString() : ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            handleSetPairSeed(pair.id, val);
                          }}
                          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                            pair.seedRank
                              ? 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold'
                              : 'bg-white text-slate-500 border-slate-300'
                          }`}
                          title="Affecter manuellement la Tête de Série (TS 1 à 8)"
                        >
                          <option value="">—</option>
                          <option value="1">TS 1</option>
                          <option value="2">TS 2</option>
                          <option value="3">TS 3</option>
                          <option value="4">TS 4</option>
                          <option value="5">TS 5</option>
                          <option value="6">TS 6</option>
                          <option value="7">TS 7</option>
                          <option value="8">TS 8</option>
                        </select>
                      </td>

                      {/* Player 1 */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p1.firstName} {p1.lastName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-emerald-700 font-extrabold">N° {p1.ranking}</span>
                          <span>·</span>
                          <span className="truncate max-w-[140px]" title={p1.club}>{p1.club}</span>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{p1.phone}</span>
                        </div>
                      </td>

                      {/* Player 2 */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p2.firstName} {p2.lastName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-emerald-700 font-extrabold">N° {p2.ranking}</span>
                          <span>·</span>
                          <span className="truncate max-w-[140px]" title={p2.club}>{p2.club}</span>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{p2.phone}</span>
                        </div>
                      </td>

                      {/* Total Weight */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-sm text-slate-900">
                        {pair.totalWeight}
                      </td>

                      {/* Direct Bracket Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleDirectTableau(pair.id)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                            pair.isDirectTableau
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {pair.isDirectTableau ? 'Tableau Direct' : 'Poule'}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            pair.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {pair.status === 'confirmed' ? 'Confirmé' : 'Attente'}
                        </span>
                      </td>

                      {/* Presence Check-in */}
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-semibold ${p1.isPresent && p2.isPresent ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {p1.isPresent && p2.isPresent ? 'Présent' : p1.isPresent || p2.isPresent ? '1/2' : 'Non pointé'}
                        </span>
                      </td>

                      {/* Actions (with confirmation) */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => removePair(pair.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold text-xs p-1 hover:bg-rose-50 rounded transition-colors"
                          title="Supprimer la paire de l'épreuve"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Pair Modal */}
      {isAddPairModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-extrabold text-slate-900">Inscrire une nouvelle paire</h3>
              </div>
              <button
                onClick={() => setIsAddPairModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPair} className="p-6 space-y-4 text-xs">
              {/* Player 1 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-900 block text-xs">Joueur 1 (Capitaine)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Prénom :</label>
                    <input
                      type="text"
                      required
                      value={p1FirstName}
                      onChange={(e) => setP1FirstName(e.target.value)}
                      placeholder="Ex: Paul"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Nom :</label>
                    <input
                      type="text"
                      required
                      value={p1LastName}
                      onChange={(e) => setP1LastName(e.target.value)}
                      placeholder="Ex: Bernard"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Rang FFT :</label>
                    <input
                      type="number"
                      required
                      value={p1Rank}
                      onChange={(e) => setP1Rank(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Club :</label>
                    <input
                      type="text"
                      value={p1Club}
                      onChange={(e) => setP1Club(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-900 block text-xs">Joueur 2 (Partenaire)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Prénom :</label>
                    <input
                      type="text"
                      required
                      value={p2FirstName}
                      onChange={(e) => setP2FirstName(e.target.value)}
                      placeholder="Ex: Thomas"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Nom :</label>
                    <input
                      type="text"
                      required
                      value={p2LastName}
                      onChange={(e) => setP2LastName(e.target.value)}
                      placeholder="Ex: Petit"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Rang FFT :</label>
                    <input
                      type="number"
                      required
                      value={p2Rank}
                      onChange={(e) => setP2Rank(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Club :</label>
                    <input
                      type="text"
                      value={p2Club}
                      onChange={(e) => setP2Club(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Tableau Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isDirectTableau}
                  onChange={(e) => setIsDirectTableau(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
                <span>Admis directement au Tableau Final (dispensé de poules)</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddPairModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  Valider l&apos;inscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        tournament={tournament}
        onImportPairs={handleImportCsvPairs}
      />
    </div>
  );
};

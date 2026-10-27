import React, { useState } from 'react';
import { Tournament, Player, Pair } from '../../types/tournament';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Search,
  Check,
  Printer,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import { PairPoolHistoryModal } from '../modals/PairPoolHistoryModal';

interface CaisseModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
}

export const CaisseModule: React.FC<CaisseModuleProps> = ({
  tournament,
  onUpdateTournament,
}) => {
  const [search, setSearch] = useState('');
  const [filterPresence, setFilterPresence] = useState<'all' | 'present' | 'missing'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'pending'>('all');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Extract all individual players with pair reference
  const playerRows: { player: Player; pair: Pair; isP1: boolean }[] = [];
  tournament.pairs.forEach((pair) => {
    playerRows.push({ player: pair.player1, pair, isP1: true });
    playerRows.push({ player: pair.player2, pair, isP1: false });
  });
  const allMatches = [
    ...tournament.pools.flatMap(pool => pool.matches),
    ...tournament.bracketMatches,
    ...tournament.consolanteMatches,
  ];
  const selectedPair = tournament.pairs.find(pair => pair.id === selectedPairId) || null;
  const selectedPlayer = selectedPair
    ? [selectedPair.player1, selectedPair.player2].find(player => player.id === selectedPlayerId)
    : undefined;

  const openPlayerDetails = (pair: Pair, player: Player) => {
    setSelectedPairId(pair.id);
    setSelectedPlayerId(player.id);
  };

  const closePlayerDetails = () => {
    setSelectedPairId(null);
    setSelectedPlayerId(null);
  };

  // Calculate financial statistics
  const entryFee = tournament.entryFee;
  const totalPlayers = playerRows.length;
  const totalExpected = totalPlayers * entryFee;

  let totalCollected = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let transferTotal = 0;
  let onlineTotal = 0;
  let presentCount = 0;

  playerRows.forEach(({ player }) => {
    if (player.isPresent) presentCount++;
    if (player.paymentStatus === 'paid') {
      const amt = player.paidAmount || entryFee;
      totalCollected += amt;
      if (player.paymentMethod === 'cash') cashTotal += amt;
      else if (player.paymentMethod === 'card') cardTotal += amt;
      else if (player.paymentMethod === 'transfer') transferTotal += amt;
      else if (player.paymentMethod === 'online') onlineTotal += amt;
    }
  });

  const totalPending = totalExpected - totalCollected;

  // Toggle presence check-in
  const handleTogglePresence = (pairId: string, isP1: boolean) => {
    const updatedPairs = tournament.pairs.map((p) => {
      if (p.id === pairId) {
        if (isP1) {
          return {
            ...p,
            player1: { ...p.player1, isPresent: !p.player1.isPresent },
          };
        } else {
          return {
            ...p,
            player2: { ...p.player2, isPresent: !p.player2.isPresent },
          };
        }
      }
      return p;
    });

    onUpdateTournament({
      ...tournament,
      pairs: updatedPairs,
    });
  };

  // Update payment status & method
  const handleUpdatePayment = (
    pairId: string,
    isP1: boolean,
    status: 'paid' | 'pending' | 'waived',
    method: 'cash' | 'card' | 'transfer' | 'online'
  ) => {
    const updatedPairs = tournament.pairs.map((p) => {
      if (p.id === pairId) {
        const amt = status === 'paid' ? entryFee : 0;
        if (isP1) {
          return {
            ...p,
            player1: {
              ...p.player1,
              paymentStatus: status,
              paymentMethod: method,
              paidAmount: amt,
            },
          };
        } else {
          return {
            ...p,
            player2: {
              ...p.player2,
              paymentStatus: status,
              paymentMethod: method,
              paidAmount: amt,
            },
          };
        }
      }
      return p;
    });

    onUpdateTournament({
      ...tournament,
      pairs: updatedPairs,
    });
  };

  // Filtered rows
  const filteredRows = playerRows.filter(({ player, pair }) => {
    if (filterPresence === 'present' && !player.isPresent) return false;
    if (filterPresence === 'missing' && player.isPresent) return false;
    if (filterPayment === 'paid' && player.paymentStatus !== 'paid') return false;
    if (filterPayment === 'pending' && player.paymentStatus === 'paid') return false;

    if (!search) return true;
    const query = search.toLowerCase();
    return (
      player.lastName.toLowerCase().includes(query) ||
      player.firstName.toLowerCase().includes(query) ||
      player.club.toLowerCase().includes(query) ||
      player.licenseNumber.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Caisse & Feuille d'Émargement
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pointage des présences des joueurs, encaissement des frais d'inscription ({entryFee} €/joueur) et ventilation comptable
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Imprimer Émargement</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Encaissé</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {totalCollected} €
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Sur un prévisionnel de {totalExpected} €
          </p>
        </div>

        {/* Pending */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Reste à percevoir</span>
            <CreditCard className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {totalPending} €
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {playerRows.filter(r => r.player.paymentStatus === 'pending').length} joueur(s) non réglé(s)
          </p>
        </div>

        {/* Presence Check-in Rate */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Émargement Présence</span>
            <UserCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {presentCount} / {totalPlayers}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {totalPlayers > 0 ? `${Math.round((presentCount / totalPlayers) * 100)}% de présents pointés` : '0%'}
          </p>
        </div>

        {/* Payment Methods breakdown */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Ventilation Modes
          </span>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-slate-700">
              <span>CB :</span>
              <span className="font-bold text-slate-900">{cardTotal} €</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Espèces :</span>
              <span className="font-bold text-slate-900">{cashTotal} €</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Virement / En ligne :</span>
              <span className="font-bold text-slate-900">{transferTotal + onlineTotal} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher joueur, licence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Presence Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs">
            <button
              onClick={() => setFilterPresence('all')}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterPresence === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({playerRows.length})
            </button>
            <button
              onClick={() => setFilterPresence('present')}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterPresence === 'present' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Présents ({presentCount})
            </button>
            <button
              onClick={() => setFilterPresence('missing')}
              className={`px-3 py-1.5 rounded transition-colors ${
                filterPresence === 'missing' ? 'bg-white text-amber-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Absents ({totalPlayers - presentCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Émarger</th>
                <th className="py-3 px-4">Joueur</th>
                <th className="py-3 px-4">Club & Licence</th>
                <th className="py-3 px-4">Équipe / Paire</th>
                <th className="py-3 px-4 text-center">Règlement</th>
                <th className="py-3 px-4 text-center">Mode de paiement</th>
                <th className="py-3 px-4 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Aucun joueur trouvé.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ player, pair, isP1 }) => {
                  const partner = isP1 ? pair.player2 : pair.player1;

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Check-in checkbox */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePresence(pair.id, isP1)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            player.isPresent
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-white border border-slate-300 text-transparent hover:border-emerald-500'
                          }`}
                          title="Cliquer pour pointer la présence"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </td>

                      {/* Player name & ranking */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPlayerDetails(pair, player)}
                            className="text-left text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                            aria-label={`Afficher les informations de ${player.firstName} ${player.lastName}`}
                          >
                            {player.firstName} {player.lastName}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          N° {player.ranking} · {player.phone}
                        </div>
                      </td>

                      {/* Club & License */}
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{player.club}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {player.licenseNumber}
                        </div>
                      </td>

                      {/* Pair partner */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700">
                          Associé à{' '}
                          <button
                            type="button"
                            onClick={() => openPlayerDetails(pair, partner)}
                            className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                            aria-label={`Afficher les informations de ${partner.firstName} ${partner.lastName}`}
                          >
                            {partner.firstName} {partner.lastName}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Poids paire: #{pair.totalWeight}{pair.seedRank ? ` · TS ${pair.seedRank}` : ''}
                        </div>
                      </td>

                      {/* Payment status toggle */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePayment(
                                pair.id,
                                isP1,
                                player.paymentStatus === 'paid' ? 'pending' : 'paid',
                                player.paymentMethod || 'cash'
                              )
                            }
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                              player.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {player.paymentStatus === 'paid' ? 'Réglé' : 'À régler (Espèces)'}
                          </button>
                        </div>
                      </td>

                      {/* Payment method selector (Defaults to Espèces) */}
                      <td className="py-3 px-4 text-center">
                        <select
                          value={player.paymentMethod || 'cash'}
                          onChange={(e) =>
                            handleUpdatePayment(
                              pair.id,
                              isP1,
                              'paid',
                              e.target.value as 'cash' | 'card' | 'transfer' | 'online'
                            )
                          }
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-xs"
                        >
                          <option value="cash">Espèces (€)</option>
                          <option value="card">Carte Bancaire (CB)</option>
                          <option value="transfer">Virement</option>
                          <option value="online">Paiement en ligne</option>
                        </select>
                      </td>

                      {/* Paid amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-900 tabular-nums">
                        {player.paymentStatus === 'paid' ? `${entryFee} €` : '0 €'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PairPoolHistoryModal
        isOpen={Boolean(selectedPair)}
        pair={selectedPair}
        selectedPlayer={selectedPlayer}
        pools={tournament.pools}
        courts={tournament.courts}
        allMatches={allMatches}
        allPairs={tournament.pairs}
        onClose={closePlayerDetails}
      />
    </div>
  );
};

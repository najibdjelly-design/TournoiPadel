import React, { useState, useMemo } from 'react';
import { Tournament, Match, Pair } from '../../types/tournament';
import {
  generateFullClassificationTournament,
  computeCompleteFinalStandings,
  formatScore,
} from '../../utils/padelCalculations';
import {
  GitBranch,
  Trophy,
  Crown,
  UserPlus,
  X,
  Search,
  Trash2,
  Sparkles,
  Medal,
  Award,
  Layers,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Check,
  Filter,
} from 'lucide-react';

interface TableauModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
  onOpenScoreModal: (match: Match) => void;
}

export const TableauModule: React.FC<TableauModuleProps> = ({
  tournament,
  onUpdateTournament,
  onOpenScoreModal,
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'consolante' | 'standings'>('main');
  const [bracketSize, setBracketSize] = useState<4 | 8 | 16 | 24 | 32>(24); // Default 24 teams
  const [consolanteCategory, setConsolanteCategory] = useState<'all' | '5-8' | '9-16' | '17-24'>('all');
  const [isCopiedStandings, setIsCopiedStandings] = useState(false);

  // Slot placement modal state
  const [slotModalInfo, setSlotModalInfo] = useState<{
    matchId: string;
    slot: 'pair1' | 'pair2';
    roundName: string;
    matchNumber: number;
  } | null>(null);

  const [slotTab, setSlotTab] = useState<'pairs' | 'pools' | 'winners' | 'losers' | 'custom'>('pairs');
  const [slotPairSearch, setSlotPairSearch] = useState('');
  const [customPlaceholder, setCustomPlaceholder] = useState('');
  const [isClearTableauModalOpen, setIsClearTableauModalOpen] = useState(false);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map((p) => [p.id, p]));

  // Detect current main bracket capacity from existing matches
  const mainBracketCapacity = useMemo<number>(() => {
    const r1Count = tournament.bracketMatches.filter(
      (m) => (m.bracketRound || 1) === 1
    ).length;
    if (r1Count >= 8) return 24; // 8 matches in R1 + 8 Byes in R2 = 24 teams
    if (r1Count >= 4) return 8;
    if (r1Count >= 2) return 4;
    return tournament.maxPairs || 24;
  }, [tournament.bracketMatches, tournament.maxPairs]);

  // Generate full tournament with automatic matching classification matches (1 to N)
  const handleGenerateFullTournament = (size: 4 | 8 | 16 | 24 | 32 = bracketSize) => {
    const { bracketMatches: newMainMatches, consolanteMatches: newConsolanteMatches } =
      generateFullClassificationTournament(tournament.id, size);

    const confirmed = tournament.pairs.filter((p) => p.status === 'confirmed');
    const sortedPairs = [...confirmed].sort((a, b) => a.totalWeight - b.totalWeight);

    if (size === 24) {
      // In 24-draw: TS 1 to 8 receive Byes directly into 1/8th finals (Round 2)
      const r2Matches = newMainMatches.filter((m) => m.bracketRound === 2);
      for (let s = 0; s < 8; s++) {
        if (sortedPairs[s] && r2Matches[s]) {
          r2Matches[s].pair1Id = sortedPairs[s].id;
        }
      }
      // Round 1 (1/16e) receives remaining seeded/qualifier players
      const r1Matches = newMainMatches.filter((m) => m.bracketRound === 1);
      for (let s = 0; s < 8; s++) {
        if (sortedPairs[8 + s * 2] && r1Matches[s]) {
          r1Matches[s].pair1Id = sortedPairs[8 + s * 2].id;
        }
        if (sortedPairs[8 + s * 2 + 1] && r1Matches[s]) {
          r1Matches[s].pair2Id = sortedPairs[8 + s * 2 + 1].id;
        }
      }
    } else {
      // Standard distribution of top seeds
      const round1Matches = newMainMatches.filter((m) => m.bracketRound === 1);
      if (round1Matches.length > 0) {
        if (sortedPairs[0]) round1Matches[0].pair1Id = sortedPairs[0].id;
        if (sortedPairs[1] && round1Matches.length > 1) {
          round1Matches[round1Matches.length - 1].pair2Id = sortedPairs[1].id;
        }
        if (sortedPairs[2] && round1Matches.length > 2) {
          round1Matches[Math.floor(round1Matches.length / 2)].pair1Id = sortedPairs[2].id;
        }
        if (sortedPairs[3] && round1Matches.length > 3) {
          round1Matches[Math.floor(round1Matches.length / 2) - 1].pair2Id = sortedPairs[3].id;
        }
      }
    }

    onUpdateTournament({
      ...tournament,
      bracketMatches: newMainMatches,
      consolanteMatches: newConsolanteMatches,
    });
  };

  // Filter consolante matches by rank bracket category
  const filteredConsolanteMatches = useMemo(() => {
    if (consolanteCategory === 'all') return tournament.consolanteMatches;
    if (consolanteCategory === '5-8') {
      return tournament.consolanteMatches.filter(
        (m) =>
          m.classificationRankRange === '5-8' ||
          m.classificationRankRange === '5-6' ||
          m.classificationRankRange === '7-8'
      );
    }
    if (consolanteCategory === '9-16') {
      return tournament.consolanteMatches.filter(
        (m) =>
          m.classificationRankRange === '9-16' ||
          m.classificationRankRange === '9-12' ||
          m.classificationRankRange === '13-16' ||
          m.classificationRankRange === '9-10' ||
          m.classificationRankRange === '11-12' ||
          m.classificationRankRange === '13-14' ||
          m.classificationRankRange === '15-16'
      );
    }
    if (consolanteCategory === '17-24') {
      return tournament.consolanteMatches.filter(
        (m) =>
          m.classificationRankRange === '17-24' ||
          m.classificationRankRange === '17-20' ||
          m.classificationRankRange === '21-24' ||
          m.classificationRankRange === '17-18' ||
          m.classificationRankRange === '19-20' ||
          m.classificationRankRange === '21-22' ||
          m.classificationRankRange === '23-24'
      );
    }
    return tournament.consolanteMatches;
  }, [consolanteCategory, tournament.consolanteMatches]);

  // Current matches displayed in tree view
  const currentDisplayedMatches = useMemo(() => {
    if (activeTab === 'main') {
      return tournament.bracketMatches.filter((m) => m.type !== 'consolante');
    }
    if (activeTab === 'consolante') {
      return filteredConsolanteMatches;
    }
    return [];
  }, [activeTab, tournament.bracketMatches, filteredConsolanteMatches]);

  // Group current matches by bracketRound
  const roundsMap = new Map<number, Match[]>();
  currentDisplayedMatches.forEach((m) => {
    const r = m.bracketRound || 1;
    if (!roundsMap.has(r)) roundsMap.set(r, []);
    roundsMap.get(r)!.push(m);
  });

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  // Check if champion exists
  const finalMatch = tournament.bracketMatches.find(
    (m) => m.targetRankWinner === 1 && m.status === 'completed'
  );
  const championPair = finalMatch?.winnerPairId ? pairsMap.get(finalMatch.winnerPairId) : undefined;

  // Complete official standings (1 to N)
  const officialStandings = useMemo(() => {
    return computeCompleteFinalStandings(tournament);
  }, [tournament]);

  // Clear bracket modal
  const handleConfirmDeleteBracket = () => {
    if (activeTab === 'main') {
      onUpdateTournament({
        ...tournament,
        bracketMatches: [],
        consolanteMatches: [],
      });
    } else {
      onUpdateTournament({
        ...tournament,
        consolanteMatches: [],
      });
    }
    setIsClearTableauModalOpen(false);
  };

  // Assign player or pool winner directly to slot with manual flexibility
  const handleAssignToSlot = (
    matchId: string,
    slot: 'pair1' | 'pair2',
    pairId?: string,
    placeholder?: string
  ) => {
    const updateMatches = (list: Match[]) =>
      list.map((m) => {
        if (m.id !== matchId) return m;
        if (slot === 'pair1') {
          return {
            ...m,
            pair1Id: pairId,
            pair1Placeholder: placeholder || (pairId ? undefined : m.pair1Placeholder),
          };
        } else {
          return {
            ...m,
            pair2Id: pairId,
            pair2Placeholder: placeholder || (pairId ? undefined : m.pair2Placeholder),
          };
        }
      });

    onUpdateTournament({
      ...tournament,
      bracketMatches: updateMatches(tournament.bracketMatches),
      consolanteMatches: updateMatches(tournament.consolanteMatches),
    });

    setSlotModalInfo(null);
  };

  // Block duplicate pairs in the same round
  const currentSlotMatch = slotModalInfo
    ? [...tournament.bracketMatches, ...tournament.consolanteMatches].find(
        (m) => m.id === slotModalInfo.matchId
      )
    : undefined;
  const currentSlotRound = currentSlotMatch?.bracketRound || 1;

  const pairsAlreadyInThisRound = useMemo(() => {
    const map = new Map<string, number>();
    if (!slotModalInfo) return map;
    currentDisplayedMatches
      .filter((m) => (m.bracketRound || 1) === currentSlotRound)
      .forEach((m) => {
        if (m.pair1Id && !(m.id === slotModalInfo.matchId && slotModalInfo.slot === 'pair1')) {
          map.set(m.pair1Id, m.matchNumber);
        }
        if (m.pair2Id && !(m.id === slotModalInfo.matchId && slotModalInfo.slot === 'pair2')) {
          map.set(m.pair2Id, m.matchNumber);
        }
      });
    return map;
  }, [currentDisplayedMatches, slotModalInfo, currentSlotRound]);

  // Filtered pairs for slot modal
  const filteredSlotPairs = tournament.pairs.filter((p) => {
    if (!slotPairSearch) return true;
    const q = slotPairSearch.toLowerCase();
    return (
      p.player1.lastName.toLowerCase().includes(q) ||
      p.player1.firstName.toLowerCase().includes(q) ||
      p.player2.lastName.toLowerCase().includes(q) ||
      p.player2.firstName.toLowerCase().includes(q) ||
      p.player1.club.toLowerCase().includes(q)
    );
  });

  // Copy standings to clipboard
  const handleCopyStandings = () => {
    const lines = officialStandings.map((item) => {
      const pair = item.pairId ? pairsMap.get(item.pairId) : undefined;
      const pairName = pair
        ? `${pair.player1.lastName} ${pair.player1.firstName} / ${pair.player2.lastName} ${pair.player2.firstName} (${pair.player1.club})`
        : item.detail;
      return `${item.rank}e : ${pairName}`;
    });

    const fullText = `=== CLASSEMENT OFFICIEL : ${tournament.name} ===\n\n` + lines.join('\n');
    navigator.clipboard.writeText(fullText);
    setIsCopiedStandings(true);
    setTimeout(() => setIsCopiedStandings(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Header & Tournament Generator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Tableau Final & Consolantes</span>
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
              Classement 1 à {mainBracketCapacity}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolantes calculées automatiquement d&apos;après le tableau principal pour classer l&apos;ensemble des équipes de 1 à N.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main / Consolante / Standings tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'main'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau Principal ({tournament.bracketMatches.filter((m) => m.type !== 'consolante').length} m.)
            </button>
            <button
              onClick={() => setActiveTab('consolante')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'consolante'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matchs de Classement ({tournament.consolanteMatches.length} m.)
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'standings'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Classement Général (1 à {mainBracketCapacity})</span>
            </button>
          </div>

          {/* Generator Controls */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-xs">
            <select
              value={bracketSize}
              onChange={(e) => setBracketSize(parseInt(e.target.value) as 4 | 8 | 16 | 24 | 32)}
              className="bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1.5 rounded-lg"
              title="Choisir le format du tournoi complet"
            >
              <option value="24">Format 24 Équipes (1/16 + 8 Exempts + Classement 1-24)</option>
              <option value="16">Tableau de 16 (1/8 + Classement 1-16)</option>
              <option value="8">Tableau de 8 (1/4 + Classement 1-8)</option>
              <option value="4">Tableau de 4 (1/2 + Finale + 3e place)</option>
            </select>
            <button
              onClick={() => handleGenerateFullTournament(bracketSize)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Générer Tournoi ({bracketSize} éq.)</span>
            </button>

            {tournament.bracketMatches.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearTableauModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                title="Vider le tableau avec confirmation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vider</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Consolante Automatic Sub-Filter & Info Banner */}
      {activeTab === 'consolante' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Consolantes & Matchs de classement automatiques :</strong> Générés en fonction du tableau principal pour classer toutes les équipes. Les paires perdantes sont injectées automatiquement dès la saisie des scores. Vous conservez la flexibilité de modifier manuellement n&apos;importe quelle case.
              </span>
            </div>
          </div>

          {/* Sub-filter tabs for classification brackets */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto text-xs shadow-xs">
            <span className="text-slate-400 font-bold px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Filtrer :</span>
            </span>
            <button
              onClick={() => setConsolanteCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                consolanteCategory === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous les classements ({tournament.consolanteMatches.length})
            </button>
            <button
              onClick={() => setConsolanteCategory('5-8')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                consolanteCategory === '5-8'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Places 5 à 8 ({tournament.consolanteMatches.filter((m) => m.classificationRankRange?.includes('5-') || m.classificationRankRange?.includes('7-')).length})
            </button>
            <button
              onClick={() => setConsolanteCategory('9-16')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                consolanteCategory === '9-16'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Places 9 à 16 (Consolante Principale) ({tournament.consolanteMatches.filter((m) => m.classificationRankRange?.includes('9-') || m.classificationRankRange?.includes('11-') || m.classificationRankRange?.includes('13-') || m.classificationRankRange?.includes('15-')).length})
            </button>
            {tournament.consolanteMatches.some((m) => m.classificationRankRange?.includes('17-') || m.classificationRankRange?.includes('21-')) && (
              <button
                onClick={() => setConsolanteCategory('17-24')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  consolanteCategory === '17-24'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Places 17 à 24 ({tournament.consolanteMatches.filter((m) => m.classificationRankRange?.includes('17-') || m.classificationRankRange?.includes('19-') || m.classificationRankRange?.includes('21-') || m.classificationRankRange?.includes('23-')).length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL FULL STANDINGS (1 TO N) */}
      {activeTab === 'standings' ? (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Classement Officiel Général (1 à {officialStandings.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Calculé en direct selon les résultats des finales et matchs de classement
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyStandings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                title="Copier le classement au format texte"
              >
                {isCopiedStandings ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedStandings ? 'Copié !' : 'Copier'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                title="Imprimer la feuille de classement officiel"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
            </div>
          </div>

          {/* Podium Highlights */}
          {officialStandings.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1st Place */}
              {(() => {
                const item = officialStandings[0];
                const pair = item?.pairId ? pairsMap.get(item.pairId) : undefined;
                return (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-300 rounded-2xl p-4 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 font-extrabold text-xs text-amber-800 uppercase tracking-wider">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <span>1ère Place · Champions 🏆</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item?.status === 'confirmed' ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-900'
                      }`}>
                        {item?.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                      </span>
                    </div>
                    {pair ? (
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          {pair.player1.club} · Poids #{pair.totalWeight} {pair.seedRank ? `· TS ${pair.seedRank}` : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-1">{item?.detail || 'En attente de la Grande Finale'}</p>
                    )}
                  </div>
                );
              })()}

              {/* 2nd Place */}
              {(() => {
                const item = officialStandings[1];
                const pair = item?.pairId ? pairsMap.get(item.pairId) : undefined;
                return (
                  <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 font-extrabold text-xs text-slate-700 uppercase tracking-wider">
                        <Medal className="w-4 h-4 text-slate-500" />
                        <span>2ème Place · Finalistes 🥈</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item?.status === 'confirmed' ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item?.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                      </span>
                    </div>
                    {pair ? (
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          {pair.player1.club} · Poids #{pair.totalWeight}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-1">{item?.detail || 'En attente de la Grande Finale'}</p>
                    )}
                  </div>
                );
              })()}

              {/* 3rd Place */}
              {(() => {
                const item = officialStandings[2];
                const pair = item?.pairId ? pairsMap.get(item.pairId) : undefined;
                return (
                  <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 font-extrabold text-xs text-amber-900 uppercase tracking-wider">
                        <Award className="w-4 h-4 text-amber-700" />
                        <span>3ème Place 🥉</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item?.status === 'confirmed' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item?.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                      </span>
                    </div>
                    {pair ? (
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          {pair.player1.club} · Poids #{pair.totalWeight}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-1">{item?.detail || 'En attente de la Petite Finale'}</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Full Standings Ladder 1 to N */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-20">Rang</th>
                    <th className="py-3 px-4">Paire Joueurs</th>
                    <th className="py-3 px-4 hidden md:table-cell">Club & Tête de série</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Match Déterminant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officialStandings.map((item) => {
                    const pair = item.pairId ? pairsMap.get(item.pairId) : undefined;
                    const isPodium = item.rank <= 3;

                    return (
                      <tr
                        key={item.rank}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isPodium ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-black text-sm">
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
                            <div className="flex items-center gap-2">
                              <span>
                                {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">En attente de résultat...</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 hidden md:table-cell font-medium">
                          {pair ? (
                            <div className="flex items-center gap-2">
                              <span>{pair.player1.club}</span>
                              {pair.seedRank && (
                                <span className="font-mono text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                                  TS {pair.seedRank}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.status === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Attribué</span>
                            </span>
                          ) : item.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                              <span>En cours</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                              <span>En attente</span>
                            </span>
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
        </div>
      ) : (
        /* TREE BRACKET VIEW (MAIN OR CONSOLANTE) */
        <div className="space-y-4">
          {/* Champion Banner if final completed */}
          {championPair && activeTab === 'main' && (
            <div className="p-4 bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 border border-amber-300 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Vainqueurs du Tournoi 🏆
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {championPair.player1.firstName} {championPair.player1.lastName} & {championPair.player2.firstName} {championPair.player2.lastName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {championPair.player1.club} · Poids #{championPair.totalWeight} {championPair.seedRank ? `· TS ${championPair.seedRank}` : ''}
                  </p>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <span className="text-xs font-mono text-emerald-800 font-bold">
                  Score Finale : {formatScore(finalMatch?.score)}
                </span>
              </div>
            </div>
          )}

          {/* Tree Bracket View */}
          {currentDisplayedMatches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
                <GitBranch className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                {activeTab === 'main' ? 'Tableau Final Principal' : 'Matchs de Classement'} non générés
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cliquez ci-dessous pour générer le tournoi complet (tableau principal + consolantes automatiques pour classer toutes les équipes de 1 à {bracketSize}).
              </p>
              <button
                onClick={() => handleGenerateFullTournament(bracketSize)}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                Générer Tournoi Complet ({bracketSize} équipes)
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 overflow-x-auto touch-pan-x shadow-xs">
              <div className="flex items-stretch gap-6 min-w-[720px] pb-3">
                {sortedRoundNumbers.map((roundNum) => {
                  const roundMatches = roundsMap.get(roundNum) || [];

                  return (
                    <div key={roundNum} className="flex-1 min-w-[260px] flex flex-col">
                      {/* Round Header */}
                      <div className="text-center pb-2.5 mb-3 border-b border-slate-200">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          {activeTab === 'main'
                            ? roundMatches.length === 1
                              ? 'Grande Finale'
                              : roundMatches.length === 2
                              ? roundMatches.some((m) => m.targetRankWinner === 3)
                                ? 'Finales (1-2 et 3-4)'
                                : 'Demi-Finales'
                              : roundMatches.length === 4
                              ? 'Quarts de Finale'
                              : roundMatches.length === 8
                              ? '1/8 de Finale'
                              : '1/16 de Finale'
                            : `Tour de Classement ${roundNum}`}
                        </span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          {roundMatches.length} match(s)
                        </span>
                      </div>

                      {/* Matches Column */}
                      <div className="flex-1 flex flex-col justify-around gap-4">
                        {roundMatches.map((match) => {
                          const p1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                          const p2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                          const isCompleted = match.status === 'completed';

                          return (
                            <div
                              key={match.id}
                              className={`rounded-xl border transition-all shadow-xs ${
                                isCompleted
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              {/* Mini Header with Match # and Target Placement */}
                              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 text-[11px] text-slate-500 bg-slate-50/70 rounded-t-xl">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-bold text-slate-800">M#{match.matchNumber}</span>
                                  {match.targetRankWinner && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                      Places {match.targetRankWinner}e et {match.targetRankLoser}e
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onOpenScoreModal(match)}
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-xs transition-colors shrink-0 ${
                                    isCompleted
                                      ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  }`}
                                >
                                  {isCompleted ? 'Score' : 'Saisir'}
                                </button>
                              </div>

                              {/* Opponents Slots */}
                              <div className="p-2 space-y-1">
                                {/* Pair 1 Slot */}
                                <div
                                  onClick={() =>
                                    setSlotModalInfo({
                                      matchId: match.id,
                                      slot: 'pair1',
                                      roundName: match.roundName,
                                      matchNumber: match.matchNumber,
                                    })
                                  }
                                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                    match.winnerPairId === match.pair1Id
                                      ? 'bg-emerald-50 text-emerald-900 font-extrabold border border-emerald-300'
                                      : 'hover:bg-slate-100 text-slate-800'
                                  }`}
                                  title="Cliquer pour modifier cette position"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {p1?.seedRank && (
                                      <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-1 rounded shrink-0">
                                        TS{p1.seedRank}
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {p1
                                        ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}`
                                        : match.pair1Placeholder || 'Choisir équipe'}
                                    </span>
                                  </div>
                                  {match.winnerPairId === match.pair1Id && (
                                    <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>

                                {/* Pair 2 Slot */}
                                <div
                                  onClick={() =>
                                    setSlotModalInfo({
                                      matchId: match.id,
                                      slot: 'pair2',
                                      roundName: match.roundName,
                                      matchNumber: match.matchNumber,
                                    })
                                  }
                                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                    match.winnerPairId === match.pair2Id
                                      ? 'bg-emerald-50 text-emerald-900 font-extrabold border border-emerald-300'
                                      : 'hover:bg-slate-100 text-slate-800'
                                  }`}
                                  title="Cliquer pour modifier cette position"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {p2?.seedRank && (
                                      <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-1 rounded shrink-0">
                                        TS{p2.seedRank}
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {p2
                                        ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}`
                                        : match.pair2Placeholder || 'Choisir équipe'}
                                    </span>
                                  </div>
                                  {match.winnerPairId === match.pair2Id && (
                                    <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>

                                {/* Score Display */}
                                {match.score && match.score.sets.length > 0 && (
                                  <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-emerald-700 font-bold">
                                    <span>Score :</span>
                                    <span className="tabular-nums">{formatScore(match.score)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slot Placement Selection Modal */}
      {slotModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Affecter la position dans le Tableau
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Match #{slotModalInfo.matchNumber} · {slotModalInfo.slot === 'pair1' ? 'Position 1 (Haut)' : 'Position 2 (Bas)'}
                </h3>
              </div>
              <button
                onClick={() => setSlotModalInfo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-1.5 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setSlotTab('pairs')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  slotTab === 'pairs'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Paire Inscrite ({tournament.pairs.length})
              </button>
              <button
                type="button"
                onClick={() => setSlotTab('winners')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  slotTab === 'winners'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Vainqueur du Principal
              </button>
              <button
                type="button"
                onClick={() => setSlotTab('losers')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  slotTab === 'losers'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Perdant du Principal
              </button>
              <button
                type="button"
                onClick={() => setSlotTab('pools')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  slotTab === 'pools'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Qualifié Poule ({tournament.pools.length})
              </button>
              <button
                type="button"
                onClick={() => setSlotTab('custom')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                  slotTab === 'custom'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Exempt / Libre
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {slotTab === 'pairs' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Rechercher par joueur, club..."
                      value={slotPairSearch}
                      onChange={(e) => setSlotPairSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {filteredSlotPairs.map((pair) => {
                      const occupiedMatchNumber = pairsAlreadyInThisRound.get(pair.id);
                      const isBlocked = occupiedMatchNumber !== undefined;

                      return (
                        <button
                          key={pair.id}
                          type="button"
                          disabled={isBlocked}
                          onClick={() => {
                            if (isBlocked) return;
                            handleAssignToSlot(
                              slotModalInfo.matchId,
                              slotModalInfo.slot,
                              pair.id,
                              `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
                            );
                          }}
                          className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between text-xs ${
                            isBlocked
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 border-slate-200 cursor-pointer shadow-2xs'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {pair.seedRank && (
                                <span className="font-mono text-[10px] text-amber-800 font-bold bg-amber-100 px-1 rounded">
                                  TS {pair.seedRank}
                                </span>
                              )}
                              <span>
                                {pair.player1.lastName} {pair.player1.firstName} & {pair.player2.lastName} {pair.player2.firstName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {pair.player1.club} · Poids #{pair.totalWeight}
                            </p>
                          </div>
                          {isBlocked ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              Déjà dans ce tour (M#{occupiedMatchNumber})
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs">Affecter</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {slotTab === 'winners' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Sélectionnez un match dont le vainqueur sera automatiquement positionné ici :
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {tournament.bracketMatches
                      .filter((m) => m.type !== 'consolante')
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const hasWinner = m.status === 'completed' && m.winnerPairId;
                            handleAssignToSlot(
                              slotModalInfo.matchId,
                              slotModalInfo.slot,
                              hasWinner ? m.winnerPairId : undefined,
                              hasWinner
                                ? `Vainqueur Match #${m.matchNumber}`
                                : `Vainqueur Match #${m.matchNumber} (${m.roundName})`
                            );
                          }}
                          className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-left transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">
                              Match #{m.matchNumber} : {m.roundName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {m.status === 'completed'
                                ? `Score : ${formatScore(m.score)}`
                                : 'En attente de score'}
                            </span>
                          </div>
                          <span className="text-emerald-700 font-bold text-xs">Lier vainqueur</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {slotTab === 'losers' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Sélectionnez un match dont le perdant sera automatiquement positionné ici :
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {tournament.bracketMatches
                      .filter((m) => m.type !== 'consolante')
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (m.status === 'completed' && m.winnerPairId) {
                              const loserId =
                                m.winnerPairId === m.pair1Id ? m.pair2Id : m.pair1Id;
                              handleAssignToSlot(
                                slotModalInfo.matchId,
                                slotModalInfo.slot,
                                loserId,
                                `Perdant Match #${m.matchNumber}`
                              );
                            } else {
                              handleAssignToSlot(
                                slotModalInfo.matchId,
                                slotModalInfo.slot,
                                undefined,
                                `Perdant Match #${m.matchNumber} (${m.roundName})`
                              );
                            }
                          }}
                          className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-left transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">
                              Match #{m.matchNumber} : {m.roundName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {m.status === 'completed'
                                ? `Score : ${formatScore(m.score)}`
                                : 'En attente de score'}
                            </span>
                          </div>
                          <span className="text-amber-700 font-bold text-xs">Lier perdant</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {slotTab === 'pools' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Affecter directement un qualifié de poule :
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {tournament.pools.map((p) => {
                      const top1 = p.standings[0]?.pairId;
                      const top2 = p.standings[1]?.pairId;
                      return (
                        <div key={p.id} className="p-2.5 border border-slate-200 rounded-xl space-y-1.5 bg-slate-50">
                          <span className="font-extrabold text-slate-900 text-xs block">{p.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleAssignToSlot(
                                slotModalInfo.matchId,
                                slotModalInfo.slot,
                                top1,
                                `1er ${p.name}`
                              )
                            }
                            className="w-full text-left px-2 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded text-xs text-slate-800 font-semibold"
                          >
                            1er de poule {top1 ? '✓' : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAssignToSlot(
                                slotModalInfo.matchId,
                                slotModalInfo.slot,
                                top2,
                                `2e ${p.name}`
                              )
                            }
                            className="w-full text-left px-2 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded text-xs text-slate-800 font-semibold"
                          >
                            2e de poule {top2 ? '✓' : ''}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {slotTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Libellé personnalisé (ex: &ldquo;Exempt&rdquo;, &ldquo;Bye&rdquo;, &ldquo;Qualifié Q1&rdquo;)
                    </label>
                    <input
                      type="text"
                      value={customPlaceholder}
                      onChange={(e) => setCustomPlaceholder(e.target.value)}
                      placeholder="Ex: Exempt / Bye"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleAssignToSlot(
                          slotModalInfo.matchId,
                          slotModalInfo.slot,
                          undefined,
                          customPlaceholder || 'Exempt (Bye)'
                        )
                      }
                      className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAssignToSlot(
                          slotModalInfo.matchId,
                          slotModalInfo.slot,
                          undefined,
                          undefined
                        )
                      }
                      className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
                    >
                      Vider la case
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing Bracket */}
      {isClearTableauModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Confirmation de suppression
                </h3>
                <p className="text-xs text-slate-500">
                  Voulez-vous supprimer l&apos;ensemble du tableau final et des consolantes associées ?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearTableauModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBracket}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

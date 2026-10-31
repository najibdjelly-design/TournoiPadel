import React, { useState } from 'react';
import { Tournament, Pool, Match, Pair } from '../../types/tournament';
import {
  computePoolStandings,
  generatePoolMatches,
  formatScore,
  distributePairsBySerpentine,
  distributePairsByRankTier,
} from '../../utils/padelCalculations';
import { findSamePoolClashes, resolvePoolQualifiers } from '../../utils/poolQualifiers';
import {
  Grid3X3,
  Shuffle,
  Trophy,
  Award,
  Trash2,
  AlertTriangle,
  X,
  History,
  Layers,
  Edit3,
  UserPlus,
  Check,
  RotateCcw,
} from 'lucide-react';
import { PairPoolHistoryModal } from '../modals/PairPoolHistoryModal';

interface PoulesModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
  onOpenScoreModal: (match: Match) => void;
}

export const PoulesModule: React.FC<PoulesModuleProps> = ({
  tournament,
  onUpdateTournament,
  onOpenScoreModal,
}) => {
  const [selectedPoolId, setSelectedPoolId] = useState<string>(
    tournament.pools[0]?.id || ''
  );
  const [poolsCountToGenerate, setPoolsCountToGenerate] = useState<number>(6); // Default 6 pools for 24 teams
  const [pairsPerPoolCount, setPairsPerPoolCount] = useState<number>(4); // 6 x 4 = 24 or 8 x 3 = 24
  const [qualifiedPerPool, setQualifiedPerPool] = useState<number>(1);
  const [activeDrawMethod, setActiveDrawMethod] = useState<'serpentine' | 'tier' | 'manual'>('serpentine');
  const [isClearPoolsModalOpen, setIsClearPoolsModalOpen] = useState(false);
  const [poolToClearScores, setPoolToClearScores] = useState<Pool | null>(null);
  const [pairToRemove, setPairToRemove] = useState<{ poolId: string; pairId: string; pairName: string } | null>(null);
  const [selectedPairHistory, setSelectedPairHistory] = useState<Pair | null>(null);
  const [manualRankFilter, setManualRankFilter] = useState('all');
  const [manualSearch, setManualSearch] = useState('');
  const [manualSourcePhase, setManualSourcePhase] = useState(1);

  // Manual assignment state
  const [assigningSlot, setAssigningSlot] = useState<{ poolId: string } | null>(null);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));

  // Clear all pools handler (with explicit confirmation)
  const handleConfirmClearPools = () => {
    onUpdateTournament({
      ...tournament,
      pools: [],
    });
    setIsClearPoolsModalOpen(false);
  };

  // Clear scores for a single pool (with in-app confirmation)
  const handleConfirmClearPoolScores = (poolId: string) => {
    const updatedPools = tournament.pools.map(pool => {
      if (pool.id !== poolId) return pool;

      const resetMatches = pool.matches.map(m => ({
        ...m,
        score: undefined,
        winnerPairId: undefined,
        status: 'scheduled' as const,
      }));

      const updatedPool: Pool = {
        ...pool,
        matches: resetMatches,
      };
      updatedPool.standings = computePoolStandings(updatedPool, pairsMap);
      return updatedPool;
    });

    onUpdateTournament({
      ...tournament,
      pools: updatedPools,
    });
    setPoolToClearScores(null);
  };

  const poolLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const poolPhase = (pool: Pool) => pool.phase ?? 1;
  const currentPhase = tournament.pools.reduce(
    (highest, pool) => Math.max(highest, poolPhase(pool)),
    0
  );
  const sourcePhase = tournament.pools
    .filter(pool => pool.pairIds.length > 0 || pool.matches.length > 0)
    .reduce(
    (highest, pool) => Math.max(highest, poolPhase(pool)),
    0
  );
  const sourcePools = tournament.pools.filter(pool => poolPhase(pool) === sourcePhase);
  const availablePhases = [...new Set(tournament.pools.map(poolPhase))].sort((a, b) => a - b);
  const manualSourcePools = tournament.pools.filter(
    pool => poolPhase(pool) === manualSourcePhase
  );

  const createPoolsForNextPhase = (
    distribution: string[][],
    classificationNames?: string[]
  ) => {
    const phase = currentPhase + 1;
    const existingPoolCount = tournament.pools.filter(pool => poolPhase(pool) === phase).length;
    const pools: Pool[] = [];
    let matchCounter = tournament.pools.flatMap(pool => pool.matches)
      .reduce((highest, match) => Math.max(highest, match.matchNumber), 0) + 1;

    distribution.forEach((pairIds, index) => {
      const poolLetter = poolLetters[(existingPoolCount + index) % poolLetters.length];
      const poolName = classificationNames?.[index] ?? `Poule ${poolLetter}`;
      const id = `pool_p${phase}_${poolLetter.toLowerCase()}_${Date.now()}_${index}`;
      const matches = generatePoolMatches(
        tournament.id,
        id,
        poolName,
        pairIds,
        matchCounter
      );
      matchCounter += matches.length;
      const pool: Pool = {
        id,
        tournamentId: tournament.id,
        name: poolName,
        phase,
        classification: classificationNames?.[index],
        pairIds,
        matches,
        standings: [],
        qualifiedCount: 1,
      };
      pool.standings = computePoolStandings(pool, pairsMap);
      pools.push(pool);
    });

    onUpdateTournament({ ...tournament, pools: [...tournament.pools, ...pools] });
    if (pools[0]) setSelectedPoolId(pools[0].id);
  };

  const handleGenerateClassificationPools = () => {
    if (sourcePools.length === 0) return;
    const incompletePools = sourcePools.filter(pool =>
      pool.pairIds.length > 0 &&
      (pool.matches.length === 0 || pool.matches.some(match => match.status !== 'completed'))
    );
    if (incompletePools.length) {
      alert(`Terminez tous les matches de la phase ${sourcePhase} avant de créer les poules de classement.`);
      return;
    }

    const names = ['Poule d’Or', 'Poule d’Argent', 'Poule de Bronze'];
    const rankedPairs = names.map((_, rankIndex) =>
      sourcePools
        .map(pool => pool.standings.find(standing => standing.rank === rankIndex + 1)?.pairId)
        .filter((pairId): pairId is string => Boolean(pairId))
    );
    const activeRanks = rankedPairs
      .map((pairIds, index) => ({ pairIds, name: names[index] }))
      .filter(group => group.pairIds.length > 0);

    if (activeRanks.some(group => group.pairIds.some(pairId =>
      tournament.pools.some(pool => poolPhase(pool) > sourcePhase && pool.pairIds.includes(pairId))
    ))) {
      alert('Une ou plusieurs équipes de cette phase sont déjà inscrites dans une phase suivante.');
      return;
    }
    createPoolsForNextPhase(
      activeRanks.map(group => group.pairIds),
      activeRanks.map(group => group.name)
    );
  };

  // Method 1: Tirage Serpentin
  const handleGenerateSerpentine = () => {
    const poolPairs = tournament.pairs.filter(p => !p.isDirectTableau && p.status === 'confirmed');
    if (poolPairs.length === 0) {
      alert('Aucune paire disponible pour les poules (vérifiez les inscriptions et les admissions directes).');
      return;
    }

    const sorted = [...poolPairs].sort((a, b) => a.totalWeight - b.totalWeight);
    const sortedIds = sorted.map(p => p.id);
    const distributed = distributePairsBySerpentine(sortedIds, poolsCountToGenerate);

    createPoolsWithDistribution(distributed);
  };

  // Method 2: Tirage par Rang / Chapeaux
  const handleGenerateByRankTier = () => {
    const poolPairs = tournament.pairs.filter(p => !p.isDirectTableau && p.status === 'confirmed');
    if (poolPairs.length === 0) {
      alert('Aucune paire disponible pour les poules (vérifiez les inscriptions et les admissions directes).');
      return;
    }

    const sorted = [...poolPairs].sort((a, b) => a.totalWeight - b.totalWeight);
    const sortedIds = sorted.map(p => p.id);
    const distributed = distributePairsByRankTier(sortedIds, poolsCountToGenerate);

    createPoolsWithDistribution(distributed);
  };

  // Method 3: Initialiser des poules vides pour constitution manuelle
  const handleInitManualPools = () => {
    const pools: Pool[] = [];
    const phase = currentPhase + 1;
    const startIndex = tournament.pools.filter(pool => poolPhase(pool) === phase).length;
    for (let i = 0; i < poolsCountToGenerate; i++) {
      const letter = poolLetters[(startIndex + i) % poolLetters.length];
      pools.push({
        id: `pool_p${phase}_${letter.toLowerCase()}_${Date.now()}_${i}`,
        tournamentId: tournament.id,
        name: `Poule ${letter}`,
        phase,
        pairIds: [],
        matches: [],
        standings: [],
        qualifiedCount: qualifiedPerPool,
      });
    }

    onUpdateTournament({
      ...tournament,
      pools: [...tournament.pools, ...pools],
    });
    if (pools[0]) setSelectedPoolId(pools[0].id);
  };

  const createPoolsWithDistribution = (distribution: string[][]) => {
    if (
      tournament.pools.length > 0 &&
      !window.confirm('Créer une nouvelle phase ? Les poules et scores existants seront conservés.')
    ) {
      return;
    }
    createPoolsForNextPhase(distribution);
  };

  // Assign pair manually to pool
  const handleAssignPairToPool = (poolId: string, pairId: string) => {
    const targetPool = tournament.pools.find(pool => pool.id === poolId);
    if (!targetPool) return;
    const phase = poolPhase(targetPool);
    let matchCounter = tournament.pools.flatMap(pool => pool.matches)
      .reduce((highest, match) => Math.max(highest, match.matchNumber), 0) + 1;
    const updatedPools = tournament.pools.map(pool => {
      let p = { ...pool };
      if (pool.id === poolId) {
        if (!p.pairIds.includes(pairId)) {
          p.pairIds = [...p.pairIds, pairId];
        }
      } else if (poolPhase(pool) === phase) {
        p.pairIds = p.pairIds.filter(id => id !== pairId);
      }
      const existingPairings = new Set(
        p.matches.map(match => [match.pair1Id, match.pair2Id].sort().join(':'))
      );
      const newMatches = generatePoolMatches(
        tournament.id,
        p.id,
        p.name,
        p.pairIds,
        matchCounter
      ).filter(match => !existingPairings.has([match.pair1Id, match.pair2Id].sort().join(':')));
      matchCounter += newMatches.length;
      p.matches = [...p.matches, ...newMatches];
      p.standings = computePoolStandings(p, pairsMap);
      return p;
    });

    onUpdateTournament({
      ...tournament,
      pools: updatedPools,
    });
    setAssigningSlot(null);
  };

  // Request pair removal (opens in-app confirmation modal)
  const handleRequestRemovePairFromPool = (poolId: string, pairId: string) => {
    const pair = pairsMap.get(pairId);
    const pairName = pair
      ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
      : 'cette paire';
    setPairToRemove({ poolId, pairId, pairName });
  };

  const handleConfirmRemovePairFromPool = () => {
    if (!pairToRemove) return;
    const { poolId, pairId } = pairToRemove;

    const updatedPools = tournament.pools.map(pool => {
      let p = { ...pool };
      if (pool.id === poolId) {
        p.pairIds = p.pairIds.filter(id => id !== pairId);
      }
      p.standings = computePoolStandings(p, pairsMap);
      return p;
    });

    onUpdateTournament({
      ...tournament,
      pools: updatedPools,
    });
    setPairToRemove(null);
  };

  // Push pool winners into main tableau bracket slots
  const handlePropagateQualifiersToBracket = () => {
    if (tournament.bracketMatches.length > 0 && !tournament.bracketLabelsEditable) return;
    if (tournament.pools.length === 0 || tournament.bracketMatches.length === 0) {
      alert("Il faut d'abord générer des poules et un tableau final.");
      return;
    }

    const { matches: updatedBracket, filled, pendingPools } = resolvePoolQualifiers(
      tournament.bracketMatches,
      tournament.pools
    );

    onUpdateTournament({
      ...tournament,
      bracketMatches: updatedBracket,
    });

    const clashes = findSamePoolClashes(updatedBracket);
    const clashNote = clashes.length
      ? `\nAttention : ${clashes.length} match(s) opposent deux qualifiés de la même poule (${clashes.map(m => m.roundName).join(', ')}). Les règles FFT demandent de les éviter : modifiez les emplacements.`
      : '';

    alert(
      (pendingPools.length
        ? `${filled} qualifié(s) intégré(s). Poules non terminées : ${pendingPools.join(', ')}.`
        : `${filled} qualifié(s) de poule intégré(s) dans le Tableau Final !`) + clashNote
    );
  };

  const activePool = tournament.pools.find(p => p.id === selectedPoolId) || tournament.pools[0];
  const activePhase = activePool ? poolPhase(activePool) : currentPhase;
  const assigningPool = assigningSlot
    ? tournament.pools.find(pool => pool.id === assigningSlot.poolId)
    : undefined;
  const assigningPoolPhase = assigningPool ? poolPhase(assigningPool) : activePhase;

  // A pair may participate in later phases without being removed from its earlier pool.
  const assignedPairIds = new Set(
    tournament.pools
      .filter(pool => poolPhase(pool) === activePhase)
      .flatMap(pool => pool.pairIds)
  );
  const unassignedPairs = tournament.pairs.filter(
    p => p.status === 'confirmed' && !p.isDirectTableau && !assignedPairIds.has(p.id)
  );
  const sourcePairRanks = new Map<string, number>();
  for (const pool of manualSourcePools) {
    for (const standing of pool.standings) sourcePairRanks.set(standing.pairId, standing.rank);
  }
  const manualCandidates = tournament.pairs
    .filter(pair => pair.status === 'confirmed' && !pair.isDirectTableau)
    .filter(pair => {
      const rank = sourcePairRanks.get(pair.id);
      const matchesRank = manualRankFilter === 'all' ||
        (manualRankFilter === '3+' ? (rank ?? 0) >= 3 : rank === Number(manualRankFilter));
      const search = manualSearch.trim().toLocaleLowerCase();
      const matchesSearch = !search || [
        pair.player1.firstName, pair.player1.lastName,
        pair.player2.firstName, pair.player2.lastName,
        pair.player1.club, pair.player2.club,
      ].some(value => value.toLocaleLowerCase().includes(search));
      return matchesRank && matchesSearch;
    })
    .sort((a, b) =>
      (sourcePairRanks.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (sourcePairRanks.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Poules Qualificatives & Classements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            3 méthodes disponibles : Tirage Serpentin, Tirage par Rang ou Assignation Manuelle (pensé pour formats 24 équipes)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tournament.pools.length > 0 && (
            <button
              onClick={handlePropagateQualifiersToBracket}
              disabled={tournament.bracketMatches.length > 0 && !tournament.bracketLabelsEditable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs"
              title={tournament.bracketMatches.length > 0 && !tournament.bracketLabelsEditable
                ? 'Activez l’édition du tableau final pour modifier les équipes affectées'
                : 'Transférer les qualifiés dans le tableau final'}
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-700" />
              <span>Qualifier dans Tableau &rarr;</span>
            </button>
          )}

          {sourcePools.length > 0 && (
            <button
              type="button"
              onClick={handleGenerateClassificationPools}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-xs"
              title={`Créer les poules Or, Argent et Bronze à partir des classements de la phase ${sourcePhase}`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Créer Or / Argent / Bronze</span>
            </button>
          )}

          {tournament.pools.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearPoolsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
              title="Vider et supprimer toutes les poules (avec confirmation)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider les poules</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Methods Generation Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mode de constitution des poules :
            </span>
          </div>

          {/* Method selector tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveDrawMethod('serpentine')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeDrawMethod === 'serpentine'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Serpentin (FFT)
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawMethod('tier')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeDrawMethod === 'tier'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Par Rang / Chapeaux
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawMethod('manual')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeDrawMethod === 'manual'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Assignation Manuelle
            </button>
          </div>
        </div>

        {/* Action strip for chosen method */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Nombre de poules :</span>
              <select
                value={poolsCountToGenerate}
                onChange={(e) => setPoolsCountToGenerate(parseInt(e.target.value) || 6)}
                className="bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1 rounded-lg"
              >
                <option value="2">2 Poules</option>
                <option value="3">3 Poules</option>
                <option value="4">4 Poules</option>
                <option value="6">6 Poules (Format 24 équipes : 6×4)</option>
                <option value="8">8 Poules (Format 24 équipes : 8×3)</option>
              </select>
            </div>

            {activeDrawMethod === 'manual' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Paires par poule :</span>
                <select
                  value={pairsPerPoolCount}
                  onChange={(e) => setPairsPerPoolCount(parseInt(e.target.value) || 4)}
                  className="bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1 rounded-lg"
                >
                  <option value="3">3 Paires (ex: 8 poules de 3 = 24 paires)</option>
                  <option value="4">4 Paires (ex: 6 poules de 4 = 24 paires)</option>
                  <option value="5">5 Paires</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Qualifiés / poule :</span>
              <select
                value={qualifiedPerPool}
                onChange={(e) => setQualifiedPerPool(parseInt(e.target.value) || 1)}
                className="bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1 rounded-lg"
              >
                <option value="1">1 Qualifié (1er de poule)</option>
                <option value="2">2 Qualifiés (1er et 2e)</option>
              </select>
            </div>
          </div>

          <div>
            {activeDrawMethod === 'serpentine' && (
              <button
                type="button"
                onClick={handleGenerateSerpentine}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Lancer Tirage Serpentin</span>
              </button>
            )}

            {activeDrawMethod === 'tier' && (
              <button
                type="button"
                onClick={handleGenerateByRankTier}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lancer Tirage par Rang / Chapeaux</span>
              </button>
            )}

            {activeDrawMethod === 'manual' && (
              <button
                type="button"
                onClick={handleInitManualPools}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Créer {poolsCountToGenerate} Poules Vides (Assigner Manuellement)</span>
              </button>
            )}
          </div>
        </div>

        {/* Helpful text for active method */}
        <p className="text-[11px] text-slate-500 pt-1">
          {activeDrawMethod === 'serpentine' &&
            'La méthode en serpentin équilibre parfaitement les poules en alternant les têtes de séries (1er en A, 2e en B, etc., puis inversement).'}
          {activeDrawMethod === 'tier' &&
            'La méthode par chapeaux place les têtes de série 1 dans chaque poule, puis tire les joueurs du chapeau 2, 3, etc.'}
          {activeDrawMethod === 'manual' &&
            'La méthode manuelle vous donne les pleins pouvoirs : vous choisissez le nombre de poules et placez vous-même chaque équipe.'}
        </p>
      </div>

      {/* Unassigned pairs strip if in manual mode */}
      {tournament.pools.length > 0 && activeDrawMethod === 'manual' && unassignedPairs.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900">
              Paires inscrites non assignées ({unassignedPairs.length}) :
            </span>
            <span className="text-[11px] text-amber-700">
              Sélectionnez une poule ci-dessous puis cliquez sur &ldquo;+ Ajouter à cette poule&rdquo;
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedPairs.map(p => (
              <span
                key={p.id}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-slate-800 font-semibold text-xs shadow-2xs"
              >
                {p.player1.firstName} {p.player1.lastName} / {p.player2.firstName} {p.player2.lastName} (Poids #{p.totalWeight})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Pools Display */}
      {tournament.pools.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
            <Grid3X3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">Aucune poule générée pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Choisissez l&apos;une des 3 méthodes ci-dessus (Serpentin, Rang ou Manuelle) pour créer les poules de votre épreuve.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Pool Tabs */}
          {currentPhase > 1 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900">
              Les poules sont conservées par phase. Les poules de classement de la phase {currentPhase}
              {' '}n’effacent pas les poules ni les scores des phases précédentes.
            </div>
          )}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
            {tournament.pools.map((p) => {
              const isActive = (activePool?.id || '') === p.id;
              const matchesCount = p.matches.length;
              const completedCount = p.matches.filter(m => m.status === 'completed').length;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPoolId(p.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors min-h-[38px] ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className={`rounded px-1 py-0.5 text-[9px] ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    P{poolPhase(p)}
                  </span>
                  <span>{p.name}</span>
                  <span className={`text-[10px] font-mono ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                    ({p.pairIds.length} paires · {completedCount}/{matchesCount} m.)
                  </span>
                </button>
              );
            })}
          </div>

          {activePool && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Standings Table (7 cols) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Classement Officiel · {activePool.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPoolToClearScores(activePool)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs"
                      title={`Vider tous les scores de la ${activePool.name}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>Vider les scores</span>
                    </button>
                    <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Top {activePool.qualifiedCount} qualifié(s)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto touch-pan-x">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">Rg</th>
                        <th className="py-2.5 px-3">Paire</th>
                        <th className="py-2.5 px-2 text-center">Pts</th>
                        <th className="py-2.5 px-2 text-center">J</th>
                        <th className="py-2.5 px-2 text-center">V</th>
                        <th className="py-2.5 px-2 text-center">D</th>
                        <th className="py-2.5 px-2 text-center">Sets</th>
                        <th className="py-2.5 px-2 text-center">Diff S.</th>
                        <th className="py-2.5 px-2 text-center">Jeux</th>
                        <th className="py-2.5 px-2 text-center">Diff J.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {activePool.standings.map((st, idx) => {
                        const pair = pairsMap.get(st.pairId);
                        const isQualif = idx < activePool.qualifiedCount;

                        return (
                          <tr
                            key={st.pairId}
                            className={`hover:bg-slate-50 transition-colors ${
                              isQualif ? 'bg-emerald-50/50 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                              {st.rank}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900">
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => pair && setSelectedPairHistory(pair)}
                                  className="text-left hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                                  title="Cliquer pour voir l'historique des matches"
                                >
                                  <span>{pair ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}` : 'Paire'}</span>
                                  <History className="w-3 h-3 text-slate-400" />
                                </button>
                                {isQualif && (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                                    Qualifié
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-extrabold text-emerald-700">
                              {st.points}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-600">{st.played}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-900">{st.won}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-900">{st.lost}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                              {st.setsWon}/{st.setsLost}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                              {st.setDiff > 0 ? `+${st.setDiff}` : st.setDiff}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                              {st.gamesWon}/{st.gamesLost}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                              {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Manual pair assignment in this pool */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Paires dans {activePool.name} ({activePool.pairIds.length}) :
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setManualSourcePhase(sourcePhase || activePhase);
                        setManualRankFilter('all');
                        setManualSearch('');
                        setAssigningSlot({ poolId: activePool.id });
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Ajouter une paire</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePool.pairIds.map(pid => {
                      const p = pairsMap.get(pid);
                      if (!p) return null;
                      return (
                        <div
                          key={pid}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 truncate block">
                              {p.player1.firstName} {p.player1.lastName} / {p.player2.firstName} {p.player2.lastName}
                            </span>
                            <span className="text-[10px] text-slate-500">Poids #{p.totalWeight}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRequestRemovePairFromPool(activePool.id, pid)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Retirer cette paire de la poule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Pool Matches (5 cols) */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Matches de la {activePool.name} ({activePool.matches.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">
                      {activePool.matches.filter(m => m.status === 'completed').length} joués
                    </span>
                    <button
                      type="button"
                      onClick={() => setPoolToClearScores(activePool)}
                      className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1 shadow-2xs"
                      title={`Vider les scores de la ${activePool.name}`}
                    >
                      <RotateCcw className="w-3 h-3 text-rose-600" />
                      <span>Vider</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {activePool.matches.map((match) => {
                    const p1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                    const p2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                    const isCompleted = match.status === 'completed';

                    return (
                      <div
                        key={match.id}
                        className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
                          isCompleted
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700">Match #{match.matchNumber}</span>
                          <button
                            type="button"
                            onClick={() => onOpenScoreModal(match)}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                          >
                            {isCompleted ? 'Modifier Score' : 'Saisir Score'}
                          </button>
                        </div>

                        {/* Teams */}
                        <div className="space-y-1">
                          <div
                            className={`flex items-center justify-between font-semibold ${
                              match.winnerPairId === match.pair1Id
                                ? 'text-emerald-800 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">
                              {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : 'Équipe 1'}
                            </span>
                            {match.winnerPairId === match.pair1Id && (
                              <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>

                          <div
                            className={`flex items-center justify-between font-semibold ${
                              match.winnerPairId === match.pair2Id
                                ? 'text-emerald-800 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">
                              {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : 'Équipe 2'}
                            </span>
                            {match.winnerPairId === match.pair2Id && (
                              <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        {match.score && (
                          <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-emerald-700 font-bold">
                            <span>Score :</span>
                            <span>{formatScore(match.score)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Pair Selection Modal */}
      {assigningSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900">
                Ajouter une paire dans {assigningPool?.name ?? 'la poule'}
              </h3>
              <button
                type="button"
                onClick={() => setAssigningSlot(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="search"
                  value={manualSearch}
                  onChange={event => setManualSearch(event.target.value)}
                  placeholder="Filtrer par nom ou club"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-600"
                />
                <select
                  value={manualRankFilter}
                  onChange={event => setManualRankFilter(event.target.value)}
                  aria-label="Filtrer les paires par classement dans la phase précédente"
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold"
                >
                  <option value="all">Tous les rangs · phase {sourcePhase}</option>
                  <option value="1">1ers de poule</option>
                  <option value="2">2es de poule</option>
                  <option value="3">3es et suivants</option>
                </select>
                <select
                  value={manualSourcePhase}
                  onChange={event => {
                    setManualSourcePhase(Number(event.target.value));
                    setManualRankFilter('all');
                  }}
                  aria-label="Choisir la phase utilisée pour filtrer les équipes"
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold sm:col-span-2"
                >
                  {availablePhases.map(phase => (
                    <option key={phase} value={phase}>Classement de la phase {phase}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {['all', '1', '2', '3+'].map(rank => (
                  <button
                    key={rank}
                    type="button"
                    onClick={() => setManualRankFilter(rank)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      manualRankFilter === rank
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {rank === 'all' ? 'Tout' : rank === '3+' ? '3e et suivants' : `${rank}ers de poule`}
                  </button>
                ))}
              </div>
              {manualCandidates.map(pair => {
                  const currentPhasePool = tournament.pools.find(
                    pool => poolPhase(pool) === assigningPoolPhase && pool.pairIds.includes(pair.id)
                  );
                  const previousPool = tournament.pools.find(pool => pool.pairIds.includes(pair.id));

                  return (
                    <button
                      key={pair.id}
                      type="button"
                      onClick={() => handleAssignPairToPool(assigningSlot.poolId, pair.id)}
                      disabled={currentPhasePool?.id === assigningSlot.poolId}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {pair.player1.club} · Poids #{pair.totalWeight}
                        </p>
                      </div>

                      {currentPhasePool || previousPool ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          {currentPhasePool?.id === assigningSlot.poolId
                            ? 'Déjà dans cette poule'
                            : currentPhasePool
                            ? `Déplacer depuis ${currentPhasePool.name}`
                            : `Phase précédente : ${previousPool?.name ?? 'non classée'}`}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700">Assigner &rarr;</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Vider les poules */}
      {isClearPoolsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Confirmation : Vider les poules</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer l&apos;ensemble des poules et des matches de poules ? Vos paires inscrites seront conservées.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsClearPoolsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmClearPools}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Vider les scores d'une poule */}
      {poolToClearScores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Vider les scores · {poolToClearScores.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Êtes-vous sûr de vouloir réinitialiser tous les scores et résultats de la <strong>{poolToClearScores.name}</strong> ?
                  Les {poolToClearScores.matches.length} matches repasseront au statut &ldquo;à jouer&rdquo; et le classement sera remis à zéro. Les équipes restent dans la poule.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPoolToClearScores(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClearPoolScores(poolToClearScores.id)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Confirmer : Vider les scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Retirer une paire d'une poule */}
      {pairToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Retirer de la poule</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Êtes-vous sûr de vouloir retirer la paire <strong>{pairToRemove.pairName}</strong> de cette poule ?
                  Les matches de la poule seront regénérés automatiquement.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPairToRemove(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRemovePairFromPool}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Retirer la paire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pair Pool History Modal */}
      {selectedPairHistory && (
        <PairPoolHistoryModal
          pair={selectedPairHistory}
          pool={activePool}
          allMatches={[
            ...tournament.pools.flatMap((p) => p.matches),
            ...tournament.bracketMatches,
            ...tournament.consolanteMatches,
          ]}
          allPairs={tournament.pairs}
          isOpen={true}
          onClose={() => setSelectedPairHistory(null)}
          onOpenScoreModal={onOpenScoreModal}
        />
      )}
    </div>
  );
};

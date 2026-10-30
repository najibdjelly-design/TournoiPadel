import React, { useState, useMemo, useEffect } from 'react';
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
  ArrowLeft,
  ChevronRight,
  Plus,
  GripVertical,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  compactConsolanteLoserSlots,
  resolveBracketByes,
  resolveMatchOutcomeReferences,
  resolveMatchOutcomePlaceholder,
} from '../../utils/padelSchedule';

const CUSTOM_CLASSIFICATION_COHORT_SIZES = [2, 4, 8, 16, 24, 32] as const;

function findCustomFinalPlacement(
  orderedRounds: Array<[number, Match[]]>
): { championshipMatch: Match; thirdPlaceMatch: Match; semifinalRound: number } | undefined {
  const finalRound = orderedRounds.at(-1)?.[1];
  const semifinalRound = orderedRounds.at(-2);
  if (finalRound?.length !== 2 || semifinalRound?.[1].length !== 2) return undefined;

  const championshipMatch = finalRound.find(match =>
    match.targetRankWinner === 1 ||
    [match.pair1Placeholder, match.pair2Placeholder].some(placeholder => /vainqueur/i.test(placeholder ?? ''))
  );
  const thirdPlaceMatch = finalRound.find(match =>
    match.targetRankWinner === 3 ||
    [match.pair1Placeholder, match.pair2Placeholder].some(placeholder => /perdant/i.test(placeholder ?? ''))
  );
  if (!championshipMatch || !thirdPlaceMatch || championshipMatch.id === thirdPlaceMatch.id) {
    return undefined;
  }
  return { championshipMatch, thirdPlaceMatch, semifinalRound: semifinalRound[0] };
}

interface TableauModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
  onOpenScoreModal: (match: Match) => void;
}

function buildSeedOrder(size: number): number[] {
  let order = [1, 2];
  for (let bracketSize = 2; bracketSize < size; bracketSize *= 2) {
    order = order.flatMap(seed => [seed, bracketSize * 2 + 1 - seed]);
  }
  return order;
}

function connectAdjacentBracketMatches(matches: Match[]): Match[] {
  const matchesWithStableReferences = matches.map(match => {
    const stableMatch = { ...match };
    for (const slot of ['pair1', 'pair2'] as const) {
      if (stableMatch[`${slot}SourceMatchId`]) continue;
      const placeholder = stableMatch[`${slot}Placeholder`] ?? '';
      const reference = placeholder.match(
        /^(Vainqueur|Perdant)\s+(?:Match\s*#|M#)\s*(\d+)\b/i
      );
      if (!reference) continue;
      const source = matches.find(candidate =>
        candidate.type !== 'consolante' &&
        candidate.matchNumber === Number(reference[2])
      );
      if (!source) continue;
      stableMatch[`${slot}SourceMatchId`] = source.id;
      stableMatch[`${slot}SourceOutcome`] =
        reference[1].toLowerCase() === 'perdant' ? 'loser' : 'winner';
    }
    return stableMatch;
  });
  const rounds = new Map<number, Match[]>();
  for (const match of matchesWithStableReferences) {
    const round = match.bracketRound ?? 1;
    const roundMatches = rounds.get(round) ?? [];
    roundMatches.push(match);
    rounds.set(round, roundMatches);
  }

  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);
  const roundNumberByOriginal = new Map(
    sortedRounds.map(([round], index) => [round, index + 1])
  );
  const normalizedMatches = matchesWithStableReferences.map(match => ({
    ...match,
    bracketRound: roundNumberByOriginal.get(match.bracketRound ?? 1) ?? 1,
  }));
  const normalizedRounds = new Map<number, Match[]>();
  for (const match of normalizedMatches) {
    const roundMatches = normalizedRounds.get(match.bracketRound ?? 1) ?? [];
    roundMatches.push(match);
    normalizedRounds.set(match.bracketRound ?? 1, roundMatches);
  }

  const orderedRounds = new Map(
    [...normalizedRounds].map(([round, roundMatches]) => [
      round,
      roundMatches.sort((a, b) =>
        (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
      ),
    ])
  );
  const orderedRoundEntries = [...orderedRounds.entries()].sort(([a], [b]) => a - b);
  const parallelFinalPlacement = findCustomFinalPlacement(orderedRoundEntries);
  const sequentialFinalPlacement =
    orderedRoundEntries.length >= 3 &&
    orderedRoundEntries.at(-3)?.[1].length === 2 &&
    orderedRoundEntries.at(-2)?.[1].length === 1 &&
    orderedRoundEntries.at(-1)?.[1].length === 1;
  const hasThirdPlaceMatch = Boolean(parallelFinalPlacement || sequentialFinalPlacement);
  const semifinalRound = parallelFinalPlacement?.semifinalRound ??
    (sequentialFinalPlacement ? orderedRoundEntries.at(-3)?.[0] : undefined);
  const thirdPlaceMatch = parallelFinalPlacement?.thirdPlaceMatch ??
    (sequentialFinalPlacement ? orderedRoundEntries.at(-2)?.[1][0] : undefined);
  const championshipMatch = parallelFinalPlacement?.championshipMatch ??
    (sequentialFinalPlacement ? orderedRoundEntries.at(-1)?.[1][0] : undefined);
  const matchNumbers = new Map<string, number>();
  let matchNumber = 1;
  for (const roundMatches of orderedRoundEntries.map(([, list]) => list)) {
    for (const match of roundMatches) matchNumbers.set(match.id, matchNumber++);
  }

  const selectedWinnerRoutes = new Map<string, { targetId: string; slot: 'pair1' | 'pair2' }>();
  const selectedLoserRoutes = new Map<string, { targetId: string; slot: 'pair1' | 'pair2' }>();
  for (const target of normalizedMatches) {
    for (const slot of ['pair1', 'pair2'] as const) {
      const sourceId = target[`${slot}SourceMatchId`];
      const outcome = target[`${slot}SourceOutcome`];
      if (!sourceId || !outcome) continue;
      const routes = outcome === 'winner' ? selectedWinnerRoutes : selectedLoserRoutes;
      routes.set(sourceId, { targetId: target.id, slot });
    }
  }

  const updatedMatches = normalizedMatches.map(match => {
    const round = match.bracketRound ?? 1;
    const roundMatches = orderedRounds.get(round) ?? [];
    const index = roundMatches.findIndex(item => item.id === match.id);
    const nextRound = orderedRounds.get(round + 1);
    const isSemifinal = hasThirdPlaceMatch && round === semifinalRound;
    const isThirdPlaceMatch = sequentialFinalPlacement
      ? round === orderedRoundEntries.at(-2)?.[0]
      : parallelFinalPlacement?.thirdPlaceMatch.id === match.id;
    const nextMatch = isSemifinal
      ? championshipMatch
      : isThirdPlaceMatch ? undefined
      : index >= 0 ? nextRound?.[Math.floor(index / 2)] : undefined;
    const nextMatchSlot: 'pair1' | 'pair2' = index % 2 === 0 ? 'pair1' : 'pair2';
    const selectedWinnerRoute = selectedWinnerRoutes.get(match.id);
    const selectedLoserRoute = selectedLoserRoutes.get(match.id);
    return {
      ...match,
      matchNumber: matchNumbers.get(match.id) ?? match.matchNumber,
      roundName: `${match.bracketRoundName || `Tour ${round}`} (#${index + 1})`,
      bracketSlotIndex: index,
      nextMatchId: selectedWinnerRoute?.targetId ?? nextMatch?.id,
      nextMatchSlot: selectedWinnerRoute?.slot ?? (nextMatch ? nextMatchSlot : undefined),
      loserNextMatchId: selectedLoserRoute?.targetId ??
        (isSemifinal ? thirdPlaceMatch?.id : match.loserNextMatchId),
      loserNextMatchSlot: selectedLoserRoute?.slot ??
        (isSemifinal ? nextMatchSlot : match.loserNextMatchSlot),
    };
  });
  const matchById = new Map(updatedMatches.map(match => [match.id, match]));

  for (const target of updatedMatches) {
    for (const slot of ['pair1', 'pair2'] as const) {
      const sourceId = target[`${slot}SourceMatchId`];
      const outcome = target[`${slot}SourceOutcome`];
      const source = sourceId ? matchById.get(sourceId) : undefined;
      if (source && outcome) {
        target[`${slot}Placeholder`] =
          `${outcome === 'winner' ? 'Vainqueur' : 'Perdant'} Match #${source.matchNumber}`;
      }
    }
  }

  for (const source of updatedMatches) {
    if (hasThirdPlaceMatch && source.bracketRound === semifinalRound && source.loserNextMatchSlot) {
      const placementMatch = matchById.get(source.loserNextMatchId ?? '');
      if (placementMatch && !placementMatch[`${source.loserNextMatchSlot}Id`]) {
        placementMatch[`${source.loserNextMatchSlot}Placeholder`] =
          `Perdant M#${source.matchNumber}`;
      }
    }
    if (!source.nextMatchId || !source.nextMatchSlot) continue;
    const target = matchById.get(source.nextMatchId);
    if (!target || target.status !== 'scheduled') continue;
    const placeholder = `Vainqueur M#${source.matchNumber}`;
    if (source.nextMatchSlot === 'pair1' && !target.pair1Id) {
      target.pair1Placeholder = placeholder;
    } else if (source.nextMatchSlot === 'pair2' && !target.pair2Id) {
      target.pair2Placeholder = placeholder;
    }
  }

  return updatedMatches;
}

function buildCustomConsolationMatches(
  tournamentId: string,
  bracketMatches: Match[],
  entrantCount: number
): { bracketMatches: Match[]; consolanteMatches: Match[] } | null {
  const rounds = new Map<number, Match[]>();
  for (const match of bracketMatches) {
    const round = match.bracketRound ?? 1;
    const matches = rounds.get(round) ?? [];
    matches.push(match);
    rounds.set(round, matches);
  }
  const orderedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);
  const parallelFinalPlacement = findCustomFinalPlacement(orderedRounds);
  if (
    !orderedRounds.length ||
    (orderedRounds.at(-1)?.[1].length !== 1 && !parallelFinalPlacement)
  ) return null;

  const sequentialFinalPlacement =
    orderedRounds.length >= 3 &&
    orderedRounds.at(-3)?.[1].length === 2 &&
    orderedRounds.at(-2)?.[1].length === 1 &&
    orderedRounds.at(-1)?.[1].length === 1;
  const hasThirdPlaceMatch = Boolean(parallelFinalPlacement || sequentialFinalPlacement);
  const expectedMatchCount = Math.max(0, entrantCount - 1) + (hasThirdPlaceMatch ? 1 : 0);
  if (bracketMatches.length !== expectedMatchCount) return null;

  let earlierEliminated = 0;
  const consolationMatches: Match[] = [];
  const updatedBracket = bracketMatches.map(match => ({ ...match }));
  let nextMatchNumber = updatedBracket.length + 1;

  for (const [roundIndex, [, sourceRound]] of orderedRounds.entries()) {
    if (parallelFinalPlacement && roundIndex === orderedRounds.length - 1) {
      for (const match of sourceRound) {
        const index = updatedBracket.findIndex(item => item.id === match.id);
        const isChampionship = match.id === parallelFinalPlacement.championshipMatch.id;
        updatedBracket[index] = {
          ...updatedBracket[index],
          targetRankWinner: isChampionship ? 1 : 3,
          targetRankLoser: isChampionship ? 2 : 4,
          classificationRankRange: isChampionship ? '1-2' : '3-4',
        };
      }
      continue;
    }

    if (roundIndex === orderedRounds.length - 1) {
      for (const match of sourceRound) {
        const index = updatedBracket.findIndex(item => item.id === match.id);
        updatedBracket[index] = {
          ...updatedBracket[index],
          targetRankWinner: 1,
          targetRankLoser: 2,
          classificationRankRange: '1-2',
        };
      }
      continue;
    }

    if (parallelFinalPlacement && roundIndex === orderedRounds.length - 2) {
      const orderedSemifinals = [...sourceRound].sort(
        (a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
      );
      orderedSemifinals.forEach((match, index) => {
        const sourceIndex = updatedBracket.findIndex(item => item.id === match.id);
        const targetSlot = index === 0 ? 'pair1' : 'pair2';
        updatedBracket[sourceIndex] = {
          ...updatedBracket[sourceIndex],
          loserNextMatchId: parallelFinalPlacement.thirdPlaceMatch.id,
          loserNextMatchSlot: targetSlot,
        };
      });
      continue;
    }

    if (sequentialFinalPlacement && roundIndex === orderedRounds.length - 2) {
      const match = sourceRound[0];
      const index = updatedBracket.findIndex(item => item.id === match.id);
      updatedBracket[index] = {
        ...updatedBracket[index],
        targetRankWinner: 3,
        targetRankLoser: 4,
        classificationRankRange: '3-4',
      };
      continue;
    }

    if (sequentialFinalPlacement && roundIndex === orderedRounds.length - 3) {
      const placementMatch = orderedRounds[roundIndex + 1][1][0];
      const orderedSemifinals = [...sourceRound].sort(
        (a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
      );
      orderedSemifinals.forEach((match, index) => {
        const sourceIndex = updatedBracket.findIndex(item => item.id === match.id);
        const targetSlot = index === 0 ? 'pair1' : 'pair2';
        updatedBracket[sourceIndex] = {
          ...updatedBracket[sourceIndex],
          loserNextMatchId: placementMatch.id,
          loserNextMatchSlot: targetSlot,
        };
      });
      continue;
    }

    const cohortSize = sourceRound.length;
    if (!CUSTOM_CLASSIFICATION_COHORT_SIZES.some(size => size === cohortSize)) return null;
    const lowestRank = entrantCount - earlierEliminated - cohortSize + 1;
    const rankOffset = lowestRank - 1;
    const orderedSources = [...sourceRound].sort(
      (a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
    );

    if (cohortSize === 2) {
      const timestamp = Date.now();
      const classificationMatch: Match = {
        id: `custom_class_r${roundIndex + 1}_${timestamp}`,
        tournamentId,
        type: 'consolante',
        roundName: `Classement ${lowestRank}-${lowestRank + 1}`,
        matchNumber: nextMatchNumber++,
        bracketRound: 1,
        bracketSlotIndex: 0,
        status: 'scheduled',
        pair1Placeholder: `Perdant M#${orderedSources[0].matchNumber}`,
        pair2Placeholder: `Perdant M#${orderedSources[1].matchNumber}`,
        classificationRankRange: `${lowestRank}-${lowestRank + 1}`,
        targetRankWinner: lowestRank,
        targetRankLoser: lowestRank + 1,
      };
      consolationMatches.push(classificationMatch);
      orderedSources.forEach((source, index) => {
        const sourceIndex = updatedBracket.findIndex(match => match.id === source.id);
        const targetSlot = index === 0 ? 'pair1' : 'pair2';
        updatedBracket[sourceIndex] = {
          ...updatedBracket[sourceIndex],
          loserNextMatchId: classificationMatch.id,
          loserNextMatchSlot: targetSlot,
        };
        if (source.winnerPairId) {
          classificationMatch[`${targetSlot}Id`] =
            source.winnerPairId === source.pair1Id ? source.pair2Id : source.pair1Id;
        }
      });
      earlierEliminated += cohortSize;
      continue;
    }

    const size = cohortSize as 4 | 8 | 16 | 24 | 32;
    const generated = generateFullClassificationTournament(tournamentId, size, size);
    const generatedMatches = [...generated.bracketMatches, ...generated.consolanteMatches];
    const idMap = new Map(
      generatedMatches.map((match, index) => [
        match.id,
        `custom_class_r${roundIndex + 1}_${index}_${Date.now()}`,
      ])
    );
    const mappedMatches = generatedMatches.map((match, index) => {
      const adjustRange = (range?: string) => {
        if (!range) return undefined;
        const [from, to] = range.split('-').map(Number);
        return Number.isFinite(from) && Number.isFinite(to)
          ? `${from + rankOffset}-${to + rankOffset}`
          : range;
      };
      return {
        ...match,
        id: idMap.get(match.id)!,
        type: 'consolante' as const,
        matchNumber: nextMatchNumber++,
        roundName: `Classement ${adjustRange(match.classificationRankRange) ?? match.roundName}`,
        classificationRankRange: adjustRange(match.classificationRankRange),
        targetRankWinner: match.targetRankWinner === undefined
          ? undefined
          : match.targetRankWinner + rankOffset,
        targetRankLoser: match.targetRankLoser === undefined
          ? undefined
          : match.targetRankLoser + rankOffset,
        nextMatchId: match.nextMatchId ? idMap.get(match.nextMatchId) : undefined,
        loserNextMatchId: match.loserNextMatchId ? idMap.get(match.loserNextMatchId) : undefined,
        pair1Id: undefined,
        pair2Id: undefined,
        pair1Placeholder: match.pair1Placeholder,
        pair2Placeholder: match.pair2Placeholder,
      };
    });

    const firstRoundMatches = mappedMatches
      .filter(match => match.bracketRound === 1 && generated.bracketMatches.some(
        original => idMap.get(original.id) === match.id
      ))
      .sort((a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0));
    const directEntrySlots = mappedMatches
      .filter(match =>
        match.bracketRound === 2 &&
        match.pair1Placeholder?.toLowerCase().includes('exempt')
      )
      .sort((a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0));

    const firstRoundCapacity = firstRoundMatches.length * 2;
    orderedSources.forEach((source, index) => {
      let target: Match | undefined;
      let targetSlot: 'pair1' | 'pair2';
      if (index < firstRoundCapacity) {
        target = firstRoundMatches[Math.floor(index / 2)];
        targetSlot = index % 2 === 0 ? 'pair1' : 'pair2';
      } else {
        target = directEntrySlots[index - firstRoundCapacity];
        targetSlot = 'pair1';
      }
      if (!target) return;
      const targetIndex = mappedMatches.findIndex(match => match.id === target.id);
      mappedMatches[targetIndex] = {
        ...mappedMatches[targetIndex],
        [`${targetSlot}Placeholder`]: `Perdant M#${source.matchNumber}`,
        [`${targetSlot}Id`]: source.winnerPairId
          ? source.winnerPairId === source.pair1Id ? source.pair2Id : source.pair1Id
          : undefined,
      };
      const sourceIndex = updatedBracket.findIndex(match => match.id === source.id);
      updatedBracket[sourceIndex] = {
        ...updatedBracket[sourceIndex],
        loserNextMatchId: target.id,
        loserNextMatchSlot: targetSlot,
      };
    });

    consolationMatches.push(...mappedMatches);
    earlierEliminated += cohortSize;
  }

  return {
    bracketMatches: connectAdjacentBracketMatches(updatedBracket),
    consolanteMatches: consolationMatches,
  };
}

export const TableauModule: React.FC<TableauModuleProps> = ({
  tournament,
  onUpdateTournament,
  onOpenScoreModal,
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'consolante' | 'standings'>('main');
  const [classificationSourceRound, setClassificationSourceRound] = useState<number | null>(null);
  const [bracketSize, setBracketSize] = useState<4 | 8 | 16 | 24 | 32>(
    tournament.bracketSize ?? 24
  );
  const [entrantCount, setEntrantCount] = useState(
    tournament.bracketEntrantCount ??
      Math.min(16, tournament.pairs.filter((pair) => pair.status === 'confirmed').length || 16)
  );
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
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);

  useEffect(() => {
    setBracketSize(tournament.bracketSize ?? 24);
    setEntrantCount(
      tournament.bracketEntrantCount ??
        Math.min(16, tournament.pairs.filter((pair) => pair.status === 'confirmed').length || 16)
    );
  }, [tournament.id]);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map((p) => [p.id, p]));
  const confirmedPairsCount = tournament.pairs.filter((pair) => pair.status === 'confirmed').length;
  const canEditTableStructure = (table: 'main' | 'consolante') => {
    const matches = table === 'main'
      ? tournament.bracketMatches
      : tournament.consolanteMatches;
    const labelsEditable = table === 'main'
      ? tournament.bracketLabelsEditable
      : tournament.consolanteLabelsEditable;
    return matches.length === 0 || Boolean(labelsEditable);
  };
  const canEditActiveTableStructure = canEditTableStructure(
    activeTab === 'consolante' ? 'consolante' : 'main'
  );
  const canEditFullTournament =
    canEditTableStructure('main') && canEditTableStructure('consolante');
  const canClearActiveTable = activeTab === 'main'
    ? canEditFullTournament
    : canEditTableStructure('consolante');
  const resolvedOutcomeMatches = useMemo(
    () =>
      resolveMatchOutcomeReferences(
        tournament.bracketMatches,
        tournament.consolanteMatches,
        tournament.pairs
      ),
    [tournament.bracketMatches, tournament.consolanteMatches, tournament.pairs]
  );
  const compactedConsolanteMatches = useMemo(
    () =>
      compactConsolanteLoserSlots(
        resolvedOutcomeMatches.bracketMatches,
        resolvedOutcomeMatches.consolanteMatches
      ).consolanteMatches,
    [resolvedOutcomeMatches]
  );

  // Generate full tournament with automatic matching classification matches (1 to N)
  const handleGenerateFullTournament = (size: 4 | 8 | 16 | 24 | 32 = bracketSize) => {
    if (!canEditFullTournament) return;
    const configuredEntrants = Math.min(entrantCount, size);
    const confirmed = tournament.pairs.filter((p) => p.status === 'confirmed');
    if (configuredEntrants < 1 || confirmed.length < configuredEntrants) {
      window.alert(`Il faut ${configuredEntrants} paires confirmées pour générer ce tableau.`);
      return;
    }
    const sortedPairs = [...confirmed]
      .sort((a, b) => a.totalWeight - b.totalWeight)
      .slice(0, configuredEntrants);
    const seedCount =
      size === 24 && configuredEntrants > 16
        ? 8
        : Math.min(
            Math.floor(configuredEntrants / 2),
            Math.max(2, Math.floor(configuredEntrants / 4))
          );
    const seededPairs = sortedPairs.map((pair, index) => ({
      ...pair,
      seedRank: index < seedCount ? index + 1 : undefined,
    }));
    const rankedPairsById = new Map(seededPairs.map((pair) => [pair.id, pair]));
    const { bracketMatches: generatedMainMatches, consolanteMatches: generatedConsolanteMatches } =
      generateFullClassificationTournament(tournament.id, size, configuredEntrants);
    let newMainMatches = generatedMainMatches;
    let newConsolanteMatches = generatedConsolanteMatches;

    if (size === 24 && configuredEntrants === 16) {
      const r1Matches = newMainMatches.filter((m) => m.bracketRound === 1);
      const r2Matches = newMainMatches.filter((m) => m.bracketRound === 2);
      const quarterFinals = newMainMatches.filter((m) => m.bracketRound === 3);
      const classificationQuarters = newConsolanteMatches
        .filter((match) => match.classificationRankRange === '9-16')
        .sort((a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0));
      const activeR2Indexes = [0, 2, 4, 6];
      const firstRoundSeedOrder = buildSeedOrder(8);
      const eighthFinalSeedOrder = [1, 4, 2, 3];
      const quarterFinalSeedOrder = [1, 4, 3, 2];

      r1Matches.forEach((match, index) => {
        match.nextMatchId = undefined;
        match.nextMatchSlot = undefined;
        match.loserNextMatchId = undefined;
        match.loserNextMatchSlot = undefined;
        if (index < 4) {
          const firstEntry = sortedPairs[8 + firstRoundSeedOrder[index * 2] - 1];
          const secondEntry = sortedPairs[8 + firstRoundSeedOrder[index * 2 + 1] - 1];
          match.pair1Id = firstEntry?.id;
          match.pair2Id = secondEntry?.id;
          match.pair1Placeholder = undefined;
          match.pair2Placeholder = undefined;
          match.nextMatchId = r2Matches[activeR2Indexes[index]].id;
          match.nextMatchSlot = 'pair2';
          if (classificationQuarters[index]) {
            match.loserNextMatchId = classificationQuarters[index].id;
            match.loserNextMatchSlot = 'pair1';
          }
        } else {
          match.pair1Id = undefined;
          match.pair2Id = undefined;
          match.pair1Placeholder = 'Bye';
          match.pair2Placeholder = 'Bye';
        }
      });

      r2Matches.forEach((match, index) => {
        match.nextMatchId = undefined;
        match.nextMatchSlot = undefined;
        match.loserNextMatchId = undefined;
        match.loserNextMatchSlot = undefined;
        const activeIndex = activeR2Indexes.indexOf(index);
        if (activeIndex >= 0) {
          const directEntry = sortedPairs[4 + eighthFinalSeedOrder[activeIndex] - 1];
          match.pair1Id = directEntry?.id;
          match.pair1Placeholder = undefined;
          match.pair2Id = undefined;
          match.pair2Placeholder = `Vainqueur 1/16e #${activeIndex + 1}`;
          match.nextMatchId = quarterFinals[activeIndex].id;
          match.nextMatchSlot = 'pair2';
          if (classificationQuarters[activeIndex]) {
            match.loserNextMatchId = classificationQuarters[activeIndex].id;
            match.loserNextMatchSlot = 'pair2';
          }
        } else {
          match.pair1Id = undefined;
          match.pair2Id = undefined;
          match.pair1Placeholder = 'Bye';
          match.pair2Placeholder = 'Bye';
        }
      });

      quarterFinals.forEach((match, index) => {
        const directEntry = sortedPairs[quarterFinalSeedOrder[index] - 1];
        match.pair1Id = directEntry?.id;
        match.pair1Placeholder = undefined;
        match.pair2Id = undefined;
        match.pair2Placeholder = `Vainqueur 1/8e #${index + 1}`;
      });
    } else if (size === 24) {
      const directEntries = sortedPairs.slice(0, 8);
      const firstRoundEntries = sortedPairs.slice(8);
      const r1Matches = newMainMatches.filter((m) => m.bracketRound === 1);
      const r2Matches = newMainMatches.filter((m) => m.bracketRound === 2);

      r1Matches.forEach((match, index) => {
        const firstEntry = firstRoundEntries[index * 2];
        const secondEntry = firstRoundEntries[index * 2 + 1];
        match.pair1Id = firstEntry?.id;
        match.pair2Id = secondEntry?.id;
        match.pair1Placeholder = firstEntry ? undefined : 'Bye';
        match.pair2Placeholder = secondEntry ? undefined : 'Bye';
      });

      r2Matches.forEach((match, index) => {
        const seedRank = buildSeedOrder(8)[index];
        const directEntry = directEntries[seedRank - 1];
        match.pair1Id = directEntry?.id;
        if (!directEntry) match.pair1Placeholder = 'Bye';
      });
    } else {
      const round1Matches = newMainMatches.filter((m) => m.bracketRound === 1);
      const seedOrder = buildSeedOrder(round1Matches.length * 2);
      round1Matches.forEach((match, index) => {
        const pair1 = sortedPairs[seedOrder[index * 2] - 1];
        const pair2 = sortedPairs[seedOrder[index * 2 + 1] - 1];
        match.pair1Id = pair1?.id;
        match.pair2Id = pair2?.id;
        if (!pair1) match.pair1Placeholder = 'Bye';
        if (!pair2) match.pair2Placeholder = 'Bye';
      });
    }

    const resolvedByes = resolveBracketByes(newMainMatches, newConsolanteMatches);
    newMainMatches = resolvedByes.bracketMatches;
    newConsolanteMatches = resolvedByes.consolanteMatches;
    if (size !== 24 || configuredEntrants !== 16) {
      const trimClassificationRange = (match: Match): Match | undefined => {
        const ranks = [match.targetRankWinner, match.targetRankLoser].filter(
          (rank): rank is number => rank !== undefined
        );
        if (!ranks.every((rank) => rank <= configuredEntrants)) return undefined;
        if (!match.classificationRankRange) return match;

        const [lowerText, upperText] = match.classificationRankRange.split('-');
        const lowerRank = Number(lowerText);
        const upperRank = Number(upperText);
        if (!Number.isFinite(lowerRank) || !Number.isFinite(upperRank) || lowerRank > configuredEntrants) {
          return undefined;
        }
        return {
          ...match,
          classificationRankRange: `${lowerRank}-${Math.min(upperRank, configuredEntrants)}`,
        };
      };
      newConsolanteMatches = newConsolanteMatches
        .map(trimClassificationRange)
        .filter((match): match is Match => Boolean(match));
      const remainingClassificationIds = new Set(newConsolanteMatches.map((match) => match.id));
      newMainMatches = newMainMatches.map((match) =>
        match.loserNextMatchId && !remainingClassificationIds.has(match.loserNextMatchId)
          ? { ...match, loserNextMatchId: undefined, loserNextMatchSlot: undefined }
          : match
      );
      newConsolanteMatches = newConsolanteMatches.map((match) => ({
        ...match,
        nextMatchId:
          match.nextMatchId && remainingClassificationIds.has(match.nextMatchId)
            ? match.nextMatchId
            : undefined,
        nextMatchSlot:
          match.nextMatchId && remainingClassificationIds.has(match.nextMatchId)
            ? match.nextMatchSlot
            : undefined,
        loserNextMatchId:
          match.loserNextMatchId && remainingClassificationIds.has(match.loserNextMatchId)
            ? match.loserNextMatchId
            : undefined,
        loserNextMatchSlot:
          match.loserNextMatchId && remainingClassificationIds.has(match.loserNextMatchId)
            ? match.loserNextMatchSlot
            : undefined,
      }));
    }

    onUpdateTournament({
      ...tournament,
      pairs: tournament.pairs.map((pair) => {
        const seededPair = rankedPairsById.get(pair.id);
        if (seededPair) return seededPair;
        if (pair.status === 'confirmed' && pair.seedRank) {
          return { ...pair, seedRank: undefined };
        }
        return pair;
      }),
      bracketSize: size,
      bracketEntrantCount: configuredEntrants,
      bracketLabelsEditable: false,
      consolanteLabelsEditable: false,
      bracketMatches: newMainMatches,
      consolanteMatches: newConsolanteMatches,
    });
  };

  // Filter consolante matches by rank bracket category
  const filteredConsolanteMatches = useMemo(() => {
    if (classificationSourceRound !== null) {
      const consolationById = new Map(compactedConsolanteMatches.map(match => [match.id, match]));
      const relevantIds = new Set<string>();
      const sourceMatches = compactConsolanteLoserSlots(
        tournament.bracketMatches,
        tournament.consolanteMatches
      ).bracketMatches;
      const sourceRoundMatches = sourceMatches.filter(
        match => (match.bracketRound || 1) === classificationSourceRound
      );
      const sourceMatchIds = new Set(sourceRoundMatches.map(match => match.id));
      const sourceMatchNumbers = new Set(sourceRoundMatches.map(match => match.matchNumber));
      const eliminatedPairIds = new Set(
        sourceRoundMatches.flatMap(match => {
          if (!match.winnerPairId) return [];
          const loserPairId = match.winnerPairId === match.pair1Id ? match.pair2Id : match.pair1Id;
          return loserPairId ? [loserPairId] : [];
        })
      );
      const pendingIds = sourceRoundMatches
        .map(match => match.loserNextMatchId)
        .filter((matchId): matchId is string => Boolean(matchId));

      for (const match of compactedConsolanteMatches) {
        const hasSourceLoser = (['pair1', 'pair2'] as const).some(slot => {
          const sourceMatchId = match[`${slot}SourceMatchId`];
          const sourceOutcome = match[`${slot}SourceOutcome`];
          const placeholder = match[`${slot}Placeholder`] ?? '';
          const matchNumber = placeholder.match(/^(?:Perdant)\s+(?:Match\s*#|M#)\s*(\d+)\b/i);
          return (
            (sourceMatchId && sourceOutcome === 'loser' && sourceMatchIds.has(sourceMatchId)) ||
            (matchNumber && sourceMatchNumbers.has(Number(matchNumber[1]))) ||
            Boolean(match[`${slot}Id`] && eliminatedPairIds.has(match[`${slot}Id`]!))
          );
        });
        if (hasSourceLoser) pendingIds.push(match.id);
      }

      while (pendingIds.length > 0) {
        const matchId = pendingIds.pop()!;
        if (relevantIds.has(matchId)) continue;
        const match = consolationById.get(matchId);
        if (!match) continue;
        relevantIds.add(matchId);
        if (match.nextMatchId) pendingIds.push(match.nextMatchId);
        if (match.loserNextMatchId) pendingIds.push(match.loserNextMatchId);
      }

      return relevantIds.size
        ? compactedConsolanteMatches.filter(match => relevantIds.has(match.id))
        : compactedConsolanteMatches;
    }
    if (consolanteCategory === 'all') return compactedConsolanteMatches;
    if (consolanteCategory === '5-8') {
      return compactedConsolanteMatches.filter(
        (m) =>
          m.classificationRankRange === '5-8' ||
          m.classificationRankRange === '5-6' ||
          m.classificationRankRange === '7-8'
      );
    }
    if (consolanteCategory === '9-16') {
      return compactedConsolanteMatches.filter(
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
      return compactedConsolanteMatches.filter(
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
    return compactedConsolanteMatches;
  }, [
    classificationSourceRound,
    consolanteCategory,
    compactedConsolanteMatches,
    tournament.bracketMatches,
  ]);

  // Current matches displayed in tree view
  const currentDisplayedMatches = useMemo(() => {
    if (activeTab === 'main') {
      return resolvedOutcomeMatches.bracketMatches.filter((m) => m.type !== 'consolante');
    }
    if (activeTab === 'consolante') {
      return filteredConsolanteMatches;
    }
    return [];
  }, [activeTab, resolvedOutcomeMatches.bracketMatches, filteredConsolanteMatches]);

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

  const confirmCustomStructureEdit = () => {
    const matches = [...tournament.bracketMatches, ...tournament.consolanteMatches];
    const hasStartedMatch = matches.some(match =>
      match.status !== 'scheduled' || Boolean(match.score || match.winnerPairId)
    );
    if (!hasStartedMatch) return true;
    return window.confirm(
      'Le tableau a déjà commencé. Modifier sa structure effacera les scores et les équipes automatiquement qualifiées. Continuer ?'
    );
  };

  const resetCustomMatchResults = (matches: Match[]) =>
    matches.map(match => ({
      ...match,
      score: undefined,
      winnerPairId: undefined,
      status: 'scheduled' as const,
      completedAt: undefined,
      startedAt: undefined,
      courtId: undefined,
      scheduledTime: undefined,
      scheduledAt: undefined,
      loserNextMatchId: undefined,
      loserNextMatchSlot: undefined,
    }));

  const handleStartCustomEditor = () => {
    if (!canEditTableStructure('main')) return;
    if (tournament.bracketMatches.length || tournament.consolanteMatches.length) {
      window.alert('Le tableau libre est réservé à la création d’un nouveau tableau.');
      return;
    }
    const firstMatch: Match = {
      id: `custom_match_${Date.now()}`,
      tournamentId: tournament.id,
      type: 'bracket',
      roundName: 'Tour 1 (#1)',
      matchNumber: 1,
      bracketRound: 1,
      bracketSlotIndex: 0,
      pair1Placeholder: 'Choisir équipe',
      pair2Placeholder: 'Choisir équipe',
      status: 'scheduled',
    };
    onUpdateTournament({
      ...tournament,
      bracketMode: 'custom',
      bracketLabelsEditable: false,
      bracketMatches: [firstMatch],
      bracketEntrantCount: entrantCount,
    });
  };

  const saveCustomStructure = (matches: Match[]) => {
    if (!canEditTableStructure('main')) return;
    const hasStartedMatch = [...tournament.bracketMatches, ...tournament.consolanteMatches].some(match =>
      match.status !== 'scheduled' || Boolean(match.score || match.winnerPairId)
    );
    const resetMatches = (hasStartedMatch
      ? resetCustomMatchResults(matches).map(match => {
          const pair1IsOutcome = Boolean(match.pair1SourceMatchId) ||
            /^(?:vainqueur|perdant)\b/i.test(match.pair1Placeholder ?? '');
          const pair2IsOutcome = Boolean(match.pair2SourceMatchId) ||
            /^(?:vainqueur|perdant)\b/i.test(match.pair2Placeholder ?? '');
          return {
            ...match,
            pair1Id: pair1IsOutcome ? undefined : match.pair1Id,
            pair2Id: pair2IsOutcome ? undefined : match.pair2Id,
          };
        })
      : matches.map(match => ({
          ...match,
          score: undefined,
          winnerPairId: undefined,
          status: 'scheduled' as const,
        }))).map(match => ({
      ...match,
      pair1Placeholder: match.pair1Placeholder ?? 'Choisir équipe',
      pair2Placeholder: match.pair2Placeholder ?? 'Choisir équipe',
    }));
    onUpdateTournament({
      ...tournament,
      bracketMode: 'custom',
      bracketMatches: connectAdjacentBracketMatches(resetMatches),
      consolanteMatches: [],
    });
  };

  const handleAddCustomMatch = (round: number) => {
    if (!canEditTableStructure('main')) return;
    if (!confirmCustomStructureEdit()) return;
    const match: Match = {
      id: `custom_match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tournamentId: tournament.id,
      type: 'bracket',
      roundName: `Tour ${round}`,
      matchNumber: tournament.bracketMatches.length + 1,
      bracketRound: round,
      bracketSlotIndex: tournament.bracketMatches.filter(item => item.bracketRound === round).length,
      pair1Placeholder: 'Choisir équipe',
      pair2Placeholder: 'Choisir équipe',
      status: 'scheduled',
    };
    saveCustomStructure([...tournament.bracketMatches, match]);
  };

  const handleAddCustomRound = () => {
    if (!canEditTableStructure('main')) return;
    if (!confirmCustomStructureEdit()) return;
    const nextRound = Math.max(0, ...tournament.bracketMatches.map(match => match.bracketRound ?? 1)) + 1;
    const match: Match = {
      id: `custom_match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tournamentId: tournament.id,
      type: 'bracket',
      roundName: `Tour ${nextRound}`,
      matchNumber: tournament.bracketMatches.length + 1,
      bracketRound: nextRound,
      bracketSlotIndex: 0,
      pair1Placeholder: 'Vainqueur du tour précédent',
      pair2Placeholder: 'Vainqueur du tour précédent',
      status: 'scheduled',
    };
    saveCustomStructure([...tournament.bracketMatches, match]);
  };

  const handleRemoveCustomMatch = (matchId: string) => {
    if (!canEditTableStructure('main')) return;
    if (!confirmCustomStructureEdit()) return;
    saveCustomStructure(tournament.bracketMatches.filter(match => match.id !== matchId));
  };

  const handleMoveCustomMatch = (matchId: string, targetRound: number, beforeMatchId?: string) => {
    if (!canEditTableStructure('main')) return;
    if (matchId === beforeMatchId || !confirmCustomStructureEdit()) return;
    const sorted = [...tournament.bracketMatches].sort((a, b) =>
      (a.bracketRound ?? 1) - (b.bracketRound ?? 1) ||
      (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
    );
    const movingMatch = sorted.find(match => match.id === matchId);
    if (!movingMatch) return;
    const remaining = sorted.filter(match => match.id !== matchId);
    const targetMatches = remaining.filter(match => match.bracketRound === targetRound);
    const targetRoundName = targetMatches[0]?.bracketRoundName;
    const targetIndex = beforeMatchId
      ? targetMatches.findIndex(match => match.id === beforeMatchId)
      : targetMatches.length;
    targetMatches.splice(targetIndex < 0 ? targetMatches.length : targetIndex, 0, {
      ...movingMatch,
      bracketRound: targetRound,
      bracketRoundName: targetRoundName,
    });
    const targetIds = new Set(targetMatches.map(match => match.id));
    const reordered = [
      ...remaining.filter(match => match.bracketRound !== targetRound),
      ...targetMatches,
    ].map((match, index) => ({
      ...match,
      bracketSlotIndex: targetIds.has(match.id)
        ? targetMatches.findIndex(item => item.id === match.id)
        : match.bracketSlotIndex ?? index,
    }));
    saveCustomStructure(reordered);
  };

  const handleUpdateRoundName = (round: number, name: string, table: 'main' | 'consolante') => {
    const isEditable = table === 'main'
      ? tournament.bracketLabelsEditable
      : tournament.consolanteLabelsEditable;
    if (!isEditable) return;

    const roundName = name.trim();
    const matchesToUpdate = table === 'main'
      ? tournament.bracketMatches
      : tournament.consolanteMatches;
    const roundMatchIndexes = new Map(
      [...matchesToUpdate]
        .filter(match => (match.bracketRound ?? 1) === round)
        .sort((a, b) =>
          (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0) ||
          a.matchNumber - b.matchNumber
        )
        .map((match, index) => [match.id, index + 1])
    );
    const matches = matchesToUpdate.map(match =>
      (match.bracketRound ?? 1) === round
        ? {
            ...match,
            bracketRoundName: roundName || undefined,
            roundName: `${roundName || (table === 'main' ? `Tour ${round}` : `Tour de Classement ${round}`)} (#${roundMatchIndexes.get(match.id)})`,
          }
        : match
    );
    onUpdateTournament(table === 'main'
      ? { ...tournament, bracketMatches: matches }
      : { ...tournament, consolanteMatches: matches });
  };

  const toggleRoundLabelEditing = () => {
    if (activeTab === 'main') {
      onUpdateTournament({
        ...tournament,
        bracketLabelsEditable: !tournament.bracketLabelsEditable,
      });
    } else if (activeTab === 'consolante') {
      onUpdateTournament({
        ...tournament,
        consolanteLabelsEditable: !tournament.consolanteLabelsEditable,
      });
    }
  };

  const openRoundClassification = (round: number) => {
    setClassificationSourceRound(round);
    setActiveTab('consolante');
  };

  const handleGenerateCustomClassification = () => {
    if (!canEditFullTournament) return;
    if (!confirmCustomStructureEdit()) return;
    const roundMatches = new Map<number, Match[]>();
    tournament.bracketMatches.forEach(match => {
      const round = match.bracketRound ?? 1;
      const matches = roundMatches.get(round) ?? [];
      matches.push(match);
      roundMatches.set(round, matches);
    });
    const orderedRounds = [...roundMatches.entries()].sort(([a], [b]) => a - b);
    const parallelFinalPlacement = findCustomFinalPlacement(orderedRounds);
    const sequentialFinalPlacement =
      orderedRounds.length >= 3 &&
      orderedRounds.at(-3)?.[1].length === 2 &&
      orderedRounds.at(-2)?.[1].length === 1 &&
      orderedRounds.at(-1)?.[1].length === 1;
    const classificationRounds = orderedRounds.slice(
      0,
      parallelFinalPlacement ? -2 : sequentialFinalPlacement ? -3 : -1
    );
    const irregularRound = classificationRounds.find(([, matches]) =>
      !CUSTOM_CLASSIFICATION_COHORT_SIZES.some(size => size === matches.length)
    );
    if (irregularRound) {
      const [round, matches] = irregularRound;
      const count = matches.length;
      const paddedSize = CUSTOM_CLASSIFICATION_COHORT_SIZES.find(size => size > count);
      const byeCount = paddedSize ? paddedSize - count : 0;
      window.alert(
        `Le tour ${round} contient ${count} match(s) à classer. Un classement exact nécessiterait ${byeCount} exemption(s). Comme demandé, aucun classement n’a été généré : réorganise les matchs puis réessaie.`
      );
      return;
    }
    const result = buildCustomConsolationMatches(
      tournament.id,
      connectAdjacentBracketMatches(tournament.bracketMatches),
      entrantCount
    );
    if (!result) {
      window.alert(
        'Impossible de générer un classement exact : vérifie les équipes inscrites, les liaisons des matchs et les tours à classer (2, 4, 8, 16, 24 ou 32 matchs). Une finale et un match 3e-4e peuvent être placés dans le même tour.'
      );
      return;
    }
    onUpdateTournament({
      ...tournament,
      bracketMode: 'custom',
      bracketEntrantCount: entrantCount,
      consolanteLabelsEditable: false,
      bracketMatches: result.bracketMatches,
      consolanteMatches: result.consolanteMatches,
    });
    setActiveTab('main');
  };

  // Clear bracket modal
  const handleConfirmDeleteBracket = () => {
    if (!canClearActiveTable) return;
    if (activeTab === 'main') {
      onUpdateTournament({
        ...tournament,
        bracketLabelsEditable: false,
        consolanteLabelsEditable: false,
        bracketMatches: [],
        consolanteMatches: [],
      });
    } else {
      onUpdateTournament({
        ...tournament,
        consolanteLabelsEditable: false,
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
    placeholder?: string,
    sourceMatchId?: string,
    sourceOutcome?: 'winner' | 'loser'
  ) => {
    if (!canEditActiveTableStructure) return;
    let resolvedPairId = pairId;
    const outcomeReference = placeholder?.match(/^(Vainqueur|Perdant)\s+(?:Match\s*#|M#)\s*(\d+)\b/i);
    const targetMatch = [...tournament.bracketMatches, ...tournament.consolanteMatches]
      .find(match => match.id === matchId);
    if (targetMatch && /^(?:Vainqueur|Perdant)\b/i.test(placeholder ?? '')) {
      const targetWithReference = {
        ...targetMatch,
        [`${slot}Placeholder`]: placeholder,
      };
      const matchesWithResolvedReference = resolveMatchOutcomeReferences(
        tournament.bracketMatches.map(match =>
          match.id === matchId ? targetWithReference : match
        ),
        tournament.consolanteMatches.map(match =>
          match.id === matchId ? targetWithReference : match
        ),
        tournament.pairs
      );
      const resolvedTarget = [
        ...matchesWithResolvedReference.bracketMatches,
        ...matchesWithResolvedReference.consolanteMatches,
      ].find(match => match.id === matchId);
      resolvedPairId = resolvedTarget?.[`${slot}Id`] ?? resolvedPairId;
    }

    if (targetMatch && resolvedPairId) {
      const otherSlot = slot === 'pair1' ? 'pair2' : 'pair1';
      if (targetMatch[`${otherSlot}Id`] === resolvedPairId) {
        window.alert('Cette paire est déjà affectée à l’autre position de ce match.');
        return;
      }
    }

    if (targetMatch && placeholder) {
      if (outcomeReference) {
        const otherSlot = slot === 'pair1' ? 'pair2' : 'pair1';
        const otherPlaceholder = targetMatch[`${otherSlot}Placeholder`] ?? '';
        const otherReference = otherPlaceholder.match(/^(Vainqueur|Perdant)\s+(?:Match\s*#|M#)\s*(\d+)\b/i);
        if (
          otherReference &&
          outcomeReference[1].toLowerCase() === otherReference[1].toLowerCase() &&
          outcomeReference[2] === otherReference[2]
        ) {
          window.alert('Cette issue de match est déjà affectée à l’autre position de ce match.');
          return;
        }
      }
    }

    const updateMatches = (list: Match[]) =>
      list.map((m) => {
        if (m.id !== matchId) return m;
        if (slot === 'pair1') {
          return {
            ...m,
            pair1Id: resolvedPairId,
            pair1Placeholder: resolvedPairId ? undefined : (placeholder || m.pair1Placeholder),
            pair1SourceMatchId: sourceMatchId,
            pair1SourceOutcome: sourceOutcome,
          };
        } else {
          return {
            ...m,
            pair2Id: resolvedPairId,
            pair2Placeholder: resolvedPairId ? undefined : (placeholder || m.pair2Placeholder),
            pair2SourceMatchId: sourceMatchId,
            pair2SourceOutcome: sourceOutcome,
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
        ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName} (${pair.player1.club})`
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
              Classement 1 à {entrantCount}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {tournament.bracketMode === 'custom'
              ? 'Glisse les matchs entre les tours ; les vainqueurs sont reliés automatiquement selon leur ordre.'
              : 'Consolantes calculées automatiquement d’après le tableau principal pour classer l’ensemble des équipes de 1 à N.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main bracket and official standings */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => {
                setClassificationSourceRound(null);
                setActiveTab('main');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'main'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau Principal ({tournament.bracketMatches.filter((m) => m.type !== 'consolante').length} m.)
            </button>
            {tournament.consolanteMatches.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setClassificationSourceRound(null);
                  setActiveTab('consolante');
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'consolante'
                    ? 'bg-white text-indigo-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Classement ({tournament.consolanteMatches.length} m.)
              </button>
            )}
            <button
              onClick={() => {
                setClassificationSourceRound(null);
                setActiveTab('standings');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'standings'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Classement Général (1 à {entrantCount})</span>
            </button>
          </div>

          {/* Generator Controls */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-xs">
            {tournament.bracketMode === 'custom' ? (
              <>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-1">
                  <span>Paires</span>
                  <input
                    type="number"
                    min={2}
                    max={32}
                    value={entrantCount}
                    disabled={!canEditFullTournament}
                    onChange={(event) => {
                      if (!canEditFullTournament) return;
                      const count = Math.max(2, Math.min(32, Number.parseInt(event.target.value, 10) || 2));
                      if (
                        tournament.consolanteMatches.length > 0 &&
                        !window.confirm('Changer le nombre de paires supprimera le classement généré. Continuer ?')
                      ) return;
                      setEntrantCount(count);
                      onUpdateTournament({
                        ...tournament,
                        bracketEntrantCount: count,
                        bracketMatches: tournament.bracketMatches.map(match => ({
                          ...match,
                          loserNextMatchId: undefined,
                          loserNextMatchSlot: undefined,
                        })),
                        consolanteMatches: [],
                      });
                    }}
                    className="w-14 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-xs"
                    aria-label="Nombre total de paires du tableau libre"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddCustomRound}
                  disabled={!canEditTableStructure('main')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter un tour
                </button>
                <button
                  type="button"
                  onClick={handleGenerateCustomClassification}
                  disabled={!canEditFullTournament}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Créer le classement
                </button>
              </>
                  ) : (
              <>
            <select
              value={bracketSize}
              disabled={!canEditFullTournament}
              onChange={(e) => {
                if (!canEditFullTournament) return;
                const nextSize = parseInt(e.target.value) as 4 | 8 | 16 | 24 | 32;
                const nextEntrants = Math.min(entrantCount, nextSize);
                setBracketSize(nextSize);
                setEntrantCount(nextEntrants);
                onUpdateTournament({
                  ...tournament,
                  bracketSize: nextSize,
                  bracketEntrantCount: nextEntrants,
                });
              }}
              className="bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs px-2.5 py-1.5 rounded-lg"
              title="Choisir le format du tournoi complet"
            >
              <option value="24">Tableau de 24 places</option>
              <option value="16">Tableau de 16 places</option>
              <option value="8">Tableau de 8 places</option>
              <option value="4">Tableau de 4 places</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span>Équipes au tableau</span>
              <input
                type="number"
                min={1}
                max={bracketSize}
                value={entrantCount}
                disabled={!canEditFullTournament}
                onChange={(e) => {
                  if (!canEditFullTournament) return;
                  const nextEntrants = Math.max(
                    1,
                    Math.min(bracketSize, Number.parseInt(e.target.value, 10) || 1)
                  );
                  setEntrantCount(nextEntrants);
                  onUpdateTournament({
                    ...tournament,
                    bracketEntrantCount: nextEntrants,
                  });
                }}
                className="w-14 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-xs"
                aria-label="Nombre d’équipes inscrites au tableau"
              />
            </label>
            <button
              onClick={() => handleGenerateFullTournament(bracketSize)}
              disabled={!canEditFullTournament || entrantCount > confirmedPairsCount}
              title={
                !canEditFullTournament
                  ? 'Activez l’édition pour modifier la structure du tableau'
                  : entrantCount > confirmedPairsCount
                  ? `Confirmez ${entrantCount - confirmedPairsCount} paire(s) supplémentaire(s)`
                  : undefined
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Générer ({entrantCount}/{bracketSize})</span>
            </button>
            {tournament.bracketMatches.length === 0 && tournament.consolanteMatches.length === 0 && (
              <button
                type="button"
                onClick={handleStartCustomEditor}
                disabled={!canEditTableStructure('main')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
              >
                <GitBranch className="h-3.5 w-3.5" /> Construire librement
              </button>
            )}
              </>
            )}

            {(tournament.bracketMatches.length > 0 || tournament.consolanteMatches.length > 0) && (
              <button
                type="button"
                onClick={() => setIsClearTableauModalOpen(true)}
                disabled={!canClearActiveTable}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 border border-rose-200 rounded-lg transition-colors"
                title="Vider le tableau avec confirmation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vider</span>
              </button>
            )}
            {((activeTab === 'main' && tournament.bracketMatches.length > 0) ||
              (activeTab === 'consolante' && tournament.consolanteMatches.length > 0)) && (
              <button
                type="button"
                onClick={toggleRoundLabelEditing}
                aria-pressed={
                  activeTab === 'main'
                    ? Boolean(tournament.bracketLabelsEditable)
                    : Boolean(tournament.consolanteLabelsEditable)
                }
                title="Autoriser la modification des tours et de leurs étiquettes. Les scores restent modifiables lorsque le tableau est verrouillé."
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${
                  (activeTab === 'main'
                    ? tournament.bracketLabelsEditable
                    : tournament.consolanteLabelsEditable)
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                    : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-300'
                }`}
              >
                {(activeTab === 'main'
                  ? tournament.bracketLabelsEditable
                  : tournament.consolanteLabelsEditable)
                  ? <><Unlock className="w-3.5 h-3.5" /> Verrouiller</>
                  : <><Lock className="w-3.5 h-3.5" /> Activer l’édition</>}
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
                <strong>Tableau de classement du tour :</strong> Les perdants des matchs jouables de ce tour sont regroupés ici. Les exempts et cases vides sont ignorés.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setClassificationSourceRound(null);
                setActiveTab('main');
              }}
              className="inline-flex items-center gap-1 self-start rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-bold text-amber-900 hover:bg-amber-100 sm:self-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour au tableau
            </button>
          </div>

          {/* Sub-filter tabs for classification brackets */}
          {classificationSourceRound === null && (
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
          )}
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
                          {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
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
                          {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
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
                          {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
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
                                {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
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
      ) : tournament.bracketMode === 'custom' && activeTab === 'main' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-950">
            Glisse une case vers un autre tour ou une autre position. Les vainqueurs de deux matchs voisins seront automatiquement reliés au match suivant. Les perdants seront reliés au classement exact après sa création.
          </div>
          <div className="flex items-start gap-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            {sortedRoundNumbers.map(roundNum => {
              const roundMatches = [...(roundsMap.get(roundNum) ?? [])].sort(
                (a, b) => (a.bracketSlotIndex ?? 0) - (b.bracketSlotIndex ?? 0)
              );
              const roundLabel = roundMatches[0]?.bracketRoundName || `Tour ${roundNum}`;
              return (
                <section
                  key={roundNum}
                  className="flex w-[280px] min-h-72 shrink-0 flex-col rounded-xl bg-slate-50 p-3"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    if (draggedMatchId) handleMoveCustomMatch(draggedMatchId, roundNum);
                    setDraggedMatchId(null);
                  }}
                >
                  <header className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={roundLabel}
                        onChange={event => handleUpdateRoundName(roundNum, event.target.value, 'main')}
                        disabled={!tournament.bracketLabelsEditable}
                        maxLength={40}
                        aria-label={`Nom du tour ${roundNum}`}
                        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-extrabold text-slate-900 enabled:hover:border-slate-300 enabled:focus:border-emerald-500 enabled:focus:bg-white enabled:focus:outline-none disabled:cursor-not-allowed"
                      />
                      <span className="block px-1 text-[11px] text-slate-500">
                        {roundMatches.length} match(s)
                      </span>
                    </div>
                    {tournament.consolanteMatches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openRoundClassification(roundNum)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100"
                        title={`Voir les matchs de classement du tour ${roundLabel}`}
                        aria-label={`Voir le classement du tour ${roundLabel}`}
                      >
                        Classement · {roundLabel} <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </header>
                  <div className="flex flex-1 flex-col gap-3">
                    {roundMatches.map(match => {
                      const p1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                      const p2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                      return (
                        <article
                          key={match.id}
                          draggable={canEditTableStructure('main') && match.status === 'scheduled'}
                          onDragStart={() => setDraggedMatchId(match.id)}
                          onDragEnd={() => setDraggedMatchId(null)}
                          onDragOver={event => event.preventDefault()}
                          onDrop={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (draggedMatchId) handleMoveCustomMatch(draggedMatchId, roundNum, match.id);
                            setDraggedMatchId(null);
                          }}
                          className={`rounded-xl border border-slate-200 bg-white shadow-xs ${
                            match.status === 'scheduled' ? 'cursor-grab active:cursor-grabbing' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <GripVertical className="h-4 w-4 text-slate-400" />
                              Match #{match.matchNumber}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomMatch(match.id)}
                                disabled={!canEditTableStructure('main')}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Supprimer le match ${match.matchNumber}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenScoreModal(match)}
                                className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                              >
                                {match.status === 'completed' ? 'Score' : 'Saisir'}
                              </button>
                            </div>
                          </div>
                          {(['pair1', 'pair2'] as const).map(slot => (
                            <button
                              key={slot}
                              type="button"
                              disabled={!canEditTableStructure('main')}
                              onClick={() => setSlotModalInfo({
                                matchId: match.id,
                                slot,
                                roundName: match.roundName,
                                matchNumber: match.matchNumber,
                              })}
                              className="block w-full truncate border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-700 last:border-0 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                            >
                              {(slot === 'pair1' ? p1 : p2)
                                ? `${(slot === 'pair1' ? p1 : p2)!.player1.firstName} ${(slot === 'pair1' ? p1 : p2)!.player1.lastName} / ${(slot === 'pair1' ? p1 : p2)!.player2.firstName} ${(slot === 'pair1' ? p1 : p2)!.player2.lastName}`
                                : resolveMatchOutcomePlaceholder(
                                    match,
                                    slot,
                                    resolvedOutcomeMatches.bracketMatches
                                  ) ||
                                  match[`${slot}Placeholder`] ||
                                  'Choisir une équipe'}
                            </button>
                          ))}
                          {match.score && (
                            <div className="border-t border-slate-100 px-3 py-2 text-xs font-bold text-emerald-800">
                              {formatScore(match.score)}
                            </div>
                          )}
                        </article>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleAddCustomMatch(roundNum)}
                      disabled={!canEditTableStructure('main')}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" /> Ajouter une case match
                    </button>
                  </div>
                </section>
              );
            })}
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
                Cliquez ci-dessous pour générer le tournoi complet et ses matches de classement jusqu’à la {entrantCount}e place.
              </p>
              <button
                onClick={() => handleGenerateFullTournament(bracketSize)}
                disabled={!canEditFullTournament || entrantCount > confirmedPairsCount}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                Générer Tournoi Complet ({entrantCount}/{bracketSize})
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 overflow-x-auto touch-pan-x shadow-xs">
              <div className="flex items-stretch gap-6 min-w-[720px] pb-3">
                {sortedRoundNumbers.map((roundNum) => {
                  const roundMatches = roundsMap.get(roundNum) || [];
                  const roundTitle = activeTab === 'main'
                    ? roundMatches[0]?.bracketRoundName || [...new Set(
                        roundMatches.map(match =>
                          match.roundName.replace(/\s*\(#\d+\)$/, '')
                        )
                      )].join(' / ')
                    : roundMatches[0]?.bracketRoundName || `Tour de Classement ${roundNum}`;
                  return (
                    <div key={roundNum} className="flex-1 min-w-[260px] flex flex-col">
                      {/* Round Header */}
                      <div className="text-center pb-2.5 mb-3 border-b border-slate-200">
                        {activeTab === 'main' || activeTab === 'consolante' ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={roundTitle}
                              onChange={event => handleUpdateRoundName(
                                roundNum,
                                event.target.value,
                                activeTab
                              )}
                              disabled={
                                activeTab === 'main'
                                  ? !tournament.bracketLabelsEditable
                                  : !tournament.consolanteLabelsEditable
                              }
                              maxLength={40}
                              aria-label={`Nom du tour ${roundNum}`}
                              className="w-full max-w-[220px] rounded-md border border-transparent bg-transparent px-1 py-1 text-center text-xs font-bold uppercase tracking-wider text-emerald-800 enabled:hover:border-slate-300 enabled:focus:border-emerald-500 enabled:focus:bg-white enabled:focus:outline-none disabled:cursor-not-allowed"
                            />
                            {activeTab === 'main' && (
                              <button
                                type="button"
                                onClick={() => openRoundClassification(roundNum)}
                                className="inline-flex shrink-0 items-center rounded p-1 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-950"
                                title={`Voir les matchs de classement liés à ${roundTitle}`}
                                aria-label={`Voir le classement de ${roundTitle}`}
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                            {roundTitle}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 block font-mono">
                          {roundMatches.length} match(s)
                        </span>
                      </div>

                      {/* Matches Column */}
                      <div className="flex-1 flex flex-col justify-around gap-4">
                        {roundMatches.map((match) => {
                          const p1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                          const p2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                          const isCompleted =
                            match.status === 'completed' || match.status === 'walkover';

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
                                {match.status === 'walkover' ? (
                                  <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                                    Bye
                                  </span>
                                ) : (
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
                                )}
                              </div>

                              {/* Opponents Slots */}
                              <div className="p-2 space-y-1">
                                {/* Pair 1 Slot */}
                                <div
                                  onClick={canEditActiveTableStructure ? () =>
                                    setSlotModalInfo({
                                      matchId: match.id,
                                      slot: 'pair1',
                                      roundName: match.roundName,
                                      matchNumber: match.matchNumber,
                                    })
                                  : undefined}
                                  aria-disabled={!canEditActiveTableStructure}
                                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                                    canEditActiveTableStructure ? 'cursor-pointer' : 'cursor-not-allowed'
                                  } ${
                                    match.winnerPairId === match.pair1Id
                                      ? 'bg-emerald-50 text-emerald-900 font-extrabold border border-emerald-300'
                                      : canEditActiveTableStructure ? 'hover:bg-slate-100 text-slate-800' : 'text-slate-800'
                                  }`}
                                  title={canEditActiveTableStructure
                                    ? 'Cliquer pour modifier cette position'
                                    : 'Activez l’édition pour modifier cette position'}
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
                                        : resolveMatchOutcomePlaceholder(
                                            match,
                                            'pair1',
                                            resolvedOutcomeMatches.bracketMatches
                                          ) ||
                                          match.pair1Placeholder ||
                                          'Choisir équipe'}
                                    </span>
                                    {!p1 && /^(?:Vainqueur|Perdant)\b/i.test(match.pair1Placeholder ?? '') && (
                                      <span className="shrink-0 text-[10px] font-semibold text-indigo-600">
                                        {match.pair1Placeholder}
                                      </span>
                                    )}
                                  </div>
                                  {match.winnerPairId === match.pair1Id && (
                                    <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>

                                {/* Pair 2 Slot */}
                                <div
                                  onClick={canEditActiveTableStructure ? () =>
                                    setSlotModalInfo({
                                      matchId: match.id,
                                      slot: 'pair2',
                                      roundName: match.roundName,
                                      matchNumber: match.matchNumber,
                                    })
                                  : undefined}
                                  aria-disabled={!canEditActiveTableStructure}
                                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                                    canEditActiveTableStructure ? 'cursor-pointer' : 'cursor-not-allowed'
                                  } ${
                                    match.winnerPairId === match.pair2Id
                                      ? 'bg-emerald-50 text-emerald-900 font-extrabold border border-emerald-300'
                                      : canEditActiveTableStructure ? 'hover:bg-slate-100 text-slate-800' : 'text-slate-800'
                                  }`}
                                  title={canEditActiveTableStructure
                                    ? 'Cliquer pour modifier cette position'
                                    : 'Activez l’édition pour modifier cette position'}
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
                                        : resolveMatchOutcomePlaceholder(
                                            match,
                                            'pair2',
                                            resolvedOutcomeMatches.bracketMatches
                                          ) ||
                                          match.pair2Placeholder ||
                                          'Choisir équipe'}
                                    </span>
                                    {!p2 && /^(?:Vainqueur|Perdant)\b/i.test(match.pair2Placeholder ?? '') && (
                                      <span className="shrink-0 text-[10px] font-semibold text-indigo-600">
                                        {match.pair2Placeholder}
                                      </span>
                                    )}
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
                                {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
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
                                : `Vainqueur Match #${m.matchNumber} (${m.roundName})`,
                              m.id,
                              'winner'
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
                                `Perdant Match #${m.matchNumber}`,
                                m.id,
                                'loser'
                              );
                            } else {
                              handleAssignToSlot(
                                slotModalInfo.matchId,
                                slotModalInfo.slot,
                                undefined,
                                `Perdant Match #${m.matchNumber} (${m.roundName})`,
                                m.id,
                                'loser'
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

import React, { useState, useEffect } from 'react';
import { Match, MatchScore, Pair, SetScore } from '../../types/tournament';
import { X, Trophy, AlertTriangle, Plus, Trash2, Check } from 'lucide-react';
import { getPadelMatchFormatDescription } from '../../utils/padelMatchFormats';

interface ScoreModalProps {
  match: Match;
  pair1?: Pair;
  pair2?: Pair;
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchId: string, score: MatchScore, winnerPairId?: string) => void;
  onClearScore?: (matchId: string) => void;
}

interface EditableSet {
  pair1: number;
  pair2: number;
  hasTieBreak: boolean;
  tbPair1: number;
  tbPair2: number;
  isSuperTieBreak: boolean;
  isMatchTieBreak: boolean;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  match,
  pair1,
  pair2,
  isOpen,
  onClose,
  onSave,
  onClearScore,
}) => {
  if (!isOpen) return null;

  const isThreeSetFormat = match.matchFormat === 'A1' || match.matchFormat === 'A2';
  const isTwoSetSuperTieBreakFormat = ['B1', 'B2', 'C1', 'C2'].includes(match.matchFormat ?? '');
  const isTenPointMatchFormat = match.matchFormat === 'E1';
  const tieBreakGames = match.matchFormat?.startsWith('A') || match.matchFormat?.startsWith('B')
    ? 6
    : match.matchFormat?.startsWith('C')
      ? 4
      : match.matchFormat?.startsWith('D')
        ? 8
        : undefined;
  const initialSets: EditableSet[] = match.score?.sets && match.score.sets.length > 0
    ? match.score.sets.map(s => {
        let tb1 = 7;
        let tb2 = 4;
        if (s.tieBreak && s.tieBreak.includes('-')) {
          const parts = s.tieBreak.split('-').map(Number);
          tb1 = isNaN(parts[0]) ? 7 : parts[0];
          tb2 = isNaN(parts[1]) ? 4 : parts[1];
        }
        return {
          pair1: s.pair1,
          pair2: s.pair2,
          hasTieBreak: !!s.tieBreak,
          tbPair1: tb1,
          tbPair2: tb2,
          isSuperTieBreak: !!s.isSuperTieBreak,
          isMatchTieBreak: !!s.isMatchTieBreak,
        };
      })
    : isTenPointMatchFormat
      ? [{
          pair1: 0,
          pair2: 0,
          hasTieBreak: false,
          tbPair1: 7,
          tbPair2: 4,
          isSuperTieBreak: false,
          isMatchTieBreak: true,
        }]
      : Array.from({ length: isThreeSetFormat || isTwoSetSuperTieBreakFormat ? 2 : 1 }, () => ({
          pair1: 0,
          pair2: 0,
          hasTieBreak: false,
          tbPair1: 7,
          tbPair2: 4,
          isSuperTieBreak: false,
          isMatchTieBreak: false,
        }));

  const [sets, setSets] = useState<EditableSet[]>(initialSets);
  const [winner, setWinner] = useState<string>(match.winnerPairId || match.pair1Id || '');
  const [isWalkover, setIsWalkover] = useState<boolean>(match.score?.isWalkover || false);
  const [isRetired, setIsRetired] = useState<boolean>(match.score?.isRetired || false);

  const applyScoreSuggestion = (
    set: EditableSet,
    team: 'pair1' | 'pair2',
    value: number
  ): EditableSet => {
    const updated = { ...set, [team]: value };
    if (
      tieBreakGames !== undefined &&
      !updated.isSuperTieBreak &&
      !updated.isMatchTieBreak &&
      updated.pair1 >= tieBreakGames &&
      updated.pair2 >= tieBreakGames &&
      Math.abs(updated.pair1 - updated.pair2) <= 1
    ) {
      updated.hasTieBreak = true;
    }
    return updated;
  };

  const pair1Label = pair1
    ? `${pair1.player1.firstName} ${pair1.player1.lastName} / ${pair1.player2.firstName} ${pair1.player2.lastName}`
    : match.pair1Placeholder || 'Équipe 1';
  const pair2Label = pair2
    ? `${pair2.player1.firstName} ${pair2.player1.lastName} / ${pair2.player2.firstName} ${pair2.player2.lastName}`
    : match.pair2Placeholder || 'Équipe 2';

  // Automatically update winner whenever sets change
  useEffect(() => {
    let p1Wins = 0;
    let p2Wins = 0;
    sets.forEach(s => {
      if (s.pair1 > s.pair2) p1Wins++;
      else if (s.pair2 > s.pair1) p2Wins++;
    });

    if (p1Wins > p2Wins && match.pair1Id) {
      setWinner(match.pair1Id);
    } else if (p2Wins > p1Wins && match.pair2Id) {
      setWinner(match.pair2Id);
    }
  }, [sets, match.pair1Id, match.pair2Id]);

  // Stepper handlers (+ and - only, no rigid suggestions)
  const incrementScore = (setIdx: number, team: 'pair1' | 'pair2') => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        const currentVal = s[team];
        const maxVal = s.isSuperTieBreak || s.isMatchTieBreak ? 30 : 25;
        return {
          ...applyScoreSuggestion(s, team, Math.min(maxVal, currentVal + 1)),
        };
      })
    );
  };

  const decrementScore = (setIdx: number, team: 'pair1' | 'pair2') => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        const currentVal = s[team];
        return {
          ...applyScoreSuggestion(s, team, Math.max(0, currentVal - 1)),
        };
      })
    );
  };

  // Direct keyboard input for scores
  const handleDirectScoreChange = (setIdx: number, team: 'pair1' | 'pair2', rawVal: string) => {
    if (rawVal === '') {
      setSets(prev =>
        prev.map((s, idx) => (idx === setIdx ? applyScoreSuggestion(s, team, 0) : s))
      );
      return;
    }
    const val = parseInt(rawVal, 10);
    const maxVal = sets[setIdx]?.isSuperTieBreak || sets[setIdx]?.isMatchTieBreak ? 30 : 25;
    const num = isNaN(val) ? 0 : Math.max(0, Math.min(maxVal, val));
    setSets(prev =>
      prev.map((s, idx) => (idx === setIdx ? applyScoreSuggestion(s, team, num) : s))
    );
  };

  // Direct keyboard input for tie-break
  const handleDirectTbChange = (setIdx: number, team: 'tbPair1' | 'tbPair2', rawVal: string) => {
    if (rawVal === '') {
      setSets(prev =>
        prev.map((s, idx) => (idx === setIdx ? { ...s, [team]: 0 } : s))
      );
      return;
    }
    const val = parseInt(rawVal, 10);
    const num = isNaN(val) ? 0 : Math.max(0, Math.min(50, val));
    setSets(prev =>
      prev.map((s, idx) => (idx === setIdx ? { ...s, [team]: num } : s))
    );
  };

  const incrementTb = (setIdx: number, team: 'tbPair1' | 'tbPair2') => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        return {
          ...s,
          [team]: Math.min(30, s[team] + 1),
        };
      })
    );
  };

  const decrementTb = (setIdx: number, team: 'tbPair1' | 'tbPair2') => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        return {
          ...s,
          [team]: Math.max(0, s[team] - 1),
        };
      })
    );
  };

  const toggleTieBreak = (setIdx: number) => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        return {
          ...s,
          hasTieBreak: !s.hasTieBreak,
        };
      })
    );
  };

  const toggleSuperTieBreak = (setIdx: number) => {
    setSets(prev =>
      prev.map((s, idx) => {
        if (idx !== setIdx) return s;
        const isTenPointFormatSet = isTenPointMatchFormat && idx === 0;
        const willBeSpecial = isTenPointFormatSet
          ? !s.isMatchTieBreak
          : !s.isSuperTieBreak;
        return {
          ...s,
          isSuperTieBreak: isTenPointFormatSet ? false : willBeSpecial,
          isMatchTieBreak: isTenPointFormatSet && willBeSpecial,
          pair1: 0,
          pair2: 0,
          hasTieBreak: false,
        };
      })
    );
  };

  const addSet = (isSuper: boolean = false) => {
    if (sets.length >= 3) return;
    setSets(prev => [
      ...prev,
      {
        pair1: 0,
        pair2: 0,
        hasTieBreak: false,
        tbPair1: 7,
        tbPair2: 4,
        isSuperTieBreak: isSuper,
        isMatchTieBreak: false,
      },
    ]);
  };

  const handleRemoveSet = (index: number) => {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    const compiledSets: SetScore[] = sets.map(s => ({
      pair1: Number(s.pair1),
      pair2: Number(s.pair2),
      tieBreak: s.hasTieBreak ? `${s.tbPair1}-${s.tbPair2}` : undefined,
      isSuperTieBreak: s.isSuperTieBreak,
      isMatchTieBreak: s.isMatchTieBreak,
    }));

    const scoreData: MatchScore = {
      sets: compiledSets,
      winnerPairId: winner,
      isWalkover,
      isRetired,
    };

    onSave(match.id, scoreData, winner);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Feuille de Match #{match.matchNumber} · Saisie Facile (+ / -)
            </span>
            <h3 className="text-base font-extrabold text-slate-900">{match.roundName}</h3>
            {match.matchFormat && (
              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                Format {match.matchFormat} · {getPadelMatchFormatDescription(match.matchFormat)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Winner Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Désigner le vainqueur de la rencontre
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => match.pair1Id && setWinner(match.pair1Id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  winner === match.pair1Id
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">Équipe 1</span>
                  {winner === match.pair1Id && (
                    <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      <Trophy className="w-3 h-3 text-emerald-700" /> Gagnant
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm text-slate-900 break-words [overflow-wrap:anywhere] leading-snug">{pair1Label}</p>
                {pair1?.seedRank && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded mt-1 inline-block">
                    TS {pair1.seedRank}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => match.pair2Id && setWinner(match.pair2Id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  winner === match.pair2Id
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">Équipe 2</span>
                  {winner === match.pair2Id && (
                    <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      <Trophy className="w-3 h-3 text-emerald-700" /> Gagnant
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm text-slate-900 break-words [overflow-wrap:anywhere] leading-snug">{pair2Label}</p>
                {pair2?.seedRank && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded mt-1 inline-block">
                    TS {pair2.seedRank}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Format selection */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Score par Set ({sets.length} set{sets.length > 1 ? 's' : ''})
            </span>
            <div className="flex items-center gap-1.5">
              {sets.length === 1 && (
                <button
                  type="button"
                  onClick={() => addSet(false)}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  + Ajouter Set 2
                </button>
              )}
              {sets.length === 2 && (
                <button
                  type="button"
                  onClick={() => addSet(!isThreeSetFormat)}
                  className={`px-2.5 py-1 text-xs font-semibold border rounded-lg transition-colors ${
                    isThreeSetFormat
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {isThreeSetFormat ? '+ Ajouter Set 3' : '+ Super Tie-Break (10 pts)'}
                </button>
              )}
            </div>
          </div>

          {/* Sets Editor with Tactile Steppers */}
          <div className="space-y-3.5">
            {sets.map((set, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 shadow-xs"
              >
                {/* Set Title & Mode */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      {set.isMatchTieBreak
                        ? `Set ${idx + 1} : Match tie-break (10 pts)`
                        : set.isSuperTieBreak
                          ? `Set ${idx + 1} : Super Tie-Break (10 pts)`
                          : `Set ${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSuperTieBreak(idx)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium"
                    >
                      {set.isMatchTieBreak || set.isSuperTieBreak
                        ? 'Passer en jeux normaux'
                        : isTenPointMatchFormat && idx === 0
                          ? 'Passer en match tie-break (10 pts)'
                          : 'Passer en Super TB'}
                    </button>
                  </div>

                  {sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-200 transition-colors"
                      title="Supprimer ce set"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Team 1 Stepper Row */}
                <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border border-slate-200 min-w-0">
                  <span className="text-xs font-bold text-slate-800 break-words [overflow-wrap:anywhere] leading-snug min-w-0 flex-1">
                    {pair1Label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementScore(idx, 'pair1')}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-900 font-extrabold text-xl flex items-center justify-center border border-slate-300 transition-transform select-none"
                      title="Diminuer (-)"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={set.isSuperTieBreak || set.isMatchTieBreak ? 30 : 25}
                      value={set.pair1}
                      onChange={(e) => handleDirectScoreChange(idx, 'pair1', e.target.value)}
                      className="w-13 sm:w-14 h-9 sm:h-10 text-center font-mono font-extrabold text-xl sm:text-2xl text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 tabular-nums"
                      aria-label="Score équipe 1 (saisie au clavier possible)"
                    />
                    <button
                      type="button"
                      onClick={() => incrementScore(idx, 'pair1')}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xl flex items-center justify-center shadow-xs transition-transform select-none"
                      title="Augmenter (+)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Team 2 Stepper Row */}
                <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border border-slate-200 min-w-0">
                  <span className="text-xs font-bold text-slate-800 break-words [overflow-wrap:anywhere] leading-snug min-w-0 flex-1">
                    {pair2Label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementScore(idx, 'pair2')}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-900 font-extrabold text-xl flex items-center justify-center border border-slate-300 transition-transform select-none"
                      title="Diminuer (-)"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={set.isSuperTieBreak || set.isMatchTieBreak ? 30 : 25}
                      value={set.pair2}
                      onChange={(e) => handleDirectScoreChange(idx, 'pair2', e.target.value)}
                      className="w-13 sm:w-14 h-9 sm:h-10 text-center font-mono font-extrabold text-xl sm:text-2xl text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 tabular-nums"
                      aria-label="Score équipe 2 (saisie au clavier possible)"
                    />
                    <button
                      type="button"
                      onClick={() => incrementScore(idx, 'pair2')}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xl flex items-center justify-center shadow-xs transition-transform select-none"
                      title="Augmenter (+)"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Tie-break option (for standard set) */}
                {!set.isSuperTieBreak && !set.isMatchTieBreak && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={set.hasTieBreak}
                        onChange={() => toggleTieBreak(idx)}
                        className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                      />
                      <span>
                        Tie-break joué
                        {tieBreakGames !== undefined
                          ? ` (conseillé à ${tieBreakGames}-${tieBreakGames})`
                          : ' (ex: 7-6 ou 9-8)'}
                      </span>
                    </label>

                    {set.hasTieBreak && (
                      <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-600">Points Tie-Break :</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">Éq. 1 :</span>
                            <button
                              type="button"
                              onClick={() => decrementTb(idx, 'tbPair1')}
                              className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-800 font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={set.tbPair1}
                              onChange={(e) => handleDirectTbChange(idx, 'tbPair1', e.target.value)}
                              className="w-10 h-7 text-center font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => incrementTb(idx, 'tbPair1')}
                              className="w-7 h-7 rounded bg-emerald-600 text-white font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-slate-400 font-bold">-</span>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">Éq. 2 :</span>
                            <button
                              type="button"
                              onClick={() => decrementTb(idx, 'tbPair2')}
                              className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-800 font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={set.tbPair2}
                              onChange={(e) => handleDirectTbChange(idx, 'tbPair2', e.target.value)}
                              className="w-10 h-7 text-center font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => incrementTb(idx, 'tbPair2')}
                              className="w-7 h-7 rounded bg-emerald-600 text-white font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Forfait / Abandon */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={isWalkover}
                  onChange={(e) => setIsWalkover(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
                <span>Forfait (WO)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={isRetired}
                  onChange={(e) => setIsRetired(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
                <span>Abandon en cours de match</span>
              </label>
            </div>

            {(isWalkover || isRetired) && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                {isWalkover ? 'Victoire WO (0 pt pour défaillant)' : 'Victoire par abandon'}
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-slate-600">
              Aperçu :{' '}
              <strong className="text-emerald-700 font-bold text-sm">
                {sets
                  .map(s => {
                    let str = `${s.pair1}-${s.pair2}`;
                    if (s.hasTieBreak) str += `(${s.tbPair1}-${s.tbPair2})`;
                    return str;
                  })
                  .join(' ')}
              </strong>
            </div>

            {match.score && onClearScore && (
              <button
                type="button"
                onClick={() => {
                  onClearScore(match.id);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                title="Effacer le score de cette rencontre"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vider le score</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
            >
              Valider le Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

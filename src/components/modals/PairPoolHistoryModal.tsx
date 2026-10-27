import React from 'react';
import { Court, Pair, Player, Pool, Match } from '../../types/tournament';
import { formatScore } from '../../utils/padelCalculations';
import {
  Trophy,
  X,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Flame,
  Award,
} from 'lucide-react';

interface PairPoolHistoryModalProps {
  isOpen: boolean;
  pair: Pair | null;
  selectedPlayer?: Player;
  pool?: Pool;
  pools?: Pool[];
  courts?: Court[];
  allMatches: Match[];
  allPairs: Pair[];
  onClose: () => void;
  onOpenScoreModal?: (match: Match) => void;
}

export const PairPoolHistoryModal: React.FC<PairPoolHistoryModalProps> = ({
  isOpen,
  pair,
  selectedPlayer,
  pool,
  pools = [],
  courts = [],
  allMatches,
  allPairs,
  onClose,
  onOpenScoreModal,
}) => {
  if (!isOpen || !pair) return null;

  const pairsMap = new Map<string, Pair>(allPairs.map(p => [p.id, p]));
  const courtsMap = new Map<string, string>(courts.map(court => [court.id, court.name]));

  // Matches involving this pair in this pool or overall
  const relevantMatches = allMatches.filter(
    m => m.pair1Id === pair.id || m.pair2Id === pair.id
  );
  const nextMatch = relevantMatches
    .filter(match => match.status !== 'completed' && match.status !== 'walkover')
    .sort((a, b) => {
      const aIsActive = a.status === 'in_progress' || a.status === 'warmup';
      const bIsActive = b.status === 'in_progress' || b.status === 'warmup';
      if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
      if (!a.scheduledTime) return b.scheduledTime ? 1 : 0;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.localeCompare(b.scheduledTime, undefined, { numeric: true });
    })[0];
  const pairPools = pools.filter(candidate => candidate.pairIds.includes(pair.id));

  // Pool standing for this pair if pool is provided
  const standing = pool?.standings.find(s => s.pairId === pair.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              {selectedPlayer && (
                <span className="text-xs font-medium text-slate-500 block">
                  Fiche joueur · {selectedPlayer.firstName} {selectedPlayer.lastName}
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {pool?.name || pairPools.map(candidate => candidate.name).join(' · ') || 'Historique des Matchs'}
                </span>
                {pair.seedRank && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold border border-amber-200">
                    TS {pair.seedRank}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {pair.player1.firstName} {pair.player1.lastName} / {pair.player2.firstName} {pair.player2.lastName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {selectedPlayer && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Informations joueur
              </h4>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div><span className="text-slate-500">Club :</span> <strong className="text-slate-800">{selectedPlayer.club || '—'}</strong></div>
                <div><span className="text-slate-500">Licence :</span> <strong className="font-mono text-slate-800">{selectedPlayer.licenseNumber || '—'}</strong></div>
                <div><span className="text-slate-500">Classement :</span> <strong className="text-slate-800">{selectedPlayer.ranking}</strong></div>
                <div><span className="text-slate-500">Téléphone :</span> <strong className="text-slate-800">{selectedPlayer.phone || '—'}</strong></div>
                <div><span className="text-slate-500">Présence :</span> <strong className="text-slate-800">{selectedPlayer.isPresent ? 'Émargé(e)' : 'Non émargé(e)'}</strong></div>
                <div><span className="text-slate-500">Règlement :</span> <strong className="text-slate-800">
                  {selectedPlayer.paymentStatus === 'paid' ? `Réglé (${selectedPlayer.paidAmount} €)` : selectedPlayer.paymentStatus === 'waived' ? 'Offert' : 'À régler'}
                </strong></div>
                {selectedPlayer.email && (
                  <div className="sm:col-span-2"><span className="text-slate-500">E-mail :</span> <strong className="text-slate-800">{selectedPlayer.email}</strong></div>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Paire et prochaine rencontre
            </h4>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700">
              <span>Partenaire : <strong>{selectedPlayer?.id === pair.player1.id
                ? `${pair.player2.firstName} ${pair.player2.lastName}`
                : selectedPlayer?.id === pair.player2.id
                  ? `${pair.player1.firstName} ${pair.player1.lastName}`
                  : `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`}</strong></span>
              <span>Poids de paire : <strong>#{pair.totalWeight}</strong></span>
              {pair.seedRank && <span>Tête de série : <strong>TS {pair.seedRank}</strong></span>}
              {pairPools.length > 0 && (
                <span>Poule : <strong>{pairPools.map(candidate => candidate.name).join(', ')}</strong></span>
              )}
            </div>
            {nextMatch ? (
              <div className="mt-3 border-t border-emerald-200 pt-3 text-xs text-slate-700">
                <strong>{nextMatch.roundName}</strong>
                <span> · {nextMatch.status === 'in_progress' ? 'En cours' : nextMatch.status === 'warmup' ? 'Échauffement' : 'À venir'}</span>
                {nextMatch.scheduledTime && <span> · {nextMatch.scheduledTime}</span>}
                <span> · {nextMatch.courtId ? courtsMap.get(nextMatch.courtId) || 'Terrain non renseigné' : 'Terrain à définir'}</span>
              </div>
            ) : (
              <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-slate-500">
                Aucun prochain match programmé.
              </p>
            )}
          </section>

          {/* Standing summary card if pool */}
          {standing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Classement</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  #{standing.rank || 1}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Points FFT</span>
                <span className="text-base font-bold text-emerald-700 font-mono">
                  {standing.points} pts
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Victoires / Déf.</span>
                <span className="text-base font-bold text-slate-700 font-mono">
                  {standing.won}V - {standing.lost}D
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Diff. Sets</span>
                <span
                  className={`text-base font-bold font-mono ${
                    standing.setDiff > 0
                      ? 'text-emerald-700'
                      : standing.setDiff < 0
                      ? 'text-rose-600'
                      : 'text-slate-700'
                  }`}
                >
                  {standing.setDiff > 0 ? `+${standing.setDiff}` : standing.setDiff}
                </span>
              </div>
            </div>
          )}

          {/* Matches List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Rencontres jouées et programmées ({relevantMatches.length})
              </h4>
              <span className="text-[11px] text-slate-400">Cliquez pour voir les détails</span>
            </div>

            {relevantMatches.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200 font-medium">
                Aucun match enregistré pour cette équipe.
              </div>
            ) : (
              <div className="space-y-2">
                {relevantMatches.map((m) => {
                  const isPair1 = m.pair1Id === pair.id;
                  const opponentId = isPair1 ? m.pair2Id : m.pair1Id;
                  const opponent = opponentId ? pairsMap.get(opponentId) : undefined;
                  const opponentPlaceholder = isPair1 ? m.pair2Placeholder : m.pair1Placeholder;

                  const isFinished = m.status === 'completed' || m.status === 'walkover';
                  const isLive = m.status === 'in_progress';
                  const isWinner = isFinished && m.winnerPairId === pair.id;
                  const isLoser = isFinished && m.winnerPairId && m.winnerPairId !== pair.id;

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border transition-colors shadow-xs ${
                        isWinner
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : isLoser
                          ? 'bg-rose-50/50 border-rose-200'
                          : isLive
                          ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/50'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 text-xs">
                        <span className="font-semibold text-slate-600">{m.roundName}</span>
                        {isWinner && (
                          <span className="flex items-center gap-1 font-bold text-emerald-800 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Victoire
                          </span>
                        )}
                        {isLoser && (
                          <span className="flex items-center gap-1 font-bold text-rose-700 text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" /> Défaite
                          </span>
                        )}
                        {isLive && (
                          <span className="flex items-center gap-1 font-bold text-amber-800 text-[11px] animate-pulse">
                            <Radio className="w-3.5 h-3.5 text-amber-600" /> En Direct
                          </span>
                        )}
                        {m.status === 'walkover' && (
                          <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Qualification par bye
                          </span>
                        )}
                        {!isFinished && !isLive && (
                          <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> À jouer {m.scheduledTime ? `· ${m.scheduledTime}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            vs {opponent ? `${opponent.player1.firstName} ${opponent.player1.lastName} / ${opponent.player2.firstName} ${opponent.player2.lastName}` : opponentPlaceholder || 'Adversaire inconnu'}
                          </p>
                          {opponent && (
                            <p className="text-[11px] text-slate-500">
                              {opponent.player1.club} · Poids #{opponent.totalWeight}
                            </p>
                          )}
                          {(m.courtId || m.scheduledTime) && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {m.courtId ? courtsMap.get(m.courtId) || 'Terrain non renseigné' : 'Terrain à définir'}
                            </p>
                          )}
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0">
                          {m.score ? (
                            <span className="font-mono font-bold text-sm text-emerald-700 block">
                              {formatScore(m.score)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Score non saisi</span>
                          )}

                          {onOpenScoreModal && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenScoreModal(m);
                              }}
                              className="text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline mt-0.5 font-bold"
                            >
                              Saisir score &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

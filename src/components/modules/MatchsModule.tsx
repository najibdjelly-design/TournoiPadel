import React, { useMemo, useState } from 'react';
import { Match, Pair, Tournament } from '../../types/tournament';
import { Clock, Play, Radio, ClipboardEdit } from 'lucide-react';

interface MatchsModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
  onOpenScoreModal: (match: Match) => void;
}

const pairLabel = (pair?: Pair, placeholder?: string) =>
  pair
    ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
    : placeholder || 'À confirmer';

const formatElapsed = (startedAt?: string, now = Date.now()) => {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(start)) return null;
  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
    : `${minutes} min`;
};

export const MatchsModule: React.FC<MatchsModuleProps> = ({
  tournament,
  onUpdateTournament,
  onOpenScoreModal,
}) => {
  const [view, setView] = useState<'todo' | 'live'>('todo');
  const [courtChoice, setCourtChoice] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const pairsMap = useMemo(() => new Map(tournament.pairs.map(pair => [pair.id, pair])), [tournament.pairs]);
  const courtsMap = useMemo(() => new Map(tournament.courts.map(court => [court.id, court])), [tournament.courts]);

  const allMatches = useMemo(
    () => [
      ...tournament.pools.flatMap(pool => pool.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ],
    [tournament]
  );

  const liveMatches = allMatches
    .filter(match => match.status === 'in_progress')
    .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));

  // Only matches whose two teams are known can be started
  const todoMatches = allMatches
    .filter(
      match =>
        (match.status === 'scheduled' || match.status === 'warmup') &&
        Boolean(match.pair1Id) &&
        Boolean(match.pair2Id)
    )
    .sort(
      (a, b) =>
        (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99') ||
        a.matchNumber - b.matchNumber
    );

  const busyCourtIds = new Set(liveMatches.map(match => match.courtId).filter(Boolean));

  const handleLaunch = (match: Match) => {
    const courtId = courtChoice[match.id] ?? match.courtId;
    if (!courtId) {
      window.alert('Choisissez le terrain sur lequel le match est joué.');
      return;
    }
    const occupant = liveMatches.find(live => live.courtId === courtId && live.id !== match.id);
    if (
      occupant &&
      !window.confirm(
        `${courtsMap.get(courtId)?.name ?? 'Ce terrain'} est déjà occupé par un match en cours. Lancer quand même ?`
      )
    ) {
      return;
    }
    const startedAt = new Date().toISOString();
    const launch = (list: Match[]) =>
      list.map(item => (item.id === match.id ? { ...item, status: 'in_progress' as const, courtId, startedAt } : item));
    onUpdateTournament({
      ...tournament,
      pools: tournament.pools.map(pool => ({ ...pool, matches: launch(pool.matches) })),
      bracketMatches: launch(tournament.bracketMatches),
      consolanteMatches: launch(tournament.consolanteMatches),
    });
    setCourtChoice(previous => {
      const { [match.id]: _removed, ...rest } = previous;
      return rest;
    });
  };

  const renderTeams = (match: Match) => (
    <div className="min-w-0 space-y-0.5 text-sm font-semibold text-slate-900">
      <p className="break-words">{pairLabel(match.pair1Id ? pairsMap.get(match.pair1Id) : undefined, match.pair1Placeholder)}</p>
      <p className="break-words text-slate-600">
        vs {pairLabel(match.pair2Id ? pairsMap.get(match.pair2Id) : undefined, match.pair2Placeholder)}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Matchs</h1>
        <p className="text-xs text-slate-500">
          Lancez les matchs programmés, puis saisissez les scores des matchs en cours.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setView('todo')}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 ${
            view === 'todo' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> À lancer ({todoMatches.length})
        </button>
        <button
          type="button"
          onClick={() => setView('live')}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 ${
            view === 'live' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Radio className="h-3.5 w-3.5" /> En cours ({liveMatches.length})
        </button>
      </div>

      {view === 'todo' ? (
        todoMatches.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Aucun match programmé en attente de lancement.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {todoMatches.map(match => {
              const selectedCourt = courtChoice[match.id] ?? match.courtId ?? '';
              return (
                <div key={match.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="w-14 shrink-0 font-mono text-sm font-bold text-emerald-700">
                      {match.scheduledTime || 'À suivre'}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] text-slate-500">
                        {match.roundName} · Match #{match.matchNumber}
                      </p>
                      {renderTeams(match)}
                      {match.courtId && (
                        <p className="text-[11px] text-slate-500">
                          Prévu sur {courtsMap.get(match.courtId)?.name ?? 'terrain à confirmer'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={selectedCourt}
                      onChange={event => setCourtChoice(previous => ({ ...previous, [match.id]: event.target.value }))}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-semibold"
                      aria-label="Terrain où le match est joué"
                    >
                      <option value="">Terrain…</option>
                      {tournament.courts.map(court => (
                        <option key={court.id} value={court.id}>
                          {court.name}
                          {busyCourtIds.has(court.id) ? ' (occupé)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleLaunch(match)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <Play className="h-3.5 w-3.5" /> Lancer le match
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : liveMatches.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Aucun match en cours.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {liveMatches.map(match => {
            const elapsed = formatElapsed(match.startedAt, now);
            return (
              <div key={match.id} className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                  <span>
                    {courtsMap.get(match.courtId ?? '')?.name ?? 'Terrain à confirmer'} · {match.roundName}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-mono font-bold text-emerald-700">
                    <Radio className="h-3 w-3 animate-pulse" /> {elapsed ?? 'LIVE'}
                  </span>
                </div>
                {renderTeams(match)}
                <button
                  type="button"
                  onClick={() => onOpenScoreModal(match)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                >
                  <ClipboardEdit className="h-3.5 w-3.5" /> Saisir le score
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

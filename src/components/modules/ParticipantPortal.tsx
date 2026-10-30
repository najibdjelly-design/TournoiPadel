import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Radio, RefreshCw, Search, Trophy, Users, X } from 'lucide-react';
import type { ParticipantViewData, PublicParticipantPair } from '../../types/participantView';
import { getPadelMatchFormatDescription } from '../../utils/padelMatchFormats';

type ParticipantTab = 'participants' | 'schedule' | 'standings' | 'ranking';

function getPairClubs(pair: PublicParticipantPair): string {
  const clubs = [pair.player1.club, pair.player2.club].filter(
    (club, index, list) => club && list.indexOf(club) === index
  );
  return clubs.length ? clubs.join(' · ') : 'Club non renseigné';
}

const PairLink: React.FC<{
  id?: string;
  label: string;
  winner?: boolean;
  inline?: boolean;
  onSelect: (id: string) => void;
}> = ({ id, label, winner, inline, onSelect }) =>
  id ? (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`${inline ? 'inline' : 'block w-full truncate'} text-left hover:text-emerald-700 hover:underline ${
        winner ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
      }`}
    >
      {label}
    </button>
  ) : (
    <span className={inline ? undefined : 'block truncate text-slate-500'}>{label}</span>
  );

function getErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
  return typeof body.error === 'string' ? body.error : undefined;
}

function getMatchStatus(status: string): string {
  if (status === 'in_progress') return 'En direct';
  if (status === 'completed') return 'Terminé';
  if (status === 'walkover') return 'Forfait';
  if (status === 'warmup') return 'Échauffement';
  return 'À venir';
}

export const ParticipantPortal: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<ParticipantViewData | null>(null);
  const [activeTab, setActiveTab] = useState<ParticipantTab>('participants');
  const [search, setSearch] = useState('');
  const [scheduleView, setScheduleView] = useState<'grid' | 'list'>('grid');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: ReturnType<typeof setTimeout>;
    const query = new URLSearchParams({ token });

    const refresh = async () => {
      try {
        const response = await fetch(`/api/participant-view?${query.toString()}`, {
          cache: 'no-store',
        });
        const responseText = await response.text();
        let body: unknown;
        try {
          body = responseText ? JSON.parse(responseText) : null;
        } catch {
          throw new Error(
            `L’API participants a renvoyé une réponse non JSON (HTTP ${response.status}). Consultez les journaux de la fonction Vercel.`
          );
        }
        if (!response.ok) {
          throw new Error(
            getErrorMessage(body) ??
              `Impossible de charger les informations du tournoi (HTTP ${response.status}).`
          );
        }
        if (typeof body !== 'object' || body === null || !('participants' in body)) {
          throw new Error('La réponse de l’API participants ne contient pas les données attendues.');
        }
        if (isMounted) {
          setData(body as ParticipantViewData);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Une erreur de chargement est survenue.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          refreshTimer = setTimeout(() => void refresh(), 30_000);
        }
      }
    };

    void refresh();
    return () => {
      isMounted = false;
      clearTimeout(refreshTimer);
    };
  }, [token]);

  const filteredParticipants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    if (!query || activeTab !== 'participants') return data?.participants ?? [];
    return (data?.participants ?? []).filter(pair =>
      [
        pair.player1.firstName,
        pair.player1.lastName,
        pair.player1.club,
        pair.player2.firstName,
        pair.player2.lastName,
        pair.player2.club,
        pair.placement,
      ].some(value => value.toLocaleLowerCase('fr').includes(query))
    );
  }, [activeTab, data, search]);

  const filteredMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    const matches = data?.matches ?? [];
    if (!query || activeTab !== 'schedule') return matches;
    return matches.filter(match =>
      [
        match.roundName,
        match.pair1,
        match.pair2,
        match.courtName ?? '',
        match.scheduledTime ?? '',
      ].some(value => value.toLocaleLowerCase('fr').includes(query))
    );
  }, [activeTab, data, search]);

  const scheduleTimes = useMemo(
    () =>
      Array.from(
        new Set(filteredMatches.flatMap(match => (match.courtId && match.scheduledTime ? [match.scheduledTime] : [])))
      ).sort(),
    [filteredMatches]
  );

  const selectedPair = useMemo(
    () => data?.participants.find(pair => pair.id === selectedPairId),
    [data, selectedPairId]
  );

  const selectedMatches = useMemo(
    () =>
      (data?.matches ?? []).filter(
        match => match.pair1Id === selectedPairId || match.pair2Id === selectedPairId
      ),
    [data, selectedPairId]
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-600">Chargement de la vue participants…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-extrabold text-slate-900">Vue participants indisponible</h1>
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {errorMessage ?? 'Ce lien est invalide ou a été désactivé.'}
          </p>
        </section>
      </main>
    );
  }

  const tabs: Array<{ id: ParticipantTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'participants', label: `Participants (${data.participants.length})`, icon: Users },
    { id: 'schedule', label: 'Programme & résultats', icon: CalendarDays },
    { id: 'standings', label: 'Classement des poules', icon: Trophy },
    { id: 'ranking', label: 'Classement général', icon: Trophy },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Espace joueurs · {data.tournament.category} {data.tournament.gender}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                {data.tournament.name}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <MapPin className="h-4 w-4 shrink-0" />
                {data.tournament.club} · {data.tournament.city}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.tournament.startDate}
                {data.tournament.endDate !== data.tournament.startDate &&
                  ` au ${data.tournament.endDate}`}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              Actualisé toutes les 30 s
            </div>
          </div>
        </header>

        {errorMessage && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Actualisation impossible : {errorMessage} Les dernières données chargées restent affichées.
          </p>
        )}

        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1.5" aria-label="Menu participants">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setSearch('');
              }}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                activeTab === id
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {(activeTab === 'participants' || activeTab === 'schedule') && (
          <label className="relative block">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={activeTab === 'participants' ? 'Rechercher un joueur, un club ou une poule…' : 'Rechercher une paire, un tour ou un terrain…'}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        )}

        {activeTab === 'participants' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-bold text-slate-900">Paires confirmées</h2>
              <span className="text-xs text-slate-500">{filteredParticipants.length} paire(s)</span>
            </div>
            {filteredParticipants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3">Joueur 1</th>
                      <th className="px-4 py-3">Joueur 2</th>
                      <th className="px-4 py-3">Club</th>
                      <th className="px-4 py-3 text-center">Tête de série</th>
                      <th className="px-4 py-3 text-center">Poids</th>
                      <th className="px-4 py-3">Poule / Accès</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.map((pair, index) => (
                      <tr key={pair.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold">
                          <button type="button" onClick={() => setSelectedPairId(pair.id)} className="text-left text-slate-900 hover:text-emerald-700 hover:underline">
                            {pair.player1.firstName} {pair.player1.lastName}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          <button type="button" onClick={() => setSelectedPairId(pair.id)} className="text-left text-slate-900 hover:text-emerald-700 hover:underline">
                            {pair.player2.firstName} {pair.player2.lastName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{getPairClubs(pair)}</td>
                        <td className="px-4 py-3 text-center">
                          {pair.seedRank ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">TS {pair.seedRank}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-700">{pair.totalWeight}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">{pair.placement}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Aucune paire confirmée ne correspond à la recherche.</p>
            )}
          </section>
        )}

        {activeTab === 'schedule' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-bold text-slate-900">Programme et résultats</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{filteredMatches.length} match(s)</span>
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
                  {([['grid', 'Par terrain'], ['list', 'Liste']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setScheduleView(mode)}
                      className={`rounded-md px-2.5 py-1 ${scheduleView === mode ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {scheduleView === 'grid' && filteredMatches.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th className="w-20 px-3 py-3 text-left font-mono font-bold uppercase tracking-wider text-emerald-800">Horaire</th>
                      {data.courts.map(court => (
                        <th key={court.id} className="border-l border-slate-200 px-3 py-3 text-left font-bold text-slate-900">{court.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduleTimes.map(time => (
                      <tr key={time}>
                        <td className="bg-slate-50/50 px-3 py-3 align-top font-mono font-bold text-emerald-800">{time}</td>
                        {data.courts.map(court => {
                          const match = filteredMatches.find(
                            candidate => candidate.courtId === court.id && candidate.scheduledTime === time
                          );
                          return (
                            <td key={court.id} className="border-l border-slate-100 px-2 py-2 align-top">
                              {match && (
                                <div className={`space-y-1 rounded-xl border p-2.5 ${
                                  match.status === 'in_progress'
                                    ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300/60'
                                    : match.status === 'completed'
                                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                                    : 'border-slate-200 bg-white'
                                }`}>
                                  <p className="flex items-center justify-between gap-1 text-[10px] font-semibold text-slate-500">
                                    <span className="truncate">{match.roundName}</span>
                                    <span>{getMatchStatus(match.status)}</span>
                                  </p>
                                  <PairLink id={match.pair1Id} label={match.pair1} winner={match.winnerPairId === match.pair1Id} onSelect={setSelectedPairId} />
                                  <PairLink id={match.pair2Id} label={match.pair2} winner={match.winnerPairId === match.pair2Id} onSelect={setSelectedPairId} />
                                  {match.score && <p className="font-mono font-bold text-emerald-800">{match.score}</p>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMatches.some(match => !match.courtId || !match.scheduledTime) && (
                  <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
                    Les matchs sans terrain ou horaire sont visibles dans la vue « Liste ».
                  </p>
                )}
              </div>
            )}
            {scheduleView === 'list' && filteredMatches.length ? (
              <div className="divide-y divide-slate-100">
                {filteredMatches.map((match, index) => (
                  <article key={`${match.roundName}-${match.matchNumber}-${index}`} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-500">
                        {match.roundName} · Match #{match.matchNumber} · {getMatchStatus(match.status)}
                        {match.matchFormat && (
                          <span
                            className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700"
                            title={getPadelMatchFormatDescription(match.matchFormat)}
                          >
                            Format {match.matchFormat}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 font-semibold text-sm text-slate-900">
                        <PairLink inline id={match.pair1Id} label={match.pair1} onSelect={setSelectedPairId} />{' '}
                        <span className="px-1 text-slate-400">vs</span>{' '}
                        <PairLink inline id={match.pair2Id} label={match.pair2} onSelect={setSelectedPairId} />
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-slate-600">
                        {match.scheduledTime ?? 'Horaire à confirmer'}
                        {match.courtName ? ` · ${match.courtName}` : ''}
                      </span>
                      {match.score && (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 font-mono font-bold text-emerald-800">
                          {match.score}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Aucun match ne correspond à la recherche.</p>
            ) : null}
          </section>
        )}

        {activeTab === 'ranking' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900 sm:px-5">Classement général</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="w-16 px-4 py-3 text-center">Rang</th>
                    <th className="px-4 py-3">Équipe</th>
                    <th className="px-4 py-3">Club</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.finalStandings.map(item => (
                    <tr key={item.rank} className={item.rank <= 3 ? 'bg-amber-50/30' : undefined}>
                      <td className="px-4 py-3 text-center font-mono font-black text-slate-800">{item.rank}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.pairId ? (
                          <PairLink inline id={item.pairId} label={item.pairName} onSelect={setSelectedPairId} />
                        ) : (
                          <span className="font-normal italic text-slate-400">En attente de résultat</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.club || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          item.status === 'confirmed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : item.status === 'in_progress'
                            ? 'border-blue-200 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          {item.status === 'confirmed' ? 'Confirmé' : item.status === 'in_progress' ? 'En cours' : 'À venir'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.detail}</td>
                    </tr>
                  ))}
                  {!data.finalStandings.length && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Le classement n’est pas encore disponible.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'standings' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.pools.map(pool => (
              <section key={pool.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">{pool.name}</h2>
                {pool.standings.length ? (
                  <div className="divide-y divide-slate-100">
                    {pool.standings.map(standing => (
                      <div key={`${pool.name}-${standing.rank}-${standing.pairName}`} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <div className="min-w-0">
                          <span className="mr-2 font-mono font-bold text-slate-500">{standing.rank}.</span>
                          <span className="font-semibold text-slate-900">{standing.pairName}</span>
                          {standing.qualified && (
                            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Qualifié</span>
                          )}
                        </div>
                        <span className="shrink-0 text-right font-mono text-slate-600">
                          {standing.points} pts · {standing.won}V/{standing.lost}D
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-xs text-slate-500">Classement en attente des résultats.</p>
                )}
              </section>
            ))}
            {!data.pools.length && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 lg:col-span-2">
                Les poules ne sont pas encore disponibles.
              </section>
            )}
          </div>
        )}

        <footer className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-slate-400">
          <RefreshCw className="h-3 w-3" />
          Actualisé automatiquement toutes les 30 secondes
        </footer>
      </div>

      {selectedPair && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedPairId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Détail de la paire"
            onClick={event => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Détail de la paire</h2>
                <p className="mt-0.5 text-xs text-slate-500">{getPairClubs(selectedPair)}</p>
              </div>
              <button type="button" onClick={() => setSelectedPairId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[selectedPair.player1, selectedPair.player2].map((player, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="text-sm font-bold text-slate-900">{player.firstName} {player.lastName}</p>
                  <p className="mt-1 text-slate-600">{player.club || 'Club non renseigné'}</p>
                  {player.ranking ? <p className="text-slate-600">Classement : {player.ranking}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {selectedPair.seedRank && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">Tête de série {selectedPair.seedRank}</span>
              )}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Poids {selectedPair.totalWeight}</span>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">{selectedPair.placement}</span>
            </div>

            <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-600">Matchs</h3>
            {selectedMatches.length ? (
              <ul className="mt-2 space-y-2">
                {selectedMatches.map(match => {
                  const opponent = match.pair1Id === selectedPair.id ? match.pair2 : match.pair1;
                  const won = match.winnerPairId === selectedPair.id;
                  return (
                    <li key={`${match.roundName}-${match.matchNumber}`} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <p className="font-semibold text-slate-500">
                        {match.roundName} · {getMatchStatus(match.status)}
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">contre {opponent}</p>
                      <p className="mt-1 text-slate-600">
                        {match.scheduledTime ?? 'Horaire à confirmer'}
                        {match.courtName ? ` · ${match.courtName}` : ''}
                      </p>
                      {match.score && (
                        <p className={`mt-1 font-mono font-bold ${won ? 'text-emerald-800' : 'text-slate-700'}`}>
                          {won ? 'Victoire' : match.winnerPairId ? 'Défaite' : 'Score'} · {match.score}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Aucun match programmé pour le moment.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

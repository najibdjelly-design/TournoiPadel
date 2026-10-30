import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Radio, RefreshCw, Search, Trophy, Users } from 'lucide-react';
import type { ParticipantViewData } from '../../types/participantView';
import { getPadelMatchFormatDescription } from '../../utils/padelMatchFormats';

type ParticipantTab = 'participants' | 'schedule' | 'standings';

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
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            getErrorMessage(body) ?? 'Impossible de charger les informations du tournoi.'
          );
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
              <div className="divide-y divide-slate-100">
                {filteredParticipants.map((pair, index) => (
                  <article key={`${pair.player1.lastName}-${pair.player2.lastName}-${index}`} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">
                        {pair.player1.firstName} {pair.player1.lastName}
                        <span className="px-1.5 text-slate-400">/</span>
                        {pair.player2.firstName} {pair.player2.lastName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pair.player1.club || pair.player2.club
                          ? [pair.player1.club, pair.player2.club]
                              .filter((club, clubIndex, clubs) => club && clubs.indexOf(club) === clubIndex)
                              .join(' · ')
                          : 'Club non renseigné'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {pair.seedRank && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">
                          Tête de série {pair.seedRank}
                        </span>
                      )}
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                        Poids {pair.totalWeight}
                      </span>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                        {pair.placement}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Aucune paire confirmée ne correspond à la recherche.</p>
            )}
          </section>
        )}

        {activeTab === 'schedule' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-bold text-slate-900">Programme et résultats</h2>
              <span className="text-xs text-slate-500">{filteredMatches.length} match(s)</span>
            </div>
            {filteredMatches.length ? (
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
                        {match.pair1} <span className="px-1 text-slate-400">vs</span> {match.pair2}
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
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Aucun match ne correspond à la recherche.</p>
            )}
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
    </main>
  );
};

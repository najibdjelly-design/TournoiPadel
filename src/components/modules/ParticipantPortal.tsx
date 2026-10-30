import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { Match, Pair, Player } from '../../types/tournament';
import type { ParticipantViewData } from '../../types/participantView';
import { PairPoolHistoryModal } from '../modals/PairPoolHistoryModal';
import { PublicLiveModule } from './PublicLiveModule';


function getErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
  return typeof body.error === 'string' ? body.error : undefined;
}

export const ParticipantPortal: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<ParticipantViewData | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>(undefined);
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
        if (typeof body !== 'object' || body === null || !('tournament' in body)) {
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

  const tournament = data?.tournament;

  const allMatches: Match[] = useMemo(
    () =>
      tournament
        ? [
            ...tournament.pools.flatMap(pool => pool.matches),
            ...tournament.bracketMatches,
            ...tournament.consolanteMatches,
          ]
        : [],
    [tournament]
  );

  const rows = useMemo(() => {
    if (!tournament) return [];
    const query = search.trim().toLocaleLowerCase('fr');
    return tournament.pairs
      .map(pair => {
        const pool = tournament.pools.find(
          candidate => candidate.id === pair.poolId || candidate.pairIds.includes(pair.id)
        );
        return {
          pair,
          pool,
          placement:
            pool?.name ?? (pair.isDirectTableau ? 'Accès direct au tableau' : 'Affectation à venir'),
        };
      })
      .sort((a, b) => a.pair.totalWeight - b.pair.totalWeight)
      .filter(({ pair, placement }) =>
        !query ||
        [
          pair.player1.firstName,
          pair.player1.lastName,
          pair.player1.club,
          pair.player2.firstName,
          pair.player2.lastName,
          pair.player2.club,
          placement,
        ].some(value => value.toLocaleLowerCase('fr').includes(query))
      );
  }, [search, tournament]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-600">Chargement de la vue participants…</p>
      </main>
    );
  }

  if (!data || !tournament) {
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

  const openPair = (pair: Pair, player?: Player) => {
    setSelectedPair(pair);
    setSelectedPlayer(player);
  };

  const participantsPanel = (
    <div className="space-y-4">
            <label className="relative block">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher un joueur, un club ou une poule…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-bold">Paires confirmées</h2>
                <span className="text-xs text-slate-500">{rows.length} paire(s)</span>
              </div>
              {rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                        <th className="px-3 py-3 text-center sm:px-4">#</th>
                        <th className="px-3 py-3 sm:px-4">Joueur 1</th>
                        <th className="px-3 py-3 sm:px-4">Joueur 2</th>
                        <th className="hidden px-4 py-3 md:table-cell">Club</th>
                        <th className="hidden px-4 py-3 text-center sm:table-cell">Tête de série</th>
                        <th className="hidden px-4 py-3 text-center sm:table-cell">Poids</th>
                        <th className="px-3 py-3 sm:px-4">Poule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map(({ pair, placement }, index) => (
                        <tr key={pair.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-3 text-center font-mono text-slate-500 sm:px-4">{index + 1}</td>
                          {[pair.player1, pair.player2].map(player => (
                            <td key={player.id} className="px-3 py-3 font-semibold sm:px-4">
                              <button
                                type="button"
                                onClick={() => openPair(pair, player)}
                                className="text-left text-slate-900 hover:text-emerald-700 hover:underline"
                              >
                                {player.firstName} {player.lastName}
                              </button>
                            </td>
                          ))}
                          <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                            {[pair.player1.club, pair.player2.club]
                              .filter((club, i, list) => club && list.indexOf(club) === i)
                              .join(' · ') || 'Club non renseigné'}
                          </td>
                          <td className="hidden px-4 py-3 text-center sm:table-cell">
                            {pair.seedRank ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">TS {pair.seedRank}</span>
                            ) : '—'}
                          </td>
                          <td className="hidden px-4 py-3 text-center font-mono text-slate-700 sm:table-cell">{pair.totalWeight}</td>
                          <td className="px-3 py-3 sm:px-4">
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">{placement}</span>
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
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {errorMessage && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Actualisation impossible : {errorMessage} Les dernières données chargées restent affichées.
          </p>
        )}

        <PublicLiveModule tournament={tournament} participantsPanel={participantsPanel} />

        <footer className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-slate-400">
          <RefreshCw className="h-3 w-3" />
          Actualisé automatiquement toutes les 30 secondes
        </footer>
      </div>

      <PairPoolHistoryModal
        isOpen={Boolean(selectedPair)}
        pair={selectedPair}
        selectedPlayer={selectedPlayer}
        pool={selectedPair ? tournament.pools.find(pool => pool.pairIds.includes(selectedPair.id)) : undefined}
        pools={tournament.pools}
        courts={tournament.courts}
        allMatches={allMatches}
        allPairs={tournament.pairs}
        onClose={() => {
          setSelectedPair(null);
          setSelectedPlayer(undefined);
        }}
      />
    </main>
  );
};

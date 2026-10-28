/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { boltClient } from './db/boltClient';
import { supabase } from './db/supabase';
import { AuthGate } from './components/AuthGate';
import { Tournament, Match, MatchScore, Pair } from './types/tournament';
import { Header } from './components/Header';
import { Sidebar, NavigationModule } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OverviewModule } from './components/modules/OverviewModule';
import { InscriptionsModule } from './components/modules/InscriptionsModule';
import { PoulesModule } from './components/modules/PoulesModule';
import { TableauModule } from './components/modules/TableauModule';
import { ProgrammeModule } from './components/modules/ProgrammeModule';
import { ConvocationsModule } from './components/modules/ConvocationsModule';
import { CaisseModule } from './components/modules/CaisseModule';
import { PublicLiveModule } from './components/modules/PublicLiveModule';
import { ScoreModal } from './components/modals/ScoreModal';
import { NewTournamentModal } from './components/modals/NewTournamentModal';
import { TournamentsManagerModal } from './components/modals/TournamentsManagerModal';
import { computePoolStandings } from './utils/padelCalculations';
import {
  compactConsolanteLoserSlots,
  rescheduleMatchesFromNow,
  resolveMatchOutcomeReferences,
  resolveBracketByes,
} from './utils/padelSchedule';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [tournaments, setTournaments] = useState<Tournament[]>(boltClient.getTournaments());
  const [activeTournament, setActiveTournament] = useState<Tournament | undefined>(
    boltClient.getActiveTournament()
  );
  const [currentModule, setCurrentModule] = useState<NavigationModule>('overview');
  const [isPublicMode, setIsPublicMode] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Modals state
  const [scoreModalMatch, setScoreModalMatch] = useState<Match | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isTournamentsManagerOpen, setIsTournamentsManagerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setAuthError(null);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (isMounted) setSession(data.session);
    }).catch(error => {
      console.error('Erreur lors de la vérification de la session Supabase :', error);
      if (isMounted) setAuthError('Impossible de vérifier votre session. Rechargez la page pour réessayer.');
    }).finally(() => {
      if (isMounted) setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      boltClient.stop();
      setDatabaseLoading(false);
      setDatabaseError(null);
      return;
    }

    let isMounted = true;
    setDatabaseLoading(true);
    setDatabaseError(null);
    setStartupError(null);
    void boltClient.start(session.user.id).then(() => {
      if (isMounted) {
        setDatabaseLoading(false);
        setStartupError(null);
      }
    }).catch(error => {
      console.error('Erreur lors du chargement des tournois Supabase :', error);
      if (isMounted) {
        setStartupError(error instanceof Error ? error.message : 'Impossible de charger les tournois.');
        setDatabaseLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [session?.user.id, retryCount]);

  // Subscribe to reactive database changes and surface write/realtime errors.
  useEffect(() => {
    const unsubscribe = boltClient.subscribe(() => {
      setTournaments([...boltClient.getTournaments()]);
      setActiveTournament(boltClient.getActiveTournament());
      setDatabaseError(boltClient.getError());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erreur lors de la déconnexion Supabase :', error);
      setDatabaseError(error.message);
    }
  };

  const handleTogglePublicMode = () => {
    if (isPublicMode || currentModule === 'public') {
      setIsPublicMode(false);
      if (currentModule === 'public') setCurrentModule('overview');
      return;
    }

    setIsPublicMode(true);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-600">Vérification de la session…</div>;
  }
  if (!session) {
    return (
      <>
        {authError && <p role="alert" className="bg-rose-50 p-3 text-center text-sm text-rose-800">{authError}</p>}
        <AuthGate />
      </>
    );
  }
  if (databaseLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-600">Chargement des tournois…</div>;
  }
  if (startupError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Connexion à Supabase impossible</h1>
          <p role="alert" className="mt-3 text-sm text-rose-800">{startupError}</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setRetryCount(count => count + 1)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Réessayer
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Se déconnecter
            </button>
          </div>
        </section>
      </main>
    );
  }

  const handleSelectTournament = (id: string) => {
    boltClient.setActiveTournamentId(id);
    setActiveTournament(boltClient.getActiveTournament());
  };

  const handleUpdateTournament = (updated: Tournament) => {
    boltClient.saveTournament(updated);
  };

  const handleCreateTournament = (newT: Tournament) => {
    boltClient.saveTournament(newT);
    boltClient.setActiveTournamentId(newT.id);
    setCurrentModule('inscriptions');
  };

  const handleDuplicateTournament = (t: Tournament) => {
    const today = new Date().toISOString().split('T')[0];
    const clone: Tournament = {
      ...t,
      id: `tourn_${t.category.toLowerCase()}_${Date.now()}`,
      name: `${t.name} (Copie)`,
      dates: {
        start: today,
        end: today,
      },
      updatedAt: new Date().toISOString(),
    };
    boltClient.saveTournament(clone);
  };

  const handleDeleteTournament = (id: string) => {
    const target = tournaments.find(t => t.id === id);
    const name = target ? target.name : 'ce tournoi';
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le tournoi "${name}" ? Cette action est irréversible.`)) {
      boltClient.deleteTournament(id);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = boltClient.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `padel_tournaments_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (json: string) => {
    const success = boltClient.importJSON(json);
    if (success) {
      alert('Tournois importés avec succès !');
    } else {
      alert('Erreur lors de la lecture du fichier JSON.');
    }
  };

  const handleResetSeed = () => {
    if (confirm('Voulez-vous réinitialiser les tournois avec les données officielles du club ?')) {
      boltClient.resetToSeedData();
    }
  };

  // Open Score Modal
  const handleOpenScoreModal = (match: Match) => {
    if (!activeTournament) {
      setScoreModalMatch(match);
      return;
    }

    const resolvedMatches = resolveMatchOutcomeReferences(
      activeTournament.bracketMatches,
      activeTournament.consolanteMatches,
      activeTournament.pairs
    );
    const resolvedMatch = [
      ...resolvedMatches.bracketMatches,
      ...resolvedMatches.consolanteMatches,
    ].find(candidate => candidate.id === match.id);
    setScoreModalMatch(resolvedMatch ?? match);
  };

  // Save score, advance winners in main bracket AND automatically feed losers into consolante
  const handleSaveScore = (matchId: string, score: MatchScore, winnerPairId?: string) => {
    if (!activeTournament) return;

    let updated = { ...activeTournament };
    const existingOutcomes = resolveMatchOutcomeReferences(
      updated.bracketMatches,
      updated.consolanteMatches,
      updated.pairs
    );
    updated.bracketMatches = existingOutcomes.bracketMatches;
    updated.consolanteMatches = existingOutcomes.consolanteMatches;
    const completedAt = new Date();
    const pairsMap = new Map<string, Pair>(updated.pairs.map(p => [p.id, p]));

    // Check in pools
    let matchFoundInPool = false;
    updated.pools = updated.pools.map(pool => {
      const matchIndex = pool.matches.findIndex(m => m.id === matchId);
      if (matchIndex >= 0) {
        matchFoundInPool = true;
        const matchesCopy = [...pool.matches];
        matchesCopy[matchIndex] = {
          ...matchesCopy[matchIndex],
          score,
          winnerPairId,
          status: 'completed',
          completedAt: completedAt.toISOString(),
        };
        const updatedPool = { ...pool, matches: matchesCopy };
        updatedPool.standings = computePoolStandings(updatedPool, pairsMap);
        return updatedPool;
      }
      return pool;
    });

    // Check in bracket and consolante
    if (!matchFoundInPool) {
      const compactedMatches = compactConsolanteLoserSlots(
        updated.bracketMatches,
        updated.consolanteMatches
      );
      updated.bracketMatches = compactedMatches.bracketMatches;
      updated.consolanteMatches = compactedMatches.consolanteMatches;
      const allTournamentMatches = [...updated.bracketMatches, ...updated.consolanteMatches];
      const targetMatch = allTournamentMatches.find((m) => m.id === matchId);

      if (targetMatch) {
        const loserPairId = winnerPairId
          ? (winnerPairId === targetMatch.pair1Id ? targetMatch.pair2Id : targetMatch.pair1Id)
          : undefined;
        const hasExplicitWinnerRoute = allTournamentMatches.some(match =>
          (match.pair1SourceMatchId === targetMatch.id && match.pair1SourceOutcome === 'winner') ||
          (match.pair2SourceMatchId === targetMatch.id && match.pair2SourceOutcome === 'winner')
        );
        const hasExplicitLoserRoute = allTournamentMatches.some(match =>
          (match.pair1SourceMatchId === targetMatch.id && match.pair1SourceOutcome === 'loser') ||
          (match.pair2SourceMatchId === targetMatch.id && match.pair2SourceOutcome === 'loser')
        );

        const updateMatchList = (list: Match[]): Match[] => {
          return list.map((m) => {
            if (m.id === matchId) {
              return {
                ...m,
                score,
                winnerPairId,
                status: 'completed' as const,
                completedAt: completedAt.toISOString(),
              };
            }

            let updatedMatch = { ...m };
            const assignProgressedPair = (slot: 'pair1' | 'pair2', pairId: string) => {
              const otherSlot = slot === 'pair1' ? 'pair2' : 'pair1';
              if (updatedMatch[`${otherSlot}Id`] === pairId) {
                window.alert(
                  `La paire issue du match #${targetMatch.matchNumber} est déjà affectée à l’autre position du match #${updatedMatch.matchNumber}.`
                );
                return;
              }
              updatedMatch[`${slot}Id`] = pairId;
            };

            const explicitlyLinkedWinnerSlots = (['pair1', 'pair2'] as const).filter(slot =>
              m[`${slot}SourceMatchId`] === targetMatch.id &&
              m[`${slot}SourceOutcome`] === 'winner'
            );
            const explicitlyLinkedLoserSlots = (['pair1', 'pair2'] as const).filter(slot =>
              m[`${slot}SourceMatchId`] === targetMatch.id &&
              m[`${slot}SourceOutcome`] === 'loser'
            );

            if (winnerPairId && explicitlyLinkedWinnerSlots.length > 0) {
              explicitlyLinkedWinnerSlots.forEach(slot => assignProgressedPair(slot, winnerPairId));
            } else if (
              !hasExplicitWinnerRoute &&
              targetMatch.nextMatchId &&
              m.id === targetMatch.nextMatchId &&
              winnerPairId
            ) {
              if (targetMatch.nextMatchSlot === 'pair1') {
                assignProgressedPair('pair1', winnerPairId);
              } else if (targetMatch.nextMatchSlot === 'pair2') {
                assignProgressedPair('pair2', winnerPairId);
              }
            }

            if (loserPairId && explicitlyLinkedLoserSlots.length > 0) {
              explicitlyLinkedLoserSlots.forEach(slot => assignProgressedPair(slot, loserPairId));
            } else if (
              !hasExplicitLoserRoute &&
              targetMatch.loserNextMatchId &&
              m.id === targetMatch.loserNextMatchId &&
              loserPairId
            ) {
              if (targetMatch.loserNextMatchSlot === 'pair1') {
                assignProgressedPair('pair1', loserPairId);
              } else if (targetMatch.loserNextMatchSlot === 'pair2') {
                assignProgressedPair('pair2', loserPairId);
              }
            }

            return updatedMatch;
          });
        };

        updated.bracketMatches = updateMatchList(updated.bracketMatches);
        updated.consolanteMatches = updateMatchList(updated.consolanteMatches);
      }
    }

    const resolvedOutcomes = resolveMatchOutcomeReferences(
      updated.bracketMatches,
      updated.consolanteMatches,
      updated.pairs
    );
    const resolvedByes = resolveBracketByes(
      resolvedOutcomes.bracketMatches,
      resolvedOutcomes.consolanteMatches
    );
    const resolvedByeOutcomes = resolveMatchOutcomeReferences(
      resolvedByes.bracketMatches,
      resolvedByes.consolanteMatches,
      updated.pairs
    );
    updated.bracketMatches = resolvedByeOutcomes.bracketMatches;
    updated.consolanteMatches = resolvedByeOutcomes.consolanteMatches;

    if (updated.courts.length > 0) {
      const rescheduled = rescheduleMatchesFromNow(
        updated.pools,
        updated.bracketMatches,
        updated.consolanteMatches,
        updated.courts,
        updated.firstMatchTime ?? '09:00',
        updated.slotDurationMinutes ?? 75,
        {
          scheduleDate: updated.dates.start,
          currentTime: completedAt,
        }
      );
      updated = { ...updated, ...rescheduled };
    }

    boltClient.saveTournament(updated);
  };

  // Clear score for a specific match
  const handleClearScore = (matchId: string) => {
    if (!activeTournament) return;

    let updated = { ...activeTournament };
    const pairsMap = new Map<string, Pair>(updated.pairs.map(p => [p.id, p]));

    let matchFoundInPool = false;
    updated.pools = updated.pools.map(pool => {
      const matchIndex = pool.matches.findIndex(m => m.id === matchId);
      if (matchIndex >= 0) {
        matchFoundInPool = true;
        const matchesCopy = [...pool.matches];
        matchesCopy[matchIndex] = {
          ...matchesCopy[matchIndex],
          score: undefined,
          winnerPairId: undefined,
          status: 'scheduled',
        };
        const updatedPool = { ...pool, matches: matchesCopy };
        updatedPool.standings = computePoolStandings(updatedPool, pairsMap);
        return updatedPool;
      }
      return pool;
    });

    if (!matchFoundInPool) {
      const resetInList = (list: Match[]): Match[] =>
        list.map(m =>
          m.id === matchId
            ? { ...m, score: undefined, winnerPairId: undefined, status: 'scheduled' as const }
            : m
        );
      updated.bracketMatches = resetInList(updated.bracketMatches);
      updated.consolanteMatches = resetInList(updated.consolanteMatches);
    }

    boltClient.saveTournament(updated);
    setScoreModalMatch(null);
  };

  // Resolve pairs for Score Modal
  const pairsMap = new Map<string, Pair>(
    activeTournament ? activeTournament.pairs.map(p => [p.id, p]) : []
  );
  const scorePair1 = scoreModalMatch?.pair1Id ? pairsMap.get(scoreModalMatch.pair1Id) : undefined;
  const scorePair2 = scoreModalMatch?.pair2Id ? pairsMap.get(scoreModalMatch.pair2Id) : undefined;

  // Counts for mobile bottom nav
  const confirmedPairsCount = activeTournament?.pairs.filter(p => p.status === 'confirmed').length || 0;
  const poolsCount = activeTournament?.pools.length || 0;
  const bracketMatchesCount = (activeTournament?.bracketMatches.length || 0) + (activeTournament?.consolanteMatches.length || 0);
  const scheduledMatchesCount =
    (activeTournament?.pools.flatMap(p => p.matches).length || 0) +
    (activeTournament?.bracketMatches.length || 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Bar Header */}
      <Header
        tournaments={tournaments}
        activeTournament={activeTournament}
        onSelectTournament={handleSelectTournament}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onOpenTournamentsManager={() => setIsTournamentsManagerOpen(true)}
        onExport={handleExportJSON}
        onImport={handleImportJSON}
        onResetSeed={handleResetSeed}
        isPublicMode={isPublicMode}
        onTogglePublicMode={handleTogglePublicMode}
        userEmail={session.user.email || ''}
        onSignOut={handleSignOut}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />
      {databaseError && (
        <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-800">
          {databaseError}
        </p>
      )}

      {/* Main Body */}
      {isPublicMode || currentModule === 'public' ? (
        <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {activeTournament ? (
            <PublicLiveModule
              tournament={activeTournament}
              onExitPublic={handleTogglePublicMode}
            />
          ) : (
            <div className="py-20 text-center text-slate-400">
              Aucun tournoi actif sélectionné.
            </div>
          )}
        </main>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Director Console Sidebar (Desktop + Mobile Drawer) */}
          <Sidebar
            currentModule={currentModule}
            onSelectModule={setCurrentModule}
            tournament={activeTournament}
            onOpenTournamentsManager={() => setIsTournamentsManagerOpen(true)}
            isMobileDrawerOpen={isMobileDrawerOpen}
            onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
          />

          {/* Module Viewport */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 pb-24 md:pb-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
              {!activeTournament ? (
                <div className="p-8 sm:p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <p className="font-semibold text-slate-800">Aucun tournoi sélectionné.</p>
                  <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Créer votre premier tournoi
                  </button>
                </div>
              ) : currentModule === 'overview' ? (
                <OverviewModule
                  tournament={activeTournament}
                  onNavigate={setCurrentModule}
                  onOpenScoreModal={handleOpenScoreModal}
                />
              ) : currentModule === 'inscriptions' ? (
                <InscriptionsModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                />
              ) : currentModule === 'poules' ? (
                <PoulesModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                  onOpenScoreModal={handleOpenScoreModal}
                />
              ) : currentModule === 'tableau' ? (
                <TableauModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                  onOpenScoreModal={handleOpenScoreModal}
                />
              ) : currentModule === 'programme' ? (
                <ProgrammeModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                  onOpenScoreModal={handleOpenScoreModal}
                />
              ) : currentModule === 'convocations' ? (
                <ConvocationsModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                />
              ) : currentModule === 'caisse' ? (
                <CaisseModule
                  tournament={activeTournament}
                  onUpdateTournament={handleUpdateTournament}
                />
              ) : null}
            </div>
          </main>
        </div>
      )}

      {/* Ergonomic Mobile Bottom Navigation Bar (Phones only, hidden on md+) */}
      {!isPublicMode && currentModule !== 'public' && (
        <MobileBottomNav
          currentModule={currentModule}
          onSelectModule={setCurrentModule}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          pairsCount={confirmedPairsCount}
          poolsCount={poolsCount}
          bracketMatchesCount={bracketMatchesCount}
          scheduledMatchesCount={scheduledMatchesCount}
        />
      )}

      {/* Global Score Entry Modal */}
      {scoreModalMatch && (
        <ScoreModal
          match={scoreModalMatch}
          pair1={scorePair1}
          pair2={scorePair2}
          isOpen={true}
          onClose={() => setScoreModalMatch(null)}
          onSave={handleSaveScore}
          onClearScore={handleClearScore}
        />
      )}

      {/* New Tournament Modal */}
      <NewTournamentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateTournament}
      />

      {/* Tournaments Manager Modal */}
      <TournamentsManagerModal
        isOpen={isTournamentsManagerOpen}
        tournaments={tournaments}
        activeTournamentId={activeTournament?.id}
        onClose={() => setIsTournamentsManagerOpen(false)}
        onSelectTournament={(id) => {
          handleSelectTournament(id);
          setIsTournamentsManagerOpen(false);
        }}
        onOpenNewModal={() => {
          setIsTournamentsManagerOpen(false);
          setIsNewModalOpen(true);
        }}
        onDeleteTournament={handleDeleteTournament}
        onDuplicateTournament={handleDuplicateTournament}
      />
    </div>
  );
}

import { Tournament, Pair, Match, Court, Pool } from '../types/tournament';
import { computePoolStandings, rankAndSeedPairs } from '../utils/padelCalculations';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

const LEGACY_STORAGE_KEY = 'bolt_padel_tournaments_v2';
const LEGACY_ACTIVE_TOURNAMENT_KEY = 'bolt_padel_active_id_v2';

// Realistic sample players & pairs seed generator
function createSeedTournaments(): Tournament[] {
  const parisPairs: Pair[] = [
    {
      id: 'pair_1',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 78,
      seedRank: 1,
      isDirectTableau: true,
      status: 'confirmed',
      createdAt: '2026-10-10',
      player1: {
        id: 'p1',
        firstName: 'Maxime',
        lastName: 'Moreau',
        licenseNumber: '8492019A',
        ranking: 34,
        email: 'maxime.moreau@padel.fr',
        phone: '0612345678',
        club: 'Padel Horizon',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
      player2: {
        id: 'p2',
        firstName: 'Julien',
        lastName: 'Maigret',
        licenseNumber: '7392011B',
        ranking: 44,
        email: 'julien.maigret@padel.fr',
        phone: '0623456789',
        club: 'Padel Horizon',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_2',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 112,
      seedRank: 2,
      isDirectTableau: true,
      status: 'confirmed',
      createdAt: '2026-10-11',
      player1: {
        id: 'p3',
        firstName: 'Lucas',
        lastName: 'Dubourg',
        licenseNumber: '9283741C',
        ranking: 52,
        email: 'lucas.dubourg@club.fr',
        phone: '0634567890',
        club: '4Padel Montreuil',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'online',
        paidAmount: 25,
      },
      player2: {
        id: 'p4',
        firstName: 'Thomas',
        lastName: 'Mitjana',
        licenseNumber: '1092834D',
        ranking: 60,
        email: 'thomas.mitjana@club.fr',
        phone: '0645678901',
        club: 'Casa Padel',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'online',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_3',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 185,
      seedRank: 3,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-12',
      player1: {
        id: 'p5',
        firstName: 'Adrien',
        lastName: 'Maigret',
        licenseNumber: '6172839E',
        ranking: 85,
        email: 'adrien.m@padel.fr',
        phone: '0656789012',
        club: 'Padel Horizon',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAmount: 25,
      },
      player2: {
        id: 'p6',
        firstName: 'Benoit',
        lastName: 'Theard',
        licenseNumber: '5261728F',
        ranking: 100,
        email: 'benoit.theard@club.fr',
        phone: '0667890123',
        club: 'Toulouse Padel',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_4',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 228,
      seedRank: 4,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-12',
      player1: {
        id: 'p7',
        firstName: 'Florian',
        lastName: 'Valsot',
        licenseNumber: '4152637G',
        ranking: 110,
        email: 'florian.valsot@fft.fr',
        phone: '0678901234',
        club: 'TC Nice',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
      player2: {
        id: 'p8',
        firstName: 'Nicolas',
        lastName: 'Trancart',
        licenseNumber: '3241526H',
        ranking: 118,
        email: 'nicolas.trancart@fft.fr',
        phone: '0689012345',
        club: 'Padel Riviera',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_5',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 310,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-13',
      player1: {
        id: 'p9',
        firstName: 'Clément',
        lastName: 'Codron',
        licenseNumber: '2345678J',
        ranking: 150,
        email: 'clement.codron@gmail.com',
        phone: '0690123456',
        club: 'Padel Club Bois d\'Arcy',
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
      player2: {
        id: 'p10',
        firstName: 'Alexandre',
        lastName: 'Leroy',
        licenseNumber: '3456789K',
        ranking: 160,
        email: 'alex.leroy@gmail.com',
        phone: '0601234567',
        club: 'Padel Club Bois d\'Arcy',
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
    },
    {
      id: 'pair_6',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 375,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-14',
      player1: {
        id: 'p11',
        firstName: 'Sébastien',
        lastName: 'Corbelli',
        licenseNumber: '4567890L',
        ranking: 180,
        email: 'seb.corbelli@free.fr',
        phone: '0611223344',
        club: 'Tennis Club Boulogne',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'transfer',
        paidAmount: 25,
      },
      player2: {
        id: 'p12',
        firstName: 'Romain',
        lastName: 'Coirault',
        licenseNumber: '5678901M',
        ranking: 195,
        email: 'romain.c@free.fr',
        phone: '0622334455',
        club: 'Tennis Club Boulogne',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'transfer',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_7',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 440,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-14',
      player1: {
        id: 'p13',
        firstName: 'Yann',
        lastName: 'Auradou',
        licenseNumber: '6789012N',
        ranking: 210,
        email: 'yann.auradou@orange.fr',
        phone: '0633445566',
        club: 'Padel Horizon',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
      player2: {
        id: 'p14',
        firstName: 'Mathieu',
        lastName: 'Pequery',
        licenseNumber: '7890123P',
        ranking: 230,
        email: 'm.pequery@orange.fr',
        phone: '0644556677',
        club: 'Padel Horizon',
        isPresent: true,
        paymentStatus: 'paid',
        paymentMethod: 'card',
        paidAmount: 25,
      },
    },
    {
      id: 'pair_8',
      tournamentId: 'tourn_p500_horizon',
      totalWeight: 520,
      isDirectTableau: false,
      status: 'confirmed',
      createdAt: '2026-10-15',
      player1: {
        id: 'p15',
        firstName: 'Kevin',
        lastName: 'Roman',
        licenseNumber: '8901234Q',
        ranking: 255,
        email: 'k.roman@club.fr',
        phone: '0655667788',
        club: 'UrbanPadel Castelnau',
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
      player2: {
        id: 'p16',
        firstName: 'David',
        lastName: 'Guzman',
        licenseNumber: '9012345R',
        ranking: 265,
        email: 'd.guzman@club.fr',
        phone: '0666778899',
        club: 'UrbanPadel Castelnau',
        isPresent: false,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paidAmount: 0,
      },
    },
  ];

  const courts: Court[] = [
    { id: 'court_1', name: 'Terrain 1 - Central Panoramique', surface: 'panoramic' },
    { id: 'court_2', name: 'Terrain 2 - Indoor Bleu', surface: 'indoor' },
    { id: 'court_3', name: 'Terrain 3 - Indoor Rouge', surface: 'indoor' },
    { id: 'court_4', name: 'Terrain 4 - Outdoor Vitré', surface: 'outdoor' },
  ];

  // Pools
  const poolA: Pool = {
    id: 'pool_a',
    tournamentId: 'tourn_p500_horizon',
    name: 'Poule A (Qualif)',
    pairIds: ['pair_3', 'pair_5', 'pair_7'],
    qualifiedCount: 1,
    standings: [],
    matches: [
      {
        id: 'm_pool_a_1',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_a',
        roundName: 'Poule A - Match 1',
        matchNumber: 1,
        pair1Id: 'pair_3',
        pair2Id: 'pair_5',
        status: 'completed',
        courtId: 'court_1',
        scheduledTime: '09:00',
        winnerPairId: 'pair_3',
        score: {
          sets: [
            { pair1: 6, pair2: 3 },
            { pair1: 6, pair2: 4 },
          ],
        },
      },
      {
        id: 'm_pool_a_2',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_a',
        roundName: 'Poule A - Match 2',
        matchNumber: 2,
        pair1Id: 'pair_3',
        pair2Id: 'pair_7',
        status: 'in_progress',
        courtId: 'court_1',
        scheduledTime: '10:30',
        score: {
          sets: [
            { pair1: 7, pair2: 6, tieBreak: '7-4' },
            { pair1: 4, pair2: 5 },
          ],
        },
      },
      {
        id: 'm_pool_a_3',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_a',
        roundName: 'Poule A - Match 3',
        matchNumber: 3,
        pair1Id: 'pair_5',
        pair2Id: 'pair_7',
        status: 'scheduled',
        courtId: 'court_2',
        scheduledTime: '12:00',
      },
    ],
  };

  const poolB: Pool = {
    id: 'pool_b',
    tournamentId: 'tourn_p500_horizon',
    name: 'Poule B (Qualif)',
    pairIds: ['pair_4', 'pair_6', 'pair_8'],
    qualifiedCount: 1,
    standings: [],
    matches: [
      {
        id: 'm_pool_b_1',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_b',
        roundName: 'Poule B - Match 1',
        matchNumber: 4,
        pair1Id: 'pair_4',
        pair2Id: 'pair_6',
        status: 'completed',
        courtId: 'court_2',
        scheduledTime: '09:00',
        winnerPairId: 'pair_4',
        score: {
          sets: [
            { pair1: 6, pair2: 2 },
            { pair1: 7, pair2: 5 },
          ],
        },
      },
      {
        id: 'm_pool_b_2',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_b',
        roundName: 'Poule B - Match 2',
        matchNumber: 5,
        pair1Id: 'pair_4',
        pair2Id: 'pair_8',
        status: 'scheduled',
        courtId: 'court_3',
        scheduledTime: '10:30',
      },
      {
        id: 'm_pool_b_3',
        tournamentId: 'tourn_p500_horizon',
        type: 'pool',
        poolId: 'pool_b',
        roundName: 'Poule B - Match 3',
        matchNumber: 6,
        pair1Id: 'pair_6',
        pair2Id: 'pair_8',
        status: 'scheduled',
        courtId: 'court_3',
        scheduledTime: '12:00',
      },
    ],
  };

  const pairsMap = new Map(parisPairs.map(p => [p.id, p]));
  poolA.standings = computePoolStandings(poolA, pairsMap);
  poolB.standings = computePoolStandings(poolB, pairsMap);

  // Main bracket (Knockout: 4 pairs final draw - Semis + Final)
  const bracketMatches: Match[] = [
    {
      id: 'm_semi_1',
      tournamentId: 'tourn_p500_horizon',
      type: 'bracket',
      roundName: 'Demi-finale 1',
      matchNumber: 7,
      bracketRound: 1,
      bracketSlotIndex: 0,
      pair1Id: 'pair_1', // TS 1
      pair2Id: 'pair_3', // Qualifier Poule A
      pair1Placeholder: 'Tête de série #1',
      pair2Placeholder: 'Vainqueur Poule A',
      status: 'scheduled',
      courtId: 'court_1',
      scheduledTime: '14:30',
      nextMatchId: 'm_final_main',
      nextMatchSlot: 'pair1',
      loserNextMatchId: 'm_final_petite',
      loserNextMatchSlot: 'pair1',
    },
    {
      id: 'm_semi_2',
      tournamentId: 'tourn_p500_horizon',
      type: 'bracket',
      roundName: 'Demi-finale 2',
      matchNumber: 8,
      bracketRound: 1,
      bracketSlotIndex: 1,
      pair1Id: 'pair_4', // Qualifier Poule B
      pair2Id: 'pair_2', // TS 2
      pair1Placeholder: 'Vainqueur Poule B',
      pair2Placeholder: 'Tête de série #2',
      status: 'scheduled',
      courtId: 'court_2',
      scheduledTime: '14:30',
      nextMatchId: 'm_final_main',
      nextMatchSlot: 'pair2',
      loserNextMatchId: 'm_final_petite',
      loserNextMatchSlot: 'pair2',
    },
    {
      id: 'm_final_main',
      tournamentId: 'tourn_p500_horizon',
      type: 'bracket',
      roundName: 'Grande Finale',
      matchNumber: 9,
      bracketRound: 2,
      bracketSlotIndex: 0,
      pair1Placeholder: 'Vainqueur Demi-finale 1',
      pair2Placeholder: 'Vainqueur Demi-finale 2',
      status: 'scheduled',
      courtId: 'court_1',
      scheduledTime: '17:00',
      targetRankWinner: 1,
      targetRankLoser: 2,
    },
    {
      id: 'm_final_petite',
      tournamentId: 'tourn_p500_horizon',
      type: 'bracket',
      roundName: 'Petite Finale (Match 3e place)',
      matchNumber: 10,
      bracketRound: 2,
      bracketSlotIndex: 1,
      pair1Placeholder: 'Perdant Demi-finale 1',
      pair2Placeholder: 'Perdant Demi-finale 2',
      status: 'scheduled',
      courtId: 'court_2',
      scheduledTime: '16:00',
      targetRankWinner: 3,
      targetRankLoser: 4,
    },
  ];

  // Consolante
  const consolanteMatches: Match[] = [
    {
      id: 'm_cons_1',
      tournamentId: 'tourn_p500_horizon',
      type: 'consolante',
      roundName: 'Consolante - Match 5e/6e place',
      matchNumber: 11,
      bracketRound: 1,
      bracketSlotIndex: 0,
      pair1Id: 'pair_5',
      pair2Id: 'pair_6',
      pair1Placeholder: '2e Poule A',
      pair2Placeholder: '2e Poule B',
      status: 'scheduled',
      courtId: 'court_3',
      scheduledTime: '14:00',
      targetRankWinner: 5,
      targetRankLoser: 6,
    },
  ];

  const horizonTournament: Tournament = {
    id: 'tourn_p500_horizon',
    name: 'Open P500 Hommes Padel Horizon',
    club: 'Padel Horizon Sucy-en-Brie',
    city: 'Sucy-en-Brie (94)',
    dates: {
      start: '2026-10-26',
      end: '2026-10-27',
    },
    category: 'P500',
    gender: 'H',
    entryFee: 25,
    maxPairs: 16,
    status: 'in_progress',
    matchFormat: 'Format 2 (2 sets standard + super tie-break 10 pts au 3e)',
    courtsCount: 4,
    courts,
    pairs: rankAndSeedPairs(parisPairs, 4),
    pools: [poolA, poolB],
    bracketMatches,
    consolanteMatches,
    convocations: [
      {
        id: 'conv_1',
        tournamentId: 'tourn_p500_horizon',
        pairId: 'pair_1',
        matchId: 'm_semi_1',
        time: '14:30',
        courtName: 'Terrain 1 - Central Panoramique',
        status: 'sent',
        lastSentAt: '2026-10-25 10:15',
        channel: 'whatsapp',
      },
      {
        id: 'conv_2',
        tournamentId: 'tourn_p500_horizon',
        pairId: 'pair_3',
        matchId: 'm_pool_a_1',
        time: '09:00',
        courtName: 'Terrain 1 - Central Panoramique',
        status: 'sent',
        lastSentAt: '2026-10-25 09:30',
        channel: 'whatsapp',
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  // Second tournament: P250 Tennis Padel Club Palavas
  const palavasTournament: Tournament = {
    id: 'tourn_p250_palavas',
    name: 'P250 Palavas Méditerranée Open',
    club: 'Tennis Padel Club Palavas',
    city: 'Palavas-les-Flots (34)',
    dates: {
      start: '2026-11-07',
      end: '2026-11-08',
    },
    category: 'P250',
    gender: 'H',
    entryFee: 20,
    maxPairs: 12,
    status: 'draft',
    matchFormat: 'Format 1 (2 sets standard 6 jeux)',
    courtsCount: 3,
    courts: [
      { id: 'pal_c1', name: 'Court 1 - Mer', surface: 'outdoor' },
      { id: 'pal_c2', name: 'Court 2 - Soleil', surface: 'outdoor' },
      { id: 'pal_c3', name: 'Court 3 - Indoor Club', surface: 'indoor' },
    ],
    pairs: [],
    pools: [],
    bracketMatches: [],
    consolanteMatches: [],
    convocations: [],
    updatedAt: new Date().toISOString(),
  };

  return [horizonTournament, palavasTournament];
}

class BoltDatabaseClient {
  private tournaments: Tournament[] = [];
  private activeId: string = '';
  private listeners: Set<() => void> = new Set();
  private userId: string | null = null;
  private channel: RealtimeChannel | null = null;
  private lastError: string | null = null;

  constructor() {
    this.tournaments = createSeedTournaments();
    this.activeId = this.tournaments[0]?.id || '';
  }

  public async start(userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase n’est pas configuré.');
    }
    if (this.userId === userId && this.channel) return;

    this.stop();
    this.userId = userId;
    const { data: tournamentRows, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, data')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true });
    if (tournamentsError) throw tournamentsError;

    const { data: appState, error: appStateError } = await supabase
      .from('app_state')
      .select('active_tournament_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (appStateError) throw appStateError;

    let legacyActiveId: string | null = null;
    if (tournamentRows.length) {
      this.tournaments = tournamentRows.map(row => row.data as Tournament);
    } else {
      const legacyTournaments = this.readLegacyTournaments();
      this.tournaments = legacyTournaments ?? createSeedTournaments();
      legacyActiveId = this.readLegacyActiveId();
      await this.upsertTournaments(this.tournaments);
    }
    this.activeId =
      (appState?.active_tournament_id &&
      this.tournaments.some(tournament => tournament.id === appState.active_tournament_id)
        ? appState.active_tournament_id
        : legacyActiveId && this.tournaments.some(tournament => tournament.id === legacyActiveId)
        ? legacyActiveId
        : this.tournaments[0]?.id) || '';

    if (!appState) {
      await this.persistActiveTournament();
    }
    if (!tournamentRows.length && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_ACTIVE_TOURNAMENT_KEY);
      } catch (error) {
        console.warn('Impossible de supprimer les anciennes données locales migrées :', error);
      }
    }
    this.subscribeToRealtime(userId);
    this.clearError();
    this.notify();
  }

  public stop() {
    if (this.channel && supabase) {
      void supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.userId = null;
    this.tournaments = [];
    this.activeId = '';
    this.notify();
  }

  private readLegacyTournaments(): Tournament[] | null {
    if (typeof window === 'undefined') return null;
    let stored: string | null;
    try {
      stored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      console.warn('Impossible de lire les anciennes données locales :', error);
      return null;
    }
    if (!stored) return null;

    try {
      const parsed: unknown = JSON.parse(stored);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (tournament): tournament is Tournament =>
            typeof tournament === 'object' &&
            tournament !== null &&
            'id' in tournament &&
            typeof tournament.id === 'string'
        )
      ) {
        return parsed;
      }
      console.error('Les anciennes données locales de tournoi ont un format invalide.');
    } catch (error) {
      console.error('Impossible de lire les anciennes données locales de tournoi :', error);
    }
    return null;
  }

  private readLegacyActiveId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(LEGACY_ACTIVE_TOURNAMENT_KEY);
    } catch (error) {
      console.warn('Impossible de lire l’ancien tournoi actif local :', error);
      return null;
    }
  }

  private subscribeToRealtime(userId: string) {
    if (!supabase) return;
    this.channel = supabase
      .channel(`tournament-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `owner_id=eq.${userId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            this.tournaments = this.tournaments.filter(tournament => tournament.id !== deletedId);
            if (this.activeId === deletedId) {
              this.activeId = this.tournaments[0]?.id || '';
              void this.persistActiveTournament().catch(error =>
                this.reportError('Erreur lors de l’enregistrement du tournoi actif', error)
              );
            }
          } else {
            const row = payload.new as { id: string; data: Tournament };
            const index = this.tournaments.findIndex(tournament => tournament.id === row.id);
            if (index === -1) this.tournaments = [...this.tournaments, row.data];
            else this.tournaments[index] = row.data;
          }
          this.notify();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.eventType !== 'DELETE') {
            const row = payload.new as { active_tournament_id: string | null };
            if (
              row.active_tournament_id &&
              this.tournaments.some(tournament => tournament.id === row.active_tournament_id)
            ) {
              this.activeId = row.active_tournament_id;
            }
            this.notify();
          }
        }
      )
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.reportError('Erreur du canal Supabase Realtime', error ?? status);
        }
      });
  }

  private async upsertTournaments(tournaments: Tournament[]) {
    if (!tournaments.length) return;
    if (!supabase || !this.userId) throw new Error('Aucun utilisateur Supabase connecté.');
    const userId = this.userId;
    const { error } = await supabase.from('tournaments').upsert(
      tournaments.map(tournament => ({
        owner_id: userId,
        id: tournament.id,
        data: tournament,
        public_share_token: tournament.publicShareToken ?? null,
        updated_at: tournament.updatedAt,
      })),
      { onConflict: 'owner_id,id' }
    );
    if (error) throw error;
  }

  private async persistTournament(tournament: Tournament) {
    try {
      await this.upsertTournaments([tournament]);
      this.clearError();
    } catch (error) {
      this.reportError('Erreur lors de l’enregistrement du tournoi', error);
    }
  }

  private async persistActiveTournament() {
    if (!supabase || !this.userId) throw new Error('Aucun utilisateur Supabase connecté.');
    const { error } = await supabase.from('app_state').upsert(
      {
        user_id: this.userId,
        active_tournament_id: this.activeId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }

  private async replaceRemoteTournaments(previousIds: string[]) {
    if (!supabase || !this.userId) {
      this.reportError('Erreur lors de la synchronisation des tournois', 'Aucun utilisateur Supabase connecté.');
      return;
    }
    const userId = this.userId;
    try {
      const currentIds = new Set(this.tournaments.map(tournament => tournament.id));
      const removedIds = previousIds.filter(id => !currentIds.has(id));
      for (const id of removedIds) {
        const { error } = await supabase
          .from('tournaments')
          .delete()
          .eq('owner_id', userId)
          .eq('id', id);
        if (error) throw error;
      }
      await this.upsertTournaments(this.tournaments);
      await this.persistActiveTournament();
      this.clearError();
    } catch (error) {
      this.reportError('Erreur lors de la synchronisation des tournois', error);
    }
  }

  private reportError(context: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    this.lastError = `${context} : ${detail}`;
    console.error(this.lastError, error);
    this.notify();
  }

  private clearError() {
    if (!this.lastError) return;
    this.lastError = null;
    this.notify();
  }

  public getError(): string | null {
    return this.lastError;
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getTournaments(): Tournament[] {
    return this.tournaments;
  }

  public getActiveTournament(): Tournament | undefined {
    return this.tournaments.find((t) => t.id === this.activeId) || this.tournaments[0];
  }

  public setActiveTournamentId(id: string) {
    if (this.activeId !== id) {
      this.activeId = id;
      void this.persistActiveTournament().catch(error =>
        this.reportError('Erreur lors de l’enregistrement du tournoi actif', error)
      );
      this.notify();
    }
  }

  public saveTournament(tournament: Tournament) {
    const updated = {
      ...tournament,
      updatedAt: new Date().toISOString(),
    };
    const index = this.tournaments.findIndex((t) => t.id === updated.id);
    if (index >= 0) {
      this.tournaments[index] = updated;
    } else {
      this.tournaments.push(updated);
    }
    void this.persistTournament(updated);
    this.notify();
  }

  public deleteTournament(id: string) {
    this.tournaments = this.tournaments.filter((t) => t.id !== id);
    if (this.activeId === id) {
      this.activeId = this.tournaments[0]?.id || '';
      void this.persistActiveTournament().catch(error =>
        this.reportError('Erreur lors de l’enregistrement du tournoi actif', error)
      );
    }
    if (supabase && this.userId) {
      void supabase
        .from('tournaments')
        .delete()
        .eq('owner_id', this.userId)
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportError('Erreur lors de la suppression du tournoi', error);
          else this.clearError();
        });
    }
    this.notify();
  }

  public resetToSeedData() {
    const previousIds = this.tournaments.map(tournament => tournament.id);
    this.tournaments = createSeedTournaments();
    this.activeId = this.tournaments[0].id;
    void this.replaceRemoteTournaments(previousIds);
    this.notify();
  }

  public exportJSON(): string {
    return JSON.stringify(
      {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        tournaments: this.tournaments,
      },
      null,
      2
    );
  }

  public importJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.tournaments) && parsed.tournaments.length > 0) {
        const previousIds = this.tournaments.map(tournament => tournament.id);
        this.tournaments = parsed.tournaments;
        this.activeId = this.tournaments[0].id;
        void this.replaceRemoteTournaments(previousIds);
        this.notify();
        return true;
      }
    } catch (err) {
      console.error('Failed to parse import JSON:', err);
    }
    return false;
  }
}

// Singleton export
export const boltClient = new BoltDatabaseClient();

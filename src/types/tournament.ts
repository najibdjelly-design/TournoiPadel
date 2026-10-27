export type TournamentCategory = 'P25' | 'P100' | 'P250' | 'P500' | 'P1000' | 'P2000';
export type TournamentGender = 'H' | 'D' | 'Mixte';
export type TournamentStatus = 'draft' | 'in_progress' | 'completed';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  ranking: number; // French or FIP ranking number (e.g., 42, 350, 1500)
  email: string;
  phone: string;
  club: string;
  birthDate?: string;
  isPresent: boolean;
  paymentStatus: 'paid' | 'pending' | 'waived';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'online';
  paidAmount: number;
  notes?: string;
}

export interface Pair {
  id: string;
  tournamentId: string;
  player1: Player;
  player2: Player;
  totalWeight: number; // player1.ranking + player2.ranking (lower weight = higher seed)
  seedRank?: number; // TS 1, 2, 3, 4...
  entryPosition?: number;
  poolId?: string;
  isDirectTableau: boolean;
  status: 'confirmed' | 'waiting_list' | 'withdrawn';
  createdAt: string;
}

export interface SetScore {
  pair1: number;
  pair2: number;
  tieBreak?: string; // e.g. "7-4"
  isSuperTieBreak?: boolean;
}

export interface MatchScore {
  sets: SetScore[];
  winnerPairId?: string;
  isWalkover?: boolean;
  isRetired?: boolean;
  retiredPairId?: string;
}

export type MatchStatus = 'scheduled' | 'warmup' | 'in_progress' | 'completed' | 'walkover';
export type MatchType = 'pool' | 'bracket' | 'consolante';

export interface Match {
  id: string;
  tournamentId: string;
  type: MatchType;
  roundName: string; // e.g. "Poule A - J1", "1/8 Final", "Quart de finale", "Demi-finale", "Finale"
  matchNumber: number;
  poolId?: string;
  pair1Id?: string;
  pair2Id?: string;
  pair1Placeholder?: string; // e.g. "1er Poule A" or "Vainqueur M1"
  pair2Placeholder?: string; // e.g. "2e Poule B" or "Vainqueur M2"
  score?: MatchScore;
  winnerPairId?: string;
  status: MatchStatus;
  courtId?: string;
  scheduledTime?: string; // e.g. "09:30"
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  bracketRound?: number; // 1 for R16, 2 for QF, 3 for SF, 4 for Final
  bracketSlotIndex?: number;
  nextMatchId?: string;
  nextMatchSlot?: 'pair1' | 'pair2';
  loserNextMatchId?: string;
  loserNextMatchSlot?: 'pair1' | 'pair2';
  classificationRankRange?: string; // e.g. "1-4", "5-8", "9-16", "17-24", "3-4"
  targetRankWinner?: number;
  targetRankLoser?: number;
}

export interface FinalStandingItem {
  rank: number;
  pairId?: string;
  status: 'confirmed' | 'in_progress' | 'pending';
  detail: string;
}

export interface PoolStanding {
  pairId: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number; // 2 pts per win, 1 pt per loss, 0 for walkover
  rank: number;
}

export interface Pool {
  id: string;
  tournamentId: string;
  name: string; // "Poule A", "Poule B", etc.
  phase?: number;
  classification?: string;
  pairIds: string[];
  matches: Match[];
  standings: PoolStanding[];
  qualifiedCount: number; // usually top 1 or 2 qualify for main tableau
}

export interface Court {
  id: string;
  name: string; // "Terrain 1 - Central", "Terrain 2", etc.
  surface: 'panoramic' | 'indoor' | 'outdoor';
  currentMatchId?: string;
}

export interface CourtScheduleSlot {
  id: string;
  courtId: string;
  time: string; // "09:00", "10:15", "11:30", "12:45", etc.
  matchId?: string;
}

export interface Convocation {
  id: string;
  pairId: string;
  playerId?: string;
  tournamentId: string;
  matchId: string;
  time: string;
  courtName: string;
  status: 'ready' | 'sent';
  lastSentAt?: string;
  channel?: 'whatsapp' | 'sms' | 'email';
}

export interface ConvocationMessageTemplate {
  id: string;
  name: string;
  text: string;
}

export interface Tournament {
  id: string;
  name: string;
  club: string;
  city: string;
  dates: {
    start: string;
    end: string;
  };
  category: TournamentCategory;
  gender: TournamentGender;
  entryFee: number; // EUR per player (e.g. 25€)
  maxPairs: number;
  bracketSize?: 4 | 8 | 16 | 24 | 32;
  bracketEntrantCount?: number;
  status: TournamentStatus;
  matchFormat: string; // e.g. "Format 1 (2 sets gagnants standard)" or "Format 2 (2 sets + super tie-break 10 pts)"
  courtsCount: number;
  slotDurationMinutes?: number; // e.g. 60, 75, 90 min per match slot
  firstMatchTime?: string; // e.g. "09:00"
  courts: Court[];
  pairs: Pair[];
  pools: Pool[];
  bracketMatches: Match[];
  consolanteMatches: Match[];
  convocations: Convocation[];
  convocationMessageTemplates?: ConvocationMessageTemplate[];
  updatedAt: string;
}

import { MatchStatus, PadelMatchFormat, TournamentCategory, TournamentGender } from './tournament';

export interface PublicParticipantPlayer {
  firstName: string;
  lastName: string;
  club: string;
  ranking?: number;
}

export interface PublicParticipantPair {
  id: string;
  player1: PublicParticipantPlayer;
  player2: PublicParticipantPlayer;
  totalWeight: number;
  seedRank?: number;
  placement: string;
}

export interface PublicCourt {
  id: string;
  name: string;
  surface: string;
}

export interface PublicFinalStanding {
  rank: number;
  pairId?: string;
  pairName: string;
  club: string;
  status: 'confirmed' | 'in_progress' | 'pending';
  detail: string;
}

export interface PublicParticipantMatch {
  pair1Id?: string;
  pair2Id?: string;
  courtId?: string;
  winnerPairId?: string;
  matchNumber: number;
  roundName: string;
  status: MatchStatus;
  matchFormat?: PadelMatchFormat;
  scheduledTime?: string;
  courtName?: string;
  pair1: string;
  pair2: string;
  score?: string;
}

export interface PublicPoolStanding {
  rank: number;
  pairName: string;
  points: number;
  won: number;
  lost: number;
  setDiff: number;
  gameDiff: number;
  qualified: boolean;
}

export interface PublicPool {
  name: string;
  standings: PublicPoolStanding[];
}

export interface ParticipantViewData {
  tournament: {
    name: string;
    club: string;
    city: string;
    category: TournamentCategory;
    gender: TournamentGender;
    startDate: string;
    endDate: string;
  };
  participants: PublicParticipantPair[];
  matches: PublicParticipantMatch[];
  pools: PublicPool[];
  courts: PublicCourt[];
  finalStandings: PublicFinalStanding[];
  updatedAt: string;
}

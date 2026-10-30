import { MatchStatus, PadelMatchFormat, TournamentCategory, TournamentGender } from './tournament';

export interface PublicParticipantPair {
  player1: { firstName: string; lastName: string; club: string };
  player2: { firstName: string; lastName: string; club: string };
  totalWeight: number;
  seedRank?: number;
  placement: string;
}

export interface PublicParticipantMatch {
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
  updatedAt: string;
}

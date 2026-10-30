import type { Tournament } from './tournament';

// Tournoi nettoyé des données privées (contacts, licences, paiements, convocations).
export interface ParticipantViewData {
  tournament: Tournament;
  updatedAt: string;
}

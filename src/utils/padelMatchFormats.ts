import { PadelMatchFormat } from '../types/tournament';

export const PADEL_MATCH_FORMATS: Array<{
  code: PadelMatchFormat;
  description: string;
}> = [
  { code: 'A1', description: '3 sets à 6 jeux, jeu décisif à 6-6' },
  { code: 'A2', description: 'Comme A1, avec point décisif' },
  { code: 'B1', description: '2 sets à 6 jeux, jeu décisif à 6-6 ; 3e set en super jeu décisif à 10 points' },
  { code: 'B2', description: 'Comme B1, avec point décisif' },
  { code: 'C1', description: '2 sets à 4 jeux, jeu décisif à 4-4 ; 3e set en super jeu décisif à 10 points' },
  { code: 'C2', description: 'Comme C1, avec point décisif' },
  { code: 'D1', description: '1 set à 9 jeux, jeu décisif à 8-8' },
  { code: 'D2', description: 'Comme D1, avec point décisif' },
  { code: 'E1', description: '1 set à 10 points' },
];

export function getPadelMatchFormatDescription(format?: PadelMatchFormat): string | undefined {
  return PADEL_MATCH_FORMATS.find(item => item.code === format)?.description;
}

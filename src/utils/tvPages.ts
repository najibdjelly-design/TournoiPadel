export const TV_PAGE_OPTIONS = [
  { id: 'courts', label: 'Sur les terrains' },
  { id: 'schedule', label: 'Programmation des matchs' },
  { id: 'pools', label: 'Poules & classements' },
  { id: 'bracket-main', label: 'Tableau principal' },
  { id: 'bracket-consolante', label: 'Matchs de classement' },
  { id: 'bracket-standings', label: 'Classement général' },
] as const;

export type TvPageId = (typeof TV_PAGE_OPTIONS)[number]['id'];

export const DEFAULT_TV_PAGES: TvPageId[] = TV_PAGE_OPTIONS.map(option => option.id);

export function buildParticipantShareUrl(token: string): string {
  const publicBaseUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const url = new URL(publicBaseUrl || window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('participants', token);
  return url.toString();
}

export function buildTvShareUrl(token: string): string {
  const url = new URL(buildParticipantShareUrl(token));
  url.searchParams.set('tv', '1');
  return url.toString();
}

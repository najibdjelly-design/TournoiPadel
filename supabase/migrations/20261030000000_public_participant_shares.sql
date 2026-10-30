alter table public.tournaments
  add column if not exists public_share_token text;

create unique index if not exists tournaments_public_share_token_key
  on public.tournaments (public_share_token)
  where public_share_token is not null;

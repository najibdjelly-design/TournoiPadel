create table public.tournaments (
  owner_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

alter table public.tournaments enable row level security;

create policy "Users can read their own tournaments"
  on public.tournaments for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own tournaments"
  on public.tournaments for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own tournaments"
  on public.tournaments for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own tournaments"
  on public.tournaments for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create table public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_tournament_id text,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Users can read their own app state"
  on public.app_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own app state"
  on public.app_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own app state"
  on public.app_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.app_state;

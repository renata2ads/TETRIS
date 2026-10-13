-- Kosmiczne Klocki — schemat bazy danych Supabase
-- Uruchom w panelu Supabase: SQL Editor → New query → wklej całość → Run.
-- Skrypt można uruchomić ponownie: nie usuwa danych.

-- =====================================================================
-- 1. Wyniki zakończonych gier (ranking)
-- =====================================================================
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  nick       text        not null check (char_length(nick) between 1 and 20),
  score      integer     not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (score desc);

alter table public.scores enable row level security;

-- Każdy może czytać ranking.
drop policy if exists "scores_select" on public.scores;
create policy "scores_select" on public.scores
  for select to anon, authenticated
  using (true);

-- Każdy może dodać wynik; zmieniać ani usuwać wyników nie można.
drop policy if exists "scores_insert" on public.scores;
create policy "scores_insert" on public.scores
  for insert to anon, authenticated
  with check (true);

-- =====================================================================
-- 2. Zapisana (przerwana) gra — jedna na gracza
-- =====================================================================
create table if not exists public.saved_games (
  player_id  uuid        primary key,
  nick       text        not null check (char_length(nick) between 1 and 20),
  state      jsonb       not null,  -- { board, piece, score }
  updated_at timestamptz not null default now()
);

-- RLS włączone i brak polityk = brak bezpośredniego dostępu z przeglądarki.
-- Dostęp wyłącznie przez funkcje poniżej, które wymagają identyfikatora gracza.
alter table public.saved_games enable row level security;

-- Zapisz lub nadpisz grę gracza. Odrzuca zapisy większe niż 4 KB
-- (prawdziwy stan gry ma ok. 1 KB), żeby nikt nie zapchał bazy.
drop function if exists public.save_game(uuid, text, jsonb);
create function public.save_game(p_player_id uuid, p_nick text, p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_column_size(p_state) > 4096 or coalesce(jsonb_typeof(p_state -> 'board'), '') <> 'array' then
    raise exception 'Nieprawidłowy zapis gry';
  end if;
  insert into saved_games (player_id, nick, state, updated_at)
  values (p_player_id, p_nick, p_state, now())
  on conflict (player_id) do update
    set nick = excluded.nick, state = excluded.state, updated_at = now();
end;
$$;

-- Wczytaj grę gracza (null, gdy brak zapisu).
create or replace function public.load_game(p_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select state from saved_games where player_id = p_player_id;
$$;

-- Usuń zapis gracza (po game over albo „Nowa gra”).
create or replace function public.delete_game(p_player_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from saved_games where player_id = p_player_id;
$$;

revoke all on function public.save_game(uuid, text, jsonb) from public;
revoke all on function public.load_game(uuid)              from public;
revoke all on function public.delete_game(uuid)            from public;
grant execute on function public.save_game(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.load_game(uuid)              to anon, authenticated;
grant execute on function public.delete_game(uuid)            to anon, authenticated;

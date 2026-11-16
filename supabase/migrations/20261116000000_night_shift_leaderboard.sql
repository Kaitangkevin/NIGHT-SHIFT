begin;

create table if not exists public.night_shift_scores (
  id uuid primary key,
  challenge_date date not null,
  player_name text not null check (char_length(btrim(player_name)) between 1 and 20),
  duration_ms integer not null check (duration_ms between 0 and 172800000),
  created_at timestamptz not null default now()
);

create index if not exists night_shift_scores_ranking_idx
  on public.night_shift_scores (challenge_date, duration_ms, created_at, id);

alter table public.night_shift_scores enable row level security;
revoke all on table public.night_shift_scores from public, anon, authenticated;
grant select, insert on table public.night_shift_scores to service_role;

create or replace function public.night_shift_ranking(
  p_date date,
  p_attempt_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select id, player_name, duration_ms,
      row_number() over (order by duration_ms, created_at, id) as position
    from public.night_shift_scores
    where challenge_date = p_date
  )
  select jsonb_build_object(
    'entries', coalesce(
      jsonb_agg(jsonb_build_object('name', player_name, 'duration', duration_ms) order by position),
      '[]'::jsonb
    ),
    'rank', max(position) filter (where id = p_attempt_id)
  )
  from ranked;
$$;

revoke all on function public.night_shift_ranking(date, uuid) from public, anon, authenticated;
grant execute on function public.night_shift_ranking(date, uuid) to service_role;

commit;

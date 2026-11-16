begin;

create table if not exists public.night_shift_published_maps (
  challenge_date date primary key,
  solution jsonb not null check (jsonb_typeof(solution) = 'array')
);

create table if not exists public.night_shift_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null references public.night_shift_published_maps(challenge_date),
  started_at timestamptz not null default clock_timestamp(),
  duration_ms integer check (duration_ms between 0 and 172800000)
);

alter table public.night_shift_published_maps enable row level security;
alter table public.night_shift_attempts enable row level security;
revoke all on public.night_shift_published_maps, public.night_shift_attempts from public, anon, authenticated;
grant select, insert, update on public.night_shift_published_maps to service_role;

create or replace function public.night_shift_play(
  p_action text,
  p_date date default null,
  p_id uuid default null,
  p_solution jsonb default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (clock_timestamp() at time zone 'Asia/Shanghai')::date;
  run public.night_shift_attempts%rowtype;
  expected jsonb;
  nickname text;
  elapsed integer;
begin
  if p_action = 'ranking' then
    if p_date is null then raise exception '日期无效。'; end if;
    return public.night_shift_ranking(p_date);
  end if;

  if p_action = 'start' then
    if p_date is distinct from today then
      raise exception '日期已更新，请重新开始今日挑战。';
    end if;
    if not exists (select 1 from public.night_shift_published_maps where challenge_date = p_date) then
      raise exception '今日挑战尚未开放。';
    end if;
    delete from public.night_shift_attempts where started_at < clock_timestamp() - interval '2 days';
    insert into public.night_shift_attempts(challenge_date) values (p_date) returning * into run;
    return jsonb_build_object('id', run.id);
  end if;

  if p_action is null or p_action not in ('finish', 'score') then raise exception '无效操作。'; end if;
  select * into run from public.night_shift_attempts where id = p_id for update;
  if not found or clock_timestamp() - run.started_at > interval '2 days' then
    raise exception '本局记录已过期，请重新开始挑战。';
  end if;

  if p_action = 'finish' then
    select solution into expected from public.night_shift_published_maps where challenge_date = run.challenge_date;
    if p_solution is distinct from expected then raise exception '棋盘尚未满足通关条件。'; end if;
    elapsed := coalesce(run.duration_ms,
      least(172800000, greatest(0, floor(extract(epoch from clock_timestamp() - run.started_at) * 1000)))::integer);
    update public.night_shift_attempts set duration_ms = elapsed where id = p_id and duration_ms is null;
    return jsonb_build_object('duration', elapsed);
  end if;

  if run.duration_ms is null then raise exception '请先完成挑战。'; end if;
  nickname := btrim(p_name);
  if nickname is null or char_length(nickname) not between 1 and 20 or nickname ~ '[[:cntrl:]]' then
    raise exception '请输入 1–20 个可显示字符。';
  end if;
  insert into public.night_shift_scores(id, challenge_date, player_name, duration_ms)
    values (run.id, run.challenge_date, nickname, run.duration_ms)
    on conflict (id) do nothing;
  return public.night_shift_ranking(run.challenge_date, run.id);
end;
$$;

revoke all on function public.night_shift_play(text, date, uuid, jsonb, text) from public;
grant execute on function public.night_shift_play(text, date, uuid, jsonb, text) to anon, authenticated;

commit;

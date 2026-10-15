-- Fair, automatic rankings (§2.7). No manual curation: every ranking uses the same formula.
--   score = eligible votes + 0.5 × eligible repliers
-- Eligible = account at least 72 hours old when the score is computed, not the project owner,
-- project published. Functions take p_now so tests (and audits) can replay a point in time.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Monday (Asia/Jakarta) of the week containing p_at.
create function public.wib_week_start(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'Asia/Jakarta')::date;
$$;

-- Scores for published projects with at least one eligible vote or replier in [p_from, p_to).
create function public.project_scores(p_from timestamptz, p_to timestamptz, p_now timestamptz default now())
returns table (
  project_id uuid,
  owner_id uuid,
  published_at timestamptz,
  eligible_votes integer,
  eligible_repliers integer,
  score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with votes as (
    select u.project_id, count(*)::integer as n
    from public.upvotes u
    join public.profiles pr on pr.id = u.user_id
    join public.projects p on p.id = u.project_id
    where u.created_at >= p_from and u.created_at < p_to
      and u.user_id <> p.owner_id
      and public.is_seasoned_account(pr.created_at, p_now)
    group by u.project_id
  ),
  repliers as (
    select c.project_id, count(distinct c.user_id)::integer as n
    from public.comments c
    join public.profiles pr on pr.id = c.user_id
    join public.projects p on p.id = c.project_id
    where c.status = 'visible'
      and c.created_at >= p_from and c.created_at < p_to
      and c.user_id <> p.owner_id
      and public.is_seasoned_account(pr.created_at, p_now)
    group by c.project_id
  )
  select
    p.id,
    p.owner_id,
    p.published_at,
    coalesce(v.n, 0),
    coalesce(r.n, 0),
    coalesce(v.n, 0) + 0.5 * coalesce(r.n, 0)
  from public.projects p
  left join votes v on v.project_id = p.id
  left join repliers r on r.project_id = p.id
  where p.status = 'published' and (v.n is not null or r.n is not null);
$$;

-- A. "Obrolan terpopuler minggu ini": rolling 7 days, real time, one project per maker.
create function public.popular_this_week(p_limit integer default 6, p_now timestamptz default now())
returns table (project_id uuid, score numeric, eligible_votes integer, eligible_repliers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select x.project_id, x.score, x.eligible_votes, x.eligible_repliers
  from (
    select
      s.*,
      row_number() over (
        partition by s.owner_id
        order by s.score desc, s.eligible_votes desc, s.published_at asc, s.project_id asc
      ) as maker_rank
    from public.project_scores(p_now - interval '7 days', p_now, p_now) s
  ) x
  where x.maker_rank = 1
  order by x.score desc, x.eligible_votes desc, x.published_at asc, x.project_id asc
  limit least(greatest(coalesce(p_limit, 6), 1), 50);
$$;

-- B. "Pilihan minggu ini": scored on the previous Monday–Sunday (WIB), frozen once stored.
create function public.compute_weekly_pick(
  p_week_start date default public.wib_week_start(now()),
  p_now timestamptz default now()
)
returns public.weekly_picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  min_score constant numeric := 3;
  window_from timestamptz := ((p_week_start - 7)::timestamp) at time zone 'Asia/Jakarta';
  window_to timestamptz := (p_week_start::timestamp) at time zone 'Asia/Jakarta';
  candidates jsonb;
  pick public.weekly_picks;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday, got %', p_week_start;
  end if;

  select * into pick from public.weekly_picks where week_start = p_week_start;
  if found then
    return pick;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'project_id', c.project_id,
        'score', c.score,
        'eligible_votes', c.eligible_votes,
        'eligible_repliers', c.eligible_repliers
      )
      order by c.score desc, c.eligible_votes desc, c.published_at asc, c.project_id asc
    ),
    '[]'::jsonb
  )
  into candidates
  from (
    select s.*
    from public.project_scores(window_from, window_to, p_now) s
    join public.projects p on p.id = s.project_id
    where s.score >= min_score
      and p.link_status <> 'archived'
      and exists (select 1 from public.project_media m where m.project_id = p.id)
      -- A project is picked at most once.
      and not exists (select 1 from public.weekly_picks wp where wp.project_id = p.id)
      -- Maker rotation: not picked in the previous 4 weeks.
      and not exists (
        select 1
        from public.weekly_picks wp
        join public.projects pp on pp.id = wp.project_id
        where pp.owner_id = p.owner_id
          and wp.week_start >= p_week_start - 28
          and wp.week_start < p_week_start
      )
    order by s.score desc, s.eligible_votes desc, s.published_at asc, s.project_id asc
    limit 5
  ) c;

  insert into public.weekly_picks (week_start, project_id, score, breakdown)
  values (
    p_week_start,
    (candidates -> 0 ->> 'project_id')::uuid,
    (candidates -> 0 ->> 'score')::numeric,
    jsonb_build_object(
      'window_from', window_from,
      'window_to', window_to,
      'scored_at', p_now,
      'min_score', min_score,
      'winner', candidates -> 0,
      'candidates', candidates
    )
  )
  on conflict (week_start) do nothing
  returning * into pick;

  if pick is null then
    select * into pick from public.weekly_picks where week_start = p_week_start;
  end if;
  return pick;
end;
$$;

-- Home hero: this week's pick, or the next stored candidate if the winner was hidden or archived;
-- falls back to the newest published project ("Baru masuk").
create function public.get_home_hero(p_now timestamptz default now())
returns table (project_id uuid, kind text, week_start date, score numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
  wk date := public.wib_week_start(p_now);
  candidate jsonb;
begin
  for candidate in
    select c.value
    from public.weekly_picks wp,
      lateral jsonb_array_elements(coalesce(wp.breakdown -> 'candidates', '[]'::jsonb)) with ordinality as c (value, ord)
    where wp.week_start = wk
    order by c.ord
  loop
    if exists (
      select 1 from public.projects p
      where p.id = (candidate ->> 'project_id')::uuid
        and p.status = 'published'
        and p.link_status <> 'archived'
    ) then
      return query select (candidate ->> 'project_id')::uuid, 'weekly_pick'::text, wk, (candidate ->> 'score')::numeric;
      return;
    end if;
  end loop;

  return query
    select p.id, 'latest'::text, null::date, null::numeric
    from public.projects p
    where p.status = 'published'
    order by p.published_at desc, p.id desc
    limit 1;
end;
$$;

-- Monday 00:05 WIB = Sunday 17:05 UTC. Daily 00:15 WIB for votes whose accounts just turned 72 hours.
select cron.schedule('compute-weekly-pick', '5 17 * * 0', $$select public.compute_weekly_pick()$$);
select cron.schedule('refresh-eligible-upvotes', '15 17 * * *', $$select public.refresh_eligible_upvote_counts()$$);

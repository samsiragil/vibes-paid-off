-- Fase 9: weekly link checker (Q8).
--
-- scripts/link-checker.mjs runs from GitHub Actions with the secret key, checks live_url of every
-- published project that is not archived, and reports one verdict per project here. The rule
-- lives in the database so the script stays a dumb HTTP prober:
--
-- * ok: link_status back to 'live', link_fail_count reset.
-- * failed: link_fail_count + 1; the second failure in a row marks the project 'offline'.
-- * 'archived' is the maker's call (set_project_archived) and is never touched, nor are projects
--   that are not published (any more) by the time the verdict arrives.
--
-- Changing live_url also starts the count again: a maker who fixes a dead link is 'live' until
-- the next check says otherwise.

-- ---------------------------------------------------------------------------
-- Verdicts from the checker
-- ---------------------------------------------------------------------------

-- p_results: [{"id": "<project uuid>", "ok": true|false}, ...]. Duplicated ids count once (the
-- first verdict wins). Returns the rows that were updated with their new state and whether
-- link_status changed, so the script can report what went offline or came back.
create function public.record_link_checks(p_results jsonb)
returns table (project_id uuid, link_status public.link_status, link_fail_count smallint, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception 'invalid_results' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_results) r
    where jsonb_typeof(r -> 'id') is distinct from 'string'
      or jsonb_typeof(r -> 'ok') is distinct from 'boolean'
  ) then
    raise exception 'invalid_results' using errcode = '22023';
  end if;

  return query
  with input as (
    select distinct on (r.id) r.id, r.ok
    from (
      select (e ->> 'id')::uuid as id, (e ->> 'ok')::boolean as ok, n
      from jsonb_array_elements(p_results) with ordinality as x (e, n)
    ) r
    order by r.id, r.n
  ),
  before as (
    select p.id, p.link_status
    from public.projects p
    join input i on i.id = p.id
  ),
  updated as (
    update public.projects p
    set
      link_fail_count = case when i.ok then 0 else least(p.link_fail_count + 1, 32767) end,
      link_status = case
        when i.ok then 'live'
        when p.link_fail_count + 1 >= 2 then 'offline'
        else p.link_status
      end::public.link_status,
      last_checked_at = now()
    from input i
    where p.id = i.id and p.status = 'published' and p.link_status <> 'archived'
    returning p.id, p.link_status, p.link_fail_count
  )
  select u.id, u.link_status, u.link_fail_count, u.link_status is distinct from b.link_status
  from updated u
  join before b on b.id = u.id;
end;
$$;

revoke execute on function public.record_link_checks(jsonb) from public, anon, authenticated;
grant execute on function public.record_link_checks(jsonb) to service_role;

comment on function public.record_link_checks(jsonb) is
  'Weekly link checker verdicts (Q8): ok resets to live, the 2nd failure in a row marks offline. service_role only.';

-- ---------------------------------------------------------------------------
-- A new live_url starts the count again
-- ---------------------------------------------------------------------------

create or replace function public.projects_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_changed boolean := (
    new.title, new.tagline, new.description, new.key_prompt, new.lessons,
    new.live_url, new.repo_url, new.video_url, new.category, new.content_lang
  ) is distinct from (
    old.title, old.tagline, old.description, old.key_prompt, old.lessons,
    old.live_url, old.repo_url, old.video_url, old.category, old.content_lang
  );
begin
  if content_changed then
    new.updated_at := now();
    -- A rejected project edited by its owner goes back to the review queue (Q11).
    if old.status = 'rejected' and new.status = 'rejected' and auth.uid() = old.owner_id then
      new.status := 'pending';
    end if;
    new.search := public.project_search_vector(new.id, new.title, new.tagline, new.key_prompt, new.description);
  end if;

  -- The old verdict was about the old URL. Archived stays archived (the maker's call, Q8).
  if new.live_url is distinct from old.live_url and new.link_status <> 'archived' then
    new.link_status := 'live';
    new.link_fail_count := 0;
    new.last_checked_at := null;
  end if;

  -- Back in the queue: the 48-hour clock restarts and the previous verdict goes away.
  -- reviewed_by/reviewed_at stay as the log of the last decision.
  if new.status = 'pending' and old.status <> 'pending' then
    new.submitted_at := now();
    new.reject_reason := null;
    new.reject_code := null;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

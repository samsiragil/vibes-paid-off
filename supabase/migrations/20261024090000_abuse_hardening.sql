-- Security audit run-1, stage 2: anti-abuse controls that hold at the database, not only in the app.
--
-- * Quotas are serialized per account. The project (3/24h), reply (30/24h) and new report (10/24h)
--   checks first lock the account's profile row, so parallel requests through PostgREST cannot all
--   read a count under the limit and all insert. FOR NO KEY UPDATE only serializes these checks; it
--   does not block foreign-key checks from other rows that reference the profile.
-- * Deleting a reply no longer gives the slot back: replies are counted from reply_quota_log,
--   which a delete does not touch, so delete-and-repost cannot reset the daily limit.
-- * Reports: every report still counts toward report_count (the admin queue), but only open
--   reports from established accounts (a username and older than 72 hours, the same rule as
--   ranking) hide content automatically. Fresh throwaway accounts can no longer take down a
--   project or reply, and reports an admin resolved with "keep" stop counting.
-- * projects/comments: report_count, link_fail_count and reviewed_by (the reviewing admin's id)
--   are no longer readable through the Data API; only the definer RPCs and the admin pages use them.
-- * profiles.links only stores https:// strings (the app already ignored anything else).

-- ---------------------------------------------------------------------------
-- Quotas: lock the account first
-- ---------------------------------------------------------------------------

create or replace function public.projects_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  -- Requests from users: the database decides status and derived fields, never the client.
  if uid is not null then
    -- Serializes concurrent inserts by the same owner so they cannot all pass the limit.
    perform 1 from public.profiles where id = new.owner_id for no key update;
    if (
      select count(*) from public.projects p
      where p.owner_id = new.owner_id and p.created_at > now() - interval '24 hours'
    ) >= 3 then
      perform public.raise_rate_limit('projects');
    end if;

    new.status := case
      when (select pr.is_trusted from public.profiles pr where pr.id = new.owner_id) then 'published'
      else 'pending'
    end::public.project_status;
    new.link_status := 'live';
    new.last_checked_at := null;
    new.link_fail_count := 0;
    new.published_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reject_reason := null;
    new.reject_code := null;
    new.created_at := now();
  end if;

  new.submitted_at := new.created_at;
  new.build_time_hours := 0;
  new.session_count := 0;
  new.upvote_count := 0;
  new.eligible_upvote_count := 0;
  new.comment_count := 0;
  new.report_count := 0;
  new.updated_at := new.created_at;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  new.search := public.project_search_vector(new.id, new.title, new.tagline, new.key_prompt, new.description);
  return new;
end;
$$;

-- One row per reply ever posted in the last 24 hours, kept when the reply is deleted.
create table public.reply_quota_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null
);

create index reply_quota_log_user_idx on public.reply_quota_log (user_id, created_at);

alter table public.reply_quota_log enable row level security;
revoke all on public.reply_quota_log from public, anon, authenticated;

comment on table public.reply_quota_log is
  'Reply quota (30 per 24 hours). Written by comments_before_insert; deleting a reply leaves its row.';

-- Replies from the last 24 hours, so the quota holds right after this migration.
insert into public.reply_quota_log (user_id, created_at)
select c.user_id, c.created_at
from public.comments c
where c.created_at > now() - interval '24 hours';

create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if not exists (
      select 1 from public.profiles pr where pr.id = new.user_id and pr.username is not null
    ) then
      raise exception 'username_required' using errcode = '42501';
    end if;
    -- Serializes concurrent replies by the same account so they cannot all pass the limit.
    perform 1 from public.profiles where id = new.user_id for no key update;
    if (
      select count(*) from public.reply_quota_log l
      where l.user_id = new.user_id and l.created_at > now() - interval '24 hours'
    ) >= 30 then
      perform public.raise_rate_limit('comments');
    end if;
    new.body := btrim(new.body);
    new.status := 'visible';
    new.report_count := 0;
    new.created_at := now();
  end if;

  delete from public.reply_quota_log l
  where l.user_id = new.user_id and l.created_at <= now() - interval '24 hours';
  insert into public.reply_quota_log (user_id, created_at) values (new.user_id, new.created_at);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports: daily quota, and only established accounts hide content
-- ---------------------------------------------------------------------------

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.target_type = 'project' then
    select p.owner_id into v_owner
    from public.projects p
    where p.id = new.target_id
      and (auth.uid() is null or p.status = 'published');
  else
    select c.user_id into v_owner
    from public.comments c
    join public.projects p on p.id = c.project_id
    where c.id = new.target_id
      and (auth.uid() is null or (c.status = 'visible' and p.status = 'published'));
  end if;

  if not found then
    raise exception 'report_target_not_found' using errcode = 'P0001';
  end if;

  if auth.uid() is not null then
    if v_owner = new.reporter_id then
      raise exception 'report_own_content' using errcode = 'P0001';
    end if;
    perform 1 from public.profiles where id = new.reporter_id for no key update;
    if (
      select count(*) from public.reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '24 hours'
    ) >= 10 then
      perform public.raise_rate_limit('reports');
    end if;
    new.note := nullif(btrim(new.note), '');
    new.resolved := false;
    new.resolved_by := null;
    new.resolution := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weighty integer;
begin
  -- Lock the target first, so concurrent reports count each other once the first one commits.
  if new.target_type = 'project' then
    perform 1 from public.projects where id = new.target_id for update;
  else
    perform 1 from public.comments where id = new.target_id for update;
  end if;

  select count(*) into v_weighty
  from public.reports r
  join public.profiles pr on pr.id = r.reporter_id
  where r.target_type = new.target_type
    and r.target_id = new.target_id
    and not r.resolved
    and pr.username is not null
    and public.is_seasoned_account(pr.created_at);

  if new.target_type = 'project' then
    update public.projects
    set
      report_count = report_count + 1,
      status = case when status = 'published' and v_weighty >= 3 then 'hidden' else status end
    where id = new.target_id;
  else
    update public.comments
    set
      report_count = report_count + 1,
      status = case when status = 'visible' and v_weighty >= 3 then 'hidden' else status end
    where id = new.target_id;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Column grants: moderation internals stay out of the Data API
-- ---------------------------------------------------------------------------

revoke select on public.projects from anon, authenticated;
grant select (
  id, owner_id, slug, title, tagline, description, key_prompt, lessons, live_url, repo_url,
  video_url, category, content_lang, status, link_status, last_checked_at, build_time_hours,
  session_count, upvote_count, eligible_upvote_count, comment_count, published_at, reviewed_at,
  reject_reason, reject_code, submitted_at, search, created_at, updated_at
) on public.projects to anon, authenticated;

revoke select on public.comments from anon, authenticated;
grant select (id, project_id, user_id, body, status, created_at)
  on public.comments to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles.links: https only
-- ---------------------------------------------------------------------------

create function public.links_are_https(links jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Non-objects are left to profiles_links_object (jsonb_each would raise on them).
  select case
    when jsonb_typeof(links) <> 'object' then true
    else not exists (
      select 1 from jsonb_each(links) e
      where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') not like 'https://%'
    )
  end;
$$;

-- Drop values the app never showed anyway, so the constraint validates on existing rows.
update public.profiles pr
set links = (
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  from jsonb_each(pr.links) e
  where jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') like 'https://%'
)
where not public.links_are_https(pr.links);

alter table public.profiles
  add constraint profiles_links_https check (public.links_are_https(links));

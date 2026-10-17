-- Triggers for derived data, moderation rules and rate limits (§2.2 "Trigger / function").
-- Trigger functions run as security definer because they maintain columns that clients cannot write.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Voter/replier accounts count for rankings once they are 72 hours old (§2.7, Q24).
create function public.is_seasoned_account(created_at timestamptz, at_time timestamptz default now())
returns boolean
language sql
immutable
set search_path = ''
as $$
  select created_at <= at_time - interval '72 hours';
$$;

create function public.raise_rate_limit(resource text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'rate_limit:%', resource
    using errcode = 'P0001', hint = 'Daily limit reached for this account.';
end;
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- Every new auth user gets a profile; username is chosen later in /onboarding.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', meta ->> 'user_name', ''), 60),
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Live check for /onboarding: format, reserved list and uniqueness.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[a-z0-9_]{3,20}$'
    and not public.is_reserved_username(name)
    and not exists (
      select 1 from public.profiles p
      where p.username = name::extensions.citext and p.id is distinct from auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create function public.project_search_vector(
  p_id uuid, p_title text, p_tagline text, p_key_prompt text, p_description text
)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select
    setweight(to_tsvector('simple', coalesce(p_title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(p_tagline, '') || ' ' || coalesce(p_key_prompt, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(p_description, '')), 'C')
    || setweight(
      to_tsvector('simple', coalesce(
        (select string_agg(s.prompt, ' ' order by s.sort_order)
         from public.project_sessions s where s.project_id = p_id),
        ''
      )),
      'D'
    );
$$;

create function public.refresh_tool_counts(p_tool_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tools t
  set project_count = (
    select count(*)
    from public.project_tools pt
    join public.projects p on p.id = pt.project_id
    where pt.tool_id = t.id and p.status = 'published'
  )
  where t.id = any (p_tool_ids);
$$;

create function public.projects_before_insert()
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
    new.created_at := now();
  end if;

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

create trigger projects_before_insert
  before insert on public.projects
  for each row execute function public.projects_before_insert();

create function public.projects_before_update()
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
      new.reject_reason := null;
    end if;
    new.search := public.project_search_vector(new.id, new.title, new.tagline, new.key_prompt, new.description);
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger projects_before_update
  before update on public.projects
  for each row execute function public.projects_before_update();

create function public.projects_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- First approval makes the maker trusted; later projects publish directly.
  if old.status = 'pending' and new.status = 'published' then
    update public.profiles set is_trusted = true where id = new.owner_id and not is_trusted;
  end if;

  if (old.status = 'published') <> (new.status = 'published') then
    perform public.refresh_tool_counts(
      array(select pt.tool_id from public.project_tools pt where pt.project_id = new.id)
    );
  end if;
  return null;
end;
$$;

create trigger projects_after_update
  after update of status on public.projects
  for each row execute function public.projects_after_update();

-- ---------------------------------------------------------------------------
-- Sessions: min 1, max 10, and the derived build time / session count / search
-- ---------------------------------------------------------------------------

create function public.project_sessions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the project row so concurrent inserts cannot both pass the limit.
  perform 1 from public.projects where id = new.project_id for update;
  if (select count(*) from public.project_sessions where project_id = new.project_id) >= 10 then
    raise exception 'project_sessions_limit' using errcode = 'P0001', hint = 'A project has at most 10 sessions.';
  end if;
  return new;
end;
$$;

create trigger project_sessions_before_insert
  before insert on public.project_sessions
  for each row execute function public.project_sessions_before_insert();

create function public.project_sessions_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  foreach pid in array array_remove(array[new.project_id, old.project_id], null) loop
    update public.projects p
    set
      build_time_hours = coalesce((select sum(s.duration_hours) from public.project_sessions s where s.project_id = pid), 0),
      session_count = (select count(*) from public.project_sessions s where s.project_id = pid),
      search = public.project_search_vector(p.id, p.title, p.tagline, p.key_prompt, p.description)
    where p.id = pid;
  end loop;
  return null;
end;
$$;

create trigger project_sessions_after_change
  after insert or update or delete on public.project_sessions
  for each row execute function public.project_sessions_after_change();

-- Checked at commit so a project and its sessions can be written in one transaction.
create function public.assert_project_has_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid := case when tg_table_name = 'projects' then new.id else old.project_id end;
begin
  if exists (select 1 from public.projects where id = pid)
    and not exists (select 1 from public.project_sessions where project_id = pid)
  then
    raise exception 'project_sessions_required' using errcode = 'P0001', hint = 'A project needs at least one session.';
  end if;
  return null;
end;
$$;

create constraint trigger projects_require_session
  after insert on public.projects
  deferrable initially deferred
  for each row execute function public.assert_project_has_session();

create constraint trigger project_sessions_keep_one
  after delete on public.project_sessions
  deferrable initially deferred
  for each row execute function public.assert_project_has_session();

-- ---------------------------------------------------------------------------
-- Media: max 3 per project
-- ---------------------------------------------------------------------------

create function public.project_media_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.projects where id = new.project_id for update;
  if (select count(*) from public.project_media where project_id = new.project_id) >= 3 then
    raise exception 'project_media_limit' using errcode = 'P0001', hint = 'A project has at most 3 images.';
  end if;
  return new;
end;
$$;

create trigger project_media_before_insert
  before insert on public.project_media
  for each row execute function public.project_media_before_insert();

-- ---------------------------------------------------------------------------
-- Project tools: keep tools.project_count current
-- ---------------------------------------------------------------------------

create function public.project_tools_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_tool_counts(array_remove(array[new.tool_id, old.tool_id], null));
  return null;
end;
$$;

create trigger project_tools_after_change
  after insert or delete on public.project_tools
  for each row execute function public.project_tools_after_change();

-- ---------------------------------------------------------------------------
-- Upvotes ("Worth it")
-- ---------------------------------------------------------------------------

create function public.upvotes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No voting on your own project (Q13).
  if exists (select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.user_id) then
    raise exception 'upvote_own_project' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger upvotes_before_insert
  before insert on public.upvotes
  for each row execute function public.upvotes_before_insert();

-- Count of votes from seasoned accounts; drift from accounts that age past 72 hours
-- is fixed by refresh_eligible_upvote_counts() (scheduled daily).
create function public.eligible_upvotes_for(p_project_id uuid, p_now timestamptz default now())
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.upvotes u
  join public.profiles pr on pr.id = u.user_id
  where u.project_id = p_project_id and public.is_seasoned_account(pr.created_at, p_now);
$$;

create function public.upvotes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects
  set
    upvote_count = greatest(upvote_count + case when tg_op = 'INSERT' then 1 else -1 end, 0),
    eligible_upvote_count = public.eligible_upvotes_for(pid)
  where id = pid;
  return null;
end;
$$;

create trigger upvotes_after_change
  after insert or delete on public.upvotes
  for each row execute function public.upvotes_after_change();

create function public.refresh_eligible_upvote_counts(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  with counts as (
    select p.id, public.eligible_upvotes_for(p.id, p_now) as n
    from public.projects p
    where p.upvote_count > 0 or p.eligible_upvote_count > 0
  )
  update public.projects p
  set eligible_upvote_count = c.n
  from counts c
  where p.id = c.id and p.eligible_upvote_count <> c.n;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comments ("Balasan")
-- ---------------------------------------------------------------------------

create function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if (
      select count(*) from public.comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '24 hours'
    ) >= 30 then
      perform public.raise_rate_limit('comments');
    end if;
    new.status := 'visible';
    new.report_count := 0;
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

create function public.comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer :=
    (case when tg_op <> 'DELETE' and new.status = 'visible' then 1 else 0 end)
    - (case when tg_op <> 'INSERT' and old.status = 'visible' then 1 else 0 end);
begin
  if delta <> 0 then
    update public.projects
    set comment_count = greatest(comment_count + delta, 0)
    where id = coalesce(new.project_id, old.project_id);
  end if;
  return null;
end;
$$;

create trigger comments_after_change
  after insert or delete or update of status on public.comments
  for each row execute function public.comments_after_change();

-- ---------------------------------------------------------------------------
-- Reports: third unique report hides the target
-- ---------------------------------------------------------------------------

create function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    (new.target_type = 'project' and exists (select 1 from public.projects where id = new.target_id))
    or (new.target_type = 'comment' and exists (select 1 from public.comments where id = new.target_id))
  ) then
    raise exception 'report_target_not_found' using errcode = 'P0001';
  end if;

  if auth.uid() is not null then
    new.resolved := false;
    new.resolved_by := null;
    new.resolution := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

create function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'project' then
    update public.projects
    set
      report_count = report_count + 1,
      status = case when status = 'published' and report_count + 1 >= 3 then 'hidden' else status end
    where id = new.target_id;
  else
    update public.comments
    set
      report_count = report_count + 1,
      status = case when status = 'visible' and report_count + 1 >= 3 then 'hidden' else status end
    where id = new.target_id;
  end if;
  return null;
end;
$$;

create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.reports_after_insert();

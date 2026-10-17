-- Fase 8: /admin. Moderation goes through security definer RPCs that check is_admin() first, so
-- the column grants that keep clients away from status, trust and review fields stay as they are.
--
-- * Review queue: admin_review_project() approves (the maker becomes trusted through the existing
--   trigger) or rejects with a reason code from a fixed list plus an optional note (Q11). The
--   48-hour clock runs from projects.submitted_at, which restarts when a project re-enters review.
-- * Saving a rejected project sends it back to review (Q11), also when only its sessions or tools
--   changed: upsert_project() now calls resubmit_rejected_project() after an edit.
-- * Reports: admin_resolve_report() closes every open report on one target with one verdict:
--   keep (visible again, report count reset), hide, or remove. admin_set_trusted() revokes or
--   grants trust separately.
-- * Tool suggestions: admin_resolve_tool_suggestions() merges every pending suggestion with the
--   same name into an existing tool or a new one (linking all those projects), or rejects them.
-- * Minimal log: reviewed_by/reviewed_at on projects, resolved_by/resolution on reports.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.projects
  add column submitted_at timestamptz,
  add column reject_code text check (
    reject_code in ('incomplete', 'broken_link', 'not_vibe_coded', 'duplicate', 'rules', 'other')
  );

update public.projects set submitted_at = created_at;
alter table public.projects
  alter column submitted_at set not null,
  alter column submitted_at set default now();

comment on column public.projects.submitted_at is
  'When the project last entered the review queue (created, or resubmitted after a rejection).';
comment on column public.projects.reject_code is
  'Why an admin rejected it (labels in messages moderation.rejectCodes); reject_reason holds the note.';

create index projects_pending_idx on public.projects (submitted_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Triggers: the queue clock and the old verdict follow the status
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

-- ---------------------------------------------------------------------------
-- Resubmitting a rejected project
-- ---------------------------------------------------------------------------

-- Called by upsert_project() after an edit (which runs as the user, who cannot write status).
-- A no-op for anything but the caller's own rejected project.
create function public.resubmit_rejected_project(p_project_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.projects
  set status = 'pending'
  where id = p_project_id and owner_id = auth.uid() and status = 'rejected';
$$;

revoke execute on function public.resubmit_rejected_project(uuid) from public, anon;
grant execute on function public.resubmit_rejected_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin guard
-- ---------------------------------------------------------------------------

-- Raises unless the caller is an admin; returns their id for the log columns.
create function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return uid;
end;
$$;

revoke execute on function public.assert_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Review queue
-- ---------------------------------------------------------------------------

-- Approves or rejects a pending project. Returns what the app needs for cache tags and the
-- notification email: {id, slug, owner_id, status, title, content_lang}.
create function public.admin_review_project(
  p_project_id uuid,
  p_approve boolean,
  p_reject_code text default null,
  p_reject_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.assert_admin();
  v_note text := nullif(btrim(p_reject_note), '');
  v_project public.projects;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  if v_project.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    -- projects_after_update makes the maker trusted (first approval).
    update public.projects
    set status = 'published', reviewed_by = v_admin, reviewed_at = now(),
      reject_code = null, reject_reason = null
    where id = p_project_id
    returning * into v_project;
  else
    if p_reject_code is null then
      raise exception 'reject_code_required' using errcode = '22023';
    end if;
    if p_reject_code = 'other' and v_note is null then
      raise exception 'reject_note_required' using errcode = '22023';
    end if;
    update public.projects
    set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(),
      reject_code = p_reject_code, reject_reason = v_note
    where id = p_project_id
    returning * into v_project;
  end if;

  return jsonb_build_object(
    'id', v_project.id,
    'slug', v_project.slug,
    'owner_id', v_project.owner_id,
    'status', v_project.status,
    'title', v_project.title,
    'content_lang', v_project.content_lang
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

-- Closes all open reports on one target with one verdict:
--   keep   = the target stays or becomes visible again; its report count restarts at zero
--   hide   = a published project becomes hidden, a reply hidden
--   remove = a project becomes removed (gone for its owner too), a reply is deleted
-- Returns {project_id, owner_id, slug, status}; ids are null when the target no longer exists
-- (its author deleted the reply), in which case the reports are still closed.
create function public.admin_resolve_report(
  p_target_type public.report_target,
  p_target_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.assert_admin();
  v_closed integer;
  v_project_id uuid;
  v_owner_id uuid;
  v_slug text;
  v_status text;
begin
  if p_action is null or p_action not in ('keep', 'hide', 'remove') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  update public.reports
  set resolved = true, resolved_by = v_admin, resolution = p_action
  where target_type = p_target_type and target_id = p_target_id and not resolved;
  get diagnostics v_closed = row_count;
  if v_closed = 0 then
    raise exception 'no_open_reports' using errcode = 'P0001';
  end if;

  if p_target_type = 'project' then
    update public.projects p
    set
      status = case
        when p_action = 'remove' then 'removed'
        when p_action = 'hide' and p.status = 'published' then 'hidden'
        when p_action = 'keep' and p.status = 'hidden' then 'published'
        else p.status
      end::public.project_status,
      report_count = case when p_action = 'keep' then 0 else p.report_count end
    where p.id = p_target_id
    returning p.id, p.owner_id, p.slug, p.status::text into v_project_id, v_owner_id, v_slug, v_status;
  else
    select c.project_id into v_project_id from public.comments c where c.id = p_target_id;
    if p_action = 'remove' then
      delete from public.comments where id = p_target_id;
      v_status := 'removed';
    else
      update public.comments c
      set
        status = case when p_action = 'hide' then 'hidden' else 'visible' end::public.comment_status,
        report_count = case when p_action = 'keep' then 0 else c.report_count end
      where c.id = p_target_id
      returning c.status::text into v_status;
    end if;
    select p.owner_id, p.slug into v_owner_id, v_slug from public.projects p where p.id = v_project_id;
  end if;

  return jsonb_build_object(
    'project_id', v_project_id,
    'owner_id', v_owner_id,
    'slug', v_slug,
    'status', v_status
  );
end;
$$;

-- Grants or revokes "Maker terpercaya" (untrusted makers' next projects go through review again).
create function public.admin_set_trusted(p_profile_id uuid, p_trusted boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.profiles set is_trusted = p_trusted where id = p_profile_id;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;
  return p_trusted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tool suggestions (§2.8, Q28)
-- ---------------------------------------------------------------------------

-- Resolves every pending suggestion whose name matches p_name (case and spaces ignored):
--   merge  = into the active catalog tool p_tool_id
--   create = into a new tool from p_new_tool {slug, name, url, logo_url, kind, description_id,
--            description_en}
--   reject = no catalog tool; the name stops showing on those projects
-- Merging links the tool to every project that suggested the name.
-- Returns {tool_id, project_ids}.
create function public.admin_resolve_tool_suggestions(
  p_name text,
  p_action text,
  p_tool_id bigint default null,
  p_new_tool jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := lower(btrim(p_name));
  v_tool_id bigint := p_tool_id;
  v_project_ids uuid[];
begin
  perform public.assert_admin();
  if p_action is null or p_action not in ('merge', 'create', 'reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tool_suggestions ts
    where ts.status = 'pending' and lower(btrim(ts.name)) = v_key
  ) then
    raise exception 'no_pending_suggestions' using errcode = 'P0001';
  end if;

  if p_action = 'create' then
    insert into public.tools (slug, name, url, logo_url, kind, description_id, description_en)
    values (
      p_new_tool ->> 'slug',
      btrim(p_new_tool ->> 'name'),
      nullif(btrim(p_new_tool ->> 'url'), ''),
      nullif(btrim(p_new_tool ->> 'logo_url'), ''),
      (p_new_tool ->> 'kind')::public.tool_kind,
      coalesce(btrim(p_new_tool ->> 'description_id'), ''),
      coalesce(btrim(p_new_tool ->> 'description_en'), '')
    )
    returning id into v_tool_id;
  elsif p_action = 'merge' then
    if not exists (select 1 from public.tools t where t.id = v_tool_id and t.is_active) then
      raise exception 'tool_not_found' using errcode = 'P0001';
    end if;
  else
    v_tool_id := null;
  end if;

  with resolved as (
    update public.tool_suggestions ts
    set
      status = case when p_action = 'reject' then 'rejected' else 'merged' end::public.suggestion_status,
      merged_tool_id = v_tool_id
    where ts.status = 'pending' and lower(btrim(ts.name)) = v_key
    returning ts.project_id
  )
  select array_agg(distinct r.project_id) into v_project_ids from resolved r;

  if v_tool_id is not null then
    insert into public.project_tools (project_id, tool_id)
    select pid, v_tool_id from unnest(v_project_ids) pid
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'tool_id', v_tool_id,
    'project_ids', to_jsonb(coalesce(v_project_ids, '{}'::uuid[]))
  );
end;
$$;

revoke execute on function
  public.admin_review_project(uuid, boolean, text, text),
  public.admin_resolve_report(public.report_target, uuid, text),
  public.admin_set_trusted(uuid, boolean),
  public.admin_resolve_tool_suggestions(text, text, bigint, jsonb)
from public, anon;
grant execute on function
  public.admin_review_project(uuid, boolean, text, text),
  public.admin_resolve_report(public.report_target, uuid, text),
  public.admin_set_trusted(uuid, boolean),
  public.admin_resolve_tool_suggestions(text, text, bigint, jsonb)
to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_project(): an edit resubmits a rejected project
-- ---------------------------------------------------------------------------

create or replace function public.upsert_project(
  p_project jsonb,
  p_slug_base text default null,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pid uuid := p_project_id;
  v_slug text;
  v_status public.project_status;
  base text;
  attempt integer := 0;
  sessions jsonb := coalesce(p_project -> 'sessions', '[]'::jsonb);
  suggestions jsonb := coalesce(p_project -> 'suggestions', '[]'::jsonb);
  tool_ids bigint[];
  session jsonb;
  pos integer;
  session_id uuid;
begin
  if uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if jsonb_typeof(sessions) <> 'array' or jsonb_array_length(sessions) not between 1 and 10 then
    raise exception 'invalid_sessions' using errcode = '22023', hint = 'Send 1 to 10 sessions.';
  end if;
  if jsonb_typeof(suggestions) <> 'array' or jsonb_array_length(suggestions) > 5 then
    raise exception 'invalid_suggestions' using errcode = '22023', hint = 'Send at most 5 tool suggestions.';
  end if;

  tool_ids := array(
    select distinct x::bigint from jsonb_array_elements_text(coalesce(p_project -> 'tool_ids', '[]'::jsonb)) x
  );
  if cardinality(tool_ids) > 20 then
    raise exception 'invalid_tools' using errcode = '22023', hint = 'Pick at most 20 tools.';
  end if;
  -- This is a vibe coding catalog: at least one AI tool from the catalog (§2.8).
  if not exists (
    select 1 from public.tools t
    where t.id = any (tool_ids) and t.is_active and t.kind in ('ai_agent', 'ai_builder', 'ai_assistant')
  ) then
    raise exception 'ai_tool_required' using errcode = '22023', hint = 'Pick at least one AI tool.';
  end if;

  if pid is null then
    base := left(coalesce(p_slug_base, ''), 70);
    base := regexp_replace(base, '-+$', '');
    if base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      base := 'proyek';
    end if;

    -- base, base-2 … base-9, then a random suffix; the unique index settles races.
    loop
      attempt := attempt + 1;
      v_slug := case
        when attempt = 1 then base
        when attempt <= 9 then base || '-' || attempt
        else base || '-' || substr(md5(random()::text), 1, 6)
      end;
      begin
        insert into public.projects (
          owner_id, slug, title, tagline, description, key_prompt, lessons,
          live_url, repo_url, video_url, category, content_lang
        ) values (
          uid, v_slug,
          p_project ->> 'title',
          p_project ->> 'tagline',
          coalesce(p_project ->> 'description', ''),
          p_project ->> 'key_prompt',
          nullif(p_project ->> 'lessons', ''),
          p_project ->> 'live_url',
          nullif(p_project ->> 'repo_url', ''),
          nullif(p_project ->> 'video_url', ''),
          p_project ->> 'category',
          (p_project ->> 'content_lang')::public.content_lang
        )
        returning id into pid;
        exit;
      exception when unique_violation then
        if attempt >= 15 then
          raise;
        end if;
      end;
    end loop;
  else
    update public.projects p
    set
      title = p_project ->> 'title',
      tagline = p_project ->> 'tagline',
      description = coalesce(p_project ->> 'description', ''),
      key_prompt = p_project ->> 'key_prompt',
      lessons = nullif(p_project ->> 'lessons', ''),
      live_url = p_project ->> 'live_url',
      repo_url = nullif(p_project ->> 'repo_url', ''),
      video_url = nullif(p_project ->> 'video_url', ''),
      category = p_project ->> 'category',
      content_lang = (p_project ->> 'content_lang')::public.content_lang
    where p.id = pid
    returning p.slug into v_slug;

    -- RLS hides other people's projects (and removed ones) from the update.
    if not found then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;

  -- Sessions: rows whose id comes back are updated in place, the rest are replaced.
  delete from public.project_sessions ps
  where ps.project_id = pid
    and ps.id <> all (array(
      select (e ->> 'id')::uuid from jsonb_array_elements(sessions) e where nullif(e ->> 'id', '') is not null
    ));

  for session, pos in
    select e, o::integer - 1 from jsonb_array_elements(sessions) with ordinality as t (e, o)
  loop
    session_id := nullif(session ->> 'id', '')::uuid;
    if session_id is not null then
      update public.project_sessions ps
      set
        sort_order = pos,
        label = nullif(btrim(session ->> 'label'), ''),
        duration_hours = (session ->> 'duration_hours')::numeric,
        prompt = session ->> 'prompt',
        result = session ->> 'result',
        challenge = nullif(session ->> 'challenge', ''),
        solution = nullif(session ->> 'solution', '')
      where ps.id = session_id and ps.project_id = pid;
      if found then
        continue;
      end if;
    end if;

    insert into public.project_sessions (
      project_id, sort_order, label, duration_hours, prompt, result, challenge, solution
    ) values (
      pid, pos,
      nullif(btrim(session ->> 'label'), ''),
      (session ->> 'duration_hours')::numeric,
      session ->> 'prompt',
      session ->> 'result',
      nullif(session ->> 'challenge', ''),
      nullif(session ->> 'solution', '')
    );
  end loop;

  -- Tools from the catalog.
  delete from public.project_tools pt
  where pt.project_id = pid and pt.tool_id <> all (tool_ids);

  insert into public.project_tools (project_id, tool_id)
  select pid, t.id
  from public.tools t
  where t.id = any (tool_ids)
    and t.is_active
    and not exists (select 1 from public.project_tools pt where pt.project_id = pid and pt.tool_id = t.id);

  -- Tools the maker could not find: pending suggestions follow the list; reviewed ones stay.
  delete from public.tool_suggestions ts
  where ts.project_id = pid
    and ts.suggested_by = uid
    and ts.status = 'pending'
    and lower(btrim(ts.name)) <> all (array(
      select lower(btrim(e ->> 'name')) from jsonb_array_elements(suggestions) e
    ));

  insert into public.tool_suggestions (project_id, name, url)
  select distinct on (lower(btrim(e ->> 'name')))
    pid, btrim(e ->> 'name'), nullif(btrim(e ->> 'url'), '')
  from jsonb_array_elements(suggestions) e
  where not exists (
    select 1 from public.tool_suggestions ts
    where ts.project_id = pid and lower(btrim(ts.name)) = lower(btrim(e ->> 'name'))
  )
  order by lower(btrim(e ->> 'name'));

  -- Saving a rejected project sends it back to review (Q11), even when only sessions or tools
  -- changed (content edits already do so in projects_before_update).
  if p_project_id is not null then
    perform public.resubmit_rejected_project(pid);
  end if;

  select p.status into v_status from public.projects p where p.id = pid;
  return jsonb_build_object('id', pid, 'slug', v_slug, 'status', v_status);
end;
$$;

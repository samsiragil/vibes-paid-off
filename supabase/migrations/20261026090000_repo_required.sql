-- Repo first, live link optional.
--
-- * Plenty of vibe coded projects never get a public URL (scripts, bots, apps behind a login), so
--   live_url is optional now. The link checker only probes projects that have one.
-- * The GitHub repo is what the app asks for instead (required in the form; the column stays
--   nullable for older projects). A private repo is fine: the maker confirms it when GitHub
--   answers 404, and repo_private makes the project page show "Repo privat" without the link.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

-- The check (is_https_url) lets null through.
alter table public.projects alter column live_url drop not null;

alter table public.projects add column repo_private boolean not null default false;

comment on column public.projects.repo_private is
  'The maker said the repo is private (GitHub answered 404): pages show "Repo privat", no link.';

grant select (repo_private) on public.projects to anon, authenticated;
grant insert (repo_private) on public.projects to authenticated;
grant update (repo_private) on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- repo_private counts as content
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
    new.live_url, new.repo_url, new.video_url, new.category, new.content_lang,
    new.build_effort, new.moment_wow, new.moment_hardest, new.repo_private
  ) is distinct from (
    old.title, old.tagline, old.description, old.key_prompt, old.lessons,
    old.live_url, old.repo_url, old.video_url, old.category, old.content_lang,
    old.build_effort, old.moment_wow, old.moment_hardest, old.repo_private
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

-- ---------------------------------------------------------------------------
-- upsert_project(): optional live_url, repo_private
-- ---------------------------------------------------------------------------
--
-- p_project (jsonb, snake_case):
--   title, tagline, description, key_prompt, build_effort, moment_wow, moment_hardest, lessons,
--   live_url, repo_url, repo_private, video_url, category, content_lang, tool_ids bigint[],
--   suggestions [{name, url}].

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
  suggestions jsonb := coalesce(p_project -> 'suggestions', '[]'::jsonb);
  tool_ids bigint[];
begin
  if uid is null then
    raise exception 'not_allowed' using errcode = '42501';
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
          owner_id, slug, title, tagline, description, key_prompt, build_effort,
          moment_wow, moment_hardest, lessons, live_url, repo_url, repo_private, video_url, category,
          content_lang
        ) values (
          uid, v_slug,
          p_project ->> 'title',
          p_project ->> 'tagline',
          coalesce(p_project ->> 'description', ''),
          p_project ->> 'key_prompt',
          (p_project ->> 'build_effort')::public.build_effort,
          nullif(p_project ->> 'moment_wow', ''),
          nullif(p_project ->> 'moment_hardest', ''),
          nullif(p_project ->> 'lessons', ''),
          nullif(p_project ->> 'live_url', ''),
          nullif(p_project ->> 'repo_url', ''),
          coalesce((p_project ->> 'repo_private')::boolean, false),
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
      build_effort = (p_project ->> 'build_effort')::public.build_effort,
      moment_wow = nullif(p_project ->> 'moment_wow', ''),
      moment_hardest = nullif(p_project ->> 'moment_hardest', ''),
      lessons = nullif(p_project ->> 'lessons', ''),
      live_url = nullif(p_project ->> 'live_url', ''),
      repo_url = nullif(p_project ->> 'repo_url', ''),
      repo_private = coalesce((p_project ->> 'repo_private')::boolean, false),
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

  -- Saving a rejected project sends it back to review (Q11), even when only tools changed
  -- (content edits already do so in projects_before_update).
  if p_project_id is not null then
    perform public.resubmit_rejected_project(pid);
  end if;

  select p.status into v_status from public.projects p where p.id = pid;
  return jsonb_build_object('id', pid, 'slug', v_slug, 'status', v_status);
end;
$$;

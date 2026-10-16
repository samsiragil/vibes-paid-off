-- Submit and edit a project in one transaction (Fase 4): the project row, its build sessions,
-- tools and tool suggestions. Runs as the caller (security invoker), so RLS and the column grants
-- still decide what a user may write, and the insert/update triggers keep deciding status, rate
-- limits and derived fields. Images are uploaded separately (/api/media/*) once the project exists.
--
-- p_project (jsonb, snake_case):
--   title, tagline, description, key_prompt, lessons, live_url, repo_url, video_url, category,
--   content_lang, tool_ids bigint[], suggestions [{name, url}],
--   sessions [{id?, label, duration_hours, prompt, result, challenge, solution}] in display order.
-- p_project_id: omit to create (slug derived from p_slug_base, suffixed on collision), or the
--   project to edit (p_slug_base is then ignored: the slug never changes after creation).
-- Returns {id, slug, status}.

create function public.upsert_project(
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

  select p.status into v_status from public.projects p where p.id = pid;
  return jsonb_build_object('id', pid, 'slug', v_slug, 'status', v_status);
end;
$$;

revoke execute on function public.upsert_project(jsonb, text, uuid) from public, anon;
grant execute on function public.upsert_project(jsonb, text, uuid) to authenticated;

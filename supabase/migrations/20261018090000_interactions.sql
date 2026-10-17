-- Fase 7: Worth it, replies and reports from the project page.
--
-- * Reports only reach content the reporter can actually see (a published project, or a visible
--   reply on one) and never the reporter's own content, so the "3 different accounts" auto-hide
--   rule cannot be triggered by poking at ids of pending/hidden projects or by self-reports.
-- * Replies need a username (the reply list links to the author's profile).
-- * report_content(): one call for the server action that files the report and says whether the
--   target just got hidden, so the app can invalidate the cached pages it was shown on. The
--   reporter cannot read a hidden project back through RLS, hence security definer.

-- ---------------------------------------------------------------------------
-- Reports: visible targets only, never your own
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
    new.note := nullif(btrim(new.note), '');
    new.resolved := false;
    new.resolved_by := null;
    new.resolution := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replies: username required
-- ---------------------------------------------------------------------------

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
    if (
      select count(*) from public.comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '24 hours'
    ) >= 30 then
      perform public.raise_rate_limit('comments');
    end if;
    new.body := btrim(new.body);
    new.status := 'visible';
    new.report_count := 0;
    new.created_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_content(): file a report, learn whether the target got hidden
-- ---------------------------------------------------------------------------

create function public.report_content(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason public.report_reason,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_owner_id uuid;
  v_hidden boolean;
begin
  if v_uid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- The before-insert trigger checks the target and the reporter; a second report from the
  -- same account fails on reports_one_per_reporter (23505).
  insert into public.reports (reporter_id, target_type, target_id, reason, note)
  values (v_uid, p_target_type, p_target_id, p_reason, p_note);

  if p_target_type = 'project' then
    select p.id, p.owner_id, p.status = 'hidden' into v_project_id, v_owner_id, v_hidden
    from public.projects p where p.id = p_target_id;
  else
    select p.id, p.owner_id, c.status = 'hidden' into v_project_id, v_owner_id, v_hidden
    from public.comments c join public.projects p on p.id = c.project_id
    where c.id = p_target_id;
  end if;

  return jsonb_build_object(
    'project_id', v_project_id,
    'owner_id', v_owner_id,
    'target_hidden', coalesce(v_hidden, false)
  );
end;
$$;

revoke execute on function public.report_content(public.report_target, uuid, public.report_reason, text)
  from public, anon;
grant execute on function public.report_content(public.report_target, uuid, public.report_reason, text)
  to authenticated;

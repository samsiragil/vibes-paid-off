-- Row Level Security and privileges (§2.2 "RLS").
-- Privileges are granted per column so clients cannot write status, counters or review fields;
-- moderation goes through admin RPCs (Fase 8). service_role bypasses RLS and keeps full access.

-- ---------------------------------------------------------------------------
-- Start from nothing for client roles
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Functions clients may call directly or that policies/constraints evaluate.
grant execute on function
  public.is_admin(),
  public.is_https_url(text),
  public.is_reserved_username(text),
  public.username_available(text),
  public.wib_week_start(timestamptz),
  public.popular_this_week(integer, timestamptz),
  public.get_home_hero(timestamptz)
to anon, authenticated;

-- Owner check for child rows (sessions, media, tools, suggestions).
create function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = auth.uid() and p.status <> 'removed'
  );
$$;

revoke execute on function public.can_edit_project(uuid) from public, anon;
grant execute on function public.can_edit_project(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tools enable row level security;
alter table public.projects enable row level security;
alter table public.project_sessions enable row level security;
alter table public.project_media enable row level security;
alter table public.project_tools enable row level security;
alter table public.tool_suggestions enable row level security;
alter table public.upvotes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.weekly_picks enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: public columns readable by all; owner edits own profile fields
-- ---------------------------------------------------------------------------

grant select (
  id, username, display_name, avatar_url, bio, location, links, tip_url, is_trusted, created_at
) on public.profiles to anon, authenticated;
grant update (username, display_name, bio, location, links, tip_url) on public.profiles to authenticated;

create policy profiles_select_all on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

grant select on public.categories to anon, authenticated;

create policy categories_select_all on public.categories
  for select to anon, authenticated
  using (true);

grant select on public.tools to anon, authenticated;
grant insert (slug, name, url, logo_url, kind, description_id, description_en, is_active),
  update (slug, name, url, logo_url, kind, description_id, description_en, is_active)
  on public.tools to authenticated;

create policy tools_select_all on public.tools
  for select to anon, authenticated
  using (true);

create policy tools_insert_admin on public.tools
  for insert to authenticated
  with check ((select public.is_admin()));

create policy tools_update_admin on public.tools
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

grant select on public.projects to anon, authenticated;
grant insert (
  owner_id, slug, title, tagline, description, key_prompt, lessons,
  live_url, repo_url, video_url, category, content_lang
) on public.projects to authenticated;
grant update (
  title, tagline, description, key_prompt, lessons,
  live_url, repo_url, video_url, category, content_lang
) on public.projects to authenticated;

create policy projects_select_visible on public.projects
  for select to anon, authenticated
  using (
    status = 'published'
    or (owner_id = (select auth.uid()) and status <> 'removed')
    or (select public.is_admin())
  );

-- Username (onboarding) is required before submitting.
create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.username is not null
    )
  );

create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()) and status <> 'removed')
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Project children: readable when the project is readable, writable by its owner
-- ---------------------------------------------------------------------------

grant select on public.project_sessions to anon, authenticated;
grant insert (project_id, sort_order, label, duration_hours, prompt, result, challenge, solution),
  update (sort_order, label, duration_hours, prompt, result, challenge, solution),
  delete
  on public.project_sessions to authenticated;

create policy project_sessions_select on public.project_sessions
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy project_sessions_insert_owner on public.project_sessions
  for insert to authenticated
  with check (public.can_edit_project(project_id));

create policy project_sessions_update_owner on public.project_sessions
  for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

create policy project_sessions_delete_owner on public.project_sessions
  for delete to authenticated
  using (public.can_edit_project(project_id));

-- Media rows are inserted by the server after re-encoding (Fase 3).
grant select on public.project_media to anon, authenticated;
grant update (sort_order), delete on public.project_media to authenticated;

create policy project_media_select on public.project_media
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy project_media_update_owner on public.project_media
  for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

create policy project_media_delete_owner on public.project_media
  for delete to authenticated
  using (public.can_edit_project(project_id));

grant select on public.project_tools to anon, authenticated;
grant insert, delete on public.project_tools to authenticated;

create policy project_tools_select on public.project_tools
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy project_tools_insert_owner on public.project_tools
  for insert to authenticated
  with check (public.can_edit_project(project_id));

create policy project_tools_delete_owner on public.project_tools
  for delete to authenticated
  using (public.can_edit_project(project_id));

grant select on public.tool_suggestions to anon, authenticated;
grant insert (project_id, name, url), delete on public.tool_suggestions to authenticated;

-- Pending suggestions show as plain text on the project until an admin merges them.
create policy tool_suggestions_select on public.tool_suggestions
  for select to anon, authenticated
  using (
    suggested_by = (select auth.uid())
    or (select public.is_admin())
    or (status = 'pending' and exists (select 1 from public.projects p where p.id = project_id))
  );

create policy tool_suggestions_insert_owner on public.tool_suggestions
  for insert to authenticated
  with check (suggested_by = (select auth.uid()) and public.can_edit_project(project_id));

create policy tool_suggestions_delete_owner on public.tool_suggestions
  for delete to authenticated
  using (suggested_by = (select auth.uid()) and status = 'pending' and public.can_edit_project(project_id));

-- ---------------------------------------------------------------------------
-- Interactions: logged-in users, only for themselves
-- ---------------------------------------------------------------------------

grant select, insert (project_id), delete on public.upvotes to authenticated;

create policy upvotes_select_own on public.upvotes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy upvotes_insert_own on public.upvotes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
  );

create policy upvotes_delete_own on public.upvotes
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.comments to anon, authenticated;
grant insert (project_id, body), delete on public.comments to authenticated;

create policy comments_select_visible on public.comments
  for select to anon, authenticated
  using (
    (status = 'visible' and exists (
      select 1 from public.projects p where p.id = project_id and p.status = 'published'
    ))
    or user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
  );

create policy comments_delete_own on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert (target_type, target_id, reason, note) on public.reports to authenticated;

create policy reports_select_own_or_admin on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Weekly picks: public and auditable, written only by compute_weekly_pick()
-- ---------------------------------------------------------------------------

grant select on public.weekly_picks to anon, authenticated;

create policy weekly_picks_select_all on public.weekly_picks
  for select to anon, authenticated
  using (true);

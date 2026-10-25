-- The maker deletes their own project from /me, for good. Clients have no delete grant on
-- projects, so this is the only way in. Sessions, media rows, tools, upvotes, replies and tool
-- suggestions go with it (on delete cascade); a weekly pick keeps its row with project_id null.
-- Reports point at their target without a foreign key, so the ones about the project and its
-- replies are removed here. A project an admin removed stays (it is the moderation record).
-- Returns the media keys so the server can delete the files from R2.

create function public.delete_project(p_project_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[];
begin
  perform 1
  from public.projects p
  where p.id = p_project_id and p.owner_id = auth.uid() and p.status <> 'removed'
  for update;

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.r2_key), '{}') into v_keys
  from public.project_media m
  where m.project_id = p_project_id;

  delete from public.reports r
  where (r.target_type = 'project' and r.target_id = p_project_id)
    or (
      r.target_type = 'comment'
      and r.target_id in (select c.id from public.comments c where c.project_id = p_project_id)
    );

  delete from public.projects where id = p_project_id;

  return v_keys;
end;
$$;

revoke execute on function public.delete_project(uuid) from public, anon;
grant execute on function public.delete_project(uuid) to authenticated;

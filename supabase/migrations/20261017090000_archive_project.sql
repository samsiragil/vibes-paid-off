-- The maker archives or reactivates their own project from /me (Q8: "Diarsipkan" is set by the
-- maker, never automatically). link_status is not writable by clients (column grants), so this
-- is the only way in. Archiving keeps the page and its screenshots but stops linking to the app;
-- reactivating marks it live again and lets the weekly link checker (Fase 9) judge it afresh.
-- Returns the new link_status.

create function public.set_project_archived(p_project_id uuid, p_archived boolean)
returns public.link_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.link_status;
begin
  select p.link_status into v_link
  from public.projects p
  where p.id = p_project_id and p.owner_id = auth.uid() and p.status <> 'removed'
  for update;

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_archived and v_link <> 'archived' then
    update public.projects set link_status = 'archived' where id = p_project_id;
    v_link := 'archived';
  elsif not p_archived and v_link = 'archived' then
    update public.projects set link_status = 'live', link_fail_count = 0 where id = p_project_id;
    v_link := 'live';
  end if;

  return v_link;
end;
$$;

revoke execute on function public.set_project_archived(uuid, boolean) from public, anon;
grant execute on function public.set_project_archived(uuid, boolean) to authenticated;

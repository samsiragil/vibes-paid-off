-- assert_project_has_session() referenced old.project_id while firing for projects, where the
-- record has no such field. Branch per table so each trigger only touches its own record.
create or replace function public.assert_project_has_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  if tg_table_name = 'projects' then
    pid := new.id;
  else
    pid := old.project_id;
  end if;

  if exists (select 1 from public.projects where id = pid)
    and not exists (select 1 from public.project_sessions where project_id = pid)
  then
    raise exception 'project_sessions_required' using errcode = 'P0001', hint = 'A project needs at least one session.';
  end if;
  return null;
end;
$$;

revoke execute on function public.assert_project_has_session() from public, anon, authenticated;

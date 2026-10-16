-- Media ordering for the uploader (Fase 3).
--
-- sort_order stays compact (0..n-1): deleting an image shifts the rest down, so a new upload
-- always lands last, and reordering rewrites every position in one statement (the unique
-- (project_id, sort_order) constraint is deferred, so swaps do not collide mid-update).

create function public.reorder_project_media(p_project_id uuid, p_media_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_project(p_project_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;

  -- The new order must name every image of the project exactly once.
  if cardinality(p_media_ids) <> (select count(distinct x) from unnest(p_media_ids) x)
    or array(select x from unnest(p_media_ids) x order by x)
      <> array(select id from public.project_media where project_id = p_project_id order by id)
  then
    raise exception 'media_order_mismatch' using errcode = '22023', hint = 'Pass every image id of the project once.';
  end if;

  update public.project_media m
  set sort_order = o.position - 1
  from unnest(p_media_ids) with ordinality as o (id, position)
  where m.id = o.id and m.project_id = p_project_id;
end;
$$;

revoke execute on function public.reorder_project_media(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_project_media(uuid, uuid[]) to authenticated;

create function public.project_media_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing to compact when the whole project is being deleted.
  if exists (select 1 from public.projects where id = old.project_id) then
    update public.project_media m
    set sort_order = r.position - 1
    from (
      select id, row_number() over (order by sort_order) as position
      from public.project_media
      where project_id = old.project_id
    ) r
    where m.id = r.id and m.sort_order <> r.position - 1;
  end if;
  return null;
end;
$$;

revoke execute on function public.project_media_after_delete() from public, anon, authenticated;

create trigger project_media_after_delete
  after delete on public.project_media
  for each row execute function public.project_media_after_delete();

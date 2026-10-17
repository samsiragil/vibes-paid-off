-- Media ordering: reorder RPC and compaction after delete (Fase 3).

select tap.user('alice'), tap.user('bob');
select tap.project(tap.id('alice'), 'alice-live');
select tap.project(tap.id('bob'), 'bob-live');

insert into project_media (project_id, r2_key, width, height, bytes, sort_order)
select tap.id('alice-live'), 'test/alice-' || n, 10, 10, 10, n from generate_series(1, 2) n;

create function tap.media_keys(project uuid) returns text language sql stable as $$
  select string_agg(r2_key, ',' order by sort_order) from public.project_media where project_id = project;
$$;
grant execute on function tap.media_keys(uuid) to public;

insert into tap.ids
select 'm' || sort_order, id from project_media where project_id = tap.id('alice-live');

-- Reorder ---------------------------------------------------------------------
select tap.as_user(tap.id('alice'));
select reorder_project_media(tap.id('alice-live'), array[tap.id('m2'), tap.id('m0'), tap.id('m1')]);
select tap.emit(is(
  tap.media_keys(tap.id('alice-live')),
  'test/alice-2,test/' || tap.id('alice-live') || '.webp,test/alice-1',
  'owner: reorders own images'
));

select tap.emit(throws_ok(
  $$ select reorder_project_media(tap.id('alice-live'), array[tap.id('m2'), tap.id('m0')]) $$,
  '22023', 'media_order_mismatch', 'owner: reorder must list every image'
));
select tap.emit(throws_ok(
  $$ select reorder_project_media(tap.id('alice-live'), array[tap.id('m2'), tap.id('m2'), tap.id('m0')]) $$,
  '22023', 'media_order_mismatch', 'owner: reorder rejects duplicates'
));

select tap.as_user(tap.id('bob'));
select tap.emit(throws_ok(
  $$ select reorder_project_media(tap.id('alice-live'), array[tap.id('m0'), tap.id('m1'), tap.id('m2')]) $$,
  '42501', 'not_allowed', 'other user: cannot reorder'
));

select tap.as_anon();
select tap.emit(throws_ok(
  $$ select reorder_project_media(tap.id('alice-live'), array[tap.id('m0'), tap.id('m1'), tap.id('m2')]) $$,
  '42501', null, 'anon: cannot call reorder'
));

-- Delete compacts the order ---------------------------------------------------
select tap.as_user(tap.id('alice'));
delete from project_media where id = tap.id('m2');
select tap.emit(results_eq(
  $$ select sort_order::int from project_media where project_id = tap.id('alice-live') order by sort_order $$,
  $$ values (0), (1) $$,
  'delete: remaining images shift down'
));

select tap.as_postgres();
insert into project_media (project_id, r2_key, width, height, bytes, sort_order)
values (tap.id('alice-live'), 'test/alice-new', 10, 10, 10, 2);
select tap.emit(is(
  split_part(tap.media_keys(tap.id('alice-live')), ',', 3), 'test/alice-new', 'new image lands last'
));

select tap.as_user(tap.id('bob'));
delete from project_media where project_id = tap.id('alice-live');
select tap.as_postgres();
select tap.emit(is(
  (select count(*)::int from project_media where project_id = tap.id('alice-live')), 3,
  'other user: cannot delete images'
));

delete from projects where id = tap.id('bob-live');
select tap.emit(is(
  (select count(*)::int from project_media where project_id = tap.id('bob-live')), 0,
  'project delete cascades its images'
));

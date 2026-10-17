-- Maker archives / reactivates their own project through set_project_archived (Q8).

select tap.user('alice'), tap.user('bob');
select tap.project(tap.id('alice'), 'kasir');
select tap.project(tap.id('alice'), 'pending-one', 'pending');
select tap.project(tap.id('alice'), 'gone', 'removed');
update projects set link_status = 'offline', link_fail_count = 3 where id = tap.id('kasir');

-- Owner ----------------------------------------------------------------------------
select tap.as_user(tap.id('alice'));
select tap.emit(is(
  set_project_archived(tap.id('kasir'), true)::text, 'archived', 'owner archives a published project'
));
select tap.emit(is(
  (select link_status::text from projects where id = tap.id('kasir')), 'archived', 'link_status stored'
));
select tap.emit(is(
  set_project_archived(tap.id('kasir'), true)::text, 'archived', 'archiving twice is a no-op'
));
select tap.emit(is(
  set_project_archived(tap.id('kasir'), false)::text, 'live', 'owner reactivates it'
));
select tap.emit(results_eq(
  $$ select link_status::text, link_fail_count::int, status::text from projects where id = tap.id('kasir') $$,
  $$ values ('live', 0, 'published') $$,
  'reactivated: live, fail count reset, status unchanged'
));
select tap.emit(is(
  set_project_archived(tap.id('pending-one'), true)::text, 'archived', 'works for a project still in review'
));
select tap.emit(is(
  (select status::text from projects where id = tap.id('pending-one')), 'pending', 'review status untouched'
));
select tap.emit(throws_ok(
  $$ select set_project_archived(tap.id('gone'), true) $$,
  '42501', 'not_allowed', 'removed project refused'
));
select tap.emit(throws_ok(
  $$ update projects set link_status = 'archived' where id = tap.id('kasir') $$,
  '42501', null, 'link_status still not writable directly'
));

-- Others ---------------------------------------------------------------------------
select tap.as_user(tap.id('bob'));
select tap.emit(throws_ok(
  $$ select set_project_archived(tap.id('kasir'), true) $$,
  '42501', 'not_allowed', 'another user cannot archive it'
));
select tap.emit(throws_ok(
  $$ select set_project_archived(gen_random_uuid(), true) $$,
  '42501', 'not_allowed', 'unknown project refused'
));

select tap.as_anon();
select tap.emit(throws_ok(
  $$ select set_project_archived(tap.id('kasir'), true) $$,
  '42501', null, 'anon cannot call it'
));

select tap.as_postgres();
select tap.emit(is(
  (select link_status::text from projects where id = tap.id('kasir')), 'live', 'refused calls changed nothing'
));

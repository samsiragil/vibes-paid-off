-- Maker deletes their own project through delete_project.

select tap.user('alice'), tap.user('bob');
select tap.project(tap.id('alice'), 'kasir');
select tap.project(tap.id('alice'), 'draft', 'pending', with_media => false);
select tap.project(tap.id('alice'), 'gone', 'removed');
select tap.project(tap.id('alice'), 'resep');

-- Interactions on kasir as postgres (fixtures, not under test here).
select tap.vote(tap.id('bob'), tap.id('kasir'), '2029-12-02');
select tap.reply(tap.id('bob'), tap.id('kasir'), '2029-12-02');
insert into reports (reporter_id, target_type, target_id, reason)
values
  (tap.id('bob'), 'project', tap.id('kasir'), 'spam'),
  (tap.id('bob'), 'comment', (select id from comments where project_id = tap.id('kasir')), 'spam'),
  (tap.id('bob'), 'project', tap.id('resep'), 'spam');
insert into weekly_picks (week_start, project_id, score) values ('2029-12-10', tap.id('kasir'), 9);

-- Others ---------------------------------------------------------------------------
select tap.as_user(tap.id('bob'));
select tap.emit(throws_ok(
  $$ select delete_project(tap.id('kasir')) $$,
  '42501', 'not_allowed', 'another user cannot delete it'
));
select tap.emit(throws_ok(
  $$ select delete_project(gen_random_uuid()) $$,
  '42501', 'not_allowed', 'unknown project refused'
));
select tap.emit(throws_ok(
  $$ delete from projects where id = tap.id('kasir') $$,
  '42501', null, 'projects still not deletable directly'
));

select tap.as_anon();
select tap.emit(throws_ok(
  $$ select delete_project(tap.id('kasir')) $$,
  '42501', null, 'anon cannot call it'
));

-- Owner ----------------------------------------------------------------------------
select tap.as_user(tap.id('alice'));
select tap.emit(throws_ok(
  $$ select delete_project(tap.id('gone')) $$,
  '42501', 'not_allowed', 'removed project refused (moderation record)'
));
select tap.emit(is(
  delete_project(tap.id('kasir')),
  array['test/' || tap.id('kasir') || '.webp'],
  'owner deletes a published project and gets its media keys back'
));
select tap.emit(is(
  delete_project(tap.id('draft')), '{}'::text[], 'a project in review without media returns no keys'
));
select tap.emit(throws_ok(
  $$ select delete_project(tap.id('kasir')) $$,
  '42501', 'not_allowed', 'deleting twice is refused'
));

select tap.as_postgres();
select tap.emit(results_eq(
  $$ select
       (select count(*)::int from projects where id in (tap.id('kasir'), tap.id('draft'))),
       (select count(*)::int from project_sessions where project_id = tap.id('kasir')),
       (select count(*)::int from project_media where project_id = tap.id('kasir')),
       (select count(*)::int from upvotes where project_id = tap.id('kasir')),
       (select count(*)::int from comments where project_id = tap.id('kasir')) $$,
  $$ values (0, 0, 0, 0, 0) $$,
  'project and its children are gone'
));
select tap.emit(is(
  (select count(*)::int from reports where reporter_id = tap.id('bob') and target_id <> tap.id('resep')), 0,
  'reports about the project and its replies are gone'
));
select tap.emit(is(
  (select count(*)::int from reports where reporter_id = tap.id('bob') and target_id = tap.id('resep')), 1,
  'other reports untouched'
));
select tap.emit(results_eq(
  $$ select project_id from weekly_picks where week_start = '2029-12-10' $$,
  $$ values (null::uuid) $$,
  'weekly pick row kept without the project'
));
select tap.emit(is(
  (select count(*)::int from projects where id in (tap.id('resep'), tap.id('gone'))), 2,
  'other projects untouched'
));

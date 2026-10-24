-- Weekly link checker verdicts through record_link_checks (Q8), and live_url edits.

select tap.user('alice'), tap.user('bob');
select tap.project(tap.id('alice'), 'kasir');
select tap.project(tap.id('alice'), 'toko');
select tap.project(tap.id('alice'), 'mati');
select tap.project(tap.id('alice'), 'arsip');
select tap.project(tap.id('alice'), 'antre', 'pending');
update projects set link_fail_count = 1 where id = tap.id('toko');
update projects set link_status = 'offline', link_fail_count = 4 where id = tap.id('mati');
update projects set link_status = 'archived', link_fail_count = 2 where id = tap.id('arsip');

create function tap.check(project uuid, ok boolean) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('id', project, 'ok', ok));
$$;
grant execute on function tap.check(uuid, boolean) to public;

-- Who may call it ------------------------------------------------------------------------
select tap.as_anon();
select tap.emit(throws_ok(
  format('select record_link_checks(%L)', tap.check(tap.id('kasir'), false)), '42501', null, 'anon cannot report'
));
select tap.as_user(tap.id('alice'));
select tap.emit(throws_ok(
  format('select record_link_checks(%L)', tap.check(tap.id('kasir'), false)), '42501', null,
  'a maker cannot report, not even for their own project'
));

-- Failures: the second one in a row goes offline ----------------------------------------
select tap.as_service();
select tap.emit(results_eq(
  format('select link_status::text, link_fail_count::int, changed from record_link_checks(%L)', tap.check(tap.id('kasir'), false)),
  $$ values ('live', 1, false) $$, 'first failure: still live, count 1'
));
select tap.emit(results_eq(
  format('select link_status::text, link_fail_count::int, changed from record_link_checks(%L)', tap.check(tap.id('kasir'), false)),
  $$ values ('offline', 2, true) $$, 'second failure in a row: offline'
));
select tap.emit(results_eq(
  format('select link_status::text, link_fail_count::int, changed from record_link_checks(%L)', tap.check(tap.id('kasir'), false)),
  $$ values ('offline', 3, false) $$, 'more failures: stays offline, count keeps going'
));
select tap.emit(results_eq(
  format('select link_status::text, link_fail_count::int, changed from record_link_checks(%L)', tap.check(tap.id('kasir'), true)),
  $$ values ('live', 0, true) $$, 'one success: live again, count reset'
));
select tap.emit(results_eq(
  format('select link_status::text, link_fail_count::int, changed from record_link_checks(%L)', tap.check(tap.id('kasir'), false)),
  $$ values ('live', 1, false) $$, 'failures must be in a row: after a success it starts at 1 again'
));

select tap.as_postgres();
select tap.emit(ok(
  (select last_checked_at > now() - interval '1 minute' from projects where id = tap.id('kasir')),
  'last_checked_at stamped'
));
select tap.emit(ok(
  (select updated_at < now() - interval '1 day' from projects where id = tap.id('kasir')),
  'a check is not an edit: updated_at untouched'
));

-- Several at once, archived and unpublished ones skipped ---------------------------------
select tap.as_service();
select tap.emit(results_eq(
  format(
    'select project_id, link_status::text, link_fail_count::int, changed from record_link_checks(%L) order by 2, 1',
    jsonb_build_array(
      jsonb_build_object('id', tap.id('toko'), 'ok', false),
      jsonb_build_object('id', tap.id('mati'), 'ok', true),
      jsonb_build_object('id', tap.id('arsip'), 'ok', false),
      jsonb_build_object('id', tap.id('antre'), 'ok', false),
      jsonb_build_object('id', gen_random_uuid(), 'ok', false)
    )
  ),
  format(
    'values (%L::uuid, %L, 0, true), (%L::uuid, %L, 2, true)',
    tap.id('mati'), 'live', tap.id('toko'), 'offline'
  ),
  'batch: toko goes offline, mati comes back; archived, pending and unknown ids are skipped'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select link_status::text, link_fail_count::int, last_checked_at is null from projects where id = tap.id('arsip') $$,
  $$ values ('archived', 2, true) $$, 'archived project untouched'
));
select tap.emit(results_eq(
  $$ select link_status::text, link_fail_count::int, last_checked_at is null from projects where id = tap.id('antre') $$,
  $$ values ('live', 0, true) $$, 'pending project untouched'
));

select tap.as_service();
select tap.emit(results_eq(
  format(
    'select link_fail_count::int from record_link_checks(%L)',
    jsonb_build_array(
      jsonb_build_object('id', tap.id('mati'), 'ok', false),
      jsonb_build_object('id', tap.id('mati'), 'ok', true)
    )
  ),
  $$ values (1) $$, 'a duplicated id counts once, first verdict wins'
));
select tap.emit(results_eq(
  'select count(*)::int from record_link_checks(''[]'')', $$ values (0) $$, 'empty batch is a no-op'
));
select tap.emit(throws_ok(
  $$ select record_link_checks('{"id": "x"}') $$, '22023', 'invalid_results', 'not an array: refused'
));
select tap.emit(throws_ok(
  format('select record_link_checks(%L)', jsonb_build_array(jsonb_build_object('id', tap.id('mati'), 'ok', 'yes'))),
  '22023', 'invalid_results', 'ok must be a boolean'
));
select tap.emit(throws_ok(
  $$ select record_link_checks('[{"ok": true}]') $$, '22023', 'invalid_results', 'id is required'
));

-- A new live_url starts again -----------------------------------------------------------
select tap.as_postgres();
update projects set link_status = 'offline', link_fail_count = 5, last_checked_at = now() where id = tap.id('toko');
select tap.as_user(tap.id('alice'));
update projects set live_url = 'https://example.com/toko-baru' where id = tap.id('toko');
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select link_status::text, link_fail_count::int, last_checked_at is null from projects where id = tap.id('toko') $$,
  $$ values ('live', 0, true) $$, 'owner changes live_url: live again, count and check time cleared'
));

select tap.as_user(tap.id('alice'));
update projects set tagline = 'Tagline baru' where id = tap.id('kasir');
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select link_status::text, link_fail_count::int, last_checked_at is not null from projects where id = tap.id('kasir') $$,
  $$ values ('live', 1, true) $$, 'other edits keep the link verdict'
));

select tap.as_user(tap.id('alice'));
update projects set live_url = 'https://example.com/arsip-baru' where id = tap.id('arsip');
select tap.as_postgres();
select tap.emit(is(
  (select link_status::text from projects where id = tap.id('arsip')), 'archived',
  'a new live_url does not unarchive (that is the maker''s button)'
));

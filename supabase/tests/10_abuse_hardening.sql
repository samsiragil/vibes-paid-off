-- Security audit run-1, stage 2: report weighting, report and reply quotas, hidden moderation
-- columns and https-only profile links. (The quota locks only show with two concurrent sessions,
-- which this single-transaction runner cannot open.)

select tap.user('maker'), tap.user('old1'), tap.user('old2'), tap.user('old3'), tap.user('old4');
select tap.user('new1', created => now()), tap.user('new2', created => now()), tap.user('new3', created => now());
select tap.user('nameless', with_username => false);
select tap.user('spammer');
select tap.project(tap.id('maker'), 'target');
select tap.project(tap.id('maker'), 'target-2');

-- Fresh accounts report, nothing gets hidden ------------------------------------------
select tap.as_user(tap.id('new1'));
select report_content('project', tap.id('target'), 'spam');
select tap.as_user(tap.id('new2'));
select report_content('project', tap.id('target'), 'spam');
select tap.as_user(tap.id('new3'));
select tap.emit(is(
  report_content('project', tap.id('target'), 'spam')->>'target_hidden', 'false',
  'weighting: three accounts younger than 72 hours do not hide a project'
));
select tap.as_user(tap.id('nameless'));
select tap.emit(is(
  report_content('project', tap.id('target'), 'spam')->>'target_hidden', 'false',
  'weighting: an account without a username does not count either'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select report_count, status::text from projects where id = tap.id('target') $$,
  $$ values (4, 'published') $$,
  'weighting: every report still reaches the admin queue'
));

-- Established accounts still hide it ----------------------------------------------------
select tap.as_user(tap.id('old1'));
select report_content('project', tap.id('target'), 'spam');
select tap.as_user(tap.id('old2'));
select report_content('project', tap.id('target'), 'spam');
select tap.as_user(tap.id('old3'));
select tap.emit(is(
  report_content('project', tap.id('target'), 'spam')->>'target_hidden', 'true',
  'weighting: the third established account hides the project'
));

-- After "keep", resolved reports stop counting -----------------------------------------
select tap.as_postgres();
update reports set resolved = true, resolution = 'keep' where target_id = tap.id('target');
update projects set status = 'published', report_count = 0 where id = tap.id('target');
select tap.as_user(tap.id('old4'));
select tap.emit(is(
  report_content('project', tap.id('target'), 'spam')->>'target_hidden', 'false',
  'weighting: one new report after keep does not re-hide on old reports'
));

-- Report quota: 10 per 24 hours -----------------------------------------------------------
select tap.as_postgres();
insert into comments (project_id, user_id, body)
select tap.id('target-2'), tap.id('maker'), 'Dilaporkan ' || n from generate_series(1, 10) n;
insert into reports (reporter_id, target_type, target_id, reason)
select tap.id('spammer'), 'comment', c.id, 'spam'
from comments c where c.body like 'Dilaporkan %';
select tap.as_user(tap.id('spammer'));
select tap.emit(throws_like(
  $$ select report_content('project', tap.id('target-2'), 'spam') $$, 'rate_limit:reports%',
  'report quota: the 11th report in 24 hours is refused'
));

-- Reply quota survives deletes --------------------------------------------------------------
select tap.as_postgres();
insert into comments (project_id, user_id, body)
select tap.id('target-2'), tap.id('old1'), 'Balasan lama ' || n from generate_series(1, 30) n;
select tap.as_user(tap.id('old1'));
delete from comments where user_id = tap.id('old1');
select tap.emit(is(
  (select count(*)::int from comments where user_id = tap.id('old1')), 0, 'reply quota: replies deleted'
));
select tap.as_service();
select tap.emit(throws_like(
  $$ select post_reply_as(tap.id('old1'), tap.id('target-2'), 'Lagi') $$, 'rate_limit:comments%',
  'reply quota: deleting replies does not free the daily slots'
));
select tap.as_user(tap.id('old1'));
select tap.emit(throws_ok(
  $$ select * from reply_quota_log $$, '42501', null, 'reply quota: the log is not readable by users'
));

-- Moderation columns are not readable through the Data API -------------------------------
select tap.as_anon();
select tap.emit(throws_ok(
  $$ select reviewed_by from projects limit 1 $$, '42501', null, 'columns: reviewed_by hidden from anon'
));
select tap.emit(throws_ok(
  $$ select report_count from projects limit 1 $$, '42501', null, 'columns: report_count hidden from anon'
));
select tap.emit(throws_ok(
  $$ select report_count from comments limit 1 $$, '42501', null, 'columns: reply report_count hidden'
));
select tap.as_user(tap.id('maker'));
select tap.emit(throws_ok(
  $$ select link_fail_count from projects where owner_id = tap.id('maker') $$, '42501', null,
  'columns: link_fail_count hidden even from the owner'
));
select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('target-2') and slug = 'tst-target-2'), 1,
  'columns: public columns still readable'
));

-- profiles.links: https only ----------------------------------------------------------------
select tap.emit(lives_ok(
  $$ update profiles set links = '{"github": "https://github.com/maker"}' where id = tap.id('maker') $$,
  'links: https URL accepted'
));
select tap.emit(throws_ok(
  $$ update profiles set links = '{"website": "javascript:alert(1)"}' where id = tap.id('maker') $$,
  '23514', null, 'links: non-https URL refused'
));
select tap.emit(throws_ok(
  $$ update profiles set links = '{"website": 1}' where id = tap.id('maker') $$,
  '23514', null, 'links: non-string value refused'
));

-- Fase 7: Worth it, replies and reports as the app uses them (direct inserts/deletes under RLS
-- and report_content()), including the end-to-end auto-hide after three different reporters.

select tap.user('maker'), tap.user('r1'), tap.user('r2'), tap.user('r3'), tap.user('r4');
select tap.user('nameless', with_username => false);
select tap.project(tap.id('maker'), 'kasir');
select tap.project(tap.id('maker'), 'in-review', status => 'pending');
select tap.project(tap.id('maker'), 'resep');

-- Worth it -------------------------------------------------------------------------
select tap.as_user(tap.id('r1'));
insert into upvotes (project_id) values (tap.id('kasir'));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('kasir')) $$, '23505', null,
  'vote: one per account (second insert refused)'
));
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('kasir')), 1, 'vote: counter is 1 after a double click'
));
select tap.emit(is(
  (select count(*)::int from upvotes where project_id = tap.id('kasir')), 1, 'vote: voter sees their own vote'
));
select tap.as_user(tap.id('r2'));
insert into upvotes (project_id) values (tap.id('kasir'));
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('kasir')), 2, 'vote: second account counts'
));
delete from upvotes where project_id = tap.id('kasir');
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('kasir')), 1, 'vote: withdrawing lowers the counter'
));
delete from upvotes where project_id = tap.id('kasir');
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('kasir')), 1, 'vote: withdrawing twice is a no-op'
));
select tap.as_user(tap.id('r1'));
delete from upvotes where project_id = tap.id('kasir') and user_id = tap.id('r2');
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('kasir')), 1, 'vote: cannot withdraw someone else''s vote'
));
select tap.as_user(tap.id('maker'));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('kasir')) $$, 'P0001', 'upvote_own_project',
  'vote: maker cannot vote their own project (Q13)'
));

-- Replies --------------------------------------------------------------------------
select tap.as_user(tap.id('r1'));
select tap.emit(lives_ok(
  $$ insert into comments (project_id, body) values (tap.id('kasir'), '  Keren banget!  ') $$,
  'reply: user can reply'
));
select tap.emit(results_eq(
  $$ select body, status::text from comments where project_id = tap.id('kasir') and user_id = tap.id('r1') $$,
  $$ values ('Keren banget!', 'visible') $$, 'reply: body trimmed, visible'
));
select tap.emit(is(
  (select comment_count from projects where id = tap.id('kasir')), 1, 'reply: comment_count follows'
));
select tap.emit(throws_ok(
  $$ insert into comments (project_id, body) values (tap.id('kasir'), '   ') $$, '23514', null,
  'reply: blank body refused'
));
select tap.emit(throws_ok(
  $$ insert into comments (project_id, body) values (tap.id('in-review'), 'Halo') $$, '42501', null,
  'reply: not on a project in review'
));
select tap.as_user(tap.id('maker'));
select tap.emit(lives_ok(
  $$ insert into comments (project_id, body) values (tap.id('kasir'), 'Makasih!') $$,
  'reply: maker can answer on their own project'
));
select tap.as_user(tap.id('nameless'));
select tap.emit(throws_ok(
  $$ insert into comments (project_id, body) values (tap.id('kasir'), 'Halo') $$, '42501', 'username_required',
  'reply: needs a username'
));

-- Deleting: only your own.
select tap.as_user(tap.id('r2'));
delete from comments where project_id = tap.id('kasir') and user_id = tap.id('r1');
select tap.emit(is(
  (select comment_count from projects where id = tap.id('kasir')), 2, 'reply: cannot delete someone else''s reply'
));
select tap.as_user(tap.id('r1'));
delete from comments where project_id = tap.id('kasir') and user_id = tap.id('r1');
select tap.emit(is(
  (select comment_count from projects where id = tap.id('kasir')), 1, 'reply: author deletes own reply, counter drops'
));

-- Rate limit: 30 replies per 24 hours.
select tap.as_postgres();
insert into comments (project_id, user_id, body)
select tap.id('resep'), tap.id('r4'), 'Balasan ' || n from generate_series(1, 30) n;
select tap.as_user(tap.id('r4'));
select tap.emit(throws_like(
  $$ insert into comments (project_id, body) values (tap.id('resep'), 'Ke-31') $$, 'rate_limit:comments%',
  'reply: 31st reply in 24 hours refused'
));

-- Reports --------------------------------------------------------------------------
select tap.as_anon();
select tap.emit(throws_ok(
  $$ select report_content('project', tap.id('kasir'), 'spam') $$, '42501', null,
  'report: anon cannot call report_content'
));

select tap.as_user(tap.id('maker'));
select tap.emit(throws_ok(
  $$ select report_content('project', tap.id('kasir'), 'spam') $$, 'P0001', 'report_own_content',
  'report: maker cannot report own project'
));
select tap.emit(throws_ok(
  $$ insert into reports (target_type, target_id, reason) values ('project', tap.id('kasir'), 'spam') $$,
  'P0001', 'report_own_content', 'report: direct insert has the same rule'
));

select tap.as_user(tap.id('r1'));
select tap.emit(throws_ok(
  $$ select report_content('project', tap.id('in-review'), 'spam') $$, 'P0001', 'report_target_not_found',
  'report: project in review cannot be reported'
));
select tap.emit(throws_ok(
  $$ select report_content('project', gen_random_uuid(), 'spam') $$, 'P0001', 'report_target_not_found',
  'report: unknown id'
));
select tap.emit(is(
  report_content('project', tap.id('kasir'), 'spam', '  promosi judi  ')->>'target_hidden', 'false',
  'report: first report, still visible'
));
select tap.emit(is(
  (select note from reports where reporter_id = tap.id('r1') and target_id = tap.id('kasir')), 'promosi judi',
  'report: note trimmed'
));
select tap.emit(throws_ok(
  $$ select report_content('project', tap.id('kasir'), 'scam') $$, '23505', null,
  'report: same account twice refused'
));
select tap.emit(is(
  (select report_count from projects where id = tap.id('kasir')), 1, 'report: duplicate not counted'
));

select tap.as_user(tap.id('r2'));
select tap.emit(is(
  report_content('project', tap.id('kasir'), 'scam')->>'target_hidden', 'false',
  'report: second account, still visible'
));
select tap.as_user(tap.id('r3'));
select tap.emit(results_eq(
  $$ select r->>'target_hidden', (r->>'project_id')::uuid, (r->>'owner_id')::uuid
     from report_content('project', tap.id('kasir'), 'other') r $$,
  $$ values ('true', tap.id('kasir'), tap.id('maker')) $$,
  'report: third account hides the project and says so'
));
select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('kasir')), 0, 'report: hidden project gone for users'
));
select tap.as_anon();
select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('kasir')), 0, 'report: hidden project gone for anon'
));
select tap.emit(is(
  (select count(*)::int from comments where project_id = tap.id('kasir')), 0,
  'report: replies of a hidden project are not public'
));
select tap.as_user(tap.id('r4'));
select tap.emit(throws_ok(
  $$ select report_content('project', tap.id('kasir'), 'spam') $$, 'P0001', 'report_target_not_found',
  'report: hidden project cannot be reported further'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('kasir')) $$, '42501', null,
  'vote: not on a hidden project'
));
select tap.as_user(tap.id('maker'));
select tap.emit(is(
  (select status::text from projects where id = tap.id('kasir')), 'hidden', 'report: owner still sees it, hidden'
));

-- Reporting a reply: three accounts hide it and the counter drops.
select tap.as_user(tap.id('r1'));
insert into comments (project_id, body) values (tap.id('resep'), 'Beli followers di sini');
insert into tap.ids select 'spam-reply', id from comments where body = 'Beli followers di sini';
select tap.as_user(tap.id('r1'));
select tap.emit(throws_ok(
  format($$ select report_content('comment', %L, 'spam') $$, tap.id('spam-reply')), 'P0001', 'report_own_content',
  'report: cannot report own reply'
));
select tap.as_postgres();
select tap.emit(is(
  (select comment_count from projects where id = tap.id('resep')), 31, 'reply report: starting count'
));
select tap.as_user(tap.id('r2'));
select tap.emit(is(
  report_content('comment', tap.id('spam-reply'), 'spam')->>'project_id', tap.id('resep')::text,
  'reply report: returns the project id'
));
select tap.as_user(tap.id('r3'));
select report_content('comment', tap.id('spam-reply'), 'spam');
select tap.as_user(tap.id('maker'));
select tap.emit(is(
  report_content('comment', tap.id('spam-reply'), 'harassment')->>'target_hidden', 'true',
  'reply report: third account (the maker may report replies) hides it'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select c.status::text, p.comment_count from comments c join projects p on p.id = c.project_id
     where c.id = tap.id('spam-reply') $$,
  $$ values ('hidden', 30) $$, 'reply report: hidden, comment_count drops'
));
select tap.as_user(tap.id('r4'));
select tap.emit(throws_ok(
  format($$ select report_content('comment', %L, 'spam') $$, tap.id('spam-reply')), 'P0001', 'report_target_not_found',
  'reply report: hidden reply cannot be reported further'
));

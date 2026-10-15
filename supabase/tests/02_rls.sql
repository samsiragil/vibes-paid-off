-- RLS, column privileges and moderation triggers, as anon, a user and an admin.

select tap.user('alice'), tap.user('bob'), tap.user('carol'), tap.user('dave'), tap.user('admin');
select tap.user('nousername', with_username => false);
update profiles set is_admin = true where id = tap.id('admin');

select tap.project(tap.id('alice'), 'alice-live');
select tap.project(tap.id('alice'), 'alice-pending', status => 'pending');
select tap.project(tap.id('bob'), 'bob-live');
select tap.reply(tap.id('bob'), tap.id('alice-live'), now());
insert into comments (project_id, user_id, body, status)
values (tap.id('alice-live'), tap.id('carol'), 'Disembunyikan', 'hidden');

-- Anon ------------------------------------------------------------------------
select tap.as_anon();

select tap.emit(is(
  (select count(*)::int from projects where id in (tap.id('alice-live'), tap.id('alice-pending'))), 1,
  'anon: reads published, not pending'
));
select tap.emit(is(
  (select count(*)::int from project_sessions where project_id = tap.id('alice-pending')), 0,
  'anon: sessions of a pending project are hidden'
));
select tap.emit(is(
  (select count(*)::int from comments where project_id = tap.id('alice-live')), 1,
  'anon: hidden comments are not visible'
));
select tap.emit(throws_ok(
  $$ select is_admin from profiles limit 1 $$, '42501', null, 'anon: profiles.is_admin is not readable'
));
select tap.emit(lives_ok(
  $$ select username, display_name, is_trusted from profiles limit 1 $$, 'anon: public profile columns are readable'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('alice-live')) $$, '42501', null, 'anon: cannot vote'
));
select tap.emit(is(
  (select count(*)::int from tools) > 100, true, 'anon: tools catalog is readable'
));
select tap.emit(ok(username_available('vibe_maker'), 'anon: username_available for a free name'));
select tap.emit(ok(not username_available('tst_alice'), 'username_available: taken name'));
select tap.emit(ok(not username_available('admin'), 'username_available: reserved name'));
select tap.emit(ok(not username_available('Ab'), 'username_available: bad format'));

-- Bob (another user) --------------------------------------------------------------
select tap.as_user(tap.id('bob'));

select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('alice-pending')), 0,
  'user: cannot read someone else''s pending project'
));
update projects set title = 'Dibajak' where id = tap.id('alice-live');
select tap.emit(is(
  (select title from projects where id = tap.id('alice-live')), 'Test alice-live',
  'user: cannot edit someone else''s project'
));
update profiles set display_name = 'Dibajak' where id = tap.id('alice');
select tap.emit(is(
  (select display_name from profiles where id = tap.id('alice')), 'Test alice',
  'user: cannot edit someone else''s profile'
));
select tap.emit(lives_ok(
  $$ insert into upvotes (project_id) values (tap.id('alice-live')) $$, 'user: can vote'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('alice-live')) $$, '23505', null, 'user: one vote per project'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('bob-live')) $$, 'P0001', 'upvote_own_project', 'user: cannot vote own project'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (project_id) values (tap.id('alice-pending')) $$, '42501', null, 'user: cannot vote a pending project'
));
select tap.emit(throws_ok(
  $$ insert into upvotes (user_id, project_id) values (tap.id('carol'), tap.id('alice-live')) $$,
  '42501', null, 'user: cannot vote on behalf of someone else'
));
select tap.emit(throws_ok(
  $$ insert into comments (project_id, user_id, body) values (tap.id('alice-live'), tap.id('carol'), 'Palsu') $$,
  '42501', null, 'user: cannot comment as someone else'
));
select tap.emit(lives_ok(
  $$ insert into reports (target_type, target_id, reason) values ('project', tap.id('alice-live'), 'spam') $$,
  'user: can report'
));
select tap.emit(throws_ok(
  $$ insert into reports (target_type, target_id, reason) values ('project', tap.id('alice-live'), 'scam') $$,
  '23505', null, 'user: one report per target'
));

-- Alice (owner) --------------------------------------------------------------------
select tap.as_user(tap.id('alice'));

select tap.emit(is(
  (select status::text from projects where id = tap.id('alice-pending')), 'pending',
  'owner: reads own pending project'
));
select tap.emit(throws_ok(
  $$ update projects set status = 'published' where id = tap.id('alice-pending') $$, '42501', null,
  'owner: cannot change status'
));
select tap.emit(throws_ok(
  $$ update projects set upvote_count = 999 where id = tap.id('alice-live') $$, '42501', null,
  'owner: cannot change counters'
));
select tap.emit(throws_ok(
  $$ update profiles set is_trusted = true where id = tap.id('alice') $$, '42501', null,
  'owner: cannot make themselves trusted'
));
select tap.emit(throws_ok(
  $$ update profiles set is_admin = true where id = tap.id('alice') $$, '42501', null,
  'owner: cannot make themselves admin'
));
update projects set title = 'Judul baru' where id = tap.id('alice-live');
select tap.emit(is(
  (select title from projects where id = tap.id('alice-live')), 'Judul baru', 'owner: edits content'
));
select tap.emit(is(
  (select count(*)::int from upvotes), 0, 'owner: does not see other users'' votes'
));
select tap.emit(is(
  (select count(*)::int from reports), 0, 'owner: does not see reports by others'
));
select tap.emit(ok(not is_admin(), 'owner: is_admin() is false'));

-- New untrusted project lands in pending, even when the client asks for published.
insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
values (tap.id('alice'), 'tst-alice-new', 'Baru', 'Tagline', 'Prompt', 'https://example.com', 'other');
insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
select id, 0, 1.5, 'Sesi satu', 'Jadi' from projects where slug = 'tst-alice-new';
insert into project_sessions (project_id, sort_order, duration_hours, prompt, result, label)
select id, 1, 3, 'Sesi dua kata unikzebra', 'Jadi', 'Sabtu malam' from projects where slug = 'tst-alice-new';

select tap.emit(results_eq(
  $$ select status::text, build_time_hours, session_count::int from projects where slug = 'tst-alice-new' $$,
  $$ values ('pending', 4.5::numeric, 2) $$,
  'insert: untrusted maker goes to pending; build time and session count are derived'
));
select tap.emit(ok(
  (select search @@ to_tsquery('simple', 'unikzebra') from projects where slug = 'tst-alice-new'),
  'search includes session prompts'
));
select tap.emit(throws_ok(
  $$ insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
     select id, 2, 1.25, 'x', 'y' from projects where slug = 'tst-alice-new' $$,
  '23514', null, 'session duration must be a multiple of 0.5'
));
select tap.emit(throws_ok(
  $$ insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
     select tap.id('bob-live'), 5, 1, 'x', 'y' $$,
  '42501', null, 'owner: cannot add sessions to someone else''s project'
));
select tap.emit(throws_ok(
  $$ insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category, status)
     values (tap.id('alice'), 'tst-x', 'x', 'x', 'x', 'https://example.com', 'other', 'published') $$,
  '42501', null, 'insert: client cannot set status'
));
select tap.emit(throws_ok(
  $$ insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
     values (tap.id('bob'), 'tst-y', 'y', 'y', 'y', 'https://example.com', 'other') $$,
  '42501', null, 'insert: cannot create a project for someone else'
));
select tap.emit(throws_ok(
  $$ insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
     values (tap.id('alice'), 'tst-z', 'z', 'z', 'z', 'http://example.com', 'other') $$,
  '23514', null, 'insert: live_url must be https'
));

-- Rate limit: alice already made one project in the last 24 hours (via the API); two more are allowed.
insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
values (tap.id('alice'), 'tst-alice-2', 'Dua', 'T', 'P', 'https://example.com', 'other'),
       (tap.id('alice'), 'tst-alice-3', 'Tiga', 'T', 'P', 'https://example.com', 'other');
select tap.emit(throws_ok(
  $$ insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
     values (tap.id('alice'), 'tst-alice-4', 'Empat', 'T', 'P', 'https://example.com', 'other') $$,
  'P0001', 'rate_limit:projects', 'rate limit: 3 projects per 24 hours'
));
select tap.emit(throws_ok(
  $$ set constraints all immediate $$, 'P0001', 'project_sessions_required', 'a project needs at least one session'
));

-- No username yet ----------------------------------------------------------------
select tap.as_user(tap.id('nousername'));
select tap.emit(throws_ok(
  $$ insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
     values (tap.id('nousername'), 'tst-nu', 'x', 'x', 'x', 'https://example.com', 'other') $$,
  '42501', null, 'insert: requires a username (onboarding)'
));
select tap.emit(lives_ok(
  $$ update profiles set username = 'tst_newname' where id = tap.id('nousername') $$,
  'onboarding: user sets own username'
));
select tap.emit(throws_ok(
  $$ update profiles set username = 'api' where id = tap.id('nousername') $$,
  '23514', null, 'onboarding: reserved username rejected'
));
select tap.emit(throws_ok(
  $$ update profiles set username = 'tst_alice' where id = tap.id('nousername') $$,
  '23505', null, 'onboarding: username is unique (case-insensitive citext)'
));

-- Admin ------------------------------------------------------------------------------
select tap.as_user(tap.id('admin'));
select tap.emit(ok(is_admin(), 'admin: is_admin() is true'));
select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('alice-pending')), 1, 'admin: reads pending projects'
));
select tap.emit(is(
  (select count(*)::int from comments where project_id = tap.id('alice-live')), 2, 'admin: reads hidden comments'
));
select tap.emit(is(
  (select count(*)::int from reports where target_id = tap.id('alice-live')), 1, 'admin: reads reports'
));
select tap.emit(lives_ok(
  $$ update tools set description_en = 'Edited by admin' where slug = 'cursor' $$, 'admin: edits tools'
));
select tap.as_user(tap.id('bob'));
update tools set description_en = 'Edited by bob' where slug = 'claude';
select tap.as_postgres();
select tap.emit(isnt(
  (select description_en from tools where slug = 'claude'), 'Edited by bob', 'user: cannot edit tools'
));

-- Moderation triggers ---------------------------------------------------------------
-- Third unique report hides the project.
insert into reports (reporter_id, target_type, target_id, reason)
values (tap.id('carol'), 'project', tap.id('alice-live'), 'spam');
select tap.emit(is(
  (select status::text from projects where id = tap.id('alice-live')), 'published', 'two reports: still published'
));
insert into reports (reporter_id, target_type, target_id, reason)
values (tap.id('dave'), 'project', tap.id('alice-live'), 'spam');
select tap.emit(results_eq(
  $$ select status::text, report_count from projects where id = tap.id('alice-live') $$,
  $$ values ('hidden', 3) $$, 'third report hides the project'
));

-- Approving the first project makes the maker trusted; the next one publishes directly.
update projects set status = 'published', reviewed_by = tap.id('admin'), reviewed_at = now()
where id = tap.id('alice-pending');
select tap.emit(ok(
  (select is_trusted from profiles where id = tap.id('alice')), 'approval makes the maker trusted'
));
select tap.emit(ok(
  (select published_at is not null from projects where id = tap.id('alice-pending')), 'approval sets published_at'
));
select tap.as_user(tap.id('alice'));
-- Alice hit the daily limit above; pretend those projects are older.
select tap.as_postgres();
update projects set created_at = now() - interval '2 days' where owner_id = tap.id('alice');
select tap.as_user(tap.id('alice'));
insert into projects (owner_id, slug, title, tagline, key_prompt, live_url, category)
values (tap.id('alice'), 'tst-alice-trusted', 'Dipercaya', 'T', 'P', 'https://example.com', 'other');
select tap.emit(is(
  (select status::text from projects where slug = 'tst-alice-trusted'), 'published',
  'trusted maker publishes directly'
));

-- Rejected project goes back to pending when the owner edits it.
select tap.as_postgres();
update projects set status = 'rejected', reject_reason = 'Link mati' where id = tap.id('bob-live');
select tap.as_user(tap.id('bob'));
update projects set tagline = 'Sudah diperbaiki' where id = tap.id('bob-live');
select tap.emit(results_eq(
  $$ select status::text, reject_reason from projects where id = tap.id('bob-live') $$,
  $$ values ('pending', null::text) $$, 'edited rejected project returns to pending'
));

-- Counters and limits ---------------------------------------------------------------
select tap.as_postgres();
select tap.emit(is(
  (select comment_count from projects where id = tap.id('alice-live')), 1, 'comment_count counts visible comments'
));
update comments set status = 'visible' where user_id = tap.id('carol');
select tap.emit(is(
  (select comment_count from projects where id = tap.id('alice-live')), 2, 'comment_count follows status changes'
));

insert into project_tools (project_id, tool_id)
select tap.id('alice-pending'), id from tools where slug in ('cursor', 'supabase');
select tap.emit(is(
  (select project_count from tools where slug = 'cursor')
    - (select count(*)::int from project_tools pt join projects p on p.id = pt.project_id
       where pt.tool_id = (select id from tools where slug = 'cursor') and p.status = 'published'),
  0, 'tools.project_count counts published projects'
));
update projects set status = 'hidden' where id = tap.id('alice-pending');
select tap.emit(is(
  (select project_count from tools where slug = 'supabase')
    - (select count(*)::int from project_tools pt join projects p on p.id = pt.project_id
       where pt.tool_id = (select id from tools where slug = 'supabase') and p.status = 'published'),
  0, 'tools.project_count drops when a project is hidden'
));

insert into project_media (project_id, r2_key, width, height, bytes, sort_order)
select tap.id('alice-live'), 'test/' || n, 10, 10, 10, n from generate_series(1, 2) n;
select tap.emit(throws_ok(
  $$ insert into project_media (project_id, r2_key, width, height, bytes, sort_order)
     values (tap.id('alice-live'), 'test/extra', 10, 10, 10, 2) $$,
  'P0001', 'project_media_limit', 'at most 3 images per project'
));

insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
select tap.id('bob-live'), n, 1, 'p', 'r' from generate_series(1, 9) n;
select tap.emit(throws_ok(
  $$ insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
     values (tap.id('bob-live'), 9, 1, 'p', 'r') $$,
  'P0001', 'project_sessions_limit', 'at most 10 sessions per project'
));

-- Profile created from OAuth metadata.
select tap.emit(results_eq(
  $$ select display_name, avatar_url from profiles where id = tap.id('dave') $$,
  $$ values ('Test dave', 'https://example.com/a.png') $$,
  'new auth user gets a profile from OAuth metadata'
));

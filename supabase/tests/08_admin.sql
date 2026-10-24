-- Fase 8: /admin RPCs. Review queue (approve makes the maker trusted, so their next project
-- publishes directly), rejection with a reason and resubmission, report verdicts, trust, and
-- tool suggestions merged into the catalog.

select tap.user('admin'), tap.user('newbie'), tap.user('veteran'), tap.user('r1'), tap.user('r2'), tap.user('r3');
update profiles set is_admin = true where id = tap.id('admin');
update profiles set is_trusted = true where id = tap.id('veteran');

create function tap.tool(slug text) returns bigint language sql stable as $$
  select id from public.tools where tools.slug = tool.slug;
$$;

create function tap.payload(title text, suggestion text default null) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'title', title,
    'tagline', 'Tagline ' || title,
    'key_prompt', 'Prompt kunci ' || title,
    'live_url', 'https://example.com/app',
    'category', 'umkm',
    'content_lang', 'id',
    'tool_ids', jsonb_build_array(tap.tool('claude-code')),
    'suggestions', case when suggestion is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('name', suggestion, 'url', 'https://foo.example.com')) end,
    'sessions', jsonb_build_array(jsonb_build_object('duration_hours', 2, 'prompt', 'Bikin', 'result', 'Jadi'))
  );
$$;

grant execute on all functions in schema tap to public;

-- Submit as a new maker ---------------------------------------------------------------
select tap.as_user(tap.id('newbie'));
insert into tap.ids
select 'first', (upsert_project(p_slug_base => 'tst-first', p_project => tap.payload('Pertama', '  Foo AI ')) ->> 'id')::uuid;
insert into tap.ids
select 'second-try', (upsert_project(p_slug_base => 'tst-second', p_project => tap.payload('Kedua')) ->> 'id')::uuid;

select tap.emit(results_eq(
  $$ select status::text, submitted_at = created_at from projects where id = tap.id('first') $$,
  $$ values ('pending', true) $$, 'submit: new maker waits in the queue, clock starts at creation'
));

-- Who may call the admin RPCs -----------------------------------------------------------
select tap.emit(throws_ok(
  format('select admin_review_project(%L, true)', tap.id('first')), '42501', 'not_allowed',
  'review: a maker cannot approve their own project'
));
select tap.as_anon();
select tap.emit(throws_ok(
  format('select admin_review_project(%L, true)', tap.id('first')), '42501', null,
  'review: anon cannot call it'
));
select tap.as_user(tap.id('r1'));
select tap.emit(throws_ok(
  format('select admin_set_trusted(%L, true)', tap.id('r1')), '42501', 'not_allowed',
  'trust: a user cannot make themselves trusted'
));
select tap.emit(throws_ok(
  $$ select admin_resolve_tool_suggestions('Foo AI', 'reject') $$, '42501', 'not_allowed',
  'suggestions: a user cannot resolve them'
));
select tap.emit(throws_ok(
  $$ select assert_admin() $$, '42501', null, 'assert_admin is not callable by clients'
));

-- Approve: maker becomes trusted, the next project publishes directly (DoD) ------------
select tap.as_user(tap.id('admin'));
select tap.emit(is(
  (select count(*)::int from projects where status = 'pending' and id in (tap.id('first'), tap.id('second-try'))),
  2, 'queue: admin reads pending projects'
));
select tap.emit(is(
  admin_review_project(tap.id('first'), true) ->> 'status', 'published', 'approve: returns the new status'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select status::text, reviewed_by, reviewed_at is not null, published_at is not null from projects where id = tap.id('first') $$,
  $$ values ('published', tap.id('admin'), true, true) $$, 'approve: published, reviewer and time logged'
));
select tap.emit(ok(
  (select is_trusted from profiles where id = tap.id('newbie')), 'approve: maker is trusted now'
));
select tap.emit(is(
  (select project_count from tools where slug = 'claude-code') > 0, true, 'approve: tool counts follow'
));
select tap.as_user(tap.id('newbie'));
select tap.emit(is(
  upsert_project(p_slug_base => 'tst-third', p_project => tap.payload('Ketiga')) ->> 'status', 'published',
  'approve: the trusted maker''s next project publishes without review'
));

select tap.as_user(tap.id('admin'));
select tap.emit(throws_ok(
  format('select admin_review_project(%L, true)', tap.id('first')), 'P0001', 'not_pending',
  'approve: only pending projects'
));

-- Reject with a reason, then resubmit -----------------------------------------------------
select tap.emit(throws_ok(
  format('select admin_review_project(%L, false)', tap.id('second-try')), '22023', 'reject_code_required',
  'reject: a reason code is required'
));
select tap.emit(throws_ok(
  format('select admin_review_project(%L, false, %L, %L)', tap.id('second-try'), 'other', '  '), '22023',
  'reject_note_required', 'reject: "other" needs a note'
));
select tap.emit(throws_ok(
  format('select admin_review_project(%L, false, %L)', tap.id('second-try'), 'made_up'), '23514', null,
  'reject: unknown codes refused'
));
select admin_review_project(tap.id('second-try'), false, 'broken_link', '  Link mengarah ke halaman login.  ');
-- reviewed_by is not readable through the Data API; check it as postgres.
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select status::text, reject_code, reject_reason, reviewed_by from projects where id = tap.id('second-try') $$,
  $$ values ('rejected', 'broken_link', 'Link mengarah ke halaman login.', tap.id('admin')) $$,
  'reject: status, code, trimmed note and reviewer stored'
));
select tap.as_user(tap.id('admin'));

-- Resubmitting through the edit form, with no content change (sessions only).
select tap.as_postgres();
update projects set submitted_at = '2020-01-01' where id = tap.id('second-try');
select tap.as_user(tap.id('newbie'));
select upsert_project(
  p_project_id => tap.id('second-try'),
  p_project => tap.payload('Kedua') || jsonb_build_object('sessions', jsonb_build_array(
    jsonb_build_object('duration_hours', 3, 'prompt', 'Perbaiki link', 'result', 'Link jalan')
  ))
);
select tap.emit(results_eq(
  $$ select status::text, reject_code, reject_reason, submitted_at > '2020-01-01' from projects where id = tap.id('second-try') $$,
  $$ values ('pending', null::text, null::text, true) $$,
  'resubmit: saving a rejected project (sessions only) puts it back in the queue, clock restarted'
));

-- Content edits resubmit too (the trigger path).
select tap.as_user(tap.id('admin'));
select admin_review_project(tap.id('second-try'), false, 'incomplete');
select tap.as_user(tap.id('newbie'));
update projects set tagline = 'Tagline baru' where id = tap.id('second-try');
select tap.emit(is(
  (select status::text from projects where id = tap.id('second-try')), 'pending', 'resubmit: a content edit also resubmits'
));

-- Nobody else can resubmit it.
select tap.as_user(tap.id('admin'));
select admin_review_project(tap.id('second-try'), false, 'duplicate');
select tap.as_user(tap.id('r1'));
select resubmit_rejected_project(tap.id('second-try'));
select tap.as_postgres();
select tap.emit(is(
  (select status::text from projects where id = tap.id('second-try')), 'rejected', 'resubmit: only by the owner'
));

-- Reports: keep, hide, remove ----------------------------------------------------------------
select tap.project(tap.id('veteran'), 'spammy');
select tap.project(tap.id('veteran'), 'quiet');
select tap.as_user(tap.id('r1'));
select report_content('project', tap.id('spammy'), 'spam');
select tap.as_user(tap.id('r2'));
select report_content('project', tap.id('spammy'), 'scam', 'Minta transfer dulu');
select tap.as_user(tap.id('r3'));
select report_content('project', tap.id('spammy'), 'scam');
select tap.as_postgres();
select tap.emit(is(
  (select status::text from projects where id = tap.id('spammy')), 'hidden', 'reports: third report hid the project'
));

select tap.as_user(tap.id('admin'));
select tap.emit(is(
  (select count(*)::int from reports where target_id = tap.id('spammy') and not resolved), 3,
  'reports: admin reads the open reports'
));
select tap.emit(throws_ok(
  format('select admin_resolve_report(%L, %L, %L)', 'project', tap.id('spammy'), 'nuke'), '22023', 'invalid_action',
  'reports: unknown verdict refused'
));
select tap.emit(is(
  admin_resolve_report('project', tap.id('spammy'), 'keep') ->> 'status', 'published', 'keep: hidden project is restored'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select report_count, status::text from projects where id = tap.id('spammy') $$,
  $$ values (0, 'published') $$, 'keep: report count restarts'
));
select tap.emit(results_eq(
  $$ select bool_and(resolved), bool_and(resolved_by = tap.id('admin')), min(resolution) from reports where target_id = tap.id('spammy') $$,
  $$ values (true, true, 'keep') $$, 'keep: every report closed and logged'
));
select tap.as_user(tap.id('admin'));
select tap.emit(throws_ok(
  format('select admin_resolve_report(%L, %L, %L)', 'project', tap.id('spammy'), 'keep'), 'P0001', 'no_open_reports',
  'reports: nothing left to resolve'
));

-- One report, admin hides, then removes after another report.
select tap.as_user(tap.id('r1'));
select report_content('project', tap.id('quiet'), 'harassment');
select tap.as_user(tap.id('admin'));
select admin_resolve_report('project', tap.id('quiet'), 'hide');
select tap.emit(is(
  (select status::text from projects where id = tap.id('quiet')), 'hidden', 'hide: published project hidden'
));
select tap.as_postgres();
insert into reports (reporter_id, target_type, target_id, reason) values (tap.id('r2'), 'project', tap.id('quiet'), 'spam');
select tap.as_user(tap.id('admin'));
select admin_resolve_report('project', tap.id('quiet'), 'remove');
select tap.as_user(tap.id('veteran'));
select tap.emit(is(
  (select count(*)::int from projects where id = tap.id('quiet')), 0, 'remove: gone for its owner too'
));

-- Replies: hide, keep, remove.
select tap.as_service();
select post_reply_as(tap.id('r1'), tap.id('spammy'), 'Komentar kasar');
insert into tap.ids select 'rude', id from comments where body = 'Komentar kasar';
select tap.as_user(tap.id('r2'));
select report_content('comment', tap.id('rude'), 'harassment');
select tap.as_user(tap.id('admin'));
select admin_resolve_report('comment', tap.id('rude'), 'hide');
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select c.status::text, p.comment_count from comments c join projects p on p.id = c.project_id where c.id = tap.id('rude') $$,
  $$ values ('hidden', 0) $$, 'reply hide: hidden, comment count follows'
));
insert into reports (reporter_id, target_type, target_id, reason) values (tap.id('r3'), 'comment', tap.id('rude'), 'spam');
select tap.as_user(tap.id('admin'));
select admin_resolve_report('comment', tap.id('rude'), 'keep');
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select status::text, report_count from comments where id = tap.id('rude') $$,
  $$ values ('visible', 0) $$, 'reply keep: visible again, count restarts'
));
insert into reports (reporter_id, target_type, target_id, reason) values (tap.id('veteran'), 'comment', tap.id('rude'), 'spam');
select tap.as_user(tap.id('admin'));
select tap.emit(is(
  admin_resolve_report('comment', tap.id('rude'), 'remove') ->> 'project_id', tap.id('spammy')::text,
  'reply remove: returns the project for cache tags'
));
select tap.emit(is(
  (select count(*)::int from comments where id = tap.id('rude')), 0, 'reply remove: deleted'
));

-- A reply its author deleted before the admin looked: reports still close.
select tap.as_service();
select post_reply_as(tap.id('r1'), tap.id('spammy'), 'Sebentar saja');
insert into tap.ids select 'short', id from comments where body = 'Sebentar saja';
select tap.as_user(tap.id('r2'));
select report_content('comment', tap.id('short'), 'spam');
select tap.as_user(tap.id('r1'));
delete from comments where id = tap.id('short');
select tap.as_user(tap.id('admin'));
select tap.emit(is(
  admin_resolve_report('comment', tap.id('short'), 'keep') ->> 'project_id', null,
  'reports on a deleted reply close without a target'
));

-- Trust ----------------------------------------------------------------------------------------
select admin_set_trusted(tap.id('veteran'), false);
select tap.as_user(tap.id('veteran'));
select tap.emit(is(
  upsert_project(p_slug_base => 'tst-after-revoke', p_project => tap.payload('Setelah dicabut')) ->> 'status', 'pending',
  'revoke trust: the maker''s next project waits for review'
));

-- Tool suggestions -----------------------------------------------------------------------------
select tap.as_user(tap.id('veteran'));
insert into tap.ids
select 'sugg2', (upsert_project(p_slug_base => 'tst-sugg2', p_project => tap.payload('Saran dua', 'foo ai')) ->> 'id')::uuid;
select tap.as_postgres();
update profiles set is_trusted = true where id = tap.id('veteran');
select tap.as_user(tap.id('veteran'));
insert into tap.ids
select 'sugg3', (upsert_project(p_slug_base => 'tst-sugg3', p_project => tap.payload('Saran tiga', 'Bar Builder')) ->> 'id')::uuid;

select tap.as_user(tap.id('admin'));
select tap.emit(throws_ok(
  $$ select admin_resolve_tool_suggestions('Tidak ada', 'reject') $$, 'P0001', 'no_pending_suggestions',
  'suggestions: unknown name refused'
));
select tap.emit(throws_ok(
  $$ select admin_resolve_tool_suggestions('Foo AI', 'merge', -1) $$, 'P0001', 'tool_not_found',
  'suggestions: merge needs an existing tool'
));
select tap.emit(is(
  jsonb_array_length(admin_resolve_tool_suggestions('FOO ai', 'merge', tap.tool('cursor')) -> 'project_ids'), 2,
  'merge: same name (any case or spacing) from two projects'
));
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select count(*)::int from project_tools where tool_id = tap.tool('cursor') and project_id in (tap.id('first'), tap.id('sugg2')) $$,
  $$ values (2) $$, 'merge: both projects now use the catalog tool'
));
select tap.emit(results_eq(
  $$ select status::text, merged_tool_id from tool_suggestions where project_id in (tap.id('first'), tap.id('sugg2')) $$,
  $$ values ('merged', tap.tool('cursor')), ('merged', tap.tool('cursor')) $$, 'merge: suggestions marked merged'
));
select tap.emit(ok(
  (select project_count from tools where slug = 'cursor') >= 1, 'merge: tool count includes the published project'
));

select tap.as_user(tap.id('admin'));
select tap.emit(throws_ok(
  $$ select admin_resolve_tool_suggestions('Bar Builder', 'create', p_new_tool => '{"slug": "claude-code", "name": "Bar Builder", "kind": "ai_builder"}') $$,
  '23505', null, 'create: slug must be new'
));
select admin_resolve_tool_suggestions('Bar Builder', 'create', p_new_tool =>
  '{"slug": "tst-bar-builder", "name": " Bar Builder ", "url": "https://bar.example.com", "kind": "ai_builder", "description_id": "Pembuat aplikasi", "description_en": "App builder"}');
select tap.as_postgres();
select tap.emit(results_eq(
  $$ select t.name, t.kind::text, t.description_en, t.project_count from tools t where t.slug = 'tst-bar-builder' $$,
  $$ values ('Bar Builder', 'ai_builder', 'App builder', 1) $$, 'create: new tool linked to the project'
));

-- Editing a project keeps a merged tool (the form sends it back as a catalog tool).
select tap.as_user(tap.id('newbie'));
select upsert_project(p_project_id => tap.id('first'), p_project => tap.payload('Pertama')
  || jsonb_build_object('tool_ids', jsonb_build_array(tap.tool('claude-code'), tap.tool('cursor'))));
select tap.emit(results_eq(
  $$ select status::text from tool_suggestions where project_id = tap.id('first') $$,
  $$ values ('merged') $$, 'edit: reviewed suggestions stay after saving'
));

-- Reject: name disappears from the project.
select tap.as_user(tap.id('veteran'));
select upsert_project(p_project_id => tap.id('sugg3'), p_project => tap.payload('Saran tiga', 'Mystery Tool'));
select tap.as_user(tap.id('admin'));
select admin_resolve_tool_suggestions('mystery tool', 'reject');
select tap.as_anon();
select tap.emit(is(
  (select count(*)::int from tool_suggestions where project_id = tap.id('sugg3') and status = 'pending'), 0,
  'reject: no pending suggestion left to show'
));

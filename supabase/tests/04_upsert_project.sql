-- Submit and edit through upsert_project (Fase 4).

select tap.user('alice'), tap.user('bob'), tap.user('carol');
select tap.user('nousername', with_username => false);
update profiles set is_trusted = true where id = tap.id('bob');

create function tap.tool(slug text) returns bigint language sql stable as $$
  select id from public.tools where tools.slug = tool.slug;
$$;

-- A valid payload; tests override single keys with ||.
create function tap.payload(title text default 'Kasir Warung') returns jsonb language sql stable as $$
  select jsonb_build_object(
    'title', title,
    'tagline', 'Catat jualan harian dari HP',
    'description', 'Buat warung kelontong.',
    'key_prompt', 'Bikin kasir buat warung kelontong, tombolnya gede.',
    'build_effort', 'weekend',
    'moment_wow', 'Minta tombol segede jempol, langsung jadi.',
    'moment_hardest', '',
    'lessons', 'Tulis prompt dari sudut pandang pemakainya.',
    'live_url', 'https://kasir.example.com',
    'repo_url', null,
    'video_url', 'https://www.loom.com/share/abc',
    'category', 'umkm',
    'content_lang', 'id',
    'tool_ids', jsonb_build_array(tap.tool('claude-code'), tap.tool('supabase')),
    'suggestions', jsonb_build_array(jsonb_build_object('name', 'Alat Rahasia', 'url', 'https://rahasia.example.com'))
  );
$$;

grant execute on all functions in schema tap to public;

-- Create ------------------------------------------------------------------------
select tap.as_user(tap.id('alice'));
insert into tap.ids
select 'a1', (upsert_project(p_slug_base => 'kasir-warung', p_project => tap.payload() || '{"status": "published"}'::jsonb) ->> 'id')::uuid;

select tap.emit(results_eq(
  $$ select slug, status::text, owner_id, build_effort::text, session_count::int from projects where id = tap.id('a1') $$,
  $$ values ('kasir-warung', 'pending', tap.id('alice'), 'weekend', 0) $$,
  'new maker: project is pending, status in payload ignored, no sessions needed'
));
select tap.emit(results_eq(
  $$ select moment_wow, moment_hardest, has_story from projects where id = tap.id('a1') $$,
  $$ values ('Minta tombol segede jempol, langsung jadi.', null::text, true) $$,
  'moments stored (empty ones as null); has_story set'
));
select tap.emit(is(
  (select count(*)::int from project_tools where project_id = tap.id('a1')), 2, 'tools linked'
));
select tap.emit(is(
  (select name || '|' || suggested_by::text from tool_suggestions where project_id = tap.id('a1')),
  'Alat Rahasia|' || tap.id('alice')::text,
  'tool suggestion stored for the maker'
));

select tap.as_user(tap.id('bob'));
insert into tap.ids
select 'b1', (upsert_project(p_slug_base => 'kasir-warung', p_project => tap.payload()) ->> 'id')::uuid;
select tap.emit(results_eq(
  $$ select slug, status::text from projects where id = tap.id('b1') $$,
  $$ values ('kasir-warung-2', 'published') $$,
  'trusted maker: published right away; slug suffixed on collision'
));
select tap.emit(is(
  upsert_project(p_slug_base => 'kasir-warung', p_project => tap.payload()) ->> 'slug', 'kasir-warung-3', 'next collision gets -3'
));
select tap.emit(is(
  upsert_project(p_slug_base => '-bad slug!', p_project => tap.payload()) ->> 'slug', 'proyek', 'invalid slug base falls back'
));

-- Validation ----------------------------------------------------------------------
select tap.as_user(tap.id('carol'));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || jsonb_build_object('tool_ids', jsonb_build_array(tap.tool('supabase')))) $$,
  '22023', 'ai_tool_required', 'needs at least one AI tool'
));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() - 'build_effort') $$,
  '23502', null, 'build_effort is required'
));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || '{"build_effort": "forever"}'::jsonb) $$,
  '22P02', null, 'build_effort must be on the scale'
));
select tap.emit(throws_ok(
  format($$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || jsonb_build_object('moment_hardest', %L)) $$,
    repeat('x', 1001)),
  '23514', null, 'moments are at most 1000 characters'
));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || '{"live_url": "http://insecure.example.com"}'::jsonb) $$,
  '23514', null, 'live_url must be https'
));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || '{"category": "nope"}'::jsonb) $$,
  '23503', null, 'unknown category rejected'
));
select tap.emit(is(
  (select count(*)::int from projects where owner_id = tap.id('carol')), 0, 'failed submits leave nothing behind'
));

select tap.as_user(tap.id('nousername'));
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload()) $$,
  '42501', null, 'username required before submitting'
));

select tap.as_anon();
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload()) $$,
  '42501', null, 'anon: cannot submit'
));

-- Edit ----------------------------------------------------------------------------
-- A project from before build_effort: its old sessions stay through an edit.
select tap.as_postgres();
insert into project_sessions (project_id, sort_order, duration_hours, prompt, result)
values (tap.id('a1'), 0, 2.5, 'Bikin layar kasir', 'Layar kasir jadi');

select tap.as_user(tap.id('alice'));
select upsert_project(p_project_id => tap.id('a1'), p_slug_base => 'ignored', p_project => tap.payload('Kasir Warung Bu Tini') || jsonb_build_object(
  'build_effort', 'week',
  'moment_wow', '',
  'moment_hardest', 'Login Google bentrok, ganti magic link.',
  'tool_ids', jsonb_build_array(tap.tool('cursor')),
  'suggestions', '[]'::jsonb,
  'sessions', '[]'::jsonb
));
select tap.emit(results_eq(
  $$ select title, slug, status::text, build_effort::text, moment_wow, moment_hardest from projects where id = tap.id('a1') $$,
  $$ values ('Kasir Warung Bu Tini', 'kasir-warung', 'pending', 'week', null::text, 'Login Google bentrok, ganti magic link.') $$,
  'owner: edit saved, slug stays, a cleared moment becomes null'
));
select tap.emit(results_eq(
  $$ select session_count::int, build_time_hours from projects where id = tap.id('a1') $$,
  $$ values (1, 2.5::numeric(5, 1)) $$,
  'owner: old sessions are left alone by an edit (sessions in the payload are ignored)'
));
select tap.emit(results_eq(
  $$ select t.slug from project_tools pt join tools t on t.id = pt.tool_id where pt.project_id = tap.id('a1') $$,
  $$ values ('cursor') $$,
  'owner: tools replaced'
));
select tap.emit(is(
  (select count(*)::int from tool_suggestions where project_id = tap.id('a1')), 0,
  'owner: dropped suggestion removed'
));

select tap.as_user(tap.id('bob'));
select tap.emit(throws_ok(
  $$ select upsert_project(p_project_id => tap.id('a1'), p_slug_base => 'x', p_project => tap.payload('Dibajak')) $$,
  '42501', 'not_allowed', 'other user: cannot edit'
));

select tap.as_postgres();
select tap.emit(is(
  (select title from projects where id = tap.id('a1')), 'Kasir Warung Bu Tini', 'other user: project unchanged'
));

-- Rejected project goes back to review after an edit (Q11).
update projects set status = 'rejected', reject_reason = 'Kurang jelas' where id = tap.id('a1');
select tap.as_user(tap.id('alice'));
select upsert_project(p_project_id => tap.id('a1'), p_slug_base => 'x', p_project => tap.payload('Kasir Warung v2'));
select tap.emit(is(
  (select status::text from projects where id = tap.id('a1')), 'pending', 'rejected + edited: back to pending'
));

-- Rate limit: 3 projects per 24 hours ---------------------------------------------
select upsert_project(p_slug_base => 'kedua', p_project => tap.payload());
select upsert_project(p_slug_base => 'ketiga', p_project => tap.payload());
select tap.emit(throws_ok(
  $$ select upsert_project(p_slug_base => 'keempat', p_project => tap.payload()) $$,
  'P0001', 'rate_limit:projects', 'rate limit applies through the RPC'
));

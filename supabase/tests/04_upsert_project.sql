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
    'lessons', 'Tulis prompt dari sudut pandang pemakainya.',
    'live_url', 'https://kasir.example.com',
    'repo_url', null,
    'video_url', 'https://www.loom.com/share/abc',
    'category', 'umkm',
    'content_lang', 'id',
    'tool_ids', jsonb_build_array(tap.tool('claude-code'), tap.tool('supabase')),
    'suggestions', jsonb_build_array(jsonb_build_object('name', 'Alat Rahasia', 'url', 'https://rahasia.example.com')),
    'sessions', jsonb_build_array(
      jsonb_build_object('label', 'Sabtu malam', 'duration_hours', 2.5, 'prompt', 'Bikin layar kasir', 'result', 'Layar kasir jadi',
        'challenge', 'Tombol kekecilan', 'solution', 'Minta tombol 64px'),
      jsonb_build_object('duration_hours', 1, 'prompt', 'Tambah rekap mingguan', 'result', 'Rekap jadi')
    )
  );
$$;

grant execute on all functions in schema tap to public;

-- Create ------------------------------------------------------------------------
select tap.as_user(tap.id('alice'));
insert into tap.ids
select 'a1', (upsert_project(p_slug_base => 'kasir-warung', p_project => tap.payload() || '{"status": "published"}'::jsonb) ->> 'id')::uuid;

select tap.emit(results_eq(
  $$ select slug, status::text, session_count::int, build_time_hours, owner_id from projects where id = tap.id('a1') $$,
  $$ values ('kasir-warung', 'pending', 2, 3.5::numeric(5, 1), tap.id('alice')) $$,
  'new maker: project is pending, sessions derived, status in payload ignored'
));
select tap.emit(results_eq(
  $$ select sort_order::int, label, challenge from project_sessions where project_id = tap.id('a1') order by sort_order $$,
  $$ values (0, 'Sabtu malam', 'Tombol kekecilan'), (1, null, null) $$,
  'sessions stored in order'
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
  $$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || '{"sessions": []}'::jsonb) $$,
  '22023', 'invalid_sessions', 'needs at least one session'
));
select tap.emit(throws_ok(
  format($$ select upsert_project(p_slug_base => 'x', p_project => tap.payload() || jsonb_build_object('sessions', %L::jsonb)) $$,
    (select jsonb_agg(jsonb_build_object('duration_hours', 1, 'prompt', 'p', 'result', 'r')) from generate_series(1, 11))),
  '22023', 'invalid_sessions', 'at most 10 sessions'
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
select tap.as_postgres();
insert into tap.ids select 's0', id from project_sessions where project_id = tap.id('a1') and sort_order = 0;

select tap.as_user(tap.id('alice'));
select upsert_project(p_project_id => tap.id('a1'), p_slug_base => 'ignored', p_project => tap.payload('Kasir Warung Bu Tini') || jsonb_build_object(
  'tool_ids', jsonb_build_array(tap.tool('cursor')),
  'suggestions', '[]'::jsonb,
  'sessions', jsonb_build_array(
    jsonb_build_object('duration_hours', 4, 'prompt', 'Sesi baru di depan', 'result', 'Hasil baru'),
    jsonb_build_object('id', tap.id('s0'), 'label', 'Sabtu malam', 'duration_hours', 3, 'prompt', 'Bikin layar kasir', 'result', 'Layar kasir jadi')
  )
));
select tap.emit(results_eq(
  $$ select title, slug, status::text, build_time_hours, session_count::int from projects where id = tap.id('a1') $$,
  $$ values ('Kasir Warung Bu Tini', 'kasir-warung', 'pending', 7.0::numeric(5, 1), 2) $$,
  'owner: edit saved, slug stays'
));
select tap.emit(results_eq(
  $$ select sort_order::int, id = tap.id('s0'), challenge from project_sessions where project_id = tap.id('a1') order by sort_order $$,
  $$ values (0, false, null::text), (1, true, null::text) $$,
  'owner: kept session keeps its id and moves; removed session is gone'
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
select tap.emit(throws_ok(
  $$ select upsert_project(p_project_id => tap.id('a1'), p_slug_base => 'x', p_project => tap.payload() || jsonb_build_object('sessions',
    jsonb_build_array(jsonb_build_object('id', tap.id('s0'), 'duration_hours', 1, 'prompt', 'p', 'result', 'r')))) $$,
  '42501', 'not_allowed', 'other user: cannot touch sessions through the RPC'
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

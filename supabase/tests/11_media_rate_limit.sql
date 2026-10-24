-- Security audit run-1, stage 4: consume_media_quota() for /api/media/presign and /finalize.

select tap.user('maker'), tap.user('other');

select tap.as_anon();
select tap.emit(throws_ok(
  $$ select consume_media_quota('finalize') $$, '42501', null, 'media quota: anon cannot call it'
));

select tap.as_user(tap.id('maker'));
select tap.emit(throws_ok(
  $$ select consume_media_quota('delete') $$, '22023', 'invalid_kind', 'media quota: unknown kind refused'
));
select consume_media_quota('finalize') from generate_series(1, 20);
select tap.emit(throws_like(
  $$ select consume_media_quota('finalize') $$, 'rate_limit:media%',
  'media quota: the 21st finalize in an hour is refused'
));
select tap.emit(lives_ok(
  $$ select consume_media_quota('presign') $$, 'media quota: presign has its own budget'
));
select tap.emit(throws_ok(
  $$ select * from media_rate_log $$, '42501', null, 'media quota: the log is not readable by users'
));

select tap.as_user(tap.id('other'));
select tap.emit(lives_ok(
  $$ select consume_media_quota('finalize') $$, 'media quota: counted per account'
));

-- Calls older than an hour no longer count.
select tap.as_postgres();
update media_rate_log set created_at = now() - interval '61 minutes' where user_id = tap.id('maker');
select tap.as_user(tap.id('maker'));
select tap.emit(lives_ok(
  $$ select consume_media_quota('finalize') $$, 'media quota: the window is one hour'
));

-- Autofill (link preview and screenshot fetches) has its own budget of 30 per hour.
select tap.as_user(tap.id('other'));
select consume_media_quota('autofill') from generate_series(1, 30);
select tap.emit(throws_like(
  $$ select consume_media_quota('autofill') $$, 'rate_limit:media%',
  'media quota: the 31st autofill in an hour is refused'
));

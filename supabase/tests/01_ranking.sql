-- Ranking formula (§2.7): eligible votes, tie-breaks, one per maker, rotation, threshold, fallback.
-- Week under test: shown Monday 2030-01-07, scored on 2029-12-31 .. 2030-01-06 (WIB).

-- Voters: six seasoned accounts and one created two days before scoring (< 72 hours).
select tap.user('v1'), tap.user('v2'), tap.user('v3'), tap.user('v4'), tap.user('v5'), tap.user('v6'), tap.user('v7');
select tap.user('fresh', '2030-01-05 00:00+07');
select tap.user('m1'), tap.user('m2'), tap.user('m3'), tap.user('m4'), tap.user('m5'), tap.user('m6'), tap.user('m7'), tap.user('m8');

select tap.project(tap.id('m1'), 'p1', published => '2029-12-01');
select tap.project(tap.id('m2'), 'p2', published => '2029-12-02');
select tap.project(tap.id('m3'), 'p3', published => '2029-11-01');
select tap.project(tap.id('m4'), 'p4', published => '2029-12-03');
select tap.project(tap.id('m3'), 'p5', published => '2029-12-04');
select tap.project(tap.id('m5'), 'p6', published => '2029-12-05', with_media => false);
select tap.project(tap.id('m6'), 'p7', published => '2029-12-06');
select tap.project(tap.id('m6'), 'p8', published => '2029-10-01');
select tap.project(tap.id('m7'), 'p9', published => '2029-10-02');
select tap.project(tap.id('m7'), 'p10', published => '2029-12-15');
select tap.project(tap.id('m8'), 'p11', published => '2029-10-03');
select tap.project(tap.id('m1'), 'newest', published => '2029-12-31');

-- Earlier picks: m6 two weeks ago (rotation blocks), m7 five weeks ago (allowed), p11 ten weeks ago.
insert into public.weekly_picks (week_start, project_id, score) values
  ('2029-12-24', tap.id('p8'), 5),
  ('2029-12-03', tap.id('p9'), 5),
  ('2029-10-29', tap.id('p11'), 5);

-- Votes and replies inside the window.
select tap.vote(tap.id(v), tap.id('p1'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3', 'fresh']) v;
select tap.vote(tap.id(v), tap.id('p2'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2']) v;
select tap.reply(tap.id(v), tap.id('p2'), '2030-01-03 13:00+07') from unnest(array['v3', 'v4', 'v4']) v;
select tap.vote(tap.id(v), tap.id('p3'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3']) v;
select tap.vote(tap.id(v), tap.id('p4'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2']) v;
select tap.reply(tap.id(v), tap.id('p4'), '2030-01-03 13:00+07') from unnest(array['fresh', 'm4']) v;
select tap.vote(tap.id(v), tap.id('p5'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3', 'v4']) v;
select tap.vote(tap.id(v), tap.id('p6'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3', 'v4', 'v5']) v;
select tap.vote(tap.id(v), tap.id('p7'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) v;
select tap.vote(tap.id(v), tap.id('p10'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3']) v;
select tap.vote(tap.id(v), tap.id('p11'), '2030-01-03 12:00+07') from unnest(array['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']) v;
-- Outside the window: does not count.
select tap.vote(tap.id('v4'), tap.id('p1'), '2029-12-30 23:59+07');

-- Owners cannot vote for themselves.
select tap.emit(throws_ok(
  $$ select tap.vote(tap.id('m1'), tap.id('p1'), '2030-01-03 12:00+07') $$,
  'P0001', 'upvote_own_project', 'owner cannot vote for own project'
));

-- Counters --------------------------------------------------------------------
select tap.emit(is(
  (select upvote_count from projects where id = tap.id('p1')), 5,
  'upvote_count includes every vote'
));
-- Eligibility is measured against the real clock here, so the 2030 "fresh" account is not seasoned.
select tap.emit(is(
  (select eligible_upvote_count from projects where id = tap.id('p1')), 4,
  'eligible_upvote_count skips accounts younger than 72 hours'
));
select refresh_eligible_upvote_counts('2030-01-10 00:00+07');
select tap.emit(is(
  (select eligible_upvote_count from projects where id = tap.id('p1')), 5,
  'daily refresh counts the vote once the account is 72 hours old'
));

-- Scores ----------------------------------------------------------------------
select tap.emit(results_eq(
  $$ select eligible_votes, eligible_repliers, score
     from project_scores('2029-12-31 00:00+07', '2030-01-07 00:00+07', '2030-01-07 00:05+07')
     where project_id = tap.id('p1') $$,
  $$ values (3, 0, 3.0::numeric) $$,
  'fresh-account vote and out-of-window vote are not counted'
));
select tap.emit(results_eq(
  $$ select eligible_votes, eligible_repliers, score
     from project_scores('2029-12-31 00:00+07', '2030-01-07 00:00+07', '2030-01-07 00:05+07')
     where project_id = tap.id('p2') $$,
  $$ values (2, 2, 3.0::numeric) $$,
  'repliers count once per account at half a vote'
));
select tap.emit(results_eq(
  $$ select eligible_repliers, score
     from project_scores('2029-12-31 00:00+07', '2030-01-07 00:00+07', '2030-01-07 00:05+07')
     where project_id = tap.id('p4') $$,
  $$ values (0, 2.0::numeric) $$,
  'replies from the owner and from fresh accounts are not counted'
));

-- A. Popular this week ------------------------------------------------------------
select tap.emit(results_eq(
  $$ select project_id from popular_this_week(50, '2030-01-06 12:00+07')
     where project_id in (select id from tap.ids) $$,
  -- Rolling window includes v4's 2029-12-30 vote on p1, so p1 ties p5 at 4 and wins on published_at;
  -- p3 is dropped because its maker already appears with p5.
  $$ select tap.id(k) from unnest(array['p11', 'p7', 'p6', 'p1', 'p5', 'p10', 'p2', 'p4']) k $$,
  'popular: score desc, then votes, then earlier published; one project per maker'
));

-- B. Weekly pick ------------------------------------------------------------------
select compute_weekly_pick('2030-01-07', '2030-01-07 00:05+07');

select tap.emit(is(
  (select project_id from weekly_picks where week_start = '2030-01-07'), tap.id('p5'),
  'weekly pick is the top eligible candidate'
));
select tap.emit(results_eq(
  $$ select (c ->> 'project_id')::uuid
     from weekly_picks, jsonb_array_elements(breakdown -> 'candidates') with ordinality as x (c, n)
     where week_start = '2030-01-07' order by n $$,
  $$ select tap.id(k) from unnest(array['p5', 'p3', 'p1', 'p10', 'p2']) k $$,
  'candidates skip: no screenshot, already picked, maker picked within 4 weeks, score below 3'
));
select tap.emit(is(
  (select breakdown -> 'winner' ->> 'eligible_votes' from weekly_picks where week_start = '2030-01-07'), '4',
  'breakdown explains the winning numbers'
));

-- Frozen: more votes later do not change a stored pick.
select tap.vote(tap.id(v), tap.id('p2'), '2030-01-04 12:00+07') from unnest(array['v5', 'v6', 'v7']) v;
select tap.emit(is(
  (compute_weekly_pick('2030-01-07', '2030-01-08 00:00+07')).project_id, tap.id('p5'),
  'a stored pick is frozen for the week'
));

select tap.emit(throws_ok(
  $$ select compute_weekly_pick('2030-01-08') $$,
  'P0001', 'week_start must be a Monday, got 2030-01-08', 'week_start must be a Monday'
));

-- Home hero ----------------------------------------------------------------------
select tap.emit(results_eq(
  $$ select project_id, kind from get_home_hero('2030-01-09 10:00+07') $$,
  $$ values (tap.id('p5'), 'weekly_pick') $$,
  'hero shows this week''s pick'
));
update projects set status = 'hidden' where id = tap.id('p5');
select tap.emit(results_eq(
  $$ select project_id, kind from get_home_hero('2030-01-09 10:00+07') $$,
  $$ values (tap.id('p3'), 'weekly_pick') $$,
  'hidden winner: runner-up moves up'
));
update projects set link_status = 'archived' where id = tap.id('p3');
select tap.emit(results_eq(
  $$ select project_id, kind from get_home_hero('2030-01-09 10:00+07') $$,
  $$ values (tap.id('p1'), 'weekly_pick') $$,
  'archived runner-up is skipped too'
));

-- Threshold: next week only reaches 2.5, so no pick and the hero falls back to the newest project.
select tap.vote(tap.id(v), tap.id('p10'), '2030-01-10 12:00+07') from unnest(array['v4', 'v5']) v;
select tap.reply(tap.id('v6'), tap.id('p10'), '2030-01-10 13:00+07');
select compute_weekly_pick('2030-01-14', '2030-01-14 00:05+07');

select tap.emit(ok(
  (select project_id is null and breakdown -> 'candidates' = '[]'::jsonb from weekly_picks where week_start = '2030-01-14'),
  'no candidate reaches score 3: stored without a winner'
));
select tap.emit(results_eq(
  $$ select project_id, kind from get_home_hero('2030-01-15 10:00+07') $$,
  $$ values (tap.id('newest'), 'latest') $$,
  'hero falls back to the newest published project ("Baru masuk")'
));
select tap.emit(results_eq(
  $$ select project_id, kind from get_home_hero('2030-01-22 10:00+07') $$,
  $$ values (tap.id('newest'), 'latest') $$,
  'week without a computed pick falls back too'
));

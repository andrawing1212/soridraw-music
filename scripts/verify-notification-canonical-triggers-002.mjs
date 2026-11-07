import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  readOwnNotificationInbox001, publishGlobalAnnouncement001,
  readGlobalAnnouncements001,
} from '../cloudflare/explore-worker/runtime/notification-inbox-001.mjs';
import {
  NOTIFICATION_DEFAULT_PREFS_002, NOTIFICATION_RETENTION_MS_002,
  readOwnNotificationPreferences002, saveOwnNotificationPreferences002,
  cleanupExpiredNotificationInbox002,
} from '../cloudflare/explore-worker/runtime/notification-preferences-retention-002.mjs';

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);
CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);
CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,
  PRIMARY KEY(track_id,user_uid));
CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,
  PRIMARY KEY(follower_uid,following_uid));
CREATE TABLE explore_follow_overrides_348(
  follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,
  updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));`);
const source=readFileSync('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql','utf8');
assert.match(source,/SOURCE-ONLY CANDIDATE/);
assert.doesNotMatch(source,/DROP TABLE|DELETE FROM likes|UPDATE likes|DELETE FROM follows|UPDATE follows/);
assert.match(source,/AFTER INSERT ON likes/);
assert.match(source,/AFTER INSERT ON follows/);
assert.match(source,/AFTER INSERT ON explore_follow_overrides_348/);
assert.match(source,/AFTER UPDATE OF following ON explore_follow_overrides_348/);
db.exec(source);
const get=(q,...args)=>db.prepare(q).get(...args);
const put=(q,...args)=>db.prepare(q).run(...args);
const count=(uid)=>get('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001 WHERE receiver_uid=?',uid).n;
const now=1_800_000_000_000, hour=3_600_000;
put('INSERT INTO public_profiles VALUES (?,?,1)','owner','Creator');
put('INSERT INTO public_profiles VALUES (?,?,1)','actor','Actor');
put('INSERT INTO public_profiles VALUES (?,?,1)','actor2','Guest');
put('INSERT INTO tracks VALUES (?,?,?,?,?)','track','owner','A Song',1,'published');
put('INSERT INTO tracks VALUES (?,?,?,?,?)','private','owner','Hidden Song',0,'published');
put('INSERT INTO tracks VALUES (?,?,?,?,?)','own','actor','Own Song',1,'published');
// Schema creation alone MUST NOT enable notifications.
assert.equal(get('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').enabled,0);
put('INSERT INTO likes VALUES (?,?,?)','track','actor',now);
assert.equal(count('owner'),0);
put('DELETE FROM likes WHERE track_id=? AND user_uid=?','track','actor');
// Test-only explicit latch; no application code activates this in PREVIEW/TEST/PROD.
put('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1');
put('INSERT INTO likes VALUES (?,?,?)','track','actor',now);
assert.equal(count('owner'),1,'inserted and published canonical like yields one alert');
const row=get('SELECT * FROM soridraw_notification_inbox_001 WHERE receiver_uid=?','owner');
assert.equal(row.actor_uid,'actor');
assert.equal(row.actor_name,'Actor');
assert.equal(row.subject_title,'A Song');
assert.equal(row.bucket_ms, Math.floor(now/7_200_000)*7_200_000);
put('INSERT OR IGNORE INTO likes VALUES (?,?,?)','track','actor',now);
assert.equal(count('owner'),1,'duplicate like must not fan out');
put('DELETE FROM likes WHERE track_id=? AND user_uid=?','track','actor');
assert.equal(count('owner'),1,'unlike never emits a new alert');
put('INSERT INTO likes VALUES (?,?,?)','track','actor',now+30*60*1000);
assert.equal(count('owner'),1,'re-like inside same digest must dedupe');
put('DELETE FROM likes WHERE track_id=? AND user_uid=?','track','actor');
put('INSERT INTO likes VALUES (?,?,?)','track','actor',now+2*hour);
assert.equal(count('owner'),2,'next settled digest may generate a new alert');
put('INSERT INTO likes VALUES (?,?,?)','own','actor',now);
assert.equal(count('actor'),0,'own track never notifies self');
put('INSERT INTO likes VALUES (?,?,?)','private','actor2',now);
assert.equal(count('owner'),2,'unpublished track never notifies');
// Owner-controlled account-wide flags block server-side notifications.
const d1={prepare:(sql)=>({bind:(...args)=>{
  const statement=db.prepare(sql);
  return {
    first:async()=>statement.get(...args)||null,
    all:async()=>({results:statement.all(...args)}),
    run:async()=>({meta:{changes:statement.run(...args).changes}}),
  };
}})};
const authOwner=async()=> 'owner', authActor=async()=> 'actor';
assert.deepEqual(await readOwnNotificationPreferences002({db:d1,
  authenticate:authOwner,activated:true}),{
  status:'ok',preferences:{revision:0,...NOTIFICATION_DEFAULT_PREFS_002}});
const offLike={expectedRevision:0,operationId:'operation_likeoff_0001',
  master:true,like:false,follow:true,complete:true,announcement:true,message:true};
assert.equal((await saveOwnNotificationPreferences002({
  db:d1,authenticate:authOwner,activated:true,requested:offLike,now})).status,'saved');
assert.equal((await saveOwnNotificationPreferences002({
  db:d1,authenticate:authOwner,activated:true,requested:offLike,now})).rowsWritten,0,
  'retrying same preference update is W0');
assert.equal((await readOwnNotificationPreferences002({
  db:d1,authenticate:authActor,activated:true})).preferences.like,true,
  'another account cannot read owner flags');
await assert.rejects(saveOwnNotificationPreferences002({db:d1,
  authenticate:authActor,activated:true,
  requested:{...offLike,user_uid:'owner'},now}),/NOTIFICATION_PREFERENCES_INVALID/);
put('DELETE FROM likes WHERE track_id=? AND user_uid=?','track','actor');
put('INSERT INTO likes VALUES (?,?,?)','track','actor',now+4*hour);
assert.equal(count('owner'),2,'category OFF prevents new like record');
const masterOff={...offLike,expectedRevision:1,operationId:'operation_alloff_0002',
  master:false,like:true};
assert.equal((await saveOwnNotificationPreferences002({
  db:d1,authenticate:authOwner,activated:true,requested:masterOff,now})).status,'saved');
const stale={...masterOff,expectedRevision:1,operationId:'operation_stale_0003',
  master:true,follow:false};
assert.equal((await saveOwnNotificationPreferences002({
  db:d1,authenticate:authOwner,activated:true,requested:stale,now})).status,'conflict',
  'outdated PC request cannot overwrite mobile setting');
put('INSERT OR IGNORE INTO follows VALUES (?,?,?)','actor','owner',now);
assert.equal(count('owner'),2,'master OFF blocks follows');
assert.equal(get('SELECT revision FROM soridraw_notification_preferences_002 WHERE user_uid=?','owner').revision,2);
const masterOn={...masterOff,expectedRevision:2,operationId:'operation_allon_0004',master:true};
assert.equal((await saveOwnNotificationPreferences002({
  db:d1,authenticate:authOwner,activated:true,requested:masterOn,now})).status,'saved');
put('DELETE FROM follows WHERE follower_uid=? AND following_uid=?','actor','owner');
put('INSERT INTO follows VALUES (?,?,?)','actor','owner',now+5*hour);
assert.equal(count('owner'),3,'legacy follows record only new true relationship');
put('INSERT OR IGNORE INTO follows VALUES (?,?,?)','actor','owner',now+5*hour);
assert.equal(count('owner'),3,'repeated follows are no-op');
put('DELETE FROM follows WHERE follower_uid=? AND following_uid=?','actor','owner');
assert.equal(count('owner'),3,'unfollow never creates alerts');
put('INSERT INTO explore_follow_overrides_348 VALUES (?,?,?,?,?,?)',
 'actor2','owner',1,0,now+6*hour,'op-overlay-a');
assert.equal(count('owner'),4,'overlay relation net-new 0->1');
put('UPDATE explore_follow_overrides_348 SET following=0,updated_at=? WHERE follower_uid=? AND following_uid=?',now+6*hour+10,'actor2','owner');
assert.equal(count('owner'),4,'overlay unfollow no alert');
put('UPDATE explore_follow_overrides_348 SET following=1,updated_at=? WHERE follower_uid=? AND following_uid=?',now+6*hour+20,'actor2','owner');
assert.equal(count('owner'),4,'overlay re-follow same digest deduped');
put('INSERT INTO explore_follow_overrides_348 VALUES (?,?,?,?,?,?)',
 'actor','owner',1,1,now+7*hour,'baseline-no-change');
assert.equal(count('owner'),4,'overlay matching existing baseline is not a new follow');
assert.equal(count('actor'),0,'another account cannot see owners alerts');
const own=await readOwnNotificationInbox001({
  db:d1,authenticate:authOwner,activated:true,now:now+7*hour});
assert.equal(own.items.length,4);
assert.equal(own.items.every(v=>['like','follow'].includes(v.category)),true);
assert.equal((await readOwnNotificationInbox001({
  db:d1,authenticate:authActor,activated:true,now:now+7*hour})).items.length,0);
await assert.rejects(readOwnNotificationInbox001({
  db:d1,authenticate:async()=>null,activated:true}),/NOTIFICATION_NOT_AUTHENTICATED/);
const originalCount=count('owner');
// Old event: create another valid changed like before retention cutoff.
// It cannot appear in an authenticated list after 30 days even before cleanup.
const older=now-NOTIFICATION_RETENTION_MS_002-2*hour;
put('INSERT INTO likes VALUES (?,?,?)','track','actor2',older);
assert.equal(count('owner'),originalCount+1);
const displayed=await readOwnNotificationInbox001({db:d1,
  authenticate:authOwner,activated:true,now:now+7*hour});
assert.equal(displayed.items.length,originalCount,
  '30-day server read cutoff conceals an expired row');
const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT receiver_uid
  FROM soridraw_notification_inbox_001 WHERE created_at<? ORDER BY created_at LIMIT 100`).all(now);
assert.equal(plan.some(p=>String(p.detail).includes('idx_soridraw_notification_expiry_002')),true,
  'central expiry uses indexed time range, not a full user scan');
assert.deepEqual(await cleanupExpiredNotificationInbox002({
  db:d1,activated:true,now:now+7*hour,limit:1}),{status:'ok',rowsDeleted:1});
assert.equal(count('owner'),originalCount);
assert.deepEqual(await cleanupExpiredNotificationInbox002({
  db:d1,activated:true,now:now+7*hour,limit:1}),{status:'ok',rowsDeleted:0});
await assert.rejects(cleanupExpiredNotificationInbox002({
  db:d1,activated:true,now:now+7*hour,limit:500}),/NOTIFICATION_CLEANUP_INVALID/);
// Announcement: one shared row; never one row per user.
const notice={id:'notice-global',title:'Update',body:'We updated.',publishedAtMs:now};
assert.equal((await publishGlobalAnnouncement001({db:d1,
  announcement:notice,verifyAdmin:async()=>true,activated:true})).rowsWritten,1);
assert.equal((await publishGlobalAnnouncement001({db:d1,
  announcement:notice,verifyAdmin:async()=>true,activated:true})).rowsWritten,0);
await assert.rejects(publishGlobalAnnouncement001({db:d1,
  announcement:{...notice,id:'spoof'},verifyAdmin:async()=>false,activated:true}),
  /NOTIFICATION_ADMIN_DENIED/);
assert.equal((await readGlobalAnnouncements001({db:d1,activated:true})).items.length,1);
assert.equal(get('SELECT COUNT(*) AS n FROM soridraw_global_announcements_001').n,1);
assert.equal((await cleanupExpiredNotificationInbox002({db:d1,activated:false})).rowsDeleted,0);
const active=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.doesNotMatch(active,/notification-preferences-retention-002|notification-inbox-001/);
console.log('NOTIFICATION_D1_CANONICAL_LIKE_AND_BOTH_FOLLOW_PATHS=PASS');
console.log('NOTIFICATION_NOOP_UNLIKE_UNFOLLOW_DUPLICATE_OFF_W0=PASS');
console.log('NOTIFICATION_USER_AUTH_PREFERENCES_CAS_30DAY_RETENTION=PASS');
console.log('NOTIFICATION_ONE_SHARED_ANNOUNCEMENT_AND_BACKEND_DORMANT=PASS');

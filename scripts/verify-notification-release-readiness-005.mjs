import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  reconcileGlobalAnnouncementSnapshot005,runNotificationRetention005,
} from '../cloudflare/explore-worker/runtime/notification-retention-coordinator-005.mjs';
import {publishSharedAnnouncement004}
  from '../cloudflare/explore-worker/runtime/notification-unified-inbox-004.mjs';
import {NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001}
  from '../cloudflare/explore-worker/runtime/notification-inbox-001.mjs';

const source=p=>readFileSync(p,'utf8');
const entry=source('cloudflare/explore-worker/canonical/preview-entry.js');
const client=source('src/services/notifications/notificationInbox004.ts');
const settings=source('src/services/notifications/notificationAccountSyncCore003.ts');
const migration=source('cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql');
assert.match(migration,/SOURCE-ONLY CANDIDATE/);
assert.match(entry,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(entry,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.match(client,/NOTIFICATION_INBOX_ENABLED_004=false/);
assert.match(settings,/NOTIFICATION_ACCOUNT_SYNC_ENABLED_003 = false/);
assert.match(entry,/staffRolePresent: Object\.prototype\.hasOwnProperty\.call\(fields,'staffRole'\)/);
assert.match(entry,/staff\.role==='admin' && staff\.staffRolePresent===false/);
assert.doesNotMatch(entry,/runNotificationRetention005/,'no active cron or HTTP trigger');
assert.doesNotMatch(migration,/DROP TABLE|DROP TRIGGER|DELETE FROM/);

const now=1_800_000_000_000;
const old=now-31*86400000;
const db=new DatabaseSync(':memory:');
db.exec("CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);"+
  "CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);"+
  "CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));"+
  "CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));"+
  "CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));");
db.exec(source('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql'));
db.exec(source('cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql'));
db.exec(migration);
assert.equal(db.prepare('SELECT enabled FROM soridraw_notification_activation_002').get().enabled,0);
db.prepare('INSERT INTO soridraw_notification_inbox_001 VALUES (?,?,?,?,?,?,?,?)')
  .run('owner',old,'like','actor','track','Actor','Title',old);
db.prepare('INSERT INTO soridraw_notification_direct_messages_004 VALUES (?,?,?,?,?)')
  .run('owner','old-direct','Title','Private',old);
db.prepare('INSERT INTO soridraw_global_announcements_001 VALUES (?,?,?,?)')
  .run('old-global','Old','Expired',old);
db.prepare('INSERT INTO soridraw_global_announcements_001 VALUES (?,?,?,?)')
  .run('current-global','Current','Hello',now-1000);
const plan=db.prepare('EXPLAIN QUERY PLAN SELECT id FROM soridraw_global_announcements_001 WHERE published_at<? ORDER BY published_at ASC LIMIT 100').all(now);
assert.ok(plan.some(x=>String(x.detail).includes('idx_soridraw_global_expiry_005')));

const reads={d1:0,r2:0,put:0,changed:0};
const d1={prepare(sql){return{bind(...params){
  const stmt=db.prepare(sql);
  return {
    async all(){reads.d1++;return{results:stmt.all(...params)};},
    async first(){reads.d1++;return stmt.get(...params)||null;},
    async run(){const x=stmt.run(...params);reads.changed+=x.changes;return{meta:{changes:x.changes}};},
  };
}};}};
let etagNumber=0,conflictOnce=false;
const cache={
  value:null,
  async get(key){
    assert.equal(key,NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001);
    reads.r2++;
    const value=this.value;
    return value&&{etag:value.etag,json:async()=>value.payload};
  },
  async put(key,text,opts){
    assert.equal(key,NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001);
    reads.put++;
    if(conflictOnce){
      conflictOnce=false;
      this.value={etag:'racer',payload:{schema:1,items:[]}};
      return null;
    }
    if(opts.onlyIf instanceof Headers){
      assert.equal(opts.onlyIf.get('If-None-Match'),'*');
      if(this.value)return null;
    }else if(this.value?.etag!==opts.onlyIf?.etagMatches)return null;
    this.value={etag:'etag-'+(++etagNumber),payload:JSON.parse(text)};
    return{etag:this.value.etag};
  },
};
const count=t=>db.prepare('SELECT COUNT(*) AS n FROM '+t).get().n;
const inactive=await runNotificationRetention005({db:d1,cache,now});
assert.equal(inactive.status,'inactive');
assert.deepEqual(reads,{d1:0,r2:0,put:0,changed:0});
await assert.rejects(runNotificationRetention005({
  db:d1,cache,enabled:true,verifyMaintenance:async()=>false,now
}),/MAINTENANCE_FORBIDDEN/);
assert.deepEqual(reads,{d1:0,r2:0,put:0,changed:0});
const args={db:d1,cache,enabled:true,verifyMaintenance:async()=>true,now,limit:10};
const result=await runNotificationRetention005(args);
assert.deepEqual(result.byCategory,{social:1,direct:1,announcement:1});
assert.equal(result.rowsDeleted,3);
assert.equal(result.r2Writes,1);
assert.deepEqual(cache.value.payload.items,[{id:'current-global',title:'Current',body:'Hello',publishedAt:now-1000}]);
assert.equal(count('soridraw_notification_inbox_001'),0);
assert.equal(count('soridraw_notification_direct_messages_004'),0);
assert.equal(count('soridraw_global_announcements_001'),1);
const r2AfterFirst=reads.put;
const noChange=await runNotificationRetention005(args);
assert.equal(noChange.rowsDeleted,0);
assert.equal(noChange.r2Writes,0);
assert.equal(reads.put,r2AfterFirst,'unchanged scheduled pass must be R2 W0');
assert.ok(reads.d1<=3,'one global D1 read per pass, not one per user');

await assert.rejects(publishSharedAnnouncement004({
  db:d1,announcement:{id:'deny',title:'Deny',body:'No',publishedAtMs:now},
  verifyAdmin:async()=>false,
  reconcileSharedSnapshot:()=>reconcileGlobalAnnouncementSnapshot005({db:d1,cache,now}),
  enabled:true,
}),/NOTIFICATION_ADMIN_DENIED/);
assert.equal(count('soridraw_global_announcements_001'),1);

const message={id:'global-next',title:'Next',body:'Worldwide',publishedAtMs:now};
const publish=(id=message.id)=>publishSharedAnnouncement004({
  db:d1,announcement:{...message,id},verifyAdmin:async()=>true,
  reconcileSharedSnapshot:()=>reconcileGlobalAnnouncementSnapshot005({db:d1,cache,now}),
  enabled:true,
});
assert.equal((await publish()).rowsWritten,1);
assert.equal(cache.value.payload.items.length,2);
const r2AfterPublish=reads.put;
assert.equal((await publish()).rowsWritten,0);
assert.equal(reads.put,r2AfterPublish,'same ID retry must be D1 W0/R2 W0');

conflictOnce=true;
db.prepare('INSERT INTO soridraw_global_announcements_001 VALUES (?,?,?,?)')
  .run('global-concurrent','Parallel','New',now-10);
const reconciled=await reconcileGlobalAnnouncementSnapshot005({db:d1,cache,now});
assert.equal(reconciled.r2Writes,1,'CAS collision retries against fresh ETag');
assert.equal(cache.value.payload.items.length,3);

const unready=await runNotificationRetention005({db:d1,cache,enabled:false,now});
assert.equal(unready.status,'inactive');
console.log('NOTIFICATION_005_SOURCE_ONLY_FLAGS_AUTH_ADMIN=PASS');
console.log('NOTIFICATION_005_THREE_INDEXED_30DAY_EXPIRY_NO_FANOUT=PASS');
console.log('NOTIFICATION_005_R2_CAS_RETRY_AND_IDEMPOTENT_W0=PASS');
console.log('NOTIFICATION_005_MAINTENANCE_OFF_R0_W0=PASS');

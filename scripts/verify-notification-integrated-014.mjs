// Stage014: cross-feature, source-only notification integration contract.
// In-memory SQLite and fake R2 only; never contacts real Auth, D1, R2 or Worker.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleNotificationPreferencesApi003}
  from '../cloudflare/explore-worker/runtime/notification-preferences-api-003.mjs';
import {handleUnifiedNotificationsApi004}
  from '../cloudflare/explore-worker/runtime/notification-unified-api-004.mjs';
import {reconcileGlobalAnnouncementSnapshot005}
  from '../cloudflare/explore-worker/runtime/notification-retention-coordinator-005.mjs';
import {readUnifiedNotificationInbox004}
  from '../cloudflare/explore-worker/runtime/notification-unified-inbox-004.mjs';
import {runNotificationScheduled013,NOTIFICATION_RETENTION_CRON_013}
  from '../cloudflare/explore-worker/runtime/notification-retention-scheduler-013.mjs';

const read=p=>readFileSync(p,'utf8');
const worker=read('cloudflare/explore-worker/canonical/preview-entry.js');
const client=read('src/services/notifications/notificationInbox004.ts');
const prefsClient=read('src/services/notifications/notificationAccountSyncCore003.ts');
const wrangler=JSON.parse(read('cloudflare/explore-worker/canonical/wrangler.preview.jsonc'));
assert.match(worker,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.match(worker,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(worker,/NOTIFICATION_RETENTION_013_COMPILED_OPEN = true/);
assert.match(worker,/env\?\.SORIDRAW_ENVIRONMENT !== 'preview'/);
assert.match(client,/canUsePreviewInbox022\(window.location.hostname,EXPLORE_API_BASE\)/);
assert.doesNotMatch(client,/NOTIFICATION_INBOX_ENABLED_004=false/);
assert.match(prefsClient,/NOTIFICATION_ACCOUNT_SYNC_ENABLED_003 = false/);
assert.deepEqual(wrangler.triggers?.crons,[NOTIFICATION_RETENTION_CRON_013]);
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);

const sqlite=new DatabaseSync(':memory:');
sqlite.exec("CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);"+
 "CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);"+
 "CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));"+
 "CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));"+
 "CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));");
sqlite.exec(read('cloudflare/explore-worker/candidates/20261108_03_notification_inert_schema_release.sql'));
sqlite.exec(read('cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql'));
sqlite.exec(read('cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql'));
sqlite.exec(read('cloudflare/explore-worker/candidates/20261108_04_notification_triggers_off_release.sql'));
// Disposable SQLite only: new trigger contract is never installed on shared D1.
sqlite.exec(read('cloudflare/explore-worker/candidates/20261109_017_notification_dot_only_triggers_candidate.sql'));
const now=Date.now();
const cutoff=now-30*86400000;
const metrics={reads:0,changed:0,mutating:0};
let failNextRead=false,failNextPreferenceWrite=false;
const db={prepare(sql){
  return {
    bind(...args){const stmt=sqlite.prepare(sql);return{
      async first(){
        if(failNextRead){failNextRead=false;throw Error('SYNTHETIC_D1_READ_ERROR');}
        metrics.reads++;return stmt.get(...args)||null;
      },
      async all(){
        if(failNextRead){failNextRead=false;throw Error('SYNTHETIC_D1_READ_ERROR');}
        if(failNextPreferenceWrite && /^(?:INSERT OR IGNORE|UPDATE) soridraw_notification_preferences_002/i.test(sql.trim())){
          failNextPreferenceWrite=false;throw Error('SYNTHETIC_D1_PREF_WRITE_ERROR');
        }
        metrics.reads++;
        const result=stmt.all(...args);
        if(/^(?:INSERT|UPDATE|DELETE)\b/i.test(sql.trim())){
          metrics.mutating++;metrics.changed+=result.length;
        }
        return {results:result};
      },
      async run(){
        const r=stmt.run(...args);
        metrics.mutating++;metrics.changed+=r.changes;
        return {meta:{changes:r.changes}};
      },
    };},
    async first(){metrics.reads++;return sqlite.prepare(sql).get()||null;},
  };
}};
let failNextR2Put=false,serial=0;
const cache={
  value:null,reads:0,writes:0,
  async get(){
    this.reads++;
    return this.value&&{etag:this.value.etag,json:async()=>this.value.payload};
  },
  async put(key,text,opts){
    assert.equal(key,'internal/notifications/global-announcements-v1.json');
    if(failNextR2Put){failNextR2Put=false;throw Error('SYNTHETIC_R2_PUT_FAILED');}
    if(this.value){
      if(opts?.onlyIf?.etagMatches!==this.value.etag)return null;
    }else {
      assert.ok(opts?.onlyIf instanceof Headers);
      assert.equal(opts.onlyIf.get('If-None-Match'),'*');
    }
    this.writes++;this.value={etag:'etag-'+(++serial),payload:JSON.parse(text)};
    return {etag:this.value.etag};
  },
};
const count=t=>sqlite.prepare('SELECT COUNT(*) AS n FROM '+t).get().n;
const inboxCount=()=>count('soridraw_notification_inbox_001');
const directCount=()=>count('soridraw_notification_direct_messages_004');
const globalCount=()=>count('soridraw_global_announcements_001');
const prefsCount=()=>count('soridraw_notification_preferences_002');
const op=n=>'stage014-integrated-'+String(n).padStart(4,'0');
const defaults={master:true,like:true,follow:true,complete:true,announcement:true,message:true};
const baseUrl='https://preview.example';
const prefUrl=baseUrl+'/v1/me/notifications/preferences';
const inboxUrl=baseUrl+'/v1/me/notifications/inbox';
const adminMsgUrl=baseUrl+'/v1/admin/notifications/message';
const adminGlobalUrl=baseUrl+'/v1/admin/notifications/announcement';
const request=(url,method='GET',payload)=>new Request(url,{
  method,
  ...(payload?{headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)}:{}),
});
const preference=async(method,actor,payload,enabled=true,url=prefUrl)=>{
  const response=await handleNotificationPreferencesApi003({
    request:request(url,method,payload),db,
    verifyAuthenticatedUid:async()=>actor,enabled,
  });
  return {code:response.status,body:await response.json(),
    cache:response.headers.get('Cache-Control')};
};
const unified=async(url,actor,method='GET',payload,enabled=true)=>{
  const response=await handleUnifiedNotificationsApi004({
    request:request(url,method,payload),db,cache,
    verifyUid:async()=>actor,verifyAdmin:async(_request,uid)=>uid==='admin',
    enabled,
  });
  return {code:response.status,body:await response.json(),
    cache:response.headers.get('Cache-Control')};
};
const mutationSnapshot=()=>({prefs:prefsCount(),inbox:inboxCount(),
  direct:directCount(),global:globalCount(),writes:metrics.changed,r2:cache.writes});
const before=mutationSnapshot();
assert.equal((await preference('GET','alice',undefined,false)).code,404);
assert.equal((await unified(inboxUrl,'alice','GET',undefined,false)).code,404);
assert.equal((await unified(inboxUrl,'','GET')).code,401);
assert.equal((await preference('GET','')).code,401);
assert.deepEqual(mutationSnapshot(),before,'disabled/unauthorized requests must not mutate');
const defaultRead=await preference('GET','alice');
assert.equal(defaultRead.code,200);
assert.deepEqual(defaultRead.body.data.preferences,{revision:0,...defaults});
assert.equal(defaultRead.cache,'private, no-store');
assert.equal(prefsCount(),0,'visiting settings cannot write defaults');

const bobOff={...defaults,master:false,like:false};
const bobSave=await preference('PUT','bob',{...bobOff,expectedRevision:0,operationId:op(1)});
assert.equal(bobSave.code,200);
assert.equal(bobSave.body.data.status,'saved');
assert.equal(bobSave.body.data.rowsWritten,1);
assert.equal((await preference('GET','bob')).body.data.preferences.master,false);
assert.deepEqual((await preference('GET','alice')).body.data.preferences,{revision:0,...defaults},
  'Alice never inherits Bob settings');
const wrongUid=await preference('PUT','bob',{
  ...defaults,expectedRevision:1,operationId:op(2),userUid:'alice'});
assert.equal(wrongUid.code,400);
const staleBob=await preference('PUT','bob',{...defaults,expectedRevision:0,operationId:op(3)});
assert.equal(staleBob.code,409,'stale browser must not reset Bob master OFF');
const bobReplay=await preference('PUT','bob',{...bobOff,expectedRevision:0,operationId:op(1)});
assert.equal(bobReplay.code,200);
assert.equal(bobReplay.body.data.rowsWritten,0);
assert.equal(prefsCount(),1);
assert.equal((await unified(inboxUrl+'?uid=alice','bob')).body.data.items.length,0,
  'arbitrary query UID cannot expose Alice inbox');
console.log('NOTIFICATION_014_ACCOUNT_CAS_IDENTITY_OFF_NOOP=PASS');

sqlite.prepare('INSERT INTO public_profiles VALUES(?,?,?)').run('alice','Alice',1);
sqlite.prepare('INSERT INTO public_profiles VALUES(?,?,?)').run('bob','Bob',1);
sqlite.prepare('INSERT INTO public_profiles VALUES(?,?,?)').run('actor','Actor',1);
sqlite.prepare('INSERT INTO public_profiles VALUES(?,?,?)').run('admin','Admin',1);
sqlite.prepare('INSERT INTO tracks VALUES(?,?,?,?,?)').run('song-alice','alice','Track A',1,'published');
sqlite.prepare('INSERT INTO tracks VALUES(?,?,?,?,?)').run('song-bob','bob','Track B',1,'published');
// Only simulated local activation; every real environment remains OFF.
assert.equal(sqlite.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
sqlite.exec('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1');
const like=sqlite.prepare('INSERT OR IGNORE INTO likes VALUES(?,?,?)');
like.run('song-alice','actor',now-3000);
like.run('song-alice','actor',now-3000);
like.run('song-bob','actor',now-3000);
assert.equal(inboxCount(),2,'both likes recorded although Bob dots OFF');
const follow=sqlite.prepare('INSERT OR IGNORE INTO follows VALUES(?,?,?)');
follow.run('actor','alice',now-2000);
follow.run('actor','alice',now-2000);
sqlite.prepare('INSERT OR IGNORE INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)')
 .run('actor','alice',1,0,now-2000,'same-final-follow');
assert.equal(inboxCount(),3,'legacy and overlay same follow must be deduplicated');
const denial=await unified(adminMsgUrl,'alice','POST',{
  id:'direct-1',receiverUid:'alice',title:'Private',body:'Secret'});
assert.equal(denial.code,403);
assert.equal(directCount(),0,'non-admin cannot send private message');
const sendAlice=await unified(adminMsgUrl,'admin','POST',{
  id:'direct-1',receiverUid:'alice',title:'Private',body:'Secret'});
assert.equal(sendAlice.code,200);
assert.equal(sendAlice.body.data.rowsWritten,1);
const msgAgain=await unified(adminMsgUrl,'admin','POST',{
  id:'direct-1',receiverUid:'alice',title:'Private',body:'Secret'});
assert.equal(msgAgain.body.data.rowsWritten,0);
assert.equal((await unified(adminMsgUrl,'admin','POST',{
  id:'direct-2',receiverUid:'bob',title:'Private',body:'Still delivered'})).body.data.rowsWritten,1);
assert.equal(directCount(),2,'both direct messages must be recorded despite dots OFF');
const notice={id:'global-1',title:'News',body:'Release',publishedAtMs:now-1000};
assert.equal((await unified(adminGlobalUrl,'alice','POST',notice)).code,403);
const global=await unified(adminGlobalUrl,'admin','POST',notice);
assert.equal(global.code,200);
assert.equal(global.body.data.rowsWritten,1);
assert.equal(cache.writes,1,'only one shared announcement R2 snapshot');
const globalReplay=await unified(adminGlobalUrl,'admin','POST',notice);
assert.equal(globalReplay.code,200);
assert.equal(globalReplay.body.data.rowsWritten,0);
assert.equal(cache.writes,1,'replay must use R2 W0');
assert.equal(globalCount(),1);
const aliceView=await unified(inboxUrl,'alice');
assert.equal(aliceView.code,200);
assert.deepEqual(aliceView.body.data.preferences,{revision:0,...defaults});
assert.equal(aliceView.cache,'private, no-store');
assert.deepEqual(new Set(aliceView.body.data.items.map(x=>x.category)),
  new Set(['like','follow','message','announcement']));
const otherView=await unified(inboxUrl+'?uid=alice','actor');
assert.equal(otherView.code,200);
assert.deepEqual(otherView.body.data.items.map(x=>x.category),['announcement'],
  'other account only sees genuinely shared announcement');
const bobView=await unified(inboxUrl,'bob');
assert.equal(bobView.body.data.preferences.master,false);
assert.deepEqual(new Set(bobView.body.data.items.map(x=>x.category)),
  new Set(['like','message','announcement']),
  'Bob master OFF hides dots, not incoming messages');
console.log('NOTIFICATION_014_AUTH_ADMIN_PRIVATE_NO_CROSS_ACCOUNT_LEAK=PASS');
console.log('NOTIFICATION_014_LIKE_FOLLOW_DIGEST_AND_R2_IDEMPOTENCE=PASS');

// Change settings across PC/mobile; stored categories remain visible.
const reduced={...defaults,like:false,message:false,announcement:false};
const aliceOff=await preference('PUT','alice',{...reduced,expectedRevision:0,operationId:op(4)});
assert.equal(aliceOff.code,200);
assert.equal(aliceOff.body.data.preferences.revision,1);
const allAfterDotOff=(await unified(inboxUrl,'alice')).body.data.items;
assert.deepEqual(new Set(allAfterDotOff.map(x=>x.category)),
  new Set(['like','follow','message','announcement']));
assert.equal((await unified(inboxUrl,'alice')).body.data.preferences.like,false);
const staleAlice=await preference('PUT','alice',{...defaults,expectedRevision:0,operationId:op(5)});
assert.equal(staleAlice.code,409);
assert.equal(staleAlice.body.data.preferences.like,false);
const failureBase=mutationSnapshot();
failNextPreferenceWrite=true;
const failedSave=await preference('PUT','alice',{
  ...defaults,expectedRevision:1,operationId:op(6)});
assert.equal(failedSave.code,503,'SQL error must not ACK as saved');
assert.deepEqual(mutationSnapshot(),failureBase);
const restored=await preference('PUT','alice',{...defaults,expectedRevision:1,operationId:op(6)});
assert.equal(restored.code,200);
assert.equal(restored.body.data.preferences.revision,2);
assert.equal((await unified(inboxUrl,'alice')).body.data.items.length,4);
failNextRead=true;
assert.equal((await unified(inboxUrl,'alice')).code,503);
assert.equal((await unified(inboxUrl,'alice')).code,200,
  'subsequent read after outage must recover');
console.log('NOTIFICATION_014_CROSS_DEVICE_STALE_SETTINGS_AND_FAILURE_RETRY=PASS');

// 30d visibility before and after maintenance: no read-triggered deletes.
const tooOld=cutoff-1;
const bucket=t=>Math.floor(t/7200000)*7200000;
const socialRow=(name,time)=>sqlite.prepare(
 'INSERT INTO soridraw_notification_inbox_001 VALUES(?,?,?,?,?,?,?,?)')
 .run('alice',bucket(time),'like','extra-'+name,'song-'+name,'Actor','Track',time);
const directRow=(name,time)=>sqlite.prepare(
 'INSERT INTO soridraw_notification_direct_messages_004 VALUES(?,?,?,?,?)')
 .run('alice',name,'Title','Private',time);
const globalRow=(name,time)=>sqlite.prepare(
 'INSERT INTO soridraw_global_announcements_001 VALUES(?,?,?,?)')
 .run(name,'Title','Public',time);
socialRow('expired',tooOld);directRow('expired',tooOld);globalRow('expired',tooOld);
// Exact boundary is measured at a fixed clock. The HTTP API uses a later
// Date.now(); keep a separate +60s visible row to avoid millisecond races.
socialRow('exact',cutoff);directRow('exact',cutoff);globalRow('exact',cutoff);
socialRow('edge',cutoff+60000);directRow('edge',cutoff+60000);globalRow('edge',cutoff+60000);
await reconcileGlobalAnnouncementSnapshot005({db,cache,now});
const exactBoundary=await readUnifiedNotificationInbox004({
 db,authenticate:async()=> 'alice',
 readSharedAnnouncements:async()=>cache.value.payload.items,
 enabled:true,now,
});
assert.equal(exactBoundary.items.some(x=>x.id==='direct:exact'),true);
assert.equal(exactBoundary.items.some(x=>x.id==='global:exact'),true);
assert.equal(exactBoundary.items.some(x=>x.id==='direct:expired'),false);
const preCleanup=mutationSnapshot();
const edgeView=await unified(inboxUrl,'alice');
assert.equal(edgeView.code,200);
assert.equal(edgeView.body.data.items.some(x=>x.id==='direct:expired'),false);
assert.equal(edgeView.body.data.items.some(x=>x.id==='direct:edge'),true);
assert.equal(edgeView.body.data.items.some(x=>x.id==='global:expired'),false);
assert.equal(edgeView.body.data.items.some(x=>x.id==='global:edge'),true);
assert.deepEqual(mutationSnapshot(),preCleanup,'inbox read must never perform cleanup');
const env={DB:db,PROFILE_MEDIA:cache,
 SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_NOTIFICATION_RETENTION_013:'1',
 SORIDRAW_NOTIFICATION_SCHEMA_READY_013:'1'};
const controller={cron:NOTIFICATION_RETENTION_CRON_013};
const offBefore=mutationSnapshot();
assert.equal((await runNotificationScheduled013({controller,env,now})).status,'inactive');
assert.deepEqual(mutationSnapshot(),offBefore,'compile-off must use W0');
const cleaned=await runNotificationScheduled013({controller,env,compiledOpen:true,now,maxPasses:2});
assert.equal(cleaned.status,'ok');
assert.deepEqual(cleaned.byCategory,{social:1,direct:1,announcement:1});
const post=await unified(inboxUrl,'alice');
assert.equal(post.code,200);
assert.equal(post.body.data.items.some(x=>x.id==='direct:edge'),true);
assert.equal(post.body.data.items.some(x=>x.id==='global:edge'),true);
assert.equal(inboxCount(),5,'three settled social + exact cutoff + visible edge');
assert.equal(directCount(),4,'two recipient direct + exact cutoff + visible edge');
assert.equal(globalCount(),3,'one shared + exact cutoff + visible edge');
const writesAfter=metrics.changed,r2After=cache.writes;
const again=await runNotificationScheduled013({controller,env,compiledOpen:true,now});
assert.equal(again.rowsDeleted,0);
assert.equal(again.r2Writes,0);
assert.equal(metrics.changed,writesAfter);
assert.equal(cache.writes,r2After);
console.log('NOTIFICATION_014_30DAY_READER_NO_WRITES_CUTOFF_KEEP=PASS');
console.log('NOTIFICATION_014_SCHEDULED_NOOP_AND_REPLAY_W0=PASS');

// R2 fails after D1 committed: response must be 503, retry same ID W0
// and repair the shared cache without fan-out or double delivery.
const pending={id:'global-recover',title:'Retry',body:'Repair',publishedAtMs:now};
failNextR2Put=true;
const priorD1=globalCount(),priorR2=cache.writes;
const bad=await unified(adminGlobalUrl,'admin','POST',pending);
assert.equal(bad.code,503,'unconfirmed R2 update must fail closed');
assert.equal(globalCount(),priorD1+1,'canonical once, R2 not yet refreshed');
assert.equal(cache.writes,priorR2);
assert.equal((await unified(inboxUrl,'alice')).body.data.items.some(x=>x.id==='global:global-recover'),false);
const repaired=await unified(adminGlobalUrl,'admin','POST',pending);
assert.equal(repaired.code,200);
assert.equal(repaired.body.data.rowsWritten,0,'same global ID must not duplicate D1');
assert.equal(cache.writes,priorR2+1);
assert.equal((await unified(inboxUrl,'alice')).body.data.items.filter(x=>x.id==='global:global-recover').length,1);
const sources=['likes','follows','tracks','public_profiles'];
assert.deepEqual(sources.map(count),[2,1,2,4],
 'notification maintenance must preserve all canonical like/follow/song/profile rows');
sqlite.close();
console.log('NOTIFICATION_014_R2_COMMIT_FAILURE_REPLAY_REPAIRS=PASS');
console.log('NOTIFICATION_014_ORIGINAL_CANONICAL_DATA_UNCHANGED=PASS');
console.log('NOTIFICATION_014_REAL_AUTH_AND_DEPLOY=NOT_TESTED_OR_ENABLED');

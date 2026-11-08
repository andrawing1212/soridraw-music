import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {transform} from 'esbuild';
import {handleUnifiedNotificationsApi004}
 from '../cloudflare/explore-worker/runtime/notification-unified-api-004.mjs';
import {readUnifiedNotificationInbox004,publishPrivateNotification004,
 publishSharedAnnouncement004,cleanupExpiredDirectMessages004}
 from '../cloudflare/explore-worker/runtime/notification-unified-inbox-004.mjs';
const text=p=>readFileSync(p,'utf8');
const sql=text('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql');
const directSql=text('cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql');
const entry=text('cloudflare/explore-worker/canonical/preview-entry.js');
const panel=text('src/components/studio/NotificationPanel.tsx');
const client=text('src/services/notifications/notificationInbox004.ts');
const app=text('src/App.tsx');
assert.match(directSql,/SOURCE-ONLY/);
assert.match(directSql,/PRIMARY KEY\(receiver_uid,id\)/);
assert.match(directSql,/idx_soridraw_direct_expiry_004/);
assert.match(entry,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.match(entry,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(entry,/validateExploreAuth307\(request,env,ctx\)/);
assert.match(entry,/readOwnStaffProfile307\(actor\)/);
assert.match(entry,/RELEASE_ALLOWED_ORIGINS_036\.has\(origin\)/);
assert.match(client,/NOTIFICATION_INBOX_ENABLED_004=false/);
assert.match(client,/projectCompletedExistingGenerations004/);
assert.match(client,/recentResult=typeof song\.status==='undefined'/);
assert.match(client,/typeof song\.prompt==='string'/);
assert.match(client,/status!=='completed'/);
assert.match(client,/getFirebaseAppCheckToken/);
assert.match(client,/cache:'no-store'/);
assert.match(panel,/loadOwnNotifications004\(current\)/);
assert.match(panel,/remoteInbox\.uid === uid \? remoteInbox\.items : \[\]/);
assert.match(panel,/projectCompletedExistingGenerations004\(recentHistory\)/);
assert.match(app,/<Navigation[\s\S]*?recentHistory=\{history\}/);
assert.match(app,/activeWorkspace=\{studioRailActiveWorkspace\}\s+recentHistory=\{history\}/);
assert.match(app,/<ExploreShellLazy isAdminUser=\{isAdminUser\} recentHistory=\{history\}/);
assert.match(text('src/components/explore/ExploreShell.tsx'),/recentHistory=\{recentHistory\}/);
assert.match(text('src/components/studio/StudioLeftRail.tsx'),/recentHistory=\{recentHistory\}/);
assert.doesNotMatch(panel,/setInterval\(|onSnapshot\(|getDocs\(|getDoc\(/);
await transform(client,{loader:'ts',format:'esm',target:'es2022'});
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);'
  +'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);'
  +'CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));'
  +'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));'
  +'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));');
db.exec(sql);db.exec(directSql);
const counts={read:0,write:0};
const d1={
  prepare(q){
    return {
      bind(...values){
        const stmt=db.prepare(q);
        return {
          async first(){
            counts.read++;
            return stmt.get(...values)||null;
          },
          async all(){
            counts.read++;
            return {results:stmt.all(...values)};
          },
          async run(){
            counts.write++;
            return {meta:{changes:stmt.run(...values).changes}};
          },
        };
      },
    };
  },
};
const put=(q,...v)=>db.prepare(q).run(...v);
const count=q=>db.prepare('SELECT COUNT(*) AS n FROM '+q).get().n;
const now=Date.now();
assert.equal((await readUnifiedNotificationInbox004({db:d1,enabled:false})).status,'inactive');
assert.equal(counts.read+counts.write,0);
put('INSERT INTO public_profiles VALUES (?,?,?)','owner','Maker',1);
put('INSERT INTO public_profiles VALUES (?,?,?)','actor','Listener',1);
put('INSERT INTO tracks VALUES (?,?,?,?,?)','song','owner','New Song',1,'published');
put('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1');
put('INSERT INTO likes VALUES (?,?,?)','song','actor',now);
assert.equal(count('soridraw_notification_inbox_001'),1);
const yes=async()=>true,no=async()=>false;
const announcement={id:'global-1',title:'업데이트',body:'전체공지',publishedAtMs:now};
let common=[],publishes=0,commonReads=0;
const putCommon=async x=>{common=x;publishes++};
const readCommon=async()=>{commonReads++;return common};
const reconcileSharedSnapshot=async()=>{
  await putCommon([announcement]);
  return {status:'updated',snapshotSize:1};
};
await assert.rejects(publishSharedAnnouncement004({
 db:d1,announcement,verifyAdmin:no,reconcileSharedSnapshot,enabled:true
}),/NOTIFICATION_ADMIN_DENIED/);
assert.equal((await publishSharedAnnouncement004({
 db:d1,announcement,verifyAdmin:yes,reconcileSharedSnapshot,enabled:true
})).rowsWritten,1);
assert.equal((await publishSharedAnnouncement004({
 db:d1,announcement,verifyAdmin:yes,reconcileSharedSnapshot,enabled:true
})).rowsWritten,0);
assert.equal(count('soridraw_global_announcements_001'),1);
assert.equal(publishes,2,'one shared snapshot repair, never user fanout');
const msg={id:'direct-1',title:'개인 안내',body:'비공개 메시지'};
await assert.rejects(publishPrivateNotification004({
 db:d1,receiverUid:'owner',message:msg,verifyAdmin:no,enabled:true
}),/NOTIFICATION_ADMIN_REQUIRED/);
assert.equal((await publishPrivateNotification004({
 db:d1,receiverUid:'owner',message:msg,verifyAdmin:yes,enabled:true,now
})).rowsWritten,1);
assert.equal((await publishPrivateNotification004({
 db:d1,receiverUid:'owner',message:msg,verifyAdmin:yes,enabled:true,now
})).rowsWritten,0);
assert.equal(count('soridraw_notification_direct_messages_004'),1);
const own=await readUnifiedNotificationInbox004({
 db:d1,authenticate:async()=> 'owner',readSharedAnnouncements:readCommon,
 enabled:true,now});
assert.equal(own.items.length,3);
assert.deepEqual(new Set(own.items.map(x=>x.category)),
 new Set(['like','message','announcement']));
assert.equal(own.items.find(x=>x.category==='message').body,msg.body);
const other=await readUnifiedNotificationInbox004({
 db:d1,authenticate:async()=> 'stranger',readSharedAnnouncements:readCommon,
 enabled:true,now});
assert.deepEqual(other.items.map(x=>x.category),['announcement']);
await assert.rejects(readUnifiedNotificationInbox004({
 db:d1,authenticate:async()=>null,enabled:true
}),/NOTIFICATION_AUTH_REQUIRED/);
const url='https://soridraw-preview.example/v1/me/notifications/inbox';
const cache={get:async()=>({json:async()=>({schema:1,items:common})})};
const response=await handleUnifiedNotificationsApi004({
 request:new Request(url),db:d1,cache,enabled:true,
 verifyUid:async()=> 'owner'});
assert.equal(response.status,200);
assert.equal((await response.json()).data.items.length,3);
assert.equal(response.headers.get('Cache-Control'),'private, no-store');
assert.equal((await handleUnifiedNotificationsApi004({
 request:new Request(url),db:d1,enabled:false})).status,404);
assert.equal((await handleUnifiedNotificationsApi004({
 request:new Request(url),db:d1,enabled:true,verifyUid:async()=>null})).status,401);
const adminUrl='https://soridraw-preview.example/v1/admin/notifications/message';
const makeRequest=()=>new Request(adminUrl,{method:'POST',
 body:JSON.stringify({receiverUid:'owner',...msg})});
const denied=await handleUnifiedNotificationsApi004({
 request:makeRequest(),db:d1,enabled:true,
 verifyUid:async()=> 'actor',verifyAdmin:no});
assert.equal(denied.status,403);
assert.equal(count('soridraw_notification_direct_messages_004'),1);
const accepted=await handleUnifiedNotificationsApi004({
 request:makeRequest(),db:d1,enabled:true,
 verifyUid:async()=> 'actor',verifyAdmin:yes});
assert.equal(accepted.status,200);
assert.equal((await accepted.json()).data.rowsWritten,0);
put('INSERT INTO soridraw_notification_preferences_002 '
  +'(user_uid,master_enabled,like_enabled,follow_enabled,complete_enabled,announcement_enabled,message_enabled,revision,operation_id,updated_at) '
  +'VALUES(?,?,?,?,?,?,?,?,?,?)',
 'owner',0,1,1,1,1,1,1,'safety-owner-off',now);
commonReads=0;counts.read=0;
const off=await readUnifiedNotificationInbox004({
 db:d1,authenticate:async()=> 'owner',readSharedAnnouncements:readCommon,
 enabled:true,now});
assert.equal(off.items.length,0);
assert.equal(commonReads,0);
assert.equal(counts.read,1);
assert.equal((await publishPrivateNotification004({
 db:d1,receiverUid:'owner',message:{...msg,id:'new2'},
 verifyAdmin:yes,enabled:true,now})).rowsWritten,0);
put('INSERT INTO soridraw_notification_direct_messages_004 VALUES (?,?,?,?,?)',
 'owner','old','old','old',now-31*86400000);
const plan=db.prepare('EXPLAIN QUERY PLAN SELECT receiver_uid,id FROM '
 +'soridraw_notification_direct_messages_004 WHERE created_at<? '
 +'ORDER BY created_at LIMIT 100').all(now);
assert.ok(plan.some(x=>String(x.detail).includes('idx_soridraw_direct_expiry_004')));
assert.equal((await cleanupExpiredDirectMessages004({
 db:d1,enabled:false,now})).rowsDeleted,0);
assert.equal((await cleanupExpiredDirectMessages004({
 db:d1,enabled:true,now,limit:1})).rowsDeleted,1);
console.log('NOTIFICATION_004_AUTH_PRIVATE_ADMIN_ONLY=PASS');
console.log('NOTIFICATION_004_GLOBAL_SINGLE_DIRECT_SINGLE_W0_RETRY=PASS');
console.log('NOTIFICATION_004_EXISTING_RECENT_PROJECTION_NO_EXTRA_STORAGE=PASS');
console.log('NOTIFICATION_004_OFF_R0_W0_NO_POLLING=PASS');
console.log('NOTIFICATION_004_BOUNDED_INDEXED_RETENTION=PASS');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {transform} from 'esbuild';
import {handleNotificationPreferencesApi003} from '../cloudflare/explore-worker/runtime/notification-preferences-api-003.mjs';
const coreText=readFileSync('src/services/notifications/notificationAccountSyncCore003.ts','utf8');
const compiled=(await transform(coreText,{loader:'ts',format:'esm',target:'es2022'})).code;
const core=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const {
  NOTIFICATION_ACCOUNT_SYNC_ENABLED_003,parseNotificationAccountSettings003,
  NOTIFICATION_ACCOUNT_DEFAULT_003, reconcileNotificationAccountSettings003,
  sameNotificationChoices003,
}=core;
assert.equal(NOTIFICATION_ACCOUNT_SYNC_ENABLED_003,false,'no browser requests before shared release');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const panel=readFileSync('src/components/studio/NotificationPanel.tsx','utf8');
const client=readFileSync('src/services/notifications/notificationAccountSync003.ts','utf8');
assert.match(entry,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.match(entry,/env\?\.SORIDRAW_NOTIFICATION_PREFS_003 === '1'/);
assert.match(entry,/validateExploreAuth307\(request,env,ctx\)/);
assert.match(entry,/RELEASE_ALLOWED_ORIGINS_036\.has\(origin\)/);
assert.match(panel,/if \(!open \|\| !settingsOpen \|\| !NOTIFICATION_ACCOUNT_SYNC_ENABLED_003\) return/);
assert.match(panel,/loadNotificationAccountSettings003\(user, \{master:localMaster,\.\.\.local\}\)/);
assert.match(panel,/saveNotificationAccountSettings003\(user,/);
assert.match(panel,/const accountSyncLocked = NOTIFICATION_ACCOUNT_SYNC_ENABLED_003/);
assert.match(client,/cache:'no-store'/);
assert.match(client,/user\.getIdToken\(\)/);
assert.match(client,/getFirebaseAppCheckToken\(\)/);
assert.doesNotMatch(client,/setInterval|onSnapshot|setDoc|localStorage/);

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE soridraw_notification_preferences_002(
 user_uid TEXT PRIMARY KEY,master_enabled INTEGER NOT NULL,
 like_enabled INTEGER NOT NULL,follow_enabled INTEGER NOT NULL,
 complete_enabled INTEGER NOT NULL,announcement_enabled INTEGER NOT NULL,
 message_enabled INTEGER NOT NULL,revision INTEGER NOT NULL,
 operation_id TEXT NOT NULL,updated_at INTEGER NOT NULL) WITHOUT ROWID;`);
const mockD1={prepare(sql){
  return {bind(...params){
    const stmt=db.prepare(sql);
    return {
      async first(){return stmt.get(...params)||null;},
      async all(){return {results:stmt.all(...params)};},
      async run(){return {meta:{changes:stmt.run(...params).changes}};},
    };
  }};
}};
const route='https://preview-worker.example/v1/me/notifications/preferences';
const request=(method,body)=>new Request(route,{
 method,headers:body?{'Content-Type':'application/json'}:{},
 ...(body?{body:JSON.stringify(body)}:{}),
});
const send=async(method,user,body,enabled=true)=>{
 const response=await handleNotificationPreferencesApi003({
   request:request(method,body), db:mockD1,
   verifyAuthenticatedUid:async()=>user, enabled,
   cors:{'Access-Control-Allow-Origin':'https://preview.soridraw.com'},
 });
 return {status:response.status,body:await response.json(),
   cache:response.headers.get('Cache-Control')};
};
const original=NOTIFICATION_ACCOUNT_DEFAULT_003;
const base=await send('GET','owner');
assert.equal(base.status,200);
assert.deepEqual(base.body.data.preferences,{revision:0,...original});
assert.equal(base.cache,'private, no-store');
assert.equal(db.prepare('SELECT count(*) AS n FROM soridraw_notification_preferences_002').get().n,0,
  'opening defaults is R1 and never writes');
const forbidden=await send('GET','',undefined,true);
assert.equal(forbidden.status,401);
assert.equal((await send('GET','owner',undefined,false)).status,404);
assert.equal(db.prepare('SELECT count(*) AS n FROM soridraw_notification_preferences_002').get().n,0,
 'inactive route cannot write');
const off={...original,master:false,like:false};
const operation='accountoperation00000001';
const put=await send('PUT','owner',{...off,expectedRevision:0,operationId:operation});
assert.equal(put.status,200);
assert.equal(put.body.data.status,'saved');
assert.equal(put.body.data.rowsWritten,1);
assert.equal(put.body.data.preferences.revision,1);
const replay=await send('PUT','owner',{...off,expectedRevision:0,operationId:operation});
assert.equal(replay.status,200);
assert.equal(replay.body.data.rowsWritten,0,'duplicate replay changes no rows');
const mobile=await send('GET','owner');
assert.equal(mobile.body.data.preferences.master,false);
assert.equal(mobile.body.data.preferences.like,false);
assert.equal(mobile.body.data.preferences.revision,1);
assert.deepEqual((await send('GET','other')).body.data.preferences,{revision:0,...original},
  'other UID cannot read owner settings');
const changed={...off,follow:false};
const mobileWrite=await send('PUT','owner',{
 ...changed,expectedRevision:1,operationId:'accountoperation00000002'});
assert.equal(mobileWrite.status,200);
assert.equal(mobileWrite.body.data.preferences.revision,2);
const pcStale=await send('PUT','owner',{
 ...original,expectedRevision:1,operationId:'accountoperation00000003'});
assert.equal(pcStale.status,409);
assert.equal(pcStale.body.error.code,'NOTIFICATION_REVISION_CONFLICT');
assert.equal(pcStale.body.data.preferences.revision,2);
assert.equal(pcStale.body.data.preferences.master,false,
  'old PC must not undo mobile OFF');
assert.equal((await send('PUT','owner',{
 ...original,expectedRevision:0,operationId:'accountoperation00000004',uid:'other'})).status,400,
  'body cannot impersonate another UID');
assert.equal((await send('PUT','owner',{
 ...original,expectedRevision:2,operationId:'short'})).status,400);
assert.equal((await send('DELETE','owner')).status,405);
const opts=await handleNotificationPreferencesApi003({
 request:new Request(route,{method:'OPTIONS'}),enabled:true});
assert.equal(opts.status,204);
assert.equal(opts.headers.get('Access-Control-Allow-Methods'),'GET, PUT, OPTIONS');
const oversized=await handleNotificationPreferencesApi003({
 request:new Request(route,{method:'PUT',body:'x'.repeat(2049)}),
 db:mockD1,enabled:true,verifyAuthenticatedUid:async()=> 'owner'});
assert.equal(oversized.status,413);
const failing=await handleNotificationPreferencesApi003({
 request:request('GET'),db:null,enabled:true,
 verifyAuthenticatedUid:async()=> 'owner'});
assert.equal(failing.status,503);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_preferences_002').get().n,1);

const remoteDefault={revision:0,...original};
let calls=[];
let result=await reconcileNotificationAccountSettings003(original,
 async()=>{calls.push('read');return remoteDefault;},
 async()=>{calls.push('write');throw Error('unexpected default write');});
assert.deepEqual(calls,['read'],'default user incurs no migration writes');
assert.equal(result.status,'ready');
calls=[];
result=await reconcileNotificationAccountSettings003(off,
 async()=>{calls.push('read');return remoteDefault;},
 async(changes,revision)=>{
   calls.push('write');assert.equal(revision,0);
   assert.equal(changes.master,false);
   return {status:'saved',settings:{revision:1,...changes}};
 });
assert.deepEqual(calls,['read','write'],'old local off migrates exactly once');
assert.equal(result.migrated,true);
assert.equal(result.settings.like,false);
calls=[];
result=await reconcileNotificationAccountSettings003(original,
 async()=>{calls.push('read');return {revision:2,...changed};},
 async()=>{calls.push('write');throw Error('must not overwrite remote');});
assert.deepEqual(calls,['read'],'remote revisioned settings win over stale local default');
assert.equal(result.settings.master,false);
result=await reconcileNotificationAccountSettings003(off,
 async()=>remoteDefault,
 async()=>({status:'conflict',settings:{revision:1,...changed}}));
assert.equal(result.status,'conflict','concurrent legacy migration must not overwrite');
assert.equal(result.settings.follow,false);
assert.equal(sameNotificationChoices003(original,original),true);
assert.throws(()=>parseNotificationAccountSettings003({revision:-1,...original}),/INVALID/);
console.log('NOTIFICATION_AUTHENTICATED_SETTINGS_API_UID_403_409=PASS');
console.log('NOTIFICATION_LOCAL_OFF_MIGRATION_AND_CAS_RACE=PASS');
console.log('NOTIFICATION_DEFAULT_VISIT_W0_AND_NO_POLLING=PASS');
console.log('NOTIFICATION_SYNC_DORMANT_NO_SHARED_DEPLOY=PASS');

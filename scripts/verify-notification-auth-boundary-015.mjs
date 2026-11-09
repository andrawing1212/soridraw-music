// Stage015 — exercise the actual dormant Worker notification dispatch/auth source
// with isolated fake Firebase /auth-test, Firestore staff, SQLite and R2.
// No worker release, no signed real tokens, no shared D1 or external network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleNotificationPreferencesApi003}
  from '../cloudflare/explore-worker/runtime/notification-preferences-api-003.mjs';
import {handleUnifiedNotificationsApi004}
  from '../cloudflare/explore-worker/runtime/notification-unified-api-004.mjs';

const source=p=>readFileSync(p,'utf8');
const entry=source('cloudflare/explore-worker/canonical/preview-entry.js');
const baseWorkerSource=source('cloudflare/explore-worker/canonical/preview-worker.js');
const wrangler=JSON.parse(source('cloudflare/explore-worker/canonical/wrangler.preview.jsonc'));
const between=(text,start,end)=>{
 const from=text.indexOf(start);
 assert.ok(from>=0,'MISSING_WORKER_ANCHOR_'+start);
 const to=text.indexOf(end,from+start.length);
 assert.ok(to>from,'MISSING_WORKER_END_'+end);
 return text.slice(from,to);
};
const verifyRealSource=between(baseWorkerSource,
 'if (url.pathname === "/auth-test" && request.method === "POST")',
 'if (url.pathname === "/v1/feed-revision" && request.method === "GET")');
assert.match(verifyRealSource,/request\.headers\.get\("Authorization"\)/);
assert.match(verifyRealSource,/request\.headers\.get\("X-Firebase-AppCheck"\)/);
assert.match(verifyRealSource,/verifyFirebaseIdToken\(idToken\)/);
assert.match(verifyRealSource,/verifyFirebaseAppCheck\(appCheckToken\)/);
assert.match(verifyRealSource,/authenticated: true/);
assert.match(verifyRealSource,/uid: authResult\.uid/);
assert.match(verifyRealSource,/await enforceUserRateLimit\(/);
const appCheckFn=between(baseWorkerSource,
 'async function verifyFirebaseAppCheck(token) {','__name(verifyFirebaseAppCheck,');
assert.match(appCheckFn,/verifySignature\(parsed, FIREBASE_APPCHECK_JWKS\)/);
assert.match(appCheckFn,/INVALID_APPCHECK_ISSUER/);
assert.match(appCheckFn,/INVALID_APPCHECK_AUDIENCE/);
assert.match(appCheckFn,/APPCHECK_EXPIRED/);
assert.match(appCheckFn,/INVALID_APP_ID/);
const authFn=between(entry,
 'async function validateExploreAuth307(request, env, ctx) {',
 'async function readOwnStaffProfile307(actor) {');
const profileFn=between(entry,
 'async function readOwnStaffProfile307(actor) {',
 'async function resolveExploreManagementAccess307(request, env, ctx) {');
const corsFn=between(entry,
 'function curationCors307(request) {','function curationHeaders307(');
const route=between(entry,
 '    // Notification preferences remain strictly OFF until',
 '    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE&&');
const prefsGate='const NOTIFICATION_PREFS_003_COMPILED_OPEN = false;';
const inboxGate='const NOTIFICATION_INBOX_004_COMPILED_OPEN = false;';
assert.equal(route.split(prefsGate).length,2);
assert.equal(route.split(inboxGate).length,2);
assert.ok(route.indexOf('validateExploreAuth307(request,env,ctx)')>=0);
assert.match(route,/verifyAuthenticatedUid:async\(\)=>actor\.uid/);
assert.match(route,/verifyUid:async\(\)=>actor\.uid/);
assert.match(route,/if\(origin && !RELEASE_ALLOWED_ORIGINS_036\.has\(origin\)\)/);
assert.match(route,/staff\.staffRole==='master'\|\|staff\.staffRole==='admin'/);
assert.match(route,/\(staff\.role==='admin' && staff\.staffRolePresent===false\)/);
assert.ok(route.indexOf('const actor=await validateExploreAuth307(request,env,ctx)') <
  route.indexOf('verifyUid:async()=>actor.uid'));
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_PREFS_003,undefined);
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_INBOX_004,undefined);
assert.equal(wrangler.triggers?.crons?.length||0,0);

const dbLocal=new DatabaseSync(':memory:');
dbLocal.exec(source('cloudflare/explore-worker/candidates/20261108_03_notification_inert_schema_release.sql'));
dbLocal.exec(source('cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql'));
dbLocal.exec(source('cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql'));
const io={reads:0,writes:0,r2:0,authCalls:0,staffCalls:0};
const db={prepare(sql){return{
  bind(...p){return {
    async first(){io.reads++;return dbLocal.prepare(sql).get(...p)||null;},
    async all(){io.reads++;const s=dbLocal.prepare(sql),r=s.all(...p);
      if(/^(INSERT|UPDATE|DELETE)/i.test(sql.trim()))io.writes+=r.length;
      return {results:r};
    },
    async run(){io.writes++;return {meta:{changes:dbLocal.prepare(sql).run(...p).changes}};}
  };},
};}};
const cache={async get(){io.r2++;return null;},async put(){throw Error('UNEXPECTED_R2_PUT')}};
const env={DB:db,PROFILE_MEDIA:cache,
 SORIDRAW_NOTIFICATION_PREFS_003:'1',SORIDRAW_NOTIFICATION_INBOX_004:'1'};
const allowed=new Set(['https://preview.soridraw.com','https://soridraw.com']);
const identities=new Map([
 ['id-alice|app-alice','alice'],['id-bob|app-bob','bob'],
 ['id-admin|app-admin','admin'],['id-legacy|app-legacy','legacy'],
 ['id-master|app-master','master'],['id-badstaff|app-badstaff','badstaff'],
]);
let force403=false,forceUnverified=false,forceMalformed=false,forceStaffFailure=false;
const baseWorker={
 async fetch(request){
  io.authCalls++;
  assert.equal(new URL(request.url).pathname,'/auth-test');
  assert.equal(request.method,'POST');
  if(force403)return Response.json({authenticated:false},{status:403});
  if(forceMalformed)return new Response('not JSON',{status:200});
  const bearer=request.headers.get('Authorization')||'';
  const token=bearer.startsWith('Bearer ')?bearer.slice(7).trim():'';
  const check=request.headers.get('X-Firebase-AppCheck')||'';
  const uid=identities.get(token+'|'+check);
  if(!uid||forceUnverified)return Response.json({ok:false,authenticated:false},{status:401});
  return Response.json({ok:true,authenticated:true,uid,appId:'simulated-signed-app'});
 }
};
const staffRecords={
 alice:{role:'user'},bob:{role:'user'},admin:{role:'admin',staffRole:'admin'},
 legacy:{role:'admin'},master:{role:'user',staffRole:'master'},
 badstaff:{role:'admin',staffRole:'viewer'},
};
const fetchStaff=async (url,options)=>{
 io.staffCalls++;
 assert.equal(options.method,'GET');
 assert.ok(String(url).includes('/documents/users/'));
 const uid=decodeURIComponent(String(url).split('/users/')[1]);
 assert.ok(identities.has(options.headers.Authorization.replace(/^Bearer /,'' )+'|'+options.headers['X-Firebase-AppCheck']),
   'only a valid simulated identity may reach staff lookup');
 if(forceStaffFailure)return new Response('unavailable',{status:503});
 const record=staffRecords[uid];
 if(!record)return new Response('missing',{status:404});
 const fields={role:{stringValue:record.role}};
 if(Object.hasOwn(record,'staffRole'))fields.staffRole={stringValue:record.staffRole};
 return Response.json({fields});
};
const auth=new Function('baseWorker','curationHeaders307',authFn+
 '\nreturn validateExploreAuth307;')(baseWorker,()=>new Headers({'Cache-Control':'no-store'}));
const profile=new Function('fetch','SORIDRAW_FIREBASE_PROJECT_307',profileFn+
 '\nreturn readOwnStaffProfile307;')(fetchStaff,'soridraw-app-866a5');
const cors=new Function('RELEASE_ALLOWED_ORIGINS_036',corsFn+
 '\nreturn curationCors307;')(allowed);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const makeRoute=snippet=>new AsyncFunction(
 'request','env','ctx','validateExploreAuth307','readOwnStaffProfile307',
 'handleNotificationPreferencesApi003','handleUnifiedNotificationsApi004',
 'curationCors307','RELEASE_ALLOWED_ORIGINS_036',
 'const url=new URL(request.url);\n'+snippet+'\nreturn null;');
const originalRoute=makeRoute(route);
const candidateRoute=makeRoute(
 route.replace(prefsGate,'const NOTIFICATION_PREFS_003_COMPILED_OPEN = true;')
      .replace(inboxGate,'const NOTIFICATION_INBOX_004_COMPILED_OPEN = true;'));
const call=async (which,request,currentEnv=env)=>{
 const res=await which(request,currentEnv,null,auth,profile,
  handleNotificationPreferencesApi003,handleUnifiedNotificationsApi004,cors,allowed);
 return {status:res?.status??null,body:res?await res.json().catch(()=>null):null,
   headers:res?.headers};
};
const origin='https://preview.soridraw.com';
const req=(path,method='GET',who='alice',opts={})=>{
 const headers=new Headers();
 if(opts.origin!==false)headers.set('Origin',opts.origin||origin);
 if(who!==null){
  headers.set('Authorization','Bearer '+(opts.jwt||'id-'+who));
  if(opts.appcheck!==false)headers.set('X-Firebase-AppCheck',opts.appCheckToken||'app-'+who);
 }
 if(opts.body!==undefined)headers.set('Content-Type','application/json');
 return new Request('https://worker.example'+path,{
  method,headers,...(opts.body!==undefined?{body:JSON.stringify(opts.body)}:{})
 });
};
const pref='/v1/me/notifications/preferences';
const inbox='/v1/me/notifications/inbox';
const msg='/v1/admin/notifications/message';
const notice='/v1/admin/notifications/announcement';
const same=()=>({...io});
let inactive=await call(originalRoute,req(pref));
assert.equal(inactive.status,null,'real Worker compile-time OFF must not route');
inactive=await call(originalRoute,req(inbox));
assert.equal(inactive.status,null);
assert.deepEqual(same(),{reads:0,writes:0,r2:0,authCalls:0,staffCalls:0});
assert.equal((await call(candidateRoute,req(inbox),{})).status,null,
 'env switch alone cannot activate a missing compiled flag');
assert.equal((await call(candidateRoute,req(pref),{...env,SORIDRAW_NOTIFICATION_PREFS_003:'0'})).status,null);
assert.equal((await call(candidateRoute,req(inbox),{...env,SORIDRAW_NOTIFICATION_INBOX_004:'0'})).status,null);
assert.deepEqual(same(),{reads:0,writes:0,r2:0,authCalls:0,staffCalls:0});
console.log('NOTIFICATION_015_REAL_SOURCE_COMPILE_OFF_AND_ENV_GATES_R0W0=PASS');

const preflight=await call(candidateRoute,req(pref,'OPTIONS',null));
assert.equal(preflight.status,204,'allowed origin preflight');
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
assert.equal(io.authCalls,0,'OPTIONS never needs JWT');
const badOrigin=await call(candidateRoute,req(pref,'GET','alice',{origin:'https://evil.invalid'}));
assert.equal(badOrigin.status,403);
const badOrigin2=await call(candidateRoute,req(inbox,'GET','alice',{origin:'https://evil.invalid'}));
assert.equal(badOrigin2.status,403);
assert.equal(io.authCalls,0,'untrusted Origin must be rejected before token verification');
const paths=[pref,inbox,msg,notice];
for(const path of paths){
 const missing=await call(candidateRoute,req(path,path===pref||path===inbox?'GET':'POST',null));
 assert.equal(missing.status,401,path+' missing auth');
 const noCheck=await call(candidateRoute,req(path,path===pref||path===inbox?'GET':'POST','alice',{appcheck:false}));
 assert.equal(noCheck.status,401,path+' missing AppCheck');
 const mismatch=await call(candidateRoute,req(path,path===pref||path===inbox?'GET':'POST','alice',{appCheckToken:'app-bob'}));
 assert.equal(mismatch.status,401,path+' mismatched AppCheck');
}
assert.equal(io.reads,0,'failed token checks cannot read D1');
assert.equal(io.writes,0);
assert.equal(io.r2,0,'failed auth cannot read R2');
force403=true;
assert.equal((await call(candidateRoute,req(pref))).status,403,'backend auth 403 preserved');
force403=false;
forceUnverified=true;
assert.equal((await call(candidateRoute,req(inbox))).status,401,
 'HTTP OK alone cannot authorize (authenticated:true required)');
forceUnverified=false;
forceMalformed=true;
assert.equal((await call(candidateRoute,req(inbox))).status,401,'unparseable /auth-test deny');
forceMalformed=false;
assert.equal(io.reads,0);
console.log('NOTIFICATION_015_FIREBASE_JWT_APPCHECK_FAILURE_BEFORE_D1_R2=PASS');

const pAlice=await call(candidateRoute,req(pref));
assert.equal(pAlice.status,200);
assert.equal(pAlice.body.data.preferences.revision,0);
assert.equal(pAlice.headers.get('Cache-Control'),'private, no-store');
assert.equal(dbLocal.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_preferences_002').get().n,0,
 'GET default never writes');
const defaults={master:true,like:true,follow:true,complete:true,announcement:true,message:true};
const changed={...defaults,like:false};
const aliceSave=await call(candidateRoute,req(pref,'PUT','alice',{body:{
 ...changed,expectedRevision:0,operationId:'stage015-account-01',
}}));
assert.equal(aliceSave.status,200);
assert.equal(aliceSave.body.data.rowsWritten,1);
assert.equal((await call(candidateRoute,req(pref,'GET','bob'))).body.data.preferences.revision,0);
const spoof=await call(candidateRoute,req(pref,'PUT','bob',{body:{
 ...changed,expectedRevision:0,operationId:'stage015-account-02',uid:'alice',
}}));
assert.equal(spoof.status,400,'forged body UID rejected');
const sql=dbLocal.prepare('SELECT user_uid,like_enabled FROM soridraw_notification_preferences_002').all()
 .map(row=>({user_uid:row.user_uid,like_enabled:row.like_enabled}));
assert.deepEqual(sql,[{user_uid:'alice',like_enabled:0}]);
const aliceVerify=await call(candidateRoute,req(pref,'GET','alice'));
assert.equal(aliceVerify.body.data.preferences.like,false);
console.log('NOTIFICATION_015_ONLY_VERIFIED_UID_ACCOUNT_PREFERENCES=PASS');

const at=Date.now()-2000;
dbLocal.prepare('INSERT INTO soridraw_notification_inbox_001 VALUES (?,?,?,?,?,?,?,?)')
 .run('alice',Math.floor(at/7200000)*7200000,'follow','sender','alice','Sender','',at);
const owner=await call(candidateRoute,req(inbox+'?uid=bob','GET','alice'));
assert.equal(owner.status,200);
assert.equal(owner.body.data.items.length,1);
assert.equal(owner.body.data.items[0].category,'follow');
const other=await call(candidateRoute,req(inbox+'?uid=alice','GET','bob'));
assert.equal(other.status,200);
assert.deepEqual(other.body.data.items,[],'client query cannot switch recipient');
assert.equal(owner.headers.get('Cache-Control'),'private, no-store');
console.log('NOTIFICATION_015_SIGNED_UID_INBOX_NO_CLIENT_IMPERSONATION=PASS');

const payload={id:'notice015',receiverUid:'alice',title:'Hello',body:'Private'};
const beforeAdmin={writes:io.writes,staff:io.staffCalls};
const notAdmin=await call(candidateRoute,req(msg,'POST','alice',{body:payload}));
assert.equal(notAdmin.status,403);
assert.equal(io.writes,beforeAdmin.writes);
assert.equal(io.staffCalls,beforeAdmin.staff+1);
const roleSpoof=await call(candidateRoute,req(msg,'POST','badstaff',{body:{...payload,staffRole:'master'}}));
assert.equal(roleSpoof.status,403,'present non-admin staffRole fences legacy role=admin');
assert.equal(io.writes,beforeAdmin.writes);
forceStaffFailure=true;
assert.equal((await call(candidateRoute,req(msg,'POST','admin',{body:payload}))).status,403);
forceStaffFailure=false;
assert.equal(io.writes,beforeAdmin.writes);
const admin=await call(candidateRoute,req(msg,'POST','admin',{body:payload}));
assert.equal(admin.status,200);
assert.equal(admin.body.data.rowsWritten,1);
assert.equal(dbLocal.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_direct_messages_004').get().n,1);
const adminReplay=await call(candidateRoute,req(msg,'POST','admin',{body:payload}));
assert.equal(adminReplay.body.data.rowsWritten,0);
const masterPayload={...payload,id:'master-msg'};
const master=await call(candidateRoute,req(msg,'POST','master',{body:masterPayload}));
assert.equal(master.status,200);
const legacy=await call(candidateRoute,req(msg,'POST','legacy',{body:{...payload,id:'legacy-msg'}}));
assert.equal(legacy.status,200,'legacy admin without staffRole allowed by current contract');
const forbiddenGlobal=await call(candidateRoute,req(notice,'POST','bob',{body:{
 id:'global',title:'Notice',body:'Shared',publishedAtMs:Date.now(),
}}));
assert.equal(forbiddenGlobal.status,403);
console.log('NOTIFICATION_015_STAFF_ROLE_FIRESTORE_FAIL_CLOSED_AND_ADMIN_ONLY=PASS');
assert.equal(dbLocal.prepare('SELECT enabled FROM soridraw_notification_activation_002').get().enabled,0);
assert.equal(io.r2,2,'only authorized inbox GETs read R2; refused requests R2 0');
dbLocal.close();
console.log('NOTIFICATION_015_NO_LIVE_FIREBASE_CREDENTIAL_OR_WORKER_DEPLOY=PASS');

// APP538 integrated, ISOLATED OWNER A/B proof. This is a local canonical
// SQLite transaction adapter + actual Firebase Auth/RTDB emulators, NOT a live
// Worker, R2, or production A/B browser release. No shared resources touched.
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createServer} from "node:http";
import {APP539_FUNCTIONS_HTTP_COMPILED_OPEN,createOwnerFollowHttp539}
 from "../functions/experiments/owner-follow-http-539.mjs";
import {APP540_INLINE_CANONICAL_COMPILED_OPEN,adjustExploreFollowCountersDelta540}
 from "../cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs";
import {APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN,sendOwnerFollowHttp539}
 from "../cloudflare/explore-worker/runtime/owner-follow-http-539.mjs";
import {initializeApp as initAdmin,deleteApp as deleteAdmin} from "firebase-admin/app";
import {getAuth as getAdminAuth} from "firebase-admin/auth";
import {getDatabase as getAdminDb} from "firebase-admin/database";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {initializeApp as initClient,deleteApp as deleteClient} from "firebase/app";
import {getAuth as getClientAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut} from "firebase/auth";
import {getDatabase as getClientDb,connectDatabaseEmulator,onValue,ref as clientRef} from "firebase/database";
import {signReceiptForEmulator533,deliverOwnerFollower533} from "../functions/experiments/owner-follow-auth-533.mjs";
import {
 drainOwnerFollowAuthEpoch532,INLINE_OWNER_FOLLOW_532_UPDATE_SQL,
 OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN,
} from "../cloudflare/explore-worker/runtime/owner-follow-auth-epoch-532.mjs";
const M534=await import("../functions/src/ownerFollowLifecycle534.ts");
const {enrollOwnerFollowEpoch534,prepareOwnerFollowDeletion534,
 APP534_OWNER_CLAIM}=M534.default||M534;
const M537=await import("../functions/src/ownerFollowAdminAdapter537.ts");
const {APP537_ADMIN_RECOVERY_COMPILED_OPEN,inspectOwnerFollowCallable537,
 confirmOwnerFollowCallable537,APP537_AUDIT_COLLECTION}=M537.default||M537;
const M536=await import("../functions/src/ownerFollowManualReview536.ts");
const {APP536_EXPLICIT_CONFIRMATION}=M536.default||M536;
const M538=await import("../src/services/exploreOwnerFollowerEpochCore538.ts");
const {APP538_OWNER_CLIENT_GATE_COMPILED_OPEN,createOwnerEpochGate538,
 normalizeOwnerEpochSignal538}=M538.default||M538;
const PROJECT="demo-soridraw-owner-534";
const NS=PROJECT+"-default-rtdb",A="ownerA538",B="actorB538",ADMIN="admin538";
const PASSWORD="isolated-follow-538-password";
const SECRET="local-538-owner-relay-HMAC-test-only-secret";
const REVIEW_SECRET="local-538-admin-manual-approval-signing-only-key";
const MARKER="ownerFollowerSync532/"+A;
assert.equal(APP539_FUNCTIONS_HTTP_COMPILED_OPEN,false);
assert.equal(APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN,false);
assert.equal(APP540_INLINE_CANONICAL_COMPILED_OPEN,false);
// Use the checked-out ACTUAL canonical Worker function, not a copy. No
// production runtime/bindings are instantiated by this isolated harness.
const workerSourceFile=readFileSync("cloudflare/explore-worker/canonical/preview-worker.js","utf8");
const ws=workerSourceFile.indexOf("async function adjustExploreFollowCountersDelta(");
const we=workerSourceFile.indexOf("\n__name(",ws);
assert.ok(ws>0&&we>ws&&we-ws<8000);
const workerSource=workerSourceFile.slice(ws,we);
assert.match(workerSource,/env.DB.batch/);
assert.match(workerSource,/INSERT OR IGNORE INTO follows/);
const existingWorkerFollow=new Function(workerSource+
 "\nreturn adjustExploreFollowCountersDelta;")();

const EPOCH=/^[0-9a-f]{32}$/;
assert.equal(process.env.APP534_ISOLATED_ONLY,"yes");
assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:9099");
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,"127.0.0.1:9000");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8080");
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
assert.equal(OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN,false);
assert.equal(APP537_ADMIN_RECOVERY_COMPILED_OPEN,false);
assert.equal(APP538_OWNER_CLIENT_GATE_COMPILED_OPEN,false);
const p=readFileSync("src/pages/ExplorePage.tsx","utf8");
const old=readFileSync("src/services/exploreOwnerFollowerSync529.ts","utf8");
const oldCore=readFileSync("src/services/exploreOwnerFollowerSyncCore529.ts","utf8");
assert.match(old,/EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false/);
assert.match(oldCore,/receiptId!==String\(version\)/);
assert.match(p,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 120_000/);
const idle=readFileSync("src/services/exploreFollowBatchService380.ts","utf8");
assert.match(idle,/EXPLORE_FOLLOW_IDLE_FLUSH_MS_380 = 30_000/);
const bounded=readFileSync("scripts/verify-527-owner-follower-idle-cost.mjs","utf8");
assert.match(bounded,/getExploreProfileConnections/);
assert.doesNotMatch(p,/createOwnerEpochGate538/);
const app=initAdmin({projectId:PROJECT,databaseURL:"https://"+NS+".firebaseio.com"},"isolated-admin-538");
const auth=getAdminAuth(app),firestore=getFirestore(app),database=getAdminDb(app);
const profile=uid=>firestore.collection("users").doc(uid);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitUntil(predicate,label,ms=9000){
 const end=Date.now()+ms;
 while(Date.now()<end){if(predicate())return;await sleep(65)}
 assert.fail("TIMEOUT_"+label);
}
async function signInRest(uid){
 const r=await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email:uid+"@example.test",password:PASSWORD,returnSecureToken:true}),
 });
 const json=await r.json();
 assert.equal(r.status,200,JSON.stringify(json));return json.idToken;
}
const create=async(uid,extra={})=>{
 await auth.createUser({uid,email:uid+"@example.test",password:PASSWORD});
 await profile(uid).set({musicNote:"preserved",favoriteCount:25,...extra},{merge:true});
};
const tmp=mkdtempSync(join(tmpdir(),"app538-owner-ab-"));
const path=join(tmp,"isolated-canonical.sqlite");
let sql=null,webApp=null,stopClient=null,server=null,endpoint=null;
const tests={};
function makeSql(){
 const c=readFileSync("cloudflare/explore-worker/candidates/530-owner-follow-inline-stats.sql","utf8");
 const common=c.split("-- APP531 / APP530 lifecycle extension")[0];
 const triggerAt=common.indexOf("CREATE TRIGGER IF NOT EXISTS");
 const pre=common.slice(0,triggerAt).replace(/^\s*--.*$/gm,"")
  .split(";").map(x=>x.trim()).filter(Boolean);
 const trigger=[...common.slice(triggerAt).matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?\bEND;/g)];
 assert.equal(trigger.length,1);
 const epoch=readFileSync("cloudflare/explore-worker/candidates/532-owner-auth-epoch-no-tombstone.sql","utf8")
  .replace(/^\s*--.*$/gm,"").trim();
 assert.doesNotMatch(epoch,/CREATE TABLE|tombstone/i);
 const d=new DatabaseSync(path);
 d.exec("CREATE TABLE profile_stats(uid TEXT PRIMARY KEY NOT NULL,follower_count INTEGER NOT NULL CHECK(follower_count>=0),following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)");
 for(const q of pre)d.exec(q);
 d.exec(trigger[0][0]);
 d.exec(epoch);
 d.exec("CREATE TABLE follows(follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(follower_uid,following_uid)) WITHOUT ROWID");
 d.exec("UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1");
 d.prepare("INSERT INTO profile_stats(uid,follower_count,following_count,updated_at,owner_follow_auth_epoch_532) VALUES(?,0,0,1,'')").run(B);
 const retired=d.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'explore_owner_follow_retired%'").get().n;
 assert.equal(retired,0);
 return d;
}
function canonicalRow(){
 return sql.prepare("SELECT follower_count AS count,owner_follow_revision_530 AS rev,owner_follow_acked_revision_530 AS ack,owner_follow_auth_epoch_532 AS epoch,owner_follow_attempts_530 AS attempts FROM profile_stats WHERE uid=?").get(A);
}
function bootstrapEpoch(epoch){
 assert.match(epoch,EPOCH);
 sql.prepare("INSERT INTO profile_stats(uid,follower_count,following_count,updated_at,owner_follow_auth_epoch_532) VALUES(?,0,0,?,?)")
  .run(A,Date.now(),epoch);
}
const workerDb={
 prepare(query){
  return {bind(...params){const stmt=sql.prepare(query);return {
   query,params,
   async all(){return {results:stmt.all(...params)};},
   async first(){return stmt.get(...params)||null;},
   async run(){const result=stmt.run(...params);return {meta:{changes:result.changes}};},
  };}};
 },
 async batch(statements){
  sql.exec("BEGIN IMMEDIATE");
  try{
   const results=[];
   for(const row of statements){
    const stmt=sql.prepare(row.query);
    if(/\bRETURNING\b|^\s*SELECT\b/i.test(row.query)){
     results.push({results:stmt.all(...row.params)});
    }else{
     const result=stmt.run(...row.params);
     results.push({results:[],meta:{changes:result.changes}});
    }
   }
   sql.exec("COMMIT");return results;
  }catch(e){sql.exec("ROLLBACK");throw e;}
 },
};
async function canonicalCommitB(actorToken,desired,epoch,writer="optimized"){
 const verified=await auth.verifyIdToken(actorToken,true);
 assert.equal(verified.uid,B);
 assert.equal(canonicalRow().epoch,epoch);
 const before=canonicalRow();
 const totalBefore=sql.prepare("SELECT total_changes() AS n").get().n;
 const result=writer==="legacy"
  ?await existingWorkerFollow({DB:workerDb},B,A,desired,Date.now())
  :await adjustExploreFollowCountersDelta540({DB:workerDb},B,A,desired,Date.now(),epoch);
 const logicalChanges=sql.prepare("SELECT total_changes() AS n").get().n-totalBefore;
 if(result.delta!==0)assert.equal(logicalChanges,writer==="legacy"?4:3,
   "EXACT_CANONICAL_EDGE_ACTOR_OWNER_LOGICAL_WRITE_COUNT");
 const after=canonicalRow(),changed=result.delta!==0;
 assert.equal(after.count,changed?before.count+(desired?1:-1):before.count);
 assert.equal(after.rev,changed?before.rev+1:before.rev);
 return {changed,count:after.count,revision:after.rev};
}

const d1Adapter={prepare(query){
 return {bind(...params){return{
  async all(){return {results:sql.prepare(query).all(...params)}},
  async run(){return sql.prepare(query).run(...params)},
 }}};
}};
let drainClock=Date.now();
async function deliverEpoch(event,{raiseAfterDelivery=false}={}){
 const response=await sendOwnerFollowHttp539(event,{
  isolatedOnly:true,endpoint,secret:SECRET,
 });
 if(raiseAfterDelivery){
  assert.equal(response.ok,true);
  throw Error("ISOLATED_CRASH_AFTER_DELIVERY_BEFORE_ACK");
 }
 return {accepted:response.ok,applied:response.applied,status:response.status};
}

async function drain(opts={}){
 return drainOwnerFollowAuthEpoch532({
  db:d1Adapter,enabled:true,now:()=>drainClock,
  deliver:async ev=>{
   const r=await deliverEpoch(ev,opts);
   return r.accepted===true;
  },
 });
}
const views=[],invalidated=[];
let currentGate;
function installGate(epoch){
 const gate=createOwnerEpochGate538({
  ownerUid:A,authEpoch:epoch,
  applyCount:(count,version,changed)=>{views.push({epoch,count,version,changed});
   if(changed)invalidated.push({epoch,version});},
  rememberVersion:(version,confirmed)=>assert.equal(confirmed,epoch),
 });
 return gate;
}
async function attachClient(epoch){
 const {initializeApp,deleteApp}={initializeApp:initClient,deleteApp:deleteClient};
 webApp=initializeApp({projectId:PROJECT,
  databaseURL:"https://"+NS+".firebaseio.com",apiKey:"demo-local-538",
  authDomain:PROJECT+".firebaseapp.com"},"owner-538-client-"+epoch.slice(0,8));
 const aAuth=getClientAuth(webApp);
 connectAuthEmulator(aAuth,"http://127.0.0.1:9099",{disableWarnings:true});
 const aDb=getClientDb(webApp);
 connectDatabaseEmulator(aDb,"127.0.0.1",9000);
 const user=await signInWithEmailAndPassword(aAuth,A+"@example.test",PASSWORD);
 const idToken=await user.user.getIdToken();
 const claims=await auth.verifyIdToken(idToken);
 assert.equal(claims[APP534_OWNER_CLAIM],epoch);
 currentGate=installGate(epoch);
 const values=[],errors=[];
 const unsubscribe=onValue(clientRef(aDb,MARKER),snap=>{
  const value=snap.val();values.push(value);
  currentGate.receive(value);
 },error=>errors.push(String(error?.code||error)));
 stopClient=async()=>{unsubscribe();currentGate.dispose();await signOut(aAuth);await deleteClient(webApp);};
 await waitUntil(()=>values.length>0,"CLIENT_INITIAL_SNAPSHOT");
 assert.equal(errors.length,0);
 return {idToken,values,errors};
}
async function readOtherUid(idToken){
 const url="http://127.0.0.1:9000/"+MARKER+".json?ns="+NS+"&auth="+encodeURIComponent(idToken);
 const r=await fetch(url);return r.status;
}
try{
 server=createServer(createOwnerFollowHttp539({auth,database,secret:SECRET}));
 await new Promise((resolve,reject)=>{
  server.once("error",reject);
  server.listen(0,"127.0.0.1",resolve);
 });
 endpoint="http://127.0.0.1:"+server.address().port+"/owner-follow-539";
 assert.equal((await fetch(endpoint,{method:"GET"})).status,405);
 assert.equal((await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:1,ownerUid:A})})).status,403);
 await create(A);
 await create(B);
 await create(ADMIN,{role:"admin",staffRole:"admin",adminPermissions:{userManagement:true}});
 const actorToken=await signInRest(B);
 const adminToken=await signInRest(ADMIN);
 const generation1=await enrollOwnerFollowEpoch534({firestore,auth,uid:A});
 const e1=generation1.authEpoch;
 assert.match(e1,EPOCH);
 sql=makeSql();
 bootstrapEpoch(e1);
 const aClient1=await attachClient(e1);
 assert.ok([401,403].includes(await readOtherUid(actorToken)));
 const snapshotBefore=(await database.ref(MARKER).get()).exists();
 assert.equal(snapshotBefore,false);
 assert.equal(views.length,0);
 const beforeD1=canonicalRow();
 assert.equal(beforeD1.count,0);assert.equal(beforeD1.rev,0);
 // B's rapid local toggle is optimistic only. No D1 or owner signal
 // before the existing 30-second final-state batch's accepted commit.
 assert.equal(canonicalRow().rev,0);
 const follow1=await canonicalCommitB(actorToken,true,e1);
 assert.deepEqual({count:follow1.count,revision:follow1.revision},{count:1,revision:1});
 assert.equal(views.length,0);
 assert.equal((await database.ref(MARKER).get()).exists(),false);
 // Simulate process death AFTER real SQLite edge+count+pending revision
 // commit, BEFORE dispatch. Reopen durable DB and drain only its row.
 sql.close();sql=new DatabaseSync(path);
 assert.equal(canonicalRow().rev,1);
 assert.equal(canonicalRow().ack,0);
 const sent1=await drain();
 assert.equal(sent1.delivered,1);
 await waitUntil(()=>views.some(v=>v.epoch===e1&&v.version===1&&v.count===1),"OWNER_REALTIME_V1");
 assert.equal(canonicalRow().ack,1);
 assert.equal(invalidated.length,1);
 tests.durableCommitReopenToRealOwnerSubscription="PASS";

 // Duplicate/no-op canonical intents do not grow revision or notify A.
 const noOp=await canonicalCommitB(actorToken,true,e1);
 assert.equal(noOp.changed,false);assert.equal(canonicalRow().rev,1);
 const duplicate=await deliverEpoch({ownerUid:A,authEpoch:e1,version:1,
  followerCount:1,updatedAt:Date.now()});
 assert.equal(duplicate.accepted,true);assert.equal(duplicate.applied,false);
 const marker1=(await database.ref(MARKER).get()).val();
 const invalidBefore=invalidated.length;
 currentGate.receive(marker1);
 assert.equal(invalidated.length,invalidBefore,"IDENTICAL_RETAINED_EVENT_NO_LIST_INVALIDATION");
 assert.equal(normalizeOwnerEpochSignal538({...marker1,
  receiptId:"wrong"},A,e1),null);
 tests.canonicalNoopDuplicateNoListInvalidation="PASS";

 // Committed unfollow and re-follow must produce versions 2 and 3; a
 // delayed old signed event cannot regress the real RTDB owner signal.
 assert.equal((await canonicalCommitB(actorToken,false,e1,"legacy")).revision,2);
 assert.equal((await drain()).delivered,1);
 await waitUntil(()=>views.some(v=>v.epoch===e1&&v.version===2&&v.count===0),"OWNER_REALTIME_V2");
 assert.equal((await canonicalCommitB(actorToken,true,e1)).revision,3);
 assert.equal((await drain()).delivered,1);
 await waitUntil(()=>views.some(v=>v.epoch===e1&&v.version===3&&v.count===1),"OWNER_REALTIME_V3");
 const stale=await deliverEpoch({ownerUid:A,authEpoch:e1,version:2,
  followerCount:0,updatedAt:Date.now()});
 assert.equal(stale.accepted,true);assert.equal(stale.applied,false);
 assert.equal((await database.ref(MARKER).get()).val().followerCount,1);
 assert.equal(invalidated.length,3);
 tests.reorderedDeliveryFailClosed="PASS";

 // Signed delivery reaches owner, then relay fails before ACK. Durable
 // canonical revision remains and retry is idempotent; no second edge.
 assert.equal((await canonicalCommitB(actorToken,false,e1,"legacy")).revision,4);
 const lostAck=await drain({raiseAfterDelivery:true});
 assert.equal(lostAck.failed,1);assert.equal(canonicalRow().ack,3);
 await waitUntil(()=>views.some(v=>v.epoch===e1&&v.version===4&&v.count===0),"OWNER_CRASH_BEFORE_ACK");
 const noEarly=await drain();
 assert.equal(noEarly.selected,0);
 drainClock+=16000;
 const recovered=await drain();
 assert.equal(recovered.delivered,1);assert.equal(canonicalRow().ack,4);
 assert.equal(canonicalRow().count,0);
 assert.equal(invalidated.length,4);
 tests.lostAckRetryWithoutDuplicateCount="PASS";

 // Real APP534 Auth-only deletion with APP535/536/537 explicitly audited
 // operator recovery. Original D1 profile is retained by THIS contract.
 assert.equal((await canonicalCommitB(actorToken,true,e1)).revision,5);
 assert.equal(canonicalRow().ack,4);
 const staleEvent={ownerUid:A,authEpoch:e1,version:5,
  followerCount:1,updatedAt:Date.now()};
 const deletion=await prepareOwnerFollowDeletion534({firestore,auth,uid:A});
 assert.equal(deletion.epoch,e1);
 await auth.deleteUser(A);
 await profile(A).set({authDeleted:true,
  adminDeletionContentPolicy:"retain-user-content",accountStatus:"banned"},{merge:true});
 const blocked=await deliverEpoch(staleEvent);
 assert.equal(blocked.accepted,false);
 assert.equal((await drain()).failed,1);
 assert.equal(canonicalRow().epoch,e1,"AUTH_ONLY_DELETE_RETAINS_D1_ROW");
 const adminContext={
  auth:{uid:ADMIN},data:{targetUid:A,adminIdToken:adminToken},
 };
 const inspection=await inspectOwnerFollowCallable537(adminContext,{
  firestore,auth,database,signingKey:REVIEW_SECRET,
 });
 assert.equal(inspection.action,"recover-deleting");
 assert.ok(inspection.ticket);
 const finish=await confirmOwnerFollowCallable537({
  ...adminContext,data:{...adminContext.data,
   ticket:inspection.ticket,confirmation:APP536_EXPLICIT_CONFIRMATION},
 },{firestore,auth,database,signingKey:REVIEW_SECRET});
 assert.equal(finish.recovered,true);
 assert.equal((await profile(A).get()).get("ownerFollowLifecycle534.phase"),"deleted");
 assert.equal((await database.ref(MARKER).get()).exists(),false);
 assert.equal((await profile(A).get()).get("musicNote"),"preserved");
 assert.equal((await profile(A).get()).get("favoriteCount"),25);
 assert.equal((await firestore.collection(APP537_AUDIT_COLLECTION).doc(finish.attemptId).get()).get("status"),"succeeded");
 tests.authDeleteStaleReceiptAndApprovedCleanup="PASS";
 // Stop old Auth client before registering an isolated new Auth account.
 await stopClient();stopClient=null;webApp=null;

 // A real forced deletion leaves banned/authDeleted retained. Therefore
 // enrollment of a re-created SAME UID fails until an *explicit* operator
 // restoration decision; only in THIS disposable emulator do we simulate
 // that external approval by clearing those exact account-status fields.
 await auth.createUser({uid:A,email:A+"@example.test",password:PASSWORD});
 await assert.rejects(()=>enrollOwnerFollowEpoch534({firestore,auth,uid:A}),
  /APP534_ACCOUNT_DELETION_STATUS_HOLD/);
 await profile(A).set({
  accountStatus:"active",authDeleted:FieldValue.delete(),
  authDeletionPendingAt:FieldValue.delete(),
 },{merge:true});
 const newGeneration=await enrollOwnerFollowEpoch534({firestore,auth,uid:A});
 const e2=newGeneration.authEpoch;
 assert.notEqual(e1,e2);
 // The original canonical D1 row cannot be relabeled implicitly. An
 // explicit *test-only full erasure + new canonical bootstrap* is simulated
 // below, NOT actual admin Auth-only deletion or a permitted live migration.
 sql.exec("BEGIN IMMEDIATE");
 try{
  sql.prepare("DELETE FROM follows WHERE following_uid=?").run(A);
  sql.prepare("DELETE FROM profile_stats WHERE uid=?").run(A);
  sql.exec("COMMIT");
 }catch(e){sql.exec("ROLLBACK");throw e}
 bootstrapEpoch(e2);
 assert.equal(canonicalRow().rev,0);
 const staleAck=sql.prepare("UPDATE profile_stats SET owner_follow_acked_revision_530=1 WHERE uid=? AND owner_follow_auth_epoch_532=? AND owner_follow_revision_530=1").run(A,e1);
 assert.equal(staleAck.changes,0);
 const delayed=await deliverEpoch(staleEvent);
 assert.equal(delayed.accepted,false);
 const clientNew=await attachClient(e2);
 const newFollow=await canonicalCommitB(actorToken,true,e2);
 assert.equal(newFollow.revision,1);
 assert.equal((await drain()).delivered,1);
 await waitUntil(()=>views.some(v=>v.epoch===e2&&v.version===1&&v.count===1),"NEW_EPOCH_FIRST_VERSION");
 assert.equal((await database.ref(MARKER).get()).val().authEpoch,e2);
 const oldTokenAccess=await readOtherUid(aClient1.idToken);
 assert.ok([401,403].includes(oldTokenAccess));
 assert.ok([401,403].includes(await readOtherUid(actorToken)));
 const newSignal=(await database.ref(MARKER).get()).val();
 assert.equal(normalizeOwnerEpochSignal538(newSignal,A,e1),null);
 assert.ok(normalizeOwnerEpochSignal538(newSignal,A,e2));
 assert.equal(newSignal.receiptId,e2+":1");
 assert.equal(canonicalRow().ack,1);
 assert.equal(invalidated.filter(v=>v.epoch===e2).length,1);
 assert.ok(clientNew.values.some(v=>v?.authEpoch===e2));
 const previous=canonicalRow();
 await assert.rejects(
  ()=>adjustExploreFollowCountersDelta540({DB:workerDb},B,A,false,Date.now(),e1),
  /APP540_OWNER_EPOCH_MISMATCH/
 );
 assert.deepEqual(canonicalRow(),previous,"old Auth incarnation cannot alter recreated owner");
 tests.oldNewWorkerAndEpochFencedOwnerWrites="PASS";
 tests.sameUidRecreationNewEpochRevisionReset="PASS";

 console.log("APP539_REAL_WORKER_SOURCE_FUNCTION_HTTP_A_RECEIVER=PASS");
 console.log(JSON.stringify({project:PROJECT,tests,sharedWrites:0,
  productionDeployments:0,liveFeatureFlags:false,
  D1Billing:"NOT_MEASURED; previously physical APP532 changed follow W2",
  durableDB:"local node:sqlite persisted file, not live Cloudflare D1",
  workerCommitCode:"EXACT adjustExploreFollowCountersDelta from canonical/preview-worker.js",
  receiverHttpCode:"createOwnerFollowHttp539 local Node HTTP using Firebase Functions onRequest candidate",
  caveats:[
   "B follow uses exact checked-out canonical Worker function over SQLite-compatible D1 adapter; not deployed Worker",
   "APP540 OFF candidate uses one inline owner UPDATE; legacy Worker still uses fallback; only isolated D1 metering can establish physical W2",
   "A received via actual Firebase JS SDK onValue and Auth emulator token against RTDB Rules",
   "APP534+APP537 deletion and audit reconciliation used actual Firebase emulators",
   "Same-UID recreation required explicit isolated Firestore account restore + local canonical erasure/rebootstrap; no live reactivation contract",
   "Old APP527/528 120-second list cache and 30-second local follow batching sources unchanged",
   "No live Functions webhook, R2 public materialization, Worker/Function release, PC/mobile hardware test or end-user production proof",
  ]},null,2));
}finally{
 if(stopClient)await stopClient().catch(()=>{});
 if(server)await new Promise(resolve=>server.close(resolve));
 if(sql)sql.close();
 rmSync(tmp,{recursive:true,force:true});
 await deleteAdmin(app);
}

// APP533 integration: real Firebase Auth + Realtime Database emulator processes.
// Strict DEMO project + loopback-only guards. Never use actual SORIDRAW projects.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {
 APP533_EMULATOR_ONLY,CLAIM_533,MARKER_PATH_533,
 enrollAuthIncarnation533,signReceiptForEmulator533,parseSignedReceipt533,
 deliverOwnerFollower533,clearRetiredGeneration533,
 nextOwnerFollowerMarker533,readMarkerForClaim533,
} from '../functions/experiments/owner-follow-auth-533.mjs';
const PROJECT='demo-soridraw-owner-533';
const NS=PROJECT+'-default-rtdb';
const EMAIL='owner-533@example.test',PASS='emulator-safe-password-533';
const OTHER='other-533@example.test',UID='owner533',OTHERUID='outsider533';
const secret='local-emulator-only-32-byte-HMAC-secret-test-533';
const authHost='127.0.0.1:9099',dbHost='127.0.0.1:9000';
assert.equal(APP533_EMULATOR_ONLY,true);
assert.equal(process.env.APP533_ISOLATED_ONLY,'yes');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,authHost);
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,dbHost);
assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
assert.ok(PROJECT.startsWith('demo-'));
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
const app=initializeApp({
 projectId:PROJECT,databaseURL:'https://'+NS+'.firebaseio.com',
},'isolated-app533');
const auth=getAuth(app),database=getDatabase(app);
const path=MARKER_PATH_533+'/'+UID;
const ref=database.ref(path);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const barrier=()=>{
 let release,entered;
 const promise=new Promise(r=>release=r);
 const reached=new Promise(r=>entered=r);
 return {promise,reached,release,entered};
};
const record=(epoch,revision,count=1)=>({
 version:1,ownerUid:UID,authEpoch:epoch,revision,
 followerCount:count,updatedAt:Date.now(),at:Date.now(),
});
const signed=r=>{
 const raw=JSON.stringify(r);
 const sig=signReceiptForEmulator533(raw,r.at,secret);
 return {rawBody:raw,at:String(r.at),signature:sig,secret};
};
const send=(r,rest={})=>deliverOwnerFollower533({
 auth,database,...signed(r),...rest,
});
async function token(email,password){
 const url='http://'+authHost+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=only-local-533';
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password,returnSecureToken:true})});
 const data=await response.json();
 assert.equal(response.status,200,'AUTH_EMULATOR_SIGNIN '+JSON.stringify(data));
 assert.ok(data.idToken);
 const parsed=await auth.verifyIdToken(data.idToken);
 return {value:data.idToken,claims:parsed};
}
async function clientRequest(idToken,method='GET',p=path,value){
 const url='http://'+dbHost+'/'+p+'.json?ns='+NS+'&auth='+encodeURIComponent(idToken);
 const response=await fetch(url,{method,
  ...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})});
 let data;try{data=await response.json();}catch{data=null;}
 return {status:response.status,data};
}
const denied=response=>{
 assert.ok(response.status===401||response.status===403,
  'OWNER_RULES_MUST_DENY '+JSON.stringify(response));
};
const stats={};
try{
 // Initial account and second independent user live in disposable emulator.
 await auth.createUser({uid:UID,email:EMAIL,password:PASS});
 await auth.createUser({uid:OTHERUID,email:OTHER,password:PASS});
 await auth.setCustomUserClaims(UID,{plan:'basic'});
 const noClaimToken=await token(EMAIL,PASS);
 assert.equal(noClaimToken.claims[CLAIM_533],undefined);
 denied(await clientRequest(noClaimToken.value));
 const g1=await enrollAuthIncarnation533(auth,UID);
 assert.match(g1.authEpoch,/^[0-9a-f]{32}$/);
 assert.equal(g1.reused,false);
 const same=await enrollAuthIncarnation533(auth,UID);
 assert.equal(same.reused,true);
 assert.equal(same.authEpoch,g1.authEpoch);
 assert.equal((await auth.getUser(UID)).customClaims.plan,'basic');
 const oldToken=await token(EMAIL,PASS);
 assert.equal(oldToken.claims[CLAIM_533],g1.authEpoch);
 const outsider=await token(OTHER,PASS);
 const initial=record(g1.authEpoch,1,1);
 assert.equal(parseSignedReceipt533(signed(initial).rawBody,String(initial.at),
  signed(initial).signature,secret)?.authEpoch,g1.authEpoch);
 const forged=signed(initial);
 assert.equal(parseSignedReceipt533(forged.rawBody,forged.at,
  '0'.repeat(64),secret),null);
 assert.equal(parseSignedReceipt533(JSON.stringify({...initial,authEpoch:'0'.repeat(32)}),
  forged.at,forged.signature,secret),null);
 const published=await send(initial);
 assert.equal(published.accepted,true);
 assert.equal(published.applied,true);
 assert.equal((await ref.get()).val().authEpoch,g1.authEpoch);
 assert.equal((await clientRequest(oldToken.value)).status,200);
 assert.equal((await clientRequest(oldToken.value)).data.followerCount,1);
 denied(await clientRequest(outsider.value));
 denied(await clientRequest(oldToken.value,'PUT',path,{followerCount:999}));
 denied(await clientRequest(outsider.value,'PUT',path,{followerCount:999}));
 // Root owner path is server-writable only. Parent userSync write permissions
 // in current shared rules would NOT permit this guarantee without migration.
 assert.equal((await ref.get()).val().followerCount,1);
 const later=await send(record(g1.authEpoch,2,3));
 assert.equal(later.accepted,true);
 assert.equal((await ref.get()).val().version,2);
 const duplicate=await send(record(g1.authEpoch,2,3));
 assert.equal(duplicate.accepted,true);
 assert.equal(duplicate.applied,false);
 const reordered=await send(record(g1.authEpoch,1,1));
 assert.equal(reordered.applied,false);
 stats.ownerSecurityRules='PASS';
 stats.authEnrollmentAndClaim='PASS';
 stats.duplicateAndReordered='PASS';

 // Auth checked before commit, then old delivery is suspended. Delete Auth,
 // clean that generation, recreate SAME UID, publish generation 2 first.
 const hold1=barrier();
 const pendingOld=send(record(g1.authEpoch,3,6),{
  beforeTransaction:async()=>{hold1.entered();await hold1.promise;}
 });
 await hold1.reached;
 await auth.deleteUser(UID);
 const cleanup1=await clearRetiredGeneration533({auth,database,uid:UID,authEpoch:g1.authEpoch});
 console.log('APP533_FIRST_CLEANUP',JSON.stringify(cleanup1),
  'marker',(await ref.get()).val()?.authEpoch||'null');
 assert.equal(cleanup1.removed,true);
 assert.equal((await ref.get()).exists(),false);
 await sleep(35);
 await auth.createUser({uid:UID,email:EMAIL,password:PASS});
 const g2=await enrollAuthIncarnation533(auth,UID);
 assert.notEqual(g2.authEpoch,g1.authEpoch);
 assert.ok(g2.createdAtMs>g1.createdAtMs,'AUTH_CREATION_TIME_MONOTONIC');
 const freshToken=await token(EMAIL,PASS);
 assert.equal(freshToken.claims[CLAIM_533],g2.authEpoch);
 denied(await clientRequest(freshToken.value)); // no matching marker yet
 const newEvent=await send(record(g2.authEpoch,1,2));
 assert.equal(newEvent.accepted,true);
 assert.equal((await clientRequest(freshToken.value)).status,200);
 denied(await clientRequest(oldToken.value)); // stale client ID-token mismatch
 hold1.release();
 const oldResult=await pendingOld;
 assert.equal(oldResult.accepted,false);
 assert.equal((await ref.get()).val().authEpoch,g2.authEpoch);
 assert.equal((await ref.get()).val().version,1);
 assert.equal((await ref.get()).val().followerCount,2);
 assert.equal(readMarkerForClaim533((await ref.get()).val(),UID,g1.authEpoch),null);
 assert.equal(readMarkerForClaim533((await ref.get()).val(),UID,g2.authEpoch).followerCount,2);
 stats.oldVerificationBeforeNewPublication='PASS';

 // Old delivery commits, THEN its post-commit Auth read is delayed. During
 // pause: delete current Auth, remove old marker, recreate Auth, publish new
 // account. When old resumes, CAS cleanup must not delete newer incarnation.
 const hold2=barrier();
 const pendingAfter=send(record(g2.authEpoch,2,4),{
  afterTransaction:async()=>{hold2.entered();await hold2.promise;}
 });
 await hold2.reached;
 assert.equal((await ref.get()).val().version,2);
 await auth.deleteUser(UID);
 await clearRetiredGeneration533({auth,database,uid:UID,authEpoch:g2.authEpoch});
 await sleep(35);
 await auth.createUser({uid:UID,email:EMAIL,password:PASS});
 const g3=await enrollAuthIncarnation533(auth,UID);
 // Auth metadata.creationTime can have coarse timestamp precision even
 // for distinct Auth incarnations. Epoch must disambiguate. Equal timestamps
 // fail closed if an old different-generation marker still exists.
 assert.ok(g3.createdAtMs>=g2.createdAtMs);
 if(g3.createdAtMs===g2.createdAtMs){
  assert.equal(nextOwnerFollowerMarker533({
   authEpoch:g2.authEpoch,authCreatedAtMs:g2.createdAtMs,version:2
  },{ownerUid:UID,authEpoch:g3.authEpoch,version:1,followerCount:7},
  g3.createdAtMs,Date.now()),undefined);
 }
 assert.equal((await send(record(g3.authEpoch,1,7))).accepted,true);
 hold2.release();
 const resultAfter=await pendingAfter;
 assert.equal(resultAfter.accepted,false);
 const snapshot3=(await ref.get()).val();
 assert.equal(snapshot3.authEpoch,g3.authEpoch);
 assert.equal(snapshot3.followerCount,7);
 assert.equal(snapshot3.version,1);
 stats.deleteAfterCommitAndCASCleanup='PASS';

 // Active new-generation record wins even if an old transaction callback
 // runs after new publication (verified-before-delete race).
 const oldLate={
  ownerUid:UID,authEpoch:g2.authEpoch,version:99,followerCount:99,
 };
 assert.equal(nextOwnerFollowerMarker533(snapshot3,oldLate,g2.createdAtMs,
  Date.now()),undefined);
 assert.equal(nextOwnerFollowerMarker533(snapshot3,{
  ownerUid:UID,authEpoch:g3.authEpoch,version:1,followerCount:7,
 },g3.createdAtMs,Date.now()),undefined);
 // Old Auth record removed -> delivery fails closed without any RTDB write.
 assert.equal((await send(record(g2.authEpoch,99,99))).accepted,false);
 assert.equal((await ref.get()).val().followerCount,7);
 // A real Auth outage must propagate; cannot false-ACK a pending relay.
 await assert.rejects(()=>deliverOwnerFollower533({
  auth:{getUser:async()=>{throw Error('AUTH_BACKEND_OUTAGE');}},
  database,...signed(record(g3.authEpoch,2,8))}),/AUTH_BACKEND_OUTAGE/);
 assert.equal((await ref.get()).val().version,1);
 stats.staleAfterRecreateAndOutage='PASS';

 // Auth-only deletion preserves canonical user content in real app; this test
 // deletes *only* the dedicated owner-marker generation (not Music Note etc).
 await auth.deleteUser(UID);
 await clearRetiredGeneration533({auth,database,uid:UID,authEpoch:g3.authEpoch});
 assert.equal((await ref.get()).exists(),false);
 denied(await clientRequest(freshToken.value));
 stats.authDeleteMarkerCleanup='PASS';
 console.log('APP533_FIREBASE_AUTH_RTDB_EMULATOR_E2E=PASS');
 console.log(JSON.stringify({kind:'APP533_ISOLATED_AUTH_RTDB',project:PROJECT,
  checks:stats,sharedProject:false,productionWrites:0,
  caveats:['No shared Firebase auth, data or rules touched',
   'Firebase custom claim enrolment not installed in existing login',
   'Auth-to-RTDB has no cross-service atomic transaction; epoch rules and post-check are risk controls, not absolute cleanup guarantee',
   'Canonical D1/R2 not run in this emulator; prior APP532 physical R1/W2 proof retained',
   'Existing userSync parent rules would permit self-write: separate dedicated root path required']},null,2));
}finally{
 await deleteApp(app);
}

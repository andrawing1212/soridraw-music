// APP713 Firebase Admin current-actor probe: in-memory mocks only.
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {isCurrentActor713,createActorProofHttp713,APP713_ACTOR_CANARY_UID}=require('../lib/ownerFollowActorVerify713.js');
(async()=>{
 const uid=APP713_ACTOR_CANARY_UID,now=Date.now(),issuedAtSec=Math.floor(now/1000)-5;
 const operationId='click713_test_operation_00000000000';
 const birth=now-3600_000;
 let user={uid,disabled:false,metadata:{creationTime:new Date(birth).toISOString()}};
 let data={},exists=true,authReads=0,firestoreReads=0;
 const auth={getUser:async()=>{authReads++;return user}};
 const firestore={collection:name=>{assert.equal(name,'users');return {
  doc:id=>{assert.equal(id,uid);return {get:async()=>{firestoreReads++;return {
   exists,data:()=>data};}};}}}};
 const item={actorUid:uid,operationId,issuedAtSec,at:now,nonce:'a'.repeat(32)};
 const check=()=>isCurrentActor713(item,{auth,firestore,now:()=>now});
 assert.equal(await check(),true);
 user={...user,disabled:true};assert.equal(await check(),false);user={...user,disabled:false};
 data={accountStatus:'banned'};assert.equal(await check(),false);
 data={authDeleted:true};assert.equal(await check(),false);
 data={authDeletionPendingAt:now};assert.equal(await check(),false);
 data={ownerFollowLifecycle534:{phase:'deleting',createdAtMs:birth}};assert.equal(await check(),false);
 data={ownerFollowLifecycle534:{phase:'active',createdAtMs:birth+1000}};assert.equal(await check(),false);
 data={};exists=false;assert.equal(await check(),false);exists=true;
 user={...user,tokensValidAfterTime:new Date(now-1000).toISOString()};
 assert.equal(await check(),false,'revocation after click holds mutation');
 user={...user,tokensValidAfterTime:undefined,metadata:{creationTime:new Date(now+6000).toISOString()}};
 assert.equal(await check(),false,'deleted and re-created UID must not claim old click');
 user={...user,metadata:{creationTime:new Date(birth).toISOString()}};
 assert.equal(await check(),true);
 assert.equal(await isCurrentActor713({...item,actorUid:'other'},{auth,firestore,now:()=>now}),false);
 const secret='test_shared_follow_hmac_secret_1234567890_x';
 const key=createHmac('sha256',secret).update('soridraw:preview:actor-proof:713').digest();
 const raw=Buffer.from(JSON.stringify(item));
 const signature=createHmac('sha256',key).update(item.at+'.').update(raw).digest('hex');
 const run=async({sig=signature,enabled=true}={})=>{
  const out={headers:{},code:0,body:null,set(k,v){this.headers[k]=v},
   status(code){this.code=code;return this},
   json(obj){this.body=JSON.stringify(obj)},
   send(str){this.body=str}};
  await createActorProofHttp713({auth,firestore,secret,now:()=>now,enabled})({
   method:'POST',rawBody:raw,get:name=>({
    'X-Soridraw-Actor-713-At':String(item.at),
    'X-Soridraw-Actor-713-Signature':sig,
   })[name]},out);
  return out;
 };
 const valid=await run();assert.equal(valid.code,200);
 const signed=createHmac('sha256',key).update(valid.body).digest('hex');
 assert.equal(valid.headers['X-Soridraw-Actor-713-Proof'],signed);
 const before=authReads;
 assert.equal((await run({sig:'0'.repeat(64)})).code,403);
 assert.equal((await run({enabled:false})).code,503);
 assert.equal(authReads,before,'missing capability does not read Firebase');
 console.log('APP713_FIREBASE_DELETED_DISABLED_REVOKED_RECREATED_HOLD=PASS');
 console.log('APP713_FIREBASE_CANARY_HMAC_NO_DATA_WRITES=PASS');
})().catch(error=>{console.error(error);process.exitCode=1});

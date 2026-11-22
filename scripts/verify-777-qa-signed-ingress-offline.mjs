// APP777 OFFLINE QA: real RS256 crypto signatures but EPHEMERAL LOCAL KEYS.
// Proves verifier/gate integration, NOT tokens issued by Firebase servers.
// No remote keys, real QA account access, D1/R2/DO, active Worker or secrets.
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign,webcrypto} from 'node:crypto';
import {createApp777QaSignedIngress,APP777_QA_SIGNED_INGRESS_COMPILED_OPEN}
 from './app777-qa-signed-ingress.mjs';
import {APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN}
 from './app775-unified-follow-ingress.mjs';

const oldFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP777_UNEXPECTED_LIVE_NETWORK')};
const now=1800000000000,sec=now/1000;
const ownerUid='qa777Owner',actorUid='qa777Actor',ownerEpoch='b'.repeat(32);
const actorEpoch='a'.repeat(32),cutover='qa777_cutover_all_existing_000001';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),
 kid:'qa-jwk-777',alg:'RS256',use:'sig'};
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload){
 const h=encode({alg:'RS256',typ:'JWT',kid:jwk.kid});
 const body=encode(payload),input=h+'.'+body;
 const signature=createSign('RSA-SHA256').update(input).end()
  .sign(pair.privateKey).toString('base64url');
 return input+'.'+signature;
}
const appId='1:1083981050742:web:aabbccdd';
const auth=(uid=actorUid)=>({
 iss:'https://securetoken.google.com/soridraw-app',
 aud:'soridraw-app',sub:uid,auth_time:sec-130,iat:sec-60,exp:sec+1200,
});
const app=()=>({
 iss:'https://firebaseappcheck.googleapis.com/1083981050742',
 aud:['projects/1083981050742','projects/soridraw-app'],
 sub:appId,iat:sec-60,exp:sec+1200,
});
let publicKeyCalls=0;
const getKeys=async(url,options)=>{
 assert(['https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com',
  'https://firebaseappcheck.googleapis.com/v1/jwks'].includes(url));
 assert.equal(options.method,'GET');
 assert.equal(options.redirect,'manual');
 publicKeyCalls++;
 return {ok:true,status:200,headers:new Headers({
  'Cache-Control':'public, max-age=600'}),
  json:async()=>({keys:[jwk]})};
};
const gate=createApp777QaSignedIngress({send:getKeys,now:()=>now,
 subtle:webcrypto.subtle,qaActorUid:actorUid,qaOwnerUid:ownerUid});
const token=sign(auth()),appToken=sign(app());
const make=(method='PUT',body='{}',jwt=token,appJwt=appToken,owner=ownerUid)=>
 new Request('https://qa-only.invalid/v1/profiles/'+owner+'/follow',{
 method,headers:{Authorization:'Bearer '+jwt,'X-Firebase-AppCheck':appJwt,
  'Content-Type':'application/json'},body});
async function opId(rev,desired){
 const input=JSON.stringify([cutover,actorUid,ownerUid,rev,desired]);
 const hash=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(input)));
 return 'owner_follow_579_'+Array.from(hash,n=>
  n.toString(16).padStart(2,'0')).join('');
}
async function evidence(revision,desired,following){
 const canonicalOperationId=await opId(revision,desired);
 return {
  verifiedActor:{authEpoch:actorEpoch},
  ownerEnrollment:{source:'TRUSTED_OWNER_ENROLLMENT_775',
   verified:true,ownerUid,ownerAuthEpoch:ownerEpoch,enrolled:true,
   ownerDeletionAndUidReuseReviewed:true},
  cutover:{source:'SERVER_COMPLETE_WRITER_CUTOVER_775',
   verified:true,token:cutover,completeBeforeFirstAcceptedOperation:true,
   everyActiveWriterCovered:true,everyLegacyWriterCovered:true,
   noLegacyBypassToCanonical:true,fullOwnerDoPitrCannotBypass:true,
   authDeletionLifecycleReviewed:true,previewTestProdCompatibilityReviewed:true},
  serverIdentity:{source:'TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775',
   verified:true,ownerUid,actorUid,authEpoch:actorEpoch,
   ownerAuthEpoch:ownerEpoch,cutoverToken:cutover,
   canonicalOperationId,expectedRevision:revision,
   serverIssuedOrVerified:true},
  pair:{source:'TRUSTED_EXACT_PAIR_REVISION_775',
   verified:true,ownerUid,actorUid,authEpoch:actorEpoch,
   ownerAuthEpoch:ownerEpoch,revision,following},
  pendingFence:{source:'INDEPENDENT_PAIR_PENDING_FENCE_775',
   verified:true,independentOfOwnerDo:true,ownerUid,actorUid,
   authEpoch:actorEpoch,canonicalOperationId,
   noEarlierPendingOperation:true,noLaterWriterBypass:true,
   allLegacyWritersCovered:true,fullOwnerDoPitrProtected:true},
 };
}
const protectedFields=['canonicalD1WriteAuthorized','r2AdmissionAuthorized',
 'doReservationAuthorized','retryAuthorized','relayAuthorized',
 'liveWorkerConnected','productionDeployAuthorized'];
function assertSafe(o){for(const k of protectedFields)assert.equal(o[k],false,k);
 assert.equal(o.realFirebaseAuthRevocationChecked,false);}
let checked=0;
try{
 assert.equal(APP777_QA_SIGNED_INGRESS_COMPILED_OPEN,false);
 assert.equal(APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,false);
 const before=publicKeyCalls;
 let v=await gate(make(),{expectedOwnerUid:ownerUid,
  evidence:await evidence(7,true,false)});
 assert.equal(v.status,'QA_SIGNED_CREDENTIALS_AND_COMMON_SHAPE_ONLY');
 assert.equal(v.qaSignedCredentialsVerified,true);
 assert.equal(v.envelopeKind,'legacy');
 assertSafe(v);checked++;
 assert.equal(publicKeyCalls-before,2,'Firebase Auth+AppCheck public keys once');
 const id=await opId(8,false);
 v=await gate(make('DELETE',JSON.stringify({
  followOperationId:id,followExpectedRevision:8,
 })),{expectedOwnerUid:ownerUid,evidence:await evidence(8,false,true)});
 assert.equal(v.status,'QA_SIGNED_CREDENTIALS_AND_COMMON_SHAPE_ONLY');
 assert.equal(v.envelopeKind,'ordered');assertSafe(v);checked++;
 assert.equal(publicKeyCalls-before,2,'cached public QA keys');
 const noAuth=async(label,request,fixture)=>{
  const out=await gate(request,{expectedOwnerUid:ownerUid,evidence:fixture||await evidence(7,true,false)});
  assert.equal(out.status,'HOLD',label);assertSafe(out);checked++;
 };
 await noAuth('no auth token',new Request(
  'https://qa-only.invalid/v1/profiles/'+ownerUid+'/follow',{method:'PUT',body:'{}'}));
 await noAuth('wrong signed actor',make('PUT','{}',sign(auth(ownerUid))));
 await noAuth('production issuer',make('PUT','{}',
  sign({...auth(),iss:'https://securetoken.google.com/soridraw-app-866a5'})));
 await noAuth('production audience',make('PUT','{}',
  sign({...auth(),aud:'soridraw-app-866a5'})));
 await noAuth('expired signed token',make('PUT','{}',
  sign({...auth(),exp:sec-1})));
 await noAuth('expired App Check',make('PUT','{}',token,
  sign({...app(),exp:sec-1})));
 await noAuth('wrong App Check project',make('PUT','{}',token,
  sign({...app(),aud:['projects/soridraw-app-866a5']})));
 const parts=token.split('.');
 parts[1]=encode({...auth(),sub:'qa777Other'});
 await noAuth('tampered JWT signature',make('PUT','{}',parts.join('.')));
 await noAuth('wrong QA owner route',make('PUT','{}',token,appToken,'qa777Other'));
 await noAuth('partial ordered envelope',make('PUT','{"followOperationId":"short"}'));
 const missing=await evidence(7,true,false);
 missing.cutover.everyLegacyWriterCovered=false;
 await noAuth('old writer bypass remains HOLD',make(),missing);
 const noFence=await evidence(7,true,false);
 delete noFence.pendingFence;
 await noAuth('independent pending fence missing',make(),noFence);
 const badEpoch=await evidence(7,true,false);
 badEpoch.verifiedActor.authEpoch='x';
 await noAuth('synthetic QA epoch not verified',make(),badEpoch);
 assert(!JSON.stringify(v).includes(token));
 assert(!JSON.stringify(v).includes(appToken));
 console.log('APP777_EPHEMERAL_RS256_AUTH_APPCHECK_AND_INGRESS=PASS');
 console.log('APP777_QA_PROJECT_PINNED_AND_PROD_TOKEN_REJECTED=PASS');
 console.log('APP777_BAD_SIGNATURE_EXPIRED_AUTH_CUTOVER_FENCE=PASS');
 console.log('APP777_OFFLINE_CASES='+checked+'; REAL_QA_FIREBASE_TOKENS=0');
 console.log('APP777_REAL_FIREBASE_ISSUED_TOKENS_AND_REVOCATION=NOT_TESTED_HOLD');
 console.log('APP777_LIVE_QA_WORKER_AND_SHARED_DATA_WRITES=0');
}finally{globalThis.fetch=oldFetch;}

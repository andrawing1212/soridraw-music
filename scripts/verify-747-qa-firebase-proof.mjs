import assert from 'node:assert/strict';
import {verifyApp747QaFirebasePrincipals}
 from './app747-qa-firebase-proof.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 actorUid:'qaSyntheticB',ownerUid:'qaSyntheticA',authEpoch:'a'.repeat(32),
 hmacSecret:'b'.repeat(64),probeToken:'c'.repeat(64)};
const appId='1:1083981050742:web:ab1234ff';
const fakeJwt=c=>'a'.repeat(85)+'.'+c.repeat(30)+'.'+'z'.repeat(64);
const actorIdToken=fakeJwt('b'),ownerIdToken=fakeJwt('d'),
 appCheckToken=fakeJwt('e');
const now=1800000000000,sec=Math.floor(now/1000);
const principal=uid=>({uid,sub:uid,aud:'soridraw-app',
 iss:'https://securetoken.google.com/soridraw-app',
 iat:sec-60,auth_time:sec-1000,exp:sec+1000});
let read=0,appCheck=0,wrongUid=false,expired=false,
 wrongProject=false,wrongApp=false,revoked=false,weakApp=false;
const tokenVerifier=async(t,checkRevoked)=>{
 assert.equal(checkRevoked,true);read++;
 if(revoked)throw Error('TOKEN_REVOKED');
 const uid=t===actorIdToken?'qaSyntheticB':'qaSyntheticA';
 return {...principal(wrongUid?'unknown':uid),
  aud:wrongProject?'soridraw-app-866a5':'soridraw-app',
  exp:expired?sec-1:sec+1000};
};
const appVerifier=async()=>{
 appCheck++;return {appId:wrongApp?'1:1083981050742:web:foreign':appId,
  sub:appId,iss:'https://firebaseappcheck.googleapis.com/1083981050742',
  aud:weakApp?['projects/866a5']:['projects/1083981050742'],
  iat:sec-20,exp:sec+1000};
};
const args={config:cfg,actorIdToken,ownerIdToken,appCheckToken,
 qaAppId:appId,verifyAuth:tokenVerifier,verifyAppCheck:appVerifier,now:()=>now};
const r=await verifyApp747QaFirebasePrincipals(args);
assert.equal(r.status,'PASS');
assert.equal(r.qaProjectId,'soridraw-app');
assert.equal(r.ownerWorkerRealTokenGateVerified,false);
assert.equal(r.functionsRtdbPhysical747,false);
assert.deepEqual([read,appCheck],[2,1]);
await assert.rejects(()=>verifyApp747QaFirebasePrincipals({...args,
 qaAppId:'1:866a5:web:foreign'}),/QA_APP_ID_NOT_PINNED/);
await assert.rejects(()=>verifyApp747QaFirebasePrincipals({...args,
 actorIdToken:'fake'}),/REAL_FIREBASE_TOKENS_NOT_SUPPLIED/);
await assert.rejects(()=>verifyApp747QaFirebasePrincipals({...args,
 ownerIdToken:actorIdToken}),/AUTH_IDENTITIES_COLLAPSED/);
await assert.rejects(()=>verifyApp747QaFirebasePrincipals({...args,
 verifyAuth:undefined}),/OFFICIAL_SDK_VERIFIERS_MISSING/);
for(const [set,reset,code] of [
 [()=>wrongUid=true,()=>wrongUid=false,/QA_ACTOR_AUTH_UNVERIFIED/],
 [()=>expired=true,()=>expired=false,/QA_ACTOR_AUTH_UNVERIFIED/],
 [()=>wrongProject=true,()=>wrongProject=false,/QA_ACTOR_AUTH_UNVERIFIED/],
 [()=>wrongApp=true,()=>wrongApp=false,/QA_APPCHECK_UNVERIFIED/],
 [()=>weakApp=true,()=>weakApp=false,/QA_APPCHECK_UNVERIFIED/],
 [()=>revoked=true,()=>revoked=false,/TOKEN_REVOKED/],
]){
 set();await assert.rejects(()=>verifyApp747QaFirebasePrincipals(args),code);
 reset();
}
// Status labels may contain the word "token"; credential material itself
// must never be returned, logged, or be embedded in a success payload.
assert(!JSON.stringify(r).includes(actorIdToken));
assert(!JSON.stringify(r).includes(ownerIdToken));
assert(!JSON.stringify(r).includes(appCheckToken));
assert(!JSON.stringify(r).includes(cfg.actorUid));
assert(!JSON.stringify(r).includes(cfg.ownerUid));
assert(!JSON.stringify(r).includes(cfg.probeToken));
console.log('APP747_QA_OFFICIAL_ADMIN_AUTH_APPCHECK_MOCK_CONTRACT=PASS');
console.log('APP747_QA_REAL_FIREBASE_TOKENS=NOT_RUN; QA_WORKER_GATE=NOT_RUN');

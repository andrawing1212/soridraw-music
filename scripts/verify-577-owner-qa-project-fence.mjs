// APP577: Offline QA-only project and recipient fence.
// NO network calls: all senders use a stub, no real Firebase, D1, Cloudflare,
// customer credentials, shared RTDB or runtime flags can be modified.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 assertQaOwnerFollowConfiguration577,QA_OWNER_FOLLOW_FUNCTION_URL_577,
} from '../cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs';
import {sendOwnerFollowHttp539,APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-http-539.mjs';

assert.equal(APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN,false);
const config={projectId:'soridraw-app',projectNumber:'1083981050742',
 authDomain:'soridraw-app.firebaseapp.com',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/',
 storageBucket:'soridraw-app.firebasestorage.app',
 endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577,
 functionsEntry:'qa/owner-follow-functions/index.js'};
assert.equal(assertQaOwnerFollowConfiguration577(config).projectId,'soridraw-app');
assert.equal(assertQaOwnerFollowConfiguration577({...config,
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'}).endpoint,QA_OWNER_FOLLOW_FUNCTION_URL_577);
const invalid=[
 {projectId:'soridraw-app-866a5'},
 {projectNumber:'91309780603'},
 {authDomain:'soridraw-app-866a5.firebaseapp.com'},
 {databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com/'},
 {databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com/'},
 {databaseURL:'https://soridraw-qa-sg.firebaseio.com/'},
 {databaseURL:'https://soridraw-qa-sg.asia-east1.firebasedatabase.app/'},
 {databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app.attacker.test/'},
 {databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com.attacker.test/'},
 {databaseURL:'http://soridraw-app-default-rtdb.firebaseio.com/'},
 {databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com/auth.json'},
 {storageBucket:'soridraw-app-866a5.firebasestorage.app'},
 {endpoint:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542'},
 {functionsEntry:'functions/src/index.ts'},
 {functionsEntry:'functions/lib/index.js'},
 {functionsEntry:'src/firebase.js'},
];
for(const change of invalid)assert.throws(
 ()=>assertQaOwnerFollowConfiguration577({...config,...change}),
 /APP577_QA_.*_HOLD/,
 'FOREIGN_OR_SHARED_QA_CONFIG_MUST_FAIL_CLOSED '+JSON.stringify(change));

const code=readFileSync('functions/src/index.ts','utf8');
assert.match(code,/admin\.initializeApp\(\{\s*databaseURL:\s*"https:\/\/soridraw-app-866a5-default-rtdb\.firebaseio\.com"/);
const receiver=readFileSync('functions/src/exploreOwnerFollowerWebhook542.ts','utf8');
assert.match(receiver,/APP542_OWNER_HTTP_COMPILED_OPEN=false/);
const client=readFileSync('src/services/exploreOwnerFollowerSync542.ts','utf8');
assert.match(client,/EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED=true/);
assert.match(client,/uid===APP608_APPROVED_CANARY_UID/);
assert.match(client,/hostname==='preview.soridraw.com'/);
const qaEndpoint=QA_OWNER_FOLLOW_FUNCTION_URL_577;
const liveEndpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const event={ownerUid:'ownerA577',authEpoch:'0123456789abcdef0123456789abcdef',
 version:1,followerCount:1,updatedAt:1800000000000};
const secret='isolated-qa-mock-only-577-very-long-secret';
let sends=0;
const send=async(url,init)=>{sends++;assert.equal(url,qaEndpoint);
 const body=JSON.parse(init.body);assert.equal(body.ownerUid,event.ownerUid);
 assert.equal(body.revision,event.version);return {ok:true,status:200,json:async()=>({ok:true,applied:true})}};
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const args={endpoint:qaEndpoint,secret,send,now:()=>1800000000000};
const ok=await sendOwnerFollowHttp539(event,{...args,qaOnly:true});
assert.deepEqual(ok,{ok:true,status:200,applied:true});assert.equal(sends,1);
for(const bad of [
 {...args,qaOnly:true,endpoint:liveEndpoint},
 {...args,qaOnly:true,endpoint:'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542.evil.test'},
 {...args,qaOnly:true,isolatedOnly:true},
 {...args}, // default production-only path; QA URL must be rejected
 {...args,isolatedOnly:true},
])await assert.rejects(()=>sendOwnerFollowHttp539(event,bad),/APP539_ENDPOINT_NOT_PINNED/);
assert.equal(sends,1,'MISMATCH_MUST_NOT_SEND_NETWORK_OR_SIGN');
console.log('APP577_QA_ONLY_FIREBASE_CONFIG_AND_FUNCTION_ENTRY_GUARD=PASS');
console.log('APP577_QA_ONLY_HMAC_SENDER_ROUTE_AND_PROD_DENIAL=PASS');
console.log('APP577_DEFAULT_PRODUCTION_ROUTE_OFF_UNCHANGED=PASS');
console.log('APP577_REAL_QA_DEPLOYMENT_AND_COST=NOT_PERFORMED');

 
// APP582: the Singapore rule artifact must be identical to the already
// isolated Auth+RTDB emulator-proven owner-only root. It is NEVER attached to
// the Firebase deploy config: rules must stay locked until separate rollout.
import {createQaOwnerClient582,assertQaOwnerClient582,QA_OWNER_FOLLOW_SG_URL_582}
 from '../qa/owner-follow-582/owner-client.mjs';
import {enrollQaOwnerClaim582} from '../qa/owner-follow-582/owner-claim.mjs';
const parsed=(p)=>JSON.parse(readFileSync(p,'utf8'));
const candidate=parsed('qa/owner-follow-582/singapore.owner.rules.json');
const proven=parsed('scripts/emulator/app533.database.rules.json');
assert.deepEqual(candidate,proven,'APP582_ONLY_ALREADY_EMULATOR_PROVEN_OWNER_ROOT');
assert.equal(candidate.rules['.read'],false);
assert.equal(candidate.rules['.write'],false);
assert.deepEqual(Object.keys(candidate.rules).sort(),
 ['.read','.write','ownerFollowerSync532'].sort());
assert.equal(candidate.rules.ownerFollowerSync532.$uid['.write'],false);
assert.ok(candidate.rules.ownerFollowerSync532.$uid['.read'].includes('auth.uid === $uid'));
assert.match(candidate.rules.ownerFollowerSync532.$uid['.read'],/soridrawFollowEpoch532/);
assert.equal(Object.hasOwn(parsed('firebase.qa577.json'),'database'),false,
 'QA_SG_RULES_MUST_NOT_AUTO_DEPLOY_TO_US_DEFAULT');
assert.equal(QA_OWNER_FOLLOW_SG_URL_582,
 'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app');
const sdkConfig582={
 projectId:'soridraw-app',authDomain:'soridraw-app.firebaseapp.com',
 databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 appId:'1:1083981050742:web:0123456789abcdef',
 messagingSenderId:'1083981050742',apiKey:'AIza'+'A'.repeat(35),
 storageBucket:'soridraw-app.firebasestorage.app',
};
assert.equal(assertQaOwnerClient582(sdkConfig582,'ownerA582').projectId,'soridraw-app');
for(const changed of [
 {projectId:'soridraw-app-866a5'},
 {authDomain:'soridraw-app-866a5.firebaseapp.com'},
 {databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com'},
 {databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'},
 {databaseURL:'https://soridraw-qa-sg.asia-east1.firebasedatabase.app'},
 {appId:'1:91309780603:web:0123456789abcdef'},
 {messagingSenderId:'91309780603'},
 {apiKey:''},
]){
 assert.throws(()=>assertQaOwnerClient582({...sdkConfig582,...changed},'ownerA582'),
 /APP577_QA_.*_HOLD|APP582_QA_CLIENT_IDENTITY_HOLD/);
}
let setup582=0,read582=0,updates582=0,logout582=0;
const auth582={currentUser:null},owner582={uid:'ownerA582'};
let sink582=null,epoch582='0123456789abcdef0123456789abcdef';
const sdk582={
 initializeApp(config,name){
  setup582++;assert.equal(name,'soridraw-isolated-owner-qa582');
  assert.equal(config.projectId,'soridraw-app');return {config,name};
 },
 getAuth(){return auth582},
 getDatabase(app,db){assert.equal(db,QA_OWNER_FOLLOW_SG_URL_582);return {db}},
 async signInWithEmailAndPassword(_,email){
  assert.equal(email,'testa@example.com');auth582.currentUser=owner582;
  return {user:owner582};
 },
 async getIdTokenResult(){return {claims:{soridrawFollowEpoch532:epoch582}}},
 ref(_,path){assert.equal(path,'ownerFollowerSync532/ownerA582');return {path}},
 onValue(_,callback){read582++;sink582=callback;return ()=>{sink582=null}},
 async signOut(){logout582++;auth582.currentUser=null},
};
for(const bad of [{...sdkConfig582,projectId:'soridraw-app-866a5'},
 {...sdkConfig582,databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com'}]){
 await assert.rejects(
  ()=>createQaOwnerClient582({config:bad,ownerUid:'ownerA582',sdk:sdk582}),
  /APP577_QA_.*_HOLD|APP582_QA_CLIENT_IDENTITY_HOLD/);
}
assert.equal(setup582,0,'BAD_QA_CLIENT_MUST_NOT_INITIALIZE_FIREBASE');
const client582=await createQaOwnerClient582({
 config:sdkConfig582,ownerUid:'ownerA582',sdk:sdk582,
});
const noAuthUnsub582=await client582.subscribeOwner(()=>updates582++);
noAuthUnsub582();
assert.equal(read582,0);
await assert.rejects(()=>client582.signInOwner('testb@example.com','test-secret'),
 /APP582_ONLY_QA_OWNER_A_EMAIL/);
await client582.signInOwner('testa@example.com','only-synthetic-test');
epoch582='';
const noClaimUnsub582=await client582.subscribeOwner(()=>updates582++);
noClaimUnsub582();
assert.equal(read582,0,'NO_CLAIM_NO_QA_RDB_CONNECTION');
epoch582='0123456789abcdef0123456789abcdef';
const unsub582=await client582.subscribeOwner(()=>updates582++);
assert.equal(read582,1);
sink582({val:()=>null});
sink582({val:()=>({ownerUid:'ownerA582',authEpoch:'f'.repeat(32),version:1})});
sink582({val:()=>({ownerUid:'ownerA582',authEpoch:epoch582,version:1})});
assert.equal(updates582,1,'ONLY_OWNER_MATCHED_EPOCH_DELIVERED');
auth582.currentUser={uid:'ownerA582'};
sink582({val:()=>({ownerUid:'ownerA582',authEpoch:epoch582,version:2})});
assert.equal(updates582,1,'PRINCIPAL_SWITCH_NO_STALE_SIGNAL');
unsub582();
await client582.signOut();assert.equal(logout582,1);
let claimReads582=0,claimWrites582=0;
const user582={uid:'ownerA582',email:'testa@example.com',
 metadata:{creationTime:new Date(1800000000000).toUTCString()},
 customClaims:{existing:'protected'}};
const qaAdmin582={
 app:{name:'soridraw-owner-follow-qa578',options:{
  projectId:'soridraw-app',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 }},
 async getUser(uid){claimReads582++;assert.equal(uid,user582.uid);return {...user582}},
 async setCustomUserClaims(uid,claims){
  claimWrites582++;assert.equal(uid,user582.uid);
  user582.customClaims=claims;
 },
};
await assert.rejects(()=>enrollQaOwnerClaim582({
 projectId:'soridraw-app-866a5',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 ownerUid:user582.uid,qaAdminAuth:qaAdmin582,authorized:true}),
 /APP582_QA_OWNER_ENROLLMENT_HOLD/);
assert.equal(claimReads582,0,'NO_PROD_AUTH_LOOKUP');
await assert.rejects(()=>enrollQaOwnerClaim582({
 projectId:'soridraw-app',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 ownerUid:user582.uid,qaAdminAuth:{...qaAdmin582,
  app:{name:'default',options:{projectId:'soridraw-app-866a5',
   databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'}}},
 authorized:true}),
 /APP582_QA_OWNER_ENROLLMENT_HOLD/);
assert.equal(claimReads582,0,'WRONG_ADMIN_APP_NO_AUTH_LOOKUP');
await assert.rejects(()=>enrollQaOwnerClaim582({
 projectId:'soridraw-app',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 ownerUid:user582.uid,qaAdminAuth:qaAdmin582}),
 /APP582_QA_OWNER_ENROLLMENT_HOLD/);
const assigned582=await enrollQaOwnerClaim582({
 projectId:'soridraw-app',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 ownerUid:user582.uid,qaAdminAuth:qaAdmin582,authorized:true,
 makeEpoch:()=>epoch582,
});
assert.equal(assigned582.epoch,epoch582);
assert.equal(user582.customClaims.existing,'protected');
assert.equal(claimWrites582,1);
const reused582=await enrollQaOwnerClaim582({
 projectId:'soridraw-app',databaseURL:QA_OWNER_FOLLOW_SG_URL_582,
 ownerUid:user582.uid,qaAdminAuth:qaAdmin582,authorized:true,
 makeEpoch:()=>{throw Error('NO_SECOND_EPOCH');},
});
assert.equal(reused582.reused,true);assert.equal(claimWrites582,1);
console.log('APP582_QA_SINGAPORE_OWNER_ONLY_RULE_PROVEN_AND_AUTO_DEPLOY_DISABLED=PASS');
console.log('APP582_QA_CLIENT_BEFORE_SDK_PROD_DENIAL_AND_OWNER_A_EPOCH_READ_ONLY=PASS');
console.log('APP582_QA_OWNER_CLAIM_ONE_ACCOUNT_EXISTING_CLAIMS_SAFE_OFFLINE=PASS');
console.log('APP582_NO_REAL_AUTH_RULES_FUNCTION_OR_WORKER_DEPLOYMENT=PASS');



// APP583: permanent Cloudflare QA is a distinct account; this is SOURCE-ONLY.
// Verify allowlisted fixed account + synthetic-only DO before any user-authorized deploy.
const qaCloudflare583=JSON.parse(readFileSync(
 'cloudflare/explore-worker/wrangler.owner-qa-583.json','utf8'));
assert.equal(qaCloudflare583.account_id,'b60fcd62c679c64db19f0b0e0c2f3429');
assert.notEqual(qaCloudflare583.account_id,'e1a30fc9ef497fda1d34f4ab3dc1da45');
assert.equal(qaCloudflare583.name,'soridraw-owner-qa-583');
assert.equal(qaCloudflare583.main,
 './experiments/owner-follow-isolated-558-entry.mjs');
assert.equal(qaCloudflare583.workers_dev,true);
assert.equal(qaCloudflare583.compatibility_date,'2026-11-01');
assert.deepEqual(Object.keys(qaCloudflare583).sort(),[
 'account_id','name','main','compatibility_date','workers_dev',
 'durable_objects','migrations','vars',
].sort());
assert.deepEqual(qaCloudflare583.durable_objects,{
 bindings:[{name:'OWNER558_DO',class_name:'OwnerFollowIsolated558'}],
});
assert.deepEqual(qaCloudflare583.migrations,[{
 tag:'v1',new_sqlite_classes:['OwnerFollowIsolated558'],
}]);
assert.deepEqual(qaCloudflare583.vars,{
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
});
const onlySyntheticEntry583=readFileSync(
 'cloudflare/explore-worker/experiments/owner-follow-isolated-558-entry.mjs','utf8');
assert.match(onlySyntheticEntry583,/class OwnerFollowIsolated558/);
assert.match(onlySyntheticEntry583,/OWNER558_TEST_TOKEN/);
assert.match(onlySyntheticEntry583,/idFromName\('synthetic-owner-only'\)/);
assert.doesNotMatch(onlySyntheticEntry583,/env\.DB|env\.PROFILE_MEDIA|env\.RATE_DB/);
assert.doesNotMatch(onlySyntheticEntry583,/firebase-admin|functions\.net|soridraw-app-866a5/);
assert.equal(Object.hasOwn(qaCloudflare583.vars,'OWNER558_TEST_TOKEN'),false);
console.log('APP583_QA_FIXED_ACCOUNT_NO_D1_R2_FIREBASE_OR_PROD_BINDINGS=PASS');
console.log('APP583_WORKERS_FREE_SQLITE_DO_SYNTHETIC_ONLY_NO_SECRET_IN_CONFIG=PASS');
console.log('APP583_QA_WORKER_NOT_DEPLOYED_FROM_SOURCE_TEST=PASS');

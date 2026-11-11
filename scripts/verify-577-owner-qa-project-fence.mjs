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
 databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com/',
 storageBucket:'soridraw-app.firebasestorage.app',
 endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577,
 functionsEntry:'qa/owner-follow-functions/index.js'};
assert.equal(assertQaOwnerFollowConfiguration577(config).projectId,'soridraw-app');
assert.equal(assertQaOwnerFollowConfiguration577({...config,
 databaseURL:'https://soridraw-app-default-rtdb.asia-southeast1.firebasedatabase.app/'}).endpoint,QA_OWNER_FOLLOW_FUNCTION_URL_577);
const invalid=[
 {projectId:'soridraw-app-866a5'},
 {projectNumber:'91309780603'},
 {authDomain:'soridraw-app-866a5.firebaseapp.com'},
 {databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com/'},
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
assert.match(client,/EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED=false/);
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

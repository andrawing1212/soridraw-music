// APP542: frozen release-source contracts and pure receiver security tests.
// No network, Cloudflare/Firebase credentials, D1 or user data operations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {
 APP542_OWNER_HTTP_COMPILED_OPEN,createOwnerFollowerHttp542,
} from '../functions/src/exploreOwnerFollowerWebhook542.ts';
const read=path=>readFileSync(path,'utf8');
const index=read('functions/src/index.ts');
const entry=read('cloudflare/explore-worker/canonical/preview-entry.js');
const page=read('src/pages/ExplorePage.tsx');
const client=read('src/services/exploreOwnerFollowerSync542.ts');
const sender=read('cloudflare/explore-worker/runtime/owner-follow-http-539.mjs');
const worker=read('cloudflare/explore-worker/canonical/preview-worker.js');
assert.equal(APP542_OWNER_HTTP_COMPILED_OPEN,false);
assert.doesNotMatch(index,/export\s*\{\s*publishExploreOwnerFollower529\s*\}/);
assert.doesNotMatch(index,/export\s*\{\s*publishExploreOwnerFollower542\s*\}/);
assert.doesNotMatch(entry,/OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN|runOwnerFollowDelivery529/);
assert.match(entry,/OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN/);
assert.match(entry,/APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN/);
assert.match(entry,/runOwnerFollowDelivery542/);
assert.match(entry,/soridraw-owner-follow-retry-542/);
assert.doesNotMatch(read('cloudflare/explore-worker/canonical/wrangler.preview.jsonc'),
 /soridraw-owner-follow-retry-542|SORIDRAW_OWNER_FOLLOW_PUSH_532/);
assert.doesNotMatch(worker,/adjustExploreFollowCountersDelta540/);
assert.match(sender,/HTTP_RELEASE='https:\/\/asia-northeast3-soridraw-app-866a5.cloudfunctions.net\/publishExploreOwnerFollower542'/);
assert.match(client,/EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED=false/);
assert.match(client,/ownerFollowerSync532/);
assert.match(client,/soridrawFollowEpoch532/);
assert.doesNotMatch(page,/subscribeExploreOwnerFollower529|createOwnerFollowerGate529/);
assert.match(page,/createOwnerEpochGate538/);
assert.match(page,/subscribeExploreOwnerFollower542/);
assert.match(page,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 120_000/);
assert.doesNotMatch(page,/onOwnFollowersFocus525/);
const uid='A',ep1='0123456789abcdef0123456789abcdef';
const ep2='fedcba9876543210fedcba9876543210';
const at=1800000000000,secret='isolated-unit-test-secret-542-not-deploy';
let epoch=ep1,created=at-1000000,marker=null;
let changes=0,authFails=false;
const auth={async getUser(who){
 if(authFails)throw Error('AUTH_UNAVAILABLE');
 if(epoch===null){const e=Error('not found');e.code='auth/user-not-found';throw e}
 return {uid:who,metadata:{creationTime:new Date(created).toUTCString()},
  customClaims:{soridrawFollowEpoch532:epoch}};
}};
const slot={
 async transaction(callback){const next=callback(marker);
  if(next===undefined)return {committed:false};
  marker=next;changes++;return {committed:true}},
 async get(){return {val:()=>marker}},
};
const database={ref(key){assert.equal(key,'ownerFollowerSync532/A');return slot}};
const handler=createOwnerFollowerHttp542({auth,database,secret,now:()=>at});
const send=async ({revision=1,count=1,authEpoch=ep1,signatureInvalid=false,method='POST'}={})=>{
 const body=Buffer.from(JSON.stringify({version:1,ownerUid:uid,authEpoch,
  revision,followerCount:count,updatedAt:at-100,at}));
 const signature=createHmac('sha256',secret).update(at+'.').update(body).digest('hex');
 let status=0,data=null;
 const req={method,rawBody:body,
  get(name){if(name.endsWith('-At'))return String(at);
   if(name.endsWith('-Signature'))return signatureInvalid?'0'.repeat(64):signature;
   return undefined;}};
 const res={set(){return this},status(code){status=code;return {json(v){data=v}}}};
 await handler(req,res);return {status,data};
};
assert.equal((await send({signatureInvalid:true})).status,403);
assert.equal(changes,0);
assert.equal((await send()).status,200);assert.equal(marker.version,1);
assert.equal((await send()).data.applied,false);assert.equal(changes,1);
assert.equal((await send({revision:2,count:0})).status,200);
assert.equal(marker.followerCount,0);assert.equal(marker.version,2);
assert.equal((await send({revision:1})).data.applied,false);assert.equal(changes,2);
epoch=null;
assert.equal((await send({revision:3})).status,409);assert.equal(changes,2);
epoch=ep2;created+=10000;
assert.equal((await send({revision:1,count:4,authEpoch:ep2})).status,200);
assert.equal(marker.version,1);assert.equal(marker.authEpoch,ep2);
assert.equal((await send({revision:4,authEpoch:ep1})).status,409);
authFails=true;
assert.equal((await send({revision:2,authEpoch:ep2})).status,503);
assert.equal(marker.version,1);
console.log('APP542_OWNER_HTTP_HMAC_EPOCH_REPLAY_OFF_AND_NO_LIVE_WIRING=PASS');

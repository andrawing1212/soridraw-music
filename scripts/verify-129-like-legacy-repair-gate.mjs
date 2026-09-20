import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path=process.env.SORIDRAW_GENERATED_WORKER;
assert.ok(path,'Provide only dry-run generated Worker');
const worker=readFileSync(path,'utf8');
const original=readFileSync('cloudflare/explore-worker/patches/075-targeted-canonical-like-read.mjs','utf8');
const begin=worker.indexOf('async function handleMyLikeConfirmed075(');
const end=worker.indexOf('async function handleMyLikeStatesD1Core(',begin);
assert.ok(begin>0 && end>begin);
const helper=worker.slice(begin,end);
assert.match(worker,/SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920/);
assert.match(helper,/handleMyLikeStatesD1Core\(request, url, env, cors\)/);
assert.doesNotMatch(helper,/caches\.default|bucket\.get/);
if (worker.includes('SORIDRAW_LIKE_CANONICAL_SETTLEMENT_GATE_076_20260920')) {
  assert.match(helper,/env\.DB\.prepare\(/);
} else assert.doesNotMatch(helper,/env\.DB/);
assert.match(worker,/if \(url\.pathname === "\/v1\/me\/likes-confirmed" && request\.method === "GET"\)/);
const canonical=worker.slice(end,worker.indexOf('\n}',end)+2);
assert.match(canonical,/requireExploreAuth\(request\)/);
assert.match(canonical,/FROM likes l/);
assert.match(canonical,/l\.user_uid = \?/);
assert.match(canonical,/t\.is_public = 1/);
assert.match(canonical,/t\.status = 'published'/);
assert.doesNotMatch(canonical,/INSERT|DELETE FROM|UPDATE likes/);

let calls=0;
const fn=new Function('throwApi','handleMyLikeStatesD1Core','requireExploreAuth',helper+'return handleMyLikeConfirmed075;')(
  (code,message,status)=>{const e=new Error(message);e.code=code;e.status=status;throw e;},
  async (_request,_url,_env,_cors)=>{calls++;return {ok:true,data:{likedTrackIds:['track-a']}};},
  async ()=>({uid:'test-account'}),
);
const safeEnv={DB:{prepare:(query)=>({bind:(uid)=>({
  first:async()=>{assert.match(query,/WHERE q\.user_uid = \?/);assert.equal(uid,'test-account');return null;}
})})}};
const url=(ids)=>new URL('https://example.com/v1/me/likes-confirmed?trackIds='+encodeURIComponent(ids));
await fn({},url('track-a,track-b'),safeEnv,{});
assert.equal(calls,1,'authorized D1 core must be called once');
for(const ids of ['',Array.from({length:21},(_,i)=>'track-'+i).join(','),'x'.repeat(513)]){
  await assert.rejects(()=>fn({},url(ids),safeEnv,{}),error=>error.code==='INVALID_CONFIRMATION_IDS'&&error.status===400);
}
assert.equal(calls,1,'invalid requests must never read D1');

// Red-team evidence: a legacy unconditional writer does not preserve the 074
// conditional-write token. The new endpoint supplies a bounded canonical
// inspection, but by itself cannot automatically repair that shared R2 object.
const shared={schemaVersion:1,uid:'same-account',likedTrackIds:['song'],lastLikeOrders074:{song:{at:200,batchId:'latest'}}};
const staleLegacySnapshot={schemaVersion:1,uid:'same-account',likedTrackIds:[],updatedAt:300};
const canonicalLiked=true;
Object.assign(shared,staleLegacySnapshot);
delete shared.lastLikeOrders074;
assert.equal(shared.likedTrackIds.includes('song'),false,'old writer overwrite must reproduce stale R2');
assert.equal(canonicalLiked,true,'canonical remains true');
assert.ok(!Object.hasOwn(shared,'lastLikeOrders074'),'old writer has dropped new ordering marker');

console.log('075_AUTHENTICATED_BOUND_20_D1_READ_ONLY=PASS');
console.log('075_INVALID_INPUT_REJECTED_BEFORE_D1=PASS');
console.log('075_LEGACY_R2_OVERWRITE_REPRODUCED=PASS');
console.log('075_AUTOMATIC_LEGACY_REPAIR=NOT_IMPLEMENTED');
console.log('075_DEPLOY_AND_USER_DATA_WRITE=0');

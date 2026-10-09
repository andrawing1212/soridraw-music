// Stage433: read-only upgraded-client reconciliation after three-environment
// writer freeze; no live Cloudflare, Firebase, user-row writes or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readAuthoritativeLikeIntents433 as read,
  reconcileLegacyPendingIntent433 as rebase,
} from '../cloudflare/explore-worker/runtime/like-legacy-intent-reconcile-433.mjs';
let reads=0,writes=0;
const exact={
  first:{eligible:1,liked:1,revision:4,operation_id:'prior-4',
    like_count:7,generation:11},
  second:{eligible:1,liked:0,revision:2,operation_id:'prior-2',
    like_count:3,generation:8},
  hidden:{eligible:0,liked:1,revision:1,operation_id:'old',
    like_count:1,generation:0},
};
const db={
  prepare(sql){assert.match(sql,/explore_like_overrides_171/);
    return{bind(...values){
      const id=values[0];return{async first(){
        reads++;return exact[id]??null;
      }};
    }};
  },
  async batch(){writes++;throw new Error('NO_CANONICAL_WRITES_ALLOWED');},
};
await assert.rejects(read({db,uid:'me',trackIds:['first']}),
  /433_ALL_ENVIRONMENT_FENCE_NOT_PROVEN/);
assert.equal(reads,0);
const data=await read({db,uid:'me',trackIds:['first','second','hidden'],
  allEnvironmentCutoverVerified:true});
assert.equal(data.ok,true);
assert.equal(data.data.appliedMutation,false);
assert.deepEqual(data.data.results,[
  {trackId:'first',status:'exact',liked:true,revision:4,likeCount:7,generation:11},
  {trackId:'second',status:'exact',liked:false,revision:2,likeCount:3,generation:8},
  {trackId:'hidden',status:'ineligible'},
]);
assert.equal(reads,3);assert.equal(writes,0);
for(const ids of [[],['first','first'],new Array(11).fill('first'),['  invalid']]){
  await assert.rejects(read({db,uid:'me',trackIds:ids,
    allEnvironmentCutoverVerified:true}),/433_INVALID_TARGETED_RECONCILIATION/);
}
assert.equal(reads,3);
const pending={trackId:'first',desiredLiked:true,operationId:undefined,
  expectedRevision:undefined,baseLiked:false,baseLikeCount:6,retryCount:2};
let nextId=0;
const same=rebase(pending,data.data.results[0],()=>{nextId++;return 'should-not-run';});
assert.equal(same.status,'already-satisfied');assert.equal(nextId,0);
const opposite=rebase({...pending,desiredLiked:false},data.data.results[0],
  ()=>{nextId++;return 'new-verified-id-433';});
assert.equal(opposite.status,'rebased');
assert.equal(opposite.pending.operationId,'new-verified-id-433');
assert.equal(opposite.pending.expectedRevision,4);
assert.equal(opposite.pending.baseLiked,true);
assert.equal(opposite.pending.baseLikeCount,7);
assert.equal(nextId,1);
assert.equal(pending.operationId,undefined,'original old intention not mutated');
assert.throws(()=>rebase(pending,{trackId:'first',status:'guess',liked:true,revision:0},
  ()=>{throw Error('MUST_NOT_CREATE_ID')}),/433_EXACT_AUTHORITY_UNAVAILABLE_RETAIN_OUTBOX/);
// A stale PC is allowed to send this exact revision but cannot overwrite the
// other device if 171 has already moved from revision4 -> revision5. The
// existing 171 compare-and-swap handles the conflict with W0.
const writer=readFileSync('cloudflare/explore-worker/runtime/like-d1only-171.mjs','utf8');
assert.match(writer,/explore_like_overrides_171\.revision = \?/);
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/const STAGE426_COMPILED_OPEN = false;/);
assert.match(entry,/handleLikeReconcile433\(request,env,ctx\)/);
assert.match(entry,/readAuthoritativeLikeIntents433/);
const start=entry.indexOf('async function handleLikeReconcile433(');
const end=entry.indexOf('async function handleVerifiedLikeBatch426(',start);
const part=entry.slice(start,end);
assert.ok(part.indexOf('validateExploreAuth307(request,env,ctx)')>=0);
assert.ok(part.indexOf('validateExploreAuth307')<
  part.indexOf('await proveLikeBatchCutover426'));
assert.ok(part.indexOf('await proveLikeBatchCutover426')<
  part.indexOf('await readAuthoritativeLikeIntents433'));
assert.match(part,/Access-Control-Allow-Methods/);
assert.match(part,/Access-Control-Allow-Headers/);
assert.match(entry,/request.method==='OPTIONS'&&url.pathname==='\/v1\/me\/likes\/reconcile'/);
assert.match(entry,/STAGE426_COMPILED_OPEN&&env\?\.SORIDRAW_LIKE_171_READY==='1'/);
console.log('433_ALL_ENV_FENCE_AND_AUTH_BEFORE_CANONICAL_READ=PASS');
console.log('433_OLD_INTENT_REBASE_WITH_EXACT_REVISION_NO_FALSE_ACK=PASS');
console.log('433_CAPPED_USER_SCOPED_D1_READ_AND_NO_WRITES=PASS');
console.log('433_ROUTE_STILL_DORMANT_OLD_LIVE_WORKER_UNCHANGED=PASS');

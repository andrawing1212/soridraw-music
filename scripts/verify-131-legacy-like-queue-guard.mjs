import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file=process.env.SORIDRAW_GENERATED_WORKER;
assert.ok(file,'dry-run generated Worker path required');
const source=readFileSync(file,'utf8');
const begin=source.indexOf('async function requireLegacyLikeQueuesSettled077(');
const end=source.indexOf('async function handleMyLikeConfirmed075(',begin);
assert.ok(begin>0&&end>begin);
const helper=source.slice(begin,end);
const handler=source.slice(end,source.indexOf('async function handleMyLikeStatesD1Core(',end));
assert.match(source,/SORIDRAW_LEGACY_LIKE_QUEUE_GUARD_077_20260920/);
assert.match(handler,/await requireLegacyLikeQueuesSettled077\(env\)/);
assert.ok(handler.indexOf('await requireLegacyLikeQueuesSettled077(env)') <
  handler.indexOf('return await handleMyLikeStatesD1Core'), 'legacy queue probe must precede D1 membership');
assert.ok(!helper.includes('WHERE user_uid =') && !helper.includes('WHERE q.user_uid =') && !helper.includes('json_each('), 'do not scan per UID or expand JSON');

let queried=[],membershipReads=0;
let pendingTable='',errorTable='';
const tableNames=['explore_like_batches_069','explore_like_batches_066','explore_like_batches_035'];
const fail=(code,message,status)=>{const e=new Error(message);Object.assign(e,{code,status});throw e;};
const legacy=new Function('throwApi',helper+'return requireLegacyLikeQueuesSettled077;')(fail);
const confirm=new Function('throwApi','handleMyLikeStatesD1Core','requireExploreAuth','requireLegacyLikeQueuesSettled077',
  handler+'return handleMyLikeConfirmed075;')(
    fail,
    async()=>{membershipReads++;return {ok:true,data:{likedTrackIds:['song']}};},
    async()=>({uid:'target-user'}),
    legacy,
);
const env={DB:{prepare:(sql)=>{
  const found=tableNames.filter(t=>sql.includes('FROM '+t));
  assert.equal(found.length,1,'each query must probe a single existing legacy table');
  assert.match(sql,/SELECT 1 AS pending/);
  assert.match(sql,/LIMIT 1/);
  assert.doesNotMatch(sql,/WHERE|JOIN|ORDER BY|json_each/);
  const t=found[0];queried.push(t);
  return {first:async()=>{
    if(errorTable===t)throw Error('D1 unavailable');
    return pendingTable===t?{pending:1}:null;
  }};
}}};
const u=new URL('https://unit.test/v1/me/likes-confirmed?trackIds=song');
for(const t of tableNames) {
  pendingTable=t;errorTable='';queried=[];
  await assert.rejects(()=>confirm({},u,env,{}),
    e=>e.code==='LEGACY_LIKE_STILL_PROCESSING'&&e.status===409);
  assert.equal(membershipReads,0,'pending legacy mutation must prevent canonical read');
  assert.equal(queried.length,tableNames.indexOf(t)+1,'stop as soon as any legacy queue is pending');
}
for(const t of tableNames) {
  pendingTable='';errorTable=t;queried=[];
  await assert.rejects(()=>confirm({},u,env,{}),
    e=>e.code==='LEGACY_LIKE_SETTLEMENT_UNAVAILABLE'&&e.status===503);
  assert.equal(membershipReads,0,'unavailable table must fail closed');
}
pendingTable='';errorTable='';queried=[];
const result=await confirm({},u,env,{});
assert.equal(result.ok,true);
assert.equal(membershipReads,1);
assert.deepEqual(queried,tableNames,'exactly three constant-size first-entry probes');
console.log('077_LEGACY_069_066_035_PENDING_FAIL_CLOSED=PASS');
console.log('077_LEGACY_QUEUE_READ_FAILURE_FAIL_CLOSED=PASS');
console.log('077_MAX_THREE_PRIMARY_KEY_PROBES_NO_USER_SCAN=PASS');
console.log('077_ACTIVE_075_PLUS_LEGACY_SETTLEMENT_GUARD_ORDER=PASS');
console.log('077_CROSS_WORKER_CONCURRENT_ENQUEUE_FENCE=NOT_GUARANTEED');
console.log('077_OLD_WRITER_WITH_CONTINUOUS_LOAD_CAN_DELAY_RECOVERY=TRUE');
console.log('077_NO_DEPLOY_NO_DATA_WRITE=PASS');

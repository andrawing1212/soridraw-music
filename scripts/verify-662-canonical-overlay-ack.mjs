import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchSettledCanonicalFollowAck662 as patch,sha662} from './lib/follow-canonical-counts-662.mjs';
const releaseScript=readFileSync('scripts/app662-preview-canonical-follow-worker.mjs','utf8');
assert.match(releaseScript,/patchSettledCanonicalFollowAck662\(bytes\(main\)\.toString\('utf8'\)\)/);
assert.doesNotMatch(releaseScript,/patchActiveProfileConnections661/);
const fixture=`async function handleFollowOverlay354(request, env, cors, actor, target, following, cutover) {
  const result2 = await orchestrateFollowOverlay354(env, actor, target, following);
  const state = await readFollowProfile354(env, target, cutover);
  if (Object.keys(state.sync.pending).length) await repairFollowProfile354(env, target, cutover, request);
  const current = await readFollowProfile354(env, target, cutover);
  if (!result2.duplicate) await invalidateFollowProfiles355(request, env, [actor, target]);
  return json(
    { ok: true, data: {
      uid: target,
      ...result2,
      followerCount: current.bundle.body.data.profile.followerCount,
      followingCount: current.bundle.body.data.profile.followingCount
    } },
    200,
    { ...cors, "X-Soridraw-Follow-Protocol": "354" }
  );
}
__name(handleFollowOverlay354, "handleFollowOverlay354");`;
const revised=patch(fixture,sha662(fixture));
assert.notEqual(revised,fixture);
assert.match(revised,/canonicalCounts662/);
assert.match(revised,/actorFollowingCount: canonicalCounts662 \? actorFollowing662 : null/);
assert.match(revised,/readFollowProfile354\(env, actor, cutover\)/);
assert.doesNotMatch(revised,/readExactEffectiveFollowCounts351|env\.DB/);
assert.throws(()=>patch(fixture),/SOURCE_SHA_DRIFT/);
assert.throws(()=>patch(revised,sha662(revised)),/ANCHOR_CHANGED/);
const fn=new Function('orchestrateFollowOverlay354','readFollowProfile354',
 'repairFollowProfile354','invalidateFollowProfiles355','json',
 revised.replace(/__name\(handleFollowOverlay354[^;]*;/,'')+
 ';return handleFollowOverlay354;')(
 async()=>({revision:12,following:true,duplicate:false}),
 async(_,uid)=>({
  sync:{exact:true,pending:{}},
  bundle:{body:{data:{profile:{
   uid,followerCount:uid==='target'?3:8,
   followingCount:uid==='actor'?5:1,
  }}}}
 }),
 async()=>{throw Error('not needed');},async()=>{},(data)=>data
);
const result=await fn({json:async()=>({})}, {},{},'actor','target',true,{});
assert.equal(result.data.followProtocol,354);
assert.equal(result.data.canonicalCounts662,true);
assert.equal(result.data.followerCount,3);
assert.equal(result.data.actorFollowingCount,5);
const invalid=new Function('orchestrateFollowOverlay354','readFollowProfile354',
 'repairFollowProfile354','invalidateFollowProfiles355','json',
 revised.replace(/__name\(handleFollowOverlay354[^;]*;/,'')+
 ';return handleFollowOverlay354;')(
 async()=>({revision:12,following:true,duplicate:false}),
 async(_,uid)=>({sync:{exact:true,pending:{}},
 bundle:{body:{data:{profile:{uid,followerCount:3,followingCount:uid==='actor'?undefined:1}}}}}),
 async()=>{},async()=>{},(data)=>data
);
const malformed=await invalid({json:async()=>({})},{},{},'actor','target',true,{});
assert.equal(malformed.data.canonicalCounts662,false);
assert.equal(malformed.data.actorFollowingCount,null);
console.log('APP662_SETTLED_OVERLAY_ACK_EXACT_ACTOR_FOLLOWING_NO_D1_QUERY=PASS');
console.log('APP662_LEGACY_COMPATIBILITY_UNTOUCHED_AND_FAIL_CLOSED=PASS');

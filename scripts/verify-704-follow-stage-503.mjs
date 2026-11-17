import assert from 'node:assert/strict';
import {patchFollow503Stage704} from './lib/follow-503-stage-704.mjs';
const code='x'.repeat(100001)+`
function handleFollowOverlay354(request, env, cors, actor, target, following, cutover) {
  const payload={followOperationId:"abc"};
  await enforceFollowEdgeRateLimit355(env, actor, target, following, payload.followOperationId);
  const result2 = await orchestrateFollowOverlay354(
    env,
    actor,
    target,
    following,
    payload?.followOperationId,
    expected,
    cutover,
    request
  );
  const state = await readFollowProfile354(env, target, cutover);
  return json({ok:true},200,cors);
}
__name(handleFollowOverlay354, "handleFollowOverlay354");
function unrelatedFunction() { return "UNCHANGED"; }
`;
const out=patchFollow503Stage704(code);
assert.ok(out.includes('FOLLOW_503_NATIVE_LIMITER'));
assert.ok(out.includes('FOLLOW_503_ORCHESTRATION'));
assert.ok(out.includes('Number(error?.status || error?.statusCode) === 503'));
assert.ok(out.includes('throw error;'));
assert.ok(out.includes('function unrelatedFunction() { return "UNCHANGED"; }'));
assert.equal((out.match(/return json\(\{ok:false/g)||[]).length,2);
assert.throws(()=>patchFollow503Stage704(out),/APP704_HOLD/);
assert.throws(()=>patchFollow503Stage704(''),/APP704_HOLD/);
const bad=code.replace('await enforceFollowEdgeRateLimit355(', 'await unknownRateLimit(');
assert.throws(()=>patchFollow503Stage704(bad),/APP704_HOLD_NATIVE_LIMITER_CALL/);
console.log('APP704_FOLLOW_503_STAGE_ONLY_ERROR_PATH_AND_HOLD=PASS');

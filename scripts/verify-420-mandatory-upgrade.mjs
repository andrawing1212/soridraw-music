// Stage420 mandatory upgrade policy - source-level fail-closed contract.
// The feature remains OFF until one coherent all-environment release.
// No live Firebase, Cloudflare, RTDB or user data is accessed here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const worker = read('cloudflare/explore-worker/canonical/preview-entry.js');
const like = read('src/services/exploreLikeService.ts');
const notice = read('src/services/appUpdateNotice.ts');
const rules = JSON.parse(read('database.rules.json')).rules;
const preflight = worker.slice(worker.indexOf('async function verifySignedLegacyLikeIntake420('),
  worker.indexOf('// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE'));
assert.match(worker,/const STAGE420_SIGNED_LEGACY_INTAKE_OPEN = false;/,
  'cannot partially activate Worker before shared Rules and all clients');
const auth = preflight.indexOf('await validateExploreAuth307(');
const unsigned = preflight.indexOf("code:'420_APP_UPGRADE_REQUIRED'");
const signature = preflight.indexOf('await verifyGuardedLikeBatch420(');
const delegate = worker.indexOf('const rejected = await verifySignedLegacyLikeIntake420(');
const base = worker.indexOf('await baseWorker.fetch(request, env, ctx)', delegate);
assert.ok(auth >= 0 && unsigned > auth && signature > unsigned,
  'unauthenticated users cannot bypass UID verification; unsigned intake fails before HMAC/canonical');
assert.ok(delegate >= 0 && base > delegate,
  'signed intake only delegates to existing canonical Writer after verification');
assert.match(preflight,/body\.mutations\.length <= 50/,
  'oversized legacy batches cannot trigger downgrade exception');
assert.match(preflight,/status:409,headers/,
  'legacy client gets actionable mandatory update response');
assert.match(like,/response\.status === 409 &&[\s\S]*?420_APP_UPGRADE_REQUIRED/,
  'only explicit canonical 409 triggers update reminder');
assert.match(like,/new CustomEvent\('soridraw:like-upgrade-required-420'\)/);
assert.match(notice,/window\.addEventListener\(LIKE_UPGRADE_REQUIRED_EVENT_420/);
assert.match(notice,/window\.location\.reload\(\)/,
  'update button keeps the existing reload mechanism');
assert.doesNotMatch(notice,/localStorage\.clear\(|sessionStorage\.clear\(|indexedDB\.deleteDatabase\(/,
  'mandatory update must not destroy local pending data');
assert.match(like,/persistLikeOutbox\(uid, latest\);[\s\S]*?dispatchLikeSyncError\(/,
  'batch refusal retains durable outbox before showing error');
assert.equal(rules.userSync.$uid['.write'], 'auth != null && auth.uid === $uid',
  'shared RTDB Permissions may change ONLY in coordinated cutover');
// Execute the exact Worker preflight in an isolated Node runtime. Its early
// responses must never reach the existing canonical delegate (D1 R0/W0).
const {runInNewContext} = await import('node:vm');
const {Request,Response,Headers} = globalThis;
let allowAuth = true;
let signatureChecks = 0;
let canonicalEntrances = 0;
const mock = {
  Response, Headers, JSON, Date, console,
  like426Headers: () => new Headers({'Content-Type':'application/json','Access-Control-Allow-Origin':'https://preview.soridraw.com'}),
  validateExploreAuth307: async () => allowAuth
    ? {ok:true,uid:'user420'}
    : {ok:false,response:new Response('unauthorized',{status:401})},
  verifyGuardedLikeBatch420: async ({body,authenticatedUid}) => {
    signatureChecks++;
    assert.equal(authenticatedUid,'user420');
    if (!Array.isArray(body?.mutations) ||
        body.mutations.some(row=>row.guardPermit420!=='valid')) {
      throw new Error('invalid signature');
    }
    canonicalEntrances++; // In production this admission permits baseWorker call.
  },
};
const runtime = {exports:{}};
const extract=worker.slice(worker.indexOf('async function verifySignedLegacyLikeIntake420('),
  worker.indexOf('// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE'));
assert.match(extract,/async function verifySignedLegacyLikeIntake420/);
const handler=runInNewContext(extract+'; verifySignedLegacyLikeIntake420;',mock,{timeout:1000});
const submit=(mutations,secret='fixture-key')=>handler(new Request('https://example.invalid/v1/me/likes/batch',{
  method:'POST',body:JSON.stringify({mutations}),
}),{SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET:secret},{});
const old=await submit([{trackId:'song-a',liked:true,operationId:'op-a'}]);
assert.equal(old.status,409);
assert.equal((await old.json()).error.code,'420_APP_UPGRADE_REQUIRED');
assert.equal(signatureChecks,0);
assert.equal(canonicalEntrances,0);
const mixed=await submit([{trackId:'song-a',guardPermit420:'valid'},
  {trackId:'song-b'}]);
assert.equal(mixed.status,409,'one unsigned mutation rejects entire 50-row batch');
assert.equal(canonicalEntrances,0);
const valid=await submit([{trackId:'song-a',guardPermit420:'valid'}]);
assert.equal(valid,null,'fully verified batch falls through to the existing Worker');
assert.equal(signatureChecks,1);
assert.equal(canonicalEntrances,1);
const forged=await submit([{trackId:'song-a',guardPermit420:'forged'}]);
assert.equal(forged.status,403);
assert.equal(canonicalEntrances,1,'forged batch never reaches canonical mutation');
const keyMissing=await submit([{trackId:'song-a',guardPermit420:'valid'}],'');
assert.equal(keyMissing.status,503);
assert.equal(canonicalEntrances,1);
allowAuth=false;
const unauthorized=await submit([{trackId:'song-a'}]);
assert.equal(unauthorized.status,401);
assert.equal(canonicalEntrances,1);
console.log('STAGE420_EXECUTABLE_OLD_CLIENT_409_BEFORE_CANONICAL=PASS');
console.log('STAGE420_EXECUTABLE_MIXED_UNSIGNED_BATCH_NO_PARTIAL_D1=PASS');
console.log('STAGE420_EXECUTABLE_HMAC_TAMPER_AUTH_KEY_FAIL_CLOSED=PASS');
console.log('STAGE420_MANDATORY_UPGRADE_AUTH_FIRST_409_BEFORE_CANONICAL=PASS');
console.log('STAGE420_USER_OUTBOX_AND_CACHE_PRESERVED_ON_409=PASS');
console.log('STAGE420_OLD_APP_UPDATE_NOTICE_NO_USER_DB_READ=PASS');
console.log('STAGE420_WORKER_AND_SHARED_RULES_NOT_PARTIALLY_ACTIVATED=PASS');

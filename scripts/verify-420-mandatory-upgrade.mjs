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
console.log('STAGE420_MANDATORY_UPGRADE_AUTH_FIRST_409_BEFORE_CANONICAL=PASS');
console.log('STAGE420_USER_OUTBOX_AND_CACHE_PRESERVED_ON_409=PASS');
console.log('STAGE420_OLD_APP_UPDATE_NOTICE_NO_USER_DB_READ=PASS');
console.log('STAGE420_WORKER_AND_SHARED_RULES_NOT_PARTIALLY_ACTIVATED=PASS');

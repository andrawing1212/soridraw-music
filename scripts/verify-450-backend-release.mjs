import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareRelease, verifyPostRules, liveRulesReader, RULES_URL, PROJECT, TARGET, verifyPinnedInputs, checkMode } from './prepare-450-backend-release.mjs';

const [guestArg, functionArg] = process.argv.slice(2);
assert.ok(guestArg && functionArg, 'Usage: node scripts/verify-450-backend-release.mjs GUEST_PR380_ROOT FUNCTION_PR381_ROOT');
const guestRoot = resolve(guestArg), functionRoot = resolve(functionArg);
verifyPinnedInputs(guestRoot, functionRoot);
const full = JSON.parse(readFileSync(join(guestRoot, 'database.rules.json'), 'utf8'));
const base = structuredClone(full); delete base.rules.publicSync.splitFrameModes;
const capture = (rules, etag = null) => ({ endpoint: RULES_URL, status: 200, etag, rules });
const out = mkdtempSync(join(tmpdir(), 'app450-release-test-'));
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
async function prepare(first, second) {
  let reads = 0;
  const result = await prepareRelease({ guestRoot, functionRoot, outputRoot: out, readRules: async () => [first, second][reads++] });
  assert.equal(reads, 2);
  return result;
}
try {
  for (const etag of [null, '"looks-like-a-valid-etag"']) {
    const { dir, plan } = await prepare(capture(base, etag), capture(base, etag));
    assert.equal(plan.status, 'BLOCKED');
    assert.equal(plan.functionDeployEnabled, false);
    assert.equal(plan.rulesMutationEnabled, false);
    assert.equal(plan.executable, false);
    assert.equal(plan.reason, '450_SETTINGS_RULES_ATOMIC_UPDATE_UNPROVEN');
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'candidate-rules.json'))), full);
    assert.deepEqual(plan.functionPreparation.proposedDeployArgv, ['firebase', 'deploy', '--project', PROJECT,
      '--config', 'preview.app450.single-function.firebase.json', '--only', `functions:${TARGET}`, '--non-interactive']);
  }
  pass('two equal reads, with or without ETag, never authorize Rules or Function deployment');
  const changed = structuredClone(base); changed.rules.publicSync.navigationVisibility['.read'] = true;
  await assert.rejects(prepare(capture(base), capture(changed)), /450_RULES_DRIFT_STOP/);
  await assert.rejects(prepare(capture(base, 'a'), capture(base, 'b')), /450_ETAG_DRIFT_STOP/);
  pass('concurrent content or ETag change aborts before downstream steps');
  await assert.rejects(prepare(capture(changed), capture(changed)), /450_GUARD_FAILED/);
  const bad = structuredClone(full); bad.rules.publicSync.splitFrameModes['.read'] = true;
  await assert.rejects(prepare(capture(bad), capture(bad)), /450_GUARD_FAILED/);
  pass('unrelated baseline ACL drift and widened existing node rejected');
  const existing = await prepare(capture(full), capture(full));
  assert.equal(existing.plan.status, 'BLOCKED');
  pass('already-exact Rules is not an approval bypass');
  await assert.rejects(prepare({ ...capture(base), endpoint: 'https://test.invalid/.settings/rules.json' }, capture(base)), /450_WRONG_RULES_ENDPOINT/);
  await assert.rejects(prepare({ ...capture(base), status: 403 }, capture(base)), /450_RULES_GET_NOT_OK/);
  let calls = 0;
  await assert.rejects(prepareRelease({ guestRoot, functionRoot, outputRoot: out,
    readRules: async () => { if (++calls === 2) throw Error('network lost'); return capture(base); } }), /network lost/);
  pass('wrong target, failed GET and lost second response fail closed');
  assert.deepEqual(verifyPostRules(guestRoot, full, structuredClone(full)), { fullRulesEqual: true, functionDeployEnabled: false });
  const concurrentPost = structuredClone(full); concurrentPost.rules.publicSync.navigationVisibility['.read'] = true;
  assert.throws(() => verifyPostRules(guestRoot, full, concurrentPost), /450_GUARD_FAILED/);
  pass('post-write comparison covers entire tree; evidence never authorizes later deploy');
  let requests = 0;
  const reader = liveRulesReader('test-token', async (url, options) => {
    requests++; assert.equal(url, RULES_URL); assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['X-Firebase-ETag'], 'true'); assert.ok(options.signal);
    assert.equal(options.body, undefined);
    return new Response(JSON.stringify(base), { status: 200 });
  });
  assert.deepEqual(await reader(), capture(base)); assert.equal(requests, 1);
  await assert.rejects(liveRulesReader('test-token', async () => new Response('', { status: 403 }))(), /450_RULES_GET_NOT_OK/);
  pass('live adapter is fixed-target bounded GET-only, with no retry or redirects');
  assert.throws(() => checkMode('--deploy'), /450_UNKNOWN_MODE_NO_DEPLOY_AVAILABLE/);
  pass('no executable deploy mode');
  console.log(`450_BACKEND_PREPARATION_TESTS=PASS groups=${checks}; LIVE_RELEASE=BLOCKED`);
} finally { rmSync(out, { recursive: true, force: true }); }

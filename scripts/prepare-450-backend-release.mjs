import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Preparation only. There is deliberately NO Rules PUT, Firebase deploy,
// rollback, approval flag, or injected writer in this program. An ETag header
// or two equal GETs is not proof that Settings Rules implements CAS.
export const RULES_URL = 'https://soridraw-app-866a5-default-rtdb.firebaseio.com/.settings/rules.json';
export const PROJECT = 'soridraw-app-866a5';
export const TARGET = 'masterSetSplitFrameMode';
export const checkMode = (mode) => assert.ok(mode === '--offline' || mode === '--inspect-live', '450_UNKNOWN_MODE_NO_DEPLOY_AVAILABLE');
export const PINS = Object.freeze({
  guest: {
    'scripts/build-416-private-server-rules.mjs': 'bfdbad0a512804910c3a581744ab512288304fcc',
    'database.rules.json': '67ff753bb118d3a2ad5763b1f521b66c5d302466',
    'scripts/verify-418-rtdb-rules-delta.mjs': 'd5d9b931528bcf7a09913dcf0a099994fbd21065',
    'scripts/verify-450-shared-rtdb-additive.mjs': 'f967c967c0a767098550009d27b2119d4c57cc41',
    'scripts/verify-450-rtdb-release-prepost.mjs': 'fa6caa39697edc078d7af58ebea2b0d6faa682ef',
  },
  functions: {
    'functions/package-lock.json': 'c6e9e9089483ccfde31d33739c9228b50d3f8cce',
    'functions/tsconfig.json': '7ce05d039d680e58fcf3c03a64992831537b8bda',
    'functions/src/masterSplitFrameMode450.ts': '9081be5aecd8b8f91b6414137836a627b7105d90',
    'scripts/build-450-single-function-package.mjs': '12f3c7cad1a006d0ba0140265cab2cb6be9a6c7b',
  },
});
const digest = (value) => createHash('sha256').update(value).digest('hex');
export const gitBlob = (data) => createHash('sha1').update(`blob ${Buffer.byteLength(data)}\0`).update(data).digest('hex');
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const canonical = (v) => JSON.stringify(stable(v));

export function verifyPinnedInputs(guestRoot, functionRoot) {
  for (const [kind, root] of [['guest', guestRoot], ['functions', functionRoot]]) {
    for (const [file, sha] of Object.entries(PINS[kind])) {
      assert.equal(gitBlob(readFileSync(join(root, file))), sha, `450_PR_INPUT_CHANGED: ${file}`);
    }
  }
}
function runGuard(root, script, args) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, `450_GUARD_FAILED ${script}: ${result.stderr || result.error || result.stdout}`);
}
function checkedCapture(capture) {
  assert.equal(capture.endpoint, RULES_URL, '450_WRONG_RULES_ENDPOINT');
  assert.equal(capture.status, 200, '450_RULES_GET_NOT_OK');
  assert.ok(capture.rules?.rules?.publicSync, '450_FULL_RULES_BODY_REQUIRED');
  return capture.rules;
}

// Each invocation owns a new private directory: failed/retried runs cannot
// accidentally reuse an earlier candidate or a success marker.
export async function prepareRelease({ guestRoot, functionRoot, readRules, outputRoot }) {
  guestRoot = resolve(guestRoot); functionRoot = resolve(functionRoot);
  verifyPinnedInputs(guestRoot, functionRoot);
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  const dir = mkdtempSync(join(resolve(outputRoot), 'app450-'));
  const save = (name, value) => {
    const file = join(dir, name);
    writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    return file;
  };
  try {
    const firstCapture = await readRules();
    const first = save('first-rules.json', checkedCapture(firstCapture));
    const candidate = join(dir, 'candidate-rules.json');
    runGuard(guestRoot, 'verify-450-shared-rtdb-additive.mjs',
      ['--candidate', first, candidate, join(dir, 'candidate-mode.txt')]);
    // This is the pre-application re-read position. No write follows until a
    // future independently audited endpoint-specific atomic protocol exists.
    const secondCapture = await readRules();
    const second = save('second-rules.json', checkedCapture(secondCapture));
    assert.equal(canonical(firstCapture.rules), canonical(secondCapture.rules), '450_RULES_DRIFT_STOP');
    assert.equal(firstCapture.etag ?? null, secondCapture.etag ?? null, '450_ETAG_DRIFT_STOP');
    runGuard(guestRoot, 'verify-450-rtdb-release-prepost.mjs', ['--verify-preput', first, second, candidate]);
    const plan = {
      status: 'BLOCKED', reason: '450_SETTINGS_RULES_ATOMIC_UPDATE_UNPROVEN',
      executable: false, rulesMutationEnabled: false, functionDeployEnabled: false,
      endpoint: RULES_URL, project: PROJECT, environment: 'preview',
      sourcePins: PINS, firstHash: digest(canonical(firstCapture.rules)),
      candidateHash: digest(canonical(JSON.parse(readFileSync(candidate, 'utf8')))),
      etagObserved: secondCapture.etag ?? null,
      functionPreparation: {
        cwd: functionRoot,
        steps: ['npm --prefix functions ci --ignore-scripts', 'npm --prefix functions run build',
          'node scripts/build-450-single-function-package.mjs'],
        // Reviewable argv only. Never passed to spawn/exec by this program.
        proposedDeployArgv: ['firebase', 'deploy', '--project', PROJECT,
          '--config', 'preview.app450.single-function.firebase.json',
          '--only', `functions:${TARGET}`, '--non-interactive'],
        requiredBeforeExecution: ['independent exact-SHA audit and explicit release approval',
          'proven Settings endpoint atomic update or enforceable exclusive writer',
          'same-run post-write full Rules equality; uncertain result stops all steps',
          'fresh isolated artifact: only masterSetSplitFrameMode, Node22, pinned dependencies, no env/secrets/unrelated files',
          'capture target revision/artifact plus full Functions inventory before and after',
          'unrelated inventory unchanged; no automatic full Rules rollback or function deletion'],
      },
    };
    save('BLOCKED-plan.json', plan);
    return { dir, plan };
  } catch (error) {
    save('STOP.json', { status: 'BLOCKED', reason: String(error.message), functionDeployEnabled: false });
    throw error;
  }
}

// Read-only adapter with fixed target, no redirects, bounded timeout, no retry,
// and bearer token kept out of URLs, reports and command-line arguments.
export function liveRulesReader(token, fetchImpl = fetch) {
  assert.ok(typeof token === 'string' && token.length > 0, '450_ACCESS_TOKEN_REQUIRED');
  return async () => {
    const response = await fetchImpl(RULES_URL, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'X-Firebase-ETag': 'true', 'Cache-Control': 'no-cache' },
    });
    assert.equal(response.status, 200, '450_RULES_GET_NOT_OK');
    return { endpoint: RULES_URL, status: response.status, etag: response.headers.get('etag'), rules: await response.json() };
  };
}

export function verifyPostRules(guestRoot, candidate, actual) {
  for (const [file, sha] of Object.entries(PINS.guest))
    assert.equal(gitBlob(readFileSync(join(guestRoot, file))), sha, '450_PR_INPUT_CHANGED');
  const dir = mkdtempSync(join(tmpdir(), 'app450-post-'));
  try {
    const expectedFile = join(dir, 'expected.json'), actualFile = join(dir, 'actual.json');
    writeFileSync(expectedFile, JSON.stringify(candidate));
    writeFileSync(actualFile, JSON.stringify(actual));
    runGuard(resolve(guestRoot), 'verify-450-rtdb-release-prepost.mjs', ['--verify-postput', expectedFile, actualFile]);
    // Equality is evidence only, never a reusable permission to deploy.
    return { fullRulesEqual: true, functionDeployEnabled: false };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, guestRoot, functionRoot, outputRoot, firstFile, secondFile] = process.argv.slice(2);
  try {
    assert.ok(guestRoot && functionRoot && outputRoot, 'Usage: --offline GUEST_ROOT FUNCTION_ROOT OUT FIRST SECOND | --inspect-live GUEST_ROOT FUNCTION_ROOT OUT');
    checkMode(mode);
    const captures = mode === '--offline' ? [firstFile, secondFile].map(f => JSON.parse(readFileSync(f, 'utf8'))) : null;
    const readRules = captures ? async () => { assert.ok(captures.length); return captures.shift(); }
      : liveRulesReader(process.env.APP450_RULES_ACCESS_TOKEN);
    const { dir, plan } = await prepareRelease({ guestRoot, functionRoot, outputRoot, readRules });
    console.log(JSON.stringify({ directory: dir, status: plan.status, reason: plan.reason }));
    process.exitCode = 2; // A successful preparation is still NOT a release PASS.
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

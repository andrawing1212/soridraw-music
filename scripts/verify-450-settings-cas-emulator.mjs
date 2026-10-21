import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitBlob } from './prepare-450-backend-release.mjs';

// Writes ONLY disposable demo emulator Rules. Never probes production CAS by
// attempting a stale write: a server ignoring If-Match would overwrite ACLs.
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-soridraw-app450');
assert.ok(process.argv[2], 'PR380 fixture root required');
const root = resolve(process.argv[2]);
const ruleText = readFileSync(join(root, 'database.rules.json'));
assert.equal(gitBlob(ruleText), '67ff753bb118d3a2ad5763b1f521b66c5d302466');
const guestTest = readFileSync(join(root, 'scripts/verify-450-guest-emulator.mjs'));
assert.equal(gitBlob(guestTest), '1e8a3c846c36e4480b0f08954732e691472c0c41');
const url = 'http://127.0.0.1:9000/.settings/rules.json?ns=demo-soridraw-app450';
const request = (method, body, extra = {}) => fetch(url, {
  method, redirect: 'error', signal: AbortSignal.timeout(10_000),
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const full = JSON.parse(ruleText);
assert.equal((await request('PUT', full)).status, 200);
try {
  const first = await request('GET', undefined, { 'X-Firebase-ETag': 'true' });
  assert.equal(first.status, 200); assert.deepEqual(await first.json(), full);
  const otherWriter = structuredClone(full);
  otherWriter.rules.app450CasProbe = { '.read': false, '.write': false };
  assert.equal((await request('PUT', otherWriter)).status, 200);
  const stale = await request('PUT', full, { 'If-Match': first.headers.get('etag') || '"deliberately-stale"' });
  const afterResponse = await request('GET'); assert.equal(afterResponse.status, 200);
  const after = await afterResponse.json();
  const preserved = Object.hasOwn(after.rules, 'app450CasProbe');
  console.log(JSON.stringify({ emulatorOnly: true, etag: first.headers.get('etag'),
    staleIfMatchStatus: stale.status, concurrentRuleSurvived: preserved,
    liveAtomicUpdateProven: false }));
  // Even 412 in the emulator would not prove live Settings endpoint support.
} finally {
  assert.equal((await request('PUT', full)).status, 200, 'DEMO_RULES_RESTORE_FAILED');
}
const guest = spawnSync(process.execPath, ['scripts/verify-450-guest-emulator.mjs'], {
  cwd: root, env: process.env, encoding: 'utf8', timeout: 30_000,
});
assert.equal(guest.status, 0, guest.stderr || guest.stdout);
console.log(guest.stdout.trim());
console.log('450_SETTINGS_ENDPOINT_LIVE_CAS_UNPROVEN=BLOCKED');
process.exitCode = 2;

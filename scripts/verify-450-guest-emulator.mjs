import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Firebase RTDB EMULATOR ONLY. No real project/host is accepted.
// The exact guest-readable leaf is public; parent, navigation and all user
// data remain denied. Admin "owner" token is used ONLY to seed emulator data.
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || '';
assert.ok(host && /^(127\.0\.0\.1|localhost):\d+$/.test(host),
  '450_EMULATOR_HOST_REQUIRED_NO_REAL_DATABASE');
assert.equal(project,'demo-soridraw-app450','450_DEMO_PROJECT_ONLY');
// Emulator versions may load the CLI rules into either the project or
// the named default namespace. Never trust an automatically opened database.
// Verify the exact full Rules tree before testing access or seeding data.
const projectRules = JSON.parse(readFileSync('database.rules.json','utf8'));
let ns = '';
for (const candidate of [
  'demo-soridraw-app450-default-rtdb',
  'demo-soridraw-app450',
]) {
  const response = await fetch(
    `http://${host}/.settings/rules.json?ns=${candidate}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  if (!response.ok) continue;
  const liveRules = await response.json();
  try {
    assert.deepStrictEqual(liveRules,projectRules);
    ns = candidate;
    break;
  } catch {
    // A different/auto-open rules tree is NOT an eligible test instance.
  }
}
assert.ok(ns,'450_EMULATOR_EXACT_RULES_NOT_LOADED_STOP');
const url = (path) => `http://${host}/${path}.json?ns=${ns}`;
const request = async (path, method = 'GET', body = undefined, admin = false) => {
  const response = await fetch(url(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(admin ? { Authorization: 'Bearer owner' } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.text() };
};
const allowed = async (path, value) => {
  const res = await request(path);
  assert.equal(res.status,200,`450_EMULATOR_GUEST_READ_DENIED ${path} ${res.status}`);
  assert.equal(JSON.parse(res.body),value,`450_EMULATOR_WRONG_SCALAR ${path}`);
};
const denied = async (path, method = 'GET', body = undefined) => {
  const res = await request(path,method,body);
  assert.ok([401,403].includes(res.status),
    `450_EMULATOR_UNAUTHORIZED_ACCESS_LEAK ${method} ${path} HTTP ${res.status}`);
};
for (const [env,mode] of [
  ['preview','pure-pane'],['test','local-responsive'],['production','pure-pane-hybrid'],
]) {
  const seed = await request('publicSync/splitFrameModes/'+env,'PUT',mode,true);
  assert.equal(seed.status,200,`450_EMULATOR_ADMIN_SEED_FAILED ${env}: ${seed.body}`);
  await allowed('publicSync/splitFrameModes/'+env,mode);
  await denied('publicSync/splitFrameModes/'+env,'PUT','pure-pane-hybrid');
  await denied('publicSync/splitFrameModes/'+env,'DELETE');
}
for (const path of [
  'publicSync',
  'publicSync/splitFrameModes',
  'publicSync/splitFrameModes/future-environment',
  'publicSync/navigationVisibility',
  'publicSync/exploreLike',
  'userSync',
  'privateLikeBatch416',
  'privateLikeFinal416',
]) await denied(path);
await denied('publicSync/splitFrameModes/unknown-child','PUT','pure-pane');
console.log('450_EMULATOR_GUEST_3_SCALAR_READS=PASS');
console.log('450_EMULATOR_PRIVATE_PARENT_MENU_USER_SYNC_DENIED=PASS');
console.log('450_EMULATOR_GUEST_CLIENT_WRITE_DELETE_DENIED=PASS');
console.log('450_EMULATOR_NO_REAL_DATABASE_CONNECTION=PASS');

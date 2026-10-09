import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Stage418: read-only PREVIEW release safety gate. RTDB Rules are shared across
// environments. Never replace live rules when unrelated permissions differ.
const local = JSON.parse(readFileSync('database.rules.json','utf8'));
const optional = local?.rules?.userSync?.$uid?.exploreLike?.results?.$index?.canonicalSettled417;
assert.equal(optional?.['.validate'], 'newData.isBoolean()');
assert.equal(local.rules.userSync.$uid['.read'], 'auth != null && auth.uid === $uid');
assert.equal(local.rules.userSync.$uid['.write'], 'auth != null && auth.uid === $uid');

const before418 = structuredClone(local);
delete before418.rules.userSync.$uid.exploreLike.results.$index.canonicalSettled417;
const stable = x => JSON.stringify(sortObject(x));
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sortObject(value[key])]),
  );
  return value;
}
const compare = remote =>
  stable(remote) === stable(local) ? 'already-live'
    : stable(remote) === stable(before418) ? 'additive-bool-only' : null;

if (process.argv.includes('--self-test')) {
  assert.equal(compare(before418), 'additive-bool-only');
  assert.equal(compare(local), 'already-live');
  const malicious = structuredClone(before418);
  malicious.rules.userSync.$uid['.read'] = 'auth != null';
  assert.equal(compare(malicious), null);
  const altered = structuredClone(before418);
  altered.rules.userSync.$uid.exploreLike['.validate'] = 'newData.exists()';
  assert.equal(compare(altered), null);
  console.log('418_SHARED_RTDB_ADDITIVE_BOOL_ONLY_SELF_TEST=PASS');
} else {
  const path = process.argv[2];
  if (!path) throw new Error('Live read-only RTDB rules JSON path required');
  const remote = JSON.parse(readFileSync(path,'utf8'));
  const status = compare(remote);
  if (!status) {
    throw new Error('Shared RTDB Rules live/source divergence: STOP before any PUT or PREVIEW Hosting deploy');
  }
  console.log('418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS '+status);
}

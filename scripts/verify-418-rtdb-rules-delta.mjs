import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A live read-only gate for the ONE previously approved receipt bool and
// Stage416's ONE additional private-only child. This preserves exact-match
// validation of every other shared RTDB permission, including old clients.
const local = JSON.parse(readFileSync('database.rules.json','utf8'));
const user = local?.rules?.userSync?.$uid;
const accepted = user?.exploreLike?.results?.$index?.canonicalSettled417;
const intent = user?.exploreLikeIntent416;
assert.equal(accepted?.['.validate'], 'newData.isBoolean()');
assert.equal(user['.read'], 'auth != null && auth.uid === $uid');
assert.equal(user['.write'], 'auth != null && auth.uid === $uid');
assert.ok(intent, 'Stage416 private-only node missing');
assert.match(String(intent['.validate'] || ''), /newData\.hasChildren\(\['version','results'\]\)/);
assert.equal(intent.results?.$index?.liked?.['.validate'], 'newData.isBoolean()');
assert.equal(intent.results?.$index?.status?.['.validate'],
  "newData.isString() && (newData.val() === 'pending' || newData.val() === 'accepted' || newData.val() === 'rejected')");
assert.equal(intent['$other']?.['.validate'], false);
assert.equal(intent.results?.$index?.['$other']?.['.validate'], false);

const stable = x => JSON.stringify(sortObject(x));
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sortObject(value[key])]),
  );
  return value;
}
const before416 = structuredClone(local);
delete before416.rules.userSync.$uid.exploreLikeIntent416;
const before418 = structuredClone(before416);
delete before418.rules.userSync.$uid.exploreLike.results.$index.canonicalSettled417;
const beforeBoolOnly = structuredClone(local);
delete beforeBoolOnly.rules.userSync.$uid.exploreLike.results.$index.canonicalSettled417;
const compare = remote =>
  stable(remote) === stable(local) ? 'already-live'
    : stable(remote) === stable(before416) ? 'additive-private-intent-only'
    : stable(remote) === stable(before418) ? 'additive-private-intent-and-bool'
    : stable(remote) === stable(beforeBoolOnly) ? 'additive-bool-only' : null;

if (process.argv.includes('--self-test')) {
  assert.equal(compare(before418), 'additive-private-intent-and-bool');
  assert.equal(compare(before416), 'additive-private-intent-only');
  assert.equal(compare(beforeBoolOnly), 'additive-bool-only');
  assert.equal(compare(local), 'already-live');
  for (const baseline of [before418, before416, beforeBoolOnly]) {
    const malicious = structuredClone(baseline);
    malicious.rules.userSync.$uid['.read'] = 'auth != null';
    assert.equal(compare(malicious), null, 'weakened private permissions must fail');
    const altered = structuredClone(baseline);
    altered.rules.userSync.$uid.exploreLike['.validate'] = 'newData.exists()';
    assert.equal(compare(altered), null, 'legacy accepted schema change must fail');
  }
  const mutated = structuredClone(local);
  mutated.rules.userSync.$uid.exploreLikeIntent416.results.$index.liked['.validate'] = 'newData.isString()';
  assert.equal(compare(mutated), null, 'private intent validation change must fail');
  console.log('418_SHARED_RTDB_ADDITIVE_BOOL_ONLY_SELF_TEST=PASS');
  console.log('416_PRIVATE_RTDB_ONE_NODE_ADDITIVE_ONLY_SELF_TEST=PASS');
} else {
  const path = process.argv[2];
  if (!path) throw new Error('Live read-only RTDB rules JSON path required');
  const remote = JSON.parse(readFileSync(path,'utf8'));
  const status = compare(remote);
  if (!status) throw new Error(
    'Shared RTDB live/source divergence outside allowed 417 boolean and 416 private-only node: STOP before any PUT or PREVIEW Hosting deploy'
  );
  console.log('418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS '+status);
  console.log('416_PRIVATE_RTDB_ADDITIVE_PREFLIGHT=PASS');
}

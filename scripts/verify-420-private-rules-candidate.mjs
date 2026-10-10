import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStage420PrivateRulesCandidate } from './build-420-private-rules-candidate.mjs';

const source = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const next = buildStage420PrivateRulesCandidate(source);
const oldUid = source.rules.userSync.$uid, uid = next.rules.userSync.$uid;
const userPolicy = 'auth != null && auth.uid === $uid';
assert.equal(uid['.write'], undefined, 'old parent grant must be REVOKED');
assert.equal(uid['.read'], oldUid['.read'], 'private account reader unchanged');
assert.equal(uid.exploreLikeIntent416['.write'], false,
  'legacy direct publisher must not be able to bypass server rate policy');
for (const child of [
  'musicNote', 'recentSongs', 'libraryPlaylist',
  'exploreLike', 'exploreFollow', 'explorePublication',
]) {
  const left = { ...oldUid[child] };
  const right = { ...uid[child] };
  assert.equal(right['.write'], userPolicy);
  delete right['.write'];
  assert.deepEqual(right, left, 'existing legacy child validation unchanged: ' + child);
}
assert.deepEqual(uid['$other'], oldUid['$other'],
  'account-private unknown child rejection unchanged');
assert.deepEqual(next.rules.privateLikeSync420, {
  '$uid': {
    '.read': userPolicy,
    '.write': false,
    '$other': { '.validate': false },
  },
});
for (const name of Object.keys(source.rules)) {
  if (name === 'userSync') continue;
  assert.deepEqual(next.rules[name], source.rules[name], 'protected tree changed: ' + name);
}
const mutated = JSON.parse(JSON.stringify(source));
mutated.rules.userSync.$uid.musicNote['.write'] = 'auth != null';
assert.throws(() => buildStage420PrivateRulesCandidate(mutated), /unexpected/);
const missing = JSON.parse(JSON.stringify(source));
delete missing.rules.userSync.$uid.exploreLike;
assert.throws(() => buildStage420PrivateRulesCandidate(missing), /missing/);
// Security Rules do not cascade write DENIAL, only GRANTS. The original
// shared ancestor grants old-path writes; the candidate removes this grant.
// This is only a static proof: emulator + old app real compatibility remain
// mandatory before *any* live/shared RTDB rules PUT.
assert.equal(oldUid['.write'], userPolicy, 'source is still unprotected');
console.log('STAGE420_RULES_CANDIDATE_PARENT_REVOKE=PASS');
console.log('STAGE420_OLD_USER_SIGNAL_WRITE_PARITY_STATIC=PASS');
console.log('STAGE420_SERVER_ONLY_PRIVATE_ROOT_NO_CLIENT_WRITE=PASS');
console.log('STAGE420_EMULATOR_AND_OLD_APP_PARITY=HOLD');

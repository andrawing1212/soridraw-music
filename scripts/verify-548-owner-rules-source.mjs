// APP548: exact additive owner-private rule in OFF candidate.
// Verifies all existing live-protection rules remain byte-identical to the
// current PREVIEW source. Does NOT deploy shared Firebase Rules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const raw=readFileSync('database.rules.json','utf8');
const root=JSON.parse(raw);
const reference=JSON.parse(readFileSync('scripts/emulator/app533.database.rules.json','utf8'));
const owner=root.rules?.ownerFollowerSync532;
assert.deepEqual(owner,reference.rules.ownerFollowerSync532,
 'OWNER_532_RULE_MUST_MATCH_ISOLATED_EMULATOR_PROVEN_RULE');
assert.equal(root.rules['.read'],false);
assert.equal(root.rules['.write'],false);
assert.equal(owner?.$uid?.['.write'],false,
 'CLIENT_CANNOT_WRITE_SERVER_CONFIRMED_FOLLOWER_COUNT');
assert.ok(String(owner?.$uid?.['.read']||'').includes('auth.uid === $uid'));
assert.ok(String(owner?.$uid?.['.read']||'').includes('auth.token.soridrawFollowEpoch532'));
const start=raw.indexOf('    "ownerFollowerSync532": {');
const end=raw.indexOf('    "presence": {',start);
assert.ok(start>0&&end>start&&raw.indexOf('    "ownerFollowerSync532": {',start+1)<0);
const prior=raw.slice(0,start)+raw.slice(end);
const gitBlob=createHash('sha1').update(
 'blob '+Buffer.byteLength(prior)+'\0').update(prior).digest('hex');
assert.equal(gitBlob,'f2b14a26e5c5a46cfc65d455f60ed81f97b9cad0',
 'EXISTING_SHARED_RULES_CHANGED');
console.log('APP548_ONLY_EXACT_OWNER_PRIVATE_ROOT_CHILD_ADDED=PASS');
console.log('APP548_OTHER_SHARED_RULES_EXACT_PREVIEW_BLOB_UNCHANGED=PASS');
console.log('APP548_OWNER_CLAIM_READ_ONLY_SERVER_WRITE_ONLY=PASS');

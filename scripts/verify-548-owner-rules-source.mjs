// APP548 owner-only RTDB rule candidate. This is source-only, NOT installed.
// Preserve the exact current shared Rules and verify the separately isolated
// root rule's owner claim + server-only write contract without deploying.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const shared=readFileSync('database.rules.json','utf8');
const sha=createHash('sha1').update('blob '+Buffer.byteLength(shared)+'\0').update(shared).digest('hex');
assert.equal(sha,'f2b14a26e5c5a46cfc65d455f60ed81f97b9cad0','SHARED_LIVE_SOURCE_RULES_MUST_BE_UNCHANGED');
const rules=JSON.parse(shared).rules;
assert.equal(Object.hasOwn(rules,'ownerFollowerSync532'),false,
 'NO_NEW_OWNER_RULE_IN_REAL_SHARED_DATABASE_RULES');
const proposal=JSON.parse(readFileSync('scripts/emulator/app533.database.rules.json','utf8')).rules;
assert.equal(proposal['.read'],false);
assert.equal(proposal['.write'],false);
const owner=proposal.ownerFollowerSync532?.$uid;
assert.ok(owner,'ISOLATED_OWNER_RULE_MISSING');
assert.equal(owner['.write'],false,'CLIENT_WRITE_MUST_BE_DENIED');
assert.match(owner['.read'],/auth\.uid === \$uid/);
assert.match(owner['.read'],/auth\.token\.soridrawFollowEpoch532/);
assert.match(owner['.read'],/!data\.exists\(\)/);
assert.match(owner['.read'],/data\.child\('authEpoch'\)\.val\(\)/);
console.log('APP548_CURRENT_SHARED_RTDB_SOURCE_EXACT_PREVIEW_ORIGINAL=PASS');
console.log('APP548_OWNER_PRIVATE_RULE_ISOLATED_NOT_DEPLOYED=PASS');

const mergedSource=JSON.parse(readFileSync('scripts/emulator/app550.additive.database.rules.json','utf8')).rules;
assert.deepEqual(Object.keys(mergedSource).sort(),
 [...Object.keys(rules),'ownerFollowerSync532'].sort(),
 'ONLY_ONE_NEW_OWNER_ROOT');
for(const [key,value] of Object.entries(rules)){
 assert.deepEqual(mergedSource[key],value,'EXISTING_SHARED_RULE_CHANGED_'+key);
}
assert.deepEqual(mergedSource.ownerFollowerSync532,proposal.ownerFollowerSync532,
 'OWNER_READ_WRITE_PROPOSAL_DRIFT');
assert.equal(mergedSource.ownerFollowerSync532.$uid['.write'],false);
console.log('APP550_OWNER_PRIVATE_RULES_EXACT_ADDITIVE_NO_OTHER_RULE_CHANGE=PASS');


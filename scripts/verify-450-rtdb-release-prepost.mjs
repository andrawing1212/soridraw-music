import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// app450: NO_NETWORK, NO_PUT pure release-gate verifier.
// Actual shared RTDB .settings/rules.json PUT replaces the full live tree.
// Pre-PUT double reads alone do NOT provide a transaction/conditional CAS.
// Deployment must remain externally disabled until an audited conditional
// safeguard or exclusive writer guarantee is independently proved.
const validation = "newData.isString() && (newData.val() === 'pure-pane' || newData.val() === 'local-responsive' || newData.val() === 'pure-pane-hybrid')";
const approved = {
  '.read': false,
  '.write': false,
  preview: { '.read': true, '.validate': validation },
  test: { '.read': true, '.validate': validation },
  production: { '.read': true, '.validate': validation },
  '$other': { '.read': false, '.validate': false },
};
const stable = (v) => Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k,stable(v[k])]))
    : v;
const equal = (a,b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const deleteNode = (o) => {
  const copy = structuredClone(o);
  delete copy.rules.publicSync.splitFrameModes;
  return copy;
};
const exactCandidate = (before, candidate) => {
  assert.ok(before?.rules?.publicSync && candidate?.rules?.publicSync,
    '450_PUBLICSYNC_MISSING_STOP');
  assert.ok(equal(candidate.rules.publicSync.splitFrameModes, approved),
    '450_SCALAR_LEAF_ACL_DRIFT_STOP');
  const old = before.rules.publicSync.splitFrameModes;
  if (old) assert.ok(equal(old, approved), '450_EXISTING_ACL_DRIFT_STOP');
  assert.ok(equal(deleteNode(before), deleteNode(candidate)),
    '450_UNRELATED_SHARED_ACL_CHANGED_STOP');
  return old ? 'ALREADY_EXACT' : 'EXACT_ONE_ADDITION';
};

if (process.argv[2] === '--self-test') {
  const base = {rules:{publicSync:{navigationVisibility:{'.read':'auth != null'}, exploreLike:{'.read':'auth != null'}}, userSync:{'.read':false}}};
  const candidate = structuredClone(base);
  candidate.rules.publicSync.splitFrameModes = structuredClone(approved);
  assert.equal(exactCandidate(base,candidate), 'EXACT_ONE_ADDITION');
  assert.equal(exactCandidate(candidate,candidate),'ALREADY_EXACT');
  const badRoot = structuredClone(candidate);
  badRoot.rules.publicSync.splitFrameModes['.read'] = true;
  assert.throws(()=>exactCandidate(base,badRoot),/450_SCALAR_LEAF_ACL_DRIFT_STOP/);
  const badGuest = structuredClone(candidate);
  badGuest.rules.publicSync.splitFrameModes.preview['.read'] = 'auth != null';
  assert.throws(()=>exactCandidate(base,badGuest),/450_SCALAR_LEAF_ACL_DRIFT_STOP/);
  const badWrite = structuredClone(candidate);
  badWrite.rules.publicSync.splitFrameModes['.write'] = true;
  assert.throws(()=>exactCandidate(base,badWrite),/450_SCALAR_LEAF_ACL_DRIFT_STOP/);
  const badPrivate = structuredClone(candidate);
  badPrivate.rules.userSync['.read'] = true;
  assert.throws(()=>exactCandidate(base,badPrivate),/450_UNRELATED_SHARED_ACL_CHANGED_STOP/);
  const changedPre = structuredClone(base);
  changedPre.rules.publicSync.navigationVisibility['.read'] = true;
  assert.ok(!equal(base,changedPre),'450_PREPUT_RACE_MUST_STOP');
  const badPost = structuredClone(candidate);
  badPost.rules.publicSync.exploreLike['.read'] = true;
  assert.ok(!equal(candidate,badPost),'450_POSTPUT_PARITY_MUST_STOP');
  console.log('450_EXACT_SCALAR_ADD_ONLY_NEGATIVE_PREPOST_SELF_TEST=PASS');
  console.log('450_NETWORK_PUT_DEPLOY=DISABLED');
} else if (process.argv[2] === '--verify-preput') {
  const [firstFile,secondFile,candidateFile] = process.argv.slice(3);
  assert.ok(firstFile && secondFile && candidateFile,'450_THREE_INPUT_FILES_REQUIRED');
  const first = read(firstFile);
  const second = read(secondFile);
  assert.ok(equal(first,second),'450_LIVE_RULES_CHANGED_BETWEEN_GETS_STOP');
  const candidate = read(candidateFile);
  exactCandidate(second,candidate);
  // The audited existing 418 source/live gate must also accept the current
  // tree, not just the exact-one diff. This has zero write side effects.
  const gate = spawnSync(process.execPath,['scripts/verify-418-rtdb-rules-delta.mjs',secondFile],{encoding:'utf8'});
  assert.equal(gate.status,0,'450_EXISTING_PROTECTED_RULES_NOT_BASELINE: '+(gate.stderr || gate.stdout));
  console.log('450_LIVE_FIRST_SECOND_GET_IDENTICAL=PASS');
  console.log('450_EXACT_ONE_NODE_WITH_EXISTING_ACL_PARITY=PASS');
  console.log('450_NOT_ATOMIC_WITHOUT_APPROVED_CONDITIONAL_PUT=BLOCKED');
} else if (process.argv[2] === '--verify-postput') {
  const [candidateFile, liveAfterFile] = process.argv.slice(3);
  assert.ok(candidateFile && liveAfterFile,'450_POSTPUT_INPUT_REQUIRED');
  const candidate = read(candidateFile);
  const actual = read(liveAfterFile);
  assert.ok(equal(candidate,actual),'450_POSTPUT_FULL_RULES_DRIFT_STOP_MANUAL_INCIDENT');
  console.log('450_POSTPUT_FULL_RULES_PARITY=PASS');
} else {
  throw Error('Use --self-test | --verify-preput FIRST_GET SECOND_GET APPROVED_CANDIDATE | --verify-postput CANDIDATE LIVE_AFTER');
}

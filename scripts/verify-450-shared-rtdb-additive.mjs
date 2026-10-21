import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Read-only app450 release candidate generator: exact ONE sibling on the
// ACTUAL live shared RTDB rules tree. Never replay an old local snapshot.
const validate = "newData.isString() && (newData.val() === 'pure-pane' || newData.val() === 'local-responsive' || newData.val() === 'pure-pane-hybrid')";
const expected = {
  '.read': false,
  '.write': false,
  preview: { '.read': true, '.validate': validate },
  test: { '.read': true, '.validate': validate },
  production: { '.read': true, '.validate': validate },
  '$other': { '.read': false, '.validate': false },
};
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]))
    : value;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const without450 = (obj) => {
  const out = structuredClone(obj);
  delete out.rules.publicSync.splitFrameModes;
  return out;
};
const classify = (live) => {
  assert.ok(live?.rules?.publicSync && typeof live.rules.publicSync === 'object',
    'shared live rules must contain an existing publicSync object');
  const existing = live.rules.publicSync.splitFrameModes;
  if (existing) {
    assert.ok(same(existing, expected),
      '450_EXISTING_RULE_NOT_EXACT: do not overwrite unexpected ACL');
    return { mode: 'ALREADY_EXACT_450', candidate: structuredClone(live) };
  }
  const candidate = structuredClone(live);
  candidate.rules.publicSync.splitFrameModes = structuredClone(expected);
  assert.ok(same(without450(candidate), live),
    '450_DIFF_OUTSIDE_EXACT_NODE: no existing ACL or data path may change');
  return { mode: 'ADD_ONLY_ONE_SPLIT_FRAME_450', candidate };
};

if (process.argv.includes('--self-test')) {
  const base = JSON.parse(readFileSync('database.rules.json','utf8'));
  delete base.rules.publicSync.splitFrameModes;
  const add = classify(base);
  assert.equal(add.mode, 'ADD_ONLY_ONE_SPLIT_FRAME_450');
  assert.ok(same(without450(add.candidate), base));
  assert.equal(classify(add.candidate).mode, 'ALREADY_EXACT_450');

  const badRead = structuredClone(add.candidate);
  badRead.rules.publicSync.splitFrameModes['.read'] = true;
  assert.throws(() => classify(badRead), /450_EXISTING_RULE_NOT_EXACT/);
  const badParentRead = structuredClone(add.candidate);
  badParentRead.rules.publicSync.splitFrameModes['.read'] = true;
  assert.throws(() => classify(badParentRead), /450_EXISTING_RULE_NOT_EXACT/);
  const badGuestLeaf = structuredClone(add.candidate);
  badGuestLeaf.rules.publicSync.splitFrameModes.preview['.read'] = 'auth != null';
  assert.throws(() => classify(badGuestLeaf), /450_EXISTING_RULE_NOT_EXACT/);
  const badOtherRead = structuredClone(add.candidate);
  badOtherRead.rules.publicSync.splitFrameModes.$other['.read'] = true;
  assert.throws(() => classify(badOtherRead), /450_EXISTING_RULE_NOT_EXACT/);
  const badWrite = structuredClone(add.candidate);
  badWrite.rules.publicSync.splitFrameModes['.write'] = 'auth != null';
  assert.throws(() => classify(badWrite), /450_EXISTING_RULE_NOT_EXACT/);
  const unknownField = structuredClone(add.candidate);
  unknownField.rules.publicSync.splitFrameModes.extra = { '.validate': true };
  assert.throws(() => classify(unknownField), /450_EXISTING_RULE_NOT_EXACT/);
  const badEnv = structuredClone(add.candidate);
  badEnv.rules.publicSync.splitFrameModes.preview['.validate'] = "newData.isString()";
  assert.throws(() => classify(badEnv), /450_EXISTING_RULE_NOT_EXACT/);
  const badRoot = structuredClone(base);
  delete badRoot.rules.publicSync;
  assert.throws(() => classify(badRoot), /publicSync/);
  console.log('450_SHARED_RTDB_EXACT_ONE_SIBLING_NEGATIVE_SELF_TEST=PASS');
} else if (process.argv[2] === '--candidate') {
  const [liveFile, candidateFile, modeFile] = process.argv.slice(3);
  assert.ok(liveFile && candidateFile && modeFile, '450_LIVE_CANDIDATE_FILES_REQUIRED');
  const approvedSource = JSON.parse(readFileSync('database.rules.json','utf8'));
  assert.ok(same(approvedSource.rules?.publicSync?.splitFrameModes, expected),
    '450_SOURCE_RULES_NOT_YET_APPROVED_OR_MERGED');
  // 418 independently verifies that the ACTUAL live baseline differs only
  // by pre-approved private/public optional nodes and this exact new sibling.
  const preflight = spawnSync(process.execPath,
    ['scripts/verify-418-rtdb-rules-delta.mjs', liveFile], { encoding: 'utf8' });
  assert.equal(preflight.status, 0,
    '450_LIVE_RULES_PREVIEW_DRIFT_STOP: ' + (preflight.stderr || preflight.stdout));
  const live = JSON.parse(readFileSync(liveFile, 'utf8'));
  const { mode, candidate } = classify(live);
  assert.ok(same(without450(candidate), without450(live)),
    '450_LIVE_UNRELATED_RULES_CHANGED_STOP');
  writeFileSync(candidateFile, JSON.stringify(candidate), 'utf8');
  writeFileSync(modeFile, mode, 'utf8');
  console.log('450_SHARED_RTDB_CANDIDATE=' + mode);
  console.log('450_SHARED_RTDB_UNRELATED_EXISTING_ACL_DIFF=0');
  console.log('450_SHARED_RTDB_NO_WRITE_PERFORMED=PASS');
} else {
  throw Error('Use --self-test or --candidate LIVE_RULES CANDIDATE_OUTPUT MODE_OUTPUT');
}

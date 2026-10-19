import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildStage416ServerRulesCandidate } from './build-416-private-server-rules.mjs';

// PREVIEW app434: only the exact public publication signal reader ACLs
// may be added to live shared RTDB rules. Stage416 private server roots
// must remain byte-equivalent at the structural JSON level.
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map(
      key => [key, stable(value[key])]));
  return value;
};
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const source = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const target = buildStage416ServerRulesCandidate(source);
const publicRules = target?.rules?.publicSync;
assert.equal(publicRules?.explorePublication?.['.write'], false);
assert.equal(publicRules?.explorePublication?.['.read'], 'auth != null');
assert.equal(publicRules?.explorePublicationProfiles?.$ownerKey?.['.write'], false);
assert.equal(publicRules?.explorePublicationProfiles?.$ownerKey?.['.read'], 'auth != null');
assert.ok(target?.rules?.privateLikeBatch416);
assert.ok(target?.rules?.privateLikeFinal416);
const withoutPublication = structuredClone(target);
delete withoutPublication.rules.publicSync.explorePublication;
delete withoutPublication.rules.publicSync.explorePublicationProfiles;

function classify(live) {
  if (same(live, target)) return 'ALREADY_EXACT';
  if (same(live, withoutPublication)) return 'ADD_ONLY_TWO_PUBLICATION_NODES';
  throw new Error('434_SHARED_RTDB_UNEXPECTED_DRIFT_STOP_NO_PUT');
}

if (process.argv.includes('--self-test')) {
  assert.equal(classify(target), 'ALREADY_EXACT');
  assert.equal(classify(withoutPublication), 'ADD_ONLY_TWO_PUBLICATION_NODES');
  const widened = structuredClone(withoutPublication);
  widened.rules.userSync.$uid['.read'] = 'auth != null';
  assert.throws(() => classify(widened), /UNEXPECTED_DRIFT/);
  const missingPrivate = structuredClone(withoutPublication);
  delete missingPrivate.rules.privateLikeFinal416;
  assert.throws(() => classify(missingPrivate), /UNEXPECTED_DRIFT/);
  const partialPublication = structuredClone(withoutPublication);
  partialPublication.rules.publicSync.explorePublication = target.rules.publicSync.explorePublication;
  assert.throws(() => classify(partialPublication), /UNEXPECTED_DRIFT/);
  const changedLegacy = structuredClone(withoutPublication);
  changedLegacy.rules.publicSync.$other['.write'] = true;
  assert.throws(() => classify(changedLegacy), /UNEXPECTED_DRIFT/);
  console.log('434_SHARED_RTDB_EXACT_TWO_ADDITIVE_NODES_SELF_TEST=PASS');
} else {
  const [beforePath, candidatePath, modePath] = process.argv.slice(2);
  if (!beforePath || !candidatePath || !modePath) throw new Error('434_RULES_PATHS_REQUIRED');
  const live = JSON.parse(readFileSync(beforePath, 'utf8'));
  const mode = classify(live);
  writeFileSync(candidatePath, JSON.stringify(target));
  writeFileSync(modePath, mode);
  console.log('434_SHARED_RTDB_RULES_ONLY_TWO_ADDITIVE_NODES=' + mode);
  console.log('434_STAGE416_PRIVATE_RULES_PROTECTED=PASS');
}

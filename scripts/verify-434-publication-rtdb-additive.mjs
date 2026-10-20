import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildStage416ServerRulesCandidate } from './build-416-private-server-rules.mjs';

// PREVIEW app434: ONLY the exact two public publication signal roots may
// be added. The currently live shared RTDB may have BOTH Stage416
// server-only roots or NEITHER. Never add/delete/alter those roots here.
// app435 separately permits ONLY the two typed private Explore like result
// metadata fields when both are absent on the live shared Rules. Never
// combine an app434 public-root change with the app435 private field change.
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map(
      key => [key, stable(value[key])]));
  return value;
};
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const source = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const sourceWithStage416 = buildStage416ServerRulesCandidate(source);
const publicRules = source?.rules?.publicSync;
assert.equal(publicRules?.explorePublication?.['.write'], false);
assert.equal(publicRules?.explorePublication?.['.read'], 'auth != null');
assert.equal(publicRules?.explorePublicationProfiles?.$ownerKey?.['.write'], false);
assert.equal(publicRules?.explorePublicationProfiles?.$ownerKey?.['.read'], 'auth != null');
assert.equal(Object.hasOwn(source.rules, 'privateLikeBatch416'), false);
assert.equal(Object.hasOwn(source.rules, 'privateLikeFinal416'), false);
assert.ok(sourceWithStage416.rules.privateLikeBatch416);
assert.ok(sourceWithStage416.rules.privateLikeFinal416);
const withoutPrivateLikeMetadata435 = (rules) => {
  const x = structuredClone(rules);
  const row = x.rules.userSync.$uid.exploreLike.results.$index;
  delete row.acceptedAtPublicClock420;
  delete row.basePublicLikeCount420;
  return x;
};
const approvedPrivate435 = source.rules.userSync.$uid.exploreLike.results.$index;
const hasPrivate435 = Object.hasOwn(approvedPrivate435, 'acceptedAtPublicClock420')
  && Object.hasOwn(approvedPrivate435, 'basePublicLikeCount420');
if (hasPrivate435) {
  assert.equal(approvedPrivate435.acceptedAtPublicClock420['.validate'],
    'newData.isNumber() && newData.val() > 0 && newData.val() <= 9007199254740991');
  assert.equal(approvedPrivate435.basePublicLikeCount420['.validate'],
    approvedPrivate435.likeCount['.validate']);
  assert.equal(approvedPrivate435.$other['.validate'], false);
}
const withoutPublic = (rules) => {
  const x = structuredClone(rules);
  delete x.rules.publicSync.explorePublication;
  delete x.rules.publicSync.explorePublicationProfiles;
  return x;
};
const variants = [
  ['STAGE416_DORMANT', source],
  ['STAGE416_ALREADY_LIVE', sourceWithStage416],
];

function classify(live) {
  for (const [stage, approved] of variants) {
    if (same(live, approved))
      return { mode: 'ALREADY_EXACT', candidate: structuredClone(live), stage };
    if (hasPrivate435 && same(live, withoutPrivateLikeMetadata435(approved))) {
      const candidate = structuredClone(live);
      const row = candidate.rules.userSync.$uid.exploreLike.results.$index;
      row.acceptedAtPublicClock420 = structuredClone(approvedPrivate435.acceptedAtPublicClock420);
      row.basePublicLikeCount420 = structuredClone(approvedPrivate435.basePublicLikeCount420);
      assert.ok(same(candidate, approved), '435_ONLY_TWO_PRIVATE_FIELDS_ADDITIVE');
      return { mode: 'ADD_ONLY_TWO_PRIVATE_LIKE_FIELDS_435', candidate, stage };
    }
    if (same(live, withoutPublic(approved))) {
      const candidate = structuredClone(live);
      candidate.rules.publicSync.explorePublication = structuredClone(publicRules.explorePublication);
      candidate.rules.publicSync.explorePublicationProfiles = structuredClone(publicRules.explorePublicationProfiles);
      assert.ok(same(candidate, approved), '434_ONLY_TWO_PUBLICATION_ADDITIONS_ALLOWED');
      return { mode: 'ADD_ONLY_TWO_PUBLICATION_NODES', candidate, stage };
    }
  }
  throw new Error('434_SHARED_RTDB_UNEXPECTED_DRIFT_STOP_NO_PUT');
}

if (process.argv.includes('--self-test')) {
  for (const [stage, approved] of variants) {
    const exact = classify(approved);
    assert.equal(exact.mode, 'ALREADY_EXACT');
    assert.equal(exact.stage, stage);
    assert.ok(same(exact.candidate, approved));
    const live = withoutPublic(approved);
    const additive = classify(live);
    assert.equal(additive.mode, 'ADD_ONLY_TWO_PUBLICATION_NODES');
    assert.equal(additive.stage, stage);
    assert.ok(same(additive.candidate, approved));
    if (hasPrivate435) {
      const old435 = withoutPrivateLikeMetadata435(approved);
      const fixed435 = classify(old435);
      assert.equal(fixed435.mode, 'ADD_ONLY_TWO_PRIVATE_LIKE_FIELDS_435');
      assert.ok(same(fixed435.candidate, approved));
      const partial435 = structuredClone(approved);
      delete partial435.rules.userSync.$uid.exploreLike.results.$index.basePublicLikeCount420;
      assert.throws(() => classify(partial435), /UNEXPECTED_DRIFT/);
      const weakened435 = structuredClone(old435);
      weakened435.rules.userSync.$uid['.write'] = 'auth != null';
      assert.throws(() => classify(weakened435), /UNEXPECTED_DRIFT/);
      const simultaneous434435 = withoutPublic(old435);
      assert.throws(() => classify(simultaneous434435), /UNEXPECTED_DRIFT/);
      const unbounded435 = structuredClone(approved);
      unbounded435.rules.userSync.$uid.exploreLike.results.$index.basePublicLikeCount420['.validate'] =
        'newData.isNumber()';
      assert.throws(() => classify(unbounded435), /UNEXPECTED_DRIFT/);
    }
    const widened = structuredClone(live);
    widened.rules.userSync.$uid['.read'] = 'auth != null';
    assert.throws(() => classify(widened), /UNEXPECTED_DRIFT/);
    const partialPublic = structuredClone(live);
    partialPublic.rules.publicSync.explorePublication = publicRules.explorePublication;
    assert.throws(() => classify(partialPublic), /UNEXPECTED_DRIFT/);
  }
  const halfStage416 = structuredClone(withoutPublic(sourceWithStage416));
  delete halfStage416.rules.privateLikeFinal416;
  assert.throws(() => classify(halfStage416), /UNEXPECTED_DRIFT/);
  const unexpected = structuredClone(withoutPublic(source));
  unexpected.rules.publicSync.$other['.write'] = true;
  assert.throws(() => classify(unexpected), /UNEXPECTED_DRIFT/);
  if (hasPrivate435) console.log('435_SHARED_RTDB_ONLY_TWO_TYPED_PRIVATE_LIKE_FIELDS_SELF_TEST=PASS');
  console.log('434_SHARED_RTDB_EXACT_TWO_ADDITIVE_NODES_SELF_TEST=PASS');
  console.log('434_STAGE416_DORMANT_OR_LIVE_PRESERVATION_SELF_TEST=PASS');
} else {
  const [beforePath, candidatePath, modePath] = process.argv.slice(2);
  if (!beforePath || !candidatePath || !modePath) throw new Error('434_RULES_PATHS_REQUIRED');
  const live = JSON.parse(readFileSync(beforePath, 'utf8'));
  const { mode, candidate, stage } = classify(live);
  writeFileSync(candidatePath, JSON.stringify(candidate));
  writeFileSync(modePath, mode);
  console.log('434_SHARED_RTDB_RULES_ONLY_TWO_ADDITIVE_NODES=' + mode);
  console.log('434_STAGE416_PRIVATE_RULES_PRESERVED_EXACT=' + stage);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStage416ServerRulesCandidate } from './build-416-private-server-rules.mjs';

// Read-only shared RTDB gate. The local release candidate may add:
// 1) the previously approved canonicalSettled417 bool,
// 2) the UID-private exploreLikeIntent416 child,
// 3) Stage416 server-only privateLikeBatch416 + owner-readable final receipt,
// 4) app432 server-only tiny public Feed + owner-profile publication signal nodes.
// 5) app435 two typed, bounded optional accepted-like count metadata fields.
// The old live rules may lack BOTH 435 fields; partial/widened additions fail.
// Every other permission/schema byte must remain equivalent to the live rules.
const canonicalBase = JSON.parse(readFileSync('database.rules.json','utf8'));
const local = buildStage416ServerRulesCandidate(canonicalBase);
const user = local?.rules?.userSync?.$uid;
const accepted = user?.exploreLike?.results?.$index?.canonicalSettled417;
const intent = user?.exploreLikeIntent416;
const batch416 = local?.rules?.privateLikeBatch416;
const final416 = local?.rules?.privateLikeFinal416;
const publication429 = local?.rules?.publicSync?.explorePublication;
const publicationProfiles432 = local?.rules?.publicSync?.explorePublicationProfiles;

assert.equal(accepted?.['.validate'], 'newData.isBoolean()');
const acceptedRow435 = user?.exploreLike?.results?.$index;
assert.equal(acceptedRow435?.acceptedAtPublicClock420?.['.validate'],
  'newData.isNumber() && newData.val() > 0 && newData.val() <= 9007199254740991');
assert.equal(acceptedRow435?.basePublicLikeCount420?.['.validate'],
  'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000');
assert.equal(acceptedRow435?.['$other']?.['.validate'], false);
assert.equal(user['.read'], 'auth != null && auth.uid === $uid');
assert.equal(user['.write'], 'auth != null && auth.uid === $uid');
assert.ok(intent, 'Stage416 private-only node missing');
assert.match(String(intent['.validate'] || ''), /newData\.hasChildren\(\['version','results'\]\)/);
assert.equal(intent.results?.$index?.liked?.['.validate'], 'newData.isBoolean()');
assert.equal(intent.results?.$index?.optimisticLikeCount?.['.validate'],
  'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000');
assert.equal(intent.results?.$index?.status?.['.validate'],
  "newData.isString() && (newData.val() === 'pending' || newData.val() === 'accepted' || newData.val() === 'rejected')");
assert.equal(intent['$other']?.['.validate'], false);
assert.equal(publication429?.['.read'], 'auth != null');
assert.equal(publication429?.['.write'], false);
assert.equal(publication429?.actorUid?.['.validate'],
  "newData.isString() && newData.val() === 'publication-server-431'");
assert.equal(publication429?.rows?.$index?.['.validate'],
  "$index === '0' && newData.hasChildren(['trackId','ownerUid','at','status'])");
assert.equal(publication429?.rows?.$index?.['$other']?.['.validate'], false);
assert.equal(publicationProfiles432?.$ownerKey?.['.read'], 'auth != null');
assert.equal(publicationProfiles432?.$ownerKey?.['.write'], false);
assert.equal(intent.results?.$index?.['$other']?.['.validate'], false);

// New Stage416 pending/sealed server state is never client-readable/writable.
// Only the compact final receipt is owner-readable; clients can never write it.
assert.deepEqual(batch416, {
  '.read': false, '.write': false,
  '$uid': { '.read': false, '.write': false },
});
assert.deepEqual(final416, {
  '.read': false, '.write': false,
  '$uid': {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': false,
  },
});

const stable = x => JSON.stringify(sortObject(x));
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sortObject(value[key])]),
  );
  return value;
}
const withoutIntent = source => {
  const out = structuredClone(source);
  delete out.rules.userSync.$uid.exploreLikeIntent416;
  return out;
};
const withoutBool = source => {
  const out = structuredClone(source);
  delete out.rules.userSync.$uid.exploreLike.results.$index.canonicalSettled417;
  return out;
};
const withoutAcceptedLikeMetadata435 = source => {
  const out = structuredClone(source);
  const row = out.rules.userSync.$uid.exploreLike.results.$index;
  delete row.acceptedAtPublicClock420;
  delete row.basePublicLikeCount420;
  return out;
};
const withoutServer416 = source => {
  const out = structuredClone(source);
  delete out.rules.privateLikeBatch416;
  delete out.rules.privateLikeFinal416;
  return out;
};
const withoutIntentOptimisticCount = source => {
  const out = structuredClone(source);
  const row = out?.rules?.userSync?.$uid?.exploreLikeIntent416?.results?.$index;
  if (row) delete row.optimisticLikeCount;
  return out;
};
const withoutPublicPublication429 = source => {
  const out = structuredClone(source);
  if (out?.rules?.publicSync) {
    delete out.rules.publicSync.explorePublication;
    delete out.rules.publicSync.explorePublicationProfiles;
  }
  return out;
};

const baseVariants = [
  ['already-live', local],
  ['additive-private-intent-only', withoutIntent(local)],
  ['additive-bool-only', withoutBool(local)],
  ['additive-private-intent-and-bool', withoutBool(withoutIntent(local))],
  ['additive-server-only-416', withoutServer416(local)],
  ['additive-server-only-416-and-private-intent',
    withoutIntent(withoutServer416(local))],
  ['additive-server-only-416-and-bool',
    withoutBool(withoutServer416(local))],
  ['additive-server-only-416-private-intent-and-bool',
    withoutBool(withoutIntent(withoutServer416(local)))],
];
const expandedVariants = baseVariants.flatMap(([status,candidate]) => [
  [status, candidate],
  [status+'-without-public-publication-429', withoutPublicPublication429(candidate)],
  [status+'-without-private-optimistic-count', withoutIntentOptimisticCount(candidate)],
  [status+'-without-private-optimistic-count-and-public-publication-429',
    withoutPublicPublication429(withoutIntentOptimisticCount(candidate))],
]);
const exact435Variants = expandedVariants.flatMap(([status,candidate]) => [
  [status, candidate],
  [status+'-without-both-435-like-count-fields', withoutAcceptedLikeMetadata435(candidate)],
]);
const variants = [...new Map(
  exact435Variants.map(([status,candidate]) => [stable(candidate), [status,candidate]]),
).values()];
const compare = remote => {
  const key = stable(remote);
  return variants.find(([,candidate]) => stable(candidate) === key)?.[0] || null;
};

if (process.argv.includes('--self-test')) {
  for (const [status,candidate] of variants) {
    assert.equal(compare(candidate), status);
    const malicious = structuredClone(candidate);
    malicious.rules.userSync.$uid['.read'] = 'auth != null';
    assert.equal(compare(malicious), null, 'weakened private permissions must fail');
  }
  const oldLive435 = withoutAcceptedLikeMetadata435(local);
  assert.equal(compare(oldLive435), 'already-live-without-both-435-like-count-fields',
    'existing shared rules without both optional 435 fields remain a safe approved baseline');
  const partial435 = structuredClone(local);
  delete partial435.rules.userSync.$uid.exploreLike.results.$index.basePublicLikeCount420;
  assert.equal(compare(partial435), null, 'partially updated 435 Rules must fail');
  const widened435 = structuredClone(local);
  widened435.rules.userSync.$uid.exploreLike.results.$index.basePublicLikeCount420['.validate'] =
    'newData.isNumber()';
  assert.equal(compare(widened435), null, 'unbounded 435 count must fail');
  const writableOthers435 = structuredClone(oldLive435);
  writableOthers435.rules.userSync.$uid.exploreLike.results.$index.$other['.validate'] = true;
  assert.equal(compare(writableOthers435), null, 'unknown account-private fields must stay rejected');
  const mutated = structuredClone(local);
  mutated.rules.userSync.$uid.exploreLikeIntent416.results.$index.liked['.validate'] = 'newData.isString()';
  assert.equal(compare(mutated), null, 'private intent validation change must fail');
  const widenedCount = structuredClone(local);
  widenedCount.rules.userSync.$uid.exploreLikeIntent416.results.$index.optimisticLikeCount['.validate'] =
    'newData.isNumber()';
  assert.equal(compare(widenedCount), null, 'private optimistic count bounds must stay exact');
  const widenedPublication = structuredClone(local);
  widenedPublication.rules.publicSync.explorePublication['.write'] = 'auth != null';
  assert.equal(compare(widenedPublication), null, 'public publication Feed bus must remain client read-only');
  const writableProfilePublication = structuredClone(local);
  writableProfilePublication.rules.publicSync.explorePublicationProfiles.$ownerKey['.write'] = 'auth != null';
  assert.equal(compare(writableProfilePublication), null, 'public publication profile bus must remain client read-only');
  const widenedPublicationRows = structuredClone(local);
  widenedPublicationRows.rules.publicSync.explorePublication.rows.$index['.validate'] =
    "$index.matches(/^(0|1)$/)";
  assert.equal(compare(widenedPublicationRows), null, 'public publication signal must remain one latest row');
  const exposedBatch = structuredClone(local);
  exposedBatch.rules.privateLikeBatch416.$uid['.read'] = 'auth != null && auth.uid === $uid';
  assert.equal(compare(exposedBatch), null, 'server-only batch visibility must fail');
  const writableFinal = structuredClone(local);
  writableFinal.rules.privateLikeFinal416.$uid['.write'] = 'auth != null && auth.uid === $uid';
  assert.equal(compare(writableFinal), null, 'client-writable final receipt must fail');
  console.log('435_PRIVATE_LIKE_RESULT_TYPED_RULES_ADDITIVE_SELF_TEST=PASS');
  console.log('418_SHARED_RTDB_ADDITIVE_BOOL_ONLY_SELF_TEST=PASS');
  console.log('416_PRIVATE_RTDB_INTENT_ADDITIVE_ONLY_SELF_TEST=PASS');
  console.log('402_PRIVATE_OPTIMISTIC_COUNT_RULE_ADDITIVE_SELF_TEST=PASS');
  console.log('416_SERVER_ONLY_RTDB_TWO_NODE_ADDITIVE_SELF_TEST=PASS');
} else {
  const path = process.argv[2];
  if (!path) throw new Error('Live read-only RTDB rules JSON path required');
  const remote = JSON.parse(readFileSync(path,'utf8'));
  const status = compare(remote);
  if (!status) throw new Error(
    'Shared RTDB live/source divergence outside allowed 417/416/435 exact additive nodes: STOP before any PUT or PREVIEW Hosting deploy'
  );
  console.log('418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS '+status);
  console.log('416_PRIVATE_RTDB_ADDITIVE_PREFLIGHT=PASS');
  console.log('402_PRIVATE_OPTIMISTIC_COUNT_RULE_ADDITIVE_PREFLIGHT=PASS');
  console.log('416_SERVER_ONLY_RTDB_ADDITIVE_PREFLIGHT=PASS');
}

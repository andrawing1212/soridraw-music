const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const freshness = require(path.join(functionsRoot, 'lib', 'libraryBundleFreshness.js'));

const {
  buildRebuiltLibraryBundle,
  getNextLibraryBundleVersion,
  hasLibraryBundleRelevantChange,
  isCompatibleLibraryBundle,
  isLibraryBundleCoreCurrent,
  planLibraryBundleMutation,
} = freshness;

const makeTrack = (id, createdAt, fields = {}) => ({
  id,
  data: {
    title: `Track ${id}`,
    status: 'completed',
    source: 'suno-api',
    createdAt,
    ...fields,
  },
});

const makeRows = (count = 10, startAt = 10_000) => Array.from(
  { length: count },
  (_unused, index) => makeTrack(`track-${index}`, startAt - index),
);

const makeBundle = (rows = makeRows(), version = 1_000) => ({
  ...buildRebuiltLibraryBundle(rows),
  updatedAtMs: version,
});

const applyIncrementalPlan = (currentBundle, mutation) => {
  const plan = planLibraryBundleMutation(currentBundle, mutation);
  assert.equal(plan.action, 'incremental');
  return {
    ...plan.bundle,
    updatedAtMs: getNextLibraryBundleVersion(currentBundle.updatedAtMs, currentBundle.updatedAtMs + 1),
  };
};

const testNames = [];
const test = (name, callback) => {
  callback();
  testNames.push(name);
};

test('1. non-bundle field update exits before bundle I/O', () => {
  const before = makeTrack('track-0', 10_000).data;
  const after = {
    ...before,
    updatedAt: 12_345,
    apiStatusResponse: { large: true },
    debugPayload: { trace: 'ignored' },
    providerRawPayload: { response: 'ignored' },
    creditCheckedAfterComplete: true,
    creditCheckedAt: 12_345,
  };
  assert.equal(hasLibraryBundleRelevantChange({ trackId: 'track-0', before, after }), false);
});

test('2. latest-ten item update is incremental', () => {
  const current = makeBundle();
  const before = makeRows()[2].data;
  const after = { ...before, title: 'Updated title', isFavorite: true };
  const plan = planLibraryBundleMutation(current, { trackId: 'track-2', before, after });
  assert.equal(plan.action, 'incremental');
  assert.equal(plan.bundle.items.find((item) => item.id === 'track-2').title, 'Updated title');
  assert.equal(plan.bundle.items.find((item) => item.id === 'track-2').isFavorite, true);
});

test('3. new latest track enters the first ten', () => {
  const current = makeBundle();
  const after = makeTrack('track-new', 20_000, { title: 'Newest' }).data;
  const plan = planLibraryBundleMutation(current, { trackId: 'track-new', before: null, after });
  assert.equal(plan.action, 'incremental');
  assert.equal(plan.bundle.items.length, 10);
  assert.equal(plan.bundle.items[0].id, 'track-new');
  assert.equal(plan.bundle.items.some((item) => item.id === 'track-9'), false);
});

test('4. old track outside latest ten is a no-op', () => {
  const current = makeBundle();
  const before = makeTrack('track-old', 100, { title: 'Old' }).data;
  const after = { ...before, title: 'Old but edited' };
  const plan = planLibraryBundleMutation(current, { trackId: 'track-old', before, after });
  assert.equal(plan.action, 'noop');
  assert.equal(plan.reason, 'older-track-outside-bundle');
});

test('5. latest-ten deletion requests bounded refill', () => {
  const current = makeBundle();
  const before = makeRows()[3].data;
  const plan = planLibraryBundleMutation(current, { trackId: 'track-3', before, after: null });
  assert.equal(plan.action, 'rebuild');
  assert.equal(plan.reason, 'latest-item-deleted');
  const refilledRows = makeRows(11).filter((row) => row.id !== 'track-3').slice(0, 10);
  const rebuilt = buildRebuiltLibraryBundle(refilledRows, ['track-3']);
  assert.equal(rebuilt.items.length, 10);
  assert.equal(rebuilt.items.some((item) => item.id === 'track-3'), false);
  assert.equal(rebuilt.deletedIds.includes('track-3'), true);
});

test('6. missing bundle requests bounded rebuild', () => {
  const after = makeTrack('track-new', 20_000).data;
  const plan = planLibraryBundleMutation(null, { trackId: 'track-new', before: null, after });
  assert.equal(plan.action, 'rebuild');
  assert.equal(plan.reason, 'bundle-missing-or-incompatible');
});

test('7. corrupted bundle requests bounded rebuild', () => {
  const corrupted = { ...makeBundle(), itemCount: 999 };
  const before = makeRows()[0].data;
  const after = { ...before, title: 'Changed' };
  assert.equal(isCompatibleLibraryBundle(corrupted), false);
  const plan = planLibraryBundleMutation(corrupted, { trackId: 'track-0', before, after });
  assert.equal(plan.action, 'rebuild');
});

test('8. transaction retry planning preserves concurrent mutations', () => {
  const base = makeBundle();
  const rows = makeRows();
  const firstMutation = {
    trackId: 'track-0',
    before: rows[0].data,
    after: { ...rows[0].data, title: 'First concurrent change' },
  };
  const secondMutation = {
    trackId: 'track-1',
    before: rows[1].data,
    after: { ...rows[1].data, isFavorite: true },
  };
  const afterFirstCommit = applyIncrementalPlan(base, firstMutation);
  const afterTransactionRetry = applyIncrementalPlan(afterFirstCommit, secondMutation);
  assert.equal(afterTransactionRetry.items.find((item) => item.id === 'track-0').title, 'First concurrent change');
  assert.equal(afterTransactionRetry.items.find((item) => item.id === 'track-1').isFavorite, true);

  const sameTrackEarlier = {
    trackId: 'track-0',
    before: rows[0].data,
    after: { ...rows[0].data, title: 'Intermediate title' },
  };
  const sameTrackLater = {
    trackId: 'track-0',
    before: sameTrackEarlier.after,
    after: { ...sameTrackEarlier.after, title: 'Canonical latest title' },
  };
  assert.equal(planLibraryBundleMutation(base, sameTrackLater).action, 'rebuild');
  const canonicalRows = rows.map((row) => row.id === 'track-0'
    ? { id: row.id, data: sameTrackLater.after }
    : row);
  const canonicalBundle = { ...buildRebuiltLibraryBundle(canonicalRows), updatedAtMs: 2_000 };
  assert.equal(planLibraryBundleMutation(canonicalBundle, sameTrackEarlier).action, 'rebuild');
  assert.equal(isLibraryBundleCoreCurrent(canonicalBundle, buildRebuiltLibraryBundle(canonicalRows)), true);
});

test('9. identical event retry does not rewrite', () => {
  const current = makeBundle();
  const before = makeRows()[0].data;
  const mutation = {
    trackId: 'track-0',
    before,
    after: { ...before, title: 'Retry-safe title' },
  };
  const afterFirstCommit = applyIncrementalPlan(current, mutation);
  const retryPlan = planLibraryBundleMutation(afterFirstCommit, mutation);
  assert.equal(retryPlan.action, 'noop');
  assert.equal(retryPlan.reason, 'bundle-already-current');
});

test('trigger contract keeps reads after the relevance guard and writes atomically', () => {
  const sourcePath = path.join(functionsRoot, 'src', 'index.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const start = source.indexOf('export const syncSunoLibraryLatest10Bundle = onDocumentWritten(');
  const end = source.indexOf('\nconst getAuthProviderIds', start);
  assert.ok(start >= 0 && end > start, 'trigger export must exist in src/index.ts');
  const trigger = source.slice(start, end);
  assert.ok(trigger.includes('document: "suno_tracks/{uid}/tracks/{trackId}"'));
  assert.ok(trigger.includes('region: "us-central1"'));
  assert.ok(trigger.indexOf('hasLibraryBundleRelevantChange(mutation)') < trigger.indexOf('runTransaction'));
  assert.ok(trigger.includes('.orderBy("createdAt", "desc")'));
  assert.ok(trigger.includes('.limit(10)'));
  assert.ok(trigger.includes('transaction.set(bundleRef'));
  assert.ok(trigger.includes('transaction.set(userRef, { syncVersions: { library: version } }'));
  assert.ok(trigger.includes('updatedAtMs: version'));

  const appSource = fs.readFileSync(path.resolve(functionsRoot, '..', 'src', 'App.tsx'), 'utf8');
  assert.equal(appSource.includes("scheduleListBundleWrite('library'"), false);
  const libraryPageSource = fs.readFileSync(path.resolve(functionsRoot, '..', 'src', 'pages', 'SunoLibraryPage.tsx'), 'utf8');
  assert.equal(libraryPageSource.includes("scheduleListBundleWrite('library'"), false);

  const listBundleSource = fs.readFileSync(path.resolve(functionsRoot, '..', 'src', 'lib', 'listBundleCache.ts'), 'utf8');
  const subscriptionStart = listBundleSource.indexOf('export const subscribeListBundle = (');
  const subscriptionEnd = listBundleSource.indexOf('export const readListBundleFromServerOnce', subscriptionStart);
  assert.ok(subscriptionStart >= 0 && subscriptionEnd > subscriptionStart);
  const subscriptionSource = listBundleSource.slice(subscriptionStart, subscriptionEnd);
  assert.equal((subscriptionSource.match(/getDocFromServer\(/g) || []).length, 1);
  assert.equal(subscriptionSource.includes('getDocs('), false);
  assert.equal(subscriptionSource.includes('setDoc('), false);
  assert.equal(subscriptionSource.includes('updateDoc('), false);

  const builtEntry = path.join(functionsRoot, 'lib', 'securedIndex.js');
  if (fs.existsSync(builtEntry)) {
    const builtSource = fs.readFileSync(builtEntry, 'utf8');
    assert.ok(builtSource.includes('syncSunoLibraryLatest10Bundle'));
    assert.ok(builtSource.includes('suno_tracks/{uid}/tracks/{trackId}'));
  }
});

assert.equal(getNextLibraryBundleVersion(5_000, 4_000), 5_001);
console.log(`Library bundle freshness contract: ${testNames.length} cases PASS`);
testNames.forEach((name) => console.log(`PASS ${name}`));

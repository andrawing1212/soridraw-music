// Real Firestore emulator + production-shaped rules, isolated demo project.
// NEVER point this test at live Firebase, even with valid ambient credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const projectId = 'demo-soridraw-app524';
const host = process.env.FIRESTORE_EMULATOR_HOST || '';
assert.match(host, /^(?:localhost|127\.0\.0\.1):\d+$/);
const [hostname, portString] = host.split(':');
const tests = await initializeTestEnvironment({
  projectId,
  firestore: { host: hostname, port: Number(portString),
    rules: readFileSync('firestore.rules', 'utf8') },
});
const source = readFileSync('src/lib/studioHeartCanonical523.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const createClient = uid => {
  const db = tests.authenticatedContext(uid).firestore();
  const exports = {};
  vm.runInNewContext(output, {
    exports, console, Promise, Date, Math, Number, Error,
    require: name => name === 'firebase/firestore'
      ? { doc, runTransaction, serverTimestamp }
      : name === '../firebase' ? { db }
      : (() => { throw new Error('Unexpected dependency: ' + name); })(),
  }, { filename: 'studioHeartCanonical523.ts' });
  return { db, commit: exports.commitStudioHeartCanonical523 };
};
const aliceA = createClient('alice');
const aliceB = createClient('alice');
const bob = createClient('bob');
const order = (uid, id) => doc(aliceA.db, 'users', uid, 'studio_heart_orders', id);
const favorite = (id, db = aliceA.db) => doc(db, 'favorites', id);
const args = (id, version, saved, baselineSaved = false) => ({
  uid: 'alice', documentId: id, previewVersion: version, desiredSaved: saved,
  baselineSaved,
  creationPayload: {
    uid: 'alice', title: 'First song original title', prompt: 'original prompt',
    lyrics: 'original lyrics', sunoCoverUrl: 'original-cover',
    createdAtMs: 123, isLocked: false, isPublic: false,
  },
});
try {
  // The old favorites read rule must deny an absent doc even to Alice.
  await assertFails(getDoc(favorite('fresh-one')));
  // But an absent *owner-scoped* order marker must be readable.
  const emptyOrder = await getDoc(order('alice', 'fresh-one'));
  assert.equal(emptyOrder.exists(), false);
  const first = await aliceA.commit(args('fresh-one', 100, true));
  assert.equal(first.outcome, 'written');
  assert.equal(first.membershipChanged, true);
  const existing = await getDoc(favorite('fresh-one'));
  assert.equal(existing.exists(), true);
  assert.equal(existing.data().title, 'First song original title');
  assert.equal(existing.data().lyrics, 'original lyrics');
  const firstMarker = await getDoc(order('alice', 'fresh-one'));
  assert.equal(firstMarker.data().previewVersion, 100);
  console.log('APP524_EMULATOR_FIRST_SAVE_OWNER_MISSING_MARKER=PASS');

  // Strict ownership, no list, no arbitrary schema/version rollback.
  await assertFails(getDoc(doc(bob.db, 'users', 'alice', 'studio_heart_orders', 'fresh-one')));
  await assertFails(getDoc(favorite('fresh-one', bob.db)));
  await assertFails(bob.commit(args('fresh-one', 105, false)));
  await assertFails(setDoc(order('alice', 'fresh-one'), {
    uid: 'alice', favoriteId: 'fresh-one', previewVersion: 99, saved: false,
  }));
  await assertFails(setDoc(order('alice', 'fresh-one'), {
    uid: 'alice', favoriteId: 'fresh-one', previewVersion: 105, saved: false, leaked: 'bad',
  }));
  console.log('APP524_EMULATOR_CROSS_USER_DENIED_AND_ORDER_SCHEMA=PASS');

  // The newer UNSAVE records a tombstone atomically; later old SAVE is W0.
  const unsaved = await aliceB.commit(args('fresh-one', 300, false, true));
  assert.equal(unsaved.outcome, 'written');
  const stale = await aliceA.commit(args('fresh-one', 200, true));
  assert.equal(stale.outcome, 'superseded');
  assert.equal((await getDoc(favorite('fresh-one'))).data().saved, false);
  console.log('APP524_EMULATOR_NEWER_UNSAVE_OLD_SAVE_CANNOT_RESURRECT=PASS');

  // Two real clients racing on same song; transaction retries force higher
  // RTDB click version to win even if request completions invert.
  for (let i = 0; i < 4; i++) {
    const id = 'race-' + i;
    const oldest = aliceA.commit(args(id, 100 + i * 10, true));
    const newest = aliceB.commit(args(id, 101 + i * 10, false));
    await Promise.all([oldest, newest]);
    const final = await getDoc(favorite(id));
    assert.equal(final.data().saved, false);
    assert.equal((await getDoc(order('alice', id))).data().previewVersion, 101 + i * 10);
  }
  console.log('APP524_EMULATOR_TWO_REAL_CLIENTS_CONCURRENT_ORDER=PASS');

  // Soft-removed legacy favorite with protected title/media. The caller
  // knows an existing favorite and passes baselineSaved=true for active rows.
  await tests.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'favorites', 'legacy'), {
      uid: 'alice', title: 'Preserved legacy original',
      lyrics: 'old lyrics', prompt: 'old prompt', sunoCoverUrl: 'old-artwork',
      saved: true, favoriteRemoved: false, createdAtMs: 42,
    });
  });
  await aliceA.commit(args('legacy', 900, true, true));
  const legacy = (await getDoc(favorite('legacy'))).data();
  assert.equal(legacy.title, 'Preserved legacy original');
  assert.equal(legacy.sunoCoverUrl, 'old-artwork');
  assert.equal(legacy.createdAtMs, 42);
  assert.equal(legacy.prompt, 'old prompt');
  console.log('APP524_EMULATOR_LEGACY_ORIGINAL_FIELDS_INTACT=PASS');

  // Charge shape: changed mutation = 1 exact order-doc transaction read,
  // 1 order-doc write + 1 favorite-doc write. A stale mutation = 1 read/W0.
  // Actual billing may include transaction retries and rules evaluation.
  const helperSource = readFileSync('src/lib/studioHeartCanonical523.ts', 'utf8');
  assert.equal((helperSource.match(/await tx\.get\(/g) || []).length, 1);
  assert.match(helperSource, /await tx\.get\(orderRef\)/);
  assert.equal((helperSource.match(/tx\.set\(orderRef,/g) || []).length, 1);
  assert.equal((helperSource.match(/tx\.set\(favoriteRef,/g) || []).length, 2);
  assert.doesNotMatch(helperSource, /tx\.get\(favoriteRef\)|getDocs\(|collection\(/);
  console.log('APP524_COST_PER_SETTLED_CHANGE_ORDER_R1_FAVORITE_AND_MARKER_W2=PASS');
} finally {
  await tests.cleanup();
}

import assert from 'node:assert/strict';
import {
  BACKEND_V2_MIRROR_OUTBOX_RUNTIME_ENABLED,
  BackendV2MirrorOutbox,
} from './indexedDbMirrorOutbox';
import {
  BACKEND_V2_MIRROR_RETRY_POLICY,
  createSoridrawSongId,
  createV2MirrorMutationEnvelope,
} from './v2LiveMutation';

const FAKE_INDEXED_DB_MODULE = 'fake-indexeddb';
const fakeIndexedDbModule = await import(FAKE_INDEXED_DB_MODULE) as any;
const FakeIDBKeyRange = fakeIndexedDbModule.IDBKeyRange;
const fakeIndexedDB = fakeIndexedDbModule.indexedDB;

let nowMs = 10_000;
const makeOutbox = (name: string, maxPerUser = 200) => new BackendV2MirrorOutbox({
  factory: fakeIndexedDB as unknown as IDBFactory,
  keyRange: FakeIDBKeyRange as unknown as { only(value: IDBValidKey | IDBKeyRange): IDBKeyRange },
  dbName: name,
  now: () => nowMs,
  maxPerUser,
});

const makeSongId = (suffix: string) => createSoridrawSongId(
  () => `123e4567-e89b-12d3-a456-${suffix.padStart(12, '0')}`,
);

const run = async () => {
  assert.equal(BACKEND_V2_MIRROR_OUTBOX_RUNTIME_ENABLED, false);

  const outbox = makeOutbox(`soridraw-v2-step2a4a-${Date.now()}`);
  assert.equal(outbox.isAvailable(), true);

  const mutation = createV2MirrorMutationEnvelope({
    uid: 'user-a',
    targetKind: 'soridraw',
    targetSongId: makeSongId('1'),
    source: 'recent',
    operation: 'upsert',
    sourceUpdatedAtMs: 9000,
    enqueuedAtMs: 9500,
  });

  assert.equal(await outbox.enqueue(mutation), true);
  assert.equal(await outbox.enqueue(mutation), true, 'same mutation ID must be idempotent');

  const firstList = await outbox.listPending('user-a', { readyAtMs: nowMs, limit: 20 });
  assert.equal(firstList.length, 1);
  assert.equal(firstList[0].mutationId, mutation.mutationId);
  assert.equal(firstList[0].attemptCount, 0);
  assert.equal(firstList[0].status, 'pending');
  assert.equal(Object.prototype.hasOwnProperty.call(firstList[0], 'payload'), false);

  assert.equal(await outbox.recordFailedAttempt(mutation.mutationId, 20_000), true);
  const afterFirstFailure = await outbox.get(mutation.mutationId);
  assert.equal(afterFirstFailure?.attemptCount, 1);
  assert.equal(afterFirstFailure?.nextAttemptAtMs, 25_000);
  assert.equal(afterFirstFailure?.status, 'pending');
  assert.deepEqual(await outbox.listPending('user-a', { readyAtMs: 24_999 }), []);
  assert.equal((await outbox.listPending('user-a', { readyAtMs: 25_000 })).length, 1);

  for (let attempt = 2; attempt <= BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts; attempt += 1) {
    assert.equal(await outbox.recordFailedAttempt(mutation.mutationId, 20_000 + attempt * 1000), true);
  }
  const exhausted = await outbox.get(mutation.mutationId);
  assert.equal(exhausted?.attemptCount, BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts);
  assert.equal(exhausted?.status, 'exhausted');
  assert.equal((await outbox.listPending('user-a', { readyAtMs: 999_999 })).length, 0);
  assert.equal((await outbox.listPending('user-a', { readyAtMs: 999_999, includeExhausted: true })).length, 1);

  const otherUserMutation = createV2MirrorMutationEnvelope({
    uid: 'user-b',
    targetKind: 'soridraw',
    targetSongId: makeSongId('2'),
    source: 'musicNote',
    operation: 'music-note-save',
    sourceUpdatedAtMs: 12_000,
    enqueuedAtMs: 12_100,
  });
  assert.equal(await outbox.enqueue(otherUserMutation), true);
  assert.equal((await outbox.listPending('user-b', { readyAtMs: nowMs })).length, 1);
  assert.equal(await outbox.clearUserOutbox('user-a'), true);
  assert.equal(await outbox.get(mutation.mutationId), null);
  assert.equal((await outbox.listPending('user-b', { readyAtMs: nowMs })).length, 1, 'per-user clear must not affect another user');

  assert.equal(await outbox.remove(otherUserMutation.mutationId), true);
  assert.equal(await outbox.get(otherUserMutation.mutationId), null);
  await outbox.close();

  // Hard bound: do not allow an unbounded local retry queue per user.
  nowMs = 30_000;
  const capped = makeOutbox(`soridraw-v2-step2a4a-cap-${Date.now()}`, 2);
  for (let i = 0; i < 2; i += 1) {
    assert.equal(await capped.enqueue(createV2MirrorMutationEnvelope({
      uid: 'user-cap',
      targetKind: 'soridraw',
      targetSongId: makeSongId(String(i + 10)),
      source: 'recent',
      operation: 'upsert',
      sourceUpdatedAtMs: 100 + i,
      enqueuedAtMs: 200 + i,
    })), true);
  }
  assert.equal(await capped.enqueue(createV2MirrorMutationEnvelope({
    uid: 'user-cap',
    targetKind: 'soridraw',
    targetSongId: makeSongId('99'),
    source: 'recent',
    operation: 'upsert',
    sourceUpdatedAtMs: 999,
    enqueuedAtMs: 1000,
  })), false);
  await capped.close();

  const unavailable = new BackendV2MirrorOutbox({ factory: null, keyRange: null });
  assert.equal(unavailable.isAvailable(), false);
  assert.equal(await unavailable.enqueue(mutation), false);
  assert.deepEqual(await unavailable.listPending('user-a'), []);

  console.log('Backend V2 Step 2-A4a IndexedDB mirror outbox contract PASS');
};

await run();

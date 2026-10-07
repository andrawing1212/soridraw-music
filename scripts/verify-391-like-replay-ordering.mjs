import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const ast = ts.createSourceFile('like.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['clampLikeCount', 'normalizeExploreLikeDisplayPair129', 'computeExploreLikeAction127',
  'nextExploreLikeMutationAt127', 'rebaseExploreLikeAfterInFlight127', 'normalizeBatchResults',
  'setExploreTrackLike', 'canBroadcastExploreLikeSnapshot127', 'applyRemoteLikeSignal127',
  'normalizeLikeSignal127', 'normalizePendingMutation'];
const selected = ast.statements.filter(node => ts.isVariableStatement(node) && names.includes(node.declarationList.declarations[0]?.name.getText(ast)));
assert.equal(selected.length, names.length);
const flush = ast.statements.find(node => ts.isExpressionStatement(node) && node.getText(ast).startsWith('flushPendingLikes ='));
const code = ts.transpileModule('let flushPendingLikes;\n' + selected.map(node => node.getText(ast).replace(/^export /, '')).join('\n') + '\n' + flush.getText(ast) +
  '\nglobalThis.flush = flushPendingLikes; globalThis.click = setExploreTrackLike; globalThis.receive = applyRemoteLikeSignal127; globalThis.normalize = normalizePendingMutation;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const now = 1_800_000_000_000;
const original = { trackId: 't', ownerUid: 'owner', desiredLiked: true, baseLiked: false,
  baseLikeCount: 8, optimisticLikeCount: 9, updatedAt: now, queuedAt: now, retryCount: 0,
  operationId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0 };
const replay = { data: { acceptanceReplay390: true, acceptedAt390: now,
  acceptedOperations390: [{ trackId: 't', operationId: original.operationId }] } };
function fixture() {
  let outbox = { t: { ...original } }, cache = new Map([['t', true]]), revisions = {}, locks = {}, pending = {};
  let posts = 0, ui = [], signals = [], publics = [], scheduled = 0, localWrites = 0, errors = [];
  let seen = 0;
  let response = () => replay;
  const copy = value => structuredClone(value);
  const context = vm.createContext({ console, Date: { now: () => now + 31_000 },
    readSeenLikeSignal127: () => seen, markSeenLikeSignal127: (_, version) => { seen = version; },
    readRepairTarget127: () => 0, markLocalLikeCatalogReady135: () => {},
    patchExploreLikedTrackMembership: () => {},
    EXPLORE_LIKE_SIGNAL_MAX_127: 50,
    inflightByUid: new Map(), EXPLORE_LIKE_BATCH_MAX: 50, EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120: 90_000,
    readLikeOutbox: () => copy(outbox), persistLikeOutbox: (_, value) => { outbox = copy(value); },
    readLikeCanonicalRevisions172: () => copy(revisions), persistLikeCanonicalRevisions172: (_, value) => { localWrites++; revisions = copy(value); },
    getLikedStateCache: () => cache, persistLikedStateCache: () => { localWrites++; },
    readLikeDisplayLocks: () => copy(locks), persistLikeDisplayLocks: (_, value) => { localWrites++; locks = copy(value); },
    readSnapshotPending127: () => copy(pending), writeSnapshotPending127: (_, value) => { localWrites++; pending = copy(value); },
    requestExploreLike: async (_, path, init) => { assert.equal(path, '/v1/me/likes/batch'); posts++; return response(JSON.parse(init.body)); },
    getPendingExploreLikeMutationCount: () => Object.keys(outbox).length,
    schedulePendingFlush: () => { scheduled++; }, dispatchLikeSync: value => ui.push(value),
    dispatchLikeSyncError: value => errors.push(value),
    publishConfirmedLikeSignal127: async (_, rows) => signals.push(...rows),
    publishExplorePublicLikeInvalidation192: async (_, rows) => publics.push(...rows),
    installLikeSignalRetry127: () => {}, readExploreTrackLikeMembership127: (_, id) => cache.get(id),
    createExploreLikeOperationId144: () => '00000000-0000-4000-8000-000000000002',
  });
  vm.runInContext(code, context);
  return { context, setResponse(fn) { response = fn; },
    setState(value) { if (value.outbox) outbox = copy(value.outbox); if (value.cache) cache = value.cache;
      if (value.revisions) revisions = value.revisions; if (value.locks) locks = value.locks; if (value.pending) pending = value.pending; },
    get state() { return { outbox, cache, revisions, locks, pending, posts, ui, signals, publics, scheduled, localWrites, errors }; },
    flush: () => context.flush({ uid: 'viewer' }),
  };
}
// ACK loss: remove only the proven operation; no new membership/aggregate signal.
const lost = fixture(); await lost.flush();
assert.deepEqual(lost.state.outbox, {}); assert.equal(lost.state.cache.get('t'), true);
assert.equal(lost.state.localWrites, 0); assert.equal(lost.state.signals.length, 0);
await lost.flush(); assert.equal(lost.state.posts, 1, 'unchanged/re-entry cannot replay');
// Newer cache/revision from a device must survive an older durable acceptance.
const newer = fixture();
newer.setState({ cache: new Map([['t', false]]), revisions: { t: 8 },
  locks: { t: { liked: false, likeCount: 8, updatedAt: now + 20_000 } }, pending: { t: false } });
await newer.flush();
assert.equal(newer.state.cache.get('t'), false); assert.equal(newer.state.revisions.t, 8);
assert.equal(newer.state.locks.t.liked, false); assert.equal(newer.state.pending.t, false);
assert.equal(newer.state.localWrites, 0); assert.equal(newer.state.ui.length, 0);
assert.equal(newer.state.signals.length + newer.state.publics.length, 0, 'old replay cannot become a new cross-device event');
// Execute the real receiver while the old outbox is pending, not just a
// pre-populated cache: its watermark advances even though the row was skipped.
const deferred = fixture();
deferred.setResponse(() => {
  deferred.context.receive('viewer', { version: now + 20_000, previousVersion: 0,
    results: [{ trackId: 't', ownerUid: 'owner', liked: false, likeCount: 8 }] });
  return replay;
});
await deferred.flush();
assert.equal(deferred.state.cache.get('t'), false, 'replay ACK must recover a newer received device state skipped by its own outbox');
assert.equal(deferred.state.signals.length, 0, 'recovery must not republish the older desired');
// The deferred row survives a JSON outbox reload; a new explicit click does
// not inherit it. Old received versions cannot repaint a later receipt.
const restored = fixture();
restored.context.receive('viewer', { version: now + 20_000, previousVersion: 0,
  results: [{ trackId: 't', ownerUid: 'owner', liked: false, likeCount: 8 }] });
const saved = JSON.parse(JSON.stringify(restored.state.outbox.t));
const normalized = restored.context.normalize(saved);
assert.equal(normalized.operationId, original.operationId);
assert.equal(normalized.deferredSignal390.results.length, 1);
restored.setState({ outbox: { t: normalized } });
await restored.flush(); assert.equal(restored.state.cache.get('t'), false);
const staleReceived = fixture();
staleReceived.context.receive('viewer', { version: now - 1, previousVersion: 0,
  results: [{ trackId: 't', ownerUid: 'owner', liked: false, likeCount: 8 }] });
await staleReceived.flush(); assert.equal(staleReceived.state.cache.get('t'), true);
// An explicit undo during flight stays pending, with its ID and +30s deadline.
const undo = fixture();
undo.setResponse(() => {
  undo.setState({ outbox: { t: { ...original, desiredLiked: false, optimisticLikeCount: 8,
    updatedAt: now + 1, operationId: '00000000-0000-4000-8000-000000000002' } }, cache: new Map([['t', false]]) });
  return replay;
});
await undo.flush();
assert.equal(undo.state.outbox.t.desiredLiked, false); assert.equal(undo.state.outbox.t.baseLiked, true);
assert.equal(undo.state.outbox.t.updatedAt, now + 1); assert.equal(undo.state.outbox.t.operationId, '00000000-0000-4000-8000-000000000002');
assert.equal(undo.state.cache.get('t'), false); assert.equal(undo.state.signals.length, 0);
const revised = fixture();
const fresh = { ...original, desiredLiked: false, baseLiked: true, optimisticLikeCount: 20,
  baseLikeCount: 21, updatedAt: now + 1, expectedRevision: 9, operationId: '00000000-0000-4000-8000-000000000002' };
revised.setResponse(() => { revised.setState({ outbox: { t: fresh }, revisions: { t: 9 } }); return replay; });
await revised.flush(); assert.deepEqual(revised.state.outbox.t, fresh, 'old acceptance cannot rebase newer revision/count');
const mismatch = fixture(); mismatch.setResponse(() => ({ data: { ...replay.data, acceptedOperations390: [] } }));
await mismatch.flush(); assert.equal(mismatch.state.outbox.t.retryCount, 1); assert.equal(mismatch.state.errors.length, 1);
// Expired proof never silently re-enqueues; a new explicit undo gets a fresh ID
// and cannot be swallowed as false/false against the pre-ACK-loss baseline.
const expired = fixture(); expired.setResponse(() => { throw Object.assign(Error('expired'), { code: 'LIKE_RECEIPT_EXPIRED', status: 409 }); });
await expired.flush(); assert.equal(expired.state.outbox.t.retryCount, 1);
await expired.flush(); assert.equal(expired.state.posts, 1);
await expired.context.click({ uid: 'viewer' }, 't', false, 9, 'owner');
assert.equal(expired.state.outbox.t.baseLiked, true); assert.equal(expired.state.outbox.t.desiredLiked, false);
assert.notEqual(expired.state.outbox.t.operationId, original.operationId);
expired.setResponse(body => ({ data: { results: body.mutations.map(row => ({ trackId: row.trackId, liked: row.liked, status: 'legacy-queued' })),
  canonicalD1: 'queued', personalLikeSnapshot: 'changed-track-r2' } }));
await expired.flush(); assert.equal(expired.state.posts, 2); assert.deepEqual(expired.state.outbox, {});
assert.equal(expired.state.signals.at(-1).liked, false);
// First acceptance still runs the actual app160/app164 ACK + notification path.
const normal = fixture(); normal.setResponse(() => ({ data: { results: [{ trackId: 't', liked: true, status: 'legacy-queued' }],
  canonicalD1: 'queued', personalLikeSnapshot: 'changed-track-r2' } }));
await normal.flush(); assert.equal(normal.state.cache.get('t'), true); assert.deepEqual(normal.state.outbox, {});
assert.equal(normal.state.signals.length, 1); assert.equal(normal.state.publics.length, 1);
assert.equal(normal.state.errors.length, 0);
console.log('391_ACTUAL_CLIENT_REPLAY_NO_MEMBERSHIP_COUNT_REVISION_OR_SIGNAL_OVERWRITE=PASS');
console.log('391_ACTUAL_CLIENT_NEWER_INTENT_REVISION_AND_EXPIRED_PROOF_RECOVERY=PASS');
console.log('391_FIRST_ACK_FROZEN_NOTIFICATION_PATH_UNCHANGED=PASS');

const ambiguous = fixture();
ambiguous.setResponse(() => {
  ambiguous.setState({ outbox: { t: { ...original, desiredLiked: false, updatedAt: now + 1,
    operationId: '00000000-0000-4000-8000-000000000002' } } });
  throw new TypeError('network response lost');
});
await ambiguous.flush(); assert.equal(ambiguous.state.outbox.t.baseLiked, true);
assert.equal(ambiguous.state.outbox.t.desiredLiked, false);
const offline = fixture(); offline.setResponse(() => { throw new TypeError('offline'); });
await offline.flush(); await offline.flush(); assert.equal(offline.state.posts, 1);
assert.equal(offline.state.outbox.t.retryCount, 1);
console.log('391_AMBIGUOUS_FAILURE_PRESERVES_UNDO_NO_AUTOMATIC_BUSY_RETRY=PASS');

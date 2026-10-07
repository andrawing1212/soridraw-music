import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

export function clientFixture379(source) {
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

return { fixture, original, now };
}

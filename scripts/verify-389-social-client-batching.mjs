import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now = 1_800_000_000_000;
const storage = new Map();
const localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
function client() {
  const timers = new Map(); let id = 0;
  const context = vm.createContext({ exports: {}, console, localStorage, Date: { now: () => now },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; },
    clearTimeout: key => timers.delete(key),
  });
  const source = readFileSync('src/services/exploreFollowBatchService380.ts', 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { ...context.exports, timers,
    async advance(ms) {
      now += ms;
      for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.fn(); }
      for (let n = 0; n < 20; n++) await Promise.resolve();
    },
  };
}
let calls = [], settled = [];
const request = (targetUid = 'target', desiredFollowing = true) => ({
  viewerUid: 'viewer', targetUid, desiredFollowing, baseFollowing: false,
  baseTargetFollowerCount: 4, baseTargetFollowingCount: 8, baseActorFollowingCount: 2,
  targetProfile: { uid: targetUid, nickname: 'Target', avatarUrl: '', handle: 'target' },
  commit: async following => { calls.push(following); return { isFollowing: following, followerCount: 0, followingCount: 0 }; },
  onSettled: value => settled.push(value), onError: error => { throw Error('unexpected error: ' + error.error); },
});
const c = client();
c.queueExploreFollowFinalState380(request());
await c.advance(29_000);
assert.equal(calls.length, 0);
await c.flushPendingExploreFollowsForPageExit380('viewer');
await c.flushExploreFollowPair380(JSON.stringify(['viewer', 'target']));
assert.equal(calls.length, 0, 'navigation/manual flush must respect last click +30s');
c.queueExploreFollowFinalState380(request('target', false));
await c.advance(29_999); assert.equal(calls.length, 0);
await c.advance(1); assert.equal(calls.length, 0);
assert.equal(c.readPendingExploreFollowIntents380('viewer').length, 0);
c.queueExploreFollowFinalState380(request());
await c.advance(20_000);
c.queueExploreFollowFinalState380(request());
await c.advance(10_000); assert.equal(calls.length, 0);
await c.advance(20_000); assert.deepEqual(calls, [true]);
assert.equal(settled[0].baseTargetFollowerCount, 4, 'stale server count is not the local authority');

// In-flight last click gets a new baseline and keeps its own last-click deadline.
let resolve;
c.queueExploreFollowFinalState380({ ...request('flight'), commit: () => new Promise(r => { resolve = r; }) });
await c.advance(30_000);
c.queueExploreFollowFinalState380(request('flight', false));
await c.advance(10_000);
resolve({ isFollowing: true, followerCount: 0, followingCount: 0 });
await c.advance(0);
await c.advance(19_999); assert.equal(calls.length, 1);
await c.advance(1); assert.deepEqual(calls, [true, false]);

// 429 schedules only one retry; re-entry/reload cannot reset that budget.
let rejected = 0;
const limited = { ...request('limited'), commit: async () => { rejected++;
  throw Object.assign(Error('limited'), { code: 'RATE_LIMITED', retryAfterMs: 86_400_000 }); } };
c.queueExploreFollowFinalState380(limited);
await c.advance(30_000); assert.equal(rejected, 1);
let record = c.readPendingExploreFollowIntents380('viewer')[0];
assert.equal(record.notBefore - now, 86_400_000, 'daily Retry-After must not be capped to one hour');
const restored = client();
const restore = () => ({ ...limited, ...record, restoredNotBefore: record.notBefore,
  restoredUpdatedAt: record.updatedAt, restoredRetryUsed: record.retryUsed, restoredSuspended: record.suspended,
  initialDelayMs: Math.max(0, record.notBefore - now) });
restored.queueExploreFollowFinalState380(restore());
await restored.advance(86_400_000 - 1); assert.equal(rejected, 1);
await restored.advance(1); assert.equal(rejected, 2);
record = restored.readPendingExploreFollowIntents380('viewer')[0]; assert.equal(record.suspended, true);
const reloadAgain = client(); reloadAgain.queueExploreFollowFinalState380(restore());
await reloadAgain.advance(2 * 86_400_000); assert.equal(rejected, 2);
await reloadAgain.flushPendingExploreFollowsForPageExit380(); assert.equal(rejected, 2);
reloadAgain.queueExploreFollowFinalState380({ ...request('limited'), desiredFollowing: false });
await reloadAgain.advance(30_000); assert.equal(reloadAgain.readPendingExploreFollowIntents380('viewer').length, 0);

// Re-entry without a new click does not move a pending deadline.
const remount = client(); remount.queueExploreFollowFinalState380(request('remount'));
await remount.advance(20_000);
const stored = remount.readPendingExploreFollowIntents380('viewer')[0];
remount.queueExploreFollowFinalState380({ ...request('remount'), restoredUpdatedAt: stored.updatedAt });
await remount.advance(10_000); assert.equal(calls.at(-1), true);
assert.equal(remount.readPendingExploreFollowIntents380('viewer').length, 0);

const followOnly389 = process.argv.includes('--follow-only');
if (!followOnly389) {
// Execute the existing like flush with isolated dependencies. No production state-machine rewrite.
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const ast = ts.createSourceFile('like.ts', like, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const requestNode = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations[0]?.name.getText(ast) === 'requestExploreLike');
const flushNode = ast.statements.find(n => ts.isExpressionStatement(n) && n.expression.getText(ast).startsWith('flushPendingLikes ='));
assert.ok(requestNode && flushNode);
let outbox, posts = 0, rebaseCalls = 0, newerClick = true;
const likeContext = vm.createContext({ console, fetch: async () => { posts++;
  // A newer click returned to the canonical baseline while the prior request was in flight.
  if (newerClick) outbox.t = { ...outbox.t, desiredLiked: false, updatedAt: now + 1 };
  return { ok: false, status: 429, headers: { get: () => '120' }, json: async () => ({ error: { code: 'RATE_LIMITED', message: 'limited' } }) };
}, EXPLORE_API_BASE: '', buildAuthHeaders: async () => ({}), recordCloudflareResponse: () => {},
  inflightByUid: new Map(), readLikeOutbox: () => structuredClone(outbox), persistLikeOutbox: (_, value) => { outbox = value; },
  readLikeCanonicalRevisions172: () => ({}), EXPLORE_LIKE_BATCH_MAX: 50,
  rebaseExploreLikeAfterInFlight127: () => { rebaseCalls++; throw Error('429 must never rebase'); },
  dispatchLikeSyncError: () => {}, getPendingExploreLikeMutationCount: () => Object.keys(outbox).length,
  schedulePendingFlush: () => {},
});
vm.runInContext('let flushPendingLikes;\n' + ts.transpileModule(requestNode.getText(ast) + '\n' + flushNode.getText(ast),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nglobalThis.flush = flushPendingLikes;', likeContext);
const pendingLike = { trackId: 't', desiredLiked: true, baseLiked: false, updatedAt: now, queuedAt: now,
  retryCount: 0, operationId: 'operation_123456789', expectedRevision: 0, optimisticLikeCount: 1 };
outbox = { t: { ...pendingLike, desiredLiked: false } };
await likeContext.flush({ uid: 'viewer' }); assert.equal(posts, 0); assert.deepEqual(outbox, {});
outbox = { t: { ...pendingLike } };
await likeContext.flush({ uid: 'viewer' }); assert.equal(posts, 1); assert.equal(rebaseCalls, 0);
assert.equal(outbox.t.baseLiked, false); assert.equal(outbox.t.desiredLiked, false);
await likeContext.flush({ uid: 'viewer' }); assert.equal(posts, 1); assert.deepEqual(outbox, {});
newerClick = false;
outbox = { t: { ...pendingLike } };
await likeContext.flush({ uid: 'viewer' }); assert.equal(posts, 2);
assert.equal(outbox.t.retryCount, 1);
await likeContext.flush({ uid: 'viewer' }); assert.equal(posts, 2, '429 is not automatically replayed');

}

// The ordered protocol must discard only a known rejected operation. Otherwise
// a cooldown retry for the newest intent would send the old opposite intent first.
const protocolContext = vm.createContext({ exports: {}, crypto: { randomUUID: () => 'operation_' + now++ } });
vm.runInContext(ts.transpileModule(readFileSync('src/services/exploreFollowOrdering354.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, protocolContext);
const methods = [];
const protocolRequest = async (path, init) => {
  if (path.endsWith('follow-state')) return { data: { followProtocol: 354, followRevision: 0 } };
  if (!init.body) throw Object.assign(Error('ordered'), { code: 'FOLLOW_ORDER_REQUIRED' });
  methods.push(init.method);
  if (methods.length === 1) throw Object.assign(Error('limited'), { code: 'RATE_LIMITED' });
  return { data: { revision: 1, following: false } };
};
await assert.rejects(() => protocolContext.exports.requestOrderedExploreFollow354('v', 't', true, protocolRequest));
await protocolContext.exports.requestOrderedExploreFollow354('v', 't', false, protocolRequest);
assert.deepEqual(methods, ['PUT', 'DELETE']);
console.log('APP380_FOLLOW_TIMERS_NET_ZERO_INFLIGHT_RELOAD_RETRY_BUDGET=PASS');
if (!followOnly389) console.log('APP380_LIKE_NET_ZERO_AND_DETERMINISTIC_429_NO_FALSE_REBASE=PASS');
console.log('APP380_NAVIGATION_FLUSH_ZERO=PASS');

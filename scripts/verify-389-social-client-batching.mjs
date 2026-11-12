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
assert.equal(c.EXPLORE_FOLLOW_IDLE_FLUSH_MS_380, 30_000);
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
await c.advance(5_000);
c.queueExploreFollowFinalState380(request());
await c.advance(3_000); assert.equal(calls.length, 0);
await c.advance(27_000); assert.deepEqual(calls, [true]);
assert.equal(settled[0].baseTargetFollowerCount, 4, 'stale server count is not the local authority');

// In-flight last click gets a new baseline and keeps its own last-click deadline.
let resolve;
c.queueExploreFollowFinalState380({ ...request('flight'), commit: () => new Promise(r => { resolve = r; }) });
await c.advance(30_000);
c.queueExploreFollowFinalState380(request('flight', false));
await c.advance(3_000);
resolve({ isFollowing: true, followerCount: 0, followingCount: 0 });
await c.advance(0);
await c.advance(26_999); assert.equal(calls.length, 1);
await c.advance(1); assert.deepEqual(calls, [true, false]);

// 429 schedules only one retry. After a second rejection the server has not
// changed the canonical edge, so the app must rollback visibly instead of
// persisting a suspended optimistic state forever. An old suspended record
// recovered from storage must also fail safely without a new server write.
let rejected = 0, terminalErrors = [], deferred = [];
const limited = { ...request('limited'), commit: async () => { rejected++;
  throw Object.assign(Error('limited'), { code: 'RATE_LIMITED', retryAfterMs: 86_400_000 }); },
  onError: value => terminalErrors.push(value),
  onDeferred: delay => deferred.push(delay),
};
c.queueExploreFollowFinalState380(limited);
await c.advance(30_000); assert.equal(rejected, 1);
const record = c.readPendingExploreFollowIntents380('viewer')[0];
assert.equal(record.notBefore - now, 86_400_000, 'daily Retry-After must not be capped to one hour');
assert.equal(record.suspended, false);
assert.deepEqual(deferred, [86_400_000], 'cooldown must be shown as pending');
const restored = client();
const restore = row => ({ ...limited, ...row, restoredNotBefore: row.notBefore,
  restoredUpdatedAt: row.updatedAt, restoredRetryUsed: row.retryUsed, restoredSuspended: row.suspended,
  initialDelayMs: Math.max(0, row.notBefore - now) });
restored.queueExploreFollowFinalState380(restore(record));
await restored.advance(86_400_000 - 1); assert.equal(rejected, 1);
await restored.advance(1); assert.equal(rejected, 2);
assert.equal(terminalErrors.length, 1, 'exhausted retry must be surfaced');
assert.equal(terminalErrors[0].baseFollowing, false);
assert.equal(restored.readPendingExploreFollowIntents380('viewer').length, 0,
  'must not keep a false optimistic state suspended forever');
const reloadAgain = client();
reloadAgain.queueExploreFollowFinalState380(restore({ ...record, suspended: true, retryUsed: true }));
assert.equal(terminalErrors.length, 2, 'legacy suspended state must be restored to base');
assert.equal(reloadAgain.readPendingExploreFollowIntents380('viewer').length, 0);
await reloadAgain.advance(2 * 86_400_000); assert.equal(rejected, 2);
await reloadAgain.flushPendingExploreFollowsForPageExit380(); assert.equal(rejected, 2);
reloadAgain.queueExploreFollowFinalState380({ ...request('limited'), desiredFollowing: false });
await reloadAgain.advance(30_000); assert.equal(reloadAgain.readPendingExploreFollowIntents380('viewer').length, 0);

// Re-entry without a new click does not move a pending deadline.
const remount = client(); remount.queueExploreFollowFinalState380(request('remount'));
await remount.advance(4_000);
const stored = remount.readPendingExploreFollowIntents380('viewer')[0];
remount.queueExploreFollowFinalState380({ ...request('remount'), restoredUpdatedAt: stored.updatedAt });
await remount.advance(26_000); assert.equal(calls.at(-1), true);
assert.equal(remount.readPendingExploreFollowIntents380('viewer').length, 0);


 // Immediate mode: one user click requests a canonical commit at next tick.
 const instant = client(), instantCalls = [];
 const instantReq = (id, desired = true) => ({
   ...request(id, desired), viewerUid: 'instant-actor', immediate: true,
   commit: async value => { instantCalls.push([id, value]);
     return {isFollowing: value, followerCount: 5, followingCount: 8}; },
 });
 instant.queueExploreFollowFinalState380(instantReq('now'));
 await instant.advance(0);
 assert.deepEqual(instantCalls, [['now', true]], 'IMMEDIATE_NO_30_SECOND_WAIT');
 // Opposite taps before dispatch still net to the confirmed baseline W0.
 instant.queueExploreFollowFinalState380(instantReq('undo', true));
 instant.queueExploreFollowFinalState380(instantReq('undo', false));
 await instant.advance(0);
 assert.deepEqual(instantCalls, [['now', true]], 'IMMEDIATE_NET_ZERO_W0');
 assert.equal(instant.readPendingExploreFollowIntents380('instant-actor').length, 0);
 // A 429 must be an immediate, visible rollback, not a new waiting period.
 const blocked = client(); let attempts = 0; const failures = [];
 blocked.queueExploreFollowFinalState380({
   ...instantReq('blocked'),
   commit: async () => { attempts++; throw Object.assign(Error('blocked'),
     {code: 'RATE_LIMITED', retryAfterMs: 86_400_000}); },
   onError: value => failures.push(value),
 });
 await blocked.advance(0);
 assert.equal(attempts, 1);
 assert.equal(failures.length, 1, 'IMMEDIATE_RATE_LIMIT_ROLLBACK');
 assert.match(failures[0].error.message, /서버에서 팔로우 변경을 제한/);
 assert.equal(blocked.readPendingExploreFollowIntents380('instant-actor').length, 0);
 await blocked.advance(86_400_000);
 assert.equal(attempts, 1, 'IMMEDIATE_COOLDOWN_DOES_NOT_RETRY');

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
console.log('APP585_FOLLOW_30S_LEGACY_TIMERS_NET_ZERO_INFLIGHT_RELOAD_RETRY_BUDGET=PASS');
console.log('APP380_389_EXHAUSTED_429_ROLLBACK_AND_LEGACY_SUSPENDED_REPAIR=PASS');
if (!followOnly389) console.log('APP380_LIKE_NET_ZERO_AND_DETERMINISTIC_429_NO_FALSE_REBASE=PASS');
console.log('APP380_NAVIGATION_FLUSH_ZERO=PASS');

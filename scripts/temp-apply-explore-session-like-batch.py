from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)

# --- exploreLikeService.ts ---
p = 'src/services/exploreLikeService.ts'
s = read(p)
s = once(s,
    "import { EXPLORE_API_BASE, EXPLORE_ENVIRONMENT } from '../config/exploreEnvironment';",
    "import { EXPLORE_API_BASE } from '../config/exploreEnvironment';",
    'remove environment timer import')
s = once(s,
    "// SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915\n",
    "// SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915\n// SORIDRAW_EXPLORE_SESSION_BATCH_094_20260915\n// SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915\n",
    'add 094 markers')
s = once(s,
    "const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 5_000;\nconst EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 5_000;\nconst EXPLORE_LIKE_BATCH_WINDOW_MS = EXPLORE_ENVIRONMENT === 'preview'\n  ? EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS\n  : EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS;\nconst EXPLORE_LIKE_BATCH_MAX = 50;\nconst EXPLORE_LIKE_RETRY_BASE_MS = 15_000;\nconst EXPLORE_LIKE_RETRY_MAX_MS = 60_000;",
    "const EXPLORE_LIKE_BATCH_MAX = 50;",
    'remove five second/retry timers')
s = once(s,
    "  acceptExploreLikeDisplayTransition091,\n  beginExploreLikeDisplayTransition091,",
    "  confirmExploreLikeDisplayTransition094,\n  rebaseExploreLikePendingDisplay094,\n  beginExploreLikeDisplayTransition091,",
    'switch display imports')
s = once(s,
    "const pendingTimers = new Map<string, number>();\n",
    "",
    'remove pending timer map')
start = s.index('const clearPendingLikeTimer = (uid: string) => {')
end = s.index('const normalizeBatchResults =', start)
s = s[:start] + s[end:]
s = once(s,
    "  if (!batchEntries.length) {\n    clearPendingLikeTimer(uid);\n    return;\n  }",
    "  if (!batchEntries.length) return;",
    'remove empty timer cleanup')
old_loop = """      const latest = latestOutbox[pending.trackId];
      // 069: heart state can sync promptly, but public numeric count is
      // authoritative only after the deferred aggregate. Never manufacture +/-.
      let visibleLiked = pending.desiredLiked;
      let ownerUid = pending.ownerUid;

      const hasNewerPending = Boolean(latest && latest.updatedAt !== pending.updatedAt);
      if (hasNewerPending && latest) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        latest.baseLikeCount = getExploreLikeCanonicalCount091(uid, result.trackId, latest.baseLikeCount);
        latest.retryCount = 0;
        visibleLiked = latest.desiredLiked;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
          acceptExploreLikeDisplayTransition091(uid, result.trackId, visibleLiked);
        } else {
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
        acceptExploreLikeDisplayTransition091(uid, result.trackId, result.liked);
      }

      const displayLikeCount = getExploreLikeDisplayCount091(uid, result.trackId, pending.optimisticLikeCount);
      const visibleResult = {
        trackId: result.trackId,
        liked: visibleLiked,
        likeCount: result.likeCount,
        displayLikeCount,
      };
      accountSyncResults.push(visibleResult);
      accountReplayResults.push({ ...visibleResult, ownerUid });
      dispatchLikeSync({
        uid,
        ...visibleResult,
        ownerUid,
      });
"""
new_loop = """      const latest = latestOutbox[pending.trackId];
      // 094: once this exact queued transition is acknowledged, keep its
      // visible +/- delta stable until the deferred public aggregate catches up.
      // This is not a liked=>1 guess: the value comes from the acknowledged
      // transition's own base count + actual state change.
      const acknowledgedDisplayLikeCount = clampLikeCount(
        pending.baseLikeCount + Number(result.liked) - Number(pending.baseLiked),
      );
      let visibleLiked = result.liked;
      let visibleDisplayLikeCount = acknowledgedDisplayLikeCount;
      let ownerUid = pending.ownerUid;

      const hasNewerPending = Boolean(latest && latest.updatedAt !== pending.updatedAt);
      if (hasNewerPending && latest) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        latest.baseLikeCount = acknowledgedDisplayLikeCount;
        latest.retryCount = 0;
        visibleLiked = latest.desiredLiked;
        visibleDisplayLikeCount = rebaseExploreLikePendingDisplay094(
          uid,
          result.trackId,
          ownerUid,
          result.liked,
          latest.desiredLiked,
          acknowledgedDisplayLikeCount,
        );
        latest.optimisticLikeCount = visibleDisplayLikeCount;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
          visibleDisplayLikeCount = confirmExploreLikeDisplayTransition094(
            uid,
            result.trackId,
            ownerUid,
            pending.baseLiked,
            result.liked,
            pending.baseLikeCount,
            acknowledgedDisplayLikeCount,
          );
        } else {
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
        visibleDisplayLikeCount = confirmExploreLikeDisplayTransition094(
          uid,
          result.trackId,
          ownerUid,
          pending.baseLiked,
          result.liked,
          pending.baseLikeCount,
          acknowledgedDisplayLikeCount,
        );
      }

      // Cross-device RTDB carries only the server-acknowledged transition.
      // A newer local click remains local/outbox until its own boundary flush.
      const confirmedResult = {
        trackId: result.trackId,
        liked: result.liked,
        likeCount: result.likeCount,
        displayLikeCount: acknowledgedDisplayLikeCount,
      };
      accountSyncResults.push(confirmedResult);
      accountReplayResults.push({ ...confirmedResult, ownerUid });
      dispatchLikeSync({
        uid,
        trackId: result.trackId,
        ownerUid,
        liked: visibleLiked,
        likeCount: result.likeCount,
        displayLikeCount: visibleDisplayLikeCount,
      });
"""
s = once(s, old_loop, new_loop, 'replace acknowledged result loop')
s = once(s,
    "    await publishExploreLikeAccountSyncSignal(user, batchEntries, accountSyncResults);\n    if (Object.keys(latestOutbox).length) schedulePendingLikes(user, undefined, true);",
    "    await publishExploreLikeAccountSyncSignal(user, batchEntries, accountSyncResults);",
    'remove post-success timer scheduling')
old_catch = """  } catch (reason) {
    const latestOutbox = readLikeOutbox(uid);
    let maxRetryCount = 0;
    let firstPending: ExploreLikePendingMutation | null = null;
    for (const pending of batchEntries) {
      const latest = latestOutbox[pending.trackId] || pending;
      if (latest.updatedAt === pending.updatedAt) {
        latest.retryCount = Math.min(8, latest.retryCount + 1);
        // Keep updatedAt stable across retries because 069 uses it in the
        // idempotent chronological queue key.
        latestOutbox[pending.trackId] = latest;
      }
      maxRetryCount = Math.max(maxRetryCount, latest.retryCount);
      firstPending ||= latest;
    }
    persistLikeOutbox(uid, latestOutbox);
    const retryDelay = Math.min(
      EXPLORE_LIKE_RETRY_MAX_MS,
      EXPLORE_LIKE_RETRY_BASE_MS * (2 ** Math.max(0, maxRetryCount - 1)),
    );

    if (firstPending) {
      dispatchLikeSyncError({
        uid,
        trackId: firstPending.trackId,
        ownerUid: firstPending.ownerUid,
        liked: firstPending.desiredLiked,
        likeCount: firstPending.optimisticLikeCount,
        message: reason instanceof Error ? reason.message : '좋아요 서버 동기화를 재시도하고 있어요.',
      });
    }
"""
new_catch = """  } catch (reason) {
    const latestOutbox = readLikeOutbox(uid);
    let firstPending: ExploreLikePendingMutation | null = null;
    for (const pending of batchEntries) {
      const latest = latestOutbox[pending.trackId] || pending;
      if (latest.updatedAt === pending.updatedAt) {
        latest.retryCount = Math.min(8, latest.retryCount + 1);
        // Keep updatedAt stable for idempotent replay. 094 deliberately has no
        // retry timer: the durable outbox retries at the next meaningful boundary.
        latestOutbox[pending.trackId] = latest;
      }
      firstPending ||= latest;
    }
    persistLikeOutbox(uid, latestOutbox);

    if (firstPending) {
      dispatchLikeSyncError({
        uid,
        trackId: firstPending.trackId,
        ownerUid: firstPending.ownerUid,
        liked: firstPending.desiredLiked,
        likeCount: firstPending.optimisticLikeCount,
        message: reason instanceof Error ? reason.message : '좋아요 변경분을 기기에 보관했습니다. 다음 화면 이동 때 다시 동기화합니다.',
      });
    }
"""
s = once(s, old_catch, new_catch, 'remove timed retry catch')
old_boundary = """export const flushPendingExploreLikesForPageExit = async (user: User): Promise<void> => {
  clearPendingLikeTimer(user.uid);
  await flushPendingLikes(user);
  if (getPendingExploreLikeMutationCount(user.uid) > 0) {
    throw new Error('좋아요 변경분을 서버에 반영하지 못했습니다. 다음 페이지 이동 또는 재접속에서 다시 시도합니다.');
  }
};

const resumePendingLikes = (user: User) => {
  const outbox = readLikeOutbox(user.uid);
  if (!Object.keys(outbox).length) {
    clearPendingLikeTimer(user.uid);
    return;
  }
  schedulePendingLikes(user);
};
"""
new_boundary = """const waitForExploreLikeInflight094 = async (uid: string) => {
  const startedAt = Date.now();
  while (inflightByUid.has(uid) && Date.now() - startedAt < 5_000) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
  }
};

export const flushPendingExploreLikesForPageExit = async (user: User): Promise<void> => {
  await waitForExploreLikeInflight094(user.uid);
  let previousPending = Number.POSITIVE_INFINITY;
  while (true) {
    const pending = getPendingExploreLikeMutationCount(user.uid);
    if (pending <= 0) return;
    if (pending >= previousPending) {
      throw new Error('좋아요 변경분을 서버에 반영하지 못했습니다. 다음 페이지 이동 또는 재접속에서 다시 시도합니다.');
    }
    previousPending = pending;
    await flushPendingLikes(user);
    await waitForExploreLikeInflight094(user.uid);
  }
};
"""
s = once(s, old_boundary, new_boundary, 'replace boundary flush')
s = once(s,
    "  if (!normalized.length) return [];\n  resumePendingLikes(user);\n\n  const cache = getLikedStateCache(user.uid);",
    "  if (!normalized.length) return [];\n\n  // 094: reading/hydrating Explore must never flush the durable outbox.\n  const cache = getLikedStateCache(user.uid);",
    'remove read-triggered flush')
s = once(s,
    "    persistLikeOutbox(user.uid, outbox);\n    if (!Object.keys(outbox).length) clearPendingLikeTimer(user.uid);\n    return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };",
    "    persistLikeOutbox(user.uid, outbox);\n    return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };",
    'remove net-zero timer cleanup')
s = once(s,
    "  persistLikeOutbox(user.uid, outbox);\n  schedulePendingLikes(user);\n  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };",
    "  persistLikeOutbox(user.uid, outbox);\n  // 094: ordinary browsing is local-only. The only automatic flush inside the\n  // Explore session is the hard 50-change batch ceiling.\n  if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {\n    void flushPendingLikes(user);\n  }\n  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };",
    'replace click timer with batch ceiling')
write(p, s)

# --- display state service ---
p = 'src/services/exploreLikeDisplayStateService.ts'
s = read(p)
s = once(s,
    "// SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915\n",
    "// SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915\n// SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915\n",
    'display marker')
old_update = """  rows.forEach((row) => {
    const trackId = normalizeTrackId091(row.trackId);
    if (!trackId) return;
    counts.set(trackId, clampCount091(row.likeCount));
    if (confirmAccepted && states.get(trackId)?.phase === 'accepted') {
      states.delete(trackId);
      stateChanged = true;
    }
  });
"""
new_update = """  rows.forEach((row) => {
    const trackId = normalizeTrackId091(row.trackId);
    if (!trackId) return;
    const canonicalCount = clampCount091(row.likeCount);
    counts.set(trackId, canonicalCount);
    const state = states.get(trackId);
    if (state?.phase !== 'accepted') return;
    const direction = Number(state.desiredLiked) - Number(state.baseLiked);
    const aggregateCaughtUp = direction > 0
      ? canonicalCount >= state.displayLikeCount
      : direction < 0
        ? canonicalCount <= state.displayLikeCount
        : canonicalCount === state.displayLikeCount;
    if (aggregateCaughtUp || confirmAccepted) {
      states.delete(trackId);
      stateChanged = true;
    }
  });
"""
s = once(s, old_update, new_update, 'canonical convergence')
anchor = """export const acceptExploreLikeDisplayTransition091 = (
  uid: string,
  trackId: string,
  liked: boolean,
) => {
"""
idx = s.index(anchor)
new_functions = """export const confirmExploreLikeDisplayTransition094 = (
  uid: string,
  trackId: string,
  ownerUid: string,
  baseLiked: boolean,
  liked: boolean,
  baseLikeCount: number,
  displayLikeCount: number,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  const confirmedCount = clampCount091(displayLikeCount);
  if (!normalizedUid || !normalizedTrackId) return confirmedCount;
  const states = loadStates091(normalizedUid);
  const now = Date.now();
  states.set(normalizedTrackId, {
    trackId: normalizedTrackId,
    ownerUid: normalizeUid091(ownerUid),
    baseLiked: Boolean(baseLiked),
    desiredLiked: Boolean(liked),
    baseLikeCount: clampCount091(baseLikeCount),
    displayLikeCount: confirmedCount,
    phase: 'accepted',
    updatedAt: now,
    expiresAt: now + DISPLAY_TTL_MS_091,
  });
  persistStates091(normalizedUid, states);
  return confirmedCount;
};

export const rebaseExploreLikePendingDisplay094 = (
  uid: string,
  trackId: string,
  ownerUid: string,
  baseLiked: boolean,
  desiredLiked: boolean,
  baseLikeCount: number,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  const baseCount = clampCount091(baseLikeCount);
  const displayLikeCount = clampCount091(baseCount + Number(desiredLiked) - Number(baseLiked));
  if (!normalizedUid || !normalizedTrackId) return displayLikeCount;
  const states = loadStates091(normalizedUid);
  if (baseLiked === desiredLiked) {
    states.delete(normalizedTrackId);
    persistStates091(normalizedUid, states);
    return displayLikeCount;
  }
  const now = Date.now();
  states.set(normalizedTrackId, {
    trackId: normalizedTrackId,
    ownerUid: normalizeUid091(ownerUid),
    baseLiked,
    desiredLiked,
    baseLikeCount: baseCount,
    displayLikeCount,
    phase: 'pending',
    updatedAt: now,
    expiresAt: now + DISPLAY_TTL_MS_091,
  });
  persistStates091(normalizedUid, states);
  return displayLikeCount;
};

"""
s = s[:idx] + new_functions + s[idx:]
write(p, s)

# --- ExplorePage.tsx: profile boundary flush ---
p = 'src/pages/ExplorePage.tsx'
s = read(p)
s = once(s,
    "  getExploreLikedTrackIds,\n  reconcileExploreLikedTrackCollectionState,\n  setExploreTrackLike,",
    "  flushPendingExploreLikesForPageExit,\n  getExploreLikedTrackIds,\n  reconcileExploreLikedTrackCollectionState,\n  setExploreTrackLike,",
    'import boundary flush')
s = once(s,
    "  const openProfile = (track: ExploreTrack) => {\n    if (!track.ownerUid) return;\n    setSearchParams({ profile: track.ownerUid });\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n  };\n\n  const closeProfile = () => {\n    setSearchParams({});\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n  };",
    "  const flushExploreLikeBoundary094 = async () => {\n    if (!user) return;\n    try {\n      await flushPendingExploreLikesForPageExit(user);\n    } catch (reason) {\n      console.warn('[094] Explore like boundary sync retained locally:', reason);\n      setSocialNotice('좋아요 변경분은 기기에 보관됐어요. 다음 화면 이동 때 다시 동기화합니다.');\n    }\n  };\n\n  const openProfile = async (track: ExploreTrack) => {\n    if (!track.ownerUid) return;\n    await flushExploreLikeBoundary094();\n    setSearchParams({ profile: track.ownerUid });\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n  };\n\n  const closeProfile = async () => {\n    await flushExploreLikeBoundary094();\n    setSearchParams({});\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n  };",
    'profile boundaries')
write(p, s)

# --- ExploreShell.tsx: route/background boundary ---
p = 'src/components/explore/ExploreShell.tsx'
s = read(p)
s = once(s,
    "  useEffect(() => {\n    if (!user?.uid) return;\n    const activeUser = user;\n    return () => {\n      void flushSoridrawPageSync(activeUser, 'route-change')\n        .catch((error) => console.warn('[081] Explore page sync pending:', error));\n    };\n  }, [user?.uid]);",
    "  useEffect(() => {\n    if (!user?.uid) return;\n    const activeUser = user;\n    const flushWhenHidden = () => {\n      if (document.visibilityState !== 'hidden') return;\n      void flushSoridrawPageSync(activeUser, 'route-change')\n        .catch((error) => console.warn('[094] Explore background sync retained locally:', error));\n    };\n    document.addEventListener('visibilitychange', flushWhenHidden);\n    return () => {\n      document.removeEventListener('visibilitychange', flushWhenHidden);\n      void flushSoridrawPageSync(activeUser, 'route-change')\n        .catch((error) => console.warn('[081] Explore page sync pending:', error));\n    };\n  }, [user?.uid]);",
    'background boundary')
s = once(s,
    "  const go = (path: string) => {\n    if (`${location.pathname}${location.search}` === path) {\n      window.scrollTo({ top: 0, behavior: 'smooth' });\n      return;\n    }\n    navigate(path);\n  };",
    "  const go = async (path: string) => {\n    if (`${location.pathname}${location.search}` === path) {\n      window.scrollTo({ top: 0, behavior: 'smooth' });\n      return;\n    }\n    if (user?.uid) {\n      await flushSoridrawPageSync(user, 'route-change')\n        .catch((error) => console.warn('[094] Explore route sync retained locally:', error));\n    }\n    navigate(path);\n  };",
    'proactive route boundary')
s = once(s,
    "      onLogout={async () => {\n        await signOut(auth);\n        go('/');\n      }}",
    "      onLogout={async () => {\n        if (user?.uid) {\n          await flushSoridrawPageSync(user, 'route-change')\n            .catch((error) => console.warn('[094] Explore logout sync retained locally:', error));\n        }\n        await signOut(auth);\n        navigate('/');\n      }}",
    'logout boundary')
write(p, s)

# --- update existing cost verifier ---
p = 'scripts/verify-explore-like-cost-optimization.mjs'
s = read(p)
s = once(s,
    "const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');",
    "const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');\nconst shell = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');\nconst displayState = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');",
    'verifier imports')
start = s.index('// 089 correctness contract:')
end = s.index("\nassert.ok(Array.isArray(manifest.patches));", start)
new_contract = r'''// 094 correctness contract: Explore browsing is local-first. Recommended/latest/popular
// never start a timer; one batch is sent only at a meaningful boundary or the hard max-50 ceiling.
assert.match(service, /SORIDRAW_EXPLORE_SESSION_BATCH_094_20260915/);
assert.match(service, /SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915/);
assert.match(service, /const EXPLORE_LIKE_BATCH_MAX = 50;/);
assert.match(service, /EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox'/);
assert.match(service, /EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches'/);
assert.doesNotMatch(service, /EXPLORE_LIKE_BATCH_WINDOW_(?:PREVIEW|DEFAULT)_MS/);
assert.doesNotMatch(service, /EXPLORE_LIKE_BATCH_WINDOW_MS/);
assert.doesNotMatch(service, /schedulePendingLikes/);
assert.doesNotMatch(service, /pendingTimers/);
assert.doesNotMatch(service, /EXPLORE_LIKE_RETRY_(?:BASE|MAX)_MS/);
const queueFunction = functionText(service, 'export const setExploreTrackLike = async');
assert.doesNotMatch(queueFunction, /requestExploreLike\(/, 'like click must stay local-only');
assert.match(queueFunction, /getPendingExploreLikeMutationCount\(user\.uid\) >= EXPLORE_LIKE_BATCH_MAX/);
assert.match(queueFunction, /void flushPendingLikes\(user\)/, 'only max-50 may auto flush inside Explore');
const hydrateFunction = functionText(service, 'export const getExploreLikedTrackIds = async');
assert.doesNotMatch(hydrateFunction, /flushPendingLikes|flushPendingExploreLikesForPageExit|schedulePendingLikes/);
const flushFunction = functionText(service, 'const flushPendingLikes = async');
assert.match(flushFunction, /'\/v1\/me\/likes\/batch'/);
assert.match(flushFunction, /acknowledgedDisplayLikeCount/);
assert.match(flushFunction, /confirmExploreLikeDisplayTransition094/);
assert.match(flushFunction, /publishExploreLikeAccountSyncSignal\(user, batchEntries, accountSyncResults\)/);
const boundaryFunction = functionText(service, 'export const flushPendingExploreLikesForPageExit = async');
assert.match(boundaryFunction, /while \(true\)/);
assert.match(page, /await flushPendingExploreLikesForPageExit\(user\)/, 'public profile boundary must flush once before navigation');
const sortBlockStart = page.indexOf("['recommended', '추천']");
const sortBlock = page.slice(sortBlockStart, sortBlockStart + 1200);
assert.doesNotMatch(sortBlock, /flushPendingExploreLikesForPageExit|flushSoridrawPageSync/, 'recommended/latest/popular stay local-only');
assert.match(shell, /document\.visibilityState !== 'hidden'/);
assert.match(shell, /await flushSoridrawPageSync\(user, 'route-change'\)/);
assert.match(displayState, /SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915/);
assert.match(displayState, /export const confirmExploreLikeDisplayTransition094/);
assert.match(displayState, /aggregateCaughtUp/);
console.log('PASS client: 094 keeps Explore browsing local-only, batches at boundaries/max-50, and retains acknowledged count deltas until aggregate convergence');
'''
s = s[:start] + new_contract + s[end:]
write(p, s)

# --- dedicated regression verifier ---
p = Path('scripts/verify-094-explore-session-like-batch.mjs')
p.write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const display = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const shell = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');

assert.match(service, /SORIDRAW_EXPLORE_SESSION_BATCH_094_20260915/);
assert.doesNotMatch(service, /5_000[^\n]*batch|BATCH_WINDOW|schedulePendingLikes|pendingTimers/);
assert.match(service, /getPendingExploreLikeMutationCount\(user\.uid\) >= EXPLORE_LIKE_BATCH_MAX/);
assert.match(service, /const acknowledgedDisplayLikeCount = clampLikeCount\(/);
assert.match(service, /pending\.baseLikeCount \+ Number\(result\.liked\) - Number\(pending\.baseLiked\)/);
assert.match(service, /displayLikeCount: acknowledgedDisplayLikeCount/);
assert.match(service, /retry timer: the durable outbox retries at the next meaningful boundary/);
assert.match(display, /confirmExploreLikeDisplayTransition094/);
assert.match(display, /rebaseExploreLikePendingDisplay094/);
assert.match(display, /aggregateCaughtUp/);
assert.match(page, /const flushExploreLikeBoundary094 = async/);
assert.equal((page.match(/await flushExploreLikeBoundary094\(\)/g) || []).length, 2, 'enter/leave public profile must both flush');
const tabs = page.slice(page.indexOf("['recommended', '추천']"), page.indexOf("['recommended', '추천']") + 1400);
assert.doesNotMatch(tabs, /flushExploreLikeBoundary094|flushPendingExploreLikesForPageExit/);
assert.match(shell, /visibilityState !== 'hidden'/);
assert.match(shell, /await flushSoridrawPageSync\(user, 'route-change'\)/);
assert.doesNotMatch(service, /updateDoc\(|users\//, 'Explore like sync must not reintroduce Firestore user writes');
console.log('PASS 094: session-boundary like batching, durable local browsing, max-50 safety flush, RTDB acknowledged count replay, and no Firestore sync write.');
''', encoding='utf-8')

print('EXPLORE_SESSION_LIKE_094_PATCH=APPLIED')

// SORIDRAW_EXPLORE_FOLLOW_LOCAL_FIRST_BATCH_380_20261007
// Existing legacy batches retain their 30-second final-state window.
// Visible Follow/Unfollow clicks opt into immediate server settlement, while
// reusing the same in-flight last-choice guard and net-zero write protection.
//
// This module intentionally owns only timing/settlement orchestration. Product
// caches and RTDB convergence remain in ExplorePage/exploreSocialService.

export const EXPLORE_FOLLOW_IDLE_FLUSH_MS_380 = 30_000;

export type ExploreFollowCommitResult380 = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  actorFollowingCount?: number;
};

export type ExploreFollowBatchBase380 = {
  baseFollowing: boolean;
  baseTargetFollowerCount: number;
  baseTargetFollowingCount: number;
  baseActorFollowingCount: number | null;
};

export type ExploreFollowPendingRecord380 = ExploreFollowBatchBase380 & {
  viewerUid: string;
  targetUid: string;
  desiredFollowing: boolean;
  immediate?: boolean;
  targetProfile: {
    uid: string;
    nickname: string;
    avatarUrl: string;
    handle: string;
  };
  updatedAt: number;
  notBefore: number;
  retryUsed: boolean;
  suspended: boolean;
};

export type ExploreFollowBatchSettlement380 = ExploreFollowBatchBase380 & {
  viewerUid: string;
  targetUid: string;
  desiredFollowing: boolean;
  targetProfile: {
    uid: string;
    nickname: string;
    avatarUrl: string;
    handle: string;
  };
  result: ExploreFollowCommitResult380;
};

type ExploreFollowBatchError380 = ExploreFollowBatchBase380 & {
  viewerUid: string;
  targetUid: string;
  desiredFollowing: boolean;
  error: unknown;
};

type ExploreFollowBatchRequest380 = ExploreFollowBatchBase380 & {
  viewerUid: string;
  targetUid: string;
  desiredFollowing: boolean;
  immediate?: boolean;
  targetProfile: {
    uid: string;
    nickname: string;
    avatarUrl: string;
    handle: string;
  };
  commit: (following: boolean) => Promise<ExploreFollowCommitResult380>;
  onBusy?: (busy: boolean) => void;
  onSettled: (settlement: ExploreFollowBatchSettlement380) => void;
  onError: (failure: ExploreFollowBatchError380) => void;
  onDeferred?: (retryDelayMs: number) => void;
  initialDelayMs?: number;
  restoredNotBefore?: number;
  restoredUpdatedAt?: number;
  restoredRetryUsed?: boolean;
  restoredSuspended?: boolean;
};

type ExploreFollowBatchEntry380 = ExploreFollowBatchRequest380 & {
  key: string;
  version: number;
  updatedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  inflight: boolean;
  notBefore: number;
  retryUsed: boolean;
  suspended: boolean;
};

const pending380 = new Map<string, ExploreFollowBatchEntry380>();
const EXPLORE_FOLLOW_OUTBOX_KEY_380 = 'soridraw:explore:follow-outbox:380:';

const key380 = (viewerUid: string, targetUid: string) =>
  JSON.stringify([String(viewerUid || '').trim(), String(targetUid || '').trim()]);

const storageKey380 = (viewerUid: string) =>
  `${EXPLORE_FOLLOW_OUTBOX_KEY_380}${String(viewerUid || '').trim()}`;

const readStored380 = (viewerUid: string): Record<string, ExploreFollowPendingRecord380> => {
  if (typeof localStorage === 'undefined') return {};
  const uid = String(viewerUid || '').trim();
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(storageKey380(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, ExploreFollowPendingRecord380>;
  } catch {
    return {};
  }
};

const writeStored380 = (
  viewerUid: string,
  rows: Record<string, ExploreFollowPendingRecord380>,
) => {
  if (typeof localStorage === 'undefined') return;
  const uid = String(viewerUid || '').trim();
  if (!uid) return;
  try {
    const key = storageKey380(uid);
    if (Object.keys(rows).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(rows));
  } catch {}
};

const toRecord380 = (entry: ExploreFollowBatchEntry380): ExploreFollowPendingRecord380 => ({
  viewerUid: entry.viewerUid,
  targetUid: entry.targetUid,
  baseFollowing: entry.baseFollowing,
  baseTargetFollowerCount: entry.baseTargetFollowerCount,
  baseTargetFollowingCount: entry.baseTargetFollowingCount,
  baseActorFollowingCount: entry.baseActorFollowingCount,
  desiredFollowing: entry.desiredFollowing,
  immediate: entry.immediate === true,
  targetProfile: { ...entry.targetProfile },
  updatedAt: entry.updatedAt,
  notBefore: entry.notBefore,
  retryUsed: entry.retryUsed,
  suspended: entry.suspended,
});

const persistEntry380 = (entry: ExploreFollowBatchEntry380) => {
  const rows = readStored380(entry.viewerUid);
  rows[entry.targetUid] = toRecord380(entry);
  writeStored380(entry.viewerUid, rows);
};

const removeStored380 = (viewerUid: string, targetUid: string) => {
  const rows = readStored380(viewerUid);
  if (!Object.prototype.hasOwnProperty.call(rows, targetUid)) return;
  delete rows[targetUid];
  writeStored380(viewerUid, rows);
};

export const readPendingExploreFollowIntents380 = (
  viewerUid: string,
): ExploreFollowPendingRecord380[] => {
  const uid = String(viewerUid || '').trim();
  if (!uid) return [];
  const rows = readStored380(uid);
  return Object.values(rows)
    .filter((row) => row?.viewerUid === uid && String(row?.targetUid || '').trim())
    .sort((a, b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
};

const safeCount380 = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const clearTimer380 = (entry: ExploreFollowBatchEntry380) => {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = null;
};

const retryAfterMs380 = (error: unknown) => {
  const retryAfterMs = Number((error as { retryAfterMs?: unknown })?.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(24 * 60 * 60_000, Math.max(1_000, Math.floor(retryAfterMs)));
  }
  return 60_000;
};

const failExploreFollowPending380 = (entry: ExploreFollowBatchEntry380, error: unknown) => {
  clearTimer380(entry);
  pending380.delete(entry.key);
  removeStored380(entry.viewerUid, entry.targetUid);
  entry.inflight = false;
  entry.onBusy?.(false);
  entry.onError({
    viewerUid: entry.viewerUid,
    targetUid: entry.targetUid,
    desiredFollowing: entry.desiredFollowing,
    baseFollowing: entry.baseFollowing,
    baseTargetFollowerCount: safeCount380(entry.baseTargetFollowerCount),
    baseTargetFollowingCount: safeCount380(entry.baseTargetFollowingCount),
    baseActorFollowingCount: entry.baseActorFollowingCount === null
      ? null : safeCount380(entry.baseActorFollowingCount),
    error,
  });
};

const followRateLimitFailure380 = () =>
  new Error('팔로우 변경을 서버에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');

const schedule380 = (entry: ExploreFollowBatchEntry380, delayMs = entry.immediate ? 0 : EXPLORE_FOLLOW_IDLE_FLUSH_MS_380) => {
  clearTimer380(entry);
  if (entry.suspended) return;
  const requestedDelay = Math.max(0, delayMs);
  const cooldownDelay = entry.desiredFollowing === entry.baseFollowing
    ? 0
    : Math.max(0, entry.notBefore - Date.now());
  const finalDelay = Math.max(requestedDelay, cooldownDelay);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    void flushExploreFollowPair380(entry.key);
  }, finalDelay);
};

export const flushExploreFollowPair380 = async (key: string): Promise<void> => {
  const entry = pending380.get(key);
  if (!entry || entry.inflight || entry.suspended) return;
  const dueAt = Math.max(entry.updatedAt + (entry.immediate ? 0 : EXPLORE_FOLLOW_IDLE_FLUSH_MS_380),
    entry.desiredFollowing === entry.baseFollowing ? 0 : entry.notBefore);
  if (Date.now() < dueAt) { schedule380(entry, dueAt - Date.now()); return; }

  // The user's final local state returned to the state that existed before the
  // window opened. No Worker request, R2 write, D1 read or D1 write is needed.
  if (entry.desiredFollowing === entry.baseFollowing) {
    clearTimer380(entry);
    pending380.delete(key);
    removeStored380(entry.viewerUid, entry.targetUid);
    entry.onBusy?.(false);
    return;
  }

  entry.inflight = true;
  entry.onBusy?.(true);
  const sentVersion = entry.version;
  const sentDesired = entry.desiredFollowing;

  try {
    const result = await entry.commit(sentDesired);
    const current = pending380.get(key);
    const settlement: ExploreFollowBatchSettlement380 = {
      viewerUid: entry.viewerUid,
      targetUid: entry.targetUid,
      desiredFollowing: sentDesired,
      baseFollowing: entry.baseFollowing,
      baseTargetFollowerCount: safeCount380(entry.baseTargetFollowerCount),
      baseTargetFollowingCount: safeCount380(entry.baseTargetFollowingCount),
      baseActorFollowingCount: entry.baseActorFollowingCount === null
        ? null
        : safeCount380(entry.baseActorFollowingCount),
      targetProfile: { ...entry.targetProfile },
      result,
    };
    // A later local choice may supersede an in-flight canonical result.
    // Never paint or publish that stale intermediate follow state over the
    // user's newest opposite choice. If they returned to the same desired
    // state, the earlier commit is already the right final settlement.
    if (!current || current.desiredFollowing === sentDesired) {
      // A UI/notification callback failure must never replay a committed write.
      try { entry.onSettled(settlement); } catch (error) { console.warn('[380] follow settled callback', error); }
    }

    if (current && current.version !== sentVersion) {
      // A click landed while the canonical request was in flight. The settled
      // state becomes the new base and only the newest desired state gets one
      // later request. The UI can stay on the newest local state throughout.
      const canonical = Boolean(result.isFollowing);
      const delta = Number(canonical) - Number(entry.baseFollowing);
      current.baseFollowing = canonical;
      current.baseTargetFollowerCount = Math.max(
        0,
        safeCount380(entry.baseTargetFollowerCount) + delta,
      );
      if (entry.baseActorFollowingCount !== null) {
        current.baseActorFollowingCount = Math.max(
          0,
          safeCount380(entry.baseActorFollowingCount) + delta,
        );
      }
      current.inflight = false;
      current.notBefore = 0;
      persistEntry380(current);
      current.onBusy?.(false);
      schedule380(current, Math.max(0, current.updatedAt + (current.immediate ? 0 : EXPLORE_FOLLOW_IDLE_FLUSH_MS_380) - Date.now()));
      return;
    }

    pending380.delete(key);
    removeStored380(entry.viewerUid, entry.targetUid);
  } catch (error) {
    const current = pending380.get(key) || entry;
    const code = String((error as { code?: unknown })?.code || '').trim();
    if (code === 'RATE_LIMITED') {
      // The server rejected this write BEFORE the canonical mutation.
      // A second rejection must not leave an optimistic unfollow painted as
      // successful forever (previous code persisted suspended=true forever).
      if (current.desiredFollowing === current.baseFollowing) {
        clearTimer380(current);
        pending380.delete(key);
        removeStored380(current.viewerUid, current.targetUid);
        current.inflight = false;
        current.onBusy?.(false);
        return;
      }
      // An immediately requested follow rejected by server cooldown must not
      // linger for minutes with an unconfirmed count or retry storm.
      if (current.immediate) {
        failExploreFollowPending380(current,
          new Error('서버에서 팔로우 변경을 제한하고 있습니다. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      if (current.retryUsed) {
        failExploreFollowPending380(current, followRateLimitFailure380());
        return;
      }
      const retryDelay = retryAfterMs380(error);
      current.inflight = false;
      current.notBefore = Date.now() + retryDelay;
      current.suspended = false;
      current.retryUsed = true;
      persistEntry380(current);
      current.onBusy?.(false);
      current.onDeferred?.(retryDelay);
      schedule380(current, retryDelay);
      return;
    }

    failExploreFollowPending380(current, error);
  } finally {
    const current = pending380.get(key);
    if (!current || current.version === sentVersion) {
      entry.inflight = false;
      entry.onBusy?.(false);
    }
  }
};

export const queueExploreFollowFinalState380 = (request: ExploreFollowBatchRequest380) => {
  const viewerUid = String(request.viewerUid || '').trim();
  const targetUid = String(request.targetUid || '').trim();
  if (!viewerUid || !targetUid || viewerUid === targetUid) return;

  const key = key380(viewerUid, targetUid);
  const existing = pending380.get(key);
  if (existing) {
    existing.commit = request.commit;
    existing.onBusy = request.onBusy;
    existing.onSettled = request.onSettled;
    existing.onError = request.onError;
    // Remount/re-entry only refreshes callbacks; it is not another user click.
    if (request.restoredUpdatedAt !== undefined) return;
    existing.desiredFollowing = request.desiredFollowing === true;
    existing.immediate = request.immediate === true;
    existing.targetProfile = { ...request.targetProfile };
    existing.version += 1;
    existing.updatedAt = Date.now();
    existing.retryUsed = false;
    existing.suspended = false;
    persistEntry380(existing);
    if (!existing.inflight) schedule380(existing);
    return;
  }

  const entry: ExploreFollowBatchEntry380 = {
    ...request,
    viewerUid,
    targetUid,
    desiredFollowing: request.desiredFollowing === true,
    immediate: request.immediate === true,
    baseFollowing: request.baseFollowing === true,
    baseTargetFollowerCount: safeCount380(request.baseTargetFollowerCount),
    baseTargetFollowingCount: safeCount380(request.baseTargetFollowingCount),
    baseActorFollowingCount: request.baseActorFollowingCount === null
      ? null
      : safeCount380(request.baseActorFollowingCount),
    targetProfile: { ...request.targetProfile, uid: targetUid },
    key,
    version: 1,
    updatedAt: request.restoredUpdatedAt ?? Date.now(),
    timer: null,
    inflight: false,
    notBefore: Math.max(0, Math.floor(Number(request.restoredNotBefore || 0))),
    retryUsed: request.restoredRetryUsed === true,
    suspended: request.restoredSuspended === true,
  };
  pending380.set(key, entry);
  // Existing persisted suspended intents from the old app never had a timer.
  // They cannot be treated as completed canonical state after an update.
  if (entry.suspended) {
    failExploreFollowPending380(entry, followRateLimitFailure380());
    return;
  }
  persistEntry380(entry);
  schedule380(entry, request.initialDelayMs ?? (entry.immediate ? 0 : EXPLORE_FOLLOW_IDLE_FLUSH_MS_380));
};

export const getPendingExploreFollowMutationCount380 = (viewerUid = '') => {
  const uid = String(viewerUid || '').trim();
  if (!uid) return pending380.size;
  let count = 0;
  for (const entry of pending380.values()) {
    if (entry.viewerUid === uid) count += 1;
  }
  return count;
};

export const flushPendingExploreFollowsForPageExit380 = async (_viewerUid = '') => {
  // Navigation never flushes. The module timer and durable outbox own settlement.
};

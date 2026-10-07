// SORIDRAW_EXPLORE_FOLLOW_LOCAL_FIRST_BATCH_380_20261007
// One viewer/target pair keeps only its latest desired state for 30 seconds.
// The current device may paint immediately; the canonical Worker is called once
// for the final state. Returning to the original state costs zero server writes.
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
  targetProfile: {
    uid: string;
    nickname: string;
    avatarUrl: string;
    handle: string;
  };
  updatedAt: number;
  notBefore: number;
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
  initialDelayMs?: number;
  restoredNotBefore?: number;
};

type ExploreFollowBatchEntry380 = ExploreFollowBatchRequest380 & {
  key: string;
  version: number;
  updatedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  inflight: boolean;
  notBefore: number;
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
  targetProfile: { ...entry.targetProfile },
  updatedAt: entry.updatedAt,
  notBefore: entry.notBefore,
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
    return Math.min(60 * 60_000, Math.max(1_000, Math.floor(retryAfterMs)));
  }
  return 60_000;
};

const schedule380 = (entry: ExploreFollowBatchEntry380, delayMs = EXPLORE_FOLLOW_IDLE_FLUSH_MS_380) => {
  clearTimer380(entry);
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
  if (!entry || entry.inflight) return;

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
    entry.onSettled(settlement);

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
      current.updatedAt = Date.now();
      persistEntry380(current);
      current.onBusy?.(false);
      schedule380(current);
      return;
    }

    pending380.delete(key);
    removeStored380(entry.viewerUid, entry.targetUid);
  } catch (error) {
    const current = pending380.get(key) || entry;
    const code = String((error as { code?: unknown })?.code || '').trim();
    if (code === 'RATE_LIMITED') {
      // Abuse/cooldown rejection happens before D1 mutation. Keep the newest
      // desired state local and retry only after the server-provided window.
      const retryDelay = retryAfterMs380(error);
      current.inflight = false;
      current.notBefore = Date.now() + retryDelay;
      current.updatedAt = Date.now();
      persistEntry380(current);
      current.onBusy?.(false);
      schedule380(current, retryDelay);
      return;
    }

    pending380.delete(key);
    removeStored380(current.viewerUid, current.targetUid);
    current.onError({
      viewerUid: current.viewerUid,
      targetUid: current.targetUid,
      desiredFollowing: current.desiredFollowing,
      baseFollowing: current.baseFollowing,
      baseTargetFollowerCount: safeCount380(current.baseTargetFollowerCount),
      baseTargetFollowingCount: safeCount380(current.baseTargetFollowingCount),
      baseActorFollowingCount: current.baseActorFollowingCount === null
        ? null
        : safeCount380(current.baseActorFollowingCount),
      error,
    });
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
    existing.desiredFollowing = request.desiredFollowing === true;
    existing.targetProfile = { ...request.targetProfile };
    existing.commit = request.commit;
    existing.onBusy = request.onBusy;
    existing.onSettled = request.onSettled;
    existing.onError = request.onError;
    existing.version += 1;
    existing.updatedAt = Date.now();
    persistEntry380(existing);
    if (!existing.inflight) schedule380(existing);
    return;
  }

  const entry: ExploreFollowBatchEntry380 = {
    ...request,
    viewerUid,
    targetUid,
    desiredFollowing: request.desiredFollowing === true,
    baseFollowing: request.baseFollowing === true,
    baseTargetFollowerCount: safeCount380(request.baseTargetFollowerCount),
    baseTargetFollowingCount: safeCount380(request.baseTargetFollowingCount),
    baseActorFollowingCount: request.baseActorFollowingCount === null
      ? null
      : safeCount380(request.baseActorFollowingCount),
    targetProfile: { ...request.targetProfile, uid: targetUid },
    key,
    version: 1,
    updatedAt: Date.now(),
    timer: null,
    inflight: false,
    notBefore: Math.max(0, Math.floor(Number(request.restoredNotBefore || 0))),
  };
  pending380.set(key, entry);
  persistEntry380(entry);
  schedule380(entry, request.initialDelayMs ?? EXPLORE_FOLLOW_IDLE_FLUSH_MS_380);
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

export const flushPendingExploreFollowsForPageExit380 = async (viewerUid = '') => {
  const uid = String(viewerUid || '').trim();
  const keys = [...pending380.entries()]
    .filter(([, entry]) => !uid || entry.viewerUid === uid)
    .map(([key]) => key);
  await Promise.all(keys.map((key) => flushExploreFollowPair380(key)));
};

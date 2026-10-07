import { onValue, ref as databaseRef, runTransaction, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

// SORIDRAW_EXPLORE_FOLLOW_LIVE_SYNC_377_20261007
// Same-account follow convergence uses one tiny UID-scoped RTDB invalidation.
// It carries only the exact counts already returned by the canonical follow
// mutation. It never carries a whole profile/list and never triggers D1 itself.
export const EXPLORE_FOLLOW_SYNC_EVENT_377 = 'soridraw:explore-follow-sync-377';
const EXPLORE_FOLLOW_SIGNAL_RETENTION_MS_377 = 10 * 60_000;
const EXPLORE_FOLLOW_DEVICE_KEY_377 = 'soridraw_explore_follow_device_377';

export type ExploreFollowSyncSignal377 = {
  version: number;
  at: number;
  originDeviceId: string;
  targetUid: string;
  following: boolean;
  actorFollowingCount: number;
  targetFollowerCount: number;
};

const getFollowDeviceId377 = (): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = String(window.localStorage.getItem(EXPLORE_FOLLOW_DEVICE_KEY_377) || '').trim();
    if (existing) return existing;
    const next = `follow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(EXPLORE_FOLLOW_DEVICE_KEY_377, next);
    return next;
  } catch {
    return `follow_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const normalizeCount377 = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeFollowSignal377 = (raw: unknown): ExploreFollowSyncSignal377 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const version = Math.floor(Number(row.version || 0));
  const at = Math.floor(Number(row.at || 0));
  const originDeviceId = String(row.originDeviceId || '').trim();
  const targetUid = String(row.targetUid || '').trim();
  if (!Number.isSafeInteger(version) || version <= 0 ||
      !Number.isSafeInteger(at) || at <= 0 ||
      !originDeviceId || !targetUid ||
      typeof row.following !== 'boolean') return null;
  return {
    version,
    at,
    originDeviceId,
    targetUid,
    following: row.following,
    actorFollowingCount: normalizeCount377(row.actorFollowingCount),
    targetFollowerCount: normalizeCount377(row.targetFollowerCount),
  };
};

export const publishExploreFollowSync377 = async (
  viewerUid: string,
  change: Omit<ExploreFollowSyncSignal377, 'version' | 'at' | 'originDeviceId'>,
): Promise<ExploreFollowSyncSignal377 | null> => {
  const uid = String(viewerUid || '').trim();
  const targetUid = String(change.targetUid || '').trim();
  if (!uid || !targetUid) return null;
  const originDeviceId = getFollowDeviceId377();
  const signalRef = databaseRef(realtimeDb, `userSync/${uid}/exploreFollow`);
  const transaction = await runTransaction(signalRef, (current) => {
    const currentVersion = Math.max(0, Math.floor(Number(current?.version || 0)));
    const now = Date.now();
    return {
      version: Math.max(now, currentVersion + 1),
      at: now,
      originDeviceId,
      targetUid,
      following: change.following === true,
      actorFollowingCount: normalizeCount377(change.actorFollowingCount),
      targetFollowerCount: normalizeCount377(change.targetFollowerCount),
    };
  }, { applyLocally: true });
  return normalizeFollowSignal377(transaction.snapshot.val());
};

export const subscribeExploreFollowSync377 = (
  viewerUid: string,
  listener: (signal: ExploreFollowSyncSignal377) => void,
): Unsubscribe => {
  const uid = String(viewerUid || '').trim();
  if (!uid) return () => {};
  const ownDeviceId = getFollowDeviceId377();
  let lastVersion = 0;
  return onValue(
    databaseRef(realtimeDb, `userSync/${uid}/exploreFollow`),
    (snapshot) => {
      const signal = normalizeFollowSignal377(snapshot.val());
      if (!signal || signal.version <= lastVersion) return;
      lastVersion = signal.version;
      if (signal.originDeviceId === ownDeviceId) return;
      // During PREVIEW→TEST→PRODUCTION rollout older clients can still mutate
      // shared follow data without this signal. Never replay an old marker as
      // perpetual authority; it is only a short live convergence channel.
      if (Date.now() - signal.at > EXPLORE_FOLLOW_SIGNAL_RETENTION_MS_377) return;
      listener(signal);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EXPLORE_FOLLOW_SYNC_EVENT_377, {
          detail: { uid, ...signal },
        }));
      }
    },
    (error) => {
      console.warn('[377] Explore follow RTDB sync unavailable; local state remains usable.', error);
    },
  );
};

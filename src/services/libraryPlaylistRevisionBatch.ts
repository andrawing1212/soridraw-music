import { get, ref } from 'firebase/database';
import { doc, runTransaction } from '../lib/firestoreMeasured';
import { db, realtimeDb } from '../firebase';
import { readUserProfileCache } from '../lib/userProfileCache';

const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 60_000;
const STORAGE_PREFIX = 'soridraw.library.playlistRevisionBatch.v1';

type PendingPlaylistRevision = {
  latestVersion: number;
  updatedAt: number;
};

const timers = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
const pendingMemory = new Map<string, PendingPlaylistRevision>();
const latestSharedSignalVersionByUid = new Map<string, number>();
// app507: these flags exist only after the device fails to persist a pending
// compatibility version. Ordinary healthy Library edits retain their 60s batch.
const undurablePendingUids507 = new Set<string>();
const quotaRetryBudget507 = new Map<string, number>();

const normalizeUid = (uid: string): string => String(uid || '').trim();
const storageKey = (uid: string): string => `${STORAGE_PREFIX}.${normalizeUid(uid)}`;

const safeVersion = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const readPending = (uid: string): PendingPlaylistRevision | null => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return null;
  const memory = pendingMemory.get(safeUid);
  if (memory) return memory;
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(safeUid)) || 'null');
    const latestVersion = safeVersion(parsed?.latestVersion);
    const updatedAt = safeVersion(parsed?.updatedAt);
    const pending = latestVersion > 0 && updatedAt > 0 ? { latestVersion, updatedAt } : null;
    if (pending) pendingMemory.set(safeUid, pending);
    return pending;
  } catch {
    return null;
  }
};

const writePending = (uid: string, value: PendingPlaylistRevision): boolean => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return false;
  pendingMemory.set(safeUid, value);
  let durable = false;
  if (typeof localStorage !== 'undefined') {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(storageKey(safeUid), serialized);
      durable = localStorage.getItem(storageKey(safeUid)) === serialized;
    } catch {
      // A silently rejected write or QuotaExceededError is not durable.
    }
  }
  if (durable) {
    undurablePendingUids507.delete(safeUid);
    quotaRetryBudget507.delete(safeUid);
  } else {
    undurablePendingUids507.add(safeUid);
    quotaRetryBudget507.set(safeUid, 1); // at most one timed retry while offline
  }
  return durable;
};

const clearPending = (uid: string): void => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return;
  const timer = timers.get(safeUid);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  timers.delete(safeUid);
  pendingMemory.delete(safeUid);
  undurablePendingUids507.delete(safeUid);
  quotaRetryBudget507.delete(safeUid);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(storageKey(safeUid)); } catch {}
  }
};

const readCachedRemoteVersion = (uid: string): number => safeVersion(
  (readUserProfileCache(uid) as any)?.syncVersions?.playlists
);

export const noteLibraryPlaylistRevisionSignal = (uid: string, syncVersion: number): void => {
  const safeUid = normalizeUid(uid);
  const version = safeVersion(syncVersion);
  if (!safeUid || version <= 0) return;
  latestSharedSignalVersionByUid.set(
    safeUid,
    Math.max(version, latestSharedSignalVersionByUid.get(safeUid) || 0),
  );
};

const readLatestSharedSignalVersion = async (uid: string): Promise<number | null> => {
  try {
    const snapshot = await get(ref(realtimeDb, `userSync/${uid}/libraryPlaylist`));
    return safeVersion(snapshot.val()?.syncVersion);
  } catch {
    // Fail closed: never risk lowering a shared compatibility revision when the
    // newest cross-device signal cannot be checked. Durable pending state stays
    // in localStorage and resumes on the next Library session/mutation.
    return null;
  }
};

const scheduleFlush = (uid: string, delayMs = LIBRARY_PLAYLIST_REVISION_BATCH_MS): void => {
  const safeUid = normalizeUid(uid);
  if (!safeUid || typeof window === 'undefined') return;
  const existing = timers.get(safeUid);
  if (existing !== undefined) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    timers.delete(safeUid);
    void flushLibraryPlaylistRevisionBatch(safeUid);
  }, Math.max(0, delayMs));
  timers.set(safeUid, timer);
};

const retryUndurableOnce507 = (uid: string): void => {
  if (!undurablePendingUids507.has(uid)) return;
  const remaining = quotaRetryBudget507.get(uid) || 0;
  if (remaining <= 0) return; // Avoid a timer loop when the device is offline.
  quotaRetryBudget507.set(uid, remaining - 1);
  scheduleFlush(uid, LIBRARY_PLAYLIST_REVISION_BATCH_MS);
};

// app295: Folder metadata stays canonical immediately, while the compatibility
// users.syncVersions.playlists signal is collapsed to one UID-wide write after
// 60 seconds of quiet. Current app devices still receive each changed-folder
// RTDB delta immediately, so visible PC/mobile sync does not wait for Firestore.
export const queueLibraryPlaylistRevisionBatch = (uid: string, syncVersion: number): void => {
  const safeUid = normalizeUid(uid);
  const version = safeVersion(syncVersion);
  if (!safeUid || version <= 0) return;

  const current = readPending(safeUid);
  const durable = writePending(safeUid, {
    latestVersion: Math.max(version, current?.latestVersion || 0),
    updatedAt: Date.now(),
  });
  // Canonical playlists are already written by the Library mutation.
  // Only an undurable *compatibility revision* uses an urgent bounded flush.
  scheduleFlush(safeUid, durable ? LIBRARY_PLAYLIST_REVISION_BATCH_MS : 0);
};

// Any path that still writes users.syncVersions.playlists immediately can retire
// an older local pending batch and avoid a redundant delayed write.
export const markLibraryPlaylistRevisionCommitted = (uid: string, committedVersion: number): void => {
  const safeUid = normalizeUid(uid);
  const version = safeVersion(committedVersion);
  if (!safeUid || version <= 0) return;
  const pending = readPending(safeUid);
  if (pending && pending.latestVersion <= version) clearPending(safeUid);
};

export const flushLibraryPlaylistRevisionBatch = async (uid: string): Promise<void> => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return;
  const existing = inflight.get(safeUid);
  if (existing) return existing;

  const task = (async () => {
    const pending = readPending(safeUid);
    if (!pending) return;

    // If another immediate canonical playlist mutation already advanced the
    // cached profile revision past this batch, no extra Firestore write is needed.
    const cachedRemote = readCachedRemoteVersion(safeUid);
    if (cachedRemote >= pending.latestVersion) {
      clearPending(safeUid);
      return;
    }

    // RTDB stores the newest current-app playlist delta. Use it only as a
    // monotonic floor so a suspended older device cannot later lower the shared
    // Firestore compatibility revision.
    let sharedSignalVersion = latestSharedSignalVersionByUid.get(safeUid) || 0;
    if (sharedSignalVersion < pending.latestVersion) {
      const fetchedSignalVersion = await readLatestSharedSignalVersion(safeUid);
      if (fetchedSignalVersion === null) {
        retryUndurableOnce507(safeUid);
        return;
      }
      sharedSignalVersion = fetchedSignalVersion;
      noteLibraryPlaylistRevisionSignal(safeUid, fetchedSignalVersion);
    }
    const targetVersion = Math.max(pending.latestVersion, sharedSignalVersion, cachedRemote);
    if (targetVersion <= 0) return;

    // app510: compare against the actual server revision in the same
    // transaction that writes the new compatibility version. An old tab's
    // delayed update can never lower a newer app510 transaction's value.
    // One users/{uid} transaction read occurs only at the 60s settlement (or
    // exceptional quota flush), never on page entry or normal folder clicks.
    const userRef = doc(db, 'users', safeUid);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(userRef);
      if (!snapshot.exists()) throw new Error('MISSING_USER_REVISION_DOCUMENT');
      const serverVersion = safeVersion((snapshot.data() as any)?.syncVersions?.playlists);
      if (serverVersion < targetVersion) {
        transaction.update(userRef, { 'syncVersions.playlists': targetVersion });
      }
    });

    const latest = readPending(safeUid);
    if (!latest || (latest.latestVersion <= targetVersion && latest.updatedAt <= pending.updatedAt)) {
      clearPending(safeUid);
      return;
    }
    scheduleFlush(safeUid, undurablePendingUids507.has(safeUid) ? 0 : LIBRARY_PLAYLIST_REVISION_BATCH_MS);
  })().catch((error) => {
    console.warn('[Library playlist revision batch] flush deferred; pending version remains in memory.', error);
    retryUndurableOnce507(safeUid);
  }).finally(() => {
    inflight.delete(safeUid);
  });

  inflight.set(safeUid, task);
  return task;
};

export const resumeLibraryPlaylistRevisionBatch = (uid: string): void => {
  const safeUid = normalizeUid(uid);
  const pending = readPending(safeUid);
  if (!safeUid || !pending) return;
  const elapsed = Math.max(0, Date.now() - pending.updatedAt);
  scheduleFlush(safeUid, Math.max(0, LIBRARY_PLAYLIST_REVISION_BATCH_MS - elapsed));
};

export const getPendingLibraryPlaylistRevisionBatch = (uid: string): PendingPlaylistRevision | null => readPending(uid);

export const LIBRARY_PLAYLIST_REVISION_BATCH_WINDOW_MS = LIBRARY_PLAYLIST_REVISION_BATCH_MS;

import { get, ref } from 'firebase/database';
import { doc, updateDoc } from '../lib/firestoreMeasured';
import { db, realtimeDb } from '../firebase';
import { readUserProfileCache } from '../lib/userProfileCache';

const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 30_000;
const STORAGE_PREFIX = 'soridraw.library.playlistRevisionBatch.v1';

type PendingPlaylistRevision = {
  latestVersion: number;
  updatedAt: number;
};

const timers = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
const pendingMemory = new Map<string, PendingPlaylistRevision>();
const latestSharedSignalVersionByUid = new Map<string, number>();

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

const writePending = (uid: string, value: PendingPlaylistRevision): void => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return;
  pendingMemory.set(safeUid, value);
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(storageKey(safeUid), JSON.stringify(value)); } catch {}
};

const clearPending = (uid: string): void => {
  const safeUid = normalizeUid(uid);
  if (!safeUid) return;
  const timer = timers.get(safeUid);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  timers.delete(safeUid);
  pendingMemory.delete(safeUid);
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

// app295: Folder metadata stays canonical immediately, while the compatibility
// users.syncVersions.playlists signal is collapsed to one UID-wide write after
// 30 seconds of quiet. Current app devices still receive each changed-folder
// RTDB delta immediately, so visible PC/mobile sync does not wait for Firestore.
export const queueLibraryPlaylistRevisionBatch = (uid: string, syncVersion: number): void => {
  const safeUid = normalizeUid(uid);
  const version = safeVersion(syncVersion);
  if (!safeUid || version <= 0) return;

  const current = readPending(safeUid);
  writePending(safeUid, {
    latestVersion: Math.max(version, current?.latestVersion || 0),
    updatedAt: Date.now(),
  });
  scheduleFlush(safeUid);
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
      if (fetchedSignalVersion === null) return;
      sharedSignalVersion = fetchedSignalVersion;
      noteLibraryPlaylistRevisionSignal(safeUid, fetchedSignalVersion);
    }
    const targetVersion = Math.max(pending.latestVersion, sharedSignalVersion, cachedRemote);
    if (targetVersion <= 0) return;

    await updateDoc(doc(db, 'users', safeUid), {
      'syncVersions.playlists': targetVersion,
    });

    const latest = readPending(safeUid);
    if (!latest || (latest.latestVersion <= targetVersion && latest.updatedAt <= pending.updatedAt)) {
      clearPending(safeUid);
      return;
    }
    scheduleFlush(safeUid);
  })().catch((error) => {
    console.warn('[Library playlist revision batch] flush deferred; durable pending marker kept.', error);
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

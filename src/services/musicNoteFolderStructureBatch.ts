import { doc, runTransaction } from '../lib/firestoreMeasured';
import { db } from '../firebase';
import { runV1MutationBoundary } from '../data/v1MutationBoundary';
import { publishMusicNoteStructureDelta } from './userDomainSyncService';

export type MusicNoteFolderModeKey = 'myNote' | 'sharedNote';

type PendingModeState = {
  folders: unknown[];
  version: number;
  updatedAtMs: number;
  // Original folder view when the first unsaved edit was made. Persist it so
  // a reopened tab cannot overwrite a newer remote edit from stale cache.
  baseFolders?: unknown[] | null;
};

type PendingMusicNoteFolderStructure = {
  myNote?: PendingModeState;
  sharedNote?: PendingModeState;
  updatedAtMs: number;
};

const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000;
// app510: an undurable first edit is saved urgently; subsequent quota-full
// edits are grouped for up to five seconds to bound server write amplification.
const MUSIC_NOTE_QUOTA_EMERGENCY_COOLDOWN_MS = 5_000;
// app506: emitted only when a pending folder structure cannot be persisted locally.
export const MUSIC_NOTE_FOLDER_QUOTA_RISK_EVENT = 'soridraw:music-note:folder-pending-quota-risk';
export const MUSIC_NOTE_FOLDER_SAVE_STATUS_EVENT = 'soridraw:music-note:folder-save-status';
export type MusicNoteFolderSaveStatus = {
  state: 'unsaved' | 'saving' | 'unconfirmed' | 'server-confirmed' | 'failed';
  durable: boolean;
  storageRisk?: boolean;
  version: number;
  delivery: 'pending' | 'sent' | 'failed';
};
const saveStatuses = new Map<string, MusicNoteFolderSaveStatus>();
const failedAttempts = new Map<string, number>();
const MAX_AUTOMATIC_ATTEMPTS = 3;
const SERVER_ACK_WARNING_MS = 15_000;
const STORAGE_PREFIX = 'soridraw.musicNote.folderStructureBatch.v1';

const timers = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
const memoryPending = new Map<string, PendingMusicNoteFolderStructure>();
const undurablePendingUids510 = new Set<string>();
const lastQuotaAttemptAt510 = new Map<string, number>();
const observedServerVersions = new Map<string, number>();
// In-memory epoch for edits during a user-confirmed recovery transaction.
// It is never a server write and cannot cause steady-state polling.
const folderEditEpoch = new Map<string, number>();
const folderEditKey = (uid: string, mode: MusicNoteFolderModeKey): string => `${safeUid(uid)}:${mode}`;
export const getMusicNoteFolderEditEpoch = (uid: string, mode: MusicNoteFolderModeKey): number =>
  folderEditEpoch.get(folderEditKey(uid, mode)) || 0;
export const markMusicNoteFolderEdited = (uid: string, mode: MusicNoteFolderModeKey): void => {
  const key = folderEditKey(uid, mode);
  folderEditEpoch.set(key, (folderEditEpoch.get(key) || 0) + 1);
};
export const getObservedMusicNoteStructureVersion = (uid: string): number => observedServerVersions.get(safeUid(uid)) || 0;
const rememberServerVersion = (uid: string, version: number): void => {
  observedServerVersions.set(uid, Math.max(getObservedMusicNoteStructureVersion(uid), version));
};

export const getMusicNoteFolderSaveStatus = (uid: string) => saveStatuses.get(uid) || null;
const reportStatus = (uid: string, patch: Partial<MusicNoteFolderSaveStatus>) => {
  const previous = saveStatuses.get(uid);
  const next: MusicNoteFolderSaveStatus = {
    state: 'unsaved', durable: !undurablePendingUids510.has(uid), version: 0,
    delivery: 'pending', ...previous, ...patch,
  };
  saveStatuses.set(uid, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MUSIC_NOTE_FOLDER_SAVE_STATUS_EVENT, { detail: { uid } }));
  }
};

// RTDB acknowledgement proves transport only, never Firestore persistence.
export const reportMusicNoteFolderDelivery = (uid: string, version: number, delivery: 'sent' | 'failed') => {
  if (saveStatuses.get(uid)?.version === version) reportStatus(uid, { delivery });
};

// Browsers may ignore beforeunload on mobile termination. Keep the visible
// warning as well; memory-only pending is never advertised as crash durable.
if (typeof window !== 'undefined') window.addEventListener?.('beforeunload', (event) => {
  if (![...undurablePendingUids510].some(uid => memoryPending.has(uid))) return;
  event.preventDefault();
  event.returnValue = '';
});

const safeUid = (uid: string): string => String(uid || '').trim();
const storageKey = (uid: string): string => `${STORAGE_PREFIX}.${safeUid(uid)}`;
const safeVersion = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

// Stable projection ignores updatedAt timestamps: reorder/rename and membership
// matter, but a freshly rendered card timestamp is not a structural conflict.
const comparableFolders = (value: unknown): string => JSON.stringify(
  Array.isArray(value) ? value.map((item: any) => ({
    id: String(item?.id || item?.folderId || ''),
    title: String(item?.title || item?.name || ''),
    order: Number(item?.order || 0),
    isDefault: Boolean(item?.isDefault || item?.id === 'default'),
  })) : null,
);
export type MusicNoteStructureBase = {
  mode: MusicNoteFolderModeKey;
  folders: unknown[] | null;
};

// app514 P1: compare server and candidate inside one atomic Firestore transaction.
// A delayed device cannot overwrite a newer canonical structure version.
// A stale failure must NOT trigger the post-success RTDB signal or clear pending.
export const writeMusicNoteStructureIfNewer = async (
  uid: string,
  patch: { musicNoteStructureVersion: number; [key: string]: unknown },
  expectedBases?: MusicNoteStructureBase[],
): Promise<void> => {
  const key = safeUid(uid);
  const version = safeVersion(patch.musicNoteStructureVersion);
  if (!key || version <= 0) throw new Error('MUSIC_NOTE_STRUCTURE_INVALID_VERSION');
  const structureRef = doc(db, 'user_structures', key);
  let committedRevision = version;
  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(structureRef);
      const serverVersion = safeVersion(snapshot.data()?.musicNoteStructureVersion);
      if (expectedBases?.length) {
        const remoteFolders = snapshot.data()?.musicNoteFolders || {};
        for (const base of expectedBases) {
          if (comparableFolders(remoteFolders[base.mode]) !== comparableFolders(base.folders)) {
            throw Object.assign(new Error('MUSIC_NOTE_STRUCTURE_STALE_SERVER_VERSION'), {
              code: 'music-note/stale-structure-version', serverVersion,
            });
          }
        }
      } else if (serverVersion >= version) {
        // Legacy pending created before the base-snapshot protocol retains the
        // previous fail-closed behavior; never replay it as a fresh new edit.
        throw Object.assign(new Error('MUSIC_NOTE_STRUCTURE_STALE_SERVER_VERSION'), {
          code: 'music-note/stale-structure-version', serverVersion,
        });
      }
      // Once this client has a content baseline, the server allocates the next
      // committed revision; device clocks only label the optimistic RTDB preview.
      committedRevision = expectedBases?.length ? serverVersion + 1 : version;
      transaction.set(structureRef, {
        ...patch, musicNoteStructureVersion: committedRevision,
        // A legacy setDoc(merge:true) cannot refresh this token. The existing
        // server write trigger can then preserve both folder versions if a
        // previously deployed browser overwrites a modern committed edit.
        musicNoteStructureWriterToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }, { merge: true });
    });
    // A successful transaction is authoritative even if local device time is wrong.
    // Transaction revision is also used by the existing server-side sync trigger.
    rememberServerVersion(key, committedRevision);
  } catch (error) {
    const stale = error as { code?: string; serverVersion?: number };
    if (stale?.code === 'music-note/stale-structure-version') {
      rememberServerVersion(key, safeVersion(stale.serverVersion));
      // An earlier RTDB preview may be visible on another device even though
      // Firestore rejected it. One conflict-only RTDB signal makes receivers
      // refresh the authoritative structure; no steady-state reads/writes.
      void publishMusicNoteStructureDelta(key, {
        __musicNoteCanonicalConflict: true,
        musicNoteStructureVersion: safeVersion(stale.serverVersion),
      }).catch(() => { /* The unsaved state remains visible if RTDB is unavailable. */ });
    }
    throw error;
  }
};

const normalizeModeState = (value: any): PendingModeState | undefined => {
  const version = safeVersion(value?.version);
  const updatedAtMs = safeVersion(value?.updatedAtMs);
  if (!Array.isArray(value?.folders) || version <= 0 || updatedAtMs <= 0) return undefined;
  return {
    folders: value.folders, version, updatedAtMs,
    ...(Object.prototype.hasOwnProperty.call(value, 'baseFolders') && (value.baseFolders === null || Array.isArray(value.baseFolders))
      ? { baseFolders: value.baseFolders } : {}),
  };
};

const readPending = (uid: string): PendingMusicNoteFolderStructure | null => {
  const key = safeUid(uid);
  if (!key) return null;
  const memory = memoryPending.get(key);
  if (memory) return memory;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(key)) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const pending: PendingMusicNoteFolderStructure = {
      ...(normalizeModeState(raw.myNote) ? { myNote: normalizeModeState(raw.myNote) } : {}),
      ...(normalizeModeState(raw.sharedNote) ? { sharedNote: normalizeModeState(raw.sharedNote) } : {}),
      updatedAtMs: safeVersion(raw.updatedAtMs),
    };
    if (!pending.myNote && !pending.sharedNote) return null;
    memoryPending.set(key, pending);
    return pending;
  } catch {
    return null;
  }
};

const writePending = (uid: string, pending: PendingMusicNoteFolderStructure): boolean => {
  const key = safeUid(uid);
  if (!key) return false;
  memoryPending.set(key, pending);
  let durable = false;
  if (typeof localStorage !== 'undefined') {
    try {
      const serialized = JSON.stringify(pending);
      localStorage.setItem(storageKey(key), serialized);
      durable = localStorage.getItem(storageKey(key)) === serialized;
    } catch {
      // Storage full/restricted is not a successful durable handoff.
    }
  }
  if (durable) undurablePendingUids510.delete(key);
  else undurablePendingUids510.add(key);
  return durable;
};

const emergencyDelay510 = (key: string): number => {
  const last = lastQuotaAttemptAt510.get(key);
  if (last === undefined) return 0; // first undurable mutation is urgent
  return Math.max(0, MUSIC_NOTE_QUOTA_EMERGENCY_COOLDOWN_MS - (Date.now() - last));
};

const warnPendingQuotaRisk506 = (uid: string): void => {
  if (typeof window === 'undefined') return;
  // No song/folder contents, IDs, or server request. This warning does NOT claim
  // an offline memory-only edit survived a reload.
  try {
    window.dispatchEvent(new CustomEvent(MUSIC_NOTE_FOLDER_QUOTA_RISK_EVENT, {
      detail: { uid },
    }));
  } catch {
    // A missing CustomEvent API cannot block the canonical fallback timer.
  }
};

const clearAll = (uid: string): void => {
  const key = safeUid(uid);
  if (!key) return;
  const timer = timers.get(key);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  timers.delete(key);
  memoryPending.delete(key);
  undurablePendingUids510.delete(key);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(storageKey(key)); } catch {}
  }
};

const schedule = (uid: string, delayMs = MUSIC_NOTE_FOLDER_BATCH_MS): void => {
  const key = safeUid(uid);
  if (!key || typeof window === 'undefined') return;
  const previous = timers.get(key);
  if (previous !== undefined) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    timers.delete(key);
    void flushMusicNoteFolderStructureBatch(key);
  }, Math.max(0, delayMs));
  timers.set(key, timer);
};

export const queueMusicNoteFolderStructureBatch = (
  uid: string,
  mode: MusicNoteFolderModeKey,
  folders: unknown[],
  version: number,
  baseFolders?: unknown[] | null,
): void => {
  const key = safeUid(uid);
  const normalizedVersion = safeVersion(version);
  if (!key || normalizedVersion <= 0 || !Array.isArray(folders)) return;

  const current = readPending(key) || { updatedAtMs: 0 };
  if (normalizedVersion < safeVersion(current[mode]?.version)) return;
  markMusicNoteFolderEdited(key, mode);
  // A new edit may replace an in-flight edit with the same proposed version.
  // Give the replacement its own increasing version so its later settlement
  // stays valid under the strict server-side version check.
  const nextVersion = normalizedVersion === safeVersion(current[mode]?.version)
    ? normalizedVersion + 1 : normalizedVersion;
  const now = Date.now();
  const next: PendingMusicNoteFolderStructure = {
    ...current,
    [mode]: {
      folders,
      version: nextVersion,
      updatedAtMs: now,
      ...(Object.prototype.hasOwnProperty.call(current[mode] || {}, 'baseFolders')
        ? { baseFolders: current[mode]?.baseFolders }
        : baseFolders === null || Array.isArray(baseFolders) ? { baseFolders } : {}),
    },
    updatedAtMs: now,
  };
  const durable = writePending(key, next);
  failedAttempts.delete(key);
  reportStatus(key, { state: 'unsaved', durable, storageRisk: !durable, version: nextVersion, delivery: 'pending' });
  if (!durable) warnPendingQuotaRisk506(key);
  // Healthy changes retain app301's trailing 60-second canonical batch.
  // Only a failed local durable write triggers one immediate canonical attempt.
  schedule(key, durable ? MUSIC_NOTE_FOLDER_BATCH_MS : emergencyDelay510(key));
};

// A late RTDB ACK may promote only the very edit that is still pending.
// It must not resurrect an already-settled edit or replace a newer one.
export const promoteMusicNoteFolderStructureVersion = (
  uid: string, mode: MusicNoteFolderModeKey, expectedVersion: number, version: number,
): boolean => {
  const current = readPending(uid);
  const captured = current?.[mode];
  if (!current || !captured || captured.version !== expectedVersion || version <= expectedVersion) return false;
  const next = { ...current, [mode]: { ...captured, version } };
  const durable = writePending(uid, next);
  reportStatus(uid, { durable, storageRisk: !durable || saveStatuses.get(uid)?.storageRisk });
  // Keep the existing deadline. An ACK is not a new user edit.
  if (!durable) schedule(uid, emergencyDelay510(uid));
  return true;
};

export const markMusicNoteFolderStructureCommitted = (
  uid: string,
  mode: MusicNoteFolderModeKey,
  committedVersion: number,
): void => {
  const key = safeUid(uid);
  const version = safeVersion(committedVersion);
  const current = readPending(key);
  if (!key || !current || version <= 0) return;
  const modePending = current[mode];
  if (!modePending || modePending.version > version) return;

  const next: PendingMusicNoteFolderStructure = { ...current, updatedAtMs: Date.now() };
  delete next[mode];
  if (!next.myNote && !next.sharedNote) {
    clearAll(key);
    reportStatus(key, { state: 'server-confirmed', durable: true });
    return;
  }
  const durable = writePending(key, next);
  if (!durable) warnPendingQuotaRisk506(key);
  schedule(key, durable ? MUSIC_NOTE_FOLDER_BATCH_MS : emergencyDelay510(key));
};

export const flushMusicNoteFolderStructureBatch = async (uid: string): Promise<void> => {
  const key = safeUid(uid);
  if (!key) return;
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const pending = readPending(key);
    if (!pending) return;
    if (undurablePendingUids510.has(key)) {
      // Mark the attempt before network I/O, including offline failures.
      // New rapid edits remain in memory and use a bounded retry window.
      lastQuotaAttemptAt510.set(key, Date.now());
    }

    const capturedMy = pending.myNote;
    const capturedShared = pending.sharedNote;
    reportStatus(key, { state: 'saving', durable: !undurablePendingUids510.has(key) });
    const structureVersion = Math.max(
      safeVersion(capturedMy?.version),
      safeVersion(capturedShared?.version),
    );
    if (structureVersion <= 0) {
      clearAll(key);
      return;
    }

    const folderPatch: Record<string, unknown> = {
      ...(capturedMy ? { myNote: capturedMy.folders } : {}),
      ...(capturedShared ? { sharedNote: capturedShared.folders } : {}),
      updatedAt: Date.now(),
    };
    const structurePatch = {
      musicNoteFolders: folderPatch,
      musicNoteStructureVersion: structureVersion,
    };

    // Offline Firestore writes can remain unresolved instead of rejecting.
    // Report an unknown ACK without launching a second concurrent write.
    const ackWarning = typeof window !== 'undefined' ? window.setTimeout(() => {
      reportStatus(key, { state: 'unconfirmed', durable: !undurablePendingUids510.has(key) });
    }, SERVER_ACK_WARNING_MS) : undefined;
    try {
      await runV1MutationBoundary({
        domain: 'musicNote',
        operation: 'structure-update',
        uid: key,
        affectedCount: 1,
        syncStructure: structurePatch,
      }, writeMusicNoteStructureIfNewer(key, structurePatch,
        [capturedMy && { mode: 'myNote' as const, folders: capturedMy.baseFolders },
         capturedShared && { mode: 'sharedNote' as const, folders: capturedShared.baseFolders }]
          .filter((base): base is MusicNoteStructureBase => Boolean(base && base.folders !== undefined))));
    } finally {
      if (ackWarning !== undefined) window.clearTimeout(ackWarning);
    }
    failedAttempts.delete(key);

    const latest = readPending(key);
    if (!latest) return;

    const next: PendingMusicNoteFolderStructure = { ...latest, updatedAtMs: latest.updatedAtMs };
    if (capturedMy && latest.myNote === capturedMy) delete next.myNote;
    if (capturedShared && latest.sharedNote === capturedShared) delete next.sharedNote;

    if (!next.myNote && !next.sharedNote) {
      clearAll(key);
      reportStatus(key, { state: 'server-confirmed', durable: true });
      return;
    }
    const durable = writePending(key, next);
    reportStatus(key, { state: 'unsaved', durable });
    if (!durable) warnPendingQuotaRisk506(key);
    schedule(key, durable ? MUSIC_NOTE_FOLDER_BATCH_MS : emergencyDelay510(key));
  })().catch((error) => {
    console.warn('[Music Note folder batch] canonical flush deferred; pending final state kept.', error);
    reportStatus(key, { state: 'failed', durable: !undurablePendingUids510.has(key) });
    const attempts = (failedAttempts.get(key) || 0) + 1;
    const code = String(error?.code || '');
    const nonRetryable = /permission-denied|unauthenticated|stale-structure-version/.test(code);
    failedAttempts.set(key, nonRetryable ? MAX_AUTOMATIC_ATTEMPTS : attempts);
    if (attempts < MAX_AUTOMATIC_ATTEMPTS && !nonRetryable) schedule(key);
    else {
      const timer = timers.get(key);
      if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
      timers.delete(key);
    }
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, task);
  return task;
};

export const resumeMusicNoteFolderStructureBatch = (uid: string): void => {
  const key = safeUid(uid);
  const pending = readPending(key);
  if (!key || !pending) return;
  if ((failedAttempts.get(key) || 0) >= MAX_AUTOMATIC_ATTEMPTS) return;
  const elapsed = Math.max(0, Date.now() - safeVersion(pending.updatedAtMs));
  schedule(key, Math.max(0, MUSIC_NOTE_FOLDER_BATCH_MS - elapsed));
};

export const retryMusicNoteFolderStructureBatch = (uid: string): void => {
  if (!readPending(uid)) return;
  const status = saveStatuses.get(uid);
  // A routine online event must not shorten a healthy trailing 60s batch.
  if (!undurablePendingUids510.has(uid) && status?.state !== 'failed' && status?.state !== 'unconfirmed') return;
  failedAttempts.delete(uid);
  schedule(uid, emergencyDelay510(uid));
};

export const getPendingMusicNoteFolderStructureBatch = (
  uid: string,
): PendingMusicNoteFolderStructure | null => readPending(uid);

export const MUSIC_NOTE_FOLDER_STRUCTURE_BATCH_MS = MUSIC_NOTE_FOLDER_BATCH_MS;

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
// Content-only fingerprint of the legacy folder view at first V2 migration.
// Avoid duplicating arbitrarily large complete folder arrays in the new
// document; two independent 32-bit streams plus length keep the marker tiny.
export const getMusicNoteLegacyFolderSignature = (folders: unknown): string => {
  const raw = comparableFolders(folders);
  let a = 2166136261, b = 0x9e3779b9;
  for (let i = 0; i < raw.length; i++) {
    const value = raw.charCodeAt(i);
    a = Math.imul(a ^ value, 16777619);
    b = Math.imul(b ^ value, 2246822519);
  }
  return `${raw.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
};

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
  // app515: modern folder edits use an independent canonical document. Old
  // browsers cannot overwrite this child path with legacy merge:true writes.
  // Card-only writes intentionally retain the existing parent document.
  const v2Ref = doc(db, 'user_structures', key, 'folder_state', 'v2');
  const folderModes = patch.musicNoteFolders && typeof patch.musicNoteFolders === 'object'
    ? patch.musicNoteFolders as Record<string, unknown> : null;
  const requestedModes = (['myNote', 'sharedNote'] as const).filter(mode =>
    folderModes && Object.prototype.hasOwnProperty.call(folderModes, mode));
  const folderWrite = requestedModes.length > 0;
  let committedRevision = version;
  try {
    await runTransaction(db, async (transaction) => {
      // Healthy folder edit: one V2 read and one V2 write. Bootstrap only:
      // one extra legacy read, without rewriting or deleting legacy data.
      const v2Snapshot = folderWrite ? await transaction.get(v2Ref) : null;
      const legacySnapshot = !folderWrite || !v2Snapshot?.exists()
        ? await transaction.get(structureRef) : null;
      const active = folderWrite && v2Snapshot?.exists() ? v2Snapshot : legacySnapshot;
      const serverVersion = safeVersion(active?.data()?.musicNoteStructureVersion);
      const serverFolders = active?.data()?.musicNoteFolders || {};
      if (expectedBases?.length) {
        for (const base of expectedBases) {
          if (comparableFolders(serverFolders[base.mode]) !== comparableFolders(base.folders)) {
            throw Object.assign(new Error('MUSIC_NOTE_STRUCTURE_STALE_SERVER_VERSION'), {
              code: 'music-note/stale-structure-version', serverVersion,
            });
          }
        }
      } else if (serverVersion >= version) {
        throw Object.assign(new Error('MUSIC_NOTE_STRUCTURE_STALE_SERVER_VERSION'), {
          code: 'music-note/stale-structure-version', serverVersion,
        });
      }
      // The entire requested write must have one verified baseline per mode.
      if (expectedBases?.length && requestedModes.some(mode =>
        !expectedBases.some(base => base.mode === mode))) {
        throw Object.assign(new Error('MUSIC_NOTE_STRUCTURE_UNVERIFIED_FOLDER_BASE'), {
          code: 'music-note/stale-structure-version', serverVersion,
        });
      }
      committedRevision = expectedBases?.length ? serverVersion + 1 : version;
      const changedModes = requestedModes.filter(mode =>
        comparableFolders(folderModes?.[mode]) !== comparableFolders(serverFolders[mode]));
      if (folderWrite) {
        // No-op folder edits produce W0, including unchanged updatedAt.
        if (!changedModes.length) {
          committedRevision = serverVersion;
          return;
        }
        // Never copy a stale legacy mode over an existing modern V2 mode.
        // An initial V2 snapshot copies only the server's current legacy view,
        // atomically with the first edit. Later old-client edits stay separate.
        const nextFolders: Record<string, unknown> = {
          ...(!v2Snapshot?.exists() ? serverFolders : {}),
          ...Object.fromEntries(changedModes.map(mode => [mode, folderModes?.[mode]])),
          ...(folderModes && Object.prototype.hasOwnProperty.call(folderModes, 'updatedAt')
            ? { updatedAt: folderModes.updatedAt } : {}),
        };
        transaction.set(v2Ref, {
          schemaVersion: 2,
          musicNoteFolders: nextFolders,
          ...(!v2Snapshot?.exists() ? {
            // Only first migration records old-mode fingerprints; subsequent
            // legacy edits do not modify them until the user reconciles.
            legacyBaseSignatures: {
              myNote: getMusicNoteLegacyFolderSignature(serverFolders.myNote),
              sharedNote: getMusicNoteLegacyFolderSignature(serverFolders.sharedNote),
            },
          } : {}),
          musicNoteStructureVersion: committedRevision,
          musicNoteStructureWriterToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }, { merge: true });
        return;
      }
      // Card/Like/Lock snapshots retain their old canonical and write rules.
      const nextPatch: Record<string, unknown> = { ...patch };
      if (Object.keys(nextPatch).every(item => item === 'musicNoteStructureVersion')) {
        committedRevision = serverVersion;
        return;
      }
      transaction.set(structureRef, {
        ...nextPatch, musicNoteStructureVersion: committedRevision,
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

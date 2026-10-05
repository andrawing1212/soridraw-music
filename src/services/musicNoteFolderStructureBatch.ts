import { doc, setDoc } from '../lib/firestoreMeasured';
import { db } from '../firebase';
import { runV1MutationBoundary } from '../data/v1MutationBoundary';

export type MusicNoteFolderModeKey = 'myNote' | 'sharedNote';

type PendingModeState = {
  folders: unknown[];
  version: number;
  updatedAtMs: number;
};

type PendingMusicNoteFolderStructure = {
  myNote?: PendingModeState;
  sharedNote?: PendingModeState;
  updatedAtMs: number;
};

const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000;
const STORAGE_PREFIX = 'soridraw.musicNote.folderStructureBatch.v1';

const timers = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
const memoryPending = new Map<string, PendingMusicNoteFolderStructure>();

const safeUid = (uid: string): string => String(uid || '').trim();
const storageKey = (uid: string): string => `${STORAGE_PREFIX}.${safeUid(uid)}`;
const safeVersion = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeModeState = (value: any): PendingModeState | undefined => {
  const version = safeVersion(value?.version);
  const updatedAtMs = safeVersion(value?.updatedAtMs);
  if (!Array.isArray(value?.folders) || version <= 0 || updatedAtMs <= 0) return undefined;
  return { folders: value.folders, version, updatedAtMs };
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

const writePending = (uid: string, pending: PendingMusicNoteFolderStructure): void => {
  const key = safeUid(uid);
  if (!key) return;
  memoryPending.set(key, pending);
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(storageKey(key), JSON.stringify(pending)); } catch {}
};

const clearAll = (uid: string): void => {
  const key = safeUid(uid);
  if (!key) return;
  const timer = timers.get(key);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  timers.delete(key);
  memoryPending.delete(key);
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
): void => {
  const key = safeUid(uid);
  const normalizedVersion = safeVersion(version);
  if (!key || normalizedVersion <= 0 || !Array.isArray(folders)) return;

  const current = readPending(key) || { updatedAtMs: 0 };
  const now = Date.now();
  const next: PendingMusicNoteFolderStructure = {
    ...current,
    [mode]: {
      folders,
      version: Math.max(normalizedVersion, safeVersion(current[mode]?.version)),
      updatedAtMs: now,
    },
    updatedAtMs: now,
  };
  writePending(key, next);
  schedule(key);
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
    return;
  }
  writePending(key, next);
  schedule(key);
};

export const flushMusicNoteFolderStructureBatch = async (uid: string): Promise<void> => {
  const key = safeUid(uid);
  if (!key) return;
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const pending = readPending(key);
    if (!pending) return;

    const capturedMy = pending.myNote;
    const capturedShared = pending.sharedNote;
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

    await runV1MutationBoundary({
      domain: 'musicNote',
      operation: 'structure-update',
      uid: key,
      affectedCount: 1,
      syncStructure: structurePatch,
    }, setDoc(doc(db, 'user_structures', key), structurePatch, { merge: true }));

    const latest = readPending(key);
    if (!latest) return;

    const next: PendingMusicNoteFolderStructure = { ...latest, updatedAtMs: latest.updatedAtMs };
    if (capturedMy && latest.myNote && latest.myNote.version <= capturedMy.version) delete next.myNote;
    if (capturedShared && latest.sharedNote && latest.sharedNote.version <= capturedShared.version) delete next.sharedNote;

    if (!next.myNote && !next.sharedNote) {
      clearAll(key);
      return;
    }
    writePending(key, next);
    schedule(key);
  })().catch((error) => {
    console.warn('[Music Note folder batch] canonical flush deferred; pending final state kept.', error);
    schedule(key);
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
  const elapsed = Math.max(0, Date.now() - safeVersion(pending.updatedAtMs));
  schedule(key, Math.max(0, MUSIC_NOTE_FOLDER_BATCH_MS - elapsed));
};

export const getPendingMusicNoteFolderStructureBatch = (
  uid: string,
): PendingMusicNoteFolderStructure | null => readPending(uid);

export const MUSIC_NOTE_FOLDER_STRUCTURE_BATCH_MS = MUSIC_NOTE_FOLDER_BATCH_MS;

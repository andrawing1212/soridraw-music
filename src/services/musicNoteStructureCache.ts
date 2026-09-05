import { doc, getDoc, getDocFromCache } from '../lib/firestoreMeasured';
import { db } from '../firebase';
import {
  MUSIC_NOTE_LOCAL_VERSION_BASE,
  MUSIC_NOTE_REMOTE_VERSION_BASE,
  MUSIC_NOTE_SYNC_EVENT,
} from './userDomainSyncService';

const STORAGE_BASE = 'soridraw_music_note_structure_cache_v1';
const SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000;

type StructureEnvelope = {
  schemaVersion: 1;
  complete: boolean;
  data: Record<string, any>;
  signalVersion: number;
  verifiedAt: number;
};

type StructureSession = {
  uid: string;
  envelope: StructureEnvelope;
  listeners: Set<(data: Record<string, any>) => void>;
  inflight: Promise<void> | null;
  eventHandler: ((event: Event) => void) | null;
  started: boolean;
};

const sessions = new Map<string, StructureSession>();
const storageKey = (uid: string) => `${STORAGE_BASE}_${uid}`;
const scopedVersionKey = (base: string, uid: string) => `${base}_${uid}`;

const emptyEnvelope = (): StructureEnvelope => ({
  schemaVersion: 1,
  complete: false,
  data: {},
  signalVersion: 0,
  verifiedAt: 0,
});

const readNumber = (key: string): number => {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const readEnvelope = (uid: string): StructureEnvelope => {
  if (!uid || typeof localStorage === 'undefined') return emptyEnvelope();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.data !== 'object') return emptyEnvelope();
    return {
      schemaVersion: 1,
      complete: parsed.complete === true,
      data: parsed.data || {},
      signalVersion: Math.max(0, Number(parsed.signalVersion || 0) || 0),
      verifiedAt: Math.max(0, Number(parsed.verifiedAt || 0) || 0),
    };
  } catch {
    return emptyEnvelope();
  }
};

const writeEnvelope = (uid: string, envelope: StructureEnvelope): void => {
  if (!uid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(storageKey(uid), JSON.stringify(envelope)); } catch {}
};

const publish = (session: StructureSession): void => {
  const data = session.envelope.data || {};
  session.listeners.forEach((listener) => {
    try { listener(data); } catch (error) { console.warn('Music Note structure cache listener failed.', error); }
  });
};

const mergePatch = (base: Record<string, any>, patch: Record<string, any>): Record<string, any> => {
  const next = { ...(base || {}), ...(patch || {}) };
  if (patch?.musicNoteFolders && typeof patch.musicNoteFolders === 'object') {
    next.musicNoteFolders = {
      ...((base as any)?.musicNoteFolders || {}),
      ...(patch.musicNoteFolders || {}),
    };
  }
  if (patch?.musicNoteCardState && typeof patch.musicNoteCardState === 'object') {
    next.musicNoteCardState = {
      ...((base as any)?.musicNoteCardState || {}),
      ...(patch.musicNoteCardState || {}),
      items: patch.musicNoteCardState?.items && typeof patch.musicNoteCardState.items === 'object'
        ? { ...patch.musicNoteCardState.items }
        : { ...((base as any)?.musicNoteCardState?.items || {}) },
    };
  }
  return next;
};

const snapshotData = (snapshot: any): Record<string, any> => snapshot?.exists?.()
  ? ((snapshot.data?.() || {}) as Record<string, any>)
  : {};

const refreshFromFirestore = async (
  session: StructureSession,
  signalVersion: number,
  preferCacheOnly = false,
): Promise<void> => {
  if (session.inflight) return session.inflight;
  const task = (async () => {
    const ref = doc(db, 'user_structures', session.uid);
    let snapshot: any = null;

    if (preferCacheOnly) {
      try { snapshot = await getDocFromCache(ref); } catch {}
    }
    if (!snapshot) snapshot = await getDoc(ref);

    session.envelope = {
      schemaVersion: 1,
      complete: true,
      data: snapshotData(snapshot),
      signalVersion: Math.max(session.envelope.signalVersion, signalVersion),
      verifiedAt: Date.now(),
    };
    writeEnvelope(session.uid, session.envelope);
    publish(session);
  })().catch((error) => {
    console.warn('Music Note structure refresh failed; persistent cache is preserved.', error);
  }).finally(() => {
    if (session.inflight === task) session.inflight = null;
  });
  session.inflight = task;
  return task;
};

const acknowledgeLocalSignal = (session: StructureSession, version: number): void => {
  if (!Number.isFinite(version) || version <= session.envelope.signalVersion) return;
  session.envelope = { ...session.envelope, signalVersion: version };
  writeEnvelope(session.uid, session.envelope);
};

const reconcile = (session: StructureSession): void => {
  const remoteVersion = readNumber(scopedVersionKey(MUSIC_NOTE_REMOTE_VERSION_BASE, session.uid));
  const localVersion = readNumber(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, session.uid));

  if (!session.envelope.complete) {
    // Migration fast path: the old onSnapshot listener usually left the same
    // document in Firestore IndexedDB. Reading that cache does not bill Firestore.
    void refreshFromFirestore(session, remoteVersion, true);
    return;
  }

  if (remoteVersion > session.envelope.signalVersion) {
    if (localVersion >= remoteVersion) {
      // Same-device mutation already patched this persistent structure cache.
      acknowledgeLocalSignal(session, remoteVersion);
    } else {
      void refreshFromFirestore(session, remoteVersion);
    }
    return;
  }

  if (Date.now() - session.envelope.verifiedAt >= SAFETY_REVERIFY_MS) {
    // Bounded safety verification: at most once per 24h, never once per refresh.
    void refreshFromFirestore(session, remoteVersion);
  }
};

const getSession = (uid: string): StructureSession => {
  const existing = sessions.get(uid);
  if (existing) return existing;
  const session: StructureSession = {
    uid,
    envelope: readEnvelope(uid),
    listeners: new Set(),
    inflight: null,
    eventHandler: null,
    started: false,
  };
  sessions.set(uid, session);
  return session;
};

export const subscribeMusicNoteStructureCache = (
  uid: string,
  listener: (data: Record<string, any>) => void,
): (() => void) => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return () => {};
  const session = getSession(safeUid);
  session.listeners.add(listener);

  if (session.envelope.complete) {
    const data = session.envelope.data;
    queueMicrotask(() => {
      if (session.listeners.has(listener)) listener(data);
    });
  }

  if (!session.started) {
    session.started = true;
    session.eventHandler = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail || {};
      if (String(detail.uid || '') !== safeUid) return;
      const version = Number(detail.version || 0);
      if (!Number.isFinite(version) || version <= session.envelope.signalVersion) return;
      const localVersion = readNumber(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, safeUid));
      if (localVersion >= version) acknowledgeLocalSignal(session, version);
      else void refreshFromFirestore(session, version);
    };
    window.addEventListener(MUSIC_NOTE_SYNC_EVENT, session.eventHandler as EventListener);
    reconcile(session);
  }

  return () => {
    session.listeners.delete(listener);
    // Keep the tiny local session and RTDB-event bridge alive for the SPA lifetime.
    // Route remounts therefore remain memory-only.
  };
};

export const patchMusicNoteStructureCache = (uid: string, patch: Record<string, any>): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  const session = getSession(safeUid);
  session.envelope = {
    ...session.envelope,
    data: mergePatch(session.envelope.data || {}, patch || {}),
    verifiedAt: session.envelope.complete ? Date.now() : session.envelope.verifiedAt,
  };
  writeEnvelope(safeUid, session.envelope);
  if (session.envelope.complete) publish(session);
};

export const SORIDRAW_MUSIC_NOTE_STRUCTURE_REFRESH_ZERO_1021 = true as const;

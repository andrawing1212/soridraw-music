import * as Firestore from 'firebase/firestore';
import {
  markFirestoreActualCacheHit,
  markFirestoreActualRead,
  markFirestoreActualWrite,
} from './cacheDiagnostics';

export * from 'firebase/firestore';

const SORIDRAW_927_MONOTONIC_SECTION_VERSION_AND_OP_TRACE = true;
const SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE = true;

const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
export type AdaptiveListIndexDirtyKind = 'musicNote' | 'library';
const adaptiveListIndexDirtyRevisions: Record<AdaptiveListIndexDirtyKind, number> = { musicNote: 0, library: 0 };
const isAdaptiveListPreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'preview.soridraw.com'
    || hostname === 'soridraw-preview.web.app'
    || hostname === 'soridraw-preview.firebaseapp.com';
};
const markAdaptiveListIndexDirtyBySource = (source: string): void => {
  if (!isAdaptiveListPreviewHost()) return;
  if (source === 'favorites' || source.startsWith('favorites:')) {
    adaptiveListIndexDirtyRevisions.musicNote += 1;
  } else if (source === 'suno_tracks/*/tracks' || source.startsWith('suno_tracks/*/tracks:')) {
    adaptiveListIndexDirtyRevisions.library += 1;
  }
};
export const readAdaptiveListIndexDirtyRevision = (kind: AdaptiveListIndexDirtyKind): number => (
  adaptiveListIndexDirtyRevisions[kind] || 0
);
export const clearAdaptiveListIndexDirtyRevision = (kind: AdaptiveListIndexDirtyKind, revision: number): void => {
  if (revision > 0 && adaptiveListIndexDirtyRevisions[kind] === revision) {
    adaptiveListIndexDirtyRevisions[kind] = 0;
  }
};

const normalizeSourcePath = (value: unknown): string => {
  const raw = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return 'unknown';
  const segments = raw.split('/').filter(Boolean);
  if (segments[0] === 'suno_tracks' && segments.length >= 3) return 'suno_tracks/*/tracks';
  if (segments[0] === 'user_list_caches') return 'user_list_caches';
  return segments[0] || 'unknown';
};

const getSourceLabel = (target: any): string => {
  try {
    const directPath = String(target?.path || '').trim();
    if (directPath) return normalizeSourcePath(directPath);

    const internalQuery = target?._query;
    const group = String(internalQuery?.collectionGroup || '').trim();
    if (group) return `group:${group}`;

    const internalPath = internalQuery?.path;
    if (Array.isArray(internalPath?.segments) && internalPath.segments.length > 0) {
      return normalizeSourcePath(internalPath.segments.join('/'));
    }
    if (typeof internalPath?.canonicalString === 'function') {
      const canonical = internalPath.canonicalString();
      if (canonical) return normalizeSourcePath(canonical);
    }
    const keyPath = String(target?._key?.path?.canonicalString?.() || '').trim();
    if (keyPath) return normalizeSourcePath(keyPath);
  } catch {}
  return 'unknown';
};

const countSnapshotRead = (snapshot: any, source: string) => {
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }
  if (Array.isArray(snapshot?.docs)) {
    markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), source);
    return;
  }
  markFirestoreActualRead(1, source);
};

export const getDoc = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDoc`;
  const snapshot = await (Firestore.getDoc as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDoc;

export const getDocFromServer = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDocFromServer`;
  const snapshot = await (Firestore.getDocFromServer as any)(...args);
  markFirestoreActualRead(1, source);
  return snapshot;
}) as typeof Firestore.getDocFromServer;

export const getDocs = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDocs`;
  const snapshot = await (Firestore.getDocs as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDocs;

export const setDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.setDoc as any)(...args);
  markAdaptiveListIndexDirtyBySource(source);
  markFirestoreActualWrite(1, `${source}:write`);
  return result;
}) as typeof Firestore.setDoc;

export const updateDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.updateDoc as any)(...args);
  markAdaptiveListIndexDirtyBySource(source);
  markFirestoreActualWrite(1, `${source}:write`);
  return result;
}) as typeof Firestore.updateDoc;

export const deleteDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.deleteDoc as any)(...args);
  markAdaptiveListIndexDirtyBySource(source);
  markFirestoreActualWrite(1, `${source}:write`);
  return result;
}) as typeof Firestore.deleteDoc;

export const addDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.addDoc as any)(...args);
  markAdaptiveListIndexDirtyBySource(source);
  markFirestoreActualWrite(1, `${source}:write`);
  return result;
}) as typeof Firestore.addDoc;

const snapshotFingerprint = (snapshot: any): string => {
  try {
    if (Array.isArray(snapshot?.docs)) {
      return JSON.stringify(snapshot.docs.map((docSnap: any) => [docSnap.id, docSnap.data?.()]));
    }
    return JSON.stringify([snapshot?.id || '', snapshot?.exists?.() ?? false, snapshot?.data?.()]);
  } catch {
    return `${Date.now()}_${Math.random()}`;
  }
};

type ListenerState = { seenServer: boolean; fingerprint: string; source: string };

const recordListenerSnapshot = (snapshot: any, state: ListenerState) => {
  if (snapshot?.metadata?.hasPendingWrites === true) {
    return;
  }
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }

  if (Array.isArray(snapshot?.docs)) {
    if (!state.seenServer) {
      state.seenServer = true;
      state.fingerprint = snapshotFingerprint(snapshot);
      markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), state.source);
      return;
    }
    let changed = 0;
    try {
      changed = snapshot.docChanges?.({ includeMetadataChanges: false })?.length || 0;
    } catch {
      try { changed = snapshot.docChanges?.()?.length || 0; } catch {}
    }
    const nextFingerprint = snapshotFingerprint(snapshot);
    if (changed > 0) markFirestoreActualRead(changed, state.source);
    else if (nextFingerprint !== state.fingerprint) {
      markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), state.source);
    }
    state.fingerprint = nextFingerprint;
    return;
  }

  const nextFingerprint = snapshotFingerprint(snapshot);
  if (!state.seenServer || nextFingerprint !== state.fingerprint) {
    markFirestoreActualRead(1, state.source);
  }
  state.seenServer = true;
  state.fingerprint = nextFingerprint;
};

export const onSnapshot = ((...rawArgs: any[]) => {
  const args = [...rawArgs];
  const state: ListenerState = {
    seenServer: false,
    fingerprint: '',
    source: `${getSourceLabel(args[0])}:onSnapshot`,
  };

  for (let index = 1; index < args.length; index += 1) {
    const candidate = args[index];
    if (typeof candidate === 'function') {
      const originalNext = candidate;
      args[index] = (snapshot: any) => {
        recordListenerSnapshot(snapshot, state);
        return originalNext(snapshot);
      };
      break;
    }
    if (candidate && typeof candidate === 'object' && typeof candidate.next === 'function') {
      const originalNext = candidate.next.bind(candidate);
      args[index] = {
        ...candidate,
        next: (snapshot: any) => {
          recordListenerSnapshot(snapshot, state);
          return originalNext(snapshot);
        },
      };
      break;
    }
  }

  return (Firestore.onSnapshot as any)(...args);
}) as typeof Firestore.onSnapshot;

export const writeBatch = ((...args: any[]) => {
  const batch: any = (Firestore.writeBatch as any)(...args);
  const sourceWrites: Record<string, number> = {};
  const rememberWrite = (target: any) => {
    const source = `${getSourceLabel(target)}:batch`;
    sourceWrites[source] = Number(sourceWrites[source] || 0) + 1;
  };
  const measured: any = {};
  measured.set = (...setArgs: any[]) => { rememberWrite(setArgs[0]); batch.set(...setArgs); return measured; };
  measured.update = (...updateArgs: any[]) => { rememberWrite(updateArgs[0]); batch.update(...updateArgs); return measured; };
  measured.delete = (...deleteArgs: any[]) => { rememberWrite(deleteArgs[0]); batch.delete(...deleteArgs); return measured; };
  measured.commit = async () => {
    const result = await batch.commit();
    Object.entries(sourceWrites).forEach(([source, count]) => {
      markAdaptiveListIndexDirtyBySource(source);
      markFirestoreActualWrite(count, source);
    });
    return result;
  };
  return measured;
}) as typeof Firestore.writeBatch;

export const runTransaction = (async (...rawArgs: any[]) => {
  const [db, updateFunction, options] = rawArgs;
  let committedWrites: Record<string, number> = {};
  const measuredUpdate = async (transaction: any) => {
    const attemptWrites: Record<string, number> = {};
    const rememberWrite = (target: any) => {
      const source = `${getSourceLabel(target)}:transactionWrite`;
      attemptWrites[source] = Number(attemptWrites[source] || 0) + 1;
    };
    const measured: any = {};
    measured.get = async (...getArgs: any[]) => {
      const snapshot = await transaction.get(...getArgs);
      markFirestoreActualRead(1, `${getSourceLabel(getArgs[0])}:transactionGet`);
      return snapshot;
    };
    measured.set = (...setArgs: any[]) => { rememberWrite(setArgs[0]); transaction.set(...setArgs); return measured; };
    measured.update = (...updateArgs: any[]) => { rememberWrite(updateArgs[0]); transaction.update(...updateArgs); return measured; };
    measured.delete = (...deleteArgs: any[]) => { rememberWrite(deleteArgs[0]); transaction.delete(...deleteArgs); return measured; };
    const result = await updateFunction(measured);
    committedWrites = attemptWrites;
    return result;
  };
  const result = options === undefined
    ? await (Firestore.runTransaction as any)(db, measuredUpdate)
    : await (Firestore.runTransaction as any)(db, measuredUpdate, options);
  Object.entries(committedWrites).forEach(([source, count]) => {
    markAdaptiveListIndexDirtyBySource(source);
    markFirestoreActualWrite(count, source);
  });
  return result;
}) as typeof Firestore.runTransaction;

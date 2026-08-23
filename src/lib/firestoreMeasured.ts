import * as Firestore from 'firebase/firestore';
import {
  markFirestoreActualCacheHit,
  markFirestoreActualRead,
  markFirestoreActualWrite,
} from './cacheDiagnostics';

export * from 'firebase/firestore';

const countSnapshotRead = (snapshot: any) => {
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }
  if (Array.isArray(snapshot?.docs)) {
    markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)));
    return;
  }
  markFirestoreActualRead(1);
};

export const getDoc = (async (...args: any[]) => {
  const snapshot = await (Firestore.getDoc as any)(...args);
  countSnapshotRead(snapshot);
  return snapshot;
}) as typeof Firestore.getDoc;

export const getDocFromServer = (async (...args: any[]) => {
  const snapshot = await (Firestore.getDocFromServer as any)(...args);
  markFirestoreActualRead(1);
  return snapshot;
}) as typeof Firestore.getDocFromServer;

export const getDocs = (async (...args: any[]) => {
  const snapshot = await (Firestore.getDocs as any)(...args);
  countSnapshotRead(snapshot);
  return snapshot;
}) as typeof Firestore.getDocs;

export const setDoc = (async (...args: any[]) => {
  const result = await (Firestore.setDoc as any)(...args);
  markFirestoreActualWrite(1);
  return result;
}) as typeof Firestore.setDoc;

export const updateDoc = (async (...args: any[]) => {
  const result = await (Firestore.updateDoc as any)(...args);
  markFirestoreActualWrite(1);
  return result;
}) as typeof Firestore.updateDoc;

export const deleteDoc = (async (...args: any[]) => {
  const result = await (Firestore.deleteDoc as any)(...args);
  markFirestoreActualWrite(1);
  return result;
}) as typeof Firestore.deleteDoc;

export const addDoc = (async (...args: any[]) => {
  const result = await (Firestore.addDoc as any)(...args);
  markFirestoreActualWrite(1);
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

const recordListenerSnapshot = (snapshot: any, state: { seenServer: boolean; fingerprint: string }) => {
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }

  if (Array.isArray(snapshot?.docs)) {
    if (!state.seenServer) {
      state.seenServer = true;
      state.fingerprint = snapshotFingerprint(snapshot);
      markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)));
      return;
    }
    let changed = 0;
    try {
      changed = snapshot.docChanges?.({ includeMetadataChanges: false })?.length || 0;
    } catch {
      try { changed = snapshot.docChanges?.()?.length || 0; } catch {}
    }
    const nextFingerprint = snapshotFingerprint(snapshot);
    if (changed > 0) markFirestoreActualRead(changed);
    else if (nextFingerprint !== state.fingerprint) markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)));
    state.fingerprint = nextFingerprint;
    return;
  }

  const nextFingerprint = snapshotFingerprint(snapshot);
  if (!state.seenServer || nextFingerprint !== state.fingerprint) {
    markFirestoreActualRead(1);
  }
  state.seenServer = true;
  state.fingerprint = nextFingerprint;
};

export const onSnapshot = ((...rawArgs: any[]) => {
  const args = [...rawArgs];
  const state = { seenServer: false, fingerprint: '' };

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
  let operations = 0;
  const measured: any = {};
  measured.set = (...setArgs: any[]) => { operations += 1; batch.set(...setArgs); return measured; };
  measured.update = (...updateArgs: any[]) => { operations += 1; batch.update(...updateArgs); return measured; };
  measured.delete = (...deleteArgs: any[]) => { operations += 1; batch.delete(...deleteArgs); return measured; };
  measured.commit = async () => {
    const result = await batch.commit();
    if (operations > 0) markFirestoreActualWrite(operations);
    return result;
  };
  return measured;
}) as typeof Firestore.writeBatch;

export const runTransaction = (async (...rawArgs: any[]) => {
  const [db, updateFunction, options] = rawArgs;
  let committedWrites = 0;
  const measuredUpdate = async (transaction: any) => {
    let attemptWrites = 0;
    const measured: any = {};
    measured.get = async (...getArgs: any[]) => {
      const snapshot = await transaction.get(...getArgs);
      markFirestoreActualRead(1);
      return snapshot;
    };
    measured.set = (...setArgs: any[]) => { attemptWrites += 1; transaction.set(...setArgs); return measured; };
    measured.update = (...updateArgs: any[]) => { attemptWrites += 1; transaction.update(...updateArgs); return measured; };
    measured.delete = (...deleteArgs: any[]) => { attemptWrites += 1; transaction.delete(...deleteArgs); return measured; };
    const result = await updateFunction(measured);
    committedWrites = attemptWrites;
    return result;
  };
  const result = options === undefined
    ? await (Firestore.runTransaction as any)(db, measuredUpdate)
    : await (Firestore.runTransaction as any)(db, measuredUpdate, options);
  if (committedWrites > 0) markFirestoreActualWrite(committedWrites);
  return result;
}) as typeof Firestore.runTransaction;

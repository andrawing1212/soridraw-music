/*
 * SORIDRAW Backend V2 Step 2-A3 — approved runtime bridge for lowest-risk V1 reads.
 *
 * SAFETY CONTRACT
 * - Read-only Firebase bridge: getDoc/getDocs/query/where only.
 * - No V2 path access and no write/delete/batch/transaction capability.
 * - The pure adapter in src/data remains Firebase-independent.
 * - Step 2-A3 initially wires only playlist-list reads through this bridge.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createV1UserDataAdapter,
  type V1CollectionDocument,
  type V1DocumentSnapshot,
  type V1ReadPort,
} from '../data/v1UserDataAdapter';
import type { FirestorePathSegments } from '../data/userDataRepository';

const splitPath = (path: FirestorePathSegments): [string, string[]] => {
  const [first, ...rest] = path;
  return [first, rest];
};

const firebaseV1ReadPort: V1ReadPort = {
  async getDocument<Payload extends Record<string, unknown>>(
    path: FirestorePathSegments,
  ): Promise<V1DocumentSnapshot<Payload>> {
    const [first, rest] = splitPath(path);
    const snapshot = await getDoc(doc(db, first, ...rest));
    return {
      id: snapshot.id,
      exists: snapshot.exists(),
      data: snapshot.exists() ? snapshot.data() as Payload : null,
    };
  },

  async listCollection<Payload extends Record<string, unknown>>(
    path: FirestorePathSegments,
  ): Promise<readonly V1CollectionDocument<Payload>[]> {
    const [first, rest] = splitPath(path);
    const snapshot = await getDocs(collection(db, first, ...rest));
    return snapshot.docs.map((entry) => ({
      id: entry.id,
      data: entry.data() as Payload,
    }));
  },

  async queryCollection<Payload extends Record<string, unknown>>(
    path: FirestorePathSegments,
    filters,
  ): Promise<readonly V1CollectionDocument<Payload>[]> {
    const [first, rest] = splitPath(path);
    const ref = collection(db, first, ...rest);
    const constraints = filters.map((filter) => {
      if (filter.op !== '==') {
        throw new Error(`[Backend V2 Step 2-A3] unsupported V1 query operator: ${filter.op}`);
      }
      return where(filter.field, '==', filter.value);
    });
    const snapshot = await getDocs(query(ref, ...constraints));
    return snapshot.docs.map((entry) => ({
      id: entry.id,
      data: entry.data() as Payload,
    }));
  },
};

export const v1UserDataReadAdapter = createV1UserDataAdapter(firebaseV1ReadPort);

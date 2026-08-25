/*
 * SORIDRAW Backend V2 mirror outbox — Step 2-A4a.
 *
 * SAFETY CONTRACT
 * - IndexedDB only. No Firebase SDK, network, UI or automatic retry loop.
 * - Runtime remains OFF.
 * - The outbox is intentionally separate from the expendable local cache DB so
 *   cache clearing cannot accidentally erase pending mirror work.
 * - Records contain only mutation identity/version/retry metadata; no song payload,
 *   lyrics, prompt, provider key, API key or secret is stored here.
 */

import {
  BACKEND_V2_MIRROR_RETRY_POLICY,
  createV2MirrorMutationEnvelope,
  getV2MirrorRetryDelayMs,
  isV2MirrorRetryExhausted,
  type V2MirrorMutationEnvelope,
} from './v2LiveMutation';

export const BACKEND_V2_MIRROR_OUTBOX_RUNTIME_ENABLED = false as const;
export const BACKEND_V2_MIRROR_OUTBOX_DB_NAME = 'soridraw_backend_v2_mirror_outbox';
export const BACKEND_V2_MIRROR_OUTBOX_DB_VERSION = 1;
export const BACKEND_V2_MIRROR_OUTBOX_STORE = 'mutations';
export const BACKEND_V2_MIRROR_OUTBOX_MAX_PER_USER = 200;

export type V2MirrorOutboxStatus = 'pending' | 'exhausted';

export type V2MirrorOutboxRecord = V2MirrorMutationEnvelope & {
  attemptCount: number;
  nextAttemptAtMs: number;
  lastAttemptAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
  status: V2MirrorOutboxStatus;
};

type KeyRangeFactory = {
  only(value: IDBValidKey | IDBKeyRange): IDBKeyRange;
};

export type BackendV2MirrorOutboxOptions = {
  factory?: IDBFactory | null;
  keyRange?: KeyRangeFactory | null;
  dbName?: string;
  now?: () => number;
  maxPerUser?: number;
};

const requireSegment = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`[Backend V2 mirror outbox] missing ${label}`);
  return normalized;
};

const requireNonNegativeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[Backend V2 mirror outbox] invalid ${label}`);
  }
  return value;
};

const requestToPromise = <T,>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

export class BackendV2MirrorOutbox {
  private readonly factory: IDBFactory | null;
  private readonly keyRange: KeyRangeFactory | null;
  private readonly dbName: string;
  private readonly now: () => number;
  private readonly maxPerUser: number;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(options: BackendV2MirrorOutboxOptions = {}) {
    this.factory = options.factory === undefined
      ? (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis ? globalThis.indexedDB : null)
      : options.factory;
    this.keyRange = options.keyRange === undefined
      ? (typeof globalThis !== 'undefined' && 'IDBKeyRange' in globalThis ? globalThis.IDBKeyRange : null)
      : options.keyRange;
    this.dbName = String(options.dbName || BACKEND_V2_MIRROR_OUTBOX_DB_NAME);
    this.now = options.now || (() => Date.now());
    this.maxPerUser = Number.isSafeInteger(options.maxPerUser) && Number(options.maxPerUser) > 0
      ? Number(options.maxPerUser)
      : BACKEND_V2_MIRROR_OUTBOX_MAX_PER_USER;
  }

  isAvailable(): boolean {
    return Boolean(this.factory && this.keyRange);
  }

  private async open(): Promise<IDBDatabase | null> {
    if (!this.factory || !this.keyRange) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let settled = false;
      const request = this.factory!.open(this.dbName, BACKEND_V2_MIRROR_OUTBOX_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BACKEND_V2_MIRROR_OUTBOX_STORE)) {
          const store = db.createObjectStore(BACKEND_V2_MIRROR_OUTBOX_STORE, { keyPath: 'mutationId' });
          store.createIndex('byUser', 'uid', { unique: false });
          store.createIndex('byUserNextAttempt', ['uid', 'nextAttemptAtMs'], { unique: false });
        }
      };
      request.onsuccess = () => {
        settled = true;
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        if (!settled) resolve(null);
      };
      request.onblocked = () => {
        if (!settled) resolve(null);
      };
    });

    const db = await this.dbPromise;
    if (!db) this.dbPromise = null;
    return db;
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db?.close();
    this.dbPromise = null;
  }

  async enqueue(input: V2MirrorMutationEnvelope): Promise<boolean> {
    // Rebuild through the pure contract to reject malformed/forbidden identities.
    const validated = createV2MirrorMutationEnvelope({
      uid: input.uid,
      targetKind: input.targetKind,
      targetSongId: input.targetSongId,
      source: input.source,
      operation: input.operation,
      sourceUpdatedAtMs: input.sourceUpdatedAtMs,
      enqueuedAtMs: input.enqueuedAtMs,
    });
    if (validated.mutationId !== input.mutationId) {
      throw new Error('[Backend V2 mirror outbox] mutationId does not match envelope');
    }

    const db = await this.open();
    if (!db || !this.keyRange) return false;
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE);
      const existingRequest = store.get(validated.mutationId);
      const userRecordsRequest = store.index('byUser').getAll(this.keyRange.only(validated.uid));
      const [existingRaw, userRecordsRaw] = await Promise.all([
        requestToPromise(existingRequest),
        requestToPromise(userRecordsRequest),
      ]);
      const existing = existingRaw as V2MirrorOutboxRecord | undefined;
      const userRecords = userRecordsRaw as V2MirrorOutboxRecord[];

      if (existing) {
        await transactionDone(transaction);
        return true;
      }
      if (userRecords.length >= this.maxPerUser) {
        transaction.abort();
        try { await transactionDone(transaction); } catch {}
        return false;
      }

      const nowMs = requireNonNegativeInteger(this.now(), 'now');
      const record: V2MirrorOutboxRecord = {
        ...validated,
        attemptCount: 0,
        nextAttemptAtMs: nowMs,
        lastAttemptAtMs: null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        status: 'pending',
      };
      store.add(record);
      await transactionDone(transaction);
      return true;
    } catch {
      return false;
    }
  }

  async listPending(
    uidInput: string,
    options: { readyAtMs?: number; limit?: number; includeExhausted?: boolean } = {},
  ): Promise<V2MirrorOutboxRecord[]> {
    const uid = requireSegment(uidInput, 'uid');
    const readyAtMs = requireNonNegativeInteger(options.readyAtMs ?? this.now(), 'readyAtMs');
    const limit = Math.max(1, Math.min(100, Number.isSafeInteger(options.limit) ? Number(options.limit) : 20));
    const db = await this.open();
    if (!db || !this.keyRange) return [];
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readonly');
      const records = await requestToPromise(
        transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE).index('byUser').getAll(this.keyRange.only(uid)),
      ) as V2MirrorOutboxRecord[];
      await transactionDone(transaction);
      return records
        .filter((record) => (options.includeExhausted || record.status === 'pending') && record.nextAttemptAtMs <= readyAtMs)
        .sort((a, b) => (
          a.nextAttemptAtMs - b.nextAttemptAtMs
          || a.sourceUpdatedAtMs - b.sourceUpdatedAtMs
          || a.mutationId.localeCompare(b.mutationId)
        ))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async get(mutationIdInput: string): Promise<V2MirrorOutboxRecord | null> {
    const mutationId = requireSegment(mutationIdInput, 'mutationId');
    const db = await this.open();
    if (!db) return null;
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readonly');
      const record = await requestToPromise(
        transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE).get(mutationId),
      ) as V2MirrorOutboxRecord | undefined;
      await transactionDone(transaction);
      return record || null;
    } catch {
      return null;
    }
  }

  async recordFailedAttempt(mutationIdInput: string, attemptedAtMsInput?: number): Promise<boolean> {
    const mutationId = requireSegment(mutationIdInput, 'mutationId');
    const attemptedAtMs = requireNonNegativeInteger(attemptedAtMsInput ?? this.now(), 'attemptedAtMs');
    const db = await this.open();
    if (!db) return false;
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE);
      const current = await requestToPromise(store.get(mutationId)) as V2MirrorOutboxRecord | undefined;
      if (!current) {
        transaction.abort();
        try { await transactionDone(transaction); } catch {}
        return false;
      }
      const attemptCount = current.attemptCount + 1;
      const exhausted = isV2MirrorRetryExhausted(attemptCount);
      const nextAttemptAtMs = exhausted
        ? attemptedAtMs
        : attemptedAtMs + getV2MirrorRetryDelayMs(attemptCount);
      store.put({
        ...current,
        attemptCount,
        lastAttemptAtMs: attemptedAtMs,
        nextAttemptAtMs,
        updatedAtMs: attemptedAtMs,
        status: exhausted ? 'exhausted' : 'pending',
      } satisfies V2MirrorOutboxRecord);
      await transactionDone(transaction);
      return true;
    } catch {
      return false;
    }
  }

  async remove(mutationIdInput: string): Promise<boolean> {
    const mutationId = requireSegment(mutationIdInput, 'mutationId');
    const db = await this.open();
    if (!db) return false;
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readwrite');
      transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE).delete(mutationId);
      await transactionDone(transaction);
      return true;
    } catch {
      return false;
    }
  }

  async clearUserOutbox(uidInput: string): Promise<boolean> {
    const uid = requireSegment(uidInput, 'uid');
    const db = await this.open();
    if (!db || !this.keyRange) return false;
    try {
      const transaction = db.transaction(BACKEND_V2_MIRROR_OUTBOX_STORE, 'readwrite');
      const store = transaction.objectStore(BACKEND_V2_MIRROR_OUTBOX_STORE);
      const request = store.index('byUser').openKeyCursor(this.keyRange.only(uid));
      const queued = new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(request.error || new Error('IndexedDB outbox clear cursor failed'));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          store.delete(cursor.primaryKey);
          cursor.continue();
        };
      });
      await Promise.all([queued, transactionDone(transaction)]);
      return true;
    } catch {
      return false;
    }
  }
}

// Inert singleton. The DB is not opened until a future explicitly approved caller invokes it.
export const backendV2MirrorOutbox = new BackendV2MirrorOutbox();

export const BACKEND_V2_MIRROR_OUTBOX_POLICY = Object.freeze({
  maxPerUser: BACKEND_V2_MIRROR_OUTBOX_MAX_PER_USER,
  maxRetryAttempts: BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts,
});

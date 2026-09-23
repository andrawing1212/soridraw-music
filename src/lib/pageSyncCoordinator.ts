import type { User } from 'firebase/auth';
import { readFirestoreActual } from './cacheDiagnostics';
import { readCloudflareDiagnostics } from './cloudflareDiagnostics';
import {
  flushPendingExploreLikesForPageExit,
  getPendingExploreLikeMutationCount,
} from '../services/exploreLikeService';
import {
  flushPendingExplorePublicationsForPageExit,
  getPendingExplorePublicationMutationCount,
} from '../services/explorePublicationService';
import {
  flushPendingCatalogPublishes,
  getPendingCatalogPublishCount,
} from './userDataEngine';

export const SORIDRAW_PAGE_EXIT_BATCH_SYNC_081 = true;
export const PAGE_SYNC_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:page-sync-diagnostics-update';
const PAGE_SYNC_DIAGNOSTICS_STORAGE_KEY = 'soridraw_page_sync_diagnostics_v1';

export type SoridrawPageSyncReason =
  | 'route-change'
  | 'music-note-exit'
  | 'library-exit'
  | 'startup-recovery'
  | 'manual';

type PageSyncHandler = {
  key: string;
  uid: string;
  count: () => number | Promise<number>;
  flush: () => void | Promise<void>;
};

export type PageSyncDiagnosticState = {
  syncCount: number;
  noopCount: number;
  pendingChanges: number;
  reason: SoridrawPageSyncReason | '';
  status: 'idle' | 'noop' | 'syncing' | 'success' | 'error';
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  firestoreReads: number;
  firestoreWrites: number;
  updatedAt: number;
};

const handlers = new Map<string, PageSyncHandler>();
const inflightByUid = new Map<string, Promise<PageSyncDiagnosticState>>();
let pageClosing = false;

const emptyDiagnostics = (): PageSyncDiagnosticState => ({
  syncCount: 0,
  noopCount: 0,
  pendingChanges: 0,
  reason: '',
  status: 'idle',
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  firestoreReads: 0,
  firestoreWrites: 0,
  updatedAt: 0,
});

export const readPageSyncDiagnostics = (): PageSyncDiagnosticState => {
  if (typeof sessionStorage === 'undefined') return emptyDiagnostics();
  try {
    const raw = sessionStorage.getItem(PAGE_SYNC_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return emptyDiagnostics();
    const parsed = JSON.parse(raw);
    return { ...emptyDiagnostics(), ...parsed };
  } catch {
    return emptyDiagnostics();
  }
};

const publishDiagnostics = (patch: Partial<PageSyncDiagnosticState>) => {
  const next = { ...readPageSyncDiagnostics(), ...patch, updatedAt: Date.now() };
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(PAGE_SYNC_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PageSyncDiagnosticState>(PAGE_SYNC_DIAGNOSTICS_UPDATE_EVENT, { detail: next }));
  }
  return next;
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { pageClosing = true; }, { capture: true });
  window.addEventListener('pageshow', () => { pageClosing = false; }, { capture: true });
}

export const registerPageSyncHandler = (handler: PageSyncHandler): (() => void) => {
  handlers.set(handler.key, handler);
  return () => {
    if (handlers.get(handler.key) === handler) handlers.delete(handler.key);
  };
};

const readLocalPendingCount = async (uid: string) => {
  const ownedHandlers = [...handlers.values()].filter((handler) => handler.uid === uid);
  const handlerCounts = await Promise.all(ownedHandlers.map(async (handler) => {
    try { return Math.max(0, Math.floor(Number(await handler.count()) || 0)); } catch { return 0; }
  }));
  return {
    likes: getPendingExploreLikeMutationCount(uid),
    publications: getPendingExplorePublicationMutationCount(uid),
    catalogs: getPendingCatalogPublishCount(uid),
    handlers: ownedHandlers,
    handlerCount: handlerCounts.reduce((sum, value) => sum + value, 0),
  };
};

export const getPendingPageSyncChangeCount = async (uid: string): Promise<number> => {
  if (!uid) return 0;
  const pending = await readLocalPendingCount(uid);
  return pending.likes + pending.publications + pending.catalogs + pending.handlerCount;
};

export const flushSoridrawPageSync = async (
  user: User | null | undefined,
  reason: SoridrawPageSyncReason,
): Promise<PageSyncDiagnosticState> => {
  const uid = String(user?.uid || '').trim();
  if (!uid) return readPageSyncDiagnostics();
  if (pageClosing && reason !== 'startup-recovery' && reason !== 'manual') {
    // Browser/app close is intentionally local-only. Durable outboxes/drafts are
    // replayed on the next authenticated launch instead of trusting unload fetches.
    return readPageSyncDiagnostics();
  }
  const existing = inflightByUid.get(uid);
  if (existing) return existing;

  const task = (async () => {
    const pending = await readLocalPendingCount(uid);
    const pendingChanges = pending.likes + pending.publications + pending.catalogs + pending.handlerCount;
    if (pendingChanges <= 0) {
      const previous = readPageSyncDiagnostics();
      return publishDiagnostics({
        noopCount: previous.noopCount + 1,
        pendingChanges: 0,
        reason,
        status: 'noop',
        workerRequests: 0,
        d1RowsRead: 0,
        d1RowsWritten: 0,
        firestoreReads: 0,
        firestoreWrites: 0,
      });
    }

    const beforeCloudflare = readCloudflareDiagnostics();
    const beforeFirestore = readFirestoreActual();
    publishDiagnostics({ pendingChanges, reason, status: 'syncing' });

    const jobs: Promise<unknown>[] = [];
    if (pending.likes > 0) jobs.push(flushPendingExploreLikesForPageExit(user));
    if (pending.publications > 0) jobs.push(flushPendingExplorePublicationsForPageExit(user));
    for (const handler of pending.handlers) jobs.push(Promise.resolve(handler.flush()));

    const settled = await Promise.allSettled(jobs);
    let failed = settled.some((result) => result.status === 'rejected');
    // Catalog deltas are snapshots of successful mutations, not the optimistic
    // pre-flush UI. Publish only after Music Note's batched Firestore write finishes
    // (and schedules its own new catalog delta). Do not clear that delta on failure.
    if (!failed && getPendingCatalogPublishCount(uid) > 0) {
      try { await flushPendingCatalogPublishes(uid); }
      catch (error) {
        failed = true;
        console.warn('Post-mutation catalog publish deferred.', error);
      }
    }
    const afterCloudflare = readCloudflareDiagnostics();
    const afterFirestore = readFirestoreActual();
    const previous = readPageSyncDiagnostics();
    const next = publishDiagnostics({
      syncCount: previous.syncCount + 1,
      pendingChanges,
      reason,
      status: failed ? 'error' : 'success',
      workerRequests: Math.max(0, afterCloudflare.workerRequests - beforeCloudflare.workerRequests),
      d1RowsRead: Math.max(0, afterCloudflare.d1RowsRead - beforeCloudflare.d1RowsRead),
      d1RowsWritten: Math.max(0, afterCloudflare.d1RowsWritten - beforeCloudflare.d1RowsWritten),
      firestoreReads: Math.max(0, afterFirestore.reads - beforeFirestore.reads),
      firestoreWrites: Math.max(0, afterFirestore.writes - beforeFirestore.writes),
    });
    if (failed) throw new Error('PAGE_SYNC_PARTIAL_FAILURE');
    return next;
  })().finally(() => {
    inflightByUid.delete(uid);
  });

  inflightByUid.set(uid, task);
  return task;
};

export const recoverSoridrawPendingSync = async (user: User | null | undefined) => {
  const uid = String(user?.uid || '').trim();
  if (!uid) return readPageSyncDiagnostics();
  const pending = await readLocalPendingCount(uid);
  // Startup does no server work at all when there is no durable local mutation.
  if (pending.likes + pending.publications + pending.catalogs + pending.handlerCount <= 0) {
    return readPageSyncDiagnostics();
  }
  return flushSoridrawPageSync(user, 'startup-recovery');
};

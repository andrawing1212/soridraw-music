export type StudioHeartPendingIntent = {
  schemaVersion: 1;
  uid: string;
  documentId: string;
  identityKey: string;
  baselineSaved: boolean;
  desiredSaved: boolean;
  baselineFavorite: any | null;
  song: any;
  updatedAtMs: number;
  signalVersion: number;
  pendingRemotePreviewVersion: number;
  retryCount: number;
};

const STORAGE_BASE = 'soridraw_studio_heart_pending_v1';
const MAX_INTENTS = 20;

const storageKey = (uid: string) => `${STORAGE_BASE}_${uid}`;

const normalizeIntent = (uid: string, value: any): StudioHeartPendingIntent | null => {
  if (!value || typeof value !== 'object') return null;
  const documentId = String(value.documentId || '').trim();
  const identityKey = String(value.identityKey || '').trim();
  if (!uid || !documentId || !identityKey || typeof value.baselineSaved !== 'boolean' || typeof value.desiredSaved !== 'boolean') {
    return null;
  }
  return {
    schemaVersion: 1,
    uid,
    documentId,
    identityKey,
    baselineSaved: value.baselineSaved,
    desiredSaved: value.desiredSaved,
    baselineFavorite: value.baselineFavorite && typeof value.baselineFavorite === 'object' ? value.baselineFavorite : null,
    song: value.song && typeof value.song === 'object' ? value.song : null,
    updatedAtMs: Math.max(0, Math.floor(Number(value.updatedAtMs || 0))),
    signalVersion: Math.max(0, Math.floor(Number(value.signalVersion || 0))),
    pendingRemotePreviewVersion: Math.max(0, Math.floor(Number(value.pendingRemotePreviewVersion || 0))),
    retryCount: Math.max(0, Math.min(2, Math.floor(Number(value.retryCount || 0)))),
  };
};

export const listStudioHeartPendingIntents = (uid: string): StudioHeartPendingIntent[] => {
  if (!uid || typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(uid)) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return Object.values(raw)
      .map((value) => normalizeIntent(uid, value))
      .filter((value): value is StudioHeartPendingIntent => Boolean(value))
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  } catch {
    return [];
  }
};

const writeAll = (uid: string, intents: StudioHeartPendingIntent[]) => {
  if (!uid || typeof localStorage === 'undefined') return;
  const ordered = [...intents]
    .filter((intent) => intent?.documentId && intent.uid === uid)
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  // Never discard an older unsettled song to accept a new one.
  // Any oversized legacy outbox is preserved unchanged, too.
  if (ordered.length > MAX_INTENTS) return;
  const next: Record<string, StudioHeartPendingIntent> = {};
  for (const intent of ordered) next[intent.documentId] = intent;
  try {
    if (ordered.length > 0) localStorage.setItem(storageKey(uid), JSON.stringify(next));
    else localStorage.removeItem(storageKey(uid));
  } catch {}
};

export const readStudioHeartPendingIntent = (uid: string, documentId: string): StudioHeartPendingIntent | null => {
  const safeDocumentId = String(documentId || '').trim();
  if (!uid || !safeDocumentId) return null;
  return listStudioHeartPendingIntents(uid).find((intent) => intent.documentId === safeDocumentId) || null;
};

export const writeStudioHeartPendingIntent = (intent: StudioHeartPendingIntent): StudioHeartPendingIntent => {
  const uid = String(intent?.uid || '').trim();
  const documentId = String(intent?.documentId || '').trim();
  if (!uid || !documentId) return intent;
  const existing = listStudioHeartPendingIntents(uid).filter((item) => item.documentId !== documentId);
  const normalized: StudioHeartPendingIntent = {
    ...intent,
    schemaVersion: 1,
    uid,
    documentId,
    updatedAtMs: Math.max(1, Math.floor(Number(intent.updatedAtMs || Date.now()))),
    signalVersion: Math.max(0, Math.floor(Number(intent.signalVersion || 0))),
    pendingRemotePreviewVersion: Math.max(0, Math.floor(Number(intent.pendingRemotePreviewVersion || 0))),
    retryCount: Math.max(0, Math.min(2, Math.floor(Number(intent.retryCount || 0)))),
  };
  writeAll(uid, [normalized, ...existing]);
  return normalized;
};

// app501 — localStorage quota may silently reject the underlying batched
// write. Never declare a Studio heart saved unless the exact latest intent is
// readable back. The common path is still the same 30-second W0/W1 batch.
export const writeStudioHeartPendingIntentChecked = (
  intent: StudioHeartPendingIntent,
): 'stored' | 'blocked-empty' | 'blocked-existing' | 'blocked-capacity' => {
  const uid = String(intent?.uid || '').trim();
  const documentId = String(intent?.documentId || '').trim();
  if (!uid || !documentId) return 'blocked-empty';
  const allPending = listStudioHeartPendingIntents(uid);
  const previous = allPending.find((item) => item.documentId === documentId) || null;
  // At 20 songs, allow existing edits but send a new song to the
  // single-document canonical fallback rather than evicting older intents.
  if (!previous && allPending.length >= MAX_INTENTS) return 'blocked-capacity';
  writeStudioHeartPendingIntent(intent);
  const confirmed = readStudioHeartPendingIntent(uid, documentId);
  if (
    confirmed
    && confirmed.uid === uid
    && confirmed.documentId === documentId
    && confirmed.updatedAtMs === Math.max(1, Math.floor(Number(intent.updatedAtMs || 0)))
    && confirmed.desiredSaved === intent.desiredSaved
    && confirmed.identityKey === intent.identityKey
    && confirmed.baselineSaved === intent.baselineSaved
    && confirmed.signalVersion === intent.signalVersion
    && confirmed.pendingRemotePreviewVersion === intent.pendingRemotePreviewVersion
    && confirmed.retryCount === intent.retryCount
    && JSON.stringify(confirmed.song) === JSON.stringify(intent.song)
    && JSON.stringify(confirmed.baselineFavorite) === JSON.stringify(intent.baselineFavorite)
  ) return 'stored';
  // An older pending mutation may still run. Do not perform a competing direct
  // write or pretend the new click was accepted if that mutation is retained.
  return previous ? 'blocked-existing' : 'blocked-empty';
};

export const removeStudioHeartPendingIntent = (uid: string, documentId: string): void => {
  const safeDocumentId = String(documentId || '').trim();
  if (!uid || !safeDocumentId) return;
  writeAll(uid, listStudioHeartPendingIntents(uid).filter((intent) => intent.documentId !== safeDocumentId));
};

export const updateStudioHeartPendingIntent = (
  uid: string,
  documentId: string,
  updater: (current: StudioHeartPendingIntent) => StudioHeartPendingIntent | null,
): StudioHeartPendingIntent | null => {
  const current = readStudioHeartPendingIntent(uid, documentId);
  if (!current) return null;
  const next = updater(current);
  if (!next) {
    removeStudioHeartPendingIntent(uid, documentId);
    return null;
  }
  return writeStudioHeartPendingIntent(next);
};

// Only durable canonical favorites may be merged into the server Catalog.
// Immediate pending/RTDB previews remain visible through App overlays.
export const isStudioHeartOptimisticFavorite = (favorite: any): boolean => (
  favorite?.__studioHeartPendingLocal === true
  || favorite?.__studioHeartRemotePreviewLocal === true
);

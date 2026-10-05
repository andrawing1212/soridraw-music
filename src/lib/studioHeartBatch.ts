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
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
      .slice(0, MAX_INTENTS);
  } catch {
    return [];
  }
};

const writeAll = (uid: string, intents: StudioHeartPendingIntent[]) => {
  if (!uid || typeof localStorage === 'undefined') return;
  const ordered = [...intents]
    .filter((intent) => intent?.documentId && intent.uid === uid)
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, MAX_INTENTS);
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

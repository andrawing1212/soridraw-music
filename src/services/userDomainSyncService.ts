import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import {
  addV1MutationPostSuccessHook,
  type V1MutationBoundaryContext,
} from '../data/v1MutationBoundary';

export type UserDomainSyncKind = 'musicNote' | 'recentSongs';

export type UserDomainSyncSignal = {
  version: number;
  at: number;
  originDeviceId: string;
  operation: string;
  affectedCount: number;
  documentIds: string[];
  truncated: boolean;
};

const GENERIC_DEVICE_STORAGE_KEY = 'soridraw_user_domain_sync_device_v1';
const MUSIC_NOTE_DEVICE_STORAGE_KEY = 'soridraw_music_note_device_id_v1';
export const MUSIC_NOTE_REMOTE_VERSION_BASE = 'soridraw_music_note_remote_sync_version_v1';
export const MUSIC_NOTE_LOCAL_VERSION_BASE = 'soridraw_music_note_local_sync_version_v1';
const RECENT_LOCAL_VERSION_BASE = 'soridraw_recent_songs_local_sync_version_v2';
export const MUSIC_NOTE_SYNC_EVENT = 'soridraw:music-note-sync-version';
const RECENT_SONGS_SYNC_EVENT = 'soridraw:recent-songs-sync-version-v2';
const MAX_DOCUMENT_IDS = 10;

const getStoredDeviceId = (storageKey: string, prefix: string): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = String(window.localStorage.getItem(storageKey) || '').trim();
    if (existing) return existing;
    const next = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `${prefix}_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const getDeviceId = (kind: UserDomainSyncKind): string => kind === 'musicNote'
  ? getStoredDeviceId(MUSIC_NOTE_DEVICE_STORAGE_KEY, 'mn')
  : getStoredDeviceId(GENERIC_DEVICE_STORAGE_KEY, 'd');

const scopedVersionKey = (base: string, uid: string) => `${base}_${uid}`;

const readLocalNumber = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeLocalNumberMax = (key: string, value: number): void => {
  if (typeof window === 'undefined' || !Number.isFinite(value) || value <= 0) return;
  try {
    window.localStorage.setItem(key, String(Math.max(readLocalNumber(key), Math.floor(value))));
  } catch {}
};

const resultDocumentId = (result: unknown): string => {
  if (!result || typeof result !== 'object') return '';
  return String((result as { id?: unknown }).id || '').trim();
};

const buildSignal = (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): UserDomainSyncSignal => {
  const rawIds = [
    ...(context.documentIds || []),
    ...(context.domain === 'musicNote' && context.operation === 'save' ? [resultDocumentId(result)] : []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(rawIds)];
  const now = Date.now();
  const kind: UserDomainSyncKind = context.domain === 'musicNote' ? 'musicNote' : 'recentSongs';
  return {
    version: now,
    at: now,
    originDeviceId: getDeviceId(kind),
    operation: String(context.operation || '').slice(0, 48),
    affectedCount: Math.max(0, Math.min(1_000_000, Number(context.affectedCount || uniqueIds.length || 1) || 1)),
    documentIds: uniqueIds.slice(0, MAX_DOCUMENT_IDS),
    truncated: uniqueIds.length > MAX_DOCUMENT_IDS,
  };
};

const publishSignal = async (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): Promise<void> => {
  const uid = String(context.uid || '').trim();
  if (!uid) return;
  const kind: UserDomainSyncKind = context.domain === 'musicNote' ? 'musicNote' : 'recentSongs';
  await set(ref(realtimeDb, `userSync/${uid}/${kind}`), buildSignal(context, result));
};

const normalizeSignal = (raw: unknown): UserDomainSyncSignal | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const version = Number(value.version || 0);
  const at = Number(value.at || 0);
  const originDeviceId = String(value.originDeviceId || '').trim();
  const operation = String(value.operation || '').trim().slice(0, 48);
  if (!Number.isFinite(version) || version <= 0 || !originDeviceId || !operation) return null;
  const documentIds = Array.isArray(value.documentIds)
    ? value.documentIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, MAX_DOCUMENT_IDS)
    : [];
  return {
    version,
    at: Number.isFinite(at) && at > 0 ? at : version,
    originDeviceId,
    operation,
    affectedCount: Math.max(0, Math.min(1_000_000, Number(value.affectedCount || 0) || 0)),
    documentIds,
    truncated: value.truncated === true,
  };
};

const dispatchSignal = (uid: string, kind: UserDomainSyncKind, signal: UserDomainSyncSignal): void => {
  if (typeof window === 'undefined') return;

  if (kind === 'musicNote') {
    writeLocalNumberMax(scopedVersionKey(MUSIC_NOTE_REMOTE_VERSION_BASE, uid), signal.version);
    if (signal.originDeviceId === getDeviceId('musicNote')) {
      // The successful local mutation already patched Music Note cache/state.
      // Acknowledge its RTDB mirror before dispatch so the existing incremental
      // handler can never reread Firestore for the same-device mutation.
      writeLocalNumberMax(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, uid), signal.version);
    }
    window.dispatchEvent(new CustomEvent(MUSIC_NOTE_SYNC_EVENT, {
      detail: { uid, version: signal.version, originDeviceId: signal.originDeviceId },
    }));
    return;
  }

  if (signal.originDeviceId === getDeviceId('recentSongs')) {
    // Recent-song writes save the aggregate document before this mirror fires.
    // Advance the local gate so the existing event consumer does not reread that
    // same document on the device that just wrote it.
    writeLocalNumberMax(scopedVersionKey(RECENT_LOCAL_VERSION_BASE, uid), signal.version);
  }
  window.dispatchEvent(new CustomEvent(RECENT_SONGS_SYNC_EVENT, {
    detail: { uid, version: signal.version },
  }));
};

let activeUid = '';
let unsubscribeMusicNote: Unsubscribe | null = null;
let unsubscribeRecentSongs: Unsubscribe | null = null;

const stopDomainSubscriptions = () => {
  unsubscribeMusicNote?.();
  unsubscribeRecentSongs?.();
  unsubscribeMusicNote = null;
  unsubscribeRecentSongs = null;
  activeUid = '';
};

const startDomainSubscriptions = (uid: string) => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || activeUid === safeUid) return;
  stopDomainSubscriptions();
  activeUid = safeUid;

  unsubscribeMusicNote = onValue(ref(realtimeDb, `userSync/${safeUid}/musicNote`), (snapshot) => {
    const signal = normalizeSignal(snapshot.val());
    if (signal) dispatchSignal(safeUid, 'musicNote', signal);
  }, (error) => {
    console.warn('Music Note RTDB sync signal unavailable; Firestore fallback remains active.', error);
  });

  unsubscribeRecentSongs = onValue(ref(realtimeDb, `userSync/${safeUid}/recentSongs`), (snapshot) => {
    const signal = normalizeSignal(snapshot.val());
    if (signal) dispatchSignal(safeUid, 'recentSongs', signal);
  }, (error) => {
    console.warn('Recent-song RTDB sync signal unavailable; Firestore fallback remains active.', error);
  });
};

// SORIDRAW_USER_DOMAIN_SYNC_STAGE2A_20260905
// Mutation-only publisher: app entry, reload, cache hydration and ordinary reads never call set().
// The payload is fixed-size and contains at most 10 document IDs.
addV1MutationPostSuccessHook(publishSignal);

// SORIDRAW_USER_DOMAIN_SYNC_STAGE2B_20260905
// Read-only UID-scoped RTDB subscribers feed the existing version-event consumers.
// Stage2 keeps the Firestore users/{uid} listener as fallback, so this cannot remove
// role/security or cross-device behavior before deployment/runtime validation.
onAuthStateChanged(auth, (user) => {
  if (user?.uid) startDomainSubscriptions(user.uid);
  else stopDomainSubscriptions();
});

import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

export type UserControlRevision = {
  revision: string;
  updatedAt: number;
  reason: string;
};

const STORAGE_PREFIX = 'soridraw_user_control_revision_v1_';
const storageKey = (uid: string) => `${STORAGE_PREFIX}${uid}`;

export const readSeenUserControlRevision = (uid: string): string => {
  if (!uid || typeof window === 'undefined') return '';
  try { return String(window.localStorage.getItem(storageKey(uid)) || ''); } catch { return ''; }
};

export const writeSeenUserControlRevision = (uid: string, revision: string) => {
  if (!uid || !revision || typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(uid), revision); } catch {}
};

const normalizeRevision = (raw: unknown): UserControlRevision | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const revision = String(value.revision || '').trim();
  if (!revision) return null;
  return {
    revision,
    updatedAt: Math.max(0, Number(value.updatedAt || 0) || 0),
    reason: String(value.reason || '').slice(0, 64),
  };
};

// SORIDRAW_USER_CONTROL_REVISION_STAGE1_20260905
// One tiny UID-scoped RTDB node only. Never read Firestore or any song collection here.
export const subscribeUserControlRevision = (
  uid: string,
  onRevision: (value: UserControlRevision | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => {
  if (!uid) return () => undefined;
  return onValue(
    ref(realtimeDb, `userControls/${uid}`),
    (snapshot) => onRevision(normalizeRevision(snapshot.val())),
    (error) => onError?.(error),
  );
};

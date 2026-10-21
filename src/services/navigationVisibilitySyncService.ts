import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';
import type { SplitFrameMode } from '../constants/splitFrameGlobal';
import {
  normalizeNavigationVisibilitySettings,
  type NavigationVisibilitySettings,
} from '../constants/navigationVisibility';

export type NavigationVisibilitySyncPayload = {
  revision: string;
  updatedAt: number;
  settings: NavigationVisibilitySettings;
};

const normalizePayload = (raw: unknown): NavigationVisibilitySyncPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const revision = String(value.revision || '').trim();
  if (!revision) return null;
  return {
    revision,
    updatedAt: Math.max(0, Number(value.updatedAt || 0) || 0),
    settings: normalizeNavigationVisibilitySettings(value),
  };
};


// app450: share the already-running Remote Config realtime connection used
// by the version signal. No extra RTDB read, SDK connection, or Rules change.
import {
  SPLIT_FRAME_REMOTE_EVENT,
  readSplitFrameRemoteState,
} from './versionSignalService';

export const readCurrentSplitFrameMode = (): SplitFrameMode => readSplitFrameRemoteState().mode;
export const readCurrentSplitFrameRevision = (): number => readSplitFrameRemoteState().revision;
export const isSplitFrameServerReady = (): boolean =>
  readSplitFrameRemoteState().ready && (typeof navigator === 'undefined' || navigator.onLine);
export const subscribeSplitFrameMode = (listener: (mode: SplitFrameMode) => void): Unsubscribe => {
  const onChange = () => listener(readCurrentSplitFrameMode());
  if (typeof window !== 'undefined') {
    window.addEventListener(SPLIT_FRAME_REMOTE_EVENT, onChange);
    window.addEventListener('offline', onChange);
    window.addEventListener('online', onChange);
  }
  onChange();
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(SPLIT_FRAME_REMOTE_EVENT, onChange);
      window.removeEventListener('offline', onChange);
      window.removeEventListener('online', onChange);
    }
  };
};

// SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
// One tiny shared RTDB payload. It mirrors only seven menu booleans + revision;
// it never reads Firestore, song data, Feed, profile, or any user collection.
export const subscribeNavigationVisibilitySync = (
  onPayload: (payload: NavigationVisibilitySyncPayload | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => {
  // The menu node is also written by older TEST/PRODUCTION Functions.
  // Keep the frame signal on an isolated tiny sibling so legacy .set() menu
  // writers CANNOT erase the Master-selected mode.
  const unsubscribeMenu = onValue(
    ref(realtimeDb, 'publicSync/navigationVisibility'),
    (snapshot) => onPayload(normalizePayload(snapshot.val())),
    (error) => onError?.(error),
  );
  return unsubscribeMenu;
};

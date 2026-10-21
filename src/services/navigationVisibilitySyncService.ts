import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';
import { DEFAULT_SPLIT_FRAME_MODE, getSplitFrameEnvironment, parseSplitFrameMode, type SplitFrameMode } from '../constants/splitFrameGlobal';
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


// Reuse the app's EXISTING navigationVisibility RTDB onValue listener:
// no second per-user listener, Firestore read, poll or per-drag network request.
const splitFrameListeners = new Set<(mode: SplitFrameMode) => void>();
let currentSplitFrameMode: SplitFrameMode = DEFAULT_SPLIT_FRAME_MODE;
export const readCurrentSplitFrameMode = (): SplitFrameMode => currentSplitFrameMode;
export const subscribeSplitFrameMode = (listener: (mode: SplitFrameMode) => void): Unsubscribe => {
  splitFrameListeners.add(listener);
  listener(currentSplitFrameMode);
  return () => { splitFrameListeners.delete(listener); };
};
const publishSplitFrameMode = (raw: unknown) => {
  const env = getSplitFrameEnvironment();
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const modes = data.splitFrameModes && typeof data.splitFrameModes === 'object'
    ? data.splitFrameModes as Record<string, unknown> : {};
  const mode = env ? parseSplitFrameMode(modes[env]) : DEFAULT_SPLIT_FRAME_MODE;
  if (mode === currentSplitFrameMode) return;
  currentSplitFrameMode = mode;
  splitFrameListeners.forEach((listener) => listener(mode));
};

// SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
// One tiny shared RTDB payload. It mirrors only seven menu booleans + revision;
// it never reads Firestore, song data, Feed, profile, or any user collection.
export const subscribeNavigationVisibilitySync = (
  onPayload: (payload: NavigationVisibilitySyncPayload | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => onValue(
  ref(realtimeDb, 'publicSync/navigationVisibility'),
  (snapshot) => {
    const raw = snapshot.val();
    publishSplitFrameMode(raw);
    onPayload(normalizePayload(raw));
  },
  (error) => onError?.(error),
);

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


// Extend the existing signed-in navigation sync lifecycle with ONE small
// environment-scoped RTDB scalar listener. No Firestore, polling or drag calls.
const splitFrameListeners = new Set<(mode: SplitFrameMode) => void>();
let currentSplitFrameMode: SplitFrameMode = DEFAULT_SPLIT_FRAME_MODE;
let splitFrameServerReady = false;
export const readCurrentSplitFrameMode = (): SplitFrameMode => currentSplitFrameMode;
export const isSplitFrameServerReady = (): boolean => splitFrameServerReady;
export const subscribeSplitFrameMode = (listener: (mode: SplitFrameMode) => void): Unsubscribe => {
  splitFrameListeners.add(listener);
  listener(currentSplitFrameMode);
  return () => { splitFrameListeners.delete(listener); };
};
const publishSplitFrameMode = (raw: unknown) => {
  // Read only the current environment's small scalar, not all three modes.
  const mode = parseSplitFrameMode(raw);
  const firstConfirmedSnapshot = !splitFrameServerReady;
  splitFrameServerReady = true;
  if (mode === currentSplitFrameMode && !firstConfirmedSnapshot) return;
  currentSplitFrameMode = mode;
  splitFrameListeners.forEach((listener) => listener(mode));
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
  const env = getSplitFrameEnvironment();
  // Unknown hosts are never entitled to an environment policy. Keep the
  // frozen Hybrid fallback and do not create an unnecessary database listen.
  if (!env) return unsubscribeMenu;
  const unsubscribeFrame = onValue(
    ref(realtimeDb, 'publicSync/splitFrameModes/' + env),
    (snapshot) => publishSplitFrameMode(snapshot.val()),
    (error) => onError?.(error),
  );
  return () => { unsubscribeMenu(); unsubscribeFrame(); };
};

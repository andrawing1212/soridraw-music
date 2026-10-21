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

// app450: The mode is a tiny public operational scalar, NOT a song/user
// setting. Do not open navigationVisibility or its existing private siblings.
// Signed-in navigation and Guest Studio use one reference-counted subscription
// to the same environment leaf, never two overlapping RTDB listeners.
const splitFrameListeners = new Set<(mode: SplitFrameMode) => void>();
const splitFrameErrors = new Set<(error: unknown) => void>();
let currentSplitFrameMode: SplitFrameMode = DEFAULT_SPLIT_FRAME_MODE;
let splitFrameServerReady = false;
let frameSubscriberCount = 0;
let frameTransport: Unsubscribe | null = null;
let frameConnectivityTransport: Unsubscribe | null = null;
let frameConnected = false;
let frameTransportEpoch = 0;

const clearFrameReady = () => {
  if (!splitFrameServerReady) return;
  splitFrameServerReady = false;
  notifySplitFrameMode();
};

export const readCurrentSplitFrameMode = (): SplitFrameMode => currentSplitFrameMode;
export const isSplitFrameServerReady = (): boolean => splitFrameServerReady;
export const subscribeSplitFrameMode = (listener: (mode: SplitFrameMode) => void): Unsubscribe => {
  splitFrameListeners.add(listener);
  listener(currentSplitFrameMode);
  return () => { splitFrameListeners.delete(listener); };
};
const notifySplitFrameMode = () => {
  splitFrameListeners.forEach((listener) => listener(currentSplitFrameMode));
};
const publishSplitFrameMode = (raw: unknown) => {
  // An initial cached value is not evidence that the transport is online.
  if (!frameConnected || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const mode = parseSplitFrameMode(raw);
  const firstConfirmedSnapshot = !splitFrameServerReady;
  splitFrameServerReady = true;
  if (mode === currentSplitFrameMode && !firstConfirmedSnapshot) return;
  currentSplitFrameMode = mode;
  notifySplitFrameMode();
};

const startFrameTransport = () => {
  if (!frameConnected || frameTransport || frameSubscriberCount === 0) return;
  const env = getSplitFrameEnvironment();
  if (!env) return; // Unknown hosts remain on the frozen Hybrid fallback.
  const epoch = ++frameTransportEpoch;
  frameTransport = onValue(
    ref(realtimeDb, 'publicSync/splitFrameModes/' + env),
    (snapshot) => { if (epoch === frameTransportEpoch) publishSplitFrameMode(snapshot.val()); },
    (error) => {
      if (epoch !== frameTransportEpoch) return;
      // An RTDB cancellation callback terminates this listener. Treat stale
      // server data as NOT confirmed so a Master cannot Apply through an
      // unavailable channel, even if the displayed mode did not change.
      const previous = frameTransport;
      frameTransport = null;
      ++frameTransportEpoch;
      previous?.();
      clearFrameReady();
      splitFrameErrors.forEach((listener) => listener(error));
    },
  );
};
const observeFrameConnectivity = () => {
  if (frameConnectivityTransport || frameSubscriberCount === 0) return;
  frameConnectivityTransport = onValue(
    ref(realtimeDb, '.info/connected'),
    (snapshot) => {
      const connected = snapshot.val() === true
        && (typeof navigator === 'undefined' || navigator.onLine);
      if (!connected) {
        frameConnected = false;
        clearFrameReady();
        return;
      }
      if (frameConnected) return;
      frameConnected = true;
      // On reconnect, force one new tiny scalar snapshot; never trust
      // the last locally cached value as current server truth.
      frameTransport?.();
      frameTransport = null;
      ++frameTransportEpoch;
      clearFrameReady();
      startFrameTransport();
    },
    (error) => {
      const old = frameConnectivityTransport;
      frameConnectivityTransport = null;
      old?.();
      frameConnected = false;
      clearFrameReady();
      splitFrameErrors.forEach((listener) => listener(error));
    },
  );
};
const markFrameOffline = () => {
  frameConnected = false;
  clearFrameReady();
};
const retryFrameTransport = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  // Reconnect only after an interrupted stream, never poll healthy sessions,
  // revisit pages, or fetch during split pointer movement.
  if (frameSubscriberCount === 0) return;
  observeFrameConnectivity();
  if (frameConnected && !frameTransport) startFrameTransport();
};

export const subscribeSplitFrameRealtime = (onError?: (error: unknown) => void): Unsubscribe => {
  if (!getSplitFrameEnvironment()) return () => {};
  frameSubscriberCount += 1;
  if (onError) splitFrameErrors.add(onError);
  if (frameSubscriberCount === 1 && typeof window !== 'undefined') {
    window.addEventListener('online', retryFrameTransport);
    window.addEventListener('offline', markFrameOffline);
    document.addEventListener('visibilitychange', retryFrameTransport);
  }
  observeFrameConnectivity();
  startFrameTransport();
  return () => {
    if (onError) splitFrameErrors.delete(onError);
    frameSubscriberCount = Math.max(0, frameSubscriberCount - 1);
    if (frameSubscriberCount !== 0) return;
    frameTransport?.();
    frameTransport = null;
    ++frameTransportEpoch;
    frameConnectivityTransport?.();
    frameConnectivityTransport = null;
    frameConnected = false;
    splitFrameServerReady = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', retryFrameTransport);
      window.removeEventListener('offline', markFrameOffline);
      document.removeEventListener('visibilitychange', retryFrameTransport);
    }
  };
};

// SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
// Existing signed-in menu signal keeps its exact auth-only ACL. The app450
// scalar is a separate public-readable leaf for guests; only Master can write
// through its secured callable (clients cannot write either signal).
export const subscribeNavigationVisibilitySync = (
  onPayload: (payload: NavigationVisibilitySyncPayload | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => {
  const unsubscribeMenu = onValue(
    ref(realtimeDb, 'publicSync/navigationVisibility'),
    (snapshot) => onPayload(normalizePayload(snapshot.val())),
    (error) => onError?.(error),
  );
  const env = getSplitFrameEnvironment();
  if (!env) return unsubscribeMenu;
  const unsubscribeFrame = subscribeSplitFrameRealtime(onError);
  return () => { unsubscribeMenu(); unsubscribeFrame(); };
};

import { doc, increment, updateDoc } from '../lib/firestoreMeasured';
import { db } from '../firebase';

const STORAGE_BASE = 'soridraw_music_note_favorite_count_delta_v1';
const FLUSH_MS = 30_000;

type PendingState = {
  delta: number;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
};

const states = new Map<string, PendingState>();

const keyFor = (uid: string) => `${STORAGE_BASE}_${uid}`;

const readPersisted = (uid: string): number => {
  if (!uid || typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(keyFor(uid)) || 0);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  } catch {
    return 0;
  }
};

const writePersisted = (uid: string, delta: number): void => {
  if (!uid || typeof window === 'undefined') return;
  try {
    if (!delta) window.localStorage.removeItem(keyFor(uid));
    else window.localStorage.setItem(keyFor(uid), String(Math.trunc(delta)));
  } catch {}
};

const ensureState = (uid: string): PendingState => {
  const existing = states.get(uid);
  if (existing) return existing;
  const next: PendingState = { delta: readPersisted(uid), timer: null, flushing: false };
  states.set(uid, next);
  return next;
};

const schedule = (uid: string): void => {
  const state = ensureState(uid);
  if (state.timer) clearTimeout(state.timer);
  if (!state.delta) {
    state.timer = null;
    writePersisted(uid, 0);
    return;
  }
  state.timer = setTimeout(() => {
    state.timer = null;
    void flushMusicNoteFavoriteCountDelta(uid);
  }, FLUSH_MS);
};

export const queueMusicNoteFavoriteCountDelta = (uid: string, delta: number): void => {
  const safeUid = String(uid || '').trim();
  const safeDelta = Math.trunc(Number(delta || 0));
  if (!safeUid || !safeDelta) return;
  const state = ensureState(safeUid);
  state.delta += safeDelta;
  writePersisted(safeUid, state.delta);
  schedule(safeUid);
};

export const resumeMusicNoteFavoriteCountDelta = (uid: string): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  const state = ensureState(safeUid);
  if (state.delta) schedule(safeUid);
};

export const flushMusicNoteFavoriteCountDelta = async (uid: string): Promise<void> => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  const state = ensureState(safeUid);
  if (state.flushing || !state.delta) return;

  const captured = state.delta;
  state.delta -= captured;
  writePersisted(safeUid, state.delta);
  state.flushing = true;

  try {
    await updateDoc(doc(db, 'users', safeUid), { favoriteCount: increment(captured) });
  } catch (error) {
    state.delta += captured;
    writePersisted(safeUid, state.delta);
    console.warn('Music Note favoriteCount batch flush failed; keeping local pending delta.', error);
  } finally {
    state.flushing = false;
    if (state.delta) schedule(safeUid);
  }
};

// One real save/unsave still writes its canonical favorite document immediately.
// This helper only coalesces the derived users/{uid}.favoriteCount statistic.
export const MUSIC_NOTE_FAVORITE_COUNT_BATCH_MS = FLUSH_MS;

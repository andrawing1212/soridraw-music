import { onValue, ref as databaseRef, runTransaction, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

// Stage416 phase 2: a UID-private, explicitly UNSETTLED hint. It never changes
// canonical membership, public counts, the accepted 127 signal or a Worker queue.
const INTENT_MAX_416 = 50;
const INTENT_TTL_MS_416 = 60 * 60_000;
const INTENT_CACHE_416 = 'soridraw:explore-like-intent:416';
const INTENT_SEEN_416 = 'soridraw:explore-like-intent-seen:416';

type IntentStatus416 = 'pending' | 'accepted' | 'rejected';
type IntentRow416 = {
  trackId: string;
  ownerUid: string;
  liked: boolean;
  operationId: string;
  version: number;
  at: number;
  status: IntentStatus416;
};
type IntentEnvelope416 = { version: number; results: IntentRow416[] };
type LocalIntent416 = Pick<IntentRow416, 'liked' | 'operationId' | 'version' | 'at'>;
type IntentMutation416 = Pick<IntentRow416, 'trackId' | 'ownerUid' | 'liked' | 'operationId'>;
type IntentSettlement416 = Pick<IntentRow416, 'trackId' | 'operationId'> & { status: 'accepted' | 'rejected' };

const localIntentByUid416 = new Map<string, Record<string, LocalIntent416>>();
const seenByUid416 = new Map<string, number>();
const storeKey416 = (prefix: string, uid: string) => `${prefix}:${uid}`;
const readText416 = (key: string): string => {
  try { return typeof window === 'undefined' ? '' : window.localStorage.getItem(key) || ''; }
  catch { return ''; }
};
const writeText416 = (key: string, value: string): void => {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); }
  catch { /* Private mode: keep the in-memory overlay; confirmed path still works. */ }
};
const validOperation416 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const validRow416 = (value: unknown): value is IntentRow416 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<IntentRow416>;
  return typeof row.trackId === 'string' && row.trackId.length > 0 && row.trackId.length <= 512 &&
    typeof row.ownerUid === 'string' && row.ownerUid.length <= 128 &&
    typeof row.liked === 'boolean' && validOperation416(row.operationId) &&
    Number.isSafeInteger(row.version) && Number(row.version) > 0 &&
    Number.isSafeInteger(row.at) && Number(row.at) > 0 &&
    (row.status === 'pending' || row.status === 'accepted' || row.status === 'rejected');
};
const readLocal416 = (uid: string): Record<string, LocalIntent416> => {
  const inMemory = localIntentByUid416.get(uid);
  if (inMemory) return inMemory;
  let result: Record<string, LocalIntent416> = {};
  try {
    const raw = JSON.parse(readText416(storeKey416(INTENT_CACHE_416, uid)));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      result = Object.fromEntries(Object.entries(raw).filter(([id, value]) => {
        const v = value as Partial<LocalIntent416> | null;
        return id.length > 0 && id.length <= 512 && !!v &&
          typeof v.liked === 'boolean' && validOperation416(v.operationId) &&
          Number.isSafeInteger(v.version) && Number(v.version) > 0 &&
          Number.isSafeInteger(v.at) && Number(v.at) > 0 &&
          Date.now() - Number(v.at) <= INTENT_TTL_MS_416;
      })) as Record<string, LocalIntent416>;
    }
  } catch { /* Malformed optional hints must not touch canonical state. */ }
  localIntentByUid416.set(uid, result);
  return result;
};
const saveLocal416 = (uid: string, entries: Record<string, LocalIntent416>): void => {
  const fresh = Object.entries(entries)
    .filter(([, value]) => Date.now() - value.at <= INTENT_TTL_MS_416)
    .sort((a, b) => a[1].version - b[1].version)
    .slice(-INTENT_MAX_416);
  const bounded = Object.fromEntries(fresh) as Record<string, LocalIntent416>;
  localIntentByUid416.set(uid, bounded);
  writeText416(storeKey416(INTENT_CACHE_416, uid), JSON.stringify(bounded));
};
const seenVersion416 = (uid: string) => {
  const memory = seenByUid416.get(uid);
  if (memory !== undefined) return memory;
  const value = Math.max(0, Number(readText416(storeKey416(INTENT_SEEN_416, uid))) || 0);
  seenByUid416.set(uid, Number.isSafeInteger(value) ? value : 0);
  return seenByUid416.get(uid) || 0;
};
const setSeenVersion416 = (uid: string, version: number) => {
  const next = Math.max(version, seenVersion416(uid));
  seenByUid416.set(uid, next);
  writeText416(storeKey416(INTENT_SEEN_416, uid), String(next));
};

// My Likes derives candidates from the same tentative per-track truth. This
// is a bounded local map: never a server lookup or a whole-liked-list scan.
export const listExploreLikeIntents416 = (uid: string): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(readLocal416(uid))
      .filter(([, row]) => Date.now() - row.at <= INTENT_TTL_MS_416)
      .map(([trackId, row]) => [trackId, row.liked]),
  );

export const readExploreLikeIntent416 = (uid: string, trackId: string): boolean | undefined => {
  const intent = readLocal416(uid)[trackId];
  if (!intent || Date.now() - intent.at > INTENT_TTL_MS_416) return undefined;
  return intent.liked;
};

// Only an existing accepted personal signal (or the exact owner's ACK) can
// retire an identical pending hint. A newer opposite intent must survive an
// older accepted signal. Clearing hints never changes the confirmed cache.
export const clearExploreLikeIntent416 = (
  uid: string,
  trackId: string,
  liked: boolean,
  operationId?: string,
): void => {
  const entries = readLocal416(uid);
  const current = entries[trackId];
  if (!current || current.liked !== liked ||
      (operationId && current.operationId !== operationId)) return;
  delete entries[trackId];
  saveLocal416(uid, entries);
};

export const subscribeExploreLikeIntent416 = (
  uid: string,
  onChanged: (trackId: string, liked: boolean) => void,
): Unsubscribe => onValue(
  databaseRef(realtimeDb, `userSync/${uid}/exploreLikeIntent416`),
  (snapshot) => {
    const raw = snapshot.val() as Partial<IntentEnvelope416> | null;
    const version = Number(raw?.version || 0);
    if (!Number.isSafeInteger(version) || version <= seenVersion416(uid) ||
        !Array.isArray(raw?.results)) return;
    const previouslySeen = seenVersion416(uid);
    const entries = { ...readLocal416(uid) };
    const changed: Array<{ trackId: string; liked: boolean }> = [];
    for (const row of raw.results.slice(-INTENT_MAX_416)) {
      if (!validRow416(row) || row.version <= previouslySeen || row.version > version) continue;
      const existing = entries[row.trackId];
      if (existing && existing.version > row.version) continue;
      if (row.status !== 'pending') {
        if (existing?.operationId === row.operationId) {
          // A rejection restores the known canonical state. Accepted hints
          // remain until the existing authenticated 127 signal confirms them.
          if (row.status === 'rejected') {
            delete entries[row.trackId];
            changed.push({ trackId: row.trackId, liked: row.liked });
          }
        }
        continue;
      }
      // Retained events from an old session are not canonical evidence.
      // Device clocks are NOT used to order concurrent clicks; only the
      // RTDB transaction version orders the active online private channel.
      if (Date.now() - row.at > INTENT_TTL_MS_416 || row.at > Date.now() + INTENT_TTL_MS_416) continue;
      if (existing?.operationId === row.operationId && existing.version === row.version) continue;
      entries[row.trackId] = {
        liked: row.liked,
        operationId: row.operationId,
        version: row.version,
        at: row.at,
      };
      changed.push({ trackId: row.trackId, liked: row.liked });
    }
    if (changed.length) saveLocal416(uid, entries);
    // Durable overlay FIRST, watermark SECOND, UI notification LAST.
    setSeenVersion416(uid, version);
    changed.forEach(({ trackId, liked }) => onChanged(trackId, liked));
  },
  (error) => console.warn('[416] Private intent signal unavailable; accepted like path retained:', error),
);

export const publishExploreLikeIntent416 = async (uid: string, mutation: IntentMutation416): Promise<void> => {
  if (!uid || !mutation.trackId || !validOperation416(mutation.operationId)) return;
  const at = Date.now();
  await runTransaction(
    databaseRef(realtimeDb, `userSync/${uid}/exploreLikeIntent416`),
    (raw) => {
      const current = raw as Partial<IntentEnvelope416> | null;
      // Do not resurrect a stale offline click as a new 'live' intent on
      // reconnect. The durable canonical outbox already owns its retry.
      if (Date.now() - at > 10_000) return;
      const previous = Number(current?.version || 0);
      if (!Number.isSafeInteger(previous) || previous < 0 ||
          previous >= Number.MAX_SAFE_INTEGER) return;
      const version = previous + 1;
      const oldRows = Array.isArray(current?.results)
        ? current.results.filter(validRow416) : [];
      const row: IntentRow416 = {
        trackId: mutation.trackId,
        ownerUid: mutation.ownerUid,
        liked: mutation.liked,
        operationId: mutation.operationId,
        version,
        at,
        status: 'pending',
      };
      return {
        version,
        results: [...oldRows.filter((item) => item.trackId !== row.trackId), row].slice(-INTENT_MAX_416),
      };
    },
    { applyLocally: false },
  );
};

// Best-effort local hint cleanup is *not* canonical settlement. The original
// accepted RTDB notification remains the only accepted-state publication.
// Batch related operation IDs into one bounded RTDB transaction.
export const settleExploreLikeIntent416 = async (uid: string, settled: IntentSettlement416[]): Promise<void> => {
  if (!uid || !settled.length) return;
  const byId = new Map(settled.map((row) => [row.trackId, row]));
  await runTransaction(
    databaseRef(realtimeDb, `userSync/${uid}/exploreLikeIntent416`),
    (raw) => {
      const current = raw as Partial<IntentEnvelope416> | null;
      const previous = Number(current?.version || 0);
      if (!Number.isSafeInteger(previous) || previous < 1 || !Array.isArray(current?.results)) return;
      let changed = false;
      const nextVersion = previous + 1;
      const results = current.results.map((row) => {
        if (!validRow416(row)) return row;
        const target = byId.get(row.trackId);
        if (!target || row.operationId !== target.operationId || row.status !== 'pending') return row;
        changed = true;
        return { ...row, version: nextVersion, status: target.status };
      });
      return changed ? { version: nextVersion, results } : undefined;
    },
    { applyLocally: false },
  );
};

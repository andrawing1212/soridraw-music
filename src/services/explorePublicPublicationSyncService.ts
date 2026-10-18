import { onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { auth, getFirebaseAppCheckToken, realtimeDb } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

// SORIDRAW_PUBLIC_PUBLICATION_CHANGED_TRACK_429_20261019
// app432: browsers remain READ-ONLY. The server publishes ONE latest compact
// delta. Home Feed listens only while it is the active visible screen; public
// profile listens only to its owner-scoped path. The RTDB event stays tiny;
// an active relevant screen resolves the display card through a shared Edge cache.
const PUBLIC_PUBLICATION_FEED_SIGNAL_PATH_432 = 'publicSync/explorePublication';
const PUBLIC_PUBLICATION_PROFILE_SIGNAL_ROOT_432 = 'publicSync/explorePublicationProfiles';
const PUBLIC_PUBLICATION_ROUTE_429 = '/v1/publication-cards';
const PUBLIC_PUBLICATION_LIVE_CARD_ROUTE_432 = '/v1/publication-live-card';
const PUBLIC_PUBLICATION_MAX_429 = 50;
const PUBLIC_PUBLICATION_SIGNAL_ROWS_432 = 1;
const PUBLIC_PUBLICATION_RETENTION_MS_429 = 3 * 60_000;
const PUBLIC_PUBLICATION_ACK_KEY_429 = 'soridraw_public_publication_ack_429';
const PUBLIC_PUBLICATION_ACK_TTL_MS_429 = 10 * 60_000;

export type ExplorePublicPublicationSignalRow429 = {
  trackId: string;
  ownerUid: string;
  // Exact Worker/R2 publication-state updatedAt token. Never client "now".
  at: number;
  status: 'public' | 'private';
};

export type ExplorePublicPublicationSignal429 = {
  version: number;
  at: number;
  actorUid: string;
  rows: ExplorePublicPublicationSignalRow429[];
};

export type ExplorePublicPublicationState429 = {
  trackId: string;
  ownerUid: string;
  status: 'public' | 'private';
  updatedAt: number;
  card?: Record<string, unknown> | null;
};

type AckLedger429 = {
  viewerUid: string;
  rows: Record<string, { at: number; version: number; checkedAt: number }>;
};

const safeId429 = (value: unknown, max = 512) => String(value || '').trim().slice(0, max);

const normalizeSignal429 = (raw: unknown): ExplorePublicPublicationSignal429 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const version = Math.floor(Number(value.version || 0));
  const at = Math.floor(Number(value.at || 0));
  const actorUid = safeId429(value.actorUid, 128);
  const sourceRows = Array.isArray(value.rows)
    ? value.rows
    : value.rows && typeof value.rows === 'object'
      ? Object.values(value.rows as Record<string, unknown>)
      : [];
  if (!Number.isSafeInteger(version) || version <= 0 ||
      !Number.isSafeInteger(at) || at <= 0 || !actorUid) return null;
  const rows = sourceRows.map((row): ExplorePublicPublicationSignalRow429 | null => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const trackId = safeId429(item.trackId);
    const ownerUid = safeId429(item.ownerUid, 128);
    const rowAt = Math.floor(Number(item.at || 0));
    const status = item.status === 'public' ? 'public' : item.status === 'private' ? 'private' : '';
    if (!trackId || !ownerUid || !status ||
        !Number.isSafeInteger(rowAt) || rowAt <= 0) return null;
    return { trackId, ownerUid, at: rowAt, status };
  }).filter((row): row is ExplorePublicPublicationSignalRow429 => Boolean(row))
    .slice(0, PUBLIC_PUBLICATION_SIGNAL_ROWS_432);
  if (!rows.length) return null;
  return { version, at, actorUid, rows };
};

const subscribeSignalPath432 = (
  path: string,
  listener: (signal: ExplorePublicPublicationSignal429) => void,
): Unsubscribe => {
  let lastVersion = 0;
  const seenTrackSignal = new Map<string, { at: number; version: number }>();
  return onValue(
    databaseRef(realtimeDb, path),
    (snapshot) => {
      const signal = normalizeSignal429(snapshot.val());
      if (!signal || signal.version <= lastVersion) return;
      lastVersion = signal.version;
      if (Date.now() - signal.at > PUBLIC_PUBLICATION_RETENTION_MS_429) return;
      const rows = signal.rows.filter((row) => {
        const previous = seenTrackSignal.get(row.trackId);
        if (previous && (
          row.at < previous.at
          || (row.at === previous.at && signal.version <= previous.version)
        )) return false;
        seenTrackSignal.set(row.trackId, { at: row.at, version: signal.version });
        return true;
      });
      if (rows.length) listener({ ...signal, rows });
    },
    (error) => console.warn('[432] Server publication delta unavailable; revision fallback remains active:', error),
  );
};

// Home Feed global delta. Callers must mount this only on an active visible Feed.
export const subscribeExplorePublicPublicationInvalidation429 = (
  listener: (signal: ExplorePublicPublicationSignal429) => void,
): Unsubscribe => subscribeSignalPath432(PUBLIC_PUBLICATION_FEED_SIGNAL_PATH_432, listener);

// Public profiles never listen to the global Feed bus. One profile page listens
// only to the server-issued path for that owner.
export const subscribeExplorePublicProfilePublication432 = (
  ownerUid: string,
  listener: (signal: ExplorePublicPublicationSignal429) => void,
): Unsubscribe => {
  const uid = safeId429(ownerUid, 128);
  if (!uid) return () => undefined;
  return subscribeSignalPath432(
    `${PUBLIC_PUBLICATION_PROFILE_SIGNAL_ROOT_432}/${encodeURIComponent(uid)}`,
    listener,
  );
};

export const fetchExplorePublicPublicationLiveCard432 = async (
  row: ExplorePublicPublicationSignalRow429,
): Promise<Record<string, unknown> | null> => {
  if (row.status !== 'public') return null;
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const [idToken, appCheckToken] = await Promise.all([
    currentUser.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) return null;
  const query = new URLSearchParams({
    trackId: row.trackId,
    updatedAt: String(row.at),
  });
  const route = `${PUBLIC_PUBLICATION_LIVE_CARD_ROUTE_432}?${query.toString()}`;
  const response = await fetch(`${EXPLORE_API_BASE}${route}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
  });
  recordCloudflareResponse(response, PUBLIC_PUBLICATION_LIVE_CARD_ROUTE_432);
  if (!response.ok) return null;
  const payload = await response.json() as { ok?: boolean; data?: { item?: Record<string, unknown> } };
  const item = payload?.data?.item;
  if (payload?.ok !== true || !item || typeof item !== 'object' || Array.isArray(item)) return null;
  const id = safeId429(item.id ?? item.trackId);
  const ownerUid = safeId429(item.ownerUid ?? item.owner_uid, 128);
  const updatedAt = Math.floor(Number(item.updatedAt ?? 0));
  if (id !== row.trackId || ownerUid !== row.ownerUid || updatedAt !== row.at) return null;
  return item;
};

// app430 compatibility helper retained for audit/debug exact-state fallback.
export const isExplorePublicPublicationSignalRelevant429 = (
  row: ExplorePublicPublicationSignalRow429,
  visibleTrackOwnerUid: string,
  profileUid: string,
  viewerUid: string,
): boolean => {
  const ownerUid = safeId429(row?.ownerUid, 128);
  const visibleOwnerUid = safeId429(visibleTrackOwnerUid, 128);
  const activeProfileUid = safeId429(profileUid, 128);
  const activeViewerUid = safeId429(viewerUid, 128);
  if (!ownerUid || ownerUid === activeViewerUid) return false;
  return visibleOwnerUid === ownerUid || activeProfileUid === ownerUid;
};

export const isExplorePublicPublicationStateFresh429 = (
  row: ExplorePublicPublicationSignalRow429,
  state: ExplorePublicPublicationState429 | null | undefined,
): boolean => Boolean(
  state
  && safeId429(state.trackId) === safeId429(row.trackId)
  && safeId429(state.ownerUid, 128) === safeId429(row.ownerUid, 128)
  && Number.isSafeInteger(Number(state.updatedAt))
  && Number(state.updatedAt) === Number(row.at)
);

const readAckLedger429 = (viewerUid: string, now: number): AckLedger429 => {
  const empty: AckLedger429 = { viewerUid, rows: {} };
  if (!viewerUid || typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(PUBLIC_PUBLICATION_ACK_KEY_429);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as AckLedger429;
    if (!parsed || parsed.viewerUid !== viewerUid || !parsed.rows || typeof parsed.rows !== 'object') return empty;
    for (const [trackId, row] of Object.entries(parsed.rows)) {
      const at = Number(row?.at);
      const version = Number((row as { version?: unknown })?.version || 0);
      const checkedAt = Number(row?.checkedAt);
      if (!Number.isSafeInteger(at) || at <= 0 ||
          !Number.isSafeInteger(version) || version < 0 ||
          !Number.isSafeInteger(checkedAt) || checkedAt > now + 60_000 ||
          now - checkedAt > PUBLIC_PUBLICATION_ACK_TTL_MS_429) continue;
      empty.rows[trackId] = { at, version, checkedAt };
    }
  } catch {}
  return empty;
};

export const hasSettledExplorePublicPublicationSignal429 = (
  viewerUid: string,
  trackId: string,
  acceptedAt: number,
  acceptedVersion = 0,
  now = Date.now(),
): boolean => {
  const uid = safeId429(viewerUid, 128);
  const id = safeId429(trackId);
  if (!uid || !id || !Number.isSafeInteger(acceptedAt) || acceptedAt <= 0 ||
      !Number.isSafeInteger(acceptedVersion) || acceptedVersion < 0) return false;
  const settled = readAckLedger429(uid, now).rows[id];
  if (!settled) return false;
  return settled.at > acceptedAt
    || (settled.at === acceptedAt && settled.version >= acceptedVersion);
};

export const rememberSettledExplorePublicPublicationSignal429 = (
  viewerUid: string,
  trackId: string,
  acceptedAt: number,
  acceptedVersion = 0,
  now = Date.now(),
): void => {
  const uid = safeId429(viewerUid, 128);
  const id = safeId429(trackId);
  if (!uid || !id || !Number.isSafeInteger(acceptedAt) || acceptedAt <= 0 ||
      !Number.isSafeInteger(acceptedVersion) || acceptedVersion < 0 ||
      typeof window === 'undefined') return;
  const ledger = readAckLedger429(uid, now);
  const previous = ledger.rows[id];
  const isNewerOrSame = !previous
    || acceptedAt > previous.at
    || (acceptedAt === previous.at && acceptedVersion >= previous.version);
  if (isNewerOrSame) {
    ledger.rows[id] = { at: acceptedAt, version: acceptedVersion, checkedAt: now };
  }
  const rows = Object.fromEntries(Object.entries(ledger.rows)
    .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
    .slice(0, PUBLIC_PUBLICATION_MAX_429 * 2));
  try {
    window.localStorage.setItem(PUBLIC_PUBLICATION_ACK_KEY_429, JSON.stringify({ viewerUid: uid, rows }));
  } catch {}
};

// Exact Auth+AppCheck R2 route retained as a bounded manual/fallback primitive.
// app432 live Feed/profile convergence does not call it.
export const fetchExplorePublicPublicationStates429 = async (
  trackIds: string[],
): Promise<ExplorePublicPublicationState429[]> => {
  const ids = [...new Set(trackIds.map((id) => safeId429(id)).filter(Boolean))]
    .slice(0, PUBLIC_PUBLICATION_MAX_429);
  if (!ids.length) return [];

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Public publication state requires authentication');
  const [idToken, appCheckToken] = await Promise.all([
    currentUser.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) throw new Error('Public publication state App Check unavailable');

  const query = new URLSearchParams({ trackIds: ids.join(',') });
  const route = `${PUBLIC_PUBLICATION_ROUTE_429}?${query.toString()}`;
  const response = await fetch(`${EXPLORE_API_BASE}${route}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
  });
  recordCloudflareResponse(response, PUBLIC_PUBLICATION_ROUTE_429);
  if (!response.ok) throw new Error('Public publication state unavailable: HTTP ' + response.status);
  const payload = await response.json() as {
    ok?: boolean;
    data?: { items?: Array<Record<string, unknown>> };
  };
  if (payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error('Public publication state response is invalid');
  }
  return payload.data.items.map((item): ExplorePublicPublicationState429 | null => {
    const trackId = safeId429(item.trackId ?? item.id);
    const ownerUid = safeId429(item.ownerUid, 128);
    const status = item.status === 'public' ? 'public' : item.status === 'private' ? 'private' : '';
    const updatedAt = Math.max(0, Math.floor(Number(item.updatedAt || 0)));
    const card = item.card && typeof item.card === 'object' && !Array.isArray(item.card)
      ? item.card as Record<string, unknown> : null;
    if (!trackId || !ownerUid || !status || !updatedAt) return null;
    return { trackId, ownerUid, status, updatedAt, ...(card ? { card } : {}) };
  }).filter((item): item is ExplorePublicPublicationState429 => Boolean(item));
};

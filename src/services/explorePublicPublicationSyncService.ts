import { onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { auth, getFirebaseAppCheckToken, realtimeDb } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

// SORIDRAW_PUBLIC_PUBLICATION_CHANGED_TRACK_429_20261019
// app431 hardening: browsers are READ-ONLY on this invalidation bus.
// Only the HMAC-authenticated Worker -> Firebase Function path can publish after
// exact R2 projection succeeds. Receivers still verify exact shared R2 state.
const PUBLIC_PUBLICATION_SIGNAL_PATH_429 = 'publicSync/explorePublication';
const PUBLIC_PUBLICATION_ROUTE_429 = '/v1/publication-cards';
const PUBLIC_PUBLICATION_MAX_429 = 50;
const PUBLIC_PUBLICATION_RETENTION_MS_429 = 3 * 60_000;
const PUBLIC_PUBLICATION_ACK_KEY_429 = 'soridraw_public_publication_ack_429';
const PUBLIC_PUBLICATION_ACK_TTL_MS_429 = 10 * 60_000;

export type ExplorePublicPublicationSignalRow429 = {
  trackId: string;
  ownerUid: string;
  // Exact Worker/R2 publication-state updatedAt token. Never client "now".
  at: number;
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
  rows: Record<string, { at: number; checkedAt: number }>;
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
    if (!trackId || !ownerUid || !Number.isSafeInteger(rowAt) || rowAt <= 0) return null;
    return { trackId, ownerUid, at: rowAt };
  }).filter((row): row is ExplorePublicPublicationSignalRow429 => Boolean(row))
    .slice(0, PUBLIC_PUBLICATION_MAX_429);
  if (!rows.length) return null;
  return { version, at, actorUid, rows };
};

export const subscribeExplorePublicPublicationInvalidation429 = (
  listener: (signal: ExplorePublicPublicationSignal429) => void,
): Unsubscribe => {
  let lastVersion = 0;
  const seenTrackAt = new Map<string, number>();
  return onValue(
    databaseRef(realtimeDb, PUBLIC_PUBLICATION_SIGNAL_PATH_429),
    (snapshot) => {
      const signal = normalizeSignal429(snapshot.val());
      if (!signal || signal.version <= lastVersion) return;
      lastVersion = signal.version;
      if (Date.now() - signal.at > PUBLIC_PUBLICATION_RETENTION_MS_429) return;
      const rows = signal.rows.filter((row) => {
        const previous = seenTrackAt.get(row.trackId) || 0;
        if (row.at <= previous) return false;
        seenTrackAt.set(row.trackId, row.at);
        while (seenTrackAt.size > 256) {
          const oldest = seenTrackAt.keys().next().value as string | undefined;
          if (!oldest) break;
          seenTrackAt.delete(oldest);
        }
        return true;
      });
      if (rows.length) listener({ ...signal, rows });
    },
    (error) => console.warn('[431] Server publication invalidation unavailable; revision fallback remains active:', error),
  );
};

// A signal may trigger an exact R2 read only if this screen already has the
// same owner/track relationship, or the user is viewing that owner's profile.
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

// The RTDB timestamp is a proof token from the successful Worker R2 write.
// A stale state object must never be accepted/acked for a newer signal.
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
      const checkedAt = Number(row?.checkedAt);
      if (!Number.isSafeInteger(at) || at <= 0 ||
          !Number.isSafeInteger(checkedAt) || checkedAt > now + 60_000 ||
          now - checkedAt > PUBLIC_PUBLICATION_ACK_TTL_MS_429) continue;
      empty.rows[trackId] = { at, checkedAt };
    }
  } catch {}
  return empty;
};

export const hasSettledExplorePublicPublicationSignal429 = (
  viewerUid: string,
  trackId: string,
  acceptedAt: number,
  now = Date.now(),
): boolean => {
  const uid = safeId429(viewerUid, 128);
  const id = safeId429(trackId);
  if (!uid || !id || !Number.isSafeInteger(acceptedAt) || acceptedAt <= 0) return false;
  return (readAckLedger429(uid, now).rows[id]?.at || 0) >= acceptedAt;
};

export const rememberSettledExplorePublicPublicationSignal429 = (
  viewerUid: string,
  trackId: string,
  acceptedAt: number,
  now = Date.now(),
): void => {
  const uid = safeId429(viewerUid, 128);
  const id = safeId429(trackId);
  if (!uid || !id || !Number.isSafeInteger(acceptedAt) || acceptedAt <= 0 ||
      typeof window === 'undefined') return;
  const ledger = readAckLedger429(uid, now);
  ledger.rows[id] = {
    at: Math.max(acceptedAt, ledger.rows[id]?.at || 0),
    checkedAt: now,
  };
  const rows = Object.fromEntries(Object.entries(ledger.rows)
    .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
    .slice(0, PUBLIC_PUBLICATION_MAX_429 * 2));
  try {
    window.localStorage.setItem(PUBLIC_PUBLICATION_ACK_KEY_429, JSON.stringify({ viewerUid: uid, rows }));
  } catch {}
};

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

import { onValue, ref as databaseRef, runTransaction, type Unsubscribe } from 'firebase/database';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { auth, realtimeDb } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

// SORIDRAW_EXPLORE_PUBLIC_LIKE_LIVE_SYNC_192_20260924
// Public counts are shared; personal filled hearts are not. This RTDB node is a
// tiny changed-track invalidation bus only. Receivers never trust a count from
// RTDB: they read the settled changed-track card from shared R2.
const PUBLIC_LIKE_SIGNAL_PATH_192 = 'publicSync/exploreLike';
const PUBLIC_LIKE_SIGNAL_MAX_192 = 50;
const PUBLIC_LIKE_SIGNAL_RETENTION_MS_192 = 3 * 60_000;
const PUBLIC_LIKE_CARD_ROUTE_192 = '/v1/public-like-cards';

export type ExplorePublicLikeSignalRow192 = {
  trackId: string;
  ownerUid: string;
  at: number;
};

export type ExplorePublicLikeSignal192 = {
  version: number;
  at: number;
  actorUid: string;
  rows: ExplorePublicLikeSignalRow192[];
};

export type ExplorePublicLikeCard192 = {
  trackId: string;
  ownerUid: string;
  likeCount: number;
  updatedAt: number;
};

const normalizeId192 = (value: unknown, max = 512) =>
  String(value || '').trim().slice(0, max);

const normalizeSignal192 = (raw: unknown): ExplorePublicLikeSignal192 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const version = Math.floor(Number(value.version || 0));
  const at = Math.floor(Number(value.at || 0));
  const actorUid = normalizeId192(value.actorUid, 128);
  const rawRows = Array.isArray(value.rows) ? value.rows : [];
  if (!Number.isSafeInteger(version) || version <= 0 ||
      !Number.isSafeInteger(at) || at <= 0 || !actorUid) return null;
  const rows = rawRows
    .map((row): ExplorePublicLikeSignalRow192 | null => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const item = row as Record<string, unknown>;
      const trackId = normalizeId192(item.trackId);
      const ownerUid = normalizeId192(item.ownerUid, 128);
      const rowAt = Math.floor(Number(item.at || 0));
      if (!trackId || !Number.isSafeInteger(rowAt) || rowAt <= 0) return null;
      return { trackId, ownerUid, at: rowAt };
    })
    .filter((row): row is ExplorePublicLikeSignalRow192 => Boolean(row))
    .slice(0, PUBLIC_LIKE_SIGNAL_MAX_192);
  if (!rows.length) return null;
  return { version, at, actorUid, rows };
};

export const mergeExplorePublicLikeSignal192 = (
  current: unknown,
  actorUid: string,
  changedRows: Array<{ trackId: string; ownerUid?: string }>,
  now = Date.now(),
): ExplorePublicLikeSignal192 | null => {
  const uid = normalizeId192(actorUid, 128);
  if (!uid) return null;
  const incoming = changedRows
    .map((row) => ({
      trackId: normalizeId192(row?.trackId),
      ownerUid: normalizeId192(row?.ownerUid, 128),
      at: Math.floor(now),
    }))
    .filter((row) => row.trackId);
  if (!incoming.length) return null;

  const previous = normalizeSignal192(current);
  const cutoff = now - PUBLIC_LIKE_SIGNAL_RETENTION_MS_192;
  const byTrack = new Map<string, ExplorePublicLikeSignalRow192>();
  for (const row of previous?.rows || []) {
    if (row.at >= cutoff) byTrack.set(row.trackId, row);
  }
  for (const row of incoming) byTrack.set(row.trackId, row);

  const rows = [...byTrack.values()]
    .sort((a, b) => b.at - a.at || a.trackId.localeCompare(b.trackId))
    .slice(0, PUBLIC_LIKE_SIGNAL_MAX_192);
  const version = Math.max(Math.floor(now), (previous?.version || 0) + 1);
  return { version, at: Math.floor(now), actorUid: uid, rows };
};

export const publishExplorePublicLikeInvalidation192 = async (
  actorUid: string,
  rows: Array<{ trackId: string; ownerUid?: string }>,
): Promise<void> => {
  const uid = normalizeId192(actorUid, 128);
  const normalized = rows
    .map((row) => ({
      trackId: normalizeId192(row?.trackId),
      ownerUid: normalizeId192(row?.ownerUid, 128),
    }))
    .filter((row) => row.trackId)
    .slice(0, PUBLIC_LIKE_SIGNAL_MAX_192);
  if (!uid || !normalized.length) return;

  await runTransaction(
    databaseRef(realtimeDb, PUBLIC_LIKE_SIGNAL_PATH_192),
    (current) => mergeExplorePublicLikeSignal192(current, uid, normalized),
    { applyLocally: false },
  );
};

export const subscribeExplorePublicLikeInvalidation192 = (
  listener: (signal: ExplorePublicLikeSignal192) => void,
): Unsubscribe => {
  let lastVersion = 0;
  return onValue(
    databaseRef(realtimeDb, PUBLIC_LIKE_SIGNAL_PATH_192),
    (snapshot) => {
      const signal = normalizeSignal192(snapshot.val());
      if (!signal || signal.version <= lastVersion) return;
      lastVersion = signal.version;
      if (Date.now() - signal.at > PUBLIC_LIKE_SIGNAL_RETENTION_MS_192) return;
      if (signal.actorUid === auth.currentUser?.uid) return;
      listener(signal);
    },
    (error) => console.warn('[192] Public like invalidation unavailable; normal revision path remains active:', error),
  );
};

export const fetchExplorePublicLikeCards192 = async (
  trackIds: string[],
): Promise<ExplorePublicLikeCard192[]> => {
  const ids = [...new Set(trackIds.map((id) => normalizeId192(id)).filter(Boolean))]
    .slice(0, PUBLIC_LIKE_SIGNAL_MAX_192);
  if (!ids.length) return [];

  const query = new URLSearchParams({ trackIds: ids.join(',') });
  const response = await fetch(`${EXPLORE_API_BASE}${PUBLIC_LIKE_CARD_ROUTE_192}?${query.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  recordCloudflareResponse(response, PUBLIC_LIKE_CARD_ROUTE_192);
  if (!response.ok) throw new Error('Public like cards unavailable: HTTP ' + response.status);
  const payload = await response.json() as {
    ok?: boolean;
    data?: { items?: Array<Record<string, unknown>> };
  };
  if (payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error('Public like card response is invalid');
  }
  return payload.data.items
    .map((item): ExplorePublicLikeCard192 | null => {
      const trackId = normalizeId192(item.trackId ?? item.id);
      const ownerUid = normalizeId192(item.ownerUid, 128);
      const likeCount = Math.max(0, Math.floor(Number(item.likeCount || 0)));
      const updatedAt = Math.max(0, Math.floor(Number(item.updatedAt || 0)));
      if (!trackId || !Number.isFinite(likeCount)) return null;
      return { trackId, ownerUid, likeCount, updatedAt };
    })
    .filter((item): item is ExplorePublicLikeCard192 => Boolean(item));
};

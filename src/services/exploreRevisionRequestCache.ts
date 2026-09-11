import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import {
  readExploreFeedSessionCache,
  readExploreFeedSessionCacheCursor,
  readExploreFeedSessionCacheRevision,
} from './exploreSessionCache';
import {
  hasRecentExploreAccountLikePatch,
  overlayExploreAccountLikeCounts,
  rememberExploreAccountLikeOverlay,
} from './exploreLikeAccountOverlay';

// SORIDRAW_EXPLORE_REVISION_CLIENT_CACHE_062_20260911
// SORIDRAW_EXPLORE_FEED_DELTA_068_20260912
// A 10-minute local revision window remains the first guard. When the server is
// actually consulted, 068 asks for a bounded changed-track delta. Safe latest-feed
// changes are merged into the existing device cache locally, so one like aggregate
// does not cause a second /v1/feed request. Structural/popular changes fall back to
// the existing full-feed path to preserve correctness.
const REVISION_CACHE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v1:';
export const EXPLORE_REVISION_CLIENT_CACHE_HEADER = 'X-SORIDRAW-Client-Cache';
export const EXPLORE_REVISION_CLIENT_CACHE_PATH_HEADER = 'X-SORIDRAW-Client-Cache-Path';
const LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';

type RevisionCacheEntry = {
  expiresAt: number;
  status: number;
  statusText: string;
  body: string;
  contentType: string;
};

type FeedDeltaChange = {
  id?: string;
  active?: boolean | number;
  ownerUid?: string;
  publishedAt?: number;
  profilePinned?: boolean | number;
  likeCount?: number;
  title?: string;
  coverUrl?: string | null;
  sunoUrlPrimary?: string | null;
  sunoUrlSecondary?: string | null;
  ownerNickname?: string;
  ownerAvatarUrl?: string | null;
  ownerHandle?: string;
};

type FeedDelta = {
  complete?: boolean;
  fromRevision?: string;
  toRevision?: string;
  changes?: FeedDeltaChange[];
  removedIds?: string[];
};

type RevisionPayload = {
  ok?: boolean;
  data?: {
    sort?: string | null;
    revision?: string | null;
    delta?: FeedDelta | null;
  };
};

type PendingDelta = {
  revision: string;
  sort: 'latest' | 'popular';
  delta: FeedDelta;
};

type WindowWithRevisionCacheFlag = Window & {
  __soridrawExploreRevisionRequestCache062?: boolean;
};

const memoryCache = new Map<string, RevisionCacheEntry>();
const pendingDeltas = new Map<string, PendingDelta>();

const storageKeyFor = (url: string) => `${STORAGE_PREFIX}${encodeURIComponent(url)}`;

const removeEntry = (url: string) => {
  memoryCache.delete(url);
  try { window.localStorage.removeItem(storageKeyFor(url)); } catch { /* cache is optional */ }
};

const readEntry = (url: string): RevisionCacheEntry | null => {
  const memory = memoryCache.get(url);
  if (memory) {
    if (memory.expiresAt > Date.now()) return memory;
    removeEntry(url);
  }

  try {
    const raw = window.localStorage.getItem(storageKeyFor(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RevisionCacheEntry;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() ||
      typeof parsed.body !== 'string'
    ) {
      removeEntry(url);
      return null;
    }
    memoryCache.set(url, parsed);
    return parsed;
  } catch {
    removeEntry(url);
    return null;
  }
};

const writeEntry = (url: string, response: Response, body: string) => {
  try {
    const parsed = JSON.parse(body) as RevisionPayload;
    if (!String(parsed?.data?.revision ?? '').trim()) return;
  } catch {
    return;
  }

  const entry: RevisionCacheEntry = {
    expiresAt: Date.now() + REVISION_CACHE_TTL_MS,
    status: response.status,
    statusText: response.statusText,
    body,
    contentType: response.headers.get('Content-Type') || 'application/json; charset=utf-8',
  };
  memoryCache.set(url, entry);
  try { window.localStorage.setItem(storageKeyFor(url), JSON.stringify(entry)); } catch { /* cache is optional */ }
};

const localHeaders = (path: string, contentType = 'application/json; charset=utf-8', mode = 'HIT') => {
  const headers = new Headers({ 'Content-Type': contentType });
  headers.set(EXPLORE_REVISION_CLIENT_CACHE_HEADER, mode);
  headers.set(EXPLORE_REVISION_CLIENT_CACHE_PATH_HEADER, path);
  headers.set('X-SORIDRAW-CF-Worker', '0');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', '0');
  headers.set('X-SORIDRAW-Profile-Edge-Cache', 'LOCAL');
  return headers;
};

const cachedResponse = (entry: RevisionCacheEntry) => new Response(entry.body, {
  status: entry.status,
  statusText: entry.statusText,
  headers: localHeaders('/v1/feed-revision', entry.contentType),
});

const apiOrigin = () => new URL(EXPLORE_API_BASE).origin;

const requestMethod = (input: RequestInfo | URL, init?: RequestInit) => String(
  init?.method || (input instanceof Request ? input.method : 'GET'),
).toUpperCase();

const parsedTarget = (input: RequestInfo | URL) => {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
};

const eligibleRevisionUrl = (input: RequestInfo | URL, init?: RequestInit): URL | null => {
  if (requestMethod(input, init) !== 'GET') return null;
  const target = parsedTarget(input);
  if (!target || target.origin !== apiOrigin() || target.pathname !== '/v1/feed-revision') return null;
  return target;
};

const eligibleFeedUrl = (input: RequestInfo | URL, init?: RequestInit): URL | null => {
  if (requestMethod(input, init) !== 'GET') return null;
  const target = parsedTarget(input);
  if (!target || target.origin !== apiOrigin() || target.pathname !== '/v1/feed') return null;
  return target;
};

const feedUrlForSort = (origin: string, sort: 'latest' | 'popular') => {
  const url = new URL('/v1/feed', origin);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', '40');
  return url.toString();
};

const canonicalFeedUrl = (url: URL) => {
  if (url.searchParams.get('cursor') || Number(url.searchParams.get('limit') || 40) !== 40) return null;
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  return feedUrlForSort(url.origin, sort);
};

const abortIfNeeded = (input: RequestInfo | URL, init?: RequestInit) => {
  const signal = init?.signal || (input instanceof Request ? input.signal : null);
  if (!signal?.aborted) return;
  throw new DOMException('The operation was aborted.', 'AbortError');
};

const inputWithUrl = (input: RequestInfo | URL, url: string) => input instanceof Request
  ? new Request(url, input)
  : url;

const safeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const safeText = (value: unknown) => String(value ?? '').trim();

const rowLikeCount = (row: Record<string, unknown>) => {
  const stats = row.stats && typeof row.stats === 'object' && !Array.isArray(row.stats)
    ? row.stats as Record<string, unknown>
    : null;
  return safeCount(row.likeCount ?? stats?.likeCount);
};

const rowOwnerUid = (row: Record<string, unknown>) => safeText(row.ownerUid ?? row.owner_uid);
const rowPublishedAt = (row: Record<string, unknown>) => safeCount(row.publishedAt ?? row.published_at);
const rowPinned = (row: Record<string, unknown>) => Boolean(
  row.profilePinned ?? row.profile_pinned ?? (row.options as Record<string, unknown> | undefined)?.profilePinned,
);

const patchCachedRow = (row: Record<string, unknown>, change: FeedDeltaChange) => {
  const likeCount = safeCount(change.likeCount);
  const stats = row.stats && typeof row.stats === 'object' && !Array.isArray(row.stats)
    ? { ...(row.stats as Record<string, unknown>), likeCount }
    : { likeCount };
  const next: Record<string, unknown> = {
    ...row,
    id: safeText(change.id) || row.id,
    ownerUid: safeText(change.ownerUid) || rowOwnerUid(row),
    publishedAt: safeCount(change.publishedAt) || rowPublishedAt(row),
    profilePinned: Boolean(change.profilePinned),
    likeCount,
    stats,
  };
  if (typeof change.title === 'string') next.title = change.title;
  if (change.coverUrl !== undefined) next.coverUrl = change.coverUrl;
  if (change.sunoUrlPrimary !== undefined) next.sunoUrlPrimary = change.sunoUrlPrimary;
  if (change.sunoUrlSecondary !== undefined) next.sunoUrlSecondary = change.sunoUrlSecondary;
  if (typeof change.ownerNickname === 'string') next.ownerNickname = change.ownerNickname;
  if (change.ownerAvatarUrl !== undefined) next.ownerAvatarUrl = change.ownerAvatarUrl;
  if (typeof change.ownerHandle === 'string') next.ownerHandle = change.ownerHandle;
  return next;
};

const synthesizeDeltaFeed = (feedUrl: string, pending: PendingDelta): Response | null => {
  if (!pending.delta?.complete) return null;
  const removedIds = Array.isArray(pending.delta.removedIds) ? pending.delta.removedIds.filter(Boolean) : [];
  const changes = Array.isArray(pending.delta.changes) ? pending.delta.changes : [];
  if (removedIds.length || changes.length > 64) return null;
  if (pending.sort === 'popular' && changes.length) return null;

  const cachedRows = readExploreFeedSessionCache(feedUrl);
  if (!cachedRows) return null;
  const byId = new Map(cachedRows.map((row, index) => [safeText(row.id), { row, index }]));
  const nextRows = [...cachedRows];

  for (const change of changes) {
    const id = safeText(change.id);
    const current = id ? byId.get(id) : null;
    if (!id || !current || !Boolean(change.active)) return null;
    if (safeText(change.ownerUid) !== rowOwnerUid(current.row)) return null;
    if (safeCount(change.publishedAt) !== rowPublishedAt(current.row)) return null;
    if (Boolean(change.profilePinned) !== rowPinned(current.row)) return null;
    nextRows[current.index] = patchCachedRow(current.row, change);
  }

  const rows = overlayExploreAccountLikeCounts(nextRows);
  const payload = {
    ok: true,
    data: {
      items: rows,
      sort: pending.sort,
      nextCursor: readExploreFeedSessionCacheCursor(feedUrl),
    },
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: localHeaders('/v1/feed', 'application/json; charset=utf-8', 'DELTA-068'),
  });
};

const rememberDeltaFromBody = (revisionUrl: URL, body: string) => {
  try {
    const payload = JSON.parse(body) as RevisionPayload;
    const revision = safeText(payload?.data?.revision);
    const delta = payload?.data?.delta;
    if (!revision || !delta || typeof delta !== 'object') return;
    const sort = revisionUrl.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
    const feedUrl = feedUrlForSort(revisionUrl.origin, sort);
    pendingDeltas.set(feedUrl, { revision, sort, delta });
  } catch {
    // The ordinary full-feed fallback remains available.
  }
};

const overlayServerFeedResponse = async (response: Response) => {
  if (!response.ok) return response;
  try {
    const payload = await response.clone().json() as {
      data?: { items?: Array<Record<string, unknown>> };
    };
    const rows = payload?.data?.items;
    if (!Array.isArray(rows) || !rows.length) return response;
    const overlaid = overlayExploreAccountLikeCounts(rows);
    if (overlaid.every((row, index) => row === rows[index])) return response;
    const nextPayload = {
      ...payload,
      data: { ...payload.data, items: overlaid },
    };
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(nextPayload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
};

export const installExploreRevisionRequestCache = () => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const scope = window as WindowWithRevisionCacheFlag;
  if (scope.__soridrawExploreRevisionRequestCache062) return;
  scope.__soridrawExploreRevisionRequestCache062 = true;

  const originalFetch = window.fetch.bind(window);
  window.addEventListener(LIKE_SYNC_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    rememberExploreAccountLikeOverlay(detail || {});
  });

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const revisionTarget = eligibleRevisionUrl(input, init);
    if (revisionTarget) {
      abortIfNeeded(input, init);
      const revisionUrl = revisionTarget.toString();
      const cached = readEntry(revisionUrl);
      if (cached) {
        rememberDeltaFromBody(revisionTarget, cached.body);
        return cachedResponse(cached);
      }

      const sort = revisionTarget.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
      const feedUrl = feedUrlForSort(revisionTarget.origin, sort);
      const cachedFeedRevision = safeText(readExploreFeedSessionCacheRevision(feedUrl));

      // A just-received same-account signal already contains the exact visible
      // heart/count. Do not wake the public Feed for the same aggregate inside the
      // existing 10-minute public settling window.
      if (cachedFeedRevision && hasRecentExploreAccountLikePatch(REVISION_CACHE_TTL_MS)) {
        const body = JSON.stringify({ ok: true, data: { sort, revision: cachedFeedRevision } });
        return new Response(body, {
          status: 200,
          headers: localHeaders('/v1/feed-revision', 'application/json; charset=utf-8', 'ACCOUNT-068'),
        });
      }

      const serverUrl = new URL(revisionUrl);
      if (cachedFeedRevision) serverUrl.searchParams.set('knownRevision', cachedFeedRevision);
      const response = await originalFetch(inputWithUrl(input, serverUrl.toString()), init);
      if (response.ok) {
        try {
          const body = await response.clone().text();
          rememberDeltaFromBody(revisionTarget, body);
          writeEntry(revisionUrl, response, body);
        } catch {
          // Revalidation remains server-backed if the small cache write fails.
        }
      }
      return response;
    }

    const feedTarget = eligibleFeedUrl(input, init);
    if (feedTarget) {
      abortIfNeeded(input, init);
      const baseFeedUrl = canonicalFeedUrl(feedTarget);
      const requestedRevision = safeText(feedTarget.searchParams.get('__soridraw_revision'));
      if (baseFeedUrl && requestedRevision) {
        const pending = pendingDeltas.get(baseFeedUrl);
        if (pending?.revision === requestedRevision) {
          pendingDeltas.delete(baseFeedUrl);
          const synthetic = synthesizeDeltaFeed(baseFeedUrl, pending);
          if (synthetic) return synthetic;
        }
      }
      const response = await originalFetch(input, init);
      return overlayServerFeedResponse(response);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
};

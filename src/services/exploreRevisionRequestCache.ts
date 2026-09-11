import { EXPLORE_API_BASE, EXPLORE_ENVIRONMENT } from '../config/exploreEnvironment';

// SORIDRAW_EXPLORE_REVISION_CLIENT_CACHE_062_20260911
// PREVIEW-only transport cache for the tiny /v1/feed-revision check.
// The public Explore aggregate already settles on a 10-minute cadence, so repeated
// focus/pageshow/re-entry events inside the same 10-minute window must stay local.
const REVISION_CACHE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v1:';
const INSTALL_FLAG = '__soridrawExploreRevisionRequestCache062';
export const EXPLORE_REVISION_CLIENT_CACHE_HEADER = 'X-SORIDRAW-Client-Cache';
export const EXPLORE_REVISION_CLIENT_CACHE_PATH_HEADER = 'X-SORIDRAW-Client-Cache-Path';

type RevisionCacheEntry = {
  expiresAt: number;
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
};

type WindowWithRevisionCacheFlag = Window & {
  [INSTALL_FLAG]?: boolean;
};

const memoryCache = new Map<string, RevisionCacheEntry>();

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
      typeof parsed.body !== 'string' ||
      !parsed.headers ||
      typeof parsed.headers !== 'object'
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
    const parsed = JSON.parse(body) as { data?: { revision?: unknown } };
    if (!String(parsed?.data?.revision ?? '').trim()) return;
  } catch {
    return;
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  const entry: RevisionCacheEntry = {
    expiresAt: Date.now() + REVISION_CACHE_TTL_MS,
    status: response.status,
    statusText: response.statusText,
    body,
    headers,
  };
  memoryCache.set(url, entry);
  try { window.localStorage.setItem(storageKeyFor(url), JSON.stringify(entry)); } catch { /* cache is optional */ }
};

const cachedResponse = (entry: RevisionCacheEntry) => {
  const headers = new Headers(entry.headers);
  headers.set(EXPLORE_REVISION_CLIENT_CACHE_HEADER, 'HIT');
  headers.set(EXPLORE_REVISION_CLIENT_CACHE_PATH_HEADER, '/v1/feed-revision');
  headers.set('X-SORIDRAW-CF-Worker', '0');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', '0');
  headers.set('X-SORIDRAW-Profile-Edge-Cache', 'LOCAL');
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
};

const eligibleRevisionUrl = (input: RequestInfo | URL, init?: RequestInit): string | null => {
  if (EXPLORE_ENVIRONMENT !== 'preview') return null;
  const request = input instanceof Request ? input : null;
  const method = String(init?.method || request?.method || 'GET').toUpperCase();
  if (method !== 'GET') return null;

  try {
    const rawUrl = request?.url || String(input);
    const target = new URL(rawUrl, window.location.origin);
    const apiOrigin = new URL(EXPLORE_API_BASE).origin;
    if (target.origin !== apiOrigin || target.pathname !== '/v1/feed-revision') return null;
    return target.toString();
  } catch {
    return null;
  }
};

const abortIfNeeded = (input: RequestInfo | URL, init?: RequestInit) => {
  const signal = init?.signal || (input instanceof Request ? input.signal : null);
  if (!signal?.aborted) return;
  throw new DOMException('The operation was aborted.', 'AbortError');
};

export const installExploreRevisionRequestCache = () => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if (EXPLORE_ENVIRONMENT !== 'preview') return;

  const scope = window as WindowWithRevisionCacheFlag;
  if (scope[INSTALL_FLAG]) return;
  scope[INSTALL_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const revisionUrl = eligibleRevisionUrl(input, init);
    if (!revisionUrl) return originalFetch(input, init);

    abortIfNeeded(input, init);
    const cached = readEntry(revisionUrl);
    if (cached) return cachedResponse(cached);

    const response = await originalFetch(input, init);
    if (response.ok) {
      try {
        const body = await response.clone().text();
        writeEntry(revisionUrl, response, body);
      } catch {
        // Revalidation remains server-backed if the small cache write fails.
      }
    }
    return response;
  }) as typeof window.fetch;
};

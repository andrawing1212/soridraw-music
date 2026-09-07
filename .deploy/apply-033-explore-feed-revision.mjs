import { readFileSync, writeFileSync } from 'node:fs';

const cachePath = 'src/services/exploreSessionCache.ts';
const pagePath = 'src/pages/ExplorePage.tsx';
const marker = 'SORIDRAW_EXPLORE_FEED_REVISION_033_20260908';

let cache = readFileSync(cachePath, 'utf8');
let page = readFileSync(pagePath, 'utf8');

if (!cache.includes(marker)) {
  if (!cache.includes('SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990')) {
    throw new Error('033 Explore cache baseline marker missing');
  }
  cache = `import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990
// ${marker}
const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_FEED_SOURCE_TYPE = 'explore_feed';

type ExploreFeedCacheData = {
  rows: Array<Record<string, unknown>>;
};

type ExploreFeedMemoryEntry = {
  rows: Array<Record<string, unknown>>;
  serverRevision: string | null;
};

const exploreFeedMemoryCache = new Map<string, ExploreFeedMemoryEntry>();

const isFeedRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed';
  } catch {
    return url.includes('/v1/feed?');
  }
};

const getFeedCacheKey = (url: string) => \`explore-feed:\${url}\`;
const cloneRows = (rows: Array<Record<string, unknown>>) => rows.map((row) => ({ ...row }));
const normalizeRevision = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const readFeedEnvelope = (url: string) => readSoridrawPersistentCache<ExploreFeedCacheData>({
  cacheKey: getFeedCacheKey(url),
  sourceType: EXPLORE_FEED_SOURCE_TYPE,
  schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
  uid: null,
});

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return cloneRows(memory.rows);

  const envelope = readFeedEnvelope(url);
  if (!envelope || !Array.isArray(envelope.data?.rows)) return null;
  const rows = cloneRows(envelope.data.rows);
  exploreFeedMemoryCache.set(url, {
    rows,
    serverRevision: normalizeRevision(envelope.serverRevision),
  });
  return cloneRows(rows);
};

export const readExploreFeedSessionCacheRevision = (url: string): string | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return normalizeRevision(memory.serverRevision);
  return normalizeRevision(readFeedEnvelope(url)?.serverRevision);
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
  syncCursor: string | null = null,
  serverRevision: string | null = null,
) => {
  if (!isFeedRequest(url)) return;
  const cloned = cloneRows(rows);
  const normalizedRevision = normalizeRevision(serverRevision);
  exploreFeedMemoryCache.set(url, { rows: cloned, serverRevision: normalizedRevision });
  writeSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: null,
    syncCursor,
    serverRevision: normalizedRevision,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: { rows: cloned },
  });
};

export const patchExploreFeedSessionCacheRow = (
  url: string,
  trackId: string,
  patch: Record<string, unknown>,
) => {
  if (!isFeedRequest(url)) return;
  const cached = readExploreFeedSessionCache(url);
  if (!cached) return;
  let changed = false;
  const rows = cached.map((row) => {
    const rowId = String(row.id || row.trackId || '').trim();
    if (!rowId || rowId !== trackId) return row;
    changed = true;
    return { ...row, ...patch };
  });
  if (!changed) return;
  const previous = readFeedEnvelope(url);
  writeExploreFeedSessionCache(
    url,
    rows,
    previous?.syncCursor ?? null,
    normalizeRevision(previous?.serverRevision),
  );
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedMemoryCache.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_FEED_SOURCE_TYPE);
};

// Firebase Preview deployment trigger: 2026-09-08 Explore feed revision sync.
`;
  writeFileSync(cachePath, cache, 'utf8');
}

if (!page.includes(marker)) {
  const importBefore = `import {
  patchExploreFeedSessionCacheRow,
  readExploreFeedSessionCache,
  writeExploreFeedSessionCache,
} from '../services/exploreSessionCache';`;
  const importAfter = `import {
  patchExploreFeedSessionCacheRow,
  readExploreFeedSessionCache,
  readExploreFeedSessionCacheRevision,
  writeExploreFeedSessionCache,
} from '../services/exploreSessionCache';`;
  if (!page.includes(importBefore)) throw new Error('033 ExplorePage cache import anchor missing');
  page = page.replace(importBefore, importAfter);

  const typeAnchor = `type ExploreApiResponse = {
  ok?: boolean;
  data?: {
    items?: Array<Record<string, unknown>>;
    nextCursor?: string | null;
  };
};`;
  if (!page.includes(typeAnchor)) throw new Error('033 ExplorePage API type anchor missing');
  const helperBlock = `${typeAnchor}

// ${marker}
type ExploreFeedRevisionResponse = {
  ok?: boolean;
  data?: {
    sort?: string | null;
    revision?: string | null;
  };
};

const EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 1000;

const isExploreFeedRequest = (value: string) => {
  try {
    return new URL(value).pathname === '/v1/feed';
  } catch {
    return false;
  }
};

const buildExploreFeedRevisionUrl = (feedUrl: string) => {
  const parsed = new URL(feedUrl);
  const sort = parsed.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  return \`\${parsed.origin}/v1/feed-revision?sort=\${sort}\`;
};

const buildExploreVersionedFeedUrl = (feedUrl: string, revision: string) => {
  const parsed = new URL(feedUrl);
  parsed.searchParams.set('__soridraw_revision', revision);
  return parsed.toString();
};`;
  page = page.replace(typeAnchor, helperBlock);

  const refAnchor = `  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');`;
  const refReplacement = `  const searchInputRef = useRef<HTMLInputElement>(null);
  const likeHydrationKeyRef = useRef('');
  const [feedRevisionSignal, setFeedRevisionSignal] = useState(0);
  const feedRevisionEventAtRef = useRef(0);`;
  if (!page.includes(refAnchor)) throw new Error('033 ExplorePage state/ref anchor missing');
  page = page.replace(refAnchor, refReplacement);

  const feedEffectStartNeedle = `  useEffect(() => {\n    const cachedRows = readExploreFeedSessionCache(requestUrl);`;
  const profileEffectAnchor = `\n\n  useEffect(() => {\n    if (!profileUid) {`;
  const feedStart = page.indexOf(feedEffectStartNeedle);
  if (feedStart < 0) throw new Error('033 ExplorePage feed effect start missing');
  const feedEnd = page.indexOf(profileEffectAnchor, feedStart);
  if (feedEnd < 0) throw new Error('033 ExplorePage profile effect boundary missing');

  const nextFeedEffects = `  useEffect(() => {
    const cachedRows = readExploreFeedSessionCache(requestUrl);
    const feedRequest = isExploreFeedRequest(requestUrl);
    const controller = new AbortController();

    const fetchPayload = async (url: string): Promise<ExploreApiResponse> => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return response.json() as Promise<ExploreApiResponse>;
    };

    const fetchRevision = async (): Promise<string | null> => {
      if (!feedRequest) return null;
      const response = await fetch(buildExploreFeedRevisionUrl(requestUrl), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(\`revision HTTP \${response.status}\`);
      const payload = await response.json() as ExploreFeedRevisionResponse;
      return safeText(payload?.data?.revision) || null;
    };

    const applyPayload = (payload: ExploreApiResponse, serverRevision: string | null) => {
      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
      if (feedRequest) {
        writeExploreFeedSessionCache(
          requestUrl,
          rows,
          safeText(payload?.data?.nextCursor) || null,
          serverRevision,
        );
      }
      setTracks(rows.map(normalizeTrack).filter((track) => track.id));
    };

    if (cachedRows) {
      setError('');
      setTracks(cachedRows.map(normalizeTrack).filter((track) => track.id));
      setLoading(false);

      if (feedRequest) {
        void (async () => {
          try {
            const serverRevision = await fetchRevision();
            if (!serverRevision || controller.signal.aborted) return;
            const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);
            if (cachedRevision === serverRevision) return;
            const payload = await fetchPayload(buildExploreVersionedFeedUrl(requestUrl, serverRevision));
            if (controller.signal.aborted) return;
            applyPayload(payload, serverRevision);
          } catch (reason) {
            if (!controller.signal.aborted) {
              console.warn('Explore feed revision revalidation failed; keeping cached feed:', reason);
            }
          }
        })();
      }

      return () => controller.abort();
    }

    setLoading(true);
    setError('');

    void (async () => {
      try {
        if (feedRequest) {
          const revisionTask = fetchRevision().catch((reason) => {
            if (!controller.signal.aborted) {
              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);
            }
            return null;
          });
          const payload = await fetchPayload(requestUrl);
          const serverRevision = await revisionTask;
          if (controller.signal.aborted) return;
          applyPayload(payload, serverRevision);
          return;
        }

        const payload = await fetchPayload(requestUrl);
        if (controller.signal.aborted) return;
        applyPayload(payload, null);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        console.error('Explore feed load failed:', reason);
        setError('Explore 곡을 불러오지 못했어요.');
        setTracks([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [requestUrl, feedRevisionSignal]);

  useEffect(() => {
    if (!isExploreFeedRequest(requestUrl) || profileUid) return;

    const requestRevisionCheck = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - feedRevisionEventAtRef.current < EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS) return;
      feedRevisionEventAtRef.current = now;
      setFeedRevisionSignal((value) => value + 1);
    };

    window.addEventListener('focus', requestRevisionCheck);
    document.addEventListener('visibilitychange', requestRevisionCheck);
    return () => {
      window.removeEventListener('focus', requestRevisionCheck);
      document.removeEventListener('visibilitychange', requestRevisionCheck);
    };
  }, [requestUrl, profileUid]);`;

  page = page.slice(0, feedStart) + nextFeedEffects + page.slice(feedEnd);
  writeFileSync(pagePath, page, 'utf8');
}

cache = readFileSync(cachePath, 'utf8');
page = readFileSync(pagePath, 'utf8');
for (const required of [
  marker,
  'readExploreFeedSessionCacheRevision',
  'serverRevision: normalizedRevision',
]) {
  if (!cache.includes(required)) throw new Error(`033 cache verification missing: ${required}`);
}
for (const required of [
  marker,
  '/v1/feed-revision',
  '__soridraw_revision',
  'feedRevisionSignal',
  "document.addEventListener('visibilitychange'",
]) {
  if (!page.includes(required)) throw new Error(`033 ExplorePage verification missing: ${required}`);
}
if (page.includes('setInterval(') && page.includes(marker)) {
  // Existing unrelated timers are allowed; 033 itself must never add a polling marker.
  const markerIndex = page.indexOf(marker);
  const revisionRegion = page.slice(markerIndex, Math.min(page.length, markerIndex + 12000));
  if (revisionRegion.includes('setInterval(')) throw new Error('033 must not add polling to Explore feed revision sync');
}

console.log('[033] Explore Cache First feed revision sync applied: cached UI first, revision check on entry/focus/visibility, full feed only on revision change.');

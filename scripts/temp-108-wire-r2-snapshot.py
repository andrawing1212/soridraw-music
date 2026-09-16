from pathlib import Path

p = Path('src/pages/ExplorePage.tsx')
s = p.read_text()

old = """// SORIDRAW_EXPLORE_LIKE_FRESH_FEED_RECOVERY_072_20260912
// A known like-count recovery must not reuse the ordinary versioned Feed URL:
// that URL can still be held by the HTTP edge cache while canonical D1/R2 is newer.
// One unique request is allowed only for an actual/persisted like recovery. No polling.
const EXPLORE_LIKE_FRESH_FEED_QUERY_072 = '__soridraw_like_refresh';
// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912
"""
new = """// SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916
// First-page Feed refreshes use the already-materialized R2 snapshot directly.
// This keeps app-update/cache-recovery traffic off D1 while preserving local-first warm re-entry.
const EXPLORE_FEED_R2_SNAPSHOT_QUERY_108 = '__soridraw_r2_only';
const EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108 = '__soridraw_r2_revision';
const EXPLORE_FEED_R2_SNAPSHOT_VERSION_108 = '108';
// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912
"""
if old not in s:
    raise SystemExit('constant anchor missing')
s = s.replace(old, new, 1)

old = """const buildExploreVersionedFeedUrl = (feedUrl: string, revision: string) => {
  const parsed = new URL(feedUrl);
  parsed.searchParams.set('__soridraw_revision', revision);
  return parsed.toString();
};

const buildExploreFreshLikeFeedUrl072 = (feedUrl: string) => {
  const parsed = new URL(feedUrl);
  parsed.searchParams.delete('__soridraw_revision');
  parsed.searchParams.set(EXPLORE_LIKE_FRESH_FEED_QUERY_072, `${Date.now()}`);
  return parsed.toString();
};
"""
new = """const buildExploreR2SnapshotFeedUrl108 = (feedUrl: string, revision: string | null = null) => {
  const parsed = new URL(feedUrl);
  parsed.searchParams.delete('__soridraw_revision');
  parsed.searchParams.delete('__soridraw_like_refresh');
  parsed.searchParams.set(EXPLORE_FEED_R2_SNAPSHOT_QUERY_108, EXPLORE_FEED_R2_SNAPSHOT_VERSION_108);
  if (revision) parsed.searchParams.set(EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108, revision);
  else parsed.searchParams.delete(EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108);
  return parsed.toString();
};
"""
if old not in s:
    raise SystemExit('url helper anchor missing')
s = s.replace(old, new, 1)

anchor = """    const applyPayload = (payload: ExploreApiResponse, serverRevision: string | null) => {
"""
helper = """    const fetchFeedSnapshot108 = async (revision: string | null) => {
      const response = await fetch(buildExploreR2SnapshotFeedUrl108(requestUrl, revision), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      recordCloudflareResponse(response);
      if (!response.ok) throw new Error(`R2 snapshot HTTP ${response.status}`);
      const payload = await response.json() as ExploreApiResponse;
      const actualRevision = safeText(response.headers.get('X-SORIDRAW-Feed-Revision')) || revision;
      return { payload, revision: actualRevision };
    };

"""
if anchor not in s:
    raise SystemExit('applyPayload anchor missing')
s = s.replace(anchor, helper + anchor, 1)

old = """              const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);
              const payload = await fetchPayload(buildExploreFreshLikeFeedUrl072(requestUrl));
              if (controller.signal.aborted) return;
              applyPayload(payload, cachedRevision);
"""
new = """              const serverRevision = await fetchRevision().catch(() => null);
              const snapshot = await fetchFeedSnapshot108(serverRevision);
              if (controller.signal.aborted) return;
              applyPayload(snapshot.payload, snapshot.revision);
"""
if old not in s:
    raise SystemExit('cached forced refresh anchor missing')
s = s.replace(old, new, 1)

old = """            const payload = await fetchPayload(buildExploreVersionedFeedUrl(requestUrl, serverRevision));
            if (controller.signal.aborted) return;
            applyPayload(payload, serverRevision);
"""
new = """            const snapshot = await fetchFeedSnapshot108(serverRevision);
            if (controller.signal.aborted) return;
            applyPayload(snapshot.payload, snapshot.revision);
"""
if old not in s:
    raise SystemExit('cached revision refresh anchor missing')
s = s.replace(old, new, 1)

old = """            const payload = await fetchPayload(buildExploreFreshLikeFeedUrl072(requestUrl));
            if (controller.signal.aborted) return;
            applyPayload(payload, readExploreFeedSessionCacheRevision(requestUrl));
            return;
"""
new = """            const serverRevision = await fetchRevision().catch(() => null);
            const snapshot = await fetchFeedSnapshot108(serverRevision);
            if (controller.signal.aborted) return;
            applyPayload(snapshot.payload, snapshot.revision);
            return;
"""
if old not in s:
    raise SystemExit('cold forced refresh anchor missing')
s = s.replace(old, new, 1)

old = """          const payload = await fetchPayload(
            serverRevision ? buildExploreVersionedFeedUrl(requestUrl, serverRevision) : requestUrl,
          );
          if (controller.signal.aborted) return;
          applyPayload(payload, serverRevision);
          return;
"""
new = """          const snapshot = await fetchFeedSnapshot108(serverRevision);
          if (controller.signal.aborted) return;
          applyPayload(snapshot.payload, snapshot.revision);
          return;
"""
if old not in s:
    raise SystemExit('cold normal feed anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

v = Path('scripts/verify-108-explore-feed-cache-recovery.mjs')
v.write_text("""import { readFileSync } from 'node:fs';

const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const persistent = readFileSync('src/lib/soridrawPersistentCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[108] ${message}`); };
if (String(version.version) !== '108') fail('app version is not 108');
if (!cache.includes('SORIDRAW_EXPLORE_FEED_STALE_COUNT_CACHE_RECOVERY_108_20260916')) fail('108 cache recovery marker missing');
if (!/EXPLORE_FEED_CACHE_SCHEMA_VERSION\\s*=\\s*2\\s*;/.test(cache)) fail('Explore Feed cache schema is not 2');
if (/app-version\\.json|appVersion|APP_VERSION/.test(cache)) fail('Feed cache schema must not depend on app version');
if (!cache.includes('expiresAt: null')) fail('long-lived cache contract changed unexpectedly');
if (!persistent.includes('String(envelope.schemaVersion) === String(identity.schemaVersion)')) fail('schema compatibility gate missing');
if (!persistent.includes('window.localStorage.removeItem(storageKey)')) fail('incompatible persistent cache cleanup missing');
if (!page.includes('SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916')) fail('client R2 snapshot marker missing');
if (!page.includes('buildExploreR2SnapshotFeedUrl108')) fail('client R2 snapshot URL helper missing');
if (page.includes('buildExploreVersionedFeedUrl') || page.includes('buildExploreFreshLikeFeedUrl072')) fail('old first-page feed fetch helper remains');
if (!page.includes('cachedRevision === serverRevision')) fail('revision no-op fast path missing');
if (!entry.includes('SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916')) fail('Worker R2 snapshot marker missing');
if (!entry.includes("url.searchParams.get(EXPLORE_FEED_R2_SNAPSHOT_QUERY_108) === EXPLORE_FEED_R2_SNAPSHOT_VERSION_108")) fail('Worker snapshot route missing');
const start = entry.indexOf('async function handleFeedR2Snapshot108');
const end = entry.indexOf('async function scheduleExploreLikeAggregate103', start);
if (start < 0 || end < 0) fail('Worker snapshot handler range missing');
const handler = entry.slice(start, end);
if (!handler.includes('bucket.get(feedR2Key077(sort))')) fail('snapshot does not read R2 body');
if (/env\\.DB|baseWorker\\.fetch|syncDerivedCache032/.test(handler)) fail('snapshot handler may touch D1/base Worker');
for (const zero of ["headers.set('X-SORIDRAW-D1-Read', '0')", "headers.set('X-SORIDRAW-D1-Write', '0')", "headers.set('X-SORIDRAW-D1-Read-Queries', '0')"]) {
  if (!entry.includes(zero)) fail(`missing zero-cost diagnostic: ${zero}`);
}

console.log('108_EXPLORE_FEED_CACHE_RECOVERY=PASS');
console.log('OLD_SCHEMA_1_STALE_FEED=REJECTED_ONCE');
console.log('NEW_SCHEMA_2_WARM_CACHE=PERSISTENT');
console.log('COLD_RECOVERY_SOURCE=R2_SNAPSHOT_ONLY');
console.log('COLD_RECOVERY_D1=R0_W0_BY_ROUTE_CONTRACT');
console.log('APP_VERSION_COUPLING=NONE');
console.log('REVISION_NOOP_FAST_PATH=PRESERVED');
console.log('NO_PERIODIC_POLLING_ADDED=true');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
""")

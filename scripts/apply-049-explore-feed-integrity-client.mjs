import { readFileSync, writeFileSync } from 'node:fs';

const replaceOnce = (text, before, after, label) => {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`[049] ${label} anchor count=${count}`);
  return text.replace(before, after);
};

const pagePath = 'src/pages/ExplorePage.tsx';
const cachePath = 'src/services/exploreSessionCache.ts';
const cssPath = 'src/components/explore/explore.css';
const noticePath = 'src/services/appUpdateNotice.ts';
const versionPath = 'public/app-version.json';

let page = readFileSync(pagePath, 'utf8');
let cache = readFileSync(cachePath, 'utf8');
let css = readFileSync(cssPath, 'utf8');
let notice = readFileSync(noticePath, 'utf8');
let version = readFileSync(versionPath, 'utf8');

if (page.includes('SORIDRAW_EXPLORE_FEED_COMPLETENESS_049')) {
  console.log('[049] client completeness patch already applied.');
  process.exit(0);
}

cache = replaceOnce(
  cache,
  `export const readExploreFeedSessionCacheRevision = (url: string): string | null => {\n  if (!isFeedRequest(url)) return null;\n  const memory = exploreFeedMemoryCache.get(url);\n  if (memory) return normalizeRevision(memory.serverRevision);\n  return normalizeRevision(readFeedEnvelope(url)?.serverRevision);\n};`,
  `export const readExploreFeedSessionCacheRevision = (url: string): string | null => {\n  if (!isFeedRequest(url)) return null;\n  const memory = exploreFeedMemoryCache.get(url);\n  if (memory) return normalizeRevision(memory.serverRevision);\n  return normalizeRevision(readFeedEnvelope(url)?.serverRevision);\n};\n\nexport const readExploreFeedSessionCacheCursor = (url: string): string | null => {\n  if (!isFeedRequest(url)) return null;\n  return normalizeRevision(readFeedEnvelope(url)?.syncCursor);\n};`,
  'persistent first-page cursor reader',
);

page = replaceOnce(
  page,
  `// SORIDRAW_EXPLORE_PUBLIC_PROFILE_PARITY_048`,
  `// SORIDRAW_EXPLORE_PUBLIC_PROFILE_PARITY_048\n// SORIDRAW_EXPLORE_FEED_COMPLETENESS_049`,
  '049 page marker',
);

page = replaceOnce(
  page,
  `  readExploreFeedSessionCache,\n  readExploreFeedSessionCacheRevision,`,
  `  readExploreFeedSessionCache,\n  readExploreFeedSessionCacheCursor,\n  readExploreFeedSessionCacheRevision,`,
  'cursor import',
);

page = replaceOnce(
  page,
  `  const [tracks, setTracks] = useState<ExploreTrack[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState('');`,
  `  const [tracks, setTracks] = useState<ExploreTrack[]>([]);\n  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);\n  const [loadingMore, setLoadingMore] = useState(false);\n  const [loadMoreError, setLoadMoreError] = useState('');\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState('');`,
  'pagination state',
);

page = replaceOnce(
  page,
  `      if (feedRequest) {\n        writeExploreFeedSessionCache(\n          requestUrl,\n          rows,\n          safeText(payload?.data?.nextCursor) || null,\n          serverRevision,\n        );\n      }\n      setTracks(rows.map(normalizeTrack).filter((track) => track.id));`,
  `      const nextCursor = feedRequest ? (safeText(payload?.data?.nextCursor) || null) : null;\n      if (feedRequest) {\n        writeExploreFeedSessionCache(\n          requestUrl,\n          rows,\n          nextCursor,\n          serverRevision,\n        );\n      }\n      setFeedNextCursor(nextCursor);\n      setLoadMoreError('');\n      setTracks(rows.map(normalizeTrack).filter((track) => track.id));`,
  'initial payload cursor',
);

page = replaceOnce(
  page,
  `    if (cachedRows) {\n      setError('');\n      setTracks(cachedRows.map(normalizeTrack).filter((track) => track.id));\n      setLoading(false);`,
  `    if (cachedRows) {\n      setError('');\n      setFeedNextCursor(feedRequest ? readExploreFeedSessionCacheCursor(requestUrl) : null);\n      setLoadMoreError('');\n      setTracks(cachedRows.map(normalizeTrack).filter((track) => track.id));\n      setLoading(false);`,
  'cached cursor restore',
);

page = replaceOnce(
  page,
  `        setError('Explore 곡을 불러오지 못했어요.');\n        setTracks([]);`,
  `        setError('Explore 곡을 불러오지 못했어요.');\n        setFeedNextCursor(null);\n        setLoadMoreError('');\n        setTracks([]);`,
  'error cursor reset',
);

page = replaceOnce(
  page,
  `  const updateTrackLikeCount = (trackId: string, likeCount: number) => {`,
  `  const loadMoreFeed = async () => {\n    if (profileUid || submittedQuery || !feedNextCursor || loadingMore) return;\n    const apiSort = sort === 'popular' ? 'popular' : 'latest';\n    const params = new URLSearchParams({ sort: apiSort, limit: '40', cursor: feedNextCursor });\n    setLoadingMore(true);\n    setLoadMoreError('');\n    try {\n      const response = await fetch(EXPLORE_API_BASE + '/v1/feed?' + params.toString(), {\n        method: 'GET',\n        headers: { Accept: 'application/json' },\n      });\n      recordCloudflareResponse(response);\n      if (!response.ok) throw new Error('HTTP ' + response.status);\n      const payload = await response.json() as ExploreApiResponse;\n      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];\n      const normalized = rows.map(normalizeTrack).filter((track) => track.id);\n      setTracks((previous) => {\n        const seen = new Set(previous.map((track) => track.id));\n        return [...previous, ...normalized.filter((track) => !seen.has(track.id))];\n      });\n      setFeedNextCursor(safeText(payload?.data?.nextCursor) || null);\n    } catch (reason) {\n      console.warn('Explore feed load-more failed:', reason);\n      setLoadMoreError('이전 공개곡을 불러오지 못했어요. 다시 시도해주세요.');\n    } finally {\n      setLoadingMore(false);\n    }\n  };\n\n  const updateTrackLikeCount = (trackId: string, likeCount: number) => {`,
  'cursor pagination loader',
);

page = replaceOnce(
  page,
  `      ) : renderTrackGrid(tracks, 'Explore 곡 목록')}\n    </main>`,
  `      ) : (\n        <>\n          {renderTrackGrid(tracks, 'Explore 곡 목록')}\n          {!submittedQuery && feedNextCursor && (\n            <div className="soridraw-explore-load-more">\n              <button type="button" onClick={loadMoreFeed} disabled={loadingMore}>\n                {loadingMore ? <><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 불러오는 중</> : '더 보기'}\n              </button>\n            </div>\n          )}\n          {loadMoreError && <div className="soridraw-explore-load-more-error" role="status">{loadMoreError}</div>}\n        </>\n      )}\n    </main>`,
  'load-more rendering',
);

css = replaceOnce(
  css,
  `.soridraw-explore-state--empty span{color:rgba(235,235,240,.4);font-size:12px}\n@keyframes soridraw-explore-spin{to{transform:rotate(360deg)}}`,
  `.soridraw-explore-state--empty span{color:rgba(235,235,240,.4);font-size:12px}\n.soridraw-explore-load-more{display:flex;justify-content:center;padding:28px 0 0}\n.soridraw-explore-load-more button{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 16px;border:0!important;outline:0!important;border-radius:12px;background:rgba(255,255,255,.055)!important;box-shadow:none!important;color:rgba(235,235,240,.68);font-size:12px;font-weight:800;cursor:pointer}\n.soridraw-explore-load-more button:hover:not(:disabled){background:rgba(255,255,255,.085)!important;color:#fff}\n.soridraw-explore-load-more button:disabled{opacity:.55;cursor:default}\n.soridraw-explore-load-more .soridraw-explore-spinner{width:15px;height:15px}\n.soridraw-explore-load-more-error{padding:10px 0 0;text-align:center;color:rgba(235,235,240,.48);font-size:12px;font-weight:650}\n:root[data-soridraw-theme="light"] .soridraw-explore-load-more button{background:rgba(20,20,24,.055)!important;color:rgba(20,20,24,.62)}\n:root[data-soridraw-theme="light"] .soridraw-explore-load-more button:hover:not(:disabled){background:rgba(20,20,24,.085)!important;color:#171719}\n:root[data-soridraw-theme="light"] .soridraw-explore-load-more-error{color:rgba(25,25,28,.47)}\n@keyframes soridraw-explore-spin{to{transform:rotate(360deg)}}`,
  'load-more styling',
);

notice = notice.replace(/const CURRENT_APP_VERSION = '\d+';/, `const CURRENT_APP_VERSION = '049';`);
version = JSON.stringify({ version: '049' }, null, 2) + '\n';

for (const [label, text, required] of [
  ['page', page, 'SORIDRAW_EXPLORE_FEED_COMPLETENESS_049'],
  ['page', page, 'readExploreFeedSessionCacheCursor'],
  ['page', page, 'const loadMoreFeed = async () =>'],
  ['page', page, `cursor: feedNextCursor`],
  ['cache', cache, 'readExploreFeedSessionCacheCursor'],
  ['css', css, '.soridraw-explore-load-more'],
  ['notice', notice, `CURRENT_APP_VERSION = '049'`],
]) {
  if (!text.includes(required)) throw new Error(`[049] ${label} missing ${required}`);
}

writeFileSync(pagePath, page);
writeFileSync(cachePath, cache);
writeFileSync(cssPath, css);
writeFileSync(noticePath, notice);
writeFileSync(versionPath, version);
console.log('[049] Explore first page keeps cache-first latest order; cursor pagination exposes older public tracks only on explicit user request.');

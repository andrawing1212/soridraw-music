from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# Explore liked-state: keep per-UID known true/false values through F5 in the same tab.
like_path = Path('src/services/exploreLikeService.ts')
like_text = like_path.read_text(encoding='utf-8')
like_text = replace_once(
    like_text,
    """// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988
const likedStateByUid = new Map<string, Map<string, boolean>>();

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = new Map<string, boolean>();
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};""",
    """// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_989
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = '1';
const EXPLORE_LIKE_CACHE_KEY_BASE = 'soridraw_explore_liked_state_cache_v1';
const likedStateByUid = new Map<string, Map<string, boolean>>();

const getLikedStateStorageKey = (uid: string) => `${EXPLORE_LIKE_CACHE_KEY_BASE}_${uid}`;

const readLikedStateStorage = (uid: string): Map<string, boolean> => {
  const values = new Map<string, boolean>();
  if (typeof window === 'undefined') return values;
  try {
    const raw = window.sessionStorage.getItem(getLikedStateStorageKey(uid));
    if (!raw) return values;
    const parsed = JSON.parse(raw);
    if (
      parsed?.schemaVersion !== EXPLORE_LIKE_CACHE_SCHEMA_VERSION ||
      !parsed?.values ||
      typeof parsed.values !== 'object' ||
      Array.isArray(parsed.values)
    ) {
      window.sessionStorage.removeItem(getLikedStateStorageKey(uid));
      return values;
    }
    Object.entries(parsed.values as Record<string, unknown>).forEach(([trackId, liked]) => {
      if (trackId && typeof liked === 'boolean') values.set(trackId, liked);
    });
    return values;
  } catch {
    try { window.sessionStorage.removeItem(getLikedStateStorageKey(uid)); } catch {}
    return values;
  }
};

const persistLikedStateCache = (uid: string, cache: Map<string, boolean>) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(getLikedStateStorageKey(uid), JSON.stringify({
      schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
      values: Object.fromEntries(cache),
    }));
  } catch {}
};

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = readLikedStateStorage(normalizedUid);
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};""",
    'like-cache-loader',
)
like_text = replace_once(
    like_text,
    "    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));\n  }",
    "    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));\n    persistLikedStateCache(user.uid, cache);\n  }",
    'like-hydration-persist',
)
like_text = replace_once(
    like_text,
    "  getLikedStateCache(user.uid).set(result.trackId, result.liked);\n  invalidateExploreFeedSessionCache();",
    "  const cache = getLikedStateCache(user.uid);\n  cache.set(result.trackId, result.liked);\n  persistLikedStateCache(user.uid, cache);\n  invalidateExploreFeedSessionCache();",
    'like-mutation-persist',
)
like_path.write_text(like_text, encoding='utf-8')


# Cloudflare diagnostics: keep totals, and also group usage by endpoint.
cf_path = Path('src/lib/cloudflareDiagnostics.ts')
cf_path.write_text("""import { readCacheDiagnosticsGloballyEnabled } from './cacheDiagnostics';

export type CloudflarePathDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
};

export type CloudflareDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
  lastPath: string;
  paths: Record<string, CloudflarePathDiagnosticState>;
  updatedAt: number;
};

export const CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:cloudflare-diagnostics-update';
const CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY = 'soridraw_cloudflare_diagnostics_v1';
const MAX_PATH_GROUPS = 24;

const emptyPathState = (): CloudflarePathDiagnosticState => ({
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  r2ClassA: 0,
  r2ClassB: 0,
  meteredResponses: 0,
  unmeteredResponses: 0,
});

const emptyState = (updatedAt = 0): CloudflareDiagnosticState => ({
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  r2ClassA: 0,
  r2ClassB: 0,
  meteredResponses: 0,
  unmeteredResponses: 0,
  lastPath: '',
  paths: {},
  updatedAt,
});

const normalizeCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeDiagnosticPath = (value: string) => {
  let pathname = String(value || '').trim();
  if (!pathname) return '';
  try {
    if (/^https?:\\/\\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch {}
  pathname = pathname.split('?')[0] || '';
  if (/^\\/v1\\/tracks\\/[^/]+\\/like$/.test(pathname)) return '/v1/tracks/:id/like';
  if (/^\\/v1\\/tracks\\/[^/]+\\/visibility$/.test(pathname)) return '/v1/tracks/:id/visibility';
  return pathname.slice(0, 120);
};

const readStoredPaths = (value: unknown): Record<string, CloudflarePathDiagnosticState> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, any>)
    .slice(0, MAX_PATH_GROUPS)
    .reduce<Record<string, CloudflarePathDiagnosticState>>((acc, [path, state]) => {
      const normalizedPath = normalizeDiagnosticPath(path);
      if (!normalizedPath) return acc;
      acc[normalizedPath] = {
        workerRequests: normalizeCount(state?.workerRequests),
        d1RowsRead: normalizeCount(state?.d1RowsRead),
        d1RowsWritten: normalizeCount(state?.d1RowsWritten),
        r2ClassA: normalizeCount(state?.r2ClassA),
        r2ClassB: normalizeCount(state?.r2ClassB),
        meteredResponses: normalizeCount(state?.meteredResponses),
        unmeteredResponses: normalizeCount(state?.unmeteredResponses),
      };
      return acc;
    }, {});
};

export function readCloudflareDiagnostics(): CloudflareDiagnosticState {
  const fallback = emptyState();
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      workerRequests: normalizeCount(parsed?.workerRequests),
      d1RowsRead: normalizeCount(parsed?.d1RowsRead),
      d1RowsWritten: normalizeCount(parsed?.d1RowsWritten),
      r2ClassA: normalizeCount(parsed?.r2ClassA),
      r2ClassB: normalizeCount(parsed?.r2ClassB),
      meteredResponses: normalizeCount(parsed?.meteredResponses),
      unmeteredResponses: normalizeCount(parsed?.unmeteredResponses),
      lastPath: String(parsed?.lastPath || ''),
      paths: readStoredPaths(parsed?.paths),
      updatedAt: normalizeCount(parsed?.updatedAt),
    };
  } catch {
    return fallback;
  }
}

const writeCloudflareDiagnostics = (next: CloudflareDiagnosticState) => {
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, { detail: next }));
  }
};

export function resetCloudflareDiagnostics(): void {
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.removeItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY); } catch {}
  }
  writeCloudflareDiagnostics(emptyState(Date.now()));
}

const readUsageHeader = (response: Response, name: string) => normalizeCount(response.headers.get(name));

export function recordCloudflareResponse(response: Response, path = ''): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;

  const previous = readCloudflareDiagnostics();
  const diagnosticsVersion = String(response.headers.get('X-SORIDRAW-CF-Diagnostics') || '').trim();
  const metered = Boolean(diagnosticsVersion);
  const workerRequests = readUsageHeader(response, 'X-SORIDRAW-CF-Worker') || 1;
  const d1RowsRead = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Read') : 0;
  const d1RowsWritten = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Write') : 0;
  const r2ClassA = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-A') : 0;
  const r2ClassB = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-B') : 0;
  const resolvedPath = normalizeDiagnosticPath(path || (() => {
    try { return new URL(response.url).pathname; } catch { return ''; }
  })()) || '기타';
  const previousPath = previous.paths[resolvedPath] || emptyPathState();

  writeCloudflareDiagnostics({
    workerRequests: previous.workerRequests + workerRequests,
    d1RowsRead: previous.d1RowsRead + d1RowsRead,
    d1RowsWritten: previous.d1RowsWritten + d1RowsWritten,
    r2ClassA: previous.r2ClassA + r2ClassA,
    r2ClassB: previous.r2ClassB + r2ClassB,
    meteredResponses: previous.meteredResponses + (metered ? 1 : 0),
    unmeteredResponses: previous.unmeteredResponses + (metered ? 0 : 1),
    lastPath: resolvedPath,
    paths: {
      ...previous.paths,
      [resolvedPath]: {
        workerRequests: previousPath.workerRequests + workerRequests,
        d1RowsRead: previousPath.d1RowsRead + d1RowsRead,
        d1RowsWritten: previousPath.d1RowsWritten + d1RowsWritten,
        r2ClassA: previousPath.r2ClassA + r2ClassA,
        r2ClassB: previousPath.r2ClassB + r2ClassB,
        meteredResponses: previousPath.meteredResponses + (metered ? 1 : 0),
        unmeteredResponses: previousPath.unmeteredResponses + (metered ? 0 : 1),
      },
    },
    updatedAt: Date.now(),
  });
}
""", encoding='utf-8')


# CACHE LIVE: larger useful text, remove tiny redundant copy, expose endpoint breakdown.
overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
overlay = replace_once(
    overlay,
    "const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));",
    """const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));

const getCloudflarePathLabel = (path: string) => {
  if (path === '/v1/feed') return '피드';
  if (path === '/v1/me/likes') return '좋아요 상태';
  if (path === '/v1/me/publications') return '뮤직노트 공개상태';
  if (path === '/v1/tracks/:id/like') return '좋아요 변경';
  if (path === '/v1/tracks/:id/visibility') return '공개상태 변경';
  return path || '기타';
};""",
    'overlay-path-label',
)
overlay = replace_once(
    overlay,
    "  const cloudflareMetered = cloudflare.meteredResponses > 0;",
    """  const cloudflareMetered = cloudflare.meteredResponses > 0;
  const cloudflarePathEntries = Object.entries(cloudflare.paths || {})
    .filter(([, state]) => state.workerRequests > 0 || state.d1RowsRead > 0 || state.d1RowsWritten > 0)
    .sort((a, b) => {
      const aScore = a[1].d1RowsRead + a[1].d1RowsWritten + a[1].workerRequests;
      const bScore = b[1].d1RowsRead + b[1].d1RowsWritten + b[1].workerRequests;
      return bScore - aScore;
    })
    .slice(0, 5);
  const hasR2Usage = cloudflare.r2ClassA > 0 || cloudflare.r2ClassB > 0;""",
    'overlay-path-entries',
)

overlay = replace_once(overlay, 'text-[7px] font-black tabular-nums text-white/55', 'text-[9px] font-black tabular-nums text-white/60', 'mobile-counter')
overlay = replace_once(overlay, 'text-[10px] font-bold text-white/30', 'text-[11px] font-bold text-white/40', 'drag-label')
overlay = replace_once(overlay, 'mt-1 truncate text-[10px] font-bold text-white/55', 'mt-1 truncate text-[11px] font-bold text-white/60', 'collapsed-summary')
overlay = overlay.replace('px-2.5 py-1.5 text-[10px] font-black text-white/55', 'px-2.5 py-1.5 text-[11px] font-black text-white/60')

overlay = replace_once(
    overlay,
    """            <div className=\"whitespace-nowrap text-[11px] font-bold text-white/72\">{formatActualUsage(actual)}</div>
            <div className=\"whitespace-nowrap text-[9px] font-bold text-[#c6b5ff]\">
              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}
            </div>
            <div className=\"whitespace-nowrap text-[8px] font-bold text-[#c6b5ff]/75\">
              R2 · Class A {cloudflareMetered ? formatNumber(cloudflare.r2ClassA) : '—'} · Class B {cloudflareMetered ? formatNumber(cloudflare.r2ClassB) : '—'}
            </div>
            {cloudflare.unmeteredResponses > 0 ? (
              <div className=\"whitespace-nowrap text-[7px] font-bold text-[#c6b5ff]/48\">
                Worker 계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 진단 Worker 배포 후 초기화 권장
              </div>
            ) : null}""",
    """            <div className=\"whitespace-nowrap text-[12px] font-bold text-white/76\">{formatActualUsage(actual)}</div>
            <div className=\"whitespace-nowrap text-[12px] font-bold text-[#c6b5ff]\">
              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}
            </div>
            {cloudflarePathEntries.length > 0 ? (
              <div className=\"mt-1 space-y-0.5 rounded-lg bg-[#c6b5ff]/[0.055] px-2 py-1.5\">
                <div className=\"mb-0.5 text-[10px] font-black tracking-[0.04em] text-[#c6b5ff]/70\">CLOUDFLARE 발생처</div>
                {cloudflarePathEntries.map(([path, state]) => (
                  <div key={path} className=\"flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-[#c6b5ff]/82\">
                    <span className=\"truncate\">{getCloudflarePathLabel(path)}</span>
                    <span className=\"shrink-0 whitespace-nowrap tabular-nums\">Worker {formatNumber(state.workerRequests)} · D1 읽기 {formatNumber(state.d1RowsRead)} · 쓰기 {formatNumber(state.d1RowsWritten)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {hasR2Usage ? (
              <div className=\"whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/72\">
                R2 · Class A {formatNumber(cloudflare.r2ClassA)} · Class B {formatNumber(cloudflare.r2ClassB)}
              </div>
            ) : null}
            {cloudflare.unmeteredResponses > 0 ? (
              <div className=\"whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/55\">
                계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 초기화 권장
              </div>
            ) : null}""",
    'overlay-cloudflare-block',
)

for old, new in [
    ('mb-0.5 text-[8px] font-black tracking-[0.05em] text-white/34', 'mb-0.5 text-[10px] font-black tracking-[0.05em] text-white/42'),
    ('gap-2 text-[9px] font-bold text-white/54', 'gap-2 text-[11px] font-bold text-white/60'),
    ('mb-1 text-[9px] font-black tracking-[0.05em] text-white/38', 'mb-1 text-[10px] font-black tracking-[0.05em] text-white/45'),
    ('gap-2 text-[10px] font-bold text-white/58', 'gap-2 text-[11px] font-bold text-white/62'),
    ('whitespace-nowrap text-[11px] font-bold text-[#9fc7ff]', 'whitespace-nowrap text-[12px] font-bold text-[#9fc7ff]'),
    ('whitespace-nowrap text-[10px] font-bold text-[#9fc7ff]/75', 'whitespace-nowrap text-[11px] font-bold text-[#9fc7ff]/78'),
    ('whitespace-nowrap text-[10px] font-bold text-white/42', 'whitespace-nowrap text-[10px] font-bold text-white/48'),
    ('whitespace-nowrap text-[9px] font-bold text-white/28', 'whitespace-nowrap text-[10px] font-bold text-white/38'),
    ('whitespace-nowrap text-[8px] font-bold text-white/35', 'whitespace-nowrap text-[10px] font-bold text-white/42'),
    ('text-[7px] font-bold leading-3 text-[#ff9d9d]/80', 'text-[10px] font-bold leading-4 text-[#ff9d9d]/85'),
    ('gap-1 text-[10px] font-bold leading-6 sm:grid-cols-[76px_52px_1fr] sm:text-[11px]', 'gap-1 text-[11px] font-bold leading-6 sm:grid-cols-[76px_52px_1fr] sm:text-[12px]'),
    ('px-2 py-1 text-[9px] font-black text-white/55', 'px-2.5 py-1.5 text-[11px] font-black text-white/60'),
]:
    if old not in overlay:
        raise SystemExit(f'overlay-font missing: {old}')
    overlay = overlay.replace(old, new)

overlay = replace_once(
    overlay,
    '            <div className="whitespace-nowrap text-[7px] font-bold text-white/25">위=프로젝트 Cloud / SDK · 아래=기능별 참고값</div>\n',
    '',
    'remove-tiny-footer',
)
overlay_path.write_text(overlay, encoding='utf-8')

print('EXPLORE_LIKE_SESSION_CACHE_PATCHED=true')
print('CLOUDFLARE_PATH_BREAKDOWN_PATCHED=true')
print('CACHE_DIAGNOSTIC_READABILITY_PATCHED=true')

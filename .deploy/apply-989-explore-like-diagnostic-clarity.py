from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# 1) Persist Explore like-state cache for the signed-in tab/session.
like_path = Path("src/services/exploreLikeService.ts")
like_text = like_path.read_text(encoding="utf-8")

like_text = replace_once(
    like_text,
    'const likedStateByUid = new Map<string, Map<string, boolean>>();\n\nconst getLikedStateCache = (uid: string) => {\n  const existing = likedStateByUid.get(uid);\n  if (existing) return existing;\n  const created = new Map<string, boolean>();\n  likedStateByUid.set(uid, created);\n  return created;\n};',
    '''const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = "1";\nconst EXPLORE_LIKE_CACHE_KEY_BASE = "soridraw_explore_liked_state_cache_v1";\nconst likedStateByUid = new Map<string, Map<string, boolean>>();\n\nconst getLikedStateStorageKey = (uid: string) => `${EXPLORE_LIKE_CACHE_KEY_BASE}_${uid}`;\n\nconst readLikedStateStorage = (uid: string): Map<string, boolean> => {\n  const values = new Map<string, boolean>();\n  if (typeof window === "undefined") return values;\n  try {\n    const raw = window.sessionStorage.getItem(getLikedStateStorageKey(uid));\n    if (!raw) return values;\n    const parsed = JSON.parse(raw);\n    if (\n      parsed?.schemaVersion !== EXPLORE_LIKE_CACHE_SCHEMA_VERSION ||\n      !parsed?.values ||\n      typeof parsed.values !== "object" ||\n      Array.isArray(parsed.values)\n    ) {\n      window.sessionStorage.removeItem(getLikedStateStorageKey(uid));\n      return values;\n    }\n    Object.entries(parsed.values as Record<string, unknown>).forEach(([publicationId, liked]) => {\n      if (publicationId && typeof liked === "boolean") values.set(publicationId, liked);\n    });\n    return values;\n  } catch {\n    try { window.sessionStorage.removeItem(getLikedStateStorageKey(uid)); } catch {}\n    return values;\n  }\n};\n\nconst persistLikedStateCache = (uid: string, cache: Map<string, boolean>) => {\n  if (typeof window === "undefined") return;\n  try {\n    window.sessionStorage.setItem(getLikedStateStorageKey(uid), JSON.stringify({\n      schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,\n      values: Object.fromEntries(cache),\n    }));\n  } catch {}\n};\n\nconst getLikedStateCache = (uid: string) => {\n  const existing = likedStateByUid.get(uid);\n  if (existing) return existing;\n  const hydrated = readLikedStateStorage(uid);\n  likedStateByUid.set(uid, hydrated);\n  return hydrated;\n};''',
    "like-cache-loader",
)

like_text = replace_once(
    like_text,
    '  getLikedStateCache(user.uid).set(publicationId, liked);\n  return {',
    '  const cache = getLikedStateCache(user.uid);\n  cache.set(publicationId, liked);\n  persistLikedStateCache(user.uid, cache);\n  return {',
    "like-mutation-persist",
)

like_text = replace_once(
    like_text,
    '    missing.forEach((id) => cache.set(id, likedIds.has(id)));\n  }',
    '    missing.forEach((id) => cache.set(id, likedIds.has(id)));\n    persistLikedStateCache(user.uid, cache);\n  }',
    "like-hydration-persist",
)

like_path.write_text(like_text, encoding="utf-8")


# 2) Attribute Cloudflare usage to normalized endpoint groups.
cf_path = Path("src/lib/cloudflareDiagnostics.ts")
cf_path.write_text('''import { readCacheDiagnosticsGloballyEnabled } from './cacheDiagnostics';\n\nexport type CloudflarePathDiagnosticState = {\n  workerRequests: number;\n  d1RowsRead: number;\n  d1RowsWritten: number;\n  r2ClassA: number;\n  r2ClassB: number;\n  meteredResponses: number;\n  unmeteredResponses: number;\n};\n\nexport type CloudflareDiagnosticState = {\n  workerRequests: number;\n  d1RowsRead: number;\n  d1RowsWritten: number;\n  r2ClassA: number;\n  r2ClassB: number;\n  meteredResponses: number;\n  unmeteredResponses: number;\n  lastPath: string;\n  paths: Record<string, CloudflarePathDiagnosticState>;\n  updatedAt: number;\n};\n\nexport const CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:cloudflare-diagnostics-update';\nconst CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY = 'soridraw_cloudflare_diagnostics_v1';\nconst MAX_PATH_GROUPS = 24;\n\nconst emptyPathState = (): CloudflarePathDiagnosticState => ({\n  workerRequests: 0,\n  d1RowsRead: 0,\n  d1RowsWritten: 0,\n  r2ClassA: 0,\n  r2ClassB: 0,\n  meteredResponses: 0,\n  unmeteredResponses: 0,\n});\n\nconst emptyState = (updatedAt = 0): CloudflareDiagnosticState => ({\n  workerRequests: 0,\n  d1RowsRead: 0,\n  d1RowsWritten: 0,\n  r2ClassA: 0,\n  r2ClassB: 0,\n  meteredResponses: 0,\n  unmeteredResponses: 0,\n  lastPath: '',\n  paths: {},\n  updatedAt,\n});\n\nconst normalizeCount = (value: unknown) => {\n  const parsed = Number(value ?? 0);\n  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;\n};\n\nconst normalizeDiagnosticPath = (value: string) => {\n  let pathname = String(value || '').trim();\n  if (!pathname) return '';\n  try {\n    if (/^https?:\\/\\//i.test(pathname)) pathname = new URL(pathname).pathname;\n  } catch {}\n  pathname = pathname.split('?')[0] || '';\n  if (/^\\/v1\\/tracks\\/[^/]+\\/like$/.test(pathname)) return '/v1/tracks/:id/like';\n  if (/^\\/v1\\/tracks\\/[^/]+\\/visibility$/.test(pathname)) return '/v1/tracks/:id/visibility';\n  return pathname.slice(0, 120);\n};\n\nconst readStoredPaths = (value: unknown): Record<string, CloudflarePathDiagnosticState> => {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};\n  return Object.entries(value as Record<string, any>)\n    .slice(0, MAX_PATH_GROUPS)\n    .reduce<Record<string, CloudflarePathDiagnosticState>>((acc, [path, state]) => {\n      const normalizedPath = normalizeDiagnosticPath(path);\n      if (!normalizedPath) return acc;\n      acc[normalizedPath] = {\n        workerRequests: normalizeCount(state?.workerRequests),\n        d1RowsRead: normalizeCount(state?.d1RowsRead),\n        d1RowsWritten: normalizeCount(state?.d1RowsWritten),\n        r2ClassA: normalizeCount(state?.r2ClassA),\n        r2ClassB: normalizeCount(state?.r2ClassB),\n        meteredResponses: normalizeCount(state?.meteredResponses),\n        unmeteredResponses: normalizeCount(state?.unmeteredResponses),\n      };\n      return acc;\n    }, {});\n};\n\nexport function readCloudflareDiagnostics(): CloudflareDiagnosticState {\n  const fallback = emptyState();\n  if (typeof sessionStorage === 'undefined') return fallback;\n  try {\n    const raw = sessionStorage.getItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY);\n    if (!raw) return fallback;\n    const parsed = JSON.parse(raw);\n    return {\n      workerRequests: normalizeCount(parsed?.workerRequests),\n      d1RowsRead: normalizeCount(parsed?.d1RowsRead),\n      d1RowsWritten: normalizeCount(parsed?.d1RowsWritten),\n      r2ClassA: normalizeCount(parsed?.r2ClassA),\n      r2ClassB: normalizeCount(parsed?.r2ClassB),\n      meteredResponses: normalizeCount(parsed?.meteredResponses),\n      unmeteredResponses: normalizeCount(parsed?.unmeteredResponses),\n      lastPath: String(parsed?.lastPath || ''),\n      paths: readStoredPaths(parsed?.paths),\n      updatedAt: normalizeCount(parsed?.updatedAt),\n    };\n  } catch {\n    return fallback;\n  }\n}\n\nconst writeCloudflareDiagnostics = (next: CloudflareDiagnosticState) => {\n  if (typeof sessionStorage !== 'undefined') {\n    try { sessionStorage.setItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next)); } catch {}\n  }\n  if (typeof window !== 'undefined') {\n    window.dispatchEvent(new CustomEvent(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, { detail: next }));\n  }\n};\n\nexport function resetCloudflareDiagnostics(): void {\n  if (typeof sessionStorage !== 'undefined') {\n    try { sessionStorage.removeItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY); } catch {}\n  }\n  writeCloudflareDiagnostics(emptyState(Date.now()));\n}\n\nconst readUsageHeader = (response: Response, name: string) => normalizeCount(response.headers.get(name));\n\nexport function recordCloudflareResponse(response: Response, path = ''): void {\n  if (!readCacheDiagnosticsGloballyEnabled()) return;\n\n  const previous = readCloudflareDiagnostics();\n  const diagnosticsVersion = String(response.headers.get('X-SORIDRAW-CF-Diagnostics') || '').trim();\n  const metered = Boolean(diagnosticsVersion);\n  const workerRequests = readUsageHeader(response, 'X-SORIDRAW-CF-Worker') || 1;\n  const d1RowsRead = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Read') : 0;\n  const d1RowsWritten = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Write') : 0;\n  const r2ClassA = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-A') : 0;\n  const r2ClassB = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-B') : 0;\n  const resolvedPath = normalizeDiagnosticPath(path || (() => {\n    try { return new URL(response.url).pathname; } catch { return ''; }\n  })()) || '기타';\n  const previousPath = previous.paths[resolvedPath] || emptyPathState();\n  const nextPaths = {\n    ...previous.paths,\n    [resolvedPath]: {\n      workerRequests: previousPath.workerRequests + workerRequests,\n      d1RowsRead: previousPath.d1RowsRead + d1RowsRead,\n      d1RowsWritten: previousPath.d1RowsWritten + d1RowsWritten,\n      r2ClassA: previousPath.r2ClassA + r2ClassA,\n      r2ClassB: previousPath.r2ClassB + r2ClassB,\n      meteredResponses: previousPath.meteredResponses + (metered ? 1 : 0),\n      unmeteredResponses: previousPath.unmeteredResponses + (metered ? 0 : 1),\n    },\n  };\n\n  writeCloudflareDiagnostics({\n    workerRequests: previous.workerRequests + workerRequests,\n    d1RowsRead: previous.d1RowsRead + d1RowsRead,\n    d1RowsWritten: previous.d1RowsWritten + d1RowsWritten,\n    r2ClassA: previous.r2ClassA + r2ClassA,\n    r2ClassB: previous.r2ClassB + r2ClassB,\n    meteredResponses: previous.meteredResponses + (metered ? 1 : 0),\n    unmeteredResponses: previous.unmeteredResponses + (metered ? 0 : 1),\n    lastPath: resolvedPath,\n    paths: nextPaths,\n    updatedAt: Date.now(),\n  });\n}\n''', encoding="utf-8")


# 3) Make CACHE LIVE readable and show Cloudflare endpoint sources.
overlay_path = Path("src/components/CacheDiagnosticsOverlay.tsx")
overlay = overlay_path.read_text(encoding="utf-8")

overlay = replace_once(
    overlay,
    "const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));",
    """const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));\n\nconst getCloudflarePathLabel = (path: string) => {\n  if (path === '/v1/feed') return '피드';\n  if (path === '/v1/me/likes') return '좋아요 상태';\n  if (path === '/v1/me/publications') return '뮤직노트 공개상태';\n  if (path === '/v1/tracks/:id/like') return '좋아요 변경';\n  if (path === '/v1/tracks/:id/visibility') return '공개상태 변경';\n  return path || '기타';\n};""",
    "overlay-path-label",
)

overlay = replace_once(
    overlay,
    "  const cloudflareMetered = cloudflare.meteredResponses > 0;",
    """  const cloudflareMetered = cloudflare.meteredResponses > 0;\n  const cloudflarePathEntries = Object.entries(cloudflare.paths || {})\n    .filter(([, state]) => state.workerRequests > 0 || state.d1RowsRead > 0 || state.d1RowsWritten > 0)\n    .sort((a, b) => {\n      const aScore = a[1].d1RowsRead + a[1].d1RowsWritten + a[1].workerRequests;\n      const bScore = b[1].d1RowsRead + b[1].d1RowsWritten + b[1].workerRequests;\n      return bScore - aScore;\n    })\n    .slice(0, 5);\n  const hasR2Usage = cloudflare.r2ClassA > 0 || cloudflare.r2ClassB > 0;""",
    "overlay-path-entries",
)

replacements = [
    ('text-[7px] font-black tabular-nums text-white/55', 'text-[9px] font-black tabular-nums text-white/60', 'mobile-worker-count'),
    ('text-[10px] font-bold text-white/30', 'text-[11px] font-bold text-white/40', 'drag-label'),
    ('mt-1 truncate text-[10px] font-bold text-white/55', 'mt-1 truncate text-[11px] font-bold text-white/60', 'collapsed-summary'),
    ('px-2.5 py-1.5 text-[10px] font-black text-white/55', 'px-2.5 py-1.5 text-[11px] font-black text-white/60', 'header-button-first'),
]
for old, new, label in replacements:
    # header button class appears twice, so only first replacement is not safe for that shared token.
    if label == 'header-button-first':
        count = overlay.count(old)
        if count < 2:
            raise SystemExit(f"{label}: expected at least 2 matches, found {count}")
        overlay = overlay.replace(old, new)
    else:
        overlay = replace_once(overlay, old, new, label)

overlay = replace_once(
    overlay,
    '<div className="whitespace-nowrap text-[11px] font-bold text-white/72">{formatActualUsage(actual)}</div>\n            <div className="whitespace-nowrap text-[9px] font-bold text-[#c6b5ff]">\n              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : \'—\'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : \'—\'}\n            </div>\n            <div className="whitespace-nowrap text-[8px] font-bold text-[#c6b5ff]/75">\n              R2 · Class A {cloudflareMetered ? formatNumber(cloudflare.r2ClassA) : \'—\'} · Class B {cloudflareMetered ? formatNumber(cloudflare.r2ClassB) : \'—\'}\n            </div>\n            {cloudflare.unmeteredResponses > 0 ? (\n              <div className="whitespace-nowrap text-[7px] font-bold text-[#c6b5ff]/48">\n                Worker 계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 진단 Worker 배포 후 초기화 권장\n              </div>\n            ) : null}',
    '''<div className="whitespace-nowrap text-[12px] font-bold text-white/76">{formatActualUsage(actual)}</div>\n            <div className="whitespace-nowrap text-[12px] font-bold text-[#c6b5ff]">\n              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}\n            </div>\n            {cloudflarePathEntries.length > 0 ? (\n              <div className="mt-1 space-y-0.5 rounded-lg bg-[#c6b5ff]/[0.055] px-2 py-1.5">\n                <div className="mb-0.5 text-[10px] font-black tracking-[0.04em] text-[#c6b5ff]/70">CLOUDFLARE 발생처</div>\n                {cloudflarePathEntries.map(([path, state]) => (\n                  <div key={path} className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-[#c6b5ff]/82">\n                    <span className="truncate">{getCloudflarePathLabel(path)}</span>\n                    <span className="shrink-0 whitespace-nowrap tabular-nums">Worker {formatNumber(state.workerRequests)} · D1 읽기 {formatNumber(state.d1RowsRead)} · 쓰기 {formatNumber(state.d1RowsWritten)}</span>\n                  </div>\n                ))}\n              </div>\n            ) : null}\n            {hasR2Usage ? (\n              <div className="whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/72">\n                R2 · Class A {formatNumber(cloudflare.r2ClassA)} · Class B {formatNumber(cloudflare.r2ClassB)}\n              </div>\n            ) : null}\n            {cloudflare.unmeteredResponses > 0 ? (\n              <div className="whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/55">\n                계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 초기화 권장\n              </div>\n            ) : null}''',
    "overlay-cloudflare-block",
)

font_replacements = [
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
]
for old, new in font_replacements:
    if old not in overlay:
        raise SystemExit(f"overlay-font: missing {old}")
    overlay = overlay.replace(old, new)

overlay = replace_once(
    overlay,
    '            <div className="whitespace-nowrap text-[7px] font-bold text-white/25">위=프로젝트 Cloud / SDK · 아래=기능별 참고값</div>\n',
    '',
    "remove-low-value-footer",
)

overlay_path.write_text(overlay, encoding="utf-8")

print("EXPLORE_LIKE_SESSION_CACHE_PATCHED=true")
print("CLOUDFLARE_PATH_BREAKDOWN_PATCHED=true")
print("CACHE_DIAGNOSTIC_READABILITY_PATCHED=true")

from pathlib import Path

MARKER = 'SORIDRAW_CACHE_LIVE_CLOUDFLARE_MOBILE_DOCK_977'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'apply-977: {label} anchor mismatch: {count}')
    return text.replace(old, new, 1)


# 1) CACHE LIVE: Cloudflare counters + mobile collapsed -> right docked mini button.
overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
if MARKER not in overlay:
    overlay = replace_once(
        overlay,
        "} from '../lib/cacheDiagnostics';\n",
        "} from '../lib/cacheDiagnostics';\nimport {\n  CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT,\n  readCloudflareDiagnostics,\n  resetCloudflareDiagnostics,\n  type CloudflareDiagnosticState,\n} from '../lib/cloudflareDiagnostics';\n\nconst " + MARKER + " = true;\n",
        'overlay Cloudflare import',
    )
    overlay = replace_once(
        overlay,
        "const PANEL_COLLAPSED_STORAGE_KEY = 'soridraw_cache_live_collapsed_v1';\nconst PANEL_MARGIN = 8;",
        "const PANEL_COLLAPSED_STORAGE_KEY = 'soridraw_cache_live_collapsed_v1';\nconst PANEL_DOCKED_STORAGE_KEY = 'soridraw_cache_live_docked_v1';\nconst PANEL_MOBILE_BREAKPOINT = 767;\nconst PANEL_MARGIN = 8;",
        'overlay dock constants',
    )
    overlay = replace_once(
        overlay,
        "const readInitialCollapsed = () => {\n  if (typeof window === 'undefined') return false;\n  try { return window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === 'true'; } catch { return false; }\n};\n",
        "const readInitialCollapsed = () => {\n  if (typeof window === 'undefined') return false;\n  try { return window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === 'true'; } catch { return false; }\n};\n\nconst readInitialDocked = () => {\n  if (typeof window === 'undefined') return false;\n  try { return window.localStorage.getItem(PANEL_DOCKED_STORAGE_KEY) === 'true'; } catch { return false; }\n};\n",
        'overlay dock reader',
    )
    overlay = replace_once(
        overlay,
        "  const [position, setPosition] = useState<PanelPosition>(() => readInitialPosition());\n  const [collapsed, setCollapsed] = useState(() => readInitialCollapsed());\n  const [serverUsage, setServerUsage] = useState<FirestoreServerUsage | null>(null);",
        "  const [position, setPosition] = useState<PanelPosition>(() => readInitialPosition());\n  const [collapsed, setCollapsed] = useState(() => readInitialCollapsed());\n  const [docked, setDocked] = useState(() => readInitialDocked());\n  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= PANEL_MOBILE_BREAKPOINT);\n  const [cloudflare, setCloudflare] = useState<CloudflareDiagnosticState>(() => readCloudflareDiagnostics());\n  const [serverUsage, setServerUsage] = useState<FirestoreServerUsage | null>(null);",
        'overlay dock/cloudflare state',
    )
    overlay = replace_once(
        overlay,
        "    const onActualUpdate = (event: Event) => {\n      const detail = (event as CustomEvent<FirestoreActualState>).detail;\n      if (!detail) return;\n      setActual(detail);\n    };\n",
        "    const onActualUpdate = (event: Event) => {\n      const detail = (event as CustomEvent<FirestoreActualState>).detail;\n      if (!detail) return;\n      setActual(detail);\n    };\n    const onCloudflareUpdate = (event: Event) => {\n      const detail = (event as CustomEvent<CloudflareDiagnosticState>).detail;\n      if (!detail) return;\n      setCloudflare(detail);\n    };\n",
        'overlay Cloudflare event callback',
    )
    overlay = replace_once(
        overlay,
        "    setStates(readAllStates());\n    setActual(readFirestoreActual());\n    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);",
        "    setStates(readAllStates());\n    setActual(readFirestoreActual());\n    setCloudflare(readCloudflareDiagnostics());\n    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);",
        'overlay Cloudflare initial state',
    )
    overlay = replace_once(
        overlay,
        "    window.addEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);\n    window.addEventListener('storage', onStorage);",
        "    window.addEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);\n    window.addEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n    window.addEventListener('storage', onStorage);",
        'overlay Cloudflare event add',
    )
    overlay = replace_once(
        overlay,
        "      window.removeEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);\n      window.removeEventListener('storage', onStorage);",
        "      window.removeEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);\n      window.removeEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n      window.removeEventListener('storage', onStorage);",
        'overlay Cloudflare event remove',
    )
    overlay = replace_once(
        overlay,
        "  useEffect(() => {\n    try { window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false'); } catch {}\n    const frame = window.requestAnimationFrame(() => {",
        "  useEffect(() => {\n    try { window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false'); } catch {}\n    const frame = window.requestAnimationFrame(() => {",
        'overlay collapsed persistence guard',
    )
    overlay = replace_once(
        overlay,
        "  }, [clampPosition, collapsed, persistPosition]);\n\n  useEffect(() => {\n    const onResize = () => {",
        "  }, [clampPosition, collapsed, persistPosition]);\n\n  useEffect(() => {\n    try { window.localStorage.setItem(PANEL_DOCKED_STORAGE_KEY, docked ? 'true' : 'false'); } catch {}\n  }, [docked]);\n\n  useEffect(() => {\n    const onResize = () => {\n      const nextMobile = window.innerWidth <= PANEL_MOBILE_BREAKPOINT;\n      setIsMobile(nextMobile);\n      if (!nextMobile) setDocked(false);",
        'overlay dock persistence/resize',
    )
    overlay = replace_once(
        overlay,
        "  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {\n    const drag = dragRef.current;\n    if (!drag || drag.pointerId !== event.pointerId) return;\n    const next = clampPosition(\n      drag.originX + event.clientX - drag.startX,\n      drag.originY + event.clientY - drag.startY,\n    );\n    setPosition(next);\n  };",
        "  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {\n    const drag = dragRef.current;\n    if (!drag || drag.pointerId !== event.pointerId) return;\n    const deltaX = event.clientX - drag.startX;\n    const deltaY = event.clientY - drag.startY;\n\n    if (isMobile && collapsed && !docked && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {\n      if (deltaX > 42) {\n        dragRef.current = null;\n        setDocked(true);\n      }\n      return;\n    }\n\n    const next = clampPosition(\n      drag.originX + deltaX,\n      drag.originY + deltaY,\n    );\n    setPosition(next);\n  };",
        'overlay collapsed right swipe dock',
    )
    overlay = replace_once(
        overlay,
        "  const sampledThrough = serverUsage?.sampledThroughMs\n    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })\n    : '';\n\n  return (",
        "  const sampledThrough = serverUsage?.sampledThroughMs\n    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })\n    : '';\n  const cloudflareMetered = cloudflare.meteredResponses > 0;\n\n  if (docked && isMobile) {\n    return (\n      <button\n        type=\"button\"\n        title=\"CACHE LIVE 소형 패널 펼치기\"\n        aria-label=\"CACHE LIVE 소형 패널 펼치기\"\n        onClick={() => setDocked(false)}\n        className=\"fixed bottom-[18px] right-2 z-[9998] grid h-11 w-11 place-items-center rounded-full border-0 bg-black/80 p-0 text-white/80 shadow-2xl outline-none backdrop-blur-md transition hover:bg-black/90 hover:text-white\"\n      >\n        <span className=\"text-[10px] font-black tracking-[-0.02em]\">CACHE</span>\n        <span className=\"absolute bottom-[5px] right-[6px] min-w-[12px] rounded-full bg-white/10 px-1 text-[7px] font-black tabular-nums text-white/55\">{formatNumber(cloudflare.workerRequests)}</span>\n      </button>\n    );\n  }\n\n  return (",
        'overlay docked mini render',
    )
    overlay = replace_once(
        overlay,
        "              SDK 읽기 {formatNumber(actual.reads)} · Cloud 읽기 {serverUsage ? formatNumber(todayOps?.reads) : '—'}",
        "              SDK 읽기 {formatNumber(actual.reads)} · CF {formatNumber(cloudflare.workerRequests)} · Cloud 읽기 {serverUsage ? formatNumber(todayOps?.reads) : '—'}",
        'overlay collapsed CF summary',
    )
    overlay = replace_once(
        overlay,
        "            <div className=\"whitespace-nowrap text-[9px] font-bold text-white/66\">{formatActualUsage(actual)}</div>\n            {serverUsage ? (",
        "            <div className=\"whitespace-nowrap text-[9px] font-bold text-white/66\">{formatActualUsage(actual)}</div>\n            <div className=\"whitespace-nowrap text-[9px] font-bold text-[#c6b5ff]\">\n              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}\n            </div>\n            <div className=\"whitespace-nowrap text-[8px] font-bold text-[#c6b5ff]/75\">\n              R2 · Class A {cloudflareMetered ? formatNumber(cloudflare.r2ClassA) : '—'} · Class B {cloudflareMetered ? formatNumber(cloudflare.r2ClassB) : '—'}\n            </div>\n            {cloudflare.unmeteredResponses > 0 ? (\n              <div className=\"whitespace-nowrap text-[7px] font-bold text-[#c6b5ff]/48\">\n                Worker 계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 진단 Worker 배포 후 초기화 권장\n              </div>\n            ) : null}\n            {serverUsage ? (",
        'overlay expanded CF metrics',
    )
    overlay = replace_once(
        overlay,
        "                resetCacheDiagnostics();\n                setStates(readAllStates());\n                setActual(readFirestoreActual());",
        "                resetCacheDiagnostics();\n                resetCloudflareDiagnostics();\n                setStates(readAllStates());\n                setActual(readFirestoreActual());\n                setCloudflare(readCloudflareDiagnostics());",
        'overlay reset CF',
    )
    overlay = replace_once(
        overlay,
        "              SDK 초기화\n",
        "              진단 초기화\n",
        'overlay reset label',
    )
    overlay_path.write_text(overlay, encoding='utf-8')


# 2) Explore Worker fetch wrappers: record response usage headers locally only.
def patch_service(path_name: str, import_anchor: str, fetch_anchor: str, label: str) -> None:
    path = Path(path_name)
    text = path.read_text(encoding='utf-8')
    if "recordCloudflareResponse" not in text:
        text = replace_once(
            text,
            import_anchor,
            import_anchor + "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n",
            f'{label} import',
        )
        text = replace_once(
            text,
            fetch_anchor,
            fetch_anchor + "\n  recordCloudflareResponse(response, path);",
            f'{label} response recording',
        )
        path.write_text(text, encoding='utf-8')


patch_service(
    'src/services/explorePublicationService.ts',
    "import { getFirebaseAppCheckToken } from '../firebase';\n",
    "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    ...init,\n    headers: {\n      ...authHeaders,\n      ...(init.body ? { 'Content-Type': 'application/json' } : {}),\n      ...(init.headers || {}),\n    },\n  });",
    'publication service',
)

patch_service(
    'src/services/exploreLikeService.ts',
    "import { getFirebaseAppCheckToken } from '../firebase';\n",
    "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    ...init,\n    headers: {\n      ...authHeaders,\n      ...(init.body ? { 'Content-Type': 'application/json' } : {}),\n      ...(init.headers || {}),\n    },\n  });",
    'like service',
)

# Social service has public + authenticated fetch paths.
social_path = Path('src/services/exploreSocialService.ts')
social = social_path.read_text(encoding='utf-8')
if "recordCloudflareResponse" not in social:
    social = replace_once(
        social,
        "import { getFirebaseAppCheckToken } from '../firebase';\n",
        "import { getFirebaseAppCheckToken } from '../firebase';\nimport { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n",
        'social service import',
    )
    social = replace_once(
        social,
        "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    method: 'GET',\n    headers: { Accept: 'application/json' },\n  });",
        "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    method: 'GET',\n    headers: { Accept: 'application/json' },\n  });\n  recordCloudflareResponse(response, path);",
        'social public response recording',
    )
    social = replace_once(
        social,
        "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    ...init,\n    headers: {\n      ...authHeaders,\n      Accept: 'application/json',\n      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),\n      ...(init.headers || {}),\n    },\n  });",
        "  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {\n    ...init,\n    headers: {\n      ...authHeaders,\n      Accept: 'application/json',\n      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),\n      ...(init.headers || {}),\n    },\n  });\n  recordCloudflareResponse(response, path);",
        'social authed response recording',
    )
    social_path.write_text(social, encoding='utf-8')

# Explore feed/search currently fetches Worker directly.
page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
if "recordCloudflareResponse" not in page:
    page = replace_once(
        page,
        "import { auth } from '../firebase';\n",
        "import { auth } from '../firebase';\nimport { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n",
        'Explore page diagnostics import',
    )
    page = replace_once(
        page,
        "      .then(async (response) => {\n        if (!response.ok) throw new Error(`HTTP ${response.status}`);",
        "      .then(async (response) => {\n        recordCloudflareResponse(response);\n        if (!response.ok) throw new Error(`HTTP ${response.status}`);",
        'Explore page feed response recording',
    )
    page_path.write_text(page, encoding='utf-8')


# Build-time verification.
checks = {
    'src/components/CacheDiagnosticsOverlay.tsx': [
        MARKER,
        'CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT',
        'Cloudflare 앱 · Worker',
        'R2 · Class A',
        'PANEL_DOCKED_STORAGE_KEY',
        'deltaX > 42',
        'CACHE LIVE 소형 패널 펼치기',
        '진단 초기화',
    ],
    'src/services/explorePublicationService.ts': ['recordCloudflareResponse(response, path)'],
    'src/services/exploreLikeService.ts': ['recordCloudflareResponse(response, path)'],
    'src/services/exploreSocialService.ts': ['recordCloudflareResponse(response, path)'],
    'src/pages/ExplorePage.tsx': ['recordCloudflareResponse(response)'],
    'src/lib/cloudflareDiagnostics.ts': [
        'X-SORIDRAW-CF-Diagnostics',
        'X-SORIDRAW-D1-Read',
        'X-SORIDRAW-R2-A',
        'unmeteredResponses',
    ],
}
for file_name, fragments in checks.items():
    text = Path(file_name).read_text(encoding='utf-8')
    for fragment in fragments:
        if fragment not in text:
            raise RuntimeError(f'apply-977 verification failed: {file_name} missing {fragment}')

print('apply-977: CACHE LIVE Cloudflare counters + mobile right-swipe docked mini button verified')

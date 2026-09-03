from pathlib import Path

MARKER = 'SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


# 1) Public Explore profile: cached content renders immediately; a stale cache is
# revalidated in the background and only a changed revision updates the visible UI.
explore_path = Path('src/pages/ExplorePage.tsx')
explore = explore_path.read_text(encoding='utf-8')
if MARKER not in explore:
    explore = replace_once(
        explore,
        '// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975\n',
        '// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975\n// SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000\n',
        'Explore marker',
    )

    anchor = """    getExplorePublicProfileFirstView(profileUid)
      .then(async ({ profile: nextProfile, tracks: rows }) => {
        if (cancelled) return;
        const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
        normalizedTracks.sort((a, b) => Number(b.profilePinned) - Number(a.profilePinned));
        setProfile(nextProfile);
        setProfileTracks(normalizedTracks);

        if (user && user.uid !== nextProfile.uid) {"""
    replacement = """    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>) => {
      if (cancelled) return;
      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      normalizedTracks.sort((a, b) => Number(b.profilePinned) - Number(a.profilePinned));
      setProfile(nextProfile);
      setProfileTracks(normalizedTracks);
    };

    getExplorePublicProfileFirstView(profileUid, {
      onRevalidated: ({ profile: refreshedProfile, tracks: refreshedRows }) => {
        applyProfileFirstView(refreshedProfile, refreshedRows);
      },
      onInvalidated: (message) => {
        if (cancelled) return;
        setProfile(null);
        setProfileTracks([]);
        setFollowState(null);
        setProfileError(message || '공개 프로필을 불러오지 못했어요.');
      },
    })
      .then(async ({ profile: nextProfile, tracks: rows }) => {
        if (cancelled) return;
        applyProfileFirstView(nextProfile, rows);

        if (user && user.uid !== nextProfile.uid) {"""
    explore = replace_once(explore, anchor, replacement, 'Explore first-view SWR callback')
    explore_path.write_text(explore, encoding='utf-8')


# 2) Existing CACHE LIVE panel: normal Admin accounts with the appSettings
# permission can use it, ownership follows the signed-in UID, and the panel no
# longer creates a Cloud Function call every minute just by being open.
overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
if MARKER not in overlay:
    overlay = replace_once(
        overlay,
        "import { functions, httpsCallable } from '../firebase';",
        "import { auth, functions, httpsCallable } from '../firebase';",
        'CACHE LIVE firebase import',
    )
    overlay = replace_once(
        overlay,
        "  CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY,\n  CACHE_DIAGNOSTICS_TOGGLE_EVENT,",
        "  CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY,\n  CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY,\n  CACHE_DIAGNOSTICS_TOGGLE_EVENT,",
        'CACHE LIVE owner key import',
    )
    overlay = replace_once(
        overlay,
        "  readCacheDiagnostic,\n  readCacheDiagnosticsGloballyEnabled,\n  readFirestoreActual,",
        "  readCacheDiagnostic,\n  readCacheDiagnosticsEnabled,\n  readFirestoreActual,",
        'CACHE LIVE owner-scoped reader import',
    )
    overlay = replace_once(
        overlay,
        "} from '../lib/cloudflareDiagnostics';\n\nconst SORIDRAW_CACHE_LIVE_CLOUDFLARE_MOBILE_DOCK_977 = true;",
        "} from '../lib/cloudflareDiagnostics';\nimport { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';\nimport { hasAdminPermission } from '../constants/adminPermissions';\n\nconst SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000 = true;\nconst SORIDRAW_CACHE_LIVE_CLOUDFLARE_MOBILE_DOCK_977 = true;",
        'CACHE LIVE admin permission imports',
    )
    overlay = overlay.replace('const CLOUD_REFRESH_MS = 60_000;\n', '')

    overlay = replace_once(
        overlay,
        "  if (path === '/v1/tracks/:id/visibility') return '공개상태 변경';\n  return path || '기타';",
        "  if (path === '/v1/tracks/:id/visibility') return '공개상태 변경';\n  if (path === '/v1/profiles/:id/first-view') return '공개프로필';\n  return path || '기타';",
        'CACHE LIVE profile path label',
    )

    overlay = replace_once(
        overlay,
        "export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {\n  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsGloballyEnabled());",
        "export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {\n  const [, setAccessRevision] = useState(0);\n  const currentUid = String(auth.currentUser?.uid || '');\n  const canUseDiagnostics = isAdmin || hasAdminPermission(readUserProfileCache(currentUid), 'appSettings');\n  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsEnabled(auth.currentUser?.uid));",
        'CACHE LIVE effective admin access',
    )

    overlay = replace_once(
        overlay,
        "    if (!isAdmin || !enabled || serverLoadingRef.current) return;",
        "    if (!canUseDiagnostics || !enabled || serverLoadingRef.current) return;",
        'CACHE LIVE manual cloud permission',
    )
    overlay = replace_once(
        overlay,
        "  }, [enabled, isAdmin]);",
        "  }, [canUseDiagnostics, enabled]);",
        'CACHE LIVE callback deps',
    )

    overlay = replace_once(
        overlay,
        "    const syncEnabled = () => setEnabled(readCacheDiagnosticsGloballyEnabled());",
        "    const syncEnabled = () => setEnabled(readCacheDiagnosticsEnabled(auth.currentUser?.uid));",
        'CACHE LIVE owner sync',
    )
    overlay = replace_once(
        overlay,
        "    const onStorage = (event: StorageEvent) => {\n      if (event.key === CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) syncEnabled();\n    };",
        "    const onProfileCache = () => {\n      setAccessRevision((value) => value + 1);\n      syncEnabled();\n    };\n    const onStorage = (event: StorageEvent) => {\n      if (event.key === CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY || event.key === CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY) syncEnabled();\n    };",
        'CACHE LIVE profile/storage sync',
    )
    overlay = replace_once(
        overlay,
        "    window.addEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n    window.addEventListener('storage', onStorage);",
        "    window.addEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n    window.addEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache as EventListener);\n    window.addEventListener('storage', onStorage);",
        'CACHE LIVE profile listener add',
    )
    overlay = replace_once(
        overlay,
        "      window.removeEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n      window.removeEventListener('storage', onStorage);",
        "      window.removeEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);\n      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache as EventListener);\n      window.removeEventListener('storage', onStorage);",
        'CACHE LIVE profile listener remove',
    )

    auto_poll = """  useEffect(() => {
    if (!isAdmin || !enabled || collapsed) return;
    void loadServerUsage();
    const timer = window.setInterval(() => {
      void loadServerUsage();
    }, CLOUD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [collapsed, enabled, isAdmin, loadServerUsage]);

"""
    if auto_poll not in overlay:
        raise RuntimeError('CACHE LIVE automatic Cloud polling block missing')
    overlay = overlay.replace(auto_poll, '', 1)

    overlay = replace_once(
        overlay,
        "  if (!isAdmin || !enabled) return null;",
        "  if (!canUseDiagnostics || !enabled) return null;",
        'CACHE LIVE final access gate',
    )

    overlay = replace_once(
        overlay,
        ".filter(([, state]) => state.workerRequests > 0 || state.d1RowsRead > 0 || state.d1RowsWritten > 0)\n    .sort((a, b) => {\n      const aScore = a[1].d1RowsRead + a[1].d1RowsWritten + a[1].workerRequests;\n      const bScore = b[1].d1RowsRead + b[1].d1RowsWritten + b[1].workerRequests;",
        ".filter(([, state]) => state.localCacheHits > 0 || state.workerRequests > 0 || state.d1RowsRead > 0 || state.d1RowsWritten > 0)\n    .sort((a, b) => {\n      const aScore = a[1].localCacheHits + a[1].d1RowsRead + a[1].d1RowsWritten + a[1].workerRequests;\n      const bScore = b[1].localCacheHits + b[1].d1RowsRead + b[1].d1RowsWritten + b[1].workerRequests;",
        'CACHE LIVE local profile path visibility',
    )

    overlay = replace_once(
        overlay,
        "              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}",
        "              Cloudflare 앱 · LOCAL {formatNumber(cloudflare.localCacheHits)} · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}",
        'CACHE LIVE top Cloudflare totals',
    )

    old_map = """                {cloudflarePathEntries.map(([path, state]) => (
                  <div key={path} className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-[#c6b5ff]/82">
                    <span className="truncate">{getCloudflarePathLabel(path)}</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">Worker {formatNumber(state.workerRequests)} · D1 읽기 {formatNumber(state.d1RowsRead)} · 쓰기 {formatNumber(state.d1RowsWritten)}</span>
                  </div>
                ))}"""
    new_map = """                {cloudflarePathEntries.map(([path, state]) => (
                  <div key={path} className="space-y-0.5">
                    <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-[#c6b5ff]/82">
                      <span className="truncate">{getCloudflarePathLabel(path)}</span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums">LOCAL {formatNumber(state.localCacheHits)} · Worker {formatNumber(state.workerRequests)} · D1 읽기 {formatNumber(state.d1RowsRead)} · 쓰기 {formatNumber(state.d1RowsWritten)}</span>
                    </div>
                    {state.lastOutcome ? (
                      <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] font-bold text-[#c6b5ff]/58">
                        <span className="truncate">마지막 · {state.lastOutcome}{state.lastEdgeCache ? ` · ${state.lastEdgeCache}` : ''}</span>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">검증 {formatNumber(state.revisionChecks)} · 304 {formatNumber(state.notModifiedResponses)} · 200 {formatNumber(state.fullResponses)} · {formatNumber(state.lastDurationMs)}ms</span>
                      </div>
                    ) : null}
                  </div>
                ))}"""
    overlay = replace_once(overlay, old_map, new_map, 'CACHE LIVE per-path revision diagnostics')

    overlay_path.write_text(overlay, encoding='utf-8')

print('SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_APPLY=PASS')

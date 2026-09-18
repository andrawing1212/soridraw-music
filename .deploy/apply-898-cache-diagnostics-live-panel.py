from pathlib import Path

MARKER = 'SORIDRAW_898_CACHE_DIAGNOSTICS_LIVE_PANEL'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "import CacheDiagnosticBadge from './components/CacheDiagnosticBadge';",
        "import CacheDiagnosticBadge from './components/CacheDiagnosticBadge';\nimport CacheDiagnosticsOverlay from './components/CacheDiagnosticsOverlay';",
        'live diagnostics overlay import',
    )
    app = replace_once(
        app,
        "      <SplitPerformanceDiagnostics isAdmin={isMasterDiagnosticsUser} />\n\n      <Routes>",
        "      <SplitPerformanceDiagnostics isAdmin={isMasterDiagnosticsUser} />\n      <CacheDiagnosticsOverlay isAdmin={isMasterDiagnosticsUser} />\n\n      <Routes>",
        'live diagnostics overlay render',
    )
    app = app.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        1,
    )
    app_path.write_text(app, encoding='utf-8')

admin_path = Path('src/pages/AdminAppSettingsPage.tsx')
admin = admin_path.read_text(encoding='utf-8')
if MARKER not in admin:
    admin = replace_once(
        admin,
        "import { readCacheDiagnosticsEnabled, setCacheDiagnosticsEnabled } from '../lib/cacheDiagnostics';",
        "import { readCacheDiagnosticsEnabled, readCacheDiagnosticsGloballyEnabled, readCacheDiagnosticsOwnerUid, setCacheDiagnosticsEnabled } from '../lib/cacheDiagnostics';",
        'admin diagnostics owner migration imports',
    )
    admin = replace_once(
        admin,
        "  const [cacheDiagnosticsEnabled, setCacheDiagnosticsEnabledState] = useState(() => readCacheDiagnosticsEnabled(auth.currentUser?.uid || null));",
        "  const [cacheDiagnosticsEnabled, setCacheDiagnosticsEnabledState] = useState(() => readCacheDiagnosticsEnabled(auth.currentUser?.uid || null));\n\n  useEffect(() => {\n    const uid = auth.currentUser?.uid || '';\n    if (!uid) return;\n    if (readCacheDiagnosticsGloballyEnabled() && !readCacheDiagnosticsOwnerUid()) {\n      setCacheDiagnosticsEnabled(true, uid);\n      setCacheDiagnosticsEnabledState(true);\n    }\n  }, []);",
        'admin diagnostics legacy owner adoption',
    )
    admin = admin.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_ADMIN_SCOPE = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_ADMIN_SCOPE = true;\n',
        1,
    )
    admin_path.write_text(admin, encoding='utf-8')

print('Applied SORIDRAW 898: live global cache diagnostics panel + owner migration.')

# 899 fixes reload persistence at the overlay source and records Music Note
# page-entry reuse of the already-loaded in-memory favorites cache.
apply_899 = Path('.deploy/apply-899-cache-diagnostics-persistence-musicnote.py')
if apply_899.exists():
    exec(compile(apply_899.read_text(encoding='utf-8'), str(apply_899), 'exec'), {'__name__': '__main__'})

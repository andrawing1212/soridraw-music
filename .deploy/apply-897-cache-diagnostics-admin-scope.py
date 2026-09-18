from pathlib import Path

MARKER = 'SORIDRAW_897_CACHE_DIAGNOSTICS_ADMIN_SCOPE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


admin_path = Path('src/pages/AdminAppSettingsPage.tsx')
admin = admin_path.read_text(encoding='utf-8')

if MARKER not in admin:
    admin = replace_once(
        admin,
        "import { db } from '../firebase';",
        "import { auth, db } from '../firebase';",
        'admin auth import',
    )
    admin = replace_once(
        admin,
        "  const [cacheDiagnosticsEnabled, setCacheDiagnosticsEnabledState] = useState(() => readCacheDiagnosticsEnabled());",
        "  const [cacheDiagnosticsEnabled, setCacheDiagnosticsEnabledState] = useState(() => readCacheDiagnosticsEnabled(auth.currentUser?.uid || null));",
        'admin owner-scoped initial state',
    )
    admin = replace_once(
        admin,
        "              setCacheDiagnosticsEnabled(next);",
        "              setCacheDiagnosticsEnabled(next, auth.currentUser?.uid || null);",
        'admin owner-scoped toggle',
    )
    admin = admin.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        1,
    )
    admin_path.write_text(admin, encoding='utf-8')

print('Applied SORIDRAW 897 admin scope: diagnostics are visible only to the account that enabled them in Admin App Settings.')

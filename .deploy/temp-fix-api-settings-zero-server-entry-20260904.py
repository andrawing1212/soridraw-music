from pathlib import Path

MARKER = '// SORIDRAW_API_SETTINGS_ENTRY_ZERO_SERVER_20260904'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# 1) API settings panel: page entry must hydrate from local cache only.
panel_path = Path('src/components/SunoApiSettingsPanel.tsx')
panel = panel_path.read_text(encoding='utf-8')
if MARKER not in panel:
    panel = replace_once(
        panel,
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n' + MARKER + '\n',
        'panel marker',
    )

    old_effect = """ useEffect(() => {\n loadGoogleApiKeyStatus(false);\n loadSunoApiKeyStatus(false);\n }, [loadGoogleApiKeyStatus, loadSunoApiKeyStatus]);"""
    new_effect = """ useEffect(() => {\n if (!user?.uid) return;\n\n // Normal page entry is cache-only. API status Functions are reserved for real\n // mutations/manual checks so reopening My Page or API Settings stays server 0.\n const storedGoogleKeyMeta = getStoredGoogleKeyMeta(user.uid);\n const cachedGoogleRegistered = getStoredGoogleApiKeyStatus(user.uid)\n || Boolean(storedGoogleKeyMeta?.registered && storedGoogleKeyMeta.last6);\n setGoogleRegistered(cachedGoogleRegistered);\n setGoogleKeyMeta(storedGoogleKeyMeta);\n markCacheDiagnostic('googleGeminiApiKey', 'CACHE', 0);\n\n let cachedMusicRegistered = false;\n try {\n cachedMusicRegistered = localStorage.getItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid)) === 'true';\n } catch {\n cachedMusicRegistered = false;\n }\n setStatusText(cachedMusicRegistered ? '등록됨' : '미등록');\n setRemainingCredits(readStoredCredits(user.uid));\n setRemainingCreditsUpdatedAt(readStoredCreditsUpdatedAt(user.uid));\n }, [user?.uid]);"""
    panel = replace_once(panel, old_effect, new_effect, 'cache-only mount effect')

    retry_call = ' loadSunoApiKeyStatus(true);\n'
    retry_count = panel.count(retry_call)
    if retry_count != 2:
        raise RuntimeError(f'Suno post-mutation status retry: expected 2 matches, found {retry_count}')
    panel = panel.replace(retry_call, '', 2)

    panel_path.write_text(panel, encoding='utf-8')

# 2) My Page: auth/focus/storage refreshes must never call getSunoApiKeyStatus.
my_path = Path('src/pages/MyPage.tsx')
my = my_path.read_text(encoding='utf-8')
if MARKER not in my:
    my = replace_once(
        my,
        '// SORIDRAW_926_SESSION_PROFILE_STRUCTURE_CACHE\n',
        '// SORIDRAW_926_SESSION_PROFILE_STRUCTURE_CACHE\n' + MARKER + '\n',
        'mypage marker',
    )

    old_constants = """const PROJECT_ID = 'soridraw-app-866a5';\nconst REGION = 'us-central1';\nconst BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;\n"""
    my = replace_once(my, old_constants, '', 'unused API status URL constants')

    start = my.find('const fetchSunoApiStatus = async (user?: User | null): Promise<boolean> => {')
    end = my.find('const getRemainingCredits = (uid?: string | null) => {', start)
    if start < 0 or end < 0:
        raise RuntimeError('fetchSunoApiStatus block not found')
    my = my[:start] + my[end:]

    auth_call = ' fetchSunoApiStatus(currentUser).then(setIsApiRegistered);\n'
    my = replace_once(my, auth_call, '', 'auth status server call')
    focus_call = ' fetchSunoApiStatus(user).then(setIsApiRegistered);\n'
    my = replace_once(my, focus_call, '', 'focus/storage status server call')

    my_path.write_text(my, encoding='utf-8')

# Static invariants.
panel = panel_path.read_text(encoding='utf-8')
my = my_path.read_text(encoding='utf-8')
checks = [
    (MARKER in panel, 'panel marker missing'),
    (MARKER in my, 'mypage marker missing'),
    ('loadGoogleApiKeyStatus(false);' not in panel, 'Google mount status call still present'),
    ('loadSunoApiKeyStatus(false);' not in panel, 'Suno mount status call still present'),
    ('loadSunoApiKeyStatus(true);' not in panel, 'Suno post-mutation duplicate status call still present'),
    ('fetchSunoApiStatus' not in my, 'MyPage Suno status fetch still present'),
    ('getSunoApiKeyStatus' not in my, 'MyPage direct status Function endpoint still present'),
]
for ok, message in checks:
    if not ok:
        raise RuntimeError(message)

print('API settings page-entry server-zero patch applied')

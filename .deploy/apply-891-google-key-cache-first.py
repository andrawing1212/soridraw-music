from pathlib import Path

MARKER = 'SORIDRAW_891_GOOGLE_KEY_CACHE_FIRST'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')

if MARKER not in client_source:
    # 1) If this device already has both the registered flag and last-6 metadata,
    #    trust the device cache and do not call the status endpoint on every mount.
    client_source = replace_once(
        client_source,
        " const loadGoogleApiKeyStatus = useCallback(async (isRetry = false) => {\n if (!user) return;\n\n if (!isRetry) {\n setGoogleRegistered(getStoredGoogleApiKeyStatus(user.uid));\n }\n\n try {",
        " const loadGoogleApiKeyStatus = useCallback(async (isRetry = false) => {\n if (!user) return;\n\n const cachedRegistered = getStoredGoogleApiKeyStatus(user.uid);\n const cachedMeta = getStoredGoogleKeyMeta(user.uid);\n if (!isRetry && cachedRegistered && cachedMeta?.last6) {\n setGoogleRegistered(true);\n setGoogleKeyMeta(cachedMeta);\n return;\n }\n\n if (!isRetry) {\n setGoogleRegistered(cachedRegistered);\n setGoogleKeyMeta(cachedMeta);\n }\n\n try {",
        'cache-first status guard',
    )

    # 2) A first-time device may receive last-6 from the server. Persist it locally
    #    so the second launch stays server-read free for this feature.
    client_source = replace_once(
        client_source,
        " setGoogleKeyMeta(nextGoogleKeyMeta);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');",
        " setGoogleKeyMeta(nextGoogleKeyMeta);\n if (nextGoogleKeyMeta?.last6) {\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n }\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');",
        'persist fetched server metadata',
    )

    # 3) Save/delete responses are already authoritative. Do not immediately issue
    #    another status request after the write succeeds.
    client_source = replace_once(
        client_source,
        " setMessage('Google Gemini API Key가 현재 계정 기준으로 서버에 저장되었습니다. 같은 아이디로 로그인하면 다른 환경에서도 사용할 수 있습니다.');\n loadGoogleApiKeyStatus(true);",
        " setMessage('Google Gemini API Key가 현재 계정 기준으로 서버에 저장되었습니다. 같은 아이디로 로그인하면 다른 환경에서도 사용할 수 있습니다.');",
        'remove post-save status reread',
    )
    client_source = replace_once(
        client_source,
        " setMessage('Google Gemini API Key가 삭제되었습니다.');\n loadGoogleApiKeyStatus(true);",
        " setMessage('Google Gemini API Key가 삭제되었습니다.');",
        'remove post-delete status reread',
    )

    client_source = client_source.replace(
        '// SORIDRAW_890_GEMINI_KEY_SIMPLE_UI\n',
        f'// {MARKER}\n// SORIDRAW_890_GEMINI_KEY_SIMPLE_UI\n',
        1,
    )

    client_path.write_text(client_source, encoding='utf-8')
    print('Applied SORIDRAW 891: Gemini key metadata is cache-first and status is fetched only when this device has no usable cache.')
else:
    print('891 Gemini key cache-first flow already applied.')

# 892 adds the tiny version signal that later cache stages will reuse.
apply_892 = Path('.deploy/apply-892-cache-sync-version-foundation.py')
if apply_892.exists():
    exec(compile(apply_892.read_text(encoding='utf-8'), str(apply_892), 'exec'), {'__name__': '__main__'})

# 893 hardens same-device cache restoration after closing and reopening the app.
apply_893 = Path('.deploy/apply-893-google-key-cache-restore-hardening.py')
if apply_893.exists():
    exec(compile(apply_893.read_text(encoding='utf-8'), str(apply_893), 'exec'), {'__name__': '__main__'})

# 894 stores the visible last-6 identity in the same durable registered cache key.
apply_894 = Path('.deploy/apply-894-gemini-key-identity-single-cache.py')
if apply_894.exists():
    exec(compile(apply_894.read_text(encoding='utf-8'), str(apply_894), 'exec'), {'__name__': '__main__'})

# 895 makes section custom cache-first and refreshes it only when the existing
# user-profile syncVersions signal changes across devices.
apply_895 = Path('.deploy/apply-895-section-custom-cache-sync.py')
if apply_895.exists():
    exec(compile(apply_895.read_text(encoding='utf-8'), str(apply_895), 'exec'), {'__name__': '__main__'})

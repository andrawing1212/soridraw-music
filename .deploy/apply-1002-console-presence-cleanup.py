from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

# 1) Remove Library browser-check debug logging while preserving Kakao warning behavior.
library = Path('src/pages/SunoLibraryPage.tsx')
replace_once(
    library,
    '''  useEffect(() => {\n    console.log("Shared page browser check:", {\n      userAgent: navigator.userAgent,\n      isKakaoInAppBrowser,\n      isSharePage: isSharedView,\n    });\n\n    if (isSharedView && isKakaoInAppBrowser) {\n      setShowKakaoWarning(true);\n    }\n  }, [isSharedView, isKakaoInAppBrowser]);''',
    '''  useEffect(() => {\n    if (isSharedView && isKakaoInAppBrowser) {\n      setShowKakaoWarning(true);\n    }\n  }, [isSharedView, isKakaoInAppBrowser]);''',
    'remove Shared page browser check debug log',
)

# 2) Keep App Check failures visible but stop logging normal/disabled token status on every API visit.
fb = Path('src/firebase.js')
replace_once(
    fb,
    '''export const getFirebaseAppCheckToken = async () => {\n  if (!appCheck) {\n    console.info("[Firebase App Check] token status: disabled");\n    return "";\n  }\n  try {\n    const result = await getAppCheckToken(appCheck, false);\n    const token = result?.token || "";\n    console.info(`[Firebase App Check] token status: ${token ? "available" : "missing"}`);\n    return token;\n  } catch (error) {''',
    '''export const getFirebaseAppCheckToken = async () => {\n  if (!appCheck) {\n    return "";\n  }\n  try {\n    const result = await getAppCheckToken(appCheck, false);\n    const token = result?.token || "";\n    return token;\n  } catch (error) {''',
    'quiet successful App Check token logging',
)

# 3) Add the modern PWA meta alongside the Apple-specific compatibility tag.
index = Path('index.html')
replace_once(
    index,
    '''    <meta name="theme-color" content="#0f0f0f" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />''',
    '''    <meta name="theme-color" content="#0f0f0f" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />''',
    'add modern mobile web app meta',
)

# 4) The optional per-device history path is currently rejected by the live RTDB backend.
# Live connection/session presence itself succeeds and is the feature required for online state.
# Do not keep sending an optional write that is guaranteed to fail; the existing device-history
# code stays in place behind a single disabled flag so it can be restored after a separately
# verified backend rules/IAM deployment without changing the presence model again.
presence = Path('src/services/presenceService.ts')
replace_once(
    presence,
    '''const CONNECTION_SETUP_RETRY_MS = 5 * 1000;\nconst PRESENCE_DIAGNOSTIC_KEY_PREFIX = 'soridraw_presence_diagnostic_';''',
    '''const CONNECTION_SETUP_RETRY_MS = 5 * 1000;\nconst DEVICE_HISTORY_SYNC_ENABLED = false;\nconst PRESENCE_DIAGNOSTIC_KEY_PREFIX = 'soridraw_presence_diagnostic_';''',
    'add optional device history feature gate',
)
presence_text = presence.read_text(encoding='utf-8')
old_gate = 'if (!devicePresenceDenied) {'
count = presence_text.count(old_gate)
if count != 3:
    raise SystemExit(f'presence device gates: expected 3 matches, found {count}')
presence.write_text(
    presence_text.replace(old_gate, 'if (DEVICE_HISTORY_SYNC_ENABLED && !devicePresenceDenied) {'),
    encoding='utf-8',
)

print('Applied 1002 cleanup: Library/App Check console noise removed, modern PWA meta added, optional failing RTDB device-history writes disabled.')

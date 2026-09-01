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

print('Applied 1002 console cleanup: Library debug log removed, App Check success logs quieted, modern PWA meta added.')

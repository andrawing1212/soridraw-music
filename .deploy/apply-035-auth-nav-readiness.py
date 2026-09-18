from pathlib import Path

APP = Path('src/App.tsx')
text = APP.read_text(encoding='utf-8')
MARKER = 'SORIDRAW_AUTH_NAV_READINESS_035'


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'[035] {label} anchor count must be 1, got {count}')
    text = text.replace(old, new, 1)


if MARKER in text:
    if 'const pendingAuthNavigationRef = useRef(false);' not in text:
        raise SystemExit('[035] marker exists but pending navigation ref is missing')
    if "const goToTopNav = (path: string, options?: { clearSuno?: boolean }) => {\n    if (!isAuthReady) return;" in text:
        raise SystemExit('[035] marker exists but desktop hard auth gate remains')
    if "const goToCompactMobileNav = (item: (typeof allTopNavItems)[number]) => {\n    if (!isAuthReady) return;" in text:
        raise SystemExit('[035] marker exists but mobile hard auth gate remains')
    print('[035] auth navigation readiness patch already applied')
    raise SystemExit(0)

replace_once(
    """  const goToTopNav = (path: string, options?: { clearSuno?: boolean }) => {\n    if (!isAuthReady) return;\n    if (!user) {\n      handleLogin();\n      return;\n    }\n""",
    """  // SORIDRAW_AUTH_NAV_READINESS_035\n  // Route taps must stay responsive while Firebase restores the persisted session.\n  // Authorization still waits for isAuthReady: if the restore resolves signed-out,\n  // the login modal is opened after the navigation intent has already been reflected.\n  const pendingAuthNavigationRef = useRef(false);\n\n  useEffect(() => {\n    if (!isAuthReady || !pendingAuthNavigationRef.current) return;\n    pendingAuthNavigationRef.current = false;\n    if (!user) handleLogin();\n  }, [handleLogin, isAuthReady, user]);\n\n  const canContinueTopNavigation = () => {\n    if (!isAuthReady) {\n      pendingAuthNavigationRef.current = true;\n      return true;\n    }\n    if (!user) {\n      handleLogin();\n      return false;\n    }\n    return true;\n  };\n\n  const goToTopNav = (path: string, options?: { clearSuno?: boolean }) => {\n    if (!canContinueTopNavigation()) return;\n""",
    'desktop top navigation',
)

replace_once(
    """  const goToCompactMobileNav = (item: (typeof allTopNavItems)[number]) => {\n    if (!isAuthReady) return;\n    if (!user) {\n      handleLogin();\n      return;\n    }\n""",
    """  const goToCompactMobileNav = (item: (typeof allTopNavItems)[number]) => {\n    if (!canContinueTopNavigation()) return;\n""",
    'compact mobile navigation',
)

replace_once(
    """        <Route path=\"/my-page\" element={\n          !canAccessNavigationMenu('myPage') ? (\n            <FeatureUnavailablePage label=\"마이페이지\" fallbackPath={navigationFallbackPath} />\n          ) : user ? (\n""",
    """        <Route path=\"/my-page\" element={\n          !canAccessNavigationMenu('myPage') ? (\n            <FeatureUnavailablePage label=\"마이페이지\" fallbackPath={navigationFallbackPath} />\n          ) : !isAuthReady ? (\n            <div className=\"min-h-screen flex items-center justify-center text-[var(--text-primary)] bg-[var(--bg-primary)]\">\n              <div className=\"flex flex-col items-center gap-4\">\n                <Loader2 className=\"w-8 h-8 animate-spin text-sky-300\" />\n                <p className=\"text-sm font-medium text-gray-400\">사용자 정보를 불러오는 중...</p>\n              </div>\n            </div>\n          ) : user ? (\n""",
    'my page auth restore route guard',
)

replace_once(
    """        <Route path=\"/lab\" element={\n          !canAccessNavigationMenu('lab') ? (\n            <FeatureUnavailablePage label=\"실험실\" fallbackPath={navigationFallbackPath} />\n          ) : user ? (\n""",
    """        <Route path=\"/lab\" element={\n          !canAccessNavigationMenu('lab') ? (\n            <FeatureUnavailablePage label=\"실험실\" fallbackPath={navigationFallbackPath} />\n          ) : !isAuthReady ? (\n            <div className=\"min-h-screen flex items-center justify-center text-[var(--text-primary)] bg-[var(--bg-primary)]\">\n              <div className=\"flex flex-col items-center gap-4\">\n                <Loader2 className=\"w-8 h-8 animate-spin text-[#BBA8CA]\" />\n                <p className=\"text-sm font-medium text-gray-400\">사용자 정보를 불러오는 중...</p>\n              </div>\n            </div>\n          ) : user ? (\n""",
    'lab auth restore route guard',
)

APP.write_text(text, encoding='utf-8')
print('[035] top navigation no longer drops taps during Firebase auth restoration; resolved signed-out behavior remains login-gated')

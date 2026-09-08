from pathlib import Path
import re

page = Path('src/pages/ExplorePage.tsx')
s = page.read_text(encoding='utf-8')
marker = 'SORIDRAW_EXPLORE_ACTIVE_REVALIDATION_045_20260908'
if marker in s:
    print('[045] Explore active revalidation already applied')
else:
    old = "const EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 1000;\n"
    new = old + "const EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 30_000;\n"
    if old not in s:
        raise SystemExit('[045] revision constant anchor missing')
    s = s.replace(old, new, 1)

    old = "  const feedRevisionEventAtRef = useRef(0);\n"
    new = old + "  const feedRevisionActivityAtRef = useRef(0);\n"
    if old not in s:
        raise SystemExit('[045] revision ref anchor missing')
    s = s.replace(old, new, 1)

    old = """    window.addEventListener('focus', requestRevisionCheck);\n    document.addEventListener('visibilitychange', requestRevisionCheck);\n    return () => {\n      window.removeEventListener('focus', requestRevisionCheck);\n      document.removeEventListener('visibilitychange', requestRevisionCheck);\n    };\n"""
    new = """    // SORIDRAW_EXPLORE_ACTIVE_REVALIDATION_045_20260908\n    // A tab can remain visible for a long time without focus/visibility events.\n    // Re-check only the zero-D1 revision endpoint on real user interaction, throttled.\n    const requestActivityRevisionCheck = () => {\n      if (document.visibilityState !== 'visible') return;\n      const now = Date.now();\n      if (now - feedRevisionActivityAtRef.current < EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS) return;\n      feedRevisionActivityAtRef.current = now;\n      requestRevisionCheck();\n    };\n\n    window.addEventListener('focus', requestRevisionCheck);\n    window.addEventListener('pageshow', requestRevisionCheck);\n    window.addEventListener('pointerdown', requestActivityRevisionCheck, { passive: true });\n    document.addEventListener('visibilitychange', requestRevisionCheck);\n    return () => {\n      window.removeEventListener('focus', requestRevisionCheck);\n      window.removeEventListener('pageshow', requestRevisionCheck);\n      window.removeEventListener('pointerdown', requestActivityRevisionCheck);\n      document.removeEventListener('visibilitychange', requestRevisionCheck);\n    };\n"""
    if old not in s:
        raise SystemExit('[045] revision listener anchor missing')
    s = s.replace(old, new, 1)
    page.write_text(s, encoding='utf-8')

p = Path('src/services/appUpdateNotice.ts')
v = p.read_text(encoding='utf-8')
v, n = re.subn(r"const CURRENT_APP_VERSION = '[^']+';", "const CURRENT_APP_VERSION = '045';", v, count=1)
if n != 1:
    raise SystemExit('[045] app version anchor missing')
p.write_text(v, encoding='utf-8')
Path('public/app-version.json').write_text('{\n  "version": "045"\n}\n', encoding='utf-8')
print('[045] active Explore revision revalidation applied')

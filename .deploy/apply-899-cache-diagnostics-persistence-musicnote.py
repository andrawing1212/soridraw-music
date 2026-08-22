from pathlib import Path

MARKER = 'SORIDRAW_899_CACHE_DIAGNOSTICS_PERSISTENCE_MUSICNOTE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# App.tsx: Music Note data is already maintained by the app-level favorites listener.
# Entering the page can therefore be a real in-memory/cache use without a new listener event.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    before = """  const favorites = useFavorites();
  const location = useLocation();

  return (
    <FavoritesPageLazy
"""
    after = """  const favorites = useFavorites();
  const location = useLocation();

  useEffect(() => {
    if (new URLSearchParams(location.search).has('note')) return;
    markCacheDiagnostic('musicNote', 'CACHE', 0);
  }, [location.pathname, location.search]);

  return (
    <FavoritesPageLazy
"""
    app = replace_once(app, before, after, 'Music Note page-entry cache diagnostic')
    app = app.replace(
        'const SORIDRAW_898_CACHE_DIAGNOSTICS_LIVE_PANEL = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_898_CACHE_DIAGNOSTICS_LIVE_PANEL = true;\n',
        1,
    )
    app_path.write_text(app, encoding='utf-8')

print('Applied SORIDRAW 899: Music Note page entry reports in-memory CACHE use; live panel persistence is handled by its source component.')

# 900 makes Library match the same session-level pattern: one Firestore listener
# after the first Library entry, then pure memory/cache reuse on later page entries.
apply_900 = Path('.deploy/apply-900-library-session-cache.py')
if apply_900.exists():
    exec(compile(apply_900.read_text(encoding='utf-8'), str(apply_900), 'exec'), {'__name__': '__main__'})

# 901 switches Music Note to exact 10-item pages, cache-first app restart,
# change-only incremental sync, and upgrades the existing top Sync button to
# an unrestricted full 1:1 recovery path.
apply_901 = Path('.deploy/apply-901-music-note-10-incremental-sync.py')
if apply_901.exists():
    exec(compile(apply_901.read_text(encoding='utf-8'), str(apply_901), 'exec'), {'__name__': '__main__'})

# The shared Firebase project may still be running the pre-syncVersions rules.
# Preserve existing favorite signal writes until that backend rule is explicitly
# promoted; the 901 client already falls back to favoriteSyncSignalUpdatedAt.
apply_901_hardening = Path('.deploy/apply-901-music-note-sync-permission-hardening.py')
if apply_901_hardening.exists():
    exec(compile(apply_901_hardening.read_text(encoding='utf-8'), str(apply_901_hardening), 'exec'), {'__name__': '__main__'})

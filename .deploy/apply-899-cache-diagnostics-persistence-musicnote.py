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

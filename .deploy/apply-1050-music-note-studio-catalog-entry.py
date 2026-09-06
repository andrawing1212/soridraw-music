from pathlib import Path

path = Path('src/App.tsx')
source = path.read_text(encoding='utf-8')

old = """  useEffect(() => {
    const isMusicNoteRoute = location.pathname === '/history';
    if (!isMusicNoteRoute) {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
      return;
    }

    if (typeof window !== 'undefined') {
      (window as any).__soridrawMusicNotePageActive = true;
      window.dispatchEvent(new Event('soridraw:music-note-bundle-page-entry'));
    }

    if (!new URLSearchParams(location.search).has('note')) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
    };
  }, [location.pathname, location.search]);"""

new = """  useEffect(() => {
    // 1050: HistoryRouteWrapper is mounted only while Music Note is visible.
    // Studio embeds it at /studio, so pathname === /history cannot gate Catalog entry.
    if (typeof window !== 'undefined') {
      (window as any).__soridrawMusicNotePageActive = true;
      window.dispatchEvent(new Event('soridraw:music-note-bundle-page-entry'));
    }

    if (!new URLSearchParams(location.search).has('note')) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
    };
  }, [location.pathname, location.search]);"""

if old not in source:
    raise SystemExit('1050 Music Note route-only gate anchor missing')

updated = source.replace(old, new, 1)
if updated.count('pathname === /history cannot gate Catalog entry') != 1:
    raise SystemExit('1050 patch marker mismatch')

path.write_text(updated, encoding='utf-8')
print('1050_APP_PATCH=PASS')

from pathlib import Path
import re

MARKER = 'SORIDRAW_921_FIRESTORE_COST_HARDENING'
path = Path('src/pages/SunoLibraryPage.tsx')
source = path.read_text(encoding='utf-8')

if MARKER not in source:
    query_pos = source.find('    const fallbackQuery = query(tracksRef);')
    if query_pos < 0:
        raise SystemExit('921 library full fallback query missing')
    start = source.rfind('  const ', 0, query_pos)
    next_fn = source.find('\n\n  const startPagedSourceFallback = () => {', query_pos)
    if start < 0 or next_fn < 0:
        raise SystemExit('921 library effective fallback boundaries missing')
    header_end = source.find('=> {', start, query_pos)
    if header_end < 0:
        raise SystemExit('921 library fallback header missing')
    header = source[start:header_end + 4]
    name_match = re.search(r'const\s+([A-Za-z0-9_]+)\s*=\s*\(\)\s*=>\s*\{', header)
    if not name_match:
        raise SystemExit('921 library fallback function name missing')
    function_name = name_match.group(1)

    replacement = f'''  const {function_name} = () => {{
    if (session.unsubscribeFallback) return;
    session.paginationFallback = true;
    session.hasMore = false;
    session.unsubscribeFallback = () => {{}};
    const boundedFallbackQuery = query(tracksRef, limit(WORKSPACE_SERVER_FETCH_SIZE));
    void getDocs(boundedFallbackQuery)
      .then((snapshot) => {{
        const list = snapshot.docs.map((docSnap) => ({{ id: docSnap.id, ...docSnap.data() }}));
        session.tracks = mergeLibraryWorkspaceSessionTracks(list, session.tracks);
        session.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        session.hasMore = false;
        session.ready = true;
        saveLibraryWorkspaceTrackCache(uid, session.tracks);
        markCacheDiagnostic('library', 'SYNC', Math.max(1, snapshot.docs.length));
        emitLibraryWorkspaceSession(session);
      }})
      .catch((error) => {{
        console.error('Bounded library fallback failed; keeping local cache.', error);
        session.ready = true;
        emitLibraryWorkspaceSession(session);
      }});
    emitLibraryWorkspaceSession(session);
  }};'''
    source = source[:start] + replacement + source[next_fn:]

    anchor = 'const SORIDRAW_900_LIBRARY_SESSION_CACHE = true;\n'
    if anchor in source:
        source = source.replace(anchor, f'const {MARKER} = true;\n' + anchor, 1)
    else:
        first_const = source.find('const ')
        if first_const < 0:
            raise SystemExit('921 library marker anchor missing')
        source = source[:first_const] + f'const {MARKER} = true;\n' + source[first_const:]
    path.write_text(source, encoding='utf-8')
    print(f'Applied SORIDRAW 921 Library prehardening: {function_name} is bounded.')
else:
    print('SORIDRAW 921 Library prehardening already applied.')

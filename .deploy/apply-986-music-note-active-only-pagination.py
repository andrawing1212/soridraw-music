from pathlib import Path
import re

MARKER = 'SORIDRAW_986_MUSIC_NOTE_ACTIVE_ONLY_PAGINATION'
app_path = Path('src/App.tsx')
favorites_path = Path('src/pages/FavoritesPage.tsx')
app = app_path.read_text(encoding='utf-8')
favorites = favorites_path.read_text(encoding='utf-8')

if MARKER in app:
    print('SORIDRAW 986 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_985_MUSIC_NOTE_NORMALIZED_PAGE_CHAIN' not in app:
    raise SystemExit('986 requires SORIDRAW 985 generated source first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'986 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


def add_document_id_import(source: str) -> str:
    pattern = re.compile(r"import\s*\{(?P<body>.*?)\}\s*from\s*['\"]firebase/firestore['\"]\s*;", re.S)
    for match in pattern.finditer(source):
        body = match.group('body')
        if 'startAfter' not in body or 'getDocs' not in body:
            continue
        if re.search(r'\bdocumentId\b', body):
            return source
        trimmed = body.rstrip()
        if trimmed.endswith(','):
            next_body = f"{trimmed}\n  documentId,\n"
        else:
            next_body = f"{trimmed},\n  documentId,\n"
        return source[:match.start('body')] + next_body + source[match.end('body'):]
    raise SystemExit('986 Firestore import containing startAfter/getDocs not found')


def add_eligibility_after_saved(source: str, value: bool) -> tuple[str, int]:
    literal = 'true' if value else 'false'
    pattern = re.compile(
        rf"(?m)^(?P<indent>[ \t]*)saved: {literal},\n(?![ \t]*musicNoteListEligible:)"
    )
    return pattern.subn(
        lambda m: f"{m.group('indent')}saved: {literal},\n{m.group('indent')}musicNoteListEligible: {literal},\n",
        source,
    )


# The active-only query needs a deterministic second cursor key so equal millisecond
# timestamps cannot duplicate or skip rows.
app = add_document_id_import(app)

# Keep future My Note mutations queryable without changing any song content.
app, active_write_count = add_eligibility_after_saved(app, True)
app, inactive_write_count = add_eligibility_after_saved(app, False)
if active_write_count < 2:
    raise SystemExit(f'986 expected multiple My Note active write paths, found {active_write_count}')
if inactive_write_count < 1:
    raise SystemExit(f'986 expected an inactive/unsave write path, found {inactive_write_count}')

allowed_before = "'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'isLocked',"
allowed_after = "'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'musicNoteListEligible', 'isLocked',"
if allowed_before in app:
    app = replace_once(app, allowed_before, allowed_after, 'favorite sync allowed key')
elif allowed_after not in app:
    raise SystemExit('986 favorite sync allowed-key anchor missing')

# Shared notes live in the same favorites collection but must never enter My Note
# active-only pages.
shared_before = "      sourceType: 'shared_music_note',\n"
shared_after = "      sourceType: 'shared_music_note',\n      musicNoteListEligible: false,\n"
if shared_after not in favorites:
    favorites = replace_once(favorites, shared_before, shared_after, 'shared-note eligibility')

start_anchor = '  const loadMoreFavorites = useCallback(async () => {'
end_anchor = '  const syncMusicNoteIncrementalFromRemoteVersion = useCallback'
start = app.find(start_anchor)
end = app.find(end_anchor, start)
if start < 0 or end < 0:
    raise SystemExit(f'986 loadMore anchors missing: start={start} end={end}')

legacy_block = app[start:end]
if 'SORIDRAW_985_MUSIC_NOTE_NORMALIZED_PAGE_CHAIN' not in legacy_block:
    raise SystemExit('986 expected 985 loadMore implementation at canonical anchor')
legacy_block = legacy_block.replace(
    start_anchor,
    '  const loadMoreFavoritesLegacy985 = useCallback(async () => {',
    1,
)

active_block = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    // SORIDRAW_986_MUSIC_NOTE_ACTIVE_ONLY_PAGINATION
    // Migration-safe gate: until the one-time metadata backfill has rebuilt the
    // latest-20 bundle with 20 explicitly eligible My Note rows, retain 985.
    // This prevents legacy documents that do not yet have the additive field from
    // disappearing. After migration, the hot path never scans removed/shared rows.
    const currentItems = favoritesStore.getFavorites();
    const eligibleBaseItems = sortFavoriteList(
      currentItems.filter((item: any) => item?.musicNoteListEligible === true)
    );
    if (eligibleBaseItems.length < FAVORITES_PAGE_SIZE) {
      return loadMoreFavoritesLegacy985();
    }

    const cursorItem = eligibleBaseItems[eligibleBaseItems.length - 1];
    const cursorCreatedAtMs = Number(cursorItem?.createdAtMs || 0);
    const cursorId = String(cursorItem?.id || '').trim();
    if (!cursorCreatedAtMs || !cursorId) {
      return loadMoreFavoritesLegacy985();
    }

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      const pageQuery = query(
        collection(db, 'favorites'),
        where('uid', '==', currentUser.uid),
        where('musicNoteListEligible', '==', true),
        orderBy('createdAtMs', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(cursorCreatedAtMs, cursorId),
        limit(FAVORITES_PAGE_SIZE)
      );

      const snapshot = await getDocs(pageQuery);
      const nextFavs = snapshot.docs
        .map(mapFavoriteFirestoreDoc)
        .filter((item: any) => item?.musicNoteListEligible === true);

      if (nextFavs.length > 0) {
        // Preserve shared-note/local rows in the central store. My Note rendering
        // will consume only its own rows, while the eligible cursor is independent.
        const merged = mergeFavoritePages(currentItems, nextFavs);
        setFavorites(merged);
        writeFavoritesCache(currentUser.uid, merged);
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      favoritePaginationCursorRef.current = lastDoc;
      favoritePaginationFallbackModeRef.current = false;
      const hasMore = snapshot.docs.length === FAVORITES_PAGE_SIZE;
      favoritePaginationExhaustedRef.current = !hasMore;
      setHasMoreFavorites(hasMore);
      markCacheDiagnostic('musicNote', 'SYNC', nextFavs.length);
    } catch (error) {
      console.warn('Music Note 986 active-only pagination failed; keeping retry available.', error);
      favoritePaginationExhaustedRef.current = false;
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user, setFavorites, loadMoreFavoritesLegacy985]);

'''

app = app[:start] + legacy_block + active_block + app[end:]

# Safety checks: the canonical 986 hot path must be exactly one bounded query.
canonical_start = app.find(start_anchor)
canonical_end = app.find(end_anchor, canonical_start)
canonical = app[canonical_start:canonical_end]
required = [
    MARKER,
    "where('uid', '==', currentUser.uid)",
    "where('musicNoteListEligible', '==', true)",
    "orderBy('createdAtMs', 'desc')",
    "orderBy(documentId(), 'desc')",
    'startAfter(cursorCreatedAtMs, cursorId)',
    'limit(FAVORITES_PAGE_SIZE)',
    'return loadMoreFavoritesLegacy985();',
]
for fragment in required:
    if fragment not in canonical:
        raise SystemExit(f'986 safety failed: missing {fragment}')
if 'while (' in canonical:
    raise SystemExit('986 safety failed: repeated scan loop remains in active-only hot path')
if 'FAVORITES_PAGE_SIZE + 1' in canonical:
    raise SystemExit('986 safety failed: active-only hot path reads more than 20 documents')
if "orderBy('createdAt', 'desc')" in canonical:
    raise SystemExit('986 safety failed: mixed-type createdAt remains in active-only hot path')
if 'musicNoteListEligible: false' not in favorites:
    raise SystemExit('986 safety failed: shared-note writes are not explicitly excluded')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print(
    f'Applied SORIDRAW 986: active-only bounded Music Note pagination; '
    f'future active writes patched={active_write_count}, inactive writes patched={inactive_write_count}. '
    'Legacy 985 remains only as a migration-safe fallback until metadata backfill.'
)

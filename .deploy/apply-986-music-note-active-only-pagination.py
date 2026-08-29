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

# FavoritesPage uses the already-loaded user profile cache for the total count.
# This adds zero Firestore reads to the Music Note page.
profile_import = "import { favoritesStore } from '../hooks/useFavoritesStore';\n"
profile_import_with_count = profile_import + "import { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';\n"
if profile_import_with_count not in favorites:
    favorites = replace_once(favorites, profile_import, profile_import_with_count, 'profile-cache import')

state_anchor = "  const [selectedSong, setSelectedSong] = useState<any | null>(null);\n"
state_with_count = state_anchor + r'''  const [musicNoteProfileCount, setMusicNoteProfileCount] = useState<number>(() => {
    const profile = readUserProfileCache(user?.uid) as any;
    return Math.max(0, Number(profile?.musicNoteCount || 0));
  });

  useEffect(() => {
    const uid = String(user?.uid || '').trim();
    if (!uid) {
      setMusicNoteProfileCount(0);
      return;
    }

    const syncCount = (profile?: any) => {
      const source = profile || (readUserProfileCache(uid) as any);
      setMusicNoteProfileCount(Math.max(0, Number(source?.musicNoteCount || 0)));
    };
    syncCount();

    const handleProfileCache = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      if (String(detail?.uid || '') !== uid) return;
      syncCount(detail?.profile);
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
    return () => window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
  }, [user?.uid]);

'''
if 'const [musicNoteProfileCount, setMusicNoteProfileCount]' not in favorites:
    favorites = replace_once(favorites, state_anchor, state_with_count, 'profile count state')

# Shared notes live in the same favorites collection but must never enter My Note
# active-only pages.
shared_before = "      sourceType: 'shared_music_note',\n"
shared_after = "      sourceType: 'shared_music_note',\n      musicNoteListEligible: false,\n"
if shared_after not in favorites:
    favorites = replace_once(favorites, shared_before, shared_after, 'shared-note eligibility')

# Moving an own note to the trash must remove it from the active server query.
trash_before = '''    const updates = {
      hidden: true,
      favoriteHidden: true,
      isPublic: false,
      deletedAt: serverTimestamp(),
      trashedAt,
    };'''
trash_after = '''    const updates = {
      hidden: true,
      favoriteHidden: true,
      isPublic: false,
      deletedAt: serverTimestamp(),
      trashedAt,
      musicNoteListEligible: false,
    };'''
if trash_after not in favorites:
    favorites = replace_once(favorites, trash_before, trash_after, 'trash eligibility')

# Restore is an own-note action in this page; make the restored row queryable again.
restore_before = '''    const updates = {
      hidden: false,
      favoriteHidden: false,
      deletedAt: null,
      trashedAt: null,
    };'''
restore_after = '''    const updates = {
      hidden: false,
      favoriteHidden: false,
      deletedAt: null,
      trashedAt: null,
      musicNoteListEligible: true,
    };'''
if restore_after not in favorites:
    favorites = replace_once(favorites, restore_before, restore_after, 'restore eligibility')

# Count only loaded, active, own-note rows. The total comes from the profile that the
# app already reads, so no count query is introduced.
count_anchor = "  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;\n"
count_block = r'''  const musicNoteLoadedOwnCount = favorites.filter((item: any) => (
    item?.musicNoteListEligible === true
    && !isFavoriteSoftRemoved(item)
    && !isFavoriteInTrash(item)
    && !isSharedMusicNoteItem(item)
  )).length;
  const musicNoteCurrentCount = musicNoteProfileCount > 0
    ? Math.min(musicNoteProfileCount, musicNoteLoadedOwnCount, visibleCount)
    : Math.min(musicNoteLoadedOwnCount, visibleCount);
  const musicNoteRemainingCount = musicNoteProfileCount > 0
    ? Math.max(0, musicNoteProfileCount - musicNoteCurrentCount)
    : 0;

  const canShowCachedMusicNoteMore = Boolean(
    visibleCount < filteredFavorites.length
    && (musicNoteProfileCount <= 0 || musicNoteRemainingCount > 0)
  );
'''
if 'const musicNoteLoadedOwnCount = favorites.filter' not in favorites:
    favorites = replace_once(favorites, count_anchor, count_block, 'loaded/remaining count')

# 981 intentionally removed the legacy local-20 gate. Preserve whichever generated
# form is present and add only the profile remaining-count guard.
can_request_pattern = re.compile(
    r"(?P<head>  const canRequestMoreMusicNotePage = Boolean\(\n)(?P<body>.*?)(?P<tail>\n  \);)",
    re.S,
)
can_request_match = can_request_pattern.search(favorites)
if not can_request_match:
    raise SystemExit('986 canRequestMoreMusicNotePage anchor missing')
can_request_body = can_request_match.group('body')
if 'musicNoteRemainingCount > 0' not in can_request_body:
    if '    hasMoreFavorites' not in can_request_body:
        raise SystemExit('986 hasMoreFavorites guard missing from canRequestMoreMusicNotePage')
    can_request_body = can_request_body.replace(
        '    hasMoreFavorites',
        '    (musicNoteProfileCount <= 0 || musicNoteRemainingCount > 0) &&\n    hasMoreFavorites',
        1,
    )
    favorites = (
        favorites[:can_request_match.start()]
        + can_request_match.group('head')
        + can_request_body
        + can_request_match.group('tail')
        + favorites[can_request_match.end():]
    )

more_ui_anchor = '''          {shouldShowMusicNoteMoreButton && (
            <div className="flex justify-center pt-1" data-selection-keep="true">'''
more_ui_with_count = r'''          {musicNoteProfileCount > 0
            && !isMusicNoteSharedView
            && musicNoteViewMode === 'noteSpace'
            && !searchQuery.trim()
            && favoriteColorFilter === 'all'
            && !favoriteTrashView && (
              <div className="flex justify-center pt-2 text-[11px] font-semibold text-[var(--text-secondary)]/70" data-selection-keep="true">
                전체 {musicNoteProfileCount}곡 · 현재 {musicNoteCurrentCount}곡 · 남은 {musicNoteRemainingCount}곡
              </div>
            )}

          {shouldShowMusicNoteMoreButton && (
            <div className="flex justify-center pt-1" data-selection-keep="true">'''
if '전체 {musicNoteProfileCount}곡 · 현재 {musicNoteCurrentCount}곡 · 남은 {musicNoteRemainingCount}곡' not in favorites:
    favorites = replace_once(favorites, more_ui_anchor, more_ui_with_count, 'count summary UI')

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
    const cursorId = String(cursorItem?.firestoreId || cursorItem?.id || '').trim();
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
        .map((docSnap: any) => {
          const mapped: any = mapFavoriteFirestoreDoc(docSnap);
          const raw: any = docSnap.data?.() || {};
          return {
            ...mapped,
            firestoreId: docSnap.id,
            createdAtMs: Number(raw.createdAtMs || mapped?.createdAtMs || 0),
            musicNoteListEligible: raw.musicNoteListEligible === true,
          };
        })
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
    'cursorItem?.firestoreId || cursorItem?.id',
    'firestoreId: docSnap.id',
    'musicNoteListEligible: raw.musicNoteListEligible === true',
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
    raise SystemExit('986 safety failed: shared/trash writes are not explicitly excluded')
if 'musicNoteListEligible: true' not in favorites:
    raise SystemExit('986 safety failed: restored own notes are not re-enabled')
if 'musicNoteProfileCount' not in favorites or 'musicNoteRemainingCount' not in favorites:
    raise SystemExit('986 safety failed: zero-read profile count UI is missing')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print(
    f'Applied SORIDRAW 986: active-only bounded Music Note pagination; '
    f'future active writes patched={active_write_count}, inactive writes patched={inactive_write_count}. '
    'Trash/restore metadata, stable Firestore cursor identity, and zero-read profile totals are included. '
    'Legacy 985 remains only as a migration-safe fallback until metadata backfill.'
)

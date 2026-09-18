from pathlib import Path

MARKER = 'SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


def replace_all(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count < 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after)


# -----------------------------------------------------------------------------
# App.tsx: section custom + recent songs + Music Note primary sync paths.
# Diagnostics are local/session-only and never create Firestore requests.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "import { useMediaQuery } from './lib/mediaQueryStore';",
        "import { useMediaQuery } from './lib/mediaQueryStore';\nimport CacheDiagnosticBadge from './components/CacheDiagnosticBadge';\nimport { markCacheDiagnostic } from './lib/cacheDiagnostics';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'App diagnostics imports',
    )

    # Section custom: a matching version is a true zero-read cache hit.
    app = replace_once(
        app,
        """    if (cacheVersionMatches) {
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
      return;
    }

    try {
      const ref = doc(db, 'user_structures', user.uid);
      const snap = await getDoc(ref);
""",
        """    if (cacheVersionMatches) {
      markCacheDiagnostic('sectionCustom', 'CACHE', 0);
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
      return;
    }

    try {
      const ref = doc(db, 'user_structures', user.uid);
      const snap = await getDoc(ref);
      markCacheDiagnostic('sectionCustom', 'SYNC', 1);
""",
        'section custom cache/read diagnostics',
    )

    # Show section-custom status beside the existing section-structure heading.
    section_heading = '<p className="soridraw-split-accent-label text-[14px] md:text-[15px] font-bold text-[#FFD36A] uppercase tracking-wider">│섹션 구조</p>'
    app = replace_all(
        app,
        section_heading,
        section_heading + '\n                <CacheDiagnosticBadge domain="sectionCustom" className="ml-1" />',
        'section custom badge',
    )

    # Recent songs: cached first paint vs the actual Firestore document listener.
    app = replace_once(
        app,
        """    const cached = loadRecentSongsCache(user.uid);
    const cachedHistory = Array.isArray(cached?.history) ? cached!.history : [];

    if (cachedHistory.length > 0) {
""",
        """    const cached = loadRecentSongsCache(user.uid);
    const cachedHistory = Array.isArray(cached?.history) ? cached!.history : [];

    if (cachedHistory.length > 0) {
      markCacheDiagnostic('recentSongs', 'CACHE', 0);
""",
        'recent songs cache diagnostics',
    )
    app = replace_once(
        app,
        """    const ref = doc(db, "user_recent_songs", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
""",
        """    const ref = doc(db, "user_recent_songs", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        markCacheDiagnostic('recentSongs', 'SYNC', 1);
""",
        'recent songs listener diagnostics',
    )

    # Music Note: local account cache first, then the first-page realtime query.
    app = replace_once(
        app,
        """        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          // Do not slice the cache. It costs nothing and prevents existing My Note / Shared Note items from visually disappearing.
""",
        """        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          // Do not slice the cache. It costs nothing and prevents existing My Note / Shared Note items from visually disappearing.
""",
        'music note cache diagnostics',
    )
    app = replace_once(
        app,
        """        unsubFavs = onSnapshot(q, (snapshot) => {
          const firstPageDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
""",
        """        unsubFavs = onSnapshot(q, (snapshot) => {
          markCacheDiagnostic('musicNote', 'SYNC', snapshot.docs.length);
          const firstPageDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
""",
        'music note listener diagnostics',
    )

    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# Recent songs visible badge in the existing recent-songs heading.
# -----------------------------------------------------------------------------
right_path = Path('src/components/studio/StudioRightRail.tsx')
right = right_path.read_text(encoding='utf-8')
if MARKER not in right:
    right = replace_once(
        right,
        "import { Activity, ChevronRight, Heart, Music, Sparkles, X } from 'lucide-react';",
        "import { Activity, ChevronRight, Heart, Music, Sparkles, X } from 'lucide-react';\nimport CacheDiagnosticBadge from '../CacheDiagnosticBadge';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'recent badge import',
    )
    right = replace_once(
        right,
        '<div><p>RECENT SONGS</p><h2>최근 생성곡</h2></div>',
        '<div><p>RECENT SONGS</p><h2>최근 생성곡</h2><CacheDiagnosticBadge domain="recentSongs" /></div>',
        'recent badge placement',
    )
    right_path.write_text(right, encoding='utf-8')


# -----------------------------------------------------------------------------
# Music Note visible badge in its existing masthead.
# -----------------------------------------------------------------------------
favorites_path = Path('src/pages/FavoritesPage.tsx')
favorites = favorites_path.read_text(encoding='utf-8')
if MARKER not in favorites:
    favorites = replace_once(
        favorites,
        "import StudioCenterModalPortal from '../components/studio/StudioCenterModalPortal';",
        "import StudioCenterModalPortal from '../components/studio/StudioCenterModalPortal';\nimport CacheDiagnosticBadge from '../components/CacheDiagnosticBadge';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'music note badge import',
    )
    favorites = replace_once(
        favorites,
        """          <div className="soridraw-page-title-description" role="tooltip">
            {isMusicNoteSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : '저장한 곡을 편집하고, 다음 곡에 적용합니다.'}
          </div>
        </div>
""",
        """          <div className="soridraw-page-title-description" role="tooltip">
            {isMusicNoteSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : '저장한 곡을 편집하고, 다음 곡에 적용합니다.'}
          </div>
        </div>
        {!isMusicNoteSharedView && <CacheDiagnosticBadge domain="musicNote" className="mt-1.5" />}
""",
        'music note badge placement',
    )
    favorites_path.write_text(favorites, encoding='utf-8')


# -----------------------------------------------------------------------------
# Library: existing local tracks cache vs first-page Firestore listener.
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    library = replace_once(
        library,
        "import SunoTrackDetailModal from '../components/SunoTrackDetailModal';",
        "import SunoTrackDetailModal from '../components/SunoTrackDetailModal';\nimport CacheDiagnosticBadge from '../components/CacheDiagnosticBadge';\nimport { markCacheDiagnostic } from '../lib/cacheDiagnostics';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'library diagnostics imports',
    )
    library = replace_once(
        library,
        """      if (Array.isArray(cachedTracks) && cachedTracks.length > 0) {
        setTracks(cachedTracks);
        setLoading(false);
""",
        """      if (Array.isArray(cachedTracks) && cachedTracks.length > 0) {
        markCacheDiagnostic('library', 'CACHE', 0);
        setTracks(cachedTracks);
        setLoading(false);
""",
        'library cache diagnostics',
    )
    library = replace_once(
        library,
        """      const unsubscribeSnapshot = onSnapshot(pageQuery, (snapshot) => {
        const docs = snapshot.docs;
""",
        """      const unsubscribeSnapshot = onSnapshot(pageQuery, (snapshot) => {
        const docs = snapshot.docs;
        markCacheDiagnostic('library', 'SYNC', docs.length);
""",
        'library listener diagnostics',
    )
    library = replace_once(
        library,
        """            <div className="soridraw-page-title-description" role="tooltip">
              {isSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : 'Music API로 생성한 곡을 듣고, 관리하고, 공유할수 있습니다.'}
            </div>
          </div>
""",
        """            <div className="soridraw-page-title-description" role="tooltip">
              {isSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : 'Music API로 생성한 곡을 듣고, 관리하고, 공유할수 있습니다.'}
            </div>
          </div>
          {!isSharedView && <CacheDiagnosticBadge domain="library" className="mt-1.5" />}
""",
        'library badge placement',
    )
    library_path.write_text(library, encoding='utf-8')


# -----------------------------------------------------------------------------
# Gemini API key: version-aware local cache vs one status endpoint call.
# -----------------------------------------------------------------------------
api_path = Path('src/components/SunoApiSettingsPanel.tsx')
api = api_path.read_text(encoding='utf-8')
if MARKER not in api:
    api = replace_once(
        api,
        "import { auth, getFirebaseAppCheckToken } from '../firebase';",
        "import { auth, getFirebaseAppCheckToken } from '../firebase';\nimport CacheDiagnosticBadge from './CacheDiagnosticBadge';\nimport { markCacheDiagnostic } from '../lib/cacheDiagnostics';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'API diagnostics imports',
    )
    api = replace_once(
        api,
        """ if (cachedMeta.registered && cachedMeta.last6) {
 setGoogleRegistered(true);
 setGoogleKeyMeta(cachedMeta);
 return;
 }
 if (!cachedMeta.registered) {
 setGoogleRegistered(false);
 setGoogleKeyMeta(cachedMeta);
 return;
 }
""",
        """ if (cachedMeta.registered && cachedMeta.last6) {
 setGoogleRegistered(true);
 setGoogleKeyMeta(cachedMeta);
 markCacheDiagnostic('googleGeminiApiKey', 'CACHE', 0);
 return;
 }
 if (!cachedMeta.registered) {
 setGoogleRegistered(false);
 setGoogleKeyMeta(cachedMeta);
 markCacheDiagnostic('googleGeminiApiKey', 'CACHE', 0);
 return;
 }
""",
        'API cache hit diagnostics',
    )
    api = replace_once(
        api,
        """ if (!isRetry) {
 setGoogleRegistered(cachedRegistered);
 setGoogleKeyMeta(cachedMeta);
 }

 try {
 const token = await user.getIdToken();
""",
        """ if (!isRetry) {
 setGoogleRegistered(cachedRegistered);
 setGoogleKeyMeta(cachedMeta);
 }

 markCacheDiagnostic('googleGeminiApiKey', 'SYNC', 1);
 try {
 const token = await user.getIdToken();
""",
        'API server status diagnostics',
    )
    api = replace_once(
        api,
        """ {showHeader && (
 <div className="mb-5">
 <h2 className="flex items-center gap-2 text-lg font-black"><Key className="w-5 h-5 text-[#ff8fb4]" /> API 연결</h2>
 <p className="mt-1 text-sm text-white/56">Google API와 Music API를 구분해서 관리합니다.</p>
 </div>
 )}
""",
        """ {showHeader && (
 <div className="mb-5">
 <h2 className="flex items-center gap-2 text-lg font-black"><Key className="w-5 h-5 text-[#ff8fb4]" /> API 연결</h2>
 <p className="mt-1 text-sm text-white/56">Google API와 Music API를 구분해서 관리합니다.</p>
 </div>
 )}
 <CacheDiagnosticBadge domain="googleGeminiApiKey" readLabel="조회" className="mb-3 ml-1" />
""",
        'API badge placement',
    )
    api_path.write_text(api, encoding='utf-8')


# -----------------------------------------------------------------------------
# Admin app settings: local-only ON/OFF switch. No Firestore read/write.
# -----------------------------------------------------------------------------
admin_path = Path('src/pages/AdminAppSettingsPage.tsx')
admin = admin_path.read_text(encoding='utf-8')
if MARKER not in admin:
    admin = replace_once(
        admin,
        "import { FIRESTORE_READ_CACHE_KEYS, writeFirestoreReadCache } from '../lib/firestoreReadCache';",
        "import { FIRESTORE_READ_CACHE_KEYS, writeFirestoreReadCache } from '../lib/firestoreReadCache';\nimport { readCacheDiagnosticsEnabled, setCacheDiagnosticsEnabled } from '../lib/cacheDiagnostics';\n\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;",
        'admin diagnostics import',
    )
    admin = replace_once(
        admin,
        "  const [clicheMessage, setClicheMessage] = useState('');",
        "  const [clicheMessage, setClicheMessage] = useState('');\n  const [cacheDiagnosticsEnabled, setCacheDiagnosticsEnabledState] = useState(() => readCacheDiagnosticsEnabled());",
        'admin diagnostics state',
    )
    admin = replace_once(
        admin,
        """        {clicheMessage && (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#BBA8CA]">
""",
        """        <div className="flex items-center justify-between gap-4 rounded-3xl bg-[var(--bg-secondary)] px-5 py-4 shadow-sm md:px-6">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[var(--text-primary)]">캐시 진단 표시</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
              각 화면 상단의 CACHE / SYNC와 실제 읽기·조회 횟수를 표시합니다. 이 설정은 이 기기에만 저장되며 서버 요청을 만들지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !cacheDiagnosticsEnabled;
              setCacheDiagnosticsEnabledState(next);
              setCacheDiagnosticsEnabled(next);
            }}
            aria-pressed={cacheDiagnosticsEnabled}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-all ${cacheDiagnosticsEnabled ? 'bg-[#BBA8CA] text-[#1b161d]' : 'bg-white/[0.055] text-[var(--text-secondary)] hover:bg-white/[0.09]'}`}
          >
            {cacheDiagnosticsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {clicheMessage && (
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#BBA8CA]">
""",
        'admin diagnostics toggle UI',
    )
    admin_path.write_text(admin, encoding='utf-8')

print('Applied SORIDRAW 897: local-only visible cache diagnostics for section custom, API key, recent songs, Music Note, and Library.')

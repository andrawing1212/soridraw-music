from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


path = Path("src/pages/SunoLibraryPage.tsx")
text = path.read_text(encoding="utf-8")

text = replace_once(
    text,
    "const WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE;",
    "const WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE + 1;",
    "library lookahead size",
)

view_old = """type LibraryWorkspaceSessionView = {\n  tracks: any[];\n  lastDoc: any | null;\n  hasMore: boolean;\n  paginationFallback: boolean;\n  ready: boolean;\n};\n"""
view_new = """type LibraryWorkspaceSessionView = {\n  tracks: any[];\n  serverTrackIds: string[];\n  serverInitialized: boolean;\n  lastDoc: any | null;\n  hasMore: boolean;\n  paginationFallback: boolean;\n  ready: boolean;\n};\n"""
text = replace_once(text, view_old, view_new, "library session view fields")

text = replace_once(
    text,
    """let libraryWorkspaceSession: LibraryWorkspaceSession | null = null;\nlet libraryWorkspaceAuthGuardStarted = false;\n""",
    """let libraryWorkspaceSession: LibraryWorkspaceSession | null = null;\nlet libraryWorkspaceAuthGuardStarted = false;\nconst libraryWorkspaceFirstPageInFlight = new Map<string, Promise<void>>();\n""",
    "library first page in-flight guard",
)

snapshot_old = """const snapshotLibraryWorkspaceSession = (session: LibraryWorkspaceSession): LibraryWorkspaceSessionView => ({\n  tracks: session.tracks,\n  lastDoc: session.lastDoc,\n  hasMore: session.hasMore,\n  paginationFallback: session.paginationFallback,\n  ready: session.ready,\n});\n"""
snapshot_new = """const snapshotLibraryWorkspaceSession = (session: LibraryWorkspaceSession): LibraryWorkspaceSessionView => ({\n  tracks: session.tracks,\n  serverTrackIds: session.serverTrackIds,\n  serverInitialized: session.serverInitialized,\n  lastDoc: session.lastDoc,\n  hasMore: session.hasMore,\n  paginationFallback: session.paginationFallback,\n  ready: session.ready,\n});\n"""
text = replace_once(text, snapshot_old, snapshot_new, "library session snapshot")

start_pattern = re.compile(
    r"const startLibraryWorkspaceSession = \(uid: string\): LibraryWorkspaceSession => \{.*?\n\};\n\nconst subscribeLibraryWorkspaceSession =",
    re.S,
)
if len(start_pattern.findall(text)) != 1:
    raise SystemExit(f"startLibraryWorkspaceSession: expected 1 match, got {len(start_pattern.findall(text))}")

start_replacement = r'''const startLibraryWorkspaceSession = (uid: string): LibraryWorkspaceSession => {
  ensureLibraryWorkspaceAuthGuard();
  if (libraryWorkspaceSession?.uid === uid && libraryWorkspaceSession.started) {
    return libraryWorkspaceSession;
  }
  if (libraryWorkspaceSession && libraryWorkspaceSession.uid !== uid) {
    stopLibraryWorkspaceSession();
  }

  const cachedTracks = readLibraryWorkspaceTrackCache(uid);
  const session: LibraryWorkspaceSession = {
    uid,
    tracks: cachedTracks,
    serverTrackIds: [],
    serverInitialized: false,
    lastDoc: null,
    hasMore: false,
    paginationFallback: false,
    ready: true,
    started: true,
    unsubscribe: null,
    unsubscribeFallback: null,
    unsubscribeVersionSignal: null,
    subscribers: new Set(),
  };
  libraryWorkspaceSession = session;
  markCacheDiagnostic('library', 'CACHE', 0);
  return session;
};

const ensureLibraryWorkspaceServerFirstPage = (uid: string): Promise<void> => {
  if (!uid) return Promise.resolve();
  const session = startLibraryWorkspaceSession(uid);
  if (session.serverInitialized) return Promise.resolve();
  const existing = libraryWorkspaceFirstPageInFlight.get(uid);
  if (existing) return existing;

  const task = (async () => {
    try {
      const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
      const snapshot = await getDocs(query(
        tracksRef,
        orderBy('createdAt', 'desc'),
        limit(WORKSPACE_SERVER_FETCH_SIZE),
      ));
      const visibleDocs = snapshot.docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
      const list = visibleDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, session.tracks);
      session.serverTrackIds = list.map((track: any) => String(track?.id || '')).filter(Boolean);
      session.serverInitialized = true;
      session.lastDoc = visibleDocs[visibleDocs.length - 1] || null;
      session.hasMore = snapshot.docs.length > WORKSPACE_SERVER_PAGE_SIZE;
      session.paginationFallback = false;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      markCacheDiagnostic('library', 'SYNC', Math.max(1, snapshot.docs.length));
      emitLibraryWorkspaceSession(session);
    } catch (error) {
      console.warn('Library first bounded server page failed; cached first screen remains available.', error);
      session.serverInitialized = false;
      session.ready = true;
      session.hasMore = false;
      emitLibraryWorkspaceSession(session);
    } finally {
      libraryWorkspaceFirstPageInFlight.delete(uid);
    }
  })();

  libraryWorkspaceFirstPageInFlight.set(uid, task);
  return task;
};

const subscribeLibraryWorkspaceSession ='''
text = start_pattern.sub(start_replacement, text, count=1)

# The page subscription still hydrates instantly from local cache, then exactly one bounded server page verifies the canonical list.
subscribe_old = """      unsubscribeWorkspaceView = subscribeLibraryWorkspaceSession(resolvedUser.uid, applySession);\n      if (alreadyRunning) {\n        // Explicitly record the no-server-read re-entry in the admin diagnostic.\n        markCacheDiagnostic('library', 'CACHE', 0);\n      }\n"""
subscribe_new = """      unsubscribeWorkspaceView = subscribeLibraryWorkspaceSession(resolvedUser.uid, applySession);\n      if (alreadyRunning && libraryWorkspaceSession?.serverInitialized) {\n        markCacheDiagnostic('library', 'CACHE', 0);\n      } else {\n        void ensureLibraryWorkspaceServerFirstPage(resolvedUser.uid);\n      }\n"""
text = replace_once(text, subscribe_old, subscribe_new, "library page first server verification")

apply_old = """      const applySession = (next: LibraryWorkspaceSessionView) => {\n        setTracks(next.tracks);\n        setLoading(!next.ready);\n        workspaceLastTrackDocRef.current = next.lastDoc;\n        workspacePaginationFallbackRef.current = next.paginationFallback;\n        setHasMoreWorkspaceServerTracks(next.hasMore);\n      };\n"""
apply_new = """      const applySession = (next: LibraryWorkspaceSessionView) => {\n        setTracks(next.tracks);\n        setWorkspaceServerTrackIds(next.serverTrackIds);\n        setWorkspaceServerInitialized(next.serverInitialized);\n        setLoading(!next.ready);\n        workspaceLastTrackDocRef.current = next.lastDoc;\n        workspacePaginationFallbackRef.current = next.paginationFallback;\n        setHasMoreWorkspaceServerTracks(next.hasMore);\n      };\n"""
text = replace_once(text, apply_old, apply_new, "library session apply paging state")

state_old = """  const [workspaceVisibleCount, setWorkspaceVisibleCount] = useState(WORKSPACE_PAGE_SIZE);\n  const [hasMoreWorkspaceServerTracks, setHasMoreWorkspaceServerTracks] = useState(false);\n  const [isLoadingMoreWorkspaceTracks, setIsLoadingMoreWorkspaceTracks] = useState(false);\n"""
state_new = """  const [workspaceVisibleCount, setWorkspaceVisibleCount] = useState(WORKSPACE_PAGE_SIZE);\n  const [workspaceServerTrackIds, setWorkspaceServerTrackIds] = useState<string[]>([]);\n  const [workspaceServerInitialized, setWorkspaceServerInitialized] = useState(false);\n  const [hasMoreWorkspaceServerTracks, setHasMoreWorkspaceServerTracks] = useState(false);\n  const [isLoadingMoreWorkspaceTracks, setIsLoadingMoreWorkspaceTracks] = useState(false);\n"""
text = replace_once(text, state_old, state_new, "library component paging state")

reset_old = """      workspaceLastTrackDocRef.current = null;\n      workspacePaginationFallbackRef.current = false;\n      setHasMoreWorkspaceServerTracks(false);\n      setIsLoadingMoreWorkspaceTracks(false);\n"""
reset_new = """      workspaceLastTrackDocRef.current = null;\n      workspacePaginationFallbackRef.current = false;\n      setWorkspaceServerTrackIds([]);\n      setWorkspaceServerInitialized(false);\n      setHasMoreWorkspaceServerTracks(false);\n      setIsLoadingMoreWorkspaceTracks(false);\n"""
text = replace_once(text, reset_old, reset_new, "library mount paging reset")

load_pattern = re.compile(r"  const loadMoreWorkspaceTracks = async \(\) => \{.*?\n  \};", re.S)
if len(load_pattern.findall(text)) != 1:
    raise SystemExit(f"loadMoreWorkspaceTracks: expected 1 match, got {len(load_pattern.findall(text))}")

load_replacement = r'''  const loadMoreWorkspaceTracks = async () => {
    if (!user || isSharedView) {
      setWorkspaceVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, filteredTracks.length));
      return;
    }
    if (isLoadingMoreWorkspaceTracks) return;

    if (!workspaceServerInitialized) {
      setIsLoadingMoreWorkspaceTracks(true);
      try {
        await ensureLibraryWorkspaceServerFirstPage(user.uid);
      } finally {
        setIsLoadingMoreWorkspaceTracks(false);
      }
      return;
    }

    if (!hasMoreWorkspaceServerTracks || !workspaceLastTrackDocRef.current) return;

    setIsLoadingMoreWorkspaceTracks(true);
    try {
      const tracksRef = collection(db, 'suno_tracks', user.uid, 'tracks');
      const snapshot = await getDocs(query(
        tracksRef,
        orderBy('createdAt', 'desc'),
        startAfter(workspaceLastTrackDocRef.current),
        limit(WORKSPACE_SERVER_FETCH_SIZE),
      ));
      const visibleDocs = snapshot.docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
      const list = visibleDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const hasMore = snapshot.docs.length > WORKSPACE_SERVER_PAGE_SIZE;
      workspaceLastTrackDocRef.current = visibleDocs[visibleDocs.length - 1] || workspaceLastTrackDocRef.current;
      setHasMoreWorkspaceServerTracks(hasMore);

      const currentSession = libraryWorkspaceSession?.uid === user.uid ? libraryWorkspaceSession : null;
      if (currentSession) {
        const seenIds = new Set(currentSession.serverTrackIds);
        const nextIds = [...currentSession.serverTrackIds];
        list.forEach((track: any) => {
          const id = String(track?.id || '').trim();
          if (!id || seenIds.has(id)) return;
          seenIds.add(id);
          nextIds.push(id);
        });
        currentSession.tracks = mergeLibraryWorkspaceSessionTracks(list, currentSession.tracks);
        currentSession.serverTrackIds = nextIds;
        currentSession.serverInitialized = true;
        currentSession.lastDoc = workspaceLastTrackDocRef.current;
        currentSession.hasMore = hasMore;
        currentSession.paginationFallback = false;
        currentSession.ready = true;
        saveLibraryWorkspaceTrackCache(user.uid, currentSession.tracks);
        emitLibraryWorkspaceSession(currentSession);
      } else {
        setTracks((prev) => {
          const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
          saveWorkspaceTrackCache(user.uid, merged);
          return merged;
        });
        setWorkspaceServerTrackIds((prev) => {
          const seen = new Set(prev);
          const next = [...prev];
          list.forEach((track: any) => {
            const id = String(track?.id || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            next.push(id);
          });
          return next;
        });
      }
      setWorkspaceVisibleCount((prev) => prev + WORKSPACE_PAGE_SIZE);
      markCacheDiagnostic('library', 'SYNC', Math.max(1, snapshot.docs.length));
    } catch (error) {
      console.error('load more workspace tracks failed:', error);
      // Keep the last known cursor/hasMore so a user click can retry. Never start an automatic fallback loop.
    } finally {
      setIsLoadingMoreWorkspaceTracks(false);
    }
  };'''
text = load_pattern.sub(load_replacement, text, count=1)

display_old = """  const displayedWorkspaceTracks = useMemo(() => {\n    if (libraryViewMode !== 'workspace') return filteredTracks;\n    return filteredTracks.slice(0, workspaceVisibleCount);\n  }, [filteredTracks, libraryViewMode, workspaceVisibleCount]);\n\n  const canShowCachedWorkspaceMore = libraryViewMode === 'workspace' && workspaceVisibleCount < filteredTracks.length;\n  const canRequestMoreWorkspacePage = Boolean(\n    libraryViewMode === 'workspace' &&\n    !isSharedView &&\n    !deferredSearchTerm.trim() &&\n    filter === 'all' &&\n    workspaceColorFilter === 'all' &&\n    hasMoreWorkspaceServerTracks &&\n    filteredTracks.length >= WORKSPACE_PAGE_SIZE\n  );\n  const hasMoreWorkspaceTracks = libraryViewMode === 'workspace' && (canShowCachedWorkspaceMore || canRequestMoreWorkspacePage);\n"""
display_new = """  const isCanonicalWorkspacePagingView = Boolean(\n    libraryViewMode === 'workspace' &&\n    !isSharedView &&\n    !deferredSearchTerm.trim() &&\n    filter === 'all' &&\n    workspaceColorFilter === 'all'\n  );\n\n  const displayedWorkspaceTracks = useMemo(() => {\n    if (libraryViewMode !== 'workspace') return filteredTracks;\n    if (isCanonicalWorkspacePagingView && workspaceServerTrackIds.length > 0) {\n      const byId = new Map<string, any>();\n      filteredTracks.forEach((track: any) => {\n        const id = String(track?.id || '').trim();\n        if (id) byId.set(id, track);\n      });\n      return workspaceServerTrackIds.map((id) => byId.get(id)).filter(Boolean);\n    }\n    return filteredTracks.slice(0, workspaceVisibleCount);\n  }, [filteredTracks, libraryViewMode, workspaceVisibleCount, workspaceServerTrackIds, isCanonicalWorkspacePagingView]);\n\n  const canShowCachedWorkspaceMore = Boolean(\n    !isCanonicalWorkspacePagingView && libraryViewMode === 'workspace' && workspaceVisibleCount < filteredTracks.length\n  );\n  const canRequestMoreWorkspacePage = Boolean(\n    isCanonicalWorkspacePagingView && workspaceServerInitialized && hasMoreWorkspaceServerTracks\n  );\n  const hasMoreWorkspaceTracks = libraryViewMode === 'workspace' && (canRequestMoreWorkspacePage || canShowCachedWorkspaceMore);\n"""
text = replace_once(text, display_old, display_new, "library display paging ownership")

path.write_text(text, encoding="utf-8")
print("Stage3 Library bounded read-only paging patch applied")

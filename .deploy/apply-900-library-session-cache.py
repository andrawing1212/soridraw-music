from pathlib import Path

MARKER = 'SORIDRAW_900_LIBRARY_SESSION_CACHE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


path = Path('src/pages/SunoLibraryPage.tsx')
source = path.read_text(encoding='utf-8')

if MARKER not in source:
    module_anchor = "const scopedCreditStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;\n"
    module_code = r'''

// 900: Keep the workspace Firestore listener alive once per authenticated app
// session instead of recreating it on every Library page mount. Page re-entry
// reuses this in-memory snapshot; the single listener still receives true remote
// changes while the app remains open. The listener is stopped on account change.
type LibraryWorkspaceSessionView = {
  tracks: any[];
  lastDoc: any | null;
  hasMore: boolean;
  paginationFallback: boolean;
  ready: boolean;
};

type LibraryWorkspaceSession = LibraryWorkspaceSessionView & {
  uid: string;
  started: boolean;
  unsubscribe: (() => void) | null;
  unsubscribeFallback: (() => void) | null;
  subscribers: Set<(state: LibraryWorkspaceSessionView) => void>;
};

let libraryWorkspaceSession: LibraryWorkspaceSession | null = null;
let libraryWorkspaceAuthGuardStarted = false;

const readLibraryWorkspaceTrackCache = (uid: string): any[] => {
  try {
    const raw = localStorage.getItem(`soridraw_suno_tracks_cache_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read shared library workspace cache:', error);
    return [];
  }
};

const saveLibraryWorkspaceTrackCache = (uid: string, list: any[]) => {
  try {
    localStorage.setItem(`soridraw_suno_tracks_cache_${uid}`, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (error) {
    console.warn('Failed to save shared library workspace cache:', error);
  }
};

const getLibraryWorkspaceTrackCreatedAtMs = (track: any): number => {
  const value = track?.createdAt;
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeLibraryWorkspaceSessionTracks = (incoming: any[], previous: any[] = []): any[] => {
  const map = new Map<string, any>();
  (Array.isArray(previous) ? previous : []).forEach((track: any) => {
    const id = String(track?.id || '').trim();
    if (id) map.set(id, track);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((track: any) => {
    const id = String(track?.id || '').trim();
    if (id) map.set(id, { ...(map.get(id) || {}), ...track });
  });
  return Array.from(map.values()).sort(
    (a: any, b: any) => getLibraryWorkspaceTrackCreatedAtMs(b) - getLibraryWorkspaceTrackCreatedAtMs(a)
  );
};

const snapshotLibraryWorkspaceSession = (session: LibraryWorkspaceSession): LibraryWorkspaceSessionView => ({
  tracks: session.tracks,
  lastDoc: session.lastDoc,
  hasMore: session.hasMore,
  paginationFallback: session.paginationFallback,
  ready: session.ready,
});

const emitLibraryWorkspaceSession = (session: LibraryWorkspaceSession) => {
  const snapshot = snapshotLibraryWorkspaceSession(session);
  session.subscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Library workspace subscriber failed:', error);
    }
  });
};

const stopLibraryWorkspaceSession = () => {
  const session = libraryWorkspaceSession;
  if (!session) return;
  try { session.unsubscribe?.(); } catch {}
  try { session.unsubscribeFallback?.(); } catch {}
  session.unsubscribe = null;
  session.unsubscribeFallback = null;
  session.subscribers.clear();
  libraryWorkspaceSession = null;
};

const ensureLibraryWorkspaceAuthGuard = () => {
  if (libraryWorkspaceAuthGuardStarted) return;
  libraryWorkspaceAuthGuardStarted = true;
  auth.onAuthStateChanged((currentUser) => {
    if (!libraryWorkspaceSession) return;
    if (!currentUser || currentUser.uid !== libraryWorkspaceSession.uid) {
      stopLibraryWorkspaceSession();
    }
  });
};

const startLibraryWorkspaceSession = (uid: string): LibraryWorkspaceSession => {
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
    lastDoc: null,
    hasMore: false,
    paginationFallback: false,
    ready: cachedTracks.length > 0,
    started: true,
    unsubscribe: null,
    unsubscribeFallback: null,
    subscribers: new Set(),
  };
  libraryWorkspaceSession = session;

  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const pageQuery = query(
    tracksRef,
    orderBy('createdAt', 'desc'),
    limit(WORKSPACE_SERVER_FETCH_SIZE)
  );

  const startFallback = () => {
    if (session.unsubscribeFallback) return;
    session.paginationFallback = true;
    session.hasMore = false;
    const fallbackQuery = query(tracksRef);
    session.unsubscribeFallback = onSnapshot(fallbackQuery, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, []);
      session.lastDoc = null;
      session.hasMore = false;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      markCacheDiagnostic(
        'library',
        snapshot.metadata.fromCache ? 'CACHE' : 'SYNC',
        snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length)
      );
      emitLibraryWorkspaceSession(session);
    }, (error) => {
      console.error('Error fetching tracks fallback:', error);
      session.ready = true;
      emitLibraryWorkspaceSession(session);
    });
    emitLibraryWorkspaceSession(session);
  };

  session.unsubscribe = onSnapshot(pageQuery, (snapshot) => {
    const docs = snapshot.docs;
    const hasMore = docs.length > WORKSPACE_SERVER_PAGE_SIZE;
    const visibleDocs = docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
    const list = visibleDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    session.lastDoc = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
    session.hasMore = hasMore;
    session.paginationFallback = false;
    session.tracks = mergeLibraryWorkspaceSessionTracks(list, session.tracks);
    session.ready = true;
    saveLibraryWorkspaceTrackCache(uid, session.tracks);
    markCacheDiagnostic(
      'library',
      snapshot.metadata.fromCache ? 'CACHE' : 'SYNC',
      snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length)
    );
    emitLibraryWorkspaceSession(session);
  }, (error) => {
    console.error('Error fetching paged tracks:', error);
    session.ready = true;
    emitLibraryWorkspaceSession(session);
    startFallback();
  });

  return session;
};

const subscribeLibraryWorkspaceSession = (
  uid: string,
  listener: (state: LibraryWorkspaceSessionView) => void,
): (() => void) => {
  const session = startLibraryWorkspaceSession(uid);
  session.subscribers.add(listener);
  listener(snapshotLibraryWorkspaceSession(session));
  return () => {
    session.subscribers.delete(listener);
  };
};

const replaceLibraryWorkspaceSessionTracks = (uid: string, tracks: any[]) => {
  if (!libraryWorkspaceSession || libraryWorkspaceSession.uid !== uid) return;
  libraryWorkspaceSession.tracks = Array.isArray(tracks) ? tracks : [];
};

const mergeLibraryWorkspaceSessionPage = (
  uid: string,
  incoming: any[],
  lastDoc: any | null,
  hasMore: boolean,
) => {
  if (!libraryWorkspaceSession || libraryWorkspaceSession.uid !== uid) return;
  libraryWorkspaceSession.tracks = mergeLibraryWorkspaceSessionTracks(incoming, libraryWorkspaceSession.tracks);
  libraryWorkspaceSession.lastDoc = lastDoc;
  libraryWorkspaceSession.hasMore = hasMore;
  libraryWorkspaceSession.ready = true;
};
'''
    source = replace_once(source, module_anchor, module_anchor + module_code, 'library session module helpers')

    start_marker = "    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {\n"
    end_marker = "\n\n    return () => unsubscribeAuth();\n  }, [appUser?.uid]);"
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit('library auth workspace effect start anchor missing')
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit('library auth workspace effect end anchor missing')
    end += len(end_marker)

    replacement = r'''    let unsubscribeWorkspaceView: (() => void) | null = null;
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      const resolvedUser = currentUser || appUser || auth.currentUser;
      setUser(resolvedUser);

      if (unsubscribeWorkspaceView) {
        unsubscribeWorkspaceView();
        unsubscribeWorkspaceView = null;
      }

      if (!resolvedUser) {
        setLoading(false);
        setTracks([]);
        return;
      }

      workspaceLastTrackDocRef.current = null;
      workspacePaginationFallbackRef.current = false;
      setHasMoreWorkspaceServerTracks(false);
      setIsLoadingMoreWorkspaceTracks(false);

      const alreadyRunning = Boolean(
        libraryWorkspaceSession?.uid === resolvedUser.uid && libraryWorkspaceSession.started
      );
      const session = startLibraryWorkspaceSession(resolvedUser.uid);

      if (Array.isArray(session.tracks) && session.tracks.length > 0) {
        // A page re-entry never creates another Firestore listener. It simply
        // consumes the live session snapshot already held in memory.
        markCacheDiagnostic('library', 'CACHE', 0);
        setTracks(session.tracks);
        setLoading(false);
      } else {
        setTracks([]);
        setLoading(!session.ready);
      }

      const applySession = (next: LibraryWorkspaceSessionView) => {
        setTracks(next.tracks);
        setLoading(!next.ready);
        workspaceLastTrackDocRef.current = next.lastDoc;
        workspacePaginationFallbackRef.current = next.paginationFallback;
        setHasMoreWorkspaceServerTracks(next.hasMore);
      };

      unsubscribeWorkspaceView = subscribeLibraryWorkspaceSession(resolvedUser.uid, applySession);
      if (alreadyRunning) {
        // Explicitly record the no-server-read re-entry in the admin diagnostic.
        markCacheDiagnostic('library', 'CACHE', 0);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeWorkspaceView) unsubscribeWorkspaceView();
    };
  }, [appUser?.uid]);'''
    source = source[:start] + replacement + source[end:]

    source = replace_once(
        source,
        """      if (uid) saveWorkspaceTrackCache(uid, next);
      return next;
""",
        """      if (uid) {
        saveWorkspaceTrackCache(uid, next);
        replaceLibraryWorkspaceSessionTracks(uid, next);
      }
      return next;
""",
        'library local removal session mirror',
    )

    load_more_anchor = """      const list = visibleDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTracks((prev) => {
        const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
        saveWorkspaceTrackCache(user.uid, merged);
        return merged;
      });
"""
    load_more_after = """      const list = visibleDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      mergeLibraryWorkspaceSessionPage(user.uid, list, workspaceLastTrackDocRef.current, hasMore);
      setTracks((prev) => {
        const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
        saveWorkspaceTrackCache(user.uid, merged);
        return merged;
      });
"""
    source = replace_once(source, load_more_anchor, load_more_after, 'library pagination session mirror')

    source = source.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_READ_ACCURACY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_READ_ACCURACY = true;\n',
        1,
    )
    path.write_text(source, encoding='utf-8')
    print('Applied SORIDRAW 900: Library keeps one Firestore listener per app session; page re-entry is memory/cache only.')
else:
    print('SORIDRAW 900 already applied.')

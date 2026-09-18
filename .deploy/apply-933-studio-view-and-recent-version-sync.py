from pathlib import Path
import re

MARKER = 'SORIDRAW_933_STUDIO_VIEW_AND_RECENT_VERSION_SYNC'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'933 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # -------------------------------------------------------------------------
    # 1) Preserve the active split workspace in /studio?view=...
    # Hard refresh should reopen the same workspace instead of always Create.
    # Classic dark/light keeps its existing Recent default behavior.
    # -------------------------------------------------------------------------
    old_state = """  const [studioWorkspaceView, setStudioWorkspaceView] = useState<StudioWorkspaceView>(() =>
    readSoridrawDisplayMode() === 'studio-black' ? 'create' : 'recent',
  );"""
    new_state = """  const readInitialStudioWorkspaceView = (): StudioWorkspaceView => {
    if (readSoridrawDisplayMode() !== 'studio-black') return 'recent';
    if (typeof window === 'undefined') return 'create';
    const raw = new URLSearchParams(window.location.search).get('view');
    return raw === 'create' || raw === 'recent' || raw === 'music-note' || raw === 'library'
      ? raw
      : 'create';
  };
  const [studioWorkspaceView, setStudioWorkspaceView] = useState<StudioWorkspaceView>(readInitialStudioWorkspaceView);"""
    app = replace_once(app, old_state, new_state, 'split workspace initial URL state')

    old_select = """  const [studioWorkspaceLayoutRequestId, setStudioWorkspaceLayoutRequestId] = useState(0);
  const selectStudioWorkspaceView = useCallback((view: StudioWorkspaceView) => {
    setStudioWorkspaceView(view);
    setStudioWorkspaceLayoutRequestId((current) => current + 1);
  }, []);"""
    new_select = """  const [studioWorkspaceLayoutRequestId, setStudioWorkspaceLayoutRequestId] = useState(0);
  const selectStudioWorkspaceView = useCallback((view: StudioWorkspaceView) => {
    setStudioWorkspaceView(view);
    setStudioWorkspaceLayoutRequestId((current) => current + 1);

    if (location.pathname === '/studio' && readSoridrawDisplayMode() === 'studio-black') {
      const nextParams = new URLSearchParams(location.search);
      if (nextParams.get('view') !== view) {
        nextParams.set('view', view);
        const query = nextParams.toString();
        navigate(`/studio${query ? `?${query}` : ''}`, { replace: true });
      }
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (location.pathname !== '/studio' || readSoridrawDisplayMode() !== 'studio-black') return;
    const raw = new URLSearchParams(location.search).get('view');
    if (raw !== 'create' && raw !== 'recent' && raw !== 'music-note' && raw !== 'library') return;
    if (raw === studioWorkspaceView) return;
    setStudioWorkspaceView(raw);
    setStudioWorkspaceLayoutRequestId((current) => current + 1);
  }, [location.pathname, location.search, studioWorkspaceView]);"""
    app = replace_once(app, old_select, new_select, 'split workspace URL writer')

    # -------------------------------------------------------------------------
    # 2) Recent-song persistent version cache + one write helper.
    # All real recent-song mutations publish one tiny users sync version signal.
    # Navigation/refresh itself never writes.
    # -------------------------------------------------------------------------
    session_anchor = """const recentSongsSessionVerifiedUids = new Set<string>();
const recentSongsSessionReadInFlightUids = new Set<string>();"""
    session_replacement = """const recentSongsSessionVerifiedUids = new Set<string>();
const recentSongsSessionReadInFlightUids = new Set<string>();
const RECENT_SONGS_LOCAL_SYNC_VERSION_STORAGE_BASE = 'soridraw_recent_songs_local_sync_version_v1';
const RECENT_SONGS_LEGACY_VERIFIED_STORAGE_BASE = 'soridraw_recent_songs_legacy_verified_v1';
const RECENT_SONGS_SYNC_VERSION_EVENT = 'soridraw:recent-songs-sync-version';

const getRecentSongsVersionStorageKey = (base: string, uid: string) => `${base}_${uid}`;
const readRecentSongsLocalVersion = (uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getRecentSongsVersionStorageKey(RECENT_SONGS_LOCAL_SYNC_VERSION_STORAGE_BASE, uid)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};
const writeRecentSongsLocalVersion = (uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0 || typeof localStorage === 'undefined') return;
  try {
    const previous = readRecentSongsLocalVersion(uid);
    localStorage.setItem(
      getRecentSongsVersionStorageKey(RECENT_SONGS_LOCAL_SYNC_VERSION_STORAGE_BASE, uid),
      String(Math.max(previous, Math.floor(version))),
    );
  } catch {}
};
const readRecentSongsLegacyVerified = (uid: string): boolean => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getRecentSongsVersionStorageKey(RECENT_SONGS_LEGACY_VERIFIED_STORAGE_BASE, uid)) === '1';
  } catch {
    return false;
  }
};
const writeRecentSongsLegacyVerified = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(getRecentSongsVersionStorageKey(RECENT_SONGS_LEGACY_VERIFIED_STORAGE_BASE, uid), '1'); } catch {}
};

const persistRecentSongsDocument = async (ref: any, songs: any[]) => {
  const uid = String(ref?.id || '').trim();
  const previousVersion = uid ? readRecentSongsLocalVersion(uid) : 0;
  const syncVersion = Math.max(Date.now(), previousVersion + 1);
  await setDoc(ref, sanitizeForFirestore({ songs, syncVersion }), { merge: true });

  if (!uid) return syncVersion;
  writeRecentSongsLocalVersion(uid, syncVersion);
  writeRecentSongsLegacyVerified(uid);

  try {
    await updateDoc(doc(db, 'users', uid), { 'syncVersions.recentSongs': syncVersion });
    const cachedProfile = readUserProfileCache(uid);
    if (cachedProfile) {
      writeUserProfileCache(uid, {
        ...(cachedProfile as any),
        syncVersions: {
          ...((cachedProfile as any)?.syncVersions || {}),
          recentSongs: syncVersion,
        },
      });
    }
  } catch (error) {
    console.warn('Recent songs sync-version signal publish failed; recent-song data itself is already saved.', error);
  }
  return syncVersion;
};"""
    app = replace_once(app, session_anchor, session_replacement, 'recent version helpers')

    # Root users listener already pays for one profile snapshot. Reuse it as the
    # only cross-device recent-song invalidation signal.
    root_cache_anchor = """            writeUserProfileCache(currentUser.uid, data);
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);"""
    root_cache_replacement = """            writeUserProfileCache(currentUser.uid, data);
            const recentSongsVersion = Number(data?.syncVersions?.recentSongs || 0);
            if (recentSongsVersion > 0 && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent(RECENT_SONGS_SYNC_VERSION_EVENT, {
                detail: { uid: currentUser.uid, version: recentSongsVersion },
              }));
            }
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);"""
    app = replace_once(app, root_cache_anchor, root_cache_replacement, 'root recent sync signal')

    # -------------------------------------------------------------------------
    # 3) Replace the 907 per-SPA-session server verification with a persistent
    # version-aware verification. First 933 run may do one legacy verification;
    # after that, refresh is zero-read unless the root profile version advanced.
    # -------------------------------------------------------------------------
    recent_pattern = re.compile(
        r'''    const ref = doc\(db, "user_recent_songs", user\.uid\);\n'''
        r'''    let cancelledRecentSongsRead = false;\n\n'''
        r'''    if \(recentSongsSessionVerifiedUids\.has\(user\.uid\) \|\| recentSongsSessionReadInFlightUids\.has\(user\.uid\)\) \{\n'''
        r'''      markCacheDiagnostic\('recentSongs', 'CACHE', 0, 0\);\n'''
        r'''      return \(\) => \{\};\n'''
        r'''    \}\n'''
        r'''    recentSongsSessionReadInFlightUids\.add\(user\.uid\);\n\n'''
        r'''    void getDocFromServer\(ref\)\n'''
        r'''      \.then\(\(snap\) => \{\n'''
        r'''        recentSongsSessionReadInFlightUids\.delete\(user\.uid\);\n'''
        r'''        if \(cancelledRecentSongsRead\) return;\n'''
        r'''        recentSongsSessionVerifiedUids\.add\(user\.uid\);\n'''
        r'''(?P<success>.*?)'''
        r'''      \}\)\n'''
        r'''      \.catch\(\(error\) => \{\n'''
        r'''        recentSongsSessionReadInFlightUids\.delete\(user\.uid\);\n'''
        r'''        if \(cancelledRecentSongsRead\) return;\n'''
        r'''(?P<failure>.*?)'''
        r'''      \}\);\n\n'''
        r'''    return \(\) => \{\n'''
        r'''      cancelledRecentSongsRead = true;\n'''
        r'''    \};''',
        re.S,
    )
    match = recent_pattern.search(app)
    if not match:
        raise SystemExit('933 recent version-aware one-shot anchor missing')

    success_body = match.group('success')
    failure_body = match.group('failure')
    replacement = '''    const ref = doc(db, "user_recent_songs", user.uid);\n    let cancelledRecentSongsRead = false;\n\n    const runRecentSongsServerSyncIfNeeded = () => {\n      if (cancelledRecentSongsRead) return;\n\n      const cachedProfile = readUserProfileCache(user.uid);\n      const remoteVersion = Number((cachedProfile as any)?.syncVersions?.recentSongs || 0);\n      const localVersion = readRecentSongsLocalVersion(user.uid);\n      const legacyVerified = readRecentSongsLegacyVerified(user.uid);\n      const hasKnownLocalState = Boolean(cached) || legacyVerified;\n      const needsServerRead = !hasKnownLocalState || remoteVersion > localVersion;\n\n      if (!needsServerRead) {\n        recentSongsSessionVerifiedUids.add(user.uid);\n        markCacheDiagnostic('recentSongs', 'CACHE', 0, 0);\n        return;\n      }\n      if (recentSongsSessionReadInFlightUids.has(user.uid)) return;\n      recentSongsSessionReadInFlightUids.add(user.uid);\n\n      void getDocFromServer(ref)\n        .then((snap) => {\n          recentSongsSessionReadInFlightUids.delete(user.uid);\n          if (cancelledRecentSongsRead) return;\n          recentSongsSessionVerifiedUids.add(user.uid);\n          const documentVersion = Number(snap.exists() ? (snap.data() as any)?.syncVersion || 0 : 0);\n          const verifiedVersion = Math.max(remoteVersion, localVersion, documentVersion);\n          if (verifiedVersion > 0) writeRecentSongsLocalVersion(user.uid, verifiedVersion);\n          writeRecentSongsLegacyVerified(user.uid);\n''' + success_body + '''        })\n        .catch((error) => {\n          recentSongsSessionReadInFlightUids.delete(user.uid);\n          if (cancelledRecentSongsRead) return;\n''' + failure_body + '''        });\n    };\n\n    const handleRecentSongsVersionSignal = (event: Event) => {\n      const detail = (event as CustomEvent<{ uid?: string; version?: number }>).detail;\n      if (!detail || detail.uid !== user.uid) return;\n      const signaledVersion = Number(detail.version || 0);\n      if (signaledVersion <= readRecentSongsLocalVersion(user.uid)) return;\n      runRecentSongsServerSyncIfNeeded();\n    };\n\n    window.addEventListener(RECENT_SONGS_SYNC_VERSION_EVENT, handleRecentSongsVersionSignal as EventListener);\n    runRecentSongsServerSyncIfNeeded();\n\n    return () => {\n      cancelledRecentSongsRead = true;\n      window.removeEventListener(RECENT_SONGS_SYNC_VERSION_EVENT, handleRecentSongsVersionSignal as EventListener);\n    };'''
    app = app[:match.start()] + replacement + app[match.end():]

    # -------------------------------------------------------------------------
    # 4) Route every recent-song document mutation through the helper so the
    # remote profile signal is updated only when real data changes.
    # -------------------------------------------------------------------------
    replacements = [
        ("await setDoc(ref, { songs: [] }, { merge: true });", "await persistRecentSongsDocument(ref, []);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });", "await persistRecentSongsDocument(ref, newHistory);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });", "await persistRecentSongsDocument(ref, updatedSongs);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });", "await persistRecentSongsDocument(ref, nextHistory);"),
        ("setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })", "persistRecentSongsDocument(ref, next)"),
        ("setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })", "persistRecentSongsDocument(ref, nextHistory)"),
    ]
    replaced_total = 0
    for before, after in replacements:
        count = app.count(before)
        if count > 0:
            app = app.replace(before, after)
            replaced_total += count

    # 912/913 heart commit can use pending.songs. Catch any remaining direct
    # recent-song songs payloads with a conservative single-line regex.
    def replace_remaining(match_obj: re.Match) -> str:
        nonlocal_marker = None
        expression = match_obj.group('expr').strip()
        await_prefix = match_obj.group('await') or ''
        return f"{await_prefix}persistRecentSongsDocument(ref, {expression})"

    remaining_pattern = re.compile(
        r'''(?P<await>await\s+)?setDoc\(ref,\s*sanitizeForFirestore\(\{\s*songs:\s*(?P<expr>[A-Za-z0-9_\.]+)\s*\}\),\s*\{\s*merge:\s*true\s*\}\)'''
    )
    app, extra_count = remaining_pattern.subn(replace_remaining, app)
    replaced_total += extra_count
    if replaced_total < 4:
        raise SystemExit(f'933 recent write helper coverage too low: {replaced_total}')

    marker_anchor = 'const SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = app.find('const ')
        if first_const < 0:
            raise SystemExit('933 App marker anchor missing')
        app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]

    app_path.write_text(app, encoding='utf-8')


# Build-time safety checks.
final_app = app_path.read_text(encoding='utf-8')
if "readInitialStudioWorkspaceView" not in final_app or "nextParams.set('view', view)" not in final_app:
    raise SystemExit('933 safety failed: split workspace URL persistence missing')
if "RECENT_SONGS_SYNC_VERSION_EVENT" not in final_app or "persistRecentSongsDocument" not in final_app:
    raise SystemExit('933 safety failed: recent-song version sync missing')
if "recentSongsSessionVerifiedUids.has(user.uid) || recentSongsSessionReadInFlightUids.has(user.uid)" in final_app:
    raise SystemExit('933 safety failed: old per-SPA recent guard remains')
if "syncVersions.recentSongs" not in final_app:
    raise SystemExit('933 safety failed: recent sync version publish missing')
if "getDocFromServer(ref)" not in final_app:
    raise SystemExit('933 safety failed: changed-version server verification was removed entirely')
if "unsubUserDoc = onSnapshot(userRef" not in final_app:
    raise SystemExit('933 safety failed: root users sync listener missing')

print('Applied SORIDRAW 933: split workspace survives refresh; recent songs use persistent syncVersions and only re-read when changed.')

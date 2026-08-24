from pathlib import Path
import re

MARKER = 'SORIDRAW_935_RECENT_VERSION_SYNC_ONLY'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'935 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # -------------------------------------------------------------------------
    # 1) Persistent recent-song version marker.
    # Refresh/navigation never writes. Real user_recent_songs mutations publish
    # one tiny users/{uid}.syncVersions.recentSongs invalidation token.
    # -------------------------------------------------------------------------
    session_anchor = """const recentSongsSessionVerifiedUids = new Set<string>();
const recentSongsSessionReadInFlightUids = new Set<string>();"""
    session_replacement = """const recentSongsSessionVerifiedUids = new Set<string>();
const recentSongsSessionReadInFlightUids = new Set<string>();
const RECENT_SONGS_LOCAL_SYNC_VERSION_STORAGE_BASE = 'soridraw_recent_songs_local_sync_version_v2';
const RECENT_SONGS_SYNC_VERSION_EVENT = 'soridraw:recent-songs-sync-version-v2';

const getRecentSongsVersionStorageKey = (uid: string) => `${RECENT_SONGS_LOCAL_SYNC_VERSION_STORAGE_BASE}_${uid}`;
const readRecentSongsLocalVersion = (uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getRecentSongsVersionStorageKey(uid)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};
const writeRecentSongsLocalVersion = (uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0 || typeof localStorage === 'undefined') return;
  try {
    const previous = readRecentSongsLocalVersion(uid);
    localStorage.setItem(getRecentSongsVersionStorageKey(uid), String(Math.max(previous, Math.floor(version))));
  } catch {}
};

const persistRecentSongsDocument = async (ref: any, songs: any[]) => {
  const uid = String(ref?.id || '').trim();
  const previousVersion = uid ? readRecentSongsLocalVersion(uid) : 0;
  const syncVersion = Math.max(Date.now(), previousVersion + 1);

  await setDoc(ref, sanitizeForFirestore({ songs, syncVersion }), { merge: true });
  markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);

  if (!uid) return syncVersion;
  // Advance this device before publishing the remote signal so the root users
  // listener never causes a same-device reread.
  writeRecentSongsLocalVersion(uid, syncVersion);

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
    // Recent-song data is already safely saved. A failed invalidation signal must
    // never roll back or duplicate the content write.
    console.warn('Recent songs version signal publish failed.', error);
  }
  return syncVersion;
};"""
    app = replace_once(app, session_anchor, session_replacement, 'recent version helpers')

    # Reuse the existing single root users listener as the cross-device signal.
    root_anchor = """            writeUserProfileCache(currentUser.uid, data);
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);"""
    root_replacement = """            writeUserProfileCache(currentUser.uid, data);
            const recentSongsVersion = Number(data?.syncVersions?.recentSongs || 0);
            if (recentSongsVersion > 0 && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent(RECENT_SONGS_SYNC_VERSION_EVENT, {
                detail: { uid: currentUser.uid, version: recentSongsVersion },
              }));
            }
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);"""
    app = replace_once(app, root_anchor, root_replacement, 'root recent version signal')

    # -------------------------------------------------------------------------
    # 2) Replace per-SPA-session forced read with change-only read.
    # - existing local cache + no newer remote version => zero server read
    # - no local cache => one bootstrap read
    # - another device publishes a newer version => exactly one server read
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
        raise SystemExit('935 recent one-shot anchor missing')

    success_body = match.group('success')
    failure_body = match.group('failure')
    replacement = '''    const ref = doc(db, "user_recent_songs", user.uid);\n    let cancelledRecentSongsRead = false;\n\n    const runRecentSongsServerSyncIfNeeded = () => {\n      if (cancelledRecentSongsRead) return;\n\n      const cachedProfile = readUserProfileCache(user.uid);\n      const remoteVersion = Number((cachedProfile as any)?.syncVersions?.recentSongs || 0);\n      const localVersion = readRecentSongsLocalVersion(user.uid);\n      const hasLocalState = Boolean(cached);\n      const needsServerRead = !hasLocalState || remoteVersion > localVersion;\n\n      if (!needsServerRead) {\n        recentSongsSessionVerifiedUids.add(user.uid);\n        markCacheDiagnostic('recentSongs', 'CACHE', 0, 0);\n        return;\n      }\n      if (recentSongsSessionReadInFlightUids.has(user.uid)) return;\n      recentSongsSessionReadInFlightUids.add(user.uid);\n\n      void getDocFromServer(ref)\n        .then((snap) => {\n          recentSongsSessionReadInFlightUids.delete(user.uid);\n          if (cancelledRecentSongsRead) return;\n          recentSongsSessionVerifiedUids.add(user.uid);\n          const documentVersion = Number(snap.exists() ? (snap.data() as any)?.syncVersion || 0 : 0);\n          const verifiedVersion = Math.max(remoteVersion, localVersion, documentVersion);\n          if (verifiedVersion > 0) writeRecentSongsLocalVersion(user.uid, verifiedVersion);\n''' + success_body + '''        })\n        .catch((error) => {\n          recentSongsSessionReadInFlightUids.delete(user.uid);\n          if (cancelledRecentSongsRead) return;\n''' + failure_body + '''        });\n    };\n\n    const handleRecentSongsVersionSignal = (event: Event) => {\n      const detail = (event as CustomEvent<{ uid?: string; version?: number }>).detail;\n      if (!detail || detail.uid !== user.uid) return;\n      const signaledVersion = Number(detail.version || 0);\n      if (signaledVersion <= readRecentSongsLocalVersion(user.uid)) return;\n      runRecentSongsServerSyncIfNeeded();\n    };\n\n    window.addEventListener(RECENT_SONGS_SYNC_VERSION_EVENT, handleRecentSongsVersionSignal as EventListener);\n    runRecentSongsServerSyncIfNeeded();\n\n    return () => {\n      cancelledRecentSongsRead = true;\n      window.removeEventListener(RECENT_SONGS_SYNC_VERSION_EVENT, handleRecentSongsVersionSignal as EventListener);\n    };'''
    app = app[:match.start()] + replacement + app[match.end():]

    # -------------------------------------------------------------------------
    # 3) Route every actual user_recent_songs mutation through one helper.
    # This does not touch favorites, routing, workspace state, or page mounts.
    # -------------------------------------------------------------------------
    replacements = [
        ("await setDoc(ref, { songs: [] }, { merge: true });\n          markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);", "await persistRecentSongsDocument(ref, []);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });\n        markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);", "await persistRecentSongsDocument(ref, newHistory);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);", "await persistRecentSongsDocument(ref, updatedSongs);"),
        ("await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);", "await persistRecentSongsDocument(ref, nextHistory);"),
    ]
    replaced_total = 0
    for before, after in replacements:
        count = app.count(before)
        if count > 0:
            app = app.replace(before, after)
            replaced_total += count

    # Current 912/913 heart flush writes pending.songs. Convert any remaining
    # direct recent-song songs payloads conservatively.
    remaining_pattern = re.compile(
        r'''(?P<await>await\s+)?setDoc\(ref,\s*sanitizeForFirestore\(\{\s*songs:\s*(?P<expr>[A-Za-z0-9_\.]+)\s*\}\),\s*\{\s*merge:\s*true\s*\}\)'''
    )

    def replace_remaining(match_obj: re.Match) -> str:
        expression = match_obj.group('expr').strip()
        await_prefix = match_obj.group('await') or ''
        return f"{await_prefix}persistRecentSongsDocument(ref, {expression})"

    app, extra_count = remaining_pattern.subn(replace_remaining, app)
    replaced_total += extra_count

    if replaced_total < 2:
        raise SystemExit(f'935 recent write helper coverage unexpectedly low: {replaced_total}')

    marker_anchor = 'const SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('935 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    app_path.write_text(app, encoding='utf-8')


final_app = app_path.read_text(encoding='utf-8')
if 'SORIDRAW_935_RECENT_VERSION_SYNC_ONLY' not in final_app:
    raise SystemExit('935 safety failed: marker missing')
if "RECENT_SONGS_SYNC_VERSION_EVENT" not in final_app:
    raise SystemExit('935 safety failed: version event missing')
if "syncVersions.recentSongs" not in final_app:
    raise SystemExit('935 safety failed: profile signal missing')
if "nextParams.set('view'" in final_app or "readInitialStudioWorkspaceView" in final_app:
    raise SystemExit('935 safety failed: broken 933 route-state code reintroduced')
if 'persistRecentSongsDocument' not in final_app:
    raise SystemExit('935 safety failed: recent persistence helper missing')

print('Applied SORIDRAW 935: recent songs refresh is cache-first/change-only with one users version signal; routing and favorites are untouched.')

from pathlib import Path

MARKER = 'SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'932 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 932 — Fix the actual 931 miss found from the two runtime videos.
#
# Exact observed pattern:
# - every hard refresh: Firestore write +1 and users:onSnapshot roughly +3
# - route navigation without refresh: write +0
#
# Root cause in App.tsx was NOT only ensureAuthUserDocument. The root users/{uid}
# listener itself called syncSessionFieldsOnce() after its first server snapshot,
# and that helper wrote lastLoginAt/lastSeenAt/isOnline on every app bootstrap.
# That self-write then woke the same users listener again.
#
# Real login metadata remains handled by 931's ensureAuthUserDocument gate.
# Online/away/background/last-seen presence remains handled by Realtime Database.
# Therefore the root profile listener must be read/signal-only on refresh.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    old_sync = """        const syncSessionFieldsOnce = async () => {
          if (hasSyncedSessionDoc) return;
          hasSyncedSessionDoc = true;
          try {
            await updateDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email ?? '',
              displayName: currentUser.displayName ?? '',
              lastLoginAt: Date.now(),
              lastSeenAt: Date.now(),
              isOnline: true,
            });
          } catch (error) {
            console.error('Failed to sync user document:', error);
          }
        };"""
    new_sync = """        const syncSessionFieldsOnce = async () => {
          if (hasSyncedSessionDoc) return;
          // Refresh/app restore is not a login and must not mutate users/{uid}.
          // Genuine login metadata is written by ensureAuthUserDocument (931),
          // while live presence is owned by Realtime Database.
          hasSyncedSessionDoc = true;
        };"""
    app = replace_once(app, old_sync, new_sync, 'root refresh session self-write')

    # -------------------------------------------------------------------------
    # user_structures route-loop hardening.
    #
    # 895-927 kept a second persisted "remote" marker in localStorage. Runtime
    # video showed route mounts repeatedly reading user_structures even while the
    # actual users profile signal had not changed. The root users listener already
    # publishes the authoritative syncVersions.sectionCustom into userProfileCache.
    # Use that profile signal as authority; keep the old remote marker only as a
    # backward-compatible fallback when no profile cache exists yet.
    # -------------------------------------------------------------------------
    old_versions = """    const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
    const remoteVersion = readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid);
    const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion);"""
    new_versions = """    const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
    const persistedRemoteVersion = readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid);
    const cachedProfileSectionVersion = Number((readUserProfileCache(user.uid) as any)?.syncVersions?.sectionCustom || 0);
    const remoteVersion = cachedProfileSectionVersion > 0 ? cachedProfileSectionVersion : persistedRemoteVersion;
    const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion);"""
    app = replace_once(app, old_versions, new_versions, 'section authoritative profile version')

    old_mount_check = """    refreshIfVersionChanged(readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid));"""
    new_mount_check = """    const cachedProfileSectionVersion = Number((readUserProfileCache(user.uid) as any)?.syncVersions?.sectionCustom || 0);
    refreshIfVersionChanged(cachedProfileSectionVersion);"""
    app = replace_once(app, old_mount_check, new_mount_check, 'section route mount version source')

    marker_anchor = 'const SORIDRAW_931_REFRESH_SESSION_WRITE_GATE = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = app.find('const ')
        if first_const < 0:
            raise SystemExit('932 App marker anchor missing')
        app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]

    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# CACHE LIVE already records writeSources since 925, but the UI only rendered
# readSources. Show top write sources too so any remaining write can be attributed
# directly on the next video instead of inferred from totals.
# -----------------------------------------------------------------------------
overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
if MARKER not in overlay:
    old_calc = """  const topReadSources = Object.entries(actual.readSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 6);

  return ("""
    new_calc = """  const topReadSources = Object.entries(actual.readSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 6);
  const topWriteSources = Object.entries(actual.writeSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 4);

  return ("""
    overlay = replace_once(overlay, old_calc, new_calc, 'write source calculation')

    old_actual_line = """            <div className=\"whitespace-nowrap text-[11px] font-bold text-white/72\">{formatActualUsage(actual)}</div>"""
    new_actual_line = """            <div className=\"whitespace-nowrap text-[11px] font-bold text-white/72\">{formatActualUsage(actual)}</div>
            {topWriteSources.length > 0 ? (
              <div className=\"mt-1 rounded-lg bg-white/[0.025] px-2 py-1.5\">
                <div className=\"mb-0.5 text-[8px] font-black tracking-[0.05em] text-white/34\">SDK WRITE 발생처</div>
                <div className=\"space-y-0.5\">
                  {topWriteSources.map(([source, count]) => (
                    <div key={`write-${source}`} className=\"flex min-w-0 items-center justify-between gap-2 text-[9px] font-bold text-white/54\">
                      <span className=\"truncate\">{source}</span>
                      <span className=\"shrink-0 tabular-nums text-white/78\">{formatNumber(Number(count))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}"""
    overlay = replace_once(overlay, old_actual_line, new_actual_line, 'write source UI')

    first_const = overlay.find('const ')
    if first_const < 0:
        raise SystemExit('932 overlay marker anchor missing')
    overlay = overlay[:first_const] + f'const {MARKER} = true;\n' + overlay[first_const:]
    overlay_path.write_text(overlay, encoding='utf-8')


# Build-time safety: the refresh-only root path must no longer mutate Firestore,
# while the root users listener and RTDB presence remain intact.
final_app = app_path.read_text(encoding='utf-8')
if "const syncSessionFieldsOnce = async () => {\n          if (hasSyncedSessionDoc) return;\n          hasSyncedSessionDoc = true;\n          try {" in final_app:
    raise SystemExit('932 safety failed: root refresh session write body remains')
if "void syncSessionFieldsOnce();" not in final_app:
    raise SystemExit('932 safety failed: root listener session guard call unexpectedly removed')
if "unsubUserDoc = onSnapshot(userRef" not in final_app:
    raise SystemExit('932 safety failed: root users sync listener missing')
if 'startUserPresence' not in final_app:
    raise SystemExit('932 safety failed: RTDB presence path missing')
if 'cachedProfileSectionVersion' not in final_app:
    raise SystemExit('932 safety failed: profile-authoritative section version guard missing')

final_overlay = overlay_path.read_text(encoding='utf-8')
if 'SDK WRITE 발생처' not in final_overlay or 'topWriteSources' not in final_overlay:
    raise SystemExit('932 safety failed: write-source diagnostics missing')

print('Applied SORIDRAW 932: refresh root users write removed, section route cache uses root profile version, and CACHE LIVE shows write sources.')

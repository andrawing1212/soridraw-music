from pathlib import Path

MARKER = 'SORIDRAW_927_MONOTONIC_SECTION_VERSION_AND_OP_TRACE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'927 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# App.tsx — section custom sync versions are monotonic for this device/session.
# Older profile signals must never invalidate a newer payload already loaded from
# user_structures, otherwise route/profile snapshots can create a read feedback loop.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        """const publishSectionCustomRemoteVersion = (uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0) return;
  writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, uid, version);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SECTION_CUSTOM_SYNC_VERSION_EVENT, { detail: { uid, version } }));
  }
};""",
        """const publishSectionCustomRemoteVersion = (uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0) return;
  const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, uid);
  const remoteVersion = readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, uid);
  const sessionVersion = Number(sectionCustomVerifiedSessionVersions.get(uid) || 0);
  const knownVersion = Math.max(localVersion, remoteVersion, sessionVersion);
  if (knownVersion >= version) return;
  writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, uid, version);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SECTION_CUSTOM_SYNC_VERSION_EVENT, { detail: { uid, version } }));
  }
};""",
        'ignore stale profile version signal',
    )

    app = replace_once(
        app,
        "const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion === remoteVersion);",
        "const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion);",
        'local cache accepts older remote signal',
    )

    app = replace_once(
        app,
        """    const sessionVersionMatches = sessionVerifiedVersion > 0
      && (remoteVersion <= 0 || sessionVerifiedVersion === remoteVersion);""",
        """    const sessionVersionMatches = sessionVerifiedVersion > 0
      && (remoteVersion <= 0 || sessionVerifiedVersion >= remoteVersion);""",
        'session cache accepts older remote signal',
    )

    app = replace_once(
        app,
        """      if ((localVersion > 0 && localVersion === version) || sessionVerifiedVersion === version) return;
      sectionCustomVerifiedSessionVersions.delete(user.uid);""",
        """      if ((localVersion > 0 && localVersion >= version) || sessionVerifiedVersion >= version) return;
      sectionCustomVerifiedSessionVersions.delete(user.uid);""",
        'remote invalidation only for truly newer signal',
    )

    # Never downgrade the remote marker after a strongly-consistent payload read.
    app = replace_once(
        app,
        """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      sectionCustomVerifiedSessionVersions.set(user.uid, resolvedVersion);""",
        """      const verifiedResolvedVersion = Math.max(resolvedVersion, remoteVersion, localVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, verifiedResolvedVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, verifiedResolvedVersion);
      sectionCustomVerifiedSessionVersions.set(user.uid, verifiedResolvedVersion);""",
        'fetched structure version never downgrades',
    )

    app = app.replace(
        'const SORIDRAW_926_SESSION_PROFILE_STRUCTURE_CACHE = true;\n',
        f"const {MARKER} = true;\nconst SORIDRAW_926_SESSION_PROFILE_STRUCTURE_CACHE = true;\n",
        1,
    )
    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# Firestore measured wrapper — split source counters by operation so the next
# CACHE LIVE test distinguishes reattached listeners from direct document reads.
# -----------------------------------------------------------------------------
measured_path = Path('src/lib/firestoreMeasured.ts')
measured = measured_path.read_text(encoding='utf-8')
if MARKER not in measured:
    measured = replace_once(
        measured,
        """export const getDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDoc as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDoc;""",
        """export const getDoc = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDoc`;
  const snapshot = await (Firestore.getDoc as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDoc;""",
        'getDoc operation source',
    )
    measured = replace_once(
        measured,
        """export const getDocFromServer = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDocFromServer as any)(...args);
  markFirestoreActualRead(1, source);
  return snapshot;
}) as typeof Firestore.getDocFromServer;""",
        """export const getDocFromServer = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDocFromServer`;
  const snapshot = await (Firestore.getDocFromServer as any)(...args);
  markFirestoreActualRead(1, source);
  return snapshot;
}) as typeof Firestore.getDocFromServer;""",
        'getDocFromServer operation source',
    )
    measured = replace_once(
        measured,
        """export const getDocs = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDocs as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDocs;""",
        """export const getDocs = (async (...args: any[]) => {
  const source = `${getSourceLabel(args[0])}:getDocs`;
  const snapshot = await (Firestore.getDocs as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDocs;""",
        'getDocs operation source',
    )
    measured = replace_once(
        measured,
        "source: getSourceLabel(args[0]),",
        "source: `${getSourceLabel(args[0])}:onSnapshot`,",
        'onSnapshot operation source',
    )

    measured = measured.replace(
        "markFirestoreActualWrite(1, source);",
        "markFirestoreActualWrite(1, `${source}:write`);",
    )
    measured = measured.replace(
        "const source = getSourceLabel(target);\n    sourceWrites[source]",
        "const source = `${getSourceLabel(target)}:batch`;\n    sourceWrites[source]",
    )
    measured = measured.replace(
        "markFirestoreActualRead(1, getSourceLabel(getArgs[0]));",
        "markFirestoreActualRead(1, `${getSourceLabel(getArgs[0])}:transactionGet`);",
    )
    measured = measured.replace(
        "const source = getSourceLabel(target);\n      attemptWrites[source]",
        "const source = `${getSourceLabel(target)}:transactionWrite`;\n      attemptWrites[source]",
    )

    marker_anchor = 'const SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE = true;\n'
    measured = replace_once(
        measured,
        marker_anchor,
        f"const {MARKER} = true;\n" + marker_anchor,
        'measured marker',
    )
    measured_path.write_text(measured, encoding='utf-8')


# Build-time assertions: the exact stale-version conditions that caused the loop
# must not return in a later patch ordering change.
final_app = app_path.read_text(encoding='utf-8')
for forbidden in [
    'localVersion === remoteVersion',
    'sessionVerifiedVersion === remoteVersion',
    'localVersion === version) || sessionVerifiedVersion === version',
]:
    if forbidden in final_app:
        raise SystemExit(f'927 stale-version equality guard remains: {forbidden}')
final_measured = measured_path.read_text(encoding='utf-8')
if ':onSnapshot`' not in final_measured or ':getDoc`' not in final_measured:
    raise SystemExit('927 operation-level Firestore tracing missing')

print('Applied SORIDRAW 927: stale section signals cannot refetch newer cache; SDK sources include operation type.')

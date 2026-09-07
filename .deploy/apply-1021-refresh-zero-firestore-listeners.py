from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'1021 {label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# 1) Persistent Music Note user_structures cache.
#    Normal reload: local cache + RTDB revision only, Firestore read 0.
#    Firestore is read only on cache miss, remote mutation, or 24h safety verify.
# -----------------------------------------------------------------------------
structure_path = Path('src/services/musicNoteStructureCache.ts')
if structure_path.exists():
    raise RuntimeError('1021 musicNoteStructureCache.ts already exists; inspect before reapplying')

structure_path.write_text(r'''import { doc, getDoc, getDocFromCache } from '../lib/firestoreMeasured';
import { db } from '../firebase';
import {
  MUSIC_NOTE_LOCAL_VERSION_BASE,
  MUSIC_NOTE_REMOTE_VERSION_BASE,
  MUSIC_NOTE_SYNC_EVENT,
} from './userDomainSyncService';

const STORAGE_BASE = 'soridraw_music_note_structure_cache_v1';
const SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000;

type StructureEnvelope = {
  schemaVersion: 1;
  complete: boolean;
  data: Record<string, any>;
  signalVersion: number;
  verifiedAt: number;
};

type StructureSession = {
  uid: string;
  envelope: StructureEnvelope;
  listeners: Set<(data: Record<string, any>) => void>;
  inflight: Promise<void> | null;
  eventHandler: ((event: Event) => void) | null;
  started: boolean;
};

const sessions = new Map<string, StructureSession>();
const storageKey = (uid: string) => `${STORAGE_BASE}_${uid}`;
const scopedVersionKey = (base: string, uid: string) => `${base}_${uid}`;

const emptyEnvelope = (): StructureEnvelope => ({
  schemaVersion: 1,
  complete: false,
  data: {},
  signalVersion: 0,
  verifiedAt: 0,
});

const readNumber = (key: string): number => {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const readEnvelope = (uid: string): StructureEnvelope => {
  if (!uid || typeof localStorage === 'undefined') return emptyEnvelope();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.data !== 'object') return emptyEnvelope();
    return {
      schemaVersion: 1,
      complete: parsed.complete === true,
      data: parsed.data || {},
      signalVersion: Math.max(0, Number(parsed.signalVersion || 0) || 0),
      verifiedAt: Math.max(0, Number(parsed.verifiedAt || 0) || 0),
    };
  } catch {
    return emptyEnvelope();
  }
};

const writeEnvelope = (uid: string, envelope: StructureEnvelope): void => {
  if (!uid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(storageKey(uid), JSON.stringify(envelope)); } catch {}
};

const publish = (session: StructureSession): void => {
  const data = session.envelope.data || {};
  session.listeners.forEach((listener) => {
    try { listener(data); } catch (error) { console.warn('Music Note structure cache listener failed.', error); }
  });
};

const mergePatch = (base: Record<string, any>, patch: Record<string, any>): Record<string, any> => {
  const next = { ...(base || {}), ...(patch || {}) };
  if (patch?.musicNoteFolders && typeof patch.musicNoteFolders === 'object') {
    next.musicNoteFolders = {
      ...((base as any)?.musicNoteFolders || {}),
      ...(patch.musicNoteFolders || {}),
    };
  }
  if (patch?.musicNoteCardState && typeof patch.musicNoteCardState === 'object') {
    next.musicNoteCardState = {
      ...((base as any)?.musicNoteCardState || {}),
      ...(patch.musicNoteCardState || {}),
      items: {
        ...((base as any)?.musicNoteCardState?.items || {}),
        ...(patch.musicNoteCardState?.items || {}),
      },
    };
  }
  return next;
};

const snapshotData = (snapshot: any): Record<string, any> => snapshot?.exists?.()
  ? ((snapshot.data?.() || {}) as Record<string, any>)
  : {};

const refreshFromFirestore = async (
  session: StructureSession,
  signalVersion: number,
  preferCacheOnly = false,
): Promise<void> => {
  if (session.inflight) return session.inflight;
  const task = (async () => {
    const ref = doc(db, 'user_structures', session.uid);
    let snapshot: any = null;

    if (preferCacheOnly) {
      try { snapshot = await getDocFromCache(ref); } catch {}
    }
    if (!snapshot) snapshot = await getDoc(ref);

    session.envelope = {
      schemaVersion: 1,
      complete: true,
      data: snapshotData(snapshot),
      signalVersion: Math.max(session.envelope.signalVersion, signalVersion),
      verifiedAt: Date.now(),
    };
    writeEnvelope(session.uid, session.envelope);
    publish(session);
  })().catch((error) => {
    console.warn('Music Note structure refresh failed; persistent cache is preserved.', error);
  }).finally(() => {
    if (session.inflight === task) session.inflight = null;
  });
  session.inflight = task;
  return task;
};

const acknowledgeLocalSignal = (session: StructureSession, version: number): void => {
  if (!Number.isFinite(version) || version <= session.envelope.signalVersion) return;
  session.envelope = { ...session.envelope, signalVersion: version };
  writeEnvelope(session.uid, session.envelope);
};

const reconcile = (session: StructureSession): void => {
  const remoteVersion = readNumber(scopedVersionKey(MUSIC_NOTE_REMOTE_VERSION_BASE, session.uid));
  const localVersion = readNumber(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, session.uid));

  if (!session.envelope.complete) {
    // Migration fast path: the old onSnapshot listener usually left the same
    // document in Firestore IndexedDB. Reading that cache does not bill Firestore.
    void refreshFromFirestore(session, remoteVersion, true);
    return;
  }

  if (remoteVersion > session.envelope.signalVersion) {
    if (localVersion >= remoteVersion) {
      // Same-device mutation already patched this persistent structure cache.
      acknowledgeLocalSignal(session, remoteVersion);
    } else {
      void refreshFromFirestore(session, remoteVersion);
    }
    return;
  }

  if (Date.now() - session.envelope.verifiedAt >= SAFETY_REVERIFY_MS) {
    // Bounded safety verification: at most once per 24h, never once per refresh.
    void refreshFromFirestore(session, remoteVersion);
  }
};

const getSession = (uid: string): StructureSession => {
  const existing = sessions.get(uid);
  if (existing) return existing;
  const session: StructureSession = {
    uid,
    envelope: readEnvelope(uid),
    listeners: new Set(),
    inflight: null,
    eventHandler: null,
    started: false,
  };
  sessions.set(uid, session);
  return session;
};

export const subscribeMusicNoteStructureCache = (
  uid: string,
  listener: (data: Record<string, any>) => void,
): (() => void) => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return () => {};
  const session = getSession(safeUid);
  session.listeners.add(listener);

  if (session.envelope.complete) {
    const data = session.envelope.data;
    queueMicrotask(() => {
      if (session.listeners.has(listener)) listener(data);
    });
  }

  if (!session.started) {
    session.started = true;
    session.eventHandler = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail || {};
      if (String(detail.uid || '') !== safeUid) return;
      const version = Number(detail.version || 0);
      if (!Number.isFinite(version) || version <= session.envelope.signalVersion) return;
      const localVersion = readNumber(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, safeUid));
      if (localVersion >= version) acknowledgeLocalSignal(session, version);
      else void refreshFromFirestore(session, version);
    };
    window.addEventListener(MUSIC_NOTE_SYNC_EVENT, session.eventHandler as EventListener);
    reconcile(session);
  }

  return () => {
    session.listeners.delete(listener);
    // Keep the tiny local session and RTDB-event bridge alive for the SPA lifetime.
    // Route remounts therefore remain memory-only.
  };
};

export const patchMusicNoteStructureCache = (uid: string, patch: Record<string, any>): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  const session = getSession(safeUid);
  session.envelope = {
    ...session.envelope,
    data: mergePatch(session.envelope.data || {}, patch || {}),
    verifiedAt: session.envelope.complete ? Date.now() : session.envelope.verifiedAt,
  };
  writeEnvelope(safeUid, session.envelope);
  if (session.envelope.complete) publish(session);
};

export const SORIDRAW_MUSIC_NOTE_STRUCTURE_REFRESH_ZERO_1021 = true as const;
''', encoding='utf-8')


# -----------------------------------------------------------------------------
# 2) Expose the existing Music Note RTDB signal/version constants.
# -----------------------------------------------------------------------------
sync_path = Path('src/services/userDomainSyncService.ts')
sync = sync_path.read_text(encoding='utf-8')
for old, new, label in [
    ("const MUSIC_NOTE_REMOTE_VERSION_BASE = 'soridraw_music_note_remote_sync_version_v1';", "export const MUSIC_NOTE_REMOTE_VERSION_BASE = 'soridraw_music_note_remote_sync_version_v1';", 'remote version export'),
    ("const MUSIC_NOTE_LOCAL_VERSION_BASE = 'soridraw_music_note_local_sync_version_v1';", "export const MUSIC_NOTE_LOCAL_VERSION_BASE = 'soridraw_music_note_local_sync_version_v1';", 'local version export'),
    ("const MUSIC_NOTE_SYNC_EVENT = 'soridraw:music-note-sync-version';", "export const MUSIC_NOTE_SYNC_EVENT = 'soridraw:music-note-sync-version';", 'event export'),
]:
    sync = replace_once(sync, old, new, label)
sync_path.write_text(sync, encoding='utf-8')


# -----------------------------------------------------------------------------
# 3) Add a semantic mutation name for lightweight user_structures writes.
# -----------------------------------------------------------------------------
boundary_path = Path('src/data/v1MutationBoundary.ts')
boundary = boundary_path.read_text(encoding='utf-8')
boundary = replace_once(
    boundary,
    "  | 'color-sync';",
    "  | 'color-sync'\n  | 'structure-update';",
    'mutation operation type',
)
boundary_path.write_text(boundary, encoding='utf-8')


# -----------------------------------------------------------------------------
# 4) Music Note page: replace billed user_structures onSnapshot with persistent
#    cache + RTDB invalidation. Actual structure mutations patch cache and emit the
#    existing userSync signal; reload/hydration never write.
# -----------------------------------------------------------------------------
page_path = Path('src/pages/FavoritesPage.tsx')
page = page_path.read_text(encoding='utf-8')
page = replace_once(
    page,
    "import { doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp, writeBatch, onSnapshot } from '../lib/firestoreMeasured';",
    "import { doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp, writeBatch } from '../lib/firestoreMeasured';\nimport { patchMusicNoteStructureCache, subscribeMusicNoteStructureCache } from '../services/musicNoteStructureCache';",
    'Favorites Firestore import',
)

old_listener = r'''    targetSession.unsubscribe = onSnapshot(
      doc(db, 'user_structures', uid),
      (snapshot) => {
        const nextData: any = snapshot.exists() ? snapshot.data() : {};
        targetSession.data = nextData;
        targetSession.listeners.forEach((subscriber) => subscriber(nextData));
      },
      (error) => {
        console.warn('music note folder shared listener failed:', error);
        targetSession.unsubscribe = null;
      },
    );'''
new_listener = r'''    targetSession.unsubscribe = subscribeMusicNoteStructureCache(uid, (nextData) => {
      targetSession.data = nextData;
      targetSession.listeners.forEach((subscriber) => subscriber(nextData));
    });'''
page = replace_once(page, old_listener, new_listener, 'user_structures listener transport')

old_card_write = r'''      await setDoc(doc(db, 'user_structures', uid), {
        musicNoteCardState: {
          schemaVersion: 1,
          items: current.items,
          updatedAtMs: current.updatedAtMs,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });'''
new_card_write = r'''      const cardStatePatch = {
        musicNoteCardState: {
          schemaVersion: 1,
          items: current.items,
          updatedAtMs: current.updatedAtMs,
        },
      };
      await runV1MutationBoundary(
        { domain: 'musicNote', operation: 'structure-update', uid, affectedCount: Object.keys(current.items).length },
        setDoc(doc(db, 'user_structures', uid), {
          musicNoteCardState: {
            ...cardStatePatch.musicNoteCardState,
            updatedAt: serverTimestamp(),
          },
        }, { merge: true }),
      );
      patchMusicNoteStructureCache(uid, cardStatePatch);'''
page = replace_once(page, old_card_write, new_card_write, 'card-state structure write')

old_folder_write = r'''    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: {
        [mode]: normalized.map((folder, index) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order || index + 1,
        })),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });'''
new_folder_write = r'''    const folderItems = normalized.map((folder, index) => ({
      id: folder.id,
      title: folder.title,
      order: folder.order || index + 1,
    }));
    const folderPatch = { musicNoteFolders: { [mode]: folderItems } };
    await runV1MutationBoundary(
      { domain: 'musicNote', operation: 'structure-update', uid: user.uid, affectedCount: folderItems.length },
      setDoc(doc(db, 'user_structures', user.uid), {
        ...folderPatch,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
    );
    patchMusicNoteStructureCache(user.uid, folderPatch);'''
page = replace_once(page, old_folder_write, new_folder_write, 'folder structure write')
page_path.write_text(page, encoding='utf-8')


# -----------------------------------------------------------------------------
# 5) Root users/{uid}: persistent profile cache + RTDB admin/security revision.
#    The existing Firestore listener remains as a bounded fallback and attaches
#    only on cache miss, a real control revision, or a 24h safety verification.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "import { readUserProfileCache, writeUserProfileCache } from './lib/userProfileCache';",
    "import {\n  readUserProfileCache,\n  readUserProfileCacheStoredAt,\n  readUserProfileServerVerifiedAt,\n  writeUserProfileCache,\n  writeUserProfileServerVerifiedAt,\n} from './lib/userProfileCache';\nimport {\n  readSeenUserControlRevision,\n  subscribeUserControlRevision,\n  writeSeenUserControlRevision,\n} from './services/userControlRevisionService';",
    'App profile cache import',
)
app = replace_once(
    app,
    "    let unsubUserDoc: (() => void) | null = null;\n    let favoritesRetryTimer: number | null = null;",
    "    let unsubUserDoc: (() => void) | null = null;\n    let unsubUserControlRevision: (() => void) | null = null;\n    let userProfileSafetyReverifyTimer: number | null = null;\n    let favoritesRetryTimer: number | null = null;",
    'App listener state',
)

# Cleanup when auth identity changes inside the long-lived effect.
app = replace_once(
    app,
    "      if (unsubUserDoc) {\n        unsubUserDoc();\n        unsubUserDoc = null;\n      }\n      if (favoritesRetryTimer !== null) {",
    "      if (unsubUserDoc) {\n        unsubUserDoc();\n        unsubUserDoc = null;\n      }\n      if (unsubUserControlRevision) {\n        unsubUserControlRevision();\n        unsubUserControlRevision = null;\n      }\n      if (userProfileSafetyReverifyTimer !== null) {\n        window.clearTimeout(userProfileSafetyReverifyTimer);\n        userProfileSafetyReverifyTimer = null;\n      }\n      if (favoritesRetryTimer !== null) {",
    'App auth-change cleanup',
)

listener_anchor = "        // One listener is now the single source for role/status/force-logout. Its\n"
app = replace_once(
    app,
    listener_anchor,
    "        let activeUserControlRevision = readSeenUserControlRevision(currentUser.uid);\n\n" + listener_anchor,
    'active control revision state',
)

app = replace_once(
    app,
    "            writeUserProfileCache(currentUser.uid, data);\n",
    "            writeUserProfileCache(currentUser.uid, data);\n            if (isServerSnapshot) {\n              writeUserProfileServerVerifiedAt(currentUser.uid);\n              if (activeUserControlRevision) {\n                writeSeenUserControlRevision(currentUser.uid, activeUserControlRevision);\n              }\n            }\n",
    'server profile verification marker',
)

old_attach = """        attachUserRoleListener();

        // Fetch favorites for the user."""
new_attach = r'''        // SORIDRAW_ROOT_USER_REFRESH_ZERO_1021
        // Normal hard refresh hydrates the last server profile locally and checks
        // only the tiny RTDB control revision. Firestore users/{uid} is reopened
        // only for a cache miss, an actual admin/security change, or a bounded
        // 24-hour safety verification. Reload/cache hydration themselves write 0.
        const cachedUserProfileForRefresh = readUserProfileCache(currentUser.uid) as any;
        if (cachedUserProfileForRefresh) {
          const cachedVerifiedRole = (cachedUserProfileForRefresh.role || 'free') as UserRole;
          setUserRole(cachedVerifiedRole);
          setStaffRole(normalizeStaffRole(cachedUserProfileForRefresh));
          setAdminPermissions(normalizeAdminPermissions(cachedUserProfileForRefresh));
          setIsUserRoleReady(true);
          setEmailVerificationCycleKey(getEmailVerificationCycleKey(currentUser, cachedUserProfileForRefresh));
          setIsEmailVerificationCycleReady(true);
          setUserLyricClicheGuard({
            hardBanTerms: Array.isArray(cachedUserProfileForRefresh.lyricClicheGuard?.hardBanTerms)
              ? cachedUserProfileForRefresh.lyricClicheGuard.hardBanTerms
              : [],
            softBanTerms: Array.isArray(cachedUserProfileForRefresh.lyricClicheGuard?.softBanTerms)
              ? cachedUserProfileForRefresh.lyricClicheGuard.softBanTerms
              : [],
          });
          writeGeminiAutoModelFallback(cachedUserProfileForRefresh.generationPreferences?.autoModelFallback !== false, currentUser.uid);
          setIsUserLyricClicheGuardReady(true);
          applyFavoriteSyncSignal(currentUser.uid, cachedUserProfileForRefresh.favoriteSyncSignal);
          if (cachedUserProfileForRefresh.accountStatus) {
            const cachedStatus = cachedUserProfileForRefresh.accountStatus as AccountStatus;
            setUserStatus(cachedStatus);
            if (cachedStatus === 'banned') setIsBanModalOpen(true);
          }
          if (shouldProcessForceLogout(cachedUserProfileForRefresh, currentUser)) {
            hasCompletedForceLogoutReentryCheckRef.current = true;
            void performForcedLogout({ silent: true });
          } else if (!hasCompletedForceLogoutReentryCheckRef.current) {
            hasCompletedForceLogoutReentryCheckRef.current = true;
          }
        }

        const attachUserRoleListenerFromGate = () => {
          if (userProfileSafetyReverifyTimer !== null) {
            window.clearTimeout(userProfileSafetyReverifyTimer);
            userProfileSafetyReverifyTimer = null;
          }
          attachUserRoleListener();
        };

        const scheduleProfileSafetyVerification = () => {
          if (!cachedUserProfileForRefresh || userProfileSafetyReverifyTimer !== null || unsubUserDoc) return;
          const verifiedAt = readUserProfileServerVerifiedAt(currentUser.uid);
          const PROFILE_SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000;
          const age = verifiedAt > 0 ? Math.max(0, Date.now() - verifiedAt) : Number.POSITIVE_INFINITY;
          if (age >= PROFILE_SAFETY_REVERIFY_MS) {
            attachUserRoleListenerFromGate();
            return;
          }
          userProfileSafetyReverifyTimer = window.setTimeout(() => {
            userProfileSafetyReverifyTimer = null;
            attachUserRoleListener();
          }, Math.max(1_000, PROFILE_SAFETY_REVERIFY_MS - age));
        };

        if (!cachedUserProfileForRefresh) {
          attachUserRoleListenerFromGate();
        } else {
          scheduleProfileSafetyVerification();
        }

        unsubUserControlRevision = subscribeUserControlRevision(
          currentUser.uid,
          (revision) => {
            if (auth.currentUser?.uid !== currentUser.uid) return;
            const nextRevision = String(revision?.revision || '').trim();
            const revisionUpdatedAt = Math.max(0, Number(revision?.updatedAt || 0) || 0);
            activeUserControlRevision = nextRevision;

            const currentCache = readUserProfileCache(currentUser.uid);
            if (!currentCache) {
              attachUserRoleListenerFromGate();
              return;
            }
            if (!nextRevision) return;

            const seenRevision = readSeenUserControlRevision(currentUser.uid);
            if (seenRevision === nextRevision) return;

            // Safe one-time migration: if the cached Firestore profile was written
            // after this control signal, the old listener already observed it.
            const cachedAt = readUserProfileCacheStoredAt(currentUser.uid);
            if (revisionUpdatedAt > 0 && cachedAt >= revisionUpdatedAt) {
              writeSeenUserControlRevision(currentUser.uid, nextRevision);
              return;
            }

            attachUserRoleListenerFromGate();
          },
          (error) => {
            console.warn('User control revision unavailable; cached profile remains active until bounded safety verification.', error);
            if (!readUserProfileCache(currentUser.uid)) attachUserRoleListenerFromGate();
          },
        );

        // Fetch favorites for the user.'''
app = replace_once(app, old_attach, new_attach, 'root listener gate')

app = replace_once(
    app,
    "      if (unsubUserDoc) unsubUserDoc();\n      if (favoritesRetryTimer !== null) window.clearTimeout(favoritesRetryTimer);",
    "      if (unsubUserDoc) unsubUserDoc();\n      if (unsubUserControlRevision) unsubUserControlRevision();\n      if (userProfileSafetyReverifyTimer !== null) window.clearTimeout(userProfileSafetyReverifyTimer);\n      if (favoritesRetryTimer !== null) window.clearTimeout(favoritesRetryTimer);",
    'App final cleanup',
)
app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# Static safety guards.
# -----------------------------------------------------------------------------
final_app = app_path.read_text(encoding='utf-8')
final_page = page_path.read_text(encoding='utf-8')
final_sync = sync_path.read_text(encoding='utf-8')
final_structure = structure_path.read_text(encoding='utf-8')

required = [
    (final_app, 'SORIDRAW_ROOT_USER_REFRESH_ZERO_1021', 'root refresh-zero marker'),
    (final_app, 'subscribeUserControlRevision(', 'root RTDB revision gate'),
    (final_app, 'PROFILE_SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000', 'bounded profile safety verify'),
    (final_page, 'subscribeMusicNoteStructureCache(uid', 'Music Note structure cache transport'),
    (final_page, "operation: 'structure-update'", 'Music Note structure mutation signal'),
    (final_structure, 'getDocFromCache(ref)', 'migration cache-only seed'),
    (final_structure, 'SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000', 'structure safety verify'),
    (final_sync, 'export const MUSIC_NOTE_SYNC_EVENT', 'Music Note sync event export'),
]
for source, fragment, label in required:
    if fragment not in source:
        raise RuntimeError(f'1021 safety missing {label}: {fragment}')

if "targetSession.unsubscribe = onSnapshot(\n      doc(db, 'user_structures', uid)" in final_page:
    raise RuntimeError('1021 safety failed: billed user_structures onSnapshot remains')
if "        attachUserRoleListener();\n\n        // Fetch favorites for the user." in final_app:
    raise RuntimeError('1021 safety failed: unconditional root users listener remains')

print('[1021] refresh-zero Firestore listener transport applied: users + user_structures')

from pathlib import Path
import json

root=Path('.')

p=root/'src/pages/FavoritesPage.tsx'
s=p.read_text()
s=s.replace("import { doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp, writeBatch, onSnapshot } from '../lib/firestoreMeasured';",
            "import { doc, getDoc, getDocFromServer, updateDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp, writeBatch } from '../lib/firestoreMeasured';")
s=s.replace("import { readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';",
            "import { USER_PROFILE_CACHE_EVENT, readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';")
old=s[s.index("type MusicNoteFolderSharedSession = {"):s.index("type MusicNoteCardStateItem = {")]
new=r'''type MusicNoteStructureSharedSession = {
  data: any | null;
  version: number;
  verified: boolean;
  listeners: Set<(data: any) => void>;
  syncInFlight: Promise<void> | null;
  profileListenerAttached: boolean;
};

type MusicNoteStructureCacheEnvelope = {
  schemaVersion: 1;
  version: number;
  verified: boolean;
  updatedAtMs: number;
  data: any;
};

const MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE = 'soridraw_music_note_structure_cache_v1';
const musicNoteStructureSharedSessions = new Map<string, MusicNoteStructureSharedSession>();

const getMusicNoteStructureCacheStorageKey = (uid: string) => `${MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE}_${uid}`;

const getMusicNoteStructureProfileVersion = (uid: string): number => {
  const value = Number((readUserProfileCache(uid) as any)?.syncVersions?.musicNoteStructure || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
};

const readMusicNoteStructureCache = (uid: string): MusicNoteStructureCacheEnvelope | null => {
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getMusicNoteStructureCacheStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number(parsed?.schemaVersion || 0) !== 1 || !parsed?.data || typeof parsed.data !== 'object') return null;
    return {
      schemaVersion: 1,
      version: Math.max(0, Math.floor(Number(parsed?.version || 0))),
      verified: parsed?.verified === true,
      updatedAtMs: Math.max(0, Math.floor(Number(parsed?.updatedAtMs || 0))),
      data: parsed.data,
    };
  } catch {
    return null;
  }
};

const mergeMusicNoteStructureData = (base: any, patch: any) => {
  const previous = base && typeof base === 'object' ? base : {};
  const nextPatch = patch && typeof patch === 'object' ? patch : {};
  const hasFolderPatch = nextPatch.musicNoteFolders && typeof nextPatch.musicNoteFolders === 'object';
  return {
    ...previous,
    ...nextPatch,
    ...(hasFolderPatch ? {
      musicNoteFolders: {
        ...(previous.musicNoteFolders || {}),
        ...nextPatch.musicNoteFolders,
      },
    } : {}),
  };
};

const writeMusicNoteStructureCache = (
  uid: string,
  patch: any,
  version: number,
  verified = true,
): MusicNoteStructureCacheEnvelope => {
  const previous = readMusicNoteStructureCache(uid);
  const next: MusicNoteStructureCacheEnvelope = {
    schemaVersion: 1,
    version: Math.max(Number(previous?.version || 0), Math.max(0, Math.floor(Number(version || 0)))),
    verified: verified || previous?.verified === true,
    updatedAtMs: Date.now(),
    data: mergeMusicNoteStructureData(previous?.data, patch),
  };
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(getMusicNoteStructureCacheStorageKey(uid), JSON.stringify(next)); } catch {}
  }
  return next;
};

const publishMusicNoteStructureSession = (
  uid: string,
  patch: any,
  version: number,
  verified = true,
) => {
  const cached = writeMusicNoteStructureCache(uid, patch, version, verified);
  let session = musicNoteStructureSharedSessions.get(uid);
  if (!session) {
    session = {
      data: cached.data,
      version: cached.version,
      verified: cached.verified,
      listeners: new Set(),
      syncInFlight: null,
      profileListenerAttached: false,
    };
    musicNoteStructureSharedSessions.set(uid, session);
  } else {
    session.data = cached.data;
    session.version = cached.version;
    session.verified = cached.verified;
  }
  session.listeners.forEach((subscriber) => subscriber(cached.data));
};

const getNextMusicNoteStructureVersion = (uid: string): number => {
  const localVersion = Number(readMusicNoteStructureCache(uid)?.version || 0);
  const profileVersion = getMusicNoteStructureProfileVersion(uid);
  return Math.max(Date.now(), localVersion + 1, profileVersion + 1);
};

const ensureMusicNoteStructureFresh = (uid: string, session: MusicNoteStructureSharedSession): Promise<void> => {
  const profileVersion = getMusicNoteStructureProfileVersion(uid);
  if (session.data !== null && session.verified && profileVersion <= session.version) {
    return Promise.resolve();
  }
  if (session.syncInFlight) return session.syncInFlight;

  session.syncInFlight = (async () => {
    try {
      const snapshot = await getDocFromServer(doc(db, 'user_structures', uid));
      const data: any = snapshot.exists() ? snapshot.data() : {};
      const serverDocumentVersion = Number(data?.musicNoteStructureVersion || 0);
      const resolvedVersion = Math.max(profileVersion, Number.isFinite(serverDocumentVersion) ? serverDocumentVersion : 0);
      publishMusicNoteStructureSession(uid, data, resolvedVersion, true);
    } catch (error) {
      console.warn('Music Note structure refresh failed; keeping verified local cache when available.', error);
    } finally {
      session.syncInFlight = null;
    }
  })();
  return session.syncInFlight;
};

const subscribeMusicNoteStructureDocument = (uid: string, listener: (data: any) => void) => {
  let session = musicNoteStructureSharedSessions.get(uid);
  if (!session) {
    const cached = readMusicNoteStructureCache(uid);
    session = {
      data: cached?.data || null,
      version: Number(cached?.version || 0),
      verified: cached?.verified === true,
      listeners: new Set(),
      syncInFlight: null,
      profileListenerAttached: false,
    };
    musicNoteStructureSharedSessions.set(uid, session);
  }

  session.listeners.add(listener);
  if (session.data !== null) {
    const cachedData = session.data;
    queueMicrotask(() => {
      if (session?.listeners.has(listener)) listener(cachedData);
    });
  }

  if (!session.profileListenerAttached && typeof window !== 'undefined') {
    session.profileListenerAttached = true;
    window.addEventListener(USER_PROFILE_CACHE_EVENT, ((event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (String(detail?.uid || '') !== uid) return;
      const current = musicNoteStructureSharedSessions.get(uid);
      if (!current) return;
      const nextRemoteVersion = getMusicNoteStructureProfileVersion(uid);
      if (nextRemoteVersion > current.version) void ensureMusicNoteStructureFresh(uid, current);
    }) as EventListener);
  }

  void ensureMusicNoteStructureFresh(uid, session);

  return () => {
    session?.listeners.delete(listener);
    // Keep only local memory/event wiring for this SPA session. No Firestore listener remains alive.
  };
};

const SORIDRAW_MUSIC_NOTE_STRUCTURE_SIGNAL_1056 = true;


'''
s=s.replace(old,new)
old2="""      await setDoc(doc(db, 'user_structures', uid), {
        musicNoteCardState: {
          schemaVersion: 1,
          items: snapshot.items,
          updatedAtMs: snapshot.updatedAtMs,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });
      clearMusicNoteCardStateDirty(uid);
      return true;"""
new2="""      const structureVersion = getNextMusicNoteStructureVersion(uid);
      const structurePatch = {
        musicNoteCardState: {
          schemaVersion: 1,
          items: snapshot.items,
          updatedAtMs: snapshot.updatedAtMs,
          updatedAt: serverTimestamp(),
        },
        musicNoteStructureVersion: structureVersion,
      };
      await setDoc(doc(db, 'user_structures', uid), structurePatch, { merge: true });
      publishMusicNoteStructureSession(uid, {
        musicNoteCardState: {
          schemaVersion: 1,
          items: snapshot.items,
          updatedAtMs: snapshot.updatedAtMs,
        },
        musicNoteStructureVersion: structureVersion,
      }, structureVersion, true);
      clearMusicNoteCardStateDirty(uid);
      return true;"""
if old2 not in s: raise SystemExit('card flush anchor missing')
s=s.replace(old2,new2,1)
s=s.replace('subscribeMusicNoteFolderDocument(uid, (data: any) => {','subscribeMusicNoteStructureDocument(uid, (data: any) => {',1)
s=s.replace('subscribeMusicNoteFolderDocument(user.uid, applyFolderData);','subscribeMusicNoteStructureDocument(user.uid, applyFolderData);',1)
old3="""    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: {
        [mode]: normalized.map((folder, index) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order || index + 1,
          isDefault: Boolean(folder.isDefault || folder.id === 'default'),
          createdAt: folder.createdAt || Date.now(),
          updatedAt: Date.now(),
        })),
        updatedAt: Date.now(),
      },
    }, { merge: true });"""
new3="""    const structureVersion = getNextMusicNoteStructureVersion(user.uid);
    const folderPatch = {
      [mode]: normalized.map((folder, index) => ({
        id: folder.id,
        title: folder.title,
        order: folder.order || index + 1,
        isDefault: Boolean(folder.isDefault || folder.id === 'default'),
        createdAt: folder.createdAt || Date.now(),
        updatedAt: Date.now(),
      })),
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: folderPatch,
      musicNoteStructureVersion: structureVersion,
    }, { merge: true });
    publishMusicNoteStructureSession(user.uid, {
      musicNoteFolders: folderPatch,
      musicNoteStructureVersion: structureVersion,
    }, structureVersion, true);"""
if old3 not in s: raise SystemExit('folder persist anchor missing')
s=s.replace(old3,new3,1)
p.write_text(s)

p=root/'firestore.rules'; s=p.read_text()
s=s.replace("'googleGeminiApiKey', 'sectionCustom', 'recentSongs', 'musicNote', 'library'",
            "'googleGeminiApiKey', 'sectionCustom', 'recentSongs', 'musicNote', 'library', 'musicNoteStructure'")
s=s.replace("(!('library' in request.resource.data.syncVersions) || request.resource.data.syncVersions.library is int));",
            "(!('library' in request.resource.data.syncVersions) || request.resource.data.syncVersions.library is int) &&\n            (!('musicNoteStructure' in request.resource.data.syncVersions) || request.resource.data.syncVersions.musicNoteStructure is int));")
p.write_text(s)

p=root/'functions/src/musicNoteStructureSync.ts'
p.write_text(r'''import { isDeepStrictEqual } from "node:util";

export const hasMusicNoteStructureRelevantChange = (before: any, after: any): boolean => {
  const beforeFolders = before?.musicNoteFolders ?? before?.myNoteFolders ?? before?.sharedNoteFolders ?? null;
  const afterFolders = after?.musicNoteFolders ?? after?.myNoteFolders ?? after?.sharedNoteFolders ?? null;
  if (!isDeepStrictEqual(beforeFolders, afterFolders)) return true;
  return !isDeepStrictEqual(before?.musicNoteCardState ?? null, after?.musicNoteCardState ?? null);
};

export const getMusicNoteStructureSignalVersion = (
  after: any,
  eventTimeMs: number,
  currentVersion = 0,
): number => {
  const requested = Number(after?.musicNoteStructureVersion || 0);
  return Math.max(
    Number.isFinite(requested) ? Math.floor(requested) : 0,
    Number.isFinite(eventTimeMs) ? Math.floor(eventTimeMs) : 0,
    Number.isFinite(currentVersion) ? Math.floor(currentVersion) : 0,
  );
};
''')

p=root/'functions/src/index.ts'; s=p.read_text()
anchor='} from "./libraryBundleFreshness";\n'
if anchor not in s: raise SystemExit('functions import anchor')
s=s.replace(anchor,anchor+'import { hasMusicNoteStructureRelevantChange, getMusicNoteStructureSignalVersion } from "./musicNoteStructureSync";\n',1)
insert_anchor='// SORIDRAW_SECTION_TAGS_SHARED_BUNDLE_20260904\n'
block=r'''// SORIDRAW_MUSIC_NOTE_STRUCTURE_SIGNAL_1056
// user_structures remains the canonical small private structure document. Only an
// actual folder or Like/Lock mutation publishes a tiny version signal into users/{uid}.
// Warm page entry/reload performs no Function work and no user_structures read.
export const syncMusicNoteStructureVersion = functions
  .region("asia-northeast3")
  .firestore.document("user_structures/{uid}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? (change.before.data() || {}) : null;
    const after = change.after.exists ? (change.after.data() || {}) : null;
    if (!hasMusicNoteStructureRelevantChange(before, after)) return;

    const uid = String(context.params.uid || "").trim();
    if (!uid) return;
    const eventTimeMs = Date.parse(String(context.timestamp || "")) || Date.now();
    const firestore = admin.firestore();
    const userRef = firestore.collection("users").doc(uid);

    await firestore.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) return;
      const currentVersion = Number(userSnapshot.data()?.syncVersions?.musicNoteStructure || 0);
      const nextVersion = getMusicNoteStructureSignalVersion(after, eventTimeMs, currentVersion);
      if (nextVersion <= currentVersion) return;
      transaction.set(userRef, { syncVersions: { musicNoteStructure: nextVersion } }, { merge: true });
    });
  });

'''
if insert_anchor not in s: raise SystemExit('function insert anchor')
s=s.replace(insert_anchor,block+insert_anchor,1)
p.write_text(s)

p=root/'functions/scripts/test-music-note-structure-sync.cjs'
p.write_text(r'''const assert = require('node:assert/strict');
const {
  hasMusicNoteStructureRelevantChange,
  getMusicNoteStructureSignalVersion,
} = require('../lib/musicNoteStructureSync.js');

assert.equal(hasMusicNoteStructureRelevantChange({ other: 1 }, { other: 2 }), false, 'unrelated structure fields must not signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteFolders: { myNote: [] } }, { musicNoteFolders: { myNote: [{ id: 'x' }] } }), true, 'folder mutation must signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteCardState: { items: {} } }, { musicNoteCardState: { items: { x: { liked: true } } } }), true, 'card-state mutation must signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteFolders: { myNote: [] }, musicNoteCardState: { items: {} } }, { musicNoteFolders: { myNote: [] }, musicNoteCardState: { items: {} }, other: 1 }), false, 'identical relevant state must stay quiet');
assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 100, 110), 120, 'client mutation version wins');
assert.equal(getMusicNoteStructureSignalVersion({}, 130, 110), 130, 'legacy client event time produces a signal');
assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 110, 140), 140, 'transaction never regresses current version');
console.log('Music Note structure signal contract: 7 cases PASS');
''')

p=root/'functions/package.json'
obj=json.loads(p.read_text())
obj['scripts']['test:music-note-structure-sync']='node scripts/test-music-note-structure-sync.cjs'
p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")

print('1056 base patch applied')

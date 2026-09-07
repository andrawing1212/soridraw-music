from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


detail_cache = r'''export const SORIDRAW_MUSIC_NOTE_DETAIL_CACHE_029 = true;

type MusicNoteDetailCacheRecord = {
  key: string;
  uid: string;
  sourceId: string;
  sourceVersion: number;
  savedAtMs: number;
  data: any;
};

type MusicNoteDetailLoadArgs = {
  uid: string;
  sourceId: string;
  sourceVersion: number;
  loader: () => Promise<any | null>;
};

const DB_NAME = 'soridraw_music_note_detail_cache_v1';
const DB_STORE = 'details';
const DB_VERSION = 1;
const UNKNOWN_VERSION_TTL_MS = 10 * 60 * 1000;
const MEMORY_MAX = 80;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryCache = new Map<string, MusicNoteDetailCacheRecord>();
const inFlightLoads = new Map<string, Promise<any | null>>();

const cacheKey = (uid: string, sourceId: string) => `${uid}:${sourceId}`;

const toTimestampMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (value instanceof Date) return Math.max(0, value.getTime());
  if (typeof value?.toMillis === 'function') {
    const next = Number(value.toMillis());
    return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  }
  if (typeof value?.seconds === 'number') {
    const next = Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export const getMusicNoteDetailSourceVersion = (source: any): number => {
  const candidates = [
    source?.updatedAtMs,
    source?.updatedAt,
    source?.modifiedAtMs,
    source?.modifiedAt,
    source?.createdAtMs,
    source?.createdAt,
  ];
  for (const candidate of candidates) {
    const value = toTimestampMs(candidate);
    if (value > 0) return value;
  }
  return 0;
};

const cacheRecordIsFresh = (record: MusicNoteDetailCacheRecord, sourceVersion: number): boolean => {
  if (sourceVersion > 0) return Number(record.sourceVersion || 0) === sourceVersion;
  return Date.now() - Number(record.savedAtMs || 0) <= UNKNOWN_VERSION_TTL_MS;
};

const remember = (record: MusicNoteDetailCacheRecord) => {
  if (memoryCache.has(record.key)) memoryCache.delete(record.key);
  memoryCache.set(record.key, record);
  while (memoryCache.size > MEMORY_MAX) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
};

const cleanForPersistence = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return toTimestampMs(value);
  if (Array.isArray(value)) {
    if (depth > 14) return [];
    return value.map((entry) => cleanForPersistence(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 14) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const cleaned = cleanForPersistence(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      settled = true;
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      if (!settled) resolve(null);
    };
    request.onblocked = () => {
      if (!settled) resolve(null);
    };
  });
  return dbPromise;
};

const readPersistent = async (key: string): Promise<MusicNoteDetailCacheRecord | null> => {
  const database = await openDb();
  if (!database) return null;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const writePersistent = async (record: MusicNoteDetailCacheRecord): Promise<void> => {
  const database = await openDb();
  if (!database) return;
  const data = cleanForPersistence(record.data);
  if (!data || typeof data !== 'object') return;
  try {
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
      transaction.objectStore(DB_STORE).put({ ...record, data });
    });
  } catch {
    // IndexedDB is optional. Memory cache still prevents repeated reads in this session.
  }
};

export const getOrLoadMusicNoteDetail = async ({
  uid,
  sourceId,
  sourceVersion,
  loader,
}: MusicNoteDetailLoadArgs): Promise<any | null> => {
  const safeUid = String(uid || '').trim();
  const safeSourceId = String(sourceId || '').trim();
  if (!safeUid || !safeSourceId) return null;

  const version = Math.max(0, Math.floor(Number(sourceVersion || 0)));
  const key = cacheKey(safeUid, safeSourceId);
  const memory = memoryCache.get(key);
  if (memory && cacheRecordIsFresh(memory, version)) {
    remember(memory);
    return memory.data;
  }

  const persistent = await readPersistent(key);
  if (persistent && cacheRecordIsFresh(persistent, version)) {
    remember(persistent);
    return persistent.data;
  }

  const flightKey = `${key}:${version}`;
  const existing = inFlightLoads.get(flightKey);
  if (existing) return existing;

  const task = (async () => {
    const loaded = await loader();
    if (!loaded || typeof loaded !== 'object') return null;
    const record: MusicNoteDetailCacheRecord = {
      key,
      uid: safeUid,
      sourceId: safeSourceId,
      sourceVersion: version,
      savedAtMs: Date.now(),
      data: loaded,
    };
    remember(record);
    void writePersistent(record);
    return loaded;
  })().finally(() => {
    inFlightLoads.delete(flightKey);
  });

  inFlightLoads.set(flightKey, task);
  return task;
};
'''
Path('src/lib/musicNoteDetailCache.ts').write_text(detail_cache, encoding='utf-8')

replace_once(
    'src/pages/FavoritesPage.tsx',
    "import { USER_PROFILE_CACHE_EVENT, readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';\n",
    "import { USER_PROFILE_CACHE_EVENT, readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';\nimport { getMusicNoteDetailSourceVersion, getOrLoadMusicNoteDetail } from '../lib/musicNoteDetailCache';\n",
    'FavoritesPage detail cache import',
)

old_hydrate = '''  const hydrateCatalogFavorite = async (song: any): Promise<any> => {
    if (!song?.__catalogSummary || !user?.uid || isSharedMusicNoteItem(song) || isMusicNoteSharedView) return song;
    const sourceId = getFavoriteDocumentId(song);
    if (!sourceId) return song;
    try {
      const snapshot = await getDoc(doc(db, 'favorites', sourceId));
      if (!snapshot.exists()) return song;
      return {
        ...song,
        ...(snapshot.data() || {}),
        id: sourceId,
        firestoreId: sourceId,
        __catalogSummary: false,
      };
    } catch (error) {
      console.warn('music note detail hydration failed:', error);
      return song;
    }
  };'''
new_hydrate = '''  const hydrateCatalogFavorite = async (song: any): Promise<any> => {
    if (!song?.__catalogSummary || !user?.uid || isSharedMusicNoteItem(song) || isMusicNoteSharedView) return song;
    const sourceId = getFavoriteDocumentId(song);
    if (!sourceId) return song;
    const sourceVersion = getMusicNoteDetailSourceVersion(song);
    try {
      const detail = await getOrLoadMusicNoteDetail({
        uid: user.uid,
        sourceId,
        sourceVersion,
        loader: async () => {
          const snapshot = await getDoc(doc(db, 'favorites', sourceId));
          return snapshot.exists() ? (snapshot.data() || {}) : null;
        },
      });
      if (!detail) return song;
      return {
        ...song,
        ...detail,
        id: sourceId,
        firestoreId: sourceId,
        __catalogSummary: false,
      };
    } catch (error) {
      console.warn('music note detail hydration failed:', error);
      return song;
    }
  };'''
replace_once('src/pages/FavoritesPage.tsx', old_hydrate, new_hydrate, 'FavoritesPage hydrate cache')

replace_once(
    'src/pages/SunoLibraryPage.tsx',
    "const scopedCreditStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;\n",
    "const scopedCreditStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;\nconst libraryAppliedKeywordsSessionCache = new Map<string, any>();\n",
    'Library appliedKeywords session cache',
)

old_library_apply = '''  const handleApplyNext = (group: any, item: any) => {
    if (!group && !item) return;

    const appliedKeywords = resolveSunoAppliedKeywords(
      item,
      group,
      group?.item,
      group?.track,
      group?.shareData,
      group?.tracks?.[0]
    );

    console.log("Shared/Library apply source:", {
      group,
      item,
      resolvedAppliedKeywords: appliedKeywords,
    });

    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      showToast("이 곡은 키워드 정보가 없어 적용할 수 없습니다.");
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem("pendingAppliedKeywords", serialized);
    localStorage.setItem("pendingAppliedKeywordsBackup", serialized);

    console.log("Saved pendingAppliedKeywords:", {
      appliedKeywords,
      sessionValue: sessionStorage.getItem("pendingAppliedKeywords"),
      localBackup: localStorage.getItem("pendingAppliedKeywordsBackup"),
    });

    showToast("다음 곡에 곡 설정이 복원되었습니다.");

    setTimeout(() => {
      navigate(`/studio?applyPending=1&t=${Date.now()}`);
    }, 700);
  };'''
new_library_apply = '''  const handleApplyNext = async (group: any, item: any) => {
    if (!group && !item) return;

    let appliedKeywords = resolveSunoAppliedKeywords(
      item,
      group,
      group?.item,
      group?.track,
      group?.shareData,
      group?.tracks?.[0]
    );

    const activeUid = String(user?.uid || auth.currentUser?.uid || '').trim();
    const isPlaylistSource = Boolean(
      group?.isPlaylistItem || item?.isPlaylistItem ||
      group?.sourceType === 'suno_track' || item?.sourceType === 'suno_track'
    );
    const isSharedSource = Boolean(
      isSharedView || group?.sourceType === 'shared_track' || item?.sourceType === 'shared_track'
    );
    const sourceTrackId = String(
      isPlaylistSource
        ? (group?.sourceId || item?.sourceId || group?.trackId || item?.trackId || group?.id || '')
        : (group?.id || group?.trackId || item?.sourceId || item?.trackId || '')
    ).trim();
    const keywordCacheKey = activeUid && sourceTrackId ? `${activeUid}:${sourceTrackId}` : '';

    if ((!appliedKeywords || Object.keys(appliedKeywords).length === 0) && keywordCacheKey) {
      appliedKeywords = libraryAppliedKeywordsSessionCache.get(keywordCacheKey) || null;
    }

    if ((!appliedKeywords || Object.keys(appliedKeywords).length === 0) && activeUid && sourceTrackId && !isSharedSource) {
      try {
        const sourceSnapshot = await getDoc(doc(db, 'suno_tracks', activeUid, 'tracks', sourceTrackId));
        if (sourceSnapshot.exists()) {
          const fullTrack: any = { id: sourceTrackId, ...(sourceSnapshot.data() || {}) };
          appliedKeywords = resolveSunoAppliedKeywords(
            item,
            fullTrack,
            fullTrack?.item,
            fullTrack?.track,
            fullTrack?.shareData,
            fullTrack?.tracks?.[0]
          );
          if (appliedKeywords && Object.keys(appliedKeywords).length > 0) {
            libraryAppliedKeywordsSessionCache.set(keywordCacheKey, appliedKeywords);
            patchWorkspaceTrackLocally(sourceTrackId, (current) => ({
              ...current,
              appliedKeywords,
              requestPayload: current?.requestPayload || fullTrack?.requestPayload || null,
            }));
          }
        }
      } catch (error) {
        console.warn('Library next-song keyword hydration failed:', error);
      }
    }

    if (appliedKeywords && Object.keys(appliedKeywords).length > 0 && keywordCacheKey) {
      libraryAppliedKeywordsSessionCache.set(keywordCacheKey, appliedKeywords);
    }

    console.log("Shared/Library apply source:", {
      group,
      item,
      resolvedAppliedKeywords: appliedKeywords,
    });

    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      showToast("이 곡은 키워드 정보가 없어 적용할 수 없습니다.");
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem("pendingAppliedKeywords", serialized);
    localStorage.setItem("pendingAppliedKeywordsBackup", serialized);

    console.log("Saved pendingAppliedKeywords:", {
      appliedKeywords,
      sessionValue: sessionStorage.getItem("pendingAppliedKeywords"),
      localBackup: localStorage.getItem("pendingAppliedKeywordsBackup"),
    });

    showToast("다음 곡에 곡 설정이 복원되었습니다.");

    setTimeout(() => {
      navigate(`/studio?applyPending=1&t=${Date.now()}`);
    }, 700);
  };'''
replace_once('src/pages/SunoLibraryPage.tsx', old_library_apply, new_library_apply, 'Library next-song apply fallback')

summary_anchor = "  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt',\n"
summary_replacement = "  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt', 'appliedKeywords',\n"
replace_once('src/lib/userDataEngine.ts', summary_anchor, summary_replacement, 'client Library summary appliedKeywords')
replace_once('cloudflare/media-worker/src/index.js', summary_anchor, summary_replacement, 'Worker Library summary appliedKeywords')

replace_once(
    'src/components/GlobalPlayer.tsx',
    "import { doc, updateDoc, setDoc, serverTimestamp } from '../lib/firestoreMeasured';\n",
    "import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from '../lib/firestoreMeasured';\n",
    'GlobalPlayer getDoc import',
)

old_global_apply = '''  const handleApplyNext = () => {
    if (dispatchLibraryAction('applyNext')) return;
    if (!currentTrack) return;
    const group = currentTrack.parent || {};

    const appliedKeywords = group.appliedKeywords;
    
    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      alert('이 곡은 키워드 정보가 없어 적용할 수 없습니다.');
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem('pendingAppliedKeywords', serialized);
    localStorage.setItem('pendingAppliedKeywordsBackup', serialized);

    if (!auth.currentUser) {
      if (confirm('로그인 후 다음 곡에 설정이 적용됩니다. 로그인 화면으로 이동할까요?')) {
        handleModeChange('collapsed');
        navigate('/');
      }
      return;
    }

    alert('다음 곡에 곡 설정이 복원되었습니다. 홈으로 이동합니다.');
    handleModeChange('collapsed');
    navigate('/studio?applyPending=1');
  };'''
new_global_apply = '''  const handleApplyNext = async () => {
    if (dispatchLibraryAction('applyNext')) return;
    if (!currentTrack) return;
    const group = currentTrack.parent || {};

    let appliedKeywords =
      group.appliedKeywords ||
      group?.requestPayload?.appliedKeywords ||
      (currentTrack as any)?.appliedKeywords ||
      null;

    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      const currentUser = auth.currentUser;
      const sourceTrackId = String(
        isPlaylistTrack
          ? (group?.sourceId || group?.trackId || (currentTrack as any)?.sourceId || (currentTrack as any)?.trackId || '')
          : (group?.id || group?.trackId || group?.taskId || '')
      ).trim();

      if (currentUser && sourceTrackId && !isSharedPlaylistTrack) {
        try {
          const sourceSnapshot = await getDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', sourceTrackId));
          if (sourceSnapshot.exists()) {
            const sourceData: any = sourceSnapshot.data() || {};
            appliedKeywords = sourceData?.appliedKeywords || sourceData?.requestPayload?.appliedKeywords || null;
            if (appliedKeywords && Object.keys(appliedKeywords).length > 0) {
              group.appliedKeywords = appliedKeywords;
            }
          }
        } catch (error) {
          console.warn('Global player next-song keyword hydration failed:', error);
        }
      }
    }
    
    if (!appliedKeywords || Object.keys(appliedKeywords).length === 0) {
      alert('이 곡은 키워드 정보가 없어 적용할 수 없습니다.');
      return;
    }

    const serialized = JSON.stringify(appliedKeywords);
    sessionStorage.setItem('pendingAppliedKeywords', serialized);
    localStorage.setItem('pendingAppliedKeywordsBackup', serialized);

    if (!auth.currentUser) {
      if (confirm('로그인 후 다음 곡에 설정이 적용됩니다. 로그인 화면으로 이동할까요?')) {
        handleModeChange('collapsed');
        navigate('/');
      }
      return;
    }

    alert('다음 곡에 곡 설정이 복원되었습니다. 홈으로 이동합니다.');
    handleModeChange('collapsed');
    navigate('/studio?applyPending=1');
  };'''
replace_once('src/components/GlobalPlayer.tsx', old_global_apply, new_global_apply, 'GlobalPlayer next-song fallback')

verify = r'''import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const favorites = read('src/pages/FavoritesPage.tsx');
assert.ok(favorites.includes("from '../lib/musicNoteDetailCache'"));
const hydrateStart = favorites.indexOf('const hydrateCatalogFavorite = async');
const hydrateEnd = favorites.indexOf('const openFavoriteDetail', hydrateStart);
assert.ok(hydrateStart >= 0 && hydrateEnd > hydrateStart);
const hydrate = favorites.slice(hydrateStart, hydrateEnd);
assert.ok(hydrate.includes('getOrLoadMusicNoteDetail'));
assert.ok(hydrate.includes('getMusicNoteDetailSourceVersion'));
assert.ok(hydrate.includes("getDoc(doc(db, 'favorites', sourceId))"));

const detailCache = read('src/lib/musicNoteDetailCache.ts');
assert.ok(detailCache.includes('SORIDRAW_MUSIC_NOTE_DETAIL_CACHE_029'));
assert.ok(detailCache.includes('indexedDB.open'));
assert.ok(detailCache.includes('inFlightLoads'));
assert.ok(detailCache.includes('cacheRecordIsFresh'));

const library = read('src/pages/SunoLibraryPage.tsx');
const applyStart = library.indexOf('const handleApplyNext = async');
const applyEnd = library.indexOf('const getPlaylistSaveIsShared', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart);
const apply = library.slice(applyStart, applyEnd);
assert.ok(apply.includes("getDoc(doc(db, 'suno_tracks', activeUid, 'tracks', sourceTrackId))"));
assert.ok(apply.includes('libraryAppliedKeywordsSessionCache'));
assert.ok(apply.includes('patchWorkspaceTrackLocally'));

const engine = read('src/lib/userDataEngine.ts');
const engineLibraryStart = engine.indexOf('const LIBRARY_SUMMARY_KEYS');
const engineLibraryEnd = engine.indexOf(']);', engineLibraryStart);
assert.ok(engineLibraryStart >= 0 && engineLibraryEnd > engineLibraryStart);
assert.ok(engine.slice(engineLibraryStart, engineLibraryEnd).includes("'appliedKeywords'"));

const worker = read('cloudflare/media-worker/src/index.js');
const workerLibraryStart = worker.indexOf('const LIBRARY_SUMMARY_KEYS');
const workerLibraryEnd = worker.indexOf(']);', workerLibraryStart);
assert.ok(workerLibraryStart >= 0 && workerLibraryEnd > workerLibraryStart);
assert.ok(worker.slice(workerLibraryStart, workerLibraryEnd).includes("'appliedKeywords'"));

const player = read('src/components/GlobalPlayer.tsx');
assert.ok(player.includes("doc, getDoc, updateDoc"));
const playerApplyStart = player.indexOf('const handleApplyNext = async');
const playerApplyEnd = player.indexOf('const handleSaveOrMovePlaylist', playerApplyStart);
assert.ok(playerApplyStart >= 0 && playerApplyEnd > playerApplyStart);
assert.ok(player.slice(playerApplyStart, playerApplyEnd).includes("getDoc(doc(db, 'suno_tracks'"));

console.log('VERIFY_029_MUSIC_NOTE_LIBRARY=PASS');
'''
Path('scripts/verify-029-music-note-library.mjs').write_text(verify, encoding='utf-8')

print('APPLY_029_MUSIC_NOTE_LIBRARY=PASS')

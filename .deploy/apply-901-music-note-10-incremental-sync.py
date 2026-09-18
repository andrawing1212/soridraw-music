from pathlib import Path
import re

MARKER = 'SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC'


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
# App.tsx — cache-first Music Note, exact 10-document pages, incremental refresh
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    helpers_anchor = "const FAVORITE_DELETED_TOMBSTONE_LIMIT = 800;\n"
    helpers = '''
const SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC = true;
const MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE = 'soridraw_music_note_local_sync_version_v1';
const MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE = 'soridraw_music_note_remote_sync_version_v1';
const MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE = 'soridraw_music_note_pagination_cursor_v1';
const MUSIC_NOTE_DEVICE_ID_STORAGE_KEY = 'soridraw_music_note_device_id_v1';
const MUSIC_NOTE_SYNC_VERSION_EVENT = 'soridraw:music-note-sync-version';
const musicNoteFreshBootstrapUids = new Set<string>();

const getMusicNoteScopedStorageKey = (base: string, uid: string) => `${base}_${uid}`;
const readMusicNoteSyncVersion = (base: string, uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getMusicNoteScopedStorageKey(base, uid)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeMusicNoteSyncVersion = (base: string, uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0 || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getMusicNoteScopedStorageKey(base, uid), String(version));
  } catch {}
};

const getMusicNoteDeviceId = (): string => {
  if (typeof localStorage === 'undefined') return 'memory-device';
  try {
    const saved = localStorage.getItem(MUSIC_NOTE_DEVICE_ID_STORAGE_KEY);
    if (saved) return saved;
    const next = `mn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(MUSIC_NOTE_DEVICE_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return 'memory-device';
  }
};

const readMusicNotePaginationCursor = (uid: string): Date | null => {
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const ms = Number(localStorage.getItem(getMusicNoteScopedStorageKey(MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE, uid)) || 0);
    return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
  } catch {
    return null;
  }
};

const writeMusicNotePaginationCursor = (uid: string, docSnap: any | null) => {
  if (!uid || !docSnap || typeof localStorage === 'undefined') return;
  try {
    const data = typeof docSnap.data === 'function' ? docSnap.data() : null;
    const ms = Number(data?.createdAtMs || 0) || getTimestampMs(data?.createdAt);
    if (ms > 0) {
      localStorage.setItem(getMusicNoteScopedStorageKey(MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE, uid), String(ms));
    }
  } catch {}
};

const clearMusicNotePaginationCursor = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(getMusicNoteScopedStorageKey(MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE, uid));
  } catch {}
};
'''
    app = replace_once(app, helpers_anchor, helpers_anchor + helpers, 'music note cache helpers')

    app = replace_once(app, "  const FAVORITES_PAGE_SIZE = 20;", "  const FAVORITES_PAGE_SIZE = 10;", 'favorites page size 10')
    app = replace_all(app, "limit(FAVORITES_PAGE_SIZE + 1)", "limit(FAVORITES_PAGE_SIZE)", 'exact 10 read limit')
    app = replace_all(
        app,
        "favoritePaginationExhaustedRef.current = snapshot.docs.length <= FAVORITES_PAGE_SIZE;",
        "favoritePaginationExhaustedRef.current = snapshot.docs.length < FAVORITES_PAGE_SIZE;",
        '10-item exhaustion test',
    )

    # Carry the device identity in the existing compact signal so the device that
    # made the write can accept its own cache without rereading Firestore.
    app = replace_once(
        app,
        "      id: `${action}_${at}_${Math.random().toString(36).slice(2, 8)}`,\n      action,",
        "      id: `${action}_${at}_${Math.random().toString(36).slice(2, 8)}`,\n      originDeviceId: getMusicNoteDeviceId(),\n      action,",
        'favorite signal origin device',
    )

    # The latest delete signal carries the device's remembered delete tombstones.
    # This lets one later signal remove multiple deletes that happened while the
    # other device was offline, without adding a new Firestore collection.
    old_ids = "    const favoriteIds = Array.from(new Set((relatedFavorites || []).map((favorite) => favorite?.id).filter(Boolean))).slice(0, 30);"
    new_ids = '''    const signalUid = String(
      syncedFavorite?.uid || song?.uid || relatedFavorites?.[0]?.uid || auth.currentUser?.uid || ''
    ).trim();
    const rememberedDeleteIds = action === 'delete' && signalUid
      ? Array.from(getFavoriteDeletedTombstoneIds(signalUid))
      : [];
    const favoriteIds = Array.from(new Set([
      ...(relatedFavorites || []).map((favorite) => favorite?.id).filter(Boolean),
      ...rememberedDeleteIds,
    ])).slice(-450);'''
    app = replace_once(app, old_ids, new_ids, 'cumulative delete ids')

    # Reuse the already-existing users/{uid} listener as the tiny remote version
    # signal. No dedicated version document read/listener is created.
    profile_old = "            applyFavoriteSyncSignal(currentUser.uid, data.favoriteSyncSignal);"
    profile_new = '''            applyFavoriteSyncSignal(currentUser.uid, data.favoriteSyncSignal);
            const musicNoteRemoteVersion = Number(data?.syncVersions?.musicNote || data?.favoriteSyncSignalUpdatedAt || 0);
            if (musicNoteRemoteVersion > 0) {
              writeMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, currentUser.uid, musicNoteRemoteVersion);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(MUSIC_NOTE_SYNC_VERSION_EVENT, {
                  detail: {
                    uid: currentUser.uid,
                    version: musicNoteRemoteVersion,
                    originDeviceId: String(data?.favoriteSyncSignal?.originDeviceId || ''),
                  },
                }));
              }
            }'''
    app = replace_once(app, profile_old, profile_new, 'profile music note version')

    # Mark whether this is a true first-device/bootstrap path before deciding if a
    # separate incremental query is allowed.
    cache_old = "        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);\n"
    cache_new = '''        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);
        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          musicNoteFreshBootstrapUids.delete(currentUser.uid);
        } else {
          musicNoteFreshBootstrapUids.add(currentUser.uid);
        }
'''
    app = replace_once(app, cache_old, cache_new, 'bootstrap state')

    # If this device already has Music Note cache, do not recreate the first-page
    # Firestore listener. Persisted cursor keeps later 10-item More paging usable.
    first_query_old = '''        const q = query(
          collection(db, 'favorites'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(FAVORITES_PAGE_SIZE)
        );

        unsubFavs = onSnapshot(q, (snapshot) => {'''
    first_query_new = '''        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
          return;
        }

        const q = query(
          collection(db, 'favorites'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(FAVORITES_PAGE_SIZE)
        );

        unsubFavs = onSnapshot(q, (snapshot) => {'''
    app = replace_once(app, first_query_old, first_query_new, 'cache restart no listener')

    cursor_old = "          favoritePaginationCursorRef.current = firstPageDocs[firstPageDocs.length - 1] || null;"
    cursor_new = '''          favoritePaginationCursorRef.current = firstPageDocs[firstPageDocs.length - 1] || null;
          if (favoritePaginationCursorRef.current) {
            writeMusicNotePaginationCursor(currentUser.uid, favoritePaginationCursorRef.current);
          } else {
            clearMusicNotePaginationCursor(currentUser.uid);
          }'''
    app = replace_once(app, cursor_old, cursor_new, 'first page cursor')

    # First launch only needs one first-page snapshot. The users listener handles
    # subsequent remote changes, so detach the favorites query immediately.
    first_finish_old = "          setIsFavoritesLoading(false);\n        }, (error) => {"
    first_finish_new = '''          setIsFavoritesLoading(false);
          musicNoteFreshBootstrapUids.delete(currentUser.uid);
          const remoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, currentUser.uid);
          if (remoteVersion > 0) {
            writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, currentUser.uid, remoteVersion);
          }
          if (unsubFavs) {
            const detach = unsubFavs;
            unsubFavs = null;
            detach();
          }
        }, (error) => {'''
    app = replace_once(app, first_finish_old, first_finish_new, 'detach bootstrap listener')

    # Remove the old delayed whole-collection recovery read. Full reconciliation
    # now belongs only to the explicit user Sync button.
    recovery_old = '''        favoriteFullCacheRecoveryTimer = window.setTimeout(() => {
          void runFavoritesFullCacheRecoveryOnce();
        }, 8000);'''
    recovery_new = '''        // 901: delayed full-list recovery disabled; manual Sync owns full reconciliation.
        favoriteFullCacheRecoveryTimer = null;'''
    app = replace_once(app, recovery_old, recovery_new, 'disable full recovery read')

    more_cursor_old = '''      if (nextDocs.length > 0) {
        favoritePaginationCursorRef.current = nextDocs[nextDocs.length - 1];
      }'''
    more_cursor_new = '''      if (nextDocs.length > 0) {
        favoritePaginationCursorRef.current = nextDocs[nextDocs.length - 1];
        writeMusicNotePaginationCursor(currentUser.uid, favoritePaginationCursorRef.current);
      } else {
        clearMusicNotePaginationCursor(currentUser.uid);
      }'''
    app = replace_once(app, more_cursor_old, more_cursor_new, 'persist more cursor')

    # Incremental refresh: only changed favorites after the local version, maximum
    # 10 docs per automatic sync. A full 10-doc page intentionally leaves remaining
    # changes for a later session/check rather than expanding into an unbounded read.
    search_anchor = "  const searchFavoritesOnServer = useCallback(async (rawSearchText: string): Promise<any[]> => {"
    incremental = '''  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(async (
    remoteVersion: number,
    originDeviceId = '',
  ) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid || !Number.isFinite(remoteVersion) || remoteVersion <= 0) return;

    const uid = currentUser.uid;
    const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
    if (localVersion >= remoteVersion) return;

    if (musicNoteFreshBootstrapUids.has(uid)) {
      writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, remoteVersion);
      return;
    }

    if (originDeviceId && originDeviceId === getMusicNoteDeviceId()) {
      writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, remoteVersion);
      markCacheDiagnostic('musicNote', 'CACHE', 0);
      return;
    }

    try {
      const q = query(
        collection(db, 'favorites'),
        where('uid', '==', uid),
        where('updatedAtMs', '>', localVersion),
        orderBy('updatedAtMs', 'asc'),
        limit(FAVORITES_PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const changedFavorites = snapshot.docs.map(mapFavoriteFirestoreDoc);
      markCacheDiagnostic('musicNote', 'SYNC', snapshot.docs.length);

      if (changedFavorites.length > 0) {
        setFavorites((prev) => {
          let next = Array.isArray(prev) ? [...prev] : [];
          changedFavorites.forEach((favorite) => {
            next = next.filter((item) => item?.id !== favorite?.id);
            if (!isFavoriteSoftRemoved(favorite)) {
              next = mergeFavoritePages([favorite], next);
            }
          });
          const sorted = sortFavoriteList(next);
          writeFavoritesCache(uid, sorted);
          return sorted;
        });
      }

      const maxSeenVersion = changedFavorites.reduce(
        (maxValue, favorite) => Math.max(maxValue, Number(favorite?.updatedAtMs || 0)),
        localVersion,
      );

      if (snapshot.docs.length < FAVORITES_PAGE_SIZE || maxSeenVersion >= remoteVersion) {
        writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, remoteVersion);
      } else if (maxSeenVersion > localVersion) {
        writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, maxSeenVersion);
      }
    } catch (error) {
      console.warn('Music Note incremental sync failed. Keeping cache + latest sync signal.', error);
    }
  }, [user]);

  useEffect(() => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid || typeof window === 'undefined') return;

    const handleMusicNoteSyncVersion = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string; version?: number; originDeviceId?: string }>).detail;
      if (!detail || detail.uid !== currentUser.uid) return;
      void syncMusicNoteIncrementalFromRemoteVersion(
        Number(detail.version || 0),
        String(detail.originDeviceId || ''),
      );
    };

    window.addEventListener(MUSIC_NOTE_SYNC_VERSION_EVENT, handleMusicNoteSyncVersion as EventListener);
    const pendingRemoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, currentUser.uid);
    if (pendingRemoteVersion > 0) {
      void syncMusicNoteIncrementalFromRemoteVersion(pendingRemoteVersion);
    }
    return () => window.removeEventListener(MUSIC_NOTE_SYNC_VERSION_EVENT, handleMusicNoteSyncVersion as EventListener);
  }, [user, syncMusicNoteIncrementalFromRemoteVersion]);

'''
    app = replace_once(app, search_anchor, incremental + search_anchor, 'incremental sync block')

    # Existing button becomes true full 1:1 recovery. Daily limiter is removed.
    manual_start = app.find("  const FAVORITES_MANUAL_SYNC_STORAGE_BASE = 'soridraw_favorites_manual_sync_date';")
    manual_end = app.find("\n\n  const showToast = useCallback", manual_start)
    if manual_start < 0 or manual_end < 0:
        raise SystemExit('manual sync block anchors missing')
    manual = '''  const refreshFavoritesFromServerFirstPage = useCallback(async (): Promise<{ ok: boolean; limited?: boolean; message?: string }> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) {
      return { ok: false, message: '로그인이 필요합니다.' };
    }

    try {
      const snapshot = await getDocs(query(
        collection(db, 'favorites'),
        where('uid', '==', currentUser.uid)
      ));
      const serverFavorites = sortFavoriteList(
        snapshot.docs.map(mapFavoriteFirestoreDoc).filter((favorite) => !isFavoriteSoftRemoved(favorite))
      );

      setFavorites(serverFavorites);
      writeFavoritesCache(currentUser.uid, serverFavorites);
      favoritesStore.setFavorites(serverFavorites);
      favoritePaginationCursorRef.current = null;
      favoritePaginationExhaustedRef.current = true;
      favoritePaginationFallbackModeRef.current = false;
      setHasMoreFavorites(false);
      clearMusicNotePaginationCursor(currentUser.uid);

      const remoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, currentUser.uid);
      const newestServerVersion = serverFavorites.reduce(
        (maxValue, favorite) => Math.max(maxValue, Number(favorite?.updatedAtMs || 0)),
        0,
      );
      const reconciledVersion = Math.max(remoteVersion, newestServerVersion);
      if (reconciledVersion > 0) {
        writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, currentUser.uid, reconciledVersion);
      }

      markCacheDiagnostic('musicNote', 'SYNC', snapshot.docs.length);
      return { ok: true, message: `서버와 뮤직노트를 전체 동기화했습니다. (${snapshot.docs.length}곡 확인)` };
    } catch (error) {
      console.warn('Manual full Music Note sync failed.', error);
      return { ok: false, message: '동기화에 실패했습니다.' };
    }
  }, [user]);'''
    app = app[:manual_start] + manual + app[manual_end:]

    # New/changed rows carry updatedAtMs so version mismatch can fetch only changed
    # documents. Existing rows remain backward compatible until next modification.
    app = replace_once(
        app,
        "        createdAtMs,\n        createdAt: serverTimestamp(),",
        "        createdAtMs,\n        updatedAtMs: createdAtMs,\n        createdAt: serverTimestamp(),",
        'new favorite updatedAtMs',
    )
    app = replace_once(
        app,
        "          unsavedAt,\n          saved: false,",
        "          unsavedAt,\n          updatedAtMs: unsavedAt,\n          saved: false,",
        'unsave updatedAtMs',
    )
    app = replace_once(
        app,
        "        if (isFavoriteHidden(existingFav)) {\n          const restoreUpdates = {",
        "        if (isFavoriteHidden(existingFav)) {\n          const restoredAt = Date.now();\n          const restoreUpdates = {\n            updatedAtMs: restoredAt,",
        'restore updatedAtMs',
    )
    app = replace_once(
        app,
        "          const saveSignal = buildFavoriteSyncSignal('save', { ...song, ...restoreUpdates }, [{ ...existingFav, ...restoreUpdates }], Date.now());",
        "          const saveSignal = buildFavoriteSyncSignal('save', { ...song, ...restoreUpdates }, [{ ...existingFav, ...restoreUpdates }], restoredAt);",
        'restore signal timestamp',
    )
    old_normal_update = "    try {\n      await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);\n      const favoriteUpdatedAtMs = Date.now();"
    normal_update = "    try {\n      const favoriteUpdatedAtMs = Date.now();\n      sanitizedUpdates = sanitizeForFirestore({ ...sanitizedUpdates, updatedAtMs: favoriteUpdatedAtMs });\n      await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);"
    boundary_normal_update = "    try {\n      await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user?.uid || currentFavorite?.uid || '', documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), sanitizedUpdates));\n      const favoriteUpdatedAtMs = Date.now();"
    boundary_normal_update_with_version = "    try {\n      const favoriteUpdatedAtMs = Date.now();\n      sanitizedUpdates = sanitizeForFirestore({ ...sanitizedUpdates, updatedAtMs: favoriteUpdatedAtMs });\n      await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user?.uid || currentFavorite?.uid || '', documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), sanitizedUpdates));"
    if app.count(old_normal_update) == 1 and app.count(boundary_normal_update) == 0:
        app = app.replace(old_normal_update, normal_update, 1)
    elif app.count(old_normal_update) == 0 and app.count(boundary_normal_update) == 1:
        app = app.replace(boundary_normal_update, boundary_normal_update_with_version, 1)
        print('SORIDRAW 901 normal update adapted to V1 mutation boundary')
    elif app.count(boundary_normal_update_with_version) == 1:
        print('SORIDRAW 901 normal update updatedAtMs already present; no-op')
    else:
        raise SystemExit('normal update updatedAtMs semantic mismatch')

    # Every existing compact favorite signal write advances the prepared
    # syncVersions.musicNote field without replacing sibling syncVersions fields.
    pattern = re.compile(r"(favoriteSyncSignalUpdatedAt:\s*([A-Za-z0-9_.$?]+),)")
    def add_version(match: re.Match) -> str:
        return match.group(1) + "\n            'syncVersions.musicNote': " + match.group(2) + ","
    app, version_write_count = pattern.subn(add_version, app)
    if version_write_count < 4:
        raise SystemExit(f'music note version write count too small: {version_write_count}')

    # Clear-all now publishes one cumulative delete signal so another device can
    # remove all deleted cached ids through the existing users listener.
    clear_old = "      await batch.commit();\n      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);"
    clear_boundary_old = "      await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-delete', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());\n      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);"
    clear_new_body = '''      const deletedAt = Date.now();
      const deletedFavorites = unlockedDocs.map(mapFavoriteFirestoreDoc);
      rememberFavoriteDeletedTombstones(user.uid, deletedFavorites.map((favorite) => favorite.id).filter(Boolean));
      const deleteSignal = buildFavoriteSyncSignal('delete', deletedFavorites[0] || {}, deletedFavorites, deletedAt);
      applyFavoriteSyncSignal(user.uid, deleteSignal);
      await updateDoc(doc(db, 'users', user.uid), {
        favoriteSyncSignal: deleteSignal,
        favoriteSyncSignalUpdatedAt: deletedAt,
        'syncVersions.musicNote': deletedAt,
      });
      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);'''
    clear_new = "      await batch.commit();\n" + clear_new_body
    clear_boundary_new = "      await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-delete', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());\n" + clear_new_body
    if app.count(clear_old) == 1 and app.count(clear_boundary_old) == 0:
        app = app.replace(clear_old, clear_new, 1)
    elif app.count(clear_old) == 0 and app.count(clear_boundary_old) == 1:
        app = app.replace(clear_boundary_old, clear_boundary_new, 1)
        print('SORIDRAW 901 clear-all adapted to V1 mutation boundary')
    else:
        raise SystemExit('clear all delete signal semantic mismatch')

    app = app.replace(
        "// In paged loading mode, never rely on the currently visible 20-item slice for destructive all-item actions.",
        "// In paged loading mode, never rely on the currently visible 10-item slice for destructive all-item actions.",
        1,
    )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 901 App: exact-10 cache-first + incremental sync + full manual recovery.')
else:
    print('SORIDRAW 901 App already applied.')


# -----------------------------------------------------------------------------
# FavoritesPage.tsx — visible batch 10 + existing Sync button becomes recovery
# -----------------------------------------------------------------------------
favorites_path = Path('src/pages/FavoritesPage.tsx')
favorites = favorites_path.read_text(encoding='utf-8')

if MARKER not in favorites:
    favorites = replace_once(favorites, "const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 20;", "const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 10;", 'visible batch 10')
    favorites = replace_once(
        favorites,
        "    if (!onManualSyncFavorites || isManualSyncingFavorites || isManualSyncUsedToday) return;",
        "    if (!onManualSyncFavorites || isManualSyncingFavorites) return;",
        'manual sync guard',
    )
    favorites = replace_once(
        favorites,
        "      if (result?.ok || result?.limited) setIsManualSyncUsedToday(true);\n",
        "",
        'remove daily-used state update',
    )
    favorites = replace_once(
        favorites,
        "          disabled={!onManualSyncFavorites || isManualSyncingFavorites || isManualSyncUsedToday}",
        "          disabled={!onManualSyncFavorites || isManualSyncingFavorites}",
        'sync button disabled state',
    )
    favorites = replace_once(
        favorites,
        "            description: isManualSyncUsedToday ? '오늘 수동 동기화 1회를 이미 사용했습니다.' : '서버의 최신 뮤직노트 20개를 다시 확인합니다. 하루 1회만 사용할 수 있습니다.',",
        "            description: '서버와 현재 기기의 뮤직노트를 전체 대조해 추가·수정·삭제 상태를 다시 맞춥니다.',",
        'sync tooltip',
    )
    favorites = replace_once(
        favorites,
        '''            isManualSyncingFavorites
              ? "cursor-wait text-[#FFBB22]"
              : isManualSyncUsedToday
                ? "cursor-not-allowed opacity-35"
                : "hover:bg-white/[0.09] hover:text-[#FFBB22]"
          )}
          title={isManualSyncUsedToday ? '오늘 동기화 1회 사용 완료' : '뮤직노트 동기화'}''',
        '''            isManualSyncingFavorites
              ? "cursor-wait text-[#FFBB22]"
              : "hover:bg-white/[0.09] hover:text-[#FFBB22]"
          )}
          title="뮤직노트 전체 동기화"''',
        'sync button daily visual removal',
    )
    favorites = favorites.replace(
        "description: '곡을 20개 더 불러오거나 보여줍니다.'",
        "description: '곡을 10개 더 불러오거나 보여줍니다.'",
        1,
    )
    favorites = replace_once(
        favorites,
        "const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 10;\n",
        "const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 10;\nconst SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC = true;\n",
        'favorites marker',
    )
    favorites_path.write_text(favorites, encoding='utf-8')
    print('Applied SORIDRAW 901 FavoritesPage: 10-item display + full recovery Sync button.')
else:
    print('SORIDRAW 901 FavoritesPage already applied.')

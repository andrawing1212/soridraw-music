from pathlib import Path

MARKER = 'SORIDRAW_917_MUSIC_NOTE_DELTA_SYNC_NO_FULLSCAN'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # ------------------------------------------------------------------
    # 1) Never let an older latest-20 bundle overwrite a newer local
    # favorite that was just saved on this device. The local newer row is
    # merged first; because the Music Note bundle is active on /history,
    # writeFavoritesCache can then refresh the bundle through the existing
    # deduped path only when the payload actually differs.
    # ------------------------------------------------------------------
    bundle_old = '''            const firstPageFavs = (bundle.items || []).filter((favorite: any) => !isFavoriteSoftRemoved(favorite));
            favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
            favoritePaginationExhaustedRef.current = !bundle.hasMore;
            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(bundle.hasMore);
            setFavorites((prev) => {
              const merged = mergeFavoriteFirstPageWithCache(firstPageFavs, prev || [], !bundle.hasMore);
              writeFavoritesCache(currentUser.uid, merged);
              return merged;
            });
            if (bundle.updatedAtMs > 0) {
              writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, currentUser.uid, bundle.updatedAtMs);
            }
'''
    bundle_new = '''            const localDeletedIds = getFavoriteDeletedTombstoneIds(currentUser.uid);
            const firstPageFavs = (bundle.items || []).filter((favorite: any) => {
              if (isFavoriteSoftRemoved(favorite)) return false;
              const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
              return !favoriteId || !localDeletedIds.has(favoriteId);
            });
            favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
            favoritePaginationExhaustedRef.current = !bundle.hasMore;
            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(bundle.hasMore);
            setFavorites((prev) => {
              const previous = Array.isArray(prev) ? prev : [];
              const bundleVersion = Number(bundle.updatedAtMs || 0);
              const localNewer = previous.filter((favorite: any) => {
                if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
                const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                if (favoriteId && localDeletedIds.has(favoriteId)) return false;
                const favoriteVersion = Number(favorite?.updatedAtMs || favorite?.createdAtMs || 0)
                  || getTimestampMs(favorite?.updatedAt)
                  || getTimestampMs(favorite?.createdAt)
                  || 0;
                return bundleVersion > 0 && favoriteVersion > bundleVersion;
              });
              const firstPageWithLocalNewer = mergeFavoritePages(localNewer, firstPageFavs);
              const merged = mergeFavoriteFirstPageWithCache(firstPageWithLocalNewer, previous, !bundle.hasMore);
              writeFavoritesCache(currentUser.uid, merged);
              return merged;
            });
            if (bundle.updatedAtMs > 0) {
              const currentLocalVersion = readMusicNoteSyncVersion(
                MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE,
                currentUser.uid,
              );
              writeMusicNoteSyncVersion(
                MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE,
                currentUser.uid,
                Math.max(currentLocalVersion, Number(bundle.updatedAtMs || 0)),
              );
            }
'''
    app = replace_once(app, bundle_old, bundle_new, '917 preserve newer local Music Note rows')

    # ------------------------------------------------------------------
    # 2) Replace the dangerous manual full-collection recovery with a
    # change-gated single bundle read. No-change uses the already-existing
    # user sync-version signal and costs zero favorites reads. If a change
    # exists, only the one latest-20 cache document is read; it is then
    # diff-merged into local state. There is no collection-wide getDocs.
    # ------------------------------------------------------------------
    manual_start = app.find("  const refreshFavoritesFromServerFirstPage = useCallback(async (): Promise<{ ok: boolean; limited?: boolean; message?: string }> => {")
    manual_end = app.find("\n\n  const showToast = useCallback", manual_start)
    if manual_start < 0 or manual_end < 0:
        raise SystemExit('917 manual sync block anchors missing')

    manual = '''  const refreshFavoritesFromServerFirstPage = useCallback(async (): Promise<{ ok: boolean; limited?: boolean; message?: string }> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) {
      return { ok: false, message: '로그인이 필요합니다.' };
    }

    const uid = currentUser.uid;
    const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
    const remoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, uid);

    // The existing users/{uid} listener already carries the tiny change-version
    // signal. If local is current, do not read favorites or the bundle at all.
    if (remoteVersion > 0 && localVersion >= remoteVersion) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
      return { ok: true, message: '변경된 뮤직노트가 없습니다.' };
    }

    return await new Promise((resolve) => {
      let settled = false;
      let cancel = () => {};
      const finish = (result: { ok: boolean; limited?: boolean; message?: string }) => {
        if (settled) return;
        settled = true;
        try { cancel(); } catch {}
        resolve(result);
      };

      cancel = subscribeListBundle('musicNote', uid, {
        onData: (bundle) => {
          try {
            const localDeletedIds = getFavoriteDeletedTombstoneIds(uid);
            if (bundle.deletedIds.length > 0) {
              rememberFavoriteDeletedTombstones(uid, bundle.deletedIds);
              bundle.deletedIds.forEach((id) => localDeletedIds.add(id));
            }

            const incoming = (bundle.items || []).filter((favorite: any) => {
              if (isFavoriteSoftRemoved(favorite)) return false;
              const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
              return !favoriteId || !localDeletedIds.has(favoriteId);
            });
            const previous = favoritesStore.getFavorites();
            const bundleVersion = Number(bundle.updatedAtMs || 0);
            const localNewer = (Array.isArray(previous) ? previous : []).filter((favorite: any) => {
              if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
              const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
              if (favoriteId && localDeletedIds.has(favoriteId)) return false;
              const favoriteVersion = Number(favorite?.updatedAtMs || favorite?.createdAtMs || 0)
                || getTimestampMs(favorite?.updatedAt)
                || getTimestampMs(favorite?.createdAt)
                || 0;
              return bundleVersion > 0 && favoriteVersion > bundleVersion;
            });
            const mergedFirstPage = mergeFavoritePages(localNewer, incoming);
            const merged = mergeFavoriteFirstPageWithCache(
              mergedFirstPage,
              Array.isArray(previous) ? previous : [],
              !bundle.hasMore,
            );

            setFavorites(merged);
            writeFavoritesCache(uid, merged);
            favoritesStore.setFavorites(merged);
            favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0
              ? new Date(bundle.cursorCreatedAtMs)
              : null;
            favoritePaginationExhaustedRef.current = !bundle.hasMore;
            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(bundle.hasMore);

            const currentLocalVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
            const nextLocalVersion = Math.max(currentLocalVersion, bundleVersion);
            if (nextLocalVersion > 0) {
              writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, nextLocalVersion);
            }

            // One bundle document read, regardless of whether it contains 1 or 20
            // visible rows. Never count/perform a full favorites collection scan.
            markCacheDiagnostic('musicNote', 'SYNC', 1);

            if (remoteVersion > 0 && bundleVersion > 0 && bundleVersion < remoteVersion && nextLocalVersion < remoteVersion) {
              finish({ ok: true, message: '변경 신호를 확인했습니다. 최신 변경분은 다음 묶음 갱신에서 반영됩니다.' });
              return;
            }
            finish({ ok: true, message: '변경된 뮤직노트만 동기화했습니다.' });
          } catch (error) {
            console.warn('Music Note delta bundle merge failed.', error);
            finish({ ok: false, message: '변경분 동기화에 실패했습니다.' });
          }
        },
        onMissing: () => {
          finish({ ok: false, message: '뮤직노트 변경 캐시가 아직 준비되지 않았습니다.' });
        },
        onError: (error) => {
          console.warn('Music Note delta bundle read failed.', error);
          finish({ ok: false, message: '변경분 동기화에 실패했습니다.' });
        },
      });
    });
  }, [user]);'''

    app = app[:manual_start] + manual + app[manual_end:]

    marker_anchor = 'const SORIDRAW_915_HEART_EXPLICIT_UNSAVE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('917 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 917: Music Note manual sync is change-gated and never full-scans favorites.')
else:
    print('SORIDRAW 917 already applied.')


# ----------------------------------------------------------------------
# FavoritesPage — describe the button truthfully as change-only sync.
# ----------------------------------------------------------------------
favorites_path = Path('src/pages/FavoritesPage.tsx')
favorites = favorites_path.read_text(encoding='utf-8')
if MARKER not in favorites:
    favorites = favorites.replace(
        "            description: '서버와 현재 기기의 뮤직노트를 전체 대조해 추가·수정·삭제 상태를 다시 맞춥니다.',",
        "            description: '변경 신호가 있을 때만 최신 변경분을 확인합니다. 전체 곡을 다시 읽지 않습니다.',",
        1,
    )
    favorites = favorites.replace('          title="뮤직노트 전체 동기화"', '          title="뮤직노트 변경분 동기화"', 1)
    favorites = favorites.replace(
        'const SORIDRAW_902_LIST_BUNDLE_CACHE = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_902_LIST_BUNDLE_CACHE = true;\n',
        1,
    )
    favorites_path.write_text(favorites, encoding='utf-8')
    print('Applied SORIDRAW 917 FavoritesPage: Sync is labeled as delta-only.')

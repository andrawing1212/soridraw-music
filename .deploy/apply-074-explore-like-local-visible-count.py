from pathlib import Path

page_path = Path('src/pages/ExplorePage.tsx')
service_path = Path('src/services/exploreLikeService.ts')
version_path = Path('public/app-version.json')

page = page_path.read_text(encoding='utf-8')
service = service_path.read_text(encoding='utf-8')
version = version_path.read_text(encoding='utf-8')

marker = 'SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912'

if marker not in service:
    service = service.replace(
        '// SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n',
        '// SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n',
        1,
    )

    service = service.replace(
        '''type ExploreLikeSyncEventDetail = {\n  trackId: string;\n  ownerUid: string;\n  liked: boolean;\n  likeCount: number;\n};''',
        '''type ExploreLikeSyncEventDetail = {\n  trackId: string;\n  ownerUid: string;\n  liked: boolean;\n  likeCount: number;\n  displayLikeCount?: number;\n};''',
        1,
    )

    service = service.replace(
        '''type ExploreLikeAccountSyncResult = ExploreLikeBatchResult & {\n  ownerUid: string;\n};''',
        '''type ExploreLikeAccountSyncResult = ExploreLikeBatchResult & {\n  ownerUid: string;\n  displayLikeCount?: number;\n};''',
        1,
    )

    old = '''    results.push({\n      trackId,\n      ownerUid: String(item.ownerUid || '').trim(),\n      liked: Boolean(item.liked),\n      likeCount: clampLikeCount(item.likeCount),\n    });'''
    new = '''    const displayLikeCount = Number(item.displayLikeCount);\n    results.push({\n      trackId,\n      ownerUid: String(item.ownerUid || '').trim(),\n      liked: Boolean(item.liked),\n      likeCount: clampLikeCount(item.likeCount),\n      ...(Number.isFinite(displayLikeCount) ? { displayLikeCount: clampLikeCount(displayLikeCount) } : {}),\n    });'''
    if old not in service:
        raise SystemExit('074 normalize signal anchor missing')
    service = service.replace(old, new, 1)

    old = '''    next[trackId] = {\n      trackId,\n      ownerUid: String(patch.ownerUid || '').trim(),\n      liked: patch.liked,\n      likeCount: clampLikeCount(patch.likeCount),\n      updatedAt: Math.max(0, Number(patch.updatedAt || 0)),\n      expiresAt,\n    };'''
    new = '''    const displayLikeCount = Number(patch.displayLikeCount);\n    next[trackId] = {\n      trackId,\n      ownerUid: String(patch.ownerUid || '').trim(),\n      liked: patch.liked,\n      likeCount: clampLikeCount(patch.likeCount),\n      ...(Number.isFinite(displayLikeCount) ? { displayLikeCount: clampLikeCount(displayLikeCount) } : {}),\n      updatedAt: Math.max(0, Number(patch.updatedAt || 0)),\n      expiresAt,\n    };'''
    if old not in service:
        raise SystemExit('074 patch cache read anchor missing')
    service = service.replace(old, new, 1)

    old = '''      liked: patch.liked,\n      likeCount: patch.likeCount,\n    }));'''
    new = '''      liked: patch.liked,\n      likeCount: patch.likeCount,\n      ...(patch.displayLikeCount === undefined ? {} : { displayLikeCount: patch.displayLikeCount }),\n    }));'''
    if old not in service:
        raise SystemExit('074 patch replay anchor missing')
    service = service.replace(old, new, 1)

    old = '''      liked: result.liked,\n      likeCount: result.likeCount,\n    });\n  }\n  persistLikedStateCache(uid, cache);'''
    new = '''      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }\n  persistLikedStateCache(uid, cache);'''
    if old not in service:
        raise SystemExit('074 account observe dispatch anchor missing')
    service = service.replace(old, new, 1)

    service = service.replace(
        '''  results: ExploreLikeBatchResult[],\n) => {''',
        '''  results: Array<ExploreLikeBatchResult & { displayLikeCount?: number }>,\n) => {''',
        1,
    )

    service = service.replace(
        '    const accountSyncResults: ExploreLikeBatchResult[] = [];',
        '    const accountSyncResults: Array<ExploreLikeBatchResult & { displayLikeCount?: number }> = [];',
        1,
    )

    old = '''      let visibleLiked = pending.desiredLiked;\n      let visibleLikeCount = result.likeCount;\n      let ownerUid = pending.ownerUid;'''
    new = '''      let visibleLiked = pending.desiredLiked;\n      let visibleLikeCount = pending.optimisticLikeCount;\n      let ownerUid = pending.ownerUid;'''
    if old not in service:
        raise SystemExit('074 visible result anchor missing')
    service = service.replace(old, new, 1)

    old = '''        visibleLiked = latest.desiredLiked;\n        visibleLikeCount = result.likeCount;'''
    new = '''        visibleLiked = latest.desiredLiked;\n        visibleLikeCount = latest.optimisticLikeCount;'''
    if old not in service:
        raise SystemExit('074 latest visible count anchor missing')
    service = service.replace(old, new, 1)

    old = '''      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: visibleLikeCount,\n      };'''
    new = '''      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: result.likeCount,\n        displayLikeCount: visibleLikeCount,\n      };'''
    if old not in service:
        raise SystemExit('074 visible result object anchor missing')
    service = service.replace(old, new, 1)

    old = '''  // 069: keep the last aggregate-confirmed public number until the\n  // deferred server aggregate changes it.\n  const optimisticLikeCount = clampLikeCount(currentLikeCount);'''
    new = '''  // 074: public canonical count is still server-aggregated, but the person who\n  // clicked sees the expected +/- immediately. This is local display state only.\n  const optimisticLikeCount = clampLikeCount(\n    clampLikeCount(currentLikeCount) + (liked ? 1 : -1),\n  );'''
    if old not in service:
        raise SystemExit('074 optimistic count anchor missing')
    service = service.replace(old, new, 1)

if marker not in page:
    page = page.replace(
        '// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912\n',
        '// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912\n// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n',
        1,
    )

    old = '''  useEffect(() => {\n    if (!user?.uid || profileUid || !isExploreFeedRequest(requestUrl) || !tracks.length) return;\n    const staleLikedIds = tracks\n      .filter((track) => track.likeCount === 0 && likedTrackIds[track.id] === true)\n      .map((track) => track.id)\n      .sort();\n    if (!staleLikedIds.length) return;\n    // 072 one-shot repair for rows that already reached canonical count >= 1\n    // under 069/070/071 but this browser still displays the old zero. A newly\n    // clicked like can also match briefly; the persisted aggregate deadline then\n    // remains armed and performs the final post-aggregate refresh.\n    const repairKey = `${user.uid}:${requestUrl}:${staleLikedIds.join(',')}`;\n    if (likeCountRepairKeyRef072.current === repairKey) return;\n    likeCountRepairKeyRef072.current = repairKey;\n    forceLikeCountRefreshRef071.current = true;\n    setFeedRevisionSignal((value) => value + 1);\n  }, [user?.uid, profileUid, requestUrl, tracks, likedTrackIds]);'''
    new = '''  useEffect(() => {\n    if (!user?.uid || profileUid || !isExploreFeedRequest(requestUrl) || !tracks.length) return;\n    const selfLikedZeroTracks = tracks\n      .filter((track) => track.likeCount === 0 && likedTrackIds[track.id] === true);\n    if (!selfLikedZeroTracks.length) return;\n    // 074: a signed-in user who has this track liked must see at least 1\n    // immediately. This is a local-only display floor and causes no server read.\n    // The scheduled aggregate/fresh refresh still replaces it with canonical data.\n    const ids = new Set(selfLikedZeroTracks.map((track) => track.id));\n    setTracks((previous) => previous.map((track) => ids.has(track.id) ? { ...track, likeCount: 1 } : track));\n    for (const track of selfLikedZeroTracks) {\n      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: 1 });\n      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: 1 });\n    }\n  }, [user?.uid, profileUid, requestUrl, tracks, likedTrackIds]);'''
    if old not in page:
        raise SystemExit('074 stale repair effect anchor missing')
    page = page.replace(old, new, 1)

    old = '''      const detail = (event as CustomEvent<{\n        trackId?: string;\n        ownerUid?: string;\n        liked?: boolean;\n        likeCount?: number;\n      }>).detail;'''
    new = '''      const detail = (event as CustomEvent<{\n        trackId?: string;\n        ownerUid?: string;\n        liked?: boolean;\n        likeCount?: number;\n        displayLikeCount?: number;\n      }>).detail;'''
    if old not in page:
        raise SystemExit('074 onLikeSync type anchor missing')
    page = page.replace(old, new, 1)

    old = '''      // Same-account signal changes only the personal heart. Public likeCount\n      // changes only after the deferred aggregate confirms the server value.\n      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));\n      scheduleAggregateCountRefresh071();'''
    new = '''      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));\n      // 074 same-account display: carry only the local optimistic number.\n      // Legacy signals do not include displayLikeCount, so they stay heart-only.\n      const displayLikeCount = Number(detail.displayLikeCount);\n      if (Number.isFinite(displayLikeCount)) {\n        const nextCount = safeCount(displayLikeCount);\n        updateTrackLikeCount(trackId, nextCount);\n        patchExploreFeedSessionCacheRow(requestUrl, trackId, { likeCount: nextCount });\n        const ownerUid = String(detail.ownerUid || '').trim();\n        if (ownerUid) patchExplorePublicProfileFirstViewTrack(ownerUid, trackId, { likeCount: nextCount });\n      }\n      scheduleAggregateCountRefresh071();'''
    if old not in page:
        raise SystemExit('074 onLikeSync body anchor missing')
    page = page.replace(old, new, 1)

    old = '''      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      // Heart changes immediately; public numeric count stays unchanged until\n      // the scheduled aggregate publishes the confirmed count.\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));'''
    new = '''      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      // 074: heart and the clicker's visible number move immediately. Canonical\n      // server count is still confirmed only by the existing deferred aggregate.\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));\n      updateTrackLikeCount(track.id, result.likeCount);\n      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });\n      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: result.likeCount });'''
    if old not in page:
        raise SystemExit('074 toggleLike anchor missing')
    page = page.replace(old, new, 1)

if '"version": "074"' not in version:
    if '"version": "073"' not in version:
        raise SystemExit('073 app version anchor missing')
    version = version.replace('"version": "073"', '"version": "074"', 1)

page_path.write_text(page, encoding='utf-8')
service_path.write_text(service, encoding='utf-8')
version_path.write_text(version, encoding='utf-8')
print('074_TARGETED_APPLY=PASS')

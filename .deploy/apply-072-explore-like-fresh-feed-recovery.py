from pathlib import Path

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_EXPLORE_LIKE_FRESH_FEED_RECOVERY_072_20260912'

if marker not in page:
    const_anchor = """const EXPLORE_LIKE_REFRESH_STORAGE_PREFIX_071 = 'soridraw:explore-like-count-refresh:071:';\n"""
    const_replacement = """const EXPLORE_LIKE_REFRESH_STORAGE_PREFIX_071 = 'soridraw:explore-like-count-refresh:071:';\n// SORIDRAW_EXPLORE_LIKE_FRESH_FEED_RECOVERY_072_20260912\n// A known like-count recovery must not reuse the ordinary versioned Feed URL:\n// that URL can still be held by the HTTP edge cache while canonical D1/R2 is newer.\n// One unique request is allowed only for an actual/persisted like recovery. No polling.\nconst EXPLORE_LIKE_FRESH_FEED_QUERY_072 = '__soridraw_like_refresh';\n"""
    if const_anchor not in page:
        raise SystemExit('072 constants anchor missing')
    page = page.replace(const_anchor, const_replacement, 1)

    url_anchor = """const buildExploreVersionedFeedUrl = (feedUrl: string, revision: string) => {\n  const parsed = new URL(feedUrl);\n  parsed.searchParams.set('__soridraw_revision', revision);\n  return parsed.toString();\n};\n"""
    url_replacement = url_anchor + """\nconst buildExploreFreshLikeFeedUrl072 = (feedUrl: string) => {\n  const parsed = new URL(feedUrl);\n  parsed.searchParams.delete('__soridraw_revision');\n  parsed.searchParams.set(EXPLORE_LIKE_FRESH_FEED_QUERY_072, `${Date.now()}`);\n  return parsed.toString();\n};\n"""
    if url_anchor not in page:
        raise SystemExit('072 URL helper anchor missing')
    page = page.replace(url_anchor, url_replacement, 1)

    refs_anchor = """  const forceLikeCountRefreshRef071 = useRef(false);\n"""
    refs_replacement = """  const forceLikeCountRefreshRef071 = useRef(false);\n  const likeCountRepairKeyRef072 = useRef('');\n"""
    if refs_anchor not in page:
        raise SystemExit('072 ref anchor missing')
    page = page.replace(refs_anchor, refs_replacement, 1)

    revalidate_anchor = """          try {\n            const serverRevision = await fetchRevision();\n            if (!serverRevision || controller.signal.aborted) return;\n            const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);\n            if (cachedRevision === serverRevision && !forceLikeCountRefresh071) return;\n            const payload = await fetchPayload(buildExploreVersionedFeedUrl(requestUrl, serverRevision));\n            if (controller.signal.aborted) return;\n            applyPayload(payload, serverRevision);\n          } catch (reason) {\n"""
    revalidate_replacement = """          try {\n            if (forceLikeCountRefresh071) {\n              // 072: bypass only the HTTP Feed cache key for a confirmed recovery.\n              // The Worker still uses the normal derived R2/D1 path underneath.\n              const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);\n              const payload = await fetchPayload(buildExploreFreshLikeFeedUrl072(requestUrl));\n              if (controller.signal.aborted) return;\n              applyPayload(payload, cachedRevision);\n              return;\n            }\n            const serverRevision = await fetchRevision();\n            if (!serverRevision || controller.signal.aborted) return;\n            const cachedRevision = readExploreFeedSessionCacheRevision(requestUrl);\n            if (cachedRevision === serverRevision) return;\n            const payload = await fetchPayload(buildExploreVersionedFeedUrl(requestUrl, serverRevision));\n            if (controller.signal.aborted) return;\n            applyPayload(payload, serverRevision);\n          } catch (reason) {\n"""
    if revalidate_anchor not in page:
        raise SystemExit('072 revalidation anchor missing')
    page = page.replace(revalidate_anchor, revalidate_replacement, 1)

    clear_anchor = """      if (feedRequest && forceLikeCountRefresh071) {\n        forceLikeCountRefreshRef071.current = false;\n        clearExploreLikeRefreshDeadline071(auth.currentUser?.uid || '');\n      }\n"""
    clear_replacement = """      if (feedRequest && forceLikeCountRefresh071) {\n        forceLikeCountRefreshRef071.current = false;\n        const refreshUid = auth.currentUser?.uid || '';\n        const deadline = readExploreLikeRefreshDeadline071(refreshUid);\n        // An immediate 072 stale-cache repair can happen before the scheduled\n        // aggregate. Preserve its deadline so reloads still get the final refresh.\n        if (!deadline || Date.now() >= deadline) clearExploreLikeRefreshDeadline071(refreshUid);\n      }\n"""
    if clear_anchor not in page:
        raise SystemExit('072 deadline cleanup anchor missing')
    page = page.replace(clear_anchor, clear_replacement, 1)

    hydration_tail = """  }, [user, visibleTracks, profileUid, likeAccountSyncSignal]);\n\n  useEffect(() => {\n    if (!searchOpen) return;\n"""
    hydration_replacement = """  }, [user, visibleTracks, profileUid, likeAccountSyncSignal]);\n\n  useEffect(() => {\n    if (!user?.uid || profileUid || !isExploreFeedRequest(requestUrl) || !tracks.length) return;\n    const staleLikedIds = tracks\n      .filter((track) => track.likeCount === 0 && likedTrackIds[track.id] === true)\n      .map((track) => track.id)\n      .sort();\n    if (!staleLikedIds.length) return;\n    // 072 one-shot repair for rows that already reached canonical count >= 1\n    // under 069/070/071 but this browser still displays the old zero. A newly\n    // clicked like can also match briefly; the persisted aggregate deadline then\n    // remains armed and performs the final post-aggregate refresh.\n    const repairKey = `${user.uid}:${requestUrl}:${staleLikedIds.join(',')}`;\n    if (likeCountRepairKeyRef072.current === repairKey) return;\n    likeCountRepairKeyRef072.current = repairKey;\n    forceLikeCountRefreshRef071.current = true;\n    setFeedRevisionSignal((value) => value + 1);\n  }, [user?.uid, profileUid, requestUrl, tracks, likedTrackIds]);\n\n  useEffect(() => {\n    if (!searchOpen) return;\n"""
    if hydration_tail not in page:
        raise SystemExit('072 stale-like repair anchor missing')
    page = page.replace(hydration_tail, hydration_replacement, 1)

    page_path.write_text(page, encoding='utf-8')

version_path = Path('public/app-version.json')
version = version_path.read_text(encoding='utf-8')
if '"version": "072"' not in version:
    if '"version": "071"' not in version:
        raise SystemExit('071 app version anchor missing')
    version_path.write_text(version.replace('"version": "071"', '"version": "072"', 1), encoding='utf-8')

print('072_TARGETED_APPLY=PASS')

from pathlib import Path

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_EXPLORE_LIKE_AGGREGATE_AUTO_REFRESH_070_20260912'

if marker not in page:
    old_consts = """const EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 1000;\nconst EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 30_000;\n"""
    new_consts = """const EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 1000;\nconst EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 30_000;\n// SORIDRAW_EXPLORE_LIKE_AGGREGATE_AUTO_REFRESH_070_20260912\n// Revalidate once after the next 10-minute aggregate window. The extra grace\n// covers the revision endpoint's short edge cache without polling.\nconst EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070 = 10 * 60_000;\nconst EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070 = 70_000;\n"""
    if old_consts not in page:
        raise SystemExit('070 constants anchor missing')
    page = page.replace(old_consts, new_consts, 1)

    old_effect = """  // SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n  useEffect(() => {\n    const onLikeSync = (event: Event) => {\n      const detail = (event as CustomEvent<{\n        trackId?: string;\n        ownerUid?: string;\n        liked?: boolean;\n        likeCount?: number;\n      }>).detail;\n      const trackId = String(detail?.trackId || '').trim();\n      if (!trackId || typeof detail?.liked !== 'boolean') return;\n      // Same-account signal changes only the personal heart. Public likeCount\n      // changes only when the deferred aggregate/feed delta confirms it.\n      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));\n    };\n    const onLikeSyncError = (event: Event) => {\n      const detail = (event as CustomEvent<{ message?: string }>).detail;\n      setSocialNotice(String(detail?.message || '좋아요 서버 동기화를 재시도하고 있어요.'));\n    };\n    window.addEventListener(EXPLORE_LIKE_SYNC_EVENT, onLikeSync as EventListener);\n    window.addEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);\n    return () => {\n      window.removeEventListener(EXPLORE_LIKE_SYNC_EVENT, onLikeSync as EventListener);\n      window.removeEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);\n    };\n  }, [requestUrl]);\n"""
    new_effect = """  // SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n  useEffect(() => {\n    let aggregateRefreshTimer: number | null = null;\n\n    const scheduleAggregateCountRefresh070 = () => {\n      if (profileUid || !isExploreFeedRequest(requestUrl)) return;\n      const now = Date.now();\n      const nextAggregateAt = Math.ceil((now + 1000) / EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070)\n        * EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070;\n      const delay = Math.max(1000, nextAggregateAt + EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070 - now);\n      if (aggregateRefreshTimer !== null) window.clearTimeout(aggregateRefreshTimer);\n      aggregateRefreshTimer = window.setTimeout(() => {\n        aggregateRefreshTimer = null;\n        // Hidden tabs keep zero-read behavior; the existing visibility/focus path\n        // performs the revision check when the user actually returns.\n        if (document.visibilityState !== 'visible') return;\n        setFeedRevisionSignal((value) => value + 1);\n      }, delay);\n    };\n\n    const onLikeSync = (event: Event) => {\n      const detail = (event as CustomEvent<{\n        trackId?: string;\n        ownerUid?: string;\n        liked?: boolean;\n        likeCount?: number;\n      }>).detail;\n      const trackId = String(detail?.trackId || '').trim();\n      if (!trackId || typeof detail?.liked !== 'boolean') return;\n      // Same-account signal changes only the personal heart. Public likeCount\n      // changes only when the deferred aggregate/feed delta confirms it.\n      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));\n      scheduleAggregateCountRefresh070();\n    };\n    const onLikeSyncError = (event: Event) => {\n      const detail = (event as CustomEvent<{ message?: string }>).detail;\n      setSocialNotice(String(detail?.message || '좋아요 서버 동기화를 재시도하고 있어요.'));\n    };\n    window.addEventListener(EXPLORE_LIKE_SYNC_EVENT, onLikeSync as EventListener);\n    window.addEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);\n    return () => {\n      if (aggregateRefreshTimer !== null) window.clearTimeout(aggregateRefreshTimer);\n      window.removeEventListener(EXPLORE_LIKE_SYNC_EVENT, onLikeSync as EventListener);\n      window.removeEventListener(EXPLORE_LIKE_SYNC_ERROR_EVENT, onLikeSyncError as EventListener);\n    };\n  }, [requestUrl, profileUid]);\n"""
    if old_effect not in page:
        raise SystemExit('070 like sync effect anchor missing')
    page = page.replace(old_effect, new_effect, 1)
    page_path.write_text(page, encoding='utf-8')

version_path = Path('public/app-version.json')
version = version_path.read_text(encoding='utf-8')
if '"version": "070"' not in version:
    if '"version": "069"' not in version:
        raise SystemExit('069 app version anchor missing')
    version_path.write_text(version.replace('"version": "069"', '"version": "070"', 1), encoding='utf-8')

print('070_TARGETED_APPLY=PASS')

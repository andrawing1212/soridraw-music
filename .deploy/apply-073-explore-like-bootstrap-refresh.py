from pathlib import Path

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912'

if marker not in page:
    marker_anchor = """const EXPLORE_LIKE_FRESH_FEED_QUERY_072 = '__soridraw_like_refresh';\n"""
    marker_replacement = marker_anchor + """// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912\n// Forced like-count recovery must use the unique fresh Feed URL even when this\n// browser has no session Feed cache yet (for example immediately after app update).\n"""
    if marker_anchor not in page:
        raise SystemExit('073 marker anchor missing')
    page = page.replace(marker_anchor, marker_replacement, 1)

    bootstrap_anchor = """        if (feedRequest) {\n          const serverRevision = await fetchRevision().catch((reason) => {\n            if (!controller.signal.aborted) {\n              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);\n            }\n            return null;\n          });\n          const payload = await fetchPayload(\n            serverRevision ? buildExploreVersionedFeedUrl(requestUrl, serverRevision) : requestUrl,\n          );\n          if (controller.signal.aborted) return;\n          applyPayload(payload, serverRevision);\n          return;\n        }\n"""
    bootstrap_replacement = """        if (feedRequest) {\n          if (forceLikeCountRefresh071) {\n            // 073: 072 handled only the cachedRows branch. After an app update\n            // session cache can be empty, so the old bootstrap path reused the\n            // ordinary versioned Feed and could restore a stale public count.\n            const payload = await fetchPayload(buildExploreFreshLikeFeedUrl072(requestUrl));\n            if (controller.signal.aborted) return;\n            applyPayload(payload, readExploreFeedSessionCacheRevision(requestUrl));\n            return;\n          }\n          const serverRevision = await fetchRevision().catch((reason) => {\n            if (!controller.signal.aborted) {\n              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);\n            }\n            return null;\n          });\n          const payload = await fetchPayload(\n            serverRevision ? buildExploreVersionedFeedUrl(requestUrl, serverRevision) : requestUrl,\n          );\n          if (controller.signal.aborted) return;\n          applyPayload(payload, serverRevision);\n          return;\n        }\n"""
    if bootstrap_anchor not in page:
        raise SystemExit('073 bootstrap anchor missing')
    page = page.replace(bootstrap_anchor, bootstrap_replacement, 1)

    cached_catch_anchor = """            if (!controller.signal.aborted) {\n              if (forceLikeCountRefresh071) forceLikeCountRefreshRef071.current = false;\n              console.warn('Explore feed revision revalidation failed; keeping cached feed:', reason);\n            }\n"""
    cached_catch_replacement = """            if (!controller.signal.aborted) {\n              if (forceLikeCountRefresh071) {\n                forceLikeCountRefreshRef071.current = false;\n                likeCountRepairKeyRef072.current = '';\n              }\n              console.warn('Explore feed revision revalidation failed; keeping cached feed:', reason);\n            }\n"""
    if cached_catch_anchor not in page:
        raise SystemExit('073 cached catch anchor missing')
    page = page.replace(cached_catch_anchor, cached_catch_replacement, 1)

    outer_catch_anchor = """      } catch (reason: unknown) {\n        if (controller.signal.aborted) return;\n        console.error('Explore feed load failed:', reason);\n"""
    outer_catch_replacement = """      } catch (reason: unknown) {\n        if (controller.signal.aborted) return;\n        if (forceLikeCountRefresh071) {\n          forceLikeCountRefreshRef071.current = false;\n          likeCountRepairKeyRef072.current = '';\n        }\n        console.error('Explore feed load failed:', reason);\n"""
    if outer_catch_anchor not in page:
        raise SystemExit('073 outer catch anchor missing')
    page = page.replace(outer_catch_anchor, outer_catch_replacement, 1)

    page_path.write_text(page, encoding='utf-8')

version_path = Path('public/app-version.json')
version = version_path.read_text(encoding='utf-8')
if '"version": "073"' not in version:
    if '"version": "072"' not in version:
        raise SystemExit('072 app version anchor missing')
    version_path.write_text(version.replace('"version": "072"', '"version": "073"', 1), encoding='utf-8')

print('073_TARGETED_APPLY=PASS')

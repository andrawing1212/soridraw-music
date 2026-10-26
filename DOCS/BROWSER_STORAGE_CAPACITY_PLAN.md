# SORIDRAW Browser Storage Capacity & Data Loss Prevention — app504 plan

Date: 2026-10-26 KST. **Source + web documentation analysis only. Not real-device storage measurement, not migration approval, not deployment.**

## Incident & preserved baseline

The user's mobile Explore -> "다음곡에 적용" aborted before Studio navigation because `localStorage.setItem('pendingAppliedKeywordsBackup', serialized)` threw quota exceeded. The first sessionStorage write succeeded, so manual Studio navigation could still apply the recipe. `src/lib/nextSongPendingBridge.ts` already offered an app468 safe in-memory + session + backup handoff, but Explore and GlobalPlayer bypassed it. PR #496 app503 corrects those two callers; source CI #40314789771 SUCCESS, independent audit and PREVIEW deployment pending. Do **not** assume quota is the root cause of the distinct app501 Music Note canonical missing-song bug; pending local quota is a plausible causal path but real exact-document Firestore status remains unverified. PR #495 app502 is a separate frozen, non-destructive single-document diagnostic awaiting independent audit.

Do not delete, unsave, migrate, evict, reset, or overwrite unsynced drafts/outbox, original PC favorite evidence, Auth data, user content, library, or retained photos/music.

## What the actual current source reveals (not measured client usage)

| Source | Stored data and storage | Safety / growth |
| --- | --- | --- |
| `src/lib/soridrawPersistentCache.ts` | `soridraw_cache_envelope_v1` JSON envelopes actually stored in **localStorage** | Repeated search/feed caches may compete for same small Web Storage quota. Some envelopes can mark dirty/pending; no universal automatic deletion safe. |
| `src/services/exploreSessionCache.ts` | Explore search public first-page results use persistent cache envelope and 2-min logical TTL | Entries may occupy quota before expire; expiration must not trigger whole feed reconstruction. |
| `src/lib/studioHeartBatch.ts` | Per-UID `soridraw_studio_heart_pending_v1` outbox in localStorage; up to 20 new entries, each can carry song and baselineFavorite objects | Entry count is bounded, byte size is not. **Critical:** outbox may be the only unsynced local source. Never auto-evict or truncate, even legacy 22+ intents. |
| `src/lib/nextSongPendingBridge.ts` | Memory + session pending keywords + localStorage backup | Bounded next-song handoff; backup quota must never block navigation. If both stores fail, memory is valid only while same-tab SPA remains alive. |
| `src/App.tsx` | Studio Recent/Music Note local-first caches and pending edit state | Must preserve 150-sec Recent editing, 30-sec Studio save-heart per-song, immediate PC/mobile display, authoritative canonical state. |
| `src/components/CacheDiagnosticsOverlayImpl.tsx` | Existing Admin CACHE LIVE diagnostics | app504 adds on-demand storage size audit; no automatic measurement/read; only aggregate sizes and categories, never IDs or raw values. |

### New read-only app504 diagnostic

The Admin / enabled CACHE LIVE panel adds explicit **내 기기 저장량 확인**. Only after click, the browser itself reports:
- LocalStorage approximate UTF-16 sizes per safe categorical bucket, total item count, no raw key or value.
- SessionStorage approximate UTF-16 size.
- `navigator.storage.estimate()` origin-wide approximate usage/quota (may include IndexedDB/Cache and browser padding), not interpreted as the localStorage quota.
- `navigator.storage.persisted()` current status. **No `persist()` call**, no storage writes, deletion, index updates, network, analytics, UID or lyrics exposure.
- Unsupported/denied APIs -> unknown, never 0 or success.

**Limitation:** Source review cannot access the user's authenticated mobile browser's storage. Exact culprit percentages, free quota, users affected, device-specific quota and persistence MUST remain UNVERIFIED until a deliberate on-device diagnostic is run and reviewed.

## Quota facts & how to increase usable storage

1. LocalStorage and sessionStorage are distinct Web Storage buckets (typically about 5 MiB EACH per origin, not combined 10 MiB for localStorage). There is **no supported method to raise localStorage quota** with permission or by changing Firebase hosting/Cloudflare plan.
2. IndexedDB, CacheStorage, OPFS are governed by browser-managed **larger, origin-specific quotas**. Not infinite, may fail due to disk pressure, browser policies, private mode, Safari ITP. Moving only truly large caches after measuring can reduce localStorage pressure; do not migrate unsynced user edits in bulk.
3. `navigator.storage.persist()` may protect against automatic browser eviction if granted, but **does not increase Web Storage localStorage limit**; browsers can deny. Requires separate UX and security review; app504 requests no permission.
4. Browser installed/PWA conditions vary across Safari/WebKit. Never promise native-like permanence; browser/site data deletion or private browsing can remove local data.
5. Device free-space increase may help overall origin quota/pressure but generally won't raise fixed Web Storage quota. CDN/R2 storage likewise does not directly expand a user's browser localStorage.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- https://developer.chrome.com/docs/workbox/understanding-storage-quota
- https://firebase.google.com/docs/firestore/manage-data/enable-offline
- https://learn.microsoft.com/en-gb/microsoft-edge/progressive-web-apps/how-to/best-practices

## Industry patterns (verified official vendor material)

- **Chrome Workbox:** control reconstructible runtime cache growth with `maxEntries`, `maxAgeSeconds`, optionally `purgeOnQuotaError` *only for caches that are safe to discard*. We must not attach purge to unsynced Music Note/Library/Recent/outbox, and must never purge all browser storage.
- **Firebase Firestore offline web:** `persistentLocalCache` uses IndexedDB and supports offline cache; SDK can periodically garbage-collect older unused documents above a configured threshold. This is NOT automatically equivalent to migrating SORIDRAW app-managed localStorage caches or guaranteeing uncommitted custom pending edits.
- **Microsoft Edge PWA:** offline-first graceful handling and selective static/runtime caching; avoid trapping navigation on storage failure.
- **WebKit/Safari:** estimated quotas and persistence heuristics plus proactive eviction rules; assume client storage may vanish without user action, so durable originals need server verification / recovery.

## Required execution order (approval gates)

1. **P0, done source-only:** app503 #496 use existing memory-first next-song bridge in Explore + GlobalPlayer; regression quota-full, both storage blocked, rapid clicks and preserved other data, TS/build, independent Work gate, PREVIEW release before user mobile acceptance.
2. **P0, code+CI before release:** app504 Admin-only manual capacity measurement. No automatic scans or site-wide purge. Independent audit + PREVIEW release required. Compare existing PC, Android Chrome, iOS Safari/PWA, new browser with consent. Report size buckets, not private contents.
3. **P1, next engineering:** add narrowly-scoped quota failure awareness to the actual unsynced writer paths (Studio heart, Recent edits, Library) **without false success**. Test exactly which writes fail and preserve current outboxes, +30s and +150s rules, recovery across reload/new tab, cross-device correctness; no global catcher that swallows uncommitted loss.
4. **P1, after measured sizes:** add explicit byte budget and bounded retention ONLY to provably reconstructible public Explore search/feed caches, with schema-version backward compatibility and no automatic app-version invalidation. Retain cache-hit/R0 revisit contract where within budget; no delete for dirty/pending/originals. Existing `removeSoridrawPersistentCachesBySourceType` is not general storage cleanup permission.
5. **P2, dedicated high-risk branch:** evaluate additive IndexedDB storage for **reconstructible public caches first**, then evaluate user-origin local-first data only with two-phase write/read-back, legacy fallback, crash and quota failure tests, multi-tab and old PREVIEW/TEST/PRODUCTION client compatibility. An IndexedDB move is NOT approved by this plan. Shared canonical user originals remain separate; no blanket migration or backfill.
6. **P2, opt-in:** after proof, evaluate user-gesture `navigator.storage.persist()` with clear label and persisted status; do not promise extra localStorage capacity. Permission changes must not be silently requested on app entry.
7. **Release check:** 3 origins, PC + Android Chrome + iOS Safari/PWA, old-cache upgrade + new browser, correct titles/lyrics/next-song recipes, Music Note saved hearts, Library, profile/likes; storage full before click and during save; close/relaunch after pending; server reads/writes costs; TypeScript/Build/Test; independent PASS -> PREVIEW real-device PASS -> separately authorized TEST -> separately authorized PRODUCTION.

## Decision constraints

No mass migration, user-data deletion, client-wide storage.clear(), browser reset instruction, full Firestore/D1 reread, broad cache invalidation or paid page-entry requests. P0 app504 diagnostic is read-only and exposes no content; source CI does NOT constitute measured real-device capacity.

Current releases: preview live app501 with user QA FAIL; TEST/main and PRODUCTION unchanged, Stage416/Reader OFF. Keep #495 and #496 PRs separate for exact-SHA audit.

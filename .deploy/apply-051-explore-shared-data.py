from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'{label}: anchor not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) Public-profile device cache: invalidate the old per-environment cache contract
# once, then use a short background revision window. Cold schema-6 loads force the
# server to materialize from the shared canonical D1 before caching locally.
replace_once(
    'src/services/exploreProfileFirstViewService.ts',
    'const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 5;\nconst PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS = 60_000;',
    'const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6;\nconst PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS = 10_000;',
    'profile cache schema/revalidate',
)
replace_once(
    'src/services/exploreProfileFirstViewService.ts',
    "    // One cold request after 048 may repair an old per-environment Profile R2 snapshot.\n    // Warm revision checks do not carry this flag, so normal revisits add no new D1 read.\n    url.searchParams.set('__soridraw_profile_parity', '48');",
    "    // 051: one cold request after the cache-contract bump re-materializes the\n    // public profile from the single shared canonical D1. Warm revision checks stay cheap.\n    url.searchParams.set('__soridraw_shared_profile', '51');",
    'profile cold shared repair',
)

# 2) Feed cold boot: resolve revision first. The old concurrent request could receive
# a stale feed while the revision endpoint rebuilt R2, then incorrectly cache that
# stale payload under the new revision.
old_feed = '''        if (feedRequest) {
          const revisionTask = fetchRevision().catch((reason) => {
            if (!controller.signal.aborted) {
              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);
            }
            return null;
          });
          const payload = await fetchPayload(requestUrl);
          const serverRevision = await revisionTask;
          if (controller.signal.aborted) return;
          applyPayload(payload, serverRevision);
          return;
        }
'''
new_feed = '''        if (feedRequest) {
          const serverRevision = await fetchRevision().catch((reason) => {
            if (!controller.signal.aborted) {
              console.warn('Explore feed revision bootstrap failed; continuing with feed:', reason);
            }
            return null;
          });
          const payload = await fetchPayload(
            serverRevision ? buildExploreVersionedFeedUrl(requestUrl, serverRevision) : requestUrl,
          );
          if (controller.signal.aborted) return;
          applyPayload(payload, serverRevision);
          return;
        }
'''
replace_once('src/pages/ExplorePage.tsx', old_feed, new_feed, 'feed cold revision-first')

# 3) Durable production preparation for the eventual 051 promotion. Production uses
# the same physical resources for canonical data/cache/rate DB, while PREVIEW/TEST
# deploy configs can point EXPLORE_CACHE/RATE_DB at their environment-local stores.
replace_once(
    'cloudflare/explore-worker/scripts/prepare-from-dashboard.mjs',
    "  d1_databases: [{ binding: 'DB', database_name: D1_DATABASE_NAME, database_id: databaseId }],\n  r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: R2_BUCKET_NAME }],",
    "  d1_databases: [\n    { binding: 'DB', database_name: D1_DATABASE_NAME, database_id: databaseId },\n    { binding: 'RATE_DB', database_name: D1_DATABASE_NAME, database_id: databaseId },\n  ],\n  r2_buckets: [\n    { binding: 'PROFILE_MEDIA', bucket_name: R2_BUCKET_NAME },\n    { binding: 'EXPLORE_CACHE', bucket_name: R2_BUCKET_NAME },\n  ],",
    'worker durable shared/cache bindings',
)

# 4) Release number.
replace_once(
    'public/app-version.json',
    '  "version": "050"',
    '  "version": "051"',
    'app version 051',
)

print('APPLY_051_EXPLORE_SHARED_DATA=PASS')

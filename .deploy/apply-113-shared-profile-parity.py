from pathlib import Path
import json

ROOT = Path('.')
CLIENT = ROOT / 'src/services/exploreProfileFirstViewService.ts'
MANIFEST = ROOT / 'cloudflare/explore-worker/release-patches.json'
VERSION = ROOT / 'public/app-version.json'

source = CLIENT.read_text(encoding='utf-8')
marker = '// SORIDRAW_PROFILE_SHARED_R2_REVALIDATION_113_20260917'

if marker not in source:
    comment_anchor = '// SORIDRAW_PROFILE_WARM_ZERO_READ_107_20260916\n'
    if comment_anchor not in source:
        raise RuntimeError('107 profile marker missing')
    source = source.replace(comment_anchor, comment_anchor + marker + '\n', 1)

    inflight_anchor = 'const coldLoadInflight = new Map<string, Promise<ExploreProfileFirstViewData>>();\n'
    if inflight_anchor not in source:
        raise RuntimeError('profile cold inflight anchor missing')
    source = source.replace(
        inflight_anchor,
        inflight_anchor
        + 'const PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113 = 60_000;\n'
        + 'const profileRevalidationInflight113 = new Map<string, Promise<void>>();\n',
        1,
    )

    request_end_anchor = "};\n\n\n// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_PROFILE_075_20260913\n"
    if request_end_anchor not in source:
        raise RuntimeError('materialized request end anchor missing')
    helper = r''' };

const revalidateCachedProfile113 = (
  normalizedRef: string,
  cached: ExploreProfileFirstViewData,
  options: ExploreProfileFirstViewOptions,
) => {
  const age = Math.max(0, Date.now() - Math.max(0, Number(cached.validatedAt || 0)));
  if (cached.validatedAt > 0 && age < PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113) return;
  const key = normalizedRef.toLowerCase();
  if (profileRevalidationInflight113.has(key)) return;

  const task = (async () => {
    try {
      const materialized = await requestMaterializedFirstView(normalizedRef, cached.revision);
      if (materialized.kind === 'updated') {
        writeCache(normalizedRef, materialized.data);
        options.onRevalidated?.(materialized.data);
        return;
      }
      if (materialized.kind === 'not-modified') {
        writeCache(normalizedRef, {
          ...cached,
          revision: materialized.revision || cached.revision,
          etag: materialized.etag || cached.etag,
          validatedAt: Date.now(),
        });
        return;
      }
      if (materialized.kind === 'not-found') {
        clearCache(normalizedRef, cached);
        options.onInvalidated?.(materialized.message);
      }
    } catch (error) {
      // Keep the last verified local snapshot. A transient shared-R2/edge failure must
      // not blank a warm profile or trigger the two-request legacy fallback path.
      console.warn('[Explore profile first-view] shared profile revalidation deferred.', error);
    }
  })().finally(() => {
    if (profileRevalidationInflight113.get(key) === task) profileRevalidationInflight113.delete(key);
  });
  profileRevalidationInflight113.set(key, task);
};


// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_PROFILE_075_20260913
'''
    source = source.replace(request_end_anchor, helper, 1)

    old_cached = '''  const cached = readCache(normalizedRef);\n  if (cached) {\n    // 107: warm revisit is strictly local. Known profile/publication/follow/like\n    // mutations already patch or invalidate this cache at the mutation boundary.\n    recordCloudflareLocalCacheHit(\n      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,\n      'LOCAL HIT · 변경 없음 · 서버 D1 읽기 0',\n    );\n    return cached;\n  }\n'''
    new_cached = '''  const cached = readCache(normalizedRef);\n  if (cached) {\n    // 113: render the warm snapshot immediately. At most once per minute on a\n    // revisit, verify its shared revision in the background. The Worker serves\n    // this conditional path from shared R2/edge; unchanged profiles never read D1.\n    recordCloudflareLocalCacheHit(\n      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,\n      'LOCAL HIT · 즉시 표시 · D1 읽기 0',\n    );\n    revalidateCachedProfile113(normalizedRef, cached, options);\n    return cached;\n  }\n'''
    if old_cached not in source:
        raise RuntimeError('107 warm cache block missing')
    source = source.replace(old_cached, new_cached, 1)

CLIENT.write_text(source, encoding='utf-8')

manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
patches = list(manifest.get('patches') or [])
patch_name = '060-shared-profile-r2-parity.mjs'
if patch_name not in patches:
    patches.append(patch_name)
manifest['patches'] = patches
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

VERSION.write_text('{"version":"113"}\n', encoding='utf-8')
print('[113] warm public profiles render locally and perform bounded shared-R2 conditional revalidation; patch 060 added to release manifest.')

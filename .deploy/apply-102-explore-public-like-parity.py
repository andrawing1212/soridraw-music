from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


# 1) Keep the existing 10-minute revision cache ceiling, but never let a cache
# created just before the 10-minute public like aggregate hide the new R2 ETag
# for another full 10 minutes. This only shortens selected local cache entries.
client_path = 'src/services/exploreRevisionRequestCache.ts'
client = read(client_path)
marker = 'SORIDRAW_EXPLORE_PUBLIC_LIKE_REVISION_BOUNDARY_102_20260916'
if marker not in client:
    anchor = 'const REVISION_CACHE_TTL_MS = 10 * 60 * 1000;\n'
    if anchor not in client:
        raise SystemExit('[102] revision cache TTL anchor missing')
    client = client.replace(
        anchor,
        anchor
        + f'// {marker}\n'
        + 'const PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102 = 10 * 60 * 1000;\n'
        + 'const PUBLIC_LIKE_REVISION_GRACE_MS_102 = 70 * 1000;\n'
        + 'const revisionCacheExpiry102 = (now = Date.now()) => {\n'
        + '  const normalExpiry = now + REVISION_CACHE_TTL_MS;\n'
        + '  const nextAggregateBoundary = Math.ceil((now + 1) / PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102)\n'
        + '    * PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102;\n'
        + '  return Math.min(normalExpiry, nextAggregateBoundary + PUBLIC_LIKE_REVISION_GRACE_MS_102);\n'
        + '};\n',
        1,
    )
    old_expiry = '    expiresAt: Date.now() + REVISION_CACHE_TTL_MS,\n'
    if old_expiry not in client:
        raise SystemExit('[102] revision cache expiry anchor missing')
    client = client.replace(old_expiry, '    expiresAt: revisionCacheExpiry102(),\n', 1)
    write(client_path, client)

# 2) Track Worker patch provenance for any future dashboard-source rebuild.
release_path = 'cloudflare/explore-worker/release-patches.json'
release = json.loads(read(release_path))
patches = list(release.get('patches') or [])
patch_name = '056-explore-public-like-parity.mjs'
if patch_name not in patches:
    try:
        index = patches.index('055-explore-like-intake-w1-hotpath.mjs') + 1
    except ValueError as exc:
        raise SystemExit('[102] 055 release patch anchor missing') from exc
    patches.insert(index, patch_name)
    release['patches'] = patches
    write(release_path, json.dumps(release, ensure_ascii=False, indent=2) + '\n')

# 3) This is the next PREVIEW application candidate. No deployment is triggered
# by this script; it only prepares source/version state.
version_path = 'public/app-version.json'
version = json.loads(read(version_path))
version['version'] = '102'
write(version_path, json.dumps(version, ensure_ascii=False, indent=2) + '\n')

print('[102] Public like projection + aggregate-boundary revision cache source prepared.')

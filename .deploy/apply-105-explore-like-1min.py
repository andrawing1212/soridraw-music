from pathlib import Path
import json

worker_path = Path('cloudflare/explore-worker/canonical/preview-entry.js')
like_path = Path('src/services/exploreLikeService.ts')
page_path = Path('src/pages/ExplorePage.tsx')
revision_path = Path('src/services/exploreRevisionRequestCache.ts')
version_path = Path('public/app-version.json')

worker = worker_path.read_text(encoding='utf-8')
like = like_path.read_text(encoding='utf-8')
page = page_path.read_text(encoding='utf-8')
revision = revision_path.read_text(encoding='utf-8')

if 'SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916' not in worker:
    marker = '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_103_20260916\n'
    if marker not in worker:
        raise SystemExit('missing Worker 103 marker')
    worker = worker.replace(marker, marker + '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916\n', 1)

worker = worker.replace(
    '// 103: the fixed 10-minute cron is replaced by one shared Durable Object alarm.\n'
    '// A successful non-empty like batch schedules exactly one alarm five minutes later.\n'
    '// More batches joining the same window do not move the deadline. No likes means no\n'
    '// alarm and therefore no periodic aggregate execution.\n',
    '// 103: the fixed 10-minute cron was replaced by one shared Durable Object alarm.\n'
    '// 105 PREVIEW test cadence: a successful non-empty like batch schedules exactly\n'
    '// one alarm one minute later. More batches joining the same window do not move\n'
    '// the deadline. No likes means no alarm and no periodic aggregate execution.\n',
    1,
)
if 'const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 * 60 * 1000;' not in worker:
    raise SystemExit('missing Worker five-minute delay')
worker = worker.replace(
    'const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 * 60 * 1000;',
    'const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 * 60 * 1000;',
    1,
)
worker = worker.replace('EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103', 'EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105')
worker = worker.replace("cron: 'event-like-batch-5m-103'", "cron: 'event-like-batch-1m-105'", 1)
worker = worker.replace('// five-minute window. A concurrently scheduled alarm is never pushed later.', '// one-minute window. A concurrently scheduled alarm is never pushed later.', 1)

if 'SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916' not in like:
    marker = '// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916\n'
    if marker not in like:
        raise SystemExit('missing client 104 marker')
    like = like.replace(marker, marker + '// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916\n', 1)
if 'const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 * 60_000;' not in like:
    raise SystemExit('missing client five-minute window')
like = like.replace('const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 * 60_000;', 'const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 * 60_000;', 1)
like = like.replace('EXPLORE_LIKE_EVENT_WINDOW_MS_104', 'EXPLORE_LIKE_EVENT_WINDOW_MS_105')
like = like.replace('// The first real local like change starts the existing server-side five-minute', '// The first real local like change starts the PREVIEW server-side one-minute', 1)
like = like.replace('// 104: start one five-minute server aggregate window on the first real', '// 105: start one one-minute server aggregate window on the first real', 1)

if 'SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916' not in page:
    marker = '// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916\n'
    if marker not in page:
        raise SystemExit('missing page 104 refresh marker')
    page = page.replace(marker, marker + '// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916\n', 1)
if 'const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 * 60_000;' not in page:
    raise SystemExit('missing page five-minute aggregate window')
page = page.replace('const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 * 60_000;', 'const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 = 1 * 60_000;', 1)
page = page.replace('const EXPLORE_LIKE_REFRESH_GRACE_MS_104 = 10_000;', 'const EXPLORE_LIKE_REFRESH_GRACE_MS_105 = 10_000;', 1)
page = page.replace('EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104', 'EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105')
page = page.replace('EXPLORE_LIKE_REFRESH_GRACE_MS_104', 'EXPLORE_LIKE_REFRESH_GRACE_MS_105')
page = page.replace('// 103 aggregates five minutes after the first server batch. The actor browser', '// 105 PREVIEW test cadence aggregates one minute after the first server batch. The actor browser', 1)

if 'SORIDRAW_EXPLORE_LIKE_REVISION_1MIN_105_20260916' not in revision:
    marker = '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916\n'
    if marker not in revision:
        raise SystemExit('missing revision 103 marker')
    revision = revision.replace(marker, marker + '// SORIDRAW_EXPLORE_LIKE_REVISION_1MIN_105_20260916\n', 1)
if 'const REVISION_CACHE_TTL_MS = 5 * 60 * 1000;' not in revision:
    raise SystemExit('missing five-minute revision TTL')
revision = revision.replace('const REVISION_CACHE_TTL_MS = 5 * 60 * 1000;', 'const REVISION_CACHE_TTL_MS = 1 * 60 * 1000;', 1)
revision = revision.replace("const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v2:';", "const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v3:';", 1)
revision = revision.replace('// Keep one tiny Edge/R2 revision check at most every five minutes while Explore is', '// Keep one tiny Edge/R2 revision check at most every one minute while PREVIEW Explore is', 1)
revision = revision.replace('// existing 10-minute public settling window.', '// one-minute PREVIEW public settling window.', 1)

worker_path.write_text(worker, encoding='utf-8')
like_path.write_text(like, encoding='utf-8')
page_path.write_text(page, encoding='utf-8')
revision_path.write_text(revision, encoding='utf-8')

version = json.loads(version_path.read_text(encoding='utf-8'))
if str(version.get('version')) != '104':
    raise SystemExit(f"expected app version 104, got {version.get('version')}")
version['version'] = '105'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

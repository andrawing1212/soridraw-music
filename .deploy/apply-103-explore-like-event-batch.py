from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


PREVIEW_ENTRY_103 = """import { DurableObject } from 'cloudflare:workers';
import baseWorker from './preview-worker.js';

// SORIDRAW_EXPLORE_REVISION_HEAD_ONLY_036_20260911
// SORIDRAW_EXPLORE_REVISION_HEAD_LOW_READ_037_20260911
// SORIDRAW_EXPLORE_FEED_DELTA_068_20260912
// SORIDRAW_EXPLORE_R2_REVISION_HEAD_077_20260913
// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_103_20260916
//
// 077: revision checks never open D1. The first-page Feed R2 object's ETag is the
// revision. A mutation that changes the cached Feed changes the ETag; unchanged
// reconnects are one tiny R2 HEAD (or edge hit) and D1 R0/W0.
//
// 103: the fixed 10-minute cron is replaced by one shared Durable Object alarm.
// A successful non-empty like batch schedules exactly one alarm five minutes later.
// More batches joining the same window do not move the deadline. No likes means no
// alarm and therefore no periodic aggregate execution.
const REVISION_HEAD_CACHE_SECONDS_077 = 60;
const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 * 60 * 1000;
const EXPLORE_LIKE_BATCH_ROUTE_103 = '/v1/me/likes/batch';
const EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103 = 'shared-like-batch';
const RELEASE_ALLOWED_ORIGINS_036 = new Set([
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
  'https://test.soridraw.com',
  'https://soridraw-test.web.app',
  'https://soridraw-test.firebaseapp.com',
  'https://soridraw.com',
  'https://www.soridraw.com',
  'https://soridraw.web.app',
  'https://soridraw.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function revisionCors036(request) {
  const origin = String(request.headers.get('Origin') || '');
  if (!RELEASE_ALLOWED_ORIGINS_036.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function revisionDiagnosticHeaders077(cors, r2ClassB = 0, source = 'R2-HEAD-077') {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '077');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2ClassB || 0))));
  headers.set('X-SORIDRAW-Revision-Mode', 'HEAD-ONLY-036');
  headers.set('X-SORIDRAW-Revision-Source', source);
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Diagnostics',
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
    'X-SORIDRAW-Revision-Mode',
    'X-SORIDRAW-Revision-Source',
  ].join(', '));
  return headers;
}

const feedR2Key077 = (sort) => `internal/explore/feed-v1/${sort === 'popular' ? 'popular' : 'latest'}-40.json`;
const feedCacheBucket077 = (env) => env?.EXPLORE_CACHE || env?.PROFILE_MEDIA || null;

async function readFeedR2Revision077(url, env, sort) {
  const edgeUrl = new URL(`/__soridraw/feed-r2-revision-077/${sort}`, url.origin);
  const edgeKey = new Request(edgeUrl.toString(), { method: 'GET' });
  try {
    const cached = await caches.default.match(edgeKey);
    if (cached) {
      const revision = String(await cached.text() || '').trim();
      if (revision) return { revision, r2ClassB: 0, source: 'EDGE-R2-HEAD-077' };
    }
  } catch {}

  const bucket = feedCacheBucket077(env);
  if (!bucket) return { revision: '', r2ClassB: 0, source: 'R2-BINDING-MISSING-077' };
  let head = null;
  try { head = await bucket.head(feedR2Key077(sort)); } catch {}
  if (!head) return { revision: '', r2ClassB: 1, source: 'R2-MISSING-077' };
  const revision = String(
    head.httpEtag
    || head.etag
    || head.customMetadata?.updatedAt
    || (head.uploaded && typeof head.uploaded.getTime === 'function' ? head.uploaded.getTime() : '')
    || '',
  ).trim();
  if (!revision) return { revision: '', r2ClassB: 1, source: 'R2-REVISION-MISSING-077' };
  try {
    await caches.default.put(edgeKey, new Response(revision, {
      headers: { 'Cache-Control': `public, max-age=${REVISION_HEAD_CACHE_SECONDS_077}` },
    }));
  } catch {}
  return { revision, r2ClassB: 1, source: 'R2-HEAD-077' };
}

async function handleFeedRevisionHeadOnly077(request, env) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const cors = revisionCors036(request);
  const head = await readFeedR2Revision077(url, env, sort);
  if (!head.revision) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore Feed snapshot unavailable' }), {
      status: 503,
      headers: revisionDiagnosticHeaders077(cors, head.r2ClassB, head.source),
    });
  }
  return new Response(JSON.stringify({ ok: true, data: { sort, revision: head.revision } }), {
    status: 200,
    headers: revisionDiagnosticHeaders077(cors, head.r2ClassB, head.source),
  });
}

async function scheduleExploreLikeAggregate103(env) {
  const namespace = env?.EXPLORE_LIKE_BATCH_SCHEDULER;
  if (!namespace) throw new Error('Explore like scheduler binding unavailable');
  const id = namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
  const stub = namespace.get(id);
  const response = await stub.fetch('https://soridraw.internal/schedule', { method: 'POST' });
  if (!response.ok) throw new Error(`Explore like scheduler rejected: ${response.status}`);
  return response.json().catch(() => ({}));
}

async function ensureQueuedLikeBatchScheduled103(request, env, response) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== EXPLORE_LIKE_BATCH_ROUTE_103 || !response.ok) return response;
  const payload = await response.clone().json().catch(() => null);
  if (!payload?.data?.queued) return response;

  try {
    await scheduleExploreLikeAggregate103(env);
    return response;
  } catch (error) {
    // The canonical queue may already contain the desired-state mutation. Returning
    // retryable 503 keeps the client outbox instead of acknowledging work that has
    // no durable wake-up. Replays are safe because canonical likes are set semantics.
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    const message = String(error?.message || error || '좋아요 묶음 예약에 실패했습니다.');
    return new Response(JSON.stringify({
      ok: false,
      message,
      error: { code: 'LIKE_BATCH_SCHEDULER_UNAVAILABLE', message },
      data: { queued: true, retryable: true },
    }), { status: 503, headers });
  }
}

export class ExploreLikeBatchScheduler103 extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not found', { status: 404 });
    }

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm != null) {
      return Response.json({ ok: true, scheduledAt: currentAlarm, newlyScheduled: false });
    }

    const scheduledAt = Date.now() + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103;
    await this.ctx.storage.setAlarm(scheduledAt);
    return Response.json({ ok: true, scheduledAt, newlyScheduled: true });
  }

  async alarm() {
    if (typeof baseWorker?.scheduled !== 'function') {
      throw new Error('Canonical Explore like aggregate handler unavailable');
    }

    // Durable Object alarms are at-least-once. The existing aggregate lease and
    // desired-state canonical mutation make a retry safe if an execution fails.
    await baseWorker.scheduled({
      scheduledTime: Date.now(),
      cron: 'event-like-batch-5m-103',
      type: 'scheduled',
    }, this.env, this.ctx);

    // Normal windows drain completely and stop here. Under an unusually large
    // burst, only one indexed row is checked; if work remains, schedule one more
    // five-minute window. A concurrently scheduled alarm is never pushed later.
    const pending = await this.env.DB.prepare(
      'SELECT batch_id FROM explore_like_batches_069 ORDER BY created_at ASC, batch_id ASC LIMIT 1',
    ).first();
    if (pending) {
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm == null) {
        await this.ctx.storage.setAlarm(Date.now() + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103);
      }
    }
  }
}

export default {
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker?.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/v1/feed-revision') {
      return handleFeedRevisionHeadOnly077(request, env);
    }
    const response = await baseWorker.fetch(request, env, ctx);
    return ensureQueuedLikeBatchScheduled103(request, env, response);
  },
};
"""

WRANGLER_PREVIEW_103 = """{
  "name": "soridraw-explore-preview",
  "main": "./preview-entry.js",
  "compatibility_date": "2026-08-28",
  "workers_dev": true,
  "keep_vars": true,
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "soridraw-explore-db",
      "database_id": "217ef5b1-5d80-4f7c-afc7-9e07eb05c06b"
    },
    {
      "binding": "RATE_DB",
      "database_name": "soridraw-explore-preview-db",
      "database_id": "aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f"
    }
  ],
  "ratelimits": [
    {
      "name": "LIKE_RATE_LIMITER",
      "namespace_id": "91054",
      "simple": {
        "limit": 60,
        "period": 60
      }
    }
  ],
  "r2_buckets": [
    {
      "binding": "PROFILE_MEDIA",
      "bucket_name": "soridraw-profile-media"
    },
    {
      "binding": "EXPLORE_CACHE",
      "bucket_name": "soridraw-profile-media-preview"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "EXPLORE_LIKE_BATCH_SCHEDULER",
        "class_name": "ExploreLikeBatchScheduler103"
      }
    ]
  },
  "exports": {
    "ExploreLikeBatchScheduler103": {
      "type": "durable-object",
      "storage": "sqlite"
    }
  },
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  }
}
"""


def apply_product() -> None:
    revision_path = 'src/services/exploreRevisionRequestCache.ts'
    revision = read(revision_path)
    old_block = """// A 10-minute local revision window remains the first guard. When the server is
// actually consulted, 068 asks for a bounded changed-track delta. Safe latest-feed
// changes are merged into the existing device cache locally, so one like aggregate
// does not cause a second /v1/feed request. Structural/popular changes fall back to
// the existing full-feed path to preserve correctness.
const REVISION_CACHE_TTL_MS = 10 * 60 * 1000;
// SORIDRAW_EXPLORE_PUBLIC_LIKE_REVISION_BOUNDARY_102_20260916
const PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102 = 10 * 60 * 1000;
const PUBLIC_LIKE_REVISION_GRACE_MS_102 = 70 * 1000;
const revisionCacheExpiry102 = (now = Date.now()) => {
  const normalExpiry = now + REVISION_CACHE_TTL_MS;
  const nextAggregateBoundary = Math.ceil((now + 1) / PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102)
    * PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102;
  return Math.min(normalExpiry, nextAggregateBoundary + PUBLIC_LIKE_REVISION_GRACE_MS_102);
};
const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v1:';
"""
    new_block = """// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916
// Public aggregate work is now event-driven and can complete at any wall-clock time.
// Keep one tiny Edge/R2 revision check at most every five minutes while Explore is
// active; D1 remains R0/W0 on this path. A new cache namespace prevents a previously
// stored 10-minute response from hiding the first 103 event-driven aggregate.
const REVISION_CACHE_TTL_MS = 5 * 60 * 1000;
const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v2:';
"""
    if 'SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916' not in revision:
        if old_block not in revision:
            raise SystemExit('[103] revision cache 102 block missing')
        revision = revision.replace(old_block, new_block, 1)
        if 'expiresAt: revisionCacheExpiry102(),' not in revision:
            raise SystemExit('[103] revision expiry anchor missing')
        revision = revision.replace(
            'expiresAt: revisionCacheExpiry102(),',
            'expiresAt: Date.now() + REVISION_CACHE_TTL_MS,',
            1,
        )
        write(revision_path, revision)

    write('cloudflare/explore-worker/canonical/preview-entry.js', PREVIEW_ENTRY_103)
    write('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', WRANGLER_PREVIEW_103)

    version_path = 'public/app-version.json'
    version = json.loads(read(version_path))
    version['version'] = '103'
    write(version_path, json.dumps(version, ensure_ascii=False, indent=2) + '\n')
    print('[103] Event-driven 5-minute Explore like batch candidate prepared.')


def update_docs(product_sha: str) -> None:
    product_sha = str(product_sha or '').strip()
    if len(product_sha) != 40:
        raise SystemExit('[103 docs] product sha must be 40 hex chars')

    current_path = 'DOCS/CURRENT_RELEASE_STATE.md'
    current = read(current_path)
    current = current.replace('- 현재 `preview` 제품 코드 후보: **102**', '- 현재 `preview` 제품 코드 후보: **103**', 1)
    current = current.replace(
        '- 102 Explore public-like parity 제품 commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`',
        '- 102 Explore public-like parity 제품 commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`\n'
        + f'- 103 Explore event-driven 5분 좋아요 묶음 제품 commit: `{product_sha}`',
        1,
    )
    current = current.replace(
        '- **릴리스 상태: 102 코드/자동검증 PASS, PREVIEW 실사용 검증 전. TEST 승격 금지.**',
        '- **릴리스 상태: 103 코드/자동검증 PASS, PREVIEW 미배포·실사용 검증 전. TEST 승격 금지.**',
        1,
    )
    current = current.replace('**102는 아직 배포하지 않았다.**', '**103은 아직 배포하지 않았다. 102 공개 좋아요 수렴 수정도 103에 포함된다.**', 1)
    current = current.replace('102 PREVIEW 앱 + Explore Worker 배포 검증.', '103 PREVIEW 앱 + Explore Worker 배포 검증.', 1)
    current = current.replace('## 11. PREVIEW 102 배포 후 필수 실사용 검증', '## 11. PREVIEW 103 배포 후 필수 실사용 검증', 1)
    current = current.replace(
        '- 공개 숫자는 비용 설계상 scheduled aggregate 경계까지 최대 약 10분 지연이 있을 수 있다. 102의 목표는 그 canonical 경계 이후 다른 계정에 오래된 값이 남지 않도록 수렴시키는 것.',
        '- 103은 고정 10분 Cron을 제거하고, 실제 서버 like batch가 생긴 경우에만 공유 Durable Object가 5분 뒤 aggregate 1회를 예약한다. 같은 5분 창의 추가 batch는 마감시각을 뒤로 미루지 않는다.',
        1,
    )
    current = current.replace(
        '1. 사용자가 `프리뷰배포` 요청 시 102 고정 commit 기준으로 PREVIEW Worker + Hosting 검증 배포.',
        '1. 사용자가 `프리뷰배포` 요청 시 103 고정 commit 기준으로 PREVIEW Worker + Hosting 검증 배포.',
        1,
    )
    marker = '## 13. 103 이벤트 기반 5분 좋아요 묶음 — 2026-09-16\n'
    if marker not in current:
        current += f"""

{marker}- 제품 commit: `{product_sha}`
- 목적: 고정 `*/10` Cron을 없애고 **실제 like batch가 서버에 들어왔을 때만** 5분 뒤 aggregate를 1회 실행.
- Cloudflare Durable Object `ExploreLikeBatchScheduler103` 1개를 shared scheduler로 사용.
- 첫 non-empty `/v1/me/likes/batch`가 alarm을 만들고, 같은 창의 후속 batch는 기존 alarm 시각을 유지해 5분을 계속 연장하지 않음.
- 좋아요 변경이 없으면 alarm 0, aggregate 실행 0.
- alarm은 Cloudflare at-least-once retry를 사용하고 기존 D1 aggregate lease/set semantics를 그대로 보호.
- 아주 큰 burst로 069 queue가 남은 경우에만 처리 후 `LIMIT 1` 확인 1회 후 다음 5분 alarm을 추가. 평상시 반복 polling 없음.
- 102에서 복구한 canonical D1 → public Feed/Profile R2 수렴 경로는 그대로 사용.
- 다른 계정의 revision 확인은 event aggregate 시각이 고정 wall-clock이 아니므로 local revision cache를 10분 → 5분으로 축소. 이 경로는 Edge/R2 HEAD이며 D1 R0/W0 유지.
- 기존 10분 revision response가 103 첫 수렴을 가리지 않도록 **revision response cache만** v2 namespace로 변경. Feed/사용자 데이터 cache는 무효화하지 않음.
- D1 schema/migration/backfill 없음. Firebase/Functions/RTDB Rules/UI/CSS 변경 없음.
- 실제 PREVIEW 배포 전 상태. Durable Object namespace는 PREVIEW Worker 첫 배포 때 Cloudflare가 additive 생성하며 사용자 원본 데이터와 무관.
"""
    write(current_path, current)

    next_text = f"""# NEXT CODEX TASK

상태: **103 이벤트 기반 5분 공개 좋아요 묶음 코드 완료 / 자동검증 PASS / 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 103 제품 commit: `{product_sha}`
- 102 public-like parity commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8` — 103에 포함
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: 기존 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- TEST / PRODUCTION 비변경

## 103 구조
- 기존 client Local First / boundary / max-50 like outbox 유지.
- 서버에 실제 non-empty like batch가 들어오면 shared Durable Object alarm을 **한 번만 5분 뒤** 예약.
- 같은 5분 창에 batch가 더 들어와도 deadline을 뒤로 미루지 않음.
- alarm이 canonical 069 aggregate를 실행하고 102 public Feed/Profile R2 수렴 로직까지 그대로 통과.
- 좋아요 batch가 없으면 고정 Cron/aggregate 실행 없음.
- 처리량이 비정상적으로 커 069 queue가 남은 경우에만 indexed `LIMIT 1` 확인 후 다음 5분 alarm 추가.
- `/v1/feed-revision` client response cache는 5분. Edge/R2 HEAD 기반 D1 R0/W0 유지.
- UI/CSS, D1 schema, 사용자 원본 데이터, Firebase/Functions/RTDB Rules 변경 없음.

## 비용/정확성 합격선
1. 좋아요 없음: Worker like aggregate 정기 실행 0.
2. 첫 서버 batch: alarm 1개 생성.
3. 같은 창의 추가 batch: alarm deadline 유지, timer reset 금지.
4. aggregate 후 069 queue 비면 다음 alarm 0.
5. 실제 public count 변경만 102 bounded Feed/Profile R2 수렴.
6. warm revision check D1 R0/W0.
7. 공개 총 숫자는 Master/Admin A/Admin B에서 aggregate 후 수렴.
8. 개인 빨간 heart는 계정별 독립 유지.

## 다음 작업
**추가 코드 수정보다 PREVIEW 배포 후 실사용 검증이 우선.**
사용자가 `프리뷰배포`를 요청하면 앱 103 + PREVIEW Explore Worker를 함께 배포한다.

배포 전/후 확인:
- TypeScript / Build / 102 / 103 / 기존 비용 verifier PASS.
- Wrangler dry-run에서 Durable Object binding/export PASS.
- PREVIEW 고정 10분 Cron이 제거됐는지 확인.
- TEST/PRODUCTION Worker/Hosting 비변경.
- 실제 좋아요 batch 후 5분 alarm 수렴 확인.
- 변경 없는 상태에서 D1 read/write 및 aggregate 반복 실행 없음 확인.
- Master PC/모바일 + Admin A/B 공개 숫자 교차검증.

## 주의
- 5분은 **서버가 실제 like batch를 받은 시점부터의 shared aggregate window**다. 사용자가 Explore에 계속 머무는 동안에는 기존 Local First가 먼저 적용되어 불필요한 서버 전송을 만들지 않는다.
- strict '첫 클릭 후 반드시 5분 이내 타 사용자 반영'으로 바꾸려면 client가 첫 클릭 때 서버 window를 여는 추가 요청이 필요하므로 비용이 늘어난다. 현재 103은 비용 우선 구조다.
- PRODUCTION은 명확한 정식배포 승인 전 금지.
"""
    write('DOCS/NEXT_CODEX_TASK.md', next_text)
    print('[103 docs] release state and next task updated.')


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == '--docs':
        update_docs(sys.argv[2] if len(sys.argv) >= 3 else '')
    else:
        apply_product()

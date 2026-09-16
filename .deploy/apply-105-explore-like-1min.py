from pathlib import Path
import json

worker = Path('cloudflare/explore-worker/canonical/preview-entry.js').read_text(encoding='utf-8')
like = Path('src/services/exploreLikeService.ts').read_text(encoding='utf-8')
page = Path('src/pages/ExplorePage.tsx').read_text(encoding='utf-8')
revision = Path('src/services/exploreRevisionRequestCache.ts').read_text(encoding='utf-8')
version = json.loads(Path('public/app-version.json').read_text(encoding='utf-8'))
state_path = Path('DOCS/CURRENT_RELEASE_STATE.md')
state = state_path.read_text(encoding='utf-8')

required = [
    ('worker marker', 'SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916', worker),
    ('worker delay', 'const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 * 60 * 1000;', worker),
    ('client marker', 'SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916', like),
    ('client window', 'const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 * 60_000;', like),
    ('page marker', 'SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916', page),
    ('page window', 'const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 = 1 * 60_000;', page),
    ('revision marker', 'SORIDRAW_EXPLORE_LIKE_REVISION_1MIN_105_20260916', revision),
    ('revision ttl', 'const REVISION_CACHE_TTL_MS = 1 * 60 * 1000;', revision),
]
for label, token, source in required:
    if token not in source:
        raise SystemExit(f'missing 105 {label}')
if str(version.get('version')) != '105':
    raise SystemExit(f"expected app version 105, got {version.get('version')}")

marker = '## 0A. PREVIEW 105 — 테스트용 1분 좋아요 창 코드 완료'
if marker not in state:
    intro = '> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.\n\n'
    block = """## 0A. PREVIEW 105 — 테스트용 1분 좋아요 창 코드 완료
- 사용자 요청으로 5분 실사용 대기 시간을 PREVIEW 검증 동안 1분으로 단축.
- **고정 1분 Cron은 추가하지 않음.** 좋아요가 실제로 들어올 때만 shared Durable Object alarm 1개를 1분 뒤 예약하는 기존 이벤트 기반 구조를 유지.
- 같은 1분 창의 추가 batch는 deadline을 뒤로 미루지 않음. 후속 로컬 변경은 마감 약 15초 전에 최종 상태를 한 번 더 flush.
- actor fresh Feed refresh는 `1분 + 10초`; `/v1/feed-revision` client cache도 1분, namespace v3로 변경해 기존 5분 cache를 차단.
- Durable Object class/binding `ExploreLikeBatchScheduler103`은 유지해 새 DO migration 없음.
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`.
- 105 apply/verification Run `35054646104` PASS: verifier, Worker syntax, TypeScript, Build, Wrangler PREVIEW dry-run, change-boundary 모두 PASS.
- 변경 파일: `cloudflare/explore-worker/canonical/preview-entry.js`, `src/services/exploreLikeService.ts`, `src/services/exploreRevisionRequestCache.ts`, `src/pages/ExplorePage.tsx`, `public/app-version.json`.
- UI/CSS, Firebase Functions/Rules, RTDB Rules, D1 schema/migration, 사용자 원본 데이터 변경 없음.
- **현재 실제 PREVIEW 런타임은 아직 앱 104 + Worker 103의 5분 설정. 105는 미배포.** 사용자 배포 요청 전에는 실제 환경을 변경하지 않음.
- TEST/PRODUCTION 비변경. TEST 승격 금지.

"""
    if intro not in state:
        raise SystemExit('missing CURRENT_RELEASE_STATE intro anchor')
    state = state.replace(intro, intro + block, 1)

state_path.write_text(state, encoding='utf-8')

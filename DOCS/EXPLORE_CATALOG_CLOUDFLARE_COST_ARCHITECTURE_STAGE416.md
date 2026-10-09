# Stage416 결정안 — Local-first 카탈로그 + 변경곡 동기화 + 복구용 스냅샷 / Cloudflare 최소비용 운영

작성 2026-10-09 KST. **사용자 승인: 최종 판단대로 진행, Cloudflare 제공 기능들의 무료한도/장기 총비용을 최적 배분.** 현재 코드/실기기 원본 확인을 반영한 구현 전 설계(아직 제품 적용 아님).

## 0. 목표와 검증 기준 — 행동을 희생해 무료사용량만 늘리면 FAIL

- SORIDRAW 개인 Explore 좋아요의 최종 기준은 **공유 canonical D1**, 앱에서 우선 보는 값은 **사용자 기기별 durable 로컬 카탈로그 + 마지막 개인 변경(outbox)**, R2 개인 스냅샷은 **새 기기/캐시 손상/정당한 누락 gap을 복구하는 재료**. 페이지 진입·앱 업데이트는 원본 D1 재조회/쓰기를 발생시키지 않는다.
- 영상 **75초 좋아요 해제 → W1 + 개인 social-snapshot D1 R4 / rows_read17**, **105초 좋아요 → W1 + R4 / rows_read19** 둘 다 실패 기준. PC/모바일, Explore Feed에 머물 때의 후속 수신, My Likes 진입 때 모두 새로운 원본 D1 R0 목표. 사용자 별도 보고한 **실제 무조작 idle R 증가** 및 모바일 3~4단계 증가도 검증. 기존 변경 없음 warm-cache Worker0/D1 R0 통과 기능 보호.
- 상태 정확성: 새/기존 곡 좋아요·해제, 잘못된 좋아요 숫자, 기기간 늦은 신호/동시 클릭, outbox/revision 충돌/부분 캐시/기존 클라이언트 모두 안전. **ACK queued 를 canonical settled로 위장하거나 unresolved 가드를 삭제해서 읽기를 숨기면 FAIL**. D1 write physical W1~W2, W3+ FAIL; Explore 첫 공개곡, 팔로우, Studio save-heart/Music Note/Library/UI/테마 동작 불변.
- 환경: PREVIEW/TEST/PRODUCTION은 코드·파생 캐시만 분리, 실제 사용자 원본 공유. 새로운 schema, migration, seed, 대량 백필/변환/삭제 안 함. TEST 승격은 별도 사용자 승인, PRODUCTION은 명시적 승인.

## 1. 현재 SORIDRAW 인프라(실제 preview 소스)

`cloudflare/explore-worker/canonical/wrangler.preview.jsonc` 확인:
- `DB`: 공유 D1 `soridraw-explore-db` — 개인 좋아요/공개곡/좋아요 집계 canonical. 환경별 `RATE_DB`는 임시·rate/preview 전용. 다른 환경에서 사용자 데이터 자체 복제/마이그레이션 금지.
- `PROFILE_MEDIA`: 공유 R2 `soridraw-profile-media` — 사용자 개인 좋아요/프로필/공용 projection. `EXPLORE_CACHE`: preview 전용 `soridraw-profile-media-preview` — 파생 캐시. PRODUCTION에서는 이 전용 binding이 없을 수 있으므로 fallback/path parity 반드시 테스트.
- `EXPLORE_LIKE_BATCH_SCHEDULER` : 기존 SQLite Durable Object `ExploreLikeBatchScheduler103`. `preview-entry.js`에서 batch 요청 뒤 5초 공용 alarm/처리, `runAggregate194`가 `baseWorker.scheduled` canonical queue 처리 **및** `repairSharedPublicLikeCounts191`를 수행. 현 설계에 이미 있는 조정자라 우선 재사용. 단, 현재 public repair는 shared Feed first 40 x 2 범위; **전체 공개곡 커버가 아님**. 서버 canonical 처리와 public +300초 발표를 단순 상수 변경으로 묶으면 FAIL.
- Firebase RTDB `userSync/$uid/exploreLike`은 기존 서버 접수 후 confirmed 개인 changed rows 채널; 현재 수신자는 canonical settlement 증명과 혼동 가능. 새로운 사전 클릭 잠정 신호를 기존 채널에 섞지 않는다. 별도 channel+공유 Rules 변경은 별도 독립 감사/preflight/구형 호환성 필요.
- 기존 Worker Cache/R2 revision/ETag를 이미 공개 Feed·프로필에 활용. 공개 자료는 global edge 캐시를 쓰고, **개인 좋아요 목록은 권한 검증 없이 CDN 공용 cache/공용 key에 올리지 않는다**.

## 2. 서비스별 역할/비용 전략

| 서비스 | 사용할 역할 | 쓰지 않을 용도 | 현재 무료 참고 한도 / 유의점 |
| --- | --- | --- | --- |
| 기기 IndexedDB/localStorage | 각 UID 로컬 개인 카탈로그, outbox, 마지막 검증된 변경 cursor | 유실될 수 있는 개인 원본의 유일한 authority | 서버 IO 0 |
| D1 (shared DB) | 유일한 최종 사용자 원본, 기존 bounded W1 queue + 최종 변경분 commit | 화면 진입/버전업/피드 재진입의 전체 scan, 좋아요마다 189 R4 | 무료 하루 rows_read 500만, rows_written 10만, storage 총 5GB(2026-10-09 공식 docs) |
| Workers | 인증·changed-ID 라우팅·safe response, 필요 시 소규모 R2/cursor 복구 | 변경 없음 상태 주기적인 canonical D1 검증 | 무료 10만 요청/일; 모든 경로 통합 카운터 |
| R2 Standard | 초회 개인 snapshot, 환경별 공개 Feed/profile/card projection, 서버 최종 처리의 **작은 bounded 변경 영수증/버전** 후보 | 좋아요 1번마다 사용자 전체 스냅샷 다시 PUT / 캐시 꼬임을 무조건 데이터 전체 재생성 | 무료 월 저장10 GB-month, Class A 100만, Class B 1천만, egress 무료; Standard만 무료 계층 |
| Durable Objects (기존) | 이미 있는 event-driven changed-batch/queue drain 알람, 진짜 canonical 처리 완료 변경 ID만 단일/한정 event로 수집. 공동 5분 공개 반영과 개인 완료 표시 **분리** | 열람마다 per-UID DO 호출/idle 지속 polling/기존 scheduler를 전역 hot-spot으로 확대 | SQLite DO 무료 requests 10만/일, duration 13,000 GB-s/일; 추가 처리량도 계측 |
| Cloudflare Workers Cache/Cache API | **공개** Feed/profile/card + revision/ETag 기반 글로벌(또는 지역) 파생 캐시 | `/v1/me/...` 개인 인증 응답을 공용 캐시 key로 공유 | Cache API는 PoP별 비복제. `Cache-Control: private,no-store` 및 사용자 ACL 보호 |
| Workers KV | 매우 드물게 수정되는 공개 설정/flag/read-mostly 메타데이터에 한정, 실제 비용 측정 후에만 채택 | 개인 좋아요 원본, 최신 operationId, 사용자별 like click 매번 PUT | 무료 읽기10만/일, 쓰기1천/일; eventual consistency/동일 key 초당 쓰기1회 제한 |
| Cloudflare Queues | 향후 정말 필요한 실패 재처리/저우선 비동기 작업에서 기존 DO 구조보다 비용 절감될 때만 선택 | 모든 좋아요 클릭마다 새 메시지 발행하는 새 비용 계층 | 무료 operations 1만/일; 보통 1 메시지 write+read+delete=3 ops / retention24h |
| Firebase RTDB (현 서비스, Cloudflare 별도) | UID 격리 PC↔모바일 개인 신호 전달, 구형 confirmed/신규 provisional 계약 분리 | 매 페이지 입장 전체 데이터 broadcast·전체 계정 구독 | Firebase 요금은 별도 집계, D1/R2 무료한도에 포함되지 않음 |

**주의:** 서로 다른 제품의 무료 한도가 있다고 해서 같은 이벤트를 여러 서비스로 복제하면 '무료 합산'이 되는 것은 아님. 예컨대 Worker→DO→R2→D1은 한 사건에 각 서비스 사용량이 모두 쌓임. 총 요청/운영비와 실패 처리 비용으로 비교.

공식 문서(2026-10-09 조회):
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/r2/reference/consistency/

## 3. 최종 데이터 흐름(구현 설계)

1. **로컬 즉시:** 곡 1개 like/unlike → 기기 durable outbox/known membership 우선. 다른 기기와 즉시 통신은 별도 승인된 UID provisional 신호로, 현 confirmed channel과 혼합 금지. 최신 opId/fence/version이 낡은 응답보다 우선.
2. **서버 intake:** 기존 069 W1 queue accepted 응답은 `queued`로 유지. 한 곡 변경은 그 곡에 대한 accepted intent guard만 남긴다. W1 배치 저장과 R2 best-effort cache snapshot은 canonical 최종 정착 **증거가 아님**.
3. **서버 최종 정착 출처:** 기존 DO alarm→Worker scheduled queue consumer가 **원본 D1 변경을 확정한 시점**의 changed-track/opId/batch completion을 안전하게 확보. 그 처리 이벤트를 근거로 private user-scoped bounded settled receipt/cursor의 R2 기록/응답 또는 이미 존재하는 최종 projection과 묶는다. 어떤 R2 버킷에 어떻게 순서보존·중복방지·TTL·안전한 객체 PUT을 할지는 해당 consumer 실제 소스/실행 비용 확인 후 결정. **변경 receipt가 durable하지 않으면 R0을 허위 증명하지 않는다**. receipt 도착/복구 전에는 guarded membership 유지.
4. **정상 화면 경로:** Feed heart 및 My Likes 모두 local catalog+pending/outbox+settled changed receipts 합성. 정상 queued ACK 새 event 자체는 무거운 historical `PERSONAL SETTLEMENT 189`을 시작하는 신호가 아니다. 새 곡이 다른 기기에서 바뀌었으면 changed-ID만 반영. 페이지 이동/idle/업데이트로 D1 scan 없음.
5. **복구 경로:** 새 기기/캐시 파손/신호 gap/충돌 시 R2 원본 snapshot+신호 cursor를 읽고, 수정 범위가 명확한 경우 바뀐 IDs만 검증. 진짜 canonical mismatch/backfill/legacy partial 때만 기존 bounded 189 복구. 그 복구 비용은 변경 없음 사용자의 정상 경로에 숨겨 반복 전가하지 않음.
6. **공개 숫자:** 개인 accepted intent +300s ≠ 공동 집계 시작. 개인 배치가 실제 서버에서 정착한 **첫 이벤트**부터 공동 고정 300s. 이미 scheduled DO를 event-driven으로 활용하되 canonical queue drain을 300s 늦추지 않는다. public 변경 곡의 전체 ID source 보장(기존 first80 보완), R2 changed-cards/Feed/프로필만 갱신하고 공개 cache invalidation 최소화.
7. **일관성/권한:** 사용자 개인 카탈로그 접근 UID 검증, browser persistent 캐시는 계정 logout/switch 분리. 기존 TEST/PRODUCTION/구형 앱이 새 changed receipt 필드를 몰라도 기존 snapshot + canonical 원본을 그대로 읽을 수 있는 additive 호환성.

## 4. 구현 순서 — 무거운 백엔드 변경은 분리

- **A / 지금 최우선 R4 원인 수정:** 이 문서에 앞선 사용자 영상의 좋아요 해제 R4/17, 좋아요 R4/19, Feed idle/ My Likes/ 모바일 누적을 **변경 시작 직후 실제 함수/Worker route별로 재현**. 서버 queue drain 지점 + app189 trigger의 새 ACK/과거 미정착 guard 분리. 정확한 server final receipt가 없는 상태에서 앱만 수정해 가짜 D1 R0 만들기 금지.
- **B / 작은 구현 + frozen 회귀:** 실제 changed-track settlement receipt를 additive source로 설계·검사. 필요하면 app 코드는 개인 local-first only/read-only probe + scoped opt-in flag로 먼저 배포, Worker/R2는 독립 배포 검증. original user data/마이그레이션/공유 RTDB Rules 변경 없음.
- **C / 진짜 PREVIEW 측정:** TypeScript/Build/127,175,178,189,190,191,192,197,390,412~416 regression + Work 독립 read-only 감사 통과; 각각 고정 SHA 배포. PC like/unlike, Feed idle, My Likes 3회, PC↔mobile event 시 추가 D1 SQL/query row R0, original W1~W2, browser/Worker/R2 A/B/DO 전부 진단 기록. 실패면 다음 단계 멈춤.
- **D / 개인 즉시 +5분 / 공개 5분은 별도:** A/B/C 통과 후 Stage416 원계약에 따라 기기 간 private provisional, trailing 300s 개인 batch, canonical-verified public fixed 300s로 분리 구현. 단순 타이머 상수 변경 불가.
- **E / 장기 운영:** per-100/1k/10k/100k 활성 UID 및 1/10/100 변경곡 시나리오로 하루/월 모든 제품 무료 usage 모니터. 초과 위험/쓰기 효율 의심 시 Admin/Master에서 캐시·진단 기능 플래그(안전한 것만) 운영 가능. 사용자 기기 변경 없는 반복 탐색 비용 0 기준.

## 5. 명시적인 판단/STOP

- Cloudflare의 무료 tier는 **일/월 기준이 서로 다르고** 계정 전체/서비스별로 별도 측정. Free는 초과하면 더 사용해서 과금되는 것이 아니라 일부 서비스 **요청 실패** 위험도 있으므로 장기 활성 사용자 증가 시 Paid 계획을 시뮬레이션한다.
- 특정 제품 추가(KV, Queues, 별도 DO namespace)는 **기존 서비스 대비 전체 월간 비용과 운영 복잡도가 줄어든다는 근거가 있을 때만** 추진. 무료 한도 분산 자체가 목적이 아니라 **원본 사용자 1건 변경당 총 서비스 사용을 최소화**가 목표.
- R2 객체 PUT마다 추가 비용을 발생시키는 구조와 100k 사용자 주기 HEAD/polling은 경고. 기존 Worker HTTP 응답에 있는 변경 신호/완료 이벤트를 재사용하는 구성이 우선.
- **현재 상태:** 설계 결정 확정. PREVIEW app386 실기기 Stage416 Phase1 FAIL 유지; 이 문서 추가로 서버 기능이 수정/배포된 것은 아님. 실행은 Codex High 구현→Work 독립 검증→ChatGPT PREVIEW 배포/실측→사용자 확인→별도 TEST 승격.


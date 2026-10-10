# Stage416 — 개인 좋아요 최종상태 5분 + 공동 공개숫자 5분 + 개인 즉시 동기화

상태: **1단계 코드 원인 특정 + 최소 수정 commit / 격리 동작 재현 PASS. 전체 CI, 실제 PREVIEW 브라우저/Cloudflare D1 비용은 확인 전; 배포 없음.**
기준 preview `65f9947387c9bb37b90081cf3d1e1c92e0f20a57` (활성 Firebase PREVIEW app385), 2026-10-09 KST. 이 문서는 기존 `LIKE_PRIVATE_IMMEDIATE_PUBLIC_10MIN_STAGE415.md`의 **10분 지연 기준을 모두 대체**한다. 보호 기능은 유지. 사용자 승인 순서: Explore 좋아요 먼저 → 실사용 PASS 이후 팔로우.

## 사용자 확정 계약 (두 개의 서로 다른 5분)

1. **개인 기기간 즉시:** 좋아요/해제 순간 내 화면과 같은 계정 PC↔모바일에 최종 *의도된* 하트 즉시 반영(서버 확정 전에 private preview 가능). 다른 계정은 개인 하트를 보지 않음. 이전 신호가 최신 상태 덮어쓰기 금지. 캐시/페이지 이동/업데이트 때문에 서버 전체 재조회 불가.
2. **사용자별 마지막 입력 +5분:** 로그인 상태에서 여러 곡 좋아요/해제를 순서대로 누르면 사용자의 마지막 변경 후 5분간 입력을 묶어 **최종 의도만** 서버 canonical batch에 1회 접수. 그 사이 좋아요→해제 후 원래 상태로 복귀하면 그 항목 원본 W0. **서버에 접수되지 않은 입력은 절대로 공동 공개 집계에 포함하지 않음**. 5분 타이머는 클라이언트 처리 대기일 뿐 다른 계정의 확정 숫자와 무관.
3. **실제 종료 시도:** 브라우저 종료/페이지 unload 시 서버 미접수 최종 변경이 있으면 한번만 조기 전송을 *시도*하고 성공한 접수 시점부터 공개 집계 시작. 단순 탭 이동/앱 최소화에 따른 반복 flush는 서버비용 위험. 모바일 OS 강제종료에서 `pagehide`/keepalive는 **성공 보장 불가**; durable outbox/리런치 후 제한된 재전송 + idempotent operationId가 필수, 즉시 종료 뒤 그 앱을 다시 열지 않아도 확실하게 저장된다고 주장 금지. 동시에 동일 곡 PC/모바일 조작, 5분 사용자 outbox 재기동 순서 증명.
4. **공동 공개 카운트 집계 +5분:** **서버가 실제로 접수하고 유효한 원본 변경을 정착한 첫 이벤트**가 생길 때만 5분 고정 이벤트 창 시작. 여러 사용자·여러 곡을 함께 모으되 완료시간 연장 금지. 5분 종료 시 변경곡 각각의 최종 public likeCount/Feed/profile/card를 한 번만 발표. 5분 창이 비면 중단, 미변경 시간에는 cron/DO alarm/원본 D1 읽기·쓰기/공개 RTDB 방송 0 목표. 공개 숫자는 private 하트와 분리; 처음 누른 사람만 늦는 것이 아님. 첫 40/80 밖의 곡 누락 금지.
5. **정확한 시간 예:** A 개인이 10:00 좋아요 → 10:05까지 의도 유지하고 서버 accepted → 공개 공동 window 10:05–10:10 → 10:10 public likeCount 반영. A가 10:00:10에 실제 종료하고 조기 전송이 성공하면 공동 window 10:00:10–10:05:10 시작. 10:04에 A가 원상복구한 경우 A의 접수 W0, 새로운 공개 창 없음.
6. 비활성/미접수 최초 좋아요로 DO alarm 시작 금지. 다른 사람의 공개 수치가 5분 동안 그대로인 것은 정책상 정상. 실제 공개 숫자가 틀리거나 누락·중복되는 것은 FAIL.

## 1단계 — 영상 '개인 소셜 스냅샷' 원인 확인 [착수, 1차 결과]

- 사용자 제공 실제 PREVIEW 영상 `20261009-0008-08.2339219.mp4` (약 60.7초) 확인. **영상의 48초 부근 '내 좋아요 곡' 이동 후 53초 화면에서** `개인 소셜 스냅샷` 줄이 `LOCAL 0 · Worker 2, D1 쿼리 R5/W0, rows read 11/W0`로 보임. 영상 초반/좋아요 버튼 조작 구간에서는 동일 엔드포인트 증가가 명확히 나타나지 않고, 58초에도 대체로 같은 계측값. **R5는 HTTP 요청 5개라는 뜻이 아니라 서버가 기록한 D1 조회 SQL 5회**. 이 영상만으로 좋아요 1회당 snapshot 1회라고 결론 금지. 페이지 전환·최초 캐시 미스·이전까지 누적 계측일 수 있음. R2/Worker 사용도 별도 집계.
- 실제 코드: `src/components/CacheDiagnosticsOverlay.tsx` '개인 소셜 스냅샷' = `/v1/me/social-snapshot`; `src/services/exploreSocialSnapshotService.ts` `getExplorePersonalSocialSnapshot`는 유효 로컬 캐시 있으면 `LOCAL HIT`, 없으면 1회 fetch (동시 요청 single-flight). `src/services/exploreSocialService.ts` `loadExploreFollowingBundle`가 정상 follow cache missing일 때 해당 snapshot GET 호출. 정상 계정에 있는 snapshot은 like/follow 변경 시 로컬에서 patch. 따라서 **캐시 미스 1회 GET 가능성**이 가장 구체적인 가설.
- **아직 미확인:** 영상의 동일 endpoint가 좋아요를 누를 때마다 실제 새로 요청되었는지(제공 clip은 그 인과관계를 증명하지 않음), 앱별 원본 persistent cache 손상/삭제, local-only hit 카운트, SQL R5 및 Rows Read11의 내부 테이블/쿼리 구성, 다른 사용자·캐시 상태에서 증폭, LIVE 분당/월 청구 비용.
- **다음 실제 감사:** 단일 test UID/cache warm로 진입→좋아요 1/3/6개→해제→같은 페이지 재진입→내 좋아요로 이동→PC↔모바일 → 진단 RESET 분리 후 endpoint별 Worker/D1 physical rows_read/rows_written/R2 A/B 재계측. 동일 세션 반복 snapshot GET이면 호출 원인 수리, 필요한 부분만 cache patch; **새 snapshot 무조건 전체 fetch 금지**. 정상 warm cache read W0 목표.
- **수정 게이트:** 1회 cold bootstrap이라면 단순히 R5라는 숫자만 보고 기능을 지우지 말고 해당 SQL query/real rows billed를 비교해 부분·R2 snapshot으로 축소 가능한지 검증. 단순 진단 표시 제거는 불합격.

## 2단계 — 개인 PC↔모바일 즉시 preview [1단계 원인 고정 후]

- 현재 `src/services/exploreLikeService.ts`의 `publishConfirmedLikeSignal127`은 **서버 intake ACK 후** RTDB 발신. 클릭 직후 private signal(잠정 최신 의도)을 별도로 발신하려면 기기별 sequence + 서버 canonical revision + pending operationId를 동기화해 이전 신호가 뒤늦게 덮지 않게 설계. 소켓/새 서비스 금지; 기존 userSync private channel 재활용 가능한지 검증.
- 유효 UI/임시 state와 확정 canonical을 명시적으로 분리. 오프라인/신호 실패 때 최종 server state와 수렴 가능, 무한 R2/Worker polling 없이 동작. 개인 즉시 하트/내 좋아요 목록과 공개 숫자 불일치 의도한 5분 정책 존중.
- RTDB 1회당 bytes/cost, 두 기기 동시 입력/회복, 당일 구버전 클라이언트 호환성, 중복 정착 W0/W1~2 검증 후 다음 단계.

## 3단계 — 개인 최종상태 +5분 저장과 조기 종료 [2단계 PASS 후]

- 현행 `EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000`만 치환하지 말 것: `src/services/exploreLikeService.ts` `keepalive`/hidden/pagehide 실패·ACK 재시도·공개 signal을 함께 분리.
- 마지막 입력 trailing 300_000ms, 동일 곡 최종 state만, 한 사용자 여러 곡 1 bounded intake batch(기존 max50 초과 큐 처리 분할/완전성 필요). 종료시 불필요 R/W0, 실제 조기 전송 1회, 송신 중 재차 입력/replay idempotent. 최소화/페이지 이동 단순 동작으로 D1 추가 flush하지 않음; 모바일 blur vs close 판별 불가능한 실제 한계 명시.
- 성공 접수 첫 원본 이벤트만 서버 집계 5분 창 기점. 실패한 송신은 private outbox pending 유지, 영구 유실 또는 누락된 공개 숫자 정착 금지.

## 4단계 — 공개 공동 5분 window [개인 저장 PASS 후]

- `cloudflare/explore-worker/canonical/preview-entry.js` 현재 5초 DO는 canonical `likes` 및 `track_stats`와 `repairSharedPublicLikeCounts191`를 **함께 수행**하므로 300초로만 바꾸면 개인 원본 정착까지 미룸. 반드시 canonical/private ack와 public projection materialization 분리. 단일 Durable Object 또는 최소한의 재사용 가능한 이벤트 관리자 우선, 변경 없으면 alarm 0.
- `repairSharedPublicLikeCounts191`는 최대 first80만 읽어 **전 곡 변경 source 아님**. 직접 변경곡 ID/서버 confirmed version을 bounded durable tracking에 넣고, 300초 후 실제 changed-ID만 R2/public card/Feed/profile/genre/search 필요 경로 및 알림 갱신. 수천 변경곡·기존 shared D1/old Worker 동작에서도 누락 없고 원본 DB scan 금지.
- 현재 브라우저가 ACK 직후 `publicSync/exploreLike`에 쏘는 전역 RTDB signal은 premature 공개 polling/비용 증가. 변경곡 확정 후 서버 신뢰 public signal 설계, 기존 앱 receiver와 공유 Rules 동시에 동작할 때 일치 검증. **공유 Rules/원본 구조 destructive 변경 승인 없이 금지.**
- **중요 비용 판단:** canonical `track_stats`를 5초마다 변경하는 기존 코드가 남으면 공용 UI 갱신만 5분 늦춰도 physical D1 W는 그대로일 수 있음. 물리적 행 W 절감 검증 없으면 비용 개선이라고 표시 금지.
- exact per-5m public update/zero idle + first80 outside/last-second/double-actor/unlike/backfill no migration/cold reader & old clients tested before real activation.

### 4단계 추가 확정 — Master 관리자 공개 공동집계 주기 설정 (2026-10-10)

- 4단계 구현에 **Master 관리자 메뉴**의 '공개 좋아요 공동집계 주기' 설정을 함께 포함한다. 선택값 **1분 / 3분 / 5분 / 10분 / 20분**, 기본값 **5분**.
- 변경한 주기는 **이미 시작된 집계 창에는 적용하지 않고 다음에 새로 시작하는 공동집계 창부터 적용**한다. 진행 중 이벤트의 마감 시간은 고정하고 누락·중복 정착이 없어야 한다.
- 공개 숫자 공동집계 주기만 변경하며 **개인 하트·같은 계정 동기화·개인 저장 주기와 완전히 분리**한다.
- 관리자 설정은 권한 확인·입력값 검증·변경 이력·비용 영향 확인 후 구현. 현재 app391 동작 및 Firebase/Cloudflare 배포는 바꾸지 않는다. 사용자 승인 전 Stage4 선행 배포 금지.

## 5단계 — 독립 감사/비용 실측 → PREVIEW 검증 → 팔로우

- Codex High 구현, Work read-only 독립 감사, ChatGPT release gate → 사용자 PC↔mobile QA → TEST는 별도 승격, PROD 명시 승인만.
- 비교: 1/10/100/1000명, 1/10/100/1000곡, 같은곡 반복 탭, 모바일 종료 0/1/2초, quiet 30분, 재방문·앱 버전업, 캐시 미스/오래된 값, 다른 계정 공개 수치 5분 후 parity, D1 physical rows R/W, R2 class A/B, Worker/DO invocations/storage, RTDB sent_bytes, 실제 Functions overhead. 이전 총비용 대비 감소하고 UI·데이터 손실/지연 위반 0에서만 적용.
- 보호: 사용자 데이터 원본 PREVIEW/TEST/PROD 공유. D1 W1~2 / W3+ FAIL, 추가 fullscan/backfill/migration/delete 없음. Studio save-heart/ Music Note/Library/ Explore 팔로우/검색/공개/프로필/UI 정상 기능 고정.
- **좋아요 PASS 다음**에만 팔로우 동일 '개인 즉시 + 공개 팔로워 숫자 묶음' 구조 별도 분석. 팔로우 기존 +30초를 지금 함께 변경 금지.

## 현재 실제 상태

- preview 앱 app385, 좋아요는 기존 +5초, 공개 숫자 기존 ~5초. **코드 수정·Worker/Firebase/RTDB Rules/Functions/D1 구조·데이터 변경·배포 0** (이 문서는 계획 전용).
- Phase1 가설 확인 후 코드 변경/실측 지원 불가·안전성 미입증이면 STOP + 구체 blocker 보고, 아무것도 모르고 5분 타이머 치환 금지.

---

## 1단계 실제 추가 감사·최소 수정 결과 (2026-10-09 KST)

- **영상 근거 상세:** 사용자가 캡처한 정상 Explore 목록 구간 38~43초 `Cloudflare LOCAL0 Worker1 / D1 R0/W0` 및 `공개곡 좋아요 숫자 확인 LOCAL0 Worker1 D1 R0/W0` 확인. 약48초 `내 좋아요 곡` 탭 이동 후 53초 `개인 소셜 스냅샷 LOCAL0 Worker2, D1 query R5/W0, D1 rows_read 11/rows_written 0`, 마지막 사유 `FULL 200 · PERSONAL SETTLE...` 확인. 총계 `Worker4, D1 query R5, rows_read21`은 다른 endpoint 포함이며 `R5`를 좋아요 **클릭 1회 비용 또는 5개 HTTP 요청**이라고 해석하면 안 됨.
- **호출 원인 정확히 특정:** `ExplorePage.tsx` My Likes mount에서 `ensureExplorePersonalLikeCrossOriginParity357` 호출. `exploreLikeService.ts`의 RTDB accepted-signal 수신이 각 변경곡에 `snapshotPending127` guard를 만들고, app359이 signalVersion 미정착이면 서버 `PERSONAL SETTLEMENT 189` 안전검증 가능. **추가 비용 결함:** `legacyNeedsRepair357=false`인데 `needsSettlementUpgrade359=true`인 경우에도 이전에는 `requestRepair127` 및 `EXPLORE_LIKE_REPAIR_ATTEMPTED_182=''`를 무조건 적용해 과거 app358 **FULL repair**까지 다시 켰음. 이 조합은 My Likes 방문 및 새 RTDB accepted signal마다 중복 개인 snapshot/원본 확인을 유도할 수 있음. 정상 캐시 첫 진입 GET 경로와 혼동하지 말 것.
- **수정 커밋:** `src/services/exploreLikeService.ts`에서 실제 **legacyNeedsRepair357**인 경우에만 app358 repair target/attempt reset. app359 **settlement-only**에서는 기존 app189 targeted/queue-empty/ETag proof만 유지. 서버 Worker·쿼리·수신 UI·RTDB signal·좋아요 저장 타이머 수정 없음. 코드 최초 commit `1980a9bcd9487f7e8126219f3e509cb8de1efe16`, 후속 품질 트리거 `e480d24fb12888d101d62060864755eb87689be0`.
- **회귀검증 추가:** `scripts/verify-127-atomic-personal-like.mjs` 기존 frozen 테스트 끝에 실제 app357/359 parity 함수 소스를 TypeScript transpile로 격리 실행한 세 조건 검증을 append, commit `42738dab933ba2e13a2995ca0fded8bb19106c12`. 같은 원본 함수를 함수-의존성 mock에 넣어 수동 독립 재현 결과 **3/3 PASS**: (1) settlement-only → no app358 repair; (2) 진짜 legacy gap → app358 + app189 그대로; (3) healthy revisit → 호출 0. 상위 read-only 호출 그래프/경계 10/10 PASS. GitHub Actions TypeScript/Build/전체 frozen 회귀 **최종 커밋 결과 미확인**.
- **한계와 리스크:** 이 변경은 **불필요하게 재가동되던 과거 FULL repair**만 차단한다. 현재 `snapshotPending127` 중 아직 확정 안 된 값의 **app189 targeted settlement**는 정확성 보호 때문에 남아 있다. 따라서 영상의 모든 R5가 0이 된다고 주장하지 않음. 계정 간 RTDB 단절/실제 오래된 원본 교정에서 D1 R은 여전히 가능하고 올바른 행동. 실제 로그인 test account에서 각각 매 실행 별 RESET 후 비용 계측 및 PC↔모바일/구형 앱 실사용 필수.
- **배포 상태:** preview **소스 commit만 변경**, 제품 배포 app385 그대로. Firebase Hosting/Functions/Rules, Cloudflare Worker/D1/R2, 공유 사용자 원본, main/TEST/production 변경 0. Stage416 Phase 2/3/4는 미착수.
- **다음 게이트:** 408 GitHub QA exact HEAD TypeScript/Build/127/175/178/191/192/197/390 및 416 포함 확인 → Work 독립 감사 → pending guard가 없는 warm 계정에서 My Likes 반복 D1 R0 및 실제 snapshot `PERSONAL REPAIR 182` 추가 0 측정 → 앱 배포 안전성 판단; Phase2 개인 즉시동기화는 이 기준 PASS 후.

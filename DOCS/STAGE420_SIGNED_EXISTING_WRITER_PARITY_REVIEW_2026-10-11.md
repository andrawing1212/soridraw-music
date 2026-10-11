# Stage420 기존 Writer + HMAC 대안 — 실제 연결 불일치 긴급 검토 (2026-10-11)

## 기준 / 범위
- 대상: `preview` HEAD `ec7c5c74d9e731bbedd05298db2424090950fe2a` 확인 시점; Stage420 기능 후보는 `008c2db15b3cc9710c4e6b3bfe73e02b64d4a8da`부터 포함. app397 독립 Hosting 배포 `132ed10e58351b227f616d60786a5eaacc62a451`은 정상 유지한다.
- 이는 **ChatGPT 읽기 전용 소스 경로 대조**이다. Codex 구현/Work 별도 독립 감사/실기기 또는 10만 DAU 과금 검증이 아니다.
- 코드, CI, Worker, Firebase Rules, 공유 사용자 데이터, Hosting, main/production은 변경하지 않는다.

## 신규 확인: 신호 생산자와 수신자 불일치 — RELEASE FAIL/HOLD
1. `functions/src/index.ts`: `STAGE420_ATOMIC_APPROVAL_CUTOVER_ACTIVE=false`인 동안 `publishExploreLikeIntent420`은 `publishGuardedLikeSignal420`을 호출한다.
2. `functions/src/exploreLikeAbuseGate420.ts`: 위 legacy 경로는 `privateLikeSync420/$uid/display`에 승인/변경 신호를 쓴다.
3. `src/services/exploreLikeService.ts`: 새 Stage420 클라이언트의 `startGuardedLike420`은 `subscribeGuardedLikeIntent420(..., 'atomic-v2')`를 호출한다.
4. `src/services/exploreLikeGuardedTransport420.ts`: `atomic-v2`는 `privateLikeSync420/$uid/displayV2`만 구독하고, 두 신호를 동시에 구독하지 않는다.
5. 새로 채택한 `cloudflare/explore-worker/canonical/preview-entry.js`의 `STAGE420_SIGNED_LEGACY_INTAKE_OPEN=false` 대안은 기존 baseWorker/069/075를 유지하는 방식이며, Firestore atomic Eventarc `displayV2` 생산자를 켜지 않는다.

**결론:** 대안 Worker + 서버 legacy approval + 새 Stage420 앱을 현재 형태로 함께 ON하면, 정상 수신 신호가 다른 경로에 기록되어 PC↔모바일 잠정 좋아요 표시 동기화가 누락될 수 있다. 현재 세 플래그가 OFF이므로 이 불일치가 실제 배포된 app397 장애라는 뜻은 아니다.

## 함께 확인된 기존 차단
- `database.rules.json`의 `userSync/$uid/.write`는 자기 UID 클라이언트 쓰기를 계속 허용한다. `exploreLikeIntent416` 직접 기록과 구형 미서명 Worker 경로를 유지한 채로는 서버 120분 잠금을 강제했다고 주장할 수 없다.
- 실제 Cloudflare 425 read-only Run `38125099710`: D1 `explore_like_cutover_control_174` 및 `explore_like_writer_phase_419` 미존재, 171 파생 테이블 비어 있음. 따라서 D1-only 426 전체 교체를 지금 활성화할 수 없다.
- 기존 baseWorker 앞 `verifySignedLegacyLikeIntake420`은 `validateExploreAuth307`(`/auth-test` 내부 baseWorker 호출)을 한 번 더 경유한다. 기존 canonical 자체의 인증 비용과 중복하는지, 실제 Cloudflare 처리시간·CPU·외부 Auth 요청/캐시 여부는 실측 전 미확정.
- 비용 시나리오: 100,000 DAU × 하루 5/20회 × 30일 = 월 **1,500만/6,000만 클릭**. 이는 요청/승인 상한 추산이지 Worker batch 수·유료 조회 수·실청구액이 아니다. 30초 묶음 효과, Firebase Functions/RTDB, Worker/D1/DO/R2, 인증 중복 및 한국 모바일 p95를 포함한 합계 검증 전 가격 합격 금지.

## Codex High 단일 수정 범위 (다른 정상 기능 변경 금지)
- **기존 Writer+서명 승인 대안에서만** 서버가 쓰는 legacy `display`를 새 앱의 단일 수신 경로로 선택하도록 명시적으로 일치시킨다. `displayV2`는 *Firestore atomic + 실제 onCreate 생산자가 함께 활성화되는 별도 릴리스일 때만* 선택한다. 둘을 동시에 구독하거나 서로 다른 버전 카운터를 섞지 않는다.
- 단일 연결 계약 검증을 추가한다: ① legacy server->client `display`, ② atomic server->client `displayV2`, ③ 둘 모두 OFF일 때 app397 기존 416 수신, ④ 로그인 변경·오프라인 복귀·PC↔모바일 양방향·역순/중복 신호, ⑤ 저장보다 먼저 UI notify 금지(app141), ⑥ 기존 PWA v4 outbox 보존.
- 420 signed intake에서는 허가된 최대50 mutation HMAC을 모두 확인한 뒤 기존 canonical Writer로 정확히 한 번 전달하고, 거부·키 누락 시 D1/R2 처리 0. 인증 중복 비용과 실패 응답/CORS를 집중 검증한다.
- 기존 like/follow/app197/app390/Stage418, Studio 하트, Music Note/Library, app397 Gemini hotfix, UI/반응형 유지. 전체 TS/Build/기존 회귀·신규 연결 검증을 exact SHA에 고정.
- **실행 금지:** Stage420/426 켜기, shared RTDB Rules 폐쇄, Firebase/Cloudflare/Hosting 배포, DB schema/migration/backfill, user data 변경, main/TEST/PRODUCTION 승격. Codex source-only commit 후 Work 독립 read-only 감사.

## 운영 승인에 남는 별도 문제
- 구형 앱의 열린 탭/기기 장기 오프라인/v4 pending을 보호하면서 shared Rules 416 직접쓰기를 닫는 **강제 갱신 또는 유예 정책**은 디렉터 승인 전 적용 금지.
- 실 Cloud Monitoring HOLD 알림 수신, Master 실제 역할, 한국 PC/mobile p95, 10만 DAU 월 합산 실비용과 TEST→PROD artifact parity는 미검증. 본 문서 작성으로 Stage416 **28%**, 앱 속도 **5/5·100%(기존)**, Stage420 운영 **4/10·40%**를 올리지 않는다.

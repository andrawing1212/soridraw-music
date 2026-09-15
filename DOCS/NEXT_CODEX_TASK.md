# NEXT CODEX TASK

상태: **PREVIEW Catalog 전체 Firestore 재구성 차단 코드 반영 / CI PASS / 실환경 배포·비용 측정 전 / TEST 승격 금지**

## 2026-09-15 최우선 다음 작업
- 기준 branch: `preview`
- Catalog 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- 검증 Run: `34946586905` — TypeScript / Build / Worker syntax / no-fullscan verifier PASS
- 일반 Music Note/Library Catalog GET 및 delta 충돌 복구에서 Firestore 전체 collection rebuild를 호출하지 않는다.
- 새 기기는 이미 존재하는 R2 Catalog를 1회 받고 로컬 캐시를 만든다. R2가 없으면 fail-closed + bounded legacy bundle fallback이며 자동 full scan 금지.
- 다음은 사용자 요청 시 PREVIEW에 필요한 앱/Media Worker만 배포하고, 새 기기/캐시 삭제 상태에서 Firestore read가 곡 수에 비례하지 않는지 실측한다.
- 실측 합격 전 `main` TEST 승격 금지. TEST/PRODUCTION의 기존 읽기 구조는 PREVIEW 안정화 후 동일 exact tree 승격으로 맞춘다.
- PRODUCTION은 명확한 정식배포 승인 전 금지.

상태: **PREVIEW 앱 091 / Worker 054 배포 완료 / 054 자동검증 PASS / 실제 좋아요 D1 W1 실측 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **091**
- 실제 PREVIEW Worker: **054** / `40d84c03-2aa9-4aaa-8539-676b48c96d6d`
- 091 제품 commit: `22d11a7ce22b822457ed10eaf9001da5242d5e62`
- 091 App Run `34921079977` — PASS
- 054 검증 Run `34924497426` — PASS
- 054 배포 Run `34929734785` — PASS
- 054 validated candidate commit: `a9d2a0d0bfa616f85086419dc3ca081c945e1842`
- 054 canonical source SHA256: `86bcfa28512712e4e2c8e221da06ed788abb21aa3177134a98e1f0160d5ba9e4`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 091 보호 기준
- Explore / 내 공개곡 / 좋아요 곡의 같은 곡 숫자는 공통 display ledger 기준.
- persistent Feed/Profile/Liked cache에는 raw/canonical 숫자만 유지.
- pending/accepted 화면 숫자는 로컬 overlay로 분리.
- 090의 `0→1` floor 금지.
- Worker batch ACK를 aggregate 완료로 간주하지 않음.
- 5초 batch + page-exit fallback 유지.
- PC↔모바일 account sync signal 유지.

## Worker 054 변경
정상 좋아요 batch의 D1 `api_rate_limits` write를 제거하고 Cloudflare Rate Limiting binding으로 대체.

- `LIKE_RATE_LIMITER`: 60 requests / 60s, user uid key.
- binding 누락 시 503으로 차단; fail-open 금지.
- 초과 시 429 + Retry-After 60.
- 중복 좋아요 방지는 기존 canonical `likes(track_id,user_uid)` idempotency 유지.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- 정상 좋아요 1 batch 예상 즉시 D1 write: **W1**.
- `api_rate_limits` hot-path D1 write: **0**.

## 054 자동검증
Run `34924497426` PASS:
- 054 edge limiter PASS
- 기존 Explore like cost contract PASS
- W1 queue/deferred aggregate PASS
- 085~091 regression PASS
- 081 batching PASS
- 084 publication PASS
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Wrangler config dry-run PASS

## 054 PREVIEW 배포
Run `34929734785` PASS:
- source SHA exact match PASS
- D1 read-only preflight PASS
- required tables / seeded=1 / explore032_* triggers / like processor 확인 후 배포
- `soridraw-explore-preview` 배포 성공
- Current Version ID `40d84c03-2aa9-4aaa-8539-676b48c96d6d`
- `LIKE_RATE_LIMITER` binding 확인
- cron `*/10 * * * *` 유지
- live `/v1/feed-revision` HTTP 200 PASS
- revision request D1 R0/W0 PASS
- TEST/PRODUCTION Worker 배포 없음
- temp deploy workflow/trigger 정리 완료

## 지금 할 일 — 사용자 PREVIEW 실측
1. Dashboard D1 수치를 초기 상태에서 확인.
2. 좋아요 1곡만 누르고 5초 이상 기다림.
3. 즉시 D1 write가 **1 증가**하는지 확인.
4. 좋아요 해제 1회도 같은 기준으로 확인.
5. 여러 곡을 5초 안에 눌렀을 때 batch 1회로 묶이는지 확인.
6. Explore / 내 공개곡 / 좋아요 곡의 하트/숫자 일관성 유지 확인.
7. PC↔모바일 같은 계정 수렴 확인.
8. warm page 재진입 + 변경 없음 server R/W 0 목표 확인.

### 판정
- 실제 정상 좋아요 1 batch가 D1 W1이면 054 비용 목표 PASS 후보.
- W2 이상이면 어떤 쿼리가 추가 write를 만드는지 진단 후 TEST 승격 중단 유지.
- Firestore account sync signal write는 D1 W1과 별도이며 batch당 1회 구조를 유지.

## 금지
- 사용자 데이터 migration/backfill/delete/overwrite
- D1 schema destructive change
- 클릭별 서버 요청
- 전체 Feed/Profile scan
- 앱 업데이트 이유의 전체 cache wipe
- user Firestore liked-ID 배열 저장
- UI/CSS 비요청 변경

## 승격
- TEST: **091 정확성 + Worker 054 실제 D1 W1 비용 실측 PASS 전 금지**.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.

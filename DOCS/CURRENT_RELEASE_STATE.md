# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 066**
- PREVIEW 066 App version source: `cf9450839e848b4adc3a53ebb1227cf33cf38c0a`
- PREVIEW 066 App Release checkout: `dcded183270cfb1d5427ea5059deb2d6ba481a7a`
- PREVIEW 066 App Run: `34602732958` — PASS
- PREVIEW 066 코드 merge: `9909f1da16811153a5ba15795b27199c15ab4950`
- PREVIEW 066 Shared D1 release system merge: `8279447ca73996f6a5aef178d9c59602f9fbf82a`
- Release System Audit Run: `34596887335` — PASS
- Shared D1 066 additive schema Run: `34597025382` — PASS
- PREVIEW 066 Worker Run: `34597109785` — PASS
- PREVIEW Worker active Version ID: `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Worker: 035 deferred aggregate + 036 derived intake + 037 revision head-only + 038 compact queue + 039 stable dual-queue boundary + 064 release-origin parity
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active
- 고정 TEST→PRODUCTION Workflow: `.github/workflows/soridraw-release-promotion.yml`

## 2. 066 핵심 변경
### 좋아요 intake read 최적화
- 공개곡/프로필/현재 like count는 기존 derived 상태를 사용.
- 개인 liked 관계만 canonical `likes`를 authoritative source로 유지.
- 원본 `tracks/public_profiles/track_stats` 중복 read 제거.

### compact like queue
- 새 additive `explore_like_batches_066` 사용.
- `WITHOUT ROWID` + `batch_id TEXT PRIMARY KEY`.
- `created_at,batch_id` index 유지.
- 기존 `explore_like_batches_035` 삭제/변경 없음.
- 새 Worker는 066 queue 우선, 035 fallback/호환 drain 유지.
- 두 queue는 고정 chronological boundary 안에서 처리.

### same-account 숫자 동기화
- 기존 root `users/{uid}` listener 재사용.
- 성공 batch의 실제 `liked + likeCount`를 account signal에 사용.
- 다른 기기가 signal 순간 Explore 화면 밖이어도 짧은 로컬 patch cache로 숫자까지 재적용.
- 새 Firestore listener 없음.

## 3. 자동 검증/배포
- TypeScript PASS.
- Build PASS.
- compact queue fixture PASS.
- old/new queue rollout PASS.
- stable boundary PASS.
- 100 same-track aggregate PASS.
- net-zero aggregate PASS.
- Worker dry-run PASS.
- Shared D1 exact migration/postflight PASS.
- PREVIEW Feed/Profile/revision/cron smoke PASS.
- warm revision `R0/W0` PASS.
- Firebase PREVIEW Hosting exact build PASS.
- 실제 `preview.soridraw.com` app-version `066` PASS.
- TEST/PRODUCTION branch, Hosting, Worker unchanged PASS.

## 4. 사용자 실사용 비용 검증 — PREVIEW 066
### 1곡 좋아요
- `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`.
- D1 rows **`R2/W2`**.
- 065 `R2/W3` 대비 write W3→W2 PASS.

### 1곡 좋아요 해제
- `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`.
- D1 rows **`R2/W2`**.
- 065 `R3/W3` 대비 read R3→R2, write W3→W2 PASS.

### PC 3곡 좋아요 해제 → 모바일 자동 동기화
2026-09-11 사용자 실사용 확인:
- PC에서 공개곡 3개를 연속 좋아요 해제.
- 약 1분 뒤 모바일에서 **하트/숫자 상태가 정상적으로 함께 변경됨 — PASS**.
- PC/모바일 진단 화면 모두 `/v1/me/likes/batch` **Worker 1**로 확인.
- D1 query `R1/W1`.
- D1 rows **`R9/W2`**.
- 요청당 평균 `R9/W2`.
- 해제 3곡이 **서버 요청 1회 / queue write W2 한 번**으로 묶인 것이 실사용으로 확인됨.
- read `R9`는 기존 personal like row가 있는 해제 경로에서 대략 3 rows/곡으로 증가하는 현재 구조와 일치.
- 중요한 비용 결과: 곡 수가 3개로 늘어도 queue write는 **W2/batch로 고정**됨.

## 5. 비용 판정
- 단일 like/unlike: 실제 인증 PREVIEW **R2/W2** PASS.
- 3곡 unlike batch: **R9/W2** PASS.
- 065 대비 queue write는 W3→W2로 약 33% 감소.
- D1 무료 write 10만 rows/일 단순 환산상 likes batch 약 **5만 batch/일** 후보.
- 3곡을 한 번에 처리해도 W2이므로 여러 좋아요/해제를 묶을수록 write 효율이 좋아짐.
- read는 곡 수와 현재 개인 liked 상태에 따라 증가하므로 이후 대규모 최적화 시 read 쪽만 별도 검토 가능.
- Explore resume/reentry LOCAL revision cache는 기존 zero-read 기준 유지.

## 6. 기능 최종 판정
- PREVIEW 066 App/Hosting: PASS.
- PREVIEW 066 Worker: PASS.
- Shared D1 additive schema: PASS.
- W3→W2 비용 최적화: 사용자 실사용 PASS.
- PC→모바일 3곡 좋아요 해제 same-account 하트/숫자 자동 동기화: PASS.
- 기존 1곡 like/unlike 비용/표시: PASS.
- 10분 deferred public aggregate 보호: PASS.
- Explore revision warm R0/W0 보호: PASS.
- UI/CSS 변경 없음.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.
- TEST/PRODUCTION unchanged.

## 7. 남은 확인/위험
- 이번 실사용으로 PC→모바일 방향의 다중 해제 동기화는 PASS.
- 반대 방향(모바일→PC)은 065에서 단일 동기화 기준을 이미 보호하고 있으나, 066 다중 동작에 대한 별도 추가 계측은 필수 아님.
- W1 최적화는 현재 자동 진행하지 않는다. `created_at` lookup index 제거/full scan, retry/idempotency 저하, 동시성 위험이 생기면 진행 금지.
- 현재 안전 합격선은 **W2/batch**.

## 8. 데이터/환경 안전
- Shared D1: additive table/index 2개만 추가.
- 기존 canonical user/content rows 변경 없음.
- 기존 035 queue/table 삭제 없음.
- Firestore Rules 변경 없음.
- Firebase Functions 변경 없음.
- TEST 배포 없음.
- PRODUCTION 배포 없음.

## 9. 다음 단계
- PREVIEW 066은 현재 사용자 실사용 기준 **최종 PASS**로 본다.
- 다음 릴리스 단계는 사용자가 `테스트배포`를 명시할 때만 TEST로 승격.
- PRODUCTION은 별도 명확한 승인 후에만 진행.
- 추가 비용 최적화(W1 포함)는 별도 사용자 요청이 있을 때만 새 PREVIEW 작업으로 시작.

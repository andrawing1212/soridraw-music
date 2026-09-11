# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 068**
- PREVIEW 068 exact app source: `b12a108272b469ce346e6af0c7b102d90f0acc2e`
- PREVIEW 068 App Run: `34621166906` — **PASS**
- PREVIEW 068 Worker Run: `34621294524` — **PASS**
- PREVIEW 068 active Worker Version ID: `b2993f8c-bd23-4249-a652-ee379d6c50a8`
- PREVIEW Worker canonical SHA256: `822252880f6c52eb5453920b143f71a45fce120b05eff2f82542613cd68c4de8`
- Shared D1 066 additive schema Run: `34597025382` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active

## 2. 066에서 확정된 좋아요 비용 개선
- 1곡 like: D1 `R2/W2` 실사용 PASS.
- 1곡 unlike: D1 `R2/W2` 실사용 PASS.
- 2곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R6/W2`.
- 3곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R9/W2`.
- 여러 곡을 묶어도 queue write는 `W2/batch`로 고정됨.
- 065의 W3 대비 write 약 33% 감소 유지.

## 3. 068 수정 내용
### same-account local like/count overlay
- PC/모바일 같은 계정 동기화에서 최근 로컬 좋아요 patch를 Feed payload보다 우선하도록 보호.
- Feed가 다시 들어와도 최신 하트 + 숫자가 stale public count에 덮이지 않도록 함.
- 기존 `users/{uid}` root listener 재사용.
- 새 Firestore listener 없음.
- 새 사용자 데이터 구조/migration/backfill 없음.

### like-only Feed 재확인 축소
- `/v1/feed-revision`에 기존 032 derived change journal 기반 bounded changed-track delta를 추가.
- 안전한 latest-feed 변경은 기존 기기 캐시에 로컬 merge.
- 좋아요 집계 하나 때문에 `/v1/feed` 전체를 다시 읽는 경로를 제거/축소.
- 구조 변경, 인기순 재정렬 등 정확성이 필요한 경우에는 기존 full-feed fallback 유지.

## 4. 068 배포 자동검증
### App Run `34621166906`
- exact source `b12a108272b469ce346e6af0c7b102d90f0acc2e`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=068` PASS
- TEST/PRODUCTION 비변경 PASS

### Worker Run `34621294524`
- preflight PASS
- canonical Worker deploy PASS
- Feed smoke PASS
- Profile smoke PASS
- like batch route smoke PASS
- revision head-only warm `R0/W0` PASS
- 10분 like aggregate cron PASS
- TEST/PRODUCTION Worker 비변경 PASS
- active Worker `b2993f8c-bd23-4249-a652-ee379d6c50a8`
- D1 migration/seed/write 없음

## 5. 사용자 PREVIEW 068 실사용 검증 — 2026-09-12
사용자가 동일한 PC → 약 1분 → 모바일 순서로 like/unlike를 각각 재검증함.

### 좋아요
1. PC 기준 초기 상태: Worker/D1 0.
2. 약 1분 뒤 PC:
   - `/v1/me/likes/batch` Worker 1
   - D1 query `R1/W1`
   - rows `R6/W2`
   - feed revision `LOCAL 2 / Worker 0`, D1 `R0/W0`
   - 추가 `/v1/feed` 전체 재요청 없음
3. 모바일 확인:
   - 하트와 숫자 모두 정상 동기화
   - 화면상 테스트 곡 숫자 `2` 확인
   - Cloudflare `LOCAL 1 / Worker 0`
   - feed revision D1 `R0/W0`
   - `users:onSnapshot 1`
   - 모바일 추가 Worker/D1 없음

### 좋아요 해제
1. PC 기준은 직전 like 테스트 누적 진단값을 유지한 상태.
2. 약 1분 뒤 PC 누적:
   - `/v1/me/likes/batch` Worker `1 → 2`
   - D1 query `R1/W1 → R2/W2`
   - rows `R6/W2 → R12/W4`
   - 즉 이번 unlike batch 추가분도 `R6/W2`
   - feed revision은 계속 LOCAL, Worker 0 / D1 0
   - 추가 `/v1/feed` 전체 재요청 없음
3. 모바일 확인:
   - 하트 해제 + 숫자 `2 → 1` 정상 동기화
   - Cloudflare `LOCAL 2 / Worker 0`
   - feed revision D1 `R0/W0`
   - 모바일 추가 Worker/D1 없음

## 6. 현재 비용 판정
- like/unlike batch write `W2/batch` 유지 PASS.
- same-account PC↔모바일 하트 + 숫자 동기화 PASS.
- 정상 캐시 모바일 확인에서 Worker/D1 0 PASS.
- 067에서 발생하던 like 후 추가 `/v1/feed` 전체 읽기 재현 안 됨.
- Explore revision LOCAL zero-read 보호 PASS.
- 이번 사용자 실사용 기준으로 **068 좋아요 경로 비용/동기화 문제 해결 PASS**.

## 7. 현재 보호 기준
- PREVIEW 좋아요 1분 batch.
- 10분 deferred public like aggregate.
- compact queue `W2/batch`.
- PC↔모바일 same-account 하트 + 숫자 동기화.
- 기존 Firestore root user listener 재사용, 새 listener 금지.
- Explore resume LOCAL revision cache.
- Music Note/Library Local First.
- UI/CSS/반응형 변경 금지.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.

## 8. 현재 판정
- PREVIEW 068 App 배포: PASS.
- PREVIEW 068 Worker 배포: PASS.
- 사용자 PC like → 모바일 동기화: PASS.
- 사용자 PC unlike → 모바일 동기화: PASS.
- mobile Worker/D1 0: PASS.
- batch W2: PASS.
- 067 Feed revalidation 비용 문제: **해결 확인**.
- TEST/PRODUCTION 변경 없음.
- **PREVIEW 068 사용자 실사용 검증 PASS.**

## 9. 다음 단계
- 사용자가 `테스트배포`를 요청하면 검증된 PREVIEW 068 전체를 `test_only` 경로로 TEST 승격.
- 사용자가 처음부터 `테스트배포 후 이상 없으면 정식배포까지`를 명확히 승인하면 `test_then_production` 사용.
- 승격 전 현재 068 exact source/app/Worker 상태를 다시 고정 확인.
- PRODUCTION은 명확한 승인 없이는 승격 금지.

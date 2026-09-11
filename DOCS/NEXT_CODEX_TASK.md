# NEXT CODEX TASK

상태: **PREVIEW 068 배포 + 사용자 실사용 검증 PASS / TEST 승격 대기**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `068`
- exact app source: `b12a108272b469ce346e6af0c7b102d90f0acc2e`
- App Run `34621166906` — PASS
- Worker Run `34621294524` — PASS
- PREVIEW active Worker `b2993f8c-bd23-4249-a652-ee379d6c50a8`
- Shared D1 066 Run `34597025382` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 068 사용자 실사용 결과 — 2026-09-12
### like
PC 기준 → 약 1분 → 모바일:
- PC batch `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`, rows `R6/W2`.
- feed revision `LOCAL 2 / Worker 0`, D1 `R0/W0`.
- 추가 `/v1/feed` full request 없음.
- 모바일에서 하트 + 숫자 모두 정상 동기화.
- 모바일 Cloudflare `LOCAL 1 / Worker 0`, D1 0.

### unlike
직전 like 진단값 누적 상태에서 다음 batch를 실행:
- likes batch Worker `1 → 2`.
- D1 query `R1/W1 → R2/W2`.
- rows `R6/W2 → R12/W4`.
- 이번 unlike batch 추가분도 `R6/W2`.
- feed revision은 LOCAL, Worker/D1 0.
- 모바일 하트 해제 + 숫자 `2 → 1` 정상 동기화.
- 모바일 Cloudflare `LOCAL 2 / Worker 0`, D1 0.

## 확정 판정
- same-account 하트 + 숫자 동기화 PASS.
- compact queue `W2/batch` PASS.
- 모바일 확인 Worker/D1 0 PASS.
- 067에서 발생한 like 뒤 full Feed 재확인 문제는 이번 실사용에서 재현되지 않음.
- Explore LOCAL revision zero-read 보호 PASS.
- PREVIEW 068 사용자 검증 PASS.

## 다음 작업
현재 추가 Codex 수정 작업 없음.

사용자가 `테스트배포`를 요청하면:
1. PREVIEW 068 exact release state를 다시 고정 확인.
2. fixed release promotion의 `test_only` 사용.
3. TypeScript / Build / Worker preflight / TEST Worker / Firebase TEST / 실제 `test.soridraw.com` 확인.
4. shared user data는 이동/복사/덮어쓰기하지 않음.
5. TEST 실패 시 즉시 중단, PRODUCTION 비변경 확인.

사용자가 `테스트배포 후 이상 없으면 정식배포까지 진행`을 명확히 승인한 경우에만 `test_then_production` 사용.

## 계속 보호할 것
- 좋아요 1분 batch.
- 10분 deferred public aggregate.
- `W2/batch` compact queue.
- same-account 기존 `users/{uid}` listener 재사용.
- 새 Firestore listener 금지.
- Explore LOCAL revision cache.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 명확한 승인 전 TEST/PRODUCTION 승격 금지.

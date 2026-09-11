# NEXT CODEX TASK

상태: **PREVIEW 066 실사용 비용 검증 PASS / 다음은 PC↔모바일 숫자 동기화 최종 확인**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱 화면 버전: `066`.
- App Run `34602732958` — PASS.
- Shared D1 066 Run `34597025382` — PASS.
- PREVIEW Worker 066 Run `34597109785` — PASS.
- active PREVIEW Worker: `d297dc1f-ec73-4ed3-89cd-547540c7ee86`.
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged.
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged.

## 066 실사용 비용 확인
사용자 인증 PREVIEW에서 1곡씩 측정:
- 좋아요: `/v1/me/likes/batch` Worker 1, D1 query `R1/W1`, D1 rows **`R2/W2`**.
- 좋아요 해제: `/v1/me/likes/batch` Worker 1, D1 query `R1/W1`, D1 rows **`R2/W2`**.

따라서:
- 065 좋아요 `R2/W3` → 066 `R2/W2` PASS.
- 065 좋아요 해제 `R3/W3` → 066 `R2/W2` PASS.
- compact queue W3→W2 최적화는 실제 사용자 계측으로 확정.
- 무료 D1 write 10만 rows/일 단순 환산상 좋아요 batch 약 5만회/일 후보. 다른 D1 write는 별도 여유에서 차감.

## 보호된 기능
- 1분 묶음 전송.
- 10분 deferred public like aggregate.
- same-account PC↔모바일 하트 + 숫자 sync 경로.
- 기존 Firestore root user listener 재사용, 새 listener 없음.
- Explore resume LOCAL zero-read.
- 기존 035 queue fallback/호환 drain.
- UI/CSS 변경 없음.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.

## 다음 최종 실사용 확인
1. PC에서 공개곡 1개 좋아요.
2. 모바일은 새로고침/클릭하지 않고 약 1분 대기.
3. 모바일에서 하트와 숫자가 함께 `+1` 되는지 확인.
4. 모바일에서 같은 곡 좋아요 해제.
5. PC에서 하트와 숫자가 함께 `-1` 되는지 확인.

이 항목까지 PASS하면 065에서 수정한 same-account 숫자 동기화와 066 비용 최적화 모두 PREVIEW 최종 통과로 본다.

## 추가 비용 작업
- 3곡 batch 실측은 선택. W2/batch 유지 여부와 read 증가폭 확인에 유용.
- W1은 현재 자동 진행 금지.
- W1 때문에 created_at lookup index 제거/full scan, retry/idempotency 저하, 동시 처리 위험이 생기면 진행하지 않는다.
- 현재 안전 합격선은 **R2/W2 single batch**.

## 승격
- 사용자 `테스트배포` 명시 전 TEST 승격 금지.
- PRODUCTION은 별도 명확한 승인 전 금지.

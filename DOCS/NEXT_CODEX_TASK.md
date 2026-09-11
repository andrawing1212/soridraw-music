# NEXT CODEX TASK

상태: **PREVIEW 072 배포 완료 / 서버 aggregate 정상 / 072 fresh Feed 숫자 복구 사용자 확인 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `072`
- 072 코드 commit: `d9863e48b353493b4a32e9ba913f11d30e31bbb9`
- PREVIEW 072 release trigger/locked build: `87ce8df39c525aeeb83a8437f794701e1c06686a`
- 072 Apply Run `34637256916` — PASS
- PREVIEW 072 App Run `34637365382` — PASS
- PREVIEW Worker는 069 runtime 유지: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 확정된 사실
서버 좋아요 경로는 정상이다.
- 1곡 1분 batch W1 실사용 PASS.
- scheduled aggregate가 queue를 정상 소비.
- canonical count = 1.
- derived count = 1.
- fresh PREVIEW Feed payload count = 1.
- PC→모바일 하트 sync는 정상 캐시 Worker/D1 0으로 PASS.

070/071에서 사용자가 본 `하트 ON / 숫자 0`은 서버 count 실패가 아니라 stale HTTP Feed 응답 고착 문제였다.
071도 강제 refresh 시 동일 versioned Feed URL을 재사용하여 stale edge cache를 다시 받을 수 있었다.

## 072 수정
- 실제 좋아요 숫자 복구가 필요한 경우에만 고유 `__soridraw_like_refresh` query로 HTTP Feed cache key를 1회 우회.
- 기존 `내 하트 ON / 숫자 0` stale 행도 072에서 1회 자동 복구 시도.
- 새 좋아요의 aggregate deadline은 immediate repair가 먼저 실행돼도 보존.
- polling 없음.
- Worker/D1/Functions/Rules/UI CSS/사용자 원본 데이터 변경 없음.
- 기존 069 W1 / reversal contract 유지.

## 다음 사용자 확인
새 좋아요 테스트 금지. 우선 기존 두 곡만 확인한다.
1. PREVIEW 072 업데이트.
2. 기존 하트 ON / 숫자 0이던 두 곡 확인.
3. 서버 확정 숫자 `1`이 화면에 회복되면 072 표시 복구 PASS.

## 통과 후 개발 측 검증
- 3곡 같은 1분 window → batch 1회 / queue W1 목표.
- aggregate 전 `like → unlike` 최종 OFF.
- aggregate 전 `unlike → like` 최종 ON.
- 비용 회귀 없음.
- 이후에만 TEST 승격 가능 여부 판단.

## 계속 보호할 것
- 좋아요 1분 batch.
- 공개 숫자 10분 aggregate-authoritative.
- 069 W1 queue.
- same-account 기존 users listener 재사용.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 사용자 실사용 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.

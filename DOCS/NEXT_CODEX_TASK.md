# NEXT CODEX TASK

상태: **PREVIEW 074 배포 완료 / 서버 좋아요 경로 정상 / 본인 숫자 Local First 즉시 반영 사용자 확인 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `074`
- 074 코드 commit: `835dd2cb0b5c206696a7e94dc18e9041155cbe23`
- PREVIEW 074 release trigger/locked build: `1d5ecf841ae8335d21b992d3e7f4c160add75839`
- 074 Apply Run `34639807460` — PASS
- PREVIEW 074 App Run `34639940311` — PASS
- PREVIEW Worker는 069 runtime 유지: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 확정된 사실
- 테스트한 두 곡 모두 서버 canonical/derived/fresh Feed 숫자는 이미 `1`.
- 073에서도 오른쪽 곡이 화면 `0`으로 남아 client 표시 복구는 FAIL.
- 서버/aggregate를 더 기다리거나 반복 조회하는 방향은 중단.

## 074 수정
- 본인 좋아요 클릭 즉시 하트 + 화면 숫자 `+1`.
- 취소 즉시 `-1`.
- 로컬 cache에도 표시 숫자 반영.
- 1분 batch 뒤 same-account signal에 optional `displayLikeCount`를 전달해 다른 기기도 같은 표시값을 받을 수 있게 함.
- legacy signal은 숫자를 덮어쓰지 않고 하트만 반영.
- `내 하트 ON / 숫자 0`은 추가 서버 read 없이 최소 `1`로 로컬 회복.
- canonical 서버 숫자는 기존 10분 aggregate 유지.
- aggregate 후 fresh refresh로 최종 canonical에 수렴.
- Worker/D1/Functions/Rules/UI CSS/사용자 원본 데이터 변경 없음.

## 다음 사용자 확인
복잡한 10분 테스트 금지.
1. PREVIEW 074 업데이트.
2. 기존 `[Breakbeat] '혼자만의 밤'`이 바로 `1`로 보이는지 확인.
3. 새 0곡 1개 좋아요 시 하트와 숫자가 즉시 `0 → 1`인지 확인.
4. 같은 곡 취소 시 즉시 `1 → 0`인지 확인.

## 통과 후 개발 측 검증
- 3곡 같은 1분 window → batch 1회 / queue W1 목표 확인.
- aggregate 전 like→unlike 최종 OFF.
- aggregate 전 unlike→like 최종 ON.
- PC→모바일 same-account 표시 숫자 전달 확인.
- 비용 회귀 없음 확인.
- 이후에만 TEST 승격 가능 여부 판단.

## 계속 보호할 것
- 좋아요 1분 batch.
- 서버 canonical 숫자 10분 aggregate.
- 069 W1 queue.
- same-account 기존 users listener 재사용.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 사용자 실사용 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.

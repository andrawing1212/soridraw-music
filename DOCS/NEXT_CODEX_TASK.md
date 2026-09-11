# NEXT CODEX TASK

상태: **PREVIEW 073 배포 완료 / 서버 숫자 정상 확정 / 073 client 표시 복구 사용자 확인 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `073`
- 073 코드 commit: `6b85f64e8fabd7b84aa87e043cabbc1d010afa0a`
- PREVIEW 073 release trigger/locked build: `5455866878996a9c76cfd2f097d909c1e0f67abe`
- 073 Apply Run `34638932996` — PASS
- PREVIEW 073 App Run `34639048578` — PASS
- visible-track read-only diagnostic Run `34638806229` — PASS
- PREVIEW Worker는 069 runtime 유지: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 확정된 사실
사용자가 본 두 곡 모두 서버에는 이미 좋아요 숫자 `1`이 확정되어 있다.
- canonical `track_stats.like_count=1`.
- derived `explore_derived_tracks.likes=1`.
- relation count=1.
- unique fresh PREVIEW Feed `stats.likeCount=1`.

즉 04:24에도 오른쪽 곡 화면이 0이었던 것은 기다림/aggregate 실패가 아니라 client 표시 실패다.

## 072 누락 원인
072의 fresh Feed 우회는 session Feed cache가 존재하는 재검증 경로에만 적용되어 있었다.
앱 업데이트 직후처럼 session cache가 비어 있으면 bootstrap 경로가 일반 versioned Feed URL을 다시 사용해 stale 0 응답을 받을 수 있었다.

## 073 수정
- forced like-count recovery 시 cached path와 cache-empty bootstrap path 모두 고유 fresh Feed URL 사용.
- 강제 복구 실패 시 repair key 해제 후 다음 기회에 재시도 가능.
- polling 없음.
- Worker/D1/Functions/Rules/UI CSS/사용자 원본 데이터 변경 없음.
- 기존 069 W1 / reversal contract 유지.

## 다음 사용자 확인
새 좋아요/10분 대기 금지.
1. PREVIEW 073 업데이트.
2. 기존 `[Breakbeat] '혼자만의 밤'` 숫자만 확인.
3. 서버가 이미 1이므로 화면도 바로 1로 회복되어야 함.

073에서도 0이면 서버를 더 검사하거나 기다리지 말고 client state 적용/render 단계만 진단한다.

## 이후
073 표시 복구 PASS 후:
- 본인 클릭 직후 숫자를 즉시 +1/-1로 보이게 하는 UX 개선을 별도 적용 검토하되 서버 canonical 10분 aggregate와 비용 구조는 유지.
- 3곡 같은 1분 window → batch 1회 / queue W1 목표 확인.
- aggregate 전 like→unlike, unlike→like 최종 수렴 확인.
- 비용 회귀 없음 확인.
- 이후에만 TEST 승격 가능 여부 판단.

## 계속 보호할 것
- 좋아요 1분 batch.
- 서버 canonical 숫자 10분 aggregate-authoritative.
- 069 W1 queue.
- same-account 기존 users listener 재사용.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 사용자 실사용 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.

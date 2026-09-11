# NEXT CODEX TASK

상태: **PREVIEW 070 배포 완료 / 069 서버 aggregate 정상 확인 / 070 자동 숫자 갱신 사용자 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `070`
- 070 코드 commit: `b24b7eaa2dfe461b0d4db34dec3983f045534e29`
- PREVIEW 070 release snapshot: `dce9448281cfbeedbc65e55bbf81cfc8f737b8ca`
- PREVIEW 070 App Run `34634448854` — PASS
- PREVIEW Worker는 069 runtime 유지
- PREVIEW Worker Run `34631083178` — PASS
- PREVIEW active Worker `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- Shared D1 069 additive schema Run `34630980764` — PASS
- 070 Apply Run `34634327688` — PASS
- 069 live diagnostic final Run `34634078292` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 실사용에서 확인된 것
PASS:
- PC 좋아요 하트 즉시 ON.
- 1분 batch 후 `/v1/me/likes/batch` Worker 1회.
- D1 queue write `W1`.
- 모바일 하트 same-account sync 정상.
- 모바일 정상 캐시 Worker/D1 0.
- aggregate 전 공개 숫자 고정.

사용자가 10분 이후에도 화면 숫자 0을 확인했지만 서버 read-only 진단 결과:
- q035/q066/q069 모두 0 → queue 정상 소비.
- canonical `track_stats.like_count=1`.
- derived `explore_derived_tracks.likes=1`.
- current PREVIEW `/v1/feed`도 해당 곡 `like_count=1`.
- cron `*/10 * * * *` 정상.

따라서 aggregate 실패가 아니라 **열린 client session cache가 aggregate 완료 후 자동 revision revalidation을 다시 하지 않은 문제**로 확정.

## 070 수정
`src/pages/ExplorePage.tsx` client-only 수정:
- 실제 `EXPLORE_LIKE_SYNC_EVENT` 발생 시에만 공개 숫자 재확인 timer 예약.
- 다음 10분 aggregate 경계 + 70초 grace 뒤 revision revalidation 1회.
- polling 없음.
- optimistic 공개 숫자 +/- 없음.
- hidden tab에서는 요청하지 않고 기존 visibility/focus revalidation 경로 사용.
- 여러 sync는 timer 재예약으로 반복 요청 최소화.

보호 확인:
- Worker runtime 변경 없음.
- D1 schema 변경 없음.
- Functions / Firestore Rules 변경 없음.
- UI/CSS/반응형 변경 없음.
- 사용자 원본 데이터 변경 없음.
- 기존 069 W1/reversal contract 유지.

## 현재 작업
추가 수정 전에 **070 사용자 최소 실사용 확인**이 우선.

사용자 확인은 1곡만:
1. PREVIEW 070 업데이트.
2. 좋아요 0인 새 곡에 like.
3. PC 즉시 하트 ON.
4. 약 1분 뒤 모바일 하트 ON.
5. 페이지를 일부러 새로고침/클릭하지 않고 기다림.
6. 다음 aggregate 경계 + 약 70초 뒤 공개 숫자가 PC/모바일에서 자동 `0 → 1` 되는지 확인.

## 이후 개발 측 검증
070 표시 동기화가 통과하면:
- 3곡 같은 1분 window → batch 1회 / queue W1 목표 확인.
- aggregate 전 `like → unlike` 실제 최종 OFF 확인.
- aggregate 전 `unlike → like` 실제 최종 ON 확인.
- 비용 회귀 없음 확인.
- TEST 승격 가능 여부 판단.

## 계속 보호할 것
- 좋아요 1분 batch.
- 공개 숫자 10분 aggregate-authoritative.
- 069 W1 queue.
- same-account 기존 `users/{uid}` listener 재사용.
- Explore LOCAL revision cache.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 사용자 실사용 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.

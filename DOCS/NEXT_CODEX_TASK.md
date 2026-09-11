# NEXT CODEX TASK

상태: **PREVIEW 069 배포 완료 / 사용자 실사용 W1·역전·모바일 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `069`
- 069 product-code exact source: `a22c9f73208288e35844dbcfa58efae09b655fd8`
- PREVIEW App release snapshot: `c4991e445417549814f18b154f8339ab7c01c74b`
- PREVIEW App Run `34631182171` — PASS
- PREVIEW Worker Run `34631083178` — PASS
- PREVIEW active Worker `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- PREVIEW Worker canonical SHA256 `2030a64bf8cc56e18ca0a2f05fb5832ea68ceb0e14fd9ae064248db35721ae6e`
- Shared D1 069 additive schema Run `34630980764` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 069 현재 동작
- 하트 즉시 로컬 반영.
- PREVIEW 1분 batch.
- 공개 숫자는 로컬에서 임의 `+1/-1`하지 않음.
- 공개 숫자는 `*/10 * * * *` aggregate 뒤에만 확정.
- 069 queue는 단일 primary key / no secondary index로 `W1/batch` 목표.
- `baseLiked` + stable `mutationAt`으로 aggregate 전 반대 동작을 보존.
- retry idempotency / 양방향 reversal / legacy compatibility static verifier PASS.

## 배포 완료
### Shared D1
Run `34630980764` PASS:
- `explore_like_batches_069` additive table만 추가.
- 기존 사용자 원본 데이터 변경 없음.
- PREVIEW/TEST/PRODUCTION Feed 정상.
- 모든 Worker version unchanged during D1-only release.

### PREVIEW Worker
Run `34631083178` PASS:
- Worker preflight PASS.
- Feed/Profile/like-route smoke PASS.
- warm revision `R0/W0` PASS.
- aggregate cron PASS.
- TEST/PRODUCTION Worker unchanged.

### PREVIEW App
Run `34631182171` PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- `preview.soridraw.com` exact build PASS.
- `app-version.json=069` PASS.
- TEST/PRODUCTION unchanged.

## 현재 작업
추가 코드 수정보다 **사용자 실사용 검증이 우선**.

필수 확인:
1. 1곡 like → 1분 batch → queue write `W1`.
2. 3곡을 한 1분 안에 변경 → batch 1회 / `W1` 목표.
3. 첫 batch 접수 후 aggregate 전 `like → unlike` → 최종 OFF.
4. 첫 batch 접수 후 aggregate 전 `unlike → like` → 최종 ON.
5. aggregate 전 숫자 고정 / aggregate 뒤 정확한 최종 숫자.
6. 모바일 정상 캐시 확인 Worker/D1 0 목표.
7. full Feed 재요청/불필요한 D1 증가 없음.

## 계속 보호할 것
- UI/CSS/반응형 비변경.
- Firebase Functions / Firestore Rules 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 같은 계정 기존 `users/{uid}` listener 재사용.
- Explore LOCAL revision cache 보호.
- 실제 실사용 검증 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.

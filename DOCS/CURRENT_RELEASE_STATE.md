# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 069**
- 069 product-code exact source: `a22c9f73208288e35844dbcfa58efae09b655fd8`
- PREVIEW App release snapshot: `c4991e445417549814f18b154f8339ab7c01c74b`
- PREVIEW App Run: `34631182171` — PASS
- PREVIEW Worker Run: `34631083178` — PASS
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- PREVIEW Worker canonical SHA256: `2030a64bf8cc56e18ca0a2f05fb5832ea68ceb0e14fd9ae064248db35721ae6e`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- 069 implementation/verifier Run: `34630148363` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 069 목표와 동작
- 하트 상태는 즉시 로컬 반영.
- PREVIEW 좋아요 outbox는 1분 단위 batch.
- 공개 좋아요 숫자는 기기에서 임의 `+1/-1`하지 않음.
- 공개 숫자는 `*/10 * * * *` scheduled aggregate가 확정할 때만 변경.
- 069 queue는 `explore_like_batches_069` 단일 PK 구조로 queue write `W1/batch`를 목표로 함.
- retry는 안정적인 `mutationAt`을 유지해 같은 요청이 다른 batch로 중복 생성되지 않도록 함.

## 3. 역전 오류 수정
초기 069에서 첫 batch 접수 후 aggregate 전에 반대 동작이 들어오면 old canonical만 보고 두 번째 동작을 no-op으로 버릴 수 있었음.

수정:
- client가 `baseLiked` + 안정적인 `mutationAt`을 batch에 전송.
- Worker patch `041-explore-like-reversal-order.mjs`가 desired 상태가 canonical과 같아도 `baseLiked`가 반대이면 reversal로 queue 보존.
- `baseLiked`가 없는 legacy 요청도 apparent no-op을 안전하게 queue 보존.
- pending queue 확인을 위한 추가 D1 read 없음.
- aggregate는 같은 사용자/곡에서 가장 최신 의도를 기준으로 최종 수렴.

자동 verifier에서 다음 모두 PASS:
- `like → unlike before aggregate`
- `unlike → like before aggregate`
- legacy reversal compatibility
- W1 queue schema / no secondary index
- stable retry idempotency
- delayed public count contract

## 4. Shared D1 069 schema 배포
Run `34630980764` — PASS.

적용한 additive object:
- `explore_like_batches_069`
- `WITHOUT ROWID`
- `batch_id TEXT PRIMARY KEY`
- secondary index 없음

안전 확인:
- 적용 전 object 없음 확인.
- additive DDL static safety PASS.
- 적용 후 exact schema postflight PASS.
- PREVIEW / TEST / PRODUCTION Feed 정상 PASS.
- D1-only 작업 중 모든 Worker version unchanged PASS.
- `main` / `production` ref unchanged PASS.
- 기존 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.

## 5. PREVIEW Worker 069 배포
Run `34631083178` — PASS.

- exact source `a22c9f73208288e35844dbcfa58efae09b655fd8`
- preflight PASS.
- 기존 Explore like cost verifier PASS.
- derived cache verifier PASS.
- Feed smoke PASS.
- Profile smoke PASS.
- like batch route smoke PASS.
- warm feed revision `R0/W0`, `HEAD-ONLY-036` PASS.
- aggregate cron `*/10 * * * *` PASS.
- active PREVIEW Worker `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`.
- TEST / PRODUCTION Worker unchanged PASS.

## 6. Firebase PREVIEW App 069 배포
Run `34631182171` — PASS.

- release snapshot `c4991e445417549814f18b154f8339ab7c01c74b`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build 비교 PASS.
- 실제 `app-version.json=069` PASS.
- TEST / PRODUCTION HTML 및 branch ref unchanged PASS.

## 7. 데이터 / 인프라 변경
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- UI/CSS/반응형 변경 없음.
- 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- Shared D1에는 069용 새 queue table만 additive로 추가.
- TEST/PRODUCTION 코드는 승격하지 않음.

## 8. 현재 판정
- 069 코드 역전 오류: **수정 완료**.
- 069 PREVIEW App: **배포 완료**.
- 069 PREVIEW Worker: **배포 완료**.
- Shared D1 069 additive schema: **배포 완료**.
- TypeScript / Build / static verifier / Worker smoke: **PASS**.
- TEST / PRODUCTION: **비변경 PASS**.
- **실사용 W1/batch 비용 검증: 아직 사용자 테스트 전.**
- **실사용 pre-aggregate reversal 최종 수렴 검증: 아직 사용자 테스트 전.**
- **PC↔모바일 069 회귀 검증: 아직 사용자 테스트 전.**
- 따라서 TEST 승격은 아직 금지.

## 9. 다음 실사용 검증
1. 1곡 like 후 1분 batch가 1회이고 queue write `W1`인지 확인.
2. 3곡을 같은 1분 window 안에 변경해 batch 1회 / queue write `W1` 목표 확인.
3. aggregate 전 `like → unlike`가 두 번째 동작을 버리지 않고 최종 OFF로 수렴하는지 확인.
4. aggregate 전 `unlike → like`가 최종 ON으로 수렴하는지 확인.
5. aggregate 전 공개 숫자가 임의 변경되지 않고, 다음 scheduled aggregate 뒤 정확히 한 번만 확정되는지 확인.
6. 정상 캐시 모바일 확인에서 Worker/D1 0 목표 확인.
7. 문제가 없으면 사용자 승인 후에만 TEST 승격.

# NEXT CODEX TASK

상태: **069 역전 오류 수정 + 코드 검증 PASS / 실제 PREVIEW는 068 유지 / 069 배포 전**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `068`
- 실제 PREVIEW 068 exact app source: `b12a108272b469ce346e6af0c7b102d90f0acc2e`
- 실제 PREVIEW 068 App Run `34621166906` — PASS
- 실제 PREVIEW 068 Worker Run `34621294524` — PASS
- 실제 PREVIEW active Worker `b2993f8c-bd23-4249-a652-ee379d6c50a8`
- 현재 GitHub preview HEAD: `a22c9f73208288e35844dbcfa58efae09b655fd8`
- 069 구현/검증 Run `34630148363` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 이번 069 수정 완료 내용
문제:
- 첫 like/unlike batch가 접수된 뒤 10분 aggregate 전 반대 동작이 들어오면 old canonical만 보고 두 번째 동작을 no-op으로 버릴 수 있었음.

해결:
- client가 `baseLiked`와 안정적인 `mutationAt`을 batch에 전송.
- Worker `041-explore-like-reversal-order.mjs`가 canonical과 원하는 상태가 같아도 `baseLiked`가 반대이면 reversal로 queue 보존.
- legacy client는 `baseLiked`가 없으므로 apparent no-op도 queue 보존하여 사용자 의도를 버리지 않음.
- pending queue 확인용 추가 D1 read 없음.
- public like 숫자는 기기에서 임의 증감하지 않고 10분 aggregate 확정값만 사용.
- retry `updatedAt` 고정으로 retry key 안정성 유지.

## 자동 검증
Run `34630148363` PASS:
- 040 + 041 Worker composition PASS.
- pre-aggregate `like → unlike` reversal contract PASS.
- pre-aggregate `unlike → like` reversal contract PASS.
- legacy reversal compatibility PASS.
- W1 queue schema/no secondary index PASS.
- existing cost verifier PASS.
- derived cache verifier PASS.
- TypeScript PASS.
- Build PASS.
- change-boundary PASS.
- UI/CSS, Functions, Firestore Rules, 사용자 원본 데이터 변경 없음.

## 현재 작업
추가 코드 수정은 현재 필요 없음.

중요:
- `public/app-version.json` 소스는 069지만 실제 `preview.soridraw.com`은 아직 068.
- 069 D1 additive queue schema는 아직 실제 DB에 적용하지 않음.
- 069 Worker/Firebase Hosting도 아직 배포하지 않음.
- 따라서 W1 실사용 비용과 PC↔모바일 실사용 회귀는 아직 검증 전.

## 다음 작업 — 사용자가 PREVIEW 배포를 요청한 경우만
1. candidate `a22c9f73208288e35844dbcfa58efae09b655fd8` 고정.
2. 069 additive queue schema preflight 및 안전 적용.
3. PREVIEW Worker 040 + 041 배포.
4. Firebase PREVIEW 069 배포.
5. 실제 `preview.soridraw.com` 069 확인.
6. 1곡 like → batch W1 확인.
7. 3곡 1분 내 like → batch 1회/W1 목표 확인.
8. 첫 batch 접수 뒤 10분 전 반대 동작 2방향 모두 최종 상태 정확성 확인.
9. 10분 aggregate 뒤 숫자 정확성 확인.
10. 모바일 정상 캐시 Worker/D1 0 확인.
11. TEST/PRODUCTION 비변경 확인.

## 계속 보호할 것
- 현재 실제 068 정상 기능.
- 좋아요 1분 batch.
- 10분 deferred public aggregate.
- same-account 기존 `users/{uid}` listener 재사용.
- 새 Firestore listener 금지.
- Explore LOCAL revision cache.
- UI/CSS/반응형 비변경.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.
- 명확한 사용자 요청 전 PREVIEW 069 배포 금지.
- 명확한 승인 전 TEST/PRODUCTION 승격 금지.

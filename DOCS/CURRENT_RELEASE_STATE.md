# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 배포 앱: 068**
- PREVIEW 068 exact app source: `b12a108272b469ce346e6af0c7b102d90f0acc2e`
- PREVIEW 068 App Run: `34621166906` — PASS
- PREVIEW 068 Worker Run: `34621294524` — PASS
- PREVIEW 068 active Worker Version ID: `b2993f8c-bd23-4249-a652-ee379d6c50a8`
- PREVIEW 068 Worker canonical SHA256: `822252880f6c52eb5453920b143f71a45fce120b05eff2f82542613cd68c4de8`
- **현재 GitHub `preview` 개발 HEAD: `a22c9f73208288e35844dbcfa58efae09b655fd8` — 069 후보 소스, 미배포**
- 069 구현/검증 Run: `34630148363` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active

## 2. 실제 서비스 기준 — 068
- 1곡 like/unlike: D1 `R2/W2` 실사용 PASS.
- 여러 곡 batch도 queue write `W2/batch` 유지.
- PC↔모바일 same-account 하트 + 숫자 동기화 PASS.
- 정상 캐시 모바일 확인 Worker/D1 0 PASS.
- like 뒤 `/v1/feed` 전체 재요청 없음 PASS.
- Explore revision LOCAL zero-read 보호 PASS.
- 따라서 **현재 사용자에게 노출된 PREVIEW는 계속 068**이다.

## 3. 069 개발 목표
069는 068을 바로 배포한 것이 아니라, 다음 비용 목표를 위한 PREVIEW 개발 후보이다.

- 하트 상태는 즉시 반영.
- 공개 숫자는 기기에서 임의 `+1/-1`하지 않음.
- 공개 숫자는 10분 deferred aggregate가 확정할 때만 변경.
- 좋아요 여러 개를 1분 안에 묶으면 가능한 한 queue write `W1/batch` 목표.
- retry가 같은 batch를 중복 생성하지 않도록 `mutationAt`을 안정적으로 유지.

## 4. 069에서 발견된 중간 문제
초기 069 설계는 첫 batch가 서버에 접수된 뒤 10분 aggregate 전 반대 동작이 들어오면 잘못 버릴 수 있었다.

예:
1. canonical 상태는 아직 `좋아요 OFF`.
2. 사용자가 좋아요 → 첫 batch 접수.
3. 10분 aggregate 전 좋아요 해제.
4. 서버가 아직 old canonical `OFF`만 보면 두 번째 해제를 `변화 없음`으로 판단할 수 있음.
5. 그러면 첫 좋아요만 나중에 확정되는 역전 오류 가능.

이 상태로는 배포 금지 판정이었다.

## 5. 069 역전 오류 수정 — 완료
기준 commit:
- 설계/보정 commit: `fc7676ffe6e66b43970de8db110e4565f2ebabeb`
- 실제 생성 소스 commit: `a22c9f73208288e35844dbcfa58efae09b655fd8`

수정 내용:
- 클라이언트 batch에 `baseLiked` + 안정적인 `mutationAt` 전송.
- Worker patch `041-explore-like-reversal-order.mjs` 추가.
- 원하는 상태가 현재 canonical과 같아도 `baseLiked`가 반대라면 **이전 미집계 batch의 역전 동작**으로 보고 반드시 queue에 남김.
- 구버전 클라이언트처럼 `baseLiked`가 없는 요청은 apparent no-op이라도 안전하게 queue에 남겨 사용자 의도를 버리지 않음.
- pending queue를 확인하기 위한 추가 D1 read는 만들지 않음.
- 최종 aggregate는 같은 사용자/곡의 가장 최신 의도를 기준으로 계산하므로 `좋아요→해제`, `해제→좋아요` 모두 최종 상태로 수렴.
- 공개 숫자는 계속 aggregate-authoritative. 기기 optimistic 숫자 `+1/-1` 금지.
- retry 시 `updatedAt`을 바꾸지 않아 같은 retry key 안정성 유지.

## 6. 069 자동 검증
GitHub Actions `Apply 069 Explore Like W1 Delayed Count` Run `34630148363` — **PASS**.

PASS 항목:
- 069 client targeted apply PASS.
- Worker 040 + 041 patch composition PASS.
- 069 static contract PASS.
- `좋아요 → aggregate 전 해제` ordering verifier PASS.
- `해제 → aggregate 전 좋아요` ordering verifier PASS.
- legacy client reversal-safe contract PASS.
- W1 schema / no secondary index contract PASS.
- 기존 Explore like cost verifier PASS.
- derived cache verifier PASS.
- `npm ci` PASS.
- TypeScript `npx tsc --noEmit` PASS.
- Build PASS.
- 변경 범위 검사 PASS.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- UI/CSS 변경 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 7. 데이터 / 백엔드 상태
- 069용 additive D1 migration 파일은 소스에 존재하지만 **이번 수정 작업에서 실제 D1 migration을 실행하지 않음**.
- Shared D1 사용자 원본 데이터 변경 없음.
- Firestore 사용자 데이터 변경 없음.
- Functions 변경 없음.
- TEST / PRODUCTION 변경 없음.
- PREVIEW Hosting/Worker도 아직 069로 배포하지 않음.

## 8. 현재 판정
- 069 코드상 역전 오류: **수정 완료**.
- TypeScript / Build / 관련 verifier: **PASS**.
- 비용 구조: 추가 pending-state D1 read 없이 W1 queue 방향 유지.
- 현재 실제 PREVIEW: **068 유지**.
- 069 실제 PREVIEW 배포: **미실행**.
- 069 실제 D1 `W1/batch` 실사용 검증: **배포 전이라 미검증**.
- 069 PC↔모바일 실사용 회귀: **배포 전이라 미검증**.
- TEST/PRODUCTION 승격: 금지/미실행.

## 9. 다음 단계
사용자가 PREVIEW 배포를 요청한 경우에만:
1. 069 exact candidate `a22c9f73208288e35844dbcfa58efae09b655fd8` 고정.
2. 필요한 additive 069 queue schema를 배포 절차의 preflight/안전 절차로 적용.
3. Worker 040 + 041 포함 PREVIEW Worker 배포.
4. Firebase PREVIEW 069 앱 배포.
5. 실제 `preview.soridraw.com` 확인.
6. 1곡 좋아요 → 1분 batch → W1 확인.
7. 3곡을 1분 안에 좋아요 → batch 1회/W1 목표 확인.
8. 좋아요 batch 접수 후 10분 전 해제 → 최종 해제 상태 확인.
9. 해제 batch 접수 후 10분 전 재좋아요 → 최종 좋아요 상태 확인.
10. 10분 aggregate 뒤 숫자만 정확히 확정되는지 확인.
11. 모바일 정상 캐시 확인 Worker/D1 0 목표 검증.
12. TEST/PRODUCTION 비변경 확인.

사용자 요청 전에는 069를 배포하지 않는다.

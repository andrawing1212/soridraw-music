# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **094** — `https://preview.soridraw.com`
- PREVIEW 094 배포 source SHA: `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- PREVIEW 094 version bump commit: `702ae885e8ae1afa361532c310343d39eb3d428d`
- PREVIEW 094 제품 구현 commit: `bb32b8fd004f6091303d74ad89532b6f87863cd9`
- PREVIEW 094 구현/회귀 검증 Run: `34973859090` — **PASS**
- PREVIEW 094 승격 검증 Run: `34974143205` — **PASS**
- PREVIEW 094 App Release Run: `34974907217` — **PASS**
- 현재 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 product tree: `84d9613f47e12d274df2a263590f29ae713caab4`
- Worker 056 핵심 구현 commit: `87cfb18ed1dd7e1c793550a32c820509ce7ed4a2`
- Worker 056 배포 Run: `34964765640` — **PASS**
- Worker 056 live-source 검증 Run: `34965070145` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker deploy Run: `34946799113` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Explore Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Explore Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## 2. Explore 좋아요 094 — PREVIEW 배포 완료
목표는 좋아요를 누를 때마다 서버를 반복 사용하는 구조를 줄이고, 하트/숫자는 즉시 보이게 유지하는 것이다.

현재 동작:
- 좋아요/해제는 즉시 로컬 하트/숫자에 반영하고 durable outbox에 저장.
- 일반 Explore 탐색 중 **5초 자동 서버 전송 제거**.
- 추천/최신/인기 탭 전환만으로 좋아요 batch flush 없음.
- 같은 Explore 화면에서 여러 변경을 로컬에 계속 묶음.
- 서버 전송은 의미 있는 경계에서 한 번 묶어서 처리:
  - Explore 밖 페이지 이동 직전
  - 공개프로필 진입 직전
  - 공개프로필에서 Explore 복귀 직전
  - 탭/앱 hidden
  - pending 50개 도달 시 안전 flush
- 실패하면 timer retry를 돌리지 않고 로컬에 보관 후 다음 경계에서 재시도.
- page-exit에서는 남은 batch가 있으면 순차 drain.
- RTDB에는 서버가 승인한 변경분만 전달.
- 같은 기기의 더 최신 pending 클릭은 다른 기기 신호가 덮어쓰지 않음.
- Firestore `users/{uid}` Explore like sync write 재도입 없음.

좋아요 숫자 정확성:
- 클릭 즉시 로컬 숫자 ±1.
- 서버 승인 후 `기준 숫자 + 실제 승인 상태 변화`를 유지.
- `liked=true`라는 이유로 0을 임의 1로 만드는 보정 없음.
- 서버 aggregate가 따라오면 local acknowledged 상태를 해제하고 canonical 숫자로 수렴.

변경 파일 — 제품/검증 정확히 6개:
- `src/services/exploreLikeService.ts`
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/components/explore/ExploreShell.tsx`
- `scripts/verify-explore-like-cost-optimization.mjs`
- `scripts/verify-094-explore-session-like-batch.mjs`

## 3. 094 자동검증 결과
구현/회귀 검증 Run `34973859090` — PASS:
- TypeScript PASS
- Build PASS
- 094 session-boundary like regression PASS
- Explore like cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS
- narrow diff PASS
- Firestore write API 재도입 없음
- Functions / Worker / D1 / Rules / schema 변경 없음

PREVIEW 승격 검증 Run `34974143205` — PASS:
- 기준 PREVIEW SHA `ec11473fa0ed6e34d1da8da35d6c637e516cb4b6`
- 검증된 제품 commit만 PREVIEW에 반영
- TypeScript / Build / like regression PASS
- 실제 PREVIEW 제품 commit `bb32b8fd004f6091303d74ad89532b6f87863cd9`

## 4. PREVIEW 094 실제 배포 결과
사용자 승인 후 앱 버전을 094로 올리고 canonical PREVIEW app release path로 Firebase Hosting만 배포했다.

Run `34974907217` — **PASS**:
- locked source SHA: `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase auth PASS
- Firebase PREVIEW Hosting only 배포 PASS
- `preview.soridraw.com` 실제 `index.html`이 로컬 build와 exact hash match — PASS
- 실제 `app-version.json = 094` — PASS
- TEST branch/Hosting 비변경 — PASS
- PRODUCTION branch/Hosting 비변경 — PASS

이번 094 배포에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 5. Worker 056 — 좋아요 곡 500 / 빈 목록 수정 유지
PREVIEW Worker 056은 공개프로필 `좋아요 곡` 500 문제를 수정한 상태로 그대로 유지한다.

핵심:
- 잘못된 `profiles` JOIN을 실제 공유 D1의 `public_profiles` JOIN으로 수정.
- requested liked IDs만 PK/index lookup.
- 전체 `tracks` scan 없음.
- live Worker source 검증 PASS.
- 094 앱 배포에서는 Worker 코드 변경이 없으므로 불필요한 재배포를 하지 않음.

## 6. Catalog 092 — Firestore 전체조회 차단 유지
- 일반 Music Note/Library Catalog GET은 R2 only.
- 새 기기 + 기존 R2 Catalog: R2 1회 수신 후 로컬 우선.
- profile revision 불일치가 일반 앱 경로에서 Firestore full scan 권한이 되지 않음.
- R2 Catalog가 없으면 일반 GET/delta에서 Firestore collection traversal 금지.
- explicit tombstone만 삭제로 처리.
- delta conflict/count mismatch는 R2 soft refresh.
- 앱 업데이트만으로 전체 Catalog rebuild/cache wipe 금지.
- 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- 검증 Run: `34946586905` — PASS.
- 과거 약 618 read처럼 곡 수에 비례한 Firestore 대량 read 폭증은 PREVIEW 092 업데이트 후 재현되지 않음.

## 7. 사용자 데이터 / 스키마 / 배포 영향
이번 094 작업과 배포에서:
- 사용자 원본 데이터 변경 없음
- 사용자 데이터 migration/backfill/delete/overwrite 없음
- Firestore schema 변경 없음
- D1 schema/migration/seed 변경 없음
- Firebase Functions 변경 없음
- RTDB Rules 변경 없음
- Firestore Rules 변경 없음
- Cloudflare Worker 변경 없음
- UI/CSS 변경 없음
- TEST/PRODUCTION 코드·Hosting·Worker 변경 없음

공유 사용자 데이터 운영 원칙은 그대로 유지한다. PREVIEW/TEST/PRODUCTION 승격은 데이터 복사가 아니라 기능 코드 승격이다.

## 8. 094 실사용 비용/정확성 합격선 — 아직 미검증
다음은 사용자 실제 계정으로 확인해야 한다.
1. Explore 좋아요 2~10개 연속 클릭 중 5초 자동 서버 요청이 없는지.
2. 추천/최신/인기 탭만 바꿀 때 서버 flush가 없는지.
3. 공개프로필 진입 또는 Explore 밖 이동 시 변경분이 한 batch로 반영되는지.
4. 50개 미만 연속 변경이 ordinary browsing 동안 durable local 상태로 유지되는지.
5. PC/모바일 같은 계정에서 boundary sync 후 하트가 변경분만 수렴하는지.
6. 좋아요 숫자가 즉시 ±1 되고 서버 승인 뒤 0/옛 숫자로 역행하지 않는지.
7. deferred aggregate 후 canonical 숫자로 정상 수렴하는지.
8. CACHE LIVE에서 Explore 좋아요발 Firestore `users:write` 증가 없음.
9. Firestore Console에서도 Explore 좋아요 때문에 write/read 연쇄 증가 없음.
10. D1이 클릭별 불필요한 개별 요청으로 폭증하지 않는지.
11. 인증된 `/v1/me/liked-tracks` 500 재발 없음 + 좋아요 곡 카드 정상 표시.
12. Music Note/Recent Songs 기존 RTDB 동기화 회귀 없음.
13. Catalog 새 기기/재진입 Firestore full-scan 재발 없음.

FAIL 조건:
- ordinary Explore 탐색/탭 이동만으로 좋아요 서버 flush 발생
- 좋아요 하나마다 개별 서버 요청 반복
- Explore 좋아요 때문에 Firestore `users` write + listener read 발생
- 숫자가 서버 승인 후 0/오래된 값으로 역행
- Music Note/Recent Songs RTDB 회귀

## 9. TEST / PRODUCTION 승격
- TEST: **PREVIEW 094 실사용 비용/정확성 PASS 전 승격 금지.**
- 승격 시 검증된 PREVIEW exact tree 전체를 `main`으로 승격. 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 10. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- 094 Explore like durable outbox + boundary/max-50 batch
- like display ledger / acknowledged count convergence
- 공개/비공개 변경분 처리 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

## 11. 알려진 위험 / 정리 항목
- 094 자동검증과 실제 Hosting 배포는 PASS지만 **실사용 비용/PC↔모바일 수렴은 아직 사용자 검증 전**.
- 기존 임시 작업 branch `tmp/explore-session-like-batch-20260915` 등은 repository cleanup 대상이지만 현재 연결된 GitHub 기능에 branch delete action이 노출되지 않아 자동 정리하지 못함.
- `preview`, `main`, `production`은 GitHub 응답상 `protected=true`로 보이지만 protection detail의 `enabled=false`가 함께 반환되어 보호 설정 상태는 별도 운영 점검 필요.
- 기존 Build chunk-size / mixed import 경고는 존재하지만 094 배포 실패 원인은 아니며 이번 범위에서 변경하지 않음.

## 12. 다음 작업
- 사용자 계정으로 PREVIEW 094 실사용 비용/정확성 측정을 진행한다.
- 특히 좋아요 연속 클릭 → 탭 이동 → 공개프로필 진입/Explore 이탈 시점의 서버 호출과 Firestore/D1 증감을 본다.
- 이상이 있으면 TEST로 올리지 않고 PREVIEW에서 해당 경로만 최소 수정한다.
- 모두 PASS 후에만 TEST 승격을 검토한다.

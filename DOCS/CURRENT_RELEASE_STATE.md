# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **093** — `https://preview.soridraw.com`
- PREVIEW 093 배포 source SHA: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- PREVIEW 093 Release Run: `34957675828` attempt 2 — **PASS**
- PREVIEW 093 좋아요 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- PREVIEW 093 최종 자동검증 Run: `34954374540` — PASS
- **현재 PREVIEW 코드 094 구현 commit: `bb32b8fd004f6091303d74ad89532b6f87863cd9` — 코드 반영 완료 / 미배포**
- 094 독립 구현/회귀 검증 Run: `34973859090` — **PASS**
- 094 PREVIEW 승격 검증 Run: `34974143205` — **PASS**
- 현재 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 product tree: `84d9613f47e12d274df2a263590f29ae713caab4`
- Worker 056 핵심 구현 commit: `87cfb18ed1dd7e1c793550a32c820509ce7ed4a2`
- Worker 056 검증 Run: `34964499103` — **PASS**
- Worker 056 배포 Run: `34964765640` — **PASS**
- Worker 056 실제 live-source 검증 Run: `34965070145` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker deploy Run: `34946799113` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Explore Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Explore Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## 2. Explore 좋아요 094 — 세션/경계 묶음 구조, 코드 반영 완료 / 미배포
사용자 요구에 따라 좋아요 서버 사용을 더 줄이면서 하트/숫자 정확성을 유지하는 구조로 수정했다.

핵심 동작:
- 좋아요 클릭 즉시 하트/숫자는 로컬에서 반영하고 durable outbox에 저장.
- **일반 Explore 탐색 중 5초 타이머 서버 전송 제거.**
- 추천/최신/인기 탭 이동은 로컬 상태만 바꾸며 좋아요 outbox 전송을 유발하지 않음.
- 같은 Explore 화면에서 여러 곡을 좋아요/해제하면 계속 로컬에 묶음.
- 서버 전송은 의미 있는 경계에서 한 번 묶어서 처리:
  - Explore에서 다른 앱 페이지로 이동하기 직전
  - 공개프로필 진입 직전
  - 공개프로필에서 Explore로 돌아오기 직전
  - 탭/앱이 background(hidden)로 갈 때
  - pending 변경이 최대 50개에 도달했을 때 안전 flush
- 실패 시 retry timer를 돌리지 않고 변경분을 기기에 유지. 다음 의미 있는 경계에서 재시도.
- 페이지 진입/좋아요 상태 hydration 자체가 outbox를 flush하지 않음.
- 한 번의 batch에 최대 50개 변경을 처리하고, page-exit flush는 남은 batch가 있으면 순차적으로 비움.

좋아요 숫자 정확성:
- batch 서버 승인 후 숫자는 `기준 숫자 + 실제 승인된 상태 변화`로 유지.
- `liked=true`라는 이유만으로 0을 임의 1로 만드는 방식은 사용하지 않음.
- 서버의 지연 aggregate가 실제 숫자를 따라오면 local acknowledged 숫자 상태를 해제하고 canonical 값으로 수렴.
- 다른 기기 RTDB 신호에는 **서버가 승인한 변경분만** 실어 보냄.
- 같은 기기에 그보다 최신 로컬 클릭이 있으면 최신 로컬 의도를 덮어쓰지 않음.

변경 파일 — 정확히 6개:
- `src/services/exploreLikeService.ts`
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/components/explore/ExploreShell.tsx`
- `scripts/verify-explore-like-cost-optimization.mjs`
- `scripts/verify-094-explore-session-like-batch.mjs`

검증:
- TypeScript PASS.
- Build PASS.
- 094 session-boundary like regression PASS.
- Explore like cost/D1 fixture PASS.
- 085 liked-profile regression PASS.
- 086 liked-sync-repair regression PASS.
- narrow diff PASS — 위 6개 외 제품 파일 변경 없음.
- Firestore write API 재도입 없음.
- Functions / Worker / D1 / Rules / schema 변경 없음.
- 구현 검증 Run `34973859090` — PASS.
- PREVIEW 기준 SHA `ec11473fa0ed6e34d1da8da35d6c637e516cb4b6`에 검증된 제품 commit만 cherry-pick한 승격 Run `34974143205` — PASS.
- PREVIEW 094 코드 commit `bb32b8fd004f6091303d74ad89532b6f87863cd9`.

현재 상태:
- **GitHub PREVIEW 코드 반영 완료.**
- **Firebase PREVIEW Hosting에는 아직 배포하지 않음.** 실제 앱은 093 그대로.
- Explore Worker 056 / Media Worker / Functions는 변경·재배포하지 않음.
- 사용자 원본 데이터 변경 없음.
- UI/CSS 변경 없음.
- 실사용 비용/PC↔모바일 동기화 검증은 PREVIEW 앱 배포 후 진행해야 함.

## 3. Worker 056 — 좋아요 곡 500 / 빈 목록 수정
사용자 실사용에서 공개프로필 `좋아요 곡`이 비어 있고 `/v1/me/liked-tracks`가 500이던 문제를 PREVIEW에서 수정/배포했다.

원인:
- liked-track 상세 조회가 존재하지 않는 `profiles` 테이블을 JOIN하고 있었음.
- 실제 공유 Explore D1의 정상 프로필 테이블은 `public_profiles`.
- 좋아요 관계/하트 상태는 남아 있어도 상세 카드 조회가 500으로 끊겨 좋아요 곡 목록과 숫자 복구가 실패할 수 있었음.

수정:
- `handleMyLikedTracks052`의 `LEFT JOIN profiles ...`를 `LEFT JOIN public_profiles ...`로 변경.
- R2 canonical liked IDs, RTDB 변경 신호, UI/CSS는 변경하지 않음.
- verifier 085/086도 실제 `public_profiles` 계약으로 수정하고 옛 `profiles` JOIN 재발을 금지.

검증:
- TypeScript PASS.
- Build PASS.
- Worker syntax PASS.
- liked-profile 085 PASS.
- liked-sync 086 PASS.
- like cost verifier PASS.
- 실제 PREVIEW D1 schema에서 `public_profiles(uid,nickname,avatar_url)` 존재 확인 PASS.
- 실제 corrected SQL query plan: `tracks.id`, `public_profiles.uid`, `track_stats.track_id` index lookup PASS.
- `SCAN tracks` 없음. 요청된 liked IDs만 PK 기반 조회.
- Live Worker `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` source에서 `public_profiles` JOIN 존재 + 옛 `profiles` JOIN 부재 확인 PASS.
- `preview.soridraw.com` HTTP 200 PASS.
- PREVIEW feed HTTP 200 PASS.
- unauthenticated `/v1/me/liked-tracks` HTTP 401 — route 존재/500 아님 PASS.

배포 영향:
- PREVIEW Explore Worker만 변경.
- Firebase Hosting 변경 없음.
- Firebase Functions 변경 없음.
- Media Worker 변경 없음.
- D1 schema/migration/seed/write 없음.
- 사용자 원본 데이터 변경 없음.
- RTDB 구조/Rules 변경 없음.
- UI/CSS 변경 없음.
- TEST/PRODUCTION Worker 변경 없음.

남은 확인:
- 인증된 실제 사용자 계정의 `좋아요 곡` 카드가 화면에 다시 표시되는지 사용자 실사용 확인 필요.
- PC↔모바일 숫자/하트 최종 수렴도 사용자 실사용 확인 전.

## 4. Catalog 092 — Firestore 전체조회 차단
완료/배포됨.
- 일반 Music Note/Library Catalog GET은 R2 only.
- 새 기기 + 기존 R2 Catalog: R2 1회 수신 → 로컬 cache → 이후 로컬 우선.
- profile revision 불일치가 일반 앱 경로에서 `buildCanonicalCatalog()` Firestore full scan 권한이 되지 않음.
- R2 Catalog가 없으면 일반 GET/delta에서 Firestore collection traversal 금지.
- partial UI list 누락은 삭제로 해석하지 않음. explicit tombstone만 삭제.
- delta conflict/count mismatch도 R2 soft refresh만 수행.
- 앱 업데이트 자체로 전체 Catalog rebuild/cache wipe 금지.
- 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- 검증 Run: `34946586905` — PASS.

실사용 결과:
- 과거 약 618 read처럼 곡 수에 비례하는 대량 Firestore read 폭증은 PREVIEW 092 업데이트 후 재현되지 않음.
- 다음 비용 확인은 094 배포 후 Explore 좋아요 묶음 처리의 실제 Worker/D1/Firestore 증감을 실측한다.

## 5. Explore 좋아요 093 — PREVIEW 배포 완료 기반
093에서 완료된 기반:
- **D1**: 실제 좋아요 원본/처리 유지.
- **RTDB**: 같은 계정 다른 기기에 작은 변경 신호만 전달.
- Explore 좋아요 동기화 목적 Firestore `users/{uid}` write **0 목표**.
- durable outbox / max 50 / deferred aggregate 기반 구축.
- `src/services/exploreLikeService.ts`: Firestore `exploreLikeSyncSignal` write 제거, `userSync/{uid}/exploreLike` RTDB signal로 교체.
- `src/services/userDomainSyncService.ts`: UID-scoped Explore like RTDB subscriber 추가.
- `src/services/exploreLikeDisplayStateService.ts`: `liked=true + count=0` 모순만 `/v1/me/liked-tracks` targeted batch로 복구. 최대 50곡, cooldown 적용.
- 전체 Feed/Profile 재조회 없음, polling 없음, Firestore collection 조회 없음.
- 실제 canonical count가 0이면 가짜 `0→1` 보정 금지.

094는 이 093 기반을 유지하면서 **5초 timer batch를 세션/의미 있는 경계 batch로 교체**한 코드-only 후속 변경이다.

## 6. PREVIEW 093 실제 배포 결과
Run `34957675828` attempt 2 — **PASS**:
- source SHA 고정: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- source contract PASS
- TypeScript PASS
- Build PASS
- Firebase RTDB Emulator Rules compile PASS
- Firebase service account auth PASS
- RTDB OAuth token 발급 PASS
- shared RTDB Rules 배포 PASS
- 원격 RTDB Rules exact-source match PASS
- Firebase PREVIEW Hosting 093 배포 PASS
- 실제 `preview.soridraw.com` exact build 확인 PASS
- 실제 `app-version.json = 093` 확인 PASS
- TEST / PRODUCTION branch + Hosting 비변경 확인 PASS

## 7. 실제 변경 여부
- 실제 PREVIEW Hosting: **093 유지 / 094 미배포**
- GitHub PREVIEW 제품 코드: **094 구조 반영 완료**
- 실제 shared RTDB Rules: 093 유지 / 094 변경 없음
- 실제 PREVIEW Explore Worker: 056 유지 / 094 재배포 없음
- TEST code/Hosting: 변경 없음
- PRODUCTION code/Hosting: 변경 없음
- TEST/PRODUCTION Explore Worker: 변경 없음
- Media Worker: 변경 없음
- Firebase Functions: 변경 없음
- Firestore Rules: 변경 없음
- D1 schema/migration/seed: 변경 없음
- 사용자 원본 데이터: 변경 없음
- 사용자 데이터 migration/backfill/delete/overwrite: 없음
- UI/CSS 변경: 없음

## 8. 094 배포 후 실사용 비용/정확성 합격선
1. Explore에서 좋아요 2~10개를 연속으로 눌러도 5초마다 서버 요청이 발생하지 않는지 확인.
2. 추천/최신/인기 탭 전환만으로 좋아요 batch 서버 요청이 발생하지 않는지 확인.
3. 공개프로필 진입 또는 Explore 밖 페이지 이동 시 그동안의 좋아요 변경이 한 batch로 반영되는지 확인.
4. 50개 미만의 연속 변경이 ordinary browsing 동안 durable local 상태로 유지되는지 확인.
5. PC/모바일 같은 계정에서 boundary sync 후 하트가 변경분만 수렴하는지 확인.
6. 좋아요 숫자가 클릭 즉시 자연스럽게 ±1 되고, 서버 승인 뒤 0으로 되돌아가는 현상이 없는지 확인.
7. deferred aggregate가 따라온 뒤 canonical 숫자로 정상 수렴하는지 확인.
8. CACHE LIVE에서 Explore 좋아요발 Firestore `users:write` 증가 없음.
9. Firestore Console에서도 Explore 좋아요 때문에 write/read 연쇄 증가 없음.
10. D1은 기존 actual like source 유지하며 클릭 수만큼 불필요한 개별 요청이 생기지 않는지 확인.
11. 인증된 `/v1/me/liked-tracks`가 500이 아니고 실제 좋아요 곡 카드가 표시되는지 확인.
12. Music Note/Recent Songs 기존 RTDB 동기화 회귀 없음.
13. Catalog 새 기기/재진입 Firestore full-scan 재발 없음.

판정:
- ordinary Explore 탭 탐색만으로 좋아요 서버 flush가 발생하면 FAIL.
- 좋아요 하나마다 별도 서버 요청이 반복되면 FAIL.
- Explore 좋아요 때문에 Firestore `users` write + listener read가 생기면 FAIL.
- 숫자가 서버 승인 후 0 또는 오래된 값으로 역행하면 FAIL.
- Music Note/Recent Songs RTDB 기존 동기화가 깨지면 TEST 승격 금지.

## 9. TEST / PRODUCTION 승격
- TEST: **094를 PREVIEW에 실제 배포하고 비용/정확성 실사용 PASS 전 승격 금지.**
- 승격 시 검증된 PREVIEW exact tree 전체를 `main`으로 승격. 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 10. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 094 Explore like durable outbox + boundary/max-50 batch
- like display ledger / acknowledged count convergence
- 공개/비공개 변경분 처리 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

## 11. 다음 작업
- 현재 094는 **코드 반영 완료·배포 전**.
- 사용자가 PREVIEW 배포를 지시하면 앱 버전을 올리고 Firebase PREVIEW Hosting만 검증된 094 제품 코드로 배포한다.
- Worker 056, Media Worker, Functions, Rules는 094에서 변경하지 않았으므로 불필요하게 재배포하지 않는다.
- 배포 후 8번 실사용 합격선을 PC/모바일에서 측정한다.
- 모두 PASS 후에만 TEST 승격을 검토한다.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- Library zero-read 제품 commit: `485193ef6d147d4e4b3f03d3193cb4ba251fac72`
- 101 version bump commit: `20df686cbb2ad8097b115bb4938cce93b37f7cef`
- 101 PREVIEW 배포 source SHA: `88a52593f891755bd5999d0a63f0f0d86fcdd2d8`
- 101 Firestore Rules 선배포 Run: `35039874658` — **PASS**
- 101 PREVIEW App Release Run: `35039951005` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 101에서 변경/재배포 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 101 배포 Workflow 기준 비변경 PASS
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 101 배포 Workflow 기준 비변경 PASS
- **릴리스 상태: Explore 교차계정 좋아요 공개 숫자 동기화 실사용 FAIL로 TEST 승격 차단.**

## 2. 101 목표
Library를 앱 업데이트/페이지 이동만으로 서버 비용이 발생하지 않는 Local First 구조로 바꾼다.

정상 목표:
- warm cache + 데이터 변경 없음 → My List / Shared List 재진입 Firestore data read 0.
- Library 전용 playlist/item 실시간 listener 0.
- 표시 곡마다 자동 좋아요 2 reads fan-out 0.
- Shared List 진입 시 곡마다 `suno_shares` 자동 read 0.
- 페이지 진입만으로 write 0.
- 실제 사용자가 playlist/좋아요/공유곡을 변경·사용할 때만 필요한 부분 서버 사용.

## 3. 101 제품 구조
- 사용자별 IndexedDB에 playlist header와 folder items를 영속 저장.
- 앱 버전과 playlist cache를 분리해 앱 업데이트만으로 cache를 무효화하지 않음.
- warm cache + 동일 `users/{uid}.syncVersions.playlists`면 목록/선택 folder 서버 read 0 경로 사용.
- playlist/item `onSnapshot` 제거.
- 기존 users authority 상태의 작은 `syncVersions.playlists` 신호만 재사용.
- 실제 playlist 변경 시에만 `syncVersions.playlists`와 해당 playlist `itemsRevision` 갱신.
- 좋아요/공유 상태/작성자 곡별 page-entry fan-out 제거.
- 좋아요는 실제 클릭 때 canonical count + membership만 확인.
- 공유곡은 재생/다운로드 등 실제 사용 시 해당 share 한 건만 확인.
- 폴더 이동 전 중복 사전 query 제거, 기존 bounded duplicate query 한 번만 유지.

변경 파일:
- `src/lib/libraryPlaylistCache.ts`
- `src/services/playlistService.ts`
- `src/pages/SunoLibraryPage.tsx`
- `src/types.ts`
- `firestore.rules`
- `scripts/verify-101-library-playlist-zero-read.mjs`

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기 / 테마
- Explore Worker / Media Worker / D1
- Firebase Functions
- RTDB Rules
- 사용자 원본 데이터 구조의 파괴적 변경

## 4. Firestore Rules 변경
101 앱이 새 `syncVersions.playlists`를 쓰기 때문에 앱보다 Rules를 먼저 배포했다.

변경:
- `syncVersions.playlists` 정수 필드 허용.
- `users/{uid}` self-update에서 owner-safe 검사를 admin/master 검사보다 먼저 평가.
- 일반 사용자 self-update의 불필요한 admin dependent document read 가능성을 줄임.
- 관리자 타 사용자 관리 경로/권한 강도는 유지.

Rules 배포:
- Run `35039874658` — **PASS**
- Firebase project: `soridraw-app-866a5`
- Firestore Rules only 배포 PASS
- Hosting/Functions/data migration 없음
- `main` / `production` refs 비변경 PASS

## 5. 101 자동검증 / 독립 확인
제품 후보 기준 기존 검증:
- TypeScript PASS
- Production Build PASS
- `verify-029-music-note-library` PASS
- `verify-030-library-warm-cache-no-idle-read` PASS
- `verify-101-library-playlist-zero-read` PASS
- IndexedDB list/item write-read contract PASS
- Firestore Rules local emulator compile PASS
- `git diff --check` PASS

후속 GitHub Safety Run `35038525750`도 후보를 포함한 `preview`에서:
- TypeScript PASS
- Production Build PASS
- V1 compatibility/safety gate PASS

독립 코드 범위 확인:
- 제품 후보 `485193ef...`는 기준 `e7bb2ca4...` 대비 Library cache/service/page, type, Rules, 101 verifier만 변경.
- CSS/UI/Explore Worker/Media Worker/Functions/D1/RTDB 비변경 확인.
- migration/backfill/delete/overwrite 없음.
- Rules 변경은 하위호환 추가 + owner-first 평가 순서 변경이며 관리자 권한 제거 없음.

상태: **101 Library 코드/자동검증 PASS, PREVIEW 실사용 비용 검증 진행 중. Explore 기존 좋아요 구조는 별도 FAIL 확인.**

## 6. PREVIEW 101 배포 결과
canonical `.github/workflows/firebase-hosting-custom-preview.yml`로 Firebase PREVIEW Hosting을 배포했다.

Run `35039951005` — **PASS**:
- locked/deployed source SHA: `88a52593f891755bd5999d0a63f0f0d86fcdd2d8`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 PREVIEW `app-version.json = 101` 확인 PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

101에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- D1 schema/migration/seed

## 7. 사용자 데이터 / 안전 영향
- PREVIEW / TEST / PRODUCTION 사용자 원본 데이터 이동·복제 없음.
- 대량삭제/대량변환/backfill/migration 없음.
- 기존 playlist 문서/곡 데이터 의미 변경 없음.
- 새 기기 또는 새 IndexedDB cache가 없는 기존 기기는 최초 1회 legacy list + 선택 folder bootstrap read 허용.
- 이후 warm cache는 앱 버전 변경과 독립적으로 유지하는 구조.

## 8. 101 비용 기대값
정상 warm cache + 변경 없음:
- Library My List 재진입: Firestore data read 0 목표.
- Library Shared List 재진입: Firestore data read 0 목표.
- 20곡 기준 기존 좋아요 자동 40 reads → 0 목표.
- Shared List N곡 `suno_shares` 자동 N reads → 0 목표.
- 페이지 진입 write 0 목표.

실제 액션:
- 좋아요 클릭: canonical count + membership 2 reads 허용.
- 공유곡 실제 사용: 해당 `suno_shares` 1 read 허용.
- playlist 변경: 해당 canonical write + cross-device sync version/revision write 허용.

## 9. PREVIEW 101 실사용 검증 항목
최초 bootstrap과 warm 재진입을 반드시 분리 측정한다.

1. 기존 기기에서 101 첫 Library 진입 → 새 IndexedDB cache bootstrap 비용 기록.
2. 같은 기기 재진입 → My List 목록/선택 folder read 0 확인.
3. Shared List 재진입 → playlist/share 자동 read 0 확인.
4. 좋아요가 있는 20곡 기준 진입 시 곡별 40 reads가 사라졌는지 확인.
5. playlist 생성/이름변경/삭제/곡 추가/이동/삭제 후 PC↔모바일 수렴 확인.
6. 실제 좋아요 클릭에서만 canonical 2 reads 확인.
7. 공유곡 재생/다운로드 등 실제 사용 때만 해당 share 1 read 확인.
8. 페이지 이동/앱 업데이트만으로 write가 발생하지 않는지 확인.
9. Firebase Console / CACHE LIVE 측정값과 화면 동작 대조.
10. 기존 Music Note / Explore / 좋아요 기능 회귀 없음 확인.

정상 예외:
- 새 기기
- 브라우저 저장소 삭제/손상
- 101 적용 후 아직 playlist IndexedDB cache를 한 번도 만들지 않은 기기

이 경우 최초 bootstrap read는 허용하지만 곡별 likes/share fan-out은 허용하지 않는다.

## 10. PREVIEW 100 좋아요 보호 상태
101은 100의 Explore liked-card retention 구조를 건드리지 않았다.

보호:
- unlike 시 이미 받은 card payload를 즉시 삭제하지 않음.
- dormant card 최대 100곡 / 7일 bounded 유지.
- same-account like UI sync는 기존 RTDB/D1 구조 유지.
- Explore Worker 056 변경 없음.
- 기존 payload가 있는 unlike→re-like 후 warm `내 좋아요곡` D1 card read 0 목표 유지.

하지만 2026-09-16 교차계정 실측에서 **공개 총 좋아요 숫자 수렴 FAIL**을 확인했다. 이는 101 Library 수정이 아니라 기존 Explore Worker/public R2 propagation 구조의 결함으로 확인됐다.

## 11. TEST / PRODUCTION 승격
- TEST: **Explore 교차계정 좋아요 공개 숫자 동기화 FAIL 해결 + PREVIEW 100 liked-card 검증 + PREVIEW 101 Library 비용/정확성 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 12. 정상 기능 보호 / 알려진 위험
- Catalog 092: Music Note/Library 일반 catalog R2-only, Firestore full scan 금지.
- Worker 056: requested IDs PK/index lookup, 전체 tracks scan 금지.
- Music Note Local First + 묶음 저장 보호.
- Explore durable outbox + boundary/max50 batch + RTDB bounded retained transaction merge 보호.
- UI 비요청 변경 금지.
- warm cache 0-read 목표를 위해 앱 버전과 사용자 데이터 cache version을 다시 결합하지 말 것.
- playlist page-entry `onSnapshot` 또는 곡별 likes/share fan-out 재도입 금지.
- Build chunk-size/mixed import 경고는 기존 문제로 남음.
- Explore public Feed/Profile R2가 069 aggregate 변경을 못 받는 현상은 현재 최우선 릴리스 차단 오류.

## 13. 다음 작업
- Explore 069 aggregate → public Feed/Profile R2 changed-track propagation 복구.
- 교차계정 공개 총 좋아요 숫자 수렴 지연 구조 조정.
- 개인 heart membership의 missed-signal/오래된 local cache repair를 별도 해결.
- 그 뒤 PREVIEW에서 Master / Admin A / Admin B 계정 교차검증.
- Library 101 zero-read 실측을 이어서 완료.
- 모두 PASS 후에만 TEST 승격 검토.

## 14. 2026-09-16 Explore 교차계정 좋아요 FAIL — 확정 원인
사용자 영상 실측:
- Master PC와 같은 Master 모바일은 같은 계정 RTDB/local signal 덕분에 대체로 수렴.
- Admin A/B 다른 계정에서는 같은 공개곡의 총 좋아요 숫자가 과거 값에 머무는 현상 확인.
- 일부 계정에서 개인 heart membership도 과거 로컬 값이 남는 현상 보고.

정확한 의미:
- 빨간/채운 하트 = 현재 로그인 사용자의 개인 membership. 다른 계정끼리 같을 필요가 없고 공유하면 안 됨.
- 하트 옆 숫자 = 공개 총 좋아요 aggregate. 모든 계정/기기에서 수렴해야 함.

확정된 public aggregate 결함:
1. `044-local-first-cost-hotpath.mjs`는 legacy 075 aggregate에서 변경된 곡만 `patchExploreFeedR2Like044` / `patchExploreProfileR2Like044`로 public R2에 반영한다.
2. 후속 `055-explore-like-intake-w1-hotpath.mjs`가 새 좋아요 intake를 069 queue로 전환했다.
3. 069를 처리하는 `processExploreLikeAggregateWave035` / `processExploreLikeBatches035`는 D1 `likes`, `track_stats`, queue delete는 하지만 public Feed/Profile R2 patch가 없다.
4. `/v1/feed-revision`은 D1이 아니라 public Feed R2 ETag를 revision으로 사용한다.
5. 따라서 069 처리 후 D1이 바뀌어도 R2 ETag가 그대로면 다른 계정은 기존 local feed cache를 계속 최신으로 오인한다.

추가 수렴 지연:
- Worker cron: 10분 (`*/10 * * * *`).
- 클라이언트 `/v1/feed-revision` 로컬 캐시: 10분.
- Worker R2 revision edge cache: 60초.

개인 heart 별도 위험:
- UID별 `getExploreLikedTrackIds`는 이미 캐시된 track 상태를 재검증하지 않는다.
- 개인 Social Snapshot cache는 expiry/revision이 없다.
- bounded same-account RTDB signal을 놓친 오래된 기기는 개인 membership이 장기간 stale일 수 있다.

수정 원칙:
- 069 W1 저비용 intake는 보호.
- 실제 delta가 생긴 changed track만 public Feed/Profile R2에 반영.
- 전체 Feed/Profile/D1 scan 금지.
- unchanged page entry D1 R0 유지.
- 다른 사용자의 개인 heart membership broadcast 금지.
- 사용자 데이터 migration/backfill/delete/overwrite 없이 하위호환 수정.

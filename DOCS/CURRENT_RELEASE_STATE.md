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

상태: **코드/자동검증 PASS, PREVIEW 실사용 비용·PC↔모바일 수렴 검증 전.**

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

PREVIEW 100 liked-card 비용/PC↔mobile 실사용 최종 검증은 TEST 승격 전에 함께 완료해야 한다.

## 11. TEST / PRODUCTION 승격
- TEST: **PREVIEW 100 좋아요 검증 + PREVIEW 101 Library 비용/정확성 실측 PASS 전 승격 금지.**
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
- 실제 Firestore 청구 read와 PC↔모바일 수렴은 101 PREVIEW 실사용 검증 전.

## 13. 다음 작업
- PREVIEW 101을 사용자가 PC/모바일에서 실사용 검증.
- 최초 bootstrap vs warm 재진입 Firestore read를 분리 기록.
- My List / Shared List 재진입 0 read 확인.
- playlist 변경 후 PC↔모바일 수렴 확인.
- 100 liked-card zero-read도 함께 최종 확인.
- 모두 PASS 후에만 TEST 승격 검토.

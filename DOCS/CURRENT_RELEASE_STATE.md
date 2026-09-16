# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **100** — `https://preview.soridraw.com`
- 100 제품 수정 commit: `eef460f5024fab3a4ff6ad4e665c132aae0b69fa`
- 100 verifier commit: `3dd5c60ca2531e6c8fad2c062de0c18784a455d4`
- 100 version bump commit: `5f19e3f2c46a7f25e43ee22af8cd6bd15ae94961`
- 100 PREVIEW 배포 source SHA: `28a49b881e86f9f3ef752ed66e33d48a576bfe13`
- 100 최종 감사 Run: `35031690795` — **PASS**
- 100 PREVIEW App Release Run: `35033032795` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 100에서 변경/재배포 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 배포 Workflow 기준 비변경 PASS
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 배포 Workflow 기준 비변경 PASS
- 100 검증용 일회성 Workflow는 검증 후 삭제 완료.

## 2. Explore 좋아요 정상 목표
`여러 좋아요 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch → D1 변경분만 처리 → RTDB는 같은 계정 기기 간 작은 승인 신호만 전달 → 정상 재진입/앱 업데이트는 로컬 캐시 유지 → D1/Firestore 추가 읽기 0 목표`

보호 항목:
- 추천/최신/인기 탭 이동만으로 like flush 없음.
- durable local outbox 유지.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50에서만 batch.
- D1이 실제 좋아요 관계/숫자 처리 기준.
- RTDB `userSync/{uid}/exploreLike`는 승인 변경 신호만 전달.
- Firestore `users/{uid}`를 Explore-like 동기화용으로 쓰지 않음.
- 승인 display count는 canonical aggregate가 따라올 때까지 로컬 보존.
- RTDB retained result unique 최대 50 유지.

## 3. 099 실사용 FAIL에서 확정된 원인
099는 앱 update/reconnect 때 전체 canonical liked-ID cache를 지우는 문제는 해결했지만, PC/모바일 실측에서 `내 좋아요곡` 진입 시:
- `내 좋아요 곡 확인` LOCAL 0 / Worker 1
- D1 Query R1 / W0
- Rows Read R12 / W0
가 발생했다.

직접 원인은 앱 업데이트가 아니라 liked-card payload 파괴였다.
- unlike 시 `patchExploreLikedTrackMembership()`이 cached card item 삭제.
- same-device `rememberExploreLikedTrack(..., false)`도 card item 삭제.
- liked-page loader도 현재 비좋아요 item을 pruning.
- 다른 기기에서 re-like하면 RTDB는 membership/heart/count만 전달하므로 title/image/owner 카드 payload는 다시 생기지 않음.
- canonical liked ID는 있지만 card item이 없는 곡만 `/v1/me/liked-tracks` targeted hydration 발생.
- 실측 missing card 12개 → D1 Rows Read 12.

Worker 056은 requested IDs PK/index lookup이라 전체 tracks scan은 아니지만, 이미 이 기기에 있었던 카드 정보를 다시 읽는 것은 warm-cache 비용 목표에 FAIL.

## 4. 100 수정 — liked-card payload 재사용
클라이언트 캐시 정책만 최소 변경했다.
- unlike 시 card payload 즉시 삭제 금지.
- 최근 unlike card는 `dormantSince`와 함께 로컬 보존.
- re-like 시 기존 card payload 즉시 재사용 + dormant 표시 제거.
- `내 좋아요곡` 진입 때 현재 비좋아요 카드라는 이유만으로 전체 pruning하지 않음.
- dormant card는 최대 **100곡 / 7일**만 보존.
- 오래됐거나 max100 초과 dormant card만 로컬 정리.
- `LIKED_TRACK_CACHE_SCHEMA_VERSION = 1` 유지 → 100 업데이트가 기존 099 cache 자체를 무효화하지 않음.
- 새 기기/실제 캐시 삭제·손상/한 번도 payload를 받은 적 없는 remote-like 곡만 기존 targeted missing-card recovery 허용.

100 제품 변경 파일:
- `src/services/exploreLikedTracksService.ts`
- `scripts/verify-100-liked-card-retention.mjs`

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기 / 테마
- `src/pages/*`
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 5. 방법/비용 판단
- 이미 기기에 내려온 카드 제목/이미지/작성자 metadata는 좋아요 해제만으로 무효가 되지 않으므로 재사용한다.
- 해제 즉시 삭제 후 re-like 때 D1에서 같은 payload를 다시 받는 구조는 금지한다.
- 영구 무제한 보존도 피하기 위해 7일/100곡으로 bounded retention 한다.
- membership canonical 기준은 기존 D1/RTDB 결과를 그대로 따른다.
- 정상 warm cache + unchanged 상태에서 D1/Firestore data read 0 목표를 유지한다.
- 전체 Feed/Profile/tracks scan, 새 backend table, migration, 새 실시간 인프라는 추가하지 않았다.

## 6. 100 자동검증
최종 감사 Run `35031690795` — **PASS**:
- Install PASS
- TypeScript PASS
- Build PASS
- 085 liked-profile PASS
- 086/099 liked-sync PASS
- 087 liked-card consistency PASS
- 094 boundary batching PASS
- 095 zero-read display PASS
- 096/098 retained replay PASS
- 097 pending acknowledgement PASS
- 098 atomic RTDB merge PASS
- 099 update/reconnect zero-read PASS
- 100 liked-card retention PASS
- Node 24 Explore like cost fixture PASS
- backend/UI scope guard PASS

초기 Run `35031459971`은 제품/TypeScript/Build/085~100 verifier가 PASS한 뒤 cost fixture만 Node 20의 `node:sqlite` 미지원으로 실패한 실행환경 문제였고, 최종 Run에서 Node 24로 검증해 PASS했다.

## 7. PREVIEW 100 배포 결과
사용자 명확한 PREVIEW 배포 승인 후 canonical `.github/workflows/firebase-hosting-custom-preview.yml`로 **Firebase PREVIEW Hosting만** 배포했다.

Run `35033032795` — **PASS**:
- locked source SHA: `28a49b881e86f9f3ef752ed66e33d48a576bfe13`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 `app-version.json = 100` PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

100에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 8. 사용자 데이터 / 안전 영향
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.
- PREVIEW/TEST/PRODUCTION 공유 사용자 데이터 이동/복제 없음.
- 좋아요 실제 저장은 기존 D1 boundary/max50 batch 구조 유지.
- 100은 로컬 liked-card cache 보존 정책만 변경.
- UI 변경 없음.

## 9. PREVIEW 100 실사용 합격선
1. PC/모바일 모두 기존 캐시를 삭제하지 않고 100 업데이트 적용.
2. CACHE LIVE 초기화.
3. 현재 이미 hydration된 `내 좋아요곡` 재진입 → `/v1/me/liked-tracks` D1 Rows Read 0 확인.
4. PC에서 좋아요 곡 3~5개 **해제 → boundary → 다시 좋아요 → boundary**.
5. 모바일에서 같은 곡 heart/count 수렴 확인.
6. PC/모바일 각각 `내 좋아요곡` 진입 → 기존 card payload 재사용, D1 Rows Read 0 확인.
7. 반대 방향 모바일 해제/re-like → PC에서도 동일 확인.
8. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0.
9. Firestore Explore-like sync read/write 0.
10. CACHE LIVE와 Cloudflare D1 Rows read/written 증가분 대조.

정상 예외:
- 새 기기
- 실제 캐시 삭제/손상
- 이 기기에서 한 번도 card payload를 받은 적 없는 곡이 다른 기기에서 새로 좋아요된 경우

이 경우만 bounded targeted missing-card read 허용.

FAIL 조건:
- 기존 payload가 있던 곡의 unlike→re-like 후 `내 좋아요곡`에서 다시 D1 card read 발생.
- 업데이트만으로 기존 card/membership cache 초기화.
- PC↔모바일 heart/count 불일치.
- Explore 내부 탐색만으로 batch/write 발생.
- 전체 liked list / Feed / tracks scan 재도입.

## 10. TEST / PRODUCTION 승격
- TEST: **100 PREVIEW 실사용 zero-read + PC↔mobile 정확성 + Cloudflare 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 정상 기능 보호 / 알려진 위험
- Catalog 092: Music Note/Library 일반 catalog R2-only, Firestore full scan 금지.
- Worker 056: requested IDs PK/index lookup, 전체 tracks scan 금지.
- Music Note Local First + 묶음 저장 보호.
- Explore durable outbox + boundary/max50 batch + RTDB bounded retained transaction merge 보호.
- UI 비요청 변경 금지.
- RTDB retained window 최대 50 unique track 유지.
- dormant liked-card cache는 최대 100곡 / 7일로 bounded.
- Build chunk-size/mixed import 경고는 기존 문제로 남음.
- GitHub branch API는 `protected:true`이지만 세부 protection 응답에 `enabled=false`가 함께 보이는 표시 불일치가 있어 운영 위험 기록 유지.

## 12. 다음 작업
- Library zero-read 후보 commit `485193ef6d147d4e4b3f03d3193cb4ba251fac72` 독립 감사.
- 감사 PASS 후 Firestore Rules 선배포 → 앱 101 버전 고정 → PREVIEW Hosting 배포 순서로 진행.
- PREVIEW에서 최초 cache bootstrap과 warm 재진입을 분리 측정.
- PC↔모바일 플레이리스트 변경 수렴, 공유 리스트 재진입 0 read, 좋아요 진입 0 read 실측.
- PREVIEW 100 좋아요 검증과 Library 비용 검증이 모두 PASS한 뒤에만 TEST 승격 검토.

## 13. Library zero-read 후보 — 코드 완료 / 배포 전
- 기준 branch/commit: `preview` / `e7bb2ca455818ea6dcf47c3ba695ae82fea795b4`
- 제품 후보 commit: `485193ef6d147d4e4b3f03d3193cb4ba251fac72`
- 실제 PREVIEW 앱은 여전히 **100**이며 이 후보는 아직 배포하지 않았다.

확정 원인:
- Library My List 진입 시 `user_playlists` 목록과 선택 폴더 items에 `onSnapshot`을 매번 재부착.
- 기본 폴더 확인용 전체 `getDocs`가 앱 세션마다 추가 실행.
- 6시간 TTL 만료 시 표시 곡마다 `playlist_like_counts` + `playlist_likes` 2 reads.
- Shared List 진입은 TTL을 무시하고 곡마다 `suno_shares` 공개 상태를 강제 재조회.
- 공유 작성자 이름 fallback도 `suno_shares`/`users`를 곡별 조회할 수 있었음.

수정:
- 사용자별 IndexedDB playlist header/item cache 추가. 앱 버전과 독립하며 업데이트로 무효화하지 않음.
- warm cache + 동일 `syncVersions.playlists`이면 목록/선택 폴더 서버 read 0.
- playlist/item `onSnapshot` 제거. 기존 전역 users authority listener의 작은 version 신호만 재사용.
- 실제 playlist 변경 때만 `syncVersions.playlists`와 해당 playlist `itemsRevision` 갱신.
- 좋아요/공유 상태/작성자 곡별 page-entry fan-out 제거.
- 좋아요는 실제 클릭 때 count + membership만 확인하고 사용자가 누른 의도를 canonical 상태에 적용.
- 공유곡은 재생/다운로드 등 실제 사용 때 해당 share 1곡만 확인. private 결과는 5분만 차단 캐시해 재공개 복구 가능.
- 폴더 이동 전 중복 사전 query 제거. 기존 service의 bounded duplicate query 한 번만 사용.

Rules 감사/수정:
- Library owner read path는 `isOwner(uid) || isAdmin()` 순서라 일반 사용자는 admin dependent read 없음.
- playlist likes read는 `isAuthenticated()`만 사용하고 admin dependent read 없음.
- public/owner share read는 admin 검사 전에 단락됨.
- `users/{uid}` self-update만 기존에 `isMaster()`가 먼저였음. owner-safe update를 첫 조건으로 이동해 일반 사용자 self-update의 숨은 dependent read를 제거.
- 관리자 타 사용자 관리 경로와 권한 강도는 변경하지 않음.
- Rules `get()/exists()`가 같은 users 문서를 여러 번 참조해도 dependent document는 요청당 최대 1 read지만, admin 경로에서는 그 1 read가 필요하므로 Custom Claims 전환 없이 제거하지 않음.

비용 기대값:
- 기존 warm Library My/Shared List 재진입: Firestore data read 0 목표.
- 20곡 기준 기존 좋아요 자동 40 reads: 0.
- Shared List 진입 N곡 `suno_shares` 자동 N reads: 0.
- 실제 좋아요 클릭: canonical count + membership 2 reads, 상태 변경 때만 writes.
- 실제 공유곡 사용: 해당 `suno_shares` 1 read.
- 실제 playlist 변경: canonical write + cross-device version/해당 folder revision writes. 페이지 진입 반복 비용을 실제 변경 시점으로 이동.

정상 예외/남은 실측:
- 이 후보를 처음 적용한 기존 기기에는 playlist IndexedDB cache가 아직 없으므로 최초 1회 legacy list + 선택 folder bootstrap reads가 필요하다. 이후 앱 업데이트/재진입은 cache 유지.
- 새 기기/브라우저 저장소 삭제·손상도 같은 1회 bootstrap 허용.
- 첫 bootstrap 자체를 단일 document read로 묶으려면 별도 aggregate bundle/backfill 설계가 필요하며 이번 작업에는 migration/backfill을 추가하지 않았다.
- PC/모바일 실제 수렴과 Firebase Console 청구 read는 배포 후 미검증.

검증:
- TypeScript PASS
- Production Build PASS
- `verify-029-music-note-library` PASS
- `verify-030-library-warm-cache-no-idle-read` PASS
- `verify-101-library-playlist-zero-read` PASS
- IndexedDB list/item write-read contract PASS
- Firestore Rules local emulator compile PASS
- `git diff --check` PASS

변경 없음:
- UI/CSS/반응형/위치/크기/테마
- Explore Worker / Media Worker / D1
- Firebase Functions / RTDB Rules
- 사용자 원본 데이터 migration/backfill/delete/overwrite
- TEST / PRODUCTION branch 및 배포 환경

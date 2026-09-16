# NEXT CODEX TASK

상태: **PREVIEW 앱 101 배포 완료 / Firestore Rules 선배포 완료 / 실사용 비용·PC↔모바일 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- Library zero-read 제품 commit: `485193ef6d147d4e4b3f03d3193cb4ba251fac72`
- 101 version bump: `20df686cbb2ad8097b115bb4938cce93b37f7cef`
- PREVIEW 101 배포 source: `88a52593f891755bd5999d0a63f0f0d86fcdd2d8`
- Firestore Rules 선배포 Run: `35039874658` — PASS
- PREVIEW App Release Run: `35039951005` — PASS
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 101에서 해결한 구조
- 사용자별 IndexedDB playlist header/item cache.
- 앱 버전과 playlist cache version 분리.
- warm cache + 동일 `syncVersions.playlists`이면 Library 목록/선택 folder 서버 read 0 경로.
- Library playlist/item `onSnapshot` 제거.
- 실제 playlist 변경 때만 `syncVersions.playlists` + 해당 `itemsRevision` 갱신.
- page-entry 곡별 likes/share/author fan-out 제거.
- 좋아요 실제 클릭 때 canonical count + membership 2 reads 허용.
- 공유곡 실제 사용 때 해당 share 1 read 허용.
- Firestore Rules owner-first self-update로 일반 사용자 admin dependent read 가능성 제거.

## 배포 검증
Rules Run `35039874658`:
- Firestore Rules only PASS.
- `soridraw-app-866a5` 배포.
- Hosting/Functions/data migration 없음.
- main/production refs 비변경 PASS.

App Run `35039951005`:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build hash PASS.
- 실제 `app-version.json = 101` PASS.
- TEST / PRODUCTION Hosting 비변경 PASS.

## 다음 작업 — PREVIEW 실사용 검증
코드 수정부터 하지 말고 비용/정확성을 먼저 측정한다.

1. 101 최초 Library 진입: 새 IndexedDB playlist cache bootstrap 비용 기록.
2. 같은 기기 warm 재진입: My List 목록/선택 folder Firestore read 0 확인.
3. Shared List warm 재진입: playlist/share 자동 read 0 확인.
4. 좋아요가 있는 20곡 수준에서 기존 곡별 40 reads가 0이 되었는지 확인.
5. playlist 생성/이름변경/삭제/곡 추가/이동/삭제 후 PC↔모바일 수렴 확인.
6. 좋아요 실제 클릭 때만 canonical 2 reads 확인.
7. 공유곡 실제 재생/다운로드 때만 해당 share 1 read 확인.
8. 페이지 이동/앱 업데이트만으로 write가 발생하지 않는지 확인.
9. PREVIEW 100 liked-card unlike→re-like zero-read도 함께 재확인.

## 정상 예외
- 새 기기.
- 브라우저 저장소 삭제/손상.
- 101 적용 후 playlist IndexedDB cache를 아직 한 번도 만들지 않은 기기.

위 경우 최초 bootstrap read는 허용한다. 단, 곡별 likes/share fan-out 재발은 허용하지 않는다.

## 문제 발견 시 수정 원칙
- UI/CSS/반응형 변경 금지.
- 전체 playlist/track 재조회 금지.
- page-entry `onSnapshot` 재도입 금지.
- 앱 버전 변경으로 cache 전체 무효화 금지.
- 실제 변경된 목록/폴더/곡만 bounded refresh.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.

## 승격 금지
- PREVIEW 100 liked-card 검증 + PREVIEW 101 Library 비용/PC↔모바일 정확성 실측이 모두 PASS하기 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 사용자 데이터는 환경 간 복사하지 않는다.

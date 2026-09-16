# NEXT CODEX TASK

상태: **Library zero-read 후보 구현·자동검증 완료 / 독립 감사 및 PREVIEW 배포 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 작업 시작 HEAD: `e7bb2ca455818ea6dcf47c3ba695ae82fea795b4`
- Library zero-read 제품 후보: `158bf60b582260a4971d3343de76886a1ac33ba8`
- 실제 PREVIEW 앱: **100** — 새 Library 코드/Rules 미배포
- PREVIEW 100 배포 source: `28a49b881e86f9f3ef752ed66e33d48a576bfe13`
- TEST / PRODUCTION: 변경·배포 없음

## 해결 대상과 기존 실측
Library 첫 진입 Browser SDK R69:
- `user_playlists:onSnapshot` 21
- `user_playlists:getDocs` 8
- `playlist_like_counts:getDoc` 20
- `playlist_likes:getDoc` 20

추가 문제:
- Shared List 진입마다 TTL을 무시하고 표시 곡 수만큼 `suno_shares`를 재조회.
- playlist header와 선택 folder items에 실시간 listener를 매번 재부착.
- Rules의 admin helper가 `users/{uid}`를 `get()/exists()`하는 경로에 dependent document read 가능.

## 제품 후보 구조
- 사용자별 IndexedDB에 playlist header와 folder items를 영속 저장.
- warm cache와 `users/{uid}.syncVersions.playlists`가 같으면 Library 목록/선택 folder 서버 read 0.
- Library 전용 `onSnapshot` 2종 제거. 기존 users authority listener의 작은 version 신호만 사용.
- 실제 playlist 변경 때만 user sync version과 해당 playlist `itemsRevision` 갱신.
- 좋아요/공유 상태/작성자 곡별 page-entry fan-out 제거.
- 좋아요는 실제 클릭 시 canonical count + membership을 확인해 사용자가 누른 의도를 적용.
- 공유곡은 재생/다운로드 등 실제 사용 시 해당 share 한 건만 확인.
- 일반 사용자 self-update Rules는 owner-safe 조건을 먼저 평가해 admin dependent read를 피함.
- 관리자 권한 및 타 사용자 관리 경로는 유지.

## 자동검증
- TypeScript PASS
- Production Build PASS
- `verify-029-music-note-library` PASS
- `verify-030-library-warm-cache-no-idle-read` PASS
- `verify-101-library-playlist-zero-read` PASS
- IndexedDB list/item write-read contract PASS
- Firestore Rules local emulator compile PASS
- `git diff --check` PASS

## 다음 단계 — 독립 감사
대상 제품 commit: `158bf60b582260a4971d3343de76886a1ac33ba8`

확인 항목:
1. warm Library 진입에 Firestore list/items/likes/share read 경로가 남지 않았는지 확인.
2. cache miss, remote version 증가, 실제 사용자 action만 서버 read를 허용하는지 확인.
3. PC↔모바일 playlist 생성/이름변경/삭제/곡 추가·이동·삭제가 version/revision으로 수렴하는지 확인.
4. Rules owner-first 변경이 관리자 권한을 약화하지 않는지 확인.
5. UI/CSS/Explore Worker/Media Worker/D1/Functions/RTDB가 비변경인지 확인.
6. 사용자 원본 데이터 migration/backfill/delete/overwrite가 없는지 확인.

## PREVIEW 배포 순서
독립 감사 PASS 후에만:
1. 추가형 Firestore Rules 선배포.
2. 앱 버전 **101** 고정 및 verifier 갱신.
3. PREVIEW App Release로 Hosting 배포.
4. 실제 `preview.soridraw.com` build/version 확인.

주의:
- 앱 101이 새 `syncVersions.playlists`를 쓰므로 **Rules를 먼저 배포**해야 한다.
- TEST / PRODUCTION 승격 금지.

## PREVIEW 실측
최초 101 적용 시:
- 기존 기기에는 새 IndexedDB playlist cache가 없으므로 legacy list + 선택 folder bootstrap read 1회 허용.
- 이 최초 bootstrap에서도 곡별 좋아요 40 reads와 Shared List 곡별 share reads는 0이어야 함.

warm 재진입 시:
- My List / Shared List 목록·선택 folder·좋아요·공유상태 자동 read 0.
- Library 전용 snapshot listener 0.
- 페이지 진입 write 0.

실제 변경 시:
- 좋아요 클릭은 canonical 2 reads 허용.
- 공유곡 실제 사용은 해당 share 1 read 허용.
- playlist 변경은 canonical write + sync version/revision write 허용.
- 반대 기기에서 version 신호 수신 후 변경된 목록/선택 folder만 bounded refresh되는지 확인.

## 승격 금지
- PREVIEW 100 liked-card 검증과 PREVIEW 101 Library 비용·정확성 실측이 모두 PASS하기 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 사용자 데이터 migration/backfill/delete/overwrite 금지.

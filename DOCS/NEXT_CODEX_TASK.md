# NEXT CODEX TASK

상태: **PREVIEW Worker 050 / 083 비용 수정 배포 완료 / 공개·비공개 실사용 재계측 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- PREVIEW 앱: **082** — 프론트 변경 없음
- 083 Worker locked source: `2dfaf70095592c1831fc93fb2c9777ccb126b9b3`
- PREVIEW Worker Run `34796380007` — PASS
- PREVIEW Worker active Version: `ed462a80-29a2-4df0-a7ef-84dcef3c5fbc`
- PREVIEW App Run `34794189198` — 기존 082 PASS
- actual `preview.soridraw.com` app version: **082**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 082 실사용에서 확인된 문제
공개/비공개만 실제 계정으로 측정했을 때:
- 1곡: `R4/W2`, 다른 케이스 `R3/W2`.
- 3곡 공개: `R36/W6`.
- 3곡 비공개: `R30/W6`.
- Firestore는 `R0/W0/D0`.
- page-exit batch 1회 구조 자체는 정상.

원인:
- Worker 049의 `owner_uid=? AND id IN (...)` 조회가 실제 D1에서 `idx_tracks_owner_profile_order (owner_uid=?)`를 사용해 owner 범위를 먼저 읽음.
- 3곡만 필요해도 사용자 소유곡 여러 행을 읽어 rows_read가 커짐.

## 083에서 완료된 것
- Worker 050 추가.
- registered publication canonical pre-read를 `WHERE id IN (...)`으로 변경.
- DB 결과는 Worker에서 `owner_uid === auth uid` 검증.
- UPDATE의 `id + owner_uid + source_type` 권한 가드 유지.
- live D1 query plan이 `sqlite_autoindex_tracks_1 (id=?)` exact lookup을 사용하는지 permanent release gate에서 검사.
- 081 page-exit final-state batch 유지.
- 082 R2 missing self-heal/revision-first 구조 유지.
- Shared D1 migration/schema 변경 0.
- 사용자 데이터 변경/백필/복제 0.
- UI/CSS/레이아웃 변경 0.

## 쓰기 W2 기준
현재 곡당 W2는:
1. canonical `tracks` row update.
2. protected `explore_shared_revision` update.

공유 revision은 다른 환경/기기/파생 캐시의 변경 감지를 위한 기존 호환 계약이다. 083에서는 read 폭증만 제거했고 W2는 정상 기준으로 유지한다.

## 검증/배포 결과
Materialization Run `34796253747` — PASS.
- TypeScript PASS.
- Build PASS.
- Explore like/derived-cache regression PASS.
- 080 publication-state PASS.
- 082 publication-batch PASS.
- 083 PK-read PASS.
- deploy preflight PASS.
- shared D1 schema change 0.

Worker Run `34796380007` — PASS.
- locked source `2dfaf70095592c1831fc93fb2c9777ccb126b9b3`.
- canonical SHA256 `ddb9ceaa190befe231ac3597a80cb0484cd1b6fc65aab669f2c39d4a3a1cac77`.
- active Worker `ed462a80-29a2-4df0-a7ef-84dcef3c5fbc`.
- live plan `SEARCH tracks USING INDEX sqlite_autoindex_tracks_1 (id=?)` PASS.
- Feed/Profile smoke PASS.
- warm Feed revision `R0/W0`, `HEAD-ONLY-036` PASS.
- TEST/PRODUCTION Worker unchanged PASS.

Firebase:
- 083 변경 없음. Hosting/Functions/Rules 미변경.

## 다음 작업 — 사용자 PREVIEW 공개/비공개 재테스트
새 코드 수정 전에 이전 영상과 동일한 방식으로 다시 측정한다.

1. 진단 초기화.
2. 등록된 1곡 공개/비공개 후 페이지 이탈.
3. 등록된 3곡 공개 후 페이지 이탈.
4. 같은 3곡 비공개 후 페이지 이탈.
5. 단계마다 D1 R/W, R2 A/B, Firestore R/W 기록.
6. 최종 공개상태가 맞는지 확인.

판정:
- 3곡에서 R30~36 재발 = FAIL.
- read는 변경 곡 수에 가까운 작은 수치로 내려와야 함.
- 예상 참고값은 3곡 비공개 약 `R6/W6`, 3곡 공개 약 `R9/W6`지만 **실측 전 확정 금지**.
- W는 현재 곡당 2가 정상 계약.
- 페이지 안 중간 서버 전송 0 유지.
- Firestore 공개/비공개 `R0/W0` 유지.

## 재테스트 이후
- 공개/비공개 비용 PASS면 좋아요, Music Note 상세편집, Library, 새 기기/장기 미접속, PC↔모바일 동기화 검증으로 이동.
- read가 여전히 높으면 추가 최적화 전에 응답별 D1 비용 경로를 다시 측정해 원인부터 확정.
- Firestore `user_structures` 불필요 write는 공개/비공개 외 Music Note 동작에서 별도 확인.

## 승격 기준
- zero-dirty navigation server R/W 0.
- 정상 warm cache 재진입 server read 0 목표.
- 공개/비공개 batch에서 owner-wide scan 제거가 실제 계정에서도 확인.
- 공개상태 correctness 유지.
- 좋아요/Music Note/Library 최종 상태 정확성 유지.
- PC/모바일 수렴 유지.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

TEST: **083 실사용 비용 + correctness 재검증 PASS 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.

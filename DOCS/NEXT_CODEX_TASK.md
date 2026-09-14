# NEXT CODEX TASK

상태: **PREVIEW Worker 051 / 084 비용 수정 배포 완료 / 공개·비공개 실사용 재계측 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- PREVIEW 앱: **082** — 프론트 변경 없음
- 084 Worker locked source: `3380b2ae9242743f96fc73307da322d1508f5d19`
- 084 Worker release trigger: `8d3b5541819d7d36fd9e3d208464ea7782f795ca`
- PREVIEW Worker Run `34800196216` — PASS
- PREVIEW Worker active Version: `353327be-ac54-4c09-ad9c-b036f763f44e`
- PREVIEW App Run `34794189198` — 기존 082 PASS
- actual `preview.soridraw.com` app version: **082**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 083 실사용에서 확인된 남은 문제
사용자가 PREVIEW 083에서 3곡 공개/비공개를 다시 측정했다.
- 3곡 공개: publication batch `R18/W6`, 페이지 전체 `R20/W6`.
- 같은 3곡 비공개: batch 증가분 `R12/W6`.
- 082의 공개 R36 / 비공개 R30보다 크게 감소했으므로 083 PK lookup 효과는 확인됨.
- 하지만 아직 비용 기준 미달이라 TEST 승격은 계속 금지.

## 084에서 완료된 것
Worker 051은 이미 등록된 publication 변경의 남은 중복 read를 줄인다.

- Music Note publication R2 snapshot이 warm/완전하면 그것으로 이전 상태와 final-state 차이를 계산.
- 실제 바뀐 필드만 canonical `UPDATE ... RETURNING *`로 갱신하고 canonical row도 같은 결과에서 회수.
- 별도 canonical pre-read를 warm path에서 제거.
- owner/source_type 권한 가드 유지.
- 공개 요청의 published 상태 guard 유지.
- R2가 missing/stale/incomplete하거나 UPDATE 결과가 없으면 해당 track id만 정확한 PK SELECT fallback.
- public mutation hot path의 `track_stats` preflight 제거.
- Feed/Profile R2 helper는 기존 materialized like/comment/play 값을 우선 보존.
- RETURNING으로 이미 갱신한 track은 downstream 중복 UPDATE 생략.
- 최초 등록 publication 경로 변경 없음.
- 081 page-exit final-state batch 유지.
- 082 missing-R2 canonical self-heal + revision-first 유지.
- UI/CSS/프론트 변경 0.
- Shared D1 schema/migration 변경 0.
- 사용자 데이터 백필/삭제/복제 0.

## 쓰기 W2 기준
현재 곡당 W2는 그대로 유지한다.
1. canonical `tracks` row update.
2. protected `explore_shared_revision` update.

공유 revision은 다른 환경/기기/파생 캐시의 변경 감지 계약이다. 별도 동기화 재설계 없이 제거하지 않는다.

## 검증/배포 결과
Materialization Run `34799978499` — PASS.
- TypeScript PASS.
- Build PASS.
- Explore like/derived-cache regression PASS.
- 082 publication-batch PASS.
- 083 PK-read PASS.
- 084 write-returning PASS.
- deploy preflight PASS.
- shared D1 schema change 0.

Worker Run `34800196216` — PASS.
- locked source `3380b2ae9242743f96fc73307da322d1508f5d19`.
- canonical SHA256 `020105ef24dd95af10d27d9d13e52c3eca95dd9a80a17bdec212225f9447c77c`.
- active Worker `353327be-ac54-4c09-ad9c-b036f763f44e`.
- live PK plan `SEARCH tracks USING INDEX sqlite_autoindex_tracks_1 (id=?)` PASS.
- Feed/Profile smoke PASS.
- warm Feed revision `R0/W0`, `HEAD-ONLY-036` PASS.
- like cron PASS.
- TEST/PRODUCTION Worker unchanged PASS.

Firebase:
- 084 변경 없음. Hosting/Functions/Rules 미변경.

## 다음 작업 — 사용자 PREVIEW 084 재테스트
새 코드 수정 전에 이전 영상과 같은 방식으로 다시 측정한다.

1. 진단 초기화.
2. 이미 등록된 3곡을 공개하고 페이지 이탈.
3. 같은 3곡을 비공개하고 페이지 이탈.
4. 각 단계의 publication batch D1 R/W와 페이지 전체 D1 R/W 확인.
5. R2 A/B, Firestore R/W 확인.
6. 페이지 안에서는 중간 서버 요청이 없는지 확인.
7. 최종 공개상태와 Explore/공개프로필 표시 확인.
8. 기존 좋아요/재생/댓글 숫자가 공개/비공개 후 사라지거나 0으로 틀어지지 않는지 확인.

판정:
- healthy warm state에서 3곡 공개/비공개가 083의 R18/R12보다 명확히 더 내려가야 한다.
- 구조상 목표 참고값은 약 `R6/W6`, 단 **실측 전 확정 금지**.
- R2 missing/stale/incomplete 첫 1회는 bounded fallback 때문에 더 높을 수 있다.
- 같은 정상 warm 조건에서 fallback/read 증가가 반복되면 FAIL로 보고 원인을 추적한다.
- W6 유지.
- Firestore 공개/비공개 `R0/W0` 유지.

## 재테스트 이후
- 공개/비공개 비용 + correctness PASS면 좋아요, Music Note 상세편집, Library, 새 기기/장기 미접속, PC↔모바일 동기화 검증으로 이동.
- read가 여전히 높으면 응답별 D1 비용 경로를 다시 분리해 원인을 확정한 뒤 다음 수정.
- engagement 숫자 보존이 깨지면 TEST 승격 금지하고 R2 materialized counter 전달 경로만 수정.
- Firestore `user_structures` 불필요 write는 공개/비공개 외 Music Note 동작에서 별도 확인.

## 승격 기준
- zero-dirty navigation server R/W 0.
- 정상 warm cache 재진입 server read 0 목표.
- 공개/비공개 batch read가 변경곡 수에 가까운 작은 값으로 유지.
- 공개상태 correctness 유지.
- engagement 숫자 보존.
- 좋아요/Music Note/Library 최종 상태 정확성 유지.
- PC/모바일 수렴 유지.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

TEST: **084 실사용 비용 + correctness 재검증 PASS 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.

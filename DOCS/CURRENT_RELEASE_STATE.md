# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **082** (083/084는 Worker 비용 수정만 수행, 프론트 앱 변경 없음)
- 084 Worker 제품/배포 고정 source: `3380b2ae9242743f96fc73307da322d1508f5d19`
- 084 permanent release gate commit: `309816bce8952f09eeaa6a86a1d7b6e2c66fc2cf`
- 084 Worker release trigger commit: `8d3b5541819d7d36fd9e3d208464ea7782f795ca`
- PREVIEW Worker Run: `34800196216` — **PASS**
- PREVIEW Worker active version: `353327be-ac54-4c09-ad9c-b036f763f44e`
- PREVIEW App Run: `34794189198` — **PASS** / 앱 자체는 082 그대로
- 실제 `preview.soridraw.com` app version: **082**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경

## 2. 083 실사용 재계측 결과
사용자가 PREVIEW 083에서 이전과 같은 방식으로 공개/비공개 비용을 다시 측정했다.

관찰값:
- 3곡 공개: publication batch `D1 R18/W6`, 페이지 동기화 전체 `R20/W6`.
- 같은 3곡 비공개: 두 번째 publication batch 증가분 `D1 R12/W6`.
- 082의 `R36/W6`, `R30/W6` 대비 읽기는 크게 감소.
- page-exit에서 최종 상태를 한 번 묶어 보내는 동작은 정상 유지.

판정:
- 083 PK exact lookup은 실제 비용 감소 효과가 있었음.
- 하지만 3곡 기준 공개 R18 / 비공개 R12는 여전히 목표보다 높아 **TEST 승격 불가**.
- W6은 3곡 canonical 변경 + protected shared revision 계약에 따른 현재 정상 범위로 유지.

## 3. 084 원인 확정
083 이후 남은 읽기 경로를 코드 기준으로 다시 분리했다.

비공개:
- registered batch가 먼저 canonical `tracks` row를 PK SELECT로 읽은 뒤,
- 실제 UPDATE를 다시 실행하는 구조여서 동일 변경에 **pre-read + guarded write** 비용이 겹쳤다.

공개:
- 위 pre-read + UPDATE에 더해 publication hot path에서 `track_stats`를 다시 읽고 있었다.
- 기존 024 비용 계약상 engagement 값은 R2에 이미 materialize되어 있고 publication 변경 자체는 `track_stats` D1 read를 추가하지 않는 것이 원래 기준이다.

따라서 084는 스키마 추가가 아니라:
1. warm publication R2 상태로 변경 필요 필드를 판단하고,
2. canonical `UPDATE ... RETURNING *`에서 변경과 canonical row 회수를 한 번에 처리하며,
3. R2가 없거나 불일치/무변경 등 확인이 필요한 경우에만 정확한 track id SELECT fallback,
4. public `track_stats` preflight 제거
방식으로 읽기를 줄였다.

## 4. 084 확정 구조 — Worker 051
주요 파일:
- `cloudflare/explore-worker/patches/051-publication-write-returning.mjs`
- `cloudflare/explore-worker/release-patches.json`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `scripts/verify-084-publication-write-returning.mjs`
- `scripts/verify-083-publication-pk-read.mjs`
- `scripts/verify-082-publication-batch.mjs`
- `scripts/verify-explore-like-cost-optimization.mjs`
- `.github/workflows/cloudflare-explore-preview-release.yml`

변경:
- registered publication batch는 먼저 Music Note publication R2 snapshot을 확인.
- warm snapshot이 모든 sourceId/trackId와 맞으면, 실제 바뀐 필드만 `UPDATE tracks ... RETURNING *`로 처리.
- UPDATE 권한 가드는 `id + owner_uid + source_type='music_note'` 유지.
- 공개 요청은 기존 published 상태 가드 유지.
- UPDATE 결과가 없거나 R2 상태가 불완전/오래됨/불일치하면 해당 track id만 PK SELECT fallback.
- publication R2 자체가 없으면 083의 PK canonical SELECT fallback 사용.
- 이미 RETURNING으로 갱신한 track은 downstream에서 같은 canonical UPDATE를 다시 하지 않음.
- public hot path의 `track_stats` preflight 제거.
- Feed/Profile R2 publication helper는 기존 materialized like/comment/play 값을 우선 보존하는 043/024 계약 유지.
- 최초 등록 publication 경로는 변경하지 않음.
- 081 page-exit final-state batch, 082 missing-R2 self-heal, revision-first, UI/CSS/클라이언트 동작은 변경하지 않음.

## 5. 쓰기 W2 기준
084도 W2/곡을 억지로 줄이지 않았다.

현재 visibility 변경의 논리적 D1 write 2개는:
1. 해당 `tracks` canonical row 실제 변경.
2. 기존 공유 revision 보호 trigger가 `explore_shared_revision`을 갱신.

공유 revision은 다른 환경/기기/파생 캐시의 변경 감지를 위한 기존 호환 계약이다. 별도 동기화 설계 없이 제거하지 않는다.

## 6. 084 자동검증
Materialization Run `34799978499` — **PASS**.

확인:
- TypeScript PASS.
- Build PASS.
- Explore like cost regression PASS.
- Explore derived-cache regression PASS.
- 082 publication-batch regression PASS.
- 083 PK-read regression PASS.
- 084 write-returning regression PASS.
- deploy preflight PASS.
- Shared D1 migration/schema change **0**.

084 verifier가 보호하는 핵심:
- warm registered publication 변경은 canonical pre-read 없이 guarded `UPDATE ... RETURNING *` 사용.
- D1 SELECT는 unresolved/cold repair에만 제한.
- public `track_stats` preflight 재도입 금지.
- owner/source authorization guard 유지.
- R2 state guard + cold fallback 유지.

## 7. PREVIEW Worker 051 실제 배포
Run `34800196216` — **PASS**.

- locked source: `3380b2ae9242743f96fc73307da322d1508f5d19`
- canonical Worker SHA256: `020105ef24dd95af10d27d9d13e52c3eca95dd9a80a17bdec212225f9447c77c`
- Worker version: `ed462a80-29a2-4df0-a7ef-84dcef3c5fbc` → `353327be-ac54-4c09-ad9c-b036f763f44e`
- 082 regression PASS.
- 083 regression PASS.
- 084 regression PASS.
- live D1 PK plan: `SEARCH tracks USING INDEX sqlite_autoindex_tracks_1 (id=?)` PASS.
- live 035 prerequisite/state PASS, pending=0.
- Feed smoke PASS.
- public profile smoke PASS.
- unauthenticated like batch route HTTP 401 정상.
- warm Feed revision 실제 `D1 R0/W0 / HEAD-ONLY-036` PASS.
- like aggregate cron `*/10 * * * *` PASS.
- TEST Worker unchanged PASS.
- PRODUCTION Worker unchanged PASS.

## 8. Firebase / Functions / 데이터 변경
084는 Worker-only 비용 수정이다.

Firebase:
- Hosting 변경 없음.
- Functions 변경 없음.
- Firestore Rules 변경 없음.
- Firestore schema 변경 없음.

Cloudflare/D1:
- PREVIEW Worker만 051로 갱신.
- Shared D1 migration 없음.
- 테이블/인덱스/trigger 추가·삭제 없음.
- TEST/PRODUCTION Worker 비변경.

사용자 데이터:
- 대량삭제 없음.
- 백필 없음.
- destructive migration 없음.
- 기존 필드 제거/의미 변경 없음.
- 사용자 원본 데이터 복제/덮어쓰기 없음.

## 9. 비용 판정
확정된 것:
- 083은 owner scan을 제거해 3곡 공개 R36→R18, 비공개 R30→R12로 감소시켰다.
- 084는 남은 canonical pre-read를 warm path에서 제거하고 public track_stats preflight도 제거했다.
- unchanged warm Feed revision `R0/W0` 유지.
- page-exit final-state batch와 W2/곡 계약 유지.

아직 실사용 재계측이 필요한 것:
- 인증된 실제 3곡 공개/비공개의 최종 D1 rows_read/rows_written.
- healthy warm publication R2 상태라면 구조상 **약 R6/W6 수준**을 목표로 하나, 실제 계정 측정 전 확정 금지.
- R2가 missing/stale/incomplete하면 correctness 보호를 위해 bounded PK fallback이 발생하므로 해당 1회 수치는 더 높을 수 있음.
- Firestore `user_structures` 불필요 write 의심은 공개/비공개 외 Music Note 동작에서 별도 확인 필요.

## 10. 다음 PREVIEW 실사용 검증
가장 먼저 이전과 같은 공개/비공개 테스트를 084 Worker에서 반복한다.

1. 진단 초기화.
2. 이미 등록된 3곡 공개 후 페이지 이탈.
3. 같은 3곡 비공개 후 페이지 이탈.
4. 각 단계의 publication batch D1 R/W, 페이지 전체 D1 R/W, R2 A/B, Firestore R/W를 기록.
5. 페이지 안 중간 네트워크 요청이 없는지 확인.
6. 최종 공개상태가 실제 Explore/공개프로필/다른 기기에서 맞는지 확인.

합격 방향:
- healthy warm 상태에서 3곡 공개/비공개가 이전 083의 R18/R12보다 명확히 더 내려가야 함.
- 목표 참고값은 약 `R6/W6`이나 **실측이 기준**.
- W6 유지.
- 페이지 내부 중간 서버 전송 0 유지.
- Firestore 공개/비공개 `R0/W0` 유지.
- 공개/비공개 후 기존 좋아요/재생/댓글 숫자가 사라지거나 0으로 틀어지면 FAIL.

## 11. TEST / PRODUCTION 승격
- TEST 승격: **금지 / 084 실사용 비용 + correctness 재검증 전**.
- PRODUCTION 승격: **사용자의 명확한 정식배포 승인 전 금지**.
- PREVIEW→TEST 승격 시 사용자 데이터 복제/덮어쓰기 금지.

## 12. 정상 기능 보호
절대 임의 변경 금지:
- UI 외곽선/위치/크기/간격/반응형/테마/색상.
- 분할바/생성바 정상 동작.
- Music Note / Library Local First semantics.
- 081 page-exit final-state batching.
- 082 missing-R2 canonical self-heal + healthy revision-first 구조.
- Explore Feed/public profile R2 cache.
- 좋아요 10분 canonical aggregate.
- 공유 revision 호환 구조.
- 공유 사용자 원본 데이터.

## 13. 임시 작업 정리
084 구현/검증용 temporary workflows와 trigger는 배포 완료 후 제거 완료.

영구 보존:
- Worker patch 051.
- 084 regression verifier.
- 082/083 verifier의 051 호환 guard.
- canonical PREVIEW Worker 051 source/hash.
- permanent PREVIEW Worker release gate의 084 verifier.
- 기존 live PK query-plan guard.

## 14. 알려진 위험 / 다음 작업
- 084 구조상 read 감소 경로는 검증됐지만 실제 authenticated mutation rows_read는 사용자 실측 전이다.
- warm R2 snapshot과 canonical row가 다르면 안전하게 PK fallback하기 때문에 첫 1회 비용이 높을 수 있으며, 반복해서 fallback하면 원인을 추적해야 한다.
- public track_stats D1 read를 제거했으므로 공개/비공개 후 기존 engagement 숫자가 보존되는지도 실사용에서 함께 확인한다.
- W2/곡은 현재 공유 revision 계약이므로 별도 전체 동기화 설계 없이 제거하지 않는다.
- 사용자 재테스트가 PASS면 공개/비공개 비용 문제를 통과 후보로 처리하고 이후 좋아요/상세편집/Library/PC↔모바일 검증으로 이동한다.

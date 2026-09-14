# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **082** (083은 Worker 비용 수정만 수행, 프론트 앱 변경 없음)
- 083 Worker 제품/배포 고정 source: `2dfaf70095592c1831fc93fb2c9777ccb126b9b3`
- 083 Worker release trigger commit: `501bd84da704a3172c6f862688da78a0145fd695`
- PREVIEW Worker Run: `34796380007` — **PASS**
- PREVIEW Worker active version: `ed462a80-29a2-4df0-a7ef-84dcef3c5fbc`
- PREVIEW App Run: `34794189198` — **PASS** / 앱 자체는 082 그대로
- 실제 `preview.soridraw.com` app version: **082**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경

## 2. 083 작업 원인 — 082 실사용 계측
사용자가 PREVIEW 082에서 공개/비공개만 실제 계정으로 측정했다.

관찰값:
- 1곡 변경: 약 `D1 R4/W2`, 다른 1곡 케이스 `R3/W2`.
- 3곡 공개: `D1 R36/W6`.
- 3곡 비공개: `D1 R30/W6`.
- 공개상태 묶음 누적: `R73/W16`.
- Firestore 최근 10분: `R0/W0/D0` 유지.
- 페이지 안 중간 전송은 없고 page-exit 묶음 자체는 정상 작동.

판정:
- 외부 요청을 page-exit 1회로 묶는 구조는 PASS.
- 쓰기는 곡당 W2로 규칙적이지만, 읽기는 3곡에서 R30~36으로 비정상 증가해 FAIL.
- TEST 승격 중단 후 083 PREVIEW 비용 수정 진행.

## 3. 원인 확정
읽기 폭증은 요청 횟수가 많아서가 아니라 **Worker 049의 공유 canonical SELECT가 사용자 소유곡 범위를 먼저 훑는 실행계획**을 선택한 것이 원인이었다.

082 쿼리:
- `SELECT * FROM tracks WHERE owner_uid=? AND id IN (...)`

실제 D1 `EXPLAIN QUERY PLAN`:
- `SEARCH tracks USING INDEX idx_tracks_owner_profile_order (owner_uid=?)`

즉 3곡만 필요해도 사용자 owner index 쪽에서 여러 행을 읽은 뒤 track id를 거르는 구조였다.

대조 진단:
- `SELECT * FROM tracks WHERE id IN (...)`
- 실제 plan: `SEARCH tracks USING INDEX sqlite_autoindex_tracks_1 (id=?)`

따라서 스키마 추가 없이 기존 track primary key를 직접 쓰는 것이 가장 단순하고 비용이 낮은 수정으로 확정됐다.

## 4. 083 확정 구조 — Worker 050
주요 파일:
- `cloudflare/explore-worker/patches/050-publication-primary-key-batch-read.mjs`
- `cloudflare/explore-worker/release-patches.json`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `scripts/verify-083-publication-pk-read.mjs`
- `scripts/verify-082-publication-batch.mjs`
- `scripts/verify-explore-like-cost-optimization.mjs`
- `.github/workflows/cloudflare-explore-preview-release.yml`

변경:
- 이미 등록된 여러 공개/비공개 곡의 canonical pre-read를 `owner_uid + id IN`에서 **`id IN` primary-key lookup**으로 변경.
- DB에서 받은 행은 Worker에서 `owner_uid === auth uid`로 다시 검증.
- 실제 UPDATE에는 기존 `WHERE id=? AND owner_uid=? AND source_type='music_note'` 권한 가드를 그대로 유지.
- 최초 등록 publication 경로, 081 page-exit final-state batch, R2 snapshot, feed/profile cache 구조는 변경하지 않음.
- UI/CSS/프론트 코드 동작 변경 없음.

## 5. 쓰기 W2 해석
이번 083에서는 W2/곡을 억지로 W1로 줄이지 않았다.

현재 visibility 변경의 논리적 D1 write 2개는:
1. 해당 `tracks` canonical row 실제 변경.
2. 기존 공유 revision 보호 trigger가 `explore_shared_revision`을 갱신.

이 revision write는 다른 환경/기기와 파생 캐시가 변경 여부를 알기 위한 기존 호환 구조다. 현재 verifier도 정상 private/republish를 **2 logical writes including protected shared revision**으로 보호한다.

따라서 083의 목표는 비정상 owner-scan read 제거이며, W2는 중복 오류가 아닌 현재 공유 동기화 계약으로 유지한다. 이후 별도 설계 없이 revision write를 제거하지 않는다.

## 6. 083 자동검증
Materialization Run `34796253747` — **PASS**.

확인:
- TypeScript PASS.
- Build PASS.
- Explore like cost regression PASS.
- Explore derived-cache regression PASS.
- 080 publication state regression PASS.
- 082 publication batch regression PASS.
- 083 PK-read regression PASS.
- deploy preflight PASS.
- Shared D1 migration/schema change **0**.

083 verifier가 보호하는 핵심:
- publication registered batch pre-read는 track PK `id IN` 사용.
- owner-wide canonical pre-read 재도입 금지.
- JS owner authorization 유지.
- UPDATE owner/source_type guard 유지.
- Worker 050이 release patch 최종 순서로 유지.

## 7. PREVIEW Worker 050 실제 배포
Run `34796380007` — **PASS**.

- locked source: `2dfaf70095592c1831fc93fb2c9777ccb126b9b3`
- canonical Worker SHA256: `ddb9ceaa190befe231ac3597a80cb0484cd1b6fc65aab669f2c39d4a3a1cac77`
- Worker version: `4b46d3f4-4c4b-4dd2-9584-1b9f0d74ffd5` → `ed462a80-29a2-4df0-a7ef-84dcef3c5fbc`
- 082 regression PASS.
- 083 regression PASS.
- live D1 plan: **`SEARCH tracks USING INDEX sqlite_autoindex_tracks_1 (id=?)` PASS**.
- Feed smoke PASS.
- public profile smoke PASS.
- warm Feed revision 실제 `D1 R0/W0 / HEAD-ONLY-036` PASS.
- like aggregate cron `*/10 * * * *` PASS.
- TEST Worker unchanged PASS.
- PRODUCTION Worker unchanged PASS.

## 8. Firebase / Functions / 데이터 변경
083은 Worker-only 비용 수정이다.

Firebase:
- Hosting 변경 없음.
- Functions 변경 없음.
- Firestore Rules 변경 없음.
- Firestore schema 변경 없음.

Cloudflare/D1:
- PREVIEW Worker만 050으로 갱신.
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
- 082에서 공개/비공개 3곡의 R30~36은 정상 비용이 아니었음.
- 원인은 owner index scan으로 확정.
- 083 배포 전/실제 D1 plan에서 track primary-key exact lookup 사용 확인.
- 변경 없음 warm Feed revision `R0/W0` 유지.
- page-exit batch 구조와 Firestore `R0/W0` 관찰값 유지 대상.

아직 실사용 재계측이 필요한 것:
- 인증된 실제 공개/비공개 1곡/3곡의 최종 D1 rows_read/rows_written.
- 3곡 비공개는 구조상 대략 `R6/W6`, 3곡 공개는 track_stats exact read를 포함해 대략 `R9/W6` 수준을 예상하지만 **실측 전 확정 금지**.
- Firestore `user_structures` 불필요 write 의심은 이번 공개/비공개 영상에서는 W0였으나 다른 Music Note 동작까지 별도 확인 필요.

## 10. 다음 PREVIEW 실사용 검증
가장 먼저 이전과 **같은 공개/비공개 테스트를 083 Worker에서 반복**한다.

1. 진단 초기화.
2. 이미 등록된 1곡 공개/비공개 후 페이지 이탈.
3. 이미 등록된 3곡 공개 후 페이지 이탈.
4. 같은 3곡 비공개 후 페이지 이탈.
5. 각 단계의 D1 R/W, R2 A/B, Firestore R/W를 기록.
6. 최종 공개상태 정확성 확인.

합격 방향:
- 3곡에서 다시 R30~36 같은 owner-scan 수치가 나오면 FAIL.
- read가 실제 변경곡 수에 가까운 작은 값으로 내려와야 함.
- W는 현재 계약상 곡당 2를 기준으로 확인.
- 페이지 내부 중간 네트워크 전송 0 유지.
- Firestore 공개/비공개 동작 R0/W0 유지.

## 11. TEST / PRODUCTION 승격
- TEST 승격: **금지 / 083 실사용 비용 + correctness 재검증 전**.
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
083 분석/구현에 사용한 temporary workflows는 Worker 배포 완료 후 제거 완료.

영구 보존:
- Worker patch 050.
- 083 regression verifier.
- 082 verifier의 050 호환 guard.
- canonical PREVIEW Worker 050 source/hash.
- permanent PREVIEW Worker release gate의 083 verifier + live PK query-plan guard.

## 14. 알려진 위험 / 다음 작업
- query plan은 정상 PK lookup으로 확인됐지만 실제 authenticated mutation rows_read는 사용자 실측 전이다.
- W2/곡은 현재 공유 revision 계약이므로 별도 전체 동기화 설계 없이 제거하지 않는다.
- 사용자 재테스트가 합격하면 공개/비공개 비용 문제는 통과 후보로 처리하고, 이후 좋아요/상세편집/Library/PC↔모바일 검증으로 이동한다.
- 재테스트에서 read가 여전히 높으면 추측으로 다음 최적화를 하지 말고 응답별 D1 비용 경로를 다시 분리 측정한다.

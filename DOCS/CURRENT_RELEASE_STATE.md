# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **078**
- 현재 PREVIEW App/Firebase Hosting release commit: `28825b09250cc4ff583e7d8f690a489b444741ae`
- PREVIEW App Release Run: `34753256732` — **PASS**
- 현재 PREVIEW Worker product source: `dc414814cdc4f23ef26f86a6167001542c698c9e`
- PREVIEW Worker Release trigger commit: `e1da5083964e148a71b3f0d1473169775dfa093a`
- PREVIEW Worker Release Run: `34753211173` — **PASS**
- 현재 PREVIEW Worker active version: `3f215682-ae3f-4c16-893d-16c7d0006a13`
- 이전 PREVIEW Worker version: `729795f9-98f8-4938-b28d-2590f466e4f2`
- Shared D1 078 trigger hotfix Run: `34752669120` — **PASS**
- 078 runtime 배포 이후 cleanup 기준 preview HEAD: `bf1a789767c032454b58baee5a8e9cc4e80d80ac`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 078 작업 목표
사용자 PREVIEW 실측에서 확인된 아래 문제를 한 번에 정리하는 릴리스다.

- 앱 업데이트/재실행 후 Music Note 최초 진입에서 publication-state 확인이 D1 `R19`까지 증가하던 구조 제거.
- 공개 1곡에서 `R7/W25`가 발생하던 쓰기 증폭 원인 축소.
- 비공개 전환이 `HTTP 500`으로 실패하던 실제 Shared D1 trigger 충돌 해결.
- 좋아요 2곡 묶음에서 `/v1/me/likes/batch` 한 요청인데도 D1 `R14/W2`가 발생하던 즉시 canonical 재확인 제거.
- 같은 계정 PC/모바일에서 오래된 기기 상태가 최종 사용자의 좋아요 의도를 버리지 않도록 수렴 구조 보호.
- Explore/공개상태 재진입은 전체 데이터 대신 작은 revision/R2 신호를 우선 사용.
- UI/CSS/위치/간격/반응형은 변경하지 않음.

## 3. Music Note 공개상태 — Persistent Snapshot + Revision
파일:
- `src/services/explorePublicationService.ts`
- marker: `SORIDRAW_PUBLICATION_PERSISTENT_REVISION_078_20260913`

변경:
- 076의 “새 앱 세션마다 전체 publication bundle 서버 확인” 방식을 제거.
- 기기의 publication snapshot을 앱 재시작 후에도 유지.
- 정상 cache가 있으면 `/v1/me/music-note-publications-revision`의 작은 변경 신호만 확인.
- revision이 같으면 전체 publication snapshot을 다시 받지 않음.
- 이전 `/v1/me/publications?...` owner-wide paged fallback 경로 제거.
- 앱 버전 변경 자체를 이유로 정상 publication persistent cache를 삭제하지 않음.

첫 client fix Run `34752219469`:
- TypeScript PASS.
- Build PASS.
- 078 persistent-cache invariants PASS.
- 실제 client source commit: `347703486eec6acd4487a755f7b30869ca974c8b`.

## 4. Worker 045 — Publication Revision Metadata
파일:
- `cloudflare/explore-worker/patches/045-publication-revision-metadata.mjs`
- marker: `SORIDRAW_PUBLICATION_REVISION_METADATA_045_20260913`

구조:
- publication revision은 `PROFILE_MEDIA.head(musicNotePublicationR2Key(uid))`의 R2 metadata를 사용.
- revision 확인 경로에서 D1을 읽거나 전체 publication payload를 재생성하지 않음.
- 043 targeted R2 → 044 Local First → 045 revision metadata 순서로 canonical Worker에 고정.

Canonical Worker preparation Run `34753177371` — PASS.
- 기존 077 전체 비용/회귀 검증기 보존.
- 045만 마지막 release patch로 추가.
- `node --check` PASS.
- 좋아요 비용검사 PASS.
- derived cache regression PASS.
- deploy preflight PASS.
- canonical Worker source commit: `dc414814cdc4f23ef26f86a6167001542c698c9e`.
- canonical Worker SHA256: `f1080b24b9344423d199201969349647fb124345f4e24ed9a3120aa82d7ea5ac`.

## 5. 비공개 HTTP 500 — 실제 원인과 Shared D1 수정
실제 Shared D1 schema/trigger를 읽기 전용으로 가져와 로컬 SQLite에 재현했다.

기존 `explore032_derived_track_update`에서 비공개 UPDATE 시 정확히 재현된 오류:
- `UNIQUE constraint failed: explore_derived_profiles.uid`

원인:
- nested UPSERT trigger chain 안의 `INSERT OR IGNORE INTO explore_derived_profiles(uid)`가 outer conflict policy와 충돌할 수 있었음.

수정:
- migration: `cloudflare/explore-worker/migrations/20260913_02_publication_trigger_conflict_fix.sql`
- 사용자 row를 삭제/변환/백필하지 않고 **`explore032_derived_track_update` trigger 하나만 교체**.
- 기존 feed/profile change journal 및 `track_count` 의미 유지.
- 중복 가능 profile insert는 `NOT EXISTS` guard로 변경.
- old owner profile journal은 owner 변경 시에만 추가.
- sequence 증폭도 한 상태 변경당 한 monotonic seq 중심으로 정리.

로컬 실제-schema 재현 결과:
- 기존 trigger: UNIQUE 충돌 재현 PASS.
- 수정 trigger: public → private PASS.
- 수정 trigger: private → public PASS.
- 로컬 logical row changes: private `7`, public `7`.

주의:
- 위 `7`은 SQLite logical row-change fixture다.
- Cloudflare D1 실제 `rows_written`은 index write까지 포함될 수 있으므로 **실사용 계정 측정 전 W7이라고 단정하지 않는다**.

Shared D1 실제 적용:
- Run `34752669120` — PASS.
- 적용 전 live broken trigger shape 확인 PASS.
- exact trigger-only hotfix 적용 PASS.
- 적용 후 new trigger shape 확인 PASS.
- main/production code branch unchanged PASS.
- 사용자 canonical data delete/backfill/rewrite 없음.

## 6. 좋아요 비용 구조 — 044 보호
파일:
- `cloudflare/explore-worker/patches/044-local-first-cost-hotpath.mjs`
- marker: `SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913`

보호 내용:
- 좋아요 click/batch intake에서 `tracks / public_profiles / track_stats / likes`를 다시 읽는 즉시 canonical 확인 제거.
- UI는 즉시 Local First 반영.
- 여러 곡의 최종 의도를 사용자별 queue row로 묶음.
- stale device의 `baseLiked`가 현재 canonical과 다르더라도 최종 사용자 의도를 버리지 않음.
- 10분 aggregate가 queue에 포함된 변경 ID만 canonical과 비교해 idempotent 수렴.
- 실제 canonical count가 바뀐 곡만 Feed/Profile R2 targeted patch.
- idle 시 전체 Feed/Profile 재생성 없음.

검증:
- 100명 같은 곡 좋아요 fixture → count/derived update 1회 PASS.
- net-zero cohort → count/derived write 0 PASS.
- stale-device convergence PASS.
- cold personal-like R2 recovery PASS.

실제 사용자 인증 click 후 Cloudflare D1 `rows_read/rows_written`은 PREVIEW 실사용 검증에서 최종 측정한다.

## 7. PREVIEW Worker 078 실제 배포
Run `34753211173` — PASS.

배포 결과:
- locked product SHA: `dc414814cdc4f23ef26f86a6167001542c698c9e`.
- previous Worker: `729795f9-98f8-4938-b28d-2590f466e4f2`.
- active Worker: `3f215682-ae3f-4c16-893d-16c7d0006a13`.
- Feed smoke PASS.
- public profile smoke PASS.
- unauthenticated like batch route HTTP `401` — 정상 보호 응답, 404/5xx 아님.
- warm Feed revision 실제 측정: **D1 R0/W0** PASS.
- revision mode: `HEAD-ONLY-036` PASS.
- like aggregate cron: `*/10 * * * *` PASS.
- TEST Worker unchanged PASS.
- PRODUCTION Worker unchanged PASS.
- smoke 실패 시 자동 rollback guard 유지.

## 8. PREVIEW App 078 실제 배포
App version:
- `public/app-version.json`: `075` → **`078`**.

Run `34753256732` — PASS.
- locked PREVIEW SHA: `28825b09250cc4ff583e7d8f690a489b444741ae`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting deploy PASS.
- actual `preview.soridraw.com` index build hash = local build PASS.
- actual remote `app-version.json` = **078** PASS.
- TEST branch/page unchanged PASS.
- PRODUCTION branch/page unchanged PASS.

이번 릴리스는 앱 version을 실제로 078로 올렸으므로 기존 075를 사용 중인 브라우저에서는 정상 update notice 조건을 충족한다.

## 9. Firebase / Cloudflare / 사용자 데이터 변경 범위
Firebase:
- PREVIEW Hosting: 변경됨 / 078 배포 완료.
- Functions: 변경 없음.
- Firestore Rules: 변경 없음.

Cloudflare:
- PREVIEW Worker: 045 포함 078로 변경됨.
- Shared D1: `explore032_derived_track_update` trigger 하나만 하위호환 교체.
- TEST Worker: 변경 없음.
- PRODUCTION Worker: 변경 없음.

사용자 데이터:
- canonical 사용자 row migration 없음.
- 대량삭제 없음.
- 백필 없음.
- 사용자 데이터 덮어쓰기 없음.
- 데이터 의미 변경 없음.

## 10. 비용 판정 — 자동검증으로 확정된 범위
확정:
- warm Feed revision: 실제 배포 Worker **D1 R0/W0**.
- publication revision: Worker 045 구조상 R2 HEAD-only / D1-free.
- 좋아요 intake: generated Worker 검증상 canonical D1 재확인 없음.
- 좋아요 aggregate: 변경된 queue ID만 canonical 비교.
- public/private trigger UNIQUE 충돌 원인 제거 및 로컬 실제-schema 재현 PASS.
- 앱 재실행 후 publication persistent snapshot을 버리지 않음.

아직 사용자 실사용으로 측정해야 하는 것:
- App 078 적용 후 Music Note 첫 진입의 실제 D1 rows_read.
- 같은 기기 재진입 실제 D1 rows_read.
- 한 곡 public 실제 R/W.
- 같은 곡 private 실제 R/W 및 HTTP 500 재발 여부.
- 다시 public 실제 R/W.
- 좋아요 2~3곡 묶음 실제 D1 R/W.
- PC ↔ 모바일 같은 계정 최종 state convergence.

## 11. 기존 정상 기능 — 절대 보호
- 즉시 Local First 좋아요 하트/숫자 UX.
- PREVIEW 좋아요 1분 묶음 전송.
- canonical 공개 숫자 10분 aggregate.
- 같은 계정 PC↔모바일 최종 수렴.
- 계정별 event/cache 분리.
- 정상 cache + 변경 없음 서버 read 0 목표.
- Music Note / Library 기존 local-first 및 묶음저장.
- UI/CSS/반응형/분할 구조 비변경.
- 공유 사용자 원본 데이터 비파괴.

## 12. 임시 작업파일 정리
078 진단/조립용 temporary Workflow는 배포 완료 후 제거했다.

제거 완료:
- `temp-078-apply-client.yml`
- `temp-078-d1-trigger-readonly-diagnosis.yml`
- `temp-078-shared-d1-trigger-hotfix.yml`
- `temp-078-worker-marker-check.yml`
- `temp-078-prepare-worker045.yml`
- `temp-078-worker-observability.yml`

영구 보존:
- `patches/045-publication-revision-metadata.mjs`
- `migrations/20260913_02_publication_trigger_conflict_fix.sql`
- 078 client cache source
- canonical PREVIEW Worker 045 source/hash
- 비용/회귀 검증기

## 13. 현재 PREVIEW 실사용 검증 / TEST 승격 차단
**078 자동검증과 PREVIEW 배포는 완료. 하지만 아래 사용자의 실제 계정 검증 전 TEST 승격 금지.**

실사용 테스트 순서:
1. 기존 앱에서 078 update notice 확인 후 업데이트 적용.
2. 앱 재실행 → Music Note 첫 진입 진단값 확인.
3. Music Note에서 나갔다가 재진입 → 변경 없음 비용 확인.
4. 비공개 곡 한 곡 공개 → R/W 확인.
5. 같은 곡 비공개 → 오류 없이 성공하는지 + R/W 확인.
6. 같은 곡 다시 공개 → R/W 확인.
7. 좋아요 2~3곡을 1분 묶음으로 처리 → 기존 R14 intake 패턴이 사라졌는지 확인.
8. PC↔모바일 같은 계정에서 최종 하트/숫자 수렴 확인.

합격 기준:
- 비공개 `HTTP 500` 재발 없음.
- 정상 persistent cache 재진입에서 publication 전체 bundle 재조회 없음.
- app update만으로 사용자 전체 데이터 재읽기 없음.
- 좋아요 intake에서 기존 R14 canonical 재확인 패턴 없음.
- public/private 한 곡 변경 때문에 전체 사용자/Feed/Profile 재생성 없음.
- 비용이 예상보다 높으면 원인을 확인하기 전 TEST로 승격하지 않음.

## 14. 다음 작업
1. 사용자가 `preview.soridraw.com`에서 위 078 실사용 테스트를 수행한다.
2. 실제 진단 화면/영상의 D1 R/W를 기준으로 PASS/FAIL 판정한다.
3. FAIL이면 PREVIEW에서만 수정한다.
4. 전 항목 PASS 후에만 TEST 승격 가능 여부를 판단한다.
5. PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 변경하지 않는다.

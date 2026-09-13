# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **079**
- 079 Worker 제품 기준 commit: `e68088ea036245b5385b296c08a1f8fe9001e62f`
- 079 Worker release trigger commit: `bc759d7f332f85543830f8c5427f9715781ceefb`
- PREVIEW Worker Release Run: `34754775846` — **PASS**
- 현재 PREVIEW Worker active version: `737816a1-5cd2-4754-9c86-8904b2edd430`
- 이전 PREVIEW Worker: `3f215682-ae3f-4c16-893d-16c7d0006a13`
- App 079 source commit: `3df9c48f1a2dcf1f08a5867872e97bba8e04c9ac`
- App 079 release trigger commit: `458bd00fb70f032349e9459235a280290ac53276`
- PREVIEW App Release Run: `34754832740` — **PASS**
- Shared D1 079 trigger compaction Run: `34754740138` — **PASS**
- 079 postdeploy first-publication local simulation Run: `34755012756` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 079 작업 목표
사용자 PREVIEW 078 실측에서 확인된 공개/비공개 쓰기 폭증을 줄이는 비용 hotfix.

실측 문제:
- 기존 공개 등록: 약 `R7 / W25`.
- 기존 공개↔비공개 전환에서도 `W12` 수준의 쓰기 증폭 확인.
- 078에서 HTTP 500 충돌은 해결됐지만 한 곡 변경이 여러 D1 파생 행으로 연쇄 전파되는 구조가 남아 있었음.

079 목표:
- Music Note 한 곡의 공개/비공개는 해당 곡과 필요한 최소 파생 상태만 변경.
- Feed/Profile은 이미 검증된 targeted R2 patch를 우선 사용.
- Music Note visibility 전환 때문에 D1 change journal을 중복 기록하지 않음.
- 공개프로필 `track_count`는 정확히 유지.
- 기존 TEST/PRODUCTION 호환용 shared global revision은 그대로 유지.
- UI/CSS/위치/간격/반응형 변경 없음.

## 3. Worker 046 — 기존 곡 재공개 최소 UPDATE
파일:
- `cloudflare/explore-worker/patches/046-publication-write-compaction.mjs`
- marker: `SORIDRAW_PUBLICATION_WRITE_COMPACTION_046_20260913`

변경:
- 기존 private Music Note 곡을 다시 public으로 만들 때 곡 내용이 바뀌지 않았다면 전체 `INSERT ... ON CONFLICT DO UPDATE`를 사용하지 않음.
- 최소 canonical 변경만 수행:
  - `is_public`
  - `status`
  - `published_at`
  - `updated_at`
- 제목/가사/URL/검색텍스트/공유옵션 등 실제 payload가 바뀐 경우에는 기존 full upsert 유지.
- Feed/Profile publication R2 targeted patch 실패 시 canonical 공개/비공개 자체를 실패시키지 않고 해당 파생 R2만 복구 대상으로 표시.
- 043 targeted R2 → 044 Local First → 045 publication revision → 046 publication write compaction 순서로 canonical PREVIEW Worker에 고정.

Canonical Worker SHA256:
- `96a64158c474687eb2036cf1b8877d03f087c9ccc7f4b20bfbb9158d7992a99d`

## 4. Shared D1 079 — Music Note 파생 쓰기 압축
파일:
- `cloudflare/explore-worker/migrations/20260913_03_music_note_write_compaction.sql`

변경 대상 trigger:
- `explore032_derived_track_insert`
- `explore032_derived_track_update`
- `explore079_music_note_derived_track_insert`
- `explore079_music_note_derived_track_update`

원칙:
- `explore_derived_tracks`는 계속 최신 상태 유지.
- `explore_derived_profiles.track_count`는 공개/비공개에 맞춰 유지.
- Music Note의 공개/비공개에서는 중복된 `explore_derived_state` / `explore_derived_changes` journal 쓰기를 생략.
- non-Music-Note 데이터는 기존 derived journal 동작 유지.
- `soridraw_shared_rev_*_051` global revision trigger는 변경하지 않음.
- canonical 사용자 tracks/profile row를 삭제, 백필, 변환하지 않음.

Shared D1 실제 적용 Run `34754740138`:
- 사전 live 078 trigger shape 확인 PASS.
- 실패 시 exact 078 trigger 자동복구 guard 준비 PASS.
- trigger-only migration 적용 PASS.
- 적용 후 4개 trigger 구조 확인 PASS.
- 적용 자체 비용: **589 rows read / 4 rows written**.
- 위 수치는 1회 trigger 정의 교체 비용이며 사용자 공개 1회 비용이 아님.
- main/production branch unchanged PASS.

## 5. 비용 시뮬레이션 결과
실제 Shared D1 schema/trigger를 읽기 전용으로 복제한 로컬 SQLite 기준.

기존 078:
- existing Music Note public → private logical writes: **7**.

079:
- existing Music Note public → private logical writes: **4**.
- existing Music Note private → public logical writes: **4**.
- profile `track_count`: `1 → 0 → 1` PASS.
- Music Note visibility 전환 중 old derived journal seq 증가 없음 PASS.
- non-Music-Note journal compatibility PASS.

최초 공개 추가검증 Run `34755012756`:
- 이미 공개프로필이 있는 사용자의 첫 Music Note 곡 공개: logical writes **4**, track_count `1` PASS.
- 공개프로필 자체가 없는 완전 신규 사용자의 최초 프로필 생성 + 첫 곡 공개: logical writes **11**, track_count `1` PASS.
- 신규 사용자 11회는 계정당 최초 공개 시 프로필 초기화가 함께 발생하는 1회성 경로.
- 위 숫자는 SQLite logical row changes이며 Cloudflare D1 청구 `rows_written`과 동일하다고 단정하지 않음. 실제 D1은 index write까지 포함될 수 있으므로 실사용 계측 필요.
- postdeploy simulation은 원격 D1 사용자 row write **0**.

## 6. 079 사전/회귀 검증
Preparation Run `34754505681` — 최종 재실행 PASS.

- live Shared D1 schema local clone PASS.
- 078 → 079 logical write compaction PASS.
- Worker 046 `node --check` PASS.
- Explore like cost verifier PASS.
- derived cache regression PASS.
- deploy preflight PASS.
- TypeScript `npx tsc --noEmit` PASS.
- `npm run build` PASS.
- 기존 좋아요 Local First / 10분 aggregate 보호 PASS.
- 기존 078 persistent publication snapshot / R2 revision 구조 보호.

첫 attempt는 046 patch 조립기의 줄바꿈 anchor가 너무 엄격해 안전 중단됐고, 원격 D1 쓰기/배포 없이 조립기만 구조 기반으로 수정 후 재검증했다.

## 7. PREVIEW Worker 079 실제 배포
Run `34754775846` — PASS.

- locked product SHA: `e68088ea036245b5385b296c08a1f8fe9001e62f`.
- previous Worker: `3f215682-ae3f-4c16-893d-16c7d0006a13`.
- active Worker: `737816a1-5cd2-4754-9c86-8904b2edd430`.
- canonical source SHA PASS.
- live D1 prerequisite PASS.
- dry-run PASS.
- Feed smoke PASS.
- public profile smoke PASS.
- unauthenticated like batch route HTTP `401` 정상.
- warm Feed revision 실제 측정: **D1 R0/W0** PASS.
- like aggregate cron `*/10 * * * *` PASS.
- TEST Worker unchanged PASS.
- PRODUCTION Worker unchanged PASS.

## 8. PREVIEW App 079 실제 배포
App version:
- `public/app-version.json`: `078` → **`079`**.

Run `34754832740` — PASS.
- locked release SHA: `458bd00fb70f032349e9459235a280290ac53276`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- actual `preview.soridraw.com` exact build PASS.
- actual remote `app-version.json` = **079** PASS.
- TEST page/branch unchanged PASS.
- PRODUCTION page/branch unchanged PASS.

079 앱은 기능 UI 변경이 아니라 테스트 버전 식별을 위해 버전만 상승. 기존 078 앱은 상단 update notice 조건을 충족한다.

## 9. TEST / PRODUCTION 공유 D1 호환성
Shared D1은 세 환경이 공유하므로 코드 비변경만으로 안전 판정하지 않는다.

확인:
- `main` 051 계열은 `explore_derived_changes`를 사용하는 현재 PREVIEW 032 delta 구조가 아니라 `explore_shared_revision` 기반 shared canonical cache 구조를 사용.
- main 코드 검색에서 `explore_derived_changes` 사용 없음 확인.
- 079는 `soridraw_shared_rev_tracks_au_051` 등 global revision trigger를 제거/변경하지 않음.
- PRODUCTION Worker는 032 derived-change 도입 전 버전이며 Worker version도 비변경.
- 따라서 079 Music Note journal 압축이 구 TEST/PRODUCTION의 변경 감지 신호를 제거하지 않도록 하위호환 유지.

TEST/PRODUCTION 승격은 별개이며 사용자 실사용 검증 전 금지.

## 10. Firebase / Cloudflare / 사용자 데이터 변경 범위
Firebase:
- PREVIEW Hosting: 079 배포 완료.
- Functions: 변경 없음.
- Firestore Rules: 변경 없음.

Cloudflare:
- PREVIEW Worker: 046 포함 079로 변경.
- Shared D1: Music Note derived trigger 4개 정의만 하위호환 교체.
- TEST Worker: 코드/버전 변경 없음.
- PRODUCTION Worker: 코드/버전 변경 없음.

사용자 데이터:
- canonical 사용자 row migration 없음.
- 대량삭제 없음.
- 백필 없음.
- 사용자 데이터 덮어쓰기 없음.
- 기존 필드 제거/의미변경 없음.

## 11. 078에서 이어서 보호하는 정상 구조
- Music Note publication persistent snapshot + 작은 R2 revision 확인.
- 앱 재실행/업데이트 자체로 publication 전체 재읽기 금지.
- 변경 없는 Feed revision D1 R0/W0.
- 즉시 Local First 좋아요 하트/숫자 UX.
- PREVIEW 좋아요 1분 묶음 전송.
- canonical 공개 숫자 10분 aggregate.
- 같은 계정 PC↔모바일 최종 수렴.
- 정상 cache + 변경 없음 서버 read 0 목표.
- Music Note / Library 기존 Local First와 묶음저장.
- UI/CSS/반응형/분할 구조 비변경.
- 공유 사용자 원본 데이터 비파괴.

## 12. 임시 작업파일 정리
079용 temporary Workflow는 검증/배포 후 모두 제거 완료.

제거:
- `temp-079-publication-trigger-live-check.yml`
- `temp-079-prepare-publication-compaction.yml`
- `temp-079-shared-d1-write-compaction.yml`
- `temp-079-postdeploy-first-publish-cost.yml`

영구 보존:
- `patches/046-publication-write-compaction.mjs`
- `migrations/20260913_03_music_note_write_compaction.sql`
- canonical PREVIEW Worker 046 source/hash
- 기존 043/044/045 및 078 client cache source
- 비용/회귀 검증기

## 13. 현재 비용 판정 / 실사용 검증
자동검증 판정:
- **079 코드/Shared D1/Worker/App PREVIEW 배포 완료.**
- 기존 logical visibility writes `7 → 4` 확인.
- 기존 프로필 사용자 첫 곡 공개 logical writes `4` 확인.
- HTTP 500 충돌 수정 유지.
- warm Feed revision D1 R0/W0 유지.

아직 실제 사용자 계정으로 확인해야 하는 것:
1. 079 update notice 적용 후 Music Note 진입.
2. 비공개 곡 1개 공개 → 실제 Cloudflare `rows_read / rows_written` 측정.
3. 같은 곡 비공개 → 실제 R/W + HTTP 오류 없음 확인.
4. 다시 공개 → 실제 R/W 확인.
5. 새 곡 최초 공개 등록 → 실제 R/W 확인.
6. 좋아요 2~3곡 1분 묶음 → 실제 intake R/W 확인.
7. PC↔모바일 same-account 최종 상태 수렴 확인.

**실제 D1 청구 rows_written은 실사용 계정 계측 전 W4라고 단정하지 않는다.**

## 14. TEST / PRODUCTION 승격 상태
- TEST 승격: **금지 / PREVIEW 079 실사용 비용 검증 전**.
- PRODUCTION 승격: **금지 / 사용자의 명확한 정식배포 승인 전**.

다음 작업은 새 기능 추가가 아니라 PREVIEW 079 실제 사용 비용 확인이다. 실제 수치가 여전히 과하면 PREVIEW에서만 추가 최적화한다.

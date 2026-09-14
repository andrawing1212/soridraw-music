# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **082**
- 082 제품 source commit: `9de67ec57eec1a9fa6c69d81a47c3924a7442398`
- PREVIEW Worker release trigger commit: `98120646ea73b8b0b3fc895f1593fcc7c43dc94b`
- PREVIEW App release commit: `a45f2a361be8648928302978c7177b9b75c0de48`
- PREVIEW Worker Run: `34794135736` — **PASS**
- PREVIEW Worker active version: `4b46d3f4-4c4b-4dd2-9584-1b9f0d74ffd5`
- PREVIEW App Run: `34794189198` — **PASS**
- 실제 `preview.soridraw.com` remote app version: **082** — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경

## 2. 082 작업 목표
081의 page-exit 묶음 구조를 한 단계 더 완성한다.

핵심 목표:
- Music Note에서 이미 등록된 여러 곡의 공개/비공개 변경을 한 번에 전송했을 때 Worker 내부에서도 곡별 반복 canonical D1 조회를 하지 않는다.
- 여러 등록곡 변경을 **공유 canonical 조회 + batch update**로 처리한다.
- 공개상태 R2 snapshot이 사라진 오래된/새 기기에서는 stale local cache를 정답으로 믿지 않고 canonical 기준으로 한 번 복구한다.
- 정상적인 warm R2/cache 사용자는 작은 revision 확인을 우선하고 불필요한 전체 조회를 하지 않는다.
- Shared D1 schema/migration, 사용자 원본 데이터, UI/CSS/레이아웃은 변경하지 않는다.

## 3. 082 확정 구조
### Publication internal batch 049
주요 파일:
- `cloudflare/explore-worker/patches/049-publication-internal-batch-compaction.mjs`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/release-patches.json`

동작:
- 081의 외부 page-exit publication batch API를 유지한다.
- 이미 등록된 여러 곡은 owner + track id 목록으로 canonical row를 한 번에 읽는다.
- 실제 바뀐 컬럼만 UPDATE 대상으로 만들고 D1 batch로 반영한다.
- 최초 등록 곡은 기존 검증된 단일 publication 등록 경로를 유지한다.
- canonical 조회 실패나 stats preflight 실패 시 조용히 잘못 저장하지 않고 해당 batch를 실패 처리한다.
- mutation hot path에서 owner 전체 scan을 하지 않는다.

### Publication R2 snapshot 복구 082
주요 파일:
- `src/services/explorePublicationService.ts`

동작:
- 공유 publication R2 snapshot이 없는데 기기에 오래된 local cache가 남아 있으면 local cache를 서버 검증 완료 상태로 간주하지 않는다.
- bundle route로 내려가 canonical D1 기준으로 한 번 복구하고 R2를 다시 만든다.
- 정상 R2/cache가 있는 사용자는 기존 revision-first 경로를 유지한다.

### Release safety
- 영구 PREVIEW Worker 배포 gate에 `scripts/verify-082-publication-batch.mjs`를 추가했다.
- 082 이후 Worker 배포에서도 publication batch/R2 복구 계약이 깨지면 배포 전 차단된다.

## 4. 082 자동검증
Preparation/verification Run `34792337510` attempt 2 — **PASS**.

확인:
- TypeScript PASS.
- Build PASS.
- Explore like cost regression PASS.
- Explore derived-cache regression PASS.
- 080 publication-state regression PASS.
- 082 publication-batch regression PASS.
- deploy preflight PASS.
- Shared D1 migration change **0**.
- verified product commit `9de67ec57eec1a9fa6c69d81a47c3924a7442398`.

082 verifier 핵심 결과:
- 여러 registered publication 변경이 canonical read를 공유하고 batch write를 사용함 — PASS.
- missing R2는 canonical self-heal 1회 경로로 전환 — PASS.
- healthy warm cache는 revision-first 유지 — PASS.
- mutation hot path owner scan 금지 — PASS.

## 5. PREVIEW Worker 049 실제 배포
Run `34794135736` — **PASS**.

- locked product source: `9de67ec57eec1a9fa6c69d81a47c3924a7442398`
- canonical Worker SHA256: `3c797e14d71fd32d455d42c8c4acfc7733eb3e78ab6255e0db975e2da5f60464`
- Worker version: `b6524b19-e66b-4eb6-b36d-9741195637eb` → `4b46d3f4-4c4b-4dd2-9584-1b9f0d74ffd5`
- permanent 082 verifier PASS.
- live D1 035 schema/state prerequisite PASS, pending=0.
- Feed smoke PASS.
- public profile smoke PASS.
- unauthenticated like batch route HTTP 401 정상.
- warm Feed revision 실제 **D1 R0/W0 / HEAD-ONLY-036** PASS.
- like aggregate cron `*/10 * * * *` PASS.
- TEST Worker unchanged PASS.
- PRODUCTION Worker unchanged PASS.

## 6. PREVIEW App 082 실제 배포
Run `34794189198` — **PASS**.

- release source checkout: `a45f2a361be8648928302978c7177b9b75c0de48`
- 제품 코드 기준: `9de67ec57eec1a9fa6c69d81a47c3924a7442398`
- TypeScript `npx tsc --noEmit` PASS.
- `npm run build` PASS.
- Firebase PREVIEW Hosting deploy PASS.
- actual `preview.soridraw.com` exact build PASS.
- actual remote `app-version.json` = **082** PASS.
- TEST page/branch unchanged PASS.
- PRODUCTION page/branch unchanged PASS.

Firebase 변경:
- PREVIEW Hosting only.
- Functions 변경 없음.
- Firestore Rules 변경 없음.

Cloudflare 변경:
- PREVIEW Explore Worker만 049 canonical로 갱신.
- TEST/PRODUCTION Worker 비변경.

## 7. 사용자 데이터 / 스키마 변경
082에서는 Shared D1 migration 없음.

사용자 데이터:
- 대량삭제 없음.
- 백필 없음.
- destructive migration 없음.
- 기존 필드 제거/의미변경 없음.
- 사용자 원본 데이터 강제 재생성 없음.
- PREVIEW/TEST/PRODUCTION 공유 사용자 데이터 복제/덮어쓰기 없음.

R2:
- 공개상태 snapshot은 파생 캐시다.
- missing/stale 상태에서만 canonical 기준 self-heal 가능.
- 사용자 원본 데이터 자체를 R2로 대체하지 않는다.

## 8. 비용 판정
확정된 것:
- 변경 없음 warm Feed revision 실제 D1 **R0/W0** PASS.
- 081 zero-dirty page transition backend flush 0 구조 유지.
- 여러 registered 공개/비공개 변경은 Worker 내부 canonical 조회 공유 + batch update 구조 PASS.
- R2가 정상일 때 publication state는 revision-first 경로 유지.
- R2가 없을 때만 canonical self-heal 1회 허용.

아직 실사용 계측이 필요한 것:
- 실제 로그인 계정에서 여러 곡 공개/비공개를 한 번에 변경했을 때 Cloudflare의 실제 D1 rows_read / rows_written 수치.
- Firestore `user_structures` 쪽 불필요 write 의심 여부.
- 새 기기/장기 미접속 최초 1회 복구 후 재접속 0-read 캐시 수렴 여부.

따라서 082 배포는 완료됐지만 **비용 실사용 검증 전** 상태다. 실제 수치가 예상보다 많으면 TEST로 넘기지 않는다.

## 9. PREVIEW 실사용 검증 항목
`preview.soridraw.com` 082에서 다음을 실제 계정으로 확인한다.

1. 진단 초기화 후 아무것도 수정하지 않고 Explore → Music Note → Library 이동.
   - 기대: PAGE SYNC NOOP, Worker 0, D1 R0/W0, Firestore R0/W0.
2. 이미 등록된 여러 곡을 공개/비공개로 여러 번 바꾼 뒤 페이지를 한 번 나감.
   - 기대: 페이지 안 중간 전송 0, page-exit 외부 publication batch 1회, Worker 내부 shared canonical read + batch write.
3. 공개→비공개→공개처럼 같은 곡을 반복 변경.
   - 기대: 마지막 상태만 저장.
4. R2 snapshot missing/오래된 기기 복구 상황.
   - 기대: stale local cache를 정답으로 사용하지 않고 canonical self-heal 1회 후 이후 warm cache 수렴.
5. Explore 좋아요 여러 번 변경 후 페이지 이동.
   - 기대: 기존 081 final-state page-exit batch 유지.
6. Music Note 상세 여러 필드 수정 후 page exit.
   - 기대: idle/detail-close write 0, 최종 변경분만 flush.
7. PC ↔ 모바일 same-account 공개상태/좋아요 최종 상태 수렴 확인.
8. Firestore usage에서 `user_structures` 불필요 write가 발생하는지 확인.

## 10. TEST / PRODUCTION 승격
- TEST 승격: **금지 / PREVIEW 082 실사용 correctness + 비용 검증 전**.
- PRODUCTION 승격: **사용자의 명확한 정식배포 승인 전 금지**.
- PREVIEW→TEST 승격 시 사용자 데이터 복제/덮어쓰기 금지.

## 11. 정상 기능 보호
절대 임의 변경 금지:
- UI 외곽선/위치/크기/간격/반응형/테마/색상.
- 분할바/생성바 기존 정상 동작.
- Music Note / Library Local First data semantics.
- 081 page-exit final-state batching.
- Explore Feed/public profile R2 cache 구조.
- 좋아요 10분 canonical aggregate.
- 공유 사용자 원본 데이터.

## 12. 임시 작업파일 정리
082 준비용 temporary workflow는 배포 완료 후 제거했다.

제거:
- `.github/workflows/temp-082-prepare-publication-batch.yml`

영구 보존:
- `cloudflare/explore-worker/patches/049-publication-internal-batch-compaction.mjs`
- `scripts/verify-082-publication-batch.mjs`
- `src/services/explorePublicationService.ts`의 missing-R2 repair guard
- canonical PREVIEW Worker 049 source/hash
- 영구 PREVIEW Worker release gate의 082 verifier

## 13. 알려진 위험
- 자동 verifier는 082의 구조를 검증하지만 실제 authenticated publication mutation의 Cloudflare rows_read/rows_written 숫자를 대신하지 않는다.
- missing R2 self-heal은 복구 상황 전용이다. 정상 사용자에게 반복 발생하면 캐시 생성/유지 경로를 다시 조사해야 한다.
- Firestore `user_structures` write는 082 작업 범위에서 변경하지 않았으며 실제 계측 확인이 남아 있다.

## 14. 다음 작업
새 기능 추가보다 **PREVIEW 082 실사용 비용 계측**이 우선이다.

실측 합격 후에만 TEST 승격 후보로 판단한다.
실측에서 공개/비공개 batch의 D1 사용량이 곡 수만큼 선형 증가하거나 `user_structures` write가 불필요하게 발생하면 원인을 확정하고 PREVIEW에서 추가 최적화한 뒤 다시 검증한다.

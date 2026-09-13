# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW 앱 버전: **081**
- 081 제품 source commit: `1b3f409bf2077a9cd8dfe3a2c2d3f5488d220b6a`
- App version 081 commit: `3a36924f5fd29f88c8c350abdb37f70994a53e43`
- PREVIEW Worker 048 Release Run: `34789153609` — **PASS**
- 현재 PREVIEW Worker active version: `b6524b19-e66b-4eb6-b36d-9741195637eb`
- 이전 PREVIEW Worker: `13af5814-77bf-4845-93a2-32f90844d5ae`
- PREVIEW App Release Run: `34789244994` — **PASS**
- 실제 `preview.soridraw.com` remote app version: **081** — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 배포 시점 비변경 확인
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 배포 시점 비변경 확인
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경

## 2. 081 작업 목표
사용자가 요청한 최종 비용 원칙을 실제 저장 흐름에 적용한다.

절대 합격선:
- 페이지에서 아무것도 변경하지 않고 다른 페이지로 이동하면 **서버 요청 자체 0**.
- 정상 캐시 + 변경 없음: **D1 R0/W0 + Firestore R0/W0** 목표.
- 페이지 안에서 여러 번 변경해도 중간 상태를 서버에 반복 저장하지 않는다.
- 같은 항목을 여러 번 바꾸면 마지막 상태만 남긴다.
- 앱 내부 페이지 이탈 시 실제 변경분만 하나의 논리적 `PAGE SYNC`로 flush한다.
- 브라우저/앱 창 종료에서는 서버 전송을 강제하지 않고 local outbox/draft를 보존한다.
- 재접속 시 pending이 있을 때만 변경분 복구를 시도한다.
- UI/CSS/레이아웃/반응형은 변경하지 않는다.

## 3. 081 확정 구조
### Global Page Sync coordinator
파일: `src/lib/pageSyncCoordinator.ts`
marker: `SORIDRAW_PAGE_EXIT_BATCH_SYNC_081`

동작:
- Likes / publication / Catalog / 페이지 전용 local dirty 개수를 먼저 확인.
- `pendingChanges <= 0`이면 `noop`으로 종료하며 backend flush 함수를 호출하지 않는다.
- 실제 변경이 있을 때만 dirty category를 flush한다.
- `pagehide`는 창 닫기 신호만 기록하고 네트워크 flush를 하지 않는다.
- startup recovery는 인증 완료 후 local pending이 존재하는 경우에만 실행한다.

### Explore 좋아요
- 기존 persistent like outbox 재사용.
- 페이지 안에서 자동 1분/타이머 서버 전송 제거.
- 여러 좋아요 변경을 로컬에 누적.
- 페이지 이탈 시 `/v1/me/likes/batch` 한 번의 batch flush.
- 같은 곡의 중간 토글은 최종 desired state로 수렴.
- 기존 10분 canonical aggregate 구조 유지.

### Music Note 공개/비공개/공개옵션
- persistent publication outbox 추가.
- 공개→비공개→공개처럼 같은 곡을 반복 변경해도 최종 상태만 보존.
- 즉시 UI/cache는 로컬에서 반영하고 서버는 page-exit 때 반영.
- Worker 048 route: `POST /v1/me/music-note-publications/batch`.
- 외부 요청 1회에 최대 50개 publication final state를 묶음 처리.
- 최초 등록되지 않은 곡이 최종 private면 net-zero로 서버 등록하지 않는다.
- 기존 080 visibility hotpath / R2 targeted patch / canonical safety 유지.

### Music Note 상세편집 / 카드 상태
- IndexedDB detail draft와 기존 local card dirty 구조 재사용.
- 60초 idle 서버저장 제거.
- detail modal close 서버저장 제거.
- browser `pagehide` 서버저장 제거.
- Music Note 페이지 이탈 시 기존 변경분을 page sync에서 flush.
- 창이 닫히면 local draft/dirty가 남고 다음 실행에서 복구 가능.

### Music Note / Library Catalog
- 새로운 저장엔진을 만들지 않음.
- 기존 검증된 delta catalog 엔진을 재사용.
- 자동 publish timer 제거.
- dirty revision이 있을 때만 page-exit flush.
- dirty 0이면 Catalog server request 0.
- cache 손상/불완전 snapshot 같은 복구 상황에서만 기존 bounded rebuild fallback 허용.

## 4. Worker 048
파일: `cloudflare/explore-worker/patches/048-page-exit-publication-batch.mjs`
marker: `SORIDRAW_PAGE_EXIT_PUBLICATION_BATCH_048_20260914`

기능:
- Music Note publication page-exit batch route 추가.
- 한 요청 내부 sourceId 중복을 마지막 상태로 합침.
- 기존 first-public / visibility handler를 재사용해 canonical 의미를 유지.
- 변경 없음은 net-zero/idempotent 처리.
- Feed edge invalidation은 batch 전체 이후 필요한 경우 한 번 처리.
- publication R2 revision metadata를 batch 응답에 포함.

Canonical PREVIEW Worker SHA256:
- `9aed31dc08b20802b4253a8d43ec32b4fcd17b053a2460c14f7ba634a47fb2d1`

PREVIEW Worker Run `34789153609`:
- locked source: `3a36924f5fd29f88c8c350abdb37f70994a53e43`
- Worker version: `13af5814-77bf-4845-93a2-32f90844d5ae` → `b6524b19-e66b-4eb6-b36d-9741195637eb`
- preflight PASS
- live like queue prerequisite PASS
- Feed smoke PASS
- public profile smoke PASS
- unauthenticated like batch route HTTP 401 정상
- warm Feed revision 실제 **D1 R0/W0 / HEAD-ONLY-036** PASS
- like aggregate cron `*/10 * * * *` PASS
- TEST Worker unchanged PASS
- PRODUCTION Worker unchanged PASS

## 5. 081 제품 검증
Preparation/verification Run `34789032320` — **PASS**.

확인:
- 081 client patch PASS
- Worker 048 canonical assembly PASS
- TypeScript `npx tsc --noEmit` PASS
- `npm run build` PASS
- Music Note detail existing regression PASS
- Music Note save-status regression PASS
- 081 page-exit cost contract PASS
- Explore like cost regression PASS
- Explore derived cache regression PASS
- 080 publication state engine regression PASS
- deploy preflight PASS
- verified product source commit `1b3f409bf2077a9cd8dfe3a2c2d3f5488d220b6a`

081 verifier가 보호하는 핵심:
- zero dirty page transition은 flush 전에 return.
- likes/publications/catalog 자동 network timer 없음.
- Music Note detail idle/detail-close/pagehide server flush 없음.
- Library/Music Note/Explore page-exit sync 연결 존재.
- startup durable pending recovery 존재.
- Worker 048 batch route 존재.

## 6. PREVIEW App 081 실제 배포
Run `34789244994` — **PASS**.

- release source checkout: `cc6e037b869e338e6a920249e943759d99dba975` (081 product + version + release metadata descendant)
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting deploy PASS
- actual `preview.soridraw.com` exact build PASS
- actual remote `app-version.json` = **081** PASS
- TEST page/branch unchanged PASS
- PRODUCTION page/branch unchanged PASS

Firebase 변경:
- PREVIEW Hosting only.
- Functions 변경 없음.
- Firestore Rules 변경 없음.

## 7. Shared D1 / 사용자 데이터 변경 범위
081에서는 Shared D1 migration 없음.

유지:
- 080 visibility-only hotpath trigger 구조.
- shared canonical user data.
- TEST/PRODUCTION 호환 revision 구조.

사용자 데이터:
- 대량삭제 없음.
- 백필 없음.
- destructive migration 없음.
- 기존 필드 제거/의미변경 없음.
- 사용자 원본 데이터 강제 재생성 없음.

## 8. 비용 판정
자동/정적 판정:
- **zero-dirty page transition은 backend flush를 호출하지 않는 구조 PASS**.
- warm Feed revision 실제 D1 R0/W0 PASS.
- 중간 좋아요/publication 자동 flush 제거 PASS.
- browser close 서버전송 제거 PASS.

중요:
- `PAGE SYNC 1회`는 사용자 행동 기준 하나의 논리적 sync다.
- Likes + publication + Firestore detail처럼 서로 다른 backend 종류가 동시에 dirty면 하나의 page sync 안에서 backend별 batch 요청이 각각 발생할 수 있다.
- 081은 “모든 서비스를 단 하나의 HTTP 요청”으로 합친 것이 아니라, **중간 반복 호출을 없애고 각 dirty category를 페이지 이탈 시 한 번씩만 처리**하는 구조다.
- 실제 authenticated UI에서의 D1/Firestore R/W는 사용자 실사용 계측 전까지 확정하지 않는다.

## 9. 실사용 검증 필요 항목
`preview.soridraw.com` 081에서 다음을 실제 확인한다.

1. 진단 초기화 후 아무것도 수정하지 않고 Explore → Music Note → Library 이동.
   - 기대: PAGE SYNC `NOOP`, Worker 0, D1 R0/W0, Firestore R0/W0.
2. Music Note 같은 곡을 공개→비공개→공개 등 여러 번 변경 후 페이지를 한 번 나감.
   - 기대: 중간 서버 요청 없음, 마지막 상태만 publication batch에 포함.
3. Explore에서 좋아요 여러 번 변경 후 다른 페이지 이동.
   - 기대: 페이지 안에서는 서버 batch 없음, 이탈 때 likes batch 1회.
4. Music Note 상세 여러 필드 편집 후 페이지 이탈.
   - 기대: 중간 60초/닫기 write 없음, page exit 때 최종 변경분만 저장.
5. Library/Music Note 변경 없이 페이지 재진입.
   - 기대: 정상 cache면 반복 server read/write 0 목표.
6. pending 변경 후 브라우저를 바로 종료하고 재접속.
   - 기대: 종료 시 서버전송 강제 없음, local pending 유지, 재접속 후 변경분만 복구.
7. PC ↔ 모바일 same-account 최종 상태 수렴 확인.

## 10. TEST / PRODUCTION 승격
- TEST 승격: **금지 / PREVIEW 081 실사용 correctness + 비용 검증 전**.
- PRODUCTION 승격: **사용자의 명확한 정식배포 승인 전 금지**.
- PREVIEW→TEST 승격 시 사용자 데이터 복제/덮어쓰기 금지.

## 11. 정상 기능 보호
절대 임의 변경 금지:
- UI 외곽선/위치/크기/간격/반응형/테마/색상.
- 분할바/생성바 기존 정상 동작.
- Music Note / Library Local First data semantics.
- Explore Feed/public profile R2 cache 구조.
- 좋아요 10분 canonical aggregate.
- 공유 사용자 원본 데이터.

## 12. 임시 작업파일 정리
081 구현 중 사용한 temporary workflow/script는 배포 후 제거 완료.

제거:
- `.github/workflows/temp-081-prepare-page-exit-batch.yml`
- `.github/workflows/temp-081-run-extracted-page-exit-batch.yml`
- `.deploy/normalize-081-page-exit-patch.py`

영구 보존:
- `src/lib/pageSyncCoordinator.ts`
- `cloudflare/explore-worker/patches/048-page-exit-publication-batch.mjs`
- `scripts/verify-081-page-exit-batch.mjs`
- 081 client/page integrations
- canonical PREVIEW Worker 048 source/hash

## 13. 다음 작업
새 기능 구현 전에 **PREVIEW 081 실사용 비용 계측**을 우선한다.

실측이 합격하면 TEST 승격 후보로 판단한다.
실측에서 zero-dirty 이동에 서버 사용이 발생하거나 page-exit batch가 중복 호출되면 원인을 확인하지 않은 상태에서 다음 승격으로 넘어가지 않는다.

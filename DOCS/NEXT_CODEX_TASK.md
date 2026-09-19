# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — W2 publication Phase B PASS / Phase C PREVIEW 준비

## 현재 고정 기준

- PREVIEW code merge: `a7c048b0fa68907f459500fe1b547bb4126e8813`
- app version: **124**
- Phase A validation Run: `35410052082` SUCCESS
- Phase B diagnostics Run: `35427048164` SUCCESS
- PREVIEW/TEST/PRODUCTION 실제 배포 상태는 이번 작업으로 변경되지 않음.
- shared canonical D1/user data 변경 없음.

## 확정 비용 결과

PREVIEW RATE_DB production-shape candidate:
- first public: **R0/W2**
- private: **R1/W1**
- republish: **R1/W1**
- noop: **R1/W0**
- legacy control: R2/W15
- FTS insert: W1
- FTS delete: W1

Hard gate 결과:
- first/private/republish W1~W2 PASS.
- noop W0 PASS.
- D1 FTS publication hot-path write는 W3를 만들기 때문에 금지 유지.

## Phase C — PREVIEW 실제 검증 준비

목표:
새 R2 read/search/deep-page/first-publisher 코드를 PREVIEW에서 안전하게 검증할 준비를 한다.

### 1. 배포 전 고정 검증
- 현재 preview HEAD 고정.
- patch 066 생성 Worker syntax 확인.
- Phase A verifier 재실행.
- Phase B R2 integration verifier 재실행.
- trackId stability 재실행.
- 112/113/115/116/063 + derived-cache regressions.
- TypeScript.
- Build.
- UI/CSS 비변경.
- Firebase/Functions/Rules 비변경.
- shared D1 schema/data 비변경 확인.

### 2. 기능 플래그 원칙
현재 기본값은 모두 OFF:
- `SORIDRAW_R2_CATALOG_V1`
- `SORIDRAW_R2_CATALOG_READ_V1`
- `SORIDRAW_R2_FIRST_PUBLISHER_V1`

불완전 catalog 노출 방지를 위해 순서 고정:
1. 코드 먼저 배포.
2. write 준비를 별도 검증.
3. catalog completeness 검증 전 read flag ON 금지.
4. first-publisher flag도 별도 실제 검증 전 ON 금지.

### 3. 실제 PREVIEW 배포 규칙
사용자의 명확한 **프리뷰배포 요청이 있을 때만**:
- 검증된 preview HEAD 고정.
- 필요한 Worker만 배포.
- Firebase Hosting 변경이 없으면 불필요 재배포 금지.
- shared canonical D1 migration/index/trigger 변경 금지.
- 실제 `preview.soridraw.com` / PREVIEW Worker smoke 확인.
- TEST/PRODUCTION 비변경 확인.

### 4. PREVIEW 실제 기능 검증 항목
- Explore 첫 페이지 기존 shared R2 동작 보존.
- Explore 2페이지 이후 순서/중복/누락.
- public profile 2페이지 이후 + pinned order.
- 제목 검색.
- 장르 검색.
- artist nickname/handle 검색.
- 좋아요/해제 후 popular marker targeted 이동.
- 공개/비공개/재공개 marker targeted 처리.
- 신규 first publisher retry/idempotency.
- warm Explore / public profile D1 R0/W0 목표.
- PC/모바일 결과 일관성.

## 이번 단계에서 하지 말 것

- shared canonical D1 index DROP/CREATE.
- shared trigger DROP/CREATE.
- migration / backfill / 사용자 row rewrite.
- PROFILE_MEDIA 전체 catalog backfill.
- read flag 임의 ON.
- first-publisher flag 임의 ON.
- 배포 요청 없는 Worker/Firebase 배포.
- TEST/main 승격.
- PRODUCTION 변경.

## Phase D 예정

Phase C PREVIEW 실제 검증 완료 뒤에도 shared D1 cutover는 자동 진행하지 않는다.

Phase D는 사용자 별도 승인 후:
- Music Note만 9 explicit secondary indexes 대상에서 제외하는 실제 partial-index cutover.
- Music Note derived/profile-count/shared-revision trigger exclusion.
- exact live rows_written 재검증.
- W3+면 즉시 중단/rollback.
- user row delete/backfill/rewrite 금지.

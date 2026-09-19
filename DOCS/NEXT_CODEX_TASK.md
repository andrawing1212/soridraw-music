# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — W2 publication Phase A PASS / Phase B diagnostics

## 기준

- 제품 PREVIEW baseline: `434696ac8fbb551c31e3af985273ded6a635e68a`
- Phase A work branch: `work/publication-w2-r2-catalog-phase-a`
- Phase A final commit: `1198c314000909a0fb5f954b7c3a9edcb8c6f13d`
- Phase A validation: Run `35410052082` SUCCESS
- 설계: `DOCS/PUBLICATION_W2_R2_CATALOG_DESIGN.md`
- app version: **124**
- Phase A code는 아직 PREVIEW 제품 branch에 merge/deploy하지 않음.

## 절대 합격선

- 사용자 mutation D1 `rows_written`은 **W1~W2만 PASS**.
- first public / private / republish 모두 동일.
- no-change W0.
- W3+는 기능이 정상이어도 FAIL.
- 검색 때문에 publication D1 write 추가 금지.
- shared user row delete/backfill/rewrite 금지.
- UI/CSS 변경 금지.
- PREVIEW Worker/Firebase deploy 금지.
- TEST/main promotion 금지.
- PRODUCTION 변경 금지.

## 이번 작업 — Phase B diagnostics only

### 1. RATE_DB production-shape cost meter

PREVIEW의 **진단 전용 RATE_DB**만 사용한다. shared canonical `soridraw-explore-db`에는 write하지 않는다.

검증:
- Music Note가 9 explicit secondary indexes에서 제외되는 partial-index candidate.
- Music Note에서 derived mirror/profile count/shared revision trigger가 제외되는 candidate.
- first public exact rows_written.
- private exact rows_written.
- republish exact rows_written.
- no-op exact rows_written.
- FTS write가 publication hot path에 없음을 재확인.
- non-Music-Note row는 기존 index/trigger 동작을 유지하는 형태인지 확인.
- 진단 table/trigger는 workflow 종료 시 cleanup.

Hard gate:
- first public W1~W2.
- private W1~W2.
- republish W1~W2.
- noop W0.
- 하나라도 W3+면 Phase B FAIL.

### 2. R2 catalog integration verifier

실제 shared PROFILE_MEDIA user data를 쓰지 않는 in-memory/mock R2로 검증한다.

필수:
- latest 2페이지 이상 순서/중복/누락 없음.
- popular 2페이지 이상 순서/중복/누락 없음.
- 동일 timestamp/rank에서 기존 D1과 같은 id DESC.
- public profile 2페이지 이상 + pinned ordering.
- title token/prefix search.
- genre search.
- artist nickname/handle -> uid -> tracks.
- likeCount 변경 시 popular marker만 이동.
- pin 변경 시 profile marker만 이동.
- private 시 해당 track marker 제거.
- republish 시 해당 marker만 복구.
- per-track meta marker set 일치.
- first-publisher bootstrap -> trackCount 1 -> shared finalize.
- retry/idempotent 복구에서 trackCount 중복 증가 없음.
- legacy API response shape 유지.

### 3. Music Note trackId stability verifier

partial unique-index cutover 전에 반드시 증명:
- client track id: `music_note_${uid}_${sourceId}`
- Worker source id: 동일한 `music_note_${uid}_${sourceId}`
- 동일 uid/sourceId 재시도에서 같은 id.
- 앱 버전/기기와 무관한 입력 기반 결정성.
- publication outbox/cache가 같은 trackId를 유지.
- 불안정한 random/time/device 값이 id 생성에 포함되지 않음.

### 4. 독립 감사

`DOCS/WORK_AUDIT_CHECKLIST.md` 기준:
- 기존 Music Note 60초 묶음 저장 비변경.
- UI/반응형 비변경.
- Explore first page 현재 shared R2 보호.
- 공개프로필 warm 재방문 D1 R0/W0 보호.
- mutation O(1), 전체 Feed/profile/search rebuild 없음.
- shared D1/user data write 0.
- TypeScript / Build / related tests PASS.
- PREVIEW/TEST/PRODUCTION 비변경.

## 이번 단계에서 하지 말 것

- live shared D1 index DROP/CREATE.
- live shared D1 trigger DROP/CREATE.
- migration / seed / backfill.
- 사용자 데이터 rewrite/delete.
- 실제 PROFILE_MEDIA catalog backfill.
- catalog read flag ON.
- first-publisher flag ON.
- PREVIEW Worker deploy.
- Firebase deploy.
- TEST/main promotion.
- PRODUCTION 변경.

## Phase B 완료 보고

반드시:
- 작업 branch / 기준 commit / 최종 commit.
- RATE_DB Run ID와 exact R/W.
- R2 integration verifier 결과.
- trackId stability 결과.
- TypeScript / Build / regression results.
- shared canonical D1 writes = 0 확인.
- 실제 배포 없음.
- Phase C로 넘어가도 되는지.
- 남은 위험.

## Phase C 예정

Phase B + 독립 감사 PASS 후에만 새 R2 read path를 이해하는 코드를 PREVIEW에서 검증한다.
TEST/PRODUCTION 승격은 별도 승인 규칙을 따른다.
shared D1 partial-index/trigger cutover는 Phase D이며 사용자 별도 승인 전 실행 금지.

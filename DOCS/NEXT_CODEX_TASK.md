# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — W2 publication 구조설계 확정 / Phase A code-only 구현

기준 설계:
- `DOCS/PUBLICATION_W2_R2_CATALOG_DESIGN.md`
- 설계 commit: `1baadfecf5c26930ee6740eeb85ca18b17549e06`

## 절대 합격선

- 사용자 mutation D1 `rows_written` **W1~W2만 PASS**.
- first public / private / republish 모두 동일.
- no-change W0.
- W3+는 기능이 정상이어도 FAIL.
- 검색을 위해 publication D1 write를 추가하지 않는다.
- shared user row delete/backfill/rewrite 금지.
- UI/CSS 변경 금지.
- PRODUCTION 변경/배포 금지.

## 실측 기준

- live first Music Note public: R6/W18 FAIL.
- W18 = tracks W11 + derived W5 + profile-count W1 + shared-revision W1.
- diagnostic partial-index Music Note insert: W2.
- private W1 / republish W1 / noop W0.
- D1 FTS insert/delete 각각 W1이므로 canonical W2 + FTS는 W3 → 금지.
- Explore UI search entry는 `/v1/search?q=...` 하나이므로 Worker 내부 source 교체 가능.
- PRODUCTION app117도 shared R2 patches 043~064 보유.

## 이번 구현 범위 — Phase A만

**shared D1 schema/index/trigger는 절대 변경하지 않는다. deploy도 하지 않는다.**

### 1. R2 ordered catalog code

기존 shared PROFILE_MEDIA R2 재사용.

구현 계약:
- per-track meta
- latest ordering marker
- popular ordering marker
- profile ordering marker
- genre marker
- bounded title-token marker
- artist nickname/handle marker
- 한 곡 변경 시 해당 marker만 PUT/DELETE
- 전체 Feed/profile/search rebuild 금지
- current marker key는 per-track meta에 저장

### 2. Deep pagination

- Explore first page current shared R2 snapshot 보호.
- Explore cursor/2페이지 이후는 새 R2 catalog path를 사용할 수 있게 wrapper 추가.
- public profile 2페이지 이후도 R2 profile catalog path 추가.
- 기존 API response shape 유지.
- legacy cursor fallback은 Phase D cutover 전까지 유지.
- D1 deep-page path를 바로 삭제하지 않는다.

### 3. Search 3종

`/v1/search?q=...` UI 계약 유지.

지원:
- 제목 token/prefix
- 장르
- 아티스트 nickname/handle → uid → 해당 공개곡

금지:
- publication 시 `track_search_fts` INSERT/DELETE
- title 일반 D1 secondary index 추가
- 무제한 trigram/token fanout

### 4. 신규 사용자 first publisher

first publish에서 D1 `public_profiles` auto INSERT를 하지 않는 code path를 준비.

대신:
- auth nickname/avatar 기반 최소 shared profile v113 bundle 생성
- UID direct shared profile key 생성
- handle이 있을 때만 alias 생성
- artist R2 index 생성
- trackCount 1 반영
- 기존 explicit profile edit가 나중에 D1 canonical profile을 materialize하면 shared R2를 그 결과로 교체

Phase A에서는 이 code path를 feature/cutover guard 뒤에 두고 shared production behavior를 바꾸지 않는다.

### 5. Like/profile mutation 연동

- final likeCount가 바뀐 track만 popular marker 이동.
- private/public/pin/genre/title 변경 시 old marker를 meta 기준 제거하고 new marker만 생성.
- 추가 D1 rank/search write 금지.

### 6. verifier

최소 검증:
- catalog key ordering deterministic
- latest/popular/profile pagination cursor deterministic
- publish/private/republish marker delta O(1)
- title token bound
- artist nickname/handle resolution
- first publisher R2 profile valid bundle
- no publication D1 FTS call
- legacy API response shape compatibility
- current first-page shared R2 flow regression 없음
- TypeScript PASS
- Build PASS
- 관련 verifier PASS

## 이번 단계에서 하지 말 것

- live shared D1 index DROP/CREATE
- live trigger DROP/CREATE
- migration / seed / backfill
- user data rewrite
- PREVIEW Worker deploy
- Firebase deploy
- TEST/main promotion
- PRODUCTION 변경
- 기존 D1 fallback 즉시 삭제

## Phase A 완료 보고

반드시:
- 작업 branch
- 기준 preview commit
- 최종 commit SHA
- 변경 파일
- catalog key contract
- TypeScript / Build / Test
- shared D1 변경 없음 확인
- deploy 없음 확인
- 남은 Phase B 위험

## Phase B 예정

Phase A PASS 후에만:
- RATE_DB/diagnostic schema에서 production-shape partial index + Music Note trigger exclusion 후보 측정
- exact first public/private/republish/noop row meter
- R2 search/deep paging integration test
- Work 독립 감사

shared D1 cutover는 Phase B/Work PASS 후 사용자 별도 승인 전 실행 금지.

## 현재 환경

- PREVIEW app124
- TEST app124 / TEST_VERIFIED
- PRODUCTION app117
- preview design HEAD는 설계 commit 이후 갱신될 수 있으므로 작업 시작 전 실제 HEAD 재확인

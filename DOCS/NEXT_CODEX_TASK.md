# NEXT CODEX TASK — Explore/Public Profile 초저비용 구조 수정

상태: 실행 대기
권장 추론: **High**
Extra High: 기본 불필요. 실제 schema migration, 데이터 손실 위험, 복잡한 동시성 변경이 필요하다고 판단되면 **구현하지 말고 중단/보고 후 Extra High 검토**.
작업 브랜치: **preview only**
배포: **하지 않음**

## 사용자 목표
SORIDRAW는 세계 최저 수준의 운영비를 목표로 한다.
앱 업데이트/페이지 진입/재방문 때문에 10만 사용자가 각각 원본 DB를 다시 읽는 구조는 허용하지 않는다.

핵심 원칙:
- 앱을 열었다고 서버 데이터를 읽지 않는다.
- 앱을 업데이트했다고 서버 데이터를 다시 읽지 않는다.
- 실제 데이터가 바뀌었을 때만 바뀐 항목만 처리한다.
- 실시간성을 위해 전체 재조회하는 것보다, 몇 초 늦더라도 여러 변경을 묶고 캐시를 쓰는 것을 선호한다.

## 시작 전 필수
1. `AGENTS.md`
2. `DOCS/CURRENT_RELEASE_STATE.md`
3. `DOCS/WORKFLOW_GUARDRAILS.md`
를 읽고 현재 `preview` HEAD를 고정한다.
과거 채팅을 기준으로 구조를 다시 추측하지 않는다.

## 문제 1 — `/feed-revision`이 전체 Feed를 다시 만든다
현재 `031-explore-shared-canonical-data.mjs`의 `ensureExploreSharedFeedCache031()` 때문에 공유 revision이 바뀌면 다음 `/feed-revision` 요청에서 `latest + popular`를 D1에서 다시 만들어 R2에 쓴다.

### 수정 목표
- `/feed-revision`은 **전체 Feed를 만들거나 전체 D1을 읽지 않는다.**
- revision 확인은 작은 값/캐시만 확인하고 끝나야 한다.
- 좋아요 1회가 latest Feed 재생성을 유발하지 않아야 한다.
- popular 순위 변화가 필요해도 총 곡 수에 비례하는 전체 scan을 하지 않는다.
- mutation 시 변경된 track/profile/ranking 정보만 갱신하거나, 이미 있는 작은 파생 목록을 부분 수정하는 방식으로 설계한다.
- 환경별 Cache는 유지하되 사용자 원본 데이터 공유 구조는 유지한다.

## 문제 2 — 앱 업데이트 후 공개프로필 최초 재생성
현재 `exploreProfileFirstViewService.ts`에서 캐시가 없으면 `__soridraw_shared_profile=51`로 서버 materialize를 유도한다.

### 수정 목표
- **앱 버전 변경과 공개프로필 데이터 캐시를 분리한다.**
- 정상 데이터 캐시가 있는 사용자는 앱 052→053 같은 업데이트 후에도 그대로 사용한다.
- 업데이트 때문에 사용자별 D1 전체 조회/프로필 전체 재생성 금지.
- 공개프로필 최초 보기의 서버 응답은 가능하면 이미 만들어진 R2/Edge snapshot에서 제공한다.
- snapshot이 없거나 손상된 진짜 예외 상황에서만 복구 경로가 원본 D1을 사용하도록 분리한다.
- 공개/비공개/좋아요/프로필 수정 시 해당 프로필 snapshot의 필요한 부분만 갱신한다. mutation마다 전체 공개프로필 scan 금지.

## 문제 3 — 변경 없는 재방문 비용
Explore와 공개프로필에서 로컬 캐시가 정상이고 서버 데이터가 바뀌지 않았다면 서버 data read 0을 목표로 한다.

### 허용
- 브라우저/Edge/R2의 아주 작은 상태 확인
- 필요 시 짧은 주기의 공용 캐시 확인

### 금지
- 사용자마다 D1 `SELECT` 반복
- 전체 Feed 재생성
- 전체 공개프로필 재생성
- 앱 업데이트를 이유로 cache schema를 올려 강제 cold load

## Music Note — 이번 작업에서 보호
- 현재 로컬 즉시 반영 + 약 60초 묶음 서버 저장을 변경하지 않는다.
- 이번 commit에서 Music Note/Library 데이터 구조를 확장 구현하지 않는다.
- 단, 향후 `변경 있음 신호 → 변경분만 동기화` 적용 가능성/필요 변경점이 보이면 구현하지 말고 결과 보고에 짧게 기록한다.

## 데이터 안전
- Canonical D1/R2 사용자 데이터 삭제 금지
- 대량 backfill/migration 금지
- PRODUCTION 변경 금지
- 기존 사용자 데이터 읽기 호환성 유지
- schema 변경이 꼭 필요하면 additive 방식만 검토하되, migration이 필요해지는 순간 구현 중단 후 보고

## UI 안전
UI/레이아웃/반응형/색상/간격은 변경하지 않는다.

## 비용 합격선
자동 테스트/진단으로 가능한 만큼 고정한다.

1. 앱 업데이트 후 기존 정상 캐시 → 원본 D1/Firestore data read **0 목표**
2. Explore 재진입 + 변경 없음 → D1 data read **0 목표**
3. 공개프로필 재진입 + 변경 없음 → D1 data read **0 목표**
4. 좋아요 1회 → 전체 Feed scan/rebuild **0**, 비용이 전체 곡 수에 비례하지 않음
5. 공개/비공개 1곡 → 전체 Feed/프로필 scan **0**
6. mutation 1회 D1 read는 O(1)이어야 하며 target은 single-digit~low-teens. 20행을 크게 넘으면 원인을 설명하고 최적화 전 완료 처리하지 않는다.
7. 기존 PREVIEW/TEST 데이터 일관성·UI 동작을 깨지 않는다.

## 구현 방식
- 먼저 현재 호출 흐름/실제 D1 query를 표로 정리한다.
- 불필요한 019/020/030/031 누적 패치가 현재 런타임에 중복/충돌하는 부분을 확인한다.
- 같은 기능의 구형 실행 경로가 031 이후 사실상 죽어 있다면 안전하게 정리한다.
- 단, 큰 파일을 통째로 재작성하지 말고 필요한 부분만 최소 수정한다.
- 새로운 임시 패치 파일을 계속 쌓는 방식보다 현재 source를 단순하게 만드는 것을 우선한다.

## 필수 검증
- TypeScript
- Build
- 관련 기존 Explore verifier
- 새 비용 회귀 verifier 추가
- Worker syntax/patch 적용 검증
- 기존 공유 Canonical 데이터 구조 유지 확인
- PREVIEW/TEST/PRODUCTION 환경 선택 코드 비의도 변경 없음 확인

## 종료 결과
배포하지 않는다.
아래를 제출한다.
- 기준 preview SHA
- 변경 파일
- 변경 내용
- 제거한 불필요 코드
- 비용 전/후 예상 또는 자동검증 수치
- TypeScript/Build/Test
- 데이터 구조 변경 여부
- 위험/미검증 항목
- 최종 commit SHA
- `DOCS/CURRENT_RELEASE_STATE.md` 갱신

한 흐름으로 `분석 → 구현 → 테스트 → commit`까지 끝낸다.

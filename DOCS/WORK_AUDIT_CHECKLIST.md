# WORK AUDIT CHECKLIST — Codex 구현 독립 검증

목적: Codex가 만든 PREVIEW commit이 SORIDRAW의 기능/비용/데이터 안전 기준을 실제로 만족하는지 독립 검증한다.

## Work 기본 모드
- **먼저 수정하지 않는다.**
- 대상 commit SHA를 고정하고 그 상태를 감사한다.
- 실패 원인을 찾았다고 바로 구조를 새로 만들지 않는다.
- 수정이 필요하면 'FAIL + 수정 권고'로 보고하고 Codex/ChatGPT 단계로 돌린다.

## 반드시 확인
1. `AGENTS.md`, `CURRENT_RELEASE_STATE.md`, `WORKFLOW_GUARDRAILS.md`를 읽음
2. 대상 commit이 `preview` 기반인지 확인
3. UI/반응형/기존 Music Note 60초 묶음 저장이 비의도 변경되지 않았는지 확인
4. 공유 Canonical Explore 사용자 데이터 구조가 유지되는지 확인
5. 앱 버전 업데이트가 데이터 캐시 강제 초기화/전체 DB 재조회를 일으키지 않는지 확인
6. `/feed-revision`이 전체 latest/popular Feed를 재생성하지 않는지 확인
7. 좋아요 1회가 전체 Feed scan을 일으키지 않는지 확인
8. 공개/비공개 1곡이 전체 공개프로필/Feed scan을 일으키지 않는지 확인
9. 공개프로필 재방문 + 변경 없음에서 원본 D1 read 0 목표가 지켜지는지 확인
10. Explore 재방문 + 변경 없음에서 원본 D1 read 0 목표가 지켜지는지 확인
11. TypeScript/Build/관련 Test 성공
12. 데이터 삭제/대량수정/migration 없음
13. PRODUCTION 변경/배포 없음

## RED TEAM 질문
- 사용자 수가 10만 명이어도 앱 업데이트 직후 10만 번 DB 읽기가 발생하지 않는가?
- 공개곡이 30개가 아니라 100만 개가 되어도 좋아요 1회의 DB 비용이 함께 커지지 않는가?
- 캐시가 손상된 예외 복구 경로와 평상시 경로가 분리되어 있는가?
- 푸시/실시간 신호가 유실되어도 다음 정상 사용에서 전체 재조회 없이 복구 가능한가?
- 같은 계정의 PC/모바일에서 데이터가 결국 같은 상태로 수렴하는가?
- PREVIEW 기능 코드가 공유 사용자 데이터를 이전 TEST/PRODUCTION 코드가 못 읽는 형태로 바꾸지 않는가?

## 결과 형식
- PASS / FAIL
- 대상 commit SHA
- 기능 회귀
- 비용 회귀
- 데이터 호환성
- TypeScript / Build / Test
- 실제 API/진단 결과
- PRODUCTION 비변경 확인
- TEST 승격 가능 / 불가

FAIL이면 TEST 승격 금지.

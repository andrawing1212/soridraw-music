# WORK AUDIT CHECKLIST — Codex 구현 독립 검증

목적: Codex가 만든 PREVIEW commit이 SORIDRAW의 기능/비용/데이터 안전 기준을 실제로 만족하는지 독립 검증한다.

## Work 기본 모드
- **먼저 수정하지 않는다.**
- 대상 commit SHA를 고정하고 그 상태를 감사한다.
- 실패 원인을 찾았다고 바로 구조를 새로 만들지 않는다.
- 수정이 필요하면 `FAIL + 수정 권고`로 보고하고 Codex/ChatGPT 단계로 돌린다.
- 과거 대화 전체를 재구성하지 않고 GitHub 현재 문서와 대상 commit을 기준으로 감사한다.

## 시작 전 확인 순서
1. `AGENTS.md`
2. `DOCS/CURRENT_RELEASE_STATE.md`
3. `DOCS/NEXT_CODEX_TASK.md`
4. `DOCS/WORK_AUDIT_CHECKLIST.md`
5. `DOCS/WORKFLOW_GUARDRAILS.md`
6. 필요 시 `DOCS/CODEX_USAGE_BUDGET.md`
7. 대상 commit과 실제 `preview` 관계 확인

## 반드시 확인
1. 대상 commit이 지정된 `preview` 기준 commit에서 이어졌는지 확인
2. UI/반응형/기존 Music Note 60초 묶음 저장이 비의도 변경되지 않았는지 확인
3. 공유 Canonical Explore 사용자 데이터 구조가 유지되는지 확인
4. 앱 버전 업데이트가 데이터 캐시 강제 초기화/전체 DB 재조회를 일으키지 않는지 확인
5. `/feed-revision`이 전체 latest/popular Feed를 재생성하지 않는지 확인
6. 좋아요 1회가 전체 Feed scan을 일으키지 않는지 확인
7. 공개/비공개 1곡이 전체 공개프로필/Feed scan을 일으키지 않는지 확인
8. 공개프로필 재방문 + 변경 없음에서 원본 D1 read 0 목표가 지켜지는지 확인
9. Explore 재방문 + 변경 없음에서 원본 D1 read 0 목표가 지켜지는지 확인
10. 비용이 전체 공개곡 수/사용자 수에 비례하지 않는지 확인
11. TypeScript/Build/관련 Test 성공
12. 데이터 삭제/대량수정/migration 없음
13. PRODUCTION 변경/배포 없음
14. FCM/WebSocket/새 외부 서비스 등 이번 범위 밖 인프라가 임의 추가되지 않았는지 확인
15. 불필요한 임시 패치/진단 파일이 새로 누적되지 않았는지 확인

## RED TEAM 질문
- 사용자 수가 10만 명이어도 앱 업데이트 직후 10만 번 DB 읽기가 발생하지 않는가?
- 공개곡이 30개가 아니라 100만 개가 되어도 좋아요 1회의 DB 비용이 함께 커지지 않는가?
- 캐시가 손상된 예외 복구 경로와 평상시 경로가 분리되어 있는가?
- 같은 계정의 PC/모바일에서 데이터가 결국 같은 상태로 수렴하는가?
- PREVIEW 기능 코드가 공유 사용자 데이터를 이전 TEST/PRODUCTION 코드가 못 읽는 형태로 바꾸지 않는가?
- 변경 없음 상태에서 단지 클릭/재진입/앱 업데이트 때문에 원본 DB를 다시 읽는 숨은 경로가 남아 있지 않은가?
- 이번 작업 범위를 넘어 실시간 인프라를 새로 넣지 않고도 현재 비용 버그를 제거했는가?

## 비용 검증 기준
- 업데이트 후 정상 캐시: 원본 D1/Firestore data read 0 목표
- Explore 재진입 + 변경 없음: D1 data read 0 목표
- 공개프로필 재진입 + 변경 없음: D1 data read 0 목표
- 좋아요 1회: 전체 Feed scan/rebuild 0
- 공개/비공개 1곡: 전체 Feed/프로필 scan 0
- mutation 비용이 O(1)인지 확인. 20행을 크게 넘는 read가 반복되면 원인을 밝히기 전 PASS 금지

## Work 사용량 절약
- 저장소/WORK_LOG 전체를 반복 분석하지 않는다.
- Codex diff와 관련 호출 경로를 우선 확인하고 필요한 파일만 확장한다.
- 기존 테스트 결과를 맹신하지는 않되 같은 테스트를 의미 없이 반복하지 않는다.
- 정적 검토 → 관련 verifier → 최종 TypeScript/Build 순으로 진행한다.
- 실패가 명확해지면 추가 구조 실험을 하지 말고 FAIL 근거를 남긴다.

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
- 남은 미검증 항목

FAIL이면 TEST 승격 금지.

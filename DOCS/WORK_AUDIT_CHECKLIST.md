# WORK AUDIT CHECKLIST — Codex 구현 독립 검증

목적: **독립 감사가 필요한 고위험 수정에서만** 변경 경로와 그 소비자의 데이터 안전·복구·비용을 집중 검증한다. 일반적인 UI·저위험 국소 변경은 이 문서의 전체 항목 또는 별도 독립 감사를 필수로 요구하지 않는다.

## 적용 범위 — 전체 항목 자동 반복 금지 (2026-10-31)

- 단순 UI·문구·저위험 기능 수정: 바뀐 화면/함수와 직접 연관된 회귀 검사만 수행. 독립 감사/모든 환경 계약/전체 체크리스트 강제 금지.
- 사용자 원본·공유 Writer·권한·DB migration·구형 캐시 호환성 등 복구가 어려운 변경: 영향을 받은 체크 항목을 선정하고 독립 감사. 범위 밖 항목은 '해당 없음' 처리한다.
- 이전 고정 SHA에서 통과했고 관련 코드와 의존 경로가 동일하면 PASS를 재사용한다. 감사를 의뢰할 때 실패를 재현한 한 경로와 해당 결과만 요청할 수 있다.
- CI 성공은 배포 성공이 아니다. 인증된 PREVIEW 실제 결과와 PC/모바일 확인 여부를 별도 보고한다.
- 데이터 삭제·파괴 변경·권한 우회·무단 TEST/PRODUCTION 승격에 대한 보호는 어떤 경우에도 생략하지 않는다.

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
16. **PRODUCTION-first 검증:** 이번 기능이 PRODUCTION에서 만날 실제 binding/vars/R2/Edge/origin cache/PWA cache 차이가 PREVIEW 단계부터 식별됐는지 확인
17. TEST에서 PRODUCTION live 환경 계약을 read-only로 사전검사하고, 허용되지 않은 차이가 0인지 확인
18. TEST_VERIFIED artifact와 PRODUCTION에 승격될 artifact의 source/build/bundle identity가 exact-match인지 확인. PRODUCTION 재빌드/재조립이면 FAIL
19. 현재 PRODUCTION 브라우저 캐시를 보존한 업그레이드 경로와 빈 캐시 경로 둘 다 결과 parity를 검증했는지 확인
20. 실제 앱 결과 기준으로 Feed/추천/공개프로필 공개곡·핀/좋아요 곡 membership/공개상태/좋아요 상태가 이전 단계와 같은지 확인
21. "서버 API parity PASS"만으로 브라우저 표시 parity PASS라고 판정하지 않았는지 확인
22. 사용자가 정식배포 후 수동으로 발견해야만 알 수 있는 핵심 검증 항목이 남아 있으면 FAIL
23. TEST PASS 후 PRODUCTION에서 새 기능 오류가 발생했던 릴리스라면 제품 수정 완료가 아니라 Release System 회귀로 기록했는지 확인
24. **핵심 상태형 UI parity:** 최근 생성곡 / Music Note / Library 등 동일 사용자 곡의 저장·좋아요·잠금·공개/비공개 버튼 활성 상태와 membership이 PREVIEW → TEST → PRODUCTION 및 기존 PRODUCTION 캐시 업그레이드 뒤에도 동일한지 확인
25. 위 상태형 UI는 서버/API 데이터가 같다는 이유만으로 PASS하지 않는다. 실제 브라우저 상태에서 버튼 fill/active 여부, 목록 포함 여부, 잠금 상태, 공개 상태가 같은 곡 기준으로 일치해야 하며 하나라도 다르면 승격 FAIL
26. **연결 기능 영향 감사:** 수정한 파일만 보지 않고 변경된 상태/캐시/revision/signal/track identity가 연결된 소비자까지 추적한다. Music Note→publication→Feed→Public Profile→Search→shared-note/curation/like-card 같은 연쇄에서 영향 있음/없음을 각각 근거로 판정하고, 직접 수정하지 않은 기능도 실제 회귀 테스트 대상에 포함한다. 특히 캐시 변경은 같은 계정 다른 기기·다른 계정 warm cache·PREVIEW/TEST/PRODUCTION 다른 origin의 기존 캐시에서 누락/지연/역전이 없는지 확인한다.
27. **구형 저장 포맷 호환성:** 현재 코드에서 정상인 최신 song shape만 테스트하지 않는다. 기존 사용자 Music Note의 `appliedKeywords`, `requestPayload.appliedKeywords`, known legacy requestPayload-direct recipe 및 command aliases를 fixture로 재현해 `다음곡에 적용`과 새 공개 shareBundle이 같은 설정을 복원하는지 확인한다. 최신 값이 legacy에 덮이지 않고, 저장되지 않은 값을 prompt 등에서 추정하지 않으며, 호환을 위해 migration/backfill/full collection read를 추가하지 않았는지 확인한다.

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
- **D1 비용 판단 (2026-10-09 사용자 승인 최신 기준):** `W1~W2`는 최적화 목표이지 무조건적인 배포 합격선이 아니다. `W3+` 자체로 기존 정상 기능을 실패 처리하거나 약화하지 않는다. 실제 D1 청구 행수 및 Workers/R2/DO/Firestore/RTDB/Functions 합산 월비용(10만 DAU), 반복 조회·전체 스캔·페이지 진입 write 유무, O(1) 변경분 및 PC↔모바일 정확성을 확인한다. W3+의 원인과 경제적 대안을 기록하되, 실사용 기능 보호를 우선한다.

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

# SORIDRAW 작업 시작 지침 — 반드시 먼저 읽기

이 저장소에서 코드 수정, 백엔드 수정, 테스트, 배포를 시작하기 전에 **과거 채팅보다 GitHub의 현재 상태를 먼저 확인한다.** 새 채팅에서 사용자가 이전 작업을 다시 설명하게 만들지 않는다.

## 필수 확인 순서
1. `DOCS/CURRENT_RELEASE_STATE.md` — 현재 실제 기준/배포 상태/알려진 문제/다음 작업
2. `DOCS/WORKFLOW_GUARDRAILS.md` — 브랜치·배포·데이터·비용·안전 고정 규칙
3. `DOCS/NEXT_CODEX_TASK.md` — 현재 구현 작업이 있을 때 실행 기준
4. `DOCS/WORK_AUDIT_CHECKLIST.md` — 구현 완료 후 독립 검증 기준
5. 과거 원인이 필요할 때만 `DOCS/WORK_LOG.md`

## 절대 원칙
- 현재 사용자 지시 → `CURRENT_RELEASE_STATE.md` → GitHub/Firebase/Cloudflare 실제 상태 순으로 판단한다.
- `preview` = 개발/큰 수정/비용 최적화/배포 전 검증.
- `main` = 검증 완료 후 TEST 승격 기준.
- PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 절대 승격하지 않는다.
- GitHub push만으로 배포 완료라고 말하지 않는다.
- PREVIEW/TEST/PRODUCTION은 **기능 코드와 실행 환경을 분리**한다.
- SORIDRAW의 현재 운영 의도는 **사용자 데이터는 3개 앱에서 공유**하는 것이다. 기능만 PREVIEW → TEST → PRODUCTION 순으로 승격한다.
- Explore의 사용자 원본 데이터는 공유 Canonical 저장소를 기준으로 하고, 환경별 파생 캐시/진단/속도제한은 분리한다.
- 앱 버전 업데이트만으로 사용자 데이터 캐시를 무효화하거나 전체 데이터를 다시 읽게 만들지 않는다.
- 페이지 진입/새로고침/재방문/업데이트만으로 서버 write 금지, 변경이 없으면 서버 data read 0을 목표로 한다.
- 좋아요/공개/비공개/팔로우/프로필 수정 등 실제 변경은 **바뀐 항목만** 처리하고 전체 Feed/전체 프로필 재조회·재생성을 금지한다.
- Music Note의 현재 정상 동작(로컬 즉시 반영 + 여러 수정 60초 묶음 서버 저장)은 별도 승인 없이 깨지 않는다.
- UI/반응형/간격/색상은 요청 없이 변경하지 않는다.
- 데이터 삭제·대량수정·migration·PRODUCTION 데이터 변환은 승인 없이 실행하지 않는다.

## AI 작업 분담
- ChatGPT: 설계, 범위 결정, 비용/데이터 위험 판단, 승격 통제.
- Codex: `preview`에서 실제 구현. 분석 → 구현 → 테스트 → commit까지 한 흐름으로 끝낸다.
- Work: Codex commit을 독립 검증한다. 기본은 **수정하지 않고 감사**한다.
- ChatGPT: GitHub/실제 환경을 다시 확인한 뒤 TEST/PRODUCTION 승격 여부를 판단한다.
- 여러 AI가 동시에 같은 코드를 수정하지 않는다.

## 작업 종료 시 반드시 갱신
코드/백엔드/배포 상태가 달라지면 같은 작업 안에서 `DOCS/CURRENT_RELEASE_STATE.md`를 갱신한다. 새 채팅은 이 문서를 기준으로 이어간다.

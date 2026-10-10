# SORIDRAW 작업 시작 지침 — 반드시 먼저 읽기

이 저장소에서 코드 수정, 백엔드 수정, 테스트, 배포를 시작하기 전에 **과거 채팅보다 GitHub의 현재 상태를 먼저 확인한다.** 새 채팅에서 사용자가 이전 작업을 다시 설명하게 만들지 않는다.

## 필수 확인 순서
1. `DOCS/CURRENT_RELEASE_STATE.md` — 현재 실제 기준/배포 상태/알려진 문제/다음 작업
2. `DOCS/NEXT_CODEX_TASK.md` — 현재 구현 작업이 있을 때 범위/합격선/중단 조건
3. `DOCS/WORK_AUDIT_CHECKLIST.md` — 구현 완료 후 독립 검증 기준
4. `DOCS/WORKFLOW_GUARDRAILS.md` — 브랜치·배포·데이터·비용·안전 고정 규칙
5. `DOCS/CODEX_USAGE_BUDGET.md` — Codex 사용량 절약 규칙
6. 필요 시 `DOCS/DEPLOYMENT_PROGRESS.md`
7. 과거 원인이 정말 필요할 때만 `DOCS/WORK_LOG.md`
8. 실제 `preview` HEAD와 최근 commit을 확인해 문서와 실제 GitHub가 일치하는지 확인

## 기능별 스킬
- 좋아요/해제, 개인 좋아요 카탈로그, PC↔모바일 동기화, Explore 좋아요 비용 최적화 작업 전에는 반드시 `.agents/skills/local-first-like-sync/SKILL.md`를 읽는다.
- **현재 좋아요 동결 기준은 `.agents/skills/local-first-like-sync/references/soridraw-app164-worker195-frozen.md`** (신규 공개곡 첫 좋아요 문제 사용자 해결 확인)이며, `references/soridraw-app160-worker195-frozen.md`는 기존 좋아요·PC↔모바일·타계정 공개 숫자의 이전 실기기 정상 기준이다. `references/soridraw-app141-baseline.md`는 수신 저장 순서의 역사적 기준이다. 정상인 좋아요 기능은 새 오류와 사용자 명시 수정 지시 없이 절대 변경하지 않는다.
- 분할바/분할모드/Studio Black pane resize/PC·태블릿 경계/생성바 split tracking/분할 성능 작업 전에는 반드시 `.agents/skills/studio-split-behavior/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/studio-split-behavior/references/soridraw-app198-split-frozen.md`이며, 현재 정상 분할 동작은 구체 오류나 사용자 명시 변경 지시 없이 리팩터링·대체하지 않는다.
- 곡 저장/해제, Studio 저장 하트, Recent Song 제목·프롬프트·가사 수정, PC↔모바일 즉시 동기화, canonical Firestore 묶음 저장, `users.favoriteCount` 비용 구조를 변경하거나 감사할 때는 반드시 `.agents/skills/song-save-edit-sync-cost/SKILL.md`를 읽는다. 현재 Studio 저장하트 보호 기준은 `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`이다. **같은 기기 즉시 + PC↔모바일 즉시 하트·Music Note membership 동기화 + canonical Firestore는 곡별 마지막 클릭 +30초 최종 상태만 저장**을 사용자 승인 없는 최적화로 절대 늦추거나 제거하지 않는다. +30초 확정 시 저장곡이 화면에서 사라지는 전환도 금지하고, Detail에 정상 저장된 Suno 미디어/썸네일이 목록 캐시·재실행에서 사라지지 않게 보호한다. app347의 stale overwrite/media 보호도 함께 유지한다. Studio 저장 하트를 Explore 공개 좋아요와 같은 상태기로 취급하지 말고, 공통 하트/동기화 작업이면 `.agents/skills/local-first-like-sync/SKILL.md`의 Studio save-heart 구분 규칙도 함께 확인한다.
- **Music Note / Library 폴더 생성·저장·이름변경·삭제·드래그 순서이동·PC↔모바일 동기화·Firestore 비용**을 변경하거나 감사할 때는 반드시 `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`다. app301 정상 폴더 경로는 구체 오류나 사용자 명시 변경 지시 없이 다시 구조 변경하지 않는다.
- 비용/캐시/동기화 변경이면 `references/cost-regression-checklist.md`도 함께 읽는다.
- 이 스킬은 정상 기능을 비용 때문에 삭제하거나 약화하는 근거로 사용할 수 없다. 현재 사용자 지시와 `CURRENT_RELEASE_STATE.md`가 항상 우선한다.

## 절대 원칙
- 현재 사용자 지시 → `CURRENT_RELEASE_STATE.md` → GitHub/Firebase/Cloudflare 실제 상태 순으로 판단한다.
- `preview` = 개발/큰 수정/비용 최적화/배포 전 검증.
- `main` = 검증 완료 후 TEST 승격 기준.
- PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 절대 승격하지 않는다.
- **최종 목표는 항상 PRODUCTION이다.** PREVIEW/TEST에서 기능을 만들고 검증할 때부터 PRODUCTION의 실제 binding, 환경변수, R2/Edge/브라우저 persistent cache, 기존 사용자 업그레이드 상태까지 함께 설계·검증한다. PRODUCTION 승격 뒤에 처음 발견되는 환경 차이를 "정식에서만 생긴 별도 문제"로 미루는 것을 금지한다.
- **TEST_VERIFIED는 단순 코드 PASS가 아니다.** 동일 release artifact가 PRODUCTION의 실제 환경 계약과 기존 사용자 상태에서도 같은 결과를 낼 수 있음이 사전 검증된 상태만 TEST_VERIFIED로 인정한다.
- **TEST → PRODUCTION은 새 개발/재해석/재빌드 단계가 아니다.** TEST에서 검증한 exact Hosting artifact / Worker bundle / Media bundle / Functions artifact를 동일 identity로 승격하고, 환경별 값은 사전에 선언·검증된 차이만 허용한다.
- TEST에서 정상인데 PRODUCTION에서 기능 결과가 달라지면 제품팀이 뒤늦게 기능을 다시 고치는 정상 절차로 취급하지 않고 **Release System FAIL**로 기록한다. 같은 릴리스에서 PRODUCTION 수정→재배포를 반복하는 것을 정상 승격으로 인정하지 않는다.
- GitHub push만으로 배포 완료라고 말하지 않는다.
- 사용자가 수정 요청을 하면, 검증이 통과하고 안전하게 PREVIEW 배포 가능한 작업은 별도 재승인을 기다리지 말고 같은 작업 안에서 PREVIEW 배포까지 완료한다. 단 TEST/PRODUCTION 승격은 기존 명시 승인 규칙을 그대로 따른다.
- PREVIEW/TEST/PRODUCTION은 **기능 코드와 실행 환경을 분리**한다.
- SORIDRAW의 현재 운영 의도는 **사용자 데이터는 3개 앱에서 공유**하는 것이다. 기능만 PREVIEW → TEST → PRODUCTION 순으로 승격한다.
- Explore의 사용자 원본 데이터는 공유 Canonical 저장소를 기준으로 하고, 환경별 파생 캐시/진단/속도제한은 분리한다.
- 앱 버전 업데이트만으로 사용자 데이터 캐시를 무효화하거나 전체 데이터를 다시 읽게 만들지 않는다.
- 페이지 진입/새로고침/재방문/업데이트만으로 서버 write 금지, 변경이 없으면 서버 data read 0을 목표로 한다.
- 좋아요/공개/비공개/팔로우/프로필 수정 등 실제 변경은 **바뀐 항목만** 처리하고 전체 Feed/전체 프로필 재조회·재생성을 금지한다.
- **비용 판단 변경 (2026-10-09 사용자 명시 승인):** W1~W2는 더 이상 무조건적인 배포 합격선이 아니다. W3+ 자체만을 이유로 이미 정상인 좋아요/해제·팔로우·공개/비공개 기능을 실패 판정하거나, 기능을 약화시키거나, 복잡한 원본 DB 전환·캐시 전체 재설계를 강행하지 않는다. **실제 Cloudflare D1 청구 행수와 전체 Workers/R2/DO/Firestore 사용량, 10만 명 월 총비용, O(1) 변경분 처리 및 PC↔모바일 정확성**을 함께 확인하고 경제적 이익이 분명한 최소 수정만 선택한다. 읽기 반복·전체 스캔·페이지 진입 write 및 사용자 데이터 손실은 여전히 불합격이며 TEST/PRODUCTION 승격은 기존 별도 승인 규칙을 지킨다.
- Music Note의 현재 정상 동작(로컬 즉시 반영 + 여러 수정 60초 묶음 서버 저장)은 별도 승인 없이 깨지 않는다.
- UI/반응형/간격/색상은 요청 없이 변경하지 않는다.
- 데이터 삭제·대량수정·migration·PRODUCTION 데이터 변환은 승인 없이 실행하지 않는다.

## AI 작업 분담
- ChatGPT: 설계, 범위 결정, 비용/데이터 위험 판단, GitHub 상태 문서 관리, 승격 통제.
- Codex: `preview`에서 실제 구현. 분석 → 구현 → 테스트 → commit까지 한 흐름으로 끝낸다. 배포는 하지 않는다.
- Work: Codex commit을 독립 검증한다. 기본은 **수정하지 않고 감사**한다.
- ChatGPT: GitHub/실제 환경을 다시 확인한 뒤 PREVIEW 배포 가능 여부와 TEST/PRODUCTION 승격 여부를 판단한다.
- 여러 AI가 동시에 같은 코드를 수정하지 않는다.

## Codex 사용량 원칙
- 대형 백엔드 작업의 현재 권장값은 `DOCS/CODEX_USAGE_BUDGET.md`를 따른다.
- 같은 저장소 전체/WORK_LOG 전체를 반복 분석하지 않는다.
- 필요한 소유 파일과 호출 경로를 찾은 뒤 좁혀서 작업한다.
- 작은 수정마다 전체 Build를 반복하지 않고, 최종 후보에서 전체 TypeScript/Build/필수 Test를 수행한다.
- 같은 접근이 반복 실패하거나 migration/데이터 손실 위험/복잡한 동시성 변경이 필요해지면 사용량을 소모하며 밀어붙이지 말고 중단 후 보고한다.

## 저장소 유지보수 원칙
- 장기 기준 브랜치는 `preview`, `main`, `production`으로 제한한다. 릴리스/백업 브랜치는 실제 복구 근거가 있을 때만 보존한다.
- 작업용 `temp/tmp/work/audit/diag/deploy/fix/final` 브랜치는 작업 종료 후 `preview` 또는 `main`에 이미 포함됐는지 확인하고 포함됐으면 같은 유지보수 흐름에서 삭제한다.
- 고유 commit이 남은 미병합 브랜치는 이름만 보고 삭제하지 않는다. 별도 감사 전까지 보존한다.
- `-v2`, `-final3`, `-work11`처럼 재시도 브랜치/Workflow를 계속 쌓는 방식을 금지한다. 기존 것을 수정·재사용하고 작업이 끝나면 정리한다.
- 일회성 `.github/workflows/temp-*` Workflow는 완료 후 제거한다. 반복 사용 검사는 목적이 명확한 공용 Workflow로 유지한다.
- 저장소 유지보수 Workflow는 자동 실행하지 않고 `workflow_dispatch` 수동 실행을 기본으로 한다.
- 필수 감사 항목이 실패했는데 최상위 Action을 `Success`로 처리하는 false-green을 금지한다. D1/schema/security처럼 다음 판단에 필요한 검사는 실패 시 전체 감사도 실패해야 한다.
- 큰 작업 완료 보고에는 생성/삭제 브랜치, 남은 임시·미병합 브랜치, 추가/삭제 Workflow를 포함한다.
- `preview`, `main`, `production`은 force-push/삭제 방지 보호를 유지해야 한다. 실제 GitHub 보호 상태가 꺼져 있으면 완료로 취급하지 말고 위험으로 기록한다.

## 작업 종료 시 반드시 갱신
코드/백엔드/배포 상태가 달라지면 같은 작업 안에서 `DOCS/CURRENT_RELEASE_STATE.md`를 갱신한다. 새 채팅은 이 문서를 기준으로 이어간다.

## 사용자 진행률 보고 고정
- SORIDRAW 개발 작업은 시작부터 종료까지 **진척도 표시를 항상 유지**한다. 새 채팅에서도 GitHub 최신 기준에서 이어간다.
- 매 진행 보고에는 **전체 단계의 완료 수/전체 수(근거 있는 경우만)**, 이번에 실제 완료한 것, 진행 중인 것, 다음 한 가지 작업, 멈춘 이유·검증되지 않은 부분을 짧은 한국어로 표시한다. 자동검사 PASS와 실서비스 활성화/실사용 PASS를 구분한다.
- Codex/Work/GitHub Action 등에 실행 중인 일이 있을 때 완료인 것처럼 쓰지 않는다. 변경이 없으면 '소스 확인만'으로, 배포하지 않았으면 '미배포'로 표시한다.
- 가능한 한 작업 중간에도 상태를 갱신하고, 장시간 검증이 걸릴 때에도 진척도를 생략하지 않는다. 디렉터가 이해하기 쉽게 설명한다.

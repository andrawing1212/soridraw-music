# SORIDRAW 작업 시작 지침 — 반드시 먼저 읽기

이 저장소에서 코드 수정, 백엔드 수정, 테스트, 배포를 시작하기 전에 **과거 채팅보다 GitHub의 현재 상태를 먼저 확인한다.** 새 채팅에서 사용자가 이전 작업을 다시 설명하게 만들지 않는다.

## 시작할 때 확인 — 필요한 부분만, 반복 정독 금지
1. **중단 작업 복구:** 먼저 기존 작업환경의 `git status`·로컬 커밋과 해당 GitHub PR/원격 SHA만 확인한다. 이미 읽고 확인한 문서·코드·검사를 다시 읽거나 전체 분석하지 않는다.
2. **새 작업:** 이 `AGENTS.md`의 해당 규칙과 실제 `preview` HEAD·관련 PR을 확인한다. `DOCS/CURRENT_RELEASE_STATE.md`는 **현재 작업 관련 최신 부분만**, `DOCS/NEXT_CODEX_TASK.md`는 **해당 작업 지시 부분만** 확인한다.
3. **조건부 문서:** 독립 감사 시 `DOCS/WORK_AUDIT_CHECKLIST.md`, 배포 시 `DOCS/WORKFLOW_GUARDRAILS.md`·`DOCS/DEPLOYMENT_PROGRESS.md`, Codex 사용량 운영이 필요할 때 `DOCS/CODEX_USAGE_BUDGET.md`의 **관련 규칙만** 읽는다. 모든 작업에서 이 문서들을 전부 읽지 않는다.
4. **공통 계약:** `DOCS/DIRECTOR_WORK_RULES_AND_DAILY_ROUTINE.md`는 승인 범위·데이터 안전·저장 우선·보고 등 **현재 필요한 조항만** 확인하고 이미 알고 있는 조항을 다시 수집하지 않는다. `DOCS/WORK_LOG.md` 전체 재읽기는 금지하며, 과거 원인 확인이 필요할 때 관련 기록만 찾는다.
5. **우선순위:** 중요한 안전 제약은 생략하지 않되, 문서 전체 읽기 대신 파일명·절·필요한 줄만 선택한다. 작업이 새로 시작됐다는 이유만으로 긴 기록을 다시 불러오지 않는다.

## 기능별 스킬
- 좋아요/해제, 개인 좋아요 카탈로그, PC↔모바일 동기화, Explore 좋아요 비용 최적화 작업 전에는 반드시 `.agents/skills/local-first-like-sync/SKILL.md`를 읽는다.
- **현재 좋아요 동결 기준은 `.agents/skills/local-first-like-sync/references/soridraw-app410-like-convergence-frozen.md`** (PC↔모바일 초기 불일치 및 same-version retained 하트 drift 사용자 실기기 PASS)이다. `references/soridraw-app164-worker195-frozen.md`와 `references/soridraw-app160-worker195-frozen.md`는 각각 신규곡 초기판정·이전 양방향 동기화의 역사적 보호 기준, `references/soridraw-app141-baseline.md`는 수신 저장 순서 기준이다. app410의 Stage416 client OFF + legacy canonical batch 복구 + pending Auth-ready recovery + exact retained local-only repair는 새 오류와 사용자 명시 수정 지시 없이 다시 켜거나 우회하지 않는다.
- 분할바/분할모드/Studio Black pane resize/PC·태블릿 경계/생성바 split tracking/분할 성능 작업 전에는 반드시 `.agents/skills/studio-split-behavior/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/studio-split-behavior/references/soridraw-app198-split-frozen.md`이며, 현재 정상 분할 동작은 구체 오류나 사용자 명시 변경 지시 없이 리팩터링·대체하지 않는다.
- 곡 저장/해제, Studio 저장 하트, Recent Song 제목·프롬프트·가사 수정, PC↔모바일 즉시 동기화, canonical Firestore 묶음 저장, `users.favoriteCount` 비용 구조를 변경하거나 감사할 때는 반드시 `.agents/skills/song-save-edit-sync-cost/SKILL.md`를 읽는다. 현재 Studio 저장하트 보호 기준은 `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`이다. **같은 기기 즉시 + PC↔모바일 즉시 하트·Music Note membership 동기화 + canonical Firestore는 곡별 마지막 클릭 +30초 최종 상태만 저장**을 사용자 승인 없는 최적화로 절대 늦추거나 제거하지 않는다. +30초 확정 시 저장곡이 화면에서 사라지는 전환도 금지하고, Detail에 정상 저장된 Suno 미디어/썸네일이 목록 캐시·재실행에서 사라지지 않게 보호한다. app347의 stale overwrite/media 보호도 함께 유지한다. Studio 저장 하트를 Explore 공개 좋아요와 같은 상태기로 취급하지 말고, 공통 하트/동기화 작업이면 `.agents/skills/local-first-like-sync/SKILL.md`의 Studio save-heart 구분 규칙도 함께 확인한다.
- **Music Note / Library 폴더 생성·저장·이름변경·삭제·드래그 순서이동·PC↔모바일 동기화·Firestore 비용**을 변경하거나 감사할 때는 반드시 `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`다. app301 정상 폴더 경로는 구체 오류나 사용자 명시 변경 지시 없이 다시 구조 변경하지 않는다.
- 비용/캐시/동기화 변경이면 `references/cost-regression-checklist.md`도 함께 읽는다.
- 이 스킬은 정상 기능을 비용 때문에 삭제하거나 약화하는 근거로 사용할 수 없다. 현재 사용자 지시와 `CURRENT_RELEASE_STATE.md`가 항상 우선한다.

## 디렉터 작업 계약 — 모든 개발/감사 채팅 필수

- **Codex 지시 간결화:** 한 작업 지시는 기본적으로 '목표 / 작업 범위·금지 / 완료 기준·보고'만 담는다. 공통 규칙과 장문 배경은 복사하지 않고 해당 GitHub 문서를 참조한다. 복잡한 안전 조건이 실제로 필요한 경우만 짧게 추가한다. 이미 확정된 진행 중 지시는 불필요하게 다시 작성하지 않는다.

- **실제 개발 방식:** 형식적 승인·과도한 감사·반복 검사·불필요한 리팩터링으로 작업을 지연하지 않는다. 안전한 필수 문서 오류 수정 등은 기존 작업 범위 내에서 책임지고 바로 처리하고 결과를 보고한다. 위험한 코드 변경이나 환경 배포는 별도 안전·승인 기준을 지킨다.
- **코드 정리 판단:** 향후 개발에 앞서 복잡성·중복·상호 충돌의 *실제 근거*가 있고 그대로 개발하면 장애·데이터 손실·큰 재작업이 예상될 때는 작업을 잠깐 끊고 최소 정리 범위·비용·위험·대안·합격 기준을 설명하여 승인을 받는다. 승인 없이 정상 코드를 전면 정리하지 않는다. 단순히 길다는 이유만으로 선행 정리를 강요하지 않는다.

- 새 작업 시작 시 `DOCS/DIRECTOR_WORK_RULES_AND_DAILY_ROUTINE.md`의 **이번 작업 관련 조항만** 확인하고 목표/합의 범위/안전선/저장·검증/다음 작업을 간결히 보고한다. 중단 작업 재개 시 이미 확인한 조항을 반복해서 읽지 않는다.
- 사용자 승인을 받은 세부 동작은 **전부 합격할 때까지 추적**한다. 구현 편의로 일부를 조용히 빼거나 같은 작업 명령문을 번복하지 않는다.
- Codex/Work 사용량이 부족해지기 전에 **복구 가능한 GitHub commit/push와 정확한 상태 기록을 우선**한다. 원격 미저장은 완료 아님.
- 매일 GitHub 현재 기준으로 **오늘 한 작업 → 복구 지점 → 검증 → 다음 날 한 작업** 루틴을 정한다. 긴급 장애가 생기면 안전 복구 우선.
- 모든 채팅은 같은 GitHub 기준을 사용하지만, 다른 Codex 채팅의 임시 로컬 작업을 자동 재개할 수 있다고 주장하지 않는다.

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
- **배포는 사용자의 명시적인 배포 요청이 있을 때만 실행한다.** 일반 수정 요청은 코드 수정·필수 검사·GitHub 저장까지만 진행한다. PREVIEW/TEST/PRODUCTION 각 배포는 사용자 요청 범위에 한정한다. GitHub 자동 PREVIEW 배포 문구가 충돌하면 이 규칙을 우선하고 문서 충돌을 바로잡는다.
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

## AI 작업 분담 — 개발방 / 감사방 고정 운영

SORIDRAW는 **실제 개발 실행과 독립 검증을 서로 다른 채팅 역할로 분리**한다.
새 채팅에서도 과거 대화를 사용자에게 다시 설명시키지 않고 GitHub 현재 상태 문서를 공통 기억으로 사용한다.

### 새 채팅 시작문 — 짧은 문장만으로 역할 복구
- 사용자가 GPT-5.6 Sol 채팅에서 **`SORIDRAW 개발방 이어가기.`** 라고 하면 즉시 **개발방**으로 판단한다.
- 사용자가 GPT-6 Astra 채팅에서 **`SORIDRAW 감사방 이어가기.`** 라고 하면 즉시 **감사방**으로 판단한다.
- 사용자가 별도 설명을 붙이지 않아도 먼저 이 `AGENTS.md`와 필수 현재 상태 문서를 읽고 GitHub 최신 상태에서 작업을 복구한다.
- 채팅 제목이나 과거 채팅 기억을 역할/현재 상태의 기준으로 사용하지 않는다.
- 문서와 실제 GitHub HEAD가 다르면 실제 GitHub 상태를 우선 확인하고 필요한 상태 문서를 교정한다.

### GPT-5.6 Sol — 개발방 / 실행 담당
GPT-5.6 Sol 채팅은 SORIDRAW의 **실제 개발방**이다.

작업 시작 시 반드시 이 문서의 **필수 확인 순서**를 수행하고, 필요한 기능별 Skill/Reference와 `preview` 최신 HEAD를 확인한다.

담당:
- 문제 원인 확인과 구현 범위 결정
- 실제 코드/문서 수정
- 필요한 경우 Codex를 이용한 복잡한 구현
- TypeScript / Build / 관련 Test
- `preview` commit / push
- 감사 완료 후 필요한 Firebase PREVIEW / Cloudflare PREVIEW 배포
- 실제 `preview.soridraw.com` 확인
- `CURRENT_RELEASE_STATE.md` 등 현재 상태 문서 갱신

개발방은 기존 정상 기능, 공유 사용자 데이터, Local First/비용 구조를 보호한다.
TEST와 PRODUCTION은 사용자의 명시 승인 없이는 승격하지 않는다.

기능·데이터·동기화·비용·백엔드에 영향을 주는 의미 있는 수정은 최종 commit SHA를 고정한 뒤 GPT-6 감사방의 독립 감사를 거친다.
감사 중인 대상 commit은 임의로 바꾸지 않는다.

### GPT-6 Astra — 감사방 / 분석·독립 검증 담당
GPT-6 Astra 채팅은 SORIDRAW의 **독립 감사방**이다.

작업 시작 시 반드시 이 문서의 **필수 확인 순서**와 `DOCS/WORK_AUDIT_CHECKLIST.md`를 확인하고, 사용자가 지정한 commit SHA 또는 현재 감사 대상 commit을 고정한다.

담당:
- 원인/구조 분석
- 개발방 변경사항 독립 검증
- 기존 정상 기능 회귀 확인
- 데이터 손실/호환성 위험 확인
- Firestore / D1 / Worker / Functions 비용 폭증 가능성 확인
- 전체 조회 / 반복 read-write 여부 확인
- PC / Tablet / Mobile 영향 확인
- Firebase / Cloudflare 배포 경로 안전성 확인
- TEST / PRODUCTION 영향 확인
- 최종 PASS / FAIL 판정

감사방은 개발방의 설명만 믿지 않고 GitHub 실제 코드와 commit을 직접 확인한다.

감사방에서는 원칙적으로 다음을 금지한다:
- 코드/문서 수정
- commit / push
- Firebase / Cloudflare 배포
- 공유 사용자 데이터 변경
- migration / backfill / 캐시 강제 삭제
- 문제 발견 후 직접 수정

문제가 있으면 **FAIL → 원인 → 위험 → 최소 수정 범위 → 재감사 조건**으로 개발방에 전달한다.
문제가 없으면 **PASS → 확인 범위 → 남은 위험 → PREVIEW 배포 가능 여부**를 보고한다.

### 개발 → 감사 → PREVIEW 배포 고정 흐름
1. GPT-5.6 개발방: 원인 확인 → 실제 수정 → TypeScript/Build/Test → `preview` commit/push → 최종 SHA 고정
2. GPT-6 감사방: 해당 SHA 독립 감사 → PASS / FAIL
3. FAIL이면 GPT-5.6 개발방에서 최소 수정 → 새 SHA → GPT-6 재감사
4. PASS이면 GPT-5.6 개발방에서 **감사받은 exact commit** 기준으로 필요한 PREVIEW 배포 → 실제 PREVIEW 주소 확인
5. 사용자: PREVIEW PC/모바일 실사용 검증
6. PREVIEW → TEST는 사용자 승인, TEST → PRODUCTION은 사용자의 명확한 정식배포 승인 후에만 진행

### Codex / Work 역할
- **Codex:** GPT-5.6 개발방의 구현 보조. `preview`에서 분석 → 구현 → 테스트 → commit까지 한 흐름으로 수행하며 자체 판단으로 배포하지 않는다.
- **Work:** 필요 시 GPT-6 감사방의 독립 검증 보조. 기본은 수정자가 아니라 검증자다.
- 여러 AI가 동시에 같은 코드를 수정하지 않는다.

최종 역할 책임:
- **GPT-5.6 Sol = 개발·실행·PREVIEW 배포 담당**
- **Codex = 구현 보조**
- **GPT-6 Astra = 분석·독립 감사 담당**
- **Work = 감사 보조**
- **사용자 = PREVIEW 실사용 판정 + TEST / PRODUCTION 최종 승인**

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

## 디렉터 고정: 단계 종료 시 다음 행동은 질문형으로 제시 (2026-10-27)

- 개발·검사·GitHub 저장·감사 등 한 단계가 끝났고 **다음 단계의 실행 또는 도구 선택이 필요하면**, 결과만 통보하고 대화를 끝내지 말고 **그 시점에 적합한 짧은 질문을 반드시 붙인다.** 예: `계속 진행할까요?`, `검사 진행할까요?`, `Codex 작업 진행할까요?`, `WORK 독립 감사 진행할까요?`.
- 질문은 현재 남은 **구체적 작업 한 가지**에 맞춰 한다. 예: `app514 CI 5/5 PASS, 배포 전 Work 독립 감사가 남았습니다. Work 감사 진행할까요?`처럼 사용자가 단답으로 선택할 수 있게 한다. 단순히 `다음은 감사입니다`로 끝내지 않는다.
- 사용자가 이미 **진행을 지시한 현재 단계**의 안전한 세부 작업은 불필요한 허락 없이 끝낸다. 질문은 **새 단계·다른 작업자/모드 전환·범위 변경·별도 승인이 필요한 실제 행동**을 시작하기 전이다. 같은 질문을 반복하거나 실현할 수 없는 자동 Work/Codex 실행을 약속하지 않는다.
- **대화를 종료할 때 마지막 문장은 필요한 다음 행동에 대한 한 가지 명확한 질문**으로 맺는다. 이미 모든 작업이 끝나 후속 결정이 없다면 인위적인 질문을 만들지 않는다.
- 이 규칙은 모든 새 개발방·감사방과 Codex/Work 작업 보고에 공통 적용한다. 사용자에게 채팅마다 다시 설명하도록 요구하지 않는다.

## 디렉터 고정: 에이전트 작업 모델 별도 표시 (2026-10-28)

- WORK·Codex·그 밖의 AI 에이전트에 **명령문을 작성해 전달할 때는**, 명령문 위에 별도 한 줄로 **`권장/선택 모델: [모델명] · [버전] · [추론 수준(해당 시)]`**을 항상 명확히 표시한다. 이는 **이 작업을 어떤 모델에 맡기는 것이 좋은지 디렉터에게 알려 주는 표시**이며, 에이전트가 실제 사용한 모델의 확인 요구와 전혀 다르다.
- **명령문에는 모델 사용 여부 확인·버전 보고·모델 지정 강제 문구를 자동 삽입하지 않는다.** 디렉터가 요청한 목표·작업 범위·완료 기준·코드 수정/배포 금지 등 업무 지시만 간결하게 넣는다. 예:
  **권장 모델: GPT-6 · High** (명령문 바깥)
  `WORK 명령문: PR #512, SHA ...를 읽기 전용 독립 감사하고 PASS/FAIL과 근거를 보고해. 코드 수정·커밋·배포 금지.`
- 모델 선택이 WORK/Codex에서 실제로 지원되는지 확인되지 않았으면 `권장 모델`로만 표시하고, 사용 가능한 모델인지 또는 실제로 적용되었는지 **추측하거나 확정하지 않는다**. 모델을 알 수 없는 이유로 **감사·개발 자체를 시작하지 말라는 제약을 임의로 만들지 않는다**.
- 디렉터가 실제 사용 모델의 별도 보고까지 명시적으로 요청한 경우에만 그것을 명령문에 추가한다.
- 이 형식은 새 개발방·감사방을 포함한 모든 에이전트 작업 명령에 적용한다. 디렉터에게 채팅마다 다시 설명하도록 요구하지 않는다.

## 사용자 진행률 보고 고정
- SORIDRAW 개발 작업은 시작부터 종료까지 **진척도 표시를 항상 유지**한다. 새 채팅에서도 GitHub 최신 기준에서 이어간다.
- 매 진행 보고에는 **전체 단계의 완료 수/전체 수(근거 있는 경우만)**, 이번에 실제 완료한 것, 진행 중인 것, 다음 한 가지 작업, 멈춘 이유·검증되지 않은 부분을 짧은 한국어로 표시한다.
- **진척도 항목마다 반드시 실제 작업명을 함께 쓴다**: '이전 세부 작업'/'현재 세부 작업'만 표기하지 말고 `이전 세부 작업(동일 UID 다중 탭 좋아요 최초 요청 중복 전송 방지) 4/4·100%`, `현재 세부 작업(PREVIEW PC·태블릿·모바일 Chrome 첫/재진입·터치 QA) 4/4·100%`처럼 구체적으로 쓰며 각각 자동검증·실기기·배포 상태를 구별한다. 자동검사 PASS와 실서비스 활성화/실사용 PASS를 구분한다.
- Codex/Work/GitHub Action 등에 실행 중인 일이 있을 때 완료인 것처럼 쓰지 않는다. 변경이 없으면 '소스 확인만'으로, 배포하지 않았으면 '미배포'로 표시한다.
- 가능한 한 작업 중간에도 상태를 갱신하고, 장시간 검증이 걸릴 때에도 진척도를 생략하지 않는다. 디렉터가 이해하기 쉽게 설명한다.

## 사용자 고정: 3중 진행률 보고 (2026-10-10)
- 모든 SORIDRAW 작업 진행 보고에서 **① Stage416 전체 진행률, ② 현재 앱 속도 개선 전체 진행률, ③ 현재 세부 작업 진행률**을 각각 `완료 단계/전체 단계 · %`로 표시한다. 단계의 정의가 바뀌면 근거를 명확히 갱신하고 사용자에게 알린다. 정의되지 않은 SORIDRAW 제품 전체 개발률을 임의 계산하지 않는다.
- 단계 보고에는 **이번에 실제 완료한 작업 / 진행 중 작업 / 다음 한 작업 / 멈춘 이유·미검증 / 배포 주소와 상태**를 반드시 포함한다. GitHub CI PASS는 실기기·배포 PASS가 아니다.
- 사용자는 PREVIEW 배포시점을 검증 근거로 자율 판단해 진행하거나 위험 시 승인을 요청하도록 위임했다. TEST와 PRODUCTION 승격은 기존 사용자 명시 승인 규칙을 유지한다. 미완성 Stage420 security cutover/공유 RTDB Rules 배포/데이터 변경을 PREVIEW Hosting 판단과 혼동하지 않는다.

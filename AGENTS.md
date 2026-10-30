# SORIDRAW 공통 개발 기준

이 문서는 모든 SORIDRAW 개발 채팅의 GitHub 기준이다. **현재 사용자 지시 → 승인된 작업 범위 → GitHub 실제 상태 → 필요한 기준 문서** 순서로 판단한다. 특정 AI·모델·역할 분담을 지정하거나 강제하지 않는다.

## 최우선 목표와 한 작업의 실행

**실제 앱을 안전하고 효율적으로 완성하는 것이 목표다.** 완료는 코드·CI 성공이 아니라 승인된 기능의 실제 동작까지 구분하여 판단한다.

**기본 흐름: 작업공간에서 충분히 수정 → 테스트 → 실패하면 같은 자리에서 다시 수정 → 테스트 통과 → 의미 있는 한 덩어리가 끝났을 때 커밋 → 필요하면 PR → 명시 승인된 경우 배포.**

- 한 번 승인한 작업은 현재 작업공간에서 확인·계획·수정·필수 검사·실패 수정까지 이어서 끝낸다. 작은 단계마다 커밋·PR·승인·감사를 반복하지 않는다.
- 새 실패 증거 없이 검사·진단·안전장치를 무한 추가하지 않는다. 이미 통과한 동일 경로 검사는 재사용하고, 실패한 부분만 최소 수정·재검사한다.
- 기능을 일부만 구현하고 완료라고 하지 않는다. 정상 UI, 로컬 우선 저장, PC↔모바일 동기화, 실제 사용자 데이터, 비용은 보호한다.
- 실제 위험 근거 없이 전면 리팩터링을 요구하지 않는다. 필요한 최소 코드 정리도 승인 범위를 넘으면 먼저 설명한다.
- 정확하지 않은 사실을 단정하지 않는다. 로컬 작업, 원격 커밋, CI, 병합, 배포, 실기기 확인은 별도 상태다.

## 새 채팅·작업 재개

1. 현재 사용자의 지시와 이미 승인된 작업을 먼저 확인한다. 완료·진행 중·미완료를 혼동하지 않는다.
2. 기존 작업공간의 수정 상태가 확인 가능하면 먼저 보호하고, GitHub `preview` HEAD 및 해당 PR의 현재 상태를 확인한다.
3. `AGENTS.md`, `DOCS/CURRENT_RELEASE_STATE.md`, `DOCS/NEXT_CODEX_TASK.md`는 **해당 작업에 필요한 부분만** 읽는다. 과거 메모와 일지는 새 승인이나 최신 상태가 아니다.
4. 독립 검증을 실제로 수행할 때만 `DOCS/WORK_AUDIT_CHECKLIST.md`, 배포할 때만 배포 관련 문서, 해당 기능을 수정할 때만 아래 Skill을 읽는다.
5. 다른 채팅의 미저장 임시 작업에 접근할 수 있다고 주장하지 않는다. 사용자에게 오래된 상황을 다시 설명하게 하지 않는다.

## 기능별 기술 기준 — 해당 작업일 때만 확인

- 좋아요/해제, 개인 좋아요 카탈로그, PC↔모바일 동기화, Explore 좋아요 비용 최적화 작업 전에는 반드시 `.agents/skills/local-first-like-sync/SKILL.md`를 읽는다.
- **현재 좋아요 동결 기준은 `.agents/skills/local-first-like-sync/references/soridraw-app410-like-convergence-frozen.md`** (PC↔모바일 초기 불일치 및 same-version retained 하트 drift 사용자 실기기 PASS)이다. `references/soridraw-app164-worker195-frozen.md`와 `references/soridraw-app160-worker195-frozen.md`는 각각 신규곡 초기판정·이전 양방향 동기화의 역사적 보호 기준, `references/soridraw-app141-baseline.md`는 수신 저장 순서 기준이다. app410의 Stage416 client OFF + legacy canonical batch 복구 + pending Auth-ready recovery + exact retained local-only repair는 새 오류와 사용자 명시 수정 지시 없이 다시 켜거나 우회하지 않는다.
- 분할바/분할모드/Studio Black pane resize/PC·태블릿 경계/생성바 split tracking/분할 성능 작업 전에는 반드시 `.agents/skills/studio-split-behavior/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/studio-split-behavior/references/soridraw-app198-split-frozen.md`이며, 현재 정상 분할 동작은 구체 오류나 사용자 명시 변경 지시 없이 리팩터링·대체하지 않는다.
- 곡 저장/해제, Studio 저장 하트, Recent Song 제목·프롬프트·가사 수정, PC↔모바일 즉시 동기화, canonical Firestore 묶음 저장, `users.favoriteCount` 비용 구조를 변경하거나 감사할 때는 반드시 `.agents/skills/song-save-edit-sync-cost/SKILL.md`를 읽는다. 현재 Studio 저장하트 보호 기준은 `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`이다. **같은 기기 즉시 반영·PC↔모바일 동기화·곡별 마지막 클릭 최종 상태**를 보호한다. 이 문서의 과거 +30초 보존 기준은 app349 당시 기준이며, 현재 승인된 1초 변경은 진행 중인 PR #541의 실제 코드·최신 승인 계약으로 판정한다. 지난 숫자를 최신 작업에 강제하지 않는다. +30초 확정 시 저장곡이 화면에서 사라지는 전환도 금지하고, Detail에 정상 저장된 Suno 미디어/썸네일이 목록 캐시·재실행에서 사라지지 않게 보호한다. app347의 stale overwrite/media 보호도 함께 유지한다. Studio 저장 하트를 Explore 공개 좋아요와 같은 상태기로 취급하지 말고, 공통 하트/동기화 작업이면 `.agents/skills/local-first-like-sync/SKILL.md`의 Studio save-heart 구분 규칙도 함께 확인한다.
- **Music Note / Library 폴더 생성·저장·이름변경·삭제·드래그 순서이동·PC↔모바일 동기화·Firestore 비용**을 변경하거나 감사할 때는 반드시 `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`를 읽는다. 현재 보호 기준은 `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`다. app301 정상 폴더 경로는 구체 오류나 사용자 명시 변경 지시 없이 다시 구조 변경하지 않는다.
- 비용/캐시/동기화 변경이면 `references/cost-regression-checklist.md`도 함께 읽는다.
- 이 스킬은 정상 기능을 비용 때문에 삭제하거나 약화하는 근거로 사용할 수 없다. 현재 사용자 지시와 `CURRENT_RELEASE_STATE.md`가 항상 우선한다.

## GitHub 저장과 시간 관리

- 단순 분석, 임시 실험, 작은 코드 수정, 검사 실패, 테스트 기대값 조정마다 커밋하지 않는다.
- **의미 있는 기능/버그 단위의 최종 후보를 검사한 뒤 저장**한다. 오래 걸리는 큰 작업에 현실적인 유실 위험이 있을 때만 복구용 중간 커밋을 만든다.
- PR은 보호 브랜치·실제 검토·병합이 필요한 경우에만 사용한다. 같은 문제의 재시도마다 PR/브랜치/Workflow를 만들지 않는다.
- 작업이 막히면 원인과 최소 해결책을 먼저 보고한다. 사용량 부족을 이유로 미완성 작업을 성공이라고 하지 않는다.
- 문서/작업 로그는 실제로 의미 있는 완료점이나 기준 변경이 있을 때만 수정한다. 매 단계 문서 커밋을 하지 않는다.
- `preview`, `main`, `production`의 보호와 정상 복구 지점을 보존한다. 미병합 고유 변경을 임의 삭제하거나 보호 브랜치를 force-push하지 않는다.

## 데이터·비용·배포 보호

- PREVIEW `preview.soridraw.com`, TEST `test.soridraw.com`, PRODUCTION `soridraw.com`. 세 환경은 사용자 원본을 공유하므로 사용자 데이터를 최우선 보호한다.
- 사용자의 **명시적 요청 없이 배포하지 않는다**. 일반 '프리뷰 수정'은 작업공간 수정·필수 검사·필요한 최종 GitHub 저장까지만 수행한다.
- 배포는 승인된 환경·구성요소에 한정한다. TEST·PRODUCTION 승격과 PR 병합은 각각 명시적 승인 범위를 확인한다.
- 원본 데이터 삭제·대량 수정·백필·파괴적 migration·공유 권한의 위험한 변경·캐시 강제 초기화·정상 UI 변경은 승인 없이 수행하지 않는다.
- Music Note·Library 로컬 즉시 반영/묶음 저장, Studio 저장 상태, 기존 좋아요·팔로우, PC↔모바일 동기화를 보호한다.
- 페이지 진입·새로고침·업데이트만으로 불필요한 반복 읽기·쓰기를 발생시키지 않는다. 변경된 항목만 처리하고, 서버 총비용과 실제 사용자 동작을 함께 판단한다. 비용 지표 하나만으로 기존 정상 기능을 제거하지 않는다.
- PREVIEW/TEST/PRODUCTION 승격은 단순 재빌드가 아니라 검증된 배포물과 환경 차이를 확인해야 한다. TEST·PRODUCTION 공유 Worker/Rules/데이터는 배포 승인과 별개로 보호한다.

## 검사·독립 검증·실사용

- 수정한 실제 경로와 연결된 소비자만 필요한 깊이로 검사한다. 작은 수정에는 작은 검사, 복구 어려운 데이터·권한·공유 Writer·구조 변경에는 집중된 독립 검증을 적용한다.
- 구현한 사람이 자기 수정을 **독립 검증**이라고 부르지 않는다. 담당 모델/에이전트를 지정하는 규칙은 두지 않는다.
- CI PASS를 배포 PASS나 PC·모바일 PASS라고 보고하지 않는다. 승인된 PREVIEW 배포 뒤 실제 실패했던 API·화면·기기 경로를 우선 확인한다.
- 실제 확인할 수 없으면 '미확인'으로 남긴다. 검증을 위해 검증을 무한 반복하지 않는다.

## 진행 보고와 다음 작업 승인

- 시작: 목표·전체 범위·보호 대상·중단 위험을 짧게 알린다. 진행 중: 실제 중요한 완료·막힘·다음 행동만 알린다. 종료: 완료/미완료, 최종 SHA(있을 때), 필수 검사, 독립 검증, 배포, PC·모바일, 위험을 간결히 구분한다.
- 오래된 Stage 이름이나 무관한 3중 진행률/근거 없는 퍼센트를 모든 보고에 강제하지 않는다.
- **현재 승인된 작업이 끝나면 다음 새 작업 하나를 제안하고 승인 전에는 시작하지 않는다.** 질문 뒤에는 가능한 환경에서 작고 둥근 실제 클릭 버튼 `YES / NO / 기타(글쓰기)`를 가로로 보여 준다. YES는 제안한 정확한 범위만 승인, NO는 중단, 기타는 사용자 새 지시를 받는다.
- 버튼을 실제로 지원하지 않는 환경에서는 가짜 클릭 버튼을 만들지 않고 제한을 설명한다. 단순 상담에는 승인 UI를 강제하지 않는다.
- 배포·병합·사용자 데이터 변경 등 별도 승인사항은 질문에 명시되지 않은 YES로 허가되었다고 해석하지 않는다.

**원칙: 실제 사용자 결과를 우선하고, 같은 지시를 반복하게 만들지 않는다.**

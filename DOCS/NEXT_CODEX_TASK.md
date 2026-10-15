## NEXT — Stage416 446 exact-SHA cross-environment safety/cost audit before preview release (2026-10-15 KST)

- **Target:** DRAFT PR #147 on `fix/stage416-mixed-track-public-correctness`; tested code `be4a0d2860f2ff8b405213fe3030f81a9635a144`, CI [38740570418 SUCCESS](https://github.com/andrawing1212/soridraw-music/actions/runs/38740570418). User independent time settings preserved.
- **Independently validate** all shared canonical `track_stats.like_count` public readers/writers (including current LIVE TEST and PRODUCTION 075/191/156/056, Explore Feed, public profile, direct API/Edge) cannot expose signed Master delta before configured public deadline, despite same D1. Direct one PREVIEW Worker code path PASS does NOT prove global secrecy.
- **Cost gate:** compare physical changed-track write count for D1 signed 069 drain + 446 journal insert + 446 due delete; quantify each statement/meta changes, ordinary R2 recovery failure/retry, D1 W2 target. Current CI is NOT a real billable-cost proof; if W2 exceeded flag with precise alternative before any deployment.
- **Durability:** signed + ordinary same/different track, 1/3/5/10/20 private/public independent timers, multiple consecutive windows same track and delayed callback/retry/CAS conflict, stale checkpoint, old queue drain, server restarts, backfill none, D1 schema compatibility, protected app410. Bounded replay only changed IDs, never full Feed.
- **Release gate:** exact independent PASS and explicit approval for additive shared D1 table migration before actual PREVIEW activation. PR #147 DRAFT until green independent audit; TEST/PROD stay unchanged. Never self-approve GitHub release guard.

---

## NEXT — Stage416 191 early-public leak fixed: focused independent audit then PREVIEW-only activation (2026-10-15 KST)

- **범위 고정:** 기존 독립 감사 FAIL 중 `repairSharedPublicLikeCounts191`가 공개 5분 보류 중 Master 숫자를 조기 노출하는 문제만. 다른 좋아요 구조/Firestore/Cloudflare 원본/Studio/UI 리팩터링 금지.
- **감사 code exact:** `142667f24a70f6c8597c9dfe7250a4072a0d1860`; 이전 FAIL code `2d2ac47970a0f1099ff53bb7b041097b3a3fe91a`; 변경 PR #140/#141/#142/#144. `preview`에는 이후 PR #145 preflight trigger `6a2024398b7dc9b7ef445d1f0f3ee9514c420ef1`만 더해짐.
- **최신 근거:** full CI Run `38723601670` SUCCESS (191 mixed guard, old 440, TS/Build); PREVIEW pinned single-Function dry preflight Run `38724015843` SUCCESS. 실제 deploy `0`, shared canonical mutation `0`.
- **독립감사 우선 검사:** (1) 실제 191 repair 3 호출 경로 모두 차단 (2) Master delayed public count 5분 조기 노출 0 (3) ordinary 075 즉시 base aggregate/공개 소실 없음 (4) Stage416 ON 전체 시간 동안 optional legacy 191 R2 repair 정지가 ordinary 데이터 정확성을 침해하는지 (5) same-track/different-track 혼합 wave + window close retry 안전 (6) page revisit D1 extra scan/write 없음 (7) Firebase 39개 보호, TEST/PROD OFF. 감사방은 코드 수정/commit/push/deploy 금지.
- **감사 PASS 시** audit SHA를 exact lock하고 GitHub repository variable `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA` 별도 관리자 승인 확인. 기존 승인된 `.deploy/stage416-preview-settle-one-function.trigger` PR/push Workflow 경로로 `audit_result=PASS;preflight_only=false` 상태의 **4 Functions 대상 1개씩** 배포하고 각 inventory no-diff 확인; PREVIEW Worker only 배포 후 Master 한 곡 실제 unlike 1회/5분 공개와 일반 좋아요 정상 동작/비용 실측. Guard 불일치/누락 시 자동 중단; 사용자 원본 데이터 변경/TEST/PROD 배포 금지.

---

## NEXT — Stage416 Master-only PREVIEW activation exact-SHA 독립 감사 후 coordinated release (2026-10-15 KST)

- **제품 감사 대상:** `2d2ac47970a0f1099ff53bb7b041097b3a3fe91a`.
- **activation infra 감사 기준:** merge `96eb9d86b7b0693ac1eb689ae6435ede7f7952aa`; current dry preflight trigger HEAD `a3a6912879c4ad894073a7cf546c07c823dbed9c`.
- **증거 Run:** `38714537395` SUCCESS, baseline 39, exact product source PASS, ordinary app410 frozen, Master exact-one unlike gate PASS, PREVIEW-only public gates PASS, signed-only delayed public / ordinary immediate PASS, TS/Build/Functions Build/app401·402 PASS, deploy 0/shared data 0.
- 감사에서 확인할 핵심: (1) ordinary client flags false 유지 (2) Master proof 외 일반 사용자 Stage416 intake 없음 (3) PREVIEW recordPrivate 서버 Master 재검증 (4) TEST/PROD public gates OFF (5) Worker signed-only changed IDs만 지연, ordinary 075/legacy 즉시 (6) one-function audited update가 target 1개만 변경하고 다른 38개 runtime policy/inventory 보호 (7) same-step env fix와 verify-444 통합이 승인 우회를 만들지 않음.
- PASS 후 actual release는 한 번에 하나씩: recordPrivateLike416 → privateLikeFinalReceipt416Candidate → stage416ReleasePublicWindowCandidate → publicLikeRelease416Candidate → PREVIEW Worker. 매 단계 기존 39 보호/target only update 확인. 반쪽 상태 실패 시 다음 단계 중단.
- 마지막 live E2E는 Master 실제 좋아요 1곡 해제 1회만 사용. 개인 하트/내 좋아요 즉시 유지, 공개 count는 약 5분 후 1회 반영, ordinary 사용자 즉시 경로 불변, 추가 전체 scan 없음 확인.
- TEST/PRODUCTION 승격 금지.

---

## NEXT — Stage416 PREVIEW public five-minute controlled Master E2E 활성화 (2026-10-15 KST)

- **현재 live 기반:** Firebase Functions 39개. public Task + public receipt 둘 다 ACTIVE/HMAC/Node22, receipt HTTP 503 HARD OFF, Task dispatch 0건.
- **고정 제품 기준:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`; 인프라 guard 기준 `dc8b055a1c4a3da0bed2c80cecb3448c71f60e0e`.
- 다음 작업은 **PREVIEW only controlled activation**. private/canonical settlement의 현재 즉시·정확 경로, app410 좋아요 동결 기준, 기존 public immediate fallback을 보호하면서 Master 제한 실험으로 public 5분 지연을 실제 검증한다.
- 활성화 후보에서 최소 확인: Functions public Task gate, public receipt gate, private-final public-five-minute gate, PREVIEW Worker public route gate가 같은 release identity로만 켜짐. 일부만 켜진 반쪽 상태 금지.
- **합격선:** 개인 하트/내 좋아요는 기존처럼 즉시·PC↔모바일 수렴. 공개 likeCount/타 사용자 표시는 약 5분 window 뒤 변경분만 반영. 전체 feed/profile scan 없음. Task retry가 중복 공개를 만들지 않음. 공개 release 1회가 O(1) 변경분 처리. 좋아요 해제도 대칭.
- **안전:** 일반 사용자 전체 활성화 전에 Master/제한 계정으로 1회 controlled E2E. 문제 시 public gates OFF로 되돌리고 private settlement는 유지. shared canonical data 삭제/백필/migration 금지.
- 활성화 제품 diff는 exact SHA 고정 후 독립 감사 1회. 같은 내용 재감사 반복 금지. PASS 시 PREVIEW coordinated Worker/Functions만 배포하고 live E2E 검증.
- Artifact Registry cleanup policy는 별도 운영 정리 항목. public 5분 기능 검증과 섞지 않음.
- TEST/PRODUCTION 승격은 사용자 별도 승인 전 금지.

---

## NEXT — Stage416 inventory eventFilters ordering fix exact-SHA 독립 감사 후 receipt PREVIEW 배포 (2026-10-15 KST)

- **제품 PASS SHA:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`.
- **새 인프라 감사 SHA:** `dc8b055a1c4a3da0bed2c80cecb3448c71f60e0e`. 실제 코드 변경은 `scripts/verify-416-public-function-inventory.mjs` 1파일; audited Workflow 자체는 `70a2a137...`과 동일.
- **배포 사건:** Run `38688103686`에서 public Task 생성 성공 후 postflight FAIL. 독립적으로 로그를 대조해 기존 private scheduler metadata는 eventFilters 배열 순서만 달랐고 updateTime/build/revision/service account/filter 값은 동일. receipt는 미배포.
- **수정 검증:** 새 helper는 eventTrigger.eventFilters 순서만 canonical sort. 값 변경/삭제/추가/다른 함수 변경은 기존 strict failure 유지. selftest에 순서 reversal PASS 및 value mutation FAIL 추가. Run `38688695998` SUCCESS, 현재 Functions baseline 38, HMAC/exact product/one-package PASS, deploy 0/shared data 0.
- **감사 핵심:** (1) eventFilters 순서를 무시하는 것이 Firebase Eventarc filter 의미상 안전한지 (2) 정렬 범위가 eventFilters에만 제한되어 build/revision/updateTime/serviceConfig/labels 등 실제 변화가 가려지지 않는지 (3) value/operator/attribute 변경은 실패하는지 (4) 이미 생성된 Task가 Run 38688103686의 exact audited product source에서 생성된 것으로 신뢰 가능한지 (5) second receipt deploy baseline 38→39에서 기존 38 보호가 성립하는지.
- **운영 보호:** preview direct push 차단 + PR 필수, approvals 0(단독 저장소), bypass 없음. Assistant connector는 Actions repository variable을 바꿀 수 없으므로 live deploy는 사용자가 별도 설정한 `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`와 trigger guard SHA가 일치해야만 진행. 이 2-party operational separation이 독립 승인으로 충분한지 감사에서 명시 판정.
- 감사 중 코드 수정/commit/push/deploy/shared-data mutation 금지. PASS 전 receipt actual deploy 금지.

---

## NEXT — Stage416 GitHub 운영 승인 설정 후 public Functions PREVIEW 2단계 배포 (2026-10-15 KST)

- 제품 exact PASS `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`; infra exact PASS `70a2a137657b5239119ce4958c1d6a5b169101d3`.
- **운영 설정 1:** GitHub Settings → Rules → Rulesets에서 preview 전용 ruleset 추가/강화. Require pull request before merging ON, Required approvals 1, Dismiss stale approvals ON, bypass 없음. 기존 release ruleset은 main/production까지 묶여 있으므로 불필요하게 수정하지 않음.
- **운영 설정 2:** Settings → Secrets and variables → Actions → Variables → repository variable `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA` = `70a2a137657b5239119ce4958c1d6a5b169101d3`. 승인되지 않은 다른 값/미설정은 Workflow fail-closed.
- 설정 확인 전 실제 deploy trigger `preflight_only=false` 금지.
- 설정 완료 후 1단계: `stage416ReleasePublicWindowCandidate`만 initial_only 최초 생성. 기존 37 Functions 전체 불변 + 신규 1개만 추가, HMAC, region us-central1, HARD OFF 확인. 실패 시 중단.
- 1단계 PASS 후 2단계: `publicLikeRelease416Candidate`만 최초 생성. 총 39 Functions, 기존 37 + Task 동일, receipt asia-northeast3, HMAC, HTTP 503/HARD OFF 확인. 실패 시 공개 5분 활성화로 넘어가지 않음.
- 이후 별도 Stage416 public 5-minute controlled Master E2E 설계/감사/활성화. TEST/PRODUCTION 승격은 금지.

---

## NEXT — Stage416 exact product-pinned public Function release infra 최종 독립 감사 (2026-10-15 KST)

- **제품 PASS SHA:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`.
- **새 인프라 감사 SHA:** `70a2a137657b5239119ce4958c1d6a5b169101d3`. 범위는 Stage416 단일 Function Workflow의 product exact pin 추가. 기반 `91e6715a...`의 external infra approval 및 unverified existing Function fail-closed를 포함.
- **실행 증거:** Task preflight Run `38678844741` SUCCESS; receipt preflight Run `38679044570` SUCCESS. 두 로그 모두 `LOCKED_ONE_FUNCTION_SOURCE=c6b29de6...`, 전체 inventory selftest PASS, live shared Firebase Functions count 37, HMAC PASS, FUNCTIONS_DEPLOY=0, SHARED_DATA_CHANGE=0.
- 독립 검증: (1) trigger가 다른 product_code_target 또는 audit_head를 넣어도 exact audited product SHA 아니면 배포 전 FAIL (2) 외부 infra approval SHA가 미설정/다르면 actual deploy FAIL (3) verify_existing 및 코드 출처 불명 기존 후보 자동 채택/재배포/삭제 금지 (4) 초기 신규 함수만 one-at-a-time, --force 없음, Firebase tools pinned, 전체 Function 불변 검사 (5) 기존 private single-function deploy modes 비회귀.
- **운영 blocker 별도:** GitHub ruleset id `22889511`은 active이나 deletion/non-fast-forward만 요구하며 Workflow 수정 reviewer/PR 승인 rule 확인되지 않음. branch protection detailed API는 connector 403. 따라서 인프라 코드 PASS와 별도로 실제 PREVIEW public deploy 전 repository Workflow 변경 승인 보호 또는 동등한 관리자 승인 장치를 GitHub Settings에서 설정/확인해야 함.
- 감사 중 코드/commit/push/배포/공유 데이터 변경 금지. 이 감사 PASS만으로 Firebase public functions live deploy나 Stage416 public ON을 승인하지 않음.

---

## NEXT — Stage416 release guard 외부 승인·출처 불명 복구 거부 후보 독립 감사 (2026-10-15 KST)

- **대상 인프라 SHA:** `91e6715a725051c9e3bbed10b46c36b08f7b3de9` (`preview`, 마지막 감사 FAIL `7142a0b8c846c59a6caa8fce779e31158a564091` → 새 후보). 코드 제품 SHA `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` 그대로.
- 체크 1: `.github/workflows/stage416-preview-settle-one-function.yml` 실제 배포에서 요청서 `release_guard_sha`를 자체 인정하지 않고 외부 GitHub Actions 변수 `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`의 exact SHA와 두 guard 파일 blob 비교가 모두 일치해야 진행. 변수 미설정·거짓 SHA·다른 코드 변경은 반드시 fail-closed.
- 체크 2: `verify_existing` 작업은 deployed source HARD OFF 출처를 증명 불가하여 **무조건 거부**. 기존 함수가 있어도 재배포/자동채택/자동삭제/성공 오판 금지. `initial_only` 신규 함수는 오직 exact one Function 및 전체 inventory 무변경 확인 후에만 PASS. 중간 실패 시 수동 판단으로 중단.
- 기존 개인 Function 모드, Firebase CLI 버전 고정, --force 없는 신규 public, HMAC binding, TEST/PRODUCTION, 사용자 데이터 보호 동작 유지 여부.
- 신규 SHA의 GitHub CI는 **미실행**(preflight trigger tool operation blocked). 이전 `38610213825` SUCCESS는 이번 SHA PASS를 보증하지 않음. 독립 감사 별도로 진행; 코드/commit/push/배포/공유 데이터 변경 금지.
- 별도 독립 감사 PASS 이후에만 GitHub 관리자 관리 repository variable에 audited SHA 설정과 새로운 preflight-only 승인 절차를 마련한다. 인증되지 않은 SHA로 실배포 금지.

---

## NEXT — Stage416 공개 Functions 안전 배포 인프라 FAIL 2건 재감사 (2026-10-15 KST)

- 제품 코드 감사 PASS 고정 `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 신규 **배포 인프라 감사 SHA `7142a0b8c846c59a6caa8fce779e31158a564091`**; 범위 `.github/workflows/stage416-preview-settle-one-function.yml` 및 `scripts/verify-416-public-function-inventory.mjs`. 감사된 제품, 기존 좋아요, 공개 5분 HARD OFF 코드 그대로 보호.
- 지난 독립 감사 `b0107938` FAIL: 전체 Functions 비변경 스냅샷이 없고 `--force`가 있었으며, 신규 Function 부분 생성 후 안전한 재확인 방식이 없었음. 신 SHA에서 신규 공개 Task/receipt 배포는 pinned firebase-tools@15.30.1, --force 없음, gen1+gen2 Firebase Functions 전체 목록 before/after read-only 비교 및 타 함수 updateTime/buildConfig/serviceConfig 불변 검증. 기존 개인 deploy modes 변화 없는지 확인.
- 최초 후보 미존재 + `initial_only`만 신규 생성 허용. 이미 있는 후보는 `verify_existing` 명시 + ACTIVE/Node22/HMAC/region/정확한 이름이면 **읽기전용 확인만**, 미검증/불완전 후보는 별도 운영자 승인 없이 자동 delete/overwrite 금지. 첫 생성 후 실패 상황 및 Task 성공·receipt 실패 상황에서 부분 배포를 SUCCESS로 오판하지 않고 다음 생성 중단하는지 확인.
- 제품 SHA의 `preflight_only=false` trigger에서 exact infra guard SHA 및 `release_guard_audit=PASS`가 승인된 workflow+helper blob과 동일하지 않으면 배포 전에 차단되는지 검사. 인프라/제품 SHA 구분 유지, 기존 shared RTDB/D1/Rules/Hosting/Worker main/PROD 변경 금지.
- 개발 preflight: `38609229247` SUCCESS, read-only real Firebase function count 37; 이후 YAML 중복 삽입 오류 `38609677383`, `38609921779` FAIL(jobs 0, 실제 배포 0) 수정 완료. 최종 preflight Run `38610213825`은 job **SUCCESS**, 최상위 Run **completed/SUCCESS** 최종 확인. CI 결과 재확인 후 감사 PASS/FAIL.
- 독립 감사 중 코드 수정/commit/push/배포/공유데이터 변경 금지. 실제 공개 함수 2개 배포나 Stage416 PUBLIC ON 승인으로 해석하지 말 것.

---

## NEXT — Stage416 PREVIEW 공개 Functions 2개만 배포할 고정 workflow 독립 감사 (2026-10-15 KST)

- **제품 exact SHA:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` — 사용자 전달 별도 GPT-6 감사 PASS. 제품 코드 다시 수정하거나 공통 public gate ON 금지.
- **신규 감사 대상 배포 인프라 SHA:** `b01079382d56724d5c2cf6f5561bb0e8718b6254`. `preview` HEAD는 dry preflight trigger/후속 문서 commit을 포함하므로 제품과 인프라를 **각각 SHA로 고정**. 변경 파일 `.github/workflows/stage416-preview-settle-one-function.yml` 단 하나.
- **실행 증거:** PREVIEW Task dry preflight Run `38605790524` SUCCESS, PREVIEW receipt dry preflight Run `38606075258` SUCCESS. 두 로그에 `STAGE416_ENV_INDEPENDENT_SINGLE_FUNCTION_EXPORT=PASS`, `416_PUBLIC_NEW_FUNCTION_AND_HMAC_PREFLIGHT=PASS`, `STAGE416_SINGLE_FUNCTION_PREFLIGHT_ONLY=PASS;FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0` 증명.
- **필수 독립 검사:** (1) 기존 private 2개 single function 배포 workflow 회귀·allowlist 유지 (2) public Task/receipt 각 deploy isolated Firebase source module/단일 export만 있고 추가 함수 삭제/변경 없음 (3) `audit_head`/PASS/false gates/pinned product checkout/preview-only trigger 검증 (4) 사전 gcloud 404가 실제 missing 후보임을 확인; 기존 함수를 덮어쓰지 않는지 (5) `preflight_only` 실제 deploy 차단과 TEST/PROD, shared DB/Rules/Worker/Hosting 비변경 보호 (6) region Task us-central1/receipt asia-northeast3, secret binding, Cloud Tasks 비용/25회 retry 위험 (7) 최초 함수 생성 중 실패 시 partial release 취급하고 추가 승격 중단, postflight 실제 `503` 또는 미호출을 확인할 경로/rollback 계획 (8) CI PASS와 live 배포를 혼동하지 않음.
- **감사방에서는 코드 수정, commit/push, 배포, 공유 데이터 변경 금지.** PASS 전 실제 Firebase Function 생성 금지. PASS면 개발방에서 기존 trigger `preflight_only=false`로 각각 한 번씩 실행, 2개만 정확히 생성/활성 확인하고 실제 public mode는 HARD OFF 유지. TASK/receipt 중 하나라도 실패하면 다음 트리거를 중단, 비용/상태 검증과 rollback 먼저.
- **비용·안전:** 앱 좋아요·팔로우/UI/캐시/개인 5초 집계 비변경, 공유 D1/RTDB/R2 migration/backfill/delete 금지, 사용자 테스트는 이후 Master 단일 계정 통제 활성화 검증 단계에서 진행.

---

## NEXT — Stage416 2/4 PREVIEW 공개 Functions export 후보 exact-SHA 독립 감사 (2026-10-15 KST)

- **새 감사 제품 SHA:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` (`preview`의 doc-only 후속 commit은 제외). 이전 감사 PASS `3b5c4426c1e27df725a43d04df6ec591227161d3` 위에 공개 서버 wiring 4개 소스만 변경.
- `AGENTS.md`, `CURRENT_RELEASE_STATE.md`, `NEXT_CODEX_TASK.md`, `WORK_AUDIT_CHECKLIST.md`, `WORKFLOW_GUARDRAILS.md`, `local-first-like-sync` 동결 기준 확인 후 실제 제품 SHA 고정. **감사방은 코드/commit/push/배포/공유 데이터 변경 금지.**
- 검증: (1) `functions/src/index.ts` public preview export 2개만 추가되고 TEST/PROD 공개 export 없음. (2) 공개 Task의 OFF guard는 유효 Task 처리/Worker HTTP 이전, 공개 receipt의 OFF guard는 shared DB 참조/RTDB publish 이전에 적용. (3) private final과 Worker 공개 gate 및 client Stage416 OFF 유지. (4) verify-439의 실제 export된 Handler 오류주입 검사가 우회 불가이며 503/no IO; 정상 공개 인증/HMAC/마감 재시도 계약 기존 보존. (5) 기존 Stage416 5,000곡 crash rollback/next window, 개인 canonical, PC/모바일 like, follow/publication, cost regression 및 한 번의 변경으로 전체 feed scan 없는지 확인.
- **CI:** exact SHA `38602592906` SUCCESS, PREVIEW backend read-only `38602592934` SUCCESS, Gemini audit `38602592785` SUCCESS. CI가 live E2E를 대신하지 않는다.
- **배포 gate:** 독립 감사 PASS 전 배포 금지; PASS 후에도 Functions Task+receipt export만으로 공개 5분 실사용이 켜지는 것이 아님. 기존 `stage416-preview-backend-release.yml` private prerequisites 재실행 및 임의 Workflow 수정/신설 금지. 최소 범위 PREVIEW candidate deploy와 Master 제한 데이터 안전·rollbacks 검증을 거친 후 controlled 5분 live E2E 진행. 어떤 환경에서도 전역 Stage416 ON으로 일반 사용자 하트/공개 숫자를 시험하지 않는다.
- Main/TEST/PRODUCTION, shared D1/RTDB/R2/schema, Hosting/UI, Rules, backfill/delete unchanged.

---

## NEXT — Stage416 2/4 Worker PREVIEW 배포 PASS 이후 공개 5분 통제 실환경 연결 (2026-10-15 KST)

- **직전 완료:** 독립 코드 감사 PASS `3b5c4426c1e27df725a43d04df6ec591227161d3`; PREVIEW Worker release Run `38601331638` SUCCESS, version `2e5afeee-c0f6-456e-875e-095d29a6a43c`. 첫 Run `38600852443`은 profile-tracks curl56으로 FAIL 후 자동 rollback, 동일 source 단 한 번 재시도에서 full smoke PASS.
- **남은 blocker:** public 5-minute Worker gate는 source hard OFF, 공개 Functions `stage416ReleasePublicWindowCandidate` / `publicLikeRelease416Candidate`는 `functions/src/index.ts` export 및 runtime 배포 연결 전. 신규 공개 5분 Master 통제 E2E는 **불가능/미검증**. 일반 사용자 gate ON 금지.
- **다음 작업 범위:** 공개 이벤트/5분 발표 기능을 Master 통제 검증할 최소 서버 release plan 및 호환성 설계: 안전한 Master 한정 실험 계정/feature flag, 본래 shared user-data 및 앱 하트 보호, Functions Task/receipt HMAC/Cloud Tasks binding preflight, Worker route flag/rollback, R2 manifest/RTDB Rules 호환. 반드시 감사된 기존 private canonical 경로 보호.
- **순서:** PREVIEW source 후보 최소 변경→실제/모의 테스트·TypeScript/Build·비용 회귀→신규 exact SHA 독립 감사→통제 PREVIEW Function/Worker 배포→Master controlled 공개 5분 E2E·Cloudflare 알람·PC↔모바일 결과·비용 측정. 변경 없는 Hosting/Rules/D1 schema 재배포 금지.
- **주의:** 이번 Worker 배포는 OFF source-only 검증, 기능 활성화 승인 아님. 10만 사용자 전체 읽기/쓰기, data migration, backfill/delete, TEST/PRODUCTION 변경 금지. 다른 실패 시 반복 재배포하지 말고 별도 원인 분석.

---

## NEXT — Stage416 2/4 독립 감사 PASS 후 PREVIEW 통제 배포 범위 확정 (2026-10-15 KST)

- **코드 감사 PASS 고정 SHA:** `3b5c4426c1e27df725a43d04df6ec591227161d3`. 별도 문서 commit은 제품 감사 코드를 변경하지 않는다. 이전 FAIL 후보인 `f580c36a...`, `61a33fdf...` 재사용 금지.
- 우선 **읽기 전용 배포 준비**: `AGENTS.md` / `CURRENT_RELEASE_STATE.md` / `WORKFLOW_GUARDRAILS.md` / `WORK_AUDIT_CHECKLIST.md` 및 `DOCS/STAGE416_PUBLIC_5MIN_IMPLEMENTATION_PLAN.md`를 확인하고 PREVIEW 실제 Worker/Functions 배포 identity, 공유 DB binding, HMAC secret/Cloud Tasks, RTDB 규칙, rollback 타겟을 검증한다.
- 실제 구조 blocker: public Worker flag `STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false`; public release / task Functions는 `functions/src/index.ts`에서 export되지 않음. 그러므로 **지금 코드만 PREVIEW에 올려도 공개 5분 집계가 작동했다는 뜻이 아니다**. 기존 private prerequisites Workflow `.github/workflows/stage416-preview-backend-release.yml`은 공유 RTDB/D1 관련 단계를 포함하므로 이번에 바로 재실행하지 않는다.
- 변경 없는 서비스 재배포 금지. Public 기능 ON·Master-only 통제 test gating 및 배포용 최소 연결 수정이 필요하면 별도 후보 commit과 targeted QA → 새 exact SHA 독립 감사 → 안전 PREVIEW 배포 순서를 유지한다. 원본 데이터 migration/backfill/delete/복제·공유 D1 schema 변경은 별도 승인 없이는 금지.
- PREVIEW 배포 뒤 Master 통제 실제 5분 E2E(개인 settlement 선행, 5분 동안 공개 숫자 조기 노출 0, due 변경 ID 발표, 오류/알람 복구, PC↔모바일 같은 결과, D1 R/W 및 R2/RTDB/DO 실제 비용)를 수행하고 사용자 실사용 검증 전에는 TEST 승격 금지.
- **금지:** 별도 조건 확인 없이 공개 기능 일반 사용자 ON, 기존 정상 개인 하트/팔로우 변경, 대량 조회·쓰기, main/production 변경. 배포 요청 없는 경우 코드를 임의 배포하지 않으며, GitHub push를 배포 완료로 보고하지 않는다.
- 검증 근거: GitHub Run `38594672253`, `38594672463`, `38594673140` SUCCESS; 독립 감사 보고는 사용자 전달 2026-10-15 KST PASS. 실 Cloudflare alarm/공개 5분 live/실과금 미검증.

---

## NEXT — Stage416 2/4 공개 창 조회 실패 fail-closed 제품 SHA 독립 재감사만 (2026-10-15 KST)

- **독립 감사 대상:** `3b5c4426c1e27df725a43d04df6ec591227161d3` (`preview` 제품 commit; 그 이후 문서 commit은 코드 감사에서 제외). 이전 `f580c36a670e56559590ad36efe115cd5dc4bf41` 후보는 새 FAIL 위험이 남았던 과거 기준.
- 시작 시 `AGENTS.md` → `CURRENT_RELEASE_STATE.md` → `NEXT_CODEX_TASK.md` → `WORK_AUDIT_CHECKLIST.md` → `WORKFLOW_GUARDRAILS.md` 및 좋아요 동결 기준을 읽고 실제 제품 SHA를 고정한다.
- **최우선 재감사:** 공개 Stage416 gate ON에서 `ctx.storage.get(PUBLIC_LIKE_WINDOW_KEY_416)` 예외가 발생하면 canonical D1 집계/R2 공개 projection/191 repair가 모두 실행 전 차단되는지, 기존 `/schedule` 및 `alarm()`의 오류 전파와 fallback 재시도로 대기 곡·알람을 보존하는지.
- 정상 빈 창 `null`, 기존 공개 창 존재, Stage416 첫 signed changed wave pending, 공개 기능 OFF 시 기존 동작과 read 0 유지. `verify-440`의 실제 Worker method 추출·오류 주입 검사가 별도 문자열 PASS만이 아닌지 확인한다.
- 과거 감사 FAIL 2건 PUBLISHED 후 5,000곡 부분 삭제 복구·만료 직후 5,500 next 변경곡 보존도 현 exact SHA에서 유지되는지 확인. `verify-442`/`verify-443`은 이번 CI 포함으로 오인하지 말고 가능한 독립 재실행 또는 미검증으로 명확히 표시.
- 앱 개인 5초/1분 정산·app410 PC↔모바일 하트, legacy/127/175/178/191/192/197/390, 팔로우·공개·검색·프로필, R0 캐시, D1 public release W0, full scan 없음, 변경 데이터 전용 처리와 전체 비용 변동 여부 확인.
- **제품 CI:** Run `38594672253` SUCCESS, `38594672463` SUCCESS, `38594673140` SUCCESS. 이 CI PASS를 독립 감사 또는 실서비스 PASS와 혼동하지 않는다.
- **절대 금지:** 독립 감사 중 코드/문서 수정, commit/push, Firebase/Cloudflare/Rules 배포, Stage416 일반 사용자 ON, 공유 D1/RTDB/R2 실데이터 변경, migration/backfill/delete, `main`/TEST/PRODUCTION 변경.
- **PASS 후에만:** 감사한 제품 SHA 기준 PREVIEW coordinated 배포 가능 여부를 별도로 판정하고 사용자 Master 통제 5분 실사용 검증을 진행한다.

---

## NEXT — Stage416 2/4 감사 FAIL 2건 복구본 exact-SHA 독립 재감사 (2026-10-15 KST)

- **감사 제품 SHA:** `f580c36a670e56559590ad36efe115cd5dc4bf41`. 시작 기준 `12460ac140f3c28bad07899ea80acba8b01a8479` 대비 제품 4개·테스트 12개 변경이며 별도 문서 commit은 제품 감사 대상에서 제외한다.
- 이전 제품 `61a33fdf76257de6fd0339cdabf7c09c75cc184c`의 독립 감사 FAIL 두 건에 대한 수정 후보다. 과거 후보의 PASS/CI 또는 아래 역사적 NEXT 지시로 현재 대상을 대체하지 않는다.
- **다음 작업은 감사만:** `AGENTS.md` → `CURRENT_RELEASE_STATE.md` → 이 문서 → `WORK_AUDIT_CHECKLIST.md` → `WORKFLOW_GUARDRAILS.md` → local-first-like-sync 보호 기준을 읽고 실제 GitHub exact SHA를 고정한다. 새 기능·수정·배포·공유 데이터 변경 금지.
- **필수 재감사:**
  1. 최초 frozen claim/manifest/releaseToken이 RTDB 전 durable checkpoint에 기록되고, PUBLISHED 응답 유실·부분 삭제 후에도 동일 identity로 복구되는지. 축소 목록 재claim 금지, same-token 변경 claim 거부, duplicate RTDB changed-write 0.
  2. 5,000곡의 1,000행 단위 모든 삭제 중단점 및 PUBLISHED 직후 중단을 실제 남은 storage로 재실행. event alias까지 회수되고 checkpoint가 마지막 atomic transition까지 남는지.
  3. 마감 -1ms·정각·이후의 join, snapshot 후 canonical 변경, 동시 release/join. expired/sealed 창에 들어가지 않고 next unique-track 저장소/새 창으로 모두 이동하는지. 기존 deadline 연장 없음, net-zero 최종 공개 count 정확성.
  4. 5,500 next IDs와 마지막 transaction rollback에서도 누락 0인지. 다음 창이 열릴 때 고정 deadline을 갖고 durable alarm이 존재하는지. canonical drain await 중 이전 창 clear와의 경합도 확인.
  5. verify-442와 verify-443 실행. 후자는 실제 workerd SQLite 저장소 유지/restart 및 scheduler alarm delivery를 검증하며 npm Miniflare 설치·실행 명령은 CURRENT의 최신 항목에 있다. fake adapter는 로컬 RTDB/canonical에만 사용하며 live 데이터에 접속하지 않는다.
  6. verify-439 정적 검사가 실제 현재 구조를 검사하는지, verify-442의 STALE_TASK wrong-ID/wrong-deadline 실행형 경로에서 D1/R2/RTDB 접근 0인지.
  7. 정상 private 1분/기존 5초 canonical/receipt, app410 하트·PC↔모바일, 127/175/178/191/192/197/390, follow/publication, Music Note/Library/Studio 저장하트 및 정상 캐시 R0 보호.
  8. 공유 단일 DO alarm의 private/public 일정 공존, public gate OFF 시 기존 실행 흐름 불변, transaction API와 value/put/delete 제한 준수. 407/411 fixture 수정이 제품 gate를 우회하지 않는지. 400/404/406의 역사적 source guard 보정이 membership/track_stats 반환 및 receipt 전달 계약을 정확히 구분하는지.
  9. 공개 D1 W0, 변경 ID만 처리, bounded checkpoint/rolling manifest 및 완료 후 수거, client entry/update/re-entry 추가 IO 0. 실제 과금 수치와 로컬 mock IO 카운트는 구분.
- **개발 검증:** Stage416 45개 + local worker compatibility + 실제 workerd, 기존 보호검사, App TypeScript/Build, Functions TypeScript PASS. 상세 범위·한계는 CURRENT 최신 항목 참조. 추가 Rules emulator는 환경 다운로드 차단으로 미실행; 배포/실기기 검증도 미실행이며 PASS로 간주하지 않는다.
- **금지:** 감사 중 코드/문서 수정·commit/push, Firebase/Cloudflare/Rules 배포, Stage416 일반 사용자 ON, 공유 D1/RTDB/R2 쓰기, migration/backfill/delete/강제 캐시 초기화, main/TEST/PRODUCTION 변경.
- **PASS 이후:** 감사한 exact 제품 SHA에 대한 필요한 PREVIEW coordinated release와 controlled 실검증 계획을 별도 단계로 판단한다. 이 인계 자체는 배포 또는 공개 기능 ON 승인이 아니다.

---

## NEXT — Stage416 2/4 public 5-minute source candidate exact-SHA 독립 감사만 (2026-10-14 KST)

- **감사 대상 product SHA:** `61a33fdf76257de6fd0339cdabf7c09c75cc184c` (문서 commit은 제외하고 제품 코드 exact SHA 고정).
- 새 기능 추가/배포 금지. `DOCS/WORK_AUDIT_CHECKLIST.md` 기준으로 독립 감사만 진행한다.
- 반드시 별도로 확인:
  1) 기존 5초 private canonical settlement/receipt가 public 5분 때문에 지연·변경되지 않는지.
  2) Stage416 signed canonical wave에서 실제 net `delta != 0` changed ID만 수집하며, ID 회수 때문에 추가 D1 SELECT/query가 생기지 않는지.
  3) 첫 changed wave가 final/public registration보다 먼저 settle돼도 pending-open에서 exact IDs 유실 0인지.
  4) open window 중 legacy + Stage416 changed IDs가 같은 fixed deadline에 합쳐지고 4:59 추가 이벤트가 deadline을 연장하지 않는지.
  5) due 전 shared Feed/profile/card/publicSync 숫자가 191 repair나 client 192 write로 조기 노출되지 않는지.
  6) due release 순서가 **R2 projection 완료 → signed Firebase RTDB publish ACK → DO window clear**인지. 실패/재시도에서 window 유실·중복 publish 없음인지.
  7) >256 changed IDs의 rolling R2 manifest가 exact하고 bounded(8 slots)인지, client는 visible-ID intersection만 수행하고 D1 R0/W0인지.
  8) >1000 / 5,000 changed IDs에서 DO list truncation, pending 4096 cap, partial clear가 없는지.
  9) search/genre/profile/feed가 shared track-card authority를 통해 동일 likeCount로 보이는지, first40/80을 changed source로 사용하지 않는지.
  10) app410~416, 127/175/178/191/192/197/390, publication/follow/My Likes/cross-device 경로 비회귀.
  11) page/update/re-entry 신규 server IO 0, public release D1 write 0, duplicate release W0 계약 유지.
- 자동검증 기준: Quality Run `38568344287` SUCCESS. 단, 기존 CI PASS에 의존하지 말고 구현 경로를 독립적으로 다시 확인한다.
- **금지:** 코드 수정, commit, push, Firebase/Cloudflare 배포, shared D1/RTDB/R2 변경, migration/backfill/delete, main/TEST/PRODUCTION 변경.
- 감사 PASS 뒤에만 PREVIEW Worker/Functions의 필요한 범위 coordinated release와 Master controlled 5분 실검증 계획을 작성한다. 일반 client ON은 그 이후 별도 승인 단계.

---

## NEXT — Stage416 2/4: 공개 5분 공동 집계 구조 감사·최소 구현 설계 (2026-10-14 KST)

- 사용자 추가 실기기 클릭 불필요. 먼저 현재 코드/Worker/D1/R2의 public 5-minute coalescing 경로를 독립적으로 감사한다.
- 반드시 확인:
  1) 개인 1분 final settlement 여러 건을 동일 track 기준 5분 public window로 합칠 수 있는지.
  2) like/unlike 최종 상태가 서로 상쇄될 때 public canonical count를 잘못 증감하지 않는지.
  3) 한 track 변화 때문에 Feed/popular/profile 전체 scan/rebuild가 없는지.
  4) public changed-track publish가 R2/RTDB changed-item only인지.
  5) D1 rows-written W1~W2 목표, duplicate/replay W0, pending069 bounded인지.
  6) public 5분 동안 개인 heart는 이미 final 상태로 유지되고, 다른 사용자 공개 count만 5분 경계에서 갱신되는지.
  7) app410~416 개인 membership/PC↔mobile, 기존 public count, publication/follow 경로 비회귀.
- 구현 전 `scripts/verify-416-public-coalescing-gap.mjs`, Worker `like-private-finalize-416` / public bus / 069 drain 경로와 기존 192/191 공개 count 보호 검사를 기준으로 gap을 정확히 확정.
- 새 schema/migration/backfill/delete 금지. 기존 additive 구조로 불가능하면 먼저 보고.
- PREVIEW에서만 개발. TEST/PRODUCTION 변경 금지. 큰 코드 변경 후 exact SHA 고정 → 독립 감사 → PREVIEW controlled 실사용 순서.

---

## NEXT — 배포 후 fresh controlled operation 1회로 first-settle 재검증 (2026-10-14 KST)

- 추가 코드 수정/재배포 금지.
- 현재 PC 브라우저에는 **배포 전 accepted operation의 diagnostic local proof**가 남아 있을 수 있으므로 그 operation 재시도는 새 settlement 검증이 아니다.
- 가장 안전한 fresh 검증 방법: 같은 Master 계정으로 **다른 브라우저 프로필/시크릿 창 또는 다른 기기**의 PREVIEW에 로그인 → 관리자 진단 ON → `Stage416 서버 1회 검증`을 정확히 1회 클릭. 새 deviceId라 기존 local proof를 건드리지 않고 fresh operation을 만든다.
- ACCEPTED/version 확인 후 약 90초 대기. 추가 클릭 금지.
- 개발방은 read-only diagnostic으로 **fresh Callable 200 → Scheduler → 첫 Settle HTTP 2xx (500 없음) → Worker/D1 acceptance → pending069 0 → final receipt 200**을 확인한다.
- 첫 settle에서 `416_GLOBAL_SETTLEMENT_STATE_CORRUPT` 또는 `416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE`가 다시 나오면 즉시 FAIL, 일반 Stage416 ON 금지.
- PASS 전 TEST/PRODUCTION 승격, public 5분 후속 활성화 금지.

---

## NEXT — PREVIEW stale controlled proof 1회 retire → fresh controlled proof 1회 → 90초 settlement 확인 (2026-10-14 KST)

- 사용자:
  1) `preview.soridraw.com` hard refresh 1회.
  2) 현재 보이는 `같은 1회 검증 재시도` 버튼 1회 클릭. 이 첫 클릭은 stale local diagnostic proof 정리용.
  3) 버튼이 `Stage416 서버 1회 검증`으로 바뀌면 그 버튼을 1회 클릭해 fresh operation 생성.
  4) `서버 접수 승인 · version ...`이 나오면 90초 대기.
- fresh click이 다시 STALE이면 중단하고 추가 클릭 금지; device sequence drift 별도 진단.
- 개발방은 fresh accepted 이후 read-only로 scheduler→settle→Worker/D1/R2→final ACK→settled proof를 확인.
- PASS 전 일반 Stage416 ON / TEST·PRODUCTION 승격 / 공개 5분 공동집계 활성화 금지.

---

## NEXT — 같은 controlled operation 1회 재시도 후 90초 settlement 확인 (2026-10-14 KST)

- 새 코드 수정 금지.
- 사용자: 현재 PREVIEW 관리자 진단 화면에서 `같은 1회 검증 재시도`를 정확히 1회 클릭. 페이지/캐시를 강제 초기화하지 말고 기존 local outbox operation을 그대로 사용.
- 첫 응답이 `CALLABLE_INTERNAL`이면 즉시 중단하고 보고. accepted/receipt/version이 나오면 약 90초 대기.
- 이후 개발방은 read-only 로그/D1/queue 상태로 동일 operation의 scheduler→settle→canonical acceptance→pending069 0→final ACK를 확인.
- PASS 전 일반 Stage416 ON, TEST/PRODUCTION 승격, public 5분 후속 활성화 금지.

---

## NEXT — PREVIEW Master controlled 1회 실사용 검증만 (2026-10-14 KST)

- 새 코드 수정/일반 client 활성화 금지. 현재 PREVIEW backend가 실제 서비스에서 Issue118 보완까지 포함해 끝까지 정산되는지 1회만 확인한다.
- **사용자 작업 1회:** `preview.soridraw.com`에서 Master 계정 → 관리자 진단의 **Stage416 서버 1회 검증** 버튼. 캐시 진단 표시가 OFF면 먼저 ON. 이미 좋아요된 실제 곡 1개를 같은 `liked=true`로 검증하므로 UI상 좋아요를 새로 누르지 않는다.
- **검증 후 대기:** live private timing이 1분이므로 버튼 성공 응답 후 약 90초 이상 기다린다.
- **개발방 후속:** 사용자가 버튼 결과만 알려주면 즉시 read-only diagnostic 실행하여 server accepted, window/task, Worker/D1 acceptance, final ACK, exact settled proof 회복 가능성을 확인한다. UID/track/op 원문은 로그에 노출하지 않는다.
- **합격 기준:** 1회 operation이 중복 생성 없이 canonical settlement 1회로 끝나고, D1 pending069 0, private final ACK 완료, 일반 app410/app416 좋아요/하트/숫자 회귀 없음. settled proof는 기존 global settlement W1에 포함되어 추가 changed write 0 모델 유지.
- **금지:** 전체 Feed/profile scan, shared data 강제 수정, backfill/migration/delete, 일반 사용자 Stage416 ON, TEST/PRODUCTION 승격.
- controlled PASS 뒤에만 PREVIEW 일반 Stage416 활성화 여부와 공개 5분 공동집계 다음 작업을 판단한다.

---

## NEXT — PR #120 exact settled-operation proof 보완본 독립 재감사만 진행 (2026-10-14 KST)

- 새 구현 금지. `gpt56/stage416-lost-click-fix` latest exact HEAD만 독립 감사한다.
- **필수 핵심 재현:** `seq1 accepted → client response lost → server Worker/D1/R2 final settlement → env seal ACK/cleanup → same operationId seq1 retry → exact canonical settlement proof 확인 → seq1 complete → seq2 different track accepted`.
- 반드시 확인:
  1) `SETTLED_DUPLICATE_CONFIRMED`은 global server-owned `settledDevices[deviceId]` exact identity가 모두 일치할 때만 가능한지.
  2) settled proof는 Worker canonical receipt 성공 이전에는 절대 기록되지 않는지.
  3) generic `STALE_OR_DUPLICATE`를 성공으로 승격하지 않는지.
  4) settled proof 기록이 기존 `settledVersion` transaction에 합쳐져 completed-window changed write 수를 늘리지 않는지.
  5) proof가 device별 latest 1개/최대 32로 bounded인지, unbounded operation history가 없는지.
  6) same-device seq ordering / no-retry orphan lease / existing-device rollback / cross-env settlement ordering / PRIOR_WINDOW_NEEDS_SEAL 기존 PASS를 유지하는지.
  7) app410~416, 127/175/178/191/192/197/390/412/413/414 보호 경로와 public count/My Likes authority가 변하지 않는지.
- 비용 합격선: accepted W2 유지, env-proven duplicate W0, settled-proof duplicate changed-write W0, orphan recovery W1 max, settlement bounded read 3/attempt, page/update/re-entry IO 0.
- PASS 전 PR merge, client Stage416 ON, PREVIEW Functions activation/deploy, 공개 5분 공동집계 후속 구현, TEST/PRODUCTION 승격 금지.
- shared data 변경, D1/R2 schema migration/backfill/delete, destructive 작업 금지.

---

## NEXT — PR #120 same-device ambiguous seq 보완본 독립 재감사만 진행 (2026-10-14 KST)

- 현재 새 구현 금지. `gpt56/stage416-lost-click-fix` **latest exact HEAD만 독립 감사**한다.
- 필수 핵심 재현:
  1) same device seq1=A different track global reservation/network ambiguous
  2) seq2=B already durable local outbox
  3) 첫 drain에서 seq2 network send=0
  4) recovery에서 same operationId seq1 재시도
  5) seq1 ACCEPTED/DUPLICATE_CONFIRMED 뒤 seq2 전송
  6) A/B 둘 다 최종 보존
- 반드시 확인:
  1) ambiguous error catch가 다음 row로 continue하지 않고 drain을 중단하는지.
  2) Web Lock + durable sequence sort + ordered helper가 multi-tab에서도 동일하게 적용되는지.
  3) STALE_OR_DUPLICATE를 terminal rejection으로 오인하지 않는지.
  4) DEVICE_LIMIT/TRACK_LIMIT만 명시적 terminal rejection으로 처리하고, exact outbox rejection이 durable하게 기록/제거되기 전 seq N+1이 전송되지 않는지.
  5) terminal rollback이 My Likes membership authority, public likeCount, app410 retained repair를 침범하지 않는지.
  6) prior orphan lease 120s/no-retry cleanup, cross-env ordering, rejection rollback, PRIOR_WINDOW_NEEDS_SEAL 기존 PASS를 유지하는지.
- 비용/회귀: accepted W2, exact proven duplicate W0, ordering fix page/update/re-entry IO 0, orphan cleanup W1 max, settlement bounded read 3/attempt, app410~416 및 127/175/178/191/192/197/390/412/413/414 보호.
- PASS 전 PR merge, client Stage416 ON, PREVIEW Functions activation/deploy, 공개 5분 공동집계 후속 구현, TEST/PRODUCTION 승격 금지.
- shared data 변경, D1/R2 schema migration/backfill/delete, destructive 작업 금지.

---

## NEXT — PR #120 global-only orphan lease 보완본 독립 재감사만 진행 (2026-10-14 KST)

- 현재 새 구현 금지. `gpt56/stage416-lost-click-fix`의 **latest exact HEAD만 독립 감사**한다.
- 필수 핵심 시나리오: **A global v101 reservation → Functions 종료 → A retry 없음 → B higher accepted/sealed → v101 lease 만료 전 B block → lease 만료 후 3환경에 A materialization 없음 확인 → exact orphan cleanup → B Worker/D1/R2 settlement 성공**.
- 반드시 확인:
  1) Callable 60s < reservation lease 120s라 살아 있는 old invocation이 lease 뒤늦게 지나서 stale v101을 materialize할 수 없는지.
  2) actual pending/sealed로 materialized된 lower row는 global row-version이 아니라 environment batch revision으로 ordering되고 false blocker가 되지 않는지.
  3) real lower peer batch revision은 여전히 higher settlement를 막는지.
  4) cleanup과 same-operation retry 경쟁 시 refreshed lease를 보고 cleanup이 삭제를 포기하는지.
  5) environment-proven exact duplicate가 lease refresh write 없이 W0인지.
  6) existing-device orphan은 predecessor 복원, new-device orphan은 exact slot만 제거되는지.
  7) `PRIOR_WINDOW_NEEDS_SEAL`, same-device multi-track order, cross-env 100→101 ordering, app410~416, 127/175/178/191/192/197/390 보호.
  8) previous candidate의 no-lease epoch reservation legacy grace와 ambiguous legacy non-destructive behavior가 안전한지.
- 비용 합격선: accepted W2 유지, exact proven duplicate W0, orphan recovery changed write max W1/UID recovery, settlement bounded read 3/attempt, page/update/re-entry IO 0.
- PASS 전 PR merge, client Stage416 ON, PREVIEW Functions activation/deploy, 공개 5분 집계 후속 구현, TEST/PRODUCTION 승격 금지.
- shared data 변경, schema migration/backfill/delete, D1 destructive 작업 금지.

---

## NEXT — PR #120 interrupted-new-device retry cleanup 보완본 독립 재감사만 진행 (2026-10-14 KST)

- 현재 새 기능 구현 금지. `gpt56/stage416-lost-click-fix` 최신 exact HEAD만 독립 재감사한다.
- 필수 재현: **신규 기기 A v101 예약 → env 저장 전 Functions 중단 → 동일 operationId 재시도 → env TRACK_LIMIT 거절 → exact v101 예약 정리 → 다른 기기 B v102 접수 → B Worker/D1/R2 최종 정산 성공**.
- cleanup 판단이 현재 호출의 `reservationCreatedDevice` 값에 의존하지 않고 global exact reservation의 `previous:null` / predecessor metadata와 `settledVersion`으로 안전하게 제한되는지 확인.
- 이미 canonical 정산된 exact version(`allocatedVersion <= settledVersion`)은 stale 재시도로 cleanup/rollback되지 않는지 확인.
- 기존 기기 rejection은 predecessor snapshot으로 복원되고, 신규 기기는 exact unsettled slot만 삭제되는지 확인.
- `PRIOR_WINDOW_NEEDS_SEAL` reservation은 절대 cleanup하지 않고 same-operation retry를 유지하는지 확인.
- 비용/회귀: accepted W2, proven duplicate W0, rejection cleanup W1 최대 1회, settlement bounded read 3/attempt, page/update/re-entry IO 0, app410~416 및 127/175/178/191/192/197/390 보호.
- PASS 전 PR merge, client Stage416 ON, 개인 1분 일반 사용자 활성화, 공개 공동집계 구현, Worker 비용 감사, 팔로우 작업 시작 금지.
- Firebase/Cloudflare 배포, shared data 변경, D1 schema/migration/backfill/delete 금지.

---

## NEXT — PR #120 거절된 기존기기 reservation 보완본 독립 재감사만 진행 (2026-10-14 KST)

- 현재 새 기능 구현 금지. `gpt56/stage416-lost-click-fix` 최신 HEAD의 **기존기기 rejection rollback**만 독립 재감사한다.
- 필수 재현: 기존 기기 A v100 → A 새 클릭 v101 예약 → env `TRACK_LIMIT` 거절 → global A가 v100으로 정확히 복원 → 다른 기기 B v102 정상 접수 → B Worker/D1/R2 최종 정산 성공.
- `DEVICE_LIMIT / STALE_OR_DUPLICATE` exact rejection도 신규기기 slot 삭제 / 기존기기 predecessor 복원 규칙이 동일하게 안전한지 확인.
- `PRIOR_WINDOW_NEEDS_SEAL` reservation은 절대 rollback하지 않고 same-operation retry가 유지되는지 확인.
- global high-water는 거절 번호를 재사용하지 않고 monotonic 증가를 유지하되, rejected gap 자체가 settlement blocker로 남지 않는지 확인.
- 비용/회귀: accepted click W2 비변경, rejected rollback W1 최대 1회, settlement bounded read 3/attempt, page/update/re-entry IO 0, app410~416 및 127/175/178/191/192/197/390 보호.
- PASS 전 PR merge, client Stage416 ON, 개인 1분 일반 사용자 활성화, 공개 공동집계 구현, Worker 비용 감사, 팔로우 작업 시작 금지.
- Firebase/Cloudflare 배포, shared data 변경, D1 schema/migration/backfill/delete 금지.

---

## NEXT — Issue #118 corrected candidate 독립 재감사만 진행 (2026-10-14 KST)

- 새 기능 구현을 멈추고 `gpt56/stage416-lost-click-fix` 최종 candidate만 재감사한다.
- 재감사 필수 1: A v100 예약 → B v101 예약·저장 → A 지연 저장에서 A click 유실 0, same operationId 유지, duplicate 오인 0.
- 재감사 필수 2: 서로 다른 환경에서 v100/v101 finalization이 역순 시도되어도 Worker/D1/R2 실제 전달은 v100 → v101 순서만 허용되는지.
- 재감사 필수 3: DEVICE_LIMIT / TRACK_LIMIT / STALE 거절 신규기기 reservation이 global 32-device slot을 남기지 않는지, PRIOR_WINDOW_NEEDS_SEAL retry reservation은 보존되는지.
- 비용/회귀: accepted RTDB W2, proven duplicate W0, due settlement peer read 2/attempt, page/update/re-entry IO 0, app410/412/413/414/415/416 및 127/175/178/191/192/197/390 보호.
- PASS 전 Stage416 client ON, 개인 1분 일반 사용자 활성화, 공개 공동집계 구현, Worker 비용 감사, 팔로우 작업 시작 금지.
- merge/deploy/shared data/D1 schema/migration/backfill/delete 금지.

---
## NEXT — Stage416 lost-click corrected candidate 독립 감사 1건만 (2026-10-14 KST)

- 현재는 새 기능 추가 금지. `gpt56/stage416-lost-click-fix`의 corrected candidate만 독립 감사한다.
- 감사 핵심: global reservation이 env acceptance로 오인되지 않는지, PRIOR_WINDOW_NEEDS_SEAL 재시도 유실 0인지, limit/stale rejection이 accepted 상태를 만들지 않는지, cross-env canonical version strictly increasing인지 확인.
- app416/app410/app412/app413/app414 보호 기능과 page/update/re-entry IO 0 계약 회귀 여부도 확인.
- PASS 전 Stage416 client ON, 개인 1분 일반 사용자 활성화, 공개 공동집계 구현, Worker 비용 감사, 팔로우 작업 시작 금지.
- 배포/shared data/D1 schema/release workflow 변경 금지.

---
## NEXT — Issue #118 lost-click blocker만 해결 (Stage416 개인 1분 활성화 선행 1건) (2026-10-13 KST)

- 현재 서버 운영값은 private=1분 / public=5분 확인 완료.
- 지금은 **global version reservation이 env acceptance보다 먼저 accepted로 확정되는 lost-click 위험 한 건만** 해결한다.
- exact same operation은 env pending/sealed에 실제 존재할 때만 accepted duplicate 가능해야 한다.
- `PRIOR_WINDOW_NEEDS_SEAL` 후 재시도 최종 저장, DEVICE_LIMIT/TRACK_LIMIT/STALE rejection no-global-accept, PREVIEW→TEST→PROD→PREVIEW strictly increasing 실행형 테스트 필수.
- 이 PASS 전 Stage416 client ON, 개인 1분 일반 사용자 활성화, 공개 공동 5분 구현, Worker 비용 감사, 팔로우 작업 금지.
- 배포/shared data/D1 schema/release workflow 변경 금지.

---
## NEXT — Stage416 좋아요 5분 공동집계 완성 (단일 작업) (2026-10-13 KST)

- **현재 유일한 작업:** 관리자/Master에 이미 구현된 `좋아요 저장·공개 집계 주기`를 기준으로 5분 공동집계 경로를 완성한다.
- **현재 상태:** controlled backend E2E는 상당 부분 검증됐지만 일반 사용자 Stage416 client는 아직 OFF/HOLD. 기존 문서 기준 전체 진행률 1/4·25%.
- **완료해야 할 핵심:** PREVIEW에서 5분 창이 실제 사용자 클릭을 안전하게 접수하고, due 후 Worker/D1 canonical 정산 → 개인 상태/공개 count → 최종 ACK까지 정확히 이어지는지 검증.
- **기존 차단점:** PREVIEW/TEST/PRODUCTION transient backend 환경 분리와 canonical settlement version 충돌, Functions 승격 계약이 미완료 상태. 이 세 가지를 한꺼번에 바꾸지 말고 **현재 첫 차단점 하나씩** 해결.
- **보호 기준:** app416의 즉시 하트, PC↔mobile 동기화, app412/app414 stale 격리, app413 count 보호, Local First, warm revisit R0/W0를 깨면 FAIL.
- **비용 기준:** 실제 변경된 좋아요만 묶어서 처리. 전체 Feed/프로필/전체 사용자 조회 금지. 정상 업데이트/진입/재진입 추가 D1/Firestore data read/write 0 목표.
- **작업 순서:** 첫 차단점 확인 → 최소 수정 → 자동검증 → commit 고정 → GPT-6 독립 감사 → PREVIEW controlled 검증. 한 단계 PASS 전 다음 단계로 넘어가지 않음.
- **배포 제한:** 사용자 승인 없는 TEST/PRODUCTION 승격 금지. 공유 사용자 데이터 migration/backfill/delete 금지.

---

## QUEUED — app416 실기기 검증 다음: Cloudflare Worker 사용량/비용 경로 감사 (2026-10-13 KST)

- **순서:** 현재 app416 PREVIEW 실기기 수렴 검증 완료 후 진행.
- **목표:** 최근 Worker 사용 빈도 증가가 정상적인 edge/API 호출 증가인지, 불필요한 반복 D1 read/write 증가인지 분리 판정.
- **경로별 확인:** Feed / Profile / Search / like batch / public-like-cards / revision 및 기타 실제 hot path별 Worker 호출 횟수와 D1 read/write 동반 여부를 각각 측정.
- **합격 기준:** Worker 호출 자체가 많더라도 cache/R2/local 결과로 끝나는 요청은 구분하고, 변경 없는 업데이트·페이지 진입·재진입에서 D1/Firestore data read/write 0 목표를 유지.
- **금지:** 비용 확인만을 이유로 기존 정상 UI/동기화/좋아요 기능 변경 금지. 전체 Feed/프로필 재조회·전체 rebuild 도입 금지.
- **판정 산출물:** “호출은 많지만 저비용 정상” vs “불필요한 Worker/D1 반복 호출 존재”를 수치와 실제 route 기준으로 보고하고, 문제가 있을 때만 최소 수정안을 제시.

---

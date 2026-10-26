## NEXT — app501 P1 기존 22건 초과 outbox 정상 종료 재감사 (2026-10-26)
- 이전 감사 `c94c0e5ec6beedb840ceb28b8a5bbf29a1ea5856`은 **FAIL**: 22건에서 1건 정상 완료 후에도 21건 기록을 저장하지 못하고 재접속 시 완료 건 중복 처리 위험.
- 동일 PR #491 브랜치에서 `writeAll` 과용량 처리 시 현재 저장소에 이미 존재하는 ID만 통과(기존 항목 수정·삭제 허용), 새로운 ID가 한 개라도 들어오면 거부. 일반 20→21 신규 곡은 `blocked-capacity` → 기존 1곡 canonical fallback. 22→21→20/기존 곡 retry/20건 경계/19건 재진입 자동회귀 추가. 기존 30초 묶음, RTDB 즉시, 정상 캐시·비용, 모든 UI/원본 보존.
- 정확한 최신 GitHub HEAD에서 product+TypeScript+Build PASS 확인 후 감사방 **새 SHA** 읽기 전용 재검증. Firestore 사용자 3곡 canonical 및 실제 PC/모바일 일치는 별개 실기기 미검증. PREVIEW 현재 app500 유지, TEST/PRODUCTION HOLD.
---

## NEXT — app501 P1 20→21 대기곡 보존 독립 재감사 (2026-10-26 KST)
- 이전 SHA `12ea676e3a66306599b9af9901f6348f9fab40a3` 독립 감사 FAIL P1. app501 PR #491 `fix/app501-studio-heart-quota-safe`에서 소스 `acf8499cce1cae057ffc49d93f3a15b2cff3f7e1` 수정: 20 pending 자동 절단 제거, 초과 새 곡 `blocked-capacity`와 1곡 canonical fallback; 동일 곡 20번째 수정 허용. 기존 outbox/preview/30초 묶음/저장 원본 보호.
- `scripts/verify-501-studio-heart-quota-safe.ts` 20→21 no-eviction (raw bytes), unchecked writer, same document replacement, freed slot, legacy 22 records, original quota/3 devices/phantom tests.
- 정확한 최종 SHA의 두 GitHub Actions TypeScript/Build/전체 제품 회귀 확인 후 그 SHA로 감사방 **읽기 전용 재감사**. 독립 감사 PASS 및 사용자 PC/모바일/Firestore 실측 전 실제 앱 저장 성공/배포 완료 주장 금지. PREVIEW app500, TEST/PRODUCTION HOLD.
---

## NEXT — app501 정확 SHA 독립 감사 및 PREVIEW 데이터 안전 검증 (2026-10-26)
- 문제: Recent 저장 하트 3곡은 모두 체크지만 기존 PC Music Note 3곡/모바일 2곡/새 PC 브라우저 최초 1곡→재접속 2곡. `먼 길을 돌아온 밤` 원본 저장 여부 미확정. 실사용자 곡 삭제/해제/재저장/캐시 삭제 금지.
- 후보 PR #491 `fix/app501-studio-heart-quota-safe`: quota-full에서 pending write read-back 검증 후 단일곡 canonical fallback, 기존 pending 중복경쟁 차단. RTDB remote preview는 화면·로컬 캐시만, derived Catalog 재출판 금지. Catalog onData 및 manual refresh는 optimistic rows를 newer canonical로 합치지 않고 기존 active preview는 overlay 유지. 읽기/탭 이동 Firestore 쓰기 금지, 30초 per-song 배치 및 app349 동기화 보호.
- 현재 구현 소스 SHA `c6e297db3aeb28f7b7950fe5505514c2a6a08d6c`, 문서 커밋 포함 정확 HEAD 확인. 최종 CI TypeScript/Build/관련 회귀 PASS 확인 후 독립 감사방으로 대상 SHA 전달. Audit: full catalog read -> pending/preview overlay, warm/new browser cache vs revision, manual refresh, false success, 3곡 identity, R0/W0 unchanged normal, QA in browser still unverified. FAIL 시 수정, PASS 시 PREVIEW만 배포 검증 가능, TEST/PROD 별도 승인.
---

## NEXT — app501 3곡 PC↔모바일 저장 불일치 독립 감사 (2026-10-26)
- 사용자 보고: PC에서 저장한 곡은 모바일에도 보이지만 모바일에서 저장한 곡은 기기 Music Note에 누락할 수 있고, PC·모바일 Recent 3곡 Music Note 목록이 다름. 기존 저장곡 대부분 정상. 기존 곡 저장 해제/재저장·사이트 데이터 초기화 금지.
- app501 Draft PR #491 동일 브랜치: 브라우저 localStorage pending 실패 무시로 생기는 실시간 가짜 저장을 read-back+canonical 단일 곡 fallback으로 보호, 동일 밀리초/동일 상태의 오래된 pending이 새 곡 본문을 대신하지 않도록 검사 강화. PC/모바일 독립 storage, A=PC/B=모바일/C=모바일 PC 오프라인, mobile quota, 기존 pending 보존, 재시작 local persistence 회귀를 기존 app501 verifier에 포함.
- CI TypeScript/Build/제품 회귀 PASS, 독립 감사 및 서버 원본/실기기 확인 전 **실제 서버 저장 확인 완료 아님**. Mock만으로 Firestore 저장 PASS, 두 기기 실제 convergence PASS 주장 금지. main/production/data/hosting/workers/rules 무변경.
- 다음 한 작업: 정확한 최종 SHA의 CI 및 독립 감사, 이후 필요 시 실제 기기에서 세 곡만 새 미저장 테스트 항목으로 검증. 배포는 고정 릴리스 경로/승인 규칙 준수, TEST·PRODUCTION HOLD.
---

## NEXT — app501 Recent save-heart Music Note phantom save regression (2026-10-26)
- 사용자가 app500 PREVIEW에서 로그인 유지·동시 탭 **PASS**, 최근 생성곡 저장하트→Music Note 누락 **FAIL** 보고. TEST/PROD 승격 HOLD.
- 원인 후보: 30초 Studio pending localStorage full 시 `writeAll` 실패를 숨겨도 저장 성공 토스트, canonical flush 없음. branch `fix/app501-studio-heart-quota-safe`에서 **정확한 local pending 저장 read-back**, 새 save 실패만 기존 one-item canonical 즉시 저장, 이전 pending 충돌 시 재저장 차단·오류 안내. 정상 30초 W0/W1·즉시 local/다른 기기 RTDB preview·Music Note 표시·UI·비용 불변.
- **다음:** `verify-501-studio-heart-quota-safe.ts`와 기존 product quality CI, TS, Build PASS 확인; 문제 있으면 해당 경로만 최소 수정. 사용자 직접 PREVIEW 신규 배포 승인이 없으므로 **코드 PR만**, 기존 Hosting 유지. 추가 Codex·Work 연속 명령 금지.
- 저장 실패 원본 데이터 삭제/overwrite, 사이트 데이터 초기화, 모든 favorites 서버 재조회, Stage416 활성화, main/production/Worker/Functions/Rules 변경 금지.
---

## NEXT — app500 PREVIEW 배포 완료 → 모바일 Chrome 로그인 실사용 QA (2026-10-26)
- Firebase PREVIEW 배포 **성공**: run `40242015534`, 실제 호스팅 배포 소스 `8da70f240bbca8e1b8305f11cdd8cd240efcda10`, preview.soridraw.com app-version=500 및 remote/local index SHA 동일, TEST/PRODUCTION untouched, Worker/Functions/Rules/D1/user data unchanged. 추가 배포 **불필요**.
- app500 로그인 소스 Work Medium P1 ×2 **PASS**, SDK/TS/Build/전체 제품 CI **PASS**. 그러나 실제 Android Chrome 영구 로그인·기존 SESSION/LOCAL/IndexedDB, 두 탭, quota, 이메일/Google 로그인, 신규가입, Music Note 초안/좋아요 대기열/PC↔모바일 QA는 **미검증**.
- 다음은 사용자 실기기 **PREVIEW** 확인: 기존 계정 로그인 유지 ON 상태로 브라우저 완전 종료 후 재실행 시 로그인 유지; OFF이면 설정대로 작동; 기존·신규 탭 동시 실행해 세션 유지; 저장 공간 부족에서 인증 오류/초안 손실 없는지 점검. 사이트 데이터 전체 초기화/사용자 원본 삭제 금지.
- 사용자 실사용 결과 PASS 시에만 다음 TEST 승격 **별도 사용자 요청**을 기다린다. app497 release engine PR #485/#469 HOLD, Stage416 OFF, Reader OFF; 앱 UI 및 공유 원본 보호. Codex/Work 반복 명령 금지; 약 5시간 사용 주기당 한 개 통합 명령을 사용자에게 직접 제공.
---

## NEXT — app500 PREVIEW Hosting postflight·모바일 Chrome 확인 (2026-10-26 KST)
- **배포 요청 승인됨:** Work Medium 정확 SHA `c3d96814964e8d7d6197f0b72c3cd969820661a0` 독립 PASS, release candidate `08897d5392dcefd643cbc9823b6162f5b6667b96` 두 CI PASS; PR #488가 `preview` merge SHA `4f5af7e9212649300f981ca0ab280da5733da71d`로 완료, 앱 버전 500.
- **지금 한 작업:** 기존 `.deploy/preview-app-release.trigger` Hosting-only PR을 merge해 `.github/workflows/firebase-hosting-custom-preview.yml` 시작. Workflow exact target SHA·TypeScript·Build·필요한 Tests·Firebase PREVIEW Hosting·preview.soridraw.com 정확한 build/index/500 및 TEST/PROD 불변 PASS 확인. 미완료면 배포 완료 보고 금지.
- **후속:** Chrome 기존 로그인 ON/OFF, LOCAL/SESSION/IndexedDB/용량 부족/동시 탭/브라우저 종료·재실행, Google/이메일 인증, 초안·하트 대기열·PC↔모바일 확인. 실기기 확인 전 장기 로그인 보장 PASS 금지. TEST/PRODUCTION 별도 요청 전 승격 금지.
- 공유 사용자 원본/Firestore/D1/Rules/Functions/Worker 미변경, Stage416 OFF, Reader OFF, app497 #485/#469 HOLD.
- Codex/Work 추가 중복 요청 금지: 한 사용 주기 약 5시간마다 하나의 통합 명령을 사용자에게 직접 전달.
---

## NEXT — app500 기존 SDK 계정 보존·초기 quota 복구 최종검사 (2026-10-25)
- **현 작업자:** ChatGPT가 같은 Draft PR #488 개발 브랜치만 작업; Codex/Work 쿼터 소진으로 추가 실행 요청 금지. 향후 필요 시 약 5시간 재설정 이후 Work Medium 독립 검증 **1건**을 이 채팅에서 사용자에게 직접 전달.
- Work P1 이슈: (1) SDK 자동 LOCAL→IndexedDB 이동이 옛 탭 로그아웃을 초래 (2) Auth initialize 같은 UID 저장 공간 부족 시 SDK 초기화 실패. 실제 SDK 검증 코드 `scripts/verify-500-auth-sdk-restore.mjs`는 기존 캐시/모의 userdata, 네트워크 차단 상태에서 돌려야 함.
- 파일 `src/lib/authRestorePersistence.js`, `src/firebase.js`, `src/App.tsx`, `scripts/verify-498-auth-storage-recovery.mjs`, 새 SDK 검사 및 기존 `app498-auth-storage-recovery-quality.yml`의 타깃 CI를 정확한 최종 commit에서 확인. 원본 SDK 인증키 삭제/앱 초안 삭제 금지.
- 최종 결과 Work 감사 PASS, PC/모바일 기존 Chrome session·LOCAL·IndexedDB/쿼터+멀티탭·재실행 QA 전 `APP500_RELEASE=HOLD`; 사용자 배포 명령 없음. app497 #485/#469 HOLD.
---

## NEXT — app500 로그인 지속성 사용자 정책 수정 검증 (2026-10-25)
- PR #488 `fix/app500-durable-auth-quota-recovery` (branch 기준 preview `5a2c29efb0b2101729ab63d7de533c009d83fa77`). Source audit에서 밝혀진 `getAuth` OFF 세션 영구승격 위험, quota로 '로그인 유지 ON' 설정 소실, session fallback 무경고를 최소 코드로 수정하는 개발 후보 작성.
- 수정 대상 `src/firebase.js`, `src/App.tsx`, `scripts/verify-498-auth-storage-recovery.mjs`, `DOCS/APP500_DURABLE_AUTH_STORAGE_REPAIR.md`. Firebase `initializeAuth`의 OFF SESSION-first / ON durable-first, popup resolver 유지, 브라우저 저장 공간 부족 시 boolean cookie backup(credential never stored), Google/email temp warning, UID·초안 보호.
- **다음 하나:** 정확한 PR 최신 SHA에서 targeted Auth 검사·TypeScript·Build·전체 회귀 CI PASS 확인. FAIL이면 같은 branch 최소 수정. 최종 SHA 고정 후 **독립 Work High 읽기 전용 감사** 수행. 검증 없는 merge/deploy 금지.
- Chrome 실기기 기존 로그인 ON/OFF, storage quota, popup/이메일, restart, PC↔mobile, multi-tab, cookie disabled는 별도 사용자 기기 확인 필수. 메모리/세션 성공을 장기 로그인 PASS로 보고하지 않음.
- 사용자 공유 원본·Music Note/Library/Explore UI/Worker/Functions/Cloudflare/Stage416 OFF/Reader OFF 고정. TEST/PRODUCTION 승격 승인 없음. app497 #485 HOLD 유지.
---

## NEXT — app500 저장 공간 부족 자동로그인 우선 복구 (2026-10-25 KST)
- **사용자 명시 최우선:** 앱 내 로그인 유지 ON 상태에서 모바일 Chrome localStorage quota가 가득 차더라도 오래 로그인되도록 Firebase 기본 영구 저장 우선순위 복원. 자동 로그인 외 기능/UI/음악 원본 데이터 금지.
- 개발 후보 Draft [PR #488](https://github.com/andrawing1212/soridraw-music/pull/488), base preview `5a2c29efb0b2101729ab63d7de533c009d83fa77`; `DOCS/APP500_DURABLE_AUTH_STORAGE_REPAIR.md`. 후보는 미병합·미배포. `getAuth`는 default IndexedDB→localStorage→session persistence 지원; startup에 `setPersistence` 강제하지 않고 신규 로그인에서만 명시적 IndexedDB LOCAL→Web LOCAL→session→memory fallback.
- **정확한 다음 하나:** PR #488 마지막 HEAD quality CI(`verify-498-auth-storage-recovery.mjs`, TypeScript, Build, 기존 Like/Music Note 회귀) 확인하고 실패 시 로그인 코드만 최소 수정, SHA 동결 뒤 독립 Work 감사. 기존 세션 hydrate/rememberLogin OFF/Google popup 및 quota-full/IndexedDB blocked/스토리지 완전 차단/다중 탭 인증 회귀 확인.
- Work PASS 이전 merger/deploy 금지. PREVIEW Hosting-only 검증 뒤 사용자 모바일 Chrome 전체 종료/재실행·미저장 작업 보존 실기기 확인. TEST/PRODUCTION은 별도 승인, 사용자 원본 삭제·캐시 전체 정리 금지. app497 PR #485, #469는 HOLD 상태 그대로.
- Stage416 1/4 25% OFF, 기존 속도 5/5 100% 과거 기준, app500 후보 2/4 50% (자동/기기 검증 전).
---

## NEXT — app497 통합 Codex High 작업 및 app499 로그인 유지 최종 실측 (2026-10-25 KST)
- **현재 실제 제품:** preview `e4b232118e0623486528e52d952787eaede7dcce`/배포 app468 `d4c2c39af3aec6f895bdfff33afdb6f8f2c37805`; Source-only app497 owner acceptance candidate Draft PR [#485](https://github.com/andrawing1212/soridraw-music/pull/485), frozen release engine PR #469 `f521b9c8808397d47b596f840ff816cac374dd91`. 현 app497 브랜치에 예전 6개 release-engine 변경이 포함되어 있어 현재 preview(app468)와 merge conflict **가능; 무단 merge 금지**.
- **Codex High 필수:** #485의 정확한 최종 SHA와 브랜치 CI 확인, 현재 app468 HEAD 기반으로 복원·rebase/통합하고 frozen Worker rollback/Hosting SITE:@VERSION 검증 유지. TEST 자동검사는 `TEST_AUTO_CHECKED`만 발급; `TEST_VERIFIED` 자동발급·고정 parity PASS 영구 금지. 별도 owner-initiated workflow에 서명키/권한/재실행 차단·출처 정확성, signed source/tree/Hosting/Worker/Media, PC·모바일 기존·빈 캐시·로그인·Music Note·Library·좋아요·추천·공개상태, 실제 3환경 parity 증빙 모두 필수. PROD preflight는 signed owner acceptance 없으면 배포 이전 단계에서 실패. HMAC 키 `SORIDRAW_RELEASE_ATTESTATION_KEY`는 관리자가 안전하게 구성하는 별도 준비사항; 현재 키 존재는 **확인되지 않음**, secret 없이 절대로 성공 처리 금지.
- **반드시 독립 감사:** source-only negative tests에 unsigned/forged/expired/replayed wrong tag/SHA/Hosting/Worker/Media/PC-only/empty-or-old-cache unverified/false parity/triggering_actor mismatch/root original data mutation, GitHub workflow identity test를 포함. 실제 GitHub/Actions CI source checks PASS와 별개로 Work audit exact SHA, release-controller 기존 rollback/server/API preflight, user physical UI acceptance 검증 완료 전 TEST/PRODUCTION 배포 금지.
- **app499 모바일 인증 보류:** `DOCS/APP499_AUTH_PERSISTENCE_AUDIT.md`. Chrome 성공 로그인과 영구 자동로그인을 구별; user old Chrome에서 session fallback 확인, 앱 재시작 후 local session 지속 실측 없음. 실제 동일 기기의 Chrome 완전 종료/재진입·UI/계정·원본 확인 후에만 인증 유지 PASS. 절대 브라우저 캐시/사용자 초안 초기화 금지.
- **보호:** app468 다음곡 적용/Settings/Studio 레이아웃, app410 좋아요, app434 Worker, Stage416/Reader OFF, Music Note +60초/Studio 하트+30초/Recent+150초, 공유 사용자 원본/회원통계/Explore R0/W0. 모든 TEST/main/PRODUCTION 배포는 별도 승인 후.
---

## NEXT — app497 P1 release manifest user-acceptance and parity-gate fix (2026-10-25 KST)
- Exact frozen unsafe controller: PR #469 SHA `f521b9c8808397d47b596f840ff816cac374dd91` quality CI #40135214346 PASS but independent Work audit 0. New app497 read-only finding `DOCS/APP497_RELEASE_ATTESTATION_AUDIT.md`: TEST_VERIFY unconditionally publishes `TEST_VERIFIED` before owner signed-in PC/mobile approval; manifest `parity.status='PASS'` constant; PROD gate only verifies automatically-issued TEST_VERIFIED, no signed exact-SHA/Hosting/Worker/Media/device old-cache acceptance. Existing Worker server curated parity checker exists and must remain protected.
- **Codex High implementation next:** minimal fail-closed two-stage release: after TEST automated pass issue non-PROD-eligible pending manifest; require explicit owner-authorized acceptance carrying source/tree + version + exact TEST Hosting + Worker/Media versions/bundle hashes + PC and mobile existing-cache/empty-cache checks + real curated 3-env parity proof to issue finalized TEST_VERIFIED; protect against forged/reused/stale approvals; separate explicit PRODUCTION approval remains mandatory. No changes to working UI, user original data, Stage416/420, Reader OFF. Add offline negative fixtures and TypeScript/Build/CI.
- Follow independent WORK audit of exact new candidate SHA and release-controller `github.workflow_sha` identity, then complete PREVIEW functions/workers/Rules/authenticated UI acceptance → explicit integrated TEST deploy → signed TEST acceptance → separate PROD approval. NEVER treat app497 detection CI PASS as release safety PASS.
---

## NEXT — app496 live Functions identity known; independent release-engine Work audit then full TEST acceptance (2026-10-25 KST)
- Read `DOCS/APP496_LIVE_FUNCTIONS_RELEASE_INVENTORY.md`: actual Firebase metadata GET confirms 42 live Functions, 8 Stage416 endpoints + 2 other candidate endpoints already deployed, Stage420 prefix 0. `getFirestoreServerUsage` is generated by prebuild `functions/scripts/apply-firestore-usage-export.cjs`; [CI #40144402152](https://github.com/andrawing1212/soridraw-music/actions/runs/40144402152) confirms **42/42** matched to generated secure exports. Final app496 source adds fail-closed gate for any unexpected live endpoint; confirm final exact SHA CI before PR #474 merge.
- PR #469 exact head `f521b9c8808397d47b596f840ff816cac374dd91` source CI PASS, independent Work review **still not done**. Do not deploy or merge as final approved engine. Audit GitHub `workflow_dispatch ref=preview`, `github.workflow_sha` vs old default-main controller, Firebase SITE:@VERSION, Worker/Media/Hosting rollback, GitHub release/tag cleanup and fail-closed behavior.
- Then protect original shared user data, identify whether any of 26 Functions source deltas or database.rules.json differ in *needed active behavior*; avoid deploying disabled Stage416/420 functions or rewriting already-exact shared RTDB Rules. Full PREVIEW UI/feature, authenticated PC/mobile, PWA old-cache, Media/Worker version, cost checks before **separately approved integrated TEST** → TEST_VERIFIED → separately approved PRODUCTION. Never run release-system-audit as strictly GET-only without recognizing ephemeral D1 create/delete.
---

## NEXT — app495 source inventory complete; release-engine independent audit gate FIRST (2026-10-25 KST)
- Review `DOCS/APP495_INTEGRATED_TEST_RELEASE_SCOPE.md` (frozen PREVIEW `27ff8ad784b69ccebdcc5f4603226f055a26c2df` vs `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c`), first source inventory: 64 client, 26 Functions, 49 Explore Worker, 1 Media Worker, 1 RTDB Rules, 1 app-version difference. PREVIEW UI source exactly matches last confirmed PREVIEW Hosting commit app465, but NOT yet all functions/real devices.
- **Do not skip Work audit:** independent exact-SHA review of unmerged PR #469 `f521b9c8808397d47b596f840ff816cac374dd91`, CI #40135214346 PASS; self-source scan is not separate Work PASS. Verify documented `SITE:@VERSION` Firebase clone, partial failed CLI exact rollback, RELEASE controller `workflow_dispatch --ref preview` selected `github.workflow_sha` vs default main issue_comment, no Functions/Rules deploy.
- Continue inventory from source list to *actual live deployed Functions/Rules* read-only fingerprints and completed UI/workspace/Media/Worker functional acceptance, classifying Stage416/420 candidates as disabled. Cross-check entire release against TEST/PWA old caches; user data shared, migration/cache overwrite not allowed. Then only on separate user `테스트배포` approval promote whole validated version to TEST, then TEST_VERIFIED and independent production approval.
---

## NEXT — app494 immutable Firebase version clone fixed; exact-SHA independent Work audit (2026-10-25 KST)
- **Frozen candidate:** PR #469 HEAD `f521b9c8808397d47b596f840ff816cac374dd91`; CI #40135214346 SUCCESS. Source-only fix for two invalid `hosting:clone SITE@VERSION` calls; now documented `SITE:@VERSION` for TEST→PRODUCTION exact Hosting copy and previous TEST/PRODUCTION Hosting rollback, checked by updated regression mocks. 6 files total; no live deploy.
- **Next sole release-engine gate:** obtain independent READ-ONLY Work/audit-room PASS/FAIL for **this exact new SHA** per comment #6389895729; former c138... audit requests invalid as final head changed. Review default main Workflow Controller vs manual `workflow_dispatch ref=preview` before initial TEST, `github.workflow_sha` identity, same-site Hosting exact restore/HTML hash, partial CLI/GitHub release/tag rollback and fail-closed state; physical client cache and server promotion remain unverified.
- After audit PASS and necessary minimal retest only, source merge to preview and read-only release-system audit. Then inventory/QA all completed PREVIEW UI/functionality/Worker/Media together; immutable preview SHA preflight and separately authorized **full TEST** promotion; TEST_VERIFIED PC/mobile; separately approved same artifact PRODUCTION. `13/13/12/12` parity HOLD, Reader OFF, no canonical data mutation.
---

## NEXT — Release Engine app493 frozen candidate, independent audit first (2026-10-25 KST)
- Source-only PR #469 final HEAD `c138a44bcf1d691e41267b5b9aa99bc7c8a616ae`, CI #40134256386 SUCCESS. Six files: Explorer/Media runtime activation fail-closed recovery, release controller pre-mutation markers/exact previous Firebase Hosting version and index rollback, release-system audit + targeted quality CI, and 8+5 local CLI/Hosting fault-injection scenarios. **Do not modify this SHA while under independent audit.**
- **Immediate single action:** Independent Work/audit-room review of exact SHA per [PR #469 owner audit request](https://github.com/andrawing1212/soridraw-music/pull/469#issuecomment-6389767787). Independent PASS is NOT recorded; PR not merged. Audit P1: default `main` vs selected preview workflow/controller hash and safe `workflow_dispatch ref=preview`, CLI partial remote changes, old Worker/Media 100%+Cron, same-site Hosting clone of exact previous release (not rebuild), incomplete GitHub release/tag and branch rollback, manual HOLD on failed restore, authenticated physical browser cache release contract. No deployment.
- After audit PASS and any repair/re-audit: merge source-only engine to `preview`, use existing read-only release-system audit against exact post-merge SHA; then inventory full completed PREVIEW UI/feature/Worker/Media release payload before separate TEST authorization. TEST release cannot be a Writer-only change. PRODUCTION requires separate clear authorization, Reader OFF/13-13-12-12 mismatch HOLD, zero original-user-data migration.
---

## NEXT — 사용자 확정 전체 TEST 승격 전 배포엔진 개선 (2026-10-25 KST)
**주요 순서 절대 변경 금지:** ① 배포엔진 수정·CI·독립 감사 → ② PREVIEW 완료 UI·기능·Worker·Media·서비스 전체를 하나로 목록화/최종검증 → ③ 엔진 read-only preflight + exact SHA/tree/asset/PRODUCTION cache contract → ④ 별도 사용자 테스트배포 지시에 따라 전체 TEST 승격 → ⑤ TEST PC/모바일 로그인 화면과 저장 상태·Media·좋아요·추천곡·비용 검증 및 TEST_VERIFIED manifest → ⑥ 별도 명시적 정식배포 승인 후 동일 아티팩트 PRODUCTION. 실패하거나 불일치하면 STOP. 단일 Writer 배포로 전체 TEST 승격 완료 주장 금지.
- **지금 첫 작업**: Draft [PR #469](https://github.com/andrawing1212/soridraw-music/pull/469), app492 release engine partial activation nonzero rollback fail-closed fixes, baseline `4961f0bdb4ec1e5738534a2347d01cd604a5956b`. TS/Build/Node fault-injection CI 후 exact SHA 독립 감사. 미감사 코드 main 또는 production 반영 금지. 배포엔진의 독립 검증을 단순 CI PASS로 대체 금지.
- 구형 release controller의 마지막 외부 명령 뒤 mutation 마킹 오류를 먼저 해결하는 범위. 다음 독립 감사에선 Wrangler upload/activate partial failure, GitHub push partial success, Firebase Hosting deploy/clone partial success, old active Worker 100%/cron 정확 복구, fallback 실패 시 명시적 FAIL, TEST/PRODUCTION backend config와 cleanup, Work 최종 SHA 및 새 production-existing browser cache/빈 캐시 모두 확인할 것.
- **특히** `github.workflow_sha`가 기본 `main` 정의를 선택할 수 있으므로 `preview` 수정만으로 실제 실행 엔진이 고쳐졌다고 믿지 말 것. 기본 워크플로 버전 경로/승격 전 controller identity 사전 검증 필수. 데이터 변경/테스트배포/정식배포/Reader ON/파생 cache rewrite 없음.
- 실제 PREVIEW Writer v2960... PASS, v307 curated 13; TEST/PROD 12씩/구형 writer, 3 curation flags OFF. TEST/PRODUCTION parity HOLD. 사용자가 "계속 진행"이라고 한 것은 소스 수정·검증 진행 지시이며 자동 TEST/PRODUCTION 배포 승인이 아님.
---

## NEXT — #203 app491 PREVIEW Writer PASS; next TEST writer compatibility source-only (2026-10-25 KST)
- PREVIEW actual bundle, strict curated Writer route, bindings/Reader OFF, public revision, guest desktop/mobile-sized runtime API selection PASS on [read-only run #40127800218](https://github.com/andrawing1212/soridraw-music/actions/runs/40127800218). Old app489 quote-format false failure corrected by app490 and proven against remote artifact. No new Worker deployment. PREVIEW Worker active `2960d485-fe66-4136-9f84-41ce3e0d4b58`.
- Remaining actual failure: canonical/PREVIEW/TEST/PRODUCTION = 13/13/12/12; TEST live Writer `TEST_WRITER_ROUTE_MISSING_477`, PRODUCTION compatible-source status NOT REACHED due fail-fast. Browser selection only automated guest PC/mobile-size, signed-in physical test not performed. Old in-flight drain independent proof unavailable; shared reader, shadow, writer-ready flags OFF.
- **Next scope:** prepare a read-only comparison/report of TEST/PRODUCTION active Writer source/flags/bindings and a TEST Writer-first compatibility release proposal against audited app481 exact source; verify environment-specific Worker identity, cache isolation, CORS, DO, like queues, cron, rollback and old-flight safety. **Source-only / GET only.** No TEST main merge/deploy until user's explicit 테스트배포 approval, no PRODUCTION change absent 정식배포 approval, no Reader activation or derived cache repair/migration, no user original writes.
- For major TEST release implementation, separate Work or audit-room exact-SHA independent check plus TS/Build/Worker dry-run, remote safety and PC/mobile browser validation. Preserve app410/Stage416, Music Note 60-second batch, +30-second favorite and user original data. After all three Writers upgraded and old-flight proven, seek separate approved bounded 13/13/13/13 derived cache parity repair, then separate Reader activation.
---

## NEXT — #203 after app488 PREVIEW Writer live SUCCESS (2026-10-25 KST)
- Live Worker-only PREVIEW release #40124096807 SUCCESS from user-authorized trigger PR #464, preview merge `f1cc3206b92dcfb7f37a0f8a0e6a86119667d98a`. Exact audited app481 source `5bf84dee4c9db7f0ce8296a57781be9161d8e59f`. New PREVIEW Worker version `2960d485-fe66-4136-9f84-41ce3e0d4b58`. PREVIEW/TEST/PROD curation flags remain OFF, like 035/069 pending queues zero, PREVIEW Cron empty, POSTDEPLOY PREVIEW Worker v307 curated 13 PASS, warm D1 R0/W0, Feed/profile/search/likes regressions PASS. TEST/PROD Worker versions unchanged, no Firebase/Functions/Rules/user original write. Browser physical QA and actual spend **not verified**.
- Work audit detail: old PR #463 SHA `2aebe85...` independent WORK FAIL app427; app487 source P1 corrected and GitHub exact release-sequence CI SUCCESS. **No separate Work audit of final SHA** was performed, do not claim one. User allowed PREVIEW deployment after own direct verification; this is not TEST/PRODUCTION approval.
- **Now only #203:** read-only verify deployed PREVIEW Writer source/mutation routes/bindings/flags, warm/cold PREVIEW browser PC/mobile without performing canonical mutation; verify Reader remains OFF. Actual TEST/PROD Writer replacement requires separate TEST and explicit PRODUCTION approvals, while Reader OFF, old in-flight retirement proof and rolled-out 13/13/13/13 exact track ID/order parity. Do not activate shared Reader or perform derived cache reconciliation before all compatible Writers retired. If any changes occur, freeze SHA and perform independent audit.
- Known live parity last measured: canonical/PREVIEW/TEST/PRODUCTION 13/13/12/12 **HOLD**. Do not mark #203 complete. Music Note saved membership #237 and deferred cost work are subsequent separate tasks. Protect Stage416 OFF, app410 likes, Music Note 60s, Studio favorite +30s, Recent +150s, shared originals.
---

## NEXT — #203 app487 release verifier contract correction (2026-10-25 KST)
- WORK audit FAIL on PR #463 old SHA `2aebe85c5721dc9a5f33526c0d7bf60a5431a365`: legacy app427 fixture falsely treats unmarked `userInput:''` as confirmed user clear, contrary to app459+ historical auto-default contract. Current branch `prep/app486-writer-infra-integration` stages verifier-only fixture correction + release workflow reviewed-verifier pin (app487). Do not change app481 audited Writer 8 blobs or `src/lib/musicNoteNextSongRecipe.ts` to force the obsolete expectation.
- Immediate gate: check exact workflow checkout of audited app481 SHA `5bf84dee4c9db7f0ce8296a57781be9161d8e59f`, old app427 blob verification then app487 modern verifier overlay only, both legacy auto-empty vs explicit proven-clear fixtures, full source CI / TypeScript / Build / Worker `--dry-run`, release guard negative regression, no changes to reader OFF, queue/Cron/flags/rollback. Audit the final PR SHA separately via Work; until PASS all preview deploy approvals HOLD.
- No automatic workflow trigger, no .deploy marker, no merge into preview/main, no Cloudflare/Firebase changes, no user data writes or migration, no cache repair, no TEST/PRODUCTION release. #203 13/13/12/12 parity still FAIL; old Writer in-flight retirement evidence HOLD. Music Note #237 and cost audit remain postponed.
---

## NEXT — #203 app486 independent Work integrated PREVIEW preflight (2026-10-25 KST)
- Freeze app486 Draft PR #463 head after CI; audit exact combined PR diff against two separately audited sources: product #461 SHA `5bf84dee4c9db7f0ce8296a57781be9161d8e59f` (eight blobs unchanged), infra #462 SHA `7217b3742aa604dffd69f605d1d5b6d684b4243b` (guard and release workflow unchanged EXCEPT synthetic stale-trigger self-test), base preview `fb99c777225aed60bea0d0fe1b6039401ab019ef`.
- Independent Work must examine combined quality CI coverage, PREVIEW Wrangler dry-run, release workflow's *actual* source checkout SHA and hardcoded legacy app434 assertions, no hidden trigger/cron/queue side effects, owner-approved PR merge/updated_at and one-use runtime gate, flags OFF/DO bindings, old Worker partial failure and rollback, v307 Reader protection, UI/likes/Music Note, shared data cost and possible Deploy trigger races. Read-only verification, no edits/commit/merge/push/deploy. Separate any new source FAIL for bounded correction. Do not activate Reader.
- Last observed canonical/PREVIEW/TEST/PRODUCTION=13/13/12/12, old Writer drain HOLD; Work source PASS is not real PREVIEW deployment approval. Stop before TEST/main, PRODUCTION, shared data migration, any user data overwrite/backfill. After review the user must separately authorize PREVIEW Writer-only deployment, and preflight live flags/queue+cron all zero must be checked again.

---

## NEXT — #203 app484 exact PR/head owner approval + partial CLI rollback audit (2026-10-25 KST)
- app483 source audit FAIL on default-main-only manual `workflow_dispatch`, while cron and exact rollback PASS. app484 fixes launch path with existing PREVIEW trigger-file `push`; merged trigger-only PR must be authorized by a GitHub owner comment specifying its final GitHub-retrieved PR HEAD, merge SHA and current preview SHA, with exactly one first-attempt matching push run. Reject direct pushes, non-merge, unknown API response, PR other file changes, wrong owner, duplicate/reused approval. `main` must remain untouched.
- Wrangler deploy may partially succeed then CLI fail: set `deploy_started=1` just before upload; on failure after start check old active version, otherwise guarded rollback and exact 100% version verification, no unproven success report. Existing cron postcheck, 035/069 queue zero, Reader OFF remain. In-flight server requests/DO jobs and prior 13/13/12/12 mismatch still HOLD.
- PR #462 stays Draft/unmerged and must pass final CI and separate **감사방** source review before any further action. Existing app481 PR #461 audited source SHA `5bf84dee4c9db7f0ce8296a57781be9161d8e59f` unchanged. No trigger PR, merge, deployment, user data or TEST/PRODUCTION edits authorized.

---

## NEXT — #203 app483 one-use manual deploy approval + rollback gate audit (2026-10-25 KST)
- PR #462 app482 separate 감사방 **FAIL** at fixed SHA `8d4eaafc936fa32ef30ff355f4b50e7fc5d0538d` (three findings). app483 fixes only release infrastructure: manual `workflow_dispatch` on preview with owner-only input matching exact trigger HEAD SHA + phrase, Actions read-only one-run dedup including failures, first-run attempt only; postdeploy remote actual cron check; rollback command success + live exact old version; zero rows in both bounded known like queues 035/069. Dedicated negative tests; source-only PR CI, then fixed SHA to **감사방**, not Work.
- One-use safety is bound to a manually invoked GitHub Actions run on exact PREVIEW HEAD; a static release trigger approval string cannot auto-deploy. New HEAD requires a new explicit manual dispatch. The current obsolete app434 trigger intentionally fails exact app481 gate. Full background/in-flight queue quiescence is **not established** by two zero counts. If upstream like state changes or cannot be verified, release MUST remain HOLD.
- No PR merge, manual dispatch, app481 deployment, trigger update, remote flag edit, Worker rollback, user-data mutation or TEST/PRODUCTION promotion in this task. App481 PR #461 SHA `5bf84dee4c9db7f0ce8296a57781be9161d8e59f` still audited source PASS but undeployed; old Worker drain & 13/13/12/12 parity unresolved.

---

## NEXT — #203 app482 release-infra independent gate, no deployment (2026-10-24 KST)
- Review `infra/app482-preview-writer-release-barrier` against existing canonical PREVIEW Explore Worker release workflow, independent from app481 PR #461 source PASS (frozen SHA `5bf84dee4c9db7f0ce8296a57781be9161d8e59f`). Keep app481 and original #454 untouched.
- Required CI/test checks: workflow trusted guard from `github.workflow_sha`, exact product SHA + unique user-approved one-shot Writer-only trigger, repair flags expressly false, live PREVIEW/TEST/PRODUCTION curated flags OFF, active-version 100% and PREVIEW binding identity, D1 `pending069=0` before Wrangler deploy, empty preview cron; no old queue drain/temporary cron and no unrelated migration/like repairs. After deploy flags must still be OFF, rollback to old writer only while all remote Readers OFF. Negative tests for missing/duplicate/wrong source and unsafe flags/queue/cron.
- **No trigger edits and no deploy in this task.** Continue PR-level CI; freeze final infrastructure SHA and seek independent **감사방**, not Work room. Only after audit PASS may infra PR be promoted separately from the product; only after explicit PREVIEW Worker release approval may app481 product be merged to preview and new trigger be safely armed. TEST/main, PRODUCTION, shared D1/R2 user data, cached derived repairs and reader flags remain unmodified. Existing live 13/13/12/12 & old Writer drain HOLD are not solved.

---

## NEXT — #203 live writer compatibility HOLD, after app480 source audit PASS (2026-10-24 KST)
- PR #459 fixed head `a586e4e940ed3cb91a25ecda054258b8e0807331` audit PASS, merged diagnostic-only preview `8ad53be2e860bb0d1deec77f2d0dbdaf33872193`. Product app475 PR #454 `ef3a5abe272d7a5e81c6743ec0c6d8f8846ae82d` stays DRAFT, unchanged/unreleased.
- Read-only run #40097597597: PREVIEW browser curated GET API selection PASS, current PREVIEW active Worker fails compatible write route check `PREVIEW_WRITER_ROUTE_MISSING_477`. TEST/PRODUCTION live browser routing NOT CHECKED because probe is fail-fast. Canonical/PREVIEW/TEST/PRODUCTION 13/13/12/12, missing TEST/PROD one song each. PREVIEW three rollout flags OFF; old in-flight drain proof unavailable.
- STOP additional source-only GET/OPTIONS audits; retain certified app480 SHA and fail-closed behavior. Next must be writer-first PREVIEW staging preparation using existing audited app475 product source and additive compatibility, retaining old reader OFF and original data untouched. PREVIEW Writer deployment requires user's explicit PREVIEW deployment request, TEST/main and PRODUCTION require separate approvals. Do not change or promote shared reader until all Writer versions and in-flight old writes are proven, and approved bounded derived cache parity reaches 13/13/13/13 + browsers.

---

## NEXT — app477 read-only active Writer gate QA (2026-10-24 KST)

- app479 minimal final source audit: verify the runtime browser actually observes the chosen curated GET origin from each live Firebase app, catches VITE_EXPLORE_API_BASE wrong-host override, and does not mistake bundled URL literals for an executed branch. The browser aborts Worker backend requests, blocks service workers, and only observes guest navigation; absence of a request must HOLD. Run source tests and CI, then separate 감사방 exact SHA; live Cloudflare remains a separate read-only verification. Keep v466 reader OFF and all deployment approvals unchanged.

- app478: Address independent 감사방 FAIL on PR #459. Recheck three origin-to-Worker mapping via compiled Firebase frontend bundle plus Cloudflare worker domains/zone routes; require isolated EXPLORE_CACHE on PREVIEW/TEST/PRODUCTION. Deterministic old late D1-only write/member/visibility, CAS conflict, durable ACK generation and rollback-order tests must PASS. Reader activation always HOLD without independently verified old in-flight completion. Freeze final SHA only after CI PASS and hand to separate 감사방; then run Cloudflare GET-only live check. Do not touch app475, shared data, remote flags, or deployments.


- Source branch audit/app477-curated-active-writer-gate based on preview bb2a784b827f668725b55acbb5a5bdb54b13ac9b. Separate product PR #454 SHA ef3a5abe272d7a5e81c6743ec0c6d8f8846ae82d stays unchanged.
- Validate verify-477-curated-active-writer-gate.mjs --self-test via existing PR CI, check TypeScript and Build, review three environments' active Worker GET route/membership read only after merge.
- All active Workers must be compatible, live flags remain OFF, and old in-flight retirement evidence must be independently verifiable. Existing Cloudflare API only verifies current routing and cannot prove drain; app477 correctly HOLDs instead of claiming rollout readiness.
- Dedicated separate 감사방 exact SHA audit required before merge. Never enable v466 reader or shadow flags, modify user originals or deploy Worker/Hosting/Functions as part of this audit.
- Next one action after source CI: freeze SHA, independent audit, repair if FAIL. Later staged Writer rollout requires TEST/PRODUCTION director approvals.

---
## NEXT — #203 one implementation: three-Worker live Writer retirement attestation (2026-10-24 KST)

- Design and release STOPs: `DOCS/CURATED_203_MIXED_WRITER_ROLLOUT.md` (read first). No code deployment, migration, shared data writes or automatic flag enablement.
- Implement **read-only active PREVIEW / TEST / PRODUCTION Worker version+module+binding+flag comparison**, fail-closed when any script lacks v466 curator AND visibility/publication writer paths, when a Worker has split traffic, when route owners mismatch or remote flags are not reliably OFF, or when old in-flight writer retirement cannot be attested. Reuse existing Cloudflare GET diagnostics and scripts; no new service, no secrets in logs, no expensive repeated D1 read. Stage source tests reproduce old Worker late D1-only mutation after new R2 reconciliation, forced reader OFF, missing member/visibility, stale CAS, rollback order and warm v307 route preservation. Keep app475 audited product SHA unchanged while designing guard.
- A bounded one-time 40-row/3-environment **derived** cache reconciliation is only a future approved procedure after all Writers compatible. Do not run it now. Final read activation separately approved after real 13/13/13/13 track ID/order parity, PC/mobile cache, Work audit. TEST/PRODUCTION require director approval.

---

## NEXT — #203 only, mixed-writer activation barrier (2026-10-24 KST)

- Current `preview` diagnostic was merged from PR #455, runtime **unchanged**. Live Cloudflare read-only [#40035848324](https://github.com/andrawing1212/soridraw-music/actions/runs/40035848324): all 3 remote curated gates **ABSENT/OFF PASS**, canonical/preview/test/prod **13/13/12/12 FAIL**; bindings PASS. This workflow correctly reports overall FAIL because true runtime parity has not converged.
- app475 product PR #454 DRAFT exact audited SHA `ef3a5abe272d7a5e81c6743ec0c6d8f8846ae82d`, source CI and targeted Work P1/P2 re-audit PASS; **not merged or deployed**. Preserve exact audited source; reconcile docs after later preview base drift only by audited code review, not accidental product rewrite.
- **One next action:** design the **old TEST/PRODUCTION writer retirement and v466 activation barrier** for shared D1 and R2 while preserving app377 live users, preventing a late old writer from leaving shared v466 stale, and avoiding D1 polling on warm entry. Stage release versions across environments without copying/wiping canonical data. Require PREVIEW live safety, PC/mobile warm/cold and canonical 13/13/13/13 parity before marking #203 done; maintain all 3 flags OFF until writer-ready proof.
- Keep app410 likes, Stage416 baseline, Music Note, no all-user scans, zero idle D1 scans. TEST/PRODUCTION changes need explicit director approval. After #203, address Music Note #237; cost work still postponed.

---

## NEXT — FIRST AND ONLY CURRENT TASK: finish #203 curated cross-environment sync (director 2026-10-23 KST)

- **Priority override:** stop cost simulation/usage collection now; do NOT begin Music Note #237 code edits until curated #203/app466 is source-fixed and audited. User wants existing synchronization completed **one issue at a time**. Current preview `d55ae8047492a902a44225aea78151571aca6d1a`; draft PR #447 head `d5f3d132c5d0ccbabb52d95a99de55404b4f33fd`, source CI PASS but unmerged OFF. Fixed-source reviewer note [#5630448326](https://github.com/andrawing1212/soridraw-music/pull/447).
- **P0 test/implementation:** reproduce old app377 TEST/PRODUCTION Worker late curated/publication D1-only mutation after new v466 shared R2 PUT. Current v466 R2-only HEAD/GET on warm entry cannot detect it. Design an additive **mixed-writer retirement/activation barrier** compatible with versioned deployments, without requiring full D1 scan/polling on warm entries or silently altering main/prod. Flag remains OFF until all relevant active writers and readers are compatible. Cover warm existing old browser origins.
- **P1 test/implementation:** successful publication/private/public canonical action + injected R2 conditional PUT failure currently returns original success but leaves no durable derived catch-up. Create deterministic failure and retry/convergence regression using existing bounded change-event path or safe existing coordinator. Preserve original 200 user-data success semantics and 30s save-heart/60s Music Note/150s Recent, public like path, app465 UI, Stage416 OFF; no unbounded retry, global cache purge or extra idle D1 reads.
- **CI/verification:** resolve PR #447 base drift (only docs cost audit moved preview) without overwriting current release state; tests for concurrent promote/remove, visibility, R2 failure, legacy late writer and healthy warm R0, exact worker dry-run, TypeScript/Build, frozen like/Folder/Music Note checks; independent Work exact-SHA review only after revised code fixed. Do NOT enable v466/trigger deployment until audit PASS and safe PREVIEW gate. TEST and PRODUCTION promotions require distinct director approval.
- **Success is real parity** on same canonical D1 IDs/order/visibility and warm/cold clients across three environments after compatible staged releases, not just source tests. Runtime remains 13/13/12/12 FAIL; Music Note #237 separate next task, no private UID/sample inferred.
- **Cost work remains paused:** already documented in `DOCS/COST_ACCEPTANCE_1K_10K_2026_10_23.md`; do not continue or claim cost verification PASS until user resumes it.

---

## NEXT — calibrate 1k/10k model with actual non-mutating cost metrics (2026-10-23 KST)

- Follow `DOCS/COST_ACCEPTANCE_1K_10K_2026_10_23.md` and `scripts/verify-1k-10k-cost-scenarios.mjs`. 1k/10k example numbers are expressly *hypothetical*. PREVIEW is ADMIN ONLY; TEST minimal invited beta, who may concurrently use PRODUCTION, so only actual additional TEST sessions count, not duplicate accounts/canonical data writes.
- **Immediate read-only task:** use existing `scripts/report-cloudflare-d1-usage-readonly.mjs` for shared+all-account D1 rows in 7/30d and private `scripts/audit-firebase-rtdb-metrics-readonly.py` for RTDB sent bytes/connection/response 24h+30d; obtain similarly read-only Workers request+CPU/R2 A+B+storage/DO and Firebase Firestore/Functions/Hosting totals. Keep private operational values in private ops report, not public source. If permissions absent report UNMEASURED rather than invent or escalate roles.
- Verify actual unchanged cached entry read/write 0, no 2× canonical mutation for beta simultaneous TEST+PRODUCTION, source #203 curated + #237 Music Note parity separately. Protect 30s/60s/150s batching, Stage416 OFF, app465 accepted tablet UI, legacy app377. No deploy or shared user data touch.

---

## NEXT — cost acceptance for 1k–10k users and beta TEST↔PRODUCTION (director, 2026-10-23 KST)

- **Use the corrected environment model:** PREVIEW = **administrators only**, never beta testers. TEST = administrators + small invited beta cohort. PRODUCTION = general users, including beta testers who may **simultaneously use TEST and PRODUCTION**. Never assume a third active origin for a beta user.
- **Budget only 1,000- and 10,000-user scenarios now** (declared active fractions/visit/edit assumptions, no mandatory 100k financial test); preserve long-term O(1) cost architecture. Estimate/measure Firestore read/write, D1 billed rows, Workers requests, R2 HEAD/GET/PUT, DO/cache separately for (1) standard PRODUCTION-only traffic, (2) actual active beta TEST+PRODUCTION usage, (3) unchanged warm re-entry/update R0/W0, and (4) one changed song save/publication/like. No 2×/3× canonical writes, background cross-origin fan-out or per-user idle polling. Do not assert dollars without verified unit prices/traffic.
- **Beta continuity acceptance is TEST↔PRODUCTION on the same real UID.** Check Recent/Music Note/Library membership, folders, publication/public profiles, likes/follows, media, stateful heart/lock/public controls and previously cached PRODUCTION browser vs cold login, plus PC↔mobile. Include simultaneous sessions and +30s favorite / +60s Music Note / +150s Recent pending settlement. PREVIEW is administrator source/code QA, not a beta-user data journey; no data copy/migration/wipe/backfill.
- **Engineering remains blocked:** app466 PR #447 source CI PASS but still DRAFT, OFF, and pending exact-SHA independent Work audit and safe rollout fence while app377 TEST/PRODUCTION Workers can mutate canonical D1 without updating the new v466 R2 key. Live curated parity stays 13/13/12/12 FAIL. Music Note #237 requires bounded same-UID canonical sampled reads before any repair. No Worker activation, TEST/PRODUCTION promotion or shared user-data changes authorized.

---

## NEXT — production-first P0 curated revision + concurrency safety, then Music Note sampled canonical (2026-10-23 KST)

- Real same-time-window live evidence twice: run #39860820744 and #39861568822 both say shared D1=13, PREVIEW=13 exact PASS, TEST=12 missing1 FAIL, PRODUCTION=12 missing1 FAIL. Last audit succeeded in PREVIEW Worker source archive and still correctly exited FAIL for product data parity. Source HEAD after audit PR #445 `d0fe1c02bdde9fbf356bb6bf838d129fed2d087d`. No data write/deploy.
- **Codex High implementation target, NOT authorized to deploy:** design PREVIEW fix for curation #203. Shared `curated_picks` D1 remains immutable authority. Implement environment-independent tiny revision/version proof or bounded shared curated snapshot with safe write coordination; ensure same 20 promoted IDs/order across PREVIEW/TEST/PRODUCTION after compatible release. Guard two simultaneous promotions, promotion/removal, publish/private events and R2 conditional-write conflicts; no missed or resurrected tracks. No D1 data scan on warm unchanged Explore entry; no active periodic polling; no full Feed recompute. Derivative R2/Edge is not shared canonical.
- Preserve app465 UI, app410 likes, private user data, same-account current heart +30s and Music Note Detail +60s, Stage416 OFF, app377 backward compatibility. TypeScript/Build, existing `verify-307-explore-curation.mjs` and independent new concurrency tests PASS; Work audit exact SHA; PREVIEW deployment only after review, real PC/mobile and cross-env API assessment. TEST/PRODUCTION no promotion without explicit approval.
- Parallel **read-only first**: for Music Note #237 the target authenticated user and exact divergent favorite IDs still need verified runtime identifiers. Compare bounded per-song canonical favorites, shared R2 Catalog revision and origin-local pending/drafts, never all favorites collection or arbitrary account. No repair claimed.
- Separate app version matching is last step after canonical/derived parity PASS.

---

## NEXT — curated live FAIL confirmed; repair only by safe PREVIEW source plan (2026-10-23 KST)

- [Run 39860820744](https://github.com/andrawing1212/soridraw-music/actions/runs/39860820744) read shared canonical D1 active curated 13 public track IDs and compared top20 live APIs: **PREVIEW=13 exact PASS**, **TEST=12 FAIL missing1**, **PRODUCTION=12 FAIL missing1**; test/prod same visible fingerprint but distinct R2 revision fingerprints. No D1/Firestore/user original write, no deploy. Record result in #203. Do not claim Music Note parity fixed.
- Immediate audit-flow follow-up: existing `cloudflare-explore-cache-live-source-readonly.yml` should keep its original active Worker source artifact capture on an expected curated FAIL and then still fail the overall run; failure must not silently look PASS. A small workflow-only patch prepared on `audit/p0-curated-fail-keep-existing-source-audit`.
- Next full implementation **not yet approved to execute on shared data**: protect canonical `curated_picks` as actual authority; PREVIEW code design for shared revision/changed-ID check across all three environment-local R2 caches; no D1 reads for warm unchanged entry; concurrency-safe R2 CAS/retries for simultaneous curator promotion/removal and public/private events; deterministic tests and Work audit before deployment; release to TEST and PRODUCTION require separate approval.
- Music Note read-only live sampled favorite audit requires known authenticated owner UID and exact sample song IDs. Never scan all favorites or choose PREVIEW cache as winner. No user data mutation, cache wipe, backfill.
- Stage416 OFF; PREVIEW app465; TEST/PRODUCTION app377; no advancement.

---

## NEXT — run P0 read-only Cloudflare recommendation parity audit (2026-10-23 KST)

- PREVIEW app465 is feature reference; TEST/PRODUCTION app377 are currently inconsistent for Music Note and SORIDRAW 추천 (user report). Do not merge caches or promote releases.
- `audit/p0-curated-three-environment-readonly` adds `scripts/diagnose-p0-curated-three-env-readonly.mjs` and extends existing Cloudflare live source read-only workflow. The exact workflow only executes on **its own edited workflow-file push to preview** or explicit dispatch; NO Worker/Hosting/Rules or user data writes. Cloudflare D1 SELECT (40 rows) vs PREVIEW/TEST/PRODUCTION public curated (20 per env), compare IDs/order, sanitized counts/hash; skip body on absent R2 revision to avoid lazy bootstrap. Run self-test and source CI then merge when safe; inspect audit live result.
- Do NOT claim Music Note canonical checked. No identified Firebase UID and per-song IDs, and no direct Firebase live connector. Next safe step is bounded per-song Firestore read + shared R2 Catalog identity/revisions for *confirmed* same-user sample, with no all-user/all-favorites scans or cache reset.
- If curated environments differ, freeze evidence, fix cross-env revision authority and concurrency in PREVIEW via High Codex + independent audit; solve missed dormant Music Note deltas separately; verify real warm/cold cache; TEST and production only on separate explicit approvals.

---

## NEXT — P0 Music Note + 추천곡 PREVIEW/TEST/PRODUCTION parity diagnosis before any release (2026-10-23 KST)

**User report / priority:** PREVIEW code/feature behavior is baseline, but Music Note saved membership differs among all three apps including yesterday's individually saved songs. PREVIEW displays recent `SORIDRAW 추천` curator promotions, TEST/PRODUCTION old promotions. The user welcomes matching versions *if needed*, **not an instruction to promote main or PRODUCTION now**. No forced cache clearing, preview-local data copying, canonical writes or migrations.

**Source pointers:**
- Same Firestore project `soridraw-app-866a5` in all client branches; private media R2 `CATALOG=soridraw-user-catalog` shared according to versioned config, confirm live env bindings.
- Music Note retained `userSync/{uid}/musicNote` holds last signal only; app426 known-mutator Catalog recovery exists in PREVIEW but not main/PRODUCTION app377; historical P0 [#237](https://github.com/andrawing1212/soridraw-music/issues/237).
- Curation [#203](https://github.com/andrawing1212/soridraw-music/issues/203): `env.DB curated_picks` shared, but `curatedBucket307=EXPLORE_CACHE||PROFILE_MEDIA` environment-local derived cache; mutation only refreshes invoking env. Other env R2 revision stays old indefinitely, and unconditional R2 put can lose concurrent promoted-item visibility.
- `src/services/exploreCurationService.ts` local first revision check only against current origin's Worker. `.deploy/release-worker-runtime.mjs` already includes a release-only curated projection parity gate; this does not guarantee day-to-day cross-env updates.

**Work in this order (read-only first):**
1. Lock PREVIEW HEAD and compare 3 live app identity/version/canonical resources. For specific discrepant saved songs, compare exact UID, `favorites/{id}` canonical, Music Note shared Catalog revision/deltas, device-local IndexedDB/favoritesStore/pending heart and media/draft revisions. Separate client display lag vs failed canonical write vs duplicate aliases vs explicit unsave.
2. Compare all three public `/v1/curated?collection=soridraw&limit=20` response track IDs/revision/sources, `/v1/curated-revision`, shared D1 `curated_picks` authoritative IDs/updatedAt and env-specific derived R2. Do not silently assume PREVIEW screenshot equals shared D1.
3. Prepare minimal fix and deterministic tests: dormant offline 2+ Music Note saves/unsaves and app377 warm-cache upgrade; same song +30s settlement; edits/drafts/canonical merging; simultaneous 2 curated promotions, opposite actions, publication/private toggles and R2 CAS conflicts; cross-env stale derived snapshots recover by a bounded shared revision/delta signal without repeated D1 scan (unchanged re-entry R0/W0 goal).
4. Code only in PREVIEW with backward-compatible changes; no user original writes, mass backfill, cache reset, full favorites/Feed read, unexpected Worker/Rules changes or UI/CSS. Existing app461–465 accepted UI, app349 hearts, Music Note 60s, Recent 150s, app410 likes, Stage416 OFF protected.
5. Pin source SHA, TypeScript+Build+focused tests, Work independent PASS, PREVIEW Hosting/Worker deployment only with guardrails, PC/tablet/mobile current/warm/clean device parity. TEST and PRODUCTION only if user expressly requests release after all parity and exact artifact/Worker environment gate PASS.

**Immediate result standard:** If read-only live canonical access unavailable, report **source-level diagnosis only**, protect originals, and do not claim parity fixed. Current Stage416=1/4·25% OFF, speed=5/5·100% historical, P0=1/4·25% diagnosis only.

---

## NEXT — app465 user tablet visual PASS; freeze expanded gutters and scrollbar (2026-10-23 KST)

- User confirmed "통과야" after app465 for three tablet expanded one-pane views: Recent Songs, Music Note, Library. Consider reported left/right Builder gutters and result-only native right scrollbar **accepted**. app464 Create tablet gutters also separately user-confirmed good. Do not ask user to re-explain or reopen these without a new observed defect.
- Source/CI frozen: PR #440 merge `ff6ffc8c06a0724c350cf41c8d3229f5645f2290`, split/TS/Build run #39851081223 PASS, product quality run #39851081137 PASS. Firebase PREVIEW Hosting-only request PR #441 merged `bdeb181ff9364052553a7dfe37002a9ba7b3335c` with app-version465; shared RTDB Rules deploy=false.
- Read-only work still open: canonical Firebase push release conclusion; exact served PREVIEW version465/index hash; TEST/PRODUCTION HTML parity and broader device matrix. Do not claim independent technical deploy PASS from PR merge or user visual PASS alone. No fresh code modification/redeployment required absent failure.
- Protect app461–465 accepted UI, existing splitter rAF, Generate, Music Note/Library local first, shared data, Worker/Functions/Rules and Stage416 OFF. No TEST/PRODUCTION promotion without explicit user request.
- Next one task: verify exact PREVIEW Hosting artifact without mutating the environment when read access is available; otherwise wait for user's next specific development request.

---

## NEXT — app465 tablet expanded Recent/Music Note/Library gutters + scrollbar QA (2026-10-23 KST)

- User accepted app464 Create tablet margins. Their 5 screenshots + 79.9s video demonstrate remaining tablet-only issues when using top one-pane expand toggles on Recent, Music Note, Library.
- Fix only collapsed-state styles in 1100..1599.98px Studio Black Lite V2. Result collapsed => Builder direct masthead/content `width:min(100%-24px,1500px)` centered and Builder inner right pad18; left Studio main18+child12, right pane18+child12, both 30px. Builder collapsed => remove Studio main right18 reserve, result pane right0 and inner right pad36 so cards/list retain their old width/position but native vertical scrollbar reaches right rail.
- Do not change Create, normal split, desktop >=1600, compact <1100, pointer/rAF/scroll storage/Generate, Music Note/Library Local First, protected card/list/title controls, RTDB Rules/Worker/Functions/Firestore/D1, Stage416 OFF.
- Candidate `fix/app465-tablet-onepane-gutters-scrollbar`, from preview `644f77996a54c2fd52acf5e937f67c5cad2bb2d5`, changes `studioLayout.css`, existing split contract verifier, version465, Hosting version allowlist, CURRENT/NEXT only.
- Gate: source TypeScript, Build, split frozen, Music Note/Library UI, product quality; confirm all 3 × both collapse directions, 1100 and 1600 boundaries, app464 Create, scrollbar edge+vertical dragging, split return speed/scroll and page switching. CI cannot replace physical mouse/tablet PASS.
- On CI PASS and independent focused review, merge preview then request Hosting-only Firebase PREVIEW; verify live version/hash and TEST/PRODUCTION unchanged. No approval for main/TEST/PRODUCTION promotion.

---

## NEXT — app464 PREVIEW postflight + native resize and tablet Create user test (2026-10-23 KST)

- PR #437 app464 source merged `d9332d7752b1bc5a4b6098a75f44b232387d106c`, split CI #39845944666 PASS and product quality CI #39845944658 PASS. Hosting-only trigger PR #438 merged `8e8a96d2fbfcd58ac10f19cbc59ead9b8998ac0c` with source version464.
- Remote postflight still unverified: retrieve canonical push-triggered Firebase PREVIEW Hosting workflow run and check `https://preview.soridraw.com/app-version.json=464` and exact index build, TEST and PRODUCTION unchanged. GitHub PR commit workflow search is not the push release log; do not infer PASS.
- User test: resizing native browser between wide, tablet (1100–1599px) and compact (<1100) with the Create/Recent/Music Note/Library tabs; lower Generate row stays within Builder, no pointer-up/window-release snap. Tablet Create direct content inset now copies approved Music Note/Library app1031 centered 24px total gutter; confirm matching actual screenshot. Physical PC/phone tests were not run by CI, so still pending.
- No Source TSX changes or new JS geometry observers; preserve app461/app462/app463 user visual PASS, split/Generate rAF speed/scroll, backend/cost/data, Stage416 OFF. No TEST/PRODUCTION promotion without user approval.

---

## NEXT — app464 native window Generate-bar boundary and tablet Create gutters (2026-10-23 KST)

- User's `20261022-1953-13.9195741.mp4` shows lower Generate row momentarily poking right while external browser window width is changing. User also requests tablet Create left/right margins match Music Note and Library. app463 keyword label 12px accepted.
- Native resize issue: app750 already computes the correct floating left/width from split engine root variables, but CSS 797's independent compositor translate/scale can still apply. Suppress transform ONLY under `html.soridraw-window-resizing`; never add per-resize forced DOM measurement or modify splitter hot path.
- Tablet-only Create 1100..1599.98px: apply existing 1031 24px total content gutter to the Create vertical Builder's direct children; pane scroll shell, scrollbar placement, button/card grid, other workspaces and wide/compact layouts unchanged.
- Branch `fix/app464-resize-generate-tablet-gutters` starts preview `9045bb995a487aa49fe5e58a782c92676079e591`; only studioLayout.css, existing split source verifier, app-version464, Worker-Hosting allowlist, CURRENT/NEXT docs.
- Verify exact source TypeScript, Build, Music Note/Library parity, app448 split Generate and app459 bounds frozen, no backend or data changes. Physical PC video at 1100->1599, around 1100 transition to compact, 1600 transition to wide, fast and slow native resize, also Create/Recent/Music Note/Library no misplaced bar, no release snap. CI static result != physical PASS.
- Preview Hosting-only release on full CI PASS (no RTDB Rules, Worker, Functions or shared data), verify exact live version464 and protected environments. No main/TEST/PRODUCTION promotion, Stage416 OFF.

---

## NEXT — app463 PREVIEW Hosting postflight and user 12px keyword visual acceptance (2026-10-23 KST)

- app463 Music Note keyword font-only source PR #434 merged `2aed69fcfbd7b3bf0623c2092d939f4238f6f5b5`, CI #39842159919 + #39842159994 both SUCCESS. App-version463/Hosting-only trigger PR #435 merged `16d18b6b0b487b5e139f7c2c1e2b70c3289bac23`.
- Technical next: retrieve push-triggered canonical Firebase PREVIEW Hosting release conclusion, exact remote app-version=463 and built HTML SHA; verify TEST/PRODUCTION unmodified. PR-only workflow lookup cannot prove push release, and web/container access to preview origin unavailable in the current chat; do not infer success.
- User next: physically confirm Music Note saved-song applied keyword text is readable at 12px on narrow split/phone/PC, stays within 18px/20px strip, and horizontal pointer/wheel scrolling still works. User accepted app461/app462 previously; don't retest/rewrite normal features without new evidence.
- This was Hosting UI-only: no RTDB Rules, Worker, Functions, D1/cache/schema, shared originals or local-first changed. Stage416 OFF, TEST/PRODUCTION promotion not authorized.

---

## NEXT — app463 Music Note saved-song keyword text readability (2026-10-23 KST)

- User requests keyword text size enlargement in the Music Note song list after screenshots show unreadably small genre/style/other applied keyword text in each row. Restrict to `.soridraw-musicnote-song-keywords > .soridraw-musicnote-keyword-chip` and keep every keyword text visible by existing horizontal scrolling.
- Proposed `font-size:12px; line-height:1.1` across PC/narrow/mobile, regardless of prior 9px default/8px compact override; change only font, no row or chip height/color/padding, state controls, title or data.
- Source `src/components/studio/studioLayout.css` scoped `APP463_MUSIC_NOTE_SONG_KEYWORD_12PX`, existing source verifier `scripts/verify-209-search-persistence-mobile.mjs`, Hosting version463 and Worker-version allowlist only. Base `preview` `13e996f53ae97e3154d1e4a3f2d122970c1491b4` on branch `fix/app463-musicnote-keyword-font-12px`.
- PASS gates: TypeScript, React Build, existing split UI tests, new 12px font-only contract, no data/network additions. Visual in PREVIEW at mobile and split widths: readable text, no vertical clipping, keyword strip can pan/wheel horizontally, no controls pushed out or card height jump.
- On source PASS follow canonical Firebase PREVIEW Hosting-only release, skipping RTDB Rules; Worker/Functions/Cloudflare unchanged, Stage416 OFF; TEST/PRODUCTION promotion forbidden without user approval. Record real deployment result and user visual PASS/FAIL separately.

---

## NEXT — app462 user visual PASS, wait for next directed change (2026-10-23 KST)

- User confirmed “잘 적용됐어” for the released PREVIEW center scrollbar vs split divider mouse hit-zone correction; preserve this behavior.
- Frozen source PR #430 merge `47a23f54ef7ed3bc2a6911a6d3936ad8574a9e07`; product/split CI PASS. Hosting-only request PR #431 merge `fda493c2c91a3efd2593bb85b359b52b60408060`. User visual PASS is NOT proof of official Firebase Actions build-hash postflight; that independent verification remains optional release audit work.
- No additional UI modifications or TEST/PRODUCTION release approval. Do not touch divider 1px line, scroll thumb accessibility, 16px right-side hit target, pointer/rAF engine, scroll preservation, Generate bar, accepted app461 Classic menus, Stage416 OFF or shared data.
- Next work should follow user's new issue/request; update CURRENT_RELEASE_STATE on any major change.

---

## NEXT — app462 verify Firebase PREVIEW Hosting and physical scrollbar/drag separation (2026-10-23 KST)

- PR #430 app462 CSS hit-zone source merged `47a23f54ef7ed3bc2a6911a6d3936ad8574a9e07`, source CI #39814055281 and product #39814055158 both SUCCESS. PR #431 merged `fda493c2c91a3efd2593bb85b359b52b60408060` with Hosting-only app462 release trigger.
- **Next:** retrieve canonical Firebase PREVIEW App Release push workflow result and verify live `https://preview.soridraw.com/app-version.json=462`, exact built index SHA and TEST/PRODUCTION unchanged. GitHub PR-run lookup does NOT include push-triggered release, so the absence of returned release run is not evidence of either success or failure.
- Source change only in `studioLayout.css`: effective 16px RIGHT-side splitter hit zone, LEFT Builder native scrollbar released, drawn divider remains 1px and exact original position. No changes to TSX pointer move, pane scroll/left geometry, Generate bar or data. DO NOT redeploy Worker/Functions/Rules or touch user data.
- After confirmed PREVIEW live, user visually/physically tests vertical scrollbar grip and horizontal splitter separation; include fast/slow drag, pointer-up snap, Music Note/Library long lists and 1100/1600 responsive. Physical proof not yet available; TEST/PRODUCTION promotion prohibited without separate user approval. Stage416 OFF.
- User app461 normal-mode summary visual PASS remains frozen. No additional CSS or engine modification without observed issue.

---

## NEXT — app462 isolate split Builder native scrollbar from splitter hit target (2026-10-23 KST)

- User confirmed app461 PREVIEW visual PASS; next video `20261022-1610-50.2531472.mp4` demonstrates the Builder's native vertical scrollbar cannot reliably be grabbed because its thumb is overlapped by body-level 16px splitter pointer surface. Do not confuse scrolling gesture with horizontal pane resize.
- Current source: splitter fixed left = real boundary-8px, width16px, body portal z130. Desired ownership: **Builder native scrollbar gets everything LEFT of boundary**, **horizontal divider drag keeps a real 16px target RIGHT of boundary**; 1px visible line stays exactly at original boundary.
- Minimal CSS-only fix for Studio Black Lite split >=1100: width24px transparent hit box + clip-path remove left8px + justify-content:flex-start/span margin-left8px. No change to left coordinate writer, React pointer handlers, drag rAF/scroll capture, pane width/gutter or generation bar.
- Existing app459 frozen code guard remains exact; append app462 hit-zone assertions. Run TS, Build, split/Generate verifier and product quality. Manually inspect 1100/1600 profile CSS specificity, no font/color/position redesign; keyboard/screen readers unaffected.
- Physical PC check after PREVIEW release: (a) click scrollbar thumb anywhere, drag vertically up/down without pane resizing (b) immediately right of line drag horizontally, fast and slow, without scrolling (c) release causes no snap, scroll-top/bottom stable (d) mouse wheel, pointer hover, touch and tablet if available. Static CI is not physical pointer verification.
- No new Firebase/Cloudflare backend, no shared data change, main/TEST/PROD untouched; app461 accepted Classic UI protected. New Stage416 activation prohibited. Next: obtain exact source-commit CI PASS and independent split audit before PREVIEW release.

---

## NEXT — app461 verify Classic normal keyword summary on PC and mobile growth before any split change (2026-10-22 KST)

- User asks for selected keywords/custom entries in Genre, Style, Sound, Mood, Theme summaries to stay readable rather than shrink as counts rise, with dashed summary extending DOWN by required line count. FIRST implement Classic normal mode only; split mode remains untouched until user accepts the visual outcome.
- Source candidate branch `fix/app461-compact-summary-grow`, based on `preview` `6492fcd5a12f9feef8b0d1ab6de159bf78dbf452`: append Classic theme normal-only scoped CSS `APP461_COMPACT_SUMMARY_GROW_WITH_CONTENT` in `src/components/studio/studioLayout.css`; version461 Hosting candidate + frozen Worker allowlist only. No App.tsx logic, splitter, data, Worker, Functions or Rules changes.
- Verify 0/2/6/12+ selected keywords and long direct-input entries in five menus at 320/390/500/820/1099px and 1200/1600px Classic PC, both expanded/collapsed, editable pencil reachable, no clipping or overlap, following cards push down naturally. Ensure Studio Black split/compact remain unchanged; desktop/tablet split >=1100px unchanged, including 660/820/1080 pane thresholds and pointer-up.
- Confirm TypeScript, Build, existing UI/split/source verifiers and clean review; only commit/PR/merge code under approved workflow, NO deploy without user explicit request. PREVIEW still app460 until release. Stage416 OFF, shared originals and TEST/PROD protected.
- Next one action: source-only / CI regression verification of app461 candidate and merge only if PASS.

---

## NEXT — app460 PREVIEW live Classic Dark search rounded right-edge acceptance (2026-10-22 KST)

- PREVIEW app460 deployed through exact SHA `d3e9ead7d03c2356c3875c9670b2a9d1e6f3f440`, Firebase release #39781912125 SUCCESS. Source PR #425 tests #39781442420 and #39781442314 PASS; exact live version460 and HTML build PASS, TEST/PRODUCTION unchanged, shared RTDB Rules skipped.
- User's screenshots show inactive standalone Classic Dark mobile search button's right corner clipped next to colors. New resting pill exact slot width, 16px rounded clip and zero intrinsic min should now match the approved split compact pill. Test physical narrow external browser + phone Music Note and Library, folded and focused query/X, all seven dots and filter fully visible.
- app459 row budget + real center workspace split min430 and Stage416 OFF protected. No backend/user data changes. Do not promote TEST/PRODUCTION without user approval.
- Next: obtain actual user visual PASS/FAIL from preview.soridraw.com.

---

## NEXT — app460 dark mobile idle search right corner (2026-10-22 KST)

- User's three screenshots show standalone dark Music Note search truncated at right but accepted split view rounded. Existing app459 phone row width model and real workspace split bounds protected.
- Change only inactive mobile/standalone Music Note+Library search surface: absolute exact parent width, min-width0, rounded 16px clipping, maintain 46px button; active/focused 260px overlay, X and seven dots unchanged.
- Gate: exact source CI TypeScript/Build, UI/split, product quality, then Firebase PREVIEW Hosting version460 exact build and TEST/PROD unchanged. Physical mobile acceptance afterwards; Stage416 OFF, no shared data change.

---

## NEXT — app459 Firebase PREVIEW live external/phone no-overflow acceptance (2026-10-22 KST)

- app459 PREVIEW deployed via source PR #422 and release PR #423, exact deployed commit `7cf2ce75551d3b90f9b6ebf6df375c252d9cccae`, GitHub Actions #39776944798 SUCCESS. Firebase Hosting only, version459/exact bundle parity PASS, TEST/PRODUCTION unchanged, shared RTDB Rules skipped.
- Check user-real 320/360/390/414px phones and desktop detached Music Note + Library (workspace/playlist): after app459 the **resting** search/color/filter controls must not overrun the row, search/button must not cover any color dot, seven dot *painted sizes* unchanged. Search click must preserve responsive 260px overlay with visible query and full X without spilling outside phone viewport. The accepted app457 narrow split row remains canonical.
- Test PC external window resizing and splitter to extremes: actual center workspace>=860px keeps >=430px each; below860px divider is fixed centered because mathematically infeasible. If user wants truly readable two 430px panes below860, a separate explicit one-column/compact routing decision is needed; don't invent dangerous CSS clipping or auto-collapse.
- Source protection: ONLY Lite split `getSplitBounds` changed; exact unchanged remainder verified with new scoped gate; drag/rAF/generation and Music Note/Library local-first data unmodified. Stage416 OFF. No TEST or PRODUCTION without approval.
- Next action: user's PREVIEW app459 physical result.

---

## NEXT — app459 verify overflow protection and split bounds (2026-10-22 KST)

- User request: FIRST prevent search/color/filter row from running outside real mobile/externally resized Music Note/Library width and search resting button overlapping color tray. SECOND prevent shrunken PC window splitter from crushing left/right panes; preserve full PC user-approved app457 split visuals.
- CSS app459: seven dots same painted size; fluid hit widths/gaps by parent row width under420px, search/filter min42 and 6px row gap, popup min260 capped to viewport on phones. Verify real page content widths>=256 and selected colors/refresh/filter text/X unaffected. Narrowest physical devices <320 need separate check.
- Split app459: use real center-workspace width for 430px minimum pane bounds in wide + tablet, clamp 50/50 when total<860px; retain 24/76 when 24% width already>=430. Do not change split pointer rAF, page data or routing.
- Gate TS/Build/app209/split/frozen product CI. If PASS, only Firebase PREVIEW Hosting per user's normal UI test workflow; exact remote appVersion459/build hash and TEST/PRODUCTION unchanged. User visual test required for narrow window/actual mobile and pointer-up.

---

## NEXT — app458 deployed; verify compact UI parity on external window and real mobile (2026-10-22 KST)

- Firebase PREVIEW app458 live at `https://preview.soridraw.com` (release SHA `d339bd6b438cae33a5b675d8eabcc8ea3be17530`; GitHub Actions #39771447456 SUCCESS; TypeScript/Build, exact build/live version458, TEST/PRODUCTION unchanged, RTDB Rules skipped).
- PERMANENT canonical UI: user-approved app457 **Studio Black split RESULT compact** Music Note/Library upper controls apply identically in narrow standalone/external windows, ordinary dark mode and actual mobile devices. All future Music Note/Library common top changes must be evaluated across these modes together. Do not fork their CSS by theme.
- Validate on actual device/desktop: tabs width fits three evenly, search icon centers in short button then moves smoothly left, search/filter share width then filter caps104, mobile refresh+seven dots intact, `필터` never vertical-wrap, search focus opens min260 overlay and 32px X, placeholder fades when enough width without jitter; check Library Workspace + Playlist and dark theme on mobile. Below 399px dot visuals remain full size while invisible click spacing condenses.
- If physical UI fails, minimally adjust these shared controls, not app457 split pointer engine/Generate, list data or caching. Stage416 OFF, shared originals unchanged, no TEST/PROD approval.
- Next one action: user's PREVIEW app458 observed result.

---

## NEXT — app458 adopt split-result compact top UI everywhere at mobile page width (2026-10-22 KST)

- User-approved visual reference: app457 Studio Black split RESULT's narrow Music Note + Library controls. Ensure external/detached browser window shrunk to phone width, standalone dark and real mobile display the same search/color/filter geometry/actions. Full page at >660px retains normal desktop/tablet layout.
- Candidate CSS app458: search/filter share 42px flex basis, filter cap104 with label at filter wrapper>=103, 7 dots + refresh at constant visual sizes, refresh width34..52 fluid; search center→left as it grows, query overlay min260 and full X, hint only when slot>=200. Three top tabs fill content width, <=480px. For 320..399 px keep all dots by narrowing *button spacing only*, not dot size.
- Check user video screenshot: external narrow `필터` no longer breaks into stacked letters, external search button no longer stays fixed42 while right has spare room, no oversized/changed reset state in dark mobile. Also Library workspace+playlist. No split changes, data writes, backend changes.
- CI TS/Build, app209/split, protected product quality; PREVIEW Hosting-only after pass, validate exact appVersion458 and TEST/PRODUCTION unchanged. Actual physical mobile/external user PASS still pending.

---

## NEXT — app457 deployed; user real-device divider acceptance (2026-10-22 KST)

- Current PREVIEW Hosting app457 at `https://preview.soridraw.com`, deployed exact SHA `efd56032e77f7915a192b1151578e746094af69e`, GitHub Actions #39767924833 PASS (TypeScript/Build/Hosting/index-hash/version457, TEST/PRODUCTION unchanged, Rules SKIPPED).
- Verify Music Note + Library split right pane slowly and rapidly across mobile→tablet boundary: all search/color/filter buttons retain continuous aligned positions and sizes while the search hint fades in; no old UI snap at breakpoint; reverse shrinking is continuous, focused query overlay and X retain their clicks. User reported app456 otherwise satisfactory.
- No backend, data, deployment of Functions/Cloudflare, Stage416 ON or TEST/PROD changes. User actual video feedback is the last gate. If FAIL, change only CSS and rerun PREVIEW workflow.

---

## NEXT — app457 cross-mobile/tablet search-bar seam (2026-10-22 KST)

- User videos app456 show noticeable Music Note search/color/filter row shake exactly as hint text appears. Apply one geometry layout for all Studio Black split-result Music Note/Library modes rather than old mode-specific mobile/tablet rules switching at 660px; no changes to React, split engine or data.
- Search+filter grow continuously; filter capped104; mobile refresh+7 colors and app456 fluid 34→52 reset preserved. Show filter label only when its actual button wrapper >=103. Keep focused search overlay max(260px,100%) + 32px X. Unfocused placeholder only fades into an unchanged-size search box once the search slot width >=200px.
- Tests: TS+Build, app209 split/source contract, product quality and browser responsive 600–740 around handoff both directions with no 1-frame geometry jumps, focus X, color/filter click. Source assertions alone not sufficient for real-user UI PASS.
- User explicitly requested PREVIEW redeploy after correction, never TEST/PRODUCTION. No Worker/Rules/Functions deployment and no user data write. Next one action: verify app457 PR CI, then Hosting-only PREVIEW release and log final state.

---

## NEXT — app456 search-center / palette reset fluid resizing (2026-10-22 KST)

- Apply only app456 Studio Black Music Note/Library result-pane CSS: (a) narrow search magnifier stays horizontally centered as search/filter flex widths grow; after filter complete (104px), icon slides continuously into left 16px input alignment while search alone stretches; clicked 260px overlay and X preserved. (b) palette reset/refresh pill width smoothly grows 34→52px with image fixed 16px, no sudden text/width swap, remaining dots unchanged. Reverse resizing symmetric. All done without per-drag React/browser measurement.
- Candidate `fix/app456-centered-search-smooth-reset`: app version456, source-contract test, Worker version whitelist +456 only, docs. Protect existing app455 no-right-gap row, filter label query, UI tabs, split rAF pointer path, Generate, shared user data, server costs, Stage416 OFF.
- Gate: TypeScript/Build/UI-and-frozen-general suite; browser computed widths ~400..700, centered icon before 104px, interpolated up to 160px, no reset width snap at 660, focus/X and popup not occluded. No deploy on current request. Next: review PR CI and report source candidate; user can request `프리뷰배포` when ready.

---

## NEXT — app455 PREVIEW real-use validation after successful release (2026-10-22 KST)

- PREVIEW app455 released via fixed SHA `02965d29a9184b1bf3f55f34af23a00d58052b96`; GitHub Actions #39726868723 SUCCESS (Hosting exact build+version455, TEST/PRODUCTION unchanged, shared Rules skipped). Source PR #409 TypeScript/Build/search/split #39726623865 and product quality #39726623864 PASS.
- User video request: as RESULT pane grows from mobile width, no initial right gap; search and filter share free width until filter reaches 104px with icon, text and chevron; palette remains unchanged 7 dots and filter caps; thereafter all extra/reduced width belongs to search smoothly without group moving or snapping. Narrow reverse naturally. Focused search retains app454 260px right-overlay over color dots, X hits.
- Follow-up is **actual user physical drag/click verdict**; isolated Chromium fixture proved CSS flex geometry, not live authenticated UI. If FAIL, adjust only Music Note/Library split top-row scoped CSS. Keep app448 Lite splitter/rAF/Generate and standalone/mobile behavior unchanged.
- No backend, Rules, Worker, Functions, Cloudflare, user canonical data or Stage416 activation. No TEST/PROD promotion without user approval. Next action: user tests preview.soridraw.com app455 and reports result.

---

## NEXT — app455 mobile result top-row flex from first pixel (2026-10-22 KST)

- On app454 real video, narrow Music Note/Library split top row search+color+filter does not fill to right edge. During drag, responsive mode switch causes an apparent group slide/snap. User: fix start state first. Search and filter should BOTH grow on pane widening, filter stops at full icon+text+chevron size, color remains fixed; after that search alone continues seamlessly; narrowing reverses naturally. Focused search remains app454 260px overlay over fixed dots.
- Patch only `studioLayout.css` and search source verifier; app version 455, Worker frozen Hosting version allowlist only, current docs. No split engine/pointer/React resize changes.
- Validate Browser responsive widths 400..660 (no right gap, color invariant, filter cap104, search continuous), 660→661 handoff, no unwanted fullwidth/standalone mobile changes, Library playlist variant, empty/typed X, no pointer-up snap. Local isolated layout model PASS is not user real app PASS.
- If CI TS/Build/app209/app303 and product suite PASS, release only PREVIEW Hosting and exact built/version/TEST-PROD unchanged verification. Next action: audit app455 PR CI before merge/release.

---

## NEXT — app454 PREVIEW user UI acceptance (2026-10-22 KST)

- Already deployed via Firebase PREVIEW Hosting workflow #39708218886 SUCCESS, app version 454; exact source PR #406, trigger PR #407 merge `8f93f680aaa3e8a378b1ec11677d5af775b17a90`; TS/Build/search/split quality PASS.
- Ask user to physically check Studio Black split Music Note and Library as right pane reaches page-mobile <=660px: collapsed search equals filter width **42px**, clicking search overlays **260px** to the right **above** the unchanged seven-color palette (dots/refresh/filter do not resize or shift), text is visible and 32x32 X fully clickable. Cross back to >660px ensuring previous search behavior returns; fast/slow divider, pointer-up no jump. Standalone mobile unchanged.
- User real-device UI PASS/FAIL remains PENDING. Protect existing app448 splitter/Generate, Music Note/Library data/local-first, Stage416 OFF, no backend. TEST/PRODUCTION remain unchanged and require explicit approval.
- Next one action: user PREVIEW app454 visible result.

---

## NEXT — app454 narrow result-pane search button + overlay (2026-10-22 KST)

- User video after app453 PREVIEW: search does not fully collapse at minimum pane, and focused 42px search does not provide enough visible text. Preserve everything already improved.
- In Studio Black Music Note/Library result page's <=660px **pane-mobile mode only**, give search same 42x46 footprint as filter; focus/nonempty value opens a 260px inner overlay rightward **over** fixed mobile refresh+seven-dot tray. No palette contraction, tab change, filter reposition, new event handlers, drag work or standalone mobile modification. X remains actual 32x32 click target.
- Verify read-only source assertions, TypeScript, Build, frozen split/Generate checks, then PREVIEW-only deployment and user physical split 430-660px + >660px crossover, X/palette clicks, fast/slow split movement. CI alone is not physical browser acceptance.
- TEST/PRODUCTION and shared user original data unchanged; Stage416 OFF. Next one action: get app454 source CI PASS before preview release.

---

## NEXT — app453 PREVIEW live UI user acceptance (2026-10-22 KST)

- PREVIEW app453 **deployed** via exact release workflow #39706071655 SUCCESS, release trigger merge `1aceae54d0ebb93affcf26fcb815e100b8243793`. PR #403 source, TypeScript, Build, #39705760899 and #39705760920 PASS. Hosting `https://preview.soridraw.com/` app-version.json=453 and built-index parity checked; RTDB Rules SKIPPED, no Functions/Worker/user data write, TEST/PRODUCTION unchanged.
- The user wants fast real-world visual acceptance rather than extra static audits for this UI-only fix. User checks Studio Black Music Note and Library divider min↔max, all 3 top tabs, mobile refresh/seven dots unchanged, filter fixed, search magnifier on the left, X clickable over its full 32x32 footprint, focus with empty and typed values. Existing app448 split speed and pointer-up snap unchanged in perception.
- No claim of real browser PASS until user confirms. If visual failure, fix only narrow CSS contract before next PREVIEW; never retroactively claim a CI token check validated clicks. Stage416 OFF, TEST/PRODUCTION remain untouched.
- Next one action: collect user's actual PREVIEW app453 UI result, then decide minimal follow-up.

---

## NEXT — app453 Music Note / Library split top controls PR QA (2026-10-22 KST)

- Review the user-reported app452 regressions: cropped 3 top menu buttons, magnifier relocates to search center, X only partly clickable, mobile seven-color bar morphs to desktop `전체` state.
- Review candidate `studioLayout.css` APP453_STABLE_MOBILE_COLOR_SPLIT_TOP_CONTROLS only. Keep three-tab layout inside result width capped 480px; keep mobile refresh plus 7 color dots at all pane widths; filter fixed, search only elastic and magnifier left. X must accept input across all 32×32 pixels.
- Run `node scripts/verify-209-search-persistence-mobile.mjs`, split browser verifier app303, TS and Build, then actual browser split drag (430/660/820/1080 thresholds and pointer-up). Static assertions are not browser QA.
- Branch candidate only: **no PREVIEW Hosting deployed**, no TEST/PRODUCTION promotion, no data or backend change. Next action: validate PR and audit before merge/release.

---

## NEXT — app452 PREVIEW real-use acceptance, no new work until user reports a defect (2026-10-22 KST)

- Product/Hosting **DEPLOYED PREVIEW**: PR #400 source commit `7f05dda23cbb0333ac2e572f7c5529738e315667`; guarded release trigger PR #401 commit `176815fcb92b8d6b1791974472929f6abb8d1492`; exact release run `39701418484` SUCCESS with PREVIEW HTML and app-version.json version 452 parity.
- Changes are strictly passive CSS/layout for Music Note and Library in Studio Black split result pane: 480px fixed mode-tabs shell scrolls within narrow viewport, color tray does not flex-grow, search slot alone receives free width; empty focus displays X; X clears search, blurs and returns inactive state. Shared mobile and standalone search behavior retained. No hot-path splitter pointer/Generate change, no backend read/write, no Rules/Worker/Functions change. Stage416 OFF.
- CI #39701085092 targeted PASS, #39701085089 full quality PASS, TypeScript/Build + app303/209 PASS. User physical splitter fast drag, mouse release snap and responsive PC/tablet/mobile remain unverified. Test first; don't claim "no performance regression" based only on static source.
- If user validates PREVIEW, preserve and await TEST approval. If visible regression, fix only scoped CSS/clear behavior, avoid splitter rewrite. No Codex used.
---

## NEXT — app451 PREVIEW Master Apply success acknowledged (2026-10-22 KST)

- The user confirmed `적용됐어.` after app451 PREVIEW release #39695878693: the Master performance mode Apply no longer exhibits the reported blocking behavior. This is USER CONFIRMED for Apply, not blanket multi-device or TEST verification.
- Only remaining optional PREVIEW acceptance checks: navigate away/back, Guest or second-device Studio propagation, mouse pointer-up behavior, and mobile/tablet appearance. Do not spend Codex or make new changes without a specific failing result. Shared RTDB Rules, user originals and Stage416 remain protected; TEST/PRODUCTION require explicit approval.

---

## NEXT — app451 PREVIEW deployed; user acceptance test for saved Master performance mode (2026-10-22 KST)

- User video exposed app450 stale Remote Config parameter/revision0; fixed in PR #394 source `f9a9ff10701056d70d1c8a5820dc8f7812ddfe96` with existing Master callable read of server truth on App Settings entry, one-time Studio parameter bootstrap, no new socket/RTDB Rules, no data changes and app451 browser version bump.
- **PREVIEW Firebase Hosting/Function deployment SUCCESS** after protected retry: final run #39695878693 fully PASS, trigger commit `e0c3a4b535c870d48aae5910d9639428eed6a32a`, source QA #39694892169 and overall app quality #39694892170 PASS. Old partial run #39695334775 already changed target Master Function but hit unrelated pre-existing non-ACTIVE Function inventory guard; guard fixed PR #396, final retry #397 safely verified all unrelated Function state+timestamps unchanged.
- Run user Master PC sequence: choose 성능우선 → Apply → navigate to another page → return to Admin App Settings (must still show 성능우선) → open Studio, compare split mode. Repeat 보통/품질우선. In separate Guest Studio browser, verify global RC update; mouse release update semantics; mobile/tablet visual unchanged.
- Direct authenticated Master browser functional test remains **UNVERIFIED** by tool (CI mocks + exact Hosting and inventory passed). If actual error remains inspect only specific callable response/RC publish/get and browser fetch, no default/shared RTDB Rules or bulk user data mutation. Keep Stage416 OFF. TEST only by explicit future approval; PROD explicit approval. Codex reserved and not used.
---

## NEXT — fix real app450 Master setting persistence via existing RC, version451 (2026-10-22 KST)

- User's VIDEO confirms app450 PREVIEW bug, red stale Master conflict after Apply followed by mode default/reset on navigation. The released app450 bootstrapped Remote Config only once under a prior feature's storage marker; new splitFrame param never fetched on existing clients, leaving revision0.
- Fix in PR #394 `fix/app450-master-server-reload`. Preserve all app448 splitter/generation UI. Add Master-only `action:'read'` to existing single Function for exact server mode/revision on Admin settings mount; no save until read succeeded, no UI claim of success until existing ETag-publish returns revision. On success publish local Studio signal; on failed Apply reload canonical server truth.
- Guest/auth Studio only runs one-time bootstrap when split UI actually mounted and old RC cache lacks new param; reuses existing RT listener, no extra RTDB websocket or Rules. Reject older cached rev after newer confirmed server rev. Existing version signal continues unchanged; browser app version 451.
- New isolated Master read and client reentry mock tests, full TS/React/Functions builds and app448 303/214/418/434/435 mandatory PASS. Existing Function UPDATE only; Stage416 OFF, Rules unchanged, main and production unchanged.
- After CI success merge source PR and trigger guarded PREVIEW-only release with exact code SHA and postflight. User then re-tests app settings with Master: performance → Apply → page away/back same mode → Studio shows performance → switch quality and repeat. **Do not claim live app451 before release run success.** No Codex consumed; preserve scarce budget.

---

## NEXT — app450 PREVIEW deployed, obtain user functional acceptance (2026-10-22 KST)

- **PREVIEW release SUCCESS:** product source `fc64b6a1747902a8645207d81cdf55d36662e81e`, release trigger commit `910861e79d67264c49e056d331da8846f518618a`, GitHub Actions run **#39690606880 SUCCESS**. Exactly new `masterSetSplitFrameMode` callable + PREVIEW Hosting, app version 450, no shared RTDB Rules PUT, data migration, Cloudflare, or TEST/PRODUCTION changes.
- **Immediate acceptance task:** Master visits `preview.soridraw.com/admin/app-settings`, sees three split performance modes and clicks Apply; separate Guest browser Studio and authenticated Studio should receive update through *existing* realtime Remote Config listener. Confirm dragging does not switch the frame mid-pointer; check layout PC/tablet/mobile and speed. Code/CI/Hosting verified, **actual user session yet unverified**.
- **Security follow-up:** old PR #383/#386 shared RTDB Rules plan MUST STAY unmerged. App450's new mechanism is Remote Config Admin `getTemplate→publishTemplate` with ETag CAS, no force, versioned per-env params, Master-only callable, trusted Origin and PREVIEW default env list. Actual runtime IAM for remoteConfig publish is not yet verified by a live Master Apply. If permission error, inspect Cloud Function identity and minimal role; never silently substitute RTDB Rules.
- Costs: reuses app's existing realtime RC listener; no additional RTDB connection or per-drag writes, but actual 100k cost/RC fetch load unmeasured, do not claim measured PASS.
- On PREVIEW user PASS, future TEST needs explicit approval, functions exact artifact inventory and env allowlist; PRODUCTION separately approved. Stage416 remains OFF. Preserve app448 Generate/side panels, Music Note/Library, canonical shared user data. No further Codex usage.

---

## NEXT — app450 fast existing-Remote-Config release (2026-10-22 KST)

- User requests immediate Master split setting application. Preferred source is new PR #391 `fix/app450-existing-remote-config-fast` from PREVIEW `1332254e140ef5c8dc3e60d06ef4cc9719367729`. Do not use old P1-blocked RTDB Rules PR #386/#383 source or update shared Rules.
- Reuse existing app-wide Firebase Remote Config `onConfigUpdate` signal: one environment-specific parameter `soridraw_split_frame_{preview|test|production}_v1` with `{mode,revision}`. Guest/auth use existing websocket/HTTP listener; no second connection. Master-only one Function uses ETag (Admin SDK getTemplate→publishTemplate without force) and revision CAS; default server env approval `preview`, promote later using separately authorized env config on identical artifact.
- Stage precisely `masterSetSplitFrameMode` Function in an isolated package, never deploy unrelated Functions/Stage416; PREVIEW Hosting only. No shared RTDB Rules PUT, no Firestore user data mutation, no Worker.
- Run new app450 QA, TypeScript, React/Functions Build, frozen app448 303/214, existing Rules 418/434, Master mock race/ABA and one-function stage. After PASS, guarded `preview-app450-remoteconfig-release.yml` can run via an exact-SHA trigger. Verify before/after Functions inventory and `preview.soridraw.com` exact deployed HTML, TEST/PRODUCTION unchanged. Stop and disclose partial deployment if anything fails.
- If not yet deployed: mark DRAFT/CI only; do not claim live Master settings. After PREVIEW, user should physically check Guest, signed-in, two Masters and mid-drag mode switch; 100k Remote Config price baseline is **not measured**, though it reuses the existing listener. Preserve Codex 19% remaining and High.

---

## NEXT — app450 independent FAIL: solve shared Rules release P1 without unsafe PUT (2026-10-22 KST)

- Read `DOCS/APP450_AUDIT_FAIL_RELEASE_ALTERNATIVES.md` FIRST. User's separate independent audit of #386 `7516a826e562a2c18eb9f6614dbf0f99ddd9773c` + #383 `e365b0512d419ce7b4cda13d897b84c74853e273` **FAIL**. CI PASS is not release PASS.
- **Current P1 gate:** no validated compare-and-swap/exclusive writer for shared RTDB `/.settings/rules.json` full replacement. No default shared Rules PUT/CLI deploy, no full-tree rollback. Older #383 release pins `9081be5a...` differ from #386 Function blob `5e005297...`; do not update pins and deploy until architecture itself is safe.
- Candidate preferred security escape hatch: **separate single-purpose RTDB database instance** under same Firebase project. It has independent Rules; keep default shared RTDB and all user canonical data unchanged. New tiny `{mode,revision}` record permits atomic version check and ABA rejection, server-only writes and guest reads. New instance is NOT created: must check Blaze eligibility, URL, setup permissions and owner approval first, since a second live socket for Studio raises 100k billing concerns.
- Cost guard: new listener ONLY when actual Studio splitter/Master panel mounted; avoid subscription on all signed-in app navigation. Measure extra per-client active connections, downloads including protocol/TLS, reconnect storm and 100k monthly total cost; no claims of 0 extra cost or live 100k PASS. Compare with formally exclusive shared Rules writer route before selecting.
- Release compatibility: server-approved env list defaults PREVIEW and separately authorizes TEST/PRODUCTION on same artifact after explicit release permission; never trust browser-supplied environment and never hardcode permanent PREVIEW-only denial.
- Independent safety tests: Guest ACL vs private parent, Admin denied vs Master version transaction, app448 UI/split/Generate freeze, real SDK reconnect response, offline stale Apply, TEST/PRODUCTION data compatibility, one-function artifact identity, full matching final source pins. Deployment only after independent audit PASS and owner-approved infrastructure; PROD only explicit approval.
- Do NOT use more Codex Medium/High while usage is scarce; no GitHub product code merge, shared data mutation, Stage416 activation or default/shared Rules deployment. Default state remains RELEASE BLOCKED.

---

## NEXT — Work-only app450 independent audit #388, no implementation/deployment (2026-10-22 KST)

- GitHub audit issue **#388** https://github.com/andrawing1212/soridraw-music/issues/388 is an exact-SHA read-only checklist, **not** an automatic Work invocation.
- Fixed combined code: DRAFT PR #386 `7516a826e562a2c18eb9f6614dbf0f99ddd9773c`; React/Functions TS & Build, frozen app448, guest Rules Emulator, offline mocked runtime, Master atomic transaction mocked runtime and one-Function package passed #39675950774 and #39675950941.
- Fixed Codex prep: DRAFT PR #383 `e365b0512d419ce7b4cda13d897b84c74853e273` with no PUT/deploy adapter, old file pins; #39670790334 PASS; do not reuse unchanged with #386.
- P1 actual shared RTDB Settings Rules REST PUT has no proven atomic conflict guard, emulator stale If-Match lost an unrelated rule. Official `app-management` docs call PUT a whole-rules replacement, generic data ETag is not adequate evidence. **No real PUT, Functions deploy, Hosting deploy, merges or TEST/PRODUCTION changes** until a separately audited exact endpoint safe route is proven.
- Independent Work reviewer should check canonical Master role + PREVIEW only, public 3 scalar leaves and old protected siblings, Guest/signed-in subscribe and reconnect freshness/cleanup, ABA stale intent, 100k download/socket cost (unmeasured), app448 drag/Generate/UI preservation, old app compatibility, and issue #388 documented exact sources. Work needs to be started separately and must be read-only.
- Codex budget: user last reported 22%; do not request another Medium/High task for this read-only audit.
- After Work FAIL, report isolated exact blocker and repair without risky shared user data operations. Work PASS on code alone cannot lift Rules release blocker.

---

## NEXT — independent Work audit on integrated app450 commit, no Codex or deploy yet (2026-10-22 KST)

- Pin DRAFT PR #386 `515bc8b3e36f37d886bbe42def9846048e125216`; base PREVIEW `53ca74357e344b4648f5d8a93db0e3cbcd6c7e58`. Verify exact combined guest/source/Rules/Function code, not separate historical PRs in isolation. Full `DOCS/APP450_UNIFIED_AUDIT_HANDOFF.md` lives on PR #386, not preview until approval.
- Inspect successful CI #39674743372 and #39674743324 including Firebase RTDB demo emulator guest leaf allow/parent/private/write deny, runtime `.info/connected` error/visibility/online/offline and cached callback behavior, two Master atomic transaction expectedMode compare+abort, one Function package, existing Stage416/app448 303/214/418/434/450, React TS/Build and Functions TS. Determine what mock/CI does **not** establish. No claim of actual physical SDK success.
- Inspect DRAFT PR #383 `e365b0512d419ce7b4cda13d897b84c74853e273` (Codex original `781edfcb...`) as a **non-executable blocked** prep only. Emulator `/.settings/rules.json` returned ETag absent/stale If-Match 200, lost concurrent sibling: this cannot prove production atomicity. Do NOT put shared RTDB Rules, reuse old SHA pins, deploy Function or Hosting, or bypass Work because source CI succeeded. A secure exact-endpoint atomic or exclusive writer design is needed, then independent release-gate audit.
- Check overlapping client+Function expectedMode contract, module export isolation, original Master role check, PREVIEW-only write gate even with retained env var, guest ACL, cache/offline and stale Master UI, old TEST/PRODUCTION compatibility, no new per-drag reads/writes or whole collection changes, and 100k socket-cost unknowns. App448 splitter/Generate/CSS and user original data must remain unchanged.
- User reports Codex Medium use at 22% remaining: no more Codex unless absolutely essential; High unspent. Keep PREVIEW last-live app448; TEST and PRODUCTION unchanged; Stage416 OFF.
- **One next action:** run independent Work in separate audit role on fixed PR #386 and #383, no code mutation, commit, push, or deploy. Report PASS/FAIL with P1/P2 evidence; if any P1 unresolved, leave rollout BLOCKED and give precise next edit.

---

## NEXT — independent audit of app450 source+guest Rules+single-Function package, THEN safe release mechanism (2026-10-22 KST)

- **Fixed audit inputs**: PREVIEW base `b095f5a2e5677a393b2b60cdc837daaad898820b`; source PR #379 `f156ea7a382ffbe992fbeeb331405af49ba3542f`; one-node guest RTDB Rules DRAFT PR #380 `2651575eb452b55d703a8504a67bb3ca2f5b1aaa` (base #379, combined CI run #39665345869 PASS); isolated Function DRAFT PR #381 `a83e8bef059eac29060e90223ccb01e651b5777a` (CI #39666428636 and #39666428842 PASS). None of these feature/rules branches are merged or deployed.
- **Work review must check** exact Rules leaf/parent hierarchy and denial of existing private and navigation nodes, emulator logs, guest/sign-in listener lifecycle and onValue cancellation/retry, two Masters and stale Apply, original auth-vs-isolated Master callable equivalence, one-Firebase-Function artifact scope/secret contamination, TEST/PRODUCTION-old-code compatibility, 10万 connected listeners and startup/reconnect cost, frozen app448 UI/Generate and server read/write 0 except explicit Master action. Distinguish CI PASS from real phone/emulator and live billing.
- **Observed Firebase emulator PASS** on #39665345869: guest reads three operational leaf values, denies parent/private/menu and any client write/delete with full approved Rules loaded. This does not authorize public DB Rules deployment.
- **Critical remaining P1**: There is no audited/active backend release workflow; existing `verify-450-rtdb-release-prepost.mjs` is read-only. Shared Firebase RTDB `/.settings/rules.json` PUT replaces entire live tree. Before adding a live write path, establish audited conditional ETag/If-Match support at exact Settings Rules endpoint or verified exclusive writer mechanism; on drift/collision stop without overwriting existing shared ACL. Need exact PREVIEW SHA approval, two GETs, exact-one-node candidate, no partial permission changes, postPUT full equality, no blind rollback; deploy only `masterSetSplitFrameMode` after rules pass; then Hosting only with exact version/artifact and 2-client guest/Master device testing. Never use unrelated Stage416 release pipeline.
- **Medium-first resource**: use Medium/direct limited edits for isolated gate, tests and documented audit. High optional at most once for unresolved complex security/concurrency; avoid spending High on exploratory CI retries. Do not merge Rules/Function source, deploy, activate Stage416, alter shared canonical data, or promote TEST/PRODUCTION until independent Work approves exact SHAs.
- **Next one action**: request separate GPT-6 Work independent fixed-SHA review of source PR #379, candidate Rules PR #380 and Function PR #381. On PASS continue development of guarded release path. On FAIL report exact minimal corrective diff.

---

## NEXT — app450 independent Work FAIL → scoped implementation, NO PREVIEW deploy (2026-10-22 KST)

- **Independent audit result reported by user 2026-10-22 KST: FAIL / PREVIEW release BLOCKED.** Fixed baseline preview `ae5f8b3d9db9b3526b4fa98c44e81bfd985ce32e`; existing separate draft Rules PR #375 fixed `5101437eeaf2e18045b52173faebfe5d5b9218db` remains **DRAFT / UNMERGED**. This section supersedes earlier "Work not yet invoked" statements. The Work report found (P1) guest `/studio` receives no mode, (P1) no safely implemented targeted Function + shared Rules release, (P2) two Masters/reconnect/error/100k cost not proven. Master Auth and old shared ACL were source-PASS, NOT deployment approval.
- **Scope decision:** "전체 사용자" means *compatible online signed-in and guest Studio users* on the selected environment. Offline/unupgraded clients can only converge on reconnect/upgrade; do not advertise guaranteed immediate all-device delivery. Preserve user-accepted app448 Lite split source/CSS, pointer-up 4px Generate behavior, 660/820/1080, note/library tabs, menu ACL, app450 three exact modes and Master-only Apply.
- **P1 Guest implementation:** No unauthenticated access to existing `publicSync/navigationVisibility` or any other private/user path. Design one minimal `publicSync/splitFrameModes/{environment}` read-only **public scalar leaf** option (with parent read disabled, deny all client writes/unknown children and exact three-value validation), or an equally safe pre-audited guest transport. Do **NOT** promote root/parent `.read` to public or use anonymous Firebase account creation, Firestore read/polling, Cloudflare/D1 per-page fetch. Guest Studio must subscribe on mount even without Auth; authenticated navigation can continue receiving its current signal without creating two physical wire streams for the same env/SDK instance. Implement shared lifecycle/reference counting if necessary; cleanup all listeners. Unknown origin stays Hybrid and has no policy listener. Update *all* exact structural gates: verify-214, verify-418, verify-434, verify-450 and other current protected verifier fixtures. Existing #375 auth-only node is **not valid for guest requirement**; replace by a separately pinned, newly audited Rules candidate; do not merge/deploy #375 unchanged.
- **P1 release infrastructure:** Separate, reusable manual/fail-closed app450 release route; exact approved SHA, preview-only target, explicit scoped `masterSetSplitFrameMode` Functions deploy, no unrelated Functions/Stage416/Worker. For shared RTDB Rules: credential/live target identity precheck; first live GET; exact-one-node candidate from current live tree; second GET immediately before PUT and candidate equality; no unrelated ACL drift, bounded negative tests/emulator auth/guest/admin/client-write denied; PUT **only on explicit audited approval**, postPUT GET exact full-tree parity, stop all subsequent steps if uncertain. GitHub serialized release, verify concurrency guarantees; do NOT claim atomicity if REST cannot provide it. Recovery must never blindly rewrite a changed shared Rules tree; if postPUT state differs from the expected candidate, fail closed and require manual incident handling. Existing fixed Firebase Hosting release has no targeted Function deploy and MUST NOT activate app450 alone. Keep backend infra pipeline changes separately reviewed and fixed before live release. Do not include TEST/PRODUCTION promotions.
- **P2 verification:** two concurrent Masters: last server-confirmed snapshot wins, stale screen never overrides; call acknowledgement cannot be treated as RTDB receipt; RTDB listener error sets `serverReady=false` and blocks Apply, explicit reconnect refresh; cancellation/re-auth/environment isolation/guest mount-unmount all tested. Add Firebase Rules Emulator tests for guest preview/test/prod scalar read allowed, private sibling read denied, client write denied, unexpected field denied, Master callable admin/guest unauthorized; test no full-data reads and no per-drag network. Calculate 100k-session RTDB subscription/startup and per-Apply broadcast at realistic payload+overhead, label estimate vs measured and disclose re-connect burst.
- **USER RESOURCE DECISION 2026-10-22 — MEDIUM FIRST, HIGH AT MOST ONCE IF NEEDED:** User explicitly authorized Medium for independent safe preparation and said High may be available only once. Never spend High to perform basic repo inspection, one-line UI work, fixture/test additions or release-gate document design. Prefer completing app450 without High if Medium can safely pass all gates.
  1. **Medium task A (no deploy):** read relevant split/admin/auth path and audit P1 Guest root cause; implement narrowly scoped guest mode-subscription lifecycle, correct reset/unsubscribe/recovery, separately proposed exact one-scalar Rules policy, and write negative tests. Do not merge Rules or relax parent ACL. Run local TypeScript/Build/split QA/214 and Rules self-tests; use one reviewable branch/PR and commit.
  2. **Medium task B (no deploy):** construct manual, reusable, fail-closed targeted Function+Rules *release mechanism* with bounded two-read preflight, post-PUT full equality, no blind rollback, only PREVIEW Function, and offline/dry-run negative tests. Keep the release mechanism separate from feature changes; do not execute live PUT/deploy. Verify 418/434/450 protections and fixed source identity.
  3. **Medium task C (no deploy):** test two-Master ordering, temporary listener error and reconnect, unauthenticated scalar read and private denial with Firebase Emulator where feasible, Guest→Auth handoff, normal cached return with zero data reads, cost estimates for 100k listeners. Distinguish simulated from actual cost; do not claim live-device/100k PASS.
  4. **High (maximum ONE run, optional):** only if Medium tasks leave real cross-backend security/concurrency or release-integrity uncertainty. Prepare a consolidated, non-overlapping fixed-SHA handoff of all outstanding blockers and related tests, so a single High session can analyze/fix/run final tests/commit; never burn High on each intermediate fix. If all Medium outputs pass, do not run High solely for formality.
  5. **Independent audit gates:** after fixed final SHAs, run independent Work audit of guest policy and separately of deploy mechanism. FAIL returns a precise localized Medium task unless complexity *requires* the single reserved High. No Hosting/Function/shared Rules deployment without audit PASS. No deployment, merge of shared Rules, data migration, mass write, cache purge or TEST/PRODUCTION promotion pending audit PASS. Source/Functions TypeScript, Build, split QA 303, nav 214, strict 418/434/450, Firebase Rules Emulator and release system safety MUST pass on pinned SHA. All failed gates stop; avoid app449 global drag root-marker regression.
- **Next exact action:** implement/commit the guest-safe subscription and isolated candidate Rule/test changes as a reviewable PR; then build and audit the targeted backend release gate separately. The current Docs-only handoff does not mean feature fixed or deployed.

---

## NEXT — app450 Work independent review and safe backend release gate (2026-10-22 KST)

- Final user-approved location: Admin → App Settings, Master-only frame control. Code PR #366, QA #370, risk fix #372 merged. PR #372 de97309c889d03e1d066ab2f363f912f8e3a84fb CI #39650847101 SUCCESS. Apply now single authoritative RTDB write; per-environment scalar listener. Frozen app448 split untouched.
- Strict pre/post RTDB read-only ACL gate PR #373 abff554f2af981b2dd9b0c75aed58551d62ce190 CI #39651918094 PASS; legacy #434 compatibility PR #374 f55bbee6aa2e2812a426d70d027d3bf266ca125b CI #39652598594 PASS.
- Final Rules candidate is DRAFT PR #375, exact head 5101437eeaf2e18045b52173faebfe5d5b9218db, source/live Rules read-only CI #39653108137 SUCCESS. Original #367 superseded and closed WITHOUT merge. PR #375 has one new auth-only read/client-write-denied path. Independent Work audit NOT YET invoked: fix target SHA before review, apply WORK_AUDIT_CHECKLIST, no mutation/deploy while reviewing.
- Independent audit MUST check Master server authorization, PREVIEW-only origin guard, exact 3 allowed values, concurrency, old TEST/PRODUCTION clients, RTDB unauth denied/read/write, current live Rules and no private ACL widening, 100k subscription broadcast costs, guest/offline behavior, PC/tablet/mobile app448 drag/generation bar and no canonical user-data changes.
- Functions targeted release path not yet built or audited; existing Hosting-only workflow CANNOT complete this feature. Work must audit release path before new shared Rules PUT or Functions deployment. Exact live GET/prePUT reGET/postPUT equality required. After backend PASS, deploy app450 PREVIEW Hosting, verify two signed-in users and TEST/PRODUCTION unchanged. PREVIEW still live app448.

---

## NEXT — app450 security/Function release prerequisite, source already merged and QA PASS (2026-10-22 KST)

- **Fixed source**: PREVIEW product PR #366 merged `93e95f3fefde5ba1bed6108455fe7142039ce3f3`, product CI #39647560757 PASS; dedicated split+admin #370 merged `8a9b3e5f8d0a9420586c50cfcb967ce21112d37f`, action **#39648490129 PASS**. Source location is **관리자 → 앱 설정**, Master-only, exact labels 성능우선/보통/품질우선. Existing app448 Lite split hot-path untouched. No more speculative frontend work until real PREVIEW results.
- **Separate Rules**: draft PR #367 commit `2f4e74d3bfb1f16a8e00daeaa28467e9ff221267`. Must independently audit under `DOCS/WORK_AUDIT_CHECKLIST.md` with current shared RTDB live rules, server Master auth/origin/preview-only guard, TEST+PROD old client compatibility, 100k listener transfer costs, guest behavior, stale settings and two Masters. Audit MUST be independent of implementation; none performed.
- **Hard backend release blocker**: #418/#434 exact shared Rules gate currently fails new path by design. Do not bypass or deploy entire `database.rules.json`. Build separately approved exact-additive negative-tested candidate that adds ONLY the authenticated-read/client-write=false `publicSync/splitFrameModes` sibling to ACTUAL live Rules, with race recheck, exact-after GET and rollback strategy. Preserve all dormant Stage416/private and app435 existing ACLs. Rules are shared by PREVIEW/TEST/PROD users; failure stops promotion.
- **Functions release missing**: existing `firebase-hosting-custom-preview.yml` does NOT deploy new `masterSetSplitFrameMode`. Use separately audited, repeatable safe Functions deployment for that exact callable, not broad replacement/unrelated Stage416 workflow. Sequence compatibly with shared Rules then pinned app450 PREVIEW Hosting. A code-only PR merge is NOT a deployment. Independent audit + actual backend deployment PASS required before Hosting.
- **Live verification**: check one Master applies each of 3 values, two logged-in PREVIEW browsers receive small RTDB signal without reload, pointerup without geometry snap, 660/820/1080 PC/touch and mobile, no app449 slow regression, old TEST/PROD routes/data unaffected, app version exact, no added Firestore/D1 page read, measure RTDB subscription/broadcast footprint. Default quality until Master explicitly changes. If any step fails, do not call released.
- **No TEST/main or PRODUCTION promotion**; no shared canonical user data mutation. Stage416 OFF. PREVIEW Hosting still app448 until Functions+Rules+Hosting verified.

---

## NEXT — app450 final placement Admin App Settings with Master-only Apply; backend audit pending (2026-10-21 KST)

- User final: **관리자 → 앱 설정** hosts **분할바 프레임** choices **성능우선 / 보통 / 품질우선** and **적용**; restore Master permissions page to its untouched app448 state. Do not confuse UI location with authorization: existing Master-only apply policy remains, regular Admin sees no card and cannot invoke callable.
- Code candidate PR #366 OPEN, source branch `feature/app450-master-split-frame-control`, includes UI relocation, existing application global mode signal, strict `requireMasterCaller` callable, isolated small RTDB sibling, and unchanged app448 split engine hot path. Exact pinned commit and latest CI must be checked before audit.
- Shared RTDB Rules PR #367 DRAFT, unmerged, needs **independent Work audit**, fail-closed existing #418/#434 gate, exact additive safety and 100k delivery-cost review before any shared rule deployment. Functions/Rules+Hosting PREVIEW not yet deployed; no TEST/PROD.
- Start from actual preview HEAD and source PR SHA. Run final TypeScript, Build, Functions TypeScript, `verify-214-navigation-visibility-sync` app450 tests, 303 split history, security/permission checks and real two-client PREVIEW A/B after approved release. Do not loosen backend security to make CI green. Current PREVIEW app448, Stage416 OFF.

---

## NEXT — app450 Master permissions control: audit source PR #366 + separate shared Rules PR #367 before PREVIEW deploy (2026-10-21 KST)

- User explicitly requested "적용해서 배포해봐" and clarified UI position **마스터 권한**. Final control: 분할바 프레임, 성능우선=Pure Pane, **보통**=Local Responsive, 품질우선=Pure Pane Hybrid, Apply for current environment to all compatible online clients; initial fallback quality=existing Hybrid.
- Source implementation PR **#366 OPEN** `feature/app450-master-split-frame-control`. Master-only UI + callable, separate auth-only tiny RTDB path `publicSync/splitFrameModes`, source-of-truth Firestore env fields, Studio policy state deferred until pointer-up and diagnostic URL A/B preserved. No code changed in app448 split hot path.
- Shared RTDB Rules isolated PR **#367 DRAFT**, currently unmerged and NOT deployed. First source+Rules combined PR CI #39610645147 FAIL as strict shared Rules guard rejects unapproved new node. Source-only prior QA #39611519367 SUCCESS incl Functions TS + React TS/Build. **Do not bypass/relax guard blindly.**
- **REQUIRED NEXT:** complete latest source CI and targeted verifier 214/450 + 303, independent GPT-6 Work audit of exact commit SHAs for #366 + #367 under WORK_AUDIT_CHECKLIST.md, especially global env isolation, previous TEST/PRODUCTION callable writer, Master permission, guest access, no data loss, 100k listener bandwidth, offline/old client, concurrent Masters. Then design & approve exact additive RTDB Rule extension preserving 418/434 guards and deploy Functions/Rules before app450 Hosting. The shared live Rules and Functions change must not be applied without audit. Verify true live PREVIEW version, two active clients, pointer-up mode changes, app448 smoothness and mobile, and TEST/PROD unchanged.
- Current Firebase PREVIEW app448 unchanged. Never claim deployed or all-user realtime PASS from GitHub changes only; no TEST/PROD promotion. Stage416 OFF; historical speed metrics unchanged.

---

## NEXT — app450 administrator "분할바 프레임": 성능우선 / 보통 / 품질우선 global mode (2026-10-21 KST)

- **New user request 22:09 KST:** administrator App Settings has title `분할바 프레임`, selection of `성능우선`→`pure-pane`, `보통`→`local-responsive`, `품질우선`→`pure-pane-hybrid` and `적용` to propagate globally as close to instantly as possible. User correction 22:10 KST: **`최적우선` is wrong; use `보통`**.
- **Detailed Codex High implementation/audit gates:** `DOCS/APP450_SPLIT_FRAME_GLOBAL_CONTROL_SPEC.md` (read in full). Existing `AdminAppSettingsPage.tsx` and Functions `adminSetNavigationVisibility` + `publicSync/navigationVisibility` RTDB onValue can be reused *only* with additive compatibility and env-isolated `splitFrameModes`. Do not add per-page DB reads, listeners, polling, data copies, or Cloudflare D1 reads. Admin apply only server-authorized appSettings callable. PRODUCTION/TEST not changed or promoted without release approval. Existing Hybrid remains default while feature is introduced.
- **Freeze user-accepted app448:** `preview` HEAD for this design `2dc2cd30dc4f0d9d54c88ac2002fa60915995b4a`, deployed Hosting app448 `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`. No code change, RTDB Rule change, Functions or Firebase deploy in this design-only PR. Stage416 OFF.
- **State: DESIGN ONLY.** Codex code, TypeScript, build, real-time propagation, cost test, independent Work audit, PREVIEW deploy, user acceptance pending. Stop if safe immediate propagation to all compatible clients cannot be guaranteed by the existing authenticated channel or shared TEST/PROD may be impacted.

---

## NEXT — app448 exact behavior restored PREVIEW; freeze accepted split baseline (2026-10-21 KST)

- User 2026-10-21 09:36 UTC physically rejected app449 Local Responsive Generate-only Hybrid mode signal addition because drag became nearly as slow as Hybrid; requested revert to app448. This is **FAIL for app449** and authorization for exact PREVIEW app448 restoration, NOT for more speculative optimization.
- **Current LIVE PREVIEW: app448** pinned restored-release source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`, Firebase action #39579346778 SUCCESS (exact live HTML, app-version448 and TEST+PROD unchanged verified). Rollback code PR #362 merged `2b59b7644439a01a2c2026f2cbdaefce4bb0fcc2`; four restored blobs identical to original accepted app448 `37fca3801975faeadc3bdaf6294d95e189e5aadc`. No other frontend product files changed in rollback, Git history remains linear.
- **Do not repeat app449** root dataset Builder/Generate signal copy into Local Responsive without independent evidence, performance profiling and new user approval. App448 previously accepted compact+PC Generate 4px cap/pointer-up correction; keep Local Responsive's earlier fast diagnostic behavior, Hybrid production default, Pure Pane diagnostic, Note/Library 480px tabs and local-first data batching untouched.
- **Next only**: optional user hand reconfirmation that preview.soridraw.com now runs restored app448 and Local Responsive behaves as prior. Reconfirm PC release geometry and drag, tablet and 660/820/1080 if requested. Source/CI/Hosting 3/4 done; site subjective A/B acceptance postrollback pending. Independent Work audit, full device matrix and billed Firestore/D1 metrics unverified. No TEST or PRODUCTION promotion.
- Progress: Stage416 1/4·25% OFF; historical app-speed 5/5·100% historical only; app448 restoration 3/4·75%, real-hand recheck outstanding. Further changes require a new directive, not just old app449 proposal.

---

## NEXT — app449 Local Responsive Generate-only PREVIEW live; user A/B BEFORE any default change (2026-10-21 KST)

- app448 mouseup Generate bar issue accepted as improved by user 2026-10-21 08:34 UTC ("좋아졌어. 이제 이건 마무리"). Protect current app448 bar geometry and Compact/PC 4px width rebase + app447 max480 Note/Library tabs + app445 live Builder mode + app442 gutters. No change authorized to those fixes.
- app449 user scope: Local Responsive's already-correct pane/card UI and faster-feeling drag are preserved; fix ONLY the Generate bar's delayed responsive mode switch by borrowing existing Hybrid Builder signals at actual 660/820/1080 mode boundaries. Source #357 merged `f5a005a0385a42f99ad2aa4318921ef0744068ec`; dedicated split QA #39574974111 PASS, product #39574360628 PASS, release-prep #39575256089 PASS. Firebase PREVIEW Hosting-only #39576104206 SUCCESS, exact live version 449 and TEST/PROD unchanged at pinned release source `8ab514476eccc4afbfd694a2f0a051731f1d6ee9`.
- The **runtime default is still Pure Pane Hybrid**. User needs to manually choose Local Responsive in admin diagnostics to physically A/B test. Do not claim new mode is default, user-accepted, or faster based only on prior app448 A/B. Work independent audit + device matrix still pending.
- Next only: on https://preview.soridraw.com select Local Responsive, drag through Builder 660/820/1080 and mouseup, confirm Generate bar composes live and no subsequent resize, speed >= old Local Responsive and ideally better than Hybrid; test Create/Recent/Music Note/Library, PC 1100~1599, tablet touch, small-screen <=1099 mobile routing. If PASS and user asks, separately promote tested mode to runtime default under full release gates. Avoid broad CSS/style/root rewrites or modifying Hybrid/Pure Pane benchmarks.
- No Worker/Functions/Rules/D1/Firestore/cache/schema/user data changes, no database reads from this UI-only change, no TEST/main or PRODUCTION promotion until explicit approval. Stage416 1/4·25% OFF; historical app-speed 5/5·100% historical; app449 A/B 3/4·75% physical acceptance PENDING.

---

## NEXT — app448 PC Generate pointer-up correction PREVIEW released; user hand-check FIRST (2026-10-21 KST)

- User video 20261021-0759-32.7126939.mp4 and 08:03 UTC report identified an app447 **PC/full** Generate button width snap at mouseup despite the earlier tablet/Compact improvement. The scope is PC/full Builder >820px, not a regression authorization for accepted <=820px compact behavior or unrelated tabs.
- PREVIEW app448 deployed pinned `37fca3801975faeadc3bdaf6294d95e189e5aadc`, Firebase #39568931418 SUCCESS with exact live HTML/version 448 and unchanged TEST/PRODUCTION. Source PR #352, scoped existing split test PR #353, version guard PR #354, Hosting trigger PR #355. Product #39567328608, split #39568016338, version #39568288775 and Hosting #39568931418 all PASS. Initial failed product run #39567110136 was a test-only escaping parse mistake subsequently repaired. Worker/Functions/Rules/database/shared user data untouched.
- **Next ONLY:** user actual PC hand A/B on https://preview.soridraw.com with Builder >820, repeated releases >820 and around 820/1080; check inner full Generate button proportions do not snap and divider speed is not worse; check accepted Compact <=820 and Note/Library top tabs + PC/tablet/mobile navigation unchanged. Automated math contracts do not prove actual visual zero-snap or drag speed. Work independent audit, cross-device matrix, billed backend metrics remain unverified.
- Current guard: NO further speculative split/performance/CSS/DOM rewrites without concrete new physical failure. The only new app448 change is a full-mode 4px rebase in existing compositor writer (may increase layout writes); preserve app447 compact guard, app442 gutter, app445 live responsive, app446 resting handoff, app447 tabs, data/cache and save batching. TEST/main and PRODUCTION untouched. No TEST promotion without explicit user request and required release checks.
- Progress: Stage416 1/4·25% OFF; historical app-speed work 5/5·100% historical only; app448 targeted source+CI+Hosting+user acceptance **3/4·75%**, USER PC hand result pending.

---

## NEXT — app447 PREVIEW user-accepted; no pending correction or release (2026-10-21 KST)

- User 2026-10-21 02:35 UTC: "괜찮아. 좋아졌어." Treat app447 PREVIEW as **user-accepted for the reported split/Generate bar and Note/Library UI improvement**. Do not re-ask for previously confirmed improvement or change the accepted split engine just to pursue synthetic performance numbers. A general positive physical report is not proof of every breakpoint/mobile device, exact zero-snap, measured FPS, or an independent Work audit.
- LIVE PREVIEW app447 is still the previously verified release `d12e6b39ac040a052f824a1f95cc11ab6549bdfa` (Firebase Action #39532616846 SUCCESS). Keep current correction: Compact Builder <=820px Generate 4px rebase, Music Note / Library max 480px tab row; preserve app442 gutter, app445 content-mode transitions, app446 release geometry and data/cache/batched writes. No new feature modification, Worker, Functions, Rules, shared-user-data mutation or Hosting release authorized.
- Progress: Stage416 1/4·25% OFF; historical speed task 5/5·100% historic; **app447 scoped source + CI + PREVIEW Hosting + user acceptance 4/4·100%**. Remaining beyond this scoped task: independent Work audit, full cross-device browser matrix and actual backend billing are unverified and must not be labeled PASS.
- **Only next action:** wait for a new issue or explicit TEST deployment request. TEST/main and PRODUCTION stay unchanged; TEST promotion requires independent release gates, not merely this user review. Do not merge unrelated pending PR #285.

---

## NEXT — app447 PREVIEW released; user PC/mobile physical A/B is the only next acceptance step (2026-10-21 KST)

Current app447 Firebase PREVIEW source pinned `d12e6b39ac040a052f824a1f95cc11ab6549bdfa`, release run #39532616846 SUCCESS, exact remote Hosting HTML/version 447 and unchanged TEST/PRODUCTION confirmed by release workflow. Source PRs #342/#345, QA #343/#346, version PR #348, release PR #349.

**No new coding authorized by this entry.** Wait for user real-hand PREVIEW test of (1) <=820px compact Generate bar internal buttons not changing again at mouseup, 660/820/1080 transitions, full/compact intentional layout and app445 smoothness, (2) Music Note and Library top three tabs cap 480px, (3) rapid/sustained drag, scroll/collapse, PC/tablet/mobile page roundtrips. Source automated QA and release identity PASS are not physical feel/zero-snap PASS. Extra compact rebase writes may reduce drag speed. Work independent audit not performed.

On specific FAIL, localize to affected surface and preserve frozen split hot path and canonical data. If compact rebase worsens snap/drag, revert ONLY its app447 4px path; keep top-tab 480px CSS, app442 gutter, app445 responsive, app446 pointer-up handoff. Do not merge pending unrelated PR #285, alter Workflows/Worker/Functions/Rules, reset caches, migrate shared user data or promote TEST/PRODUCTION unless separately approved.

Progress: Stage416 1/4·25% OFF; historic speed work 5/5·100% (historical, not fresh speed PASS); app447 3/4·75% (source+QA+Hosting done, physical A/B pending). Deployed source SHA stays fixed when docs-only commits are merged.

---
## NEXT — app447 source-ready, NO Hosting deploy; user A/B approval needed for new compact Generate bar (2026-10-21 KST)

Current preview HEAD will be docs-only ahead of `1b2deedf500b8e1bc061336b560b0dcda94b23cd`. Two separate, minimal source candidates are in preview:
1. Music Note+Library 3-tab row cap 480px in mobile Result split mode: PR #342, QA #343. Stops 3 top buttons stretching beyond design while Result pane grows across mobile→desktop split transition.
2. Floating Generate bar COMPACT Builder (<=820px) narrows tolerated compositor child distortion to **<4px bar-width difference** by rebase `Math.abs(actionGeometry.width - base.width) >= 4`, preserving all wider Builder 8% compositor batching: PR #345, QA #346. This is an explicit smoothness-vs-reflow tradeoff, NOT a proof of zero inner-button snap or measured performance improvement. app446 final anchor geometry pointer-up handoff intact.

Product-quality #39530032281 PASS, Follow-only #39530260074 PASS, split/browser/TS/Build #39530323518 PASS. Existing app442 gutters, app445 Builder live 660/820/1080, app446 Generate release geometry, Music Note/Library save batching and cache/read budget protections pass static guards. **LIVE PREVIEW remains app446**, Hosting SHA `2c58878bd8eb39d0d84d842334d697c7a9379be3`. Not deployed: no version bump, no release trigger, no TEST/PRODUCTION changes, no data movement.

Next action ONLY if user explicitly requests PREVIEW Hosting deploy: bump app to 447, extend Hosting version in frozen Worker verifier (do not deploy Worker), release one pinned PREVIEW commit after full CI; user hand A/B must test center→left at Compact<=820 and near 660, the intended Compact↔full Generate design, release-frame inner button size/position parity, fast/sustained drag vs app446, Note/Library tabs no longer grow beyond 480px, and PC/mobile navigation. A release-frame mismatch or worse drag => revert only the compact rebase and redeploy after authorization; do not remove the validated tab cap. Independent Work audit pending.

---

## NEXT — app447 tab stretch source fix PASS, NOT DEPLOYED; Generate bar inner-scale snap FAIL (2026-10-21 KST)

After user's 2026-10-21 01:09 UTC videos, confirmed Music Note/Library three-mode-tab Result mobile CSS section 370 overrides `max-w-[480px]` to `max-width:100%`, expanding all three labels to growing Result width and at mode change collapsing back. Minimal CSS fix (cap 480px in mobile Result, width100% below cap) merged in PR #342 and split guard PR #343, preview source HEAD `ecb0cec206be502263826b220772b6d95e86d24c`. Product TS/Build #39526977340 PASS, split+TS/Build #39527252521 PASS. **Not deployed**: PREVIEW user-facing site remains app446 at SHA `2c58878bd8eb39d0d84d842334d697c7a9379be3`, `public/app-version.json` still 446. No Firebase Hosting work unless user explicitly requests release; then assign next version, run full release gate, verify TEST/PROD untouched.

Another, independent physical FAIL: user says app446 Generate bar inner controls still adjust on pointerup, despite slight divider feel improvement. Source cause candidate is outer `scaleX` transform on full floating Generate bar and reset of live scale after pointerup; app446 release root coordinates do not cancel inner scaling. Need one-shot before/after layout/visual rectangles at unchanged divider position, rather than synthetic guesses. Do not change both controls and geometry in one experiment; preserve app445/446 smoothness and 660/820/1080 live responsive, app442 gutters, 46px/40px Note/Library tab appearance, full↔compact Generate layout, all save/cache/backend. No performance enhancement PASS asserted for CSS cap. No TEST/PROD promotion, Work independent audit unperformed.

---

## NEXT — app446 PREVIEW released, user real-hand Generate bar pointer-up snap check (2026-10-21 KST)

app446 source `2c58878bd8eb39d0d84d842334d697c7a9379be3` is LIVE at preview.soridraw.com (Firebase Hosting Actions #39524355127 SUCCESS, TypeScript/Build/split/follow regressions PASS, exact version 446, TEST/PROD unchanged). Source PR #337; initial split QA failed test-only comment regex; QA PR #339 fixes and reruns split #39524145646 PASS and follow-only #39524145652 PASS; release PR #340. Runtime only adds pointerup one-shot command-anchor read and seeds resting Generate bar root left/width before deleting temporary compositor scale. No change to app445 Hybrid pointermove cost/660/820/1080 composition, app442 gutters, Create, other UI, any backend or shared data.

**USER PHYSICAL TEST NOT YET PASS:** Reproduce uploaded 20261021 Generate-bar videos: split center→left on narrow Builder, release at several widths, verify no second size/position snap; check intended wide vs Compact design remains normal and quick reverse dragging remains app445-like smooth. Some compositor live scale to real flex layout visual difference could remain; do not claim solution based on static CI. If FAIL: identify precise release width and inspect live vs resting visual box/inner panel at pointerup, avoid per-frame DOM reads; revert only app446 change if it worsens performance. No TEST or PRODUCTION approval. Work independent audit outstanding.

---

## NEXT — app445 Generate bar left-half release snap: isolate geometry ownership, no speculative styling (2026-10-21 KST)

User physically reports app445 Pure Pane Hybrid ~5–10% faster than app444 (subjective improvement, not benchmark). Do NOT roll back app445 solely for this separate defect. Two videos supplied 2026-10-21 00:23 UTC: `20261021-0015-23.3024558.mp4` (focused bottom bar), `20261021-0018-28.2526046.mp4` (full Studio). Generate bar visually follows divider but appears to resize again when pointer released, especially Builder narrower than half split width. Full→compact control composition transition is intentional, separate from unwanted geometry snap.

Source likely mismatch in `LiteStudioSplitWorkspace.tsx`: `syncGenerationBarGeometry` uses cached drag-start command-anchor insets plus visual `scaleX` and occasional width rebase; `finishDrag` uses `applyPercent(false)` then clears bar inline x/width/scale through `clearLiveExternalGeometry` so resting root/CSS takes over. Probe computed visual rectangle at same stable divider X directly before/after pointerup under and over 660/820/1080 (without full-frame production instrumentation) to verify mismatch and which owner differs. If verified, minimally make live and rest exact geometry contract agree, with zero extra per-pixel measurements and no change to compact/full design/Generate actions. Preserve user-perceived app445 smoothness, app442 gutters, 660/820/1080 immediate Builder reflow, Music Note/Library and data/cache behavior. Do not assume all speed issues caused by release-only snap.

This turn was **investigation plus GitHub documentation only**; user requested videos reviewed, not a new release. PREVIEW still app445 SHA `58a2fe2ff0b1710c802ab857f349569005f71cbf`; no new source changes or Hosting, TEST/PROD unchanged. Work independent audit not completed. Next implementation awaits specific user request.

---

## NEXT — app445 PREVIEW live 1080 Builder band shipped, physical UI boundary evaluation pending (2026-10-21 KST)

User-provided 74.7s video `20261020-2312-56.6720158.mp4` and user report of inconsistent mobile→tablet→PC Builder UI switching motivated targeted mode-signal correction. app445 PREVIEW Hosting exact source `58a2fe2ff0b1710c802ab857f349569005f71cbf`, release #39515890304 SUCCESS, product CI #39515370616 PASS and scoped split CI #39515657715 PASS. Source PR #332, QA PR #333, release PR #334. The Hybrid signature now includes the Builder's 1080 content band and publishes its mode to the root once at real mode changes. Existing 660/820 composition and Pure Pane Hybrid frame geometry unmodified. No backend/DB/canonical data changes.

**NEXT USER PHYSICAL TEST, NOT YET PASS:** Slowly cross actual Builder pane 660, 820, 1080 in both directions; release at each side; confirm card/UI and Generate bar settle DURING drag and no bounce on pointer-up; then rapid direction reversals and Music Note/Library/Recent roundtrips. Compare to app444 confirmed smoothness. The new app445 correctness candidate may or may not eliminate every reported visual inconsistency; no instrumented browser DOM trace available. If no benefit / new jank, revert app445-only JS and redeploy PREVIEW to the app444 accepted source with version bump. Avoid another broad CSS rewrite. No TEST/PROD promotion without explicit approval. Independent Work audit pending.

---

## NEXT — app444 rollback user physical PASS; preserve split (2026-10-21 KST)

User confirmed at 2026-10-20 23:05 UTC that the rollback was successful. app444 PREVIEW is back to app442 user-accepted split CSS and behavior; the app443 performance experiment is discarded. Do not pursue additional speculative Pure Pane Hybrid CSS performance patches without a new concrete defect and user direction. No pending deployment or TEST/PRODUCTION promotion. Keep live 660/820 Builder transitions, app442 gutter fix and shared data protections. Work independent audit remains outstanding; user hand confirmation applies only to the rollback.

---

## NEXT — app444 PREVIEW restored verified app442 Studio CSS; freeze further drag optimization (2026-10-21 KST)

User's app443 Hybrid Builder isolation A/B feedback on 2026-10-20 22:49 UTC: negligible difference, perhaps subjectively 2-3% slower (NOT measured). Decline and roll back priority-1 experiment rather than compound complexity. app444 PREVIEW Hosting at https://preview.soridraw.com deployed pinned SHA ae4324bb36fc8c81bfe4b2deabae7370434797ff with exact live version/build, TEST/PRODUCTION unchanged; release run #39511665081 SUCCESS. Source PR #327, product CI #39511092855 PASS; split regression #39511423160 PASS; release PR #329. CSS and split history verifier blobs are exactly the app442 user-confirmed baseline; only Hosting version/Worker verifier version guard advanced to 444. Protect Pure Pane Hybrid live UI switch at 660/820, 1080 content thresholds, 24px consistent gutter fix, split UI/scroll/bar and data/Backend.

No outstanding code task or further performance tuning is authorized. Only potential next validation is user hand-test on restored PREVIEW app444 against previous app442 feel; do not require synthetic benchmarks or assert measured speed. If new concrete failure is reported, investigate its exact viewport and reproduce before proposing changes. No TEST/main/PRODUCTION promotion unless explicitly authorized. Work independent audit not run.

---

## NEXT — app443 PREVIEW released; user physical A/B before any new split change (2026-10-21 KST)

User-approved priority #1 Hybrid Builder scope optimization is now **Firebase PREVIEW app443** source `83a1c59acc3752b198c2706ff6efc40562e10841` (release Actions #39509226119 SUCCESS; product CI #39508398837 PASS; scoped split QA #39508917855 PASS). One drag-only CSS rule adds `contain: layout style` to Builder Studio main during Pure Pane Hybrid desktop-pane mode, based on already-existing 657 tablet-band containment. No JS geometry or responsive-state change, no shared user data/backend change, TEST/PRODUCTION unchanged. app442 recovered physical speed remains the protected control.

**Acceptance PENDING:** User real-hand testing on preview.soridraw.com for (1) Pure Pane Hybrid versus app442 perceived drag smoothness, (2) Builder 660/820 card composition switching DURING mouse movement (not on pointer-up), (3) 1080/1100 boundaries and fast reverse, (4) no card height/gutter/layout/scroll/Generate bar jump, (5) Recent, Music Note, Library on PC and tablet/mobile as available. Source/Build/CI cannot prove feel. If regression occurs, revert only the new app443 CSS isolation while keeping app442 local gutter fix; no further speculative rewrites.

First split QA FAIL was only a test regex matching `min-width:` in a legal media query; PR #324 corrected it. Full final QA/Follow success is recorded above. No additional fix or deployment without concrete feedback. TEST and PROD release approvals separate.

---

## NEXT — app442 PREVIEW splitter speed user-PASS: freeze; do not optimize further without new defect (2026-10-21 KST)

User hand-test statement (2026-10-20 22:04 UTC) says PREVIEW-only sluggishness improved to TEST/PRODUCTION-like smoothness after app442. Treat this **specific real-hand performance complaint as provisionally PASS**, not complete physical regression-matrix approval. Prior videos' 24px gutter shift hypothesized the change; app442 release `945c28668c7502f2de84419d251eedd6f1ca4c95` is already deployed PREVIEW, tests and exact Hosting verified in #39502963638. Do not change split Pure Pane Hybrid/engine, CSS 1030/1031, or UI simply to pursue synthetic FPS. No new code task or deployment is approved. Keep shared user data and backend untouched.

If future concrete FAIL emerges, inspect only the reported screen and state: Recent ↔ Music Note ↔ Library, same splitter X across Pure Pane/Hybrid, responsive edge crossings, fast/slow drag, pointer-up/scroll/collapse, PC/mobile. Do not presume exact gutter parity was separately confirmed by this speed feedback, and do not request repeat old automatic benchmark screenshots. User confirmation is limited to practical speed recovery. TEST and PRODUCTION remain unchanged pending explicit later requests.

---

## NEXT — app442 deployed: physical same-X gutter check BEFORE further split optimization (2026-10-21 KST)

PREVIEW app442 Hosting success: source 945c28668c7502f2de84419d251eedd6f1ca4c95; deployed version 442; release Actions #39502963638 SUCCESS; TEST and PRODUCTION unchanged. The exact 24px split Builder card width drift observed across Pure Pane / Hybrid and page navigation is targeted by CSS 1030/1031 selectors using local StudioPageFrame data-workspace-view instead of global effect-maintained document dataset. This fix is **NOT yet physically accepted**.

Next: user manually compare at same splitter X after switching Pure Pane vs Pure Pane Hybrid; navigate Recent, Music Note, Library back/forth; verify width consistency. Check long hand drag smoothness, boundary transitions, pointer-up snap, scroll/collapse, first-frame UI and mobile. If user reports FAIL, compare exact failure against two uploaded videos and inspect ONLY the proven owner; do not touch unrelated filtering, sorting, backend, save batches, generation bar or existing accepted visuals. The extra Hybrid responsive-boundary/tablet fastpath overhead is a separate candidate ONLY if width parity is now stable but physical Hybrid drag remains worse. Do not ask the user to repeat old synthetic PERF screenshots.

No unrequested deployment, no promotion to TEST/PRODUCTION; user must accept actual PREVIEW result. Product PR #317; QA PR #318 plus split-specific CI #39502637664 PASS; release PR #319 plus Firebase Preview #39502963638 PASS. Preserve Stage416 OFF and all legacy normal functionality.

---

## NEXT — app441 Music Note split drag: historic breakthrough confirmed, physical jank unresolved (2026-10-21 KST)

User has already provided PREVIEW/TEST Master synthetic PERF screenshots, and specifically says previous repeated synthetic testing never found the real fault. **Do not ask for the same screenshots/benchmark again.** The user wants an actual minimal PREVIEW performance repair and live hand acceptance **when the cause is proved**.

**Existing measurements:** PREVIEW app441 Music Note 80.8fps/P95 25.8ms vs TEST app377 71.1fps/P95 27.8ms; Library 119.3/14.5 vs 102.9/16.7. Same screenshot synthetic surface 1400×900, right Library list 602 nodes in both. Preview's *synthetic* render cost is also lower. This is a synthetic/HUMAN contradiction, not grounds to dismiss the latter.

**Historical mechanism, source references:** 591 direct pane geometry `1f90127be8a4`; 607 App root rerender suppression `ce3591169490`, 624 Lite class cover `22f52fab23fd`; 764 Pure Pane `523d74adea3a`; 798 hybrid boundary signature `ce893e7d4faf`; hybrid default `ef6d32c67e2c`; 1001 PC containment `c160b792fc73`; native leaf/region CSS 576/585/657/1005 (current `liteSplitWorkspace.css` and `studioLayout.css`). Never restore abandoned React windowing, frozen live widths, 30fps content, fake divider, or multi-owner height/scroll workaround.

**Fresh targeted engineering path:** (a) diff exact app438/439 initial-paint effects `LiteStudioSplitWorkspace.tsx`, `FavoritesPage.tsx`, `SunoLibraryPage.tsx`; verify `refreshMetrics` and masthead portal/split tree rerenders cannot run during drag or after every frame, not merely pointermove. (b) distinguish first drag after navigation, repeated warm hand drag, responsive boundary crossings, external window resize as separate timelines; correlate long animation frames with actual DOM/CSS invalidation in same real pane. (c) use existing `scripts/verify-394-split-chrome.mjs` isolated Chromium fixture for mechanical no-snap/scroll/PC-tablet checks; DO NOT call fixture speed an authenticated Music Note browser proof. (d) if provable owner isolated, implement only that owner's minimal reversible local fix, preserve first-frame app441 acceptance, render locations, 60s/30s/150s saves, canonical data, and Lite hot path. (e) audited commit then guarded PREVIEW Hosting-only deploy, user physical real-hand QA (not FPS-only). If cause isn't established, do not publish a guessed app442.

**Preserve:** 16px click/1px real divider, actual same-frame pane sync, breakpoints 660/820/1080/1100/1600, tablet min 430px, collapses, bar, pointer-up, scroll, popups, navigation; no dataset/global CSS/React per-pixel loop. TEST/PRODUCTION untouched. TypeScript/Build/QA only when source candidate exists.

**Current status** 2/4·50% historic/static source + screenshots; source remediation and actual human verification pending. Stage416 1/4·25%; earlier app speed 5/5·100% historical only.

---

## NEXT — app441 split-drag FPS regression: measure BEFORE patching (2026-10-21 KST)

**Intent:** The user explicitly requests continuing development to isolate and improve sluggish PREVIEW Music Note/Library divider dragging compared with TEST. This is a new performance request, NOT permission to alter the accepted app441 page-entry/navigation visuals or promote TEST/PRODUCTION.

**Frozen baseline:** preview `0d12d30856ce4d5c0fedad38a61ffeab63e28acd`, released app441 source `8091aa4f80721f150df1668cd4f4a1f684eabbfb`; TEST `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, PRODUCTION app377. Follow `AGENTS.md`, `.agents/skills/studio-split-behavior/SKILL.md`, its frozen reference/validation matrix and `DOCS/WORK_AUDIT_CHECKLIST.md`.

**Already confirmed:** PREVIEW/TEST `StudioSplitEngineWorkspace.tsx`, `liteSplitWorkspace.css`, `studioLayout.css`, `splitPerfDiagnostics.ts` blobs are identical. Lite engine differs only in initial width parsing and app438–439 entry/layout/scroll/observer timing (not in the pointermove latest-X/rAF hot path). Pages do differ. `contentResponsive.ts` consumes existing pane-width mode-change signal and avoids separate per-frame observer. Existing CSS 576/585/657/1005 already contains list leaves, regions, menu cards and wide-PC during active dragging. No valid evidence yet that app438 created sustained drag regression. Do not assert a cause from the old 30fps video.

**First work package — bounded quantitative diagnosis (read-only):**
1. Check normal route and diagnostic URL state: `splitEngine=legacy`, `v2DragPerf` override, `genBarPerf`, MASTER PERF flag, transient overlays. Do not change end-user defaults. Same device, Chrome build, refresh rate, window size, split range, same warm data and displayed Music Note/Library list counts. Treat different cached DOM cardinalities as confounders.
2. Run existing MASTER split performance panel, not a new logger: 1400×900 automatic 3-set median per Music Note and Library on PREVIEW/TEST; use `뮤직노트↔라이브러리 비교`, `실손 드래그 비교`, `렌더 스캔`, `영역 스캔`, `좌표 A/B` where relevant. Export `종합 진단서 복사`. Compare FPS, P95/max, LoAF browser render/layout/paint, forced style-layout, input-to-commit, layout ACK width, pane/region DOM counts; run slow 660/820/1080 and fast wide drags separately. Also measure OS-window resize separately.
3. Binary isolate input/rAF vs left Builder vs right Result vs Music Note top controls/list/group vs Library top/list, using existing splitter-only/left-pane-only/right-pane-only and area scans. A faster splitter-only mode does NOT establish a usable product fix. If normal PREVIEW/TEST timing parity is not demonstrated or measurements vary, stop and report evidence needed.
4. Only after proof of a specific owner, implement a single small reversible rendering improvement, preserving visible behavior. No drag-time setState, new per-frame DOM read/observer, root CSS mutation per pixel, duplicate contain rules, card-height snapshot, fake divider, engine refactor, data/caching/backend/UI changes. Avoid modifying Explore or app441 first-frame routing. Use existing split verifier and independent audit. Final TypeScript/Build/focused tests and real PC/Tablet/Touch same-boundary and scroll QA before any deployment.

**Acceptance:** same visible pane/splitter frame; PREVIEW P95 and lost/long-frame rate measurably better than its prior baseline, without Library regression or abnormal new cost; no release snap, scroll creep, clipped active popups, delayed generation/collapse controls or responsive-boundary misfire; old app441 page-entry physical PASS preserved. Don't promise 165fps for a synthetic 1400×900 tool; report actual hardware refresh rate and observed numbers. User device acceptance is a separate gate. If impact is not measured, do not invent a speedup.

**Status/progress:** 2/4·50%: GitHub state/skill confirmed and PREVIEW-vs-TEST source-difference isolation done; controlled FPS/paint measurement pending, proven smallest implementation and tests pending. Stage416 1/4·25% OFF. Historical app speed 5/5·100% is not a fresh split benchmark. Source edits/commit/push/deploy 0 at this definition step, docs-only tracking permitted. TEST/PRODUCTION not authorized.

---

## NEXT — app441 UI physical acceptance COMPLETE; await next user instruction (2026-10-21 KST)

- User explicitly confirms **“이번에는 다 정상이야.”** app441 PREVIEW page-entry + left-rail previous-selection flash now user PASS, preserving the already accepted Explore initial layout and Studio split widths/Recent/Music Note/Library navigation.
- Frozen released app441 Hosting artifact commit `8091aa4f80721f150df1668cd4f4a1f684eabbfb`; GitHub `preview` may advance through documentation-only commits without modifying that deployed artifact. No unresolved first-frame UI QA request for the reported issue; do not ask the user to repeat prior video/tests.
- Do not change UI, backend, data, caches, or routes as follow-up “cleanup”. TEST/PRODUCTION remain unchanged and require the user's separate deployment approval. Independent Work audit/cost measurements not implied by user's physical PASS. Stage416 1/4·25% OFF; historic speed 5/5·100% not remeasured.
- Historical NEXT sections below are superseded for this app441 navigation/UI work.

---

## NEXT — app441 first-render rail selection only: user physical verification (2026-10-21 KST)

- Live PREVIEW `https://preview.soridraw.com` app441, release SHA `8091aa4f80721f150df1668cd4f4a1f684eabbfb` [Hosting run #39482587973](https://github.com/andrawing1212/soridraw-music/actions/runs/39482587973) exact build PASS; [source PR #311](https://github.com/andrawing1212/soridraw-music/pull/311) and [release PR #312](https://github.com/andrawing1212/soridraw-music/pull/312) merged. App441 ONLY changes selected-left-rail UI from stale App `studioWorkspaceView` to URL-derived destination in split; all previous app440 user-visible fixes PASS and frozen.
- Ask user to verify **only three paths** with existing warm cache: Create→Explore→Recent, Music Note→Explore→Recent, Library→Explore→Recent. The Recent button must be selected on the FIRST frame, with no previous menu highlight. Classic and browser Back/Forward should retain original behavior. PC physical proof pending; user requests no other changes.
- If visual FAIL, isolate the rail-only owner in exact video; DO NOT adjust Split Engine CSS/geometry, Explore cached Feed, save-heart, storage, backend, app-wide navigation, or unrelated files. Release code remains only PREVIEW. Stage416 1/4·25% OFF; historical speed 5/5·100% unremeasured.

---

## NEXT — app440 PC first-frame and Explore Recent navigation physical QA (2026-10-21 KST)

- Released app440 PREVIEW Hosting exact source `c4d53023773e5aa9c8890297754acc2a8a0a185f` (remote version 440, exact build/TS/Build/TEST-PROD guard PASS [run #39478829206](https://github.com/andrawing1212/soridraw-music/actions/runs/39478829206)). Subsequent verifier-only `preview` head `d11a030b8e7240c393607f6cf7aed09e79e97971`, follow workflow [#39479756655](https://github.com/andrawing1212/soridraw-music/actions/runs/39479756655) PASS. Product PR #307 and verifier PR #309.
- User app439 FAIL: Music Note/Library→Recent right Result overlaps/jumps in `20261020-1834-56.3831053.mp4`; Explore rail Recent opened Create. Both source paths adjusted in app440; **physical fix unverified**.
- User previously PASS/FROZEN: app438 Explore first-frame and splitter left/right pane horizontal width/gutters. Preserve app439 Music Note masthead fix and all normal right sidebar/drag/scroll controls. No CSS resize, no backend, no data changes.
- Next action is **physical** warm-cache PC navigation (1) Explore→Recent actual destination (2) Music Note→Recent and Library→Recent Result first visible frame. If FAIL, investigate exact screenshot/frame before another speculative release; separate route-bounce vs composited paint. Check browser Back/Forward, tablet/phone as follow-up.
- Separate #293 URL/color and Stage416 unrelated. TEST/PRODUCTION not approved. Stage416 1/4·25% OFF; historic app speed 5/5·100% unremeasured.

---

## NEXT — app439 PREVIEW physical QA of two still-unverified transitions (2026-10-21 KST)

- app439 exact deployed `preview` source `88985fac941387fe8c5b9fab9e78982fe302b1ea` and live version 439 verified by [Firebase Hosting Action #39475323311](https://github.com/andrawing1212/soridraw-music/actions/runs/39475323311). Source changes in PR #304. CI/Hosting PASS, **not physical UI PASS**.
- User-confirmed app438 PASS: Explore initial page entry, and Studio split horizontal width/gutters — **FROZEN**.
- Original remaining FAIL: Library or Music Note→Recent right pane overlaps; Create→Music Note list starts below before moving upward.
- Request only two user checks on existing cached PC browser after app439: Library→Recent and Music Note→Recent, then Create→Music Note. Observe first 100–300ms, no browser cache reset. If fail, use new recorded frame and isolate only offending page/host/scroll owner; no blanket CSS or backend changes.
- Protect Music Note 60s batch saving, save-heart 30s, Explore likes cache R0/W0, split geometry/drag/width and app438 Explore first frame. No TEST or PRODUCTION promotion without authorization.
- Stage416 1/4·25% OFF; historical speed 5/5·100% not remeasured.

---

## NEXT — app439 verify remaining 2 UI first-frame errors, preserve app438 PASS (2026-10-21 KST)

- app438 physical PASS frozen: Explore page entry and split left/right first-entry width. NEVER alter them for this task.
- App438 physical FAIL video `20261020-1808-02.1969412.mp4`: Recent Result right content overlaps when coming from Music Note/Library; Create→Music Note list temporarily starts too low then rises.
- Source: [PR #304](https://github.com/andrawing1212/soridraw-music/pull/304) merged `947f1ca942ff14e37dea28535d604bbee4bebdb2`. Two masthead portal resolutions moved from passive effect to layout effect (`FavoritesPage.tsx` and `SunoLibraryPage.tsx`); one layout-phase reset of inherited Result-pane vertical scroll in `LiteStudioSplitWorkspace.tsx` only on result workspace switch. No CSS/spec, server, synchronization, likes, Worker or data changes.
- CI TypeScript/Build existing quality PASS run 39474394739, direct first-frame physical PASS unverified. Proceed app439 Hosting-only exact-sha release with tests/remote URL + TEST/PRODUCTION unchanged proof, no shared Rules/migration. Then request **only two** user UI acceptance actions, plus optional PC/mobile.
- Stage416 1/4·25% OFF; app speed historical 5/5·100% not remeasured; no TEST or PRODUCTION promotion until approved.

---

## NEXT — app438 PREVIEW first-frame user PC/mobile QA (2026-10-21 KST)

- Exact deployed app438 commit `ac8d9a3829018ee20718c8278314db8d69433a4e`, `https://preview.soridraw.com`, remote version 438 and HTML hash verified via [official Action #39471086276](https://github.com/andrawing1212/soridraw-music/actions/runs/39471086276). Studio first-frame PR #300 and Explore warm-cache first-frame PR #301 are merged and released. TS/Build and existing tests PASS; **physical results and independent Work audit not PASS**.
- Next user QA: Studio Black split Recent from Music Note/Library, verify original gutters without 1-frame narrow flash, Result geometry stable, Music Note rows do not jump vertically; navigate Explore and confirm no initial rail overlap/rearrangement. Repeat warm entry with intact local cache and at least one mobile/tablet route. Keep UI dimensions and backend untouched.
- If FAIL: recover exact single-page owner from before/after frame and change only the offending component, not global layout or frozen splitter engine. New source fix requires exact CI and guarded PREVIEW Hosting release, independent audit as feasible. No TEST/PRODUCTION promotion without explicit user instruction. Preserve 30s save-heart, Music Note 60s, Recent 150s, Explore like/follow/publication and R0/W0 normal cached revisits. #293 conflict and URL/color work separate.
- Stage416 1/4·25% OFF; app speed historic 5/5·100% unremeasured; current first-frame task 3/4·75%, real PC/mobile user acceptance pending.

---

## NEXT — user-corrected visible FAIL, verify narrow PREVIEW repair before revisiting #293 (2026-10-21 KST)

- Stop mislabeling the screenshot as deleted URL resurrection. **Primary physical FAIL is URL added on MOBILE not appearing on PC** for same account/same song `그날의 나에게`. Also historical Music Note assigned-color filter returns empty. The URL deletion fallback and last-writer protection are separate follow-up risks, not user's screenshot.
- Narrow independent patch branch `fix/294-mobile-suno-url-pc-color-preview`: explicit Detail Suno URL action attempts existing canonical flush while preserving normal text editing batch, client + Worker catalog projection includes `favoriteColorTag/colorTag`, user-visible color aliases recognized without guessing or reverting explicit clears. Existing verify-031/281 and media save-heart checks are protected. No app-wide restructuring.
- Check code diff, TS/Build/relevant targeted regressions, then approved PREVIEW deploy and actual URL/color parity from user PC/mobile. Never claim physical PASS before user does. If old R2 summary lacks historic colors, recover only per-song verified source, not full scan/clear/backfill. Normal warm cache R0/W0 remains goal.
- #293 old-client deletion/recreate revision Emulator acceptance FAIL is explicitly **not part of this visible bug patch**. Keep blocked branch and investigation as separate safety task. Shared Rules activation, migration, data changes, TEST/PRODUCTION prohibited. Codex 13% remaining (user-reported), no new Codex request.

---

## NEXT — #293 APPROVED narrow compatibility policy, CODE + EMULATOR ONLY (2026-10-21 KST)

- **Decision:** user authorizes refusal of **conflicting stale URL/color writes by older apps** but **not** blanket legacy app denial, disruption of song save/unsave and unrelated fields, migration, any shared Firestore Rules apply/deploy or any environment release. Read latest Issue #293 policy and handoff comments before working.
- **Pinned old product baseline:** `dfa64ad29b4dab34b377a55fce8305f5f6d5ba2d` (preview docs-only HEAD at Codex STOP); Codex working branch `fix/293-music-note-final-state` reportedly no edits/commits, app420 stash untouched. Refresh real preview HEAD on start and preserve existing unpublished work.
- **Scope, one Codex High run only if needed for proven conflict:** (1) server-ACK per-field URL/color revisions, explicit null/empty delete markers and source base revisions carried in durable drafts, (2) reject stale draft without overwriting source or deleting pending, (3) rules-only code candidate checking protected changed keys + valid revisions, all create/update/delete paths evaluated for old client and admin behavior, (4) genuine legacy-only Suno URL still displayed, (5) Music Note `favoriteColorTag/colorTag` supported across Firestore catalog select, Worker and client projection, (6) existing local mapped colors only when provenance is verified and explicit gray clear honored, (7) no repeated idle/reopen reads/writes.
- **Regression gates:** Firebase Emulator Rules tests old unconditional URL/color stale saves, old/new offline drafts, distinct URL and color revisions, two URL slots/main index, create/delete recreation bypass, old save-heart 30s and unsave, title/lyrics edits, Music Note 60s details, Recent 150s, Explore frozen likes, UID isolation and unchanged-cache R0/W0. Rules checking same favorite doc need no extra rule get; transaction R1/W1 normal mutation estimate and retry costs must be verified. Keep shared Rules un-applied.
- **Stop gate:** if safe per-field old-client rejection cannot coexist with normal old app membership/delete or if Rules need to be activated to run tests against real users, stop without live change. No schema migration, real-user read/write debug, Rules deploy, main merge or Hosting deployment. Final candidate -> TS/Build/relevant tests -> exact commit/PR on non-merged branch -> independent Work audit -> separate user approval for Rules rollout.

---

## NEXT — P0 Music Note last confirmed URL register/delete + lost assigned-color filter (2026-10-20 KST)

- **Source of truth:** [Issue #293](https://github.com/andrawing1212/soridraw-music/issues/293), `preview` product baseline `555b5740c3894f9ee893ab18349aa70f1d60ee50` (app436). User submitted PC/mobile screenshots and ~14.8s PC video. Same-song **그날의 나에게** shows Suno media on mobile but not PC. Previously assigned music-note colors all apparently missing when filtering. No read-only canonical field-by-field comparison yet.
- **First exact diagnosis:** Music Note catalog `src/lib/userDataEngine.ts` projection omits `favoriteColorTag`/`colorTag` consumed by `FavoritesPage.tsx`. URL `getFavoriteSunoLinks` legacy fallback may resurrect old `sunoUrl`/`sunoSongUrl` after `sunoLinks:[]` and `sunoShareUrl:null` deletion. Detail URL save/display uses IndexedDB durable draft, per-page canonical flush and local/RTDB media overlay; current user row cause is not independently proven. Inspect current canonical accepted value safely before deciding.
- **Required behavior:** song-by-song **last confirmed URL add/change/**explicit delete**, 2 URL/main selection and final color assign/unset must not be replaced by older aliases, delayed draft/catalog, unrelated writes, old app versions, new device or app update. Older legitimate legacy-only Suno URLs still work. Restore historical colors only from genuinely existing original/backup; don't invent missing values. PC/mobile share canonical UID origin, local cache is only acceleration. Actual edit local and cross-device immediate, stable cached re-entry read 0/write 0, O(1) per change.
- **Execution gate:** Codex High single-worker PREVIEW scoped fix, first read required skills and Issue #293. Extend `verify-031`, `verify-281` and targeted color/catalog regression with last-write/delete, offline, old schema, warm-cache, PC/mobile cases. Protect Music Note detail 60s page-exit batching, Studio save-heart 30s, Recent edit 150s, Explore likes & publication, Stage416 OFF, Library, UI and deployment. No shared user data write/migration/backfill/cache reset; stop if schema needs risky cross-version change. Exact TypeScript/Build/tests then product SHA fixed for independent Work audit. **No deployment without audit PASS**; PREVIEW only after independent review, TEST/PRODUCTION approval separate.
- **Parallel open but NOT combined:** existing app436 Recent PC9/mobile10 duplicate identity diagnosis, Issue #237, and historical Next Song manual-command error remain open. Do not force song count by deleting/recreating originals.
- **Current status:** diagnosis/issue/docs only; no implementation, commit to product source or deployment; QA FAIL. Stage416 1/4·25%; speed historical 5/5·100% unremeasured; new task product gates 0/4·0%.

---

## NEXT — app436 physical duplicate diagnosis, do not force 9→10 (2026-10-20 KST)

- Live app version 436 verified by user screenshot; PC Recent 9, mobile Recent 10, mobile rows #2/#3 reported identical; #3 original generation ID/time not yet shown. Treat 436 acceptance FAIL.
- Collect one mobile #3 screenshot showing title + created timestamp. Compare with photographed #2 ('내가 꿈 꿨던 어른', 2026-10-19 06:49). Classify genuine sibling vs stale alias duplicate without deleting originals; no guessing from title alone. Use same-account owner-local identities and exact generationBatchId/index or verified stable source links if needed.
- Inspect single-key `getRecentSongIdentityKey` and `normalizeRecentSongList`, generation insertion and full Firestore merge. Add fail-closed test for same actual song with batch ID missing on one copy, separate gen index siblings, same title but distinct original songs, no added cost/read/writes for healthy caches; verify currently frozen Explore likes and media. Do not deploy a blind merge/migration. Old command restore remains separate.

---

## NEXT — app436 guarded Recent local-only song recovery safety check (2026-10-20 KST)

- User passed Explore like/unlike same-account PC/mobile after shared RTDB two-field fix; **freeze this behavior**. app436 Recent local-only marker recovery is a separate change; no like/Worker/RTDB/shared Rules touches.
- Pin Draft app436 exact SHA after 451 regression. Verify 9 canonical vs 10 local with one valid newer unconfirmed ID produces exactly 10 without losing server rows; explicit delete/newer server revision, stale/missing marker, wrong ID, full canonical 10, same stable ID rename and offline failure must never resurrect/write. Only true pending generated mutation may issue read/transaction; healthy cache reopen W0/R0. Ensure result UI update/local ACK happens ONLY after committed transaction. Check no repeated reads on navigation, no runaway Firestore costs, save-heart/media and title/lyrics edit 150s batch unchanged.
- Do **not** merge/deploy until CI + independent review PASS. Old Music Note direct manual input restore remains separate known FAIL pending proof of original storage alias. App435 physical QA for Recent still FAIL before actual PC/mobile user check.

---

## NEXT — app435 shared like Rules LIVE verified; three physical failures still open (2026-10-20 KST)

- Shared RTDB publisher/rules schema mismatch fixed in live shared Rules (two bounded UID-private fields only); require a single meaningful PC↔mobile user check of `지금 너로, 충분해` and `거기 아직 있어`. Same-account liked heart must converge and retry notification toast must stop; user data and caches untouched. Do not claim physical PASS from static/live Rules comparison.
- Recent mobile 10 vs PC 9 remains unresolved. PR #285 stable song-ID dedupe candidate was independently found and CI PASS, but cannot prove true missing song recovery. Do not merge/deploy based solely on id-dedupe without confirming actual local/canonical IDs and preserving unconfirmed only copy.
- Historical Music Note `다음곡에 적용` user direct command still fails: require exact old persisted owned source/alias evidence; never substitute generated prompt/lyrics.
- Stage416 client OFF; keep current preview version 435; no TEST/PRODUCTION promotion; no repeated full dataset scans/migrations. Source branch refs and proof in CURRENT_RELEASE_STATE.md.

---

## NEXT — app435 Hosting PREVIEW release and acceptance (2026-10-20 KST)

- Merge Hosting-only release PR based on reviewed app435 source and await `SORIDRAW PREVIEW App Release` Action triggered by changed `.deploy/preview-app-release.trigger`. Check TS/Build/related regressions, exact https://preview.soridraw.com/ served HTML/app-version 435 and unchanged main, production and shared data; deployment only Hosting. If any release gate fails, stop and report.
- Existing extra 290-recent/290-studio/427-legacy test mismatches remain a clearly separate backlog and are not declared green. User to conduct app435 PC/mobile Music Note old recipe, direct user command/tempo, offline, Recent cross-device scenarios; no TEST/PRODUCTION until separate user approval. Keep Stage416 OFF.

---

## NEXT — app435 3 Work-audit failures fixed in draft: exact SHA CI then independent audit (2026-10-20 KST)

- Target current Draft PR #282 branch HEAD; compare with preview base `11f46242f3c08fc9076dd10abe90be0008aac098`. Run exact commit GitHub full CI, including verify-451 live persisted inline ACK and verify-454 Studio tempo and owned favorite offline guards, TypeScript, Build, Functions build, frozen like/follow/explore and read-only RTDB Rules. Do not call developer CI an independent PASS.
- Require auditor to reproduce original Work 3 counterexamples: (1) canonical tempo:null + old requestPayload tempoConfig 145–155 must leave Studio clearAll tempo defaults, preserve trusted current config; (2) RTDB live changed-row UI NEW but failed `saveRecentSongsCache` with disk OLD must not advance local version/ACK and should read on safe retry/restart; success keeps live R0; (3) original getDocFromServer offline/missing/wrong owner aborts both Music Note list/modal Apply with user retry toast, verified valid owner succeeds, shared-only view unchanged.
- Audit other existing `290-recent` comment-text, `290-studio` pre-existing, `427-legacy` clear policy mismatches separately; don't rewrite legacy baseline just to turn checks green. Inspect Recent preview A/B + heart/public/media untouched, page-entry R0 and one explicit next-song single-doc read per click.
- PR remains Draft unmerged, no PREVIEW/TEST/PRODUCTION deploy or shared data writes. Separate independent Work/GPT-6 audit when user tool availability permits; user reported GPT-6 Astra High cannot be used for more work now. Hold app435 at 3/4·75%, Stage416 OFF 1/4·25%, speed 5/5·100% historic/unremeasured.

---

## NEXT — app435 exact SHA CI + independent Work audit; no merge before PASS (2026-10-20 KST)

- Pin latest draft PR #282 SHA and compare against preview `11f46242f3c08fc9076dd10abe90be0008aac098`. Verify full GitHub Actions TypeScript/Build/451/453/454 and all frozen like/follow/publication/tests; complete only when exact job SUCCESS.
- Independently inspect `musicNoteNextSongRecipe.ts` canonical/pending genre and customGenreInput provenance and the real `FavoritesPage → pendingAppliedKeywords → App.tsx Studio setSubGenre` path. Confirm exact canonical genre:[] + old cached/request custom input selects none; authoritative canonical/pending current custom input remains. Confirm sourceVersion 0 or stale unchanged card on second sequential deliberate click reads updated owned one-document original, simultaneous click coalesces, error retry works; normal page entry/warm view R0 retained.
- Recheck Recent retained A edit-preview/B settled snapshot, storage-failure ACK/version gate, media/heart, cost, UID isolation. No backend schema migration, polling, cache reset, modification to frozen likes/Workers/Functions/Rules. Source-only test is not PC/mobile physical parity or billing proof.
- **Separate read-only independent Work/GPT-6 audit PASS required** before PR merge and PREVIEW Hosting release; then user physical PC/mobile acceptance, TEST by user approval, PRODUCTION explicit approval only. Keep Stage416 OFF.

---

## NEXT — app435 final click provenance + end-to-end independent audit (2026-10-20 KST)

- Verify PR #282 latest exact SHA versus `preview` `11f46242f3c08fc9076dd10abe90be0008aac098`. CI must PASS on the new SHA (TypeScript, Build, Functions type build, existing 450–454, like/follow, publication and read-only Rules); no merge/deploy until separate Work audit PASS.
- Independently execute the *actual* FavoritesPage click consumer into `pendingAppliedKeywords`: original canonical tempo:null with old requestPayload tempo:95 stays null; original genre:[] plus generated prompt `[Genre]` stays []; auto-empty original userInput + requestPayload actual command restores only actual; old cached command/old clear cannot outrank it; compatible actual pending command/clear can. Ensure list and modal click both hydrate exactly owned one-document; failed/offline hydration never fabricates an original.
- Audit Recent first retained A draft masking B N+1, durable storage failure and retry/read gating, saved heart/public/lock/audio/Suno, R0 unchanged warm reopen. Preserve app434 publication and frozen like/follow. No extra listener, Firestore repeated read, D1 scan, deployment, shared data migration/cache purge, or TEST/PRODUCTION.
- Stage416 OFF. After exact SHA independent PASS, developer may merge and use guarded Firebase PREVIEW Hosting only, then real PC/mobile and historical-song QA. 100k billing unmeasured.

---

## NEXT — app435 re-audit canonical present-null / confirmed genre precedence (2026-10-20 KST)

- Check new PR #282 exact SHA, GitHub CI TypeScript/Build/454. Reproduce canonical appliedKeywords tempo null despite historical requestPayload tempo non-null, canonical genre [] despite legacy genre, canonical current genre vs old cached/request subGenre, verified pending genre vs outdated subGenre. Confirm this additional guard changes only deliberate Next Song click recipe merging.
- Retest offline Recent B cache write failure and exact ACK/retry guards (451/453), Music Note 60s, Recent 150s, Studio heart +30s, Explore app410/421 like/follow and app434 publication. No merge/PREVIEW until independent PASS; no shared data/TEST/PRODUCTION changes.

---

## NEXT — app435 independent exact-SHA audit after two P0 source corrections (2026-10-20 KST)

- Target final draft PR #282 HEAD against preview `11f46242f3c08fc9076dd10abe90be0008aac098`, full CI must PASS first. Do not merge/deploy on CI alone.
- Test click Next Song old cached genre/tempo/vocal and command vs confirmed exact original, explicit canonical null and [], absent-only fallback, compatible pending draft winner, original legacy command, newest proven clear, and exact one-document owned hydration with no collection scan. Inspect FavoritesPage getSongGenreValues downstream.
- Test offline A retained edit-preview masking B canonical; failed saveRecentSongsCache MUST NOT advance local canonical version, mark gap verified, or ACK pending. Successful stored B can advance revision while A text remains unsettled; same warm revisit R0 and genuinely newer B2 rechecks.
- Preserve app434 publication/feed/title, app410/421 likes/follows, app349 Studio heart +30s, Music Note 60s/Recent 150s, media and UI. Stage416 OFF. No shared user data changes, migration, Worker, Functions, Rules, main/TEST/PRODUCTION, or PREVIEW deployment until separate independent audit PASS. Physical PC/mobile parity and 100k billed read/write unverified.

---

## NEXT — app435 two independently identified boundary failures: re-audit exact new SHA (2026-10-20 KST)

- Patch only exact previous FAILs: click legacy command-vs-older-clear precedence in `musicNoteNextSongRecipe.ts`, and confirmed B aggregate revision vs unsettled A text preview in `App.tsx`; add tests 454 and 451. No functional change to publication/likes/follows/save hearts/visuals.
- Independent auditor must run NEW exact SHA CI and check real helpers/consumer; specifically newer canonical command beats older requestPayload clear, newest explicit clear still wins, verified B doc version N+1 persists despite A preview, same-signal reload R0, genuine newer B2 still reads, and pending canonical ACK separated from RTDB draft. If FAIL no merge.
- No hosting/worker/Functions/Rules/shared data deployment or branch promotion until separate independent PASS. After PASS developer may merge into preview and follow existing guarded Hosting release. PC/mobile #237/#277 and historical Next Song #229 actual QA and 100k costs remain unverified; TEST/PRODUCTION BLOCK.

---

## NEXT — app435 PR #282 new SHA independent Work audit, then gated PREVIEW release (2026-10-20 KST)

**No more feature implementation until independent audit** unless new exact-SHA CI fails or specific audit blocker appears. Compare actual latest draft PR #282 HEAD against PREVIEW `11f46242f3c08fc9076dd10abe90be0008aac098`. app434 remains deployed and public/private/Explore title/live improvements must remain intact.

1. **Recent missed B audit:** PC persists B while mobile closed, then sends A text `edit-preview`, so RTDB first retained node is only A and cached profile version is stale. Read code `src/services/userDomainSyncService.ts`, `src/lib/recentSongsSyncGate.ts`, `src/App.tsx`. Verify initial retained draft produces persistent gap marker but NEVER ACKs canonical; one guarded `user_recent_songs/{uid}` read recovers B while local newer A text remains; on same signal reopen R0. Verify unread/failed read retries, new signal while read inflight, pending on sender, no unconditional data wipe, no repeated R on live drafts or stable warm reopen. Execute regression 451/453 independently.
2. **Original legacy Next Song audit:** `src/lib/musicNoteNextSongRecipe.ts` must recover literal old stored `requestPayload.appliedKeywords.commandInput` even if canonical `appliedKeywords.userInput:''` and local `userInput:''` are generated empty defaults. Explicit proven later clear wins; *older* clear must not erase newer actual nonempty command. `FavoritesPage.tsx` list and modal button exact user-owned favorite 1-document click hydration; same-version cache bypass, owner check, session memo 456 and Studio `pendingAppliedKeywords`+userInput. No default prompt-as-original, no full collection scan. Explicit uncertainty for old clear without provenance; physical historical user sample QA required.
3. Check app434 publication, app410/421 likes/follows, Studio 30s save-heart, Music Note 60s, Recent 150s, Suno exact playback/media, responsive UI, worker/Functions/rules nonchanges and 100k read/write cost. Use real QA after code-only independent audit.
4. Latest GitHub full CI exact head TypeScript/Build/regression must be PASS; frozen SHA stays fixed throughout separate GPT-6/Work read-only audit. If FAIL stop and return to developer. **Do not merge, change shared user data, invalidate healthy cache, or deploy TEST/PRODUCTION without approval.** PREVIEW release only after audit PASS and guarded existing Hosting trigger, then human PC/mobile acceptance.

---

## NEXT — finalize app435 #282 corrected exact code audit, NO MERGE before PASS (2026-10-20 KST)

**Source of truth:** PR #282 `fix/app435-integrated-parity` to `preview` baseline `11f46242f3c08fc9076dd10abe90be0008aac098`, current app deployed app434. Previous Work independent audit `eeda037...` FAIL, and extra read-only check `4cd053...` FAIL. Current product fix before doc commit `dfc2edb3b8a851189df20c687aa60335de56e486`. Use latest actual PR SHA after doc updates.

1. Check full GitHub run on **latest SHA**: TypeScript, Build, existing 127/191/410 liked/follow/428-434 publication, 450-454 regressions and Rules. If CI fails, halt and fix exact failing assertion/code; do not merge.
2. Independent audit **in separate Work mode** of original-song Next Song `favorites/{id}` click lookup, stale identical-version detail-cache bypass, one-doc read per song/version, owner UID check, preserve true latest explicit blank and recover persisted legacy direct command. Check both row menu and details, Studio command window `pendingAppliedKeywords`, and no fabricated prompt/lyrics. Historical note with truly missing persisted command cannot be restored by guessing.
3. Independently execute `recentSongCanonicalPreviewGuard453` and `pickRecentSongLiveTextPreview457`: stale server A old title versus current draft A new, canonical favorite/public/lock/media fields win, canonical B still recovered, no null generation batch/index/genre changes, newer server timestamp outranks draft. Test partial/null preview, same-UID offline→reopen, no premature ACK or repeated gap reads.
4. Preserve app434 public/private, Recommended/Latest real-time, title, old app410/421 personal like/follow, Studio 30s save heart, Music Note 60s, Recent 150s; no D1/whole Feed query, no new RTDB listener or server write/scan. Measure costs where possible; 100k remains unmeasured.
5. PR #282 stays draft until independent exact-SHA PASS. Then decide safety of merge + guarded Firebase PREVIEW Hosting release only; no TEST/PRODUCTION, shared D1/Firestore/R2 user data mutation, migration, cache reset or mass repair. User PC/mobile physical acceptance of historic command, Recent IDs/heart/media & Explore hearts/count is still required.

---

## NEXT — PR #282 corrected app435 exact-SHA independent re-audit then PREVIEW only (2026-10-20 KST)

- Read latest `preview` HEAD and `fix/app435-integrated-parity` PR #282 HEAD. Baseline product `preview` app434; former audited candidate `eeda03739b1bbe4888aa517c1747a4a7a24d172c` **Work FAIL and MUST NEVER MERGE**.
- **First do an independent read-only audit of corrected exact PR SHA:** source `src/App.tsx` + `src/lib/recentSongCanonicalPreviewGuard453.ts` and `src/services/userDomainSyncService.ts` stale canonical vs RTDB draft, lost-item recovery, no early ACK, no Firestore read on edit-preview, 150-second trailing batch and offline/same-UID cases. Pay attention to onValue/first retained signal order, pending local vs remote, and unsettled draft across route change.
- Verify Music Note `src/lib/musicNoteCompactMediaSync452.ts` retains unchanged complete audio/media URLs within 24k budget, does not invent or truncate large arrays, does not change canonical media. Test 452.
- Verify historical Music Note direct command: `src/pages/FavoritesPage.tsx` explicit own exact-document hydration (both list/detail), recipe precedence from `src/lib/musicNoteNextSongRecipe.ts` and `requestPayload`, no constructed prompt/lyrics, no page-entry data reads; Test 454 and frozen app427. Check older cache with `__catalogSummary=false` but omitted requestPayload. If original source lacks command, report impossibility instead of fabrication.
- Then check changed-item Explore public metadata/count isolation 450, other PC/mobile save-heart 349/follow, title, publication, cache and responsive UI, cost no repeat scans. TypeScript/Build/QA exact SHA PASS. **If anything fails, DO NOT merge.**
- If Work PASS, source exact SHA→preview merge and PREVIEW Hosting only through existing release trigger and exact build verification; re-evaluate before worker/functions involvement. **Actual PC/mobile user QA** must verify Recent IDs/count, own Music Note list/hearts, Suno link/cover/audio, historical direct command in Studio and Explore heart/count/like/unlike without navigation. Until real user QA, mark PENDING and TEST/PRODUCTION BLOCK.
- Never reset/wipe user caches, use destructive migration or blindly pick one device as canonical. No data copy/overwrite and no Stage416 5-minute activation.

---

## NEXT — app434 PREVIEW real-device P0 FAIL: restore parity without losing data (2026-10-20 KST)

**Current user direction:** improvements in publication #226 tasks 1/2/3/4/7 seen; #8 likely better. Protect them. **#237 & #277 user acceptance FAIL** must be solved before TEST promotion or release system refactor. Release app434 exact audited product `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`, previous preview HEAD `0b22b95e8903461008538c8a2285d35385084bdb`. No arbitrary PC/mobile truth.

**Step 1 (Issue #277):** reproduce same UID PC↔mobile Explore likes/likeCount divergence *on first app434 entry* from retained app421 personal cache, complete+partial baseline, public count caches, pending outbox, actor display lock, accepted RTDB 127, provisional intent 416, published public changed-card 192. Inspect new app432 `ExplorePage.tsx` publication card/cache count patches vs `overlayExploreLikeDisplayCounts` and `resolveExploreLikeRemoteDisplayCount420` base equality; stale early responses must not overwrite newer personal intent and count must not flip back. Feed/Profile/Popular/Recommended/My Likes parity, active/closed/resume/reload, opposite click fixture. Identify exact reproducing order in test before minimal code fix. Shared public cache must never store actor private counts; personal membership is independent of public count. Stage416/420 OFF remain OFF.

**Step 2 (Issue #237, independently partition):** (A) Recent songs exact UID aggregate `user_recent_songs/{uid}`, local cached count/IDs, revision/RTDB ACK and old-device backlog; (B) Music Note canonical favorites membership, shared R2 Catalog revision/delta, RTDB preview, save-heart +30s pending; (C) exact Suno URL/cover/thumbnail media timestamps vs compact Catalog, local `musicNoteDetailDraft`, `rememberMusicNoteMediaPreview`, owner-scoped RTDB. Test pre-upgrade PC/mobile already holding different historical songs/URLs/thumbnails, offline→online missed multiple changes, delayed settle and restart. Do not clear caches as a fix, use bounded revision/ID deltas only, retain any not-yet-canonical user edit. Same UID eventual IDs+heart+URL+thumb parity is acceptance, not just R/W budget.

**Guards and release:** preserve app434 #226 improvements, #229 legacy next-song, app410/421 like/follow, app349 local save heart + cross-device immediate + per-song 30s canonical, Music Note 60s local-first, all UI/CSS/split. No mass Firestore read, D1 scan, RTDB repeated/poll/per-card listener, source data migration/backfill/deletion, app-version cache invalidation or forced recreate. TypeScript+Build+focused tests, cost check, **independent GPT-6 exact SHA audit PASS**, then separately controlled PREVIEW deploy, actual PC/mobile acceptance, no TEST/PRODUCTION approval yet.

---

## NEXT — app434 PREVIEW user acceptance and separate release-engine quality work (2026-10-19 KST)

- Immutable app434 PREVIEW Worker + guarded shared Rules + Firebase Hosting **deployed SUCCESS**: Worker Run 39292729273, Hosting/Rules Run 39294242410. Preserve `preview` release commit `7e0032fbdd607ee54a09c3aaba16497d9f018f57` and app434 audited source `8eb3264f1c7abaf36a59026248a61c6700e3b9a0` until user acceptance.
- User PC/mobile functional validation only: public/unpublic song, signal to Explore feed and public profile, like/unlike and follow, state on warm cache and across devices. Do not claim cross-device/time/cost PASS until real measured. Do not deploy TEST or PROD without authorization.
- Separately, after accepted release, review release workflow for repeated old verifier drift, duplicated checks, slow CI and post-create Artifact Registry policy signaling. Design a stable fast release engine with no bypass of safety gates, no UI/product changes. Exact Function inventory and Registry cleanup policy remain operational follow-ups requiring risk review.
- Keep Stage416 5-minute path OFF, no shared D1 migration, no background rewrite or user-data copy. 

---

## NEXT — independently audit isolated app434 Candidate Function release path (2026-10-19 KST)

- Confirm latest PR changes only existing Function release workflow, the existing `verify-431-server-publication-signal` guard, and current status/next-task docs. No product source, canonical Worker, Rules, D1, release trigger or shared data edit.
- Confirm staged package copies compiled audited endpoint and core byte-for-byte, initializes shared RTDB exactly as audited source, exports only `publicationRelease431Candidate`, preserves `SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET`, region `asia-northeast3`, and leaves source function behavior unchanged.
- Confirm Firebase CLI uses `preview.publication431.firebase.json` with an isolated source folder; unrelated absent `SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET`/Stage420 functions not discoverable. Only one Function deploy authorized; existing inventory and main/production guards unchanged.
- Require CI Functions Build, TypeScript, Build and frozen like/publication contracts PASS. No deployment or trigger edits before independent audit PASS.
- After audit PASS, recheck Function non-existence/possible partial creation from Run `39257665533` before a new one-time trigger. Block Worker/Rules/Hosting until Function ACTIVE and secret binding pass.

---
## NEXT — app434 PREVIEW Function Workflow push-trigger independent audit (2026-10-19 KST)

- Audit latest `preview` workflow/docs-only SHA versus app434 audited release `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`.
- `publication-signal-preview-release-431.yml`: `workflow_dispatch` remains, `push` is constrained to `preview` and `.deploy/publication-signal-preview-release-431.trigger` only; workflow source edits alone must not trigger deployment.
- Push manifest must require `release=app434`, `audit_result=PASS`, exact target SHA `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`; error/missing trigger fails closed. Exact checkout, one Function-only preflight, unrelated Functions/main/production protection preserved.
- Verify no `.deploy/*` trigger modified, no product/Worker/Function source/Rules/data change; do not deploy on this audit.
- Only after PASS create the Function-only release trigger; wait for `publicationRelease431Candidate` ACTIVE, then Worker, then guarded shared Rules + Hosting app434. Avoid a half release.

---
## NEXT — app434 PREVIEW release artifact: GPT-6 FOCUSED AUDIT ONLY (2026-10-19 KST)

- **Audit latest `preview` HEAD after this docs-only merge.** Product behavior underneath was already independently PASS at `8b793206c67277dbe78b97426a340bcb2a613cdb`; release artifact preparation is PR #252 merge `7f1a4031974547b0884d747bbc502303d74a9555`.
- Focus only on release identity/provenance:
  1. Current `canonical/preview-worker.js` must equal the audited app434 base Worker plus the audited patch100 then patch101 **byte-for-byte**; no third Worker logic change.
  2. patch100/101 in the release artifact must be byte-identical to the product-audited SHA.
  3. `canonical/source-sha256.txt` must equal `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`.
  4. `public/app-version.json` must be 434 and no client product logic after the audited SHA may differ except release identity/QA files.
  5. PREVIEW Worker config must still target only `publicationRelease431Candidate`; no TEST/PRODUCTION endpoint or binding change.
  6. Existing release workflows must not replay a different Worker artifact or include D1/user-data migration.
- Verify Run `39168027033` SUCCESS and the four release markers: exact materialization, canonical SHA256, Candidate Function endpoint binding, app version 434.
- Confirm deployment is still 0 and live PREVIEW remains app421.
- Protect #229/#237/app421/app349/Music Note batching/UI/CSS/shared user data.
- **PASS only then:** release order is Candidate Function → exact Worker → shared read-only publication Rules + Hosting app434. Then run actual PC/mobile/second-account publication matrix and cost diagnostics. No D1 schema/shared user-data change.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until this exact release artifact audit passes.

---

## NEXT — app434 same-timestamp publication signal ordering: GPT-6 RE-AUDIT ONLY (2026-10-19 KST)

- **Do not implement more before re-audit unless a concrete blocker is found.** Audit latest `preview` HEAD after this docs-only merge; product code underneath is PR #250 merge `07810831d99fd37b366412265564085ae0a1de2a`.
- Re-test the exact app433 FAIL finding end-to-end through the real service:
  1. RTDB receive: public v10 and private v11 with the same row `at` must both reach the listener; lower/older timestamps must remain blocked.
  2. settled ACK: after public v10 is settled, same-timestamp private v11 must still be unresolved and processable; after v11 settle it must be considered settled.
  3. legacy upgrade: old localStorage ACK rows containing only `at + checkedAt` must load as version 0 and must not suppress a newer same-timestamp version.
  4. page wiring: `ExplorePage.tsx` must pass the actual signal version to both `hasSettled...` and `rememberSettled...`.
- Reconfirm app433 PASS items remain intact: Recommended/Latest new-public insertion, delayed older public Edge response blocked after newer private, UTF-8 diagnostic / no false 115.2MB absolute bound, 100k real billing still explicitly unverified.
- Reconfirm app432 boundaries: one compact RTDB row, Search/hidden/Popular no global listener, owner-scoped public profile, browser write false, Edge HIT R2=0, live-card route D1 R0/W0.
- Protect #229/#237/app421/app349/Music Note batching/UI/CSS/shared source data.
- **PASS only then:** coordinate exact audited PREVIEW release of Hosting + Worker patch100/101 + `publicationRelease431Candidate` + read-only publication RTDB Rules. No D1 schema/shared user-data change. After deployment run PC/mobile/second-account and cost diagnostics before advancing progress.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until independent PASS.

---

## NEXT — app433 #226 app432-audit corrections: GPT-6 RE-AUDIT ONLY (2026-10-19 KST)

- **No more implementation before re-audit unless a concrete blocker is found.** Audit latest `preview` HEAD after this docs-only merge; product code underneath is PR #248 merge `843c1f044012f0f2c413c92969b861f6234a9ee1`.
- Re-test the three exact app432 FAIL findings:
  1. **Recommended + Latest no-navigation insertion:** verify `recommended` is explicitly permitted by the app433 pure policy and that a newly published card enters the shared `tracks` pool used by Latest and recommendation-derived rails/models. Popular remains server-ranked and does not blindly prepend.
  2. **public→private async inversion:** reproduce public Edge fetch pending → newer private signal → old public response completion. The older public response must be rejected before any cache/UI resurrection. Also verify equal R2 millisecond timestamps are ordered by newer server signal version.
  3. **cost wording/math:** confirm the 115.2MB absolute bound is removed; UTF-8 byte diagnostics use `Buffer.byteLength`; actual 100k RTDB/Worker/R2 billed cost remains explicitly unverified.
- Reconfirm app432 boundaries: global signal only active visible Recommended/Latest home Feed; Search/hidden/Popular no global listener; public profile owner-scoped; one retained RTDB row; browser write false; Edge HIT R2=0; live-card route D1 R0/W0; cold/concurrent Edge misses remain a stated scale risk.
- Protect #229/#237/app421/app349/Music Note batching/UI/CSS/shared source data.
- **PASS only then:** coordinate exact audited PREVIEW release of Hosting + Worker patch100/101 + `publicationRelease431Candidate` + read-only publication RTDB Rules. No D1 schema/shared user-data change. After deployment run PC/mobile/second-account and cost diagnostics before advancing progress.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until independent PASS.

---

## NEXT — app432 new-public live delta + realtime cost: GPT-6 AUDIT ONLY (2026-10-19 KST)

- **Do not implement more before audit unless a concrete blocker is found.** Audit latest `preview` HEAD after this docs-only merge; product code underneath is PR #246 merge `49a76941cec8c9efa8c374b81672ae945b84fdf6`.
- Verify #226 remaining two criteria:
  1. **No-navigation new publication:** a new public track appears in an already-open Recommended/Latest Feed from the server-issued tiny signal + shared Edge live card, without page/tab navigation and without a full Feed refresh.
  2. **100k-scale fanout:** RTDB global listener exists only on active visible Recommended/Latest home Feed; Search/hidden/Popular do not subscribe globally; profile uses owner-scoped signal; one signal retains one row only. Validate the <=115.2 MB/100k-active application-payload hard envelope and clearly distinguish it from real Firebase billed bytes.
- Verify shared Edge live-card route: Auth+AppCheck, D1 R0/W0; exact `trackId+updatedAt` cache key; Edge HIT R2 0; cold Edge may read exactly one R2 publication-state object; stale timestamp returns no card.
- Reconfirm browser `.write=false`, Worker HMAC→Function→Admin RTDB issuer, callback failure fallback, and no stale acknowledgement.
- Reconfirm #229 and #237 frozen corrections plus app421 likes/follows/app349 save-heart/Music Note batching/UI.
- **PASS only then:** coordinated PREVIEW exact audited release of Hosting + Worker patch100/101 + `publicationRelease431Candidate` + read-only publication RTDB Rules. No D1 schema/shared user-data change.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until independent PASS.

---

## NEXT — app431 #226 server-issued public invalidation: GPT-6 re-audit ONLY (2026-10-19 KST)

- **No more implementation before audit unless a concrete blocker is found.** Re-audit latest `preview` HEAD after this docs-only merge; product code underneath is PR #244 merge `27e44757a818e686f9970f198ac2ec23f8b7c4ae`.
- Re-audit the three prior blockers against app431:
  1. **Fanout/cost:** unrelated logged-in Explore viewers must perform immediate Worker/R2 R0 for a publication signal. Exact R2 may run only for already-visible changed track/current owner profile; unseen Feed publication uses the existing revision/resume path without new polling/full refresh.
  2. **Authority/abuse:** browser code must have no public RTDB write path and Rules must keep `publicSync/explorePublication/.write=false`. Only Worker HMAC → dedicated Function → Admin RTDB may publish, with exact track-owner binding/freshness/idempotency.
  3. **R2 failure:** server signal must be attempted only after exact R2 state/tombstone write succeeds. Receiver must require exact `state.updatedAt === signal.at`; stale/missing R2 must remain unacked. Callback outage falls back to existing revision/resume recovery rather than trusting stale state.
- Verify exact publication-state route still Auth + App Check + D1 R0/W0.
- Verify the dedicated PREVIEW Function release workflow is audit-gated and deploys only `publicationRelease431Candidate`; PREVIEW/TEST/PRODUCTION endpoint identities remain separated.
- Protect #229 `isLyricMode/lyricMode`, #237 +30s pending save/unsave overlay, app421 likes/follows, app349 save-heart, Music Note batching, UI/CSS and shared user source data.
- **PASS only then:** coordinate PREVIEW release of exact audited Hosting + Worker patch100/101 + app431 Candidate Function + tightened read-only shared RTDB Rules. D1 schema/shared user data remain unchanged.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until audit PASS.

---

## NEXT — app430 #226 cost/permission/failure correction: GPT-6 re-audit ONLY (2026-10-19 KST)

- **No generic implementation.** Re-audit latest `preview` HEAD after this docs merge; product code underneath is PR #242 merge `c03d32a617062e5b85e747f5a981bf2b2019245d`.
- Re-audit the three previous blockers only:
  1. **Fanout:** unrelated logged-in Explore viewers must not issue Worker/R2 requests for a publication signal; only relevant visible owner/track/profile may use the exact R2 route. Fully unrelated new publications only mark the pre-existing Feed revision path stale, with no immediate request/poll.
  2. **Authority/abuse:** RTDB row owner must equal authenticated writer; proof timestamp is bounded; exact route requires Auth + App Check; locally known owner mismatch blocks before fetch.
  3. **R2 failure:** shared invalidation is emitted only with Worker-returned successful R2 proof; receiver requires exact `state.updatedAt === signal.at` before apply/ack. Missing/stale R2 must remain unacked.
- Reconfirm route D1 R0/W0 and bounded <=50 / >=30s relevant request batching.
- Protect #229 `isLyricMode/lyricMode`, #237 +30s pending save/unsave overlay, app421 likes/follows, app349 save-heart, Music Note batching, UI/CSS and shared user source data.
- **PASS only then:** coordinate PREVIEW Hosting + Worker patches 100/101 + tightened additive shared RTDB Rules. Functions/D1 schema/shared user data remain unchanged.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until audit PASS.

---

## NEXT — app429 corrected integrated SHA: GPT-6 re-audit ONLY (2026-10-19 KST)

- Do not add generic implementation unless re-audit finds a concrete blocker.
- Audit latest `preview` HEAD after this docs merge; product code underneath is PR #240 merge `68e0679b82980a6eca58344bc9619da7ebc3cf8a`.
- **#226:** prove legacy polluted cache returns confirmed base; second-account warm Feed/public profile converges from changed-ID signal + exact shared-R2 state without navigation; route is D1 R0/W0; no polling/full refresh.
- **#229:** prove `isLyricMode`/`lyricMode` parity and continued exclusion of lyricDraft/finished lyrics; canonical-newer wins; missing historical command remains absent.
- **#237:** prove Catalog recovery cannot hide/reverse a +30s pending save/unsave and canonical cache remains separate; bounded R2 Catalog recovery occurs only after real remote canonical mutation.
- Protect app421 likes/follows, app349 +30s save-heart settlement, Music Note batching, UI/CSS and shared source data.
- PASS only then coordinate PREVIEW Hosting + Worker patches 100/101 + additive shared RTDB Rules; Functions/D1 schema/shared user data stay unchanged.
- Progress stays `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%`.

---

## NEXT — exact integrated audit gate after app428 (2026-10-18 KST)

- **Do not add more generic implementation before audit unless a concrete blocker is found.** Current integrated code already contains title display #234, Music Note Catalog recovery #235, legacy recipe/shareBundle #236, and publication confirmed-state #238.
- **Audit target:** latest preview HEAD after this status-doc merge. Audit #226/#229/#237 as one connected state/cache release, not isolated diffs.
- **#226 must prove:** failed publication never paints public after route/reload; successful publish/unpublish patches only exact track; same UID PC/mobile receives snapshot signal without navigation; published title/genre update occurs after canonical Music Note save and appears in Feed/Profile/Search projection; no whole Feed/profile scan or app-version invalidation.
- **#229 must prove:** recent canonical behavior unchanged; old persisted requestPayload fields restored; canonical wins conflicts; historically absent command stays absent; public Worker shareBundle matches client contract; no collection scan/backfill.
- **#237 must prove:** immediate RTDB heart preview remains Firestore R0/W0; remote canonical catch-up reads bounded private R2 Catalog only after real mutation; stale Catalog cannot undo exact patch/pending intent; full membership and Recent save-heart converge after missed mutations; no Firestore scan/bootstrap.
- **Release after PASS:** one coordinated PREVIEW release using exact audited Hosting source and, because patch 100 changes public shareBundle Worker behavior, audited PREVIEW Worker bundle. Deploy only changed services; Functions/Rules/D1 schema/shared user data remain unchanged unless audit finds a real requirement.
- **Real-device matrix after deploy:** PC↔mobile same UID save/unsave multiple songs; one device closed then reopen; publication success/failure; Feed + own public profile without navigation; second account warm Feed/profile; published title edit; old 6-month Music Note next-song apply; public next-song apply; likes/follows regression; cost diagnostics.
- **Progress reporting every turn:** `P0-1 4/6 67% | P0-2 4/5 80% | P0-3 3/5 60% | Stage416 1/4 25% | Curated 0/4 0%` until a gate actually passes.

---
## MASTER EXECUTION ORDER — 2026-10-18 KST

### 고정 진척도
- P0-1 공개곡 정합성 #226: **2/6 · 33%**
- P0-2 구형 다음곡 적용/shareBundle #229: **2/5 · 40%**
- Stage416 공개 좋아요 5분 집계: **1/4 · 25% / 대기**
- curated recommendations PR #200: **0/4 · 0% / 대기**
- app421 closed-device 좋아요: **5/5 · 100% / USER PASS 동결**
- 앱 속도 개선: **5/5 · 100% / 완료**

### 지금부터 실행할 작업 순서

#### STEP 1 — #226 + #229 공통 입력/상태 계약 확정
- publication은 `confirmed state`와 `pending/retry intent`를 분리.
- Music Note next-song recipe는 하나의 legacy-compatible normalization contract로 통일.
- 같은 source song에 대해 Music Note 직접 적용 / own Explore / public Explore / shared-note가 가능한 범위에서 동일한 recipe를 내야 한다.
- 이미 저장되지 않았던 historical command는 복구하지 않으며 generated prompt로 위조하지 않는다.
- **완료 시 진척도:** P0-1 3/6, P0-2 3/5.

#### STEP 2 — 최소 코드 구현
- false-public 제거.
- exact changed-track Feed/Profile/Search convergence.
- published title/genre edit exact update.
- legacy recipe normalizer 연결.
- recent canonical song behavior와 app421 likes/follows/UI 보호.
- full scan, cache-all-clear, version invalidation, polling, migration/backfill 금지.

#### STEP 3 — 정적/실행 회귀 테스트
- TypeScript + Build.
- publication failure/pending/confirmed tests.
- publish/unpublish/title update Feed/Profile/Search exact-track tests.
- same UID second device + second account warm cache convergence tests.
- recent/legacy/absent-command next-song fixtures.
- shared-note/follower-save parity.
- unchanged page/update/re-entry R0/W0 및 mutation O(1) 확인.
- **완료 시 진척도:** P0-1 4/6, P0-2 4/5.

#### STEP 4 — preview commit/push + exact SHA 고정
- 구현 범위 밖 파일 변경 없음 확인.
- CURRENT_RELEASE_STATE 업데이트.
- 감사 대상 SHA 고정 후 더 이상 임의 변경하지 않음.

#### STEP 5 — GPT-6 독립 감사
- WORK_AUDIT_CHECKLIST 1~27 전체.
- 기능/비용/데이터/PRODUCTION-first/cache-upgrade/PC-mobile/other-account 확인.
- FAIL이면 PREVIEW 배포 금지, 최소 수정 후 새 SHA 재감사.
- PASS면 P0-1 5/6, P0-2 감사 단계 완료.

#### STEP 6 — PREVIEW exact artifact 배포 + 실기기
- Firebase/Worker/Functions 중 실제 변경된 서비스만 배포.
- preview.soridraw.com exact build 확인.
- 같은 계정 PC/mobile + 다른 계정 warm Feed/public profile 검증.
- 구형 Music Note 실제 다음곡 적용 + 공개 후 적용 검증.
- TEST/PRODUCTION 비변경 확인.
- PASS 시 P0-1 **6/6 100%**, P0-2 **5/5 100%**.

#### STEP 7 — Stage416 재개
- 기존 app421 좋아요 frozen behavior 유지.
- activation guard 재감사 → PREVIEW-only 5분 public count activation → controlled E2E → 독립 감사.
- Stage416 4/4가 되기 전 TEST 승격 없음.

#### STEP 8 — curated PR #200 별도 처리
- concurrent R2 snapshot overwrite와 cross-env revision authority를 독립적으로 해결/감사.
- 공개곡/좋아요 P0와 혼합 금지.

### 작업 중단 조건
- shared user data migration/backfill/delete 필요.
- whole Feed/Profile scan 또는 app-update cache reset 필요.
- 좋아요/팔로우 frozen path 재작성 필요.
- 비용이 사용자/곡 수에 비례하는 반복 read/write로 변함.
- TEST/PRODUCTION에 비호환 schema가 생김.
- 위 조건이면 구현을 멈추고 사용자에게 이유/대안/영향을 먼저 보고한다.

---
## IMPLEMENTATION GATE ADDENDUM — Issue #229 old-song next-song normalization (2026-10-18 KST)

Issue #226 공개곡 P0와 병행 설계하되 **별도 호환 레이어**로 구현한다.

- 하나의 canonical `resolveNextSongRecipeFromMusicNote(source)` 성격의 read-time normalization contract를 우선 설계한다. 호출부마다 서로 다른 fallback을 계속 늘리지 않는다.
- 입력 호환 순서: 최신 `appliedKeywords` → 누락 필드만 `requestPayload.appliedKeywords` → 알려진 구형 `requestPayload` direct recipe → top-level legacy aliases. 새 값과 옛 값이 충돌하면 최신 canonical이 반드시 이긴다.
- command input은 실제 저장된 `userInput/commandInput/directInput/customPrompt` 및 확인된 requestPayload aliases만 사용. generated `prompt/style`을 원래 사용자 명령으로 대체하지 않는다.
- Music Note 직접 apply, GlobalPlayer/Library apply, own Explore bounded recovery, publication Worker shareBundle, follower-save/shared-note copy가 같은 field contract를 사용하거나 deterministic parity test로 동등함을 증명한다.
- 언어/제목 언어, language mix, ratio/targets, tempo/vocal/rap/structure/custom inputs, situation/summary, point sounds 등 현재 next-song field set을 legacy fixture로 검증한다.
- 읽기 비용: Music Note 명시적 apply에서 현재 exact-doc hydration 이상 추가 read 0; public publication도 기존 mutation source object 외 추가 collection scan 0; other-account public apply는 source Firestore를 읽지 않고 shareBundle만 사용.
- 과거 사용자 문서를 일괄 rewrite/backfill하지 않는다. 실제 값이 없는 legacy 필드는 현재 기본값으로 남기며 추정 생성 금지.
- #229 PASS 전에는 “구형 곡 공개 시 다음곡 적용 정보 완전성”을 PASS로 선언하지 않는다.

---

## IMPLEMENTATION GATE — Issue #226 연결 기능 영향지도 확정 후에만 코드 수정 (2026-10-18 KST)

공개곡 P0 구현 전에 아래 흐름을 **쓰기 전 감사**한다. 각 항목은 `영향 있음/없음 + 이유 + 보호 테스트`를 남긴 뒤 실제 수정 파일을 정한다.

- **Music Note 원본:** Detail title/genre/lyrics/Suno source local draft → IndexedDB durable draft → page-exit canonical Firestore batch → cross-device Music Note preview. 기존 묶음 저장 횟수/타이밍 유지.
- **공개 상태 엔진:** `explorePublicationService` confirmed cache / pending outbox / retry / registered track identity / pageSyncCoordinator. Pending과 confirmed UI를 분리하되 재시도 내구성 보존.
- **같은 계정 동기화:** `userSync/{uid}/explorePublication` compact RTDB signal, retained signal/origin certificate, PC↔mobile 및 PREVIEW↔TEST↔PRODUCTION origin cache.
- **공용 표시:** Explore Feed local cache + revision/R2 snapshot, Public Profile first-view local cache + revision + trackCount. 공개/비공개/title 변경이 exact track 단위로 양쪽에 같은 결과를 만들어야 함.
- **Worker/공유 canonical:** D1 `tracks`/track_stats/public profile, publication batch, R2 Feed/Profile/card projection, Edge invalidation. canonical 성공과 derived-cache 실패를 구분하고 전체 scan/rebuild 금지.
- **검색/장르:** `tracks.title`, `search_text`, `primary_genre` 및 검색 결과의 exact-track 갱신 여부 확인. 제목 변경 후 과거 검색 projection 잔존 금지.
- **다른 기능 보호:** follower-save/shared-note snapshot 권한, curation의 공개/비공개 반영, 공개곡 likeCount/trackId, follow/profile counters, likes Stage416/app421 frozen behavior는 연결 영향만 검사하고 이유 없이 수정하지 않음.
- **캐시 호환:** 기존 app420/app421 브라우저 캐시, 빈 캐시, 다른 계정 warm cache, 다른 origin warm cache를 모두 포함. app update 자체가 read/write를 만들지 않음.

**코드 수정 중단 조건:** 한 변경이 위 연결 범위를 넘어 구조 재설계/새 polling/전체 캐시 무효화/공유 데이터 migration을 요구하면 구현을 멈추고 비용·회귀 범위를 먼저 보고한다.

---

## NEXT HIGH — Issue #226 공개곡 정합성 P0를 Stage416보다 먼저 수정 (2026-10-18 KST)

- **우선순위:** app421 closed-device like recovery는 사용자 PASS로 동결. Stage416 public-five-minute activation은 이 P0가 끝날 때까지 대기. 기존 정상 likes/follows/Music Note batching/UI를 건드리지 않는다.
- **Fix A — false-public state:** failed/partially failed publication row는 durable retry outbox를 보존하더라도 confirmed publication cache/UI에는 prior/base state를 유지한다. 성공 row만 confirmed state와 compact sync signal을 publish한다. route/reload가 pending을 confirmed public로 승격하면 FAIL.
- **Fix B — Feed/Profile cross-account convergence:** owner-private signal과 별개로, publication mutation 성공 시 exact changed track만 다른 origins/accounts가 알 수 있는 bounded shared change proof를 사용한다. 기존 shared R2/Edge revision/card route를 우선 재사용하고 polling/per-card subscription/whole Feed refresh를 만들지 않는다. Warm Feed와 warm public-profile 모두 navigation 없이 changed track만 갱신/삭제해야 한다.
- **Fix C — public metadata edit:** already-public Music Note title/genre처럼 public card에 보이는 canonical field는 Music Note canonical detail settlement와 연결해 exact track만 publication canonical + R2 Feed/Profile/search projection에 반영한다. 매 키 입력 write 금지; 기존 local preview/batched Music Note persistence를 보호한다.
- **Backend failure diagnosis:** 현재 `PUBLICATION_BATCH_PENDING`은 top-level 200 안의 row `ok:false`도 동일 toast로 뭉개므로, 테스트에서 실제 row failure code/단계를 노출해 canonical mutation 실패와 derived-cache failure를 분리한다. canonical 성공을 derived failure 때문에 false failure로 뒤집지 않는 계약을 검증한다.
- **Mandatory tests:** failed publish→private UI after navigation + retry retained; first publish initiator Feed/own profile; same-UID second device no-navigation; second account warm Feed + warm public profile no-navigation; unpublish exact removal; published title edit exact update; unchanged entry/update/re-entry D1/Firestore data R0/W0; mutation O(1)/no full rebuild; app421 likes/follow regressions.
- **Flow:** focused implementation on preview/isolate → TypeScript/Build/executable regressions → exact SHA GPT-6 independent audit → PASS only then PREVIEW deploy → user PC/mobile + second-account verification. Shared data migration/backfill/delete and TEST/PRODUCTION deploy forbidden without separate approval.
- **Issue:** #226 `P0: Music Note 공개곡 정합성 — 실패 후 가짜 공개, Feed/Profile 수렴, 공개 제목 갱신`.

---

## NEXT — app421 accepted; resume Stage416 public five-minute PREVIEW activation as the next like-system task (2026-10-18 KST)

- **Completed/frozen:** PREVIEW app421 closed-device PC↔mobile like recovery passed user real-device acceptance. Do not reopen app410/app422/app423/app424 client sync without a new reproducible defect.
- **Next Stage416 gate:** overall Stage416 remains 1/4 · 25%. The public five-minute coalescing Functions exist but remain HARD OFF. Before any activation, independently re-audit the latest 191 premature-public guard/current activation source and release guard; only then proceed with PREVIEW-only coordinated Worker + one-Function-at-a-time activation and one controlled Master E2E.
- **Acceptance for Stage416 2/4:** ordinary users keep immediate personal heart behavior; public count changes only after the configured shared window; PC↔mobile converges; mutation stays O(1); unchanged page/update/re-entry remains no D1/Firestore data read/write; no whole Feed/profile rebuild.
- **Deferred like follow-ups:** durable net-zero UID completion receipt for missed/new-device proof and measured R2/Edge request cost remain separate. Do not add broad fan-out/polling/full scans merely to close these items.
- **Separate non-like blocker:** draft PR #200 (SORIDRAW curated recommendations) still has concurrent R2 snapshot overwrite and cross-environment revision-authority concerns. Handle after the like-system stage or as an explicitly separate task; never combine it into Stage416 activation.
- **Release rule:** PREVIEW only until its independent audit and controlled live E2E pass. TEST requires user approval; PRODUCTION requires separate explicit approval. No shared-data migration/backfill/delete.

---

## NEXT — app421 PREVIEW Hosting candidate QA PASS, await explicit approval / real-device like verification (2026-10-18 KST)

- **Prepared release:** exact Draft PR #222 HEAD `e87b08bfdf5353ff33eef72e845acd8178134df5`, just app-version421 and canonical Hosting trigger, [Quality Run 39099651971](https://github.com/andrawing1212/soridraw-music/actions/runs/39099651971) SUCCESS. Baseline preview code `80bd7734ed211cb883327c1cf3ca7072ff9c77ab`; actual live PREVIEW still app420. Never call GitHub code merge a deployed app.
- **Preflight cleared:** app423/424 dormant 1m/4m and stale browser feed-revision reply regressions PASS; 033 old static verifier corrected PR #217 Run 39098638303 SUCCESS. app420 minimum guarded version and Stage416 shared public proof tests now run for app421+ via test-only PR #220/#221. No Worker/Functions/Rules/shared data changes. PR #218 superseded and closed, not to be merged.
- **Next operator action once user clearly authorizes `프리뷰배포`:** mark PR #222 ready, recheck exact head, merge once, observe `SORIDRAW PREVIEW App Release` existing workflow; require TypeScript/Build/like/follow verification, Firebase PREVIEW Hosting PASS, live version421 and exact build, main TEST / production commit+site unchanged; stop on any failure. Never auto-deploy without approval.
- **User acceptance immediately afterward:** same UID PC↔mobile with one origin closed 1m, then 4m, then multiple misses/opposite toggle; on reopen hearts/numbers and other-account shared public counts agree without page navigation; check R2/Edge/D1 diagnostics and avoid per-app-update Firestore/D1 reads. If FAIL, fix only causal path; do not modify live app410/448 working sync. Net-zero durable receipt follow-up separate. Work 1–2 audits conserved. Curated PR #200 unchanged/unmerged; no TEST/PRODUCTION approval.

---

## NEXT — app421 Firebase PREVIEW release ready to gate, no further generic implementation (2026-10-18 KST)

- Product source `preview` baseline `86d5fd9bb0173eb955af60eb60f3c16bedfc6048`. App423/424 PR #213 merged with exact CI [39097921024](https://github.com/andrawing1212/soridraw-music/actions/runs/39097921024) PASS. Legacy 033 static-only test pre-existing mismatch corrected PR #217; legacy 033 [39098638303](https://github.com/andrawing1212/soridraw-music/actions/runs/39098638303) PASS, app410 QA [39098626587](https://github.com/andrawing1212/soridraw-music/actions/runs/39098626587) PASS, Stage416 readonly and Follow only PASS.
- PREVIEW app421 candidate isolated in Draft PR [#218](https://github.com/andrawing1212/soridraw-music/pull/218): only version420→421 + official `.deploy/preview-app-release.trigger`, whose merge triggers Hosting deployment. **Do NOT merge without explicit user PREVIEW deployment approval**, nor adjust Worker/Functions/Rules/shared D1/R2/user account data. CI candidate Run `39098826809` should be PASS first. Do not alter working like UI/account membership/public 448 aggregation.
- On approved release: merge exact verified PR head and wait canonical `SORIDRAW PREVIEW App Release` workflow. Require TypeScript, Build, protected Like/Follow tests, Hosting deploy, actual `preview.soridraw.com/app-version.json`=421, exact HTML hash, TEST/PRODUCTION unchanged. Any failure stops rollout.
- After release: obtain user signed-in PC/mobile same UID closed one origin for 1m and 4m, perform opposite likes/unlikes on other origin, reopen without navigation; compare filled hearts/numbers, independent second-account shared public counts after 448 settlement, and per-event D1/R2 cost. Distinguish from deferred net-zero receipt. No TEST/PRODUCTION deployment without new user request. Work 1–2 audits still conserved.

---

## NEXT — app423/424 merged on preview and QA PASS; PREVIEW deployment request and real-device acceptance next (2026-10-18 KST)

- **Product code status:** `preview` merge `6865422a39c843919e4e27e79724c0b054909cc8` includes PR #213 exact tested head `c89539566e1b00dea13e715115679ea9b294eef7`, quality Run `39097921024` SUCCESS (TypeScript/Build, frozen app410/app422, app423/424 actual source tests, likes/follow regressions). No PR #200 curated merge.
- **User-critical acceptance:** with one origin dormant/offline for 1 min or 4+ min while other origin likes/unlikes and another account receives shared publication, reopen must converge same-UID heart and count **without visiting other tabs**; canonical public counts must not be overridden by an older private optimistic ACK. Validate three scenarios: 1-minute resumed, 4-minute expired RTDB, multiple missed windows + same-ID opposite toggles; inspect D1 R0 and bounded R2/edge metadata. Preserve fully-open app410 live behavior.
- **Specific cache fix already done:** dormant revision URL query `__soridraw_dormant_resume=1` skips one-minute `exploreRevisionRequestCache` response cache and same-UID recent-patch shortcut on that actual resume only; hot route/app update uses cached value. Earlier partial PR #213 already addressed public RTDB-before-card and 2min/5min revision gates.
- **Scope:** no Worker/Functions/Rules/D1/R2 user data write/migration, no new polling or overall Feed scan, user-visible CSS untouched; actual R2/Edge request bill not measured. 448 net-zero durable completion receipt remains deferred separately and should not be claimed fixed.
- **Deployment:** GitHub commit/push is not a deployed app. PREVIEW Hosting still app420 Run 39036662143; user must explicitly request `프리뷰배포` before bumping app version and triggering existing Firebase PREVIEW release, then exact build/site and TEST/PROD no-change. No TEST/PRODUCTION promotion without explicit approvals. Work audit quota reserved for final integrated release.
- **If PREVIEW test FAIL:** focus only on the failed path and update source + quality; do not rerun generic cause research or rearchitect live app410/448, and do not touch curated PR #200.

---

## NEXT — app424 closed-device like catchup candidate QA PASS; pin & live-audit before PREVIEW deployment (2026-10-18 KST)

- **Candidate:** draft PR #213 branch `fix/app423-closed-device-retained-like-replay`, exact HEAD `c6814ab32d63fad1b272e059bd78b9a3322a1f3a`. Protected GitHub quality [39081132873](https://github.com/andrawing1212/soridraw-music/actions/runs/39081132873) SUCCESS, TypeScript, Build, frozen app410/app422, existing public changed-card and new 1m/4m true dormant tests PASS. No source merge or deployment. PREVIEW live still app420.
- **Fixed in candidate:** old public RTDB retained event arriving before visible cards now buffered up to 256/3min and replayed changed-ID only. **Longer closure/multiple replaced RTDB events** now relies on a real hidden/pagehide marker and once-only client private R2 revision + shared Feed revision (latest/popular), bypassing ordinary 5m/2m gate only for true resumed epoch; latest R2 shared snapshots retrieved only after revision change. Account catalog is not bulk scanned, changed-only public counts untouched, private membership self-authoritative.
- **Independent audit priorities:** verify dormant lifecycle and hot-tab/multi-tab session token behavior, actual suspended PWA behavior and unknown private R2 revisions, RTDB retained ordering vs cached Feed replacement, personal pending/outbox latest user intent precedence, per-account heart and public count parity when old provisional lock expires or public revision changes; ensure client no D1 scans/writes and no new Worker/Functions/RTDB rules. Include stale opposite ON→OFF, no-signal after 4+min, repeated page navigation 0 server calls, expired public 3min, and actual cost from 10k background returns. New device/ missed 448 net-zero server receipt remains separately deferred and must not be silently claimed solved.
- **Deployment gate:** This turn had no deploy request; keep PR #213 DRAFT/unmerged pending independent scope/race check and user approval for PREVIEW-specific release. Never merge curated PR #200 by accident, do not change main/production, shared user data or worker. Exact PREVIEW app420 currently deployed; Work 1-2 calls reserved for final integrated audit.

---

## NEXT HIGH — app423 closed-device recovery: complete signal-gap and public-revision proof before PREVIEW deployment (2026-10-18 KST)

- **User priority:** PREVIEW app420 PC+mobile concurrent ON/OFF and cross-account shared public likes verified PASS, but a closed mobile/PC reopened after another device's click shows **mismatched private heart AND public count**, persisting past 1-minute common settle. Preserve working live same-UID sync, app410 frozen membership, shared 448 public window, app422 ACK, unchanged UI and backend data. Screenshots supplied in user chat.
- **Draft PR #213 head `33b9714cb5fd43d3cd951ab92a89d53ef8e8479c`**, GitHub quality [39052190957](https://github.com/andrawing1212/soridraw-music/actions/runs/39052190957) SUCCESS. It fixes RTDB retained-public-signal arriving *before* cached Feed visible cards: <=256 temporarily staged rows <=3min, replay only matched cards into existing changed-card R2 route, no extra D1; cold Explore mount now calls 5min-gated private like revision. PR NOT merged/deployed.
- **Remaining counterexample to solve:** origin closed beyond public-signal 3-minute retention, or several changed-track windows replace previous RTDB payload while closed; the latest retained rows cannot reconstruct ALL missing public counts. Existing warm Explore Feed skips ordinary revision check without an explicit event. Personal account state may be stale if private R2 revision's five-minute gate suppresses a recent genuine gap. Need cost-quantified, event/version-aware bounded repair on actual resume/cold-open using existing shared Edge/R2, never a whole liked collection/Feed scan per entry, nor a per-minute timer, user-account-wide read on app update. Identify one authoritative current public number and one signed-in canonical membership and ensure loaded heart+number parity.
- **Minimum tests:** (1) both origins open existing app410 PASS; (2) PC likes/unlikes while mobile closed 1min, B public aggregate converges, reopening mobile heart/count correct without navigation; (3) closed 4+ min and RTDB retained expired, still converges; (4) multi-batch account notifications missed; (5) net-zero completion receipt is separately deferred and must not be falsely claimed as resolved; (6) unlike/like outbox survives failed connection; (7) 10k same-time resumes have no D1/Firestore read storm, at most bounded shared edge/R2 verification on actual changed signal, and no new writes.
- **Do not deploy or change shared user data until tests/independent review PASS.** Keep PR #200 curated isolated; main and PRODUCTION untouched. Prefer Codex High for next multi-file real dormant-resume and cost audit; Work reserved for one final integrated audit.

---

## NEXT — app420 PREVIEW released, real two-device verification; do not redeploy without new defect (2026-10-17 KST)

- **Deployment confirmed:** Firebase Hosting PREVIEW app420 at `https://preview.soridraw.com`, pinned `fbc3435e6042783505163abb5c5743f54d817522`; workflow [39036662143](https://github.com/andrawing1212/soridraw-music/actions/runs/39036662143) SUCCESS, exact build/site version420 PASS, TEST/PRODUCTION unchanged. PR #209 client ACK baseline merged; QA head [39032323212](https://github.com/andrawing1212/soridraw-music/actions/runs/39032323212) SUCCESS.
- **Real user acceptance pending:** test PC/mobile same UID like ON6 and OFF5 while other account sees unchanged public5 until shared release; public changed count eventually converges; no stale private count after ACK/update, same-account heart and My Likes stable. Record observed timing/console counters without extra server writes. Do not claim real-device PASS before report.
- **Known accepted limitation:** net-zero windows provide no durable UID completion receipt on missed RTDB/new device; user approved testing now and follow-up later. Do not add arbitrary DO/Functions/RTDB fan-out without bounded A-recipient cost and separate approval.
- **Next development separate:** curate PR #200 remains draft/unmerged and is not on live PREVIEW. Independent exact-SHA audit/cross-env R2 scheme to be handled separately when product work resumes. Do not conflate with released likes or redeploy Worker/Functions.
- **Absolute unchanged:** TEST main and PRODUCTION unchanged, shared user data unchanged; no release promotion without user authorization. Preserve app410 existing likes, UI, follow, Music Note, local-first and cost gates.

---

## NEXT — app422 actor-private count/public shared baseline candidate QA PASS; release still gated (2026-10-17 KST)

- **Current targeted branch:** draft PR #209 `fix/app422-private-public-ack-baseline`, exact SHA `07c0fcd8a9e33cb2f75695ce6ec8065538aa7195`. QA [39032323212](https://github.com/andrawing1212/soridraw-music/actions/runs/39032323212) SUCCESS: TypeScript/Build/app410 frozen and actual `flushPendingLikes` 5(public)→6(private ON)→5(private OFF), same-UID relay baseline remains public 5. No extra DB requests/writes, no server/Worker/RTDB source changes or deployment. Do not repeat full QA needlessly or reopen root-cause research.
- **Director requirement:** keep real-time personal like heart/private display count stable on all signed-in devices through the shared public 448 window; unrelated accounts must see only shared public aggregation, not that personal provisional. Shared published count must take over when a verifiably newer changed-card release exists. Never treat numeric equality as a net-zero publication receipt.
- **Known residual:** existing 448 net-zero emits no durable UID settlement marker; if private ACK/RTDB missed or on a new device, precise proof is unavailable without new durable UID range and operational costs (DO/Functions/RTDB). Those changes **not authorized**; PR #209 is client-only bounded repair, not total app420 independent PASS.
- **Separate candidate:** curated PR #200 SHA `281846c2cf9f0a08fc30f8b8cfadaffe33eb8c49` QA success but staged shared-curated v421 flag OFF and actual cross-env A→B/production-first binding tests missing. Do not combine unreleased PRs without independent audit and a coherent fixed preview release commit.
- **Next practical:** validate client-only 209 under independent exact-SHA source audit with protected app410 and partial net-zero behavior classified; if necessary reconcile the narrowed acceptance/remaining risk before a single Work integrated audit. Preserve Work 1–2 run budget. No Firebase/Worker/Functions/Rules/shared-data changes, no PR #209 or #200 merge, no deploy, TEST and PRODUCTION unchanged until release gates satisfied.

---

## NEXT — audit app421 late-publication canonical fix; independent app420 release block persists (2026-10-17 KST)

- **Exact draft PR #200 source:** `281846c2cf9f0a08fc30f8b8cfadaffe33eb8c49`, GitHub quality Run `39024082737` SUCCESS. Stale public/private response after a newer canonical visibility state now checks one targeted D1 `tracks` row and resolves current exact public detail if version mismatches. Regression `APP421_PUBLICATION_LATE_SIGNAL_CANONICAL=PASS` in existing `scripts/verify-421-curated-cross-device.mjs`.
- **Independent audit and remaining safety:** read-only verify all Worker curation paths, publication/canonical ordering and version comparisons under true concurrent handlers, D1 R1 per genuinely curated publication, no added reads on unchanged reentry, correct R2 CAS/conditional bootstrap, no shared destructive operations, no lost updates, app405/410 likes safe, old app419 client/worker compatible. Production-first staged shared key/flag consistency and actual live binding parity remain unverified.
- **Release gate:** app420 retained private/net-zero like count independent FAIL remains; no preview Hosting release. New shared R2 `CURATED_SHARED_V421` flag OFF in all environments; do NOT activate one environment or touch main/PROD. No PR merge/deploy until independent exact-SHA PASS and tested migration-free stage plan.
- **Next practical step:** independent Work audit of this SHA and separately app420 correction; after both PASS user-approved PREVIEW Worker/Hosting release and real signed A user→B other-account PC/mobile acceptance (no test/production deploy without explicit approvals).

---

## NEXT HIGH — app421 PR #200 CAS QA passed distinct-song race, resolve same-song & cross-environment safely (2026-10-17 KST)

- **Current candidate:** draft PR #200 `fix/app421-curated-cross-device-revalidation`, new head `686221895af7667d4df230caf25f169e2d5f0225`, quality run [38994316357](https://github.com/andrawing1212/soridraw-music/actions/runs/38994316357) SUCCESS. `writeCuratedSnapshot307` and `syncCuratedPublicationResults307` use max four R2 ETag-conditional retries. The separate two-manager simultaneous **different-track** acceptance regression passes. Frozen likes and TypeScript/Build passed.
- **BLOCKERS:** (a) same-song concurrent A promote/B remove might apply R2 in opposite order from shared D1; (b) targeted public/private sync can race opposite member decisions; (c) cold `materializeCuratedR2FromBase307` still unconditionally writes R2 even after another writer wins; (d) current local `EXPLORE_CACHE` revision remains permanently stale across environment boundaries despite shared D1. ETag CAS alone does not solve these.
- **Do next on same PR branch, without unapproved shared data changes:** first create reproducible deterministic barrier tests for same-track opposite mutation, publication/curation interleaving, cold bootstrap after a concurrent update, CAS exhausted/put throws and 503. Trace shared canonical `curated_picks` state. Evaluate an *actual-mutation-only* bounded max 40 curated-membership D1 reconcile with CAS, retaining D1 **W1** and on-unchanged-page **D1 R0**, versus lowest-cost alternative. Report if extra bounded R cost unavoidable. For TEST/PRODUCTION compatibility, prepare a staged versioned *shared* curation revision/snapshot without writing real shared PROFILE_MEDIA, migrating data or accessing live users before explicit release approval. PRODUCTION old-code must not misinterpret the new key. Missing decisive ordering info => fail closed/report, not conditional hacks.
- **Before completion:** TypeScript, Build, existing `scripts/verify-307-explore-curation.mjs`, `scripts/verify-402-private-heart-count-pair.mjs`, strict app410 frozen like and cost contracts, new conflict/zero-D1-on-revisit tests, independent read-only audit per `DOCS/WORK_AUDIT_CHECKLIST.md`. Do not merge or deploy PR #200 until PASS.
- **Separate fatal Hosting gate:** app420 at `c0ac756c980bcea0ac2adb78841606d6f82370e1` remains independent FAIL. No Firebase/Worker deploy, shared R2/D1 data modification, main/test/production change now. See Issue #203.
- **Progress:** Stage416 25%; app speed 100%; curated 50% (not deployable).

---

## NEXT CODEX HIGH — fix real concurrent recommendation loss before PR #200 independent audit/deploy (2026-10-17 KST)

**Target:** draft PR #200 `fix/app421-curated-cross-device-revalidation` currently at `631132ea4faa1de47b36e9c426bd4b8f3dd7d873`. User asked to make A's promoted SORIDRAW recommendation visible to other users; this is a bounded recommendation-only repair, **not** a like-system rewrite. Full source evidence and implementation contract in [Issue #203](https://github.com/andrawing1212/soridraw-music/issues/203). Existing PR QA Run `38953913731` SUCCESS is partial and must not be used to justify deployment.

**P0 verified code issue:** `cloudflare/explore-worker/canonical/preview-entry.js` `writeCuratedSnapshot307` line ~528 reads existing curated R2 and unconditionally overwrites at line ~573. Two simultaneous curator actions both read the same snapshot and last put discards the other song. `syncCuratedPublicationResults307` also writes the same object at line ~648 without coordination. Canonical D1 already accepted both user actions; stale R2 may contradict the source permanently. Newly added success-vs-503 check alone is insufficient.

**Implementation/test instructions:**
1. Reproduce against actual Worker entry functions with controlled overlapping deferred promises: A promote song X, B promote song Y (both must survive); A promote and B remove same ID with unambiguous authoritative D1 ordering; curation vs targeted public/private visibility sync; duplicate idempotent retry; rejected/missing R2; legacy entry; cold R2 rebuild. Test no false 200 and no stale phantom member. Add focused tests to existing `scripts/verify-421-curated-cross-device.mjs`, not a pile of parallel patches.
2. Investigate Cloudflare **official conditional R2 writes** (`R2Bucket.put` with `onlyIf.etagMatches` returns `null` on conflict) and bounded compare-and-retry with canonical membership reconciliation. **CAS by itself is not sufficient for opposite-action order or publication races.** Preserve D1 as canonical and avoid full tracks/Feed rebuild. If an exact ordering invariant cannot be achieved with existing metadata, STOP and present smallest compatible extra ordering signal with writes/read costs; do not invent a success guarantee.
3. Environment contract: `curatedBucket307` prefers environment-local `EXPLORE_CACHE` over shared `PROFILE_MEDIA`. Shared `curated_picks` D1 writes therefore do not update TEST/PRODUCTION's existing local derived revision. Design a **versioned shared canonical curation revision/snapshot**, with environment-specific Edge caches where appropriate, and staged compatibility. Do NOT write real shared PROFILE_MEDIA or migrate shared data in this task. Document production old-code behavior during PREVIEW-only rollout and the explicit TEST/PRODUCTION promotion gate. Any unavoidable interim mismatch must be declared.
4. Protect existing app405/app410 likes, A/B account-neutral curated cache, 60s bounded revision check, ordinary unchanged entry D1 R0/W0, curation single canonical target W1 goal, no whole Feed scan, no new timer/listener/FCM, no UI/CSS changes or mass invalidation. Failure may return safe 503 but never false 200; bounded recovery.
5. Run TypeScript, Build, `verify-307-explore-curation.mjs`, `verify-402-private-heart-count-pair.mjs`, new deterministic overlapping tests, release/like regression and cost guards. Record actual CI run and exact HEAD; report changed files, bounded D1/R2 IO, edge cases and risks. Never self-certify independent audit PASS.

**Absolute release hold:** No merge/deploy/push to preview without reviewed PR; Codex may commit/push **the isolated PR head branch** if tests PASS. app420 net-zero retained-like independent audit remains FAIL. No Firebase Hosting/Worker/Functions/Rules/shared D1/R2 writes, no TEST/PRODUCTION. After implementation, Work independent exact-SHA audit per `DOCS/WORK_AUDIT_CHECKLIST.md` must PASS; guarded PREVIEW release only once app420 PASS as well.

---

## NEXT — independent audit curated PR #200 exact SHA and resolve cross-env data contract; app420 BLOCK maintained (2026-10-17 KST)

- **Pinned curated candidate:** PR #200 DRAFT `fix/app421-curated-cross-device-revalidation`, head `631132ea4faa1de47b36e9c426bd4b8f3dd7d873`, QA Run `38953913731` SUCCESS. Auditor READ-ONLY: code modification, merge, commit, push, deployment, shared D1/user/R2 mutation forbidden in audit room.
- **Test real code paths:** A curator PUT/DELETE with canonical D1 W1 (targeted) → selected/public R2 snapshot success or failure → B warm browser local revision check after 60s → revised body bypasses stale stable Edge, another POP → C first login → manager/public card parity; preserve app405/private like count overlay, no new data reads on unchanged repeated entry, test net-zero/unpublish and R2 missing/partial-public-detail failure returns 503 not 200. Worker success must prove the public snapshot actually includes promoted track; R2 PUT rejection must not claim success. Mutation concurrency/overlap needs explicit review.
- **Environment discrepancy:** source chooses `env.EXPLORE_CACHE || env.PROFILE_MEDIA` where PREVIEW local R2 cache is separate from TEST/PRODUCTION. Independently compare deployed Worker binding contracts and show a safe promotion plan that uses one shared curated canonical authority/revision without prematurely modifying real shared PROFILE_MEDIA. No TEST/PROD deployment until explicitly authorized.
- **app420 separate release blocker:** `c0ac756c980bcea0ac2adb78841606d6f82370e1` independent FAIL (public net-zero remains same count, retained private older count displayed). Do not deploy latest preview Firebase Hosting until a NEW independent app420 PASS. Do not introduce new like code into curated PR.
- **Release only after audits:** new pinned app420 PASS; curated PASS including server success semantics and cross-environment plan; PREVIEW exact Worker/Hosting release preflight; actual signed A→B cross-device and cross-account test; verify preview.soridraw.com exact version and unchanged TEST/PRODUCTION. No shared D1 migration/backfill or whole-cache rebuild.
- **Progress:** Stage416 1/4=25%; app speed 5/5=100%; curated code QA 2/4=50%, independent audit/live acceptance pending.

---

## NEXT — independent re-audit ONLY: app420 exact public-base provisional count guard (2026-10-17)

- **Audit exact product SHA:** `c0ac756c980bcea0ac2adb78841606d6f82370e1` / PR #198 (implementation head `4adec9c93cdef22e19bb21ec214690a22ad36cfd`). Quality Run `38944750283` SUCCESS. Live PREVIEW Hosting remains app419; do not deploy in audit room.
- **Prior audit contradiction to reproduce:** (A) existing/missed-public device already shows public 7 but retained accepted private row says base 5 -> provisional 6: result must keep count 7 while applying heart/membership. (B) fresh device before public release still shows public 5 and receives that same base-5 -> provisional-6 row: result must show count 6 immediately.
- **Read-only audit:** trace `basePublicLikeCount420` from local pending base -> canonical ACK row -> UID RTDB encoder/decoder -> persisted display lock -> React Feed/Profile/Liked repaint and liked-card cache. Confirm legacy app419 row without the optional field remains first-retained heart-only.
- **Required countercases:** ON then OFF/net-zero base chaining; duplicate/same-version retained replay; initial empty snapshot then genuine live row; newer local pending outranks older remote; delayed private row after published release; another account advances public count between actor acceptance and receiver repaint; 1/3/5/10/20min windows; stale reload/missed public signal; app410 frozen membership; no extra backend read/write/listener/poll/full scan.
- **PASS gate:** only after separate GPT-6/Work PASS may development room deploy **Firebase PREVIEW Hosting only** for app420 exact audited source and verify exact live app version/build plus real PC↔mobile same-UID acceptance. Worker/Functions/Rules/D1/R2/shared user data stay unchanged. TEST/PRODUCTION require separate user approval.
- **FAIL:** no deployment; report exact failing scenario and minimal code scope only, then new SHA/CI and re-audit.

---

## NEXT — third independent re-audit: app420 fresh-device retained signal repair (2026-10-16)

- **Audit exact product SHA:** `a63eb5f32ffb85c14f89ec493ad11e3546959a49` / PR #196. Quality Run `38903284828` SUCCESS. App version 420. Live PREVIEW remains previous app419; do not deploy in audit room.
- **Prior FAIL to reproduce:** new device has no local 396 public-settlement ledger, currently displays published count 7, public RTDB signal already expired, Firebase initial UID-private retained row says heart ON/private count 6. Required result: heart ON, count remains 7, no deferred private count lock. Then simulate a later genuinely live private callback and verify same-UID provisional +/-1 works immediately.
- **Audit READ-ONLY:** inspect actual `startLikeSignal127` first-snapshot classification, `applyRemoteLikeSignal127(... initialRetained420)`, local pending precedence, first empty snapshot behavior, duplicate/same-version retained app410 path, React `privateCountExact416=false` paint, public changed-card convergence, no extra backend IO. Include 1/3/5/10/20min windows and app419 optional timestamp compatibility.
- **PASS gate:** only after separate audit PASS may development room run PREVIEW Firebase Hosting-only app420 deployment and exact live version/build verification. Worker/Functions/Rules/D1/shared user data stay unchanged. TEST/PRODUCTION require separate approval.
- **FAIL:** no deployment; focused repair → new SHA → CI → independent audit again.

---

## NEXT — repeat EXTERNAL independent audit, corrected app420 exact SHA (2026-10-16)

- **Audit exact product SHA:** `9f304a726280c2630840431a04b6627ba51e1407`, merged PR #194; quality Run `38897965277` SUCCESS, app-version 420. Older SHA `3460c9d346295e3086875003a437add53a5c2ffc` was externally audited **FAIL** (late private count 6 overwrote settled public 7) and is forbidden for deployment.
- **READ-ONLY in separate audit room.** Verify the actual UID-private RTDB encoder/decoder carries *original Worker batch ACK time* `acceptedAtPublicClock420` without resetting it on delivery/retry/replay; public release uses server `row.at`. Trace service receive, actor lock, React remote paint, public repaint, and per-user already-settled ledger. Reproduce both published7→late-private6 stays7 and published7→genuinely-new-private6 stays6. Verify late same-device private ACK; concurrent two devices, rapid unlike/net-zero, old app419 signal compatibility, missing server timestamp fallback, ledger 25min bound, cached/reload/cross-account and all 1/3/5/10/20min windows, unchanged read/write costs and app410 frozen membership.
- **Release gate:** do not deploy, change code, commit, push, Rules, D1, Worker, shared data in audit room. If PASS, development room may use existing fixed Firebase PREVIEW Hosting workflow to ship exact app420 and verify live `preview.soridraw.com` version and PC/mobile. If FAIL, new focused repair, CI, SHA and independent re-audit first. main/TEST/PRODUCTION unchanged.

---

## NEXT — Independent audit app420 exact SHA, then gated PREVIEW Hosting release (2026-10-16)

- **Audit candidate:** 3460c9d346295e3086875003a437add53a5c2ffc, PR #192; quality Run 38886509436 SUCCESS, live Hosting remains app419.
- **Audit is READ-ONLY:** no code/commit/push/deploy. Review private ACK +1/-1, same-UID PC/mobile signal, frozen app410/413/141, stale-public signal with newer card date, actor overlay React list and private liked cache, simultaneous likes, net-zero, 1/3/5/10/20 min Master public windows, lost release vs 25min guard, mixed app419, no extra server reads/writes or shared data edits.
- **PASS only when separately audited:** then use fixed Firebase PREVIEW Hosting-only release workflow, exact tested source SHA, real preview.soridraw.com version/index checks; do not touch Worker/Functions/Rules/D1, main/TEST or PRODUCTION. User real-device acceptance separate.
- **FAIL:** focused code repair, new code SHA, new CI, new independent review before deployment.

---

## NEXT — Final independent review and gated PREVIEW app420 Hosting release (2026-10-16)

- **Fix SHA:** `463d0370e4fced1f0737ea03ecc5da01581df70f`, PR #190; original app420 PR #188 SHA `ce8650eb12445e8f00b015260242d211f9701d6f` is **superseded after audit FAIL**. Quality Run `38883990100` SUCCESS; no deploy yet.
- **Read-only independent audit required** under WORK_AUDIT_CHECKLIST.md, NOT the same implementation agent/chat. Validate verified ON +1/OFF -1, missing/stale membership, same-UID cross-device, deferred shared 1/3/5/10/20min, no-op `already-desired` 5 (not phantom6), duplicate and rapid ON↔OFF, older PUBLIC signal with newer R2 card cannot retire later actor, stale signal replay, 25min lock and lost notification fallback, mixed app419 readers, R0/W0 idle and O(1) mutations. Audit code and tests independently, not simply reuse CI PASS.
- **After exact SHA PASS:** PREVIEW Firebase Hosting-only trigger; target app420, ensure exact index build and `preview.soridraw.com`, TEST/PRODUCTION unchanged, RTDB Rules SKIPPED, no Worker/Functions/D1 user-data changes. Real signed-in PC and mobile same UID ON/OFF with 1min shared release required; retain status unverified until performed.
- **If audit FAIL:** no release, return to focused Codex fix on preview, new SHA/CI and re-audit. No user data transformations.

---

## NEXT — Independent exact-SHA audit ONLY: app420 actor heart±1 count before shared release (2026-10-16)

- **Audit product commit:** `ce8650eb12445e8f00b015260242d211f9701d6f`, PR #188 merged. Quality Run `38862904490` SUCCESS. This is PREVIEW **code** only, still **not deployed**. Current live Hosting app419. GitHub Issue #186.
- **Audit mode:** no code changes, commit/push, cache deletion, migration, shared D1 mutations or deployment during audit.
- **Review:** verified false/public5→ON heart+count6, true/public5→OFF heart+count4, verified false/public0→1, app413 unknown baseline no duplicate. 5s private ACK still old published count must NOT repaint actor. A→B and B→A same-UID via accepted 127 RTDB heart/count, persist-before-notify and no newer local outbox overwrite. ON→OFF net-zero, stale/duplicate signals, 1/3/5/10/20-min 448 windows, no early 90s guard expiry, public changed-card retires older private lock only. Historical first-like/app410 receiver protected.
- **Cost/data/environment:** client-only, no new D1/Firestore/RTDB read/write, idle/nav full refresh or per-card listener. Shared user schema and Worker/Function/Rules unchanged. Mixed app419 TEST/PRODUCTION readers remain compatible with existing personal signal shape. Long lived locked count on lost public notification: evaluate bounded 25min stale risk, R2 publication ordering and cross-account parity.
- **Expected verdict:** PASS/FAIL + exact SHA + required focused changes + whether safe to deploy PREVIEW only. CI PASS is not independently verified real device.
- **Only after PASS:** PREVIEW app420 Hosting exact source, check preview.soridraw.com, real PC↔mobile and same track other-account after 1min publication. TEST/PRODUCTION require distinct user approval.

---

## NEXT — Issue #186 app420: own Explore heart±1 count parity and same-UID PC↔mobile (2026-10-16)

- **Base:** preview `1a3994f263bb1f8f53b83e304152fe0a55a20f38`, app419 live. User-confirmed Master 1-minute save PASS and fixed public-window release PASS; **do not edit** public 448 window/Config Function/Worker/Master settings without a separate demonstrated need.
- **Task:** [Issue #186](https://github.com/andrawing1212/soridraw-music/issues/186), Codex High. Single versioned actor provisional count overlay from verified private membership to public release; 5-second canonical intake, app410 same-account signal, app413 ambiguous false membership protection, 191 changed-card public release unchanged.
- **Must fix:** verified ON +1 / OFF -1 on own device and same UID across PC and mobile, no 5-second private ACK rollback to old shared count, rapid ON↔OFF net-zero, concurrent/stale signals, old 90-second guard premature expiry with 3/5/10/20-min window, proper clearing at exact public release. Never add another canonical write or periodic full reads.
- **Mandatory executable E2E simulations:** 0→1, 5→6, 5→4, A→B/B→A, duplicate/older ACK, inflight opposite local click, cross-account shared count remains published until release, multiuser same-track, 1/3/5/10/20 min, stale reload/missing catalog. TypeScript/Build + protected app410/141/164/191/413/448 and cost regressions.
- **Do not deploy until exact-SHA independent audit PASS.** No shared user data/schema/Rules migration, Worker or Functions updates unless independently proven essential. Only PREVIEW code. No TEST/PRODUCTION change.
- **Progress:** this actor-count task **1/4·25%** (evidence+requirements; no code changes). Stage416 overall 1/4·25%; app speed 5/5·100%.

---

## NEXT — app419 Master public timing real-user save acceptance (2026-10-16)

- Product code commit `7691cca03afc6dc9846d1864b08cf6a7fb110ce7`, release commit `8531215b5b5a0508df8cac7468897616e57221aa`, quality Run `38857004280` SUCCESS, isolated Function Run `38857264207` SUCCESS+ACTIVE.
- Previous 1-minute Save failure and 5-minute reversion persisted even after get-only hydration. Updated writer keeps an RTDB value listener through the compare-and-set transaction and detaches on exit.
- Next exact acceptance: signed-in Master select 1min, press save, check success, leave/reenter and confirm 1min persists. If error recurs, inspect bounded sanitized call/HTTP status and actual policy version before any other write or blind redeploy.
- After save PASS, A→B same song personal hearts immediate and shared count updates without navigation on the 1-minute window; like→unlike net-zero; PC↔mobile and D1 cost check. Shared D1 schema/original user data, Worker, TEST/PROD remain unchanged; no TEST promotion until real-device PASS.

---

## NEXT — app419 Master public cadence save: PREVIEW real-account acceptance only

- **PREVIEW repair release:** product SHA `b710bd4692fbdf0b4b9444cb8988e3c20e86f7e7`; single Function release Run `38854999807` SUCCESS/ACTIVE; current pre-docs HEAD `81c56dff46b589cd6e1b12a85b5d4974f9a86c33`. Existing Hosting remains app419.
- **Why fixed:** live `masterSetLikeBatchTiming416` was already ACTIVE but returned HTTP 409 twice with shared tiny Master policy `version=1,publicMinutes=5`. Cold RTDB transaction null initially caused false optimistic revision rejection. Added one Master-only policy `get()` before the compare-and-set transaction; test proves v1→v2 save and stale reject.
- **User next:** log in as Master to `https://preview.soridraw.com/`, select 1 minute for public likes, click save, reopen setting and confirm 1 minute persists. Existing private setting is hidden, never change it from UI.
- **Follow-up acceptance:** PC ↔ mobile separate accounts on same public song, personal hearts immediate, shared public count updates once per fixed 1-minute window without tab navigation; like→unlike within one window does not change public count. Check D1 cost; unchanged warm revisit remains R0/W0 goal.
- **If FAIL:** collect sanitized Callable status and bounded server logs; do not blindly redeploy or mutate shared data. No TEST/PRODUCTION promotion until accepted.

---

## NEXT — app419 merged PREVIEW code: independent audit before any deploy

- **PREVIEW merge checkpoint:** `59f8721cf1915fefe2ae2628987831f0f58285aa`; product implementation SHA `caa27e8416c8ae25db4e1bc71ddf5f1b6cc3ef8b`; PR #168 merged; final quality Run `38849897278` SUCCESS.
- Audit that the Master UI exposes only **“모든 사용자 공개숫자 공동 집계”** and that hidden `privateMinutes` remains diagnostic/backend compatibility only, never normal app410/app418 personal-like timing.
- Audit stale-version recovery: one latest-settings re-read, preserve latest hidden private value, retry only intended `publicMinutes`, no page reload and no unrelated write.
- Audit `publicLikeWindowConfig448Candidate` `no-store`: one read per **new shared window**, never per user/page; an already-open window retains its original deadline.
- Protect app410 personal heart/membership, 191/frozen like regressions, D1 schema/canonical write path, Worker, shared data, TEST and PRODUCTION.
- **No deployment during audit.** Only if audit PASS and the user explicitly requests PREVIEW deployment: redeploy the config Function + Hosting required for this change, then run the 1-minute Account A → Account B automatic-update test without navigation.
---

## NEXT — app418 PREVIEW 1-minute real-device acceptance

- app418 is live on PREVIEW: Worker Run `38779499228` SUCCESS, Hosting Run `38779861310` SUCCESS, remote app version 418.
- Set Master public-like window to **1 minute** for acceptance.
- Same published song: Account A like, then Account B like within the same minute.
- Each account's own heart must change immediately. Public count must not increment per click; it should update once after the shared window closes.
- Verify PC ↔ mobile without page/tab navigation dependence.
- Net-zero check: like then unlike within one window must finish with no public-count change after release.
- Watch D1/Worker diagnostics for unexpected repeated reads/writes; unchanged page re-entry remains target R0/W0.
- PASS → app418 PREVIEW accepted. TEST promotion only on explicit user request. FAIL → capture exact account/device/timestamps and fix only the failing path.

---

## NEXT — app418 PR #160 exact-SHA re-audit after 075 preregistration repair

- **Audit SHA:** `ccaf2279250722cf0adf12dac974836357ac2a34`.
- **Evidence:** Quality Run `38777780859` SUCCESS; dedicated 448 markers for 075 preregister-before-D1, config fail-closed, zero-net public IO 0, and retry checkpoint all PASS.
- **Re-audit only:** inject 075 preregistration/config/storage failure and prove likes/cursor D1 mutation does not happen first; prove retry later processes the same track; recheck 069 path, net-zero, callback retry/idempotency, app410 protection, whole-feed scan 0, 446/migration 0.
- **PASS only:** merge PR #160 and deploy PREVIEW Worker + Hosting. TEST/PRODUCTION forbidden. No shared-data migration/backfill/delete.

---

## NEXT — app418 audit-fix exact SHA 독립 재감사만

- **감사 제품 SHA:** `41221206c2880472e2f39ec2f66fd49cbc9d407c`; DRAFT PR #160. Quality Run `38773426335` SUCCESS.
- **재감사 핵심:** ① 공동창 등록/설정 실패가 canonical D1 queue drain 전에 차단되어 공개 변경분 유실 0인지 ② Master 20분에서 config 오류 시 5분 fallback 없이 fail-closed인지 ③ like→unlike net-zero 창에서 R2 read/write·manifest·공개 알림 0인지 ④ D1 성공 후 R2/HTTP 실패 재시도가 checkpoint exact set을 재사용하고 중복 공개하지 않는지.
- **보호:** app410 개인 하트/PC↔모바일/127·191 회귀, whole Feed/profile scan 0, 446 table/journal/migration 0, TEST/PRODUCTION/shared schema 비변경.
- **비용 판정 요청:** changed-track `COUNT(l.user_uid)`가 좋아요 수에 비례하는 점을 실제 release blocker인지, 현행 cost 기준상 측정 필요 리스크인지 분리해서 명시 판정.
- **PASS only:** PR #160 merge → PREVIEW Worker exact audited source → Hosting app418 → preview.soridraw.com 확인 → 사용자 1분 공동창 실기기 다계정 테스트. FAIL이면 지적된 최소 범위만 재수정. 배포/공유데이터 변경은 감사 중 금지.

---

## NEXT — app418 exact-SHA independent audit before PREVIEW Worker/Hosting release

- **Audit product SHA:** `18005cc536842de2f15eaf8b91d64969499af628`.
- **Current preview HEAD / release infra:** `4a82a8f457cfe3afff8e3daf092d3606cb2c55af`.
- **Already PASS:** quality Run `38764154717`; PREVIEW config Function Run `38769147047` SUCCESS and ACTIVE.
- **Audit only, no edits/deploy/data mutation:** verify app410 personal likes unchanged; same-song A/B/C changes collapse into one common deadline; later clicks do not extend the deadline; next window aligns correctly; only changed track IDs are recounted/projected; retry/idempotency does not double-publish; no whole Feed/profile scan; no 446 table/journal/migration; shared canonical compatibility with TEST/PRODUCTION old readers/writers; public config failure fallback is safe; Worker/DO/R2/D1 cost remains bounded O(changed tracks).
- **PASS only:** deploy PREVIEW Worker exact app418 source, then PREVIEW Hosting app418, verify `preview.soridraw.com`, then user real-device same-song multi-account test at 1-minute setting.
- **STOP on FAIL:** return minimum fix scope only. Do not add another table, journal, timer layer, migration or unrelated optimization. TEST/PRODUCTION forbidden.

---

## NEXT — app418 shared public-like window PREVIEW release and real-device verification

- Exact candidate: `4ba9317e71fbdd137b84d94deb861944f7313711`, branch `fix/common-public-like-window-448`, PR #151.
- Finish only this goal: common public Explore counts update once per fixed admin-configured window; app410 personal heart/membership remains unchanged.
- Required order after final CI PASS: merge to `preview` → deploy PREVIEW config Function only → PREVIEW Worker exact commit → PREVIEW Hosting exact commit → verify preview.soridraw.com with 1/3/5/10/20-minute setting and same-track multi-user aggregation.
- No 446 migration/table/journal. No TEST/PRODUCTION. No unrelated cost optimization.

---

## NEXT — Stage416 446: DO NOT redevelop; unblock cross-env leak + D1 cost before any activation (2026-10-15 KST)

- DRAFT PR #147 already implements compensating Master hold. Target QA SHA `be4a0d2860f2ff8b405213fe3030f81a9635a144`, [CI SUCCESS 38740570418](https://github.com/andrawing1212/soridraw-music/actions/runs/38740570418). Follow its subsequent docs HEAD `d2b850d11fd7c6493792ad37a4e8a8a8275f6008`. Do not rerun Codex for same implementation until specific audit FAIL.
- Blockers: shared canonical raw count consumer in main/production Worker 191, W2 cost of additional journal INSERT+DELETE, independent exact SHA audit, additive D1 table migration permission and live environment parity. Preserve independent private/public 1/3/5/10/20 minute settings and frozen app410.
- STOP: PR DRAFT, preview code not changed, shared D1 migration and actual deploy forbidden until proven and approved.

---

## NEXT — Stage416 FAIL two-path exact repair only (2026-10-15 KST)

- **Status:** NOT DEPLOYABLE; independent auditor FAIL for `142667f24a70f6c8597c9dfe7250a4072a0d1860`. Earlier CI/preflight PASS DOES NOT authorize activation.
- **Executable negative tests:** [Run 38727425830](https://github.com/andrawing1212/soridraw-music/actions/runs/38727425830) in DRAFT PR #147, `scripts/verify-446-stage416-mixed-master-ordinary-public.mjs`: same-track Master unlike(-1)+ordinary like(+1) public visible should stay 11 until deadline, actual 10; ordinary 191 repair expected1 actual0.
- **Implementation task:** [Issue #148](https://github.com/andrawing1212/soridraw-music/issues/148); Codex High: exact per-track held signed delta excluded from ordinary public projection and selective ordinary 191 R2 recovery, idempotent retry/fail-closed. Only Stage416 Worker publication and tests; no app410/UI/Functions or shared original user data change.
- **Stop condition:** both executable checks, existing 191/440/444, TS/Build and costs PASS then **independent exact-SHA audit** before any PREVIEW activation. DRAFT PR #147 never merge while failing. Current 39 Functions and public activation HARD OFF intact.

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

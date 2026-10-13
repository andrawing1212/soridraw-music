## CURRENT — app416 사용자 실사용 PASS 처리 / 다음 작업은 5분 공동집계만 진행 (2026-10-13 KST)

- **사용자 판단:** app416 좋아요 실사용감은 현재 수준에서 PASS. 서버 확정 전 짧은 새로고침 과도구간은 원인 파악 완료 상태로 유지하고 추가 수정하지 않음.
- **다음 우선순위:** 기존에 진행하던 **좋아요 5분 공동집계(Stage416 5-minute server aggregation)**를 다시 최우선으로 복귀.
- **운영 UI:** 관리자/Master 앱 설정의 `좋아요 저장·공개 집계 주기` 및 Stage416 검증 패널을 그대로 기준으로 사용.
- **작업 방식:** 한 번에 여러 작업 병행 금지. 5분 공동집계 완료/검증 전 Worker 사용량 감사, 팔로우 비용 최적화, TEST 승격 등 후속 작업 시작 금지.
- **보호:** 현재 app416 실사용 좋아요 즉시 반영/PC↔모바일 동기화/5초 canonical fallback 경로는 정상 기준으로 동결. 정상 기능을 깨면서 5분 집계를 맞추지 않음.

---
## CURRENT — app416 PREVIEW 배포 완료 / 독립 감사 PASS / 실기기 검증 대기 (2026-10-13 KST)

- **독립 감사:** HEAD `d6bfdb02abeb2668cd3fb4f370f9321573f551d3`, 제품 코드 `5b4d50b58fc3072f5fd970a53367746d9cd68222` 기준 GPT-6 독립 재감사 **PASS**. 직전 app415 FAIL 원인인 reload-restored historical Stage416 row의 late `accepted` 권한 부활 경로 제거 확인.
- **배포 trigger commit:** `0c9a0c103769add0cf15567c91d8d2bce9f827c8`.
- **Firebase PREVIEW Hosting Run:** `38389032059` SUCCESS.
- **배포 검증:** TypeScript PASS, Build PASS, 기존 profile/My Likes/follow 회귀 PASS, dormant Stage420 보호 PASS, `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=416`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- **변경 없는 백엔드:** `SHARED_RTDB_RULES_DEPLOY=SKIPPED`. Worker/Functions/Rules/D1/R2/shared user data 변경 0. migration/backfill/delete 0.
- **배포 주소:** `https://preview.soridraw.com/`.
- **비용 구조:** app416 제품 수정은 로컬 상태 권한 판단만 변경. 업데이트/새로고침/재진입 신규 D1/Firestore/Worker data read/write 경로 0. warm revisit R0/W0 회귀검사 유지.
- **사용자 실사용 기확인:** 다른 사용자 공개 좋아요 숫자의 like/unlike 자동 반영은 페이지 이동·새로고침 없이 사용자 실테스트 PASS.
- **현재 남은 합격선:** app416 업데이트 직후 여러 곡 개인 하트 정확성, PC↔mobile 양방향 like/unlike 자동 수렴, 한쪽 refresh 후 유지, 5분 이상 시간경과 후 유지, Explore 재진입 후 유지.
- **TEST / PRODUCTION:** 변경 없음. 사용자 PREVIEW 실기기 PASS 전 TEST 승격 금지. PRODUCTION은 명확한 별도 승인 전 금지.

---
## CURRENT — app416 후보: reload-restored 416 late-accepted 권한 부활 차단 / 자동검증 PASS / 미배포 (2026-10-13 KST)

- **직전 독립 감사:** app415 `5c4d894856acbeea762af24d41db428afdb8c02c` FAIL. reload-restored historical 416 row는 기본 UI/My Likes 권한이 0이었지만, 동일 operationId의 뒤늦은 `accepted` transition이 오면 `markLiveIntent416`으로 격리가 해제되어 stale heart/count/My Likes가 다시 권한을 얻을 수 있는 예외 확인.
- **app416 최소 수정:** `src/services/exploreLikeIntent416.ts`의 late `accepted` branch에서 reload quarantine을 해제하지 않는다. accepted는 exact cleanup/settlement metadata로만 보존. `rejected`는 기존처럼 정리하며, **새로 도착한 실제 live `pending`**만 quarantine을 해제하고 provisional UI 권한을 다시 얻는다.
- **신규 실행형 회귀검사:** reload-restored old pending → same operation late accepted → heart authority 없음 / count detail 없음 / My Likes candidate 없음 / repaint 없음. 이후 newer live pending은 즉시 authority 회복.
- **소스 commit:** `5e5afdc707b1090dd93eb0a60f05dd7391275a70`.
- **감사 누락 케이스 test commit:** `d283549ff9402bca6d5b2181bcadb03862674f81`.
- **앱 버전:** app416 bump `5b4d50b58fc3072f5fd970a53367746d9cd68222`. 이 앱 버전 416은 내부 기능명 Stage416과 별개.
- **최종 Quality Run:** `38388071448` SUCCESS on `5b4d50b58fc3072f5fd970a53367746d9cd68222`. TypeScript PASS, app Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox quarantine PASS, app414 old-outbox UI quarantine PASS, app390/app141 ordering PASS, app197 warm revisit R0/W0 PASS, live shared RTDB Rules read-only/additive PASS.
- **app416 핵심 PASS:** `APP416_LATE_ACCEPTED_RELOAD_HINT_STAYS_QUARANTINED=PASS`; `APP415_RELOAD_RESTORED_HINT_HAS_NO_UI_OR_MYLIKES_AUTHORITY=PASS`; `APP415_POST_RELOAD_NEW_LIVE_HINT_STILL_FAST=PASS`; `STAGE416_RELOAD_NO_SERVER_WRITE_AND_EXPIRED_UID_SAFE=PASS`.
- **데이터/비용:** 새 D1/Firestore/Worker data read/write 0. cache reset 0, migration/backfill/delete 0, shared user data 변경 0. 기존 5초 canonical batch와 다른 사용자 공개 좋아요 자동 반영 경로 비변경.
- **사용자 실사용 사실:** 다른 사용자 공개 좋아요 like/unlike 자동 반영은 페이지 이동·새로고침 없이 사용자 실테스트 PASS.
- **현재 상태:** **GPT-6 독립 재감사 전 / PREVIEW app416 미배포**. Worker/Functions/Rules/D1/R2/shared user data/main/TEST/PRODUCTION 변경 0. `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.

---
## CURRENT — app415 후보: 업데이트/새로고침 복원 416 임시 하트의 권한 제거 / 자동검증 PASS / 미배포 (2026-10-13 KST)

- **직전 감사:** app414 `preview` HEAD `bc406a37490f7b0f7167dca244be5e4e58c8164d` 독립 감사 FAIL. app412 old-outbox UI quarantine은 유효하지만, 새로고침 후 localStorage에서 복원된 Stage416 임시 하트가 canonical 개인 좋아요보다 우선하거나 app410 retained repair를 막을 가능성이 남아 PREVIEW 배포 보류.
- **사용자 실기기 관찰:** 배포/업데이트 직후 하트가 불안정한 경우가 있으나 일정 시간 뒤 정상 수렴하는 패턴 확인. 반면 **다른 사용자 공개 좋아요 숫자 자동 반영은 실제 like/unlike 모두 페이지 이동·새로고침 없이 정상 PASS**.
- **app415 최소 수정:** `exploreLikeIntent416.ts`에서 reload 전용 localStorage 복원 row를 별도 추적. 복원 row는 삭제하지 않고 exact cleanup/reconciliation을 위해 보존하지만, `readExploreLikeIntent416`, detail/count overlay, My Likes candidate에서 권한 0. app410 same-version retained canonical repair도 더 이상 복원 hint 때문에 막히지 않음.
- **현재 세션 정상 기능 보호:** 새로고침 이후 **새로 들어온 실제 live 416 event**는 restored 표식을 해제하고 즉시 provisional authority를 다시 얻음. 이 기기의 fresh explicit click은 app412 marker가 있는 outbox가 최우선이라 기존 local-first 즉시 하트와 5초 canonical batch를 그대로 유지.
- **데이터/비용:** 캐시 전체 삭제 0, 사용자 데이터 삭제/변환/backfill 0, 새 D1/Firestore/Worker read/write 0. 업데이트 자체가 데이터 서버 읽기를 강제하지 않음. warm revisit R0/W0 유지.
- **app415 source:** `9b9c91c787f2ce9eb3c356f23e99e467e8ff805e`; browser-reload executable test fix `f5fc1e615ebdead04b9a503d9f19b0671507d981`; version 415 commit `0419139b0851e773d0b5ba4dd7f56e4e0f894ad8`.
- **최종 Quality Run:** `38386251533` SUCCESS on `0419139b0851e773d0b5ba4dd7f56e4e0f894ad8`. TypeScript PASS, Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox quarantine PASS, app414 old-outbox UI quarantine PASS, app390/app141 ordering PASS, app197 warm revisit R0/W0 PASS, live shared RTDB Rules read-only/additive PASS.
- **app415 신규 검증:** `APP415_RELOAD_RESTORED_HINT_HAS_NO_UI_OR_MYLIKES_AUTHORITY=PASS`, `APP415_POST_RELOAD_NEW_LIVE_HINT_STILL_FAST=PASS`, `STAGE416_RELOAD_NO_SERVER_WRITE_AND_EXPIRED_UID_SAFE=PASS`.
- **현재 상태:** **GPT-6 재감사 전 / PREVIEW 미배포**. Worker/Functions/Rules/D1/R2/shared user data/main/TEST/PRODUCTION 변경 0. 최종 자동검사 `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.

---
## CURRENT — app414 후보: 여러 곡 하트가 시간/새로고침 뒤 되돌아가는 공통 로컬 권한 오류 수정 / 미배포 (2026-10-13 KST)

- **사용자 실기기 범위 확대:** app413에서 특정 1곡만의 문제가 아니라 여러 Explore 곡의 개인 하트가 첫 PC↔모바일 동기화 직후에는 맞지만, 일정 시간이 지나거나 한쪽 새로고침 뒤 다시 빈 하트로 바뀌는 현상 확인.
- **app410 대비 코드 대조:** app410 사용자 실기기 PASS 이후 `exploreLikeIntent416.ts`는 변경 0. 현재 `exploreLikeService.ts`의 의미 있는 좋아요 변경은 app412 stale-outbox gate와 app413 count guard 중심.
- **확인된 공통 결함:** app412는 과거 app400~411의 `explicitReplayEligible412` 없는 outbox를 **서버 재전송에서는 격리**했지만, 개인 하트 membership, public count overlay, app410 retained repair blocker, accepted 127 signal blocker, exact personal baseline merge, visible hydration, My Likes candidate, 새 explicit click의 기존 pending 판단에서는 여전히 현재 pending처럼 사용했다.
- **영향:** 공유 D1 canonical relation/공개 count가 정상이어도 기기별 오래된 unmarked outbox가 서버 확정값보다 우선하여 빈/찬 하트를 다시 칠하거나, newer accepted same-account state가 로컬 캐시에 영구 반영되는 것을 막을 수 있다. 이 결함은 특정 곡 1개가 아니라 **과거 격리 row가 남은 곡들에 공통으로 발생 가능**하다.
- **app414 최소 수정:** historical unmarked outbox는 저장소에서 삭제/변환하지 않고 그대로 보존하되 `isExploreLikeActivePending414` / `readActiveLikeOutbox414`를 통해 **현재 명시 클릭(`explicitReplayEligible412=true`)만 UI/동기화 권한**으로 인정한다.
- **보호 범위:** fresh explicit click의 local-first 즉시 하트, 5초 canonical batch, app410 same-version retained repair, 416 same-account 빠른 힌트, My Likes, app413 exact count ACK는 유지. Stage416 client flags는 OFF 유지.
- **데이터/비용:** shared user data 삭제·변환·backfill 0. historical outbox local 삭제 0. 페이지 진입/재진입 추가 Worker/D1/Firestore read/write 0. partial/new-device에서 격리 row가 더 이상 missing-ID 검증을 막지 않으므로 필요한 기존 bounded `/v1/me/likes?trackIds=...` 복구만 허용.
- **소스 commit:** `eb45091bed36960ae6ba4d5e06a5be4b88f70f2f`.
- **회귀검사 보호 commit:** `0f316384683add18d8b800072797640c56b5e8b4`; `verify-127-atomic-personal-like.mjs`에 unmarked row UI authority 0, retained canonical repair 비차단, fresh explicit pending 권한 보존 검사를 추가.
- **버전:** app414 bump commit `3fcff8f4762aae28bcb79357e893e7fd87452793`.
- **공식 좋아요 품질검증:** final candidate `73d70b916b9c5aa5b303b753f0c195f2fc059b2c`, Quality Run `38382577342` SUCCESS. TypeScript PASS, app Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox write quarantine PASS, app390/app141 ordering PASS, app197 warm re-entry R0/W0 PASS, live shared RTDB Rules read-only/additive preflight PASS.
- **app414 신규 검증:** `414_STALE_OUTBOX_UI_AUTHORITY_QUARANTINED=PASS`, `414_RETAINED_CANONICAL_REPAIR_NOT_BLOCKED=PASS`, `414_FRESH_EXPLICIT_CLICK_AUTHORITY_PRESERVED=PASS`, `414_QUARANTINED_OUTBOX_CANNOT_BLOCK_APP410_RETAINED_REPAIR=PASS`, `APP414_NEW_PUBLIC_TRACK_QUARANTINED_OUTBOX_NO_UI_AUTHORITY=PASS`.
- **검증 중 발견/정리:** app414 의미 변경으로 production helper 일부를 직접 실행하던 기존 verifier fixture가 old outbox를 전부 active pending으로 가정해 순차 실패했으며, 제품 코드 확대 없이 verifier만 새 explicit marker 의미에 맞춰 교정했다. 최종 Quality Run에서 전체 관련 회귀 PASS.
- **현재 상태:** 소스 수정 + 공식 자동검증 완료. **GPT-6 독립 감사 전 / PREVIEW 미배포**. TEST/PRODUCTION 변경 없음. `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.
- **중요:** 이번 수정은 코드상 확인된 공통 결함을 제거한다. 사용자의 시간경과/새로고침 증상을 이것 하나가 100% 전부 설명한다고 실기기 검증 전 확정하지 않는다. app414 배포 후에도 동일 증상이 남으면 다음 후보는 416 reload-restored provisional hint / snapshotPending guard 순서로 좁혀 검사한다.

---
## CURRENT — app413 PREVIEW: 같은 계정 공개 좋아요 1→2 유령 표시 수정 / Worker+Hosting 배포 PASS (2026-10-13 KST)

- **사용자 실기기 신고:** app412에서 `창문을 조금 열고(테스트)`가 empty heart + public count 1인 상태에서 같은 SORiDRAW 계정으로 heart를 1회 클릭하자 filled heart + count 2로 즉시 표시.
- **즉시 live read-only 판정:** Run `38363943947` SUCCESS. 클릭 후에도 canonical D1 `likes` relation=1, `track_stats.like_count=1`, owner-liked=1, q035/q066/q069=0. 즉 같은 계정 relation이 2개 생긴 것이 아니라 **클라이언트 표시만 2로 과대계산**.
- **정확 원인:** stale local membership이 `false`인데 public card count가 이미 1이면 `computeExploreLikeAction127(false,true,1)`이 optimistic count 2를 만든다. 현 legacy W1 `/v1/me/likes/batch` 응답의 `results`는 `legacy-queued` liked 상태만 갖고 exact `likeCount`가 없었고, exact 418 settlement ACK도 그 results를 그대로 반환. 클라이언트는 count 부재 시 `pending.optimisticLikeCount`(2)를 canonical-like display lock/changed-track signal에 재사용할 수 있었음.
- **app413 client 최소 수정:** 새 pure guard `stabilizeExploreLikeOptimisticCount413`. 기존 pending이 없는 첫 explicit click에서 local heart=false + desired=true + current public count>0이면 heart는 즉시 filled로 바꾸되 public count는 현재값을 유지. count=0 첫 like는 기존처럼 즉시 1. 정상 unlike/active pending coalescing은 기존 계산 유지.
- **app413 Worker 최소 수정:** exact 069 batch가 `atomic-drain-batch-418`로 실제 settle된 경우에만 `readExactSettledLikeCounts413`가 그 batch의 changed track IDs(max50)만 PK-bounded D1 SELECT하여 `track_stats.like_count`를 response result에 넣음. page/update/re-entry read 0, whole Feed/profile/account scan 0. count read 실패는 이미 settled된 mutation을 5xx/replay하지 않고 기존 successful ACK를 유지.
- **회귀/비용:** actual changed batch당 count 확인은 max50 changed IDs only. 일반 앱 업데이트/Explore 진입/재진입 추가 D1 read/write 0. D1 schema/migration/backfill/delete 없음. one-account-one-track canonical relation invariant 유지.
- **QA:** source commit `1fd2d6bcef74b78c1700f05e034e1c04f673f406`; verifier alignment `97755c27b8c301598d5b19b2f49d42ff30b4580a`. Quality Run `38364999508` SUCCESS: `413_STALE_EMPTY_HEART_NO_DOUBLE_PUBLIC_COUNT=PASS`, app410 retained repair, app412 stale-outbox quarantine, app390/app141, TypeScript/Build/Functions/Rules regressions PASS. Follow `38364999640` SUCCESS, Stage416 readonly `38364999626` SUCCESS, dormant Worker check `38364999516` SUCCESS.
- **Worker 배포:** 첫 Run `38365285519`은 실제 deploy 전 old verifier107에서 중단(서버 변경 0). verifier contract만 app413 의미로 교정 후 Run `38365460909` SUCCESS. PREVIEW Worker active version `a3635a75-7f94-4c68-add2-46e9abaa644d`; `413_EXACT_CHANGED_TRACK_COUNT_AFTER_SETTLEMENT=PASS`, Feed/Profile/Search smoke PASS, pending035=0/pending069=0, fixed cron clear PASS, TEST/PRODUCTION Workers unchanged PASS.
- **Hosting 배포:** trigger `471b9a5814a977375edcd444bd1ddaac8fcb7ee9`, Run `38365644196` SUCCESS. `PREVIEW_APP_VERSION=413`, `PREVIEW_EXACT_BUILD=PASS`, Firebase PREVIEW Hosting only. shared RTDB Rules SKIPPED, TEST/PRODUCTION unchanged PASS.
- **공유 사용자 데이터:** 변경/삭제/복구 작업 0. 기존 `창문을 조금 열고(테스트)` canonical SORiDRAW like relation 1건은 그대로 유지. app413은 double-display 방지이며 이 existing relation을 임의 삭제하지 않음.
- **사용자 기대값:** app413 업데이트 후 해당 곡은 canonical relation이 이미 1이므로 **filled heart + count 1**이 정상. 사용자가 현재 relation을 해제하려면 filled heart를 1회 unlike하여 empty + 0으로 수렴하는지 확인. 같은 계정에서 다시 2가 보이면 FAIL.
- **Stage416:** 일반 client OFF / Issue #118 HOLD. 이번 app413 incident fix와 분리.

---
## CURRENT — app412 PREVIEW: 과거 Explore 좋아요 outbox 자동 부활 차단 배포 PASS / 기존 잘못 저장된 1건은 보존 (2026-10-13 KST)

- **사용자 신고:** `창문을 조금 열고(테스트)` 카드가 사용자가 누른 적 없는데 공개 likeCount=1, 현재 기기 하트는 empty로 관측.
- **live read-only 사실 확인:** Run `38357167441` / 추가 trace `38357446485` SUCCESS. 정확한 public track 존재=1, canonical `likes` relation=1, `track_stats.like_count=1`. 관계 1건은 곡 owner `SORiDRAW(@soridraw)` 본인 계정. 해당 relation created_at `1791868582575` (2026-10-13 14:16:22 KST). q035/q066/q069 pending=0.
- **Stage416 배제 근거:** owner의 Stage416 persistent acceptance receipt는 version39 / accepted_at `1791864896089` (13:14:56 KST)로 사고 like relation보다 약 61분 앞서며, current legacy queues도 0. 이번 relation 생성 시각과 controlled v39 receipt는 동일 사건으로 보지 않는다.
- **원인:** app409 Auth-ready recovery와 hydration/pagehide/legacy canonical flush가 `retryCount=0` durable outbox를 과거 실험 row와 현재 명시적 클릭으로 구분하지 못했다. 오래된 pending row가 로그인/업데이트/재진입 뒤 자동 canonical batch에 포함될 수 있었음.
- **app412 최소 수정:** `ExploreLikePendingMutation.explicitReplayEligible412` local-only marker 추가. 이 marker는 `setExploreTrackLike`의 **새 명시적 사용자 클릭**에서만 `true`로 저장. Auth-ready recovery, 5초 scheduler, canonical batch selection, visible hydration scheduler, visibility/pagehide exit flush는 marker가 없는 historical app400~411 row를 canonical 서버로 보내지 않음.
- **데이터 보호:** historical unmarked outbox는 삭제/변환하지 않고 local-only quarantine. 사용자가 같은 곡을 다시 명시 클릭하면 새 operation row로 교체되면서 marker가 붙고 기존 정상 5초 canonical 정산/재시작 복구를 사용.
- **정상 기능 보호:** app410 same-version retained local repair, app399 canonical batch, like/unlike, PC↔mobile changed-track signal, app390 conflict/ACK ordering, Stage416 client OFF 모두 회귀 PASS.
- **검증:** Quality Run `38360197897` SUCCESS. `APP412_STALE_OUTBOX_AUTH_RECOVERY_WRITE0=PASS`, `APP412_STALE_OUTBOX_HYDRATION_EXIT_WRITE0=PASS`, `APP412_NEW_EXPLICIT_CLICK_REPLAY_ELIGIBLE=PASS`, `APP412_NO_LOCAL_OUTBOX_DELETION=PASS`, TypeScript/Build/Functions TS/live RTDB Rules read-only audit PASS. Follow Run `38359444129` SUCCESS, Stage416 readonly preflight `38359444123` SUCCESS.
- **PREVIEW 배포:** source/test candidate `5372170e1bef3ed3dc36a0afb8c2952cb8977a9e`; release trigger `8f947cc51d349cb35deac43e2c2bf16ca64534f2`; Firebase PREVIEW Run `38360420805` SUCCESS. `PREVIEW_APP_VERSION=412`, `PREVIEW_EXACT_BUILD=PASS`, Hosting only.
- **비변경:** Worker/Functions/D1/R2/shared RTDB Rules/shared user data/main/TEST/PRODUCTION 변경 0. release에서 shared RTDB Rules SKIPPED, TEST_PRODUCTION_UNCHANGED=PASS.
- **중요:** 이미 잘못 생성된 `창문을 조금 열고(테스트)`의 SORiDRAW canonical like relation 1건은 사용자 원본 데이터이므로 **자동 삭제하지 않았다**. app412 수정은 추가 phantom auto-replay 차단이며 기존 1건 삭제는 별도 명시 승인 필요.
- **실사용 상태:** app412 PC/모바일 업데이트 후 '아무 클릭 없이 새 phantom canonical like가 더 생기지 않음'은 사용자 실기기 검증 전. 기존 사고 곡 count=1은 의도적으로 그대로 남아 있으므로 이 숫자 자체를 app412 실패로 해석하지 않는다.

---
## CURRENT — Issue #118 global-version correction audit FAIL / lost-click blocker (2026-10-13 KST)

- Codex corrected branch `codex/stage416-global-version`, commit `1424204006072b0ffff78b34bb0fe4df96218688` 생성. 공식 Codex session은 `couldn't complete`로 종료했고 PR/CI 없음.
- correction은 shared `privateLikeGlobalVersion416/{uid}` sequencer를 추가해 cross-env monotonic version 충돌을 피하려 했고, synthetic interleaving verifier도 추가함.
- **독립 감사 FAIL:** global version allocation이 environment private-root acceptance보다 먼저 commit됨. env transaction이 `PRIOR_WINDOW_NEEDS_SEAL`/DEVICE_LIMIT/TRACK_LIMIT 등으로 pending 저장을 거절해도 global sequencer는 operation을 accepted처럼 기억할 수 있음.
- 같은 operation 재시도 시 `GLOBAL_DUPLICATE_CONFIRMED`가 먼저 반환되어 env pending write를 건너뛸 수 있어 실제 좋아요 intent 유실 위험.
- Issue #118에 lost-click blocker 교정 지시 완료. env acceptance가 실제 성립하기 전에는 global duplicate-confirmed/accepted receipt로 승격되지 않도록 bounded crash-safe protocol 필요.
- 기존 `142420...` 및 이전 A/B branch 모두 merge/deploy 금지.
- preview product code/functions/worker/D1/R2/Rules/Hosting, TEST, PRODUCTION, shared user data 변경 0. 일반 Stage416 client OFF 유지.

---
## CURRENT — Issue #118 Codex 산출물 2개 감사 / cross-env version collision로 merge BLOCKED (2026-10-13 KST)

- **Codex 공식 상태:** Issue #118 bot session은 `Codex couldn't complete this request`로 종료. Draft PR 없음.
- **남은 산출물:** A `codex/issue-118-stage416-env-isolation` / `e4d36ba87aee475889f7f0ebe67c73ded33ca20d` (current preview `2ea0e6f...` 기반), B `codex/stage416-env-isolation` / `47c639f8982a2c4d3f77738c45496db1e3d084c5` (이전 `a80b0e5...` 기반).
- **A 감사:** callable/task/root/timing/Worker endpoint는 환경 분리했지만 final receipt Function/final RTDB root가 PREVIEW 단일 identity로 남아 end-to-end isolation 불완전.
- **B 감사:** A보다 나아 final receipt Function + final RTDB root까지 PREVIEW/TEST/PRODUCTION별로 분리. 그러나 **critical version collision** 존재.
- **critical blocker:** 각 env private root가 독립 `version=1,2,...`를 생성하지만 shared D1 `explore_like_private_acceptance_416`는 `user_uid`별로 `excluded.version > current.version`만 허용하고 shared personal R2도 `privateLikeVersion416` monotonic version을 사용. 따라서 PREVIEW에서 이미 v39인 사용자의 TEST v1/PROD v1 settlement는 stale로 거부될 수 있음.
- **판정:** A/B 모두 merge/deploy 금지. Issue #118에 환경별 transient isolation은 유지하되 uid별 canonical settlement version은 세 환경 전체에서 strictly increasing이 되도록 교정 지시 완료. D1 schema/user data migration 없이 해결해야 함.
- **비변경:** preview product code/functions/worker/D1/R2/Rules/Hosting, TEST, PRODUCTION, shared user data 변경 0. 일반 Stage416 client flags OFF 유지.

---
## CURRENT — Stage416 release contract 감사 FAIL / environment-isolated transient backend 선행 필요 (2026-10-13 KST)

- **Issue #117 Codex 결과:** 공식 세션은 실패했지만 두 source branch가 남음: A `codex/issue-117-functions-promotion` / `9b1abe00c12a8412fa65a5b0960764dd51c78b8b`, B `codex/stage416-functions-promotion-contract` / `97859b162ac5a48fd3ff306991df39cad61fcbb4`.
- **독립 감사 판정:** 두 안 모두 merge 금지. A는 TEST/PRODUCTION 실제 Functions 승격 단계가 없고, B는 TEST deploy만 있으며 PRODUCTION deploy가 없음.
- **구조적 차단점:** 현재 `src/firebase.js`는 PREVIEW/TEST/PRODUCTION host 모두 Firebase project `soridraw-app-866a5`와 같은 `getFunctions(app,'us-central1')`를 사용하며 Stage416 client transport는 callable name `recordPrivateLike416` 고정. settle source도 single task target `stage416SettlePrivateWindowCandidate`이고 TEST/PRODUCTION용 별도 runtime identity가 없음. 같은 이름을 같은 Firebase project에 재배포하면 환경별 승격이 아니라 기존 shared Function 덮어쓰기.
- **Worker routing 위험:** settle runtime은 `SORIDRAW_PRIVATE_BATCH416_WORKER_URL` 미설정 시 PREVIEW Worker endpoint로 fallback. TEST/PRODUCTION 독립 Function identity 없이 release workflow만 추가하면 wrong-environment Worker routing 가능.
- **결론:** user canonical likes/D1는 계속 공유하되 Stage416 transient RTDB window/pending/sealed, timing config, callable/task runtime identity는 환경별로 additive 분리해야 함. 기존 PREVIEW controlled path는 호환 유지.
- **새 선행 작업:** Issue #118 `Stage416 environment-isolated transient backend prerequisite` 생성 및 Codex 요청. Release Controller #117 수정은 #118 완료/독립 감사 전 보류.
- **비변경:** 두 Codex branch 모두 preview에 merge 안 됨. 실제 Functions/Worker/D1/R2/Rules/Hosting/user data/TEST/PRODUCTION 변경 0. 일반 Stage416 client OFF 유지.

---
## CURRENT — Stage416 bounded WAITING retry PREVIEW 배포 PASS / activation 차단점 1개 남음 (2026-10-13 KST)

- **Codex source:** Issue #115 branch `codex/issue-115-bounded-prior-seal-retry`, commit `e0ec9c86e0634e588b74d8f265a088ec240bdc10`; PR #116로 `preview` merge commit `73e1ac8dbdb3c77794a60adc4fd2db99cc2cf46f`.
- **독립 QA:** Run `38348077284` SUCCESS. `STAGE416_WAITING_PRIOR_SEAL_SAME_TASK_BOUNDED_RETRY=PASS`, `STAGE416_WAITING_PRIOR_SEAL_PRESERVES_NEWER_WINDOW=PASS`, 기존 ACK/EMPTY/NOT_DUE/app410/frozen like, Functions TypeScript, app TypeScript, Build, RTDB Rules audit PASS.
- **동작 변경:** `WAITING_FOR_PRIOR_SEAL`은 더 이상 60초마다 새 Cloud Task를 만들지 않고 fail-closed하여 동일 Cloud Task의 기존 `maxAttempts=25`, `30~3600s` backoff를 사용. `NOT_DUE`의 exact later deadline +1s reschedule은 유지. newer window/pending은 실패 동안 변경하지 않음.
- **배포 Workflow 첫 시도:** Run `38348257733` FAIL, 실제 Function 배포 전 preflight에서 중단. 원인은 제품 오류가 아니라 workflow가 이전 source literal `result.reason==='NOT_DUE'?1_000:0`을 고정 검사하던 release guard drift. 서버 변경 0.
- **배포 guard 별도 수정:** commit `66362eac78e082135764af7219b414acd8a29604`에서 기존 workflow의 preflight를 새 의미에 맞게 강화: WAITING 분기+throw, NOT_DUE 분기+1s deadline을 각각 명시 확인. 제품 코드와 분리.
- **PREVIEW 단일 Function 배포:** trigger `60ba858ffbe1fcc69631ebc46d955d7685f638b9`, Run `38348348201` SUCCESS. `stage416SettlePrivateWindowCandidate` 한 Function만 교체. Hosting/Worker/D1/R2/RTDB Rules/recordPrivateLike416/shared user data/main/production 변경 없음.
- **사후 read-only:** trigger `ad1dcc342cb42e2dbea489369159bf780d2da28d`, Run `38348670497` SUCCESS. Function ACTIVE, Eventarc condition 0, Queue RUNNING, PREVIEW Worker↔shared D1 match, private acceptance YES, pending069 NO, D1 mutation 0, EMPTY last remains 03:11:40 UTC.
- **판정:** controlled E2E backend 4/4 PASS + WAITING 비용 안전성 PASS. 일반 Stage416 client는 여전히 OFF.
- **남은 activation 차단점:** 고정 TEST→PRODUCTION promotion workflow가 Firebase Functions를 release component로 포함하지 않아 PREVIEW에서 검증된 `recordPrivateLike416`/`stage416SettlePrivateWindowCandidate` exact artifact와 환경별 Worker endpoint/secret contract를 TEST/PRODUCTION으로 동일 승격할 수 없음. 이 release-system gap 해결 전 일반 activation/TEST 승격 금지.

---
## CURRENT — Stage416 WAITING_FOR_PRIOR_SEAL bounded retry source 완료 / 배포 없음 (2026-10-13 KST)

- **기준:** 최신 `preview` HEAD `26b7a63f98bdef691bae63e9bf8909d1f2d79ad7`의 Issue #115 한정 수정.
- **최소 수정:** `WAITING_FOR_PRIOR_SEAL`은 더 이상 60초 뒤 새 Cloud Task를 enqueue하거나 현재 invocation을 성공 종료하지 않는다. `416_WAITING_FOR_PRIOR_SEAL`로 fail-closed하여 동일 Task가 기존 `retryConfig.maxAttempts=25`와 30~3600초 backoff를 사용한다.
- **NOT_DUE 보호:** RTDB의 exact later deadline에 기존 +1초 cushion을 더한 새 task reschedule은 그대로 유지한다.
- **데이터 보호:** WAITING 실패 시 prior frozen seal, newer window, pending rows를 변경하지 않는다. prior ACK가 해소되면 동일 task retry가 보존된 newer window를 DELIVERED할 수 있고, 플랫폼 retry 소진 뒤에도 다음 authenticated click의 기존 expired-window repair 입력이 남는다.
- **비용/범위:** WAITING 1회당 신규 enqueue 0. 정상 페이지/업데이트/re-entry IO, Feed/profile scan, Worker/D1/R2/Rules/Hosting, shared user data, 일반 app410 좋아요 경로 변경 0. Stage416 일반 client flag는 OFF 유지.
- **릴리스 상태:** source/test/docs만 수정. PREVIEW 포함 Functions 배포 0, TEST/PRODUCTION 변경 0. 독립 감사와 별도 릴리스 판단 전 activation/승격 금지.

---
## CURRENT — Stage416 controlled E2E PASS / activation 독립 감사 FAIL (비용·승격 안전성) (2026-10-13 KST)

- **감사 대상:** `preview` HEAD 기준 controlled E2E PASS 뒤 제품 source `f2aa1dd88cd8cafe48be290423d2481fa50f4869` + 배포/진단 증거 `38344204076`, `38344369373`, `38346090880`. `WORK_AUDIT_CHECKLIST.md` 기준 코드 수정 없이 독립 검토.
- **기능 회귀:** Stage416 변경 diff는 `functions/src/exploreLikePrivateServerClick416.ts`, `functions/src/exploreLikePrivateSeal416.ts`와 관련 verifier에 한정. UI/Music Note/Library/Feed/profile 코드 변경 0. app411 일반 client는 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false` 유지.
- **controlled E2E:** live `accepted → window → Scheduler/Eventarc → due Task → Worker/D1 acceptance → final receipt → exact ACK` 4/4 PASS. stale EMPTY 및 ACK_STILL_PENDING 수정은 실제 서버에서 재발 0 확인.
- **AUDIT FAIL 1 — unbounded WAITING chain:** `dispatchPrivateWindowTask416`의 `WAITING_FOR_PRIOR_SEAL`은 60초 뒤 새 Cloud Task를 enqueue하고 현재 Task는 성공 종료. `PrivateWindowTask416`에는 attempt/age cap이 없고 새 scheduleTime마다 새 task id가 생성되므로 `retryConfig.maxAttempts=25`가 이 수동 chain 전체를 제한하지 못함. live 증거로 prior ACK 고착 중 version39 task가 03:46:54~04:14:56 매분 `RESCHEDULED`되어 28회 누적. 장기 장애 시 사용자 변경 없이 UID당 최대 1,440 Task/day 수준으로 계속 증가 가능하여 10만 사용자 비용 철학 위반.
- **AUDIT FAIL 2 — TEST/PRODUCTION Functions promotion gap:** 고정 `.github/workflows/soridraw-release-promotion.yml`은 주석/구성상 Firebase Functions/Rules를 release component로 배포하지 않음. Stage416 Function 패치는 PREVIEW 전용 `.github/workflows/stage416-preview-settle-one-function.yml`로만 배포됨. 따라서 일반 client activation을 TEST/PRODUCTION으로 승격할 exact Function artifact/env contract가 현재 고정 승격 경로에 없음. `stage416SettlePrivateWindowCandidate` source fallback endpoint도 PREVIEW Worker URL이므로 환경별 binding 검증 전 승격 불가.
- **비용 구조 중 PASS:** normal page/update/re-entry에는 Stage416 client OFF라 추가 IO 0. 실제 handoff는 changed tracks only; D1 acceptance는 one receipt + `ceil(changed/50)` queue rows(1 track=W2, 최대 256 tracks=7 intake rows)로 전체 Feed/전체 사용자 수와 무관한 bounded changed-item 구조. final canonical read도 exact changed IDs `WHERE id IN (...)`; whole Feed/profile scan 없음.
- **데이터 안전:** migration/backfill/delete/reset 없음. shared D1/R2/Rules/Hosting/main/production 비변경. final diagnostic read-only D1 write 0.
- **판정:** controlled backend proof는 PASS지만 **일반 Stage416 activation / TEST 승격은 FAIL**. 현재 app410/app411 사용자 경로는 OFF 유지하므로 현 사용자 기능에 신규 영향 없음.

---
## CURRENT — Stage416 controlled E2E live PASS / exact ACK 자연 재시도 성공 (2026-10-13 KST)

- **최종 read-only Run:** `38346090880` SUCCESS. ACK patch 배포 `38344369373` 이후 old Task의 자연 backoff 재시도가 실제 발생했고, 새 `416_SEAL_ACK_STILL_PENDING` 오류는 0. 마지막 ACK error는 배포 전 `03:58:21 UTC`.
- **old frozen seal 정리 증거:** `04:14:21` Settle HTTP204 직후 `04:14:28` final receipt Function HTTP200. 이전 500/error 재발 없이 exact frozen seal ACK가 새 코드에서 정리된 시간 흐름과 일치.
- **version39 final 정산 증거:** prior ACK 해소 뒤 `04:14:56` Settle HTTP204, `04:15:04` final receipt Function HTTP200. 그 이후 같은 window의 매분 reschedule가 더 이상 관측되지 않음.
- **stale EMPTY 회귀 없음:** EMPTY 마지막 시각은 계속 `03:11:40 UTC`; ACK patch 이후 신규 EMPTY 0.
- **canonical 상태:** `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, `STAGE416_PENDING_069_ANY=NO`, PREVIEW Worker↔shared D1 binding 정상. read-only audit D1 write 0.
- **controlled E2E 판정:** `accepted → RTDB window → Scheduler/Eventarc → due Task → Worker/D1 persistent acceptance → final receipt → exact RTDB seal ACK`를 한 controlled flow에서 실서버로 증명. **controlled E2E 4/4 PASS**.
- **보호 상태:** app410 frozen likes, app411 일반 사용자 Stage416 client OFF, Worker/D1/R2/Rules/Hosting/main/production 비변경. 공유 사용자 원본 변경/삭제/백필 없음.
- **릴리스 의미:** 이 PASS는 backend controlled gate의 성공이며 일반 사용자 5분 client path를 즉시 ON한다는 뜻은 아님. 다음 단계는 independent audit + 비용/회귀 기준 확인 후 activation 후보를 별도 설계.

---
## CURRENT — Stage416 exact frozen-seal ACK patch PREVIEW 배포 완료 / old Task backoff 재시도 대기 (2026-10-13 KST)

- **확정 live blocker:** version39 due 이후 stale EMPTY는 재발 0이었으나, old frozen seal ACK가 `416_SEAL_ACK_STILL_PENDING`으로 반복되어 version39 window가 WAITING_FOR_PRIOR_SEAL 계열 reschedule에 고착.
- **원인:** `acknowledgeUserPrivateSeal416`도 local RTDB transaction view에 exact seal이 없을 때 `undefined`로 abort하여 서버 conflict compare 전에 false가 될 수 있었음. 직후 exact `sealed` read에서는 동일 seal이 살아 있어 coordinator가 `416_SEAL_ACK_STILL_PENDING`을 던지는 live 증거와 일치.
- **최소 수정:** source `a3079e84...`에서 ACK mismatch를 same-value no-op transaction probe로 바꿔 server reconciliation 후 **동일 id+version일 때만** `sealed:null`. 첫 QA `38343993434` FAIL은 genuinely-aborted transaction의 기존 fallback을 예외로 바꾼 회귀. 최종 `f2aa1dd88cd8cafe48be290423d2481fa50f4869`에서 aborted transaction은 다시 `false`를 반환해 기존 exact read + bounded Task retry 안전장치 유지.
- **검증:** Quality Run `38344204076` SUCCESS. `STAGE416_STALE_ACK_TRANSACTION_RECONCILES_EXACT_SEAL_ONLY=PASS`, `STAGE416_SERVER_SEAL_ACK_RETRY_CANNOT_DROP_NEW_CLICK=PASS`, Functions/app TypeScript, Build, app410 frozen likes, RTDB live Rules audit PASS. 배포/공유데이터 변경 0.
- **PREVIEW 단일 Function 배포:** trigger `46e942247d1aee4d1395882b745199c162f4c1eb`, Run `38344369373` SUCCESS. `stage416SettlePrivateWindowCandidate`만 교체. `PREVIEW_ONE_APPROVED_FUNCTION_DEPLOY=PASS`, postflight PASS, main/production unchanged, Worker/D1/R2/Rules/Hosting/shared data 변경 0.
- **배포 후 read-only Run:** `38344713907` SUCCESS. 배포 완료 04:03:13 UTC 이후 04:03:55 / 04:04:55 Settle HTTP204가 있으나 새 `416_SEAL_ACK_STILL_PENDING` error는 아직 0. 기존 old Task의 마지막 500은 03:58:13 / safe error 03:58:21로 **배포 전**. 새 EMPTY도 03:11:40 이후 0. D1 private acceptance YES, pending069 NO.
- **현재 대기 이유:** old failed Task는 Cloud Tasks exponential backoff 중. 과거 간격 50s→68s→128s→247s→488s로 늘어 다음 old-task retry는 대략 04:14 UTC 전후 추정. 강제 Task 실행 금지; 자연 재시도에서 새 ACK 코드가 exact seal을 지우는지 확인.
- **사용자 조작:** 없음. 버튼/좋아요/새로고침 불필요.
- **판정:** ACK source/test/deploy는 PASS, live old-task retry proof는 **대기**. Stage416 전체 완료 선언 금지.

---
## CURRENT — version39 due 정산: EMPTY 재발 0 / D1 receipt 유지 / frozen seal ACK 고착으로 final FAIL (2026-10-13 KST)

- **due 후 read-only Run:** `38343738803` SUCCESS. version39 accepted 시각 03:41:54 UTC, Scheduler 03:41:55 HTTP200, 5분 due 이후 Settle 03:46:54부터 매분 HTTP204 reschedule 관측.
- **개선 확인:** 새 `EMPTY`는 03:11:40 이후 추가 0. 이전 stale EMPTY 문제는 이번 실증에서는 재발하지 않음.
- **canonical 전달:** shared D1 `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, pending069=NO 유지. final receipt Function HTTP200이 03:42:09, 03:42:50, 03:43:57, 03:46:05, 03:50:12에 관측됨.
- **현재 최초 차단점:** `stage416SettlePrivateWindowCandidate`가 `416_SEAL_ACK_STILL_PENDING`으로 03:42:12, 03:42:50, 03:43:58, 03:46:05, 03:50:13 총 5회 오류. version39 due Task는 prior frozen seal ACK 대기 때문에 03:46:54 이후 매분 reschedule되어 final settle 완료 못함.
- **판정:** RTDB stale EMPTY 수정은 실서버 PASS. Stage416 controlled E2E 전체는 **FAIL / ACK 단계 미완료**. 다음 수정 범위는 exact frozen seal ACK transaction 한 곳뿐이며, 사용자 추가 클릭/Task force-run/data reset 금지.
- **보호:** app410 frozen likes, app411 Hosting, Worker/D1/R2/Rules/shared user data/main/production 비변경. 진단 자체 D1 write 0.

---
## CURRENT — app411 controlled retry ACCEPTED / prior expired window D1 receipt 생성 / final ACK pending (2026-10-13 KST)

- **사용자 화면 실증:** same-operation controlled retry가 `ACCEPTED`, receipt valid, version 39, local outbox server registered complete로 전환. 이전 `PRIOR_WINDOW_NEEDS_SEAL` 반복에서 탈출.
- **즉시 read-only Run:** `38342979008` SUCCESS. recordPrivateLike416 03:41:51~54 UTC 요청, 새 Scheduler onCreate `03:41:55 HTTP200` 확인. `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, `PENDING_069_ANY=NO`, D1 mutation audit write 0.
- **prior expired window canonical 전달:** public accepted signal max `03:41:52.165 UTC`; final receipt Function 03:42:09 / 03:42:50 HTTP200. 즉 Worker/D1 persistent acceptance + final callback 경로가 실제 실서버에서 처음 확인됨.
- **남은 차단점:** Settle Task에서 `416_SEAL_ACK_STILL_PENDING` 발생, 03:41:52 / 03:42:42 HTTP500 bounded retry. 이는 exact durable receipt 이후 RTDB frozen seal ACK가 아직 정리되지 않았다는 의미. 데이터 삭제/강제 ACK/Task force-run 금지.
- **새 version 39 window:** Scheduler 생성 확인. privateMinutes 기본 5분 due 이후 new window Settle이 prior ACK 대기에서 벗어나 정상 DELIVERED되는지 확인 필요.
- **판정:** controlled E2E 즉시 접수/이전 창 canonical delivery는 PASS, 전체 final ACK는 아직 미완료. Stage416 전체 진행률은 1/4·25% 유지, controlled E2E 3/4·75% 유지.
- **보호:** app410 frozen likes / app399 canonical batch / app409 recovery / app410 retained repair / follow / My Likes / Studio heart / UI 변경 없음. Worker/D1/R2/Rules/Hosting/main/production 비변경.

---

## CURRENT — Stage416 RTDB transaction reconciliation PREVIEW dual-function 배포 완료 / same-operation 재실행 대기 (2026-10-13 KST)

- **사용자 실증 실패 기준:** app411 Master controlled proof의 same-operation 재시도는 최종 8회까지 `PRIOR_WINDOW_NEEDS_SEAL`, receipt 미확정, outbox 등록 대기. 재시도 직후 read-only Run `38340849113`에서 03:11:38 UTC Settle HTTP204 뒤 03:11:40 UTC `EMPTY`가 새로 확인됐고 shared D1 `explore_like_private_acceptance_416`=NO, pending069=NO.
- **원인 수정 방향:** Admin RTDB transaction callback이 local cache에서 시작한 뒤 `undefined`로 abort하면 서버 conflict compare 전에 판정이 끝날 수 있으며, `.get()`으로 cache를 데운 뒤 같은 transaction을 재호출하는 방식은 실서버에서 충분하지 않았음. 서버 상태를 바꾸지 않는 exact same-value transaction probe로 RTDB 자체 conflict reconciliation을 강제하되, **실제 stale gate 두 군데만** 적용: private click의 `PRIOR_WINDOW_NEEDS_SEAL`, settle의 `EMPTY`.
- **비용/기능 보호:** 정상 accepted click, duplicate/stale/limit abort, NOT_DUE, ACK 경로는 기존 의미와 상태변경 write 계약 유지. 일반 app410 좋아요 동결 경로 및 app411 Hosting/UI 변경 0. Worker/D1/R2/RTDB Rules/shared user data 변경 0.
- **구현/검증:** 초기 broad 후보 `547ff376...`과 축소 후보 `ea585cf...`는 각각 기존 W0 테스트가 범위를 과하게 잡았음을 발견하여 FAIL로 중단. 최종 코드/검사 기준 `59917f17072fd0ef970b836203aa2e8a882bbf17`. Quality Run `38341523036` **SUCCESS**: Stage416 stale reconciliation, Functions TypeScript, 앱 TypeScript, Build, app410 frozen likes, RTDB Rules audit PASS.
- **PREVIEW Function 배포:** settle 전용 trigger `b67ac85a02aae7fc6d340e09b32164dc28620299` / Run `38341722912` **SUCCESS**. private click 전용 trigger `9f0067e4c8c220a198f86cc2bf5a039f0c09a20d` / Run `38342074694` **SUCCESS**. 기존 Function 두 개만 교체, Hosting/Worker/D1/R2/Rules/main/production 변경 없음.
- **배포 후 read-only 기준선:** diagnostic trigger `019cd99c112dc8c2462e9285c76532cb4cbaf07b` / Run `38342504423` **SUCCESS**. Scheduler ACTIVE, Eventarc condition 0, Task Queue RUNNING, PREVIEW Worker shared-D1 binding match, 최근 새 Callable/Settle 요청 0, private acceptance NO, pending069 NO, D1 mutation 0.
- **다음 사용자 액션:** 현재 app411 Master 패널의 **같은 1회 검증 재시도**를 딱 1회 실행. 새 좋아요 클릭/새로고침/새 operation 생성 금지. 이번에는 기존 expired window가 Task에서 `EMPTY`로 빠지지 않고 seal→Worker/D1 receipt까지 진행한 뒤 같은 operation이 ACCEPTED되어 새 window를 생성해야 함.
- **PASS 게이트:** 동일 operation 시간창에서 PRIOR recovery → Settle DELIVERED → shared D1 persistent acceptance receipt YES → final callback/ACK → pending069 소진을 read-only로 확인해야 함. 실패 시 추가 반복 클릭 없이 즉시 중단하고 새 최초 단절점만 분석.
- **진행률:** Stage416 전체 **1/4·25%**, 앱 속도 **5/5·100%**, controlled E2E **3/4·75%**. 실서버 persistent receipt/final ACK 전 4/4 금지.

---

## CURRENT — app411 controlled click exposed Task stale-empty bug / settle fix PREVIEW deployed / same operation retry pending (2026-10-13 KST)

- **사용자 controlled click 실증:** 사용자 Master가 app411 `Stage416 서버 1회 검증` 실행. privacy-safe request timeline Run `38338306114`에서 `recordPrivateLike416` POST가 `02:39:58 → 02:40:00 → 02:40:06 → 02:40:16 UTC`에 4회 발생. 기존 bounded retry 2s/5s/10s 간격과 정확히 일치하여 같은 operation이 `PRIOR_WINDOW_NEEDS_SEAL` 분기를 반복한 것으로 해석 가능. 같은 구간 새 Scheduler onCreate는 0.
- **Task 실패 실증:** 같은 구간 settle Task HTTP204는 02:39:58 / 02:40:01, 결과는 EMPTY. 이 두 Task는 Callable repair가 만든 exact expired-window recovery와 시간상 일치. shared D1 Stage416 persistent acceptance receipt는 계속 NO, pending069 NO.
- **확정 원인:** `sealUserPrivateLikes416`도 RTDB transaction callback이 local cache에서 시작하는데, Task service local cache가 empty일 경우 `!value?.window → return undefined`로 transaction을 즉시 abort하고 서버 상태 비교 없이 `EMPTY`를 반환할 수 있었음. 따라서 Callable은 실제 expired window를 보고 repair Task를 만들지만 Task는 local empty cache만 보고 종료하는 반복이 가능.
- **source fix:** `a8465eff8d43dc0876ae933ceeb6e1e05c45f5f7` + test correction `545853592460d9c7c1b5c90047aa3adcdc12315f`. 오직 `disposition.reason==='EMPTY'`인 aborted seal에서만 `privateRef.get()`으로 authoritative RTDB state를 1회 refresh하고 동일 expectedWindowId/nowMs로 한 번 재판정. 정상 due seal은 extra authoritative read 0.
- **재현 테스트:** 첫 QA `38338587746` FAIL은 테스트가 이미 소비된 deviceSequence 1을 새 click처럼 재사용한 verifier 오류. 제품 fix는 유지. 캡처된 due server state를 그대로 써 Task stale-empty만 재현하도록 정정 후 Quality Run `38338706914` **SUCCESS**. `STAGE416_SETTLE_STALE_EMPTY_CACHE_REFRESH_DELIVERS_REAL_WINDOW=PASS`, `STAGE416_NORMAL_DUE_SETTLE_EXTRA_AUTHORITATIVE_READ=0`, Functions TypeScript/app TypeScript/Build/frozen like regressions/Rules audit PASS.
- **PREVIEW backend 배포:** single Function trigger `7cad1f74027512db0eb93cbd78dda777c5e38892`; Run `38338926688` **SUCCESS**. `stage416SettlePrivateWindowCandidate`만 source `54585359...`로 교체. `recordPrivateLike416`, app411 Hosting, Worker, D1/R2, RTDB Rules, shared user data 변경 0. main/production unchanged PASS.
- **현재 행동:** 사용자는 페이지/좋아요를 건드리지 말고 app411 Master 패널의 `같은 1회 검증 재시도`를 **1회만** 눌러 기존 operation/deviceSequence를 재사용. retry 성공 시 expired old window가 새 settle fix로 Worker/D1까지 전달된 뒤 동일 operation이 새 window로 ACCEPTED되어야 함.
- **진행률:** Stage416 전체 **1/4·25%**; 앱 속도 **5/5·100%**; 세부 작업 `Stage416 controlled E2E proof gate` **3/4·75%**. same-operation retry 이후 Scheduler→due Task→D1 persistent receipt→final ACK를 확인하기 전 4/4로 올리지 않음.

---

## CURRENT — app411 Master controlled Stage416 E2E gate PREVIEW 배포 / 실실행 1회 대기 (2026-10-13 KST)

- **일반 사용자 보호:** app410에서 사용자 실기기 PASS한 Explore 좋아요 동작은 그대로 유지. app411은 **Master 앱 설정 진단 UI/전용 service만 추가**했고 일반 Explore click/outbox/canonical app399 batch/app409 recovery/app410 retained repair 코드는 변경하지 않음. Stage416 일반 client flags 계속 OFF.
- **구현:** product `b6bec3174dd29d8ca4fd0d83977055f2f4d72b91` + one-track read 최적화 `4707a0ab32717eead72be43b0782c19309306e9c` + verifier 정정 `69416c86c209ce05b8e80de320b3cb788e9f1542`. 새 `src/services/stage416ControlledProof416.ts`와 기존 Master `Stage416LikeBatchMasterPanel`만 연결.
- **controlled gate 안전조건:** server-side `masterGetLikeBatchTiming416` 성공이 먼저 필요. 이 기기의 기존 canonical-liked 후보 1곡만 사용하고 `/v1/me/likes?trackIds=<exact one>`로 실제 `liked=true`를 **최대 1회 확인**. 같은 `liked=true`만 Stage416에 전송하므로 사용자 최종 선택/공개 count를 의도적으로 바꾸지 않는 no-op 목표. operation/device sequence를 localStorage에 먼저 고정하고 재시도도 같은 operation만 사용. prior expired window는 기존 2s/5s/10s bounded retry helper 재사용. polling/whole scan/새 schema 없음.
- **QA:** 최초 `4707a0a...` Run `38336678399` FAIL은 verifier가 비용 최적화 전 destructuring 문자열을 찾던 검사 오류. 제품 순서는 실제로 Master→prepare→private callable이었음. verifier만 정정 후 Quality Run `38336802234` **SUCCESS**. `STAGE416_MASTER_CONTROLLED_E2E_ONE_OPERATION_GATE=PASS`, exact one-track canonical check PASS, general Explore path unchanged PASS, no new schema/polling PASS, Functions TypeScript/app TypeScript/Build/frozen like regressions/RTDB Rules audit PASS. Follow-only Run `38336581227` SUCCESS.
- **PREVIEW app411:** release trigger `f557c163ad1bae14c879fe69556674b0645377b1`; Hosting Run `38336992721` **SUCCESS**. `preview.soridraw.com` remote `app-version=411`, exact build PASS. shared RTDB Rules SKIPPED. Functions/Worker/D1/R2/shared data는 app411 Hosting 배포에서 변경 0. TEST/PRODUCTION unchanged PASS.
- **pre-click live baseline:** Readonly Run `38337210526` SUCCESS. `STAGE416_PRIVATE_ACCEPTANCE_ANY=NO`, `PENDING_069_ANY=NO`. 과거 24h Scheduler 2 / Settle 67 / logging-era EMPTY 65 상태 유지. 따라서 다음 persistent acceptance receipt가 생기면 app411 controlled operation과 시간상 분리 확인 가능.
- **비용:** 일반 업데이트/방문/페이지 이동 추가 server read/write 0. Master proof 실행 1회에만 Master 권한 확인 + exact membership 1곡 bounded read + 기존 Stage416 O(1) server path. 전체 liked list/feed/catalog scan 없음.
- **진행률:** Stage416 전체 **1/4·25%**; 앱 속도 **5/5·100%**; 세부 작업 `Stage416 controlled E2E proof gate` **3/4·75%**. 남은 1단계는 로그인된 Master가 app411 앱 설정에서 controlled proof를 1회 실행하고, due 이후 D1 receipt/final callback을 read-only로 확인하는 것.
- **사용자 실행 위치:** PREVIEW → 관리자 `앱 설정` → `좋아요 저장·공개 집계 주기` → 아래 `캐시 진단 표시` ON → `Stage416 서버 1회 검증`. raw UID/trackId/opId는 UI/로그에 표시하지 않음.

---

## CURRENT — app410 보호 유지 / Stage416 aborted RTDB stale-cache fix PREVIEW Callable 배포 완료 (2026-10-13 KST)

- **app410 보호:** 사용자 실기기 PASS 동결 유지. Hosting은 app410 / Run `38275509549` 그대로이며 좋아요 UI·canonical app399 batch·app409 startup recovery·app410 retained repair를 변경하지 않음. Stage416 client flags 계속 OFF.
- **24h 독립 감사:** Readonly Runs `38333348534`, `38333463196`, `38334163928` SUCCESS. 24h Cloud Run 기준 `recordPrivateLike416` 2122 requests, Scheduler 2 HTTP200, Settle 67 HTTP204. Eventarc transport topic/subscription 존재, subscription ERROR 0. Scheduler 안전 시각은 05:01:01 / 08:34:12 UTC. 현재 로깅 도입 뒤 Settle `EMPTY=65`, RESCHEDULED=0, STALE=0; EMPTY는 10:47:22~15:39:03 UTC에 집중. Shared D1 `explore_like_private_acceptance_416` receipt는 0, pending069도 0.
- **역사 해석 정정:** 67−65의 2건을 DELIVERED로 보지 않음. non-delivery 로그는 08:57 UTC 이후 추가됐고 두 초기 Task는 그 이전. 08:34 Scheduler→08:39 Settle 뒤에도 D1 receipt/final callback이 없었으므로 canonical 성공 증거가 아님. 08:55의 early deadline task-ID collision fix 이전 이력과 부합.
- **실제 단절 원인 판정:** `recordUserPrivateClick416`는 transaction callback에서 expired/duplicate 등 no-write 판단 시 `undefined`를 반환해 transaction을 즉시 abort. RTDB transaction callback은 SDK local cache에서 시작할 수 있으므로, 장기 Callable 인스턴스의 stale expired window를 서버 확정 상태로 오인해 `PRIOR_WINDOW_NEEDS_SEAL`→repair Task를 만들 수 있었고, Task의 실제 서버 state는 이미 window 없음→`EMPTY`가 될 수 있음. 과거 인스턴스의 local cache 자체는 소급 관찰 불가하지만, live 시간대/무삭제·동일 D1·동일 settle source 증거와 exact stale-cache 재현이 모두 이 메커니즘과 일치.
- **source fix:** `ddaa32e25146ba9a6867b8c1afd752f76c02747f`. 정상 committed click은 추가 read 0. **transaction이 abort된 예외 분기에서만** 같은 RTDB ref `.get()`으로 서버 snapshot을 1회 갱신하고 동일 `receivedAtMs`로 transaction을 한 번 재실행. 실제 expired server window면 기존 exact repair Task, stale local window면 false repair 없이 정상 click 수락. 무한 retry/poll 없음.
- **통합 검증:** source-only shared-state e2e `6bda4722...` 및 수정 QA Run `38334898118` SUCCESS. `STAGE416_EXPIRED_WINDOW_SHARED_STATE_REQUEUE_TO_DELIVERED=PASS`, `STAGE416_BLOCKED_CLICK_RETRY_AFTER_EXACT_ACK=PASS`, `STAGE416_STALE_ABORT_CACHE_REFRESH_PREVENTS_FALSE_EMPTY_REQUEUE=PASS`, `STAGE416_NORMAL_ACCEPTED_CLICK_EXTRA_AUTHORITATIVE_READ=0`; Functions TypeScript, app TypeScript/Build, frozen likes 모두 PASS. 공유 데이터/네트워크를 쓰는 테스트 아님.
- **PREVIEW backend 배포:** trigger `e4cf84b918519db255e5a5ccb037cdd680d4aeb3`; single Function Run `38335089397` SUCCESS. `recordPrivateLike416`만 source `ddaa32e2...`로 교체, postflight PASS. Worker/D1/R2/RTDB Rules/Hosting/shared user data 변경 0, TEST/PRODUCTION unchanged PASS.
- **비용:** 정상 accepted click 추가 authoritative read 0. aborted retry/expired/duplicate 같은 예외 판단에서만 RTDB server snapshot 1회. page entry/update/revisit로 발생하는 read/write 추가 없음.
- **진행률:** Stage416 전체 **1/4·25%**(새 코드의 실제 accepted→window→Task→Worker/D1 live E2E 아직 미증명); 앱 속도 **5/5·100%**; 세부 작업 `Stage416 서버 예약 경로 독립 검증` **4/4·100%**.
- **다음:** app410 user path를 켜지 않고 controlled E2E 증거를 만들 수 있는 최소 진단 게이트를 설계/검증. 실서버 accepted→window create→Eventarc/Task→Worker D1 persistent receipt→final callback을 한 operation 기준으로 증명하기 전 Stage416 client activation 금지.

---

## CURRENT — app410 사용자 실기기 PASS 동결 / Stage416 backend 독립검증 재개 (2026-10-13 KST)

- **사용자 확인:** app410의 마지막 단일 하트 drift 수정 실기기 **PASS**. PC/모바일 `골목길 탐험대` 상태 일치 확인. 이번 좋아요 복구 세부 작업 **4/4·100% 완료**.
- **새 좋아요 보호 기준:** `.agents/skills/local-first-like-sync/references/soridraw-app410-like-convergence-frozen.md`. Stage416 client 5분 path OFF, app399 canonical batch 복구, app409 pending Auth-ready recovery, app410 same-version retained local-only repair를 보호.
- **다음 작업:** 사용자 기능과 분리해 Stage416 backend만 독립 검증. client 재활성화/제품 좋아요 코드 수정 금지. 우선 과거 app400~407 활성 시간대의 Callable vs Scheduler/Eventarc/Task 기록을 **read-only 24h 범위**로 다시 대조하여 서버 단절 위치를 좁힌다.
- **현재 진행률:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 새 세부 작업 `Stage416 서버 예약 경로 독립 검증` 1/4·25%.
- **환경:** PREVIEW app410 유지. TEST/PRODUCTION 비변경. shared user data / Functions / Worker / D1 / RTDB Rules 변경 없음.

---

## CURRENT — app410 단일 retained 하트 drift 복구 PREVIEW 배포 / 실기기 확인 대기 (2026-10-12 16:12 UTC)

- **사용자 실기기 결과:** app409에서 대부분 정상화됐고, 정확히 `골목길 탐험대` 한 곡만 모바일은 filled heart + 1, PC는 empty heart + 1. 다른 곡은 정상. 공개 숫자 1은 양쪽 동일하므로 shared/public count 문제는 아니고 **PC의 개인 membership 한 row만 stale false**로 남은 문제로 확정.
- **원인:** `applyRemoteLikeSignal127`가 retained same-account RTDB signal에 대해 `signal.version <= lastSeen`이면 즉시 return. 기기가 이미 그 version watermark를 기록한 뒤 로컬 membership 한 row만 어긋난 경우, 서버 추가 조회 없이도 exact retained row가 다시 배달되지만 이를 재적용하지 않아 heart drift가 영구 잔류할 수 있었음.
- **app410 수정:** product commit `ffd49ca4a87344ac4aac9f2827198440d168cafd`. **오직 `signal.version === lastSeen`인 exact retained row**를 로컬 membership과 대조. outbox pending, unpublished signal retry, active 416 private intent, future 420 hint, opposite unresolved guard가 있으면 절대 덮지 않음. stale local membership만 수정하고 liked-card local index를 맞춤. 기존 personal-only repaint channel을 사용해 **heart만 다시 그림**.
- **비용/공개 숫자 보호:** app410 retained repair에는 `fetch`, Worker request, Callable, RTDB 추가 listener/write, D1/Firestore/R2 read/write가 없음. 기존 RTDB listener가 원래 받는 retained payload만 재사용. `privateCountExact416:false`로 shared/public likeCount를 덮지 않음. 전체 liked catalog/feed scan 없음.
- **검증:** Quality [38275331236](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331236) SUCCESS. `410_SAME_VERSION_RETAINED_HEART_REPAIR_LOCAL_ONLY=PASS`, `410_RETAINED_REPAIR_ZERO_SERVER_IO_AND_PUBLIC_COUNT_UNCHANGED=PASS`; TypeScript/Build/frozen likes PASS. Follow [38275331107](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331107) SUCCESS. Stage416 readonly preflight [38275331141](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331141) SUCCESS.
- **PREVIEW 배포:** trigger `eb533c91c5577a0215cf0242358da8bf91debad8`; Hosting Run [38275509549](https://github.com/andrawing1212/soridraw-music/actions/runs/38275509549) SUCCESS. `preview.soridraw.com` **app410 / exact build PASS**. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/shared user data 변경 0; TEST/PRODUCTION unchanged PASS.
- **다음 실기기 확인:** PC app410 업데이트 후 같은 `골목길 탐험대`를 **클릭하지 말고** 확인. retained exact row가 현재 signal에 남아 있으면 empty→filled로 자동 복구되어야 하며 숫자 1은 그대로 유지되어야 함. 다른 곡의 현재 정상 heart/count는 변하면 안 됨. 만약 여전히 empty라면 그 track은 현재 retained signal에 더 이상 포함되지 않은 것이므로 다음 수정은 전체 scan이 아니라 exact visible track의 기존 account-private revision/targeted canonical path만 사용.
- **진행률:** Stage416 1/4·25%(제품 client OFF); 앱 속도 5/5·100%; 이번 단일 하트 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 사용자 실기기 확인만 남음). TEST/PRODUCTION 승격 금지.

---

## CURRENT — app409 PC↔모바일 좋아요 초기 불일치 복구 PREVIEW 배포 / 실기기 확인 대기 (2026-10-12 15:58 UTC)

- **사용자 재현 결함:** app407 업데이트 직후 아무 클릭 전 같은 계정 PC/모바일 Explore 카드의 하트·숫자가 서로 달랐음. 예: 한 기기 1/filled, 다른 기기 0/empty. 이는 카드 숫자만의 문제가 아니라 개인 like membership/local catalog가 기기별로 갈린 상태.
- **원인:** app400~407에서 Stage416 5분 client path가 활성화되어 마지막으로 검증된 app399 `/v1/me/likes/batch` canonical 정산을 차단했으나, Stage416 final settlement는 Scheduler 0 / D1 acceptance NO 등으로 E2E 미입증. local outbox/즉시 hint만 남고 canonical accepted127 신호가 만들어지지 않는 경우 기기별 상태가 장기 잔류할 수 있었음.
- **app408 롤백:** product `ba86d7ed90957c6edee935ec909f99370cdb57a6`에서 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`; app399 canonical 5초 정산 복구. app401~407 안전장치/ordering/diagnostic은 유지. 기존 outbox 삭제·ID 재생성 없음.
- **app409 보강:** product `79113aa21ec0d6f9ff4ab083e9450bd6a32f9849`. Stage416 OFF 상태에서 Auth가 준비되면 **기존 durable outbox에 실제 pending user mutation(retryCount=0)이 있을 때만** 기존 `schedulePendingFlush`를 호출. Explore 카드 hydration을 기다리지 않고 오래된 app400~407 pending을 정산. empty outbox는 네트워크/서버 IO 0, ambiguous retryCount>0 자동 재전송 금지, Stage420 OFF 보호.
- **테스트 보강:** 기존 413 harness가 schedule 함수 아래 app409 Auth 블록까지 잘못 eval해 `onAuthStateChanged is not defined`로 첫 QA 실패(38273264491). 제품 import 문제 아님. verifier를 정확히 분리한 `14d8f0c9f98a8551cdfc6b8c30f07a3c7d9bd606`에서 별도 Auth mock으로 empty=0회 / pending=1회 검증.
- **자동검증:** Quality [38273565621](https://github.com/andrawing1212/soridraw-music/actions/runs/38273565621) SUCCESS. `APP409_AUTH_READY_EXISTING_PENDING_ONLY=PASS`, `APP409_STARTUP_EXISTING_PENDING_ONLY_NO_IDLE_IO=PASS`, app408 Stage416 OFF/legacy canonical 복구, TypeScript, Build, frozen like regressions PASS. Stage416 readonly preflight [38273264637](https://github.com/andrawing1212/soridraw-music/actions/runs/38273264637) SUCCESS. Follow check [38273264588](https://github.com/andrawing1212/soridraw-music/actions/runs/38273264588) SUCCESS.
- **PREVIEW:** release trigger `3193ea758088ada1e7033c6bd9d97aefb1e1bafd`; Hosting Run [38273830554](https://github.com/andrawing1212/soridraw-music/actions/runs/38273830554) SUCCESS. `preview.soridraw.com` **app409 / exact build PASS**. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/shared user data 변경 0; TEST/PRODUCTION unchanged PASS.
- **실기기 합격 조건:** PC/모바일 모두 app409 업데이트 후 아무 클릭 없이 동일 카드 하트/숫자가 자동 수렴하고, 이후 PC→모바일 / 모바일→PC like/unlike가 페이지 이동 없이 맞으며 새로고침 후 유지. 첫 정산 네트워크 왕복은 발생할 수 있으므로 app400~407의 오래된 pending이 있는 기기는 최초 몇 초 내 자동 수렴 여부까지 본다. 클릭/탭 이동을 수렴 트리거로 인정하지 않음.
- **진행률:** Stage416 전체 1/4·25%(제품 client OFF, backend additive ready); 앱 속도 5/5·100%; PC↔모바일 좋아요 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 실기기 PASS만 남음). TEST/PRODUCTION 승격 금지.

---

## CURRENT — app408 Stage416 클라이언트 롤백 / 검증된 좋아요 canonical 동기화 복구 PREVIEW 배포 (2026-10-12 15:49 UTC)

- **사용자 실사용 결함:** app407 업데이트 직후 아무 조작 전부터 같은 계정 PC/모바일의 Explore 하트·숫자가 서로 다르게 표시됨. 예: 같은 카드가 한 기기에서는 하트/1, 다른 기기에서는 빈하트/0. 카드 렌더는 개인 membership이 true면 공개 숫자를 최소 1로 맞추므로 단순 숫자 캐시가 아니라 **기기별 개인 좋아요 카탈로그/미정산 의도 불일치**가 핵심.
- **원인 확정 범위:** app400부터 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=true` + `STAGE416_SHARED_RTDB_BATCH_ACTIVE=true`가 기존 app399의 검증된 5초 `/v1/me/likes/batch` canonical 저장을 차단했다. 반면 Stage416 server final settlement는 Scheduler 0 / D1 acceptance NO 등으로 아직 E2E 미입증 상태였다. 즉 tentative same-account hint는 보일 수 있지만 canonical final이 막혀 업데이트/재접속한 기기가 각자 로컬 상태로 시작할 수 있는 위험이 실제 사용자 화면에서 재현됨.
- **app408 직접 수정:** 제품 commit `ba86d7ed90957c6edee935ec909f99370cdb57a6`. `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`. app401~407의 하트 보호·op ordering·진단 코드는 유지. 기존 durable outbox를 삭제/변환하지 않고 Stage420 OFF의 기존 eligibility 규칙으로 app399 canonical batch가 그대로 이어받게 함. 즉 기존 Stage416 미정산 rows도 새 ID 생성 없이 기존 operationId로 정상 정산 후보가 됨.
- **기존 즉시 동기화 보호:** `publishExploreLikeIntent416` same-account 즉시 hint는 유지. 차이는 **미완성 5분 서버 소유 final path만 OFF**, 검증된 canonical batch와 accepted 127 RTDB 신호를 다시 살린 것. 일반 페이지 진입 전체 scan/rebuild 추가 없음.
- **회귀검증:** 408 Quality [38272489224](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489224) SUCCESS. `APP408_PRIVATE_FIVE_MINUTE_ROLLBACK_OFF`, `STAGE416_CLIENT_OFF_LEGACY_CANONICAL_SYNC_RESTORED`, `EXISTING_STAGE416_OUTBOX_LEGACY_SETTLEMENT_ELIGIBLE`, `LEGACY_5SEC_CANONICAL_FLUSH_RESTORED` PASS. TypeScript, Build, Functions build, 127/175/180/178/191/192/197/390/417 등 frozen like 회귀 PASS. Follow-only check [38272489289](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489289) SUCCESS. Backend readonly preflight [38272489273](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489273) SUCCESS.
- **PREVIEW 배포:** release trigger `5186770e5528d9039431e54d2eb50ae0d4e16f85`; Hosting Run [38272717811](https://github.com/andrawing1212/soridraw-music/actions/runs/38272717811) SUCCESS. `preview.soridraw.com` **app408 / exact build PASS**. TypeScript/Build 및 profile/My Likes/follow 회귀 PASS. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/user data 변경 없음. TEST/PRODUCTION unchanged PASS.
- **다음 실기기 확인:** PC와 모바일 모두 app408로 갱신 후 **좋아요를 누르지 않은 상태로 Explore 첫 화면**의 동일 카드 하트/숫자가 수렴하는지 확인. 기존 Stage416 outbox가 있으면 app408의 복구된 canonical path가 그대로 정산한다. 그 다음 한 곡을 PC→모바일, 모바일→PC 각각 좋아요/해제하여 페이지 이동/새로고침 없이 수렴 확인. 불일치가 남으면 Stage416을 다시 켜지 말고 해당 기기의 outbox↔accepted127↔local catalog 단절만 좁혀 수정.
- **진행률:** Stage416 전체 1/4·25%(클라이언트 기능 일시 OFF, backend additive ready); 앱 속도 5/5·100%; 이번 PC↔모바일 좋아요 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 사용자 실기기 확인 대기). TEST/PRODUCTION 승격 금지.

---

## CURRENT — PREVIEW app407 로컬 서버접수 진단 직접 수정·배포 PASS / 단일 실사용 응답 대기 (2026-10-12 15:28 UTC)

- **사용자 지시 반영:** Codex로 넘기지 않고 ChatGPT가 직접 수정. 정상 app406 좋아요/해제·PC↔모바일·새로고침 동작은 변경하지 않고 Stage416의 기존 Callable 응답을 **기기 로컬에서만** 확인하는 기본 OFF 진단을 추가.
- **제품 source:** `c4fce678df9f5cbea6850d5a91dfcccd1b43b1fa` (`public/app-version.json` 406→407). 변경: `src/services/exploreLikePrivateDiagnostic416.ts` 신규, `exploreLikePrivateRtdbTransport416.ts`, `exploreLikeService.ts`, `Stage416LikeBatchMasterPanel.tsx`, `verify-416-client-rtdb-binding.mjs`, app version. 신규 진단은 기존 캐시 진단 ON + 해당 UID일 때만 sessionStorage에 동작하며 원본 UID/trackId/operationId는 저장하지 않고 operation은 8자리 opaque token만 표시. 새 fetch/Callable/RTDB/D1/Firestore IO 없음.
- **진단 의미:** 기존 `recordPrivateLike416`의 실제 브라우저 응답을 최초/복구 재접수별로 `서버 승인/거절·reason·receipt 유효성·version·로컬 outbox 서버등록 완료`로 표시한다. transport가 원래 보내던 Callable을 관찰만 하며, 추가 요청/폴링/자동 재시도는 만들지 않음. 기존 `recover416`과 operationId/deviceSequence 순서도 변경 없음.
- **자동검증:** 408 Quality [38269975727](https://github.com/andrawing1212/soridraw-music/actions/runs/38269975727) SUCCESS — 신규 `STAGE416_PRIVATE_ACCEPTANCE_LOCAL_DIAGNOSTIC_NO_SERVER_IO=PASS`, `NO_RAW_IDS=PASS`, Stage416 전체 source 회귀, Functions build, TypeScript, Build, 기존 127/175/180/178/191/192/197/390/417 좋아요 회귀 모두 PASS. Stage416 backend readonly preflight [38269975617](https://github.com/andrawing1212/soridraw-music/actions/runs/38269975617) SUCCESS.
- **PREVIEW 배포:** release trigger `c0e1366ea0067c42a15497e167d25d35f664088c`; Firebase PREVIEW Run [38270217668](https://github.com/andrawing1212/soridraw-music/actions/runs/38270217668) SUCCESS. `preview.soridraw.com` app407 / exact build PASS. TypeScript·Build 및 기존 profile/My Likes/follow 회귀 PASS. **SHARED_RTDB_RULES_DEPLOY=SKIPPED**, Hosting only. TEST/PRODUCTION unchanged PASS.
- **백엔드/데이터 비변경:** Functions 재배포 0, Cloudflare Worker 0, D1/R2 mutation 0, RTDB Rules 0, 공유 사용자 데이터/마이그레이션/백필/삭제 0. 이번 앱 업데이트 자체가 서버 데이터 read/write를 추가하지 않음.
- **다음 실사용 1건:** Master 계정에서 관리자 앱 설정의 **캐시 진단 표시 ON** → Explore에서 기존 공개곡 좋아요 또는 해제 1회 → 앱 설정의 “Stage416 서버 접수 진단” 확인. `서버 승인 + receipt 유효 + 서버 등록 완료`면 Callable→RTDB transaction 접수까지 증명되어 다음은 같은 시각의 server window/Eventarc만 read-only 확인. `CALLABLE_* / PRIOR_WINDOW_NEEDS_SEAL / STALE_OR_DUPLICATE` 등이면 그 최초 단절 단계만 수정. 원인 전 추가 재시도 엔진·UI 좋아요 수정 금지.
- **진행률:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 5분 서버 최종 정산 3/4·75%. app407 진단 구현/자동검증/PREVIEW 배포는 100%, **실제 한 클릭 서버 응답 및 5분 canonical E2E는 아직 미검증**. TEST/PRODUCTION 승격 금지.

---

## CURRENT — Stage416 Eventarc 전달 조건 추가 검사 PASS / 단절 구간 미확정 (2026-10-12 15:06 UTC)

- **기준:** PREVIEW app406 Hosting 사용자 정상확정 유지. 이번 readonly 진단 후 preview `e877e07ba166befd4ea0dad02d03cb4eb57aa443`을 기준으로 검사; 새 제품/Functions/Worker/Rules/공유 사용자 데이터 변경·배포 없음.
- **신규 GitHub 진단:** [Run 38267591402](https://github.com/andrawing1212/soridraw-music/actions/runs/38267591402) SUCCESS. 기존 `.github/workflows/stage416-preview-readonly-settlement-diagnostic.yml`에 Eventarc trigger describe 읽기 전용 단계만 추가(`af745549`), 기존 trigger로 실행(`e877e07b`). Scheduler Cloud Run 100분 entries=0. Settle 32 entries/HTTP204=14, non-delivery EMPTY=14, RESCHEDULED/STALE=0; Callable 최근 579 entries(HTTP200=239, HTTP204=97), accepted:true는 미검증. Cloudflare 416 D1 acceptance=NO, 069 pending=NO. 단일 indexed 공개곡 D1 likes row=1, stats=1, 공유 R2=1, D1 indexed read=2/write=0.
- **Eventarc의 정확한 해석:** ACTIVE·trigger resource·`ref.v1.created`·`privateLikeBatch416/{uid}/window`·`instance=*`·Pub/Sub transport metadata 확인. 그러나 trigger describe의 `conditions`는 **0개**였으므로 전달 성공/실패를 판정할 수 없다(`STAGE416_EVENTARC_EVENT_DELIVERY_PROVEN=NO`). Workflow SUCCESS는 설정 조회 및 다른 읽기 전용 검사 성공이지 개별 이벤트 delivery PASS가 아니다.
- **중요 정정 (이전 14:48 노트 일부 대체):** `src/services/exploreLikeService.ts` 하단 `recover416`이 **이미 존재**, 계정 로그인과 네트워크 재연결 시 동일 `operationId`/`deviceSequence` 재전송을 제한된 횟수·간격으로 시도한다. 따라서 "복구 경로 없다"는 종전 표현은 틀렸다. 다만 기존 온라인 연결에서 최초 Callable 실패 후 자동 재시도되는 시점과 성공 여부는 보장·실증되지 않았고, 이를 원인이라고 확정할 수 없다. 기존 `scripts/verify-416-client-rtdb-binding.mjs`, `verify-416-server-only-click.mjs`, `verify-416-private-task-routing.mjs`도 이 소스 계약을 검사하지만 실제 Firebase Eventarc 실전 전달은 대체할 수 없다.
- **다음 작업 고정:** 새 재시도 엔진 만들지 않는다. 한 Admin/Master 테스트 계정의 본인 실제 클릭 한 건에서 **원래 Callable `accepted,reason,version`** 과 정확한 하나의 server `window` create 여부를 privacy-safe / 기본 OFF 방식으로 연결 확인한다. accepted:true와 window create가 증명된 뒤 Eventarc/Task 단계로 분기하고, 첫 단절 구간만 최소 수정한다. 원본 데이터/전체 읽기/무단 Task 실행/Worker migration/제품 UI 수정 금지. Codex 구현→Work 독립 감사→PREVIEW 실기기 게이트를 보호한다.
- **진행률 변동 없음:** Stage416 1/4·25%; 앱 속도 개선 5/5·100%; 5분 서버 정산 3/4·75%(실 E2E FAIL/미입증). 신규 TypeScript/Build/제품 실기기 검사는 실시하지 않았으며 TEST/PRODUCTION 승격 금지.

---

## CURRENT — Stage416 서버 접수 재시도 공백 코드 확인 / 제품 수정 보류 (2026-10-12 14:48 UTC 이후)

- **읽기 전용 소스 감사 기준:** preview `817264e9da0963bffb0580c95d8784aef77547a9`; app406 사용자 실기기 모바일 해제/새로고침 PASS 동결. 추가 앱/Functions/Worker/Rules/D1/R2/사용자 데이터 변경 없음.
- **새 확인 사항(코드상 위험):** `src/services/exploreLikeService.ts`는 화면 즉시 동기화용 `publishExploreLikeIntent416`과 별도로 server-only `publishPrivateRtdbBatchClick416`을 클릭 시 비동기 호출한다. 단말의 `deviceId/deviceSequence`와 outbox는 호출 전에 로컬 보존하지만, 호출이 거절/예외로 종료되면 `console.warn`만 하고 해당 operation의 `privateServerRegistered416`은 false/미설정으로 남는다. 활성 416 플래그에서 `schedulePendingFlush`는 조기 종료한다. **후속 소스 정독으로 정정:** 파일 하단 `recover416`이 기존 동일 `operationId`·`deviceSequence`의 미등록 outbox 요청을 로그인 및 `online` 이벤트에서 최대 3회/세션·최소 60초 간격으로 재접수 시도한다. 즉 재접수 경로 자체는 이미 있다. 다만 최초 호출 거절 즉시 자동 재접수하거나 계속 열린 온라인 세션에서 반복 확인하는 구조가 아니므로, 해당 세션이 장시간 그대로 남는 경우 자동 수렴은 아직 입증되지 않았다. **이것도 실제 장애의 확정 원인이 아니다.**
- **기존 서버 증거 재확인:** read-only run `38262662237` / `38263043769`에서 Scheduler onCreate request 0, Callable HTTP200/204 다수(accepted:true 불명), Settle HTTP204/EMPTY 다수, Eventarc trigger ACTIVE 등록, D1 416 acceptance NO. 한 operation별 window 생성/예약/최종 저장의 증거가 여전히 필요하다. HTTP 성공은 논리 승인 증거가 아니다.
- **Codex 다음 좁은 작업:** (1) 한 Admin/Master 진단 계정의 사용자가 실제 클릭한 **한 operation**만, 브라우저가 이미 받은 Callable 반환 `accepted,reason,version`과 동일 outbox의 `privateServerRegistered416`을 로컬 기본 OFF로 구분하는 개인정보 비노출 진단(서버 추가 read/write 금지), (2) 소스/에뮬레이터 테스트로 accepted:true ⇔ 해당 UID 새 window create, Eventarc schedule, Task due/EMPTY 분기를 독립 검증, (3) 최초 단절 단계가 증명된 뒤에만 단일 지점 최소 수정. 성공 여부가 모호한 요청은 기존 operationId/deviceSequence의 중복/최종 receipt 없이 새 ID로 재시도하지 않는다. 로그인/페이지 진입 무조건 재전송·poll 금지.
- **보호/게이트:** app406 UI/캐시 복원, app160/164/402/404 및 팔로우·Studio 하트, 정상 방문 R0/W0, shared canonical 원본, Stage420 OFF, TEST/PRODUCTION 비변경 유지. 진단 결과 전 제품 배포 보류. Work 독립 감사 및 단일 클릭+5분 서버 D1/타계정 공개 숫자 실증 없이는 Stage416 최종 정산 PASS 불가.
- **진행률(검증기준 불변):** Stage416 전체 1/4·25%; 앱 속도 개선 5/5·100%; 최종 5분 서버 정산 3/4·75%(제품 E2E 미검증). 금번은 소스 및 기존 Actions 로그 재검토, TypeScript/Build/새 실기기 검증·배포 없음.

---

## CURRENT — app406 실사용 PASS 보호, Stage416 예약 생성 이벤트 불명확 / 기능 배포 보류 (2026-10-12 UTC)

- **사용자 정상확정:** 2026-10-12 14:09 UTC 모바일 좋아요 해제 후 새로고침 0 유지 PASS. app406 이 기능은 유지·수정 금지.
- **서버 재검사 38261359548:** 호출 Callable 수백 건 HTTP200/204, Task 최근 90~100분 EMPTY=21, signed shared D1 `explore_like_private_acceptance_416` existence NO, 069 pending NO, RTDB 공개 숫자 bus 마지막 2026-10-10. 단일 「골목길 탐험대」 shared D1 canonical like row=1, 집계=1.
- **로그 조회 누락 제거 38262662237:** 종전 서비스 통합 조회는 1200건 cap에 막혀 예약 생성 함수 로그를 단정할 수 없었음. 서비스별 독립 100분 조회: `stage416SchedulePrivateWindowCandidate` **로그 0건**, `stage416SettlePrivateWindowCandidate` 총 72 entries/HTTP204 33, `recordPrivateLike416` 600 entries(잘린 표본, HTTP200 247/204 101). 독립 예약 생성 0건은 중요한 단서지만 정확한 server accepted:true 부재로 원인 확정 불가.
- **Eventarc 설정 읽기 전용 38263043769:** schedule Function ACTIVE, 이벤트 `google.firebase.database.ref.v1.created`, 필터 `privateLikeBatch416/{uid}/window`, instance wildcard, triggerRegion us-central1, Eventarc trigger resource 존재. 해당 100분 scheduler request log 0건; Settle EMPTY=23, 416 D1 acceptance 여전히 NO. 설정이 등록돼 있다는 뜻이지 RTDB window 생성 이벤트의 실제 수신 PASS는 아님.
- **코드 구조 확인:** `src/services/exploreLikeService.ts`가 사용자 즉시 하트용 `publishExploreLikeIntent416`을 서버 `publishPrivateRtdbBatchClick416`과 독립 비동기로 실행하고 return. server-only Callable이 `accepted:true`를 증명해야 outbox의 `privateServerRegistered416` 설정. 거절/예외도 화면은 긍정적 상태를 유지할 수 있으며 해당 작업이 정상 canonical로 끝났다는 보장은 없음.
- **다음 단계:** 진단/테스트 계정 1건에 한해 기존 Callable 반환 `accepted,reason,version`을 개인정보 비노출·로컬 기본 OFF로 확인하도록 좁힌 뒤, (A) 클릭의 RTDB server window create 실패 / (B) Eventarc onCreate 수신 실패 / (C) due Task 실패 중 한 갈래를 증명. 원인 확인 전 좋아요 UI 재수정·공유 D1 like 원본 삭제·전체 스캔·Task 강제 재실행·Worker migration 금지. 배포 승인은 PREVIEW 검증 완료 코드에만; 이 진단은 제품 재배포 안 함.
- **검사/수정:** GitHub PREVIEW 읽기 전용 기존 Workflow/trigger 및 이 문서만 변경; 앱 Hosting app406, Functions, Worker, D1/R2/RTDB Rules, TEST/PRODUCTION 변경 없음. 416 서버 최종 정산 실사용 PASS 아님. 3중 진행률 Stage416 25%, 앱 속도 100%, 최종 5분 정산 75%(제품 미검증).

---

## Stage416 후속 점검 — app406 실사용 PASS 이후 최종 정산 증거 불합격 (2026-10-12 14:15 UTC)

- 사용자 app406 모바일 좋아요 해제+refresh PASS 확인 및 보호(직전 CURRENT). 같은 제품 release 406 유지.
- **신규 read-only 38261359548 SUCCESS:** Firebase Callable HTTP200/204 존재하지만 요청별 `accepted:true` 부재; 최근 90분 Task 결과 `EMPTY=21` / `RESCHEDULED=0` / `STALE=0`. canonical D1 416 acceptance ANY=NO, 069 pending=NO, 공개 버스 마지막 10/10. 「골목길 탐험대」 실제 likes=1, stats=1, shared R2=1 그대로. 새 서버 변경/배포 없음.
- **범위 확정:** 416 잠정 화면 신호와 서버 Callable 접수는 별도 비동기 동작이며, 클릭 화면이 정상이라는 사실만으로 서버 저장 성공을 뜻하지 않음. 단일 operation의 실제 가입/거절 이유를 추적하기 전에는 원인 미확정. 작업 지시는 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션. 사용자에게 반복 좋아요 테스트 요청 전 privacy-safe proof를 먼저 확보해야 함.
- **비용/안전:** 이번 점검 read-only, indexed single-song 조회 및 기존 간단한 queue 존재 확인만 사용. Firebase Hosting/Functions, Worker, 공유 데이터/Rules, TEST/PRODUCTION 미변경. app406 정상 복원 기능 건드리지 않음.
- **현재 진행률:** app406 모바일 PASS 100%; Stage416 전체 25%, 앱 속도 100%, 5분 서버 최종 정산 75%(E2E 미확정). 원인 추적은 계속, 제품 배포 전.

---

## CURRENT — app406 모바일 새로고침 좋아요 해제 사용자 실사용 PASS, Stage416 5분 서버 정산 별도 진행 (2026-10-12 KST)

- **사용자 2026-10-12 14:09 UTC 확인:** 「골목길 탐험대」의 PC 좋아요/해제→모바일 반영→**모바일 새로고침 시 빈 하트+0 유지**를 app406에서 정상 작동으로 확인. 이전 app405 모바일 reload 1 복귀 오류는 사용자 실기기 기준 PASS로 종료·보호한다. 더 이상 같은 UI/복원 경로 임의 수정 금지.
- **배포 고정:** PREVIEW app406 Hosting [Run 38259848293](https://github.com/andrawing1212/soridraw-music/actions/runs/38259848293) SUCCESS, source `82be614a2ee8bfbae0a1b8a77f900f2a1bf0ff9d`, QA [38259528489](https://github.com/andrawing1212/soridraw-music/actions/runs/38259528489) PASS, TEST/PRODUCTION unchanged. 사용자 확인은 모바일 reload 화면 회귀에 한정하며 5분 서버 최종 D1 정산 PASS를 의미하지 않는다.
- **다음 작업 승인/범위:** 사용자 요청에 따라 Stage416 최종 정산 조사로 전환. 동일 `operationId`의 Auth/AppCheck server `accepted` → private RTDB window → Cloud Task due → Worker 서명 전달 → 공유 D1 `explore_like_private_acceptance_416` 및 canonical like count → R2/pub bus를 작은 읽기 전용 증거로 확인. 기존 19 EMPTY는 전체 익명 Task 집계라 원인 추정 금지. 정확한 결함 확인 전 원본 데이터 수정/삭제/전체 백필/강제 재접수 금지. app406의 이미 정상인 모바일 복원 코드 보호.
- **진행률:** app406 모바일 reload PASS 100%. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 서버 최종 정산 3/4·75%(실사용 미입증). 새 서버 코드/배포 없음.

---

## CURRENT — PREVIEW app406 모바일 좋아요 해제 뒤 새로고침 숫자 1 복귀 경로 보정 배포 PASS / 실기기 QA 전 (2026-10-12 KST)

- **신규 사용자 재현:** 「골목길 탐험대」에서 좋아요 클릭은 PC+모바일 하트/수치 모두 1, 새로고침에도 정상; 좋아요 **해제 직후 둘 다 빈 하트+0**이나 **모바일 새로고침만 1**로 복귀. 사용자 새 재현 조건으로 app405 실사용 FAIL 지속. PC에서는 정상인 경우가 있음.
- **정확히 발견한 프론트 race:** `ExplorePage.tsx`의 `getSoridrawCuratedTracks307(false)` 효과는 `[profileUid,submittedQuery]`만 의존. 모바일에선 빠른 로컬 curated R2 캐시가 표시될 때 `auth.currentUser`/`user`가 아직 null이라 사용자 416 pending/outbox 카운트 overlay 없이 공유 canonical 1로 렌더됨. 이후 `onAuthStateChanged`가 user를 복원해도 curated 로더 효과가 재실행되지 않는 코드 경로. 모바일 화면 hidden→visible 재검증은 새 overlay 적용해 0으로 바뀔 수 있음. 이것은 재현과 일치하는 **검증 가능한 race 경로**이지 개별 모바일 런타임 trace까지 확인한 결과는 아님.
- **수정 app406:** `src/pages/ExplorePage.tsx`의 UID 변경 전용 효과가 `readCachedSoridrawCuratedTracks307()`로 **계정 중립 원본을 추가 서버 읽기 0으로 재사용**하고 `overlayExploreLikeDisplayCounts(user.uid, neutral406)`를 이미 표시된 curated 카드에 재적용. `src/services/exploreCurationService.ts`에 로컬 캐시 읽기 전용 동기 접근자 추가. 계정 전환 시 이전 계정 임시 숫자를 다음 계정에 전파하지 않도록 중립 원본에서 계산. 기존 React 카드 구조, UI, 사용자 데이터/실시간 클릭, Worker D1 정산 무변경.
- **변경 파일:** `src/pages/ExplorePage.tsx`, `src/services/exploreCurationService.ts`, `scripts/verify-402-private-heart-count-pair.mjs`, `public/app-version.json`(405→406). 기준 구현/테스트 `f2a5a72f62532250479ebf4a5479683dbfa35476`, exact 앱 source `82be614a2ee8bfbae0a1b8a77f900f2a1bf0ff9d`, Release trigger commit `1d47d6de2f2874f71e20a6d56c439fd736884c83`.
- **검사:** 408 [38259528489](https://github.com/andrawing1212/soridraw-music/actions/runs/38259528489) SUCCESS: TypeScript·Build, app406 늦은 UID restore source regression, 기존 app402/405 및 likes/follow 회귀, RTDB Rules read-only PASS. 신규 검사에서 UID-only 효과와 R2/D1 추가 fetch 0을 소스 단위로 확인. **PC·모바일 실제 체험 PASS 아님.**
- **PREVIEW 배포:** [Release Run 38259848293](https://github.com/andrawing1212/soridraw-music/actions/runs/38259848293) SUCCESS, `preview.soridraw.com` PREVIEW_APP_VERSION=406 / PREVIEW_EXACT_BUILD=PASS, Hosting only, SHARED_RTDB_RULES_DEPLOY=SKIPPED, TEST_PRODUCTION_UNCHANGED=PASS. Functions/Cloudflare Worker/D1/R2/사용자 원본/마이그레이션/백필/삭제 0.
- **남은 근본 문제:** 단일 곡 「골목길 탐험대」는 shared D1 indexed likes row 1건, stats=1, R2 card=1, curated=1 ([38256077221](https://github.com/andrawing1212/soridraw-music/actions/runs/38256077221)); 서버 원본과 shared count는 일치. 모바일의 임시 0이 실제 승인된 해제인지 미확인. Stage416 최근 90분 Task `EMPTY=19`, D1 acceptance 없음 ([38256513112](https://github.com/andrawing1212/soridraw-music/actions/runs/38256513112)). **최종 5분 저장 FAIL/미확정**, app406은 늦은 Auth 클라이언트 복원만 보완하므로 20분 넘은 provisional hint 만료나 canonical D1 미정산은 해결하지 않음. 절대 UI 임시 숫자를 D1 진실로 착각하거나 원본 like row 삭제/리셋 금지.
- **다음:** 사용자의 같은 계정 PC 좋아요→모바일 동기화→양쪽 새로고침, PC 해제→모바일 동기화→**모바일만 바로 새로고침** 실기기 확인. 이후 실제 단일 operationId(개인정보 마스킹) server accepted/window/Task→D1 final 진단 필수. TEST/PRODUCTION 변경 금지.
- **진행률:** Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 최종 정산 3/4·75%(사용자 실사용 FAIL). app406 클라이언트 보정의 구현+QA+PREVIEW 릴리스 PASS, 실기기 FAIL 여부 보류.

---

## CURRENT — 「골목길 탐험대」 D1 실값 1 확인, app405 새로고침 0/1 분기 및 Stage416 Task EMPTY 다수 (2026-10-12 KST)

- **사용자 추가 재현(사진/실사용):** 모바일 화면 껐다 켜면 빈 하트+0, 다시 새로고침 시 빈 하트+1 복귀; PC에서도 때로 0/1로 불일치. 같은 계정 PC·모바일 첫 좋아요/해제 실시간 일치는 PASS였으나 재진입·새로고침 이후 같은 곡만 수치 불일치 → **app405 제품 실사용 FAIL**. 이미 정상인 다른 곡과 임시 UI는 추가 수정 금지.
- **단일 곡 READ-ONLY 원본 증거:** [Run 38255681232](https://github.com/andrawing1212/soridraw-music/actions/runs/38255681232) SUCCESS: 공개 추천곡 「골목길 탐험대」 1곡 식별, curated R2 count=**1**, 공유 R2 changed-card count=**1**, 공유 D1 `track_stats.like_count`=**1**. [Run 38256077221](https://github.com/andrawing1212/soridraw-music/actions/runs/38256077221) SUCCESS: `likes WHERE track_id=?` indexed 확인, 실재 canonical like row **1건**과 track_stats **1** 일치, 해당 조회 D1 rows_read=2, rows_written=0. 아이디/좋아요 사용자/비공개 내역 출력 없음. **따라서 reload 시 1은 임의 숫자 생성이 아니라 서버에 영속된 1.** 현재 기기의 0은 개인 미정산 optimistic overlay일 수 있으며, 그 서버 row가 현재 테스트 계정인지 다른 계정인지 **미확인**. 빈 하트+1도 다른 계정이 좋아요했다면 정상 가능, 절대 0 강제 수정 또는 data reset 금지.
- **Stage416 정산 진단의 숨겨진 결함:** 이전 진단 Workflow `SETTLEMENT_TASK_NOT_DELIVERED\\s+`는 이중 이스케이프로 미전달 분류를 영원히 0으로 만드는 결함; 정규식 수정 commit `8218ad4b627d7efea9730b7e3c11a4d136333e7e`. [Run 38256513112](https://github.com/andrawing1212/soridraw-music/actions/runs/38256513112) SUCCESS: 최근 90분 익명 Task 미전달 로그 `EMPTY=19`, `RESCHEDULED=0`, `STALE=0`. Settle HTTP204는 19건이며 **19건 모두 처리할 Window 없음**. 해당 19건이 테스트 곡의 UID/window에서 왔다고 단정하면 안 됨. Callable HTTP200/204 다수이나 개별 클릭 `accepted:true` 증거는 없음. 416 D1 private acceptance=NO, 069 pending=NO, 공개 RTDB 좋아요 신호 마지막 갱신 10/10 UTC. Stage416 최종 정산 여전히 **FAIL/미확정**, 특히 클라이언트 즉시 개인 optimistic RTDB intent ≠ 서버 window accepted ≠ D1 canonical final.
- **진단 도구 신뢰성 수정:** 처음 원격 Worker 대용량 버전 소스/배포 API 응답이 4KB에서 잘못된 JSON을 반환하며 Run 38254588916/38255263970 실패. 이전 [Run 38243351165](https://github.com/andrawing1212/soridraw-music/actions/runs/38243351165)의 소스 활성화 PASS에 근거하고, 새 한 곡 검사는 Cloudflare **현재 DB binding만** 재확인하도록 대용량 API 조회 생략. 초기 제목 정확일치 0건은 제목 중 문자/공백 표시 차이였음; NFKC/공백정규화/부분 두 토큰 매칭으로 하나 정확 식별. 환경/사용자 데이터 변경 없음.
- **금번 변경:** PREVIEW GitHub 진단 Workflow 및 트리거만 수정·push (최신 product source app405 유지). Firebase Hosting/Functions/Worker/D1/R2/Rules/main/production 코드 및 원본 데이터 수정·배포·마이그레이션·삭제 **0**.
- **다음 작업 고정:** 더 이상의 숫자 UI 땜질/좋아요 강제 초기화 중단. 개인정보 비노출의 **같은 클릭 operationId 단위** PREVIEW 서버 접수 proof→UID/window pending seal→Cloud Task 결과→signed handoff D1→public bus를 좁혀 실제 빠진 구간을 확정한 뒤 한곳만 최소 수정. 공개 집계 숫자 1의 소유 회원 여부는 증명되지 않았으므로 개인 데이터를 스캔하거나 타인 계정 데이터를 추정하지 않음. 이후 TypeScript/Build/좋아요·팔로우 회귀, Worker/D1 비용, Work 독립 감사, PREVIEW 실기기; TEST/PRODUCTION 금지.
- **진행률:** 근본 원인 조사 3/4·75%(server count + queue-class 분류 완료 / 개인 operation 증거 미확보); Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 최종 정산 3/4·75%(제품 FAIL). 새 배포 없음.

---

## CURRENT — PREVIEW app405 추천곡 reload 숫자 복원 보정 배포 PASS / Stage416 서버 최종 정산 여전히 FAIL (2026-10-12 KST)

- **실사용 신고:** app404에서 같은 계정 PC↔모바일 하트 즉시 동기화/새로고침은 사용자 일부 곡 PASS 확인. 하지만 추천곡 `골목길 탐험대`에서 PC 해제 직후 0 → 모바일 새로고침 후 빈 하트+1 → 모바일 재좋아요 +2 → PC 새로고침 +2. 사진 3장 확보. 주의: 빈 하트+1은 **다른 계정의 1좋아요가 있을 때도 합법적인 표시**여서 사진만으로 canonical 원본이 부정확하다고 단정하거나 사용자 레코드 삭제 금지.
- **코드 원인 중 하나:** `src/pages/ExplorePage.tsx` curated 최초 로딩(`getSoridrawCuratedTracks307`), 관리자 curated 로딩, 앱 활동 재검증 경로에서 `setCuratedTracks307`에 공유 R2의 오래된 public likeCount를 그대로 저장하여 이미 수신·persist된 viewer-only 416 pending `optimisticLikeCount` overlay를 거치지 않음. 이후 재좋아요 시 이 숫자를 클릭의 기존 count로 사용해 UI +2가 나타날 수 있는 경로. 기존 `overlayExploreLikeDisplayCounts`를 세 curated 입구에만 적용(UID 범위, 본인 로컬 데이터 우선, shared R2/D1 write 0), 집계/캐시/서버 본문 변경 없음.
- **코드 및 검증:** `src/pages/ExplorePage.tsx`, `scripts/verify-402-private-heart-count-pair.mjs`, `public/app-version.json`(404→405). 코드+검사 최종 소스 commit `9537665929f2c1d6de0ea981966ea308c7a4cca0`. [408 Run 38244194395](https://github.com/andrawing1212/soridraw-music/actions/runs/38244194395) SUCCESS: app405 curated entry assertions, 기존 416 서버/클라이언트 좋아요, 팔로우 보호, TypeScript, Build, live Rules read-only PASS. 실기기 UX 및 Work 독립 감사 미검증.
- **배포:** app405 [PREVIEW Firebase Hosting Run 38244405202](https://github.com/andrawing1212/soridraw-music/actions/runs/38244405202) SUCCESS, `preview.soridraw.com` `PREVIEW_APP_VERSION=405`, exact index build PASS, TEST/PRODUCTION unchanged PASS, RTDB Rules skipped. Functions/Cloudflare Worker/D1/R2/사용자 원본/DB migration/backfill/delete 변경 0. 릴리스 트리거 `867cb22f7cf06bc18b79087aeb76c25e7215436d`.
- **서버 읽기 전용 진단:** [38242496215](https://github.com/andrawing1212/soridraw-music/actions/runs/38242496215), [38242959363](https://github.com/andrawing1212/soridraw-music/actions/runs/38242959363), [38243351165](https://github.com/andrawing1212/soridraw-music/actions/runs/38243351165) PASS. 11:25 UTC까지 Settle Function HTTP204 24건 관측, **Cloudflare D1 `explore_like_private_acceptance_416` 존재 NO**, pending 069 NO, RTDB `publicSync/exploreLike` 마지막 갱신 10/10 03:46 UTC. Non-delivery (RESCHEDULED/STALE/EMPTY) 안전 로그 패턴 0건이며 **HTTP204는 416 canonical 성공의 증거가 아님**. 실제 PREVIEW Worker 활성 트래픽 100%, 서명 route/handler on, Worker DB binding은 공유 D1 정확 일치 확인. 정확한 사용자의 등록 accepted/Cloud Task final 결과는 사용자 정보 없이 읽는 로그로 미확정. Function/Worker/D1 reset 및 전체 재처리 금지.
- **남은 리스크와 다음 한 작업:** app405 추천곡 reload 모바일↔PC 실사용 다시 검증. 5분 뒤 최종 Worker/D1 receipt와 다른 계정 공개 count 반영은 별도 근본 FAIL이며 앱 UI 보정으로 성공이라 판단하지 않음. 실패 시 정확한 단일 UID/window에서 서버 accepted→Task → canonical handoff 상태의 프라이버시 안전 증거를 확보한 뒤 수정. shared user data 강제 삭제·리셋 금지, TEST/PRODUCTION 승격 금지.
- **3중 진행률 유지:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 좋아요 5분 정산 3/4·75%(실사용 FAIL). app405 표시 경로 소스/QA/배포 PASS, 실사용 검증 전.

---

## CURRENT — PREVIEW app404 새로고침 후 개인 좋아요 이전값 복귀 수정 배포 SUCCESS / 실제 PC·모바일 검증 전 (2026-10-12 KST)

- **사용자 재현:** 같은 UID PC·모바일 간 실시간 좋아요·해제는 바르게 수신되지만 새로고침 시 이전 하트/숫자로 되돌아가는 app403 결함. 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」 사진 비교. 이 결함은 server 5분 정산 실사용 실패와 **별도**로 관리.
- **원인/수정:** `src/services/exploreLikeIntent416.ts` 수신 힌트는 이전에 모듈 메모리 전용, 재실행 첫 RTDB snapshot은 보안상 skip하므로 기존 canonical cache가 복귀. app404는 **실시간으로 실제 받은 동일 UID의 pending/accepted 잠정 변경만** 기기 localStorage에 UID-scoped 최대 50건·Master 최대 20분+30초 한도로 저장/복원. 무검증 cold RTDB 최초 snapshot replay는 계속 금지. rejected/정확한 accepted 또는 signed final receipt 시 같은 operationId overlay 제거, 계정 전환 시 삭제, 손상/만료/다른 계정 자료 무시. `exploreLikeService.ts`는 서버에 변화 없는 새로고침 시 viewer 전용 낙관적 하트-숫자 쌍만 복원. Canonical D1/R2/public cache 변경 없음.
- **코드:** `src/services/exploreLikeIntent416.ts`, `src/services/exploreLikeService.ts`, `scripts/verify-416-private-like-intent.mjs`, `.github/workflows/verify-408-like-repair-code.yml`, `public/app-version.json` (403→404). 구현 `3f86f10bd839f29312e547ed8d195c2bc0b2dae8`, QA 포함 `6428ab036ca097b5e7d77df13e4e1a859bd99833`, app404 버전 `d4a083b5155e396beb99f36d1752741ffee155ac`.
- **검사:** 408 Targeted Like Repair Quality [38240513420](https://github.com/andrawing1212/soridraw-music/actions/runs/38240513420) SUCCESS, **app404 exact** 408 QA [38240795296](https://github.com/andrawing1212/soridraw-music/actions/runs/38240795296) SUCCESS. Stage416 두 기기 시뮬레이션·동일 기기 refresh·거절·정확 최종 수신·다른 UID/손상/20m 만료·서버 추가 쓰기 0 재현 PASS. TypeScript, Build, 기존 좋아요/팔로우·Rules read-only PASS. 실제 브라우저 PC↔모바일 촬영 재검증 전.
- **PREVIEW 배포:** `preview` app404 Hosting only, 트리거 commit `5a6a0c52f467ac565d81ae25cd01c1187fa0b05a`, [Release Run 38241014684](https://github.com/andrawing1212/soridraw-music/actions/runs/38241014684) **SUCCESS**. `preview.soridraw.com` `PREVIEW_APP_VERSION=404`, exact `index.html` build SHA PASS, TEST/PRODUCTION Hosting 및 branch 비변경 PASS. RTDB Rules Deploy=SKIPPED, Firebase Functions/Cloudflare Worker/D1/R2/공유 원본 사용자 데이터 변경/마이그레이션/백필 0.
- **남은 위험:** 앱404는 **이미 그 기기에 수신된 잠정 상태**만 새로고침 때 보호하며, 다른 기기에서 앱을 꺼둔 동안 놓친 신호를 전계정 강제 동기화하지 않음. 임시 hint는 **canonical 확정이 아니므로** 만료 뒤 또는 서버 final 실패 시 다시 이전 값이 보일 수 있음. 앞선 5분 최종 D1 접수 미확인/공개 B 카운트 미반영은 별도 FAIL로 지속; 신뢰할 만한 실제 Task→D1→final 증거 전 Stage416 완료 판정 불가.
- **다음 한 작업:** 사용자 A계정/모바일↔PC에서 변경 직후 각자 refresh, 반대 클릭/다시 refresh, 마지막 클릭 +5분+30초 뒤 canonical·공개 B 숫자 확인. 실사용 FAIL이면 source 기록과 정확한 server receipt 확인 후 단일 단계 보완. 새 버전만으로 전체 Explore read/write 발생 금지. TEST/PRODUCTION 승격 금지.
- **진행률:** Stage416 1/4·25%, 앱 속도 5/5·100%(기존 합격 세부 작업), 개인 5분 정산 3/4·75%(실기기 FAIL 보류). app404 복원 소스+QA+Hosting 배포 PASS, 실기기 QA 전.

---

## CURRENT — app403 PC↔모바일 좋아요 실시간 일치 후 reload 회귀 재현/코드 원인 경로 확인 (2026-10-12 KST)

- **제품 FAIL:** 사용자 제공 모바일/PC 비교 화면에서 같은 계정의 실시간 좋아요/해제는 반영되지만 각 기기 새로고침 후 수신했던 최신 하트·잠정 숫자가 이전 캐시 상태로 돌아감. 예시 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」. 하트와 계정 내 잠정 숫자 0/1이 뒤바뀜. 5분 정산 및 reload 보존 정상 기능 보장 미달.
- **코드로 확인한 수신 복원 단절:** `src/services/exploreLikeIntent416.ts`은 remote intent를 `localIntentByUid416` 메모리에만 유지, cold reload 첫 `onValue` snapshot을 무조건 건너뜀, 반면 `seenVersion416`은 UID-scoped localStorage에 남김. `src/services/exploreLikeService.ts`은 수신 메모리 힌트가 없으면 기존 outbox/accepted/R2/cache로 fallback. `ExplorePage.tsx`는 active remote-intent 개인 잠정 하트·숫자 UI만 repaint하므로 reload 후 과거 값 표시는 소스상 충분히 설명됨. 이는 서버 D1 final 실패와 구분되는 별도 결함이며, 해당 곡의 정확한 최종 D1 저장/Task 실패 지점은 여전히 미확정.
- **안전 지침:** 첫 RTDB client-writable 임시 신호를 cold reload 때 무조건 재생하거나 60분 영구 canonical로 사용하는 단순 패치 금지. pending/operationId/version과 server-only `privateLikeFinal416` 증거를 구분하고 이전 opposite click/최종 ACK/기존 개인 캐시 보호. D1/Firestore 읽기·쓰기/전체 Feed scan/페이지 재진입 mutation 금지. 세부 Codex 작업은 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션 기준.
- **현재 실행 상태:** 코드 수정 0, commit은 상태문서 기록만, PREVIEW Hosting app403 및 이전 `recordPrivateLike416` 단일 Function 배포 유지. TEST/PRODUCTION 변경 없음, 실사용 PASS 아님. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 개인 좋아요 5분 3/4·75%.

---

## POSTDEPLOY READONLY — app403 Stage416 Callable 복구 배포 직후 기준 상태 (2026-10-12 10:43 UTC)

- 신규 코드 배포 [38237388824](https://github.com/andrawing1212/soridraw-music/actions/runs/38237388824) SUCCESS 이후 서버 익명 감사 [38238069865](https://github.com/andrawing1212/soridraw-music/actions/runs/38238069865) SUCCESS: `recordPrivateLike416`, Schedule, Settle 동일 runtime identity; Cloud Tasks queue RUNNING; Master private/public 각 5분. 새 클릭이 없는 시점의 공개 버스 마지막 갱신 2026-10-10 03:46:49 UTC, D1 416 acceptance / 069 pending 각 bounded SELECT 존재 NO, 검사 결과 D1 write 0.
- **의미:** 변경된 Callable 함수의 배포/운영계정/예약대기열은 정상이나 **이전 사용자의 미완료 좋아요가 자동 복구됐다는 뜻이 아님**. 다음 새 인증 클릭에서 기존 만료 서버 창을 발견하면 서버 복구 Task 생성 → 정확한 원본 클릭 재전송 → 5분 후 최종 정산을 실사용으로 추적해야 함. 이 시점에서 실사용 기능 FAIL/미검증이며 TEST 승격 보류.
- 세 진행률 변경 없음: Stage416 1/4·25%, 앱 속도 5/5·100%, 개인 5분 정산 3/4·75%. Preview app403, TEST/PRODUCTION 비변경.

---

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


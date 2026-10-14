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

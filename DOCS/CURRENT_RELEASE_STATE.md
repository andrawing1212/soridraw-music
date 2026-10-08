## 0S15. Stage411 사용자 정상보호: 오래된 R2 작성자 덮어쓰기 원인 확정 후보 / 제품 수정·배포 STOP (2026-10-09 KST)

- Stage410 Worker 191 복구 함수 원본과 기존 생산자 `patches/060-shared-profile-r2-parity.mjs`, `patches/062-shared-track-card-r2.mjs`를 연결해 검토. 두 기존 공유 R2 작성자의 `bucket.put`은 CAS `onlyIf`가 없어서 **191이 정확한 공개 카드/프로필을 복구한 직후 구형 복제본이 다시 덮어쓸 수 있음**. 191은 Feed가 이미 최신일 경우 해당 orphan을 다음 알람에서도 선택하지 못함. Stage410 전용 신규 결함이 아닌 기존 저장 경로 교차 경쟁. 
- 신규 read-only `scripts/verify-411-existing-r2-writers-restore-race.mjs`: 현재 실제 191 함수를 독립 격리 실행해 구형 profile PUT 후 Feed=1, card=1, profile=0; 재실행도 profile=0인 반례 검증. 이는 **재현 성공이지 안전성 PASS 아님**. 비용을 발생시키는 일반경로 R2 읽기 추가나 대규모 refactor 없이 원인을 고정하는 목적. 
- 제품 코드, 공유 사용자 원본, R2, D1, Firestore, RTDB Rules, Worker/Hosting/Functions, main/TEST/PRODUCTION 변경·배포 **0**. 기존 30초 W1 좋아요·팔로우·Music Note·Library·UI 보호. Stage410 TypeScript/Build/기존 회귀 17/17 PASS는 유지하나 **Stage411 release gate=BLOCKED**, 실제 PC/모바일·운영 비용 미검증. 069 push 진단 FAIL 별도.
- 다음 하나: 두 R2 작성자와 191 간 **발행 순서/비조건부 덮어쓰기의 최소 보호 계약**을 설계하고, 기존 쓰기에서 최신 좋아요 숫자를 거꾸로 돌리지 않으면서 정상 프로필/곡 발행을 유지할 수 있는지 전후 비교. 추가 R2 GET이 매 화면 진입마다 발생하거나 D1 W3+가 되면 FAIL. 충분히 증명 전 PREVIEW 배포 보류.

---

## 0S14. Stage410 CI 결과 — strict TypeScript/Build·회귀 PASS, 운영 게이트 유지 (2026-10-09 KST)

- 제품 코드 SHA `40c20516fc58ea35fe7e58b30e4843254380e2aa` 기준 [품질 Run 37837114180](https://github.com/andrawing1212/soridraw-music/actions/runs/37837114180) **SUCCESS**: Node22 entry 문법/TypeScript(`npm run lint`)/Vite Build, 127/175 엄격 개인 좋아요, 178/191/192/197/390 기존 좋아요·팔로우 보호 검사 모두 PASS.
- [격리 Run 37837114190](https://github.com/andrawing1212/soridraw-music/actions/runs/37837114190) **SUCCESS**: 실제 191 함수 + 로컬 Miniflare D1/모의 R2 CAS **17/17 PASS**, 신규 `CONCURRENT_NEW_DIRTY_ROW_DEFERS_FEED_COMMIT` 및 `CONCURRENT_NEW_DIRTY_ROW_REPAIRS_ON_REPLAY` PASS. 기존 398~406 격리검사 통과.
- 별도 `diagnose-069-live-like.yml` push [Run 37837112309](https://github.com/andrawing1212/soridraw-music/actions/runs/37837112309) **FAIL**, 기존 장기 문제 그대로. **전체 GitHub CI green 아님.** Live PREVIEW active Worker/parity·운영 D1/DO/RTDB 비용·PC↔모바일·구형 캐시·미해결 과거 orphan은 미검증/차단. PREVIEW/TEST/PRODUCTION 승격 보류.
- 검사만 실행; **Worker/Hosting/Functions/Rules/D1/R2/Firestore/사용자 데이터 배포·변경 0**. 다음은 Work 독립감사 및 실제 live read-only parity/비용 확인 후 안전한 PREVIEW Worker 릴리스 여부 결정.

---

## 0S13. Stage410 191 동시 Feed CAS 새 변경곡 누락 방지 — PREVIEW 코드·격리 재검증 대기 (2026-10-09 KST)

- 독립 감사에서 Stage409의 191이 **카드·프로필 먼저** 복구한 뒤 Feed CAS 재시도 중 *처음 복구 대상으로 선정하지 않았던 다른 곡*을 새로 발견해도 목록에만 정답 숫자를 적고 카드·프로필은 구형으로 남기는 회귀를 재현했다. 이전 기준 `bdcc0410aa50`은 같은 가상 시나리오에서 누락 없이 수렴했으며 Stage409는 두 번째 실행해도 카드가 구형으로 남았다.
- **Stage410 최소 수정:** `cloudflare/explore-worker/canonical/preview-entry.js` 191 Feed CAS 재시도 중 미선정 곡 불일치를 발견하면 해당 Feed 완료 PUT 전에 fail-closed하여 후속 DO alarm 재시도에서 기존 bounded 대상 검사·카드/프로필 선정착을 수행. `scripts/verify-407-exact-191-replay-recovery.mjs`에 새 곡 CAS 경합·재시도 회귀 2건 추가. 정상 Feed 추가 D1/R2 조회·기존 069/075 queue·30초 W1·팔로우·개인 좋아요·UI 변경 없음. 경쟁 발생 시 재시도 bounded R 비용 가능성은 실운영 미측정.
- 로컬 원본함수 격리 조건에서 발견→보류→재실행 전체 정합성 확인. **전체 TypeScript·Build·GitHub Miniflare CI/실제 active Worker parity·실운영 비용·PC↔모바일는 이 기록 시점 미검증.** 기존 Feed 최신/카드 구형 orphan과 069 진단 push 실패는 미해결. 추후 CI 결과 별도 확인 전 PASS나 배포 가능 판정 금지.
- GitHub `preview` 코드·검사·문서만 수정. **Cloudflare Worker / Firebase Hosting / Functions / Rules / 공유 D1·R2·Firestore / main·TEST·PRODUCTION 변경·배포 없음.** 다음 단계는 변경 commit SHA 고정, 자동 검사 상태 확인, 독립 감사 및 실제 비용·환경 검증. 릴리스 승격 금지.

---

## 0S12. Stage409 정상 구조 보존 + 127/175 엄격검사 정상화 + 실제 191 CAS 15/15 PASS (2026-10-09 KST)

- Stage408부터 유지 중인 제품 191 **카드/프로필→Feed 마지막** 복구 수정은 변경하지 않음. Stage409 추가한 것은 **역사적 127/175 정적 verifier 기대값을 현재 로컬 우선 정상 코드에 맞춰 정정**하고 CI에서 두 검사를 **필수 PASS로 재설정**, 실제 191 함수 격리 CAS 경쟁/연속 실패 케이스 추가뿐.
- [최신 품질 Run 37835339279](https://github.com/andrawing1212/soridraw-music/actions/runs/37835339279) **SUCCESS**: TypeScript·Build + 127/175/178/191/192/197/390 회귀 **모두 엄격 PASS**. [격리 Run 37835339341](https://github.com/andrawing1212/soridraw-music/actions/runs/37835339341) **SUCCESS**: 191 실제 함수 Miniflare + R2 가상 CAS 15/15 PASS, 경쟁 필드 보존/8회 실패 후 Feed 미완료·복구 대상 유지/정상 비용 경계.
- 여전히: 구형 R2 Feed 최신/카드만 구형 orphan, 라이브 Worker parity, PC↔모바일/타계정 실사용, 전역 비용 미검증. `diagnose-069-live-like.yml` push 자동 FAIL 별개 미해결. **Worker/Functions/Firebase/공유 D1/R2/Hosting/main/TEST/PRODUCTION 배포·데이터 변경 0**.
- 상세 `DOCS/LIKE_REPAIR_191_RELEASE_AUDIT_409_2026-10-09.md`; 다음 독립 audit·배포 전 원본 비용 확인, 정상 30초 좋아요 W1·팔로우/캐시/UI 보호. GitHub 문서·검사 외 제품 변경 없음.

---

## 0S11. Stage408 191 복구 함수 최소 코드 수정 / 실패 재시도 10/10 PASS, 배포 전 (2026-10-09 KST)

- **실제 제품 코드 최소 수정:** `cloudflare/explore-worker/canonical/preview-entry.js`의 `repairSharedPublicLikeCounts191`에서 이미 받아온 Feed R2로 변경곡을 선택하고 **공개 카드·프로필 먼저 → Feed 마지막** 순서. 카드/프로필 중간 PUT 실패 시 Feed를 먼저 성공으로 표시하지 않으므로 다음 DO alarm 복구에서 변경 ID가 남음. 069 W1/30초/개인 하트·팔로우·UI·캐시·원본 데이터 불변.
- [격리 Run 37833820477](https://github.com/andrawing1212/soridraw-music/actions/runs/37833820477) **SUCCESS**, 실제 191 함수 가상 R2 실패/복구 포함 10/10 PASS, 기존 Stage398~406 검사 유지. [품질 Run 37834477289](https://github.com/andrawing1212/soridraw-music/actions/runs/37834477289) **TypeScript/Build PASS**, 178/191/192/197/390 회귀 PASS.
- **릴리스 차단/미검증:** 역사적 `verify-127`(기대 문구 `deferredSignal390` 부재), `verify-175`(`gap repair flag missing`)은 현재 소스와 정적 테스트 불일치 FAIL — 진단에만 `continue-on-error` 사용, 절대 전체 PASS라고 해석하지 않음. 191도 기존에 Feed가 이미 최신·카드만 구형인 orphan은 자동 감지하지 못함. 실서비스 Worker parity·복합 CAS 경쟁·PC↔모바일·라이브 D1/R2/RTDB 비용/별도 069 진단 CI 실패 미확인.
- 상세 `DOCS/LIKE_REPAIR_191_FEED_LAST_FIX_408_2026-10-09.md`. **제품 Worker 코드 GitHub preview commit만 완료; Firebase/Cloudflare 배포 0, 공유 DB/R2 원본 변경 0, main/TEST/PRODUCTION 변경 0.**
- 다음: Stage408 소규모 수정의 Work/독립 감사, 실패된 127/175 verifier baseline 일치 검사, 실제 비용·실기기 호환 게이트 전 배포/승격 금지.

---

## 0S10. Stage407 원본 191 R2 부분실패 재시도 누락 재현 / 제품 원본 보호 (2026-10-09 KST)

- [GitHub CI 37832572556](https://github.com/andrawing1212/soridraw-music/actions/runs/37832572556) **SUCCESS**. `scripts/verify-407-exact-191-replay-recovery.mjs`로 현행 `repairSharedPublicLikeCounts191` **원본 함수 직접 실행**(LOCAL Miniflare D1 + 메모리 R2 ETag/CAS), 7/7 PASS. 이전 398~406 검증 유지.
- **찾은 실제 코드상 회복 공백:** Feed 최신/인기 숫자 저장 후 card/profile R2 put이 1회 실패하면 alarm 재시도 때 Feed는 이미 최신이어서 `changed` 맵이 비어 기존에 실패한 카드/프로필 수정을 건너뜀. Feed는 최신인데 카드만 구형인 경우도 191은 인지 못함. 이는 고장 **재현 PASS**, 제품 오류 수정 PASS가 아니다. 실제 live 환경 발현 여부/다른 복구 경로는 미확인.
- **Stage408 P0:** 정상 069 W1/30초·PC↔모바일·팔로우·191 비용 구조 보존하며 부분 실패 복구 순서/전달 근거 최소 변경 후보를 격리 검증. 대량 R2 GET/PUT 또는 새 D1 W 추가가 필요하면 비용 FAIL. 충분한 근거가 없으면 제품 코드 변경 금지.
- 근거 `DOCS/LIKE_REPAIR_191_PARTIAL_REPLAY_407_2026-10-09.md`. 제품 Worker/Functions/Rules/Hosting·공유 D1/R2/Firestore·계정 데이터·main/TEST/PRODUCTION 미변경/미배포. TS/Build/실기기 및 라이브 비용 미검증. 기존 069 진단 CI 실패 별도.

---

## 0S09A. Stage406 격리 비용 실측 PASS / 191 복구 삭제 STOP (2026-10-09 KST)

- [GitHub Run 37831877230](https://github.com/andrawing1212/soridraw-music/actions/runs/37831877230) **SUCCESS**, 격리 실제 D1 `rows_read`: 기존 191 SQL 1곡 R2, 40곡 R120, 80곡 R240, 전부 W0. **페이지 진입마다 읽는 것이 아니라 좋아요 묶음 정산 이후** 최대 80곡 공유 R2 상태 복구 경로. live 청구 아님.
- 191은 과거 서버 R2 투영 실패 후 정상 숫자 복구를 보호한다. 단순 no-op 또는 이번 곡만 확인하는 생략 후보는 이전 실패 상태 방치 위험을 재현했으므로 **기존 보호 기능 변경 금지**. Stage406 진단 스크립트/CI/문서만 변경.
- 근거 `DOCS/LIKE_REPAIR_191_READ_AUDIT_406_2026-10-09.md`. 다음은 읽기 전용으로 복구 부채/실제 발생빈도를 확인 후 **기존 시스템 대비 명확한 총비용 개선이 가능할 때만** 최소 코드 수정. 원본 D1/R2, Worker/Functions/Rules/Hosting, main/TEST/PRODUCTION 미변경·미배포. TS/Build·PC·모바일/실청구 미검증.

---

## 0S09. Stage406 기존 좋아요 안전 복구 read-path 집중 검사 (2026-10-09 KST)

- **보존 우선:** 신규 알림 구조 구현 중단. `ExploreLikeBatchScheduler103.runAggregate194` 후 `repairSharedPublicLikeCounts191`가 매 정산마다 실행되는 기존 소스 경로를 확인했다. 상위 최대 80곡의 D1 count 조회이지만 사용자 재진입마다 수행하는 코드 아님. 이전 R2 실패를 복구하는 역할이 있으므로 **성급히 제거/skip 금지**.
- 읽기만 계측하는 `scripts/verify-406-existing-repair-read-audit.mjs` 추가 + 기존 격리 Workflow 연결. 결과 `DOCS/LIKE_REPAIR_191_READ_AUDIT_406_2026-10-09.md`. 정상 기능·현재 Worker·공유 D1/RTDB/Rules/Functions/Hosting 변경 0. Run 결과는 해당 CI 참고.
- 다음은 191 복구를 해치지 않는 안전한 회피 조건/과거 실패 부채 표시가 원래 존재하는지 추가 확인. 없는 경우 기존 정상 기능 유지, Stage405 새 outbox 적용 금지. PC·모바일·실비용·TS/Build는 제품 코드 미수정 및 미검증.

---

## 0S08. 사용자 확정: 정상 구조 보존·병목 최소 최적화 우선 (2026-10-09 KST)

- 사용자 지시: 잘 설계된 정상 구조를 깨거나 재초기화하지 말고, **부족한 구간의 비용만 집중 개선하면서 정상 기능을 보존**할 것. 상세 `DOCS/PRESERVE_WORKING_SYSTEMS_406_2026-10-09.md`.
- Stage405 실험은 현재 제품 app382/Worker/공유 데이터 변경 **0**이며, 후보 알림 간 비교 `W+201→W+3`을 기존 앱 대비 비용 절감으로 해석하면 안 됨. 묶음 후보의 069 67곡 추가 `R+682`가 존재하므로 새 알림 구조를 무조건 이어서 도입하지 않는다.
- **다음 Stage406 판단 전** 현재 정상 기능 동결 → 문제 경로 특정 → 최소 diff 설계 → 기존 대비 원본 D1·DO·RTDB 총비용 및 좋아요/해제·PC↔모바일/팔로우 회귀 동등성 증명. 개선 증거 부족 시 새 아키텍처 적용 STOP. 기존 앱 정상 경로 보호가 비용 숫자보다 우선.
- 이번 변경은 GitHub 상태·작업 지침 **문서만**. 제품 코드/Functions/Worker/Rules/DB/Hosting/TEST/PRODUCTION 미변경·미배포. 문서 추가만으로 TS/Build/실기기 검증 PASS 주장 금지.

---

## 0S07. Stage404·405 격리 D1: 67곡 알림 추가 W201 → W3 절감 / 운영 전환 차단 (2026-10-09 KST)

- 최신 [CI Run 37829847377](https://github.com/andrawing1212/soridraw-music/actions/runs/37829847377) **SUCCESS**. `scripts/verify-404-069-durable-outbox-cost.mjs`(069 9/9 + atomic rollback)와 `scripts/verify-404-075-durable-outbox-cost.mjs`(075 5/5 + 67곡 chunk)로 실제 격리 Miniflare D1 물리행 메타 계측. 기존 398~403 PASS 유지.
- **유의미한 개선 후보:** 한 번의 정산에서 changedTrack ID/likeCount를 50개까지 단일 JSON outbox row로 모아 저장. indexed per-track outbox는 변경 1곡 W+3, 3곡 W+9, 67곡 W+201. **묶음** outbox는 1곡 W+2, 3곡 W+2, 67곡(50+17) W+3. 중복 좋아요/상쇄는 W+0. 069·075 모두 DB batch 정합성 확인; 069 rollback PASS.
- **부작용 / 다음 차단:** 069 67곡 배경정산에서 RETURNING R1667/W270 → 묶음 R2349/W273(**추가 읽기 +682, 추가 쓰기 +3**). 이것은 원본 운영 과금/사용자 W1 접수 단위 아님. 실제 정산 전체 W1~W2 합격, 우회 없는 069/075 경로, Worker live trigger/index parity, R2 정착, 알림 인증/재전송, 구버전 수신과 10만 팬아웃 **미검증**. D1 outbox 청소/ack/write 비용도 빠짐. **배포 STOP**.
- 상세 `DOCS/RTDB_BATCHED_OUTBOX_D1_404_405_2026-10-09.md`. 다음 Stage406은 알림 SQL에서 반복 CTE를 줄여 **읽기 비용** 절감부터 설계·검증. 전체 read/write·DO/RTDB 비용/호환 조건 PASS 전 서버/Rules 변경 금지.
- 변경 내용은 GitHub preview 격리 test script 2개 및 기존 CI + DOCS뿐. app382/Worker/Functions/Rules/공유 D1·R2·Firestore/Hosting/main/TEST/PRODUCTION 변경·배포 **0**. TS/Build/실기기 검증 전. 기존 069 진단 workflow push 실패는 별도.

---

## 0S06. Stage403 글로벌 운영 원칙 조사 → SORIDRAW 안전한 알림 아키텍처 결정 (2026-10-09 KST)

- [AWS Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html), [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/api/alarms/), [Firebase RTDB 수신 범위 최적화](https://firebase.google.com/docs/database/usage/optimize) 공식 자료 대조. 비용은 RTDB 다운로드/연결, D1 인덱스·트리거 포함 row writes, DO/Functions까지 측정. 상세 `DOCS/RTDB_GLOBAL_PATTERN_DECISION_403_2026-10-09.md`.
- **결정:** 제품 W1 069/075 큐/30초 묶음 유지. 실제 canonical 정산과 같은 D1 트랜잭션 안의 *typed durable outbox* 후보를 독립 평가 → R2 정착 → server-only authenticated scoped signal → at-least-once/버전 멱등성. `journal-only` like 발행은 Stage402 결론대로 중단.
- 새 `scripts/verify-403-global-notification-model.mjs` + 기존 격리 CI 연결. 데이터 영속성/메시지 중복/정산/R2/crash/cost/fanout 10개 순수 시뮬레이션으로 테스트. **이 코드는 제품으로 연결되지 않으며 LIVE 물리 비용·D1 transaction/RTDB 배포 검증과 다름**. Run은 이번 푸시에서 기록할 것.
- 다음 **Stage404**: 실제 069/075 full D1 SQL+현재 trigger/index 구조에서 typed outbox 추가 W1~W2 가능 여부를 Miniflare로 검증. W3+면 배포 금지·대안 보고. DO storage billing·Firebase 연결/대역폭과 구형 앱 이중 발송/Rules 최후 전환 필수.
- 기존 PREVIEW app382/Worker/Functions/Rules/공유 사용자 D1/Firestore/R2·데이터/Hosting/main/TEST/PRODUCTION 변경·배포 0. 격리 CI 외 TypeScript/Build/실기기/운영 청구 미검증. GitHub의 기존 진단 069 push 실패 문제는 별도.

---

## 0S05. Stage402 기존 저널-only 좋아요 서버 알림 신뢰성 차단 / 격리 증명 PASS (2026-10-09 KST)

- 사용자 계속 진행 지시로 `scripts/verify-402-like-notification-trust-recovery.mjs` 추가, 기존 398 격리 Workflow 연결. [Run 37824899801](https://github.com/andrawing1212/soridraw-music/actions/runs/37824899801) **SUCCESS**: 398 4/4, 399 8/8, 400 5/5, 401 6/6, 신규 402 위험 검출 10/10 PASS.
- **제품 판단 FAIL/STOP — journal-only**: 동일한 최종 `explore_derived_changes(feed,track,id,seq)`+likeCount로 좋아요 수정 이력과 제목 수정 이력을 구별하지 못하는 격리 D1 반례 확인. 같은 곡 seq overwrite, D1 확정 후 R2 미정착, cursor-first 누락과 send-first 중복을 분리 검증. 즉 기존 저널만 보고 좋아요 변경을 확정 발행하는 것은 불가. retry in-memory 모형은 LIVE 신뢰성 증명 아님.
- 보고서 `DOCS/RTDB_JOURNAL_ONLY_TRUST_GAP_402_2026-10-09.md`. **다음 최소 방향**: 069/075 실제 commit의 반환 곡 ID + R2 정착 보장 + 영속 notification-only retry/인증/중복방지 조합을 독립 검증. 배경 D1 R 증가(039/040 +3~+7, 075 +3~+5) 및 DO/Functions/RTDB 비용이 정상 기준을 해치면 중단·보고. 저널-only 설계 반복 금지.
- app382/Cloudflare Worker/Functions/RTDB Rules/공유 데이터/Hosting/main/TEST/PRODUCTION 변경·배포 0. 격리 테스트 코드/Workflow/문서 GitHub push만 수행. TypeScript/Build/운영 D1 청구/Worker bundle parity/PC·모바일 실사용 미검증. 기존 069 자동 진단 push 실패는 별도 미해결.

---

## 0S04. Stage401 기존 D1 변경 저널 재활용 격리 6/6 PASS / 제품 알림 BLOCKED (2026-10-09 KST)

- 사용자 계속 개발 지시로 `scripts/verify-401-existing-derived-journal.mjs` 추가, `.github/workflows/verify-398-isolated-d1.yml` 연동, `preview` 격리 CI Run [37823762282](https://github.com/andrawing1212/soridraw-music/actions/runs/37823762282) **SUCCESS**. 기존 Stage398 4/4, 399 8/8, 400 5/5 유지; Stage401 6/6 + 67곡 50/17 페이징 + 같은 곡 변경 합치기 PASS.
- **새 비용 방향:** 이미 있는 `explore_derived_changes(feed,track,id,seq)` 목록을 사용하면 알림 전용 D1 새 레코드/쓰기 추가 없이 변경곡을 읽는 방향이 가능함. 간소화된 Miniflare 저널 선택 R1/W0, 쓰기 증분 0. 실제 정산 W6/W7 모델은 사용자 접수 W1이 아니며 운영 비용과 비교 불가.
- **결정적인 남은 위험:** 이 목록은 좋아요뿐 아니라 곡 정보/공개 상태 수정도 기록하고, seq는 같은 곡마다 최근 값으로 덮임. 그대로 좋아요 서버 알림으로 발행 불가. durable checkpoint/트리거 LIVE parity/Functions 인증·재전송/구버전 호환/RTDB 10만 명 수신량 미검증.
- 근거 문서 `DOCS/RTDB_EXISTING_DERIVED_JOURNAL_401_2026-10-09.md`. 코드는 런타임 import되지 않는 격리 스크립트뿐. 기존 PREVIEW app382/Worker/Functions/Rules/공유 D1·R2·Firestore 데이터/Hosting/main/TEST/PRODUCTION 수정·배포 0. TypeScript/Build/PC·모바일/실제 D1 비용 미검증.
- 다음은 저널 track만으로 좋아요 변화임을 단정하지 않고 R2/canonical 확정과 실사용 비용을 보존하는 **like-specific + durable retry** 최소 절차 검증. 조건 불충족 시 중단하며 LIVE 발행/Rules 변경 금지.

---

## 0S03. Stage400 069/075 확정 이벤트 격리 검사 PASS / 서버 게시 BLOCKED (2026-10-09 KST)

- 사용자 계속 진행 지시에 따라 preview에 격리 검사 `scripts/verify-400-069-075-confirmed-event-gate.mjs` 추가 + 기존 `.github/workflows/verify-398-isolated-d1.yml`에 자동 연결. GitHub isolated CI Run [37822533579](https://github.com/andrawing1212/soridraw-music/actions/runs/37822533579) **SUCCESS**: 이전 398 4/4, 399 8/8, 신규 400 075 5/5 + 069/075 source guard + 모의 겹침 실험 PASS.
- 075 배경 aggregate Miniflare 모델에서 membership INSERT/DELETE `RETURNING track_id` 제안은 canonical 결과 동일, 쓰기 증가 0, 읽기 증가 첫 좋아요/중복/해제/중복 해제 +3, 2계정 동일곡 +5. 원래 399 069/039/040 모델은 R+3~+7 / W+0. **이 값은 LIVE D1 청구 및 사용자 화면 069 접수 W1과 별개**.
- **핵심 차단:** 실제 069 queue 040 배치는 변경곡 ID를 반환하지 않음. 075 `changedRows`는 D1 batch 전 별도 예측이어서 두 예측 후 한 성공만 발생하는 모의 overlap에서 두 번째 값이 stale. server-confirmed publisher가 069+075 모두를 신뢰할 수 있도록 현재 구조만으로 연결하는 것은 FAIL. 191 first-page repair도 이벤트 출처로 금지.
- 검증보고 `DOCS/RTDB_069_075_ISOLATED_GATE_400_2026-10-09.md`. 제품 런타임 import/배포 없음. 기존 PREVIEW app382, Worker, Firebase Functions/Rules, 공유 D1/R2/Firestore/계정 데이터, main/TEST, PRODUCTION 변경 없음. TypeScript/Build/실기기/운영 요금/Worker live parity 미검증.
- 다음: 두 큐 모두 실제 committed rows만 잡는 **single minimal** notification-only 설계 + 비용 상한/중복·정착 실패 인증 보호가 성공하기 전 LIVE 게시/RTDB Rules 변경/서비스 배포 금지. 기존 app382 좋아요·팔로우 정상 기능 보호.

---

## 0S02. 실제 Worker 069/075 분기 확인 + 격리 정산 D1 8/8 PASS (2026-10-08 KST)

- GitHub preview 생성 Worker 전체 소스 직접 확인: `handleLikeBatch034` W1 **069 큐** 접수; 039/040 legacy aggregate는 변경곡 ID 반환 없음; 별도 075 aggregate만 `changedRows` SELECT로 곡 ID/owner/count를 R2에 전달. **075 단독 서버 알림은 069 좋아요 누락** 위험. DO 191은 첫 40곡씩 복구일 뿐 전체 곡 이벤트가 아님.
- `scripts/verify-399-full-aggregate-d1-cost.mjs` + 기존 `.github/workflows/verify-398-isolated-d1.yml` 연동, 격리 Miniflare CI run `37744086289` **PASS** (398 4/4 + 399 8/8). 039/040 전체 CTE 경로 모델에서 `RETURNING` 시 쓰기 증분 0, 읽기 +3~+7 측정. 예시 단일 첫 좋아요 R72/W5 → R75/W5(격리 배경 처리 모델). **실제 운영 청구액/현재 Worker와 혼동 금지**. 정확한 근거 `DOCS/RTDB_FULL_AGGREGATE_COST_399_2026-10-08.md`.
- 사용자 CACHE LIVE R0/W1은 069 **접수 단계**이고, 격리 W5 정산은 다른 단계. 좋아요 W1 정상 기능은 보호. 10만 사용자 비용, 구버전 호환, Worker live deploy parity, 069+075 신뢰 서버 알림은 미검증.
- 앱382/Worker/Functions/RTDB Rules/공유 D1/R2/Firestore/Hosting/TEST/PRODUCTION 변경·배포 0. TypeScript/Build/실사용 미검증. Stage 399는 CI/진단 추가뿐.
- 다음 코드는 069+075 양쪽의 서버 확정 이벤트를 안전하게 확보하는 **single minimal solution**만 시도하고, 구버전 public likeCount 실시간 유지 + Worker/D1 비용 합격 전 실제 배포 금지.

---

## 0S01. 격리 Cloudflare Miniflare D1 행읽기·행쓰기 실제 로컬 측정 PASS / 운영 전체 비용 미검증 (2026-10-08 KST)

- 개발 단계 A-398 진행: `scripts/verify-398-miniflare-d1-returning.mjs`, 자동 격리 CI `.github/workflows/verify-398-isolated-d1.yml`. 테스트 외부 Credential/Cloudflare 계정/운영 D1 연결·데이터변경 없음. Run `37741253004` SUCCESS; 첫 Run `37741152524`은 runtime compatibilityDate가 workerd 지원 범위를 초과해 실패한 설정오류로 수정 후 통과.
- **실제 Miniflare LOCAL D1 meta 증거:** membership + queue 삭제의 축약형 실험에서 신규 좋아요 기존 R1/W3 → RETURNING R2/W3, 중복 좋아요 R1/W1 → R2/W1, 해제 R2/W2 → R3/W2, 중복 해제 R1/W1 → R2/W1. ID 정확성/DB 정합성 4/4 PASS, **읽기 증분 +1/이벤트, 쓰기 증분 0**. 전체 SORIDRAW canonical Worker W1~W2 합격으로 해석 금지.
- 별도 Node22 in-memory SQLite patch039/040 CTE 구조·트리거 없는 격리 비교 8/8 PASS, D1 물리 R/W 계측 아님. 코드/결과 근거를 `DOCS/RTDB_LOCAL_D1_COST_PROBE_398_2026-10-08.md`에 보존.
- **다음 gate:** 배포된 정확한 Worker bundle, 실제 current canonical 035/066/069/075 및 157 overlap, 인덱스·트리거와 전체 batch 처리 경로 검증 후 LOCAL D1 전체 CTE 비용을 재현. 반환된 ID 실측만으로 서버 RTDB publisher 구현 불가. 공유 LIVE Rules는 직접 클라이언트 전역 write 허용 상태이며 fanout/좋아요 30초 종료 문제 미해결.
- **제품/데이터/배포:** 기존 PREVIEW app382, 기존 Worker, Firebase Functions, RTDB Rules, Firestore/D1/R2 공유 원본, TEST/main, PRODUCTION 변경 없음. 새로운 코드 파일들은 제품 런타임에 import되지 않음. TypeScript/Build/PC·모바일 실사용 변경/검증 없음. 변경된 것은 preview 테스트·문서·자동 검사 Workflow만.

---

## 0S00. 단계 A 실제 코드 2개 + SQL 프로토타입 — 격리 12/12 PASS (2026-10-08 KST)

- 사용자 "니가 작업해봐" 요청의 실제 `preview` 코드 결과: `scripts/verify-rtdb-public-like-returning-prototype.mjs` + `cloudflare/explore-worker/runtime/like-confirmed-event-397.mjs` + `scripts/verify-rtdb-public-like-aggregate-extract-397.mjs`. 첫 코드 commit `8caedb742ed0a5812fde0b44d8544a78d80b772f`, 추가 모듈·검증 commit `216fdb1202f4d533761c10abf929850cacb2a738`. 기밀 값/실사용 데이터 접근 없음. 기능 플래그 OFF 이전 단계: 신규 코드 **아직 어디에도 호출/배포하지 않음**.
- Node.js22 격리 SQLite 기존 INSERT OR IGNORE/DELETE에 `RETURNING track_id` 후보 검증 4/4 PASS. 기존 patch040 D1 `env.DB.batch` 결과에서 정확한 changes 행을 추출하고 missing/초과를 fail-closed하는 모듈 8/8 PASS. 12/12는 **격리 코드 후보 PASS**이지 D1/RTDB 10만 사용자/앱 기능 PASS 아님.
- **실제 비용 게이트 미통과:** Cloudflare D1 `meta.rows_read` / `meta.rows_written`, 현재 실제 CTE/queued W1 aggregate, Functions 인증/재전송, legacy-V2 공존을 검증하지 않음. 기존 Worker는 변경곡 ID를 결과에 노출하지 않으므로 신뢰 server publisher 아직 완성 안 됨. 공유 Rules의 공통 신호 클라이언트 쓰기 위험과 전역 다운로드 비용은 지금도 존재함.
- 2026-10-08 현재: app382 PREVIEW 실앱, 공유 RTDB Rules, Firebase Functions, Worker, D1/Firestore/R2 사용자 원본, TEST/main, PRODUCTION 모두 변경/배포 없음. TypeScript/Build/앱/Worker 실제 통합/PC·모바일 실사용은 미검증.
- 다음 작업: 안전한 격리 D1 `RETURNING` 메타 R/W 실측→신뢰 서버 발행 인증·중복방지의 최소 구현 및 테스트→관련 곡 수신 범위 V2 실측→구버전 동기화 보호 후 Rules 마지막에 변경. `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md`와 `DOCS/NEXT_CODEX_TASK.md` 참고.

---

## 0RZZ. 공개 좋아요 서버 발행 단계 A — 실제 SQL ID 검출 프로토타입 PASS / LIVE 연결 전 (2026-10-08 KST)

- 사용자 "니가 작업해봐" 지시에 따라 설계 후속으로 최초 실제 코드 프로토타입 개발: `scripts/verify-rtdb-public-like-returning-prototype.mjs`. GitHub commit `8caedb742ed0a5812fde0b44d8544a78d80b772f`, Node.js 22 인메모리 SQLite 순수 SQL `RETURNING track_id` 테스트 4/4 PASS (중복 삽입·삭제, 미존재 해제, 목록 밖 다른 곡, 변경 없는 묶음).
- 실제 Worker 040 집계 `processExploreLikeAggregateWave035`는 기존 `env.DB.batch`에서 실제 좋아요 membership INSERT OR IGNORE/DELETE를 수행하지만 응답은 행 **건수만** 반환. 단일 W1 intake/069와 지연 aggregate 구조는 정상 유지. 동작 중 코드에 아직 `RETURNING` 수정·배포 없음.
- **명확한 미검증/STOP:** SQLite mock는 실제 Cloudflare D1 SQL CTE 및 `meta.rows_read/rows_written` 검증 아님; 실제 비용 합격 보장 안 됨. Canonical settled track IDs/server eventId/ownerUid 및 Worker→Functions 인증·idempotency·notification-only retry 설계가 확정되지 않아 SERVER PUBLIC LIKE publisher는 아직 미구현. 단계 A 설계 `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md` 갱신. 10만 회원 비용·남용 원천 차단 PASS 아님.
- 앱382 좋아요·팔로우/개인 하트, RTDB Rules, Worker/Functions, Firebase Hosting, 공유 D1/Firestore/R2 사용자 데이터, TEST/main, PRODUCTION 변화 없음. 단독 수동 테스트·문서 commit만; TypeScript/Build/Worker 통합/PC·모바일 실사용 및 배포 미실행.
- **다음:** 격리 D1에서 `RETURNING` + 실제 W1 집계 CTE·원본 의미 동일성·rows R/W 정확 측정 → 인증된 Functions publisher feature OFF 시범 → scope fanout 비용 비교 → 구버전 공존 후 Rules 최종 차단. 어떤 단계도 공유 Rules 선차단 금지.

---

## 0RZY. RTDB 공개 좋아요 안전 컷오버 4단 설계 기록 (2026-10-08 KST)

- 사용자 동의에 따라 app382의 공개 좋아요 전역 알림 비용/남용 방지 설계를 진행하고 `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md` 신규 추가. 코드/서버/Rules 수정 없이 계획 확정 후보만 작성.
- Firebase Console 사용자 제공 활성 Rules: `publicSync/exploreLike`에서 auth.uid 일치만으로 일반 클라이언트가 global RTDB node를 발행할 수 있음을 GitHub rules와 직접 대조 확인. Global onValue는 화면과 관계없는 최근 50곡 변경묶음까지 다운로드할 수 있음. 실제 악용 발생·10만 사용자 실제 비용/전체 규칙 exact match 미검증.
- **고정 전환 순서:** A 서버 canonical ACK 기반 인증된 RTDB publisher(기존 Functions Admin SDK 선례·Worker W1/DO 종료 이벤트 재사용 가능성 확인, 비밀/서명·중복·bounded durable notification-only retry 검증) → B 화면 관련 곡/버킷에만 V2 구독 및 비용 측정 → C 구형 앱 호환용 legacy 게시를 서버가 대신 한 뒤에야 live client write 최종 차단 → D PC/모바일/기능/비용 독립 검증. 기존 RTDB Rules 단독 선변경 금지.
- **중요 비용/안전 트레이드오프:** 공유 RTDB를 사용하는 PREVIEW/TEST/PRODUCTION+브라우저 구버전 동시 보존 시, 서버가 legacy 전역 이벤트를 계속 발행하는 동안 fanout 비용은 완전히 제거되지 않음. 기존 RTDB 비용을 Functions/Worker/R2/D1 per-user poll로 이전하면 FAIL. 단계별 실측 후 결정.
- **새 차단 조건:** `preview-entry.js`의 `repairSharedPublicLikeCounts191`는 latest/popular 상위 최대 80곡의 복구 작업일 뿐 모든 곡의 확정 이벤트가 아님. 이 경로를 publisher의 유일한 변경곡 검출기로 쓰면 누락 발생. 또한 브라우저에 주는 `publicSignalAcceptedAt`는 W1 ACK 시각 메타데이터로 개별 곡 정착 증거 아님. 구현 전 069 queue 실제 변경곡/operation ID 흐름 및 worker 생성 파이프라인 확인 필수. 상세 설계 문서 업데이트.
- **코드·배포:** docs-only, 앱 app382 배포/Worker 버전 그대로. RTDB Rules, Firebase Functions, Cloudflare, 공유 D1/Firestore/미디어, main, production 변경 없음. TypeScript/Build/관련 tests 미실행(코드 수정 전).
- **다음 실제 목표:** 단계 A의 신뢰 가능한 최소 publisher를 기존 Worker 확정 경로·Functions 인증 경로로 구현 가능한지 먼저 증명하고, Codex High → Work 독립검증을 거쳐 안전한 preview 구현 여부 결정. 이후 단계 B→C→D. 30초 이내 창 완전 종료 후 타기기 미전송은 별도 후속 문제로 그대로 남음.

---

## 0RZX. RTDB 적용 규칙 자동 조회 401 — 안전한 콘솔 대조로 전환 (2026-10-08 KST)

- PRIVATE 운영 검사 Run 37736055786: GitHub WIF 인증 PASS, RTDB 보안 규칙 GET HTTP 401 FAIL. 운영 보안 규칙은 아직 미확인.
- Firebase RTDB Viewer 역할로는 규칙 GET이 허용되지 않을 수 있으며 규칙 관리는 데이터 변경 가능 권한과 묶여 있음. 관리자/쓰기 권한 추가 금지.
- 운영 지표 수집 계정의 Monitoring Viewer 유지. 추가한 RTDB Viewer는 불필요한 원본 데이터 읽기 권한을 확대하므로 회수 권장.
- LIVE Rules는 사용자가 Firebase Console에서 직접 확인한 화면으로 GitHub database.rules.json과 비교한다. 보안 위험/비용 최적화 순서는 기존 감사 문서 유지.
- 앱 코드, 클라우드 설정, 사용자 데이터, RTDB 규칙, TEST, PRODUCTION, Hosting 배포 변경 없음.

---

## 0RZW. LIVE RTDB Security Rules READ-ONLY 검사 준비 완료 (2026-10-08 KST)

- 사용자가 Google Cloud `soridraw-ops-metrics-reader`에 `Firebase Realtime Database Viewer` 읽기 권한을 추가하고 저장했다고 확인.
- PRIVATE ops repo `andrawing1212/soridraw-ops-private/main`에 **`.github/workflows/firebase-rtdb-live-rules-readonly.yml`** 수동 실행 진단 생성, commit `0802c763ab3b1d4e4b7e39bd33d9d3c9740e7701`. GitHub PUBLIC preview audit source `1fc082854d16541c010e49d1a046194336c26141` exact pin. Google WIF 인증 후 공식 Firebase `/.settings/rules.json` GET만 수행하고 canonical 보안 규칙 변경/사용자 데이터 읽기/배포는 하지 않음.
- **중요:** `roles/firebasedatabase.viewer` 공식 권한 목록은 인스턴스 get/list만 확인되므로 RTDB `/.settings/rules.json` GET을 허용할지는 **미검증**. HTTP 403이면 FAIL, Admin/Editor 권한 자동 확대 금지, 사용자에게 읽기 전용 대안을 보고. 실제 규칙이 로그인 클라이언트 쓰기를 허용하거나 GitHub 버전과 다르면 Audit job FAIL(원인 확인 목적).
- 다음 순서: PRIVATE repo Actions > **SORIDRAW RTDB Live Rules Readonly** > Run workflow (main) 1회 수동 실행, run ID/HTTP status/비공개 Summary 확인. 이후 운영 Rules과 소스 규칙 일치/공개 fanout 악용 위험 판정 → 안전한 최소 변경 설계 → 기존 app382 정상 기능 보호한 PREVIEW 구현·검증.
- **변경 범위:** PRIVATE ops workflow 1개 + PUBLIC 상태 문서만. 앱 코드, Cloudflare, Functions, Firebase Hosting, LIVE RTDB Rules, 사용자 데이터, main/PRODUCTION 앱 변경 없음.

---

## 0RZV. 공개 좋아요 RTDB fanout/남용 2차 정적 감사 — 설계 위험 확인 (2026-10-08 KST)

- preview 기준 `39e6734ea29ec83f64806886f6635eae9326359c`에서 `src/services/explorePublicLikeSyncService.ts`, `src/pages/ExplorePage.tsx`, `src/services/exploreLikeService.ts`, `database.rules.json`, 앱160/164 frozen/test192/396 확인. 추가 보고 `DOCS/RTDB_PUBLIC_LIKE_FANOUT_AUDIT_2026-10-08.md`.
- 확정: 전역 `publicSync/exploreLike` onValue+merged 3분/최대 50곡을 모든 활성 Explore 구독자가 받고 화면 내 곡만 추후 R2 조회. 앱382 settled ACK는 Worker 재조회만 차단하고 RTDB 다운로드 fanout은 해결하지 못함. GitHub rules는 auth.uid=actorUid만 확인해 canonical D1 ACK 없이 인증 클라이언트가 전역 알림을 재기록할 수 있는 소스 수준 P0 위험.
- 앱/사용자데이터는 그대로. PRIVATE GitHub RTDB 실제 총 다운로드 baseline 측정 run 37734211971 성공; 구체 사업 지표는 private 보고서에만 유지. LIVE RTDB 적용 Rules, 공통 경로별 다운로드, 공격 발생 여부, 10만 회원 청구액은 **미검증**.
- 권장 다음: 실제 공유 RTDB Rules를 읽기 전용 GET(필요 시 사용자에게 Firebase Realtime Database Viewer 역할 요청)하여 소스와 대조. 서버 ACK 신뢰 경계와 bounded 곡/영역 수신 설계 후 비용·보호 테스트 계획 고정; 구형 앱이 살아 있으므로 Rules 선차단 금지.
- 이후 순서: 안전한 공개 fanout/남용 차단 → 좋아요·팔로우 30초 전 창 종료 복구 → 통합 PC/모바일 비용 검증. 앱382 Hosting·Worker, Firebase, Cloudflare, RTDB Rules, 원본 데이터, main, production 변경·배포 없음.

---

## 0RZU. Firebase RTDB 사용량 LIVE 읽기 연결 성공 / 첫 24h·30d 실측 (2026-10-08 KST)

- PRIVATE ops Github Actions 최초 수동 진단 run **37734211971 SUCCESS**; auth@v3 WIF PASS, Cloud Monitoring GET PASS, 7일 보관 artifact 업로드 PASS. Google Cloud 서비스 계정과 OIDC 연결이 실제로 작동함.
- 세부 운영 사용량/동시접속/월별 수치는 **PRIVATE** 저장소 `andrawing1212/soridraw-ops-private/reports/2026-10-08-rtdb-baseline.md`에만 기록. 공개 소스 저장소에는 수치를 복제하지 않는다.
- 이번 성공은 사용량 수집 성공이며 **RTDB 전역 publicSync/exploreLike fanout 보안/비용 안전 PASS를 뜻하지 않는다.** 10만 명 부하/남용, live rules 비교, Cloud Billing 청구액은 계속 미검증.
- 다음 작업 우선순위: 공개 좋아요 공통 신호의 무관 시청자 다운로드 증폭/보안 정책 점검 및 안전한 제한 설계 → PC↔모바일 30초 전 창 종료 문제 → 통합 앱/Worker/D1/RTDB 검증. 기존 정상 app382 코드/RTDB Rules/데이터 및 배포는 변경하지 않음.

---

## 0RZT. RTDB 진단 비공개 GitHub Actions 설치 완료 / 최초 실측 대기 (2026-10-08 KST)

- 사용자가 PRIVATE GitHub repo andrawing1212/soridraw-ops-private 생성하고 ChatGPT GitHub Connector에 해당 repo 추가, 연결 확인.
- 사용자가 Google Cloud project soridraw-app-866a5에 soridraw-ops-metrics-reader 서비스 계정 생성 및 project Monitoring Viewer 권한을 IAM 화면에서 확인.
- 사용자가 Workload Identity Pool soridraw-github-metrics, GitHub OIDC provider github-private-metrics 생성, mapping google.subject/assertion.sub, attribute.repository/assertion.repository, attribute.ref/assertion.ref, 조건 GitHub repo andrawing1212/soridraw-ops-private + main branch 고정. repo attribute에만 service-account impersonation 허용을 Google Console UI에서 저장. **해당 정책의 live IAM API 검증은 최초 workflow 인증 시 확인**.
- ChatGPT가 PRIVATE ops repo main에 수동 workflow .github/workflows/firebase-rtdb-metrics-readonly.yml 생성: commit 5fa5036e3577067422a9fcaa1fead44c8e139e60. 기존 PUBLIC preview script 81940357eaba404a210c3d1303b853f6868b33f7를 exact pin, read-only GCP Monitoring API GET, 고정 WIF provider/Monitoring Viewer 서비스 계정, 키/비밀번호/JSON 없음. private repo 내에서만 Actions Summary/artifact 보관. 클라이언트 앱/RTDB Rules/Worker/Functions/Firestore/D1/Hosting/배포/main/production 변경 없음.
- 현재 gate: 사용자가 PRIVATE ops repo > Actions > SORIDRAW Firebase RTDB Metrics (Private Readonly) > Run workflow (main)으로 최초 수동 실행. Run ID/결과를 ChatGPT가 API로 확인, 인증/API/측정 오류라면 이 읽기 전용 진단만 교정. **LIVE RTDB 다운로드/동시 연결·메시지 팬아웃/실제 Cloud Billing 수치는 아직 미검증**.
- 최초 측정 완료 후 단계 순서 유지: 1) RTDB 비용/남용 감사 → 2) 공개 좋아요 공통 fanout 및 남용 차단 → 3) 30초 전 앱 종료 좋아요·팔로우 동기화 복구 → 4) PC/모바일 실측 통합 검증.

---

## 0RZS. Firebase RTDB 사용량 Private GitHub 읽기전용 진단 준비 (2026-10-08 KST)

- 사용자가 승인: SORIDRAW 프로젝트 채팅과 GitHub를 이용해 Firebase 실제 운영 지표를 확인하는 구조. 기존 소스 repo는 PUBLIC이므로 실측 운영 데이터는 신규 PRIVATE ops repo에만 기록.
- 준비: scripts/audit-firebase-rtdb-metrics-readonly.py (Cloud Monitoring timeSeries.list GET, self-test, 24시간/30일 sent_bytes 등), DOCS/TEMPLATES/firebase-rtdb-metrics-readonly.yml (비공개 저장소 전용 수동 workflow 템플릿), DOCS/PRIVATE_FIREBASE_METRICS_SETUP.md (사용자 WIF/권한 설정).
- 사용자가 필요한 1회 작업: GitHub 비공개 andrawing1212/soridraw-ops-private 생성, Google Cloud project soridraw-app-866a5의 별도 Monitoring Viewer service account + GitHub repository/branch 제한 WIF 연결, private repo에 pinned SHA 기반 수동 workflow 설치, ChatGPT GitHub connector private repo access 추가. 기존 배포용 Firebase 서비스 계정 키 재사용 금지.
- 현재 실제 LIVE RTDB 사용량/Rules 비교는 **미검증**. 스크립트는 PRIVATE repo에서 인증될 때까지 실행하지 못함. 이 단계에 Firebase/Cloudflare/Rules/공유 데이터/Hosting/main/production 변경 0.
- 계속 진행 순서: RTDB 실측 감사 → global like fanout·남용 차단 → 30초 조기 종료 좋아요/팔로우 복구 → 통합 성능·비용 실사용 검증.

---

## 0RZR. RTDB 10만 회원 비용·남용 및 30초 종료 동기화 복구 — 영구 작업 순서 고정 (2026-10-08 KST)

- **새 사용자 지시:** 채팅 변경 후에도 GitHub 현재 상태에서 동일 작업을 이어간다. 순서: (1) RTDB 비용/보안/남용 위험 감사 및 실제 비용 측정 → (2) 공개 좋아요 공통 신호 fanout/임의 쓰기 차단, 정상 기능 보호 → (3) 좋아요·팔로우 30초 전 창 종료/기기 간 미전송 복구 → (4) PC/모바일/업데이트/비용 통합 검증. 단계 건너뛰기 금지.
- **이번 작업:** GitHub preview HEAD 95a87755d68d28f33003e72dc7e5fdfe2392c2f0의 app382 소스 기준 read-only 1차 감사 및 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md 신규 작성. 공통 신호 publicSync/exploreLike의 전체 Explore onValue 구독/최근 50곡 fanout, database.rules.json에서 로그인 actorUid 일치만으로 공통 쓰기 가능, 현재 30초 확정 전에 창 종료 시 개인 신호 미발행 갭을 확인.
- **중요:** 월 수천~수만 달러 예시는 실측 비용 아닌 가정 스트레스 모델. Firebase 공식 가격상 RTDB는 다운로드·연결 비용이 중요. 실제 Console Usage(24h/30d)/활성 Rules/프로젝트 경계와 트래픽 분석은 미검증, 따라서 비용 최적화 구현 전 감사 게이트 열려 있음.
- **코드·사용자 데이터·배포:** 이번 기록 작업은 docs-only. Explore 좋아요 app379 W1/본인 하트, 팔로우 app380 30초/W1, Studio 저장 하트 app349 및 app382 공개곡 Worker 중복 수정은 보호. Cloudflare/Firebase/Functions/RTDB Rules/공유 D1/main/production 변경·배포 없음.
- **정확한 다음 작업:** RTDB LIVE 사용량/구독자당 실제 메시지 크기/호출 횟수/적용 Rules를 READ-ONLY로 감사해 공개 fanout 비용·악용 상한을 확정한다. 공통 방송을 중지해 공개 숫자 갱신을 깨거나 D1 반복 조회로 이전하는 설계 금지. 이후 확정 설계로만 preview 구현/검증. 세부 체크리스트는 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md.
- **브랜치/배포 기준:** preview 기존 app382 Hosting Firebase Run 37722012753 SUCCESS, Worker c4c51b19-818a-4eaf-8be1-aca0b241d50a 유지; 이번 문서 커밋은 새 릴리스가 아니다.

---

## 0RZQ. app382 클라이언트 HOTFIX — Firebase PREVIEW 실배포 성공 (2026-10-08 KST)

- **최신 사용자 운영 지시 (2026-10-08T03:13:48Z):** 앞으로 수정 요청은 ChatGPT가 기본 작업자로 직접 수정·TypeScript/Build/관련 테스트 확인 후 **안전하다면 같은 작업 내 PREVIEW 배포까지 진행**한다. 별도 배포 승인 반복 요구하지 않는다. 테스트 실패/공유 데이터 위험 시 배포 중단하고 명확히 보고. TEST는 별도 사용자의 테스트배포 승인, PRODUCTION은 명시적 정식 승인 필수.
- **이번 범위:** 기존 정상 app380 팔로우/해제 최종상태 30초·Cloudflare Worker 097, app379 좋아요 W1·UI 동결 보호. RTDB 공개 좋아요 변경신호 3분 유지로 인해, 새로고침 시 이미 반영한 public-like-cards R2 카드를 Worker에서 다시 가져오던 중복 경로만 단말별/계정별 settled watermark로 차단. 실제 새로운 변경 신호는 그대로 조회하고 일정 횟수 재시도 유지. CACHE LIVE 사용자가 보는 Cloudflare 요청 상세 항목은 한글 이름으로 표시 (공개곡 좋아요 숫자 확인, SORIDRAW 추천곡, 추천곡 관리 권한 확인 등), API 경로/진단 집계 키는 원형 유지. 신규 좋아요 receipt390/098 적용·데이터 변경 없음.
- **업데이트 표시:** app380과 같은 버전이면 사용자 업데이트 알림이 발생하지 않으므로 `public/app-version.json`을 **382**로 승격. 과거 별도 app381 Recent/split UI hotfix는 포함하지 않고 보존. `verify-303` 검사는 버전번호가 아니라 실제 UI 라우팅 기능 존재 여부에 따라 기존 app381 검증을 적용, `verify-395`로 app379 UI blob 원본을 고정. 버전 변경은 앱 사용자 원본/카탈로그 캐시를 전체 무효화하지 않으며 기존 진단 세션만 앱 업데이트 정책대로 리셋.
- **코드/검사 고정 commit:** `6c5fa3fdb3f898b62fffacbba54e7bd63013f95a`. Focused GitHub Actions `37721869633` **SUCCESS** (TypeScript, Build, app379 frozen like + non-follow Worker, app382 UI frozen, 396 public-like settled signal reload/new mutation/TTL/한글 표시, 기존 follow 354/355/356/377/386/387/389와 303 모두 PASS).
- **PREVIEW Hosting 배포 trigger commit:** `178e72c51effbd867ea6f6e45f5df9370723a31f`. `.deploy/preview-app-release.trigger`에 `deploy_shared_rtdb_rules=false`, `worker_change=false`, `functions_change=false`, `shared_d1_change=false`; Cloudflare Worker bundle/config, DB 스키마 및 공유 데이터, Rules/Functions 미변경.
- **Firebase PREVIEW App Release Run `37722012753` SUCCESS** — `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=382`, `PREVIEW_EXACT_BUILD=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`, `TEST_PRODUCTION_UNCHANGED=PASS`. 실제 목표 주소 https://preview.soridraw.com. GitHub runner가 실제 도메인 exact artifact를 검증했으며 ChatGPT는 사용자 계정으로 앱 브라우저 조작하지 않음.
- **Worker 상태:** 기존 PREVIEW Cloudflare Worker `c4c51b19-818a-4eaf-8be1-aca0b241d50a` 유지 목표; 이번 Hotfix에서 Worker deploy workflow 실행하지 않음. 기존 shared D1/RTDB 원본 수정 0. `main` b13360df1bab52e2d3b746ea47dc4e3718eef85c, `production` fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4 유지.
- **사용자 실사용 검증 전:** 같은 RTDB 좋아요 변경 알림을 이미 확인한 뒤 앱 새로고침 2~3회 → `공개곡 좋아요 숫자 확인` Worker 추가 증가 0 목표; 새로운 타계정 좋아요/해제 이벤트는 정상 R2 읽어 하트 공개 숫자 반영, D1 실제 행 R0/W0 유지. R2 사용/실행 비용과 물리 rows_read/written은 사용자 실기기/실서버 새 후보 측정 전. 팔로우 W1 및 모바일↔PC 최종상태 정상도 유지 확인 필요. 첫 변경 신호/로컬 캐시 삭제/다른 계정 접근에는 최초 조회 1회가 정상.
- **다음 단계:** app382 실사용 중복 Worker 0 및 새 좋아요 변경 감지·한글 항목 확인. 오류 있을 때만 좁게 수정·검사·PREVIEW Hosting 재배포. 정상이라면 불필요한 새 개발 없이 TEST 릴리스 preflight(`receipt390` unconditional) 호환성 별도 검토하고 테스트배포 승인 대기. 이전 069 자동 진단 workflow 실패는 별도 기존 문제로 계속 존재하며 이번 Hosting SUCCESS와 무관.

---
## 0RZP. app380 후속 PREVIEW 미배포 후보 — 공개 좋아요 알림 재생 Worker 중복 차단 + CACHE LIVE 한글 표기 (2026-10-08 KST)

- **사용자 실사용 발견:** app380 PREVIEW 좋아요 자체 정상. 앱 새로고침 시 `/v1/public-like-cards` Worker 요청이 증가. 사용자 캡처 기준 공개 좋아요 카드 요청의 D1 실제 행 R0/W0, Worker 1; 공개 추천곡·관리 권한 등 다른 URL이 진단 패널 제목으로 노출되는 것도 사용자 명시 수정 요청.
- **확인 원인:** `publicSync/exploreLike` RTDB changed-track signal 3분 retention 중, 화면 마운트/새로고침마다 `subscribeExplorePublicLikeInvalidation192`의 seen map 초기화로 이미 R2 settle 확인·캐시 반영한 옛 신호까지 다시 `fetchExplorePublicLikeCards192` 호출. 공유 D1 read/write는 없지만 Worker 반복 요청이 발생함.
- **최소 수정:** `src/services/explorePublicLikeSyncService.ts`에 브라우저별/계정별 **확정 카드 반영 신호 watermark**를 4분 TTL·최대 100곡으로 제한해 저장. `src/pages/ExplorePage.tsx`에서 settled R2 응답(`card.updatedAt >= row.at`)을 각 로컬 캐시에 적용한 후에만 기억하며, 재진입 시 이미 확인된 동일 track/at은 Worker 재요청을 건너뛴다. 새로운/미확정 track signal 및 다른 계정은 기존처럼 요청하고 5초 bounded retry 유지. 기존 좋아요 queue/membership/W1 Worker/RTDB Rules 변경 없음.
- **진단 표시:** `src/components/CacheDiagnosticsOverlay.tsx`에서 `/v1/public-like-cards`→`공개곡 좋아요 숫자 확인`, `/v1/curated`→`SORIDRAW 추천곡`, `/v1/me/explore-management-access`→`추천곡 관리 권한 확인`, 개별 revision 등 한글 표시. 아직 미등록된 `/v1/` 경로는 내부 원본 카운터 key는 보존하면서 제목 `기타 서버 요청`으로만 표시. 배치 카운터·서버 코드는 손대지 않음.
- **Focused 테스트:** 신규 `scripts/verify-396-public-like-reload-and-diagnostics.mjs`는 실제 TS 유틸을 가짜 storage에서 실행해 reload 동일 signal 재조회 방지, 다른 계정·새 signal 통과, TTL 만료, 실제 클라이언트 확인 후 watermark 저장 순서, 한글 label 출력 확인. 기존 `.github/workflows/app380-follow-only-check.yml`의 TypeScript/Build/Worker frozen/팔로우 회귀와 함께 **Run `37721479290` SUCCESS**, 확인된 코드 HEAD `0c1d176475fbca148332200fcf0987aeedfc5f49`.
- **현재 실제 배포:** 아직 **app380 기존 Worker/Hosting 유지**. 수정사항은 preview GitHub 소스에만 있고 Firebase/Cloudflare, 공유 D1/RTDB 사용자 데이터, main(TEST), production 변경/배포 **없음**. 반복 Worker 0 달성은 코드/격리 재생 검사는 PASS지만 실제 PC/모바일 브라우저 새로고침 검증 **전**.
- **주의:** 브라우저 기기 저장소가 차단/손상되거나 신호가 처음 보이는 진입에서는 changed-track 확인 1회가 정당하게 발생할 수 있다. 이 수정은 확인 완료한 신호의 중복 Worker 호출만 억제하며 새 실제 변경 감지를 늦추지 않는다.
- **다음:** 사용자 PREVIEW 배포 승인 후 기존 app380 정상 기능을 보존한 Hosting-only 후보의 앱 버전/업데이트 검증을 고정하고 실제 배포 → 동일 RTDB 신호 3분 내 여러 번 새로고침 시 공개 좋아요 카드 Worker 추가 요청 0, 새 좋아요 발생 시 갱신 1회 및 D1 물리 R0/W0, 팔로우 행쓰기 W1/30초 net-zero, PC↔모바일 실기기 확인. Worker/R2/D1 배포 불필요. TEST/PRODUCTION 승격 금지.

---
## 0RZO. app380 PREVIEW 사용자 실기기 팔로우·해제 비용/동기화 관찰 PASS (2026-10-08 KST)

- 실배포 source `b767b9cd3dbaba067e1d9df77fb703d1fe7cfae2` (app380), PREVIEW Worker `c4c51b19-818a-4eaf-8be1-aca0b241d50a`. 사용자 2026-10-08T02:55:14Z에 실제 앱 PC→모바일 팔로우/해제 결과 및 CACHE LIVE 캡처 2장 제출.
- **사용자 관찰 PASS:** 팔로우·해제 각각 마지막 클릭 후 약 30초에 서버 반영, 모바일 공개 팔로우 숫자도 약 30초 뒤 갱신. 30초 이내 여러 번 눌러서 **최종 상태가 최초 상태와 같으면 서버 비용 발생하지 않음**(사용자 직접 실사용 관찰). 같은 상태의 중간 클릭을 따로 저장하지 않는 final-state batching 의도와 부합.
- **CACHE LIVE 스크린샷:** 첫 번째 팔로우 해제 실행 D1 query R2/W1, query rows_read 11/rows_written 1. 둘째 팔로우 실행 D1 query R2/W1, query rows_read 10/rows_written 1. 양쪽 PAGE SYNC D1 R0/W0 및 Firestore R0/W0. 이는 각 캡처 내 '이번 실행'의 화면 수치이며 전체 DB physical billing/모든 경로 PASS로 과장하지 않음. R2 Class A/B 숫자는 별도 지표이고 팔로우 1회당 순증분 비용 확정 근거가 아님.
- **이번 실사용 범위 판단:** follow/unfollow W1 사례, PC→모바일 30초 수렴, net-zero W0 사용자 관찰 **PASS**. 반대 방향 모바일→PC, 새로고침/로그아웃·캐시 업그레이드, 공격성 429/503에서 정상 상태 복구, 다계정/장시간 반복, 정상 좋아요/해제 개인 membership 및 W1, R2 get/put 물리 비용 **아직 별도 실사용 미검증**.
- **보호 결정:** 정상 동작을 확인했으므로 제품 코드·Worker·Hosting·shared D1/RTDB를 추가 변경하지 않는다. 결과만 GitHub 상태 문서에 기록. TEST/main 및 PRODUCTION 승격은 사용자 승인 전 금지.
- **정확한 다음 단계:** (1) 모바일→PC 팔로우/해제 최종상태 수렴, (2) 기존 좋아요·해제 W1 및 내 좋아요/공개 숫자 확인, (3) 미변경 재진입·새로고침/30초 net-zero 유지, (4) 필요한 경우 R2 비용과 거부/복구 경로 읽기 전용 점검. 이상이 없으면 TEST 승격 전 390 preflight 별도 호환성 문제를 안전하게 검증하여 사용자에게 승격 승인 요청.

---
## 0RZN. app380 팔로우 전용 PREVIEW Worker + Firebase Hosting 실배포 SUCCESS (2026-10-08 KST)

- 사용자 2026-10-08T02:44:39Z 승인: 이미 완성된 `app380` 팔로우 30초 최종상태 묶음/097 제한만 PREVIEW 배포. 신규 좋아요 098/receipt390 및 shared D1 migration, TEST/PRODUCTION 배포는 승인하지 않음.
- **제품 소스 고정:** `b767b9cd3dbaba067e1d9df77fb703d1fe7cfae2` (app380, app379 UI/좋아요 원본 고정, follow-only 097 Worker). GitHub 상태 기록 이후 실제 Hosting 실행 ref는 `e9c2ee9f4b86bd28e00fd90b246cf1fbb50dae34`, 제품 코드 차이는 Worker/Hosting release trigger 두 파일뿐. GitHub Worker trigger push commit `6856ab6f2ea0bbc6ddae108968b0a854f566c8bb`.
- **Cloudflare PREVIEW Worker Release Run `37719453033` SUCCESS**. 제품 target 정확 `b767b9cd3dbaba067e1d9df77fb703d1fe7cfae2`. PREVIEW active Worker version `61f1fa6e-ef93-478b-b06f-4a64e3e337d9` → `c4c51b19-818a-4eaf-8be1-aca0b241d50a`. `PREVIEW_RELEASE_PREFLIGHT=PASS`, `FOLLOW_ONLY_380_NO_RECEIPT_SCHEMA_PREFLIGHT=PASS`, `LIVE_LIKE_D1_STATE=PASS pending035=0 pending069=0` 및 `PRE_DEPLOY_PENDING_069=0`. Feed/Profile smoke PASS, R2 read authority PASS, warm revision D1 R0/W0 PASS, TEST/PRODUCTION Workers unchanged PASS. No pending queue drain or like snapshot repair requested.
- **Firebase PREVIEW Hosting Release Run `37719570071` SUCCESS**. TypeScript PASS, Build PASS, frozen prior likes/profile/follow regression PASS; `SHARED_RTDB_RULES_DEPLOY=SKIPPED`, `FIREBASE_PREVIEW_DEPLOY=PASS`. GitHub workflow가 `preview.soridraw.com/app-version.json`의 **380**과 배포한 exact build hash를 대조해 `PREVIEW_EXACT_BUILD=PASS` 기록. `TEST_PRODUCTION_UNCHANGED=PASS`. Firebase Functions/Rules와 shared D1 schema 변경 없음.
- 앱 실제 주소: https://preview.soridraw.com (app380). Web 독립 접속은 이번 ChatGPT 환경에서 불가하여 **GitHub 배포 runner가 실제 URL에서 읽어 성공한 검증**으로 분명히 구분한다.
- **실사용 검증 전 항목:** 새 PREVIEW Worker 팔로우/해제 실제 D1 physical rows_read/rows_written W1~W2, R2 get/put 비용 및 쿨다운, 30초 내 net-zero 서버 요청 0, 429/503 정상 복구, 같은 계정 PC↔모바일 팔로우 상태/카운트/목록, 이전 app379 브라우저 캐시 업그레이드. 기존 좋아요/해제 W1과 좋아요 숫자·내 좋아요 회원 상태도 실기기에서 재확인해야 함. 실사용 미검증 항목을 PASS로 보고하지 않음.
- app381 Recent/split UI hotfix는 이번 앱380에 **미포함**, 원본 git commit `79374d59f7f9d251ef73a15089d4040288fde2bb`에 보존. 신규 receipt390/098/65 global pending 조회 릴리스 미포함. 기존 069 diagnostic workflow는 문서/trigger push 후 실패 알림을 별도로 생성하나 이번 Worker/Hosting 배포 성공과는 다른 오래된 진단 작업.
- **다음 정확한 단계:** 사용자 PREVIEW PC + 모바일에서 팔로우/해제/짧은 반복 최종상태/30초 W0/W1, 좋아요·해제 상태/숫자와 캐시업데이트, CACHE LIVE 서버 물리 비용 스크린샷 확인. 비정상이나 W3+가 나오면 TEST 승격 중단하고 원인 분석; 필요 시 Worker rollback. 별도 사용자 승인 전 TEST/PRODUCTION 승격/새 D1 migration/대량변환 금지.
- `main` 고정 `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` 고정 `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`; 승격 전 재확인 필요.

---
## 0RZM. app380 팔로우 전용 PREVIEW 후보 분리·전체 집중검사 PASS — 배포 보류 (2026-10-08 KST)

- **사용자 승인 작업:** ChatGPT 직접 최소 수정. PREVIEW에만 commit/push; 배포·공유 D1/R2 실사용 데이터 변경·TEST/PRODUCTION 변경 금지.
- **작업 시작** `c9745879d6a303063004011f4f222b61ecac4a4d`; **제품·검사 후보 검증 commit** `25b84ebec75a754fcde7647b4084ec819e2df820`. 배포 전에 기준 SHA를 최신 문서 commit으로 고정할 것.
- **app381 UI 제외:** `src/components/explore/ExploreShell.tsx`와 `src/components/studio/StudioSplitEngineWorkspace.tsx`를 실제 배포 app379 기준 `aa1bac7636651fdf94598f0d5ef502955a60bc0f`와 blob exact-match로 복구. `public/app-version.json`은 **380**. app381 화면 전환 hotfix는 별도 commit `79374d59f7f9d251ef73a15089d4040288fde2bb`에 이력 보존, 이번 릴리스에는 미포함. `src/pages/ExplorePage.tsx`의 follow380 복구/묶음 코드는 **그대로 보존**.
- **좋아요/Worker 보호:** app379 `src/services/exploreLikeService.ts` exact frozen. canonical Worker도 app379 계열 대비 팔로우 함수 2개 변경/팔로우 전용 4개 함수 추가 외 **전부 동일**. `097`만 활성, 좋아요 `098`/receipt390/65 global queue replay는 릴리스 미포함. 새 공유 D1 스키마 적용 없음.
- **PREVIEW release gate:** `cloudflare-explore-preview-release.yml`의 receipt390 필수 preflight를 새 좋아요 Worker에만 적용하고, follow-only는 `verifySocialConfig380`으로 config/preflight 유지하는 분기를 정적 확인. `wrangler.preview.jsonc`은 `SORIDRAW_ENVIRONMENT=preview`, 공유 `DB=soridraw-explore-db`, `PROFILE_MEDIA=soridraw-profile-media`. 기존 배포용 trigger 파일 미변경.
- **검사 코드:** `scripts/verify-303-studio-split-browser-history.mjs`를 버전별로 분리(380은 원래 UI 보호, 381 이상은 기존 app381 UX 검사 그대로 유지). 신규 `scripts/verify-395-follow-only-release-scope.mjs`는 old UI blob equality, version380, 097-only, 390 absence, PREVIEW release gate·binding을 검증. Focused workflow에 UI/version 변경 경로와 두 검사 추가.
- **최종 GitHub CI:** `37719123137` **SUCCESS** — TypeScript PASS, Build PASS, Worker SHA/JS syntax PASS, 394 non-follow Worker/likes freeze PASS, 395 UI·version·release scope PASS, 303 legacy browser history PASS, follow354/355/356/377/386/387/389-follow-only PASS. 실제 PREVIEW Worker deploy workflow dry-run/full preflight를 실행한 것은 아님.
- **남은 검증:** 새 후보 실제 Cloudflare physical D1 W1~W2, R2 get/put 비용, 429/reload 실사용, app379→380 브라우저 캐시 업데이트, PC↔mobile 실시간 follow/unfollow, 실제 Preview Hosting+Worker active versions **미측정/미배포**. 069 legacy diagnostic push 실패는 별도 기존 문제.
- **별도 TEST/PRODUCTION 준비 blocker:** `.deploy/release-worker-runtime.mjs`는 아직 receipt390 D1 preflight를 unconditional 실행하므로, 팔로우-only로 TEST/PRODUCTION 승격 전에 별도 안전 검증/최소 수정 필요. 이번 PREVIEW 범위 밖이라 손대지 않음.
- **실배포 상태:** GitHub 마지막 확인 PREVIEW Hosting app379, 새 PREVIEW Worker/Hosting 배포 0. 사용자 데이터 원본 D1/R2/Firestore/RTDB mutation 0; main/production ref 비변경.
- **정확한 다음 단계(사용자 별도 승인 필요):** 완료 후보 exact preview SHA 고정 → PREVIEW Worker 097-only release 실 preflight/배포/rollback gate → 성공 시 Firebase PREVIEW Hosting app380만 배포(공유 RTDB Rules OFF) → 실제 주소/비용/PC·모바일 검증. TEST/PRODUCTION 승격 금지. app381 UI hotfix는 별도 승인 릴리스로 유지.

---
## 0RZL. ChatGPT 직접 구현 — app379 좋아요 동결 / app380 팔로우 전용 최소 방어 후보 완성 (2026-10-08 KST)

- 사용자 직접 지시: Codex는 사용자가 요청하거나 ChatGPT가 실제로 막힐 때만 사용. **기본 수정자는 ChatGPT**. 현재 승인 작업은 팔로우 30초 최종상태 묶음 + 반복 공격 방어만 구현·검사; 배포나 공유 D1 변경 금지.
- 기준 preview 작업 시작 `de352a5cb506e2fa0e8dea23527a48f37431dd81`; **제품/검사 후보 검증 commit `2bf0eac515947f126b26da0739907bf739c81b59`**, GitHub read-only follow-only CI Run `37718020848` **SUCCESS**.
- 배포 게이트 후속 단일 수정 `dfe531f676b6cbdf476634c1ab1e7a0f66f2b41b`: PREVIEW Worker release workflow가 like390 활성화 marker가 있을 때만 receipt390 D1 SELECT-only preflight를 실행하고, follow-only 후보에서는 environment/binding config 검증만 실행하도록 좁게 분기. **이는 PASS한 CI 이후 YAML 변경**이며 실제 PREVIEW Worker release workflow 실행/배포는 **미검증/미실행**. 배포 승인 아님.
- 좋아요: `src/services/exploreLikeService.ts`를 진짜 app379 클라이언트 `aa1bac7636651fdf94598f0d5ef502955a60bc0f`와 blob 완전 일치로 복구. canonical Worker의 다른 모든 기존 함수·비함수 문장은 app380 이전 `365e41f06c8ff169a3b762dd527498f6813d335f`와 일치하며 바뀐 함수는 `enforceFollowEdgeRateLimit355`, `handleFollowOverlay354` 단 두 곳뿐 (실행형 verifier394 PASS).
- canonical Worker/patch manifest는 follow `097`만 활성, like `098` 및 receipt390 intake/replay, 65 global queue read 없음. additive 390 스키마 후보 파일/실험 기록은 보존하되 **릴리스 대상 제외**. `SORIDRAW_ENVIRONMENT=preview` 명시해 R2 방어 누락 설정에서 정상 follow 503 되는 사고 차단.
- 팔로우 client 30초 sliding final-state, 원점 복귀 W0, outbox/리로드/미승인 재시도 폭주 방지, 선반영 UI 보존. 기존 097의 Cloudflare native limiter + 계정별/대상별 R2 조건부 제한 재사용. D1/RATE_DB 조회·쓰기 경로 추가 0. 이미 동작하는 팔로우 authority 348/354, 목록·카운트·PC↔모바일 신호 수정 0.
- focused CI PASS: TypeScript, Build, Worker SHA256 lock, JS syntax, no098/no390, app379 like exact freeze, Worker non-follow exact freeze, verify354/355/356/377/386, static 387 및 fake-clock follow 389 `--follow-only`. 전체 app380 like-specific 127/389/390/391/392/393은 **이 릴리스 대상 아님**; 구 테스트의 receipt390 필수 기대값을 실제 like 코드에 강요하지 않음.
- 비용: 격리 follow 355 fixture D1 1행 mutation/W0 duplicate 확인, live Cloudflare physical rows_written / R2 get/put 새 후보 기준 **미측정**. 사용자 이전 PREVIEW CACHE LIVE R/W는 기준 관찰일 뿐 **새 코드 실측 아님**. PC↔모바일 실제 PREVIEW 작동도 **배포 전/미검증**.
- 실제 PREVIEW 배포는 app379 유지. Firebase Hosting/Functions/Rules, Cloudflare Worker, shared D1/R2 사용자 데이터, main(TEST)/production 코드·배포 **이번 작업 변경 0**. 069 진단 workflow가 push별 별도 failure 생성 (기존 문제), 이번 focused CI PASS와 구분.
- 현재 소스에는 과거 별도 app381 Recent UI hotfix가 여전히 포함돼 있으나 이번 팔로우 범위에서 손대지 않았음. 향후 Hosting 배포 전 포함 범위를 사용자에게 사전 보고.
- **다음 게이트:** 현재 source 최종 SHA 고정 → PREVIEW Worker/Hosting 릴리스의 097-only 정적/환경/binding preflight 읽기 전용 확인 및 필요 시 독립 감사 → 사용자 승인 전 실제 preview 배포·공유 D1 적용 금지. 실사용 Preview에서 R/W·PC/mobile 확인 후에만 TEST 논의.

---
## 0RZK. 사용자 방향 재확정 — app379 보호·app380 범위 축소 / 배포 없음 (2026-10-08 KST)

- 사용자 직접 지시: 본래 목적은 팔로우 30초 최종 상태 묶음 + 공격성 반복 요청 시간 규칙으로 서버 폭증 방지. 이미 정상 작동하고 저비용인 좋아요를 다시 설계하는 것이 아니다. 기존 팔로우 비용/숫자/동기화도 보호.
- 현재 **제품 배포 PREVIEW app379** 유지. 소스 기준 preview HEAD `3e768eb2150d1fc5f51637ff9ff096ba6a5f3619`에는 복잡한 app380/381 미배포 후보가 함께 남아 있으므로 전체 배포 금지.
- **범위 제외/동결:** 신규 좋아요 receipt390 및 098, 65 global queue SQL/503, shared receipt D1 migration/activation, 새 좋아요 W2 접수 경로의 릴리스 적용. 기록된 후보 코드를 제거하거나 shared 데이터를 변경할 필요는 없다.
- **최소 작업 후보:** 30초 follow final-state, net-zero W0, 기존 즉시 UI, 서버 반복 요청의 시간/횟수 제한. 기존 팔로우 patch 097과 app379 이전 `365e41f`의 후보를 비교하여 **좋아요에 영향 없는 독립 팔로우 패치**만 선택. 현재 Worker canonical/manifest에 097+098이 함께 있어 단순 patch flag 변경이나 전체 앱380 배포는 위험하다.
- 비용 근거: 사용자 CACHE LIVE 이번 실행 스크린샷 좋아요/해제 쿼리 R0/W1, 팔로우/해제 쓰기 W1 사례. 과거 레거시 팔로우 physical R18~19/W14~17 기록과 구분하며, 새 릴리스의 실측 통과로 오인하지 않는다.
- 구현 전 최신 app379 실제 배포 아티팩트/현재 Worker/기존 방어를 확인. 기존 정상 좋아요 및 app377 팔로우 숫자·목록·PC/mobile, Music Note/Library/UX 보호. 새 DB 구조·full scan·대규모 재설계 중단.
- 다음 Codex High 범위와 합격선은 `DOCS/NEXT_CODEX_TASK.md` 최상단 ‘범위 정상화’ 참조. **이 문서 갱신은 작업 지시 정리만 완료한 것이며 제품 코드 변경, CI 실행, actual Worker/Hosting 배포, shared D1 적용·사용자 원본 데이터 변경은 없음.** 
- 다음 단계: Codex가 최소 팔로우-only 후보 구현·focused 테스트·commit 고정 → Work 독립 감사 → ChatGPT 최종 확인 → 사용자에게 PREVIEW 배포 승인 요청. 안전 분리가 안 되면 PASS 주장 금지하고 사전 보고.

---
## 0RZJ. app380 핵심 혼재 검증 PASS / 구 좋아요 회귀검사 기대값 및 단일실패 감사 루프 수정 (2026-10-08 KST)

- GitHub Run `37711245036` audit: 실제 임시 D1 W2/W0, TypeScript, Build, 릴리스 정적 안전성 및 app380 387/388 --release/389/390/391 **PASS**.
- **392 PASS**: frozen app379 old Worker receipt-less newer unlike, original receipt queue processed case, newer device, queue pending, 65 saturation 503 fail-closed, indexed reads, outbox/heart/no republishes.
- **393 PASS**: exact receipt390 additive object 3개, partial-failure cleanup, worker env/bindings, 097→098 canonical byte-match, old worker dormant schema W1/receipt access0.
- 전체 회귀 단계 `Like candidate regression, isolated only`는 오래된 `verify-135-like-fenced-protocol.mjs`가 app380에서 퇴역한 `enqueueExploreLikeBatch035` 직접 호출만 요구해 실패. 해당 테스트는 신규 390 접수 경로가 발견될 때 검증된 390 gate를 확인하되, 과거 Worker에서는 기존 queue 조건을 유지하도록 분기.
- 반복 전체 CI 실행 없이 독립 회귀 테스트들의 추가 실패를 한 번에 모으도록 **감사용 GitHub Actions 단계만** ERR trap + 실패 누적, 종료 시 fail-closed 유지로 개선. **배포용 워크플로는 변경하지 않음.**
- 주의: 이전 392의 65 global pending cap은 운영 규모에서 정상 사용 503 가능성이 높아 근본적 고가용성 해법으로 PASS 미판정. 실제 preview app379 유지. shared user D1/Hosting/Worker/main/TEST/PRODUCTION 변경 0. 비용 실측은 isolated receipt W2/W0일 뿐 mixed replay read D1 billing 아님.

## 0RZI. app380 GitHub audit 최초 핵심 검사 진입 / 392 DB mock 보완 — 미배포 (2026-10-08 KST)

- 4차 감사 `37710877493`: isolated D1 접수 W2/replay W0, TypeScript, Build, Static release-system verification **PASS**. `verify-387`, `verify-389`, `verify-388-social-abuse-runtime.mjs --release`, 390/391 receipt contract PASS.
- 실제 392 mixed old Worker 검사는 `legacyDB.DB.prepare(SELECT phase)` mock가 `sql` 속성 없는 객체를 돌려주어 `TypeError: The "sql" argument must be a string`로 중단. **제품 버그 PASS/FAIL로 오인 금지**. 393 및 나머지 like/follow 회귀검사는 이 중단으로 SKIPPED.
- 오직 `verify-392-app379-like-replay.mjs`의 bounded frozen Worker DB statement fixture를 `prepare:sql => ({ sql, params:[], bind(...) })`로 수정하여 실제 frozen old Worker의 unbound SELECT statement shape을 재현. 제품 Worker/runtime/UI 및 receipt D1 구조 변경 0.
- 4차 감사에서 배포 안전성 이전 오류와 follow354/355 obsolete fixture 오류는 더 이상 나타나지 않았다. 392/393 및 기존 좋아요·팔로우 전체 PASS를 확인하기 전까지 배포 금지.
- 실제 PREVIEW app379 유지. shared D1 데이터/마이그레이션/Worker/Hosting 적용 0, main/TEST/PRODUCTION 비변경. 전역 069 LIMIT 65 운영 위험/Cloudflare 실제 rows_read/실기기·Work 감사 미완료.

## 0RZH. app380 follow355 과거 속도제한 검사 입력 교정 / 전체 감사 대기 (2026-10-08 KST)

- GitHub audit 3차 `37710485386`: 독립 D1 W2/W0, TypeScript, Build PASS. `Static release-system verification` 단계에서 구 follow355 테스트가 새 abuse guard에 target/desired/operationId를 전달하지 않고 이전 `RATE_LIMITS.follow` 방식으로 호출해 FAIL. 이후 388/392/393 및 live read-only gate는 SKIPPED.
- 이번 변경은 기존 `verify-354-follow-orchestration.mjs` / `verify-355-follow-audit-repairs.mjs`의 **격리 VM 및 오래된 limiter 테스트 입력만** 수정. 성공·429 제한·503 장애를 새 Cloudflare native limiter contract로 검증하며, 실제 영구 R2 악용 보호는 388 --release가 담당.
- UI/Worker/Functions/실제 D1 스키마·데이터 변경 없음. 이전 2차 감사의 consumeSocialAbuse380 missing fixture를 수정한 뒤 최신 호출 인자가 빠진 다음 지점을 발견한 것. 신규 기능을 느슨하게 만들지 않음.
- 전체 릴리스 감사 및 Work 독립 감사 PASS 전 배포 금지. 069 전역 대기열 LIMIT 65 포화 시 정상 재전송 503 위험은 별도 운영 범위 문제로 남음.
- 실제 PREVIEW app379 그대로. main/TEST/PRODUCTION 비변경, shared D1 schema apply·데이터 마이그레이션·원본 쓰기 0.

## 0RZG. app380 audit-only follow354 fixture 연결 보완 / 재감사 전 배포 금지 (2026-10-08 KST)

- 감사 2차 `37710252515`: isolated D1 신규 W2/replay W0 PASS, TypeScript PASS, Build PASS. `Static release-system verification` 단계에서 기존 follow354 격리 VM에 최신 097 abuse hook `consumeSocialAbuse380`가 등록되지 않아 ReferenceError로 FAIL, 이후 388/392/393 및 live read-only gate는 SKIPPED.
- 안전 제품 코드 변경 **0**. `verify-354-follow-orchestration.mjs`의 isolated follow overlay fixture에 follow 전용 abuse hook 가짜 호출을 등록하고 UID, domain, desired, operation ID 유효성을 검증한다. 실제 R2 abuse persistence/replay/limits 동작은 별도 `verify-388-social-abuse-runtime.mjs --release`에서 독립 검사한다. 일반 Worker의 fail-closed 검증을 완화하지 않는다.
- 1차 `37709943353`의 unrelated direct-like guard baseline 비교 오류를 바로잡은 결과 해당 오류는 2차에서 재발하지 않았다.
- 현재 PREVIEW 실제 app379 유지, shared D1 apply/원본 데이터 변화/배포/TEST/PRODUCTION 변경 없음. 운영 규모에서 069 global LIMIT 65 read/replay fail-closed 위험과 최종 Work 감사는 여전히 미해결.

## 0RZF. app380 최종 GitHub 릴리스 감사 1차 실행 결과 및 감사 기준 교정 — 배포 금지 (2026-10-08 KST)

- 감사 트리거 commit `c92bb036fdb16ab11065b08881dffcd1df7bd617` / GitHub Run `37709943353`, 기준 제품 commit `b4d7e3188e8f04dc4004f55719380efcf3f6c8c8`.
- 실제 독립 임시 D1에서 receipt 신규접수 W2 / exact 재전송 W0 **PASS**. TypeScript **PASS**, Build **PASS**. 간이 정적 검사 A~E는 continue-on-error이므로 PASS 집계 근거로 삼지 않음.
- 릴리스 감사의 `Static release-system verification`에서 기존 `verify-354-follow-orchestration.mjs`가 app380의 의도된 `handleLikeD1Core` 직접 경로 차단 1줄을 unrelated-function 변경으로 잘못 판정, **FAIL**. 이 단계에서 뒤의 388/392/393 및 좋아요·팔로우 전체 회귀검사는 **SKIPPED**, PASS라 기록 금지.
- 코드 수정은 제품 로직 0. 해당 감사에서 `handleLikeD1Core`의 정확한 direct-guard 한 줄만 감사 비교 시 되돌려 baseline 전체를 비교. 098의 `handleLikeBatch034`, `enforceExploreLikeBatchEdgeRateLimit054` 2개만 독립 388/392/393 계약 검증 범위에 맡김. 나머지 unrelated 함수의 exact baseline 비교는 유지.
- 기존 069 진단 워크플로의 YAML 오류로 인한 자동 FAIL은 별개이며 이번 감사 FAIL을 가리거나 배포 승인으로 처리하지 않음.
- 이후 전체 GitHub audit 재실행 PASS 및 Work 독립 감사 필요. 특히 글로벌 069 대기열 LIMIT 65로 인한 503·실측 rows_read 운영 위험은 그대로 배포 차단 후보.
- 실제 PREVIEW app379 유지. shared D1 원본/마이그레이션, Hosting/Worker, TEST/PRODUCTION 변경 0.

## 0RZE. Work FAIL 원인 069 혼재 재전송 제한 범위 수정 — 재감사 전 미배포 (2026-10-08 KST)

- 감사 대상 `03416736780346d44372a71f5a3d95eb5c580801`에서 **Work FAIL**: receipt 없이 구 Worker가 받은 newer unlike가 새 379 replay의 receipt-only 조회에서 누락되어 하트가 이전 like로 복귀했다. 기존 392는 신 Worker끼리만 테스트했다.
- 변경 범위: replay의 069 시간순 batch_id PK 범위를 LIMIT 65(64 + overflow sentinel)로 제한해 다른 Worker가 접수한 newer pending 상태를 같은 snapshot의 기존 receipt/canonical 조회와 병합한다. 한계 도달 시 typed 503 fail closed. 사용자 UID 조건으로 전체 테이블 탐색/스캔 금지. modern acceptanceProtocol390 신규 조회 0.
- 392에 frozen Worker 040/073 receipt-less enqueue → app379 재전송 및 65행 포화 시 503 회귀검사 추가. canonical Worker와 candidate를 일치시키고 SHA256 갱신. 원본 좋아요 W2/W0 접수, 097 follow, schema390, UI·기타 구조 변경 없음.
- 후속 독립 SQL/클라이언트 smoke: 구 Worker newer unlike 및 old like queue 이미 처리된 경우 모두 결과 false·하트 false·outbox 종료·신호 재발행 0 PASS. 기존 392의 SQL SELECT 판정 정규식 오류를 바로잡고, receipt 원본 큐 처리 후에도 old unlike 보존되는 검사를 추가함. 전체 npm 검사는 여전히 미실행.
- **검증**: 격리 SQLite SQL smoke에서 newer old Worker pending unlike, newer canonical false, PK range, 65행 포화 동작 PASS. 전체 392/393, TypeScript, Build, 실기기와 Cloudflare D1 rows_read **미검증**. Work 독립 재감사와 확정된 비용/호환 확인 전 배포 금지.
- 실제 PREVIEW app379 유지. Hosting/Worker 배포, 공유 D1 schema apply·원본 사용자 데이터 변경, main/TEST/PRODUCTION 변경 모두 0. 구 035/066 큐 혼재와 과밀 시 503 발생은 남은 위험이며 live gate에서 추가 검증 필요.

## 0RZD. app380 두 release blocker 구현·검증 완료 — Work 재감사 대기 / 미배포 (2026-10-08 KST)

- 구현 시작/재확인한 remote preview HEAD: `37a7f3e299ebb3d4232a1276817f2490698c96d0` (0RZC/task 문서 포함). 제품 기준은 `b15d7d88deb17ab76b247799ed4fd5a6b12c88b4`와 같다.
- 최종 source는 **이 절을 포함하는 preview 구현 commit**. 다음 Work는 이 commit 전체를 독립 감사한다. 구현 검증 PASS를 독립 감사/배포 승인/live 검증 PASS로 표시하지 않는다.
- source app381 유지, 실제 PREVIEW app379 유지. 배포/실제 shared D1 apply/사용자 데이터 migration·backfill·rewrite·delete **0**. main/TEST/PRODUCTION 변경 0. release/Hosting/audit trigger 변경 0.

### blocker A — actual app379 replay 호환

- `098` replay에 legacy 전용 `results`를 추가한다. app379의 frozen `revision-conflict` branch로 matching operation outbox를 종료하고 personal RTDB/public invalidation을 재발행하지 않는다. revision authority가 없는 legacy relation에 revision을 합성하지 않는다.
- 결과 상태는 같은 SQL snapshot의 canonical `tracks`/`likes`/`track_stats` 및 현재 pending queue intent에서 읽는다. receipt는 bounded queue PK를 찾는 acceptance metadata로만 사용한다. receipt/R2 abuse state의 desired 값에서 membership/count를 만들지 않는다.
- app381은 batch에 `acceptanceProtocol390: 1`만 추가하여 legacy compatibility read를 생략한다. 이미 PASS한 receipt replay/ACK/deferred receiver ordering은 그대로다.
- `392`는 실제 app379 `aa1bac7636651fdf94598f0d5ef502955a60bc0f` 서비스 원문을 SHA256 고정 fixture로 실행한다. first ACK, queue pending, newer device queue, canonical applied/newer false, newer explicit undo/revision을 old/new client로 검증한다. newer device의 요청도 실제 현재 client flush에서 생성한다.
- replay D1 write **W0**, personal/public 재발행 **각 0**, matching outbox 종료/더 최신 outbox·deadline·revision·cache 보존 PASS.
- legacy replay에만 추가 SELECT **1회**: UID receipt PK 1행, receipt에 연결된 queue PK 후보/intent <=1200, 요청 track <=50, per-track canonical PK lookup. EXPLAIN에서 authority full scan 0. 기존 receipt lookup은 별도다. 이 새 read의 Cloudflare `rows_read` 과금은 실측하지 않았으며 R0으로 주장하지 않는다. modern compatibility 추가 read 0.

### blocker B — exact receipt390 activation source

- generic additive mode의 TRIGGER/VIEW 금지 계약은 그대로다. `cloudflare-explore-shared-d1-release.yml`에 전용 `receipt390` exact mode만 추가: 승인값 `user_explicit_receipt390_schema_apply`, 고정 migration/verifier 이름·git blob hash, 측정 candidate와 byte-identical SQL 검증.
- migration `20261008_01_like_intake_receipt_390_additive.sql`: 허용 객체는 receipt WITHOUT ROWID table 1개 + insert/update trigger 2개뿐. migration blob `f04d10e7a5981b1da735e266cfeeff5f46d3486e`, SQL SHA256 `9dce709548e56188cfd7906be89053a207f3b04663c4fa00ffa75d99ba099f96`.
- DDL REST batch의 atomicity를 가정하지 않는다. 각 DDL의 실행 전/후 실패·lost ACK를 SQLite에서 주입하여 새 empty dormant 객체의 reverse-order cleanup을 검증했다. preexisting partial/drifted/populated schema 또는 activated Worker는 자동 DROP 금지/FAIL로 보존한다. cleanup 자체의 원격 실패는 manual audit 대상이며 성공으로 숨기지 않는다.
- schema apply 전과 실패 cleanup 전에 세 환경의 active Worker identity/source를 검사한다. 실제 old canonical Worker 원문 hash를 고정하고 dormant receipt schema에서 frozen enqueue W1/receipt 접근 0을 실행 검증했다.
- canonical Worker에 **097 → 098** 등록·적용 완료. SHA256 `514b5cc6a412075a285c74946f62d9ccdade0ee7adff2ff2359606798211a743`. idempotence/syntax/hash 및 기존 queue processor/aggregate 등 허용된 5개 intake/guard 함수 외 baseline 함수 동일성 PASS.
- PREVIEW=`preview`, TEST=`test`, PRODUCTION=`production`을 명시적으로 고정. PROFILE_MEDIA/LIKE_RATE_LIMITER binding은 fail-closed 검증한다. 각 환경 receipt preflight는 **schema SELECT 1회만** 실행하며 자동 생성하지 않는다. TEST/PRODUCTION runtime의 restore는 새 receipt preflight에서 제외하여 이전 Worker rollback을 막지 않는다.
- schema 적용 완료 뒤 Worker smoke 실패는 이전 Worker로 rollback한다. 성공 적용한 additive schema/receipt proof는 자동 DROP/delete하지 않는다.

### 검증과 남은 gate

- PASS: 387/388/389/390/391, `388 --release`, 새 **392/393**. `388 --release`가 390/391 실행을 포함한다.
- PASS: like 127/175/176/177/178/179/180/192/197; follow 377/378/385/386. 176/178의 옛 enqueue-call assertion만 canonical receipt 경로의 acceptance/replay proof 검사로 보강했다.
- PASS: shared-D1/release-promotion/release-controller/release-command-pipeline; deploy-preflight/356 follow parity 및 관련 canonical like 102/105/107/110/156/191/210.
- PASS: TypeScript `npm run lint`, Build `npm run build -- --outDir /tmp/soridraw-app381-blockers-build`, `git diff --check`. 기존 bundle-size/dynamic import 경고만 있다. package/lockfile 변경 0.
- 추가로 실행한 historical `verify-explore-like-cost-optimization.mjs`는 기존에 삭제된 `exploreLikeDisplayStateService.ts`를 요구하여 실행 불가. 현재 canonical release/task 필수 suite가 아니며 이 task에서 옛 workflow/서비스를 복원하지 않았다.
- app381 UI owner/route/CSS 변경 0. 이미 PASS한 app303 run `37686878661`을 반복하지 않았다. 측정된 receipt SQL/JS 및 follow patch 097 byte 변경 0; 기존 W2/W0 원격 측정 증거는 0RZA 그대로다.
- branch 생성/삭제 0, Workflow 추가/삭제 0 (기존 workflow wiring만 변경). protected preview의 기존 상태는 이전 감사 기록 그대로이며 force-push/보호 설정 변경 0.
- 아직 Work 독립 재감사, 실제 PREVIEW old/new client·PC↔모바일·타계정/live 비용 검증 전이다. legacy snapshot의 pending projection은 receipt-backed queue에 한정된다. 아직 구 Worker인 TEST/PRODUCTION이 접수한 receipt 없는 pending queue와 PREVIEW의 동시 혼재는 별도 live gate에서 확인해야 하며 이번 fixture PASS로 주장하지 않는다.
- 배포 판단 후의 순서는 **별도 승인한 shared receipt390 dormant schema → PREVIEW canonical Worker → app381 Hosting**. schema workflow 성공 전에 Worker를 병행 활성화하지 않는다. 현재 task에서는 어떤 trigger도 실행하지 않았다.

## 0RZC. Work 독립 감사 FAIL — app380+381 PREVIEW 배포 차단 / legacy replay + activation wiring 수정 필요 (2026-10-08 KST)

감사 기준:
- preview HEAD: `b15d7d88deb17ab76b247799ed4fd5a6b12c88b4`
- app380 source: `7aa711af0f0f8577893298dd5d84ada4f7d857ce`
- app381 UI integration: `1857c346aa40f2f6dec0e6570d439d2514473f82`
- 실제 PREVIEW 배포본: app379 유지.

Work 판정:
- durable receipt 신규 W2 / exact replay W0 / concurrent 1 queue / rollback: PASS.
- app381 Recent exact route + 기존 Lite owner pre-paint 1회 재사용: PASS.
- UI hotfix가 app380 코드 되돌림 없음: PASS.
- **legacy/new client mixed compatibility: FAIL.**
- **실제 schema/Worker activation wiring: 미완료.**
- 따라서 PREVIEW 배포 금지 유지.

차단 원인 1 — app379 replay 응답 호환:
- 현재 098 replay 응답은 `acceptanceReplay390`/receipt proof만 주고 legacy `data.results`를 주지 않는다.
- app381 client는 이를 정상 ACK proof로 처리하지만, 실제 app379 client는 `normalizeBatchResults()`에서 실패하여 outbox를 남기고 retryCount=1로 정지한다.
- 단순히 old desired를 legacy `results`로 되돌리는 방식은 금지: app379는 이를 새 성공 ACK처럼 처리해 새 RTDB/public invalidation을 발행할 수 있어 다른 기기의 더 최신 intent를 오래된 replay가 덮을 위험이 있다.
- 다음 수정은 **app379 exact client 실행형 fixture**에서 replay가 outbox를 안전하게 종료하면서 stale personal/public signal을 새로 발행하지 않는 것을 증명해야 한다.
- receipt 자체를 membership/count/revision authority로 쓰는 것은 계속 금지.

차단 원인 2 — activation path:
- receipt SQL은 현재 `cloudflare/explore-worker/candidates/390-like-acceptance-receipt.sql` candidate-only.
- generic shared D1 additive workflow는 `TRIGGER`를 의도적으로 금지하므로 현재 schema를 실제 적용할 canonical mode가 없다.
- 097/098은 default canonical Worker release source에 아직 포함되지 않아 현재 Worker release만 실행해도 app380 guard가 활성화되지 않는다.
- canonical PREVIEW config에는 현재 `SORIDRAW_ENVIRONMENT`/`ENV_NAME`이 명시되어 있지 않아, preserved live var가 없으면 새 guard가 fail-closed로 정상 요청을 막는다.
- 실제 PREVIEW/TEST/PRODUCTION environment identity와 LIKE_RATE_LIMITER / PROFILE_MEDIA binding을 release preflight에서 명시적으로 고정·검증해야 한다.

다음 방향:
- `NEXT_CODEX_TASK.md` 최상단 focused task 하나로 legacy compatibility와 activation wiring만 좁혀서 해결.
- generic additive D1 gate를 느슨하게 만들지 않는다. receipt390 전용 exact release mode/검증 경로를 만든다.
- canonical Worker/환경 config/release source를 준비하되 **실제 shared D1 apply, Worker deploy, Hosting deploy는 하지 않는다.**
- app379/app381 혼재 verifier와 release-system verifier가 모두 PASS한 뒤 Work 재감사.
- 사용자 데이터 migration/backfill/delete/rewrite 0, TEST/PRODUCTION 배포 0.
## 0RZB. app381 UI hotfix 통합 완료 / 정적 검증 PASS / 미배포 (2026-10-08 KST)

- 기준 app380 source candidate: `7aa711af0f0f8577893298dd5d84ada4f7d857ce`.
- UI hotfix 통합 commit: `1857c346aa40f2f6dec0e6570d439d2514473f82`.
- app379 기반 격리 hotfix `79374d59f7f9d251ef73a15089d4040288fde2bb`를 통째로 merge하지 않고, 현재 app380 HEAD 위에 필요한 UI 변경만 직접 이식했다.
- app380 like/follow Worker/D1/receipt/ACK 소스는 되돌리지 않았고, 통합 commit은 UI/route/version/verifier/trigger만 변경한다.
- app version source: **381**. 실제 PREVIEW 배포본은 여전히 app379.

수정:
- `ExploreShell.tsx`: Explore의 최근 생성곡 메뉴가 `/studio`(Create)로 가던 버그를 `/studio?view=recent`로 수정.
- `StudioSplitEngineWorkspace.tsx`: Create 또는 Music Note에서 Recent로 전환할 때 이전 workspace geometry가 한 프레임 남는 문제를, 기존 Lite V2 `soridraw-studio-frame-resize` owner를 layout phase에서 1회 재사용하는 방식으로 수정. 새 geometry owner/per-frame listener/page 전용 split engine 없음.
- 분할바 크기/위치/드래그/반응형 threshold/CSS 변경 0.

정적 검증:
- GitHub Actions `Verify app303 Split Browser History` run **37686878661 SUCCESS**.
- Recent exact route verifier PASS.
- workspace pre-paint geometry reconciliation verifier PASS.
- TypeScript PASS.
- Build PASS.
- Worker/Functions/Rules/D1/user data 변경 0.
- main/TEST/PRODUCTION 변경 0.

남은 gate:
- app380+381 통합 source는 아직 PREVIEW에 배포하지 않았다.
- app380 문서에 남은 **Work 독립 감사** 및 Worker/schema/client 활성화 순서 검토가 먼저다.
- PREVIEW 배포 후 실제 PC에서 ① Music Note→Recent 겹침 ② Create→Recent 폭 축소 플래시 ③ Explore→Recent exact 이동을 실사용 검증한다.
- 모바일/태블릿은 이 hotfix가 compact mobile path를 건드리지 않지만, 최종 PREVIEW에서 기본 회귀 확인 전 PASS로 표시하지 않는다.

## 0RZA. app380 focused receipt/ACK 구현·최종 검증 완료 — 미배포 (2026-10-08 KST)

- 이번 재개 기준: `d25890f68e8acd15b8f619e5326d4bb5292a233c`. 기존 `33663e9e` receipt 후보와 `d25890f6` D1-compatible fence를 그대로 사용했다. 최종 결과는 이 절을 갱신한 preview commit 기준이다.
- **source candidate 완료**: `verify-388-social-abuse-runtime.mjs --release` PASS. 과거 429-only replay blocker 제거. Work 독립 감사/실기기 PREVIEW gate 또는 배포 승인까지 완료했다는 뜻은 아니다.
- PREVIEW 실제 배포는 app379 유지. Worker/Hosting/Functions/Rules 배포 0, shared PREVIEW/TEST/PRODUCTION schema·사용자 데이터 변경 0. main/TEST/PRODUCTION 변경 0. UI hotfix `79374d59f7f9d251ef73a15089d4040288fde2bb` 병합 0; UI/CSS 변경 0.

### 원격 Cloudflare D1 실측 — 실제 과금 메타데이터

- 증거: [run 37649466762, like-receipt job 112888698709 — SUCCESS](https://github.com/andrawing1212/soridraw-music/actions/runs/37649466762/job/112888698709).
- 측정 소스 `d25890f6`. 최종 candidate의 `390-like-acceptance-receipt.sql` 및 `like-acceptance-390.js`는 이 측정 소스와 **동일**하다. 이미 확인한 구조를 재생성/반복 측정하지 않았다.
- owned ephemeral DB `soridraw-like-receipt-390-37649466762-1`만 생성·사용했고 `390_EPHEMERAL_D1_DELETED=PASS` 확인. shared DB 바인딩/쓰기 없음.
- 실제 `meta.rows_written`: new batch **2**; ACK-loss exact replay **0**; 처리 후 queue row 삭제 뒤 replay **0**; trackId/liked/expectedRevision/mutationAt payload conflict 각각 **0**; partial-batch conflict **0**.
- concurrent same batch 두 요청 합계 **2**, inserted 1 / replay 1, queue row **1**.
- fence closed: 신규 receipt INSERT와 기존 receipt UPDATE 모두 queue와 함께 rollback. queue INSERT collision도 receipt 없음. 오류 응답에는 billing meta가 없으므로 오류의 과금 수치를 만들지 않고 **durable 잔존 row 0 / 기존 receipt 원상 보존**으로 검증했다.
- proof eviction 후 동일 오래된 payload replay **0** reject, 이후 새 명시적 operation **2**로 정상 접수. 로컬 최종 검사는 1200 identity 상한과 만료 뒤 회복도 확인.
- 위 run의 별도 `audit` job은 당시 미통합 소스의 기존 release blocker로 FAIL했다. **전체 과거 run을 PASS로 표시하지 않는다.** 이번 최종 소스 검증 결과는 아래와 같다.

### 최종 변경

- `098-like-abuse-guard.mjs`: stable payload validation → durable receipt lookup → 새 요청만 기존 abuse guard → atomic receipt/queue acceptance. R2 reservation은 acceptance authority가 아니며, reservation 이후 D1 전 장애는 같은 operation으로 실제 접수 재시도 가능.
- UID당 WITHOUT ROWID receipt 1행, secondary index 0, 최근 identity 최대 1200개/JSON 600000자. deterministic digest는 UID + sorted operationId/trackId/desired/expectedRevision/mutationAt. 보존 중 동일 operation payload 변경은 conflict/W0. 만료되어 proof가 사라진 **동일 payload**는 timestamp admission 경계에서 W0 fail-closed; 무제한 operation-ID 이력 보관은 주장하지 않는다.
- receipt UPSERT + AFTER trigger queue INSERT 한 SQL 문장으로 W2/원자성 유지. canonical Worker/queue processor/aggregate 및 기본 `release-patches.json` 변경 0. 실제 schema 적용 0.
- replay 응답은 accepted operation IDs와 원래 acceptedAt만 전달한다. receipt에서 membership/count/revision을 합성하거나 오래된 personal R2 delta를 다시 쓰지 않는다. queue scheduler가 기존 durable intake를 이어갈 수 있도록 queued/batchId는 유지한다.
- `exploreLikeService.ts`: receipt replay는 일치한 outbox만 완료하고 오래된 desired를 새 확정/공개 신호로 발행하지 않는다. newer intent/deadline/revision 보존. 대기 중 수신되어 건너뛴 최신 기기 신호는 기존 outbox 안에 1행만 보관하며, receipt 이후 최신 신호만 기존 persist-before-UI 수신 경로로 적용한다. 새 server read/write/listener 또는 cache key/epoch 없음.
- 만료 proof는 자동으로 재전송하지 않는다. 새 명시적 undo가 기존 ACK 유실 전 baseline과 net-zero로 잘못 제거되지 않도록 기존 in-flight rebase helper를 사용한다. 429/RATE_LIMITED와 ambiguous network failure 구분, 실패 outbox의 idle/navigation 자동 재시도 금지, 30초 batching/net-zero 유지.
- supported app160/app164 batch request 필드로 generated handler 200/legacy-queued 호환 검증. 이전 per-track direct route의 refresh-required 방어는 유지. 후속 실제 활성화 전 구버전/신버전 혼재 및 receipt-aware app380 rollout은 Work/live gate에서 확인한다.

### 최종 검증

- PASS: 387, 389, **388 --release** (388 기본 검사 + 390 receipt/상한·만료 + 391 실제 client ACK/receiver ordering 포함).
- PASS: like 127/175/176/177/178/179/180/192/197; follow 377/378 및 app379의 385/386.
- PASS: TypeScript `npm run lint`; Build `npm run build -- --outDir /tmp/soridraw-app380-final-build` (기존 bundle-size 경고만).
- PASS: release-promotion-system / release-controller / release-command-pipeline / shared-d1-release-system; patch idempotence/generated Worker syntax/frozen Worker 함수 보존; `git diff --check`.
- 최종 묶음 실행에서 127의 기존 단일-line `continue` static assertion만 새 deferred block에 맞춰 보강 후 해당 verifier만 재확인했다. 나머지 이미 PASS한 전체 test/build는 반복하지 않았다.
- 변경 파일: `cloudflare/explore-worker/candidates/social-abuse-380.js`, `cloudflare/explore-worker/patches/098-like-abuse-guard.mjs`, `src/services/exploreLikeService.ts`, `scripts/verify-{127,175,180,388,390,391}-*.mjs`, 이 문서.
- 이번 재개에서 branch 생성/삭제 0, Workflow 추가/삭제 0. 기존 로컬 `work` 보존. GitHub preview HEAD/protected=true 확인; 관리 권한이 필요한 force-push 세부 설정은 변경하거나 재인증하지 않았다.
- 남은 gate: Work 독립 감사, 실제 PC↔모바일 및 구버전 혼재 PREVIEW live 검증, 별도 승인된 additive schema/Worker/client 활성화 순서. **이번 task에서 배포하지 않는다.**

## 0RZ. ChatGPT 검토 — app380 1차 commit 확인 / 좋아요 replay blocker 실재 / W2 receipt 방향 확정 (2026-10-08 KST)

검토 대상:
- preview `3ea51da5641e7c5bcf8668be6d9414d319a6964e`
- base `ae68e3dc21f4bacab16a6d3536f097aed8357481`
- 14 files 변경, 배포 0.

판정:
- Codex가 구현 실패를 숨기지 않고 release verifier를 의도적으로 FAIL시킨 판단은 맞다.
- follow380 30초 final-state 및 progressive abuse candidate, like/follow 환경분리 R2 guard, 429 retry 보호는 source candidate로 유지.
- 하지만 현재 like guard는 동일 accepted operation replay를 429/W0로 막기만 하므로 **정상 ACK 유실 재시도까지 보존하지 못한다.**
- 따라서 app380은 아직 PREVIEW 배포 불가.

다음 설계 결정:
- 기존 timestamped/deleted W1 queue만으로는 처리 완료 후 동일 operation의 durable acceptance proof가 사라지므로 안전한 성공 replay W0를 보장하기 어렵다.
- 정상 기능을 희생해 W1을 유지하지 않는다.
- 사용자 hard gate가 W1~W2이므로 다음 후보는 **기존 queue W1 + bounded durable acceptance receipt W1 = 정상 새 batch 최대 W2**, exact accepted replay W0를 목표로 한다.
- acceptance receipt는 membership/count authority가 아니며 R2 abuse receipt와 분리.
- 실제 shared D1 schema apply는 하지 않고 candidate additive schema + remote ephemeral D1 실측만 수행한다.
- 상세 구현/중단 조건은 `NEXT_CODEX_TASK.md` 맨 위 focused task 기준.

현재 실제 환경:
- PREVIEW 배포본 app379 유지.
- Worker/Hosting/Functions/Rules 변경 0.
- main/TEST/PRODUCTION 변경 0.
- 사용자 원본 데이터 변경 0.

## 0RY. app380 통합 방어 source candidate / 좋아요 정상 replay 계약 BLOCKED / 배포 0 (2026-10-08 KST)

작업:
- branch: `preview`; 기준 SHA `ae68e3dc21f4bacab16a6d3536f097aed8357481`.
- `AGENTS.md` → 이 문서 → `NEXT_CODEX_TASK.md`의 app380 지시 및 like freeze 참조를 확인하고 후보 구현/로컬 검증.
- **전체 task 완료·PREVIEW 배포 가능 판정 아님.** 아래 좋아요 정상 재전송 blocker가 남는다.
- source app version 380; 실제 배포는 기존 app379 유지. Worker/Hosting/Functions/Rules 배포 0.

구현한 범위:
- follow380 30초 sliding timer/outbox 유지. page-exit flush no-op, 재진입 시 기존 deadline 보존, in-flight 새 클릭은 마지막 클릭 +30초 유지.
- 429 Retry-After를 최대 24시간까지 보존. 자동 재시도 1회 후 다시 거부되면 최신 pair intent를 suspended 상태로 보존하며 reload로 예산을 초기화하지 않음. 명시적 새 클릭만 다시 활성화.
- follow ordered protocol은 명백한 RATE_LIMITED의 이전 operation만 버려 최신 desired를 재시도할 때 거부됐던 반대 방향을 먼저 보내지 않음. 일반 ambiguous error 경로는 그대로 유지.
- like client는 code/status/retryAfterMs만 추가하고, 명백한 429가 전송 중 새 클릭의 canonical baseline으로 잘못 rebase되는 것만 차단. 기존 failed-outbox 자동 재시도 금지 유지.
- `097-follow-abuse-guard.mjs` + 신규 `098-like-abuse-guard.mjs`는 candidate-only. 공통 구현은 `candidates/social-abuse-380.js`.
- follow: 30s/2m/10m/1h, quiet reset 24h, rolling 10m 30 / 24h 120.
- like: 30s/1m/5m/30m, quiet reset 6h, rolling 10m 120 / 24h 600 normalized unique track final intents. batch max50, 기존 `like:<uid>` 60/min edge limiter 유지.
- R2 키 `internal/explore/abuse/<preview|test|production>/<follow|like>/<uid>.json`로 환경·도메인 분리. `SORIDRAW_ENVIRONMENT || ENV_NAME` 미확정은 fail-closed.
- 계정/도메인당 bounded 1 object; quiet prune/LRU, rolling events 및 최근 24h operation receipt 상한. ETag CAS 최대6회. 손상·누락 binding·R2/limiter 장애는 D1 전 차단.
- malformed/unordered follow는 대상 D1 lookup 전에 409. like malformed operation은 D1 전에 400.
- 구형 direct like endpoint가 batch guard/W1 queue를 우회하지 않도록 candidate에서 refresh-required 409로 차단. 현재 client는 기존 batch route 사용. 구버전 호환 영향은 독립 감사 대상.
- canonical Worker/entry, shared schema/control/cutover, 기본 `release-patches.json`, 모든 release trigger 수정 0.
- 새 Workflow 추가/삭제 0. 기존 release-system audit의 격리 후보 검사만 보강.

**남은 구현 blocker — 좋아요 성공 응답 재전송과 W0:**
- 실제 `exploreLikeW1Batch040`의 queue ID는 서버 receive timestamp를 포함한다. `processExploreLikeAggregateWave035`는 처리한 queue row를 삭제한다.
- 따라서 기존 queue를 그대로 유지하면서 동일 operation을 다시 통과시키면 새 queue write가 발생할 수 있다. 반대로 abuse receipt만 보고 성공/개인 membership ACK를 만들면 operational state를 사용자 authority로 오용한다.
- 현재 안전 후보는 같은 desired 요청을 pair quiet window 내, 같은 operation을 receipt 보존 24h 내 **429/W0로 거부**한다. receipt는 canonical 성공을 보증하지 않으므로 성공 ACK를 합성하지 않는다.
- 이 방식은 악성 반복의 canonical W0는 지키지만, 첫 요청이 guard 이후 D1 전 실패했거나 ACK가 유실된 정상 재시도를 지연시킬 수 있다. 따라서 **정상 retry/idempotency 보존까지 PASS라고 보고하지 않는다.** 보존 기간 밖 무제한 replay W0도 주장하지 않는다.
- `verify-388-social-abuse-runtime.mjs --release`는 이 실제 429 재현 결과로 **의도적으로 FAIL**한다. release-system audit도 같은 명령을 사용하므로 false-green 없음.
- 완료하려면 frozen W1 queue를 유지하면서 canonical 접수/처리 완료를 판별할 영속 operation receipt와 안전한 retry 계약을 먼저 설계해야 한다. 이를 abuse counter에 섞거나 정상 좋아요 상태기를 임의로 교체하지 않았다.
- Work 독립 감사에서 이 제약과 구형 direct-route 호환 영향을 먼저 검토. **성공 replay 계약을 해결하기 전 새 abuse patch 등록/배포 금지.**

검증:
- TypeScript `npm run lint`: PASS.
- Vite production build: PASS; 기존 chunk size / mixed dynamic-static import 경고만 존재.
- 기존 like regressions 127/175/176/177/178/179/180/192/197: PASS. app164 신규 공개곡 첫 좋아요, app160 개인/공용/수신 순서 보호.
- follow 347/348/349/350/351/352/354/355/356/378 및 app377/app378/app379(377/385/386): PASS.
- app379 verifier는 이전 app380 후보가 바꾼 변수명에 맞추되 exact local count/delta/no stale server counter assertion 유지.
- 387 static + 신규 388 runtime/389 fake clock: PASS (안전 후보 검사).
- 388은 실제 patch 재생·문법·idempotence, 변경 허용 외 canonical 함수 byte equality, 실제 queue intake 함수의 SQLite 각 W1, unique normalization, pair escalation/quiet reset, window/day cap, 환경·도메인 격리, CAS 동시성, 장애/malformed/blocked D1 R0/W0를 검사.
- 389는 follow net-zero/last-click deadline/inflight/reload/429 retry budget, like 기존 flush의 net-zero 및 deterministic 429 false-rebase 방지, ordered follow 최신 intent만 재시도를 실행.
- **388 --release: FAIL / 위 정상 replay blocker. 이는 해결 전 task 완료 또는 릴리스 PASS로 바꿀 수 없음.**

비용 구분:
- 신규 abuse guard 자체: canonical D1/RATE_DB R0/W0; 정상 새 batch account R2 get1 + conditional put1, 거부/duplicate는 보통 get1/put0. CAS 충돌은 최대6회 bounded.
- 기존 like interactive queue 함수 SQLite fixture: like/unlike 각 logical row W1. background aggregate의 전체 lifecycle 비용/Cloudflare physical billing까지 W1이라고 주장하지 않음.
- follow canonical ordered protocol/writer는 그대로이며 기존 local SQLite 및 회귀 근거 유지. 새 live physical W1~W2 측정은 실행하지 않음.
- net-zero client window: Worker/D1/R2 canonical mutation 0.

PRODUCTION-first/남은 검증:
- shared DB/PROFILE_MEDIA authority는 그대로; abuse namespace만 환경별 분리.
- 저장소의 preview wrangler vars에는 환경 identity가 명시되어 있지 않음. 실제 preserved live vars는 미확인. 향후 배포 전 세 환경의 `SORIDRAW_ENVIRONMENT` 또는 `ENV_NAME`, LIKE_RATE_LIMITER, PROFILE_MEDIA identity를 read-only 확인해야 함. 추측한 namespace fallback 금지.
- 기존 캐시 업그레이드: product cache key/epoch 초기화 없음. follow outbox 새 retry 필드는 기존 레코드에서 false 기본값. 정상 빈 outbox 재진입 write0.
- live PREVIEW physical like/follow W1~W2, blocked W0, PC↔mobile membership/count, Following popup/My Likes/Explore R0는 미실행.
- 원격 branch protection 조회는 환경 API 접근에서 Forbidden; 보호 상태 미확인으로 기록. 이를 보호 PASS로 보고하지 않음.
- 사용자 D1/Firestore/RTDB/R2 원본 mutation/migration/backfill/delete/rewrite 0; main/production 코드/배포 변경 0.
- 로컬 `preview` 체크아웃만 생성. 기존 `work`는 이전 main 기준으로 보존; 임시 원격 branch 생성/삭제 및 미병합 branch 정리 없음.

## 0RX. 좋아요 + 팔로우 최종상태 묶음/악성 반복 방어 통합 설계 승인 / 구현 handoff (2026-10-07 KST)

사용자 결정:
- 좋아요와 팔로우 모두 정상 UX는 **로컬 즉시 → 마지막 클릭 기준 30초 → 최종 상태만 서버 반영**으로 통일.
- 기능별 정상 사용 빈도에 맞춰 서버 abuse threshold는 분리.
- 좋아요의 기존 app164/app160 정상 기능은 재설계하지 않고 서버 방어층만 additive로 보강.
- 팔로우는 현재 preview HEAD의 app380 후보를 이어서 완성.

GitHub 확인:
- deployed PREVIEW는 app379.
- design handoff 시 preview HEAD `365e41f06c8ff169a3b762dd527498f6813d335f`.
- HEAD의 follow380 candidate는 미배포.
- `097-follow-abuse-guard.mjs`는 default Worker release manifest에서 제외돼 있어 우발 배포 차단 상태.
- 좋아요는 이미 30초 final-state outbox + net-zero W0 + W1 queue + `like:<uid>` Cloudflare 60/min edge limiter가 존재.

확정 정책:
- follow: 30초 final-state; same-target escalation 30s→2m→10m→1h; 10m 30 / day 120; quiet reset 24h.
- like: 기존 30초 final-state 보호; same-track escalation 30s→1m→5m→30m; 10m 120 normalized final intents / day 600; quiet reset 6h.
- same desired / duplicate / operation replay는 canonical W0.
- abuse guard는 D1 전에 차단. D1 rate-limit receipt 금지.
- accepted user mutation physical D1 W1~W2만 PASS, W3+ FAIL.
- abuse state는 environment-scoped R2 internal state로만 저장하며 PREVIEW/TEST/PRODUCTION cooldown state를 섞지 않는다.
- normal page entry/re-entry/navigation은 write 0, healthy cache D1 R0 목표 유지.

중요 추가 발견:
- 현재 follow380 candidate의 R2 abuse receipt가 shared `PROFILE_MEDIA`를 사용할 수 있으므로 **환경 prefix 없는 key는 금지**.
- implementation에서 `SORIDRAW_ENVIRONMENT || ENV_NAME` 기반 namespace를 강제하고 environment 미확정 시 fail-closed.
- 좋아요/팔로우 abuse state는 서로 quota/state를 공유하지 않는다.

다음:
- `DOCS/NEXT_CODEX_TASK.md`의 CURRENT IMPLEMENTATION TASK 기준으로 Codex High 구현.
- Codex는 배포 금지.
- 구현 commit 고정 → Work 독립 감사 → ChatGPT 최종 확인 → 안전할 때 PREVIEW 배포.
- main/TEST/PRODUCTION 및 사용자 원본 데이터 변경 금지.

## 0RW. app379 PREVIEW 팔로우 후 MY 프로필 팔로워/팔로잉 숫자 0 오염 수정 완료 (2026-10-07 KST)

사용자 발견 증상:
- follow/unfollow 직후 MY 공개프로필 상단 `팔로잉` 숫자가 실제 2명이어도 0으로 표시됨.
- 팔로잉 팝업 목록 자체는 실제 membership 2명을 정상 표시.
- 팝업을 열어 exact list count가 계산된 뒤에야 상단 숫자가 다시 2로 복구.
- 같은 계열 오류가 follower/following 양쪽 social count에 재발할 수 있는지 감사 요청.

원인:
- shared follow authority는 이미 `overlay348 active`로 전환되어 legacy D1 relation/profile counter writer가 freeze된 상태.
- Worker compatibility follow response는 여전히 legacy `profile_stats` 계열 값
  - target `followerCount`
  - target `followingCount`
  - actor `actorFollowingCount`
  를 반환.
- app377/378 client가 follow mutation 성공 뒤 이 compatibility count를 public-profile persistent cache의 exact 값처럼 덮어써서 stale 0이 MY profile에 저장됨.
- 팔로우 목록 팝업은 effective overlay membership을 읽으므로 목록은 맞고, complete list를 열었을 때만 `items.length`로 상단 count가 self-heal되어 증상이 사라졌던 것.
- 즉 membership/실시간 sync 문제가 아니라 **새 overlay authority와 옛 compatibility counter를 UI authority로 혼용한 문제**.

app379 수정:
- `src/services/exploreSocialService.ts`
  - complete persistent Followers/Following page의 exact local count reader 추가.
  - complete personal follow bundle의 exact Following count reader 추가.
  - mutation/signal 처리 전 previous membership local reader 추가.
  - 서버 추가 요청 없음.
- `src/pages/ExplorePage.tsx`
  - actor MY `followingCount`: complete local Following list 또는 complete personal follow bundle을 우선 exact authority로 사용.
  - exact local list가 없으면 기존 MY cached count + 실제 relation delta만 사용.
  - target `followerCount`: 현재 target profile count + confirmed relation delta로 계산.
  - target `followingCount`: 다른 사용자가 follow/unfollow해도 변하면 안 되므로 기존 값 그대로 보호.
  - Worker mutation response의 stale `result.followerCount/result.followingCount/result.actorFollowingCount`를 public-profile count authority로 직접 덮어쓰지 않음.
  - same-account PC↔mobile RTDB signal 수신 시에도 각 기기의 local exact relation cache를 우선해 count를 재결정.
  - MY profile 진입/재검증 시 complete local Followers/Following cache가 있으면 상단 두 숫자를 즉시 local exact 값으로 self-heal.
  - 프로필 편집 저장은 social relation을 바꾸지 않으므로 기존 exact follower/following 숫자를 보존.
- 기존 tiny RTDB follow signal schema/Rules 변경 없음.
- Worker/D1 schema/Functions/UI 디자인 변경 없음.
- 추가 D1 read/write 없음.
- 앱 버전 **379**.

검증/배포:
- source commits:
  - exact local count helpers `f980ac25780c14841f1f1a4d7212b43e89b7053c`
  - cached membership helper `f11b93ea70f6531dd1c016065f591693b6fbede1`
  - follow count authority fix `69d1cd49823710ccdaeff3f970bbeb6b7e6bdb06`
  - refresh/edit count protection `8df4c018d295b6cfbcb98403a96c7f95646a3b32`
  - verifier `63d2dad8fb8e3385e7083fa99db58c5fb1f57ed1`
  - app379 version `3c9409d2c47bc12d47c19702a28ff51fbc9492e7`
  - release workflow gate `db5788d79540fabe0aa6baf56f07d3573e804331`
  - PREVIEW release trigger `aa1bac7636651fdf94598f0d5ef502955a60bc0f`.
- Firebase PREVIEW Run `37599728937`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- app358/app359/app360/app361 regression PASS.
- app377 follow regression PASS.
- app378 Following R0 regression PASS.
- app379:
  - `APP379_OVERLAY_LEGACY_COUNTERS_NOT_UI_AUTHORITY=PASS`
  - `APP379_OWN_FOLLOWING_COUNT_LOCAL_EXACT=PASS`
  - `APP379_OWN_FOLLOWER_COUNT_LOCAL_EXACT_WHEN_CACHED=PASS`
  - `APP379_TARGET_FOLLOWER_COUNT_DELTA=PASS`
  - `APP379_TARGET_FOLLOWING_COUNT_PRESERVED=PASS`
  - `APP379_CROSS_DEVICE_COUNT_RECONCILIATION=PASS`
  - `APP379_NO_EXTRA_SERVER_READ_FOR_COUNT_FIX=PASS`
- Shared RTDB Rules deploy: SKIPPED.
- Firebase PREVIEW Hosting: PASS.
- `preview.soridraw.com`: app379 / exact build PASS.
- TEST / PRODUCTION unchanged PASS.

실사용 확인 gate:
1. MY profile에서 현재 follower/following 숫자 확인.
2. 다른 프로필 follow 1회 → MY profile로 즉시 이동.
   - MY follower 숫자는 그대로.
   - MY following 숫자만 +1.
3. 같은 프로필 unfollow → MY profile로 즉시 이동.
   - MY follower 숫자는 그대로.
   - MY following 숫자만 -1.
4. target profile에서는 follow 시 follower +1 / unfollow 시 -1, target following 숫자는 불변.
5. 팝업을 열지 않아도 상단 숫자가 바로 맞아야 함.
6. 팝업 재오픈은 기존 app378 기준 Worker0 / D1 R0 유지.
7. PC↔mobile 실시간 숫자/membership 수렴 유지 확인.

## 0RV. app378 사용자 실기기 Following R0 최종 확인 PASS (2026-10-07 KST)

사용자 재검증 결과:
- 모바일 app378 업데이트 직후 최초 팔로잉 목록: D1 query R2 / row R11 / W0.
  - 이전 app377에서 이미 지워진 cache가 없는 상태의 최초 bounded hydration으로 판단.
- PC 같은 시점 팔로잉 목록: R0/W0 확인.
- 이후 PC에서 unfollow:
  - 초기 진단은 follow-state 확인 R1/W0 등이 먼저 표시되고,
  - 약 2~3초 뒤 canonical follow mutation 누적이 반영되어 최종 W1로 수렴.
- 이후 PC에서 follow:
  - D1 query R2 / row R10 / W1.
- 마지막 팔로잉 목록 재오픈:
  - `팔로우 목록 캐시 · LOCAL 3 · Worker 0`
  - D1 query R0 / W0
  - row R0 / W0
  - 공개프로필/curated도 LOCAL / Worker0 / D1 R0.
- 즉 **실제 relation 변경 후 Following 목록 재오픈 R0 목표 달성**.
- PC↔mobile 실시간 동기화는 이전 사용자 검증에서 정상이며 이번 수정으로 깨지지 않음.

판정:
- 업데이트/재진입 때문에 반복되는 Following 목록 D1 폭증 문제: **해결 PASS**.
- 실제 follow/unfollow mutation은 변경 시에만 bounded server 사용:
  - W1 확인.
  - read는 R1~R2 수준의 실제 mutation/상태확인 경로이며 사용자 수/앱 업데이트에 비례해 자동 반복되는 목록 read가 아님.
- 이 범위에서는 추가 최적화보다 현재 기능/동기화 안정성 보호를 우선. follow cost gate 완료 처리.
- app378 추가 코드 수정/재배포 필요 없음.
- TEST/PRODUCTION 추가 승격 없음.

## 0RU. app378 PREVIEW 팔로잉 목록 업데이트/재진입 R0 보강 배포 완료 (2026-10-07 KST)

사용자 실기기 결과:
- follow/unfollow 실시간 PC↔mobile 동기화 정상 PASS.
- 실제 follow/unfollow mutation은 CACHE LIVE에서 D1 write **W1~W2 범위** 확인.
- 다만 관계 변경 뒤 팔로잉 목록을 다시 열 때 mobile/PC에서 bounded list D1 read가 재발:
  - 사용자 캡처 예: D1 query R5 / row R12, D1 query R2 / row R11.
- 원인 확인: 앱 버전 업데이트 자체가 product localStorage를 비우는 것이 아니라, 실제 follow/unfollow 변경 시 viewer의 persistent Following page를 통째로 invalidate하던 app377 changed-only 경로 때문에 다음 목록 확인이 cold read로 바뀜.
- `appUpdateNotice.ts`는 product persistent cache를 clear하지 않으며 기존 `verify-217-cache-live-update-reset.mjs` 계약 유지.

app378 수정:
- `src/services/exploreSocialService.ts`
  - 이미 한 번 받은 viewer Following first page가 있으면 follow/unfollow 1건 변경을 해당 로컬 page에 직접 반영.
  - unfollow 시 제거되는 target card의 compact seed를 기기에 보존하여, 같은 관계를 다시 follow해도 서버 목록 재조회 없이 first page를 복원.
  - 안전하게 patch할 기존 page/seed가 없는 진짜 cold device/cache-missing 상황만 기존 bounded server recovery 허용.
  - target account의 Followers page는 actor card authority가 없으므로 기존 changed-only invalidation 유지.
- RTDB follow signal 구조/Rules는 변경하지 않음. 기존 tiny UID-scoped count/relation signal 유지.
- Worker/D1 schema/Functions/UI 변경 없음.
- 앱 버전 **378**.

검증/배포:
- 최초 release Run `37596276504`: 제품 TypeScript/Build 및 app377 검증 PASS 후 신규 verifier의 주석 문자열 false-positive로 중단. Firebase 배포 전 중단되어 실제 Hosting 변경 0.
- verifier false-positive 수정 commit `4b0bb0d2c22e14a3335fea470c25f97755ec5114`.
- 최종 PREVIEW release trigger/source commit `a132e92abd816443dd30bf83053202b959866b14`.
- Firebase PREVIEW Run `37596588786`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- app358 / app359 / app360 / app361 regression PASS.
- app377 follow count/list/cross-device regression PASS.
- app378:
  - `APP378_FOLLOW_MUTATION_PATCHES_CACHED_FOLLOWING_PAGE=PASS`
  - `APP378_FOLLOW_TOGGLE_CARD_SEED_PERSISTS=PASS`
  - `APP378_APP_UPDATE_DOES_NOT_INVALIDATE_CONNECTION_CACHE=PASS`
  - `APP378_FOLLOW_RTDB_SIGNAL_REMAINS_TINY=PASS`
  - `APP378_UNCHANGED_REOPEN_TARGET=WORKER0_D1_R0`
- Shared RTDB Rules deploy: **SKIPPED**.
- Firebase PREVIEW Hosting: PASS.
- `preview.soridraw.com`: app **378** / exact build PASS.
- TEST / PRODUCTION unchanged PASS.

데이터/비용:
- user data migration/backfill/delete/rewrite/copy 0.
- follow shared overlay authority는 기존 active 상태 유지.
- app378 자체 D1/Worker mutation 0.
- 목표:
  - 실제 follow/unfollow: 기존 확인 W1~W2 유지.
  - 한번 hydrate된 Following 목록의 관계 변경 후 재오픈: Worker0 / D1 R0.
  - 단순 앱 업데이트/새로고침/재진입: 기존 persistent page가 있으면 Worker0 / D1 R0.
  - 새 기기·브라우저 저장소 삭제·해당 목록을 한 번도 연 적 없는 진짜 cold cache는 최초 bounded read 1회 허용.

실사용 재검증:
1. app378 적용 후 각 기기에서 기존 팔로잉 목록을 한 번 열어 cache를 확보.
2. follow → unfollow 또는 unfollow → follow 수행.
3. 목록을 다시 열어 CACHE LIVE가 `팔로잉 목록 캐시 · LOCAL 1 · Worker 0 · D1 R0/W0`인지 확인.
4. 새로고침 또는 다음 앱 업데이트 뒤에도 동일 cache가 남아 D1 R0인지 확인.
5. PC↔mobile 실시간 동기화가 그대로 즉시 동작하는지 재확인.
6. 진짜 cold device에서 최초 1회 read는 정상이며, 그 다음 변경 없는 재진입은 R0이어야 함.

## 0RT. follow shared authority Phase A+B 활성화 완료 / 실제 live mutation 비용 측정 대기 (2026-10-07 KST)

완료:
- app377 Hosting/앱 코드는 그대로 유지하면서 follow authority lifecycle만 전 환경에 수렴.
- Lifecycle resume Run `37592392310`: **SUCCESS**.
- PREVIEW Explore Worker lifecycle=1: `61f1fa6e-ef93-478b-b06f-4a64e3e337d9`.
- TEST Explore Worker lifecycle=1: `bc01f091-b9e6-43b7-ac82-73385ea24e52`.
- PRODUCTION Explore Worker lifecycle=1: `4d82f107-ae7e-4985-b955-8c889807c888`.
- TEST public-profile cold retry에서 일시 D1 R2가 있었지만 attempt=2 warm parity에서 D1 R0로 수렴했고 Release PASS.
- PRODUCTION environment parity는 attempt=1 PASS.

Shared authority cutover:
- Phase A one-way readonly latch Run `37589232698`: SUCCESS.
- Phase B active overlay Run `37592857479`: **SUCCESS**.
- D1 `explore_follow_cutover_control_348`: `phase=overlay`.
- one-way cutover token: `follow-w1w2-37589232698-1`.
- shared R2 manifest `internal/explore/follow-cutover-v348/active.json`:
  - `relationMode=overlay348`
  - `writeMode=active`
  - `oneWayAuthority348=true`
- activation 직전/직후 `explore_follow_overrides_348` user rows = **0**.
- activation 과정 legacy relation/profile user-row write = **0**.
- user migration/backfill/delete/rewrite/copy = **0**.
- TEST/PRODUCTION latest/popular/curated/public-profile parity PASS.
- TEST Worker verify PASS / PRODUCTION Worker verify PASS.
- active overlay 검증 실패 시 shared manifest를 `overlay348-readonly`로 되돌려 새 mutation만 fail-closed 하는 안전 경로 유지.
- legacy authority로 자동 fallback하는 경로는 one-way latch 이후 금지.

현재 중요한 상태:
- 이제 follow/unfollow의 실제 shared canonical authority는 overlay348 active 상태.
- 기존 관계 전체를 복사하지 않았고, 기존 legacy baseline 위에 실제 변경분만 override로 기록하는 구조.
- **아직 실제 사용자 follow/unfollow를 발생시킨 뒤 Cloudflare physical D1 Rows Written을 측정하지 않았으므로 W1~W2 최종 합격 선언은 보류.**

다음 gate:
1. 실제 사용자 계정으로 follow 1회 → 안정화 후 unfollow 1회.
2. 같은 상태 재요청/중복 요청도 확인.
3. physical D1 합격선:
   - follow W1~W2
   - unfollow W1~W2
   - duplicate/same-state W0
   - W3+ 즉시 FAIL 및 overlay-readonly fail-closed.
4. 동시에 PC↔mobile no-navigation count/list/membership, follower-save permission, public-profile parity 확인.
5. unchanged revisit/cache path D1 R0 확인.
6. 실제 비용/기능 PASS 후에만 follow W1~W2 작업을 완료 처리.

비변경:
- Firebase Hosting/Functions/Firestore Rules 변경 0.
- Media Worker 변경 0.
- Music Note / Library / 좋아요 / 공개·비공개 / UI 변경 0.
- app version은 계속 377.

## 0RS. app377 PRODUCTION 승격 완료 / follow378 전 환경 호환성 준비 완료 / shared cutover OFF (2026-10-07 KST)

사용자 승인:
- 사용자가 명확히 정식앱 승격을 승인.
- TEST_VERIFIED manifest `soridraw-test-v377-9f51660d8174`를 source of truth로 사용.

PRODUCTION Release:
- Release Controller Run `37585161258`: **SUCCESS / RELEASED**.
- app version: `377`.
- production commit: `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- tested main: `b13360df1bab52e2d3b746ea47dc4e3718eef85c`.
- source PREVIEW release commit: `9f51660d81746a619c185da845221b0888021020`.
- production message references exact TEST manifest `soridraw-test-v377-9f51660d8174`.
- `soridraw.com` / Firebase PRODUCTION Hosting은 TEST verified Hosting artifact를 clone하여 exact app377 검증 PASS.
- 별도 PRODUCTION rebuild로 재조립하지 않음.

PRODUCTION Explore Worker:
- before: `efb8508e-d63a-4839-a7c8-a5c89572f4c7`.
- after: `391c4d88-5186-480b-ae53-042bac301ce2`.
- bundle SHA256: `2de2f423a791de7d109b54c063bb3b61c8574eeb8a577f4b388acea3b03ad9da`.
- code SHA256: `ea3b26d5b2270f16120ea6527c4d33fa2c0241b9f0e7ffad6320a97bebf9a440`.
- TEST Worker와 exact bundle/code identity PASS.
- Worker smoke/verify PASS.
- latest/popular shared Feed parity PASS.
- curated parity PASS.
- public profile parity PASS.
- TEST↔PRODUCTION environment parity PASS attempt=1.
- Functions OPTIONS CORS PASS.
- shared D1 preflight SELECT-only PASS.

PRODUCTION Media Worker:
- before: `66b85b60-6c00-4c9c-bde8-df4f836a3ea8`.
- after: `2c2e3236-d9a6-4771-b2ba-7baff496145c`.
- bundle SHA256: `041be5815c4398311c476276cda7c19cebf42e72ee29066aee0839f5f55ee50b`.
- code SHA256: `f0507a8464a1147e2bc914b6cd681ee1f1531ecfc3afb40ab7a73b8e55990bc9`.
- smoke/verify PASS.

follow W1~W2 상태:
- shared D1 additive overlay348 schema 적용 완료.
- PREVIEW / TEST / PRODUCTION active Explore Worker 모두 app377/follow378 rollback-safe source line에 도달.
- follow lifecycle flag: **OFF**.
- shared R2 active cutover manifest: **OFF / 없음**.
- D1 one-way authority control activation: **OFF**.
- 따라서 정식앱 승격 자체로 사용자 follow relation authority는 바뀌지 않았고 기존 legacy runtime을 계속 사용.
- 실제 shared follow overlay activation 및 physical W1~W2 측정은 아직 미실행.

데이터 / 백엔드:
- 이 PRODUCTION 승격에서 user data migration/backfill/delete/rewrite/copy 0.
- Firebase Functions/Rules 변경 0.
- shared D1 추가 schema mutation 0 (기존 승인 단계에서 이미 적용된 dormant schema 그대로).
- follow legacy rows/profile_stats bulk rewrite 0.

다음 gate:
1. 전 환경 active Worker가 rollback-safe authority reader를 이해하는 상태를 read-only로 다시 고정 확인.
2. 별도 shared follow cutover 승인 후 coordinated order:
   - D1 control을 one-way latch 준비 상태로 arm.
   - lifecycle gate를 모든 환경에서 호환 상태로 고정.
   - shared R2 active manifest 활성화.
3. 즉시 실제 follow / unfollow / duplicate / same-state physical D1 Rows Written 측정.
4. 합격선:
   - follow W1~W2.
   - unfollow W1~W2.
   - duplicate / same-state W0.
   - W3+ 즉시 FAIL.
5. 동시에 PC↔mobile count/list/membership, follower-save permission, public-profile parity 확인.
6. 이상 발생 시 legacy로 자동 fallback 금지. effective overlay read는 유지하고 새 mutation만 overlay-readonly로 fail-closed.

## 0RR. app377 TEST 승격 완료 / follow378 TEST Worker 호환성 PASS / PRODUCTION 비변경 (2026-10-07 KST)

사용자 승인:
- TEST 배포 승인 후 fixed Release Controller로 exact PREVIEW source `9f51660d81746a619c185da845221b0888021020` 승격.

Release:
- Release Controller Run `37584516018`: **SUCCESS**.
- app version: `377`.
- TEST_VERIFIED tag: `soridraw-test-v377-9f51660d8174`.
- main promoted commit: `b13360df1bab52e2d3b746ea47dc4e3718eef85c`.
- production branch remains `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0` (app375 production baseline) unchanged.
- PRODUCTION deploy stage skipped.

TEST Worker:
- before: `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`.
- after: `a70593bb-2bc9-4a41-a05a-47332a4f7660`.
- Worker bundle SHA256: `2de2f423a791de7d109b54c063bb3b61c8574eeb8a577f4b388acea3b03ad9da`.
- Worker code SHA256: `ea3b26d5b2270f16120ea6527c4d33fa2c0241b9f0e7ffad6320a97bebf9a440`.
- TEST Worker smoke/verify PASS.
- latest/popular shared Feed parity PASS.
- curated parity PASS.
- public profile parity PASS.
- PREVIEW↔TEST environment parity PASS attempt=1.
- Functions OPTIONS CORS PASS.
- shared D1 preflight SELECT-only PASS.

TEST Media Worker / Hosting:
- fixed TEST promotion controller also produced exact TEST media/Hosting artifacts.
- TEST media Worker before `cfb741e3-a255-49ed-8801-cb21f7f53938`.
- TEST media Worker after `f0a86688-5ffc-42ed-aecd-c01f8c17c636`.
- TEST media Worker smoke/verify PASS.
- `test.soridraw.com` / Firebase TEST exact app377 verification PASS.
- 이 승격은 TEST 완성본 전체 승격 규칙에 따른 것이며 PRODUCTION에는 반영되지 않음.

follow W1~W2 상태:
- shared additive overlay348 schema: 적용 완료.
- PREVIEW Worker follow378 rollback-safe reader: 배포 완료.
- TEST Worker follow378 rollback-safe reader: 배포 완료.
- PRODUCTION active Worker: 아직 app375 baseline / follow378 미승격.
- follow authority lifecycle flag: OFF.
- shared R2 active cutover manifest: 없음/OFF.
- D1 control activation: 없음/OFF.
- 실제 shared follow W1~W2 authority activation 및 live physical billing 측정: 아직 미실행.
- 따라서 현재 사용자 팔로우 runtime은 기존 legacy authority를 계속 사용하며 app377 정상 동작 기준을 유지.

비변경:
- PRODUCTION branch/Hosting/Explore Worker/Media Worker 비변경.
- Firebase Functions/Rules 비변경.
- shared user data migration/backfill/delete/rewrite/copy 0.
- follow overlay schema 적용 이후에도 기존 user relation rows 자체 변경 0.

다음 gate:
- PRODUCTION active Worker도 follow378 rollback-safe reader/readonly fail-closed를 이해해야 shared authority activation 가능.
- PRODUCTION 승격은 `soridraw-test-v377-9f51660d8174` TEST_VERIFIED manifest를 사용해야 하며, 사용자 명확한 정식배포 승인 없이는 실행 금지.
- PRODUCTION compatibility PASS 뒤에만 D1 control + shared R2 manifest를 coordinated cutover로 활성화하고 실제 follow/unfollow physical W1~W2를 측정.
- W3+ / membership mismatch / count mismatch 발생 시 즉시 fail-closed 및 다음 승격 금지.

## 0RQ. follow W1~W2 shared schema 적용 + PREVIEW rollback-safe Worker 배포 완료 / cutover OFF (2026-10-07 KST)

실제 완료:
- 사용자 승인 후 shared canonical D1 `soridraw-explore-db`에 dormant follow overlay schema를 additive 방식으로 적용.
- Shared D1 Release Run `37582930962`: **SUCCESS**.
- 적용 객체:
  - `explore_follow_overrides_348`
  - `idx_explore_follow_overrides_348_reverse`
  - `explore_follow_cutover_control_348`
- 적용 전 세 객체 모두 ABSENT였고, postflight에서 exact schema PASS.
- user row rewrite/backfill/delete/copy 0.
- runtime follow overlay activation 0.
- D1 schema 적용 뒤 PREVIEW/TEST/PRODUCTION Feed smoke PASS.
- D1-only release 동안 Worker version 변경 0 / main·production ref 변경 0.

PREVIEW Worker:
- rollback-safe follow378 source를 PREVIEW Worker에 cutover-OFF 상태로 배포.
- PREVIEW Worker Release Run `37583095947`: **SUCCESS**.
- 이전 PREVIEW Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- 현재 PREVIEW Worker `cf78f8cb-a108-4362-a6e7-a0c90eff12a0`.
- canonical Worker SHA256 `43b71e2892cbade0ce33911b7157286bd4c84eb7b516575769130412df34e673`.
- Worker341 legacy follow parity PASS.
- app377 actorFollowingCount no-extra-D1 PASS.
- Feed / curated / public profile / profile tracks / genre read smoke PASS.
- TEST Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65` unchanged.
- PRODUCTION Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7` unchanged.
- follow lifecycle flag / shared R2 cutover manifest / D1 control row activation은 아직 OFF.

중요 새 확인:
- `DB`와 `PROFILE_MEDIA`는 PREVIEW/TEST/PRODUCTION이 같은 shared canonical resource를 사용한다.
- follow cutover manifest key도 shared `PROFILE_MEDIA`의 동일 authority key다.
- 따라서 shared overlay relation을 실제로 활성화하면 PREVIEW에서 생긴 follow 변경을 TEST/PRODUCTION도 같은 canonical 상태로 읽어야 하므로 **PREVIEW만 따로 authority를 켜는 방식은 허용할 수 없음**.
- 현재 TEST/PRODUCTION active Worker는 protocol354/355 active-overlay 호환은 있지만, 이번 378 rollback-safe one-way lifecycle source는 아직 배포되지 않음.
- 이 상태에서 shared authority를 먼저 켜면 정상 active path는 읽을 수 있어도 manifest loss/corrupt emergency path에서 구 Worker가 immutable legacy로 fallback할 수 있으므로 activation 금지.
- emergency readonly manifest만으로는 구 Worker read parity까지 보장되지 않으므로 우회 금지.

현재 결론:
- shared schema apply: PASS / 완료.
- PREVIEW compatibility Worker deploy: PASS / 완료.
- 실제 follow W1~W2 shared authority activation: **아직 OFF**.
- 실제 shared PREVIEW physical W1~W2 측정: **activation 전이라 미실행**.
- 다음 안전 조건은 TEST/PRODUCTION active Worker도 378 rollback-safe authority reader를 이해하도록 compatibility를 먼저 승격하는 것.
- TEST/PRODUCTION 실제 Worker 변경은 기존 승격 규칙대로 별도 승인 없이 실행 금지.
- full user-data foldback/migration/backfill은 여전히 금지.

## 0RP. follow W1~W2 rollback-safe authority source 구현 + 전체 audit PASS (2026-10-07 KST)

현재 결론:
- app377 팔로우 숫자/목록/PC↔모바일 정합성은 사용자 PASS 기준 그대로 동결.
- 기존 blocker였던 “overlay 변경 후 manifest OFF 시 legacy baseline으로 잘못 복귀” 문제를 PREVIEW source에서 해결.
- one-way authority latch + emergency overlay-readonly를 추가하여, 한 번 overlay authority가 실제 활성화된 뒤에는 legacy relation authority로 자동 하강하지 못하게 함.
- pre-cutover/cutover-OFF에서는 기존 legacy 경로와 비용을 유지하며, **manifest 없음 상태 추가 D1 read 0**을 실행형 검사로 고정.
- healthy overlay manifest도 추가 D1 latch read 0.
- manifest missing/corrupt 예외에서만 D1 one-way latch를 읽고, 이미 활성화된 authority면 effective overlay read를 유지하면서 새 follow/unfollow mutation만 fail-closed.
- old Worker가 readonly manifest를 overlay-active로 오인하지 않도록 readonly relationMode는 별도 fail-closed 계약으로 분리.
- shared D1 schema/apply, R2 cutover manifest, 실제 overlay activation은 아직 실행하지 않음.

구현 commit:
- source commit `572249ce4e04a41095bcf764e0d3de7649ac2842`: rollback-safe authority 1차 구현.
- safety refinement commit `7d0f9b38798e066b83f9842c8397866b761447bd`:
  - pre-cutover missing manifest D1 R0 유지.
  - lifecycle feature flag 없이는 기존 legacy exact behavior.
  - emergency readonly manifest는 old Worker가 fail-closed 하도록 별도 relationMode.
- audit trigger commit `0ba04c6ab49560640c567ec5b07e03fbd6b728fb`.
- canonical PREVIEW Worker source SHA256 `43b71e2892cbade0ce33911b7157286bd4c84eb7b516575769130412df34e673`.

변경:
- `cloudflare/explore-worker/canonical/preview-worker.js`
  - `readFollowCutoverControl348` one-way latch fallback.
  - `readFollowCutoverState348` zero-cost pre-cutover + active/read-only authority lifecycle.
  - `handleFollowR2Core` / `handleFollowOverlay354` / orchestration에서 readonly mutation fail-closed.
- `cloudflare/explore-worker/candidates/348-follow-overlay.sql`
  - candidate-only `readonly` phase.
  - active/readonly → legacy/armed downgrade 차단 trigger.
  - active/readonly control row 삭제 차단 trigger.
- follow 348/349/354/356/378 verifier 보강.

최종 Audit:
- Release System Audit Run `37579261599`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- static release audit PASS.
- TEST + PRODUCTION Worker dry-run PASS.
- PREVIEW / TEST / PRODUCTION current active Worker protocol354/355 compatibility PASS.
- live shared follow D1 SELECT-only preflight PASS / shared D1 write 0.
- deployment 0.

핵심 verifier:
- `FOLLOW378_PRECUTOVER_MISSING_MANIFEST_D1_R0=PASS`.
- `FOLLOW378_HEALTHY_MANIFEST_D1_LATCH_R0=PASS`.
- `FOLLOW378_MISSING_OR_CORRUPT_MANIFEST_RECOVERS_READONLY_OVERLAY=PASS`.
- `FOLLOW378_BASELINE0_FOLLOW1_EFFECTIVE=PASS`.
- `FOLLOW378_BASELINE1_UNFOLLOW0_EFFECTIVE=PASS`.
- `FOLLOW378_ONCE_ACTIVE_CANNOT_DOWNGRADE_OR_DELETE_LATCH=PASS`.
- `FOLLOW378_READONLY_NEW_MUTATION_FAILS_BEFORE_LEGACY_OR_RATE_WRITE=PASS`.
- `FOLLOW378_READONLY_MANIFEST_OLD_WORKER_FAIL_CLOSED_CONTRACT=PASS`.
- `FOLLOW378_CUTOVER_ACTIVATION_BLOCKER=RESOLVED_SOURCE_ONLY`.
- Worker341 legacy counter/post-sync parity PASS.
- protocol354 crash/retry/order/duplicate tests PASS.
- app377 actorFollowingCount no-extra-D1 PASS.
- user/shared DB deployment data change 0.

비용 근거:
- fixture HTTP path: new follow relation D1 change 1 row / unfollow 1 row / duplicate 0 / same-state 0.
- 기존 isolated remote physical proof는 follow W2 / unfollow W1 / duplicate W0 / same-state W0 유지.
- 실제 shared PREVIEW overlay를 아직 켜지 않았으므로 **live PREVIEW physical W1~W2는 아직 미검증**.

보호/비변경:
- app377 count/list/persistent follower/following cache/RTDB PC↔mobile signal 변경 없음.
- 좋아요 / 공개·비공개 / Music Note / Library / profile UI/CSS 변경 없음.
- shared D1 user data migration/backfill/copy/delete/rewrite 0.
- Firebase / Functions / Rules / Hosting 변경 0.
- TEST/PRODUCTION 실제 배포 변경 0.

다음 gate:
1. 현재 commit을 독립 검증 기준으로 고정.
2. shared D1 additive overlay348 schema 적용 + lifecycle/cutover는 **실제 shared backend 변경**이므로 별도 승인 후 진행.
3. 승인 후에도 순서는 schema additive 적용 → 모든 환경 read compatibility 재확인 → PREVIEW-only active manifest → 실제 follow/unfollow physical D1 W1~W2 측정.
4. W3+ / count mismatch / membership mismatch / permission/public-profile mismatch가 하나라도 나오면 즉시 activation 중단하고 overlay-readonly로 fail-closed.
5. PREVIEW 실기기 PC↔mobile까지 PASS해야 TEST 판단.

## 0RO. follow W1~W2 전환 전 롤백 안전성 BLOCKER 실증 / shared cutover 계속 OFF (2026-10-07 KST)

현재 판단:
- app377 팔로우 숫자/목록/PC↔모바일 정합성은 사용자 PASS 기준 그대로 동결.
- protocol354/355 저비용 후보 자체와 all-environment active Worker 호환성은 read-only 감사에서 PASS.
- 그러나 **overlay가 한 번 실제 관계를 변경한 뒤 manifest를 제거/비활성화하면 runtime이 legacy `follows`로 되돌아가 변경된 관계를 무시할 수 있음**을 실행형 verifier로 재현.
- 따라서 shared follow cutover 활성화는 **one-way authority 또는 overlay-readonly rollback**이 먼저 구현·감사되기 전까지 BLOCKED.

Read-only readiness 근거:
- Audit Run `37574090023`: SUCCESS.
- PREVIEW active Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`: protocol354/355 markers PASS.
- TEST active Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`: protocol354/355 markers PASS.
- PRODUCTION active Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7`: protocol354/355 markers PASS.
- shared canonical D1의 follow overlay 348 schema는 현재 **ABSENT / NOT_APPLIED**.
- shared D1 write 0 / Worker deploy 0 / Hosting deploy 0 / Functions deploy 0 / RTDB Rules deploy 0.

Rollback blocker 실증:
- verifier commit `8549ded75d56fce8b09cac57b3637d1e17bdf1fe`: `scripts/verify-378-follow-rollback-blocker.mjs`.
- release audit hard gate commit `815398f93164c9c00ac55ac3c4542fd719677107`.
- read-only audit source/trigger `06d982756552ce6e3e56ecf0250646a3df535fd9`.
- Audit Run `37576098525`: **SUCCESS**.
- `FOLLOW378_OVERLAY_EFFECTIVE_STATE_DIFFERS_FROM_IMMUTABLE_BASELINE=PASS`.
- `FOLLOW378_MISSING_MANIFEST_FALLS_BACK_TO_LEGACY=PASS`.
- `FOLLOW378_D1_CONTROL_NOT_RUNTIME_LATCH=PASS`.
- `FOLLOW378_MANIFEST_REMOVAL_AFTER_OVERLAY_MUTATION=UNSAFE_REPRODUCED`.
- `FOLLOW378_SHARED_USER_DATA_WRITE=0`.
- `FOLLOW378_CUTOVER_ACTIVATION=BLOCKED_UNTIL_ONE_WAY_OR_READONLY_ROLLBACK`.
- 같은 Run에서 TypeScript / Build / follow 347~378 / TEST+PRODUCTION Worker dry-run / live shared D1 SELECT-only preflight / no-deploy gate PASS.

왜 중요한가:
- overlay 348은 기존 `follows`를 immutable baseline으로 두고 변경된 edge만 overlay에 기록한다.
- 현재 `readFollowCutoverState348`은 R2 manifest가 없으면 `legacy`로 돌아가며 D1의 `explore_follow_cutover_control_348`을 runtime latch로 읽지 않는다.
- 따라서 실제 overlay 변경 이후 단순 manifest OFF 또는 구형 legacy-only rollback은 기능 롤백이 아니라 **사용자 팔로우 상태를 과거 baseline처럼 보이게 만드는 정합성 오류**가 될 수 있다.
- 과거 Worker341 rollback은 overlay authority가 OFF였기 때문에 안전했던 것이며, post-cutover rollback 증거로 사용할 수 없다.

다음 설계 고정:
- 정상 overlay 상태에서 steady-state마다 D1 latch를 읽게 만들지 않는다.
- healthy R2 manifest가 정상 authority source이고, D1 control은 manifest 손상/부재 같은 예외 복구에서만 one-way latch/fallback으로 사용한다.
- overlay authority가 한 번 실제 write를 허용한 뒤에는 legacy writer/read authority로 자동 복귀 금지.
- 안전한 긴급 롤백은 **effective overlay reader는 유지 + follow mutation만 fail-closed(overlay-readonly)**가 기본.
- 완전한 legacy 복귀가 필요하면 overlay 변경분을 legacy에 합치는 별도 migration/foldback가 필요하므로 사용자 명확한 승인 없는 현재 작업 범위 밖.
- 구버전/무본문 client는 기존처럼 `FOLLOW_ORDER_REQUIRED` → protocol354 negotiation을 유지하고, readonly 상태에서는 legacy fallback 없이 실패 차단.
- schema는 additive/no-backfill 원칙 유지.

보호/비변경:
- app377 count/list/persistent cache/RTDB PC↔mobile sync 변경 0.
- 좋아요 / 공개·비공개 / Music Note / Library / profile UI/CSS 변경 0.
- shared D1 schema/migration/cutover/manifest write 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- TEST/PRODUCTION 코드·Worker·Hosting 비의도 변경 0.
- 실제 PREVIEW overlay W1~W2 live 검증은 **아직 미실행**. rollback-safe lifecycle 구현/감사 후에만 진행.

## 0RN. app377 팔로우 정합성 사용자 실사용 PASS / 비용 최적화만 남음 (2026-10-07 KST)

사용자 실사용 확인:
- app377 팔로우 숫자 / 실제 팔로워·팔로잉 목록 / PC↔모바일 동기화 정상 적용 확인.
- app377 정합성 수정은 사용자 기준 PASS로 동결.
- 이후 작업 범위는 **팔로우 mutation 비용 W14~W17 → W1~W2**만 남김.

보호:
- app377 숫자/목록/persistent list cache/RTDB cross-device sync 재설계 금지.
- 공개/비공개, 좋아요, Music Note, Library, profile UI/CSS 변경 금지.
- unchanged popup reload/reopen D1 R0 목표 유지.

다음 비용 단계:
- 기존 dormant follow overlay 348 + ordered protocol354/355 후보를 기준으로 진행.
- 이미 격리 actual D1에서 follow W2 / unfollow W1 / duplicate W0 / same-state W0 증거 있음.
- shared cutover는 아직 OFF. 실제 PREVIEW 활성화 전 all-environment compatibility / rollback / shared schema 상태를 다시 고정.
- 실제 PREVIEW에서 W1~W2와 기능 정합성이 동시에 PASS하기 전 TEST/PRODUCTION 승격 금지.
## 0RM. app377 팔로우 숫자/목록/PC↔모바일 정합성 수정 PREVIEW 배포 완료 (2026-10-07 KST)

사용자 실사용 근거:
- app376에서 실제 following popup은 2명을 보여주는데 프로필/탭 숫자는 `팔로잉 1`로 남는 불일치 확인.
- PC에서 unfollow → follow를 다시 했어도 following count가 1→2로 갱신되지 않았고, 모바일은 기존 2가 1로 내려가지 않는 반대 방향 stale count 확인.
- CACHE LIVE에서 팔로워/팔로잉 목록을 새로 불러올 때 각각 D1 R2/W0, 두 목록 합계 R4가 관찰됨. app376 목록 cache는 React mount memory-only라 새로고침 뒤 재조회가 발생하던 구조였음.

확정 원인:
- 공개 프로필 first-view count cache는 reload를 변경 신호로 보지 않는 정상 R0 구조인데, follow 변경 신호가 별도로 없어서 follower/following count가 PC↔모바일에 전달되지 않았음.
- 기존 follow HTTP 응답은 이미 D1 mutation에서 계산된 actor의 정확한 `following_count`를 가지고도 target profile count만 반환해 MY profile followingCount를 정확히 고칠 수 없었음.
- app376 follower/following popup의 first page cache가 persistent가 아니라 mount memory-only여서 browser refresh 후 같은 목록이 D1 R2로 다시 조회됐음.

app377 수정:
- Worker follow 응답에 기존 `stats.follower.following_count`를 `actorFollowingCount`로 추가. **추가 D1 query/write 0**.
- Worker341 legacy relation/counter mutation과 post-sync는 그대로 유지; response field만 additive.
- follow 성공 즉시:
  - target `followerCount` cache 갱신,
  - actor MY profile `followingCount` cache를 exact count로 갱신,
  - 개인 follow membership cache/social snapshot 갱신.
- 같은 계정 PC↔모바일은 `userSync/{uid}/exploreFollow` RTDB 1개 최신 신호로 변경된 target/count만 전달. 수신 기기는 D1/Firestore read 0으로 local cache/UI만 갱신.
- follower/following first page(최대 30명)를 persistent local cache로 저장. 변경 없는 browser refresh/재진입/팝업 재열기는 Worker 0 / D1 R0 목표.
- 실제 follow/unfollow 성공 또는 수신 signal에서만 actor following + target followers 두 cache만 무효화. 전체 목록/전체 profile 무효화 없음.
- 30명 이하 complete popup은 실제 relation rows 수를 exact count로 사용해 기존 stale profile count를 로컬에서 즉시 self-heal.
- CACHE LIVE에 persistent relation cache hit를 별도 표시.

검증:
- 1차 Audit `37568753767`: TypeScript/Build PASS. response-only field를 허용하지 않던 기존 `verify-354-follow-orchestration` exact legacy assertion으로 FAIL; 제품 오류가 아니라 verifier 계약 미갱신. 배포 0.
- verifier는 Worker341 mutation/post-sync는 계속 exact 비교하고, app377 response-only field만 normalize하도록 수정.
- 재감사 `37568966361`: SUCCESS.
- 최종 release-gate 감사 `37569220320`: **SUCCESS**.
- APP377 exact actor count response / no extra D1 PASS.
- APP377 persistent reload R0 contract PASS.
- APP377 changed-only list invalidation PASS.
- APP377 cross-device RTDB signal PASS.
- APP377 small-profile count self-heal PASS.
- Worker341 legacy counter/post-sync parity PASS.
- canonical Worker SHA256 exact match `e311f5f97160057b9f3be29d83a716bbd15f00782fd6f60ce6c447be8bfcfdc4`.
- TEST/PRODUCTION Worker dry-run PASS.

PREVIEW 배포:
- Worker source commit: `b8dfc9e6baf27c4a17eac528f38ba0525e42d568`.
- Worker release trigger: `bcb880375175095b18a0fe1f2fa0ddda25d66cc1`.
- PREVIEW Worker Run `37569420282`: **SUCCESS**.
- PREVIEW Worker before `bc8cc09e-4210-46e2-bdb7-72796e2798e4` → after `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- feed/profile smoke PASS; warm revision D1 R0/W0 PASS; automatic rollback 없음.
- TEST Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65` / PRODUCTION Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7` unchanged PASS.
- App release trigger / locked source `8f0efd593c60e9d0c8ca4795ceb674abc437cf6c`.
- Firebase PREVIEW Hosting Run `37569563139`: **SUCCESS**.
- remote `preview.soridraw.com` app version **377** / exact build PASS.
- shared RTDB Rules exact-match deploy PASS: additive `userSync/$uid/exploreFollow` only.
- Firebase Functions / Firestore Rules 변경 0.
- shared D1 schema/migration/cutover 변경 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- main(TEST) / production branches + Hosting unchanged PASS.

비용 상태:
- follower/following popup: 첫 cold list click은 기존 bounded D1 R2 가능. 이후 변경 없는 refresh/reopen은 persistent local cache로 D1 R0 목표.
- 실제 relation 변경 때만 관련 2개 list cache를 무효화하므로 다음 필요 시 해당 list만 bounded 재조회.
- cross-device count sync는 작은 RTDB signal 1개/실제 follow mutation; 수신 D1/Firestore 0.
- follow mutation 자체의 legacy physical D1 W14~W17은 **아직 해결 전**. 이번 app377은 숫자/목록 정합성과 반복 read 문제를 먼저 분리 해결한 단계이며 shared W1~W2 cutover는 여전히 OFF.

실사용 검증:
1. app377로 PC/Mobile 모두 갱신 후 MY profile following count와 popup 실제 rows가 같은지 확인.
2. PC follow → 모바일 숫자/버튼이 페이지 이동 없이 수렴하는지, 반대 방향도 확인.
3. follow/unfollow 후 actor following list와 target followers list membership이 일치하는지 확인.
4. popup 첫 cold click D1 R2 확인 후 새로고침/재진입 같은 목록은 `팔로우 목록 캐시` LOCAL HIT / Worker0 / D1 R0인지 확인.
5. 위 정합성 PASS 후에만 기존 W14~W17 → W1~W2 shared follow cutover 단계 재개.
## 0RL. app376 PREVIEW 배포 완료 / 팔로워·팔로잉 실사용 검증 대기 (2026-10-07 KST)

사용자 승인:
- 사용자가 `배포해줘`로 app376 PREVIEW 배포를 명확히 승인.
- 승인 범위는 app376 client/Firebase PREVIEW Hosting만. Worker/shared D1/Functions/Rules/TEST/PRODUCTION 변경 없음.

배포:
- app version commit: `bbbf8ade85cce6bd49ea646c85b2b9b38a4e8393`.
- release trigger / locked source: `e928cddaeed721227a24b1f2184777b029a030ab`.
- Firebase PREVIEW Hosting Run `37567143109`: **SUCCESS**.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- remote `preview.soridraw.com` app version **376**.
- `PREVIEW_EXACT_BUILD=PASS`.
- TypeScript PASS / Build PASS.
- app358 profile+My Likes convergence PASS.
- app359 My Likes settlement upgrade PASS.
- app360 My Likes navigation local PASS.
- app361 Music Note publication origin parity PASS.
- shared RTDB Rules: SKIPPED.
- TEST/PRODUCTION unchanged PASS.

app376 기능:
- 공개 프로필 `팔로워` / `팔로잉` 숫자를 클릭하면 실제 사용자 목록 팝업.
- PC 중앙 popup / 모바일 bottom-sheet.
- 30명 bounded page + 더 보기.
- 프로필 진입만으로 목록 서버 read 추가 0; 사용자가 숫자를 눌렀을 때만 조회.
- 동일 mount 재열기는 memory cache.
- 사용자별 N+1 profile read 없음.
- CACHE LIVE 요청명 `팔로워 목록` / `팔로잉 목록` 표시.

현재 Worker/데이터:
- PREVIEW Explore Worker는 기존 `bc8cc09e-4210-46e2-bdb7-72796e2798e4` 유지. 이번 app376 배포에서 Worker 재배포 없음.
- shared follow cutover OFF.
- shared D1 schema/migration/write 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- Functions / Firestore Rules / RTDB Rules 변경 0.

실사용 검증:
1. MY프로필에서 팔로워/팔로잉 숫자를 눌러 실제 목록 확인.
2. A→B 팔로우 후 B의 팔로워 목록에 A, A의 팔로잉 목록에 B가 보이는지 확인.
3. 팔로우 해제 후 두 목록에서 사라지는지 확인.
4. 숫자(count) / 목록 / 팔로우 버튼 상태가 PC와 모바일에서 일치하는지 확인.
5. CACHE LIVE에서 첫 목록 클릭 비용과 같은 목록 재열기 비용 확인.
6. 현재 follow mutation W14~W17은 legacy cutover-OFF 경로이므로 이 정합성 확인 전 W1~W2 cutover 활성화 금지.
## 0RK. app376 팔로워/팔로잉 목록 팝업 준비 완료 / PREVIEW 배포 전 (2026-10-07 KST)

사용자 실사용 관찰:
- PREVIEW cutover-OFF Worker에서 follow / unfollow 반복 후 숫자와 상태가 기대대로 반영되는지 확신하기 어려움.
- CACHE LIVE에서 follow mutation physical Rows Written은 여전히 legacy 수준 W14~W17 구간이 관찰됨. 현재 shared follow cutover가 OFF이므로 W1~W2 후보 경로가 실제 활성화된 결과가 아님.
- 사용자가 팔로워/팔로잉 숫자만 보고 실제 관계 상대를 확인할 수 없어, 관계 정합성을 검증할 UI가 먼저 필요하다고 지적.

app376 구현:
- 공개 프로필의 `팔로워`, `팔로잉` 숫자를 클릭 가능한 버튼으로 변경하되 기존 위치/간격/표시 스타일은 유지.
- 클릭 시 팝업:
  - 팔로워 / 팔로잉 탭
  - 아바타, 닉네임, @handle
  - 사용자 행 클릭 시 해당 공개프로필 이동
  - 빈 목록 / 로딩 / 오류 상태
  - 30명 단위 bounded pagination + `더 보기`
  - PC 중앙 팝업 / 모바일 bottom-sheet형.
- 기존 Worker의 `/v1/profiles/:id/followers`, `/v1/profiles/:id/following`을 그대로 재사용.
- 프로필 진입만으로 목록 서버 요청을 추가하지 않음. **사용자가 숫자를 눌렀을 때만 1회 조회**.
- 목록 API 한 번이 card 표시용 profile fields를 함께 반환하므로 사용자마다 profile을 다시 읽는 N+1 조회 없음.
- 같은 프로필/방향을 다시 열면 현재 Explore mount 동안 메모리 cache 사용.
- follow count가 바뀌면 해당 followers/following popup cache만 무효화하고, follow mutation 함수 자체에는 새 서버/캐시 의존성을 넣지 않음.
- CACHE LIVE에 `팔로워 목록` / `팔로잉 목록` 요청명을 추가해 실제 조회 비용을 바로 확인 가능하게 함.

변경 파일:
- `src/services/exploreSocialService.ts`
- `src/pages/ExplorePage.tsx`
- `src/components/explore/exploreSocial.css`
- `src/components/CacheDiagnosticsOverlay.tsx`
- `scripts/verify-376-profile-connections-popup.mjs`
- `scripts/verify-explore-deploy-preflight.mjs`

검증:
- 최초 Audit Run `37566115459`: TypeScript/Build PASS 후 기존 follow UI 실행형 verifier에서 popup cache ref가 추출된 `toggleFollow` 외부에 없어 FAIL. 제품 배포/데이터 변경 없이 중단.
- 수정: popup cache invalidation을 `toggleFollow`에서 완전히 분리하여 component effect로 이동. 기존 follow mutation contract 보존.
- 재감사 Run `37566319687`: **SUCCESS**.
- 최종 deploy-preflight 연결 후 Audit Run `37566557303`: **SUCCESS**.
- TypeScript PASS / Build PASS / static release-system verification PASS.
- Worker341 legacy counter/post-sync parity PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- live shared D1 preflight read-only PASS.
- active PREVIEW Worker `bc8cc09e-4210-46e2-bdb7-72796e2798e4` 확인; 이번 app376 UI 작업에서는 Worker 재배포하지 않음.

데이터/환경:
- shared follow cutover: OFF.
- shared D1 schema/migration/write: 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite: 0.
- Firebase Hosting 배포: 아직 0 (app376 미배포).
- Functions / Worker 추가 배포: 0.
- TEST / PRODUCTION: 변경 없음.

다음:
1. 사용자가 PREVIEW 배포를 요청하면 app376 client/Hosting만 PREVIEW에 배포.
2. 실제 프로필에서 팔로워/팔로잉 팝업으로 relation 상대를 확인.
3. 숫자(count) ↔ 실제 목록 ↔ 팔로우 버튼 상태를 같은 계정/PC/모바일에서 대조.
4. CACHE LIVE에서 목록 첫 클릭 비용과 같은 팝업 재열기 비용을 확인.
5. relation 자체가 틀린지, 숫자/cache 표시만 틀린지 분리한 뒤 follow 동기화 수정.
6. 이 정합성이 해결되기 전 W1~W2 shared cutover 활성화 금지.
## 0RJ. follow candidate PREVIEW Worker 배포 완료 / cutover OFF 실사용 검증 대기 (2026-10-07 KST)

사용자 승인:
- 사용자가 “배포해서 확인해보자”로 PREVIEW Worker 배포를 승인.
- 승인 범위는 **PREVIEW Worker candidate 배포 + cutover OFF legacy parity 확인**.
- shared follow schema/migration/cutover 활성화, TEST/PRODUCTION 승격은 승인 범위 아님.

배포:
- trigger commit: `a22d27e389c646908347f812859799e4ec1dc111`.
- product source: `f6b63eb0ecb6322d531b19bbb01c6fd0c2555c04`.
- PREVIEW Worker Release Run `37565145301`: **SUCCESS**.
- PREVIEW Worker before: `117d5f65-e34d-4c58-8030-498193deb1b4`.
- PREVIEW Worker after: `bc8cc09e-4210-46e2-bdb7-72796e2798e4`.
- TEST Worker before/after 동일: `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`.
- PRODUCTION Worker before/after 동일: `efb8508e-d63a-4839-a7c8-a5c89572f4c7`.

배포 전 hard gate:
- Worker341 legacy counter exact parity PASS.
- Worker341 legacy post-sync exact parity PASS.
- dormant overlay router / legacy path parity PASS.
- legacy 347 compatibility extra write ABSENT.
- PREVIEW release legacy parity gate PASS.
- profile/follow cost bounds PASS.

배포 후 live smoke:
- Worker propagation ready PASS.
- curated first/warm PASS / warm D1 R0 W0 PASS.
- latest feed D1 R0 W0 PASS.
- popular feed D1 R0 W0 PASS.
- public profile signal shared R2 live PASS.
- profile tracks D1 R0 W0 PASS.
- genre tracks D1 R0 W0 PASS.
- search D1 R0 W0 PASS.
- public like cards D1 R0 W0 PASS.
- feed smoke PASS / profile smoke PASS.
- warm revision D1 R0 W0 PASS.
- TEST/PRODUCTION Workers unchanged PASS.
- automatic rollback 미발생.

중요:
- 이번 release trigger는 `shared_follow_cutover=false`, `follow_overlay_activation=false`.
- shared follow migration/cutover/user data mutation 없음.
- Firebase Hosting / Functions 배포 없음.
- 따라서 지금 PREVIEW에서 먼저 확인해야 하는 것은 **새 Worker가 cutover OFF 상태에서 기존 Worker341 팔로우 기능/비용을 그대로 보존하는지**임.

다음 실사용 체크:
1. PC에서 follow 1회 → 즉시 UI/팔로워 수 확인.
2. PC에서 unfollow 1회 → 즉시 원복 확인.
3. 모바일에서도 동일 1회씩.
4. PC에서 follow 후 모바일에서 페이지 이동/새로고침 없이 상태 정합 확인, 반대 방향도 확인.
5. MY프로필 following membership, 상대 프로필 followerCount/followingCount, follower-save permission 확인.
6. 가능하면 Cloudflare live physical D1 Rows Written을 follow/unfollow 각각 기록.
7. cutover OFF 비용/동작이 Worker341 baseline과 다르면 즉시 rollback.

## 0RI. follow PREVIEW Worker release gate 보강 완료 / 배포 전 (2026-10-07 KST)

배포 안전장치 보강:
- `.github/workflows/cloudflare-explore-preview-release.yml`에 Worker341 legacy parity 검사를 PREVIEW Worker 배포의 필수 선행 gate로 추가.
- release source에 Worker341 기준 commit이 없으면 해당 commit만 bounded fetch한 뒤 `scripts/verify-356-follow-worker341-legacy-parity.mjs`를 실행.
- legacy counter/post-sync/core가 Worker341과 다르면 PREVIEW Worker 배포가 시작되기 전에 실패하도록 고정.
- pipeline change commit: `ed918db4a14fe158f46f6e861dd82bdf135eb9d9`.

독립 재감사:
- trigger commit: `a61a585f96b44429365beb3a670d646a24c9011b`.
- Release System Audit Run `37564622518`: **SUCCESS**.
- TypeScript PASS / Build PASS / static release-system verification PASS.
- TEST + PRODUCTION Worker dry-run PASS.
- live shared D1 preflight read-only PASS.
- branch refs unchanged audit PASS.
- main(TEST) `2314589357ec52b27ed785229f77a808c5673202` / production `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0` unchanged.

현재 상태:
- PREVIEW 코드에는 dormant follow overlay candidate가 있으나 shared follow cutover는 OFF.
- PREVIEW active Worker는 아직 기존 배포본 `117d5f65-e34d-4c58-8030-498193deb1b4`; 이번 작업에서 Worker 배포하지 않음.
- 사용자/shared 데이터 mutation, migration, backfill, delete, rewrite 0.
- 다음 단계는 사용자 PREVIEW 배포 요청 전까지 배포하지 않음. 배포 시에도 cutover OFF 후보부터 legacy parity를 live 확인하고, 그 후에만 overlay 활성화 여부를 별도 판단.

## 0RH. follow W14~W17 → W1~W2 재개 1차 독립 감사 PASS / PREVIEW 배포 전 (2026-10-07 KST)

현재 작업:
- app375 릴리스 종료 후 follow/unfollow 저비용 backend 작업을 다시 시작.
- 시작 기준 PREVIEW `0c9336a9871e348a4e05230b4e44742c92ec060d`.
- 감사 trigger commit `2cc95dc69a72c230bca4c59e9d8d5c4633528524`.
- Release System Audit Run `37564169142`: **SUCCESS**.
- 제품 앱/Worker 배포는 하지 않았고 app375 공개/비공개/최신곡/좋아요/Music Note/Library/UI는 비변경.

핵심 감사 결과:
- Worker341 legacy counter mutation exact parity: **PASS**.
- Worker341 legacy post-sync exact parity: **PASS**.
- dormant overlay router가 legacy 경로보다 먼저 분기되고 cutover OFF에서 legacy 경로를 바꾸지 않는 계약: **PASS**.
- 347 legacy compatibility 추가 write 부재: **PASS**.
- crash/replay, suspended writer, duplicate/reverse/shared-target, ordered client retry: **PASS**.
- shared follow migration: **미적용 / overlay authority OFF**.
- TypeScript PASS / Build PASS / TEST+PRODUCTION Worker dry-run PASS / live shared D1 preflight SELECT-only PASS.
- audit 종료 후 branch refs unchanged PASS.
- 격리용 임시 D1 cleanup PASS.

실제 격리 Cloudflare D1 + actual HTTP handler 물리 비용:
- 새 follow: **R2 / W2**.
- duplicate operation id: **R1 / W0**.
- same-state + new operation id: **R4 / W0**.
- unfollow: **R6 / W1**.
- stale revision reject: **R1 / W0**.
- relation 저장 후 R2 실패: **R5 / W1**.
- recovery retry: **R16 / W0**.
- 따라서 정상 follow/unfollow physical D1 hard gate **W1~W2 PASS**, duplicate/same-state **W0 PASS**.
- 위 수치는 새로 만든 격리 D1의 실제 `rows_read/rows_written`이며 shared 사용자 D1을 변경하지 않음.

아직 남은 게이트:
- R2는 이번 격리 시험에서 실제 live billing이 아니라 fixture get/put 시도 횟수로 검증됨.
  - 정상 follow: R2 get 12 / put 7.
  - 정상 unfollow: R2 get 12 / put 7.
- 실제 PREVIEW Worker + R2 환경의 비용/지연/충돌 계측은 아직 **미검증**.
- PC↔모바일 실기기 follow/unfollow, profile follower/following count, following membership, follower-save permission, public-profile parity도 **실사용 검증 전**.
- 따라서 지금 바로 shared follow cutover/migration을 켜거나 TEST/PRODUCTION으로 승격하지 않는다.

다음 안전 단계:
1. 현재 검증된 dormant overlay candidate를 **cutover OFF** 상태의 PREVIEW Worker 후보로 고정한다.
2. PREVIEW 배포 전 release source identity + Worker341 legacy parity gate를 다시 고정한다.
3. 사용자가 PREVIEW Worker 배포를 요청하면 PREVIEW만 배포하고, 먼저 cutover OFF legacy 실사용 비용이 Worker341 baseline과 동일한지 확인한다.
4. 그 다음 별도 안전 경계에서 overlay 활성화가 필요하면 shared schema/cutover 영향·rollback을 보고하고 명확한 승인을 받은 뒤 진행한다.
5. PREVIEW live에서 follow/unfollow W1~W2 + PC↔모바일/프로필 정합성까지 확인되기 전 TEST 승격 금지.

데이터/환경:
- 사용자 데이터 migration/backfill/copy/delete/rewrite: **0**.
- shared follow schema/cutover mutation: **0**.
- Firebase Hosting/Functions/Rules 변경: **0**.
- Cloudflare Worker 배포: **0**.
- TEST/PRODUCTION 변경: **0**.

## 0RG. app375 PRODUCTION 사용자 smoke PASS / 릴리스 종료 (2026-10-07 KST)

사용자 정식앱 확인:
- 새 Music Note 곡 공개 후 Explore `최신 공개곡` 첫 번째 카드에 즉시 표시 PASS.
- 왼쪽 `<` 화살표를 눌러야만 보이던 지연 증상 없음 PASS.
- 기존/신규 공개곡 메인 음원 1↔2 전환 시 이전 노란 제목/equalizer 즉시 초기화 PASS.
- Music Note 공개상태 / MY프로필 / Explore 노출 정상 확인.
- app373 first-publication W12→W2 비용 구조 유지.

릴리스 최종 상태:
- PREVIEW app375
- TEST app375 / TEST_VERIFIED
- PRODUCTION app375 / RELEASED
- production SHA `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0`
- app375 릴리스 **CLOSED / PASS**
- 사용자 데이터 migration/backfill/copy/delete/rewrite 없음.
- Functions / Rules / shared D1 추가 mutation 없음.

다음 개발 우선순위:
- 공개/비공개/최신곡 경로는 동결 보호.
- 다음 큰 비용 작업은 2026-10-05에 rollback된 **follow 저비용 backend**로 복귀.
- 현재 legacy follow 실사용 baseline은 physical D1 Rows Written 약 **W14~W17**, 목표는 **W1~W2**.
- 기존 candidate355는 cutover OFF 상태에서도 legacy path 비용을 바꿔 rollback된 이력이 있으므로 바로 재배포 금지.
- 먼저 Worker341 legacy parity + dormant overlay candidate를 독립 감사하고, 실제 HTTP 경로 D1/R2 비용을 격리 환경에서 다시 증명한 뒤 PREVIEW Worker 후보를 만든다.
- shared follow migration/cutover/user data mutation은 별도 명확한 승인 전 금지.

## 0RF. app375 TEST + PRODUCTION 승격 완료 — RELEASED (2026-10-07 KST)

사용자 승인:
- PREVIEW app375 실사용 PASS 후 사용자가 “테스트, 정식까지 승격”을 명확히 승인.
- 승인 범위: 검증된 app375 전체 릴리스의 TEST 승격 후, TEST_VERIFIED 동일본을 PRODUCTION까지 승격.
- 사용자 데이터 migration/backfill/copy/delete/rewrite는 승인 범위가 아니며 실행하지 않음.

TEST 승격:
- source PREVIEW SHA: `24d600fd1597db9d4d10d7257a2b6911a3e721c4`
- Release Controller Run `37559055085`: **SUCCESS / TEST_VERIFIED**
- main(TEST) promoted SHA: `2314589357ec52b27ed785229f77a808c5673202`
- immutable TEST tag: `soridraw-test-v375-24d600fd1597`
- app version: **375**
- TEST Explore Worker active/uploaded version: `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`
- TEST Media Worker active/uploaded version: `cfb741e3-a255-49ed-8801-cb21f7f53938`
- TypeScript PASS / Build PASS
- Firebase TEST Hosting exact verification PASS
- `TEST_WORKER_VERIFY=PASS`
- `TEST_MEDIA_WORKER_VERIFY=PASS`
- `TEST_CURATED_PARITY=PASS count=12`
- `TEST_PUBLIC_PROFILE_PARITY=PASS`
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`
- browser-upgrade / app361 publication parity / old-cache release gates PASS
- TEST 단계에서 PRODUCTION branch/Hosting/Worker/Media Worker 비변경 PASS

PRODUCTION 승격:
- production approval command consumed immutable TEST_VERIFIED tag `soridraw-test-v375-24d600fd1597`
- Release Controller Run `37559345127`: **SUCCESS / RELEASED**
- tested main: `2314589357ec52b27ed785229f77a808c5673202`
- production promoted SHA: `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0`
- app version: **375**
- PRODUCTION Explore Worker active/uploaded version: `efb8508e-d63a-4839-a7c8-a5c89572f4c7`
- PRODUCTION Media Worker active/uploaded version: `66b85b60-6c00-4c9c-bde8-df4f836a3ea8`
- Firebase PRODUCTION Hosting: TEST verified Hosting exact clone PASS
- `FIREBASE_PRODUCTION_HOSTING_CLONED_FROM_TEST=PASS`
- `PRODUCTION_WORKER_VERIFY=PASS`
- `PRODUCTION_MEDIA_WORKER_VERIFY=PASS`
- `PRODUCTION_CURATED_PARITY=PASS count=12`
- `PRODUCTION_PUBLIC_PROFILE_PARITY=PASS`
- `PRODUCTION_RELEASE_ENVIRONMENT_PARITY=PASS reference=TEST`
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`
- Release Control final state: **RELEASED**
- `soridraw.com` + Firebase production URL exact release verification step PASS
- main(TEST) ref / TEST Worker / TEST Media Worker / TEST Hosting은 PRODUCTION 승격 중 비변경 확인.

이번 릴리스에 포함된 app374/app375 핵심:
- 공개 메인 음원 1↔2 전환 시 이전 노란 제목/equalizer 즉시 초기화.
- 새 공개곡 publication signal을 same-origin 브라우저에 즉시 전달.
- Explore `최신 공개곡` 첫 track이 바뀌면 해당 rail만 paint 전에 left=0으로 복귀.
- 새 공개곡이 기다림/왼쪽 화살표 클릭 없이 첫 번째 카드로 즉시 노출.
- 다른 추천/인기 rail의 사용자가 보던 위치는 자동 변경하지 않음.
- app373 shared D1 first-publication W12→W2 구조 유지.

데이터 / 비용 / 백엔드:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**
- 이번 app375 TEST/PRODUCTION 승격에서 shared D1 schema/data 추가 mutation: **0**
- Firebase Functions/Rules 변경: **0**
- app375 local publication signal dispatch는 기존 canonical publication signal transaction의 결과를 같은 브라우저에 즉시 전달하는 것이며 추가 D1 read/write를 만들지 않음.
- shared D1 app373 cutover는 기존 적용 상태 유지.
- 실사용 first-publication 비용 기준: **W2**.

현재 환경:
- PREVIEW = app375
- TEST = **app375 / TEST_VERIFIED**
- PRODUCTION = **app375 / RELEASED**

다음:
- 정식앱에서 사용자 smoke test:
  1. 새 공개곡이 Explore `최신 공개곡` 첫 칸에 즉시 보이는지.
  2. 기존/신규 공개곡 메인 음원 1↔2 전환 시 노란 제목/equalizer 초기화가 정상인지.
  3. Music Note 공개상태 / MY프로필 / Explore 노출이 동일한지.
- 이상 없으면 app375 릴리스 종료.
- 이상 시 PRODUCTION 추가 변경을 바로 하지 말고 PREVIEW에서 해당 경로만 수정 후 다시 승격.

## 0RE. app375 PREVIEW 사용자 실사용 검증 PASS (2026-10-07 KST)

사용자 확인:
- PREVIEW app375에서 새로 공개한 Music Note 곡이 Explore `최신 공개곡`의 첫 번째 카드로 즉시 표시됨.
- 기다렸다가 왼쪽 `<` 화살표를 눌러야만 보이던 증상 해결 확인.
- app374 공개 메인 음원 전환 시 노란 제목/equalizer 초기화 정상 동작 유지.
- app373 first-publication W12→W2 비용 절감 구조 유지.
- 추가 D1/Worker/Functions/Firebase Rules/user data 변경 없음.

현재 기준:
- PREVIEW app375 = 사용자 실사용 PASS / TEST 승격 가능 후보.
- TEST app374.
- PRODUCTION app361.
- 다음 승격은 사용자 요청 시 TEST(main)으로 진행.
- PRODUCTION 승격은 TEST 검증 후 별도 명확한 승인 필요.

## 0RD. PREVIEW app375 배포 완료 — 새 공개곡 최신 목록 첫 칸 즉시 노출 (2026-10-07 KST)

사용자 TEST 실사용에서 발견:
- 새로 공개한 곡은 공개프로필에는 정상 노출됐지만 Explore 홈 `최신 공개곡`에서 바로 첫 칸에 보이지 않았음.
- 일정 시간이 지난 뒤 왼쪽 `<` 화살표가 활성화되고, 사용자가 화살표를 눌러야 새 공개곡이 보였음.
- 동일 증상은 PREVIEW에도 재현 가능성이 높은 공통 클라이언트 경로 문제로 판단.

원인:
1. 같은 기기에서 공개한 publication RTDB 신호는 global `onValue` listener가 self-echo 방지를 위해 **저장만 하고 화면 이벤트는 dispatch하지 않음**.
2. 사용자가 Music Note 공개 직후 빠르게 Explore로 이동하면, retained signal이 로컬에 저장되기 전에 Explore가 mount될 수 있고 이후 같은 기기 signal은 이벤트가 생략되어 즉시 repaint를 놓칠 수 있었음.
3. 새 카드가 나중에 `tracks` 앞쪽에 prepend되어도 최신 rail은 기존 horizontal `scrollLeft`를 유지하여 새 첫 카드가 왼쪽 화살표 뒤에 숨을 수 있었음.

app375 수정:
- `src/services/userDomainSyncService.ts`
  - canonical publication RTDB transaction 성공 직후 그 결과 signal을 같은 브라우저의 memory/localStorage에 즉시 저장.
  - 같은 브라우저에 `EXPLORE_PUBLICATION_SYNC_EVENT`를 즉시 dispatch.
  - cross-device RTDB listener의 기존 self-echo 차단은 그대로 유지하여 중복 이벤트를 만들지 않음.
  - 추가 D1/Worker 요청 없음. 기존 publication signal write 외 서버 비용 증가 없음.
- `src/pages/ExplorePage.tsx`
  - `최신 공개곡` rail만 첫 track ID가 바뀌면 scroll position을 **left=0**으로 즉시 복귀.
  - `useLayoutEffect`로 paint 전에 적용하여 새로 prepend된 곡이 왼쪽 밖에 숨지 않도록 함.
  - 추천/인기/크리에이터 등 다른 rail의 사용자가 보고 있던 위치는 유지.
- app version: **375**.

코드 / 감사:
- 기능 commit: `9a0bcaf4257fd4f423ee47c01d59bf3efb6d4409`.
- audit trigger commit: `9200b020a6ef200903215d5d4c1ace3cc5e9dd90`.
- Release System Audit Run `37556209976`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - `APP375_PUBLICATION_ORIGIN_IMMEDIATE_LOCAL_SIGNAL=PASS`
  - `APP375_EXPLORE_LATEST_NEW_PUBLICATION_FIRST_VISIBLE=PASS`
  - release/static/like/shared-D1 read-only audits PASS
  - `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`

PREVIEW 배포:
- deploy trigger commit: `4e05ea1f0af6279feb614ec960838e9846aeeeff`.
- Firebase PREVIEW Run `37556423502`: **SUCCESS**.
- `PREVIEW_APP_VERSION=375`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- app361 publication parity gate PASS.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker / Functions / shared D1 추가 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.

현재 환경:
- PREVIEW = **app375**
- TEST = app374
- PRODUCTION = app361
- shared D1 app373 W2 cutover는 기존 상태 그대로.

다음 실사용 gate:
- PREVIEW에서 한 번도 공개한 적 없는 Music Note 곡 1개를 공개.
- 공개 완료 후 Explore `최신 공개곡` 진입/복귀 시 **왼쪽 화살표를 누르지 않아도 새 곡이 첫 번째에 바로 보이는지** 확인.
- 기존 공개곡을 다른 메인 음원으로 전환했을 때 app374의 노란 제목/equalizer 초기화도 그대로 유지되는지 확인.
- PASS 시 app375를 TEST로 다시 승격 가능.
- FAIL 시 TEST/PRODUCTION 승격 중단, latest rail/local publication signal 경로만 추가 수정.

## 0RC. app374 TEST 승격 완료 — TEST_VERIFIED (2026-10-07 KST)

사용자 승인:
- PREVIEW app374 실사용 PASS 후 사용자가 TEST 배포 진행을 명확히 승인.

승격 기준:
- source PREVIEW SHA: `b572a5dd9f18c054f27e6557380a7c6066d46adf`
- PREVIEW app: **374**
- Release Controller Run `37552538672`: **SUCCESS**
- main(TEST) promoted SHA: `396a9862533e7e4f683a99cafe777c2fa40725c3`
- TEST_VERIFIED tag: `soridraw-test-v374-b572a5dd9f18`

TEST 배포/검증:
- TypeScript PASS
- Build PASS
- immutable preflight PASS
- TEST Explore Worker upload/activate/verify PASS
  - active version: `56828853-cf62-4552-a569-680ee34e9134`
- TEST Media Worker upload/activate/verify PASS
  - active version: `2f4a22c1-a4be-4e41-a8e1-98755becda14`
- Firebase TEST Hosting deploy + exact TEST verification PASS
- `TEST_CURATED_PARITY=PASS count=12`
- `TEST_PUBLIC_PROFILE_PARITY=PASS`
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`
- browser upgrade contract PASS
- old production cache → new release contract PASS
- Release Control final state: `TEST_VERIFIED`

보호 범위:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**
- 이번 TEST 승격에서 shared D1 schema/data 추가 mutation: **0**
- Firebase Functions/Rules 변경: **0**
- PRODUCTION branch / Hosting / Worker / Media Worker 비변경 확인.
- PRODUCTION은 app361 그대로 유지.

현재 환경:
- PREVIEW = app374
- TEST = **app374 / TEST_VERIFIED**
- PRODUCTION = app361
- shared D1 app373 first-publication W2 cutover는 공용 데이터 계층에 이미 적용되어 있음.

다음:
- TEST에서 사용자 실사용으로 공개 메인 음원 1↔2 전환 시 노란 제목/equalizer 초기화가 PREVIEW와 동일한지 확인.
- 공개상태 / MY프로필 / Explore 노출 정상 여부 확인.
- 이상 없으면 app374는 PRODUCTION 승격 후보이나, **정식배포는 사용자 별도 명확한 승인 전 금지**.

## 0RB. app374 PREVIEW 사용자 실사용 검증 PASS (2026-10-07 KST)

사용자 확인:
- PREVIEW app374에서 공개 메인 음원 1↔2 전환 시 기존 노란 제목/equalizer가 즉시 초기화되는 동작이 정상 적용됨.
- 신규 공개곡 / 기존 공개 이력 곡 모두 사용자 실사용 기준 정상.
- app373 first-publication W12→W2 비용 절감 구조는 그대로 유지.
- 추가 D1/Worker/Functions/Firebase Rules/user data 변경 없음.

현재 기준:
- PREVIEW app374 = 사용자 실사용 PASS / TEST 승격 가능 후보.
- TEST app361, PRODUCTION app361 유지.
- 다음 승격은 사용자 요청 시에만 TEST(main)으로 진행.
- PRODUCTION 승격은 TEST 검증 후 별도 명확한 승인 필요.

## 0RA. PREVIEW app374 배포 완료 — 공개곡 음원 전환 시 재생 표시 초기화 (2026-10-07 KST)

사용자 실사용에서 확인된 별도 UI 회귀:
- 공개곡 카드 중앙 Suno 링크를 눌러 노란 제목 + 중앙 equalizer 피드백이 활성된 상태에서,
- 같은 공개곡의 공개 설정에서 메인 음원을 1번→2번(또는 반대)으로 바꾸면 썸네일/링크는 새 음원으로 바뀌지만 기존 재생 피드백이 최대 3분30초 남아 있었음.
- 원인: 시각 피드백 session marker가 공개곡 `track.id`만 기억하고, 같은 track의 실제 Suno 링크가 바뀐 사실을 종료 조건으로 보지 않았음.

수정:
- `src/pages/ExplorePage.tsx`
  - 공개 메인 음원 선택이 실제 변경되었고 해당 카드가 현재 previewing 상태면,
  - 기존 visual timer 종료,
  - active preview track 해제,
  - sessionStorage preview visual marker 삭제,
  - 그 다음 새 썸네일/링크를 optimistic patch.
- 따라서 신규 공개곡/기존 공개곡 구분 없이 같은 `selectionChanged` 경로에서 동작.
- 실제 오디오 엔진/서버 playback 상태는 건드리지 않으며 기존의 “Suno 링크 열기 + 로컬 시각 피드백” 구조 유지.
- 관련 회귀검사 `APP374_EXPLORE_MEDIA_SWITCH_RESETS_PLAY_VISUAL` 추가.

코드:
- 기능 commit: `e9cbd68d3908de47b3dc1bbc11195e70ee28aa97`.
- app374/version gate commit: `cce0ec1d0190f897e96f6f42284460216ee022af`.
- Release System Audit Run `37551651930`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - static/release-system regression PASS
  - shared D1 read-only preflight PASS
  - TEST/PRODUCTION 비변경

PREVIEW 배포:
- deploy trigger commit: `0513c32506d915acd8fa1ca7cc57938f43bb0954`.
- Firebase PREVIEW App Run `37551851974`: **SUCCESS**.
- locked source: `0513c32506d915acd8fa1ca7cc57938f43bb0954`.
- `PREVIEW_APP_VERSION=374`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker / Functions / shared D1 추가 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.

비용 작업 실사용 확인:
- 사용자가 shared D1 cutover 이후 “한 번도 공개한 적 없는 Music Note 곡” 실제 최초 공개를 수행.
- 진단 화면 기준 first-publication:
  - D1 query write 1
  - physical rows_written **2**
  - Firestore R0/W0
  - page sync D1 R0/W0
- 즉 실제 앱 경로에서도 **W12 → W2** 목표 확인.
- 기존에 이미 공개 이력이 있는 곡의 공개 설정/음원 전환은 legacy compatibility row를 유지하지만 사용자 진단에서 해당 D1 mutation은 **W1**로 확인되어 비용 gate 합격 범위.
- 기존 공개곡을 새 schema로 강제 backfill/migration하지 않음.

현재 환경:
- PREVIEW = **app374**
- TEST = app361
- PRODUCTION = app361
- shared D1 app373 first-publication cutover는 세 환경 공용 데이터 계층에 적용된 상태.
- TEST/PRODUCTION 앱 코드는 이번 app374 배포에서 변경하지 않음.

다음:
- 사용자 PREVIEW에서 신규 공개곡 + 기존 공개곡 각각 한 번씩 메인 음원을 전환.
- 전환 즉시 이전 노란 제목/equalizer가 사라지고, 새 음원 중앙 버튼을 다시 눌렀을 때만 새 visual이 켜지는지 확인.
- PASS면 app374 TEST 승격 후보.
- FAIL이면 이 UI path만 재수정하고 D1 비용 구조/정상 publication 기능은 건드리지 않음.

## 0QZ. app373 shared D1 first-publication W12→W2 컷오버 적용 완료 (2026-10-07 KST)

사용자 명확한 승인:
- 2026-10-07 01:13 KST: **공유 D1 컷오버 승인**.
- 승인 범위: Music Note first-publication D1 W12 → W1~W2 비용 절감용 shared D1 index/trigger cutover.
- user row delete/backfill/rewrite, Worker/Hosting/Functions 배포는 승인 범위에 포함하지 않음.

릴리스 준비 / 안전성:
- app373 approved cutover source 준비 commit: `b320b57d11403def3b87d870ec00b5c7cdeac675`.
- release plumbing 재구성/future cutoff 고정 commit: `84a7dc12025cd72a64618f865495c3166e2891ab`.
- locked cutoff: **2026-10-07 03:00:00 KST** / `1791309600000`.
- migration blob: `f3a84c6abf20e33619507c48c55f30fae21db86e`.
- rollback blob: `d323b64cd29bd479d6fcf3577b55f84681905bf6`.
- verifier blob: `8d75d742959017401e1e046dfe19dcd98d361cce`.
- Release System Audit Run `37496811955`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - Static release-system verification PASS
  - critical shared-D1 workflow bash syntax gate PASS
  - TEST/PRODUCTION Worker dry-run PASS
  - live shared D1 read-only preflight PASS
  - main/production refs unchanged PASS

1차 shared-D1 release 시도:
- Run `37496079634`: **FAIL before any D1 mutation**.
- 원인: release workflow resolve shell의 rollback SHA 정규식 문자열 누락.
- migration/apply step까지 도달하지 않았으므로 shared D1 / user data / Worker / Hosting / Functions 변경 **0**.
- 동일 승인 범위에서 workflow를 main 기준으로 깨끗하게 재구성하고 bash `-n` 영구 gate를 추가한 뒤 재감사.

최종 shared-D1 cutover:
- trigger commit: `64bfc58c6408049fabf368727382dbdacad35d57`.
- canonical Shared D1 Release Run `37497179294`: **SUCCESS**.
- exact migration / rollback / verifier hash pinning PASS.
- pre-cutover live schema PASS.
- cutoff 이후 Music Note row 사전 존재: **0**.
- schema postflight PASS.
- canonical/derived user row counts before/after 동일: **PASS**.
- `PRAGMA quick_check` PASS.
- 실제 shared D1 synthetic first-publication probe:
  - **rows_written = 2**
  - **rows_read = 0**
  - `APP373_LIVE_FIRST_PUBLIC_REMOTE_D1_W2=PASS`
  - probe cleanup PASS.
- PREVIEW latest/popular feed post-cutover PASS.
- TEST latest/popular feed post-cutover PASS.
- PRODUCTION latest/popular feed post-cutover PASS.
- PREVIEW / TEST / PRODUCTION Explore Worker version 변경 없음 PASS.
- main / production branch ref 변경 없음 PASS.
- rollback 미실행; `APP373_SHARED_D1_CUTOVER=PASS`.

독립 live read-only post-audit:
- workflow update commit: `18fce8495973f79194590009be6cc00fbeda0b55`.
- Run `37497440023`: **SUCCESS**.
- PREVIEW / TEST / PRODUCTION R2 catalog/hybrid/publication authority PASS.
- `APP373_LIVE_POSTCUTOVER_SCHEMA=PASS`.
- `APP373_SHARED_D1_CUTOVER_APPLIED=true`.
- audit remote D1 writes: **0**.

실제 동작 기준:
- 컷오버 schema는 이미 shared D1에 설치됨.
- **2026-10-07 03:00 KST 이후 D1에 처음 생성되는 Music Note publication row**부터 low-cost 경로 적용.
- first-publication의 `tracks.created_at`은 기존 row가 없으면 publication 순간의 `Date.now()`이므로, 과거에 Music Note에서 만든 곡이라도 D1에 한 번도 공개 row가 없었다면 03:00 이후 첫 공개 시 새 경로 대상.
- 기존 D1 Music Note row와 non-Music-Note row는 legacy compatibility 유지.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.
- Worker / Firebase Hosting / Functions / Rules 배포 없음.
- app version은 PREVIEW / TEST / PRODUCTION 모두 **361** 그대로.

다음 실사용 gate:
- 03:00 KST 이후 **한 번도 공개한 적 없는 Music Note 곡 1개**를 공개하여 실제 Worker 전체 경로를 확인.
- 목표: D1 first-publication W1~W2, 공개 버튼 즉시 정상, MY프로필/Explore 정상, 검색/프로필 parity 정상.
- W3+ 또는 UI/parity 이상이면 추가 승격/확대 중단하고 원인 분석.
- 이미 shared D1 공용 schema가 적용되었으므로 이 검증을 위해 TEST/PRODUCTION 코드 재배포는 하지 않는다.

## 0QY. app371 영구 승격 gate 완료 + app372 first-publication W12→W2 안전증명 완료 (2026-10-07 KST)

### 1. Music Note 공개상태 parity 371 영구 gate

app361 incident에서 발견된 “서버/프로필은 공개인데 Music Note 공개 버튼만 오래된 origin cache로 비활성” 회귀를 다시 통과시키지 않도록 `verify-371-music-note-publication-origin-parity.ts`를 일반 릴리스 경로에 영구 연결했다.

preview commit:
- `b2ce5fe2ca5e7a4444bef76134c6d61ac4d3cfae`

영구 연결 위치:
- Release Controller PREFLIGHT
- TEST_VERIFY
- PROD_PREFLIGHT
- Release System Audit
- PREVIEW App Release
- `verify-release-promotion-system.mjs` 자체 정적 gate

Release System Audit Run `37489891135`: **SUCCESS**
- TypeScript PASS
- Build PASS
- `RELEASE_PROMOTION_SYSTEM_STATIC=PASS`
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`
- `UNCHANGED_MUSIC_NOTE_REENTRY_WORKER_ZERO_CONTRACT=PRESERVED`
- `RETAINED_PUBLICATION_SIGNAL_BOUNDED_REPAIR=PASS`
- `PUBLIC_AND_LOCK_BUTTON_RENDER_CONTRACT=PRESERVED`
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`
- TEST/PRODUCTION 배포 없음
- 사용자 데이터 변경 없음

### 2. first-publication W12→W1~W2 app372 prep-only 후보

현재 shared D1의 never-published Music Note 첫 공개 물리 쓰기 **W12**를 줄이기 위한 새 cutover 후보와 rollback을 PREVIEW에 준비했다.

핵심 설계:
- 기존 사용자/기존 Music Note row는 기존 D1 index/trigger 동작을 그대로 유지.
- non-Music-Note row도 기존 동작 유지.
- cutover 이후 새로 최초 공개되는 Music Note row만:
  - canonical `tracks` + PK는 유지
  - legacy secondary index / derived mirror / shared revision fanout에서 제외
  - Feed/profile/search 조회는 이미 세 환경에 존재하는 shared R2 authority 사용
- 사용자 원본 row 삭제/변환/backfill 없음.
- 전체 Feed/profile/search rebuild 없음.
- cutover SQL은 `__SORIDRAW_PUBLICATION_W2_CUTOVER_MS__` placeholder가 남아 있어 승인된 release 경로에서 고정 cutoff를 찍기 전에는 직접 실행 불가.
- rollback은 기존 index/trigger 동작을 복원.

준비 commit:
- `1fd6d5d5e7116908ff73574adc95e9885ee559a4`
- verifier syntax 수정: `d5cffa5ae341345e060dfb3b2a5648c394b02ece`
- 측정 trigger: `dde5bb6c5cf5e5335cf2e7b2f7fa20e13027c4fa`

Release System Audit Run `37492203345`: **SUCCESS**
- TypeScript PASS / Build PASS
- `APP372_FIRST_PUBLICATION_W2_CUTOVER_STATIC=PASS`
- `APP372_CANONICAL_TRACK_ROW_PRESERVED=PASS`
- `APP372_PRECUTOVER_AND_NON_MUSIC_NOTE_COMPAT=PASS`
- `APP372_R2_AUTHORITY_FLAGS=PASS`
- `APP372_AUTO_APPLY_WIRED=false`
- `APP372_USER_DATA_MIGRATION=false`
- `APP372_SHARED_D1_APPLIED=false`

실제 Cloudflare **격리 임시 D1** 물리 비용 측정:
- 현재 first-publication 재현: **W12 / R2**
- 후보 적용 후 first-publication: **W2 / R0**
- 후보 적용 후 source/media swap: **W1 / R1**
- 후보 적용 후 private: **W1 / R1**
- 후보 적용 후 republish: **W1 / R1**
- no-op: **W0 / R1**
- pre-cutover Music Note: 기존 **W12 / R2** 보존
- non-Music-Note: 기존 **W12 / R2** 보존
- rollback 후 first-publication: 기존 **W12 / R2** 복구
- 임시 D1 삭제 PASS
- shared 실제 사용자 D1 write **0**

### 3. 실제 세 환경 live readiness read-only 확인

PREVIEW / TEST / PRODUCTION의 현재 Explore Worker와 shared D1을 쓰기 없이 직접 감사하는 gate를 추가했다.
- audit workflow update commits: `d7e5d9bb6f7dfd9f92497f5cf1e40522993e7129`, `507b062eb1ca7800425bff127663a1f63a1641ba`
- 첫 시도 `37493057422`는 live Worker marker 검사 방식이 너무 엄격해 FAIL; **데이터/배포 변경 없음**.
- 실제 composed function 기준으로 수정 후 Run `37493247036`: **SUCCESS**.

live 확인:
- PREVIEW / TEST / PRODUCTION 모두 같은 shared D1 ID 사용 PASS.
- 세 환경 모두 shared `PROFILE_MEDIA=soridraw-profile-media` PASS.
- 세 환경 모두:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- R2 catalog / hybrid / publication R2-only composed functions 세 환경 모두 존재 PASS.
- `PREVIEW_APP372_R2_CUTOVER_READINESS=PASS`
- `TEST_APP372_R2_CUTOVER_READINESS=PASS`
- `PRODUCTION_APP372_R2_CUTOVER_READINESS=PASS`
- 현재 shared D1은 아직 기존 pre-cutover schema 그대로:
  - `APP372_LIVE_PRECUTOVER_SCHEMA=PASS`
  - `APP372_SHARED_D1_CUTOVER_APPLIED=false`
  - `REMOTE_D1_WRITES=0`

### 현재 gate

기술적으로는 **first-publication W12→W2 shared-D1 cutover 직전까지 준비/증명 완료**.

하지만 다음 단계는 shared D1의 index/trigger를 실제 변경하는 schema cutover다. 사용자 원본 row를 바꾸지는 않지만 **공유 운영 D1 구조 변경**이므로 기존 안전 규칙에 따라 **사용자의 명확한 별도 승인 전 실행 금지**.

현재 실제 서비스:
- PRODUCTION app361 정상 유지.
- TEST app361 정상 유지.
- PREVIEW app361 제품 런타임 정상 유지.
- 이번 app372 작업은 아직 shared D1 / Hosting / Worker / Functions에 배포하지 않음.
- 사용자 데이터 변경 0.

## 0QX. app361 PRODUCTION incident 역반영 완료 — TEST + PREVIEW 동기화 (2026-10-07 KST)

사용자 확인:
- 정식앱 app361에서 Music Note 공개 체크가 실제 공개 상태와 정상 수렴하는 것을 사용자 실기기에서 확인.
- 이 건은 정상 개발 승격이 아니라 `incident recovery` 후 역반영으로 처리: **PRODUCTION hotfix → TEST → PREVIEW** 런타임 순서 유지.

역반영 소스:
- PRODUCTION app361 기준 HEAD: `b20c20a2a1a10a794806474e2b84c6b08b5faf63`.
- PREVIEW 준비 commit: `3019b20bc7d3f4f7a21ce0b2658ccf3a4997af92`.
- PRODUCTION에서 정확히 역반영한 제품 파일:
  - `public/app-version.json`
  - `src/pages/FavoritesPage.tsx`
  - `src/services/exploreEnvironmentParityPolicy.ts`
  - `src/services/explorePublicationService.ts`
  - `scripts/verify-371-music-note-publication-origin-parity.ts`
- PRODUCTION incident 전용 임시 Hosting workflow/trigger는 PREVIEW/TEST 제품 소스로 복사하지 않음.

TEST 역반영:
- Release Controller Run `37485002429`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW: `3019b20bc7d3f4f7a21ce0b2658ccf3a4997af92`.
- main(TEST) SHA: `21b2ac98370e0644c4ab245fc3fd9965d1cc4fb6`.
- immutable tag: `soridraw-test-v361-3019b20bc7d3`.
- app version: **361**.
- TEST Explore Worker active: `7c91d7bb-3e34-4bf0-91ca-62c9de930c6f`.
- TEST Media Worker active: `d80fdd58-3857-4314-a8d4-f35023971588`.
- Worker/Media code identity는 app360과 동일 code SHA이며 기능 코드 변경 없음.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`.
- `TEST_WORKER_VERIFY=PASS` / `TEST_MEDIA_WORKER_VERIFY=PASS`.
- old-production-cache upgrade contract / app358-360 regressions PASS.
- PRODUCTION 비변경 확인.

PREVIEW 역반영:
- deploy trigger commit: `21d57b00a917e173a47223783c6caab22636138d`.
- Firebase PREVIEW App Run `37485563687`: **SUCCESS**.
- `PREVIEW_APP_VERSION=361`.
- `PREVIEW_EXACT_BUILD=PASS`.
- TypeScript PASS / Build PASS / app358-360 regression PASS.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- PREVIEW Worker / Functions 변경 및 재배포 없음.
- `TEST_PRODUCTION_UNCHANGED=PASS`.

데이터/비용 안전:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**.
- D1 schema migration: **0**.
- Firebase Functions/Rules 변경: **0**.
- app361 수정은 브라우저 origin별 오래된 Music Note 공개상태 cache가 최신 UID publication signal을 놓친 경우에만 bounded 수렴시키는 클라이언트 복구이며, 앱 버전만으로 전체 공개상태를 다시 읽는 구조를 추가하지 않음.

현재 기준:
- PRODUCTION = app361.
- TEST = app361.
- PREVIEW = app361.
- Music Note 공개상태 수렴 hotfix는 세 환경에 역반영 완료.
- 정상 좋아요 / 저장하트 / 잠금 / Music Note / Library / 공개·비공개 mutation UI는 frozen baseline으로 계속 보호.

다음:
- first-publication D1 W12 → W1~W2 비용 최적화 재개 전, `verify-371-music-note-publication-origin-parity.ts`를 일반 Release Gate/감사 경로에 영구 연결하는 소규모 릴리스 시스템 보강을 먼저 완료한다.
- 이후 새 PREVIEW 작업으로 first-publication W12 → W1~W2 최적화를 재개한다.

## 0QW. app360 PRODUCTION Music Note 공개버튼 parity 회귀 / 영구 승격 gate 강화 (2026-10-06 KST)

사용자 실기기 발견:
- 동일 곡의 Music Note 공개 버튼이 한 환경에서는 활성인데 정식앱에서는 비활성으로 표시되는 불일치 확인.
- app360 PRODUCTION 자체는 exact TEST_VERIFIED artifact 승격이었으나, 기존 Release Gate가 Music Note 카드의 publication-state 버튼을 browser-visible parity 항목으로 직접 검사하지 못한 누락이 확인됨.
- 이 건은 **Release System FAIL**로 기록한다. 서버/API parity PASS만으로 실제 버튼 상태 parity를 PASS 처리하지 않는다.

영구 승격 불변조건 추가:
- 최근 생성곡 / Music Note / Library 등 같은 사용자 곡의 상태형 UI는 버전·환경과 무관하게 동일 canonical 상태를 보여야 한다.
- 상시 비교 대상: 저장/하트, Explore 좋아요+숫자, 잠금, 공개/비공개, Music Note/Library membership, media/thumbnail.
- PREVIEW↔TEST↔PRODUCTION뿐 아니라 기존 PRODUCTION persistent cache → 새 릴리스 업그레이드에서도 같은 곡 기준 버튼 fill/active 및 membership 일치를 검증한다.
- 하나라도 다르면 TEST_VERIFIED/RELEASED 금지.

현재 판단:
- `src/services/explorePublicationService.ts`는 정상 Music Note 진입에서 기존 `explore-publication-states` persistent cache가 있으면 `options.revalidate !== true`일 때 즉시 반환한다.
- 따라서 오래된 PRODUCTION-origin cache가 남은 경우 실제 shared publication 상태와 다른 버튼 표시가 유지될 수 있는 경로가 존재한다.
- 다음 PREVIEW 작업은 이 수렴 gap만 최소 수정하고, 앱 버전 기반 cache bust/전체 DB 조회/정상 좋아요·잠금·공개 mutation 변경은 금지한다.
- first-publication D1 W12→W1~W2 최적화는 이 회귀와 Release Gate 보강이 끝난 뒤 재개한다.
- 사용자 데이터 migration/backfill/delete/rewrite 0. 현재 문서 변경만 수행하며 TEST/PRODUCTION 추가 배포 없음.

## 0QV. app360 PRODUCTION 정식배포 완료 / RELEASED (2026-10-06 KST)

사용자 명확한 `정식배포` 승인 후 final TEST_VERIFIED artifact를 exact promotion:
- Release Controller PRODUCTION Run `37461102504`: **SUCCESS / RELEASED**.
- manifest/tag: `soridraw-test-v360-d4c9d57cea80`.
- tested main: `208cc8949dc60cb056066828ce78ef2fce764e0c`.
- production promoted SHA: `78691ec733d7efcb254b904dc512af49124641cc`.
- production commit: `release: promote TEST_VERIFIED app 360 to PRODUCTION`.
- app version: **360**.
- bootstrap tag `soridraw-test-v360-0d27ac79c2d8` was not used.
- latest PREVIEW was not rebuilt/reinterpreted for PRODUCTION.

PRODUCTION preflight:
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`: PASS.
- TEST↔PRODUCTION allowed environment differences: PASS.
- app360 executable gates PASS:
  - `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`
  - `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`
  - `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`
  - `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`

PRODUCTION deployment:
- Explore Worker before `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa` -> after `4e845257-2fc5-46a0-9f46-04396ca729dc`.
- Explore Worker bundle SHA `7165d23c93a8f9b602118305f3ee3a32a82c497fe46e1ef867c29cc67139daa8`.
- Explore Worker code SHA `f6e1802f859b800cd245eb5c806a5e6ef4124ed42fcdc6799c89a004bb5bc3a2`.
- Media Worker before `a3b87bbc-af2d-41eb-9e26-99dda0dbfc44` -> after `a710fd22-8aa6-4386-b22a-d5510125fb2e`.
- Media Worker bundle/code identity exact PASS.
- Firebase PRODUCTION Hosting cloned from verified TEST Hosting: PASS.
- live Firebase URL `https://soridraw.web.app` deployed.
- `https://soridraw.web.app/` and `https://soridraw.com/` exact release index SHA verification: PASS.

PRODUCTION verification:
- `PRODUCTION_CURATED_PARITY=PASS count=12`.
- `PRODUCTION_PUBLIC_PROFILE_PARITY=PASS`.
- `PRODUCTION_RELEASE_ENVIRONMENT_PARITY=PASS reference=TEST attempt=1`.
- `PRODUCTION_WORKER_SMOKE=PASS` / `PRODUCTION_WORKER_VERIFY=PASS`.
- `PRODUCTION_MEDIA_WORKER_SMOKE=PASS` / `PRODUCTION_MEDIA_WORKER_VERIFY=PASS`.
- Worker schedules preserved.
- release control final state: `RELEASED`.

Data / backend safety:
- user source data copy/migration/backfill/delete/rewrite: **0**.
- D1 schema migration: **0**.
- Firebase Functions/Rules change: **0**.
- production promotion was code/artifact promotion only; shared user data remained in place.

Current stable release:
- PREVIEW branch may now move independently for new work.
- TEST main remains validated app360 baseline.
- PRODUCTION is app360 at `78691ec733d7efcb254b904dc512af49124641cc`.
- next development focus may resume first-publication D1 W12 -> W1~W2 optimization only as a new PREVIEW task, without touching the frozen app360 production baseline.
### 2026-10-06 user TEST validation — app360 PASS
- User confirmed TEST app360 behavior is now okay after real-device validation.
- This closes the current app360 TEST user-validation gate for the My Likes/public-profile convergence regression.
- Final production candidate remains immutable tag `soridraw-test-v360-d4c9d57cea80` only.
- PRODUCTION is still unchanged and must not be promoted until the user gives an explicit `정식배포` approval.
## 0QU. app360 최종 TEST_VERIFIED 완료 / TEST 실사용 검증 단계 (2026-10-06 KST)

사용자 승인된 app360 TEST 승격 최종 완료:
- 최종 frozen PREVIEW source: `d4c9d57cea80944853e41c0911c21a24c88752ba` (app360 code + docs-only controller bootstrap record).
- final Release Controller Run `37436812301`: **SUCCESS / TEST_VERIFIED**.
- final main SHA: `208cc8949dc60cb056066828ce78ef2fce764e0c`.
- final immutable TEST tag: `soridraw-test-v360-d4c9d57cea80`.
- app version: **360**.
- TEST Explore Worker active version: `9835f91b-4c86-43db-ba30-bd8e5eaeffb8`.
- TEST Explore Worker bundle SHA: `7165d23c93a8f9b602118305f3ee3a32a82c497fe46e1ef867c29cc67139daa8`.
- TEST Explore Worker code SHA: `f6e1802f859b800cd245eb5c806a5e6ef4124ed42fcdc6799c89a004bb5bc3a2`.
- TEST Media Worker active version: `f947084a-15a7-4549-a921-09d32595f5ba`.
- TEST Media bundle/code identities PASS.
- Firebase TEST Hosting deployed and actual `https://soridraw-test.web.app` + custom TEST URL app-version/exact index verification PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`.
- `TEST_WORKER_SMOKE=PASS` / `TEST_WORKER_VERIFY=PASS`.
- `TEST_MEDIA_WORKER_SMOKE=PASS` / `TEST_MEDIA_WORKER_VERIFY=PASS`.
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7` PASS.
- TEST↔PRODUCTION allowed environment diff contract PASS.
- PRODUCTION branch/Worker/Media Worker/Hosting non-mutation checks PASS; production ref remains `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

app360 My Likes cost regression fixed before TEST:
- app359에서 사용자가 일정 시간이 지난 뒤 `공개곡 ↔ 좋아요 곡` 왕복 시 1회 Worker +2와 새로고침 같은 갱신을 관찰.
- 원인: 5분 legacy private like revision HEAD가 My Likes tab entry 및 visible-heart hydration에서도 호출될 수 있었음.
- app360은 timed revision HEAD를 **실제 hidden→visible browser resume fallback에만 유지**.
- My Likes tab navigation 및 cached heart hydration에서는 timed revision Worker read 제거.
- 실제 same-account like change는 기존 RTDB change signal로 동기화.
- `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`.
- `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`.
- `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`.
- `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`.

공개/비공개 프로필 반영:
- 사용자 체감은 기존 약 20분 stale Edge 상태에서 약 **1분 내외**로 축소 확인.
- 현재 구조에는 publication/profile fallback의 60초 bounded revalidation window가 존재하며, 실제 mutation signal 경로는 캐시 우회를 사용.
- 따라서 20분 stale-cache 회귀는 해소되었고, 약 1분 fallback 수렴은 현재 설계 범위로 기록.

릴리스 주의:
- bootstrap TEST tag `soridraw-test-v360-0d27ac79c2d8`는 **PRODUCTION 사용 금지**.
- 향후 PRODUCTION 후보는 오직 final tag `soridraw-test-v360-d4c9d57cea80`.
- 이후 PREVIEW docs HEAD가 바뀌더라도 production은 latest preview를 rebuild하면 안 됨.
- 사용자 명확한 `정식배포` 승인 전 PRODUCTION 승격 금지.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0. D1 schema migration 0. Firebase Functions 변경 0.
## 0QT. app360 TEST 1차 승격 완료 / 새 controller identity로 최종 TEST 재검증 필요 (2026-10-06 KST)

사용자 TEST 승격 승인 후 app360 1차 TEST 승격 완료:
- PREVIEW app360 exact Hosting Run `37436007480`: SUCCESS.
- frozen PREVIEW source: `0d27ac79c2d8fed053fc2949cbfdad05fff794b7`.
- app360 regression PASS:
  - `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`
  - `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`
  - `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`
  - `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`
- Release Controller TEST Run `37436278070`: SUCCESS / TEST_VERIFIED.
- first TEST tag: `soridraw-test-v360-0d27ac79c2d8`.
- main promoted to `d42444e85efae30a6915e64b9604e8c81b3f9306`.
- TEST curated parity PASS / public-profile parity PASS / environment parity PASS.
- production environment contract PASS.
- PRODUCTION ref unchanged: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

중요:
- 이번 app360에서 Release Controller workflow 자체에 app358/359/360 executable gates가 추가됨.
- 위 1차 TEST Run은 issue_comment 특성상 당시 default `main`의 직전 controller identity로 실행됨.
- 따라서 첫 tag `soridraw-test-v360-0d27ac79c2d8`는 **TEST bootstrap 증거로만 유지하고 PRODUCTION 승격 근거로 사용 금지**.
- 현재 main에는 app360 controller가 승격되었으므로, docs-only PREVIEW SHA를 새로 만들고 새 main controller로 TEST를 1회 재검증하여 최종 schema4 TEST_VERIFIED manifest를 생성한다.
- 사용자 데이터 migration/backfill/delete/rewrite 없음. D1 schema 변경 없음.
### 2026-10-06 user verification — app359 changed-like Worker behavior
- User observed that after app359, Worker/personal social snapshot counters rise only when an actual like membership changes (a track is added to or removed from My Likes).
- Screenshot evidence: like mutation path shows bundled like save Worker 1 / D1 W1, public-like-card refresh Worker 1 / D1 R0 W0, private likes-revision Worker 1 / D1 R0 W0, and personal social snapshot reconciliation during the actual change.
- This is consistent with the intended cost contract: unchanged tab/page navigation should stay local, while a real membership change may spend bounded Worker/read work and one canonical write.
- Treat the prior `공개곡 ↔ 좋아요 곡` repeated-repair regression as PASS **provided counters no longer rise on unchanged repeated tab switching**.
- Remaining release gate: confirm publication visibility/profile list no longer waits ~20 minutes after public/private change.
### 2026-10-06 user verification — app359 My Likes count
- User refreshed/updated PREVIEW app359 and confirmed own-profile `좋아요 곡` now shows **16 tracks**.
- This matches the read-only canonical proof: D1 public+published liked relations=16 and shared personal-like R2 exact count=16.
- Prior PREVIEW/TEST/PRODUCTION screens showing >20 were therefore display/cache-settlement drift, not proof that canonical shared user data contained >20 public+published likes.
- TEST/PRODUCTION remain unchanged at this point; app359 has not yet been promoted.
- Remaining PREVIEW ship gate before TEST: confirm repeated `공개곡 ↔ 좋아요 곡` navigation no longer causes repeated Worker repair after the one-time settlement, and confirm publication visibility reaches profile without the old ~20 minute delay.
## 0QS. app359 PREVIEW 배포 완료 / My Likes 20곡 원인 확정 및 stale local guard 정리 (2026-10-06 KST)

사용자 관찰:
- app358 PREVIEW의 own-profile `좋아요 곡`이 이전 스물몇 곡에서 정확히 20곡으로 바뀜.
- 이 상태를 그대로 TEST에 올리지 않고 read-only 실데이터 진단 후 원인을 확정.

read-only 실데이터 진단 Run `37414720890`: SUCCESS / no mutation.
- target public profile resolve: 1.
- canonical D1 like relation 전체: **30**.
- 그중 현재 공개+published 곡: **16**.
- 비공개 또는 unpublished 관계: **14**.
- pending q069=0 / q075=0.
- shared personal-like R2 likedTrackIds: **16**.
- R2 `canonicalComplete156=true`, `exactLikeCount156=16`.
- R2 source=`verified-cross-origin-d1-358`.
- 즉 서버 canonical/공유 R2 기준은 16인데 브라우저가 20곡을 보인 것은 서버 20곡 제한이 아니라 **과거 accepted-but-unsettled local guard가 4곡을 추가로 보호하던 현상**으로 판단.

app359 수정:
- app358의 canonical R2 repair 뒤에도 남을 수 있는 historical local snapshot guards를 app189의 기존 fresh settlement proof로 1회 정리.
- settlement은 새 shared-R2 revision에 묶여 queue-empty + canonical/R2 + ETag 검증을 통과해야만 guard를 해제.
- 현재 사용자의 실제 미전송 outbox는 기존 app189 보호 규칙 그대로 보존.
- 같은 retained signal에 대한 app359 settlement upgrade는 origin당 1회만 허용; 이후 탭/페이지 왕복은 반복 Worker 금지.
- 새 실제 like signal이 생긴 경우에만 다음 bounded settlement 기회가 열림.

검증/배포:
- Release System Audit Run `37415142727`: **SUCCESS**.
- TypeScript PASS / Vite Build PASS / 기존 회귀검사 PASS.
- `APP359_CANONICAL_R2_THEN_FRESH_SETTLEMENT=PASS`.
- `APP359_SAME_SIGNAL_REPEAT_WORKER_BLOCKED=PASS`.
- `APP359_CURRENT_OUTBOX_PROTECTED_BY_EXISTING_189_LOGIC=PASS`.
- Firebase PREVIEW App Release Run `37415347786`: **SUCCESS**.
- PREVIEW app version: **359**.
- PREVIEW Explore Worker는 app358 Worker `117d5f65-e34d-4c58-8030-498193deb1b4` 그대로 사용(Worker 재배포 불필요).
- TEST/main 및 PRODUCTION 비변경.
- user data migration/backfill/copy/delete/rewrite 0.
- D1/R2 진단은 read-only; app359은 사용자 원본 데이터 변경 없음.

현재 gate:
1. `preview.soridraw.com` app359에서 own-profile `좋아요 곡` 재확인.
2. 정상 기준은 현재 canonical public/published membership **16곡** + 현재 미전송 사용자 의도가 있다면 그 의도만 임시 overlay.
3. 앱359 최초 정리 뒤 `좋아요 곡 ↔ 공개곡` 반복 왕복 시 같은 Worker repair가 반복 증가하면 FAIL.
4. 공개/비공개 후 프로필은 20분 대기 없이 change signal로 수렴해야 함.
5. 위 확인 전 TEST 승격 금지.
6. 확인 PASS 후 app359 전체를 TEST로 새 승격하고 새 TEST_VERIFIED manifest 생성.
7. app357 TEST manifest는 계속 PRODUCTION 사용 금지.

## 0QR. app358 PREVIEW 배포 완료 / 공개프로필 지연·My Likes 반복 Worker 회귀 수정 검증 단계 (2026-10-06 KST)

사용자 실사용에서 app357 TEST_VERIFIED 이후 추가 회귀가 발견되어 **기존 app357 TEST manifest는 PRODUCTION 승격 근거로 폐기**:
- PREVIEW와 TEST의 own-profile 좋아요 곡 목록이 서로 달랐음.
- 좋아요 곡 탭을 반복 클릭할 때 새로고침 없이도 Worker 요청이 반복 상승하는 현상 관찰.
- 공개/비공개 전환 뒤 공개프로필 공개곡 목록이 약 20분 동안 이전 상태로 남고 이후에야 수렴.
- 따라서 `soridraw-test-v357-32c85eded45c`는 더 이상 PRODUCTION 승격에 사용 금지.

app358 PREVIEW 수정:
1. **공개프로필 변경 신호 즉시 수렴**
   - 실제 publication RTDB 신호가 있을 때만 origin-local positive Edge shell을 우회.
   - shared `PROFILE_MEDIA`의 public-profile R2 authority를 직접 확인.
   - change-driven 경로는 D1 R0/W0 유지.
   - 일반 재진입/페이지 이동은 기존 local-first 캐시 유지.
2. **My Likes 반복 Worker 차단**
   - retained like signal 하나당 cross-origin repair 시도는 최대 1회.
   - 같은 signal에서 탭 재클릭/페이지 재진입은 repair Worker를 반복 호출하지 않음.
   - 오래된 partial shared-like R2가 canonical D1과 달라진 계정은 그 1회 bounded account repair에서 shared derived R2 catalog를 exact 상태로 복구.
   - D1은 read-only canonical comparison만 허용하며 relation/user source data 변경 없음.
3. UI/좋아요 토글/공개·비공개/Music Note/Library/폴더 정상 기능은 변경하지 않음.

검증/배포:
- Release System Audit Run `37413168427`: **SUCCESS**.
- TypeScript PASS / Vite Build PASS.
- app358 executable regression:
  - `APP358_PROFILE_SIGNAL_SHARED_R2_BYPASS=PASS`
  - `APP358_MY_LIKES_ONE_REPAIR_PER_SIGNAL=PASS`
  - `APP358_PERSONAL_LIKE_REPAIR_D1_READONLY=PASS`
- PREVIEW Explore Worker Run `37413466047`: **SUCCESS**.
  - before `39602152-bbf9-400c-9076-18c6c1d2b0b8`
  - active after `117d5f65-e34d-4c58-8030-498193deb1b4`
  - live `APP358_PROFILE_SIGNAL_SHARED_R2_LIVE=PASS`
  - profile signal path D1 R0/W0 PASS.
  - TEST Worker `ef64f24d-8e65-4921-a96d-b52e1d8db62d` unchanged.
  - PRODUCTION Worker `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa` unchanged.
- Firebase PREVIEW Hosting Run `37413571015`: **SUCCESS**.
  - locked source `8bd79632c7c232216da62271634429dedf4c3aee`.
  - `PREVIEW_APP_VERSION=358`.
  - `PREVIEW_EXACT_BUILD=PASS`.
  - `TEST_PRODUCTION_UNCHANGED=PASS`.
  - shared RTDB rules deploy SKIPPED (변경 없음).
- main(TEST) ref remains `d4852c7b85955effd0714b88c62ec10a4c96bb2e`.
- production ref remains `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.
- user data migration/backfill/copy/delete/rewrite 0.
- D1 schema migration/write 0.
- Functions 변경 0.

현재 합격 대기:
1. 사용자 PREVIEW 실기기에서 own-profile → 좋아요 곡을 연속 여러 번 전환해 **첫 stale repair 이후 반복 Worker 증가가 없는지** 확인.
2. PREVIEW에서 공개↔비공개 변경 후 프로필 공개곡 목록이 **20분 대기 없이 바로 수렴**하는지 확인.
3. PREVIEW 좋아요 곡 목록이 실제 좋아요 membership과 일치하는지 확인.
4. 위 3개 PASS 전 TEST 승격 금지.
5. PASS 후 app358 전체 PREVIEW를 TEST로 새 승격하여 새 TEST_VERIFIED manifest 생성.
6. 기존 app357 manifest/태그로 PRODUCTION 승격 금지.
7. 사용자 명확한 정식배포 승인 전 PRODUCTION 변경 금지.

## 0QQ. schema4 TEST_VERIFIED 최종 재검증 완료 / TEST 실사용 확인 단계 (2026-10-06 KST)

사용자 승인된 TEST 승격 흐름의 2차 검증 완료:
- Release Controller Run `37407657202`: **SUCCESS / TEST_VERIFIED**.
- 고정 source PREVIEW SHA: `32c85eded45c49e0e735c685a05b2efe8702c8ce`.
- TEST main promoted SHA: `d4852c7b85955effd0714b88c62ec10a4c96bb2e`.
- app version: **357**.
- immutable release tag: `soridraw-test-v357-32c85eded45c`.
- manifest: **schema 4 / TEST_VERIFIED**.
- TEST Explore Worker active version: `ef64f24d-8e65-4921-a96d-b52e1d8db62d`.
- TEST Media Worker active version: `3c167990-7194-4301-81da-791a21989156`.
- Firebase TEST Hosting deploy + exact index/app-version verify PASS.
- latest/popular shared Feed parity PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- shared Catalog flag=1 / Media health+bindings+smoke PASS.
- TEST↔PRODUCTION 허용 환경 차이 계약 PASS.
- Explore compiled code SHA TEST=PRODUCTION `13d809a3eca35366e25d85fefda3ebc0faa6a88968157a8afbf81a0e8178cf03`.
- Media compiled code SHA TEST=PRODUCTION `f0507a8464a1147e2bc914b6cd681ee1f1531ecfc3afb40ab7a73b8e55990bc9`.
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`.
- app366 cross-environment profile/My Likes parity verifier PASS.
- app367 old-production-cache upgrade verifier PASS.
- TypeScript PASS / Vite Build PASS / release static+mutation guard PASS.
- D1 preflight SELECT-only PASS. migration/backfill/seed/delete/rewrite 없음.
- PRODUCTION branch/Hosting/Explore Worker/Media Worker **비변경**.
- 현재 PRODUCTION ref: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

중요:
- 직전 bootstrap schema3 tag `soridraw-test-v357-8ad97e799c24`는 계속 PRODUCTION 사용 금지.
- PRODUCTION 승격 근거는 오직 schema4 tag `soridraw-test-v357-32c85eded45c`.
- 이후 PREVIEW의 docs-only HEAD가 바뀌더라도 이번 TEST_VERIFIED source는 위 SHA로 고정한다.
- 사용자 별도 명확한 정식배포 승인 전 PRODUCTION 변경 금지.

다음:
1. 사용자가 `test.soridraw.com`에서 app357 실사용 확인.
2. Explore Feed / SORIDRAW 추천 / 공개프로필 공개곡·핀 / own-profile 좋아요 곡 / shared Catalog 기반 Music Note·Library의 핵심 체감 확인.
3. 이상 없으면 사용자의 명확한 정식배포 승인 후 위 schema4 manifest **그 하나만** 사용해 PRODUCTION 승격.
4. PRODUCTION 승격은 재build/reassembly 없이 TEST 검증 artifact exact promotion만 허용.
5. app357 parity 종료 전 first-publication W12→W1~W2 비용 작업 재개 금지.

## 0QP. TEST bootstrap 1차 완료 / schema4 TEST_VERIFIED 재검증 진행 단계 (2026-10-06 KST)

사용자 `테스트배포` 승인 후 one-time bootstrap 1차 완료:
- Release Controller Run `37407282504`: **SUCCESS**.
- target PREVIEW SHA: `8ad97e799c2418443f2a39e722152622fdaf8f39`.
- TEST app version: **357**.
- TEST Explore Worker: `833debce-7179-4353-88f7-e920743512f7`.
- TEST Media Worker: `217c81c6-bfef-48c6-8a07-e8c028be7b11`.
- TEST latest/popular shared Feed parity PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- TEST shared Catalog flag=1 / Media smoke PASS.
- Firebase TEST Hosting deploy SUCCESS.
- main promoted to `66ad632afab1259009efae387c0f41ccea2b4b26`.
- PRODUCTION branch/Hosting/Workers는 변경하지 않음.

중요:
- 이 Run은 이전 main controller가 실행한 **bootstrap 전용** Run.
- 생성 tag `soridraw-test-v357-8ad97e799c24`의 manifest는 schema3이므로 **PRODUCTION 승격 근거로 사용 금지**.
- bootstrap 결과 main에는 새 production-first controller가 설치됨.
- main ↔ preview controller workflow blob exact-match PASS:
  - workflow blob `b0a879b2bc70150653fc621c10008708faefba3f`
  - verifier blob `20ccf0dfeb3b9c203c27200dbb6bed1c99d3e810`
  - schema4 / production environment contract / compiled code SHA gate 존재 확인.

다음:
- 제품 동작은 그대로 둔 docs-only PREVIEW SHA를 생성한 뒤,
- 새 main controller로 TEST를 **한 번 더** 검증하여 schema4 `TEST_VERIFIED` manifest를 생성.
- 두 번째 Run이 최종 TEST 기준이며 첫 bootstrap manifest는 폐기 취급.
- 별도 정식배포 승인 전 PRODUCTION 변경 금지.

## 0QO. PRODUCTION-first Release Controller 구현·감사 PASS / one-time main bootstrap 대기 (2026-10-06 KST)

완료된 배포 시스템 보강:
- 제품 기준 PREVIEW HEAD: `83a90ce42c85fe59d4fe588a8c4fd719256361df`.
- Release System Audit Run `37406340564`: **SUCCESS / NO DEPLOY**.
- TypeScript PASS / Build PASS / 기존 like/publication/cache regression PASS.
- TEST/PRODUCTION branch, Hosting, Worker, Media Worker 비변경.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- D1 schema/trigger/write 0.

새 hard gate:
1. **PRODUCTION live environment contract**
   - TEST 단계에서 실제 TEST/PRODUCTION Worker/Media binding과 Firebase Hosting config를 read-only로 읽어 계약을 생성.
   - 허용된 차이만 명시:
     - Explore worker name
     - TEST 전용 `RATE_DB=soridraw-explore-test-db`
     - TEST 전용 `EXPLORE_CACHE=soridraw-profile-media-test`
     - PRODUCTION 전용 mirror service bindings
     - Media worker name / 환경별 MEDIA bucket / ALLOWED_ORIGINS
     - Firebase Hosting site name
   - 그 외 차이는 TEST_VERIFIED 금지.
   - Audit contract SHA: `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`.
   - `TEST_PRODUCTION_ALLOWED_ENVIRONMENT_DIFFS=PASS`.
2. **실제 컴파일 코드 identity**
   - Explore TEST code SHA = PRODUCTION code SHA = `13d809a3eca35366e25d85fefda3ebc0faa6a88968157a8afbf81a0e8178cf03`.
   - Media TEST code SHA = PRODUCTION code SHA = `f0507a8464a1147e2bc914b6cd681ee1f1531ecfc3afb40ab7a73b8e55990bc9`.
   - 앞으로 TEST manifest에 이 compiled-code SHA를 고정하고 PRODUCTION upload/activate/verify에서 exact match가 아니면 중단.
   - Firebase Hosting은 기존처럼 TEST verified Hosting version을 PRODUCTION으로 clone하며 PRODUCTION 재build 금지.
3. **기존 PRODUCTION 브라우저 캐시 업그레이드 계약**
   - `src/services/exploreEnvironmentParityPolicy.ts`로 공개프로필/개인 좋아요 origin 수렴 판단을 순수 함수로 분리.
   - `verify-367-production-browser-upgrade-contract.ts`에서 old-production-cache → new-release, unchanged/empty cache, like signal certificate continuity를 실행 검증.
   - Audit:
     - `APP367_PRODUCTION_BROWSER_UPGRADE_CONTRACT=PASS`
     - `OLD_PRODUCTION_CACHE_TO_NEW_RELEASE=PASS`
     - `EMPTY_OR_UNCHANGED_CACHE_NO_FORCED_SERVER_READ=PASS`
     - `PERSONAL_LIKE_ORIGIN_CERTIFICATE_CONTINUITY=PASS`
   - app366 공개프로필/My Likes cross-origin verifier도 PASS.
4. **TEST_VERIFIED manifest schema 4**
   - source/tree + Hosting identity
   - Explore Worker source identity + compiled code identity
   - Media Worker source identity + compiled code identity
   - browser-upgrade contract hash
   - PRODUCTION environment contract hash
   - Release Controller identity
   를 하나의 immutable release manifest에 고정.
   - PRODUCTION preflight는 TEST에서 얼린 environment-contract asset과 현재 PRODUCTION live contract가 exact match인지 다시 확인.
5. **TEST Hosting과 PRODUCTION Hosting config parity**
   - TEST에도 `/app-version.json` no-cache/no-store/must-revalidate header를 추가하여 site name 외 Hosting 계약 차이를 제거.

감사 실측:
- Explore bundle source identity TEST/PRODUCTION: `65a2f5b39f91f15d328657d12b4dc1a99cab9e638c37b7bd7056e3e6494dcb9a` 동일.
- Media bundle source identity TEST/PRODUCTION: `041be5815c4398311c476276cda7c19cebf42e72ee29066aee0839f5f55ee50b` 동일.
- TEST/PRODUCTION shared D1 read-only preflight: tables=6, triggers=18 PASS.
- curated bounded read: TEST 12 / PRODUCTION 12 PASS.
- `D1_WRITE_MIGRATION_SEED=NONE`.
- `RELEASE_CONTROLLER_EXECUTABLE_MUTATION_TESTS=PASS`.
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`.

중요 bootstrap 사실:
- GitHub `issue_comment` Release Controller는 default branch인 **main의 workflow**로 실행된다.
- read-only command `/soridraw preflight 83a90ce...` Run `37406635596`은 SUCCESS / PREFLIGHT_NO_MUTATION이었지만, 실행 workflow 자체의 head는 현재 main `bca5864db427f6fdc635e547f573588e9628be0b`의 이전 controller이다.
- target PREVIEW source 안의 새 verifier는 읽고 검사했지만, **새 schema4 controller orchestration 자체가 live issue-command controller가 되는 것은 main 승격 후**다.
- 따라서 사용자 TEST 승인 전 main을 몰래 바꾸지 않는다.
- 최초 TEST 승격 때는 **one-time controller bootstrap**이 필요:
  1. 기존 main controller가 검증된 app357 tree를 TEST/main으로 승격해 새 controller를 main에 설치.
  2. 그 첫 manifest는 구 controller가 만든 것이므로 PRODUCTION 근거로 사용 금지.
  3. 새 main controller로 product behavior가 동일한 최신 PREVIEW SHA를 다시 TEST 검증하여 schema4 TEST_VERIFIED manifest를 생성.
  4. 이후부터 모든 릴리스는 새 controller의 단일 TEST_VERIFIED → 단일 PRODUCTION 승격 경로 사용.
- 이 bootstrap 동안 PRODUCTION은 변경하지 않는다.

현재 refs:
- preview `83a90ce42c85fe59d4fe588a8c4fd719256361df`
- main `bca5864db427f6fdc635e547f573588e9628be0b`
- production `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`

현재 상태:
- Release Controller 보강 구현 + 독립 Audit는 **완료**.
- app357 TEST/PRODUCTION은 아직 미승격.
- 다음 mutation은 사용자 명확한 `테스트배포` 승인 후에만 시작.

## 0QN. PRODUCTION-first 릴리스 절대 규칙 고정 (2026-10-06 KST)

사용자 최우선 운영 지시:
- 최종 목표는 항상 정식앱(PRODUCTION).
- PREVIEW에서 기능을 개발할 때부터 PRODUCTION의 환경 차이와 기존 사용자 상태까지 염두에 두고 구현.
- TEST는 "테스트용"이 아니라 **정식에 그대로 복붙될 완성본**을 검증하는 단계.
- TEST에서 모든 기능이 정상이라면 PRODUCTION은 같은 결과가 **단 한 번에** 나와야 함.
- TEST PASS 후 PRODUCTION에서 binding/cache/origin 차이 때문에 새 오류가 나고 다시 제품 코드를 고치는 반복을 정상 운영으로 인정하지 않음.
- 정식배포 뒤 "아, 이 환경만 달랐다"는 식의 누락을 금지.
- 사용자가 정식배포 후 핵심 정합성 오류를 찾아주는 것을 배포 검증의 일부로 의존하지 않음.

영구 기준 반영:
- `AGENTS.md`: PRODUCTION-first / TEST_VERIFIED 의미 / exact artifact 승격 / Release System FAIL 기준 추가.
- `DOCS/WORKFLOW_GUARDRAILS.md`: PRODUCTION-first 릴리스 절대 규칙 신설.
- `DOCS/WORK_AUDIT_CHECKLIST.md`: production live contract, old-production-cache upgrade, browser-visible parity, exact artifact identity를 필수 감사 항목으로 추가.
- 이 규칙은 앞으로 기능별 임시 판단보다 상위 release invariant로 사용.

현재 배포 상태:
- PREVIEW app357만 배포됨.
- TEST / PRODUCTION은 app357 미승격.
- 다음 큰 작업은 app357을 밀어 올리는 것이 아니라, **Release Controller가 이 새 절대 규칙을 실제 코드로 강제하도록 보강하는 것**.
- 보강이 완료되어 Audit PASS하기 전 app357 TEST/PRODUCTION 승격 금지.
## 0QM. app357 PREVIEW 공개프로필/좋아요곡 cross-environment parity 복구 + 승격 hard gate 추가 (2026-10-06 KST)

사용자 실기기 발견:
- PRODUCTION Explore Feed 자체는 PREVIEW와 정상 일치.
- 같은 계정 공개프로필의 **공개곡 목록/개수/핀 상태가 PREVIEW와 PRODUCTION에서 서로 다름**.
- 같은 own-profile의 **좋아요 곡 목록도 PREVIEW와 PRODUCTION에서 서로 다름**.
- 직전 Release Controller는 server-side public-profile projection 1개를 비교해 PASS했지만, 실제 브라우저 persistent cache 결과 차이는 잡지 못함. 따라서 이전 public-profile parity PASS는 서버 응답 parity이지 클라이언트 표시 parity까지 증명한 것이 아님.

원인:
1. 공개프로필
   - PREVIEW/TEST/PRODUCTION은 서로 다른 origin/localStorage를 사용.
   - app335 이후 warm public-profile route entry/reload는 비용 절감을 위해 local first-view cache를 그대로 반환하고 Worker 0을 유지.
   - 같은 계정 공개/비공개 RTDB 신호는 최신 mutation 1개만 보관하므로, 특정 origin이 과거 여러 변경을 놓친 상태에서는 최신 1개 patch만으로 전체 공개곡 목록을 복구할 수 없음.
   - shared server profile R2 자체는 Release Run `37397953411`에서 TEST↔PRODUCTION 동일 owner parity PASS였으므로 이번 실제 차이는 우선 origin-local stale first-view cache 문제로 격리.
2. 좋아요 곡
   - 개인 좋아요 역시 각 origin에 durable local catalog/watermark를 가짐.
   - retained RTDB signal은 작은 changed-track batch만 담으므로, 과거 origin이 이전 변경을 놓친 상태에서 이미 최신 signal watermark를 본 것으로 기록되면 일부 과거 membership이 남을 수 있는 recovery gap이 존재.
   - 좋아요 클릭/30초 batching/W1 queue/공개 숫자 경로 자체는 기존 frozen baseline을 유지.

app357 수정:
- `src/services/userDomainSyncService.ts`
  - 기존 같은-account `explorePublication` RTDB signal의 최신 작은 상태를 origin localStorage에도 보존. 추가 RTDB/Firestore/D1 요청 없음.
- `src/services/exploreProfileFirstViewService.ts`
  - 기존 cache schema version **6 유지**; 앱 업데이트를 이유로 전체 cache bust 금지.
  - cached first-view에 마지막으로 반영한 publication signal version만 additive 보존.
  - **실제 publication signal version이 cached profile보다 최신일 때만** shared first-view를 conditional 1회 확인.
  - 최신이면 현재 full first-view로 교체, 304면 기존 cache를 그대로 인증.
  - 변경 신호가 있는데 최신 상태를 확인할 수 없으면 과거 목록을 조용히 표시하지 않고 fail-closed.
  - 변경 없는 재진입은 기존 Worker 0 / D1 R0 유지.
- `src/services/exploreLikeService.ts`
  - retained personal-like signal version과 origin certification을 local-only로 추가.
  - 앱 시작/업데이트만으로 personal snapshot을 읽지 않음.
  - **사용자가 own-profile의 좋아요 곡 탭을 실제로 열었고**, 기존 durable like catalog가 있으면서 해당 origin이 retained signal까지 인증되지 않은 경우에만 기존 bounded personal baseline 경로로 1회 reconcile.
  - 성공 전 local catalog 삭제 없음.
  - 정상 30초 batching / W1 queue / heart-count atomic state / changed-track live signal 보호.
- `src/pages/ExplorePage.tsx`
  - own public-profile load에 retained publication version을 전달.
  - 늦게 도착한 publication signal도 own-profile을 다시 bounded reconcile하도록 version state로 연결.
  - My Likes 진입 시에만 cross-origin parity repair gate 실행.
- 배포엔진:
  - 신규 `scripts/verify-366-cross-environment-profile-like-parity.mjs`.
  - Release Controller TEST preflight에서 위 verifier를 **필수 실행**.
  - Release System Audit에도 동일 verifier 포함.
  - profile cache schema bump/global invalidation, like 30초 batching 변경, My Likes second authority 생성이 있으면 FAIL.

검증:
- 첫 Audit Run `37400910389`: FAIL.
  - 원인: 기존 isolated verifier 180이 `applyRemoteLikeSignal127` 함수만 VM으로 분리 실행하는데 새 certificate helper를 함수 내부 dependency로 추가해 test harness 계약을 깨뜨림.
  - 제품 기능 문제로 숨기지 않고 FAIL 유지.
- 수정:
  - certificate advancement를 RTDB subscription 경계로 이동하여 `applyRemoteLikeSignal127` frozen isolated contract 복구.
- 최종 Release System Audit Run `37401266952`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - existing like regression suite PASS.
  - app211/335 zero-read regression PASS.
  - app366 cross-env profile/My Likes parity verifier PASS.
  - Worker dry-run/read-only D1 checks PASS.
- PREVIEW App Release Run `37401610271`: **SUCCESS**.
  - deployed exact PREVIEW SHA `aafacbe6af07a3a6919c01c0512b123b2a44ba6b`.
  - PREVIEW app version **357**.
  - `preview.soridraw.com` exact build PASS.
  - shared RTDB Rules 변경 없음.
  - TEST / PRODUCTION branch + Hosting unchanged PASS.
- Explore Worker / Media Worker / Functions / Firestore Rules / D1 schema·trigger 변경 **0**.
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- UI/CSS 변경 **0**.

현재 HARD GATE:
- PREVIEW app357 실기기에서 같은 계정 기준:
  1. 공개프로필 공개곡 개수/목록/핀 순서가 현재 실제 공개상태와 일치.
  2. own-profile 좋아요 곡 membership/list가 실제 하트 상태와 일치.
  3. PREVIEW 재진입 시 변경이 없으면 profile Worker 0 / D1 R0 유지.
  4. Explore Feed / SORIDRAW 추천 / 좋아요 클릭 / 공개·비공개 기존 동작 회귀 없음.
- 위 항목 확인 전 TEST/PRODUCTION 승격 금지.
- first-publication W12->W1~W2 작업은 이 parity 이슈 종료 뒤로 연기.

## 0QL. SORIDRAW 추천 PRODUCTION 정상복구 + release gate 실전 검증 완료 (2026-10-06 KST)

최종 PRODUCTION:
- 사용자 명확 승인 후 Release Controller Run `37397953411`: **SUCCESS / RELEASED**.
- TEST_VERIFIED manifest: `soridraw-test-v356-884bf33c99eb`.
- exact source PREVIEW SHA: `884bf33c99eb67a8c06c8720f518a55b6f2ce27c`.
- main(TEST) SHA: `bca5864db427f6fdc635e547f573588e9628be0b`.
- production SHA: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.
- PRODUCTION app version: **356**.
- PRODUCTION Explore Worker: `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa`.
- PRODUCTION Media Worker: `a3b87bbc-af2d-41eb-9e26-99dda0dbfc44`.
- Firebase PRODUCTION Hosting: verified TEST Hosting version clone PASS.
- `soridraw.com` / Firebase production Hosting exact build verify PASS.

SORIDRAW 추천 최종 검증:
- `PRODUCTION_CURATED_PARITY=PASS count=12`.
- TEST ↔ PRODUCTION 추천 projection parity PASS.
- latest / popular shared Feed parity PASS.
- public profile parity PASS.
- production release environment parity PASS on attempt 1.
- Production Media Worker shared Catalog flag=1 / authority=`shared-catalog` PASS.
- Worker / Media Worker smoke + verify PASS.
- 따라서 배포엔진은 추천이 503이거나 TEST와 불일치하면 승격을 중단하고, 정상 12곡일 때만 RELEASED 처리하도록 실제 release에서 검증됨.

이번 PRODUCTION 승격 전 발견된 두 차단과 수정:
1. Run `37395223571`: PROD_PREFLIGHT의 controller identity drift로 배포 전 차단.
   - TEST manifest controller identity를 default branch가 아니라 실제 승격 source `RELEASE_ROOT`에서 계산하도록 수정.
   - Audit `37395497639` SUCCESS.
2. Run `37396335517`: 새 production Explore Worker 활성 뒤 curated HTTP 503이 13회 지속되어 자동 rollback.
   - 기존 PRODUCTION Explore Worker `39e28223-6200-463f-8e86-1a0a3b3475d8`로 자동 복구되어 반쪽 배포 방지.
   - read-only Audit `37396796197`: TEST/PRODUCTION 공통 D1 `curated_picks` 모두 현재 12 rows PASS, schema/data 문제 아님 확인.
   - 실제 원인: PREVIEW/TEST는 명시적 `EXPLORE_CACHE` R2 binding이 있지만 PRODUCTION은 release runtime 계약상 `PROFILE_MEDIA`를 Explore cache fallback으로 사용. curated helper만 이 fallback을 따르지 않고 `EXPLORE_CACHE`만 요구해 production에서 R2 binding missing 503.
   - `curatedBucket307`을 `EXPLORE_CACHE || PROFILE_MEDIA`로 최소 수정.
   - 전체 tracks scan/rebuild, 데이터 copy/backfill 없이 canonical `curated_picks` 최대 40개 cold recovery 유지.
   - Audit `37397307521` SUCCESS.
   - PREVIEW Worker Release `37397493810` SUCCESS.
   - TEST Run `37397621274` SUCCESS / TEST_VERIFIED, curated 12 parity PASS.
   - 이후 최종 PRODUCTION Run `37397953411` SUCCESS.

데이터/비용/기능 안전:
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- D1 schema/trigger migration **0**.
- curated cold recovery는 추천 membership 최대 40개에만 bounded.
- warm 추천은 R2/Edge 경로, D1 R0/W0 gate 유지.
- 좋아요 / 공개·비공개 / Music Note / Library / 저장하트 / 폴더 / UI / thumbnail 변경 0.
- shared Catalog는 PREVIEW/TEST/PRODUCTION 모두 계속 ON.

현재 다음:
- 정식앱 `soridraw.com` 실사용에서 `SORIDRAW 추천` 표시와 CACHE LIVE `/v1/curated HTTP 200`만 사용자 최종 확인.
- 이상 없으면 curated 이슈 종료.
- 이후 큰 비용 작업은 기존 HARD GATE였던 **never-published 최초 공개 D1 W12 -> W1~W2**를 기능 보존 조건으로 재개.

## 0QK. SORIDRAW 추천 PRODUCTION 1차 시도 preflight 차단 + Release Controller identity bootstrap 완료 (2026-10-06 KST)

PRODUCTION 1차 시도:
- 사용자가 `soridraw-test-v356-86872e778695` 기준 정식앱 승격을 명확히 승인.
- Release Controller Run `37395223571`: **FAIL / PROD_PREFLIGHT에서 차단**.
- 실패 지점: `Release Controller identity drift`.
- 원인: TEST manifest가 TEST 승격 전 default-branch controller(`GITHUB_WORKSPACE`) identity를 기록했고, 같은 TEST 승격이 main에 새 release-controller 파일을 올린 뒤 PRODUCTION run은 새 controller identity를 사용해 서로 달라짐.
- `PROD_DEPLOY`는 실행되지 않았고 PRODUCTION branch / Explore Worker / Media Worker / Hosting은 변경되지 않음.

Release Controller 수정:
- `.github/workflows/soridraw-release-promotion.yml`: TEST manifest의 controller identity를 **실제로 승격되는 exact `RELEASE_ROOT` source**에서 계산하도록 변경.
- `scripts/verify-release-controller.mjs`: manifest identity가 promoted source에서 계산되는지 정적 검사 + mutation test 추가.
- 제품/UI/Explore 사용자 기능/데이터 경로 변경 0.
- Release System Audit Run `37395497639`: **SUCCESS**.

controller bootstrap TEST:
- Run `37395703347`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW `69991e94f731eb3ff0943a2864608301423d1645`.
- main(TEST) `00b5ee7b4eaac7ef8a9ec1d7ee7a0328223c76b8`.
- TEST Explore Worker `28257181-78df-4feb-8938-c74d0a448d38`.
- TEST Media Worker `ab5d9faf-dc43-4e57-9454-8cc87f797692`.
- `TEST_CURATED_PARITY=PASS count=12`.
- 이 bootstrap run 자체 manifest는 이전 default-branch workflow가 실행한 run이므로 PRODUCTION 근거로 사용하지 않음.
- 다음 TEST는 이미 수정된 main controller가 실행하며, controller identity 파일은 그대로 두고 문서-only 새 PREVIEW SHA를 대상으로 새 TEST_VERIFIED manifest를 생성한다.

안전:
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- D1 schema/trigger mutation 0.
- PRODUCTION mutation 0.
- 좋아요/공개/비공개/Music Note/Library/폴더/UI/thumbnail 변경 0.

## 0QJ. SORIDRAW 추천 TEST 승격 완료 / curated release hard gate 실제 PASS (2026-10-06 KST)

TEST 승격:
- Release Controller Run `37394592522`: **SUCCESS / TEST_VERIFIED**.
- exact source PREVIEW SHA: `86872e778695f199923f88b56481ee3ff7064a4a`.
- main(TEST) SHA: `cca8c2c4fedf88da4c14ff85331ad6c00c128098`.
- durable TEST manifest tag: `soridraw-test-v356-86872e778695`.
- TEST app version: **356**.
- TEST Explore Worker: `85e9821a-c2d4-4dcc-a5c5-8f06ee6600ae`.
- TEST Media Worker: `979e09c0-fc05-47fe-9522-91a46a004ef6`.
- Firebase TEST Hosting deploy PASS; `test.soridraw.com` / `soridraw-test.web.app` exact app-version/build verification PASS.
- PRODUCTION branch / Explore Worker / Media Worker / Hosting unchanged.

이번 승격에서 새 hard gate가 실제로 확인한 것:
- `TEST_CURATED_PARITY=PASS count=12`.
- PREVIEW와 TEST의 `SORIDRAW 추천` projection exact parity PASS.
- TEST latest/popular shared Feed parity PASS.
- TEST public profile parity PASS.
- TEST release environment parity PASS on attempt 1.
- TEST Media Worker `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`, health `shared-catalog` PASS.
- Explore Worker / Media Worker smoke + verify PASS.
- D1 schema migration / 사용자 데이터 backfill / bulk copy / delete / rewrite **0**.

현재 판단:
- PREVIEW와 TEST에서는 추천 backend와 배포 hard gate가 검증 완료.
- TEST 실제 화면에서 `SORIDRAW 추천` 섹션 표시 여부는 사용자 실사용 최종 확인만 남음.
- PRODUCTION은 아직 기존 Explore Worker이며 이번 TEST 승격에서 비변경. 정식앱의 기존 curated 503/추천 누락은 아직 복구 완료로 판정하지 않음.
- 사용자의 명확한 정식배포 승인 후에만 `soridraw-test-v356-86872e778695` manifest를 사용해 PRODUCTION 승격.

## 0QI. SORIDRAW 추천 cold-cache 복구 + 배포 엔진 hard gate PREVIEW 완료 (2026-10-06 KST)

사용자 실기기에서 확인된 문제:
- PRODUCTION Explore에서 기존 `SORIDRAW 추천` 섹션이 사라짐.
- CACHE LIVE에 `/v1/curated HTTP 503` 확인.
- 같은 시점 최신/인기 Feed 및 warm Explore D1 R0/W0은 정상이라 추천 경로만 별도 격리.

원인:
- `SORIDRAW 추천`은 사용자 원본이 아니라 환경별 `EXPLORE_CACHE` R2의 파생 curated snapshot을 사용.
- R2 snapshot이 없는 환경에서 wrapper의 `materializeCuratedR2FromBase307()`가 wrapper 전용 `/v1/curated`를 base Worker에 다시 요청하고 있었음.
- base Worker는 해당 wrapper route를 소유하지 않아 cold bootstrap이 실패하고 503을 반환.
- 기존 Release Controller parity는 latest/popular Feed와 public profile은 비교했지만 `/v1/curated`를 확인하지 않아 PRODUCTION의 추천 누락을 놓침.

수정 범위 — 다른 기능 비변경:
- 제품 fix commit `ff3c87ba797551beb9afbc8241ee5fca03f4680e`.
- release-engine 보강 commit `d0811e400c74fe8c81c6f3a0bc494321388da71c`.
- `cloudflare/explore-worker/canonical/preview-entry.js`
  - cold curated recovery를 shared canonical `curated_picks` 최대 40개 + 해당 exact track detail만 읽는 bounded 복구로 교체.
  - 전체 tracks scan/rebuild 없음.
  - D1 write 0, 사용자 데이터 write 0.
  - 정상 R2/Edge warm 경로는 기존 그대로.
- `.deploy/release-worker-runtime.mjs`
  - TEST/PRODUCTION 승격 시 `/v1/curated` HTTP 200 + warm D1 R0/W0 + 이전 단계와 curated projection parity를 필수 확인.
  - 실패 시 기존 release rollback 경로로 승격 중단.
- `.github/workflows/cloudflare-explore-preview-release.yml`
  - PREVIEW Worker 배포 자체도 curated first/warm live smoke를 필수화.
  - warm 응답 D1 R0/W0 및 R2/Edge authority가 아니면 배포 실패/rollback.

검증/배포:
- Release System Audit Run `37392337700`: SUCCESS.
- 강화된 최종 Audit Run `37392970196`: SUCCESS.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - release promotion verifier PASS.
  - Worker dry-run / shared D1 read-only preflight PASS.
- PREVIEW Worker Release Run `37393213974`: SUCCESS.
- active PREVIEW Explore Worker: `193d7c1c-7471-44d0-bd1f-2315b0121eed`.
- live curated smoke:
  - first response HTTP 200 / 추천 12곡 PASS.
  - immediate warm response HTTP 200 / 추천 12곡 PASS.
  - warm D1 R0/W0 PASS.
  - source `EDGE-CURATED-BODY-307` PASS.
- 기존 latest/popular/profile/genre/search/like smokes도 PASS.
- TEST / PRODUCTION Explore Workers unchanged PASS.
- Firebase Hosting 변경 0.
- Functions / Firestore Rules / D1 schema·trigger 변경 0.
- 사용자 데이터 migration/copy/backfill/delete/rewrite 0.

현재 상태:
- PREVIEW에서는 `SORIDRAW 추천` backend가 정상 복구되고 실제 live endpoint까지 확인 완료.
- PRODUCTION은 사용자가 보고한 기존 Explore Worker 상태를 아직 유지하므로 **정식앱 복구 완료라고 판정하지 않음**.
- TEST/PRODUCTION 승격은 기존 승인 규칙을 유지. 사용자 명시 TEST 승격 전 main 변경 금지, 명확한 PRODUCTION 배포 승인 전 production 변경 금지.
- UI, 좋아요, 공개/비공개, Music Note, Library, 저장하트, 폴더, thumbnail 코드는 이번 수정에서 변경하지 않음.

## 0QH. shared private Catalog coordinated cutover 실제 완료 (2026-10-06 KST)

- coordinated cutover Run `37389139136`: SUCCESS.
- PREVIEW / TEST / PRODUCTION Media Worker 모두 `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`.
- health authority mode: `shared-catalog` PASS.
- active cutover versions:
  - PREVIEW Media `5e258a0c-2e17-4fcb-bacc-11b2a5a608f2`.
  - TEST Media `6a890d63-d924-4199-a0ef-bd884430ff8f`.
  - PRODUCTION Media `f2fa815e-d38d-4e17-b2f5-4495efe00672`.
- Firestore migration 0 / D1 mutation 0 / Catalog bulk copy 0 / Hosting 변경 0.
- 따라서 아래 0QG의 `flag=0 dormant` 설명은 당시 시점 기록이며, **현재 실제 runtime은 세 환경 모두 shared Catalog ON**이 최신 기준.
- 사용자 실기기에서 이번 cutover 이후 Music Note 곡 목록이 거의 동일하게 맞춰졌다고 확인됨. 전체 parity/비용 검증은 계속 별도 확인 대상.

## 0QG. app356 PRODUCTION dormant shared Catalog support 승격 완료 + Hosting clone fix (2026-10-06 KST)

PRODUCTION 승격 최종 결과:
- Release Controller Run `37387649369`: **SUCCESS / RELEASED**.
- TEST_VERIFIED manifest: `soridraw-test-v356-77fdab283a90`.
- exact source PREVIEW SHA: `77fdab283a906b50a7ce8233ff73a34e80b4ef42`.
- main(TEST) SHA: `3a7fce2442ea15caf228e06a1a5c0299ee1b3dac`.
- production SHA: `74de6362c743974078c7d40566706053ce11dfc7`.
- PRODUCTION app version: **356**.
- PRODUCTION Explore Worker: `39e28223-6200-463f-8e86-1a0a3b3475d8`.
- PRODUCTION Media Worker: `c2fc9ac1-c79a-4b62-9a2a-1c6d09459e24`.
- Firebase PRODUCTION Hosting은 검증된 TEST Hosting 버전에서 clone되어 PASS.
- PRODUCTION Explore parity with TEST PASS.
- PRODUCTION Media health/smoke/verify PASS.
- PRODUCTION Media runtime:
  - `MEDIA=soridraw-media`
  - `CATALOG=soridraw-user-catalog`
  - `SORIDRAW_SHARED_CATALOG_V1=0`
- 따라서 PREVIEW / TEST / PRODUCTION 모두 **shared Catalog 코드를 이해하고 같은 private CATALOG binding을 가진 dormant 상태**가 됨.

이번 승격 중 발견/수정한 Release Controller 오류:
- 첫 PRODUCTION 시도 Run `37386436978`은 Firebase Hosting clone에서 실패.
- 원인: 현재 firebase-tools의 version source 문법은 `<site>@<version>`인데 controller가 `<site>:@<version>`을 사용하여 version을 channel로 해석함.
- 실패 시 Explore/Media Worker는 자동 rollback되어 기존 PRODUCTION 버전으로 복구됐고 production branch/Hosting은 승격되지 않음.
- PREVIEW fix commit `3202a72b0fa2c26397fb296652990f9119261ac8`: clone 문법 수정 + verifier 강화 + 이전 one-shot dispatcher 정리.
- Release System Audit Run `37387027945` at `77fdab283a906b50a7ce8233ff73a34e80b4ef42`: **SUCCESS**.
- 수정된 controller identity로 TEST를 다시 고정한 Run `37387289891`: **SUCCESS / TEST_VERIFIED**.
- one-shot TEST dispatcher는 최종적으로 PREVIEW에서 제거 완료; 현재 PREVIEW HEAD는 그 뒤 정리 commit 계열.

데이터/비용 안전:
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- Firestore Rules / Functions / shared D1 schema·trigger 변경 **0**.
- shared private Catalog flag는 세 환경 모두 아직 **0(OFF)**.
- 따라서 이번 PRODUCTION 승격은 shared authority 실제 cutover가 아니라 **dormant support 통일**까지만 수행.
- 정상 warm cache 0-read 목표와 app349 save-heart / app301 folder / public-like 보호선은 변경 없음.

현재 HARD GATE / 다음 작업:
- 세 환경 dormant runtime parity는 완료.
- 다음은 `SORIDRAW_SHARED_CATALOG_V1`을 **PREVIEW/TEST/PRODUCTION에 coordinated 방식으로 함께 ON** 하는 별도 cutover.
- 환경 하나만 먼저 장시간 ON 상태로 두는 방식 금지.
- cutover 중 사용자 Catalog 전체 복사/full scan/backfill 금지.
- cutover 후 동일 계정으로 Recent save-heart / Music Note / Library / folders / PC↔mobile/reload / Explore-publication 결과를 세 환경에서 비교.
- 실제 revision gap/missing shared Catalog일 때만 bounded user+kind bootstrap 허용.
- parity와 warm-cache 비용 검증이 모두 PASS한 뒤에만 first-publication W12->W2 shared-D1 작업 재개.

## 0QF. app356 TEST dormant shared Catalog support 승격 완료 + Release Controller 재강화 (2026-10-06 KST)

TEST 승격 최종 결과:
- Release Controller Run `37383619935`: **SUCCESS / TEST_VERIFIED**.
- exact source PREVIEW SHA: `0bab8cdb2492021cb35b5ee9d38fd92472d6f3e7`.
- durable TEST release tag: `soridraw-test-v356-0bab8cdb2492`.
- main promoted SHA: `751acbd9441023dc150403507b1c64232bc0f637`.
- TEST app version: **356**.
- TEST Explore Worker: `f45a7081-6b0b-4670-ba18-c9e58ce2287a`.
- TEST Media Worker: `faf933b6-d2d6-4599-9561-5596f593da4a`.
- TEST Media runtime exact checks:
  - `MEDIA=soridraw-media-test`
  - `CATALOG=soridraw-user-catalog`
  - `SORIDRAW_SHARED_CATALOG_V1=0`
  - media health/catalog binding PASS.
- Firebase TEST Hosting deploy PASS.
- TEST Explore environment parity with PREVIEW PASS.
- PRODUCTION branch/Explore Worker/Media Worker/Hosting 비변경.

Release Controller 보강:
- 첫 시도 Run `37382314963`은 TEST Media Worker 활성 직후 health 확인이 Cloudflare edge 전파보다 빨라 `media health binding check failed`로 중단.
- 해당 실행은 Explore Worker와 Media Worker를 이전 버전으로 되돌렸고 Hosting은 변경 전 중단.
- main rollback은 GitHub Actions token의 workflow-file rollback 권한 한계로 자동 push가 거절되어, connector의 workflow 권한으로 **원래 TEST tree를 유지하는 fast-forward rollback commit** `ca2ce92f88ca6f2d21c80f94d5e98f853eaa9fab`을 만들어 복구.
- 이후 Release Controller를 수정:
  - Media Worker active version/health가 실제 edge에 수렴할 때까지 bounded retry.
  - Media release identity를 비결정적 Wrangler outdir hash가 아니라 승인된 source + effective config + pinned tool contract로 고정.
  - Media Worker Wrangler를 `4.147.0` exact pin.
  - TEST/PRODUCTION branch ref는 Worker/Media Worker/Hosting 실제 검증이 모두 끝난 **마지막 단계에서만** 승격.
  - TEST release manifest도 먼저 생성하고, main push 실패 시 release/tag를 자동 정리하도록 rollback 강화.
  - 따라서 검증 실패가 branch에 반쪽 승격을 남기기 어려운 구조로 변경.
- Release System Audit Run `37383318153`: **SUCCESS**.
- 최종 TEST Run에서 Media Worker는 active version settle PASS, health는 7회 bounded retry 후 PASS, TEST_VERIFY 재확인에서는 1회에 PASS.

현재 tree parity:
- TEST에 승격된 source target tree = TEST main tree `c4a3cb4dc4179f67caa3d92d22cc048847330794`.
- TEST 승격 뒤 PREVIEW에 추가된 차이는 상태 문서 `DOCS/CURRENT_RELEASE_STATE.md`, `DOCS/NEXT_CODEX_TASK.md` 갱신뿐이며 runtime code 차이 0.
- temp dispatch workflow/trigger는 삭제 완료.
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- shared Catalog cutover는 여전히 **OFF**.

현재 HARD GATE:
- PREVIEW와 TEST는 앱 + Explore Worker + Media Worker + shared `CATALOG` binding까지 동일 release 구조를 갖춤.
- 하지만 PRODUCTION은 아직 이전 release이므로 `SORIDRAW_SHARED_CATALOG_V1`을 PREVIEW/TEST만 먼저 ON 하면 안 됨.
- **PRODUCTION dormant support 승격은 사용자의 명확한 정식배포 승인 전 금지.**
- 세 환경 모두 shared Catalog 코드를 이해한 뒤에만 coordinated flag cutover를 진행하고, 그 뒤 Music Note/Library/Recent/folder 실데이터 parity를 검증.
- parity 완료 전 first-publication W12->W2 shared-D1 cutover 금지.

## 0QE. app356 PREVIEW shared private Catalog dormant support 배포 + 최종 감사 PASS (2026-10-06 KST)

이번 작업의 목적:
- TEST 승격 후 드러난 Music Note / Library 환경별 R2 Catalog drift를 사용자 데이터 복사나 전체 backfill 없이 해결하기 위한 **공용 private Catalog authority**를 준비.
- 실제 cutover는 아직 하지 않고, 먼저 세 환경이 같은 공용 Catalog를 읽을 수 있는 코드/배포 경로만 안전하게 준비.

구현:
- 공용 private R2 bucket `soridraw-user-catalog` 생성.
- Media Worker에 `CATALOG` binding 추가:
  - PREVIEW / TEST / PRODUCTION 설정이 모두 같은 `soridraw-user-catalog`를 가리킴.
  - 기존 실제 media/archive용 `MEDIA` bucket은 환경별 분리를 그대로 유지.
- `SORIDRAW_SHARED_CATALOG_V1` feature flag 추가.
  - PREVIEW / TEST / PRODUCTION 설정 모두 현재 **0(OFF)**.
  - 따라서 현재 일반 사용자 Catalog authority는 아직 기존 environment-local `MEDIA`이며, 공용 Catalog cutover는 발생하지 않음.
- shared mode용 bounded recovery 구현:
  - 정상 warm local cache는 기존처럼 먼저 반환되어 Worker/Firestore 추가 사용 없음.
  - remote read가 실제 필요하고 shared Catalog가 known revision을 만족하지 못할 때만 Worker가 `409 CATALOG_REPAIR_REQUIRED`를 반환.
  - 그 경우에만 클라이언트가 **해당 사용자 + 해당 kind(Music Note 또는 Library) 1개**에 대해 authenticated bootstrap을 1회 요청.
  - bootstrap은 전체 사용자/전체 collection scan이 아니라 해당 user/kind canonical source만 복구 대상으로 제한.
  - delta 적용 시 mutation `baseRevision` fence를 지켜 오래된 environment-local seed가 shared authority를 덮지 못하도록 보강.
- Release Controller에 Media Worker 승격/검증 경로를 포함해 앱 + Explore Worker만 승격되고 private Catalog runtime이 누락되는 gap을 차단.

검증:
- PREVIEW Media Worker Run `37379556479`: **SUCCESS**.
  - shared private Catalog bucket 존재/연결 PASS.
  - Worker build / deploy / R2 write-read / health / PREVIEW CORS PASS.
- 최종 Release System Audit Run `37379712972` at `d37f21390a5085cfcc4b4801208808861a2fdda8`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - release-system static verifier PASS.
  - TEST / PRODUCTION Worker dry-run only PASS.
  - shared D1 live preflight read-only PASS.
  - branch refs unchanged PASS.
- PREVIEW App Release Run `37381481452`: **SUCCESS**.
  - deployed commit `f87f863b40a59b7e9ec6de883f326904afe81ab6`.
  - app version **356**.
  - TypeScript PASS / Build PASS.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` exact build PASS.
  - TEST / PRODUCTION Hosting 및 protected refs unchanged PASS.
- 사용자 데이터 migration / copy / backfill / delete / rewrite: **0**.
- shared Catalog cutover: **아직 OFF**.
- Functions / Firestore Rules / shared D1 schema·trigger 변경: **0**.

현재 판단:
- cross-env parity 해결 방식은 **shared private Catalog authority**로 고정.
- 구현/검증/프리뷰 배포는 완료했지만 feature flag가 OFF이므로 아직 실제 parity 문제를 해결했다고 판정하면 안 됨.
- PREVIEW만 단독으로 shared flag를 켜면 TEST/PRODUCTION과 다시 다른 authority를 보게 되므로 금지.
- 다음은 TEST 승격 승인 시 dormant Media Worker + client support를 main/TEST로 함께 승격하고, TEST에서도 동일 `CATALOG` binding + flag OFF를 확인하는 것.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.
- 모든 활성 환경이 shared authority 코드를 이해하기 전 shared flag ON / W12->W2 shared-D1 cutover 금지.

## 0QD. app356 TEST 승격 완료 + Music Note/Library cross-env parity 신규 HARD GATE (2026-10-06 KST)

TEST 승격:
- Release Controller Run `37375259800`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW SHA: `f2d9eb0ad0ff067ec0ccc14bd450784dfcf1ed2e`.
- TEST Hosting: app **356**.
- TEST Explore Worker: `370f4451-a23c-44ce-9386-9964c836260b`.
- PREVIEW canonical Explore feature vars 3개가 TEST에도 exact-match PASS:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- TEST Worker smoke/verify PASS.
- PRODUCTION은 비변경.

최근생성곡 저장하트 / Music Note / Library 코드 parity:
- TEST 승격 후 아래 파일 blob SHA가 PREVIEW source와 TEST(main)에서 **완전히 동일**:
  - `src/App.tsx`
  - `src/lib/userDataEngine.ts`
  - `src/pages/FavoritesPage.tsx`
  - `src/pages/SunoLibraryPage.tsx`
  - `src/services/userDomainSyncService.ts`
  - `public/app-version.json`
- 따라서 TEST 승격 완료 이후에도 최근 생성곡 저장하트/Music Note/Library 결과가 다르면 **코드 버전 차이로 설명하면 안 됨**.

확인된 구조적 parity 위험:
- Firebase Auth/Firestore/RTDB canonical source는 PREVIEW/TEST/PRODUCTION 모두 동일 `soridraw-app-866a5`.
- 하지만 private Music Note/Library R2 Catalog endpoint는 환경별로 분리:
  - PREVIEW -> `soridraw-media-preview` / bucket `soridraw-media-preview`
  - TEST -> `soridraw-media-test` / bucket `soridraw-media-test`
  - PRODUCTION -> `soridraw-media` / bucket `soridraw-media`
- ordinary Catalog GET은 비용 보호 때문에 Firestore full rebuild를 수행하지 않고 R2-only로 fail-closed.
- 따라서 한 환경의 changed-item Catalog delta가 다른 환경의 R2 Catalog에 전달되지 않으면, canonical Firestore는 같아도 Music Note/Library 화면이 환경별 stale Catalog를 보여줄 수 있음.
- 이 구조는 사용자 고정 원칙인 **승격은 코드만 이동하고 동일 사용자 원본 데이터는 모든 환경에서 같아야 함**을 화면 결과 수준에서 보장하기에 부족함.

새 HARD GATE:
- PRODUCTION 승격 중단.
- Explore parity만 PASS로 보지 않음.
- 동일 계정 기준 PREVIEW/TEST의:
  1. Recent Song 저장하트 상태
  2. Music Note membership/list
  3. Library list
  4. Music Note/Library folder metadata
  5. 공개상태/Explore
  가 동일하게 수렴해야 TEST 검증 PASS.
- 해결은 사용자 데이터 복사/전체 backfill/full scan이 아니라, 변경분 O(1) 또는 shared canonical Catalog authority 방식이어야 함.
- 기존 app349 저장하트 즉시동기화, app301 folder sync, 비용 기준을 보호.
- 원인 확정 전 PRODUCTION/W2 shared-D1 cutover 금지.

## 0QC. 공개프로필 곡수 불일치 원인 확정 + app356 표시 교정 준비 (2026-10-06 KST)

사용자 실기기:
- 프로필 A 실제 공개곡 **24곡**: PREVIEW 헤더 23 / TEST 헤더 24.
- 프로필 B 실제 공개곡 **22곡**: PREVIEW/TEST 헤더 모두 23.
- 곡 목록 자체는 잠시 차이가 났다가 shared cache가 수렴하며 PREVIEW/TEST가 다시 일치함.

원인 분리:
1. 공개프로필 화면은 이미 받아온 실제 `profileTracks` 목록과 별도로 유지되는 `profile.trackCount` 값을 표시하고 있었음.
2. 렌더가 `profile.trackCount || profileTracks.length`라서, 유지 카운터가 1만 stale이어도 실제 목록 길이보다 stale 숫자가 우선 표시됨.
3. app355 타기기 공개/비공개 신호는 목록/로컬 profile cache를 changed-item으로 즉시 고치지만, 이미 렌더된 React `profile.trackCount` state는 별도라 PREVIEW 한쪽에서 23/24 차이가 보일 수 있음.
4. PREVIEW/TEST 모두 23인데 실제 목록 22인 사례는 shared profile R2의 유지 카운터가 과거 delta 누락으로 +1 drift한 상태와 일치. 곡 목록 자체를 다시 읽는 문제와는 별개.

안전 수정:
- `src/pages/ExplorePage.tsx`: first-view window가 **50곡 미만이면 이미 전체 공개곡 목록을 기기에 가지고 있으므로** 서버 카운터 대신 실제 `profileTracks.length`를 표시.
- 50곡 이상이면 기존 maintained `profile.trackCount`를 유지하되 loaded length보다 작아지지 않게 보호.
- 추가 Worker / D1 / R2 / Firestore read/write **0**.
- 공개/비공개/좋아요/저장하트/thumbnail/정렬/목록 자체 변경 0.
- commit `4b8830e8662d28ab7d6f9a8c5f5b8c9998c6f3a8`.
- app version **356** 준비.
- Explore 비공개 경고박스 제거 commit `ebdbe7cb9e9ce224c59ba900346329a78c6c4bc4`도 app356에 포함.

환경 격차 read-only 감사:
- Live Explore Runtime Audit Run `37368822795`: **SUCCESS**, shared/user D1 write 0.
- PREVIEW Worker `0badfdf8-597d-4f69-9a05-b6fb32612f01`:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- TEST Worker `6a0315db-8e17-46e6-b946-03133a4364f7`: 위 release feature flags **없음**.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`: 위 release feature flags **없음**.
- 세 환경 DB는 모두 shared canonical `217ef5b1-5d80-4f7c-afc7-9e07eb05c06b`, PROFILE_MEDIA도 모두 `soridraw-profile-media`.
- 따라서 곡 목록이 잠시 후 일치한 것은 shared R2 데이터 수렴이며, **환경 실행 설정까지 같다는 뜻은 아님**.
- 기존 Release Controller가 target Worker의 live vars를 `keep_vars`로 보존만 해서 PREVIEW의 새 feature flags를 TEST/PRODUCTION으로 승격하지 못하는 gap 확인.
- `.deploy/release-worker-runtime.mjs`를 수정해 TEST/PRODUCTION 승격 시 canonical PREVIEW release vars도 함께 승격하고 verify 단계에서 exact parity를 강제.
- static verifier도 동일 규칙을 hard gate로 추가.
- 이 release-controller 수정은 아직 TEST/PRODUCTION에 적용되지 않았으며 다음 immutable preflight PASS가 선행되어야 함.

## 0QB. app355 실기기 publication 재측정 — never-published 첫 공개 R6/W12만 HARD FAIL (2026-10-06 KST)

사용자 CACHE LIVE 실측:
- 이미 공개 이력이 있는 곡의 공개: Worker 1 / D1 query R1-W1 / physical **R4/W2**.
- 이미 등록된 곡의 source 1->2 전환: Worker 1 / D1 query R2-W1 / physical **R6/W3**.
- 한 번도 공개한 적 없는 Music Note 곡의 최초 공개: Worker 1 / D1 query R1-W1 / physical **R6/W12**.
- 그 신규 등록곡에서 이어진 source 전환: Worker 1 / D1 query R1-W1 / physical **R6/W3**.
- 따라서 app355 기준 신규 회귀가 아니라, 기존에 남아 있던 **first-publication INSERT fanout W12**가 정확히 재현됨.
- read는 과거 R7에서 현재 R6으로 줄었지만 write W12는 그대로라 hard gate FAIL.

W12 원인 — 기존 live schema read-only audit와 이번 실측이 일치:
1. canonical `tracks` INSERT **W6**
   - table row W1
   - PK autoindex W1
   - Music Note에도 적용되는 secondary index W4
2. legacy `explore_derived_tracks` INSERT **W5**
   - table row W1
   - PK autoindex W1
   - latest/popular/profile rank index W3
3. global `explore_shared_revision` UPDATE **W1**
= 총 **W12**.

이미 증명된 저비용 후보:
- isolated RATE_DB Run `37150337923`에서 cutoff 기반 candidate로:
  - first publication **W12 -> W2**
  - source/media swap **W3 -> W1**
  - visibility change **W2 -> W1**
  를 실제 D1 billing meta로 증명.
- 방식은 기존 사용자 row를 수정하지 않고, release cutoff 이후 새 Music Note row만:
  - legacy tracks secondary indexes 대상에서 제외
  - legacy derived mirror 대상에서 제외
  - legacy global shared-revision 대상에서 제외
  - canonical tracks row + PK만 유지
  하는 구조.
- 기존 row는 cutoff 이전 legacy 경로를 그대로 유지하므로 기존 등록곡의 기능/비용 경로를 건드리지 않는 설계가 가능.

현재 적용 차단:
- shared D1은 PREVIEW/TEST/PRODUCTION 공용.
- PREVIEW source/Worker는 R2 hybrid/R2-only publication authority가 준비돼 있음.
- TEST는 app354 승격으로 최신 Worker source는 올라갔지만 live environment flag/authority parity를 shared cutover 전에 별도 확인해야 함.
- PRODUCTION은 아직 이전 release라 새 Music Note row를 legacy derived/shared-revision 없이 안전하게 읽는 전체 parity가 보장되지 않음.
- 따라서 지금 W2 cutover를 shared D1에 바로 적용하면 정식앱의 Feed/profile/search/media freshness를 깨뜨릴 위험이 있어 **미적용 유지**.

보호 기준:
- 현재 registered 공개 **R4/W2**, source **R6/W3**, 비공개 **R3/W2** 경로는 추가 원인 없이 수정 금지.
- app355 PC↔모바일 공개/비공개 즉시 동기화 보호.
- 좋아요/저장하트/thumbnail/UI/Music Note/Library 정상 기능 보호.
- 새 구조는 비용이 기존보다 증가하면 FAIL.
- 사용자 row migration/backfill/delete/rewrite 금지.
- shared D1 변경은 3환경 read-authority parity 확인 + 사용자 승인 전 금지.

## 0QA. app355 PREVIEW — 공개곡 타기기 동기화 복구 + 새로고침 Worker 비증가 경로 배포 (2026-10-06 KST)

사용자 발견 회귀:
- 공개 동작 자체 비용은 **R4/W2**로 정상인데, 같은 계정의 다른 기기에서 공개곡이 즉시 보이지 않음.
- 변경 없는 새로고침에서 CACHE LIVE Worker가 1씩 증가하는 현상 보고.
- 비용 절감보다 정상 기능 보존을 우선하고 source 추가 절감 작업은 중단.

원인/수정:
- app335 이후 warm reload/route entry는 비용을 줄이기 위해 Cloudflare revision 확인을 막고 hidden→visible 때만 재검증했는데, 실제 공개 변경을 다른 기기에 알려주는 별도 change signal이 없어 warm cache가 오래 남을 수 있었음.
- 기존 사용자별 RTDB 동기화 채널에 **전용 `userSync/{uid}/explorePublication` 신호**를 additive로 추가.
- 공개/비공개가 canonical Explore에 성공한 뒤에만 작은 확정 상태를 1회 전달.
- 공개는 Worker 응답의 compact `snapshotItem`을 같이 전달하여 다른 기기가 Feed/공개프로필/뮤직노트 공개상태 캐시를 **기기에서 직접 변경**.
- 비공개는 해당 곡만 로컬 Feed/프로필 캐시에서 제거.
- 신호 수신/재생만으로 Cloudflare Worker를 호출하지 않음.
- 신호 실패는 이미 성공한 canonical 공개/비공개 동작을 실패 처리하지 않으며 기존 R2 revision 복구 경로를 유지.
- 다른 기존 Music Note / Recent / Like RTDB 신호는 변경하지 않음.

변경 파일:
- `src/services/userDomainSyncService.ts`
- `database.rules.json`
- `src/services/explorePublicationService.ts`
- `src/pages/FavoritesPage.tsx`
- `src/pages/ExplorePage.tsx`
- `public/app-version.json`
- `.deploy/preview-app-release.trigger`

검증/배포:
- immutable preflight Run `37364316058`: **SUCCESS**.
  - TypeScript / Build / release static checks / Worker dry-run / shared D1 read-only preflight PASS.
  - 실제 배포 없음.
- PREVIEW App Release Run `37365134850`: **SUCCESS**.
  - deployed exact commit: `6a6c05981e3945d6e67cd7623c35680cd1c0abd4`.
  - TypeScript PASS.
  - Build PASS.
  - shared RTDB Rules OAuth/PUT + exact source match PASS.
  - `NO_USER_DATA_MIGRATION=true`.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` app **355** / exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
- Cloudflare Worker code/deploy 변경 0.
- Functions / Firestore Rules / D1 schema·trigger / 사용자 원본 데이터 변경 0.
- shared RTDB Rules는 기존 규칙을 유지한 채 `explorePublication` owner-only bounded node만 추가.

환경 상태:
- PREVIEW: app355 fix 배포 완료.
- TEST: 직전 중단 요청 전에 이미 app354 승격 Run `37362260739`가 완료되어 **TEST_VERIFIED** 상태. app355는 아직 TEST에 올리지 않음.
- PRODUCTION: **비변경**. app355 또는 app354의 추가 PRODUCTION 승격 없음.

현재 실사용 게이트:
1. 기기 A에서 등록된 곡 공개 → 기존 D1 **R4/W2** 기능/비용 유지 확인.
2. 같은 계정 기기 B의 Music Note/Explore에 공개 상태/곡이 자동 반영되는지 확인.
3. 변경 없는 warm 새로고침에서 CACHE LIVE **Cloudflare Worker 0** 확인.
4. 기기 A 비공개 → 기기 B에서 해당 곡 자동 제거 확인.
5. 위 기능 PASS 전 source R6/W3 추가 절감 및 TEST/PRODUCTION 추가 승격 금지.

주의:
- app355의 "Worker 0"은 **정상 캐시가 있는 변경 없는 warm reload** 기준. 새 기기/캐시 없음은 필요한 최초 동기화를 할 수 있음.
- 실제 PC↔모바일 실사용 결과는 아직 **사용자 검증 전**.

## 0PZ. 동일 세션 연속 3단계 재확인 — R4/W2 → R6/W3 → R3/W2 (2026-10-06 KST)

사용자 확인 테스트를 같은 흐름에서 연속 실행:
1. 순수 공개: **R4/W2**.
2. 이어서 다른곡 source 전환: **R6/W3**.
3. 이어서 비공개: **R3/W2**.

공통:
- 각 동작 Worker 1.
- Firestore hot path R0/W0.
- 공개/비공개 정상 경로 비용이 source 전환 전후에도 흔들리지 않음.

판정:
- 364 적용 후 세 경로의 현재 제품 기준을 **공개 R4/W2 / source 전환 R6/W3 / 비공개 R3/W2**로 고정.
- 직전 공개 R6/W3 단발 캡처는 재현되지 않았으며 현재 기준값에서 제외.
- 공개/비공개는 추가 수정 금지.
- 남은 최적화 대상은 source 전환 R6/W3의 read만.
- shared D1 rollback 불필요, TEST/PRODUCTION 승격은 별도 승인 전 금지.

## 0PY. 순수 공개 실기기 재확인 — R4/W2 정상, 공개 회귀 해제 (2026-10-06 KST)

사용자 재테스트:
- 비공개 상태에서 공개 설정을 열고 곡 선택/옵션을 전혀 건드리지 않은 채 즉시 `공개` 실행.
- CACHE LIVE 결과:
  - Worker 1.
  - D1 query R1/W1.
  - D1 physical **R4/W2**.
  - Firestore hot path **R0/W0**.
  - R2 Class A 15 / Class B 10.
- 공개 모달을 연 시점에는 서버 사용 0, 실제 공개 버튼 실행에서만 위 비용 발생.

판정:
- 364 적용 후 **순수 공개 경로는 기존 기준 R4/W2로 정상 유지**.
- 직전 R6/W3 캡처는 순수 공개의 고정 회귀가 아님. 해당 실행에서 media/source 관련 조건이 함께 섞였을 가능성이 있으나 정확한 조건은 미확정.
- 따라서 `공개 R6/W3 media-path 오진입`을 현재 blocker로 보지 않는다.
- 현재 남은 비용 이슈는 source 1->2 **R6/W3**.
- 비공개는 **R3/W2** 정상 유지.
- 364 rollback 불필요.
- TEST/PRODUCTION 승격 판단은 source/media 기능 parity 확인 후 별도.

## 0PX. 364 실기기 재측정 — source 개선 / 공개 회귀로 현재 게이트 FAIL (2026-10-06 KST)

사용자 실기기 CACHE LIVE 순서:
- 공개: D1 **행읽기 R6 / 행쓰기 W3**.
- source 1->2: D1 **행읽기 R6 / 행쓰기 W3**.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**.
- Firestore hot path R0/W0, Worker 1회씩.

판정:
- source 1->2는 직전 **R10/W3 -> R6/W3**로 유의미하게 감소.
- 비공개는 기존 **R3/W2 유지**.
- 공개는 직전 **R4/W2 -> R6/W3**로 회귀했으므로 현재 릴리스 게이트는 **FAIL**.
- TEST/PRODUCTION 승격 금지. 좋아요/저장하트/UI/thumbnail은 건드리지 않음.

원인 분리용 격리 Cloudflare D1 재측정:
- Run `37356891372` — ephemeral D1 only, cleanup PASS.
- 364 candidate 순수 registered 공개: **R3/W2**.
- 364 candidate 순수 registered 비공개: **R3/W2**.
- 364 candidate 공개 + media field 변경: **R4/W3**.
- 364 source/media 전환: **R4/W3**.
- verifier PASS / shared-user D1 touched 0.
- 기존 364 검증의 `REGISTERED_VISIBILITY_W2_GUARD`는 pre-364/current trigger를 검사하고 있어 candidate 자체 visibility 보장이 아니었던 coverage gap을 수정함.

현재 결론:
- 364 trigger 자체의 **순수 visibility 공개는 W2**로 재증명됨.
- 사용자 공개 R6/W3의 쓰기 형태는 순수 공개가 아니라 **media-capable path가 함께 깨어난 경우와 같은 W3 signature**임.
- 따라서 지금 즉시 364를 rollback하면 source read 개선만 잃고 공개 원인을 못 고칠 가능성이 높아 rollback은 실행하지 않음.
- 다음은 실제 제품 공개 batch가 왜 media path를 깨우는지 `registered / selectionChanged / refreshSourceMedia / sourceMedia` 경계를 정확히 추적하고, 순수 공개가 media update를 절대 포함하지 않도록 원인 지점만 수정한다.
- 추가 shared D1 trigger 변경/rollback은 사용자 승인 전 실행 금지.

## 0PW. 사용자 승인 364 shared D1 trigger cutover 완료 (2026-10-06 KST)

사용자 승인 범위:
- source 1->2 D1 행읽기 절감용 364 shared-D1 trigger 2개 교체.
- 다른 기능/좋아요/저장하트/UI/thumbnail/사용자 데이터는 변경 금지.

적용 결과:
- 첫 적용 Run `37352653590`: postflight exact-text 비교가 Cloudflare D1의 trigger SQL 정규화와 달라 **FAIL**, 즉시 자동 rollback 실행.
  - `364_EXACT_ROLLBACK_VERIFIED=PASS`.
  - 사용자 row 변경 0.
- postflight를 exact text가 아닌 고정된 trigger semantic invariant + unrelated trigger exact comparison으로 보강.
- 재적용 Run `37352860772`: **SUCCESS**.
  - `364_LIVE_BASELINE_MATCH_ROLLBACK=PASS`.
  - `364_TARGET_TRIGGER_SEMANTICS=PASS`.
  - `364_ONLY_TWO_APPROVED_TRIGGERS_CHANGED=PASS`.
  - `364_SHARED_REVISION_UNCHANGED=PASS`.
  - `364_USER_ROWS_TOUCHED=0_BY_DDL_CONTRACT`.
  - PREVIEW / TEST / PRODUCTION feed smoke PASS.
  - Worker versions unchanged PASS:
    - PREVIEW `0badfdf8-597d-4f69-9a05-b6fb32612f01`
    - TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`
    - PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`
  - main / production refs unchanged PASS.
- post-cutover Release System Audit Run `37352997906`: **SUCCESS**.
- 완료된 TEMP 364 apply workflow는 삭제하여 비의도 재실행 경로 제거.
- exact rollback SQL 및 guarded runner는 저장소에 유지.
- migration/backfill/delete/user-row rewrite 0.
- Firebase Hosting/Functions/Rules 추가 변경 0.
- TEST/PRODUCTION Worker code 변경 0.

현재 비용 목표:
- 직전 실기기 source 1->2: **D1 행읽기 R10 / 행쓰기 W3**.
- 364 격리 증명: trigger 부분 R9 -> R4, 따라서 현재 제품 source 전환 예상 **약 R5/W3**.
- 공개 **R4/W2**, 비공개 **R3/W2** 경로는 이번 trigger가 media/source change에만 작동하도록 보호.
- 다음은 같은 A곡 source 1->2 실기기 CACHE LIVE 재측정. 기능 차이 또는 비용 목표 미달이면 rollback 기준으로 원인 재분해.

## 0PV. app354 PREVIEW UI warning removal + 365 live measurement confirmed (2026-10-06 KST)

사용자 실기기 CACHE LIVE 재측정:
- 공개: D1 **행읽기 R4 / 행쓰기 W2**.
- source 1->2: D1 **행읽기 R10 / 행쓰기 W3**.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**.
- 365 예상값과 정확히 일치. 같은 request의 중복 canonical like read 1회를 제거한 효과가 실제 제품에서 확인됨.

source 1->2만 R10/W3인 이유:
- 공개/비공개는 visibility 상태만 바꾸므로 heavy legacy media projection trigger를 깨우지 않음.
- source/media 전환은 cover/duration/Suno URL 등 media field를 바꾸므로 old TEST/PRODUCTION 호환용 legacy derived mirror trigger가 실행됨.
- 현재 source 전환 physical writes:
  1. canonical `tracks` W1.
  2. legacy `explore_derived_tracks` media mirror W1.
  3. shared revision W1.
  = **W3**.
- current trigger chain의 격리 UPDATE RETURNING 비용 R9에 publication 후 canonical like 확인 R1이 더해져 실제 product **R10**.
- 364 compatibility candidate는 old TEST/PRODUCTION 호환을 유지하면서 trigger read를 줄이는 후보이며 isolated target은 source 전환 약 **R5/W3** product 수준.
- legacy mirror를 제거하는 357은 모든 환경이 새 R2 authority로 승격된 뒤 별도 승인 시 최종 **R4/W2** 수준 재검증 후보.

사용자 UI 요청:
- 비공개 확인 모달의 경고 문구
  `비공개로 전환하면 Explore와 공개 프로필에서 즉시 숨겨집니다. D1 기록은 삭제하지 않습니다.`
  를 제거.
- 확인 버튼/비공개 동작/배치 로직/데이터 처리는 변경하지 않음.
- 변경 파일: `src/pages/FavoritesPage.tsx`.
- app version: **354**.
- Firebase PREVIEW Hosting Run `37350776803`: **SUCCESS**.
- TypeScript PASS / Build PASS / PREVIEW exact build PASS / TEST-PRODUCTION unchanged PASS.
- Worker/Functions/Rules/shared D1/user data 변경 0.

## 0PU. 사용자 실기기 R5/R11/R3 분석 후 365 PREVIEW 배포 완료 (2026-10-06 KST)

사용자 동일 A곡 실기기 CACHE LIVE 결과:
- 공개: D1 **행읽기 R5 / 행쓰기 W2**, D1 쿼리 읽기 2 / 쓰기 1.
- source 1->2: D1 **행읽기 R11 / 행쓰기 W3**, D1 쿼리 읽기 2 / 쓰기 1.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**, D1 쿼리 읽기 0 / 쓰기 1.

원인 확정:
- 공개/source 전환에서 남은 D1 읽기 쿼리 2개는 publication 후 Feed R2와 Public Profile R2를 갱신할 때
  같은 곡의 canonical like_count를 `readCanonicalPublicationLike071`로 각각 한 번씩 중복 확인하는 경로.
- source 전환 R11은 current trigger chain UPDATE RETURNING 기준 격리 R9 + canonical like 확인 R1 + R1과 일치.
- 비공개는 item 제거 경로라 canonical like 재확인이 없어 D1 query read 0.

365 수정:
- `readCanonicalPublicationLike071`의 정확한 D1 canonical authority는 그대로 유지.
- 같은 Worker request / 같은 trackId 안에서 첫 canonical like read Promise만 request-local WeakMap으로 공유.
- 두 번째 Feed/Profile 확인만 제거. 다른 request 간 cache 공유 없음.
- 좋아요 쓰기 경로, like_count 의미, 하트, UI, 저장하트 변경 0.
- patch: `095-publication-canonical-like-request-cache.mjs`.
- verifier: `verify-365-publication-canonical-like-request-cache.mjs`.
- 첫 Audit Run `37349153504` FAIL은 기존 follow strict-audit가 365의 의도된 publication helper 변경을 unrelated change로 판단한 검사식 문제였고, 제품 기능 실패 아님.
- follow audit normalization 보강 후 Release System Audit Run `37349479060`: **SUCCESS**.
- PREVIEW Worker Release Run `37349747533`: **SUCCESS**.
- active PREVIEW Worker:
  - before `368d64ac-6b66-4023-88ec-a3ed85068844`
  - after `0badfdf8-597d-4f69-9a05-b6fb32612f01`
- 배포 후 smoke:
  - Feed PASS.
  - Profile PASS.
  - changed-card D1 R0/W0 PASS.
  - warm revision R0/W0 PASS.
  - TEST/PRODUCTION Workers unchanged PASS.
- shared D1 schema/trigger, user data, Firebase Hosting, Functions, Rules 변경 0.
- 364 shared-D1 candidate는 여전히 미적용.

다음 실기기 목표:
- 동일 순서 재측정:
  1. 공개: 기존 R5/W2에서 **R4/W2 예상**.
  2. source 1->2: 기존 R11/W3에서 **R10/W3 예상**.
  3. 비공개: 기존 **R3/W2 유지 예상**.
- 이후 source R10의 대부분은 shared D1 legacy trigger fanout이므로, 사용자 승인 시 364 shared-D1 trigger 적용으로 isolated 기준 추가 절감 후보 **R5/W3**.
- TEST/PRODUCTION이 새 authority로 승격된 뒤 legacy mirror 제거 357 후보는 최종 **R4/W2 수준**을 목표로 재검증.

## 0PT. PREVIEW 361 사용자 실기기 CACHE LIVE 결과 — 공개 개선, source 전환 미해결 (2026-10-06 KST)

사용자 동일 A곡 순서 실측:
1. 공개: D1 **행읽기 R5 / 행쓰기 W2**, D1 쿼리 읽기 2 / 쓰기 1.
2. source 1->2 전환: D1 **행읽기 R11 / 행쓰기 W3**, D1 쿼리 읽기 2 / 쓰기 1.
3. 비공개: D1 **행읽기 R3 / 행쓰기 W2**, D1 쿼리 읽기 0 / 쓰기 1.

판정:
- 361 PREVIEW Worker 배포 효과는 공개 경로에서 확인됨: 직전 사용자 실기기 공개 R11 계열 -> 현재 **R5/W2**.
- 비공개는 **R3/W2 유지**, 회귀 없음.
- source 전환은 **R11/W3로 여전히 FAIL**. 361의 inline media preselect 제거만으로 실제 product source-swap의 두 D1 read query 및 legacy trigger fanout이 해소되지 않았음.
- 따라서 다음 작업은 source 전환 R11/W3만 집중. 공개/비공개/좋아요/저장하트/UI/thumbnail은 변경 금지.
- 364 shared-D1 candidate는 isolated R4/W3까지 증명됐지만 아직 shared trigger 미적용. 사용자 승인 전 적용 금지.
- TEST/PRODUCTION unchanged.

## 0PS. 361 PREVIEW live 완료 / 364 rollback·최종 감사 PASS (2026-10-06 KST)

- PREVIEW Worker 361 실제 배포:
  - source lock: `ed2458cff29b978960d1169141ca16f076243272`.
  - deploy trigger: `7031afcb713bf3ba21d83317600e36e871c85e30`.
  - Worker Release Run `37344481780`: **SUCCESS**.
  - active PREVIEW Worker: `368d64ac-6b66-4023-88ec-a3ed85068844`.
  - Feed/Profile smoke PASS.
  - public-like changed-card D1 **R0/W0**.
  - warm revision D1 **R0/W0**.
  - TEST/PRODUCTION Workers unchanged PASS.
- 364 compatibility candidate safety:
  - target: normal source 1->2 D1 **행읽기 R4 / 행쓰기 W3**.
  - legacy media mirror 유지.
  - shared revision 유지.
  - missing-derived repair / content rebuild 유지.
  - exact rollback SQL 추가:
    `cloudflare/explore-worker/candidates/364-publication-read-compaction-compat-rollback.sql`.
  - rollback verifier 추가 및 Release System Audit Run `37344906830`: **SUCCESS**.
  - shared/user D1 write 0, migration/backfill/delete/rewrite 0.
- 완료된 임시 진단 workflow 3개는 삭제함. 재현용 측정 script/verifier/candidate/rollback은 저장소에 유지.
- 현재 실제 blocker:
  - 364는 **shared D1 trigger 변경**이므로 사용자 명시 승인 전 적용 금지.
  - 지금 사용자 실기기에서 먼저 A 공개 / source 1->2 / 비공개의 D1 행읽기 R / 행쓰기 W를 다시 측정하면 361 live 효과를 확인할 수 있음.
  - TEST/PRODUCTION이 새 R2 authority로 승격된 뒤에는 legacy mirror 제거 357 후보로 **R3/W2** 추가 절감 가능.

## 0PR. PREVIEW publication Rows Read 361 배포 완료 + 364 shared-D1 후보 준비 (2026-10-06 KST)

- 사용자 기준: 모든 R/W 보고는 Cloudflare D1 **물리 행 기준**으로 표기.
- 실제 원인 분해:
  - source 1->2 현재 trigger chain 격리 실측: UPDATE RETURNING 포함 **R9 / W3**.
  - current legacy track projection + Music Note derived trigger가 불필요한 read 대부분을 차지함.
  - 357 구환경 호환 제거 후보는 **R3 / W2**까지 가능하지만 TEST/PRODUCTION old reader 보호 때문에 아직 shared D1에 미적용.
- 호환 유지형 364 후보:
  - legacy media mirror와 shared revision을 유지한 채 trigger 내부 redundant read만 줄이는 방식.
  - 격리 Cloudflare D1 Run `37335417591`: **R9/W3 -> R4/W3 PASS**.
  - missing-derived repair / content rebuild / registered public-private W2 guard PASS.
  - shared/user D1 touched 0.
  - candidate: `cloudflare/explore-worker/candidates/364-publication-read-compaction-compat.sql`.
  - verifier: `scripts/verify-364-publication-read-compaction-compat.mjs`.
  - 자동 적용 wiring 없음.
- Worker-only 361:
  - first-public R2 precheck + inline source/media authority 사용으로 불필요 canonical pre-read 제거.
  - Release System Audit Run `37344089981`: **SUCCESS**.
  - PREVIEW Worker Release Run `37344481780`: **SUCCESS**.
  - active PREVIEW Worker before `afbb5d00-a489-4c48-8b02-9ad6f1795bb0`.
  - active PREVIEW Worker after `368d64ac-6b66-4023-88ec-a3ed85068844`.
  - Feed/Profile/R2-only smoke PASS, changed-card D1 R0/W0, warm revision R0/W0.
  - TEST/PRODUCTION Workers unchanged PASS.
- 변경하지 않은 것:
  - Firebase Hosting 0.
  - Functions/Rules 0.
  - shared D1 schema/trigger 0.
  - user data migration/backfill/delete/rewrite 0.
  - UI/CSS/좋아요/저장하트/thumbnail 변경 0.
- 현재 다음 게이트:
  1. PREVIEW 실기기에서 A 공개 / source 1->2 / 비공개 D1 **행읽기 R / 행쓰기 W** 재측정.
  2. 364 shared-D1 trigger 적용은 shared DB 변경이므로 사용자 명시 승인 전 실행 금지.
  3. TEST/PRODUCTION 승격 후 legacy mirror 제거가 가능해지면 357로 최종 **R3/W2 후보**를 별도 승인 후 적용.

## 0PQ. 사용자 비용 우선순위 재고정 — Rows Read 1순위, Rows Written 2순위 (2026-10-05 KST)

- 사용자 재지시:
  1. **D1 physical Rows Read 최소화가 1순위**.
  2. D1 physical Rows Written W1~W2가 2순위.
  3. mutation Worker 요청 1 이하.
  4. 기능/UI/좋아요/저장하트/thumbnail 보존.
- 최신 실기기 CACHE LIVE 캡처에는 A 한 곡 mutation에서 행읽기 **R11 / R8 / R3**가 관측됨.
- 직전 360 isolated proof는 W3->W2 가능성 확인 목적이라 synthetic rows_read 2/3/2만 확인했으며, 실제 product R11/R8/R3를 설명/감축한 검증은 아니었음.
- 따라서 현재 작업은 쓰기 W2 cutover보다 먼저:
  - A 공개 / source 1->2 / 비공개 각각의 product D1 Rows Read를 query/trigger 단위로 분해.
  - exact PK lookup 외 불필요한 profile/stats/legacy-derived/revision read를 제거 또는 R2/local payload로 대체 가능한지 검증.
  - whole table/owner collection scan은 즉시 FAIL.
- TEST/PRODUCTION 미승격 자체가 추가 읽기/쓰기를 직접 발생시키는 것은 아님.
  - 다만 shared D1이 구 TEST/PRODUCTION 코드와 동시에 호환되어야 해서 legacy mirror/revision을 아직 유지하고 있고, 그 호환용 trigger/projection이 PREVIEW mutation의 추가 비용에 포함됨.
- shared D1 / user data mutation은 사용자 승인 전 계속 금지.

## 0PP. A 한 곡 publication 비용 후보 실측 PASS — W2/W2/W2, 아직 shared D1 미적용 (2026-10-05 KST)

- 사용자 현재 목표를 A 한 곡의 세 동작으로 한정:
  1. 공개.
  2. 생성 1번곡 -> 2번곡 source/media 전환.
  3. 비공개.
- 사용자 CACHE LIVE 캡처의 현재 product 비용은 physical D1 **W3 1건 + W2 2건**이며, 변화가 없다는 지적이 맞음.
  - 직전 app358은 read authority 전환이어서 이 mutation fanout을 직접 줄이지 않았음.
- 범위 고정 verifier:
  - `scripts/verify-360-publication-a-track-cost-target.mjs`
  - commit `09d78fa6f6c583771d18e5827c30aa11d846daac`.
  - release audit hard gate commit `f63bbe94ef52c52d3ab48277b492617871d770bb`.
- 실제 Cloudflare 원격 **격리 D1** 비용 실측:
  - script `scripts/measure-360-isolated-publication-d1.mjs`
  - commit `e66413faba1b3941eceefc51bfc5d7722c408ac7`.
  - audit wiring commit `6db6da363637b5b32c08956cb1eb885a32b640cf`.
  - audit Run `37301210759`: **SUCCESS**.
- Run 37301210759 정확한 결과:
  - A 공개: `rows_written=2`, `rows_read=2`.
  - 현재 A 1->2 source 전환: `rows_written=3`, `rows_read=3`.
  - 357 candidate 적용 상태 A 1->2 source 전환: `rows_written=2`, `rows_read=2`.
  - A 비공개: `rows_written=2`, `rows_read=2`.
  - 최종 isolated sequence: **W2 / W2 / W2 PASS**.
  - temporary D1는 완료 후 삭제 PASS.
  - shared/user D1 touched = 0.
- W3 원인과 제거 지점:
  1. canonical `tracks` media UPDATE W1 — 유지.
  2. legacy `explore_derived_tracks` media mirror W1 — **media-only일 때 제거 후보**.
  3. `soridraw_shared_rev_tracks_au_051` shared revision W1 — 현재 유지.
  - 따라서 357 candidate는 기능을 없애지 않고 legacy media-only mirror만 생략해 W3 -> W2로 줄임.
- 현재 제품에는 아직 미적용:
  - `PRODUCT_SHARED_D1_CUTOVER=NOT_APPLIED`.
  - 따라서 지금 PREVIEW 실기기에서 다시 누르면 source 전환은 여전히 W3가 나오는 것이 정상.
- 적용 차단 이유:
  - shared D1은 PREVIEW/TEST/PRODUCTION 공용.
  - 현재 main/TEST/PRODUCTION old Worker는 336/341/358 R2-only compatibility가 없고 legacy derived/revision 경로를 계속 사용.
  - shared trigger만 먼저 바꾸면 구환경 공개곡 media freshness를 깨뜨릴 수 있음.
  - 사용자 승인 없이 shared D1 trigger 변경, main/TEST 승격, PRODUCTION 승격 금지.
- 검증:
  - TypeScript PASS.
  - Build PASS.
  - static audit PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight read-only PASS.
  - branch refs unchanged PASS.
- 절대 보호:
  - 좋아요/저장하트 즉시동기화.
  - +30초 canonical save.
  - app353 thumbnail.
  - UI/CSS.
  - 사용자 데이터 delete/backfill/rewrite 없음.

## 0PO. 사용자 범위 재고정 — A 한 곡의 공개/2번곡 전환/비공개 비용만 최적화 (2026-10-05 KST)

- 사용자 지시로 현재 우선순위를 다시 고정:
  1. A 한 곡 공개.
  2. 같은 A에서 생성 1번곡 -> 2번곡 source 전환.
  3. A 비공개.
- 최신 실기기 CACHE LIVE 캡처에서 mutation 3회는:
  - Worker는 각 요청 1회.
  - physical D1 writes는 **W3 한 건 + W2 두 건**.
  - 관측 예: R11/W3, R8/W2, R3/W2.
- 판정:
  - W2 두 경로는 현재 합격선 안이므로 정상 기능 보호를 우선하고 불필요하게 다시 건드리지 않음.
  - 남은 HARD FAIL은 **source/media 전환 W3 -> W2 이하**.
  - 직전 358 R2-only 작업은 read prerequisite였고, 이 mutation physical-write 숫자를 직접 줄이지 않으므로 사용자 체감상 "변화 없음"이 맞음.
- W3 원인 재확정:
  1. canonical tracks media UPDATE W1.
  2. legacy explore_derived_tracks media mirror W1.
  3. shared revision W1.
- 이미 준비된 357 candidate는 media-only legacy mirror만 제거하여 **W2**를 목표로 함.
- 이번 범위를 코드/감사에서 다시 잠그기 위해:
  - `scripts/verify-360-publication-a-track-cost-target.mjs`
  - commit `09d78fa6f6c583771d18e5827c30aa11d846daac`
  - Release System Audit hard gate 추가 commit `f63bbe94ef52c52d3ab48277b492617871d770bb`.
- 중요한 안전 제한:
  - shared D1은 PREVIEW/TEST/PRODUCTION 공용.
  - 현재 TEST/PRODUCTION old Worker는 legacy derived/revision read path를 아직 사용하므로, W3->W2 trigger cutover를 PREVIEW만 위해 shared D1에 적용하면 구환경 카드/media freshness를 깨뜨릴 수 있음.
  - 따라서 **사용자 승인 없는 shared D1 trigger 변경/PRODUCTION 승격은 금지**.
- 현재 실제 다음 목표:
  - A-track W2 candidate를 Release Audit + 격리 비용 검증으로 확정.
  - 필요한 cross-env compatibility 승격 범위를 최소화.
  - 실제 shared D1 cutover 전에는 사용자에게 정확한 영향/승인 필요 지점을 한 번만 보고.
- 절대 보호:
  - 좋아요/저장하트 즉시 동기화.
  - +30초 canonical save.
  - app353 thumbnail.
  - UI/CSS/반응형.
  - 사용자 원본 데이터 delete/backfill/rewrite 금지.

## 0PN. PREVIEW R2-only publication read 실제 배포/실API 검증 PASS — 사용자 실사용 확인 대기 (2026-10-05 KST)

- 목적: dormant app358을 PREVIEW에서만 실제 활성화하고 Feed/Profile/Genre/Search가 shared D1 없이 동작하는지 live Worker에서 확인.
- 활성화:
  - `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
  - activation commit `5f5085689549c456056fd9d0d373c1e86d7f6532`.
- verifier/release guard:
  - active-flag verifier commit `d97351407d42d83e28ec36c0f6f3d8b88bd6fb86`.
  - live smoke guard commit `c572b7c5611fb4de2e9617b84cdcb771fc99df9b`.
  - propagation-safe smoke fix `4d162ea6587f0355af89a12a97731e0fbe2884aa`.
  - temporary remote-dev diagnostic은 완료 후 삭제 commit `7c4af5e4131490fe95c120c43cf2ac36bacef2da`.
- Release System Audit:
  - Run `37292378308`: SUCCESS — active flag / TypeScript / Build / Phase-B / TEST·PROD dry-run PASS.
  - propagation fix 후 Run `37293416600`: SUCCESS.
- 첫 PREVIEW Worker deploy Run `37292714110`:
  - candidate Worker version `59181b26-26c3-4041-9676-77b2dd3fc62c` 업로드/배포까지 성공.
  - 배포 직후 첫 edge request가 아직 구 Worker를 응답하여 358 authority header가 없어서 smoke FAIL.
  - 자동 rollback이 즉시 동작하여 기존 정상 version `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`로 100% 복구 SUCCESS.
  - shared D1/R2/user data rollback 작업은 없었음.
- 원인 분리:
  - read-only remote-dev Run `37293014067`: R2-only latest/popular HTTP 200, `R2-ONLY-358`, D1 R0/W0 확인.
  - full first-page read Run `37293243993`: latest limit40 HTTP 200 / D1 R0W0, popular limit20 HTTP 200 / D1 R0W0.
  - 따라서 source/runtime 오류가 아니라 **Cloudflare deploy 완료 직후 edge propagation 시간차**로 확정.
  - 재배포 smoke는 cheap limit1 probe로 새 authority가 실제 edge에 도달할 때까지 bounded wait 후 full test하도록 수정.
- 최종 PREVIEW deploy:
  - trigger commit `a7573ea1b15541158e6f8c8a2e5b9e7b2f68ec53`.
  - Run `37293663953`: **SUCCESS**.
  - before `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`.
  - active after `afbb5d00-a489-4c48-8b02-9ad6f1795bb0`.
  - propagation attempt 1: HTTP 200 / authority missing = old edge.
  - attempt 2: HTTP 200 / `R2-ONLY-358` = new edge active.
- 최종 live API PASS:
  - latest Feed: R2-only / D1 **R0 W0**.
  - popular Feed: R2-only / D1 **R0 W0**.
  - public profile tracks: R2-only / D1 **R0 W0**.
  - genre tracks: R2-only / D1 **R0 W0**.
  - title Search app341: R2-only / D1 **R0 W0**.
  - public-like changed-card: D1 **R0 W0**.
  - warm feed revision: D1 **R0 W0**.
  - `TEST_PRODUCTION_WORKERS_UNCHANGED=PASS`.
- 변경 범위:
  - Firebase Hosting 변경 0.
  - Functions/Rules 변경 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - TEST/PRODUCTION deploy 0.
- 현재 판정:
  - PREVIEW backend read cutover는 실제 live Worker 검증까지 PASS.
  - PC/모바일 UI 실사용 및 사용자가 직접 수행하는 공개/비공개/source-swap/좋아요 조작은 **실사용 검증 전**.
  - shared D1 first-public W12→W2 fanout cutover는 아직 적용 금지.
  - TEST 승격은 사용자 PREVIEW 실사용 확인 후에만 진행.

## 0PM. dormant R2-only publication read integration hard-gate PASS (2026-10-05 KST)

- 목표: 358 정적 source guard만 통과시키지 않고, 기존 R2 catalog Phase-B 기능 검증을 Release System Audit의 **hard gate**로 연결.
- audit workflow 변경:
  - `.github/workflows/soridraw-release-system-audit.yml`
  - commit `b5174d4ec055aef29affb331f2fcfed8af306a49`
  - hard `Static release-system verification` 단계에
    `scripts/verify-publication-w2-r2-catalog-phase-b.mjs` 추가.
- audit trigger HEAD:
  - `ac65599e705a1fe8f6dae2f31c470c251513d92a`
- Release System Audit Run `37247619845`: **SUCCESS**.
- hard integration 확인:
  - `PUBLICATION_R2_ONLY_358_SOURCE=PASS`
  - `PUBLICATION_R2_ONLY_358_FLAG_DEFAULT_OFF=PASS`
  - `W2_PHASE_B_R2_INTEGRATION=PASS`
  - latest deep paging PASS
  - popular deep paging PASS
  - public profile deep paging PASS
  - title search PASS
  - genre search PASS
  - artist search PASS
  - private/republish catalog marker PASS
  - first-publisher retry idempotency PASS
  - TEST Worker dry-run PASS
  - PRODUCTION Worker dry-run PASS
- 안전 상태:
  - 358 flag는 계속 OFF.
  - Worker deploy 0 / Firebase deploy 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - main/TEST/PRODUCTION branch 변경 0.
- 현재 남은 blocker:
  - main/TEST/production source는 아직 336/341/358 compatibility를 포함하지 않는 구 기준.
  - 따라서 shared D1 secondary-index/derived/revision fanout 제거와 358 flag ON은 계속 금지.
  - 다음 단계는 사용자 TEST 승격 승인 전까지 cross-env promotion readiness를 read-only로 유지하는 것.
- 비차단 노트:
  - `diagnose-069-live-like.yml`은 push마다 job 생성 없이 failure 상태를 남기는 오래된 진단 workflow 문제가 계속 보임.
  - 이번 358 release-system audit와 hard integration gate는 별도 SUCCESS이며 제품/358 검증 결과에는 영향 없음.

## 0PL. dormant R2-only publication read cutover 구현/감사 PASS — 아직 OFF, 배포/공유 D1 변경 없음 (2026-10-05 KST)

- 기준 preview implementation:
  - gate/runtime commit: `cec2411dc1afdf11a4ca37104089bc065aef1818`
  - composer/verifier commits: `63ada6c2be3053b409b6d0624c00606e8ed9f217`, `1c4f21e995e17577aadd1759a67425a468b5af2a`
  - canonical composed Worker: `38f56add6d5c1091b247a2b0838d2402f5439ca0`
  - canonical checksum pin: `792271da150fa21219cd6f62a5e67fccb7096e98`
  - final audit trigger HEAD: `35526001248414ec2b2cec76dbf22e12203a9df6`
- Release System Audit Run `37233167868`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - TEST Worker dry-run PASS.
  - PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight는 read-only PASS.
  - branch refs unchanged PASS.
- 신규 dormant flag:
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1`
  - PREVIEW wrangler에는 **아직 값이 없으므로 default OFF**.
  - gate는 catalog + hybrid + R2-only 세 조건이 모두 1일 때만 켜짐.
- ON 경로 계약:
  - Feed / Public Profile tracks / Genre는 R2 ordered catalog + shared track-card만 authority로 사용.
  - legacy derived row와 merge하지 않음.
  - Search는 기존 app341 R2-only authority를 그대로 보호.
  - 정상 R2-only path D1 read/write = **R0/W0** 정적 검증 PASS.
  - source swap은 shared track-card media authority를 사용.
  - private 이후 stale legacy row가 R2-only list를 되살리는 경로 없음.
- OFF 경로 계약:
  - 현재 app336 hybrid behavior를 core358로 그대로 보존.
  - flag OFF이면 기존 PREVIEW 실제 동작 변경 없음.
- 공유 데이터/배포:
  - Worker 배포 0.
  - Firebase Hosting 배포 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - TEST/PRODUCTION 변경 0.
- 아직 CUTOVER READY 아님:
  - audit 출력 `PUBLICATION_R2_ONLY_358_CUTOVER_READY=false`.
  - main/TEST/PRODUCTION에는 app336/app341/358 read authority가 아직 승격되지 않음.
  - default branch search에서도 336/341/358 markers 미탐지.
  - shared D1 fanout 축소는 이 cross-env blocker가 해소되기 전 실행 금지.
- 참고:
  - 같은 HEAD의 오래된 `diagnose-069-live-like.yml` 자동 workflow는 job 생성 없이 failure로 남지만, 이번 release-system audit와 358 verifier는 별도로 SUCCESS이며 358 작업의 합격 판정에는 사용하지 않는다.

## 0PK. never-published first publication W12 live schema exact fanout 확정 — read-only (2026-10-05 KST)

- 목적: first-public W12를 추측이 아니라 **현재 shared D1 실제 schema**로 정확히 분해.
- 임시 read-only 진단 workflow:
  - Run `37232092133`: SUCCESS.
  - 보강 Run `37232155889`: SUCCESS.
  - `REMOTE_D1_WRITES=0`.
  - `USER_DATA_MUTATION=0`.
  - 진단 완료 후 temp workflow 삭제 commit `4a3d32914e95553ec7fc6004085f2281856a27b9`.
- 현재 live `tracks`:
  - row count 70.
  - music_note 70.
  - public music_note 46.
  - `id TEXT PRIMARY KEY`이며 `sqlite_autoindex_tracks_1` 존재.
  - 명시 index 5개:
    1. `idx_tracks_latest_order`
    2. `idx_tracks_owner_latest`
    3. `idx_tracks_owner_source` UNIQUE
    4. `idx_tracks_primary_genre_latest`
    5. `idx_tracks_legacy_global_nonempty` partial
  - Music Note는 `legacy_global_id`가 비어 있으므로 5번 partial index에는 정상 first publish에서 entry를 만들지 않음.
- **현재 사용자 실측 W12와 live schema가 정확히 맞음**:
  1. canonical `tracks` INSERT:
     - table row W1
     - PK autoindex W1
     - latest_order W1
     - owner_latest W1
     - owner_source W1
     - primary_genre_latest W1
     - subtotal **W6**
  2. `explore032_track_insert` → `explore_derived_tracks`:
     - derived table row W1
     - derived PK autoindex W1
     - rank_latest W1
     - rank_popular W1
     - rank_profile W1
     - subtotal **W5**
  3. `soridraw_shared_rev_tracks_ai_051` → `explore_shared_revision` W1
  4. total **W6 + W5 + W1 = W12**
- 따라서 first-public W12는 Worker 중복 호출이 아니라 **단일 Worker 1회 안에서 D1 table/index/trigger fanout**으로 설명됨.
- 현재 Worker count:
  - user 실측 first publication Worker 1.
  - Worker 요청 중복이 W12의 원인이 아님.
- 이론적 post-cutover 최저선:
  - 현재 `tracks` table + TEXT PK 구조를 유지하면 canonical row W1 + PK autoindex W1 = **W2**가 현실적 floor.
  - W2를 위해 Music Note first publish가 나머지 4 secondary index / legacy derived insert / shared revision D1 write를 더 이상 정상 hot path에서 만들지 않아야 함.
- 그러나 현재 app336은 **hybrid**이며 Feed/Profile에서 아직 legacy path를 함께 읽음.
  - Search는 app341에서 R2-only이나 Feed/Profile은 R2 + legacy merge.
  - 따라서 first-public W2를 지금 shared D1에 적용하면 TEST/PRODUCTION 및 legacy recovery/query path를 깨뜨릴 위험.
- 안전한 다음 구조:
  1. 모든 환경에 R2 catalog/hybrid compatibility 승격.
  2. Feed/Profile/Genre도 검증된 **R2-only cutover mode**를 dormant flag로 먼저 구현/감사.
  3. R2-only가 실제 정확성을 보장한 뒤 Music Note 전용 secondary-index fanout과 derived/revision fanout을 단계적으로 종료.
  4. shared D1 구조변경은 별도 사용자 승인 전 적용 금지.
- 좋아요/저장하트 즉시동기화와 app353 Music Note thumbnail 경로는 이 작업과 완전히 분리/동결.

## 0PJ. publication source-swap W3→W2 후보 준비/감사 PASS — 적용은 cross-env hybrid 승격 전 차단 (2026-10-05 KST)

- 사용자 지시 기준:
  - D1 **physical Rows Written 최우선**.
  - mutation마다 Worker 요청 수를 함께 확인.
  - 정상 기능/좋아요 즉시동기화를 비용 때문에 변경 금지.
- 현재 실기기 source swap baseline:
  - Worker **1**.
  - D1 physical **R11 / W3**.
  - Firestore **R0 / W0**.
- W3 구성 확정:
  1. canonical `tracks` media UPDATE W1 — 유지.
  2. `explore032_track_update` → legacy `explore_derived_tracks` media mirror W1.
  3. `soridraw_shared_rev_tracks_au_051` → shared revision W1 — 구환경 freshness 보호.
- 안전한 W2 후보:
  - canonical tracks W1 유지.
  - shared revision W1 유지.
  - **media-only legacy derived mirror만 W0**.
  - non-media/content 변경은 기존 derived cold-recovery projection 유지.
  - 예상 normal source swap = physical **W2**, Worker 요청 수는 기존 **1회 유지**.
- PREVIEW 준비 파일:
  - candidate migration:
    `cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid.sql`
    - commit `efad094f8452463503e839d72faa404deb171e77`.
  - rollback:
    `cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid_rollback.sql`
    - commit `ef631e132255b4f1fa1768d32ba21979586dd100`.
  - readiness verifier:
    `scripts/verify-357-publication-source-swap-w2-readiness.mjs`
    - initial commit `e55a5241773963b0990d435a6e5ecefd37b77331`.
    - verifier comment false-positive fix `eed2d860495446c9709c5a1df16155244a443a6d`.
  - Release System Audit에 readiness guard 포함:
    `8bbaffeaae93d9cc79b1258451c436b79346681e`.
- 첫 audit `37231601335`:
  - TypeScript/Build 및 diagnostic groups는 PASS였으나 verifier가 SQL 주석의 `UPDATE ... shared trigger name` 문구를 실제 DDL로 오인해 FAIL.
  - 제품/후보 구조 오류가 아니라 verifier regex false-positive로 판정하고 수정.
- 최종 rerun Release System Audit `37231798452`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - app336 R2 hybrid read regression PASS.
  - publication W2 readiness verifier PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight는 read-only PASS.
  - branch refs unchanged PASS.
- **공유 D1 migration은 실행하지 않음.**
  - D1 row/schema 실제 변경 0.
  - Worker 배포 0.
  - Firebase 배포 0.
  - Functions/Rules 변경 0.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 현재 차단 이유:
  - PREVIEW source에는 app336 `SORIDRAW_R2_HYBRID_READ_V1` compatibility가 존재하고 preview wrangler에서 활성.
  - 현재 `main` Worker source/config에는 hybrid-read marker/flag가 없음.
  - 구 TEST/PRODUCTION Worker는 legacy derived row + shared revision freshness에 아직 의존.
  - shared D1 trigger는 3환경 공용이므로 지금 derived media mirror를 제거하면 TEST/PRODUCTION에 stale 공개 media 위험.
- 결론:
  - **W3→W2 구현 후보 자체는 준비/정적감사 PASS**.
  - 그러나 안전 적용은 TEST/PRODUCTION도 hybrid-read authority를 지원한 이후에만 가능.
  - 이 차단을 우회해 PREVIEW 단독 shared-D1 migration을 적용하지 않는다.

## 0PI. 비용 최적화 우선순위 재확정 — D1 physical Rows Written 최우선 + Worker 매 테스트 계측 (2026-10-05 KST)

사용자 재지시:
- 행 읽기/쓰기가 비용에 직접 영향을 주므로 **특히 physical Rows Written을 최우선 절감 지표**로 사용.
- Cloudflare Worker 요청 수도 매 테스트마다 반드시 함께 확인.
- 비용 절감을 이유로 정상 기능을 제거/지연하지 않음.

현재 실기기 기준:
- registered public→private: Worker 1 / D1 R3 W2 / Firestore W0 = PASS.
- same-source private→public: Worker 1 / D1 R5 W2 / Firestore W0 = PASS.
- Suno source/media swap: Worker 1 / D1 R11 W3 / Firestore W0 = HARD FAIL.
- never-published first publication: Worker 1 / D1 R7 W12 / Firestore는 별도 동시 batch 분리 필요 = HARD FAIL.
- idle/revisit/page sync는 Worker 0 / D1 R0 W0 목표 유지.

매 작업 합격선:
1. **D1 physical Rows Written**
   - W0~W2만 PASS.
   - W3+는 HARD FAIL.
   - query-level W1만 보고 통과 금지. 반드시 request/physical rows written을 기준으로 판정.
2. D1 physical Rows Read
   - 전체 곡/사용자 수에 비례하는 scan 금지.
   - changed-item O(1) 우선.
3. Cloudflare Worker
   - 실제 mutation 1회당 Worker 1을 현재 정상 상한으로 추적.
   - 같은 action에서 Worker 2+가 나오면 fanout/중복 호출 감사.
   - 변경 없는 재진입/reload는 Worker 0 목표.
4. Firestore Browser SDK
   - publication hot path Firestore R0/W0 보호.
5. 기능 보호
   - app348/app349 PC↔모바일 즉시 저장하트 동기화 및 +30초 canonical W0/W1 변경 금지.
   - registered private/public W2 정상 경로 변경 금지.

현재 source-swap W3의 physical write map:
- canonical `tracks` media UPDATE = W1.
- `explore032_track_update` trigger → `explore_derived_tracks` mirror UPDATE = W1.
- `soridraw_shared_rev_tracks_au_051` trigger → shared revision UPDATE = W1.
- 합계 W3.
Worker는 mutation 1회에 요청 1회이며 현재 중복 Worker fanout은 실기기에서 보이지 않음.

## 0PH. app353 공개/비공개/source-swap 실기기 비용 분리 PASS/FAIL 확정 (2026-10-05 KST)

사용자 영상은 각 동작 사이 CACHE LIVE 초기화를 수행한 상태로 판정.

### 실측
1. **registered public → private**
   - Worker 1
   - D1 query R0 / W1
   - D1 physical/request rows **R3 / W2**
   - Browser SDK R0/W0
   - 판정: **PASS**. hard gate W1~W2 충족.
   - app335 과거 baseline R5/W2보다 read rows는 2 감소, write floor W2 동일.

2. **같은 source private → public 재공개**
   - Worker 1
   - D1 query R2 / W1
   - D1 physical/request rows **R5 / W2**
   - Browser SDK R0/W0
   - 판정: **PASS**. hard gate W1~W2 충족.
   - app334/app335 동일-source 재공개 목표 W2와 일치.

3. **공개 상태에서 Suno 1↔2 source/media 전환**
   - Worker 1
   - D1 query R3 / W1
   - D1 physical/request rows **R11 / W3**
   - Browser SDK R0/W0
   - 판정: **HARD FAIL**. app335 known source-swap baseline R11/W3와 동일, app353 신규 회귀는 아님.
   - 기존 read-only audit에서 W3 원인은:
     1) canonical tracks media UPDATE W1
     2) explore032_track_update → explore_derived_tracks W1
     3) soridraw_shared_rev_tracks_au_051 → explore_shared_revision W1
     = physical W3.

### 결론
- 비용 숫자가 매번 랜덤하게 달라지는 것이 아니라 **동작 종류가 달라서 경로가 다름**.
- private / same-source public은 W2로 현재 합격.
- source swap은 기능은 정상이나 W3라 비용 기준 FAIL.
- never-published 최초 공개는 별도 known baseline R7/W12로 여전히 HARD FAIL.
- 이번 registered 테스트 3개 모두 Firestore/Browser SDK W0이므로 직전 first-publication에서 보였던 `users:write 1`은 항상 publication mutation에 붙는 write가 아님. delayed users batch 등 동시 이벤트 가능성이 높으며 publication 공통 regression으로 보지 않음.
- 좋아요/저장하트 app348/app349 즉시 PC↔모바일 동기화는 보호 기준 그대로 동결. publication 비용 작업에서 변경 금지.

## 0PG. 좋아요 동기화 재확정 동결 + app353 공개/비공개 실기기 비용 확인 (2026-10-05 KST)

### 좋아요/저장하트 — 사용자 재확정 보호 기준
- 사용자 명시: **현재 PC↔모바일 즉시 좋아요/저장하트 동기화 동작을 그대로 유지. 비용 최적화를 이유로 기능을 임의 변경하지 말 것.**
- 과거 변경 원인 확인:
  - app302 제품 commit `24447627c2222d5cedc6fe96dcaccbfb26c0593a`에서 비용 절감을 위해 pre-canonical `publishMusicNoteHeartPreviewDelta` RTDB preview를 제거.
  - 당시 의도는 initiating device만 즉시 표시하고 상대 기기는 마지막 클릭 +30초 canonical 성공 뒤에만 반영하여 **pre-canonical RTDB write 0**을 만드는 것.
  - 이 변경 때문에 기존 사용자 요구였던 PC↔모바일 즉시 동기화가 지연되는 기능 회귀가 발생.
  - app348 제품 commit `441a256106d95427bfc5926f5a0c83d4bf4151d5`에서 RTDB changed-item preview를 복구하여 **상대 기기 즉시 반영 + canonical +30초 W0/W1**을 동시에 유지하도록 정상화.
- 현재 하드 보호:
  - same-device Recent heart + Music Note membership 즉시.
  - same-account other-device heart + membership 즉시.
  - 페이지/탭 이동/새로고침 불필요.
  - canonical favorite는 마지막 클릭 +30초 final-state: net-zero W0 / changed W1.
  - receiver Firestore/D1 추가 IO 0 목표.
  - **향후 비용 최적화가 이 visible behavior를 제거/지연하면 FAIL. 사용자 승인 없이는 변경 금지.**

### 공개 테스트 — never-published 최초 공개 1곡
사용자 CACHE LIVE 스크린샷:
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request rows: **R7 / W12**.
- Browser SDK: R0 / W1, source `users:write = 1`.
- PAGE SYNC: D1 R0/W0, Firestore R0/W0.
판정:
- D1 **R7/W12는 app335에서 이미 기록된 never-published 최초 공개 baseline과 동일**. 새 app353 회귀로 증가한 수치는 아님.
- 하지만 SORIDRAW hard gate W1~W2 기준에는 여전히 **HARD FAIL**이며, first-publication fanout 최적화 미완료 상태.
- Browser SDK `users:write 1`은 app335 문서의 publication Firestore W0 기대와 다름. 이 한 장만으로 publication 자체가 만든 write라고 단정하지 않고, 30/60초 delayed users batch 등 동시 write 가능성을 분리 실측해야 함.

### 바로 이어진 비공개 테스트
사용자 스크린샷:
- Browser SDK R0/W0.
- Cloudflare LOCAL 0 / Worker 0.
- D1 R0/W0.
- R2 Class A/B 0.
판정:
- Music Note/Explore publication UI는 app331/app346부터 **optimistic local-first**라 화면에서는 서버 응답 전 즉시 private로 보일 수 있음.
- 현재 실제 서비스 코드는 `setExploreTrackVisibility() -> flushPendingExplorePublicationsForPageExit() -> /v1/me/music-note-publications/batch`를 호출하므로, **서버까지 확정된 registered public→private mutation이라면 Worker/D1 mutation이 존재해야 함**.
- 기존 app335 실측 baseline은 동일 source public→private **D1 R5/W2 / Firestore W0**.
- 따라서 이번 R0/W0/Worker0 캡처는 성공 settlement 완료 후 수치인지, optimistic 화면 직후 수치인지 추가 1회 격리 확인 필요. 완료 PASS로 오판하지 않음.

### 다음 공개 비용 확인
1. 같은 registered 곡을 public 상태로 만든 뒤 CACHE LIVE 초기화.
2. private 클릭 후 성공 토스트까지 기다리고 2~3초 뒤 캡처.
   - 기대 baseline: Worker 1 / D1 W2 / Firestore W0.
3. 다시 같은 source로 public.
   - registered 재공개 기대: Worker 1 / D1 W2 / Firestore W0.
   - W12가 다시 나오면 first-publication 오분기 회귀.
4. 이 두 동작에서도 `users:write 1`이 반복되면 publication 경로의 새 Firestore write regression으로 분리 감사.
5. 새 never-published 곡 최초 공개 W12는 이미 known HARD FAIL이므로 별도 저비용 구조 작업 대상.

## 0PF. app353 PC Music Note 썸네일 실기기 PASS / 보호 기준 동결 (2026-10-05 KST)

- 사용자 실기기 확인: **"일단 수정은 됐어."**
- 따라서 app353에서 확인한 PC Music Note 썸네일 문제는 실사용 기준 PASS 처리.
- 확정 보호 범위:
  - Detail에서 확인된 Suno media가 Music Note 목록에 반영되는 경로.
  - Explore 이동 후 Music Note 재진입 시 stale V4 Catalog가 썸네일을 다시 지우지 않는 media overlay 우선순위.
  - `firestoreId || id` canonical document identity 기준의 local row/cache writeback.
  - app349 heart/Music Note membership 즉시 동기화 및 마지막 클릭 +30초 canonical settlement.
- 현재 PREVIEW Hosting: app **353**.
- Firebase PREVIEW App Release Run: `37228706933` SUCCESS / exact build PASS.
- Release System Audit: `37228542810` SUCCESS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향: 추가 Firestore/D1/R2/RTDB read/write 0.
- 다음 큰 작업은 썸네일 경로를 더 건드리지 않고 follow 저비용 Worker 독립 감사로 복귀.
- 썸네일 관련 새 수정은 별도의 실사용 회귀가 확인된 경우에만 진행.

## 0PE. app353 PC Music Note 썸네일 우선순위/Catalog 재진입 원인 확정 + PREVIEW 배포 (2026-10-05 KST)

- 사용자 app352 실기기 영상 결과:
  - Music Note 목록 최초 상태는 `빛속의 오답`, `무거운 발걸음` 모두 음표 placeholder.
  - 같은 PC에서 Detail & Edit를 열면 해당 곡의 Suno URL 1/2 + cover image가 정상 존재.
  - Detail을 연 직후 목록 thumbnail은 정상 표시됨.
  - Explore로 이동했다가 Music Note로 돌아오면 다시 placeholder로 사라짐.
- **정확한 원인 / 우선순위**
  - 맞음. 목록의 임시 media patch보다 **V4 full Music Note Catalog가 상위 authority**였음.
  - Detail open의 `syncFavoriteSunoCardMedia()`는 `favoritesStore` + 일반 favorites localStorage만 갱신했지만, Music Note 재진입 시 `subscribeListBundle -> readPreviewAdaptiveListIndexV2 -> readCatalogSnapshotCacheFirst`가 full Catalog를 다시 전달함.
  - App의 full Catalog `onData`는 schema 1001 Catalog를 authoritative row로 채택하므로, media-only 변경이 dedicated Catalog overlay에 남지 않은 PC에서는 thumbnail이 다시 지워졌음.
  - 즉 이미지 렌더 실패/다운로드 실패가 아니라 **Detail media → 임시 list state → Catalog authority 재적용** 순서의 우선순위 오류였음.
- 추가로 확인된 canonical-id 원인:
  - 일부 legacy/Catalog row는 내부 `id`와 실제 Music Note 문서 `firestoreId`가 다를 수 있음.
  - `App.updateFavorite`, 즉시 cache patch 일부가 `item.id === documentId`만 사용해 실제 canonical row를 놓칠 수 있었음.
  - 이 경우 Firestore Detail 저장은 성공해도 local list row / Catalog delta source가 갱신되지 않아 stale Catalog가 계속 남을 수 있었음.
- app353 수정:
  - `src/pages/FavoritesPage.tsx`
    - Detail에서 이미 확인된 exact Suno media와 새 URL 저장 결과를 **기존 bounded Music Note media overlay**에 즉시 기록.
    - stale Catalog가 다시 와도 overlay가 해당 media만 위에 유지.
    - 서버 read/write 추가 없음.
  - `src/App.tsx`
    - `updateFavorite`, immediate cache patch, local row update/remove를 `firestoreId || id` canonical document identity 기준으로 통일.
    - Detail media 저장이 실제 list row와 이후 Catalog delta source에도 반영될 수 있게 수정.
  - generic `updatedAt`를 억지로 올려 우선순위를 속이는 방식, 전체 Music Note 재조회, cache reset은 사용하지 않음.
- commits:
  - Detail/save media durable overlay: `7c0d3cc83bab747ff202d801ab648c5ff14eeaa1`.
  - canonical App local writeback: `b39e7f052ea92034bbf685aa822de8115fad89e6`.
  - app353 version: `921ee914ce51a025325504623c59994ef595b702`.
- Release System Audit Run `37228542810`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups A~D / syntax / final guards / regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 preflight 및 진단은 read-only PASS.
- Firebase PREVIEW App Release Run `37228706933`: **SUCCESS**.
  - release trigger: `0b71f526c214733bc016b09b672b2216b9f40322`.
  - PREVIEW Hosting app **353** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy 요청 없음.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 추가 Firestore read/write 0.
  - 추가 D1/R2 read/write 0.
  - 추가 RTDB read/write 0.
  - 기존 exact Detail data와 기존 local overlay/cache만 사용.
- 실기기 다음 확인:
  1. PC app353 로드.
  2. 과거 overlay가 없던 기존 곡은 Detail을 **한 번 열었다 닫아** 정확한 media를 로컬 overlay에 심은 뒤 확인.
  3. Explore 이동 → Music Note 복귀 후 thumbnail 유지.
  4. 새로고침 후 유지.
  5. 브라우저 완전 종료/재실행 후 유지.
  6. app353 이후 새 Suno URL/media 저장은 저장 순간 overlay가 같이 생성되므로 다음 재진입부터 별도 Detail 재오픈 없이 유지되어야 함.
- 보호:
  - 정상 모바일 경로, app349 하트/Music Note membership 즉시 동기화, 마지막 클릭 +30초 canonical settlement는 변경하지 않음.
  - 전체 Music Note reread/cache reset 금지 유지.

## 0PD. app352 PC Music Note 목록 썸네일 canonical-ID 매칭 수정 PREVIEW 배포 (2026-10-05 KST)

- 사용자 app351 실기기 결과:
  - PC Music Note 목록: 여전히 음표 placeholder 표시 FAIL.
  - 같은 PC에서 Detail & Edit를 열면 동일 곡의 Suno URL 1/2와 cover image가 정상 표시.
  - 즉 **미디어 데이터 자체는 PC에 존재하지만 목록 summary row와 Detail row의 식별자 매칭이 실패**한 증상으로 좁혀짐.
- 확인된 코드 원인:
  - Music Note canonical document id는 `firestoreId` 우선인데, 일부 media list/cache 경로가 `id || firestoreId` 순서로 비교.
  - PC Catalog row에서 `id`와 `firestoreId`가 다를 수 있는 경우, Detail hydration은 `firestoreId`로 정상 문서를 열지만 목록 media patch/overlay는 다른 `id`를 보고 건너뜀.
  - 그래서 Detail에는 cover가 보이지만 배경 목록은 계속 placeholder였음.
- app352 수정:
  - `src/pages/FavoritesPage.tsx`
    - Suno card media patch 대상을 `getFavoriteDocumentId(song)` 기준으로 통일.
    - Detail flush 후 latest row lookup, RTDB media preview source lookup, durable draft lookup도 canonical favorite document id 기준으로 통일.
  - `src/lib/userDataEngine.ts`
    - Music Note media overlay key/match에서 `firestoreId || id` 우선으로 통일.
  - 전체 Catalog id 구조/사용자 데이터는 변경하지 않고, media overlay/card patch의 식별자 비교만 최소 수정.
- commits:
  - FavoritesPage canonical id fix: `86144a3bde69f437edd0e42f2f7fbd12e5510b5c`.
  - userDataEngine overlay id fix: `51b23dc5440c46e278f76f03a773782d7ce71b42`.
  - app352 version: `91cd69db0fd7a30ac6d82741cee711493dd3ad11`.
- Release System Audit Run `37227306745`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups, existing regression, TEST/PRODUCTION Worker dry-run, shared D1 read-only checks PASS.
- Firebase PREVIEW App Release Run `37227428264`: **SUCCESS**.
  - release trigger commit: `d0c5546a200ec7e05d3c767e3fbb645b1acfbbdc`.
  - PREVIEW Hosting app **352** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 추가 Firestore/D1/R2/RTDB read/write 0.
  - 기존 local card media patch와 device-local overlay가 정확한 문서 id를 찾도록 수정한 것뿐.
- 실기기 확인:
  1. PC app352 새로고침.
  2. 현재 스크린샷의 `빛속의 오답`, `무거운 발걸음`처럼 Detail에서 cover가 이미 보이는 곡의 목록 썸네일 확인.
  3. 목록에 cover가 보이면 PC 새로고침 → 브라우저 완전 종료/재실행 후도 유지 확인.
  4. 하트/Music Note membership +30초 canonical behavior는 변경 금지/비변경.

## 0PC. app351 PC Music Note Suno 썸네일 재실행 지속성 보강 PREVIEW 배포 (2026-10-05 KST)

- 사용자 app349 실기기 결과:
  - 모바일: 새로고침/앱 재실행 후에도 Music Note 목록 썸네일 유지 PASS.
  - PC: 새로고침/재실행 뒤 썸네일이 다시 사라지는 잔여 오류 확인.
- 원인:
  - Suno media RTDB changed-item preview는 PC 화면/일반 favorites cache까지는 도착했지만, 수신 PC에는 편집 기기의 Detail draft가 없음.
  - 이후 PC가 서버 Catalog를 다시 적용하면 아직 media를 포함하지 않은 Catalog가 수신 캐시를 덮을 수 있었음.
  - source 모바일은 자기 Detail draft가 다시 media를 덮어주므로 증상이 보이지 않았음.
- 수정:
  - `src/lib/userDataEngine.ts`: UID + favorite-id별 bounded device-local Music Note media overlay 추가. Suno/card media 필드만 저장.
  - `src/services/userDomainSyncService.ts`: 기존 RTDB signal 수신 시 화면 event 전에 media overlay를 로컬 저장.
  - overlay는 Firestore/D1/RTDB write intent가 아니며 서버 write를 추가하지 않음.
  - 서버 Catalog가 아직 media를 반영하지 못해도 PC 새로고침/재실행 때 overlay를 다시 적용.
  - app351 보강: 현재 화면/로컬 Catalog가 overlay와 같다는 이유만으로 overlay를 지우지 않음. **더 최신 canonical media version**이 들어올 때만 오래된 overlay를 폐기하여 반복 stale Catalog GET에서도 썸네일 재소실 방지.
  - bounded max 256 changed media items; 전체 Music Note reread/cache reset 없음.
- 제품 commits:
  - app350 기반: `30b9fc809f59f20707e5e479c891aee424bfdd4f`, `e8d6ac90f22a92c730e8b9f8b285b46433dc671a`.
  - app351 stale-Catalog guard: `46079ef2d7aa29e9b4967d689fbf817d4f3e70d9`.
  - app351 version: `357b0ed91504de646c0132ce6e4a469e97b4d284`.
- Release System Audit Run `37226502953`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups A~D, syntax/guards, TEST/PRODUCTION Worker dry-run, shared D1 read-only preflight PASS.
- Firebase PREVIEW App Release Run `37226652526`: **SUCCESS**.
  - release trigger: `6949fc69d36b5cdfa66d6b18b993ca3012143757`.
  - PREVIEW Hosting app **351** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules 변경 요청 없음.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 수신기 추가 Firestore read/write 0.
  - D1 read/write 0.
  - 추가 RTDB write 0; 이미 존재하는 changed-item signal을 수신해 기기 localStorage/Catalog cache만 보강.
  - 앱 진입/재실행 때문에 사용자 데이터 서버 write를 만들지 않음.
- 실기기 최종 확인 필요:
  1. app351을 PC/모바일 모두 로드.
  2. **새 테스트 곡 또는 Suno URL을 한 번 새로 저장/수정해 새 media signal을 만든 뒤** PC 목록에 썸네일 즉시 표시 확인.
  3. PC 새로고침 → 썸네일 유지.
  4. PC 브라우저 완전 종료/재실행 → 썸네일 유지.
  5. 같은 과정에서 하트/Music Note membership +30초 canonical 동작은 app349 기준 그대로 유지.
- 참고: 이미 app349에서 PC 로컬 media가 사라진 과거 곡은 새 signal이 전혀 없으면 기기에 복구할 원본이 없으므로, 전체 서버 재조회 없이 과거 상태를 억지 복원하지 않음. 실기기 검증은 새 media signal로 확인한다.
- PREVIEW live Worker는 계속 Worker341 rollback본 유지. follow cutover OFF. follow 저비용 candidate는 이 실기기 확인과 별도 작업.

## 0PB. app349 Studio 저장하트 settlement / Music Note 즉시 membership / Suno 목록 미디어 안정화 PREVIEW 배포 + 기준 동결 (2026-10-05 KST)

- branch: `preview`.
- 제품 commit: `53646fce918060f5bcb376af9a31a5e0acd05e6c`.
- focused implementation/verification Run `37224717803`: **SUCCESS**.
  - +30초 canonical settlement 시 저장된 Music Note row가 순간 사라지지 않는 회귀검사 PASS.
  - 상대 기기 RTDB preview 수신 즉시 Music Note membership/cache 반영 PASS.
  - Suno URL/thumbnail/list media 로컬 캐시 지속성 PASS.
  - media-specific revision이 generic favorite updatedAt에 잘못 밀리지 않는 보호 PASS.
  - 추가 Firestore/D1 IO 정적 목표 0.
  - 보호 회귀(app302/app347/app289/app031/app032/app291), TypeScript, Build PASS.
- Release System Audit Run `37224853496`: **SUCCESS**.
- Firebase PREVIEW App Release Run `37224986893`: **SUCCESS**.
  - app version **349** / exact PREVIEW build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 현재 보호 기준: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`.
- app349 visible contract:
  - 같은 기기 Recent 하트 + Music Note membership 즉시.
  - 같은 계정 다른 기기 Recent 하트 + Music Note membership 즉시.
  - canonical favorite는 곡별 마지막 클릭 +30초 final-state W0/W1 계약 유지.
  - settlement 순간 저장 row가 사라졌다가 재등장하는 전환 금지.
  - Detail에 저장된 Suno media/thumbnail이 목록/재실행에서 사라지는 회귀 금지.
- 남은 실기기 최종 확인:
  1. PC → 모바일 save/unsave 즉시 반영.
  2. 모바일 → PC save/unsave 즉시 반영.
  3. 마지막 클릭 +30초 뒤 양쪽 하트 + Music Note membership이 그대로 유지.
  4. Detail Suno URL/media가 Music Note 목록 thumbnail/media에 즉시 보이고 새로고침/재실행 후 유지.
- 별도 다음 백엔드 작업: PREVIEW live Worker는 계속 Worker341 rollback본 유지, follow cutover OFF. 저비용 follow candidate는 legacy Worker341 parity + 실제 D1/R2 비용 독립 검증 전 재배포 금지.

## 0PA. app348 Studio 저장하트 즉시 PC↔모바일 동기화 복구 + Skill 재동결 (2026-10-05 KST)

- 사용자 명시 기준으로 app302에서 제거됐던 pre-canonical Studio-heart cross-device preview를 복구.
- **현재 보호 동작**
  - 같은 기기: Recent 하트 즉시 + Music Note membership 즉시.
  - 같은 계정 다른 기기: RTDB changed-item preview로 하트 + Music Note membership 즉시.
  - 페이지 이동 / 탭 이동 / 새로고침 불필요.
  - canonical Firestore favorite: 곡별 마지막 클릭 +30초 뒤 최종 상태만 저장.
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
  - 다른 곡은 독립 30초 timer.
- app347 stale-overwrite / media 보호 유지:
  - remote preview는 non-canonical overlay로 분리.
  - generic favorites updater 전 local pending + remote preview layer를 canonical input에서 제거.
  - canonical save/unsave가 오면 matching preview layer 정리.
  - 최신 Detail/Suno media가 오래된 heart-click snapshot에 덮이지 않음.
- RTDB preview payload:
  - bounded Music Note summary를 사용하며 thumbnail/cover/Suno media 필드를 포함.
  - receiver Firestore R0/W0, D1 R0/W0 정적 guard.
  - preview는 canonical Music Note catalog/document version을 올리지 않음.
- 제품 commit: `441a256106d95427bfc5926f5a0c83d4bf4151d5`.
- focused apply/verify Run `37222138737`: **SUCCESS**.
  - immediate PC/mobile preview PASS.
  - canonical 30s final-state PASS.
  - remote Music Note no-Firestore-IO PASS.
  - app347 stale-overwrite guard PASS.
  - TypeScript PASS / Build PASS.
- Release System Audit Run `37222258188`: **SUCCESS**.
- Firebase PREVIEW App Release Run `37222387192`: **SUCCESS**.
  - locked release commit: `da1be338d2007e287c33400b5e9e5d78719e68f6`.
  - `preview.soridraw.com` app **348** exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- Skill / guardrail 갱신:
  - 신규 기준: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app348-studio-heart-immediate-cross-device-baseline.md`.
  - `song-save-edit-sync-cost/SKILL.md`, `local-first-like-sync/SKILL.md`, `AGENTS.md`를 app348 즉시 동기화 기준으로 갱신.
  - app302 delayed-remote 기준은 historical/superseded로 명시.
  - 향후 비용 최적화를 이유로 cross-device 즉시 동기화를 사용자 승인 없이 제거/지연 금지.
- 남은 실기기 최종 확인:
  1. PC → 모바일 save/unsave 즉시 반영.
  2. 모바일 → PC save/unsave 즉시 반영.
  3. 30초 canonical settlement 뒤 양쪽 상태 유지.
  4. Detail/Suno media가 Music Note 목록 thumbnail에서 사라지지 않음.
- 팔로우 저비용 Worker candidate/cutover는 별도 작업이며 현재 Worker341 유지.

## 0P9. app347 Studio 저장하트 / Music Note canonical 재정합 복구 (2026-10-05 KST)

- 사용자 실기기에서 app346 이후 별도 신규 오류 확인:
  - 같은 계정인데 PC / 모바일의 Recent 저장하트 상태가 서로 다름.
  - PC의 하트 표시와 실제 Music Note 목록 membership도 불일치.
  - 방금 저장한 곡에서 Detail에 Suno URL/두 곡 정보가 보이는데 Music Note 목록 썸네일/미디어가 비어 보이는 사례.
- app302/app302b 동결 스킬 기준으로 재감사한 결과, app346 follow UX 작업 자체가 Music Note 저장 경로를 수정한 것은 아님.
- 확인된 구조적 취약점:
  1. Studio-heart pending optimistic layer가 canonical/changed-item row와 같은 곡을 덮을 때, 하트 클릭 시점의 오래된 `intent.song` snapshot이 더 최신인 list/media row를 다시 가릴 수 있었음.
  2. PC/모바일 중 한 기기의 canonical save/unsave가 이미 로컬 pending의 원하는 최종 상태를 달성했어도, 해당 pending intent를 정리하지 않아 optimistic membership이 canonical 상태 위에 계속 남을 수 있었음.
  3. 이 조합이 하트↔Music Note membership 불일치와 Detail media↔목록 thumbnail 불일치를 동시에 만들 수 있음.
- app347 수정:
  - pending layer는 이제 **membership만 제어**. 같은 document의 더 최신 canonical/local row가 있으면 title/media/thumbnail/Suno fields는 그 최신 row를 보존.
  - canonical `save/restore/shared-note-save/unsave/remove` signal이 로컬 pending과 같은 document ID 또는 같은 stable song identity이고 최종 saved 상태도 같으면 해당 pending intent를 즉시 제거.
  - Detail/Suno preview signal은 canonical settlement로 취급하지 않음.
  - 추가 Firestore/D1/Worker read/write 0. shared RTDB schema/rules 변경 없음.
- product commit: `976037b932b6ee1606206939494b5a660cd5659c`.
- focused Apply/Verify Run `37219963501`: **SUCCESS**.
  - app347 focused regression PASS.
  - app302 protected regression PASS.
  - app289 compact heart sync PASS.
  - app291 Recent lyrics live-preview PASS.
  - TypeScript PASS / Build PASS.
  - 기존 verify-290은 pre-app302 heart-preview 송신을 요구하는 stale historical assertion이라 app302 현재 계약의 release gate로 사용하지 않음.
- Release System Audit Run `37220098629`: **SUCCESS**.
- Firebase PREVIEW Hosting Run `37220292148`: **SUCCESS**.
  - locked release commit: `a8894bdd3826116e5efde992e176403652db1e30`.
  - remote `preview.soridraw.com` app version **347** / exact build PASS.
  - shared RTDB Rules SKIPPED.
  - TEST / PRODUCTION unchanged PASS.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- PREVIEW Worker는 계속 rollback된 Worker341 유지. follow low-cost candidate/cutover와 이번 Music Note 복구는 분리.
- **실사용 검증 필요**:
  1. PC와 모바일을 둘 다 app347로 새로고침.
  2. 같은 A곡 저장/해제를 한 방향에서 실행하고 30초 canonical settlement 뒤 상대 기기가 새로고침/탭 이동 없이 같은 하트 + 같은 Music Note membership으로 수렴하는지.
  3. 반대 방향도 동일 확인.
  4. 저장 직후 Detail에서 Suno URL/두 곡 media를 넣은 경우 목록 thumbnail/media가 pending layer 때문에 사라지지 않는지.
  5. 이미 app346에서 꼬여 있던 A/B가 최신 canonical signal replay만으로 모두 정리되는지는 실기기 확인 전. 남으면 전체 스캔 없이 해당 곡만 bounded recovery 설계.

## 0P8. app346 immediate social UX PREVIEW 배포 + mandatory follow gate PASS (2026-10-05 KST)

- branch: `preview`.
- 현재 PREVIEW Hosting: **app346**.
  - 제품 UX commit: `faf0b69faf017603311e92cd645a76c6b0034743`.
  - Worker341 legacy parity candidate commit: `e312cfdea8b4c047aa8309506e8ebc78d9ed1bf2`.
  - app version commit: `85e6c0dbc2f62e01ecb6499eb2e2a7193e339a77`.
  - mandatory full follow gate source: `b711f1dba68aed2b97df92636c40d22bc7577767`.
- Release System Audit Run `37217745269`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - follow 347~355 chain + 356 Worker341 legacy parity PASS.
  - app356 immediate follow/publication rollback + server cost calls unchanged PASS.
  - 이전 diagnostic-only false-green 위험을 막기 위해 verify-347에서 348 전체 체인을 mandatory import하도록 변경했고, 의도적으로 Worker341로 되돌린 legacy 함수/347 sync 제거를 verify-354가 명시적으로 허용하도록 정리함.
- Firebase PREVIEW Hosting Run `37217908194`: **SUCCESS**.
  - release trigger commit: `93c5826a126bc61c61daf14cb61b404a9b305cd6`.
  - remote `preview.soridraw.com` app version **346** / exact build PASS.
  - TEST / PRODUCTION code+HTML unchanged PASS.
  - shared RTDB rules deploy SKIPPED, Functions unchanged.
- UX 변경:
  - Explore 공개프로필 follow/unfollow는 클릭 즉시 버튼/카운트/Following 로컬 목록에 반영하고 서버는 뒤에서 settle.
  - 실패 시 직전 follow 상태와 카운트를 정확 rollback + 기존 오류 notice.
  - Explore publication settings save/private도 가능한 화면 상태는 즉시 반영하고 실패 시 exact rollback.
  - Music Note app330/331 publication path는 변경하지 않음.
  - focused verifier 기준 추가 backend call/read/write **0**.
- **PREVIEW Worker는 배포하지 않음.** 현재 active Worker는 rollback된 Worker341 코드 source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`, version `35a0bb0a-f547-4f4a-84ab-d55ba075ba13` 유지.
- shared follow cutover OFF. `explore_follow_overrides_348` migration/backfill/cutover 실행 0. 사용자 데이터 write/delete/migration 0.
- 다음 gate:
  1. 사용자 PREVIEW PC/mobile에서 5~7초 체감 대기가 사라지고 즉시 follow/public-private 화면 반응이 보이는지 실사용 확인.
  2. candidate Worker 재배포 전 Astra 독립 재감사 + Worker341 대비 legacy physical D1/R2 parity 근거 확보.
  3. 그 전까지 candidate Worker deploy, shared cutover, main/TEST/PRODUCTION 승격 금지.

## 0P7. Worker341 rollback 실사용 확인 + 5~7초 UX 지연 확인 (2026-10-05 KST)

- 사용자 동일 조건 재측정으로 rollback 정상 확인:
  - follow sample 1: D1 query R0/W3, physical Rows Read18 / Rows Written14.
  - follow sample 2: D1 query R0/W3, physical Rows Read19 / Rows Written17.
- 이는 기존 문서화된 legacy baseline R18~19 / W14~17과 일치한다. candidate355 배포 때 관찰된 R23/W14 증가는 rollback으로 제거됨.
- 따라서 현재 PREVIEW Worker는 비용 관점에서 **예전 기준으로 복구**됐지만, 그 예전 기준 자체가 최종 합격선은 아니다. 목표는 여전히 overlay authority에서 physical W1~W2.
- 사용자 추가 확인: 팔로우 및 공개/비공개 액션에서 클릭 후 화면 확정까지 약 **5~7초 로딩 체감**.
- 코드 확인:
  - Explore 공개프로필 `toggleFollow`은 서버 `setExploreFollow` 응답을 await한 뒤에 버튼/카운트를 바꾸므로 Worker 지연이 그대로 UI 로딩으로 노출됨.
  - Explore 공개프로필의 publication settings private/save 경로도 서버 settlement를 기다리는 경로가 있어 같은 체감 지연 가능.
  - Music Note의 app330/331 publication path는 이미 local-first optimistic이므로 그 정상 동작은 보호.
- 합격 UX: 사용자 클릭 즉시 로컬 상태 반영, 서버는 뒤에서 settle, 실패 시 정확 rollback. 비용을 숨기기 위한 가짜 성공이 아니라 server failure/ordering 보호 유지.
- 이 UX 수정은 follow low-cost backend 구조와 분리해 검증하며, 좋아요/UI 레이아웃/색상은 변경하지 않는다.

## 0P6. app345 live follow cost regression — PREVIEW Worker rolled back to Worker341 code (2026-10-05 KST)

- User real-device CACHE LIVE after candidate355 compatibility deploy showed legacy follow physical amplification still high and one direction worse than prior baseline:
  - sample A: D1 query R0/W2, physical Rows Read23 / Rows Written14.
  - sample B: D1 query R0/W2, physical Rows Read17 / Rows Written17.
- Prior documented legacy baseline was roughly physical R18~19 / W14~17. Therefore compatibility deployment did **not** satisfy “legacy behavior/cost unchanged”; low-cost overlay was not active.
- Root cause confirmed in deployed source comparison:
  - Worker341 legacy path used original 246 three-query counter mutation.
  - candidate355 legacy branch also carried undeployed `SORIDRAW_FOLLOW_COMBINED_COUNTERS_345` W2 counter compaction + `syncExactSharedFollowing347` compatibility work.
  - `readFollowCutoverState348` correctly left overlay OFF, so user was measuring this altered legacy path, not the W1~W2 overlay.
- Safety action: PREVIEW Worker rolled back to exact Worker341 product source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`.
- Rollback Run `37214678869`: **SUCCESS**.
  - canonical SHA256 `627c86f5499f754169ae43dec9062a621d94bd549e2c9c5fb2c48c75d8f07bbb`
  - active PREVIEW Worker version after rollback: `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`
  - feed/profile smoke PASS; warm revision D1 R0/W0 PASS; TEST/PRODUCTION Workers unchanged PASS.
- Hosting remains app345 for now. The app345 client compatibility/cache fix is backward-compatible with Worker341 and is not the source of physical D1 row amplification observed in the Worker mutation.
- Shared follow cutover remains OFF; no migration/backfill/user-data mutation.
- Next release blocker: candidate Worker must preserve the Worker341 legacy mutation path byte/behavior-equivalently while keeping overlay readers/writers dormant behind the cutover manifest. Re-audit + PREVIEW live cost comparison required before redeploying candidate Worker.

## 0P5. PREVIEW app345 + candidate355 compatibility Worker deployed — cutover OFF (2026-10-05 KST)

- User approved PREVIEW deployment after Astra independent audit PASS.
- Branch release sequence:
  - app version bump: `736645d999edc09518a88dca8d7564ede9929819`
  - Worker release trigger: `c968035c74975b69dd00252b6bc6b1caa8f5e051`
  - Hosting release trigger / deployed source HEAD: `051247aad2b8127aae01475880c549caceb37968`
- Cloudflare PREVIEW Worker Run `37213658493`: **SUCCESS**.
  - canonical Worker SHA256 `ff824b1818ef00b685ceb8ccfcdb1db876ca1d780970fc828f4b2bd41d62dd01`
  - active PREVIEW Worker version `2e544865-0392-4dbe-8cc0-28e1b8a01fb6`
  - feed smoke PASS / profile smoke PASS / warm revision D1 R0 W0 PASS.
  - TEST/PRODUCTION Workers unchanged PASS.
  - D1 schema migration 0. No follow schema/cutover activation.
- Firebase PREVIEW Hosting Run `37213744061`: **SUCCESS**.
  - TypeScript PASS / Build PASS / Firebase PREVIEW deploy PASS.
  - remote app version **345** / exact build PASS.
  - shared RTDB rules SKIPPED.
  - TEST/PRODUCTION unchanged PASS.
- Shared follow cutover manifest remains unarmed/absent by this release path; candidate355 code is deployed in compatibility/legacy mode only.
- Firebase Functions unchanged. Shared/user data migration/backfill/delete 0.
- Existing like/public-private/search/creator/UI protected paths were not intentionally changed.
- Two unrelated `diagnose-069-live-like.yml` push runs were reported as failure with zero jobs on the release-trigger commits; they were not part of either successful deploy workflow and were not modified in this release. Track separately; do not treat them as candidate355 validation.
- **Next gate:** PREVIEW real-device PC/mobile + actual Worker/R2 behavior/cost. No TEST/main or PRODUCTION promotion until live verification passes.

## 0P4. candidate355 Astra 재감사 PASS — 코드 감사 완료, PREVIEW 배포 전 (2026-10-05 KST)

- Branch/code: `preview` / `f8e2d1830f237a94abd064795c5be325171746ff`.
- 독립 Astra 재감사: **PASS**.
- 마지막 남은 legacy schema2 5,000-cap cache 문제는 해결 확인:
  - 누락 target은 false로 확정하지 않고 targeted `follow-state` recovery.
  - 정상 complete cache는 서버 read 0 유지.
  - explicit false 항목은 cap 계산에 포함되지 않음.
  - recovery 실패 시 false negative 저장 없음.
  - cache/version reset 없음.
- 따라서 candidate355의 코드 감사 단계는 통과.
- 실제 서비스는 여전히 app344 / PREVIEW Worker341. 아직 배포 없음.
- shared migration/cutover manifest 활성화, 사용자 데이터 변경, main/TEST/PRODUCTION 변경 없음.
- 다음 단계는 **PREVIEW 코드-only 호환층 배포** 후 legacy mode 비변경 확인. shared schema/cutover는 계속 금지.
- PREVIEW 배포 후 실제 PC/모바일, Worker/R2 요청·비용, no-op/복구 실측을 진행해야 하며, 그 결과 전까지 TEST/PRODUCTION 승격 금지.

## 0P3. candidate355 legacy schema2 follow cache blocker repaired — independent re-audit pending (2026-10-05 KST)

- Branch/base: preview / a6a3053d440245cd91f9f71a6c45c0a153d81800. Scope is only the remaining capped schema2 follow-cache blocker; Worker code and protected features are unchanged.
- Existing cache with 5,000 or more true memberships is conservatively incomplete even if its old complete flag is true. Known true/false states are preserved. Schema2, cache keys and cache contents are not reset or globally invalidated.
- An unknown target in an existing nonempty incomplete cache goes directly to the single-target follow-state endpoint, bypassing list/snapshot hydration. Successful recovery remembers only that target while keeping the cache incomplete. Failure rejects without storing a false negative.
- Healthy complete caches below the membership cap retain positive/absent-target server reads0 and local writes0. Known targets in capped caches also retain reads0. True-membership counting excludes explicit negative entries.
- Regression is integrated into verify355: persisted legacy schema2 capped cache, known positive/negative, missing positive/negative, repeat reads0, failed lookup/retry, healthy complete cache with many explicit negatives, and current partial-cache recovery.
- TypeScript PASS; Build PASS (existing dynamic-import/chunk-size warnings; output isolated under ignored node_modules, tracked dist unchanged). Verify347/348/349(includes353)/350/351/352/354/355 PASS, including the new legacy-cache regression. No remote billing rerun: Worker/SQL unchanged; local HTTP conditional fixtures retain prior cost samples. Real PC/mobile and live billing are unverified in this client-only task.
- No deployment, Firebase/Functions/Cloudflare resource change, shared migration, manifest activation, shared/user data write or main/TEST/PRODUCTION change. Live baseline remains app344 / PREVIEW Worker341. No new branch/workflow. Independent Astra re-audit and later live-device/release gates remain pending; RELEASE BLOCKED.

## 0P2. candidate355 Astra 재감사 FAIL — legacy schema2 follow cache 1건 잔존 (2026-10-05 KST)

- 감사 기준: `preview` / `46d21590ceea908353cec2e2a4235e8348404c20`; 실제 코드 `634589b2af0aa8041fe394402aa6f3a7a7abdc99`.
- 독립 재감사 판정: **FAIL 1건**. 이전 8건 중 7건은 재감사에서 추가 차단점이 확인되지 않았고, 기존 4번의 pre-cutover cache 사례가 남음.
- 남은 문제: `src/services/exploreSocialService.ts`의 `normalizeExploreFollowCache` / `readCachedExploreFollowState` / `loadExploreFollowingBundle`이 과거 schema2 캐시의 `complete:true`를 신뢰함. 예전 5,000 cap 캐시에 빠진 target도 서버 확인 없이 `false`로 확정 가능.
- 재현: 누락 target -> false, server/social snapshot/follow-state 확인 0회.
- 최소 수정 원칙: 전체 캐시 초기화 금지. 기존 제한 캐시를 불완전으로 판별하고, 불완전 cache miss는 개별 `follow-state` 확인으로 복구. 새 서버 completeness/truncated metadata를 존중하며 정상 complete cache fast-path는 유지.
- Run `37210263354`는 지정 코드와 일치하지만 이 legacy cache fixture는 검증에서 빠졌으므로 candidate355 release gate는 아직 FAIL.
- 실제 서비스는 app344 / PREVIEW Worker341 유지. 배포/shared migration/cutover/main/TEST/PRODUCTION/user data 변경 금지.

합격 조건:
1. legacy schema2 capped cache fixture에서 누락 target이 false로 확정되지 않고 targeted follow-state recovery.
2. 정상 complete cache hit은 서버 read 0 유지.
3. new incomplete/truncated cache도 targeted recovery 유지.
4. TypeScript/Build + 관련 follow verifier + 새 legacy-cache regression PASS.
5. Astra 재감사 PASS 전 PREVIEW 배포 금지.

## 0P1. protocol354 audit repairs355 — implementation candidate, deployment blocked (2026-10-04 KST)

- Branch/base: preview / 57acc664f59d9e3c4c110f5a2b6797525dce010e. Fixes the eight independent audit failures at c47f6c6d. Current service remains app344 / PREVIEW Worker341.
- Shared profile patch/mirror writers use a fresh conditional merge in overlay mode, preserving current follower/following counts and followSync354 pending/exact/order records. Missing shared profiles fail closed rather than importing frozen legacy counters.
- Overlay public profile, connection, first-view and permission readers repair pending work or fail closed. First-view validates shared R2 revision before returning a cached response/304; mutation and request-driven recovery invalidate UID + actual handle keys. Legacy follow writer/client branches remain unchanged.
- Social snapshot and following-bundle use effective overlay pages with completeness/truncation/cursor metadata. Client absence on an incomplete list uses a targeted state lookup. Existing cache schema/like behavior/UI are preserved; no app-version cache reset.
- Certified same-state/new-ID requests persist only the pair ordering receipt (one R2 write), without profile markers/history SUM. Duplicate IDs make no relation/count writes. The normal rate guard adds one necessary R2 CAS per request.
- Overlay request limiting keeps the original RATE_LIMITS.follow / RATE_LIMIT_WINDOW_MS through bounded R2 CAS and uses the existing native limiter with a separate follow key. RATE_DB is untouched; no binding/resource configuration change. Existing legacy rate path remains intact.
- Local TypeScript and Build PASS (existing chunk/import warnings); verify347/348/349(includes353)/350/351/352/354/355 PASS. Also 345 functional/creator, 346 metadata, 197 likes, 198 snapshot diagnostics, 202 action bounds, 114 parity PASS. 345 continues to expose unchanged legacy trigger amplification, not an overlay billing claim.
- verify355 executes actual consumer functions: stale profile edit/mirror and concurrent CAS conflict, relation-saved/R2-failed readers, dirty profile edit, missing-profile fail-closed, social snapshot with missing-like fallback, 5002 memberships over two pages, follower save allow/deny, handle cache revision/recovery, no-op receipt, client missing-target recovery, and rate rejection. Existing 354 stale/reverse/concurrent/crash tests remain intact.
- Initial remote Run [37209848937](https://github.com/andrawing1212/soridraw-music/actions/runs/37209848937) SUCCESS on c28a6eb8: relation W2/W1/W2/W1, duplicates/stale W0; HTTP new follow R2/W2, unfollow R6/W1, duplicate R1/W0, same-state R4/W0, stale R1/W0, relation-saved failure R5/W1, recovery R16/W0. RATE_DB W0 throughout; owned DB deletion PASS. R2/native limiter are memory fixtures, not real billing/live-device proof. Final code 634589b2af0aa8041fe394402aa6f3a7a7abdc99 additionally fences malformed/future rate windows; final Run [37210263354](https://github.com/andrawing1212/soridraw-music/actions/runs/37210263354) SUCCESS with identical measured costs and owned D1 deletion PASS. The final follow-up changes documentation only; no code/billing sample mismatch.
- No deployment, shared migration/manifest activation, shared/user data write, backfill or TEST/PRODUCTION/main change. Final audit main/production refs remain f7fc25d5452b3313efa3cca53c180c5494cc9837 / e994340f3c4f6ac97f444f1ddf13053d3faffa71; preview/main/production protection was confirmed enabled. No new branch or workflow. Remaining gates: independent Astra re-audit, live R2/Worker contention and PC/mobile, all-environment cutover compatibility and missing-profile baseline policy. RELEASE BLOCKED.

## 0P0. protocol354 Astra 독립감사 FAIL — 배포 차단 8건 (2026-10-04 KST)

- 기준 branch/commit: `preview` / `c47f6c6dbca385787b1cd5cd0f5c61585f7a27a7`.
- 독립 감사 판정: **FAIL**. 현재 후보는 PREVIEW 배포/활성화 금지.
- 관계 SQL 자체의 isolated D1 physical W1~W2 증거는 유효하지만, 실제 HTTP 전체 경로 비용과 모든 reader/cache 호환성은 아직 미통과.

확인된 차단 항목:
1. `patchPublicProfileBundle245` 및 `writeExploreSharedProfile060`이 오래된 profile bundle을 무조건 저장해 정확한 follower/following count와 pending/exact 복구 기록을 되감을 수 있음. 공유 프로필 writer는 최신 객체 CAS 병합 + follow count/recovery metadata 보존 필요.
2. `readSharedProfileConnection348`, public profile, first-view 경로가 pending/exact 미완료 상태를 복구하지 않고 동결된 legacy D1 count를 정상값처럼 반환할 수 있음. overlay reader에서 복구/fail-closed 필요.
3. `handleMySocialSnapshot042`이 overlay 대신 legacy R2/legacy follows를 사용하여 다른 PC/모바일에서 새 팔로우를 누락할 수 있음. snapshot follow authority를 overlay/effective reader로 전환하고 client complete 판정 수정 필요.
4. `handleMyFollowingR2Bundle` 353 경로가 5,000 제한 잘림을 complete 목록처럼 반환 가능. completeness/pagination 신호와 incomplete cache의 개별 relation 확인 필요.
5. `handleFollowerSaveAccess`가 legacy `follows`만 검사해 overlay 신규 팔로우/해제와 권한이 어긋남. cutover 이후 effective membership 사용, legacy 분기 유지.
6. follow mutation/recovery가 UID cache만 무효화하고 실제 handle first-view cache를 남길 수 있음. UID+handle 캐시 무효화가 mutation과 recovery 양쪽에 필요.
7. relation 변화 없는 동일 상태 요청도 `completeFollowIntent354 -> repairFollowProfile354`에서 exact recovery/R2 writes를 반복. 정상 no-op과 장애 recovery를 분리해 불필요한 R2/overlay history 합산 금지.
8. Run `37206991230`의 W1~W2는 relation SQL 단독 증거이며 `enforceUserRateLimit`의 RATE_DB write 등 실제 HTTP 총비용은 제외. 실제 Worker HTTP 경로에서 DB + RATE_DB + R2 비용을 분리 측정해야 함.

보호 범위:
- 좋아요 / 공개·비공개 / 검색 / 크리에이터 추천 / UI 정상 경로 변경 금지.
- shared migration, cutover manifest 활성화, 사용자 데이터 write/backfill/delete, TEST/PRODUCTION/main 변경 금지.
- 실제 서비스는 여전히 app344 / PREVIEW Worker341.

다음 합격 조건:
- 위 8건 수정 후 TypeScript/Build 및 347~354 + 새 verifier PASS.
- stale/duplicate/reverse/crash/no-op/profile-edit/social-snapshot/5001-follow/follower-save-access/handle-cache recovery 재현 PASS.
- isolated relation SQL W1~W2 유지 + 실제 HTTP 경로 DB/RATE_DB/R2 비용 계측 분리.
- Astra 독립 재감사 PASS 전 PREVIEW 배포 금지.

## 0OZ. Follow candidate354 — crash-consistent orchestration implemented, NOT activated (2026-10-04 KST)

- Branch: preview. Exact starting HEAD: `9709c6f2ef06d40d6c780f07ec856c4a917449f6`. App344 / deployed PREVIEW Worker341 remain the documented live baseline; no release requested or executed.
- Actual overlay HTTP writer now delegates to durable R2 pair intent + both endpoint dirty markers + fenced 350 relation writer + 352 conditional delta / 351 indexed exact count read + CAS settlement. Overlay wrapper skips legacy following/profile sync. Missing manifest still uses the original legacy path.
- Naturally touched overlay edges retain ordering tombstones on return to baseline. Removing the fence permits a suspended old request to resurrect an older relation. No backfill, new columns, indexes or shared migration. This supersedes the earlier candidate's delete-to-baseline writer for protocol354 only; unfenced 350 remains a historical dormant fixture path, not a runtime caller.
- Pending intents survive Worker termination and R2 save/response failure. Follow-state GET and the next follow request replay safely and repair exact counts. Count snapshots capture the profile etag BEFORE replay/read; new registrations or profile edits invalidate stale snapshots. Pending work is bounded to 32 per profile and CAS retries to 6; exhaustion fails closed with 503.
- Ordered client contract: explicit server `FOLLOW_ORDER_REQUIRED` response negotiates protocol354/revision through follow-state. Stable operation id survives uncertain retries in the page; same-pair overlay requests are serialized. Revision conflicts are not automatically rebased. Legacy keeps the original one request/no extra body/read. No UI/CSS change.
- Shared manifest additionally requires `crashConsistentWriter354=true` and `orderedClientRequests354=true`. Neither manifest nor shared schema was written. TEST/PRODUCTION must understand the contract and profile fence preservation before a separately approved cutover.
- Local TypeScript / final Build PASS (existing size/import warnings). Verify347/348/349(includes353)/350/351/352/354 PASS; 345 functional, 346 creator metadata/recommendation, 197 likes, 202 action bounds, 114 parity and deployment preflight PASS. Verify345 continues to report the unchanged legacy physical amplification as unresolved; it does not certify overlay billing.
- Verify354 executes actual functions with SQLite + conditional R2 fixtures: crash after each durable write/response loss, half-registration failure, duplicate/conflicting ids, reverse arrivals, baseline refollow, resumed old writer, concurrent same pair / shared target, actual HTTP delegation, ordered client negotiation/queue/retry, and unchanged unrelated functions/legacy statements.
- Implementation source: `c911ae4d86159d55335f02a0df155904e8fcae6f`. Audited source including corrected measurement: `3b7a27e5d558b4bec2d2a8614aafd5c32ffbc26c`. Final follow-up commit changes documentation only.
- Isolated remote billing / full Release System Audit Run [37206991230](https://github.com/andrawing1212/soridraw-music/actions/runs/37206991230): SUCCESS. Actual 350 protocol354 SQL: new follow Rows Written2/Read1; new unfollow W1/R3; legacy unfollow W2/R3; legacy refollow W1/R5; all duplicates W0; suspended stale request W0/R1. Forward/reverse indexed list fixture Rows Read9/9; pair PK lookup PASS. Owned synthetic D1 deletion PASS. Shared canonical DB writes0. TS/build/static regression/TEST-PRODUCTION dry-run/read-only shared preflight PASS. This is isolated D1 evidence, NOT live end-to-end R2/Worker/PC-mobile certification. Initial failed measurement expectation and successful correction are retained in the audit document.
- No Firebase / Functions / Cloudflare deployment or resource configuration change; no shared/user DB mutation, migration, seed, backfill or data copy. Main/production refs fixed before work: `f7fc25d5452b3313efa3cca53c180c5494cc9837` / `e994340f3c4f6ac97f444f1ddf13053d3faffa71`.
- Remaining gates: real R2/Worker end-to-end cost, live contention/PC-mobile behavior, all-environment protocol compatibility/profile writer fence preservation, baseline integrity/missing-profile recovery policy, and the separate shared migration/cutover approvals. RELEASE BLOCKED. Detailed correctness and cost limits: FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md continuation354.

## 0OY. 팔로우 W2 물리비용 경로 실증 + app347 호환 1단계 PASS (2026-10-04 KST)

**중요: 아직 배포 완료가 아니다. 실제 앱은 app344 / PREVIEW Worker341 유지.**

### app347 호환 1단계
- 현재 D1을 canonical authority로 유지한 채, R2 following summary에 정확한 following count + monotonic revision을 추가하는 후보 구현.
- 기존 5,000명 membership cap과 정확한 count를 분리해, capped list를 완전한 목록으로 오인하지 않음.
- 오래된 mutation이 최신 count/list를 되감지 못하도록 R2 conditional write/CAS + revision guard 추가.
- 기존 v114 writer가 새 exact-count object를 덮지 못하도록 fence 추가.
- follow 후 R2 local/shared 동기화의 중복 read/write loop를 shared fast-path로 축소.
- D1 physical write/read는 **이 단계에서 일부러 변경하지 않음**. 현재 비용 문제를 해결했다고 보고하지 않는다.

Release System Audit:
- Run `37175153805`: **SUCCESS**.
- TypeScript PASS / Build PASS / hard static release gate PASS.
- `verify-347-follow-authority.mjs` hard gate PASS.
- canonical Worker SHA lock PASS: `498c939d1a45dd67017167e4b333bac59a3ae990cc6f9b90a5317d7d6d32df27`.
- TEST/PRODUCTION dry-run PASS / shared D1 preflight SELECT-only PASS.
- 배포/사용자 데이터 변경 0.

### 실제 shared D1 팔로우 원인 감사
Read-only Run `37175284793`: SUCCESS / remote D1 writes 0.

live `follows`:
- rowid table + composite PK autoindex.
- `idx_follows_follower_created`.
- `idx_follows_following_created`.
- follow INSERT/DELETE마다 global shared revision trigger 존재.

live `profile_stats`:
- PK index.
- update마다 shared revision trigger.
- update → `explore_derived_profiles` counter update.
- derived counter update → seq 증가 + profile journal write.

따라서 현재 follows 관계 1건 자체도 여러 physical row를 쓰며, 양쪽 profile_stats/derived trigger가 더 붙는다. 현재 구조를 query W2로 묶는 것만으로 Rows Written W1~W2는 불가능하다는 원인을 live schema로 확인.

### W2 후보를 실제 Cloudflare 원격 D1에서 실증
격리 synthetic D1 Run `37175419175`: SUCCESS. shared/user DB 미사용, 종료 후 DB 삭제 PASS.

후보:
- legacy `follows`는 immutable baseline.
- post-cutover 변경만 `explore_follow_overrides_348` sparse overlay에 기록.
- overlay는 `WITHOUT ROWID` PK(follower_uid,following_uid).
- 신규 active follower reverse 탐색용 partial index 1개만 사용.
- legacy data backfill 0.

실제 Cloudflare D1 billing:
- 새 관계 follow: **Rows Written 2 / Rows Read 0**.
- 같은 follow 재요청: **W0**.
- 새 관계 unfollow(원래 baseline 미존재로 복귀): **Rows Written 1 / Rows Read 1**.
- legacy 관계 unfollow: **Rows Written 1 / Rows Read 0**.
- legacy 관계 refollow(원래 baseline으로 복귀): **Rows Written 1 / Rows Read 1**.
- 중복 unfollow/refollow: **W0**.
- forward 목록 test Rows Read 9 / reverse 목록 test Rows Read 8, 둘 다 index search이며 whole-table scan 없음.
- targeted pair lookup PK/index search PASS.
- legacy follows row 3개 그대로 유지, backfill/rewrite 0.

**결론**
- 사용자 비용 합격선 W1~W2를 실제 D1에서 만족하는 저장 구조를 찾음.
- 하지만 shared cutover는 아직 실행 금지.
- 이유: TEST/PRODUCTION 현재 Worker가 legacy follows/profile_stats/derived counters를 읽고 쓰므로, 먼저 3환경 reader/writer compatibility를 배포해야 shared canonical을 overlay authority로 전환할 수 있음.
- 지금 shared schema, trigger, user data는 변경하지 않았다.

## 0OX. 9d10970 candidate continued — physical follow / cold-device release BLOCKED (2026-10-04)

- Branch preview; basis 9d10970b44c072d16c4355fc868ea25f083d4eeb. app344 / deployed Worker341 unchanged. Candidate not deployed.
- Prior W3-to-W2 compaction preserved. Synthetic total_changes remains9. Actual original Rows Read18–19 / Rows Written14–17 = FAIL. Candidate physical metrics unavailable; never declare completion from queryW2.
- Runtime reader audit confirms current main/production consume both D1/derived counters. R2 membership has truncation/concurrency/failure holes. Shared authority/trigger cutover NOT executed; two-stage prerequisites and outstanding implementation recorded in FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md.
- Feed existing bounded joins/publication/derived generation now carry ownerProfileGenres. Existing authenticated cold snapshot carries self profile genres from one direct R2 GET, no extra Worker/D1. Client caches/reranks without candidate N+1. Existing legacy R2 Feed coverage remains unresolved, so cold-device completion NOT declared.
- TypeScript/Build/relevant functional verifiers PASS. Actual physical release gate FAIL; PC/mobile and live cold coverage unverified. Independent Work audit corrections applied; no release.
- No migration/backfill/delete/data copy, main edit, TEST/PRODUCTION deployment, Firebase/Functions deployment or resource/config change.
- Next: prepare safe exact/ordered per-actor following authority and all reader cutovers, live read-only index/trigger evidence, approved compatible stage2, bounded legacy Feed genre coverage; then six actual PREVIEW measurements and PC/mobile. Deploy neither service before both gates pass.

## 0OV. 비용 검증 기준 보강 — query W뿐 아니라 D1 Rows Read/Written 동시 합격 필수 (2026-10-04 KST)

사용자 지적 반영.

팔로우/좋아요/공개·비공개/프로필 수정 등 비용 검증에서 이제 아래를 항상 한 세트로 본다.

- D1 query read/write
- D1 Rows Read
- D1 Rows Written
- Worker 요청 수
- R2 Class A/B
- Firestore read/write

특히 logical `D1 W3`만 낮아 보여도 실제 `Rows Read/Written`이 크게 증가하면 비용 최적화 PASS로 보지 않는다.

2026-10-04 팔로우 해제 실사용 캡처:
- 한 실행에서 `D1 query R0/W3`인데 실제 `Rows Read 18 / Rows Written 14`
- 이어진 실행에서는 `Rows Read 19 / Rows Written 17`
- 따라서 현재 팔로우 경로는 비용 기준 FAIL로 취급.

다음 팔로우 수정의 합격 조건:
- 관계 1개 변경만 처리
- 전체 follows/profile/feed scan 금지
- Rows Read/Written이 변경량에 비례하는 O(1)이어야 함
- query W 수치와 physical row 수치를 둘 다 기록
- PREVIEW 실사용에서 같은 동작을 3회 이상 반복해 수치가 안정적으로 낮은지 확인
- 비용 원인을 모르면 다음 기능 작업으로 넘어가지 않음

## 0OU. app344 실사용 발견 — 팔로우 변경 실제 D1 row 증폭 + 크리에이터 추천 범위 확장 필요 (2026-10-04 KST)

**사용자 실사용 발견**
- 공개프로필에서 팔로우 해제를 1회 수행했을 때 CACHE LIVE의 팔로우 변경은 D1 W3로 보이지만 Cloudflare 실제 D1 rows read/written 증가가 더 큼.
- "좋아할 만한 크리에이터"는 최신 공개곡 40개에 등장한 owner만 후보가 되는 현재 구조라 추천 범위가 너무 좁음.

**코드 감사 결과 — 팔로우**
- 현재 canonical Worker는 app245/246 최적화가 이미 들어 있어 follow 후 불필요한 profile 전체 재조회와 R2 counter D1 post-read는 제거된 상태이며, `adjustExploreFollowCountersDelta`도 `RETURNING` 기반 no-postread guard를 갖고 있음.
- 그러나 실제 canonical mutation은 여전히 follows 1행 + 양쪽 `profile_stats` counter 2행을 변경하는 W3 구조.
- `profile_stats` 두 변경은 shared D1의 `explore032_profile_stats_update` → `explore_derived_profiles` → `explore032_derived_profile_update` 경로를 깨우므로 Cloudflare 물리 row-write/read는 CACHE LIVE의 논리 W3보다 커질 수 있음.
- PREVIEW wrangler는 shared canonical `DB=soridraw-explore-db`와 별도 `RATE_DB=soridraw-explore-preview-db`를 사용하므로 실제 계기판 감사 시 두 DB를 구분해야 함.
- 결론: 사용자 관찰은 정상적인 "W3만 발생"으로 볼 수 없으며 physical row amplification까지 합격선에 포함해야 함.

**다음 비용 목표**
- 우선 non-destructive verifier에서 팔로우 1회 logical W와 physical row changes를 분리 계측.
- follow canonical edge를 가능한 W1에 가깝게 만들되 follower/following 수 정확도, PC↔모바일, 공유 PREVIEW/TEST/PRODUCTION 데이터 호환성 보호.
- shared D1 trigger 변경이 필요하면 코드만 먼저 준비/검증하고 실제 shared schema 변경은 별도 안전 확인 후 진행.

**크리에이터 추천 확정 방향**
1. 내 공개프로필 대표 장르와 비슷한 크리에이터 최우선.
2. 부족하면 SORIDRAW 추천곡 owner.
3. 다음 최신 공개곡 owner.
4. 다음 인기곡 owner.
5. 내 계정 제외 + creator UID 중복 제거.
- 후보의 대표 장르 때문에 프로필을 N개씩 개별 서버 조회하는 구조 금지. R2/로컬 파생 요약을 사용해 D1 0 목표.

**현재 배포 상태**
- app344 PREVIEW는 그대로 유지.
- 이 감사 기록만 추가. Worker/Firebase/Functions/Cloudflare/D1/user data 변경 없음.

## 0OT. PREVIEW app344 — Explore 필터 버튼 가독성 확대 (2026-10-04 KST)

**변경**
- 장르별 추천의 대분류/세부장르 칩과 최신 공개곡의 전체/팔로잉 등 동일 계열 필터 버튼을 조금 확대.
- PC: 높이 30→34px, 좌우 여백 11→13px, 글자 11→12px.
- 모바일: 높이 28→32px, 좌우 여백 10→12px, 글자 10→11px.
- 버튼 기능/배치/색/테마/장르 분류 로직 변경 없음.

**배포**
- app344.
- PREVIEW release commit: `d3a132f5a2cfbde4503ac4211b57723c4830952a`.
- Firebase PREVIEW Run `37169322007`: **SUCCESS**.
- TypeScript PASS / Build PASS / Hosting PASS / exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore / 사용자 데이터 변경 없음.

## 0OS. PREVIEW app343 — 장르별 추천 대분류/세부장르 2줄 구조 (2026-10-04 KST)

**사용자 확정 기준**
- 첫째 줄은 포괄적인 대분류 장르.
- 둘째 줄은 세부 장르.
- 첫째 줄 클릭으로 둘째 줄이 펼쳐지거나 교체되는 구조 금지. 두 줄은 독립.
- `소울 / 펑크`, `포크 / 어쿠스틱`, `클래식 / 시네마틱`처럼 서로 다른 대분류를 한 칩으로 묶지 않음.
- K-Pop / J-Pop은 대분류로 허용.
- K-록 / K-발라드 / K-뉴잭스윙 / 얼터너티브 R&B 등은 세부장르 줄.

**app343 변경**
- 첫째 줄: 현재 Feed에 존재하는 곡을 broad family로 로컬 집계.
  - 팝, K-Pop, J-Pop, 힙합, R&B, 소울, 펑크, 록, 메탈, EDM, 재즈, 포크, 어쿠스틱, 컨트리, 월드뮤직, 레게, 라틴, 아프로, 트로트, 7080 가요, 클래식, 시네마틱, 연주곡 중 해당되는 대분류만 고정 순서로 표시.
- 둘째 줄: 현재 Feed의 실제 세부 장르를 canonical label로 독립 표시.
- 대분류 클릭은 해당 broad family의 곡만 표시. 세부장르 줄 내용은 그 클릭 때문에 펼쳐지거나 교체되지 않음.
- 세부장르 클릭은 해당 세부 장르 곡만 표시.
- 기존 app342의 두 줄 독립 좌우 스크롤 유지.
- 이미 로드된 Feed 40곡만 사용. Worker/D1/Firestore 추가 읽기 없음.

**배포/검증**
- product source `460f817da0bc7d9ecfa54c83c3275e4cfb6e87aa`.
- release commit `fb31fd1faf0751e2ad39d2e92231c28bbace5391`.
- Firebase PREVIEW Run `37168925936`: **SUCCESS**.
- TypeScript PASS / Build PASS / PREVIEW Hosting PASS / exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules / 사용자 데이터 변경 없음.

**남은 확인**
- 실제 PREVIEW에서 첫줄 대분류 / 둘째줄 세부장르가 의도대로 보이는지 실사용 확인 전.

## 0OR. PREVIEW app342 — 장르별 추천 정리 + 2줄 분리 + 가로 스크롤 복구 (2026-10-04 KST)

**사용자 요청**
- 장르별 추천에서 같은 장르의 ID/영문 표기 중복을 정리.
- 첫 줄은 한글 장르명, 둘째 줄은 한글 표기가 없는 장르를 영문으로 표시.
- 장르가 화면 폭을 넘을 때 잘리지 않고 좌우로 이동 가능하게 수정.

**app342 변경**
- 이미 로드된 Explore Feed 40곡만 사용. 새 Worker/D1/Firestore 조회 없음.
- `GENRES + GENRE_HIERARCHY`의 id/영문명/한글명을 기기에서만 대조해 canonical 장르로 합침.
  - 예: `neo_soul / Neo Soul → 네오 소울`
  - `k_new_jack_swing / K-New Jack Swing → K-뉴잭스윙`
  - `underground_hiphop / Underground Hip-Hop` 같은 중복도 한 항목으로 합침.
- 한글 표시명이 있는 장르는 첫 줄, 한글 표시명이 없는 장르는 둘째 영문 줄.
- 두 줄 각각 독립 horizontal overflow.
- 마우스 휠/트랙패드의 세로 delta도 해당 줄이 실제로 더 이동할 수 있을 때만 좌우 이동으로 사용.
- 장르 선택은 기존 로컬 추천 카드 필터만 변경하며 추가 서버 요청 없음.
- 좋아요/저장하트/폴더/Split/Music Note/검색 Worker 변경 없음.

**변경 파일**
- `src/pages/ExplorePage.tsx`
- `src/components/explore/explore.css`
- `public/app-version.json`
- `.deploy/preview-app-release.trigger`

**검증/배포**
- product source: `735b01b428d04e3577bb6bfe4ca7cda0b1f60e8c`
- PREVIEW release commit: `566d10cac7dbf0387404d5d3ca597c665ee49195`
- Firebase PREVIEW Run `37167991654`: **SUCCESS**
- TypeScript PASS / Build PASS.
- Firebase PREVIEW Hosting PASS.
- `preview.soridraw.com` exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 변경 없음.

**남은 확인**
- 실제 화면에서 한글/영문 두 줄 분리와 중복 제거, PC/모바일 좌우 스크롤 체감 확인 전.

## 0OQ. PREVIEW Worker 341 — Explore 검색 D1 완전 차단 + 승인된 R2 검색 카탈로그 1회 백필 (2026-10-04 KST)

**사용자 승인 목표**
- 처음 보는 검색어도 D1 read/write 0.
- 오타/랜덤 문자열도 D1 read/write 0.
- 같은 검색어 재검색은 app340 기기 캐시로 Worker 0 / D1 0.
- 기존 공개곡 제목/장르/아티스트 검색 기능은 R2 검색 카탈로그로 유지.

**실행한 1회 파생 카탈로그 백필**
- 사용자 승인 후 기존 공개곡을 shared R2 검색 카탈로그에 1회 채움.
- 대상 공개곡: **45곡**.
- Run `37163637669`: **SUCCESS**.
- 45/45 R2 marker + shared track-card 검증 PASS.
- D1은 SELECT/read-only만 사용.
- D1 write 0 / schema change 0.
- 사용자 원본 데이터 write/delete/rewrite 0.
- 임시 backfill Worker는 작업 완료 후 삭제.
- product commit: `9c11b95cf4c95210011b1425cea23f3e51cbf34f`.

**Worker 341 검색 구조**
- PREVIEW hybrid mode의 `/v1/search` 일반 사용자 경로에서 legacy D1 search fallback 제거.
- 검색 authority를 R2 catalog로 고정.
- 제목 / 장르 / 아티스트 nickname·handle 검색은 R2 catalog prefix + shared R2 track-card/profile을 사용.
- 없는 검색어/오타/랜덤 문자열도 빈 R2 결과만 반환하며 D1 query를 실행하지 않음.
- 검색 Edge Cache 5분 유지.
- app340의 동일 검색어 기기 로컬 캐시 2분 경로는 그대로 유지.
- likes / save heart / folders / Split / Music Note batching 변경 없음.

**검증**
- app341 verifier:
  - `APP341_SEARCH_R2_ONLY=PASS`
  - `APP341_SEARCH_D1_R0_W0_CONTRACT=PASS`
  - `APP341_RANDOM_QUERY_D1_R0_W0=PASS`
  - TypeScript PASS / Build PASS.
- Final Release System Audit Run `37164010278`: **SUCCESS**.

**PREVIEW 배포**
- PREVIEW Worker Release Run `37166719557`: **SUCCESS**.
- active Worker version: `59ed42ea-f29a-4837-a9a7-20e70648e59c`.
- PREVIEW release preflight PASS.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- Firebase Hosting은 변경 없음 — 앱 UI는 계속 **app340**.

**실기기 최종 확인**
1. CACHE LIVE 초기화.
2. 처음 입력하는 정상 제목/ID/아티스트 검색 1회:
   - Worker 1 가능 / D1 query R0 W0 / rows R0 W0.
3. `힙합` 등 한글 장르 첫 검색:
   - Worker 1 가능 / D1 R0 W0.
4. 랜덤/오타 검색 예: `ㅁㄴㅇㄹ341`:
   - Worker 1 가능 / D1 R0 W0.
5. 같은 검색어를 2분 안에 재검색:
   - app340 local cache hit이면 Worker 증가 0 / D1 증가 0.

## 0OP. PREVIEW app340 — 동일 검색 재실행 Worker 0 / D1 R0 로컬 캐시 (2026-10-04 KST)

**사용자 요구**
- 첫 검색은 서버 1회 허용.
- 같은 검색어의 두 번째 검색부터는 서버 호출 0, D1 R0 목표.

**app340 변경**
- Explore exact search 결과를 기기에 2분간 저장.
- 같은 request URL(검색어 + 장르 alias 조합)이 2분 안에 다시 검색되면:
  - Worker 호출 0.
  - D1 R0/W0.
  - 기기 로컬 캐시에서 즉시 결과 표시.
- 첫 검색은 기존 app339 R2-first + indexed genre path 사용.
- 검색 결과가 없거나 오류인 경우 정상 서버 fallback 유지.
- Feed / 공개프로필 / 좋아요 / 저장하트 / 폴더 / Split / Music Note 구조 변경 없음.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.

**검증**
- TEMP app340 Verify Run `37161309234`: SUCCESS.
- TypeScript PASS / Build PASS.
- app340 repeat-search Worker-zero contract PASS.
- Music Note batching regression PASS.
- Final Release System Audit Run `37161393974`: SUCCESS.

**배포**
- Firebase PREVIEW App Release Run `37161506204`: SUCCESS.
- PREVIEW app version **340**.
- `preview.soridraw.com` exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION Hosting unchanged PASS.
- Worker는 app339 active `aedd8111-b2f4-407f-9e3f-ba062a82ed16` 그대로 유지.
- approved source: `5dfe5b0b9183c27b946136dc8d25bca11303606b`.

**실기기 최종 확인**
1. `힙합` 첫 검색: Worker 1회 허용.
2. 2분 안에 같은 `힙합` 재검색:
   - Browser/local cache hit.
   - Worker 증가 0.
   - D1 query/read 증가 0.
3. 실패하면 app340 검색 캐시 경로 FAIL로 처리하고 다음 승격 중단.

## 0OO. PREVIEW Worker app339 hotfix — 한글 장르 검색 alias 폭증 제한 + 90초 Edge Cache (2026-10-04 KST)

**사용자 실기기 관찰**
- app338 이후 한글 `힙합` 검색 1회:
  - D1 query R16 / W0
  - rows_read R250 / W0
- 전체 스캔은 제거됐지만 alias 하나의 검색이 여러 영문 장르로 fan-out되며 indexed query가 반복되는 비용이 남음.

**원인**
- 클라이언트가 `힙합` 한 번에 Hip-hop 계열 여러 alias를 전달.
- Worker가 alias마다 `primary_genre` + legacy `track_tags` 두 indexed query를 각각 수행.
- 그래서 한 번의 사용자 검색이 다수의 작은 indexed query로 증폭.

**app339 수정**
- 정확한 한국어 메인 장르:
  - `힙합 → Hip-hop`
  - `재즈 → Jazz`
  - `트로트 → Trot`
  - `록/락 → Rock`
  - `메탈 → Metal`
  - `하우스 → House`
  - `테크노 → Techno`
  - `트랜스 → Trance`
  - `클래식 → Classical`
  - `팝 → Pop`
  로 **alias 1개만** 사용.
- `발라드`, `시티팝` 같은 family 검색도 최대 alias 3개로 제한.
- 한글 장르 fallback 결과는 Cloudflare Edge Cache에 **90초** 저장.
  - 같은 Edge에서 같은 검색어 재검색 시 D1 **R0 목표**.
- R2-first 검색 유지.
- app338 indexed primary_genre / track_tags fallback 유지.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.
- 앱 Hosting 변경 없음, app337 유지.

**검증**
- app339 apply/verify Run `37160726661`: SUCCESS.
- TypeScript PASS / Build PASS.
- app336 hybrid regression PASS.
- app197/app210 like regression PASS.
- Final Release System Audit Run `37160817225`: SUCCESS.

**배포**
- PREVIEW Worker Release Run `37160937090`: SUCCESS.
- active PREVIEW Worker version: `aedd8111-b2f4-407f-9e3f-ba062a82ed16`.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- product source commit: `9ede46e248847d9fc8b11508dcda432c8f763c41`.

**다음 실기기 확인**
1. 같은 `힙합` 검색 1회.
2. 바로 같은 `힙합` 검색을 한 번 더.
3. 기대:
   - 첫 검색: app338의 R16/R250보다 크게 낮아야 함.
   - 두 번째 검색: Edge Cache hit이면 D1 R0/W0 목표.
4. 두 번째도 D1이 남거나 첫 검색이 여전히 과도하면 FAIL 처리.

## 0ON. PREVIEW Worker app338 hotfix — 한글 장르 검색 D1 R500~600 폭증 제거 (2026-10-04 KST)

**사용자 실기기 관찰**
- ID/제목 검색: 정상.
- 한글 장르 검색: `/v1/search` 1회마다 D1 rows_read 약 **R584** 관찰.

**원인 확정**
- app337의 한글 장르 legacy fallback이 기존 `handleGenreTracksCore066` 쿼리를 재사용.
- 해당 쿼리는 `primary_genre = ? OR (... EXISTS track_tags ...)` 구조라 SQLite planner가 장르 인덱스를 사용하지 못하고:
  - `SCAN t USING INDEX idx_tracks_latest_order`
  - 각 행마다 tag lookup
  로 동작.
- read-only live query-plan audit Run `37159126328`에서 원인 재현 PASS.
- 같은 라이브 DB에는 이미 다음 인덱스가 존재:
  - `idx_tracks_primary_genre_latest`
  - `idx_track_tags_kind_value_track`
  - `idx_track_tags_lookup`
- 즉 새 schema/index 생성은 필요 없음.

**app338 수정**
- R2-first 검색은 그대로 유지.
- R2 결과가 없는 한글 장르 fallback만 별도 indexed path로 교체.
- `primary_genre` branch:
  - `INDEXED BY idx_tracks_primary_genre_latest`
- legacy `track_tags` branch:
  - `INDEXED BY idx_track_tags_kind_value_track`
- 두 결과만 합쳐 반환.
- 기존 scan-prone `handleGenreTracksCore066` 호출 제거.
- broad legacy title/artist search fallback은 마지막 호환층으로 그대로 유지.

**검증**
- app338 apply/verify Run `37159304152`: **SUCCESS**.
- live query plan:
  - primary genre: `SEARCH t USING INDEX idx_tracks_primary_genre_latest (primary_genre=?)` PASS.
  - legacy tag: `SEARCH tt USING COVERING INDEX idx_track_tags_kind_value_track (kind=? AND value=?)` + track PK lookup PASS.
- app336 hybrid regression PASS.
- app197 / app210 like regressions PASS.
- shared D1 schema change **0**.
- user data migration/backfill/delete/rewrite **0**.
- Final Release System Audit Run `37159372696`: **SUCCESS**.

**배포**
- PREVIEW Worker Release Run `37159504049`: **SUCCESS**.
- active PREVIEW Worker version: `4929b0b7-3d6b-448a-8fae-1b0ffe7b5941`.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- Firebase Hosting 재배포 없음 — app은 계속 **337**.
- product source commit: `7e5f6b9c1cdd0f0ad0d24611568aa2117495c3b9`.

**다음 실기기 확인**
1. 동일한 한글 장르 검색어를 다시 1회 검색.
2. 기대값:
   - 이전 R584 같은 전체 스캔은 없어야 함.
   - R2에 장르 marker가 있으면 R0 가능.
   - legacy fallback이어도 matching rows 중심의 소량 read만 허용.
3. 여전히 수백 read면 즉시 FAIL 처리하고 다음 단계 중단.

## 0OM. PREVIEW app337 배포 완료 — 검색 D1 폭증 완화 + 한글 장르 검색 (2026-10-04 KST)

**사용자 app336 실기기 결과**
- 공개/비공개, Explore, 공개 프로필 등은 정상.
- 검색 1회에서 legacy D1 search가 먼저 실행되며 rows_read가 크게 증가하는 문제 확인.
- 한글 장르명(예: 발라드/힙합/재즈/트로트 등)을 그대로 검색하면 저장된 영문 장르와 연결되지 않는 사용성 문제 확인.

**app337 변경**
- 검색 first page를 **R2 catalog 우선**으로 변경.
  - R2에서 곡/아티스트 결과가 있으면 legacy D1 search를 호출하지 않음.
  - legacy D1 broad search는 R2에 결과가 전혀 없는 기존 legacy-only 검색어의 최종 호환 fallback으로만 유지.
- 한글 장르 검색:
  - 앱의 기존 `GENRES.labelKo → label` 데이터를 사용해 한글 입력을 같은 1회 검색 요청의 genre alias로 전달.
  - 발라드/시티팝/힙합/R&B/재즈/트로트/록/메탈/하우스/테크노/트랜스/앰비언트/로파이/포크/컨트리/소울/펑크/클래식 등의 broad alias 보강.
  - R2 marker가 없는 legacy 곡은 broad search가 아니라 기존 indexed genre route로 bounded fallback.
- 검색 UI/레이아웃/기존 공개/좋아요/저장/폴더/Split/Music Note 저장 구조 변경 없음.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.

**검증/배포**
- app337 apply/verify Workflow Run `37154967808`: **SUCCESS** (attempt 3).
  - app337 R2-first verifier PASS.
  - Korean genre alias verifier PASS.
  - app336 hybrid regression PASS.
  - like/publication/Music Note focused regression PASS.
  - TypeScript PASS / Build PASS.
- Final Release System Audit Run `37155219113`: **SUCCESS**.
- PREVIEW Worker Release Run `37155369295`: **SUCCESS**.
  - active Worker version: `4b3e02c8-f906-4c22-bbc1-36cd963babee`.
  - FEED smoke PASS / PROFILE smoke PASS.
  - public-like-card D1 R0/W0 PASS.
  - TEST / PRODUCTION Worker unchanged PASS.
- Firebase PREVIEW App Release Run `37155428848`: **SUCCESS**.
  - `preview.soridraw.com` app **337** exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
  - shared RTDB Rules SKIPPED.
- approved product source commit: `7465cce1f14d418059946651d9b05d19229ccea2`.

**남은 제한**
- catalog에 아직 marker가 전혀 없는 오래된 legacy-only 제목/아티스트 검색은 최종 호환 fallback으로 D1 search를 1회 사용할 수 있음.
- 이를 완전히 0으로 만들려면 기존 공개곡의 R2 catalog를 한 번 채우는 derived-cache backfill 또는 3환경 cutover가 필요하며, 현재는 실행하지 않음.

**다음 실기기 확인 — 이것만**
1. 이전 영상에서 rows_read가 크게 오른 동일 검색어를 다시 1회 검색.
   - R2 catalog에 존재하는 검색어라면 D1 **R0/W0 목표**.
2. 한글 장르 검색 3개 정도:
   - 예: `발라드`, `힙합`, `재즈` 또는 실제 공개곡 장르의 한글명.
   - 결과가 정상 표시되어야 함.
3. 위 2개가 PASS하면 app337 검색 수정 종료.
4. legacy-only 검색어에서 여전히 D1 fallback이 확인되면 별도 derived R2 catalog backfill 승인 여부를 판단.

## 0OL. PREVIEW app336 배포 완료 — R2 + legacy hybrid read 호환층 활성 (2026-10-04 KST)

**실제 배포 상태**
- preview HEAD: `be3ce04652ae6c3604aba872e857c19a703a1876`.
- Final Release System Audit Run `37152439362`: **SUCCESS**.
- PREVIEW Worker Release Run `37152582192`: **SUCCESS**.
  - active Worker version: `903c72d5-a569-45e7-a196-947b74ddd6e2`.
  - `SORIDRAW_R2_HYBRID_READ_V1=1` 활성.
  - FEED smoke PASS / PROFILE smoke PASS.
  - public-like-card smoke D1 **R0/W0 PASS**.
  - TEST / PRODUCTION Worker unchanged PASS.
- Firebase PREVIEW App Release Run `37152665528`: **SUCCESS**.
  - remote app version **336**.
  - `preview.soridraw.com` exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
- Functions / Firestore Rules / shared D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete / rewrite 없음.

**app336 목적**
- 기존 legacy-only 공개곡과 R2 catalog-only 공개곡을 동시에 읽는 호환층.
- 같은 track id가 양쪽에 있으면 R2/shared card를 최신 authority로 사용.
- stale legacy 공개행이 private R2 상태를 다시 노출하지 않도록 차단.
- latest / popular / public-profile / genre / title / artist nickname·handle 검색 호환 유지.
- warm client cache Worker-zero(app335) 경로 유지.

**중요**
- 이번 배포는 **read compatibility 선행 단계**다.
- first-publication W12→W2 후보 cutover migration은 아직 실행하지 않았다.
- shared D1 cutover는 사용자 실기기 app336 검증과 3환경 호환층 승격 전까지 금지.
- app164 likes / app302 save heart / app301 folders / app303 Split / Music Note 60초 local-first 정상 기준은 동결 유지.

**다음**
1. 사용자 실기기에서 app336 기능 회귀 확인.
2. Explore/공개프로필 warm 재진입 Worker 0 유지 확인.
3. legacy 곡 + 최근 R2 곡 latest/popular/profile/search 누락·중복 여부 확인.
4. 기존 좋아요/저장하트/폴더/분할/Music Note 동작 확인.
5. 실기기 PASS 뒤에만 TEST/PRODUCTION에 hybrid read 호환층 승격 계획 수립.
6. 세 환경이 hybrid read를 지원한 뒤 별도 명시 승인으로 shared D1 W2 cutover migration 검토.

## 0OK. app336 구현 후보 완료 — R2 + legacy hybrid read 코드/검증 PASS, PREVIEW 배포 전 감사 단계 (2026-10-04 KST)

**구현**
- app336 Worker 호환층을 `preview`에 구현.
- generated canonical Worker commit: `e935d52fa6a63ef9f115ef2c07471f77bd9e726a`.
- PREVIEW-only `SORIDRAW_R2_HYBRID_READ_V1=1` 활성.
- app version source = **336**.
- TEST / PRODUCTION config/code 배포 변경 없음.

**동작 원칙**
- legacy-only 곡은 기존 경로에서 계속 읽음.
- catalog-only 곡은 R2 catalog + shared track-card에서 읽음.
- 같은 track id가 양쪽에 있으면 R2/shared card가 최신 authority.
- catalog meta가 private인 곡은 stale legacy 공개행을 화면에 재노출하지 않음.
- latest / popular / public-profile deep / genre는 hybrid cursor로 legacy + R2를 합성.
- title / artist nickname·handle search first page는 legacy + R2 검색 결과를 합성.
- public-profile first-view의 기존 shared-R2/Edge warm 경로는 유지.
- 호환 단계의 legacy 보충 scan은 최대 4 page로 bounded; 무제한 전체 scan 금지.
- warm client cache Worker-zero(app335) 경로는 변경하지 않음.

**검증**
- Apply/verify Run `37151610954`: **SUCCESS**.
  - isolated Worker composition PASS.
  - legacy-only PASS.
  - catalog-only PASS.
  - mixed dedupe PASS.
  - stale legacy media/count가 R2 authority를 덮지 않음 PASS.
  - hybrid cursor state PASS.
  - search merge PASS.
  - targeted publication/like regression PASS.
  - TypeScript PASS.
  - Build PASS.
  - canonical worker SHA lock PASS: `0367c086772996c21cbf9ae84db3ac5c9796bee19153dbc15b57ee4cd03bc140`.
- shared D1 schema/index/trigger change **0**.
- user data migration/backfill/delete/rewrite **0**.
- Firebase / Worker 실배포는 아직 **0**.

**안전**
- 실제 W2 D1 cutover migration은 이번 app336에 포함하지 않음.
- app336은 세 환경이 향후 같은 read contract를 지원할 수 있게 만드는 선행 호환층.
- app164 likes / app302 save heart / app301 folders / app303 Split / Music Note 60초 local-first / app331~335 publication UI 보호.
- one-shot app336 implementation workflow와 완료된 W2 diagnostic workflow는 정리 완료.

**다음**
1. Final Release System Audit.
2. PASS 시 PREVIEW Worker만 app336 source로 배포.
3. Firebase PREVIEW app336 배포.
4. 실제 `preview.soridraw.com` 및 Worker smoke 확인.
5. TEST / PRODUCTION 비변경 확인.
6. 사용자 실기기 검증 전 shared D1 W2 cutover migration 금지.

## 0OJ. app336 설계 기준 확정 — first-publication W12 원인 완전 분해 + W2 격리모델 PASS (2026-10-04 KST)

**현재 배포 상태**
- 실제 PREVIEW 배포본은 계속 **app335**.
- Firebase / Worker / Functions / Rules 추가 배포 없음.
- TEST / PRODUCTION 변경 없음.
- shared canonical D1 사용자 데이터 변경 없음.

**실제 W12 원인 확정**
- Live schema/runtime read-only audit Run `37149706339`: **SUCCESS**.
- never-published Music Note 첫 공개의 실기기 W12는 현재 구조에서 정확히 다음으로 분해됨.
  1. canonical `tracks` insert: **W6**
     - table row W1
     - PK autoindex W1
     - Music Note에도 적용되는 4개 secondary index W4
  2. `explore_derived_tracks` insert: **W5**
     - table row W1
     - PK autoindex W1
     - latest / popular / profile rank index W3
  3. `explore_shared_revision` update: **W1**
  - 합계 **W12**.
- Music Note derived insert의 generic change-log/state trigger는 이미 `source_type <> 'music_note'` 조건으로 제외되어 있어 W12 원인이 아님.
- 기존 owner의 derived-profile repair도 실제 정상 owner에서는 추가 write 원인이 아님.

**3환경 호환성 감사**
- Run `37149380218`: **SUCCESS**.
- PREVIEW Worker:
  - R2 ordered catalog runtime 포함.
  - `SORIDRAW_R2_CATALOG_V1=1` write/preparation mode 활성.
  - catalog read / first-publisher cutover flag는 아직 비활성.
- TEST / PRODUCTION Worker:
  - 현재 R2 catalog runtime/flag 없음.
  - 기존 shared revision + derived recovery 경로를 계속 사용.
- 세 환경은 같은 canonical D1 / shared profile media를 사용.
- 따라서 지금 shared D1에서 Music Note derived/shared-revision을 바로 끊으면 TEST/PRODUCTION 호환성이 깨질 수 있으므로 **즉시 migration 금지**.

**post-migration hotpath 감사**
- stale audit가 제거된 index `idx_tracks_source_type_latest`를 강제해 실패한 진단은 audit-script 문제였고 제품 실패가 아님.
- 수정 후 Run `37149635235`: **SUCCESS**.
- current Music Note rows 68, non-empty legacy_global_id 0.
- current query-plan:
  - owner/source = `idx_tracks_owner_source`
  - profile fallback = `idx_tracks_owner_latest` + bounded temp sort
  - title fallback = `idx_tracks_latest_order`
  - genre = `idx_tracks_primary_genre_latest`.

**격리 diagnostic W2 모델**
- PREVIEW 전용 RATE_DB `soridraw-explore-preview-db`에 `w2p336_*` 임시 객체만 만들어 측정.
- shared canonical D1 `soridraw-explore-db`와 다른 DB ID임을 hard guard로 확인.
- 최종 Run `37150337923`: **SUCCESS**.
- 측정:
  - first publication: **W12 → W2**
  - actual source-media swap: **W3 → W1**
  - visibility change: **W2 → W1**
- 후보 구조:
  - cutover 이후 새 Music Note row를 legacy secondary indexes에서 제외.
  - cutover 이후 새 Music Note row는 legacy `explore_derived_tracks` mirror에서 제외.
  - cutover 이후 Music Note mutation은 legacy global shared-revision trigger에서 제외.
  - canonical `tracks` row/PK는 유지.
  - 기존 legacy Music Note rows는 그대로 두며 row rewrite/backfill/delete 없음.
- 진단 종료 시 임시 객체 cleanup.
- `SHARED_USER_DATA_WRITES=0`, `USER_DATA_MIGRATION=0`.

**판정**
- W1~W2가 물리적으로 불가능한 문제가 아님. **새 구조에서는 first publication W2 / source swap W1까지 가능함을 격리 D1에서 증명**.
- 그러나 live 적용 선행조건은 PREVIEW/TEST/PRODUCTION 모두가 **R2 catalog + legacy derived hybrid read**를 이해하는 것.
- 기존 사용자 row를 backfill/rewrite하지 않고, legacy row는 그대로 읽고 cutover 이후 row는 R2 catalog를 우선 읽는 방식으로 전환해야 함.

**다음 구현 — app336**
1. Worker에 R2 catalog + legacy-derived **hybrid read path** 추가.
2. 같은 track이 양쪽에 있으면 R2 catalog/card를 최신 authority로 우선.
3. catalog에 없는 기존 legacy row는 현재 derived/D1 recovery로 계속 읽음.
4. first page / deep page / public profile / title·genre·artist search 모두 결과 누락/중복 없음 verifier 추가.
5. app336 단계에서는 shared D1 schema/trigger/index migration **금지**.
6. read path가 3환경 승격 가능한 수준으로 검증된 뒤에만 별도 cutover migration을 설계하고 사용자 승인 요청.
7. 기존 app164/160 likes, app302 save heart, app301 folders, app303 Split, Music Note 60초/local-first, app331~335 publication UI/media 보호.

## 0OI. PREVIEW app335 배포 완료 — warm entry/reload Worker-zero 후보 + 공개 비용 실측 정정 (2026-10-04 KST)

**사용자 실기기 app334 결과 재판독**
- Explore/프로필 새로고침: D1 rows는 R0/W0이지만 Worker가 시간기반 revision 확인으로 누적되어 FAIL.
- 공개 비용:
  - 단순 public→private: billable **R5/W2**, Firestore W0 = PASS.
  - 동일 source private→public: app334 visibility-only 경로로 W2 보호.
  - 영상 후반 **사용자가 실제 두 번째 Suno 카드를 선택한 source swap**: billable **R11/W3**, Firestore W0 = HARD FAIL.
- 따라서 후반 W3는 같은-source 오분기가 아니라 **실제 source-media 변경의 현재 D1 fanout**이다.

**app335 변경**
- Explore Feed:
  - cached entry/reload에서 나이(age)만으로 `/v1/feed-revision`을 부르지 않음.
  - focus/pageshow/일반 pointer click은 revision Worker trigger가 아님.
  - 일반 Feed revision은 실제 hidden→visible tab resume 또는 기존 targeted mutation signal에만 묶음.
- SORIDRAW 추천:
  - healthy curated local cache는 route entry/reload에서 그대로 사용.
  - `curated-revision` 시간만료 Worker 확인을 entry에서 제거.
- Explore 관리권한 UI hint:
  - UID + local role signature cache가 일치하면 시간만료만으로 `explore-management-access`를 재호출하지 않음.
  - 실제 관리 mutation의 서버 authorization은 그대로 유지.
- 공개 프로필:
  - warm profile route entry/reload는 persistent first-view를 즉시 사용하고 Worker 0.
  - bounded shared-R2 revalidation은 real tab resume에서만 수행.
- Music Note 공개상태:
  - healthy persistent publication state는 entry/reload에서 Worker 0.
  - bounded publication revision revalidation은 real tab resume에서만 수행.
  - pending outbox / mutation safety path는 유지.
- 좋아요:
  - reload와 같이 발생할 수 있는 focus 이벤트를 private-like revision trigger에서 제거.
  - 기존 RTDB/public-like targeted signal, local-first heart, mutation settlement 보호.
- 일반 클릭/진단 초기화 자체가 Worker 비용을 만들지 않도록 pointer 기반 general revision check 제거.
- UI/레이아웃 변경 없음.

**검증**
- Final Release System Audit Run `37148217453`: **SUCCESS**.
  - audited product source: `ce43f5b835555ba9db8a52973023a61f1f3303cb`.
  - TypeScript PASS.
  - Build PASS.
  - static release verification PASS.
  - app164 like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight read-only PASS.
- PREVIEW App Release Run `37148368369`: **SUCCESS**.
  - deployed release commit: `cb89c9e161597c685917ea0d524c4a7192b7eb9c`.
  - audited source→release commit 차이는 `.deploy/release-system-audit.trigger`, `.deploy/preview-app-release.trigger` 두 배포 메타 파일뿐이며 제품 소스 차이 없음.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` app **335** exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
  - Worker / Functions / Firestore Rules / D1 schema 배포 없음.
  - 사용자 데이터 migration/backfill/delete 없음.
- Live read-only runtime audit Run `37148012532`: SUCCESS.
  - PREVIEW/TEST/PRODUCTION 모두 shared canonical D1 `217ef5b1-5d80-4f7c-afc7-9e07eb05c06b` 및 shared `soridraw-profile-media` 사용 확인.
  - 현재 source swap W3의 D1 원인을 정확히 분해:
    1. canonical `tracks` media UPDATE = W1
    2. `explore032_track_update` media delta → `explore_derived_tracks` = W1
    3. `soridraw_shared_rev_tracks_au_051` → `explore_shared_revision` = W1
    → 합계 W3.
  - TEST/PRODUCTION의 현재 구 Worker도 shared revision/derived 구조를 참조하므로, 둘 중 하나를 검증 없이 제거하면 shared-data 하위호환 위험. 이번 app335에서는 D1 trigger/schema를 추가 변경하지 않음.

**현재 비용 판정**
- 단순 공개↔비공개: W2 목표/기존 실측 PASS 유지.
- 실제 Suno source swap: **W3 HARD FAIL 유지**. 현재 shared TEST/PRODUCTION 하위호환 의존성 때문에 무검증 제거 금지.
- never-published 최초 공개: **R7/W12 HARD FAIL 유지** (이전 W18→W12).
- warm entry/reload Worker 0: app335 코드/CI PASS, **사용자 실기기 검증 전**.

**실기기 app335 합격선**
1. Explore 정상 캐시 상태 → CACHE LIVE 초기화 → 같은 탭 browser reload:
   - Worker **0**, D1 **R0/W0**, Firestore R0/W0.
2. 공개 프로필 동일 방식:
   - Worker **0**, D1 R0/W0.
3. Music Note 동일 방식:
   - publication revision Worker **0**, D1 R0/W0.
4. CACHE LIVE 초기화 버튼/일반 화면 클릭만으로 Worker가 증가하지 않아야 함.
5. 탭을 실제로 다른 곳에 두었다가 다시 보이면 bounded freshness 확인 Worker는 허용.
6. 동일 source private↔public: W2.
7. 실제 Suno 1↔2 source swap: 현재 W3 known FAIL로 기록, 다음 compatibility 설계 대상.

**릴리스 안전**
- obsolete `preview-033-explore-feed-revision.yml`의 preview auto-deploy job을 비활성화. 옛 preview-only D1/R2 binding으로 우회 배포하지 못하게 함.
- TEST/main 승격 없음.
- PRODUCTION 변경 없음.

## 0OH. PREVIEW app334 배포 완료 — 변경 없는 새로고침 Worker 반복 호출 차단 + 동일 source 재공개 W3 오분기 수정 (2026-10-04 KST)

**사용자 실기기 문제**
- Explore 새로고침, 공개 프로필 새로고침, Music Note 새로고침에서 D1은 R0/W0인데 Cloudflare Worker 요청이 매번 증가.
- 동일 Suno source 그대로 private→public 재공개에서도 source 변경으로 오판되어 D1 billable W3가 발생.
- never-published 첫 공개는 migration 후 W18→W12로 감소했지만 여전히 hard gate FAIL.

**app334 변경**
- Explore Feed:
  - 기존 2분 revision check 시각을 localStorage에 유지하여 browser reload가 check window를 초기화하지 않음.
  - 1분 feed-revision response cache를 reload에서도 그대로 존중; app211의 reload 강제 bypass 제거.
- Explore 개인 좋아요:
  - 기존 5분 `/v1/me/likes-revision` check 시각을 UID별 persistent timestamp로 유지.
  - 실패 30초 retry 의미는 유지.
  - 좋아요 mutation/하트/공개 숫자 authority는 변경 없음.
- 공개 프로필:
  - browser reload라는 이유만으로 60초 `validatedAt` window를 무시하던 app211 forced revalidation 제거.
  - 기존 profile mutation/invalidation 및 정상 background revalidation 유지.
- Music Note 공개상태:
  - `/v1/me/music-note-publications-revision` 검증 시각을 UID별 persistent timestamp로 유지.
  - healthy cached reload는 60초 window 안에서 Worker 재호출하지 않음.
  - pending publication outbox는 기존 safety path 유지.
- Explore 관리권한:
  - `/v1/me/explore-management-access` 결과를 UID + local role signature 기준 5분 durable cache.
  - 서버 authorization 자체는 변경 없음.
- 동일 source 재공개:
  - `selectionChanged`를 background Music Note snapshot 비교가 아니라 **공개 dialog를 연 뒤 사용자가 실제 1↔2 선택을 바꿨는지**로 판정.
  - 같은 source private→public은 visibility-only 경로로 고정 목표 W2.
  - 실제 1↔2 변경 기능은 그대로 유지.

**변경 파일**
- `src/pages/ExplorePage.tsx`
- `src/pages/FavoritesPage.tsx`
- `src/services/exploreRevisionRequestCache.ts`
- `src/services/exploreProfileFirstViewService.ts`
- `src/services/exploreLikeService.ts`
- `src/services/explorePublicationService.ts`
- `src/services/exploreCurationService.ts`
- `scripts/verify-110-explore-liked-public-count.mjs`
- `scripts/verify-127-atomic-personal-like.mjs`
- `scripts/verify-154-cross-account-like-sync.mjs`
- `scripts/verify-203-explore-action-visual-publication.mjs`
- `scripts/verify-211-cross-device-publication-refresh.mjs`
- `public/app-version.json`
- release trigger files.

**검증**
- 최종 Release System Audit Run `37145212030`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static groups / syntax / final guards PASS.
  - release-system verification PASS.
  - app164 like candidate regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 preflight / diagnostics read-only PASS.
- 이전 audit Runs `37144785554`, `37144962795`, `37145090204`는 제품 TypeScript/Build 오류가 아니라 app334 의도 변경을 아직 옛 형태로 검사하던 legacy verifier assertion을 순차 정렬하는 과정에서 FAIL. 최종 verifier와 전체 audit은 PASS.

**PREVIEW 배포**
- Firebase PREVIEW Release Run `37145418195`: **SUCCESS**.
- locked PREVIEW source: `e9fd3d537cf477e393c9cb0a7e038917dc02b6a0`.
- `preview.soridraw.com` app **334**.
- PREVIEW exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker 재배포 없음.
- Functions / Firestore Rules / D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**실기기 검증 전 목표**
- 정상 캐시 + 변경 없음 Explore reload: Worker 0 / D1 R0 W0.
- 정상 캐시 + 변경 없음 공개 프로필 reload: Worker 0 / D1 R0 W0.
- 정상 캐시 + 변경 없음 Music Note reload: publication revision Worker 0 / D1 R0 W0.
- 동일 source registered private→public: D1 billable W2 / Firestore W0.
- 실제 Suno source 1↔2 변경: 기능 유지. 현재 D1 W3 하위호환 floor는 별도 비용 최적화 대상.
- never-published first publication: 현재 실측 W12 HARD FAIL 유지. 이번 app334 client pass에서는 schema/trigger 추가 변경 안 함.

**주의**
- app334로 처음 진입한 직후에는 각 persistent validation timestamp를 처음 seed하기 위한 기존 bounded Worker validation이 1회 있을 수 있음.
- 그 뒤 freshness window 안의 단순 reload가 Worker를 다시 증가시키지 않는지가 이번 실기기 핵심 합격선.
- Worker 0을 위해 PC↔모바일 동기화/좋아요/공개상태 freshness 기능을 제거하지 않음.

## 0OG. Refresh Worker fanout confirmed across Explore / public profile / Music Note (2026-10-04 KST)

**사용자 실기기 영상**
- Explore 새로고침/재진입:
  - D1 rows는 R0/W0 유지.
  - 그러나 Worker 요청이 누적됨.
  - CACHE LIVE에서 반복 확인된 주요 경로:
    - `/v1/me/explore-management-access`
    - `/v1/me/likes-revision`
    - feed/public-profile revision 계열 conditional 요청.
- 공개 프로필:
  - warm cache가 있어도 browser reload에서 conditional profile validation Worker 1회가 발생.
  - 현재 코드 `src/services/exploreProfileFirstViewService.ts`의 app211 계약이 reload이면 60초 window 안에서도 강제 revalidation하도록 되어 있음.
- Music Note 새로고침:
  - `/v1/me/music-note-publications-revision`이 reload마다 다시 Worker를 호출.
  - 사용자 영상에서 Worker 1 → refresh 후 Worker 2, D1 R0/W0.
  - 원인: `publicationServerValidatedUids`가 메모리 Set이라 브라우저 reload 때 초기화되고, persistent cache가 있어도 다시 revision route를 호출.

**판정**
- 현재 구조는 D1 read/write 0 최적화에는 성공했지만 **브라우저 새로고침을 Worker 호출과 분리하지 못함**.
- 데이터 변경 없는 reload가 반복될 때 Worker 요청 수가 사용자 reload 횟수에 비례하므로 SORIDRAW 장기 비용 목표에는 미달.
- 이 문제는 D1 rows 비용과 별도인 Cloudflare Worker 요청 비용 문제로 기록.
- 다만 cross-device freshness를 잃기 위해 revision 검사를 무조건 삭제하는 수정은 금지. refresh 자체가 아니라 실제 sync cadence / change signal에 묶어야 함.

**수정 방향**
1. Explore management access는 매 reload auth Worker 조회 대신 durable local permission snapshot + 명시 invalidation/TTL 사용.
2. likes revision은 in-memory check timestamp를 reload-persistent timestamp로 바꾸어 반복 reload가 5분 window를 리셋하지 않게 함.
3. Music Note publication revision도 persistent validation timestamp/revision을 사용해 reload가 검증 상태를 잃지 않게 함.
4. public profile의 app211 forced reload revalidation 제거 또는 persistent validation window로 대체.
5. 정상 cached reload 목표: Worker 0 / D1 R0 W0.
6. cross-device 변경 감지는 기존 요구 시간 안에서 유지하며, 페이지 reload 자체를 change-check trigger로 사용하지 않음.

## 0OF. never-published 첫 공개 실기기 비용 W12 — migration 후 감소했지만 HARD FAIL (2026-10-04 KST)

**사용자 실기기 CACHE LIVE**
- 완전히 새로운 Music Note 곡 최초 공개 1회.
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request rows: **R7 / W12**.
- Browser SDK: R0 / W0.
- Firestore: R0 / W0.
- PAGE SYNC: D1 R0 / W0.

**판정**
- migration 전 사용자 실측 W18 대비 **W18 → W12**로 6 rows 감소.
- 하지만 SORIDRAW hard gate는 사용자 action 1회 W1~W2이므로 **W12는 명확한 FAIL**.
- 사전 예상 W10 전후보다도 2 rows 높음. 추정으로 다음 migration을 밀어붙이지 않고 post-migration live Insights/read-only schema audit로 남은 fanout을 정확히 분해해야 함.
- R7은 전체곡 수에 비례한 폭주 수치는 아니지만 first-publication 1회에서 W12가 남아 있으므로 비용 최적화 미완료.

**현재 우선순위**
1. 동일 source private→public false source-refresh W3 버그 수정.
2. first publication W12의 남은 write fanout을 read-only로 분해.
3. canonical tracks insert에 꼭 필요한 index와 TEST/PRODUCTION 호환 derived/revision write를 구분.
4. 기능/검색/하위호환을 깨지 않는 범위에서 두 번째 schema/trigger compaction 후보를 설계.
5. 사용자 row 삭제/backfill/rewrite 없이 진행.

## 0OE. CORRECTION — same-source private→public W3 is FAIL, not ignorable (2026-10-04 KST)

**사용자 영상 재판독**
- 같은 곡/같은 선택 Suno source로 시작.
- 1차 public→private 완료: CACHE LIVE D1 query R0/W1, billable rows **R3/W2**, Firestore W0 → **PASS**.
- 진단 초기화 후 같은 곡을 다시 공개. 영상에서 공개 모달의 선택 source는 이전과 동일했으며 별도 source 변경 없음.
- 2차 private→public 완료: CACHE LIVE D1 query R3/W1, billable rows **R11/W3**, Firestore W0 → **FAIL**.
- 완료 토스트가 `선택한 곡으로 Explore에 다시 공개했습니다.`로 표시되어, 같은 source 재공개가 visibility-only가 아니라 `selectionChanged`/source refresh 분기로 잘못 들어간 정황과 일치.

**판정 정정**
- `행 R11 / W3`는 무시 대상이 아니다. D1 비용 판단에서 billable row read/write가 핵심 계측값이다.
- SORIDRAW hard gate는 사용자 동작 1회 **W1~W2만 PASS**. 같은-source 재공개 W3는 불합격.
- 직전 0OD의 “source-swap W3 PASS” 표현은 최종 비용 합격 의미로 사용하지 않는다. 실제 source swap W3는 하위호환 구조의 현재 관측 floor일 뿐이며 최종 hard gate 기준으로는 여전히 승격 불가.
- 이번 영상의 W3는 실제 source swap도 아니므로 더 명확한 회귀/오분기다.

**다음 수정 범위**
- 정상 public→private W2 경로는 건드리지 않는다.
- registered private→public에서 사용자가 source를 바꾸지 않았으면 반드시 visibility-only 경로로 고정하여 W2 복구.
- app332의 최신 media identity guard가 local-first draft보다 늦은/stale favoritesStore snapshot에 의해 다시 뒤집히는지 우선 확인.
- 실제 source 변경과 동일-source 재공개를 분리한 회귀 테스트 추가.
- 좋아요/저장 하트/폴더/Split/프로필/Music Note 60초 저장은 변경 금지.
- TEST / PRODUCTION 승격 금지.

## 0OD. app333 + shared D1 migration 실기기 source-swap 비용 검증 PASS (2026-10-04 KST)

**사용자 실기기 영상/CACHE LIVE**
- 공개 설정에서 실제 선택 Suno 곡을 변경한 뒤 Explore에 다시 공개.
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request total: R11 / **W3**.
- Browser SDK: R0 / W0.
- Firestore: R0 / **W0**.
- PAGE SYNC: D1 R0 / W0.
- 완료 토스트 정상 확인.

**판정**
- app333 목표였던 **실제 source swap = Worker 1회 + 즉시 Firestore favorites W0 + D1 W3**를 실기기에서 확인: **PASS**.
- migration 전 source media UPDATE W4 기준에서 W3으로 감소 확인.
- 현재 W3는 TEST/PRODUCTION 하위호환을 위한 canonical tracks + derived media + shared revision 구조의 안전 floor로 유지.
- 영상 중 요청 완료 전에 CACHE LIVE 초기화를 눌렀으나, 완료 후 W3가 초기화 이후 독립 실행으로 기록되어 source-swap 최종값 판정에는 영향 없음.

**남은 비용 검증**
- registered public→private W2.
- registered private→public W2.
- allow_next_song_apply W2.
- allow_follower_save W2.
- profile_pinned W2.
- never-published first publication W10 전후 목표 exact 실측.

**변경 없음**
- 코드 / Hosting / Worker / Functions / Rules / D1 schema 추가 변경 없음.
- 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.

## 0OC. Shared D1 publication write-fanout compaction applied — user-approved migration (2026-10-04 KST)

**사용자 승인**
- 공유 D1 인덱스/구조 변경 migration을 명확히 승인.
- 목표: 공개/비공개, 공개 source 변경, 공개 설정 옵션, 최초 공개의 D1 rows_written을 가능한 안전 최저선까지 축소.
- 사용자 row 삭제/백필/변환/덮어쓰기 금지 유지.

**사전 read-only 감사**
- Run `37141297366`: **SUCCESS**.
- 현재 Music Note first-publication track UPSERT D1 Insights: 평균 `rows_written=16`.
- source media UPDATE: 평균 `rows_written=4`.
- `profile_pinned` UPDATE: `rows_written=3`.
- `allow_next_song_apply` / `allow_follower_save`: `rows_written=2`.
- public/private visibility: `rows_written=2`.
- owner별 tracks: 최대 **42**, 평균 **22**.
- public profile fallback은 `idx_tracks_owner_latest` + 임시 정렬로 정확히 처리 가능.
- owner + source_type 조회는 이미 `idx_tracks_owner_source` 사용.
- 실제 title fallback 검색은 `idx_tracks_latest_order`를 사용하며 `idx_tracks_title`을 사용하지 않음.
- Music Note 66 rows 중 non-empty `legacy_global_id` = **0**.
- PREVIEW/main/production Worker 모두 제거 대상 index를 `INDEXED BY`로 강제하지 않음.

**적용한 shared D1 변경**
Migration:
- `cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_compaction.sql`
- rollback:
  `cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_rollback.sql`

제거:
- `idx_tracks_owner_suno_url`
- `idx_tracks_source_type_latest`
- `idx_tracks_owner_profile_order`
- `idx_tracks_title`
- full `idx_tracks_legacy_global`

대체:
- `idx_tracks_legacy_global_nonempty`
  - non-empty legacy id에 대해서만 UNIQUE 유지.
  - Music Note의 null legacy id는 더 이상 index row를 만들지 않음.

Music Note derived insert:
- `explore079_music_note_derived_track_insert`는 missing derived profile 복구 기능은 유지.
- obsolete `track_count = track_count + NEW.active` write 제거.
- PREVIEW/TEST/PRODUCTION의 `derivedProfile032`가 이미 canonical `COUNT(*) FROM tracks`를 사용하므로 표시 의미 변경 없음.

**실제 migration 결과**
- Apply Run `37141622358`: **SUCCESS**.
- static migration verifier PASS.
- guarded live read-only preflight PASS.
- migration PASS.
- postflight D1 `PRAGMA quick_check` PASS.
- tracks / explore_derived_tracks / explore_derived_profiles row count 전후 동일 PASS.
- TEST/PRODUCTION query compatibility PASS.
- rollback 실행되지 않음.
- 사용자 데이터 row 삭제 / backfill / rewrite: **0**.
- Worker / Hosting / Functions / Firebase Rules / RTDB Rules 변경 없음.
- 현재 PREVIEW 앱은 계속 **app333**이며, 이번 변경은 shared D1 schema/trigger만 적용됨.

**예상 정상 mutation 비용 — 다음 실기기 검증 대상**
- 동일곡 public↔private: **W2 유지**.
- 다음곡 적용 허용: **W2 유지**.
- 팔로워 곡 저장 허용: **W2 유지**.
- 공개 프로필 고정: **W3 → W2 목표**.
- 실제 Suno source swap: **W4 → W3 목표**.
  - tracks canonical 1 + derived media row 1 + shared revision 1이 하위호환 최소 구조.
- never-published 첫 공개: current Insights W16 기준 **약 W10 목표**.
  - 이전 사용자 실측 W18 기준이면 약 W12 수준 가능.
  - exact 실측 필요.

**현재 하위호환 한계**
- source swap을 W2 이하로 만들려면 media-only `explore_derived_tracks` 갱신 또는 shared revision 중 하나를 제거해야 함.
- 그러나 현재 TEST/PRODUCTION cold recovery가 shared revision + derived row를 사용하므로 지금 제거하면 다른 환경이 오래된 공개 미디어를 볼 수 있음. **현재 안전 floor는 W3**.
- first publication W1~W2는 현재 shared `tracks` + feed/profile recovery index 구조와 동시에 달성 불가.
- W10 아래로 크게 내리려면 TEST/PRODUCTION까지 새 canonical 구조를 읽도록 코드 승격한 뒤 legacy index/derived compatibility layer를 단계적으로 종료해야 함.

## 0OB. PREVIEW app333 배포 완료 — 공개 source 변경 1회 Worker + 즉시 Firestore write 제거 (2026-10-04 KST)

**목표**
- 기존 정상 공개/비공개 W2 경로는 보호.
- 공개된 곡에서 Suno 1↔2 선택 변경 시 app332에서 관측된 `favorites:write 1` + Worker 2회 누적 D1 W6 경로를 축소.
- 공개 설정 3개 옵션의 현재 최소비용 경로를 보호하고, 첫 공개 W18은 호환성/스키마 문제와 분리.

**app333 변경**
- Suno 공개곡 선택 변경 시 더 이상 `updateFavorite(...)`로 Firestore favorites 문서를 즉시 쓰지 않음.
- 선택 변경은 기존 Music Note local-first draft에 합류하며 canonical Firestore 저장은 기존 묶음/page-exit 경로가 담당.
- PC↔모바일 즉시 미디어 미리보기는 기존 bounded RTDB delta를 유지.
- 선택된 Suno media(cover/duration/primary/secondary URL)를 Explore Worker 요청에 직접 포함.
- Worker는 새 app333 요청에서는 media 확인을 위한 Firestore favorites 재읽기를 생략하고, 구버전 요청에만 기존 Firestore fallback을 유지.
- 기등록 source swap과 never-published 첫 공개 모두 선택한 media를 동일 Worker 요청에서 사용하도록 정합화.
- 좋아요 / 저장 하트 / 폴더 / Split / 프로필 / 공개 옵션 UI 변경 없음.

**검증 / 배포**
- 제품/Worker audited source: `be803b450e14c3d356aab905620c2712461566b5`.
- canonical Worker SHA256: `fbcc7a525393078f762965853d2b4cbc92a5b3ede16c314a3e6348a45a69aae3`.
- Release System Audit `37140228404`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - app333 publication cost guards PASS.
  - existing publication / like / profile / cache regressions PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 checks read-only PASS.
- Cloudflare PREVIEW Worker Release `37140381356`: **SUCCESS**.
  - locked source `be803b450e14c3d356aab905620c2712461566b5`.
  - deployed version `0f4e7ac6-2baa-442c-87cc-dbb6e640206b`.
  - TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
  - PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase PREVIEW Release `37140463309`: **SUCCESS**.
  - locked source `8364a888340b33791fa8c1989b260da6c0946b58`.
  - `preview.soridraw.com` app **333**, exact build PASS.
  - shared RTDB Rules SKIPPED.
  - TEST / PRODUCTION unchanged PASS.
- Functions / Firestore Rules / RTDB Rules / D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**현재 비용 판정**
- 동일곡 registered public↔private: 실측 D1 billable W2 / Firestore W0 — 현재 하위호환 구조의 합격 경로, 보호.
- 공개 설정에서 값 변경 없음: local/outbox net-zero로 server write 0 유지.
- `다음곡에 적용 허용` / `팔로워 곡 저장 허용`: canonical tracks + 구 TEST/PRODUCTION 호환 shared revision 때문에 D1 W2가 현재 안전 최저선.
- `공개 프로필에 고정`: `profile_pinned`이 `idx_tracks_owner_profile_order`에 포함되어 실측 W3. **hard gate FAIL**이며 코드만으로 W2 이하 보장 불가.
- 실제 Suno source swap: app333은 즉시 Firestore W1과 두 번째 Worker 원인을 제거했지만 D1 media UPDATE 자체는 `idx_tracks_owner_suno_url` 유지비 때문에 기존 Insights 기준 W4 가능. **실기기 재측정 전**.
- never-published 첫 공개: `tracks` 9개 secondary index + trigger/구환경 호환 구조로 실제 W18. **이번 코드 수정으로 D1 W18 자체는 감소하지 않음 / hard gate FAIL**.

**다음 비용 단계 — D1 schema 변경 전 승인 필요**
- `idx_tracks_owner_suno_url (owner_uid, suno_url_primary)`는 현재 PREVIEW/main/production Worker 코드 검색에서 조회 조건으로 사용되는 경로를 찾지 못했으며 source swap W4의 유력한 추가 row-write 원인.
- `idx_tracks_owner_profile_order (owner_uid, profile_pinned, published_at, id)`는 pin W3의 추가 write 원인.
- 두 index의 제거/대체는 비용 절감 가능성이 있으나 shared D1 schema migration이므로 별도 guarded preflight + TEST/PRODUCTION query-plan 호환성 확인 + 사용자 승인 없이 실행 금지.
- first publication W18→W1~W2는 단순 UI/Worker 수정으로 불가능. 기존 TEST/PRODUCTION이 같은 canonical `tracks`를 읽는 동안에는 index/trigger fanout을 유지해야 하므로 하위호환 canonical 구조 재설계가 필요.

## 0OA. PREVIEW app332 배포 완료 — 동일곡 공개/비공개 stale media 판정 차단 (2026-10-04 KST)

**사용자 지시**
- app331 실기기에서 동일곡 공개/비공개인데도 간헐적으로 Firestore `favorites:write 1` + D1 W4가 발생하는 비용 분기만 수정.
- 좋아요 / 저장 하트 / 폴더 / Split / 프로필 / Worker / D1 schema 등 다른 정상 기능은 변경 금지.

**원인 / 수정**
- 공개 설정 dialog가 오래된 Music Note row 객체를 들고 있으면 `mainSunoIndex`가 현재 로컬 최신 선택과 달라져, 실제로 곡을 바꾸지 않아도 `selectionChanged=true`가 될 수 있었음.
- app332는 dialog open과 submit에서 `favoritesStore`의 최신 Music Note snapshot을 우선 사용.
- 선택 변경 판정은 stale 숫자 index 비교가 아니라 **실제 선택 Suno URL vs 최신 main Suno URL** 비교로 변경.
- 같은 URL이면 source-media refresh를 타지 않고 기존 visibility-only 공개/비공개 경로 유지.
- 실제 다른 Suno URL을 선택한 경우에만 기존 `updateFavorite + refreshExploreMusicNotePublicationSource` 경로 유지.
- backend / Worker / D1 trigger / schema / Firestore 구조 변경 없음.

**변경 파일**
- `src/pages/FavoritesPage.tsx`
- `scripts/verify-203-explore-action-visual-publication.mjs`
- `public/app-version.json`
- release trigger files only.

**기준 / 검증 / 배포**
- 제품 수정 commit: `7085b03c3013c60fdbebb441901832e5ba2b1255`.
- verifier commit: `3d9da23bef8bc20288788d3e42c5f81ea056207c`.
- audited app332 source: `083d4310059ee27cb225ddf1578340ec3219278a`.
- Release System Audit Run `37138323981`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static groups / release verification PASS.
  - existing like regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 checks read-only PASS.
- Firebase PREVIEW Release Run `37138464737`: **SUCCESS**.
  - PREVIEW Hosting PASS.
  - exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules release not requested.
- PREVIEW app version: **332**.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**실사용 합격선**
1. 같은 Suno 곡 그대로 private→public: Firestore W0, D1 W1~W2.
2. 같은 Suno 곡 그대로 public→private: Firestore W0, D1 W1~W2.
3. 위 동작 반복에서도 `favorites:write 1`이 나타나면 FAIL.
4. 실제 다른 Suno 곡으로 변경: 기존 source-media swap 경로 유지. 현재 W4는 별도 비용 최적화 대상이며 이번 수정 범위 아님.
5. never-published 첫 공개 W18도 별도 문제로 이번 수정에서 건드리지 않음.

## 0NZ. app331 실기기 공개 비용 분기 확인 — W2/W4가 랜덤이 아님 (2026-10-04 KST)

**사용자 실기기 CACHE LIVE 결과**
- 비공개 전환: Cloudflare D1 query `R3 / W1`, billable row `R3 / W2`, Browser SDK `R0 / W0`.
- 공개 실행 중 Firestore `favorites:write 1`이 동반된 케이스: D1 billable row `R11 / W4`.
- 공개 상태에서 다른 Suno 곡으로 전환: Firestore `favorites:write 1` + D1 billable row `R11 / W4`.
- 같은 공개/비공개 동작 중 media/main 선택 변경이 없는 저비용 케이스: Browser SDK `R0 / W0`, D1 billable row `R5 / W2`.

**코드 대조 결과**
- app331 `FavoritesPage.tsx`는 `selectionChanged`일 때 먼저 `updateFavorite(...)`로 Music Note 메인 Suno 선택을 Firestore에 기록한 뒤 `refreshExploreMusicNotePublicationSource(...)`를 호출한다.
- 이 경로가 실기기에서 `favorites:write 1` + D1 `W4`와 정확히 일치한다.
- 선택곡 변경이 없는 기등록 private→public / public→private는 `setExploreTrackVisibility(...)`의 좁은 visibility 경로를 사용하며 W2 실측과 일치한다.
- 따라서 W2/W4 차이는 무작위 변동이 아니라 **source-media 선택 변경 여부에 따른 서로 다른 mutation 경로**다.
- 단, 사용자가 실제로 곡을 바꾸지 않았는데도 `favorites:write 1 / W4`가 발생한다면 `selectionChanged`가 stale Music Note row를 보고 잘못 true가 되는 별도 클라이언트 버그로 판정한다.

**현재 판정**
- 기등록 곡의 순수 공개/비공개 W2: PASS.
- 실제 다른 Suno 곡 source-media swap W4: hard gate FAIL.
- never-published 첫 공개 W18: 기존과 동일하게 FAIL.
- 다음 비용 수정은 UI가 아니라 W4 media swap과 W18 first-publication write/index fanout을 분리해 줄여야 한다.
- 좋아요 app164/160, 저장 하트 app302, 폴더 app301, Split app303, 프로필 정상 경로는 변경 금지.

## 0NY. app330 실기기 공개 비용 재진단 — 첫 공개 W18 원인 고정 (2026-10-04 KST)

**사용자 실기기**
- 사용자가 비공개 Music Note에서 `공개`를 누른 실제 영상 기준, 기존 app329 UI는 서버 완료까지 공개 모달이 약 16~18초 동안 busy 상태로 남았음.
- 같은 실행의 CACHE LIVE: D1 query `R3 / W1`, billable row `R8 / W18`.
- app330은 이 대기 UX를 서버 처리와 분리해 공개 클릭 즉시 로컬 공개 상태 반영 + 모달 닫힘으로 수정/배포 완료.

**W18 read-only 실DB 진단**
- Read-only shared D1 schema inspection Run `37135568537`: SUCCESS, `REMOTE_D1_WRITES=0`.
- Read-only D1 Insights Run `37135908156`: SUCCESS, `REMOTE_D1_INSIGHTS_READONLY=PASS`.
- 현재 `tracks`에는 secondary index 9개가 존재하며, D1 `rows_written`은 table row뿐 아니라 index row 유지비까지 포함한다.
- 지난 1일 actual D1 Insights:
  - 첫 공개/full publication UPSERT: **avgRowsWritten 16** (`numberOfTimesRun=10`, total 162).
  - app329 media-only source refresh: **avgRowsWritten 4** (1회 측정).
  - 등록된 Music Note 공개/비공개 visibility narrow UPDATE: **avgRowsWritten 2** (1회 측정).
- 즉 CACHE LIVE의 W18은 “W1 쿼리 하나가 공짜에 가까운 1행”이라는 뜻이 아니라, 첫 공개 full UPSERT + index/trigger fanout이 실제 row-write 비용을 만든 결과다.
- app329 media trigger 최적화는 동작하고 있으나, 첫 공개 full canonical registration 비용에는 적용되지 않는다.

**판정**
- 공개/비공개 **기등록 곡 visibility 전환 W2는 합격선**.
- media-only source swap **W4는 W1~W2 hard gate 미달**.
- 첫 공개 **W18은 불합격**.
- 첫 공개를 현재 `tracks` + 기존 검색/소유자/feed용 index 구조 그대로 유지하면서 W1~W2라고 보고해서는 안 됨.
- 다음 비용 작업은 UI나 계측값을 숨기는 수정이 아니라, first-publication canonical write/index 구조를 하위호환 방식으로 재설계해야 함. TEST/PRODUCTION 기존 코드가 shared canonical data를 계속 읽을 수 있어야 하므로 무검증 index drop 또는 PREVIEW-only canonical table 전환 금지.

## 0NX. PREVIEW app330 배포 완료 — Music Note 공개/저장 즉시 UI 반응 (2026-10-04 KST)

**현재 기준**
- 작업 branch: `preview`.
- 제품 수정 기준: `7af56bc0398017baccc74d729738df471b4e67c5`.
- app330 버전 기준: `57d6ccfa7f3d65557f03267754d5e4d944ab9a42`.
- Firebase PREVIEW 배포 locked source: `0399644d0cddcc7097abdccb2f639c9234013961`.
- 앱 버전: **330**.
- TEST / PRODUCTION은 비변경.

**사용자 실기기 문제**
- app329에서 공개/설정 저장 버튼을 누른 뒤 서버 반영이 끝날 때까지 팝업이 오래 남아 있어 공개 동작이 느리게 보임.
- 사용자 영상에서는 저장 후 화면 닫힘까지 긴 대기 구간이 확인됨.

**app330 수정**
- Music Note 공개/설정 저장 시 서버 완료를 기다리기 전에 즉시 로컬 공개 상태를 반영하고 팝업을 닫음.
- 기존 Firestore / Explore Worker 반영은 동일한 기존 경로로 뒤에서 계속 수행.
- 서버 반영 실패 시 화면의 공개 상태를 정확한 이전 상태로 되돌리고 기존 오류 안내를 표시.
- 중복 클릭 방지 busy guard는 서버 완료까지 유지.
- 공개곡 Suno 1/2 선택, app329 media-only refresh, 기존 공개 옵션 3개와 비공개 전환은 구조 변경 없음.

**검증 / 배포**
- Release System Audit `37135125184`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 기존 publication / like 등 Release regression PASS.
  - app330 즉시 UI 반응 verifier 추가 및 PASS.
- Firebase PREVIEW Release `37135265146`: **SUCCESS**.
  - `preview.soridraw.com` app **330**.
  - exact build PASS.
  - shared RTDB Rules **SKIPPED**.
  - TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.

**비용 / 데이터**
- 이 수정은 UI 반응 순서만 바꾼 것으로 기존 공개 서버 호출 수와 D1 mutation 경로를 늘리지 않음.
- 사용자 데이터 migration / backfill / delete 없음.
- app329의 실제 source-media swap D1 W1~W2 hard gate는 그대로 유지하며, 실기기 비용 재측정은 아직 필요.

**실사용 확인 필요**
1. 공개 또는 공개 설정 저장을 누르는 즉시 팝업이 닫히고 공개 상태가 바로 보이는지.
2. Suno 1/2 선택 변경 후에도 즉시 닫히는지.
3. 서버 반영 후 같은 곡의 실제 공개 미디어가 정확한 선택곡인지.
4. 실패 상황에서 거짓 공개 상태가 남지 않고 이전 상태로 복구되는지.
5. CACHE LIVE에서 실제 source swap 1회 D1 `rows_written` W1~W2인지.
6. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 회귀 없음.

## 0NW. PREVIEW app329 배포 완료 — Explore 공개 설정 수노곡 선택 + 선택곡 미디어 저비용 갱신 (2026-10-04 KST)

**현재 기준**
- 작업 branch: `preview`.
- 앱 PREVIEW 배포 기준: `fa54c6d37ba002654998ac05af72c6e4d781d3f5`.
- Worker 감사/배포 기준 source: `1e6b2011e77933db3b4e44f8b55dffdd00374a12`.
- 앱 버전: **329**.
- TEST / PRODUCTION은 비변경.

**사용자 요청 반영**
- Explore에서 본인 공개곡의 `공개 설정`을 열었을 때, 원본 Music Note에 Suno URL 2곡이 있으면 두 곡을 좌/우 카드로 표시.
- 1번/2번 중 실제 공개에 사용할 곡을 선택 가능.
- 카드 선택만 바꿀 때는 로컬 UI만 변경하고 서버 요청 없음.
- 이미 공개된 동일 track에서 선택곡을 바꾸고 저장하면 새 공개곡을 복제하지 않고 **기존 동일 공개 track의 미디어 원본만 갱신**.
- 기존 공개 옵션 3개 / 비공개 전환 / 좋아요 / 폴더 / Split / 프로필 UI는 보호.

**검증**
- 최종 Release System Audit `37133838966`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Static release verification PASS.
  - 기존 Like regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- canonical PREVIEW Worker hash: `81609d11c7de425cbb496b964a0f2e5e43673a3019d9be6d94d64c56fe130730`.

**공유 D1 안전 변경**
- app329 전용 trigger migration: `20261004_01_publication_media_source_cost.sql`.
- Guarded D1 migration Run `37133356419`: **SUCCESS**.
  - 기존 app080 trigger 상태에서 app329 trigger로 정상 승격.
  - canonical `tracks` 사용자 행 변경 없음.
  - `explore_derived_tracks` 기존 행 변경 없음.
  - `USER_ROW_MUTATION=0`.
  - shared revision trigger 비변경.
  - PREVIEW / TEST / PRODUCTION Worker 버전은 migration 중 비변경.
  - main / production refs 비변경.
- 작업 완료 후 일회성 migration workflow/trigger 파일은 제거함.

**Cloudflare PREVIEW Worker**
- PREVIEW Worker Release `37133979250`: **SUCCESS**.
- locked source: `1e6b2011e77933db3b4e44f8b55dffdd00374a12`.
- deployed Worker version: `c0ff8eeb-5d61-4496-9806-714b2037fb99`.
- publication / like / cache regression 및 one-shot preflight PASS.
- TEST / PRODUCTION Workers unchanged PASS.
- Functions 변경 없음.

**Firebase PREVIEW**
- Firebase PREVIEW App Release `37134047300`: **SUCCESS**.
- locked source: `fa54c6d37ba002654998ac05af72c6e4d781d3f5`.
- `preview.soridraw.com` app **329**, exact build PASS.
- shared RTDB Rules: **SKIPPED**.
- Firestore Rules / RTDB Rules / Functions 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**비용 구조**
- 2곡 카드 표시/선택 자체: 추가 서버 read/write 없음.
- 실제 선택곡 변경 저장 시 전체 Feed/공개프로필 scan/rebuild 없이 해당 Music Note/해당 공개 track만 처리하는 bounded O(1) 경로.
- Worker는 `refreshSourceMedia`에서 해당 Music Note 원본을 정확히 읽고 cover/duration/Suno URL 필드만 좁게 갱신.
- D1 trigger는 media-only 변경이면 해당 `explore_derived_tracks` 1행의 `row_json`만 patch하고, 넓은 콘텐츠 변경일 때만 기존 호환 full upsert 경로를 유지.
- **실제 사용자 선택 변경 1회의 live D1 `rows_written` W1~W2는 아직 실사용 측정 전. 미검증 상태이며 hard gate 유지.**

**사용자 데이터 변경**
- migration/backfill/delete 없음.
- trigger DDL만 변경.
- trigger 변경 당시 canonical / derived 사용자 행 변경 0 확인.

**실사용 확인 필요**
1. Explore에서 본인 공개곡 → 공개 설정 → Suno 2곡 카드가 정확히 표시되는지.
2. 1번/2번 선택 표시 및 미리보기 정보가 맞는지.
3. 이미 공개된 곡에서 다른 Suno 곡 선택 후 저장 → 동일 공개 track의 커버/재생 URL/길이가 새 선택곡으로 갱신되는지.
4. 기존 공개 옵션 3개와 비공개 전환 회귀 없음.
5. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 정상.
6. PC / 모바일 팝업 잘림·겹침 없음.
7. 실제 source swap 1회 D1 `rows_written` W1~W2 확인.

## 0NV. PREVIEW app328 배포 완료 — 공개할 수노 곡 선택 + 디테일 지구본 아이콘 (2026-10-03 KST)

**사용자 요청 반영**
- Music Note에 수노 URL 2곡이 연결된 경우, Explore `공개 설정` 팝업 상단에 두 곡을 **좌/우 카드로 표시**.
- 두 카드 중 실제 공개할 곡을 먼저 선택한 뒤 공개/설정 저장 가능.
- 선택만 바꿀 때는 로컬 UI만 변경하며 서버 요청 없음.
- 공개 실행 시 선택한 곡이 기존 Music Note의 메인/1순위 Suno 기준과 일치하도록 `mainSunoIndex` 및 메인 URL/커버/제목/길이 필드를 함께 정합화한 뒤 기존 단일 공개곡 경로로 반영.
- 이미 공개된 곡도 다른 수노 곡을 선택해 저장하면 기존 동일 공개 track을 source-refresh하여 새 선택곡으로 갱신. 별도 공개곡 복제/새 track 생성 없음.
- Music Note Detail에서 삭제 버튼 오른쪽 Explore 공개 버튼의 잠금/해제 아이콘을 **지구본(`Globe2`) 아이콘**으로 교체.
- 기존 공개 옵션 3개, 비공개 전환, 좋아요, 폴더, Split, 프로필 UI는 비변경.

**변경 / 검증 / 배포**
- 제품 구현 commit: `384938dfd40794d4bde1dc94619aa467339eef62`.
- Release System Audit trigger/source: `f7d1de9927be691d844df5949aba4044ad88de80`.
- Final Release System Audit `37106027818`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 기존 Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37106162581`: **SUCCESS**.
  - locked source / release commit: `239d12318d8c980c15b5aa9c80bf3a0b5b4464d9`.
  - `preview.soridraw.com` app **328**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.

**비용**
- 공개 팝업의 2곡 표시/선택은 기존 Music Note 로컬 `sunoLinks`만 사용하므로 선택 UI 자체 추가 DB read/write 없음.
- 선택곡이 기존 1순위와 같으면 기존 공개 비용 경로 그대로.
- 선택곡이 달라 실제 공개하면 Music Note 메인 선택 canonical 변경 W1 + 기존 Explore 단일 publication upsert 경로를 사용.
- D1은 기존 단일 track O(1) 경로를 재사용하며 전체 Feed/프로필 scan/rebuild 추가 없음.
- 실제 선택 변경 후 live D1 `rows_written`은 사용자 실사용 전이라 **미검증**. W1~W2 hard gate는 그대로 유지.

**실사용 확인**
1. 수노 URL 2곡 연결 Music Note에서 공개 설정 → 상단에 두 커버가 좌/우로 보이는지.
2. 1번/2번 곡 선택 표시가 정확히 바뀌는지.
3. 2번 곡 선택 후 공개 → Explore에서 실제 2번 곡이 공개되는지.
4. 이미 공개된 곡에서 다른 곡 선택 후 저장 → 같은 공개곡이 새 선택곡으로 갱신되는지.
5. Detail의 삭제 버튼 오른쪽 아이콘이 지구본인지.
6. PC/모바일 팝업 레이아웃 및 기존 공개 옵션 회귀 없음.
7. live mutation D1 rows_written W1~W2인지.

## 0NU. PREVIEW app327 배포 완료 — 뒤로가기 단독 / 소셜 2배 / 소개 반응형 글자 크기 (2026-10-03 KST)

**적용**
- 프로필 상단 툴바에서 `MY 프로필` 텍스트 제거.
  - 자기/다른 사용자 프로필 모두 뒤로가기 화살표 버튼만 표시.
- 소셜 링크 버튼 확대.
  - PC: 30x30 → **60x60**, 아이콘 16 → **32px**.
  - Mobile: 26x26 → **52x52**, 아이콘 14 → **28px**.
  - 위치는 승인된 대표장르 아래 유지.
- 소개글은 현재 PC 모양을 기준으로 유지하고 화면이 좁아질 때 단계적으로 축소.
  - 1200px 이상: **13px**.
  - 901~1199px: **12px**.
  - 721~900px: **11px**.
  - 481~720px: **10px**.
  - 480px 이하: **9px**.
- 소개 위치는 프로필 사진 아래 왼쪽 열 전용 유지.
- app323 입력 크래시 수정, app322 줄 수 제한 제거, 150자 제한 유지.
- 프로필 저장 API / 미디어 / 좋아요 / 공개·비공개 / 폴더 / Split / 사용자 데이터 비변경.

**검증 / 배포**
- toolbar product: `8306f90beae93d8dbaa4b28a21f4af2c67ccddca`.
- social 2x: `1599647dc67233667abc1cf5664fa5f60dd9932d`.
- responsive bio + historical verifier 정합화: `3ed2451ad4daa01aec0daa49a95bca4477bb5019`, `46e1174cd9c11b859b7ccebed65cf7a5a655054a`.
- app325/app326 중간 Audit은 기존 verifier가 이전 툴바/소셜 크기를 계속 요구해 FAIL했고 제품 TypeScript/Build는 PASS.
- 최종 app327 Release System Audit `37104517413`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Static verification PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37104633865`: **SUCCESS**.
  - locked source / release commit: `86bb1f4b01fe00fd13b33c07391dfcfefd9ab182`.
  - `preview.soridraw.com` app **327**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 상단에 뒤로가기 버튼만 있고 `MY 프로필` 문구가 없는지.
2. 소셜 버튼이 PC/모바일 모두 확실히 커졌는지.
3. PC 소개글 모양은 유지되는지.
4. 화면 축소 시 13→12→11→10→9px로 자연스럽게 줄어 모바일에서도 PC와 비슷한 줄바꿈 밀도를 보이는지.
5. 소개 위치/배경 높이/프로필 저장/입력 크래시 회귀 없음.

## 0NT. PREVIEW app324 배포 완료 — 프로필 공통 높이 / 소개 왼쪽열 / MY 프로필 통일 (2026-10-03 KST)

**사용자 실사용 피드백 반영**
- app323 소개 입력 크래시 수정은 유지.
- 소개글은 더 이상 전체 하단 폭을 사용하지 않음.
  - **프로필 사진 바로 아래 왼쪽 열 내부**에만 배치.
  - 오른쪽 이름/핸들/통계/대표장르/소셜 영역 침범 금지.
  - 줄바꿈은 유지하고 긴 문자열은 왼쪽 열 안에서 줄바꿈.
- 소셜 링크는 사용자가 통과시킨 **대표장르 아래 위치 그대로 유지**.
- 상단 프로필 배경 높이를 자기 프로필뿐 아니라 **다른 사용자 프로필에도 동일 적용**.
  - Tablet 721~1599px: 270px.
  - PC 1600px+: 335px.
  - Mobile: 기존 190px 유지.
- 프로필 상단 툴바 명칭을 자기/타 사용자 구분 없이 **MY 프로필**로 통일.
- 프로필 저장 API / 미디어 업로드 / 좋아요 / 공개·비공개 / 폴더 / Split / 사용자 데이터 구조 비변경.

**변경 / 검증 / 배포**
- 주요 UI commits:
  - page: `60502405d239e14470808eb90a017956c2a5d2bb`.
  - hero CSS: `75c0d12a0c70b46b3d745d3fa6a5d26385d911f2`.
  - bio CSS: `379d7e6b3c680746a70fed60d677c085f75b8d22`.
  - verifier: `c796de08d27484bce0dc2327fa1727e00d9105c3`.
- app324 version commit: `efca071e534a50bac787336279af38ec4179af0d`.
- Final Release System Audit `37103755979`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37103853836`: **SUCCESS**.
  - release commit / locked PREVIEW source: `3dbd9f774c8cef0d39240d4f0a3f7988dc689573`.
  - `preview.soridraw.com` app **324**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 자기/다른 사용자 프로필 모두 같은 상단 배경 높이인지.
2. 상단 툴바가 모두 `MY 프로필`인지.
3. 소개가 프로필 사진 바로 아래 왼쪽 폭에만 존재하고 오른쪽 영역을 침범하지 않는지.
4. 소셜 링크는 대표장르 아래 그대로인지.
5. 소개 입력 크래시 재발 없음 / 줄 수 제한 없음 / 150자 제한 유지.
6. PC/태블릿/모바일 레이아웃 및 기존 이미지 편집/저장 회귀 없음.

## 0NS. PREVIEW app323 배포 완료 — 프로필 소개 입력 크래시 긴급 수정 (2026-10-03 KST)

**문제**
- app322에서 소개 줄 수 제한을 제거하면서 `onChange`의 state updater 내부에서 `event.currentTarget.value`를 읽도록 바뀜.
- React 이벤트 핸들러가 끝난 뒤 updater가 실행될 때 `currentTarget`이 `null`이 되어 `Cannot read properties of null (reading 'value')` 전체 오류 화면 발생.

**수정**
- textarea 값을 이벤트 핸들러 안에서 먼저 일반 문자열 `nextBio`로 캡처한 뒤 state updater에는 문자열만 전달.
- app322의 **줄 수 제한 제거**는 그대로 유지.
- 소개 최대 150자, 입력창 높이/스크롤 방식, 저장 API는 그대로 유지.
- 다른 프로필 기능 / 좋아요 / 공개·비공개 / 폴더 / Split / 서버 구조 비변경.

**검증 / 배포**
- 제품 commit: `2f414d9a55dadcf9778dbaa7765708222b930034`.
- verifier commit: `7b539c25a2dcf7b931d65ff65f6e999739cf5f7d`.
- app323 version: `9c3b89df72b816dede58f4380df1af6fb6108148`.
- Final Release System Audit `37103230539`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression / Worker dry-run / shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37103325505`: **SUCCESS**.
  - locked source / release commit: `4356e3635070a4fb7fe0fc956ea6ef688b5ef634`.
  - `preview.soridraw.com` app323 exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

**남은 프로필 레이아웃 실사용 수정**
- 소개 위치는 현재 전체 하단 폭을 사용 중 → 사용자가 요구한 **프로필 사진 아래 왼쪽 열 전용 영역**으로 옮겨야 함.
- app313/314 높이 조정이 `is-own-profile-313` 범위라 다른 사용자 공개 프로필에는 미적용 상태 → 사용자 요구에 맞춰 동일 높이 적용 범위 재조정 필요.
- 상단 툴바 명칭은 현재 자기 프로필 `MY 프로필` / 타 사용자 `공개 프로필`로 분기 중이며, 사용자 실사용 피드백상 명칭 통일 요구 확인 필요.

## 0NR. PREVIEW app321 배포 완료 — 프로필 소개 4줄/핸들 경고/상단 배치 정리 (2026-10-03 KST)

**적용**
- 고유 핸들 저장 오류 문구를 짧게 변경:
  - `영문 소문자, 숫자, 밑줄만 사용할 수 있으며 3~24자로 입력해주세요.`
- 핸들 오류 표시를 기존 붉은 안쪽 그림자/양끝 표시 대신 **입력창 전체 실제 빨간 테두리**로 변경.
- app320의 자유 입력 방식은 유지: 입력 중에는 대문자/특수문자/한글 등을 강제로 지우지 않고, 저장 시 기존 유효성 검사를 수행.
- 소개는 최대 150자 유지.
- 기존처럼 5번째 Enter에서 뒤쪽 문장을 잘라내지 않도록 **파괴적 줄 자르기 제거**.
- 편집창의 실제 4줄 높이를 넘기는 입력만 그 입력 동작을 받지 않도록 변경하여, Enter 줄바꿈과 자동 줄바꿈을 같은 4줄 화면 기준으로 처리.
- 공개 프로필 상단 배치를 위쪽 정렬로 변경.
- 프로필 사진/핵심 정보는 상단으로 이동.
- 소개는 프로필 사진 아래쪽에서 시작하는 하단 행으로 이동.
- 소셜 링크는 대표 장르 아래로 이동.
- 배경 이미지 높이/크롭/프로필 저장 API/미디어 업로드 구조는 비변경.

**변경 / 검증 / 배포**
- 제품 + verifier commit: `cbf6e3c7fb8176e3cfc636ce75ceed0809d4225e`.
- app321 version commit: `aaaf1521075de38033e7ba74821cc6ead6136baf`.
- 최초 Audit `37098941263`: FAIL — 제품 TypeScript/Build는 PASS였고, 기존 app317 정적 verifier가 예전 explicit-line/scroll 규칙을 계속 요구해 final static 단계에서 실패.
- verifier 정합화: `db4103039197a54598511d98eeb17dd52a899267`.
- 재감사 trigger: `57f6f839810f5037f32c988e8043e1864ba5cc46`.
- Final Release System Audit `37099055378`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37099154060`: **SUCCESS**.
  - release commit / locked PREVIEW source: `a530a84f4c05f2e8c632fba46d0b0851b632e4e3`.
  - `preview.soridraw.com` app **321**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 잘못된 핸들로 저장 시 새 짧은 문구와 입력창 전체 빨간 테두리 표시.
2. 입력 중 문자를 강제로 제거하지 않는 app320 동작 유지.
3. 소개에서 Enter로 5번째 줄을 시도해도 기존 문장이 사라지지 않는지.
4. Enter 없이 길게 입력해 자동 줄바꿈되는 경우에도 4줄 화면을 넘지 않는지.
5. 저장 후 소개 줄바꿈/호흡이 편집창 의도와 일치하는지.
6. 프로필 사진/이름·핸들·통계·대표장르가 상단으로 올라갔는지.
7. 소개가 프로필 사진 아래 공간, 소셜 링크가 대표장르 아래에 배치되는지.
8. PC/모바일에서 배경/이미지 크롭/저장/좋아요/폴더/Split 회귀 없음.

## 0NR. PREVIEW app320 배포 완료 — 소개 줄바꿈 보존 + 핸들 자유 입력/저장 시 검증 (2026-10-03 KST)

**적용**
- app319에서 프로필 소개의 **엔터 줄바꿈을 공개 프로필에서도 그대로 표시**하도록 수정.
  - 편집창에서 Enter로 나눈 줄은 저장 후 공개 프로필에서도 같은 줄바꿈으로 보임.
  - 긴 한 줄 텍스트는 기존처럼 영역 안에서 자동 줄바꿈.
- app320에서 고유 핸들 입력 중의 강제 필터링을 제거.
  - 대문자/소문자/특수문자/한글 등 다른 언어/길이 초과 문자열도 **입력 자체는 막지 않음**.
  - 입력 중 자동 소문자 변환/문자 삭제 없음.
  - 최대 길이 입력 차단도 제거.
- 핸들 저장 조건은 기존 계약 그대로 유지.
  - 영문 소문자, 숫자, 점(.), 밑줄(_)만 허용.
  - 3~24자.
  - 점(.)은 처음/끝/연속 사용 불가.
- 위 조건에 맞지 않는 상태에서 **저장 버튼을 눌렀을 때만** 입력칸 경고 스타일 + 안내문 노출.
- 올바른 값으로 수정하면 경고는 즉시 해제.
- 대표 장르 최대 5개, 소개 150자/4줄, 프로필 사진/배경 크롭 동작은 그대로 유지.

**변경 / 검증 / 배포**
- 소개 줄바꿈 제품 commit: `d9726e9a416e6635658625abf998e19bcd512276`.
- 소개 줄바꿈 verifier: `fc898f0c2fea5acc313b09dfb1dd60f189268952`.
- app319 audit `37096474003`: **SUCCESS**.
- app319 PREVIEW release `37096558530`: **SUCCESS**, app319 exact build PASS.
- 핸들 자유 입력 제품 commit: `84480f57794ff5dd3b7cbad91310cf317f16939f`.
- app320 verifier: `02019b3de5ffc58796f367f4681acdf4a8cb9754`.
- 최초 app320 audit `37096694758`: FAIL — 제품 코드가 아니라 verifier가 unrelated 기존 문자열을 넓게 잡은 정규식 문제.
- verifier fix: `2a027f6c8e7aef1ae0e5eaf5f1ffef525c19e0e8`.
- 최종 audit trigger: `c9f0de49a4aca1c67aa7356dc05dc8fee42f9fe9`.
- Final Release System Audit `37096804790`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37096905327`: **SUCCESS**.
  - locked source `fa23583413a207c716a13333343c6149622917ce`.
  - `preview.soridraw.com` app **320**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 소개 편집창에서 Enter로 2~4줄 작성 후 저장 → 공개 프로필에서 동일 줄바꿈 표시.
2. 핸들에 대문자, 한글, 특수문자를 입력해도 입력 중 삭제/변환되지 않는지.
3. 24자를 넘겨도 입력 자체는 가능한지.
4. 잘못된 핸들 상태에서 저장할 때만 경고문과 붉은 입력 상태가 보이는지.
5. 올바른 영문 소문자/숫자/점/밑줄 3~24자로 고치면 경고가 사라지고 저장되는지.
6. 대표 장르 5개 / 소개 150자·4줄 / 이미지 편집에 회귀가 없는지.

## 0NQ. PREVIEW app318 배포 완료 — 대표 장르 5개 + 소개 150자/4줄 + 핸들 저장 시 경고 (2026-10-03 KST)

**적용**
- 대표 장르 최대 개수를 **4개 → 5개**로 복원.
- 수동 추가 / 최근 10곡 자동 추천 / 저장 / 변경 비교 모두 최대 5개로 통일.
- 소개 글자 수를 **최대 150자**로 제한.
- 소개는 **최대 4줄**까지만 입력/붙여넣기 허용.
- 소개 입력창은 세로 크기 고정, 사용자가 임의로 늘리지 못하게 유지.
- 고유 핸들 제한은 기존 계약 유지:
  - 영문 소문자, 숫자, 점(.), 밑줄(_).
  - 3~24자.
  - 점(.)은 처음/끝/연속 사용 불가.
- 핸들 경고는 평소에는 노출하지 않고 **저장 버튼을 눌렀을 때 조건에 맞지 않는 경우에만** 입력칸 경고 스타일 + 안내문을 표시.
- 핸들이 올바르게 수정되면 경고는 즉시 해제.
- app316 프로필 사진 초기 줌(avatar 1~2 / 기본 1.5)과 배경 편집(1~3 / 기본 2)은 그대로 유지.

**변경 / 검증 / 배포**
- 대표 장르 5개 + 소개 제한: `abbfc04f493fc38313701679c61e86ec06bb7634`.
- 소개 4줄 UI 고정: `341229ea4ba1a5c88ddd0cf4a7a76cab753f8a5b`.
- app317 verifier: `fda9377fb9cf539508342b81a2d44aeeebb8ab43`.
- app317 Release System Audit `37095789989`: **SUCCESS**.
- 핸들 저장 시 경고: `c179ff83a8f117741a3ee65e9aed8ccdb2e2b8e9`.
- 핸들 경고 스타일: `f98d4c6509293905dc84b957fbdd5a0a391e9935`.
- app318 verifier: `ef5d707320ad27babf9f0ce848196ecb583d87ac`.
- app318 version commit: `b90dcca7586a8597e8129c7ece25eb5d08583ad3`.
- final audit trigger: `8a95b50ddf2654e6ba4cf8aea679c03a68e91a19`.
- Final Release System Audit `37095952402`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37096051261`: **SUCCESS**.
  - locked source `6f2bf80bde951eeea8736bce25fa1f4be612e22d`.
  - `preview.soridraw.com` app **318**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 대표 장르가 최대 5개까지 추가/자동추천/저장되는지.
2. 소개가 150자에서 더 입력되지 않는지.
3. 줄바꿈 기준 4줄을 넘기면 5번째 줄이 들어가지 않는지.
4. 소개 입력창이 4줄 범위에서 고정되어 세로 resize 되지 않는지.
5. 정상 핸들 상태에서는 경고가 보이지 않는지.
6. 잘못된 핸들 상태로 저장을 누르면 해당 입력칸 바로 아래에 경고가 나타나는지.
7. 핸들을 정상 조건으로 고치면 경고가 즉시 사라지는지.
8. app316 프로필 사진/배경 이미지 편집 동작 회귀 없음.

## 0NP. PREVIEW app316 배포 완료 — 프로필 사진 초기 확대 축소 (2026-10-03 KST)

**적용**
- 사용자 실사용 피드백에 따라 **프로필 사진 편집창의 최초 확대 상태만 완화**.
- 프로필 사진(avatar) 확대 범위: **1~2**, 기본값 **1.5**.
- 따라서 최초 진입 시 슬라이더 손잡이는 계속 **중앙 위치**에서 시작하지만, 실제 이미지는 app315의 zoom 2보다 덜 확대되어 보임.
- 배경 이미지 편집은 app315 동작 그대로 유지: 확대 범위 **1~3**, 기본값 **2**.
- 프로필 사진/배경 이미지 모두 드래그 이동, 확대/축소, 초기화, 적용/취소, 저장 경로 비변경.
- 대표 장르 최대 4개 제한도 그대로 유지.

**변경 / 검증 / 배포**
- 제품 commit: `36fb6bb39b1aba3fe40275782e007b5062aa038b`.
- verifier commit: `ba3ffe1992ae7a86cc32a79bb9de942f6063f23f`.
- app316 version commit: `4bd7393a63c031a16160b0667324eef3b2e21210`.
- audit trigger: `1c952a7f393c3372067687f7db7ff071d603874b`.
- Release System Audit `37094788361`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37094882121`: **SUCCESS**.
  - locked source `6399e8516acdfb274579d1e157cf5f7110205c4d`.
  - `preview.soridraw.com` app **316**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 변경 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 이미지가 app315보다 덜 확대되어 보이는지.
2. 프로필 사진 슬라이더 손잡이는 중앙에서 시작하는지.
3. 중앙에서 왼쪽 축소 / 오른쪽 확대 모두 자연스러운지.
4. 초기화 시 프로필 사진은 zoom 1.5 중앙 위치로 복귀하는지.
5. 배경 이미지 편집은 기존 zoom 2 / 1~3 동작 그대로인지.
6. 적용/취소/드래그/저장/대표 장르 4개 기능에 회귀가 없는지.

## 0NO. PREVIEW app315 배포 완료 — 프로필 이미지 기본 줌 중앙 + 대표 장르 4개 제한 (2026-10-03 KST)

**적용**
- 프로필 사진/배경 이미지 편집의 확대·축소 게이지 기본값을 기존 최소값(zoom 1)에서 중앙값 **zoom 2**로 변경.
- 게이지 범위는 기존 **1~3** 그대로 유지하여, 처음 사진을 불러온 직후부터 축소와 확대를 모두 할 수 있음.
- 초기화 버튼도 새 기본값인 zoom 2 + 중앙 위치로 복귀.
- 프로필 편집의 대표 장르 최대 개수를 **5개 → 4개**로 조정.
- 기존 프로필에 5개가 있어도 편집창에서는 최대 4개까지만 유지.
- 수동 추가, 자동 새로고침 결과, 저장/변경 비교 모두 4개 제한으로 통일.
- 이미지 크롭 비율/저장 해상도/드래그 이동/프로필 저장 경로는 변경 없음.

**변경 / 검증 / 배포**
- crop default commit: `db7f0866b0d05403f96799c3b6636aceb8cc4848`.
- genre limit commit: `39e4694fba0cb5884b32d47f7fbf0c9c2bd8d555`.
- verifier commit: `f2240838b209b22778ebe502af78b7d2c90ca4c5`.
- 최초 Audit `37093499122`: FAIL — 제품 코드가 아니라 verifier 정규식 문법 오류. TypeScript 단계에서 verifier 파일 파싱 실패.
- verifier fix: `48ea5579496b04856d1942bedbf9f698015c2bc0`.
- 후보 Audit `37093694247`: **SUCCESS**.
- app315 version commit: `f93a372e8f13c6f8af2f81ed25f126e584bbf177`.
- Final Release System Audit `37093821640`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37093928424`: **SUCCESS**.
  - locked source `118d15bcaac051fe524b7a14a2671abec5177a1b`.
  - `preview.soridraw.com` app **315**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 줌 손잡이가 중앙에서 시작하는지.
2. 배경 이미지 선택 직후 줌 손잡이가 중앙에서 시작하는지.
3. 중앙에서 왼쪽으로 축소, 오른쪽으로 확대 모두 가능한지.
4. 초기화 버튼이 다시 중앙 줌으로 복귀하는지.
5. 대표 장르 카운터가 `0/4 ~ 4/4`인지.
6. 4개 상태에서 추가 버튼 비활성, 자동 추천도 최대 4개인지.
7. 저장 후 공개 프로필에 최대 4개만 표시되는지.

## 0NN. PREVIEW app314 배포 완료 — MY 프로필 배경 높이 335/270px (2026-10-03 KST)

**적용**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): **335px**.
- 태블릿(721~1599px): **270px**.
- 모바일(720px 이하): 기존 **190px 그대로**.
- 다른 사용자 공개 프로필 높이 비변경.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- app314 version commit: `1b8bfab06ae57096e7601b91fe44563527382b0f`.
- final audit trigger: `806ed75a5577068f0cb4e5713a65d76958bb300f`.
- Final Release System Audit `37092786220`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092878119`: **SUCCESS**.
  - locked source `e3005b1f5b6ad43c3cea0b6f9bea1da0e37874e3`.
  - `preview.soridraw.com` app **314**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**사용자 작업 규칙 갱신**
- 앞으로 사용자의 **수정 요청은 PREVIEW 수정 + 검증 + PREVIEW 배포까지 완료**하는 것으로 진행.
- 사용자가 별도로 배포 제외를 지시한 경우만 PREVIEW 배포를 생략.
- TEST 승격은 사용자의 `테스트배포` 요청 시에만.
- PRODUCTION은 별도의 명확한 정식배포 승인 시에만.

## 0NM. PREVIEW app314 후보 — MY 프로필 배경 높이 미세 조정 (2026-10-03 KST)

**변경**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): 315px → **335px**.
- 태블릿(721~1599px): 252px → **270px**.
- 모바일(720px 이하): 기존 190px 그대로.
- 다른 사용자 공개 프로필 높이 그대로.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**commit / 검증**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- audit trigger: `259100d5f303198f52406163c4ef367e8e5cff04`.
- Release System Audit `37092580600`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- 서버/데이터/Worker/Functions/Rules 변경 없음.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app313 유지.
- `public/app-version.json`도 313 유지.
- TEST / PRODUCTION 변경 없음.

## 0NL. PREVIEW app313 배포 완료 — MY 프로필 배경 높이만 확대 (2026-10-03 KST)

**적용 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC(1600px 이상): 기존 210px → 315px(1.5배).
- 태블릿(721~1599px): 기존 210px → 252px(1.2배).
- 모바일(720px 이하): 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- profile scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier fix 포함 최종 후보: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- app313 version commit: `b2ce36f03cea10b7545150b6ef0fb5a5c8a52dac`.
- final audit trigger: `f2b0399bb0b83709eece67956e9ee5fdaff0c912`.
- Final Release System Audit `37092012879`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092136757`: **SUCCESS**.
  - locked source `8def3f847ea8735bfbf14a934b020c6a91f0d180`.
  - `preview.soridraw.com` app **313**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**실사용 확인**
1. PC MY 프로필 배경 높이 315px 체감 확인.
2. 태블릿 MY 프로필 배경 높이 252px 확인.
3. 모바일은 기존 높이/레이아웃 그대로인지 확인.
4. 다른 사용자 공개 프로필 높이 비변경 확인.
5. 높이 외 위치/간격/텍스트/아바타/크롭 회귀 없음.
6. 위 항목은 **실사용 검증 전**.

## 0NK. PREVIEW app313 후보 — MY 프로필 배경 높이만 반응형 확대 (2026-10-03 KST)

**요청 / 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC: 기존 210px 기준 1.5배 → 315px.
- 태블릿: 기존 210px 기준 1.2배 → 252px.
- 모바일: 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/간격/텍스트/아바타/이미지 필터/크롭/레이아웃 변경 없음.

**구현**
- 자기 프로필에만 `is-own-profile-313` scope 추가.
- 721~1599px: min-height 252px.
- 1600px 이상: min-height 315px.
- 720px 이하: 기존 mobile rule 190px 그대로.
- 서버/데이터/캐시/비용 관련 변경 없음.

**commit / 검증**
- scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier commit: `84c9efde7531bfdae98d170b050ee6621ceb9973`.
- 1차 Audit `37091267340`: FAIL — 제품 코드가 아니라 verifier가 CSS 대신 TSX 파일을 검사한 테스트 오류. TypeScript/Build는 PASS.
- verifier fix: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- 재검증 Audit `37091395204`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app312 유지.
- `public/app-version.json`도 app312 유지.
- Worker / Functions / Rules / 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.

## 0NJ. PREVIEW app312 배포 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**기능**
- Explore `최신` 섹션명을 `최신 공개곡`으로 변경.
- 장르별 추천 toolbar와 같은 위치/스타일로 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 기존 latest Feed에서 내가 팔로우한 크리에이터의 곡만 시간 순서 그대로 필터.
- 동일 기기에서 팔로우/해제 시 팔로잉 필터 membership도 즉시 반영.
- 계정 전환 시 이전 계정의 팔로잉 state를 즉시 폐기.

**비용 구조**
- 새 latest/following Feed API 추가 없음.
- `전체 ↔ 팔로잉` 버튼 전환은 기존 `tracks` 배열의 로컬 필터이므로 D1 R0/W0.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 공개곡 수가 늘어도 버튼 전환 때문에 별도 전체 조회/Firestore read/D1 scan 없음.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

**변경 commit**
- following bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI/필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- app312 version: `aa04f734f852f4d253d5c062165a02f9e857d7dc`.
- final audit trigger: `3a3e0cbccf069d9a6b34ed1da1b90c47e3ebe090`.
- PREVIEW release trigger / locked release source: `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.

**검증 / 배포**
- 후보 Audit `37090109213`: SUCCESS.
- 최종 Release System Audit `37090441432`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore feed/layout verifier PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight PASS.
- Firebase PREVIEW Release `37090519862`: **SUCCESS**.
  - locked source `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **312**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker / Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실사용 확인 필요**
1. PC/모바일에서 `최신 공개곡` 제목 및 `전체 / 팔로잉` 버튼 위치가 장르별 추천과 동일한지.
2. `전체`: 기존 최신 공개곡 순서/카드 수/스크롤 동작 그대로인지.
3. `팔로잉`: 팔로우한 크리에이터 곡만 시간 순서대로 노출되는지.
4. 팔로우 0명일 때 빈 상태가 어색하지 않은지.
5. CACHE LIVE에서 warm `전체 ↔ 팔로잉` 전환 D1 R0/W0인지.
6. 다른 정상 Explore 섹션/좋아요/승격/공개·비공개 회귀 없음.
7. 위 실기기 항목은 **실사용 검증 전**.

## 0NI. PREVIEW app312 후보 구현 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**사용자 요청**
- Explore `최신` 제목을 `최신 공개곡`으로 변경.
- 장르별 추천과 같은 위치/스타일의 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 사용자가 팔로우한 크리에이터의 곡만 기존 최신 Feed에서 시간 순서 그대로 필터.

**구현**
- 기존 `tracks` latest Feed를 그대로 재사용. 새 Feed API / D1 목록 쿼리 추가 없음.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 팔로잉 버튼을 처음 눌렀을 때 계정의 기존 follow bundle을 한 번 해석하고 이후 기기 캐시 사용.
- 같은 기기에서 팔로우/해제하면 팔로잉 필터 목록도 즉시 반영.
- 계정 전환 시 이전 계정 팔로잉 목록을 로컬 state에서 즉시 폐기.
- 카드 크기/레일/모바일 3열/인기/추천/장르/좋아요/공개·비공개 경로 변경 없음.

**변경 commit**
- follow bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI / 필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- audit trigger: `1fe077326460208d33a0289786f2988af0d399b0`.

**검증**
- Release System Audit Run `37090109213`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- Explore feed layout verifier PASS.
- Like regression PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- shared D1 read-only preflight PASS.
- 데이터 migration/backfill 없음.
- Worker / Functions / Firebase Rules / Cloudflare 배포 없음.

**배포 상태**
- 이 작업은 **PREVIEW 코드 수정만 완료, 아직 배포 전**.
- `public/app-version.json`은 여전히 **311**.
- 실제 `preview.soridraw.com`도 현재 app311 유지.
- 사용자 명시적 프리뷰배포 요청 전 Firebase Hosting/Worker 배포 금지.

**비용 판단**
- `전체 ↔ 팔로잉` 전환 자체는 기존 latest Feed 배열 필터이므로 D1 R0/W0.
- 팔로잉 목록이 이미 기기에 있으면 추가 서버 읽기 0.
- 팔로잉 목록 캐시가 없는 새 기기/복구 상황에서는 기존 social snapshot R2 경로를 사용하며 별도 D1 following-feed를 만들지 않음.
- 공개곡 전체 수가 늘어도 버튼 전환 때문에 별도 전체 조회가 생기지 않음.

## 0NH. PREVIEW app311 배포 완료 — 승격관리와 SORIDRAW 추천 피드 상태 일치 (2026-10-03 KST)

**사용자 실측 문제**
- 다른 기기에서 승격 변화는 `승격 곡 관리` 화면에는 반영되지만, 일반 SORIDRAW 추천 피드는 이전 목록을 계속 표시.
- 원인은 관리 목록 캐시/state와 공개 추천 피드 캐시/state가 별도로 유지되어, 관리 화면이 최신 R2 snapshot을 받은 뒤에도 일반 피드가 오래된 로컬 목록을 계속 사용하는 것.

**app311 수정**
- 승격관리에서 최신 curated snapshot을 받으면 동일 revision/items를 일반 SORIDRAW 추천 로컬 캐시에도 즉시 반영.
- Explore 화면 state도 함께 갱신하여 승격관리 화면을 닫았을 때 별도 서버 재조회 없이 같은 최신 목록을 바로 표시.
- 추가 D1 read/write 없음. 기존 R2/local-first 구조 재사용.
- app310의 승격관리 최초 D1 R0 구조 유지.
- 승격/해제 mutation 비용 구조 변경 없음.
- Worker / Functions / D1 schema / Rules 변경 없음.

**변경 / 검증 / 배포**
- service commit: `39e6f4c687b366effae5da031cc51356259a68ea`.
- Explore state commit: `73401ebb786be767e771ef4b0fe52ccc2db2473a`.
- verifier commit: `7d134f0ee0b6853fd9e310fa46452dbb937be065`.
- verifier typo fix: `85a7dfe6ba05c0a0308a03ccd4c84e4618f78595`.
- app311 version commit: `b21a677ea8053abf6dc148fbe6536ce7ebb68b22`.
- 최초 Audit `37088680852`: FAIL — 제품 코드가 아니라 verifier 변수명 오타(`page` → `explore`)로 실패, TypeScript/Build는 PASS.
- 재검증 Audit `37088793832`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37088927776`: **SUCCESS**.
  - locked source `580805847292d03ca2120c7e659d8c9e37ba90c6`.
  - `preview.soridraw.com` app **311**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker는 app310 배포본 그대로. Functions/Rules/사용자 데이터 변경 없음.

**실기기 확인**
1. 기기 A에서 곡 승격/해제.
2. 기기 B에서 승격관리 화면을 열어 최신 목록 확인.
3. 기기 B에서 승격관리 화면을 닫고 일반 SORIDRAW 추천 피드로 복귀.
4. 별도 새로고침/추가 D1 read 없이 일반 피드도 동일 목록을 표시해야 함.
5. app310의 승격관리 최초 진입 D1 R0도 계속 유지되어야 함.
6. 완전히 열린 다른 기기의 일반 피드를 실시간 push로 자동 갱신하는 기능은 이번 범위에 포함하지 않음.

## 0NG. PREVIEW app310 배포 완료 — 승격관리 최초 D1 목록읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- app309에서 재진입 반복 읽기는 해결됐지만, 앱 업데이트 후 승격 곡 관리 첫 진입에서 현재 9곡을 표시하는데 D1 rows read가 약 43 발생.
- 원인은 관리 전용 `/v1/manage/curated`가 기존 R2 추천 스냅샷을 재사용하지 않고 D1-backed curated 목록 경로를 다시 호출한 것.

**app310 수정**
- 승격관리 목록을 기존 curated R2 snapshot에서 직접 읽도록 변경.
- 일반 Explore가 사용하는 추천 스냅샷과 같은 R2 원본을 재사용하므로 앱 버전 변경 때문에 관리 목록을 D1에서 다시 구성하지 않음.
- 기존 app309 브라우저 local-first cache는 그대로 유지하여 warm 재진입은 계속 LOCAL/CACHE 우선.
- R2 snapshot 자체가 유실된 예외 복구 시에만 기존 bootstrap 경로가 D1을 사용할 수 있음. 앱 업데이트 자체는 R2를 지우지 않음.
- 승격/해제 mutation은 변경하지 않음:
  - 승격: 기존 R1/W1 계약 유지.
  - 해제: 추가 R0/W1 계약 유지.
- 일반 Explore `/v1/curated`, 좋아요, 공개/비공개, Studio 저장 하트, Music Note/Library 폴더, Split 경로 변경 없음.

**변경 / 검증 / 배포**
- Worker 제품 commit: `5581a4d4954be9d4c6dffe9961a8beb09e2b1e0e`.
- verifier commit: `0ba7fc06938603865a7629ebec5c6ed5734fb212`.
- app310 version commit: `6f679bf89a390783e51729cd4f27986014661393`.
- Release System Audit Run `37087850076`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Cloudflare PREVIEW Worker Release Run `37087979937`: **SUCCESS**.
  - PREVIEW Worker version: `191554c0-f3d2-4731-999f-f57a57a07994`.
  - TEST / PRODUCTION Workers unchanged PASS.
  - D1 schema write/migration/backfill 없음.
- Firebase PREVIEW Release Run `37088038676`: **SUCCESS**.
  - locked source `d8890e22060ee884c7e070463608f1f7576a0f67`.
  - `preview.soridraw.com` app **310**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 비용 확인**
1. app310 업데이트 직후 CACHE LIVE 초기화.
2. 승격 곡 관리 첫 진입.
   - `/v1/manage/curated` D1 R0 / W0 목표.
   - R2/Worker 또는 LOCAL/CACHE 표시는 허용.
3. 나갔다 재진입.
   - D1 R0 / W0 목표.
4. 60초 이후 재진입.
   - revision 확인이 있더라도 D1 R0 / W0 목표.
5. 실제 승격/해제 비용은 기존 계약 그대로.
6. 위 최초 진입 D1 R0 수치는 사용자 실기기 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

## 0NF. PREVIEW app309 배포 완료 — 승격관리 재진입 D1 반복 읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- 승격 곡 관리 페이지 진입 때마다 `/v1/manage/curated`가 D1 R1을 반복해 행읽기가 누적됨.
- 승격 자체 R1/W1, 승격 해제 추가 R0/W1은 이번 수정 대상에서 제외하고 기존 정상 동작 유지.

**app309 수정**
- 승격관리 전용 목록을 계정별 local-first cache로 보존.
- 첫 정상 조회 뒤 60초 이내 재진입은 서버 목록 요청 없이 로컬 캐시 사용.
- 60초 이후에도 기존 `/v1/curated-revision`으로 변경 여부만 확인하며 이 경로는 D1 R0.
- revision이 같으면 기존 관리 목록을 그대로 사용하여 `/v1/manage/curated` D1 재조회 없음.
- 실제 승격/해제처럼 추천 목록이 변경되면 해당 계정의 관리 캐시만 무효화하고 다음 필요 시 목록을 다시 받음.
- 일반 Explore `/v1/curated`, 승격/해제 mutation, 좋아요/공개·비공개/Studio 저장 하트/폴더/Split 경로는 변경하지 않음.

**변경 / 검증 / 배포**
- 제품 commit: `30e2474b1477e4958dd368f3aa7e51ed399467f9`.
- verifier commit: `f01aa545e6f2f1cdb047ca3bc6066bdcc77f0639`.
- app309 version commit: `37cf4ad227c99890053370747bf094b384ff0f6e`.
- 1차 Release System Audit Run `37086609323`: SUCCESS.
- 최종 Release System Audit Run `37086773217`: SUCCESS.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37086923105`: SUCCESS.
  - locked source `2236b051451d6e71884a3ee1be125359124602ae`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **309**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**비용 기대값 / 실기기 확인 필요**
1. app309 최초 승격관리 진입: 관리 캐시가 없으면 기존처럼 D1 R1 가능 — 최초 1회 seed.
2. 변경 없이 바로 나갔다 재진입: `/v1/manage/curated` 추가 호출 없음, D1 R0/W0 목표.
3. 60초 이후 변경 없이 재진입: revision 확인만 수행, D1 R0/W0 목표.
4. 실제 승격/해제 뒤에는 관리 캐시가 무효화되므로 다음 필요 조회에서 D1 R1은 허용.
5. 승격 R1/W1, 해제 추가 R0/W1 기존 계약 유지.
6. 위 비용 숫자는 사용자 CACHE LIVE 실기기 재측정 전까지 **실사용 검증 전**.

## 0NE. PREVIEW app306 배포 완료 — Explore 섹션 순서 조정 + PC 좌우 스크롤 버튼 상시 노출 (2026-10-03 KST)

**사용자 요청**
1. 현재 Explore 기준으로 `최신 / 인기`를 장르별 추천보다 위로 이동.
2. `장르별 추천`을 `좋아할 만한 크리에이터` 아래로 이동.
3. Explore와 MY 프로필의 곡 가로레일 좌/우 버튼을 **PC에서만 항상 노출**.
4. 모바일/태블릿의 기존 버튼 표시/숨김 동작은 그대로 유지.

**최종 Explore 홈 순서**
1. SORIDRAW 추천
2. 최신 — 최대 20곡
3. 인기 — 최대 20곡
4. 좋아할 만한 크리에이터
5. 장르별 추천

**PC 버튼 동작**
- PC 기준 `1600px+`에서 ExploreRecommendationRail 좌/우 버튼을 idle/hover 상태와 무관하게 항상 표시.
- 레일 시작/끝에서 사용할 수 없는 버튼도 위치는 계속 보이되 비활성 표시.
- `<1600px` 태블릿/모바일에는 기존 hover/tap/idle 숨김 로직을 변경하지 않음.
- MY 프로필의 고정곡 가로레일도 같은 공용 rail을 사용하므로 PC에서 양쪽 버튼 상시 노출.
- 카드 크기/간격/가로 스크롤/스냅/좋아요/액션 로직 변경 없음.

**변경 / 검증**
- 제품 commit: `811c15803339effefb05a0a47b0878c6128d5964`.
- Release System Audit source: `465a39e7d12cc92ece5c9f9f4eff44b2d4e10465`.
- Release System Audit Run `37076540406`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37076722003`: **SUCCESS**.
  - locked source `decf246958b596f4345c8012fe680cf4afde8d5b`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **306**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인**
- PC: Explore 모든 가로 레일에서 좌/우 버튼이 항상 보이는지.
- PC: MY 프로필 고정곡 레일에서도 양쪽 버튼이 항상 보이는지.
- 태블릿/모바일: 기존처럼 필요할 때만 버튼이 나타나고 자동으로 숨는지.
- Explore 순서가 `SORIDRAW 추천 → 최신 → 인기 → 좋아할 만한 크리에이터 → 장르별 추천`인지.

## 0ND. PREVIEW app305 배포 완료 — 기존 Explore 추천 3종 복구 + 최신/인기 추가 유지 (2026-10-03 KST)

**사용자 실기기 피드백**
- app304에서 `최신 / 인기`를 추가하면서 기존 `SORIDRAW 추천 / 장르별 추천 / 좋아할 만한 크리에이터`가 사라진 것은 사용자 의도와 다름.
- 정확한 요구는 **기존 기능을 그대로 유지하고 최신/인기를 추가**하는 것.
- app304의 "기존 추천 UI 숨김" 해석은 잘못된 작업으로 판정하고 app305에서 즉시 복구.

**app305 수정**
- 기존 추천 3종을 app303 이전과 같은 로컬 추천 모델로 복구:
  1. `SORIDRAW 추천`
  2. `장르별 추천`
  3. `좋아할 만한 크리에이터`
- 그 아래에 app304에서 추가한:
  4. `최신` 최대 20곡
  5. `인기` 최대 20곡
  을 그대로 유지.
- 기존 `추천 / 최신 / 인기` 페이지 탭은 다시 만들지 않음.
- 상단 `MY 프로필` 버튼과 계정 메뉴의 `MY 프로필` 명칭은 유지.
- 추천 모델은 기존처럼 이미 로드된 latest Feed를 로컬에서 분류하므로 추가 D1 read/write 없음.
- 인기 섹션은 기존 app304의 R2 first-page `limit=40` 계약 + UI 20곡 노출을 그대로 사용.
- 카드 디자인 / 좋아요 / 공개·비공개 / 저장 하트 / Music Note·Library 폴더 / Split history는 변경하지 않음.

**변경 / 검증**
- 제품 수정 commit: `decf7ed1b34aee39256b3ad42d69d29fceefb732`.
- audit source: `5b0fc905da93cc54d22ea61e3fcefe01f9b35c21`.
- Release System Audit Run `37075540135`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static A~D + syntax guards PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37075730053`: **SUCCESS**.
  - locked source `647bfe2b21a2195ac281462b6464da84c10b9364`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **305**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**현재 실기기 확인 포인트**
1. 상단 MY 프로필 아래 기존 `SORIDRAW 추천`이 다시 보이는지.
2. `장르별 추천`과 장르 버튼이 기존처럼 보이고 동작하는지.
3. `좋아할 만한 크리에이터`가 다시 보이는지.
4. 그 아래에 `최신`, `인기`가 추가로 보이는지.
5. PC/모바일 기존 카드·가로 스크롤·화살표·좋아요/액션 회귀 없음.

## 0NC. PREVIEW app304 배포 완료 — Explore 최신/인기 동시 홈 + MY 프로필 명칭 (2026-10-03 KST)

- 사용자 요청대로 Explore의 기존 `추천 / 최신 / 인기` 탭형 페이지 구분을 제거하고, 한 화면에서 **최신 / 인기** 두 가로 레일을 함께 표시.
- 최신: 화면에 최대 20곡.
- 인기: 화면에 최대 20곡.
- 기존 Worker의 R2 first-page 계약이 `limit=40` 고정이므로 서버 계약은 변경하지 않고, latest/popular R2 snapshot 40개를 기존 local-first 캐시에 보관한 뒤 UI에서 각각 20개만 노출.
- canonical D1 Feed 전체조회/새 Worker 경로/새 migration 없음.
- 기존 추천/장르별추천/크리에이터 추천 UI는 이번 홈 화면에서 숨기고 추가 확장은 보류.
- 기존 탭 위치에는 **MY 프로필** 버튼을 배치하여 현재 로그인 사용자의 `/explore?profile={uid}`로 이동.
- 계정 메뉴와 Studio left-rail의 자기 프로필 명칭을 `공개 프로필` → `MY 프로필`로 변경.
- 프로필 상단은 자기 프로필일 때 `MY 프로필`, 다른 사용자의 프로필은 기존 `공개 프로필` 유지.
- 카드 디자인 / 좋아요 mutation / 공개·비공개 / 저장 하트 / app301 폴더 / app303 Split history 동작은 변경하지 않음.

**변경 commit**
- 제품/UI: `fe9b7d7c8b07b98a9e16294852818fc08e25f054`.
- MY 프로필 rail label + verifier 정합화: `ebe7c70cb643150420f21f7cb0409c824b27a557`.
- 최종 audit source: `746e635e8fd8ef3c50938fa38a08177a599b0b24`.
- PREVIEW locked release source: `e2547cf7d3a7bc6e90df052aa474f15e42df6f05`.

**검증 / 배포**
- 첫 audit Run `37074532330`: FAIL.
  - 제품 TypeScript / Build는 PASS.
  - 실패 원인은 UI 명칭/레이아웃 변경 뒤 기존 verifier의 `공개 프로필` 및 예전 Latest/Popular grid 계약 assertion이 남아 있던 것.
  - 제품 런타임 오류가 아니라 verifier 기준 정합화 문제로 확인.
- verifier/left-rail 명칭 정리 후 Release System Audit Run `37074868844`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - static A~D PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch-ref guard PASS.
- Firebase PREVIEW Release Run `37075062146`: **SUCCESS**.
  - Firebase Hosting PASS.
  - remote `preview.soridraw.com`: app **304**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인 포인트**
1. Explore 상단에서 기존 추천/최신/인기 탭이 사라지고 MY 프로필 버튼이 보이는지.
2. 최신 레일 최대 20곡, 인기 레일 최대 20곡이 같은 Explore 홈에 연속 표시되는지.
3. PC/모바일에서 기존 카드 디자인과 액션 위치가 유지되는지.
4. MY 프로필 버튼, 계정 메뉴, Studio left-rail에서 자기 프로필 진입이 정상인지.
5. 자기 프로필 상단은 MY 프로필, 다른 사용자 프로필은 공개 프로필로 보이는지.
6. 좋아요/해제 및 공개/비공개 기존 정상 기능 회귀가 없는지.

## 0NB. PREVIEW app303 배포 완료 — Split 작업화면 브라우저 Back/Forward 복원 (2026-10-03 KST)

- 제품 commit: `cc84fba18b8ccbec6b83b983f6a3a1217046516c`.
- Split의 곡 만들기 / 최근 생성곡 / Music Note / Library 이동을 `/studio?view=...` history에 기록하고 브라우저 Back/Forward 및 마우스 뒤로/앞으로로 복원.
- app303 version JSON 복구 commit: `df1978d56012d73265509165d3ba0d92faea32b7`.
- focused Verify Run `37070391369`: SUCCESS.
- Release System Audit Run `37070574836`: SUCCESS.
- Firebase PREVIEW Release Run `37070784375`: SUCCESS.
- app303 exact build PASS / TEST·PRODUCTION unchanged PASS.
- app302/app302b 저장 하트, app301 폴더, 기존 Split Pure Pane 보호 기준 변경 없음.

## 0NA. app302/app302b 사용자 실기기 정상 확인 + 좋아요/저장하트 스킬 동결 (2026-10-03 KST)

**사용자 확인**
- PREVIEW app302 배포 후 사용자 피드백: **"정상 적용됐어."**
- 따라서 app302/app302b의 사용자-visible Studio 저장 하트 동작을 실기기 정상 기준으로 동결.
- 단 이번 피드백은 화면/동기화 동작 정상 확인이며, 별도 계측하지 않은 Firestore/D1 비용 숫자까지 실측 PASS로 확대 해석하지 않음.

**이번 문서/Skill 업데이트**
- `.agents/skills/local-first-like-sync/SKILL.md`
  - Explore 공개 좋아요와 Studio Recent 저장 하트를 서로 다른 상태기로 명시.
  - app302 30초 final-state + delayed-remote 규칙 추가.
  - app302b pending local layer strip / baseline restore / settlement cleanup을 하드 invariant로 추가.
  - save→unsave net-zero 뒤 optimistic Music Note row가 남지 않아야 하는 회귀 항목 추가.
- `.agents/skills/song-save-edit-sync-cost/SKILL.md`
  - Recent text edit RTDB preview와 Studio save-heart delayed remote를 명확히 분리.
  - generic favorites updater는 pending overlay를 제거한 canonical base를 입력으로 사용하도록 보호 규칙 추가.
  - pending intent 제거 직후 local Music Note layer 정리 규칙 추가.
- `.agents/skills/song-save-edit-sync-cost/references/soridraw-app302-studio-heart-local-first-baseline.md`
  - PREVIEW 실기기 상태를 **USER CONFIRMED NORMAL**로 갱신.
  - app302b 보강까지 현재 동결 기준으로 기록.
- `AGENTS.md`
  - app302/app302b 사용자 정상 확인 기준 및 Explore like / Studio save-heart 구분 라우팅 추가.

**보호 기준**
- runtime correction commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- PREVIEW Release Run: `37066438604` SUCCESS.
- app302 exact build PASS.
- TEST / PRODUCTION 변경 없음.
- 이 작업은 문서/Skill 갱신만 수행. 앱 코드/Backend/사용자 데이터/배포 변경 없음.

## 0MZ. PREVIEW app302 배포 완료 — Recent 저장 하트 local-first 최종 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37066438604`: **SUCCESS**.
- locked PREVIEW source: `bfe9893405ac50a314e1d4b8ab9eeafdedce3136`.
- remote `preview.soridraw.com`: app **302**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**최종 app302 동작**
- Recent 저장/해제를 누른 기기에서는 Music Note가 즉시 로컬 반영.
- 다른 기기에는 30초 전 임시 heart 상태를 보내지 않음.
- 같은 곡 30초 반복 토글은 마지막 상태만 canonical 반영:
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
- canonical 성공 뒤 기존 RTDB save/unsave signal로 다른 기기 반영.
- 서로 다른 곡은 곡별 독립 30초 timer.
- Recent 제목/프롬프트/가사 즉시 cross-device preview는 그대로 유지.

**app302b 배포 전 보강**
- 제품 보강 commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- optimistic pending row가 canonical updater 입력으로 다시 섞여 settlement/net-zero 뒤 남을 수 있는 경로를 차단:
  - canonical updater 전에 pending local layer 제거.
  - baseline favorite가 있던 pending row는 원래 canonical row로 복원.
  - settlement/net-zero에서 pending intent 제거 직후 Music Note local layer도 즉시 정리.
- verifier 보강 commit: `a853ea930434da7be661de1f7ff6ddf4db198fe1`.
- stale `verify-221-explore-feed-layout.mjs` assertion은 현재 legacy shared-note hydration 계약에 맞춰 보정:
  - verifier fix commit `31e02bf55868716f41566e204d20de353f01ccc1`.
- 임시 app302b workflow/script/trigger 제거 완료.

**검증**
- app302b apply Run `37065777855`: focused verifier PASS / TypeScript PASS / Build PASS.
- 최종 Release System Audit Run `37065967160`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - diagnose static A~D + syntax E1~E3 PASS.
  - static release-system verification PASS.
  - app302 like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch refs unchanged PASS.
- PREVIEW Release Run `37066438604`: **SUCCESS**.
- 상태: **PREVIEW 배포 완료 / PC↔모바일 실기기 최종 확인 대기**.

## 0MY. PREVIEW app302 후보 — Recent 저장 하트: 저장한 기기 즉시 / 다른 기기 30초 확정 후 (2026-10-03 KST)

**사용자 확정 동작**
- 최근 생성곡에서 저장/해제를 누른 기기는 **뮤직노트에 즉시 로컬 표시**한다.
- 다른 기기에는 저장 버튼 클릭 순간의 임시 상태를 보내지 않는다.
- 같은 곡에서 30초 안 저장↔저장해제를 여러 번 눌러도 기존 규칙 유지:
  - 마지막 클릭마다 그 곡의 30초 타이머 재시작.
  - 최초 canonical 기준과 최종 상태가 같으면 favorite W0.
  - 최종 상태가 다르면 마지막 클릭 +30초 뒤 favorite W1.
- canonical favorite 저장/해제가 성공한 뒤 기존 RTDB changed-item 신호가 전송되고, 다른 기기는 그때 로컬 캐시를 갱신한다.
- 서로 다른 곡은 기존처럼 곡별 독립 30초 타이머.

**app302 구현**
- `src/App.tsx`
  - Studio heart pending intent를 Music Note 목록 위에 initiating-device-only optimistic layer로 적용.
  - pending save는 즉시 Music Note에 추가, pending unsave는 즉시 제거.
  - pending row는 `__studioHeartPendingLocal` 표시로 catalog canonical-newer 판단에서 제외.
  - reload/navigation 시 durable `studioHeartBatch` pending intent를 다시 overlay.
  - app302 Studio heart initiating path에서 `publishMusicNoteHeartPreviewDelta` 호출 제거.
  - 30초 final-state / net-zero W0 / retry 구조는 그대로 유지.
- 다른 기기 반영은 canonical mutation 성공 뒤 `runV1MutationBoundary`의 기존 정상 save/unsave RTDB signal만 사용.
- Recent 제목/프롬프트/가사 즉시 RTDB preview는 변경 없음.
- Library/Music Note 폴더 app301 기준 변경 없음.

**비용**
- initiating-device 즉시 Music Note 표시: Firestore R0/W0.
- pre-canonical Studio-heart RTDB write: 0.
- final changed song: favorite W1/곡.
- final == baseline: favorite W0.
- receiver: Firestore R0/W0 목표, D1 R0/W0.
- `users.favoriteCount` 기존 UID 30초 derived batch 유지.

**검증**
- 제품 commit: `24447627c2222d5cedc6fe96dcaccbfb26c0593a`.
- app302 apply/verify Run `37064864663`: **SUCCESS**.
  - focused app302 verifier PASS.
  - TypeScript PASS.
  - Build PASS.
- 임시 apply workflow/script/trigger 제거 완료.
- 전용 Skill 갱신 + app302 baseline 추가.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules / 사용자 데이터 migration 변경 없음.
- 상태: **PREVIEW 배포 전 최종 release audit 대기**.

## 0MX. app301 폴더 기준 동결 + 전용 Skill 저장 (2026-10-03 KST)

**최신 사용자 실기기 영상 판정**
- app301 PREVIEW 영상 길이 약 53.23초.
- Library warm 빈 폴더 삭제 2회 구간 최종 Browser SDK: **읽기 0 / 쓰기 2**.
- SDK write source: **`user_playlists:batch = 2`**.
- 영상 안에서는 `users:batch` 즉시 write 없음.
- D1 R0/W0 / Worker 0.
- 따라서 영상이 직접 증명하는 **warm delete R0 + folder당 canonical W1 + users 즉시 W0** 기준은 PASS.
- 단 영상이 60초 trailing settlement 전에 끝나므로, 마지막 `users.syncVersions.playlists W1` 60초 지연 write는 이 영상에서 실측된 것으로 표기하지 않음. 코드/CI 계약으로 유지.

**생성/삭제/이동 재정리**
- Library create는 app301에서도 기존 정상 경로 유지: R0 / 새 playlist W1 / users 즉시 W0 / empty item cache seed / RTDB 즉시.
- Library delete: warm R0 / 실제 items + playlist만 canonical / users revision 60초 UID batch.
- Library reorder: local+RTDB 즉시 / per-drag Firestore 0 / 60초 final-state.
- Music Note create/rename/reorder: aggregate `user_structures` 60초 final-state.
- Music Note delete: 구조 즉시 확정 + 삭제 폴더 소속 곡만 기본 폴더로 이동하여 데이터 일관성 보호.

**Skill**
- 신규: `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`
- 기준: `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`
- `AGENTS.md`에 폴더 작업 전 필수 Skill로 등록.
- app301 폴더 정상 경로를 보호 기준으로 동결.
- 앱 런타임 코드 변경 없음 / 재배포 없음.
- TEST / PRODUCTION 변경 없음.

## 0MW. PREVIEW app301 배포 완료 — Library 폴더 생성/삭제 비용 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37058559063`: **SUCCESS**.
- locked PREVIEW source: `3b1a24a3a28c212c128a171efed7401ac58de0b7`.
- remote `preview.soridraw.com`: app **301**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**이번 결론**
- 사용자 app299 영상은 생성과 삭제를 모두 포함했고 종료 진단 `user_playlists W7 / users W3 / getDocs R3`을 재분해하면:
  - 폴더 생성 4회 = playlist W4 / Firestore R0 / users 즉시 W0.
  - 빈 폴더 삭제 3회 = playlist W3 / users W3 / getDocs R3.
- 따라서 Library folder create는 이미 정상 저비용 경로였고 변경하지 않음.
- app301은 delete만 create/reorder/rename과 같은 compatibility revision 정책으로 통일:
  - warm active delete R0 경로(app300) 유지.
  - 실제 playlist/item canonical delete만 즉시.
  - `users.syncVersions.playlists`는 delete마다 즉시 W1 하지 않고 60초 UID batch.
  - RTDB `playlist-delete` 즉시 동기화는 유지.
- 빈 create/delete 예상:
  - create: R0 / playlist W1 / users 즉시 W0.
  - warm delete: R0 / playlist W1 / users 즉시 W0.
  - 60초 안 여러 create/delete/reorder: users revision 전체 W1 목표.
- 곡이 든 folder delete는 실제 item 문서 삭제 수 + folder 1 write가 정상 canonical cost이며 전체 조회/전체 rewrite는 금지.

**검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- Backend Safety Run `37058078858`: SUCCESS.
- Release Audit Run `37058260455`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- PREVIEW Release Run `37058559063`: SUCCESS / app301 exact build PASS / TEST-PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / create 3회 + delete 3회 CACHE LIVE 및 PC↔모바일 실기기 검증 대기**.

## 0MV. PREVIEW app301 후보 — Library 폴더 생성/삭제 비용 재감사 + delete users revision batch (2026-10-03 KST)

**사용자 app299 영상 전체 재분석 — 생성과 삭제를 분리해서 판정**
- 영상 종료 진단 누적값: `user_playlists:batch W7`, `users:batch W3`, `user_playlists:getDocs R3`.
- 영상 동작과 현재 코드 경로를 대조하면:
  - **폴더 생성 4회** = `user_playlists W4`, Firestore read **R0**, users 즉시 write **W0**.
  - **빈 폴더 삭제 3회** = `user_playlists W3 + users W3 + getDocs R3`.
- 따라서 이전 분석에서 삭제만 강조했지만, 영상에는 생성도 포함되어 있었고 **생성은 이미 정상 저비용 경로**, 삭제가 비용 차이의 원인이었음.

**Music Note와 구조 비교**
- Music Note folder create/rename/reorder는 하나의 `user_structures/{uid}` 구조 문서 final-state를 60초 묶음 저장하므로 여러 folder metadata 변경을 W1로 합칠 수 있음.
- Library는 folder마다 별도 canonical playlist document이므로 살아남는 새 폴더 1개당 playlist W1은 현재 데이터 구조상 정상/최소 O(1).
- Library create는 이미:
  - Firestore read R0.
  - 새 playlist document W1.
  - 새 빈 items cache 즉시 seed.
  - `users.syncVersions.playlists`는 즉시 쓰지 않고 UID-wide 60초 batch.
  - RTDB로 같은 계정 PC↔모바일 즉시 반영.
- 따라서 create의 playlist W1까지 없애려면 canonical folder 생성 자체를 지연시키는 더 큰 구조 변경이 필요하며, 현재 정상 동작/구버전 호환 위험 대비 비용 이득이 작아 **변경하지 않음**.

**app301 수정 — delete를 create/reorder/rename과 같은 revision 정책으로 통일**
- app300의 warm active folder exact item-ID snapshot + pre-commit local cache fence는 그대로 유지.
- folder/item canonical delete는 즉시 수행.
- 삭제 때마다 즉시 붙던 `users/{uid}.syncVersions.playlists W1`을 canonical delete batch에서 제거.
- 대신 기존 `queueLibraryPlaylistRevisionBatch()`에 합류:
  - 마지막 playlist metadata 변경 후 60초에 users revision **W1**.
  - 60초 안 create/delete/reorder가 여러 번이면 users compatibility write는 최종 revision 1회로 합쳐짐.
- `playlist-delete` RTDB signal 수신 자체가 delayed revision을 "이미 Firestore commit 됨"으로 잘못 지우지 않도록 committed-operation 목록에서 delete를 제외.
- 현재 앱의 PC↔모바일 delete 즉시 반영은 기존 RTDB delta 그대로 유지.
- 구버전/legacy compatibility fallback만 최대 60초 뒤 users revision으로 수렴하며, 이는 이미 create/reorder/rename에 사용 중인 동일 정책.
- non-empty folder delete는 실제 item 문서도 지워야 하므로 canonical write는 **item 수 + folder 1**이 정상. 전체 collection 재조회/전체 rewrite는 하지 않음.

**app301 목표**
- 빈 folder create 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- warm 빈 folder delete 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- create/delete 여러 번을 60초 안 수행: playlist는 실제 생성/삭제된 folder 각각 W1, users revision은 전체 window **W1** 목표.
- cross-device receiver Firestore R0/W0, D1 R0/W0, Worker 0.

**변경 / 검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier 보정 commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-301-library-folder-create-delete-cost.mjs`
  - `public/app-version.json` → app301
- focused source contract: create R0/W1 + delayed users revision / warm delete R0 path + delayed users revision / RTDB receiver guard **PASS**.
- Backend V2 Step 2-A Safety Run `37058078858`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37058260455`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건만 동일.
  - Library create/delete 변경과 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.
- 상태: **PREVIEW app301 배포 후보 / 배포 후 create+delete CACHE LIVE 실기기 확인 필요**.

## 0MU. PREVIEW app300 배포 완료 — Library warm delete redundant R1 보강 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37055366260`: **SUCCESS**.
- locked PREVIEW source: `0c56140c95de7e24b67bf402fee32efb54c37705`.
- remote `preview.soridraw.com`: app **300**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 사용자 app299 영상에서 확인된 상태:
  - Library reorder 반복 구간은 Firestore R0/W0 → app299 개선 유지.
  - warm empty folder delete마다 `user_playlists:getDocs +1`이 반복되어 delete R0는 FAIL.
- app300은 warm delete를 두 군데 보강:
  - 완료된 active playlist exact item IDs를 playlistId별 snapshot으로 고정하여 빈 폴더도 warm snapshot으로 확실히 구분.
  - canonical delete 전에 local playlist-list cache를 같은 syncVersion으로 먼저 반영하여 users revision 때문에 같은 list를 다시 읽는 race를 차단.
  - commit 실패 시 local playlist metadata를 안전하게 복구.
- Backend Safety Run `37054867155`: SUCCESS.
- Release Audit Run `37055069258`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE warm delete R0 재검증 대기**.

## 0MT. PREVIEW app300 후보 — Library warm delete 실기기 R1 제거 보강 (2026-10-03 KST)

**app299 사용자 영상 판정**
- 영상 초반 약 18초 동안 Library 폴더 reorder를 반복했지만 Firestore SDK write가 **R0/W0 유지** → app299의 즉시 reorder + 60초 canonical 지연은 의도대로 작동.
- 이후 비기본 빈 폴더 삭제 때마다:
  - 1차 삭제: `user_playlists:batch W1 + users:batch W1 + user_playlists:getDocs R1`.
  - 2차 삭제 후 누적: W2/W2/R2.
  - 뒤쪽 추가 삭제 후 누적 read가 R3까지 증가.
- 즉 reorder 비용 회귀는 해결됐지만, **warm active folder delete에서 R1이 아직 반복되어 app298/app299 삭제 R0 목표는 FAIL**.
- 영상에서 기본 폴더는 삭제 전 이미 열어 곡 목록이 보였으므로 단순한 "다음 폴더 최초 cold read"로만 설명할 수 없음.

**app300 최소 보강**
- 삭제 대상 active playlist의 item snapshot을 `playlistId + exact itemIds`로 완료 시점에 별도 ref에 고정.
  - 빈 폴더도 `itemIds=[]`인 **완료된 snapshot**으로 구분.
  - React의 일시적인 `loadingPlaylistItems/playlistItems` 상태 타이밍에 기대지 않음.
- warm delete service는 해당 exact IDs가 전달되면 item `getDocs`를 절대 선행하지 않음.
- canonical delete에서 `users.syncVersions.playlists`가 먼저 관측되어 playlist list cache를 stale로 오판하는 경로를 막기 위해:
  - canonical batch commit 전에 **로컬 list cache만** 같은 syncVersion으로 먼저 삭제 반영.
  - 서버 write/read 추가 없음.
  - canonical commit 실패 시 삭제한 playlist metadata를 최신 local cache와 merge하여 복구; 더 최신 cross-device cache version은 덮어쓰지 않음.
- canonical delete 자체 의미/비용은 그대로:
  - playlist/item 실제 삭제 + `users.syncVersions.playlists` 즉시 compatibility write 유지.
  - RTDB `playlist-delete` 즉시 동기화 유지.
- app299 reorder, create/rename, item 기능, Music Note, UI/CSS는 변경하지 않음.
- cold/stale caller에 item snapshot 자체가 없을 때의 bounded Firestore fallback은 데이터 정확성 보호를 위해 유지.

**변경 / 검증**
- 코드 commit: `837d6ce5d3f3d8d2c45bb0f8a170e6be57a6eab9`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-300-library-delete-no-redundant-read.mjs`
  - `public/app-version.json` → app300
- Backend V2 Step 2-A Safety Run `37054867155`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37055069258`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note assertion 한 건만 동일.
  - app300 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / 배포 후 같은 영상 패턴으로 warm delete R0 재확인 필요**.

## 0MR. PREVIEW app299 배포 완료 — Library reorder 60초 final-state batch (2026-10-02 KST)

- Firebase PREVIEW Release Run `37022415990`: **SUCCESS**.
- locked PREVIEW source: `522420c7d9801e98537b6994979959b94e3dd131`.
- remote `preview.soridraw.com`: app **299**, exact build PASS.
- Release job TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules: **SKIPPED** (rules source 변경 없음).
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app299 핵심:
  - Library My/Shared folder reorder는 local/cache + RTDB로 즉시 반영.
  - 같은 폴더 반복 reorder canonical write는 마지막 변경 후 60초 final-state로 축소.
  - 같은 폴더가 원래 canonical order로 돌아오면 canonical reorder W0 목표.
  - 서로 다른 폴더는 변경된 unique playlist 문서만 settlement.
  - settlement users revision은 batch 전체 W1.
  - 상대 기기에는 `playlist-order-batch`로 canonical revision까지 Firestore read 없이 수렴.
  - 삭제된 폴더의 pending order는 취소.
- app298 delete warm R0 보호 유지:
  - active folder loaded snapshot 삭제 전 재조회 없음.
  - 삭제 후 다음 folder item cache가 정상 존재하면 R0.
  - cache가 실제로 없는 cold/stale next folder는 정확성 보호용 bounded R1 fallback 유지.
- 사전 검증:
  - Backend Safety Run `37021658904` SUCCESS.
  - Release Audit Run `37021945536`: TypeScript/Build/diagnose PASS; overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE + PC↔모바일 실기기 검증 대기**.

## 0MQ. PREVIEW app299 후보 — Library 폴더 순서 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 실기기 비교**
- app298 Library 영상은 같은 폴더 순서 변경 반복에서 Firestore `user_playlists:batch`가 드래그마다 증가했고, Music Note는 같은 조작 구간에서 canonical write를 60초 최종상태로 묶어 큰 차이가 확인됨.
- Library 삭제 연속 테스트에서 보인 `user_playlists:getDocs`는 app298이 제거한 "삭제 직전 같은 active folder 재조회"와 별개로, 삭제 후 자동 선택된 다음 폴더의 item cache가 없는 cold/stale 경우의 bounded load일 수 있음.

**app299 최소 수정**
- Library My/Shared 폴더 reorder는 화면 state + persistent list cache + 기존 RTDB `playlist-order` signal로 즉시 반영.
- canonical `user_playlists/{uid}/lists/{playlistId}.order` 저장은 **마지막 reorder 후 60초** final-state batch로 이동.
- 같은 폴더를 60초 안 여러 번 움직이면 마지막 order만 canonical W1.
- 같은 폴더가 원래 canonical 위치로 돌아오면 pending을 제거하여 reorder canonical W0 목표.
- 서로 다른 폴더를 움직인 경우에는 변경된 unique playlist document만 각각 W1이며, legacy 호환 `users.syncVersions.playlists`는 batch 전체 W1.
- settlement 뒤 `playlist-order-batch` RTDB signal로 상대 기기 cache revision도 올려 Firestore reread를 피함.
- 반대 기기의 더 최신 order signal 또는 folder delete가 오면 오래된 local pending order를 취소.
- folder delete 시 해당 playlist의 pending rename/order도 취소하여 삭제된 문서에 지연 write가 재시도되지 않게 함.
- app298 delete warm path는 그대로 보호: active folder item snapshot이 있으면 삭제 전 `getDocs` R0. 다음 폴더도 정상 item cache가 있으면 R0.
- **cache가 실제로 없는 다음 폴더는 정확성 보호를 위해 최초 bounded R1 fallback을 유지**. 빈 것으로 추정해 R0을 꾸미는 방식은 사용하지 않음.

**변경 / 검증**
- 코드 commit: `114b3095745356f949bac7a323056dd6759ce85b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-299-library-reorder-final-state-batch.mjs`
  - `public/app-version.json` → app299
- Backend V2 Step 2-A Safety Run `37021658904`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37021945536`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app298과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app299 Library reorder 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules source 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / Firebase PREVIEW 배포 후 reorder CACHE LIVE + PC↔모바일 실기기 검증 필요**.

## 0MP. PREVIEW app298 배포 완료 — Library warm 폴더 삭제 사전 read 제거 (2026-10-02 KST)

- Firebase PREVIEW Release Run `37015147954`: **SUCCESS**.
- locked PREVIEW source: `e16183ae37b6c34d509f065afd63b5f3c120a99a`.
- remote `preview.soridraw.com`: app **298**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app298 변경은 Library 활성 폴더 삭제 경로 하나:
  - 이미 로딩 완료된 active playlist의 item IDs를 재사용.
  - 같은 items collection의 중복 `getDocs` 제거.
  - cold/stale 상태에서 item snapshot이 없는 경우 기존 안전 fallback read 유지.
- Backend Safety Run `37014662854`: SUCCESS.
- Release Audit Run `37014825981`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE에서 warm folder delete R0 확인 대기**.

## 0MO. PREVIEW app298 후보 — Library 폴더 삭제 warm R0 (2026-10-02 KST)

**사용자 실기기 발견**
- app297 Library 폴더 삭제에서 정상 쓰기 `user_playlists:batch W1 + users:batch W1` 외에 `user_playlists:getDocs R1`이 추가로 관측됨.
- 사용자는 다른 정상 기능을 건드리지 않고 이 삭제 전 read만 제거해서 PREVIEW 배포하도록 지시.

**원인 / 최소 수정**
- Library 화면은 삭제 대상 활성 playlist의 item 목록을 이미 로컬 cache/state로 보유하고 있는데, `deletePlaylist()`가 서비스 내부의 전역 playlist cache freshness 조건 때문에 같은 items subcollection을 다시 `getDocs()` 할 수 있었음.
- app298은 활성 playlist가 로딩 완료된 경우 화면이 이미 가진 **정확한 item document ID 목록**을 delete service에 전달.
- service는 그 목록이 제공되면 추가 Firestore read 없이 해당 item 문서 + playlist 문서를 기존 batch로 삭제.
- 활성 playlist snapshot이 없거나 아직 로딩 중인 cold/stale 호출은 기존 `getDocs` fallback을 그대로 유지하여 삭제 정확성을 비용 때문에 약화하지 않음.
- UI/CSS, Library create/rename/reorder, Music Note, Recent, heart, Explore, RTDB 구조는 변경하지 않음.

**비용 목표**
- 정상 warm Library folder delete: 사전 Firestore **R0**.
- 쓰기 의미는 그대로: 실제 item delete 개수 + playlist delete W1 + users revision W1.
- 빈 warm folder의 사용자 실측 목표: `user_playlists:getDocs 0`, `user_playlists:batch W1`, `users:batch W1`.
- D1 R0/W0 / Worker 0 유지.

**변경 / 검증**
- 코드 commit: `c0dfac2fa45536692db7eda4ac8602c22067accd`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-298-library-delete-warm-zero-read.mjs`
  - `public/app-version.json` → app298
- Backend V2 Step 2-A Safety Run `37014662854`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37014825981`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app297과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app298 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 전 / Firebase PREVIEW 배포 후 warm folder delete CACHE LIVE 재검증 필요**.

## 0MN. PREVIEW app297 배포 완료 — Library 폴더 reorder 비용/실시간 수정 (2026-10-02 KST)

- Firebase PREVIEW Release Run `36953630146`: **SUCCESS**.
- locked PREVIEW source: `080fa7e98f10c892ec06401c05f824a7b509b61c`.
- remote `preview.soridraw.com`: app **297**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- shared RTDB Rules: **SKIPPED** (rules 변경 없음).
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app297 핵심:
  - Library 마이/공유 폴더 순서 변경 시 전체 폴더 rewrite 제거.
  - 실제 이동한 playlist 문서 하나만 W1.
  - users playlist revision은 기존 60초 UID batch 사용.
  - RTDB `playlist-order` signal로 동일계정 PC↔모바일 즉시 반영.
- app296 사용자 확인:
  - Music Note 폴더 batch에서 마지막 변경 후 60초 `user_structures` W1 추가 확인.
  - 당시 수치는 폴더 삭제까지 포함.
- 남은 실기기 확인:
  - app297 Library reorder 1회가 `user_playlists +1`인지.
  - 상대 기기에 route/refresh 없이 즉시 같은 순서가 보이는지.
  - 60초 내 여러 reorder 후 users revision이 1회로 묶이는지.
  - 영상에서 별도 관측된 Library delete warm-cache miss `getDocs R1`은 reorder PASS 후 별도 확인.
- 상태: **PREVIEW 배포 완료 / Library reorder PC↔모바일 + CACHE LIVE 사용자 재검증 대기**.

## 0MM. PREVIEW app297 후보 — Library 폴더 순서 O(1) 저장 + PC↔모바일 즉시 동기화 (2026-10-02 KST)

**사용자 실기기 발견**
- app296 Music Note 폴더 테스트에서 사용자가 마지막 변경 후 60초에 `user_structures` write 1회가 추가되는 것을 확인. 테스트 숫자는 폴더 삭제까지 포함.
- Library 영상에서는 폴더 순서 변경 1회마다 현재 섹션의 모든 playlist 문서를 다시 쓰고 `users.syncVersions.playlists`까지 즉시 쓰는 비용 회귀가 확인됨.
  - 마이 리스트 6개 기준: 순서 변경 1회당 `user_playlists +6` + `users +1`.
  - 공유 리스트 5개 기준: 순서 변경 1회당 `user_playlists +5` + `users +1`.
- Library 폴더 순서 변경은 RTDB changed-item signal이 없어서 같은 계정 PC↔모바일에 즉시 반영되지 않음.
- 영상 중 Library 폴더 삭제에서는 warm item cache를 사용하지 못한 경우 `user_playlists:getDocs R1`도 관측됨. 삭제 read는 이번 순서변경 수정 범위 밖의 별도 확인 항목으로 남김.

**원인**
- `SunoLibraryPage.tsx`의 기존 `persistPlaylistOrder`가 drag 종료 시 섹션 전체를 1..N으로 다시 번호 매기고 모든 `user_playlists/{uid}/lists/*` 문서를 batch update.
- 같은 batch에서 `users/{uid}.syncVersions.playlists`도 매 drag 즉시 update.
- 순서 변경용 `playlist-order` RTDB operation/receiver가 존재하지 않았음.

**app297 수정**
- 화면 드래그 동작/디자인은 그대로 유지.
- drag 시작 시 기존 canonical order를 snapshot.
- drag 종료 시 화면용 임시 재번호는 제거하고, **실제로 이동한 폴더 하나만** 앞/뒤 이웃 사이의 numeric fractional order로 저장.
- 기존 TEST/PRODUCTION도 numeric `order` 정렬을 그대로 읽을 수 있어 shared data 하위호환 유지.
- 새 `reorderPlaylist` 경로:
  - 이동한 playlist document canonical **W1**.
  - `users.syncVersions.playlists`는 기존 UID 60초 revision batch에 합류하여 반복 drag마다 쓰지 않음.
  - 현재 기기 persistent cache 즉시 patch.
  - RTDB `playlist-order` changed-item signal 즉시 발행.
- 수신 기기:
  - `playlist-order` 하나만 local playlist cache에 patch + sort.
  - Firestore read/write 없이 화면 갱신.
- create/rename/delete/item add/delete/move/color/swap, Music Note, Explore 좋아요, UI/CSS는 변경하지 않음.

**비용 목표**
- 폴더 순서 변경 1회: 기존 `playlist W=N + users W1` → **moved playlist W1**.
- 60초 안 여러 번 reorder: 각 실제 이동당 moved playlist W1, `users` revision은 window 전체 **W1** 목표.
- 수신 기기: Firestore **R0/W0**, D1 **R0/W0**, Worker **0**.
- 같은 폴더를 여러 번 움직이는 canonical order 자체의 60초 final-state collapse는 이번 최소 수정에 포함하지 않음. 먼저 전체폴더 재쓰기와 실시간 동기화 결함을 제거함.

**변경 / 검증**
- 코드 commit: `bc4da91e042a8fbc065971acbd9e4e445f84615b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
- Backend V2 Step 2-A Safety Run `36953291017`: **SUCCESS**.
- Release System Audit Run `36953307140`:
  - TypeScript PASS.
  - Build PASS.
  - 진단 static A~D / syntax E1~E3 PASS.
  - overall FAIL은 기존과 동일한 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 1건.
  - app297 Library reorder 경로와 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW app297 배포 전 후보 / Firebase PREVIEW 배포 후 실기기 재검증 필요**.

## 0ML. PREVIEW app296 — Music Note + Library My/Shared 폴더 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 범위 확정**
- "마이 / 공유"는 Music Note의 마이 노트/공유 노트와 Library의 마이/공유 플레이리스트를 모두 뜻함.
- 공통 원칙: 화면/동일계정 PC↔모바일 반영은 RTDB/local cache로 즉시, canonical Firestore는 안전한 범위에서 **마지막 변경 후 60초 final-state**로 묶음.

**Music Note My/Shared**
- 대상: 폴더 생성 / 이름변경 / 순서변경.
- 변경 즉시:
  - 현재 기기 state + persistent structure cache 반영.
  - 기존 UID-scoped Music Note RTDB structure delta 전송.
  - 반대 기기는 Firestore read 없이 structure patch를 적용.
- canonical:
  - `user_structures/{uid}` 폴더 구조 pending을 UID 단위 localStorage + memory에 보관.
  - 마지막 폴더 구조 변경 후 60초에 My/Shared 최신 구조를 **한 문서 W1**로 저장.
  - 60초 안 같은/다른 My/Shared 폴더 구조 변경이 여러 번 있어도 마지막 구조만 canonical.
  - 기존 `syncMusicNoteStructureVersion` Function은 canonical `user_structures` 변경 때만 실행되므로 반복 UI 변경 횟수만큼 호출되지 않고 batch canonical 횟수로 축소.
- 안전:
  - pending은 RTDB 요청 전에 먼저 durable 저장하여 background/reload 중 canonical intent 유실 방지.
  - RTDB UID monotonic signal version을 받아 local cache/pending version floor로 사용.
  - 실제 곡 membership이 바뀌는 **폴더 삭제는 batch 대상에서 제외하고 즉시 canonical**. 삭제 후 affected favorites의 default 이동도 기존 changed-song-only 경로 유지.
  - 곡을 폴더에 넣기/빼기 역시 실제 favorite membership write이므로 이번 구조 batch와 분리.

**Library My/Shared**
- app295 compatibility revision window를 30초 → **60초**로 통일.
- 일반 탭 숨김/SPA route 이동만으로 조기 flush하지 않음. pending은 durable하게 남고 실제 page unload에서만 best-effort flush.
- 폴더 생성:
  - 새 playlist document W1은 즉시 유지. 새 ID를 즉시 사용하고 TEST/PRODUCTION 구버전과 shared data 호환을 지켜야 하기 때문.
  - `users.syncVersions.playlists`는 60초 UID batch W1.
  - app294 empty-items cache seed 유지 → 생성 직후 items Firestore read R0 목표.
- 폴더 이름변경:
  - 현재 기기 cache + 반대 기기 RTDB `playlist-rename`은 즉시.
  - canonical playlist title은 60초 final-state batch.
  - 같은 폴더를 여러 번 rename하면 마지막 title만 W1.
  - 여러 폴더를 같은 window에서 rename하면 변경된 unique playlist document당 W1 + users revision W1.
  - canonical settlement 뒤 `playlist-rename-batch` RTDB signal로 current app cache version도 같은 revision으로 맞춰 불필요한 Firestore reread를 방지.
  - 더 최신 반대기기 rename/delete signal이 오면 오래된 local pending rename을 취소하여 stale final-state overwrite 방지.
- Library item add/delete/move/color/swap, playlist delete는 실제 membership/데이터 변경이므로 기존 즉시 canonical 경로 유지.
- Library folder reorder는 현재 legacy per-playlist order 문서 구조를 유지. aggregate cutover 전에는 임의로 W1 구조로 바꾸지 않음.

**Library aggregate 구조 판단**
- Music Note처럼 Library 폴더 ID/title/order를 한 aggregate document에 모으는 구조는 가능하고 장기 목표로 유지.
- 하지만 현재 TEST/PRODUCTION 구버전은 `user_playlists/{uid}/lists/*`를 직접 읽으며 사용자 원본 DB를 PREVIEW와 공유함.
- PREVIEW만 aggregate writer를 추가하면 legacy list write + aggregate write가 동시에 필요해 **오히려 비용이 늘어남**.
- 따라서 app296에서는 새 aggregate server write를 만들지 않음.
- 안전한 cutover 순서: 새 코드가 aggregate read/fallback을 지원 → PREVIEW 검증 → TEST/PRODUCTION 동일 코드 승격 → 모든 환경이 새 구조를 읽을 수 있는 시점에 legacy per-folder metadata write 제거.
- 그 cutover 이후 Library 폴더 생성/이름/순서 구조도 Music Note처럼 N회 변경 → aggregate W1 목표가 가능함. 데이터 migration/backfill은 별도 사용자 승인 없이는 실행하지 않음.

**비용 목표**
- Music Note 폴더 구조 7회 연속 변경: Browser canonical `user_structures` **W7 → W1 목표**. Function 후속도 canonical 1회 기준으로 축소.
- Library 동일 폴더 rename 7회: playlist title W1 + users revision W1 = **W2 목표**.
- Library 서로 다른 기존 폴더 5개 rename: playlist W5 + users W1 = **W6 목표**.
- Library 새 폴더 5개 생성: playlist W5 + users revision W1 = **W6 목표**, items read R0.
- private folder test D1 R0/W0 / Worker 0 유지 목표.
- 위 수치는 code-path 목표이며 사용자 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

**변경 / 검증**
- 신규 `src/services/musicNoteFolderStructureBatch.ts`: 60초 durable Music Note structure outbox.
- `src/pages/FavoritesPage.tsx`: Music Note folder local/RTDB-first + canonical 60초 batch, delete immediate safety.
- `src/services/userDomainSyncService.ts`: Music Note structure RTDB monotonic version 반환.
- `src/services/libraryPlaylistRevisionBatch.ts`: 60초 window.
- `src/services/playlistService.ts`: Library rename final-state 60초 durable batch + cross-device stale pending fence.
- `src/pages/SunoLibraryPage.tsx`: 60초 batch resume/pagehide serialized safety.
- app296 verifier: `scripts/verify-296-folder-final-state-batch.mjs`.
- app version: **296**.
- Backend V2 Step 2-A Safety:
  - Run `36950337897` SUCCESS.
  - Run `36950358483` SUCCESS.
- Release System Audit Run `36950546019`:
  - TypeScript PASS.
  - Build PASS.
  - static groups A~D / syntax guards PASS.
  - overall FAIL은 app294/app295와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건. app296 folder batch 경로와 무관.
- focused source inspection: app296 60초 Music Note batch / Library revision 60초 / Library rename final-state / app294 new-folder R0 보호 조건 PASS.
- Worker / Functions source / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- Firebase PREVIEW Release Run `36950877406`: **SUCCESS**.
- locked PREVIEW source: `2c230b9dd0fe47bff31f83412919d335fb98a2ff`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **296**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / 사용자 PC↔모바일 + CACHE LIVE 비용 실측 대기**.

## 0MK. PREVIEW app295 — Library My/Shared 폴더 공통 revision 30초 묶음 저장 (2026-10-02 KST)

**목표**
- 사용자 요청: My / Shared playlist 폴더의 불필요 Firestore write를 기능 손상 없이 가능한 선에서 축소.
- app294의 새 폴더 생성 직후 R0 개선과 기존 changed-item RTDB 즉시 동기화는 그대로 보호.

**app295 구조**
- 폴더 자체 canonical 변경은 지연하지 않음:
  - playlist create: `user_playlists/.../lists/{id}` W1 즉시.
  - playlist rename: 해당 list document W1 즉시.
- 기존 매 create/rename마다 붙던 `users/{uid}.syncVersions.playlists` W1은 UID 단위 **30초 trailing batch**로 분리.
- 같은 UID에서 30초 안 create/rename이 N번이면 목표 canonical write는 기존 `W2 x N` → **folder WN + users revision W1 = W(N+1)**.
  - 1회 작업은 총 W2로 기존과 동일.
  - 2회 연속은 W4 → W3.
  - 5회 연속은 W10 → W6.
- 현재 app PC↔mobile 화면 반영은 기존 RTDB `userSync/{uid}/libraryPlaylist` changed-item signal을 그대로 즉시 사용하므로 30초를 기다리지 않음.
- TEST/PRODUCTION 구버전 호환용 Firestore revision만 묶으며, Library 페이지를 숨기거나 이탈하면 pending revision을 조기 flush해 호환 지연을 줄임.

**안전 장치**
- pending revision은 localStorage + memory fallback에 보관. 일반 reload/navigation으로 의도가 사라지지 않음.
- 현재 세션에서 이미 관측한 RTDB latest syncVersion을 monotonic floor로 재사용하여 정상 batch flush에 추가 RTDB read를 붙이지 않음.
- 세션 재시작 등 floor가 없을 때만 shared RTDB latest signal을 1회 확인. 확인 실패 시 낮은 revision을 쓰지 않고 fail-closed로 pending 유지.
- item add/delete/move/color/order-swap, playlist delete, playlist reorder처럼 기존 users revision을 즉시 쓰는 경로가 더 높은 version을 확정하면 오래된 folder pending batch를 제거하여 중복 delayed write 방지.
- USER_PROFILE_CACHE_EVENT에서 더 높은 remote playlist revision을 받는 경우에도 오래된 local pending을 제거.
- 기존 app294 empty-folder items cache seed 유지: create 직후 Firestore item read R0 목표.
- folder delete / item mutation / playlist reorder canonical write 구조는 이번 범위에서 변경하지 않음.
- 사용자 데이터 migration/backfill/delete 없음. schema 의미 변경 없음.

**변경 파일 / commits**
- 신규 `src/services/libraryPlaylistRevisionBatch.ts`: `bcc346c0aa2499ea06937c230d94e73de13645c8` 이후 안전 보강 `516e9e74b9ae6b0c3e3e13bdd6476b9fc51b19c3`, `e465146bac3651da652269f4a34ade5691ed4fba`.
- `src/services/playlistService.ts`: create/rename users revision batch 분리 + immediate mutation pending retire. 핵심 commits `bde6b4528c3bd9b380685d4a5b50865c011d78a1`, `77aa75f73dc6459af82ca96811270ba42ec2c480`.
- `src/pages/SunoLibraryPage.tsx`: durable batch resume / visibility-pagehide flush / remote newer revision retire. commits `4cd2700b460b4297186f7cb815289d01e6049f3c`, `3c1af755a9cda7cee1ef08e774500bfd7ff4de12`.
- app294 verifier forward-compatible: `d4345c43eadfbf3d336a98aab06e4a47512b656a`.
- app version 295: `fa9dc0d2693bb2bc9a42a5ad04a9b67c5307f746`.
- 신규 focused verifier: `scripts/verify-295-library-folder-revision-batch.mjs`, latest `69902bce0a216341b5872c5eb1d2f724d72731f6`.

**검증 상태**
- Backend V2 Step 2-A Safety Run `36942643704`: SUCCESS (초기 playlistService batching 적용).
- Backend V2 Step 2-A Safety Run `36943137531`: latest playlistService signal-floor 보강 기준 SUCCESS.
- Release System Audit Run `36943212496`: TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 audit는 app294 때와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` assertion 때문에 FAIL; app295 Library 경로와 무관.
- 최종 Release System Audit Run `36943416655`: latest memory fallback 포함 TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 static 단계는 동일한 기존 `verify-221` stale assertion만 반복 FAIL.
- Firebase PREVIEW Release Run `36943574387`: **SUCCESS**.
- locked PREVIEW source: `b3ce248ee41ac075a8713b37d6aaa77755fac028`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **295**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**실기기 비용 확인 목표**
- 새 folder 1회: Firestore R0 목표, 즉시 folder W1 + 30초 후 users revision W1 = 총 W2.
- folder create/rename 5회 연속 후 30초 대기: 기존 W10 대신 목표 **W6**.
- 같은 구간 D1 R0/W0, Worker 0 유지.
- 반대 기기에서는 폴더 생성/이름 변경이 30초 대기 없이 즉시 보이는지 확인.

## 0MJ. PREVIEW app294 — Library 새 폴더 생성 직후 불필요 read 제거 (2026-10-02 KST)

**사용자 실기기 app293 비용 확인**
- 영상 누적 Browser SDK: Firestore read 3 / write 15.
- Cloudflare / Worker / D1: R0/W0.
- Music Note folder rename은 곡 수와 무관하게 structure W1 / favorites W0로 동작 확인.
- Library My/Shared playlist create/rename은 현재 하위호환 canonical 계약대로 W2 유지.
- 남은 read 3은 새 Library playlist 3개 생성 직후, UI가 방금 생성된 빈 폴더를 선택하면서 items cache가 없어 `user_playlists/.../items getDocs`를 각 1회 실행한 경로로 확인.

**app294 수정**
- `src/services/playlistService.ts`의 `createPlaylist()` canonical commit 성공 직후:
  - playlist list cache patch와 함께
  - 새 playlist ID의 items cache를 같은 `syncVersion`의 빈 배열로 즉시 seed.
- 방금 생성된 폴더는 canonical로 빈 폴더임이 이미 확정돼 있으므로, 선택 직후 `SunoLibraryPage`의 items loader가 이 로컬 cache를 current로 인정하고 Firestore `getDocs`를 생략.
- My / Shared 양쪽 모두 같은 `createPlaylist()` 경로를 사용하므로 공통 적용.
- create canonical write 계약은 **W2 그대로**. RTDB changed-item signal, 기존 playlist list/items revision 구조, UI는 변경 없음.
- create-and-save 경로도 먼저 빈 current items cache를 갖게 되어 후속 첫 item insert의 warm R0 판단을 그대로 사용할 수 있음.

**폴더 30/60초 묶음 저장 판단**
- 이번 app294에서는 적용하지 않음.
- 서로 다른 폴더 create/rename은 각각 별도 canonical playlist 문서이므로 단순 writeBatch로 네트워크 요청을 묶어도 Firestore 과금 write 수 자체는 줄지 않음.
- 같은 폴더 이름을 짧은 시간 여러 번 바꾸는 경우 final-intent batching은 기술적으로 가능하지만, 현재 PREVIEW가 TEST/PRODUCTION 구버전과 shared data를 동시에 사용하고 `users.syncVersions.playlists` 하위호환 신호도 유지해야 해 즉시 canonical W2 계약을 우선 보호.
- 향후 별도 최적화 시 가장 현실적인 후보는 여러 playlist 변경의 공통 `users.syncVersions.playlists` revision write를 UID 단위로 묶는 방식이며, old-client convergence와 crash/reload durability를 먼저 설계해야 함.

**변경 commit**
- product fix: `7decc68c80114eae11129894135346992054b7cb`.
- focused verifier: `be1ee8cc091f4150510ba16abdc485b44e4689cf`.
- app version 294: `42ea54fc1284d46e8030240d51633bae64d661cf`.

**검증/배포 상태**
- `scripts/verify-294-library-new-folder-r0.mjs` 추가: create 경로에 server `getDocs`가 없고 canonical 성공 후 새 playlist의 빈 items cache를 같은 syncVersion으로 seed하는 계약 고정.
- Release System Audit Run `36941393567`: **FAIL**. 단, 이번 수정과 직접 관련된 TypeScript / Build 및 진단 그룹 A~D는 PASS. 최종 static 단계에서 기존 `verify-221-explore-feed-layout.mjs`가 현재 Music Note detail hydrate 구현 형태를 옛 정규식으로 검사해 assertion FAIL. app294 Library 변경 경로와 무관하며 이 작업에서는 제품/검사 범위를 넓혀 수정하지 않음.
- Firebase PREVIEW Release Run `36941526371`: **SUCCESS**.
- locked PREVIEW source: `3c9f1d67a72aaf9b94408f0d050752f8b47e439f`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **294**, exact build PASS.
- shared RTDB Rules: SKIPPED (변경 없음).
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: 없음.
- Worker / Functions / D1 / Firestore Rules 변경: 없음.
- 실기기 다음 확인: My/Shared에서 새 폴더 생성 시 `user_playlists:getDocs`가 더 이상 증가하지 않아 **create 직후 R0**인지 확인.

## 0MI. PREVIEW app293 배포 완료 — Library changed-item sync + Music Note folder rename 비용 절감 (2026-10-02 KST)

**배포/검증 기준**
- 기준 branch: `preview`.
- 제품 구현 시작: `b3f4443ecb873006eb93f4dd6e3a4df05556470e`.
- missed-delta 안전 보강: `c86a9ae7b86349ddb3ef39f4d059434441f8cba4`.
- RTDB continuity rules: `f49ca39ba717dc62afbecba0c2ab5184c63081bf`.
- focused verifier 최종: `35986cee25f6dcf128fa9c61b37a5bcbc4661783`.
- runtime cleanup: `e7b0c172dd2a9763911263c46924fc098980b537`.
- app version 293: `dfc094b13ef4c0a98378c22dc740766319489275`.
- PREVIEW release/locked source: `d0a0fd540e7104c7a70be82489758a14e30e48c9`.
- 최종 focused Audit Run `36938832665`: **SUCCESS**.
- Backend V2 Safety Run `36938820471`: **SUCCESS**.
- Firebase PREVIEW Release Run `36939049573`: **SUCCESS**.
- remote `preview.soridraw.com`: app **293**, exact build PASS.
- shared RTDB rules: exact source match + deploy PASS.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: **없음**.
- Worker / Functions / D1 / Firestore Rules 변경: **없음**.

**Library My/Shared Playlist**
- 기존 canonical Firestore 구조와 `users.syncVersions.playlists` / `itemsRevision`을 유지하여 app292 이하 TEST/PRODUCTION과 하위호환.
- 변경 성공 후 UID-scoped RTDB `userSync/{uid}/libraryPlaylist`에 최대 24KB changed-item delta 1개를 게시.
- 정상 cache + 연속 signal이면 반대 기기는 Firestore를 다시 읽지 않고 IndexedDB list/item cache를 직접 patch.
- signal은 `previousSyncVersion` continuity token을 포함. 기기가 offline 중 중간 delta를 놓쳤거나 payload가 oversized/truncated이면 cache revision을 거짓으로 앞당기지 않고 기존 Firestore fallback 1회로 복구.
- warm add/move에서 destination item cache가 current이면 duplicate + max-order 계산을 로컬에서 처리하여 사전 Firestore read **R0 경로**.
- warm playlist delete는 current item cache의 IDs를 사용하여 삭제 대상 탐색 Firestore read **R0 경로**. 실제 item canonical delete write는 데이터 삭제이므로 그대로 유지.
- canonical write 수는 이번 단계에서 의도적으로 유지:
  - playlist create/rename: W2.
  - item add/delete: W3.
  - item move: W5.
  - item order swap: W4.
  - 이유: TEST/PRODUCTION 구버전도 shared canonical data 변화를 계속 감지해야 하므로 parent/items revision + users revision을 아직 제거할 수 없음.
- Library social like `toggleTrackLike`의 R2/W2 transaction은 **이번 app293 범위 밖, 미변경**. 별도 후속 최적화 대상.

**Music Note**
- folder rename은 `user_structures/{uid}`의 folder structure만 canonical로 갱신.
- 기존 song의 `noteFolderTitle/sharedNoteFolderTitle` legacy copy는 읽기 호환용으로 그대로 두고 더 이상 rename 때 N곡을 재작성하지 않음.
- folder membership/filter는 기존처럼 stable folder ID를 사용.
- 코드상 rename 비용 목표: 기존 `structure W1 + favorites WN` → **structure W1 / favorites W0**.
- folder delete는 곡들의 folderId를 default로 실제 변경해야 하므로 현재 WN을 유지. 구버전 호환을 깨지 않고 제거할 수 없어 이번에는 건드리지 않음.

**보호된 기존 기능**
- app292 Recent 150초 UID-wide canonical batch 유지.
- Studio heart 30초 per-song final-intent batch 유지.
- favoriteCount 30초 UID-wide batch 유지.
- Music Note Detail draft/batch/RTDB preview 유지.
- Library workspace warm cache/re-entry R0 경로 유지.
- Explore / public like / 공개·비공개 / split UI 미변경.

**검증**
- TypeScript PASS.
- Build PASS.
- `APP293_LIBRARY_PLAYLIST_DELTA_SYNC=PASS`.
- `APP293_LIBRARY_WARM_INSERT_SERVER_R0_PATH=PASS`.
- `APP293_LIBRARY_WARM_DELETE_DISCOVERY_R0_PATH=PASS`.
- `APP293_MUSIC_NOTE_FOLDER_RENAME_W1_ONLY=PASS`.
- Library 101 / 030 / 116 warm-cost regressions PASS.
- Music Note Detail 031 PASS.
- app289 heart / app290 Recent / app290 Studio heart / app291 lyrics regressions PASS.
- 첫 Audit Run `36938199952`의 FAIL은 제품 코드가 아니라 app196 이후 변경된 Recent sync gate를 옛 문자열로 검사하던 `verify-116`의 stale assertion 때문. 현재 pure `needsRecentSongsServerRead()` 의미 기준으로 verifier를 갱신한 뒤 final Audit SUCCESS.

**실기기 확인 전 비용 판정**
- 위 수치는 code/static guard 기준.
- PC↔모바일 실제 즉시 반영과 CACHE LIVE Firestore R/W는 사용자 실기기 검증 전까지 **실사용 검증 전**.
- 사용자 `테스트배포` 지시 전 main/TEST 승격 금지.

## 0MH. Music Note / Library 저장·동기화 비용 구조 감사 (2026-10-02 KST)

**범위 / 상태**
- 코드 수정/배포 없이 현재 PREVIEW app292 구조를 정적 감사.
- Music Note 목록 버튼, Detail 편집, My/Shared Note 폴더, Library Workspace, My/Shared Playlist 폴더·아이템, 기기간 동기화 경로 확인.
- 아래 비용은 코드 경로 기준이며 별도 실기기 CACHE LIVE 재측정 전에는 운영 실측값으로 단정하지 않음.

**Music Note — 현재 좋은 구조**
- 목록 개인 좋아요/잠금:
  - 로컬 + localStorage 즉시 반영.
  - UID-scoped RTDB `musicNoteCardStateDelta`로 반대 기기 즉시 반영.
  - 페이지 안 반복 클릭은 Firestore W0.
  - dirty state를 페이지 이탈 시 `user_structures/{uid}.musicNoteCardState` 한 번 W1로 저장.
- Detail 제목/프롬프트/가사 등:
  - 필드 저장은 local durable draft에 합산하며 field-save마다 Firestore write 없음.
  - title/detail/Suno media preview는 compact RTDB preview로 반대 기기 반영.
  - canonical flush 시 해당 `favorites/{id}` W1.
  - 현재 실제 `scheduleFavoriteDetailFlush()`는 no-op이므로 오래된 60초 설명과 달리 자동 60초 flush는 없음; page-exit/manual/recovery 중심.
- Detail open:
  - 목록은 compact catalog summary.
  - 필요한 경우에만 exact `favorites/{sourceId}` 1건 hydrate; detail cache 재사용.
- My/Shared Note 폴더 구조:
  - folder metadata는 `user_structures/{uid}` aggregate + local cache/session.
  - folder add/reorder는 structure W1.
  - structure RTDB changed patch로 반대 기기 갱신; persistent Firestore structure listener 없음.
  - 기존 폴더에 1곡 배치/제거는 해당 favorite W1; N곡 선택은 changed-song-only WN.

**Music Note — 개선 필요 지점**
- 폴더 이름 변경:
  - structure W1 이후 해당 폴더의 모든 favorite에 중복 저장된 `noteFolderTitle/sharedNoteFolderTitle`을 다시 써서 **W1 + W(폴더곡수)**.
- 폴더 삭제:
  - structure W1 이후 해당 폴더 모든 곡을 default folder로 옮겨 **W1 + W(폴더곡수)**.
- 원인: song 문서에 folderId뿐 아니라 folderTitle을 중복 저장.
- 향후 개선 방향: folderId를 canonical membership으로 유지하고 화면 title은 structure에서 resolve, legacy title은 fallback만 사용하도록 하위호환 전환하면 rename fan-out을 W1로 줄일 수 있음. 사용자 승인 전 schema 의미 변경/백필 금지.
- 공개(globe) 경로는 Explore Worker/R2/D1 별도 보호 경로. warm publication-state read는 revision/R2 cache 중심이며 D1 R0/W0 경로가 있으나, 이번 감사에서 Worker mutation rows_written을 재실측하지 않았으므로 기존 동결 기준을 임의 수정하지 않음.

**Library Workspace — 현재 좋은 구조**
- authenticated session 동안 workspace snapshot/listener를 한 번 유지하고 page re-entry는 in-memory/IndexedDB cache 재사용.
- 정상 재진입은 server read 0 목표 경로.
- 더보기는 full local catalog의 UI pagination만 수행하여 추가 server read 없음.
- 색상 변경은 화면/로컬 먼저 변경하고 page exit에 changed keys만 저장.

**Library My / Shared Playlist — 비용 개선 필요**
- playlist list는 IndexedDB cache + `users.syncVersions.playlists` revision gate를 사용해 warm entry R0 가능.
- 하지만 cross-device 변경은 Music Note/Recent처럼 changed-item RTDB payload로 직접 patch하지 않고 revision 상승 후 collection refresh:
  - list revision이 바뀌면 playlist list collection 재조회.
  - active playlist의 `itemsRevision`이 바뀌면 그 playlist의 **전체 items collection 재조회**.
- mutation canonical 비용:
  - 폴더 생성/이름변경: list doc W1 + users revision W1 = **W2**.
  - 곡 추가: duplicate/order 확인 bounded read(최대 source query 8 + tail 1) + item W1 + parent itemsRevision W1 + users revision W1 = **W3**.
  - 곡 삭제: item W1 + parent revision W1 + users revision W1 = **W3**.
  - 곡 이동: new item W1 + old item delete W1 + source parent W1 + target parent W1 + users revision W1 = **W5**, plus bounded duplicate/order reads.
  - 순서 swap: two item W2 + parent W1 + users W1 = **W4**.
  - folder delete: 먼저 folder items 전체 `getDocs` 후 item 수만큼 delete + folder delete W1 + users revision W1 → **R/W가 폴더 곡 수에 비례**.
  - playlist color sync: changed item마다 item + parent revision + users revision = **W3/item**.
- Library playlist social like `toggleTrackLike`:
  - 클릭마다 canonical relation + count 2건 transaction read, 변화 시 relation + count 2건 write.
  - local optimistic UI는 있으나 Recent/Studio heart 같은 trailing batch/RTDB cross-device final-intent 구조는 아님.
- 따라서 **Library My/Shared Playlist는 app292 Recent/Music Note 수준의 비용 최적화라고 판정할 수 없음**.

**안전한 다음 최적화 후보 — 아직 미실행**
1. Library playlist changed-item RTDB signal + local cache patch로 cross-device one-item change 시 전체 playlist items reread 제거.
2. playlist item mutation의 parent revision/users revision 중복 write 축소 또는 UID aggregate/batched revision 설계.
3. playlist folder delete의 full items read/delete fan-out 재설계.
4. Library social like를 local-first + final-intent batch 방식으로 전환 가능한지 별도 설계.
5. Music Note folder title duplication 제거를 backward-compatible 방식으로 설계해 rename fan-out 제거.
6. Music Note Detail의 실제 no-idle-flush 동작과 오래된 60초 문서 설명을 정리하되, 사용자 승인 없이 정상 동작 변경 금지.

## 0MG. Song Save / Edit / Sync Cost 스킬 저장 (2026-10-02 KST)

- 신규 스킬: `.agents/skills/song-save-edit-sync-cost/SKILL.md`
- 기준 문서: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app292-save-edit-sync-cost-baseline.md`
- 범위:
  - Studio 저장/해제 하트 30초 per-song canonical batch
  - Recent Song 제목/프롬프트/가사 150초 UID-wide aggregate batch
  - PC↔모바일 RTDB 즉시 changed-item preview
  - preview receiver Firestore R0/W0 원칙
  - `users.favoriteCount` UID-wide 30초 derived-delta batch
  - net-zero W0 / changed-item-only / durable pending / stale overwrite 방지
  - app289~292 회귀검사와 실기기 비용 확인 기준
- `AGENTS.md`에 관련 작업 전 신규 스킬 필수 확인 규칙 추가.
- 코드/백엔드/사용자 데이터 변경 없음.
- PREVIEW/TEST/PRODUCTION 배포 변경 없음.

## 0MF. Music Note 저장곡 수 통계 batch 구조 유지 확정 (2026-10-02 KST)

**사용자 결정**
- 실제 저장/해제 곡 문서는 곡별 정확한 canonical 상태를 유지.
- `users/{uid}.favoriteCount`는 파생 통계이므로 클릭마다 쓰지 않고 UID 단위 30초 delta batch를 유지.
- 같은 30초 안 여러 곡 저장/해제는 `+1/-1` 변화량을 합산해 `users.favoriteCount`를 한 번만 갱신.
- 합산 결과가 0이면 통계 write 0.
- 이 통계값을 저장 제한/권한/결제 판정의 canonical 기준으로 사용하지 않음.

**현재 실제 코드 확인**
- `src/services/musicNoteFavoriteCountBatch.ts`에 이미 위 구조가 구현되어 있음.
- UID별 단일 pending delta + 30초 trailing timer + localStorage 복구 구조.
- 실제 canonical favorite 변경이 성공한 경우에만 `queueMusicNoteFavoriteCountDelta(uid, ±1)`를 호출.
- 따라서 추가 기능 수정은 불필요하며 현재 구조를 정상 기준으로 동결.
- UI/백엔드/데이터 구조 변경 없음. 배포 불필요.

## 0ME. PREVIEW app292 배포 완료 — Recent canonical batch 150초 + 다중곡 동작 확인 (2026-10-02 KST)

**사용자 결정**
- Recent Song 제목/프롬프트/가사 canonical Firestore trailing batch를 60초 → **150초**로 연장.
- PC↔모바일 즉시 화면 반영 RTDB preview는 그대로 유지.
- Studio Music Note heart의 30초 per-song batch는 변경하지 않음.

**동작 기준**
- Recent Song 편집:
  - 같은 UID의 Recent 목록 전체가 하나의 aggregate document이므로 pending snapshot/timer도 UID당 1개.
  - 150초 안에 A곡 제목 → B곡 프롬프트 → C곡 가사처럼 서로 다른 곡을 수정해도 매 수정마다 같은 150초 timer가 다시 시작됨.
  - 마지막 수정 후 150초가 지나면 그 시점의 Recent 목록 최종 상태를 canonical 1회 저장.
  - 현재 구조 기준 canonical 비용은 곡 수가 아니라 aggregate 1회 기준 `user_recent_songs W1 + users.syncVersions W1 = W2`.
  - 즉시 RTDB preview는 변경된 각 곡만 보내며 Firestore R0/W0.
- Studio heart:
  - **Recent 편집과 다름.**
  - heart pending/timer는 favorite document ID(곡)별 Map으로 관리.
  - A곡 heart 후 B곡 heart를 눌러도 A곡 30초 timer는 B곡 때문에 다시 시작되지 않음.
  - 같은 곡을 다시 누를 때만 그 곡 timer가 reset되고 final state로 collapse.
  - 여러 곡의 final heart 상태가 각각 달라지면 canonical favorite write도 각 곡 W1씩 필요.
  - 다만 `users.favoriteCount` 파생 통계 delta는 UID 단위 30초 batch로 합쳐질 수 있음.

**수정 / 검증**
- verified source commit: `34127904db7bb158ebcae28000fa65745fe56c8b`.
- release request commit: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- apply/audit Run `36932805247`: **SUCCESS**.
- `APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS`.
- `APP292_RECENT_MULTI_SONG_AGGREGATE_BATCH=PASS`.
- app290 Studio heart batching regression PASS.
- app291 lyrics live preview regression PASS.
- app289 Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- TypeScript PASS / Build PASS.
- 임시 apply workflow는 verified source commit에서 제거됨.

**PREVIEW 배포**
- Firebase PREVIEW Run `36933026848`: **SUCCESS**.
- locked deploy source: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- `preview.soridraw.com` app **292** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

## 0MD. PREVIEW app291 배포 완료 — Recent 가사 편집도 PC↔모바일 즉시 반영 + app290 실기기 비용 확인 (2026-10-02 KST)

**app290 사용자 실기기 / CACHE LIVE 비용 확인**
- 사용자 영상(약 2분 10초) 기준 브라우저 SDK server read **0** 유지.
- D1 **R0 / W0**, Cloudflare Worker **0**.
- 최종 관측 write:
  - `favorites:write 1`
  - `user_recent_songs:write 1`
  - `users:write 2`
  - 합계 Firestore SDK write **4**.
- 의미:
  - Studio heart 실제 최종 변경 1회 = canonical favorite W1 + 30초 묶음 `users.favoriteCount` W1 → **총 W2**.
  - Recent 제목/프롬프트/가사 연속 편집 = `user_recent_songs` W1 + `users.syncVersions.recentSongs` W1 → **총 W2**.
  - 편집 3종이 각각 W2로 반복되던 기존 W6은 재현되지 않고 최종 1묶음 W2로 collapse.
  - 읽기는 0이므로 app290 비용 hard gate(W1~W2/action) 기준 통과.
- CACHE LIVE에서 Music Note/Recent cache hit은 증가했지만 원본 Firestore read 증가 없음.

**사용자 실기기 기능 확인**
- 제목 수정 후 저장 → 반대 기기 즉시 반영.
- Studio 저장 하트 → 반대 기기 즉시 반영.
- 프롬프트 수정 → 반대 기기 즉시 반영.
- 가사만 즉시 반영되지 않고 약 60초 canonical batch 뒤 반영되는 증상 발견.

**가사 지연 ROOT CAUSE**
- Recent edit RTDB preview에는 최신 top-level `lyrics.korean/english`가 이미 포함되어 있었음.
- 그러나 Studio 가사 렌더는 `appliedKeywords.lyricsByLanguage`를 우선 사용.
- 수신기에서 top-level lyrics는 갱신했지만 기존 `lyricsByLanguage` map은 그대로 남겨서 화면이 오래된 가사를 계속 표시.
- 60초 후 canonical aggregate가 full `lyricsByLanguage`를 가져오면서 그때 화면이 바뀌어 "1분 뒤 반영"처럼 보였음.
- 서버 전송 지연이 아니라 **수신 기기 로컬 merge 누락**이 원인.

**app291 최소 수정**
- `src/App.tsx` Recent edit preview 수신 시:
  - 기존 RTDB payload의 최신 `lyrics.korean/english`를
  - 수신 기기의 `appliedKeywords.lyricsByLanguage`에도 즉시 local merge.
  - secondaryLanguage를 보존하여 영어 외 일본어/중국어 등 기존 2차 언어 위치도 유지.
- **추가 RTDB write 0**.
- **추가 Firestore R0/W0**.
- canonical 60초 batch와 비용 구조는 app290 그대로.
- 제목/프롬프트/하트/Music Note app289 경로 비변경.

**검증**
- 제품 수정 commit: `9ca5c6707dcd1b2b0380d88d5b28e5b32813a5d3`.
- historical app289 verifier version pin 보정 commit: `65fcdf2a6d5e4e7fa31ad5348580761643b356a3`.
- app291 Audit Run `36929318487`: **SUCCESS**.
- TypeScript PASS / Build PASS.
- `APP291_RECENT_LYRICS_PREVIEW_LOCAL_LANGUAGE_MAP=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_EXTRA_RTDB_WRITE_ZERO=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_FIRESTORE_R0_W0=PASS`.
- app290 Recent cost batching regression PASS.
- app290 Studio heart batching regression PASS.
- app289 oversized Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- 임시 app291 audit workflow 제거 완료.

**PREVIEW 배포**
- release commit: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- Firebase PREVIEW Run `36929528762`: **SUCCESS**.
- locked source: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- `preview.soridraw.com` app **291** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

**다음 실기기 확인**
1. PC/모바일 모두 app291 확인.
2. 같은 Recent Song의 한글/2차언어 가사를 수정 저장 → 반대 기기에서 **1분 대기 없이 즉시** 변경되는지 확인.
3. 제목/프롬프트/하트 즉시 반영 회귀 없음 확인.
4. 비용은 app290과 동일하게 Recent 편집 최종 W2, heart 실제 최종 변경 W2 이하 유지 확인.
5. 실기기 PASS 전 TEST 승격 금지.

## 0OW. 팔로우·크리에이터 추천 구현 후보 — 릴리스 BLOCKED, app344 유지 (2026-10-04 KST)

**작업 기준**
- branch `preview`, 시작 HEAD `2817327ee17f04fe248df237a3daefa3cf5bf3c5`.
- 이 항목을 포함한 preview commit은 구현 후보이며, app345 배포 완료본이 아니다.
- PREVIEW만 작업. main/TEST/PRODUCTION 변경 및 배포 0.

**작업 A — 구현 및 원인 재현**
- 관계 INSERT + 양쪽 counter를 단일 UPSERT로 묶음. 해제도 양쪽 counter를 단일 UPDATE + 관계 DELETE로 묶음.
- 동일 atomic D1 batch, RETURNING/no-postread, R2 target guard/counter patch 보호.
- 정상 경로 logical query R0/W3 → R0/W2.
- 관계 INSERT 직후 `changes() = 1`로 counter를 보호하여 같은 millisecond의 중복 follow가 counter를 중복 증가시키지 않음. 실제 D1 batch에서 changes() 연속성은 미검증.
- canonical `profile_stats`, derived profile counter 및 변경 신호는 기존 코드와 호환되도록 유지. schema/trigger 실제 변경 0.
- 관계 1행 + 양쪽 canonical counter 2행 = 최소 3개 canonical 행 변경. 이를 W1/W2 physical로 보이게 하려고 counter를 R2만으로 옮기면 기존 TEST/PRODUCTION 숫자 authority가 깨지므로 실행하지 않음.
- 현재 trigger 경로의 synthetic SQLite 재현: 관계 1 + canonical counter 2 + derived profile 2 + seq 2 + profile journal 2 = **total_changes 9**.
- follow/unfollow 3회씩: baseline도 9, 후보도 9. **physical amplification 미해결**. 쿼리를 묶었다는 이유로 비용 정상화 PASS 처리 금지.
- SQLite total_changes는 D1 index 비용 포함 Rows Read/Written이 아니다.
- 사용자 실제 baseline: query R0/W3, Rows Read 18~19, Rows Written 14~17. 수정 후 실제 D1 Rows Read/Written, Worker, R2 A/B는 **미검증**.
- `scripts/verify-345-follow-cost.mjs`: production 함수 자체를 추출해 기존 schema/032/249 trigger fixture에서 3 cycle, 양쪽 canonical/derived 수치, duplicate no-op, indexed UPDATE, Feed journal 불변, rollback을 검사. `--release`는 실제 PREVIEW 6 sample evidence 없이 실패한다. 비용 gate를 완화하지 않음.

**작업 B — 구현 범위와 미완료**
- latest 40 owner-only 후보를 curated 40 + latest 40 + popular 40의 bounded owner pool로 확대.
- 우선순위: 대표 프로필 장르 exact > 같은 broad family > curated > latest > popular. 곡 장르는 같은 source 안의 보조 신호.
- 본인 제외, UID 중복 제거, 20명 카드 제한. UI/CSS/레이아웃 변경 0.
- 기존 first-view 기기 캐시의 공개프로필 대표장르만 읽음. 프로필마다 GET/서버 조회, 전체 사용자 scan, 새 D1/Firestore/Worker/R2 요청 0.
- profile cache 추출은 useMemo로 묶어 단순 UI 렌더마다 최대 120개 envelope를 반복 파싱하지 않음.
- **미완료:** 기기에 없는 로그인 사용자/후보의 대표장르는 알 수 없음. 이 경우 곡 장르를 대표 프로필 장르로 위장하지 않고 source fallback만 사용. 최초 기기에서도 대표장르 1순위가 보장되는 R2 일괄 요약 공급은 아직 구현되지 않음.
- 현재 R2 artist metadata는 uid/marker keys/signature 중심이며 프로필 대표장르 전체를 한 번에 제공하는 기존 bundle을 확인하지 못함. 후보별 R2 profile GET으로 우회하지 않음.

**검증**
- TypeScript PASS, Build PASS (로컬 Node 24.15.0; 릴리스 Node 20 검증은 미실행).
- follow 3-cycle functional/duplicate/rollback verifier PASS; physical cost gate **BLOCKED**.
- creator 대표장르 순위/실제 한국어·영어 catalog alias/curated-latest-popular fallback/self/dedupe/local IO verifier PASS; cold-profile 장르 공급은 미완료.
- existing `verify-explore-deploy-preflight.mjs`, `verify-202-explore-action-cost-bounds.mjs` PASS.
- Work 독립 read-only diff 검토: 정상행 atomicity/순위 회귀 없음. D1 changes() 실제 연속성, cold-profile 장르 공급, PC/모바일은 미검증.
- 기존 missing profile_stats unfollow에서는 일부 counter/관계만 변경되고 delta=0이 반환될 수 있는 cold-repair 제한이 남음. 이번에 전체 scan/backfill로 복구하지 않음.
- npm 11 ci는 기존 잠금 파일 누락으로 실패. npm 10.8.2 ci + 잠금 버전 Windows native package 3개만 별도 압축 해제로 검증. package.json/package-lock 변경 0. Build 산출물은 원래 tracked dist로 복원.

**배포/데이터**
- Firebase Hosting/Functions/Rules/설정 변경 0. Cloudflare Worker/R2/D1/schema/trigger 실제 변경 0.
- 사용자 원본 데이터 write/delete/copy/migration/backfill 0. synthetic in-memory fixture만 사용.
- PREVIEW release trigger/app-version 변경 0, 배포 Run 없음. app344/Worker341 유지.
- PC/모바일 실제 확인 및 PREVIEW live cost 계측 미실행. TEST/PRODUCTION live unchanged 감사 미실행; 이 작업에서는 해당 branch/service 변경 명령을 실행하지 않음.
- 새 branch/workflow 생성·삭제 0. 임시 workflow 0.

**[이번 작업 변경 파일] / [누적 변경 파일] — 시작 기준점 이후 동일 8개**
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `src/pages/ExplorePage.tsx`
- `src/services/exploreProfileFirstViewService.ts`
- `src/services/exploreCreatorRecommendations.ts`
- `scripts/verify-345-follow-cost.mjs`
- `scripts/verify-345-creator-recommendations.mjs`
- `DOCS/CURRENT_RELEASE_STATE.md`
- `DOCS/NEXT_CODEX_TASK.md`

**다음 작업**
- 이 구현 후보를 완료/배포본으로 취급하지 않는다.
- shared legacy counter/derived-reader 동시 호환 조건에서 physical 행 증폭을 실제로 낮출 설계를 먼저 확정. trigger 교체/authority cutover가 필요하면 별도 안전 검증 및 사용자 범위 확인 전 실제 shared DB 적용 금지.
- 후보별 GET 없이 cold 기기에도 대표장르를 공급하는 bounded R2 summary 계약을 설계. 읽기/쓰기/초기 공급 비용과 기존 사용자 호환성을 명시. 무단 backfill 금지.
- 실제 D1 batch 및 PC↔모바일을 검증한 뒤, 비용 원인 해결 + 실제 3-cycle 계측이 통과할 때만 같은 릴리스의 PREVIEW 배포를 진행.

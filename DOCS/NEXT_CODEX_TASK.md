# SORIDRAW NEXT CODEX TASK

## 최신 2026-09-24 — 실제 오류 재현 1건 수정·감사 PASS, 공유 숫자 경로 검증 전 미배포

- 최신 `CURRENT_RELEASE_STATE.md 0FG`. app158 PREVIEW Run `35978612769`은 계속 현재 실제 배포본. `preview` 후보 `45857de98cd21fe7e468661b13c685119942d87a`: 개인 R2 revision 변경 직후 이전 baseline marker가 제거되는 순서 때문에, 개인 stale guard 해결용 fresh proof가 아예 시작하지 않았던 경로 수정. 실행형 회귀 `verify-189-personal-like-settled-guard-release.mjs`에서 marker 제거 후 5→10, 무변경 재진입 추가 D1 0 증명. Audit `35979633390` SUCCESS; **배포 미실시**.
- **다음 분리된 원인**: Worker189 `processExploreLikeUserQueueWave075`은 canonical D1 batch 후 개인/공개 R2 patch의 실패를 `Promise.allSettled`/catch로 억제하면서 queue cursor를 소비한다. 따라서 공유 숫자가 옛 값에 머물러도 후속 자동 수복이 보장되지 않는다. D1 원본/정확한 변경 트랙만 기준으로 read-only 진단 후, 실패한 파생 변경 **한 항목만** 안전하게 재발행하는 기존 경로가 있는지 먼저 검토. 원인 확인 전 full Feed 재생성/전체 likes scan/new global listener/사용자 데이터 재작성 금지.
- 공개 likeCount는 현재 1분 aggregate + UI 2분 활동 기반 revision이라 다른 계정 장시간 열린 탭 즉시 갱신은 설계상 미지원. 합격선(모든 계정 PC·모바일 동일한 숫자)을 충족하는 전파 간격·비용을 판단해 별도 최소 설계. 개인 하트는 계정 간 섞지 않는다.
- 수정 후 TS/Build/정밀 실행형 테스트/실제 PC·모바일×타계정/비용 W1~W2, unchanged R0를 확인하고 PREVIEW 배포까지 한 단위로 진행. TEST/PRODUCTION 승격 보류.


## 최신 2026-09-24 — app158 PREVIEW 배포 완료 / 실제 사용자 정합성 및 교차 계정 공용 숫자 미해결

- app158 개인 좋아요 코드 `7fff2ffe702d92d19356f1b107d08a793b6380ff`, 회귀검증 `a5bb6dbf3a4f3e1c0f21215f4393daee22578a2d`, 앱 버전 `539a0af86239c1a9309590c76c40986b7ef29999`. Audit `35978411056` SUCCESS; PREVIEW Hosting `35978612769` SUCCESS, exact build PASS, TEST/PRODUCTION 불변. `CURRENT_RELEASE_STATE.md 0FF`를 실제 기준으로 사용. 기존 다음 단락의 'app157 미배포' 기록은 과거 상태다.
- 과거 단일 마커가 fresh canonical settlement 실패 후 개인 unresolved false guard를 영구 차단한 경우, 실제 **개인 R2 revision이 확인되었을 때 해당 revision당 1회만** 읽기전용 fresh D1 canonical/R2/queue/ETag 증명을 요청하도록 보완. 성공 시 outbox 없는 오래된 guard만 해제. 전체 캐시 삭제·서버 원본 변경·대규모 검증 없음. 변경 없는 정상 사용 D1 R0 보호.
- **남은 우선순위**: 실제 A 계정의 서버 canonical/R2와 PC/mobile outbox/표시 차이를 읽기전용 대조(개인 ID 로그 출력/무단 원본수정 금지). 이어 B/C 공개 likeCount의 실제 changed-track publication→shared R2/revision→client UI 경로 확인; 2분 activity gate/1분 edge/Worker aggregate로 장시간 열린 화면이 즉시 갱신되지 않는 것과 공유 원본 숫자가 잘못된 것을 구별. 확인 없이 새 RTDB 전역 listener·주기적 D1 조회·Feed 전체 재생성 추가 금지.
- 전체 PC/mobile × A/B/C 실사용, 좋아요 해제, W1~W2 비용 확인 전 TEST/PRODUCTION 승격 금지. 사용자 지시상 안전한 수정은 감사 성공 후 PREVIEW 배포까지 한 단위로 진행한다.


## 최신 2026-09-24 — app157 개인 좋아요 카드 색인 최소 보완 감사 PASS, 아직 미배포

- Source diff `2f32cf68cb59f55606766b611cff09939cd1e25d` + `debefe4fd6c4fd3661bd46bcbb07ced9cad7183b`: 서버가 인증한 완전한 개인 좋아요 ID 세트가 이전의 '곡 카드 없음' 캐시에 가려지지 않게 하고, 동일 계정 원격 신호는 이미 하트가 같아도 '내 좋아요' 카드 색인을 동일 membership으로 정렬. 기존 저장/Worker/UI 전부 비변경.
- `scripts/verify-190-like-card-authority.mjs` 감사 게이트 추가; Audit `35975707446` SUCCESS (TS/Build/like regression, missing 5만 카드 수신 + warm R0). 고정 검사 소스 `86eb3e4a176f27fc7ad5534fcc518260967197c0`. 상태 기록은 `CURRENT_RELEASE_STATE.md 0FD`.
- **아직 PREVIEW 배포하지 않았음**. 별도 PREVIEW 릴리스 및 PC/모바일 실사용은 미검증. A 개인 10곡을 서버 원본과 대조하기 전 전체 완료 선언 금지.
- 다음 소규모 작업: B/C 다른 계정의 **공용** `likeCount`에 대해 새 변경 1곡의 queue→canonical→shared R2/revision→추천/최신/인기/프로필 client 경로를 확인. A 개인 하트만 B/C에 전파 금지. 기존 app141 실시간 개인 동기화·30초 묶음·W1~W2·R0 유지. 미해결 원인이 특정되지 않으면 새 캐시/보정 레이어를 추가하지 말 것. 실기기 및 비용 미측정이면 TEST/PRODUCTION 승격 금지.


## 최신 2026-09-24 — app157 / Worker189 PREVIEW 배포 이후 실사용 검증 및 공용 좋아요 별도 작업

- PR #111 source `294036e963704a1007cfde36108a3f4640a57c7f` → preview merge `50ad5fab1b7516cc6ba7102cd1832ba0790885be`; Audit `35972104509` SUCCESS; PREVIEW Worker `35972368855` SUCCESS active `e23e73a1-89af-40f6-ae66-dc4ae2458c30`; Firebase Hosting `35972504441` SUCCESS exact app157 PASS. Current state `DOCS/CURRENT_RELEASE_STATE.md 0FC` 기준. TEST/PRODUCTION untouched.
- 1단계 코드 변경은 기존 app156 사용자 개인 stale guard를 **당일 fresh canonical/R2 일치·queue empty·ETag 불변** 증거와 live outbox 보호 하에서만 풀 수 있음. 실제 사용자 본인의 PC 5/mobile 10은 아직 서버 정답 및 각 기기 미전송을 읽기전용 비교하지 않았으므로 전체 해결 완료라고 하지 않는다.
- 다음 최소 단위 (별도 Codex): 좋아요/해제 신규 1건의 queue→D1 canonical→personal R2→shared latest/popular/profile R2→타계정 PC/mobile client revision→UI 경로를 증명. 이전 156 4곡 보정과 189 개인 수정 재실행 금지. 최근 정상 클라이언트, 30초 batch, W1~W2, unchanged D1 R0 보호. 다른 사용자 개인 filled heart는 독립 유지하며 모두에게는 공용 likeCount만 동기화. 읽기 실패·장시간 열린 탭·재진입 포함.
- **최종 게이트**: A 본인 PC/mobile 개인 하트 및 내 좋아요 목록 같고 B/C 각각 PC/mobile 공용 숫자 동일, B/C 역방향 누름·해제, 재진입/앱업데이트·장시간 열린 화면에서도 일치. PC/mobile 실사용 결과 없으면 미검증. PROD/TEST 승격 불가. 강제 사용자 데이터 덮어쓰기/전체 migration/backfill 금지.


## 최신 182 배포 후 — 개인 좋아요 10/5 실제 원본 검증 및 모든 계정 PC·모바일 새 변경 동기화

- PREVIEW app156 (Firebase Run `35913791497`) / Worker182 version `e426448c-ce5a-4a75-a798-97e3f9f52a81` (Run `35913674952`) 배포 완료; Audit `35913406306` PASS.
- 기존 불완전 개인 R2는 authenticated one-time repair query로 **canonical UID의 공개 liked ID set과 완전히 같을 때만** exact metadata를 수정. 다른 경우는 `canonical-mismatch`이고 자동으로 어느 한쪽을 덮어쓰지 않음. 사용자 모바일 10/PC 5가 실제로 일치했는지 아직 검증하지 않음.
- 다음 안전 게이트: 기기별 미전송 outbox/accepted pending 보존; 같은 UID의 server canonical 개인 relation, 개인 R2 catalog, 각각 PC/mobile UI 후보 ID를 비교(민감한 UID/곡목록을 public CI에 출력 금지). 차집합의 상태가 확정되기 전 user data 재작성 금지.
- 미래 신규 좋아요/해제는 queue→settlement→personal R2 exact + RTDB same UID→shared first-page R2 + 공개프로필→각 사용자 revision→실제 PC/mobile UI를 한 곡당 추적. 기존 156 4곡 일회성 R2 repair를 새 변경 해결의 근거로 삼지 말 것.
- 사용자 명시 합격 기준은 A 본인 PC/mobile 개인 하트·내 좋아요 일치, 모든 다른 계정 PC/mobile 같은 공개 카운트, B도 행동하면 역방향, 좋아요↔해제 반복/동시 변경/장시간 열린 탭/재진입/업데이트 후 일치. 30초 batch, changed-only, W1-W2/unchanged D1 R0 보호.
- 실사용 교차 계정·기기 검증 전엔 **전체 완료 처리 금지**, TEST/PRODUCTION 금지. 새 글로벌 push를 무단 추가하지 말고 적극적인 실시간 전달 요구와 10만 사용자 비용의 절충은 먼저 보고.


## 현재 진행 — app181 PREVIEW 후보 배포 완료, 전체 PC·모바일 동기화 실사용 FAIL/미검증

- PREVIEW Worker source commit `153aaccdcd758a65db7312ae5e85db60c140f38b`: exact personal shared R2 catalog의 수를 `syncExploreLikeR2AfterBatch074` CAS에서 같이 수정, incomplete/corrupt catalog는 보존. `verify-181-personal-r2-exact-mutation.mjs` 5→10→5, partial guard, stale ACK PASS.
- Audit `35911382038` SUCCESS; Worker Release `35911669741` SUCCESS, active `5008c2a4-17fa-4f3d-a745-04897ee79ba3`, Hosting app155 유지. TEST/PRODUCTION 그대로.
- 추가 release guard `75965bb7993ba2b3d9d2fa9c3eab2ae59710017e`: 156 일회성 repair flag는 triggering commit에서만 읽음. 이번 릴리스에서는 구버전 flag 때문에 임시 cron 켜졌다가 정상 원복됨.
- **남은 핵심**: 동일 사용자 모바일 10 vs PC 5는 canonical 개인 likes 관계/개인 R2/exactCount 및 두 기기의 local outbox/pending 차이가 확인되지 않아 해결이라고 판정할 수 없음. 사용자 데이터 임의 삭제·덮어쓰기·전역 백필 금지. 두 기기의 실제 미전송 변경 보호.
- 다른 계정의 새 좋아요/해제 후 shared R2 snapshot latest/popular/profile이 실제로 갱신되는지, 실패가 조용히 무시된 채 stale R2로 남는 경로가 있는지 수정·재현 검증. 4곡 일회성 보정 반복 금지. 100k 사용자 무변경 D1 R0, 행동 W1~W2 유지.
- **최종 통과**: A PC+모바일 → A 두 기기의 개인 하트/내 좋아요가 일치하고 B/C의 PC+모바일 같은 곡 공용 likeCount 일치. B/C 각자도 좋아요/해제 후 대칭 결과. 장시간 열린 화면, 재접속, 앱 업데이트와 네트워크 실패를 포함하여 실사용 반복 검증. 이 게이트 PASS 이전 TEST/PRODUCTION 금지, PREVIEW 후보 배포를 전체 해결 완료라 보고 금지.


## 최우선 / 사용자 승인 합격선 — 모든 계정 × PC·모바일 좋아요 완전 일치 (2026-09-24 KST)

사용자 최신 실사용: **동일 계정 모바일 내 좋아요 10곡, PC 5곡**. 기존 app155/Worker156에서 확인된 4곡 공개 카운트 1 복구는 이 문제의 해결이 아님. 임의 숫자/개인 카탈로그를 서버에 덮어쓰거나 강제 초기화하지 말 것.

**필수 원칙 (사용자 명시)**: PC 또는 모바일에서 A가 좋아요/해제 시, A 본인의 PC+모바일 **개인 하트/내 좋아요 목록**이 같아야 한다. 다른 계정 B/C의 PC+모바일에는 **같은 곡 공용 likeCount**가 동일하게 반영되어야 한다. B/C의 개인 하트는 각자 실제 좋아요 여부여야 하며 A의 개인 하트를 전파하면 FAIL. B/C도 각각 누르고 해제할 수 있어야 하며 반복 변경, 화면 유지·탭 전환·재접속·업데이트 후 동일성을 유지해야 한다. 단지 특정 4곡 복구/한 시점 스냅샷 PASS는 최종 합격 아님.

**즉시 수행**:
1. source HEAD 고정. 같은 계정 모바일 10 vs PC 5 원본 차이는 **읽기 전용**으로 기기별 local pending/outbox + 개인 R2 snapshot(revision, likesComplete/exactLikeCount) + D1 canonical membership을 구분. 사용자 UID/원본 리스트를 공개 로그에 출력하지 않는다. canonical 수치를 무조건 10 또는 5라 가정하지 않는다. 다른 기기의 미전송 local intention 절대 삭제 금지.
2. 새 좋아요/해제 1건에 대해 queue enqueue → settlement → personal R2 exact catalog → same-UID RTDB signal → shared latest/popular/profile R2 publication → per-device revision check → UI까지 **전 구간** 재현. 특히 4곡 복구 전 canonical=1, shared R2=0이었던 경로의 미래 모든 곡에 대한 일반 갱신 확인.
3. 기존 캐시 우선, 30초 묶음, changed-track만 변경, W1~W2, 변경 없음 D1 R0 목표 유지. 새로운 모든 사용자별 D1 polling/Feed 전체 scan/원본 전체 overwrite/대량 백필 금지. 실시간을 즉시 보장할 수 없다면 실제 반영 지연 및 비용을 명시하고 **사용자 승인 없이 합격 조건 완화 금지**.
4. 자동 회귀: A PC→A 모바일 / A 모바일→A PC, A→B PC·모바일 / B→A PC·모바일, 좋아요→해제→재좋아요, 동시 A/B 클릭, 10↔5 후보 차집합 / 중간 실패·재진입·다른 계정 전환, 추천/최신/인기/공개프로필/내 좋아요, 처음 로그인/업데이트 후 캐시. 서버 권위와 모든 실제 카드 동시 비교. 동일 계정의 personal membership과 공개 aggregate는 각각 별도 비교.
5. GitHub source test, TS/Build, W1~W2 / no-change read 검증, Work 독립 감사까지 PASS 후 **PREVIEW만** 배포. 실제 2개 계정 × PC·모바일 양방향 반복 테스트 PASS 전 "해결 완료" 보고 금지. TEST/PRODUCTION 승격 금지.


## 가장 최근: app155 + PREVIEW Worker 156 shared R2 좋아요 복구 배포 완료, 교차계정 실제 신규 변경 검증 대기

- READ-ONLY root cause Run `35905492085`: D1 canonical + standard Feed 4곡 1, but client direct/revision-keyed shared R2 latest/popular 0. UI만 다시 맞추는 접근 금지.
- PREVIEW 156 audit `35908413058` PASS, active Worker release `35908607512` PASS / `e4c8d394-a5c5-43b9-bf52-fc9513184089`. 4곡만 canonical 1회 read + latest/popular targeted R2 CAS, one-time marker; temporary cron restored. Hosting app155 유지.
- POST deploy readonly `35909223575` PASS: D1 canonical/relation/derived, normal Feed, direct shared R2, revision-keyed shared R2 모두 4곡 1; 069 queue=0.
- **다음은 새 좋아요와 해제 테스트**: A계정 Chrome/Edge/mobile 하나의 공개곡 좋아요→30초+aggregate 완료 확인→B계정 같은 곡 공용 숫자 비교→A계정 해제 후 재확인→추천/최신/인기/프로필 일관성. 새로운 활동 없는 다른 계정의 열린 탭은 global push 미구현. 사용자가 실제 기기 결과를 주기 전 "모든 향후 변경 해결"로 판정 금지.
- 증상 재발 시 DB 원본 재작성/전체 R2 재생성 금지. 동일 곡 queue→canonical→R2 direct/revision-keyed→클라이언트 순서로 비교. 비용 W1~W2, no-change D1 R0 유지. TEST/PRODUCTION 승격 금지.


## 현재 최우선 — app155 공용 좋아요 cache separation 검증 및 안전 배포

- 배포 완료: 기능 commit `9ec45d026be84b6bd17124553ac881e02cfb1930`; Firebase PREVIEW app155 locked source `f400203bf8205adc7f2a3d53c7d632537e9acd4e`; Audit Run `35901617762` SUCCESS; Hosting Run `35901871632` SUCCESS / exact build PASS.
- `ExplorePage.tsx`의 shared/public persistent cache에는 shared server-confirmed likeCount만 기록하고 optimistic/RTDB same-account 수치는 현재 UI/개인 liked cache에만 기록하도록 3경로 변경.
- 기존 `verify-117-explore-public-count-cache-separation.mjs`에 이 구분을 검사하는 155 회귀 guard 추가. version=155로 이전 154 persistent count 오염 1회 bounded R2 snapshot 복구 예정.
- TypeScript / Build / like regression / Music Note regression / Release Audit PASS. Firebase PREVIEW app155 Hosting deploy + exact build PASS; Worker / D1 / Functions / Rules / 사용자 원본 비변경, TEST·PRODUCTION unchanged PASS.
- **남은 실사용**: 사용자 실기기 A/B 계정 + Edge/Chrome/mobile에서 1곡 좋아요→서버 shared aggregate 이후 공용 숫자→해제 반복, 추천/최신/인기/프로필 확인. 이 실사용 검증 전에는 모든 계정/기기 완전 수렴을 확정하지 않는다.
- active idle 다른 계정 자동 즉시 전달은 현재 별도 global push가 없으므로 범위 외. 사용자가 즉시 타계정 반영을 요구하면 backend fanout 비용 안전 설계 후 별도 작업.
- TEST·PRODUCTION 승격 금지.


## 현재 최우선 — app154 타계정 public likeCount 재확인

- app154 Hosting 유지.
- stale 069 queue bounded settlement Run `35897425530` SUCCESS: 8 batches / 26 mutations / 1 user, queue=0.
- PREVIEW Worker restore Run `35897572807` SUCCESS.
- PREVIEW Worker version `33b4de33-73c5-44b2-bf87-e550545fa13a`.
- revision HEAD warm path D1 R0/W0 PASS / event scheduler PASS / TEST·PRODUCTION Worker unchanged.
- post-deploy read-only Run `35897701370` SUCCESS: shared latest/popular Feed 확인 대상 4곡 public likeCount=1, q069=0.
- 다음은 타계정에서 Explore 재진입 1회 후 숫자 1 표시 확인.
- filled heart는 타계정에서 비어 있어야 정상.
- 숫자가 0이면 새 좋아요 클릭 금지. client session cache/revision 적용만 추적.
- Gemini 동결 / TEST·PRODUCTION 승격 금지.

## 현재 최우선 — app154 타계정 공용 좋아요 실사용 확인

- PREVIEW app154 배포 완료.
- Audit `35891693207` SUCCESS.
- Hosting Run `35892105284` SUCCESS / exact build 154 PASS / TEST·PRODUCTION unchanged.
- 계정 전환 시 shared Feed revision gate를 uid+URL 기준으로 분리했고 Feed effect가 user.uid 변경을 다시 처리함.
- D1 read/write 추가 없음.
- 실사용은 A계정 좋아요 → shared aggregate 반영 시간 후 B계정 Explore 진입 → 공용 likeCount +1 확인.
- 타계정의 filled heart는 공유하지 않음. heart는 각 계정 개인 membership.
- 실패 시 타계정 화면의 시간/탭(추천·최신·인기·공개프로필)과 shared aggregate 반영 여부만 추적. Gemini 작업은 동결.
- TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app153 + fallback 60s 실사용 완전 성공 1곡 확인

- PREVIEW Gemini Function Tune Run `35888544983` SUCCESS.
- 3.6=90s / 3.5=60s / 3.5-lite=60s / Function=330s.
- 모델 순서/5회 상한/low-thinking/daily quota skip/가사·5단·hard-ban 계약 유지.
- shared TEST/PRODUCTION Gemini Function unchanged PASS.
- 다음은 cooldown 만료 후 PREVIEW V1 1곡만 생성.
- 성공 판정은 최초 생성 + 모든 후처리까지 전부 성공일 때만 인정.
- 실패 시 해당 한 세션만 분석. TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app153 PREVIEW 완전 성공 1곡 검증

- app153 PREVIEW Hosting 배포 완료.
- Release Audit `35886284795` SUCCESS.
- Hosting Run `35887028650` SUCCESS / locked source `3f8d5a0f4fa432b7b29076494602d0c0749de6e9`.
- app version 153 / exact build PASS / TEST·PRODUCTION unchanged PASS.
- app152에서 원인 확인된 3.6 initial timeout은 120s 유지.
- app153에서 commit `2e14663...`의 hard-ban single-lite pinning 2줄을 원복하여 shared fallback을 복원.
- 다음은 PREVIEW 일반 V1 1곡만 생성.
- 성공 판정은 최초 생성 + 모든 후처리 완료까지 전부 성공일 때만 인정.
- 실패 시 해당 한 세션의 context/model/status만 보고 원인 분리. 무작정 추가 timeout/프롬프트/모델 구조 변경 금지.
- TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app152 + 3.6 initial timeout 120s 실사용 1곡 확인

- 원인 확정: 3.6/3.5/3.5-lite 실패시간 45/20/20s가 SORIDRAW bounded timeout과 정확히 일치.
- 3.6 initial song timeout만 45s → 120s로 확대.
- Source Audit `35885073940` SUCCESS.
- PREVIEW Gemini Function Tune `35885073991` SUCCESS.
- shared TEST/PRODUCTION Gemini Function unchanged PASS.
- 다음은 PREVIEW 일반 V1 1곡만 생성.
- 45s 이후에도 3.6가 계속 처리되거나 성공하는지 확인. 성공 시 token/time/output 품질 확인.
- 실패 시 반복 호출 금지. prompt 추가 축소/구조 변경 금지.
- TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app152 + PREVIEW Gemini Function unified Interactions 실사용 1곡 확인

- app152 Hosting은 유지.
- PREVIEW Gemini Function Tune Run `35882735701` SUCCESS.
- initial chain `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite`의 서버 호출 경로를 모두 Interactions API로 통일.
- 5회 상한 / bounded timeout / daily quota cooldown / 프롬프트·가사·섹션 계약 변경 없음.
- shared TEST/PRODUCTION `generateGeminiContent` unchanged PASS.
- 사용자 직전 3곡은 모두 0-token 실패였고, 3.7은 free-tier daily quota exhaustion으로 확인됨.
- 다음은 PREVIEW 일반 V1 1곡만 재검증.
- 성공하면 provider promptTokens/처리시간/모델/5단 productionPrompt/가사/section cue를 확인.
- 실패하면 반복 호출 금지. 동일 세션의 per-model status와 quota reset/account tier/provider availability만 분리 분석.
- prompt 추가 축소 금지. TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app152 PREVIEW 실사용 1곡 검증

- PREVIEW app152 Hosting 배포 완료.
- Release Audit `35878475721` SUCCESS.
- Hosting Run `35878798592` / job `107241573504` release steps SUCCESS.
- locked source `3260ea781702d9c73ba0e3f4fb1126e084991e46`, remote app-version 152, exact build PASS, TEST/PRODUCTION unchanged PASS.
- 메인 V1 systemInstruction source initializer: 59,918 → 24,771 chars(-58.7%).
- 다음은 일반 V1 곡 1곡만 실사용 생성. 성공 여부와 5단 productionPrompt / 가사 / 섹션 퍼포먼스 큐 정상성을 먼저 본다.
- 성공하면 처리시간/입력토큰을 app150의 약 33k 및 실패 사례와 비교한다.
- 실패하면 동일 세션의 모델별 오류/timeout만 보고 원인을 분리하며, 반복 생성으로 provider를 계속 두드리지 않는다.
- Functions/Worker/D1/Firestore/사용자 데이터 변경 금지. TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app151 복구 유지 + Gemini 150k systemInstruction 코드측 원인 분석

- 현재 PREVIEW app151. app150 진단 runtime은 제거했고 app149 Gemini 생성 runtime을 복원함.
- PREVIEW Hosting Run `35875369499` SUCCESS / locked `4d2c20e1f346a8f875899edfdb845859f235ec67` / exact build 151 PASS / TEST·PRODUCTION unchanged.
- 사용자 app150 측정으로 최초 생성 요청 전체 약 150,872~152,355 chars, systemInstruction 약 146,458~147,941 chars가 확인됨. contents 220, responseSchema 3,374, 기타 config 39, fallback 781 수준.
- 다음 단계는 **추가 실사용 생성이 아니라 코드측 owner 분석**이다.
- 목표: systemInstruction 조립 블록을 실제 삽입 순서와 조건으로 분해해 중복·동일 의미 반복·비활성 모드까지 항상 포함되는 블록을 찾는다.
- 보호: 5단 작곡 프롬프트, 직접입력 우선순위, Situation, 가사 밀도, 언어혼합, section performance cue, hard-ban, 사용자 lyric draft, 모델 fallback/timeout은 원인 확인 전 변경 금지.
- 축소 후보는 먼저 source fixture에서 최종 request 의미/필수 계약 parity 검증을 통과해야 하며, 정상 기능을 제거해 토큰만 줄이는 방식 금지.
- Functions/Worker/D1/Firestore/사용자 데이터 변경 금지. PREVIEW source-only 분석/구현 후 감사, 그 다음 Hosting만 배포.
- TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app150 PREVIEW 실사용 측정

- app150 PREVIEW Hosting 배포 완료.
- Hosting Run `35873749101` SUCCESS / locked source `001861da3c1d1bd919ae15018ef431c574b84998`.
- remote `app-version.json=150`, exact build PASS, TEST/PRODUCTION unchanged PASS.
- 이번 단계에서는 코드 추가 수정 금지. 먼저 일반 V1 곡 1~3개를 실제 생성해 관리자 Gemini 기록을 수집한다.
- 확인할 값:
  1. 최초 성공 호출의 요청크기 breakdown: contents / systemInstruction / responseSchema / 기타설정 / fallback / total chars.
  2. provider promptTokens / 처리시간 / 모델.
  3. `repairV1FinalProductionCues` 발생 여부.
  4. 발생 시 sectionName + ownership reason(canonical-plan / custom-production / production-only).
- 측정 전 prompt/schema 축소, 모델 순서/timeout 변경, fallback 제거, 가사/언어혼합/5단 프롬프트/section performance cue 변경 금지.
- 사용자 실사용 결과를 받은 뒤 Codex High로 실제 최적화 범위를 확정한다.
- TEST/PRODUCTION 승격 금지.

## 현재 최우선 — app150 Gemini 요청크기/섹션 보완 실사용 진단

- app149 Music Note Suno 썸네일 재접속 문제: 사용자 실사용 PASS.
- app150 source-only 진단 후보 완료, 실제 PREVIEW Hosting은 app149.
- final audit Run `35871794547` SUCCESS: TypeScript / Build / APP147 Gemini verifier / Music Note verify-031 / like regression PASS.
- app150은 생성 규칙을 줄이거나 fallback 정책을 바꾸지 않는다. 관리자 로컬 진단만 추가:
  - 최초/후속 Gemini call의 contents/systemInstruction/responseSchema/other config/fallback/total char 수.
  - required production cue 누락 발생 시 sectionName과 ownership reason(canonical-plan/custom-production/production-only).
- prompt/lyrics 원문은 기록하지 않는다. 서버 DB read/write 추가 없음.
- 사용자 명시적 PREVIEW 배포 요청 전 배포 금지.
- 배포 후 1~3곡 생성 결과를 보고 33k 입력의 실제 주 원인과 `repairV1FinalProductionCues` 호출 정당성을 확정한다.
- 그 다음에만 Codex High로 실제 최적화를 수행한다. 품질/5단 prompt/언어혼합/가사 밀도/section performance cue/모델 chain 보호.
- TEST/PRODUCTION 승격 금지.


## 최우선 — app150 Gemini 실제 입력 구성 계측 + section repair 소유권 진단

### 기준
- branch: `preview`
- 기준 HEAD: 이 작업 시작 시 최신 `preview` HEAD를 다시 확인한다.
- 현재 PREVIEW: app149, Music Note Suno 썸네일 사용자 실사용 PASS.
- 배포 금지. 분석 → 구현 → 관련 verifier → TypeScript → Build → commit까지만 수행.
- UI 일반 사용자 화면, 모델 chain/timeout, 가사/작곡 품질 계약, Firebase/Firestore/D1/R2/Worker/Functions/Rules/사용자 데이터 변경 금지.

### 사용자 실사용 근거
- app147 V1 최초 성공 입력: 약 32.9k~33.8k tokens.
- V1 최종 `systemInstruction` source template만 약 59,945 chars이며 많은 동적 instruction block이 삽입된다.
- 기존 source-only owner audit(15,761 chars)은 실제 provider promptTokenCount와 대응되지 않았다.
- Folk Rock 1건에서 `repairV1FinalProductionCues`가 추가 호출됐지만 현재 audit 화면만으로 required section의 ownership 이유를 확인할 수 없다.

### 목표 A — 최초 생성 실제 payload breakdown
**최종 문자열을 바꾸지 말고** `generateSong` 요청 직전에 런타임 구성 길이를 측정한다.

최소 기록:
- final `systemInstruction` chars
- final `contents` chars
- serialized `responseSchema` chars
- 위 세 값 합계(진단용 approx request chars)
- provider가 반환한 기존 `promptTokens`

systemInstruction owner blocks 최소 분류:
- sectionPerformancePlanOutputInstruction
- v1SectionSlotContractInstruction
- styleIntentSingleSourceInstruction
- hookBlueprintOutputInstruction
- user free-text/detail layer + direct genre/style/sound lock
- recent story memory
- global mood distribution / mood role translation
- recent title anti-repeat / lyric anti-repeat
- lyric writing style / user primary story lock / technical lyric guard
- genre / instrument / selected sound / ensemble / style texture inputs
- vocal expression
- storyContext / Situation / Theme
- finalPrompt / vocalPrompt / basePromptSeed
- language guards / mixed lyrics / lyric draft
- section blueprint / structure
- mood-transition / point-sound / requested-language / rap
- generation-engine output contract
- lyric guidance / lyric density
- section-cue variety / arrangement plan / multi-vocal anchor / extra technique / section-cue output
- specialPrompt

규칙:
1. raw prompt, raw lyrics, user text, API key 등 내용은 audit log에 저장 금지. **label + char count 숫자만**.
2. 기존 `GeminiAuditCall`에 optional diagnostic metadata를 추가하거나 기존 admin audit 구조를 최소 확장한다.
3. 관리자 화면에서 `generateSong` 성공 호출에만 “입력 구성” 접기 영역 또는 짧은 top-size rows를 표시한다. 일반 사용자 비노출.
4. 같은 fallback physical attempts는 동일 logical request breakdown을 공유해 중복 저장량을 최소화한다.
5. 계측을 넣기 전/후 동일 fixture에서 최종 `systemInstruction`, `contents`, responseSchema 직렬화 결과가 byte-for-byte 동일함을 verifier로 증명한다. 계측 때문에 prompt가 바뀌면 FAIL.

### 목표 B — `repairV1FinalProductionCues` 호출 이유 기록
- `collectV1MissingProductionCueSections`가 만드는 candidate의 다음 boolean을 **진단용으로만** 남긴다:
  - `hasRenderedCue`
  - `planOwnsAudibleEvent`
  - `customOwnsAudibleEvent`
  - `explicitlyProductionOnly`
- 실제 Gemini fallback target이 된 section마다:
  - sectionName
  - sectionIndex
  - ownership reason(`plan/custom/production-only`, 복수 가능)
  - phase(`pre-language-mix` / `post-language-mix-final`)
  만 기록한다.
- 가사 내용, cue 본문, productionPrompt 원문은 audit log에 저장하지 않는다.
- 기존 selector의 required/optional 판정 결과 자체를 변경하지 않는다.

### 목표 C — 이 단계에서 하지 말 것
- 33k를 줄이기 위해 instruction 삭제/요약 금지.
- 모델 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 순서 변경 금지.
- timeout 변경 금지.
- 최대 physical call 5회 / correction 상한 변경 금지.
- `repairV1FinalProductionCues` 제거 금지.
- section performance cue / language mix / Japanese / hard-ban / lyric density / 5단 prompt 계약 변경 금지.
- 새 서버 호출/서버 로그/Firestore 문서 추가 금지.

### 검증
1. 새 verifier 또는 기존 app147 verifier 확장: 동일 fixture의 최종 request 문자열/스키마가 계측 전후 의미·문자열 동일.
2. breakdown 합계와 owner rows가 deterministic하게 생성됨.
3. raw user text/lyrics/prompt가 audit persistence에 저장되지 않는 정적 검사.
4. production cue owner reason fixture:
   - ordinary sung + no local event → no repair target
   - canonical plan event missing → reason=plan
   - custom audible event missing → reason=custom
   - instrumental/break/stop production-only missing → reason=production-only
   - rendered cue present → no fallback target
5. existing `verify-147-gemini-prompt-and-cues.ts` PASS.
6. TypeScript PASS.
7. Build PASS.
8. 기존 like/Music Note regression verifier PASS.
9. TEST/PRODUCTION unchanged.
10. 최종 report에 실제 코드에서 측정 가능한 **가장 큰 owner block 순위**를 적되, provider token 감소는 배포 실사용 전 주장하지 않는다.

### 완료 보고
- 작업 branch / 기준 SHA / 최종 SHA
- 변경 파일
- 최종 request string parity
- owner breakdown 예시(숫자만)
- production repair ownership 예시
- TypeScript / Build / verifier
- Firebase/Functions/Worker/D1/사용자 데이터 변경 여부
- 남은 위험
- 배포 여부: 반드시 미배포


## 현재 최우선 — app149 Suno 썸네일 모바일/PC 재접속 실사용 검증

- PREVIEW Hosting `35864856848` SUCCESS, exact build 149 PASS, locked `337c2b0e6e9ca72d518607310ee90e75dc3dc225`, TEST/PRODUCTION unchanged.
- 사용자 기존 URL 곡 선택 → 필요 시 Suno URL 재저장 → 목록 커버 → PWA/브라우저 종료 후 재접속 → 목록 커버 지속 확인.
- URL 두 개의 1순위 전환/삭제 및 PC/모바일 확인.
- app148에서 이미 서버에 URL은 저장됐지만 R2 catalog가 누락한 기존 곡은 app149에서 한 번 재저장해 정합화될 가능성이 있으며, 사용자가 실제 확인하기 전 PASS로 간주하지 않는다.
- 오류 재현 시 뮤직노트 원본 1곡과 해당 곡 R2 Catalog summary의 media/revision만 비교하고 전체 재생성/백필/대량 데이터 읽기 금지.
- 문제가 해결될 때까지 Gemini 최적화 작업 보류, 명시적인 PRODUCTION 배포 승인 없음.


## 최우선 — app149 Music Note Suno 썸네일 재접속 확인

- 사용자 app148 실사용 FAIL: 상세 커버는 정상, 저장 직후 목록 커버 일시 표시, 앱 재접속 후 목록 음표 복귀.
- app149 수정: 기존 IndexedDB detail draft를 목록에 UID/곡 단위 오버레이, post-mutation Catalog delta publish 순서 바로잡음.
- Audit Run `35864420171` SUCCESS, TypeScript/Build/verify-031 PASS. 실제 앱은 아직 app148, app149 실기기 검증 전.
- 확인: 저장 후 목록 즉시 표시 → 앱 완전 종료/재접속 → 목록 커버 지속 → URL 1/2 우선순위 변경 → 다시 재접속 → PC/모바일 동일 사용자 데이터 확인.
- 별도 사용자 데이터 재생성, cache generation bump, 전곡 Firestore 상세 조회, 백필/마이그레이션 금지.
- 이 문제가 PASS되기 전 Gemini 최적화 재개 금지. PRODUCTION 명확 승인 전 승격 금지.


## 최우선 — app148 실사용 썸네일 확인 후 Gemini 진단 복귀

- app148 PREVIEW Hosting Run `35857460912` SUCCESS; locked source `6fab9fc859304049ee832ab2889c37c0dadcde16`; exact build 148 PASS; TEST/PRODUCTION unchanged PASS.
- 사용자 검증 대기: 디테일 Suno URL 연결 → 목록 커버 즉시 표시 → 상세 닫기 → 1/2순위 변경 및 삭제 → 페이지 재진입 → PC/모바일.
- 실패 시 실제 같은 곡의 catalog summary, IndexedDB draft, selectedSong, favoritesStore의 최소 Suno 메타데이터만 비교. 불필요한 서버 조회/쓰기 또는 전체 계정 rebuild 금지.
- 성공 확인 후 app147 Gemini Folk Rock에 남은 `repairV1FinalProductionCues` 호출의 실제 필요성과 33k 입력 원인을 순서대로 분석한다. 후속 작업은 별도 범위/commit으로 분리.
- PRODUCTION은 명확한 별도 승인 전 배포 금지.


## 현재 최우선 — Music Note Suno 연결 썸네일 app148 실사용 확인

- PREVIEW source-only 후보 app148, 실제 Hosting app147.
- 코드 commit `bc7b0a3d198938c846d33b20e708ccb0c83fd02a`.
- audit Run `35850755112` SUCCESS, TypeScript/Build/verify-031 PASS.
- 수정은 상세 URL 편집의 local-first draft를 Music Note 카드의 최소 Suno 메타데이터에 즉시 미러링하는 것. 저장 일정/서버 비용 변경 없음.
- 다음 지시는 사용자의 PREVIEW 배포 승인 및 실기기 검증을 우선한다.
- 검증: URL 1 등록 → 목록 즉시 아트워크, URL 2 등록/1순위 교체, 삭제, 상세 종료, 모바일/PC 및 재진입. 미반영이면 catalog delta / 캐시 동기화 별도 확인. 전곡 상세 조회 도입 금지.
- 해당 작업의 사용성 확인을 마친 후에만 app147 Gemini latency / Folk Rock repair / 33k prompt-size 진단 재개.


## 현재 최우선 — app147 실사용 3곡 결과에 따른 선택적 진단 (구현/배포 전)

- latest user field test details are in `DOCS/CURRENT_RELEASE_STATE.md` section 0EH.
- PREVIEW Hosting app147 remains deployed; 3 songs all completed, but latency 45.8~76 s and initial request input ~33k tokens persists.
- Melodic Rap 2 calls: no section repair; 3.8 timeout 35 s, 3.7 success 33.9 s.
- Folk Rock 5 calls: 3.7/3.6 busy, 3.5 timeout 20 s, 3.5-lite initial success 8.7 s, `repairV1FinalProductionCues` via 3.5 success 10.6 s. The missing/required production section is **not yet identified**.
- Heavy Metal 4 calls: 3.7/3.5 busy, 3.5-lite initial success 9.9 s; independent hard-ban correction 3.5-lite 961 ms. No section repair.

**분석/검증 단계**
1. `repairV1FinalSectionAndCueIntegrity`의 Folk Rock 사례에서 required section, canonical plan/sibling/renderer cue 존재 여부를 먼저 확인할 수 있는 read-only/개발 전용 진단 범위를 설계한다. 외부 실제 가사나 민감 원본은 로그하지 않는다.
2. canonical audible event가 정당하게 누락되었다면 기존 Gemini fallback을 보호한다. optional blank 오분류일 때만 최소 수정과 회귀 테스트를 제시한다.
3. 최초 요청의 실제 전송 직전 payload를 구성 블록별로 문자수/예상 token을 계측한다. 정적 TS initializer source 길이 15,761 chars는 실제 33k provider input token과 동일하지 않다. 출력 스키마 및 전달 context 포함 여부 검토.
4. 3.8/3.7/3.6/3.5 timeout/혼잡은 provider 상태의 영향과 로컬 routing policy를 구분한다. 모델 순서/timeout/최대 physical call 수를 성급히 바꾸지 않는다.
5. sung section performance cue / instrumental/custom/언어혼합/금지어 교정/전체 곡 생성 정상성 및 UI/데이터/TEST/PRODUCTION 보호.
6. 사용자의 별도 진행 지시 전에는 추가 런타임 수정·배포를 실행하지 않는다. Codex 구현을 시작하면 `preview`와 최신 HEAD를 다시 확인하고 독립 감사 후 PREVIEW 검증.


## 현재 최우선 — app147 PREVIEW 실사용 확인

현재 PREVIEW:
- app147 Firebase Hosting 배포 완료.
- Release System Audit Run `35783411655` SUCCESS.
- Hosting Run `35783654947` SUCCESS.
- exact build PASS / TEST+PRODUCTION unchanged PASS.
- Codex 구현 commit `718c9b5b00d90ab0a1509c19df9038621fdce182`.
- Functions / Worker / Rules / 사용자 데이터 변경 없음.

사용자 확인:
1. 일반 V1 곡 1~3개 생성.
2. 관리자 Gemini 호출 기록에서 최초 생성 후 `섹션 지시문 보완(repairV1FinalProductionCues)` 호출 유무 확인.
3. ordinary sung section에 별도 production event가 없을 때 보완 호출이 없어야 한다.
4. sung section의 performance cue는 기존처럼 유지되어야 한다.
5. Instrumental/Interlude/Break/Stop 또는 명시적 production event가 실제로 있는 구조에서는 필요한 cue가 유지되어야 한다.
6. 최초 입력 token과 전체 처리시간 기록.
7. prompt 자체는 이번 app147에서 줄이지 않았으므로 33.8k~34.4k가 유지돼도 실패로 보지 않는다. 다음 단계는 실사용 결과를 보고 prompt-size 원인을 별도로 좁힌다.

실사용 PASS 전 추가 구조 변경 금지.


## 현재 최우선 — app147 Gemini prompt-size source audit + 불필요한 섹션 production-cue 추가 호출 제거

### 기준
- 작업 branch: `preview`
- 기준 commit: `d3d8d87157dec499d7b51293034700531f6efea3`
- 현재 PREVIEW: app146 exact build PASS
- 이번 구현은 **Codex가 분석 → 구현 → 관련 검증 → TypeScript/Build/Test → commit까지** 진행한다.
- **배포하지 않는다.** ChatGPT/Work 검증 전 PREVIEW 배포 금지.
- UI / Firebase 사용자 데이터 / Firestore / D1 / Cloudflare Worker / Rules / TEST / PRODUCTION 변경 금지.

### 사용자 app146 실사용에서 확정된 증상
한 번의 곡 생성에서:
- `gemini-3.8-flash`, `gemini-3.7-flash`: Free Tier 일일 quota 상태라 실제 호출 없이 skip.
- `gemini-3.6-flash`: cooldown 상태 skip 후 최초 생성 시 약 3.9초 실패.
- `gemini-3.5-flash`: 20.0초 timeout 실패.
- `gemini-3.5-flash-lite`: 약 12.7초 성공.
- 최초 성공 입력 약 **33,853 tokens**, 출력 4,068.
- 이후 `repairV1FinalProductionCues` / 관리자 표시 **섹션 지시문 보완**이 추가 실행:
  - 3.5 약 15.0초 timeout.
  - 3.5-lite 약 0.951초 성공.
  - 해당 보완 호출은 입력 576 / 출력 117 정도로 작지만 총 대기시간을 크게 늘림.
- 전체 약 **1분 4초**.
- app145의 creative/story raw-source 중복 제거 후에도 최초 입력은 약 33.8k~34.4k로 유지됨.

### 코드에서 이미 확인된 원인 경로
- `src/services/geminiService.ts`
  - `requestV1MissingProductionCuesWithGemini()`가 `repairV1FinalProductionCues`를 호출한다.
  - `collectV1MissingProductionCueSections()`는 instrument section cue 옵션이 켜져 있으면 현재 blueprint의 **모든 section**에 standalone production cue가 있어야 하는 것으로 판정한다.
  - 먼저 sibling language card와 canonical `sectionPerformancePlan.soundCue / arrangementAction`을 재사용하고, 그래도 없는 section을 추가 Gemini 호출로 채운다.
  - 이 integrity 단계는 pre-language-mix / post-language-mix-final 양쪽 경계에서 실행된다.
- 최초 생성의 `sectionPerformancePlan` 계약은 이미 performance cue와 production event를 분리한다.
  - **가창 section의 performance cue는 필수.**
  - `soundCue`는 해당 section에 실제 audible production event가 있을 때만 필요하며, purely vocal / local production event 없음이면 빈 값이 허용된다.
- 따라서 현재 최종 integrity의 “instrument 옵션 ON이면 모든 section에 production cue 강제”가 최초 plan 계약보다 더 강해서, 정상적인 optional blank까지 후속 Gemini 보완 대상으로 만들 가능성이 있다.

### 구현 목표 A — 섹션 performance cue는 100% 보호
다음은 절대 약화하지 않는다.
1. 모든 sung / vocal-ad-lib section tag에는 현재 곡의 **짧고 유효한 performance cue**가 있어야 한다.
2. bare sung tag, 악기-only tag, 추상어-only tag, 복사된 동일 cue는 실패로 본다.
3. performance cue는 section tag 안에, instrument / ambience / texture / arrangement event는 별도 square-bracket cue로 분리한다.
4. 기존 `sectionPerformancePlan`과 structured vocal fields를 먼저 재사용한다.
5. 성능을 위해 section tag 기능 자체를 삭제하거나 느슨하게 만들지 않는다.

### 구현 목표 B — production cue의 “필수/선택” 판정 정합화
- **모든 section에 standalone production cue를 무조건 강제하지 않는다.**
- 다음처럼 현재 곡에서 실제 production event 소유권이 있는 section만 required 대상으로 계산한다.
  - canonical `sectionPerformancePlan.soundCue`가 유효함.
  - canonical `arrangementAction`이 실제 audible production event를 소유함.
  - custom/user section 지시가 해당 section에 악기/효과/production event를 명시함.
  - Break / Stop / Instrumental / Interlude 등 lyric-free transition/production section에서 cue가 section의 실제 내용 계약상 필요한 경우.
- purely vocal section이면서 canonical plan에 local production event가 없으면 standalone production cue 없음은 정상으로 인정한다.
- sibling card / canonical plan에 이미 유효 cue가 있으면 그것을 재사용하고 Gemini를 부르지 않는다.
- **진짜 required production event가 누락된 경우에만** 기존 `requestV1MissingProductionCuesWithGemini` fallback을 남긴다.
- 결과적으로 normal generation에서 optional blank 때문에 `repairV1FinalProductionCues`가 호출되는 것을 막는다.
- 이미 정상인 performance-cue validation / language mix / hard-ban / hook / structure 기능은 건드리지 않는다.

### 구현 목표 C — 33~34k prompt-size source audit
품질 규칙을 바로 삭제하지 말고 먼저 **큰 블록별 실제 크기**를 계측/정리한다.
1. 최초 생성 `systemInstruction`과 contents를 구성하는 owner block별 문자수/대략적 token 기여도를 deterministic하게 출력할 수 있는 기존 verifier 또는 개발용 정적 검사 경로를 우선 재사용한다.
2. 최소 측정 대상:
   - sectionPerformancePlanOutputInstruction
   - V1 section slot / blueprint contract
   - structure instruction
   - language / language-mix instruction
   - Japanese first-pass contract
   - style intent / arrangement / section cue instructions
   - mood distribution / mood role translation
   - title/lyric anti-repeat
   - user/director/story context
   - output schema 및 contents payload
3. **의미가 완전히 동일한 중복만** 합치거나 한 canonical source를 참조하도록 한다.
4. 5단 작곡 프롬프트, 사용자 직접입력/Situation 우선순위, 가사 밀도, section-role, 언어 혼합, 네이티브 언어 품질, output schema를 약화시키지 않는다.
5. “34k를 줄이기 위해 규칙을 지운다”는 접근 금지. 각 삭제/통합은 중복 근거가 있어야 한다.
6. 새 런타임 서버 호출/Firestore/D1 read/write를 추가하지 않는다. prompt-size audit은 로컬/정적 검증으로 끝낸다.

### 반드시 보호할 app146 정상 기능
- 최초 모델 순서 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 변경 금지.
- daily quota / cooldown / in-flight skip 유지.
- 최대 물리 호출 5회 유지.
- app146 hard-ban 단순 교정은 `3.5-lite` 단일 호출 유지.
- PREVIEW 전용 Gemini Function 정책을 이유 없이 변경하지 않는다.
- shared TEST/PRODUCTION `generateGeminiContent` 변경 금지.
- 결과 가사/제목/5단 prompt 품질 계약 유지.
- 정상 UI/좋아요/Music Note/Library/Explore 코드 비변경.

### 검증
1. targeted unit/static test:
   - sung section performance cue 필수 계약 PASS.
   - instrument option ON이어도 local production event가 없는 sung section은 “missing production cue”로 잘못 분류되지 않음.
   - canonical plan에 soundCue/arrangementAction이 있으면 그대로 재사용.
   - 실제 required production event가 없어진 경우만 fallback 대상.
2. normal representative V1 generation fixture에서 optional production-cue blank 때문에 `repairV1FinalProductionCues`가 필요하지 않음을 증명.
3. custom structure / multi-vocal / instrumental transition / language mix 회귀 검사.
4. prompt-size source audit 결과에서 큰 블록 순위와 exact duplicate 후보를 기록.
5. 중복 제거를 실제 적용했다면 before/after prompt size를 동일 fixture로 비교.
6. TypeScript PASS.
7. Build PASS.
8. 관련 generation test PASS.
9. 기존 좋아요 regression verifier PASS.
10. TEST / PRODUCTION unchanged 확인.

### 중단 조건
- production cue 필수 범위를 안전하게 판정하려면 기존 사용자 출력 의미를 바꿔야 하는 경우.
- 언어 혼합/일본어/구조/가사 품질 규칙을 삭제해야만 34k를 줄일 수 있는 경우.
- migration / 사용자 데이터 변경 / shared Function 변경이 필요해지는 경우.
- 정상 첫 생성 결과가 악화되거나 performance cue 누락이 증가하는 경우.
- 이 경우 구현을 밀어붙이지 말고 근거와 대안을 보고한다.

### Codex 완료 보고 형식
- 작업 branch
- 기준 commit
- 최종 commit SHA
- 변경 파일
- prompt-size before/after
- `repairV1FinalProductionCues` 호출 조건 before/after
- TypeScript
- Build
- Test
- Firebase/Functions/Cloudflare 변경 여부
- 사용자 데이터 변경 여부
- 남은 위험
- **배포 여부: 반드시 미배포**


## 현재 최우선 — app146 Gemini 실사용 확인

현재 PREVIEW:
- app146 remote exact build PASS.
- 최초 생성 5단 chain 유지: `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite`.
- daily quota / cooldown / in-flight skip은 app145 실사용에서 PASS.
- 금지어 통합 교정은 app146부터 3.5-lite 단일 1회.
- Free Tier rate-limit 영어 잔여 문구 번역 수정 완료.
- shared TEST/PRODUCTION Gemini Function 및 사용자 데이터 비변경.

사용자 확인:
1. 곡 1~3개 생성.
2. 금지어 통합 교정이 뜨면 3.5-lite 단일 호출인지 확인.
3. 이미 daily quota인 3.8/3.7이 실제 호출 없이 skip되는지 확인.
4. 오류 설명에 영어 provider 문장이 남는지 확인.
5. 입력 토큰은 계속 기록. 34k가 유지되더라도 품질 규칙은 즉시 삭제하지 말고 별도 prompt-size source audit에서 큰 블록별 실제 기여도를 먼저 측정.


## 현재 최우선 — Gemini 생성시간 2차 최적화

현재 app144 / PREVIEW:
- 3.8 low-thinking 실제 SUCCESS 14.5초 확인.
- 3.8 high-demand FAIL도 17~19초 두 번 확인.
- 3.7은 Free Tier 일일 20회 rate limit 실제 확인.
- 3.5는 실패 시 30초 timeout이 전체 지연 병목.
- 최초 생성 입력 약 33k~34k 토큰.
- 관리자 Gemini 오류 설명 전체 한글화 완료.

다음 작업 순서:
1. 가사/프롬프트 품질 규칙 삭제 금지.
2. 33k 입력에서 중복 system instruction / 반복 guideline / 같은 canonical plan 반복 삽입 여부를 소유 파일별 감사.
3. 의미가 완전히 동일한 중복만 제거하고 품질/출력 schema/섹션 규칙은 보존.
4. 3.7 rate-limit cooldown이 Free Tier reset/retry-after를 충분히 반영하는지 확인해 이미 한도 초과된 모델을 같은 세션/후속 세션에서 불필요하게 재호출하지 않도록 검토.
5. 3.5 initial fallback 30초 timeout을 줄여도 성공률을 해치지 않는지 실측 기반으로 조정.
6. 모델 순서는 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 유지.
7. 최대 물리 호출 5회 유지. shared TEST/PRODUCTION Gemini Function 변경 금지.
8. PREVIEW 전용 Function/client만 수정 후 실생성 3회로 성공 모델, 총시간, 입력토큰 재비교.


## 현재 최우선 — app143 Gemini low-thinking 실생성 확인

배포 완료:
- PREVIEW 전용 Function만 수정.
- 초기 체인 순서 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 유지.
- 3.8/3.7/3.6/3.5 최초 곡 생성은 low thinking.
- Run `35768064306` SUCCESS, shared TEST/PRODUCTION Gemini Function unchanged.

사용자 확인:
1. app143에서 동일/유사 조건으로 곡 1회 생성.
2. 관리자 Gemini 호출 기록에서 3.8이 첫 호출인지 확인.
3. 3.8 성공이면 호출수/처리시간/입력·출력·추론 토큰 기록.
4. 3.8 503이면 실패까지 걸린 시간과 다음 fallback 총시간 기록.
5. 여전히 3.8/3.7 고수요가 반복되면 모델 순서/가사 규칙을 바꾸지 말고, 약 33k 입력의 중복/정적 prompt payload를 품질 손실 없이 줄일 수 있는지 소유 파일별 감사부터 한다.
6. 동일 모델 재시도로 최대 5회 상한을 몰래 초과하거나, 정상 규칙을 삭제해 성공률을 올리는 방식 금지.


## 현재 최우선 — Gemini provider 503 resilience 보강

현재 PREVIEW app143:
- 초기 모델 체인 실제 적용 확인: `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite`.
- PREVIEW 전용 Function `generateGeminiContentPreview` ACTIVE, shared `generateGeminiContent` unchanged.
- 관리자 Gemini 오류 설명 한국어 표시 완료.
- 실사용에서 3.8/3.7/3.6/3.5가 high-demand 503, 3.5-lite가 timeout으로 5회 모두 실패하는 사례 확인.

다음 범위:
1. 모델 순서 변경 금지.
2. 정상 첫 성공 경로 추가 지연 0 유지.
3. transient 500/502/503/504에서만 짧은 bounded backoff/jitter 또는 Retry-After 준수 검토.
4. 마지막 3.5-lite timeout 정책을 전체 생성 성공률/최대 대기시간 관점에서 조정.
5. 최대 물리 호출 5회, Auth/App Check/API key 보안, UI/가사 엔진/좋아요/사용자 데이터 보호.
6. PREVIEW 전용 Function에서만 검증 후 사용자 실생성 테스트. TEST/PRODUCTION shared Function 변경 금지.


## 현재 최우선 — Gemini 곡 생성 503 복구 설계/수정

확정 증상: 최초 곡 생성 physical calls가 `3.6 → 3.5 Flash-Lite → 3.1 Flash-Lite` 3회 모두 provider HTTP 503 high-demand로 실패.

원인:
- 모델 ID 폐기 아님.
- 887 latency fastpath 이후 초기 생성 fallback이 3개로 축소되어 resilience가 약해짐.
- 현재 최신 GA `gemini-3.8-flash` 미지원.
- `gemini-3.5-flash`는 Function allowlist에 있으나 initial chain에서 제외됨.
- 동일 Function 요청의 5xx fallback은 즉시 다음 모델로 넘어가며 bounded backoff가 없음.

다음 구현 범위:
1. Google 공식 현재 모델/API 요구사항 기준으로 3.8 Flash 지원을 client + Function에 최소 추가.
2. 초기 생성 체인을 품질/지연/가용성 기준으로 재구성하되 최대 물리 호출 5회 유지. 우선 후보: `3.8 → 3.6 → 3.5 → 3.5-lite → 3.1-lite`; 3.7은 기존 latency 제외 결정과 현재 품질을 비교 후 필요할 때만 포함.
3. 500/502/503/504에서 Retry-After가 있으면 존중하고, 없으면 짧은 bounded backoff+jitter 후 다음 모델. 정상 성공 경로 지연 0 증가.
4. 400/401/403/schema/Auth/App Check 오류에는 fallback 금지 유지.
5. deprecated sampling field 제거를 3.8에도 적용. Interactions API 또는 공식 지원 generateContent 중 기존 구조와 가장 작은 안전 변경 선택.
6. API Key는 계속 server-only; user data/Firestore schema/UI/CSS/Suno/좋아요 기능 변경 금지.
7. 관련 verifier → Functions TypeScript/build → PREVIEW Function deploy → 실제 곡 생성. 실패 모델 기록에서 fallback 및 성공 모델 확인.
8. TEST/PRODUCTION 변경 금지.


## 완료 기준점 — PREVIEW app141 좋아요 양방향 동기화 실사용 PASS (2026-09-23)

사용자 실기기 확인 완료:
- 업데이트 후 Explore 첫 진입 기존 좋아요 하트 즉시 표시 PASS.
- PC→모바일 좋아요/해제 자동 반영 PASS.
- 모바일→PC 좋아요/해제 자동 반영 PASS.
- 탭/페이지 이동·새로고침 없이 반영 PASS.
- 이 경로는 정상 기준점으로 보호. 추가 최적화 때문에 다시 수정하지 않는다.
- W1 30초 묶음쓰기 / R0 재진입 / local catalog / 현재 Worker / UI/CSS 보호.
- 별도 90초 무동작 비용 재측정은 이번 사용자 메시지로 새로 검증된 항목이 아니므로 필요 시 다음 비용 감사에서만 확인.
- TEST/PRODUCTION 승격은 사용자 지시 전 진행 금지.


## 현재 최우선 — PREVIEW app141 PC↔모바일 실기기 검증 (2026-09-23)

- audited code source `4568795945b9e98539d72feb1300bbc1e3f0b35b`, Firebase Hosting source `3032247b531b213999c235baca5ce413fda65187`.
- final audit Run `35756483569` SUCCESS, Hosting Run `35756677133` SUCCESS.
- remote `preview.soridraw.com/app-version.json=141`, exact build PASS, TEST/PRODUCTION unchanged.
- PREVIEW Worker unchanged `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- 핵심 수정: remote signal 수신 후 `snapshotPending`을 먼저 영구 저장하고 그 뒤 Explore UI subscriber에 알림. 이전에는 UI membership guard가 오래된 persisted pending을 읽어 이벤트를 거절.
- 실행형 회귀: previous pending=false / new RTDB=true에서 UI delivery PASS, stale signal 및 local outbox precedence PASS. 실제 PC↔모바일 실기기는 **미검증**.

사용자 테스트:
1. PC/모바일 app141, 캐시 지우지 않기. 최초 진입 스피너 재발 없는지.
2. 모바일 추천 탭 유지, PC 1~3곡 좋아요/해제 → 마지막 클릭 후 35초. 이동/새로고침 없이 모바일 하트+숫자 자동 갱신.
3. 모바일→PC도 동일.
4. 90초 무동작 후 R/W 증가 0, 페이지 이동 write 0, 정상 catalog membership D1 R0.
5. FAIL이면 RTDB onValue auth/listener/lastSeen, 오래된 outbox guard, UI hydrate overwrite만 read-only로 좁혀 진단. W1 queue/Worker/catalog/DB/UI/CSS 임의 재작성 금지. 기능 실기기 PASS 전 TEST 승격 금지.


## 단일 최우선 — app140 실사용 FAIL, 송신→수신→화면 경계 진단부터

실제 결과: 첫 화면 하트 spinner PASS; PC↔모바일 양방향 즉시 하트 반영 FAIL. TEST/PRODUCTION 승격 금지.

2026-09-23 live read-only RTDB probe:
- Run `35754369030` / `35754457146`: 최신 계정 changed-track signal version `1790094204064` (UTC 16:23:24), changed tracks 2. probe UTC 16:28:55 age 331초. 실제 server publish는 한 번 이상 확인.
- 이는 수신/화면 반영 성공까지 뜻하지 않음. 이전 app139의 오래된 signal 문제와 구별.
- 임시 read-only probe workflow 제거 완료. 사용자 데이터 write 0.

원인 확인 작업 지시 (먼저 분석/진단, 무근거 패치 금지):
1. 같은 계정의 송신 성공한 batch 시점과 RTDB persisted signal version/results를 대조. private UID/track ID를 로그에 직접 노출하지 않을 것.
2. 수신 device에서 `onValue` subscribe/error/auth UID 일치, signal normalize, `version <= lastSeen` skip, `previousVersion` gap/repair, `pending[trackId]` skip를 **순서대로** 추적.
3. service remote `dispatchLikeSync` 이후 Explore subscriber 연결/replay 여부, `effectiveLiked !== detail.liked` guard, hydration overwrite 여부 확인.
4. `set()` 송신자의 local seen/Date.now 기반 version과 server latest 간 동시성/clock skew/stale overwrite 가능성을 따로 검토하되 증거 없이 guard 제거 금지.
5. 원인 확정 뒤 막힌 구간만 최소 수정 + 해당 경로 실행형 회귀 + TS/Build + Audit. 사용자 PREVIEW 자동 배포는 사전검사 PASS 후. 실제 양방향 결과 재확인 필요.

보호: app138 W1 30초 묶음쓰기, R0 재진입, local personal catalog, Worker version `45afab7c-1da2-45b6-b34d-cb3943cec559`, UI/CSS, shared user data, TEST/PRODUCTION 그대로. 전체 조회, 반복 write, 무승인 migration 금지.


## 현재 최우선 — app140 양방향 실시간 changed-track + 첫 화면 spinner 실기기 확인

현재 PREVIEW:
- app140 Hosting Run `35752721030` / job `106830699375` SUCCESS.
- remote app version 140 / exact build PASS.
- Worker는 app138부터 동일: `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- exact audit `35752471675` SUCCESS.
- TEST/PRODUCTION unchanged.
- user data / Functions / Rules / D1 schema 변경 없음.

확정 진단:
- app139 직후 read-only RTDB probe에서 최신 Explore like signal이 약 624초 전 상태였음.
- 따라서 tab/page 이동 후 정상화는 live RTDB 수신 성공이 아니라 personal R2 revision/catalog reconciliation 결과.
- app140은 live changed-track publish를 RTDB set transport로 복구하고, update 첫 화면은 local catalog를 synchronous paint.

실기기:
1. cache 삭제하지 말고 PC/모바일 app140.
2. 업데이트 직후 Explore 첫 진입 하트 spinner 여부 확인.
3. 모바일 추천 탭 그대로 둔 상태에서 PC 1~3곡 변경 → 35초.
4. 모바일이 이동/새로고침 없이 자동 반영되는지.
5. 반대로 모바일 1~3곡 → PC 자동 반영.
6. 90초 무동작 추가 like R/W 0.
7. 페이지/탭 왕복만으로 write 0 / membership D1 R0.

FAIL이면 W1 queue, Worker, catalog 전체를 변경하지 않는다.
RTDB publish/receive 또는 local synchronous paint 중 실패한 구간만 수정한다.


## 현재 최우선 — app139 모바일 changed-track 즉시 화면 반영 실기기 확인

현재 PREVIEW:
- app139 Hosting Run `35748877001` / job `106817450432` SUCCESS.
- remote app version 139 / exact build PASS.
- Worker는 app138과 동일: `45afab7c-1da2-45b6-b34d-cb3943cec559` (재배포 없음).
- exact audit `35748628236` SUCCESS.
- TEST/PRODUCTION unchanged.
- 사용자 데이터 / Functions / Rules / D1 schema 변경 없음.

이번 수정 범위는 UI 전달 race 하나뿐:
- server write path 변경 금지.
- local catalog 구조 변경 금지.
- revision / gap / bootstrap 구조 변경 금지.
- CSS/UI layout 변경 금지.
- remote changed-track을 replayable in-memory subscriber로 현재 ExplorePage에 즉시 전달.

실기기 확인:
1. PC/모바일 app139 확인. 캐시 삭제 금지.
2. 모바일을 추천 탭에 그대로 둔다.
3. PC에서 새 좋아요/해제 1~3곡.
4. 30초 batch 처리 후 모바일에서 **탭 이동/새로고침 없이** 하트와 숫자가 자동 반영되는지 확인.
5. 비용 숫자는 app138과 동일해야 하며 UI replay 때문에 D1/Firestore read/write가 추가되면 FAIL.
6. PASS 시 구조 변경 없이 다음 전체 양방향 검증으로 진행.
7. FAIL 시 W1/Worker/catalog를 건드리지 말고 service→ExplorePage UI subscriber 전달만 다시 조사.


## 현재 최우선 — app138 FINAL LIKE ARCHITECTURE 실기기 검증

구조 기준: `DOCS/EXPLORE_LIKE_FINAL_ARCHITECTURE.md` — 변경 금지.

배포 완료:
- PREVIEW app138 Hosting Run `35744548706` SUCCESS / exact build PASS.
- PREVIEW Worker Run `35744224208` SUCCESS / version `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- exact audit `35743962351` SUCCESS.
- isolated D1 `35743171196`: 6곡 묶음 queue intake **W1**, duplicate W0.
- TEST/PRODUCTION unchanged.
- user data migration/backfill/delete 없음.

실기기 검증만 수행:
1. PC/모바일 모두 app138 확인. 저장 캐시 삭제 금지.
2. 양쪽 CACHE LIVE 진단 초기화.
3. PC에서 3~6곡 좋아요/해제를 연속 변경하고 35초 대기.
4. 첫 batch에서 HTTP 5xx 없어야 함. interactive queue는 한 묶음 W1 목표.
5. 모바일은 새로고침/페이지 이동 없이 changed-track heart가 자동 반영돼야 함.
6. 90초 추가 무동작 → 추가 like write 0.
7. PC 다른 페이지 왕복 → 추가 like write 0, membership D1 R0.
8. 모바일→PC 방향도 1~3곡 동일 검증.
9. public likeCount는 background aggregate 후 양쪽 최종 일치.

FAIL이면:
- 구조를 다시 갈아엎지 않는다.
- **쓰기 queue intake / personal catalog merge / changed-track RTDB signal** 셋 중 실패 구간만 수정.
- 전체 /v1/me/likes scan, direct interactive D1 settlement, navigation retry를 재도입하지 않는다.
- TEST/PRODUCTION 승격 금지.


## 현재 최우선 — app137 실기기 좋아요 재시도 폭증 차단 + 양방향 동기화 검증

현재 PREVIEW:
- app137 Hosting Run `35734551788` / job `106768328033` SUCCESS.
- Worker Run `35734337978` / job `106767585369` SUCCESS, version `91f2b33b-7f62-4776-b363-33e729912e8f`.
- final audit `35732623427` / job `106761752048` SUCCESS.
- TEST/PRODUCTION unchanged.
- user data migration/backfill/delete 없음.

app137에서 수정한 문제:
- D1 AFTER trigger 때문에 정상 relation mutation이 `meta.changes=2`로 보고되는데 이를 실패로 오판하던 Worker receipt 검증 수정.
- 실패 outbox를 30초 idle / navigation / re-entry가 자동 재전송해 시간이 지나도 R/W가 계속 증가하던 경로 차단.
- page exit/navigation 자체 server read/write 0 유지.
- 실제 새 클릭은 기존 30초 묶음 저장 유지.

실기기 검증 순서:
1. PC/모바일 app137 확인. 캐시/저장 데이터 삭제 금지.
2. CACHE LIVE `진단 초기화`.
3. PC에서 새 좋아요 1~3곡 변경 → 마지막 클릭 후 35초.
4. 첫 batch 결과 사진. HTTP 500 없어야 함.
5. 그 상태로 **아무것도 하지 않고 90초 추가 대기** → D1 누적 R/W 숫자가 그대로인지 사진.
6. 다른 페이지 → Explore 복귀 → D1 누적 R/W 추가 증가 없는지 사진.
7. 모바일은 새로고침/페이지 이동 없이 같은 변경곡의 하트/숫자가 자동 반영되는지 확인.
8. 모바일→PC 방향도 1곡 이상 같은 방식으로 확인.

FAIL 기준:
- 시간만 지나도 R/W 증가.
- 페이지 이동만으로 R/W 증가.
- HTTP 500.
- 다른 기기 자동 동기화 실패.
- `/v1/me/likes` 전체/visible membership scan 재발.

기능 PASS 후 별도 비용 구조 작업:
- isolated remote D1에서 현재 legacy likes physical shape는 like W8 / unlike W4 lower bound가 확인됨.
- W1~W2 목표는 기능 삭제가 아니라 likes 물리구조/파생 trigger/index fanout 정리로 달성할 것.
- destructive migration / backfill / shared user data rewrite는 사용자 승인 없이 금지.


## 현재 최우선 — app136 실기기 좋아요 정상화/비용 최종 판정

현재 PREVIEW:
- app136 Hosting Run `35729271895` / job `106750503334` SUCCESS, exact build / remote version 136 PASS.
- Worker Run `35729148720` / job `106750087137` SUCCESS, version `314608e3-1490-4eab-ade5-f5909bc2af96`.
- final audit `35728910481` / `106749307465` SUCCESS.
- TEST/PRODUCTION unchanged.
- user data migration/backfill/delete 없음.

이번 app136 핵심:
- app135의 “canonical D1 저장 성공 → 후속 R2 실패 → HTTP 5xx → outbox 재시도 + RTDB signal 미발행” 경로 제거.
- canonical D1 ACK가 최종 사용자 상태.
- R2 후처리는 changed-track incremental/best-effort.
- mutation hotpath 개인 전체 likes D1 scan/full rebuild 제거.
- canonical ACK 뒤 RTDB changed-track signal로 PC↔모바일 자동 동기화.

다음은 새 코드 수정 전 실기기 판정:
1. app136 양쪽 확인. 저장 데이터/브라우저 캐시는 삭제하지 않는다.
2. app135 실패 때 남은 outbox가 있으면 app136 최초 1회 서버 정리를 기다린다.
3. 이후 양쪽 CACHE LIVE `진단 초기화`.
4. PC에서 새 좋아요 1~3곡 변경 → 마지막 클릭 후 약 35초.
5. 모바일은 새로고침/페이지 이동 없이 하트·숫자가 자동으로 같은 최종 상태가 되어야 함.
6. 모바일→PC 방향도 1곡 이상 동일 확인.
7. 새 cycle에서 HTTP 500 없어야 함.
8. 다른 페이지 → Explore 복귀 후 `/v1/me/likes` membership rows read 0.
9. 새 실제 변경 cycle 비용은 W1~W2/행동 목표. W3+ / 행동이면 기능 PASS여도 비용 FAIL.

FAIL이면 해당 한 경로만 수정:
- HTTP 응답/ACK
- RTDB changed-track signal
- 개인 R2 incremental catalog
- local catalog merge
전체 Feed/전체 personal likes scan 재도입 금지. shared user data 전체 재생성/backfill/delete 금지. TEST/PRODUCTION 승격 금지.


## 현재 최우선 — app135 PREVIEW 실기기 좋아요 동기화 + 페이지복귀 R0 검증

현재 배포 완료:
- PREVIEW app135 Hosting Run `35723863422` / job `106732740826` SUCCESS.
- remote app version 135 / exact build PASS.
- locked source `790f8113dde0346020eff97773bbfe6f95d70822`.
- Release System Audit Run `35723609001` / job `106731917567` SUCCESS.
- PREVIEW Worker는 재배포하지 않았고 기존 version `4a145c23-adf0-4f41-8426-6de8cbebda66` 유지.
- TEST/PRODUCTION unchanged.

app134 실사용에서 재현된 실패:
- 첫 진입/즉시 재진입 R0였으나 PC 6곡 좋아요 해제 후 모바일이 갱신되지 않음.
- 다른 페이지 왕복 후 `/v1/me/likes`가 다시 실행되어 D1 membership R46 재발.
- app135는 exact changed-track RTDB delta를 gap repair보다 먼저 적용하고, 정상 기기의 local catalog authority를 revision/gap 때문에 버리지 않도록 수정함.

다음은 **새 코드 작업 전 실기기 판정만** 수행:
1. PC/모바일 모두 PREVIEW app135 확인. 브라우저 저장 데이터/캐시는 지우지 않는다.
2. 양쪽 CACHE LIVE `진단 초기화`.
3. PC에서 좋아요 2~6곡 OFF 또는 ON → 마지막 클릭 후 약 35초 대기.
4. 모바일은 새로고침·페이지 이동 없이 하트와 숫자가 같은 상태로 자동 수렴해야 함.
5. 그 뒤 모바일에서 다른 페이지 → Explore 복귀. CACHE LIVE에 `좋아요 상태 확인 (/v1/me/likes)`가 나타나면 FAIL. 개인 membership D1 rows read 0이 합격.
6. 모바일→PC 방향도 1곡 이상 동일하게 확인.
7. 기능이 맞은 뒤 mutation 비용 재측정. W1~W2/행동 목표, W3+ FAIL.

FAIL 시 금지:
- visible track 전체 `/v1/me/likes` scan을 정상 경로에 복구하지 않는다.
- public likeCount로 개인 하트를 추론하지 않는다.
- shared user data 전체 재생성/backfill/delete 금지.
- TEST/PRODUCTION 승격 금지.

FAIL 시 다음 진단 범위:
- 해당 계정 RTDB retained signal의 exact changed-track rows/version chain.
- 개인 R2 catalog revision과 실제 changed delta.
- device local catalog marker/state.
- 해당 track의 direct settlement 결과.
전체 Feed/전체 사용자 membership 조회로 우회하지 않는다.



## 현재 최우선 — app134 PREVIEW 실기기 좋아요 카탈로그 R0 + PC/모바일 일치 검증

현재 배포 완료:
- PREVIEW app134 Hosting Run `35720055123` SUCCESS, remote version 134 / exact build PASS.
- PREVIEW Worker Run `35719972386` SUCCESS, Worker version `4a145c23-adf0-4f41-8426-6de8cbebda66`.
- final release audit Run `35719747351` SUCCESS.
- 기존 stalled 069 accepted queue 7 batches / 14 mutations는 repair Run `35709706139`에서 canonical 반영 + 영향 1계정 exact 개인 R2 catalog 재생성 완료. 현재 pending069=0.
- TEST/PRODUCTION unchanged.

다음은 새 코드 작업 전 **실기기 기능·비용 판정**:
1. 관리자 CACHE LIVE 초기화 후 Explore 첫 진입. `좋아요 상태 확인` D1 membership rows read가 0인지 확인. app133의 46×2=92행과 비교.
2. Explore 재진입 / 다른 탭 왕복 / 앱 포커스복귀 / 새로고침에서도 membership D1 rows read 0.
3. PC와 모바일 동일 계정에서 첫 화면 하트·likeCount·내 좋아요 목록 일치.
4. PC에서 2곡 OFF→ON, 30초 batch settlement 후 모바일 자동 수렴. 모바일→PC도 1곡 수행.
5. 좋아요 실제 변경 때 Worker/D1 write fanout 실측. 기능 정상 상태에서 W1~W2 목표, W3+면 원인 분석. 기능 삭제로 W1 강제 금지.
6. 실기기 PASS면 app134 CURRENT_RELEASE_STATE를 PASS로 갱신하고 다음 비용 작업으로 이동. FAIL이면 전체조회 fallback을 되살리지 말고 catalog revision/delta/direct settlement 범위에서만 수정.

금지:
- 정상 캐시 재진입에서 `/v1/me/likes` targeted membership scan 재도입.
- 앱 업데이트를 개인 카탈로그 bootstrap 사유로 사용.
- public likeCount만으로 개인 하트 추론.
- shared user data 전체 backfill/재생성/삭제.
- TEST/PRODUCTION 승격 전 실기기 PASS 선언.


## 현재 단일 최우선 — Explore 좋아요 개인 카탈로그 정상화

목표: Music Note처럼 **로컬 우선 + 작은 revision + 변경분만**. 공개곡 수/페이지 재진입/앱 업데이트에 비례한 D1 membership 읽기를 없앤다.

구현 범위:
1. 현재 계정별 shared R2 likes snapshot을 개인 좋아요 카탈로그의 서버 기준으로 정리. exact 여부와 revision을 명시하고 PC/모바일이 같은 카탈로그를 사용.
2. 클라이언트는 로컬 카탈로그 즉시 표시 → 개인 revision만 확인. 동일 revision이면 `/v1/me/likes` 호출 금지 / D1 rows read 0.
3. revision 변경 시 R2 카탈로그만 다시 받아 변경된 membership을 반영. 정상 변경 동기화에 D1 membership scan 금지.
4. 실제 좋아요/해제는 changed track만 canonical D1 relation/count 처리 후 계정 R2 catalog/revision + 해당 public count만 갱신. 30초 로컬 묶음 UI 동작은 보호하되 서버 ACK와 canonical settlement를 혼동하지 말 것.
5. 기존 069 deferred queue가 왜 scheduled에서 drain되지 않는지 원인 확인 후 신규 intake에서 제거하거나 확실히 동작하도록 정상화. 현재 7 batches / 14 mutations 보존 데이터를 임의 삭제 금지.
6. 새 기기/카탈로그 부재·손상만 1회 bootstrap/repair 허용. 앱 업데이트/Explore 진입/포커스복귀는 repair 사유가 아님.
7. app133에서 추가된 partial-account 반복 targeted D1 verification과 focus hydration reset은 정상 경로에서 제거.

필수 테스트:
- 정상 캐시 Explore 첫 진입 / 재진입 / 포커스복귀 / 앱 업데이트: 개인 좋아요 D1 rows read 0.
- PC↔모바일 동일 계정: 같은 곡 하트 + 공개 숫자 + 내 좋아요 첫 화면부터 일치.
- 좋아요 ON/OFF/ON 후 최종상태 두 기기 수렴.
- 수천/수만 공개곡 수가 늘어도 좋아요 상태 확인 비용이 곡 수에 비례하지 않음.
- actual like mutation D1 rows written 1~2 목표. W3+ FAIL.
- UI/CSS/Feed 구조/TEST/PRODUCTION 비변경.

현재 `0afd303a...`, `6dd49e50...`는 중간 소스이며 카탈로그 구조 완성 전 PREVIEW 배포하지 않는다.


## 현재 최우선 — PREVIEW app133 실제 동일 계정의 canonical 좋아요 검증 (2026-09-22)

- PREVIEW exact source `587e60ff451ce64d9d24be5ae943f5a32d71825d`, remote version **133**, Hosting Run `35651254609` job `106515752564` SUCCESS.
- 실행형 partial-R2 stale verification 회귀·TypeScript·Build·release-system audit PASS. TEST/PRODUCTION 비변경, Worker/공유 사용자 원본 비변경.
- 같은 계정의 PC와 모바일에서 사진의 다섯 곡 하트·숫자·내 좋아요 첫 진입 일치, PC 좋아요 해제→30초 ACK 후 모바일 자동 일치 확인.
- 불일치면 화면 수치로 해당 계정 membership을 추정하지 말고 **실제 인증 uid + trackId** 기준 private R2 accepted state, D1 `likes` 현재 relation, 069/075 queued state, PC local `snapshotPending` 및 모바일 targeted verified result를 순서대로 비교. 개인 ID·토큰 등은 사용자에게 공개 요청하지 않는다. 파괴적 데이터 수정·전체조회 금지.
- 특히 ACK는 queue accepted이지 canonical D1 materialized가 아니므로 PC의 하트 ON 표시를 서버 확정으로 보고 모바일을 강제로 ON시키지 않는다.
- 실사용 PASS 전 171 cutover / 신규 비용 작업 / TEST·PRODUCTION 승격 금지. 사용자 수정 지시와 안전검사 PASS이면 PREVIEW 배포까지 이어간다.


## 현재 최우선 — app133 partial R2 캐시 검증 감사 및 안전 PREVIEW 배포

app132 PC/모바일 사진 FAIL: 하트 OFF/숫자1 vs PC ON/숫자1. `DOCS/CURRENT_RELEASE_STATE.md` 0DH 원인·한계 참고.

- current product candidate `7ecd7fd1ec919c5924660d703331b7e88ed748b2`; code `1d1ece060ce4bac7d0bc0a4e6c565bf6b85c1613`; test `74214aa93598e3537c1e63b97d1261bf5e620ef5`.
- partial R2 device의 과거 `verified` 보관이 R2 revision 동일 상황의 deferred D1 materialization을 놓치는 경로를 실행형 테스트한 뒤 전체 TS/Build/Release Audit.
- 완전한 R2, 최신 로컬 미전송 클릭, 30초 batch/RTDB, 기존 CSS/UI·모든 정상 기능 보호.
- PASS면 app133 **PREVIEW Hosting만** 배포하고 remote exact build/TEST·PRODUCTION unchanged 확인. 공유 D1/Worker/migration/데이터 수정 금지.
- 위 수정은 구형 partial D1 확인을 재실행하는 보호일 뿐 **서버 큐 완료를 보장하지 않음**. 재검증에서도 PC↔모바일 불일치면 canonical D1 개인 관계 vs 계정 R2 accepted state vs local outbox/snapshotPending을 실제 track 기준으로 비교하기 전 추가 서버·캐시 억측 패치 금지. 수치만 가지고 본인 하트 추론 금지.


## 현재 최우선 — PREVIEW app132 실사용 PC↔모바일 좋아요 검증 (2026-09-22)

실제 PREVIEW app132 배포 확인:
- source `ffff163783c3103a9594903132480ce356846ad2`
- audit run `35650903841` job `106508627342` rerun SUCCESS
- Firebase PREVIEW run `35651254609` job `106509860243` rerun SUCCESS
- remote app version 132 / exact build PASS / TEST·PRODUCTION unchanged PASS
- Worker·Functions·Rules·공유 D1/R2 데이터 변경 없음

다음은 코드 재작성 전 사용자 PC/모바일 실제 결과 확인:
1. 같은 계정 동일 곡의 첫 화면 하트·숫자·내 좋아요 일치.
2. PC에서 2곡 좋아요 해제 → 30초 ACK 뒤 모바일에 새로고침·탭 왕복 없이 같은 0/1 상태.
3. 모바일 ON→OFF→ON을 한 뒤 PC도 같은 최종 상태.
4. 페이지 재진입·앱 업데이트에서 기존 상태가 과거 캐시로 회귀하지 않음.
5. FAIL이면 최신 승인 계정 상태·public likeCount의 실제 시점/경로를 분리 진단하여 최소 수정. 기능 제거/전체 조회/W1 강제 금지.

실사용 통과 전 171 cutover, 새로운 비용 실험, TEST/PRODUCTION 승격 금지. 앱 배포 성공은 사용자 기능 실측 성공과 구분.


## 최신 단일 작업 — app132 PC↔모바일 첫 화면 좋아요 불일치 실사용 복구 (2026-09-22)

현재 PREVIEW live app131 실사용 FAIL: PC의 찬 하트/숫자가 모바일 첫 화면에서 빈 하트/0으로 보임.
app132 source candidate: `164c9f77fe3540df9e721bdc4c1e2f868c0918f0`; 상태 문서 0DF 참고.

다음 순서:
1. `scripts/verify-127-atomic-personal-like.mjs` 포함 독립 회귀 + TypeScript/Build + Release System Audit 고정 commit 성공 확인.
2. 실패 시 이번 Explore 개인 좋아요 신호·캐시 경로만 수정. 공유 데이터/기존 기능 삭제, 무근거 W1 강제 금지.
3. 성공 시 사용자가 이미 허용한 운영 지시에 따라 PREVIEW Hosting만 배포. Worker/Functions/Rules/D1 마이그레이션 금지.
4. remote `app-version.json=132`, exact build, TEST/PRODUCTION 비변경 확인.
5. PC/모바일 같은 계정 동일 4곡에서 첫 화면, ON→OFF→ON, 30초 ACK 이후 자동 동기화 및 내 좋아요 결과 확인. 어느 한 면이라도 틀리면 FAIL.
6. 공개 숫자 후처리 지연은 별도 실측 전 즉시 일치라고 선언하지 말 것. 선행 기능 정상화 전 171 cutover 및 추가 비용 최적화 중단.


## 현재 최우선 — app131 실사용 PC↔모바일 좋아요 자동 동기화 확인

현재 실제 PREVIEW:
- app131 Hosting Run `35651254609` SUCCESS.
- remote app version 131 / exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / D1 / 사용자 원본 데이터 비변경.

사용자 확인:
1. PC 또는 모바일에서 좋아요/해제.
2. 마지막 클릭 후 30초 뒤 다른 기기에서 새로고침 없이 자동 반영.
3. 같은 곡의 하트·숫자·내 좋아요가 함께 일치.
4. 페이지 이동이나 탭 왕복을 해야만 맞으면 FAIL.
5. 통과 전 추가 비용 최적화/171 cutover/TEST/PRODUCTION 금지.

운영:
- 이후 사용자가 수정 지시를 하면, 사전검사 PASS이고 PREVIEW 배포 안전 상태면 같은 흐름에서 PREVIEW 배포까지 자동 진행.
- 사용자가 명시적으로 배포 금지/소스만 수정이라고 한 경우만 예외.


## 현재 최우선 — app131 PREVIEW 배포 후 PC↔모바일 좋아요 자동 동기화 검증

현재:
- app131 source fix 완료.
- 최종 Audit Run `35650903841` SUCCESS.
- 실제 PREVIEW live는 아직 app130.
- Worker / D1 / 사용자 원본 데이터 비변경.

배포 후 확인 기준:
1. A기기에서 좋아요/해제.
2. 마지막 클릭 후 30초 batch ACK 성공 뒤 B기기에서 새로고침/탭 왕복 없이 자동 반영.
3. B기기 하트 + 숫자 + 내 좋아요가 같은 곡에서 함께 바뀌어야 함.
4. B기기에 더 최신 local pending click이 있으면 오래된 remote signal이 덮지 않아야 함.
5. 앱 재진입/업데이트 후에도 마지막 계정 좋아요 상태가 같아야 함.
6. 위 기능 통과 전 추가 비용 최적화 / 171 cutover / TEST / PRODUCTION 금지.

배포는 사용자의 명확한 PREVIEW 배포 요청 전에는 하지 않는다.


## 현재 최우선 — app130 모바일 첫 화면 실사용 확인

현재 실제 PREVIEW:
- app130 Run `35648709408` SUCCESS.
- remote app version 130 / exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker/D1/user data unchanged.

사용자 확인:
1. 모바일 앱 업데이트 후 Explore 추천 첫 화면을 바로 확인.
2. 인기 탭 왕복 전에 PC 최신 좋아요 하트와 동일해야 함.
3. 같은 곡의 하트·숫자·내 좋아요가 하나의 0/1 상태로 일치해야 함.
4. 페이지 이동 후 값이 바뀐다면 아직 FAIL로 간주하고 그 경로만 계속 수정.
5. 통과 전 TEST/PRODUCTION 및 171 cutover 금지.


## 현재 최우선 — app130 PREVIEW 배포 후 모바일 최초 진입 검증

현재:
- app130 source/audit commit `1c850beed0a4b4409b96acbb636176ea2cfe4bac`
- Audit Run `35648185770` SUCCESS
- 실제 PREVIEW live는 app129

다음:
1. 사용자가 PREVIEW 배포를 요청하면 app130 Hosting만 배포.
2. 모바일에서 앱 업데이트 후 Explore 첫 진입 즉시 PC의 최종 하트/숫자와 같은지 확인.
3. 인기 탭 왕복 없이 추천/최신 첫 화면 자체가 맞아야 통과.
4. 같은 계정 한 곡 좋아요는 0/1 하나만 존재하고 하트·숫자·내 좋아요가 함께 움직이는지 확인.
5. 통과 전 171 migration / final cutover / TEST / PRODUCTION 승격 금지.


## 현재 최우선 — app129 PREVIEW 실사용 단일 좋아요 원자 검증

현재 실제 PREVIEW:
- app129 Hosting Run `35646734214` SUCCESS.
- 배포 source `0a8b1d6820493c82d8cc2924446153c967fa3798`.
- remote app version 129 / exact build PASS.
- Worker / D1 / 사용자 원본 데이터 비변경.

사용자 확인 순서:
1. 기존 빈 하트 곡 1개를 좋아요: 하트 ON + 숫자 +1 + 내 좋아요 포함.
2. 같은 곡을 좋아요 해제: 하트 OFF + 숫자 -1 + 내 좋아요 제거.
3. 같은 곡을 다시 좋아요: 정확히 한 번만 +1.
4. 30초 뒤 동일 계정의 다른 기기에서 하트·숫자·내 좋아요가 같은 상태인지 확인.
5. 페이지 추천/최신/인기/공개프로필 사이를 이동해도 같은 곡 값이 서로 달라지지 않는지 확인.

이 다섯 항목 통과 전 추가 구조 변경, 171 migration, final cutover, TEST/PRODUCTION 승격 금지.


## 현재 최우선 — app129 단일 좋아요 원자 규칙 PREVIEW 배포 전 상태

현재:
- source commit `2c9745487517b86f1f910c651497be6a0003bca8`
- Release System Audit Run `35645617094` SUCCESS
- 한 계정/한 곡 좋아요를 0/1 한 상태로 고정하고 하트·숫자·내 좋아요를 같은 변경으로 묶는 코드 반영 완료.
- 실제 PREVIEW live 앱은 아직 app128.
- Worker / D1 schema / 사용자 데이터는 이번 수정에서 변경 없음.

다음:
1. 사용자가 PREVIEW 배포를 요청하면 현재 검증 commit 기준으로 app129 Hosting만 승격.
2. 배포 후 같은 곡에서 OFF→ON은 하트 ON/숫자 +1/내 좋아요 포함이 동시에 보이는지 확인.
3. ON→OFF는 하트 OFF/숫자 -1/내 좋아요 제거가 동시에 보이는지 확인.
4. 같은 상태 중복 요청에서 숫자가 두 번 변하지 않는지 확인.
5. 같은 계정 PC↔모바일에서 최종 하트·숫자·내 좋아요가 같은 결과로 수렴하는지 확인.
6. 위 검증 전 171 D1 migration / final cutover / TEST / PRODUCTION 진행 금지.


## 현재 최우선 — app128 PREVIEW 실사용 좋아요 검증

현재:
- PREVIEW app128 Hosting `35637112915` SUCCESS.
- Worker personal-like routes hotfix `35635316035` SUCCESS.
- 두 번째 영상에서 확인된 partial-R2 클릭 잠금 원인 수정 완료.
- 171 migration / D1-only final cutover는 아직 미적용·미활성.

다음:
1. 사용자 실사용으로 빈/찬 하트 즉시 클릭 가능 여부 확인.
2. 30초 뒤 동일 계정 PC↔모바일 최종 상태 수렴 확인.
3. 좋아요→해제→좋아요 반복 시 최신 의도 유지 확인.
4. 위 검증 통과 전에는 171 D1-only 최종 cutover로 넘어가지 않는다.
5. TEST/PRODUCTION 변경 금지.


## 현재 최우선 — PREVIEW 앱127 + Worker173/174 실사용 검증 후 D1-only 최종 전환 준비

현재 실제 PREVIEW:
- 앱127 Hosting Run `35632767964` SUCCESS
- Worker173/174 Run `35631742053` SUCCESS
- 최종 감사 Run `35632451095` SUCCESS
- active PREVIEW Worker `f3c66d58-8e24-4eaa-923c-f61fe369e36f`
- 171 migration / cutover marker는 아직 미적용·미활성

다음 순서:
1. 사용자 실사용으로 PC↔모바일 동일 계정 하트/숫자 수렴, 업데이트 후 기존 상태 유지, 좋아요→해제→좋아요 반복을 확인한다.
2. 이상이 없으면 171 additive schema 적용 전 read-only preflight를 다시 실행한다.
3. PREVIEW에만 171 schema를 안전하게 준비하고, legacy queue/drain/processor idle proof를 확인한다.
4. 실제 W2 D1-only cutover는 별도 고정 commit과 proof가 모두 PASS일 때만 arm한다.
5. TEST/PRODUCTION은 사용자 승격 승인 전 변경 금지.

절대 유지:
- UI/CSS/반응형 비변경.
- 30초 좋아요 묶음 처리 유지.
- 사용자 원본 데이터 backfill/복제/대량변환 금지.
- 변경 없음 재진입 D1/Firestore read 0 목표.
- 실제 변경 D1 rows_written W1~W2 hard gate.


## 현재 최우선 — 173 generation-safe R2 publication + preCutoverProof172 controller (source-only)

170~172 기준은 `CURRENT_RELEASE_STATE.md` 0CV. exact code audit `32795d33710a8f0f3bec6d280a2fd3f740232bb4`, [run 35616444369](https://github.com/andrawing1212/soridraw-music/actions/runs/35616444369) **SUCCESS**. 실제 ephemeral remote D1에서 171 D1-only relation+count candidate가 **변경 W2 / 중복 W0**를 확인했고, 172 제품 batch route는 schema-v2 shared manifest 뒤에 dormant 상태로 연결되어 있다. 실제 Worker 배포/171 migration/R2 marker 변경 없음.

### 1. public R2 publication을 generation-safe하게 만든다

171 D1 result의 `trackId, likeCount, generation`만 사용해 변경된 곡만 patch한다.

필수:
- shared track-card-v115
- shared latest Feed의 해당 item
- shared popular Feed의 해당 item
- 해당 곡 owner의 public-profile cached item/count surface

원칙:
- D1 전체 재조회/Feed 재생성 금지.
- 각 R2 surface에 곡별 마지막 적용 `generation171`을 저장하거나 동등한 monotonic proof를 사용.
- incoming generation < 저장 generation이면 **skip**, ==이면 같은 count일 때 duplicate PASS / 다른 count면 conflict FAIL, >이면 CAS로 갱신.
- R2 write 실패 후 같은 operation 재시도에서 D1은 W0이고 publication만 안전하게 재시도 가능해야 함.
- 오래된 request가 나중에 도착해 최신 likeCount를 덮는 경우를 격리 테스트로 반드시 재현하고 차단.
- popular 순위 자체의 재정렬 정책은 명시적으로 결정. 좋아요 1회 때문에 전체 Feed D1 scan/rebuild 금지.

### 2. 개인 shared likes R2를 per-track revision-safe하게 만든다

현재 v114/list snapshot의 오래된 전체 배열 덮어쓰기로 172 canonical 상태를 잃으면 안 된다.

필수:
- 171 result의 `revision + operationId + liked`를 기준으로 해당 UID/track만 merge.
- CAS/etag 또는 동등한 조건부 write.
- incoming revision < stored revision skip, == same op/state duplicate, == conflicting state fail closed, > merge.
- PC와 모바일의 서로 다른 곡 동시 변경이 서로의 항목을 잃지 않아야 함.
- 기존 exact/partial 161 semantics와 2,000개 legacy truncation 문제를 다시 만들지 말 것.
- 정상 local cache 재진입은 D1 read 0 목표 유지. 개인 revision check도 앱 업데이트 때문에 전체 D1 scan 금지.

### 3. preCutoverProof172를 caller boolean이 아닌 실제 상태로 만든다

기존 164는 157 전용 read-only report이며 self-attested `legacyIntakeClosed`를 이미 거부한다. 172도 같은 원칙.

proof172 최소 요구:
- exact 171 table schemas/PK/WITHOUT ROWID/no secondary hot indexes.
- PREVIEW/TEST/PRODUCTION **실제 배포 Worker SHA**가 172 fence-aware exact approved SHA인지.
- legacy intake DB-level closure 또는 동등한 공용 atomic fence.
- queue 035/066/069/075 exact pending 0 (075 cursor-aware).
- scheduled processor lease/idle 및 late in-flight old writer가 더 이상 baseline을 바꿀 수 없다는 증명.
- migration/marker writer는 release controller에만 존재; product Worker가 스스로 arm 금지.
- SELECT/read-only preflight 실패 시 final cutover 전부 중단.

### 4. 비용 합격선

- 171 D1 actual change W2, duplicate W0를 유지.
- publication은 D1 row write를 추가하지 않는다.
- R2는 변경된 user/track/surface만 사용. 전체 Feed/profile rebuild 금지.
- 앱 업데이트/페이지 재진입/변경 없음은 D1 data read 0 목표.
- 새로운 DO/RTDB/외부 서비스는 필요성이 증명되지 않으면 추가하지 않는다.

### 5. 검증 및 중단 조건

- exact commit TypeScript + Build + 171/172/173 regression.
- 082 replay/idempotency 유지.
- public/private personal R2 stale/out-of-order/duplicate/CAS failure tests.
- TEST/PRODUCTION Worker dry-run.
- shared D1 live audit는 read-only.
- Work 독립 감사 전 제품 release PASS 금지.
- 구형 실제 Worker/in-flight 차단 증명 없으면 `preCutoverProof172` READY=NO 유지.
- 사용자 승인 전 171 migration apply, drain/cutover marker arm, Worker/Hosting/Functions/Firebase 배포 금지.

**현재 배포 상태:** source-only. PREVIEW 제품 배포 전, 실사용 검증 전, TEST/PRODUCTION 비변경.


## 현재 최우선 — 170 실제 D1 W1~W2 검증 + 구형 Worker 호환 원자적 전환 설계 (source-only)

168 direct `env.DB.batch` / 169 batch final marker guard는 exact `preview` code-audit `784568e785c203978c2b2fc36e1d50d67579955e`, [run 35596351769](https://github.com/andrawing1212/soridraw-music/actions/runs/35596351769) **SUCCESS**. `CURRENT_RELEASE_STATE.md` 0CU 기준. 그러나 **제품 release gate는 FAIL**, Worker/Firebase 배포와 사용자 D1/R2 변경 없음.

1. 먼저 isolated remote D1에서 실제 168 SQL `env.DB.batch`의 신규 좋아요·해제·중복·다른 기기 뒤집기·두 번째 SQL 실패 rollback과 `meta.rows_written`를 정량 확인. D1 및 기존 스키마 trigger/index 기반으로 W1~W2, duplicate W0(관계·count), R2/DO/RTDB 부가 비용까지 보고. 격리 DB 이외 실제 사용자 원본 접근은 read-only만.
2. 이미 실행 중이거나 구형 Worker가 `likes` INSERT/DELETE 후 별도 `track_stats` write하는 부분 커밋을 어떻게 정합하게 마무리하는지 다룬다. 167 queue fence fixture가 그 직접 두 호출을 보호하지 못한다. 원자적 fence/실제 배포 버전/인입 종료/기존 요청 정리의 객관적 증거 없이는 164 CLI self-attestation 차단 해제 금지.
3. `169` batch guard는 최종 162 manifest의 신규 batch 재진입만 막는다. 165 이전에 열린 요청의 늦은 D1 write와 구형 Worker가 marker를 모르는 경로는 그대로 별도 DB fence 필요. 구형 scheduled 035/066/069/075는 닫기 전에 완전히 소진해야 한다.
4. 157 additive schema + 157 sparse relation owner / 158 lazy count writer 실제 routing, legacy baseline freeze, 051 변경 신호, 141/156 exact 개인 R2 및 RTDB final settlement를 3개 환경에서 호환성 있게 통합하는 구현 순서를 작은 릴리스 단위로 정한다. 기존 하트/카운트와 UI 보호 및 테스트 장치 유지.
5. 기존 `069` auto Apply workflow는 patch-manifest 변경에 반응하고 service marker mismatch로 FAIL했다. [35595449862](https://github.com/andrawing1212/soridraw-music/actions/runs/35595449862), [35596085726](https://github.com/andrawing1212/soridraw-music/actions/runs/35596085726). **별도 workflow cleanup 작업으로 분리**하고, 이 경로를 우회하여 배포하지 말 것.
6. exact commit에서 TypeScript/Build/관련 isolated tests/모든 release gates 및 필요시 Work 독립감사. 승인된 PREVIEW 전체 코드 배포 후 PC↔모바일 하트·공개수치·비공개·읽기쓰기 비용 실사용 검증. TEST 승격은 통과 후 요청시, PRODUCTION 승격은 별도 명시 승인 시에만.

**현 시점 금지:** 사용자 shared D1에 157/167 migration, shared R2 drain/cutover marker arm, 사용자 원본 데이터 bulk write/delete/backfill, Worker/Hosting/Functions 배포. W3+를 허용하거나 single-device 통과만으로 release PASS 보고 금지. `164_CUTOVER_PREFLIGHT_READY=NO` 유지.


## 현재 최우선 — 168 direct like 원자적 관계·카운터 수정 및 실배포 구버전 경계 (격리 우선)

167 source-only SQLite 격리 검증은 exact `37d7d654d6110194d73f358bdb2e659e40197a0c`, run `35590066055` SUCCESS. queue 035/066/069/075는 DB write-level fence 실험에서 old Worker + in-flight 요청 차단 PASS. 하지만 `167_DIRECT_TWO_STATEMENT_INFLIGHT_STILL_UNFENCED=FAIL_EXPECTED`: 구형 direct `adjustExploreLikeCounterDelta`가 `likes`와 `track_stats`를 두 개의 분리된 D1 쓰기로 처리하므로, queue 0이어도 direct in-flight는 존재할 수 있다. 제품 전환 절대 금지.

1. `handleLikeD1Core`, `adjustExploreLikeCounterDelta`, batch intake와 scheduled 035/066/069/075 실제 호출을 범위 내에서 검토. direct 변경분이 반드시 한 원자적 D1 transaction/동등한 단일 owner로 처리되도록 경계를 설계. Cloudflare D1 `batch()` rollback이 이번 runtime·schema에서 실제 동작하는지 격리 DB에서 테스트.
2. 이미 배포된 **구형 direct Worker** 및 165 guard를 통과한 in-flight가 여전히 두 번 나누어 쓸 수 있는 문제를 해결해야 한다. 신규 168 Worker만 원자적이어도 구형 버전이 살아있으면 cutover 불가. 구형 compatibility window/차단/진행중 요청을 실제 증명하지 못하면 final marker arm 금지.
3. 167 fixture는 DB trigger 후보의 **격리 모델**이다. `migrations/`로 이동 또는 사용자 shared D1 apply 금지. 기존 공유 SQL trigger·인덱스와 충돌, schema owner, R2/Worker 권한, rollback, 비용을 조사하고 release controller에 실제 증명될 때만 채택.
4. 164 proof는 현재 CLI에서 self-attested closure를 거부하며 계속 read-only report 전용으로 유지. queue 0을 컷오버 승인으로 바꾸지 말 것. old direct writer 무력화 + outstanding mutation settlement + 157 schema exact + 모든 환경 reader/writer 준비가 모두 완료되어야 한다.
5. 격리 D1의 `meta.rows_written` **실제 W1~W2 / duplicate W0**, published_count/track_stats triggers 및 R2/DO/RTDB 요청당 총비용 검증. 전체 Feed/profile rebuild 없음. 051 change signals/157·158 owner 및 PC↔모바일 개인 heart와 공개 count 수렴 최종 감사 별개.
6. 기존 UI 및 Music Note 60초 묶음 저장 보호. source-only → TypeScript/Build/test → 독립 Work 감사 → 사용자 PREVIEW 검증 → TEST → 명시적 PRODUCTION 승인 순서.

**절대 금지:** 실제 shared D1 migration, R2 marker arm, 사용자 원본 backfill/overwrite/delete, PREVIEW/TEST/PRODUCTION 배포는 별도 배포 승인 전 금지. 제품 release gate FAIL 유지. 167 isolated fixture가 제품 Worker를 보호한다고 주장하지 말 것.


## 현재 최우선 — 167 공유 D1 원자적 fence 설계·격리 실행 검증 (source-only)

166 in-flight 경쟁 재현 및 허위 proof 차단은 `preview` exact `5ed766f92c31cda2407efd25c0324b167b2f84bc`, 감사 run `35588084201` **SUCCESS**. 단, 제품 전환은 아직 BLOCKED. 164 CLI는 `--legacy-intake-closed`를 거부하고 shared D1은 035/066/069/075 미처리 0, intake OPEN, 157 table/index 없음. 자세한 결과 `CURRENT_RELEASE_STATE.md` 0CS.

### 단일 작업: 진짜 원자적 종료를 설계하고 격리 모형으로 검증

1. 단순한 R2 drain guard(165)를 최종 전환 증거로 쓰지 말 것. 165 검사 직후 멈춘 기존 요청이 나중에 쓰는 166 재현 사례를 먼저 그대로 재사용한다.
2. 공유 D1 안에 최소한의 additive cutover-control/fence 후보를 설계한다. 좋아요 queue intake가 실제 D1에 쓰는 것과 “legacy intake closed” 상태 변경 사이의 원자적 순서를 보장해야 한다. SQL 한 문장 안의 조건부 INSERT, 단일 소유자 직렬화 등 실현 가능한 최소 경로만 비교한다. 하나의 조건 조회 + 별개 INSERT는 TOCTOU이며 FAIL.
3. legacy direct `PUT/DELETE`의 기존 `likes`/track_stats 변경과 069/055 batch queue, 035/066/075 scheduled processor의 모든 실제 진입 경로를 확인한다. 157/158 이후 legacy mutation은 확실히 차단하고, 전환 전 이미 수락된 요청은 안전하게 처리되어야 한다.
4. PREVIEW/TEST/PRODUCTION의 모든 **실제 배포 Worker 버전**이 공용 fence를 준수하는지 확인할 방법을 마련한다. 신규 코드가 준비됐다는 문서 또는 R2 bool만으로 구형 배포본의 준수를 가정하지 않는다. 구형 in-flight가 남을 수 있는 경우에는 full cutover를 계속 거부한다.
5. 기존 `164`의 read-only queue/schema 검사, 165 client durable retry, 162 effective reader, 163 legacy writer freeze를 변경 없이 보호하고 새 격리 fixture에서 **in-flight vs fence / fence vs intake / queue drain 후 fence / old Worker bypass / duplicate / PC↔mobile intent** 순서를 검증한다.
6. D1 실제 격리 원격 DB에서 SQL query plan과 `meta.rows_written`을 검증하기 전에는 W1~W2 PASS 선언 금지. R2/DO/RTDB 추가 비용과 크로스 환경 호환성, 복구 계획도 확인한다. shared user DB migration apply 금지.
7. 안전한 barrier 증명이 불가능하거나 old Worker가 fence를 우회하면 제품 릴리스 gate는 FAIL 상태로 유지하고 정확한 우회 경로를 문서화한다.

### 고정 제한
- shared D1 실제 migration/seed/write 금지, 사용자 R2 drain/cutover marker arm 금지, PREVIEW/TEST/PRODUCTION Worker 배포 금지. 사용자 원본 데이터 삭제·백필·변환 없음.
- 안정 캐시 재진입에서 D1 data read 0 목표; 누른 좋아요는 바뀐 곡만. 원격 W3+ 또는 전체 재생성은 FAIL.
- 기존 좋아요/공개/비공개/UI/Music Note 묶음 저장 보호.
- exact commit에서 TypeScript/Build/isolated SQL tests/전체 release-system 감사 완료 후 Work 독립감사. 실제 PREVIEW/PC·모바일 실사용은 사용자 배포 승인 이후.
- 코드 승인과 PRODUCTION 승격은 별개. 사용자 명시 승인 없이 production 비변경.


## 현재 최우선 — 166 전 환경 intake 종료 증명 + in-flight 안전 전환 (source-only)

165 구현과 164 cursor 교정은 [run 35586848857](https://github.com/andrawing1212/soridraw-music/actions/runs/35586848857)에서 exact `9eafb865114456139cdd8b51882537b6ca11eec7` SUCCESS. 0CR 기준 **075의 실제 pending은 0**으로 정정되었다. 현재 164 read-only preflight가 막히는 이유는 `legacyIntakeClosed=false`와 157 table/index 미적용이다. 현재 신규 shared drain marker는 source-only이며 실제로 arm되지 않았다.

### 166 목표: “marker 보임”을 “모든 구형 writer가 멎음”으로 오인하지 않는 검증

1. 현재 165 guard를 지난 in-flight direct/batch request가 drain marker arm 이후에 queue/legacy relation을 쓸 수 있는 경쟁 상태를 좁은 실행형 test로 재현하고, **실제 인입 종료 증명 방법**을 설계한다. 검사 시점 이전에 실행 중이던 요청도 완전히 종료됐음을 보장하기 전에는 164 proof를 발행하지 않는다.
2. 035/066/069/075는 cursor-aware `LIMIT 1` 기반 읽기 전용 미처리 확인. 075 raw table 행 존재만으로 pending이라 선언 금지. 단일 체크 순간의 0과 안정적인 quiescence를 구분한다.
3. 164 CLI `--legacy-intake-closed` 같은 호출자 자기선언은 **실제 폐쇄 증명으로 취급 금지**. 전 환경 Worker 버전/바인딩, 공통 drain token 및 이전에 진입한 요청의 완료, 실제 schema/index를 검증한 독립 release controller만 proof 후보를 만들도록 source-level gate를 설계한다.
4. PREVIEW/TEST/PRODUCTION 사용자 데이터는 동일 shared D1/R2다. 세 환경의 reader/writer가 모두 전환을 이해하기 전에는 어떤 환경도 개별 cutover 금지. 구형 앱 재시도와 기존 Worker 코드를 고려할 것.
5. 157/158 owner는 dormant/source-only로 기존 기능을 보존하면서 연결 준비. final 162 marker를 실제 arm하기 전에는 `likes`/track_stats 기존 writer 정상 유지.
6. marker arm 후에는 163 구형 writer 차단, 157 sparse override 및 158 lazy count만 canonical을 수정하도록 검증. 반쪽 전환·복구 없는 rollback 금지.
7. 051 전체 global revision 대체 변경 신호, 141/156 exact 개인 R2, 공개 Feed/card/profile 부분 갱신, RTDB final settlement, D1 외 R2/DO/RTDB 총비용, PC↔모바일 동기화 검증이 제품 배포의 별도 필수 항목임을 유지한다.

### 금지/합격선

- 실제 157 migration apply, drain/cutover R2 marker write, Worker/Firebase 배포, 사용자 데이터 backfill/delete/transform은 **추가 승인 전 금지**.
- 정상 Explore 재진입/업데이트 D1 data read 0 목표, 변경 있을 때만 R2/D1 접근.
- 실관계 변경 W1~W2, 중복 W0, W3+ FAIL. 새 guard로 변경 없는 화면 읽기 또는 무의미한 서버 쓰기 증가 금지.
- exact source commit TS/Build/실행형 source 회귀/TEST·PRODUCTION dry-run/shared D1 read-only audit. 제품 release gate는 계속 FAIL.
- source-only 검증 성공을 실제 배포/세 환경 활성화 완료로 보고 금지.

**기준:** code-audit commit `9eafb865114456139cdd8b51882537b6ca11eec7`; Worker SHA256 `316fc57b2a0ed6ff30a26b5a26e0309b9667db95bb164289de422f6132899f08`; 정확한 내용 `DOCS/CURRENT_RELEASE_STATE.md` 0CR.


## 현재 최우선 — 165 legacy intake drain barrier + dormant 157/158 writer cutover

164 실제 read-only preflight는 run `35584354578`에서 PASS했고, 현재 shared D1은 **075 pending 존재 + 157 schema 미적용 + legacy intake open** 상태라 전환 준비가 아직 안 됐다.

다음 구현은 배포가 아니라 source-only로 아래 경계를 만든다.

### 165 목표
1. 최종 162 marker를 arm하기 전에 별도 **draining 단계**를 둔다. reader는 계속 legacy `likes`를 정상 사용하고, 새 좋아요 intake만 잠시 retriable 상태로 막는다.
2. draining 동안 scheduled legacy processor는 계속 살아 있어 035/066/069/075를 끝까지 비울 수 있어야 한다.
3. 앱의 durable local outbox가 draining/503 같은 retriable 실패에서 마지막 클릭을 삭제하지 않고 그대로 재시도하는지 실행형 test로 고정한다.
4. 네 queue가 bounded probe 기준 모두 0이고, 157 table/index exact + shared owner 준비가 증명된 뒤에만 164 proof가 만들어질 수 있다.
5. final 162 marker가 fully armed되면 163이 legacy relation/count writer를 막고, 그때부터만 157 overlay + 158 lazy count owner를 허용한다.
6. draining 신호/검사는 페이지 진입·재방문 hot path에 넣지 않는다. 좋아요 server intake와 release operation에만 한정한다.

### 반드시 보호
- marker 없음: 현재 legacy 동작 100% 유지
- draining: reader 정상, scheduled drain 정상, 신규 intake는 D1 write 전에 retriable reject
- final overlay157: legacy writer 물리 차단
- failed/partial signal: fail-closed
- 사용자 전체 likes/feed/profile scan/backfill 없음
- 실제 relation 변경 W1~W2 / duplicate W0 기준 유지
- 10만 사용자 앱 업데이트/페이지 재진입 때문에 새 D1/R2 read가 생기면 FAIL

### 현재 금지
157 shared migration apply, 실제 drain signal write, final cutover marker write, PREVIEW/TEST/PRODUCTION Worker 배포, shared user data 변환/삭제/backfill, Firebase/Functions 변경은 사용자 승인 전 실행하지 않는다.

### 기준
- latest verified source before 165: `caf4950095e8288868c738b2e22c6ca98967b30f`
- audit: `35584354578` SUCCESS
- live preflight: intake open / 035=0 / 066=0 / 069=0 / 075=pending / 157 schema absent
- canonical SHA256: `ea884a1bf2c6acd1bf951d6cfac1fef774242c8736bab3330df05c0194dcb2f1`


## 현재 최우선 — 164 proof를 실제 상태에서 만드는 read-only cutover preflight 준비

162/163/164의 소비자·차단기는 코드/감사 PASS다. 다음 단계는 **공유 전환 marker를 쓰는 것 자체가 아니라, marker에 들어갈 164 증거를 실제 환경에서 안전하게 만들 수 있는 preflight를 구현·검증하는 것**이다.

### 목표
1. PREVIEW/TEST/PRODUCTION의 구형 좋아요 intake 경로가 모두 같은 release operation에서 닫힐 수 있는지 source 기준으로 고정한다.
2. shared D1에서 `explore_like_batches_035`, `explore_like_batches_066`, `explore_like_batches_069`, `explore_like_user_queue_075` 각각에 **대기 행이 1건이라도 있는지** read-only bounded 존재조회로 확인한다. 전체 COUNT/scan을 새 정상 경로로 만들지 않는다.
3. `explore_like_overrides_157` 및 필요한 index/schema가 shared D1의 단일 owner로 준비됐는지 read-only로 증명한다.
4. 위 결과가 모두 PASS일 때만 `preCutoverProof164` 후보를 생성한다. 이 단계에서는 shared R2 marker write 금지.
5. 078/162/163/164 회귀 + TypeScript/Build + TEST/PRODUCTION Worker dry-run + shared D1 read-only preflight를 고정 commit에서 통과시킨다.

### 반드시 지킬 전환 순서
`legacy intake close` → `035/066/069/075 drain=0 확인` → `157 schema/owner ready 확인` → `all-env reader/writer readiness 확인` → **사용자 승인 후에만** shared cutover marker arm → 163이 legacy relation/count writer 차단 → 157/158 owner 경로 사용.

marker arm 전에는 실패 시 intake를 다시 열 수 있어야 한다. **marker arm 후에는 legacy `likes`가 frozen baseline이므로 단순히 구형 writer를 다시 켜는 롤백 금지.** overlay-aware rollback 계획이 없으면 실제 cutover 실행 금지.

### 현재 금지
- 157 migration 실제 shared D1 적용
- shared cutover marker 생성/수정/삭제
- PREVIEW/TEST/PRODUCTION Worker 배포
- Firebase/Functions/Rules 배포
- 사용자 원본 데이터 backfill/delete/transform
- 전체 likes/feed/profile scan 또는 전체 재생성
- W3+를 허용하도록 비용 gate 완화

### 현재 검증 기준
- code-audit commit: `2157efdcb7ee5c3c2e4b437489c8e856cd99918d`
- audit run: `35583684236` SUCCESS
- canonical Worker SHA256: `ea884a1bf2c6acd1bf951d6cfac1fef774242c8736bab3330df05c0194dcb2f1`
- 157 실측 비용 기준: 실제 관계 변경 W1~W2, 중복 W0; 사용자 전체 backfill 0
- 실제 서비스/사용자 데이터/157 schema는 아직 비변경 상태


## 최신 161 완료 — 다음은 157 effective membership gate + 세 환경 writer cutover source 통합 (2026-09-21 KST)

reader-first 161은 [run 35577973005](https://github.com/andrawing1212/soridraw-music/actions/runs/35577973005), exact `8bcc02e69f1f548f094dc2f90b44c8cfacea3767` SUCCESS. legacy 1,999/2,000 likes snapshot은 partial, 156 exact 2,053 snapshot은 exact로 판정. partial 기기는 local heart를 지우지 않고 visible cache miss만 bounded D1 membership lookup, exact R2는 원본 D1 R0. canonical Worker hash `fabe274fde6d2ed1099f14f54852c06e12e4e37a5799708bbf8e1176fb85cc45`. 배포/데이터 변경 없음.

**다음 단일 구현 범위 — 157 활성화 전 반드시 해결:**
1. 161의 `readBoundedLegacyLikeMemberships161`는 현재 legacy `likes`가 canonical인 동안만 정답이다. 157 cutover 이후에는 `likes`가 frozen baseline이므로 **cutover flag가 true일 때만 baseline + `explore_like_overrides_157` effective membership을 읽는 분기**를 source-level로 구현한다. flag false / table 미적용 환경은 기존 legacy query를 그대로 사용. migration을 실제 적용하지 않는다.
2. 159에서 고정한 relation writer 3개(`adjustExploreLikeCounterDelta`, `processExploreLikeAggregateWave035`, `processExploreLikeUserQueueWave075`)와 count rebuild 1개(`refreshLikeCount`)의 실제 호출/route/scheduled 경로를 하나씩 고정하고, 157/158 shared owner로 전환했을 때 구형 writer가 legacy baseline을 다시 쓰지 못하도록 **실행형 cutover gate**를 구현한다. 한 환경만 활성화하는 host guard 금지.
3. PREVIEW/TEST/PRODUCTION이 같은 공유 사용자 원본을 쓰므로 writer freeze는 세 환경 코드가 모두 호환 준비된 뒤 하나의 승인된 cutover token으로만 활성화. 코드에 `true` 상수로 우회 금지. token mismatch/누락 시 new writer가 아니라 legacy 안전 경로 또는 fail-closed 중 기능 손실이 없는 쪽을 명시적으로 검증.
4. 158 lazy count baseline도 같은 cutover token과 묶고 `track_stats`가 frozen 이후 첫 changed track 1회 read만 허용. `refreshLikeCount`나 035/075가 동시에 track_stats를 갱신하는 상태에서 158 활성화 금지.
5. 051 global revision 대체 신호/RTDB final settlement/public card-feed-profile generation은 writer owner 전환과 같은 operation ID/revision 계약을 사용해야 한다. 좋아요 하나로 전체 Feed/Profile rebuild/scan 금지.
6. source-only/isolated tests로 old→new 순서, new→old retry, same-track multi-user, duplicate operation, partial legacy device, exact R2 device, rollback을 검증. W3+면 STOP. 실제 shared migration/writer freeze/deploy는 별도 승인 전 금지.

**합격선:** unchanged exact R2 revisit D1 R0, partial visible membership은 요청 track 수에만 비례하는 indexed lookup, relation actual change W1~W2/duplicate W0, 기존 likes/track_stats 전체 backfill 0, old app response shape 유지, PC↔모바일 eventual convergence 설계가 실행형 test로 증명될 것.

**금지:** 157 migration apply, legacy likes/track_stats 실제 freeze, trigger/index DROP, 대량 R2 rebuild, 사용자 데이터 복사/변환, TEST/PRODUCTION 실제 Worker 변경은 사용자 승인 전 실행하지 않는다.


## 최신 159/160 완료 — 다음은 reader-first exact/incomplete 판정 연결 (2026-09-21 KST)

최종 audit [35576793526](https://github.com/andrawing1212/soridraw-music/actions/runs/35576793526), exact `7bcd28f909eda4544ee9919351d8dfd6ec7853bf` SUCCESS. canonical Worker SHA256 `c517ac6193cfe1bd12234a8158e9abcc89fd081fe0ab35b5a319b464fb553081` 일치. TypeScript/Build/156~160 회귀, 054→160 replay fixture, TEST/PRODUCTION dry-run, 공유 D1 read-only preflight PASS. 배포/공유 데이터 변경 없음.

159가 고정한 legacy 범위:
- relation writer 3개: `adjustExploreLikeCounterDelta`, `processExploreLikeAggregateWave035`, `processExploreLikeUserQueueWave075`
- count rebuild writer 1개: `refreshLikeCount`
- 개인 reader-first 대상 4개: `readSharedLikes061`, `rebuildExploreLikeR2Bundle`, `handleMySocialSnapshot042`, `handleMyLikedTracks052`
- direct route + 069/055 batch는 아직 157/158 owner cutover 전.

160은 direct PUT/DELETE 호환 route의 `RATE_DB.api_rate_limits` 추가 D1 write를 제거하고 기존 `LIKE_RATE_LIMITER`로 통일. 현재 앱 UI 클릭은 local outbox → `/v1/me/likes/batch`이므로 160은 구형 direct 호환 비용 제거이지 relation/count 전체 컷오버 완료가 아님.

**다음 단일 구현 범위: reader-first exact/incomplete 구분**
1. 현재 `readSharedLikes061`가 v114의 `likedTrackIds` 배열만 있으면 완전본으로 취급하는 경로를 바꿔, `canonicalComplete156:true + exactLikeCount156===likedTrackIds.length + canonicalSource156`이면 exact로 판정하고 그렇지 않은 legacy snapshot은 **정상 캐시 표시용은 유지하되 cold repair가 필요한 incomplete 상태로 구분**한다.
2. `handleMySocialSnapshot042` / `handleMyLikedTracks052`가 incomplete legacy snapshot을 조용히 "전체 좋아요"로 확정하지 않도록 source-level 하위호환 계약을 구현한다. 기존 앱이 읽는 응답 shape는 깨지지 않게 유지하고, exact marker가 생긴 뒤에는 D1 R0 재방문 경로를 유지한다.
3. cold repair는 157 migration이 아직 미적용이므로 **실 shared D1에서 실행 금지**. source/test에서는 157 pager → 156 exact R2 rebuild 연결만 검증하고, 실제 D1 fallback은 명시적 157 schema/cutover gate 없이는 fail-closed.
4. reader-first 변경은 writer freeze보다 먼저 배포 가능한 하위호환이어야 한다. 구형 TEST/PRODUCTION writer가 계속 legacy `likes`를 바꾸는 동안에도 기존 v114 object를 삭제/덮어쓰거나 사용자 하트를 숨기지 않는다.
5. exact source commit에서 기존 2,000 이하/정확히 2,000/2,000 초과 synthetic cache, PC↔모바일 stale order, old app response shape를 검증. 정상 exact R2 재방문은 D1 R0. 이후에만 세 환경 writer 단일 owner cutover 단계로 이동.

**금지:** reader-first 작업을 이유로 157 shared migration apply, legacy `likes`/track_stats freeze/drop, user backfill, R2 대량재생성, TEST/PRODUCTION 실제 Worker 배포를 자동 실행하지 않는다. incomplete legacy snapshot을 exact로 선언하거나, 반대로 기존 사용자 하트를 빈 목록으로 반환하는 것도 금지.


## 최신 157/158 우선 — 기존 likes를 복사하지 않는 sparse override + 곡 count lazy baseline (2026-09-21 KST)

실제 [run 35568696258](https://github.com/andrawing1212/soridraw-music/actions/runs/35568696258), exact `a47f54b112d6fd732cde394fe360891f86d3de68` SUCCESS. 153의 user-first 새 relation 전체 이전 대신 **기존 likes를 불변 baseline으로 남기고 달라진 관계만 override하는 157**을 우선 후보로 고정. 실제 격리 Cloudflare D1: 새 deviation INSERT/tombstone **W2**, baseline 복귀 DELETE **W1**, 동일 상태 중복 **W0**. 기존 사용자 relation 전체 backfill 0. `explore_like_overrides_157` migration은 추가형 SQL만 존재하고 shared D1에는 미적용. 157 cold union planner는 legacy user-recent + override PK/recent index를 모두 indexed SEARCH. 156 exact R2는 157 pager에서 2,054 likes 무손실 구성 mock PASS.

158은 전곡 count seed를 없앰. 첫 실제 변경 곡만 frozen `track_stats.like_count` PK read 1회 → shared track owner durable baseline. restart 후 추가 baseline read 0. live D1 EXPLAIN `sqlite_autoindex_track_stats_1 (track_id=?)` PASS. cutover token mismatch와 legacy writer 미컷오버 상태는 fail-closed.

**다음 단일 구현 범위 — backfill을 다시 만들지 말 것:**
1. PREVIEW/TEST/PRODUCTION 현재 Worker의 **모든 개인 좋아요 reader/writer + legacy likes/track_stats writer** 목록을 정확히 고정. 061 canonical exact guard는 repository canonical source에 들어갔지만 현장 Worker071/TEST/PRODUCTION은 아직 기존 배포본이므로 *코드 존재=실환경 guard*로 오인 금지.
2. **reader-first 하위호환 단계**를 구현: 기존 v114 exact shared R2를 우선 사용하고, 157 활성화 후 cold repair만 legacy baseline+override union을 사용. 정상 재진입/업데이트는 D1 R0 유지. 기존 2천 snapshot을 완전본으로 추정하지 말고 156 exact marker 없으면 신형 final publisher가 거부.
3. **writer cutover는 세 환경 모두 같은 shared owner를 쓰는 전제**로 구현. old `likes`와 track_stats를 baseline으로 freeze한 뒤에만 157/158 허용. 한 환경만 157 writer 활성화 금지. 157 relation action은 W1~W2/W0 유지, 158은 첫 changed track read-only seed 후 147 count delta. 051 global revision은 기능등가 작은 변경신호/RTDB로 대체하고 old writer 우회가 없는지 실행형 검증.
4. public card/feed/popular/profile의 같은 generation 부분 갱신, 141/156 개인 exact R2, 앱127 operationId/baseRevision/final settlement를 실제 Worker/Auth path에 연결. 전체 Feed/profile rebuild/scan 금지.
5. 격리/제한 계정에서 역순·오프라인·PC↔모바일·동일 곡 다사용자·공개/비공개·구형 앱 병존/rollback 검증. D1뿐 아니라 DO/R2/RTDB 총비용 10만 사용자 기준 산정. 최종 exact TS/Build/회귀/Work/실주소 PREVIEW 후에만 배포 판단.

**금지:** 157 shared migration apply, old likes/track_stats writer freeze, trigger/index DROP, 사용자 원본 변환, TEST/PRODUCTION/PRODUCTION worker 변경은 영향·복구 범위와 사용자 승인 전 실행 금지. 153 관계 전체 backfill을 새 경로에 다시 넣지 않는다. W3+ 또는 기존 하트/숫자 누락이 나오면 STOP.


## 최신 155 실측·무손실 복구 조회 후보 — 다음은 R2 2천+·세 환경 무손실 전환 (2026-09-21 KST)

실제 [run 35566094717](https://github.com/andrawing1212/soridraw-music/actions/runs/35566094717), exact `1d6571eead45326f1dc6d746567640e15c85648c` SUCCESS. 미적용 153 인덱스 `(user_uid, created_at DESC, track_id DESC)`가 실제 격리 Cloudflare D1에서 좋아요 **W2/해제 W1/중복 W0**임을 재확인. 같은 ms에 다른 곡을 좋아요한 경우 실제 SQL keyset 페이지가 누락 없이 넘어가는지 검증. `createLikeRecentPager155`는 128개 이하 read-only 페이지, `verify-135`는 2,053개 synthetic 좋아요 무손실 복구 PASS. **실 R2 2천개 제한 자체는 변경되지 않았고 신규 pager는 Worker 미연결.** 상태 문서 0CL.

**우선 다음 구현:** 실제 공유 사용자 데이터를 변환하기 전, 기존 R2 개인 snapshot v114의 2천 제한, 061 writer `slice(0,2000)`, 141 fail-closed, 074 및 3환경 개인 좋아요 reader/writer 목록을 고정. 정상 캐시는 재진입 원본 D1 R0 유지. 기존 cache를 바꾸지 않고 새 pagination 결과를 읽어 복구할 수 있는 **호환 가능한 cold-only 경로**를 격리 계정에서 구현·검증. 불완전 목록을 완전한 현재 하트로 선언하지 않고 누락/동시 변경 검증. 051 변경 신호, 147 곡별 counter 시드, public Feed/profile, 전체 legacy writers의 단일 owner 공존 차단과 함께 완성해야 함. R2/DO/RTDB 및 최종 사용자 행동 총비용 10만 규모 검토.

**차단:** 공유 D1 v153 자동 생성/백필, 기존 likes·트리거·인덱스 제거, 실제 사용자 데이터 이동, 구형 Worker 우회, PRODUCTION 수정은 명시적 변경범위·복구 및 사용자 승인 전 금지. 격리 D1 W2만으로 제품/배포 PASS 금지. 실제 PREVIEW 앱126/Worker071 유지, TypeScript/Build/회귀 PASS는 위 run 소스 커밋 한정. 이후 최종 변경은 별도 exact source audit + Work/PC·모바일/실주소 검증 후 사용자 배포 승인.


## 최신 153 실측 기준 — user-first WITHOUT ROWID 좋아요 W2 / 구형 공유 writer 전환 (2026-09-21 KST)

사용자의 격리 D1 비용 확인 및 실제 구현 요청을 수행. GitHub Actions [35563388506](https://github.com/andrawing1212/soridraw-music/actions/runs/35563388506), [35563565716](https://github.com/andrawing1212/soridraw-music/actions/runs/35563565716)에서 각각 **신규 임시 Cloudflare 원격 D1 생성→synthetic 좋아요·해제 meta.rows_written 측정→DB 삭제까지 PASS**. 상세 표 `DOCS/LIKE_WRITE_REDESIGN_133.md` §153. 기존 rowid+PK+두 index+051 트리거 W5 좋아요, W2 해제. **사용자 우선 `WITHOUT ROWID PRIMARY KEY(user_uid,track_id)` + 최근 조회 인덱스 1개는 W2 좋아요, W1 해제, 중복 W0이며 UID index search 유지**. 추가 인덱스 없는 동일 PK는 W1/W1이나 최근 순서 인덱스 부재. 섣불리 기존 likes의 index만 DROP하지 말 것.

새 미적용 추가형 migration `cloudflare/explore-worker/migrations/20260921_01_explore_likes_v153_additive.sql`, 새 code path `createLikeRelationOnly146(...,{relationTable:'explore_likes_153',cutoverVerified:true})`, 기존 135 격리 검사 153 분기. 실제 Cloudflare 공유 DB에 해당 테이블이 아직 없으며 cutover flag는 **실제 승인·데이터 전환의 증빙이 아님**. 현 Worker071 및 TEST/PRODUCTION 구형 reader/writer·051 global revision을 우회하면 기존 개인 좋아요가 누락될 수 있으므로 단독 배포 금지.

**다음 개발자의 구체적 완성 순서:**
1. 먼저 shared D1의 실제 원본 좋아요와 실사용 캐시를 **READ-ONLY**로 비교해 legacy writer 목록·새 user-first 질의·공개곡 단일 count의 복구 설계를 고정. 신규 v153에 기존 사용자 좋아요를 옮기는 backfill, schema 실제 적용, D1 원본/trigger/index 변경은 명확한 변경범위·복구계획 승인 전 실행 금지. 소수 테스트 계정/flag 검증 우선.
2. 세 환경의 기존 D1/R2 writer와 reader가 새 153 canonical에 단일 owner를 거쳐 순차 수렴하도록 하위호환 단계 설계/구현. 051 global revision은 값만 사라지면 기존 사용자/캐시가 감지 못하므로 기능등가 변경신호가 필요. 곡별 147 counter의 기존 track_stats 검증 시드, Feed/latest/popular/profile 부분 갱신, 141 개인 좋아요 2천+ 분할과 RTDB 알림을 함께 검증할 것.
3. 승인된 별도 isolated test resources에서 실제 153 adapter가 SQL batch/DO/R2를 통해 W2 및 10만 사용자 총비용을 재현하는지 확인. 다 기기 역순·공개/비공개/재공개·동일 곡 여러 사용자·old Worker 병존/복구 검증. 기존 데이터 대량변환 또는 파괴적 migration은 절대 자동 실행하지 않음.
4. exact commit TS/Build/기능 검증/Work 감사/실주소 PREVIEW 검증. TEST/PRODUCTION 승격은 사용자의 단계별 승인에 따름.

**금지:** 최신 원격 실측 W2를 서비스 전체 비용 PASS로 혼동 금지. 추가형 SQL을 앱127/Worker 후보와 함께 먼저 배포하는 방식 금지. W3+가 나오면 이전 구조로 되돌리거나 비용/호환성 원인 해결 전 승격 중지. 신규 임시 D1 측정은 기존 감사 Workflow에 명시적으로만 통합되며 모든 push에서 자동 생성하지 않음.

## 최신 0CI — 실제 Audit 성공 / 운영 D1 W2 구조 충돌 확정 (2026-09-21 KST)

이번 턴에 `preview` 실제 회귀 검증 문제를 수정: `scripts/verify-127-atomic-personal-like.mjs`의 export 혼입으로 GitHub run 35561196390 및 35561748160 FAIL하던 문제를 고침. GitHub Actions read-only run `35561894019` `9001e19c1658475b181ae7571324f537ed76133d` **SUCCESS**: TypeScript, Build, 127/128/135~152 격리 회귀, 132/133/134/148 write 모형, TEST/PRODUCTION Worker dry-run, 공유 D1 read-only preflight 전부 PASS. 후속 run `35562080167` `c2dfd3bc69c3eabd0f165b3e49c6418ff7da7c13` **SUCCESS**에서 실제 공유 D1 `likes` DDL까지 확인:
- `sqlite_autoindex_likes_1` PK, `idx_likes_period_rank(created_at DESC, track_id, user_uid)`, `idx_likes_user_recent(user_uid,created_at DESC)` 인덱스 3개;
- `soridraw_shared_rev_likes_ai_051/ad_051/au_051`: likes INSERT/DELETE/UPDATE마다 `explore_shared_revision`의 `global` row revision+1;
- track_stats 자체 032/051 트리거와 derived rank/changes 인덱스도 존재.
**따라서 146 relation-only 후보의 메모리 SQLite 논리 1행을 운영 D1 W1~W2 합격으로 말하지 말 것**. 인덱스+051 global revision 추가 write가 반드시 존재. 실제 `meta.rows_written`은 미측정이며 유효한 비용 계약 변경·실운영 전환 없이 배포 금지. 위 CI SUCCESS는 릴리스 준비 PASS가 아닌 *기존 배포 없는 감사* PASS.

**다음 구현은 더 많은 139~152 후보 함수 추가가 아님.** 현재 READ-ONLY schema와 세 환경 기존 reader/Writer 목록에서 어떤 인덱스가 개인 조회/period rank에 필수인지, 051 global revision을 제거/이동해도 동기화가 유지되는지 검증하고, 대체 projection과 무손실 복구/호환 전환을 하나의 완료 가능한 릴리스로 설계해야 함. 정확한 D1 W1~W2는 격리 D1에서 index/trigger 포함 실측. shared D1 구조 변경/새 공통 owner 인프라/프로덕션 Writer 컷오버는 사용자 **명확한 승인 전 실행 금지**, 미승인 상태에서는 공유 원본 변환·trigger DROP·앱/Worker 배포 금지. 상태 `DOCS/CURRENT_RELEASE_STATE.md` 0CI 참조.

## 최신 0CH — 150~152 계정·곡 순서 유실 보호 / 공유 트랙 카드 CAS 구현 (2026-09-21 KST)

실제 `preview` 변경: `cloudflare/explore-worker/runtime/like-fenced-139.mjs`의 147은 사용자별 이전 revision+1만 승인, 새 UID의 첫 수정은 revision1만 승인(누락/기존 사용자 시드 오류 시 fail-closed). 동일 파일에 실제 공유 카드 v115 키·필드를 유지하는 `createLikeSharedTrackCardPublisher151`을 추가: 조건부 ETag PUT, 기존 필드 보존, 카드 좋아요 숫자·stats 숫자 동일하게 변경, 세대 순서 및 최초 기초 숫자 검증. R2의 구형 Writer에 의해 151 세대가 유실되면 무작정 새 세대를 쓰지 않고 감사 복구 요구. **이는 카드 하나의 게시자이지 전체 Explore 갱신자가 아님.** 147은 `surfaceGenerations.card/feed/profile` 모두 곡별 영속 세대 이상임을 증명하기 전에는 139 개인 확정을 차단(152). `scripts/verify-135-like-fenced-protocol.mjs`에 150 결손 순번, 151 새 카드/중복/역순/동시 CAS/old baseline, 152 카드만 갱신 후 개인 미확정·재시도 추가; 실제 GitHub 코드 V8 격리 전체 PASS. 기존 135 legacy writer bypass/실 D1 비용/제품 준비 FAIL 유지.

**다음 우선순위:** (1) 실제 공유 카드 외에 추천·최신·인기 및 공개프로필의 정확한 read/write 경로를 비교하고, 해당 곡만 조건부 갱신하는 feed/profile 152 세대 게시자를 구현. 인기 정렬·캐시 범위 밖 곡 처리에서 구형 D1 파생 데이터가 stale하지 않도록 별도 검증. (2) 모든 환경 구형 무조건 R2 Writer와 구형 count reader 컷오버 + UID/곡별 DO 바인딩·인증·감사 시드·RTDB 신호. (3) 공유 D1 원본 아닌 격리 D1에서 활성 index 포함 실제 `meta.rows_written` W1~W2, DO/R2 총비용·2천 곡 캐시 데이터 무손실 확장. (4) TS/Build/전체 CI/Work/PC↔모바일 최종검증. 프로덕션 승인 없이는 사용 데이터 변환/공유 DB migration/환경 승격 금지. PREVIEW 미완성 후보 배포 금지.

## 최신 0CG — 146/147/149 단일 좋아요 관계 + 곡별 영속 집계 후보까지 실제 코드 구현 (2026-09-21 KST)

새 파일 없이 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 `createLikeRelationOnly146(db,commitAggregate)`와 `createLikeTrackAggregator147(trackId,storage,publishTrack)` 구현. 139이 사전 확정 membership/operation ID/revision/seq 전달; 146이 **likes 관계만 D1 batch로 변경**, 원본 count/derived 실시간 트리거 호출을 의도적으로 제거한 후보. D1 확정 후 147이 정확한 미리 검증된 곡별 초기 count에 대한 UID별 revision/idempotent delta를 트랜잭션 안에서 기록, 버전부여 공개 R2 갱신 증명을 받은 뒤에야 139 개인 R2 확정. 실제 DO/DB 공통 바인딩에 미연결. 기존 135 실행형 테스트에 146/147/149 검증 추가: 애매한 D1 응답, 공개 R2 장애, 다른 사용자 동일곡, 뒤늦은 요청, 곡 total 미시드, 잘못된 사전 membership 등 격리 PASS. 134 격리 SQLite 148은 원본 likes 단독 논리 좋아요1/중복0/해제1, **구형 track_stats 및 derived 숫자 미갱신**을 명시적 release FAIL로 검증. 별도 in-memory SQLite 결과 6/6 대 1/0/1 재확인; D1 인덱스 과금과는 별개. 0CG 현재 상태 문서 참조.

**실제 배포 후보까지 필수 순서:**
1. 공유 D1 live sqlite_schema READ-ONLY 확인 및 격리 D1에서 기존 likes 실제 인덱스 포함 meta.rows_written W1~W2 측정. 결과 W3+면 relation-only도 실패, 단일 PK/인덱스 최소화 대체를 별도 격리 검증. 인덱스 삭제로 검색/개인조회 full scan 허용하지 않음.
2. 각 곡의 기존 track_stats 값을 건드리지 않고 정확한 초기 총수 검증/영속 count 시드 설계(승인된 제한된 테스트 데이터 우선) 및 구형 reader의 track_stats/derived 숫자 접근을 하위호환으로 전환. 원본 전체 백필·migration·트리거 DROP은 승인 전 실행 금지.
3. TEST/PRODUCTION 구형 모든 공유 D1/R2 writer를 새 143 UID owner·147 곡별 owner에 우회 없이 연결할 단계별 계획. 사용자 승인 없는 PRODUCTION 변경 금지. 실제 인증 HTTP 서비스 바인딩, 141 개인 R2, 공개 Feed/프로필의 부분 갱신과 RTDB 신호, 기존 2천 곡 좋아요 캐시 확장까지 묶어 검증.
4. D1 절감뿐 아니라 147의 UID별 영속 기록·총수 행·DO 실행·R2 추가 API 총비용을 10만 사용자 기준 측정. 전체 TS/Build/실제 Worker 검증/Work 독립 감사/PC↔모바일 실사용 후 PREVIEW 출시 판단. W1~W2 또는 핵심 기능 하나라도 미달 시 배포 중단.

## 최신 145 — D1 쓰기 행 폭증 원인 확정 / 실서비스 계량 전 새 Worker 배포 금지 (2026-09-21 KST)

사용자 "왜 2행 이상인지 세계 전체를 뒤져서라도 정확히 알아보고 방법을 찾아봐" 요청. DOCS/LIKE_WRITE_REDESIGN_133.md 145에서 원인별 SQL·실무 문헌·실행계획을 고정. **현재 069 queue INSERT/DELETE 논리 2 + likes/track_stats 논리 2 + 032/033 derived_tracks/global seq/Feed journal/profile journal 논리 4 = 격리 합성 8**. 큐 없는 140에도 파생 트리거 때문에 격리 논리 6. 실제 D1 rows_written는 인덱스 변경까지 청구하므로 반드시 따로 측정해야 함. 기존 트리거·인덱스를 유지하고 SQL batch로 묶는 접근은 W2 후보에서 제외.

변경: 기존 134 fixture에 원인 6+069 2 출력 추가. 기존 READ-ONLY release-system audit에 Python 132/133/134와 shared live D1 관련 sqlite_schema SELECT만 추가. 이를 실제 run 결과로 확인할 때까지 LIVE_SCHEMA / TypeScript / Build / 비용 PASS 주장 금지. 공유 DB 실제 사용자 행 SELECT/변환/삭제 금지.

**우선 구현 방향:** 원본 D1 likes 1관계 변경만 각 좋아요/해제 hot path에 남기는 모델을 격리 D1에서 검증하고, track_stats/인기 랭킹/파생 Feed/프로필 상태를 별도의 영속 작은 집계와 R2 부분 갱신으로 옮긴다. 원본 likes PK/기존 추가 인덱스의 실제 D1 청구가 W1~W2인지 확인 후 적합한 키 구조 결정. 원본 DB stats를 비워두거나 stale 시켜놓고 기존 reader를 계속 쓰게 하는 방식 금지. shared 세 환경의 기존 reader 및 모든 writer 호환 컷오버, 같은 곡 다른 사용자 동시성, 최종 canonical 후 게시, 2천 개인 snapshot 확장 및 DO/R2 전체 비용 모두 통과해야 함. 격리 D1 생성/새 DO 바인딩/공유 migration/Worker 승격 전에 필요한 영향·비용·복구방안을 보고하고 사용자 승인에 따를 것.

## 0CE 앱127의 안정적인 operationId 전송 준비 (2026-09-21 KST)

`src/services/exploreLikeService.ts`는 신규 클릭마다 `crypto.randomUUID()`를 1회 생성하고 outbox에 저장, 재시도에서는 동일 `operationId` 전송. 과거 캐시에는 최초 flush 전 1회 생성·저장. `scripts/verify-127-atomic-personal-like.mjs`에 persist-before-send, 신규 클릭별 다른 ID, legacy 보정 테스트 추가. 실제 GitHub 소스 연결 정적 가드 PASS, 전체 CI 결과는 아직 미확인. 현행 071 Worker는 ID 필드 무시 → 실제 멱등성은 139/143 server owner 라우팅 및 baseRevision 연동까지 FAIL. `DOCS/CURRENT_RELEASE_STATE.md` 0CE 참조.

**후속 작업 순서 유지:** 우선 0CD 143의 **공통 UID owner**를 실제 인증 경로/각 환경과 연결하는 컷오버 계획; 141의 2천 좋아요 제한에 대한 데이터 무손실 확장/복구; 140의 trigger/index 운영 D1 W1~W2 계량·파생 캐시 대체; 그 다음 127의 server-issued baseRevision 계약/최종 settle·RTDB. 전 과정에서 TEST/PRODUCTION 기존 writer가 공유 데이터 우회해서 덮어쓰지 못하게 해야 함. 사용자 원본 migration이나 불가역 조치는 명시적 승인 없이는 실행 금지. 전체 TS/Build/테스트/Work/PC↔모바일/실주소 검증 전 preview 후보 배포 금지.

## 최신 0CD — 128곡 순서 기록 제한을 전역 seq로 대체, 배포 전 CI 통합 (2026-09-21 KST)

`preview`에 실제 변경: 139의 pending·141 공유 R2에 **UID 전역 단조 seq**를 연결하고, R2의 매곡 `lastLikeRevisions141` 누적/128 제한을 없애고 마지막 `lastPublishedSeq141`만 저장한다. `createLikeDurableOwner143`는 한 UID DO 인스턴스당 호출 직렬화·영속 `storage.transaction` seq 발급·UID 검증 모델. 기존 135 실행형 회귀에 256곡 순차 발행/늦은 seq/동시 세 곡/재시작/다른 UID 차단 추가, 실제 GitHub 소스 격리 실행 PASS. READ-ONLY `soridraw-release-system-audit.yml`에 기존 127, 전체 135, 071 복사본에 072/073/074 적용 후 128 실행형 회귀를 추가했다. CI 실제 Run과 TypeScript/Build 결과 확인 전 PASS 주장 금지. 0CD 참고.

**다음 단일 완성 작업은 클라우드 실환경 통합과 비용:**
1. **실제 공유 UID owner/인증 라우팅**: PREVIEW/TEST/PRODUCTION에서 서비스 바인딩으로 동일 DO 네임스페이스를 참조하고 `requireExploreAuth` 이후에만 내부 요청. 기존 `handleLikeBatch034`, 단일 `handleLike`, 069/066/075/035 큐와 구형 Worker 우회 시나리오를 모두 차단할 점진 전환 계획. 구형 프로덕션 변경이 필요하면 배포 전 영향·승인 절차 별도로 준수.
2. **기존 2천 likedTrackIds 한도**: 061 writer가 `slice(0, 2000)`, 141은 fail-closed. 전체 기록을 유지하는 확장 구조(페이지/분할, 데이터 손실 없이 읽기·복구)와 이전 앱 하위호환 검증, 개인 캐시가 임의로 영구 pending에 갇히지 않도록.
3. **D1 실제 rows_written W1~W2**: 운영 derived trigger/인덱스 소스 보존하면서 독립 D1 테스트 및 대체 파생 캐시 설계. 140 단순 관계+stats 2행은 운영 trigger 포함 6 논리행 모형과 불일치; 현상태 W3+ 릴리스 FAIL 유지. 원본 데이터 변환·트리거 변경은 명시적 승인 없이 실행 금지.
4. 최종 고정 SHA 전체 127/128/135 및 기존 회귀, TS/Build, 실제 Cloudflare Worker·Firebase/RTDB 결합, PC↔모바일 실사용, Work 독립 감사 완료 전 PREVIEW 배포 금지. 새 production 릴리스는 별도 명확한 승인 후.

## 최신 0CC — 141 post-D1 공유 R2 publisher·142 결합검사 구현 (2026-09-21 KST)

사용자 "하나씩이라도 집중해 해결" 지시. `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 `createLikeSharedR2Publisher141` 추가. 139의 검증된 D1 확정 이후에만 공유 `shared-social-v114/likes/<UID>.json` ETag CAS 갱신, 곡별 `lastLikeRevisions141` 기록, 기존 likedTrackIds/074 필드 보존. 기존 `scripts/verify-135-like-fenced-protocol.mjs`에 141 단독 및 139→141 결합 142 mock 회귀 추가. 실제 GitHub 소스 V8 격리 실행 PASS: 동시 CAS, 오래된 좋아요 역전 방지, 동일 ID 중복 no-op, 알림 실패 후 재시도, D1 실패 전 캐시 변경 0, 2천/128 실패 시 덮어쓰기 0. 모든 PASS는 가짜 공유 R2·D1·통지 모델이며 실제 배포/Cloudflare 비용 실측이 아님. `DOCS/CURRENT_RELEASE_STATE.md` 0CC 참조.

**다음 집중 작업:** (1) 영속 데이터/기존 R2와 공존하면서 2천 곡·128 revision 한도를 안전하게 복구하는 개인 좋아요 분할/동기화 구조, (2) 세 Worker 모두 무조건 개인 R2 갱신을 중단하고 단일 공유 인증 UID owner를 거치는 호환성 전환 경로, (3) 실제 인증 RTDB 신호, Cloudflare D1 실제 `rows_written` 및 trigger/index W1~W2 증명. 139/140/141은 여전히 사용자 요청 처리·실서비스에 연결되지 않았으며 단순 patch/guard PASS를 제품 완료로 간주 금지. 새 데이터 스키마/migration/PRODUCTION·실데이터 수정 전 필요한 승인·복구 수단 보고. 138 pending-only Worker도 finalizer/모든 환경 전환 전에는 배포 금지. 마무리 시 기존 127·128·135 전체 및 TS/Build/Work/PC↔모바일 실검증.

## 0CB 최신 구현 — 140 D1 원자 어댑터, 트리거 비용 선행 FAIL (2026-09-21 KST)

사용자의 조속한 배포 요청 이후 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 `createLikeD1Canonical140` 실제 D1 prepared `batch` 연결부 추가. 실행 순서: 기존 곡/공개프로필/통계 존재 검사 → 원하는 좋아요 관계 하나만 INSERT/DELETE → 직전 relation `changes()=1`인 경우에만 track_stats ±1 → 최종 UID/곡 관계 확인. 불일치 fail-closed, 최종 D1 commit 전 개인 캐시 게시 없음. `scripts/verify-135-like-fenced-protocol.mjs`의 기존 모의 테스트에 D1 shaped mock 실제 어댑터 검사 추가 및 PASS. 독립 sqlite3 단순 2/0/2/0, derived trigger 모형 좋아요/해제 각각 논리 6행, **Cloudflare 청구 rows_written 미검증, W1~W2 릴리스 FAIL**. 현행 069 queue와 구형 writer에 139/140을 연결하거나 실제 DB에 쓰는 단계 아님.

### 가장 짧은 실제 완성 경로 — 반드시 검증된 한 묶음으로
1. 현재 라이브 공유 D1 schema/trigger/index와 세 Worker 버전을 **SELECT/read-only로** 확인. 별도 격리 D1 + 제한 테스트 계정에서 현행 trigger/index 포함 `meta.rows_written` 실측, 각 사용 행동 W1~W2를 만족하는 파생 cache 구조를 선택(인덱스/검색/추천/인기/공개프로필 보호). 숫자를 맞추려고 부작용만 감추거나 비용 gate를 완화하지 않는다.
2. 단일 사용자·곡 owner에서 기존 전체 writer를 통합하는 하위호환 전환 설계와 실제 요청 경로 구현. 069/066/035/075/직접 likes, 각 환경 Worker, 기존 shared R2의 unconditional writer 우회 전부 처리. 추가 인프라 또는 비호환 데이터 변경이 불가피하면 관련 비용·롤백과 실사용 데이터 영향을 보고해 명시적 승인 후 적용. **현재 139/140 코어가 개별 Worker에 자동으로 적용됐다고 오해하지 말 것.**
3. 실제 D1 확정 후 공유 개인 R2 conditional CAS, UID 신호, 타 기기 자동 수렴, 오래된 요청/네트워크 응답/앱127 outbox 결합. 138 pending-only Worker를 finalizer 없이 먼저 배포 금지.
4. 고정 commit에서 전체 TS/Build/기존 좋아요·공개/비공개 회귀·W1~W2·PC/모바일 실사용·독립 Work 감사·실주소 PREVIEW 검증. 하나라도 불합격이면 PREVIEW 승격 중단. main/production 사용자 승인 없이 수정/배포 금지.

## 현재 실행 기준 0CA/139 — 서버 후보 코어 구현·검증 완료, 통합/비용 미해결 (2026-09-21 KST)

이번 대화에서 실제 `preview` 코드 변경: `cloudflare/explore-worker/patches/074-personal-like-r2-cas.mjs`를 D1 접수 단계 **개인 R2 선행 갱신 금지/pending-only**로 수정(138). 기존 `scripts/verify-128-like-concurrency.mjs`를 이 계약으로 변경; 실제 071 Worker blob + 073→074 생성 후 전체 128 격리 mock PASS, 고정 TEST/PRODUCTION Worker 소스에 동일 패치가 **적용 가능함만** 확인(실행/배포하지 않음).

또 `cloudflare/explore-worker/runtime/like-fenced-139.mjs` 신규: **영속 pending → 원자 D1 확정 증명 → UID/곡 revision·operation ID 확정 → monotonic 공유 캐시 게시 성공 이후에만 settled**하는 실제 JS 코어. 중복 ID 동일 payload는 W0 모델로 처리, 동일 ID를 다른 desired/base로 재사용하면 conflict, 과거 revision은 stale, D1 전·후 실패/재시작과 R2 실패 시 pending 보존 및 새 주문 차단. `scripts/verify-135-like-fenced-protocol.mjs`에 기존 모형 외 실제 139 모듈 import 실행형 모의검사 추가. GitHub 실제 소스 재조회 V8 격리 검증 PASS. 단, 코어는 아직 실제 Worker/Auth/DO/D1/R2에 연결되지 않았으며 real D1 billed rows / 실제 운영 보장은 미검증. `DOCS/CURRENT_RELEASE_STATE.md` 0BZ/0CA 참조.

### 다음 실제 구현의 선행 확인 및 차단조건
1. **UID별 영속 단일 소유자**를 3환경의 기존 모든 좋아요 writer가 공통 사용하도록 하위호환 전환 계획 마련. 현재 환경별 DO scheduler 103은 단일 공유 owner가 아니며 071/구형 Worker가 우회할 수 있음. 추가 인프라/구형 Worker 변경이 필요하면 정확한 서비스 비용·보안·롤백 방법을 보고하고 승인 후 구성.
2. `canonical.applyAtomically`를 기존 공유 D1 원본 likes+count의 실제 **동일 원자 commit**으로 구현하고 재시도 후 통계 중복 증감 0, 데이터 소실/카운트 어긋남 0 검증. `publish`는 실제 D1 완료 후 UID shared R2 revision CAS 및 다른 기기 통지로 구현. `settled`를 queue ACK 또는 R2 updated로 대체 금지.
3. 운영 D1 schema/trigger/index read-only 대조 → **격리 D1** 실 `meta.rows_written` 좋아요/해제 W1~W2, 중복 W0, 변경 없음 R0, R2/DO/RTDB 10만 사용자 단위 비용 확인. 현재 069 W4+·derived trigger 6 논리 행 모형이므로 기존 경로 사용한 채 PASS 금지. 하위호환·검색/추천/인기/프로필의 파생 인덱스 비용을 재설계해야 함.
4. 실제 Work 독립 감사, TS/Build/127·128·135·과거 회귀, PC↔모바일 본계정/제한 테스트계정 데이터 일치, 기존 좋아요 2천/128 보호 확인. 미확인 시 릴리스 FAIL. 사용자 승인 전 배포/사용자 원본 schema 변경/PRODUCTION 승격 금지.

## 최종 우선순위 0BY — 구형 공유 Writer와 기존 D1 트리거 때문에 신규 Worker 단독 승격 불가

사용자 "수정해봐"에 따라 선행 호환성을 확인한 결과, `DOCS/CURRENT_RELEASE_STATE.md` 0BY. PREVIEW/TEST/PRODUCTION의 구형 Worker가 같은 원본 D1·공유 개인 R2를 쓰며 새 영속 UID/곡 fence를 우회한다. 기존 069 큐의 W4+ 및 derived trigger/index의 W3+ 문제도 남아 있으므로 새 preview Worker만 교체해 좋아요 문제 완치·W1~W2 완료라고 보고할 수 없다.

**코드 구현의 고정 합격선:** isolated test 계정/격리 D1에서 안정적 operation ID·영속 최신 순서·처리 후 중복 retry W0·likes+count 원자성·D1 final 이후에만 R2/remote confirmed·모든 환경 legacy writer 공존 대응·실 D1 `rows_written` W1~W2·변경 없음 read0. 구형과 신형이 동시 사용 시 안전하지 않은 migration/Worker 변경은 구현 전에 먼저 보고하고 승인 필요. 사용자 원본을 대량 복제·삭제/변환하지 않는다. 구조 검증 전 허위 `settled` 활성화와 제품 배포 금지. 현재 source-only 클라이언트127 후보와 Worker071 배포 유지. 전체 CI 및 PC·모바일 실사용 미검증.

## 2026-09-21 최신 수정 0BX — 불일치 ACK 차단, 서버 해결 우선

`preview` 기존 앱127 후보 `src/services/exploreLikeService.ts`: 이번 batch에서 **실제 전송한 trackId→desiredLiked**와 intake 응답 result→liked가 서로 다르면 cache/outbox/snapshotPending 업데이트 이전에 실패시키고 로컬 마지막 의도를 보존. `scripts/verify-127-atomic-personal-like.mjs`에 기대값 불일치·보존순서 검사 추가. 실제 수정 service 구문 및 순수 판단 확인 PASS, full CI/TS/Build 미검증. `DOCS/CURRENT_RELEASE_STATE.md` 0BX 참조. 이는 **queue ACK 검증일 뿐 D1 final settlement이 아님**.

**다음 작업은 서버를 완성하는 단일 작업으로 묶을 것:** 069의 `batchAt`가 매 접수 서버 시각에 의해 재생성되는 문제, 처리 후 큐 DELETE로 멱등 기록이 소실되는 문제, 다른 기기와 다른 Worker의 역순 R2 overwrite, D1 derived trigger/index의 W3+를 같은 플랜에서 다룬다. 서버가 영속 ordering과 canonical 확정 검증을 제공하기 전 client pending 제거·원격 confirmed 발송·자동 blind retry 금지. 이전 0BW 최종 클릭 보존과 0BT 늦은 캐시 보호의 회귀를 함께 검증. 격리 D1 실 billing, 전체 TS/Build/회귀, PC·모바일 실사용, Work 감사 전에는 preview 배포 금지. 배포/실사용 데이터 수정/새 인프라 생성은 사용자 별도 승인 전 불가.

## 최신 기준 — 2026-09-21 KST: 인플라이트 좋아요→해제 최종 의도 유실 수정 (0BW)

실제 클라이언트 재현 조건을 발견하고 `src/services/exploreLikeService.ts`의 `flushPendingLikes`에서 오래된 요청 ACK/모호한 네트워크 실패 이후 **그동안 발생한 최신 클릭을 재기준화**. 예: base=false → 첫 true 전송 → 동일 곡 최신 false는 처음에는 false/false로 보이지만, 첫 true가 접수된 뒤에는 true/false가 되어 반드시 서버에 전달되어야 한다. 기존 코드는 false/false를 no-op으로 삭제하여 최종 하트를 잃을 수 있었음. 신규 `rebaseExploreLikeAfterInFlight127` 및 기존 `scripts/verify-127-atomic-personal-like.mjs` 회귀 추가. 실제 GitHub 수정 helper 격리 실행 PASS, full CI/TypeScript/Build/PC·모바일 미검증. `DOCS/CURRENT_RELEASE_STATE.md` 0BW 참조.

**중요:** 클라이언트 재기준화는 최종 서버 수렴 완료가 아님. 앞선 요청의 D1 069 중복·순서 영속성과 구형 Worker R2 호환 문제, 실제 W1~W2 비용은 아직 FAIL. 오프라인·불명확 ACK에서 자동 재전송을 단순 반복하는 것은 069의 매번 새로운 batch ID 때문에 중복 쓰기/역순 위험. 안정적 operation ID 및 최종 확정 증명 전 무한 재시도 도입 금지.

### 다음 구현·검증 범위
1. 지금 고정된 preview의 기존 127/126/125/124/123/110, 128~136 회귀, TypeScript/Build, Worker071 canonical 해시 점검. 저장 후 실 CI 결과가 없으면 PASS 보고 금지.
2. **서버 069 중복·순서 구조부터 해결**: 요청 고유 ID의 영속 dedupe, 이미 처리 완료된 과거 주문 차단, 큐 전체/구형 writer 공존, 실제 D1 최종 저장 후 개인 R2 CAS, 검증된 settled, PC·모바일 자동 수렴. 127의 최신 로컬 outbox 의도는 오직 정식 서버 확정 뒤에만 해제.
3. 라이브 D1 read-only schema/trigger/index 확인 후 격리 D1 W1~W2/정상 재진입 R0와 R2/RTDB/100k 사용자 비용 검증. 기존 Trigger로 6+ 논리 변경 가능성 미해결이면 코드를 더 얹지 말고 파생 비용 구조를 함께 바꿔야 함.
4. 사용자의 배포 요청 전까지 PREVIEW/TEST/PRODUCTION Hosting/Worker/Functions/D1/R2/실사용 데이터 변경 금지. 최종 Work 독립 감사, 실기기 결과 확인 전 릴리스 FAIL 유지.

## 최신 기준 — 2026-09-21 KST: 좋아요 predeploy STOP 사유 고정 — 069 재전송 ID 불안정 + 영구 중복 기록 부재

사용자 "배포 전단계까지 한 흐름으로" 요청에 대해, 기존 리드온리 `soridraw-release-system-audit.yml` 실행 요청 commit `f951e797b8b0210042cd7bc39168d449c2b06e7d`를 생성했다. 실행/완료 결과는 연결된 GitHub에서 조회 불가하므로 **TypeScript/Build/Worker/D1 preflight 미확인**. 특히 이 워크플로는 127 회귀 테스트를 실행하지 않으므로 성공으로 보여도 좋아요 최종 합격이 아니다.

Worker071 canonical SHA `9e0048ac0d2e3540707930786d531b9bca3bccb7`의 `exploreLikeW1Batch040`: `batchAt = Math.max(fallbackAt, ...canonical.mutationAt)`이고 `fallbackAt`는 매 HTTP 접수 시 **서버 현재 시각**. 동일 client mutation을 다시 요청하면 시각이 달라져 **새 069 batch ID**가 생성될 수 있다. `processExploreLikeAggregateWave035`가 처리된 069 행 DELETE; 과거 처리가 완료된 뒤에는 같은 ID라도 중복 증명이 사라진다. 기존 `scripts/verify-132-like-d1-write-budget.py`에 136 소스 가드·동일 action 재시도 counterexample 추가. 정량 W4 모형 외에 **중복 접수/역순 구조 FAIL**도 최종 릴리스 차단 조건으로 유지.

### 하나의 완성 작업으로 수행할 범위 (Codex/독립 Work)

1. preview 최신 SHA 고정, read-only audit 실제 Run ID·step 결과를 확인한다. TS/Build/관련 127·126·125·124·123·110와 128~136 테스트, Worker071 hash guard를 실행. static PASS를 실운영 PASS로 오인 금지. 검사 결과 미확인 시 배포 차단.
2. 좋아요의 단일 원본 확정 순서: 안정된 operation ID·UID+곡 revision·관계와 공용 count의 동일 원자 commit·중복 및 out-of-order 영구 방어가 가능해야 한다. 기존 069/075/035/066 처리와 구형 TEST/PRODUCTION Writer가 우회하지 않는 전체 릴리스 계획을 제시하고 **가장 오래된 완료된 요청도 새 좋아요/해제를 재반전시키지 않음**을 검사.
3. 공유 D1 실제 SQL 트리거·인덱스 SELECT/read-only 확인 후 별도 격리 D1로 행동별 billed `rows_written` W1~W2, 중복 W0, 읽기 R0 측정. 0BS에서 최초 좋아요/해제 격리 논리 6변경(실 청구 제외) 재현된 상태이므로 단순 2개 원본 SQL로 배포 가능 판정 불가. 비용을 충족하지 못하면 구조 재설계까지 같은 작업 범위이며 임시 게이트 완화 금지.
4. 최종 D1 확정 이후에만 각 곡 개인 shared R2 및 원격 신호를 게시. 개인 pending이 영구 유지되지 않고 2,000/128/오프라인/재시도/구형 캐시에서도 자동 수렴하도록 제한 테스트 계정/실기기 검증. 잘못된 `settled` 금지.
5. Cloudflare/Functions/Firebase/Rules 신규 배포, 사용자 원본 수정·migration·모든 환경 승격은 별도 명시 승인 전 실행하지 않는다. 비호환 구조나 W3+ 발견 시 **STOP/FAIL 보고**하고 테스트용 가짜 PASS 만들지 않는다.

## 최신 기준 — 2026-09-21 KST: 127 클라이언트 낙관적 상태·늦은 캐시 덮어쓰기 방지 후보 반영 / 배포 차단

`DOCS/CURRENT_RELEASE_STATE.md` 0BT. 현재 `preview`에 `src/services/exploreLikeService.ts`, `src/pages/ExplorePage.tsx`, `scripts/verify-127-atomic-personal-like.mjs` 국소 수정. 반영: 신규 클릭은 로컬 즉시 저장/화면 반영; 늦은 개인 조회 응답은 **응답 직후 UID별 outbox·미확정 상태를 다시 읽고 보호된 곡을 덮어쓰지 않음**; 원격 알림은 표시 시점 현재 membership과 맞을 때만 반영; 최초처럼 오래된 hydrate 결과도 현재 곡 유효 상태 우선; 같은 ms 연속 클릭에 단조 증가하는 `updatedAt`으로 오래된 ACK 구분. 30초 묶음과 기존 공개 숫자/사용자 데이터 구조 그대로. 소규모 소스/순수 로직 점검 PASS, 타입/빌드/전체 CI/실기기 **미검증**. 앱126/Worker071 실제 배포 유지. 이 클라이언트 수정만으로 069 W4·trigger 증폭·구형 공유 Writer·최종 canonical 자동 수렴 FAIL은 해결되지 않음.

### 다음 작업
1. 기준 commit 고정 후 `verify-127-atomic-personal-like.mjs` 및 126/125/124/123/110, TypeScript, Build 전체 실행. 코드가 다른 과거 회귀 검사를 깨면 배포하지 않고 해당 assertion의 실제 계약을 좁혀 검토. 사용자 원본·Firebase·Cloudflare 실서비스 접근 없이 테스트.
2. 동시에 클릭/늦은 API/늦은 RTDB/느린 baseline/30초 flush ACK 교차 테스트에서 개인 하트가 로컬 최종 의도 우선인지 확인. 공개 숫자는 원본 canonical과 분리한다. 허위 `settled` 발행 금지.
3. 이전 0BS·0BR·0BQ 지시 유지: 실제 원본 D1 W1~W2와 파생 trigger/index 비용 재설계, 구형 Writer 병존 순서, R2/RTDB 비용 실측 없이는 Worker078 또는 앱127 배포하지 않음. 독립 Work 검증 후 명시적 사용자 PREVIEW 승인 필요.
4. 업데이트/재진입 변경 없음 원본 read 0, 기존 좋아요 2천/128 보존, PC↔모바일 좋아요/해제·검색/추천/최신/인기/프로필 화면 일치가 최종 합격선. TEST/PRODUCTION 무단 승격 금지.

## 최종 기준 — 2026-09-21 KST: 134 비용 증폭·135 순서 모형 확인, 제품 릴리스 여전히 FAIL

`DOCS/CURRENT_RELEASE_STATE.md` 0BS 및 `DOCS/LIKE_WRITE_REDESIGN_133.md` 134 정정 참조.

- **비용:** 133의 원본 2행 SQLite 모델은 실제 운영 D1 비용 PASS가 아니다. 실 스키마 소스 `explore032_stats_update` → `explore032_derived_track_update`(seq/Feed journal/profile journal)와 인기 인덱스 확인. `scripts/verify-134-like-write-amplification.py` 보수적 *격리* 모델은 한 곡 최초 좋아요/해제 6 논리 행 변경(인덱스 추가 요금 제외), 동일 상태 반복 0. 외부 live `meta.rows_written` 미측정. 로컬 테스트에서 소스 가드는 GitHub에서 검토한 문자열의 별도 fixture로 검사되었으므로 실제 파일 연동 검사는 CI에서 다시 실행할 것.
- **동시성:** `scripts/verify-135-like-fenced-protocol.mjs`의 격리 모의는 사용자별 곡 revision + 요청 ID + 영속 pending 우선 복구 + D1 관계 조건부 변경으로 재시도·늦은 요청·모의 런타임 재시작을 PASS. 실 Durable Object를 만든 것이 아니며 두 시스템 간 원자성/운영비/실기기 결과는 미검증. 구형 shared writer가 우회하면 모델도 FAIL함을 명시.
- 071 canonical 및 app126 배포 상태 미변경, 127/072~077 미배포, 사용자 원본 변경 없음. TypeScript/Build/전체 CI/독립 Work/Cloudflare 실 D1 비용/PC↔모바일 미검증. **133 W2 격리 PASS를 배포 승인 근거로 사용 금지.**

### 다음 Codex High 목표 — 실제 수정 전 반드시 좁은 범위 비용 검증

1. read-only로 현재 **실제 공유 D1**의 likes/track_stats/derived/관련 인덱스/trigger SQL 목록과 환경별 Worker 버전을 대조(기존 사용자 데이터 SELECT/변경 금지). live trigger가 소스와 다르면 실제 live 우선.
2. **별도 격리 D1**에서 133의 `batch()`·`changes()` 동작과 `meta.rows_written/read`, trigger/index 실제 비용을 좋아요/해제/중복/오류 롤백 각각 확인. 사용자 실데이터로 테스트하지 말 것. D1 W1~W2가 현재 trigger 유지 조건에서 불가능하면 빠르게 FAIL 보고하고 파생 업데이트 비용 구조 설계부터 진행.
3. 135 사용자별 영속 순서 모델을 실 Cloudflare DO로 구현하기 전에 보존 기록/처리 중 실패/중복/오프라인·구형 Writer/2000 ID/128 토큰·10만 사용자 요금 비교. DO↔D1 한 트랜잭션이라고 가정 금지. 구형 Writer 전부 같은 순서/확정 규칙이 되기 전 PREVIEW 배포 금지.
4. Explore 추천/최신/인기/프로필 재방문 원본 D1 read 0·공개 숫자/개인 하트 일치·계정별 원본 하위호환 유지. 직접 R2 덮어쓰기/전체 feed 재생성/파괴적 migration/자동 복구 허위 `settled` 금지.
5. 앱/Worker와 모든 환경의 전체 릴리스 경로를 분리 검증. 코드 수정은 preview만; 최초 실 PREVIEW 배포는 사용자 별도 승인. TEST/PRODUCTION은 각각 명시 승인; 미검증 상태에서는 배포/원본 데이터 수정 없음.

## 최종 기준 — 2026-09-21 KST: 133 글로벌 조사·W2 격리모형 PASS / 실제 동시성·릴리스 FAIL

최신 `DOCS/CURRENT_RELEASE_STATE.md` 0BR 및 `DOCS/LIKE_WRITE_REDESIGN_133.md`. `scripts/verify-133-like-direct-two-row.py` 격리 SQLite: 직접 두 행 모델의 신규 좋아요·해제 2행, 같은 상태 retry 0행, 타인 좋아요 보호 PASS. 다만 별개 오래된 주문이 나중에 도착하면 최종값 반전 재현: **순서 영속 기록 없는 직접 D1 W2 모델은 제품 적용 금지**. 이 작업은 preview 문서/모형만 반영; 실제 PREVIEW 앱126/Worker071, 앱127+Worker072~077 미배포. 기존 069 W4 비용 FAIL·개인 하트 자동 수렴 FAIL 유지.

### 다음 Codex High 작업 (무단 Worker 변경·배포 금지)

1. 소규모 **격리 D1 전용 테스트** 설계: 동일 `batch()` 내 직전 SQL `changes()`, 실제 `meta.rows_written/rows_read`, 재시도 no-op, rollback/잘못된 track_stats를 시험. 실서비스 데이터·설정 건드리지 말 것.
2. 두 후보를 정량 비교: 직접 D1 두 행 + 사용자별 Durable Object 영속 순서/재시도 vs D1 밖의 Queue. DO/Queue/R2/RTDB 비용, 10만 명 변경, 재방문 0읽기, 네트워크 성공·실패 중간 상태 복구 모델을 함께 검증. DO↔D1 교차 시스템 원자성이 자동 보장된다고 가정하지 말 것.
3. 기존 069 큐와 모든 환경 구형 공유 R2 writer가 병존할 때 과거 요청이 신형 기록을 덮는지 및 선행 호환 승격 순서를 검토. 구형 `likes` 존재 판정에 0상태 tombstone을 넣지 말 것.
4. 변경 없음 R0, 행동당 D1 W1~W2, 중복 재시도 W0, PC↔모바일 최종 주문, cold/2000/128 무손실, 실패 즉시 local pending, 최종 D1 이후에만 `settled`를 합격선으로 제시. 실패 항목이 있으면 구현·승격 차단.
5. 실제 구현 구조가 확정되기 전 Worker078 생성/앱127 활성화/새 인프라 생성·비용 청구/파괴적 migration 금지. 구현은 preview에서만, 사용자 프리뷰배포 요청 전 배포 없음. 본 단계 TypeScript/Build/전체 CI/PC·모바일/Work 감사 미실시.

## 최종 기준 — 2026-09-21 KST: 신규 132 비용 감사에서 단일 좋아요/해제 069 W4 재현 — **릴리스 차단**

최신 `DOCS/CURRENT_RELEASE_STATE.md` 0BQ. 기준 `preview`에 `scripts/verify-132-like-d1-write-budget.py` 추가. Run `35538319528` SUCCESS는 격리 코드/SQLite 비용 위반 검출 성공이지 제품 비용 PASS가 아님. 실제 live D1 계량은 **미실시**. PREVIEW 라이브 앱126/Worker071 유지, 앱127 및 Worker072~077 전부 미배포, 사용자 원본/TEST/PRODUCTION 비변경.

### 구조적으로 확인된 비용

- 069 batch 신규 접수 INSERT 1행 + aggregate `track_stats` 갱신 1행 + `likes` 관계 INSERT/DELETE 1행 + 처리 큐 DELETE 1행 = 단일 행동 4행 변경. 좋아요와 해제 모두 같은 격리 모형 4. D1 `env.DB.batch` 명령 1회는 rows_written 1이 아님. 인덱스/트리거/운영 중 동시 배치 비용은 여기 포함하지 않음.
- 프로젝트 하드 게이트 **사용자 변경 1회 D1 W1~W2**에 구조상 위배. 앱127 하트 일치만 완성해도 PREVIEW→TEST/PRODUCTION 승격 **FAIL**. 새 동기화 패치만 추가해서 이 비용이 줄어들지 않음.

### 다음 작업 (Codex High 설계 → 소규모 격리검증 → 판단; 무단 배포 금지)

1. 안전한 좋아요 저장의 필수조건을 정리: (a) **D1 두 행 이하** (b) 관계와 공개 숫자의 동일 트랜잭션 정합성 (c) PC·모바일 반대 요청의 서버 적용 순서 (d) HTTP 재시도와 중복 요청의 무해성 (e) 오프라인 복귀 후 최종 1회 저장 (f) 구형 Worker 공유 R2 공존·하위 호환 (g) 실패 시 기존 사용자 기록 보호.
2. 기존 D1 069 큐를 계속 쓴 채 W1~W2로 위장하지 말 것. 큐 없는 직접 원본 변경은 `likes`/ `track_stats` 2행을 목표로 할 수 있지만, 반대 요청 재전송/순서와 좋아요 해제 후 과거 주문 증명(삭제 후 tombstone 없음)을 별도로 해결해야 한다. 영구 주문 기록이나 외부 큐가 추가되면 추가 D1 write·R2/Queue 요금·장애 복구를 정량 비교. 기존 TEST/PRODUCTION이 삭제된 `likes` 행만 보고 개인 소유를 판정하므로 거짓 tombstone을 여기에 추가하면 하위 호환 깨짐 — 금지.
3. 외부 인프라 신규 도입·대량 migration·사용자 데이터 구조의 파괴적 의미 변경 금지. 최소 2개 대안의 쓰기/읽기/100k 유저 비용·경합 시뮬레이션을 비교한 후 구조 채택. 확정 전 새 Worker078을 만들거나 클라이언트 `settled`을 허위 활성화하지 말 것.
4. 승인된 구조가 나오면 `preview`에서 격리 실행형 테스트 먼저. 라이브 D1 W1~W2·변경 없는 페이지 재방문 R0·R2/RTDB 사용량은 제한 테스트 계정으로만 검증; 원본 사용자 데이터 무단 변경 없음. Work 독립 감사 이후 사용자 별도 프리뷰배포 승인 전 배포 금지.

## 최종 기준 — 2026-09-20 KST: 앱127 R2 updated≠D1 settled 분리 / RTDB 확정 신호 금지

현재 구체 상태: `DOCS/CURRENT_RELEASE_STATE.md` 0BP. 실제 PREVIEW 앱126 + Worker071, 후보 앱127/Worker072~077 미배포, main/production 비변경.

- 127 `canBroadcastExploreLikeSnapshot127('updated')=false`: 074 개인 R2 CAS 성공은 batch 접수 이후 **canonical D1 좋아요 최종 반영 완료 증거가 아니므로** PC/모바일 confirmed RTDB 신호를 발송하지 않는다. 원본 완료가 불명확한 경우 사용자 최종 로컬 의도를 영속 pending으로 보호. 예약 `'settled'`는 앞으로 별도의 검증된 최종 증명 경로가 만들어지기 전까지 Worker에서 절대 발행하지 말 것.
- Run `35518647451` SUCCESS: 127/126/125/124/123/110, 128~131, TypeScript/Build 및 Worker071 SHA 보호. 임시 Workflow 164 정리. 실제 데이터 쓰기/배포 0.
- **아직 전체 사용자 동기화 FAIL:** 상태 확정 전 기존 하트를 잘못 전파하지는 않으나 다른 기기까지 실제 최종값이 수렴하는 자동 복구가 없다. 074 R2 pre-aggregate, 069/075 순서·구형 writer, 075~077 예외조회 큐 확인·기아, 2000/128/cold, W1~W2·10만 사용자 비용 모두 미해결.

### 다음 작업
1. 069/075 `likes` 최종 commit의 사용자별/대상곡 확정 신호를 **새 D1 write 없이** 신뢰성 있게 얻을 수 있는지 설계하고 반례(큐 ACK 후 최종값 역전, 구형 writer, 늦은 응답)를 실행형 모의검사. 원본 보장 불가능하면 FAIL 보고, 임의로 `settled` 열지 말 것.
2. 사용자가 변경한 곡만 canonical 확인·개인 shared R2에 최소·조건부 복구할 수 있는 경우 비용 검증; 앱 기존 30초 묶음·Explore 캐시·공개 수치 보호. 추가 DB W3+ 또는 전역 큐/Feed scan이면 중단.
3. 구형 TEST/PRODUCTION Writer 호환 선행 승격 및 사용자 승인 요건을 분리 보고. 실제 테스트 계정 PC/모바일, 오프라인 및 10만 명 R2/RTDB 비용·Work 독립 감사 전 릴리스 허가 금지.
4. 앱127/Worker 후보 `preview` 개발만 진행. 사용자 `프리뷰배포` 승인 전 배포 금지, `테스트배포`/`정식배포` 승인 전 다음 환경 비변경.

## 최종 기준 — 2026-09-20 KST: 074 늦은 ACK의 잘못된 확정 차단 PASS / 자동 수렴 미완료

상세는 `DOCS/CURRENT_RELEASE_STATE.md` 0BO. 실제 PREVIEW 앱126 + Worker071 유지; 후보 앱127/Worker072~077 미배포, main/production 비변경.

- `074`가 더 최근 UID+곡 주문을 이미 반영한 상태에서 오래된 batch 응답이 도착하면 `superseded_like_batch` (`ok:false`)으로 확정 알림 차단. 다른 새 곡과 섞인 경우 새 곡만 CAS 저장하고 `partially_superseded_like_batch`로 전체 확정 보류. 동일 token/same state 재전송만 정상 unchanged. 기존 큐 접수 및 D1 W count 미수정.
- `verify-128-like-concurrency.mjs` 신규 역순+혼합 batch 실행형 mock. Run `35518204038` SUCCESS: 071 고정 복사본+072~077, 128~131/127~110 회귀, TypeScript/Build. 임시 163 workflow 정리. 원본 사용자 데이터와 배포 비변경.
- **아직 FAIL:** 혼합 batch의 별도 곡 포함 불확정 pending은 최종 D1 증명 없이는 해제되지 않음. 074 R2는 ACK 이후, D1 canonical 확정 전에 갱신됨. 구형 Worker가 공유 R2의 CAS 메타데이터를 지울 수 있음. cold/2000/128 한도 자동 복구, 069/075 최종 순서, 10만 명 비용, D1 W1~W2/실제 PC·모바일 검증은 남음.

### 다음 수행 기준
1. 069/075 worker가 실제 최종 D1 membership을 확정하는 위치와 R2 이전 갱신/구형 writer 공존을 좁혀 재검토. 확정 후 **변경된 UID+곡**만 조건부 복구 가능한지, 추가 D1 읽기/쓰기 비용 상한을 증명하기 전 새 파생 큐·전역 poll·migration 금지.
2. `pending` 내 일부만 성공한 혼합 batch를 어떻게 정확한 대상별 결과로 알려줄지 설계. 최종 D1 확인 없이 local guard 해제/RTDB 확정 알림 불가. 2000/128 cap도 성공한 것처럼 처리 금지.
3. 실사용 테스트 계정에서 D1 W1~W2, R2 HEAD/GET/PUT, RTDB listener/transaction 및 비용 검증. 별도 Work 독립 감사·PC↔모바일 수렴 확인 후 릴리스 판단.
4. 사용자 명시적 프리뷰배포 승인 없이 PREVIEW 실제 앱/Worker 배포 금지, `테스트배포`/`정식배포` 승인 전 환경 승격 금지.

## 최종 기준 — 2026-09-20 KST: 074/127 접수 ACK와 개인 R2 결과 분리 PASS / 자동 정합성 미완료

`DOCS/CURRENT_RELEASE_STATE.md` 0BN 기준. 실제 PREVIEW 앱126/Worker071 유지. app127와 072~077 patch 미배포, main/production 미변경.

- 074 intake 응답에 개인 R2 CAS `personalLikeSnapshot: 'updated' | 'pending'` 추가. 큐 접수 성공 ≠ 개인 캐시 갱신. 실패 또는 구형 Worker의 필드 없음 시 127은 다른 기기에 확정 알림을 전송하지 않는다.
- 127은 `EXPLORE_LIKE_SNAPSHOT_PENDING_127` UID별 ID→최종 로컬 좋아요 의도를 120 outbox 제거 전에 영속 기록한다. R2 baseline/개인 좋아요 목록/늦은 RTDB가 과거 캐시로 이를 덮지 못하도록 보호. 상태를 `local` 이벤트로 표시하고 사용자에게 동기화 미완료 알림. 같은 ID의 실제 R2 CAS 성공 전에는 pending 보호 해제 금지; 서버 batch 중복 전송 금지.
- Run `35517860556` SUCCESS: 127/126/125/124/123/110 및 128~131 검사, TypeScript/Build, Worker071 SHA 보호. 임시 Workflow 162 정리. 실제 데이터 변경/배포 없음. **이 PASS는 불확정 상태 보호이며 최종 D1과의 자동 수렴 검증은 아님.**

### 다음 작업 (단일 근본 원인 우선)
1. 069/075 처리 후 특정 UID+곡 canonical 확정 순서와 R2 CAS 후처리의 안전한 종료 조건 찾기. 현재 `075~077` 읽기 전용 가드와 `074` pending만으로 무한 재시도나 전체 Feed refresh 없이 자동 R2 재구축할 수 있는지 분석. 불가하면 즉시 FAIL 보고하고 구형 Worker 호환 선행 승격으로 범위 제한.
2. 2000 좋아요/128 순서 토큰 한도는 절대 기존 ID 삭제·덮어쓰기 금지. 한도 초과 사용자도 무기한 좋아요 정지하지 않는 하위 호환 구조를 별도 비용/데이터 위험 감사 후 설계(파괴적 migration 승인 필요).
3. 실제 D1 W1~W2 및 변경 없는 재진입 R0, RTDB/R2 사용량 10만 사용자 비용, PC↔모바일/오프라인/동시 업데이트 실측 + 독립 Work 감사. 사용자 별도 프리뷰배포 승인 전 배포 금지.
4. 같은 기능의 TEST 승격은 명시적 `테스트배포`, PRODUCTION은 명시적 `정식배포` 승인 뒤에만; preview/main/production 임의 혼합 금지.

## 최종 기준 — 2026-09-20 KST: 074 R2 유실 방지 보완 PASS / 127 자동 수렴 구현 전

상세 `DOCS/CURRENT_RELEASE_STATE.md` 0BM. 앱126/Worker071 실제 PREVIEW 유지, 후보 앱127/Worker072~077 미배포. main/TEST 및 production/PRODUCTION 미변경.

- 074 patch는 shared R2 missing 시 구형 unconditional fallback 금지, 기존 2000 IDs의 손실 가능성이 있는 truncation 금지, 128 곡별 순서 토큰 초과 시 eviction 금지. 문제 상황에 `repairNeeded` 반환하고 D1 접수 큐 보호. 기존 한도 내 대상별 CAS 및 서버 수락 순서 유지. **이 부분은 데이터 보존이 확인됐을 뿐 해당 하트를 자동 복구한 상태가 아니다.**
- `verify-128-like-concurrency.mjs`에 cold R2 쓰기0, 2000 ID 보존, 128 토큰 보존 mock 추가. 최종 Run `35517114646` SUCCESS: 072~077 후보 syntax, 128~131 및 127/126/125/124/123/110, TypeScript, Build. 임시 Workflow 161 삭제. 원본 사용자 데이터 변경 및 배포 없음.

### 다음 작업
1. `repairNeeded` 이후 **실제 canonical D1 완료 기준을 확인한 경우에만** 해당 UID/곡의 R2 부분 복구·기기 하트 변경 적용. 해당 계정 전체 좋아요 R2 cold/2000/128 cap 예외를 성공처럼 처리 금지. 데이터 원본 중복 write/migration/전역 Feed 재생성 금지.
2. 동시에 남아 있는 구형 TEST/PRODUCTION writer unconditional 덮어쓰기를 공통 CAS로 호환시키는 릴리스 순서부터 확정. 별도 사용자 TEST/PRODUCTION 배포 승인은 아직 없음.
3. 실제 D1 rows_written W1~W2/변경 없는 정상 D1 R0, 10만 사용자 RTDB+R2 비용, PC↔모바일/오프라인·2000곡 실행형 및 제한 테스트 계정 실측. 독립 Work 감사 가능한 경우 고정 commit에서 read-only 실시.
4. PREVIEW에 앱127 또는 Worker candidate를 별도 `프리뷰배포` 승인 없이 배포 금지; main/production 변경 금지. 아직 릴리스 PASS로 기록하지 않는다.

## 최종 기준 — 2026-09-20 KST: 073/074 writer TEST·PRODUCTION 고정 소스 적용 모의검사 PASS, 실제 승격 전

`DOCS/CURRENT_RELEASE_STATE.md` 0BL 상세 확인. 실제 앱126/Worker071 PREVIEW 유지, app127 및 Worker072~077는 미배포. TEST main `f7fc25d5452b3313efa3cca53c180c5494cc9837`, production `e994340f3c4f6ac97f444f1ddf13053d3faffa71` 미변경.

- 세 환경의 고정 Worker source 모두 `syncExploreLikeR2AfterBatch034` 공유 R2 무조건 덮어쓰기, `receivedAt`/`queued.batchId` 동일 형태 확인. `073`·`074` patch에서 unrelated 071/072 marker 의존성을 제거해 구형 소스에도 최소 변경 적용 가능. 실제 구형 파일 및 서비스 직접 수정·배포 없음.
- Run `35516684243` SUCCESS: 고정 TEST/PRODUCTION 소스 blob 각각 `04586a5f203227d5cb02581d13f78a43b95053ce`/`14b3e4f3211ee7dfe1fcf9fcf10c935b6ce000f6`에 073/074 적용 및 동일한 128 경쟁 모의 테스트, 기존 PREVIEW 072~077/127~110 회귀, TypeScript/Build 통과. 구형 checkout이 lint 파일 범위에 포함된 선행 Run `35516547581` FAIL은 sparse checkout으로 격리 후 해결. 임시 workflow 160 삭제.
- **합격 범위는 소스 호환·mock까지.** 배포 바이너리 일치·실제 R2 conditional PUT·실제 D1 W1~W2·PC/모바일·10만 명 비용 미검증. 074 cold R2 fallback/128곡 순서 cap, 큐 ACK와 D1 최종 확정, 계속 동작 중인 다른 구형 writer가 있는 단계에서 shared R2 overwrite 위험은 여전히 존재.

### 다음 안전 작업 (추가 패치 증식 금지)

1. 073/074 writer-only 호환 수정이 *최종 D1 집계/메타데이터 손실*까지 어떻게 수렴하는지 두 기기+서버 모의/한정 테스트 계정으로 확인. 074 cold-start와 128곡 order cap, 069/075 혼합 큐 순서 검사. 문제 발견 시 파일 일부만 최소 수정하고 고정 test 재검사.
2. 세 Worker의 소스와 **실제 배포 버전**을 읽기 전용으로 교차 확인. GitHub 오래된 source와 실제 런타임이 다른 경우 서둘러 릴리스하지 않음.
3. 호환 writer를 선행 승격하려면 프로젝트의 릴리스 전체 코드/사용자 데이터 보호 정책과 맞는 완성 버전 tree·단계별 승인 기준을 별도 명시. TEST는 사용자 `테스트배포`, PRODUCTION은 명확한 `정식배포` 승인이 반드시 필요. 단독 앱127 PREVIEW 배포 금지.
4. 원본 data read 0/좋아요 W1~W2·R2/RTDB 비용/PC-모바일 기기 실사용 및 독립 Work 감사 PASS 후에만 PREVIEW·TEST·PRODUCTION 단계별 승격. 사용자 원본 write/migration/전체 캐시 삭제 승인 없이 금지.

## 최종 기준 — 2026-09-20 KST: 077 구형 큐 보호 후보 PASS / 무기한 대기·자동 복구 미해결

상세 최신 상태는 `DOCS/CURRENT_RELEASE_STATE.md` 0BK. 실제 PREVIEW 앱126 + Worker071 유지, 앱127 및 Worker072~077 patch는 미배포.

- 069/066/035 구형 큐는 UID 보조 인덱스가 없어 UID별 조회 시 전체 scan 위험. 077 후보는 **예외 원본 확인만** 075 사용자별 선검사 후 각 구형 큐의 첫 행(`SELECT 1 LIMIT 1`)만 최대 3개 확인. pending 409 / 오류 503 / 전부 비면 기존 최대20곡 본인 D1 canonical read. 데이터 변경 0, 인덱스 migration 0.
- 최종 Run `35515730947` SUCCESS: 071 고정 복사본+072~077 syntax, 신규 131/128/129/130 및 127/126/125/124/123/110 회귀, TS/Build. 임시 workflow 제거. 131 mock은 **상태 안전성 증명 범위만** 통과.
- **운영상 FAIL:** 다른 사용자의 구형 큐가 하나만 있어도 내 복구가 막혀 10만 사용자 상시 트래픽에서는 기아가 가능하며, 검사 이후 동시 새 접수의 atomic fence도 없다. 077이 자동 개인 R2 복구 자체를 수행하지 않는다. 실사용 D1 rows_written W1~W2 및 RTDB/R2 비용 미검증.

### 다음 작업: 불필요한 보호 패치 확대 중단, 호환 writer 선행 승격 설계
1. TEST/PRODUCTION 구형 Worker가 공유 likes R2를 쓰는 범위를 실제 코드에서 비교하고, **기존 사용자 기능을 유지하면서 호환 CAS/순서 경로만 먼저 배포할 수 있는 안전한 전체 릴리스 순서**를 설계. 사용자의 별도 `테스트배포`/`정식배포` 승인 없는 승격 금지. 방어 경로 077로 운영 해결을 주장하지 말 것.
2. 모든 쓰기 주체가 동일한 규칙으로 진입한 후에만 UID+곡 단위 canonical 최종 상태 복구와 ACK/queue 처리를 연결. 동시 수락·접수 후 최종 D1 적용·캐시 덮어쓰기·오프라인 재시도/2000 ID 경계 테스트를 독립 실행형으로 검증.
3. D1 사용자 변경 W1~W2 하드 게이트 및 정상 재방문 D1 R0, R2 HEAD·RTDB 수신량을 10만 명 기준 검증. 불명확하면 사용자 데이터를 바꾸지 않고 FAIL 보고.
4. 후보 코드 고정·독립 Work 감사·사용자 별도 프리뷰배포 승인 후에만 앱127/Worker 후보 배포. main/TEST/production/PRODUCTION 비변경.

## 최종 기준 — 2026-09-20 KST: 076 큐 처리 완료 검사 후보 PASS / 자동 복구·구형 큐 미해결

최신 상태는 `DOCS/CURRENT_RELEASE_STATE.md` 0BJ. PREVIEW 실제 앱126/Worker071 유지. 앱127 및 072~076 patch는 미배포.

- 076 패치: 인증된 예외 원본 확인에서 최대 20곡 요청 검증 후 사용자별 활성 `explore_like_user_queue_075` 행과 처리 커서 비교. 미처리 있으면 409, 읽기 실패면 503. 075 큐 처리 뒤에만 bounded D1 canonical membership 조회. 데이터 쓰기 0.
- 신규 `scripts/verify-130-like-settlement-gate.mjs`: pending/error/settled/invalid 입력 실행형 mock. 기존 129와 128/127/126/125/124/123/110 회귀, TypeScript/Build와 071 SHA 고정. 최종 Run `35514904414` SUCCESS. 임시 workflow 158 삭제.
- **PASS 범위 한정:** 076은 현재 075 큐만 검사하며 구형 069 큐, 동시 신규 요청, 074 개인 R2가 최종 D1과 이미 달라진 상황을 자동 복구하지 않는다. 075/076을 일반 페이지 진입에 호출하지 말 것. D1 read 0 목표와 1회 최대20곡 exceptional lookup을 분리한다.

### 다음 안전 작업
1. 구형 069/075 큐의 실제 공존·처리 커서/원본 최종화 경로를 비교하고, 별도 D1 write·전역 scan 없이 특정 UID/곡에 대해 확정 가능한 시점이 존재하는지 검증. 불가능하면 클라이언트가 정답을 확정했다고 표시하지 않으며 구형 writer 사용 종료 또는 선행 호환 수정 순서를 보고.
2. 확정된 대상 곡에 한해 클라이언트 pending 우선/구형 R2 덮어쓰기 재경합 처리/최대20곡 canonical 확인/필요한 부분만 개인 R2 CAS 복구. 원본이 대량 재조회되거나 전체 사용자 캐시를 다시 쓰는 구조 금지. 실사용 D1 mutation W1~W2와 R2/RTDB 10만 사용자 비용부터 검증.
3. 실제 Cloudflare 조건부 저장·기기 동시 좋아요/해제·오프라인·2000곡·독립 Work 감사 완료 전 릴리스 허가 금지. 변경 실패 시 FAIL로 보고하고 사용자 데이터 무단수정 없이 중단.
4. 사용자 명시적 프리뷰배포 승인 전 preview 소스만 변경, 앱126/Worker071 라이브 유지, TEST/PRODUCTION 변경 금지.

## 최종 기준 — 2026-09-20 KST: 075 제한된 원본 확인 경로 추가 / 자동 수렴·승격 미완료

`DOCS/CURRENT_RELEASE_STATE.md` 0BI가 최신 기준. 071 실제 Worker, 앱126 실제 PREVIEW 유지. 127 앱 소스와 072~075 Worker patch는 PREVIEW의 미배포 후보.

- 075 패치: 인증된 `GET /v1/me/likes-confirmed?trackIds=...`에서 본인 공개·발행 곡 최대 20개의 D1 canonical membership을 조회. 기존 read-only D1 core 재사용, R2 우선 경로와 다름. 앱의 정상 최초/재진입에 연결하지 않았으며 쓰기/마이그레이션 0.
- 신규 `scripts/verify-129-like-legacy-repair-gate.mjs`: 오래된 Worker가 shared R2를 무조건 덮어쓰면 074의 순서 메타데이터가 유실되고 최종 canonical과 개인 R2가 달라지는 모의 재현. 별도 read-only canonical endpoint는 통과하지만 **자동 복구가 아직 없음을 명시**.
- 최종 Run `35514355534` SUCCESS: Worker071 복사본에 072~075 순서대로 적용, syntax, 128/129 실행형 모의 테스트, 127~110 관련 회귀, TypeScript/Build. 임시 Workflow 157 제거. 실제 배포 및 실제 사용자 데이터 변경 없음.

### 다음 작업 절대 순서

1. `075`를 호출하는 조건은 **실제 사용자 변경으로 인한 R2 drift가 의심되는 경우만** 선정. 구형 writer/미전송 로컬 outbox/신규 worker 예외를 분리. UID+곡 ID 최대20개 제한을 유지; 변경 없음 페이지 진입에서 canonical D1 read 0.
2. 확인한 D1 membership이 아직 처리 중인 큐의 과거 상태인지 구분할 안전한 확정 신호를 설계. ACK를 canonical commit으로 간주하지 말 것. D1 queue 상태 조회가 전체 테이블 scan이 된다면 중단하고 대안 선택.
3. 오래된 Worker가 074 결과를 뒤덮은 경우 canonical로 개인 공유 R2를 대상곡만 안전 복구하고, 또 다른 구형 writer와 경쟁 시 재시도·복구 종료 조건을 명확히 한다. D1 W1~W2, R2 객체 2000곡 한도, 100k 사용자 비용 검증.
4. 최종 정상상태 코드 및 Worker candidate SHA 고정, 모의/실제 테스트 계정 경합·예외·비용 테스트, 독립 Work 감사, 사용자 별도 `프리뷰배포` 승인 뒤 PREVIEW 적용. TEST/PRODUCTION 승격 금지.

주의: 129의 `075_LEGACY_R2_OVERWRITE_REPRODUCED=PASS`는 기능 PASS가 아니라 **재현 검사 PASS**다. 과거 0BH의 기능 테스트도 구형 writer와의 공존을 보장하지 않는다.

## 최종 기준 — 2026-09-20 KST: 앱127+Worker072~074 동시 변경 코드 PASS·legacy 최종 복구 미해결

상세 기준 `DOCS/CURRENT_RELEASE_STATE.md` 0BH. 이 절이 아래 0BG의 072 단독 후보를 갱신한다.

- 사용자 요구: 같은 계정의 두 기기에서 좋아요와 해제를 거의 동시에 수행해도 서버 확정값과 하트·숫자가 궁극적으로 수렴. 개인 하트는 UID별 불리언이고 공개 숫자는 타 사용자를 포함한 별도 canonical count.
- 완료된 PREVIEW 코드 후보: 072 개인 변경 감지는 환경 로컬이 아니라 **공유 원본 R2 likes HEAD** 사용. 073은 W1 큐 순서를 기기 시간과 무관한 서버 receivedAt으로 고정. 074는 UID별 공유 R2에 conditional ETag PUT/최대 12회 retry와 최근 최대128곡 서버 시각+batchId를 두어 같은 곡의 과거 요청이 최신 수락 상태를 뒤집지 못하게 처리. R2 예외 시 이미 접수된 D1 큐의 DO 예약을 보호.
- 새 `scripts/verify-128-like-concurrency.mjs` 실행형 모의검사: 같은 곡 상반 동작 양방향, 다른 곡 동시 병합, CAS 충돌 retry, 멱등 상태, 서버 순서. 최종 Run `35506583191` SUCCESS: 128/127/126/125/124/123/110, TypeScript/Build, Worker071 SHA 보호. 임시 workflow 156 삭제.
- Worker072~074는 071 canonical 복사본에만 적용한 패치 후보이며, 실제 canonical `preview-worker.js`·checksum·live Worker071은 미변경. 현재 app-version126 / 실서비스 PREVIEW 앱126 + Worker071. TEST/PRODUCTION 데이터·코드·배포 미변경. D1/Rules/Functions 마이그레이션 없음.

### 남은 절대 릴리스 차단 사항
1. **구형 Worker 공존:** TEST/PRODUCTION의 기존 공유 개인 R2 writer는 074 CAS/lastLikeOrders074를 지키지 않는다. 동시에 오래된 writer가 공유 R2를 최종 덮어쓰거나 metadata를 없애면 074만으로 복구 불가. 최종 D1 aggregate 이후 해당 UID/track만 canonical에 맞추는 안전한 복구 또는 모든 writer의 호환 경로 설계 필요. D1 W3+ 및 대량 유저 데이터 read 금지.
2. R2 미존재 cold fallback, 최대12회 CAS 실패, 임시 네트워크 오류와 2천 ID 좋아요 사용자의 완료 보장 없음. ACK된 D1 큐는 반드시 계속 스케줄되지만 개인 R2 자동 수렴 별도 필요. 신호와 실제 최종 D1 1분 집계 순서가 다른 위험 해결.
3. Work 독립 감사·실제 Cloudflare conditional PUT/RTDB/PC↔모바일·구형 앱 동시 변경 실측·요청당 D1 W1~W2 및 R2/RTDB 10만 사용자 비용 PASS 미완료. 코드 모의검사 PASS를 실제 릴리스 PASS로 보고 금지.

### 안전한 다음 순서
- 먼저 구형 writer 상호운용 및 최종 canonical 재확인 정책을 설계·구현하고 실패 시 복구·상태 조회 비용을 테스트. 건드리는 곡/UID만 처리하고 정상 캐시 재진입 D1 R0 유지.
- 고정 preview commit → 최종 릴리스 검증 → 독립 Work 감사(가능 시) → 사용자 별도 **프리뷰배포** 승인 후에만 app127+Worker 후보 함께 PREVIEW로 릴리스. TEST/PRODUCTION 승격 별도 승인 필요.
- UI/반응형, Music Note 60초 묶음, 기존 공개 수/Feed/비공개 보호, 공유 원본·catalog flags 유지.

## 최종 기준 — 2026-09-20 KST: 앱127 구형 앱 동기화·복구 보완 / 072 패치 dry-run PASS·동시경합 보류

이 절이 하위 0BF의 미수정 상태를 갱신한다. CURRENT_RELEASE_STATE.md 0BG 기준. PREVIEW 실제 앱126/Worker071, 앱127 코드 후보 및 Worker072 패치 후보는 모두 **미배포**.

- 구형 앱 호환: 인증 /v1/me/likes-revision API를 Worker072 patch 후보에 추가. 공유 개인 R2 bundle HEAD ETag 확인, 바뀌었을 때만 R2 개인 목록 확인. Explore 진입/재개·내 좋아요 진입에 5분 최소 간격, 주기적 타이머 없음. R2 HEAD Class B 비용 1회는 무조건 읽기 0과 다름.
- 누락 신호: 영속 repair target 유지, 성공한 R2 snapshot 이후에만 RTDB signal seen 확정. 실패 후 온라인/포커스/재진입 재시도, pending 로컬 변경 보호. 성공한 상태를 다시 invalidate하지 않도록 ExplorePage 수정.
- Run 35505242919 SUCCESS: 127 및 과거 회귀, TypeScript/Build, 071 복사본에 072 패치 적용·문법 검사·UID HEAD-only 정적 검증. 071 canonical SHA 불변. 이번 작업에서 072 패치만 추가됐고 canonical 생성·배포 전.
- **남은 핵심 FAIL**: 동일 계정 PC·모바일 반대 조작과 큐 ACK/R2/최종 D1 적용 순서 검증. 2천 ID 사용자 지원, 실제 좋아요/해제 W1~W2, 추가 RTDB/R2 비용 실측, Work 독립 감사 및 PC·모바일 실사용 미검증.

### 추가 확인한 동시경합 원인 (소스 근거)

- 040 W1 큐의 batchAt은 현재 server receivedAt과 클라이언트 mutationAt의 최대값을 사용한다. 따라서 두 기기 시계가 서로 다르면 **먼저 서버에 접수된 요청이 나중 요청보다 우선**할 수 있다. aggregate는 사용자+곡별 created_at DESC, batch_id DESC로 최신을 결정한다. 한 계정·두 기기의 실제 마지막 동작과 최종 canonical 상태가 일치한다는 보장은 현재 없다.
- 034 syncExploreLikeR2AfterBatch034는 클라이언트 배치 접수 직후 개인 R2 bundle을 읽고 갱신한다. 두 기기의 read/put 순서가 뒤집히면 최신 canonical과 오래된 R2 개인 소유 상태가 달라질 수 있다. 이 경우 작은 HEAD는 **R2에 있는 잘못된 내용의 변경만 감지**하므로 원본 일치 보장 수단이 아니다.
- 해결 요구: client clock 무신뢰 상태에서 server acceptance/order 최종 규칙, R2 경쟁 write 방지 또는 canonical 완료 후 대상 UID만 R2 repair, 최종 개인 membership 확인을 실행형 테스트로 검증. 공유 전체 Feed rebuild 및 D1 W3+ 금지. 072 단순 HEAD 패치는 이 문제의 해결이 아니며 별도 근본 수정이 필요하다.

### 다음 구현/검증 순서
1. Worker 큐의 실제 최종 상태 적용 순서와 R2 bundle 갱신 시점을 확인하고 동일 ID 반대 클릭/순서 역전/동시 기기/오프라인 실패 실행형 테스트 작성. RTDB ACK만으로 최종 canonical 확정이라고 표시하지 말 것.
2. 정상 상태 no-change R2 HEAD 호출 상한과 10만 사용자 비용 산정·가능하면 테스트 계정으로 실제 측정. 127 추가 listener / transaction, 데이터 2천 ID 한도 처리 검증. 전체 D1 membership read 반복 금지.
3. 동시성 수정 및 072 patch를 canonical Worker 후보와 SHA로 고정한 뒤 Wrangler dry-run, TypeScript/Build/127~기존 회귀. D1 write/전체 사용자 데이터 변경 없음. 위험이면 배포 중단 후 보고.
4. 별도 독립 Work 감사 가능 시 고정 commit 검증. 사용자 명확한 프리뷰배포 승인 후에만 app127 + Worker072 PREVIEW 릴리스. main/TEST/production/PRODUCTION 비변경.

## 최종 기준 — 2026-09-20 KST: 앱127 독립 정적 감사 FAIL / 3개 차단 문제 보완 대기

다음 구현 근거: `DOCS/APP127_INDEPENDENT_AUDIT_2026-09-20.md`; 상세 상태 `DOCS/CURRENT_RELEASE_STATE.md` 0BF. 고정 감사 기준 `7f744f7cf8d93148368d1c926ee5dc61703a6887`. 기존 Run `35498983342`은 정적 회귀·TS·Build PASS이지만 누락/경합/비용을 증명하지 않음. 별도 Work 실행 감사는 미실시.

**BLOCKER (수정 우선순위)**
1. `exploreLikeService.ts`의 알림은 127 클라이언트만 발행. 현재 라이브 126 또는 TEST/PRODUCTION 구형 코드에서 공유 계정 좋아요 변경 시 기존 `EXPLORE_LIKE_BASELINE_127=1` 기기의 개인 하트가 무기한 stale 가능. 구형 환경에서도 사용자별 실제 변경을 bounded 신호/버전으로 감지 가능한지 서버 원본·R2 writer 경로 조사. 공개 likeCount에서 개인 소유 유추 금지.
2. gap 처리 `markSeenLikeSignal127`가 R2 복구 성공보다 앞서 실행되므로 네트워크/503 실패 후 자동 재시도 없음. 성공 ACK 후에만 완료 마크하거나 durable pending-repair + focus/online/재진입 제한 재시도.
3. 서버 큐 접수 ACK 시점과 최종 D1 canonical 확정 순서가 다름. 반대 기기의 같은 ID 좋아요/해제 동시 조작·역순/늦은 R2/알림에 대한 최종 상태 기준과 실행형 테스트 필요.

**원칙:** 사용자 계정별 최초 R2 1회 구조를 무작정 매 페이지 전체 재조회로 바꾸지 말 것. 버전 조회는 가볍고 재방문 D1/Firestore 원본 data read 0 목표; W1~W2 하드 게이트. RTDB listener/transaction·R2 metadata 조회 비용을 10만 명 기준 비교해 실제 숫자 측정 없이는 PASS 선언 금지. 2천 ID 한도·오프라인/신호 50개 초과·비공개·다른 사용자 likes·구형 writer 호환도 검사.

**실행:** Codex High 분석→최소 구현→실행형 회귀→TypeScript/Build→preview commit→Work 독립 감사(가능 시). 사용자 원본 D1/Firebase write·파괴적 migration·무단 데이터 전체 캐시 삭제 금지. **앱126/Worker071 실제 PREVIEW 그대로 유지**; 사용자 별도 프리뷰배포 승인 전 Hosting/Worker 배포하지 않음. TEST/PRODUCTION 변경 금지.

## 최종 기준 — 2026-09-20 KST: 앱127 통합 하트/좋아요 코딩 검증 PASS·미배포

상세 기준은 `DOCS/CURRENT_RELEASE_STATE.md` 0BE. 이 절이 아래 127 진단·설계 단계의 미구현 상태를 대체한다.

- 사용자 기준: 빈/채운 하트, 실제 좋아요/해제, 숫자를 한 사용자 동작으로 취급해야 한다. 다만 전체 숫자에는 타인의 좋아요도 있으므로 하트에서 전체 수를 역산하지 않는다.
- PREVIEW 후보 변경: `src/services/exploreLikeService.ts` 단일 로컬 상태 계산, UID별 첫 R2 개인 좋아요 스냅샷 복구, 기존 RTDB 규칙을 이용한 batch 접수 후 대상별 최대50 변경 신호, 유실/중첩 알림 로컬 retry·gap 복구, 미검증 값 클릭 차단. `src/pages/ExplorePage.tsx`는 서비스 유효 상태로 토글 및 다른 기기 변화 반영. `src/services/exploreLikedTracksService.ts`는 개인 좋아요 리스트 캐시를 해당 상태에 합침. 새 `scripts/verify-127-atomic-personal-like.mjs`.
- 최종 Run `35498983342` PASS: 실행형 like transition + 127/126/125/124/123/110 회귀 + TypeScript + Build + Worker071 SHA 고정. 임시 154 테스트 Workflow 정리. GitHub preview 전용 commit; 현재 라이브 app126/Worker071 유지, app-version 126 유지. 원본 사용자 데이터/Worker/Rules 변경 및 배포 없음.
- 주의: 현재 ACK는 canonical commit 완료가 아니라 Cloudflare 큐 접수. 공유 숫자는 1분 집계 후 반영. RTDB 구독 + transaction 새 사용량/10만 사용자 운영비, 전용 PC↔모바일 실기기, 로그인/오프라인/오래된 TEST/PRODUCTION 코드 공존, likes R2 2000 ID 한도 처리(캐시 보존·클릭 차단)는 독립 감사 전. **아직 제품 실사용 PASS가 아님.**

### 다음 작업 (독립 Work 검증 우선)
1. `DOCS/WORK_AUDIT_CHECKLIST.md`와 0BE에 따라 고정 commit에서 read-only 코드/데이터/비용 독립 감사. 127 알림이 batch ACK보다 앞서 발송되지 않는지, 실패로 mutation을 중복 전송하지 않는지, pending outbox·역순 RTDB 결과·최대50 간격 유실 시 원본 R2 재검증이 정확한지 확인. RTDB 규칙/프로덕션 이전 코드 호환성/추가 비용 미검증은 PASS 선언 금지.
2. 필요하면 preview 코드만 재수정하고 새 commit+TypeScript/Build/127+과거 회귀 재검사. 워커·파이어베이스 원본 변경/데이터 전체 재생성/기기 캐시 전체 삭제 금지.
3. 사용자 별도 `프리뷰배포` 승인 후에만 app-version 127 고정하고 Firebase PREVIEW에 정확 버전 배포. 사용자 사진의 네 곡 개인 하트 PC·모바일 일치 및 변경 없음 재진입, 좋아요/해제, 검색/추천/최신/인기/프로필을 실측.
4. 좋아요/해제 D1 W1~W2 절대 합격선 및 R2/RTDB 사용량 기준 실패 시 TEST 승격 중단. main/TEST 및 production/PRODUCTION 변경 금지.

## 최종 기준 — 2026-09-20 KST: 앱126 개인 좋아요 하트 PC↔모바일 실사용 FAIL / 127 진단·설계

상세 `DOCS/CURRENT_RELEASE_STATE.md` 0BD 참조. 이전 비공개 SHA10 `1319e4479e`는 사용자가 직접 공개한 정상 작업으로 확인. 해당 경고 닫음; 임의 재비공개 금지.

- 모바일 추천 첫 두 곡 빈 하트+1, 세 번째·네 번째 채운 하트+1; PC 첫 네 곡 채운 하트+1. 공유 공개 수는 일치하지만 **개인 좋아요 소유 상태는 서로 다름**. 사진만으로 canonical membership 또는 어느 기기가 stale인지 단정 불가.
- `getExploreLikedTrackIds()`는 개인 liked-state 120 캐시에 ID가 이미 존재하면 `/v1/me/likes` 재확인하지 않는다. `observeExploreLikeAccountSyncSignal`은 의도적으로 no-op. `likeHydrationKeyRef`도 반복 재확인을 억제하며, 앱126 revision은 공용 Feed 숫자 전용. 따라서 하트만 영구적으로 예전 상태를 유지할 수 있다.

### Codex High 설계 우선, 별도 사용자 배포 승인 전 배포 금지
1. 119/120이 개인 RTDB replay를 없앤 비용 이유와 Worker likes batch ACK·canonical commit·기존 per-user R2 liked bundle 갱신 시점을 확인. 무조건 RTDB replay 복구/모든 진입 40 ID canonical D1 조회/좋아요 수에서 하트 역산 금지.
2. 실제 사용자 변경 때만 작고 UID-scoped된 변경 신호를 보내는 최소 구조 또는 이미 존재하는 저비용 확정 신호를 평가. 추가 구독·read/write 비용 및 10만 사용자 확장성, preview ↔ older TEST/PRODUCTION writer 호환성 확인 후 구현. 변경 없음 D1/Firestore 원본 read 0, 좋아요/해제 W1~W2 절대 보호.
3. 새 이벤트는 confirmed membership과 로컬 pending outbox를 구별. 다른 기기의 최신 confirmed 변화가 특정 track IDs에만 반영되며 로컬 미확정 클릭을 덮지 않음. 서로 다른 PC/모바일 로그인 세션, 30초 batch+1분 aggregate, 역순/누락/동시 이벤트, 잘못된 응답, 개인 좋아요 목록·추천·최신·인기·공개프로필 모두 검사.
4. 코드 + targeted verifier + TypeScript/Build + Worker dry run → commit 고정 → Work 독립 감사. 실제 계정 canonical membership 읽기는 사용자 인증 범위 내 최소 대상에 한정하고 사용자 원본 write/migration 금지.
5. PREVIEW 앱126 / Worker071 유지. 별도 프리뷰배포 승인 전 배포 금지, TEST/PRODUCTION 미변경. W1~W2 실측과 PC↔모바일 실사용 PASS 전 승격 금지.

## 최종 기준 — 2026-09-20 KST: PREVIEW 앱126 배포 PASS / 기기 실사용·이전 비공개 재공개 출처 확인 전

이 절이 아래 0BB의 126 미배포 상태를 대체한다. 상세 기준은 `DOCS/CURRENT_RELEASE_STATE.md` 0BC.

- 사용자 승인 범위: app126 PREVIEW Firebase Hosting만 배포. source/trigger commit `2c62108e2ad7b3c54ce41baf811dc45e603a8a01`; PREVIEW Hosting Run `35495184909` SUCCESS, exact build + app-version 126 PASS, TEST/PRODUCTION 비변경 PASS.
- preflight Run `35495097116` SUCCESS: 126/125/124/123/110/070 회귀, TypeScript/Build, Worker071 hash 고정. 앞선 Run `35495034377`은 이전 110 verifier의 app126 인식 실패로 배포 전 FAIL했고 검사 보완 후 재검증.
- PREVIEW Worker071 `a6fda48f-ec20-48b3-a08d-ef43128c2e43` 그대로, TEST/PRODUCTION Worker/Hosting 및 Firebase Functions/Rules 비변경. 이 작업의 사용자 원본 write 0.
- read-only postflight Run `35495431978` SUCCESS: 현재 canonical 공개곡 38곡, D1 likes 관계/derived, PREVIEW API/local/shared latest+popular 6목록 전부 좋아요 수 일치, Feed R2-only D1 R0/W0. **기존 비공개 SHA10 `1319e4479e`가 앱126 배포 이전 2026-09-20 15:31:38 KST에 원본 D1 공개 상태로 전환**된 사실 확인. 의도된 재공개인지 불명. 과거 private 미노출 PASS를 현재 상태에 적용 금지. 무단 원복/유저 원본 수정 금지.
- 임시 postflight는 처음 37곡 고정 및 예전 updated_at 검색으로 FAIL했으나 현행 상태와 원본 visibility를 구분해 재검증 후 PASS. 임시 Workflow 152/153 정리. 독립 Work, 사용자 PC/모바일 화면, 실제 mutation W1~W2는 미검증.

### 이어서 진행할 작업
1. 사용자 실제 모바일·PC에서 **인기 탭 방문 없이** 추천/최신 기존 두 곡(해제 상태) 빈 하트+숫자0 확인; 두 기기 동일 계정 소유 상태 및 30초 묶음 후 정상 수렴 검사. 상태 변경을 위한 무단 좋아요·공개 조작은 하지 않는다.
2. 과거 비공개 SHA10 `1319e4479e`의 현재 공개가 사용자 의도인지 확인. 사용자 승인 없이는 비공개로 재전환/원본 데이터 수정 금지. `updated_at`이 앱126 배포 전임을 보존하고 릴리스 때문에 공개됐다고 단정 금지.
3. 실제 사용자 요청별 D1 W1~W2, 변경 없는 재진입 Feed-data R0·원본 D1 R0/W0 확인. 작은 edge revision 요청과 full Feed-data read 구분. 비용·시각 FAIL 시 TEST 승격 차단.
4. TEST/PRODUCTION 구형 shared writer 위험과 Work 독립 감사 미해결. 명시적 별도 `테스트배포` 승인 전 main/TEST, 별도 `정식배포` 승인 전 PRODUCTION 코드 승격 금지. catalog flags 유지.

## 최종 기준 — 2026-09-20 KST: 앱125 실사용 stale count FAIL / PREVIEW 126 후보 코드 검증 PASS·미배포

이 절이 아래 앱125 `사용자 실사용 전` 기록을 대체한다. GitHub 상태 문서 `DOCS/CURRENT_RELEASE_STATE.md`의 0BB 참조.

- 사용자 PC에서 두 곡을 1→0 해제한 뒤 모바일 추천/최신의 빈 하트·숫자 1, PC/모바일 인기 숫자 0; 인기 왕복 뒤 모바일 최신도 0. **실사용 화면 정합성 FAIL**.
- read-only Run `35494118924` SUCCESS: 대상 SHA10 `9fef3a2199`, `abd7763bc1`의 canonical/relation/derived 및 PREVIEW API/local/shared 최신·인기 전부 0; 두 API D1 R0/W0. 서버 최신·인기는 정상이고 원인은 모바일의 이전 latest 캐시를 갱신하지 않는 앱125 경로로 확인. 데이터 write 0.
- 코드 수정: `src/pages/ExplorePage.tsx`에서 마지막 성공 revision 검사 시각을 요청 URL별로 보존. 캐시 렌더링만으로 120초 검증창을 리셋하지 않음. 오래된 추천/최신 첫 진입에서 작은 revision 확인 후 변경 때만 기존 R2 first-page를 가져와 수렴. 추천·최신 공통 최신 URL 유지, 인기 경유 불필요.
- 신규 `scripts/verify-126-explore-entry-like-count.mjs`; 기존 123 verifier를 새 진입 검사식과 호환되도록 최소 수정. 최종 Run `35494247124` SUCCESS: 126/125/123/124 회귀, TypeScript, Build PASS. 최초 Run `35494196072`은 이전 123 검사식의 구문 불일치로 FAIL했고 테스트 보완 후 재실행. 임시 검사 Workflow 150·151 삭제.
- 현재 실제 서비스는 **Firebase PREVIEW 앱125 + Worker071** 그대로. `public/app-version.json`도 아직 125. 수정 코드는 preview에만 있고 미배포. main/TEST/production/PRODUCTION 및 원본 데이터 변화 없음. 독립 Work, PC/모바일 신규 빌드 실사용, 요청별 D1 W1~W2 미검증.

### 다음 실행 (Codex High + 독립 Work 가능 시)
1. 고정된 최신 preview HEAD에서 126 후보의 작은 revision 조회가 origin D1/R2 전체 재조회 없이 동작하는지 추가 감사. `verify-125`는 app-version 125를 요구하므로 126 bump 시 테스트 버전 조건도 하위호환되도록 업데이트한 뒤 전체 합격선 재검증. app version을 사용자 데이터 초기화 근거로 사용하지 않는다.
2. 사용자 명시적 `프리뷰배포` 후에만 126 Firebase PREVIEW Hosting 정확 버전으로 배포. Worker071/Functions/Rules 재배포 불필요. 배포된 PC/모바일에서 두 곡 초기 숫자 0·빈 하트 확인 및 신규 1→0 좋아요 해제 뒤 인기 탭을 거치지 않은 최신/추천 수렴 확인.
3. 정상 캐시 재진입 Feed-data read 0 / 변경 시 작은 revision + bounded R2; D1 R0/W0. 사용자 좋아요·해제·공개·비공개 각각 D1 W1~W2 미측정 상태 유지, W3+면 FAIL.
4. 개인 하트 소유 상태와 공용 숫자를 혼동하거나 `liked ? 1 : 0` 식으로 숫자를 덮는 임시 보정 금지. 타 사용자 좋아요도 존재할 수 있으므로 사용자 실제 소유 상태는 별도로 검증.
5. TEST/PRODUCTION 구형 shared writer 위험 및 독립 감사 미해결. 별도 `테스트배포`/`정식배포` 승인 없이는 승격 금지. 기존 비공개/사용자 데이터/기존 UI/Music Note 60초 묶음 저장 보호.

## 최종 기준 — 2026-09-20 KST: PREVIEW app125 + Worker071 **배포 PASS / 사용자 실사용 전**

이 절이 아래 기록의 `미배포`·`배포 승인 대기` 상태를 대체한다.

- Worker source `e9ccd5d4092f24ae34457b81479eded73af59b87`, canonical SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- Worker PREVIEW Run `35491281571` SUCCESS, live `a6fda48f-ec20-48b3-a08d-ef43128c2e43`.
- Firebase PREVIEW Hosting app125 Run `35491378862` SUCCESS, locked source `e2bc5ee3e1845e6abb6c573e468a711f40f41fd3`; TypeScript/Build/exact deployed index/app-version 125 PASS.
- Postflight Run `35491493263` SUCCESS: 실제 PREVIEW API + local R2 + shared R2 latest/popular 37곡 전체 canonical D1 like 정합성 PASS; 기존 private 곡 미노출, D1 R0/W0, 원본 write 0, TEST/PRODUCTION 비변경.
- 이전 4곡 파생 R2 제한 복구 Run `35489878431` PASS; 9/18 동일 오류의 최초 writer 원인 미확정.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 기존 상태. catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF 유지.

### 다음 작업: 데이터 변경 없이 먼저 검증
1. 사용자 PREVIEW 실사용: **앱 125 최초 업데이트 후** 최근/추천/인기 전환시 동일 37곡 좋아요와 계정별 빨간 하트; PC ↔ 모바일 하트 소유·수치 수렴. 정상 캐시 재진입시 중복 R2/D1 읽기 여부. 실제 브라우저 실사용은 아직 미검증.
2. 관리자 진단으로 사용자 mutation별 실제 D1 `rows_written` 측정: 좋아요/해제, 공개/비공개 각각 W1~W2 PASS만 허용. W3+면 다음 승격 FAIL. 비용 원인 미확정 시 무한 재배포 금지.
3. 가능하면 독립 Work 감사: 071이 기존 070 경합/비공개 보호를 깨지 않는지, 125 업데이트 marker가 실패한 요청에서는 저장되지 않는지, 전체 재조회/데이터 덮어쓰기/시각 변경이 없는지.
4. 실제 캐시가 다시 0으로 회귀한다면 원본/관계/derived/card/local/shared의 한 곡별 타임라인으로 writer를 식별하고 **원인 우선 수정**. 전체 Feed 재생성·사용자 데이터 수정 금지.
5. TEST와 PRODUCTION 구형 059/064 shared snapshot writer 영향 해결과 전체 기능 검증까지 마친 후, 사용자 `테스트배포` 승인 시 main/TEST 승격. PRODUCTION은 별도 명확한 `정식배포` 승인 이후.
6. 정상 작동 기능, Music Note 60초 묶음 저장, UI/반응형, 사용자 공유 원본 D1/Firebase, PREVIEW와 protected 버전 분리 유지.

최종 갱신: 2026-09-20 KST — app125/Worker071 후보 소스 검증 PASS, PREVIEW 미배포

## 현재 기준
- 사용자 요구: 업데이트 후 기존 좋아요·하트 유지, 업데이트 첫 1회 공유 상태 반영, 재방문시 원본 D1 data read 0. 전체 공개곡 검사 필요.
- 전수 read-only Run `35489084396`·`35489176377`: 전체 공개곡 37, 원본/관계/파생 37/37 일치, 4곡만 PREVIEW local/shared Feed count=0·원본=1.
- 대상만 R2 복구 Run `35489878431`: 4곡만 PREVIEW local/shared latest/popular 0→1, 무관 곡 불변, D1 write 0.
- 실제 PREVIEW live Feed 전곡 parity Run `35489951050`: latest/popular 각각 37/37 PASS, 테스트 당시 LIVE app124·Worker070 유지.
- 후보: app125 `src/pages/ExplorePage.tsx`와 `public/app-version.json`; Worker071 source `cloudflare/explore-worker/canonical/preview-worker.js` SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- 최종 코드/회귀/TypeScript/Build/Worker dry-run Run `35490609131` SUCCESS. 125 최초 refresh는 정렬별 release marker로, 유효한 shared R2 first-page snapshot 반영 후만 완료. 오류 시 로컬 캐시 보존 및 재시도. 071은 공개·재공개시 대상 PK canonical count=1 보존, 진짜 unlike=0 허용, 원본 부재 시 파생 쓰기 차단.
- **현재 라이브는 app124 / PREVIEW Worker070 `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf` 그대로.** TEST·PRODUCTION 변경 없음, Firebase 배포 없음.

## 다음 실행
1. 이 후보의 독립 Work 감사: `DOCS/WORK_AUDIT_CHECKLIST.md` 기준, GitHub 고정 commit·canonical SHA 확인, app125 first-refresh 오류/중복·다른 기기, 071 publication profile/Feed read/write, 기존 070 private/like CAS, 구형 TEST/PROD shared writers 영향. 감사자가 없으면 Work PASS를 자칭하지 말고 미검증 표기.
2. 실제 좋아요 1회 D1 W1~W2 및 신규 공개/비공개도 W1~W2 비용 미검증. 071 대상별 D1 조회 비용·중복 조회를 확인하되 전체 Feed scan 금지.
3. 사용자의 명시적 `프리뷰배포` 요청을 받으면 고정 app125 + Worker071을 한 버전으로 PREVIEW 배포, Firebase app·Worker 각각 성공 확인 및 app125 exact build/Worker SHA, 37곡 latest/popular D1 parity, private target absent, R2 first update/재진입 R0/W0, PC/모바일 동기화 실사용. 하나라도 FAIL면 다음 승격 금지.
4. PREVIEW 검증 완료 후 사용자 `테스트배포` 승인 시 main/TEST 전체 승격. PRODUCTION은 명확한 별도 정식배포 승인 후에만.
5. 공유 원본 D1, Firebase 데이터, 반응형/UI, Music Note 60초 묶음 저장 변경 금지. catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF 유지.

## 남은 위험
- 과거 4곡 1→0 마지막 writer의 실제 타임라인 증거 부족. 071은 publication에서 stale 0 우선 병합을 제거했지만 다른 라이브 writer/구형 TEST·PRODUCTION까지 영구 안전을 보장하지 않음.
- 기존 private 곡은 계속 비공개. 무단 full Feed rebuild/backfill/migration/TEST/PRODUCTION 배포 금지.
- 신규 사용자 mutation 비용 W1~W2/PC·모바일 실사용 아직 미검증.

최종 갱신: 2026-09-20 KST — 동일 4곡 canonical like 1 / PREVIEW local+shared 0 재발 FAIL

## 최우선 작업: 공개 좋아요 숫자 재하락(write provenance) 규명 후 targeted 방지
- 사용자가 업로드한 69초 PREVIEW PC 영상은 추천/최신/인기 간 같은 곡 0↔1 및 채워진 하트와 수치 불일치.
- Run `35488556374` (read-only): canonical D1 `track_stats.like_count=1`이나 PREVIEW local+shared latest/popular 및 실제 Feed R2-only=0인 4곡 확인. latest↔popular 현재 shared 내부 mismatch=0, 영상 인기 1은 local per-sort 이전 캐시일 수 있음.
- Run `35488673580` (read-only): TEST/PRODUCTION local latest/popular와 shared track-card는 해당 4곡 모두 1. 기존 9/18 동일 4곡 shared targeted repair Run `35345067282` 이후 같은 문제가 재발.
- 070 PREVIEW 배포 Run `35457463038`은 성공했으나 **좋아요 정합성 검사가 없었음**. 실제 오류 지속, TEST/PRODUCTION 승격 차단.

### Codex High / Work 경계
1. `cloudflare/explore-worker/canonical/preview-worker.js` 내 043/056/059/064/065/069/070과 active reader, shared track-card 062, session-cache 124의 실제 write 순서/조건을 집중 추적. 먼저 어떤 경로가 기존 shared 1을 0으로 덮었는지 **관측/정적 근거**로 좁힐 것. TEST/PRODUCTION local은 1이므로 구형 writer가 0을 썼다고 가정 금지.
2. 네 곡 canonical ↔ local ↔ shared Feed ↔ card/프로필의 소스 일치성 가드를 설계. 사용자 행동이 없는 재진입/업데이트에서 D1 원본 읽기 0; 실제 변경된 track ID만 R2 CAS 갱신; 전체 Feed/전체 profile scan 금지.
3. app124의 1회 marker/actor 좋아요 overlay가 더 오래된 탭 로컬 캐시를 영구 권위로 사용하지 않도록 **데이터 revision 기반** 수렴 검사. 앱 버전 변경만으로 강제 서버 읽기 금지. 같은 곡 모든 탭·프로필의 숫자와 하트 소유 상태가 독립적으로 올바른지 테스트.
4. 기존 `scripts/verify-123-shared-like-cache-repair.mjs`, `scripts/verify-116-explore-public-count-convergence.mjs`, `scripts/verify-070-shared-feed-guard.mjs`를 가능한 재사용. `D1=1 / PREVIEW local+shared=0 / TEST·PRODUCTION local=1 / card=1` 회귀 fixture 필수.
5. 구현 → 관련 test → 최종 TypeScript/Build/Worker dry-run → commit 고정 → Work 독립 감사. 실배포·D1/R2 원격 write 금지.
6. 감사 PASS 후에만 **정확히 진단된 4곡**을 canonical state/updated_at 확인 + CAS로 derived R2 제한 복구하고 user approval 후 PREVIEW 배포·실제 API parity를 확인. 기존 비공개 곡은 유지.
7. 좋아요 1회 rows_written W1~W2는 별도 요청 측정. 신규 좋아요·해제 사용성 테스트는 데이터 정합성 수정 전 중단.

## 보호
- 현재 live PREVIEW `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`, app124.
- TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 불변.
- catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF, 배포·승격 중단.
- canonical D1/Firebase data write/migration/backfill/사용자 전체 데이터 복사 금지.
- UI/반응형/정상 60초 Music Note 묶음 저장 비변경.

최종 갱신: 2026-09-20 KST — PREVIEW 069/070 배포 PASS / TEST 승격 전 사용자·비용 검증 대기

## 현재 고정 기준
- PREVIEW release source: `dc95856ad8299b3ed8746b2fd4d2dbdd574cda4b`.
- PREVIEW Worker Release Run `35457463038` SUCCESS.
- live PREVIEW Worker `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`.
- canonical Worker SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- postflight Run `35457550389` SUCCESS: preview.soridraw.com HTTP 200, app 124, latest/popular R0/W0, private target absent from PREVIEW local/shared 37/37.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase unchanged.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.

## 다음 작업
1. PREVIEW 사용자 실사용에서 기존 private 상태 유지/Explore 노출 없음/PC·모바일 일관성 확인.
2. 새 private→republish 검증은 아직 TEST/PRODUCTION 구형 shared writer가 살아 있으므로 범위를 좁혀 신중히 진행. 기존 known private 곡은 임의 재공개 금지.
3. 요청당 D1 rows_written 실측: private/public/like/unlike 각각 W1~W2만 PASS. W3+면 즉시 실패 처리.
4. 사용자가 **테스트배포**를 명시 승인하면 검증된 PREVIEW exact tree를 main/TEST로 승격하여 TEST Worker에 069/070 적용 후 shared/local parity와 비용 재검증.
5. PRODUCTION은 TEST 전체 PASS + 사용자의 명확한 정식배포 승인 후에만 승격.
6. catalog READ/FIRST_PUBLISHER 전환은 별도 승인/검증 작업으로 유지.

## 금지
- 사용자 원본 D1/Firebase migration/backfill/전체 Feed rebuild.
- generic 계속 진행을 TEST 또는 PRODUCTION 승인으로 해석.
- W1~W2 미검증 상태에서 TEST/PRODUCTION 비용 합격 선언.

최종 갱신: 2026-09-19 KST — 070 cross-env dry-run PASS / 실제 stale cache 4개 수리 PASS / 승격 승인 대기

## 현재 고정 사실
- 070 product canonical commit `2720607faa9ede08221e4b9a15c5a30967c622bc`, Worker SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- Run `35451900664`: 070 코드/TS/Build/PREVIEW Worker dry-run PASS.
- Run `35452733928`: 동일 070 Worker가 현재 TEST/PRODUCTION live bindings으로 **dry-run PASS**, 실제 Worker versions 불변.
- Run `35452779963`: TEST/PRODUCTION local latest/popular가 실제 38곡 + private target 포함, PREVIEW/shared는 37곡 + target 없음으로 stale 위험 실증.
- Run `35452879050`: TEST/PRODUCTION local 4 snapshots에서 대상 private ID만 CAS 제거하여 38→37; postflight PREVIEW/TEST/PRODUCTION local + shared 8 snapshots 모두 37 / target absent. canonical D1/user-origin write 0.
- 라이브 PREVIEW는 아직 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`. TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`도 070 미배포.
- 현재 곡은 비공개 유지. catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.

## 다음 실행 게이트
1. 더 이상의 private/republish 실사용 mutation은 **구형 TEST/PRODUCTION writer가 살아 있는 동안 중단**. 현재 곡의 stale local cache는 수리됐지만 다음 곡은 다시 stale될 수 있음.
2. 사용자가 **테스트배포**를 명시 승인하면 정상 릴리스 순서로:
   - 먼저 PREVIEW 070 exact SHA 배포 및 smoke/R0W0 확인.
   - 070이 적용된 PREVIEW를 사용자 검증.
   - 검증 완료본 exact tree를 main/TEST로 승격하여 TEST Worker의 059/064 bulk writer 차단 확인.
   - shared/local snapshot parity, 기존 private target 부재, like/private CAS, D1 W1~W2를 TEST에서 재검증.
3. PRODUCTION은 TEST 전체 PASS 후 사용자의 **명확한 정식배포 승인** 전에는 코드/설정 변경 금지.
4. PRODUCTION 승격 후에만 세 활성 Worker 모두 070 guard 보유를 확인하고 새 private→republish 실사용 검증을 재개.
5. READ/FIRST_PUBLISHER ON은 별도 작업. W3+ mutation이면 승격 중단.

## 안전 기준
- 원본 D1/Firebase 사용자 데이터 이동/대량수정/전체 Feed rebuild 금지.
- 기존 private 곡을 테스트 편의상 임의 재공개 금지.
- cache repair는 현재처럼 canonical private guard + 대상 ID 1개 + ETag CAS + unrelated item byte equality 검증이 없는 경우 실행 금지.
- generic “계속 진행”은 PRODUCTION 승인으로 해석하지 않는다.

최종 갱신: 2026-09-19 KST — 070 PREVIEW 소스 검사 PASS, 실배포 및 cross-env 보안 게이트 미해결

## 최우선 배포 전 경계
- 070 code commit `2720607faa9ede08221e4b9a15c5a30967c622bc`, canonical source SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`, SHA pin `ffb97fe94e80ca28ccf64548677a94eae5c01e18`.
- Run `35451900664` SUCCESS: 069+070 patch parity, old full mirror 059/064 disabled in **070 source only**, targeted like CAS conflict against private, TS/Build, Worker --dry-run.
- 069 shared private/publish/options target helper는 그대로 유지. Catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- 라이브 PREVIEW Worker는 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`; 070 아직 미배포. main/PRODUCTION Worker는 이전 versions와 059/064 전체 shared snapshot writer를 유지한다.
- Run `35451509693`: 특정 곡의 shared latest/popular 각 37, 비공개 유지, 실제 복구 put 0. 지속 안전 보장 아님.

## 다음 단계 — PRODUCTION 승인 전까지 코드/설계/검증만
1. 현재 TEST/PRODUCTION 구형 059/064 전체 writer 호출 가능성을 고정 source/API로 재검증. 오래된 환경의 **원본과 캐시의 역할을 분리**하고 새 targeted writer와 cold recovery의 호환 조건 명시.
2. 올바른 전체 승격 절차를 설계: 전체 snapshot 무조건 덮어쓰기를 차단한 코드가 **공유 v112를 쓰는 모든 활성 Worker**에 설치되기 전에는 비공개 곡의 재노출 위험을 0으로 판정하지 않는다. 검증되지 않은 PRODUCTION hotfix 자동 적용 금지.
3. 불가피하게 PRODUCTION 코드 변경이 포함된다면 **사용자 명확한 PRODUCTION 승인 선행**. preview→TEST 검증 후 production, 이전 환경 기능 유지, 배포 실패 시 롤백과 shared cache 방어 계획 제시.
4. 공유 스냅샷 신규 bootstrap/cold 회복은 정상 페이지마다 전체 DB 읽기를 일으키지 않도록 별도 제한된 절차. 070의 059/064 no-op로 초기화 불가 시 안전한 fallback/알림 확인. 정상 cache 재진입 R0/W0.
5. 필요 시 사용자 계정에서 기존 곡 private→republish 단독 실사용 및 D1 W1~W2 요청별 측정. W3+면 FAIL.
6. READ/FIRST_PUBLISHER ON 및 TEST/PRODUCTION 승격은 자동 진행 금지.

## 변경 불가 기준
- 원본 D1/Firebase 사용자 데이터 이동·대량 수정/전체 Feed 재생성 금지.
- 070 PREVIEW 수정본이 자체 테스트 PASS였다는 이유로 모든 환경 보호 PASS로 보고 금지.
- 사용자 기존 곡은 비공개 유지.

최종 갱신: 2026-09-19 KST — 069 재오염 방지 독립 감사 FAIL, 단일 비공개 캐시 37/37 수렴 확인

## 최우선: shared Feed 환경 간 재오염 방지 구조
1. 069 자체 동작/TypeScript/Build/Worker dry-run PASS (`35450819828`), 하지만 059/064 구형 shared Feed 전체 mirror가 `preview`·`main`·`production` canonical Worker에 남아 있어 PREVIEW 069만 배포해도 stale local snapshot이 private 곡을 shared latest/popular에 재삽입할 수 있다. 069 PREVIEW 배포 **중단**.
2. 사용자 비공개 곡의 현재 D1/catelog/shared R2: TEMP 137 Run `35451509693` PASS, shared latest/popular 37/37, target absent. **이번 repair write 0**(이미 수렴). 단, 구버전 writer 재오염 위험 미해결.
3. Codex High에서 059/064/065 전체 snapshot 미러, 각 환경의 shared read/write, 069 targeted mutation, 구형 TEST/PRODUCTION 배포 상태를 대상으로 **환경별 코드 승격 없이도 공유 사용자 데이터가 재노출되지 않는 보호 설계**를 먼저 제시. 기존 shared R2의 무조건 overwrite 구조를 통제하거나 환경별 파생 캐시를 분리해야 한다. 장기적으로 전체 Feed 반복 read/rebuild 비용 금지.
4. 안전한 공존 방안이 없으면 사용자에게 먼저 보고하여 TEST/PRODUCTION 호환 배포 순서의 명시적 승인을 요청한다. 사용자 승인 없이 main/PRODUCTION/원본 D1 변경 금지.
5. 재오염 방지까지 독립 감사 PASS → 정확한 SHA로 PREVIEW Worker만 승인 배포 → 실제 API/PC·모바일 및 D1 W1~W2 검증. READ 및 FIRST_PUBLISHER OFF 유지.
6. 현재 해당 곡은 비공개 유지. 별도 재공개 검증 전까지 사용자에게 원복 요구 금지.

## 고정 소스 및 이전 결과
- product source commit `62c5741d773183d3064bcd53dc70a74179aad535`, sha pin commit `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- source SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`; live PREVIEW Worker 기존 `4f8471e3-576f-49de-9f2c-c3863021bf3d`.
- PREVIEW code 069 미배포, TEST/PRODUCTION/Firebase 미변경. 비용 W1~W2 미검증.

최종 갱신: 2026-09-19 KST — 069 targeted shared Feed parity 코드 PASS / PREVIEW 배포 및 기존 stale 복구 전

## 고정 기준
- preview product canonical 069 source commit `62c5741d773183d3064bcd53dc70a74179aad535`; source SHA pin `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- canonical Worker SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`.
- Run `35450819828` PASS: 069 unit, official patch byte-for-byte parity, TypeScript, Build, Worker dry-run. No deploy.
- PREVIEW active Worker still 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`; catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- main/production not promoted. No Firebase change.

## 다음 작업 순서
1. 가능한 경우 Work 독립 감사: 069 diff, active 043 private/publish/options connection, catalog fail-closed guard, R2 CAS race, 059/064 mirror와의 간섭, D1 read/write 0, UI 비변경. 감사 중 제품 수정/배포하지 않음.
2. 별도 사용자 PREVIEW 배포 승인 후 source SHA 고정 → 기존 canonical release Workflow로 PREVIEW Worker만 배포 → live version/flags/latest/popular R0/W0/protected environments 확인. Firebase 불필요 배포 금지.
3. 사용자 승인된 **대상 비공개 1곡만** 읽기 전용으로 D1 `is_public=0`, catalog `public=false`, shared latest/popular stale 여부를 확인한 다음, shared 두 객체에서 해당 ID만 조건부 제거하는 bounded derived R2 repair 실시. 원본 D1/Firebase write 0; catalog/Feed 전체 rebuild 금지. 보호 환경 공유 데이터임을 고려.
4. PREVIEW/TEST/PRODUCTION 공개 경로에서 비공개 곡 미노출 확인; 뒤늦은 059/064 catch-up으로 재노출 없는지 확인. 38→37 shared first-page convergence 합격.
5. 사용자 별도 재공개 검증 → shared/catalog 재삽입, 요청당 D1 W1~W2 실측; 좋아요도 단독 테스트. W3+면 FAIL.
6. live parity 및 비용 PASS 후에만 catalog READ ON 별도 승인 대상으로 검토. FIRST_PUBLISHER, canonical D1 schema/index/trigger도 각각 별도 승인.

## 금지
- 배포 요청 없는 자동 배포, 공유 user origin migration/overwrite.
- private된 곡을 테스트용으로 무단 재공개.
- 전체 Feed/catalog 백필 또는 모든 shared cache 재복사.
- 검증되지 않은 W1~W2 PASS 선언, TEST/PRODUCTION 승격.

최종 갱신: 2026-09-19 KST — live private D1 PASS / catalog PASS / shared R2 latest+popular stale FAIL

## 최우선 차단 이슈 — 실제 PRIVATE 공유 Feed 파생 캐시 누락
- TEMP 134 Run `35449942592`: D1 private 1건 `updated_at=1789829348623` 검출, 해당 catalog meta `public=false`, marker 0 PASS. shared latest는 여전히 private 곡 포함 FAIL.
- TEMP 135 Run `35450000210`: PREVIEW 최신/인기 공개 API는 37곡으로 private 곡 미노출. 그러나 shared R2 latest/popular v112 각각 38곡에 private 곡 잔존 FAIL. PREVIEW 일반 latest 첫 접근은 D1 R2/W0 관측; warm 진단 latest와 popular는 R0/W0.
- 코드 원인 후보: `043-publication-targeted-r2-hotpath.mjs`의 실제 `syncExploreFeedR2Private043` 호출 경로에 `059-shared-feed-r2-parity.mjs`가 감싼 구형 `syncExploreFeedR2Private017` 공유 mirror가 연결되지 않음. 064 catch-up은 `syncDerivedCache032` 실행 시에만 동작.
- **이번 곡은 비공개 유지. 테스트를 위해 다시 공개시키지 않는다.** 배포/원본 데이터 수정/전체 feed 또는 catalog 재생성 금지.

### Codex 다음 구현 명령(High, preview 코드만)
1. 043 비공개 경로에서 local Feed R2 targeted mutation 이후 shared latest/popular v112까지 동일 곡이 제거되도록 단일 변경 연결을 설계한다. 가능한 기존 `mirrorExploreSharedFeeds059` 및 CAS/동시성 보호를 재사용하며 새로운 전체 D1 조회·전체 Feed rebuild를 넣지 않는다.
2. 이미 private가 된 곡의 shared snapshots만 대상으로 하는 idempotent bounded repair 경로를 설계하고, 실사용 원본 데이터 변경 없이 복구 전후 값 비교/안전 중단 조건을 정의한다. 복구 실행은 별도 검증·승인 경계로 둔다.
3. 043/059/064 연동과 TEST/PRODUCTION 공유 소비자 호환성을 감사한다. 공개/비공개/옵션 등 실제 호출마다 누락 경로가 없는지 확인한다.
4. 현재 PREVIEW 첫 latest 요청 D1 R2의 원인이 캐시 cold/invalidation인지 확인한다. 정상 재진입 R0 유지가 조건이다.
5. 검증: 특정 private 곡이 local, shared latest/popular, catalog에서 모두 미노출; 같은 곡 재공개 시에만 복원; 공개/비공개 요청당 D1 W1~W2 실제 측정; unrelated objects unchanged. 38 전체 rebuild 금지.
6. TypeScript/Build/관련 Test 성공 → commit → Work 독립 감사. 배포는 사용자 요청 없이는 실행하지 않는다.
7. 감사 PASS 뒤에만 PREVIEW 배포 요청/진행. READ/FIRST_PUBLISHER flags OFF 유지. TEST/PRODUCTION 승격 불가.

## 현재 게이트
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- live private D1/R2 catalog PASS, shared Feed FAIL.
- W1~W2 요청당 증명 아직 불가.
- 과거 완료 synthetic test PASS가 이번 실사용 FAIL을 덮어쓰지 않음.

최종 갱신: 2026-09-19 KST — 사용자의 양방향 동작 이후 D1 변경 기록 0개 관측, 실사용 W1~W2 검증 보류

## 최우선 다음 작업
- TEMP 132 Run `35449664860`: 14:23Z 이후 tracks/stats 변경 0개, like queue 0, shared latest 38, first-page R0/W0. 실사용 mutation 후보 0개로 W1~W2/실제 catalog delta 미검증.
- TEMP 133 Run `35449712958`: 마지막 tracks 변경 2026-09-18T13:02:05.205Z, 마지막 stats 변경 2026-09-18T10:49:28.148Z. 밀리초 timestamp 확인.
- 실제 비공개→공개를 동일 페이지에서 원복하면 page-exit outbox가 원상태로 합쳐질 수 있음. 좋아요→해제도 30초 idle 안에서는 net-zero 가능.
- 다음은 **비공개 단일 동작 → Music Note 페이지 이탈 → D1/R2 사후 점검**. 그 결과를 확인한 뒤 별도 재공개. 좋아요도 별도 동작/전송/지연 처리 후 해제.
- 요청별 D1 W1~W2는 사후 DB만으로 입증 불가능하므로 관리자 진단의 해당 요청 메트릭 또는 실제 응답 헤더 확인 필요.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF 유지. 무단 배포/재구축/사용자 원본 변환 금지.

최종 갱신: 2026-09-19 KST — PREVIEW catalog WRITE staged ON + synthetic targeted delta PASS / live authenticated mutation 검증 전

## 현재 고정 기준
- PREVIEW product baseline: `ba723fb817aa2de99cf28821d85c48b4261455b8`
- staged WRITE release trigger: `380b147125ee1cebc4f897fd7b4588784e69801c`
- PREVIEW Worker Release Run: `35448197594` SUCCESS
- active PREVIEW Worker: `4f8471e3-576f-49de-9f2c-c3863021bf3d`
- canonical 068 Worker SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`
- catalog bootstrap Run: `35447123476` SUCCESS
- staged delta validation Run: `35448560216` SUCCESS
- app version: 124
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged
- Firebase unchanged

## 현재 derived R2 / flags 상태
- public tracks baseline: 38
- owners: 3
- shared profiles: 3/3
- shared track-card: 38/38
- exact catalog objects: **432**
  - meta 38
  - latest 38
  - popular 38
  - profile 38
  - genre 21
  - title 250
  - artistMeta 3
  - artistName 3
  - artistHandle 3
- `SORIDRAW_R2_CATALOG_V1`: **ON**
- `SORIDRAW_R2_CATALOG_READ_V1`: OFF
- `SORIDRAW_R2_FIRST_PUBLISHER_V1`: OFF
- latest/popular first page: D1 R0/W0

## staged write 검증 결과
Run `35448560216`:
- 066/068 live integration contract PASS.
- synthetic publish: 해당 track marker 8개 + meta만 추가.
- same-state republish: changed=false.
- like count change: popular marker 1 remove + 1 add.
- private: 해당 track marker 8개만 제거, tombstone meta 유지.
- republish: 해당 track marker 8개만 복구.
- artist create: name/handle 2 + meta.
- artist nickname/handle edit: 2 remove + 2 add.
- cleanup 후 catalog exact baseline **432**.
- latest/popular first page D1 R0/W0.
- canonical D1 write 0.
- user origin data change false.
- TEST/PRODUCTION/Firebase unchanged.

## 다음 실제 작업

### A. live authenticated mutation parity — PREVIEW only
현재 남은 핵심 검증이다. 실제 로그인 사용자 행동을 통해 Worker의 canonical D1 mutation과 catalog delta가 함께 맞는지 확인한다.

권장 최소 세트:
1. 기존 공개곡 1개를 private.
2. 같은 곡을 republish.
3. 기존 공개곡 좋아요 1회.
4. 같은 곡 좋아요 해제 1회.
5. 프로필 nickname/handle edit는 실제 값 훼손 없이 안전하게 원복할 수 있을 때만 수행.

각 행동마다:
- D1 rows_written = **W1~W2만 PASS**.
- W3+ 즉시 FAIL.
- 전체 Feed/profile/catalog scan/rebuild 0.
- catalog 전체 432 재생성 금지.
- 변경된 track/profile marker만 이동.
- latest/popular first page R0/W0 보호.
- PC/모바일 공유 결과 수렴 확인.

### B. live mutation postflight
- private 후 해당 곡 catalog public marker 제거 확인.
- republish 후 해당 곡 marker 복구 확인.
- like/unlike 후 popular marker만 필요한 순위 위치로 이동 확인.
- profile edit 후 artist name/handle marker만 이동 확인.
- canonical D1과 shared R2/card/feed count parity 확인.
- 사용자 원본 데이터 의미 변경 없음 또는 테스트 전 상태로 정확히 원복.

### C. catalog READ cutover
A/B가 PASS해도 자동 진행 금지. 별도 사용자 승인 필요.
- `SORIDRAW_R2_CATALOG_READ_V1=1` 검토.
- title search / genre browse / artist nickname / handle search.
- Explore/profile deep-page.
- first page는 기존 안정 경로 보호.
- warm revisit D1 R0/W0.
- legacy fallback/rollback 유지.

### D. 이후 별도 승인
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` ON.
- shared canonical D1 partial-index/trigger Phase D.
- 둘 다 별도 승인 없이는 실행 금지.

## 금지
- catalog READ flag 조기 ON.
- first-publisher flag 조기 ON.
- 432 catalog 전체 rebuild.
- shared canonical D1 migration/index/trigger/user-row rewrite.
- 무단 사용자 데이터 변경.
- Firebase 재배포.
- TEST 승격.
- PRODUCTION 승격.

## CURRENT GATE — Stage403 글로벌 패턴에 기반한 최소 복구형 알림 / Stage404 물리비용 확인 (2026-10-09 KST)

- 실무 근거 `DOCS/RTDB_GLOBAL_PATTERN_DECISION_403_2026-10-09.md`. AWS 공식 outbox/CDC, Cloudflare DO 영속/alarm, Firebase 좁은 구독 공식 가이드와 실제 069/075 소스 대조.
- **1순위 P0:** 069/075 실제 membership 변경만 정확히 같은 D1 batch 안에 남기는 *typed outbox*의 최소 안전 SQL을 **isolated Miniflare**에서 비교. 임의 schema 변경·LIVE outbox INSERT 금지. 기존 399/400 RETURNING만 R+3~+7/+3~+5 W+0까지 확인; 새 영속 기록 W 측정 전 W1~W2 합격 주장 금지.
- 비용 측정 시 실제 index/trigger/069+075 동일 곡 충돌/queue flush/rollback 포함하고 사용자 행동 단위 전·후 `rows_written` 및 DO/RTDB 총비용을 구분. W3+면 FAIL STOP하고 사용자에게 가능한 대안(일반 track invalidation, 선별적 재검증 등) 설명.
- DB commit→R2 정착→server-only publisher→도착 ACK 후 체크포인트 영속화 순서를 보호. post-send crash replay는 eventId+revision 멱등성으로 대응하고, journal-only like 발행/037 예측값/191 첫 40곡으로 증명 대체 금지.
- 구형 RTDB 글로벌 수신·클라이언트 쓰기는 서비스 보호상 바로 막지 않고 비용/보안 병행 설계 및 실기기 확인 후 Rules 마지막 적용. 앱382 좋아요·팔로우/Studio 저장·Music Note/30초 W1/PC↔모바일/레거시 사용자 데이터 하위 호환 동결.
- Stage403은 `scripts/verify-403-global-notification-model.mjs` 순수 시뮬레이션과 CI/문서만 추가, 제품 파일·데이터·Worker·Functions·Rules·Hosting/TEST/PRODUCTION 변경/배포 없음. TypeScript/Build/실비용/실기기 미검증.

---

## CURRENT GATE — Stage402 journal-only FAIL, Stage403 dual-queue confirmed + retry P0 (2026-10-09 KST)

- **기준** `DOCS/RTDB_JOURNAL_ONLY_TRUST_GAP_402_2026-10-09.md`. 격리 [Run 37824899801](https://github.com/andrawing1212/soridraw-music/actions/runs/37824899801) 성공. Stage402 10/10 안전성 반례/실패 모형 PASS, 제품 서버 발행 **아직 FAIL/BLOCKED**.
- 기존 `explore_derived_changes(feed,track,id,seq)` 단독으로 좋아요/제목 변경 구분 불가; seq가 곡별 마지막 값으로 덮여 변경 원인 소실; D1 확정 ≠ R2 공개 카드 정착; cursor-before-publish 누락·publish-before-checkpoint 중복. journal-only 방식 반복 금지.
- 다음 단일 P0 후보는 **실제 069와 075 canonical batch commit 결과**를 함께 포착하고, 오류/죽음 후 복구 가능한 bounded notification-only 영속 pending을 확보하는 최소 구조. 기존 399/400 시험상 RETURNING은 새 D1 쓰기 0, aggregate D1 read 증가는 069 +3~+7, 075 +3~+5이므로 현행 실비용 + Worker 정확한 generated bundle과 현재 LIVE trigger/binding 조건 검증 전 적용 금지.
- 구체 실패 구간: DB batch 성공→DO 이벤트 저장 전 중단, R2 아직 이전 수치/실패, Firebase Functions HMAC/replay/idempotency, 50곡+ 분할·같은 곡 상쇄, 구형 RTDB legacy 2중 신호 비용. 이들 하나라도 잃으면 알림 누락/비용 폭증이므로 **실제 배포·Rules 잠금 금지**.
- 제품 동결: app382/기존 좋아요/팔로우 30초, 개인 하트·타계정 숫자, W1 접수, 페이지 재진입 R0, Studio Music Note 정상 기능. TEST/PRODUCTION/main/공유 D1 migration·데이터 변경 사용자 승인 없이 하지 않는다. 실서비스 Worker/Functions/RTDB 코드 적용·배포 전 별도 독립 검증.
- 사용자에게 기능 W1~W2와 충돌하는 추가 D1 writes, 비용 감당 불가/구버전 호환 불가가 확인되면 구현 중단해 비용 근거·대안을 보고. 비검증은 PASS 표시 금지.

---

## CURRENT GATE — Stage401 기존 변경 저널 활용 가능성 PASS, likes-only/재전송 차단 (2026-10-09 KST)

- 최우선 근거 `DOCS/RTDB_EXISTING_DERIVED_JOURNAL_401_2026-10-09.md`. 격리 CI [37823762282](https://github.com/andrawing1212/soridraw-music/actions/runs/37823762282) 성공. 기존 398/399/400 PASS 유지; Stage401 단순화 D1 저널 경로 6/6, 동일 곡 최신 값 병합, 67곡 50+17 bounded paging PASS.
- 신규 실험 코드 `scripts/verify-401-existing-derived-journal.mjs`는 런타임에 import되지 않으며 운영 D1/Worker와 분리됨. `explore_derived_changes(feed,track,id,seq)` 기존 trigger journal을 읽는 SELECT는 모형 R1/W0, **mutation 추가 쓰기 0 가능성**을 보였으나 실서비스 완성 아님.
- 다음 **P0**: live schema의 032 derived triggers/seq index (read-only)와 Worker current bundle 정확성 확인, 변경 저널의 *좋아요 외 곡 변화* 구분 방법을 신규 DB W 없이 격리 검증, 같은 곡 다중 변경/커서 역전/50개 초과/실패 후 durable notification-only replay 안전성 확인. **불확실 신호는 발행 금지, 정상 바뀐 곡 누락도 금지.**
- 069/075 저장 전에 예상한 `changedRows`를 확정 이벤트로 쓰지 않는다. 191 first-page repair도 신뢰 이벤트 원본 금지. Worker→Functions HMAC/idempotency/R2 settle ordering/RTDB V2 scope 및 구형 legacy 이중 발행 비용은 후속 분리 검증; 현재 배포/Rules 변경 금지.
- 전체 좋아요 동기화 기능·팔로우·Music Note·Studio 하트·30초 W1 queue 기존 정상 보호. 10만 회원 fanout/실시간 비용 및 LIVE D1 W1~W2, TypeScript/Build/PC↔모바일 미검증. FAIL/STOP 시 사용자 보고하고 공유 데이터·main/TEST/PRODUCTION 변경하지 않음.

---

## CURRENT GATE — Stage400 069/075 격리 검증 PASS / 실제 알림 구현 STOP (2026-10-09 KST)

- 최신 시험 `DOCS/RTDB_069_075_ISOLATED_GATE_400_2026-10-09.md` 필독. 격리 CI Run `37822533579` SUCCESS. 기존 398 4/4 + 399 8/8 + 신규 400 075 5/5 + source guard/race 재현 PASS.
- 075은 queue cursor 갱신 전 `changedRows`를 별도 SELECT하므로, **저장 전에 계산한 곡 ID를 서버 RTDB 게시 확정 근거로 사용 금지**. 069은 현재 canonical membership batch 반환값이 건수뿐이라 곡 ID 누락. 069/075 모두 커버하는 단일 safe result source가 필요.
- Miniflare 모델의 RETURNING 추가는 background D1 writes 0 증가, reads 075 +3~+5 / 039/040 +3~+7 증가. 실제 deployed Worker bundle, LIVE D1, 10만 유저 RTDB 전송 비용을 아직 증명하지 못함.
- 다음 단계 P0: 변경곡 실제 membership commit ID 확인(069/075 모두), 중복·순서·batch 경계·상쇄·실패 시 알림 누락 대응, 비용 상한 증명. 필요하면 기존 397 fail-closed 추출기를 재사용하되, 서버 발행과 retry가 실제 정착보다 앞서면 안 됨.
- 구현이 W1 intake, 기존 반영시간/PC↔모바일/타계정 공개 likeCount, 구버전 호환, D1 W1~W2 예산 또는 읽기 0 재방문을 해치면 즉시 FAIL/STOP. Worker→Firebase server-auth/idempotency/durable notification-only retry 불증명 시 Functions/Rules/V2 client 전환 금지.
- Stage400은 코드 테스트·Workflow·문서만 변경. 공유 사용자 데이터/Rules/Worker/Functions/Hosting/main/production 변경·배포 없음. 앱382 TypeScript/Build/실기기 LIVE 비용 검증 전. `diagnose-069-live-like.yml`의 push 실패는 별개이며 성공 상태로 간주하지 않는다.

---

## CURRENT GATE — 069/075 서버 확정 변경곡 결합 P0 / 실사용 비용 검사 대기 (2026-10-08 KST)

- `DOCS/RTDB_FULL_AGGREGATE_COST_399_2026-10-08.md` 필독. 격리 Miniflare 399 8/8 PASS run `37744086289`: patch039/040 배경 정산 후보 `RETURNING`은 쓰기 증분 0, 읽기 +3~+7. 접수 사용자 진단 R0/W1은 별도.
- 실제 GitHub current generated Worker `handleLikeBatch034`는 069 queue 사용. 075 `changedRows` projection이 존재하지만 별도 경로이므로 **075만 연결하면 실제 069 좋아요가 빠진다.**
- 구현 P0: **069+075 모두** 서버 aggregate 후 신뢰할 수 있는 변경곡 알림을 생성하는 방식부터 결정. 039/040 RETURNING 직접 연결은 R+3~+7 비용 게이트와 프로젝션 순서·타계정·구형 클라이언트 보호를 통과한 경우만 사용. 첫 페이지 191 repair / 접수 ACK를 신뢰 이벤트로 사용 금지.
- 이후 feature-OFF Firebase Functions server-auth publisher + replay/idempotency, V2 제한구독/비용/구버전 legacy 호환 감사 → 마지막 단계 규칙 차단. 공유 데이터·Rules 임의 수정 불허, 사용자 실사용 확인 없는 배포 금지.
- Stage 399 테스트 GitHub Actions는 SUCCESS. app382 앱 UI/TypeScript/Build/PC·모바일 실사용 시험은 변화 없음/미검증.

---

## CURRENT GATE — Stage A-398 격리 D1 계측 PASS, 실제 전체 Worker W1~W2는 미검증 (2026-10-08 KST)

- 첫 실제 Miniflare D1 테스트는 `.github/workflows/verify-398-isolated-d1.yml` 자동 Run **37741253004 SUCCESS**, GitHub 소스 commit `d20fb8407b35871fb70e18746af5c8d91b4b6435`. 데이터베이스 2개 모두 LOCAL/격리. `scripts/verify-398-miniflare-d1-returning.mjs` 4/4 PASS.
- 실제 LOCAL D1 meta: 새 좋아요 old R1 W3 / RETURNING R2 W3, 중복 old R1 W1 / new R2 W1, 해제 old R2 W2 / new R3 W2, 중복해제 old R1 W1 / new R2 W1. 즉 **RETURNING마다 R+1, W+0**. 기존 W3은 축약형 membership+queue 모델의 측정이므로 실제 Worker 물리 W3로 확정 금지. 상세 `DOCS/RTDB_LOCAL_D1_COST_PROBE_398_2026-10-08.md`.
- Full patch039/040 CTE 토폴로지 기반 Node22 SQLite 격리 8-case baseline/candidate 결과 일치 PASS. **이 8-case는 D1 meta를 측정한 것은 아님**.
- **다음 High 구현:** frozen/현재 Worker canonical generated aggregate 실제 파일과 현재 실배포 Worker 동일 여부, 035/066/069/075/157·trigger/index·R2 현황부터 조사. 그 후 격리 Miniflare에서 실제 전체 CTE+queue/stat/index 구조로 `meta.rows_read/rows_written` 계측. 이 작업에서는 remote D1·공유 사용자 데이터 호출 금지.
- 이 전체 비용 게이트 PASS 전 서버 신뢰 RTDB publisher/Functions/Rules/client fanout 변경 금지. 변경 대상 UI 없음. 기존 app382/팔로우/개인 하트/실사용 PC/모바일 정상 기능 보호. Stage A live 적용/비용 절감 완성 아님.
- 기존 TEST/PRODUCTION/배포/RTDB/Cloudflare 변경 없음. 이번 GitHub Actions 테스트는 새로운 격리 검증만 수행.

---

## CURRENT GATE — 코드 프로토타입 12/12 PASS / D1·서버 발행 실제 검증 대기 (2026-10-08 KST)

- 새 런타임 비연결 순수 모듈 `cloudflare/explore-worker/runtime/like-confirmed-event-397.mjs`: 기존 patch040 batch에 미래 `RETURNING track_id`가 포함되면 meta.changes와 행 수를 대조하여 모든 changedTrackId를 50곡 이내에서 중복제거. 결과 누락·위조·초과는 fail-closed. GitHub commit `216fdb1202f4d533761c10abf929850cacb2a738`. 아직 Worker import/실제 발행 없음.
- 검증 `scripts/verify-rtdb-public-like-aggregate-extract-397.mjs` 8/8 PASS + `scripts/verify-rtdb-public-like-returning-prototype.mjs` 4/4 PASS, 총 12/12 Node22 로컬 격리 환경에서 PASS. TypeScript·Build·Worker 통합·D1 실제 row 메타 검증 미실행.
- **다음 구현 게이트:** 실제 patch040 canonical wave에서 `RETURNING track_id`을 추가한 *격리 실행* 및 D1 `meta.rows_read/rows_written`, retry/동시성, W1~W2 예산을 확인한다. 체크 PASS 전에 queue SQL, 배포, 공유 RTDB Rules 변경 금지.
- 서버 공개 신호는 canonical 정착 이후만 발행. Worker→Functions 인증·보안·idempotent delivery, 서버 전용 원장/재시도, 구버전 호환 RTDB legacy+V2 비용까지 검증이 필요. UI/Studio 하트/팔로우/개인 하트 untouched.
- 원본 공유 데이터/Worker/Functions/RTDB/Hosting/TEST/PRODUCTION 변경 없음. 위험 게이트 미해결이므로 실사용 개선 완료 아님.

---

## CURRENT GATE — 단계 A 안전한 서버 알림 구현 / D1 실측 게이트 (2026-10-08 KST)

- 이번에 실행 가능한 코드 프로토타입 추가: `scripts/verify-rtdb-public-like-returning-prototype.mjs` (GitHub commit `8caedb742ed0a5812fde0b44d8544a78d80b772f`). Node22 in-memory SQLite 4/4 PASS; D1/Worker 실제 실행, TypeScript/Build/앱 테스트는 미실행. `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md`의 단계 A 결과 확인.
- 기존 Worker 040 aggregator는 INSERT/DELETE 성공 건수만 리턴. 현재 모든 실제 변경 `trackId`는 수신 가능하게 반환되지 않음. 첫 화면 상위 80곡 R2 repair를 이벤트 검출기로 재사용하면 누락되므로 금지.
- 다음 개발 실증: **격리 D1 또는 로컬 D1 런타임에서 기존 batch SQL에 `RETURNING track_id` 적용 시 모든 곡(신규/오래된 곡·중복/순서 뒤집힘 포함)·D1 `rows_read/rows_written` 정확 확인**. W1~W2 hard gate. 변경곡 IDs가 기본 결과에 포함되지 않거나 D1 읽기 비용 증가가 무제한이면 STOP 후 별도 설계.
- 이후 서버 신뢰 연결: Cloudflare canonical 최종 aggregate 시점(클라이언트 선 ACK X)에 bounded event 생성, Firebase Functions Admin RTDB로 서버 인증된 발행, 분실/중복 알림 전용 재시도. 사용자 데이터·D1 mutation 반복 금지. Server-to-server HMAC 및 replay-proof, legacy-v2 동시 안전 검증. 이 조건 충족 전 새 Rules/Worker/Firebase Functions 배포·클라이언트 전역 방송 차단 금지.
- **아직 해결되지 않음:** 실제 active publicSync/exploreLike 쓰기 개방 상태, 모든 Explore 사용자 전역 다운로드, 클릭 후 30초 미만 닫기 개인 서버 미전송 문제. 비용 절감/남용 차단·동기화 정상화 완료라고 주장 금지.
- TEST/PRODUCTION/main 및 공유 데이터 변경 없음. Codex High 구현→Work 독립 검증→ChatGPT 최종 판정→PREVIEW 사용자 실사용 순서.

---

## CURRENT GATE — RTDB 공개 좋아요 설계 완료 / 구현 가능성 검증 단계 A (2026-10-08 KST)

- 새 확정 설계 문서: `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md`. 실행 순서 고정: A 서버 ACK 기반 신뢰 가능한 게시·중복/실패 설계 → B 화면 필요 곡 범위 V2 구독 방식 비교 및 계측 → C 기존 앱 서버 호환 보장 후 일반 클라이언트 전역 쓰기 차단 → D 독립 검증/실사용/승격. **규칙 선차단 및 앱 전체 방송 즉시 제거 금지**.
- **새 P0 구현 차단선:** `preview-entry.js`의 `repairSharedPublicLikeCounts191`는 latest/popular 앞 40곡씩 최대 80곡만 검사하는 복구 경로다. 이것을 새 신뢰된 RTDB 알림의 변경곡 추출 소스로 사용하면 다른 곡을 누락하므로 금지. `publicSignalAcceptedAt` 단독으로 개별 곡의 canonical 정착을 인증하지 못함. 기존 069 큐의 **실제 변경곡/확정 op ID**와 생성 파이프라인을 확인하고, 추가 D1 scan/write 없이 안전한 게시가 가능한지 검증해야 단계 A 구현 가능.
- 사용자 제공 Firebase Console 활성 RTDB rules 전체 텍스트의 publicSync/exploreLike 구간이 GitHub `database.rules.json`과 일치함을 확인. 로그인한 사용자가 actorUid 일치 조건만으로 global 알림을 쓸 수 있는 **구조적 남용 위험 확인**, 실제 악용 여부 미확인. 이전 private GET은 401이고 전체 live rule byte match는 미검증.
- Codex High / 다음 작업자는 먼저 `cloudflare/explore-worker/canonical/preview-entry.js` W1/DO 정착 flow + `functions/src/index.ts` Admin RTDB publisher 기존 기능을 읽고 **추가 D1 R/W 없이 서버가 어떤 accepted changed-row를 안전하게 받는지, Cloudflare→Functions 인증/서명, replay/중복, durable retry, 호출/RTDB 비용**을 증명·보고한다. 해당 신뢰 경계가 성립하기 전 서버/Rules/클라이언트를 동시에 수정하지 않는다.
- 정상 app382 30초 W1, 개인 좋아요 PC↔모바일/타계정 공개 숫자, app164 신규 곡, Studio 저장하트, 팔로우 30초 보호. 공유 데이터·TEST/PRODUCTION 비변경.
- 완료한 것은 **GitHub 문서 설계만**; TypeScript/Build/실기기/RTDB 비용 회귀는 아직 미실행. 코드를 수정/배포했다고 보고 금지.

---

## CURRENT GATE — RTDB live rules GET 검증 실패 (2026-10-08 KST)

- PRIVATE ops read-only run 37736055786: Google 인증 PASS, RTDB 규칙 조회 HTTP 401 FAIL.
- READ-ONLY 대조는 미완료. 관리자/쓰기 권한을 추가하지 않는다.
- 소스 기준 publicSync/exploreLike fanout 보안 설계 감사 진행. 실제 Rules는 Firebase Console에서 별도 확인.
- 신규 RTDB Viewer 역할은 원본 데이터 읽기 범위가 넓을 수 있으므로 회수 권장. Monitoring Viewer는 유지.
- 배포/앱/사용자 데이터 변경 없음. 순서: fanout 비용 및 남용 방지 → 30초 창 종료 복구 → 통합 검증.

---

## CURRENT GATE — RTDB 운영 Security Rules GET 전용 검사 최초 실행 대기 (2026-10-08 KST)

- 사용자 `Firebase Realtime Database Viewer` 역할 추가 완료 보고. PRIVATE ops/main workflow `.github/workflows/firebase-rtdb-live-rules-readonly.yml` commit `0802c763ab3b1d4e4b7e39bd33d9d3c9740e7701` 설치 완료.
- 비공개 Actions > `SORIDRAW RTDB Live Rules Readonly` > Run workflow (main). READ-ONLY OAuth/GET `/.settings/rules.json` + pinned GitHub `database.rules.json` 비교. **LIVE 실행 미검증**; HTTP 403이면 최소 권한 재검토, Admin/Editor 추가 요구 금지. 실제 기존 Rules 변경 금지.
- 후속: publicSync/exploreLike 소스 위험이 LIVE에서도 존재하는지 확인한 뒤 팬아웃·남용 제한 설계/구버전 안전성 감사. 기존 app382·Worker·공유 원본 보호. 비용 실측 PRIVATE ops baseline 37734211971 유지.

---

## CURRENT GATE — RTDB 공개 좋아요 팬아웃·보안 LIVE 규칙 검증 필요 (2026-10-08 KST)

- 2차 read-only 정적 감사 보고 `DOCS/RTDB_PUBLIC_LIKE_FANOUT_AUDIT_2026-10-08.md` 우선 확인. publicSync/exploreLike 전역 onValue, 50곡/3분 retention, source rules auth actor만 확인, live 적용 Rules 아직 미검증.
- 가장 먼저 해야 할 일: WIF PRIVATE ops 전용 읽기 권한으로 RTDB live 규칙 GET 가능 여부 확인(사용자 권한 부여 전 기존 Monitoring Viewer는 변경 권한 없음), 정확한 배포 rules/git diff 정리. 실제 데이터 수집/수정·보안 규칙 PUT 금지.
- 다음: 전역 이벤트 server-ACK 인증, 해당 곡/샤드만 bounded 수신, 구형 client 및 앱382 396/192 안정 동작 공존과 비용 전가 없는 설계. 가짜 신호 emulator 테스트, 물리 RTDB 바이트 및 R2/Worker 실측.
- NORMAL 앱382 좋아요·팔로우/스튜디오 heart 보호. docs-only 범위이며 배포 없음; TEST/PRODUCTION 승격 승인 없음.

---

## CURRENT GATE — RTDB LIVE metrics 첫 측정 PASS / 공개 like fanout 집중 감사 (2026-10-08 KST)

- 비공개 운영 진단 37734211971 성공. 실제 24h/30d 다운로드와 활성 연결/응답 횟수 측정 완료. 원본 실측 요약(비공개): `andrawing1212/soridraw-ops-private/reports/2026-10-08-rtdb-baseline.md`.
- **다음 목표:** `publicSync/exploreLike` 공통 onValue 구독자당 전달되는 수신량과 인증 클라이언트 임의쓰기 위험을 코드/실측 근거로 평가. 10만 사용자 확장 가정 명시. 사용자 데이터 직접 변경 없이 필요한 최소 계측 설계.
- 합격 전 금지: 공개 숫자 수렴/개인 하트/팔로우 동기화를 깨는 RTDB Rules 선적용, D1 조회로 전가, TEST/PRODUCTION 비승인 변경.
- READ-ONLY Monitoring 결과가 실청구액 혹은 10만 사용자 위험 해소를 보장하지 않는다. 앱382 정상기능 보호하며 상세 순서 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md 참고.

---

## CURRENT GATE — private RTDB read-only workflow 최초 실행 대기 (2026-10-08 KST)

- PRIVATE repo andrawing1212/soridraw-ops-private/main 생성·연결 확인, Google Cloud WIF + Monitoring Viewer 사용자가 설정. private ops workflow .github/workflows/firebase-rtdb-metrics-readonly.yml 추가 commit 5fa5036e3577067422a9fcaa1fead44c8e139e60.
- **지금 할 일:** 비공개 저장소 Actions에서 SORIDRAW Firebase RTDB Metrics (Private Readonly) 수동 실행. PRIVATE run 결과를 읽어 WIF IAM/Monitoring API/24h+30d sent_bytes_count 확인. 오류 시 이 진단만 수정. Cloud Monitoring 실측 없이는 비용 합격 판정 금지.
- RTDB code/rules/데이터·앱·Worker·Hosting·Functions·TEST/PRODUCTION 미변경. README/개발·정식 앱에 운영 사용량 로그 공개 금지. 전체 순서는 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md 유지.

---

## CURRENT GATE — 비공개 RTDB Monitoring 읽기 연결 사용자 설정 대기 (2026-10-08 KST)

- 공개 GitHub repo에 Firebase 운영 수치를 노출하지 않도록 PRIVATE 운영 repo + Google WIF + Monitoring Viewer 설계.
- 준비 파일: DOCS/PRIVATE_FIREBASE_METRICS_SETUP.md, DOCS/TEMPLATES/firebase-rtdb-metrics-readonly.yml, scripts/audit-firebase-rtdb-metrics-readonly.py. 테스트 후 commit SHA를 workflow placeholder에 채우고 비공개 repo에 설치.
- 사용자는 private repo 생성·GitHub 연결/Google IAM 권한만 부여. 이 단계 배포 및 앱 코드/공유 데이터/보안 규칙 수정 없음. Live 24h/30d RTDB 계측 미완료.
- 이후 순서는 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md의 1→2→3→4 그대로.

---

## CURRENT GATE — RTDB 10만 회원 비용·남용 안전 감사, 순서 1 진행 중 (2026-10-08 KST)

- **현재 최우선 작업:** 새 채팅에서도 DOCS/RTDB_SCALE_COST_SECURITY_AUDIT_2026-10-08.md를 먼저 읽는다. 순서 1 RTDB 사용량/실제 Rules/구독자 수 감사 → 순서 2 공개 좋아요 fanout 및 남용 차단 → 순서 3 30초 창 종료/타기기 미전송 복구 → 순서 4 통합 PC·모바일·비용 검증. 건너뛰지 않는다.
- **이미 확인:** GitHub source 기준 publicSync/exploreLike는 Explore 전체 구독자에게 최신 최대 50곡 변경 묶음을 전달. database.rules.json은 로그인 actorUid 같으면 전역 경로 쓰기 허용(실제 적용 Rules는 미검증). 좋아요·팔로우 개인 신호는 서버 30초 묶음 확정 뒤 발행되며 송신 기기 조기 종료 시 다른 기기의 인지가 불가능할 수 있다. 정상 app382 기능 보호.
- **미검증/차단:** Firebase Usage 실제 24h/30d 다운로드/동시 연결, LIVE 적용 RTDB Rules, 생산 환경 구성, 실기기 재현 및 10만명 예측의 실제 입력값. 해당 실측 없이 금액/안전 최종 PASS 선언 금지.
- **이번 작업 유형:** 정적 감사 및 영구 문서만 수정. 코드/Rules/배포/공유 데이터/main/production 미변경. 현재 PREVIEW app382 배포 유지.
- **다음 실행:** Firebase RTDB Usage/Profiler 측정 가능 여부 확인, 활성 Rules와 GitHub database.rules.json READ-ONLY 비교, 일상/좋아요/팔로우/백그라운드 재구독의 실제 KB·fanout 샘플. 이후 설계/비용 비교에서 정상 공개숫자/본인 하트/PC·모바일 동기화/D1 W1~W2 보호.

---

## CURRENT GATE — app382 PREVIEW 배포 SUCCESS, 좋아요 알림 중복 Worker 실기기 검증 (2026-10-08 KST)

- **사용자 지시:** ChatGPT가 기본 구현자. 안전한 수정 요청은 검사 통과 시 **PREVIEW 배포까지 자동 진행**. Codex는 사용자가 요청하거나 실제 구현이 막힐 때만 사용. TEST/PRODUCTION 승격은 기존 명시 승인 필요.
- **현재 실제 PREVIEW:** app382 Hosting exact build PASS, Firebase Run 37722012753 SUCCESS, 승인된 코드 SHA 6c5fa3fdb3f898b62fffacbba54e7bd63013f95a, trigger 178e72c51effbd867ea6f6e45f5df9370723a31f. 기존 Worker c4c51b19-818a-4eaf-8be1-aca0b241d50a 유지; Worker 재배포·D1·RTDB Rules·Functions·TEST·PRODUCTION 변경 없음.
- **수정 내용:** 공개 좋아요 알림 3분 동안 이전 settled 카드 신호를 새로고침마다 Worker에서 재요청하던 문제를 계정별/기기별 기한 제한 ACK로 억제. 새로운 좋아요/미해결 알림·PC↔모바일 정상 흐름 보존. CACHE LIVE 상세 요청 경로를 한글 표시, 내부 카운터 경로는 변경 없음. 별도 app381 UI 변경은 제외.
- **검사:** focused Run 37721869633 SUCCESS, TypeScript/Build/396 new-signal safety/한글 label/기존 like/follow freeze 회귀 PASS. Hosting PREVIEW_APP_VERSION=382, PREVIEW_EXACT_BUILD=PASS, SHARED_RTDB_RULES_DEPLOY=SKIPPED 및 TEST/PROD 비변경 PASS.
- **다음 실사용:** 이미 확인된 좋아요 알림이 존재한 상태에서 새로고침 2~3회: 공개곡 좋아요 숫자 확인 Worker 추가 0, 실제 새 좋아요 이벤트는 갱신 정상, 변경 없음 D1 행 R0/W0. PC·모바일 좋아요 숫자/팔로우 W1·30초 묶음 유지. 실기기 미측정 결과를 PASS로 오인하지 않는다.
- TEST 승격 전 .deploy/release-worker-runtime.mjs 의 follow-only 환경에서 불필요한 receipt390 필수 preflight 문제는 별도 확인. TEST/PRODUCTION 코드 승격 임의 실행 금지.
- 세부 최신 상태 DOCS/CURRENT_RELEASE_STATE.md 0RZQ 참조.

---
## CURRENT GATE — app380 PREVIEW 배포 성공, 실제 PC·모바일 및 비용 검증 대기 (2026-10-08 KST)

- 기본 작업자 ChatGPT. Codex는 사용자 명시 요청 또는 직접 구현이 실제로 막힐 때만 활용.
- 사용자 승인 PREVIEW app380 Worker+Hosting **배포 성공**. Worker Run `37719453033` SUCCESS (new version `c4c51b19-818a-4eaf-8be1-aca0b241d50a`), Firebase Hosting Run `37719570071` SUCCESS (`preview.soridraw.com` exact app-version=380/build PASS).
- 제품 source `b767b9cd3dbaba067e1d9df77fb703d1fe7cfae2`. 두 release trigger commit 외 소스 수정 없이 배포. 앱380에 app381 별도 UI hotfix·좋아요 receipt390/098 미포함.
- Firebase Rules/Functions, shared D1 schema/cutover, user data, TEST/PRODUCTION 승격 변경 없음. TEST/PRODUCTION Worker/Hosting 비변경 확인.
- **바로 다음 사용자 검증:** PC↔모바일 같은 계정으로 팔로우→해제, 30초 이내 net-zero, 30초 뒤 최종상태 반영, 새로고침/페이지 이동/다른 기기 숫자·목록, 좋아요/해제 W1 보호, CACHE LIVE D1 R/W 및 R2 비용. 결과 기록 후 비정상 때만 최소 수정/rollback 판단. 실사용 물리 비용은 아직 미검증.
- **중단 조건:** 팔로우 W3+, 좋아요 W1/상태 이상, app379 UI 회귀, 다른 기기 수렴 실패가 확인되면 TEST 논의 중단. app381 Recent UI는 별도 저장.
- TEST/PRODUCTION용 `.deploy/release-worker-runtime.mjs`의 unconditional receipt390 readiness는 별도 preflight blocker. TEST 승격 전 검증하고 최소 범위만 수정할 것. 사용자의 TEST 승인 전 main 변경 금지.
- 세부 데이터 및 GitHub release 기록은 `DOCS/CURRENT_RELEASE_STATE.md` 최상단 0RZN 참조.

---
## CURRENT NEXT GATE — app380 팔로우 전용 PREVIEW 사용자 배포 승인 대기 (2026-10-08 KST)

- **ChatGPT가 직접 구현**. Codex는 요청 시/정말 막혔을 때만 사용. GitHub 현재 상태는 `DOCS/CURRENT_RELEASE_STATE.md` 0RZM 참조.
- **현재 배포 아님**. 마지막 실제 PREVIEW app379, 소스 후보는 **app380**(app379 UI/좋아요 frozen, 팔로우 30초 최종상태 + Worker 097 점진 제한).
- 버전381 Recent/split UI fix는 commit `79374d59f7f9d251ef73a15089d4040288fde2bb`에 보존하고 app380에서 제외. 신규 좋아요 098/receipt390/65 global queue도 완전 제외.
- 집중 PASS commit `25b84ebec75a754fcde7647b4084ec819e2df820`, CI Run `37719123137` **SUCCESS**: TypeScript/Build/394/395/303/354/355/356/377/386/387/389-follow-only. 이후 문서만 commit; 배포 SHA는 실제 최신 preview HEAD를 다시 고정.
- **승인 전 금지**: preview Hosting/Worker 실배포·shared D1 migration/schema/cutover/사용자 데이터 변경, TEST/PRODUCTION 변경·승격. 문서 commit은 배포 승인 아님.
- **다음 작업 정확한 순서:** 사용자 PREVIEW 배포 명시 승인 → Worker 097-only 실 read-only preflight/변경 전 active version snapshot → Worker PREVIEW 배포/실 smoke → 정상 확인 후 Firebase PREVIEW Hosting app380(공유 RTDB Rules/Functions 변경 0) → 앱/Worker exact version과 likes/follow 비용, PC/mobile, R2 상태·cache 확인. 하나라도 실패하면 중단/복구 후 보고.
- **남은 위험/미검증:** 새 버전 실제 R2 get/put, physical D1 W1~W2, PC/mobile 동기화, 429/503, 브라우저 업그레이드, PREVIEW Worker+Hosting live release 게이트 미실행. TEST/PRODUCTION runtime의 receipt390 필수 preflight는 나중에 별도 고쳐야 함. app381 UX hotfix는 이번 릴리스에 없음.
- 사용자 지시: 중요한 작업은 완료 내용·미완료·정확한 다음 작업을 보고하고 **배포는 승인 받아 수행**.

---
## CURRENT NEXT GATE — ChatGPT 직접 작업: 팔로우-only PREVIEW 배포 전 읽기 전용 최종 확인 (2026-10-08 KST)

- **사용자 최신 운영 지시**: 기본 개발·수정자는 ChatGPT. Codex는 사용자가 직접 요청하거나 ChatGPT가 실제로 구현에 막혔을 때만 사용. 이전 'Codex High' handoff는 현재 작업의 실행 지시로 사용하지 않음.
- 실제 배포는 app379. follow-only candidate 코드/검사 PASS commit `2bf0eac515947f126b26da0739907bf739c81b59`, focused CI `37718020848` SUCCESS. 추가 preview Worker release YAML 분기 commit `dfe531f676b6cbdf476634c1ab1e7a0f66f2b41b`는 실배포 미검증. 현재 최신 HEAD/기록은 CURRENT_RELEASE_STATE 0RZL 참조.
- scope: 기존 app379 좋아요 클라이언트/Worker 원본 복원, 097 팔로우 보호 + 30초 최종상태 묶음; 098/receipt390/65건 replay/새 D1 schema **전부 릴리스 제외**. app381 별도 Recent UI 변경은 혼입 금지, Hosting 포함 시 사전 보고.
- 다음 단계는 배포 자체가 아니라 먼저 **읽기 전용** PREVIEW release gate 검증: canonical SHA/config env, 097-only Worker, 098/390 비포함, 기존 receipt390 조건부 preflight shell의 안전성, Cloudflare 실제 Worker/R2 binding·overlay 현재 authority 변경 없음, 사용자 데이터/TEST/PRODUCTION 비변경, 캐시 업그레이드 영향.
- live R2/D1 물리 비용/실기기 PC↔모바일/Preview 배포 결과는 아직 미검증. 격리 테스트 PASS를 실제 배포 PASS라고 표시하지 않는다.
- 새로운 구조 설계, shared D1 migration/cutover, 데이터 대량변경, Firebase/Worker/Hosting 배포는 이번 읽기 전용 단계 범위 아님. 승인 전 배포 금지.
- 확인 후 **검증 결과, PREVIEW 배포 범위(Worker/Hosting/UI 버전), 예상 위험, 최소 실사용 테스트**를 사용자에게 보고하고 승인 요청. 작업이 막히면 원인 보고 후 사용자 동의 없이 Codex 전환 금지.

---
## CURRENT FOCUSED TASK — app380 범위 정상화: app379 보호 + 팔로우 최소 방어만 분리 (2026-10-08 KST, 사용자 직접 지시)

### 우선 결정 / STOP
- 사용자 원래 목적은 **이미 정상인 좋아요를 유지**하고, 팔로우의 클릭 즉시 화면 반응은 그대로 두되 마지막 클릭 기준 30초 묶음/악의적 반복 요청만 서버 앞에서 제한하는 것이다. 추가 좋아요 아키텍처 연구가 아니다.
- **app380 receipt390, 098 like guard, like-replay-379 전역 65건 조회, 새 좋아요 D1 schema, W2 intake 구조는 이번 릴리스 범위에서 제외/동결.** 소스 기록은 삭제할 필요 없지만 어떠한 릴리스 대상에도 섞이면 안 된다. 현재 preview HEAD의 release-patches.json/canonical Worker에 097+098이 들어 있으므로 **098만 manifest에서 제거하거나 current canonical Worker를 그대로 배포하는 행위 금지**.
- **정상 배포본 PREVIEW app379가 제품·비용 보호 기준.** 마지막 확인 source HEAD `3e768eb2150d1fc5f51637ff9ff096ba6a5f3619`는 미배포된 복합 후보이고, 반드시 현재 실제 배포된 app379 Worker/Hosting artifact와 구별한다.
- 완료 목표는 범용 고가용성 재설계가 아니라 **팔로우 전용 최소 패치 한 건**. 구현 불가/안전 격리 불가 시 즉시 중단하고 기술적 원인 + 최소 대안을 보고. 대규모 구조 재설계, 무한 테스트 반복 금지.
- **공유 D1 schema/cutover, 실제 사용자 데이터, main/TEST/PRODUCTION, Worker/Hosting/Firebase/Cloudflare 배포 변경 금지**. 공유 D1 변경이 반드시 필요하면 이 작업에서 실행하지 않고 사전 보고/별도 승인.
- 사용자는 매 단계 **완료 결과 + 다음 정확한 작업과 영향/승인 요청**을 요구한다. 자동 릴리스 활성화 금지.

### 고정 기준과 비교 출발점
- branch preview; 범위 확정 기준 HEAD: `3e768eb2150d1fc5f51637ff9ff096ba6a5f3619`.
- app380 Codex handoff 직전 preview SHA `365e41f06c8ff169a3b762dd527498f6813d335f`에는 이미 팔로우 30초 묶음 후보가 존재하고, 좋아요 새 receipt390/098은 없었다. 비교의 출발점으로만 사용한다. 코드 승격이나 브랜치 rollback은 임의로 하지 않는다.
- `src/services/exploreFollowBatchService380.ts`의 30초 sliding final-state, 동일 baseline 복귀 W0, durable outbox/리로드/페이지 이동 시 강제 flush 0을 가능한 한 재사용.
- `cloudflare/explore-worker/patches/097-follow-abuse-guard.mjs`의 팔로우 반복 제한은 후보로만 취급. 기존 Cloudflare/native limiter·현재 Worker의 운영 정책을 먼저 확인하고 과잉 차단/R2 반복 쓰기 위험이 없는 **최소 차이**만 허용.
- 실제 사용자가 제시한 CACHE LIVE 표시는 좋아요/해제 쿼리 D1 R0/W1 및 팔로우/해제 이번 실행 쓰기 W1 사례. 전체 물리 비용 합격의 증거로 과장하지 말고 해당 행 수치/동작 보호.
- app379/app377의 like·follow 개인 membership/공개 count/팔로워 목록·팔로잉 목록/동일계정 PC↔모바일 동기화, Music Note/Library, UI/CSS, app381 별도 recent/split UI 수정은 작업 대상이 아니다.

### Codex High의 단 하나 구현 범위
1. 배포된 app379 baseline과 `365e41`, current HEAD를 비교해 팔로우 기능만 독립 배포 가능한 **최소 변경 파일** 및 source/manifest/hash 결합을 식별. 불필요하게 380/390 전체 기능을 다시 설계하지 않는다.
2. 기존 정상 app379에 팔로우 30초 최종상태 묶음 + 기기 즉시 UI 유지, 서버 악용 방어를 **추가 D1 조회/쓰기 없이** 격리한다. 동일 사용자/대상에 대한 정상 반복 요청은 30초 동안 최종상태만 서버에 도달; 원점 복귀는 요청 0; 반복 악용은 점진적 cooldown/시간당 또는 일일 상한으로 D1 전에 제한. 제한 규칙은 기존 380 후보에서 실사용 정상 범위에 맞춰 보수적으로 선택하고, 실제 필요하지 않은 신규 인프라·악용 기록 무한 저장은 금지.
3. 이미 존재하는 097 팔로우 방어 기능을 사용할 경우 098, receipt390, 65건 legacy replay SQL 등 **좋아요 기능이 절대 배포 묶음에 포함되지 않음**을 canonical Worker byte/source 및 release manifest로 증명. 필요한 경우 검증용 후보 생성 방식만 최소 수정. 소스 안전 격리가 어렵다면 변경을 멈추고 보고.
4. 429/503 및 네트워크 장애에서 정상 팔로우 outbox·마지막 선택을 잃지 않고, navigation/idle 재시도 폭주가 없도록 기존 380 검증 범위만 유지. 기존 W1~W2 팔로우 비용이 W3+로 증가하거나 좋아요 W1이 바뀌면 FAIL.
5. **제품 코드 변경은 preview에만, 최소 patch로.** 정상 좋아요 클라이언트/Worker/cache/D1/schema/receipt path는 수정 금지. app381 UI와 기타 기능은 분리 유지.

### 합격선 / 테스트
- app379 좋아요·해제 W1 구조/30초 outbox/net-zero/local-first/PC↔모바일, 기존 app164/app160 관련 회귀 PASS. 새 receipt390/098이 릴리스 대상에 없는지 검사.
- 팔로우: 1회, 해제, 30초 안에 follow→unfollow=W0, 빠른 연속 클릭 마지막 선택 1번, 리로드/다른 페이지/기기 동기화, 오래된 ACK 후 새 클릭, 429/503 오류·복구, 악의적 반복 D1 R0/W0. 팔로워·팔로잉 count 및 목록 보존.
- 실제 비용: 확인 가능한 격리 시험으로 follow/unfollow physical W1~W2, net-zero W0, abuse reject D1 R0/W0; 무변경 페이지 진입 R0/W0 목표. 원격 실측이 없으면 ‘미실측’, 거짓 PASS 금지.
- TypeScript, Build, focused like/follow Test PASS, Worker baseline/patch idempotence/hash, 기존 main/production 비변경 확인.
- Work 독립 감사 전 release PASS 아님. **Codex는 배포 절대 금지**. branch/base SHA/final SHA/변경 파일/검사 결과/남은 위험을 보고.
- 작업이 복잡해져 receipt390·새 DB 인덱스·공유 schema/cutover/대량 데이터 수정을 요구하면 즉시 중단하고 ChatGPT/사용자에게 사전 승인 요청.

---
## CURRENT NEXT GATE — 0RZE old/new Worker mixed replay 독립 재감사 (2026-10-08 KST)

- preview의 0RZE 수정 commit 대상: 034167367 Work FAIL의 receipt-less old Worker newer unlike 재현과 예방을 확인한다.
- 실제 frozen Worker 040/073 enqueue + app379 클라이언트 replay, newer unlike 우선, outbox 종료, personal/public 재발행 0, canonical read W0, 069 time PK LIMIT 65 overflow 시 typed 503, rows_read 추가량을 독립 검증한다. 035/066 혼재·과밀 사용자 영향도 FAIL 판정에 포함한다.
- 392/393, 388 --release, 기타 like/follow 회귀, TypeScript/Build 및 canonical Worker hash/idempotence 확인. **실제 shared D1 apply·Worker/Hosting 배포·main/TEST/PRODUCTION 변경 금지**. Work PASS 전 배포 금지.

## CURRENT NEXT GATE — 두 blocker 구현 commit의 Work 독립 재감사 (2026-10-08 KST)

- 기준: 아래 두 blocker 구현을 완료한 **0RZD를 포함하는 preview commit**. 시작 HEAD는 `37a7f3e299ebb3d4232a1276817f2490698c96d0`.
- `CURRENT_RELEASE_STATE.md` 최상단 0RZD를 먼저 읽는다. 실제 PREVIEW는 app379이며 배포/실제 shared schema apply는 아직 0.
- actual app379 replay verifier `392`, receipt390 exact activation verifier `393`, 097→098 canonical registration/hash/env wiring, 새 legacy read의 indexed bound/과금 미측정 범위를 독립 감사한다.
- 특히 receipt를 상태 authority로 사용하지 않는지, old/new client replay 재발행 0/최신 intent 보존, partial failure 시 새 empty dormant 객체만 정리하고 populated/active proof는 보존하는지 확인한다.
- schema→Worker→Hosting을 직렬로 진행해야 한다. 구 TEST/PRODUCTION Worker의 receipt 없는 pending queue와 PREVIEW의 혼재는 아직 live gate이며 source fixture PASS를 실기기 PASS로 과장하지 않는다.
- app380 W2/W0 receipt/ACK core와 app381 UI는 재설계하지 않는다. 이미 PASS한 TypeScript/Build/app303을 이유 없이 반복하지 않는다.
- 독립 감사/배포 판단 전 **배포 금지, shared D1 실제 apply 금지, main/TEST/PRODUCTION 변경 금지**.

## COMPLETED FOCUSED TASK — app380 release blocker 2개만 해결: app379 replay 호환 + receipt390 활성화 경로 완성 (2026-10-08 KST)

기준:
- branch: `preview`
- base HEAD: `b15d7d88deb17ab76b247799ed4fd5a6b12c88b4`
- 실제 PREVIEW: app379.
- app380 W2/W0 receipt/ACK core와 app381 UI는 이미 검증된 부분을 재설계하지 않는다.
- 목표는 Work 감사에서 발견한 **두 blocker만** 해결하고 source/release wiring을 commit하는 것.
- **배포 금지. shared D1 실제 apply 금지. main/TEST/PRODUCTION 변경 금지.**

### A. app379 exact replay compatibility — 최우선

문제:
- replay response에 legacy `data.results`가 없어 app379 exact client가 error/outbox retryCount=1로 정지한다.
- old desired를 그대로 legacy success로 반환하면 app379가 이를 새 ACK로 보고 RTDB/public invalidation을 다시 발행해 stale intent가 최신 기기 상태를 덮을 수 있다.

필수 계약:
1. **actual app379 source `aa1bac7636651fdf94598f0d5ef502955a60bc0f`의 `exploreLikeService.ts` 동작을 fixture로 실행**한다. 문자열 추측 verifier 금지.
2. exact receipt replay는 canonical D1 write **W0**를 유지한다.
3. app379은 replay 뒤 해당 old operation outbox를 안전하게 종료해야 한다.
4. app379 replay 처리에서 personal RTDB publish 0, public invalidation publish 0, 오래된 operation이 newer local intent/revision/device state를 덮지 않음을 증명한다.
5. app381 receipt-aware ordering contract는 그대로 유지한다.
6. receipt/R2 abuse state에서 membership/count/revision 합성 금지.
7. legacy compatibility에 canonical state가 필요하면 기존 indexed/bounded per-track authority read만 허용. full scan 금지. replay batch <=50.
8. 권장 방향: replay 응답에 app379이 파싱 가능한 `results`를 추가하되, legacy client가 fresh accepted signal로 재발행하지 않는 기존 non-publish status path(`revision-conflict` 또는 동등한 frozen path)를 사용한다. queue pending / canonical applied / newer revision 세 경우를 따로 검증한다. exact state 결정은 receipt가 아니라 canonical authority/queue state를 사용한다.
9. legacy direct per-track endpoint refresh-required 보호는 유지하되 지원 중인 app379 batch client가 깨지면 FAIL.

필수 mixed tests:
- app379 first acceptance normal.
- app379 ACK-loss exact replay -> outbox cleared, W0, personal/public republish 0.
- app379 replay while accepted queue still pending.
- app379 replay after canonical applied.
- app379 replay after another device newer revision/state.
- app379 replay while same device has newer explicit undo.
- app381 same cases ordering unchanged.
- app379/app381 simultaneously on same account: newest intent wins.

### B. receipt390 schema/Worker activation wiring — 실제 배포 가능 source까지만

1. **generic additive D1 mode를 느슨하게 만들지 말 것.**
2. shared-D1 workflow에 receipt390 전용 exact mode를 추가한다. 허용 객체는 `explore_like_intake_receipts_390` table + `explore_like_receipt_insert_390` + `explore_like_receipt_update_390` triggers뿐이다.
3. INSERT/UPDATE/DELETE/backfill/user row rewrite 금지. reserved/canonical 기존 table redefine 금지. table/trigger SQL exact verification.
4. migration partial failure 시 partial object가 남지 않는 transaction/rollback proof. old Worker가 dormant schema를 전혀 사용하지 않음을 검증.
5. candidate SQL을 승인 가능한 migration source 위치로 승격하되 실제 release trigger 실행 금지.
6. canonical Worker build/release source에 097/098을 올바른 순서로 포함하고 canonical hash 갱신. release verifier PASS 후에만 manifest/source registration.
7. canonical environment configs에 PREVIEW=`preview`, TEST=`test`, PRODUCTION=`production`의 `SORIDRAW_ENVIRONMENT`를 명시적으로 고정.
8. 각 환경 release preflight에서 `PROFILE_MEDIA`와 `LIKE_RATE_LIMITER` binding 존재를 fail-closed 검증.
9. PREVIEW Worker release preflight는 receipt table+2 triggers 존재를 확인만 하고 자동 생성 금지.
10. Worker smoke 실패 시 이전 Worker로 rollback. additive receipt schema는 old Worker가 참조하지 않으므로 자동 DROP/delete 금지.
11. `.deploy/shared-d1-release.trigger`, `.deploy/preview-worker-release.trigger`, Hosting trigger를 이번 task에서 실행용 값으로 갱신 금지.

### C. 비용/기능 hard gate
- 새 normal like batch physical D1 W<=2.
- exact replay D1 writes W0.
- legacy replay compatibility read가 필요하면 bounded/indexed read 수치를 별도 보고. full scan 0.
- page entry/re-entry/navigation write0.
- abuse reject canonical D1 W0.
- 30초 final-state/net-zero W0 유지.
- follow380 behavior와 app381 UI 변경 금지.
- shared user data migration/backfill/delete/rewrite 0.

### D. 최종 검증
- new app379 exact replay verifier.
- app381 391 ordering.
- 387/388/389/390/391 및 `388 --release`.
- like 127/175/176/177/178/179/180/192/197.
- follow 377/378/379(385/386).
- shared-D1 receipt390 exact mode verifier.
- canonical Worker patch idempotence/source hash/syntax.
- PREVIEW/TEST/PRODUCTION environment/binding static verifier.
- TypeScript PASS / Build PASS / `git diff --check`.
- actual Cloudflare shared D1/Worker/Hosting mutation **0**.

### E. 완료 보고
- 기준 SHA / 최종 SHA.
- app379 replay blocker 해결 방식.
- app379 replay personal/public republish 0 증거.
- replay W0 및 compatibility bounded read 비용.
- receipt390 exact schema release mode와 partial-failure proof.
- canonical 097/098 inclusion과 hash.
- three env identity/binding preflight 결과.
- TypeScript/Build/Test.
- user data 변경 0 / deploy 0.
- 다음 Work 재감사에서 볼 정확한 commit.
## CURRENT NEXT GATE — app380+381 통합 source 독립 감사 후 PREVIEW 릴리스 판단 (2026-10-08 KST)

현재 기준:
- preview HEAD: `7bbe881378700407beaf3457f55d3f10f93c2f66`
- app380 완료 source: `7aa711af0f0f8577893298dd5d84ada4f7d857ce`
- app381 UI integration: `1857c346aa40f2f6dec0e6570d439d2514473f82`
- app381 state-doc commit 포함 현재 HEAD 기준으로 감사한다.
- 실제 PREVIEW는 app379 유지. 아직 배포하지 않는다.

다음 작업은 **구현이 아니라 독립 감사**다.
- app380 like/follow abuse guard, durable receipt, ACK ordering, activation ordering을 감사.
- app381 UI diff가 app380을 되돌리거나 Worker/D1/user-data 코드를 변경하지 않았는지 확인.
- app381 변경은 Explore exact Recent route + 기존 Lite geometry owner의 pre-paint 1회 reconciliation만 허용.
- TypeScript/Build/app303 verifier run 37686878661은 이미 PASS. 같은 검증을 의미 없이 반복하지 않는다.
- 감사 PASS 전 Worker/schema/Hosting 배포 금지.
- 감사에서 문제 발견 시 TEST/PRODUCTION은 물론 PREVIEW 활성화도 중단.

Work 감사 기준:
- `DOCS/WORK_AUDIT_CHECKLIST.md`
- `DOCS/CURRENT_RELEASE_STATE.md` 최상단 0RZB/0RZA
- app380 base `d25890f68e8acd15b8f619e5326d4bb5292a233c` → current HEAD diff
- 특히 shared D1 schema 실제 적용 0, default release patch manifest 미등록, R2 abuse state environment isolation, W2/W0 proof, old/new client compatibility, activation order rollback 가능성 확인.
- UI는 Recent/Music Note/Create round-trip과 Explore→Recent routing만 감사하며 split engine 리팩터링 금지.

PASS 후:
- ChatGPT가 정확한 활성화/배포 순서를 고정한다.
- 필요한 additive schema / Worker / Hosting만 canonical workflow로 PREVIEW에 배포한다.
- 실제 PREVIEW에서 app380 like/follow + app381 UI 3개 증상을 함께 검증한다.

## CURRENT FOCUSED TASK — app380 좋아요 정상 재시도 W0 + durable acceptance receipt 해결 (2026-10-08 KST)

기준:
- branch: `preview`
- base commit: `3ea51da5641e7c5bcf8668be6d9414d319a6964e`
- 현재 app380 candidate는 **배포 금지 상태**.
- `verify-388-social-abuse-runtime.mjs --release`가 정상 retry/idempotency blocker 때문에 의도적으로 FAIL하는 것이 현재 정확한 상태다.
- follow380 및 abuse 정책 전체를 다시 설계하지 말고, **좋아요의 성공 ACK 유실/동일 operation 재전송 계약만 좁혀서 해결**한다.

### 문제
현재 frozen W1 queue `explore_like_batches_069`는 batch ID에 server receive time이 들어가고 처리 후 row가 삭제된다.
따라서:
- 첫 요청이 실제 queue에 durable acceptance 되었지만 ACK가 유실된 경우,
- 같은 operation을 다시 보내면 새 queue row W1이 생길 수 있다.
반대로 R2 abuse receipt만 보고 성공 ACK를 합성하면 operational guard를 사용자/acceptance authority로 오용하게 된다.

### 결정
**W1을 억지로 유지하지 않는다. 정상 새 like batch의 interactive D1 합격선은 W2를 허용한다.**
- row 1: 기존 frozen queue acceptance
- row 1: bounded durable acceptance receipt
- 새 정상 batch: D1 W2
- 동일 accepted batch replay: D1 W0
- net-zero local batch: Worker/D1 W0
- W3+ 즉시 FAIL

이 선택은 사용자 고정 합격선 W1~W2 안이며, 정상 재시도 기능을 희생해 W1을 맞추는 것을 금지한다.

### 구현 후보 계약
1. **additive candidate schema만 작성. 실제 shared D1 apply 금지.**
   - 예: `explore_like_intake_receipts_390`.
   - user data/membership/count가 아니라 **queue acceptance proof 전용 operational table**.
   - 기존 `likes`, overlay, count, revision, R2 abuse state와 의미를 섞지 않는다.
2. storage가 사용자 행동 수만큼 무한히 증가하는 per-operation row 구조를 기본 답으로 채택하지 말 것.
   - 우선 **UID당 bounded receipt state 1 row** 후보를 검증한다.
   - 최근 accepted batch receipt IDs를 bounded ring/JSON 또는 동등한 bounded 표현으로 유지.
   - secondary index 없이 UID PK `WITHOUT ROWID` 우선.
3. receipt ID는 server receive time에 의존하지 않고 동일 HTTP retry에서 안정적이어야 한다.
   - 현재 client의 stable `operationId` + trackId + desired + expectedRevision + stable mutationAt를 정규화/정렬하여 deterministic batch digest를 만든다.
   - 같은 operationId를 다른 payload에 재사용하면 conflict/W0 fail-closed.
4. Worker intake는 **receipt update + queue insert를 하나의 D1 transaction/batch로 묶는다.**
   - receipt가 새로 기록된 경우에만 queue INSERT.
   - receipt가 이미 존재하면 queue INSERT 0, D1 W0.
   - queue INSERT/fence가 실패하면 receipt도 rollback되어 acceptance proof가 남으면 안 된다.
   - D1 `batch()` + `changes()` 또는 더 안전한 동등 원리가 실제 Cloudflare 격리 D1에서 성립하는지 먼저 측정하고, 성립하지 않으면 다른 W2 원리를 설계.
5. duplicate accepted replay 응답:
   - receipt는 **이 batch가 durable intake 됐다는 사실만** 증명.
   - receipt에서 canonical membership/likeCount를 만들지 않는다.
   - 기존 요청의 desired state를 acceptance replay로 돌려줄 수 있는지 client/app160/app164 ordering contract를 실행형 테스트로 검증.
   - newer local intent / newer revision / cross-device state를 오래된 replay가 덮으면 FAIL.
6. bounded storage:
   - UID receipt row가 정한 상한을 넘지 않게 한다.
   - receipt ring에서 오래된 entry가 사라져도 R2 abuse state를 성공 ACK authority로 쓰지 않는다.
   - 오래된 replay가 receipt proof를 잃은 경우 **새 canonical write를 만들지 않는 fail-closed W0 경로**를 설계하고 정상 사용자가 영구 잠기지 않는 복구 계약을 테스트한다.
7. 기존 30초 client batch, W1 queue processor, background aggregate, app164/app160 heart/cache/sync는 가능한 한 변경하지 않는다.
8. direct legacy like endpoint 차단의 기존 사용자/구버전 영향도 함께 감사. 정상 지원 버전이 refresh-required 때문에 깨지면 release FAIL.

### 반드시 실행할 검증
- 새 remote ephemeral Cloudflare D1에서 실제 `meta.rows_written`:
  - new accepted batch = W2 이하.
  - exact accepted replay = W0.
  - same receipt + payload conflict = W0 reject.
  - queue/fence failure = transaction rollback / receipt W0 남김 없음.
  - concurrent same receipt from 2 clients = queue 1회만.
- local/SQLite fixture만으로 Cloudflare billing PASS라고 보고 금지.
- 기존 like regressions 127/175/176/177/178/179/180/192/197 PASS.
- app377/378/379 follow regressions PASS.
- app380 387/388/389 PASS.
- `verify-388-social-abuse-runtime.mjs --release`가 blocker 제거 후에만 PASS.
- TypeScript PASS / Build PASS.
- page/navigation/unchanged revisit server write 0.
- product cache key/epoch 변경 0.
- shared user data migration/backfill/delete/rewrite 0.
- default release patch manifest 등록 0.
- Worker/Hosting/Functions/Rules 배포 0.
- main/TEST/PRODUCTION 변경 0.

### 중단 조건
- W2로도 안전한 durable replay proof를 만들 수 없으면 구조를 더 밀어붙이지 말고 FAIL 이유를 기록.
- W3+가 필요하면 구현/배포 중단 후 보고.
- app164/app160 좋아요 정상 기능 변경이 필요하면 중단 후 보고.
- shared schema actual apply나 환경 cutover가 필요해지는 순간 중단. 이번 task는 **candidate + isolated proof + commit까지만**.

### 완료 보고
- 기준 SHA / 최종 SHA
- 변경 파일
- acceptance receipt 구조와 bounded storage 설명
- isolated remote D1 W2/W0 실제 수치
- concurrent/rollback/replay 결과
- 기존 like/follow regression
- TypeScript/Build
- 배포 0 / 사용자 데이터 변경 0
- 남은 Work 독립 감사 및 PREVIEW live gate

## CURRENT IMPLEMENTATION TASK — app380 좋아요 + 팔로우 최종상태 묶음/악성 반복 방어 통합 (2026-10-07 KST)

사용자 승인:
- 좋아요와 팔로우 모두 정상 사용은 **로컬 즉시 반영 → 마지막 클릭 기준 30초 → 최종 상태만 서버 반영** 원칙으로 통일한다.
- 단, 좋아요와 팔로우의 정상 사용 빈도가 다르므로 서버 악성 반복 방어 임계값은 분리한다.
- 기존 정상 좋아요 기능(app164/app160 freeze), app379 follow count/list/sync, UI/반응형은 반드시 보호한다.
- 구현은 preview에서만 한다. Codex는 배포하지 않는다. 구현/검증 commit 고정 후 Work 독립 감사, 그 뒤 ChatGPT가 PREVIEW 배포 여부를 판단한다.

현재 기준:
- deployed PREVIEW: app379.
- preview HEAD at design handoff: `365e41f06c8ff169a3b762dd527498f6813d335f`.
- HEAD에는 follow380 후보가 있으나 **미배포**이며 `097-follow-abuse-guard.mjs`는 기본 Worker release patch 목록에서 의도적으로 제외돼 있다.
- follow380 후보의 30초 final-state batching / reload outbox / progressive guard를 재사용하되, 아래 통합 정책에 맞게 감사·수정한다.
- 좋아요는 이미 `EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000`, per-track durable outbox, net-zero 제거, W1 queue intake, Cloudflare `like:<uid>` 60/min edge limiter가 있다. 좋아요 client batching 자체를 새로 재작성하지 않는다.

### 1. 공통 정상 UX — 기능 보존
- 클릭 즉시 현재 기기 화면에 반영.
- 같은 대상의 여러 클릭은 마지막 클릭 기준 30초 sliding window로 합친다.
- 30초 뒤 **최종 상태 1회만** canonical mutation 후보가 된다.
- final == window 시작 canonical baseline이면 Worker/D1/R2 canonical mutation **0**.
- 같은 desired state 재요청/동일 operation replay는 idempotent W0.
- 페이지 이동/탭 이동/재진입 자체가 flush/write를 만들면 FAIL.
- 정상 cross-device sync는 canonical accepted state 뒤 기존 작은 RTDB signal 경로를 유지.
- rate-limit/abuse state는 public follower/likeCount 또는 사용자 원본 데이터의 authority가 아니다.

### 2. 팔로우 정책 — 저빈도/관계 스팸 방어를 강하게
기존 follow380 후보를 기준으로:
- local final-state window: 30초.
- same target alternating final-state 반복 단계:
  - 30초 → 2분 → 10분 → 1시간.
  - 24시간 조용하면 escalation reset.
- account-wide ordered mutation cap:
  - 10분 30회.
  - 24시간 120회.
- malformed/unordered 요청은 D1 전에 차단.
- same-state/duplicate는 canonical W0.
- 실제 accepted follow/unfollow는 physical D1 W1~W2 hard gate. W3+ FAIL.
- cooldown 응답은 Retry-After를 주고, client는 같은 pair의 최신 final intent 하나만 유지한다. 자동 busy-loop 금지.
- follower/following count/list, PC↔mobile no-navigation convergence, app378 R0 popup reopen, app379 exact count authority를 변경하지 않는다.

### 3. 좋아요 정책 — 정상 대량 탐색은 허용하되 같은 곡 토글 공격 차단
기존 좋아요 30초/W1 queue 구조는 freeze 보호하고 **Worker abuse gate만 additive**로 붙인다.
- fast edge limiter: 기존 `like:<uid>` 60 requests/min 유지. D1 rate-limit table 재도입 금지.
- same track alternating final-state escalation:
  - 30초 → 1분 → 5분 → 30분.
  - 6시간 조용하면 pair escalation reset.
- account-wide normalized final-mutation cap:
  - 10분 120개.
  - 24시간 600개.
- batch HTTP 횟수가 아니라 **정규화된 unique track final intents**를 cap에 반영한다.
- 동일 track 중복/같은 desired state/같은 operation replay는 canonical mutation W0.
- batch max 50 유지.
- abuse 거부는 canonical D1 전에 끝나야 한다.
- 정상 like/unlike, 개인 filled heart, public likeCount, My Likes, 신규 공개곡 app164 초기 판정, PC↔mobile app160/app164 경로는 변경 금지.
- 좋아요 1회 accepted path D1 rows_written W1~W2 hard gate; W3+ FAIL.

### 4. 악성 방어 상태 저장 — 사용자 원본과 완전 분리
- **D1에 rate/abuse receipt를 쓰지 않는다.**
- 기존 shared `PROFILE_MEDIA`를 사용하더라도 키에 환경을 반드시 포함:
  - `internal/explore/abuse/<environment>/follow/<uid>.json`
  - `internal/explore/abuse/<environment>/like/<uid>.json`
- environment는 `SORIDRAW_ENVIRONMENT || ENV_NAME`에서 fail-closed로 확정. PREVIEW 테스트가 TEST/PRODUCTION cooldown state에 영향을 주면 FAIL.
- follow/like counters와 pair history는 서로 다른 object/key. 서로 quota 공유 금지.
- object는 계정당 도메인별 1개 bounded state로 유지하고 pair history는 LRU/quiet prune로 상한을 둔다.
- concurrent PC/mobile mutation은 R2 ETag/conditional write 또는 동등한 optimistic concurrency로 lost-update를 막는다. bounded retry만 허용.
- abuse state는 파생 운영 상태이며 user data migration/backfill 대상이 아니다.
- shared canonical D1/Firestore user rows, profile media, feed/catalog 원본 의미 변경 0.

### 5. 거부/오류 처리
- `RATE_LIMITED`는 Worker가 canonical D1 전에 결정한 명확한 거부여야 한다.
- response에 Retry-After 또는 retryAfterMs를 제공.
- follow client는 현재 후보처럼 최신 pair final intent 1개만 유지하고 cooldown 종료 시 최대 1회 재시도. 새 클릭이 오면 다시 최종 상태로 합친다.
- like client는 기존 ambiguous network failure와 deterministic 429를 구분할 수 있게 최소한의 typed error/status 전달만 추가한다.
- 429 때문에 idle/navigation 자동 retry loop가 생기면 FAIL.
- 정상 네트워크 실패의 기존 outbox/idempotency/revision 보호는 변경하지 않는다.

### 6. 구현 범위
우선 확인/수정:
- `src/services/exploreFollowBatchService380.ts`
- `src/pages/ExplorePage.tsx`
- `src/services/exploreSocialService.ts`
- `src/services/exploreLikeService.ts` — 429 구분이 정말 필요할 때만 최소 수정
- `cloudflare/explore-worker/patches/097-follow-abuse-guard.mjs`
- 신규 like abuse Worker patch (번호 충돌 없는 다음 patch)
- 관련 verifier
- release-system audit verifier
- `DOCS/CURRENT_RELEASE_STATE.md`

금지:
- 좋아요 핵심 상태기 리팩터링.
- app164/app160 freeze 경로 재설계.
- follow overlay authority 롤백.
- shared user data migration/backfill/delete/rewrite.
- 전체 Feed/profile/likes/follows scan.
- UI 위치/색/반응형 변경.
- 기본 release patch manifest에 새 abuse patch를 조기 등록.
- Worker/Hosting/Functions/Rules 배포.
- main/TEST/PRODUCTION 변경.

### 7. 필수 검증
정적/fixture:
- TypeScript PASS.
- Vite Build PASS.
- 기존 app164/app160 like regressions PASS.
- app377/app378/app379 follow regressions PASS.
- follow 30초 final-state: follow→unfollow within window = server W0.
- like 30초 final-state: like→unlike within window = 기존 server W0 보호.
- same desired replay W0.
- progressive pair cooldown sequence 정확.
- account 10m/day cap 정확.
- malformed/unordered abuse request D1 R0/W0.
- guard state environment isolation.
- concurrent guard update lost-update 없음.
- guard R2 failure/limiter missing 정책이 fail-closed이며 D1 mutation 0.
- page/tab/navigation write 0.
- unchanged revisit D1 R0 target.

live PREVIEW는 구현+Work 감사 후 별도 단계:
- follow/unfollow actual W1~W2.
- like/unlike actual W1~W2.
- blocked abuse request D1 W0.
- PC↔mobile membership/count parity.
- Following popup reopen D1 R0.
- My Likes/Explore revisit D1 R0.
- TEST/PRODUCTION unchanged.

### 8. Codex 완료 보고 필수
- 작업 branch: preview
- 기준 commit
- 최종 commit SHA
- 변경 파일
- TypeScript / Build / Test
- 기존 like/follow freeze regression 결과
- D1/R2 예상 및 fixture 비용
- 배포 안 했음을 명시
- 사용자 데이터 변경 0 확인
- 남은 live PREVIEW 미검증 항목

## CURRENT NEXT GATE — app379 팔로워/팔로잉 상단 숫자 실기기 parity 확인

현재 완료:
- app379 PREVIEW 배포 완료: Run `37599728937` SUCCESS.
- `preview.soridraw.com` app379 exact build PASS.
- root cause: active overlay 이후 legacy follow counters는 freeze됐지만 app377/378이 mutation compatibility response의 stale counter를 profile cache authority로 사용.
- app379은 follow relation exact local cache/delta를 social count authority로 사용하고 stale legacy response가 상단 숫자를 0으로 덮지 못하게 차단.
- MY following: complete Following page 또는 complete follow bundle exact count 우선.
- MY follower: complete Followers page가 있으면 exact local self-heal; 자기 follow/unfollow 작업에서는 기존 값 보호.
- target follower: confirmed relation delta만 ±1.
- target following: 다른 사람이 follow/unfollow해도 불변.
- same-account PC↔mobile signal도 local exact relation count를 우선.
- profile edit/revalidation로 social count가 다시 덮이지 않도록 보호.
- 추가 Worker/D1/RTDB Rules/Functions 변경 0.
- 추가 server read/write 0.
- app378 Following popup reopen R0 경로 유지.
- TEST/PRODUCTION unchanged.

사용자 실기기 확인:
1. MY profile의 follower/following 현재 값 기록.
2. 다른 프로필 follow → 팝업을 열지 않고 바로 MY profile.
   - follower 불변
   - following +1
3. unfollow → 팝업을 열지 않고 바로 MY profile.
   - follower 불변
   - following -1
4. target profile:
   - follow 시 follower +1
   - unfollow 시 follower -1
   - target following은 전후 동일
5. PC에서 변경했을 때 mobile의 MY profile 숫자도 navigation/reload 없이 맞는지 확인.
6. 팔로잉/팔로워 팝업 목록 membership과 상단 count가 동일한지 확인.
7. popup reopen CACHE LIVE는 Worker0 / D1 R0 유지 확인.

합격 후:
- app379 PREVIEW follow count/list/sync gate 완료 처리.
- TEST 승격은 사용자 테스트배포 승인 전 금지.

실패 시:
- 어떤 숫자가 잘못됐는지 actor follower / actor following / target follower / target following을 분리해 해당 local authority만 수정.
- list 전체 재조회나 app update 강제 rehydrate 금지.
- W3+ mutation 또는 list reopen D1 read 재발 시 즉시 중단.

## CURRENT NEXT GATE — app378 실기기 Following 목록 R0 재검증

현재 완료:
- follow shared overlay active.
- 사용자 CACHE LIVE에서 follow/unfollow mutation W1~W2 범위 확인.
- PC↔mobile follow 실시간 동기화 PASS.
- 관계 변경 후 viewer Following 목록 persistent cache 전체 invalidation 때문에 다음 목록 확인이 D1 R2~R5 / row R11~R12 수준으로 cold read 되는 문제 확인.
- app378 PREVIEW 수정 및 배포 완료: Run `37596588786` SUCCESS.
- `preview.soridraw.com` app378 exact build PASS.
- app update는 product persistent cache를 지우지 않음.
- hydrated Following first page는 relation 1건만 local patch하고 compact target-card seed를 보존.
- RTDB signal / Rules / Worker / D1 schema / Functions / UI 변경 0.
- TEST / PRODUCTION unchanged PASS.

사용자 실기기 확인:
1. PC와 모바일 각각 app378 적용 확인.
2. 각 기기에서 자신의 팔로잉 목록을 한 번 열어 local first-page cache 확보.
   - 이전 app377 mutation이 cache를 이미 지운 기기는 이 최초 1회에만 bounded D1 read가 나올 수 있음.
3. 다른 프로필에서 follow/unfollow 1회 수행.
4. 다시 자신의 팔로잉 목록 열기.
5. 합격선:
   - 팔로잉 목록: `LOCAL 1 · Worker 0 · D1 R0/W0`.
   - follow/unfollow mutation: W1~W2 유지.
   - PC↔mobile no-navigation sync 유지.
6. 새로고침/앱 업데이트 후 unchanged list 재오픈도 R0 확인.
7. 위 조건 PASS 후 follow W1~W2 + list R0 작업 완료 처리.

실패 시:
- Following 목록 D1 read가 다시 나오면 어떤 동작 직후 cache가 사라졌는지 CACHE LIVE 요청명과 함께 좁혀서 해당 invalidation만 제거/patch.
- mutation W3+ 또는 관계/숫자 불일치가 생기면 즉시 중단.
- shared overlay legacy fallback 금지; backend authority 문제면 overlay-readonly fail-closed 사용.

금지:
- 전체 following/follower backfill.
- 앱 업데이트를 이유로 전체 관계 재조회.
- Worker/D1 schema/RTDB Rules 불필요 변경.
- 좋아요/publication/Music Note/Library/UI 변경.
- TEST/PRODUCTION 승격은 별도 사용자 승인 전 금지.

## CURRENT NEXT GATE — active follow overlay 실제 physical W1~W2 측정 + 실기기 parity

현재 완료:
- all-environment follow lifecycle=1 수렴 완료: Run `37592392310` SUCCESS.
- shared one-way D1 authority latch 완료.
- shared R2 follow manifest active 완료: Run `37592857479` SUCCESS.
- `relationMode=overlay348`, `writeMode=active`.
- activation 시 overlay user rows 0 / legacy user row rewrite 0.
- TEST/PRODUCTION Feed·curated·public-profile parity 및 Worker verify PASS.
- app377 Hosting/Functions/Rules/UI 변경 없음.

지금부터 새 구현보다 **실제 live mutation 검증이 우선**:
1. 실제 사용자 계정에서 follow 1회.
2. 충분히 안정화된 뒤 unfollow 1회.
3. duplicate/same-state 요청 확인.
4. Cloudflare physical D1 Rows Written을 요청 단위로 확인:
   - follow W1~W2 PASS
   - unfollow W1~W2 PASS
   - duplicate/same-state W0 PASS
   - W3+ 즉시 FAIL
5. 동시에 같은 계정 PC↔mobile에서:
   - following/follower 숫자 즉시 수렴
   - 실제 목록 membership 일치
   - 페이지 이동/새로고침 의존 없음
   - follower-save permission 정상
   - public profile parity 정상
6. unchanged popup/revisit/cache D1 R0 목표 확인.
7. 실패 시 legacy로 되돌리지 말고 shared manifest를 `overlay348-readonly`로 전환하여 새 mutation만 fail-closed. effective overlay reads는 유지.
8. live evidence PASS 전 follow 비용 작업 완료 선언 금지.

금지:
- legacy follows/profile_stats backfill/rewrite/foldback.
- 사용자 관계 전체 복제.
- W3+ 상태에서 계속 mutation.
- 좋아요/publication/Music Note/Library/UI 임의 변경.
- 이번 live 검증 때문에 Hosting/Functions/Rules를 다시 배포하지 않음.

## CURRENT NEXT GATE — follow W1~W2 shared authority cutover 승인 대기

현재 완료:
- shared D1 additive overlay348 schema 적용 완료.
- PREVIEW / TEST / PRODUCTION app377/follow378 compatibility line 완료.
- TEST Release Run `37584516018` SUCCESS.
- PRODUCTION Release Run `37585161258` SUCCESS / RELEASED.
- PRODUCTION Explore Worker `391c4d88-5186-480b-ae53-042bac301ce2`.
- PRODUCTION Media Worker `2c2e3236-d9a6-4771-b2ba-7baff496145c`.
- production commit `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- `soridraw.com` app377 exact TEST artifact clone verification PASS.
- shared user data migration/backfill/delete/rewrite/copy 0.
- follow lifecycle flag / D1 authority control activation / shared R2 active manifest 모두 OFF.
- 현재 사용자 follow relation은 기존 legacy authority를 계속 사용.

다음 단계는 shared follow authority의 실제 활성화이므로 별도 명확한 승인 전 실행 금지:
1. active PREVIEW/TEST/PRODUCTION Worker follow378 read-only readiness 재고정.
2. D1 `explore_follow_cutover_control_348`을 one-way latch 준비 상태로 arm.
3. 모든 환경 lifecycle gate compatibility를 동시에 보장.
4. shared R2 follow cutover manifest를 active overlay로 전환.
5. 실제 follow 1회 / unfollow 1회 / duplicate / same-state 측정.
6. physical D1 합격선:
   - follow W1~W2
   - unfollow W1~W2
   - duplicate / same-state W0
   - W3+ 즉시 FAIL
7. 기능 parity:
   - followerCount/followingCount
   - follower/following 실제 membership
   - PC↔mobile no-navigation convergence
   - follower-save permission
   - public-profile parity
   - unchanged revisit/cache path R0 목표
8. 이상 시 overlay-readonly로 새 mutation만 중지. effective overlay read authority는 유지하고 legacy fallback 금지.
9. full legacy foldback은 user-data migration이므로 별도 명확한 승인 없이는 금지.

절대 금지:
- shared cutover 승인 없이 D1 control/manifest activation.
- legacy follows/profile_stats backfill/rewrite/foldback.
- 좋아요/publication/Music Note/Library/UI 변경.
- W3+ 상태에서 계속 진행.

## CURRENT NEXT GATE — PRODUCTION app377/follow378 compatibility 승인 대기 / shared cutover OFF

완료:
- shared D1 overlay348 additive schema 적용 완료.
- PREVIEW follow378 rollback-safe Worker 배포 완료.
- TEST full promotion 완료: Release Controller Run `37584516018` SUCCESS.
- TEST source `9f51660d81746a619c185da845221b0888021020`.
- TEST_VERIFIED tag `soridraw-test-v377-9f51660d8174`.
- main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`.
- TEST Worker `a70593bb-2bc9-4a41-a05a-47332a4f7660`.
- TEST app377 / Feed / curated / public profile / Worker / media / Hosting parity PASS.
- PRODUCTION unchanged.
- shared follow cutover / lifecycle flag / active manifest / D1 control activation 모두 OFF.

다음 단계는 PRODUCTION 실제 변경이므로 사용자 명확한 승인 전 실행 금지:
1. TEST_VERIFIED manifest `soridraw-test-v377-9f51660d8174`를 source of truth로 사용.
2. production mode 고정 Release Controller preflight.
3. exact TEST_VERIFIED app377 tree/artifact를 PRODUCTION에 승격.
4. PRODUCTION Explore Worker가 follow378 rollback-safe authority + overlay-readonly fail-closed 계약 PASS인지 확인.
5. TEST↔PRODUCTION Feed/curated/public-profile/browser upgrade parity PASS.
6. Firebase Functions/Rules/shared user data migration은 수행하지 않음.
7. PRODUCTION compatibility 승격이 완전히 PASS한 뒤에도 follow overlay authority는 즉시 켜지 않음.
8. 별도 cutover 단계에서만:
   - D1 control one-way latch arm.
   - shared R2 active manifest.
   - 실제 follow / unfollow / duplicate / same-state billing 측정.
9. 비용 합격선:
   - follow W1~W2.
   - unfollow W1~W2.
   - duplicate / same-state W0.
   - W3+ 즉시 FAIL.
10. PC↔mobile count/list/membership, follower-save, public-profile parity를 함께 검증.

금지:
- 정식배포 명확한 승인 없이 production mode 실행.
- PRODUCTION follow378 준비 전 shared manifest activation.
- legacy follows/profile_stats user row rewrite/backfill/foldback.
- 좋아요/publication/Music Note/Library/UI 임의 변경.
- W3+ 상태에서 계속 진행.

## CURRENT NEXT GATE — follow378 all-environment compatibility 선행 / shared cutover 계속 OFF

현재 완료:
- shared D1 additive overlay348 schema 적용 완료: Run `37582930962` SUCCESS.
- PREVIEW rollback-safe follow378 Worker 배포 완료: Run `37583095947` SUCCESS.
- PREVIEW active Worker `cf78f8cb-a108-4362-a6e7-a0c90eff12a0`.
- TEST / PRODUCTION Worker unchanged.
- shared follow cutover / lifecycle flag / R2 active manifest / D1 control activation 모두 OFF.
- user data migration/backfill/delete/rewrite/copy 0.

새 필수 조건:
- PREVIEW / TEST / PRODUCTION은 shared canonical D1 + shared PROFILE_MEDIA를 사용하므로 follow relation authority도 하나의 shared truth여야 한다.
- 실제 overlay authority를 켜기 전에 TEST와 PRODUCTION active Worker도 follow378 rollback-safe reader/readonly fail-closed를 이해해야 한다.
- protocol354/355만으로는 normal active path는 호환되지만 manifest-loss emergency rollback safety가 부족하다.
- 따라서 현재 상태에서 PREVIEW-only manifest activation 금지.

다음 작업:
1. 현재 PREVIEW follow378 exact Worker source/환경 계약을 고정.
2. TEST compatibility 승격 시 앱/UI 변경 없이 동일 rollback-safe Worker contract가 유지되는지 dry-run + actual TEST Worker 검증.
3. TEST PASS 후에만 PRODUCTION Worker compatibility 승격을 별도 명확한 승인 대상으로 보고.
4. 세 active Worker 모두 follow378 lifecycle + overlay-readonly contract PASS 후:
   - D1 one-way latch guard/control activation.
   - shared R2 active manifest.
   - actual follow/unfollow W1~W2 live measurement.
5. 합격선은 follow W1~W2 / unfollow W1~W2 / duplicate·same-state W0.
6. PC↔mobile count/list/membership/follower-save/public-profile parity 동시 확인.

절대 금지:
- current TEST/PRODUCTION approval 없이 Worker 실제 배포.
- TEST/PRODUCTION이 follow378을 이해하기 전 shared manifest activation.
- environment-local follow authority로 shared user truth를 분리.
- legacy follows/profile_stats user data rewrite/backfill/foldback.
- W3+ 상태에서 진행.
- 좋아요/publication/Music Note/Library/UI 변경.

## CURRENT NEXT GATE — follow W1~W2 shared PREVIEW activation approval 대기

완료:
- app377 팔로우 숫자/목록/PC↔mobile 정합성 사용자 PASS.
- rollback-safe one-way authority lifecycle source 구현 완료.
- final source commit `7d0f9b38798e066b83f9842c8397866b761447bd`.
- final Audit Run `37579261599`: SUCCESS.
- TypeScript / Build / follow 347~378 / TEST+PRODUCTION Worker dry-run / active Worker protocol compatibility / live shared D1 SELECT-only preflight PASS.
- pre-cutover missing manifest D1 R0 PASS.
- healthy overlay manifest D1 latch R0 PASS.
- missing/corrupt manifest after activation → overlay-readonly recovery PASS.
- active/readonly → legacy downgrade/delete 차단 PASS.
- old Worker readonly-manifest fail-closed contract PASS.
- shared D1 write 0 / deployment 0.
- isolated remote physical proof remains follow W2 / unfollow W1 / duplicate W0 / same-state W0.

다음 단계는 실제 shared backend 변경이므로 사용자 승인 전 실행 금지:
1. candidate `348-follow-overlay.sql` additive schema만 shared canonical D1에 적용.
   - legacy rows rewrite/backfill/delete 금지.
   - schema/control/index/trigger only.
2. 적용 직후 SELECT-only로 exact object/phase=`legacy` 확인.
3. PREVIEW/TEST/PRODUCTION active Worker protocol354/355 + lifecycle compatibility 재확인.
4. lifecycle flag / one-way latch / manifest를 coordinated order로 준비하되 TEST/PRODUCTION 앱/Hosting/Worker 승격은 하지 않는다.
5. PREVIEW overlay authority 활성화 후 실제 follow 1회 / unfollow 1회 / duplicate / same-state physical D1 rows_written 측정.
6. 합격선:
   - follow W1~W2.
   - unfollow W1~W2.
   - duplicate/same-state W0.
   - W3+ 즉시 FAIL.
7. 동시에 app377 기능 parity:
   - follower/following count.
   - 실제 목록 membership.
   - PC↔mobile no-navigation sync.
   - follower-save permission.
   - public profile parity.
   - unchanged popup/cache R0.
8. 이상 시 overlay-readonly로 새 mutation만 중지하고 effective overlay reads는 유지. legacy fallback 금지.
9. PREVIEW 실사용 PASS 전 TEST 승격 금지.

절대 금지:
- 사용자 승인 없이 shared schema/cutover mutation.
- user data migration/backfill/delete/rewrite/copy.
- legacy follows/profile_stats 일괄 수정.
- 좋아요/publication/Music Note/Library/UI 수정.
- TEST/PRODUCTION 실제 배포.
- W3+ 상태에서 계속 진행.

## CURRENT NEXT GATE — follow W1~W2 rollback-safe authority lifecycle 구현 (PREVIEW source only)

현재 결론:
- app377 팔로우 기능 정합성은 사용자 PASS로 동결.
- all-environment active Worker protocol354/355 compatibility PASS.
- shared follow overlay 348 schema는 아직 ABSENT / shared cutover OFF.
- isolated physical D1 근거는 follow W2 / unfollow W1 / duplicate·same-state W0.
- **새 blocker:** overlay가 실제 edge를 변경한 뒤 R2 cutover manifest를 제거하면 현재 runtime은 legacy `follows`로 fallback하여 overlay 변경분을 무시할 수 있음.
- verifier `scripts/verify-378-follow-rollback-blocker.mjs` / Audit Run `37576098525`에서 UNSAFE_REPRODUCED.
- 따라서 실제 shared schema 적용/overlay 활성화/PREVIEW live mutation은 아직 금지.

이번 구현 목표:
1. **one-way effective authority lifecycle**을 PREVIEW source에만 추가한다.
   - pre-activation: 기존 legacy behavior 100% 동일.
   - active overlay: protocol354/355 effective reader/writer 사용.
   - emergency rollback: legacy로 돌아가지 않고 **overlay-readonly**로 전환하여 effective overlay reads는 유지하고 follow/unfollow mutation만 fail-closed.
2. 정상 동작 중 매 페이지/요청마다 새 D1 control read를 추가하지 않는다.
   - healthy R2 follow manifest가 정상 fast-path authority.
   - D1 `explore_follow_cutover_control_348`은 manifest missing/corrupt/ambiguous 같은 예외에서만 one-way latch/fallback으로 확인한다.
3. D1 control은 authority가 실제 overlay write 가능 상태까지 올라간 뒤 자동으로 `legacy`로 내려갈 수 없게 한다.
   - overlay → legacy 직접 복귀 금지.
   - rollback은 overlay-readonly 또는 동등한 fail-closed 상태만 허용.
4. **완전 legacy 복귀용 사용자 데이터 foldback/migration은 만들거나 실행하지 않는다.**
   - 필요 시 별도 사용자 승인 작업으로만 제안.
5. 구버전 client 호환:
   - pre-activation legacy one-request behavior 유지.
   - active overlay에서 bodyless/legacy request는 기존 `FOLLOW_ORDER_REQUIRED` → follow-state protocol354 negotiation 유지.
   - overlay-readonly에서는 legacy writer로 fallback 금지, 명확한 retriable 503/fail-closed.
6. app377의 `actorFollowingCount`, persistent follower/following page cache, changed-only invalidation, RTDB PC↔mobile signal을 변경하지 않는다.

필수 실행형 검증:
- baseline 0 + overlay follow 1 → emergency readonly/missing-manifest recovery에서도 effective=1.
- baseline 1 + overlay unfollow 0 → emergency readonly/missing-manifest recovery에서도 effective=0.
- readonly 상태에서 follow/unfollow D1 user-row write 0.
- once-active control이 overlay/readonly → legacy로 직접 하강하지 못함.
- malformed/missing manifest + one-way latch 존재 시 legacy fallback 금지.
- pre-activation manifest 없음 + latch 미활성은 기존 legacy path exact parity.
- healthy manifest normal path는 추가 steady-state D1 latch read 0.
- duplicate/same-state ordering / crash replay / R2 CAS / follower-save / social snapshot / public profile / connection list reader parity 유지.
- app377 response-only actor count + persistent list cache + cross-device sync 회귀 0.
- TypeScript / Build / follow 347~378 및 관련 기존 release regression PASS.

작업 범위:
- `cloudflare/explore-worker/canonical/preview-worker.js` follow authority/cutover reader·router 최소 수정.
- 필요 시 additive **candidate-only** control SQL/rollback specification 보강.
- 필요한 verifier 추가/수정.
- `DOCS/CURRENT_RELEASE_STATE.md` 결과 기록.
- UI/CSS/App 정상 경로 수정 금지.
- 좋아요/publication/Music Note/Library 수정 금지.

절대 금지:
- shared D1 schema apply.
- R2 active cutover manifest write.
- 실제 follow overlay activation.
- Worker/Hosting/Functions/Rules 배포.
- 사용자 데이터 migration/backfill/delete/rewrite/copy.
- main/production 수정.
- 정상 app377 기능을 비용 때문에 늦추거나 제거.

완료 판단:
- source + 실행형 verifier에서 rollback-safe lifecycle이 PASS하고 독립 감사 준비가 완료되면 commit 고정.
- 그 다음 Work 독립 감사 후에만 shared schema/cutover 영향과 실제 PREVIEW W1~W2 live 검증 승인 단계로 이동.
- W3+ 가능성, legacy fallback 가능성, count/membership/list/permission/public-profile 불일치가 하나라도 남으면 활성화 금지.

## CURRENT NEXT GATE — 팔로우 비용만 W14~W17 → W1~W2

사용자 확인:
- app377 숫자 / 실제 목록 / PC↔모바일 동기화 정상 적용 PASS.
- 기능 정합성 단계 종료. 지금부터 **팔로우 mutation 비용만** 수정.

현재 근거:
- dormant overlay 348 + ordered writer protocol354/355 구현/감사 완료 상태.
- isolated actual D1 evidence: follow W2 / unfollow W1 / duplicate W0 / same-state W0.
- app377 active PREVIEW Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- shared follow cutover OFF.

작업 순서:
1. PREVIEW/TEST/PRODUCTION active Worker가 protocol354/355 reader/writer 계약을 실제로 포함하는지 read-only 재고정.
2. shared D1에 overlay 348 schema가 현재 미적용인지/legacy인지 SELECT-only 확인.
3. cutover activation 전 rollback 절차와 구버전 앱 요청 negotiation을 다시 검증.
4. 사용자 데이터 backfill/rewrite 없이 additive schema + per-environment manifest만으로 안전한지 확인.
5. 안전 증명 PASS 후에만 PREVIEW 실제 overlay 비용 검증 단계로 이동.
6. 실제 PREVIEW follow/unfollow D1 rows_written W1~W2, duplicate/same-state W0 확인.
7. 동시에 app377 숫자/목록/PC↔모바일/follower-save/public-profile parity 재확인.

절대 합격선:
- follow/unfollow physical D1 W1~W2.
- W3+ 즉시 FAIL.
- 정상 기능 변화 0.
- 전체 relation/profile/feed rebuild 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.
- TEST/PRODUCTION 비의도 변경 0.
## CURRENT NEXT GATE — app377 PREVIEW 팔로우 숫자·목록·R0 실사용 검증

현재 배포 완료:
- `preview.soridraw.com` app377 exact build PASS.
- PREVIEW Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- Firebase PREVIEW Hosting Run `37569563139` SUCCESS.
- Cloudflare PREVIEW Worker Run `37569420282` SUCCESS.
- shared RTDB Rules exact-match deploy PASS; additive `userSync/$uid/exploreFollow` only.
- shared follow cutover는 여전히 OFF.
- TEST / PRODUCTION unchanged.

실사용 검증 순서:
1. PC와 모바일 모두 app377로 갱신.
2. MY프로필 `팔로잉`과 상대 프로필 `팔로워`를 각각 한 번 열어 현재 실제 relation 목록과 숫자가 맞는지 확인.
3. 첫 cold popup은 기존 bounded D1 R2 허용. 같은 목록을 닫고 다시 열거나 새로고침 후 다시 열 때 `팔로우 목록 캐시` LOCAL HIT / Worker0 / D1 R0인지 확인.
4. PC에서 follow/unfollow 후 모바일에서 페이지 이동·새로고침 없이 버튼과 숫자가 수렴하는지 확인. 모바일→PC도 동일 확인.
5. A→B follow 시 A following 목록에 B, B followers 목록에 A가 있고, unfollow 후 양쪽에서 사라지는지 확인.
6. 30명 이하 complete popup에서는 실제 relation row 수가 profile count를 즉시 self-heal하는지 확인.

판단:
- 숫자 / 목록 / 버튼 / PC↔모바일 수렴 + unchanged popup R0가 PASS하면 app377 정합성 단계 완료.
- relation 목록 자체가 틀리면 W1~W2 cutover로 넘어가지 말고 canonical follow relation writer/reader부터 수정.
- app377이 PASS한 뒤에만 기존 follow mutation W14~W17 → W1~W2 shared overlay cutover 작업을 재개.
- shared follow cutover / migration은 현재 OFF이며 별도 안전 검증 없이 켜지 않는다.
- TEST/PRODUCTION 승격 금지.

비용 기준:
- 변경 없는 reload/reopen: list Worker0 / D1 R0 목표.
- 실제 follow 변경: tiny RTDB signal 1개로 같은 계정 타기기 수렴; 수신 D1/Firestore 0.
- follow mutation 자체는 아직 legacy W14~W17. 이 비용은 다음 단계에서 W1~W2로 줄인다.
## CURRENT NEXT GATE — app376 팔로워/팔로잉 팝업 PREVIEW 실사용 검증

완료:
- 팔로워/팔로잉 숫자를 누르면 실제 사용자 목록을 볼 수 있는 popup client 구현 완료.
- 기존 `/v1/profiles/:id/followers|following` bounded backend 재사용; 새 Worker/backend/schema 없음.
- profile entry 추가 read 0; 숫자를 눌렀을 때만 최대 30명 1 page 조회.
- same mounted Explore session popup 재열기 memory cache.
- 사용자별 N+1 profile read 없음.
- CACHE LIVE 요청명 `팔로워 목록` / `팔로잉 목록` 추가.
- TypeScript / Build / full release-system audit PASS.
- 최종 Audit Run `37566557303`: SUCCESS.
- shared follow cutover OFF / active PREVIEW Worker `bc8cc09e-4210-46e2-bdb7-72796e2798e4` 유지.
- app376은 아직 Hosting 배포 전.

다음 순서:
1. 사용자 PREVIEW 배포 승인 시 app376 client/Hosting만 배포한다. Worker/shared D1/Functions는 변경하지 않는다.
2. MY프로필과 상대 프로필에서 `팔로워` / `팔로잉`을 각각 클릭한다.
3. 숫자와 실제 목록 수/멤버십을 비교한다.
4. A가 B를 팔로우 → B의 followers에 A가 보이는지, A의 following에 B가 보이는지 PC/모바일 양쪽 확인.
5. unfollow 후 양쪽 목록에서 사라지는지 확인.
6. CACHE LIVE에서 첫 목록 조회의 D1 R/W와 같은 목록 재열기의 추가 Worker/D1 여부를 확인한다.
7. 관계 목록은 맞는데 숫자/버튼만 틀리면 cache/count 동기화만 수정한다.
8. 관계 목록 자체가 틀리면 follow relation writer/reader를 우선 수정한다.
9. 이 정합성 PASS 전에는 W1~W2 overlay/shared follow cutover를 켜지 않는다.

보호:
- app375 공개/비공개/최신 공개곡/메인음원 visual reset 건드리지 않음.
- app373 first-publication W2 건드리지 않음.
- 좋아요 / Music Note / Library 정상 경로 건드리지 않음.
- UI 기존 프로필 레이아웃은 유지하고 follower/following 텍스트 영역만 click target으로 사용.
- TEST/PRODUCTION 변경 금지.
- 사용자 데이터 migration/backfill/delete/rewrite 금지.
## CURRENT NEXT GATE — PREVIEW cutover-OFF 실사용 follow 검증

현재 배포 상태:
- PREVIEW Worker candidate 배포 완료.
- Release Run `37565145301`: SUCCESS.
- active PREVIEW Worker `bc8cc09e-4210-46e2-bdb7-72796e2798e4`.
- shared follow cutover OFF / overlay activation OFF.
- TEST/PRODUCTION unchanged.
- app375 Hosting unchanged.

지금 확인할 것:
1. PC follow 1회 / unfollow 1회.
2. mobile follow 1회 / unfollow 1회.
3. PC→mobile, mobile→PC 상태가 페이지 이동/새로고침 없이 정상 수렴하는지.
4. followerCount/followingCount, MY following membership, follower-save permission, public profile parity.
5. live physical D1 Rows Written:
   - 이 단계는 **legacy parity 확인**이 목적이므로 Worker341 실사용 baseline과 비용/동작이 같아야 함.
   - cutover OFF인데 비용/동작이 달라지면 즉시 rollback.
6. R2 Class A/B/latency도 가능한 범위에서 기록.

아직 하지 말 것:
- shared follow schema migration.
- follow overlay activation/cutover.
- TEST/PRODUCTION 승격.
- 사용자 데이터 backfill/rewrite.
- 다른 정상 기능 수정.

다음 판단:
- cutover-OFF live parity PASS → overlay 활성화에 필요한 shared schema/cutover/rollback 영향 보고 후 사용자 승인 요청.
- parity FAIL → 즉시 Worker rollback 및 원인 분석.
- overlay live 검증에서 W1~W2/Duplicate W0가 확인되기 전 TEST 승격 금지.

## CURRENT NEXT GATE — follow PREVIEW live 검증 대기 / 배포 요청 전

완료:
- isolated actual HTTP D1 physical cost: follow W2 / unfollow W1 / duplicate W0 / same-state W0.
- Worker341 legacy parity 347~356 PASS.
- PREVIEW Worker release workflow에 Worker341 parity hard gate 추가.
- release-system re-audit Run `37564622518` SUCCESS.
- app375/publication/like/Music Note/Library/UI 비변경.
- Worker/Hosting/Functions/shared follow schema 배포·mutation 0.
- main/production unchanged.

현재 남은 핵심:
1. 실제 PREVIEW Worker + R2 환경에서 legacy cutover-OFF parity를 먼저 확인.
2. PC↔mobile follow/unfollow, profile follower/following count, following membership, follower-save permission, public-profile parity 실기기 확인.
3. 실제 R2 Class A/B 사용량과 지연을 확인. 현재 fixture 기준 정상 mutation은 R2 get 12 / put 7이므로 실제 비용을 숨기지 말고 기록.
4. 위 legacy 검증이 PASS하기 전 overlay 활성화/shared migration/cutover 금지.
5. overlay activation이 필요하면 schema 영향, rollback, TEST/PRODUCTION 구버전 호환을 먼저 보고하고 별도 승인 대기.
6. live overlay에서 D1 W1~W2 / duplicate W0가 확인되기 전 TEST 승격 금지.

배포 규칙:
- 사용자가 PREVIEW 배포를 요청하지 않은 현재 상태에서는 배포하지 않는다.
- 다음 PREVIEW 배포는 **cutover OFF 후보**만 허용.
- 배포 직후 legacy path 비용/동작이 Worker341과 다르면 자동/즉시 rollback 판단.
- W3+ / count mismatch / membership mismatch / permission mismatch / public-profile mismatch 발생 시 중단.

## CURRENT NEXT GATE — follow candidate PREVIEW 배포 전 최종 고정

완료된 1차 독립 감사:
- audit commit: `2cc95dc69a72c230bca4c59e9d8d5c4633528524`.
- Release System Audit Run `37564169142`: **SUCCESS**.
- TypeScript / Build / static follow 347~356 / TEST+PRODUCTION Worker dry-run / shared D1 SELECT-only preflight PASS.
- current PREVIEW active Worker 확인: `117d5f65-e34d-4c58-8030-498193deb1b4`.
- Worker341 legacy counter/post-sync exact parity PASS.
- cutover OFF dormant router legacy parity PASS.
- shared follow migration/cutover는 여전히 OFF.

실제 격리 D1 + actual HTTP handler:
- follow **W2**.
- unfollow **W1**.
- duplicate **W0**.
- same-state/new operation **W0**.
- stale reject **W0**.
- recovery retry physical D1 **W0**.
- W3+ 없음.
- 격리 D1 cleanup PASS.
- 사용자/shared D1 mutation 0.

중요 제한:
- R2는 fixture 기준 정상 follow/unfollow 각각 get 12 / put 7 시도. 실제 live R2 billing/latency는 아직 미검증.
- PREVIEW PC↔mobile 실기기 follow/unfollow와 profile/following/follower-save/public-profile parity는 배포 전이므로 미검증.
- 이 단계의 PASS는 **PREVIEW Worker 후보를 만들 수 있다는 뜻**이지 shared cutover나 TEST/PRODUCTION 승격 승인 아님.

다음 구현/릴리스 준비:
1. current canonical Worker source + source SHA를 follow candidate source로 고정.
2. PREVIEW Worker release gate에 Worker341 legacy parity verifier가 반드시 포함되는지 재확인하고, cutover OFF를 release 조건으로 고정.
3. 제품 코드/UI/publication/like/Music Note/Library는 변경하지 않는다.
4. 배포 요청 전에는 Worker/Hosting/Functions/shared D1을 배포·변경하지 않는다.
5. 사용자가 PREVIEW 배포를 요청하면 **cutover OFF 후보만 PREVIEW Worker에 배포**.
6. 배포 직후 첫 검증은 legacy path:
   - 현재 Worker341과 동일 기능/비용인지,
   - Feed/profile warm R0/W0,
   - PC↔mobile follow/unfollow,
   - follower/following count와 membership,
   - follower-save permission/public-profile parity.
7. cutover OFF legacy parity PASS 후에만 overlay 활성화 단계의 필요 schema/cutover/rollback을 별도 보고하고 명확한 승인 대기.
8. 실제 PREVIEW overlay에서 follow/unfollow W1~W2 + duplicate/same-state W0가 확인되기 전 TEST 승격 금지.

중단 조건:
- PREVIEW candidate의 cutover OFF legacy 비용이 Worker341 baseline과 달라지면 즉시 rollback.
- W3+면 즉시 FAIL.
- R2 비용/지연이 예상보다 크거나 원인이 불명확하면 cutover 진행 금지.
- profile count / membership / permission / public-profile parity 하나라도 깨지면 cutover 및 승격 금지.

## CURRENT NEXT GATE — follow backend 비용 W14~W17 → W1~W2 재개

목표:
- 현재 정상 app375 제품 기능/UI를 그대로 유지하면서 follow/unfollow 서버 비용만 축소.
- legacy 실사용 baseline physical D1 Rows Written 약 W14~W17.
- 최종 목표 physical W1~W2, duplicate/same-state W0.

고정 보호:
- app375 공개/비공개, 최신 공개곡 첫칸 즉시 노출, 공개 메인 음원 visual reset 변경 금지.
- app373 first-publication W2 구조 변경 금지.
- 좋아요 / Music Note / Library 정상 경로 변경 금지.
- UI/CSS/반응형 변경 금지.
- 사용자 데이터 migration/backfill/delete/rewrite 금지.
- shared follow cutover OFF 유지.
- TEST/PRODUCTION 변경 금지.

첫 작업:
1. 현재 PREVIEW/TEST/PRODUCTION Worker 및 shared follow schema를 read-only로 다시 고정.
2. Worker341 legacy follow 경로와 dormant 347~355 candidate를 diff/독립 감사.
3. 이전 rollback 원인이었던 “cutover OFF인데 legacy 비용이 달라지는 코드”가 완전히 차단되는지 실행형 검증.
4. 격리 Cloudflare D1 + R2 fixture에서 실제 HTTP follow/unfollow 전체 경로 비용 측정:
   - follow W1~W2
   - unfollow W1~W2
   - duplicate/same-state W0
   - no full profile/feed rebuild
5. PC↔mobile ordering/crash/retry/profile count/following membership compatibility PASS 전 PREVIEW Worker 배포 금지.
6. 위 증거가 모두 PASS한 뒤에만 PREVIEW Worker candidate 배포 판단.

중단 조건:
- legacy path 비용/동작이 Worker341과 다르면 즉시 중단.
- W3+면 비용 FAIL.
- profile count / following membership / follower-save permission / public profile parity 하나라도 깨지면 FAIL.
- shared migration/cutover가 필요하면 먼저 사용자에게 영향·복구·비용을 보고하고 별도 승인 대기.

## CURRENT NEXT GATE — app375 PRODUCTION RELEASED / 정식앱 smoke 확인

현재:
- PREVIEW app375.
- TEST app375 / TEST_VERIFIED Run `37559055085`.
- PRODUCTION app375 / RELEASED Run `37559345127`.
- production SHA `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0`.
- immutable TEST manifest/tag `soridraw-test-v375-24d600fd1597`.
- 사용자 데이터 / shared D1 추가 schema mutation / Functions / Rules 변경 없음.

정식앱 최소 확인:
1. 새 Music Note 곡 공개 후 Explore `최신 공개곡` 첫 번째 카드에 즉시 표시.
2. 왼쪽 `<` 화살표를 눌러야만 보이는 지연이 없어야 함.
3. 기존/신규 공개곡 메인 음원 1↔2 전환 시 이전 노란 제목/equalizer 즉시 초기화.
4. 공개상태 / MY프로필 / Explore 노출 parity 정상.
5. 비용 진단에서 first-publication W1~W2 기준 유지.

PASS 시:
- app375 릴리스 종료.
- 다음 비용/기능 작업은 새 PREVIEW 작업으로 시작.

FAIL 시:
- PRODUCTION에서 직접 임의 수정 금지.
- PREVIEW에서 문제 경로 최소 수정 → audit → PREVIEW 실사용 → TEST → 명확한 PRODUCTION 승인 순서 재개.

## CURRENT NEXT GATE — app375 PREVIEW PASS / TEST 승격 승인 대기

완료:
- PREVIEW app375 배포 Run `37556423502` SUCCESS.
- 사용자 실사용에서 새 공개곡이 `최신 공개곡` 첫 칸에 즉시 노출되는 동작 정상 확인.
- 공개 메인 음원 전환 visual reset(app374) 정상 유지.
- first-publication W2 비용 구조 유지.
- TEST/PRODUCTION 비변경.

다음:
- 사용자가 TEST 배포를 요청하면 app375 전체 PREVIEW 완성본을 main(TEST)으로 승격.
- TEST에서 동일한 새 공개곡 첫 칸 즉시 노출 + publication parity + 비용 회귀검사 확인.
- PRODUCTION은 별도 명확한 승인 전 승격 금지.

## CURRENT NEXT GATE — PREVIEW app375 새 공개곡 첫 칸 즉시 노출 실사용 확인

현재:
- PREVIEW app375 Run `37556423502`: SUCCESS / exact build PASS.
- TEST app374 / PRODUCTION app361 비변경.
- shared D1 / Worker / Functions / Rules / 사용자 데이터 추가 변경 없음.

사용자 확인:
1. PREVIEW에서 지금까지 한 번도 공개하지 않은 Music Note 곡 1개 공개.
2. Explore 홈 `최신 공개곡` 확인.
3. **기다렸다가 왼쪽 화살표가 활성화되는 과정 없이**, 공개한 곡이 첫 번째 카드로 바로 보여야 함.
4. 왼쪽 `<` 버튼을 눌러야만 보이는 상태면 FAIL.
5. 기존 app374 메인 음원 전환 시 노란 제목/equalizer 초기화가 계속 정상인지 함께 확인.

PASS 시:
- app375 PREVIEW frozen.
- 사용자가 TEST 배포 요청 시 app375 전체 완성본을 main(TEST)으로 승격.
- PRODUCTION은 TEST 확인 후 별도 명확한 승인 전 금지.

## CURRENT NEXT GATE — app374 TEST_VERIFIED / 사용자 TEST 실사용 확인

현재:
- Release Controller Run `37552538672` SUCCESS.
- TEST main `396a9862533e7e4f683a99cafe777c2fa40725c3`.
- TEST tag `soridraw-test-v374-b572a5dd9f18`.
- TEST app374 / PREVIEW app374 / PRODUCTION app361.
- PRODUCTION 비변경.

사용자 TEST 확인:
1. `test.soridraw.com`에서 기존 공개곡 중앙 링크 → 노란 제목/equalizer 활성.
2. 공개 설정에서 메인 음원 1↔2 전환.
3. 전환 즉시 이전 노란 제목/equalizer가 사라지는지 확인.
4. 신규 공개곡에서도 동일 동작 확인.
5. 공개상태 / MY프로필 / Explore 노출이 PREVIEW와 동일한지 확인.

PASS 시:
- app374 TEST_VERIFIED frozen.
- 정식배포는 사용자의 별도 명확한 PRODUCTION 승인 대기.

FAIL 시:
- TEST→PRODUCTION 승격 금지.
- PREVIEW에서 해당 UI/호환 경로만 수정 후 다시 TEST 승격.

## CURRENT NEXT GATE — app374 PREVIEW PASS / TEST 승격 승인 대기

완료:
- PREVIEW app374 배포 Run `37551851974` SUCCESS.
- 사용자 실사용에서 신규/기존 공개곡 모두 메인 음원 전환 후 노란 제목/equalizer 초기화 정상 확인.
- first-publication 실제 W2 유지 확인.
- TEST/PRODUCTION 비변경.

다음:
- 사용자가 TEST 배포를 요청하면 app374 전체 PREVIEW 완성본을 main(TEST)으로 승격.
- TEST에서 같은 공개곡 음원 전환 표시 + publication parity + 비용 회귀검사 확인.
- PRODUCTION은 별도 명확한 승인 전 승격 금지.

## CURRENT NEXT GATE — PREVIEW app374 실사용 확인

현재:
- PREVIEW app374 배포 Run `37551851974`: SUCCESS / exact build PASS.
- TEST/PRODUCTION은 app361 그대로.
- first-publication 실제 사용자 테스트 W2 확인 완료.
- 기존 공개곡 상태 변경 D1 W1 확인.
- app374는 비용 구조가 아니라 “공개 메인 음원 변경 후 오래된 노란 제목/equalizer가 남는 표시 버그”만 수정.

사용자 확인 항목:
1. PREVIEW에서 신규 공개곡 카드 중앙 버튼을 눌러 노란 제목/equalizer 활성.
2. 공개 설정에서 메인 음원 1↔2 전환.
3. 썸네일/링크가 바뀌는 순간 기존 노란 제목/equalizer가 즉시 사라지는지 확인.
4. 새 음원 중앙 버튼을 다시 눌렀을 때만 새 노란 제목/equalizer가 켜지는지 확인.
5. 동일 테스트를 **기존 공개 이력 곡**에서도 한 번 확인.

합격 시:
- app374 PREVIEW frozen.
- 사용자 요청/승인 시 TEST(main) 승격.
- 사용자 데이터 복사/변환 없음.

불합격 시:
- Explore local visual marker/timer path만 수정.
- shared D1 app373 W2 cutover, publication parity, 좋아요, Music Note/Library 정상 기능은 동결 보호.

## CURRENT NEXT GATE — app373 적용 완료 / 03:00 KST 이후 실제 Music Note first-publication 1곡 검증

완료:
- 사용자 shared D1 cutover 명확한 승인 완료.
- Shared D1 Release Run `37497179294`: **SUCCESS**.
- locked cutoff: **2026-10-07 03:00:00 KST**.
- 실제 shared D1 synthetic probe: **W2 / R0**.
- schema/user-row count/quick_check/feed/Worker identity/main-production ref 전부 PASS.
- live post-audit Run `37497440023`: **SUCCESS**, shared D1 cutover 적용 확인.
- 사용자 원본 row migration/backfill/delete/rewrite: 0.
- Worker/Hosting/Functions 배포: 0.
- app361 제품 UI/기능 코드 비변경.

사용자 실사용 확인:
1. 03:00 KST 이후 한 번도 공개한 적 없는 Music Note 곡 1개를 공개.
2. 공개 버튼이 즉시 활성 상태로 유지되는지 확인.
3. MY프로필 공개곡 및 Explore에 정상 노출되는지 확인.
4. 가능하면 비용 진단에서 해당 first-publication D1 rows_written이 W1~W2인지 확인.
5. PC/모바일 동일 계정에서 공개상태가 기존 app361 parity 규칙대로 수렴하는지 확인.

주의:
- 03:00 이전 첫 공개는 의도적으로 legacy 경로가 유지되므로 비용 검증 표본으로 사용하지 않는다.
- 기존에 D1 공개 row가 있었던 곡의 재공개도 first-publication 표본으로 사용하지 않는다.
- W3+ / 공개상태 불일치 / MY프로필 누락이 있으면 즉시 다음 비용 작업 중단.
- 정상 PASS 후 다음 비용 최적화 항목을 선택한다.

## CURRENT NEXT GATE — app372 shared D1 first-publication W12→W2 cutover 명확한 승인 대기

완료된 안전증명:
- 371 Music Note publication parity 영구 Release Gate: Run `37489891135` PASS.
- app372 static/cost audit: Run `37492203345` PASS.
- 실제 격리 Cloudflare D1:
  - first public W12 → **W2**
  - source/media swap → **W1**
  - private → **W1**
  - republish → **W1**
  - no-op → **W0**
  - pre-cutover Music Note / non-Music-Note 기존 동작 유지
  - rollback 복원 PASS
- 세 환경 live R2 authority + 현재 pre-cutover shared D1 read-only audit:
  - Run `37493247036` SUCCESS
  - PREVIEW/TEST/PRODUCTION R2 catalog/hybrid/publication-only authority PASS
  - shared D1 cutover 미적용 확인 PASS
  - remote D1 writes 0

다음 단계는 **공유 D1 schema cutover**:
- post-cutover 새 Music Note 첫 공개만 legacy 4개 secondary index + derived/revision fanout에서 제외.
- 기존 사용자 row / 기존 공개곡 / non-Music-Note는 기존 경로 유지.
- user data migration/backfill/delete/rewrite 없음.
- 전체 Feed/profile/search rebuild 없음.
- rollback SQL 준비 완료.

중요:
- 이 단계는 shared D1 index/trigger를 실제 변경하므로 **사용자의 명확한 승인 전 실행 금지**.
- 승인 전 TEST/PRODUCTION/Worker/Hosting/Functions 추가 배포 금지.
- 승인 시에도 먼저 exact shared-D1 preflight → cutoff 고정 → schema apply → 즉시 schema/parity/cost 확인 → W3+ 또는 parity FAIL이면 중단/rollback.
- 최종 합격: 실제 post-cutover 첫 공개 W1~W2, private/republish W1~W2, no-op W0, Explore/public-profile/search/Music Note parity PASS.

## CURRENT NEXT GATE — app361 역반영 완료 / 371 영구 parity gate 후 first-publication W12 → W1~W2

완료:
- PRODUCTION app361 사용자 실기기 정상 확인.
- TEST reverse sync Run `37485002429`: SUCCESS / TEST_VERIFIED.
- main(TEST) `21b2ac98370e0644c4ab245fc3fd9965d1cc4fb6`, tag `soridraw-test-v361-3019b20bc7d3`.
- PREVIEW reverse sync Run `37485563687`: SUCCESS / app361 exact build PASS.
- PREVIEW HEAD(배포 기준) `21d57b00a917e173a47223783c6caab22636138d`.
- TEST / PREVIEW / PRODUCTION 모두 app361 기준.
- user data / D1 schema / Functions / RTDB rules destructive mutation 없음.

다음 작업 순서:
1. app361의 `scripts/verify-371-music-note-publication-origin-parity.ts`를 일반 PREVIEW audit + Release Controller의 영구 승격 gate에 연결한다.
   - 서버/API parity만 맞고 Music Note 공개 버튼 fill/active가 다르면 FAIL.
   - 기존 PRODUCTION persistent cache → 새 release upgrade 경로도 검사.
   - 제품 UI/데이터 mutation 없음.
2. 위 Release System Audit PASS 후 원래 예정 작업인 **first-publication D1 rows_written W12 → W1~W2** 최적화를 새 PREVIEW 작업으로 시작한다.
3. 정상 좋아요/저장하트/잠금/공개·비공개/Music Note/Library/폴더/미디어는 동결 보호.
4. 전체 publication/feed/profile scan, 앱 버전 기반 cache bust, 사용자 데이터 migration/backfill 금지.
5. first-publication 1회에서 D1 W3+이면 기능이 정상이어도 FAIL; W1~W2 확인 전 TEST 승격 금지.

## CURRENT NEXT GATE — app360 PRODUCTION Music Note 공개상태 회귀 + 영구 승격 parity gate

사용자 실기기 발견:
- 같은 곡의 Music Note 공개 버튼이 PREVIEW/TEST 쪽에서는 활성인데 PRODUCTION에서는 비활성으로 표시되는 회귀 확인.
- app360 Release Controller는 Feed/curated/public-profile/My Likes/browser-upgrade를 검사했지만 Music Note 카드의 publication-state 버튼 parity를 직접 검사하지 못함.
- 따라서 현재 상태는 제품 데이터 손상으로 단정하지 않고 **Release System FAIL + origin-local Music Note publication cache 수렴 누락** 후보로 다룬다.

이번 작업 우선순위:
1. `src/services/explorePublicationService.ts`의 기존 `explore-publication-states` persistent cache가 오래된 PRODUCTION origin에서도 실제 shared publication authority로 안전하게 수렴하도록 최소 수정.
2. 앱 버전 변경만으로 전체 cache 삭제/전체 publication 목록 DB read 금지. 변경 신호 또는 작은 revision 증거가 있을 때만 필요한 bundle을 갱신.
3. 정상 좋아요/저장하트/잠금/공개·비공개 mutation, Music Note 60초 저장, Library, Feed, 공개프로필 UI는 비변경.
4. 영구 Release Gate에 같은 곡 기준 상태 parity를 추가:
   - 최근 생성곡 저장/하트 상태
   - Explore 좋아요 상태와 숫자
   - Music Note 잠금 상태
   - Music Note 공개/비공개 버튼 상태
   - Music Note/Library membership
   - media/thumbnail
5. PREVIEW→TEST→PRODUCTION뿐 아니라 **기존 PRODUCTION persistent cache → 새 버전 업그레이드**에서도 위 상태가 같은지 검증.
6. 서버/API parity만 맞고 실제 브라우저 버튼 fill/active가 다르면 승격 FAIL.
7. 이 회귀가 해결되고 Release System Audit까지 PASS하기 전 first-publication W12→W1~W2 비용 최적화 재개 금지.

금지:
- 사용자 데이터 migration/backfill/delete/rewrite.
- 전체 publication/full Feed scan.
- 앱 버전 기반 cache bust.
- 정상 상태형 버튼 UI 디자인/위치/색상 변경.
- 사용자 별도 승인 없는 TEST/PRODUCTION 재승격.

## CURRENT NEXT GATE — app360 RELEASED / next PREVIEW task selection

정식배포 완료:
- PRODUCTION Run `37461102504`: SUCCESS / RELEASED.
- final manifest `soridraw-test-v360-d4c9d57cea80`.
- production SHA `78691ec733d7efcb254b904dc512af49124641cc`.
- production Explore Worker `4e845257-2fc5-46a0-9f46-04396ca729dc`.
- production Media Worker `a710fd22-8aa6-4386-b22a-d5510125fb2e`.
- Hosting exact clone + `soridraw.com` exact release index PASS.
- curated/public-profile/environment parity + Worker/Media smoke/verify PASS.
- user data / D1 schema / Functions / Rules destructive mutation 없음.

다음 개발은 새 PREVIEW 작업으로만 시작:
- 기존 예정 작업인 first-publication D1 W12 -> W1~W2 비용 최적화를 재개할 수 있음.
- app360 좋아요/프로필/Music Note/Library/UI 정상 동작은 frozen baseline으로 보호.
- PRODUCTION hotfix가 아니라 PREVIEW 설계→구현→감사→실사용→TEST 순서로 다시 진행.
### app360 TEST user validation — PASS
- User confirmed TEST app360 is now okay.
- Next gate is **explicit PRODUCTION approval only**.
- On `정식배포`, promote exact immutable TEST_VERIFIED tag `soridraw-test-v360-d4c9d57cea80`; do not rebuild latest PREVIEW and do not use the bootstrap tag.
## CURRENT NEXT GATE — app360 TEST 실사용 확인 / PRODUCTION 승인 대기

최종 TEST 기준:
- source `d4c9d57cea80944853e41c0911c21a24c88752ba`
- main `208cc8949dc60cb056066828ce78ef2fce764e0c`
- app360
- final Run `37436812301` SUCCESS / TEST_VERIFIED
- final tag `soridraw-test-v360-d4c9d57cea80`
- TEST Explore Worker `9835f91b-4c86-43db-ba30-bd8e5eaeffb8`
- TEST Media Worker `f947084a-15a7-4549-a921-09d32595f5ba`
- PRODUCTION unchanged

사용자 TEST 확인:
1. own-profile `좋아요 곡`이 canonical membership과 일치하는지.
2. 캐시가 정상인 상태에서 `공개곡 ↔ 좋아요 곡` 반복 이동이 Worker를 반복 증가시키지 않는지.
3. 실제 좋아요 추가/해제 때만 bounded Worker + canonical W1이 발생하는지.
4. 공개/비공개 후 프로필 공개곡이 기존 20분 stale 상태 없이 약 1분 bounded window 안에서 수렴하는지.
5. Feed / 추천 / 하트+숫자 / Music Note / Library / folders / PC·모바일 기본 회귀 확인.

PASS 후:
- 사용자의 명확한 `정식배포` 승인 시 final tag `soridraw-test-v360-d4c9d57cea80` exact artifact만 PRODUCTION 승격.
- production에서 rebuild/reassembly/latest preview 사용 금지.
- bootstrap tag `soridraw-test-v360-0d27ac79c2d8` 사용 금지.
## CURRENT NEXT GATE — app360 final TEST_VERIFIED 재검증

1차 TEST bootstrap:
- source `0d27ac79c2d8fed053fc2949cbfdad05fff794b7`
- Run `37436278070` SUCCESS
- main `d42444e85efae30a6915e64b9604e8c81b3f9306`
- app360 TEST deployed
- first tag `soridraw-test-v360-0d27ac79c2d8`는 production 사용 금지

다음:
- 이 docs-only PREVIEW HEAD를 exact target으로 새 main app360 controller에서 TEST 재검증.
- TypeScript / Build / app358-360 executable gates / production env contract / TEST Worker+Media+Hosting / Feed / curated / public profile / shared catalog 모두 PASS 필요.
- 새 schema4 TEST_VERIFIED tag만 향후 PRODUCTION 후보.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 변경 금지.
### app359 PREVIEW verification progress — Worker behavior
- PASS candidate: Worker/social-snapshot activity now follows **actual like membership changes**, not mere tab navigation.
- This is acceptable under the local-first cost rule: real like changes may use bounded Worker/read work and W1; unchanged revisit must remain Worker 0 / D1 R0 target.
- Final remaining user check before TEST promotion: public/private change must update the public-profile song list without the former ~20 minute delay.
### app359 PREVIEW user check progress
- PASS: own-profile `좋아요 곡` count converged to **16**, matching canonical D1/R2 proof.
- Still required before TEST promotion:
  1. after one-time settlement, repeated `공개곡 ↔ 좋아요 곡` switching must not keep increasing Worker repair requests;
  2. public/private change must update the public-profile list without waiting ~20 minutes.
## CURRENT NEXT GATE — app359 PREVIEW 실사용 확인 후 TEST 재승격

확정된 실제 상태:
- canonical D1 all like relations=30.
- current public+published My Likes authority=16.
- hidden/unpublished relations=14.
- shared personal-like R2 exact count=16.
- app358 화면 20곡은 canonical limit가 아니라 historical local guard overlay 문제.
- app359은 canonical repair 후 fresh settlement를 1회 실행하여 stale guard를 정리하도록 수정.
- Audit `37415142727` SUCCESS.
- PREVIEW App Run `37415347786` SUCCESS / app359.
- TEST/PRODUCTION unchanged.

지금 할 일:
1. 사용자 PREVIEW app359에서 `좋아요 곡` 목록 확인.
2. 별도 현재 pending click이 없다면 16곡으로 수렴하는지 확인.
3. 공개곡↔좋아요 곡을 여러 번 눌러도 최초 upgrade 이후 Worker가 반복 증가하지 않는지 확인.
4. 공개/비공개 뒤 공개프로필이 20분 TTL을 기다리지 않는지 확인.
5. 모두 PASS하면 app359을 TEST로 새 승격.

금지:
- app359 PREVIEW 실사용 확인 전 TEST 승격.
- app357 manifest 재사용.
- user-data backfill/migration.
- canonical D1 30 relation을 임의 삭제하거나 hidden/unpublished 14 relation을 정리하지 않음.

## CURRENT NEXT GATE — app358 PREVIEW 실사용 검증 / TEST 재승격 대기

현재 기준:
- PREVIEW app358 deployed.
- Firebase PREVIEW Run `37413571015`: SUCCESS / exact build PASS.
- PREVIEW Explore Worker Run `37413466047`: SUCCESS.
- active PREVIEW Explore Worker `117d5f65-e34d-4c58-8030-498193deb1b4`.
- Audit Run `37413168427`: SUCCESS.
- main(TEST) app357 / production unchanged.
- 기존 app357 schema4 TEST manifest는 사용자 실사용 회귀 발견으로 **promotion-invalid**.

사용자 실사용에서 반드시 확인:
1. own profile의 `좋아요 곡` 탭을 짧은 간격으로 여러 번 왕복.
   - 첫 stale-origin repair가 필요한 경우 1회 Worker 요청은 허용.
   - 같은 retained signal에서 이후 반복 탭 클릭은 Worker 추가 상승 금지.
   - 목록 membership이 PREVIEW/실제 좋아요 상태와 일치해야 함.
2. 공개곡 하나를 비공개→공개 또는 공개→비공개 전환.
   - 프로필 공개곡 목록이 약 20분 Edge TTL을 기다리지 않고 실제 change signal 뒤 즉시 수렴해야 함.
   - 일반 프로필 재진입은 Worker 0 우선.
3. 기존 정상 기능 최소 확인:
   - Feed / SORIDRAW 추천 / 하트+숫자 / Music Note / Library / 폴더 / PC·모바일 UI.

합격 후:
- app358 PREVIEW 완성본 전체를 TEST로 새 승격.
- 새 TEST_VERIFIED manifest를 새로 생성.
- app357 tag `soridraw-test-v357-32c85eded45c`는 PRODUCTION에 절대 사용하지 않음.
- 새 TEST 실사용까지 PASS해야 PRODUCTION 후보가 됨.

금지:
- 현재 단계에서 main/TEST/PRODUCTION 수정.
- 사용자 승인 없는 PRODUCTION 배포.
- 데이터 migration/backfill/full scan.
- D1 schema 변경.
- 좋아요/공개/비공개 정상 UX 또는 UI 재설계.
- app358 실사용 PASS 전 first-publication 비용 최적화 재개.

## CURRENT NEXT GATE — schema4 TEST_VERIFIED 완료 / TEST 실사용 확인 및 PRODUCTION 승인 대기

완료:
- Release Controller Run `37407657202`: SUCCESS / TEST_VERIFIED.
- source PREVIEW `32c85eded45c49e0e735c685a05b2efe8702c8ce`.
- main(TEST) `d4852c7b85955effd0714b88c62ec10a4c96bb2e`.
- app357.
- schema4 manifest `soridraw-test-v357-32c85eded45c`.
- TEST Explore Worker `ef64f24d-8e65-4921-a96d-b52e1d8db62d`.
- TEST Media Worker `3c167990-7194-4301-81da-791a21989156`.
- TEST Hosting exact build / latest+popular Feed / curated 12 / public-profile / shared Catalog parity PASS.
- production environment contract / compiled Explore+Media code identity / old-browser-cache upgrade gate PASS.
- PRODUCTION unchanged.
- user data migration/backfill/copy/delete/rewrite 0.

지금 할 일:
1. 사용자 실기기에서 `test.soridraw.com` app357 최종 확인.
2. 특히 PREVIEW와 달랐던 공개프로필 공개곡·핀 / own-profile 좋아요 곡 membership 확인.
3. Feed / SORIDRAW 추천 / 좋아요 / 공개·비공개 / Music Note / Library / 폴더가 기존 정상 동작을 유지하는지 최소 확인.
4. 문제가 없으면 사용자 명확한 `정식배포` 승인 후 schema4 manifest `soridraw-test-v357-32c85eded45c`만 PRODUCTION에 exact promotion.
5. PRODUCTION preflight에서 environment contract drift 또는 artifact/code SHA mismatch가 1개라도 나오면 mutation 전 중단.
6. app357 parity 릴리스 종료 전 first-publication W12→W1~W2 비용 최적화 재개 금지.

금지:
- 최신 preview HEAD를 임의로 다시 빌드해 PRODUCTION에 사용.
- bootstrap schema3 manifest 사용.
- PRODUCTION에서 새 build/reassembly.
- 사용자 승인 없는 PRODUCTION 변경.
- 데이터 migration/backfill/full scan.
- 정상 좋아요/공개/비공개/Music Note/Library/UI 변경.

## CURRENT NEXT GATE — one-time 새 Release Controller TEST bootstrap 승인 대기

완료:
- PRODUCTION-first Release Controller source 구현 완료.
- final Audit Run `37406340564`: SUCCESS / no deployment.
- production live environment contract PASS.
- TEST↔PRODUCTION Explore compiled code SHA exact match PASS.
- TEST↔PRODUCTION Media compiled code SHA exact match PASS.
- old PRODUCTION browser cache upgrade executable test PASS.
- TEST_VERIFIED schema4 manifest + frozen production environment contract 구현 완료.
- user data / D1 schema / Functions / Rules / TEST / PRODUCTION mutation 0.

왜 bootstrap이 1회 필요한가:
- GitHub issue-comment controller는 현재 default branch `main`의 workflow를 실행한다.
- main에는 아직 이전 controller가 있으므로 새 controller를 먼저 main에 승격해야 한다.
- 사용자 TEST 승인 없이 main 변경 금지.

사용자가 `테스트배포`를 승인하면:
1. 현재 검증된 app357 + hardened controller exact tree를 기존 controller로 TEST/main에 1회 bootstrap.
2. 첫 TEST manifest는 **PRODUCTION 사용 금지**.
3. main에 새 controller가 들어온 것을 exact SHA/identity로 확인.
4. product behavior가 동일한 최신 PREVIEW SHA로 새 controller를 다시 실행해 **schema4 TEST_VERIFIED** manifest 생성.
5. 두 번째 run에서 반드시 확인:
   - production environment contract freeze PASS
   - Explore/Media compiled code exact identity PASS
   - app366 + app367 browser-origin upgrade gate PASS
   - Feed / curated / public-profile server projection parity PASS
   - shared Catalog=1
   - TEST Hosting exact build
6. 여기까지 모두 PASS한 후 TEST 실사용 최종 확인.
7. 별도 명확한 정식배포 승인 전 PRODUCTION 변경 금지.
8. PRODUCTION 승인 시 schema4 manifest 하나만 사용해 Hosting clone + exact code-identity Worker/Media promotion. contract drift면 mutation 전 차단.

이 one-time bootstrap 이후 정상 릴리스:
`PREVIEW 개발 → TEST 단일 완성 검증 → PRODUCTION 단일 승격`.

금지:
- bootstrap 첫 구-controller manifest를 PRODUCTION에 사용.
- 사용자 승인 없는 main/TEST/PRODUCTION 변경.
- 새 controller 검증 실패를 우회한 수동 production deploy.
- user data migration/backfill/full scan.
- app357 parity 종료 전 first-publication W12→W2 재개.

## CURRENT NEXT GATE — Release Controller PRODUCTION-first 강제화

목표:
- TEST에서 검증된 완성본이 PRODUCTION에서 환경 차이 때문에 다시 깨지는 구조를 끝낸다.
- TEST_VERIFIED가 "코드 PASS"가 아니라 "PRODUCTION 실제 조건에서도 동일 결과가 사전 증명됨"을 의미하게 만든다.
- PRODUCTION 승격은 재개발/재빌드가 아니라 TEST 검증 artifact의 exact promotion이 되게 한다.

필수 구현:
1. TEST 승격 시 PRODUCTION live environment contract를 read-only snapshot으로 수집:
   - Worker/Media bindings
   - vars/feature flags
   - canonical DB/R2/Catalog identity
   - environment-local cache binding/fallback contract
   - Hosting/PWA 관련 production-only 차이
2. 허용된 환경 차이를 명시적 allowlist로 고정하고, 미등록 차이 1개라도 TEST_VERIFIED 금지.
3. TEST_VERIFIED manifest에 source + Hosting artifact + Worker/Media bundle + controller + production environment contract hash를 고정.
4. PRODUCTION에서 artifact 재빌드 금지. TEST에서 검증한 exact artifact만 clone/activate.
5. server parity와 별개로 browser-visible parity 검증 추가:
   - existing PRODUCTION persistent cache -> new release upgrade
   - empty/new-device cache
   - Feed
   - SORIDRAW 추천
   - 공개프로필 공개곡/핀
   - own-profile 좋아요 곡 membership
   - 공개/비공개/좋아요 상태
   - Music Note / Library / folders
6. 위 결과가 TEST와 다르면 traffic 전환/RELEASED 금지.
7. PRODUCTION에서 새 환경차이 오류가 나오면 제품 수정 재배포 반복 대신 Release System FAIL로 기록하고 자동 rollback/중단.
8. 사용자 실기기 확인은 최종 체감 확인만 남기고 핵심 정합성 PASS의 근거로 사용하지 않음.

합격선:
- TypeScript / Build / release verifiers PASS.
- Release System Audit PASS.
- destructive DB/data action 0.
- TEST/PRODUCTION 실제 배포 없이 dry-run/read-only로 새 gate가 실패/성공 조건을 증명.
- app357 TEST/PRODUCTION 승격은 위 Release Controller 보강이 끝난 뒤에만 재개.
## CURRENT NEXT GATE — app357 PREVIEW 공개프로필 + 좋아요 곡 실기기 parity 검증

현재:
- 사용자 영상/실기기에서 PRODUCTION Feed는 정상이나 공개프로필 공개곡 및 own-profile 좋아요 곡이 PREVIEW와 다름을 확인.
- server-side TEST↔PRODUCTION public-profile parity는 직전 release에서 PASS였으므로 browser origin별 persistent cache 수렴 gap을 수정.
- PREVIEW app357 deployed SHA `aafacbe6af07a3a6919c01c0512b123b2a44ba6b`.
- Release System Audit `37401266952` SUCCESS.
- Firebase PREVIEW Run `37401610271` SUCCESS / app357 exact build PASS.
- TEST / PRODUCTION unchanged.
- user data migration/backfill/copy/delete/rewrite 0.
- Worker/Functions/Rules/D1 변경 0.

사용자 실기기 테스트:
1. `preview.soridraw.com` 업데이트 후 Explore → 본인 프로필 → **공개 곡**.
   - 실제 현재 공개곡 개수/목록/핀 곡 확인.
2. 같은 프로필 → **좋아요 곡**.
   - 현재 실제 좋아요 membership과 카드 목록 일치 확인.
3. Explore로 나갔다가 같은 프로필 재진입.
   - 변경이 없으면 추가 profile data read가 반복되지 않는지 CACHE LIVE 확인.
4. PC/모바일 중 기존에 stale했던 기기에서도 1~2를 확인.
5. Feed / SORIDRAW 추천 / 하트 클릭 / 공개·비공개가 기존처럼 정상인지 최소 확인.

승격:
- 위 실기기 PASS 후 사용자 `테스트배포` 요청 시 app357 전체를 TEST로 승격.
- TEST에서도 공개곡 + 좋아요 곡 + Feed + curated parity 확인.
- 사용자의 별도 명확한 정식배포 승인 후에만 PRODUCTION 승격.
- Release Controller TEST preflight는 `verify-366-cross-environment-profile-like-parity.mjs`를 필수 실행하므로 이 보호가 빠진 릴리스는 승격 불가.

금지:
- profile/like cache 전체 삭제 또는 앱버전 기반 cache bust.
- 전체 D1/Firestore scan/backfill.
- 좋아요 30초 batching/W1 queue/heart-count frozen behavior 변경.
- UI 변경.
- parity 확인 전 first-publication W12->W2 작업 재개.

## CURRENT NEXT GATE — 정식앱 SORIDRAW 추천 실사용 확인 후 first-publication W12 -> W1~W2 재개

완료:
- 최종 PRODUCTION Run `37397953411`: SUCCESS / RELEASED.
- source PREVIEW `884bf33c99eb67a8c06c8720f518a55b6f2ce27c`.
- main(TEST) `bca5864db427f6fdc635e547f573588e9628be0b`.
- production `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.
- manifest `soridraw-test-v356-884bf33c99eb`.
- PRODUCTION Explore Worker `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa`.
- PRODUCTION Media Worker `a3b87bbc-af2d-41eb-9e26-99dda0dbfc44`.
- `PRODUCTION_CURATED_PARITY=PASS count=12`.
- TEST ↔ PRODUCTION latest/popular/public-profile/environment parity PASS.
- Firebase PRODUCTION Hosting clone + exact build verify PASS.
- shared Catalog flag=1 / shared-catalog PASS.
- user data migration/backfill/copy/delete/rewrite 0.
- likes/publication/Music Note/Library/folders/UI/thumbnail 비변경.

최종 사용자 확인:
1. `soridraw.com` Explore에서 `SORIDRAW 추천` 섹션 정상 표시.
2. CACHE LIVE `/v1/curated` HTTP 200.
3. warm 재진입 추천 D1 R0/W0.
4. 문제 없으면 curated 복구 이슈 종료.

그 다음 개발:
- never-published 최초 공개의 현재 D1 R6/W12 HARD FAIL 경로만 다시 분석.
- 기능은 현재 공개/검색/프로필/Feed/좋아요/thumbnail 결과 100% 보존.
- 목표 W1~W2; 불가능하면 기능을 삭제하지 말고 원인/현실적 최소 비용을 먼저 보고.
- existing registered public/private 정상 경로와 좋아요/저장하트/Music Note/Library/UI는 건드리지 않음.
- 전체 scan/rebuild/backfill 금지.

## CURRENT NEXT GATE — fixed-controller TEST manifest 재생성 후 승인된 PRODUCTION 승격

현재:
- PRODUCTION 첫 시도 Run `37395223571`은 deployment 전 controller identity drift로 안전 차단; PRODUCTION 비변경.
- promoted-source identity fix Audit `37395497639` SUCCESS.
- controller bootstrap TEST Run `37395703347` SUCCESS.
- main은 수정된 controller를 포함한 `00b5ee7b4eaac7ef8a9ec1d7ee7a0328223c76b8`.
- 추천 parity 12곡 PASS 유지.
- 사용자는 SORIDRAW 추천 복구 검증본의 PRODUCTION 승격을 명확히 승인한 상태.

다음:
1. controller identity 파일을 더 변경하지 않은 문서-only 최신 PREVIEW SHA로 TEST를 한 번 재검증.
2. 새 TEST_VERIFIED manifest의 controller identity가 현재 main controller와 exact-match 하는지 확인.
3. curated 12곡 parity / warm D1 R0/W0 / shared Catalog=1 / Hosting exact build 모두 PASS 확인.
4. 그 manifest만 사용해 승인된 PRODUCTION 승격 실행.
5. TEST vs PRODUCTION curated parity 실패나 503이면 자동 중단/rollback.
6. PRODUCTION 실제 `/v1/curated` 200, warm R0/W0 및 production ref/Worker/Hosting 확인 후 종료.

금지:
- 이번 재검증 사이에 controller identity 파일 추가 변경.
- 사용자 데이터 migration/backfill.
- 좋아요/공개/비공개/Music Note/Library/UI 변경.

## CURRENT NEXT GATE — TEST 실사용 확인 후 SORIDRAW 추천 PRODUCTION 승격 승인 대기

현재 완료:
- TEST Release Controller Run `37394592522`: SUCCESS / TEST_VERIFIED.
- source PREVIEW `86872e778695f199923f88b56481ee3ff7064a4a`.
- main(TEST) `cca8c2c4fedf88da4c14ff85331ad6c00c128098`.
- TEST manifest `soridraw-test-v356-86872e778695`.
- TEST Explore Worker `85e9821a-c2d4-4dcc-a5c5-8f06ee6600ae`.
- TEST Media Worker `979e09c0-fc05-47fe-9522-91a46a004ef6`.
- `TEST_CURATED_PARITY=PASS count=12`.
- latest/popular/public-profile/environment parity, Worker/Media smoke/verify PASS.
- TEST shared Catalog flag=1 / authority=shared-catalog PASS.
- PRODUCTION 전체 비변경.

다음:
1. 사용자 실기기에서 `test.soridraw.com` Explore의 `SORIDRAW 추천` 섹션이 12곡으로 정상 표시되는지 확인.
2. CACHE LIVE에서 `/v1/curated`가 HTTP 200인지 확인.
3. 같은 세션 warm 재진입에서 curated D1 R0/W0인지 확인.
4. 이상 없으면 사용자 명확한 정식배포 승인 후 **manifest `soridraw-test-v356-86872e778695`만** 사용해 PRODUCTION 승격.
5. PRODUCTION 승격 시 TEST vs PRODUCTION curated parity 실패 또는 503이면 자동 중단/rollback.
6. 정식앱 실사용 확인 후 curated 이슈 종료.
7. 그 다음 큰 작업은 first-publication D1 W12 -> W1~W2 비용 절감 재개.

금지:
- 사용자 승인 없는 PRODUCTION 승격.
- 추천 복구를 이유로 좋아요/공개/비공개/Music Note/Library/UI/thumbnail 변경.
- curated 전체 tracks scan/rebuild.
- 사용자 데이터 migration/backfill.

## CURRENT NEXT GATE — SORIDRAW 추천 fix의 TEST/PRODUCTION 승격

현재 완료:
- 원인: 환경별 Explore curated R2가 비었을 때 wrapper-only `/v1/curated`를 base Worker에 재호출해 503이 되던 cold bootstrap 오류.
- fix source `ff3c87ba797551beb9afbc8241ee5fca03f4680e`.
- 배포엔진 강화 source `d0811e400c74fe8c81c6f3a0bc494321388da71c`.
- Audit `37392970196` SUCCESS: TypeScript/Build/curation/release-controller/static+d1-readonly checks PASS.
- PREVIEW Worker Run `37393213974` SUCCESS.
- PREVIEW active Worker `193d7c1c-7471-44d0-bd1f-2315b0121eed`.
- live `/v1/curated`: first 200 count=12, warm 200 count=12, warm D1 R0/W0, EDGE/R2 authority PASS.
- TEST / PRODUCTION Explore Worker 비변경.
- UI / likes / publication / Studio save-heart / Music Note / Library / folders / thumbnail 비변경.
- 사용자 데이터 migration/copy/backfill/delete/rewrite 0.

다음:
1. 사용자 `테스트배포` 승인 시 이 curated fix + 강화된 release gate만 포함한 검증본을 main/TEST로 승격.
2. TEST 승격 자체에서 새 hard gate가 PREVIEW vs TEST `/v1/curated` HTTP 200, warm D1 R0/W0, 추천 projection equality를 확인.
3. TEST 실기기에서 `SORIDRAW 추천` 섹션과 추천곡 목록 확인.
4. 사용자의 명확한 정식배포 승인 후에만 같은 검증본을 PRODUCTION으로 승격.
5. PRODUCTION 승격에서도 TEST vs PRODUCTION curated parity가 실패하면 자동 중단/rollback.
6. 정식앱에서 `/v1/curated` 200 + SORIDRAW 추천 표시 + warm D1 R0/W0 확인 후 이 이슈 종료.

금지:
- 추천 복구를 이유로 좋아요/Feed/Public Profile/Music Note/Library/UI 구조 변경.
- curated 복구에서 전체 tracks scan/rebuild.
- 사용자 데이터 backfill/migration.
- 승인 없는 TEST/PRODUCTION 승격.

## CURRENT RUNTIME NOTE — shared Catalog cutover는 이미 ON

- Run `37389139136` SUCCESS.
- PREVIEW / TEST / PRODUCTION 모두 `SORIDRAW_SHARED_CATALOG_V1=1`, common `CATALOG=soridraw-user-catalog`, authority `shared-catalog`.
- bulk copy / Firestore migration / D1 mutation 없이 coordinated cutover 완료.
- 아래 과거 `flag=0 / dormant` 섹션은 이 cutover 이전 기록이므로 현재 기준으로 사용하지 않는다.

## CURRENT NEXT GATE — coordinated shared Catalog cutover + real-account parity

완료:
- PREVIEW / TEST / PRODUCTION app356 dormant shared Catalog support 승격 완료.
- 세 환경 Media Worker 모두 common private `CATALOG=soridraw-user-catalog` binding 보유.
- 세 환경 `SORIDRAW_SHARED_CATALOG_V1=0` 확인.
- TEST_VERIFIED manifest `soridraw-test-v356-77fdab283a90`.
- PRODUCTION Release Controller Run `37387649369`: SUCCESS / RELEASED.
- production SHA `74de6362c743974078c7d40566706053ce11dfc7`.
- 사용자 데이터 copy/backfill/migration/delete/rewrite 0.
- Firebase Hosting exact TEST->PRODUCTION clone 문법 오류 수정 및 Release System Audit PASS.

다음:
1. shared Catalog flag cutover 전 Media Worker shared-mode 경로와 rollback 조건을 다시 정적 감사.
2. `SORIDRAW_SHARED_CATALOG_V1=1`을 PREVIEW / TEST / PRODUCTION에 **coordinated cutover**로 적용.
3. 각 환경에서 active Media Worker health가 `shared-catalog`, `CATALOG=soridraw-user-catalog`, flag=1인지 확인.
4. 한 환경이라도 실패하면 즉시 세 환경을 기존 flag=0 active version으로 rollback.
5. cutover 직후 동일 계정으로 PREVIEW / TEST / PRODUCTION 실데이터 parity 검증:
   - Recent save-heart
   - Music Note membership/list
   - Library list
   - folders
   - PC↔mobile/reload
   - Explore/publication
6. warm 정상 캐시 재진입 Worker/Firestore data read 0 목표 확인.
7. missing/revision-gap일 때만 bounded user+kind bootstrap이 동작하고 앱 업데이트/일반 재진입에서는 bootstrap이 발생하지 않는지 확인.
8. parity + 비용 PASS 후에만 first-publication W12->W2 shared-D1 cutover 작업 재개.

금지:
- PREVIEW/TEST만 flag ON한 채 방치.
- 환경별 private Catalog 전체 복사 또는 공용 bucket 전체 backfill/full scan.
- 사용자 데이터 삭제/강제 재생성.
- app349 save-heart / app301 folders / public-like / UI / thumbnail 정상 기능 변경.
- parity 완료 전 first-publication shared D1 W2 승격.

## CURRENT NEXT GATE — PRODUCTION dormant support approval before coordinated shared Catalog cutover

완료:
- PREVIEW + TEST app356 exact tree parity.
- TEST Explore Worker/Media Worker/Hosting promotion complete.
- TEST Media Worker uses environment-local `MEDIA=soridraw-media-test` plus common dormant `CATALOG=soridraw-user-catalog`.
- `SORIDRAW_SHARED_CATALOG_V1=0` 유지.
- TEST_VERIFIED Run `37383619935`, tag `soridraw-test-v356-0bab8cdb2492`.
- user data copy/backfill/migration/delete/rewrite 0.
- Release Controller now verifies Media Worker/Catalog and promotes branch refs only after environment verification.

다음:
1. **여기서 자동 진행 중단.** PRODUCTION은 사용자 명확한 정식배포 승인 필요.
2. 승인 시 TEST_VERIFIED manifest `soridraw-test-v356-0bab8cdb2492`만 사용해 PRODUCTION에 dormant support 승격:
   - app/Hosting
   - Explore Worker
   - Media Worker
   - common `CATALOG=soridraw-user-catalog` binding
   - `SORIDRAW_SHARED_CATALOG_V1=0` 유지
3. PRODUCTION verify PASS 후 세 환경 runtime/source/binding parity 확인.
4. 그 다음 별도 coordinated cutover에서만 shared Catalog flag를 세 환경 동일하게 ON.
5. cutover 직후 동일 계정으로 PREVIEW/TEST/PRODUCTION:
   - Recent save-heart
   - Music Note membership/list
   - Library list
   - folders
   - PC↔mobile/reload
   - Explore/publication
   실데이터 결과가 동일한지 확인.
6. warm 정상 캐시 재진입 Worker/Firestore data read 0 목표 확인.
7. parity PASS 후에만 first-publication W12->W2 작업 재개.

금지:
- PREVIEW/TEST만 shared flag ON.
- 사용자 Catalog 일괄 복사/full scan/backfill.
- 승인 없는 PRODUCTION 승격.
- app349 save-heart/app301 folders/좋아요/UI/thumbnail 정상 기능 변경.
- parity 완료 전 shared D1 W2 cutover.

## CURRENT NEXT GATE — shared private Catalog dormant support -> coordinated environment parity

완료:
- 공용 private R2 bucket `soridraw-user-catalog` + 세 환경 `CATALOG` binding 준비.
- `SORIDRAW_SHARED_CATALOG_V1=0`으로 모든 환경에서 cutover OFF.
- bounded user/kind bootstrap + revision fence 구현.
- PREVIEW Media Worker Run `37379556479` SUCCESS.
- final Release System Audit Run `37379712972` SUCCESS.
- PREVIEW App Release Run `37381481452` SUCCESS, app356 exact build.
- user data copy/backfill/migration/delete/rewrite 0.

다음 순서:
1. **PREVIEW 단독 shared flag ON 금지.**
2. 사용자가 TEST 배포를 요청하면 현재 검증된 dormant support 전체를 main/TEST로 승격:
   - app/client
   - Media Worker
   - shared `CATALOG` binding
   - release controller parity checks
   를 하나의 릴리스로 처리.
3. TEST 승격 직후에도 `SORIDRAW_SHARED_CATALOG_V1=0`을 유지하고 PREVIEW/TEST runtime source/binding exact parity 확인.
4. PRODUCTION은 명확한 정식배포 승인 전 변경 금지.
5. 세 활성 환경이 shared Catalog 코드를 이해하는 상태가 된 뒤에만 coordinated flag cutover 계획을 실행.
6. cutover 검증은 동일 계정으로 PREVIEW/TEST/PRODUCTION:
   - Recent Song 저장하트
   - Music Note membership/list
   - Library list
   - Music Note/Library folder metadata
   - reload / PC↔mobile
   - 공개상태/Explore
   를 확인.
7. warm 정상 캐시 재진입 Worker/Firestore data read 0 목표 유지.
8. bootstrap은 실제 revision gap/missing shared Catalog 복구에서만 허용. 앱 업데이트/페이지 진입을 이유로 bootstrap 금지.
9. parity가 모두 PASS한 뒤에만 first-publication W12->W2 작업 재개.

금지:
- environment-local Catalog를 shared bucket으로 일괄 복사.
- 사용자 전체 backfill/full scan.
- PREVIEW만 먼저 shared authority 활성화.
- app349 save-heart / app301 folders / 좋아요 / UI / thumbnail 정상 기능 변경.
- 승인 없는 TEST/PRODUCTION 승격.
- parity 완료 전 shared D1 W2 cutover.

## CURRENT NEXT GATE — Music Note/Library/Recent cross-env parity before PRODUCTION

현재:
- app356 TEST Run `37375259800` TEST_VERIFIED.
- PREVIEW와 TEST의 Recent save-heart / Music Note / Library 관련 앱 코드는 exact same source.
- 따라서 남은 차이는 앱 코드 승격 누락이 아니라 **환경별 private R2 Catalog 수렴 문제를 우선 의심**.
- canonical Firebase/RTDB는 공유지만 Music Note/Library R2 buckets는 preview/test/production 별도.

목표:
- 동일 계정이면 PREVIEW/TEST/PRODUCTION 어느 앱에서도 Music Note/Library/Recent 저장 결과가 동일.
- mutation은 실제 변경분만 O(1) 전달.
- 앱 업데이트/재진입 때문에 Firestore 전체 reread/rebuild 금지.
- 사용자 데이터 copy/backfill/delete/rewrite 금지.
- app349 Recent save-heart/Music Note membership 동작, app301 folder behavior 보호.

먼저 할 일:
1. Recent save-heart canonical settlement + RTDB changed-item signal이 PREVIEW->TEST / TEST->PREVIEW에서 동일 item을 적용하는지 감사.
2. Music Note/Library Catalog delta publish가 현재 host의 env-specific R2에만 남는지 실제 경로 확정.
3. 환경별 Catalog가 drift할 수 있으면 shared catalog authority 또는 bounded cross-env changed-delta fanout 중 비용/안전 최선안 선택.
4. 기존 stale 환경을 맞추기 위해 full Firestore scan/backfill을 추가하지 말 것.
5. 수정 후 PC/모바일 + PREVIEW/TEST 2x2에서 save/unsave, Music Note, Library, folder, reload parity 확인.
6. 모두 PASS 전 PRODUCTION 승격 금지.
7. 이 gate 종료 후에만 W12->W2 작업 재개.

## CURRENT NEXT GATE — app356 profile count 확인 후 exact TEST parity 승격

현재 확인:
- 공개곡 목록은 shared R2 수렴 후 PREVIEW/TEST에서 다시 일치.
- 헤더 공개곡 숫자는 stale maintained counter가 실제 first-view 목록보다 우선되어 24->23, 22->23 오류.
- app356은 50곡 미만 complete first-view에서 실제 loaded 공개곡 수를 표시하도록 교정. 서버 IO 추가 0.
- Live Audit `37368822795`: PREVIEW R2 catalog/hybrid/R2-only flags ON, TEST/PRODUCTION flags 없음.

순서:
1. app356 PREVIEW 배포 완료 확인.
2. 실기기에서 24곡 프로필=24, 22곡 프로필=22 확인.
3. 경고박스 제거 확인.
4. 최신 Release Controller immutable preflight에서 canonical Worker feature-var 승격/verify hard gate PASS.
5. 그 다음에만 PREVIEW 전체를 TEST로 승격.
6. TEST에서 Feed/Profile/Search/Genre/공개/비공개/좋아요/썸네일과 PREVIEW parity 확인.
7. 사용자의 기존 정식배포 승인 범위는 유지하되, TEST 검증 실패 시 PRODUCTION 자동 중단.
8. PRODUCTION까지 동일 feature vars/Worker/app parity가 확인된 뒤에만 first-publication W12->W2 shared-D1 cutover 준비 재개.

금지:
- 현재 shared D1 W2 migration.
- stale trackCount 수정을 위해 owner 전체 COUNT/scan 추가.
- 사용자 데이터 backfill/rewrite.
- 정상 publication/like/UI 기능 변경.

## CURRENT NEXT GATE — first-publication R6/W12 안전 cutover 준비만, 기능 보존 우선

현재 실기기:
- registered 공개 **R4/W2** PASS.
- registered source 1->2 **R6/W3** known compatibility cost.
- registered 비공개 **R3/W2** PASS.
- never-published 최초 공개 **R6/W12** HARD FAIL.
- 신규 등록 직후 source 전환 **R6/W3**.

목표:
- 최초 공개만 **W2**로 내리는 cutoff 기반 shared-D1 candidate를 최종화하되, 다른 기능/기존 등록곡 비용을 증가시키지 않는다.
- existing rows는 legacy 경로 유지.
- cutoff 이후 new Music Note rows만 R2 catalog/shared-card authority를 사용.
- user-row migration/backfill/delete/rewrite 0.

선행 게이트:
1. TEST active Worker의 R2 hybrid/R2-only flags + Feed/Profile/Search/Genre authority를 read-only로 확인.
2. PRODUCTION 현재 active Worker/flags가 cutover 호환인지 read-only 확인.
3. PRODUCTION이 미호환이면 shared D1 변경 금지. 먼저 검증된 코드 승격이 필요.
4. 세 환경 모두 호환된 뒤에만 exact cutoff SQL + rollback/fail-safe를 isolated D1에서 다시 측정.
5. first publication W2, title/genre/artist search, latest/popular, public profile, cross-device publication, likes, source/thumbnail 모두 PASS해야 shared-D1 승인 요청 가능.

금지:
- 지금 shared D1 migration 적용.
- registered 공개/비공개 path 수정.
- 좋아요/저장하트/UI/thumbnail 수정.
- 전체 scan/rebuild.
- 사용자 row rewrite/backfill.
- 기능을 줄여 W2 맞추기.

## CURRENT NEXT GATE — app355 기능 복구 실기기 검증 우선

PREVIEW app355 배포:
- exact deployed commit `6a6c05981e3945d6e67cd7623c35680cd1c0abd4`.
- Preflight `37364316058` SUCCESS.
- Firebase PREVIEW Run `37365134850` SUCCESS.
- app355 exact build PASS.
- shared RTDB `explorePublication` additive owner-only signal rules exact-match PASS.
- Worker/Functions/Firestore Rules/D1/user data 변경 0.

현재 목표는 비용 추가 절감이 아니라 기능 정상화 확인:
1. 기기 A 공개 후 같은 계정 기기 B에서 자동으로 공개곡/공개상태가 보이는지.
2. 기기 B warm 새로고침만으로 Cloudflare Worker가 증가하지 않는지.
3. 기기 A 비공개 후 기기 B에서 자동 제거되는지.
4. 공개 R4/W2 / source R6/W3 / 비공개 R3/W2 기존 D1 비용이 회귀하지 않는지.
5. thumbnail/선택 source/좋아요/저장하트/UI 정상 유지.

판정:
- 위 1~5가 모두 PASS하기 전 source R6→R5/R4 최적화 금지.
- 새로고침 Worker가 아직 +1이면 CACHE LIVE의 **요청 상세 path**로 원인 endpoint 하나만 특정한 뒤 그 경로만 수정. 추측 수정 금지.
- cross-device가 실패하면 RTDB signal publish/receive/rules부터 확인하고 Cloudflare/D1 비용을 먼저 건드리지 않음.
- TEST는 현재 app354까지 승격된 상태. app355 검증 전 재승격 금지.
- PRODUCTION 비변경. 사용자 별도 정식배포 승인 전 승격 금지.

## CURRENT NEXT GATE — 연속 실기기 기준 고정, source R6만 분석

동일 세션 연속 확인 완료:
- 공개 **R4/W2**.
- source 1->2 **R6/W3**.
- 비공개 **R3/W2**.
- Worker 1 each / Firestore hot path R0/W0.

의미:
- 공개/비공개는 source 전환 전후에도 정상 비용 유지.
- 공개 회귀 가설 종료.
- 다음 수정 범위는 source 전환의 남은 physical Rows Read 6만.
- 공개/비공개/좋아요/저장하트/UI/thumbnail은 변경 금지.

다음 분석:
1. source R6 = Worker request 내부 D1 읽기를 statement/trigger 단위로 재분해.
2. 이미 필요한 canonical/legacy mirror/shared revision은 보존.
3. 기능 손상 없이 제거 가능한 read만 후보화.
4. W3는 legacy TEST/PRODUCTION 호환 mirror 때문에 현재 유지.
5. 후보가 R5 이하를 격리 증명한 경우에만 PREVIEW Worker 코드 변경 판단.
6. shared D1 추가 변경, TEST/PRODUCTION 승격은 사용자 승인 전 금지.

## CURRENT NEXT GATE — source 1->2 R6/W3만 남김

사용자 실기기 최신 확정:
- 순수 공개(설정 열고 아무것도 건드리지 않고 즉시 공개): **R4/W2**, Worker 1, Firestore R0/W0 — PASS.
- source 1->2: **R6/W3** — 직전 R10/W3 대비 개선, 추가 절감 후보.
- 비공개: **R3/W2** — PASS.

판정:
- 공개 R6/W3 회귀 가설은 최신 no-touch 재테스트로 해제.
- 순수 공개/비공개는 더 이상 수정 금지.
- 다음 작업은 source/media 전환 R6/W3만 대상으로 한다.
- 364 rollback 금지. 현재 source read 개선을 유지한다.

다음:
1. source 1->2의 남은 product R6를 request-level R1 + 364 trigger R4 + 기타 1행으로 정확히 분해.
2. 기능/thumbnail/Explore/공개프로필 media freshness를 그대로 유지하면서 마지막 불필요 read 1행 제거 가능성만 검토.
3. W3는 TEST/PRODUCTION legacy media mirror 호환 때문에 현재 정상 범위. W2 제거는 모든 환경 승격 후 357 별도 승인 전 금지.
4. source R5 이하가 기능 손상 없이 가능할 때만 PREVIEW 변경.
5. 좋아요/저장하트/UI/순수 공개/비공개 변경 금지.

## CURRENT NEXT GATE — 공개 R6/W3 media-path 오진입 추적

실기기 확정:
- 공개 **R6/W3** — 회귀, FAIL.
- source 1->2 **R6/W3** — R10에서 감소.
- 비공개 **R3/W2** — 정상 유지.

격리 재증명 Run `37356891372`:
- 364 pure registered public = **R3/W2**.
- 364 pure registered private = **R3/W2**.
- 364 public + media = **R4/W3**.
- 364 source/media = **R4/W3**.
- temp D1 cleanup PASS, shared/user D1 변경 0.
- 기존 364 visibility verifier gap 수정: 이제 actual 364 candidate public/private를 직접 검사.

다음 작업은 공개 경로만:
1. 제품 batch에서 순수 private->public이 `refreshSourceMedia/sourceMedia` 또는 media SET을 포함하는 조건을 추적.
2. `registered`, `selectionChanged`, outbox baseState와 실제 batch payload를 대조.
3. 사용자가 곡 선택을 바꾸지 않은 공개는 visibility/options만 보내도록 고정.
4. 사용자가 실제로 source를 바꾼 경우의 media freshness 기능은 그대로 보존.
5. source R6/W3 개선과 비공개 R3/W2는 회귀시키지 않음.
6. 수정 전후 정적 검증 + ephemeral D1 proof 후 PREVIEW만 판단.

합격선:
- 순수 공개: 기존 **R4/W2 이하** 복구.
- source 1->2: 현재 **R6/W3 이하** 유지(최종 W2는 legacy mirror 제거 승인 이후 별도).
- 비공개: **R3/W2 유지**.
- Worker 1회 / Firestore hot path W0.
- 기능/thumbnail/Explore/공개프로필 media 일치.
- 좋아요/저장하트/UI 비변경.

금지:
- 원인 확정 전 shared D1 재수정/rollback.
- 전체 scan/rebuild.
- 사용자 데이터 migration/backfill/delete/rewrite.
- TEST/PRODUCTION 승격.

## CURRENT NEXT GATE — 364 live source 전환 재측정

완료:
- 사용자 명시 승인 후 shared D1 trigger 2개만 364 compatibility candidate로 교체.
- 성공 Run `37352860772`.
- post-cutover Release System Audit `37352997906` SUCCESS.
- unrelated trigger / shared revision / Worker versions / main / production refs unchanged PASS.
- 사용자 row migration/backfill/delete/rewrite 0.
- exact rollback 준비 상태 유지.
- TEMP apply workflow 삭제.

다음 실기기 테스트:
1. PREVIEW의 같은 A곡에서 source 1->2 한 번 전환.
2. CACHE LIVE에서 D1 **행읽기 R / 행쓰기 W** 기록.
3. thumbnail / Explore / 공개프로필의 선택된 media가 같은지 확인.
4. 가능하면 공개/비공개도 한 번씩 확인하되 목표는 기존 **공개 R4/W2 / 비공개 R3/W2 유지**.

비용 예상:
- source 1->2: 직전 R10/W3 -> **약 R5/W3**.
- 격리 trigger proof 자체는 R9/W3 -> R4/W3.
- TEST/PRODUCTION Worker 호환용 legacy media mirror를 아직 유지하므로 W3는 정상.
- 모든 환경이 새 R2 authority로 승격된 뒤에만 357 legacy-mirror removal을 별도 승인 받아 최종 약 R4/W2 product 후보 검증.

실패 기준:
- source R이 기대치보다 유의미하게 높음.
- media freshness/thumbnail/Explore/public profile 불일치.
- 공개/비공개 비용 또는 기능 회귀.
- 위 항목 발생 시 다른 기능 수정 금지, 364 rollback 또는 해당 trigger 경로만 재분해.

## CURRENT NEXT GATE — source 1->2 R10/W3, 364 shared-D1 approval 대기

365 PREVIEW 실기기 확정:
- 공개: D1 **행읽기 R4 / 행쓰기 W2**.
- source 1->2: D1 **행읽기 R10 / 행쓰기 W3**.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**.
- Worker request 각 1.
- 365 same-request canonical-like read dedupe 제품 효과 확인 완료.

원인:
- source/media 전환만 cover/duration/Suno URL 등을 바꿔 legacy `explore_derived_tracks` media projection trigger를 실행.
- source 전환 W3 = canonical tracks W1 + legacy media mirror W1 + shared revision W1.
- 격리 current UPDATE RETURNING trigger chain R9 + canonical like parity R1 = product R10.
- 공개/비공개는 heavy media projection trigger를 깨우지 않아 각각 R4/W2, R3/W2.

다음:
1. 364 compatibility candidate 적용 전 사용자 명시 승인 필요.
2. 승인 시 shared D1 trigger 2개만 교체하고 exact rollback 준비 상태 유지.
3. migration/backfill/delete/user-row rewrite 0.
4. 적용 직후 같은 A곡 source 1->2 실기기 재측정.
5. product 목표: 약 **R5/W3**.
6. 기능/미디어 freshness/공개프로필/Explore 차이 있거나 목표보다 비용이 크면 즉시 rollback.
7. TEST/PRODUCTION이 새 R2 authority로 승격된 뒤에만 357 legacy-mirror removal 별도 승인.
8. 최종 후보 목표: 약 **R4/W2** product 수준 재검증.

보호:
- 공개 R4/W2와 비공개 R3/W2 경로 변경 금지.
- 좋아요/저장하트/UI/thumbnail 변경 금지.
- 전체 scan/rebuild 금지.
- 승인 없는 shared D1 / TEST / PRODUCTION 변경 금지.

## CURRENT NEXT GATE — 365 live 재측정, source R10 이후 364 승인 판단

현재 완료:
- 사용자 실기기 361 결과: 공개 R5/W2, source 1->2 R11/W3, 비공개 R3/W2.
- R11의 추가 D1 read 2개는 publication 후 Feed/Profile이 같은 canonical like_count를 각각 한 번 읽는 중복으로 확정.
- 365는 canonical like authority를 유지하면서 같은 request/track의 두 번째 읽기만 제거.
- Release Audit `37349479060` SUCCESS.
- PREVIEW Worker Release `37349747533` SUCCESS.
- active PREVIEW Worker `0badfdf8-597d-4f69-9a05-b6fb32612f01`.
- TEST/PRODUCTION unchanged.
- shared/user D1 mutation 0.
- 좋아요 쓰기/저장하트/UI/thumbnail 변경 0.

다음 사용자 실기기 테스트:
1. 같은 A곡 공개.
2. 같은 A곡 source 1->2.
3. 비공개.
4. CACHE LIVE D1 **행읽기 R / 행쓰기 W** 기록.
예상:
- 공개 R4/W2.
- source R10/W3.
- 비공개 R3/W2.

다음 판단:
- 예상대로면 Worker-only 중복 읽기 제거 완료.
- source R10의 남은 큰 비용은 shared D1 legacy trigger fanout.
- 364 compatibility candidate는 isolated 기준 trigger 부분 R9->R4를 증명했으며 old TEST/PRODUCTION 호환 유지.
- 그러나 364는 shared D1 trigger 변경이므로 **사용자 명시 승인 전 적용 금지**.
- 승인 시 exact rollback 준비 상태에서 2개 trigger만 교체 후 즉시 실기기 source 전환 재측정.
- 목표: 364 적용 뒤 source **약 R5/W3**.
- TEST/PRODUCTION 승격 후 legacy mirror 제거 357은 별도 승인으로 최종 R4/W2 수준 재검증.

## CURRENT NEXT GATE — PREVIEW 361 live 재측정 + 364 shared-D1 승인 대기

현재 완료:
- PREVIEW Worker 361 read compaction 배포 완료.
- Release Audit `37344089981` SUCCESS.
- PREVIEW Worker Release `37344481780` SUCCESS.
- active PREVIEW Worker: `368d64ac-6b66-4023-88ec-a3ed85068844`.
- TEST/PRODUCTION Worker unchanged.
- shared/user D1 mutation 0.
- UI/좋아요/저장하트/thumbnail 변경 0.

비용 기준은 모두 D1 물리 행:
- 현재 source swap exact trigger chain isolated: **R9/W3**.
- 364 legacy-compatible candidate: **R4/W3** PASS.
- all-new-environment 357 candidate: **R3/W2** 가능하지만 TEST/PRODUCTION old reader 때문에 아직 미적용.
- registered 공개/비공개 trigger path: **R2/W2** guard PASS.

다음 작업:
1. 사용자 PREVIEW 실기기에서 정확히 같은 A 곡으로
   - 공개,
   - source 1->2,
   - 비공개
   를 한 번씩 수행하고 CACHE LIVE의 **D1 행읽기 R / 행쓰기 W**를 기록.
2. 361 배포 후 product 값과 isolated 값의 차이가 남으면 request-level D1 query count와 trigger rows를 다시 분리.
3. 364 shared-D1 candidate는 **사용자 명시 승인 전 적용 금지**.
4. 364 적용 승인 시:
   - 적용 전 exact trigger DDL backup.
   - shared D1 trigger 2개만 교체.
   - 사용자 row/backfill/delete 0.
   - 즉시 source swap 실측.
   - 목표 R4/W3 이하가 아니거나 기능 차이 있으면 즉시 rollback.
5. TEST/PRODUCTION이 새 R2 authority로 승격된 뒤에만 357 legacy-mirror removal을 별도 승인 받아 최종 R3/W2 후보 검증.

절대 금지:
- 좋아요/저장하트 수정.
- UI/CSS/반응형 수정.
- 전체 scan/rebuild.
- 사용자 데이터 migration/backfill/delete.
- 승인 없는 shared D1 trigger 적용.
- 승인 없는 TEST/PRODUCTION 승격.

## CURRENT NEXT GATE — A 한 곡 mutation Rows Read 1순위 감사/절감

우선순위:
1. A 공개 / 1->2 source 전환 / 비공개 **physical D1 Rows Read 최소화**.
2. physical Rows Written <=2.
3. Worker request <=1.
4. Firestore hot path W0.
5. 기능/UI/좋아요/저장하트/thumbnail 비변경.

현재 실기기 캡처:
- A-track mutation들에서 R11 / R8 / R3가 관측됨.
- 현재 W3->W2 isolated candidate만으로는 product Rows Read 문제를 해결한 것으로 보지 않음.

다음 작업:
- 각 mutation의 D1 query 수와 meta.rows_read를 statement/trigger 단위로 분해.
- PK exact lookup, track_stats join, public profile lookup, legacy derived trigger, shared revision trigger를 각각 분리 측정.
- 불필요한 D1 lookup은 이미 전달된 inline source/R2/shared-card/device state로 대체 가능한지 검증.
- 전체 collection/owner scan 금지.
- read 감소가 기능/동기화/정확성을 깨면 적용 금지.
- read 경로가 확정된 뒤에만 기존 357 W3->W2 write cutover를 함께 적용 판단.

## CURRENT NEXT GATE — A 한 곡 source 전환 W3를 실제 product W2로 cutover

사용자 목표:
- A 공개 W<=2.
- A 1번곡 -> 2번곡 전환 W<=2.
- A 비공개 W<=2.
- mutation당 Worker<=1.
- Firestore hot path W0.
- 좋아요/저장하트/UI/thumbnail 비변경.

격리 실측 완료:
- Run `37301210759` SUCCESS.
- 공개 W2.
- 현재 source swap W3.
- 357 candidate source swap W2.
- 비공개 W2.
- 즉 목표 sequence **W2/W2/W2가 실제 Cloudflare D1 billing 기준으로 가능함을 확인**.
- shared user data write 0, temp DB 삭제 PASS.

남은 작업은 새로운 최적화가 아니라 **안전한 실제 cutover 순서**:
1. 357 candidate 자체는 고정. 더 이상 A-track write 구조를 넓혀 수정하지 않음.
2. shared D1 trigger는 3환경 공용이므로 old TEST/PRODUCTION이 legacy media mirror에 의존하는 동안 적용 금지.
3. 사용자가 TEST 승격을 승인하면 exact PREVIEW R2 compatibility를 main/TEST로 승격하고 A-track/Explore parity 검증.
4. PRODUCTION은 명확한 승인 전 변경 금지.
5. 모든 active environment가 R2 media authority를 이해한 뒤에만 별도 승인으로 357 shared-D1 trigger cutover.
6. cutover 직후 사용자 동일 fixture로 공개 -> 1->2 -> 비공개를 재측정하여 W2/W2/W2가 아니면 즉시 중단/rollback.

금지:
- read 최적화로 범위 이동.
- first-public W12 작업과 섞기.
- 좋아요/저장하트 변경.
- 사용자 데이터 migration/backfill/delete.
- 승인 없는 shared D1 / TEST / PRODUCTION 변경.

## CURRENT NEXT GATE — A 한 곡 publication mutation W3 제거

현재 사용자 목표만 본다:
1. A 공개: physical D1 W2 이하.
2. A 1번곡 -> 2번곡 전환: physical D1 **W3 -> W2 이하**.
3. A 비공개: physical D1 W2 이하.
4. 각 mutation Worker 1 이하.
5. Firestore hot path W0.
6. 좋아요/저장하트/UI/thumbnail 변경 금지.

현재 실측:
- 세 mutation 캡처에 W3 1건 + W2 2건.
- 기존 분석상 W3는 source/media 전환:
  canonical tracks W1 + legacy derived mirror W1 + shared revision W1.

현재 작업:
- 357 source-swap W2 candidate 유지.
- 360 A-track scope verifier를 hard gate로 사용.
- 불필요한 read 최적화는 이 작업에서 제외.
- 다음 검증은 candidate의 실제 physical rows_written을 격리 D1에서 확인하고 W2인지 고정.
- W2 두 정상 경로는 회귀검사만 하고 구조 변경 금지.

실제 shared D1 cutover 전 필수:
- TEST/PRODUCTION old read path 영향 해소 또는 동일 R2 compatibility 승격.
- shared D1 trigger 변경은 사용자 승인 없이 실행 금지.
- main/TEST 승격은 사용자의 테스트배포 승인 전 금지.
- PRODUCTION은 명확한 정식배포 승인 전 금지.

합격:
- A 공개 W<=2.
- 1->2 전환 W<=2.
- 비공개 W<=2.
- Worker<=1 each.
- PC/mobile 기능 parity.
- 사용자 데이터 migration/backfill/delete 0.

## CURRENT NEXT GATE — PREVIEW live backend PASS, 사용자 실사용 검증 후 TEST 판단

현재 완료:
- PREVIEW Worker app358 R2-only read flag 실제 ON.
- active PREVIEW Worker version `afbb5d00-a489-4c48-8b02-9ad6f1795bb0`.
- deploy Run `37293663953` SUCCESS.
- latest/popular/profile tracks/genre/search live D1 R0/W0 PASS.
- public-like changed-card 및 warm revision D1 R0/W0 PASS.
- TypeScript / Build / Phase-B integration / release audit PASS.
- TEST/PRODUCTION Worker unchanged.
- shared D1/user data migration 0.

다음은 사용자 PREVIEW 실사용 최소 확인:
1. PC와 모바일에서 Explore 최신/인기 진입 후 목록/썸네일/좋아요 표시가 기존과 동일한지.
2. 공개프로필 진입 및 곡 목록이 누락/중복 없이 보이는지.
3. 제목/장르/아티스트 검색 정상인지.
4. 본인 곡 1개로 공개→비공개→같은 source 재공개가 정상인지.
5. 가능하면 공개곡 source 1↔2 전환 후 카드 음원/썸네일이 바로 맞는지.
6. 좋아요/저장하트 PC↔모바일 즉시동기화가 기존 정상 상태인지.
7. CACHE LIVE에서 idle/re-entry 불필요 Worker/D1 증가가 없는지.

실사용에서 이상이 없으면:
- 그 다음에만 TEST 승격 판단.
- TEST 승격 승인 전 main 변경 금지.
- PRODUCTION 명확한 승인 전 production 변경 금지.
- cross-env read compatibility가 PRODUCTION까지 검증되기 전 shared D1 W12→W2 migration 적용 금지.

## CURRENT NEXT GATE — 358 hard integration PASS, TEST 승격 전 cross-env blocker 유지

확정 완료:
- dormant 358 R2-only read source 구현 완료.
- flag default OFF.
- Feed/Profile/Genre R2-only normal authority 정적 PASS.
- app341 Search R2-only 보호 PASS.
- R2 catalog Phase-B integration을 release audit hard gate로 연결.
- Run `37247619845` SUCCESS:
  - TypeScript PASS
  - Build PASS
  - latest/popular/profile deep paging PASS
  - title/genre/artist search PASS
  - private/republish marker PASS
  - first-publisher idempotency PASS
  - TEST/PRODUCTION Worker dry-run PASS
- Worker/Hosting/shared D1/user data 변경 0.

현재 blocker:
- main/TEST/production은 336/341/358 read compatibility가 아직 승격되지 않음.
- 사용자 TEST 승격 승인 전 main 변경 금지.
- PRODUCTION 명확한 승인 전 production 변경 금지.
- 358 flag ON 금지.
- shared D1 fanout 축소 migration 적용 금지.

다음 실제 작업:
1. PREVIEW source는 이 상태로 고정.
2. 사용자가 TEST 승격을 승인하면 exact PREVIEW tree 전체를 main/TEST로 승격하고 실제 parity 검증.
3. TEST에서 336/341/358 compatibility와 기존 좋아요/저장하트/follow/thumbnail/publication W2 경로가 모두 정상인지 확인.
4. 그 뒤에도 PRODUCTION 승인 전에는 shared D1 cutover를 적용하지 않음.
5. PRODUCTION까지 같은 read compatibility가 승격·검증된 이후에만 source-swap W2 candidate와 first-public W12→W2 fanout cutover 적용 여부를 다시 판단.

## CURRENT NEXT GATE — dormant 358 PASS 후 cross-env R2 read compatibility 승격 준비 감사

현재 완료:
- PREVIEW source에 dormant `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1` 구현 완료.
- Feed/Profile/Genre R2-only normal path D1 R0/W0 정적 검증 PASS.
- Search app341 R2-only 보호 PASS.
- Release System Audit `37233167868` SUCCESS.
- flag default OFF, Worker/Hosting/shared D1 배포 0.
- user data 변경 0.

다음은 **배포/branch 승격 없이 read-only 준비 감사**:
1. main/TEST/production source에 336 hybrid + 341 search R2-only + 358 dormant gate가 없는 현재 blocker를 정확히 고정.
2. TEST 승격 시 기존 기능/좋아요/저장하트/follow/thumbnail과 충돌 없이 동일 Worker tree를 받을 수 있는지 release promotion dry-run 기준으로 확인.
3. 358 flag는 모든 환경에서 코드 호환이 확인될 때까지 OFF 유지.
4. source-swap W2 candidate migration과 first-public W12→W2 shared-D1 fanout 축소는 계속 PREP ONLY.
5. 사용자가 TEST 승격을 승인하기 전 main 변경/TEST 배포 금지.
6. PRODUCTION은 명시적 정식배포 승인 전 변경 금지.

통과 기준:
- TypeScript/Build/Release System Audit PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- 336/341/358 code가 같은 tree로 승격 가능.
- shared canonical D1/R2 binding 유지.
- 좋아요/저장하트 즉시동기화 및 +30초 canonical 경로 비변경.
- registered private/re-public W2 경로 비변경.
- shared D1/user data write 0.

차단:
- main/production이 358 이전 source이므로 지금 shared D1 trigger/index fanout 제거 금지.
- 358 flag ON 금지.
- TEST 승격 승인 없이 main 변경 금지.

## CURRENT NEXT GATE — first-public W12→W2를 위한 dormant R2-only publication read cutover 설계/구현

확정된 physical fanout:
- tracks row+PK+4 applicable secondary indexes = W6.
- explore_derived_tracks row+PK+3 rank indexes = W5.
- shared revision = W1.
- 합계 W12.
- Worker는 1회이므로 Worker 중복 문제가 아님.

목표:
- 기존 `tracks` table/id PK를 유지한 현실적 first-public floor **W2**.
- source swap도 최종적으로 W1~W2.
- Worker mutation 1회 유지.
- Firestore publication hot path R0/W0 유지.

다음 구현은 **배포/공유 D1 적용 없이 dormant source만**:
1. PREVIEW Worker에 R2-only publication-read cutover flag를 추가.
   - default OFF.
   - OFF일 때 app336 hybrid behavior byte/semantic parity.
   - ON일 때 Feed/Profile/Genre/Search의 Music Note 공개 목록은 R2 catalog/shared-card authority.
   - stale legacy row가 private/reswap 상태를 되살리지 못해야 함.
2. exact track detail / owner mutation lookup은 deterministic track id + primary key를 계속 사용.
3. cutover verifier:
   - public new track appears from R2 without legacy derived row.
   - source swap uses R2 media authority.
   - private tombstone/meta suppresses stale legacy item.
   - title/genre/artist search remains available.
   - first page/deep page/profile pagination exactness.
   - normal warm read D1 R0.
4. current source-swap W2 candidate migration은 그대로 PREP ONLY.
5. R2-only cutover가 모든 환경에서 승격/검증된 뒤에만 별도 shared-D1 candidate:
   - Music Note를 four secondary index hot fanout에서 제외.
   - Music Note `explore032_track_insert` derived insert skip.
   - Music Note shared revision D1 write retire 여부 검증.
   - expected first publish: tracks row W1 + PK W1 = W2.
6. shared migration/backfill/delete/cutover/deploy 금지.

절대 보호:
- PC↔모바일 저장하트 즉시동기화.
- +30초 canonical W0/W1.
- registered private/public 현재 W2 behavior.
- app353 thumbnail media overlay.
- TEST/PRODUCTION 비변경.

## CURRENT NEXT GATE — source-swap W2 후보 PASS, cross-env hybrid 호환 전 shared D1 적용 금지

현재 완료:
- source swap baseline Worker1 / D1 R11 W3 / Firestore0 원인 분해 완료.
- post-hybrid candidate: tracks W1 + shared revision W1 + derived media mirror W0 = **W2 예상**.
- migration + rollback + verifier 준비 완료.
- Release System Audit `37231798452` SUCCESS.
- Worker 추가 요청 없음: 목표 Worker 1 유지.
- shared D1/Worker/Hosting 배포는 아직 0.

안전 blocker:
- PREVIEW는 R2 hybrid-read compatibility가 있으나 현재 main/TEST/PRODUCTION 기준은 아직 legacy derived freshness를 요구.
- shared D1 trigger는 환경 공용이므로 TEST/PRODUCTION 호환 전 migration 적용 금지.

다음 진행:
1. 배포 없이 first-publication W12 physical write fanout도 계속 분해/후보 설계.
2. source-swap W2 실제 적용은 향후 **TEST 승격 승인**으로 hybrid compatibility가 main/TEST에 들어간 뒤에도 PRODUCTION 구버전 영향까지 확인할 것.
3. PRODUCTION hybrid 지원 전 shared-D1 legacy media mirror 제거가 안전하지 않으면 그대로 차단.
4. 최종 cutover 때 same fixture:
   - Worker 1 이하.
   - D1 physical W2 이하.
   - Firestore W0.
   - private/re-public W2 회귀 없음.
   - PC↔모바일 저장하트 즉시동기화 회귀 없음.

금지:
- 좋아요/저장하트 즉시동기화 변경.
- 정상 private/re-public W2 경로 변경.
- 사용자 데이터 migration/backfill/delete.
- 승인 없는 main/TEST/PRODUCTION 변경.
- cross-env blocker를 무시한 shared D1 trigger 적용.

## CURRENT NEXT GATE — Rows Written 우선: source-swap W3→W2 먼저, Worker 1 상한 동시 검증

우선순위:
1. **physical D1 Rows Written 감소가 최우선.**
2. Rows Read 감소.
3. Worker 요청 수: mutation당 1 이하 / idle 0.
4. 기능/동기화 보존.

source-swap 현재:
- Worker 1 / D1 R11 W3 / Firestore W0.
- W3 구성:
  - canonical tracks W1 — 필수, 유지.
  - legacy explore_derived_tracks mirror W1.
  - shared revision W1.
- 목표: 기능 유지하면서 후자 2개 중 하나를 안전하게 제거/대체하여 **W2 이하**.

감사 요구:
- PREVIEW/TEST/PRODUCTION 구 Worker가 legacy derived row / shared revision 중 무엇을 실제 read/freshness authority로 쓰는지 각각 확인.
- Worker가 mutation 후 exact feed/profile R2를 이미 patch하므로 PREVIEW 새 경로에서 중복 D1 mirror/revision이 정말 필요한지 분리.
- 제거 후보는 old TEST/PRODUCTION과 동시 동작 가능한 hybrid-read/cutover 조건을 충족해야 함.
- physical Rows Written, Rows Read, Worker request count를 같은 fixture에서 baseline vs candidate로 비교.
- Worker 요청이 1→2 이상 늘면 D1 W가 줄어도 FAIL.
- first-public W12는 source-swap W2 설계 검증 뒤 같은 원칙으로 fanout 분해/축소.

금지:
- 좋아요/저장하트 즉시동기화 변경.
- registered public/private W2 경로 변경.
- 사용자 데이터 migration/backfill/delete.
- shared trigger/schema 제거 또는 cutover를 감사/승인 없이 실행.
- Worker 배포를 비용 실측 전에 진행.

## CURRENT NEXT GATE — publication 비용: W2 정상 경로 보호, source-swap W3 / first-public W12만 분리 최적화

보호:
- registered public→private R3/W2 실기기 PASS.
- same-source private→public R5/W2 실기기 PASS.
- 이 두 정상 경로는 더 건드리지 말 것.
- app348/app349 PC↔모바일 즉시 좋아요/저장하트 동기화 변경 금지.

미완료:
- Suno source swap R11/W3 = known HARD FAIL.
- never-published first publication R7/W12 = known HARD FAIL.

다음 감사/설계:
1. source swap W3에서 canonical tracks W1은 유지.
2. legacy derived W1 / shared revision W1 중 어떤 것을 구버전 TEST/PRODUCTION 호환을 깨지 않고 제거/대체 가능한지 독립 감사.
3. first-public W12도 동일한 hybrid-read/cutover 설계와 함께 전체 fanout을 O(1) W1~W2로 줄이는 경로 검토.
4. shared user data migration/backfill/trigger 제거는 사용자 승인 전 실행 금지.
5. 후보 Worker/D1 변경은 PREVIEW에서도 독립 감사 완료 전 배포 금지.

## CURRENT NEXT GATE — 좋아요 동기화 동결 유지 + 공개/비공개 registered W2 격리 확인

절대 보호:
- app348/app349의 PC↔모바일 즉시 저장하트 동기화 기능 변경 금지.
- 비용 절감을 이유로 app302 방식(상대 기기 +30초 지연)으로 되돌리기 금지.
- same-device/other-device 즉시 UI + canonical 마지막 클릭 +30초 W0/W1 계약 유지.

현재 공개 비용 상태:
- never-published first publish 사용자 실측: D1 R7/W12 = app335 known baseline, 여전히 HARD FAIL.
- 같은 테스트에서 Browser SDK `users:write 1` 관측: publication 자체 write인지 delayed users batch인지 미분리.
- 직후 private 캡처: Worker0/D1 R0W0. optimistic local-first 직후 캡처 가능성이 있어 server settlement PASS로 간주 금지.

다음 실기기 최소 테스트:
1. registered public 곡 → CACHE LIVE 초기화 → private → 성공 토스트 + 2~3초 대기.
   기대: Worker1 / D1 W2 / Firestore W0.
2. 같은 곡 same-source re-public → 성공 토스트 + 2~3초 대기.
   기대: Worker1 / D1 W2 / Firestore W0.
3. `users:write`가 두 테스트에서 반복되는지 확인.
4. 결과 전에는 publication/like 코드를 수정하지 말고 진단만 진행.

## CURRENT NEXT GATE — app353 썸네일 경로 동결, follow 저비용 Worker 감사로 복귀

현재 PREVIEW:
- Hosting app **353** / Firebase Run `37228706933` SUCCESS / exact build PASS.
- Release System Audit `37228542810` SUCCESS.
- 사용자 PC 실기기에서 Music Note 썸네일 수정 PASS 확인.
- 썸네일 경로는 보호 기준으로 동결.
- 정상 모바일, app349 heart 즉시동기화, +30초 canonical settlement도 보호.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 변경 0.

다음 작업:
- 기존 계획대로 **follow 저비용 Worker 독립 감사**로 복귀.
- 전체 조회/반복 read-write/불필요 fanout 여부를 먼저 감사하고, 문제를 확인한 경우에만 preview에서 최소 수정.
- 썸네일, Music Note media overlay, canonical-id writeback은 회귀 증거 없이 변경 금지.
- 배포 요청 전에는 PREVIEW 코드 검증까지만 진행.

## CURRENT NEXT GATE — app353 PC Catalog 재진입 우선순위 실기기 확인

현재 PREVIEW:
- Hosting app **353** / Firebase Run `37228706933` SUCCESS / exact build PASS.
- Release System Audit `37228542810` SUCCESS.
- root cause: Detail/list의 media patch보다 V4 full Catalog authority가 재진입 때 우선되어 thumbnail을 되돌림.
- fix: exact Detail/save media를 bounded local media overlay에 기록 + App local row/cache writeback을 `firestoreId || id` canonical identity로 통일.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 0.

사용자 확인:
1. PC에서 app353 로드.
2. `빛속의 오답`, `무거운 발걸음` Detail을 각각 한 번 열고 닫아 thumbnail 표시 확인.
3. **Explore로 이동했다가 Music Note로 돌아오기** — 이전 영상에서 실패하던 핵심 단계. thumbnail이 유지되어야 함.
4. 새로고침 후 유지.
5. 브라우저 완전 종료/재실행 후 유지.
6. 가능하면 새 Suno URL/media 1건 저장 후에는 Detail 재오픈 없이 3~5번 모두 유지되는지 확인.

참고:
- app353 이전에 만들어진 PC의 과거 row는 dedicated media overlay 자체가 없을 수 있으므로 최초 1회 Detail open으로 exact media를 로컬에 기록하는 확인이 필요할 수 있음.
- app353 이후 새 저장은 저장 시점에 overlay도 같이 생성됨.

PASS면:
- app349 heart settlement + app353 PC media Catalog-priority 경로를 보호 기준으로 동결.
- 썸네일 이슈 종료 후 follow 저비용 Worker 독립 감사로 복귀.

FAIL이면:
- 서버 수신/이미지 다운로드/전체 Catalog 읽기로 우회하지 말 것.
- 영상에서 확정된 `Catalog onData -> setFavorites authoritative merge` 이후 실제 row의 media field만 계측/추적.
- 정상 모바일, 하트 즉시동기화, +30초 canonical, UI는 변경 금지.

## CURRENT NEXT GATE — app352 PC 목록↔Detail 동일곡 썸네일 확인

현재 PREVIEW:
- Hosting app **352** / Firebase Run `37227428264` SUCCESS / exact build PASS.
- Release System Audit `37227306745` SUCCESS.
- 핵심 수정: 목록 media patch/overlay를 `firestoreId` 우선 canonical document identity로 통일.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 0.

이번에는 새 곡을 만들 필요 없음.
1. PC에서 app352로 갱신.
2. 사용자가 이미 보여준 `빛속의 오답` 또는 `무거운 발걸음`처럼 **Detail & Edit에서 Suno cover가 보이는 기존 곡**을 기준으로 확인.
3. Detail을 닫았을 때 Music Note 목록 왼쪽 media slot에 같은 cover가 즉시 보이는지 확인.
4. PC 새로고침 후 유지되는지 확인.
5. 브라우저 완전 종료/재실행 후 유지되는지 확인.

PASS면:
- app349 heart settlement + app352 media canonical identity를 보호 기준으로 동결.
- 이 썸네일 경로 종료 후 follow 저비용 Worker 감사로 복귀.

FAIL이면:
- 이제 데이터 수신 문제로 되돌아가지 말 것. Detail에 같은 PC에서 cover가 보이는 사실을 기준으로 **목록 row state/render 경로만** 추적.
- 전체 Music Note reread/cache reset/Firestore per-song scan 금지.
- 정상 모바일, 하트 즉시동기화, +30초 canonical, Detail hydration은 변경 금지.

## CURRENT NEXT GATE — app351 PC Suno thumbnail reload/restart 실기기 확인

현재 PREVIEW:
- Hosting app **351** / Run `37226652526` SUCCESS / exact build PASS.
- Release System Audit `37226502953` SUCCESS.
- PC receiver media persistence fix source: `46079ef2d7aa29e9b4967d689fbf817d4f3e70d9`.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 0.

사용자 확인 순서:
1. PC/모바일을 app351로 갱신.
2. 과거 이미 캐시에서 사라진 곡보다 **새 테스트 곡**이 가장 정확함. 모바일 또는 한 기기에서 Suno URL/media를 새로 저장해 changed-item signal 1회를 발생.
3. 반대 PC Music Note 목록에서 썸네일이 즉시 보이는지 확인.
4. PC 새로고침 후 유지되는지 확인.
5. PC 브라우저 완전 종료/재실행 후 유지되는지 확인.
6. 하트와 Music Note membership은 즉시, 마지막 클릭 +30초 뒤에도 상태 유지하는지 같이 확인.

합격하면:
- app349 저장하트/Music Note + app351 Suno media 지속성 경로를 함께 보호 기준으로 문서화.
- 해당 경로는 다시 열지 않고 follow 저비용 Worker 독립 비용 감사로 복귀.

FAIL이면:
- 전체 Music Note reread/cache reset 금지.
- exact favorite-id media overlay / Catalog merge 경로만 좁혀 수정.
- Firestore/D1 추가 read/write로 우회 금지.
- 정상 모바일 경로와 app349 heart settlement는 변경 금지.

## CURRENT NEXT GATE — app349 실기기 4포인트 확인 + follow Worker 독립 정적 감사 계속

현재 실제 PREVIEW:
- Hosting app **349** / Run `37224986893` SUCCESS / exact build PASS.
- product commit `53646fce918060f5bcb376af9a31a5e0acd05e6c`.
- Release System Audit `37224853496` SUCCESS.
- Studio save-heart/Music Note 기준은 app349 Skill로 동결.
- PREVIEW live Worker는 Worker341 rollback본 `9c11b95cf4c95210011b1425cea23f3e51cbf34f` 유지.
- follow cutover OFF / migration-backfill-user-data change 0.

사용자 실기기 최종 확인:
1. PC → 모바일 save/unsave 즉시 하트 + Music Note membership 반영.
2. 모바일 → PC 반대 방향도 즉시 반영.
3. 마지막 클릭 +30초 canonical settlement 뒤 양쪽 상태 유지, 저장 row 순간 소실 없음.
4. Detail의 Suno URL/media/thumbnail이 목록에 즉시 보이고 새로고침/재실행 후에도 유지.

동시에 계속할 수 있는 비배포 감사:
- current preview의 candidate Worker source blob은 Worker341-parity fix commit `e312cfdea8b4c047aa8309506e8ebc78d9ed1bf2`의 Worker blob과 동일함.
- `scripts/verify-356-follow-worker341-legacy-parity.mjs`는 legacy counter mutation과 post-mutation R2 sync를 Worker341 함수와 exact-equality로 비교하고, overlay router 외 legacy core 차이를 금지함.
- 다음 단계는 candidate legacy mode의 실제 D1 physical Rows Read/Written + R2 write를 Worker341 동일 fixture와 독립 비교하는 것.
- 이 감사 전 candidate Worker deploy / follow cutover / shared migration / main·TEST·PRODUCTION 승격 금지.

## CURRENT NEXT GATE — app348 실기기 최종 4포인트 확인

현재 PREVIEW:
- Hosting app **348** / Run `37222387192` SUCCESS / exact build PASS.
- product commit `441a256106d95427bfc5926f5a0c83d4bf4151d5`.
- Release System Audit `37222258188` SUCCESS.
- Studio save-heart 기준은 app348 Skill로 동결.
- Worker는 기존 Worker341 rollback본 유지, follow cutover OFF.
- 사용자 데이터 migration/backfill/delete 0.

사용자가 확인할 것:
1. PC에서 A곡 save/unsave → 모바일 Recent 하트와 Music Note membership이 즉시 바뀌는지.
2. 모바일에서 B곡 save/unsave → PC가 즉시 바뀌는지.
3. 마지막 클릭 +30초 뒤 canonical settlement가 되어도 양쪽이 같은 상태를 유지하는지.
4. Detail에서 Suno URL/media를 넣은 곡의 Music Note 목록 thumbnail/media가 사라지지 않는지.

합격 시:
- app348 Studio heart/Music Note save sync 복구 종료.
- 이 기능은 다시 열지 않고 app348 Skill 보호.
- 그 뒤 팔로우 저비용 Worker 독립 audit/cost 작업으로 복귀.

FAIL 시:
- 전체 Music Note reread/cache reset 금지.
- exact changed song / exact preview layer만 bounded 수정.
- 30초 canonical final-state 및 immediate cross-device behavior는 변경 금지.

## CURRENT NEXT GATE — app347 PC↔모바일 저장하트 / Music Note 실사용 재정합 확인

현재 실제 PREVIEW:
- Hosting app **347** / Run `37220292148` SUCCESS / exact build PASS.
- product fix `976037b932b6ee1606206939494b5a660cd5659c`.
- Release System Audit `37220098629` SUCCESS.
- Worker는 기존 Worker341 rollback본 유지. follow cutover OFF.
- shared/user data migration/backfill/delete 0.

우선 확인:
1. PC/모바일 둘 다 app347 로드.
2. A곡: PC에서 save/unsave → initiating device 즉시 반영 → 마지막 클릭 +30초 canonical 뒤 모바일이 별도 route/tab/refresh 없이 같은 상태.
3. B곡: 모바일에서 반대 방향으로 같은 확인.
4. 각 곡에서 Recent 하트와 Music Note 실제 membership이 1:1 일치.
5. 새 저장곡 Detail에 Suno URL/두 media를 넣은 뒤 목록 thumbnail/media가 사라지지 않음.
6. Firestore/D1는 receiver에서 추가 read/write 0 유지.

이미 app346에서 꼬여 있던 A/B가 app347 로드 후에도 그대로 남으면:
- 전체 Music Note 재조회/전체 cache reset 금지.
- stale pending exact document / stable identity만 대상으로 bounded recovery.
- 정상 app302 30초 final-state, app301 folder, Recent 150초 text batch, Explore like는 변경 금지.

## CURRENT NEXT GATE — app346 PREVIEW 실사용 UX 확인 + candidate Worker 독립 gate

현재 실제 PREVIEW:
- Hosting app **346** / Firebase Run `37217908194` SUCCESS / exact build PASS.
- PREVIEW Worker는 rollback된 Worker341 source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`, active version `35a0bb0a-f547-4f4a-84ab-d55ba075ba13` 유지.
- mandatory follow audit `37217745269` SUCCESS: TypeScript/Build, 347~355, 356 legacy parity, immediate UX rollback/cost guard PASS.
- shared follow cutover OFF, migration/backfill/user-data change 0.

지금 확인할 것:
1. PC + mobile 공개프로필 follow/unfollow 클릭 즉시 버튼/숫자가 바뀌고 5~7초 blocking 체감이 사라지는지.
2. Following 필터에서도 같은 클릭이 즉시 포함/제외로 반영되는지.
3. Explore publication settings save/private가 화면에서 즉시 반영되고 실패가 없을 때 그대로 유지되는지.
4. 기존 좋아요 / Music Note publication / 검색 / creator / UI는 비변경인지.
5. page entry/revisit 때문에 새 backend write가 생기지 않는지.

candidate Worker 재배포 전 필수:
- Astra independent re-audit.
- Worker341 legacy mutation/post-sync exact parity 재확인.
- 가능한 동일 synthetic fixture에서 Worker341 vs candidate legacy physical D1 Rows Read/Written + R2 write 수 비교.
- candidate legacy mode에서 `SORIDRAW_FOLLOW_COMBINED_COUNTERS_345`, `syncExactSharedFollowing347`가 실행되지 않음을 유지.
- 이 gate 전에는 Worker deploy / shared cutover manifest / D1 migration / main·TEST·PRODUCTION 승격 금지.

## UX ACCEPTANCE — follow/public-private immediate local response

Alongside the Worker341 legacy parity blocker:
- Explore public-profile follow button/count must reflect requested state immediately; do not show a 5~7s blocking spinner while waiting for server.
- Keep one in-flight mutation guard per target; server settlement remains authoritative.
- On server failure/conflict, rollback exact previous local state and show the existing error notice.
- Explore public-profile publication save/private paths must use the same local-first behavior where safe: visible state changes immediately, backend settles after, exact rollback on failure.
- Preserve existing Music Note app330/331 optimistic publication behavior; do not rewrite it.
- This UX work must add **zero extra D1/Firestore/R2 reads/writes** and must not alter backend cost paths.
- Add focused regression proving immediate local state before a delayed mocked server response and rollback after rejection.

## CURRENT TASK — preserve Worker341 legacy follow path inside candidate355 compatibility Worker

Current live PREVIEW after regression rollback:
- Hosting app345 remains deployed.
- PREVIEW Worker is rolled back to Worker341 code source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`; rollback Run `37214678869` SUCCESS.
- Shared follow cutover OFF.
- User observed candidate legacy physical rows R23/W14 and R17/W17, so candidate Worker is blocked.

Required fix on `preview` source:
1. When `readFollowCutoverState348(env)` resolves legacy mode, follow mutation must preserve Worker341 behavior/cost exactly:
   - original 246 `adjustExploreFollowCountersDelta` legacy statements/ordering,
   - original legacy rate limit,
   - original post-mutation R2 sync/cache invalidation behavior.
2. Do not run `SORIDRAW_FOLLOW_COMBINED_COUNTERS_345` or `syncExactSharedFollowing347` in legacy mode.
3. Keep 348/354/355 overlay implementation dormant and reachable only when fully armed cutover manifest is present.
4. Do not change likes/public-private/search/creator/UI or shared data.
5. No migration/backfill/cutover/deploy during implementation.

Verification:
- Static/function diff proving legacy follow path equivalent to Worker341.
- Existing 347~355 tests plus new legacy-parity regression.
- TypeScript/Build.
- Isolated legacy D1 measurement against Worker341 and candidate: physical Rows Read/Written must match within same fixture; no extra R2 compatibility writes in legacy mode.
- Astra independent re-audit before candidate Worker PREVIEW redeploy.

## NEXT TASK — app345 PREVIEW live follow compatibility verification

Current deployed PREVIEW:
- app 345 exact build PASS.
- PREVIEW Worker version `2e544865-0392-4dbe-8cc0-28e1b8a01fb6`.
- Worker Run `37213658493` SUCCESS; Hosting Run `37213744061` SUCCESS.
- candidate355 compatibility code deployed, but shared follow cutover remains OFF. Legacy authority/data behavior must stay unchanged.

Focused verification before any cutover:
1. PC + mobile existing follow state remains identical to pre-deploy.
2. Follow / unfollow in current legacy mode remains functionally normal.
3. Existing 5,000-cap cache regression does not create false unfollow on a second device.
4. No unexpected loading/spinner/profile count regression on Explore/public profile.
5. Worker/D1/R2 diagnostics: page/revisit unchanged cost behavior; no new write on page entry.
6. Confirm TEST/PRODUCTION and shared user data unchanged.

Do NOT activate `explore_follow_overrides_348`, write shared cutover manifest, run backfill/migration, or promote main/TEST/PRODUCTION during this verification.

## NEXT TASK — candidate355 PREVIEW code-only compatibility deploy + live verification

Current code audit status:
- `preview` candidate `f8e2d1830f237a94abd064795c5be325171746ff`: Astra independent re-audit PASS.
- No deployment yet. Live baseline remains app344 / PREVIEW Worker341.

When PREVIEW deployment is requested:
1. Fix exact target commit and run TypeScript / Build / required follow verifiers.
2. Deploy only the code-compatible app/Worker pieces needed for candidate355.
3. **Do not create/arm shared cutover manifest and do not run shared D1 migration yet.**
4. Confirm legacy mode remains behaviorally unchanged on preview.soridraw.com.
5. Verify no unintended Firebase/Functions/shared user-data change.
6. Then perform focused PC/mobile checks and collect actual Worker/R2 request-cost evidence for follow, unfollow, duplicate/no-op and recovery scenarios.
7. TEST/main promotion requires separate user approval. PRODUCTION requires explicit production approval.

Protected:
- likes / public-private / search / creator recommendations / UI.
- no backfill/delete/data copy.
- no shared authority activation while TEST/PRODUCTION old code exists.

## NEXT TASK — independent re-audit of repaired candidate355 legacy schema2 cache blocker

- Implementation base: preview / a6a3053d440245cd91f9f71a6c45c0a153d81800. Audit the final fixed commit; do not modify code or deploy.
- Recheck persisted schema2 complete=true with 5,000 true memberships: missing target uses one targeted follow-state request, never a false inferred from absence or a legacy snapshot hydration. Known cached states remain intact and repeat recovery reads0.
- Confirm healthy complete cache positive/absent reads0, explicit negatives are not counted toward the membership cap, and failed recovery does not persist a false negative.
- No cache/version reset, Worker changes, shared migration/cutover/data write, deployment or main/TEST/PRODUCTION promotion. Earlier live R2/Worker and PC/mobile gates remain open.
- Original implementation task follows as the acceptance record.

## CURRENT TASK — candidate355 legacy schema2 follow cache blocker 1건 수정 (2026-10-05 KST)

기준:
- branch: `preview`
- Astra 재감사 기준 HEAD: `46d21590ceea908353cec2e2a4235e8348404c20`
- 감사 기록 문서 commit: `106bddb49906f1cf696aeab0f6dfb2e1b5b31b35`
- 실제 서비스: app344 / PREVIEW Worker341. 아직 배포 금지.

수정 범위:
- 파일: `src/services/exploreSocialService.ts`
- 함수: `normalizeExploreFollowCache`, `readCachedExploreFollowState`, `loadExploreFollowingBundle`
- 기존 schema2 `complete:true` 캐시 중 과거 5,000 cap으로 생성된 제한 목록을 complete authority로 신뢰하지 않게 수정.
- 누락 target은 false로 단정하지 말고 targeted `/follow-state` recovery.
- 전체 캐시 초기화/버전 강제 reset 금지.
- 정상 complete cache hit은 서버 read 0 유지.
- 새 completeness/truncated/cursor metadata 경로는 그대로 보호.
- 좋아요/공개/비공개/검색/UI/Worker relation writer 변경 금지.

검증:
1. 과거 schema2 capped cache + 누락 target fixture -> targeted follow-state 1회, false 오판 금지.
2. 정상 complete cache + 존재/부재 target -> 서버 read 0.
3. incomplete/truncated cache miss -> targeted recovery.
4. TypeScript / Build.
5. 기존 follow 관련 verifier + 새 legacy-cache regression PASS.
6. 코드 수정 후 commit/push, 배포 없음.
7. Astra 재감사용 고정 commit 보고.

## NEXT TASK — independent Astra re-audit of candidate355 (deployment blocked)

- Branch: preview. Audited implementation code: 634589b2af0aa8041fe394402aa6f3a7a7abdc99; final follow-up is documentation only. Audit the current preview HEAD after checking its Worker/client/test blobs match this code candidate.
- Base: 57acc664f59d9e3c4c110f5a2b6797525dce010e. The eight audit fixes below are implemented and locally verified. TypeScript/build and required regressions PASS; final remote Run [37210263354](https://github.com/andrawing1212/soridraw-music/actions/runs/37210263354) SUCCESS.
- Relation SQL physical W1~W2 retained. Actual HTTP handler against owned synthetic D1: new follow R2/W2, unfollow R6/W1, duplicate R1/W0, no-op R4/W0, stale R1/W0, relation-saved failure R5/W1, recovery R16/W0. RATE_DB W0. R2/native limiter are conditional memory fixtures, not live Worker/R2 billing. Owned D1 deletion PASS.
- Independent audit must cover all eight consumers, crash/reverse/concurrency/CAS/no-op/5001+ membership and malformed/future rate-window guards. Also check pre-cutover cached devices, all-environment compatibility, missing-profile baseline policy and live R2/Worker/PC-mobile limits. No automatic cache reset is authorized.
- No code modification, deployment, shared migration/cutover, user data mutation, TEST/PRODUCTION/main change during the independent audit. PASS/FAIL only; release remains blocked pending independent review and later explicit approvals.
- Original implementation task below is retained as the acceptance checklist.

## CURRENT TASK — protocol354 독립감사 FAIL 8건 수정 (2026-10-04 KST)

기준:
- branch: `preview`
- 감사 기준 commit: `c47f6c6dbca385787b1cd5cd0f5c61585f7a27a7`
- 상태 문서 감사 기록 commit: `daae182450e45602b367cfbcec85ec896d21758a`
- 실제 서비스: app344 / PREVIEW Worker341 유지. 아직 배포 금지.

목표:
protocol354의 relation W1~W2 후보를 유지하면서, 독립감사에서 확인된 reader/cache/profile writer/실제 HTTP 비용 구멍 8개를 최소 수정으로 닫는다.

필수 수정:
1. `patchPublicProfileBundle245`, `writeExploreSharedProfile060`
   - 최신 shared profile을 CAS로 읽고 병합.
   - followerCount/followingCount, exact/pending/recovery/order fence metadata를 오래된 baselineBundle이 되감지 못하게 보존.
   - 일반 프로필 수정은 프로필 필드만 변경.
2. overlay public-profile readers
   - `readSharedProfileConnection348`, public profile, first-view에서 pending/exact 미완료를 정상값으로 반환하지 말 것.
   - 필요한 경우 bounded 351 recovery 또는 fail-closed.
   - frozen legacy `profile_stats` count를 overlay 정상 count로 오인하지 말 것.
3. `handleMySocialSnapshot042`
   - overlay mode follow membership을 legacy R2/`follows` 재생성으로 덮지 말 것.
   - effective overlay reader 또는 안전한 complete snapshot authority로 연결.
   - client `loadExploreFollowingBundle` complete 판정도 서버 completeness와 일치.
4. 353 5,000 cap
   - `handleMyFollowingR2Bundle`이 잘린 목록을 complete로 반환하지 않게 completeness/pagination/truncated 신호 추가.
   - client incomplete cache는 누락 target을 false로 단정하지 말고 개별 follow-state 확인.
5. `handleFollowerSaveAccess`
   - legacy mode는 기존 그대로.
   - overlay mode는 effective membership348 사용.
6. handle cache invalidation
   - follow mutation 성공/중단 후 recovery 모두 target/follower profile의 UID + 실제 handle first-view cache 무효화.
   - stale 304/revision 재사용 금지.
7. no-op 비용
   - 동일 desired state + 새 request id가 relation change 0이면 정상 no-op으로 종료.
   - unresolved pending/crash case만 recovery 수행.
   - no-op에서 exact history SUM/recovery 및 불필요한 R2 writes 금지.
8. 실제 HTTP 비용 측정
   - relation SQL Rows Written와 별도로 `handleFollowOverlay354` 전체 요청의 DB, RATE_DB, R2 read/write를 측정.
   - duplicate/no-op/stale/recovery 경로 포함.
   - 비용 보고에서 relation W와 total request cost를 분리.

회귀 금지:
- 좋아요, 공개/비공개, 검색, 크리에이터 추천, UI/CSS 변경 금지.
- legacy follow mode 동작 변경 금지.
- shared migration/cutover manifest 활성화 금지.
- TEST/PRODUCTION/main 변경 금지.
- 사용자 데이터 write/backfill/delete/migration 금지.
- 전체 follows/profile scan 금지.

검증:
- TypeScript / Build.
- verify-347/348/349/350/351/352/354 + 새 verifier.
- profile edit after follow, crash after relation before R2, public profile/first-view/connection reader recovery, social snapshot cross-device, 5001 following, follower-save access, handle cache, duplicate/no-op, stale/reverse/concurrent request fixtures.
- isolated remote D1 candidate cost 재측정.
- 실제 HTTP 경로 DB/RATE_DB/R2 비용 계측. shared/user DB 사용 금지.
- 변경 후 Astra 독립 감사용 고정 commit 생성.

완료 보고:
- branch/base/final SHA
- 변경 파일
- TS/Build/tests
- relation Rows Read/Written
- total HTTP DB/RATE_DB/R2 비용
- shared/user data 변경 0 여부
- deployment 0 여부
- 남은 위험

## CURRENT TASK — verified follow overlay 348 compatibility implementation (2026-10-04 KST)

확정 근거:
- live schema read-only `37175284793`: current follows + counters + triggers가 physical amplification 원인.
- isolated remote billing `37175419175`: sparse WITHOUT ROWID overlay가 actual D1 W1~W2 / duplicate W0 달성.
- app347 exact following-count compatibility hard audit `37175153805`: PASS.

다음 구현:
1. additive `explore_follow_overrides_348` schema 후보 + cutover control/fence 작성. **실제 shared migration 아직 금지.**
2. legacy follows를 immutable baseline으로 읽고 overlay를 합치는 effective follow reader 구현.
3. follow-state / following list / follower list / Following Feed 관련 모든 reachable reader를 legacy mode와 overlay mode 둘 다 읽을 수 있게 호환.
4. public profile counts는 정확한 R2 social count revision을 우선하고 legacy profile_stats fallback 유지.
5. writer는 shared cutover manifest가 완전히 armed되기 전까지 legacy path만 사용. PREVIEW 단독으로 overlay authority 활성화 금지.
6. 모든 환경 코드가 호환될 때만 user-approved TEST/PRODUCTION 호환층 승격 → 그 뒤 shared cutover 승인 단계.
7. actual PREVIEW cutover 이후 follow/unfollow 3 cycle에서 queryR/W + Rows Read/Written + Worker + R2 A/B 증거 수집. Rows Written W3+면 FAIL.

금지:
- legacy follows/profile_stats delete/rewrite/backfill.
- 현재 TEST/PRODUCTION이 모르는 shared authority 조기 활성화.
- 전체 follows/profile scan.
- 좋아요/공개/비공개/검색/크리에이터 추천 정상 경로 변경.
- shared migration 실행 전 사용자에게 영향/순서 보고 없이 진행.

## 0OX. 9d10970 candidate continued — physical follow / cold-device release BLOCKED (2026-10-04)

- Branch preview; basis 9d10970b44c072d16c4355fc868ea25f083d4eeb. app344 / deployed Worker341 unchanged. Candidate not deployed.
- Prior W3-to-W2 compaction preserved. Synthetic total_changes remains9. Actual original Rows Read18–19 / Rows Written14–17 = FAIL. Candidate physical metrics unavailable; never declare completion from queryW2.
- Runtime reader audit confirms current main/production consume both D1/derived counters. R2 membership has truncation/concurrency/failure holes. Shared authority/trigger cutover NOT executed; two-stage prerequisites and outstanding implementation recorded in FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md.
- Feed existing bounded joins/publication/derived generation now carry ownerProfileGenres. Existing authenticated cold snapshot carries self profile genres from one direct R2 GET, no extra Worker/D1. Client caches/reranks without candidate N+1. Existing legacy R2 Feed coverage remains unresolved, so cold-device completion NOT declared.
- TypeScript/Build/relevant functional verifiers PASS. Actual physical release gate FAIL; PC/mobile and live cold coverage unverified. Independent Work audit corrections applied; no release.
- No migration/backfill/delete/data copy, main edit, TEST/PRODUCTION deployment, Firebase/Functions deployment or resource/config change.
- Next: prepare safe exact/ordered per-actor following authority and all reader cutovers, live read-only index/trigger evidence, approved compatible stage2, bounded legacy Feed genre coverage; then six actual PREVIEW measurements and PC/mobile. Deploy neither service before both gates pass.

## COST GATE — 팔로우는 D1 query 수와 physical rows를 동시에 줄일 것 (2026-10-04 KST)

팔로우 수정 시 `D1 W3`만 보고 완료 처리 금지.

반드시 측정:
1. D1 query read
2. D1 query write
3. D1 Rows Read
4. D1 Rows Written
5. Worker 요청
6. R2 A/B

현재 실사용 baseline:
- query R0/W3
- Rows Read 18~19
- Rows Written 14~17

목표:
- 단일 팔로우/해제가 변경된 관계와 필요한 카운터만 건드리는 O(1)
- 불필요한 trigger/derived update 때문에 row 수가 증폭되지 않도록 수정
- physical row 수가 과도하면 FAIL
- verifier와 PREVIEW 실제 계기판 둘 다 통과해야 완료

## CURRENT TASK — 팔로우 physical D1 비용 정상화 + 크리에이터 추천 확장 (2026-10-04 KST)

우선순위 1 — 팔로우 비용:
- app344 실사용에서 팔로우 해제 1회가 logical D1 W3인데 실제 D1 row read/write 증폭 확인.
- app245/246의 RETURNING/no-postread/R2-only counter patch는 보호.
- `follows + profile_stats + explore032 derived triggers` physical amplification을 재현/계측.
- 목표: 변경된 관계 1개만 처리. 가능하면 canonical W1. 불가하면 이유와 최소값을 명시.
- 전체 follows/profile scan, 전체 profile/feed rebuild 금지.
- shared D1 schema/trigger를 실제 변경하기 전 기존 PREVIEW/TEST/PRODUCTION Worker 호환성 독립 검증 필수.

우선순위 2 — 좋아할 만한 크리에이터:
- 현재 latest 40 owner-only 후보 구조 제거.
- ranking: 프로필 대표장르 유사도 > SORIDRAW 추천 > 최신 공개곡 > 인기곡.
- owner UID dedupe, 본인 제외.
- 후보 profile genres를 사람 수만큼 GET 금지.
- R2/로컬 creator summary 또는 이미 로드된 파생 bundle로 D1 R0 목표.
- 기존 UI 레이아웃/카드 디자인 변경 금지.

완료 전 PREVIEW 배포만 허용. TEST/PRODUCTION 변경 금지.

## CURRENT TASK — app343 장르 2줄 구조 실사용 확인 (2026-10-04 KST)

PREVIEW app343 배포 완료. Run `37168925936` SUCCESS.

확인:
1. 첫째 줄: 대분류만 표시되는지.
2. 둘째 줄: 세부장르만 표시되는지.
3. K-록/K-발라드/K-뉴잭스윙/얼터너티브 R&B 등이 첫줄에 올라오지 않는지.
4. 소울/펑크, 포크/어쿠스틱, 클래식/시네마틱이 한 칩으로 합쳐지지 않는지.
5. 첫줄 클릭으로 둘째줄 내용이 펼쳐지거나 교체되지 않는지.
6. 두 줄 모두 좌우 스크롤이 되는지.

FAIL 시 Explore 장르 추천 UI만 수정. 좋아요/검색/백엔드 경로 변경 금지.

## CURRENT TASK — app342 장르별 추천 실기기 UI 확인 (2026-10-04 KST)

현재:
- PREVIEW app342 배포 완료.
- Firebase Run `37167991654` SUCCESS.
- TypeScript / Build / exact build PASS.
- TEST / PRODUCTION unchanged.
- 서버/사용자 데이터 변경 없음.

확인할 것:
1. 장르별 추천 첫 줄이 한글 장르명 중심으로 보이는지.
2. 같은 장르의 id/영문 변형이 중복으로 남지 않는지.
3. 한글 표시명이 없는 장르는 둘째 줄 영문으로 보이는지.
4. PC에서 마우스 휠/트랙패드로 긴 장르 줄 좌우 이동이 되는지.
5. 모바일에서 손가락 가로 스크롤이 되고 끝 항목이 잘리지 않는지.

FAIL 시 장르별 추천 UI만 수정. 좋아요/검색/백엔드 정상 경로는 변경 금지.

## CURRENT TASK — Worker341 검색 최초/랜덤/재검색 D1 R0 실기기 검증 (2026-10-04 KST)

현재:
- R2 검색 카탈로그 1회 백필 45/45 완료 + 검증 PASS.
- D1 SELECT-only, D1 write/schema change 0, 사용자 원본 데이터 변경 0.
- Worker341 PREVIEW 배포 완료.
- Worker Run `37166719557` SUCCESS.
- active Worker `59ed42ea-f29a-4837-a9a7-20e70648e59c`.
- app UI/Hosting은 app340 유지.
- TEST / PRODUCTION unchanged.

사용자 테스트 — 검색만:
1. CACHE LIVE 초기화.
2. 기존 정상 제목 또는 아티스트 검색 1회 → D1 query/rows **R0 W0**.
3. `힙합` 검색 1회 → D1 **R0 W0**.
4. 랜덤 문자열 `ㅁㄴㅇㄹ341` 1회 → D1 **R0 W0**.
5. 같은 검색어를 2분 안에 다시 검색 → Worker 증가 0 / D1 증가 0 목표.

합격선:
- 어떤 검색어를 최초 입력해도 D1 query/read/write가 0.
- 같은 검색어 재검색은 app340 local cache가 Worker 호출까지 0.
- 제목/장르/아티스트 검색 결과 기능 유지.
- FAIL 시 TEST/PRODUCTION 승격 금지.

## CURRENT TASK — app340 동일 검색 2회차 Worker 0 실기기 검증 (2026-10-04 KST)

현재:
- PREVIEW app340 배포 완료.
- Firebase Run `37161506204` SUCCESS / exact build PASS.
- app339 Worker 유지: `aedd8111-b2f4-407f-9e3f-ba062a82ed16`.
- TEST / PRODUCTION unchanged.
- shared D1/user data 변경 없음.

사용자 테스트:
1. CACHE LIVE 초기화.
2. `힙합` 검색 1회.
3. 2분 안에 같은 `힙합`을 다시 검색.
4. 기대:
   - 첫 검색: Worker 1회 / 현재 서버 비용 발생 가능.
   - 두 번째: Worker 증가 0 / D1 증가 0.
5. 두 번째에서도 Worker 또는 D1이 증가하면 FAIL.

## CURRENT TASK — app339 한글 장르 검색 비용 재검증 (2026-10-04 KST)

현재:
- app UI/Hosting: app337 유지.
- PREVIEW Worker app339 배포 완료.
- product source `9ede46e248847d9fc8b11508dcda432c8f763c41`.
- Worker Release `37160937090` SUCCESS.
- active Worker `aedd8111-b2f4-407f-9e3f-ba062a82ed16`.
- TEST / PRODUCTION unchanged.
- shared D1 schema/index 변경 없음.
- 사용자 데이터 변경 없음.

사용자 테스트:
1. `힙합` 검색 1회.
2. 바로 같은 `힙합` 검색 1회 더.
3. CACHE LIVE 비교.
   - 첫 검색: R16/R250보다 크게 감소해야 함.
   - 두 번째: D1 R0/W0 목표.
4. 실패 시 다음 단계 중단.

## CURRENT TASK — app338 한글 장르 검색 실기기 재검증 (2026-10-04 KST)

현재:
- app UI/Hosting: app337 유지.
- PREVIEW Worker hotfix app338 배포 완료.
- product source `7e5f6b9c1cdd0f0ad0d24611568aa2117495c3b9`.
- Worker Release `37159504049` SUCCESS.
- active Worker `4929b0b7-3d6b-448a-8fae-1b0ffe7b5941`.
- TEST / PRODUCTION unchanged.
- schema/index 추가 없음.
- 사용자 데이터 변경 없음.

사용자 테스트는 1개:
- 방금 R584가 나온 **같은 한글 장르 검색**을 다시 1회 실행.
- CACHE LIVE의 D1 rows_read만 확인.
- 수백 read면 FAIL.
- 소량 read 또는 R0이면 app338 장르 검색 cost fix PASS.

그 외 ID/제목 검색, 공개/비공개, Explore/공개프로필은 이미 PASS 상태라 재테스트 불필요.

## CURRENT TASK — app337 검색 실기기 재검증 (2026-10-04 KST)

배포 완료:
- product source `7465cce1f14d418059946651d9b05d19229ccea2`.
- Audit `37155219113` SUCCESS.
- PREVIEW Worker `37155369295` SUCCESS / active `4b3e02c8-f906-4c22-bbc1-36cd963babee`.
- Firebase PREVIEW app337 `37155428848` SUCCESS / exact build PASS.
- TEST / PRODUCTION unchanged.
- shared D1 schema/user data migration 없음.

사용자에게 필요한 테스트는 두 가지뿐:
1. app336에서 rows_read가 크게 증가했던 동일 검색어 재검색.
   - 목표: R2 catalog hit이면 D1 R0/W0.
   - legacy-only fallback이면 D1이 남을 수 있으므로 검색어와 수치 기록.
2. 한글 장르 검색.
   - `발라드`, `힙합`, `재즈`, `트로트` 또는 실제 보유 장르 한글명.
   - 영문 장르 marker와 연결되어 결과가 나와야 함.

PASS 후:
- app337 검색 수정 동결.
- 다음 큰 단계는 3환경 hybrid read 승격 계획.
- shared D1 W2 cutover / derived catalog 전체 backfill은 별도 승인 전 실행 금지.

## CURRENT TASK — app336 PREVIEW 실기기 검증 → 3환경 hybrid 호환층 승격 계획 (2026-10-04 KST)

배포 완료:
- preview HEAD `be3ce04652ae6c3604aba872e857c19a703a1876`.
- Audit `37152439362` SUCCESS.
- PREVIEW Worker `37152582192` SUCCESS / active version `903c72d5-a569-45e7-a196-947b74ddd6e2`.
- Firebase PREVIEW app336 `37152665528` SUCCESS / exact build PASS.
- TEST / PRODUCTION Worker + Hosting unchanged.
- shared D1 schema/user data migration 없음.

지금 할 일:
1. PREVIEW 실기기 기능 검증.
   - latest / popular.
   - 공개 프로필 first/deep.
   - genre.
   - title 검색.
   - artist nickname / handle 검색.
   - 기존 legacy 공개곡과 최근 R2 공개곡이 함께 보이고 중복/누락이 없는지.
2. warm cache 비용 검증.
   - Explore reload/re-entry Worker 0 / D1 R0W0 목표.
   - 공개 프로필 reload/re-entry Worker 0 / D1 R0W0 목표.
3. 기존 정상 기능 회귀 확인.
   - app164 Explore likes.
   - app302 save heart.
   - app301 folders.
   - app303 Split.
   - Music Note 60초/local-first.
4. PASS 후에만 TEST → PRODUCTION 순서로 **hybrid read 코드만** 승격 계획.
5. 세 환경이 hybrid read를 지원하기 전 shared D1 W2 cutover migration 금지.

다음 비용 단계(아직 실행 금지):
- first publication W12 → W2 후보.
- source-media swap W3 → W1 후보.
- visibility W2 → W1 후보.
- 기존 legacy row backfill/rewrite/delete 없이 cutover 이후 row만 새 구조 사용.

절대 금지:
- shared D1 cutover migration 선실행.
- 사용자 row rewrite/backfill/delete.
- 기능 정상값을 비용 숫자 때문에 제거.
- main/TEST/PRODUCTION 무승인 승격.
- 정상 likes/save/folders/Split/Music Note batching 변경.

## CURRENT TASK — app336 release audit → PREVIEW Worker/App 배포 (2026-10-04 KST)

구현 후보:
- canonical Worker commit `e935d52fa6a63ef9f115ef2c07471f77bd9e726a`.
- implementation verifier Run `37151610954` SUCCESS.
- app version source 336.
- PREVIEW hybrid flag ON.
- shared D1 schema/user data mutation 없음.

지금 할 일:
1. release-system audit 전체 PASS.
2. exact product source commit 고정.
3. PREVIEW Worker release.
4. Worker smoke:
   - feed latest/popular HTTP 200.
   - profile first-view HTTP 200.
   - app336 verifier/marker/flag.
   - likes/public-count 기존 smoke.
   - TEST/PRODUCTION Worker unchanged.
5. Firebase PREVIEW app336 release.
6. `preview.soridraw.com` exact build/version 336.
7. TEST/PRODUCTION Hosting unchanged.
8. CURRENT_RELEASE_STATE 최종 갱신.

금지:
- shared D1 cutover migration.
- 사용자 row rewrite/backfill/delete.
- main/TEST/PRODUCTION promotion.
- 정상 likes/save/folders/Split/Music Note batching 변경.

## CURRENT TASK — app336 R2 catalog + legacy-derived hybrid read 호환층 구현 (2026-10-04 KST)

확정 근거:
- live exact fanout audit `37149706339` SUCCESS:
  - first-publication W12 = canonical tracks W6 + derived track W5 + shared revision W1.
- 3환경 runtime audit `37149380218` SUCCESS:
  - PREVIEW만 R2 catalog write runtime 보유.
  - TEST/PRODUCTION은 아직 legacy derived/shared-revision recovery 의존.
- isolated PREVIEW RATE_DB probe `37150337923` SUCCESS:
  - first publish W12→W2.
  - source swap W3→W1.
  - visibility W2→W1.
  - shared canonical user-data write 0 / migration 0.

app336 목표:
1. **migration 없이 Worker read compatibility부터 구현**.
2. R2 catalog와 legacy derived 결과를 함께 읽을 수 있는 hybrid adapter 추가.
3. 중복 track id는 R2/shared track-card 쪽을 최신 authority로 우선.
4. R2 catalog에 없는 기존 곡은 legacy derived path로 그대로 fallback.
5. 다음 경로 모두 동일 API shape 유지:
   - latest / popular first page
   - feed deep page
   - public profile first/deep page
   - genre
   - title search
   - artist nickname / handle search
6. pagination/cursor에서 legacy→catalog 경계 때문에 누락/중복이 생기지 않게 verifier 작성.
7. like count / profile pin / private / republish / source-media swap 후 R2 marker 이동과 legacy fallback 충돌 테스트.
8. app336에서는 `SORIDRAW_R2_CATALOG_READ_V1`을 무조건 켜지 말고, hybrid verifier가 PASS한 뒤 PREVIEW에서만 활성 판단.
9. **shared D1 index/trigger/schema 변경 금지**.
10. 사용자 row delete/backfill/rewrite/copy 금지.

합격선:
- legacy-only fixture + catalog-only fixture + mixed fixture 전부 결과 parity PASS.
- 같은 track이 양쪽에 있을 때 stale legacy media/count가 최신 R2를 덮지 않음.
- 기존 곡 2페이지 이후 누락 0 / 중복 0.
- title/genre/artist 검색 유지.
- no-change warm path에 새 D1 전체 scan 없음.
- TypeScript / Build / 관련 Worker verifier PASS.
- app164 like / app331~335 publication regression PASS.
- TEST/PRODUCTION 코드·배포 변경 없음.

app336 완료 후:
- PREVIEW Worker/app 필요 범위만 배포 검토.
- 실기기에서 기능/비용 확인.
- 그 다음에야 TEST→PRODUCTION 코드 호환층 승격 계획.
- 3환경이 hybrid read를 지원한 뒤 별도 사용자 승인으로 W2 shared-D1 cutover migration 진행.

절대 보호:
- app164/160 Explore likes.
- app302 save heart.
- app301 folders.
- app303 Split.
- Music Note 60초/local-first canonical batch.
- app331~335 publication UI/media behavior.
- title/genre/artist name·handle search.
- main/TEST/PRODUCTION 승격 금지.
- shared canonical 사용자 데이터 변경 금지.

## CURRENT TASK — app335 실기기 Worker-zero 검증 → source-swap W3 / first-publication W12 후속 (2026-10-04 KST)

배포 완료:
- PREVIEW app335.
- Audit `37148217453` SUCCESS.
- Firebase PREVIEW Release `37148368369` SUCCESS.
- `preview.soridraw.com` app335 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / Rules / D1 schema / 사용자 데이터 변경 없음.

먼저 사용자 실기기:
1. Explore warm cache → CACHE LIVE 초기화 → browser reload.
   - 목표 Worker 0 / D1 R0 W0 / Firestore R0 W0.
2. 공개 프로필 warm cache → 초기화 → reload.
   - 목표 Worker 0 / D1 R0 W0.
3. Music Note warm cache → 초기화 → reload.
   - 목표 publication revision Worker 0 / D1 R0 W0.
4. 진단 초기화/일반 클릭만으로 Worker가 증가하지 않는지 확인.
5. 실제 hidden→visible tab resume은 bounded freshness Worker 허용.
6. same-source public↔private W2 재확인.

그 다음 비용 구조:
- 실제 Suno 1↔2 source swap 현재 R11/W3:
  - canonical track media W1
  - derived media delta W1
  - protected shared revision W1
- TEST/PRODUCTION 구 Worker가 shared revision + derived recovery를 참조하므로 schema/trigger 즉시 제거 금지.
- W2 가능성은 **구 Worker 호환성을 유지한 대체 invalidation/derived ownership 구조**를 먼저 설계·증명한 뒤 판단.
- 불가능하면 하위호환 floor와 이유를 명확히 보고하고 기능 삭제로 숫자를 맞추지 않음.
- never-published first publication R7/W12는 source-swap 호환 설계 뒤 별도 exact fanout compaction.

보호:
- app164/160 Explore likes.
- app302 save heart.
- app301 folders.
- app303 Split.
- Music Note 60초/local-first canonical batch.
- app331~335 publication UI/media behavior.
- title/genre/artist name·handle search.
- TEST/PRODUCTION 승격 금지.
- 사용자 row delete/backfill/rewrite 금지.

## CURRENT TASK — app334 실기기 Worker-zero + same-source W2 검증 (2026-10-04 KST)

배포 완료:
- PREVIEW app334.
- Release System Audit `37145212030` SUCCESS.
- Firebase PREVIEW Release `37145418195` SUCCESS.
- deployed source `e9fd3d537cf477e393c9cb0a7e038917dc02b6a0`.
- `preview.soridraw.com` app334 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / Rules / D1 schema / 사용자 데이터 변경 없음.

실기기 순서:
1. **app334 업데이트 후 각 화면을 한 번 정상 진입**하여 persistent validation timestamp를 seed.
2. CACHE LIVE 초기화.
3. Explore에서 데이터 변경 없이 바로 browser reload.
   - 목표: Worker **0**, D1 rows **R0/W0**, Firestore R0/W0.
4. 공개 프로필에서 정상 캐시가 있는 상태로 60초 안에 reload.
   - 목표: Worker **0**, D1 R0/W0.
5. Music Note에서 정상 캐시가 있는 상태로 60초 안에 reload.
   - 목표: `music-note-publications-revision` Worker **0**, D1 R0/W0.
6. 같은 registered 곡 public→private:
   - 목표 D1 billable W2 / Firestore W0.
7. 선택 Suno를 바꾸지 않고 private→public:
   - 목표 D1 billable **W2** / Firestore W0.
   - 토스트는 일반 `Explore에 다시 공개했습니다.` 경로여야 함.
8. 실제 Suno 1↔2 변경은 기능 정상 여부만 확인.
   - 현재 D1 W3는 별도 schema/compat 비용 작업 대상이며 hard gate PASS로 보지 않음.

남은 별도 비용 작업:
- never-published 첫 공개 실측 **R7/W12**.
- migration 전 W18→W12 감소했지만 hard gate FAIL.
- 다음 schema 수정 전 live D1 Insights + exact index/trigger contribution을 read-only로 분해.
- 추가 migration은 별도 안전검증 후 판단.

보호:
- app164/160 Explore 좋아요.
- app302 저장 하트 / app301 폴더 / app303 Split.
- Music Note 60초/local-first batch.
- app331~333 공개 UI/media path.
- 검색 제목/장르/아티스트 이름·handle.
- TEST / PRODUCTION 승격 금지.

## CURRENT TASK — cached reload Worker-zero pass (Explore / profile / Music Note) (2026-10-04 KST)

증거:
- Explore warm reload: D1 R0/W0이지만 Worker가 `explore-management-access`, `likes-revision`, revision/profile conditional 경로에서 누적.
- public profile warm browser reload: app211이 60s cache window 안에서도 conditional Worker revalidation을 강제.
- Music Note warm reload: `music-note-publications-revision` Worker가 reload마다 1 증가; D1 R0/W0.
- 목표는 **정상 캐시 + 변경 없음 reload = Worker 0 / D1 R0 W0**.

구현 범위:
1. `src/services/exploreCurationService.ts`
   - `getExploreCurationAccess307` 결과를 uid-scoped durable cache로 유지.
   - 일반 reload가 `/v1/me/explore-management-access`를 다시 부르지 않게 함.
   - 권한 변경/로그아웃/명시 관리 action 시 invalidation 가능하게 유지.
2. `src/services/exploreLikeService.ts`
   - `revisionCheckAtByUid127`의 정상 check window가 reload로 초기화되지 않도록 uid-scoped persistent checkedAt 사용.
   - 기존 5분 정상 check cadence와 30초 failure retry 의미는 유지.
   - PC↔모바일 like convergence 기능 약화 금지.
3. `src/services/explorePublicationService.ts`
   - persistent publication envelope에 last validated/check timestamp를 사용하여 healthy cached reload가 즉시 `/v1/me/music-note-publications-revision`을 호출하지 않게 함.
   - publication mutation/outbox가 있으면 기존 safety path 유지.
   - cross-device freshness 요구를 깨지 않는 bounded validation cadence 유지.
4. `src/services/exploreProfileFirstViewService.ts`
   - app211의 browser reload 강제 revalidation을 제거하고 existing persistent `validatedAt` window를 존중.
   - profile mutation/invalidation/parity 기능 유지.
5. Explore feed revision도 reload 자체가 강제 Worker trigger인지 확인하고 동일 원칙 적용.
6. CACHE LIVE verifier 추가:
   - warm Explore reload: Worker 0 / D1 R0 W0.
   - warm profile reload: Worker 0 / D1 R0 W0.
   - warm Music Note reload: Worker 0 / D1 R0 W0.
   - validation TTL 만료/실제 signal 변경 시에만 필요한 Worker request 허용.
7. UI 변경 없음.

절대 보호:
- app164/160 Explore likes.
- app331~333 publication behavior.
- app302 Studio save heart.
- app301 folders.
- app303 Split.
- Music Note 60s/local-first canonical batch.
- TEST/PRODUCTION 변경 금지.
- Worker/D1 schema 변경 없이 client cache-trigger 최적화부터 수행.
- 정상 기능을 비용 때문에 삭제 금지.

## CURRENT TASK — first-publication W12 post-migration fanout decomposition (2026-10-04 KST)

실기기 결과:
- never-published 첫 공개: D1 query R3/W1, billable **R7/W12**, Firestore W0.
- migration 전 W18 → 현재 W12로 감소했지만 hard gate FAIL.

다음 작업은 **추가 쓰기/migration 전에 read-only 분해**:
1. live D1 Insights에서 first-publication UPSERT의 post-migration avgRowsWritten 재확인.
2. 현재 tracks indexes / triggers exact 목록 확인.
3. tracks INSERT → explore_derived_tracks INSERT → explore_derived_changes / explore_derived_state / derived profile repair까지 실제 write contribution 분해.
4. 남은 각 write가 PREVIEW/TEST/PRODUCTION 조회 호환성에 필요한지 증명.
5. 제거 가능한 redundant index/trigger/event만 두 번째 compaction 후보로 제안.
6. 사용자 row delete/backfill/rewrite 금지.
7. W1~W2 불가능한 항목은 숨기지 말고 하위호환 최소 floor와 이유를 보고.

동시에 별도 버그:
- same-source registered private→public이 W3 source-refresh로 잘못 분기되는 문제를 우선 수정하여 W2 복구.

보호:
- 제목/장르/아티스트 이름·handle 검색.
- public→private W2 정상 경로.
- 좋아요 app164/160, 저장 하트 app302, 폴더 app301, Split app303.
- Music Note 60초/local-first batch.
- TEST/PRODUCTION 변경 금지.

## CURRENT TASK — same-source private→public false source-refresh W3 fix (2026-10-04 KST)

실기기 증거:
- public→private: billable R3/W2, Firestore W0 = PASS.
- 초기화 후 **동일 source 그대로** private→public: billable **R11/W3**, Firestore W0 = FAIL.
- 영상에서 재공개 전/후 선택 Suno는 동일.
- 토스트가 `선택한 곡으로 Explore에 다시 공개했습니다.`여서 `selectionChanged=true` 분기로 들어간 것으로 보임.

작업 목표:
1. 동일 source registered private→public을 visibility-only `setExploreTrackVisibility(..., true, options)`로 확정.
2. 실제 Suno 1↔2 변경일 때만 `refreshExploreMusicNotePublicationSource`.
3. local-first Music Note source 선택이 서버/스토어 stale snapshot으로 덮여 false `selectionChanged`가 되지 않게 함.
4. 동일 source 재공개 billable W2 / Firestore W0 실기기 복구.
5. 실제 source 변경 기능은 유지. 비용 W3는 별도 최적화 대상으로 남기고 hard gate PASS로 오판하지 않음.

보호:
- public→private W2 정상 경로.
- app164/160 좋아요.
- app302 저장 하트 / app301 폴더 / app303 Split.
- Music Note 60초/local-first batch.
- 공개 옵션 3개와 검색 기능.
- TEST/PRODUCTION 변경 금지.

## VERIFIED — app333 + shared D1 migration source-swap 실기기 비용 PASS (2026-10-04 KST)

사용자 실기기 영상/CACHE LIVE 확인:
- 공개 설정에서 실제 선택 Suno 곡을 바꿔 Explore에 다시 공개.
- 완료 후 Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request total: R11 / **W3**.
- Browser SDK: R0 / W0.
- Firestore: R0 / **W0**.
- PAGE SYNC: D1 R0 / W0.
- 토스트: "선택한 곡으로 Explore에 다시 공개했습니다."
- 판정: **source swap 목표 W3 + 즉시 Firestore favorites W0 + Worker 1회 = PASS**.
- 영상 중 진단 초기화를 요청 완료 전에 눌렀지만, 완료 이벤트가 초기화 후 들어와 최종 W3가 독립적으로 계측됨.

남은 실기기 항목:
1. 같은 공개곡 → 비공개: W2 / Firestore W0.
2. 같은 private곡 → 다시 공개: W2 / Firestore W0.
3. 다음곡에 적용 허용만 변경: W2.
4. 팔로워 곡 저장 허용만 변경: W2.
5. 공개 프로필에 고정만 변경: W2.
6. never-published 곡 최초 공개: W10 전후 목표, exact 실측.

보호:
- source swap W3 하위호환 floor를 더 줄이기 위해 derived media/shared revision을 제거하지 않는다.
- app164/160 좋아요, app302 저장 하트, app301 폴더, app303 Split, Music Note 60초/local-first batch, app331~333 공개 경로 변경 금지.
- TEST / PRODUCTION 승격 금지.

## CURRENT TASK — app333 + shared D1 app334 fanout migration 실기기 비용 재측정 (2026-10-04 KST)

완료:
- app333 PREVIEW client/Worker 배포 유지.
- shared D1 migration Run `37141622358` SUCCESS.
- user row counts unchanged / quick_check / TEST-PRODUCTION query compatibility PASS.
- Hosting/Worker/Functions/Rules 추가 배포 없음.

지금 실기기 CACHE LIVE로 각각 **초기화 후 한 동작씩** 확인:
1. 같은 공개곡 → 비공개: 목표 D1 billable **W2**, Firestore W0.
2. 같은 private곡 → 다시 공개: 목표 **W2**, Firestore W0.
3. 공개 상태에서 Suno 1↔2 실제 변경: 목표 Worker 1회, 즉시 Firestore favorites W0, D1 billable **W3**.
4. 다음곡에 적용 허용만 변경: 목표 **W2**.
5. 팔로워 곡 저장 허용만 변경: 목표 **W2**.
6. 공개 프로필에 고정만 변경: 목표 **W2** (migration 전 W3).
7. never-published 곡 최초 공개: 현재 W16 baseline 기준 **W10 전후 목표**. 정확한 실측 기록.

주의:
- 여러 동작을 연속 실행하면 CACHE LIVE '이번 실행 누적'이 합쳐져 W가 다르게 보일 수 있으므로 각 항목 전에 진단 초기화.
- source swap W3는 현재 TEST/PRODUCTION 하위호환 안전 floor. W2 이하를 위해 derived media/shared revision을 끊지 말 것.
- first publication이 W10보다 높으면 live Insights에서 남은 write fanout을 다시 분해한 뒤 다음 구조 변경 판단.

보호:
- Explore 좋아요 app164/160.
- 저장 하트 app302 / 폴더 app301 / Split app303.
- Music Note 60초/local-first batch.
- app331 optimistic publication UI.
- app332 media identity guard.
- app333 inline media / one-Worker path.
- 검색: 제목 / 장르 / 아티스트 이름·handle.
- TEST / PRODUCTION 코드 승격 금지.
- PRODUCTION 배포 금지.

## CURRENT TASK — app333 실기기 공개 비용 재측정 + schema-level 비용 최적화 승인 대기 (2026-10-04 KST)

배포 완료:
- PREVIEW app333.
- Audit `37140228404` SUCCESS.
- PREVIEW Worker `37140381356` SUCCESS / version `0f4e7ac6-2baa-442c-87cc-dbb6e640206b`.
- Firebase PREVIEW `37140463309` SUCCESS / app333 exact build.
- TEST / PRODUCTION unchanged.
- D1 schema / Functions / Rules / 사용자 데이터 변경 없음.

실기기 확인:
1. 이미 공개된 곡에서 Suno 1→2 또는 2→1 변경 후 저장.
   - 목표: 즉시 Firestore favorites write **0**.
   - 목표: Cloudflare Worker **1회**.
   - D1 media rows_written은 schema 미변경이라 W4 가능; 실제 수치 기록.
2. 같은 곡 public→private→public.
   - 목표: Firestore W0 / D1 W2.
3. 다음곡에 적용 허용만 변경.
   - 목표: D1 W2, Firestore W0.
4. 팔로워 곡 저장 허용만 변경.
   - 목표: D1 W2, Firestore W0.
5. 공개 프로필 고정만 변경.
   - 현 구조 예상: D1 W3. W3이면 known schema hard-gate FAIL로 기록.
6. never-published 첫 공개.
   - 현 구조 예상: W18. 첫 공개 선택 media 정확성은 app333에서 보호되지만 D1 fanout 비용은 별도.

다음 설계:
- source swap W4 절감 후보: `idx_tracks_owner_suno_url` 제거/대체.
- pin W3 절감 후보: `idx_tracks_owner_profile_order` 재설계.
- first publication W18: tracks/index/trigger fanout을 하위호환 가능한 단계적 canonical 구조로 재설계.
- 위 3개는 shared D1 schema에 영향을 주므로 guarded read-only query-plan 감사 → migration안 → 사용자 별도 승인 → PREVIEW migration 순서.
- migration 실행 전 TEST/PRODUCTION 구 Worker의 동일 shared data 읽기 호환성을 증명하지 못하면 실행 금지.

보호:
- app164/160 좋아요 동결 기준.
- app302 저장 하트 / app301 폴더 / app303 Split.
- Music Note local-first/batched save.
- app331 즉시 공개/비공개 UI.
- app332 fresh media identity guard.
- app333 one-Worker inline-media path.
- 프로필 정상 UI / Explore 검색 및 공개옵션 3개.
- main/TEST/PRODUCTION 승격 금지.

## CURRENT TASK — app332 동일곡 공개/비공개 실기기 비용 확인 (2026-10-04 KST)

배포 완료:
- PREVIEW app332.
- audited source `083d4310059ee27cb225ddf1578340ec3219278a`.
- Release System Audit `37138323981` SUCCESS.
- Firebase PREVIEW Release `37138464737` SUCCESS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

지금 확인:
1. 이미 등록된 같은 Suno 곡을 비공개 → 다시 공개.
   - 목표: Firestore W0.
   - 목표: D1 billable W1~W2.
2. 다시 공개 → 비공개 반복.
   - 목표 동일.
3. 같은 곡인데 `favorites:write 1` 또는 D1 W4가 나오면 캡처와 함께 FAIL로 기록.
4. 실제 다른 Suno 곡 선택 전환은 W4가 나올 수 있음. 이번 app332는 그 경로를 약화하거나 제거하지 않음.

보호:
- app331 즉시 공개/비공개 UI 반응 유지.
- app329 실제 source-media swap 기능 유지.
- app164/160 Explore 좋아요 변경 금지.
- app302 저장 하트, app301 폴더, app303 Split 변경 금지.
- 프로필 / Music Note 60초 저장 / Library 정상 기능 변경 금지.
- TEST/PRODUCTION 승격 금지.
- 실제 source-media W4와 first-publication W18 최적화는 app332 실기기 확인 후 별도 작업.

## CURRENT TASK — app331 실기기 비용 분기 고정 / W4·W18 다음 최적화 (2026-10-04 KST)

실기기 확인:
- 순수 비공개 전환: D1 billable W2 / Firestore W0.
- 순수 공개·비공개 저비용 케이스: D1 billable W2 / Firestore W0.
- Suno 선택 변경이 동반된 공개/재공개: Firestore favorites W1 + D1 billable W4.
- 공개 상태에서 다른 Suno 곡 source swap: Firestore favorites W1 + D1 billable W4.
- 차이는 랜덤이 아니라 클라이언트 `selectionChanged` 분기와 Worker `refreshSourceMedia` 경로 차이로 확인.

다음 작업:
1. 사용자가 실제 Suno 곡을 바꾸지 않은 공개/비공개는 항상 visibility-only 경로로 고정하고 Firestore W0 / D1 W2를 넘지 않게 보호.
2. 실제 source-media swap은 현재 D1 W4이므로 W1~W2 hard gate에 맞출 수 있는 하위호환 구조를 설계. 기존 TEST/PRODUCTION이 shared canonical data를 계속 읽을 수 있어야 함.
3. never-published 첫 공개 W18은 별도 first-publication canonical/index fanout 문제로 유지. 무검증 index drop, canonical table 분리, 사용자 데이터 migration 금지.
4. 곡을 바꾸지 않았는데도 실기기에서 `favorites:write 1 / W4`가 재현되면 stale `selectionChanged` 판정부터 우선 수정.
5. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 정상 기능은 건드리지 않음.

합격선:
- 동일 선택곡 공개↔비공개: Firestore W0, D1 W1~W2.
- 실제 source-media swap: D1 W1~W2 목표. 불가능하면 이유와 하위호환 대안을 먼저 보고.
- first publication: W1~W2 목표. W3+는 승격 금지.
- TEST / PRODUCTION 변경 금지. 사용자 데이터 migration/backfill/delete 금지.

## CURRENT TASK — app330 공개/저장 즉시 UI 반응 실사용 확인 (2026-10-04 KST)

배포 완료:
- PREVIEW app330.
- Release System Audit `37135125184` SUCCESS.
- Firebase PREVIEW Release `37135265146` SUCCESS.
- deployed locked source `0399644d0cddcc7097abdccb2f639c9234013961`.
- `preview.soridraw.com` app330 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / Rules / D1 schema / 사용자 데이터 migration 변경 없음.

확인:
1. Music Note 공개 또는 공개 설정 저장 클릭 즉시 팝업이 닫히는지.
2. 공개 상태가 서버 응답을 기다리지 않고 즉시 화면에 반영되는지.
3. Suno 1번↔2번 선택 변경 공개도 같은 즉시 반응인지.
4. 백그라운드 서버 반영 완료 후 실제 Explore 곡 미디어가 선택한 곡과 일치하는지.
5. 실패 시 이전 공개 상태로 복구되고 잘못된 공개 표시가 남지 않는지.
6. 실제 source swap 1회 CACHE LIVE D1 rows_written W1~W2.
7. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 회귀 없음.

보호:
- app329 media-only source refresh와 D1 trigger 구조 변경 금지.
- app164/160 Explore 좋아요 동결 기준 변경 금지.
- app302 저장 하트, app301 폴더, app303 Split 변경 금지.
- 공개 옵션 3개 / 비공개 전환 / 프로필 UI 비변경.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 승인 전 변경 금지.

## CURRENT TASK — app328 공개곡 선택 / 지구본 아이콘 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app328.
- Final Release System Audit `37106027818` SUCCESS.
- Firebase PREVIEW Release `37106162581` SUCCESS.
- locked source `239d12318d8c980c15b5aa9c80bf3a0b5b4464d9`.
- `preview.soridraw.com` app328 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / Rules / migration 변경 없음.

확인:
1. 수노 URL 2곡이 연결된 Music Note → 공개 설정 상단에 좌/우 2곡 카드 표시.
2. 공개할 곡을 1번/2번 중 선택 가능.
3. 선택한 곡으로 실제 Explore 공개 결과가 맞는지.
4. 이미 공개된 곡에서 선택곡을 바꾸고 저장해도 동일 공개 track이 새 선택곡으로 갱신되는지.
5. Music Note Detail 삭제 버튼 오른쪽 공개 버튼이 지구본 아이콘인지.
6. PC/모바일 팝업 잘림/겹침 없음.
7. 선택 변경 실제 공개 시 D1 rows_written W1~W2.

보호:
- app327 프로필 UI 유지.
- app302 저장 하트, app301 폴더, app303 Split 동작 변경 금지.
- Explore 좋아요 app164/160 동결 기준 변경 금지.
- 기존 공개 옵션/비공개 기능 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 승인 전 변경 금지.

## CURRENT TASK — app327 프로필 미세 UI 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app327.
- Final Release System Audit `37104517413` SUCCESS.
- Firebase PREVIEW Release `37104633865` SUCCESS.
- locked source `86bb1f4b01fe00fd13b33c07391dfcfefd9ab182`.
- `preview.soridraw.com` app327 exact build PASS.
- TEST / PRODUCTION unchanged.
- 서버 / 사용자 데이터 변경 없음.

확인:
1. 프로필 상단은 뒤로가기 버튼만 표시.
2. 소셜 버튼 PC 60x60 / 모바일 52x52.
3. 소개 폰트: PC 13px → 12px → 11px → 모바일 10px → 소형 모바일 9px.
4. 모바일 줄바꿈 밀도가 PC와 비슷하게 보이는지.
5. 기존 승인된 소개 위치/소셜 위치/배경 높이 유지.

보호:
- app324 프로필 공통 높이/왼쪽 소개 배치 유지.
- app323 소개 입력 crash fix 유지.
- app322 줄 수 제한 제거 유지.
- app320 핸들 입력/저장 검증 유지.
- 프로필 저장 API/이미지 크롭/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 승인 전 변경 금지.

## CURRENT TASK — app324 프로필 공통 배치 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app324.
- Final Release System Audit `37103755979` SUCCESS.
- Firebase PREVIEW Release `37103853836` SUCCESS.
- locked source `3dbd9f774c8cef0d39240d4f0a3f7988dc689573`.
- `preview.soridraw.com` app324 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 자기/다른 사용자 프로필 모두 동일한 270px(tablet)/335px(PC) 배경 높이.
2. 프로필 상단 툴바 명칭 모두 `MY 프로필`.
3. 소개글은 프로필 사진 바로 아래 왼쪽 열 전용.
4. 오른쪽 이름/통계/장르/소셜 영역 침범 없음.
5. 소셜 링크는 대표장르 아래 위치 유지.
6. 소개 입력 크래시 없음, 줄 수 제한 없음, 150자 제한 유지.
7. 모바일 190px 높이 및 기존 프로필/이미지 기능 회귀 없음.

보호:
- app323 소개 입력 crash fix 유지.
- app322 줄 수 제한 제거 유지.
- app320 핸들 자유 입력 후 저장 검증 유지.
- 프로필 이미지 크롭/줌, 저장 API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app323 소개 입력 크래시 수정 확인 + 프로필 레이아웃 후속 (2026-10-03 KST)

배포 완료:
- PREVIEW app323.
- Final Release System Audit `37103230539` SUCCESS.
- Firebase PREVIEW Release `37103325505` SUCCESS.
- locked source `4356e3635070a4fb7fe0fc956ea6ef688b5ef634`.
- `preview.soridraw.com` app323 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

즉시 확인:
1. 프로필 편집 → 소개 입력 시 전체 오류 화면이 다시 뜨지 않는지.
2. 줄 수 제한 없이 Enter/자동 줄바꿈 입력 가능.
3. 150자 제한은 유지.

다음 레이아웃 수정:
1. 소개를 전체 하단 폭이 아니라 **프로필 사진 바로 아래 왼쪽 열에만** 배치. 오른쪽 이름/통계/장르/소셜 영역 침범 금지.
2. 다른 사용자 프로필도 app314와 같은 상단 프로필 배경 높이 적용 필요.
3. 자기 프로필/타 사용자 프로필 상단 명칭의 최종 통일 방식 반영.
4. 소셜 링크의 현재 대표장르 아래 위치는 유지.

보호:
- app323 소개 입력 crash fix 유지.
- app322 줄 수 제한 제거 유지.
- app320 핸들 자유 입력 후 저장 검증 유지.
- 프로필 이미지 크롭/줌, 저장 API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app321 프로필 레이아웃/소개/핸들 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app321.
- Final Release System Audit `37099055378` SUCCESS.
- Firebase PREVIEW Release `37099154060` SUCCESS.
- locked source `a530a84f4c05f2e8c632fba46d0b0851b632e4e3`.
- `preview.soridraw.com` app321 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 핸들 저장 경고 문구가 요청 문구와 동일.
2. 오류 시 입력창 전체 빨간 테두리, 양끝 애매한 붉은 표시 없음.
3. 소개는 150자 / 실제 보이는 4줄 범위.
4. 5번째 Enter 또는 자동 줄바꿈 초과 시 기존 작성 문장이 사라지지 않음.
5. 저장 후 소개 줄바꿈이 편집 의도와 일치.
6. 상단 사진 + 우측 핵심 정보가 위로 이동.
7. 소개는 사진 아래, 소셜 링크는 대표장르 아래.
8. PC/모바일 및 기존 이미지 편집/프로필 저장 기능 회귀 없음.

보호:
- app320 핸들 자유 입력 후 저장 검증 방식 유지.
- app316 프로필 이미지 크롭/줌 구조 변경 금지.
- 프로필 저장 API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app320 프로필 소개/핸들 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app320.
- Final Release System Audit `37096804790` SUCCESS.
- Firebase PREVIEW Release `37096905327` SUCCESS.
- locked source `fa23583413a207c716a13333343c6149622917ce`.
- `preview.soridraw.com` app320 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 소개 Enter 줄바꿈이 공개 프로필에 그대로 보이는지.
2. 핸들 입력 중 대문자/한글/특수문자/길이 초과 문자열이 삭제 또는 자동변환되지 않는지.
3. 잘못된 핸들로 저장을 눌렀을 때만 경고 표시.
4. 정상 핸들로 수정 시 경고 즉시 해제 및 정상 저장.
5. 대표 장르 최대 5개, 소개 150자/4줄 유지.
6. app316 이미지 크롭 및 프로필 저장 경로 회귀 없음.

보호:
- 핸들 저장 유효성 계약(영문 소문자/숫자/점/밑줄, 3~24자, 점 처음·끝·연속 금지) 변경 금지.
- 입력 단계에서는 위 계약을 강제 필터링하지 않음.
- 프로필 저장 API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app318 프로필 편집 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app318.
- Final Release System Audit `37095952402` SUCCESS.
- Firebase PREVIEW Release `37096051261` SUCCESS.
- locked source `6f2bf80bde951eeea8736bce25fa1f4be612e22d`.
- `preview.soridraw.com` app318 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 대표 장르 최대 5개.
2. 소개 최대 150자.
3. 소개 최대 4줄, 입력창 세로 resize 금지.
4. 핸들 경고는 평소 숨김.
5. 잘못된 핸들로 저장할 때만 입력칸 경고 + 아래 안내문 표시.
6. 핸들을 정상 조건으로 수정하면 경고 즉시 해제.
7. app316 프로필 사진 초기 줌 및 배경 편집 정상.
8. 프로필 저장/공개프로필/소셜 링크 회귀 없음.

보호:
- 프로필 사진/배경 이미지 크롭 구조 추가 변경 금지.
- 프로필 저장 API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app316 프로필 사진 초기 확대 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app316.
- Release System Audit `37094788361` SUCCESS.
- Firebase PREVIEW Release `37094882121` SUCCESS.
- locked source `6399e8516acdfb274579d1e157cf5f7110205c4d`.
- `preview.soridraw.com` app316 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 프로필 사진 선택 직후 app315보다 덜 확대되어 보이는지.
2. 프로필 사진 슬라이더는 중앙에서 시작하는지.
3. avatar 범위 1~2 / 기본 1.5가 체감상 적절한지.
4. 배경 이미지 편집은 기존 1~3 / 기본 2 그대로인지.
5. 초기화, 드래그, 확대/축소, 적용, 취소, 저장 정상.
6. 대표 장르 4개 제한 및 다른 프로필 기능 회귀 없음.

보호:
- 배경 이미지 편집 동작 추가 변경 금지.
- 프로필 저장/API/미디어 업로드 구조 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app315 프로필 편집 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app315.
- Final Release System Audit `37093821640` SUCCESS.
- Firebase PREVIEW Release `37093928424` SUCCESS.
- locked source `118d15bcaac051fe524b7a14a2671abec5177a1b`.
- `preview.soridraw.com` app315 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

확인:
1. 프로필 사진 / 배경 사진 편집 게이지 기본 위치가 중앙.
2. 최초 상태에서 축소/확대 양쪽 모두 가능.
3. 초기화 시 중앙 줌으로 복귀.
4. 대표 장르 최대 4개.
5. 자동 추천/수동 추가/저장 모두 4개 제한.
6. 기존 프로필 저장/이미지 크롭/공개프로필 회귀 없음.

운영 규칙:
- 이후 수정 요청은 기본적으로 PREVIEW 수정 → 검증 → PREVIEW 배포까지 완료.
- TEST/PRODUCTION 승격은 기존 승인 규칙 유지.

## CURRENT TASK — app314 MY 프로필 높이 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app314.
- Final Release System Audit `37092786220` SUCCESS.
- Firebase PREVIEW Release `37092878119` SUCCESS.
- locked source `e3005b1f5b6ad43c3cea0b6f9bea1da0e37874e3`.
- `preview.soridraw.com` app314 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

확인:
1. PC MY 프로필 배경 높이 335px.
2. 태블릿 270px.
3. 모바일 190px 그대로.
4. 다른 사용자 공개 프로필 기존 높이 유지.
5. 높이 외 UI 변화 없음.

운영 규칙:
- 이후 사용자 수정 요청은 기본적으로 PREVIEW 수정 → 검증 → PREVIEW 배포까지 완료.
- TEST/PRODUCTION 승격은 기존 승인 규칙 유지.

## CURRENT TASK — app314 MY 프로필 높이 미세 조정 PREVIEW 배포 대기 (2026-10-03 KST)

구현/검증 완료:
- PC MY 프로필 배경 높이 **335px**.
- 태블릿 **270px**.
- 모바일 **190px 그대로**.
- 다른 사용자 공개 프로필 높이 비변경.
- 높이 외 UI 변경 없음.
- Release System Audit `37092580600` SUCCESS.
- TypeScript / Build PASS.
- 서버/데이터/Worker/Functions/Rules 변경 없음.

현재:
- preview HEAD: `259100d5f303198f52406163c4ef367e8e5cff04`.
- 실제 PREVIEW는 app313.
- `public/app-version.json`: {   "version": 313 }
- **배포 전 / 실사용 검증 전**.

다음:
- 사용자가 프리뷰배포를 요청하면 app314로 버전 고정 후 Firebase PREVIEW Hosting만 배포.
- PC/태블릿 높이와 모바일 비변경 확인.

## CURRENT TASK — app313 MY 프로필 높이 실사용 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app313.
- Final Release System Audit `37092012879` SUCCESS.
- Firebase PREVIEW Release `37092136757` SUCCESS.
- locked source `8def3f847ea8735bfbf14a934b020c6a91f0d180`.
- `preview.soridraw.com` app313 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

확인:
1. PC(>=1600): MY 프로필 배경 높이 315px.
2. 태블릿(721~1599): 252px.
3. 모바일(<=720): 기존 190px 그대로.
4. 다른 사용자 공개 프로필: 기존 높이 그대로.
5. 높이 외 UI 변화 없음.

보호:
- app312 최신 공개곡 전체/팔로잉 기능 변경 금지.
- app311 승격관리 ↔ 추천 피드 parity 변경 금지.
- app310 승격관리 최초 D1 R0 변경 금지.
- 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app313 MY 프로필 배경 높이 후보 PREVIEW 배포 대기 (2026-10-03 KST)

구현 완료:
- PC MY 프로필 배경 높이 315px(기존 대비 1.5배).
- 태블릿 252px(기존 대비 1.2배).
- 모바일 190px 그대로.
- 다른 사용자 공개 프로필 기존 높이 유지.
- 높이 외 스타일/배치 변경 없음.
- Release System Audit `37091395204` SUCCESS.
- TypeScript / Build PASS.
- 서버/데이터/Worker/Functions/Rules 변경 없음.

현재:
- preview HEAD: `67f3c59e5225c3e3898b8bdaa0431fa8a94c5e5c`.
- 실제 PREVIEW는 app312.
- **배포 전 / 실사용 검증 전**.

다음:
- 사용자가 프리뷰배포를 요청하면 app313 버전 고정 후 Firebase PREVIEW Hosting만 배포.
- PC(>=1600), 태블릿(721~1599), 모바일(<=720) 높이 실기기 확인.
- 다른 공개 프로필 높이 비변경 확인.

## CURRENT TASK — app312 최신 공개곡 전체/팔로잉 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app312.
- final Release System Audit `37090441432` SUCCESS.
- Firebase PREVIEW Release `37090519862` SUCCESS.
- locked source `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.
- `preview.soridraw.com` app312 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

확인:
1. `최신 공개곡` 제목 표시.
2. 바로 아래 `전체 / 팔로잉` 버튼이 장르별 추천 버튼과 동일한 위치/스타일.
3. 전체:
   - 기존 모든 사용자의 최신 공개곡.
   - 기존 시간 순서/레일/카드 크기 유지.
4. 팔로잉:
   - 내가 팔로우한 크리에이터 곡만 노출.
   - 기존 latest Feed의 시간 순서 유지.
   - warm 전환 D1 R0/W0 목표.
5. 팔로우/해제 후 같은 기기 팔로잉 결과 즉시 반영.
6. PC/모바일 동일 동작.
7. 추천/인기/크리에이터/장르별 추천/좋아요/승격/공개·비공개 회귀 없음.

보호:
- app311 승격관리 ↔ 추천 피드 parity 변경 금지.
- app310 승격관리 최초 D1 R0 변경 금지.
- 기존 latest Feed/R2 snapshot/revision 구조 변경 금지.
- 새 following 전용 D1 Feed/전체 scan 추가 금지.
- app302 저장 하트 / app301 폴더 / app303 Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app312 후보 PREVIEW 배포 대기 (2026-10-03 KST)

구현/검증 완료:
- `최신` → `최신 공개곡`.
- `전체 / 팔로잉` 버튼을 장르별 추천 버튼과 동일한 toolbar 스타일로 추가.
- 전체 = 기존 최신 Feed.
- 팔로잉 = 기존 latest Feed + 기존 local/R2 following bundle의 로컬 필터.
- Release System Audit `37090109213` SUCCESS.
- TypeScript / Build / 관련 verifier PASS.
- Worker / Functions / Rules / 사용자 데이터 변경 없음.

현재:
- preview branch 후보 HEAD: `1fe077326460208d33a0289786f2988af0d399b0`.
- 실제 PREVIEW 배포 앱은 app311.
- `public/app-version.json`도 311.
- **배포 전 / 실사용 검증 전**.

다음:
1. 사용자가 `프리뷰배포` 또는 명확한 배포 요청을 하면 app312로 버전 고정.
2. Firebase PREVIEW Hosting만 배포.
3. `preview.soridraw.com` exact build 확인.
4. CACHE LIVE:
   - 전체 클릭: 추가 D1 R0/W0.
   - 팔로잉 클릭 warm: 추가 D1 R0/W0.
   - 팔로잉 first recovery: social R2만 허용, 새 D1 feed 조회 금지.
5. PC/모바일 버튼 위치와 기존 레일 크기 동일 확인.
6. TEST/PRODUCTION 변경 없음 확인.

보호:
- app311 승격관리/추천 피드 parity 변경 금지.
- app310 승격관리 최초 D1 R0 변경 금지.
- 인기/좋아할 만한 크리에이터/장르별 추천 동작 변경 금지.
- 기존 좋아요/공개·비공개/저장 하트/폴더/Split 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app311 승격관리 ↔ 일반 추천 피드 일치 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app311.
- Release System Audit `37088793832` SUCCESS.
- Firebase PREVIEW Release `37088927776` SUCCESS.
- locked source `580805847292d03ca2120c7e659d8c9e37ba90c6`.
- `preview.soridraw.com` app311 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

최소 확인:
1. 기기 A에서 곡 1개 승격 또는 해제.
2. 기기 B에서 승격 곡 관리 진입:
   - 최신 목록 표시.
   - D1 R0 목표(app310 유지).
3. 기기 B에서 관리 화면 닫기:
   - 일반 SORIDRAW 추천 피드도 방금 본 최신 목록과 즉시 동일해야 함.
   - 별도 새로고침/추가 D1 목록읽기 없어야 함.
4. 다른 정상 기능 회귀 없음.

보호:
- 승격 R1/W1, 해제 추가 R0/W1 비용 계약 유지.
- 일반 Explore 최신/인기/크리에이터/장르 변경 금지.
- app302/app302b Studio 저장 하트 변경 금지.
- app301 Music Note / Library 폴더 변경 금지.
- app303 Split 변경 금지.
- 기존 좋아요/공개·비공개 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app310 승격관리 최초 진입 D1 R0 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app310.
- Release System Audit `37087850076` SUCCESS.
- PREVIEW Worker Release `37087979937` SUCCESS.
- PREVIEW Worker version `191554c0-f3d2-4731-999f-f57a57a07994`.
- Firebase PREVIEW Release `37088038676` SUCCESS.
- locked source `d8890e22060ee884c7e070463608f1f7576a0f67`.
- `preview.soridraw.com` app310 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 / D1 schema / Rules 변경 없음.

CACHE LIVE 최소 확인:
1. app310 업데이트 후 CACHE LIVE 초기화.
2. 승격 곡 관리 첫 진입:
   - 현재 9곡 표시 정상.
   - `/v1/manage/curated` D1 R0 / W0 목표.
   - 과거처럼 rows read 약 43 증가하면 FAIL.
3. Explore로 나갔다 재진입:
   - D1 R0 / W0 목표.
4. 60초 뒤 변경 없이 재진입:
   - D1 R0 / W0 목표.
5. 승격/해제는 이번 범위 아님:
   - 승격 기존 R1/W1 유지.
   - 해제 추가 R0/W1 유지.

보호:
- 일반 Explore 추천 / 최신 / 인기 / 크리에이터 / 장르 UI 변경 금지.
- app302/app302b Studio 저장 하트 변경 금지.
- app301 Music Note / Library 폴더 변경 금지.
- app303 Split browser-history / Pure Pane 변경 금지.
- 기존 좋아요/공개·비공개 경로 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app309 승격관리 warm 재진입 비용 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app309 / Release Run `37086923105` SUCCESS.
- locked source `2236b051451d6e71884a3ee1be125359124602ae`.
- `preview.soridraw.com` app309 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

최소 CACHE LIVE 확인:
1. 업데이트 후 승격 곡 관리 첫 진입.
   - 관리 캐시 최초 seed이므로 `/v1/manage/curated` D1 R1은 허용.
2. 아무 변경 없이 Explore로 돌아갔다 승격 곡 관리 재진입.
   - `/v1/manage/curated` 추가 요청 0 목표.
   - D1 R0 / W0 목표.
3. 60초를 넘긴 뒤 아무 변경 없이 다시 진입.
   - `/v1/curated-revision` 확인은 허용.
   - D1 R0 / W0 목표.
   - revision 동일이면 `/v1/manage/curated` 재조회 금지.
4. 실제 곡 1개 승격 또는 해제 후 다음 진입.
   - 변경 때문에 관리 캐시 재동기화 1회는 허용.
   - 기존 승격 R1/W1, 해제 추가 R0/W1 계약 유지.

보호:
- 일반 Explore `/v1/curated` D1 R0 경로 변경 금지.
- 승격/해제 mutation 구조 추가 최적화 금지 — 이번 범위 아님.
- app302/app302b Studio 저장 하트 변경 금지.
- app301 Music Note / Library 폴더 변경 금지.
- app303 Split browser-history / Pure Pane 변경 금지.
- 기존 좋아요/공개·비공개 경로 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app306 Explore 순서 / PC 좌우 버튼 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app306 / Release Run `37076722003` SUCCESS.
- locked source `decf246958b596f4345c8012fe680cf4afde8d5b`.
- `preview.soridraw.com` app306 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Rules / 사용자 데이터 변경 없음.

확인:
1. Explore 순서:
   - SORIDRAW 추천
   - 최신
   - 인기
   - 좋아할 만한 크리에이터
   - 장르별 추천
2. PC(1600px+)에서 Explore 가로레일의 왼쪽/오른쪽 버튼이 항상 보임.
3. PC MY 프로필 고정곡 가로레일도 양쪽 버튼이 항상 보임.
4. 시작/끝 위치의 비활성 버튼도 위치가 사라지지 않음.
5. 태블릿/모바일은 기존 표시/숨김 동작 유지.
6. 카드 디자인/가로스크롤/스냅/좋아요/공개·비공개/저장 하트 회귀 없음.

보호:
- app302/app302b Studio 저장 하트 변경 금지.
- app301 Music Note / Library 폴더 경로 변경 금지.
- app303 Split browser-history / Pure Pane 변경 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app305 Explore 기존 추천 복구 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app305 / Release Run `37075730053` SUCCESS.
- locked source `647bfe2b21a2195ac281462b6464da84c10b9364`.
- `preview.soridraw.com` app305 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Rules / 사용자 데이터 migration 변경 없음.

현재 화면의 의도된 순서:
1. SORIDRAW 추천
2. 장르별 추천
3. 좋아할 만한 크리에이터
4. 최신 — 최대 20곡
5. 인기 — 최대 20곡

유지:
- 상단 MY 프로필 버튼.
- 기존 추천/장르/크리에이터 카드 디자인과 가로 레일 동작.
- app304 인기 R2 local-first 경로.
- 기존 좋아요/공개·비공개/저장하트/폴더/Split 기능.

FAIL:
- 기존 추천 3종 중 하나라도 사라짐.
- 최신/인기가 별도 페이지/탭으로 다시 분리됨.
- 최신/인기 추가 때문에 기존 추천 데이터/카드가 바뀜.
- warm Explore 재진입에서 새 D1 직접 read가 추가됨.

사용자 `테스트배포` 전 main/TEST 승격 금지.
PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app304 Explore 최신/인기 홈 실기기 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app304 / Release Run `37075062146` SUCCESS.
- locked source `e2547cf7d3a7bc6e90df052aa474f15e42df6f05`.
- `preview.soridraw.com` app304 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Rules / 사용자 데이터 migration 변경 없음.

사용자 확인:
1. Explore 상단의 기존 `추천 / 최신 / 인기` 페이지 탭이 없어졌는지.
2. 같은 홈 화면에 **최신**과 **인기** 레일이 각각 최대 20곡 표시되는지.
3. 기존 탭 위치의 **MY 프로필** 버튼이 자기 프로필로 이동하는지.
4. 계정 메뉴와 Studio left-rail에서 `MY 프로필` 명칭이 보이는지.
5. 자기 프로필 상단은 `MY 프로필`, 다른 사용자 프로필 상단은 `공개 프로필`인지.
6. PC / 모바일 카드 크기·액션·좋아요 표시가 기존과 같은지.
7. Explore 재진입 warm cache에서 D1 직접 read가 새로 생기지 않는지.

보호:
- app302/app302b Studio 저장 하트 변경 금지.
- app301 Music Note / Library 폴더 경로 변경 금지.
- app303 Split browser-history / Pure Pane 경로 변경 금지.
- 이번 UI 후속 요청 전 추천·장르별추천·크리에이터 추천 기능 확장 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## COMPLETED — app302 Studio 저장 하트 실기기 확인 / Skill 동결 (2026-10-03 KST)

- 사용자 실기기 확인: **정상 적용**.
- app302/app302b Studio 저장 하트 경로는 현재 정상 보호 기준으로 동결.
- `local-first-like-sync` Skill과 `song-save-edit-sync-cost` Skill에 방금 pending-layer 패치까지 반영 완료.
- 새 구체 오류가 없으면 Studio 저장 하트/Explore 좋아요 정상 경로 추가 수정 금지.
- 다음 작업에서 "하트/좋아요"라는 표현만으로 두 상태기를 합치지 말 것:
  - Explore 공개 좋아요 → app164/Worker195 좋아요 기준.
  - Recent 저장 하트/Music Note favorite → app302/app302b 기준.
- TEST 승격은 사용자 명시 `테스트배포` 전 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app302 PREVIEW 실기기 최종 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app302 / Release Run `37066438604` SUCCESS.
- locked source `bfe9893405ac50a314e1d4b8ab9eeafdedce3136`.
- `preview.soridraw.com` app302 exact build PASS.
- TEST / PRODUCTION unchanged.
- app302b pending-layer cleanup 포함.

최소 실기기 확인:
1. PC Recent에서 아직 저장 안 된 곡 1개 저장.
   - PC Music Note 즉시 표시.
   - 30초 전 favorite Firestore W0.
2. 같은 곡을 30초 안 저장→해제.
   - PC 즉시 최종 해제.
   - settlement 뒤 favorite W0 목표.
   - pending local row가 Music Note에 남지 않아야 함.
3. 같은 곡 저장→해제→저장.
   - 마지막 클릭 +30초 뒤 favorite W1.
   - 모바일은 canonical 성공 뒤 새로고침/탭 왕복 없이 반영.
4. 모바일에는 30초 전 PC의 임시 heart 상태가 나타나지 않아야 함.
5. 반대로 모바일에서 저장/해제해도 같은 원칙.
6. receiver Firestore R0/W0 / D1 R0/W0.
7. 서로 다른 곡 여러 개는 곡별 독립 30초 timer.
8. Recent 제목/프롬프트/가사 즉시 cross-device preview 정상.
9. app301 Music Note / Library 폴더 정상 기능 회귀 없음.

FAIL:
- 같은 기기 Music Note가 30초를 기다려야 표시됨.
- net-zero 뒤 optimistic pending row가 남음.
- 30초 전 다른 기기에 임시 저장 상태가 표시됨.
- net-zero favorite write 발생.
- canonical 성공 뒤 다른 기기 반영에 Firestore read 또는 수동 새로고침 필요.

사용자 `테스트배포` 전 main/TEST 승격 금지.
PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app302 Recent 저장 하트 실기기 검증 (2026-10-03 KST)

현재 후보:
- app302 제품 commit `24447627c2222d5cedc6fe96dcaccbfb26c0593a`.
- 저장을 누른 **현재 기기**는 Music Note local pending overlay로 즉시 표시.
- **다른 기기**에는 pre-canonical heart preview를 보내지 않음.
- 같은 곡 저장↔저장해제 반복은 기존 30초 final-state:
  - 마지막 클릭마다 30초 재시작.
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
- canonical 성공 뒤 기존 save/unsave RTDB signal로 다른 기기 반영.
- app302 apply/verify Run `37064864663` SUCCESS / focused verifier PASS / TypeScript PASS / Build PASS.
- TEST / PRODUCTION 변경 금지.

PREVIEW 배포 후 최소 확인:
1. PC에서 최근 생성곡 1곡 저장.
2. 바로 Music Note 진입:
   - 같은 PC에서 곡 즉시 표시.
   - 30초 전 favorite Firestore W0.
3. 모바일에서는 30초 전 임시 저장 상태가 나타나지 않아야 함.
4. 같은 곡을 30초 안 저장→해제:
   - PC 화면은 즉시 최종 해제.
   - 30초 후 favorite W0 목표.
5. 같은 곡을 저장→해제→저장:
   - 마지막 클릭부터 30초 뒤 favorite W1.
   - 모바일은 canonical 성공 뒤 새로고침/탭 왕복 없이 반영.
6. receiver Firestore R0/W0 / D1 R0/W0.
7. 서로 다른 곡 여러 개는 곡별 독립 30초 timer 유지.
8. Recent 제목/프롬프트/가사 즉시 cross-device preview 및 app301 폴더 기능 회귀 없음.

FAIL:
- 저장한 기기 Music Note가 30초를 기다려야 표시됨.
- 30초 전 다른 기기에 Studio heart 임시 상태가 표시됨.
- 같은 곡 반복 토글이 최종상태가 아니라 중간 상태를 canonical 저장.
- net-zero인데 favorite write 발생.
- canonical 성공 뒤 다른 기기 반영에 Firestore read가 추가되거나 새로고침이 필요.

## CURRENT TASK — app301 폴더 기준 동결 상태 (2026-10-03 KST)

- Music Note / Library 폴더 생성·저장·이름변경·삭제·순서이동 관련 전용 Skill 저장 완료.
- 현재 보호 기준: `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`.
- Library app301 warm delete 사용자 영상: R0 / user_playlists W2 for two deletes / users immediate W0 / D1 R0/W0 / Worker 0 PASS.
- 앱 코드는 변경하지 않음.
- 새로운 구체 폴더 오류가 없으면 app301 정상 폴더 경로 추가 수정 금지.
- 추후 폴더 관련 작업 전 반드시 신규 Skill + baseline을 먼저 읽을 것.
- TEST 승격은 사용자 명시 `테스트배포` 전 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app301 Library create/delete 실기기 최종 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app301 / Run `37058559063` SUCCESS.
- locked source `3b1a24a3a28c212c128a171efed7401ac58de0b7`.
- `preview.soridraw.com` app301 exact build PASS.
- TEST / PRODUCTION unchanged.

최소 테스트:
1. CACHE LIVE 초기화.
2. 빈 마이 리스트 folder 3개 연속 생성:
   - `user_playlists:batch +3`.
   - `user_playlists:getDocs 0`.
   - 60초 전 `users:batch 0`.
3. 방금 만든 빈 folder 3개 연속 삭제:
   - warm `user_playlists:getDocs 0`.
   - `user_playlists:batch +3`.
   - 60초 전 delete 때문에 `users:batch` 증가 0.
4. 마지막 metadata 변경 후 60초:
   - `users:batch W1` 목표.
5. 상대 기기 create/delete 즉시 반영, receiver Firestore R0/W0.
6. 공유 리스트도 같은 원칙.
7. 곡이 든 folder 삭제는 item 수 + folder W1은 정상; 전체 list reread/rewrite 금지.
8. app299 reorder / rename / Library item 기능 회귀 없음.
9. D1 R0/W0 / Worker 0.

FAIL:
- create에서 getDocs.
- warm empty delete에서 getDocs.
- create/delete마다 users 즉시 W1.
- cross-device 즉시 반영 실패.

사용자 `테스트배포` 전 main/TEST 승격 금지.
PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app301 PREVIEW Library create/delete 비용 실기기 검증 (2026-10-03 KST)

현재 판정:
- app299 사용자 영상의 누적 W7/users W3/R3은 **create 4회 + delete 3회**로 설명됨.
- create는 이미 R0 + playlist W1/회 + users delayed batch라 정상.
- delete는 app300 warm R0 보강에 더해 app301에서 users revision도 60초 batch로 통일.

PREVIEW 배포 후 최소 테스트:
1. app301 확인 → CACHE LIVE 초기화.
2. 빈 마이 리스트 폴더 **3개 연속 생성**:
   - `user_playlists:batch +3`.
   - `user_playlists:getDocs 0`.
   - 60초 전 `users:batch 0`.
   - 새 폴더 선택/표시 즉시 정상.
3. 방금 만든 빈 폴더 **3개 연속 삭제**:
   - warm path `user_playlists:getDocs 0`.
   - `user_playlists:batch +3`.
   - 60초 전 delete 때문에 `users:batch` 증가 금지.
   - 삭제/다음 폴더 선택 즉시 정상.
4. 마지막 create/delete/reorder metadata 변경 후 60초:
   - `users:batch W1` 목표.
5. 같은 계정 다른 기기:
   - create/delete가 새로고침/페이지 왕복 없이 즉시 반영.
   - receiver Firestore R0/W0.
6. 공유 리스트도 같은 원칙.
7. 곡이 든 폴더 삭제:
   - warm read R0.
   - 실제 item delete 수 + folder W1은 정상 canonical cost.
   - 전체 playlist/list 재조회 금지.
8. D1 R0/W0 / Worker 0.
9. Library item add/delete/move/color/swap, rename, app299 reorder 정상 회귀 없음.

FAIL:
- create에서 getDocs 발생.
- warm empty delete에서 getDocs 발생.
- create/delete마다 users W1 즉시 반복.
- PC↔모바일 즉시 반영 누락.
- 실제 item 삭제 누락.

사용자 `테스트배포` 전 main/TEST 승격 금지.
PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app300 실기기 warm delete R0 확인 (2026-10-03 KST)

배포 완료:
- PREVIEW app300 / Run `37055366260` SUCCESS.
- locked source `0c56140c95de7e24b67bf402fee32efb54c37705`.
- `preview.soridraw.com` app300 exact build PASS.
- TEST / PRODUCTION unchanged.

이번 확인은 짧게:
1. CACHE LIVE 초기화.
2. 마이 리스트 기본 폴더를 한 번 열어 곡 목록 표시 확인.
3. 빈 비기본 폴더 선택 → 빈 화면 로딩 완료 → 삭제.
4. 기대: `user_playlists:getDocs 0`.
5. 빈 폴더 삭제 자체는 `user_playlists:batch W1 + users:batch W1`.
6. 같은 삭제를 2~3회 반복해도 getDocs가 delete 때문에 증가하지 않아야 함.
7. 삭제 후 다음 warm 폴더 화면 정상.
8. app299 reorder는 계속 즉시 반영 + 60초 final-state 구조 유지.

warm 삭제에서 getDocs가 다시 +1이면 FAIL이며 원인 미해결로 기록.
cold/stale snapshot 자체가 없는 예외 caller의 bounded fallback read는 허용.
TEST/PRODUCTION 승격 금지.

## CURRENT TASK — app300 PREVIEW Library warm delete R0 재검증 (2026-10-03 KST)

app299 사용자 영상:
- reorder 반복 구간 R0/W0 → app299 reorder 개선 PASS.
- warm empty folder delete마다 `user_playlists:getDocs +1` 반복 → 삭제 R0 목표 FAIL.
- 첫 삭제 전에 기본 폴더를 이미 열어 목록을 표시했으므로 "다음 폴더 최초 cold read"만의 문제로 보지 않음.

app300 후보:
- code commit `837d6ce5d3f3d8d2c45bb0f8a170e6be57a6eab9`.
- active playlist의 완료된 exact item ID snapshot을 playlistId와 함께 고정.
- canonical delete commit 전에 local list cache를 동일 syncVersion으로 선반영하여 local users revision에 의한 불필요 list refresh race 차단.
- commit 실패 시 local metadata rollback.
- Backend Safety `37054867155` SUCCESS.
- Release Audit `37055069258`: TypeScript/Build/diagnose PASS, overall은 기존 stale verify-221 한 건만 동일.
- TEST / PRODUCTION 변경 금지.

PREVIEW 배포 후 최소 확인:
1. app300 확인 후 CACHE LIVE 초기화.
2. 마이 리스트 기본 폴더를 한 번 열어 곡 목록을 확인.
3. 별도 빈 비기본 폴더 선택 → 빈 화면 로딩 완료 → 삭제.
4. 기대: `user_playlists:getDocs 0`, 빈 폴더 기준 `user_playlists:batch W1 + users:batch W1`.
5. 같은 과정을 2~3회 반복해도 delete 때문에 getDocs 누적 증가 금지.
6. 삭제 후 기본/다른 warm 폴더가 즉시 정상 표시.
7. 상대 기기 삭제 즉시 반영.
8. app299 reorder는 60초 전 W0, 마지막 변경 60초 뒤 final-state settlement 유지.
9. D1 R0/W0 / Worker 0.
10. 실제 item cache가 존재하지 않는 cold/stale 삭제 caller는 bounded fallback read 허용.

판정:
- warm 삭제 1회라도 `user_playlists:getDocs +1`이면 FAIL.
- 삭제 누락/실패 복구/PC↔모바일 회귀가 있어도 FAIL.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app299 배포 후 Library reorder 비용/동기화 실기기 확인 (2026-10-02 KST)

배포 완료:
- PREVIEW app299 / Run `37022415990` SUCCESS.
- locked source `522420c7d9801e98537b6994979959b94e3dd131`.
- `preview.soridraw.com` app299 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Rules 변경 없음.

사용자 최소 확인:
1. PC/모바일 둘 다 app299 확인.
2. 같은 마이 리스트 폴더를 60초 안 5~7회 이동:
   - 상대 기기 즉시 같은 순서.
   - 60초 전 reorder `user_playlists:batch` 반복 증가 0 목표.
   - 마지막 변경 후 60초에 해당 폴더 `user_playlists:batch W1 + users:batch W1` 목표.
3. 같은 폴더를 움직였다 원래 위치로 되돌리고 60초:
   - reorder canonical W0 목표.
4. 서로 다른 폴더를 여러 개 움직이면 unique moved folder 수만큼 playlist write + users W1.
5. 공유 리스트도 동일.
6. folder delete:
   - active folder 로딩 완료 후 삭제 전 `user_playlists:getDocs 0`.
   - 삭제 후 자동 선택된 next folder가 warm cache면 R0.
   - 실제 cache가 없는 cold/stale next folder의 최초 bounded R1은 정확성 보호 경로.
7. create/rename/delete/item add-delete-move/color/swap 회귀 없음.
8. D1 R0/W0 / Worker 0.

판정:
- drag마다 Firestore write가 보이면 FAIL.
- warm next-folder cache인데도 delete 후 getDocs가 나오면 FAIL.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app299 PREVIEW Library reorder 60초 final-state 실기기 검증 (2026-10-02 KST)

현재 후보:
- app299 code commit `114b3095745356f949bac7a323056dd6759ce85b`.
- 동일 폴더 reorder 반복은 local/cache + RTDB 즉시, canonical playlist order는 마지막 변경 후 60초 final-state.
- Backend Safety `37021658904` SUCCESS.
- Release Audit `37021945536`: TypeScript/Build/diagnose PASS, overall은 기존 stale verify-221 한 건만 동일.
- TEST / PRODUCTION 변경 금지.

PREVIEW 배포 후 최소 확인:
1. PC/모바일 모두 app299.
2. 같은 Library 마이 폴더를 60초 안 5~7회 이동:
   - 매번 상대 기기에 새로고침/페이지 왕복 없이 즉시 같은 순서.
   - 60초 전 `user_playlists:batch` reorder canonical write 반복 증가 **0** 목표.
   - 마지막 변경 후 60초에 해당 폴더 `user_playlists:batch W1 + users:batch W1` 목표.
3. 같은 폴더를 움직였다 원래 canonical 위치로 되돌린 뒤 60초:
   - reorder canonical W0 목표.
4. 서로 다른 폴더 여러 개를 움직이면:
   - 변경된 unique playlist 수만큼만 playlist write.
   - users revision은 batch 전체 W1.
5. 공유 리스트도 동일한 final-state 동작.
6. folder delete:
   - active folder 로딩 완료 상태 삭제 전 `user_playlists:getDocs 0`.
   - 삭제 후 자동 선택된 다음 폴더에 정상 item cache가 있으면 R0.
   - 다음 폴더 cache가 실제로 없는 cold/stale 최초 접근은 정확성 보호용 bounded R1 허용.
7. create/rename/delete/item add-delete-move/color/swap 기존 정상 회귀 없음.
8. D1 R0/W0 / Worker 0.

판정:
- reorder 즉시 동기화 + 60초 final-state canonical batch가 모두 맞아야 PASS.
- drag마다 Firestore write가 다시 보이면 FAIL.
- warm next-folder cache인데도 delete 뒤 getDocs가 나오면 FAIL.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app298 warm Library folder delete 최종 실기기 확인 (2026-10-02 KST)

배포 완료:
- PREVIEW app298 / Run `37015147954` SUCCESS.
- locked source `e16183ae37b6c34d509f065afd63b5f3c120a99a`.
- TEST / PRODUCTION unchanged.

사용자 최소 확인:
1. Library 비기본 폴더를 선택하고 내용 로딩 완료.
2. CACHE LIVE 초기화.
3. 그 폴더 삭제.
4. 기대:
   - `user_playlists:getDocs 0`.
   - 빈 폴더라면 `user_playlists:batch W1 + users:batch W1`.
   - 폴더 즉시 삭제 / 남은 폴더 선택 정상.
   - 상대 기기 삭제 즉시 반영.
   - D1 R0/W0 / Worker 0.
5. cold/stale 상태에서 로딩 완료 전 삭제하는 예외는 정확성 보호용 bounded fallback read 허용.

app297 reorder/create/rename 및 Music Note 정상 기능은 동결.
TEST 승격은 사용자 `테스트배포` 지시 전 금지.
PRODUCTION은 별도 명확 승인 전 금지.

## CURRENT TASK — app298 Library 폴더 삭제 warm R0 실기기 검증 (2026-10-02 KST)

현재:
- app297에서 관측된 Library folder delete `user_playlists:getDocs R1`만 최소 수정.
- app298 code commit `c0dfac2fa45536692db7eda4ac8602c22067accd`.
- 활성 playlist가 로딩 완료된 정상 warm path는 화면이 이미 가진 item IDs를 재사용하여 delete 전 Firestore reread를 제거.
- cold/stale fallback read는 데이터 안전을 위해 유지.
- Backend Safety `37014662854` SUCCESS.
- Release Audit `37014825981`: TypeScript/Build/diagnose PASS, overall은 기존 stale verify-221 한 건만 FAIL.
- TEST / PRODUCTION 변경 금지.

PREVIEW 배포 후 최소 확인:
1. app298 확인.
2. Library 마이 리스트에서 비기본 폴더를 선택해 내용 로딩이 끝난 뒤 CACHE LIVE 초기화.
3. 폴더 삭제:
   - `user_playlists:getDocs` **0** 목표.
   - 빈 폴더 기준 `user_playlists:batch W1 + users:batch W1`.
   - 폴더가 즉시 사라지고 선택이 남은 폴더로 정상 이동.
4. 같은 계정 상대 기기에서도 삭제가 즉시 반영.
5. D1 R0/W0 / Worker 0.
6. app297 reorder/rename/create 정상 기능 회귀 없음.

주의:
- 아직 로딩 전인 cold/stale folder를 즉시 삭제하는 예외 경로는 정확한 item 삭제를 위해 bounded `getDocs` fallback을 유지한다.
- 정상 warm 경로에서 다시 R1이 보이면 FAIL.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app297 PREVIEW Library reorder 실기기 검증 (2026-10-02 KST)

배포 완료:
- Firebase PREVIEW Run `36953630146` SUCCESS.
- locked source `080fa7e98f10c892ec06401c05f824a7b509b61c`.
- `preview.soridraw.com` app297 exact build PASS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Rules 변경 없음.

사용자 확인은 아래만 수행:
1. PC/모바일 둘 다 app297.
2. 마이 리스트 폴더 한 번 이동:
   - 상대 기기 즉시 같은 순서.
   - `user_playlists:write +1` 목표.
   - `users:write` 즉시 +1 금지.
3. 60초 안 reorder 3~5회:
   - playlist write는 실제 이동 횟수만큼.
   - 마지막 변경 후 60초 users revision W1 목표.
4. 공유 리스트 한 번 이동:
   - 폴더가 5개여도 `user_playlists +1`, 기존 +5 재현 시 FAIL.
   - 상대 기기 즉시.
5. 수신기 Firestore R0/W0, D1 R0/W0, Worker 0 목표.
6. Library rename/create/delete/item 정상 회귀 확인.
7. playlist delete에서 `getDocs R1`이 다시 보이면 warm-cache 상태와 함께 별도 후속 처리.

판정:
- 실시간 동기화 + moved playlist W1이 맞으면 reorder PASS.
- 전체 folder rewrite / users 즉시 반복 write / 상대기기 미반영 중 하나라도 있으면 FAIL.
- TEST 승격은 사용자 `테스트배포` 지시 전 금지.
- PRODUCTION은 별도 명확 승인 전 금지.

## CURRENT TASK — app297 Library 폴더 순서 실기기 재검증 (2026-10-02 KST)

현재:
- app296 사용자 영상에서 Library 폴더 reorder 비용 회귀와 동일계정 PC↔모바일 즉시 동기화 누락 확인.
- 원인: reorder 1회가 섹션의 모든 playlist order 문서 + users revision을 즉시 쓰고, RTDB reorder signal이 없었음.
- app297 후보 code commit `bc4da91e042a8fbc065971acbd9e4e445f84615b`에서 최소 수정 완료.
- moved playlist 1개만 numeric fractional order W1, users revision은 60초 UID batch, RTDB `playlist-order` 즉시 sync.
- Backend Safety `36953291017` SUCCESS.
- Release Audit `36953307140`: TypeScript/Build/진단 A~D PASS, overall은 기존 stale verify-221 한 건만 FAIL.
- TEST / PRODUCTION 변경 금지.

PREVIEW 배포 후 최소 검증:
1. PC/모바일 모두 app297 확인.
2. 마이 리스트에서 폴더 하나를 한 칸 이동:
   - 상대 기기에 새로고침/페이지 왕복 없이 즉시 같은 위치 반영.
   - CACHE LIVE `user_playlists:write +1` 목표.
   - 기존처럼 +6 등 전체 폴더 수만큼 증가하면 FAIL.
   - 즉시 `users:write +1`이 붙지 않아야 함.
3. 60초 안 마이 리스트 reorder를 3~5회:
   - 각 이동은 상대 기기에 즉시.
   - playlist write는 실제 이동 횟수만큼만 증가.
   - 마지막 이동 후 60초 정착 시 users revision **W1** 목표.
4. 공유 리스트도 동일:
   - 5개 폴더라도 reorder 1회 `user_playlists +1` 목표, +5면 FAIL.
5. 수신 기기 reorder signal 자체 Firestore R0/W0 / D1 R0/W0 / Worker 0.
6. rename/create/delete와 Library 곡 item 동작은 기존 정상 회귀 없음.
7. 영상에서 별도로 관측된 playlist delete `getDocs R1`은 reorder PASS 후 warm-cache 조건을 따로 재현해 판단.

판정:
- cross-device 즉시 + moved playlist W1이 모두 맞으면 app297 reorder PASS.
- 전체 playlist rewrite, users immediate write, 상대 기기 미반영 중 하나라도 재현되면 TEST 승격 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확 승인 전 변경 금지.

## CURRENT TASK — app296 PREVIEW Music Note + Library My/Shared 60초 batch 실기기 검증 (2026-10-02 KST)

현재:
- app296 PREVIEW 배포 완료. Firebase PREVIEW Run `36950877406` SUCCESS / app296 exact build PASS.
- Music Note folder create/rename/reorder: local + RTDB 즉시, `user_structures` canonical 60초 UID final-state batch.
- Music Note folder delete / song membership change: 기존 즉시 canonical 안전 경로 유지.
- Library create: playlist W1 즉시 + users revision 60초 UID batch.
- Library rename: local + RTDB 즉시, unique playlist title final-state 60초 batch + users revision W1.
- Library aggregate single-document cutover는 TEST/PRODUCTION 구버전 호환 때문에 아직 미실행.
- TypeScript PASS / Build PASS (Release System Audit Run `36950546019`).
- Backend V2 Safety `36950337897`, `36950358483` SUCCESS.
- 전체 Release System Audit overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` 한 건이며 이번 folder batch와 무관.

배포 후 실기기 최소 검증:
1. PC/모바일 모두 app296 확인.
2. Music Note 마이 노트에서 폴더 생성/이름변경/순서변경을 합계 7회 이상 60초 안에 연속 수행.
   - 각 UI 변경은 즉시.
   - 반대 기기도 새로고침/탭 왕복 없이 즉시.
   - 60초 전 Browser SDK `user_structures:write` 반복 증가 금지.
   - 마지막 변경 후 60초 정착 시 `user_structures:write W1` 목표.
   - Function server-side users revision은 canonical batch 1회 기준으로만 발생해야 함.
3. Music Note 공유 노트에서도 동일 패턴 3~5회 확인.
4. Music Note folder delete:
   - 삭제는 즉시 canonical.
   - 포함 곡은 default로 정상 이동.
   - 이전 pending 구조가 삭제 폴더를 60초 뒤 되살리면 FAIL.
5. Library 같은 기존 폴더 이름을 60초 안에 5회 이상 변경.
   - 상대 기기 즉시 반영.
   - canonical playlist title W1 + users revision W1 = 총 W2 목표.
6. Library 서로 다른 기존 폴더 5개 rename:
   - playlist W5 + users W1 = W6 목표.
7. Library 새 폴더 5개 생성:
   - playlist W5 + users revision W1 = W6 목표.
   - 새 폴더 자동 선택의 items read R0.
8. 같은 구간 private path D1 R0/W0 / Worker 0.
9. app292 Recent 150초 / Studio heart 30초 / Music Note Detail / Explore 좋아요 정상 기능 회귀 없음.

판정:
- 위 실기기 기능/비용이 맞으면 app296 PREVIEW PASS.
- cross-device가 60초 canonical을 기다리거나, stale pending이 최신 폴더 상태를 덮거나, Music Note 구조가 WN으로 반복되면 FAIL.
- Library aggregate document 도입은 app296 실기기 PASS 후 별도 단계. PREVIEW에 writer만 먼저 추가해 비용을 늘리는 방식 금지.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확한 승인 전 변경 금지.

## CURRENT TASK — app293 PREVIEW Library/Music Note 실기기 비용 검증 (2026-10-02 KST)

현재:
- PREVIEW app293 배포 완료.
- final Audit Run `36938832665` SUCCESS.
- Backend Safety Run `36938820471` SUCCESS.
- Firebase PREVIEW Run `36939049573` SUCCESS.
- shared RTDB rules exact match/deploy PASS.
- `preview.soridraw.com` app293 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 없음.

실기기 최소 검증:
1. PC/모바일 모두 app293 확인.
2. Library **마이 리스트** 같은 폴더를 양쪽 기기에서 연 상태:
   - 곡 1개 추가 → 상대 기기에 새로고침/탭 왕복 없이 반영.
   - 곡 1개 삭제 → 상대 기기에 즉시 제거.
   - 폴더 이름 변경 → 상대 기기에 반영.
   - 가능하면 곡을 다른 폴더로 이동 → 양쪽 폴더 상태 반영.
3. 위 연속 변경에서 healthy cache 수신기 목표:
   - Library changed-item 수신 자체 Firestore **R0/W0**.
   - 한 곡 변경 때문에 active playlist 전체 item reread가 발생하면 FAIL.
   - 중간 signal을 놓친 cold/stale 복구에서만 bounded Firestore fallback 허용.
4. warm Library add/move:
   - duplicate/max-order 확인용 Firestore read **R0 목표**.
5. warm playlist folder delete:
   - 삭제 대상 ID 확인을 위한 사전 items collection read **R0 목표**.
   - 실제 item delete writes는 삭제 곡 수만큼 정상/필수.
6. Music Note 마이/공유 폴더:
   - 여러 곡이 든 폴더 이름 변경.
   - 곡들이 그대로 새 이름 폴더 아래 보여야 함.
   - CACHE LIVE 목표: `user_structures W1`, rename 때문에 `favorites write 0`.
7. app292 보호 회귀:
   - Recent title/prompt/lyrics 즉시 PC↔모바일 + 150초 batch.
   - Studio heart 즉시 PC↔모바일 + 30초 final-intent.
   - Music Note Detail 기존 저장/편집 정상.
8. Library social like는 app293에서 미변경. 별도 후속 최적화 대상.

판정:
- 위 실기기 기능 + 비용이 맞으면 app293 PREVIEW PASS.
- 전체 playlist reread, 폴더 rename favorites WN, PC↔mobile 미반영이 재현되면 TEST 승격 금지하고 해당 경로만 최소 수정.
- 사용자 `테스트배포` 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확한 승인 전 변경 금지.

## CURRENT TASK — app292 PREVIEW 실기기 확인: Recent 150초 batch (2026-10-02 KST)

현재:
- PREVIEW app292 배포 완료.
- Recent title/prompt/lyrics canonical trailing batch: **150초**.
- PC↔모바일 RTDB 즉시 preview: 기존 유지.
- Firebase PREVIEW Run `36933026848` SUCCESS / app292 exact build PASS.
- TEST / PRODUCTION unchanged.

확인:
1. Recent 서로 다른 여러 곡을 150초 안에 순서대로 수정해도 각 기기 화면은 즉시 반영.
2. 마지막 Recent 수정 후 150초가 지나기 전에는 canonical Firestore write가 반복 발생하지 않음.
3. 150초 후 Recent aggregate canonical은 한 번만: `user_recent_songs W1 + users W1 = W2`.
4. heart는 per-song 30초 구조 유지: 다른 곡 heart가 기존 곡 timer를 reset하지 않음.
5. 사용자 실기기 PASS 전 main/TEST 승격 금지.

## CURRENT TASK — app291 가사 즉시 동기화 실기기 확인 (2026-10-02 KST)

현재:
- PREVIEW app291 배포 완료.
- Audit Run `36929318487` SUCCESS.
- Firebase PREVIEW Run `36929528762` SUCCESS.
- `preview.soridraw.com` app291 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 변경 없음.

app290 실기기 비용 결과:
- Firestore read 0.
- D1 R0/W0.
- heart 실제 최종 변경: `favorites W1 + users.favoriteCount W1 = W2`.
- Recent title/prompt/lyrics 연속 편집: `user_recent_songs W1 + users.syncVersions W1 = W2`.
- 한 테스트 구간 합계: favorites 1 + recent 1 + users 2 = Firestore W4.
- 과거 편집 3회 W6 반복 구조는 제거됨.

지금 확인할 것:
1. app291 확인.
2. Recent Song 가사 한 줄 수정 후 저장.
3. 다른 기기에서 페이지 이동/새로고침 없이 즉시 반영되는지 확인.
4. 한글 + 2차언어 각각 확인.
5. 제목/프롬프트/하트 즉시 반영은 기존 정상 그대로인지 확인.
6. 가사 수정 직후 추가 Firestore write가 생기면 FAIL. canonical write는 60초 trailing batch만 허용.
7. 사용자 PASS 전 main/TEST 승격 금지.

## CURRENT TASK — app290 PREVIEW 실기기 비용 + PC↔모바일 최종 검증 (2026-10-02 KST)

현재:
- app290 PREVIEW Hosting 배포 완료.
- Audit Run `36926223044` SUCCESS.
- Release Run `36926449503` SUCCESS.
- `preview.soridraw.com` app290 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 없음.

실기기 최소 검증:
1. PC/모바일 모두 app290 확인.
2. `스쳐간 이름 뒤에`:
   - PC SAVE → 모바일 즉시 filled.
   - 모바일 UNSAVE → PC 즉시 empty.
   - 모바일 SAVE → PC 즉시 filled.
   - PC UNSAVE → 모바일 즉시 empty.
   - route/tab/refresh 도움 없이 2회 이상 반복.
3. Studio heart rapid toggle:
   - 같은 곡을 30초 안에 빠르게 10회 토글.
   - 화면/반대 기기는 즉시 최종 상태로 수렴.
   - 시작 상태와 최종 상태가 같으면 CACHE LIVE `favorites:write 0` 목표.
   - 최종 상태가 다르면 `favorites:write 1` 목표.
4. Recent Song 편집:
   - 같은 곡 title → prompt → lyrics를 60초 안에 각각 저장.
   - 반대 기기에 각 편집은 즉시 보여야 함.
   - canonical Firestore는 최종 1묶음만: `user_recent_songs:write 1 + users:write 1 = W2 이하`.
   - 저장 3회가 다시 W6이면 FAIL.
5. pending 편집 뒤 다른 페이지 왕복 및 새로고침:
   - 로컬 최신 편집이 사라지지 않음.
   - 60초 batch 또는 복구 timer 후 canonical 최종 상태와 수렴.
6. Music Note Detail title/prompt/lyrics:
   - 기존 local draft/묶음 저장 유지.
   - field save마다 `favorites` canonical write 반복 증가 금지.
7. Explore public like / 공개·비공개 / split UI는 이번 변경 범위 밖이며 기존 정상 기준 유지.

판정:
- 위 실기기 기능 + CACHE LIVE 비용이 모두 맞으면 app290 PREVIEW PASS.
- 하나라도 기존 정상 동기화가 깨지거나 W6/반복 write가 재현되면 TEST 승격 금지하고 해당 경로만 최소 수정.
- 사용자 `테스트배포` 지시 전 main/TEST 승격 금지.
- PRODUCTION은 별도 명확한 정식배포 승인 전 변경 금지.

## CURRENT TASK — PREVIEW 비용 최적화: 실시간 UX와 canonical Firestore write 분리 (2026-10-02 KST)

목표:
- 사용자 영상에서 확인된 반복 write 폭증을 줄인다.
- 즉시 로컬 반응과 PC↔모바일 자동 동기화는 유지한다.
- app289 Music Note heart 정상 기준과 Explore app164/Worker195 동결 기준을 깨지 않는다.
- TEST / PRODUCTION 변경 금지.

실측 문제:
- Studio 하트 반복 토글 10회 → `favorites:write 10`.
- Recent title/prompt/lyrics 수정 저장 3회 → `user_recent_songs:write 3 + users:write 3 = Firestore W6`.
- 현재 `saveRecentSongEdit()`가 `queueRecentSongTextWrite()` 직후 `flushRecentSongTextWrite()`를 호출.
- `persistRecentSongsDocument()`은 aggregate document W1 + `users.syncVersions.recentSongs` W1이라 편집 저장 1회당 W2.
- Music Note Detail title/prompt/lyrics에는 이미 local draft/page-exit flush + RTDB preview 구조가 있으므로 이 정상 batch는 보존. 실제 필드 저장마다 Firestore 증가 경로가 있다면 원인을 따로 찾아 최소 수정.

구현 원칙:
1. **Recent title/prompt/lyrics**
   - UI/local cache 즉시.
   - RTDB changed-item preview로 반대 기기 즉시 반영.
   - canonical Firestore는 trailing 60초 또는 dirty page-exit 1회로 collapse.
   - 60초 안 같은 곡의 여러 수정은 마지막 payload만 저장.
   - 현재 aggregate 구조를 유지한다면 batch flush 1회 비용은 최대 `user_recent_songs W1 + users syncVersion W1 = W2`.
   - 같은 변경을 되돌려 baseline과 같아지면 net-zero canonical W0.
   - pending edit는 in-memory ref만 믿지 말고 durable local draft/outbox로 재접속 후 복구 가능해야 함.
2. **Studio Music Note save heart**
   - 클릭 즉시 local heart authority 갱신.
   - same-account PC↔mobile은 existing UID RTDB changed-item channel을 이용해 즉시/짧은 debounce로 수렴.
   - canonical `favorites` save/unsave는 30초 trailing per-song outbox로 final desired state만 commit.
   - 같은 곡 rapid toggle은 마지막 상태 하나로 collapse. 시작 상태와 최종 상태가 같으면 Firestore W0.
   - canonical flush 실패 시 durable local intent를 유지하고 bounded retry. 무한 retry/polling 금지.
   - app289 exact favorite id, recent immutable identity, compact oversized payload fallback, ACK ordering을 그대로 보호.
3. **Music Note Detail**
   - 기존 local draft + page-exit canonical flush를 우선 보호.
   - title/prompt/lyrics에서 field-save마다 `favorites` write가 실제 생기는 우회 경로가 있는지 verifier/runtime audit.
   - 있으면 그 우회만 제거하고 existing draft/RTDB preview 경로로 통일.
4. 페이지 이동/idle/app update 자체는 write 0. 단 pending user change가 있을 때만 bounded flush 허용.
5. receiver는 preview signal 수신만으로 Firestore/D1 read/write 0.
6. 전체 favorites/recent scan/rebuild 금지. 사용자 데이터 migration/backfill/delete 없음.
7. UI/CSS/분할바/생성바/Explore public like 변경 금지.

필수 검증:
- rapid heart 10회:
  - 로컬 UI 즉시 반응.
  - 반대 기기 자동 반영.
  - 30초 window 최종 상태가 시작과 같으면 favorites W0 목표.
  - 최종 상태가 다르면 favorites W1 목표.
- Recent title→prompt→lyrics 3회:
  - 반대 기기 각 변경 자동 반영.
  - canonical Firestore는 batch 최종 W2 이하.
  - 세 번 각각 W2가 발생하면 FAIL.
- Music Note Detail title/prompt/lyrics 3회:
  - field save 동안 canonical favorites 반복 write 금지.
  - pending changes page exit/60s policy에 따라 1회 collapse.
- pending 상태에서 reload/crash recovery.
- 동시 PC/mobile edit ordering에서 오래된 signal이 최신 local intent를 덮지 않음.
- app289 문제곡 `스쳐간 이름 뒤에` SAVE/UNSAVE 양방향 회귀 없음.
- 정상 Recent Song 1개 heart 회귀 없음.
- TypeScript / Build / focused tests PASS.
- PREVIEW만 배포, TEST/PRODUCTION unchanged.

중단 조건:
- app289 live heart를 깨야만 비용을 줄일 수 있는 구조면 구현 중단 후 보고.
- canonical batch를 위해 destructive schema migration/전체 backfill이 필요하면 중단.
- 같은 계정 PC/mobile 동시 변경에서 데이터 손실 가능성을 해소할 수 없으면 임의 구현 금지.

## CURRENT TASK — app289 사용자 실기기 PASS / Music Note heart live-sync 동결 (2026-10-02 KST)

상태:
- 사용자 실기기 확인: app289 문제곡 `스쳐간 이름 뒤에` PC↔모바일 SAVE/UNSAVE 즉시 동기화 정상.
- app289을 현재 Music Note heart live-sync 정상 기준으로 동결.
- 별도 오류 보고가 없으면 이 경로 추가 수정 금지.
- 정상곡 기존 payload, UNSAVE, 이름 변경, Explore public like, Music Note 60초 batch 보호.
- TEST 승격은 사용자의 별도 지시 전까지 진행하지 않음.

다음:
- 새로운 사용자 지시를 기다린다.
- 후속 작업이 좋아요/동기화와 무관하면 app289 경로를 건드리지 않는다.
- 후속 작업이 관련 경로를 수정해야 할 경우 app289 실기기 PASS를 회귀 기준으로 먼저 고정한다.

## CURRENT TASK — app289 문제곡 SAVE/UNSAVE 양방향 실기기 최종 확인 (2026-10-02 KST)

현재:
- app288 사용자 실기기 FAIL.
- ROOT CAUSE 확정: 문제곡 active SAVE itemJson이 실제 제품 gate `JSON.stringify(...).length <= 24000`를 초과.
  - current row 24,405 chars.
  - historical row 25,245 chars.
- app289은 24,000 이하 정상곡은 기존 full payload 그대로 유지.
- oversized active item에만 compact fallback 적용.
  - current target compact 1,354 chars.
  - historical target compact 2,259 chars.
- UNSAVE compact removal 경로 비변경.
- exact receiver Firestore R0/W0.
- 추가 RTDB mutation 0.
- Audit `36915869748` SUCCESS.
- PREVIEW Release `36916222178` SUCCESS.
- release commit `178a3eb7489e0d89dea76481a1b6a76f5c600681`.
- `preview.soridraw.com` app289 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 delete/migration/backfill/duplicate merge 없음.

실기기 테스트:
1. PC/모바일 둘 다 app289.
2. `스쳐간 이름 뒤에` PC 저장 → 모바일 즉시 filled.
3. 모바일 해제 → PC 즉시 empty.
4. 모바일 저장 → PC 즉시 filled.
5. PC 해제 → 모바일 즉시 empty.
6. 2~5를 2회 이상 반복. route/tab/refresh 도움 없이 PASS해야 함.
7. 일반 정상 Recent Song 1개 같은 순서 회귀 없음.
8. 이름 변경/원복 app282 즉시 동기화 유지.
9. 재접속 후 마지막 상태 동일.
10. exact receiver Firestore/D1 R/W 0 유지.

보호:
- 24KB 이하 기존 Music Note sync payload 동작 그대로 유지.
- app288 RTDB ACK 분리 유지.
- app287 idempotent SAVE signal 유지.
- app286 UI direction authority 유지.
- app285 exact identity 유지.
- app282 title sync 유지.
- duplicate user data 자동 삭제/병합 금지.
- Explore public like app164/Worker195 동결.
- Music Note 60초 상세 batch 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app289 compact Music Note heart-state RTDB payload 구현 준비 (2026-10-02 KST)

ROOT CAUSE 확정:
- 문제곡 SAVE projected RTDB item payload 26,758 bytes > 24,000 limit.
- historical duplicate도 27,654 bytes > 24,000.
- 정상 비교곡은 13,056 bytes.
- 문제곡 appliedKeywords만 25KB대라 전체 Music Note summary를 signal에 싣는 현재 방식에서 itemJson이 탈락.
- 그래서 SAVE는 exact id/version만 가고 remoteItem이 없어 Studio heart authority를 갱신하지 못함.
- UNSAVE는 compact removal identity 약 517 bytes라 정상.
- 이름 변경은 별도 small preview sync라 정상.
- duplicate 자체는 직접 원인 아님.

다음 구현 목표:
1. SAVE/RESTORE/idempotent SAVE의 RTDB changed-item payload를 compact heart-state 전용 projection으로 축소.
2. exact id + generation identity + soridrawSongId + recentSongSyncKey + saved/favoriteRemoved만 유지.
3. 전체 appliedKeywords / prompt / lyrics / media summary를 heart live-sync signal에 싣지 않음.
4. 기존 RTDB signal 1회만 사용. 추가 RTDB mutation 금지.
5. 수신 Firestore R0/W0 유지.
6. canonical save/restore/unsave Firestore 비용 기존 W1 유지.
7. duplicate 데이터 삭제/merge/backfill 금지.
8. app282 title sync / app281 Suno URL / app278 shared note / app164 Explore like / Music Note 60s batch 보호.
9. TypeScript / Build / focused regression 후 PREVIEW만 배포.
10. 실기기에서 문제곡 + 정상곡 양방향 save/unsave 즉시 반영 확인 전 TEST 금지.

근거 Run:
- app288 failed-state read-only: `36911142979`
- payload-size root-cause read-only: `36913925421`

## CURRENT TASK — Codex High: `스쳐간 이름 뒤에` SAVE live-sync 원인증명만 수행 (2026-10-02 KST)

목표:
- app288에서도 반복되는 **한 곡 전용 SAVE PC↔모바일 live-sync 실패의 단일 원인**을 증명한다.
- 수정하지 않는다. 배포하지 않는다. 사용자 데이터 쓰기/삭제/병합 금지.
- “가능성이 높다”가 아니라 어떤 조건문/상태/신호가 SAVE를 막는지 코드+실데이터 근거로 확정한다.

현재 고정 사실:
- PREVIEW app288 deployed exact build PASS.
- app288 user real-device FAIL.
- 이름 변경 live sync 정상.
- UNSAVE live sync는 사용자 관찰상 정상.
- 문제곡만 historical duplicate favorite row 2개가 확인됨.
- 두 row는 동일 generationBatchId+generationIndex / soridrawSongId / recentSongSyncKey.
- 현재 Recent Song은 current row exact favorite id를 유지.
- 최신 서버 unsave + RTDB signal은 그 current exact row를 정확히 가리킴.
- Diagnostic `36911142979`: Firestore W0/delete0/RTDB W0 read-only.
- app285 identity, app286 UI direction, app287 idempotent SAVE signal, app288 RTDB ACK-domain 분리 모두 적용됐지만 증상 지속.

반드시 확인:
1. `src/App.tsx`:
   - `handleToggleCurrentStudioFavorite`
   - `toggleFavorite`
   - `isSongFavorited`
   - `rememberRecentHeartAuthority` / `readRecentHeartAuthority`
   - `buildRecentSongSyncKey`
   - `syncMusicNoteIncrementalFromRemoteVersion`
   - Recent history/cache exact-link update
2. `src/services/userDomainSyncService.ts`:
   - `publishSignal`
   - `publishMusicNoteSaveStateDelta`
   - `dispatchSignal`
   - `startDomainSubscriptions`
   - pending signal / local version / RTDB ack storage
3. `src/data/v1MutationBoundary.ts`:
   - post-success hook가 fire-and-forget인 점이 SAVE/RESTORE에 실제 영향을 주는지.
4. `src/hooks/useFavoritesStore.ts`, `src/lib/musicNoteSavedState.ts`,
   `src/lib/userDataEngine.ts`, `src/lib/listBundleCache.ts`:
   - duplicate/soft-removed row가 UI heart authority를 뒤집거나 stale state를 다시 주입하는지.
5. 문제곡의 두 historical row와 current `user_recent_songs` link를 read-only로 비교.
6. 정상 recent song 1개와 문제곡을 같은 코드 경로 기준으로 비교해서 “왜 이 곡만” 차이가 무엇인지 표로 제시.
7. SAVE 클릭 한 번의 전체 chain을 번호로 추적:
   UI empty → intendedAction=save → chosen favorite row/id → Firestore mutation 여부 → V1 boundary hook → RTDB operation/version/itemJson → receiver onValue → MUSIC_NOTE_SYNC_EVENT → signal guard → recentHeartAuthority key/version → render isSongFavorited.
8. 그 chain에서 실제로 끊기는 **정확한 한 지점**을 증명.
9. 필요하면 임시 GitHub Action을 만들어도 되지만:
   - read-only만 허용.
   - Firestore write/delete 0.
   - RTDB write 0.
   - 사용자 데이터 mutation 0.
   - 진단 후 workflow/trigger 삭제.
10. localStorage/device-only 상태가 없으면 증명이 불가능한 경우:
   - 어떤 키/값을 PC와 모바일에서 각각 봐야 하는지 최소 5개 이하로 정확히 지정.
   - 가능하면 앱 코드 수정 없이 브라우저 콘솔 1회 명령으로 수집 가능한 read-only 진단 스니펫 제시.
   - 그 정보 없이는 단정하지 말 것.

특별 의심점 — 검증은 하되 결론 선입견 금지:
- 문제곡 per-song `recentHeartAuthority`가 과거 반복 테스트에서 남은 높은 version 때문에 새 SAVE remoteVersion을 거절하는지.
- remote SAVE payload와 현재 화면 song이 동일 generation key로 실제 매칭되는지.
- SAVE/RESTORE의 `runV1MutationBoundary` post-success RTDB publish가 fire-and-forget이라 실제 완료 전에 경로가 끝나는지.
- SAVE 직후 다른 Music Note operation이 같은 RTDB 단일 노드를 덮어써 상대 기기가 SAVE state를 못 보는지.
- PC/mobile 각각의 stale exact favorite link가 서로 다른 historical duplicate row를 가리키는지.
- remote SAVE가 receiver에서 적용된 뒤 catalog/favorites/history hydration이 다시 empty state로 덮는지.

금지:
- 원인 확정 전 코드 수정.
- duplicate 문서 삭제/merge.
- 전체 favorites/recent scan/rebuild.
- cache generation 강제 리셋.
- 사용자 데이터 backfill/migration.
- TEST/PRODUCTION 변경.
- Explore public like / Music Note 60s batch 수정.
- “일단 이렇게 바꿔보자” 패치.

최종 보고 형식:
- 기준 branch / HEAD.
- 읽은 파일.
- 실제 문제곡 vs 정상곡 차이.
- SAVE chain 단계별 PASS/FAIL.
- **ROOT CAUSE: 파일 + 함수 + 조건 + 왜 이 곡만인지**.
- 확신도(높음/중간/낮음)와 근거.
- 필요한 최소 수정안 1개만 제시하되 구현하지 말 것.
- 예상 비용 영향.
- 데이터 손실/회귀 위험.
- 사용한 read-only 진단과 W0 증거.

## CURRENT TASK — app288 RTDB ACK 분리 후 SAVE/UNSAVE 양방향 실기기 확인 (2026-10-02 KST)

현재:
- app287 사용자 실기기 FAIL: 저장 즉시 동기화가 여전히 안 됨.
- 실패 직후 read-only Run `36909095714`에서 실제 RTDB Music Note signal과 exact item identity가 존재함을 확인.
- 수신 App이 RTDB 신호 순번과 Catalog generatedAtMs를 같은 localVersion 키로 비교하던 구조 발견.
- Catalog 시각이 앞서면 실제 새 RTDB changed-item을 stale로 버릴 수 있었음.
- app288은 RTDB signal ack를 전용 키로 분리하여 Catalog timestamp가 SAVE/UNSAVE 신호를 차단하지 못하게 수정.
- exact receiver는 Firestore R0/W0 유지.
- Focused Audit `36909879917` SUCCESS.
- PREVIEW Release `36910149870` SUCCESS.
- locked release commit `e704decf0c0e0274203dabdaa84d399c26d4a131`.
- `preview.soridraw.com` app288 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 delete/migration/backfill 없음.

실기기 테스트:
1. PC/모바일 모두 app288 확인.
2. `스쳐간 이름 뒤에` A 저장 → B 즉시 filled.
3. B 해제 → A 즉시 empty.
4. B 저장 → A 즉시 filled.
5. A 해제 → B 즉시 empty.
6. 2~5를 2회 이상 반복. route/tab/refresh 도움 없이 양방향 수렴해야 PASS.
7. 일반 정상 최근곡 1개 같은 순서 회귀 없음.
8. 이름 변경/원복 app282 동시 반영 유지.
9. 재접속 후 마지막 상태 동일.
10. exact receiver Firestore R0/W0, D1 R0/W0.
11. idle/navigation/app update 추가 mutation 0.

보호:
- app287 SAVE signal 보완 유지.
- app286 UI action direction authority 유지.
- app285 exact recent/favorite identity 유지.
- app282 이름 동기화 보호.
- duplicate user data 자동 삭제/병합 금지.
- Explore public like app164/Worker195 동결.
- Music Note 60초 상세 batch 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app287 SAVE/UNSAVE 양방향 실기기 최종 확인 (2026-10-02 KST)

현재:
- app286 사용자 실기기 FAIL.
- 증상은 저장만 상대 기기에 즉시 안 가고, 해제와 이름 변경은 즉시 동기화.
- 원인은 빈 하트 SAVE인데 canonical favorite가 이미 active인 경우 app286이 로컬만 filled로 바꾸고 return하여 RTDB SAVE 신호를 만들지 않은 비대칭.
- app287은 이 idempotent SAVE 분기에서 Firestore write 없이 기존 UID Music Note RTDB changed-item SAVE 신호만 1회 발행.
- 수신 기기는 app286의 per-song heart authority를 그대로 사용하므로 추가 Firestore read/write 없이 filled 상태를 반영.
- UNSAVE / 제목 변경 / Suno URL / 공유노트 / Explore public like 경로는 비변경.
- 최종 Focused Audit `36907514680` SUCCESS.
- PREVIEW Release `36907740259` SUCCESS.
- locked release commit `e3fe46183cf89691430e224d7bd21092258a122a`.
- `preview.soridraw.com` app287 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 delete/migration/backfill 없음.

실기기 테스트:
1. PC/모바일 둘 다 app287 확인.
2. `스쳐간 이름 뒤에` 양쪽 empty 상태에서 A 저장 → B 즉시 filled.
3. B 해제 → A 즉시 empty.
4. B 저장 → A 즉시 filled.
5. A 해제 → B 즉시 empty.
6. 2~5를 2회 이상 반복. 저장만 빠지거나 반대 mutation이 나오면 FAIL.
7. 일반 정상 최근곡 1개 같은 순서 회귀 없음.
8. 이름 변경/복원 app282 동시 반영 유지.
9. 양쪽 새로고침/재접속 후 마지막 상태 동일.
10. 수신 기기 SAVE/UNSAVE로 추가 Firestore R/W 0, D1 R/W 0.
11. 일반 canonical save/restore/unsave 비용은 기존 W1 기준 유지.
12. idle/페이지 왕복/앱 업데이트 추가 mutation 0.

보호:
- app286에서 정상 확인된 UNSAVE 동시 반영을 건드리지 않음.
- app282 이름 동기화 보호.
- 문제곡 duplicate user data 자동 삭제/병합 금지.
- 일반 recent heart / Music Note 목록 / Suno URL / 공유노트 정상 기능 유지.
- Explore public like app164/Worker195 동결.
- Music Note 60초 상세 batch 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app286 PC↔모바일 하트 방향/상태 최종 실기기 확인 (2026-10-02 KST)

현재:
- app285 사용자 실기기 FAIL.
- 사용자 증상: A에서 저장해도 B는 빈 하트, 그 상태에서 B가 저장 의도로 누르면 A의 저장이 해제되는 "서로 반대 방향" 현상.
- read-only Run `36902514549`에서 app285 unsave RTDB payload에는 generation/soridraw/recent identity가 정상 포함된 것을 확인. 전송 identity 누락은 해결됨.
- 실제 구조적 문제는 **하트 표시 상태와 click mutation 방향이 서로 다른 authority를 사용한 것**.
- Catalog/List Bundle은 explicit current flags 기준인데 App/FavoritesStore 일부는 과거 unlikedAt/unsavedAt timestamp까지 현재 제거 상태로 해석하고 있었음.
- 정상 레코드에서도 saved:true/favoriteRemoved:false + 과거 unsavedAt/unlikedAt이 공존 가능하므로 다른 곡에도 재발 가능했던 구조.
- app286은 공통 `musicNoteSavedState` 판정으로 App/FavoritesStore/Catalog/List Bundle을 통일.
- per-song RTDB heart authority를 Recent immutable identity로 먼저 적용.
- Studio click은 화면이 empty면 SAVE, filled면 UNSAVE를 끝까지 명시적으로 유지하며 내부 server lookup이 반대로 뒤집지 못함.
- stale local cache에서 active row가 없더라도 filled-heart UNSAVE는 authority의 exact favorite id에 W1로 적용.
- 최종 Focused Audit `36904280495` SUCCESS.
- PREVIEW Release `36904602856` SUCCESS.
- locked release commit `fcf733dbe6dfb165e62af01dcd56ad08f698bf65`.
- `preview.soridraw.com` app286 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 delete/migration/backfill 없음.

실기기 테스트:
1. PC/모바일 모두 app286.
2. `스쳐간 이름 뒤에`에서 A 저장 → B가 페이지 이동 없이 filled.
3. B 해제 → A 즉시 empty.
4. A 저장 → B filled → B 저장해제 → A empty처럼 3~4회 번갈아 반복.
5. 어떤 클릭도 "빈 하트를 눌렀는데 상대 저장이 해제"되는 반대 mutation이 없어야 함.
6. 일반 정상 최근곡 1개도 같은 순서로 회귀 없음 확인.
7. 양쪽 새로고침/재접속 후 마지막 상태 동일.
8. 제목 변경/원복 app282 회귀 없음.
9. 수신 기기 Firestore R0/W0, D1 R0/W0.
10. 실제 save/unsave canonical favorite W1.
11. 잃어버린 Recent link 첫 repair가 필요한 경우만 해당 action 최대 W2.
12. idle/페이지 왕복/앱 업데이트 추가 Firestore/D1 R/W 0.

보호:
- 문제 곡의 기존 duplicate favorite 문서 자동 삭제/병합 금지.
- 일반 recent heart / Music Note 목록 / 제목 / Suno URL / 공유노트 정상 기능 유지.
- Explore public like app164/Worker195 동결.
- Music Note 60초 상세 batch 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app285 저장/해제 동일 identity 실기기 확인 (2026-10-02 KST)

현재:
- app284 사용자 실기기 FAIL.
- 실제 최신 unsave signal을 read-only로 확인한 결과, save는 song identity가 RTDB payload에 포함되지만 unsave는 exact document ID만 있고 item payload가 비어 있었음.
- 동시에 Studio local handler가 unsave 뒤 modern recent row의 exact favorite link를 삭제하고 있었음.
- 따라서 duplicate가 있는 문제 곡에서 빈 하트 상태에서는 PC/모바일이 서로 다른 favorite row를 볼 수 있고, 저장 순간에만 active favorite summary가 전파돼 다시 같은 곡으로 수렴하는 구조였음.
- 사용자 관찰 "저장 전에는 다른 곡, 저장 후에는 같은 곡처럼 보임"과 일치.
- app285는 save/unsave 양쪽 모두 같은 Recent Song identity + exact Music Note document link를 유지.
- unsave signal에도 generation/soridraw/recent identity를 포함해 수신 기기가 Firestore read 없이 exact link를 갱신.
- lost link가 heart action에서 처음 복구될 때만 user_recent_songs W1 1회 허용.
- Focused Audit `36900679216` SUCCESS.
- PREVIEW Release `36900908194` SUCCESS.
- locked release commit `35027235894af100cff4155584c62baeb20854ca`.
- `preview.soridraw.com` app285 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 delete/migration/backfill 없음.

테스트:
1. PC/모바일 둘 다 app285.
2. `스쳐간 이름 뒤에` 한쪽 filled면 그쪽에서 해제 → 상대 즉시 empty.
3. 같은 기기에서 저장 → 상대 즉시 filled.
4. 반대 기기에서 해제 → 첫 기기 즉시 empty.
5. 반대 기기에서 저장 → 첫 기기 즉시 filled.
6. 양쪽 새로고침/재접속 후 마지막 상태 유지.
7. 일반 정상 곡 1개 같은 순서 회귀 없음.
8. 제목 변경/원복 app282 회귀 없음.
9. 수신 기기 Firestore R0/W0, D1 R0/W0.
10. 첫 lost-link repair action만 favorites W1 + recent W1 = 최대 W2 허용. 이후 동일 곡 toggle에서 recent repair W1 반복 시 FAIL.
11. idle/페이지 왕복 추가 R/W 0.

보호:
- duplicate user data 자동 삭제/병합 금지.
- 일반 recent heart 정상 경로와 app282 제목 동기화 유지.
- app281 Suno URL, app280 tombstone, app278 공유노트 유지.
- Explore public like app164/Worker195 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app284 특정 곡 exact-link 하트 실기기 최종 확인 (2026-10-02 KST)

현재:
- app283은 사용자 실기기 FAIL. 원인 가설이 틀렸음.
- read-only 실데이터 비교로 실제 원인 확정:
  - `스쳐간 이름 뒤에` favorite 2개가 같은 generation/soridraw/recent identity를 공유하지만 둘 다 soft-removed.
  - recent row는 그중 removed 문서 하나를 `favoriteFirestoreId`로 계속 가리킴.
  - 정상 곡은 recent row가 active favorite 문서 1개를 정확히 가리킴.
- app284는 정상 곡과 같은 원칙으로 **explicit favoriteFirestoreId를 최우선 단일 authority**로 사용.
- stale duplicate는 같은 generation/recent key라도 하트를 다시 켤 수 없음.
- 빈 하트 저장은 exact linked favorite를 W1로 복구하며 soft-remove residue를 모두 해제.
- Focused Audit `36897262237` SUCCESS.
- PREVIEW Release `36897519538` SUCCESS.
- locked release commit `baa210c7e451bc4301ed0889edec8e62606cc7e5`.
- `preview.soridraw.com` app284 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 없음.

실기기 확인:
1. PC/모바일 모두 app284.
2. `스쳐간 이름 뒤에`가 한쪽 filled이면 그 기기에서 먼저 해제 → 상대도 즉시 empty.
3. 한쪽에서 저장 → 상대 기기 페이지 이동/새로고침 없이 즉시 filled.
4. 반대 기기에서 해제 → 첫 기기 즉시 empty.
5. 반대 기기에서 다시 저장 → 첫 기기 즉시 filled.
6. 양쪽 새로고침/재접속 후 마지막 상태 유지.
7. 일반 정상 곡 1개 저장/해제 회귀 없음.
8. 제목 변경/복원 app282 회귀 없음.
9. 수신 기기 Firestore R0/W0, D1 R0/W0.
10. idle/페이지 왕복 추가 R/W 0.

판정:
- 위 양방향 하트가 PASS하면 app284 동결.
- 아직 FAIL이면 **사용자 데이터 삭제/병합 없이** 해당 클릭 직후의 exact linked favorite + RTDB signal만 다시 read-only 추적.
- 전체 favorite scan/rebuild, duplicate 자동삭제, 정상 곡 경로 변경 금지.
- 사용자 PASS 전 TEST 승격 금지.

## CURRENT TASK — app283 특정 legacy 최근곡 하트 PC↔모바일 최종 실사용 확인 (2026-10-02 KST)

현재:
- app282 제목 변경 cross-device는 사용자 확인상 정상 방향.
- 일반 최근생성곡 하트도 정상이며, 문제는 특정 legacy 곡 `스쳐간 이름 뒤에` 하나로 한정.
- app283은 modern generation identity 경로를 건드리지 않고 legacy source identity bridge만 추가.
- 첫 successful legacy save 때 exact favorite id/recent identity를 `user_recent_songs`에 1회 확정해 이후 stale split favorite가 하트를 다시 켜지 못하게 함.
- Focused Audit `36894349233` SUCCESS.
- PREVIEW Release `36894655946` SUCCESS.
- locked release commit `41c41d0c2dafdf23bb8a14a6f52e5738dce5f420`.
- `preview.soridraw.com` app283 exact build PASS.
- TEST / PRODUCTION unchanged.
- 사용자 데이터 migration/backfill/delete 없음.

테스트 순서:
1. PC/모바일 모두 app283인지 확인.
2. `스쳐간 이름 뒤에`가 한쪽 filled / 한쪽 empty면 **filled 쪽에서 먼저 해제**한다.
3. 상대 기기 하트가 페이지 이동/새로고침 없이 empty로 바뀌는지 확인.
4. 같은 기기에서 다시 저장 → 상대 기기 하트도 즉시 filled.
5. 이후 반대 기기에서 해제 → 원래 기기 즉시 empty.
6. 반대 기기에서 다시 저장 → 원래 기기 즉시 filled.
7. 양 기기 새로고침/재접속 후에도 마지막 상태 유지.
8. 같은 곡 제목 변경/원복도 app282처럼 즉시 양방향 반영.
9. 일반 정상 최근곡 1개도 저장/해제하여 회귀 없음 확인.
10. CACHE LIVE에서 수신 기기 Firestore R0/W0, D1 R0/W0 확인.
11. 첫 legacy repair save만 initiating side 최대 favorites W1 + recent W1 = W2 허용. 이후 같은 곡 하트 toggle에서 legacy repair recent W1이 반복되면 FAIL.
12. 아무 조작 없이 1분/페이지 왕복 시 추가 Firestore/D1 R/W 0.

보호:
- app282 제목 동기화 정상 기능 동결.
- 일반 recent heart 정상 경로 동결.
- app281 Suno URL, app280 unsave resurrection, app278 공유노트 동결.
- Explore public like app164/Worker195 동결.
- Music Note 상세 60초/페이지 이탈 batch 동결.
- 전체 favorites/recent scan/query/rebuild 금지.
- legacy duplicate 자동 삭제/대량 정리 금지.
- 사용자 실사용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app282 제목/최근생성곡 PC↔모바일 실기기 최종 확인 (2026-10-02 KST)

현재:
- app281 Suno URL 1~4 사용자 실기기 PASS.
- app282에서 Music Note 제목 변경은 RTDB changed-item 1곡 delta로 즉시 표시, canonical Firestore 60초/페이지 이탈 batch 유지.
- 최근 생성곡 제목은 immutable recentSongSyncKey를 먼저 고정해 제목 변경 후에도 같은 곡 identity 유지.
- 최근 생성곡의 '수정 저장'은 실제 사용자 변경이므로 user_recent_songs W1 1회로 확정하고, 상대 기기는 RTDB payload로 Firestore R0 즉시 반영.
- 수정 후 빈 하트 저장은 기존 favorite를 해제하지 않고 현재 수정본을 저장/update.
- Backend V2 Safety `36885082023` SUCCESS.
- Focused Audit `36885111844` SUCCESS.
- app version 282.
- PREVIEW 배포 완료: Run `36887684964` SUCCESS.
- locked release commit `301330edc5eafc01a43027205cbaf28cab00ce9a`.
- `preview.soridraw.com` app282 exact build PASS.
- shared RTDB Rules deploy/exact match PASS.
- TEST / PRODUCTION unchanged.
- 현재는 사용자 PC↔모바일 실기기 검증 단계.

배포 후 확인:
1. Music Note 곡 제목 변경 저장 → 반대 기기 목록 제목이 페이지 이동 없이 즉시 변경.
2. 반대 기기에서 같은 곡 상세를 열어둔 상태에서도 제목이 자동 반영.
3. 최근 생성곡 A 제목 변경 → 반대 기기 최근 생성곡에 즉시 동일 제목 표시.
4. A를 다시 원래 제목으로 변경 → 상대 기기도 다시 즉시 원복.
5. 제목 변경 후 A 하트 저장 → 반대 기기 하트와 Music Note 저장 상태 즉시 반영.
6. PC→모바일, 모바일→PC 양방향 모두 확인.
7. 재접속/새로고침 뒤에도 제목과 저장 상태 유지.
8. 수신 기기 Firestore R0/W0, D1 R0/W0.
9. 변경 없이 idle/페이지 왕복은 추가 Firestore/D1 R/W 0.

비용 합격선:
- Music Note title explicit save: RTDB only + 기존 batch, 추가 canonical W0.
- Recent title explicit save: initiating user_recent_songs W1, receiving R0/W0.
- Edited recent heart save: 실제 원본 2개 변경이면 favorites W1 + user_recent_songs W1 허용, receiving R0/W0.
- 전체 recent/favorites scan/query 금지.

보호:
- app281 Suno URL 정상 기능 동결.
- app280 unsave resurrection guard 동결.
- app278 공유노트 구조/카드 상태, app279 identity 정상 경로 보호.
- Explore public like app164/Worker195 동결.
- 사용자 실기기 PASS 전 TEST 승격 금지.

## CURRENT TASK — PREVIEW app281 Suno URL cross-device 실기기 최종 확인 (2026-10-01 KST)

배포 완료:
- Focused Audit `36810877247` SUCCESS.
- PREVIEW Release `36811169561` SUCCESS.
- locked source `3f8770519e11bfb9ed0d317f4e2e3362f0a962f6`.
- `preview.soridraw.com` app281 exact build PASS.
- TEST / PRODUCTION unchanged.
- RTDB Rules / Worker / Functions / D1 / 사용자 데이터 변경 없음.

지금 확인할 것:
1. PC→모바일: 상세 Suno URL 저장 직후 목록 썸네일 자동 변경.
2. 모바일에서 같은 상세를 이미 열어둔 상태: URL/대표 순위 자동 변경.
3. 모바일→PC도 동일.
4. URL 연결 해제도 목록 + 열린 상세 양방향 즉시 반영.
5. 원본 기기 페이지 이탈/재접속 뒤에도 상태 유지.
6. 수신 기기 Firestore R0/W0, D1 R0/W0.
7. idle/페이지 이동만으로 추가 read/write 없음.

보호:
- Music Note 상세 60초/페이지 이탈 canonical 묶음 저장 동결.
- app280 unsave tombstone/재접속 부활 방지 동결.
- app278 공유노트 구조/카드 상태 및 app279 최근곡 정상 identity 경로 동결.
- Explore public like app164/Worker195 동결.
- 사용자 실기기 PASS 전 TEST 승격 금지.

## CURRENT TASK — app281 Suno URL 썸네일/상세 PC↔모바일 실기기 확인 (2026-10-01 KST)

현재:
- app280 저장/해제 및 재접속 부활 방지는 사용자 확인상 정상.
- 새 문제는 Music Note 상세에서 Suno URL 저장 시 상대 기기 목록 썸네일과 이미 열린 상세 내부 URL 상태가 즉시 갱신되지 않는 것.
- app281은 상세 URL 저장/해제 시 변경된 한 곡의 Suno media summary만 기존 UID RTDB로 즉시 전달.
- canonical Firestore 상세 저장은 기존 60초/페이지 이탈 묶음 정책 그대로 유지.
- 수신 기기 Firestore R0/W0, 전체 Music Note scan/rebuild 없음.
- 제품 commit `6967c28019ccb8ee7b7c1cb73929655b8f9f9e7f`.
- Focused Audit Run `36810877247` SUCCESS.
- TypeScript / Build / app280·279·278 / Recent Songs / shared-note regressions PASS.
- PREVIEW Hosting 배포 대기.

배포 후 사용자 테스트:
1. PC/모바일 모두 app281 확인.
2. PC에서 Music Note 곡 A 상세를 열고 Suno URL 등록 → 저장.
3. 모바일은 새로고침/페이지 왕복 없이 **곡 목록 썸네일이 바로 바뀌어야 함**.
4. 모바일에서 곡 A 상세를 미리 열어둔 상태에서도 URL/대표 순위가 바로 바뀌는지 확인.
5. 모바일 → PC 방향도 동일하게 반복.
6. URL 연결 해제도 상대 기기 목록 썸네일과 열린 상세에 즉시 반영되는지 확인.
7. 소스 기기에서 페이지 이탈/재접속 후에도 URL/썸네일이 유지되는지 확인해 canonical 묶음 저장 persistence 확인.
8. 수신 기기 CACHE LIVE Firestore R0/W0, D1 R0/W0 확인.
9. 아무 조작 없이 1분 대기/페이지 재진입에서 추가 Firestore/D1 R/W 0 확인.

보호:
- Music Note 상세 텍스트 60초/페이지 이탈 묶음 저장 유지.
- app280 unsave tombstone/재접속 부활 방지 유지.
- app278 공유노트 구조/카드 상태, app279 최근곡 identity 정상 경로 유지.
- Explore public like app164/Worker195 동결.
- 사용자 실기기 PASS 전 TEST 승격 금지.

## CURRENT TASK — app280 해제 후 재접속 부활 실기기 확인 (2026-10-01 KST)

현재:
- 사용자 보고로 특정 legacy 곡 문제가 아니라 **Music Note Catalog unsave 삭제 신호 누락**이 실제 공통 원인으로 확인됨.
- Firestore에는 해제가 저장되지만 Catalog가 해제 전 row를 계속 보유해 재접속 시 다시 살아나는 구조였음.
- app280은 unsave 문서 ID를 exact Catalog tombstone/deletedIds로 연결.
- 같은 tombstone을 PC↔모바일 RTDB 수신기에도 저장하여 상대 기기 재접속 부활도 차단.
- save/restore 시 tombstone을 해제해 정상 재저장 가능.
- PREVIEW app280 배포 완료.
- Focused Audit `36808471976` SUCCESS.
- PREVIEW Release `36808630013` SUCCESS / app280 exact build PASS.
- TEST / PRODUCTION unchanged.

사용자 테스트:
1. PC/모바일 둘 다 app280.
2. CACHE LIVE 초기화.
3. 현재 반복적으로 살아나는 기존 곡 1개를 하트 해제.
4. 반대 기기에서도 즉시 해제 확인.
5. **재접속/새로고침/페이지 왕복 후에도 하트와 Music Note가 다시 살아나지 않는지 확인.**
6. 동일 현상이던 나머지 곡도 한 번씩 해제 후 재접속 테스트.
7. 해제했던 곡 1개를 다시 저장 → 양 기기 저장 상태 + 재접속 후 유지 확인.
8. 수신 기기 Firestore R0/W0.
9. 변경 없이 1분 대기 및 페이지 재진입에서 추가 Firestore/D1 R/W 0.

비용 판정:
- 실제 unsave: canonical favorites W1은 정상.
- Catalog delta는 기존 changed-item page-sync 구조를 사용하며 전체 목록 rebuild 없음.
- remote device sync는 Firestore R0/W0.
- 페이지 재접속만으로 canonical write 금지.
- 전체 favorites scan/query 금지.

보호:
- 공유노트 폴더 생성/곡 저장/이동 app278 동작 보호.
- 일반 최근생성곡 PC↔모바일 동기화 보호.
- Explore public like app164/Worker195 동결.
- Music Note 상세 60초 묶음 저장 보호.
- 사용자 실사용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app279 특정 legacy 곡 폐기 여부 결정 / 정상 경로 검증 (2026-10-01 KST)

현재:
- `스쳐간 이름 뒤에`는 app279에서도 실기기 FAIL.
- 나머지 최근생성곡 동기화 정상.
- 공유노트 폴더 생성/곡 저장/이동 정상.
- 이 한 곡만 위해 동기화 구조를 계속 수정하면 정상 기능 회귀 위험이 커서 추가 구조 수정은 중단 후보.

다음:
1. 사용자가 곡 폐기를 선택하면 해당 한 곡만 수동 정리.
2. 전체 favorites/최근곡 대량 정리·migration 금지.
3. 정상 곡 1개로 양방향 저장/해제 재확인.
4. CACHE LIVE 초기화 후 initiating device canonical W1, receiving device Firestore R0/W0, idle R/W0 확인.
5. 사용자 실사용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app279 legacy 최근곡 하트 양방향 최종 실사용 확인 (2026-10-01 KST)

현재:
- app278 공유노트 폴더 생성/곡 저장/곡 이동 사용자 PASS.
- 일반 최근생성곡 PC↔모바일 하트 정상.
- 특정 `스쳐간 이름 뒤에`만 device-local legacy identity가 갈려 app278 FAIL.
- app279는 `generationBatchId + generationIndex`를 최우선 cross-device identity로 바꾸고 deterministic favorite doc도 같은 identity를 사용.
- Focused Audit `36806408964` SUCCESS.
- PREVIEW Release `36806515670` SUCCESS / app279 exact build PASS.
- TEST / PRODUCTION unchanged.

테스트 전:
- PC/모바일 둘 다 app279 확인.
- CACHE LIVE **초기화** 후 시작.
- `스쳐간 이름 뒤에`는 먼저 둘 다 빈 하트 상태로 맞춘다.

필수 테스트:
1. 모바일 저장 → PC 하트 즉시 채움.
2. 모바일 해제 → PC 즉시 해제.
3. PC 저장 → 모바일 즉시 채움.
4. PC 해제 → 모바일 즉시 해제.
5. 일반 정상 곡 1개 같은 순서로 회귀 없음 확인.
6. 수신 기기 CACHE LIVE에서 해당 remote replay 때문에 Firestore R/W가 증가하지 않아야 함.
7. 아무 조작 없이 1분 대기 → Firestore/D1 반복 R/W 0.

비용 해석 — 중요:
- **실제 데이터 변경은 write가 올라가는 것이 정상**.
- 최근생성곡 저장/해제: initiating device `favorites:write` canonical W1/행동.
- 폴더 생성/이름/순서: `user_structures:write` canonical W1/실제 구조 변경.
- 곡 폴더 이동/제거: 변경된 `favorites` 문서 write. batch는 네트워크 묶음이며 변경 곡 수만큼 원본 문서 write가 잡힘.
- 문제로 보는 것은 **수신 동기화 때문에 추가 Firestore read/write**, 페이지 이동/idle만으로 추가 write, 또는 전체 favorites scan.
- app278 사용자 캡처의 PAGE SYNC NOOP + D1 R0/W0 + Firestore R0/W0는 정상.
- `favorites:getDocs 1`은 legacy initiating-device fallback 가능성이 있어 app279 재테스트에서 별도 관찰.

보호:
- app278 공유노트 폴더 구조/곡 이동 기능 동결.
- 일반 최근생성곡 하트 동기화 정상 경로 동결.
- public Explore like app164/Worker195 동결.
- Music Note 상세 60초 묶음 저장 동결.
- 사용자 실사용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app278 공유노트 구조/legacy 최근곡 하트 실사용 확인 (2026-10-01 KST)

현재:
- app278 PREVIEW 배포 완료.
- Focused Audit `36797912332` SUCCESS / Backend V2 Safety `36797912218` SUCCESS.
- PREVIEW App Run `36798048915` SUCCESS / app278 exact build PASS.
- 공유노트 새 저장뿐 아니라 폴더 구조와 changed-item 이동을 기존 UID RTDB 신호로 전달.
- Music Note Like/Lock은 즉시 RTDB UI delta, canonical Firestore는 기존 page-exit 묶음 정책 유지.
- legacy 최근곡은 deterministic `recentSongSyncKey`로 양 기기 하트 identity 보강.
- TEST / PRODUCTION unchanged.

사용자 테스트:
1. PC에서 공유노트 폴더 하나 생성 → 모바일에 새로고침 없이 즉시 표시.
2. 폴더 이름 변경 및 순서 이동 → 모바일 즉시 동일.
3. 공유노트 곡 1개를 다른 폴더로 이동 → 모바일 즉시 이동.
4. 모바일에서도 위 작업을 반대로 수행 → PC 즉시 동일.
5. Music Note 카드 Like/Lock 한 번 변경 → 반대 기기 즉시 동일.
6. `스쳐간 이름 뒤에` PC 저장/해제 → 모바일 즉시 동일.
7. `스쳐간 이름 뒤에` 모바일 저장/해제 → PC 즉시 동일.
8. Explore 공개곡 → 공유노트 저장 기존 정상 동작 재확인.
9. 진단에서 수신 기기 Firestore R0/W0 확인.
10. 아무 조작 없이 1분 대기 → 반복 Firestore/D1 R/W 0.

비용/보호:
- 구조/카드-state 실시간 화면 반영은 RTDB small delta이며 수신 Firestore R0/W0.
- 폴더/곡 이동의 canonical 원본 write는 실제 사용자 변경이므로 유지.
- 카드 Like/Lock 클릭마다 Firestore write를 새로 만들지 않음; 기존 page-exit 묶음 저장 유지.
- 전체 favorites scan/query/rebuild 금지.
- public Explore like app164/Worker195 동결 영역 비변경.
- app273 공유노트 상세, app274/275 저장됨 표시, Music Note 60초 상세 편집 묶음 저장 보호.
- 사용자 실사용 + 비용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app277 양방향 동기화 + 비용 실사용 확인 (2026-10-01 KST)

현재:
- app276 양방향 sync 기능은 비용 회귀로 FAIL.
- app277 PREVIEW 배포 완료.
- 정상 cross-device changed-item receive는 Firestore R0/W0.
- 실제 save/unsave canonical favorite W1만 유지.
- legacy `users.favoriteSyncSignal` per-click Firestore write 제거.
- derived `favoriteCount` 30초 trailing batch.
- remote replay Catalog/R2 echo write 차단.
- Shared RTDB rules additive 배포 PASS.
- PREVIEW Run `36794274979` SUCCESS / app277 exact build PASS.
- TEST / PRODUCTION unchanged.

사용자 테스트:
1. PC에서 최근생성곡 A 저장 → 모바일 자동 하트/뮤직노트 반영.
2. PC에서 A 해제 → 모바일 자동 해제.
3. 모바일에서 B 저장/해제 → PC 자동 반영.
4. 공유노트 C 저장 → 반대 기기 공유노트 자동 반영.
5. Firestore Usage를 같이 보고 클릭 1회마다 반대 기기 R1이 더 붙지 않는지 확인.
6. 30초 안에 여러 저장/해제를 해도 user favoriteCount write가 매 클릭 발생하지 않는지 확인.
7. 아무 조작 없이 1분 대기 시 반복 read/write가 없어야 함.

합격 비용:
- unchanged idle/navigation: R0/W0.
- actual favorite save/unsave: canonical favorites W1.
- remote device sync: Firestore R0/W0.
- derived favoriteCount: 최대 users W1 / 30초 net batch, net0이면 W0.
- D1 R0/W0 추가.
- 전체 favorites scan/query/rebuild 0.

보호:
- public Explore 좋아요 app164/Worker195 동결 영역 비변경.
- 공유노트 상세 app273, 저장됨 app274/275 보호.
- Music Note 60초 상세 편집 묶음 저장 보호.
- 실사용/비용 PASS 전 TEST 승격 금지.

## CURRENT TASK — app276 PC↔모바일 Music Note/보관함 동기화 실사용 확인 (2026-10-01 KST)

사용자 제보:
- 모바일 → PC 저장은 보이지만 PC → 모바일 저장/해제가 반응하지 않는 비대칭.
- 마이노트/공유노트 및 최근생성곡 하트(보관함 저장/해제)가 모두 같은 cross-device 문제로 확인 대상.

현재:
- app276 PREVIEW 배포 완료.
- RTDB Music Note version을 UID-wide monotonic으로 수정.
- exact changed favorite IDs를 event에 보존하고 route와 무관하게 반대 기기에서 해당 문서만 exact sync.
- missed signal도 local pending payload에서 exact IDs 복구.
- 변경 없음 read 0 유지.
- PREVIEW Run `36791874121` SUCCESS / app276 exact build PASS.
- TEST / PRODUCTION unchanged.

사용자 테스트 순서:
1. PC/모바일 동일 계정으로 PREVIEW를 둘 다 켠다.
2. **PC → 모바일**
   - 최근생성곡 A 하트 저장 → 모바일 하트/뮤직노트 확인.
   - 같은 A 하트 해제 → 모바일 하트 해제/뮤직노트 제거 확인.
3. **모바일 → PC**
   - 다른 곡 B 저장 → PC 확인.
   - B 해제 → PC 확인.
4. Explore 공개곡 C를 PC에서 공유노트 저장 → 모바일 공유노트 확인.
5. 가능하면 모바일에서 다른 공유곡 D 저장 → PC 확인.
6. 페이지 이동/새로고침 없이 수렴해야 PASS.

비용/보호:
- 실제 remote mutation 때만 변경 문서 exact read.
- 전체 favorites query/scan 금지.
- 변경 없음 앱 진입/페이지 이동 read 0.
- 기존 좋아요(public Explore like) app164/Worker195 동결 영역 변경 금지.
- 공유노트 상세 app273, 저장됨 표시 app274/275 정상 기능 보호.
- TEST 승격은 사용자 실사용 PASS + 명시 요청 전 금지.

## CURRENT TASK — app275 저장됨 핑크 표시 실사용 확인 (2026-10-01 KST)

현재 상태:
- app274 저장 위치 표시 기능 PASS.
- app275에서 `저장됨` 글자 색상만 핑크 `#ff7a9d`로 변경.
- PREVIEW Run `36789135930` SUCCESS / app version 275 / exact build PASS.
- 추가 서버 read/write 0.
- TEST / PRODUCTION unchanged.

확인:
1. 저장된 폴더의 `저장됨`이 핑크색으로 명확히 보임.
2. 버튼 위치/크기/간격 변화 없음.
3. 같은 폴더 재저장 차단 유지.
4. 다른 폴더 저장 동작 유지.
5. PC/모바일 동일.

## CURRENT TASK — app274 공유노트 저장 위치 표시 실사용 확인 (2026-10-01 KST)

현재 상태:
- app273 공유노트 상세 복구: 사용자 실사용 PASS.
- app274 PREVIEW 배포 완료.
- saved-status 표시 자체는 local-only이며 추가 Firestore/D1/R2 read 0.
- 같은 폴더 재저장 write도 차단.

확인:
1. 이미 저장한 곡 → Explore > 공유 노트에 추가.
2. 저장된 폴더 행에 `저장됨` 표시.
3. 해당 행 비활성.
4. 미저장 곡은 표시 없음.
5. 다른 폴더로 저장하면 다음 진입에서 표시 위치 이동.
6. PC/모바일 동일.

비용 기준:
- 저장 상태 표시를 위해 서버 read 추가 금지.
- 새 기기/로컬 cache 미보유 상태에서 표시를 강제하기 위한 서버 확인도 추가하지 않음.
- 기존 folder structure/cache 및 기존 follower save-access 비용은 app274가 새로 만든 비용이 아님.

보호:
- app273 상세 복구 경로, 좋아요, Feed, 공개프로필, 분할 UI, 공개/비공개 정상 기능 변경 금지.
- TEST 승격은 사용자 요청 전 금지.

## CURRENT TASK — app273 기존 저장 공유노트 실기기 확인 (2026-10-01 KST)

현재 상태:
- app272 “화면 변화 없음” 원인을 기존 Firestore shared-note + 기기 full local cache까지 확장해 수정.
- 현재 공유 허용 상태와 연결된 stale shared-note **11문서 targeted repair 완료**.
- prompt 누락 8 / lyrics 누락 7, identity mismatch 0 / source missing 0.
- app273는 오래된 full local row도 detail이 불완전할 때만 exact Firestore 1건을 재수화.
- PREVIEW Run `36784611639` SUCCESS / app version 273 / exact build PASS.
- TEST / PRODUCTION unchanged.

사용자 확인:
1. 기존에 문제였던 공유노트를 재저장하지 말고 그대로 상세 열기.
2. 한글/외국어 가사 확인.
3. 프롬프트 확인.
4. 키워드/다음곡 적용/원작자/Suno 링크 기존 정상 기능 확인.
5. 같은 곡 재저장 후에도 동일 정상.
6. PC/모바일 동일.

판정:
- 위 항목이 실제 화면에서 PASS하면 app273 동결.
- 아직 빈 값이 있으면 그 shared-note **1문서만** ID/source/cache 경로를 좁혀 진단하고 전체 구조를 다시 바꾸지 않는다.
- 현재 공유 허용 대상이 아닌 기존 25개 shared-note는 이번 targeted repair 범위 밖이며 임의 수정 금지.
- 좋아요/Feed/프로필/분할/다른 Music Note 저장 구조 변경 금지.
- TEST 승격은 사용자 요청 전 금지.

## CURRENT TASK — app272 실사용 FAIL 재진단 (2026-10-01 KST)

사용자 판정: **이전 작업 후 실제 화면에서 전혀 변화가 없어 FAIL.**

즉시 기준:
- app272를 완료로 보지 않는다.
- D1 글로벌 lyrics parity PASS만으로 제품 정상 판정 금지.
- 이미 저장된 follower shared_music_note가 그대로 남아 있어 화면이 안 바뀌는 경로를 우선 확인.
- 먼저 read-only 진단으로 stale 저장본 범위와 실제 불일치 필드를 확정.
- 새 저장/재저장 경로도 실제 payload -> Firestore -> Catalog/cache -> 상세 hydrate까지 끝단 검증.
- 좋아요/Feed/공개프로필/분할/UI 등 정상 기능은 변경 금지.
- 사용자 데이터 bulk rewrite/전체 backfill은 승인 전 금지.
- TEST/PRODUCTION 승격 금지.

합격선:
1. 기존 저장본을 열었을 때 필요한 상세가 정상 표시되는 해결 경로가 마련됨.
2. 같은 곡 재저장 시 deterministic 문서가 실제로 갱신됨.
3. 한글/외국어 가사, 프롬프트, 키워드가 상세에서 모두 확인됨.
4. PC/모바일 동일.
5. 전체 스캔/페이지 진입 read/write/불필요한 서버 비용 증가 없음.
6. 사용자 실사용 PASS 전 완료 보고 금지.

## CURRENT TASK — app272 글로벌 공개곡 follower-save 실사용 확인 (2026-10-01 KST)

완료:
- 특정 사용자뿐 아니라 **전체 사용자** shared canonical 공개 Music Note를 전수 조건 검사.
- 38곡 / 3 owner 중 legacy D1 lyrics 누락 32곡 발견.
- 32/32 canonical Firestore 원본 lyrics 존재 확인.
- 사용자 승인 후 32개 D1 lyrics targeted repair 완료.
- Repair Run `36782335008` SUCCESS.
- postcheck: public Music Note D1 missing lyrics 0 / missing prompt 0 / source-present parity PASS.
- one-off repair workflow/trigger 제거 완료.
- PREVIEW app272 유지 / TEST·PRODUCTION 코드 비변경.

실사용 확인:
1. owner가 기존 공개 설정을 다시 만지지 않는다.
2. follower 계정에서 기존 공개곡을 공유 노트에 저장.
3. 한글/외국어 가사, 프롬프트, 키워드가 모두 표시.
4. 과거에 잘못 저장된 동일 곡은 다시 저장하면 deterministic shared-note 문서가 갱신.
5. 다른 사용자 곡에서도 동일.
6. PC/모바일 동일.
7. 좋아요/공개프로필/Feed/다음곡 적용/권한 로직 회귀 없음.

보호:
- 전체 사용자 원본 Firestore write 금지.
- 이미 저장된 follower shared-note 전체 일괄 rewrite 금지.
- 페이지 진입/업데이트/재방문에 repair read/write 추가 금지.
- 정상 좋아요/Feed/프로필/UI 변경 금지.
- TEST 승격은 사용자 요청 전 금지.

## CURRENT TASK — app272 legacy 공개곡 targeted lyrics repair 승인 대기 (2026-10-01 KST)

현재 판단:
- app271의 "기존 공개곡은 owner가 설정을 다시 저장해야 복구" 방식은 사용자 실사용 기준 **FAIL**.
- app272는 follower-save authorized detail snapshot 전달 문제를 수정해 PREVIEW 배포 완료.
- 실데이터 read-only 진단상 기존 public + follower-save 12건 중 **6건만 D1 lyrics가 비어 있고, 원본 Firestore에는 6/6 lyrics가 존재**.
- D1 prompt 누락은 0. 기존 saved shared-note의 prompt 누락은 client/copy 전달 문제이며 app272로 수정됨.

배포 기준:
- app272 code: `44fbea7b57eedde378522af95489e24293a8ba61`.
- verifier: `7336229783e6f0e22b9395815b815a600ec70894`.
- Audit Run `36780865841` SUCCESS.
- PREVIEW App Run `36781099874` SUCCESS / app272 exact build PASS.
- TEST / PRODUCTION unchanged.

사용자 승인 후에만 실행할 데이터 작업:
- shared D1 canonical `tracks`에서 다음 exact 조건을 만족하는 현재 6건만:
  - source_type = music_note
  - public + published
  - allow_follower_save = 1
  - lyrics empty
- 실행 전 count가 예상값과 다르면 중단.
- 모든 sourceId를 canonical Firestore에서 사전 read-only 검증한 뒤에만 UPDATE.
- owner/source mismatch / source missing / lyrics missing 하나라도 있으면 write 시작 전 전체 중단.
- 각 대상 D1 row `lyrics` 1회 UPDATE 외 다른 필드 변경 금지.
- Firestore write / R2 Feed rebuild / profile rebuild / schema migration / 전체 backfill 금지.
- TEST/PRODUCTION 비변경.
- 완료 후 D1 missing lyrics 0과 원본 parity read-only 재검증.

사용자 실사용 합격선:
1. 기존 공개곡 소유자가 follower-save 설정을 다시 만지지 않음.
2. follower 계정에서 기존 공개곡을 공유 노트에 저장.
3. 한글/외국어 가사 + 프롬프트 + 키워드 표시.
4. 기존 곡을 재저장하면 deterministic shared-note 문서가 갱신.
5. PC/모바일 동일.
6. 좋아요/공개프로필/Feed/다음곡 적용/공유 설정 회귀 없음.

## CURRENT TASK — app271 공유노트 가사 실사용 검증 (2026-10-01 KST)

상태: **코드/감사/PREVIEW Worker/PREVIEW App 배포 완료. 사용자 실기기 확인만 남음.**

기준:
- app271 product SHA lock: `17b5563ef20f431f218df3781e4d781ec6c46e3b`.
- Audit Run `36777031706` SUCCESS.
- PREVIEW Worker Run `36777248898` SUCCESS / active version `cd5dc8b5-d061-4b4b-abd9-9a28052bacf0`.
- PREVIEW App Run `36777381094` SUCCESS / `preview.soridraw.com` app `271` exact build PASS.
- TEST / PRODUCTION unchanged.

검증할 것:
1. 신규/재등록 공개곡의 follower-save -> 공유 노트 상세에서 한글/외국어 가사와 프롬프트가 모두 표시.
2. app270 이전 기존 공개곡은 대량 backfill하지 않았으므로, 소유자 계정에서 실제 공개설정 mutation을 한 번 발생시켜야 함.
3. 현재 `팔로워 곡 저장 허용=ON`인 기존곡은 OFF를 실제 반영한 뒤 ON을 실제 반영한다. 두 변경을 너무 빨리 되돌려 net-zero로 만들지 않는다.
4. ON mutation 뒤 follower가 같은 곡을 다시 저장 -> 기존 deterministic 공유노트 문서가 갱신되고 가사가 표시.
5. 한글/외국어 칸 분리, 프롬프트, 키워드, 다음곡 적용, Suno 링크, 원작자 정보 회귀 없음.
6. PC/모바일 동일.

보호:
- 정상인 좋아요/공개프로필/Explore Feed/분할 UI/다른 Music Note 저장 구조는 변경 금지.
- 전체 D1/Firestore backfill, migration, 대량 사용자 데이터 수정 금지.
- follower save-access는 track PK 1 + follow 1 = 2 bounded D1 SELECT / W0 유지.
- 기존곡 보정은 owner의 실제 publication mutation에만, 해당 source 1건 Firestore read + 같은 canonical UPDATE에 lyrics 병합.
- 페이지 진입/업데이트/재방문만으로 repair read/write 금지.

다음:
- 사용자 실사용 PASS면 코드 수정 없이 app271 동결.
- FAIL이면 실패한 곡 1건의 canonical lyrics 값과 owner mutation 경로만 좁혀 진단.
- TEST 승격은 사용자 요청 전 금지.

## 2026-10-01 — app269 팔로워 공유노트 링크공유 동등성 실사용 확인

PREVIEW 배포 완료:
- 다른 사용자 곡의 `팔로워 곡 저장 허용` 경로가 권한 통과 시 기존 canonical track row의 가사/프롬프트/style + share keyword/nextSong recipe를 같은 save-access 응답으로 받음.
- D1 비용은 기존 그대로 track PK 1 + follow 1 = 2 bounded SELECT, write 0.
- 저장된 공유노트는 lyrics/prompt/userInput/appliedKeywords/Suno 링크를 보존.
- Music Note 목록 키워드, 상세 정보, 다음곡 적용이 링크 공유 저장본과 같은 기능 기준을 갖도록 연결.
- PREVIEW Worker Run `36771319454` SUCCESS, active version `6917ac59-a1b0-4d50-b5de-e1979efd1f64`.
- PREVIEW App Run `36771471427` SUCCESS, app269 exact build PASS.
- TEST/PRODUCTION 비변경.

다음 확인:
1. 타 사용자 + follower-save ON + 실제 팔로우 -> 공유노트 저장.
2. 목록 키워드 표시.
3. 상세 가사/프롬프트 표시.
4. 공유노트 상세/카드의 다음곡 적용이 원본 keyword/command recipe를 Studio로 전달.
5. 원작자/커버/Suno 링크 유지.
6. follower-save OFF 저장 차단 유지.
7. direct Explore apply permission은 기존대로 독립 유지.

판정:
- 위 항목 PASS면 app269 종료.
- 특정 오래된 공개곡에서 정보가 비면 그 track 1건의 canonical share payload 생성 시점을 먼저 확인하며 전체 backfill은 금지.
- 좋아요/Explore Feed/프로필/rail/app265 UI는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-10-01 — app268 다른 사용자 공유 노트 저장 실사용 확인

PREVIEW 배포 완료:
- 다른 사용자 곡도 권한 통과 후 canonical Firestore + Music Note Catalog 저장 유지.
- 저장 성공 뒤 변경곡 1건을 same-device favoritesStore/local instant cache에 즉시 upsert.
- Music Note를 이미 열어 본 세션에서도 새 공유곡이 바로 표시되도록 수정.
- app268 exact build PASS.
- TEST/PRODUCTION 비변경.

다음 확인:
1. 다른 사용자 곡 + follower-save 허용 + 실제 팔로우 상태에서 새폴더 저장.
2. Music Note > 공유 노트 > 같은 폴더에 즉시 표시.
3. 두 번째/세 번째 다른 사용자 곡을 연속 저장해도 누락 없이 누적.
4. 저장 곡 상세 클릭 app267 정상.
5. 권한 OFF 곡은 app266 비활성 유지.
6. 서버 비용: 저장당 canonical 1 write + 기존 R2 one-item delta, 추가 Firestore read 없음.

## 2026-10-01 — app267 공유 노트 상세 클릭 실사용 확인

PREVIEW 배포 완료:
- 공유 노트 compact Catalog row도 상세 클릭 시 해당 favorites 문서 1건만 hydrate.
- lyrics undefined 상세 크래시 방어.
- app267 exact build PASS.
- TEST/PRODUCTION 비변경.

다음 확인:
1. 공유 노트 카드 클릭 -> 상세 정상 오픈.
2. 한글/외국어 가사, 프롬프트, 원작자, 미디어 정상 표시.
3. 읽기 전용 유지.
4. 같은 곡 재오픈 시 전체 Music Note 재조회 없음.
5. app266 공유노트 권한 OFF/ON 및 폴더 저장 정상 유지.

## 2026-10-01 — app266 Explore 공유 노트 권한/저장 실사용 확인

배포 완료:
- `팔로워 곡 저장 허용=false`이면 로그인 사용자의 More `공유 노트에 추가` 비활성.
- owner도 permission OFF 우회 금지.
- 타 사용자 곡은 permission ON + 기존 follower save-access 조건 유지.
- 공유 노트 canonical Firestore 저장 후 변경곡 1개만 Music Note local/R2 Catalog delta에 반영.
- 전체 favorites 재조회 / 전체 Catalog rebuild 없음.
- PREVIEW App Release Run `36763773547` SUCCESS.
- preview app version 266 exact verification PASS.
- Worker / D1 / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. permission OFF: 버튼 비활성, 폴더 화면 진입 불가.
2. permission ON 저장 후 More 재오픈: 버튼 활성.
3. 허용곡을 공유 노트 폴더에 저장 후 Music Note > 공유 노트 해당 폴더에 바로 표시.
4. 다른 계정 곡은 실제 follower 조건까지 만족해야 저장 가능.
5. 공유 노트 항목은 읽기 전용/원작자 정보/미디어 유지.
6. 앱 진입/재진입 때문에 추가 전체 Firestore read가 생기지 않는지.

주의:
- 과거 Firestore에 이미 저장됐지만 Catalog에서 누락된 기존 공유노트의 대량 백필은 사용자 승인 없이 하지 않는다.
- 사용자 실사용에서 과거 누락 항목 복구 필요가 확인되면, 전체 스캔보다 특정 문서/변경분 복구를 먼저 설계한다.
- 좋아요/공개/프로필/rail/app265 pinned UI는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-10-01 — app265 고정 곡 반응형 실사용 확인

배포 완료:
- 모바일 FEATURED 복구.
- 모바일 고정곡 제목 13.5px로 소폭 확대.
- 태블릿/PC는 viewport가 아니라 실제 pinned card 폭 기준으로 반응.
- card <=520px: 키워드 2개 x 2줄, 액션 36px.
- card <=420px: 액션 32px, 키워드/간격 추가 소폭 축소.
- 넓은 카드의 app264 디자인/액션 크기 유지.
- PREVIEW App Release Run `36760576791` SUCCESS.
- preview app version 265 exact verification PASS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 모바일 FEATURED 표시.
2. 모바일 제목 크기/겹침.
3. 넓은 태블릿/PC에서 기존 크기 유지.
4. 창을 줄여 compact card가 되면 키워드 2열과 버튼 축소가 자연스럽게 적용되는지.
5. 적용 → 공유 → 더보기 / 좋아요 우하단 위치 유지.
6. 버튼 클릭, 좋아요 숫자, rail app263 동작 비변경.

판정:
- 겹침이 사라지고 전환이 자연스러우면 app265 종료.
- 미세 조정이 필요하면 pinned 전용 container threshold/크기만 수정.
- 서버/좋아요 동기화/프로필 데이터/rail 로직은 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-10-01 — app264 고정 곡 액션 위치 실사용 확인

배포 완료:
- 고정 곡 우측 상단 순서: 다음곡에 적용 → 공유 → 더보기.
- 좋아요 + 숫자: 우측 하단.
- 사용자 요청의 두 단계 교환(좋아요↔공유, 이후 공유↔다음곡 적용)을 최종 위치로 반영.
- 기존 버튼 기능/색상/크기/상태 로직 유지.
- PREVIEW App Release Run `36754989527` SUCCESS.
- preview app version 264 exact verification PASS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC/태블릿 상단 3개 순서가 적용 → 공유 → 더보기인지.
2. 좋아요가 우측 하단에 자연스럽게 있는지.
3. 모바일도 동일한 위치 관계인지.
4. 좋아요/적용/공유/더보기 실제 기능이 기존과 동일한지.
5. 제목/키워드/재생/rail app263 동작 비변경인지.

판정:
- 위 항목 PASS면 app264 종료.
- 미세 위치 조정이 필요하면 pinned 전용 CSS만 수정.
- 좋아요 서버 로직, 공개/프로필/Feed/rail snap은 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-10-01 — app263 강한 flick 관성 후 snap 실사용 확인

배포 완료:
- 작은 이동은 app262 release 0.1초 snap 유지.
- 강한 touch flick은 release 직후 native momentum을 먼저 자연스럽게 감속.
- 관성 scroll이 계속되는 동안 0.1초 settle timer를 마지막 inertial scroll 기준으로 다시 예약.
- 관성 종료 후 0.1초 동안 추가 움직임이 없을 때만 app253 50% nearest-anchor smooth snap.
- app262 touch pointercancel 보호 유지.
- PREVIEW App Release Run `36738204376` SUCCESS.
- preview app version 263 exact verification PASS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 작은 이동 -> app262처럼 release 후 약 0.1초 정렬.
2. 강한 flick -> 먼저 자연 감속, 그 뒤 최종 정렬 1회.
3. 급브레이크가 여러 단계로 걸리는 느낌이 없는지.
4. 정렬 직전/직후 좌우로 흔들리는 느낌이 없는지.
5. 손가락을 계속 대고 있으면 snap 금지 유지.

판정:
- 위 항목 PASS면 app263 종료.
- 강한 flick에서 여전히 흔들리면 timer를 더 덧붙이지 말고 native momentum과 programmatic smooth snap의 소유권 자체를 재검토한다.
- 서버/좋아요/공개/프로필/More/카드 디자인은 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-10-01 — app262 모바일 rail 실제 release 재확인

배포 완료:
- 모바일 native horizontal scroll takeover에서 발생하는 touch `pointercancel`을 실제 손가락 release로 취급하지 않도록 수정.
- touch pointercancel 중에는 held guard 유지.
- 실제 `touchend`에서만 0.1초 snap 시작.
- 정상 pointerup이 먼저 처리된 경우 touchend가 timer를 다시 시작하지 않음.
- app253 50% 좌우 대칭 nearest-anchor, app261 0.1초 delay, PC mouse 동작 유지.
- PREVIEW App Release Run `36734252253` SUCCESS.
- preview app version 262 exact verification PASS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 모바일에서 손가락을 계속 대고 좌우 이동 -> 손가락을 놓기 전 정렬 금지.
2. 이동 중 0.1초 이상 멈춤 -> 손가락을 대고 있으면 정렬 금지.
3. 손가락 release -> 약 0.1초 후 50% 기준 snap.
4. 연속 좌우 이동이 끊기지 않는지.
5. PC mouse drag/release는 기존과 동일한지.

판정:
- 위 항목 PASS면 app262 종료.
- 같은 증상이 남으면 새 예외를 계속 덧붙이지 않고, 사용자 지시대로 app261 release-timing 변경을 제거하고 app260/app253의 이전 rail 동작으로 복귀하는 것을 우선한다.
- 서버/좋아요/공개/프로필/More/UI 배치는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app261 rail 놓기 기준 0.1초 snap 실사용 확인

배포 완료:
- 손가락/마우스를 누른 채 이동 중에는 snap timer를 만들지 않음.
- pointer up/cancel 시점부터 100ms 후 app253 50% nearest-anchor 정렬.
- 모바일 short drag 1-card 이동도 놓은 뒤 100ms 기준.
- release snap 대기 중 후속 scroll은 timer를 다시 미루지 않음.
- wheel/trackpad는 release 신호가 없으므로 100ms scroll-idle fallback 유지.
- PREVIEW App Release Run `36693629667` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 모바일에서 손가락을 댄 채 이동 후 잠시 멈춰도 놓기 전에는 snap이 시작되지 않는지.
2. 손가락을 놓은 뒤 약 0.1초 후 50% 기준으로 정렬되는지.
3. PC/태블릿에서도 mouse pointer를 누른 상태의 일시 정지로 snap이 시작되지 않는지.
4. mouse pointer를 놓은 뒤 약 0.1초 후 정렬되는지.
5. 좌/우 50% 대칭 규칙과 rail 버튼/hover 표시가 그대로인지.

판정:
- 위 항목 PASS면 app261 종료.
- snap 체감 외 서버/카드 디자인/좋아요/More 경로는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app260 More 배경 click-through 실사용 확인

배포 완료:
- 어두운 More backdrop은 전체 클릭 sequence를 끝까지 흡수.
- pointerdown에서는 닫지 않고 전파만 차단.
- backdrop click 완료 후 More 닫기.
- sheet 내부 pointer/click은 전파 차단.
- 뒤쪽 카드/좋아요/재생/공유/더보기로 입력 전달 금지.
- PC/모바일 공통.
- PREVIEW App Release Run `36668317050` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC에서 뒤쪽 버튼 위의 어두운 배경 클릭 -> More만 닫기.
2. 모바일에서 동일 위치 탭 -> More만 닫기.
3. 뒤 카드의 버튼 상태가 변하지 않는지.
4. sheet 내부 버튼은 정상인지.
5. app259 뒤로가기 닫기 동작이 유지되는지.

판정:
- 위 항목 PASS면 app260 종료.
- 이 작업 외 UI/서버 로직은 건드리지 않는다.

## 2026-09-30 — app259 pinned 상단 액션 + PC More 뒤로가기 실사용 확인

배포 완료:
- 고정 곡 우측 상단 순서: 좋아요 -> 다음곡 적용 -> 더보기.
- 공유는 기존 우측 하단 유지.
- More history entry를 sheet 표시 전에 동기적으로 예약.
- PC/모바일 모두 첫 뒤로가기는 More 닫기, More가 닫힌 뒤 다음 뒤로가기는 원래 navigation.
- PREVIEW App Release Run `36667468362` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. pinned 우측 상단 세 액션의 간격/위치가 자연스러운지.
2. 공유가 기존 우측 하단에 그대로 있는지.
3. PC browser Back 1회로 More만 닫히는지.
4. More 닫힌 뒤 다시 Back하면 정상적으로 이전 페이지로 가는지.
5. 모바일 시스템 Back / 바깥 영역 터치 닫기도 정상인지.

판정:
- 위 항목 PASS면 app259 종료.
- 위치 미세조정은 pinned 전용 CSS만 최소 수정.
- 서버/좋아요/공개/프로필/Feed 경로는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app258 pinned 하단 고정 행 실사용 확인

배포 완료:
- 고정 곡 좋아요 + 다음곡 적용 + 공유를 하나의 `pinned-bottom-row`로 묶음.
- 창 크기/반응형 구간이 바뀌어도 세 액션이 같은 bottom 기준과 같은 중심선 사용.
- desktop/tablet: bottom 6px.
- mobile: bottom 4px.
- title/keyword 중앙 정렬, 좋아요 흰색 규칙, apply 핑크/어두운색, More 바깥/뒤로가기 닫기 유지.
- PREVIEW App Release Run `36666561946` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC 창 폭을 여러 단계로 바꿔도 하트/적용/공유가 같은 줄인지.
2. 태블릿 폭에서도 같은 줄인지.
3. 모바일에서 하트만 아래로 처지지 않는지.
4. 제목/키워드 세로 중앙은 그대로인지.
5. More 바깥 클릭과 뒤로가기 1회 닫기가 정상인지.

판정:
- 위 항목 PASS면 app258 종료.
- 미세 위치가 남으면 `pinned-bottom-row-258`의 bottom/height만 최소 조정.
- 서버/좋아요/공개/프로필/Feed 로직은 건드리지 않는다.

## 2026-09-30 — app257 pinned 하단 정렬 + More 닫기 실사용 확인

배포 완료:
- 고정 곡 좋아요를 다음곡 적용/공유와 같은 하단 행에 정렬.
- 제목/키워드 묶음의 기존 세로 중앙 정렬 유지.
- pinned 다음곡 적용: 활성 핑크(#ff7a9d), 비활성 어두운 흰색 28%.
- Explore More:
  - 어두운 바깥 영역 pointer down -> 닫기.
  - sheet 내부 pointer -> 유지.
  - 브라우저/Android 뒤로가기 -> 페이지 이동 전 More만 닫기.
  - 정상 닫기 후 임시 history entry 정리.
- PREVIEW App Release Run `36665389251` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC/모바일 pinned 제목+키워드가 세로 중앙을 유지하는지.
2. 좋아요 / 다음곡 적용 / 공유가 같은 하단 높이에 자연스럽게 정렬되는지.
3. apply 허용 ON = 핑크, OFF = 어두운색인지.
4. Feed/공개프로필 어느 카드에서든 More 창 바깥 어두운 영역 탭으로 닫히는지.
5. More sheet 내부 터치로는 닫히지 않는지.
6. Android/브라우저 뒤로가기 1회로 More만 닫히고 페이지는 유지되는지.
7. More 닫힌 뒤 다음 뒤로가기는 원래 navigation대로 동작하는지.

판정:
- 위 항목 PASS면 app257 종료.
- 미세 위치만 필요하면 pinned CSS 최소 수정.
- 좋아요/공개/프로필/Feed 서버 경로는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app256 pinned 액션/rail 화살표 실사용 확인

배포 완료:
- 고정 곡 좋아요를 제목/키워드 아래 텍스트 영역으로 이동.
- 좋아요 OFF = 흰색 outline / ON = 흰색 filled heart.
- pinned 적용/공유/더보기는 투명 chrome + app255 대비 약 20~25% 축소.
- 적용/공유는 오른쪽 아래, 더보기는 오른쪽 위에 더 밀착.
- 모든 Explore rail 좌우 버튼은 실제 카드 image/creator visual 세로 중앙을 계산해 정렬.
- PC/tablet 화살표 좌우 위치 -32px, mobile -6px.
- PREVIEW App Release Run `36663692598` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. pinned 좋아요가 artwork/play를 침범하지 않고 키워드 아래에 있는지.
2. 좋아요 ON/OFF가 기존 흰색 하트 규칙 그대로인지.
3. 우측 액션이 카드 오른쪽 위/아래에 확실히 붙어 있는지.
4. 액션 아이콘 크기는 유지되면서 버튼 덩어리만 작아졌는지.
5. 배경/테두리가 투명인지.
6. PC/태블릿/모바일 가로 rail 화살표가 이미지 기준 세로 중앙인지.
7. 좌우 화살표가 이전보다 바깥쪽으로 충분히 이동했는지.

판정:
- 시각 미세조정이 필요하면 pinned 전용 CSS/rail edge 위치만 최소 수정.
- 좋아요/공개/프로필/Feed 서버 경로와 0.2초 50% snap 로직은 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app255 공개프로필 고정 곡 액션 배치 실사용 확인

배포 완료:
- 고정 곡 전용 액션을 카드 내부 오버레이로 이동.
- 좋아요: 왼쪽 아래.
- 다음곡 적용 + 공유: 오른쪽 아래.
- 더보기: 오른쪽 위.
- pinned 카드 아래 기존 액션 줄 제거.
- 버튼 크기: 기본 48px / PC 52px / 모바일 44px.
- 고정 곡/전체 곡 설명 문구 제거.
- PREVIEW App Release Run `36661616839` SUCCESS.
- Worker / D1 / R2 / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC에서 네 버튼 위치가 사용자 참고 이미지와 자연스럽게 맞는지.
2. 모바일에서도 버튼이 카드 안쪽에 안정적으로 들어가는지.
3. title/keyword/play 버튼과 겹치지 않는지.
4. 좋아요 count 및 liked 표시가 잘 보이는지.
5. 다음곡 적용/공유/더보기 실제 클릭이 정상인지.
6. 제거 요청한 두 설명 문구가 보이지 않는지.

판정:
- 사용자가 시각적으로 확인 후 위치/크기 미세조정이 필요하면 pinned 전용 CSS만 수정한다.
- 일반 Feed/전체 곡 카드 디자인과 서버 경로는 건드리지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app254 Explore 피드 수동 더 보기 제거 실사용 확인

배포 완료:
- 추천 / 최신 / 인기 Feed 하단의 수동 `더 보기` 제거.
- 사용자가 추가 40곡 cursor page를 직접 요청하는 UI/네트워크 경로 제거.
- 최초 Feed `limit=40`, cache-first/R2/revision 구조는 유지.
- 카드별 세로 점 `곡 더보기`는 유지.
- PREVIEW App Release Run `36659951404` SUCCESS.
- Worker / D1 schema / R2 data / Firestore / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 추천 / 최신 / 인기 하단에 Feed `더 보기` 버튼이 없는지.
2. 끝까지 스크롤해도 자동 추가 page 요청이 없는지.
3. 검색 / 공개프로필 접근은 정상인지.
4. 카드별 세로 점 메뉴는 정상인지.

판정:
- 위 항목 PASS면 app254 작업 종료.
- 서버 cursor/More cache는 구버전 호환 때문에 지금 제거하지 않는다.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app253 Explore 50% 좌우 대칭 정렬 실사용 확인

배포 완료:
- 모든 Explore 가로 카드 rail의 0.2초 정렬을 card-start nearest-anchor 방식으로 변경.
- 인접 카드 anchor 중간점이 정확한 50% 경계.
- 우측/좌측 모두 같은 기준.
- PREVIEW App Release Run `36658541957` SUCCESS.
- Worker / D1 / R2 / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 모바일 / 태블릿 / PC에서 우측으로 50% 미만 이동 후 놓기 -> 원위치.
2. 우측으로 50% 초과 -> 다음 카드.
3. 좌측으로 50% 미만 -> 원위치.
4. 좌측으로 50% 초과 -> 이전 카드.
5. 0.2초 settle 체감과 PC hover / 모바일 버튼 동작 유지.

판정:
- 좌/우 모두 위 기준 PASS면 작업 종료.
- 서버/데이터/카드 디자인은 추가 수정 금지.

## 2026-09-30 — app252 Explore rail hover 실사용 확인

배포 완료:
- PC mouse hover 중 Explore 가로 카드 rail 좌우 버튼 계속 표시.
- rail을 벗어나면 즉시 숨김.
- 버튼으로 이동해도 같은 rail stage 안에서는 유지.
- 모바일 touch 2초 표시 / scroll stop 0.5초 hide / 0.2초 settle 유지.
- PREVIEW App Release Run `36657296530` SUCCESS.
- Worker / D1 / R2 / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC에서 각 스크롤 가능한 rail에 마우스를 2초 이상 올려도 버튼이 유지되는지.
2. 버튼으로 마우스를 옮겨 실제 클릭 가능한지.
3. rail 밖으로 빼면 즉시 사라지는지.
4. 모바일 기존 동작이 그대로인지.

판정:
- 위 항목 PASS면 이 작업 종료.
- rail 데이터/좋아요/프로필 서버 경로는 건드리지 않는다.

## 2026-09-30 — app251 Explore rail 공통 동작 실사용 확인

배포 완료:
- PC/모바일 모든 `ExploreRecommendationRail`이 0.2초 settle 사용.
- 카드 영역 pointer down 시 좌우 버튼 2초 표시.
- 스크롤 중 버튼 표시, 마지막 움직임 0.5초 뒤 숨김.
- 버튼 크기 소폭 축소: PC 42px / 모바일 35px.
- Firebase PREVIEW App Release Run `36656243470` SUCCESS.
- Worker / D1 / R2 / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. PC: SORIDRAW 추천 / 장르별 추천 / 크리에이터 / 공개프로필 고정 곡 각각 좌우 이동.
2. 모바일: 동일 4개 rail 좌우 이동.
3. 각 rail이 움직임 종료 후 약 0.2초에 카드 정렬되는지.
4. 카드 영역 클릭/터치 시 버튼이 약 2초 유지되는지.
5. 스크롤 후 정지 시 버튼이 약 0.5초 뒤 사라지는지.
6. 버튼 크기가 기존보다 조금 작아졌고 카드/재생버튼과 충돌하지 않는지.

판정:
- 위 항목 PASS면 이 작업 종료.
- 추천 데이터/좋아요/공개·비공개/프로필 서버 경로는 추가 수정 금지.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — app250 공개프로필 전체 곡 정렬 실사용 확인

배포 완료:
- 공개프로필 상단 `고정 곡` 기능 유지.
- 아래 `전체 곡`은 `profilePinned`과 무관하게 `publishedAt DESC` 순서.
- app250 Firebase PREVIEW Hosting Run `36655276881` SUCCESS.
- Worker / D1 / R2 / Functions / Rules / TEST / PRODUCTION 변경 없음.

다음 확인:
1. 오래된 공개곡 1개를 고정.
2. 상단 고정 곡 영역에 나타나는지.
3. 아래 전체 곡에서는 공개 최신순 위치가 그대로인지.
4. 고정 해제해도 전체 곡 순서가 움직이지 않는지.
5. PC/모바일 동일 확인.

판정:
- 위 5개 PASS면 이 작업 종료.
- 고정 곡 rail 자체, 카드 디자인, 공개/비공개/좋아요/프로필 비용 경로는 추가 수정 금지.
- TEST 승격은 사용자 요청 전 진행하지 않는다.

## 2026-09-30 — 251 실사용 PASS 이후: Unified Profile Save

확정 실측:
- bio only: query R0/W1, physical **R5/W6**, R2 A1/B3.
- avatar only: query R0/W1, physical **R7/W8**, R2 A2/B1.
- avatar+background: batch `/v1/me/profile-media` 1요청, query R0/W1, physical **R7/W8**, R2 A3/B1.
- 251 이전 대비 bio W8->W6, avatar W9->W8.
- app248 유지.
- TEST/PRODUCTION unchanged.

다음 구현 목표:
- 사용자가 한 저장에서 텍스트 + media를 같이 변경해도 canonical D1 `public_profiles` UPDATE를 **총 1회**만 수행.
- media R2 객체는 실제 변경된 avatar/background만 저장.
- text-only / single-media-only / dual-media-only 기존 정상 경로와 old client 호환 유지.
- YouTube R2 sidecar/no-op 보호 유지.
- handle uniqueness, normalization, media size/type validation, cold recovery 유지.
- shared Profile R2/alias/first-view edge는 changed key만 patch/invalidate.
- D1 schema/migration/backfill/user data bulk operation 금지.
- Music Note 079 / likes / follows / publication / UI 비변경.

합격:
- combined text+avatar 저장: D1 query W1.
- combined text+avatar+background 저장: D1 query W1.
- no-op: D1 R0/W0.
- 기존 bio-only R0/W1, avatar-only R0/W1, dual-media R0/W1 유지.
- TypeScript/Build/profile regressions PASS.
- PREVIEW만 배포, TEST/PRODUCTION unchanged.
- live physical W는 combined-save에서 기존 두 mutation 합산보다 확실히 낮아야 함.

주의:
- 현재 profile derived compatibility journal/state는 바로 제거하지 않는다.
- 모든 환경이 direct targeted R2/edge mutation 경로로 승격된 뒤 retirement 판단.

## 2026-09-30 — app248 / 251 indexed-write compaction 실사용 재측정

배포 완료:
- product commit `43da52290eaa4e0fdb196dfff4b7fafba6faa24d`.
- Apply Run `36648918978` SUCCESS.
- Release Audit Run `36649084536` SUCCESS.
- PREVIEW Worker Release Run `36649277715` SUCCESS.
- PREVIEW Worker `d4f0b104-ffc1-461f-bf10-63bc39ca0868`.
- app248 유지, Hosting/client 변경 없음.
- D1 schema/migration/backfill/user data mutation 없음.
- TEST/PRODUCTION unchanged.

251 핵심:
- warm profile save는 실제 변경된 column만 UPDATE.
- bio-only는 unchanged indexed handle/is_public을 SET하지 않음.
- media warm path는 unchanged indexed is_public을 SET하지 않음.
- media cache patch는 이미 읽은 shared Profile R2 baseline 재사용.
- cold recovery full writer는 유지.
- 기존 249 profile derived journal과 Music Note 079는 그대로 유지.

재측정 절차:
1. CACHE LIVE 초기화 -> bio only.
2. 초기화 -> avatar only.
3. 초기화 -> avatar + background를 같은 저장 1회.
4. 각 실행의 D1 query R/W, physical R/W, 요청 상세, R2 A/B 캡처.
5. dual-media 요청 상세는 `/v1/me/profile-media` batch 1개여야 함.

비교 기준(251 이전):
- bio: query R0/W1, physical R5/W8.
- avatar: query R0/W1, physical R7/W9.
- dual media: 직전 캡처는 이전 avatar 실행 누적 가능성이 있어 독립 baseline 재측정 필요.

판정:
- query W1 유지.
- physical W가 실제 감소했는지 Cloudflare 계측으로 판정.
- 정상 공개/비공개, 좋아요, 팔로우, Music Note 079, UI는 변경 금지.
- W 잔량의 대부분이 profile derived compatibility journal/state라면, 현재 TEST app124 / PRODUCTION app117 mutation code가 이를 아직 소비하므로 shared trigger를 바로 제거하지 않는다.
- 다음 구조 작업은:
  1) 텍스트+이미지 동시 저장을 한 canonical Profile Save command / 한 D1 point UPDATE로 합치기.
  2) PREVIEW direct targeted R2/edge profile mutation 경로를 TEST까지 승격·검증.
  3) 사용자 명확한 PRODUCTION 승인 후 같은 경로를 PRODUCTION에 승격.
  4) 모든 환경이 legacy `syncDerivedCache032` profile mutation consumer에서 벗어난 뒤에만 profile compatibility journal/state trigger retirement 검토.
  5) cache-canonical parity sampler/diagnostic을 추가해 version staleness를 정량 검증.

## 2026-09-30 — profile shared revision retirement 재실측

완료:
- TEST app124 / PRODUCTION app117 exact Worker source 감사 결과, legacy `readSharedDataRevision031` 호출 0 확인.
- Feed는 derived cursor, 공개프로필은 shared Profile R2/profile revision을 사용.
- dead compatibility trigger `soridraw_shared_rev_public_profiles_au_051` 1개만 제거.
- Verify Run `36646516982` SUCCESS.
- Apply Run `36646618715` SUCCESS.
- Post-migration Audit Run `36646690814` SUCCESS.
- 249 profile triggers / Music Note 079 triggers / main / production unchanged.
- user data rows mutated 0.
- app248 / PREVIEW Worker / Hosting 그대로.

재측정:
1. bio only
2. avatar only
3. avatar + background

직전 기준:
- bio: query R0/W1, physical R6/W9.
- avatar: query R0/W1, physical R8/W10.
- dual media: query R0/W1, physical R8/W10.

판정:
- query W1 유지.
- physical R/W 감소 폭 확인.
- 정상 공개/비공개, 좋아요, 팔로우, Music Note 079, UI는 변경 금지.
- write가 여전히 높으면 profile scope journal / derived state가 현재 direct shared-R2 mutation과 중복인지 먼저 exact source + offline fixture로 확인.
- 중복이 입증되기 전 journal/state를 제거하지 않는다.
- 텍스트+이미지 동시 저장의 단일 canonical Profile Save command는 별도 후속 후보.

## 2026-09-30 — profile trigger compaction 실측

공유 D1 profile trigger source-compaction 적용 완료:
- Verify Run `36643921713` SUCCESS.
- Apply Run `36644010199` SUCCESS.
- Post-migration Audit Run `36644121319` SUCCESS.
- user data rows mutated 0.
- Music Note 079 triggers unchanged.
- shared revision compatibility trigger unchanged.
- app/Worker/Hosting redeploy 없음; app248 그대로 테스트.

재측정:
1. no-op
2. YouTube only
3. bio only
4. avatar only
5. avatar+background

이전 기준:
- bio: query R0/W1, physical R9/W9.
- avatar: query R0/W1, physical R12/W11.
- dual media: query R0/W1, physical R12/W11.

판정:
- query W1 유지.
- physical R/W가 얼마나 내려갔는지 비교.
- 충분히 내려가지 않으면:
  1) profile-update shared revision write가 현재 TEST/PRODUCTION에 실제 필요한지 exact deployed source 기준으로 감사 후 제거 후보화.
  2) 텍스트 + 이미지가 동시에 바뀌는 Save를 단일 profile-save command로 묶어 canonical D1 UPDATE도 1회로 고정.
- 정상 공개/비공개, 좋아요, 팔로우, Music Note 079, UI는 변경 금지.

## 2026-09-30 — app248 실사용 결과 후속

실사용 결과:
- no-op: PASS.
- YouTube only: D1 query R0/W0, physical R0/W0.
- bio only: D1 query R0/W1, physical R9/W9.
- avatar only: D1 query R0/W1, physical R12/W11.
- avatar+background batch: `/v1/me/profile-media` 1 request, D1 query R0/W1, physical R12/W11.

다음 작업:
- query 수는 목표 달성했으므로 더 이상 client/API 요청 수를 건드리지 않는다.
- 다음 비용 대상은 **physical rows**.
- live 079 Music Note 구조를 보호하는 profile-only trigger maintenance 후보를 설계.
- `public_profiles -> explore_derived_profiles -> derived_profile_update/feed -> shared revision` 연쇄를 offline fixture로 계측.
- bio-only / avatar-only 각각 어떤 trigger가 R/W를 만드는지 분리 측정.
- no-op, YouTube, 공개/비공개, 좋아요, 팔로우, Music Note publication 정상 경로 보호.
- shared D1 DROP/CREATE TRIGGER는 사용자 별도 승인 전 실행 금지.

## 2026-09-30 — app248 프로필 비용 재측정

PREVIEW app248 배포 완료:
- Release System Audit `36640127864` SUCCESS.
- Worker Release `36640355943` SUCCESS.
  - active PREVIEW Worker `2d02c2e5-4ea9-4d73-9df5-d467f093d047`.
  - Feed/Profile smoke PASS.
  - warm revision D1 R0/W0 PASS.
  - TEST/PRODUCTION Workers unchanged PASS.
- Firebase PREVIEW Hosting `36640502100` SUCCESS.
  - app version **248**
  - exact build PASS
  - TEST/PRODUCTION unchanged PASS.

실사용 재측정:
1. no-op
2. YouTube only
3. bio only
4. avatar only
5. avatar + background

기대값:
- no-op: D1 R0/W0.
- YouTube: canonical D1 R0/W0.
- bio: D1 query **W1** (app247 W3에서 FTS 2 writes 제거).
- avatar only: D1 query W1.
- avatar+background: **`/v1/me/profile-media` 1개 요청 + D1 query W1** (app247 W2/2 requests 제거).

trigger 주의:
- 기존 `076-derived-trigger-compaction-live033.sql`은 현재 live 상태보다 오래된 후보이므로 적용 금지.
- profile 관련 076 최적화는 이미 live에 들어가 있고, track trigger는 더 최신 079 Music Note compaction 상태.
- physical write가 여전히 높으면 079를 보존하는 새로운 profile-only maintenance 후보를 작성해 검증할 것.
- 이번 app248 배포에서는 shared D1 schema/data 변경 0.

## 2026-09-30 — app247 프로필 비용 2차 최적화

사용자 실측으로 남은 비용 원인 확정:
- no-op: D1 R0/W0 PASS.
- YouTube only: canonical D1 R0/W0 PASS, R2 Class B 1 증가.
- bio only: D1 query R0/W3, physical R12/W11.
- avatar only: D1 query R0/W1, physical R12/W11, R2 A2/B1.
- avatar+background: D1 query R0/W2, physical R21/W19, R2 A4/B2.

다음 작업 순서:
1. bio 저장의 `profile_search_fts` DELETE+INSERT 2회가 현재 요구 검색 범위에 정말 필요한지 확인하고, 불필요하면 warm bio-only W3 → W1 목표로 제거/축소.
2. avatar+background 동시 저장을 한 요청/한 canonical profile UPDATE로 묶어 D1 trigger fan-out 2회 → 1회 목표.
3. 위 코드 최적화 후 PREVIEW 재실측.
4. 그래도 단일 profile UPDATE physical W가 크면 `cloudflare/explore-worker/candidates/076-derived-trigger-compaction-live033.sql`을 별도 shared-D1 schema-maintenance 후보로 진행.
   - live 적용 전 exact trigger DDL/hash read-only 확인.
   - rollback SQL 고정.
   - TEST/PRODUCTION old reader compatibility 검증.
   - DROP/CREATE TRIGGER 작업이므로 사용자 명시 승인 전 실행 금지.

## 2026-09-30 — app247 프로필 저장 비용 실측

- **PREVIEW app247 배포 완료.**
- Firebase PREVIEW Hosting Run `36634768011` SUCCESS.
  - remote app version **247**
  - exact build PASS
  - TEST / PRODUCTION unchanged PASS
- Cloudflare PREVIEW Worker Run `36635851602` SUCCESS.
  - locked source `0cff01db5db5e58392816ca6739548660501f521`
  - active Worker `3b9978ef-83bf-438a-8f86-9320a75f17bb`
  - Feed/Profile smoke PASS
  - warm revision D1 R0/W0 PASS
  - TEST / PRODUCTION Workers unchanged PASS
- 배포 전 오래된 app246 verifier 2곳이 app247 helper/클라이언트 구조를 오탐했으며 둘 다 제품 코드가 아니라 verifier 정합성 문제로 확인.
  - 실패한 두 Run은 Worker deploy 단계 전에 종료되어 live Worker 변경 없음.
  - verifier 최소 정합화 후 Release System Audit Run `36635628280` SUCCESS.
- app247는 warm 프로필 저장의 canonical D1 사전 SELECT 제거, 동일 R2 bundle 재조회 제거, no-op PATCH 제거, 동일 YouTube sidecar PUT 제거.
- 사용자 데이터 migration/backfill 없음. shared D1 schema/trigger 변경 없음.
- main / TEST / PRODUCTION 변경 없음.

PREVIEW 실사용 측정 순서:
1. 아무 값도 바꾸지 않고 저장
2. YouTube만 변경
3. 소개(bio)만 변경
4. 프로필 사진만 변경
5. 배경+프로필 사진 둘 다 변경

목표:
- 1번: 프로필 저장 서버 mutation 0
- 2번: canonical D1 R0/W0
- 3번: warm-path 저장 전 D1 read 0
- 3~5번 physical rows_written 잔량은 기존 shared D1 trigger fan-out과 분리해서 기록
- 이미지 경로는 전체 프로필 rebuild/검색 재생성 금지 유지
- TEST 승격 전 위 5개 PREVIEW 실사용 비용 검증 완료

## 2026-09-30 — app244 공개프로필 소셜 링크 실사용 확인

- 프로필 편집: Spotify / Instagram / TikTok + **YouTube**.
- 공개프로필: 저장된 링크만 프로필 사진 아래 아이콘으로 표시.
- 아이콘 클릭: 외부 사이트 새 탭.
- YouTube는 shared PROFILE_MEDIA R2 additive user-data object로 저장, D1 schema 변경 없음.
- 기존 3개 소셜 링크의 저장 구조는 변경 없음.
- 구버전 앱이 youtubeUrl을 보내지 않아도 기존 YouTube 값 보존.
- 추가 canonical D1 read/write 0.
- Audit source `f2a0e28a3b632d21a91f665169237ee9351cdfdc`.
- Worker trigger `ad98f284a6e7239636ee8b9456c1dacf1b560493`.
- Hosting trigger `6dc83ce32b5cf94bfad738ce1c4baa4e2c9f877e`.
- 현재 연결에서 GitHub Actions push-run/실주소 확인은 미확인.
- 다음: PREVIEW PC/모바일에서 4개 소셜 링크 저장·표시·외부 이동 확인.

## 2026-09-30 — Explore app243 rail 실사용 확인

- PREVIEW source app version **243**.
- 모바일 공개프로필 고정곡 자동 정렬: **0.2초**.
- 다른 모바일 Explore rail 자동 정렬: 기존 **0.5초 유지**.
- 좌우 버튼 직접 클릭: 현재 화면 카드 수만큼 이동.
- short touch drag: 기존 **1곡 이동 유지**.
- strong/long swipe: native momentum 유지.
- app242 버튼 0.5초 자동 숨김 / 카드 터치 2초 표시 유지.
- 추가 서버 read/write 0.
- Audit trigger `a7b4e9387086291118c5baf881d99aee59374428`.
- Hosting trigger `7bd232347c4a2ad9044c72caf128d13d6157103d`.
- 현재 연결에서는 Actions push-run 및 실제 PREVIEW URL을 직접 조회할 수 없어 최종 배포 결과는 미확인.
- 다음: Actions 확인 가능 시 PASS 고정 → PC/모바일 실제 버튼 page-step과 모바일 pinned 0.2초 체감 확인.

## 2026-09-30 — Explore app242 모바일 고정 곡 버튼 자동 숨김 확인

- PREVIEW app242 배포 완료.
- release SHA `840a1b2dfa01c45c967f22d9d27cb07476e1a017`.
- Audit Run `36617652986` SUCCESS / Hosting Run `36617941465` SUCCESS.
- 모바일 공개프로필 고정 곡 rail만 좌우 버튼 자동 숨김 적용.
- 움직임 없음: **0.5초 후 숨김**.
- 카드 영역 터치: **2초간 표시**.
- 스크롤 중 표시 → 스크롤 정지 후 0.5초 뒤 다시 숨김.
- 숨김 상태는 pointer-events none이라 카드/재생 터치를 가리지 않음.
- app241 0.5초 정렬 / short drag exact next / long swipe native / 버튼 exact next/prev / PC 바깥 버튼 유지.
- 추가 서버 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 실기기에서 버튼 숨김/표시 타이밍과 재생버튼 간섭 여부 확인.

## 2026-09-30 — Explore app241 rail 인터랙션 실사용 확인

- PREVIEW app241 배포 완료.
- release SHA `96102aa3ae986116e0e6cba6bc27a10442417ea6`.
- Audit Run `36615605196` SUCCESS / Hosting Run `36615857831` SUCCESS.
- PC 좌우 버튼: 이미지 바깥, 46px, 더 밝은 색.
- 모바일 좌우 버튼: z-index 40, 재생/이퀄라이저보다 위.
- 모바일 자동 정렬: **0.5초**.
- 짧고 가벼운 drag: 정확히 이전/다음 한 곡.
- 길거나 강한 swipe: 기존 native momentum scroll 유지.
- 좌우 버튼 클릭: 실제 카드 위치 기준으로 정확히 인접 곡 이동.
- app240 PC 공개프로필 여백, app239 grid/list, app237 equalizer persistence 유지.
- 추가 서버 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: PC/모바일 실제 rail에서 버튼 위치, exact next/prev, short-drag vs long-swipe 분기 확인.

## 2026-09-30 — Explore app240 1초 정렬 + PC 공개프로필 여백 확인

- PREVIEW app240 배포 완료.
- release SHA `93d1eb91ea404110e5b6be566451c5e5f32f6c45`.
- Audit Run `36613745623` SUCCESS / Hosting Run `36613979353` SUCCESS.
- 모바일 좌우 스크롤 자동 정렬 대기: **2초 → 1초**.
- PC 공개프로필 좌우 padding: `clamp(96px, 10vw, 192px)`.
- 모바일/태블릿 여백은 변경 없음.
- 모바일 고정곡 1개 표시, 전체 곡 Grid/List 전환, 2.8:1 고정 배너, 3분30초 이퀄라이저 상태 유지 기능 변경 없음.
- 추가 서버 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 1초 정렬과 PC 전체화면 좌우 여백 체감 확인.

## 2026-09-30 — Explore app239 공개프로필 그리드/목록 실화면 확인

- PREVIEW app239 배포 완료.
- release SHA `9d2ba43af8fa9fe3ebff2cc46d8ec5cb37129cf7`.
- Audit Run `36612139330` SUCCESS / Hosting Run `36612427307` SUCCESS.
- 모바일 고정 곡: 한 화면 **1곡**, 기존 좌우 rail/버튼/2초 정렬 유지.
- 전체 곡 우측: **그리드 / 목록** 아이콘 버튼 2개.
- 기본값 그리드형이며 기존 카드 배치/반응형 그대로.
- 목록형: 한 줄 1곡, 왼쪽 썸네일 / 오른쪽 장르·제목 / 아래 좋아요·다음곡 적용·공유 / 우측 끝 더보기.
- 목록형에서도 재생/이퀄라이저 및 기존 action 경로 재사용.
- 공개프로필 공개곡 게시자 숨김 / 좋아요 곡 게시자 유지 정책 그대로.
- 추가 Firestore/D1 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 1곡 rail + PC/모바일 그리드/목록 실제 배치 확인.

## 2026-09-30 — Explore app238 PC 공개프로필 여백 확인

- PREVIEW app238 배포 완료.
- release SHA `f7be4d02155ecd7107ffba7182c326ac1dd0a974`.
- Audit Run `36608770923` SUCCESS / Hosting Run `36609010538` SUCCESS.
- PC 공개프로필 좌우 padding을 `clamp(76px, 7.5vw, 144px)`로 확대.
- 기존보다 내부 콘텐츠 폭을 더 좁혀 전체 화면이 덜 꽉 차 보이도록 조정.
- 1100px 이상에서만 적용, 모바일/태블릿은 변경 없음.
- 고정 곡/전체 곡 카드 수 규칙, 2.8:1 배너, 2초 정렬, 3분30초 이퀄라이저 상태 유지 기능 변경 없음.
- 추가 서버 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: PC 전체화면에서 여백 체감 확인.

## 2026-09-30 — Explore app237 이퀄라이저 페이지 이동 유지 확인

- PREVIEW app237 배포 완료.
- release SHA `d7a8cffbb2e41cc34976bbceb62e39d67051d6a4`.
- Audit Run `36607372464` SUCCESS / Hosting Run `36607648045` SUCCESS.
- 재생/이퀄라이저 시각 상태 제한시간: **3분 30초**.
- 다른 앱 페이지로 이동해 Explore가 unmount되어도 세션의 절대 만료시각을 유지.
- 3분30초 안에 Explore/공개프로필 복귀 시 동일 곡의 이퀄라이저 상태 복원.
- 복귀할 때 제한시간을 다시 3분30초로 리셋하지 않고 **남은 시간만** 유지.
- 만료 후 복귀하면 재생 아이콘 상태.
- sessionStorage만 사용하므로 추가 서버 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: Explore ↔ 다른 페이지, 공개프로필 ↔ 다른 페이지 왕복 테스트 및 3분30초 자동 해제 확인.

## 2026-09-30 — Explore app236 고정 곡 2.8:1 + 게시자 표시 분리 실화면 확인

- PREVIEW app236 배포 완료.
- release SHA `31edf7ed5aae2c4da433f265b8af321d74c6aace`.
- Audit Run `36605327404` SUCCESS / Hosting Run `36605630565` SUCCESS.
- 고정 곡 배너: **2.8:1**.
- 오른쪽: 같은 cover 기반 32px blur + 낮춘 opacity/brightness/contrast + 추가 흐림/안개층.
- 왼쪽 원본 이미지는 정사각형 비율 유지.
- 공개프로필 공개 곡: 게시자 아바타/이름 숨김.
- 소유자의 좋아요 곡: 게시자 아바타/이름 유지.
- Feed/추천/최신/인기 게시자 표시는 변경 없음.
- 좌우 rail/버튼, 모바일 2초 정렬, PC 고정3/전체6 반응형 비율 유지.
- 추가 Feed/Profile/Firestore/D1 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: PC/모바일에서 2.8:1 배너 체감, 흐림 강도, 공개곡/좋아요 곡 게시자 표시 차이 확인.

## 2026-09-30 — Explore app235 고정 곡 피처 배너 실화면 확인

- PREVIEW app235 배포 완료.
- release SHA `bdcc9d48249ba065186c7d07de189c1711120de5`.
- Audit Run `36600917384` SUCCESS / Hosting Run `36601180203` SUCCESS.
- 섹션 이름: **고정 곡 / 전체 곡**.
- 고정 곡 카드: 2.2:1 가로 배너.
- 왼쪽: 원본 썸네일 정사각형 유지.
- 오른쪽: 같은 썸네일 기반 블러 색상 확장 + 제목 + 최대 4개 장르/분위기/주제/스타일/사운드 키워드.
- 키워드 추가 서버 조회 0.
- 재생/이퀄라이저 버튼은 왼쪽 원본 이미지 중앙에 비례 배치.
- PC 고정 3 / 전체 6, 반응형 비율, 좌우 스크롤/버튼, 모바일 2초 정렬 유지.
- TEST / PRODUCTION 비변경.
- 다음: PC/모바일 실화면에서 블러 강도, 키워드 가독성, 배너 높이 체감 확인.

## 2026-09-30 — Explore app234 공개프로필 밀도 실화면 확인

- PREVIEW app234 배포 완료.
- release SHA `7a729874ec161fa9091ba7f0fff96670324d5a40`.
- Audit Run `36596760541` SUCCESS / Hosting Run `36597042561` SUCCESS.
- 일반 공개곡 영역 제목: **전체 공개곡** 추가.
- PC 전체화면: 고정곡 3 / 전체 공개곡 6.
- 1600~1799px: 고정곡 3 / 전체 공개곡 5.
- 1100~1599px: 고정곡 2 / 전체 공개곡 4.
- <=1099px: 고정곡 2 / 전체 공개곡 3.
- 홀수 전체 공개곡 열 수는 나누기 2 후 반올림 기준.
- 고정곡 가로 rail / 좌우 버튼 / 모바일 2초 정렬 / 아래 전체 목록 중복 노출 유지.
- 추가 Feed/Profile/Firestore/D1 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: PC 전체화면과 창 축소 구간에서 각 열 수 및 섹션 구분 확인.

## 2026-09-30 — Explore app233 재생/이퀄라이저 버튼 비례 크기 실화면 확인

- PREVIEW app233 배포 완료.
- release SHA `9d9f91b63963f631b6f92acce9ecb57b2176ae5c`.
- Audit Run `36594092596` SUCCESS / Hosting Run `36594376873` SUCCESS.
- 재생/이퀄라이저 버튼은 썸네일 폭 기준 **28%**, 최소 38px / 최대 104px.
- Play 아이콘과 Equalizer도 버튼 내부 비율로 함께 확대/축소.
- 모바일 2-up 카드에서는 더 크게, 3열 카드에서는 더 작게 보이는 것이 의도.
- PC도 카드 폭에 따라 버튼 크기 변화.
- 2초 rail 정렬 / 3분 이퀄라이저 유지 / 고정곡 shared rail / 서버 비용 경로는 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 2-up vs 3열, PC 카드 폭 차이에서 재생/이퀄라이저 크기 비례 체감 확인.

## 2026-09-30 — Explore app232 공개프로필 고정곡 rail 실화면 확인

- PREVIEW app232 배포 완료.
- release SHA `295e122d6ead3a9f09e779f1e049b22db336e848`.
- Audit Run `36592646169` SUCCESS / Hosting Run `36592923107` SUCCESS.
- 공개프로필 고정곡은 모바일/PC 모두 Explore SORIDRAW 추천과 같은 공통 rail 사용.
- 모바일: 2곡, 좌우 버튼, native momentum, 스크롤 정지 후 2초 visible-share 정렬.
- PC: 좌우 버튼 + horizontal scroll.
- 고정곡은 상단 대표 rail과 아래 전체 공개곡 grid 양쪽에 모두 표시.
- 모바일 전체 공개곡 3열 유지.
- PC 공개프로필 좌우 여백 확대.
- 카드 pin badge 제거 유지.
- 추가 Feed/Profile/Firestore/D1 read/write 0.
- Worker/Functions/Rules/사용자 데이터 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일/PC 실제 공개프로필에서 버튼·스크롤·2초 정렬·중복 노출·PC 여백 확인.

## 2026-09-30 — Explore app231 모바일/공개프로필 실화면 확인

- PREVIEW app231 배포 완료.
- release SHA `d5f62d9731fcae0b27ec3600af23b0d343e8fb4a`.
- Audit Run `36588224747` SUCCESS / Hosting Run `36588523044` SUCCESS.
- 모바일 SORIDRAW 추천: 3곡 → **2곡**.
- 모바일 장르별 추천 / 최신 / 인기: **기존 3곡 유지**.
- SORIDRAW 추천 자동 정렬도 2곡 기준으로 계산, 장르별 추천은 기존 3곡 기준 유지.
- 공개프로필 고정곡: 별도 구역 + 모바일 2곡 너비 + 좌우 가로 스크롤.
- 공개프로필 일반 공개곡: 모바일 **3열**.
- 카드 왼쪽 상단 pin badge: 공통 Feed / 공개프로필 모두 제거.
- `profilePinned` 데이터와 공개설정 기능은 그대로 유지.
- 추가 Feed/Profile/Firestore/D1 read/write 0.
- Worker/Functions/Rules/사용자 데이터 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 실기기에서 ① SORIDRAW 추천 2곡 ② 장르별 추천 3곡 ③ 공개프로필 고정곡 horizontal 2-up ④ 일반곡 3열 ⑤ 카드 pin badge 제거 확인.

## 2026-09-29 — Explore app230 실화면 확인

- PREVIEW app230 배포 완료.
- release SHA `fa8981b9e040361f3c3e1153cabf36964ca151cf`.
- Audit Run `36585673687` SUCCESS / Hosting Run `36585958930` SUCCESS.
- 모바일 추천 레일: 스크롤 정지 후 자동 정렬 대기 3초 → **2초**.
- app229의 현재 화면 가시 비중 기반 연속 3곡 선택 방식은 그대로 유지.
- 재생버튼 클릭 후 버튼 내부 이퀄라이저/제목 강조 자동 해제 2분 → **3분**.
- Suno 링크 열기 / 앱 내부 오디오 미사용 / 커버 배경 비클릭 유지.
- Creator 2카드 / 공개프로필 2열 / PC 화살표 / 모바일 native momentum 유지.
- 추가 Feed/Firestore/D1 read/write 0, Worker/Functions/Rules/사용자 데이터 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일에서 2초 정렬 체감 + 재생버튼 시각효과 3분 유지/자동 해제 확인.

## 2026-09-29 — Explore app229 모바일 3곡 가시 비중 정렬 실화면 확인

- PREVIEW app229 배포 완료.
- release SHA `582d991a685a2f9a9c9a1b2cae0bb3d3ae69d14c`.
- Audit Run `36584276062` SUCCESS / Hosting Run `36584692049` SUCCESS.
- app228의 고정 3곡 경계(0/3/6...) 정렬을 제거하고, 현재 화면에서 실제 보이는 카드 비율을 기준으로 **연속 3곡 묶음**을 선택하도록 수정.
- 모바일 native momentum과 스크롤 정지 후 3초 대기는 그대로 유지.
- 두 곡이 완전히 보이고 양옆 카드가 일부 보이면, 부분 노출이 더 큰 쪽 카드를 세 번째 곡으로 포함.
- 같은 가시 비율일 때만 이동 거리가 더 짧은 쪽을 선택.
- Creator 레일 2카드 / 공개프로필 2열 / PC 화살표 / 제목 강조 / 느린 이퀄라이저 / 커버 비클릭 구조 유지.
- 추가 Feed/Firestore/D1 read/write 0, Worker/Functions/Rules/사용자 데이터 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 실기기에서 좌우 부분 카드 노출량을 일부러 다르게 만든 뒤 손을 떼고 3초 기다려, 더 많이 보인 쪽을 포함한 3곡으로 정렬되는지 확인.

## 2026-09-29 — Explore app226 실화면 확인

- PREVIEW app226 배포 완료.
- release SHA `b7891b8b5922987f0e69fde0364dfba022409b6c`.
- Audit `36566167869` SUCCESS / Hosting `36566462070` SUCCESS.
- 재생버튼 클릭 후 제목 accent 복구.
- 버튼 내부 이퀄라이저 속도 완화.
- 모바일/coarse pointer 추천 레일의 card snap 해제 → 브라우저 기본 관성 스크롤 사용.
- 약한 스와이프는 짧게, 강한 플릭은 더 멀리 움직이는 자연스러운 이동을 목표.
- PC 좌우 화살표 스크롤은 기존 유지.
- 커버 배경 비클릭 / 재생버튼만 Suno 링크 / 앱 내부 음원 재생 없음 유지.
- 서버 read/write, Worker, Functions, Rules, 사용자 데이터 변경 없음.
- TEST / PRODUCTION 비변경.
- 다음: 모바일 실기기에서 가로 플릭 강도별 이동량 + 세로/가로 제스처 충돌 여부 + 제목/이퀄라이저 확인.

## 2026-09-29 — Explore app225 재생버튼 UI 실화면 확인

- PREVIEW app225 배포 완료.
- release SHA `48293b7895e5a13de3d6942a50de101a592e2d45`.
- Audit Run `36564555562` attempt 2 SUCCESS / Hosting `36565034660` SUCCESS.
- 커버/배경 클릭은 아무 동작 없음.
- 중앙의 더 큰 재생버튼만 기존 Suno 원본 링크를 연다.
- 링크 실행 후 전체 커버 효과/제목 강조 없음.
- 활성 피드백은 재생버튼 내부 5-bar 이퀄라이저만 표시.
- Pause/일시정지 의미 없음; 다시 누르면 링크를 다시 연다.
- 앱 내부 음원 재생 없음, Feed/Firestore/D1 추가 read/write 0.
- TEST / PRODUCTION 비변경.
- 다음: 사용자 실화면에서 배경 무반응 + 버튼 링크 + 버튼 내부 이퀄라이저 확인.

## 2026-09-29 — Explore app224 재생버튼 링크 동작 실화면 확인

- PREVIEW app224 배포 완료.
- release SHA `b284dc558c356637a564ca1f8206f0a85881871c`.
- Audit `36562762144` SUCCESS / Hosting `36562943756` SUCCESS.
- 중앙 재생버튼은 썸네일과 동일한 Suno 원본 링크를 연다.
- SORIDRAW 내부 실제 음원 재생/GlobalPlayer 사용 없음.
- 앱 내부는 기존 전체-cover 이퀄라이저 + 제목 accent만 로컬 표시.
- 120초 뒤 시각효과 자동 종료.
- Feed/Firestore/D1 추가 read/write 0, backend 변경 0.
- TEST / PRODUCTION 비변경.
- 다음: 사용자 실화면에서 재생버튼 링크 열림 + 복귀 후 이퀄라이저 표시 확인.

## 2026-09-29 — Explore app223 재생 실화면 확인

- PREVIEW app223 배포 완료.
- release SHA `e42856599a4424fc8d948685ebdb7e7524b5a11b`.
- Audit `36555715893` SUCCESS / Hosting `36556008149` SUCCESS.
- 실측 원인 수정: `suno.com/s/...` 공유 페이지 URL을 audio src로 사용하지 않음.
- cover clip UUID → 현재 progressive M4A media URL로 재생.
- 실제 재생 지속 / 다른 곡 전환 / 일시정지 / 120초 자동정지 확인.
- TEST / PRODUCTION 비변경.

## 2026-09-29 — Explore app223 실제 음원 URL 연결 검증

- app222 실화면 FAIL: Suno 공유 페이지 URL을 `<audio>`에 넣어 재생 실패.
- app223: cover UUID → 현재 progressive Suno M4A media URL로 연결.
- share page URL은 audio source로 사용 금지.
- 기존 hover play / active title / full-cover equalizer / 120초 자동정지 유지.
- 기존 썸네일 Suno 열기 / app221 레이아웃 유지.
- Firestore/D1 추가 read/write 0, backend 변경 0.
- Audit PASS 후 PREVIEW app223 Hosting 배포.

## 2026-09-29 — Explore app222 카드 미리듣기 실화면 확인

- PREVIEW app222 배포 완료.
- 최종 Audit Run `36552275054` SUCCESS.
- release SHA `e8c51de1f3370959c2bc25fefe059e05189f74b7`.
- Hosting Run `36552629770` SUCCESS / exact build 222 PASS / TEST·PRODUCTION unchanged.
- hover 중앙 play / 재생 제목 accent / 전체 썸네일 equalizer / 단일 shared audio engine / 120초 자동 정지 적용.
- 기존 cover Suno 열기 경로, app221 추천 레일/장르/크리에이터/최신 8열 보호.
- Explore Feed/Firestore/D1 추가 read/write 0.
- 다음: 사용자 실화면 확인 후 통과/미세조정.

## 2026-09-29 — Explore app221 추천 레일 실화면 확인

- PREVIEW app221 배포 완료.
- Audit Run `36548939226` SUCCESS.
- release SHA `bd7187a0d0921dc043a28476c0daf00a55f3b387`.
- Hosting Run `36549263977` SUCCESS / exact build 221 PASS / TEST·PRODUCTION unchanged.
- 추천 좌우 버튼: 레일 양 끝 카드 위 overlay.
- 장르별 추천: 하나의 카테고리 + 장르 키워드 버튼, 각 장르 최대 20곡.
- 좋아할 만한 크리에이터: 최대 20명, 원형 프로필 가로 레일.
- 최신 8열/PC 액션 버튼 확대 유지.
- 추가 서버 read/write 0.
- 다음: 사용자 실화면 확인 후 통과/미세조정.

## 2026-09-29 — Explore app220 실화면 확인

- PREVIEW app220 배포 완료.
- Audit Run `36546707888` SUCCESS.
- release SHA `956afda38bc14a74b7132b9146c76cf4144805e2`.
- Hosting Run `36547016175` release job SUCCESS / exact build 220 PASS / TEST·PRODUCTION unchanged.
- 최신 Feed: 최대폭 8열, 기존 축소 구간 유지.
- 추천 Feed: 주제별 가로 레일, 최대 20곡/레일, 최대폭 7곡 노출, 좌우 이동 버튼.
- SORIDRAW 추천 + 현재 로드 Feed 기반 장르 추천 레일.
- PC 좋아요/다음곡 적용/공유/더보기 버튼 소폭 확대.
- 추가 서버 read/write 없음. 기존 40곡 Feed를 로컬 재배열.
- 다음: 사용자 PC 실화면 확인 후 통과/미세조정.

## 2026-09-29 — app219 장르 접기 작업 완료

- 사용자 실화면 **PASS**.
- Recent 정상 유지.
- Music Note / Library 장르 접기 버벅임 해결.
- 최종 원인/해결은 실제 split workspace의 불필요한 Genre-card top-height observer 제거.
- PREVIEW app219 / release SHA `ae4b7b4352ca6c080f7bde2bea3b52ca23d25016`.
- Audit Run `36542639632` SUCCESS.
- Hosting Run `36542907430` SUCCESS / exact build PASS / TEST·PRODUCTION unchanged.
- 이 작업은 종료. 다음 사용자 지시 전까지 해당 경로를 정상 기능으로 보호.

## 2026-09-29 — app217 장르 접기 실화면 확인

- PREVIEW app217 배포 완료.
- Hosting Run `36481172026` SUCCESS.
- exact build/version 217 PASS.
- 장르 접기: 전용 180ms 제거, 공통 220ms ease-out 적용.
- 다음 단계: 사용자 실화면에서 장르 펼침 → 접기 동작 확인.

## 2026-09-29 — 장르 접기 공통 모션 수정 배포 대기

- 코드 수정/Audit 완료.
- 장르 전용 180ms 제거 → 5개 키워드 메뉴 공통 220ms ease-out.
- 실제 PREVIEW 배포는 아직 하지 않음.
- 다음 단계: 사용자 배포 요청 시 PREVIEW app217 배포 후 장르 접기 실화면 확인.

## 2026-09-29 — app216 생성바 전환 시점 완료

- 사용자 실화면 PASS.
- 해당 작업 종료.
- 다음 작업부터 app216의 생성바 전환 시점(Builder Compact 820px 기준)을 정상 기능으로 보호.

## 2026-09-29 — app216 생성바 전환 시점 실화면 확인

현재 PREVIEW:
- app216.
- CSS product commit `8c9b1958941d64a491a6144f2bce1acf2c5968bd`.
- final verifier `ab6e12f178f7dd8cdac0de3a614a75f9f4554284`.
- Audit Run `36478899216` SUCCESS.
- release SHA `3bc57669f202c14dd4513b74cb5d937619584dd2`.
- Hosting Run `36479207606` SUCCESS.
- exact build/version 216 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- PC형 생성바를 Builder **820px 초과 구간까지 유지**.
- Builder **820px 이하에서만** 컴팩트 3버튼 생성바로 전환.
- 기존 1080px content-tablet 시점에서는 생성바 디자인을 바꾸지 않음.
- app215 정상 UI / backend 비변경.

확인:
1. 사용자 3번 지점에서 PC형 생성바 유지.
2. 사용자 4번 지점 부근에서 컴팩트 생성바 전환.
3. 좌우 드래그 왕복 시 같은 경계에서 즉시 복귀.
4. app215 검정 여백 / Create scrollbar 정상 유지.

## 2026-09-29 — app215 split 검정 바깥 여백 확인

현재 PREVIEW:
- app215.
- 제품 commit `20f44d312ada0dafa0f0ed094e47f6055f868001`.
- verifier commit `ad7d50fd0240ff164d11d37f4fb978d5d44b2743`.
- Audit Run `36476539692` SUCCESS.
- release SHA `f1f26f1e329d4e6879fc625c2abd97e0d8c39d20`.
- Hosting Run `36476811246` SUCCESS.
- exact build/version 215 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- split common black gutter를 **총 24px / 좌우 12px**로 축소.
- Recent / Music Note / Library 공통.
- Create scrollbar 정상 상태 보호.

확인:
1. 검정 바깥 여백이 줄었는지.
2. 콘텐츠가 넓어졌는지.
3. Create scrollbar / divider / right result pane이 그대로인지.

## 2026-09-29 — app214 분할 Builder 공통 폭 실화면 확인

현재 PREVIEW:
- app214.
- 제품 commit `dd04abd7770538cbce7c5cec3ec112189092baa7`.
- verifier commit `aacb9b9025243ca411a11b4b9aa224114575ef53`.
- Audit Run `36475431369` SUCCESS.
- release SHA `d5eda4381f59ad05486c7420180e4aa80e339710`.
- Hosting Run `36475687256` SUCCESS.
- exact build/version 214 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- split Builder Sori Studio common gutter: **총 72px / 좌우 36px**.
- app213보다 좌우 각각 12px 추가 inset.
- Recent / Music Note / Library 공통 적용.
- Create는 제외하고 app212 정상 scrollbar 위치 보호.

확인:
1. Recent / Music Note / Library 왼쪽 Sori Studio 폭이 동일한지.
2. 원하는 만큼만 좁아졌는지.
3. Create scrollbar / divider / right result pane이 그대로인지.

보호:
- 추가 조정은 공통 72px 값 하나만.
- Create / divider / result pane / backend 수정 금지.

## 2026-09-29 — app213 Recent 왼쪽 Sori Studio 미세 폭 확인

현재 PREVIEW:
- app213.
- 제품 commit `75a2f2b2df0250cb0667247457393d237b7f61e2`.
- verifier commit `a25eca96dd0465ccafc74ecc35a14a74825966da`.
- Audit Run `36473722199` SUCCESS.
- release SHA `60023792fd39e7deed4e971bbe81aad4c17cd88b`.
- Hosting Run `36473972014` SUCCESS.
- exact build/version 213 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- Recent 왼쪽 Sori Studio 총 gutter만 **36px → 48px**.
- 좌우 약 6px씩만 더 안쪽으로 조정.
- app212에서 정상 확인된 Create 우측 스크롤바 위치는 그대로 보호.

확인:
1. Recent 왼쪽 폭이 원하는 정도로 아주 조금 줄었는지.
2. Create scrollbar 및 다른 UI가 그대로인지.

보호:
- 추가 조정은 Recent 48px 값 하나만.
- Create scrollbar / splitter / 다른 페이지 / backend 수정 금지.

## 2026-09-29 — app212 Recent 작은 여백 + Create 스크롤바 경계 확인

현재 PREVIEW:
- app212.
- 제품 commit `44edc1d58a552d2000165233843cab32ce679060`.
- verifier commit `f17944ddaa4ce387ddd96b908e26e0c1c418ef7d`.
- Audit Run `36472030354` SUCCESS.
- release SHA `c08cc53e6928f249f20bb7e84b0387348c3c0fc8`.
- Hosting Run `36472316088` SUCCESS.
- exact build/version 212 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- Recent 왼쪽 Sori Studio 총 gutter: 84px → **36px**.
- Create의 Studio main 오른쪽 18px 바깥 gutter를 해제.
- 같은 18px을 Create scroll shell 내부에 반환하여 내용 폭은 보호하고 스크롤바만 오른쪽 rail 세로선으로 이동.

확인:
1. Recent 왼쪽 여백이 과하지 않은지.
2. Create 세로 스크롤바가 오른쪽 rail 구분선에 붙었는지.
3. Create 내용 폭/위치 및 다른 UI가 그대로인지.

보호:
- 다음 수정이 필요하면 Recent 36px 값 또는 Create 18px scrollbar edge owner만 조정.
- 다른 기능/레이아웃/backend 변경 금지.

## 2026-09-29 — app211 Recent 왼쪽 Sori Studio 실제 폭 확인

현재 PREVIEW:
- app211.
- 제품 commit `397a99209dc726d5390c57c0a0a7b7f143c8a8a7`.
- verifier commit `ccf96aa66bc63818f376ef8a9d51650d118c6b10`.
- Audit Run `36470664449` SUCCESS.
- release SHA `c3d6fb8f57d74dd92e5f0e0ade1806e3aaac6426`.
- Hosting Run `36470912706` SUCCESS.
- exact build/version 211 PASS.
- TEST / PRODUCTION unchanged.

중요:
- app210은 실화면 기준 FAIL. `.soridraw-studio-main`을 Recent Builder 내부 소유자로 잘못 본 selector가 실제 DOM과 맞지 않아 눈에 띄는 폭 변화가 없었음.
- app211은 **Recent Builder pane의 실제 direct masthead + direct content**를 대상으로 바꿈.
- 총 84px 좌우 gutter를 중앙 정렬로 적용.
- Builder pane 자체는 건드리지 않아 scrollbar/divider edge는 그대로 유지.

확인:
1. Recent 왼쪽 Sori Studio 제목/검색/카드가 동일한 좌우 가이드로 줄었는지.
2. scrollbar가 분할 경계에 그대로 붙어 있는지.
3. Create/fullscreen과 다른 페이지가 그대로인지.

보호:
- 추가 조정은 총 gutter `84px` 값만 변경.
- pane/scroll shell/Create main/splitter/다른 페이지 수정 금지.

## 2026-09-29 — app210 최근 생성곡 왼쪽 Sori Studio 폭 실화면 확인

현재 PREVIEW:
- app210.
- 제품 commit `0cb5722224b280e9e0b0836cc7c5b857ed9f4dff`.
- verifier commit `aa9ae4ca1fff8ac3dbe4ab53fa32a5947a52133c`.
- Audit Run `36469134782` SUCCESS.
- release SHA `a4a59dd2ac6eb41740dd0f1bbd3ba4dc1cc6ad7a`.
- Hosting Run `36469430024` SUCCESS.
- exact build/version 210 PASS.
- TEST / PRODUCTION unchanged.

이번 교정:
- app209에서 잘못 적용한 Create outer main 36px padding 제거.
- 실제 요청 화면인 **Recent workspace 왼쪽 Builder 내부 Sori Studio**에만 `width: calc(100% - 36px)`를 적용해 내용 프레임을 중앙에서 좁힘.
- Builder pane/scroll shell/스크롤바/분할선은 이동시키지 않음.
- Recent 오른쪽 결과 12px 여백은 app206 기준 그대로 보존.

확인:
1. 최근 생성곡을 연 분할화면 왼쪽 Sori Studio의 좌우 폭이 원하는 만큼 줄었는지.
2. 같은 화면의 스크롤바/분할 경계가 바깥 원래 위치에 남아 있는지.
3. 일반 Create 화면의 스크롤바가 원래 위치로 복구됐는지.
4. 다른 화면/반응형/UI가 그대로인지.

보호:
- 추가 폭 조정은 이 Recent 왼쪽 Builder inner Sori Studio 규칙의 `36px` 값만 조정.
- pane padding, Create main padding, splitter geometry, responsive breakpoint, Music Note, Library, 모바일, backend/user data 수정 금지.


## 2026-09-29 — app209 Sori Studio outer main 여백 확인

현재 PREVIEW:
- app209.
- CSS 제품 commit `1a9da9b5a691144fd23b6d96bf40e4ee35545415`.
- Audit Run `36467140103` SUCCESS.
- release SHA `903c1df9efffbe70587bdefd2fe47bb140e00b83`.
- Hosting Run `36467416857` SUCCESS.
- exact build/version 209 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. Create에서 `soridraw-studio-main`의 좌우 36px가 실제로 보이는지.
2. Sori Studio 타이틀/카드 전체 시작선과 끝선이 함께 안쪽으로 이동했는지.
3. Recent / Music Note / Library / splitter / mobile 비변경.

보호:
- 추가 조정이 필요하면 Create outer main의 padding 값만 조정.
- inner cards/panes/split engine/backend/user data 수정 금지.


## 2026-09-29 — app208 Sori Studio 실제 pane 여백 확인

현재 PREVIEW:
- app208.
- 제품 commit `99ea161293404f423d7d48652eaefb762ebaa18a`.
- Audit Run `36465184865` SUCCESS.
- release SHA `63cdfc7785b2de2a93f4ccfd5a2f935c9b35909d`.
- Hosting Run `36465508461` SUCCESS.
- exact build/version 208 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. Sori Studio 전체가 실제 pane 기준 좌우 36px 안쪽으로 들어왔는지.
2. 최근 생성곡은 이전 정상 결과 유지.
3. 카드 내부/분할바/반응형/Music Note/Library/모바일 회귀 없음.

보호:
- 추가 조정이 필요하면 Create pane padding 숫자만 미세 조정.
- 그 외 UI/기능/데이터 경로 변경 금지.


## 2026-09-29 — app207 Sori Studio 좌우 여백 2차 확인

현재 PREVIEW:
- app207.
- 제품 commit `ef961573eac1650e62f3397c6590fe7891c01fbb`.
- Audit Run `36463938398` SUCCESS.
- release SHA `5781a0c7f73f153fde363ce4be81d6967d4c9db7`.
- Hosting Run `36464231317` SUCCESS.
- exact build/version 207 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 1100~1599px Sori Studio 좌우 여백이 24px/side로 체감되는지.
2. 최근 생성곡의 app206 결과는 그대로인지.
3. 카드/제목/분할바/반응형/모바일 회귀 없음.

보호:
- 추가 조정이 필요해도 Sori Studio Create의 좌우 간격값만 수정.
- Recent / Music Note / Library / splitter geometry / backend / 사용자 데이터 비변경.
- TEST/PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-29 — app206 분할 좌우 여백 실사용 확인

현재 PREVIEW:
- app206.
- 제품 commit `e6593b158c43f6f742411fb0bf62ebf85bd63d67`.
- Audit Run `36462684857` SUCCESS.
- release SHA `c9d2877aef5c85c59a9afb66b227aabe2c6205c0`.
- Hosting Run `36462976524` SUCCESS.
- exact build/version 206 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 최근 생성곡 좌우 여백이 뮤직노트와 비슷한 호흡으로 보이는지.
2. Sori Studio 전체 폭이 너무 좁아지지 않고 조금만 안쪽으로 들어왔는지.
3. 분할바 드래그/접기·펼침/PC·태블릿 전환 회귀 없음.
4. Music Note / Library / 모바일 / Classic 화면 비변경.

보호:
- 이후 추가 조정도 간격값만 최소 수정.
- splitter geometry / responsive breakpoint / backend / 사용자 데이터 비변경.
- TEST/PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-29 — app205 왼쪽 rail 계정 메뉴 실사용 확인

현재 PREVIEW:
- app205.
- Audit Run `36460283292` SUCCESS.
- Hosting Run `36460751709` SUCCESS.
- release SHA `ad5ccb41761a273e57704b94571e8a5281283c5e`.
- exact build/version 205 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 왼쪽 rail 사용자 더보기에는 `MY 페이지 / 공개 프로필 / 설정 / 로그아웃`만 표시.
2. `관리자메뉴 / 디자인 모드 / 고객지원` 미표시.
3. popup 불투명 및 rail 오른쪽 위치 유지.
4. 상단/모바일 계정 메뉴는 기존 구조 유지.
5. split divider/pane/rail collapse 회귀 없음.

운영:
- 이후 PREVIEW 수정 요청은 별도 제외 지시가 없으면 검증 후 PREVIEW 배포까지 진행.
- TEST/PRODUCTION은 기존 승인 규칙 유지.


## 2026-09-29 — 왼쪽 rail 계정 메뉴 최소화 배포 대기

현재 코드:
- preview 제품 commit `c30cd99078a2a3a2e6fc085a0bf4977261db3803`.
- verifier/최종 HEAD `06aab2ceca6edfcf2dc3c60363ee60c8d11774fc`.
- Audit Run `36460283292` SUCCESS.
- 실제 PREVIEW Hosting은 아직 app204.

배포 후 확인:
1. 분할 왼쪽 프로필 메뉴에 `관리자메뉴` 없음.
2. `디자인 모드 / 모드 변경` 없음.
3. `고객지원 · 준비중` 없음.
4. `MY 페이지 / 공개 프로필 / 설정 / 로그아웃` 정상.
5. 메뉴 불투명/rail 오른쪽 위치 유지.
6. 상단/모바일 계정 메뉴는 기존 구조 그대로.
7. split divider/pane/rail collapse 회귀 없음.

보호:
- 상단/모바일 계정 메뉴 수정 금지.
- Split engine geometry/performance 수정 금지.
- 좋아요 / 공개·비공개 / Explore 데이터 / Music Note / Library / Worker / Functions / Rules / 사용자 데이터 비변경.
- 배포는 사용자 요청 전 금지.


## 2026-09-29 — app204 계정 메뉴 후속 실사용 확인

현재 PREVIEW:
- app204.
- 제품 commit `df4c4d30d0a8e3aa186d4b15137e6ba1d3b943ae`.
- Audit Run `36458259292` SUCCESS.
- release SHA `ae779e1ae214eaf2ed160d5f3fb7552ed9aad040`.
- Hosting Run `36458567924` SUCCESS.
- `preview.soridraw.com` exact build/version 204 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 모든 계정 메뉴 surface가 불투명인지.
2. 분할 왼쪽 계정 메뉴가 rail 아래가 아니라 rail 오른쪽에 열리는지.
3. 분할 왼쪽 `모드 변경`이 별도 submenu 없이 클릭마다 공통 모드 순환인지.
4. app203의 `MY 페이지 / 공개 프로필 / 설정` 및 관리자메뉴/로그아웃 기능 유지.
5. split divider/pane/rail collapse 회귀 없음.

보호:
- 계정 메뉴 surface/위치/모드 클릭 동작 외 UI 수정 금지.
- Split engine geometry/performance path 수정 금지.
- 좋아요 / 공개·비공개 / Explore 데이터 / Music Note / Library / Worker / Functions / Rules / 사용자 데이터 비변경.
- TEST/main 및 PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-29 — app203 계정 메뉴 실사용 확인

현재 PREVIEW:
- app203.
- 제품 commit `d651a37ab8385b7227bf6ca03a0d4425c4ade75d`.
- Audit Run `36455797012` SUCCESS.
- release SHA `10506cef14b9e40c5ec62ebb4d4457c9e7bd1455`.
- Hosting Run `36456114327` SUCCESS.
- `preview.soridraw.com` exact build/version 203 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 모든 계정 메뉴 핵심 순서가 `MY 페이지 / 공개 프로필 / 설정`인지.
2. 공개 프로필 → 현재 로그인 UID의 Explore 공개프로필 직접 이동.
3. 계정 팝업에서 요금제/결제 관리 제거.
4. 다크/모바일/분할 동일 구조, 라이트는 동일 구조 + 밝은 palette.
5. 권한이 있는 계정의 관리자메뉴 및 기존 모드 변경/로그아웃 정상.
6. Split divider/pane/rail collapse 회귀 없음.

보호:
- 마이페이지 내부 요금/결제 기능 자체는 삭제 금지. 이번 요청은 계정 팝업 노출 제거만 해당.
- 공개 프로필 이동을 위해 별도 서버 lookup 추가 금지. 현재 UID direct route 유지.
- 좋아요 / 공개·비공개 / Feed / Music Note / Library / Worker / Functions / Rules / 사용자 데이터 비변경.
- Split engine geometry/performance path 비변경.
- TEST/main 및 PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-29 — app202 계정 메뉴 디자인 공통화 실사용 확인

현재 PREVIEW:
- app202.
- 제품 commit `4cfb46a8f6265804a19cf07431f93d9ae54f43b3`.
- Audit Run `36453452454` SUCCESS.
- release SHA `0702da5f2c16631270269e2024afcdf157518833`.
- Hosting Run `36453841725` SUCCESS.
- `preview.soridraw.com` exact build/version 202 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. PC 다크 상단 우측 계정 메뉴 = 모바일 기준 디자인.
2. 분할모드 왼쪽 계정 메뉴 = 같은 디자인.
3. 라이트 모드 = 같은 geometry + 밝은 palette.
4. 기존 메뉴 동작 전부 유지.
5. 모바일 기존 계정 메뉴 회귀 없음.
6. Split divider/pane/rail collapse 동작 회귀 없음.

보호:
- 계정 메뉴 시각/표시 외 수정 금지.
- 좋아요 / 공개·비공개 / Explore 데이터 / Music Note / Library / Worker / Functions / Rules / 사용자 데이터 비변경.
- Split engine geometry/performance path 비변경.
- 실화면 이상 시 해당 계정 메뉴 class/CSS만 국소 수정.
- TEST/main 및 PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-28 — app201 Explore 제목 구분자 공백 실사용 확인

현재 PREVIEW:
- app201.
- 제품 commit `d57d232295ae26cb3806e13db33f667c78ce3cec`.
- Audit Run `36441371904` SUCCESS.
- release SHA `1c617201f5ba96b44795462b9046b0c4b98c3b0a`.
- Hosting Run `36441712032` SUCCESS.
- `preview.soridraw.com` exact build/version 201 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 이중언어 제목이 `한글제목 | 외국어제목`으로 보이는지.
2. 단독언어 제목은 `제목`만 보이는지.
3. 장르/카드/좋아요/공유/더보기 기존 상태 유지.

보호:
- 원본 title 데이터 및 백엔드 비변경.
- 제목 표시 helper 외 수정 금지.
- TEST/main 및 PRODUCTION 승격은 별도 승인 전 금지.


## 2026-09-28 — app200 Explore 제목 표시 실사용 확인

현재 PREVIEW:
- app200.
- 제품 commit `30dfe92e74414e5da66fd148b6f1ebebfd168771`.
- Audit Run `36435743493` SUCCESS.
- release SHA `a32306d6b92f0e59469b2d7432ffe814a1488642`.
- Hosting Run `36436054767` SUCCESS.
- `preview.soridraw.com` exact build/version 200 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. `'한글제목' | '외국어제목'` 형태의 원본이 카드에서는 `한글제목|외국어제목`으로 보이는지.
2. `'제목'` 원본은 `제목`으로 보이는지.
3. 제목 내부 apostrophe는 유지되는지.
4. 장르 줄 / 카드 높이 / 줄임표 / 좋아요 / 공유 / 더보기는 기존 그대로인지.
5. 추천 / 최신 / 인기 / 공개프로필 동일 표시인지.

보호:
- 원본 title 데이터 수정 금지.
- 좋아요 / 공개·비공개 / 프로필 / Music Note / Library / Worker / Functions / Rules 비변경.
- 제목 표시 외 CSS/레이아웃 변경 금지.
- 이상이 있으면 `getExploreCardDisplayTitle` 표시 경로만 국소 수정.
- TEST/main 및 PRODUCTION 승격은 별도 명시 승인 전 금지.


## 2026-09-28 — app199 CACHE LIVE 실사용 확인

현재 PREVIEW:
- app199.
- 제품 commit `73c433f64ce412a1544da16310361f8d3174daf1`.
- 최종 Audit Run `36416514198` SUCCESS.
- locked release SHA `0506bf31c1c13a7885b092f227a0eafc14d5aa03`.
- Hosting Run `36416783773` SUCCESS.
- `preview.soridraw.com` exact build/version 199 PASS.
- TEST / PRODUCTION unchanged.

이번 변경:
- 실제 app version upgrade 첫 실행에 진단용 sessionStorage만 자동 초기화.
- 제품 cache/local user data는 유지.
- CACHE LIVE를 `이번 실행 진단`과 `실제 서버 지표`로 명확히 구분.
- Social Snapshot은 `개인 소셜 스냅샷` 표시.
- 상단 `서버 ↻ / 초기화 / 접기` 정리.
- 수동 초기화에 PAGE SYNC 포함.

사용자 확인:
1. app199 적용 직후 이전 앱의 Cloudflare/D1 진단 수치가 남지 않는지.
2. 실제 새 요청이 없으면 개인 소셜 스냅샷 R값이 새로 생기지 않는지.
3. 상단 초기화가 이번 실행 진단을 모두 0 기준으로 만드는지.
4. 서버 ↻가 실제 Firestore 서버 지표만 갱신하는지.

보호:
- 좋아요 / 팔로우 / Social Snapshot product cache / Explore Feed / 공개프로필 / 공개·비공개 / Music Note / Library / Worker / Functions / Rules / 사용자 데이터 수정 금지.
- CACHE LIVE 실사용 이상이 있으면 진단 UI/진단 저장소만 국소 수정.
- TEST/main 및 PRODUCTION 승격은 별도 명시 승인 전 금지.


## 2026-09-28 — app198 Explore 상단 가로줄 실사용 PASS / 다음 요청 대기

완료:
- PREVIEW app198.
- 제품 fix commit `cb32cb637d05968741ee72ce561056aedbc00510`.
- 감사 Run `36334556580` SUCCESS.
- release source `1f9018b287a8cd1d07f7b255e243c2a042f6d7c4`.
- Hosting Run `36334670982` SUCCESS.
- `preview.soridraw.com` exact build/version 198 PASS.
- 사용자 실화면 확인: **Explore 상단 가로줄 제거 PASS**.
- TEST / PRODUCTION unchanged.

보호:
- Explore 외 다른 UI/CSS, 좋아요, 프로필, 공개·비공개, Music Note, Worker, Functions, Rules, 데이터 구조는 이번 수정에서 변경하지 않음.
- app198 divider 작업은 종료. 재발 증거 없이 다시 수정하지 않음.

다음:
- 사용자 다음 지시 대기.
- 기존 예정 후보는 추천 / 최신 / 인기 탭 UI 정리이지만, 구체 수정은 사용자 지시 후 진행.
- 현재 비용/캐시/좋아요/공개상태 경로는 UI 작업과 분리해 보호.
- TEST/main 및 PRODUCTION 승격은 별도 명시 승인 전 금지.


## 2026-09-28 — app196 공개프로필 + Explore Feed avatar 공통 확인

현재 PREVIEW:
- app196.
- 제품 commit `5b29438f8449ad4be4f0cdf019decbb0073aa122`.
- live parity Run `36332286972` SUCCESS: latest/popular Feed ↔ public profile avatar mismatch 0.
- Audit Run `36332498660` SUCCESS.
- release source `1b9e1f610d5de104f167cd509aa8235aea636681`.
- Hosting Run `36332606501` SUCCESS.
- exact build/version 196 PASS.
- TEST / PRODUCTION unchanged.

확인:
1. 공개프로필의 공개곡 카드 4개 작은 게시자 사진 = astronaut.
2. Explore 추천/최신/인기에서 같은 SORiDRAW 곡 카드 게시자 사진 = astronaut.
3. 상단/왼쪽 rail/마이페이지/큰 공개프로필 사진은 app194 정상 상태 유지.

구조 기준:
- 공개프로필과 Feed 카드 avatar는 이제 같은 client resolver를 사용.
- 공개프로필 custom photo > Google fallback 규칙 유지.
- 서버 Feed 최신/인기 projection 자체도 현재 public profile과 일치.
- 추가 서버 read/write로 해결하지 않는다.

보호:
- 좋아요 / 공개·비공개 / Music Note / Worker / Functions / Rules / UI·CSS 비변경.

통과 후 다음 작업 진행.
TEST/main 및 PRODUCTION 승격은 별도 명시 승인 전 금지.


## 2026-09-28 — app195 공개곡 카드 avatar 실사용 확인

현재 PREVIEW:
- app195.
- 제품 수정: `5a3be6344aad9c8c61b50a542c648ee2fc44d4db`.
- Audit Run `36331214522` SUCCESS.
- release source `634031ac6f34ed8f21039494b3c32b7e2de1960e`.
- Hosting Run `36331327554` SUCCESS.
- `preview.soridraw.com` exact build/version 195 PASS.
- TEST / PRODUCTION unchanged.

확인할 것:
- 공개프로필의 공개곡 카드에 보이는 작은 게시자 사진 4개가 공개프로필 큰 사진과 동일한지.
- 현재 Master `@soridraw`는 모두 astronaut 사진이면 PASS.

보호:
- app194에서 정상 확인된 상단 계정칩 / 왼쪽 rail / 마이페이지 / 공개프로필 큰 사진은 수정 금지.
- Feed 일반 카드 / 좋아요 / 공개·비공개 / Music Note / Worker / Functions / Rules / UI·CSS 비변경.
- 서버 IO를 추가해서 해결하지 않는다.

통과 후 사용자 요청에 따라 다음 작업 진행.
TEST/main 및 PRODUCTION 승격은 별도 명시 승인 전 금지.


## 2026-09-28 — app194 전역 프로필 사진 authority 실사용 확인

현재 제품 작업은 완료 상태. 사용자 실화면 확인 전 avatar 외 범위 수정 금지.

기준:
- PREVIEW app194.
- release source `706eeb02c3fa43b083a5ae666962a34e50702c5c`.
- Hosting Run `36330817827` SUCCESS.
- global avatar rule: SORIDRAW 공개프로필 custom photo > Google provider photo > Auth fallback.
- 기존 public profile 3계정 Firebase Auth photoURL 정합화 완료: Run `36330458671` SUCCESS, W3.
- Firestore/D1 content write 0, Worker/Functions/Rules 비변경.

사용자 확인:
1. 상단 오른쪽 계정칩.
2. Studio/Explore 왼쪽 rail.
3. 마이페이지.
4. Explore 게시자 카드.
5. 공개프로필.
현재 Master `@soridraw`는 위 모든 위치가 astronaut 사진이면 PASS.

이상이 있으면 해당 표시 경로만 수정하고 좋아요/공개·비공개/Music Note 저장/비용 구조는 건드리지 않는다.

통과 후 기존 예정 작업인 추천 / 최신 / 인기 탭 UI 수정으로 진행.
TEST/main 및 PRODUCTION 승격은 사용자 별도 명시 승인 필요.


## 2026-09-28 — app193 게시자 프로필 사진 수정 후 다음 작업

현재 제품 작업은 완료 상태. 새 코드 수정 전에 사용자 실화면 확인을 기다린다.

기준:
- PREVIEW app193.
- release source `484c514dc2a0138a69d2417149fd96f80e391fe1`.
- Hosting Run `36329114664` SUCCESS.
- SORiDRAW Feed ↔ 공개프로필 avatar mismatch 0.
- 다른 공개 사용자 2명도 정상.
- profile save 직후 same-session owner card/local cache targeted patch 적용.
- 좋아요 / 공개·비공개 / Music Note 60초 저장 / Worker canonical 경로는 보호.

사용자 확인:
1. PC Explore Feed의 SORiDRAW 게시자 사진이 공개프로필 사진과 동일한지.
2. 모바일도 동일한지.
3. 이상 없으면 이 작업 종료.

그 다음 예정 작업:
- 사용자가 이전에 요청한 추천 / 최신 / 인기 탭 UI 수정.
- 구체 UI 수정 전 현재 탭 기능/비용 경로는 건드리지 않는다.

TEST/main 및 PRODUCTION 승격 금지 — 사용자 별도 명시 승인 필요.


## 다음 작업 기준 · app192 메뉴 설정 실사용 확인 후 Explore 탭 UI (2026-09-27 KST)

현재 PREVIEW:
- app **192**
- 제품 commit `a6a030a3067faca3cf662af69372563d83ed7b3e`
- Audit Run **36323892369 SUCCESS**
- 최종 PREVIEW Release Run **36326740832 SUCCESS**
- 신규 Function `adminSetNavigationVisibility` ACTIVE.
- shared RTDB `publicSync/navigationVisibility` Rules + live mirror PASS.
- `preview.soridraw.com` exact build/version 192 PASS.
- TEST / PRODUCTION code+Hosting unchanged.

다음 실사용:
- 관리자에서 메뉴 1개 숨김 → 다른 로그인 사용자 기기에서 새로고침 없이 사라짐 확인.
- 직접 URL 차단 확인. Explore `/explore` 포함.
- 전체공개 복원 시 메뉴 자동 복구 확인.
- 이상 시 navigation 설정 경로만 수정하고 좋아요/Explore Feed/공개상태/Music Note/UI는 건드리지 않는다.

실사용 통과 후:
- 사용자 요청대로 추천 / 최신 / 인기 탭 UI 수정 범위를 별도 작업으로 진행.
- TEST 승격은 사용자 명시 요청 전 금지.


## 다음 작업 기준 · app192 관리자 메뉴 동기화 실사용 확인 → Explore 탭 UI (2026-09-27 KST)

현재 PREVIEW:
- app version **192**.
- 제품 commit `a6a030a3067faca3cf662af69372563d83ed7b3e`.
- Audit Run **36323892369 SUCCESS**.
- 최초 release Run `36324094095`은 신규 Function 생성은 성공했으나 Firebase CLI의 Artifact cleanup policy 후처리 요구로 exit 1; Hosting 전 중단.
- cleanup policy를 건드리지 않고 안전 재개 Run **36324350280 SUCCESS**.
- `adminSetNavigationVisibility` ACTIVE, 기존 Functions 재배포 0.
- shared RTDB navigation rules exact match PASS + current Firestore authority 기준 mirror seed PASS.
- PREVIEW Hosting app192 / exact build PASS.
- TEST / PRODUCTION code+Hosting unchanged PASS.

사용자 실사용 확인:
- 관리자에서 메뉴 하나 `숨김` → 이미 로그인된 다른 일반 사용자 PC/모바일에서 자동으로 메뉴가 사라지는지.
- 해당 direct URL도 차단되는지. Explore는 `/explore` 직접주소 확인.
- 다시 `전체공개` → 다른 기기에서 자동 복구되는지.
- 정상 캐시 사용자의 Firestore navigation read는 0 목표. 이 기능 때문에 페이지 이동 Firestore read를 추가하면 안 됨.

보호:
- Like / Explore Feed / 공개·비공개 / 공개프로필 / Music Note 60초 저장 / UI·CSS 비변경.
- Worker / D1 / schema / 사용자 원본 데이터 비변경.
- 새 navigation RTDB payload 외 다른 RTDB path 변경 금지.
- TEST/PRODUCTION 승격은 사용자 명시 승인 전 금지.

통과 후:
- 사용자 요청대로 추천 / 최신 / 인기 탭 UI 수정.
- UI 수정은 현재 비용/캐시/좋아요/공개상태 경로를 건드리지 않는 범위로 진행.


## 다음 우선 확인 · 관리자 상단 메뉴 공통설정 전파/Explore route gate (2026-09-27 KST)

- app191 Explore 더보기 캐시 실사용: **PASS**.
- read-only 감사에서 상단 메뉴 설정의 두 gap 확인:
  - navigation visibility local cache가 무기한 fresh라 다른 사용자/기기의 기존 cache에 관리자 변경이 자동 전파되지 않음.
  - `/explore` route만 `canAccessNavigationMenu('explore')` 직접 URL gate가 누락.
- 사용자 승인 없이 아직 수정/배포하지 않음.
- 수정한다면 Firestore onSnapshot/polling/앱 시작 반복 read는 금지. 기존 비용 목표를 유지하면서 작은 변경 신호 + 변경 시 1회 설정 갱신만 허용.
- 다른 정상 메뉴/권한/UI/좋아요/Explore Feed/Music Note 저장 로직 비변경.
- 이후 예정: 추천/최신/인기 탭 UI 수정.


## 다음 작업 기준 · app191 Explore 더 보기 캐시 실사용 확인 후 UI 작업 (2026-09-27 KST)

현재 PREVIEW:
- app version: **191**
- 제품 코드 기준: `580401461b9960b8313e8731c9f1ae84d3cdbf2f`
- Audit Run: **36301191752 SUCCESS**
- PREVIEW Hosting Run: **36301310221 SUCCESS**
- 실제 `preview.soridraw.com` exact build PASS.
- TEST / PRODUCTION unchanged PASS.

지금 확인할 것:
- 첫 `더 보기`: 기존 bounded D1 read 허용.
- 120초 안에 같은 cursor page 재진입: **LOCAL cache / Worker 0 / D1 R0 / W0 목표**.
- 공개/비공개 mutation 후에는 정확성을 위해 더보기 캐시가 무효화되어 다음 요청은 다시 bounded read가 정상.
- 모바일/PC 동일 경로.

보호:
- 좋아요, 공개/비공개 canonical 구조, Music Note 60초 저장, Explore UI/CSS는 이번 작업에서 변경하지 않는다.
- Worker / Functions / Rules / D1 schema / 사용자 원본 데이터 변경 금지.
- TEST/PRODUCTION 승격은 사용자 명시 요청 전 금지.

실사용 통과 후 다음 후보:
- 사용자가 요청한 추천 / 최신 / 인기 탭 UI 정리.
- UI 수정은 현재 비용 경로와 캐시 동작을 건드리지 않는 범위로 진행.


## 최신 2026-09-27 — PC 공개프로필 ↔ Explore 공개곡 parity 근본 수정/복구 완료, 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0HP` 최우선.
- read-only 진단으로 canonical D1 공개곡 2 + Explore Feed 2는 일치하지만 shared public-profile만 stale 1곡임을 확정.
- 사용자 공개상태 원본은 정상이며 기존 공개곡 2곡 그대로 유지.
- Worker patch 091: publication profile delta 시 shared public-profile R2 한 객체를 직접 CAS patch. local profile 존재 여부에 의존하지 않음.
- owner-wide D1 scan / 전체 profile rebuild / 전체 Feed rebuild 없음.
- canonical worker commit `25e0c7aae169175150b1fe6335342b0b9f8bafaf`, SHA256 `0c757410bf0d5c3ca4d2e10a2d6e369dbed13d099f7d29e34b16d12ba13e4c80`.
- Audit Run `36263833075` SUCCESS.
- PREVIEW Worker Release Run `36264560008` SUCCESS, active version `1426a087-9973-4b72-ba06-1904901a8693`, Feed/Profile smoke PASS, TEST/PRODUCTION unchanged.
- 기존 stale shared profile은 대상 UID 한 객체만 bounded repair. Run `36264652374` SUCCESS.
- repair 후 실제 PREVIEW public-profile endpoint `count=2`, canonical exact IDs parity PASS.
- D1 write 0 / Firestore write 0 / user origin data unchanged.
- app190 Hosting은 그대로. UI/좋아요/Music Note 저장/다른 정상 기능 비변경.
- 다음은 사용자 PC 실사용에서 공개프로필 2곡 + Explore Feed 동일 2곡 확인.
- 실패 시 해당 profile/track만 bounded 추적. 좋아요/전체 cache/전체 데이터는 수정 금지.
- TEST/main 승격 및 PRODUCTION 승격 금지(별도 명시 승인 필요).


## 최신 2026-09-27 — app190 PREVIEW PC cross-device 공개상태 reload 수렴 배포 완료, 사용자 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0HO` 최우선.
- 모바일은 정상, PC만 이전 공개 Feed/profile cache가 남고 브라우저 reload도 1분 local gate 때문에 즉시 서버 revision을 확인하지 못하던 문제를 수정.
- 제품 commit `0b0e35513d53023e9c7c7e54780005e8c744b988`.
- Feed: 일반 navigation의 1분 cache는 그대로 두고, **명시적 browser reload 최초 1회만** cached feed-revision을 우회해 작은 revision check 수행.
- Profile: 일반 warm revisit의 60초 gate 유지, **browser reload 최초 1회만** conditional shared-R2/edge revalidation 강제.
- cache schema bump 없음, 전체 Feed/Profile cache 삭제 없음, D1/Firestore user data read/write/migration 추가 없음.
- verifier `scripts/verify-211-cross-device-publication-refresh.mjs` 추가.
- Audit Run `36261937077` SUCCESS.
- PREVIEW app190 Hosting Run `36262078273` SUCCESS, release SHA `9116d2bcf0981ab55e35f1fe34663c572c5a9138`, exact build/version 190 PASS.
- Worker/Functions/Rules 비변경, TEST/PRODUCTION unchanged PASS.
- 다음 사용자 테스트: 모바일에서 공개/비공개 변경 → PC Explore에서 새로고침 1회 → Feed와 공개프로필 목록 즉시 수렴 확인.
- 실패 시 해당 track/PC local cache만 bounded 추적. 좋아요/app164 frozen path, Worker canonical, Music Note 60초 저장은 수정 금지.


## 최신 2026-09-27 — app189 PREVIEW 공개/비공개 기준 단일화 배포 완료, 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0HN` 최우선.
- 공개상태 authority는 D1 `tracks.is_public=1 AND status='published'` 하나만 사용.
- Music Note와 Explore `... > 공개 설정`은 동일 `explorePublicationService` 경로에서 mutation 직후 즉시 server flush/confirmed state까지 완료.
- publication mutation 성공 시 local profile R2를 해당 UID의 shared profile R2로 targeted mirror. 전체 Feed/전체 profile rebuild 및 owner-wide D1 scan 없음.
- 수정 전 read-only 감사: canonical 총 30 / 공개 1 / 비공개 29, shared profile 20 mismatch 확인.
- 기존 stale profile projection은 현재 계정에 한해 bounded repair 완료. Run `36256280239` SUCCESS, D1 W0, canonical user data unchanged, shared/local profile parity count=1 PASS.
- 제품 client commit `47cbc3b1ec16ccbfd71b06310c780f634104c358`.
- Worker product commit `4c0168f090ae38dee62bc03cade963f43fa8ffb1`; replay patch commit `d267579c7f485258ab319d950aa703a9ae2a139c`.
- final Audit Run `36256030601` SUCCESS: TypeScript/Build/Like regression/TEST·PRODUCTION dry-run/shared D1 read-only PASS.
- PREVIEW Worker Run `36256171288` SUCCESS, active version `ebb182bd-921f-4945-88a7-3788eb38ac58`.
- PREVIEW app189 Hosting Run `36256356574` SUCCESS, exact build/version 189 PASS, TEST/PRODUCTION unchanged.
- post-repair diagnostic Run `36256539809`은 temp workflow 파일 준비 오류로 FAIL한 tooling-only 결과이며 제품 판단에 사용 금지.
- 이번 작업의 일회성 temp 진단/복구 Workflow 4개는 완료 후 삭제됨. 다음 작업에서 재사용/누적 금지.
- 다음은 사용자 실사용만: (1) Music Note 공개→Explore+공개프로필 표시, (2) 비공개→양쪽 즉시 제거, (3) Explore 더보기 공개설정에서도 동일 결과.
- 실패 시 해당 track 하나만 bounded 확인. 전체 백필/전체 재생성/좋아요 변경 금지.
- PC/모바일 실기기 검증 전. TEST/main 승격 전, PRODUCTION 비변경.

## 최신 2026-09-26 — 퇴근길의 상상 장르 누락 PREVIEW 복구 완료, 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0HM` 최우선.
- 원인: Firestore Music Note 원본은 `genre=Jazz Ballad` 정상인데, 해당 legacy Explore canonical row만 `primary_genre=NULL`/share schema 0이었고 shared R2에도 오래된 null card가 남아 있었음.
- Worker public card serialization에 `primaryGenre` 누락도 수정.
- Worker product commit `511353d0fb4cfeda17174572654e22ce0580925d`, source lock `665b940f54cf153d8486d40609ba76b5ceeca9f3`.
- Audit Run `36246428324` SUCCESS.
- PREVIEW Worker Release Run `36246541900` SUCCESS, active version `c77017af-5cac-4274-b424-616885a24ea3`, TEST/PRODUCTION Workers unchanged.
- 대상 exact track 1행만 `primary_genre=Jazz Ballad`로 복구. 전체 백필/대량변환 없음.
- shared latest/popular/profile/track-card도 같은 exact card만 bounded repair.
- final shared repair Run `36249067564` SUCCESS: canonical/derived PASS, latest/popular/profile/card R2 patch PASS, 실제 PREVIEW latest/popular R2에서 `Jazz Ballad` PASS.
- Firebase Hosting은 app188 그대로. 클라이언트 코드는 이미 primaryGenre 표시 지원하므로 불필요한 Hosting 재배포 없음.
- 다음은 사용자 화면에서 `퇴근길의 상상` 위에 `[Jazz Ballad]`가 보이는지만 확인.
- 정상 Explore 좋아요/app184 settlement/다른 곡 데이터는 수정 금지.
- TEST/main 및 PRODUCTION 승격은 별도 명시 승인 필요.

## 최신 2026-09-26 — app188 PREVIEW Explore 게시자/액션 간격 배포 완료, 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0HL` 최우선.
- Explore 카드 게시자 avatar 23px→22px.
- 게시자 줄과 액션 줄 사이 공간은 액션 상단 padding 6px→4px로 2px만 축소.
- 제목/장르/게시자 이름 크기와 좋아요/다음곡 적용/공유/더보기 기능은 그대로.
- 제품 commit `1feef6b342439455a28ca35f9b676d1060c1351d`; Audit Run `36245154425` SUCCESS.
- PREVIEW app188 Hosting Run `36245325996` SUCCESS, locked SHA `6f96deee253d3ed28dd698b528758792393184ed`, exact build/version 188 PASS, TEST/PRODUCTION unchanged.
- Worker/Functions/Rules/사용자 데이터/새 서버 read-write 없음.
- 다음은 모바일/PC에서 간격과 avatar 크기만 시각 확인. 이상 시 Explore CSS만 국소 수정.

## 최신 2026-09-26 — Music Note / Library 검색 UX 후보 감사 완료, PREVIEW 배포 전

- `CURRENT_RELEASE_STATE.md 0HE` 최우선.
- Music Note + Library 검색창에 값이 있을 때 오른쪽 X 삭제 버튼 추가.
- 검색어는 sessionStorage 기반 UI 상태로만 보존하여 다른 페이지 왕복 후 복원. 서버/Firestore/D1 read-write 추가 없음.
- Library workspace/playlist 검색어는 각각 독립 보존.
- 모바일 검색은 focus 또는 검색어 존재 시 `is-search-active`로 기존보다 길게 확장하고, 검색어가 남아 있으면 page 왕복 후에도 길어진 상태 유지.
- X 클릭은 검색어 삭제 + focus 해제로 즉시 compact 상태 복귀. 빈 검색창은 다른 곳 클릭(blur) 시 기존 42px 상태 복귀.
- Release System Audit Run `36215674344` SUCCESS. TypeScript/Build/APP209/기존 Like 회귀/Worker dry-run/shared D1 read-only PASS.
- 현재 preview 후보 HEAD는 문서 갱신 commit까지 포함해 최신 확인 필요. 제품 기준 candidate audit head는 `f29cf9d8066a270481bf7767ea450777e7cd7972`.
- **아직 Hosting 배포 전**. app182 배포본 유지. 사용자 명시 PREVIEW 배포 요청 시 app183 bump + Hosting only 배포.
- 다음 실사용 확인: 모바일 Music Note/Library 각각 (1) 검색 버튼 확장 폭, (2) 입력 후 타 페이지 왕복 유지, (3) X 즉시 삭제/축소, (4) 빈 검색 blur 축소, (5) Library workspace/playlist 검색 독립 유지.
- Music Note 60초 저장/좋아요/Gemini/Explore/Worker/Functions는 이번 범위에서 수정 금지.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app182 PREVIEW 배포 완료, Gemini 호출 효율 실사용 1곡 검증

- `CURRENT_RELEASE_STATE.md 0HB` 최우선.
- PREVIEW app182 Hosting Run `36173906888` SUCCESS, deployed SHA `056f3e06be069db2f72d75d8ea24075a1c3e2fe7`, TypeScript/Build/version 182/exact build PASS, TEST/PRODUCTION unchanged PASS.
- 최초 곡 생성 체인/프롬프트/가사/5단/금지어 품질 규칙은 변경 없음.
- 작은 후처리 5 context만 adaptive route: 같은 곡에서 실패한 모델 재호출 금지, 30초 이상 걸린 성공 모델 우선 생략, 빠른 성공 모델은 후보에 있으면 우선 가능.
- 작은 후처리 후보는 `3.5 → 3.5-lite → 3.1-lite`; 모든 후보가 제외되면 기능 보호를 위해 원래 후보 복구.
- 서버에 새 상태를 저장하지 않고 20분 탭 메모리만 사용. Firestore/D1/Worker/Functions/user data read/write 추가 없음.
- APP208 + Release System Audit `36173411132`, final Audit `36173669413` SUCCESS.
- 다음은 PREVIEW 일반 V1 1곡 **1회만** 생성해 관리자 Gemini 기록에서 총 호출수/처리시간/모델 순서/token을 app181 실사용 기준 5회·2분11초와 비교. provider 503 자체를 해결했다고 가정하지 않는다.
- 실사용 결과가 좋아도 바로 프롬프트 압축/모델 순서 대수술로 확장하지 않는다. 초기 26K대 prompt 비용은 별도 2단계 분석에서 품질 불변 근거가 있을 때만 다룬다.
- 사용자 제보 없는 좋아요 app164/Worker195, 최근곡 동기화, 분할 UI, Music Note 60초 저장은 수정 금지.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app181 PREVIEW 배포 완료, 오른쪽 최근곡 메타 고정/가시폭 확인

- `CURRENT_RELEASE_STATE.md 0HA` 최우선.
- PREVIEW app181 Firebase Hosting Run `36169548430` SUCCESS, deployed SHA `6651978c79a0a73a680a4197ceaa053ab273f91f`, TypeScript/Build/exact build/version 181 PASS, TEST/PRODUCTION unchanged PASS.
- 오른쪽 Recent Songs는 `[장르] 생성시간` 고정 메타 + 제목 전용 가로 drag/scroll 구조.
- 장르/시간 gap 4px. 제목을 좌우 이동해도 메타는 움직이지 않음.
- Recent Songs 목록만 카드 좌우 공간을 6px 더 사용하고 row 좌우 padding 3px / icon-text gap 5px로 조정해 glyph는 더 왼쪽, chevron은 더 오른쪽, 제목 가시 폭은 증가.
- 오른쪽 rail 전체 폭/위치, 최근곡 클릭, 즐겨찾기/새곡 상태, 캐시/백엔드/데이터는 변경 없음.
- 다음은 사용자 실사용 시각 검증만 진행. 이상이 있으면 Recent Songs row spacing/title scroll만 국소 수정하고 rail 폭/분할 엔진/데이터 경로는 건드리지 않는다.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app178 PREVIEW 배포 완료, 오른쪽 rail 가독성 + Library 연동 크레딧 확인

- `CURRENT_RELEASE_STATE.md 0GY` 최우선.
- PREVIEW app178 Firebase Hosting Run `36167329008` SUCCESS, deployed SHA `4c04bf5c926fb53000926ab9abba5b45be5d9fc4`, TypeScript/Build/exact build/version 178 PASS, TEST/PRODUCTION unchanged PASS.
- 오른쪽 Studio rail의 폭/위치/스크롤은 유지하고 Generation / Recent Songs / Music API / Selected Keywords 텍스트만 확대.
- 최근곡 제목/시간, 캐시 진단, 생성 상태/설명, 지표, 버튼, 키워드/카운트까지 가독성 확대. 기능/백엔드 경로 변경 없음.
- `StudioRightRail.showMusicApiCredits`는 기존 raw `menuVisibility.library`를 그대로 사용. Library=숨김일 때만 `MUSIC API / 남은 크레딧` section 미렌더, 전체공개/관리자만은 기존 표시.
- 새 서버 read/write, Worker/Functions/Rules/D1/Firestore/user data 변경 없음.
- 다음은 사용자 실사용에서 오른쪽 rail 폰트 크기와 Library 숨김/표시 3상태만 확인. 이상이 있으면 right rail typography/visibility만 국소 수정하고 분할 엔진/최근곡/Library 데이터 경로는 건드리지 않는다.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app175 PREVIEW 배포 완료, Library 숨김/Music API + 관리자 설정 유지 실사용 확인

- `CURRENT_RELEASE_STATE.md 0GW` 최우선.
- PREVIEW app175 Firebase Hosting Run `36162378407` SUCCESS, deployed SHA `dde9215898ac3fee0dcd6eb6a24c6a41c28eec1a`, exact build/version 175 PASS, TEST/PRODUCTION unchanged PASS.
- Library 앱설정의 raw `menuVisibility.library`만 Music API 생성 UI gate로 사용. `숨김=false`일 때만 두 UI를 숨기고, `전체공개/관리자만`은 기존대로 표시.
- 대상 2곳: Studio 최근 생성곡/Result 맨 아래 Music API 카드, Music Note 디테일 팝업 맨 아래 Music API 생성 섹션+모달.
- 관리자 Navigation 설정과 Cache Diagnostics ON/OFF는 stable persistent localStorage mirror를 추가해 앱 업데이트/저장키 버전 변경 fallback에서도 마지막 상태 유지.
- Admin Settings 서버 읽기 실패 시 앱 기본값으로 reset 금지. 마지막 local persisted state 유지.
- 앱 업데이트 경로에서 localStorage.clear 또는 protected admin preference remove 금지. APP207가 감사에서 강제.
- Final Audit Run `36162135602` SUCCESS: TypeScript/Build/APP207/기존 Like 회귀/Worker dry-run/shared D1 read-only/branch guard PASS.
- Worker/Functions/Rules/D1/Firestore schema/사용자 원본 데이터 변경 없음. 새 서버 read/write 없음.
- 사용자 확인: (1) Library=숨김 → 두 Music API 메뉴 모두 숨김, (2) Library=전체공개 또는 관리자만 → 두 메뉴 표시, (3) Cache Diagnostics=OFF + Library=숨김 상태로 다음 앱 업데이트 적용 후 동일 상태 유지.
- 이번 변경으로 다른 Studio/Recent/Music Note 기능을 수정하지 않는다. 이상이 있으면 해당 gate/persistence 경로만 국소 수정.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app174 PREVIEW 배포 완료, 분할 곡 만들기 세로 구성 실사용 확인

- CURRENT_RELEASE_STATE.md 0GV 최우선.
- app173의 별도 카드형 최근 생성곡 목록은 사용자 의도와 달라 제거 완료.
- app174는 분할모드 곡 만들기에서 새 목록을 만들지 않고 **기존 Result/최근 생성곡 영역 자체를 Builder 아래로 세로 배치**한다.
- 순서 기준: 곡 만들기 Builder → 기존 명령창 아래 선택 키워드 → 기존 최근 생성곡/생성 결과.
- 선택 키워드는 기존 Classic inline 위치를 재사용하고 Create에서 고정 portal 중복을 제거.
- 곡 만들기에서는 divider/pane collapse control을 숨기되, 최근 생성곡·뮤직노트·라이브러리 작업공간의 기존 좌우 분할은 그대로 유지.
- Final Audit Run 36159274642 SUCCESS. APP206 4종 / TypeScript / Build / 기존 Like regression / TEST·PRODUCTION dry-run / shared D1 read-only PASS.
- PREVIEW Hosting Run 36159567687 SUCCESS, release SHA 90a8256fd705382d410cc883c278f87544a79cbb, PREVIEW_APP_VERSION=174, exact build PASS, TEST/PRODUCTION unchanged PASS.
- Worker/Functions/Rules/D1/Firestore/사용자 원본 데이터 변경 없음. 새 서버 read/write 없음.
- 다음은 사용자 실사용에서 세로 순서와 기존 최근 생성곡 UI가 그대로 보이는지 확인. 문제가 있으면 이 세로 레이아웃만 국소 수정하고 기존 최근 생성곡 컴포넌트/기능/캐시 경로는 재작성 금지.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.
## 최신 2026-09-26 — app173 PREVIEW 배포 완료, 분할 곡 만들기 하단 UI 실사용 확인

- `CURRENT_RELEASE_STATE.md 0GU` 최우선. PREVIEW app173 Firebase Hosting Run `36157490130` SUCCESS, exact release SHA `7da5692fa2344cfe11bcc8cd9f31cfa0688e2023`, version 173/exact build PASS, TEST/PRODUCTION unchanged PASS.
- 사용자가 app172 공개곡 다음곡 적용을 실사용 PASS로 확인. app172 명령창/설정 복구 경로는 동결 유지.
- app173 추가 범위는 **분할모드 곡 만들기 Builder 하단**뿐: 기존 명령창 아래에 현재 선택 키워드 + 최근 생성곡 최대 10곡을 다크/클래식과 같은 정보 흐름으로 추가.
- 우측 선택 키워드 대시보드는 그대로 유지. 하단 키워드는 기존 `liveSelectedKeywordItems`와 제거 action을 재사용.
- 최근곡은 기존 메모리 `history.slice(0, 10)`만 사용하며 표시 때문에 서버 read/listener/write를 추가하지 않는다. 클릭은 기존 Recent workspace/open-song 경로 재사용.
- `isStudioBlackActionMode && !isStudioCompactMobileLayout && studioWorkspaceView === 'create'`로 한정. Compact 모바일은 새 블록을 중복 렌더하지 않는다.
- Final Audit Run `36157261895` SUCCESS: TypeScript/Build/APP205/기존 Like 회귀/Worker dry-run/shared D1 read-only/branch guard PASS.
- 사용자 확인 항목: PC/태블릿 분할 `곡 만들기`에서 명령창 아래 선택 키워드가 자연스러운 위치에 보이는지, 바로 아래 최근 생성곡이 최대 10곡 보이는지, 최근곡 클릭이 기존 Recent 화면으로 정상 이동하는지. 위치/간격 이상이 있으면 이 새 블록 CSS/마크업만 국소 수정하고 분할 엔진/생성바/우측 레일/백엔드는 건드리지 않는다.
- 모바일 실제 시각은 미검증. 정적 중복 방지 PASS 상태이므로 사용자 제보 없이는 compact mobile 구조를 변경하지 않는다.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-26 — app172 PREVIEW 배포 완료, 공개곡 다음곡 적용 실사용 확인

- `CURRENT_RELEASE_STATE.md 0GT` 최우선. PREVIEW app172 Hosting Run `36155524302` SUCCESS, exact release SHA `cbd25719c3871dbe146d5729333c0045266747c3`, version 172/exact build PASS.
- PREVIEW Worker Run `36155391649` SUCCESS, active version `93a6d6a1-6db4-4140-aea7-e9c59192f8ad`. TEST/PRODUCTION Worker 비변경.
- 최종 Audit Run `36155109826` SUCCESS: TypeScript/Build/APP204/APP202/기존 like 회귀/Worker dry-run/shared D1 read-only/branch guard PASS.
- 수정 목표: Explore 공개곡의 `다음곡에 적용`이 Music Note 직접 적용과 같은 의미의 사용자 설정을 복원. 새 공개곡은 original `userInput`과 필요한 generation controls를 public nextSong에 처음부터 포함.
- 기존 본인 공개 Music Note 곡의 public bundle에 command가 빠졌다면 **버튼 클릭 순간에만** 원본 `favorites/{sourceId}` 1문서를 cache-first로 읽어 복구. 페이지 진입 read 추가 금지, collection scan 금지.
- legacy 공개곡은 공개 selected keywords를 먼저 로컬 복구하고 그래도 자료가 없을 때만 bounded Worker apply-source. generated prompt를 original command로 대신 넣지 않는다.
- 정상 좋아요/Worker 동기화/공유노트/Music Note 저장/UI는 새 구체 오류 없으면 수정 금지.
- 사용자 실사용 확인: (1) 이전에 키워드는 복원되지만 명령창이 비었던 **본인 공개곡** → 명령창까지 복원, (2) 오래된 공개곡 → 보존된 범위의 설정 정상 복원, (3) 이후 새로 공개하는 곡 → 첫 공개부터 명령창+설정이 같이 적용. 실패 시 해당 곡의 공개 bundle/source 한 건만 좁혀 확인.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app171 PREVIEW 배포 완료, 더보기 텍스트 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0GS` 최우선. PREVIEW app171 Firebase Hosting Run `36150400530` SUCCESS, exact release SHA `36f72d8de93c8ddeacfa2e0188b18b3cc2c115da`, app171 exact build PASS, TEST/PRODUCTION unchanged PASS.
- 더보기 시트 텍스트 기준: 상단 3버튼 12px no-wrap, 단독 행 메인 라벨 14px no-wrap, 설명문 10px 유지.
- app170의 아이콘/핑크 강조/공개설정/공유노트/좋아요 경로는 변경 없음.
- 다음은 사용자 PC·모바일 시각 확인만 반영. 새 구체 오류 없으면 기능 로직 수정 금지.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app170 PREVIEW 배포 완료, Explore 액션/공개설정 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0GR` 최우선. PREVIEW app170 Firebase Hosting Run `36149125409` SUCCESS, exact release SHA `aee4034be5a14abfe0378a3e9b954d80c8add3b1`, exact build/version 170 PASS, TEST/PRODUCTION unchanged PASS.
- 카드 빠른 액션 최종 기준: 좋아요+숫자 → 다음곡 적용(Studio와 같은 순환 화살표, 활성 시 아이콘만 핑크) → 곡선형 공유 화살표 → 원형 세로 `⋮`. 세 버튼 배경은 동일한 중립 원형.
- 더보기의 다음곡 적용은 버튼 전체 착색 금지. 활성 가능 시 텍스트만 핑크 강조.
- 더보기 `공개 설정`: 본인곡만 활성. 타인곡 비활성. 열기 자체 서버 read 0. 기존 publication local-first/outbox 경로를 재사용.
- 공개 설정 모달은 Music Note 기존 기준과 동일하게 다음곡 적용 허용 / 팔로워 곡 저장 허용 / 공개 프로필 고정 / 저장 / 비공개 전환 제공.
- app170 final Audit Run `36148886168` SUCCESS. APP203 포함 TypeScript/Build/기존 like 회귀/Worker dry-run/shared D1 read-only PASS.
- Library는 Explore에서 계속 사용하지 않으며 공유 노트는 Music Note sharedNote 경로 유지.
- 다음은 사용자 PC/모바일 실사용 결과만 반영. 정상 좋아요/Worker195/공유노트 구조는 새 구체 오류 없으면 수정 금지.
- TEST/main 승격은 명시적 테스트배포 요청 전 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app169 PREVIEW 배포 완료, 실사용 검증 대기

- `CURRENT_RELEASE_STATE.md 0GQ` 최우선. Firebase PREVIEW Hosting Run `36145255522` SUCCESS, exact release SHA `c0ad855216f9a5c90e3988e57a2719ca62d49558`, app169 exact build PASS, TEST/PRODUCTION unchanged PASS.
- 사용자 운영 기준: 수정 후 검증 PASS면 별도 중간 정지 없이 PREVIEW 배포까지 완료. 단 TEST/PRODUCTION 승격은 기존 승인 규칙 유지.
- 실사용 확인: PC/모바일 카드 작은 아이콘 배치·hover, 적용 가능 노란 강조, 공유 화살표, 원형 세로 `⋮`, 더보기 큰 메뉴 중복 가이드, `공유 노트에 추가` 폴더 선택/저장.
- Library 저장 경로는 Explore에서 사용 금지. Music Note sharedNote 경로를 기준으로 유지.
- 정상 좋아요 경로는 새 구체 오류가 없으면 수정 금지. Worker195/Functions/Rules/D1/Firestore schema/사용자 데이터 비변경.

## 최신 2026-09-25 — app169 Explore 빠른 액션 + 공유 노트 후보, PREVIEW 배포 전

- `CURRENT_RELEASE_STATE.md 0GP` 최우선. app169 제품 후보 구현/감사 완료, 실제 Hosting은 아직 app168.
- 카드 아래 최종 액션: 기존 좋아요+숫자 → 노란 강조 가능한 다음곡 적용 아이콘 → Forward 공유 아이콘 → 원형 세로 `⋮`. 작은 아이콘은 hover 원형 배경/명도 강조, 텍스트 없음.
- 더보기 시트는 접근성/가이드 역할로 큰 액션을 그대로 유지: `공유 노트에 추가 / 좋아요 / 공유 / 다음곡에 적용 / 싫어요`. 적용 가능곡의 다음곡 버튼은 큰 시트에서도 노란 강조.
- Explore의 Library 저장 경로는 제거. `공유 노트에 추가`는 기존 Music Note sharedNote 폴더 구조와 `favorites` shared_music_note 문서 의미를 재사용.
- 비용: sharedNote 폴더는 Music Note 구조 로컬 캐시 우선, 최신이면 read 0; stale/miss 때 `user_structures/{uid}` 1문서 read. 실제 저장 클릭은 결정적 favorites 문서 1개 merge + 기존 Music Note mutation boundary. 타인 곡 권한 확인은 기존 Worker track 1 + follow 1 bounded read, 본인 곡은 생략. Library scan 0.
- app169 final Audit Run `36144800979` SUCCESS. TypeScript/Build/APP201/APP202/기존 like regression/Worker dry-run/shared D1 read-only PASS.
- 제품 version commit `86843229793896f1b5ec0e01d8f9c176a7e757f0`, final audit source `4a7be79efe7189e97c8b3942de0f4afae9b71c9a`. 이후 commit은 상태 문서만.
- 실제 PREVIEW는 app168 Hosting Run `36140039077` / release SHA `7d0770699171899fa551fdcb82eb1f3946e94f8e`.
- 사용자 PREVIEW 배포 요청 전에는 배포하지 않는다. 배포 요청 시 Hosting only → app169 exact build → TEST/PRODUCTION unchanged 확인. Worker/Functions/Rules 재배포 없음.
- 배포 후 실사용은 PC/모바일의 작은 아이콘 배치·hover, 적용 가능 노란 강조, 원형 세로 `⋮`, 더보기 중복 메뉴, Shared Note 폴더 선택/저장만 집중 확인. 정상 좋아요 경로는 새 오류 없으면 수정 금지.

## 최신 2026-09-25 — app168 PREVIEW 배포 완료, 사용자 실사용 검증 대기

- `CURRENT_RELEASE_STATE.md 0GO` 최우선. PREVIEW app168 Firebase Hosting Run `36140039077` SUCCESS, exact release SHA `7d0770699171899fa551fdcb82eb1f3946e94f8e`, exact build/version 168 PASS, TEST/PRODUCTION unchanged PASS.
- Shared RTDB rules SKIPPED. Worker195/Functions/Rules/D1/Firestore 사용자 원본 데이터 비변경. 새 배포가 필요한 백엔드 없음.
- 사용자 실사용 검증만 진행: PC/모바일 카드 `···` → 액션 시트, 좋아요 기존 상태/동기화, 공유, 다음곡 적용, 폴더 추가, 싫어요 추천 제외, 모바일 배경 스크롤/중복 클릭 차단.
- 문제 발생 시 정상 좋아요/Worker195 전체를 다시 수정하지 말고 **해당 액션 하나만** 원인 한정 수정. 비용 기준은 app168 APP202 유지: 다음곡 cache-first, save-access bounded 2 reads, dislike server 0, playlist 전체 scan 금지.
- 사용자 통과 전 TEST/main 승격 금지. PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app168 Explore 액션 시트 배포 직전 잠금 후보

- `CURRENT_RELEASE_STATE.md 0GN` 최우선. 사용자 요청대로 **PREVIEW 배포 전 단계까지 완료**, 실제 Hosting 배포는 아직 하지 않음.
- 앱 버전 `168`, 최종 감사/배포 잠금 후보 SHA `04f5de2e4b84758776809fbcd5ee1d0a961c0ab3`. 최종 Release System Audit Run `36139084888` SUCCESS. TypeScript/Build/APP201/APP202/기존 like regression/Worker dry-run/shared D1 read-only PASS.
- 구현 범위: Explore 카드 `···` → 하단 액션 시트(`폴더에 추가 / 좋아요 / 공유 / 다음곡에 적용 / 싫어요`). 기존 좋아요 mutation, Music Note, Gemini, 최근곡, Worker195, Functions, 사용자 데이터는 수정하지 않음.
- 비용 기준: next-song은 기존 Feed shareBundle cache-first라 정상 데이터면 서버 read 0, fallback은 해당 곡 bounded read. 타인 폴더 저장 권한은 track 1 + follow 1 bounded lookup, 싫어요는 기기 localStorage만 사용해 서버 read/write 0. 페이지 진입/앱 업데이트 자체로 새 액션 API 호출 없음.
- 실제 PREVIEW는 여전히 app167 Hosting Run `36117132227` / release SHA `cc6dfccfedf3a5b0fae041f3d65d905dc4cf385c`. main/prod 비변경.
- **다음 사용자 지시가 PREVIEW 배포라면** 제품 코드를 다시 수정하거나 버전을 다시 올리지 말고 잠금 SHA `04f5de2e4b84758776809fbcd5ee1d0a961c0ab3`를 Firebase PREVIEW Hosting에 배포 → exact build/app168 → TEST/PRODUCTION unchanged 확인. Worker/Functions/Rules 배포 불필요.
- 배포 후 사용자 실사용 확인: PC/모바일 `···` 시트, 기존 좋아요 상태/동기화, 공유, 다음곡 Studio 적용, 본인/팔로우 허용곡 폴더 저장, 싫어요가 추천에서만 제외되는지. 실사용 확인 전 TEST/main 승격 금지. PRODUCTION 별도 명확 승인 필요.

# SORIDRAW NEXT CODEX TASK

## 최신 2026-09-25 — app167 관리자 Gemini 호출 기록 모바일 UI 배포 완료, 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0GL` 우선. PREVIEW app167 Hosting Run `36117132227` SUCCESS, exact release SHA `cc6dfccfedf3a5b0fae041f3d65d905dc4cf385c`, final Audit `36116933721` SUCCESS.
- 사용자 요청 범위만 변경: Gemini 감사 화면의 긴 설명 제거, 모바일 홈+제목 우선 한 줄 확보, 액션 버튼 다음 줄/안전 wrap. 다른 관리자 화면은 opt-in 기본 false로 기존 헤더 유지.
- 실사용 합격선: 모바일에서 `Gemini 호출 기록` 제목이 세로 글자처럼 깨지지 않음, 설명 박스 제거, 모델 목록 확인/새로고침/기록 삭제 버튼 정상. PC/기타 관리자 화면 비회귀.
- Worker195/Functions/RTDB Rules/Firestore/D1/R2 사용자 원본/TEST/PRODUCTION 비변경. 사용자 확인 전 이 UI 추가 수정 금지.
- 다음 작업은 사용자 별도 지시를 따른다. TEST/main 승격은 명시적 테스트배포 요청 전 금지, PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app166 Rap AUTO 사용자 실사용 PASS, 해당 경로 동결

- `CURRENT_RELEASE_STATE.md 0GK` 우선. 사용자가 PREVIEW app166 Rap AUTO 중립화 결과를 실사용 PASS로 확인.
- AUTO는 중립, OFF는 `no rap`, ON은 기존 랩 적용, 사용자 직접 no-rap 지시는 AUTO에서도 보존. 이 기준을 정상 동작으로 고정하고 새 구체 오류가 없으면 관련 V1 랩 엔진을 다시 수정하지 않는다.
- PREVIEW app166 Hosting Run `36114262826`, exact release SHA `1fe21cd23152c3752c65ffe4e2e329751501c84b`, final Audit `36114071894` SUCCESS 유지.
- 다음 작업은 사용자의 별도 지시를 따른다. TEST/main 승격은 명시적 테스트배포 요청 전 금지, PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app166 PREVIEW 배포 완료, Rap AUTO 실사용 확인 대기

- `CURRENT_RELEASE_STATE.md 0GJ` 우선. PREVIEW app166 Hosting Run `36114262826` SUCCESS, exact release SHA `1fe21cd23152c3752c65ffe4e2e329751501c84b`, final Audit `36114071894` SUCCESS. TypeScript/Build/APP199 PASS, TEST/PRODUCTION 비변경, RTDB rules SKIPPED, Worker195/Functions/사용자 원본 비변경.
- 실사용 합격선: AUTO + 래퍼 역할 없음 + G-Funk/hip-hop 계열에서도 최종 [Arrangement]에 자동 `no rap`/동등 rap-ban이 없어야 함. AUTO + 래퍼 역할 또는 직접 랩 요청은 Blueprint 규칙대로 허용. OFF는 `no rap`, ON은 기존 랩 적용. Stable exact structure 유지.
- 사용자 직접 "랩 없이/no rap" 지시는 AUTO에서도 보존하는 것이 정상. 이 직접 지시와 AI가 임의 생성한 rap-ban을 혼동하지 않는다.
- app166 사용자 확인 전 같은 랩 엔진 추가 수정 금지. 이상이 재현되면 생성 결과의 `appliedKeywords.rapMode`, 보컬 역할, 사용자 직접 입력, 최종 [Arrangement]만 최소 대조하고 다른 프롬프트 엔진/가사/UI를 임의 변경하지 않는다.
- TEST/main 승격은 별도 테스트배포 요청 이후, PRODUCTION은 별도 명확 승인 이후에만 진행.

## 최신 2026-09-25 — V1 Rap AUTO 중립화 구현/감사 완료, PREVIEW 배포 전

- `CURRENT_RELEASE_STATE.md 0GI` 및 `docs/SORIDRAW_ENGINE_MAP.md §5` 기준. 사용자 의도: AUTO는 랩을 강제하지도 금지하지도 않음. Rap Section이 없다는 이유로 `no rap`을 최종 [Arrangement]에 만들거나 보존하지 않는다. OFF는 `no rap`, ON은 기존 rap section, 사용자 직접 no-rap 지시는 AUTO에서도 보존.
- 구현은 V1 Classic의 두 파일만: `sectionArrangementRoles.ts` final producer-map 경계에서 AUTO의 비의도 rap-ban 문구 제거, `geminiService.ts`에서 AUTO 지시 명확화 + rapMode/direct-no-rap context 전달. Stable/Custom/보컬 UI/App 상태/저장 구조/V2/Worker/Functions/데이터는 비변경.
- 회귀 `scripts/verify-199-rap-auto-neutral.mjs` 등록. Release System Audit `36113654643` SUCCESS: TS/Build/APP199 및 기존 회귀 PASS. 제품 소스 commits `caf7ac1f...` + `27c39a3f...`; audit trigger `83396e9f...`.
- 실제 PREVIEW 앱은 아직 app165 release SHA `0b6b677721af888d4efe34b67bd91ce0945cf47b`. **새 수정은 미배포**. 사용자 배포 요청 시 version bump → final audit → Firebase PREVIEW Hosting exact-build 확인 순서로 진행. TEST/PRODUCTION은 별도 승인 전 변경 금지.
- 배포 후 실사용 합격선: AUTO + 래퍼 역할 없음 + 랩 가능 장르(G-Funk/hip-hop 계열 포함)에서 `no rap`이 프롬프트에 자동 출현하지 않음; AUTO + 래퍼 역할/직접 랩 요청은 Blueprint 규칙대로 랩 허용; OFF는 `no rap`; ON은 기존 랩 적용; Stable exact structure 유지.

## 최신 2026-09-25 — app165 사용자 1차 실사용 이상 없음, 좋아요/비용 경로 동결 유지

- `CURRENT_RELEASE_STATE.md 0GH` 우선. 사용자 app165 사용 후 현재 이상 없음 보고. 신규곡 첫 좋아요와 기존 좋아요 정상 경로를 추가 수정하지 않는다.
- 최초 Social Snapshot R45 원인은 아직 미확정이며 app165 비용 감소도 미검증. 동일 현상이 자연 재현될 때만 관리자 lastOutcome(`PERSONAL REPAIR 182` / `PERSONAL SETTLEMENT 189` / `PERSONAL BASELINE` / `SOCIAL CACHE MISS`)과 R/W 수치를 기준으로 원인 한정 조사.
- 현재 PREVIEW app165 release SHA `0b6b677721af888d4efe34b67bd91ce0945cf47b` 유지. Worker195/RTDB/Functions/공유 사용자 원본/TEST/PRODUCTION 변경 금지. 캐시 삭제·강제 재생성으로 진단 재현을 만들지 않는다.
- 다음 작업은 사용자의 별도 지시를 따른다. TEST 승격은 명시적인 테스트배포 요청 전 금지, PRODUCTION은 별도 명확 승인 필요.

## 최신 2026-09-25 — app165 PREVIEW Hosting 배포 완료; Social Snapshot 첫 R45 실제 사유 확인 대기

- `CURRENT_RELEASE_STATE.md 0GG` 우선. 사용자의 배포 요청으로 PREVIEW app165 Hosting Run `36044641285` SUCCESS, exact release SHA `0b6b677721af888d4efe34b67bd91ce0945cf47b`, exact build/version 165 PASS; final Audit `36044402895` SUCCESS (TypeScript/Build/APP189·197·198/기존 like 회귀). RTDB rules SKIPPED, Worker195/Functions/공유 원본/TEST/PRODUCTION 변경 없음.
- **진단 배포와 비용 절감 완료 혼동 금지.** app165의 유일한 동작상 차이는 기존 관리자 진단 lastOutcome에서 최초 snapshot 요청 사유를 `PERSONAL REPAIR 182`, `PERSONAL SETTLEMENT 189`, `PERSONAL BASELINE`, `SOCIAL CACHE MISS`로 구분한다는 것. 첫 R45 자체는 app164 실측이며 app165에서 감소했다고 검증된 바 없음.
- 사용자 실사용: 기기 캐시 삭제/새 곡 생성 없이 업데이트 후 Explore, 관리자 진단의 `/v1/me/social-snapshot` 마지막 결과·D1 R/W 확인. 자연 발생한 최초 응답의 reason 없으면 원인 단정 금지. 그 뒤 진단 초기화하고 Explore 재진입으로 R0/W0 확인. 좋아요 하트/숫자·PC↔모바일 정상 유지 확인.
- R45가 다시 발생한 경우에만 기록된 사유와 1계정 비식별 최소 metadata 기준 원인별 읽기 범위를 분석. 182 partial 복구 및 189 미정산 검증을 막연하게 제거하지 않고, R2 exact/guard/버전 정합성 증명 후 최소 변경 설계. 반복적인 R45 또는 변경 없는 업데이트 대규모 읽기가 입증되면 별도 국소 수정 후보/회귀/preview-only 재배포. W3+ 좋아요 mutation, 기존 곡 하트, cross-device 이상이면 승격 차단.
- TEST/main 승격은 사용자 테스트배포 요청과 종합 검증 이후, PRODUCTION은 별도 명확 승인 이후에만 허용. 정상인 app164 첫 좋아요 및 Worker195 보호.

## 최신 2026-09-25 — Social Snapshot 최초 R45 읽기 식별용 진단 감사 통과, 비용 감소 미검증/미배포

- `CURRENT_RELEASE_STATE.md 0GF` 우선. 이미 정상인 app164 첫 좋아요 및 app160/Worker195 PC↔모바일·타계정 좋아요 보호. 사용자 첫 진입 Social Snapshot 2 queries / R45 / W0와 재진입 R0는 실사용 사실. 첫 R45 요청의 구체 query mode와 유저 R2 exact 여부는 미확인.
- preview 소스 후보: `exploreLikeService.ts`에 개인 snapshot 세 경로(182/189/일반) 관리자 lastOutcome 레이블, `exploreSocialSnapshotService.ts`에 follow cache miss 레이블만 추가. `scripts/verify-198-social-snapshot-diagnostic-reason.mjs` 신규 및 기존 Audit 등록. **데이터·서버 쿼리·인증·캐시·동기화/좋아요 mutation/UI 구조 변경 없음**. Audit `36043776336` SUCCESS (TS/Build/APP189/197/198·기존 회귀·D1 read-only). 앱 버전은 164 그대로, PREVIEW Hosting은 기존 app164, 새 코드 미배포.
- 이 진단은 R45 원인을 나중에 분류할 방법이지 비용 45→0 수정 완료가 아니다. 원인 비확정 상태에서 부분 R2/guard의 보호성 canonical 검증을 생략하거나 false로 추측하는 최적화 금지.
- 정확히 동일 최초 현상이 다시 발생하면 개인 정보 노출 없이 lastOutcome 분류와 한 계정 최소 metadata만 대조. `PERSONAL REPAIR 182`는 R2 exact metadata 불완전 확인, `PERSONAL SETTLEMENT 189`는 이전 미정산 guard, `SOCIAL CACHE MISS`는 개인 follow snapshot 초기화. 각 원인별로 데이터 정합성을 증명한 경우에만 R0 가능성 설계·검증. 임의 캐시 삭제/전체 사용자 read/임의 Worker 재배포 금지.
- PREVIEW 배포는 사용자 요청/출시 기준 충족 후 고정 source·감사·exact build. TEST/PRODUCTION 별도 승인 전 승격 금지. 제품 코드 diff/배포 현황을 혼동하지 않는다.

## 최신 2026-09-25 — 최초 Social Snapshot D1 R45 원인 후보 감사 완료, app164 좋아요 유지

- `CURRENT_RELEASE_STATE.md 0GE` 우선. 사용자 첫 방문 `/v1/me/social-snapshot` Worker1/D1 쿼리 2/행 R45/W0, 진단 초기화 후 재진입 개인 snapshot 호출 없음/전체 D1 R0/W0 직접 관찰. 최초 R45는 실제 비용이며 정상화 사례로 삭제하지 않는다.
- app163→164 diff에서 snapshot/Worker 변경 없음. 최초 조회 원인 후보는 개인 부분 카탈로그 182 1회 검증, 미정산 guard 새 revision 189 검증, 팔로우 snapshot 캐시 미존재 등. 원인 식별에 필요한 원 URL query/개인 R2 exact/guard 상태는 이번 화면만으로 확인할 수 없음. 단정 금지.
- 프로덕션 함수를 실행하는 `scripts/verify-189-personal-like-settled-guard-release.mjs`에 one-time partial repair 후 새 실행 컨텍스트/앱 업데이트 R0 확인 추가. Audit Run `36043099473` SUCCESS, TS/Build/like(APP197 포함)·Worker dry-run/D1 read-only PASS. 제품 코드/Worker/Functions/UI/Rules/사용자 데이터 **비변경**, 추가 배포 없음.
- 신규 실제 오류 또는 첫 방문 R45의 반복·대규모 문제 증거 없으면 app164 좋아요 동결 유지. 재현된다면 해당 요청의 query mode와 1계정의 metadata만 비식별·읽기전용 확인한 뒤 필요성/비용을 판단. 보호성 복구 자체 삭제 금지. 정상 캐시 D1 R0/W0와 기존 좋아요 PC↔모바일·공개 숫자 우선.
- 명확한 다음 사용자 요청 없으면 별도 `CURRENT_RELEASE_STATE.md 0FU` 영어 가사 제목/생성 지연 이슈를 독립 진단. TEST/PRODUCTION 승격은 별도 승인 필요.

## 최신 2026-09-25 — app164 신규 공개곡 첫 좋아요 실사용 해결 확인·스킬 업데이트, 추가 코드 작업 없음

- `CURRENT_RELEASE_STATE.md 0GD` 및 `.agents/skills/local-first-like-sync/SKILL.md`·`references/soridraw-app164-worker195-frozen.md` 기준. 사용자 신규 공개곡 `[Melodic Rap] 한 정거장 일찍(한 단어 훅)` 좋아요 차단 해결 확인. app164 PREVIEW Hosting `36040776352`, exact release SHA `c6d580b65349071d67d17c11fa7fd83afc5b98f9`, Audit `36040506539` 성공 유지.
- **좋아요 정상 기능 재수정 금지.** app164 신규곡 최초 상태/기존 app160 + Worker195 개인 하트·좋아요 해제·같은 계정 PC↔모바일·타계정 공개 숫자·30초 batch/W1/RTDB 캐시 보호. 사용자의 새 구체 오류와 명확한 수정 지시 없이는 코드/배포/진단을 열지 않는다.
- 이번 요청은 좋아요 스킬·참조·회귀 체크리스트·AGENTS·현재 상태 기록 갱신만. 제품 코드/Functions/Worker/Rules/D1/R2/Firestore 사용자 원본, TEST/PRODUCTION 변경 없음. 새 PC/모바일 전체 매트릭스 및 D1 실제 mutation W1~W2 물리비용은 별도 측정 전, 자동 PASS로 간주 금지.
- 이후 별도 명시 작업이 없다면 `CURRENT_RELEASE_STATE.md 0FU`의 추가 영어 가사 카드 영어 제목 누락·느린 생성 분석을 읽기 전용으로 검토. 기존 곡 생성/Gemini 성공 경로·정상 좋아요 동결 유지. TEST/PRODUCTION은 명시 승인 전 승격 금지.

## 최신 2026-09-25 — app164 PREVIEW 배포 완료; 신규 공개곡 첫 좋아요 실기기 확인

- `CURRENT_RELEASE_STATE.md 0GC` 우선. app164 PREVIEW Hosting `36040776352` SUCCESS, exact build PASS, release SHA `c6d580b65349071d67d17c11fa7fd83afc5b98f9`. 전체 감사 `36040506539` SUCCESS, TypeScript/Build/APP197·기존 like 회귀 PASS. Worker195, RTDB Rules, Functions, TEST/PRODUCTION 비변경.
- **사용자 실기기 검증**: 동일 PREVIEW 계정으로 새 공개곡 `[Melodic Rap] 한 정거장 일찍(한 단어 훅)` 최초 좋아요→30초 처리 후 숫자/PC↔모바일 확인→해제; 기존 정상 공개곡 1곡도 하트/숫자 변함없는지 확인. 개인 캐시 삭제·기존 곡 재공개·새로운 Gemini 생성 금지.
- 실기기 실패 시: 신규 곡의 로컬 membership false/true, outbox, 개인 R2 snapshot complete, 서버 원본의 해당 track 관계만 제한 조회. 타계정/전체곡 scan 금지. 정상 기능 전체 재작업 금지.
- 정상 캐시 재방문 R0/W0, 새 ID partial 1곡 한정 검증, 신규 원격 W1~W2 실제 물리비용은 별도 측정 전이므로 실사용/비용 최종 PASS 주장 금지. W3+ 또는 기존곡/교차기기 회귀면 TEST 승격 차단.
- 사용자 TEST 요청 전 main 승격 금지. PRODUCTION 명확 승인 전 배포 금지. 다른 기능 변경은 독립 작업으로 분리.

## 최신 2026-09-25 — 신규 공개곡 최초 좋아요 국소 수정 완료, Audit 최종 결과 대기

- `CURRENT_RELEASE_STATE.md 0GB` 최우선. 사용자 다른 좋아요 절대 보호 승인에 따라 preview 제품 후보 `467ba77241555dbe24e6648900268c0a03427026`에만 최소 수정; 현재 preview의 제품 소스 동일. `src/services/exploreLikeService.ts` 신규 ID 최초 좋아요 상태: complete baseline이면 missing ID false 로컬 기록, partial/미확인이면 누락 ID만 bounded 검증. 기존 liked/pending/unsettled 우선.
- 회귀 `scripts/verify-197-new-public-track-like.mjs` / audit 등록, audit-only trigger `1f4a5dd37a6d5db78259c8b68182b043fde2c0bf` 실행 요청. **실제 GitHub Audit 완료·결과, TypeScript/Build/Test는 아직 확인 못함**. 별도 확인 전 PASS/배포 보고 금지.
- 다음: CI Run 확인. FAIL이면 원인 한정 수정하고 재감사, PASS면 변경파일 범위/좋아요 기존 기능/비용/데이터 독립 검증. 기존 Worker195, RTDB 규칙, Firebase 사용자 원본, 최근곡 app163, Gemini, UI/CSS 비변경 확인. 사용자 별도 배포 요청 전 PREVIEW 제품 배포 없음; TEST/PRODUCTION 금지.
- PREVIEW 배포 및 실사용 시 신규곡 0→1→0, 기존곡 하트/숫자, 같은 UID PC↔모바일, 다른 계정 공개숫자, 무변경 재진입 R0/W0, W1~W2 물리비용 검증. 미확인 항목은 미검증 유지.

## 최신 2026-09-25 — 신규 공개곡 첫 좋아요 차단: 코드 최소 수정 전 원인 확인

- `CURRENT_RELEASE_STATE.md 0GA` 최우선. 사용자 영상의 신규 공개곡 `[Melodic Rap] 한 정거장 일찍(한 단어 훅)`에서 하트가 변하지 않고 `좋아요 상태를 확인하고 있어요` 안내. 기존 공개곡은 정상. 제품 수정/재배포 전.
- 읽기전용 소스 근거: `ExplorePage.tsx:1144-1154` 클릭 시 `readExploreTrackLikeMembership127 === undefined`면 차단. `exploreLikeService.ts:1516-1560`은 이미 로컬 카탈로그 ready 시 신규 visible ID `missing=[]`로 두어 negative membership 기록 안 함. `:335-350`은 캐시 미포함 ID의 undefined를 반환. UI false vs 서비스 undefined 불일치. 실제 계정 캐시/서버 원본 미열람, 다른 원인 동반 가능성은 별도 분리.
- 사용자 최소 수정 승인을 받은 뒤 Codex High/preview 한정으로 새 곡의 미좋아요 initial-state seed만 보강. 완전한 개인 snapshot일 때만 `false` 확정, 부분/미확인 snapshot이면 해당 ID에 한정한 private 검증. 기존 liked true, outbox, unsettled, cross-device 최신 신호 우선. UI, 기존곡 좋아요, 30초 queue/W1, Worker195/RTDB/D1/R2, Music Note, Gemini, 최근곡 app163 보호.
- 합격: 신규곡 0→1→0 UI/서버 수렴, 기존곡 1→0→1, 새 계정/부분 snapshot, 같은 UID PC↔모바일, 서로 다른 계정 공개 숫자, 정상 재방문 D1 R0/W0, 신규곡 하나 때문에 전체 개인 좋아요/Feed read 금지, W3+ FAIL. TS/Build/관련 like 회귀 및 Work 독립검증 후 PREVIEW만 배포; 실제 사용 확인 전 TEST/PROD 불가. 승인 전에는 코드/배포 금지.

## 최신 2026-09-25 — 사용자 app163 휴대폰 최근 생성곡 표시 확인, 동기화 추가 수정 보류

- `CURRENT_RELEASE_STATE.md 0FZ` 우선: 사용자가 기존 PC→휴대폰 누락 후 현재 휴대폰의 최근 생성곡 표시를 직접 확인. **표시 증상 PASS**. app163 추가 재수정이나 원본 복구를 추정으로 실행하지 않는다.
- 아직 새 곡의 페이지 왕복/새로고침 없는 자동 반영, 실제 정상 캐시 R0/W0, 구형 신호 최초 1회 조회는 미검증. 사용자 추가 제보가 있거나 필요 시 해당 곡·계정에만 제한된 read-only 진단; 전체 캐시 삭제/데이터 재생성/반복 Gemini 호출 금지.
- 다음 별도 범위: `CURRENT_RELEASE_STATE.md 0FU`의 추가 영어 가사 카드 영어 제목 누락 및 약 1분 이상의 대기 원인부터 읽기 전용 확인. 원곡 한국어 제목·원본 가사·기존 Gemini 생성/좋아요 동결 보호. 추가 호출·코드 변경·배포는 원인과 범위 검증 후 별도 진행.
- PREVIEW app163 유지, TEST/PRODUCTION 승격 금지. 사용자 원본 직접 변경 없음.

## 최신 2026-09-25 — app163 PREVIEW 배포 완료, 기존 누락곡 PC·모바일 실사용 확인

- `CURRENT_RELEASE_STATE.md 0FY` 기준. app163 PREVIEW Hosting `36037269105` SUCCESS/exact build, 최종 Audit `36036971353` SUCCESS. 고정 소스 `fe74f006bd3c90793f45830a0f4ee019d738cfe8`; release commit `8e285966975d410e2e3797d77ff031945b7cbf7a`.
- **사용자 실사용 1차**: PC 원본 생성곡/로컬 캐시는 그대로 유지. 같은 계정의 휴대폰에서 PREVIEW app163 접속 후 최근 생성곡에 그 기존 곡이 자동 도착하는지 확인. 다른 페이지 왕복/새로고침 없이도 신호 변경 후 갱신되는지 확인. PC의 기존 곡이 사라지거나 서버 저장 실패 알림이 나오는지도 관찰.
- 아직 실데이터 원본 미확인. 계속 누락이면 계정의 `user_recent_songs/{uid}` 1문서, `users/{uid}` 1문서, RTDB `userSync/{uid}/recentSongs` 1신호만 안전하게 read-only 대조. 곡 ID/날짜·버전만, UID/API key/가사 원문 출력 금지. 원본 부재라면 PC 로컬을 유지하고 곡 재생성 없이 사용자가 확인하는 복구 경로를 별도 설계. 임의 대량 복원/기존 삭제곡 부활/캐시 전체초기화 금지.
- 구형 신호 최초 1회 추가 읽기 가능성은 대규모 서버 비용 게이트로 남음. 현재 mocked R0/R1 판정 통과이지 실사용 PC/mobile/cost 실측 PASS가 아님.
- 좋아요 app160/Worker195 동결, Gemini app162 완료된 streaming Function 그대로 보호, TEST/PRODUCTION 승격 금지.

## 최신 2026-09-25 — 최근 생성곡 app163 후보 검사·PREVIEW 실사용 게이트

- 기준 `CURRENT_RELEASE_STATE.md 0FX`. 사용자 01시 이후 문제 시작 제보는 타임라인 참고. app162 배포는 01:24 KST 완료, 생성 성공 01:31, 기존 `App.tsx` 마지막 변경은 09/16. **app162가 recent 코드 자체를 바꾼 것은 아님**.
- `preview` App/ recentSongs domain service/순수 버전 gate 최소 수정, app163 후보. local=profile100/RTDB200 → 1 read, read200 중 새300 → 후속 1회, ack 후 동일200 → 0 read. PC 로컬 신곡은 서버 저장 완료 전 보호하고 서버 저장 실패를 화면에 안내. URL/nav/개인 캐시 보호.
- 배포 전 필수: `npx tsx scripts/verify-196-recent-song-sync.ts`, TypeScript, Build, full release audit / 기존 like·Gemini regression. 실제 원본 Firestore/RTDB는 현재 미조회, 복구 완료 선언 불가. 정상 재진입 R0/W0·무변경 서버 write0, 앱 업데이트 유발 reads 검토.
- 사전 검사 PASS 및 데이터 손실 위험 없을 경우 고정 PREVIEW Hosting만 배포, app163 exact build/TEST·PRODUCTION 비변경 확인 후 사용자 PC↔모바일 기존 누락 곡 재검증. DATA migration/Functions/Worker 배포 금지. 좋아요 동결, Gemini SSE 불변.

## 최신 2026-09-25 — Astra 원인분석 검증 완료, 최근곡 두 갈래 안전 복구 계획

- `CURRENT_RELEASE_STATE.md 0FW` 우선. Astra가 소스 모의 실행으로 **RTDB 신호 버전 미사용 + in-flight 후속 신호 누락 + background 저장 실패 swallow**를 증명, ChatGPT가 실제 preview GitHub 소스에서 관련 분기를 재확인했다. 단 해당 새 곡의 서버 저장 존재 여부는 미확인.
- **첫 단계 read-only**: 동일 UID/preview 판정 후 Firestore 최근곡 원본 doc 1개와 프로필 doc 1개, RTDB recentSongs 신호 1개만 비교. 해당 곡 ID/createdAt과 3종 버전만 기록. 비밀키·UID·가사 원문 공개/전체 조회 금지. 실데이터 직접 접근이 현재 없으면 사용자 원본이 있다는 가정 없이 중단·보고.
- **원본 존재 branch**: `App.tsx`의 신호 버전을 profile cache와 별도로 pending으로 보존하고 새로운 신호는 bounded server verification 트리거로 사용. 서버 문서 적용/epoch 보호 성공 후에만 문서 버전 확인 완료. in-flight 도착 신호는 완료 후 확인, 동일 신호는 0 read. `userDomainSyncService.ts`의 recentSongs 한정에서 실제 저장 결과 버전과 새 timestamp의 의미를 분리하고 과거 신호 호환. 다른 domain 분기 절대 변경하지 말 것.
- **원본 부재 branch**: `saveRecentSongsBatch`의 save fail과 mutation epoch skip을 정상 성공으로 삼키지 않고, 기존 PC 로컬 결과 보존·안전한 재시도 설계. 기존 user data overwrite/전체 merge/deleted song resurrection 금지. Gemini 재생성 금지.
- **검증**: local/profile=100, RTDB=200 → 1 read; 조회 중 300 → 완료 후 재확인; 같은 200 재전달 → 0 read; 저장 실패/epoch 변경/페이지 이탈·재진입/서버 데이터 미포함 시 캐시 안전; app TypeScript/Build/116 cache verifier/PC↔mobile; 정상 warm R0/W0.
- 독립 감사 전 TEST 배포 금지. 사용자 승인 없이 production, 공유 데이터 migration/백필 금지. 현재 좋아요 동결·Gemini app162 성공 경로 보호.

## 최신 2026-09-25 — 최근 생성곡 PC→휴대폰 누락 우선 원인 분리 (Gemini 영어 제목 다음)

- `CURRENT_RELEASE_STATE.md 0FV`: 사용자 PC에서 만든 곡이 폰 최근 생성곡에 보이지 않는다고 보고. **cross-device FAIL**, TEST 승격 금지. 원본이 존재하는지 미검증이므로 “캐시 문제 확정”, “Firestore 저장 실패 확정”, “새 곡 유실” 단정 금지.
- 읽기 전용으로 동일 계정/환경, `user_recent_songs/{uid}.songs[]`의 해당 곡 1개와 `syncVersion`, `users/{uid}.syncVersions.recentSongs`, RTDB `userSync/{uid}/recentSongs` 버전, 폰 프로필 캐시/로컬 버전/화면을 시간순으로 대조. 대량읽기 금지.
- 코드상 후보: 935의 recentSongs 이벤트는 `detail.version`을 확인하지만 fetch 여부는 `readUserProfileCache(uid)`의 원격 버전만 사용. RTDB 신호가 프로필보다 먼저 도착하면 누락 가능. 저장 문서에 최신 곡이 있을 때만 구체적인 bounded invalidation 수정 검토.
- 원본 없으면 PC 저장 경로만 조사. **PC 캐시 삭제·로그아웃·새 곡 재생성·전체 캐시 강제 무효화·사용자 데이터 백필/덮어쓰기 금지**. 정상 캐시/변경 없음 서버 읽기 0 목표 및 Music Note 60초 묶음 저장 유지.
- 좋아요 전체 동결, Worker195/Explore 비변경. PREVIEW 원인 검사/최소 수정/감사 후 사용자 PC↔모바일 재검증. 현재 새 코드·배포 없음.

## 최신 2026-09-25 — 가사 언어 추가 영어 제목 누락, 추가 생성 지연 조사

- app162 첫 V1 1곡 생성 자체는 0FT에서 PASS. 그러나 사용자가 후속 ‘가사 언어 추가’ → 영어를 실행했을 때 1분 이상 소요 및 **영어 카드 제목이 영어로 표시되지 않음**을 보고했다. `CURRENT_RELEASE_STATE.md 0FU` 참조.
- 초기 생성/후속 언어 추가는 별개다. 화면 문구는 원제·원문을 기준으로 추가 언어 **가사** 생성이라고 설명한다. 추가 카드의 제목 번역이 요구/반환/표시/저장 중 어디서 빠지는지 읽기 전용 추적. 원곡 한국어 제목은 변경하지 않는다.
- 원인 확인 후 사용자 의도에 맞춰 **영어 카드의 제목도 영어**가 되도록 최소 수정안을 설계. 가능하면 추가 가사 생성 중 같은 1회 Gemini 응답에서 번역 제목을 얻어 별도 비용 없이 처리. 정상 가사 결과/다른 언어 카드/좋아요·Worker195 보호.
- 지연 1분+는 해당 후속 요청 세션의 모델/재시도·타임아웃·usage 기준으로만 평가. 이 단계에서는 임의 timeout 확대/모델 순서 변경/추가 생성 요청/TEST·PRODUCTION 승격 금지.

## 최신 2026-09-25 — app162 사용자 1곡 생성 완료 PASS, 모델별 오류는 잔존: 정상 경로 우선 보호

- `CURRENT_RELEASE_STATE.md 0FT` 기준. 사용자 제공 관리자 화면: `[Classic City Pop] 어린 새벽에 닿을 때` **완료**, 전체 1분17초, 3회 호출. 3.6 4.1초 `Gemini stream reported an error`, 3.5 20.9초 provider 503, 3.5-lite 46.6초 **성공** / input 25,946 + output 2,891 + thoughts 2,344 = total 31,181 token. 사용자가 모델 목록 5개 모두 등재 확인.
- app162 `store:false + stream:true`, SSE parser completed-event/usage, 300s request budget, UI audit model list 정상 성공 기록. 앞의 2모델 실패 및 별도 사용량·물리 과금 여부 미검증. 출력물 본문/최종 가사·언어·금지어·섹션·5단 productionPrompt의 각각 상세 확인은 아직 없음.
- **즉시 추가 코드 수정·모델 순서 조정·추가 API 호출 금지**: 실제 1곡 성공 경로가 확인됐으므로 현재 PREVIEW를 보존. 사용자 결과물에서 문제가 드러날 때만 해당 원인 최소 수정. 오류시 3.6 SSE provider event의 code와 3.5의 503을 구별해 한 세션만 비밀정보 없이 진단.
- 현재 PREVIEW app162 Hosting `36026936663` SUCCESS, Gemini Function `36026587156` SUCCESS. TEST/PRODUCTION 비변경, Worker195 및 좋아요 동결.
- 다음 선택: 생성된 최종 결과의 가사·5단 명령·섹션·금지어·언어 품질을 확인해 실제 완성 기준 PASS 여부 결정. 사용자 TEST 승격 요청 전 임의 승격/재배포 없음.

## 최신 2026-09-25 — app162 / Gemini SSE PREVIEW 배포 완료, 모델 목록 1회 검사 후 실사용 1곡

- `CURRENT_RELEASE_STATE.md 0FS`가 최우선. 현재 app162 PREVIEW Hosting Run `36026936663` SUCCESS/exact build, PREVIEW Gemini Function Run `36026587156` SUCCESS/shared Function unchanged, SSE source Audit `36026405886`, full Audit `36026316178` SUCCESS. 좋아요 app160/Worker195 정상기준 보호.
- `store:false + stream:true`로 기존 동기 JSON 대신 SSE 수신. model_output만 연결하고 completed+usage 필수, 300s total budget/330s hard limit, 기존 5회 ceiling/품질 계약 유지. 모의 SSE 9 PASS.
- **이제 먼저** 사용자 관리자 Gemini 호출 기록 화면의 ‘모델 목록 확인’을 딱 한 번 눌러 현재 등록 API 키의 5모델 목록 등재 여부를 확인. 이는 실시간 용량/429 quota/실제 생성 성공 판정이 아니다. API 키/UID/프롬프트 요청 금지, 원문 응답 로그 금지. 현재 실제 진단 클릭 기록 없음.
- 목록에 해당 모델이 있음이 확인되면 PREVIEW 일반 V1 실제 1곡만 생성해 처음 본문·후처리·가사/섹션/5단 최종 결과 검증. 실패 시 한 세션만 추적하고 503 vs SSE 오류 vs budget vs provider latency를 구분. 모델 순서/시간을 다시 무작정 바꾸지 않는다.
- CODE/TEST/PRODUCTION/shared user data 추가 변경 금지, 정상 좋아요 동결. 별도 `diagnose-069-live-like.yml` 실패는 릴리스 감사와 무관하며 Gemini 검증을 위해 좋아요를 다시 수정하지 않는다.

## 최신 2026-09-25 — app161 곡 생성 FAIL: timeout 추가 확대 중단, 연결/모델/보관정책 검증

- `CURRENT_RELEASE_STATE.md 0FR` 최우선. 사용자 app161 1곡 실사용 3분49초 0 usage 및 5모델 전부 실패. 3.6 62초 503, 3.5 90초 self-timeout, lite 66초 503, 3.7/3.8 1초 503. **app161 설정 변경 성공으로 보고 금지**, 새로운 재생성 요구 금지.
- Google 공식 문서에 따르면 Interactions 단일 HTTP 연결은 대략 60초에 닫힐 수 있으며 장시간 작업은 background ID 조회 권장. 현재 PREVIEW `store:false` 동기 POST. **background=true와 store=false는 호환 불가**: 무단 요청/응답 보관 전환 금지 (무료 1일·유료 기본 55일). provider 503이 실제 용량 문제일 가능성도 여전.
- 다음은 사용자 입력/결제/개인 정보 노출 없는 읽기전용 확인: 오류 status/details, 정확한 live revision과 실제 API key 프로젝트의 모델 접근/쿼터; 그 뒤 store=false 유지 가능한 장시간 스트리밍/generateContent vs background 저장 승인의 안전·비용 비교. 자료 없으면 추정하지 말 것.
- 수정하려면 우선 사용자에게 기존 store=false와 background의 보관 충돌을 보고하고 정책 승인. 그 전에는 background 코드 변경/배포 금지. 단순 모델 순서·timeout만 다시 바꾸지 말 것. 좋아요 실행 코드/Worker195/Rules/RTDB/D1/R2 전면 동결.
- 사용자 요청 없는 TEST/PRODUCTION 승격 금지. 현재 app161 Hosting/Preview Function 배포본은 **실사용 곡 생성 FAIL**.

## 최신 2026-09-25 — app161 + PREVIEW Gemini Function 적용 완료, V1 1곡 최종 실사용 검증

- `CURRENT_RELEASE_STATE.md 0FQ`: app161 Hosting Run `36018252541` SUCCESS / exact build PASS; PREVIEW Gemini Function Run `36017885707` SUCCESS / shared TEST·PRODUCTION Function 비변경. Source Audit `36017422013`, Release System Audit `36017538500` SUCCESS.
- 적용: 초기 모델 `3.6→3.5→3.5-lite→3.7→3.8`; 초기 제한 `120/90/75`초. Function 전체 330초와 5-call ceiling, 후처리 품질·프롬프트·가사·언어·금지어, 좋아요 실행 기능/Worker195 모두 보호.
- **다음**: 인증된 PREVIEW에서 일반 V1 1곡만 생성. 관리자 화면에서 최초 모델, 각 status/duration/usage, 후처리 완료 여부, 최종 5단 작곡 명령·가사 출력 여부 확인. 503, provider deadline, self-timeout을 구별하고 후순위 330s 전체 상한 확인. 다시 실패하면 해당 1세션 근거로 최소 수정; 무작정 추가 생성/한도 확대 금지.
- TEST/PRODUCTION 승격 금지. `.github/workflows/diagnose-069-live-like.yml` 별도 push failure는 기존 진단 workflow debt; 정상 좋아요 실행 코드를 변경하지 않는다.

## 최신 2026-09-25 — Gemini app161 후보 적용 후 감사·PREVIEW 배포·1곡 검증

- 사용자 승인된 설정: initial `3.6→3.5→3.5-lite→3.7→3.8`, initial timeout `3.6=120s, 3.5=90s, lite=75s`, Function 330s/5회 ceiling/후처리 품질 보존. `CURRENT_RELEASE_STATE.md 0FP` 참조.
- 신규 후보 변경 경로는 `geminiProxyClient.ts`, `functions/scripts/build-secured-index.cjs`, `public/app-version.json`, 기존 Function source verifier 및 문서뿐. 모든 좋아요 코드/Worker/RTDB/R2/D1/Rules 비변경.
- 반드시 감사 먼저: source verifier, TS/Build, Function build, Gemini/좋아요 회귀, TEST/PROD dry-run. 감사 후 별도 PREVIEW Function Tune Workflow verifier assertion을 새 설정으로 갱신한 **고정 배포 경로**를 실행하며 shared Function unchanged 확인. app161 Hosting은 고정 trigger로 배포 후 exact build 확인.
- `3.6` 실제 60s는 기존 90s self-timeout과 다르므로 신설 120s 설정으로도 provider deadline 문제가 남을 수 있다. 503은 사용량/가용성 외부 요인. 330s overall ceiling까지 긴 연쇄 요청이 갈 수 있으니 실제 1곡 생성부터 검증.
- 이후에도 정상 좋아요 동결, TEST/PROD 승격 금지. 반복 생성 금지.

## 최신 2026-09-24 — Gemini 일반 V1 1곡 FAIL 재현, 503 대 self-timeout 정확히 분리

- 현재 실사용 근거: `CURRENT_RELEASE_STATE.md 0FO`. 사용자 2026-09-24 23:38:53 KST, 최초 곡 5모델 전부 실패 / 2분53초 / 감사 화면 usage 0. 3.8 1.2초 일시 unavailable, 3.7 1초 일시 unavailable, 3.6 60초 timeout, 3.5 60초 timeout, lite 10.7초 일시 unavailable로 최종 HTTP 503. **가사/금지어/5단 품질 검사에 도달하지 않았다.**
- GitHub build-time `functions/scripts/build-secured-index.cjs`의 정책은 3.6=90s, 3.5=60s, lite=60s / Function=330s. 실제 3.6 화면 60s의 불일치는 원인을 확인하기 전 90s→120s 무조건 확대하거나 “로컬 timeout 확정”이라고 말하지 않는다.
- 다음 최소 조사: (1) 해당 단일 인증 세션에서 원래 upstream status/code/abort name/초 단위 duration, serverAttempts별 `GEMINI_ATTEMPT_TIMEOUT` 구분; (2) active PREVIEW Function revision·실제 deployed policy 비교; (3) 해당 API 프로젝트 모델 사용 등급/이용 가능 상태 (비밀 키·UID 출력 금지). 실제 503과 quota 429를 분리.
- 원인 확인 뒤에만 범위 제한된 해결안을 제출하고, 기존 song output 품질 계약/5단 prompt/가사/금지어·언어·섹션 규칙/좋아요 동결을 보존. provider unavailable이면 무작정 timeout만 늘리거나 같은 요청을 반복하지 않는다. 공유 TEST/PROD Function 미변경.
- 이번 단계에서는 코드 변경·배포 없음. 추가 생성으로 API quota 소모하지 않는다.

## 최신 2026-09-24 — Gemini V1 장애 재개, 사용자 1곡 실사용 결과만 먼저 판정

- 사용자 2026-09-24 최신 지시: 좋아요는 정상 실기기 검증 후 **동결**. 새로운 우선 작업은 Gemini 곡 생성 미완료 장애다. `CURRENT_RELEASE_STATE.md 0FN`을 확인할 것.
- 가장 마지막 PREVIEW Gemini Function Tune `35888544983` SUCCESS: 최초 생성 3.6=90초, 3.5/3.5-lite=60초, Function 전체 330초. app153 hard-ban shared fallback 복구는 Hosting `35887028650` SUCCESS, 현 앱 app160에도 포함된 릴리스 역사. 이후 Gemini **완전 생성 1곡 실사용 PASS 기록 없음**.
- 한 번에 일반 V1 1곡만 사용자 인증 계정으로 생성, 관리자 기존 Gemini 기록의 session별 모델/상태/시간/입출력 토큰, 후처리 금지어/언어/섹션, 최종 5단 productionPrompt를 확인. 0-token quota/provider error와 local timeout을 구분. 무조건 5회 반복 생성 금지.
- 실패 시 해당 1세션 로그 기준으로 최초 응답/후처리 중 실제 실패 위치만 정밀 수정 검토. 성공 시 코드를 바꾸지 말고 기준 기록. 정상 좋아요 코드/배포 절대 변경 금지.
- 이 단계에서는 코드/Functions/Hosting 배포, 사용자 데이터 원본 변경, TEST/PRODUCTION 승격 없음.

## 최신 2026-09-24 — 좋아요 전체 실기기 PASS, 기능 수정 동결

- 사용자 직접 확인: app160 + Worker195 PREVIEW에서 동일 계정 PC↔모바일, 타계정 A↔B 공개 숫자, 좋아요/해제 양방향이 모두 정상. **좋아요 기능에 더는 손대지 말라는 명시 지시가 최우선**.
- 보호 기준: `CURRENT_RELEASE_STATE.md 0FM`, `.agents/skills/local-first-like-sync/SKILL.md`, `references/soridraw-app160-worker195-frozen.md`. 정상이고 별도 수정 지시 없으면 좋아요 코드/배치/동기화/RTDB/D1/R2/Worker/캐시/개인 하트/UI/Rules를 수정·최적화·재배포하지 않는다. 다른 기능 수정 시에도 좋아요 경로 diff 또는 회귀가 있으면 중단.
- 고정 PREVIEW: app160 Hosting `36004777915` SUCCESS, Worker195 `36010156194` SUCCESS, active `11d8455c-c266-4e88-9cf6-7549d3f5be92`. Audit `36009942860` SUCCESS. 실제 변경곡 card D1 R0/W0와 warm revision R0/W0 확인; 신규 행동 mutation W1~W2 원격 물리비용 측정은 SKIPPED.
- 다음은 **좋아요 재작업이 아니라 다른 명시 작업**. 사용자가 TEST 배포를 요청하면 현재 PREVIEW 기능 전체를 검증한 뒤 동일 코드로 main/TEST에 승격하고 테스트한다. PRODUCTION은 별도 명확 승인 전 금지. 데이터 이동/덮어쓰기 금지.
- `.github/workflows/diagnose-069-live-like.yml`의 push별 별도 FAILURE는 기존 진단 workflow 문제. 이 문제를 핑계로 정상인 좋아요 기능을 재수정하지 않는다. 진단 Workflow 자체 보수도 다른 작업과 분리한다.

## 최신 2026-09-24 — app160 / Worker195 배포 완료, 이제 실제 타계정 자동반영만 검증

- 기준은 `CURRENT_RELEASE_STATE.md 0FL`. app160 Hosting `36004777915` SUCCESS. Worker195 `36010156194` SUCCESS / active `11d8455c-c266-4e88-9cf6-7549d3f5be92`. 최종 Audit `36009942860` SUCCESS.
- 실제 서버에서 이전 q069 3건 장기 정체가 관찰되어 Worker194가 stale alarm takeover를 추가했고, Worker195는 aggregate 완료 직후 새 batch가 끼어 orphan될 수 있는 join race까지 닫았다. 현재 release 직전 q069=0.
- app160은 공개 invalidation을 Worker server clock으로 통일하고 RTDB rows array/object 모두 수용, merged public bus에서 latest actor가 자기 계정이라는 이유로 다른 계정 row를 통째로 버리지 않는다. 타계정 개인 하트는 절대 변경하지 않는다.
- **지금 사용자 검증**: A 계정과 B 계정을 동시에 `preview.soridraw.com` Explore 같은 곡에 열어 둔다. A 좋아요 → 이동/새로고침 없이 35~45초 안에 B 숫자 +1 / B 하트 그대로. A 해제 → B 숫자 -1. 그다음 B가 좋아요/해제하여 A에서도 역방향 동일 확인. 가능하면 PC↔모바일 조합 1회 포함.
- 실패하면 그 한 곡만 q069 enqueue → Worker195 active window → canonical D1 → shared card/feed/profile → RTDB row → receiver changed-card 순으로 읽기전용 추적. 전체 likes/Feed scan, user data overwrite, polling 추가 금지.
- 서버 release smoke는 changed-card 3곡 D1 R0/W0, Feed/Profile PASS, warm revision R0/W0, TEST/PRODUCTION unchanged까지 확인됨.
- 실제 교차계정·기기 PASS 전 TEST 승격 금지. PRODUCTION은 사용자 명확 승인 전 금지.

## 최신 2026-09-24 — app160 / Worker194 PREVIEW 배포 완료, 실기기 교차 계정 좋아요 최종 검증

- 현재 기준은 `CURRENT_RELEASE_STATE.md 0FK`. app160 Hosting Run `36004777915` SUCCESS, Worker194 Run `36009078881` SUCCESS / active `554dbf4d-aa0b-4c2e-b3f2-a120d3019fda`, Worker194 Audit `36006077948` SUCCESS.
- 이번 작업에서 **실제 서버 증거**가 나왔다: 이전 Worker193 release 직전 q069 pending=3, 임시 cron 이후 23회 동안 그대로였고 24번째에 0. 즉 코드 존재 여부가 아니라 event scheduler가 stale alarm을 믿고 새 accepted batch를 제때 처리하지 않는 경로가 실제 있었다. Worker194는 새 batch가 stale alarm을 takeover하고 active request가 5초 coalescing 뒤 aggregate를 직접 수행하며 fallback alarm만 보조로 남긴다.
- app160은 cross-account public invalidation timestamp를 device clock이 아닌 Worker acceptance clock으로 통일하고, RTDB rows array/object 양형을 모두 decode하며, merged bus의 latest actorUid가 현재 계정과 같다는 이유로 다른 계정 rows까지 버리지 않는다. 개인 filled-heart는 전혀 공유하지 않는다.
- release smoke: predeploy pending069=0, changed-card 3곡 PASS / D1 R0 W0, Feed/Profile PASS, warm revision R0/W0, fixed cron 0, TEST/PRODUCTION unchanged.
- **다음은 코드 추가보다 실제 PREVIEW 실사용 검증**: A와 B 다른 계정을 동시에 열어 같은 공개곡을 본다. A가 좋아요 1회 → 페이지 이동/새로고침 없이 약 35~45초 내 B의 공개 숫자만 +1, B 하트는 그대로인지 확인. 이어 A 해제 → 같은 방식으로 -1. 다음에는 B가 좋아요/해제해서 A 화면이 역방향으로 동일하게 반응해야 한다. PC↔모바일 조합도 한 번씩 확인.
- 실패하면 즉시 전체 구조를 다시 바꾸지 말고 **그 한 곡** 기준으로 q069 enqueue 시각 → Worker194 active scheduler → canonical D1 → shared card updatedAt → RTDB row at/version → receiver fetch 결과를 순서대로 읽기전용 추적한다. full Feed rebuild, 전체 likes scan, 반복 polling, 사용자 원본 overwrite 금지.
- 실사용 PASS 전 TEST 승격 금지. PRODUCTION은 별도 명확 승인 전 금지.
- 별도 `.github/workflows/diagnose-069-live-like.yml` push failure는 여전히 maintenance debt이며 product release gate와 분리한다.

## 최신 2026-09-24 — app159 / Worker192 PREVIEW 배포 완료, 다음은 실제 교차 계정·기기 좋아요 검증

- 기준은 `CURRENT_RELEASE_STATE.md 0FJ`. Worker192 Run `36000021648` SUCCESS / active `d6c6e3db-207f-4d60-969f-eae6a0fd2126`; app159 + shared RTDB rules Run `36001464002` SUCCESS / exact build / remote rules exact match / TEST·PRODUCTION unchanged. Audit `36001252527` SUCCESS.
- 서버 공개 likeCount는 latest 37/37, popular 37/37 canonical과 일치하고 D1 canonical↔derived mismatch 0. 변경 곡 cross-account 전달은 RTDB invalidation(trackId only) → 약 5초 shared settle → exact changed-card shared R2 read(D1 R0/W0) → B/C public count patch. idle polling 0, retry 최대 4, 전체 Feed 재조회 없음.
- 개인 하트는 계정별 독립. A의 filled heart를 B/C에 복사하면 FAIL. 동일 UID PC/mobile은 기존 개인 live signal + outbox 우선 규칙을 유지. app159은 공개 count 경로에서 `setLikedTrackIds`를 호출하지 않음.
- **다음 작업은 코드 추가보다 실제 PREVIEW 검증 우선**: A PC/모바일 동시 접속 → 좋아요 1건/해제 1건 → A 두 기기 개인 하트/내 좋아요 일치, B/C PC/모바일 공개 숫자 같은 값, B/C 개인 하트 변화 없음. 페이지 이동 없이 기존 30초 batch + shared settle 뒤 자동 반영 확인. B/C가 직접 좋아요/해제해 역방향도 동일 확인.
- 실사용에서 실패하면 해당 한 곡만 client outbox → W1 queue → canonical D1 → shared R2 card/profile/feed → RTDB invalidation → receiver changed-card 순서로 추적. 전체 likes scan/full Feed 재생성/주기 polling/사용자 원본 강제수정 금지. unchanged D1 R0와 W1~W2 비용 기준 보호.
- TEST 승격은 위 실제 PC/mobile×교차계정 좋아요/해제 PASS 후에만. PRODUCTION은 사용자 명확 승인 전 금지.
- 별도 유지보수: `.github/workflows/diagnose-069-live-like.yml`은 push마다 즉시 FAILURE가 계속되므로 좋아요 실사용 합격 후 독립적으로 원인 정리. 릴리스 gate 성공 여부와 혼동 금지.


## 최신 2026-09-24 — Worker191/app158 PREVIEW 배포 완료, 서버 shared likeCount 6→0 확인

- 현재 기준은 `CURRENT_RELEASE_STATE.md 0FI`. Worker release Run `35987221833` SUCCESS / active `5bacea12-59a2-41ce-91ed-9fc7cb2e36bb`; app Hosting Run `35987409727` SUCCESS / app158 exact build PASS. TEST/PRODUCTION 비변경.
- 실제 shared public count는 배포 직전 latest/popular 각각 37 overlap 중 6 mismatch였고, one-time bounded 191 repair 후 둘 다 `MISMATCH=0`. D1 canonical↔derived mismatch 0. 사용자 원본 D1 변경 없음.
- 개인 stale baseline 순서 버그 수정도 app158에 포함. 다음 우선순위는 **코드 추가 전 실사용**: 같은 계정 PC↔모바일에서 신규 좋아요/해제 후 하트와 '내 좋아요' 목록 일치, 다른 계정에서 공개 숫자 일치, 페이지 이동 없이 activity/revision 경로가 허용된 시간 안에 수렴하는지 확인.
- 실사용에서 불일치가 재현되면 정확한 한 곡만 queue→canonical→personal R2→shared R2→client revision→UI 순서로 추적. full Feed/전체 likes 재조회, 사용자 원본 덮어쓰기, 새 글로벌 listener 금지. unchanged D1 R0와 W1~W2 mutation 합격선 유지.
- TEST 승격 금지: 실제 PC/mobile×교차계정 좋아요/해제 검증이 먼저. PRODUCTION은 사용자 명확 승인 전 금지.


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
## IMPLEMENTATION CANDIDATE — 팔로우 비용 / 크리에이터 추천 미완료, PREVIEW 배포 차단 (2026-10-04 KST)

기준: preview `2817327ee17f04fe248df237a3daefa3cf5bf3c5`에서 이어진 이 기록의 구현 commit. 실제 앱은 app344 유지. 전체 상황은 CURRENT_RELEASE_STATE 0OW 참조.

구현된 부분:
- follow/unfollow atomic query W3→W2, RETURNING/no-postread/R2-only patch 유지.
- same-millisecond 중복 follow의 counter 이중 증가를 changes() guard로 제거.
- SQLite fixture에서 3 cycle functional + duplicate + rollback + indexed counter access + Feed journal 불변 PASS.
- creator 후보 curated/latest/popular 확대, cached 대표장르 exact/family 우선, self/dedupe, 순위 실제 catalog alias 테스트 PASS. UI 불변.
- TypeScript/Build/관련 verifier PASS.

**완료·배포 금지 사유**
1. SQLite total_changes **9→9**. physical trigger amplification을 아직 줄이지 못함. query W2가 physical W2라는 보고 금지.
2. 실제 PREVIEW Rows Read/Written + Worker + R2 A/B 및 D1 batch changes() 연속성 미검증.
3. cold 기기에 로그인 사용자/후보 대표장르를 제공하는 일괄 R2 summary가 없음. 현재 cached genres만 우선하고 나머지는 curated/latest/popular fallback.
4. PC/모바일 실사용 검증 전.

다음 수행 순서:
1. 기존 preview/test/production canonical counter와 derived-change 독자 호환을 확인해 physical 비용 감소 설계 확정. 관계+양쪽 canonical counter 보존만으로 최소 3 canonical 행이므로 W1/W2 physical 목표와 충돌을 숨기지 말 것.
2. schema/trigger authority cutover가 필요하면 additive/backward-compatible 및 실제 안전 조건을 검증. 사용자 허용 범위를 벗어나는 교체/대량변경/backfill은 실행하지 말 것.
3. `verify-345-follow-cost.mjs`를 재사용해 실제 production 함수를 검증. missing stats cold-repair 제한, D1 batch changes() 및 index billing을 추가 검증. 논리/SQLite/실제 billing 세 수치를 분리.
4. 후보별 profile GET 없는 bounded R2 genre summary 공급 설계/구현. 전체 사용자 scan 금지, 무단 백필 금지. 자기 대표장르도 cold 기기에서 확보 가능해야 함.
5. TypeScript/Build/Test + 독립 검토 후, 실제 PREVIEW follow/unfollow 3 cycle 증거를 수집. `node scripts/verify-345-follow-cost.mjs --release --live <evidence.json>`은 비용 gate 미달이면 실패해야 함.
6. live evidence format: `{environment:"preview",commit:"<40-char SHA>",samples:[6 records]}`. 각 record는 action(follow/unfollow 교대), queryR/queryW, rowsRead/rowsWritten, worker, r2A/r2B, requestId, timestamp. 실제 요청 단위 메타/계기판 차이를 기록하며 기대값을 입력해 증거를 만들지 말 것.
7. 두 작업을 모두 완성·검증한 후 필요한 PREVIEW Worker/Hosting만 기존 release path로 배포. main/TEST/PRODUCTION 및 사용자 원본 데이터 변경 금지.

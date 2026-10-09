> **SUPERSEDED — 2026-10-09 KST:** 최신 사용자 승인 기준은 `DOCS/LIKE_PRIVATE_IMMEDIATE_PUBLIC_5MIN_STAGE416.md`. 이 문서의 개인 5초·공개 10분 타이머/구현 순서 지시는 현재 지시가 아니다. 이전 설계/감사 내역 보존 목적으로만 유지.

# Stage415 — Explore 개인 즉시 / 공개 좋아요 곡 중심 10분 이벤트 집계

상태: **사용자 설계 승인, 구현 준비 / 안전성·비용 검증 전. 제품 미변경·미배포**
기준: preview `8391035d1720eb992265272f13f94378d0d2c163`, 활성 PREVIEW app385. 2026-10-09 KST.
우선순위: **Explore 좋아요만 우선**. 팔로우는 좋아요 실제 검증 뒤 별도 작업. Studio 저장 하트와 Explore 공개 좋아요는 별개.

## 1. 사용자 요구를 수치화

1. 자기 기기에서 좋아요/해제 즉시 표시. **같은 계정의 PC↔모바일도 페이지·탭 이동·새로고침 없이 즉시 반영**. 서버 접수와 공개 숫자 갱신을 기다려서 개인 하트가 바뀌는 구조 금지.
2. 좋아요 원본은 실사용 데이터로 정확히 확정. 한 계정 한 곡 한 좋아요, 역전/중복/동시 변경/응답 유실 시 정확한 최종 상태. 앱 빠른 종료·기기 변경에도 대기 변경을 잃지 않게 durable outbox + 신뢰할 수 있는 접수/복구 경로 필요. **로컬/RTDB preview를 서버에 저장된 원본으로 거짓 표시하지 않기.**
3. 다른 사람에게 보이는 **공개곡의 공유 likeCount**는 즉시 갱신할 필요 없음. **첫 번째 유효한 서버 접수 변화**가 들어올 때만 **공동 고정 10분 창** 열기. 10분 안 다른 곡/다른 사용자 변경을 모아 창의 처음부터 10분 후 최종 공개 숫자를 변경된 곡에만 갱신. 중간 변경이 창을 연장하지 않음.
4. 집계가 끝나면 **완전히 유휴**: 새 변경이 없으면 다음 alarm/cron/서버 DB 검사/RTDB 공개 방송 0. 동일 곡 좋아요→해제 등 공개 net-zero 최종값이면 공개 R2 PUT/알림 0을 우선 목표. 기존 캐시 정상인 화면 재방문/앱 업데이트도 원본 R0/W0.
5. 공개 수치는 **완료된 정착(canonical)의 결과**에서만 산출하고 R2/Feed/프로필/카드 및 모든 탭·계정에서 일치. 하트 채움(개인)과 공동 숫자(공개)를 논리적으로 분리하되 사용자 화면의 명백한 모순/음수는 없어야 함. 숫자가 10분 전 값이어도 의도된 정책.
6. 비용 목표: 사용자 행동당 D1 physical rows_written W1~W2 하드 게이트(**W3+ FAIL**), 전체 Feed/곡/회원 수에 비례하는 재조회·재생성 없음. 단위 행동 수뿐 아니라 10분 동안 10/100/1000명이 여러 곡을 누른 경우 **전체 D1 rows_read/rows_written, Worker 요청/CPU, DO 알람/저장, R2 A/B, RTDB sent bytes, Functions 호출, Edge 재요청**의 총비용 비교.
7. 실패·재시도: 이미 성공한 canonical mutations 재전송으로 중복 쓰기 금지. 공개 알림 실패는 notification-only 재시도, 원본 변경 성공을 되돌리지 않음. 한 곡이 첫 40/80개 Feed 목록 밖이거나 창의 마지막 순간에 들어와도 누락 금지.
8. 마이그레이션/데이터 복제·덮어쓰기 없음. PREVIEW/TEST/PRODUCTION 사용자 원본·RTDB/R2 공유 및 구버전 앱 공존. 새 구독·알림 경로와 기존 앱 수신자를 포함한 전체 parity가 증명되기 전 공유 Rules/Worker 공개 경로 변경 금지.

## 2. 이미 확인한 현실

- `src/services/exploreLikeService.ts`: 현재 개인은 로컬 즉시, 서버 묶음 전송은 **마지막 클릭 +5초** (Stage413 종료 대비). `keepalive` + hidden/pagehide pending 조기 전송. 개인 RTDB 변경곡 신호(`publishConfirmedLikeSignal127`)는 **서버 ACK 후 발송**. 따라서 다른 기기의 진정한 클릭 즉시 동기화가 0~1초 안에 이뤄진다고 아직 보장 불가.
- 같은 파일의 `publishExplorePublicLikeInvalidation192` 역시 현재 클라이언트가 **접수 직후** 전역 RTDB node에 게시. 이것을 그대로 두면 10분 미확정 공개 카드에 조기 갱신 요청/전역 다운로드가 발생할 수 있음.
- `cloudflare/explore-worker/canonical/preview-entry.js`의 `ExploreLikeBatchScheduler103`: 현재 *변경 발생 시* DO 단일 고정 **5초** 창. 변경 없을 때 periodic cron 없이 idle 0을 이미 목표로 함. 기존 장점을 재사용.
- 현재 `runAggregate194()`는 canonical Worker scheduled handler(실제 `likes` 관계 + `track_stats` 변동) 실행 직후 `repairSharedPublicLikeCounts191()`를 수행. **개인 원본 관계 정착과 공개 숫자 정착이 현재 결합**돼 있어 DO 5초 상수를 10분으로 바꾸는 수정은 **금지**.
- `repairSharedPublicLikeCounts191`는 latest/popular 첫 40곡(합집합 최대 80)만 접근. **변경된 모든 곡의 목록이 아니므로** 공개 집계 이벤트의 유일한 출처로 사용할 수 없음.
- Worker `patches/040-explore-like-w1-delayed-count.mjs` D1 batch에서 `track_stats` 변경 두 명령 + `likes` insert/delete + 큐 소비가 결합. `runtime/like-confirmed-event-397.mjs` RETURNING ID 추출은 현재 **별도의 미연결된 후보**, Cloudflare physical meta 아직 미검증.
- 이전 `DOCS/RTDB_PUBLIC_LIKE_SAFE_CUTOVER_DESIGN_2026-10-08.md`는 전역 RTDB fanout/오용 방지를 위한 서버 발행·좁은 구독·순차 Rules 전환의 선행 위험을 기록. 해당 문서의 역사적 공개 즉시 갱신 목표는 **이번 사용자 지시의 10분 공개 갱신 기준으로만** 변경되며, 개인 하트 즉시는 더욱 강한 계약이 됨.
- 공유 사용자 원본 코드의 기존 TEST/PRODUCTION 및 구형 클라이언트가 현재 D1/RTDB/R2 읽기·쓰기 경로를 사용할 수 있으므로 **PREVIEW 단독 변경만으로 10분 공개 숫자 정책을 전역에서 달성했다고 주장 금지**.

## 3. 설계 결정 — 세 영역 분리

### 개인 즉시 상태 (A)
- 현재 local-first + durable outbox 유지. RTDB 변경곡 preview를 **클릭 직후** 안전하게 전파하는 후보 검토. 동시 PC/모바일 최신 의도가 역전되지 않도록 서버 ACK와 장치 preview의 우선순위·event ID·same-track ordering 증명.
- 개인 private RTDB 신호는 공개 likeCount의 권위가 아니며 공개 전역 팬아웃을 유발하지 않아야 함.
- 서버 canonical mutation/queue intake는 안전하게 **빠르게 수신** (기존 5초 혹은 더 짧은 안전 경로). 종료 이벤트는 실패 가능하므로 pre-ack 로컬 복구와 성공 뒤 중복 replay 방지가 필수. **클라이언트 접수 타이머를 우선 10분으로 늘리는 작업 금지**.

### 원본 정착 (B)
- 기존 accepted W1 queue + D1 canonical `likes` membership 정착(현재 5초 DO) / ACK 회복을 우선 보존. D1 W1/W2와 no-op W0, per-account ordering, multi-device convergence.
- 현재 `track_stats` 변경이 canonical 관계와 같은 D1 batch에서 발생하므로 **D1 count mutation이 5초에 일어날 수 있음**. 이 경우 공개 숫자 전송을 늦춰도 D1 track_stats W 자체가 줄었다고 주장 금지. 별도 D1 count coalescing으로 더 절약할 수 있는지는 동시성·정확성·이전 Worker 호환성 입증 뒤 별도 결정.

### 공개 숫자 (C)
- **단일 이벤트형 고정 10분 공동 창**: canonical 변화를 확정하는 서버가 첫 새 실변경에 따라 공개 projection 후보를 dirty 기록하고 `firstChangedAt+600000`에 *1회* alarm. 같은 창 안의 모든 곡 변경을 결합하되 deadline 연장 금지; 갱신 중 들어오는 변화는 다음 창에서 재생.
- 도중 장애 시 dirty track IDs/공개 cursor/정산 event ID가 **durable**해야 하고, max50 초과·첫 80 밖·late arrival를 무시하면 FAIL. 이 데이터 보관의 DO storage 비용을 실제로 측정. 곡 전체/전체 계정 SELECT 금지.
- 타이머 확정 시 해당 곡의 **마지막 서버 수치만** R2 공개 카드/Feed/프로필 등에 bounded patch. R2/Edge 공개 숫자 캐시의 정확한 권위·stale/etag CAS·기존 앱 동작을 검증하고, 공개 알림은 서버가 실제 확정된 변경곡 대상으로 notification-only 발송; 개인 클라이언트는 타계정 공개 numeric 신호를 직접 조기 발생시키지 않게 이전 버전까지 호환.
- 유효한 dirty 곡이 없으면 alarm 없음. 처리 후 새 변화가 없으면 alarm 0/DB 검사 0. 수신자에게 전체 곡 목록 전송 대신 현재 보고 있는 곡 또는 bounded bucket subscribe 구조를 비교 측정.
- **공유 데이터 주의**: D1 `track_stats`가 최신으로 먼저 바뀌어도 R2/Feed/프로필/직접 공개조회가 이를 10분 이내 조기 공개하지 않는다는 계약까지 필요. 구버전 Worker/public GET이 숫자를 일찍 노출하거나 R2를 조기 갱신하면 정책 전체 FAIL.

## 4. 대안 및 선택 기준

- **금지 A:** 좋아요 5초 timer를 10분으로만 변경 — 개인 original ack/정착/기기간 정확성 지연.
- **금지 B:** 공유 5초 DO delay를 10분으로만 변경 — canonical membership + track_stats까지 지연.
- **금지 C:** 매 10분 cron/전체 Feed 스캔 — 유휴 비용·대량조회.
- **우선 D:** canonical 현행속도 유지 + 공개 projection 이벤트형 10분 별도 창 + 검증된 변경곡 ID + 서버 confirmed 알림. 현행 DO/state/Worker/Functions 사용하되 실제 추가 비용이 절약액보다 많거나 안전하게 연결 불가하면 즉시 STOP.
- **선택 E:** D의 DO tracking 비용이 너무 크면 `public materialization`을 기존 accepted queue/journal 과정에서 자연 발생한 changed-ID bounded changelog로 처리. **추가 D1 W·이전 버전 호환 실패면 불합격**. 10분 public delay가 실제 비용을 줄이는지 기준 데이터로 판단.

## 5. 검증 게이트 (Codex → Work → 사용자 PREVIEW → TEST)

1. 독립 개인 상태: 클릭 후 **A 기기 0초 / B 기기 서버 batch 타이머를 기다리지 않는 즉시** 꽉찬 하트·해제 수렴, PC→mobile & mobile→PC, 서로 다른 계정은 영향 없음. 사용자 공개 숫자는 10분 전 값이어도 정상.
2. 동일 곡 A 좋아요→해제/교차기기 동시 클릭/오래된 RTDB replay/ACK 유실/종료 0~1초/오프라인·재실행·새 기기: 개인 authoritative 최종 상태/재전송 W0-W2, 중복 Count 없음.
3. 공개 창: 좋아요 없음 30분 → DO alarm/DB/R2/RTDB 공개 이벤트 0; t=0 첫 변화, t=9:59 다수 변화, t=10:00 고정 1회 finalize; t=10:01 새 변화→다음 창. A/B/C 최초 도착 시간 차이 허용. 한 곡 공개 net-zero → 최종 R2/알림 W0 가능하면 적용.
4. 공개 곡 1/10/100/1000개, first page 밖 1곡, 인기/최신/장르/추천/검색/공개프로필/개인 좋아요 페이지 및 구형 클라이언트 공유숫자 parity. 50개 초과 silent-drop 0.
5. 실제 격리 D1 `rows_read` / `rows_written` W1-W2 하드 게이트, D1 projection/aggregate 총합, DO alarm/storage/CPU, R2 Class A/B, RTDB bytes, Worker/Functions. 실제 과금 대비 순 절감이 유의미한지 비교. 공통 처리 경로에서 cache refresh·page revisit R0/W0.
6. 최소 수정/feature flag OFF·구버전 공존 → 스냅샷/Rules 호환 → 독립 Work 감사 PASS → **공유 원본/규칙 변경 없는 PREVIEW 단계**부터. 필요 스키마 추가·RTDB Rules·Functions secret/worker 활성 변경은 사용자 승인 및 TEST/PRODUCTION 하위호환 게이트 선행.
7. rollback: 공개 projection flag를 이전 안전 집계로 전환해 queued events 복구, durable dirty journal 유실 없음; rollback 자체가 user data migration/rebuild를 트리거하지 않음.
8. TypeScript / Build / 필요한 Like 127/175/178/191/192/197/390/397/413 / Follow 354/377/380 / Studio 349 / folder app301 검사. PC·mobile 실제 사용 전 기능 완료 표기 금지.

## 6. 구현 순서 — 반드시 순서 유지

**Phase A (지금 먼저):** 현재 Worker ingestion/DO/alarm/R2/RTDB event 경로의 실제 code + field/receipt 동작 감사. 동일 계정 B기기 즉시 전달이 `5초 batch ACK`를 기다리는지 실제 테스트 시나리오/격리 단위 테스트로 증명. W1 canonical 및 R2 공개 숫자 reader가 분리될 수 있는 최소 경로+기존 기능/구형 앱 영향표 제시. D1/RTDB/Worker 실환경 쓰기 금지.

**Phase B:** 신규 private immediate preview + 공개 10분 window plan을 실제 코드에서 FEATURE FLAG OFF로 최소 구현, isolated fake-clock race/exact-returning/cost fixture 통과. 기존 서비스 활성 경로 변동 0. 안전 불명확시 구현 중단.

**Phase C:** 독립 Work 감사 → 호환성·원본 보호·비용 확인 → 승인 범위 내 PREVIEW만 배포하고 사용자 실기기 검증. **좋아요 PASS 이전에는 팔로우 수정 금지.** TEST/PRODUCTION은 별도 명시 승인.

보고 시 범위/branch/기준 SHA/최종 SHA/변경 파일/TypeScript Build Test/Worker·Firebase·D1 상태/비용 실제 수치와 미검증/위험/다음 단계 필수.

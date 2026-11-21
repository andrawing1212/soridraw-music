# APP763 — 팔로우 예약 기록의 10만 명 비용·용량 및 복구 안전성 (SOURCE REVIEW ONLY)

> 범위: 기존 APP755/759/761/762 정식앱용 기본 OFF 소스의 **가정 기반 계산과 독립적인 오프라인 복구 확인**. 2026-11-22 확인. PROD·PREVIEW·TEST Cloudflare/Firebase/RTDB/D1/R2/Functions/사용자 데이터를 읽거나 변경하지 않음. APP737/738 실제 정식 배포 **HOLD** 유지.

## 실제 코드 기준

- DO 원본: `scripts/app755-production-owner-receipt.mjs`, `APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN=false`. 한 owner당 `app755-owner-follow-pending-v1`의 hot queue 최대 24개를 유지한다. 24개 전부 pending이면 신규 예약은 의도적으로 안전 차단한다.
- APP762 완료/held 항목: 첫 24개 도달 이후 owner별 독립 DO 안 `app762-owner-follow-final-<canonicalOperationId>` 한 키에 원본 receipt 전체를 영구 보존한다. 키/최종 상태/원래 server-issued operation ID를 남겨 오래된 중복 시 다른 예약 번호를 만들지 않는다. 별도 삭제·TTL·전역 scan 없음.
- APP759 알람: 503 후 bounded retry, generation mismatch는 held, 성공 ACK는 저장된 후 확정. APP761 owner identity check 없이는 DO 접근 금지. APP760 독립 QA 503→복구·원래 QA Worker 복원 실제 PASS는 별도 증거이며 APP763 소스가 실제 PROD에서 사용된 증거가 아니다.
- **현재 후보의 저장 백엔드:** PREVIEW APP600 과거 초안 `cloudflare/owner-follow-worker/wrangler.candidate.jsonc`에는 `new_sqlite_classes`가 있으나, APP762/763 PROD owner DO class·namespace·binding은 **아직 없음**. 실제 운영 SKU/요금제/경로 확인 없이 SQLite 확정으로 보고하지 않는다.

## 10만 명 가정 시 비용/용량 모델

재현: `node scripts/verify-763-owner-receipt-capacity.mjs`; 계산 원본 `scripts/app763-owner-receipt-capacity.mjs`.

가정(실측 아님): 서로 다른 owner 100,000명이 각각 1년간 정상 상태를 변경한다. APP755 샘플 receipt UTF-8 JSON **417B** + 최종 보존 키 **53B** + APP764 보존 ID 확인 기록 **약 35B** = 논리 **505B/건**. SQLite 페이지/인덱스/일반 메타 오차를 포함할 목적으로 **3배 용량 계수**와 owner 인스턴스당 **12,000B** 기본 메타 가정을 더한다. 요청당 3 DO 요청(알람 포함), 행 읽기 8·행 쓰기 6, 이벤트당 실제 실행시간 40ms, 128MB-DO로 가정한다. 월간 횟수는 연간 이벤트를 12개월로 나눈다. 이 값들은 제품 통계·Cloudflare 실제 청구/물리 용량이 아니다. **지속적인 미완료 작업, 실패 재시도, APP755 hot-list 덮어쓰기, storage pages, worker 호출·Firebase·운영 DO의 다른 이용량 및 GB-month 시간평균은 정확히 계측되지 않았다.**

| 연간 변화 횟수 / owner | 10만 명 전체 연간 변화 | 1년 말 가정 총 저장량 | Paid SQLite DO의 월 초과분(1년 말 저장량 기준, 다른 이용 0 가정) |
| ---: | ---: | ---: | ---: |
| 5 | 500,000 | 약 1.958 GB | 약 $0 |
| 50 | 5,000,000 | 약 8.775 GB | 약 $0.91 (저장 $0.755 + 요청 $0.15) |
| 500 | 50,000,000 | 약 76.950 GB | 약 $16.19 (저장 $14.39 + 요청 $1.80) |

위 금액은 **Paid plan의 DO 관련 무료 제공분을 다른 사용 서비스가 전혀 소비하지 않는 경우의 시나리오**이며 청구 보장치·상한이 아니다. Paid Workers 기본 요금, Workers 호출·Firebase·RTDB·D1·R2·대기 시간·실제 storage 총계/메타·트래픽 비용은 제외한다. 실제 DO backend가 legacy KV라면 데이터 읽기/쓰기 request-unit 요금과 1GB 포함 기준이 달라 이 모델의 숫자를 적용할 수 없다.

**현재 Cloudflare 공식 안내 (2026-11-22 조사):**
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): Workers Paid DO 월 요청 100만 회 포함 후 100만당 $0.15, 실행 40만 GB-s 포함 후 100만 GB-s당 $12.50. SQLite 읽기 250억 rows/월 포함, 쓰기 5천만 rows/월 포함, 저장 5GB-month 포함 후 $0.20/GB-month. DO 알람 호출도 request, `setAlarm()`도 row write로 집계된다. KV-backed는 별도 요금(읽기/쓰기 RU, 1GB 포함)이 적용된다.
- [Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits/): SQLite-backed 객체당 최대 10GB, 계정 Paid 총 저장량은 무제한 과금(Free 5GB 제한). Free에서 요청·읽기·쓰기 일일 한도를 넘으면 요청이 실패할 수 있다. **10만 명에게 매년 500건씩** 발생하는 예시의 1년 말 저장량은 Free 5GB 한도를 크게 넘는다.
- [SQLite DO Storage/PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/): SQLite-backed DO는 저장 KV 포함 30일 이내 시점 복구를 지원. 단 **개별 DO 저장소 복구가 Canonical D1/R2·Firebase의 원본 상태를 함께 되돌리는 것은 아니다**. 실제 복구시 이를 검증하기 전 `onNextSessionRestoreBookmark()` 호출 또는 `deleteAll()` 금지.

## 장기 보관과 복구 필수 불변 조건

1. 기존 완료·held receipt를 삭제/TTL/일괄재생성하지 않는다. 사용자가 같은 canonical operation ID를 다시 보내면 반드시 **원본 server operation ID와 원래 결과**를 찾아야 하며, 저장소가 불분명하면 `HOLD`다.
2. 장애 전 **원본 DO 저장소의 owner·hot queue + 모든 개별 최종 보존 키/값**을 보호된 독립 근거로 고정한다. 비밀번호나 실제 UID/토큰은 GitHub 로그·PR·파일에 출력하지 않는다. 오프라인 비교에는 owner 정체성 해시·전체 구조 fingerprint·키 개수·receipt 개수만 포함한다.
3. 복구 뒤 키 하나라도 누락·값 변조·owner 혼합·중복 ID·pending 상태 변화가 있으면 오프라인 검사 **HOLD**. 정상 1:1 fingerprint 일치도 **DO 로컬 저장이 같다는 증거**일 뿐, D1/R2 최신 canonical 확정 revision·Auth epoch·Functions receiver 상태와 일치한다는 증거는 아니다.
4. **APP764 개선과 남는 위험:** `archiveUsed=true`부터 owner별 hot 목록에 보존된 canonical operation ID의 단방향 128비트 확인 해시 목록 및 SHA-256 검증값을 **같은 DO transaction**으로 남긴다. 개별 보존 키 하나가 손실되어도 그 ID가 확인 목록에 있으면 `find/reserve`는 `HOLD`하고 과거 예약을 새로 발급하지 않는다. 레거시 APP762의 확인 목록 없는 `archiveUsed=true` 상태도 자동 재생성 없이 `HOLD`. 그러나 **전체 DO 시점 복구(PITR)로 보존 키·확인 목록이 동시에 과거로 돌아가거나, hot 본문 자체가 사라지는 경우**에는 로컬 확인 목록만으로 독립 정본(D1/R2) 변경 이력을 증명할 수 없다. 활성화 전 정본 최신 revision·owner authEpoch·서버 예약 증거의 독립 대조/복구 기준이 반드시 필요하다. 이 위험을 해결한다며 정상 사용자 원본이나 기존 DO를 되돌리지 않는다.
5. 10만 명 규모의 실제 GO에는 계정 내 전체 DO 스토리지/rows/requests/알람/실행시간 **관찰된 지표**와 가격·과금 플랜 확인, 임의 삭제 없는 장기 보관 정책, 서로 다른 시스템의 정확한 정본과 owner epoch 대조, 원본 서비스 버전 고정/역방향 복구 훈련이 필요하다. 오프라인 합성 테스트 PASS로 이 조건을 대체하지 않는다.

## 완료/미완료 판정

- APP763: 가정 모델·5/50/500건 시나리오·10년 누적·객체 상한·변조/누락/롤백 오프라인 검사까지만 **PASS 가능**.
- 실제 저장소 물리 바이트/Cloudflare Usage Analytics·일일 한도·PROD DO backend/요금제·실제 복원/비용 측정·정식 PC↔모바일 기능·Production 승인: **UNVERIFIED / HOLD**.
- 모든 검사는 코드를 통해 로컬/CI 메모리 안에서만 수행한다. DO `list()`, PITR, 스냅샷 채집, 신규 리소스 생성, Firebase/Cloudflare 실제 원본 읽기·쓰기는 포함하지 않는다.

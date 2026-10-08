# app382 공개 좋아요 RTDB 공통 알림 — 2차 읽기 전용 비용/남용 감사

기준: 2026-10-08 KST. 소스 GitHub preview HEAD `39e6734ea29ec83f64806886f6635eae9326359c`. PREVIEW live 앱382 Hosting / 기존 Worker 유지.
감사 판정: **설계 위험 확인 (P0) / LIVE Rules·10만 명 부하 안전성 미검증**. 수정이나 배포는 이 보고서에 포함되지 않는다.
기존 frozen: app164 신규곡 첫 좋아요, app160 개인 하트·타계정 공개수·PC↔모바일, 현재 app379 30초/W1, app380 팔로우 30초/W1, app382 396 중복 Worker 차단.
실측: PRIVATE ops repo `andrawing1212/soridraw-ops-private/reports/2026-10-08-rtdb-baseline.md` (GitHub Actions run 37734211971). 공개 저장소에는 세부 운영 수치를 재기록하지 않는다.

## 1. 실제 원인 — 확인된 코드 기준

1. **발행:** `src/services/exploreLikeService.ts`의 `flushPendingLikes`는 `/v1/me/likes/batch` 서버 ACK 뒤 `publishConfirmedLikeSignal127` 계정별 알림, 그 다음 `publishExplorePublicLikeInvalidation192` 전역 알림을 시도한다. 30초 미도래/앱 닫힘이면 전역 알림도 없음. 발행 실패는 이미 성공한 canonical D1 쓰기를 재시도하지 않음(정상 보호).
2. **전역 경로:** `src/services/explorePublicLikeSyncService.ts`의 `PUBLIC_LIKE_SIGNAL_PATH_192='publicSync/exploreLike'`. `runTransaction`으로 최근 3분 동안 다른 사용자 이벤트까지 합쳐 **최대 50곡**의 `trackId, ownerUid, acceptedAt` 묶음을 같은 노드에 쓴다. 전송되는 것은 공개 숫자가 아니라 변경 알림이고 개인 하트를 바꾸지 않는다.
3. **수신:** `src/pages/ExplorePage.tsx`는 로그인 시 `subscribeExplorePublicLikeInvalidation192` → RTDB `onValue`를 등록한다. **알림 전체 수신 이후** 화면 곡의 trackId만 골라 `/v1/public-like-cards`의 해당 변경 곡 R2 정착값을 읽고 공개 likeCount를 업데이트한다. 없는/무관한 곡은 Worker를 조회하지 않지만 RTDB 메시지 수신은 발생할 수 있다.
4. **앱382 중복 방지:** `hasSettledExplorePublicLikeSignal396`은 이 기기에서 이미 R2를 확인한 오래된 신호의 **Worker 재요청만** 막는다. 전역 onValue의 다운로드까지 막는 구조는 아니다. 최초/오래된 미정착 캐시는 한정된 재시도를 계속한다.
5. **쓰기 권한:** 현재 저장소 `database.rules.json`의 `publicSync/exploreLike`는 `.read: auth != null`, `.write: auth != null && newData.child('actorUid').val() === auth.uid`. 50개 인덱스/각 필드 길이 타입은 검증하지만, 유효한 D1 mutation ACK, 실제 존재 곡, 해당 배우의 좋아요 소유, 전역 발행 속도, 최대 전체 전송 바이트 수를 보증하지 않는다. 인증된 변조 클라이언트가 정상적인 좋아요 확정 없이 전역 신호를 재기록할 수 있는 소스 수준 위험.
6. **과도한 신호의 파생 효과:** 악의적 신호가 수신자의 현재 곡을 포함한다면 `ExplorePage`의 bounded public-like-cards 재확인(최대 4회)도 유도할 가능성이 있다. 정상 R2 카드가 예전 updatedAt이면 여러 번 재시도한 뒤 중단한다. R2-only의 D1 R0/W0 목표도 서비스 실행 비용 0은 아님.
7. **동시성:** 모든 사용자 발행이 동일 RTDB node의 `runTransaction`에서 충돌하며, 전역 데이터 갱신 시 기존 최신 3분 이벤트를 다시 포함할 수 있다. 사용자 수/좋아요 빈도 증가 시 hotspot·중복 다운로드 문제. Firebase 실제 server contention·성능 임계값은 미계측.

## 2. 사실 / 가정 / 아직 측정되지 않은 것

| 항목 | 판정 | 근거·주의 |
|---|---|---|
| 첫 PRIVATE RTDB Monitoring 진단 | PASS | run 37734211971; Cloud Monitoring 인증/시간계열 조회 |
| 현재 전체 RTDB 다운로드량 | 실측됨 | 정확한 수치는 PRIVATE 보고서만, 앱 전체/모든 RTDB 기능 합계 |
| 특정 공개 알림 트래픽 분해 | **미검증** | Cloud Monitoring 전체 합계만으로 `publicSync/exploreLike` 직접 바이트량을 식별할 수 없음 |
| GitHub rules에 public writer 허용 | **확인** | `database.rules.json` |
| Firebase 실제 배포된 Rules가 같은지 | **미검증** | live `/.settings/rules.json` READ-ONLY GET 비교 필요 |
| 10만 회원 실제 예상 월 청구액 | **미검증** | 동시 Explore 구독, 시간대 활동, 신호 실측 바이트 및 Billing에 좌우됨 |
| 보안 남용 실제 발생 | **증거 없음** | 공격하지 않았음. 잠재 취약 경로가 있음 ≠ 남용 발생 확인 |

**경계:** 이전 대화의 월 수천~수만 달러 스트레스 계산을 현재 청구액으로 해석하지 않는다. 공식 문서 `network/sent_bytes_count`는 outbound billing에 가장 가까운 계측이나 최종 invoice가 아님.

## 3. 10만 회원 비용 모델 — fanout 상한이 핵심

`월 공개 신호 전송량 GB≈일일 정상 공개 신호 건수 × 신호 발행 시점 평균 Explore RTDB 구독 기기수 × 발행시 수신되는 신호 전체 KB × 30 / 1,000,000`.

- **중요:** 구독 대상은 가입자 10만 전체가 아니라 실제 살아있는 Explore 리스너 수. 모든 방문자가 상시 수신한다는 가정은 과장.
- **평균 신호 KB**는 1곡의 변경 크기가 아니라 *기존 3분 이벤트를 포함한 전체 node의 수신 크기*. 평균 50곡이라 단정할 수 없다.
- **보수적 설계 테스트:** 동시 구독 10/100/1000/10000, payload 0.2/1/5/50KB, 메시지 1회/분과 100회/분 조합. 사용자 체류에 따라 분포 시뮬레이션.
- 예시: 변경 1회 × 평균 1,000명의 수신자 × 신호 5KB ≈ 총 5MB 전달(프로토콜 제외). 100회/분이면 약 500MB/분. **부하 예시일 뿐 현행 사용량 아님**.
- **크기 위험:** `trackId` 최대 512자 + `ownerUid` 최대 128자 × 최대 50행; 악의적 클라이언트가 긴 문자열로 전역 node를 불필요하게 확대할 가능성이 있다. Unicode·wire-format·오버헤드에 따라 실제 바이트 수 변동.
- `sent_bytes_count`를 기준으로 실제 보고서와 대조한다. 전체 RTDB 합계는 `musicNote`, `presence`, `exploreFollow` 등이 함께 포함되므로 공개 알림 전용 청구량 추정과 혼동하지 않는다.

## 4. 개선 설계 후보 (아직 채택·구현 안 함)

| 후보 | 기대 효과 | 보호/위험 |
|---|---|---|
| A. 전역 알림 그대로 + 규칙에 길이/속도 제약 | 일부 남용을 줄임 | **전역 fanout 그대로**, 임의 인증 사용자 발행을 서버 ACK와 연결하지 못함; 최종 해결책 아님 |
| B. **서버 ACK가 확인된 신호만** 발행 + 현재 화면의 변화와 매핑된 작은 범위만 구독 | 남용·무관 사용자 전달 함께 감소 | 클라이언트 개인 RTDB 권한 및 Cloudflare Worker 보안 인증/송신 경로를 설계해야 함. Worker에 영구 키를 그대로 넣는 안 금지 |
| C. 곡/영역 샤드별 event bus + 현재 화면에 필요한 샤드만 제한 구독 + 신뢰 가능한 서버 발행 | 전체 방송 감소. 화면에 필요한 공개숫자만 유지 | 구독이 잦은 스크롤, 인기곡 hotspot, 동시 이벤트 순서, 사용자 네트워크 연결 비용·오프라인 gap 측정 필요. 샤드 수는 비용 계측 전 확정 금지 |
| D. RTDB 전역 알림 제거, 일정 간격 Worker/D1 polling | RTDB 비용 절약처럼 보임 | **불합격:** 타계정 공개 숫자 실시간 갱신 손실, 반복 Worker/D1 읽기 비용 전가 가능 |

**권장 방향:** B의 신뢰 가능한 최종 ACK 이벤트를 기본 보안 조건으로 확보하고 C 같은 구독 범위 축소를 비교 실측한다. 설계 중 RTDB를 전역에서 개인으로 단순 전환하면 다른 계정의 공개 숫자 신호가 사라져 기존 정상 기능을 깨므로 금지.

**배포 안전:** PREVIEW/TEST/PRODUCTION 사용자 RTDB 데이터 공유. Rules를 먼저 `.write:false`로 바꾸면 이전 앱 버전의 공개 숫자 방송도 깨진다. 구·신 수신자 공존 → 변경된 신호 검증 → 버전별 전환 → 구형 앱 호환성 보장 확인 후 권한 차단하는 단계형 호환 계약 필요. 구버전 경로를 유지하는 기간에는 fanout 비용이 즉시 0이 되지 않는다. TEST/PRODUCTION 승인 없이 도메인/환경 코드를 승격하지 않는다.

## 5. 다음 실제 검사와 PASS/FAIL

**P0 검증 1 — LIVE RTDB Security Rules READ-ONLY 비교:** Firebase live 사용중인 `soridraw-app-866a5-default-rtdb`의 규칙을 GET해서 GitHub `database.rules.json`과 `publicSync/exploreLike` 구간을 대조한다. POST/PUT/PATCH/DELETE 금지. 별도 읽기 전용 역할로만 진행: Firebase Realtime Database Viewer (`roles/firebasedatabase.viewer`) 등 실제 GET 가능 범위 확인 후 필요 시 사용자에게 가장 좁은 권한 부여 요청. 현재 운영 모니터링 전용 서비스 계정은 Monitoring Viewer만 있으므로 자동 획득 가능한 라이브 규칙이라고 주장하지 않는다. 민감한 규칙 내용은 PRIVATE 저장소 보고에만 제한.

**P0 검증 2 — 재현/비용 계측:** 사용자의 기존 테스트 계정 2개·격리 RTDB emulator 사용, canonical 실제 사용자 데이터 복제/변경 없이 다음 6개 상황을 계측한다.
- 이벤트 없음 10분/백그라운드 복귀 → 0 canonical read/write, 불필요 이벤트 수신량 확인
- 좋아요 1곡 → 다른 계정 화면에 있는 곡만 R2 조회, 숫자 정확
- 화면에 없는 곡 변경 → 수신 RTDB bytes 존재하더라도 다른 Worker 조회 없음
- 장시간 retained 50 rows → 반복 onValue 다운로드/기존 ACK watermark 동작, client R2 중복 없음
- 제한된 emulator에서 거짓 trackId·반복 signal writes → 규칙이 허용/거부하는지 확인(운영 서버 공격 금지)
- PC/모바일 서로 다른 구버전에서 신규 v2 이벤트/RTDB Rules 정책 전환 중 캐시 및 숫자 보호

**P0 검증 3 — 계약 확정:** false-green 금지. 기능 유지(개인 하트, 타계정 공개 숫자, 30초 W1) + 필요 수신자만 전달 + 악용 시 증폭 제한 + Worker/R2 추가 비용 증가 없음 + 구버전/공유 데이터 하위 호환 + 실패 시 즉시 복구 절차를 코드 배포 전 문서로 고정.

## 6. 이번 감사 완료 범위

- GitHub 코드/Rules 정적 조사와 최초 PRIVATE Cloud Monitoring 합계 교차 확인.
- RTDB 보안 규칙 변경 **없음**, app382 client/Worker 수정 **없음**. 데이터 읽기 비용을 줄이려다 원본 D1 전체 조회/폴링을 도입하지 않음.
- 필요한 추가 권한이 확인되지 않은 상태로 LIVE 규칙을 읽거나 공격적 테스트를 하지 않음.
- 남은 다음 단계 = **LIVE Rules GET 검증 → 부분 구독/서버 ACK 대안 상세 설계 → 검증된 preview 최소 변경**.

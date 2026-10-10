# Stage420 — 좋아요 서버 승인 증표 / 구형 앱 안전 전환 기준 (2026-10-10)

## 판정
**Source-only 후보 PASS, 운영 보안/배포 HOLD.** `preview`의 `EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE=false`와 Cloudflare `STAGE426_COMPILED_OPEN=false`를 계속 유지한다. 옛 app392·TEST·PRODUCTION과 공유 사용자 원본은 모두 불변.

## 신규 후보 경로
1. 사용자가 클릭 즉시 로컬 하트·영구 outbox를 갱신한다. Firebase Auth UID를 실서버가 확인하며 `publishExploreLikeIntent420`의 Admin 트랜잭션은 30회 경고/40회 제한/연속 2분 제한 후 120분 잠금을 판단한다.
2. **허용된 operationId만** Functions 서버가 서버 전용 32바이트 이상 HMAC 키로 `v1.payload.signature`를 발급한다. UID, trackId, liked, operationId와 발급/만료 시간이 함께 서명된다. 허용 거절 시 증표 발급 없음.
3. 클라이언트가 영구 outbox에서 해당 exact operationId의 `guardStatus420=approved`와 서명 증표를 함께 보존해야만 canonical batch에 해당 증표를 포함할 수 있다. 네트워크 실패·서버 거절·이전 클릭 응답은 Worker 전송 불가. 기기 화면은 기존 로컬 방식 유지.
4. Cloudflare의 **아직 컴파일 OFF인 신규 426 경로**는 먼저 Firebase JWT로 UID를 확정한 뒤, 전달된 전체 최대 50개 항목의 MAC·UID·곡·행동·요청ID·15분 만료를 검사한다. **일부라도 잘못되면 원본 D1 준비/쓰기 전에 403**. 서명 검증 단계에서는 Firebase/Firestore/D1/R2 읽기 0(암호 검증은 CPU 소요). 기존 171 receipt/idempotency가 동일 operationId 재전송 W0를 책임진다.
5. Firebase와 Cloudflare에 동일한 `SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET` 바인딩이 필요하다. 이 값은 실제 배포 환경 Secret Manager/Worker Secret에서만 설정하고 GitHub·UI·클라이언트에 공개하지 않는다. **현재 실제 환경 Secret 배포·설정 안 함.** 서명키 없는 신규 Functions/Worker 후보는 보안상 fail-closed.

## 구형 앱 호환성의 구조적 한계

| 요청 형태 | 현재 운영 경로 | 420 인증된 미래 426 경로 |
|---|---|---|
| app392·구형 열린 탭, 구 416 직접 신호 | 현재처럼 정상이나 서버 420 정책 우회 가능 | 구형 416 쓰기를 Rules에서 폐쇄하면 신호 오류 및 지연 가능 |
| 구형 앱의 무서명 canonical 요청 | 현재 canonical Worker는 처리 가능 (현재 동작 보호) | **서명 없어 차단**. 구형 열린 탭은 반드시 업데이트/새로고침·대기중 요청 보호 전략 필요 |
| 신버전 UID별 서명된 요청 | 후보 새 로컬 저장/Private 420 미활성 | 증표가 맞을 때만 원본 접수 가능, 실제 장치 검증 필요 |
| 직접 REST/SDK 악용 | 구형 허용 Rules와 동등한 인증이면 차단 불가능 | Rules 416 직접쓰기 금지 + Worker 서명 강제 시 차단 가능 |

- **같은 사용자 인증을 가진 구형 앱과 악성 SDK를 RTDB Rules에서 신뢰성 있게 구별하는 추가 서버 증거가 없다.** 기존 직접 전송을 영구 허용하면서 2시간 보안이 완전 강제된다고 말할 수 없음.
- 안전한 단계 전환은 (A) 새 버전 앱 배포와 대기중 outbox 보존, (B) 클라이언트 접속/업데이트 상태 및 TEST·PROD 동작 확인, (C) **사용자 승인과 사전 안내** 후 구형 416 직접쓰기 폐쇄 및 서명 강제 Worker로 **원자적으로 가까운 조정 릴리스**, (D) 미갱신 탭 새로고침 안내/오프라인·재진입 복구다. 완전한 구형 무중단과 즉시 전면 서버 보안이 동시에 불가능하면 사전 보고·승인을 받는다.
- Firebase RTDB Rules는 세 환경이 공유하는 데이터권한에 적용된다. PREVIEW만 보호하려고 shared live Rules부터 폐쇄하면 TEST·PRODUCTION의 현재 열린 탭이 영향을 받는다. 모든 환경 실제 호환성 전제 없이는 공유 Rules 수정 금지.

## 배포·비용/위험 게이트
- 신규 426은 현재 `STAGE426_COMPILED_OPEN=false`라 코드가 존재해도 운영 경로로 전환하지 않는다. 이전 `baseWorker` 경로는 여전히 증표 없이 접근 가능 → **현재 2시간 잠금 우회 완전 차단 FAIL**.
- HTTP/CPU: 허용된 클릭마다 Firebase Functions callable 및 Admin RTDB 트랜잭션 비용과 한국 p95 왕복 지연 증가; Worker MAC 검증은 별도 서버 조회가 없어 D1 직접 추가조회 0 **설계**. 실제 10만 DAU 총비용·모바일 지연 미측정.
- 15분 증표 만료 및 모바일 장기 오프라인·비정상 종료·다른 기기 최근 클릭·승인 ACK 손실·Master 조기해제·키 교체(구/신 kid)·검증 실패 원상복귀는 **운영 E2E 미완료**. 키 교체, Server 승인 갱신, 오래된 outbox 재발급은 구현 전 HOLD.
- 암호 후보 검증: `scripts/verify-420-signed-like-permit.mjs`는 정확한 `functions/src/exploreLikePermit420.ts`를 Node22 타입만 제거하여 실행하고, 실제 Cloudflare verifier를 Node WebCrypto로 실행. UID/곡/좋아요/operationId mismatch, 위조, 잘못된 키, 만료, 50개 중 일부 누락, 중복 항목 모두 거절하며 **canonical handler 호출 0**. 이는 물리 D1 계측이 아님.
- 실제 QA 결과: [Fast QA 38031924162](https://github.com/andrawing1212/soridraw-music/actions/runs/38031924162) **SUCCESS**, [408 38031808545](https://github.com/andrawing1212/soridraw-music/actions/runs/38031808545) **SUCCESS**, [Dormant 426 38031655900](https://github.com/andrawing1212/soridraw-music/actions/runs/38031655900) **SUCCESS**. 비교 대상 commit은 각 Run의 정확한 head SHA. 새 문서 commit 자체는 별도 전체 CI 보증이 아니다.
- 공유 원본 D1/Firestore/RTDB/R2, Firebase/Worker/Hosting 배포와 실제 사용자 데이터 처리: **없음**. main/TEST/PRODUCTION 불변.

## 다음
1. 신규 420 cutover 상태에서 15분 만료 증표 재발급·오프라인 재실행·다중기기 승인/거절 회복과 Worker 171 idempotent W0 실제 고정 테스트. 기존 app392 동작을 변경하지 않는 별도 테스트 계정으로 검증.
2. 공유 RTDB Rules 구형 416 폐쇄 전후의 PC·모바일·TEST/PROD 호환 검증과 사용자 리프레시/승격 동의 구간을 결정한다. 풀 릴리스 전 구형 앱 자동 강제 차단/원본 데이터 덮어쓰기 금지.
3. Master 잠금·조기해제와 canonical 직접 REST 우회검사, Firebase Emulator + Worker dry-run, 10만 DAU 월 총 비용·한국 p95 통과 후에만 exact Preview cutover 제안. 사용자의 프리뷰 배포 승인 없이 배포하지 않는다.

## 추가 독립 증거 — 2026-10-10 51개 기록 뒤 증표 재발급 충돌

- 검증기: scripts/verify-420-permit-expiry-replay.mjs, [Fast QA 38041454502](https://github.com/andrawing1212/soridraw-music/actions/runs/38041454502) PASS. 실제 Functions Admin rate 게이트/issuer TS와 Worker 426 verifier를 메모리 DB에 연결한 검증.
- Worker는 만료된 15분 인증서로 canonical DB 쓰기 전에 정확히 거절. 재발급된 원래 opId의 원래 승인 신호가 최근 50건 안에 있으면 재승인 중복 처리 RTDB write 0.
- 다만 51개의 개별 명령 이후 최초 ID가 최근 50건에서 빠지면 duplicate 식별에 실패하여 다음 재전송이 새 click·새 RTDB write로 확정됨. 따라서 **서버측 동일 OperationId 재시도는 항상 W0라는 보장은 아직 FAIL**, 앱의 오프라인 durable outbox와 충돌 가능.
- 안전 조건: 최신 50건 UI signal buffer와 장기 승인·canonical 중복 방지의 책임을 분리하고, 15분 만료/권한 잠금/단말 오프라인 상태를 명시 처리. 171 canonical receipt의 재전송 중복 처리까지 독립 감사. 이 문제를 근거 없이 50→무제한 확장하여 매 클릭마다 전체 RTDB 트랜잭션 payload가 커지게 하거나, 원본 D1을 전체 재조회하는 해결 금지. **고비용/구형 호환성 검증 전 운영 Cutover HOLD 계속.**

## 후보 보완: 이전 서명 승인 증표 재발급 (소스 전용)

- 기존 서버 HMAC 승인증표가 단말에 남아있으면 15분 만료 후에도 원래 인증된 UID·trackId·liked·operationId와 발급시간 24시간 이내인지 확인한 뒤 새로운 15분 인증서를 갱신 가능. 기록 최근 50건을 늘리거나 중복 클릭으로 집계하지 않음. RTDB/D1 read/write 0 목표, Functions 호출·서명 CPU 비용만 발생.
- 인증증표가 없거나 키가 바뀌었거나 24시간을 초과하면 항상 거절하고 기존 미처리 outbox를 지킨다. 이전 승인 ACK 손실·오프라인 장기복구는 이번 방식만으로 완결되지 않는다. app395 client 및 Stage420/426 ON 변경 없음.

## 후보 통합검증 (2026-10-10)

- Commit 83977aa740ff8c754c5c8d9a9304e4bff1c4c7f6까지 신규 서명증표 재발급 Callable + 후보 outbox 응답 경로를 source-only로 연결. [408 Run 38042699563](https://github.com/andrawing1212/soridraw-music/actions/runs/38042699563) Functions TS/app TS/Build/기존 좋아요·팔로우+재전송 거부 테스트 SUCCESS.
- 승인 증표가 존재하면 최초 서명된 exact opId만 재발급, 50건 이벤트 슬라이딩/쿼터 재소모를 우회. 증표 미존재 approved outbox는 fail closed. 하지만 원래 ACK 손실로 아직 awaiting 상태인 것은 재시도 시 최초 허용 경로를 다시 탈 수 있어 51개 뒤 문제가 여전히 남는다. Cutover를 활성화하지 않는 구체적인 이유다.
- 공유 사용자 데이터, D1/RTDB Rules, Firebase Functions, Cloudflare Worker, main/TEST/PRODUCTION 전부 미변경. PREVIEW 앱395 그대로.

## 2026-10-10 ACK 유실 최근 50건 서버 증거 복구 후보 — 자동검사 PASS / 운영 HOLD

- 소스 `d72f90bd77084e4d264cf87e4e0ee2e6e7dd4d1d`, 테스트 범위 보정 `ecf3941e17857ab1a932f49f104d111699daeebe`, [408 38061501678](https://github.com/andrawing1212/soridraw-music/actions/runs/38061501678) SUCCESS.
- 새 후보 `functions/src/exploreLikeApprovalRecovery420.ts` / `functions/src/index.ts` `recoverExploreLikePermit420`: 인증 UID 아래 최근 50개 server-own 결과에서 동일 operationId+track+owner+liked+60분 승인 기록이 존재할 때만 새 15분 HMAC 발급. 기존 RTDB Admin rate 함수 재호출 없음, 트랜잭션 없음, D1 0, RTDB 승인 기록 조회 최대 1번(기록 크기 상한 50). 클라이언트 첫 publish ACK 실패 때만 후보 recover 실행, 기존 outbox 유지·신규 허위 승인 금지. 리더의 50건 초과/만료/누락·응답 실패는 fail-closed.
- **이 작업은 최초 ACK 손실 후 이미 최근 기록이 사라진 51개 이상 경과 상황의 복구를 해결하지 않는다.** 별도 원자적·장기 서버 승인 증명 없이는 `Stage416 2/5` 완료 금지. 현재 PREVIEW app396, 구형 앱·RTDB Rules·Functions·Worker·공유 사용자 데이터 변경 없음. 키 미배포, Stage420/426 cutover OFF. 실환경 월비용/물리 p95/171 W0 미측정.

## 2026-10-10 단계2 원자적 승인 저널 후보 — 51건 초과 W0 자동 QA PASS / 운영 HOLD

- Candidate SHA `f24295b30f3b1cf69f3a31ca20cd733dfb040c6f`. 408 품질 [Run 38080477525](https://github.com/andrawing1212/soridraw-music/actions/runs/38080477525) SUCCESS.
- Source-only Firebase Admin 루트 트랜잭션 한 번에 기존 rate counter + 최근50 UI events + UID별 최대256 compact digest receipt를 원자 저장. 승인 ACK/HMAC 완전 소실 후 화면 이벤트 51+가 지나도 24h 이내 정확한 기록이 journal에 있으면 서버 point GET으로 복구하고 최초 승인 재전송과 RTDB 쓰기 증가 0. 원본 opId·trackId·ownerUid·liked SHA256 fingerprint를 비교하므로 맞지 않으면 서명 발급 금지.
- Receipt TTL 24h/UID 최대256, 256보다 오래된 승인·만료는 safe pending (영구 복구 보장 아님). 새 승인 transaction에 최대256 receipt가 포함되어 RTDB 전송량이 커질 수 있으므로 10만 사용 비용과 p95 실측 전 운영/커트오버 보류. 426/420 비활성, existing direct416/구형 앱 호환성 미해결, shared Rules·배포·실제 데이터 변경 없음.

## 2026-10-10 Stage420 승인 기록 비용/257 경계: 실제 함수 재현 결과 — 운영 차단

- `preview` code `7180ea3ca7a4b2349f285681a48e8a240e8a31d4`; [408 CI 38082111398](https://github.com/andrawing1212/soridraw-music/actions/runs/38082111398) SUCCESS. 실제 서버 승인 함수를 메모리 Firebase transaction mock에서 260회 호출.
- 정량: 256개 root 직렬화 **37,128B / 36.3KiB**. 처음5회 1,646B, 처음20회 5,741B, 처음50회 13,946B. 10만 DAU 가상 월 write serializations 저활동 5/일 15.36GiB, 20/일 175.73GiB, 256개 포화 5/일 478.63GiB. **실제 Firebase 청구액 아님**, client 동시 연결/RTDB egress/Functions 비용 별도 계측 필요.
- 심각한 경계: 256개의 receipt를 넘겨 과거 operationId가 eviction 된 후 **서버 Callable 단독 동일 명령 재호출은 새 승인 commit**. 기존 앱 후보 transport가 durable first-send marker로 자동 중복 재전송을 막아도, 서버 수준 영구 W0·악성 SDK 우회 저항은 성립하지 않음. 더 큰 무한 journal 비용으로 임시 해결 금지.
- 실서비스 Stage420/426 ON, 구형 direct416 차단, 공유 Rules 수정은 **HOLD**. 실제 user data migration/deploy 없음. 다음 후보는 O(1) 원자 승인 증명과 사용자 회복 UX를 함께 설계한 뒤 독립 보안·비용 감사 필요.

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

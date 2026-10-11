# Stage420 Eventarc 알림 실패 운영 복구 — 배포 전 준비본 (2026-10-11)

**상태: 설정 파일 생성/로컬 검사만 준비됨. Cloud Monitoring 실제 알림 정책 생성·채널 연결·실서비스 발송·onCreate Functions 배포는 전부 미실행.** 공유 Firebase 프로젝트에 알림을 만드는 행위도 운영 설정 변경이므로 릴리스 승인 이후에만 수행한다.

## 알림 조건과 사람의 행동

- Firestore 승인 영수증이 기록됐는데 RTDB 개인 신호가 끝내 전달되지 못한 경우, 서버는 이벤트 나이 **23시간 이후** 같은 UID·operationId의 `privateLikeGuardV2_420/{uid}/deliveryFailures/{operationId}`에 `state=needs-manual-reconciliation`을 남긴다. 이 기록은 좋아요 재승인·D1 카운트 보정이 아니다.
- 정확한 검색 신호는 `420_DELIVERY_HELD_FOR_OPERATOR`. Cloud Run Functions ERROR 로그를 조건으로 삼고 5분 통지 제한, 7일 자동 알림 종료를 제안한다. 알림 자동 종료가 Firestore HOLD 상태 복구를 뜻하지 않는다.
- Master는 경보에 적힌 **단일 UID와 정확한 operationId**를 이용한다. 이미 있는 원자 receipt를 확인한 뒤 `masterRecoverHeldAtomicLike420` 서버 함수에서 기존 승인 알림만 재전달하고, 동일 요청은 중복 처리로 반환한다. 다른 승인 만들기·대량 백필·모든 사용자 검색 금지.
- 스태프용 UI `ExploreLikeAbuseMasterPanel420.tsx`에 복구 입력과 명시적 사용자 확인을 **비활성 상태로 준비**했다. `STAGE420_MASTER_PANEL_ACTIVE=false` 및 `STAGE420_ATOMIC_MASTER_UI_CUTOVER=false`; 서비스 사용자에게 노출되지 않는다.
- 알림이 발생했으나 실제 Master 복구에 계속 실패하면 Stage420 전환을 중단하고 기존 정상 구형 좋아요 기능을 보존한다. 새 임의 receipt를 발급해 해결하지 않는다.

## 실제 운영 단계 — 사용자 승인 이전 실행 금지

1. 공유 Firebase 프로젝트 **`soridraw-app-866a5`** 에서 실제 통지 받을 Cloud Monitoring Notification Channel을 준비하고 해당 채널의 **numeric ID** 및 운영 수신자를 확인한다. 채널 주소/자격은 GitHub에 기록하지 않는다.
2. 아래 명령은 **로컬 JSON 출력만 수행**하며 서버에 아무것도 생성하지 않는다.

   ```bash
   node scripts/prepare-420-held-alert-policy.mjs --project soridraw-app-866a5 --channel projects/soridraw-app-866a5/notificationChannels/ACTUAL_NUMERIC_ID > /tmp/soridraw-stage420-held-alert.json
   ```

3. `gcloud monitoring policies list --project=soridraw-app-866a5` 로 동일 정책의 **기존 존재 여부를 먼저 조회**한다. 중복 생성 금지. 실제 생성은 승인된 release gate에서만 `gcloud monitoring policies create --project=soridraw-app-866a5 --policy-from-file=/tmp/soridraw-stage420-held-alert.json` 으로 수행한다.
4. 인공 Eventarc/RTDB 장애를 **격리 Firebase Emulator 또는 별도 테스트 프로젝트에서만** 재현하고, Cloud Monitoring 통지 채널로 경보가 도착하는지 실제 수신 확인한다. 실사용 승인 기록을 조작하거나 운영 RTDB에 장애를 만들지 않는다.
5. Functions 실제 `onDocumentCreated` export/배포, Worker 서명 강제, 공유 RTDB Rules 구형 416 폐쇄, 신규 앱/PWA 전환은 서로 다른 독립 배포가 아니라 **하나의 합의된 릴리스**로 검증한다. 통지 정책만 만드는 것으로 Stage420 정상 운영 판정 금지.

## 합격선

Master에게 alert 도달 + 해당 UID/op 조회/복구 + 중복/위조 거절 + RTDB 다른 기기에서 변경 신호 실제 수신 + old app upgrade/rollback + 비용 실측을 모두 확인하기 전 **FAIL/HOLD**.

공식 구조 참고: Google Cloud Logging *Configure log-based alerting policies* (LogMatch condition) / Firebase *Write and view logs*. 이 문서는 현재 정책이 이미 있다는 증거가 아니다.

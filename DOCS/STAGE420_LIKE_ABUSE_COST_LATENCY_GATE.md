# Stage420 비용·지연 검증 게이트 (2026-10-10)

## 확정 요구
- UID별 1분 30회 경고, 40회 제한, 두 연속 1분간 한도 도달 시 120분 잠금.
- PREVIEW app392의 기존 PC↔모바일 좋아요 거의 즉시 반영 보호.
- 10만명 전체 정상 사용 비용이 보안 변경 때문에 폭증하면 배포 중지.

## 확인된 코드 차이
- 기존 app392: 클릭 시 RTDB client transaction 하나와 같은 계정 알림.
- Stage420 신규 후보: 클릭 시 Firebase callable 호출 하나 + RTDB Admin transaction 하나와 같은 계정 알림.
- 신규 callable이 정상 사용자 모든 클릭에 필요해지므로 Functions 실행비·왕복 지연이 추가된다. 현 코드상 Functions 지역은 us-central1이며 한국 사용자 기기에서 실제 p95 왕복 지연은 측정하지 않았다.
- 원본 Cloudflare Worker의 60회/60초 제한과 새 RTDB 보안 제한은 다른 경로다. Cloudflare가 서버 잠금 상태를 함께 강제하기 전에는 통합 보안 완료 아님.

## 10만명 DAU 시나리오 (실측 아님, 30일 가정)
| 하루 한 명 클릭 | 월 callable 호출수 | 월 200만 무료 요청 초과 호출수 | 단순 Functions 요청료 |
|---:|---:|---:|---:|
| 1 | 300만 | 100만 | 약 $0.40 |
| 5 | 1,500만 | 1,300만 | 약 $5.20 |
| 20 | 6,000만 | 5,800만 | 약 $23.20 |
| 40 | 1억2,000만 | 1억1,800만 | 약 $47.20 |

공식 Firebase 가격 `https://firebase.google.com/pricing` 참고. 위 요금에는 CPU·RAM·콜드스타트·네트워크·DB 전송·기타 Functions 사용량이 **포함되지 않는다**. 전체 예상 청구액이 아니며 무료 한도도 같은 프로젝트 내 다른 Functions와 공유한다.

## 다음 필수 검사
1. 사용자 정상 클릭에서 PREVIEW 지역별 callable p50/p95와 기존 직접 RTDB 416 송신 p50/p95를 비교하고 양방향 하트 속도 훼손 여부 확인.
2. 100k 사용자 월 Functions CPU/RAM, RTDB outbound, 다운로드 데이터 크기, Cloudflare Worker 요청/원본 R/W를 합산.
3. 일반 클릭을 느리게 하거나 추가 비용이 너무 크면 Functions per-click 방식은 배포하지 말고 보안 규칙 중심의 낮은 비용 구조 대안 평가.
4. Cloudflare canonical route, Firebase SDK/REST 기존 경로 모두 서버 제한을 우회할 수 없는지 검증.
5. 앱 재실행·계정 전환·권한 거절·오프라인·구형 TEST/PRODUCTION 기능 회귀검사, 감사 기록은 Master 전용.

현재: Firebase Emulator 규칙 PASS Run 38025863205. Stage420 서버 후보 및 미연결 클라이언트는 GitHub preview 코드에만 존재. app392 실서비스·shared Rules·Functions·Worker 미변경.

## 2026-10-10 실제 코드 대조: 공유 RTDB 전환 선행조건
- `preview` 4188e7e 기준 직접 확인: `exploreLikeService.ts`의 정상 클릭은 `publishExploreLikeIntent416`에 비차단 비동기 발행되며, 넷제로 취소/최종 접수 후에도 `settleExploreLikeIntent416`을 호출한다. `exploreLikeGuardedTransport420.ts`는 현재 제품 경로와 연결되지 않은 후보이다.
- `database.rules.json`의 `userSync/$uid`에는 현재 부모 `.write`가 존재한다. 새 후보 생성기는 이를 제거하고 6개 기존 채널 쓰기 권한을 자식으로 이전하며 `exploreLikeIntent416` 직접 쓰기를 차단한다. 에뮬레이터에서 후보 PASS여도 실제 공유 Rules 변경 PASS는 아니다.
- **같은 기존 RTDB 직접 쓰기 요청을 구형 앱에서는 허용하면서 공격자의 동등한 직접 SDK/REST 요청만 확실히 거부할 수 있다는 증거가 없다.** 구형 app392 열린 탭과 TEST/PRODUCTION 클라이언트가 이 경로를 사용하므로, 기존 경로를 즉시 폐쇄하면 사용자 확인된 빠른 알림이 퇴행할 수 있다. 옛 경로를 계속 허용하면 완전한 서버 강제 제한이라고 주장할 수 없다.
- `publishExploreLikeIntent420`은 인증 UID·서버 Admin RTDB 트랜잭션 후보로 구현되었다. **기존 공개 원본 Cloudflare Worker 경로까지 동일 잠금 정책이 강제된 증거는 아직 없다.** 개인 잠정 신호 방어와 실제 canonical 좋아요 접수 방어를 모두 별도 검증할 것.
- 비용은 사용자 클릭별 callable + Admin 트랜잭션 경로가 추가되므로 기존 app392의 RTDB 직접 쓰기와 p50/p95·전송량·10만명 월 총비용을 비교하기 전에는 활성화하지 않는다. 위 비용 표는 요청료 일부만 계산한 시나리오이며 실제 월 청구 추정치가 아니다.

### 다음 구현/검증 순서 (릴리스 HOLD)
1. **구형 앱 보존 계약**: app392 열린 탭, TEST·PRODUCTION 현행 클라이언트의 같은 UID 좋아요 신호와 canonical 결과를 대상으로 단계별 권한 변경 매트릭스를 확정한다. 직접 쓰기 차단과 옛 앱 기능 보존을 동시에 증명할 수 없으면 중단하고 전환 전략을 다시 설계한다.
2. **새 클라이언트 통합**: `publishGuardedLikeIntent420` 및 `subscribeGuardedLikeIntent420`를 기존 416 잠정 하트·outbox/127 확정 신호와 연결하되, 승인된 재전송·거절/잠금 rollback·이전 클릭 덮어쓰기 방지와 UID 변경을 실행형으로 검증한다. 옛 직접 RTDB 쓰기 fallback 금지.
3. **원본 Worker 차단**: canonical batch 직접 요청도 UID 2시간 잠금을 준수하는지 증명한다. 임의 대량 DB 조회·비용 증가가 필요한 구조라면 설계 중단.
4. **실제 지연·월 비용 / 보안 검증**: Emulator old/new-client, Firebase 권한 및 인증, 모바일↔PC 자동 반영, 10만명 요청·CPU/RTDB/Workers/R2/DO/Firestore 비용과 p95 지연을 확인한다.
5. **PREVIEW만 단계적 릴리스**: 임계 위험이 제거된 동일 코드/Rules/Functions/Worker 조합과 rollback 방안을 검증한 뒤에만 실배포. 공유 Rules와 기존 앱을 깨는 선행 배포 금지. TEST/PRODUCTION은 사용자 별도 승격 승인 필수.

**현재 판정: 보안 후보 자동검사 PASS / 직접 클릭 차단 운영은 FAIL(미활성) / 배포 준비 HOLD.** 다른 정상 기능과 원본 데이터는 변경하지 않는다.

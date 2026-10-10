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

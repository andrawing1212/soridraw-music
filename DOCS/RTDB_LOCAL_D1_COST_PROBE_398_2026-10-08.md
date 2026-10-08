# SORIDRAW 398 — 격리 D1 RETURNING 비용 검증 (2026-10-08)

## 검사 결과

GitHub Actions: [Run 37741253004](https://github.com/andrawing1212/soridraw-music/actions/runs/37741253004) SUCCESS, baseline commit d20fb8407b35871fb70e18746af5c8d91b4b6435.

실행 도구: GitHub ubuntu-24.04 / Node.js 22 / Miniflare 4의 **로컬 가상 D1 두 개**. 실제 Cloudflare 계정·공유 D1·Firebase 데이터나 배포와 연결되지 않음. 코드 scripts/verify-398-miniflare-d1-returning.mjs. 신규 검사 workflow .github/workflows/verify-398-isolated-d1.yml.

| 상황 | 원래 D1 local R/W | RETURNING 후보 local R/W | 증가 |
|---|---:|---:|---:|
| 신규 좋아요 | R1 W3 | R2 W3 | R+1 W+0 |
| 이미 좋아요 | R1 W1 | R2 W1 | R+1 W+0 |
| 좋아요 해제 | R2 W2 | R3 W2 | R+1 W+0 |
| 이미 해제 | R1 W1 | R2 W1 | R+1 W+0 |

검증: 실제 membership 결과/수정 행 수/RETURNING 결과 일치 4/4 PASS. 기존 SQL에 RETURNING 추가 시 **쓰기 증가 0, 읽기 증가 +1** 관측. R+0이라고 주장하지 않는다.

첫 CI Run 37741152524 FAILURE는 Miniflare의 bundled workerd가 지원하지 않는 호환성 날짜 설정 때문이었다. 지원되는 2026-08-01 날짜로 낮춰 최종 검사 PASS. 제품 코드와 서버는 손대지 않았다.

## 별도 전체 CTE 유사 실험

Node.js 22 in-memory SQLite에서 patch039/040 집계 SQL의 boundary/eligible/expanded/latest/deltas 및 track_stats·likes·035/066/069 queue 처리 순서를 재구성해 baseline과 RETURNING 후보 8개 시나리오 비교, **8/8 PASS**. 신규곡·중복·해제·다계정·상쇄·변경 순서·과거 대기열 혼합 포함. 이 8개는 Miniflare/D1의 과금 행 수치를 측정하지 않은 별도 로컬 실험이다.

**절대 혼동 금지:** Miniflare 4개 테스트는 membership + queue delete의 **축약형**이고 실제 SORIDRAW 전체 canonical Worker batch·운영 인덱스·트리거·원본 R2 정착·157 overlay까지 복제한 것이 아니다. 테스트용 신규 좋아요 W3을 실제 운영 좋아요 W3이라고 단정하면 안 된다. 동시에 운영 W1~W2 합격도 전혀 증명하지 못했다.

## 다음 작업의 안전 게이트

1. 정확한 운영 Worker 생성 산출물과 최신 집계 함수(035/066/069/075 및 overlay)를 확인한다. patch040의 초창기 함수만 보고 현재 사용 중이라고 단정 금지.
2. 격리 Miniflare에 동일한 canonical CTE, stats 갱신, likes membership, queue 정리를 묶은 완전한 재현 테스트를 추가. 전체 D1 meta.rows_read/rows_written과 RETURNING 증분·작업당 W1~W2 합격선을 확인한다.
3. W3+나 불필요한 R이 실제 운영 비용 구조에서도 확인되면 서버 알림을 연결하기 전 STOP·대안 검토. 비용 때문에 기존 좋아요/팔로우를 제거하지 않는다.
4. 그 후에야 Worker canonical 정착 → 인증된 Firebase Functions publisher → 필요한 곡만 RTDB 수신 → 구형 앱 안전 공존·Rules 마지막 변경 순서.
5. 사용자 실데이터/공유 RTDB 규칙 변경, Firebase 배포, Cloudflare Worker 배포, TEST/PRODUCTION 승격 없음.

현재 성격: **격리 검사 단계, 앱 기능 미구현, 운영비용 미검증.**

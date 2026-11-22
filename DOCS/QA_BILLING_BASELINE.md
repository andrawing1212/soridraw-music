# SORIDRAW — QA 요금제·결제 확인 기준 (운영 메모)

> 최종 근거 확인: 2026-11-23 KST (디렉터가 직접 제공한 Cloudflare SORIDRAW-QA 청구 화면 및 앞선 QA Firebase 연결 확인 기록)
> 목적: 이미 확인된 QA 요금제·결제 연결·청구 상태를 반복 질문하지 않고, 비용이 발생할 수 있는 실제 작업은 근거를 구분해 결정한다. 비밀번호, API 토큰, 카드번호, 계정 개인식별 결제정보를 보관하지 않는다.

## Cloudflare — 독립 QA

- 계정 표시명: **SORIDRAW-QA**. QA Cloudflare Account ID: `b60fcd62c679c64db19f0b0e0c2f3429`; 운영 Account ID `e1a30fc9ef497fda1d34f4ab3dc1da45`와 분리.
- **요금제 화면 직접 확인**: **Workers Free — 활성**, **R2 Paid — 활성**. R2 Paid 화면에는 **2026-12-21 갱신** 표시. Workers Paid 업그레이드는 진행하지 않음.
- **2026-11-23 KST R2 Billable Usage 화면**: R2 Storage Class A Operations **41회**, Class B Operations **9회**. 두 항목 모두 **청구 가능한 사용량 0**, 화면상 **사용 비용 $0.00**. 이는 그 화면의 *R2 항목에 한한 시점별 사용량*이며 계정 전체 청구액/미래 무료 보증이 아님.
- 과거 R2 활성화/QA D1·R2 생성 및 독립 QA 실검증 기록을 재사용. 현재 QA D1 1개 `soridraw-qa-app768-d1`, QA R2 1개 `soridraw-qa-app768-r2`, 기존 Worker `soridraw-owner-qa-583`는 APP583 등 팔로우 QA 보호 대상. APP518 전용 자원은 아직 확인되지 않음.
- 2026-11-23 KST APP780 GET-only Actions #45050388649: 해당 분리 QA 계정에서 D1/R2/Worker 각 목록 조회 PASS(각 1개), 기록된 APP518 전용 이름 일치 항목 0개. 조회 성공은 QA 작업의 배포·실제 저장/삭제 시험 PASS가 아님.
- **미확인**: D1·Workers의 현재 청구 가능한 전체 사용량/기타 과금 항목, 실시간 잔여 무료량. R2 Paid는 무료 포함량 초과 시 종량 과금 가능. 실제 청구·사용량이 바뀔 수 있으므로 향후 고위험 작업 직전에 최신 값이 필요하면 읽기 전용 경로로 우선 조회한다.

## Firebase / Google Cloud — 독립 QA

- QA Firebase 프로젝트 `soridraw-app` (Project Number `1083981050742`). 운영 Firebase `soridraw-app-866a5`와 구분.
- **2026-11-12 사용자 확인**: QA 프로젝트 Cloud Billing 연결 결과 **`BILLING_ENABLED: True`**. 같은 시기의 Firebase Blaze 업그레이드 안내가 기록되어 있음.
- **미확인**: 현시점 실제 지출액, Blaze 월별 잔여 무상 사용량, **$5 예산 알림 설정 완료 여부**, 결제 계정 세부 설정. 'Billing 연결됨'은 '$0 확정' 또는 '예산 초과 자동 차단'을 뜻하지 않음.
- 실제 Google/Firebase 청구·예산 확인이 필요한 경우 이 기존 연결 사실을 반복 질문하지 말고, 공식 계정의 읽기 전용 증거를 먼저 확인한다. 새 결제 연결/권한 변경/유료 확장, 공유 원본 데이터 접근·수정은 별도 승인 필요.

## 적용 원칙

1. **동일한 과거 스크린샷·요금제 정보를 사용자에게 반복 요청하지 않는다.** 이 파일을 먼저 확인하고, 최신 상태가 실제 의사결정에 중요한 경우에만 필요한 *새로운* 값만 확인한다.
2. 이미 통과한 QA 자원 격리·검증은 새 실패 근거 없으면 재시험하지 않는다.
3. 소량 합성 QA라도 무료 범위가 보장된 것으로 과장하지 않는다. 기존 사용량과 작업 비용 상한을 우선 확인하고, 무료 범위가 확실하지 않으면 유료 작업을 자동 실행하지 않는다.
4. 기존 팔로우 QA Worker 및 공유 PREVIEW/TEST/PRODUCTION 원본 사용자 데이터·D1·R2·Functions·규칙은 보호한다.
5. 이 메모는 **요금제·결제 연결의 확인 이력**이며 계정의 실시간 청구 내역이나 새 배포 승인은 아니다.

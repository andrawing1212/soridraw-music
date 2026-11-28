# APP750 — SORIDRAW 양방향 코드 작업과 안전한 배포

## 최상위 디렉터 확정 — 양방향 배포·복구 체계 (2026-11-28 KST)

**모든 개발방·Codex·Work·릴리스 작업의 영구 공통 원칙.** 정방향 PREVIEW → PRODUCTION과 역방향 PRODUCTION → PREVIEW를 하나의 안전한 릴리스 체계로 완성한다. 정상 개발은 PREVIEW 우선. 정식앱 긴급 수정은 실제 운영 장애 대응 등 필요한 범위에 한정하고, 정식앱에서 확정한 변경을 PREVIEW에 빠짐없이 되돌려 반영하여 후속 정방향 승격에서 되돌아가지 않게 한다. 아래 역사적 TEST 중심 절차와 충돌 시 이 최신 원칙이 우선한다. TEST는 미사용·미변경·미삭제.

1. **우선순위:** 진행 중인 APP737/738 정방향 최초 안전 검증 및 승격 체계를 먼저 완성한다. 그 다음 기존 APP750을 재사용해 역방향 코드 전달 → 검증 → PREVIEW Hosting → 실사용 확인까지 완성한다. 새 별도 컨트롤러를 중복 구축하지 않는다. 이 결정은 설계·구현 순서 승인이지 실제 PRODUCTION 활성화 또는 공유 백엔드 변경의 승인으로 해석하지 않는다.
2. **정방향:** 검증된 PREVIEW 실제 활성 Hosting 파일·환경 계약·GitHub 소스·복구 버전을 고정하고 APP737/738 게이트 및 명확한 정식 배포 승인으로 정확한 파일을 재빌드 없이 승격한다. 기존 PASS와 동일 백엔드 기준은 재사용하고 영향 변경만 검사한다. 일반 Hosting 목표 1~5분은 실측 전 보장하지 않는다.
3. **역방향:** 실제 PRODUCTION 활성 릴리스의 소스·커밋·파일 해시를 확인하고 GitHub에 수정 원본 및 이전 양쪽 복구 지점을 보존한다. 정식에서 확정한 변경분만 현재 PREVIEW 위에 안전하게 반영한다. APP750의 정확한 source/parent/destination SHA, 단일 커밋·경로 제한·PR 검토·충돌 차단을 재사용한다. 전체 브랜치 강제 동기화/merge/reset/force push, 운영 Hosting 전체 무조건 복제, PREVIEW의 미완성 변경 삭제 금지. 다중 커밋·경로 제한 초과·상충 변경은 명시적으로 검토한 최소 범위로 안전 처리하고 자동 성공 처리하지 않는다. PREVIEW 환경 계약으로 필요한 빌드·영향 검사 후 기존 PREVIEW Hosting 경로를 사용하고 정식앱은 변경하지 않는다.
4. **백업·복구:** 작업 전 실제 양쪽 활성 릴리스 ID, Git SHA, 파일·설정 해시, 관련 Worker 버전/연결 및 롤백 근거를 필요한 범위에서 고정한다. GitHub source backup과 Hosting rollback을 구분하고 백업을 사용자 데이터 복제로 해석하지 않는다. 중간 버전 이동·충돌·검사 실패·복구 불가 시 HOLD. 실패한 대상만 승인된 이전 버전으로 복구하며 다른 환경의 정상 변경을 덮지 않는다. 정식 긴급 수정이 PREVIEW에 미반영이면 다음 정방향 승격에서 유실되지 않도록 차단·해결한다.
5. **데이터·환경:** 공유 D1/R2/Firestore/RTDB/Auth/Functions/Rules/Secrets/IAM 등은 코드 전달 또는 Hosting 배포 대상이 아니다. 별도 승인·검증 없이 변경·복제·초기화하지 않는다. Local First, 기존 캐시, 미확정 작업, 사용자 데이터, 환경별 도메인·설정·정상 기능 보호. 반복 비용 검사/전체 QA는 신규 실패나 실제 관련 변경 없이는 하지 않는다.
6. **완료 기준:** APP750 GitHub PR 생성만으로 역배포 PASS를 주장하지 않는다. 정식 출처 증명, 실제 PREVIEW 변경분 보존, 충돌/중복/동시 변경 차단, 영향 기능 검사 및 실제 PREVIEW 배포 파일 확인, PC/모바일 영향 경로·복구 검증까지 확인한다. 독립 검증과 개발자 자체 검사를 구별하고, 정방향·역방향별 GitHub 저장/검사/배포/실사용 상태를 따로 기록한다.

**현재 상태 (2026-11-28):** main의 APP750 PR-only 워크플로와 APP737/738 정방향 실행 코드는 존재한다. 정방향 최초 정식 승격은 HOLD, 최신 정식 제목 동기화 후보는 읽기 전용 검사 PASS (#46126307819), 최근 D1 사용량 조회 PASS (#46128420534, 반복 금지). 역방향 end-to-end 배포 및 복구는 미검증. 실제 정식 배포·공유 자원 변경은 이 기록 작업 범위에 없다.

## 목표 및 현재 동작

작업 출발점은 PREVIEW 또는 PRODUCTION 중 선택할 수 있다. 소스 반영은 양방향이지만 실제 서비스 배포는 안전한 순서 PREVIEW 검증 → PRODUCTION 승격을 지킨다. TEST는 사용하지 않는다.

- PREVIEW 변경: 완성된 단일 커밋의 변경 파일만 production 코드 브랜치로 전달하는 검토 PR 생성.
- PRODUCTION 핫픽스: 완성된 단일 커밋의 변경 파일만 preview 코드 브랜치로 전달하는 검토 PR 생성.
- 반대쪽 소스에 반영 후 PREVIEW Hosting의 기존 고정 SHA 배포 경로로 검증한다. 정식 Hosting은 APP737 호환성 검증과 APP738 활성 버전 그대로 복제·복구 게이트를 유지한다.
- production 브랜치 HEAD가 현재 soridraw.com의 실제 활성 파일과 일치한다는 가정은 금지한다. 운영에서 가져온 변경이라면 실제 활성 릴리스 출처를 따로 확인한다.

## 자동 코드 동기화 (GitHub PR까지만)

영구 워크플로: .github/workflows/app750-bidirectional-code-sync.yml

저장소 소유자만 workflow_dispatch 또는 PR 댓글로 실행할 수 있다. 입력값은 원본 브랜치(preview/production), 변경 커밋 SHA, 부모 SHA, 대상 브랜치 현재 HEAD SHA다. PR 댓글 명령 형식:

/app750-sync preview SOURCE_SHA40 PARENT_SHA40 DEST_SHA40

/app750-sync production SOURCE_SHA40 PARENT_SHA40 DEST_SHA40

실행 시 양쪽 브랜치의 정확한 현재 SHA를 다시 확인하며, 단일 비병합 커밋·최대 25개 앱 소스 파일만 상대 브랜치 위에 cherry-pick한다. 전체 브랜치 merge/rebase/reset, 강제 push는 금지한다. 충돌·SHA 변화·다른 파일·중복 요청은 즉시 차단한다.

cloudflare, scripts, .github, .deploy, Firebase/Rules/Functions와 미확인 경로는 자동 동기화 대상이 아니다. src/services 등 앱 내부 통신·설정 파일을 포함한 변경은 호환성 검토가 필요하다. 자동 PR은 만들어도 병합하지 않고 서버나 Hosting에는 배포하지 않는다.

## 동일 버전 배포와 복구 — 기존 APP737/738 재사용

최종 배포 파일의 동일성은 Git 브랜치 이름만으로 판단하지 않는다. PREVIEW의 실제 활성 Hosting 전체 파일 SHA와 설정, 정식앱 현재 Hosting 버전 및 복구 지점을 고정한 뒤 APP738 방식으로만 승격한다. 배포 중 다른 릴리스가 개입하면 자동 덮어쓰지 않고 HOLD한다.

운영에서 시작한 변경도 PREVIEW에서 검증된 코드로 다시 빌드한다. PRODUCTION Hosting의 원본 바이트를 PREVIEW에 무조건 복사하지 않는다. 두 환경은 도메인과 설정 차이를 가질 수 있기 때문이다. 공유 원본 데이터/Local First/회원 및 음악 데이터는 복사·삭제·초기화하지 않는다.

## 검증 재사용과 남은 차단

APP749 독립 QA에서 실제 A↔B Firebase 인증·팔로우/취소·PC/모바일 A 수신 0명 v10 → 1명 v11 → 0명 v12 PASS를 재사용한다. 일반 사용자나 정식 Worker 전체 호환성 PASS로 확대하지 않는다.

최근 실제 활성 Explore Worker 연결은 PREVIEW 41개, PRODUCTION 12개로 차이 31개가 있다. APP737 전체 기능 동등성과 APP738 독립 증거 파일이 아직 없어 정식앱 직접 승격은 HOLD다.

최초 서버 연결·동작·복구 기준을 한 번 확립한 뒤, 변경 없는 백엔드 계층의 QA는 반복하지 않는다. 이후 일반 Hosting 변경은 차이 있는 기능과 고정 Hosting 파일·복구만 검사한다.

이 APP750 PR은 GitHub 코드 전달 준비만 하며 TEST/PRODUCTION/PREVIEW 배포, Worker/Functions/Rules/D1/R2 변경, 사용자 데이터 쓰기를 실행하지 않는다.

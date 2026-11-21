# APP750 — SORIDRAW 양방향 코드 작업과 안전한 배포

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

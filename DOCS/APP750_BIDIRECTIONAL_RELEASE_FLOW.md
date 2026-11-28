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

## 2026-11-28 KST — 최초 정방향 준비: 사용자 실검증 및 공개 집계 주기 PASS

- 디렉터가 22:48 KST(13:48 UTC) PREVIEW 실검증 모두 통과를 명시: 동일 계정 PC↔모바일 좋아요/취소와 숫자 동기화, 다른 계정 공개 좋아요 1분 공동 집계, 알림 수신과 사용자명/곡 제목 표시. 사용자 확인 근거이며 정식앱 실사용 결과가 아니다. 동일 기능·환경에 신규 변경/오류 근거 없으면 반복하지 않는다.
- 실제 PREVIEW 배포 소스 `af9af470abedb87bc52661d8d12753b1edad1b2e`, Hosting `5a653e89fb795bf6`; 현재 preview `97f6a5af5e296f5bed0d0f9184eb2a5e2f5d86c3`는 지정 정책 문서만 변경. #1486 APP737/738 source pin 검사 PASS (#46150828878, #46150828842), main `763c921c8bedfe39be2ec88f6af8ead5f04cfd8f`.
- [가상 시간 Actions #46151576931](https://github.com/andrawing1212/soridraw-music/actions/runs/46151576931) SUCCESS, QA commit `457ec0c22b324683ef030c48ac7dd1a84ccdb32d`: 현재 preview와 동일한 public-like-window-416.mjs blob `83d594aff768a27863f717857d2780357ff27cef`에서 1/3/5/10/20분 25개 전환, 기존 deadline 고정, 경계 직전 미공개·정확한 due, 다음 구간 새 시간 적용, 중복 곡 집계 방지, 잘못된 시간 차단 PASS. Map 기반 가상 시간 핵심 로직 검증이며 실제 운영의 각 설정별 전송/Functions/RTDB 실사용 PASS는 아니다. MASTER 현재 1분 유지; 설정 변경/배포/공유 데이터 쓰기 없음. 비용 검사 재실행 없음.
- 남은 정방향 차단은 최신 정식 제목 Worker 후보의 별도 활성화 승인·정식 기능 동등성/인증 경로·기존 사용자 업그레이드·독립 증거 및 최종 Hosting 승인. 이 기록은 배포 허가나 APP738 승인 증거 파일이 아니다. 정방향 완료 뒤 APP750 역방향 작업을 이어간다.

## 2026-11-28 KST — 정식 제목 Worker 적용 및 정방향 후속

- 정식 Explore Worker 실제 활성 `6ef25207-a1ea-482a-81d4-5df620660b28`, 기존 복구 버전 `9257b708-4b76-43fe-9c87-3abe0fb071b7`. 활성 요청 #46152552832은 응답 확정 오류로 FAIL, 추가 배포 없이 [GET-only #46152657380](https://github.com/andrawing1212/soridraw-music/actions/runs/46152657380)에서 승인된 15개 모듈 해시, 27개 연결, runtime, 다른 5개 Worker/예약 및 기본 인증/CORS PASS. PREVIEW는 `0c437089-d431-4ab4-b872-27029c906048` 유지. 이 변경은 양쪽에 이미 적용된 제목 수정이므로 다음 승격에서 유실 금지.
- 디렉터 23:24 KST(14:24 UTC) 최신 공개곡 '어릴 적 나에게111' 양쪽 PC 화면 제목 반영 확인. 추천곡 제목 및 모바일 미확인, 목록 불일치 원인 미확정. 23:29 KST 개별 기능 불일치 수정 보류 및 APP737/738 정방향 준비 우선 승인, 전체 정식 배포는 별도 승인 필요.
- APP738 복구 코드에서 버전 ID만으로 실패한 배포의 소유 여부를 판단하는 허점 수정 후보: 서버가 반환한 고유 릴리스 ID도 일치해야 자동 복구, 응답 불명/다른 릴리스는 HOLD. 독립 검증 및 PR 병합 전까지 후보 상태. 기능 동등성·인증·업그레이드·최종 승인 증거는 아직 미완료이며 정식 Hosting/공유 서버 변경 없음.

## 2026-11-28 KST — APP738 독립 감사 FAIL 후 단일 실행 경로 후보

- 독립 감사 대상 `364a90f71602fe5287d9e7050a9a8f8818a66f38`: 기존 #46155106332 재사용, 승인·응답 오류 PASS, 활성 조회와 쓰기 적용 사이 타 배포 덮어쓰기 및 자동 복구 FAIL. Firebase Hosting releases.create에는 현재 활성 릴리스에 대한 조건부 쓰기가 문서화되어 있지 않음. GET 반복/응답 ID 확인은 사후 탐지일 뿐 원자적 보호 아님.
- 디렉터 14:54 UTC 코드 개선 승인, 실제 배포와 서버 권한 변경 금지. 동일 PR #1488에서 APP738 및 기존 릴리스 컨트롤러를 `soridraw-release-controller` 대기열로 맞추고 구형 TEST 기반 정식 승격을 요청 단계에서 거절(과거 코드는 보존), 그 경로의 정식 복구도 실행하지 않음. 현재 main에서 확인한 정식 Hosting 쓰기 후보는 이 두 경로. 조사한 다른 Hosting 워크플로는 PREVIEW/TEST/채널 경로였음. 과거 ref·별도 저장소·콘솔·CLI·공유 서비스 계정·IAM 접근은 미확정이므로 전체 배포 독점 증거가 아님.
- APP738 실제 HTTP 전송은 GET만 허용. 명시적 승인·증거 파일·환경값·기존 토큰·테스트 sender로도 POST/PATCH 불가. CLI와 workflow도 실제 배포 차단. 독립된 배포 권한/직렬 실행이 실증되거나 Firebase가 지원하는 조건부 쓰기가 확인된 후 별도 검토된 코드 변경으로만 HOLD 해제. 임의 bool 또는 증거 파일로 해제 금지. 모의거래의 정상/복구 검사와 실제 쓰기 차단 검사는 범위를 구별한다.
- 이 후보는 충돌이 안전하게 해결된 live release system PASS가 아니라, 코드 단일 경로 준비 및 위험한 실제 쓰기 차단이다. 별도 읽기 전용 접근 권한/실행 경로 조사와 필요한 최소 권한 변경 승인, 독립 검증이 남음. PR은 병합 전 독립 검증 대기. 실제 PREVIEW/TEST/PRODUCTION, IAM, 사용자 데이터 변경 없음.

## 2026-11-29 KST — WIF 및 공통 Hosting writer 소스 준비

- 사용자 화면: 기존 GitHub Actions 서비스 계정에 장기 활성 키 1개 및 프로젝트 상속 Token Creator, Firebase Admin SDK에도 Token Creator, 기본 App Engine Editor 존재. 기존 인증 폐기나 IAM 변경 금지. 기존 PREVIEW workflow의 shared RTDB Rules 별도 경로 및 다른 인증 사용처 유지. Hosting project `soridraw`, 운영 데이터 프로젝트 `soridraw-app-866a5` 변경 금지.
- `scripts/app738-hosting-writer-candidate.mjs`: WIF 설정 생성 후보는 repo/owner immutable ID, main, exact workflow ref/SHA, workflow_dispatch, environment, GitHub-hosted runner를 고정. Hosting 프로젝트 번호는 아직 실제 확인 전이며 placeholder를 운영에 적용하지 않는다. WIF provider/IAM/환경 설정 및 실제 OIDC 교환 없음. 기존 공식 [WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) 및 [OIDC claims](https://docs.github.com/en/actions/reference/security/oidc) 기반.
- 동일 모듈은 양쪽 Hosting 요청의 대상·SHA/파일/설정 해시 및 정식 승인, 기존 릴리스 기준을 고정하는 후보. 전용 Git journal ref에 observed parent의 unique child를 non-force fast-forward로 추가하여 동일 부모 경쟁을 차단하고 pending을 실행 종료 후에도 유지한다. 실제 journal branch는 생성하지 않음. local bare Git fixture로만 검증. 후속 live cutover에는 protected append-only journal, 실제 초기화·권한/우회 검증, 미확정 결과의 별도 안전한 reconciliation, 실제 Preview build artifact 신뢰·업로드 및 APP738 production transaction 연결, auth job 격리가 필요. 모의 callback은 실제 운영 독점·서버 합격 증거가 아님. 신규 WIF provider/서비스 계정/키/Secrets/IAM, 배포, 실제 journal 쓰기, PR 병합 없음. APP738 real HTTP/CLI/workflow hard HOLD 유지, 기존 PREVIEW 배포 경로 변경 없음.

## 2026-11-29 KST — 신규 WIF 읽기 전용 실검증 경로
- 사용자 승인: 새 최소 읽기 전용 IAM 구성 및 검증만. 기존 키·권한 유지, 실제 배포 금지. 전용 신규 서비스 계정 `soridraw-hosting-reader@soridraw.iam.gserviceaccount.com`, Hosting 프로젝트 `soridraw`에 `roles/firebasehosting.viewer`만. 별도의 proof pool `soridraw-hosting-proof`, provider `app738-readonly`. 기존 배포 writer 후보의 pool/provider와 구분. 신규 key 생성 없음.
- 기존 APP738 workflow 파일에 `wif-readonly` 수동 dispatch 후보 job만 추가. 정확한 PR branch, repository/owner/actor ID, workflow SHA 조건, GitHub-hosted runner, 새 전용 계정으로 600초 토큰, 기존 secret·checkout·배포 실행기 불사용. Provider는 실제 검토된 최종 commit SHA와 branch/workflow_ref/event/actor ID에 좁게 고정한 후만 생성. 기본 main에는 기존 파일이 있으나 proof mode는 이 PR branch에만 존재. main 병합 금지.
- 검증은 양쪽 Hosting site metadata와 live release GET, 프로젝트의 testIamPermissions 읽기 전용 capability query로 get/list 허용, update/create/delete 불허 확인. API 실패 시 HOLD. 앱 데이터/Rules/Functions/TEST 접근 없음. 이 검사는 Hosting 읽기 권한에 한정되며 기존 모든 writer의 배타적 통제 증명이 아님.
- 실제 Hosting 프로젝트 번호, 기존 pool/SA 존재 여부 확인 전 provider 생성 금지. 콘솔 접근 불가로 신규 IAM 구성 및 실제 OIDC 인증 아직 미완료. 기존 live APP738 HOLD 유지. 기존 PREVIEW 자동 배포 코드 및 인증 변경 없음.

## 2026-11-29 KST — WIF 실제 조회 PASS 및 공통 실행기 연결 후보
- 사용자 제공 화면으로 Hosting 프로젝트 번호 `450781969193` 고정. 신규 reader, proof pool/provider 구성 및 [실제 인증 #46162559706](https://github.com/andrawing1212/soridraw-music/actions/runs/46162559706) PASS: 두 사이트 GET, 프로젝트 get/list만 허용 및 update/create/delete 미부여. 검사 SHA `51057abb3b78e460028e4cbff0e66a072f46e78b`, 실제 인증 결과 재사용; 이후 후보 SHA 변경으로 기존 proof provider의 exact SHA 조건을 느슨하게 하지 않음. 기존 키/권한 유지.
- `runCommonHostingCandidate`는 공통 durable journal 안에서 기존 APP738 실제 거래 로직을 재사용하는 소스 후보. 정식 증거 파일 digest, 승인, 파일/설정, 기존 version+release ID 고정, scoped PREVIEW finalized artifact 및 별도 승인 rollback route 연결. 미확정 결과는 공통 pending HOLD로 다른 사이트도 실행 차단. 기존 APP738 real adapter hard HOLD 유지. 실제 정식/Preview upload·release 및 auth writer 연결 없음. PREVIEW auto trigger와 shared Rules 경로는 변경하지 않음.
- 다음 실제 전환 전 필요: 신뢰된 build artifact 생산/업로드와 main 고정 WIF writer job 연결, 운영 journal 보호/실제 초기화 및 독립 복구 정책, 기존 40개 secret 참조의 활성 의존성과 토큰 생성/Editor/owner 우회 통제, protected writer authority, 별도 승인 및 독립 감사. 새 reader PASS는 쓰기 권한이나 독점 증거가 아님. 모든 배포, IAM, 기존 key, 공유 데이터 변경 금지 유지.

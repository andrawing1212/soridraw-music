# APP785 — 디렉터 1회 설정, 이후 GitHub QA 자동 진행

**기준:** 2026-11-23 KST. QA 프로젝트 `soridraw-app` / Number `1083981050742` **전용**. 운영 `soridraw-app-866a5`, 공유 원본, 기존 QA 팔로우 Functions, TEST/PRODUCTION은 접근·변경 금지. 이 문서는 추가 인증/설정 화면을 매번 요청하지 않도록 최초 세팅을 묶어둔 실행 체크리스트다.

## 확인 완료 — 다시 사용자에게 요구하지 말 것

- Cloudflare QA 계정/요금제·기존 D1/R2/Worker 검증: `DOCS/QA_BILLING_BASELINE.md` 및 APP781 PASS.
- GitHub WIF Pool `soridraw-qa-github`, Provider `app518-readonly`, **읽기 전용** 서비스 계정 `soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com` 설정 및 실제 OIDC PASS: [Actions #45059378813](https://github.com/andrawing1212/soridraw-music/actions/runs/45059378813). *이 계정에 배포/데이터 쓰기 권한 추가 금지.*
- PR #528 고정 후보 `864f796da24413309567198c9de502b13cdedd50`에서 생성한 QA 단건 HTTPS Function 분리 패키지 APP783 PASS: [Actions #45060366022](https://github.com/andrawing1212/soridraw-music/actions/runs/45060366022).
- Firebase QA Firestore 화면(디렉터 일반 Chrome 캡처 2026-11-23): `Cloud Firestore > 데이터베이스 만들기` 초기 안내가 보임. **아직 (default) 데이터베이스 미생성으로 보이지만 최종 DB 목록 API 직접 인증 조회는 권한 부족**. [APP784 #45061255570](https://github.com/andrawing1212/soridraw-music/actions/runs/45061255570) `HOLD_PERMISSION_DENIED`. QA 전용 기존 Functions는 팔로우용 한 개, APP518 배포 없음.

## 디렉터가 일반 Chrome에서 한 번에 처리할 항목

### 1. QA Firestore 초기화

- [Firebase QA Firestore](https://console.firebase.google.com/project/soridraw-app/firestore) → **데이터베이스 만들기**.
- DB ID: `(default)`(기본값), **Standard Edition / Firestore Native**.
- 위치: **서울 `asia-northeast3`**를 선택할 수 있으면 선택. 프로젝트에서 이미 고정된 위치가 표시되면 임의로 변경하거나 다른 DB를 만들지 말고 고정값을 확인(리전 불일치만 보고).
- 규칙 모드: **프로덕션 모드**(웹·모바일 클라이언트 전부 거부, 서버 IAM 사용). **테스트 모드 선택 금지.** Firestore Rules를 무단 완화하지 않음.
- 처음에 다른 실제 `(default)` DB가 이미 발견되면 만들지 않고 중단. QA Firestore는 합성곡 1건의 독립 테스트에만 사용.
- 위치/모드는 실제 생성 후 쉽게 되돌릴 수 없는 항목. 생성 전 최종 QA 프로젝트명 확인.

### 2. QA 서비스 계정 두 개 만들기

[Google Cloud QA 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=soridraw-app) → **+ 서비스 계정 만들기**를 두 번 사용. 이름/ID 아래 그대로. **JSON 키는 만들지 않는다.**

| ID | 이메일 | 역할 |
|---|---|---|
| `soridraw-qa-app518-runtime` | `soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com` | APP518 함수 실행 전용; Google IAM 프로젝트 `soridraw-app`의 **Cloud Datastore User** `roles/datastore.user` |
| `soridraw-qa-gh-deployer` | `soridraw-qa-gh-deployer@soridraw-app.iam.gserviceaccount.com` | GitHub에서 QA 배포·합성 데이터 1건 검사 전용; 아래 표의 QA 권한만 |

기존 `soridraw-qa-gh-reader`와 `publishExploreOwnerFollower542`의 실행 서비스 계정은 **변경하지 않는다**.

### 3. 배포 계정의 QA 프로젝트 역할을 한 번에 지정

[Google Cloud QA IAM](https://console.cloud.google.com/iam-admin/iam?project=soridraw-app) → 액세스 권한 부여/수정에서 `soridraw-qa-gh-deployer@soridraw-app.iam.gserviceaccount.com`에 다음 **QA 프로젝트 한정** 역할을 부여한다.

| 역할 표시명 (영문) | Role ID | 사용 목적 |
|---|---|---|
| Cloud Functions Developer | `roles/cloudfunctions.developer` | QA 단독 HTTPS Function 배포/삭제 |
| Service Usage Consumer | `roles/serviceusage.serviceUsageConsumer` | 기존 활성 API 호출 |
| Cloud Datastore User | `roles/datastore.user` | QA 합성곡 1건 생성·삭제·재저장·후처리 |
| Secret Manager Admin | `roles/secretmanager.admin` | QA HMAC Secret 1개 생성 및 QA 실행 계정만 접근하도록 설정; **시험 후 회수 대상** |
| Cloud Run Admin | `roles/run.admin` | **QA 전용 함수 1개에만** 테스트용 HTTP 호출 정책 설정; **시험 후 회수 대상** |

**중요:** Secret Manager Admin 및 Cloud Run Admin은 QA 프로젝트 내에서도 강한 권한이다. 가능하면 IAM 조건으로 **2026-11-30 00:00 KST 이전**까지만 유효하도록 부여하고, 시험 후 즉시 회수한다. GitHub 코드에서 함수명·프로젝트·대상 리소스를 엄격히 검사할 것. 조건 적용이 불가능하면 이 두 역할을 무기한 유지하지 말고 최종 정리 때 회수한다. 프로젝트 `Owner`, `Editor`, `Firebase Admin`, `Security Admin` 부여 금지.

### 4. 배포 계정이 정확한 QA 실행 계정으로만 동작하게 허용

[QA 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=soridraw-app)에서 `soridraw-qa-app518-runtime` 선택 → **권한/액세스 권한 부여** → 새 주 구성원 `soridraw-qa-gh-deployer@soridraw-app.iam.gserviceaccount.com` → **서비스 계정 사용자** `roles/iam.serviceAccountUser` → 저장. **프로젝트 전체의 Service Account User 역할로 부여하지 않는다.**

Cloud Functions v2 배포 시 빌드 서비스 계정에도 `iam.serviceAccounts.actAs`가 요구될 수 있다. 정확한 Cloud Build 서비스 계정 ID는 GitHub에서 조회해 검증한 뒤, 그 **빌드 서비스 계정 자체**에만 동일 권한을 부여해야 한다. 기본 Compute SA로 단정하거나 기존 계정의 Editor 권한을 확대하지 않는다. [공식 문서](https://docs.cloud.google.com/functions/docs/reference/iam/roles).

### 5. 기존 GitHub OIDC Pool에 새 QA 배포 계정 한 번만 연결

[QA Workload Identity Pool](https://console.cloud.google.com/iam-admin/workload-identity-pools?project=soridraw-app) → `soridraw-qa-github` 선택 → **액세스 권한 부여**.

- **서비스 계정 가장을 사용하여 액세스 권한 부여** 선택.
- 서비스 계정: `soridraw-qa-gh-deployer@soridraw-app.iam.gserviceaccount.com`
- **필터와 일치하는 ID만**, 속성 `repository_id`, 값 `1188157610`.
- Pool `soridraw-qa-github`, Provider `app518-readonly`의 기존 issuer/attribute mapping/조건 **수정하지 않는다**. 기존 provider의 GitHub `issue_comment` + main + 정확 APP782 workflow 조건을 그대로 재사용하므로 deploy job은 **그 동일 workflow 파일에만** 추가해야 한다.
- WIF 바인딩만 생성하며 키/JSON/Google 자격증명을 GitHub Secret에 업로드하지 않는다.

### 6. 비용 보호

- [QA Cloud Billing](https://console.cloud.google.com/billing?project=soridraw-app)에서 기존 Blaze/결제 연결은 유지. 계정 번호·카드번호·결제수단 제출 금지.
- [Billing 예산](https://console.cloud.google.com/billing/budgets?project=soridraw-app)에서 **기존 QA $5 월 예산 알림이 없다면 생성**. 예산 알림은 **과금 강제 차단 아님**. 자동화는 `maxInstances:1`, 합성곡 1개, 단계별 요청 수/재시도 횟수/QA Worker 1개 제한, 안전 정리 기준을 코드에 강제한다. 무제한 실전송·무제한 빌드 금지.
- 기존 R2 Paid/Workers Free 기록 재요청 금지.

## 디렉터 설정 완료 후 제가 수행할 일 — 채팅에서 추가 화면 요구 최소화

1. GitHub Actions로 QA OIDC의 **새 deployer 계정** 로그인·프로젝트 번호·권한·정확 빌드 서비스 계정·QA Firestore `(default)` 메타데이터 확인. 기존 APP782/Cloudflare PASS는 재실행하지 않음.
2. QA Secret Manager에서 HMAC 1개를 **Actions 보안 환경에서 생성**하고 QA 함수/임시 Worker에만 주입. 키 원문은 Github 로그, 커밋, 사용자 채팅, artifact에 남기지 않음.
3. 기존 QA D1 `soridraw-qa-app768-d1`에 APP518 전용 테이블을 **기존 팔로우 테이블과 별도 이름공간**으로 준비할 수 있는지, 기존 QA Worker와 병행 가능한지 검증. 기존 Worker `soridraw-owner-qa-583`의 원본 버전 100% 유지. 기존 QA R2는 APP518 전용 키(prefix)만 사용하고 파괴적 초기화 금지.
4. APP518 전용 Firebase HTTPS 함수 한 개, GitHub QA Worker 임시 한 개만 **정확 이름/프로젝트 검증·기본 OFF·범위 가드 후** 배포. QA 외 프로젝트명이나 기존 Function 동명이면 즉시 HOLD. 공개 함수가 필요한 경우에도 **정확 QA 함수 한 개만** HTTP 호출 정책을 조정하고, HMAC 없으면 사용자 정보 읽기 전 거부.
5. 인증된 합성 `favorites/{id}` **1건만** Firestore 생성 → 저장·삭제·재저장 및 연결, 네트워크 장애 → 영속 재시도 → R2 ACK 검증. 원본/타 사용자 데이터 조회·삭제 금지, 총 요청/비용 상한 초과 시 HOLD.
6. 임시 QA Worker·함수·합성 Firestore 데이터·R2 시험 객체·D1 시험 행을 **정확 범위만** 정리, 기존 자원 재확인. Secret Manager Admin/Cloud Run Admin 등 일시 역할 회수(직접 회수 권한이 없으면 정확 제거 항목 한 번에 안내). Actions PASS는 실서버 PASS와 구분해 GitHub 기록.

**하나의 사용자 완료 신호:** Google Cloud 초기 관리자 설정을 모두 마치면 채팅에 **`QA 초기설정 완료`** 한 줄만 전송. 스크린샷은 오류가 발생하거나 화면 구조가 명백히 다른 경우에만 요청.

**주의:** 위 설정만으로 실제 E2E가 자동 PASS가 되는 것은 아니다. APP518 기존 소스의 `trustedIsolatedQaProof` 및 공유 D1 Writer fence는 권한을 부여했다고 자동 입증되지 않는다. 정확 QA 계정과 임시 실행기의 **독립 검증된 proof**를 구현하기 전에는 플래그 값을 조작해 무리하게 전송하지 않는다.

참고: [Firebase Firestore 초기화](https://firebase.google.com/docs/firestore/quickstart), [Google Cloud Functions 배포 권한](https://docs.cloud.google.com/functions/docs/reference/iam/roles), [Firebase Secret Manager 연계](https://firebase.google.com/docs/functions/config-env), [Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines).

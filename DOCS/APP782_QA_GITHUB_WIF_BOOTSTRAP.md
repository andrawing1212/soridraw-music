# APP782 — Cloud Shell 없이 Firebase QA GitHub OIDC 인증 연결

**승인된 작업:** 독립 QA Firebase `soridraw-app`에만 QA 서비스 계정 + GitHub Workload Identity Federation(OIDC) 연결, 읽기 전용 IAM. 운영 프로젝트, 기존 팔로우 QA, Firebase 데이터, Functions 배포, 공유 원본, 비용 설정은 변경하지 않는다.

**기준 (2026-11-23 KST):** Cloud Shell은 Work 브라우저에서 HTTP 403. QA Firebase Console 로그인 PASS, 기존 함수 `publishExploreOwnerFollower542` 1개. APP518 함수 없음. QA Cloudflare 임시 Worker 503/404·삭제 복원은 PASS. [GitHub 인증 워크플로](../.github/workflows/app782-app518-qa-firebase-wif-readonly.yml)는 준비했지만 QA IAM 신뢰 연결은 아직 **미완성**.

## 고정 신원 — 임의로 다른 프로젝트와 섞지 말 것

| 구분 | 허용 값 |
|---|---|
| Google QA Project ID | `soridraw-app` |
| Google QA Project Number | `1083981050742` |
| 운영 Firebase (접근 금지) | `soridraw-app-866a5` |
| GitHub repository | `andrawing1212/soridraw-music` |
| GitHub immutable repository ID | `1188157610` |
| GitHub immutable owner ID | `268937716` |
| WIF pool ID | `soridraw-qa-github` |
| WIF provider ID | `app518-readonly` |
| Service Account ID | `soridraw-qa-gh-reader` |
| Service Account email | `soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com` |

이미 동일한 이름의 리소스가 있으면 **생성을 중단하고 실제 설정부터 읽기 전용 확인**한다. 운영 프로젝트 자격증명, 서비스 계정 JSON 키, 사용자 토큰을 GitHub/채팅에 옮기지 않는다.

## Cloud Console 클릭 경로 — Cloud Shell 불필요

1. [QA 프로젝트 전용 서비스 계정 화면](https://console.cloud.google.com/iam-admin/serviceaccounts?project=soridraw-app)에서 현재 프로젝트가 정확히 `soridraw-app`인지 확인. 없다면 **서비스 계정 만들기**에서 ID `soridraw-qa-gh-reader`를 생성. **서비스 계정 키는 만들지 않는다.**
2. 이 서비스 계정에 **QA 프로젝트 수준에서만** `Browser (roles/browser)`와 `Cloud Functions Viewer (roles/cloudfunctions.viewer)` 두 읽기 전용 역할을 부여. `Owner`, `Editor`, `Firebase Admin`, `Service Account Token Creator`, `Cloud Functions Developer/Admin`, `Service Account User`, 운영 프로젝트 IAM 권한 금지.
3. [QA Workload Identity Federation 생성 화면](https://console.cloud.google.com/iam-admin/workload-identity-pools/create?project=soridraw-app)에서 새 Pool 이름/ID `soridraw-qa-github`, 설명 `QA APP518 read-only GitHub OIDC`. 새 Provider는 `app518-readonly` (OpenID Connect / OIDC), **Issuer URL** `https://token.actions.githubusercontent.com`, **기본 Audience**. 같은 이름의 기존 Pool/Provider가 있으면 덮어쓰지 말고 정확한 설정을 확인.
4. Provider의 **Attribute mapping**을 다음과 같이 지정:
   - `google.subject` ← `assertion.sub`
   - `attribute.repository_id` ← `assertion.repository_id`
   - `attribute.repository_owner_id` ← `assertion.repository_owner_id`
   - `attribute.repository` ← `assertion.repository`

   **Attribute condition**(한 줄) — 매우 중요. 느슨하게 바꾸지 않는다:

   ```cel
   assertion.repository_id == '1188157610' && assertion.repository_owner_id == '268937716' && assertion.event_name == 'issue_comment' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'andrawing1212/soridraw-music/.github/workflows/app782-app518-qa-firebase-wif-readonly.yml@refs/heads/main'
   ```

   정책이 이 조건을 거절하면 무조건 설정을 느슨하게 하지 말고 검증 중단. GitHub repo 소유자/이벤트/특정 main 워크플로만 토큰을 교환하도록 제한해야 한다.
5. 서비스 계정 `soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com`의 **Permissions / Grant access**에서 아래 **Federated principal**에게 그 서비스 계정에 한해 `Workload Identity User (roles/iam.workloadIdentityUser)`만 부여:

   ```text
   principalSet://iam.googleapis.com/projects/1083981050742/locations/global/workloadIdentityPools/soridraw-qa-github/attribute.repository_id/1188157610
   ```

   IAM 바인딩 범위는 **QA 서비스 계정 자체**이지 QA 전체 프로젝트가 아님. 이 principalSet은 Provider의 좁은 Attribute condition과 함께 사용.
6. Google Console에 완료한 Pool/Provider/SA의 정확한 이름과 소속 QA 프로젝트가 표시되는지 확인. **GitHub Repository Variables/Secrets는 별도 등록 불필요**: 공개 가능한 신원 식별자는 workflow에 고정돼 있으며 비밀키는 생성하지 않았다.

## 검증

GitHub 소유자만 Draft [PR #528](https://github.com/andrawing1212/soridraw-music/pull/528)에 정확히 아래 댓글을 남기면 단 한 번 GitHub Actions에서 QA 인증을 읽기 전용으로 확인한다.

```text
/app518-qa-firebase-auth 864f796da24413309567198c9de502b13cdedd50
```

이 명령은 `.github/workflows/app782-app518-qa-firebase-wif-readonly.yml` 실행만 허용한다. 정확한 QA `soridraw-app` 프로젝트 번호 확인 + `asia-northeast3` Functions **이름 목록 GET만** 수행. GitHub Actions 결과 `APP782_QA_FIREBASE_WIF=PASS_SHORT_LIVED_GITHUB_OIDC`와 `APP782_QA_FUNCTIONS_LIST_READ_ONLY=PASS`를 모두 확인해야 통과. 성공한 Workflow **녹색 체크만**으로는 PASS 아님.

**실패 시:** `PERMISSION_DENIED`, `HOLD_*` 등 실제 원인만 수정; 운영 계정 자격증명을 넣어 우회하지 않는다. Google IAM 전파 지연이 있어도 중복 자원을 만들거나 권한을 확대하지 않는다.

**검증 의미:** 이 단계가 PASS해도 APP518 Firestore 합성곡 저장→삭제→재저장 E2E는 **미완료**. 후속 QA Functions 배포·DB migration·합성 데이터 쓰기는 다른 위험 범위이므로 명시 승인 없이 자동 실행하지 않는다.

**공식 참고:** [Google Cloud WIF 설정](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [GitHub OIDC 설정](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform), [Google Auth Action](https://github.com/google-github-actions/auth).

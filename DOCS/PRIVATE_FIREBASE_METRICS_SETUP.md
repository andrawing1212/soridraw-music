# Firebase RTDB 운영 지표: SORIDRAW 프로젝트 채팅 연결

상태: 최초 연결 준비 완료 / Google Cloud 사용자 권한 부여 전 / 실제 지표 미측정.

현재 소스 저장소 andrawing1212/soridraw-music은 PUBLIC. RTDB 동시 접속/다운로드/비용 지표를 PUBLIC GitHub Actions 로그, 아티팩트, issues 또는 Git 이력에 노출하지 않는다.

## 사용자가 한 번만 설정하는 항목

1. GitHub 새 저장소를 andrawing1212/soridraw-ops-private 이름으로 만들고 Private으로 지정한다. 이 PRIVATE repo가 운영 보고서 보관소다.
2. Google Cloud project soridraw-app-866a5에서 Cloud Monitoring API가 활성인지 확인한다. 비활성이라면 소유자가 활성화한다.
3. IAM 및 관리자 > 서비스 계정에서 soridraw-ops-metrics-reader 계정을 신규 생성한다. 이 계정에 프로젝트의 Monitoring Viewer (roles/monitoring.viewer)만 부여한다. Firebase Admin, Editor, Owner 또는 기존 배포 서비스 계정 권한은 사용하지 않는다.
4. IAM > Workload Identity Federation에서 GitHub OIDC provider를 만든다. issuer: https://token.actions.githubusercontent.com. attribute mapping: google.subject=assertion.sub, attribute.repository=assertion.repository, attribute.ref=assertion.ref. provider condition:
   assertion.repository == 'andrawing1212/soridraw-ops-private' && assertion.ref == 'refs/heads/main'
   (private 저장소의 기본 branch가 다르면 실제 이름으로 조정)
5. 새 WIF pool의 repository 한정 principalSet만 metrics reader 서비스 계정에 roles/iam.workloadIdentityUser로 허용한다. pool 전체나 다른 저장소/브랜치는 허용하지 않는다.
6. PRIVATE repo > Settings > Secrets and variables > Actions > Variables 에 두 개 설정:
   SORIDRAW_METRICS_WIF_PROVIDER = projects/실제_PROJECT_NUMBER/locations/global/workloadIdentityPools/실제_POOL_ID/providers/실제_PROVIDER_ID
   SORIDRAW_METRICS_SERVICE_ACCOUNT = 생성한 metrics reader 서비스 계정 이메일
   JSON 서비스 계정 키, 비밀번호, API 키를 채팅에 보내거나 만들 필요 없다.
7. 이 저장소 DOCS/TEMPLATES/firebase-rtdb-metrics-readonly.yml 파일을 PRIVATE repo의 .github/workflows/firebase-rtdb-metrics-readonly.yml에 복사한다. PINNED_SORIDRAW_DIAGNOSTIC_SHA를 검증된 현재 preview 진단 코드 commit 전체 SHA로 치환한 뒤 commit.
8. PRIVATE repo Actions에서 SORIDRAW Firebase RTDB Metrics (Private Readonly) 수동 실행. Summary에서 24시간/30일 발신 다운로드, 24시간 활성 연결·브로드캐스트·부하·저장량을 본다. 보고서는 PRIVATE Actions 아티팩트에서 7일 보존된다.
9. ChatGPT GitHub 연결의 repository access에 PRIVATE 운영 저장소를 추가하면 이 프로젝트 채팅에서도 결과와 운영 상태를 확인하는 기반이 된다. 연결 허용은 반드시 사용자가 수행한다.

## 안전 원칙

- 소스: scripts/audit-firebase-rtdb-metrics-readonly.py. Cloud Monitoring timeSeries.list GET만 실행하고 사용자 데이터·RTDB 실제 값·Security Rules를 조회하거나 수정하지 않는다.
- 실제 지표가 없거나 API 접근에 실패하면 FAIL 처리하고 임의의 0이나 PASS로 보고하지 않는다.
- Cloud Monitoring sent_bytes_count는 총 발신 비용을 비교하는 근사 지표; 실제 최종 과금은 Cloud Billing/Firebase Console과 대조. 조회 종료시점을 45분 늦춰 수집 지연 고려.
- 전역 publicSync/exploreLike 경로 기여분은 Monitoring 합계만으로 직접 분해 불가. 다음 단계 별도 수신 범위/악용 위험 감사 필요.
- 이 준비 작업에서는 Firebase 프로젝트 IAM/WIF를 변경하지 않았으며 배포, TEST/PRODUCTION 승격, RTDB Rules 변경, 사용자 데이터 수정이 없다.
- Private repo 없이 이 템플릿을 PUBLIC 저장소의 workflows 경로로 옮기지 않는다.

공식 문서:
https://firebase.google.com/docs/database/usage/monitor-usage
https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list
https://github.com/google-github-actions/auth

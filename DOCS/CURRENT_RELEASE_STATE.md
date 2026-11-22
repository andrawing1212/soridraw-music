## CURRENT — APP518 QA GitHub 서명 인증·실제 삭제 Event Source 준비 PASS / Cloudflare D1-R2 통합 Live HOLD (2026-11-23 KST)

- **승인 범위 확인:** 전체 QA 합성곡 1건 저장→하드삭제→재저장→통신 장애 재전송을 위한 QA-only 실서버 준비, 운영/TEST/PRODUCTION·공유 사용자 데이터 제외. 이전 [Actions #45083717565](https://github.com/andrawing1212/soridraw-music/actions/runs/45083717565) Firestore synthetic W4+정리 **실서버 PASS**는 재사용, 전체 APP518 E2E와 구분한다.
- **QA GitHub OIDC signed admission:** [PR #1356](https://github.com/andrawing1212/soridraw-music/pull/1356) → `main` `5e3a66044697d22b2b9f0ca0a112f1a134eaf2db`. Cloudflare QA 전용 별도 entry는 GitHub JWKS RSA 서명·immutable `repository_id=1188157610`/`owner_id=268937716`/`actor_id`·정확 APP782 workflow/ref/sha/issue_comment/run/전용 audience/iat/exp 검증 후에만 **PR #528의 분리된** factory로 신뢰 증명 전달. 동일 후보의 기본 export는 계속 OFF. [Actions #45084664418](https://github.com/andrawing1212/soridraw-music/actions/runs/45084664418) Node22 signed/forged/staged immutable candidate no-deploy 검사 `completed/success`; 임시 검사 Workflow 삭제됨. **GitHub 서명은 GitHub가 발급한 실행 신원을 보증하며 별도 인간 독립 감사가 아니다.**
- **실제 하드삭제 receipt 경로 소스:** [PR #1357](https://github.com/andrawing1212/soridraw-music/pull/1357) → `main` `a7448c5115709e7cc8b2072556a5d97cc5a6ca9b`. QA-only `app518QaSyntheticDeleteReceipt` onDocumentDeleted를 추가하여 `favorites/qa518-{runId}-song` 의 **실제 CloudEvent + BEFORE snapshot uid/updateTime**에서만 고정 PR #528의 `recordHardDeleteApp518` 트랜잭션을 호출. 다른 Favorite event/기본 OFF는 읽기·쓰기 0, 최종 정확 QA cleanup 표식만 영수증 제외. QA HTTPS Source 함수 기존 구조 보호. [Actions #45085018953](https://github.com/andrawing1212/soridraw-music/actions/runs/45085018953) 고정 PR #528 TS 빌드/QA 패키지 stage/두 함수·외부 이벤트 거부 `completed/success`. 임시 PR CI 제거됨.
- **Live blocker (의도적 HOLD):** QA 함수 2개/Cloudflare 본 Worker·D1 APP518 테이블/R2 HEAD·BASE **실제 배포/생성·쓰기 0**. 기존 QA Cloudflare QA583를 보호하면서 R2 2키 초기 생성과 사후 exact cleanup을 안전하게 실행할 **임시 전용 Writer/cleanup 경로 및 배포 후 복구 검증**이 아직 준비되지 않았다. 기존 QA R2는 S3 writer 자격 정보가 GitHub 코드에 확인되지 않았으며, GitHub read token만으로 실제 R2 PUT/DELETE를 허용한 증거도 없다. GitHub 서명 검증 코드 PASS를 QA D1/R2 live PASS로 대체하지 않는다. QA 자원·서비스 비용을 안전하게 정리할 방법이 확인되기 전 D1 migration·R2 seed·임시 활성 Worker 배포 금지. APP518 원본 PR #528 `864f796da24413309567198c9de502b13cdedd50` 불변; PREVIEW/TEST/PRODUCTION 배포 없음.
- **다음 단일 경계:** 별도 QA R2 bootstrap/cleanup 경로를 bounded signed GitHub OIDC + QA583/Writer 부재/단일 합성 UID/D1 pilot row 0 조건으로 설계하고, 장애·부분 실패에도 데이터 소유권이 증명될 때만 원복 가능한 것을 우선 검증. 장기 R2 키/새 비용 자원·새 광범위 IAM/정식 배포는 별도 승인 없이 추가하지 않음. APP786 QA deployer 임시 IAM 만료 **2026-12-02 00:00 KST**는 여전히 회수 관리 필요.

---

## CURRENT — APP518 QA 실제 Firebase 한곡 저장·삭제·재저장·정리 PASS / 전체 Worker-D1-R2 E2E HOLD (2026-11-23 KST)

- **승인받은 GitHub 병합 완료:** [PR #1353](https://github.com/andrawing1212/soridraw-music/pull/1353) `main` squash `e30d52240867b53c9fc1088a505f1778652bf6ca` — QA 전용 신뢰 증명·소스 수준 비용 상한·R2 BASE/HEAD 정확 준비/정리·고정 D1 schema plan·Mock save/remove/resave/retry. 기존 PR #528·앱/Worker/Functions/운영 코드 변경 없음.
- **현재 자원 독립성 실조회:** Cloudflare QA schema/QA583 유지 [Actions #45082844326](https://github.com/andrawing1212/soridraw-music/actions/runs/45082844326), D1 SELECT `rows_written=0`; APP518 표 아직 없음. [PR #1354](https://github.com/andrawing1212/soridraw-music/pull/1354) read-only 실행기 병합, 모의 테스트 수정 `f8f0b410`, [Actions #45083329719](https://github.com/andrawing1212/soridraw-music/actions/runs/45083329719) `completed/success`: Cloudflare QA Worker 1·D1 1·R2 1, 원본 QA583 고정 버전/바인딩 보호, Firebase QA `soridraw-app` (번호 `1083981050742`) Firestore `(default)` 서울·기존 함수 1개·APP518 함수 0 확인. 운영 계정 접근/데이터 쓰기 0.
- **첫 실제 QA 쓰기 성공:** [PR #1355](https://github.com/andrawing1212/soridraw-music/pull/1355) 한곡 전용 REST 실행기 병합 `397ec6b04502d1813545404f5a49385139003dfa`. [Actions #45083717565](https://github.com/andrawing1212/soridraw-music/actions/runs/45083717565) `completed/success` 실로그 `APP518_QA_REAL_FIRESTORE_CREATE_HARD_DELETE_RESAVE_FINAL_ABSENCE=PASS`, 합성 UID `qa518-45083717565-owner` / 문서 `favorites/qa518-45083717565-song`에 한정: 신규 생성→정확 서버 updateTime CAS 삭제→동일 ID 재생성→정확 CAS 삭제→최종 GET 404. **성공한 API 쓰기 4회, 총 요청 8회, 최종 문서 없음**. Firestore 측 실제 청구액은 미계측. 기존 QA 팔로우/사용자 원본/Cloudflare D1·R2/보안 규칙/IAM 변경 0. **이 검증은 APP518 delete-receipt 트리거/서버 경로 테스트가 아니라 QA Firestore 저장·삭제 연결 시험**.
- **아직 HOLD:** PR #528 후보 APP518의 Firebase HTTPS Function→HMAC→임시 Cloudflare Worker→QA D1 버전 Outbox→R2 조건부 PUT→D1 ACK/재시도/원복은 **배포·실측 0/NOT_TESTED**. `qaGate518`는 외부에서 고정 신뢰한 Ed25519 서명증거가 필요하나 실제 QA 서명/인증·배포 controller/정확 R2 정리 실행기는 아직 미연결. Env `VERIFIED` 플래그를 임의 설정하거나 스스로 서명해 독립 검증이라 주장하며 진행 금지. D1 APP518 표 없음. 기존 QA 서버에 임의 새 schema·R2 seed를 남기지 않음. GitHub Artifact Attestation/Sigstore의 별도 증명 경로를 사용할 경우에도 신원·환경·산출물 검증 및 기존 QA Writer 부재를 **실제로** 입증해야 함.
- **정리/릴리스:** PREVIEW/TEST/PRODUCTION 배포 없음. 앱 실제 PC·모바일 동기화 미검증. APP786 QA deployer 임시 IAM 2026-12-02 00:00 KST 만료 조건은 별도로 남아 있고, APP787 Viewer role은 이미 회수됨. QA R2 Paid/Firebase Blaze 비용은 예산 알림이 실제 지출을 차단하지 않으므로 전체 E2E 배포 전 독립 서명·비용 제한·Worker 안전 정리 계획 확인 필수.

---

## CURRENT — APP518 QA 격리 한곡 게이트·초기화·원복 소스와 Mock 검증 PASS / Live HOLD (2026-11-23 KST)

- **현재 승인 범위는 소스 전용**이며 GitHub [Draft PR #1353](https://github.com/andrawing1212/soridraw-music/pull/1353) (`fix/app518-qa-isolated-controller`, base `main`)에만 신규 `qa/app518/isolated/*` 코드 5개를 저장. PR #528 (`864f796da24413309567198c9de502b13cdedd50`) 보호 구조·공유 앱·기존 QA583 Worker·Rules·Functions·UI 코드는 **변경 0**. main 미병합, PREVIEW/TEST/PRODUCTION 배포 없음.
- **새 코드:** 서명된 별도 감사 키(보호된 공개키 SHA256)와 정확 QA Account `b60fcd62c679c64db19f0b0e0c2f3429`/Firebase `soridraw-app`/고정 PR 소스/기존 QA583 활성 버전/DB·R2·활성 deny-all hash/월 5,000KRW 알림 검증이 모두 일치할 때만 인메모리 신뢰 증명 발급; **env의 VERIFIED 문자열만으로 켜지지 않음**. GitHub 실행 ID에서 `qa518-{runId}-owner/song` 한곡만 도출. R2 빈 BASE/HEAD 2개 `onlyIf` 생성(기존 키 발견 시 HOLD), Worker 부재·QA583 복원·D1 pilot 0 등 확인 후 정확 두 키만 정리. PR #528 고정 D1 migration 3파일의 5표·2인덱스(총 7 DDL)만 계획, 부분 적용 기존 스키마면 HOLD. 최대 Firestore W6·D1 rowsWritten 예약96·R2 PUT8/GET32·HTTP18·2분의 **소스 수준 안전 상한**, 실제 클라우드 과금 실측 아님. 저장→서버 검증 hard-delete receipt→재저장→R2 장애 1회→유한 재시도→오래된 삭제 거부→정확 QA 자료 정리 또는 HOLD 상태 머신 추가.
- **GitHub 시험 성공:** [Actions #45081586169](https://github.com/andrawing1212/soridraw-music/actions/runs/45081586169) (`completed/success`). Node 22 단독 테스트, PR #528 immutable SHA의 실제 SQL 파일을 Git worktree로 읽어 검사, 잘못된 서명·외부 소유자·다른 Worker/DB·파괴적인 DDL·부분 seed/원복·상한 초과 fail-closed, mock 서버 save/remove/resave/retry PASS. **실제 GCP/Cloudflare 인증·실서버 데이터 호출/쓰기 0**. 해당 검사만을 위한 일회성 Workflow는 PASS 이후 PR branch에서 제거; 최종 PR에는 남지 않음.
- **남은 정확한 차단점:** 실제 Cloudflare/Firebase GET-only 관찰을 수집하고 **독립적으로 서명할 보호 키·릴리스 관리 실행기**는 아직 연결 안 됨. QA 전용 source/function 실제 배포·D1 518 migration·R2 seed·HMAC server transport·Firestore 합성곡 쓰기/정리 **전부 NOT_TESTED/HOLD**. 현 코드는 `qaGate`+일부 backend adapter 주입 규격이며 **완성된 live controller나 E2E 증거가 아님**. APP781/786/787 PASS 재사용, QA 개발 다음 승인 없이 운영 환경이나 공유 원본으로 대체 실험 금지.

---

## CURRENT — APP518 실서버 합성곡 1건 승인 후 QA 릴리스 게이트 점검 / 실제 쓰기 HOLD (2026-11-23 KST)

- **이번 승인 범위:** 격리 QA Firebase `soridraw-app`, Cloudflare 독립 QA 계정만 사용하여 합성곡 1건 save→remove→resave/장애 재전송, 필요한 최소 QA Function/Worker 배포 후 정확 원복. 운영·PREVIEW·TEST·PRODUCTION 및 공유 사용자 원본 변경 금지. 비용 상한·독립 신뢰·원복 불명확 시 쓰기 전에 중단.
- **재사용한 PASS:** APP786 QA Windows 초기설정 및 배포자 GitHub OIDC [#45074260938](https://github.com/andrawing1212/soridraw-music/actions/runs/45074260938), APP787 실제 활성 Firestore deny-all [#45079320076](https://github.com/andrawing1212/soridraw-music/actions/runs/45079320076)와 Viewer 임시 IAM 회수, APP781 QA 일시 OFF Worker 배포→복원 [#45054747523](https://github.com/andrawing1212/soridraw-music/actions/runs/45054747523), QA D1 Schema/리소스 선행 확인. 중복 검사·재배포 없음.
- **직접 코드 차단 확인:** Draft PR #528 고정 SHA `864f796da24413309567198c9de502b13cdedd50`의 `cloudflare/media-worker/src/app518IsolatedQaWorker518.js`는 기본 export에 `trustedIsolatedQaProof`가 없어 실제 요청이 항상 OFF(503). `qaScopeValid`/R2 provider는 `SORIDRAW_CANONICAL_CATALOG_518=ENABLED_AFTER_SHARED_ROLLOUT` 및 공유 Writer·D1 account-wide ledger 독립 검증을 요구하는데, 운영 공유 Writer cutover는 QA 승인 범위 밖이며 QA 독립 릴리스 증거 대체 경로 없음. `catalogR2Provider518.js`는 `canonicalAuthority518`가 이미 붙은 정본 R2 HEAD/BASE를 요구하지만 QA 1곡 시작용 인증된 초기화·원복 경로가 없음. `qa/app518/firebase/index.cjs`는 OFF 기본값인 HTTPS 조회 함수 1개뿐이고 자동 이벤트/dispatcher는 미배포. D1 APP518 migration 3개는 dormant이며 선행 QA schema 조회에서 누락 확인. 이 상태로 쓰면 실제 검증이 아니며 임의 `VERIFIED` flag 주입 금지.
- **실행 결과:** GitHub `preview` `4e8748236d59444ce4a23d5611e22323c4ea221d`, `main` 현재 기준 및 PR #528 확인. 이번 승인 이후 **QA 배포/Firestore 합성 데이터 쓰기/D1 migration/R2 seed/Worker 활성화 0**; 코드 및 기존 기능 수정 0. 실제 save→remove→resave **NOT_TESTED/HOLD**, 사전 PASS를 실사용 PASS로 격상하지 않음.
- **다음 필요한 단일 개발 범위:** 운영 공유 cutover와 분리된 **QA 전용 신뢰 증명·정확 1곡 D1 쓰기 상한·R2 HEAD/BASE 안전 초기화·유한 재시도/정확 정리 컨트롤러**를 source-only로 설계·검증해야 함. 단순 환경변수 우회·전역 ledger 임의 `VERIFIED` 선언 금지. 독립 비용/기존 QA583 무변경/복원 증거가 확보되어야 실제 QA 배포 및 합성 쓰기 허용. 새로운 QA DB/R2 과금 자원 생성은 범위·비용 별도 승인 전 금지.

---

## CURRENT — APP787 QA Firestore 활성 규칙 실검증 PASS·임시 Viewer 권한 회수 PASS (2026-11-23 KST)

- **정확한 QA 한정:** Firebase QA `soridraw-app` (프로젝트 번호 `1083981050742`)만 확인. [PR #1352](https://github.com/andrawing1212/soridraw-music/pull/1352) 병합 `cd68058d16c476abd053fc5d98423b521741fce8`: 기존 APP782 owner-only/OIDC QA reader 워크플로에 활성 `cloud.firestore` release→ruleset **GET 두 건**의 검증 추가. 기존 APP786 QA/Cloudflare PASS 재시험 불필요.
- **실제 GitHub 인증·활성 규칙 PASS:** 첫 [Actions #45079218301](https://github.com/andrawing1212/soridraw-music/actions/runs/45079218301)은 Viewer 권한 추가 직후 `APP787_HOLD_RULES_HTTP_403`으로 **FAIL/HOLD**. 다른 역할·API·설정 변경 없이 동일 검사 1회 재실행한 [Actions #45079320076](https://github.com/andrawing1212/soridraw-music/actions/runs/45079320076)은 `completed/success`이며 실제 출력 `APP787_QA_ACTIVE_FIRESTORE_RELEASE=PASS`, `APP787_QA_ACTIVE_RULESET_EXACT_DENY_ALL=PASS`, `APP787_QA_READ_ONLY=PASS; RULES_WRITES=0; FIRESTORE_DOC_READS=0`. 활성 rule source SHA256 `ecf30f940747dcc3c5ba4993093e9a11ac9fc5df7e14b2a1512d2446923d84eb`. 정확 한 개 `match /{document=**} { allow read, write: if false; }`만 허용, 다른 허용 규칙 없음.
- **임시 권한 회수 PASS (디렉터 Windows 화면):** QA reader 서비스 계정에 `roles/firebaserules.viewer`를 IAM 만료조건 `2026-11-22T23:11:52Z` (2026-11-23 08:11:52 KST)으로 한 번 부여. 읽기 검증 후 정확 해당 조건 IAM binding만 제거, Google IAM 정책 재조회 후 `APP787_TEMP_VIEWER_REVOKED_PASS` 직접 확인. 이는 디렉터 PowerShell 조회·회수 증거이며 별도 GitHub IAM 감사가 아님. 권한/규칙 추가 변경 없음.
- **완료 경계:** APP787 실제 활성 보안 규칙 deny-all 검증 **PASS**. QA Firestore에 대한 앱 클라이언트 접근 차단이지 서버 IAM/Admin SDK 접근 통제를 입증하는 검사는 아님. APP518 QA 합성곡 save→delete→resave/retry 및 QA-only Firebase Function/Cloudflare Worker 배포 **NOT_TESTED/HOLD**; PREVIEW/TEST/PRODUCTION 앱·공유 원본·규칙 변경 0. APP786 QA deployer 별도 임시 IAM 역할은 2026-12-02 00:00 KST 만료조건으로 **남아 있음**; APP787 Viewer 권한 회수와 혼동 금지.

---

## CURRENT — APP786 Windows QA 초기설정 PASS + GitHub QA deployer admission PASS (2026-11-23 KST)

- **Windows 실제 QA 설정 완료 (디렉터 화면):** `APP786_QA_BOOTSTRAP_PASS`. 정확 QA Firebase `soridraw-app` / 번호 `1083981050742`, 기존 GitHub WIF 조건 확인, 한 프로젝트에만 적용된 `5000KRW/month` 예산 알림, Seoul Firestore `(default)` Standard/Native, QA 전용 Runtime/Deployer 서비스 계정 2개, QA 한정 프로젝트 IAM 6건·서비스 계정 IAM 3건, QA HMAC Secret 접근 완료. 기존 자원은 재생성 없이 SKIP. 보안키 원문·서비스 계정 JSON 키 노출/생성 없음. **예산은 지출 차단 한도가 아님**.
- **GitHub 원격 읽기 검증 PASS:** 기존 main 워크플로에 PR #528 댓글 `/app518-qa-deployer-admission 864f796da24413309567198c9de502b13cdedd50`를 저장소 소유자 계정으로 1회 제출; [Actions #45074260938](https://github.com/andrawing1212/soridraw-music/actions/runs/45074260938) `completed/success`. 실제 job 로그에 `APP786_QA_DEPLOYER_GITHUB_OIDC=PASS`, `APP786_QA_DEFAULT_FIRESTORE_METADATA=PASS`, `APP786_QA_EXISTING_FOLLOW_FUNCTION=PASS`, `APP786_QA_CLOUD_MUTATIONS=0; QA_APP518_E2E=NOT_TESTED` 모두 확인. 기존 팔로우 함수 조회 정상, APP518 배포 함수 없음.
- **복구 코드:** [PR #1351](https://github.com/andrawing1212/soridraw-music/pull/1351) 에 Windows KRW/QA 단일 프로젝트 예산 확인·부분 적용 재개·PowerShell 5.1 SA 바인딩 빈 목록 `.Count` 수정을 저장했으나 **main 미병합**. 앱/Cloudflare/공유 데이터/TEST/PRODUCTION 배포 0.
- **다음 범위 구분:** APP786 초기 관리자 구성 + GitHub 인증/읽기 검증 완료. QA 클라이언트 Firestore Rules deny-all, QA-only APP518 Function/Worker 실배포·Cloudflare D1/R2 실제 쓰기 및 합성곡 1건 save→delete→resave/retry는 **NOT_TESTED/HOLD**. 신규 백엔드 배포·규칙/데이터 변경은 비용·원복 경계 검증 및 디렉터 승인 없이는 강행하지 않음. APP786 임시 deployer IAM 권한은 **2026-12-02 00:00 KST 만료조건**; 실제 회수는 미검증.

---

## CURRENT — APP786 Windows QA 관리자 1회 자동 설정 스크립트 준비·Windows 정적 검사 PASS / 실적용 대기 (2026-11-23 KST)

- **디렉터 현재 지시:** 관리 화면을 하나씩 확인시키지 말고 Windows Google Cloud CLI 한 번 로그인 후 APP518 QA 초기 관리자 권한/자원 설정을 **한 번에** 실행. 짧고 핵심만 보고. Cloud Shell·Codex Linux 인증 재시도 금지.
- **실행 산출물:** [APP786 Windows 관리자 부트스트랩](../scripts/app786-qa-windows-bootstrap.ps1), [실행 방법](./APP786_WINDOWS_BOOTSTRAP.md). 기본 실행은 읽기 전용 사전검사; `-Apply`일 때 프로젝트 `soridraw-app` 번호 `1083981050742`, 기존 WIF GitHub immutable repo/owner/workflow, Firestore 목록, QA Cloud Build SA, QA 결제/예산을 먼저 읽고 확인 문구 `SORIDRAW-QA` 이후에만 변경. 운영 프로젝트 참조/서비스 계정 키 생성/기존 팔로우/공유 데이터 변경/APP518 실배포 금지.
- **계획된 초기 변경:** QA 프로젝트 한정 $5 월 예산 알림(실제 지출 강제 차단 아님), `(default)` DB 미존재 때만 서울 Standard Native/삭제 보호 생성, QA 전용 runtime/deployer 2계정, GitHub reader 유지 및 기존 WIF의 deployer 연결, Cloud Build 정확 SA에만 `actAs`, QA HMAC Secret 한 개 생성 및 역할 범위 지정. 배포자 강한 QA 역할은 2026-12-02 00:00 KST 만료조건 부여/시험 후 회수. Firebase Web/Mobile 클라이언트 Firestore Rules는 별도 검증 필수.
- **실제 검사:** Windows runner [Actions #45065471539](https://github.com/andrawing1212/soridraw-music/actions/runs/45065471539) PowerShell Parser/금지 명령/고정 QA 신원·만료 정적 검사 PASS. Windows CI는 QA 고정 신원·배포자 권한 만료와 PowerShell 문법을 확인했고, 관리자 실환경 인증·스크립트 실행은 **NOT_TESTED**. 기존 APP781/782/783 PASS는 재사용하고 반복 검사하지 않음.
- **이어갈 자동 경로:** 기존 APP782 GitHub workflow에 소유자/PR #528 한정 `qa_deployer_admission` 준비. Windows 부트스트랩 **실제 PASS** 후 QA deployer OIDC·QA Firestore·기존 팔로우 함수 목록 GET을 1회 실행. 앱/Functions/Worker 실전송·QA 합성곡 저장/삭제/재시도/원복은 **NOT_TESTED/HOLD**.
- **현시점 변경:** GitHub 스크립트·워크플로·문서만 저장. Google Cloud/Cloudflare IAM·DB·Secrets·배포/사용자 데이터 실변경 0. 사용자 쪽에서 관리자 인증 및 Windows 1회 실행 필요.

---

## CURRENT — APP785 QA 일괄 관리자 설정서·전용 Runtime 권한 고정 / 실서버 E2E HOLD (2026-11-23 KST)

- 디렉터가 일반 Chrome에서 [QA Firestore 초기 화면]을 제공: 프로젝트 `soridraw-app`에 **Cloud Firestore '데이터베이스 만들기' 화면**이 표시됨. DB는 미생성으로 보이며, 기존 APP784 GitHub 읽기 서비스 계정의 실제 DB 목록 조회는 `PERMISSION_DENIED`였으므로 Firestore DB 존재를 인증 완료로 표시하지 않는다.
- 매번 개별 스크린샷/권한 요청을 하지 않도록, [APP785 디렉터 최초 설정 일괄 안내](./APP785_QA_ONE_TIME_ADMIN_SETUP.md)에 **(default) Standard/Native Seoul·프로덕션 규칙, 독립 QA `soridraw-qa-gh-deployer`·`soridraw-qa-app518-runtime`, 제한된 배포/데이터 권한, 기존 WIF 재사용, Cloud Build Service Account User 범위 확인, QA 예산 보호**를 한 번에 정리. 기존 읽기 전용 `soridraw-qa-gh-reader`는 역할 확대하지 않음.
- APP783 QA 전용 HTTPS Function 코드 `qa/app518/firebase/index.cjs`에 **실행 SA `soridraw-qa-app518-runtime@soridraw-app.iam.gserviceaccount.com` 명시**. 기본 Compute/운영 서비스 계정에 의존하지 않음. `verify.mjs`에서 해당 명시 바인딩을 정적 확인. [Actions #45062572749](https://github.com/andrawing1212/soridraw-music/actions/runs/45062572749) 실제 PR #528 고정 소스 컴파일/QA 함수 기본 OFF/운영 프로젝트 거절/1함수·0트리거 PASS; **실배포·DB 생성·Firestore 변경 0**.
- **진행 상태:** Cloudflare APP781 PASS 및 GitHub→Firebase APP782 OIDC PASS 유지. APP784 Firestore 목록 `HOLD_PERMISSION_DENIED` 유지. 사용자 QA 초기 IAM·DB 구성 대기이며 GitHub 자동 배포/합성곡 E2E는 아직 `NOT_TESTED/HOLD`; 기존 팔로우 QA·공유 사용자 원본·PREVIEW·TEST·PRODUCTION 변경 없음. Cloudflare 자격증명/Blaze/토큰 정보를 반복 요구하지 않음.

---

## CURRENT — APP784 QA Functions/APIs 읽기 전용 사전점검 / Firestore 메타데이터 403 HOLD (2026-11-23 KST)

- **기준:** APP782 GitHub OIDC QA 인증 및 APP783 단일 Firebase QA function 소스 빌드 PASS 재사용; 별도 Functions/Firestore/D1/R2/cloud shell 재배포 없음. PR #528 SHA `864f796da24413309567198c9de502b13cdedd50`, main 검사 추가 후 최신.
- **실제 독립 QA 조회:** [GitHub Actions #45060974039](https://github.com/andrawing1212/soridraw-music/actions/runs/45060974039) QA 전용 WIF `soridraw-qa-gh-reader` 인증, 정확 프로젝트 번호 `1083981050742` PASS. 활성 API 목록에 Cloud Functions/Cloud Run/Cloud Build/Artifact Registry/Secret Manager/Firestore/IAM Credentials 전부 존재 확인. 기존 `publishExploreOwnerFollower542` 1개 보존, APP518 배포 함수 0.
- **차단 근거:** `gcloud firestore databases list --project=soridraw-app`은 현 서비스 계정에 Firestore 데이터베이스 **메타데이터 조회 권한이 없어 실패**. 실패 결과로 DB 실제 존재/부재는 판단하지 않음. 이 진단에서 사용자 레코드나 DB 내용을 읽지 않음.
- **false-green 수정 및 실제 실패 확인:** APP784 전용 job을 `HOLD`면 적색 실패 처리하도록 바로 수정. [Actions #45061255570](https://github.com/andrawing1212/soridraw-music/actions/runs/45061255570) `APP784_QA_FIRESTORE_DATABASE_METADATA=HOLD_PERMISSION_DENIED`, `APP784_QA_FULL_E2E_READY=HOLD_FIRESTORE_DATABASE_UNVERIFIED`, job failure가 **의도한 안전 차단**임을 확인. 이전 #45060974039의 녹색 결과는 Firestore 준비 PASS 아님.
- **승인 범위/진행:** 디렉터가 2026-11-23 KST 추가 승인한 것은 **독립 QA에서 필요한 한시적 최소 권한·합성곡 하나 실전송**이며 운영 Firebase `soridraw-app-866a5`·사용자 원본·기존 QA 팔로우·TEST/PRODUCTION 변경은 승인되지 않음. 현재 IAM 권한 추가/QA 데이터 쓰기/QA DB 생성/Function 배포/Cloudflare mutation은 **실행 0**. GitHub QA 읽기 전용 작업만 진행.
- **다음 최단 안전 경로:** 사용자의 일반 Chrome 공식 Firebase QA 콘솔에서 `soridraw-app`의 Cloud Firestore `(default)` 존재 여부를 읽기 전용으로 한 번 확인. 없으면 기존 QA 원본·비용·Rules 상황 검토 후 분리 DB 여부 판단; 있음이 확인되면 **별도 최소권한 QA 런타임 계정과 일시적인 배포 주체 역할**만 설정하고, QA 전용 서명/임시 Worker 및 정확 합성 문서 1개로 E2E 진행. 단순 조회 403 해소를 이유로 운영 자격증명/QA 관리자 역할을 무제한 부여하거나 Firestore DB를 무단 생성하지 않음.
- **절대 상태 구분:** APP783 빌드 PASS, APP782 IAM 읽기 PASS, APP784 API 메타데이터 일부 PASS 및 Firestore metadata 권한 HOLD, APP518 실제 Firebase↔Cloudflare save→delete→resave/retry E2E **NOT_TESTED/HOLD**.

---

## CURRENT — APP783 APP518 Firebase QA 단건 함수 분리 빌드 PASS / 실배포·E2E HOLD (2026-11-23 KST)

- **APP782 실제 인증 PASS 재사용:** [Actions #45059378813](https://github.com/andrawing1212/soridraw-music/actions/runs/45059378813), QA Firebase WIF `soridraw-app` 읽기 전용 정상. 재검사하지 않음.
- **APP783 새 안전한 산출물:** `qa/app518/firebase/index.cjs`는 `app518QaExactFavoriteSource` **한 개 HTTPS 함수만** 내보내며, PR #528 고정 소스의 `app518ServerTransport/CanonicalSourceProvider/EventSafetyFence` 컴파일 결과만 재사용. 공유 `functions/src/index.ts`, `securedIndex`, 원래 팔로우 Functions, Firestore trigger/cron, Firebase Rules, 사용자 UI는 수정하지 않음. `firebase.app783-qa.json`의 단독 codebase `app518qa`만 사용해 기존 default 코드베이스 삭제/덮어쓰기 위험 분리.
- **CI 실제 검사:** [Actions #45060366022](https://github.com/andrawing1212/soridraw-music/actions/runs/45060366022) 성공. 정확 후보 SHA `864f796da24413309567198c9de502b13cdedd50` TypeScript 컴파일 후 QA 전용 패키지 구성 PASS, QA 기본 OFF 503 PASS, 운영 Firebase 프로젝트 및 타 프로젝트 거부 PASS, 실제 Firestore 호출 0 PASS. 7일 보존 GitHub 산출물 `app783-qa-exact-source-off` 생성(artifact id `14768878569`). 추가 `firebase.app783-qa.json` JSON 정적 격리 검사 PASS. **컴파일 PASS != 실제 서버 배포 PASS**.
- **현재 원격 차단:** QA WIF 서비스 계정 `soridraw-qa-gh-reader`에는 **Browser+Cloud Functions Viewer만 있음**. Cloud Functions 배포·Secret Manager 자격증명 생성·Firestore 합성곡 쓰기 권한은 없음. 우회하거나 읽기 전용 계정에 임의로 관리자 권한을 추가하지 않음. QA Secret Manager `SORIDRAW_CATALOG_SERVER_HMAC_518`의 별도 인증·전용 실행 controller, APP518 QA D1 tables/계정 Writer proof도 미구성. 현재 APP518 원격 save→delete→resave/retry **NOT_TESTED/HOLD**.
- **변경·보호:** GitHub QA 전용 패키지/워크플로 및 QA-only Firebase codebase 설정만 생성. Cloudflare QA Worker/D1/R2 실서버 변경 0, Firebase QA Functions·IAM·Firestore 변경 0, 운영/TEST/PRODUCTION/공유 데이터 변경 0. 새 QA Functions 배포는 별도 일시적인 최소권한 배포 실행계정·QA 전용 HMAC/DB 준비·비용 상한·정확 원복 경로 확보 후 가능. 현재 실 배포 승인으로 오해하지 말 것.

---

## CURRENT — APP782 QA GitHub OIDC ↔ Firebase 실제 인증·Functions 조회 PASS (2026-11-23 KST)

- **실서버 인증 완료:** 디렉터가 일반 Chrome의 Google Cloud QA IAM 콘솔에서 정확 QA 서비스 계정 `soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com`, WIF Pool `soridraw-qa-github`, OIDC Provider `app518-readonly`를 생성하고 QA 서비스 계정 가장 접근 권한을 `repository_id=1188157610`에 한정해 연결. Firebase QA Project `soridraw-app` (Number `1083981050742`)만 사용하고 운영 프로젝트 계정/키는 사용하지 않음. WIF Provider의 매핑 `google.subject`/`attribute.repository_id`/`attribute.repository_owner_id`/`attribute.repository` 및 정확 workflow/event 제한은 디렉터의 콘솔 입력 캡처와 설정서를 따름. 실제 IAM 정책 내용의 별도 API 덤프 검증은 수행하지 않음.
- **GitHub OIDC 실검증:** [Actions #45059378813](https://github.com/andrawing1212/soridraw-music/actions/runs/45059378813) `qa_firebase_auth_readonly` 완료/success. 실행 로그 **`APP782_QA_FIREBASE_WIF=PASS_SHORT_LIVED_GITHUB_OIDC`** 와 **`APP782_QA_FUNCTIONS_LIST_READ_ONLY=PASS`** 확인. Google Cloud `gcloud projects describe soridraw-app` ID/number 확인 및 `gcloud functions list --regions=asia-northeast3 --project=soridraw-app` 정상 완료. 이는 Google IAM/OIDC 토큰 교환 및 QA 함수 메타데이터 읽기 실제 PASS이며 Cloud Shell 미사용.
- **Firebase QA 배포 함수 수:** 1개, 기존 `publishExploreOwnerFollower542` 확인. **`app518ExactFavoriteSource` 및 `app518FavoriteCatalogChanged` 둘 다 없음**. 따라서 APP518 실제 Firebase↔Cloudflare 합성곡 save→delete→resave→fault recovery E2E는 여전히 **NOT_TESTED/HOLD**.
- **변경 범위:** QA Google IAM 서비스 계정/WIF 연결(디렉터가 승인 후 UI에서 구성), GitHub Actions 읽기 전용 검증 실행. Firebase Functions 배포 0, Firestore/Auth/RTDB/보안 규칙/QA 팔로우 기능 변경 0, 서비스 계정 JSON 키 생성 0, 운영 Firebase `soridraw-app-866a5` 접근 0, 공유 사용자 데이터 변경 0. 기존 Cloudflare APP781 PASS 재시험 없음.
- **다음 독립 작업:** APP518 QA용 정확 한 곡 Firebase source/trigger 및 D1 QA-only migration, 검증된 release proof, 한정된 비용·원복 경계를 별도로 완성해야 실제 실전송 검증이 가능. APP782 읽기 전용 인증 PASS는 APP518 함수 배포 승인이나 종합 E2E PASS가 아님.

---

## CURRENT — APP782 QA WIF 인증 경로 고정 / Google IAM 콘솔 신뢰 연결 생성 대기 (2026-11-23 KST)

- **디렉터 승인:** 독립 Firebase QA `soridraw-app`에 국한된 GitHub Actions OIDC/WIF provider, 읽기 전용 서비스 계정 및 최소 권한 연결. 운영 프로젝트·공유 데이터·기존 팔로우 QA 변경/정식 배포 승인 아님.
- **GitHub 준비 완료:** [APP782 GitHub 인증 워크플로](../.github/workflows/app782-app518-qa-firebase-wif-readonly.yml)에서 프로젝트 번호 `1083981050742` 고정, WIF provider `projects/1083981050742/locations/global/workloadIdentityPools/soridraw-qa-github/providers/app518-readonly`, QA 서비스 계정 `soridraw-qa-gh-reader@soridraw-app.iam.gserviceaccount.com` 고정. GitHub Variables·서비스 계정 JSON키·기존 운영 Firebase Secrets 불필요. GitHub 작업은 repo 소유자의 PR #528 정확한 명령만 허용. OIDC는 job에서만 `id-token:write`, `contents:read`; Firebase 연결 후 project ID·number·함수 이름 목록 GET만 실행.
- **설정 가이드:** [APP782 QA Google Cloud Console 전용 구성](./APP782_QA_GITHUB_WIF_BOOTSTRAP.md). GitHub repository ID `1188157610` / owner ID `268937716` 및 `issue_comment`+`main`+APP782 정확한 워크플로로 IAM provider 입장조건 고정; `roles/browser`, `roles/cloudfunctions.viewer`은 QA 프로젝트에만, `roles/iam.workloadIdentityUser`는 정확 QA 서비스 계정에만. IAM 권한 확대·서비스 계정 키 생성·운영 자격증명 재사용 금지.
- **실제 상태:** 현재 이 채팅에 Google Cloud IAM 관리자 조작/컴퓨터 브라우저 연결이 없고 Work Cloud Shell은 HTTP 403으로 차단되어 **WIF Pool/Provider/서비스 계정은 실제 생성·설정되지 않음**. GitHub Code/Runbook 작성 완료와 Google Cloud IAM 설정 완료는 서로 다름. APP782 과거 [Actions #45056180022](https://github.com/andrawing1212/soridraw-music/actions/runs/45056180022) `HOLD_QA_GITHUB_IDENTITY_NOT_CONFIGURED` 근거 유지. 새 고정 워크플로는 원격 IAM 연결 전 성공을 주장하거나 반복 재실행하지 않음.
- **계속할 실행 지점:** QA Google Cloud 관리 UI에서 가이드의 고정 리소스와 최소 IAM 역할을 설정한 뒤, PR #528에 `/app518-qa-firebase-auth 864f796da24413309567198c9de502b13cdedd50` 1회 실행, **실제 로그 `APP782_QA_FIREBASE_WIF=PASS_SHORT_LIVED_GITHUB_OIDC`와 `APP782_QA_FUNCTIONS_LIST_READ_ONLY=PASS` 동시 확인**. 이후 APP518 원격 1곡 E2E는 아직 미완료, 별도의 안전·변경 범위 판단이 필요. 이전 Cloudflare PASS/Emulator PASS는 재실행하지 않음.
- **현재 실제 서버 변경:** Google Cloud IAM/Functions/Firestore/Auth 변경 0, Cloudflare D1/R2/Worker 변경 0, PREVIEW·TEST·PRODUCTION 변경 0. GitHub 코드·문서만 변경.

---

## CURRENT — APP782 Cloud Shell 대체 GitHub QA Firebase 인증 경로 준비 / 신뢰 연결 미설정 HOLD (2026-11-23 KST)

- **Cloud Shell 재시도 대신 GitHub OIDC 경로 준비:** `.github/workflows/app782-app518-qa-firebase-wif-readonly.yml` 신규 추가. PR #528에 저장소 소유자 고정 명령 `/app518-qa-firebase-auth 864f796da24413309567198c9de502b13cdedd50`를 게시했을 때만 실행. GitHub Actions의 단기 OIDC로 **오직 QA Google Cloud 프로젝트 `soridraw-app` (Project Number `1083981050742`)**의 서비스 계정을 인증하도록 설계. 운영 프로젝트/서비스 계정·기존 `FIREBASE_SERVICE_ACCOUNT_SORIDRAW` 등 운영 자격증명 사용 금지. Google/Firebase 데이터 쓰기·함수 배포·IAM 변경 없음.
- **실제 GitHub 실행 결과:** [Actions #45056180022](https://github.com/andrawing1212/soridraw-music/actions/runs/45056180022) `qa_firebase_auth_readonly` job `completed/success`이나 실제 출력은 **`APP782_QA_FIREBASE_WIF=HOLD_QA_GITHUB_IDENTITY_NOT_CONFIGURED`**. QA WIF provider/QA service account를 지정하는 저장소 variables `SORIDRAW_QA_WIF_PROVIDER`, `SORIDRAW_QA_SERVICE_ACCOUNT`이 아직 등록되지 않아 **Google 인증·Functions 재조회 단계는 스킵**됨. GitHub Actions 녹색 status는 인증 PASS가 아님. Work에서 콘솔 로그인·Functions 1개 확인한 APP518 근거는 그대로 유지.
- **남은 정확한 차단:** Cloud Shell HTTP 403을 추가 재시도할 이유 없음. Cloud Shell 없는 원격 QA E2E를 진행하려면 **QA 전용 Google Workload Identity Federation provider + 최소 권한 QA 서비스 계정 + GitHub Actions 단기 신뢰 연결**을 공식 콘솔에서 설정해야 함. 이는 QA IAM·연결 설정 변경이므로 기존 인증 검사에 포함되어 자동 수행되었다고 주장하지 않음. 프로젝트 번호를 고정하고 운영 프로젝트/공유 데이터/실사용 권한 확장 금지. 외부 QA IAM 변경의 정확한 승인·원격 접근이 확보될 때만 설정하고 기존 workflow로 1회 재검증.
- **현재 종합 판정:** Cloudflare QA GET·정확 리소스 실확인 PASS, 임시 OFF Worker HTTP/정리 PASS 재사용; Firebase QA 공식 콘솔 로그인·1 Functions 목록 PASS 재사용; GitHub QA 단기 인증 **NOT_CONNECTED/HOLD**, APP518 실제 Firebase↔D1/R2 합성곡 E2E **NOT_TESTED/HOLD**. Cloudflare 검증/Emulator 검사를 반복하지 않음. 신규 데이터·Secrets·IAM·Functions·Worker 실서버 변경 0.

---

## CURRENT — APP518 QA Firebase 콘솔 인증·Functions 목록 확인 / Cloud Shell 접근 차단으로 실서버 E2E 미실행 (2026-11-23 KST)

- **기준:** 시작 main `806879080ede0f51892934bac5f5a4daf7cc062c`, Draft PR #528 exact `864f796da24413309567198c9de502b13cdedd50`. APP781의 QA D1/R2 연결·임시 Worker HTTP 503/404·삭제 복원 PASS 및 기존 코드/Emulator PASS 재사용. 이번 작업에서 재실행하지 않음.
- **실제 Firebase 확인:** 공식 콘솔 `https://console.firebase.google.com/project/soridraw-app/functions` 로그인 성공. QA 프로젝트 `soridraw-app`의 Functions 목록은 **1~1/1**, 기존 `publishExploreOwnerFollower542` 한 개(asia-northeast3, v2, min/max 0/1, timeout 15초). APP518 함수는 목록에 없음. Blaze 표시 확인. 이는 콘솔 로그인/목록 조회 증거이며 합성 Auth 사용자 토큰 검증, IAM 배포권한, APP518 서비스 인증 또는 E2E PASS가 아님.
- **실행 차단 실증:** Firebase 내장 Cloud Shell과 `https://shell.cloud.google.com/?project=soridraw-app` 직접 접근 모두 **Site Unavailable / Unable to access this site**. 직접 페이지 browser report는 document HTTP **403**. 봇 차단인지/권한 문제인지 원인 확정하지 않음. 자동 재시도 중단. 현재 실행환경에 gcloud/firebase CLI는 없으며, 저장소 기존 QA 인증 검증 도구는 인증된 QA Cloud Shell을 전제로 함. Firebase 플러그인은 설치 표시이나 이 세션에는 실행 도구 노출 없음. 운영 credential을 대체 사용하거나 브라우저 인증값을 추출하지 않음.
- **정확한 미완료:** 합성곡 1건 저장→삭제→재저장→장애 후 재전송 실제 Firebase↔Cloudflare **NOT_TESTED/HOLD**. 고정 후보 QA Worker default export는 inert이며 환경변수만으로 trusted proof를 대체할 수 없음. QA 전용 exact-source 함수/서비스 인증·검증된 실행 controller·APP518 D1 테이블·계정 Writer/예산 증거·무료 사용량 조건을 갖춘 뒤 실행해야 함. Blaze 현재 지출/잔여 무료량/$5 알림은 미확인; 기존 QA_BILLING_BASELINE 기록 재사용.
- **변경·정리:** 이번 세션 서버 mutation/합성곡/임시 Worker·Functions·D1/R2 자원 생성 **0**, 따라서 신규 임시 자원 정리 대상 없음. 기존 팔로우 QA Worker·Functions, 운영 `soridraw-app-866a5`, 공유 원본, PREVIEW/TEST/PRODUCTION 배포·Rules 변경 0. GitHub 변경은 이 상태 기록뿐. **CODE: 기존 PASS 재사용 / LIVE E2E: NOT_TESTED**, 실제 검증 완료로 보고하지 않음.
- **재개 지점:** Cloud Shell 접근 또는 동등한 기존 QA 전용 인증 실행 경로가 확보되면 QA 서비스 인증/비용 조건부터 이어감. 이미 PASS한 Cloudflare 기초 검사 및 콘솔 로그인 증거를 이유 없이 반복하지 않음.

---

## CURRENT — APP781 Cloudflare QA 임시 Worker 물리 배포·실 HTTP·정리 PASS / Firebase 정본 연동 HOLD (2026-11-23 KST)

- **QA 계정 D1 스키마 실조회(읽기 전용):** [Actions #45054221644](https://github.com/andrawing1212/soridraw-music/actions/runs/45054221644). 정확 QA D1 `soridraw-qa-app768-d1` 존재, 원본 APP583 Worker immutable 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 활성 100% 및 D1/R2 바인딩 없음 PASS. D1 `sqlite_master`의 정해진 테이블 이름만 1회 SQL `SELECT` 수행하여 기존 `app768_qa_synthetic_follow` 있음, APP518 outbox/index/budget 테이블 **아직 없음** 확인. API 메서드는 Cloudflare 명세상 **POST SELECT**지만 결과 `rows_written=0`; 사용자 원본 행 조회 없음.
- **APP518 실제 소스 빌드와 기존 QA D1 재사용 검증:** [Actions #45054541922](https://github.com/andrawing1212/soridraw-music/actions/runs/45054541922). PR #528 고정 후보 `864f796da24413309567198c9de502b13cdedd50`의 `app518IsolatedQaWorker518.js`를 Wrangler 4.147.0으로 실제 번들링 `--dry-run` PASS. 새 D1 생성 없이 기존 QA D1 **한 개를 서로 다른 두 논리 바인딩** `CATALOG_OUTBOX_518`/`ACCOUNT_D1_BUDGET_518`에 지정하고 기존 QA R2 `soridraw-qa-app768-r2`를 `CATALOG`에 지정한 설정으로 PASS. 이 결과만으로 APP518 D1 원장/예산 테이블·실쓰기·총계정 quota 계측을 증명하지 않음.
- **실제 독립 Cloudflare QA Worker 한시 배포/HTTP 성공:** [Actions #45054747523](https://github.com/andrawing1212/soridraw-music/actions/runs/45054747523) `completed/success`. 고유 실행 ID 이름의 APP518 QA 전용 임시 Worker 1개를 고정 QA Account에 **기능 OFF, 사용자·운영 도메인 연결 없음, cron/트리거 없음, QA D1·R2 바인딩만 구성**해 업로드. Workers.dev 실제 HTTP `POST /v1/server/catalog518` → `503 HOLD_ISOLATED_QA_NOT_AUTHORIZED`, 다른 경로 `GET` → `404` PASS. QA D1/R2 **행·객체 읽기/쓰기 0**, Firebase 요청 0, 운영 계정 접근 0.
- **QA 자원 복원 확정:** Wrangler CLI 삭제가 비필수 KV 네임스페이스 조회 권한 `10000`으로 거절됐으나 같은 작업에서 **정확 임시 이름만 허용하는 Cloudflare API DELETE fallback 성공**. 삭제 후 임시 Worker GET 404, 원본 APP583 Worker 활성 버전 100% 유지 검증 PASS. 후속 커밋 `51160ec1c7de40e05436090d2ed8011576a7c502`은 이미 PASS한 직접 API DELETE를 기본 정리 경로로 고정(불필요한 KV 권한 확대 없음). **배포한 임시 Worker 잔존 0**.
- **정리 후 실제 자원 수 재확인:** [Actions #45054875844](https://github.com/andrawing1212/soridraw-music/actions/runs/45054875844), 독립 QA Account D1 1개·R2 1개·원본 Worker 1개 각각 정확 이름 일치 GET PASS. QA 계정에 APP518 전용 영구 DB/버킷/Worker 추가 없음.
- **엄격한 완료선:** Cloudflare **QA 일시 업로드·OFF 인증 경계·복원 실증 PASS**이나 **APP518 실제 Firebase QA Firestore 합성곡 1건 저장→삭제→재저장 → 서버 서명 → D1 원장/예산 예약 → R2 CAS/ACK → 재시도**는 **NOT_TESTED/HOLD**. Firebase QA 정확한 Functions/서비스 인증, QA-only DB migrations 및 계정 Writer/무료 한도·신뢰 증거는 아직 구축·검증되지 않았음. 기존 로컬 Emulator PASS를 원격 E2E PASS로 보고 금지.
- **배포·데이터 보호:** `preview`, `TEST`, `PRODUCTION` 앱/Worker/Functions/보안규칙/공유 사용자 원본 변경 0; QA D1/R2 원본 행·객체 변경 0. 변경은 GitHub의 QA 전용 워크플로와 상태 기록, 일시 QA Worker 1개(최종 삭제 검증)만. 기존 QA 요금제 정보는 `DOCS/QA_BILLING_BASELINE.md`를 재사용하며 반복 요청하지 않음.

---

## CURRENT — APP780 기존 QA 자원 정확 식별 PASS / APP518 연결 차단점 좁힘 (2026-11-23 KST)

- **실제 QA GET-only 정확 신원 검사 PASS:** [GitHub Actions #45053523562](https://github.com/andrawing1212/soridraw-music/actions/runs/45053523562), 실행 원본 `main` `9c23c332a5ec8ade61c4ef65e75bc182bb8d53bd`. 클라우드 독립 QA Account `b60fcd62c679c64db19f0b0e0c2f3429`에 존재하는 D1 1개=`soridraw-qa-app768-d1`, R2 1개=`soridraw-qa-app768-r2`, Worker 1개=`soridraw-owner-qa-583` **이름 정확 일치**. 그 외 APP518 전용 D1/R2/Worker 없음. 토큰 유효 및 QA metadata GET PASS, 작업 중 Cloudflare mutation=0.
- **범위 구별:** D1·R2는 기존 APP768/769/774/776 합성 검증용 자원이며, 원래 Worker는 팔로우/APP583 QA 보호 대상. 기존 자원 사용 가능성의 확인은 APP518용 스키마, 임시 Worker, Firebase 연결을 증명하지 않음. 기존 팔로우 Worker 덮어쓰기 금지.
- **APP518 원본 소스 실제 요구:** Draft PR #528 SHA `864f796da24413309567198c9de502b13cdedd50`는 `CATALOG_OUTBOX_518`, `ACCOUNT_D1_BUDGET_518` **두 바인딩**, QA R2 `CATALOG`, Firebase QA 정확 단건 소스/HMAC, 별도 신뢰된 QA 활성화 증거가 있어야만 `app518IsolatedQaWorker518.js`가 켜짐. 현재 QA D1은 1개 확인됨; 두 바인딩이 동일 DB를 재사용해도 안전한지는 미입증. Firebase QA 실제 exact-source Functions/로그인 연결도 미입증. 플래그 `VERIFIED`를 임의로 채우지 않음.
- **비용 근거:** Cloudflare 디렉터 확인 요금제 Workers Free, R2 Paid/현재 가시적 R2 operations 청구액 $0.00. D1 Workers Free는 일별 하드쿼터에 도달하면 조회/쓰기가 실패하도록 Cloudflare가 제한. 그러나 R2 Standard 10GB·Class A/B 포함량 외 현재 잔여 사용량과 Firebase Blaze 실제 지출/예산 경보는 확인되지 않았으므로 *모든 비용 $0 보장* 주장은 하지 않음. 확인 기록은 `DOCS/QA_BILLING_BASELINE.md`에 유지; 동일 화면 반복 요구 금지.
- **실행 범위와 결과:** 기존 격리 QA 메타데이터 조회만 실행; PR #528 원본 안전구조/사용자 원본/기존 QA Worker/공유 PREVIEW·TEST·PRODUCTION 배포 변경 없음. **APP518 Cloudflare↔Firebase 실제 합성 1곡 save→delete→resave 서버 연동 NOT_TESTED/HOLD**. 작업 완료 또는 QA PASS로 오표기 금지. 다음 실제 실행은 별도 QA 전용 Worker의 인증된 source/두 D1 바인딩/정확 한 곡 범위 및 bounded rollback을 사전 입증한 뒤에만. 새 테스트를 위해 운영 계정·공유 데이터 접근 또는 필수 proof bypass 금지.

---

## CURRENT — APP780 QA 읽기 권한 해결 / QA 비용 기준 보존 / APP518 실서버 HOLD (2026-11-23 KST)

- **실제 토큰 등록·검증 완료:** 디렉터가 독립 QA Cloudflare 계정에 한정된 D1 Read + Workers R2 Storage Read 토큰을 새 GitHub Actions Secret `CLOUDFLARE_QA_STORAGE_READ_TOKEN`에 직접 등록. 기존 `CLOUDFLARE_QA_API_TOKEN` 수정 없음. [APP780 Actions #45050388649](https://github.com/andrawing1212/soridraw-music/actions/runs/45050388649) `qa_storage_read_token_configured=true`, QA D1 GET PASS 1건, R2 GET PASS 1건, Worker GET PASS 1건, 공유 데이터 읽기·Cloudflare 변경 0. GitHub Actions의 성공은 **목록 조회 PASS**이지 APP518 합성곡 실서버 검증 PASS가 아님.
- **확인된 재사용 후보:** 기존 QA 전용 D1 `soridraw-qa-app768-d1`, R2 `soridraw-qa-app768-r2`는 과거 APP768/769/774/776 합성 QA 전용 코드의 정확한 자원명. APP780 신규 GET은 각 1개 존재를 확인했지만 **응답의 이름을 출력하지 않아 현재 이름의 정확한 일치를 독립 재검증하지 못했음**. Worker `soridraw-owner-qa-583`는 기존 팔로우 QA 보호 대상이므로 APP518용으로 덮어쓰지 않는다. APP518 전용 이름 일치 자원 0개.
- **실제 요금제 확인 기록:** [DOCS/QA_BILLING_BASELINE.md](./QA_BILLING_BASELINE.md) 참조. 디렉터가 직접 제공한 **SORIDRAW-QA** 청구 화면 기준 Workers Free 활성, R2 Paid 활성, R2 Class A 작업 41회·Class B 9회, 각 청구 가능한 사용량 0, 화면상 $0.00. **D1/Workers 현재 잔여 사용량·전체 청구액·Firebase QA 지출/예산 알림 여부는 미확인**. 같은 정보의 스크린샷을 반복 요청하지 않는다.
- **APP518 실서버 준비 판단:** PR #528 `864f796da24413309567198c9de502b13cdedd50`의 `app518IsolatedQaWorker518.js`는 기본 OFF이며 신뢰된 독립 QA 승인 증거, 정확한 Firebase QA 정본/서명 원천, 전용 D1/R2 바인딩, 검증된 서버 연결이 갖춰져야만 활성화할 수 있다. 현재 Firebase QA Functions·연동/신뢰 증거 및 결제 무료 상한은 검증되지 않음. **APP518 물리 저장→삭제→재저장/장애 재전송은 NOT_TESTED/HOLD.** 과거 Emulator/Miniflare PASS를 실서버 PASS로 격상하지 않는다.
- **이번 범위:** PR/앱 코드/서버/Hosting/QA D1·R2 내용·Firebase/공유 사용자 데이터 변경 0, QA GET-only 1회 및 상태 기록. PRODUCTION·TEST·공유 자원 변경 없음. 무료 범위를 보장할 근거 없이 실서버 쓰기·신규 배포를 강행하지 않는다.

---

## CURRENT — APP780 QA D1/R2 권한 직접 원인 확인 / 전용 Read Secret 등록 대기 (2026-11-23 KST)

- **READ-only 토큰 실제 검증:** [Actions #45048741870](https://github.com/andrawing1212/soridraw-music/actions/runs/45048741870) 현재 GitHub `CLOUDFLARE_QA_API_TOKEN`은 사용자 소유 토큰 검증 `HTTP 200, active=true`, 기존 QA Worker 1건 조회 PASS, D1 목록 `401`·R2 버킷 목록 `403`. API 주소는 Cloudflare 문서상 정상, QA 토큰의 필요한 저장소 접근권한/대상 범위가 없다고 판단. PRODUCTION 계정 조회·변경 없음.
- **연결 준비 GitHub 코드 완료:** 기존 APP780 검사 Workflow `app780-app518-isolated-resource-readonly.yml`에 새 `CLOUDFLARE_QA_STORAGE_READ_TOKEN` 전용 Secret 참조를 추가, 기존 `CLOUDFLARE_QA_API_TOKEN`은 **Worker GET·토큰 확인에만 유지**하여 과거 QA583/APP749 배포 경로 및 권한을 보호. 저장소 조회는 정확한 QA Account `b60fcd62c679c64db19f0b0e0c2f3429`에서만 D1 Read/R2 Storage Read 토큰으로 가능. **실제 토큰 발급, Cloudflare/GitHub Secret 등록·권한 변경은 아직 미실행.**
- **연결 미설정 안전 중단 PASS:** [Actions #45048879029](https://github.com/andrawing1212/soridraw-music/actions/runs/45048879029) `qa_storage_read_token_configured=false`, D1/R2 `HOLD_QA_STORAGE_READ_TOKEN_NOT_CONFIGURED`, Worker GET PASS, QA Cloudflare mutations 0, 앱·사용자 원본 변경 0. Workflow 자체 success는 토큰 연결 또는 APP518 실서버 시험 PASS가 아님. 원격 실 QA **HOLD**.
- **디렉터에게 필요한 단일 보안 설정:** Cloudflare의 **기존 독립 QA 계정에 한정** API Token 권한 `Account/D1 Read` + `Account/Workers R2 Storage Read`만 부여하고, 토큰 문자열은 채팅/코드가 아닌 GitHub Actions 저장소 Secret `CLOUDFLARE_QA_STORAGE_READ_TOKEN`에 직접 보관. 추가 Workers Edit/배포권한/공유 PROD 계정 접근권한 부여 금지. GitHub Secrets 직접 쓰기·Cloudflare 토큰 생성 도구는 이 채팅에 없어 연결은 사용자 관리 화면 작업 필요. Secret 등록 확인 후 기존 GET-only 재검사 1회만 실행, 실제 데이터 쓰기/QA D1/R2 생성·Worker·Functions 배포는 별도 승인.

---

## CURRENT — APP780 격리 QA Cloudflare D1/R2 권한 부족 HOLD (2026-11-23 KST)

- **디렉터 승인 범위:** 기존 독립 QA 자원으로 APP518(PR #528) 합성곡 1건 저장→삭제→재저장/늦은 요청 차단 실서버 시험; 공유 사용자 원본, PREVIEW/TEST/PRODUCTION Worker, D1/R2, Functions, RTDB, Rules 변경 금지. QA 신규 유료 자원/권한 확대/Secret/배포는 별도 명시 승인.
- **기존 검사 재사용:** PR #528 정확 SHA `864f796da24413309567198c9de502b13cdedd50`의 GitHub CI 5/5 **success** [APP518 Actions #41116655418](https://github.com/andrawing1212/soridraw-music/actions/runs/41116655418), [app517 #41116655317](https://github.com/andrawing1212/soridraw-music/actions/runs/41116655317) 등. 실제 firebase-admin↔Firestore **로컬 Emulator**, HMAC HTTP, Miniflare D1/R2로 `saved→removed→resaved`, 오래된 save/delete, 중복, 장애+재시도, ACK와 소유자 차단 PASS. **실제 Cloudflare/Firebase 연동 증거로 승격 금지**. 다시 실행하지 않음.
- **실제 QA 계정 자원 확인:** [PR #1350](https://github.com/andrawing1212/soridraw-music/pull/1350) 읽기 전용 Workflow 1개만 main에 병합 `5e4d41277b5be4877da6edaf0d462cb2e0c7c3c0`, [Actions #45048303777](https://github.com/andrawing1212/soridraw-music/actions/runs/45048303777) `qa_resource_inventory completed/success` 실행. 기존 QA Cloudflare Account `b60fcd62c679c64db19f0b0e0c2f3429`은 운영 `e1a30fc9ef497fda1d34f4ab3dc1da45`와 분리, Worker 목록 GET 성공(1개·APP518 대상 0). **D1 메타데이터 GET HTTP 401 / R2 메타데이터 GET HTTP 403**, 생성 여부·권한·비용·실제 연결 **UNVERIFIED**. 기존 GitHub QA 토큰을 사용했지만 D1/R2 조회 권한이 없거나 API 접근이 허용되지 않음. `app518_live_ready=false`. Firebase QA Functions·별도 R2/D1 서비스 및 credential 분리·소유권·결제 안전성 미입증. 공유 계정 우회 조회·실서버 합성곡 전송/배포 없음.
- **변경 범위:** GitHub의 독립 QA GET-only controller 1개만 추가. 기존 PR #528 소스·QA583 활성 버전·정식/Preview/Test 앱·사용자 데이터 모두 무변경, Cloudflare 읽기 요청 3종 외 서버 변경 0. **검증 원칙 준수: CODE PASS / 실클라우드 NOT_TESTED / PRODUCTION HOLD**.
- **다음 차단점 하나:** QA D1/R2의 현재 존재·읽기/쓰기 권한과 무료/Blaze 비용 범위 및 Firebase QA 실제 Functions 범위가 확인되기 전까지 외부 실검증 보류. 권한 확대·신규 D1/R2/시크릿/Functions 설치·과금 가능 작업에는 별도 디렉터 명시 승인 필요. 공유 운영 데이터·서버로 대체 실험 불가. 첫 정식앱 배포 최우선, 새 관리자 수동 가져오기 기능 보류.

---

## CURRENT — APP780 현행 공유 Media 정본 연결 및 Hosting 실물 스냅샷 확인 / RELEASE HOLD (2026-11-23 KST)

- **APP738 실제 Firebase GET-only 현재 라이브 파일 확인 PASS:** [Actions #45045472062](https://github.com/andrawing1212/soridraw-music/actions/runs/45045472062), `run success`, PREVIEW `sites/soridraw-preview/versions/94f9a91ea84fe410` 파일 69개/파일 SHA256 `881244092d713d948882350c72b08b1921b660ddbb95134610213bc9f731b72b`, PRODUCTION 기존 복구점 `sites/soridraw/versions/aad8597799015e70` 파일 62개/SHA256 `3cd21d3a42a6a6f41cdb10392765e31e93cdc6ce68a63c3d981914b17caa6e72`. 활성 버전은 서로 다르며 정확한 ServingConfig 해시도 다름. **PRODUCTION Hosting 변경 0**. APP738 source-only 롤백 모의검사 PASS는 실제 rollback 리허설 PASS가 아님.
- **APP528 기존 Cloudflare GET-only Media 단독 재검증 PASS (변경된 라이브 버전만 재검사):** [Actions #40884862825, 재실행 시도 2](https://github.com/andrawing1212/soridraw-music/actions/runs/40884862825), 신규 Media job `137279545519 completed/success`. PREVIEW Media 활성 `705418cc-9445-45e5-920b-d3ece6ed7023`, PRODUCTION Media 활성 `a2f49bb0-a75d-428e-bff2-de78e47081a7`, 각각 100% 배포 상태. **두 Media Worker는 실제 동일한 `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`** 확인. TEST worker도 같은 저장소 설정만 GET으로 확인했으며 TEST 실행/변경 없음.
- **중요한 위험:** 두 환경의 현재 immutable Media 진입 소스는 실제 사용자 인증/AppCheck 및 /delta writer 경로를 포함하나 APP518 canonical 버전/HEAD legacy-writer 차단 펜스는 **둘 다 없음**(`LEGACY_DELTA_WRITE_PATH_IN_SOURCE_NO_518_FENCE`). 설정 일치가 올바른 정본-순서 보장 증거는 아님. 한 달 20+ 불일치 중 정확한 `기다란 꿈의 골목`은 이미 Firebase 원본 활성+공유 Catalog membership YES이므로 **무단 재저장/backfill하지 않음**. 다른 곡의 원본/목록 누락은 아직 개별 확인 안 됨. 원인 후보는 PROD 구버전 warm cache + 버전 순서 경합이며 단일 원인 확정 금지.
- **다음 차단 해결:** 기존 APP780 PREVIEW Hosting `4e874823...`/수동 Catalog GET 및 로컬 원본 보호 PASS를 재사용. 정식앱은 같은 PREVIEW 코드를 승격해야 하나 APP737 현행 Explore Worker **41 vs 12 바인딩/31 missing**, Stage416 signed path PREVIEW 활성/PROD 기능 동등성 미입증, APP518 공유 Writer 경계/복구 미검증 때문에 **PRODUCTION RELEASE HOLD**. 기존 Draft [PR #528](https://github.com/andrawing1212/soridraw-music/pull/528)는 100+ 파일/Cloudflare+Firebase+D1/보안 구조 수정 후보이며 GitHub CI나 로컬 Firebase Emulator PASS를 실제 운영 배포 PASS로 취급하지 않음. 공유 Worker·Functions·Rules·D1/R2·실사용 원본에 대한 변경은 **별도 명시 승인 필요**; 첫 배포 준비를 위해 기존 검증을 재사용하고 필요한 최소 위험 범위만 승인 받도록 함. 새로운 관리자 곡 복사 기능은 첫 출시 이후 보류.

---

## CURRENT — APP780 단건 실검증: PREVIEW만 보이는 곡은 Firebase/R2 정본 정상 / PROD 구형 캐시 경로 유력 (2026-11-23 KST)

- **실제 사용자 관리자 진단 증거:** PREVIEW의 `기다란 꿈의 골목` 정확한 곡 1건에 대해 `favorites` 서버 문서 존재=예, 로그인 계정 소유=예, 서버 활성=예, 브라우저 Music Note 행=예, 임시 표시=아니요, 미확정 저장 대기=아니요. 공유 R2 Catalog 존재=예, 해당 문서 ID 포함=예, Catalog 버전 `1794398238599`; 이 브라우저 Catalog 캐시와 포함 여부 일치=예. 서버/캐시 쓰기 없이 기존 관리자 단건 읽기 전용 기능으로 검증. 문서 ID/UID/인증정보는 기록하지 않음. **이 한 곡은 Firestore→공유 Catalog 누락이 아님.** 다른 곡까지 자동 일반화 금지.
- **원인 후보 좁힘:** Git `production`의 `src/lib/userDataEngine.ts::readCatalogSnapshotCacheFirst`는 로컬 warm Catalog가 프로필 리비전과 같으면 첫 방문에서도 Worker GET를 생략 가능; Git `preview`에는 `musicNote` 첫 로그인 세션 R2 full snapshot 확인과 APP780 명시 Sync 서버 GET 추가. 현재 정식 화면 전체 목록 부재는 확인된 것이 아니므로 PROD 구형 캐시/렌더 경로는 **유력 후보**이지 서버 실환경 원인 확정은 아님. 이 곡을 재저장/재생성/R2 backfill할 이유 없음.
- **다음 배포 차단 해소:** 정식앱은 최신 PREVIEW 검증된 코드/캐시 갱신 동작을 유지하는 방향으로 기능 동등성·Worker/Rules/바인딩 차이·롤백 검증 후 안전한 정식 Hosting 승격을 목표로 함. 사용자 공유 데이터/서버 설정 변경, 양방향 관리자 곡 복사는 승인되지 않았고 실시하지 않음. 정식 사용자 곡이 PREVIEW에서 없는 역방향 사례는 정확한 한 곡 서버 정본 검사 전까지 열린 이슈로 유지. **PRODUCTION RELEASE HOLD**.

---

## CURRENT — APP780 뮤직노트 한 달 이상 누적 불일치 / PREVIEW 기존 수동 동기화 안전 수정 Hosting PASS / 정식 RELEASE HOLD (2026-11-23 KST)

- **사용자 제공 실제 화면 (2026-11-23 KST):** 정식앱/Preview 각각의 Music Note 캡처에서 공통으로 보이는 노래는 `오랜만이야 동네 | Long Time No See, Alley`, `먼 길을 돌아온 밤` 등. 정식앱 화면에는 `어제의 골목에서`·`오래된 골목의 풍경`·`어른의 자리`, Preview 화면에는 `기다란 꿈의 골목`·`아이야와 요정들의 반짝이는 비밀`·`어른이 된 나에게 묻는다` 등이 보임. **화면은 목록 일부**이므로 각 곡의 다른 앱 전체 부재/서버 정본 부재 증거는 아님. 디렉터는 실제 한 달간 양방향 누락 20곡 이상, 최근 일부만 동기화됐다고 보고. 곡 삭제·재저장·캐시 초기화·대량 스캔·동일 제목 기반 자동 복구 금지.
- **코드에서 발견한 직접 원인:** `src/App.tsx::refreshFavoritesFromServerFirstPage`는 사용자 수동 Sync 버튼에도 `localVersion >= remoteVersion`이면 GET 생략; 이어 `readListBundleFromServerOnce`는 `readCatalogSnapshotCacheFirst`를 거쳐 실제 공유 서버 확인 없이 로컬 캐시 반환 가능. 전체 서버 목록 수신시 `mergeFavoriteFirstPageWithCache(...,!bundle.hasMore)`에 전달할 로컬 보존 목록을 나이로만 걸러 역사적으로 오래된 local-only favorite가 화면에서 사라질 위험. 이미 PREVIEW 일반 Catalog 구독 경로에는 absent local-only 잠정 보존이 적용돼 있으나 **수동 버튼에는 보호 누락**. 정식앱은 더 오래된 전체 목록 병합 및 warm-cache 코드이며 안전성 차이 존재.
- **APP780 최소 수정·검증:** [PR #1348](https://github.com/andrawing1212/soridraw-music/pull/1348) 병합 `a82dc079c01e65ab3b7031296627a4c6e5362bea`: 기존 수동 버튼 **명시 클릭에서만** Firebase Auth가 검증된 공유 R2 Catalog를 새 GET로 읽음(동시 요청 합류, 구형 bootstrap POST·서버 재빌드·쓰기는 금지); 원격 시차·오류면 HOLD, 미반영 local-only는 잠정 보존·R2 재게시 금지, tombstone/optimistic/recent confirmed 보호, 원격보다 새로운 로컬 수정 순서 보호. 페이지 방문 R/W 추가 0. APP780 [Actions #45043590131](https://github.com/andrawing1212/soridraw-music/actions/runs/45043590131), APP519 #45043590145, APP521 #45043590203, APP517 #45043590194 **SUCCESS**. 초기 검사 스크립트 TS VM 구문 오류는 같은 PR에서 수정 후 재검사 PASS.
- **PREVIEW Hosting 배포 최종 PASS:** [PR #1349](https://github.com/andrawing1212/soridraw-music/pull/1349) 병합 `4e8748236d59444ce4a23d5611e22323c4ea221d`, [Actions #45043866875](https://github.com/andrawing1212/soridraw-music/actions/runs/45043866875) `completed/success`; `APP515_MAIN_PREVIEW_V2_GUARD`, `FIREBASE_PREVIEW_DEPLOY`, `PREVIEW_EXACT_BUILD`, `TEST_PRODUCTION_UNCHANGED` 모두 PASS. **공유 Worker·Functions·RTDB Rules·D1/R2·실제 사용자 원본 변경 0**, TEST/PRODUCTION 변경 0.
- **아직 남은 실제 릴리스 차단:** 기존 공유 R2에 없는 Firestore 정본 곡을 자동 backfill하지 않음. 앱 UI에서 관리자 `CACHE LIVE → 뮤직노트 특정곡 원본 확인` (이미 PREVIEW에 존재, APP502/517)은 UID·정확한 문서 ID를 기준으로 한 건의 `favorites` 활성 여부 및 공유 R2 membership을 **각 버튼 클릭 시에만** 읽기 전용으로 확인 가능. 이 실제 Owner 인증 단건 결과 및 PREVIEW PC/모바일 최종 리스트 수렴은 **NOT_TESTED**. [Draft PR #528](https://github.com/andrawing1212/soridraw-music/pull/528)의 서버 정렬/구형 Writer 차단·outbox 도입은 구조/비용/보안 위험 검증·별도 승인 없이는 PROD/PREVIEW 배포 금지. APP737 현행 Worker 31개 차이/기능 동등성/Hosting 완전 동일성 및 롤백도 별도 RELEASE HOLD. **이번 수정은 기존 Sync 버튼 오류 수정이지 20곡 완전 복구 완료가 아님.**

---

## CURRENT — APP780 정식 첫 배포 읽기 전용 실서버 점검 PASS·릴리스 HOLD (2026-11-23 KST)

- **APP780 승인 범위:** 첫 정식 배포에 직접 영향을 주는 차이만 해결, 새 관리자 수동 곡 가져오기 및 기존 미검증 자동복구 활성화 보류. PREVIEW 코드는 `4363820117100cb03bcbc44a01e127aeb5de3cf4`, main 코드 기준은 `bff6fbf0559b0b75b83790c82a870ad4f9032b5b`, 정식 Git `production fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`; Git 브랜치와 실제 활성 배포물은 구분.
- **APP737 활성환경 GET-only 재점검 PASS:** 기존 승인된 [Actions #45041708849](https://github.com/andrawing1212/soridraw-music/actions/runs/45041708849) `readiness completed/success`, `APP737_PARITY_INVENTORY=PASS_READ_ONLY; DIRECT_PRODUCTION_RELEASE=HOLD`. Preview 소스/활성 `app-version.json=507` 일치, 활성 Hosting PREVIEW `sites/soridraw-preview/versions/98e2c608d670e28d`, PROD 롤백 버전 `sites/soridraw/versions/aad8597799015e70`. 활성 Explore Worker PREVIEW `cfd40718-6ab5-4133-bdb2-fa69332d6810` (41 bindings), PROD `af81502a-298d-4ec6-bc2a-0c529d6dc29e` (12 bindings); 차이 PREVIEW 31개(사용자 기능 관련 25·비용/환경 6), PROD 레거시 2개 보존. 양쪽 공용 `DB` 및 `PROFILE_MEDIA` 바인딩은 sameTarget=true. Media Worker 활성 버전 PREVIEW `705418cc-9445-45e5-920b-d3ece6ed7023`/PROD `a2f49bb0-a75d-428e-bff2-de78e47081a7`, 각각 bindingCount=10. 실제 Media 각 바인딩 대상값과 활성 기능 동등성은 이번 APP737 출력만으로 확정 불가; PROD 배포/서버 쓰기 0.
- **뮤직노트 격차 분석:** 두 앱의 `src/firebase.js`는 동일 운영 Firebase 프로젝트 `soridraw-app-866a5` 설정. 양쪽 `src/lib/userDataEngine.ts`는 HOST에 따라 서로 다른 Media Worker 주소를 선택, PREVIEW는 최초 Music Note 진입에서 R2 전체 snapshot 검증을 추가하나 정식 소스는 오래된 warm-cache 경로. 서로 다른 주소 자체가 다른 물리적 원본을 뜻하지는 않음: 기존 [APP528 live GET-only #40884862825](https://github.com/andrawing1212/soridraw-music/actions/runs/40884862825) 2026-10-29 시점에는 PREVIEW/TEST/PROD 모두 `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`; **오늘 활성 Media 버전까지 동일하게 유지됐다는 증거는 별도 필요**. 기존 Draft [PR #528](https://github.com/andrawing1212/soridraw-music/pull/528)에는 특정 곡 `favorites` 정본 active/owner=true인데 공유 Catalog exact membership=false였던 실제 사례가 있으며 서버 정렬/재전송/구형 Writer 호환 미완성·배포 금지. 현재 사용자가 본 두 앱 목록 불일치는 새 로그/정확한 곡 ID 없이 원인 확정하지 않음. 캐시 강제 삭제, full scan/일괄 업서트, 곡 재생성·수동 덮어쓰기 금지.
- **다음 최소 차단 해결 순서:** (1) PREVIEW/PROD 현행 Media `CATALOG` 바인딩과 플래그·실제 경로 비교(읽기 전용/기존 증거 재사용), (2) 정본 활성곡과 공유 Catalog에 빠진 정확한 곡 1건을 owner 인증하에 확인하여 브라우저 캐시 문제와 server materialization 문제를 구분, (3) 발견된 직접 원인만 기존 PR #528 미완성 정본→Catalog 순서·재전송 호환 요구에 맞게 source-only 수정 및 격리 QA, (4) 공유 backend 변경이 필요하면 영향·비용·복구 증거와 디렉터 **별도 승인** 후 적용, (5) APP737/738 파일 일치·PC/모바일·롤백까지 검증 후 PRODUCTION 최종 승인 요청. 이미 통과한 APP749/778/779 QA·Hosting 검사는 영향 없으면 반복하지 않음. **첫 정식 배포 RELEASE HOLD**, TEST/PRODUCTION/공유 사용자 원본 변경 0.

---

## CURRENT — 디렉터 확정: APP780 정식앱 첫 배포 최우선 / 신규 기능 동결 (2026-11-23 KST)

- **제품 방향 최우선:** 승인된 APP780의 목표를 `soridraw.com` 첫 안전 배포에 집중. 추가 기능 요청마다 새 개발 작업으로 방향을 전환하지 않음. 새 기능·반복 격리 QA는 출시를 실제로 막는 직접 원인이 아니라면 후순위로 보류. 검증된 PREVIEW 앱의 기능을 정식앱에서 그대로 제공하고, 기능 동등성/현재 활성 서버 연결/복구 가능성/원본 데이터 보존을 갖춰 RELEASE HOLD를 해소하는 작업부터 계속 진행. 기존 승인 작업은 재승인 요구하지 않음.
- **현재 발견된 필수 차단 항목:** 정식앱↔PREVIEW 뮤직노트 곡 목록·저장 상태 불일치 현상. 두 브랜치의 Firebase 프로젝트는 동일 `soridraw-app-866a5`이나, `userDomainSyncService.ts`·`userDataEngine.ts`·`FavoritesPage.tsx`의 버전/캐시/신호 처리 코드는 차이가 있음. 버전 차이는 **원인 후보**일 뿐, 실제 서버 정본/로컬 pending 상태를 읽기 전용으로 확인하기 전 원인 확정·원본 덮어쓰기·캐시 강제 초기화 금지. 동일 계정의 기존 곡/편집/하트/폴더·PC↔모바일 보존이 정식 배포 필수 합격 조건.
- **첫 배포 이후 보류:** 관리자 전용 양방향 곡 비교·수동 가져오기 기능은 새 독립 기능이므로 첫 배포 이후 설계/승인 후 개발. 현재 배포 차단 오류와 혼합하거나 기능 출시의 선행 조건으로 추가하지 않음. 팔로우 고급 자동복구도 이미 OFF인 검증 전 경로를 새로 활성화해 첫 배포를 지연하지 않음. 단, PREVIEW의 실제 정상 사용자 기능을 이유 없이 OFF로 내리거나 정식앱 기능 동등성 요구를 우회하지 않음.
- **정식 배포 전제:** 기존 APP737/738 배포 계약에 따른 실서버 차이 해결, 기존 검증 재사용, PREVIEW 실제 활성 Hosting 버전의 정확한 파일 동일성 및 롤백 검증, 디렉터 최종 배포 승인. 공유 Worker/Functions/Rules/D1/R2·원본 데이터 변경은 일반 코드 승인에 포함되지 않음. 아직 **PRODUCTION 배포 미승인·미실행 / RELEASE HOLD**. NEXT: 배포 차단 항목을 작은 묶음으로 원인 확정 후 최소 수정·필수 검증·PREVIEW 배포까지 한 흐름으로 처리.

---

## CURRENT — APP779 QA signed legacy/ordered 요청 읽기 전용 HOLD 실검증·QA583 원본 복원 PASS / 출시 HOLD (2026-11-23 KST 확인)

- **디렉터 제공 실제 브라우저 증거:** 기존 격리 QA A/B 로그인 및 서명된 `status` 검사 PASS, QA RTDB 팔로워 **0명 / 수신 버전 16** 유지. 사용자가 기존 QA 페이지에서 1회 실행한 APP779 콘솔 검사 출력 **`APP779 PASS · 구형 PUT 409 / 신형 DELETE 409 / 실제 저장 없이 안전 차단`** 확인 (2026-11-22 23:55 KST 사용자 캡처). 구형·신형 요청이 같은 APP775 검사기를 거친 결과 **409 HOLD**임을 확인하는 범위의 PASS. 기존 화면의 `작업 실패 / HOLD`는 콘솔 가로채기 이후 원래 QA749 버튼 흐름에서 발생한 문구이며 실제 follow commit PASS도, APP779 신규 Writer 활성화도 아니다. 추가 버튼/스크린샷 요구 없음.
- **GitHub 코드·검사:** [PR #1345](https://github.com/andrawing1212/soridraw-music/pull/1345) 병합 `c1f2b4425dde40de82831656d0cb047a4930ecb8`. APP779 로컬 24개 검증, APP749+APP732 고정 QA 오프라인 호환 PASS [Actions #45033184409](https://github.com/andrawing1212/soridraw-music/actions/runs/45033184409), [#45033184292](https://github.com/andrawing1212/soridraw-music/actions/runs/45033184292). [PR #1346](https://github.com/andrawing1212/soridraw-music/pull/1346) 12→30분/잡 timeout 18→42분 변경 후 PASS·병합 `a0713c0886b197e64d765bdf681427b183dd7801`.
- **QA 검증 창 조기 종료 기능 코드 병합:** [PR #1347](https://github.com/andrawing1212/soridraw-music/pull/1347) `main 3bc74ba24744a037ced1f5bcbe797e247cb28d8e` 병합 완료. 실제 QA 성공 확인 후 해당 실행 ID와 main SHA가 정확한 GitHub 저장소 소유자 완료 댓글을 15초 간격으로 확인하여 최대 30분 전이라도 기존 `always()` APP583 원본 복원 단계로 진행. 오프라인 15개 안전 검사와 고정 QA Wrangler dry-run PASS [Actions #45036924340](https://github.com/andrawing1212/soridraw-music/actions/runs/45036924340). **새 QA 실행·실제 조기 종료 통합 실검증은 수행하지 않음**. 기존 30분 실행에는 소급 적용되지 않았고 그 실행의 원본 복원은 아래 단계에서 별도로 최종 PASS 확인.
- **30분 한시 QA 원본 복원·실검사 완료 PASS:** [Actions #45035093218](https://github.com/andrawing1212/soridraw-music/actions/runs/45035093218) `qa_live_bounded` **completed/success**. 기존 QA 후보 활성화·5개 격리 바인딩·미인증 요청 403 및 기존 APP583 경로 호환 PASS에 이어 `Always restore historical APP583 exact 100 percent` **success**, `Verify original version, bindings and real HTTP after restore` **success** 확인. 원본 immutable QA583 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 복원과 기존 바인딩/실제 HTTP 재확인까지 정상 종료. 앞선 30분 실행의 복원 기록이며, PR #1347에 새로 추가한 **조기 종료 기능의 실제 동작 시험은 별도로 하지 않음**.
- **출시 차단 유지:** APP779은 QA 요청을 409로 차단하는 읽기 전용 검사, 실사용 canonical follow Writer 연결 0, 신규 D1/R2/DO 저장 0. 모든 구형/활성 Writer 강제 전환, 독립 epoch/ledger/pending fence/PITR, D1 W1–W2, PC↔모바일 사용자 실사용 및 자동 복구는 **NOT_TESTED/HOLD**. 운영·PREVIEW·TEST·PRODUCTION 배포/공유 원본 수정 0.

---

## CURRENT — APP778 실제 QA Auth status → APP775 공통 진입 읽기 전용 shadow 연결, 브라우저 실검증·원본 복원 PASS / 출시 HOLD (2026-11-22 KST)

- **디렉터 YES 범위:** 이미 실증된 APP749 QA 실제 Firebase Auth/App Check 서명 검증을 재사용해, **서명된 GET `/qa730/verified/status`** 뒤에서만 APP775 공통 진입 판정 두 고정 QA 입력(구형 빈/신형 ordered)을 읽기 전용으로 실행. [PR #1344](https://github.com/andrawing1212/soridraw-music/pull/1344) `main 4fc6dcfb573c18b5d9e37f21b39b39104c51108d` 병합. QA `/qa730/verified/follow` 실제 팔로우/취소 경로·원래 DO/RTDB 처리·Hosting/UI는 변경 0. 새 D1/R2/DO 읽기·쓰기, 자원·권한/Secret/보안 규칙·PREVIEW/TEST/PRODUCTION 배포 0.
- **설계·검사 PASS:** `cloudflare/explore-worker/experiments/owner-follow-qa-shadow-778.mjs`를 QA749 서명 인증 status 성공 뒤 호출하도록 기존 QA 후보 entry의 status 경로에만 연결. 새 `scripts/verify-778-signed-status-shadow.mjs` **17개 오프라인 케이스 PASS**, Auth/owner scope, 잘못된 환경·공유 DB 바인딩 차단, 거짓 PASS·실서버 쓰기 플래그·미검증 actor epoch/cutover/pending fence 차단. 두 샘플 입력 모두 `SERVER_AUTH_OR_GENERATION_UNPROVEN`로 HOLD, APP775 실제 런타임 Writer/DO 호출 허가 0. APP749 호환 Node22/QA583 pinned Wrangler dry-run PASS [Actions #45030805623](https://github.com/andrawing1212/soridraw-music/actions/runs/45030805623), APP732 QA 소스 호환 PASS [Actions #45030805639](https://github.com/andrawing1212/soridraw-music/actions/runs/45030805639). 신규 독립 Workflow/임시 브랜치 반복 생성 없음.
- **실제 인증 브라우저 상태 검증 PASS (디렉터 캡처):** 기존 한시적 QA 실행 [Actions #45031004010](https://github.com/andrawing1212/soridraw-music/actions/runs/45031004010) 중 기존 QA 페이지 `https://soridraw-qa-owner-584.web.app/qa749.html`에서 기존 A/B 계정 로그인 및 `두 계정 인증·기존 상태 확인` 1회 수행. 2026-11-22 23:17:45 KST의 사용자 제공 로그는 `실제 A·B Firebase 서명 검증 + RTDB 0명 기준 일치 PASS` 및 A 실시간 수신 `followerCount=0 / version=16`을 표시. 이번 APP778 후보는 서명된 status GET 뒤 APP775 실제 판정 두 개를 읽기 전용 호출하며, 둘 중 HOLD가 아닌 결과면 503으로 실패하는 구조이므로, 이 status PASS는 인증된 해당 경로의 **fail-closed shadow 정상 판정을 간접 확인**한 증거다. 두 입력은 서버 내부 합성 구형·신형 envelope이며 실제 Writer 커밋 증거가 아니다. 팔로우·취소 추가 요청 0, APP778 신규 서버 D1/R2/DO 조회·쓰기 0, PC↔모바일 별도 기기 검증 없음.
- **원본 QA583 복원·검증 최종 PASS:** 같은 [Actions #45031004010](https://github.com/andrawing1212/soridraw-music/actions/runs/45031004010)의 `qa_live_bounded` 최종 `completed/success`. `Always restore historical APP583 exact 100 percent` 및 `Verify original version, bindings and real HTTP after restore` 두 단계 모두 `success` 확인. 원본 immutable APP583 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 복원과 원래 4개 QA 바인딩/실제 HTTP 검증은 기존의 안전한 자동 복원 단계 PASS 근거를 재사용하여 인정. 이번 실행 완료와 앞선 APP749 [#45028803382](https://github.com/andrawing1212/soridraw-music/actions/runs/45028803382) 이전 PASS는 별도 기록. APP778 코드 오프라인 PASS와 실제 브라우저 PASS, 원본 복원 PASS를 구분하며 PREVIEW/TEST/PRODUCTION 및 공유 원본 사용자 데이터 변경 없음.
- **출시 차단:** Auth 서명 PASS만으로 정본 actor/owner epoch, all active/legacy Writer cutover, 독립 ledger/pending fence/DO PITR, 운영 canonical D1 W1–W2, PC↔모바일, 장애 자동복구가 입증되지는 않음. APP775/777/778 source-only 설계 및 모든 실제 자동복구 활성화 **OFF/HOLD**. 자세한 경계는 `DOCS/APP778_QA_SIGNED_SHADOW.md`.

---

## CURRENT — APP749 실제 QA Firebase Auth/App Check 팔로우·취소 PASS + QA583 원본 자동 복원 PASS / APP777 공통 진입 실제 연결 HOLD (2026-11-22 KST)

- **실제 사용자 화면 검증:** 디렉터가 기존 독립 QA 페이지 `https://soridraw-qa-owner-584.web.app/qa749.html`에서 기존 QA 합성 계정 A·B로 로그인한 화면을 제공. QA Firebase 프로젝트 `soridraw-app`의 브라우저 로그인 A/B 각각 성공. 활성화된 APP749 signed QA Worker의 `/qa730/verified/status`가 Firebase Auth ID Token + App Check JWT를 검증한 뒤, 기존 합성 DO/RTDB 초기 상태 A 수신 `followerCount=0 / version=14` 기준 일치 **PASS**. 이후 허용된 **팔로우 1회**에서 A 실시간 수신 `1명/version=15`, 서버 최종 반영 PASS. **팔로우 취소 1회**에서 A 실시간 수신 `0명/version=16`, 최종 0명/서버 상태 일치 PASS. QA 페이지 자체가 각 요청 1회만 허용하고 재전송 0, 로그에 “더 이상 요청 없음” 확인. 별도 모바일 기기 연결은 **미검증**.
- **QA 인프라 격리·자동 복원 최종 PASS:** 기존 자동 검증 [Actions #45028803382](https://github.com/andrawing1212/soridraw-music/actions/runs/45028803382) 최종 **SUCCESS**. 이전 [PR #1254](https://github.com/andrawing1212/soridraw-music/pull/1254)의 승인된 `/app749-qa-browser 13c0d33280b4bd95cc1790f95e1238a796c09fef`를 1회 실행: 최초 활성 QA583 원본/4개 격리 바인딩 확인, 비활성 서명 인증 후보 별도 업로드 후 QA 단독 100% 일시 활성화, 403/불량 토큰·원래 legacy 경로 검증 PASS, 약 12분 브라우저 검증 창. 종료 후 **`Always restore historical APP583 exact 100 percent` PASS, `Verify original version, bindings and real HTTP after restore` PASS**. 원본 immutable Worker 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100%/바인딩/실제 HTTP 검증 완료. 재활성화·복원 작업을 추가로 실행할 필요 없음. 공유 D1/R2/Firestore/RTDB, TEST/PRODUCTION/PREVIEW 서비스 및 사용자 원본 변경 없음. QA 합성 RTDB 값은 정상 팔로우 0명으로 복원하되 수신 버전은 16으로 증가했음.
- **정확한 PASS 경계:** 여기서 실증된 경로는 **APP749 기존 QA 서명 Auth/App Check → 합성 QA DO/Functions/RTDB → QA 브라우저 A 수신**이다. APP777의 별도 source-only `scripts/app777-qa-signed-ingress.mjs` → APP775 공통 진입 검사는 **실제 Worker에 연결되지 않았음**. 따라서 “APP777 모든 구형 Writer 실전송 PASS”, DO 전체 PITR 독립 floor·immutable operation ledger, 사용자 삭제·재가입/미등록 owner 호환, 실제 canonical D1 W1~W2, PC↔모바일 실기기 및 장애 자동 복구는 **NOT_TESTED/HOLD**. 기존 Cloud Shell `~/.soridraw-qa-749-auth.json` 누락; 브라우저 인증 PASS로 그 로컬 파일이 복원되지는 않았고 APP777 Cloud Shell runner는 미실행/HOLD. 비밀번호/토큰·비밀 UID 출력/저장/전송 없음. 운영 복구 기능은 계속 기본 OFF.
- **다음 최소 작업 판단:** 이미 실제 인증 성공한 APP749 경계를 재사용하여, APP775 공통 진입 판정을 실제 QA signed request의 읽기 전용 sidecar로 연결하는 **격리 QA 소스 및 검사**가 합리적인 다음 단계. 다만 owner epoch·완전한 구형/활성 Writer cutover·pending fence는 확정된 증거가 없으므로 모든 쓰기·자동 복구는 계속 HOLD. 새 공유 자원/보안 규칙/PRODUCTION 배포는 현재 승인에 포함되지 않음.

---

## CURRENT — APP777 격리 QA Firebase signed gate + 공통 진입 코드 검사 PASS / 실제 발급 토큰 검증 대기 (2026-11-22 KST)

- **디렉터 YES 범위:** 기존 격리 Firebase QA `soridraw-app`(Project Number `1083981050742`)의 이미 존재하는 두 합성 계정과 App Check를 사용한 실제 서명 인증 연동. 운영 Firebase `soridraw-app-866a5` 및 공유 사용자 데이터 접근/변경 금지. 현재 GitHub를 통해 확인한 QA 토큰 저장 위치는 이전 Cloud Shell의 private 파일 `~/.soridraw-qa-749-auth.json`; 해당 세션/비밀 토큰을 이 채팅에서 읽거나 실행하는 접근은 확인되지 않음. **실제 Firebase 발급 JWT 시험 = NOT_TESTED/HOLD**.
- **QA 소스 구현:** [PR #1343](https://github.com/andrawing1212/soridraw-music/pull/1343). 기존 APP749 공개 JWKS 기반 RSA256 Firebase Auth+App Check 검증기를 `scripts/app777-qa-signed-ingress.mjs`에서 재사용해 APP775 구형/신형 공통 진입 조건까지 통과시키는 **읽기 전용 QA gate** 구현. APP775의 `APP777_ISOLATED_QA_SIGNED_READ_ONLY`에서만 QA Firebase 프로젝트를 허용하고 기존 runtime OFF, 모든 실제 Worker/DO/D1/R2/relay/재전송/배포 권한 0 유지. 기존 프로덕션 프로젝트 요구 scope와 정상 기능 그대로 보호.
- **Node 22 QA 검사:** [Actions #45019830008](https://github.com/andrawing1212/soridraw-music/actions/runs/45019830008) **SUCCESS**, APP775 기존 46개 영향 검사 및 APP777 신규 **15개** 오프라인 RSA256+AppCheck 확인 PASS, 운영 issuer/audience 또는 다른 actor/변조·만료 token, 불완전 cutover/독립 fence는 모두 HOLD. 공개키 fetch는 네트워크가 아닌 mock만 이용했고 **실제 Firebase 토큰 0, 실제 서버 호출 0**.
- **실행 가능한 읽기 전용 후속:** `scripts/app777-qa-real-cloudshell-readonly.mjs --read-only`는 기존 QA Cloud Shell의 0600 비공개 파일을 로컬에서만 읽고, Google Cloud QA 프로젝트 ID·Number 확인, APP747의 공식 Firebase Admin 서명/토큰 취소 검사와 APP777 공통 진입점 검증을 수행하도록 준비됨. 실제 실행 기록은 아직 없으므로 PASS로 보고하지 않음. 비밀 토큰/UID를 GitHub/채팅/Actions에 저장하거나 출력하지 않음. 사용자의 기존 Cloud Shell 세션 접근 또는 별도 인증된 실행 환경 없이는 완료 불가.
- **한계/출시 차단:** 실제 signed QA 토큰 및 APP776 QA HTTP Worker+Auth 통합, auth epoch revocation과 서버 신뢰 경계, 모든 legacy/active Writer 비우회 cutover, 운영 정본 D1 W1~W2·독립 operation ledger/DO PITR·PC↔모바일 실사용은 **NOT_TESTED/FAIL-HOLD**. QA Worker 원본 활성 버전 변경/Cloudflare 배포/DB·RTDB·Firestore write/PREVIEW·TEST·PRODUCTION 배포 0. APP765/767/770/772/775/776/777 기본 OFF, APP737/738 PRODUCTION 릴리스 HOLD.

---

## CURRENT — APP776 격리 QA HTTP 구형·신형 팔로우/취소 실제 통합 PASS, 운영 모든 Writer·Firebase Auth 연동 HOLD (2026-11-22 KST)

- **승인 범위와 저장:** 디렉터 YES로 APP775의 공통 진입 판정 코드를 재사용하는 임시 격리 QA 전용 HTTP Worker를 기존 Cloudflare QA 계정에 1개 만들고 실제 QA D1 `soridraw-qa-app768-d1`·QA R2 `soridraw-qa-app768-r2`만 바인딩. [PR #1342](https://github.com/andrawing1212/soridraw-music/pull/1342) 병합 `a93e01c32120463003f20d2fd885039539bd0fce`. API 권한·QA DB/버킷 추가 생성, 실제 사용자/공유 자원/PRODUCTION/TEST/PREVIEW Worker·Firebase/Hosting 배포·변경 **0**.
- **실제 실행 PASS:** [Actions #45017675502](https://github.com/andrawing1212/soridraw-music/actions/runs/45017675502) **SUCCESS**, 동일 QA 임시 HTTP `/v1/profiles/qa776OwnerSynthetic/follow`로 **구형 PUT 2건 병렬 → 실제 합성 D1 W1 1건만**, 신형 `followOperationId`·revision JSON을 이용한 **DELETE 2건 병렬 → 실제 합성 D1 W1 1건만**, 각각 동시 중복 요청에서 추가 정본 변경 0. 실제 QA R2 `onlyIf:{etagDoesNotMatch:'*'}` 조건부 PUT로 동일 operation ID 접수 1회만 반영, `following 0→1→0` 값 확인. 과거 구형 PUT 재전송 시 이전 R2 admission 객체 존재로 **409 차단**, 접근 키 누락 403 및 잘못된 owner 경로 404 확인. PR Node22 오프라인 mock D1/R2 HTTP 테스트 PASS [Actions #45017614436](https://github.com/andrawing1212/soridraw-music/actions/runs/45017614436). APP768/769/774 이전 물리 PASS는 재실행하지 않음.
- **격리·정리 PASS:** 동일 실행의 `always()`에서 정확한 QA R2 접수 객체 2개 + `qa776_<random>` D1 합성 행 1개만 삭제, 부재 확인, **임시 APP776 Worker 삭제** PASS. 기존 QA Worker `soridraw-owner-qa-583` 원본 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 및 기존 QA D1/R2 각 1개 인벤토리 시작·종료 유지 PASS. QA 비용 별도 청구 실측은 미확인.
- **입증 범위의 한계:** 실제 R2/D1을 통한 HTTP 경로였지만 **Firebase 서명 Auth/AppCheck·owner epoch·cutover/pending fence는 테스트가 입력한 합성 증거**다. 임시 테스트의 revision 1/2는 고정 fixture이며 장기 owner floor/DO PITR 이력이 아니다. 실제 APP557 기존 구형·미등록 owner canonical 우회 경로는 그대로 존재한다. 원래 활성 Worker·구형 앱 전체가 새 접수 경계를 통과한다는 증거, 실제 서비스 팔로우 D1 `rows_written<=2`, 완전한 operation ledger/삭제 보존 정책, PC↔모바일 사용자 실사용 및 안전한 장애 자동 복구는 **NOT_TESTED / FAIL-HOLD**. 앱 배포나 복구 기능 활성화 없음.
- **재실행 방지:** 기존 재사용 workflow `.github/workflows/app768-qa-r2-conditional-race.yml`의 APP776 실제 QA `push` 트리거 제거, `live` 명시적 `if:false`. 오프라인 PR 검사는 보존. 임시 QA Worker/합성 데이터 재생성 자동 실행 0. APP765/767/770/772/775/776 실제 운영 복구 기본 OFF, APP737/738 PRODUCTION 릴리스 HOLD.
- **다음 출시 안전 차단점:** 실제 서명된 actor Auth/owner enrollment 확인, 모든 활성·구형 Writer의 비우회 cutover와 구형 미등록 사용자 정상동작 보전, DO 전체 PITR 외부 immutable operation ledger/pending fence/revision floor, 실제 canonical W1~W2 및 R2 장기 요금/보존 삭제 검증. 위 항목은 새로운 독립 구현·고위험 공유 백엔드 변경 시 별도 승인 필요.

---

## CURRENT — APP775 구형·신형 팔로우 공통 진입 OFF-only 계약 46개 오프라인 QA PASS, 실제 모든 Writer 통합 HOLD (2026-11-22 KST)

- **디렉터 YES 승인 범위:** APP774 다음 승인 작업으로 구형 empty envelope와 신형 ordered envelope를 공통 서버 검증 조건으로 분류하는 source-only 코드·오프라인 QA. 실제 PREVIEW·TEST·PRODUCTION Worker·Firebase/RTDB/D1/R2/Hosting, 사용자 원본·공유 자원·보안 규칙·권한/토큰 **변경 0**. 기존 APP768/769/774 물리 QA PASS는 재실행하지 않음.
- **최소 변경:** `scripts/app775-unified-follow-ingress.mjs` 추가, `APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN=false`. 기존 APP557/579/713, APP767/770/772 및 실제 canonical follow 경로에 import/접속 0. 구형(empty JSON) 요청 ID는 APP579와 동일한 서버 `SHA-256([cutover, actor, owner, revision, desired])`로 재생성하고, 신형 ID/revision은 서버 독립 확인 값과 비교. 양쪽 모두 Firebase Auth+AppCheck 서명된 actor epoch, owner enrollment, 모든 신·구 Writer와 서버 DO PITR를 포함한 cutover, 정확한 관계 revision, DO 외부 pending fence를 요구. 하나라도 증거 미확정이면 HOLD; 모두 모의 검증 통과하더라도 `OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY`라는 **쓰기 없는 후보**만 반환, 실서버 D1/R2/DO/relay·재전송·배포 허용 플래그 전부 false. OFF일 때 원래 canonical 팔로우 동작 보존.
- **실제 오프라인 검사:** [Actions #45016545226](https://github.com/andrawing1212/soridraw-music/actions/runs/45016545226) PR SHA `04ae02db7983689ea7364e8993bf2e759493746d`에서 Node22 **46개 상태 PASS**, `REAL_CLOUDFLARE_CALLS=0`. 구형/신형 동일 서버 ID, 구형 DELETE/언팔로우, 동시 legacy 같은 ID, 잘못된 클라이언트/불일치, 모든 신·구 Writer coverage, Auth 세대, pending fence, DO PITR FAIL-CLOSED 확인. 기존 `.github/workflows/app774-isolated-legacy-cas.yml` PR **오프라인 검사만 확장**; live QA `if:false` 및 push 트리거 없음. 신규 QA Workflow/비밀값 없음.
- **실제 미완료:** 검사는 신뢰할 수 있는 서버 내부 증거의 **모양 판정**이지 출처·진위를 실제 서버에서 검증한 것이 아니다. PREVIEW APP557의 구형·미등록 owner가 기존 canonical Writer로 돌아가는 동작은 정상 보존되며, **모든 구형/활성 Writer 강제 접수 = FAIL/HOLD**. 완전한 canonical operation ledger/owner revision floor 및 미확정 pair fence의 실제 구현·구형 회원 호환, 운영 canonical D1 W1~W2 물리 확인, 비용·삭제/재가입 정책, PC↔모바일 팔로우 실사용 **NOT_TESTED**. 자동 복구/PRODUCTION 승격 **HOLD**, 앱 배포 없음. 상세 `DOCS/APP775_UNIFIED_FOLLOW_INGRESS_OFFLINE.md`.

---

## CURRENT — APP774 구형 팔로우 우회 실코드 검증 및 격리 QA D1 조건부 경합 완료, 전 Writer 강제 접수 FAIL/HOLD (2026-11-22 KST)

- **디렉터 YES 범위:** 이미 승인된 APP774 격리 QA로만 신규 합성 테스트 실시. [PR #1340](https://github.com/andrawing1212/soridraw-music/pull/1340) 병합 `5a1b5d8811d17f403919e324a0ec27d7cacc3375`. PREVIEW pinned SOURCE SHA `4363820117100cb03bcbc44a01e127aeb5de3cf4`, APP557 원본 precommit 함수를 직접 오프라인 호출; 구형 무버전·일부 입력·미등록 owner의 기존 canonical Writer 우회 가능성 **실제 코드 경로 재현**. 동일 구형 요청 2회 병렬 호출 시 격리 모의 canonical callback 2회, 새 DO reserve 0. **전 구형 Writer 강제 신규 접수 = FAIL/HOLD**. 원래 사용자의 정상 follow legacy 경로를 이 작업에서 강제로 변경하지 않음.
- **실제 물리 QA:** [Actions #45014666010](https://github.com/andrawing1212/soridraw-music/actions/runs/45014666010) **SUCCESS**. 기존 QA Cloudflare 계정 `b60fcd62c679c64db19f0b0e0c2f3429`의 기존 `soridraw-qa-app768-d1` 합성 테이블 `app768_qa_synthetic_follow`에 새로운 정확한 랜덤 QA 행 1개만 INSERT(물리 W1~W2), 동일 행의 조건부 SQL UPDATE 두 건 병렬에서 **W1 1건 / W0 1건**, 단일 반영과 최종 행 값 확인, 정해진 1건만 삭제 및 COUNT=0, **정리 PASS**. R2 신규 객체·임시 Worker·기존 Worker deploy 없음. 기존 `soridraw-owner-qa-583` 활성 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100%, QA D1+R2 각 1개 전후 인벤토리 확인 PASS.
- **범위와 한계:** 구형 경로 우회는 **오프라인 실제 PREVIEW 모듈에 인가된 콜백을 모의 호출**한 결과이지 실제 배포 Worker의 API 요청을 보내 검증한 것이 아니다. D1 성공은 **합성 별도 QA 테이블 조건부 CAS** 물리 실측이며 실제 팔로우 canonical Writer, overlay trigger/index, 모든 구형 Worker·PC↔모바일·APP765/767/770/772 end-to-end의 **W1~W2/중복없는 복구 PASS가 아님**. R2 APP768/769 PASS 재사용(재실행 금지). 공유 D1/R2/RTDB/Functions/Firebase, PREVIEW/TEST/PRODUCTION 서비스·실사용자 데이터 변화 0. QA 계정 사용량 비용은 미측정.
- **자동 반복 OFF:** 승인된 단발 격리 QA 종료 직후 APP774 workflow의 `push` 실 QA 트리거 제거 및 `live` job 명시적 `if: false`. PR 오프라인 검사는 유지. 추가 QA 과금/데이터 쓰기 자동 반복 없음.
- **다음 출시에 필요한 실제 기술 수정:** (1) 정상 구형/미등록 사용자 기능을 보존하면서 전 활성·구형 Writer가 R2 admission/pending fence를 우회하지 못하는 **동시 호환 cutover** 설계, (2) 독립 canonical operation ledger/DO PITR 외부 floor와 사용자 삭제·재가입 기록 정책, (3) 실제 canonical Writer의 물리 D1 W1~W2 및 비용 검증, (4) PC↔모바일 정본·신호 실사용. 자동복구·PRODUCTION 릴리스 **HOLD**. 공유 데이터/Rules/Worker/PRODUCTION 실제 변경은 현재 승인에 포함되지 않음.

---

## CURRENT — APP772 최소 R2 접수·D1 W1~W2 장애 복구 경계 SOURCE-ONLY / 38케이스 PASS, 실제 자동 복구 HOLD (2026-11-22 KST)

- **디렉터 YES 승인 범위:** APP771 실 D1 스키마 읽기 전용 조사 및 APP768 실제 R2 조건부 중복 QA, APP769 실제 QA D1 실패·모의 ACK 소실 PASS 재사용. 추가 Cloudflare/Firebase API 요청, 새 Worker/D1/R2/토큰/권한, 원본 접근/변경, PREVIEW·TEST·PRODUCTION 배포 **0**.
- **재사용·최소 수정:** `scripts/app772-minimal-recovery-boundary.mjs` **새 OFF-only 소스**가 APP770의 exact admission+D1/R2 settle+independent complete history+external owner floor 판정 함수를 import하여 재사용. APP767 접수→D1 확정→별도 immutable settled R2→owner DO 외부 단조 floor를 후보로 설계. 관계별 미확정 작업이 다음 D1의 마지막 `mutation_id`로 덮이지 않도록 **모든 신/구 Writer와 전체 DO PITR로부터 독립된 pending fence**가 필요하며 현재 실제 구현·증거는 없음. 모의 완전 proof도 읽기 전용 `OFFLINE_EXACT_SETTLED_READ_ONLY_SHAPE_ONLY`만 허용, 다른 모든 불확정은 HOLD; D1 write/재쓰기/새 ID/DO 예약/relay/배포 허가 항상 false.
- **검사:** `node --check`(양 파일), `node scripts/verify-772-minimal-recovery-boundary.mjs` Node 22 로컬 오프라인 **38 상태 케이스 PASS**, fetch 호출 시 실패하도록 설정하여 실제 서버 네트워크 호출 0. D1 W3 또는 추가 1행, 전체 스캔/폴링, 구형 Writer 누락, DO rollback, 데이터 삭제/UID 재사용 정책 누락, D1/R2/epoch/receipt 불일치 모두 HOLD. APP768/769 물리 QA 재실행 없음. 상세 후보 `DOCS/APP772_MINIMAL_R2_D1_RECOVERY_DESIGN.md`.
- **명확한 차단:** 10만 명 기준 실제 R2 추가 PUT/settled/floor 비용, privacy retention, 외부 pending fence/단조 floor·immutable receipt·trusted callback, 구형 모든 Writer 동시 cutover, 장애 시 progress/liveness, 실제 운영 팔로우 D1 `rows_written<=2`, PC↔모바일 실사용 **NOT_TESTED**. 완전한 자동 복구 불가능할 수 있으므로 미확정 영구 HOLD를 실패 숨김 처리하지 않음. APP765/767, APP772 production runtime OFF / APP737·738 RELEASE HOLD.

---

## CURRENT — APP770 팔로우 저장 확정 후 독립 복구 판단 계약·오프라인 코드 검사 PASS / 실제 자동 복구 HOLD (2026-11-22 KST)

- **사용자 YES 승인 범위:** APP768(실 QA R2 중복 6회 중 1건 저장, Actions #44952152823)과 APP769(실 QA D1 오류 + 모의 ACK 소실, Actions #44953090705)의 이전 PASS 재사용. APP770은 기존 정본 수신점 재사용·저비용 복구 설계와 **source-only 검증**만 실행, 실 QA 자원과 공유 계정·사용자 원본 접근/변경/배포 0.
- **코드 변경:** `scripts/app770-post-admission-reconcile.mjs` 신규. `APP770_POST_ADMISSION_COMPILED_OPEN=false` 기본, 실제 APP755/765/767 Worker/backend에 import/연결 0. APP767과 동일한 canonical operation SHA-256 입장 해시 검증, Auth epoch·owner/actor/cutover·정본 D1 exact commit·R2 exact immutable settle·처음부터 완전한 모든 신/구 Writer operation history·DO 외부 owner revision floor를 **모두 요구**. 현존 D1 최신 pair/R2 최근 intent를 완전한 이력으로 간주하지 않음. 부족하거나 503/ACK 소실/DO PITR/세대 변경이면 `HOLD`. 모의 완전한 증거의 shape가 맞아도 `OFFLINE_EXACT_SETTLED_PROOF_SHAPE_MATCHED_ONLY`만 반환하며 신규 ID/원래 ID 재쓰기·DO 예약·Functions 송신/배포 허용은 항상 false.
- **코드 검사:** `node scripts/verify-770-post-admission-reconcile.mjs` Node 22 직접 실행 **42가지 모의 케이스 PASS**, fetch를 실패로 막아 실제 네트워크/서버 읽기·쓰기 0. GitHub에 기록된 코드와 검사 로컬 원본 Git blob SHA가 각각 일치. 이전 QA는 재실행하지 않음. 상세 설계 `DOCS/APP770_POST_ADMISSION_RECOVERY_SOURCE_ONLY.md`.
- **정확한 미완료:** 실제 운영의 독립 불변 canonical operation ledger와 trusted server callback, 구형 Writer 전체 cutover, Auth epoch 및 owner external revision floor, D1↔R2 원자성·장애 후 정확한 재전송 및 PC↔모바일 실사용 **NOT_TESTED**. 운영 팔로우 Writer의 D1 W1~W2 물리 비용도 미확인. **자동 복구/실서버 통합/PREVIEW/TEST/PRODUCTION 배포 없음**. APP765/767 기본 OFF, APP737/738 정식 릴리스 HOLD. 고위험 공유 데이터/권한·보존·마이그레이션 변경은 별도 승인이 필요.

---

## CURRENT — APP769 QA R2 접수 후 D1 장애·ACK 소실 합성 실검증 PASS / 자동 복구 HOLD (2026-11-22 KST)

- **디렉터 YES 범위:** APP768 기존 격리 Cloudflare QA 계정·기존 D1 `soridraw-qa-app768-d1` 및 R2 `soridraw-qa-app768-r2`만 사용. 새 Worker·버킷·데이터베이스·토큰·권한 생성 0. 기존 APP583 원본 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 활성 100% 검사. [PR #1336](https://github.com/andrawing1212/soridraw-music/pull/1336) 병합 `e98be05dad073b7cbc3b5fa8b0b9b6b6c831c1ba`.
- **QA 실행:** [GitHub Actions #44953090705](https://github.com/andrawing1212/soridraw-music/actions/runs/44953090705) **SUCCESS**. 시험 A: R2 QA 관리 API를 이용한 합성 접수 객체 업로드 성공 후 기존 QA D1 합성 테이블에서 **실제 잘못된 열 SQL 실패**를 의도적으로 발생시킴. 해당 합성 키 D1 COUNT=0, 자동 동일 요청 재기록 0을 확인. 시험 B: 다른 합성 R2 객체 업로드 및 QA D1 합성 INSERT 성공, 시험 코드가 완료 응답을 의도적으로 버리는 **모의 ACK 소실**을 주입한 뒤 동일 합성 키 SELECT로 D1 행 존재 확인, 재INSERT 0. 기존 APP768 Workers R2 `onlyIf` 6중 경합 물리 PASS는 재사용하며 재실행하지 않음.
- **정리 PASS:** 두 정확한 합성 R2 객체 삭제, QA D1 합성 행 정확 삭제 및 0건 재확인, 기존 APP583 100% 및 기존 QA D1·R2 그대로 보존. 운영 사용자·공유 Worker/D1/R2/Functions/RTDB/Rules/Hosting, PREVIEW/TEST/PRODUCTION 변경 0. 실제 계정 청구액은 미측정.
- **증거의 한계:** R2 객체 업로드는 **관리 API**이며 이 실행에서 Workers R2 조건부 원자성 재검사를 하지 않음. SQL 실패는 의도적 열 이름 오류, 응답 소실은 **테스트 클라이언트가 모의로 주입**한 것으로 실제 통신 두절·장애 후 운영 재전송을 증명하지 않음. 실제 팔로우 canonical D1 W1~W2, 과거 ID 전체 원장, Auth epoch·외부 revision floor, 모든 구형 Writer 연동, DO PITR 후 정확한 settled R2↔D1 reconcile, PC↔모바일 실사용은 **NOT_TESTED**. 자동 복구는 **HOLD**이며 APP765/767 compile OFF, APP737/738 PRODUCTION 릴리스 HOLD.
- **재검사 차단:** 이 한정된 QA 검증 완료로 동일 workflow 실서버 `push` 트리거 및 `live` job OFF. PR 오프라인 안전검사 코드는 보존. 이미 PASS한 APP768 QA 반복 호출 및 추가 과금 없음.

---

## CURRENT — APP768 실제 QA R2 조건부 6중 경합 PASS · 자동 재실행 OFF (2026-11-22 KST)

- **승인된 미완료 QA 마무리:** 디렉터 YES로 기존 격리 Cloudflare QA 계정의 R2 버킷을 재사용하여 임시 Worker 1개 생성 → 동일 작업 ID 6개 동시 요청 → 정확한 합성 객체 및 임시 Worker 삭제를 시행. [PR #1332](https://github.com/andrawing1212/soridraw-music/pull/1332)·[#1333](https://github.com/andrawing1212/soridraw-music/pull/1333)·[#1334](https://github.com/andrawing1212/soridraw-music/pull/1334)·[#1335](https://github.com/andrawing1212/soridraw-music/pull/1335)에서 실제 실패의 최소 원인만 해결, 합격한 기초 D1 검사는 반복하지 않음.
- **실제 Cloudflare QA PASS:** [Actions #44952152823](https://github.com/andrawing1212/soridraw-music/actions/runs/44952152823) **SUCCESS**, 검증 SHA `372a37188d495e8d263ea1b215661ed5775f668d`. 실제 Workers `R2Bucket.put(key,body,{onlyIf:{etagDoesNotMatch:'*'}})` 동일 합성 operation ID 6개 병렬 요청 결과: **HTTP 201 단 1건, 409 중복 차단 5건**, 생성된 객체 HEAD 확인(존재/JSON 메타) PASS. 이것은 R2 조건부 create-once 물리 검증이며, 메모리 mock만의 증거가 아님.
- **정리·격리 PASS:** 검증 완료 직후 임시 QA Worker 삭제 확인, 해당 실행 합성 R2 객체만 삭제 확인. 기존 QA Worker `soridraw-owner-qa-583` 원본 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 유지, 기존 QA D1 `soridraw-qa-app768-d1` 및 R2 `soridraw-qa-app768-r2` 보존. PROD/TEST/PREVIEW 공유 Worker·D1/R2·Firebase·Hosting·실사용자 원본 데이터 변경 0. 기존 계정의 요금은 실측하지 않음.
- **재실행 차단:** 이미 승인된 임시 Worker 시험 1회 완료에 따라 QA-only Workflow의 `push` 실서버 자동 트리거와 `live` job을 OFF 처리; 오프라인 PR 검사와 검증 소스는 보존. 별도 새 승인 없이 동일 시험 재실행·과금하지 않음. 완료 기록만으로 Hosting 배포하지 않음.
- **완료가 아닌 것:** APP767의 R2 접수와 D1 실제 정본 쓰기 원자성, 재전송/ACK 손실 복구, 기존·구형 Writer 전부의 강제 접수/과거 ID 검증, DO PITR 독립 역사, 실제 팔로우 Writer의 D1 W1~W2 물리 과금, PC↔모바일 사용자 실사용은 **NOT_TESTED**. APP765/767 기본 OFF, APP737/738 정식 릴리스 HOLD. 이전 APP768 기초 D1 W1/W2 합성 물리 QA PASS 및 APP749/760 실검증은 원래 범위대로 재사용.

---

## CURRENT — APP768 독립 QA D1·R2 기초 물리 검증 PASS / R2 조건부 경합·정식 W2 미검증 (2026-11-22 KST)

- **승인과 QA 자원 생성:** 디렉터 2026-11-22(KST) 명시 YES로 QA 계정 `b60fcd62c679c64db19f0b0e0c2f3429`에 **D1 `soridraw-qa-app768-d1` 1개, R2 `soridraw-qa-app768-r2` 버킷 1개**만 생성·보존 승인. [PR #1329](https://github.com/andrawing1212/soridraw-music/pull/1329) 병합 `8fa092ce`. QA Worker `soridraw-owner-qa-583` 기존 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 불변을 실 API GET으로 보호. 기존 0개/0개 QA 자원을 확인한 뒤 생성하고, 다음 실행에서 정확히 QA 리소스 1개씩만 존재하는 것 재확인(중복 생성 0). PROD/TEST/PREVIEW 공유 계정/사용자 데이터 영향 0.
- **D1 실제 합성 SQL:** [Cloudflare 실제 #44948353103](https://github.com/andrawing1212/soridraw-music/actions/runs/44948353103)에서 생성된 QA D1 전용 `app768_qa_synthetic_follow` 테이블의 행당 초기 INSERT는 **`rows_written=2`(PK 인덱스 등 포함)**, UPDATE 단일 행은 **W1**, 두 행 동시 변경은 **W2**로 물리 관측. 해당 합성 행 2개 DELETE 후 COUNT=0 검증 PASS. **실제 운영 팔로우 Writer의 W1~W2 물리 측정이 아니며** 가상 합성 테이블 PASS를 정식 비용 PASS로 주장하지 않음. 이미 통과한 D1 측정은 이후 R2 오류 수정에서 반복하지 않음.
- **R2 실제 객체 업로드:** 첫 관리 API 업로드 FormData가 [#44948595390](https://github.com/andrawing1212/soridraw-music/actions/runs/44948595390)에서 **HTTP 501 / code 10028**, DELETE는 10007(NoSuchKey)로 객체 부재 확인. 오류 처리/원시 바이너리 PUT으로 최소 수정 [PR #1330](https://github.com/andrawing1212/soridraw-music/pull/1330), [PR #1331](https://github.com/andrawing1212/soridraw-music/pull/1331); 최종 [실제 #44949079314](https://github.com/andrawing1212/soridraw-music/actions/runs/44949079314) **QA R2 관리 API 합성 객체 1건 업로드 PASS + 그 객체만 DELETE PASS**, QA D1·R2 동일 자원 확인 PASS. QA R2 버킷은 이후 QA 재사용을 위해 유지. 새 Worker·새 비밀값·대량 객체 생성/삭제 없음.
- **반드시 구분할 미완료:** APP767 `R2Bucket.put(key,body,{onlyIf:{etagDoesNotMatch:'*'}})` / S3 `If-None-Match: *` **동일 ID 6회 동시 요청에서 1회만 생성되는 물리 경합/503·ACK 손실 검증은 NOT_TESTED**. 관리 REST API 업로드 1건은 그 조건부 동작의 증거가 아님. 실제 정본 팔로우 Worker의 D1 `meta.rows_written<=2` 물리 동작/기존 구형 Writer 호환/PC↔모바일도 **NOT_TESTED**. QA-only Worker 추가 배포 또는 별도 S3 QA 자격증명은 이 단계에서 임의 생성·설정하지 않음. APP765/767 production source 기본 OFF, APP737/738 PRODUCTION 릴리스 HOLD.
- **릴리스/비용 보호:** QA-only D1+R2 자원 2개만 유지, 합성 행/객체 정리 PASS. QA R2 활성화는 디렉터가 직접 승인했고 무료 한도 초과 과금 가능; 실제 청구액은 미측정. TEST·PREVIEW·PRODUCTION Worker/Functions/RTDB Rules·공유 D1/R2/사용자 데이터/Hosting 변경·배포 **0**. 이전 APP749/760 합격 QA의 재실행 없음.

---

## CURRENT — APP768 R2 구독 활성화 후 독립 QA 리소스 실제 인벤토리 검증 (2026-11-22 KST)

- **디렉터 QA R2 구독 직접 활성화 완료:** Cloudflare `SORIDRAW-QA` 대시보드에서 R2 사용 가능, 버킷 0개·현재 저장 0B·청구 사용량 $0.00 확인. 운영 계정 아님.
- **실제 GitHub Actions 한 번 재확인:** [#44944103380](https://github.com/andrawing1212/soridraw-music/actions/runs/44944103380) 기존 `live_metadata` job의 재실행 **SUCCESS**. `APP768_QA_WORKER_ORIGINAL_GET=PASS`, `APP768_QA_D1_METADATA_GET=PASS`, `APP768_QA_R2_METADATA_GET=PASS`, `APP768_QA_D1_NAMES=[]`, `APP768_QA_R2_NAMES=[]`, **해당 격리 QA 계정 D1 0개 / R2 0개**. 실제 QA API 접근 및 기존 APP583 Worker 100% 원복 확인, 사용자 원본 행/객체 조회·쓰기/배포 0.
- **APP768 현재 실제 차단점:** 인증 문제는 해결. 기존 QA D1과 R2 리소스가 전혀 없으므로 APP767 R2 create-once 물리 경합/503 시험과 D1 `meta.rows_written` W1~W2 **미실행**. 이전 APP767 합성 in-memory PASS를 실제 R2/D1 PASS로 보고 금지. 신규 독립 QA 전용 D1+R2 버킷 **생성은 추가 승인 전 금지**; 자원/비용/안전 정리 정책을 사용자에게 먼저 설명. TEST/PRODUCTION/공유 D1·R2·RTDB/Hosting/Functions 변화 0, APP765/767 OFF, 정식 배포 HOLD.

---

## CURRENT — APP768 QA D1 정상, R2 계정 서비스 미활성화(Cloudflare 10042) — 물리 시험 HOLD (2026-11-22 KST)

- **디렉터가 QA 전용 Secret 연결 완료:** GitHub Actions `CLOUDFLARE_QA_DATA_TOKEN` 실제 인식 PASS. [실제 #44942457830](https://github.com/andrawing1212/soridraw-music/actions/runs/44942457830) 기존 원본 APP583 Worker GET PASS, **QA D1 metadata GET PASS**, QA R2 metadata GET 403. 별도 권한을 임의로 추가하거나 PROD 토큰 사용하지 않음.
- **원인 확정:** [PR #1328](https://github.com/andrawing1212/soridraw-music/pull/1328) 원본 데이터·비밀값 없이 Cloudflare 오류 숫자만 기록하도록 수정/병합 `81296d6bac0f55f0dc71ef2149c6199972f6881a`. [실제 #44944103380](https://github.com/andrawing1212/soridraw-music/actions/runs/44944103380) `APP768_QA_R2_DENIAL_CLOUDFLARE_CODES=10042`(공식 NotEntitled / R2 서비스 권한 미활성화). Cloudflare 공식 `Workers R2 Storage Write`는 Bucket 목록 권한을 포함하므로 누락된 Read 권한으로 단정하지 말 것. QA R2 구독/결제수단 및 활성화는 사용자 제품·비용 승인 전 **금지**. 사용자는 **SORIDRAW-QA → R2 Object Storage Overview**에서 서비스 활성화 상태를 읽기 전용으로 확인, 결제정보·토큰 캡처 금지.
- **현재 물리 테스트:** 실제 QA R2 `If-None-Match:*`/6개 경합과 D1 `meta.rows_written` W1~W2는 **둘 다 NOT_TESTED**. R2 버킷 존재 여부도 현재 조회 불가능. 계정 자격 해결 및 격리 QA DB+R2 버킷 원본 확인 전 합성 기록 쓰기·테이블/버킷 생성·기타 자원 변경·배포 0. APP767 합성 PASS는 유지하되 실서버 PASS로 표시 금지. APP765/767 OFF 및 정식 APP737/738 HOLD.

---

## CURRENT — APP768 독립 QA 실제 R2/D1 물리 검사: QA API 접근 HOLD (2026-11-22 KST)

- **승인 범위:** 기존 격리 Cloudflare QA 계정 `b60fcd62c679c64db19f0b0e0c2f3429`만 활용해 APP767 R2 조건부 create-once와 실제 D1 `meta.rows_written` W1~W2 검증, 합성 기록만 생성/정리. 공유 PRODUCTION/PREVIEW/TEST 사용자 데이터·서버/배포 변경 금지.
- **완료 근거:** PR #1326 병합(`81fe0a0c88b53a12db13d96ca6807720027ab5c9`), qa-only GET 스크립트와 mock 검사 [#44941643234](https://github.com/andrawing1212/soridraw-music/actions/runs/44941643234) 오프라인 PASS. QA 원본 APP583 Worker 활성 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% GET 확인. 기존 read-only [APP735 #44941838295](https://github.com/andrawing1212/soridraw-music/actions/runs/44941838295)로 QA Worker의 액세스 토큰/4 바인딩 읽기 성공 재확인.
- **실제 접근 차단:** [APP768 최초 QA inventory #44941700240](https://github.com/andrawing1212/soridraw-music/actions/runs/44941700240)는 `QA_TOKEN_READ_SCOPE_401`. 계정별 경로 분리 후 [#44941958269](https://github.com/andrawing1212/soridraw-music/actions/runs/44941958269) QA Worker GET PASS 다음 D1 list 접근 거부. [#44942018417](https://github.com/andrawing1212/soridraw-music/actions/runs/44942018417)에서는 Worker GET PASS, **기존 QA D1 및 QA R2 각각 메타데이터 목록 접근 실패**. 이 때문에 기존 QA D1/R2 리소스 존재 여부·생성/삭제 권한을 확인하지 못했으므로 **D1 SQL/R2 객체를 포함한 물리 시험 자체를 시작하지 않음**. PRODUCTION 계정 토큰으로 대체하지 않음.
- **정확한 상태:** APP767의 6-way create-once/503/DO PITR은 이전 메모리 합성 QA PASS이나 APP768 실제 R2 조건부 write/Cloudflare D1 `meta.rows_written`은 **NOT_TESTED / AUTH_HOLD**. `W1~W2 PASS` 또는 실제 R2 중복 방지 PASS 주장 금지. 다른 QA 계정이나 공유 사용자 데이터 접근 0, 새로운 버킷·D1·테이블·객체 생성·삭제 0, Cloudflare Worker 배포·변경 0.
- **안전한 해제 조건:** 기존 격리 QA 계정으로 한정된 유효 API token의 **D1 Read/Edit 및 Workers R2 Storage Read/Edit** 접근과 QA 전용 리소스 식별이 확인되어야만 기존 승인 범위의 합성 물리 검사를 수행.
- **APP768 API 토큰 분리 후속:** PR #1327 병합 `41e8b95cad5c443063ad3d8489c534f837c45b9b`, [오프라인 검사 #44942411069](https://github.com/andrawing1212/soridraw-music/actions/runs/44942411069) PASS. Worker QA 읽기/배포 기존 토큰은 그대로, D1/R2 메타데이터 및 나중 합성 데이터 검증 전용 신규 GitHub Actions secret **`CLOUDFLARE_QA_DATA_TOKEN`**만 사용하도록 고정. [main #44942457830](https://github.com/andrawing1212/soridraw-music/actions/runs/44942457830)은 QA Worker GET PASS, D1/R2는 `QA_DATA_TOKEN_REQUIRED`로 차단. GitHub secret은 아직 연결되지 않았으며 QA D1/R2 메타데이터 조회·물리적 중복/PITR·D1 W1~W2 시험 미실행. 기존 QA Worker 토큰을 덮어쓰거나 PROD 권한으로 우회하지 말 것. 새 QA 리소스 생성/과금 및 원본 정리 안전성이 불명확하면 먼저 HOLD. 작업은 GitHub `APP768` read-only workflow 재실행으로 확인 가능하나 불필요한 반복 호출 금지. APP765/767 기본 OFF, APP737/738 PRODUCTION HOLD, APP749/760 기존 실제 QA 결과 재검사하지 않음.

---

## CURRENT — APP767 10만 명 팔로우 이력 W1~W2 저비용 설계 선택 + 격리 합성 QA (2026-11-22 KST)

- **분석 결론:** APP766 실제 D1 103 테이블/관계별 `mutation_id`와 R2 관계별 최신 `follow-intents-v354`는 APP765의 전체 operation ID 기록 아님. D1에 독립 append-only receipt row를 추가하면 현재 원래 W2 경로에서 최소 W3 가능성·인덱스 쓰기/기존 Writer 호환 위험이 있어 선택하지 않음. Cloudflare R2 Standard **조건부 create-once PUT**로 canonical ID별 변하지 않는 접수 객체를 만들면 새 D1 쓰기는 0, 하지만 **D1 commit과 R2 PUT은 원자적이지 않음**. 전체 비교와 10만 owner × 5/50/500 events/년의 별도 R2 비용 모델은 `DOCS/APP767_FOLLOW_HISTORY_MIN_COST_DECISION.md`에 기록.
- **구현 범위:** `scripts/app767-r2-admission-candidate.mjs`는 `APP767_R2_ADMISSION_COMPILED_OPEN=false`·`APP767_ISOLATED_SYNTHETIC_QA` 전용이며 실제 Worker/R2 bucket 바인딩 없음. trusted owner epoch·new cutover completeness·legacy writer coverage·deletion lifecycle·DO PITR 독립성이 증명되지 않으면 접수 쓰기조차 HOLD. 동일 해시 키 `onlyIf:{etagDoesNotMatch:'*'}` 조건부 생성 한 번만 시도, 이미 존재/503 불확정 시 새 DO/canonical 변경 허용하지 않음. 성공도 **접수만 확정**, D1 committed나 APP765 `completeFromOrigin:true` 증명이 아님.
- **격리 QA:** 기존 GitHub Actions PREVIEW/PROD read-only 검토 Workflow의 오프라인 synthetic R2 시험에서 6개 동시 ID 경합/DO PITR/503 before/after write/D1 ACK 유실/Auth epoch/이전 Writer 미확인/삭제 정책 불확실/0 추가 D1 쓰기 가정 등을 검사. 이는 실제 Cloudflare QA R2/S3 물리 QA나 D1 `meta.rows_written` 측정이 아님. 기존 APP749/760 독립 QA 실전송 PASS는 재시험하지 않음.
- **잔여 HOLD:** 새 epoch의 과거 요청과 충돌하지 않는 cutover, 모든 최신·레거시 Writer의 강제 접수, exact settled R2↔D1 reconcile, 외부 owner revision floor, R2 객체 장기 보관·실제 Auth 삭제/재생성 개인정보 정책, 실제 R2 412/중복/비용·D1 W1~W2 물리 실험은 별도 실제 QA 전 완료 미확인. APP765에 가짜 원장을 연결하거나 조건을 완화하지 않음. PREVIEW/TEST/PRODUCTION Worker·DO·Functions·D1/R2/RTDB·Rules·Hosting·사용자 원본 읽기/변경·배포 0. APP737/738 정식 배포 HOLD.

---

## CURRENT — APP766 기존 D1/R2 팔로우 이력 재사용 가능성 조사 (2026-11-22 KST)

- **소스 사실:** D1 `explore_follow_overrides_348`는 `(follower_uid,following_uid)` 한 행에 최신 `mutation_id`를 저장하며 원천부터 append-only operation ID 이력이 아니다. R2 `internal/explore/follow-intents-v354/<cutoverToken>/<actor>/<owner>.json`도 해당 관계별 한 개의 최신 settled intent/current revision을 조회한다. owner 집계 Outbox 529 및 profile_stats epoch/revision candidate는 과거 개별 canonical ID 원장이 아니다. 정확한 출처·근거·재사용 범위는 `DOCS/APP766_EXISTING_FOLLOW_HISTORY_EVIDENCE.md`.
- **안전한 결론:** 기존 D1 관계 상태 + R2 최신 intent + Firebase Auth epoch를 결합해도 APP765의 **owner DO PITR 독립/처음부터 완전한 단조 operation history의 `never-seen`을 증명할 수 없다**. 별도 원장 존재/실제 Writer 커버리지/보존기간/완전성 미확인. 불확실하면 APP765 source-only `HOLD` 유지. 안전하지 않은 임시 `completeFromOrigin:true` 매핑·신규 DB/공유 데이터 변경·W3+ 방지.
- **현재 검증 추가:** `scripts/app766-live-d1-history-schema-readonly.mjs`와 기존 GitHub Secrets를 활용한 제한적 Actions 1회 검증. 실제 공유 D1의 **sqlite_schema 메타데이터만 단 1 SELECT** (Cloudflare API는 SQL 전송에 POST 사용), 사용자 원본 행 조회/변경 0. 스키마에 유사한 테이블이 있더라도 실제 canonical 전체 operation 원장으로 통과시키지 않음. 코드 테스트와 실제 메타데이터 접근 합격을 분리 보고. 실제 R2 사용자 객체 조회/목록화 없음.
- **범위·상태:** 승인된 조건에 완전한 원장이 없어 APP765 실전 callback은 연결하지 않음(연결 가능하다고 가장하지 않음). APP749/760 독립 QA 실전송 PASS 기존 증거 재사용, 반복 QA 0. PREVIEW·TEST·PRODUCTION Worker/DO/Functions/Rules/D1/R2/RTDB/Hosting/공유 사용자 데이터 배포·변경 0. 정식 릴리스 APP737/738 HOLD.

---

## CURRENT — APP765 DO 전체 복구 후 독립 정본·계정 세대·요청 이력 검증 게이트 (OFF-ONLY, 2026-11-22 KST)

- **변경 범위:** APP755 백엔드에서 owner DO에 이미 동일 예약이 있으면 기존 수신 경로 그대로 재사용하고, **DO에서 신규 예약으로 판단돼 실제 reserve()하기 직전에만** `APP765` 독립 정본 재확인 게이트를 추가한다. 기존 APP743의 요청별 WeakMap/Auth App Check·APP354 expectedRevision·D1/R2 preflight를 재사용한다. `app765-production-canonical-recovery.mjs`는 추가 네트워크를 자체 수행하지 않는 순수 검증+서버 callback 인터페이스이며 기본 `COMPILED_OPEN=false`.
- **게이트 계약:** 별도 서버 callback이 D1 현재 pair (actor/owner/desired 이전 상태/revision), R2 settled owner revision+Auth epoch, Firebase 소유자 epoch, **DO rollback에 종속되지 않는 처음부터 이력을 보장하는 canonical operation ID 원장**, 그리고 owner별 단조 증가 외부 revision floor를 정확한 ID/세대/기대 버전으로 묶어 제공해야 신규 DO 예약 허용. 이미 처리된 ID, 원장 누락·부분 이력, DO보다 최신 외부 revision, 소유자 계정 세대/버전 불일치, 인증 에러·503는 DO 저장/정본 쓰기 전에 HOLD. 기존 확정 receipt 재시도는 원장 추가 조회 0.
- **중요한 미완료:** 실제 PRODUCTION에 해당 **독립·내구성 operation history ledger/복구 floor/서버 확인 callback이 존재한다는 증거가 없으며 구현·배포하지 않았다**. 임시 D1 최신 pair 조회·클라이언트 assertion·DO 로컬 스냅샷만으로 원장이 있다고 가정 금지. APP765 합성 callback을 사용한 CI PASS는 실제 독립 데이터 무결성, PITR 복구, Functions/PC·모바일 PROD PASS가 아니다. 외부 history 조회 비용은 신규 예약에만 발생하지만 실제 쿼리 수/비용은 미래 callback 구현 전에 검증 필요.
- **릴리스 보호:** APP755/759/761과 APP765 자체 기본 OFF, APP728/756 검토 후보도 원본 PROD Worker 그대로. 기존 APP749 실제 QA A↔B 및 APP760 503→복구·QA 원본 Worker 복구 PASS 영향 없으므로 반복 검사 없음. PREVIEW·TEST·PRODUCTION Worker/DO/Firebase/Rules/RTDB/D1/R2/Hosting 및 공유 사용자 데이터 읽기·변경/배포 0. APP737/738 정식 배포 HOLD.

---

## CURRENT — APP764 보존 키 단독 손실 시 과거 예약 중복 발급 방지 (SOURCE ONLY, 2026-11-22 KST)

- **실제 결함 경로:** APP762에서 `archiveUsed=true`인 owner의 개별 `app762-owner-follow-final-*` 키가 손실되면 `find`가 `absent,authoritative:true`를 반환해 동일 canonical operation ID를 새로 발급할 수 있었다. APP764는 owner DO의 기존 `app755-owner-follow-pending-v1` 안에 **보존된 canonical ID의 SHA-256 앞 128비트 압축 확인 인덱스**와 그 SHA-256 검증값을, 원래 완료 기록/새 예약/알람과 **같은 storage.transaction**에서 저장한다. 삭제·TTL·스캔·백그라운드 쓰기·새 namespace/DB/바인딩 추가 없음. 단순 해시 충돌은 재발급이 아닌 안전 HOLD.
- **보호:** 새 요청 조회 시 기존 hot/개별 archive key 경로를 유지하며, 보존 키만 사라져도 확인 인덱스에 과거 ID가 있으면 `find=unknown`, `reserve=durable:false`로 차단. 확인 목록/검증값 오류·APP762식 `archiveUsed=true`이지만 확인 목록이 없는 과거 상태는 검증 없이 재생성하지 않고 HOLD. 정상 신규 ID는 원래 APP743/755의 정본 D1/R2·revision·Auth preflight 계약을 거쳐 기존대로 진행. 기존 v1 예약 기록은 별도 마이그레이션 없이 읽는다.
- **남는 엄격한 한계:** 이것은 **개별 archive 키만 손실되고 hot 본문의 확인 인덱스는 유지된 경우**에 대한 보호다. 전체 DO PITR 롤백·hot 키와 archive 키 동시 손실·다른 canonical D1/R2/owner authEpoch의 최신 상태 불일치는 로컬 인덱스만으로 확인 불가능하다. 실제 운영 복구와 정식 배포는 독립 정본·서버 운영 이력 동등성 증명이 나올 때까지 HOLD. APP763 비용 모델에 보존 인덱스 약 35B/건 추가 반영. APP749/760 QA 실제 PC↔모바일·503 복구/원본 Worker 복원 PASS는 재검증하지 않는다.
- **실서버 영향:** APP755/759/761 정식앱 후보 compile OFF. Cloudflare/Firebase Worker·DO·Functions·RTDB·D1/R2·Rules·Hosting, PREVIEW/TEST/PRODUCTION 및 공유 사용자 원본 읽기·변경/배포 0. 기존 APP737/738 출시 HOLD 유지.

---

## CURRENT — APP763 소유자 DO 10만 명 운영 비용·장기 보존 복구 검증 (2026-11-22 KST)

- **작업 범위:** APP762 완료/held 기록을 owner별 영구 개별 키로 보관하는 정책에 대해 Cloudflare 공식 SQLite DO 요금/Free·Paid 한도/Legacy KV 차이를 조사하고 10만 owner × 5/50/500회/년, 10년 누적 사용량을 **가정으로만** 산출. 모델과 원본 공식 URL·전제·제외 비용은 `DOCS/APP763_OWNER_FOLLOW_STORAGE_COST_AND_RECOVERY.md`에 고정. 실제 계정별 플랜/사용량/물리 DB 바이트와 다른 Cloudflare/Firebase 기능의 공용 할당량 소모는 미확인.
- **복구 안전:** 순수 코드의 합성 owner별 hot queue/archived key를 owner·receipt 식별값 유출 없이 SHA-256과 개수로 고정하는 오프라인 검사. 복구 뒤 1개 키 손실, hot state 되돌림, 다른 owner·operation ID 치환, 기록 중복 시 **HOLD**. 오프라인 저장소가 일치해도 외부 canonical D1/R2·Auth epoch·Functions 수신점이 최신이라는 보장이 없어 실서비스 복구/정식 배포 PASS로 보고하지 않는다.
- **고위험 미해결:** APP762 `archiveUsed=true`에서 개별 archived key만 누락되면 현재 저장소 코드가 이를 `absent`로 해석할 여지가 있으므로 실제 재처리·운영 활성화 **HOLD**. DO storage의 PITR는 시점 복구로 다른 서버의 정본을 되돌리지 않으며, 실제 DO 복원/재전송 검사 전 별도 보호 구조가 필요하다. 보존 기록 삭제·TTL·마이그레이션·원본 데이터 접근 없이 위험을 문서화한다.
- **불변 조건:** APP749 실기기 A/B PC↔모바일 및 APP760 QA 503→복구/원본 Worker 원복 PASS 재검사하지 않음. APP755/759/761/762 PRODUCTION source compile OFF, APP737/738 릴리스 HOLD. PREVIEW/TEST/PRODUCTION Cloudflare·Firebase·DO·Functions·D1/R2/RTDB/Hosting/공유 사용자 데이터 변경·배포 0.

---

## CURRENT — APP762 24개 완료 예약 누적 차단 수정: 불변 보존 키 + 24개 처리 대기 목록 유지 (2026-11-22 KST)

- **수정 대상:** 기존 APP755 owner Durable Object 예약 기록은 완료·보류 후에도 `app755-owner-follow-pending-v1` 한 목록(최대 24개)에 남아 누적 24번째 이후 새 요청을 거부했다. 새 APP762는 **목록이 실제로 가득 찼을 때에만** 가장 오래된 완료(`delivered`) 또는 보류(`held`) 예약을 같은 owner DO storage 내 canonical-operation-ID별 개별 영구 보존 키(`app762-owner-follow-final-*`)에 **하나만 원자적으로 이동**한 뒤 신규 예약을 추가한다. 보존 키에는 원래 server-issued operation ID·authEpoch/소유자·최종 상태가 유지되며, 재전송된 옛 canonical ID는 목록과 단일 보존 키를 조회하여 원래 예약을 반환한다. 삭제·TTL·일괄 scan·방문 시 쓰기·상시 polling·D1/R2/RTDB 접근 없음.
- **기존 구조 보호:** 기존 version-1 목록 구조와 v1 초기 동작은 변경하지 않음. 최초 이동 뒤 선택적 `archiveUsed:true` 플래그로 보존 키 확인을 활성화한다. 동일 키·다른 소유자·기록 손상·보존소 오류는 새로운 서버 예약을 만들지 않고 HOLD. DO transaction 안에서 보존 키·활성 목록·알람을 함께 갱신하여 실패 시 전체 롤백. 기존 APP759 503·세대 충돌·중복 ACK·알람 제한 및 APP761 owner identity 범위는 유지한다. 독립 QA APP760 실제 12→13(503 회복)→14(취소) 및 원본 Worker 복구 PASS 재검증 불필요.
- **명확한 한계:** 완료/보류 기록만 넘긴다. **처리 중인 예약 24개가 모두 미완료이면 정본·내구 데이터 안전을 위해 추가 요청 HOLD**; 강제 삭제나 가짜 성공 없음. 보존 기록은 중복 방지를 위해 자동 삭제하지 않으므로 owner별 저장량이 이벤트 수만큼 증가한다. 10만 명 대상 장기 비용·보존 정책·수명/압축/증분 비용은 활성화 전에 별도 확인해야 하며, 영구 무료/무제한 공간을 보장하지 않는다.
- **배포 상태:** 모든 APP755/759/761/762 정식앱 소스는 기본 OFF, 활성 PRODUCTION owner DO/Functions 연결·PC↔모바일 동등성 별도 HOLD. 실제 PREVIEW/TEST/PRODUCTION/공유 사용자 원본/Cloudflare·Firebase 배포·설정 변경 0. 기존 APP737/738 정식 승인·검사 게이트 불변.

---

## CURRENT — APP761 정식 팔로우 owner DO 알람 연결 소스 준비 / APP760 독립 QA 503→복구 최종 PASS (2026-11-22 KST)

- **APP760 실검증 완료 — 재실행 불필요:** 디렉터 QA Cloud Shell 실제 `APP748_QA503_DO_RETRY_FUNCTIONS_RTDB=PASS`, 기존 RTDB 버전 12 → 한 번의 503 주입 뒤 DO 알람 재전송 버전 13/팔로우 1명 → 취소 버전 14/0명. [GitHub Actions #44929523386](https://github.com/andrawing1212/soridraw-music/actions/runs/44929523386) **qa_window SUCCESS**, 원본 APP583 QA Worker 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 자동 복구와 최종 바인딩·HTTP `APP741_QA_ORIGINAL_VERSION_BINDINGS_AND_HTTP_FINAL=PASS`. PR #1317/#1318 병합. 독립 QA 전용이며 공유 사용자 데이터/실서비스 배포 없음. APP749 실기기 PC↔모바일 0→1→0 PASS도 그대로 재사용.
- **APP761 후속 구현 범위:** APP755 owner-scoped DO 내구 receipt + APP759 알람/Functions 전달 엔진을 재사용하고 owner-bound trust callback을 통과할 때만 find/reserve/alarm을 실행하는 **정식앱 OFF-only 소스 어댑터**. owner ID와 DO identity가 불일치하면 DO 저장/Functions 호출 전에 중단. APP728 임시 검토 번들에 소스 SHA와 기본 OFF 상태만 추가하고 생산 Worker 원본 export/12 bindings/레거시 service/마이그레이션 불변. QA 서버 재검증 불필요.
- **중요 HOLD:** PROD owner DO 클래스·서비스 바인딩/Functions scope/정본 settled proof·서명 송신점의 실제 연결은 여전히 없다. APP755 owner receipt 24개 상한 이후 안전한 정리·중복 보존 구조는 미해결. APP761 소스/오프라인 모의 PASS는 운영 알람·정식 사용자 기능 PASS가 아님. 실제 Cloudflare/Firebase 공유 자원 변경/배포, TEST/PRODUCTION/Hosting, 원본 데이터 변경은 별도 위험 검증·승인 전까지 금지. 정식 배포 APP737/738 **HOLD**.
- **작업 기준:** GitHub `preview` HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4`, `production` HEAD `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`; APP758 실제 PROD Explore 12 / PREVIEW 41 바인딩, PROD owner service 없음 증거 재사용. 다음 작업은 owner DO identity proof·production canonical proof 및 receipt 보관 비용/복구를 별도 승인된 범위에서 해결.

---

## CURRENT — APP749 독립 QA 실제 A↔B 인증·팔로우/취소·PC↔모바일 자동 수신 PASS / 정식 승격은 별도 HOLD (2026-11-21 KST)

- **최신 사용자 실사용 증거(같은 날 22:16~22:17 KST 화면):** QA 전용 `https://soridraw-qa-owner-584.web.app/qa749.html` PC에서 기존 A/B Firebase 실로그인, 서버 서명 인증과 RTDB 기준 0명 확인 PASS. B→A 팔로우 1회 후 A 수신 1명/버전 11, 취소 1회 후 0명/버전 12. PC 검증 기록에는 `팔로우·취소 검증 PASS · 최종 팔로워 0명`, `A PC↔모바일 + 서버 최종 반영 PASS`가 표시됐고, 모바일 A도 새로고침 없이 0명/버전 10 → 1명/버전 11 → 0명/버전 12 순서를 수신한 화면 제공. 이는 **APP749 독립 QA 실제 로그인·서명/동기화 경로 PASS**이며 이전 APP583 또는 APP730 합성 검사 PASS를 재표기한 것이 아님.
- **고장 수정·재사용 기준:** 공개키 조회 과정의 `redirect:'error'`가 실제 Cloudflare Workers에서 `AUTH_KEYS_NETWORK`로 실패하던 원인을 `redirect:'manual'`(3xx는 기존 200-only 게이트에서 거절)로 수정. [PR #1301](https://github.com/andrawing1212/soridraw-music/pull/1301), main `1d7330f7bef1d0d646d5bc1eed767c264afcfa2f`, [오프라인+Google 공개키 검사 #44907298349](https://github.com/andrawing1212/soridraw-music/actions/runs/44907298349) PASS. GitHub issue-comment 실행 **#57 전체 SUCCESS**를 사용자 화면에서 확인(정확한 실행 ID 별도 기록 없음); 정해진 `always()` APP583 원본 100% 복구+원본 HTTP 확인 포함. 현장 QA A↔B 테스트는 새 실패/관련 코드·QA 바인딩·Auth/Rules 변경이 없으면 반복하지 않음.
- **명확한 한계:** QA 전용 Firebase 프로젝트 `soridraw-app`·QA Worker에서 두 합성 계정으로 한정한 PASS. 모든 로그인 계정/실서비스 PREVIEW·PRODUCTION 서버, 장애 503 후 재전송, 비용·전체 기능 동등성까지 합격한 것으로 확대하지 않는다. 현재 `preview` 고정 HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4`와 실제 일반 사용자 서버 배포는 별개. 사용자 데이터/TEST/PRODUCTION 배포·변경 없음.
- **배포 속도 원칙:** [직접 승격 계약](./PREVIEW_PRODUCTION_DIRECT_PROMOTION.md)대로 최초 PREVIEW↔PRODUCTION 서버/데이터/복구 호환성 증거를 1회 확보한 후, 백엔드 활성 버전·바인딩·함수/Rules·API/비용 계약이 동일하면 이후 일반 Hosting-only 승격에서 기존 백엔드 QA/전체 회귀를 재수행하지 않고 변경 범위+고정 활성 Hosting SHA·롤백·PC/모바일 영향 경로만 검증한다. **APP737/738 준비 코드 있음, PROD 실제 승격은 아직 HOLD**(PREVIEW 41 / PROD 12 Explore bindings, PREVIEW-only 31, 독립 승격 증거 파일 부재·운영 기능 동일성 미확정).

---

## 0APP749J. APP749 CSP 안전 비교 수정 QA584 Hosting 실제 배포 PASS / A↔B 실기기 로그인·실시간 수신 미검증 (2026-11-21 KST)

- 디렉터 QA 전용 Cloud Shell에서 고정 commit `89857fe5bd1dc19aba467cc33e0ca8e272ef7585`의 `scripts/app749-qa-hosting-scoped-csp.mjs --check && --deploy` 실행 사진 확인: `APP749_QA_SITE_EXISTING_RECEIVER=PASS`, `APP749_QA_ORIGINAL_RELEASE_AND_FILES_PINNED=PASS`, `APP749_QA_SCOPED_CSP_CONFIG_PINNED=PASS`, `APP749_QA_APPEND_RELEASE_CREATED=PASS`, `APP749_QA_AUTH_CONFIG_AND_SCOPED_CSP_HTTP=PASS`, `APP749_QA_NEW_PAGE_AND_OLD_RECEIVER_HTTP=PASS`, `APP749_QA_HOSTING_DEPLOY=PASS`, **종료코드 0**.
- 이는 **QA Hosting 실제 파일 제공과 원본 페이지 보호가 서버 HTTP 기준 PASS**라는 증거. GitHub 코드 QA PASS #44840918896 별도 재검사 불필요. 배포 이력과 실제 PC·모바일 기능 합격은 구분.
- 여전히 `APP749_QA_FIREBASE_AUTH_APPCHECK_AND_PC_MOBILE=NOT_TESTED` 출력. 사용자가 PC/모바일에서 `https://soridraw-qa-owner-584.web.app/qa749.html` 새로고침, 맨 위 `QA Firebase 자동 연결 완료 · A/B 로그인 가능` 여부와 버튼 활성화를 확인해야 함. PASS시 기존 QA 테스트 계정 A를 PC·모바일에, B를 PC에서 로그인하여 RTDB 동일 기준 상태 수신을 확인. **B 팔로우·취소 버튼은 QA Worker 임시 활성화와 A↔B 인증 기준 PASS 전까지 누르지 않음**.
- QA Worker 원본 APP583 유지, APP749 12분 QA 전용 실검증 창 활성화/복구, A↔B 팔로우/취소와 A PC↔모바일 0→1→0 확인은 **아직 미검증**. TEST·PRODUCTION·PREVIEW/공유 사용자 데이터 변경 없음.
- GitHub `main` c6b7efe25beebdaef2e5f90293ca15615c4545e3; `preview` 4363820117100cb03bcbc44a01e127aeb5de3cf4.

## 0APP749I. CSP 서버 직렬화 불일치 검증 수정 코드 PASS / QA 실제 재배포 대기 (2026-11-21 KST)

- QA584 실제 Cloud Shell APP749 서버 공개 후 결과: `qaPageCspExact:false`만 실패하고 `htmlUnchanged`, `scriptExactlyUpdated`, `stylesheetUnchanged`, `publicConfigUnchanged`, `qaPageCspHasSelf`, `qaPageCspHasAppCheck`, `receiverCspUnchanged`, `receiverHtmlUnchanged`, `configValid`, `configWebAppExact`는 모두 true. `APP749_QA_OLD_HOSTING_ROLLBACK_COMMAND=PASS` + 종료코드 2. 실제 QA 로그인 PASS 아님.
- 이 결과만으로 원문 문자열과 의미가 동일한지 확정하지 않음. Firebase Hosting 겹치는 헤더 규칙 및 CSP 응답 직렬화 차이 가능. 기존 검사는 CSP 값을 문자 하나까지 동일하게 비교하여 거부; **필요한 접속 출처가 존재하는지만 확인해서 통과시키는 완화는 금지**.
- PR #1294 squash main `89857fe5bd1dc19aba467cc33e0ca8e272ef7585` 소스 검사 [Actions #44840918896] **SUCCESS**. 변경은 `scripts/app749-qa-hosting-scoped-csp.mjs` + 기존 대상 모의 테스트 2파일. CSP 지시어·허용 출처의 **전체 집합과 중복 여부**를 비교, 순서·공백 차이만 허용. 누락/추가 외부 주소/둘 이상의 CSP 정책/구형 글로벌 헤더는 모두 실패+원본 QA 릴리스 복구. 결과에 `qaPageCspSafeEquivalent` 및 안전한 불일치 유형을 표시; raw 정책·비밀번호·토큰 출력 없음. 기존 HTML/JS/CSS/config/루트 보호는 그대로.
- **HOLD:** GitHub 병합 ≠ 실제 Hosting 재배포 ≠ 브라우저 로그인·A/B 실팔로우 PASS. 디렉터 Cloud Shell에서 main SHA 고정 코드를 내려받아 QA584만 `--check` → `--deploy` 1회 확인 필요. 실패 시 재실행 금지, `APP749_QA_POST_RELEASE_DIAGNOSTIC`의 `qaPageCspComparison`으로 다음 원인 판단. 공유 사용자 데이터·PREVIEW/TEST/PRODUCTION 변경 없음. `preview` HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4` 보호.

## 0APP749H. QA584 진단 결과 확보, 마지막 HTTP 스모크 실패 항목 구분 코드 PASS / 실 QA 미배포 (2026-11-21 KST)

- 디렉터가 이미 실행한 QA584 읽기 전용 진단 사진: 종료코드 `0`, `APP749_QA_READONLY_NO_WRITE=PASS`. 현재 활성버전 `e7bfc3a27e9ebe49`은 기존 전역 CSP 규칙 하나, 직전 실패 후보 `7a8b790e9f3449f`에는 기존 `glob:**` 규칙과 신규 `glob:/qa749.html` 전용 CSP 규칙 2개. 기존 루트와 QA749 공개 응답은 원본 CSP(해시 `66dd3d5dc2e4b4`)이고 QA App Check와 'self' 접속은 여전히 차단. **이는 롤백 후 라이브 응답이므로 실패 후보가 활성화돼 있을 때 어떤 CSP 헤더가 서비스됐는지는 보여주지 않음.**
- 반복 진단 요청 금지: 사용자에게 `diagnose-qa.mjs`를 재실행하라고 다시 안내하지 않는다. 기존 스크립트의 `APP749_QA_HOSTING_HOLD_QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE`는 HTML/JS/CSS/QA Config/루트/CSP를 한 boolean으로 합쳐서 **실패 원인별 분리가 불가**했던 것이 직접적 가시화 결함.
- PR #1293 main squash `ebb6ef862dfd2e7f2728cbfe8034f35614cc0183` 병합; Actions #44839479440 QA 오프라인 **SUCCESS**. `scripts/app749-qa-hosting-scoped-csp.mjs`는 QA 공개 직후 원본 불변·새 JS 정확성·QA CSP 정확성/접속 허용 여부·QA 설정 파일 원본·루트 HTTP를 개별 boolean으로 구분해 출력 `APP749_QA_POST_RELEASE_DIAGNOSTIC`하고, 실패 시 기존 원본으로 rollback 유지. 에지 반영 최장 약 30초(15회 제한), 테스트에서만 즉시 실패 모의. CSP 미반영·JS 구버전 실패 원인을 각각 확인하고 원복 PASS.
- **현재 FAIL/HOLD 유지:** 이 수정 코드는 GitHub에만 저장, QA584 Hosting에는 재배포하지 않음. APP749 실제 로그인, App Check 실토큰, B 팔로우/취소, A PC↔모바일 자동 수신·서버 원복은 미검증. 추가 QA 라이브 변경은 현장 실패 체크포인트와 승인 범위 확인 후 단일 제한 실행. PREVIEW/TEST/PRODUCTION/공유 DB/원본 데이터 변경 없음. `preview` HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4` 보호.

## 0APP749G. QA749 scoped CSP 실제 Hosting 재배포 스모크 FAIL / 원본 롤백 명령 PASS (2026-11-21 KST)

- 디렉터 Cloud Shell 사진: `scripts/app749-qa-hosting-scoped-csp.mjs --check && --deploy`에서 `APP749_QA_ORIGINAL_RELEASE_AND_FILES_PINNED=PASS`, `APP749_QA_SCOPED_CSP_CONFIG_PINNED=PASS`, `APP749_QA_APPEND_RELEASE_CREATED=PASS` 후, `APP749_QA_OLD_HOSTING_ROLLBACK_COMMAND=PASS`, `APP749_QA_HOSTING_HOLD_QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE`, 종료코드 `2`.
- 공개 요청은 성공했지만 **최종 QA 웹 HTTP 검증은 FAIL**. 본 스크립트는 `/qa749.html` 페이지의 CSP exact-value, `/qa749.js` 최신 본문 포함, 기존 CSS·공개설정·원본 루트·원본 CSP를 하나의 `smoke` boolean으로 검사하므로 **이 출력만으로 어떤 항목이 실패했는지 확정할 수 없음**. 동일 스크립트 무재실행. 원본 버전 롤백 API 응답만 PASS; 실제 현재 live 버전과 CSP/파일은 별도 읽기 전용 확인 필요.
- Firebase Hosting 헤더 규칙 적용 순서·전역 규칙 중복·CDN 전파와 예상 CSP 문자열 차이 가능성을 우선 조사. 브라우저 서명 로그인과 PC↔모바일 팔로우/취소 실검증은 여전히 시작 전.
- QA584 전용 과거 릴리스/버전 설정과 현재 HTML·JS CSP를 **GET만** 읽어 비교하는 `scripts/diagnose-749-qa-rollback-config-readonly.mjs`를 GitHub 진단 브랜치 `diagnose/app749-last-release-csp-readonly` commit `4fc85e6a3e56aace3244e49bad00c79ab33b1335`에 준비. QA Cloud Shell의 기존 인증만 재사용하며 계정 정보·키·원문을 출력하지 않음. 진단 결과 확인 전 재배포·공유 서버/보안 설정 변경 금지.
- 운영·TEST·PRODUCTION·공유 D1/R2/RTDB/Auth 데이터 변경 없음. GitHub `main` QA 코드 PASS와 실제 QA Hosting FAIL을 구분.

## 0APP749F. 실제 QA584 브라우저 CSP 원인 확정 + QA749만 허용한 수정 소스 검사 PASS / 사이트 재배포·실기기 미완료 (2026-11-21 KST)

- 사용자 제공 실브라우저 스크린샷: QA 화면 스타일은 정상이나 `QA Firebase 자동 연결 실패`, A/B 로그인 버튼 비활성. 사용자 로그인 암호 원인으로 보고하지 않음.
- 서버에서 **QA584 공개 URL 읽기 전용** 실측: Actions #44835235065 `/qa749.html`, `/qa749.js`, `/qa749.css`, `/qa749-config.json` 모두 200, repo source 일치. QA 전용 config 프로젝트·앱 ID·API Key·도메인·DB field PASS. `/__/firebase/init.json`은 DB URL이 QA 전용과 불일치.
- 별도 실제 응답 CSP 검증 Actions #44835491970: HTML `default-src 'none'`; `connect-src`에 `'self'`, Firebase App Check 서버, QA Worker가 빠져 있고 `script-src`에는 Google reCAPTCHA가 없음. **파일이 존재하더라도 브라우저 fetch가 CSP로 차단됨**. 기존 자동 초기화가 두 소스를 폭넓게 묶어 모든 실패를 같은 문구로 표시하므로 진단이 지연됨.
- PR #1292 main squash `cbe3ae6eaf08df3a262211b742cf24c09445a197` 소스 병합. QA client는 QA 전용 `/qa749-config.json`만 사용, 파일 HTTP·형식·프로젝트 불일치·Auth 초기화 실패를 구분 표시. Auth 로그인 준비와 App Check 준비는 분리하지만 **서명 없는 Worker 요청은 절대 허용하지 않음**.
- `scripts/app749-qa-hosting-scoped-csp.mjs`: 기존 QA584 원본 Hosting live 리비전·모든 파일/설정/RTDB·앱 소유자·원본 수신 페이지를 보존. `/qa749.js` 한 파일과 `/qa749.html` 경로 하나에만 지정된 접속 허용 CSP를 추가; 기존 `default-src 'none'`/CSS 정책을 유지. 새 버전 조립 후 원본 수신 페이지 CSP 불변, QA749 CSP 반영, 기존 HTML/CSS/config/루트 파일 불변을 실제 HTTP로 검사하고 실패 시 기존 릴리스 복구. 공유 RTDB/IAM/Worker/TEST/PRODUCTION/PREVIEW 수정 없음.
- GitHub Actions #44836342302 **offline QA PASS**: CSP 원인 재현, path-only 허용 목록, 원본 수신 페이지 보호·실패 rollback·기존 APP749 signed auth/APP730 호환. 임시 QA Worker 검증 미수행. 진단용 PR #1291은 **읽기 결과 확보 후 closed (미병합)**.
- **현재 HOLD:** GitHub 소스 검사 PASS만 기록. **새 CSP·JS의 QA584 실제 Hosting 배포는 아직 실행되지 않음**. QA 실제 A/B 로그인·App Check 토큰, 팔로우/취소와 PC↔모바일 자동 수신, 원본 APP583 Worker 복구는 여전히 미검증. QA 전용 Cloud Shell 안전한 기존 프로세스에서 스크립트 `--check`→`--deploy` 수행 후 반드시 실제 브라우저 상태 확인. 공유 데이터/운영·TEST/PRODUCTION 변경 금지.
- main `cbe3ae6eaf08df3a262211b742cf24c09445a197`, preview `4363820117100cb03bcbc44a01e127aeb5de3cf4` 유지.

## 0APP749E. QA 로그인 화면 스타일·자동설정 보정 코드 PASS / QA584 적용 대기 (2026-11-21 KST)

- 사용자 실기기 `/qa749.html`에서는 새 외부 CSS가 브라우저에 적용되지 않아 기본 흰색 화면, Firebase `/__/firebase/init.json` 자동 조회 실패로 로그인 버튼 비활성, "QA Firebase 공개 설정 직접 입력" 표시. 최초 HTML 내 CSS는 실제 어두운 디자인으로 표시된 증거가 있음. 원본 QA Hosting 설정/보안 규칙/비밀번호 문제로 단정하지 않음.
- PR #1290 squash main `16dc50e5ce049723fc3b2afa34843fd72a36781e` 소스 병합. 기존 QA 화면에서 정상 표시됐던 CSS 내용을 HTML 안에 그대로 복원하고 JavaScript는 same-origin `qa749.js` 외부 실행 유지(CSP 변경 없음). 수동 설정 입력 UI 제거.
- 코드에서 Firebase 공개 설정은 `/__/firebase/init.json` 후 동일 출처 `/qa749-config.json`으로 가져옴. QA584 Hosting 보정 스크립트는 **Cloud Shell의 이미 로그인된 계정으로 QA Firebase Management API webApps.list/getConfig에 GET 2건만 사용**하여 `SORIDRAW-QA` Web App 고유 앱 ID, 프로젝트 `soridraw-app`, 프로젝트 번호, API Key 및 Auth 도메인을 확인하고 QA-only 웹 공개 설정만 QA584 웹 리소스에 추가. 어떤 비밀번호·Firebase Auth/AppCheck 토큰도 저장하지 않음.
- `scripts/app749-qa-hosting-fix-ui-init.mjs`: 실제 QA584 원본 인덱스, 현재 QA749 HTML·JS·CSS 해시/설정 확인 → 변경된 HTML·JS + `qa749-config.json` 총 3파일만 신규 버전에 반영 → HTTP 확인 실패 시 기존 릴리스 자동 원복. 기존 사용자 데이터·공유 D1/R2/RTDB·프로덕션/TEST 변경 없음.
- QA 오프라인 CSS·자동설정·원본 보존·안전 롤백 검사 [Actions #44834072585] **SUCCESS**. **GitHub PASS≠실제 QA Hosting 배포 PASS≠A/B 인증 PASS**. 아직 Cloud Shell로 이 수정본 미배포·PC 모바일 팔로우 수신 미확인.
- 다음: 이미 열린 QA Cloud Shell에서 commit `16dc50e5ce049723fc3b2afa34843fd72a36781e` 기준 보정 스크립트와 `qa749.html`/`qa749.js`/`qa749.css`를 가져와 `--check` 뒤 QA584만 `--deploy`. 실패하면 코드 재실행 금지, 화면/명령의 오류 코드로 원인 수정. QA 사이트 외 변경 금지. `preview` HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4` 보호.

## 0APP749D. QA584 CSP 수정 Hosting 실배포 PASS / 실제 A·B 로그인·PC 모바일 수신 미검증 (2026-11-21 KST)

- 디렉터가 QA 전용 Cloud Shell에서 `scripts/app749-qa-hosting-repair-csp.mjs --check && --deploy` 직접 실행한 결과 사진 확인: `APP749_QA_SITE_EXISTING_RECEIVER=PASS`, `APP749_QA_ORIGINAL_RELEASE_AND_FILES_PINNED=PASS`, `APP749_QA_NO_HOSTING_CHANGES=PASS`, `APP749_QA_CLONE_CONFIG_EXACT_ORIGINAL=PASS`, `APP749_QA_APPEND_RELEASE_CREATED=PASS`, `APP749_QA_NEW_PAGE_AND_OLD_RECEIVER_HTTP=PASS`, `APP749_QA_HOSTING_DEPLOY=PASS`, 종료코드 `0`.
- 이 PASS는 **실제 QA Hosting의 `/qa749.html`, CSP 대응 `qa749.js`/`qa749.css` 공개 및 기존 수신 사이트 보호가 서버 HTTP 기준 성공**했다는 뜻. 브라우저 JS 실행·Firebase SDK 로딩·A/B 실제 로그인·App Check 실토큰·PC↔모바일 자동 수신 PASS는 아직 아님.
- 다음 순서: PC에서 `https://soridraw-qa-owner-584.web.app/qa749.html` 강력 새로고침 후 `QA Firebase 연결 준비 완료` 문구·A/B 버튼 활성화 확인 → PC A/B 및 모바일 A 로그인 확인 → 기존 QA Worker 12분 임시 검증 창만 실행 → B 팔로우·취소 시 두 기기 A의 RTDB 실시간 수신 → APP583 정확 원본 자동 복구 확인. 상태 실패 시 재배포 반복 금지; 페이지 상태 메시지로 정확한 원인 판정.
- 기존 QA 사용자 데이터·원본 사용자 정보·TEST·PRODUCTION·PREVIEW/공유 D1/R2/RTDB 변경 없음. `main` 소스 기준 2bccef4e2d24b806d1ec0398e53961ed09ebee08; `preview` 기준 4363820117100cb03bcbc44a01e127aeb5de3cf4.

## 0APP749C. QA584 브라우저 CSP 차단 원인 확인·수정 코드 PASS / 실페이지 재배포 대기 (2026-11-21 KST)

- 디렉터 QA Cloud Shell 현장 출력에서 `APP749_QA_HOSTING_DEPLOY=PASS`, `APP749_QA_NEW_PAGE_AND_OLD_RECEIVER_HTTP=PASS`, 종료코드 0 확인. **QA584 `/qa749.html` 초기 배포와 기존 수신 페이지 보존은 실제 PASS**. 운영·TEST/PRODUCTION 변경 없음.
- 그러나 실제 PC 화면의 `QA Firebase 연결: QA 설정 확인 중…` 및 로그인 버튼 비활성. 제공받은 61초 브라우저 영상에서 Chrome DevTools Issues의 정확한 오류: `Content Security Policy blocks inline execution of scripts and stylesheets`, `qa749.html:48` inline module blocked. 비밀번호·Firebase App Check 문제가 아닌 **QA HTML inline module 구조 오류**로 확인; 실제 로그인 시도 0, RTDB 동기화 실검증 0.
- PR #1289 squash main `986bd90c5ef0a75dc7e72a78ea24511f8d2fbf1e`. QA749 inline JS/CSS를 정확한 QA584 동일 출처 `qa749.js`/`qa749.css`로 분리. 외부 Firebase SDK 실패 시 상태 메시지 표시. 기존 CSP를 해제·완화하지 않음.
- `scripts/app749-qa-hosting-repair-csp.mjs`: **기존 live QA584 버전을 그대로 clone**, live `/index.html` 파일·serving config를 보존하고 기존 고장난 `/qa749.html`만 교체 + 새로운 JS/CSS 두 파일만 추가. live HTML gzip hash 및 clone 파일/serving config/리비전 비교, 예상 외 기존 상태·설정 변경 시 중단, 실패 시 QA584 원본 릴리스 복구. 독립 `--check`는 읽기 전용.
- APP749 CSP 수정 코드/원본 QA584 Hosting 보존/실패 시 복구 **GitHub offline 검사** [Actions #44832267611] SUCCESS. 기존 APP749/Auth와 APP730 호환 PASS를 불필요하게 재검사하지 않음.
- **HOLD/다음 실행**: 사용자 QA Cloud Shell에서 새 CSP repair 스크립트/JS/CSS/HTML을 내려받아 `--check` → `--deploy` 수행해야 함. **수정한 3개 파일의 실제 Hosting 배포는 아직 없음.** QA A/B 로그인 성공, App Check 실토큰, RTDB A 수신 PC↔모바일, 검증 창/Worker APP583 원복은 모두 아직 미검증. QA Worker는 변경 전 APP583 원본 상태. 새 환경·사용자 데이터·IAM 변경 불허.

## 0APP749B. QA584 실제 A/B Firebase 로그인·App Check·실시간 수신 화면 구현 / 소스 병합, 실배포 미완료 (2026-11-21 KST)

- 승인된 기존 QA-only 팔로우 자동 수신 실검증 후속. 새로운 Firebase QA 웹 App Check Fraud Defense 등록은 디렉터가 Firebase Console에서 확인(등록됨), reCAPTCHA Enterprise 키는 QA584 도메인 한정. 이 등록만으로 실제 로그인/팔로우 PASS 아님.
- PR #1285 main squash merge `23d33cc99684fc2e47ebb7a5bd8668ac7bce1be2`; `preview` 기준 `4363820117100cb03bcbc44a01e127aeb5de3cf4` 불변. QA 코드 외 제품 UI/TEST/PRODUCTION 변경 없음.
- `cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs`: 기존 APP749 signed Firebase Auth/App Check 검증을 유지하고 QA584 정확한 `https://soridraw-qa-owner-584.web.app` Origin에 한하여 OPTIONS/CORS 허용. 합성 probe/token-only 우회, 다른 Origin, 공유 D1/R2 바인딩 허용 금지.
- `qa/app749/qa749.html`: 기존 QA584 index를 덮지 않는 신규 시험 화면. QA Firebase Web SDK로 기존 A·B 로그인(인메모리), QA App Check 서명 토큰 발급, QA A RTDB `onValue` 단일 수신, B의 signed follow/unfollow 1회씩, A/B 서버 확정/RTDB 0→1→0 확인. 인증정보·비밀번호·토큰 저장/출력 금지. PC/모바일 실기기 동작은 별도 확인 필요.
- `scripts/app749-qa-hosting-add-page.mjs`: 기존 QA584 Hosting live 버전을 Firebase Hosting REST API `versions:clone`으로 그대로 복제하고 `/qa749.html`만 추가하는 QA 전용 Cloud Shell 스크립트. 버전·기존 파일/Config 보존, 동시 릴리스 충돌 차단, 원본 HTTP 보호, 실패 시 기존 버전 재릴리스. `--check`는 읽기 전용, `--deploy`는 QA584 Hosting에만 작성. 테스트 로컬/모의 기능, 실제 Hosting API 실행은 아직 아님.
- 신규 코드·기존 APP730 호환 실행형 검사: Actions #44803481529, #44803481526 **SUCCESS**. 기존 APP749 원본 Worker 회복 PASS [#44771635185] 재사용. main 저장 성공 ≠ QA Hosting 배포 성공 ≠ 실제 로그인 성공.
- QA 실기기 검증을 위한 기존 `.github/workflows/app749-qa-real-auth-offline.yml`의 **추가 QA 전용** `/app749-qa-browser <mainSHA>` 실행 창을 main `8f56fe3c479726ee3cdac7c53dcda05ad1ff99b2`에 반영. GitHub owner 명령 + 정확한 main SHA + 기존 QA 원본/바인딩 확인 후 12분간 QA749만 임시 활성화, 종료·실패 시 APP583 자동 원복. QA 사이트가 실제 배포되고 A/B 로그인 준비되기 전에는 창을 열지 않음. Worker 물리 실행 및 PC/모바일 PASS 미검증.
- **미완료/HOLD:** 사용자 기존 QA Cloud Shell에서 `--check` 확인 후 QA584에 별도 페이지를 append 배포해야 함. 여기서는 Cloud Shell에 원격 명령을 직접 입력할 수 없고 실제 QA Hosting/Cloudflare 배포 미실행. QA749 Worker는 원본 APP583 100% 상태. 기존 A·B QA 암호/실토큰 및 실기기 PC↔모바일 미확인. APP749 잠깐 활성화/자동 원복은 QA B 토큰을 쓸 준비가 된 때 기존 승인 QA 경로만 사용. TEST/PRODUCTION/공유 DB/원본 사용자 데이터 변경 금지.

## 0APP749. 실제 Firebase Auth·App Check QA 전용 검증 경로 / 임시 활성화·원본복구 PASS (2026-11-21 KST)

- 디렉터 승인 범위: PR #1284 병합 및 기존 격리 QA Worker에만 실제 서명 토큰 검사 경로 임시 활성화. TEST/PRODUCTION/공유 사용자 데이터 변경 금지.
- PR #1284 main 병합 commit `d74d834f64059bdf874ac9179c033cf4b3f06fb6`; QA HTTP 검사 수정 main `7387f872da4e9934462273c4f7984c2bb791629e`; preview HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4` 불변.
- 실제 Firebase App Check 원본 JWT에는 `app_id` 필드가 없고 `sub`가 App ID임을 공식 규격으로 확인해, 이전 synthetic mock false-green을 수정. QA signed Auth/AppCheck RS256 검증 + QA project/UID 고정, 다른 프로젝트/만료/위조 토큰 거부, 기존 APP583/APP730 경로 보존.
- 변경 전 오프라인 APP749 검증 [Actions #44770940492] SUCCESS, 기존 APP732 호환성 [#44770940547] SUCCESS.
- 1차 격리 QA 실서버 [#44771242688]: 신규 버전 업로드·활성화 PASS, 즉시 403 응답 검사는 구/신 응답 여부를 분리하지 못해 FAIL. 하지만 APP583 100% 복구 명령과 최종 실제 HTTP 확인 PASS. 이 실패를 보안 PASS로 취급하지 않음.
- HTTP 검사를 좁혀 구버전 403 응답 전파와 실제 인증 우회를 구분하도록 수정. 403 외 응답 또는 ok:false 부재는 즉시 FAIL. 2차 격리 QA 실서버 [Actions #44771635185] **SUCCESS**: 기존 APP583 original100 + QA bindings preflight PASS → APP749 새 버전의 QA 전용 5개 바인딩/공유 D1·R2 없음 PASS → 정확한 새 QA 버전 임시 100% PASS → 실제 무인증/합성 probe만 요청 3건 모두 HTTP 403·QA749 서명 경계 차단 PASS → 기존 APP583 경로 보존 PASS → historical APP583 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 원복 PASS → 원본 버전·바인딩·실제 HTTP PASS.
- **QA Worker 현재 상태는 기존 APP583 100% 복구**. 신규 APP749는 서버에서 더 이상 활성화돼 있지 않음. 자동 복구 완료 및 QA 외 환경 배포 0. 검증 과정의 HTTP 거부 요청으로 QA RTDB/DO 사용자 변경 0.
- **HOLD**: QA 프로젝트에서 실제 발급된 A·B Firebase Auth ID token + 유효한 App Check token을 이용한 `/qa730/verified/follow` 및 취소/QA RTDB PC↔모바일 실검증은 수행하지 못함. GitHub에는 실제 QA 토큰·Cloud Shell 자격증명이 없고 QA Worker는 임시 활성화가 종료된 상태. 기존 APP748 synthetic 503→DO retry→QA Functions/RTDB v9/1→v10/0 PASS와 혼동 금지. 실제 Firebase Auth 토큰 폐기 여부·App Check 실제 발급, 실기기 PC·모바일 아직 미검증.
- 다음 안전 단계: QA Cloud Shell에 기존 QA A/B 실제 Firebase Auth/App Check 토큰을 **기밀을 채팅/GitHub에 공개하지 않는 방식으로** 준비할 수 있는지 확인. QA 전용 허용 경로에서만 한 번의 제한된 인증·팔로우/취소·RTDB 검증 후 APP583 자동 복구. 새로운 QA 계정 생성·App Check 설정·IAM 변경이 필요하면 별도 승인 전 실행 금지. TEST/PRODUCTION, 공유 D1/R2/RTDB·사용자 원본 변경 금지.

## 0RQ. follow W1~W2 shared schema 적용 + PREVIEW rollback-safe Worker 배포 완료 / cutover OFF (2026-10-07 KST)

실제 완료:
- 사용자 승인 후 shared canonical D1 `soridraw-explore-db`에 dormant follow overlay schema를 additive 방식으로 적용.
- Shared D1 Release Run `37582930962`: **SUCCESS**.
- 적용 객체:
  - `explore_follow_overrides_348`
  - `idx_explore_follow_overrides_348_reverse`
  - `explore_follow_cutover_control_348`
- 적용 전 세 객체 모두 ABSENT였고, postflight에서 exact schema PASS.
- user row rewrite/backfill/delete/copy 0.
- runtime follow overlay activation 0.
- D1 schema 적용 뒤 PREVIEW/TEST/PRODUCTION Feed smoke PASS.
- D1-only release 동안 Worker version 변경 0 / main·production ref 변경 0.

PREVIEW Worker:
- rollback-safe follow378 source를 PREVIEW Worker에 cutover-OFF 상태로 배포.
- PREVIEW Worker Release Run `37583095947`: **SUCCESS**.
- 이전 PREVIEW Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- 현재 PREVIEW Worker `cf78f8cb-a108-4362-a6e7-a0c90eff12a0`.
- canonical Worker SHA256 `43b71e2892cbade0ce33911b7157286bd4c84eb7b516575769130412df34e673`.
- Worker341 legacy follow parity PASS.
- app377 actorFollowingCount no-extra-D1 PASS.
- Feed / curated / public profile / profile tracks / genre read smoke PASS.
- TEST Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65` unchanged.
- PRODUCTION Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7` unchanged.
- follow lifecycle flag / shared R2 cutover manifest / D1 control row activation은 아직 OFF.

중요 새 확인:
- `DB`와 `PROFILE_MEDIA`는 PREVIEW/TEST/PRODUCTION이 같은 shared canonical resource를 사용한다.
- follow cutover manifest key도 shared `PROFILE_MEDIA`의 동일 authority key다.
- 따라서 shared overlay relation을 실제로 활성화하면 PREVIEW에서 생긴 follow 변경을 TEST/PRODUCTION도 같은 canonical 상태로 읽어야 하므로 **PREVIEW만 따로 authority를 켜는 방식은 허용할 수 없음**.
- 현재 TEST/PRODUCTION active Worker는 protocol354/355 active-overlay 호환은 있지만, 이번 378 rollback-safe one-way lifecycle source는 아직 배포되지 않음.
- 이 상태에서 shared authority를 먼저 켜면 정상 active path는 읽을 수 있어도 manifest loss/corrupt emergency path에서 구 Worker가 immutable legacy로 fallback할 수 있으므로 activation 금지.
- emergency readonly manifest만으로는 구 Worker read parity까지 보장되지 않으므로 우회 금지.

현재 결론:
- shared schema apply: PASS / 완료.
- PREVIEW compatibility Worker deploy: PASS / 완료.
- 실제 follow W1~W2 shared authority activation: **아직 OFF**.
- 실제 shared PREVIEW physical W1~W2 측정: **activation 전이라 미실행**.
- 다음 안전 조건은 TEST/PRODUCTION active Worker도 378 rollback-safe authority reader를 이해하도록 compatibility를 먼저 승격하는 것.
- TEST/PRODUCTION 실제 Worker 변경은 기존 승격 규칙대로 별도 승인 없이 실행 금지.
- full user-data foldback/migration/backfill은 여전히 금지.

## 0RP. follow W1~W2 rollback-safe authority source 구현 + 전체 audit PASS (2026-10-07 KST)

현재 결론:
- app377 팔로우 숫자/목록/PC↔모바일 정합성은 사용자 PASS 기준 그대로 동결.
- 기존 blocker였던 “overlay 변경 후 manifest OFF 시 legacy baseline으로 잘못 복귀” 문제를 PREVIEW source에서 해결.
- one-way authority latch + emergency overlay-readonly를 추가하여, 한 번 overlay authority가 실제 활성화된 뒤에는 legacy relation authority로 자동 하강하지 못하게 함.
- pre-cutover/cutover-OFF에서는 기존 legacy 경로와 비용을 유지하며, **manifest 없음 상태 추가 D1 read 0**을 실행형 검사로 고정.
- healthy overlay manifest도 추가 D1 latch read 0.
- manifest missing/corrupt 예외에서만 D1 one-way latch를 읽고, 이미 활성화된 authority면 effective overlay read를 유지하면서 새 follow/unfollow mutation만 fail-closed.
- old Worker가 readonly manifest를 overlay-active로 오인하지 않도록 readonly relationMode는 별도 fail-closed 계약으로 분리.
- shared D1 schema/apply, R2 cutover manifest, 실제 overlay activation은 아직 실행하지 않음.

구현 commit:
- source commit `572249ce4e04a41095bcf764e0d3de7649ac2842`: rollback-safe authority 1차 구현.
- safety refinement commit `7d0f9b38798e066b83f9842c8397866b761447bd`:
  - pre-cutover missing manifest D1 R0 유지.
  - lifecycle feature flag 없이는 기존 legacy exact behavior.
  - emergency readonly manifest는 old Worker가 fail-closed 하도록 별도 relationMode.
- audit trigger commit `0ba04c6ab49560640c567ec5b07e03fbd6b728fb`.
- canonical PREVIEW Worker source SHA256 `43b71e2892cbade0ce33911b7157286bd4c84eb7b516575769130412df34e673`.

변경:
- `cloudflare/explore-worker/canonical/preview-worker.js`
  - `readFollowCutoverControl348` one-way latch fallback.
  - `readFollowCutoverState348` zero-cost pre-cutover + active/read-only authority lifecycle.
  - `handleFollowR2Core` / `handleFollowOverlay354` / orchestration에서 readonly mutation fail-closed.
- `cloudflare/explore-worker/candidates/348-follow-overlay.sql`
  - candidate-only `readonly` phase.
  - active/readonly → legacy/armed downgrade 차단 trigger.
  - active/readonly control row 삭제 차단 trigger.
- follow 348/349/354/356/378 verifier 보강.

최종 Audit:
- Release System Audit Run `37579261599`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- static release audit PASS.
- TEST + PRODUCTION Worker dry-run PASS.
- PREVIEW / TEST / PRODUCTION current active Worker protocol354/355 compatibility PASS.
- live shared follow D1 SELECT-only preflight PASS / shared D1 write 0.
- deployment 0.

핵심 verifier:
- `FOLLOW378_PRECUTOVER_MISSING_MANIFEST_D1_R0=PASS`.
- `FOLLOW378_HEALTHY_MANIFEST_D1_LATCH_R0=PASS`.
- `FOLLOW378_MISSING_OR_CORRUPT_MANIFEST_RECOVERS_READONLY_OVERLAY=PASS`.
- `FOLLOW378_BASELINE0_FOLLOW1_EFFECTIVE=PASS`.
- `FOLLOW378_BASELINE1_UNFOLLOW0_EFFECTIVE=PASS`.
- `FOLLOW378_ONCE_ACTIVE_CANNOT_DOWNGRADE_OR_DELETE_LATCH=PASS`.
- `FOLLOW378_READONLY_NEW_MUTATION_FAILS_BEFORE_LEGACY_OR_RATE_WRITE=PASS`.
- `FOLLOW378_READONLY_MANIFEST_OLD_WORKER_FAIL_CLOSED_CONTRACT=PASS`.
- `FOLLOW378_CUTOVER_ACTIVATION_BLOCKER=RESOLVED_SOURCE_ONLY`.
- Worker341 legacy counter/post-sync parity PASS.
- protocol354 crash/retry/order/duplicate tests PASS.
- app377 actorFollowingCount no-extra-D1 PASS.
- user/shared DB deployment data change 0.

비용 근거:
- fixture HTTP path: new follow relation D1 change 1 row / unfollow 1 row / duplicate 0 / same-state 0.
- 기존 isolated remote physical proof는 follow W2 / unfollow W1 / duplicate W0 / same-state W0 유지.
- 실제 shared PREVIEW overlay를 아직 켜지 않았으므로 **live PREVIEW physical W1~W2는 아직 미검증**.

보호/비변경:
- app377 count/list/persistent follower/following cache/RTDB PC↔mobile signal 변경 없음.
- 좋아요 / 공개·비공개 / Music Note / Library / profile UI/CSS 변경 없음.
- shared D1 user data migration/backfill/copy/delete/rewrite 0.
- Firebase / Functions / Rules / Hosting 변경 0.
- TEST/PRODUCTION 실제 배포 변경 0.

다음 gate:
1. 현재 commit을 독립 검증 기준으로 고정.
2. shared D1 additive overlay348 schema 적용 + lifecycle/cutover는 **실제 shared backend 변경**이므로 별도 승인 후 진행.
3. 승인 후에도 순서는 schema additive 적용 → 모든 환경 read compatibility 재확인 → PREVIEW-only active manifest → 실제 follow/unfollow physical D1 W1~W2 측정.
4. W3+ / count mismatch / membership mismatch / permission/public-profile mismatch가 하나라도 나오면 즉시 activation 중단하고 overlay-readonly로 fail-closed.
5. PREVIEW 실기기 PC↔mobile까지 PASS해야 TEST 판단.

## 0RO. follow W1~W2 전환 전 롤백 안전성 BLOCKER 실증 / shared cutover 계속 OFF (2026-10-07 KST)

현재 판단:
- app377 팔로우 숫자/목록/PC↔모바일 정합성은 사용자 PASS 기준 그대로 동결.
- protocol354/355 저비용 후보 자체와 all-environment active Worker 호환성은 read-only 감사에서 PASS.
- 그러나 **overlay가 한 번 실제 관계를 변경한 뒤 manifest를 제거/비활성화하면 runtime이 legacy `follows`로 되돌아가 변경된 관계를 무시할 수 있음**을 실행형 verifier로 재현.
- 따라서 shared follow cutover 활성화는 **one-way authority 또는 overlay-readonly rollback**이 먼저 구현·감사되기 전까지 BLOCKED.

Read-only readiness 근거:
- Audit Run `37574090023`: SUCCESS.
- PREVIEW active Worker `f3a305cc-72ef-49da-94ec-d2b00db8ea47`: protocol354/355 markers PASS.
- TEST active Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`: protocol354/355 markers PASS.
- PRODUCTION active Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7`: protocol354/355 markers PASS.
- shared canonical D1의 follow overlay 348 schema는 현재 **ABSENT / NOT_APPLIED**.
- shared D1 write 0 / Worker deploy 0 / Hosting deploy 0 / Functions deploy 0 / RTDB Rules deploy 0.

Rollback blocker 실증:
- verifier commit `8549ded75d56fce8b09cac57b3637d1e17bdf1fe`: `scripts/verify-378-follow-rollback-blocker.mjs`.
- release audit hard gate commit `815398f93164c9c00ac55ac3c4542fd719677107`.
- read-only audit source/trigger `06d982756552ce6e3e56ecf0250646a3df535fd9`.
- Audit Run `37576098525`: **SUCCESS**.
- `FOLLOW378_OVERLAY_EFFECTIVE_STATE_DIFFERS_FROM_IMMUTABLE_BASELINE=PASS`.
- `FOLLOW378_MISSING_MANIFEST_FALLS_BACK_TO_LEGACY=PASS`.
- `FOLLOW378_D1_CONTROL_NOT_RUNTIME_LATCH=PASS`.
- `FOLLOW378_MANIFEST_REMOVAL_AFTER_OVERLAY_MUTATION=UNSAFE_REPRODUCED`.
- `FOLLOW378_SHARED_USER_DATA_WRITE=0`.
- `FOLLOW378_CUTOVER_ACTIVATION=BLOCKED_UNTIL_ONE_WAY_OR_READONLY_ROLLBACK`.
- 같은 Run에서 TypeScript / Build / follow 347~378 / TEST+PRODUCTION Worker dry-run / live shared D1 SELECT-only preflight / no-deploy gate PASS.

왜 중요한가:
- overlay 348은 기존 `follows`를 immutable baseline으로 두고 변경된 edge만 overlay에 기록한다.
- 현재 `readFollowCutoverState348`은 R2 manifest가 없으면 `legacy`로 돌아가며 D1의 `explore_follow_cutover_control_348`을 runtime latch로 읽지 않는다.
- 따라서 실제 overlay 변경 이후 단순 manifest OFF 또는 구형 legacy-only rollback은 기능 롤백이 아니라 **사용자 팔로우 상태를 과거 baseline처럼 보이게 만드는 정합성 오류**가 될 수 있다.
- 과거 Worker341 rollback은 overlay authority가 OFF였기 때문에 안전했던 것이며, post-cutover rollback 증거로 사용할 수 없다.

다음 설계 고정:
- 정상 overlay 상태에서 steady-state마다 D1 latch를 읽게 만들지 않는다.
- healthy R2 manifest가 정상 authority source이고, D1 control은 manifest 손상/부재 같은 예외 복구에서만 one-way latch/fallback으로 사용한다.
- overlay authority가 한 번 실제 write를 허용한 뒤에는 legacy writer/read authority로 자동 복귀 금지.
- 안전한 긴급 롤백은 **effective overlay reader는 유지 + follow mutation만 fail-closed(overlay-readonly)**가 기본.
- 완전한 legacy 복귀가 필요하면 overlay 변경분을 legacy에 합치는 별도 migration/foldback가 필요하므로 사용자 명확한 승인 없는 현재 작업 범위 밖.
- 구버전/무본문 client는 기존처럼 `FOLLOW_ORDER_REQUIRED` → protocol354 negotiation을 유지하고, readonly 상태에서는 legacy fallback 없이 실패 차단.
- schema는 additive/no-backfill 원칙 유지.

보호/비변경:
- app377 count/list/persistent cache/RTDB PC↔mobile sync 변경 0.
- 좋아요 / 공개·비공개 / Music Note / Library / profile UI/CSS 변경 0.
- shared D1 schema/migration/cutover/manifest write 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- TEST/PRODUCTION 코드·Worker·Hosting 비의도 변경 0.
- 실제 PREVIEW overlay W1~W2 live 검증은 **아직 미실행**. rollback-safe lifecycle 구현/감사 후에만 진행.

## 0RN. app377 팔로우 정합성 사용자 실사용 PASS / 비용 최적화만 남음 (2026-10-07 KST)

사용자 실사용 확인:
- app377 팔로우 숫자 / 실제 팔로워·팔로잉 목록 / PC↔모바일 동기화 정상 적용 확인.
- app377 정합성 수정은 사용자 기준 PASS로 동결.
- 이후 작업 범위는 **팔로우 mutation 비용 W14~W17 → W1~W2**만 남김.

보호:
- app377 숫자/목록/persistent list cache/RTDB cross-device sync 재설계 금지.
- 공개/비공개, 좋아요, Music Note, Library, profile UI/CSS 변경 금지.
- unchanged popup reload/reopen D1 R0 목표 유지.

다음 비용 단계:
- 기존 dormant follow overlay 348 + ordered protocol354/355 후보를 기준으로 진행.
- 이미 격리 actual D1에서 follow W2 / unfollow W1 / duplicate W0 / same-state W0 증거 있음.
- shared cutover는 아직 OFF. 실제 PREVIEW 활성화 전 all-environment compatibility / rollback / shared schema 상태를 다시 고정.
- 실제 PREVIEW에서 W1~W2와 기능 정합성이 동시에 PASS하기 전 TEST/PRODUCTION 승격 금지.
## 0RM. app377 팔로우 숫자/목록/PC↔모바일 정합성 수정 PREVIEW 배포 완료 (2026-10-07 KST)

사용자 실사용 근거:
- app376에서 실제 following popup은 2명을 보여주는데 프로필/탭 숫자는 `팔로잉 1`로 남는 불일치 확인.
- PC에서 unfollow → follow를 다시 했어도 following count가 1→2로 갱신되지 않았고, 모바일은 기존 2가 1로 내려가지 않는 반대 방향 stale count 확인.
- CACHE LIVE에서 팔로워/팔로잉 목록을 새로 불러올 때 각각 D1 R2/W0, 두 목록 합계 R4가 관찰됨. app376 목록 cache는 React mount memory-only라 새로고침 뒤 재조회가 발생하던 구조였음.

확정 원인:
- 공개 프로필 first-view count cache는 reload를 변경 신호로 보지 않는 정상 R0 구조인데, follow 변경 신호가 별도로 없어서 follower/following count가 PC↔모바일에 전달되지 않았음.
- 기존 follow HTTP 응답은 이미 D1 mutation에서 계산된 actor의 정확한 `following_count`를 가지고도 target profile count만 반환해 MY profile followingCount를 정확히 고칠 수 없었음.
- app376 follower/following popup의 first page cache가 persistent가 아니라 mount memory-only여서 browser refresh 후 같은 목록이 D1 R2로 다시 조회됐음.

app377 수정:
- Worker follow 응답에 기존 `stats.follower.following_count`를 `actorFollowingCount`로 추가. **추가 D1 query/write 0**.
- Worker341 legacy relation/counter mutation과 post-sync는 그대로 유지; response field만 additive.
- follow 성공 즉시:
  - target `followerCount` cache 갱신,
  - actor MY profile `followingCount` cache를 exact count로 갱신,
  - 개인 follow membership cache/social snapshot 갱신.
- 같은 계정 PC↔모바일은 `userSync/{uid}/exploreFollow` RTDB 1개 최신 신호로 변경된 target/count만 전달. 수신 기기는 D1/Firestore read 0으로 local cache/UI만 갱신.
- follower/following first page(최대 30명)를 persistent local cache로 저장. 변경 없는 browser refresh/재진입/팝업 재열기는 Worker 0 / D1 R0 목표.
- 실제 follow/unfollow 성공 또는 수신 signal에서만 actor following + target followers 두 cache만 무효화. 전체 목록/전체 profile 무효화 없음.
- 30명 이하 complete popup은 실제 relation rows 수를 exact count로 사용해 기존 stale profile count를 로컬에서 즉시 self-heal.
- CACHE LIVE에 persistent relation cache hit를 별도 표시.

검증:
- 1차 Audit `37568753767`: TypeScript/Build PASS. response-only field를 허용하지 않던 기존 `verify-354-follow-orchestration` exact legacy assertion으로 FAIL; 제품 오류가 아니라 verifier 계약 미갱신. 배포 0.
- verifier는 Worker341 mutation/post-sync는 계속 exact 비교하고, app377 response-only field만 normalize하도록 수정.
- 재감사 `37568966361`: SUCCESS.
- 최종 release-gate 감사 `37569220320`: **SUCCESS**.
- APP377 exact actor count response / no extra D1 PASS.
- APP377 persistent reload R0 contract PASS.
- APP377 changed-only list invalidation PASS.
- APP377 cross-device RTDB signal PASS.
- APP377 small-profile count self-heal PASS.
- Worker341 legacy counter/post-sync parity PASS.
- canonical Worker SHA256 exact match `e311f5f97160057b9f3be29d83a716bbd15f00782fd6f60ce6c447be8bfcfdc4`.
- TEST/PRODUCTION Worker dry-run PASS.

PREVIEW 배포:
- Worker source commit: `b8dfc9e6baf27c4a17eac528f38ba0525e42d568`.
- Worker release trigger: `bcb880375175095b18a0fe1f2fa0ddda25d66cc1`.
- PREVIEW Worker Run `37569420282`: **SUCCESS**.
- PREVIEW Worker before `bc8cc09e-4210-46e2-bdb7-72796e2798e4` → after `f3a305cc-72ef-49da-94ec-d2b00db8ea47`.
- feed/profile smoke PASS; warm revision D1 R0/W0 PASS; automatic rollback 없음.
- TEST Worker `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65` / PRODUCTION Worker `efb8508e-d63a-4839-a7c8-a5c89572f4c7` unchanged PASS.
- App release trigger / locked source `8f0efd593c60e9d0c8ca4795ceb674abc437cf6c`.
- Firebase PREVIEW Hosting Run `37569563139`: **SUCCESS**.
- remote `preview.soridraw.com` app version **377** / exact build PASS.
- shared RTDB Rules exact-match deploy PASS: additive `userSync/$uid/exploreFollow` only.
- Firebase Functions / Firestore Rules 변경 0.
- shared D1 schema/migration/cutover 변경 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- main(TEST) / production branches + Hosting unchanged PASS.

비용 상태:
- follower/following popup: 첫 cold list click은 기존 bounded D1 R2 가능. 이후 변경 없는 refresh/reopen은 persistent local cache로 D1 R0 목표.
- 실제 relation 변경 때만 관련 2개 list cache를 무효화하므로 다음 필요 시 해당 list만 bounded 재조회.
- cross-device count sync는 작은 RTDB signal 1개/실제 follow mutation; 수신 D1/Firestore 0.
- follow mutation 자체의 legacy physical D1 W14~W17은 **아직 해결 전**. 이번 app377은 숫자/목록 정합성과 반복 read 문제를 먼저 분리 해결한 단계이며 shared W1~W2 cutover는 여전히 OFF.

실사용 검증:
1. app377로 PC/Mobile 모두 갱신 후 MY profile following count와 popup 실제 rows가 같은지 확인.
2. PC follow → 모바일 숫자/버튼이 페이지 이동 없이 수렴하는지, 반대 방향도 확인.
3. follow/unfollow 후 actor following list와 target followers list membership이 일치하는지 확인.
4. popup 첫 cold click D1 R2 확인 후 새로고침/재진입 같은 목록은 `팔로우 목록 캐시` LOCAL HIT / Worker0 / D1 R0인지 확인.
5. 위 정합성 PASS 후에만 기존 W14~W17 → W1~W2 shared follow cutover 단계 재개.
## 0RL. app376 PREVIEW 배포 완료 / 팔로워·팔로잉 실사용 검증 대기 (2026-10-07 KST)

사용자 승인:
- 사용자가 `배포해줘`로 app376 PREVIEW 배포를 명확히 승인.
- 승인 범위는 app376 client/Firebase PREVIEW Hosting만. Worker/shared D1/Functions/Rules/TEST/PRODUCTION 변경 없음.

배포:
- app version commit: `bbbf8ade85cce6bd49ea646c85b2b9b38a4e8393`.
- release trigger / locked source: `e928cddaeed721227a24b1f2184777b029a030ab`.
- Firebase PREVIEW Hosting Run `37567143109`: **SUCCESS**.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- remote `preview.soridraw.com` app version **376**.
- `PREVIEW_EXACT_BUILD=PASS`.
- TypeScript PASS / Build PASS.
- app358 profile+My Likes convergence PASS.
- app359 My Likes settlement upgrade PASS.
- app360 My Likes navigation local PASS.
- app361 Music Note publication origin parity PASS.
- shared RTDB Rules: SKIPPED.
- TEST/PRODUCTION unchanged PASS.

app376 기능:
- 공개 프로필 `팔로워` / `팔로잉` 숫자를 클릭하면 실제 사용자 목록 팝업.
- PC 중앙 popup / 모바일 bottom-sheet.
- 30명 bounded page + 더 보기.
- 프로필 진입만으로 목록 서버 read 추가 0; 사용자가 숫자를 눌렀을 때만 조회.
- 동일 mount 재열기는 memory cache.
- 사용자별 N+1 profile read 없음.
- CACHE LIVE 요청명 `팔로워 목록` / `팔로잉 목록` 표시.

현재 Worker/데이터:
- PREVIEW Explore Worker는 기존 `bc8cc09e-4210-46e2-bdb7-72796e2798e4` 유지. 이번 app376 배포에서 Worker 재배포 없음.
- shared follow cutover OFF.
- shared D1 schema/migration/write 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- Functions / Firestore Rules / RTDB Rules 변경 0.

실사용 검증:
1. MY프로필에서 팔로워/팔로잉 숫자를 눌러 실제 목록 확인.
2. A→B 팔로우 후 B의 팔로워 목록에 A, A의 팔로잉 목록에 B가 보이는지 확인.
3. 팔로우 해제 후 두 목록에서 사라지는지 확인.
4. 숫자(count) / 목록 / 팔로우 버튼 상태가 PC와 모바일에서 일치하는지 확인.
5. CACHE LIVE에서 첫 목록 클릭 비용과 같은 목록 재열기 비용 확인.
6. 현재 follow mutation W14~W17은 legacy cutover-OFF 경로이므로 이 정합성 확인 전 W1~W2 cutover 활성화 금지.
## 0RK. app376 팔로워/팔로잉 목록 팝업 준비 완료 / PREVIEW 배포 전 (2026-10-07 KST)

사용자 실사용 관찰:
- PREVIEW cutover-OFF Worker에서 follow / unfollow 반복 후 숫자와 상태가 기대대로 반영되는지 확신하기 어려움.
- CACHE LIVE에서 follow mutation physical Rows Written은 여전히 legacy 수준 W14~W17 구간이 관찰됨. 현재 shared follow cutover가 OFF이므로 W1~W2 후보 경로가 실제 활성화된 결과가 아님.
- 사용자가 팔로워/팔로잉 숫자만 보고 실제 관계 상대를 확인할 수 없어, 관계 정합성을 검증할 UI가 먼저 필요하다고 지적.

app376 구현:
- 공개 프로필의 `팔로워`, `팔로잉` 숫자를 클릭 가능한 버튼으로 변경하되 기존 위치/간격/표시 스타일은 유지.
- 클릭 시 팝업:
  - 팔로워 / 팔로잉 탭
  - 아바타, 닉네임, @handle
  - 사용자 행 클릭 시 해당 공개프로필 이동
  - 빈 목록 / 로딩 / 오류 상태
  - 30명 단위 bounded pagination + `더 보기`
  - PC 중앙 팝업 / 모바일 bottom-sheet형.
- 기존 Worker의 `/v1/profiles/:id/followers`, `/v1/profiles/:id/following`을 그대로 재사용.
- 프로필 진입만으로 목록 서버 요청을 추가하지 않음. **사용자가 숫자를 눌렀을 때만 1회 조회**.
- 목록 API 한 번이 card 표시용 profile fields를 함께 반환하므로 사용자마다 profile을 다시 읽는 N+1 조회 없음.
- 같은 프로필/방향을 다시 열면 현재 Explore mount 동안 메모리 cache 사용.
- follow count가 바뀌면 해당 followers/following popup cache만 무효화하고, follow mutation 함수 자체에는 새 서버/캐시 의존성을 넣지 않음.
- CACHE LIVE에 `팔로워 목록` / `팔로잉 목록` 요청명을 추가해 실제 조회 비용을 바로 확인 가능하게 함.

변경 파일:
- `src/services/exploreSocialService.ts`
- `src/pages/ExplorePage.tsx`
- `src/components/explore/exploreSocial.css`
- `src/components/CacheDiagnosticsOverlay.tsx`
- `scripts/verify-376-profile-connections-popup.mjs`
- `scripts/verify-explore-deploy-preflight.mjs`

검증:
- 최초 Audit Run `37566115459`: TypeScript/Build PASS 후 기존 follow UI 실행형 verifier에서 popup cache ref가 추출된 `toggleFollow` 외부에 없어 FAIL. 제품 배포/데이터 변경 없이 중단.
- 수정: popup cache invalidation을 `toggleFollow`에서 완전히 분리하여 component effect로 이동. 기존 follow mutation contract 보존.
- 재감사 Run `37566319687`: **SUCCESS**.
- 최종 deploy-preflight 연결 후 Audit Run `37566557303`: **SUCCESS**.
- TypeScript PASS / Build PASS / static release-system verification PASS.
- Worker341 legacy counter/post-sync parity PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- live shared D1 preflight read-only PASS.
- active PREVIEW Worker `bc8cc09e-4210-46e2-bdb7-72796e2798e4` 확인; 이번 app376 UI 작업에서는 Worker 재배포하지 않음.

데이터/환경:
- shared follow cutover: OFF.
- shared D1 schema/migration/write: 0.
- 사용자 데이터 migration/backfill/copy/delete/rewrite: 0.
- Firebase Hosting 배포: 아직 0 (app376 미배포).
- Functions / Worker 추가 배포: 0.
- TEST / PRODUCTION: 변경 없음.

다음:
1. 사용자가 PREVIEW 배포를 요청하면 app376 client/Hosting만 PREVIEW에 배포.
2. 실제 프로필에서 팔로워/팔로잉 팝업으로 relation 상대를 확인.
3. 숫자(count) ↔ 실제 목록 ↔ 팔로우 버튼 상태를 같은 계정/PC/모바일에서 대조.
4. CACHE LIVE에서 목록 첫 클릭 비용과 같은 팝업 재열기 비용을 확인.
5. relation 자체가 틀린지, 숫자/cache 표시만 틀린지 분리한 뒤 follow 동기화 수정.
6. 이 정합성이 해결되기 전 W1~W2 shared cutover 활성화 금지.
## 0RJ. follow candidate PREVIEW Worker 배포 완료 / cutover OFF 실사용 검증 대기 (2026-10-07 KST)

사용자 승인:
- 사용자가 “배포해서 확인해보자”로 PREVIEW Worker 배포를 승인.
- 승인 범위는 **PREVIEW Worker candidate 배포 + cutover OFF legacy parity 확인**.
- shared follow schema/migration/cutover 활성화, TEST/PRODUCTION 승격은 승인 범위 아님.

배포:
- trigger commit: `a22d27e389c646908347f812859799e4ec1dc111`.
- product source: `f6b63eb0ecb6322d531b19bbb01c6fd0c2555c04`.
- PREVIEW Worker Release Run `37565145301`: **SUCCESS**.
- PREVIEW Worker before: `117d5f65-e34d-4c58-8030-498193deb1b4`.
- PREVIEW Worker after: `bc8cc09e-4210-46e2-bdb7-72796e2798e4`.
- TEST Worker before/after 동일: `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`.
- PRODUCTION Worker before/after 동일: `efb8508e-d63a-4839-a7c8-a5c89572f4c7`.

배포 전 hard gate:
- Worker341 legacy counter exact parity PASS.
- Worker341 legacy post-sync exact parity PASS.
- dormant overlay router / legacy path parity PASS.
- legacy 347 compatibility extra write ABSENT.
- PREVIEW release legacy parity gate PASS.
- profile/follow cost bounds PASS.

배포 후 live smoke:
- Worker propagation ready PASS.
- curated first/warm PASS / warm D1 R0 W0 PASS.
- latest feed D1 R0 W0 PASS.
- popular feed D1 R0 W0 PASS.
- public profile signal shared R2 live PASS.
- profile tracks D1 R0 W0 PASS.
- genre tracks D1 R0 W0 PASS.
- search D1 R0 W0 PASS.
- public like cards D1 R0 W0 PASS.
- feed smoke PASS / profile smoke PASS.
- warm revision D1 R0 W0 PASS.
- TEST/PRODUCTION Workers unchanged PASS.
- automatic rollback 미발생.

중요:
- 이번 release trigger는 `shared_follow_cutover=false`, `follow_overlay_activation=false`.
- shared follow migration/cutover/user data mutation 없음.
- Firebase Hosting / Functions 배포 없음.
- 따라서 지금 PREVIEW에서 먼저 확인해야 하는 것은 **새 Worker가 cutover OFF 상태에서 기존 Worker341 팔로우 기능/비용을 그대로 보존하는지**임.

다음 실사용 체크:
1. PC에서 follow 1회 → 즉시 UI/팔로워 수 확인.
2. PC에서 unfollow 1회 → 즉시 원복 확인.
3. 모바일에서도 동일 1회씩.
4. PC에서 follow 후 모바일에서 페이지 이동/새로고침 없이 상태 정합 확인, 반대 방향도 확인.
5. MY프로필 following membership, 상대 프로필 followerCount/followingCount, follower-save permission 확인.
6. 가능하면 Cloudflare live physical D1 Rows Written을 follow/unfollow 각각 기록.
7. cutover OFF 비용/동작이 Worker341 baseline과 다르면 즉시 rollback.

## 0RI. follow PREVIEW Worker release gate 보강 완료 / 배포 전 (2026-10-07 KST)

배포 안전장치 보강:
- `.github/workflows/cloudflare-explore-preview-release.yml`에 Worker341 legacy parity 검사를 PREVIEW Worker 배포의 필수 선행 gate로 추가.
- release source에 Worker341 기준 commit이 없으면 해당 commit만 bounded fetch한 뒤 `scripts/verify-356-follow-worker341-legacy-parity.mjs`를 실행.
- legacy counter/post-sync/core가 Worker341과 다르면 PREVIEW Worker 배포가 시작되기 전에 실패하도록 고정.
- pipeline change commit: `ed918db4a14fe158f46f6e861dd82bdf135eb9d9`.

독립 재감사:
- trigger commit: `a61a585f96b44429365beb3a670d646a24c9011b`.
- Release System Audit Run `37564622518`: **SUCCESS**.
- TypeScript PASS / Build PASS / static release-system verification PASS.
- TEST + PRODUCTION Worker dry-run PASS.
- live shared D1 preflight read-only PASS.
- branch refs unchanged audit PASS.
- main(TEST) `2314589357ec52b27ed785229f77a808c5673202` / production `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0` unchanged.

현재 상태:
- PREVIEW 코드에는 dormant follow overlay candidate가 있으나 shared follow cutover는 OFF.
- PREVIEW active Worker는 아직 기존 배포본 `117d5f65-e34d-4c58-8030-498193deb1b4`; 이번 작업에서 Worker 배포하지 않음.
- 사용자/shared 데이터 mutation, migration, backfill, delete, rewrite 0.
- 다음 단계는 사용자 PREVIEW 배포 요청 전까지 배포하지 않음. 배포 시에도 cutover OFF 후보부터 legacy parity를 live 확인하고, 그 후에만 overlay 활성화 여부를 별도 판단.

## 0RH. follow W14~W17 → W1~W2 재개 1차 독립 감사 PASS / PREVIEW 배포 전 (2026-10-07 KST)

현재 작업:
- app375 릴리스 종료 후 follow/unfollow 저비용 backend 작업을 다시 시작.
- 시작 기준 PREVIEW `0c9336a9871e348a4e05230b4e44742c92ec060d`.
- 감사 trigger commit `2cc95dc69a72c230bca4c59e9d8d5c4633528524`.
- Release System Audit Run `37564169142`: **SUCCESS**.
- 제품 앱/Worker 배포는 하지 않았고 app375 공개/비공개/최신곡/좋아요/Music Note/Library/UI는 비변경.

핵심 감사 결과:
- Worker341 legacy counter mutation exact parity: **PASS**.
- Worker341 legacy post-sync exact parity: **PASS**.
- dormant overlay router가 legacy 경로보다 먼저 분기되고 cutover OFF에서 legacy 경로를 바꾸지 않는 계약: **PASS**.
- 347 legacy compatibility 추가 write 부재: **PASS**.
- crash/replay, suspended writer, duplicate/reverse/shared-target, ordered client retry: **PASS**.
- shared follow migration: **미적용 / overlay authority OFF**.
- TypeScript PASS / Build PASS / TEST+PRODUCTION Worker dry-run PASS / live shared D1 preflight SELECT-only PASS.
- audit 종료 후 branch refs unchanged PASS.
- 격리용 임시 D1 cleanup PASS.

실제 격리 Cloudflare D1 + actual HTTP handler 물리 비용:
- 새 follow: **R2 / W2**.
- duplicate operation id: **R1 / W0**.
- same-state + new operation id: **R4 / W0**.
- unfollow: **R6 / W1**.
- stale revision reject: **R1 / W0**.
- relation 저장 후 R2 실패: **R5 / W1**.
- recovery retry: **R16 / W0**.
- 따라서 정상 follow/unfollow physical D1 hard gate **W1~W2 PASS**, duplicate/same-state **W0 PASS**.
- 위 수치는 새로 만든 격리 D1의 실제 `rows_read/rows_written`이며 shared 사용자 D1을 변경하지 않음.

아직 남은 게이트:
- R2는 이번 격리 시험에서 실제 live billing이 아니라 fixture get/put 시도 횟수로 검증됨.
  - 정상 follow: R2 get 12 / put 7.
  - 정상 unfollow: R2 get 12 / put 7.
- 실제 PREVIEW Worker + R2 환경의 비용/지연/충돌 계측은 아직 **미검증**.
- PC↔모바일 실기기 follow/unfollow, profile follower/following count, following membership, follower-save permission, public-profile parity도 **실사용 검증 전**.
- 따라서 지금 바로 shared follow cutover/migration을 켜거나 TEST/PRODUCTION으로 승격하지 않는다.

다음 안전 단계:
1. 현재 검증된 dormant overlay candidate를 **cutover OFF** 상태의 PREVIEW Worker 후보로 고정한다.
2. PREVIEW 배포 전 release source identity + Worker341 legacy parity gate를 다시 고정한다.
3. 사용자가 PREVIEW Worker 배포를 요청하면 PREVIEW만 배포하고, 먼저 cutover OFF legacy 실사용 비용이 Worker341 baseline과 동일한지 확인한다.
4. 그 다음 별도 안전 경계에서 overlay 활성화가 필요하면 shared schema/cutover 영향·rollback을 보고하고 명확한 승인을 받은 뒤 진행한다.
5. PREVIEW live에서 follow/unfollow W1~W2 + PC↔모바일/프로필 정합성까지 확인되기 전 TEST 승격 금지.

데이터/환경:
- 사용자 데이터 migration/backfill/copy/delete/rewrite: **0**.
- shared follow schema/cutover mutation: **0**.
- Firebase Hosting/Functions/Rules 변경: **0**.
- Cloudflare Worker 배포: **0**.
- TEST/PRODUCTION 변경: **0**.

## 0RG. app375 PRODUCTION 사용자 smoke PASS / 릴리스 종료 (2026-10-07 KST)

사용자 정식앱 확인:
- 새 Music Note 곡 공개 후 Explore `최신 공개곡` 첫 번째 카드에 즉시 표시 PASS.
- 왼쪽 `<` 화살표를 눌러야만 보이던 지연 증상 없음 PASS.
- 기존/신규 공개곡 메인 음원 1↔2 전환 시 이전 노란 제목/equalizer 즉시 초기화 PASS.
- Music Note 공개상태 / MY프로필 / Explore 노출 정상 확인.
- app373 first-publication W12→W2 비용 구조 유지.

릴리스 최종 상태:
- PREVIEW app375
- TEST app375 / TEST_VERIFIED
- PRODUCTION app375 / RELEASED
- production SHA `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0`
- app375 릴리스 **CLOSED / PASS**
- 사용자 데이터 migration/backfill/copy/delete/rewrite 없음.
- Functions / Rules / shared D1 추가 mutation 없음.

다음 개발 우선순위:
- 공개/비공개/최신곡 경로는 동결 보호.
- 다음 큰 비용 작업은 2026-10-05에 rollback된 **follow 저비용 backend**로 복귀.
- 현재 legacy follow 실사용 baseline은 physical D1 Rows Written 약 **W14~W17**, 목표는 **W1~W2**.
- 기존 candidate355는 cutover OFF 상태에서도 legacy path 비용을 바꿔 rollback된 이력이 있으므로 바로 재배포 금지.
- 먼저 Worker341 legacy parity + dormant overlay candidate를 독립 감사하고, 실제 HTTP 경로 D1/R2 비용을 격리 환경에서 다시 증명한 뒤 PREVIEW Worker 후보를 만든다.
- shared follow migration/cutover/user data mutation은 별도 명확한 승인 전 금지.

## 0RF. app375 TEST + PRODUCTION 승격 완료 — RELEASED (2026-10-07 KST)

사용자 승인:
- PREVIEW app375 실사용 PASS 후 사용자가 “테스트, 정식까지 승격”을 명확히 승인.
- 승인 범위: 검증된 app375 전체 릴리스의 TEST 승격 후, TEST_VERIFIED 동일본을 PRODUCTION까지 승격.
- 사용자 데이터 migration/backfill/copy/delete/rewrite는 승인 범위가 아니며 실행하지 않음.

TEST 승격:
- source PREVIEW SHA: `24d600fd1597db9d4d10d7257a2b6911a3e721c4`
- Release Controller Run `37559055085`: **SUCCESS / TEST_VERIFIED**
- main(TEST) promoted SHA: `2314589357ec52b27ed785229f77a808c5673202`
- immutable TEST tag: `soridraw-test-v375-24d600fd1597`
- app version: **375**
- TEST Explore Worker active/uploaded version: `bb1b6c9b-11f7-4b29-ae1f-75e87ca6ad65`
- TEST Media Worker active/uploaded version: `cfb741e3-a255-49ed-8801-cb21f7f53938`
- TypeScript PASS / Build PASS
- Firebase TEST Hosting exact verification PASS
- `TEST_WORKER_VERIFY=PASS`
- `TEST_MEDIA_WORKER_VERIFY=PASS`
- `TEST_CURATED_PARITY=PASS count=12`
- `TEST_PUBLIC_PROFILE_PARITY=PASS`
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`
- browser-upgrade / app361 publication parity / old-cache release gates PASS
- TEST 단계에서 PRODUCTION branch/Hosting/Worker/Media Worker 비변경 PASS

PRODUCTION 승격:
- production approval command consumed immutable TEST_VERIFIED tag `soridraw-test-v375-24d600fd1597`
- Release Controller Run `37559345127`: **SUCCESS / RELEASED**
- tested main: `2314589357ec52b27ed785229f77a808c5673202`
- production promoted SHA: `663a6b820135a140ac35b7e8a88bdd0ed4cc26e0`
- app version: **375**
- PRODUCTION Explore Worker active/uploaded version: `efb8508e-d63a-4839-a7c8-a5c89572f4c7`
- PRODUCTION Media Worker active/uploaded version: `66b85b60-6c00-4c9c-bde8-df4f836a3ea8`
- Firebase PRODUCTION Hosting: TEST verified Hosting exact clone PASS
- `FIREBASE_PRODUCTION_HOSTING_CLONED_FROM_TEST=PASS`
- `PRODUCTION_WORKER_VERIFY=PASS`
- `PRODUCTION_MEDIA_WORKER_VERIFY=PASS`
- `PRODUCTION_CURATED_PARITY=PASS count=12`
- `PRODUCTION_PUBLIC_PROFILE_PARITY=PASS`
- `PRODUCTION_RELEASE_ENVIRONMENT_PARITY=PASS reference=TEST`
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`
- Release Control final state: **RELEASED**
- `soridraw.com` + Firebase production URL exact release verification step PASS
- main(TEST) ref / TEST Worker / TEST Media Worker / TEST Hosting은 PRODUCTION 승격 중 비변경 확인.

이번 릴리스에 포함된 app374/app375 핵심:
- 공개 메인 음원 1↔2 전환 시 이전 노란 제목/equalizer 즉시 초기화.
- 새 공개곡 publication signal을 same-origin 브라우저에 즉시 전달.
- Explore `최신 공개곡` 첫 track이 바뀌면 해당 rail만 paint 전에 left=0으로 복귀.
- 새 공개곡이 기다림/왼쪽 화살표 클릭 없이 첫 번째 카드로 즉시 노출.
- 다른 추천/인기 rail의 사용자가 보던 위치는 자동 변경하지 않음.
- app373 shared D1 first-publication W12→W2 구조 유지.

데이터 / 비용 / 백엔드:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**
- 이번 app375 TEST/PRODUCTION 승격에서 shared D1 schema/data 추가 mutation: **0**
- Firebase Functions/Rules 변경: **0**
- app375 local publication signal dispatch는 기존 canonical publication signal transaction의 결과를 같은 브라우저에 즉시 전달하는 것이며 추가 D1 read/write를 만들지 않음.
- shared D1 app373 cutover는 기존 적용 상태 유지.
- 실사용 first-publication 비용 기준: **W2**.

현재 환경:
- PREVIEW = app375
- TEST = **app375 / TEST_VERIFIED**
- PRODUCTION = **app375 / RELEASED**

다음:
- 정식앱에서 사용자 smoke test:
  1. 새 공개곡이 Explore `최신 공개곡` 첫 칸에 즉시 보이는지.
  2. 기존/신규 공개곡 메인 음원 1↔2 전환 시 노란 제목/equalizer 초기화가 정상인지.
  3. Music Note 공개상태 / MY프로필 / Explore 노출이 동일한지.
- 이상 없으면 app375 릴리스 종료.
- 이상 시 PRODUCTION 추가 변경을 바로 하지 말고 PREVIEW에서 해당 경로만 수정 후 다시 승격.

## 0RE. app375 PREVIEW 사용자 실사용 검증 PASS (2026-10-07 KST)

사용자 확인:
- PREVIEW app375에서 새로 공개한 Music Note 곡이 Explore `최신 공개곡`의 첫 번째 카드로 즉시 표시됨.
- 기다렸다가 왼쪽 `<` 화살표를 눌러야만 보이던 증상 해결 확인.
- app374 공개 메인 음원 전환 시 노란 제목/equalizer 초기화 정상 동작 유지.
- app373 first-publication W12→W2 비용 절감 구조 유지.
- 추가 D1/Worker/Functions/Firebase Rules/user data 변경 없음.

현재 기준:
- PREVIEW app375 = 사용자 실사용 PASS / TEST 승격 가능 후보.
- TEST app374.
- PRODUCTION app361.
- 다음 승격은 사용자 요청 시 TEST(main)으로 진행.
- PRODUCTION 승격은 TEST 검증 후 별도 명확한 승인 필요.

## 0RD. PREVIEW app375 배포 완료 — 새 공개곡 최신 목록 첫 칸 즉시 노출 (2026-10-07 KST)

사용자 TEST 실사용에서 발견:
- 새로 공개한 곡은 공개프로필에는 정상 노출됐지만 Explore 홈 `최신 공개곡`에서 바로 첫 칸에 보이지 않았음.
- 일정 시간이 지난 뒤 왼쪽 `<` 화살표가 활성화되고, 사용자가 화살표를 눌러야 새 공개곡이 보였음.
- 동일 증상은 PREVIEW에도 재현 가능성이 높은 공통 클라이언트 경로 문제로 판단.

원인:
1. 같은 기기에서 공개한 publication RTDB 신호는 global `onValue` listener가 self-echo 방지를 위해 **저장만 하고 화면 이벤트는 dispatch하지 않음**.
2. 사용자가 Music Note 공개 직후 빠르게 Explore로 이동하면, retained signal이 로컬에 저장되기 전에 Explore가 mount될 수 있고 이후 같은 기기 signal은 이벤트가 생략되어 즉시 repaint를 놓칠 수 있었음.
3. 새 카드가 나중에 `tracks` 앞쪽에 prepend되어도 최신 rail은 기존 horizontal `scrollLeft`를 유지하여 새 첫 카드가 왼쪽 화살표 뒤에 숨을 수 있었음.

app375 수정:
- `src/services/userDomainSyncService.ts`
  - canonical publication RTDB transaction 성공 직후 그 결과 signal을 같은 브라우저의 memory/localStorage에 즉시 저장.
  - 같은 브라우저에 `EXPLORE_PUBLICATION_SYNC_EVENT`를 즉시 dispatch.
  - cross-device RTDB listener의 기존 self-echo 차단은 그대로 유지하여 중복 이벤트를 만들지 않음.
  - 추가 D1/Worker 요청 없음. 기존 publication signal write 외 서버 비용 증가 없음.
- `src/pages/ExplorePage.tsx`
  - `최신 공개곡` rail만 첫 track ID가 바뀌면 scroll position을 **left=0**으로 즉시 복귀.
  - `useLayoutEffect`로 paint 전에 적용하여 새로 prepend된 곡이 왼쪽 밖에 숨지 않도록 함.
  - 추천/인기/크리에이터 등 다른 rail의 사용자가 보고 있던 위치는 유지.
- app version: **375**.

코드 / 감사:
- 기능 commit: `9a0bcaf4257fd4f423ee47c01d59bf3efb6d4409`.
- audit trigger commit: `9200b020a6ef200903215d5d4c1ace3cc5e9dd90`.
- Release System Audit Run `37556209976`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - `APP375_PUBLICATION_ORIGIN_IMMEDIATE_LOCAL_SIGNAL=PASS`
  - `APP375_EXPLORE_LATEST_NEW_PUBLICATION_FIRST_VISIBLE=PASS`
  - release/static/like/shared-D1 read-only audits PASS
  - `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`

PREVIEW 배포:
- deploy trigger commit: `4e05ea1f0af6279feb614ec960838e9846aeeeff`.
- Firebase PREVIEW Run `37556423502`: **SUCCESS**.
- `PREVIEW_APP_VERSION=375`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- app361 publication parity gate PASS.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker / Functions / shared D1 추가 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.

현재 환경:
- PREVIEW = **app375**
- TEST = app374
- PRODUCTION = app361
- shared D1 app373 W2 cutover는 기존 상태 그대로.

다음 실사용 gate:
- PREVIEW에서 한 번도 공개한 적 없는 Music Note 곡 1개를 공개.
- 공개 완료 후 Explore `최신 공개곡` 진입/복귀 시 **왼쪽 화살표를 누르지 않아도 새 곡이 첫 번째에 바로 보이는지** 확인.
- 기존 공개곡을 다른 메인 음원으로 전환했을 때 app374의 노란 제목/equalizer 초기화도 그대로 유지되는지 확인.
- PASS 시 app375를 TEST로 다시 승격 가능.
- FAIL 시 TEST/PRODUCTION 승격 중단, latest rail/local publication signal 경로만 추가 수정.

## 0RC. app374 TEST 승격 완료 — TEST_VERIFIED (2026-10-07 KST)

사용자 승인:
- PREVIEW app374 실사용 PASS 후 사용자가 TEST 배포 진행을 명확히 승인.

승격 기준:
- source PREVIEW SHA: `b572a5dd9f18c054f27e6557380a7c6066d46adf`
- PREVIEW app: **374**
- Release Controller Run `37552538672`: **SUCCESS**
- main(TEST) promoted SHA: `396a9862533e7e4f683a99cafe777c2fa40725c3`
- TEST_VERIFIED tag: `soridraw-test-v374-b572a5dd9f18`

TEST 배포/검증:
- TypeScript PASS
- Build PASS
- immutable preflight PASS
- TEST Explore Worker upload/activate/verify PASS
  - active version: `56828853-cf62-4552-a569-680ee34e9134`
- TEST Media Worker upload/activate/verify PASS
  - active version: `2f4a22c1-a4be-4e41-a8e1-98755becda14`
- Firebase TEST Hosting deploy + exact TEST verification PASS
- `TEST_CURATED_PARITY=PASS count=12`
- `TEST_PUBLIC_PROFILE_PARITY=PASS`
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`
- browser upgrade contract PASS
- old production cache → new release contract PASS
- Release Control final state: `TEST_VERIFIED`

보호 범위:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**
- 이번 TEST 승격에서 shared D1 schema/data 추가 mutation: **0**
- Firebase Functions/Rules 변경: **0**
- PRODUCTION branch / Hosting / Worker / Media Worker 비변경 확인.
- PRODUCTION은 app361 그대로 유지.

현재 환경:
- PREVIEW = app374
- TEST = **app374 / TEST_VERIFIED**
- PRODUCTION = app361
- shared D1 app373 first-publication W2 cutover는 공용 데이터 계층에 이미 적용되어 있음.

다음:
- TEST에서 사용자 실사용으로 공개 메인 음원 1↔2 전환 시 노란 제목/equalizer 초기화가 PREVIEW와 동일한지 확인.
- 공개상태 / MY프로필 / Explore 노출 정상 여부 확인.
- 이상 없으면 app374는 PRODUCTION 승격 후보이나, **정식배포는 사용자 별도 명확한 승인 전 금지**.

## 0RB. app374 PREVIEW 사용자 실사용 검증 PASS (2026-10-07 KST)

사용자 확인:
- PREVIEW app374에서 공개 메인 음원 1↔2 전환 시 기존 노란 제목/equalizer가 즉시 초기화되는 동작이 정상 적용됨.
- 신규 공개곡 / 기존 공개 이력 곡 모두 사용자 실사용 기준 정상.
- app373 first-publication W12→W2 비용 절감 구조는 그대로 유지.
- 추가 D1/Worker/Functions/Firebase Rules/user data 변경 없음.

현재 기준:
- PREVIEW app374 = 사용자 실사용 PASS / TEST 승격 가능 후보.
- TEST app361, PRODUCTION app361 유지.
- 다음 승격은 사용자 요청 시에만 TEST(main)으로 진행.
- PRODUCTION 승격은 TEST 검증 후 별도 명확한 승인 필요.

## 0RA. PREVIEW app374 배포 완료 — 공개곡 음원 전환 시 재생 표시 초기화 (2026-10-07 KST)

사용자 실사용에서 확인된 별도 UI 회귀:
- 공개곡 카드 중앙 Suno 링크를 눌러 노란 제목 + 중앙 equalizer 피드백이 활성된 상태에서,
- 같은 공개곡의 공개 설정에서 메인 음원을 1번→2번(또는 반대)으로 바꾸면 썸네일/링크는 새 음원으로 바뀌지만 기존 재생 피드백이 최대 3분30초 남아 있었음.
- 원인: 시각 피드백 session marker가 공개곡 `track.id`만 기억하고, 같은 track의 실제 Suno 링크가 바뀐 사실을 종료 조건으로 보지 않았음.

수정:
- `src/pages/ExplorePage.tsx`
  - 공개 메인 음원 선택이 실제 변경되었고 해당 카드가 현재 previewing 상태면,
  - 기존 visual timer 종료,
  - active preview track 해제,
  - sessionStorage preview visual marker 삭제,
  - 그 다음 새 썸네일/링크를 optimistic patch.
- 따라서 신규 공개곡/기존 공개곡 구분 없이 같은 `selectionChanged` 경로에서 동작.
- 실제 오디오 엔진/서버 playback 상태는 건드리지 않으며 기존의 “Suno 링크 열기 + 로컬 시각 피드백” 구조 유지.
- 관련 회귀검사 `APP374_EXPLORE_MEDIA_SWITCH_RESETS_PLAY_VISUAL` 추가.

코드:
- 기능 commit: `e9cbd68d3908de47b3dc1bbc11195e70ee28aa97`.
- app374/version gate commit: `cce0ec1d0190f897e96f6f42284460216ee022af`.
- Release System Audit Run `37551651930`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - static/release-system regression PASS
  - shared D1 read-only preflight PASS
  - TEST/PRODUCTION 비변경

PREVIEW 배포:
- deploy trigger commit: `0513c32506d915acd8fa1ca7cc57938f43bb0954`.
- Firebase PREVIEW App Run `37551851974`: **SUCCESS**.
- locked source: `0513c32506d915acd8fa1ca7cc57938f43bb0954`.
- `PREVIEW_APP_VERSION=374`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker / Functions / shared D1 추가 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.

비용 작업 실사용 확인:
- 사용자가 shared D1 cutover 이후 “한 번도 공개한 적 없는 Music Note 곡” 실제 최초 공개를 수행.
- 진단 화면 기준 first-publication:
  - D1 query write 1
  - physical rows_written **2**
  - Firestore R0/W0
  - page sync D1 R0/W0
- 즉 실제 앱 경로에서도 **W12 → W2** 목표 확인.
- 기존에 이미 공개 이력이 있는 곡의 공개 설정/음원 전환은 legacy compatibility row를 유지하지만 사용자 진단에서 해당 D1 mutation은 **W1**로 확인되어 비용 gate 합격 범위.
- 기존 공개곡을 새 schema로 강제 backfill/migration하지 않음.

현재 환경:
- PREVIEW = **app374**
- TEST = app361
- PRODUCTION = app361
- shared D1 app373 first-publication cutover는 세 환경 공용 데이터 계층에 적용된 상태.
- TEST/PRODUCTION 앱 코드는 이번 app374 배포에서 변경하지 않음.

다음:
- 사용자 PREVIEW에서 신규 공개곡 + 기존 공개곡 각각 한 번씩 메인 음원을 전환.
- 전환 즉시 이전 노란 제목/equalizer가 사라지고, 새 음원 중앙 버튼을 다시 눌렀을 때만 새 visual이 켜지는지 확인.
- PASS면 app374 TEST 승격 후보.
- FAIL이면 이 UI path만 재수정하고 D1 비용 구조/정상 publication 기능은 건드리지 않음.

## 0QZ. app373 shared D1 first-publication W12→W2 컷오버 적용 완료 (2026-10-07 KST)

사용자 명확한 승인:
- 2026-10-07 01:13 KST: **공유 D1 컷오버 승인**.
- 승인 범위: Music Note first-publication D1 W12 → W1~W2 비용 절감용 shared D1 index/trigger cutover.
- user row delete/backfill/rewrite, Worker/Hosting/Functions 배포는 승인 범위에 포함하지 않음.

릴리스 준비 / 안전성:
- app373 approved cutover source 준비 commit: `b320b57d11403def3b87d870ec00b5c7cdeac675`.
- release plumbing 재구성/future cutoff 고정 commit: `84a7dc12025cd72a64618f865495c3166e2891ab`.
- locked cutoff: **2026-10-07 03:00:00 KST** / `1791309600000`.
- migration blob: `f3a84c6abf20e33619507c48c55f30fae21db86e`.
- rollback blob: `d323b64cd29bd479d6fcf3577b55f84681905bf6`.
- verifier blob: `8d75d742959017401e1e046dfe19dcd98d361cce`.
- Release System Audit Run `37496811955`: **SUCCESS**.
  - TypeScript PASS
  - Build PASS
  - Static release-system verification PASS
  - critical shared-D1 workflow bash syntax gate PASS
  - TEST/PRODUCTION Worker dry-run PASS
  - live shared D1 read-only preflight PASS
  - main/production refs unchanged PASS

1차 shared-D1 release 시도:
- Run `37496079634`: **FAIL before any D1 mutation**.
- 원인: release workflow resolve shell의 rollback SHA 정규식 문자열 누락.
- migration/apply step까지 도달하지 않았으므로 shared D1 / user data / Worker / Hosting / Functions 변경 **0**.
- 동일 승인 범위에서 workflow를 main 기준으로 깨끗하게 재구성하고 bash `-n` 영구 gate를 추가한 뒤 재감사.

최종 shared-D1 cutover:
- trigger commit: `64bfc58c6408049fabf368727382dbdacad35d57`.
- canonical Shared D1 Release Run `37497179294`: **SUCCESS**.
- exact migration / rollback / verifier hash pinning PASS.
- pre-cutover live schema PASS.
- cutoff 이후 Music Note row 사전 존재: **0**.
- schema postflight PASS.
- canonical/derived user row counts before/after 동일: **PASS**.
- `PRAGMA quick_check` PASS.
- 실제 shared D1 synthetic first-publication probe:
  - **rows_written = 2**
  - **rows_read = 0**
  - `APP373_LIVE_FIRST_PUBLIC_REMOTE_D1_W2=PASS`
  - probe cleanup PASS.
- PREVIEW latest/popular feed post-cutover PASS.
- TEST latest/popular feed post-cutover PASS.
- PRODUCTION latest/popular feed post-cutover PASS.
- PREVIEW / TEST / PRODUCTION Explore Worker version 변경 없음 PASS.
- main / production branch ref 변경 없음 PASS.
- rollback 미실행; `APP373_SHARED_D1_CUTOVER=PASS`.

독립 live read-only post-audit:
- workflow update commit: `18fce8495973f79194590009be6cc00fbeda0b55`.
- Run `37497440023`: **SUCCESS**.
- PREVIEW / TEST / PRODUCTION R2 catalog/hybrid/publication authority PASS.
- `APP373_LIVE_POSTCUTOVER_SCHEMA=PASS`.
- `APP373_SHARED_D1_CUTOVER_APPLIED=true`.
- audit remote D1 writes: **0**.

실제 동작 기준:
- 컷오버 schema는 이미 shared D1에 설치됨.
- **2026-10-07 03:00 KST 이후 D1에 처음 생성되는 Music Note publication row**부터 low-cost 경로 적용.
- first-publication의 `tracks.created_at`은 기존 row가 없으면 publication 순간의 `Date.now()`이므로, 과거에 Music Note에서 만든 곡이라도 D1에 한 번도 공개 row가 없었다면 03:00 이후 첫 공개 시 새 경로 대상.
- 기존 D1 Music Note row와 non-Music-Note row는 legacy compatibility 유지.
- 사용자 데이터 migration/backfill/delete/rewrite 없음.
- Worker / Firebase Hosting / Functions / Rules 배포 없음.
- app version은 PREVIEW / TEST / PRODUCTION 모두 **361** 그대로.

다음 실사용 gate:
- 03:00 KST 이후 **한 번도 공개한 적 없는 Music Note 곡 1개**를 공개하여 실제 Worker 전체 경로를 확인.
- 목표: D1 first-publication W1~W2, 공개 버튼 즉시 정상, MY프로필/Explore 정상, 검색/프로필 parity 정상.
- W3+ 또는 UI/parity 이상이면 추가 승격/확대 중단하고 원인 분석.
- 이미 shared D1 공용 schema가 적용되었으므로 이 검증을 위해 TEST/PRODUCTION 코드 재배포는 하지 않는다.

## 0QY. app371 영구 승격 gate 완료 + app372 first-publication W12→W2 안전증명 완료 (2026-10-07 KST)

### 1. Music Note 공개상태 parity 371 영구 gate

app361 incident에서 발견된 “서버/프로필은 공개인데 Music Note 공개 버튼만 오래된 origin cache로 비활성” 회귀를 다시 통과시키지 않도록 `verify-371-music-note-publication-origin-parity.ts`를 일반 릴리스 경로에 영구 연결했다.

preview commit:
- `b2ce5fe2ca5e7a4444bef76134c6d61ac4d3cfae`

영구 연결 위치:
- Release Controller PREFLIGHT
- TEST_VERIFY
- PROD_PREFLIGHT
- Release System Audit
- PREVIEW App Release
- `verify-release-promotion-system.mjs` 자체 정적 gate

Release System Audit Run `37489891135`: **SUCCESS**
- TypeScript PASS
- Build PASS
- `RELEASE_PROMOTION_SYSTEM_STATIC=PASS`
- `APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS`
- `UNCHANGED_MUSIC_NOTE_REENTRY_WORKER_ZERO_CONTRACT=PRESERVED`
- `RETAINED_PUBLICATION_SIGNAL_BOUNDED_REPAIR=PASS`
- `PUBLIC_AND_LOCK_BUTTON_RENDER_CONTRACT=PRESERVED`
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`
- TEST/PRODUCTION 배포 없음
- 사용자 데이터 변경 없음

### 2. first-publication W12→W1~W2 app372 prep-only 후보

현재 shared D1의 never-published Music Note 첫 공개 물리 쓰기 **W12**를 줄이기 위한 새 cutover 후보와 rollback을 PREVIEW에 준비했다.

핵심 설계:
- 기존 사용자/기존 Music Note row는 기존 D1 index/trigger 동작을 그대로 유지.
- non-Music-Note row도 기존 동작 유지.
- cutover 이후 새로 최초 공개되는 Music Note row만:
  - canonical `tracks` + PK는 유지
  - legacy secondary index / derived mirror / shared revision fanout에서 제외
  - Feed/profile/search 조회는 이미 세 환경에 존재하는 shared R2 authority 사용
- 사용자 원본 row 삭제/변환/backfill 없음.
- 전체 Feed/profile/search rebuild 없음.
- cutover SQL은 `__SORIDRAW_PUBLICATION_W2_CUTOVER_MS__` placeholder가 남아 있어 승인된 release 경로에서 고정 cutoff를 찍기 전에는 직접 실행 불가.
- rollback은 기존 index/trigger 동작을 복원.

준비 commit:
- `1fd6d5d5e7116908ff73574adc95e9885ee559a4`
- verifier syntax 수정: `d5cffa5ae341345e060dfb3b2a5648c394b02ece`
- 측정 trigger: `dde5bb6c5cf5e5335cf2e7b2f7fa20e13027c4fa`

Release System Audit Run `37492203345`: **SUCCESS**
- TypeScript PASS / Build PASS
- `APP372_FIRST_PUBLICATION_W2_CUTOVER_STATIC=PASS`
- `APP372_CANONICAL_TRACK_ROW_PRESERVED=PASS`
- `APP372_PRECUTOVER_AND_NON_MUSIC_NOTE_COMPAT=PASS`
- `APP372_R2_AUTHORITY_FLAGS=PASS`
- `APP372_AUTO_APPLY_WIRED=false`
- `APP372_USER_DATA_MIGRATION=false`
- `APP372_SHARED_D1_APPLIED=false`

실제 Cloudflare **격리 임시 D1** 물리 비용 측정:
- 현재 first-publication 재현: **W12 / R2**
- 후보 적용 후 first-publication: **W2 / R0**
- 후보 적용 후 source/media swap: **W1 / R1**
- 후보 적용 후 private: **W1 / R1**
- 후보 적용 후 republish: **W1 / R1**
- no-op: **W0 / R1**
- pre-cutover Music Note: 기존 **W12 / R2** 보존
- non-Music-Note: 기존 **W12 / R2** 보존
- rollback 후 first-publication: 기존 **W12 / R2** 복구
- 임시 D1 삭제 PASS
- shared 실제 사용자 D1 write **0**

### 3. 실제 세 환경 live readiness read-only 확인

PREVIEW / TEST / PRODUCTION의 현재 Explore Worker와 shared D1을 쓰기 없이 직접 감사하는 gate를 추가했다.
- audit workflow update commits: `d7e5d9bb6f7dfd9f92497f5cf1e40522993e7129`, `507b062eb1ca7800425bff127663a1f63a1641ba`
- 첫 시도 `37493057422`는 live Worker marker 검사 방식이 너무 엄격해 FAIL; **데이터/배포 변경 없음**.
- 실제 composed function 기준으로 수정 후 Run `37493247036`: **SUCCESS**.

live 확인:
- PREVIEW / TEST / PRODUCTION 모두 같은 shared D1 ID 사용 PASS.
- 세 환경 모두 shared `PROFILE_MEDIA=soridraw-profile-media` PASS.
- 세 환경 모두:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- R2 catalog / hybrid / publication R2-only composed functions 세 환경 모두 존재 PASS.
- `PREVIEW_APP372_R2_CUTOVER_READINESS=PASS`
- `TEST_APP372_R2_CUTOVER_READINESS=PASS`
- `PRODUCTION_APP372_R2_CUTOVER_READINESS=PASS`
- 현재 shared D1은 아직 기존 pre-cutover schema 그대로:
  - `APP372_LIVE_PRECUTOVER_SCHEMA=PASS`
  - `APP372_SHARED_D1_CUTOVER_APPLIED=false`
  - `REMOTE_D1_WRITES=0`

### 현재 gate

기술적으로는 **first-publication W12→W2 shared-D1 cutover 직전까지 준비/증명 완료**.

하지만 다음 단계는 shared D1의 index/trigger를 실제 변경하는 schema cutover다. 사용자 원본 row를 바꾸지는 않지만 **공유 운영 D1 구조 변경**이므로 기존 안전 규칙에 따라 **사용자의 명확한 별도 승인 전 실행 금지**.

현재 실제 서비스:
- PRODUCTION app361 정상 유지.
- TEST app361 정상 유지.
- PREVIEW app361 제품 런타임 정상 유지.
- 이번 app372 작업은 아직 shared D1 / Hosting / Worker / Functions에 배포하지 않음.
- 사용자 데이터 변경 0.

## 0QX. app361 PRODUCTION incident 역반영 완료 — TEST + PREVIEW 동기화 (2026-10-07 KST)

사용자 확인:
- 정식앱 app361에서 Music Note 공개 체크가 실제 공개 상태와 정상 수렴하는 것을 사용자 실기기에서 확인.
- 이 건은 정상 개발 승격이 아니라 `incident recovery` 후 역반영으로 처리: **PRODUCTION hotfix → TEST → PREVIEW** 런타임 순서 유지.

역반영 소스:
- PRODUCTION app361 기준 HEAD: `b20c20a2a1a10a794806474e2b84c6b08b5faf63`.
- PREVIEW 준비 commit: `3019b20bc7d3f4f7a21ce0b2658ccf3a4997af92`.
- PRODUCTION에서 정확히 역반영한 제품 파일:
  - `public/app-version.json`
  - `src/pages/FavoritesPage.tsx`
  - `src/services/exploreEnvironmentParityPolicy.ts`
  - `src/services/explorePublicationService.ts`
  - `scripts/verify-371-music-note-publication-origin-parity.ts`
- PRODUCTION incident 전용 임시 Hosting workflow/trigger는 PREVIEW/TEST 제품 소스로 복사하지 않음.

TEST 역반영:
- Release Controller Run `37485002429`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW: `3019b20bc7d3f4f7a21ce0b2658ccf3a4997af92`.
- main(TEST) SHA: `21b2ac98370e0644c4ab245fc3fd9965d1cc4fb6`.
- immutable tag: `soridraw-test-v361-3019b20bc7d3`.
- app version: **361**.
- TEST Explore Worker active: `7c91d7bb-3e34-4bf0-91ca-62c9de930c6f`.
- TEST Media Worker active: `d80fdd58-3857-4314-a8d4-f35023971588`.
- Worker/Media code identity는 app360과 동일 code SHA이며 기능 코드 변경 없음.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`.
- `TEST_WORKER_VERIFY=PASS` / `TEST_MEDIA_WORKER_VERIFY=PASS`.
- old-production-cache upgrade contract / app358-360 regressions PASS.
- PRODUCTION 비변경 확인.

PREVIEW 역반영:
- deploy trigger commit: `21d57b00a917e173a47223783c6caab22636138d`.
- Firebase PREVIEW App Run `37485563687`: **SUCCESS**.
- `PREVIEW_APP_VERSION=361`.
- `PREVIEW_EXACT_BUILD=PASS`.
- TypeScript PASS / Build PASS / app358-360 regression PASS.
- `SHARED_RTDB_RULES_DEPLOY=SKIPPED`.
- PREVIEW Worker / Functions 변경 및 재배포 없음.
- `TEST_PRODUCTION_UNCHANGED=PASS`.

데이터/비용 안전:
- 사용자 원본 데이터 migration/backfill/copy/delete/rewrite: **0**.
- D1 schema migration: **0**.
- Firebase Functions/Rules 변경: **0**.
- app361 수정은 브라우저 origin별 오래된 Music Note 공개상태 cache가 최신 UID publication signal을 놓친 경우에만 bounded 수렴시키는 클라이언트 복구이며, 앱 버전만으로 전체 공개상태를 다시 읽는 구조를 추가하지 않음.

현재 기준:
- PRODUCTION = app361.
- TEST = app361.
- PREVIEW = app361.
- Music Note 공개상태 수렴 hotfix는 세 환경에 역반영 완료.
- 정상 좋아요 / 저장하트 / 잠금 / Music Note / Library / 공개·비공개 mutation UI는 frozen baseline으로 계속 보호.

다음:
- first-publication D1 W12 → W1~W2 비용 최적화 재개 전, `verify-371-music-note-publication-origin-parity.ts`를 일반 Release Gate/감사 경로에 영구 연결하는 소규모 릴리스 시스템 보강을 먼저 완료한다.
- 이후 새 PREVIEW 작업으로 first-publication W12 → W1~W2 최적화를 재개한다.

## 0QW. app360 PRODUCTION Music Note 공개버튼 parity 회귀 / 영구 승격 gate 강화 (2026-10-06 KST)

사용자 실기기 발견:
- 동일 곡의 Music Note 공개 버튼이 한 환경에서는 활성인데 정식앱에서는 비활성으로 표시되는 불일치 확인.
- app360 PRODUCTION 자체는 exact TEST_VERIFIED artifact 승격이었으나, 기존 Release Gate가 Music Note 카드의 publication-state 버튼을 browser-visible parity 항목으로 직접 검사하지 못한 누락이 확인됨.
- 이 건은 **Release System FAIL**로 기록한다. 서버/API parity PASS만으로 실제 버튼 상태 parity를 PASS 처리하지 않는다.

영구 승격 불변조건 추가:
- 최근 생성곡 / Music Note / Library 등 같은 사용자 곡의 상태형 UI는 버전·환경과 무관하게 동일 canonical 상태를 보여야 한다.
- 상시 비교 대상: 저장/하트, Explore 좋아요+숫자, 잠금, 공개/비공개, Music Note/Library membership, media/thumbnail.
- PREVIEW↔TEST↔PRODUCTION뿐 아니라 기존 PRODUCTION persistent cache → 새 릴리스 업그레이드에서도 같은 곡 기준 버튼 fill/active 및 membership 일치를 검증한다.
- 하나라도 다르면 TEST_VERIFIED/RELEASED 금지.

현재 판단:
- `src/services/explorePublicationService.ts`는 정상 Music Note 진입에서 기존 `explore-publication-states` persistent cache가 있으면 `options.revalidate !== true`일 때 즉시 반환한다.
- 따라서 오래된 PRODUCTION-origin cache가 남은 경우 실제 shared publication 상태와 다른 버튼 표시가 유지될 수 있는 경로가 존재한다.
- 다음 PREVIEW 작업은 이 수렴 gap만 최소 수정하고, 앱 버전 기반 cache bust/전체 DB 조회/정상 좋아요·잠금·공개 mutation 변경은 금지한다.
- first-publication D1 W12→W1~W2 최적화는 이 회귀와 Release Gate 보강이 끝난 뒤 재개한다.
- 사용자 데이터 migration/backfill/delete/rewrite 0. 현재 문서 변경만 수행하며 TEST/PRODUCTION 추가 배포 없음.

## 0QV. app360 PRODUCTION 정식배포 완료 / RELEASED (2026-10-06 KST)

사용자 명확한 `정식배포` 승인 후 final TEST_VERIFIED artifact를 exact promotion:
- Release Controller PRODUCTION Run `37461102504`: **SUCCESS / RELEASED**.
- manifest/tag: `soridraw-test-v360-d4c9d57cea80`.
- tested main: `208cc8949dc60cb056066828ce78ef2fce764e0c`.
- production promoted SHA: `78691ec733d7efcb254b904dc512af49124641cc`.
- production commit: `release: promote TEST_VERIFIED app 360 to PRODUCTION`.
- app version: **360**.
- bootstrap tag `soridraw-test-v360-0d27ac79c2d8` was not used.
- latest PREVIEW was not rebuilt/reinterpreted for PRODUCTION.

PRODUCTION preflight:
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`: PASS.
- TEST↔PRODUCTION allowed environment differences: PASS.
- app360 executable gates PASS:
  - `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`
  - `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`
  - `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`
  - `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`

PRODUCTION deployment:
- Explore Worker before `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa` -> after `4e845257-2fc5-46a0-9f46-04396ca729dc`.
- Explore Worker bundle SHA `7165d23c93a8f9b602118305f3ee3a32a82c497fe46e1ef867c29cc67139daa8`.
- Explore Worker code SHA `f6e1802f859b800cd245eb5c806a5e6ef4124ed42fcdc6799c89a004bb5bc3a2`.
- Media Worker before `a3b87bbc-af2d-41eb-9e26-99dda0dbfc44` -> after `a710fd22-8aa6-4386-b22a-d5510125fb2e`.
- Media Worker bundle/code identity exact PASS.
- Firebase PRODUCTION Hosting cloned from verified TEST Hosting: PASS.
- live Firebase URL `https://soridraw.web.app` deployed.
- `https://soridraw.web.app/` and `https://soridraw.com/` exact release index SHA verification: PASS.

PRODUCTION verification:
- `PRODUCTION_CURATED_PARITY=PASS count=12`.
- `PRODUCTION_PUBLIC_PROFILE_PARITY=PASS`.
- `PRODUCTION_RELEASE_ENVIRONMENT_PARITY=PASS reference=TEST attempt=1`.
- `PRODUCTION_WORKER_SMOKE=PASS` / `PRODUCTION_WORKER_VERIFY=PASS`.
- `PRODUCTION_MEDIA_WORKER_SMOKE=PASS` / `PRODUCTION_MEDIA_WORKER_VERIFY=PASS`.
- Worker schedules preserved.
- release control final state: `RELEASED`.

Data / backend safety:
- user source data copy/migration/backfill/delete/rewrite: **0**.
- D1 schema migration: **0**.
- Firebase Functions/Rules change: **0**.
- production promotion was code/artifact promotion only; shared user data remained in place.

Current stable release:
- PREVIEW branch may now move independently for new work.
- TEST main remains validated app360 baseline.
- PRODUCTION is app360 at `78691ec733d7efcb254b904dc512af49124641cc`.
- next development focus may resume first-publication D1 W12 -> W1~W2 optimization only as a new PREVIEW task, without touching the frozen app360 production baseline.
### 2026-10-06 user TEST validation — app360 PASS
- User confirmed TEST app360 behavior is now okay after real-device validation.
- This closes the current app360 TEST user-validation gate for the My Likes/public-profile convergence regression.
- Final production candidate remains immutable tag `soridraw-test-v360-d4c9d57cea80` only.
- PRODUCTION is still unchanged and must not be promoted until the user gives an explicit `정식배포` approval.
## 0QU. app360 최종 TEST_VERIFIED 완료 / TEST 실사용 검증 단계 (2026-10-06 KST)

사용자 승인된 app360 TEST 승격 최종 완료:
- 최종 frozen PREVIEW source: `d4c9d57cea80944853e41c0911c21a24c88752ba` (app360 code + docs-only controller bootstrap record).
- final Release Controller Run `37436812301`: **SUCCESS / TEST_VERIFIED**.
- final main SHA: `208cc8949dc60cb056066828ce78ef2fce764e0c`.
- final immutable TEST tag: `soridraw-test-v360-d4c9d57cea80`.
- app version: **360**.
- TEST Explore Worker active version: `9835f91b-4c86-43db-ba30-bd8e5eaeffb8`.
- TEST Explore Worker bundle SHA: `7165d23c93a8f9b602118305f3ee3a32a82c497fe46e1ef867c29cc67139daa8`.
- TEST Explore Worker code SHA: `f6e1802f859b800cd245eb5c806a5e6ef4124ed42fcdc6799c89a004bb5bc3a2`.
- TEST Media Worker active version: `f947084a-15a7-4549-a921-09d32595f5ba`.
- TEST Media bundle/code identities PASS.
- Firebase TEST Hosting deployed and actual `https://soridraw-test.web.app` + custom TEST URL app-version/exact index verification PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- `TEST_RELEASE_ENVIRONMENT_PARITY=PASS reference=PREVIEW`.
- `TEST_WORKER_SMOKE=PASS` / `TEST_WORKER_VERIFY=PASS`.
- `TEST_MEDIA_WORKER_SMOKE=PASS` / `TEST_MEDIA_WORKER_VERIFY=PASS`.
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7` PASS.
- TEST↔PRODUCTION allowed environment diff contract PASS.
- PRODUCTION branch/Worker/Media Worker/Hosting non-mutation checks PASS; production ref remains `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

app360 My Likes cost regression fixed before TEST:
- app359에서 사용자가 일정 시간이 지난 뒤 `공개곡 ↔ 좋아요 곡` 왕복 시 1회 Worker +2와 새로고침 같은 갱신을 관찰.
- 원인: 5분 legacy private like revision HEAD가 My Likes tab entry 및 visible-heart hydration에서도 호출될 수 있었음.
- app360은 timed revision HEAD를 **실제 hidden→visible browser resume fallback에만 유지**.
- My Likes tab navigation 및 cached heart hydration에서는 timed revision Worker read 제거.
- 실제 same-account like change는 기존 RTDB change signal로 동기화.
- `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`.
- `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`.
- `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`.
- `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`.

공개/비공개 프로필 반영:
- 사용자 체감은 기존 약 20분 stale Edge 상태에서 약 **1분 내외**로 축소 확인.
- 현재 구조에는 publication/profile fallback의 60초 bounded revalidation window가 존재하며, 실제 mutation signal 경로는 캐시 우회를 사용.
- 따라서 20분 stale-cache 회귀는 해소되었고, 약 1분 fallback 수렴은 현재 설계 범위로 기록.

릴리스 주의:
- bootstrap TEST tag `soridraw-test-v360-0d27ac79c2d8`는 **PRODUCTION 사용 금지**.
- 향후 PRODUCTION 후보는 오직 final tag `soridraw-test-v360-d4c9d57cea80`.
- 이후 PREVIEW docs HEAD가 바뀌더라도 production은 latest preview를 rebuild하면 안 됨.
- 사용자 명확한 `정식배포` 승인 전 PRODUCTION 승격 금지.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0. D1 schema migration 0. Firebase Functions 변경 0.
## 0QT. app360 TEST 1차 승격 완료 / 새 controller identity로 최종 TEST 재검증 필요 (2026-10-06 KST)

사용자 TEST 승격 승인 후 app360 1차 TEST 승격 완료:
- PREVIEW app360 exact Hosting Run `37436007480`: SUCCESS.
- frozen PREVIEW source: `0d27ac79c2d8fed053fc2949cbfdad05fff794b7`.
- app360 regression PASS:
  - `APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS`
  - `APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS`
  - `APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS`
  - `APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS`
- Release Controller TEST Run `37436278070`: SUCCESS / TEST_VERIFIED.
- first TEST tag: `soridraw-test-v360-0d27ac79c2d8`.
- main promoted to `d42444e85efae30a6915e64b9604e8c81b3f9306`.
- TEST curated parity PASS / public-profile parity PASS / environment parity PASS.
- production environment contract PASS.
- PRODUCTION ref unchanged: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

중요:
- 이번 app360에서 Release Controller workflow 자체에 app358/359/360 executable gates가 추가됨.
- 위 1차 TEST Run은 issue_comment 특성상 당시 default `main`의 직전 controller identity로 실행됨.
- 따라서 첫 tag `soridraw-test-v360-0d27ac79c2d8`는 **TEST bootstrap 증거로만 유지하고 PRODUCTION 승격 근거로 사용 금지**.
- 현재 main에는 app360 controller가 승격되었으므로, docs-only PREVIEW SHA를 새로 만들고 새 main controller로 TEST를 1회 재검증하여 최종 schema4 TEST_VERIFIED manifest를 생성한다.
- 사용자 데이터 migration/backfill/delete/rewrite 없음. D1 schema 변경 없음.
### 2026-10-06 user verification — app359 changed-like Worker behavior
- User observed that after app359, Worker/personal social snapshot counters rise only when an actual like membership changes (a track is added to or removed from My Likes).
- Screenshot evidence: like mutation path shows bundled like save Worker 1 / D1 W1, public-like-card refresh Worker 1 / D1 R0 W0, private likes-revision Worker 1 / D1 R0 W0, and personal social snapshot reconciliation during the actual change.
- This is consistent with the intended cost contract: unchanged tab/page navigation should stay local, while a real membership change may spend bounded Worker/read work and one canonical write.
- Treat the prior `공개곡 ↔ 좋아요 곡` repeated-repair regression as PASS **provided counters no longer rise on unchanged repeated tab switching**.
- Remaining release gate: confirm publication visibility/profile list no longer waits ~20 minutes after public/private change.
### 2026-10-06 user verification — app359 My Likes count
- User refreshed/updated PREVIEW app359 and confirmed own-profile `좋아요 곡` now shows **16 tracks**.
- This matches the read-only canonical proof: D1 public+published liked relations=16 and shared personal-like R2 exact count=16.
- Prior PREVIEW/TEST/PRODUCTION screens showing >20 were therefore display/cache-settlement drift, not proof that canonical shared user data contained >20 public+published likes.
- TEST/PRODUCTION remain unchanged at this point; app359 has not yet been promoted.
- Remaining PREVIEW ship gate before TEST: confirm repeated `공개곡 ↔ 좋아요 곡` navigation no longer causes repeated Worker repair after the one-time settlement, and confirm publication visibility reaches profile without the old ~20 minute delay.
## 0QS. app359 PREVIEW 배포 완료 / My Likes 20곡 원인 확정 및 stale local guard 정리 (2026-10-06 KST)

사용자 관찰:
- app358 PREVIEW의 own-profile `좋아요 곡`이 이전 스물몇 곡에서 정확히 20곡으로 바뀜.
- 이 상태를 그대로 TEST에 올리지 않고 read-only 실데이터 진단 후 원인을 확정.

read-only 실데이터 진단 Run `37414720890`: SUCCESS / no mutation.
- target public profile resolve: 1.
- canonical D1 like relation 전체: **30**.
- 그중 현재 공개+published 곡: **16**.
- 비공개 또는 unpublished 관계: **14**.
- pending q069=0 / q075=0.
- shared personal-like R2 likedTrackIds: **16**.
- R2 `canonicalComplete156=true`, `exactLikeCount156=16`.
- R2 source=`verified-cross-origin-d1-358`.
- 즉 서버 canonical/공유 R2 기준은 16인데 브라우저가 20곡을 보인 것은 서버 20곡 제한이 아니라 **과거 accepted-but-unsettled local guard가 4곡을 추가로 보호하던 현상**으로 판단.

app359 수정:
- app358의 canonical R2 repair 뒤에도 남을 수 있는 historical local snapshot guards를 app189의 기존 fresh settlement proof로 1회 정리.
- settlement은 새 shared-R2 revision에 묶여 queue-empty + canonical/R2 + ETag 검증을 통과해야만 guard를 해제.
- 현재 사용자의 실제 미전송 outbox는 기존 app189 보호 규칙 그대로 보존.
- 같은 retained signal에 대한 app359 settlement upgrade는 origin당 1회만 허용; 이후 탭/페이지 왕복은 반복 Worker 금지.
- 새 실제 like signal이 생긴 경우에만 다음 bounded settlement 기회가 열림.

검증/배포:
- Release System Audit Run `37415142727`: **SUCCESS**.
- TypeScript PASS / Vite Build PASS / 기존 회귀검사 PASS.
- `APP359_CANONICAL_R2_THEN_FRESH_SETTLEMENT=PASS`.
- `APP359_SAME_SIGNAL_REPEAT_WORKER_BLOCKED=PASS`.
- `APP359_CURRENT_OUTBOX_PROTECTED_BY_EXISTING_189_LOGIC=PASS`.
- Firebase PREVIEW App Release Run `37415347786`: **SUCCESS**.
- PREVIEW app version: **359**.
- PREVIEW Explore Worker는 app358 Worker `117d5f65-e34d-4c58-8030-498193deb1b4` 그대로 사용(Worker 재배포 불필요).
- TEST/main 및 PRODUCTION 비변경.
- user data migration/backfill/copy/delete/rewrite 0.
- D1/R2 진단은 read-only; app359은 사용자 원본 데이터 변경 없음.

현재 gate:
1. `preview.soridraw.com` app359에서 own-profile `좋아요 곡` 재확인.
2. 정상 기준은 현재 canonical public/published membership **16곡** + 현재 미전송 사용자 의도가 있다면 그 의도만 임시 overlay.
3. 앱359 최초 정리 뒤 `좋아요 곡 ↔ 공개곡` 반복 왕복 시 같은 Worker repair가 반복 증가하면 FAIL.
4. 공개/비공개 후 프로필은 20분 대기 없이 change signal로 수렴해야 함.
5. 위 확인 전 TEST 승격 금지.
6. 확인 PASS 후 app359 전체를 TEST로 새 승격하고 새 TEST_VERIFIED manifest 생성.
7. app357 TEST manifest는 계속 PRODUCTION 사용 금지.

## 0QR. app358 PREVIEW 배포 완료 / 공개프로필 지연·My Likes 반복 Worker 회귀 수정 검증 단계 (2026-10-06 KST)

사용자 실사용에서 app357 TEST_VERIFIED 이후 추가 회귀가 발견되어 **기존 app357 TEST manifest는 PRODUCTION 승격 근거로 폐기**:
- PREVIEW와 TEST의 own-profile 좋아요 곡 목록이 서로 달랐음.
- 좋아요 곡 탭을 반복 클릭할 때 새로고침 없이도 Worker 요청이 반복 상승하는 현상 관찰.
- 공개/비공개 전환 뒤 공개프로필 공개곡 목록이 약 20분 동안 이전 상태로 남고 이후에야 수렴.
- 따라서 `soridraw-test-v357-32c85eded45c`는 더 이상 PRODUCTION 승격에 사용 금지.

app358 PREVIEW 수정:
1. **공개프로필 변경 신호 즉시 수렴**
   - 실제 publication RTDB 신호가 있을 때만 origin-local positive Edge shell을 우회.
   - shared `PROFILE_MEDIA`의 public-profile R2 authority를 직접 확인.
   - change-driven 경로는 D1 R0/W0 유지.
   - 일반 재진입/페이지 이동은 기존 local-first 캐시 유지.
2. **My Likes 반복 Worker 차단**
   - retained like signal 하나당 cross-origin repair 시도는 최대 1회.
   - 같은 signal에서 탭 재클릭/페이지 재진입은 repair Worker를 반복 호출하지 않음.
   - 오래된 partial shared-like R2가 canonical D1과 달라진 계정은 그 1회 bounded account repair에서 shared derived R2 catalog를 exact 상태로 복구.
   - D1은 read-only canonical comparison만 허용하며 relation/user source data 변경 없음.
3. UI/좋아요 토글/공개·비공개/Music Note/Library/폴더 정상 기능은 변경하지 않음.

검증/배포:
- Release System Audit Run `37413168427`: **SUCCESS**.
- TypeScript PASS / Vite Build PASS.
- app358 executable regression:
  - `APP358_PROFILE_SIGNAL_SHARED_R2_BYPASS=PASS`
  - `APP358_MY_LIKES_ONE_REPAIR_PER_SIGNAL=PASS`
  - `APP358_PERSONAL_LIKE_REPAIR_D1_READONLY=PASS`
- PREVIEW Explore Worker Run `37413466047`: **SUCCESS**.
  - before `39602152-bbf9-400c-9076-18c6c1d2b0b8`
  - active after `117d5f65-e34d-4c58-8030-498193deb1b4`
  - live `APP358_PROFILE_SIGNAL_SHARED_R2_LIVE=PASS`
  - profile signal path D1 R0/W0 PASS.
  - TEST Worker `ef64f24d-8e65-4921-a96d-b52e1d8db62d` unchanged.
  - PRODUCTION Worker `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa` unchanged.
- Firebase PREVIEW Hosting Run `37413571015`: **SUCCESS**.
  - locked source `8bd79632c7c232216da62271634429dedf4c3aee`.
  - `PREVIEW_APP_VERSION=358`.
  - `PREVIEW_EXACT_BUILD=PASS`.
  - `TEST_PRODUCTION_UNCHANGED=PASS`.
  - shared RTDB rules deploy SKIPPED (변경 없음).
- main(TEST) ref remains `d4852c7b85955effd0714b88c62ec10a4c96bb2e`.
- production ref remains `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.
- user data migration/backfill/copy/delete/rewrite 0.
- D1 schema migration/write 0.
- Functions 변경 0.

현재 합격 대기:
1. 사용자 PREVIEW 실기기에서 own-profile → 좋아요 곡을 연속 여러 번 전환해 **첫 stale repair 이후 반복 Worker 증가가 없는지** 확인.
2. PREVIEW에서 공개↔비공개 변경 후 프로필 공개곡 목록이 **20분 대기 없이 바로 수렴**하는지 확인.
3. PREVIEW 좋아요 곡 목록이 실제 좋아요 membership과 일치하는지 확인.
4. 위 3개 PASS 전 TEST 승격 금지.
5. PASS 후 app358 전체 PREVIEW를 TEST로 새 승격하여 새 TEST_VERIFIED manifest 생성.
6. 기존 app357 manifest/태그로 PRODUCTION 승격 금지.
7. 사용자 명확한 정식배포 승인 전 PRODUCTION 변경 금지.

## 0QQ. schema4 TEST_VERIFIED 최종 재검증 완료 / TEST 실사용 확인 단계 (2026-10-06 KST)

사용자 승인된 TEST 승격 흐름의 2차 검증 완료:
- Release Controller Run `37407657202`: **SUCCESS / TEST_VERIFIED**.
- 고정 source PREVIEW SHA: `32c85eded45c49e0e735c685a05b2efe8702c8ce`.
- TEST main promoted SHA: `d4852c7b85955effd0714b88c62ec10a4c96bb2e`.
- app version: **357**.
- immutable release tag: `soridraw-test-v357-32c85eded45c`.
- manifest: **schema 4 / TEST_VERIFIED**.
- TEST Explore Worker active version: `ef64f24d-8e65-4921-a96d-b52e1d8db62d`.
- TEST Media Worker active version: `3c167990-7194-4301-81da-791a21989156`.
- Firebase TEST Hosting deploy + exact index/app-version verify PASS.
- latest/popular shared Feed parity PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- shared Catalog flag=1 / Media health+bindings+smoke PASS.
- TEST↔PRODUCTION 허용 환경 차이 계약 PASS.
- Explore compiled code SHA TEST=PRODUCTION `13d809a3eca35366e25d85fefda3ebc0faa6a88968157a8afbf81a0e8178cf03`.
- Media compiled code SHA TEST=PRODUCTION `f0507a8464a1147e2bc914b6cd681ee1f1531ecfc3afb40ab7a73b8e55990bc9`.
- production environment contract SHA `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`.
- app366 cross-environment profile/My Likes parity verifier PASS.
- app367 old-production-cache upgrade verifier PASS.
- TypeScript PASS / Vite Build PASS / release static+mutation guard PASS.
- D1 preflight SELECT-only PASS. migration/backfill/seed/delete/rewrite 없음.
- PRODUCTION branch/Hosting/Explore Worker/Media Worker **비변경**.
- 현재 PRODUCTION ref: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.

중요:
- 직전 bootstrap schema3 tag `soridraw-test-v357-8ad97e799c24`는 계속 PRODUCTION 사용 금지.
- PRODUCTION 승격 근거는 오직 schema4 tag `soridraw-test-v357-32c85eded45c`.
- 이후 PREVIEW의 docs-only HEAD가 바뀌더라도 이번 TEST_VERIFIED source는 위 SHA로 고정한다.
- 사용자 별도 명확한 정식배포 승인 전 PRODUCTION 변경 금지.

다음:
1. 사용자가 `test.soridraw.com`에서 app357 실사용 확인.
2. Explore Feed / SORIDRAW 추천 / 공개프로필 공개곡·핀 / own-profile 좋아요 곡 / shared Catalog 기반 Music Note·Library의 핵심 체감 확인.
3. 이상 없으면 사용자의 명확한 정식배포 승인 후 위 schema4 manifest **그 하나만** 사용해 PRODUCTION 승격.
4. PRODUCTION 승격은 재build/reassembly 없이 TEST 검증 artifact exact promotion만 허용.
5. app357 parity 종료 전 first-publication W12→W1~W2 비용 작업 재개 금지.

## 0QP. TEST bootstrap 1차 완료 / schema4 TEST_VERIFIED 재검증 진행 단계 (2026-10-06 KST)

사용자 `테스트배포` 승인 후 one-time bootstrap 1차 완료:
- Release Controller Run `37407282504`: **SUCCESS**.
- target PREVIEW SHA: `8ad97e799c2418443f2a39e722152622fdaf8f39`.
- TEST app version: **357**.
- TEST Explore Worker: `833debce-7179-4353-88f7-e920743512f7`.
- TEST Media Worker: `217c81c6-bfef-48c6-8a07-e8c028be7b11`.
- TEST latest/popular shared Feed parity PASS.
- `TEST_CURATED_PARITY=PASS count=12`.
- `TEST_PUBLIC_PROFILE_PARITY=PASS`.
- TEST shared Catalog flag=1 / Media smoke PASS.
- Firebase TEST Hosting deploy SUCCESS.
- main promoted to `66ad632afab1259009efae387c0f41ccea2b4b26`.
- PRODUCTION branch/Hosting/Workers는 변경하지 않음.

중요:
- 이 Run은 이전 main controller가 실행한 **bootstrap 전용** Run.
- 생성 tag `soridraw-test-v357-8ad97e799c24`의 manifest는 schema3이므로 **PRODUCTION 승격 근거로 사용 금지**.
- bootstrap 결과 main에는 새 production-first controller가 설치됨.
- main ↔ preview controller workflow blob exact-match PASS:
  - workflow blob `b0a879b2bc70150653fc621c10008708faefba3f`
  - verifier blob `20ccf0dfeb3b9c203c27200dbb6bed1c99d3e810`
  - schema4 / production environment contract / compiled code SHA gate 존재 확인.

다음:
- 제품 동작은 그대로 둔 docs-only PREVIEW SHA를 생성한 뒤,
- 새 main controller로 TEST를 **한 번 더** 검증하여 schema4 `TEST_VERIFIED` manifest를 생성.
- 두 번째 Run이 최종 TEST 기준이며 첫 bootstrap manifest는 폐기 취급.
- 별도 정식배포 승인 전 PRODUCTION 변경 금지.

## 0QO. PRODUCTION-first Release Controller 구현·감사 PASS / one-time main bootstrap 대기 (2026-10-06 KST)

완료된 배포 시스템 보강:
- 제품 기준 PREVIEW HEAD: `83a90ce42c85fe59d4fe588a8c4fd719256361df`.
- Release System Audit Run `37406340564`: **SUCCESS / NO DEPLOY**.
- TypeScript PASS / Build PASS / 기존 like/publication/cache regression PASS.
- TEST/PRODUCTION branch, Hosting, Worker, Media Worker 비변경.
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- D1 schema/trigger/write 0.

새 hard gate:
1. **PRODUCTION live environment contract**
   - TEST 단계에서 실제 TEST/PRODUCTION Worker/Media binding과 Firebase Hosting config를 read-only로 읽어 계약을 생성.
   - 허용된 차이만 명시:
     - Explore worker name
     - TEST 전용 `RATE_DB=soridraw-explore-test-db`
     - TEST 전용 `EXPLORE_CACHE=soridraw-profile-media-test`
     - PRODUCTION 전용 mirror service bindings
     - Media worker name / 환경별 MEDIA bucket / ALLOWED_ORIGINS
     - Firebase Hosting site name
   - 그 외 차이는 TEST_VERIFIED 금지.
   - Audit contract SHA: `f198d262d73bd1973450f65c94a705a8bb1c9f6dd57dc517fd162349106f1de7`.
   - `TEST_PRODUCTION_ALLOWED_ENVIRONMENT_DIFFS=PASS`.
2. **실제 컴파일 코드 identity**
   - Explore TEST code SHA = PRODUCTION code SHA = `13d809a3eca35366e25d85fefda3ebc0faa6a88968157a8afbf81a0e8178cf03`.
   - Media TEST code SHA = PRODUCTION code SHA = `f0507a8464a1147e2bc914b6cd681ee1f1531ecfc3afb40ab7a73b8e55990bc9`.
   - 앞으로 TEST manifest에 이 compiled-code SHA를 고정하고 PRODUCTION upload/activate/verify에서 exact match가 아니면 중단.
   - Firebase Hosting은 기존처럼 TEST verified Hosting version을 PRODUCTION으로 clone하며 PRODUCTION 재build 금지.
3. **기존 PRODUCTION 브라우저 캐시 업그레이드 계약**
   - `src/services/exploreEnvironmentParityPolicy.ts`로 공개프로필/개인 좋아요 origin 수렴 판단을 순수 함수로 분리.
   - `verify-367-production-browser-upgrade-contract.ts`에서 old-production-cache → new-release, unchanged/empty cache, like signal certificate continuity를 실행 검증.
   - Audit:
     - `APP367_PRODUCTION_BROWSER_UPGRADE_CONTRACT=PASS`
     - `OLD_PRODUCTION_CACHE_TO_NEW_RELEASE=PASS`
     - `EMPTY_OR_UNCHANGED_CACHE_NO_FORCED_SERVER_READ=PASS`
     - `PERSONAL_LIKE_ORIGIN_CERTIFICATE_CONTINUITY=PASS`
   - app366 공개프로필/My Likes cross-origin verifier도 PASS.
4. **TEST_VERIFIED manifest schema 4**
   - source/tree + Hosting identity
   - Explore Worker source identity + compiled code identity
   - Media Worker source identity + compiled code identity
   - browser-upgrade contract hash
   - PRODUCTION environment contract hash
   - Release Controller identity
   를 하나의 immutable release manifest에 고정.
   - PRODUCTION preflight는 TEST에서 얼린 environment-contract asset과 현재 PRODUCTION live contract가 exact match인지 다시 확인.
5. **TEST Hosting과 PRODUCTION Hosting config parity**
   - TEST에도 `/app-version.json` no-cache/no-store/must-revalidate header를 추가하여 site name 외 Hosting 계약 차이를 제거.

감사 실측:
- Explore bundle source identity TEST/PRODUCTION: `65a2f5b39f91f15d328657d12b4dc1a99cab9e638c37b7bd7056e3e6494dcb9a` 동일.
- Media bundle source identity TEST/PRODUCTION: `041be5815c4398311c476276cda7c19cebf42e72ee29066aee0839f5f55ee50b` 동일.
- TEST/PRODUCTION shared D1 read-only preflight: tables=6, triggers=18 PASS.
- curated bounded read: TEST 12 / PRODUCTION 12 PASS.
- `D1_WRITE_MIGRATION_SEED=NONE`.
- `RELEASE_CONTROLLER_EXECUTABLE_MUTATION_TESTS=PASS`.
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`.

중요 bootstrap 사실:
- GitHub `issue_comment` Release Controller는 default branch인 **main의 workflow**로 실행된다.
- read-only command `/soridraw preflight 83a90ce...` Run `37406635596`은 SUCCESS / PREFLIGHT_NO_MUTATION이었지만, 실행 workflow 자체의 head는 현재 main `bca5864db427f6fdc635e547f573588e9628be0b`의 이전 controller이다.
- target PREVIEW source 안의 새 verifier는 읽고 검사했지만, **새 schema4 controller orchestration 자체가 live issue-command controller가 되는 것은 main 승격 후**다.
- 따라서 사용자 TEST 승인 전 main을 몰래 바꾸지 않는다.
- 최초 TEST 승격 때는 **one-time controller bootstrap**이 필요:
  1. 기존 main controller가 검증된 app357 tree를 TEST/main으로 승격해 새 controller를 main에 설치.
  2. 그 첫 manifest는 구 controller가 만든 것이므로 PRODUCTION 근거로 사용 금지.
  3. 새 main controller로 product behavior가 동일한 최신 PREVIEW SHA를 다시 TEST 검증하여 schema4 TEST_VERIFIED manifest를 생성.
  4. 이후부터 모든 릴리스는 새 controller의 단일 TEST_VERIFIED → 단일 PRODUCTION 승격 경로 사용.
- 이 bootstrap 동안 PRODUCTION은 변경하지 않는다.

현재 refs:
- preview `83a90ce42c85fe59d4fe588a8c4fd719256361df`
- main `bca5864db427f6fdc635e547f573588e9628be0b`
- production `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`

현재 상태:
- Release Controller 보강 구현 + 독립 Audit는 **완료**.
- app357 TEST/PRODUCTION은 아직 미승격.
- 다음 mutation은 사용자 명확한 `테스트배포` 승인 후에만 시작.

## 0QN. PRODUCTION-first 릴리스 절대 규칙 고정 (2026-10-06 KST)

사용자 최우선 운영 지시:
- 최종 목표는 항상 정식앱(PRODUCTION).
- PREVIEW에서 기능을 개발할 때부터 PRODUCTION의 환경 차이와 기존 사용자 상태까지 염두에 두고 구현.
- TEST는 "테스트용"이 아니라 **정식에 그대로 복붙될 완성본**을 검증하는 단계.
- TEST에서 모든 기능이 정상이라면 PRODUCTION은 같은 결과가 **단 한 번에** 나와야 함.
- TEST PASS 후 PRODUCTION에서 binding/cache/origin 차이 때문에 새 오류가 나고 다시 제품 코드를 고치는 반복을 정상 운영으로 인정하지 않음.
- 정식배포 뒤 "아, 이 환경만 달랐다"는 식의 누락을 금지.
- 사용자가 정식배포 후 핵심 정합성 오류를 찾아주는 것을 배포 검증의 일부로 의존하지 않음.

영구 기준 반영:
- `AGENTS.md`: PRODUCTION-first / TEST_VERIFIED 의미 / exact artifact 승격 / Release System FAIL 기준 추가.
- `DOCS/WORKFLOW_GUARDRAILS.md`: PRODUCTION-first 릴리스 절대 규칙 신설.
- `DOCS/WORK_AUDIT_CHECKLIST.md`: production live contract, old-production-cache upgrade, browser-visible parity, exact artifact identity를 필수 감사 항목으로 추가.
- 이 규칙은 앞으로 기능별 임시 판단보다 상위 release invariant로 사용.

현재 배포 상태:
- PREVIEW app357만 배포됨.
- TEST / PRODUCTION은 app357 미승격.
- 다음 큰 작업은 app357을 밀어 올리는 것이 아니라, **Release Controller가 이 새 절대 규칙을 실제 코드로 강제하도록 보강하는 것**.
- 보강이 완료되어 Audit PASS하기 전 app357 TEST/PRODUCTION 승격 금지.
## 0QM. app357 PREVIEW 공개프로필/좋아요곡 cross-environment parity 복구 + 승격 hard gate 추가 (2026-10-06 KST)

사용자 실기기 발견:
- PRODUCTION Explore Feed 자체는 PREVIEW와 정상 일치.
- 같은 계정 공개프로필의 **공개곡 목록/개수/핀 상태가 PREVIEW와 PRODUCTION에서 서로 다름**.
- 같은 own-profile의 **좋아요 곡 목록도 PREVIEW와 PRODUCTION에서 서로 다름**.
- 직전 Release Controller는 server-side public-profile projection 1개를 비교해 PASS했지만, 실제 브라우저 persistent cache 결과 차이는 잡지 못함. 따라서 이전 public-profile parity PASS는 서버 응답 parity이지 클라이언트 표시 parity까지 증명한 것이 아님.

원인:
1. 공개프로필
   - PREVIEW/TEST/PRODUCTION은 서로 다른 origin/localStorage를 사용.
   - app335 이후 warm public-profile route entry/reload는 비용 절감을 위해 local first-view cache를 그대로 반환하고 Worker 0을 유지.
   - 같은 계정 공개/비공개 RTDB 신호는 최신 mutation 1개만 보관하므로, 특정 origin이 과거 여러 변경을 놓친 상태에서는 최신 1개 patch만으로 전체 공개곡 목록을 복구할 수 없음.
   - shared server profile R2 자체는 Release Run `37397953411`에서 TEST↔PRODUCTION 동일 owner parity PASS였으므로 이번 실제 차이는 우선 origin-local stale first-view cache 문제로 격리.
2. 좋아요 곡
   - 개인 좋아요 역시 각 origin에 durable local catalog/watermark를 가짐.
   - retained RTDB signal은 작은 changed-track batch만 담으므로, 과거 origin이 이전 변경을 놓친 상태에서 이미 최신 signal watermark를 본 것으로 기록되면 일부 과거 membership이 남을 수 있는 recovery gap이 존재.
   - 좋아요 클릭/30초 batching/W1 queue/공개 숫자 경로 자체는 기존 frozen baseline을 유지.

app357 수정:
- `src/services/userDomainSyncService.ts`
  - 기존 같은-account `explorePublication` RTDB signal의 최신 작은 상태를 origin localStorage에도 보존. 추가 RTDB/Firestore/D1 요청 없음.
- `src/services/exploreProfileFirstViewService.ts`
  - 기존 cache schema version **6 유지**; 앱 업데이트를 이유로 전체 cache bust 금지.
  - cached first-view에 마지막으로 반영한 publication signal version만 additive 보존.
  - **실제 publication signal version이 cached profile보다 최신일 때만** shared first-view를 conditional 1회 확인.
  - 최신이면 현재 full first-view로 교체, 304면 기존 cache를 그대로 인증.
  - 변경 신호가 있는데 최신 상태를 확인할 수 없으면 과거 목록을 조용히 표시하지 않고 fail-closed.
  - 변경 없는 재진입은 기존 Worker 0 / D1 R0 유지.
- `src/services/exploreLikeService.ts`
  - retained personal-like signal version과 origin certification을 local-only로 추가.
  - 앱 시작/업데이트만으로 personal snapshot을 읽지 않음.
  - **사용자가 own-profile의 좋아요 곡 탭을 실제로 열었고**, 기존 durable like catalog가 있으면서 해당 origin이 retained signal까지 인증되지 않은 경우에만 기존 bounded personal baseline 경로로 1회 reconcile.
  - 성공 전 local catalog 삭제 없음.
  - 정상 30초 batching / W1 queue / heart-count atomic state / changed-track live signal 보호.
- `src/pages/ExplorePage.tsx`
  - own public-profile load에 retained publication version을 전달.
  - 늦게 도착한 publication signal도 own-profile을 다시 bounded reconcile하도록 version state로 연결.
  - My Likes 진입 시에만 cross-origin parity repair gate 실행.
- 배포엔진:
  - 신규 `scripts/verify-366-cross-environment-profile-like-parity.mjs`.
  - Release Controller TEST preflight에서 위 verifier를 **필수 실행**.
  - Release System Audit에도 동일 verifier 포함.
  - profile cache schema bump/global invalidation, like 30초 batching 변경, My Likes second authority 생성이 있으면 FAIL.

검증:
- 첫 Audit Run `37400910389`: FAIL.
  - 원인: 기존 isolated verifier 180이 `applyRemoteLikeSignal127` 함수만 VM으로 분리 실행하는데 새 certificate helper를 함수 내부 dependency로 추가해 test harness 계약을 깨뜨림.
  - 제품 기능 문제로 숨기지 않고 FAIL 유지.
- 수정:
  - certificate advancement를 RTDB subscription 경계로 이동하여 `applyRemoteLikeSignal127` frozen isolated contract 복구.
- 최종 Release System Audit Run `37401266952`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - existing like regression suite PASS.
  - app211/335 zero-read regression PASS.
  - app366 cross-env profile/My Likes parity verifier PASS.
  - Worker dry-run/read-only D1 checks PASS.
- PREVIEW App Release Run `37401610271`: **SUCCESS**.
  - deployed exact PREVIEW SHA `aafacbe6af07a3a6919c01c0512b123b2a44ba6b`.
  - PREVIEW app version **357**.
  - `preview.soridraw.com` exact build PASS.
  - shared RTDB Rules 변경 없음.
  - TEST / PRODUCTION branch + Hosting unchanged PASS.
- Explore Worker / Media Worker / Functions / Firestore Rules / D1 schema·trigger 변경 **0**.
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- UI/CSS 변경 **0**.

현재 HARD GATE:
- PREVIEW app357 실기기에서 같은 계정 기준:
  1. 공개프로필 공개곡 개수/목록/핀 순서가 현재 실제 공개상태와 일치.
  2. own-profile 좋아요 곡 membership/list가 실제 하트 상태와 일치.
  3. PREVIEW 재진입 시 변경이 없으면 profile Worker 0 / D1 R0 유지.
  4. Explore Feed / SORIDRAW 추천 / 좋아요 클릭 / 공개·비공개 기존 동작 회귀 없음.
- 위 항목 확인 전 TEST/PRODUCTION 승격 금지.
- first-publication W12->W1~W2 작업은 이 parity 이슈 종료 뒤로 연기.

## 0QL. SORIDRAW 추천 PRODUCTION 정상복구 + release gate 실전 검증 완료 (2026-10-06 KST)

최종 PRODUCTION:
- 사용자 명확 승인 후 Release Controller Run `37397953411`: **SUCCESS / RELEASED**.
- TEST_VERIFIED manifest: `soridraw-test-v356-884bf33c99eb`.
- exact source PREVIEW SHA: `884bf33c99eb67a8c06c8720f518a55b6f2ce27c`.
- main(TEST) SHA: `bca5864db427f6fdc635e547f573588e9628be0b`.
- production SHA: `1a2de5c4408f4ce501e49b76d32b706f90b97b7f`.
- PRODUCTION app version: **356**.
- PRODUCTION Explore Worker: `1fcd199a-c89f-4669-aeb5-12f3a4b0a9aa`.
- PRODUCTION Media Worker: `a3b87bbc-af2d-41eb-9e26-99dda0dbfc44`.
- Firebase PRODUCTION Hosting: verified TEST Hosting version clone PASS.
- `soridraw.com` / Firebase production Hosting exact build verify PASS.

SORIDRAW 추천 최종 검증:
- `PRODUCTION_CURATED_PARITY=PASS count=12`.
- TEST ↔ PRODUCTION 추천 projection parity PASS.
- latest / popular shared Feed parity PASS.
- public profile parity PASS.
- production release environment parity PASS on attempt 1.
- Production Media Worker shared Catalog flag=1 / authority=`shared-catalog` PASS.
- Worker / Media Worker smoke + verify PASS.
- 따라서 배포엔진은 추천이 503이거나 TEST와 불일치하면 승격을 중단하고, 정상 12곡일 때만 RELEASED 처리하도록 실제 release에서 검증됨.

이번 PRODUCTION 승격 전 발견된 두 차단과 수정:
1. Run `37395223571`: PROD_PREFLIGHT의 controller identity drift로 배포 전 차단.
   - TEST manifest controller identity를 default branch가 아니라 실제 승격 source `RELEASE_ROOT`에서 계산하도록 수정.
   - Audit `37395497639` SUCCESS.
2. Run `37396335517`: 새 production Explore Worker 활성 뒤 curated HTTP 503이 13회 지속되어 자동 rollback.
   - 기존 PRODUCTION Explore Worker `39e28223-6200-463f-8e86-1a0a3b3475d8`로 자동 복구되어 반쪽 배포 방지.
   - read-only Audit `37396796197`: TEST/PRODUCTION 공통 D1 `curated_picks` 모두 현재 12 rows PASS, schema/data 문제 아님 확인.
   - 실제 원인: PREVIEW/TEST는 명시적 `EXPLORE_CACHE` R2 binding이 있지만 PRODUCTION은 release runtime 계약상 `PROFILE_MEDIA`를 Explore cache fallback으로 사용. curated helper만 이 fallback을 따르지 않고 `EXPLORE_CACHE`만 요구해 production에서 R2 binding missing 503.
   - `curatedBucket307`을 `EXPLORE_CACHE || PROFILE_MEDIA`로 최소 수정.
   - 전체 tracks scan/rebuild, 데이터 copy/backfill 없이 canonical `curated_picks` 최대 40개 cold recovery 유지.
   - Audit `37397307521` SUCCESS.
   - PREVIEW Worker Release `37397493810` SUCCESS.
   - TEST Run `37397621274` SUCCESS / TEST_VERIFIED, curated 12 parity PASS.
   - 이후 최종 PRODUCTION Run `37397953411` SUCCESS.

데이터/비용/기능 안전:
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- D1 schema/trigger migration **0**.
- curated cold recovery는 추천 membership 최대 40개에만 bounded.
- warm 추천은 R2/Edge 경로, D1 R0/W0 gate 유지.
- 좋아요 / 공개·비공개 / Music Note / Library / 저장하트 / 폴더 / UI / thumbnail 변경 0.
- shared Catalog는 PREVIEW/TEST/PRODUCTION 모두 계속 ON.

현재 다음:
- 정식앱 `soridraw.com` 실사용에서 `SORIDRAW 추천` 표시와 CACHE LIVE `/v1/curated HTTP 200`만 사용자 최종 확인.
- 이상 없으면 curated 이슈 종료.
- 이후 큰 비용 작업은 기존 HARD GATE였던 **never-published 최초 공개 D1 W12 -> W1~W2**를 기능 보존 조건으로 재개.

## 0QK. SORIDRAW 추천 PRODUCTION 1차 시도 preflight 차단 + Release Controller identity bootstrap 완료 (2026-10-06 KST)

PRODUCTION 1차 시도:
- 사용자가 `soridraw-test-v356-86872e778695` 기준 정식앱 승격을 명확히 승인.
- Release Controller Run `37395223571`: **FAIL / PROD_PREFLIGHT에서 차단**.
- 실패 지점: `Release Controller identity drift`.
- 원인: TEST manifest가 TEST 승격 전 default-branch controller(`GITHUB_WORKSPACE`) identity를 기록했고, 같은 TEST 승격이 main에 새 release-controller 파일을 올린 뒤 PRODUCTION run은 새 controller identity를 사용해 서로 달라짐.
- `PROD_DEPLOY`는 실행되지 않았고 PRODUCTION branch / Explore Worker / Media Worker / Hosting은 변경되지 않음.

Release Controller 수정:
- `.github/workflows/soridraw-release-promotion.yml`: TEST manifest의 controller identity를 **실제로 승격되는 exact `RELEASE_ROOT` source**에서 계산하도록 변경.
- `scripts/verify-release-controller.mjs`: manifest identity가 promoted source에서 계산되는지 정적 검사 + mutation test 추가.
- 제품/UI/Explore 사용자 기능/데이터 경로 변경 0.
- Release System Audit Run `37395497639`: **SUCCESS**.

controller bootstrap TEST:
- Run `37395703347`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW `69991e94f731eb3ff0943a2864608301423d1645`.
- main(TEST) `00b5ee7b4eaac7ef8a9ec1d7ee7a0328223c76b8`.
- TEST Explore Worker `28257181-78df-4feb-8938-c74d0a448d38`.
- TEST Media Worker `ab5d9faf-dc43-4e57-9454-8cc87f797692`.
- `TEST_CURATED_PARITY=PASS count=12`.
- 이 bootstrap run 자체 manifest는 이전 default-branch workflow가 실행한 run이므로 PRODUCTION 근거로 사용하지 않음.
- 다음 TEST는 이미 수정된 main controller가 실행하며, controller identity 파일은 그대로 두고 문서-only 새 PREVIEW SHA를 대상으로 새 TEST_VERIFIED manifest를 생성한다.

안전:
- 사용자 데이터 migration/backfill/copy/delete/rewrite 0.
- D1 schema/trigger mutation 0.
- PRODUCTION mutation 0.
- 좋아요/공개/비공개/Music Note/Library/폴더/UI/thumbnail 변경 0.

## 0QJ. SORIDRAW 추천 TEST 승격 완료 / curated release hard gate 실제 PASS (2026-10-06 KST)

TEST 승격:
- Release Controller Run `37394592522`: **SUCCESS / TEST_VERIFIED**.
- exact source PREVIEW SHA: `86872e778695f199923f88b56481ee3ff7064a4a`.
- main(TEST) SHA: `cca8c2c4fedf88da4c14ff85331ad6c00c128098`.
- durable TEST manifest tag: `soridraw-test-v356-86872e778695`.
- TEST app version: **356**.
- TEST Explore Worker: `85e9821a-c2d4-4dcc-a5c5-8f06ee6600ae`.
- TEST Media Worker: `979e09c0-fc05-47fe-9522-91a46a004ef6`.
- Firebase TEST Hosting deploy PASS; `test.soridraw.com` / `soridraw-test.web.app` exact app-version/build verification PASS.
- PRODUCTION branch / Explore Worker / Media Worker / Hosting unchanged.

이번 승격에서 새 hard gate가 실제로 확인한 것:
- `TEST_CURATED_PARITY=PASS count=12`.
- PREVIEW와 TEST의 `SORIDRAW 추천` projection exact parity PASS.
- TEST latest/popular shared Feed parity PASS.
- TEST public profile parity PASS.
- TEST release environment parity PASS on attempt 1.
- TEST Media Worker `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`, health `shared-catalog` PASS.
- Explore Worker / Media Worker smoke + verify PASS.
- D1 schema migration / 사용자 데이터 backfill / bulk copy / delete / rewrite **0**.

현재 판단:
- PREVIEW와 TEST에서는 추천 backend와 배포 hard gate가 검증 완료.
- TEST 실제 화면에서 `SORIDRAW 추천` 섹션 표시 여부는 사용자 실사용 최종 확인만 남음.
- PRODUCTION은 아직 기존 Explore Worker이며 이번 TEST 승격에서 비변경. 정식앱의 기존 curated 503/추천 누락은 아직 복구 완료로 판정하지 않음.
- 사용자의 명확한 정식배포 승인 후에만 `soridraw-test-v356-86872e778695` manifest를 사용해 PRODUCTION 승격.

## 0QI. SORIDRAW 추천 cold-cache 복구 + 배포 엔진 hard gate PREVIEW 완료 (2026-10-06 KST)

사용자 실기기에서 확인된 문제:
- PRODUCTION Explore에서 기존 `SORIDRAW 추천` 섹션이 사라짐.
- CACHE LIVE에 `/v1/curated HTTP 503` 확인.
- 같은 시점 최신/인기 Feed 및 warm Explore D1 R0/W0은 정상이라 추천 경로만 별도 격리.

원인:
- `SORIDRAW 추천`은 사용자 원본이 아니라 환경별 `EXPLORE_CACHE` R2의 파생 curated snapshot을 사용.
- R2 snapshot이 없는 환경에서 wrapper의 `materializeCuratedR2FromBase307()`가 wrapper 전용 `/v1/curated`를 base Worker에 다시 요청하고 있었음.
- base Worker는 해당 wrapper route를 소유하지 않아 cold bootstrap이 실패하고 503을 반환.
- 기존 Release Controller parity는 latest/popular Feed와 public profile은 비교했지만 `/v1/curated`를 확인하지 않아 PRODUCTION의 추천 누락을 놓침.

수정 범위 — 다른 기능 비변경:
- 제품 fix commit `ff3c87ba797551beb9afbc8241ee5fca03f4680e`.
- release-engine 보강 commit `d0811e400c74fe8c81c6f3a0bc494321388da71c`.
- `cloudflare/explore-worker/canonical/preview-entry.js`
  - cold curated recovery를 shared canonical `curated_picks` 최대 40개 + 해당 exact track detail만 읽는 bounded 복구로 교체.
  - 전체 tracks scan/rebuild 없음.
  - D1 write 0, 사용자 데이터 write 0.
  - 정상 R2/Edge warm 경로는 기존 그대로.
- `.deploy/release-worker-runtime.mjs`
  - TEST/PRODUCTION 승격 시 `/v1/curated` HTTP 200 + warm D1 R0/W0 + 이전 단계와 curated projection parity를 필수 확인.
  - 실패 시 기존 release rollback 경로로 승격 중단.
- `.github/workflows/cloudflare-explore-preview-release.yml`
  - PREVIEW Worker 배포 자체도 curated first/warm live smoke를 필수화.
  - warm 응답 D1 R0/W0 및 R2/Edge authority가 아니면 배포 실패/rollback.

검증/배포:
- Release System Audit Run `37392337700`: SUCCESS.
- 강화된 최종 Audit Run `37392970196`: SUCCESS.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - release promotion verifier PASS.
  - Worker dry-run / shared D1 read-only preflight PASS.
- PREVIEW Worker Release Run `37393213974`: SUCCESS.
- active PREVIEW Explore Worker: `193d7c1c-7471-44d0-bd1f-2315b0121eed`.
- live curated smoke:
  - first response HTTP 200 / 추천 12곡 PASS.
  - immediate warm response HTTP 200 / 추천 12곡 PASS.
  - warm D1 R0/W0 PASS.
  - source `EDGE-CURATED-BODY-307` PASS.
- 기존 latest/popular/profile/genre/search/like smokes도 PASS.
- TEST / PRODUCTION Explore Workers unchanged PASS.
- Firebase Hosting 변경 0.
- Functions / Firestore Rules / D1 schema·trigger 변경 0.
- 사용자 데이터 migration/copy/backfill/delete/rewrite 0.

현재 상태:
- PREVIEW에서는 `SORIDRAW 추천` backend가 정상 복구되고 실제 live endpoint까지 확인 완료.
- PRODUCTION은 사용자가 보고한 기존 Explore Worker 상태를 아직 유지하므로 **정식앱 복구 완료라고 판정하지 않음**.
- TEST/PRODUCTION 승격은 기존 승인 규칙을 유지. 사용자 명시 TEST 승격 전 main 변경 금지, 명확한 PRODUCTION 배포 승인 전 production 변경 금지.
- UI, 좋아요, 공개/비공개, Music Note, Library, 저장하트, 폴더, thumbnail 코드는 이번 수정에서 변경하지 않음.

## 0QH. shared private Catalog coordinated cutover 실제 완료 (2026-10-06 KST)

- coordinated cutover Run `37389139136`: SUCCESS.
- PREVIEW / TEST / PRODUCTION Media Worker 모두 `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`.
- health authority mode: `shared-catalog` PASS.
- active cutover versions:
  - PREVIEW Media `5e258a0c-2e17-4fcb-bacc-11b2a5a608f2`.
  - TEST Media `6a890d63-d924-4199-a0ef-bd884430ff8f`.
  - PRODUCTION Media `f2fa815e-d38d-4e17-b2f5-4495efe00672`.
- Firestore migration 0 / D1 mutation 0 / Catalog bulk copy 0 / Hosting 변경 0.
- 따라서 아래 0QG의 `flag=0 dormant` 설명은 당시 시점 기록이며, **현재 실제 runtime은 세 환경 모두 shared Catalog ON**이 최신 기준.
- 사용자 실기기에서 이번 cutover 이후 Music Note 곡 목록이 거의 동일하게 맞춰졌다고 확인됨. 전체 parity/비용 검증은 계속 별도 확인 대상.

## 0QG. app356 PRODUCTION dormant shared Catalog support 승격 완료 + Hosting clone fix (2026-10-06 KST)

PRODUCTION 승격 최종 결과:
- Release Controller Run `37387649369`: **SUCCESS / RELEASED**.
- TEST_VERIFIED manifest: `soridraw-test-v356-77fdab283a90`.
- exact source PREVIEW SHA: `77fdab283a906b50a7ce8233ff73a34e80b4ef42`.
- main(TEST) SHA: `3a7fce2442ea15caf228e06a1a5c0299ee1b3dac`.
- production SHA: `74de6362c743974078c7d40566706053ce11dfc7`.
- PRODUCTION app version: **356**.
- PRODUCTION Explore Worker: `39e28223-6200-463f-8e86-1a0a3b3475d8`.
- PRODUCTION Media Worker: `c2fc9ac1-c79a-4b62-9a2a-1c6d09459e24`.
- Firebase PRODUCTION Hosting은 검증된 TEST Hosting 버전에서 clone되어 PASS.
- PRODUCTION Explore parity with TEST PASS.
- PRODUCTION Media health/smoke/verify PASS.
- PRODUCTION Media runtime:
  - `MEDIA=soridraw-media`
  - `CATALOG=soridraw-user-catalog`
  - `SORIDRAW_SHARED_CATALOG_V1=0`
- 따라서 PREVIEW / TEST / PRODUCTION 모두 **shared Catalog 코드를 이해하고 같은 private CATALOG binding을 가진 dormant 상태**가 됨.

이번 승격 중 발견/수정한 Release Controller 오류:
- 첫 PRODUCTION 시도 Run `37386436978`은 Firebase Hosting clone에서 실패.
- 원인: 현재 firebase-tools의 version source 문법은 `<site>@<version>`인데 controller가 `<site>:@<version>`을 사용하여 version을 channel로 해석함.
- 실패 시 Explore/Media Worker는 자동 rollback되어 기존 PRODUCTION 버전으로 복구됐고 production branch/Hosting은 승격되지 않음.
- PREVIEW fix commit `3202a72b0fa2c26397fb296652990f9119261ac8`: clone 문법 수정 + verifier 강화 + 이전 one-shot dispatcher 정리.
- Release System Audit Run `37387027945` at `77fdab283a906b50a7ce8233ff73a34e80b4ef42`: **SUCCESS**.
- 수정된 controller identity로 TEST를 다시 고정한 Run `37387289891`: **SUCCESS / TEST_VERIFIED**.
- one-shot TEST dispatcher는 최종적으로 PREVIEW에서 제거 완료; 현재 PREVIEW HEAD는 그 뒤 정리 commit 계열.

데이터/비용 안전:
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- Firestore Rules / Functions / shared D1 schema·trigger 변경 **0**.
- shared private Catalog flag는 세 환경 모두 아직 **0(OFF)**.
- 따라서 이번 PRODUCTION 승격은 shared authority 실제 cutover가 아니라 **dormant support 통일**까지만 수행.
- 정상 warm cache 0-read 목표와 app349 save-heart / app301 folder / public-like 보호선은 변경 없음.

현재 HARD GATE / 다음 작업:
- 세 환경 dormant runtime parity는 완료.
- 다음은 `SORIDRAW_SHARED_CATALOG_V1`을 **PREVIEW/TEST/PRODUCTION에 coordinated 방식으로 함께 ON** 하는 별도 cutover.
- 환경 하나만 먼저 장시간 ON 상태로 두는 방식 금지.
- cutover 중 사용자 Catalog 전체 복사/full scan/backfill 금지.
- cutover 후 동일 계정으로 Recent save-heart / Music Note / Library / folders / PC↔mobile/reload / Explore-publication 결과를 세 환경에서 비교.
- 실제 revision gap/missing shared Catalog일 때만 bounded user+kind bootstrap 허용.
- parity와 warm-cache 비용 검증이 모두 PASS한 뒤에만 first-publication W12->W2 shared-D1 작업 재개.

## 0QF. app356 TEST dormant shared Catalog support 승격 완료 + Release Controller 재강화 (2026-10-06 KST)

TEST 승격 최종 결과:
- Release Controller Run `37383619935`: **SUCCESS / TEST_VERIFIED**.
- exact source PREVIEW SHA: `0bab8cdb2492021cb35b5ee9d38fd92472d6f3e7`.
- durable TEST release tag: `soridraw-test-v356-0bab8cdb2492`.
- main promoted SHA: `751acbd9441023dc150403507b1c64232bc0f637`.
- TEST app version: **356**.
- TEST Explore Worker: `f45a7081-6b0b-4670-ba18-c9e58ce2287a`.
- TEST Media Worker: `faf933b6-d2d6-4599-9561-5596f593da4a`.
- TEST Media runtime exact checks:
  - `MEDIA=soridraw-media-test`
  - `CATALOG=soridraw-user-catalog`
  - `SORIDRAW_SHARED_CATALOG_V1=0`
  - media health/catalog binding PASS.
- Firebase TEST Hosting deploy PASS.
- TEST Explore environment parity with PREVIEW PASS.
- PRODUCTION branch/Explore Worker/Media Worker/Hosting 비변경.

Release Controller 보강:
- 첫 시도 Run `37382314963`은 TEST Media Worker 활성 직후 health 확인이 Cloudflare edge 전파보다 빨라 `media health binding check failed`로 중단.
- 해당 실행은 Explore Worker와 Media Worker를 이전 버전으로 되돌렸고 Hosting은 변경 전 중단.
- main rollback은 GitHub Actions token의 workflow-file rollback 권한 한계로 자동 push가 거절되어, connector의 workflow 권한으로 **원래 TEST tree를 유지하는 fast-forward rollback commit** `ca2ce92f88ca6f2d21c80f94d5e98f853eaa9fab`을 만들어 복구.
- 이후 Release Controller를 수정:
  - Media Worker active version/health가 실제 edge에 수렴할 때까지 bounded retry.
  - Media release identity를 비결정적 Wrangler outdir hash가 아니라 승인된 source + effective config + pinned tool contract로 고정.
  - Media Worker Wrangler를 `4.147.0` exact pin.
  - TEST/PRODUCTION branch ref는 Worker/Media Worker/Hosting 실제 검증이 모두 끝난 **마지막 단계에서만** 승격.
  - TEST release manifest도 먼저 생성하고, main push 실패 시 release/tag를 자동 정리하도록 rollback 강화.
  - 따라서 검증 실패가 branch에 반쪽 승격을 남기기 어려운 구조로 변경.
- Release System Audit Run `37383318153`: **SUCCESS**.
- 최종 TEST Run에서 Media Worker는 active version settle PASS, health는 7회 bounded retry 후 PASS, TEST_VERIFY 재확인에서는 1회에 PASS.

현재 tree parity:
- TEST에 승격된 source target tree = TEST main tree `c4a3cb4dc4179f67caa3d92d22cc048847330794`.
- TEST 승격 뒤 PREVIEW에 추가된 차이는 상태 문서 `DOCS/CURRENT_RELEASE_STATE.md`, `DOCS/NEXT_CODEX_TASK.md` 갱신뿐이며 runtime code 차이 0.
- temp dispatch workflow/trigger는 삭제 완료.
- 사용자 데이터 migration/copy/backfill/delete/rewrite **0**.
- shared Catalog cutover는 여전히 **OFF**.

현재 HARD GATE:
- PREVIEW와 TEST는 앱 + Explore Worker + Media Worker + shared `CATALOG` binding까지 동일 release 구조를 갖춤.
- 하지만 PRODUCTION은 아직 이전 release이므로 `SORIDRAW_SHARED_CATALOG_V1`을 PREVIEW/TEST만 먼저 ON 하면 안 됨.
- **PRODUCTION dormant support 승격은 사용자의 명확한 정식배포 승인 전 금지.**
- 세 환경 모두 shared Catalog 코드를 이해한 뒤에만 coordinated flag cutover를 진행하고, 그 뒤 Music Note/Library/Recent/folder 실데이터 parity를 검증.
- parity 완료 전 first-publication W12->W2 shared-D1 cutover 금지.

## 0QE. app356 PREVIEW shared private Catalog dormant support 배포 + 최종 감사 PASS (2026-10-06 KST)

이번 작업의 목적:
- TEST 승격 후 드러난 Music Note / Library 환경별 R2 Catalog drift를 사용자 데이터 복사나 전체 backfill 없이 해결하기 위한 **공용 private Catalog authority**를 준비.
- 실제 cutover는 아직 하지 않고, 먼저 세 환경이 같은 공용 Catalog를 읽을 수 있는 코드/배포 경로만 안전하게 준비.

구현:
- 공용 private R2 bucket `soridraw-user-catalog` 생성.
- Media Worker에 `CATALOG` binding 추가:
  - PREVIEW / TEST / PRODUCTION 설정이 모두 같은 `soridraw-user-catalog`를 가리킴.
  - 기존 실제 media/archive용 `MEDIA` bucket은 환경별 분리를 그대로 유지.
- `SORIDRAW_SHARED_CATALOG_V1` feature flag 추가.
  - PREVIEW / TEST / PRODUCTION 설정 모두 현재 **0(OFF)**.
  - 따라서 현재 일반 사용자 Catalog authority는 아직 기존 environment-local `MEDIA`이며, 공용 Catalog cutover는 발생하지 않음.
- shared mode용 bounded recovery 구현:
  - 정상 warm local cache는 기존처럼 먼저 반환되어 Worker/Firestore 추가 사용 없음.
  - remote read가 실제 필요하고 shared Catalog가 known revision을 만족하지 못할 때만 Worker가 `409 CATALOG_REPAIR_REQUIRED`를 반환.
  - 그 경우에만 클라이언트가 **해당 사용자 + 해당 kind(Music Note 또는 Library) 1개**에 대해 authenticated bootstrap을 1회 요청.
  - bootstrap은 전체 사용자/전체 collection scan이 아니라 해당 user/kind canonical source만 복구 대상으로 제한.
  - delta 적용 시 mutation `baseRevision` fence를 지켜 오래된 environment-local seed가 shared authority를 덮지 못하도록 보강.
- Release Controller에 Media Worker 승격/검증 경로를 포함해 앱 + Explore Worker만 승격되고 private Catalog runtime이 누락되는 gap을 차단.

검증:
- PREVIEW Media Worker Run `37379556479`: **SUCCESS**.
  - shared private Catalog bucket 존재/연결 PASS.
  - Worker build / deploy / R2 write-read / health / PREVIEW CORS PASS.
- 최종 Release System Audit Run `37379712972` at `d37f21390a5085cfcc4b4801208808861a2fdda8`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - release-system static verifier PASS.
  - TEST / PRODUCTION Worker dry-run only PASS.
  - shared D1 live preflight read-only PASS.
  - branch refs unchanged PASS.
- PREVIEW App Release Run `37381481452`: **SUCCESS**.
  - deployed commit `f87f863b40a59b7e9ec6de883f326904afe81ab6`.
  - app version **356**.
  - TypeScript PASS / Build PASS.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` exact build PASS.
  - TEST / PRODUCTION Hosting 및 protected refs unchanged PASS.
- 사용자 데이터 migration / copy / backfill / delete / rewrite: **0**.
- shared Catalog cutover: **아직 OFF**.
- Functions / Firestore Rules / shared D1 schema·trigger 변경: **0**.

현재 판단:
- cross-env parity 해결 방식은 **shared private Catalog authority**로 고정.
- 구현/검증/프리뷰 배포는 완료했지만 feature flag가 OFF이므로 아직 실제 parity 문제를 해결했다고 판정하면 안 됨.
- PREVIEW만 단독으로 shared flag를 켜면 TEST/PRODUCTION과 다시 다른 authority를 보게 되므로 금지.
- 다음은 TEST 승격 승인 시 dormant Media Worker + client support를 main/TEST로 함께 승격하고, TEST에서도 동일 `CATALOG` binding + flag OFF를 확인하는 것.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.
- 모든 활성 환경이 shared authority 코드를 이해하기 전 shared flag ON / W12->W2 shared-D1 cutover 금지.

## 0QD. app356 TEST 승격 완료 + Music Note/Library cross-env parity 신규 HARD GATE (2026-10-06 KST)

TEST 승격:
- Release Controller Run `37375259800`: **SUCCESS / TEST_VERIFIED**.
- source PREVIEW SHA: `f2d9eb0ad0ff067ec0ccc14bd450784dfcf1ed2e`.
- TEST Hosting: app **356**.
- TEST Explore Worker: `370f4451-a23c-44ce-9386-9964c836260b`.
- PREVIEW canonical Explore feature vars 3개가 TEST에도 exact-match PASS:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- TEST Worker smoke/verify PASS.
- PRODUCTION은 비변경.

최근생성곡 저장하트 / Music Note / Library 코드 parity:
- TEST 승격 후 아래 파일 blob SHA가 PREVIEW source와 TEST(main)에서 **완전히 동일**:
  - `src/App.tsx`
  - `src/lib/userDataEngine.ts`
  - `src/pages/FavoritesPage.tsx`
  - `src/pages/SunoLibraryPage.tsx`
  - `src/services/userDomainSyncService.ts`
  - `public/app-version.json`
- 따라서 TEST 승격 완료 이후에도 최근 생성곡 저장하트/Music Note/Library 결과가 다르면 **코드 버전 차이로 설명하면 안 됨**.

확인된 구조적 parity 위험:
- Firebase Auth/Firestore/RTDB canonical source는 PREVIEW/TEST/PRODUCTION 모두 동일 `soridraw-app-866a5`.
- 하지만 private Music Note/Library R2 Catalog endpoint는 환경별로 분리:
  - PREVIEW -> `soridraw-media-preview` / bucket `soridraw-media-preview`
  - TEST -> `soridraw-media-test` / bucket `soridraw-media-test`
  - PRODUCTION -> `soridraw-media` / bucket `soridraw-media`
- ordinary Catalog GET은 비용 보호 때문에 Firestore full rebuild를 수행하지 않고 R2-only로 fail-closed.
- 따라서 한 환경의 changed-item Catalog delta가 다른 환경의 R2 Catalog에 전달되지 않으면, canonical Firestore는 같아도 Music Note/Library 화면이 환경별 stale Catalog를 보여줄 수 있음.
- 이 구조는 사용자 고정 원칙인 **승격은 코드만 이동하고 동일 사용자 원본 데이터는 모든 환경에서 같아야 함**을 화면 결과 수준에서 보장하기에 부족함.

새 HARD GATE:
- PRODUCTION 승격 중단.
- Explore parity만 PASS로 보지 않음.
- 동일 계정 기준 PREVIEW/TEST의:
  1. Recent Song 저장하트 상태
  2. Music Note membership/list
  3. Library list
  4. Music Note/Library folder metadata
  5. 공개상태/Explore
  가 동일하게 수렴해야 TEST 검증 PASS.
- 해결은 사용자 데이터 복사/전체 backfill/full scan이 아니라, 변경분 O(1) 또는 shared canonical Catalog authority 방식이어야 함.
- 기존 app349 저장하트 즉시동기화, app301 folder sync, 비용 기준을 보호.
- 원인 확정 전 PRODUCTION/W2 shared-D1 cutover 금지.

## 0QC. 공개프로필 곡수 불일치 원인 확정 + app356 표시 교정 준비 (2026-10-06 KST)

사용자 실기기:
- 프로필 A 실제 공개곡 **24곡**: PREVIEW 헤더 23 / TEST 헤더 24.
- 프로필 B 실제 공개곡 **22곡**: PREVIEW/TEST 헤더 모두 23.
- 곡 목록 자체는 잠시 차이가 났다가 shared cache가 수렴하며 PREVIEW/TEST가 다시 일치함.

원인 분리:
1. 공개프로필 화면은 이미 받아온 실제 `profileTracks` 목록과 별도로 유지되는 `profile.trackCount` 값을 표시하고 있었음.
2. 렌더가 `profile.trackCount || profileTracks.length`라서, 유지 카운터가 1만 stale이어도 실제 목록 길이보다 stale 숫자가 우선 표시됨.
3. app355 타기기 공개/비공개 신호는 목록/로컬 profile cache를 changed-item으로 즉시 고치지만, 이미 렌더된 React `profile.trackCount` state는 별도라 PREVIEW 한쪽에서 23/24 차이가 보일 수 있음.
4. PREVIEW/TEST 모두 23인데 실제 목록 22인 사례는 shared profile R2의 유지 카운터가 과거 delta 누락으로 +1 drift한 상태와 일치. 곡 목록 자체를 다시 읽는 문제와는 별개.

안전 수정:
- `src/pages/ExplorePage.tsx`: first-view window가 **50곡 미만이면 이미 전체 공개곡 목록을 기기에 가지고 있으므로** 서버 카운터 대신 실제 `profileTracks.length`를 표시.
- 50곡 이상이면 기존 maintained `profile.trackCount`를 유지하되 loaded length보다 작아지지 않게 보호.
- 추가 Worker / D1 / R2 / Firestore read/write **0**.
- 공개/비공개/좋아요/저장하트/thumbnail/정렬/목록 자체 변경 0.
- commit `4b8830e8662d28ab7d6f9a8c5f5b8c9998c6f3a8`.
- app version **356** 준비.
- Explore 비공개 경고박스 제거 commit `ebdbe7cb9e9ce224c59ba900346329a78c6c4bc4`도 app356에 포함.

환경 격차 read-only 감사:
- Live Explore Runtime Audit Run `37368822795`: **SUCCESS**, shared/user D1 write 0.
- PREVIEW Worker `0badfdf8-597d-4f69-9a05-b6fb32612f01`:
  - `SORIDRAW_R2_CATALOG_V1=1`
  - `SORIDRAW_R2_HYBRID_READ_V1=1`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
- TEST Worker `6a0315db-8e17-46e6-b946-03133a4364f7`: 위 release feature flags **없음**.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`: 위 release feature flags **없음**.
- 세 환경 DB는 모두 shared canonical `217ef5b1-5d80-4f7c-afc7-9e07eb05c06b`, PROFILE_MEDIA도 모두 `soridraw-profile-media`.
- 따라서 곡 목록이 잠시 후 일치한 것은 shared R2 데이터 수렴이며, **환경 실행 설정까지 같다는 뜻은 아님**.
- 기존 Release Controller가 target Worker의 live vars를 `keep_vars`로 보존만 해서 PREVIEW의 새 feature flags를 TEST/PRODUCTION으로 승격하지 못하는 gap 확인.
- `.deploy/release-worker-runtime.mjs`를 수정해 TEST/PRODUCTION 승격 시 canonical PREVIEW release vars도 함께 승격하고 verify 단계에서 exact parity를 강제.
- static verifier도 동일 규칙을 hard gate로 추가.
- 이 release-controller 수정은 아직 TEST/PRODUCTION에 적용되지 않았으며 다음 immutable preflight PASS가 선행되어야 함.

## 0QB. app355 실기기 publication 재측정 — never-published 첫 공개 R6/W12만 HARD FAIL (2026-10-06 KST)

사용자 CACHE LIVE 실측:
- 이미 공개 이력이 있는 곡의 공개: Worker 1 / D1 query R1-W1 / physical **R4/W2**.
- 이미 등록된 곡의 source 1->2 전환: Worker 1 / D1 query R2-W1 / physical **R6/W3**.
- 한 번도 공개한 적 없는 Music Note 곡의 최초 공개: Worker 1 / D1 query R1-W1 / physical **R6/W12**.
- 그 신규 등록곡에서 이어진 source 전환: Worker 1 / D1 query R1-W1 / physical **R6/W3**.
- 따라서 app355 기준 신규 회귀가 아니라, 기존에 남아 있던 **first-publication INSERT fanout W12**가 정확히 재현됨.
- read는 과거 R7에서 현재 R6으로 줄었지만 write W12는 그대로라 hard gate FAIL.

W12 원인 — 기존 live schema read-only audit와 이번 실측이 일치:
1. canonical `tracks` INSERT **W6**
   - table row W1
   - PK autoindex W1
   - Music Note에도 적용되는 secondary index W4
2. legacy `explore_derived_tracks` INSERT **W5**
   - table row W1
   - PK autoindex W1
   - latest/popular/profile rank index W3
3. global `explore_shared_revision` UPDATE **W1**
= 총 **W12**.

이미 증명된 저비용 후보:
- isolated RATE_DB Run `37150337923`에서 cutoff 기반 candidate로:
  - first publication **W12 -> W2**
  - source/media swap **W3 -> W1**
  - visibility change **W2 -> W1**
  를 실제 D1 billing meta로 증명.
- 방식은 기존 사용자 row를 수정하지 않고, release cutoff 이후 새 Music Note row만:
  - legacy tracks secondary indexes 대상에서 제외
  - legacy derived mirror 대상에서 제외
  - legacy global shared-revision 대상에서 제외
  - canonical tracks row + PK만 유지
  하는 구조.
- 기존 row는 cutoff 이전 legacy 경로를 그대로 유지하므로 기존 등록곡의 기능/비용 경로를 건드리지 않는 설계가 가능.

현재 적용 차단:
- shared D1은 PREVIEW/TEST/PRODUCTION 공용.
- PREVIEW source/Worker는 R2 hybrid/R2-only publication authority가 준비돼 있음.
- TEST는 app354 승격으로 최신 Worker source는 올라갔지만 live environment flag/authority parity를 shared cutover 전에 별도 확인해야 함.
- PRODUCTION은 아직 이전 release라 새 Music Note row를 legacy derived/shared-revision 없이 안전하게 읽는 전체 parity가 보장되지 않음.
- 따라서 지금 W2 cutover를 shared D1에 바로 적용하면 정식앱의 Feed/profile/search/media freshness를 깨뜨릴 위험이 있어 **미적용 유지**.

보호 기준:
- 현재 registered 공개 **R4/W2**, source **R6/W3**, 비공개 **R3/W2** 경로는 추가 원인 없이 수정 금지.
- app355 PC↔모바일 공개/비공개 즉시 동기화 보호.
- 좋아요/저장하트/thumbnail/UI/Music Note/Library 정상 기능 보호.
- 새 구조는 비용이 기존보다 증가하면 FAIL.
- 사용자 row migration/backfill/delete/rewrite 금지.
- shared D1 변경은 3환경 read-authority parity 확인 + 사용자 승인 전 금지.

## 0QA. app355 PREVIEW — 공개곡 타기기 동기화 복구 + 새로고침 Worker 비증가 경로 배포 (2026-10-06 KST)

사용자 발견 회귀:
- 공개 동작 자체 비용은 **R4/W2**로 정상인데, 같은 계정의 다른 기기에서 공개곡이 즉시 보이지 않음.
- 변경 없는 새로고침에서 CACHE LIVE Worker가 1씩 증가하는 현상 보고.
- 비용 절감보다 정상 기능 보존을 우선하고 source 추가 절감 작업은 중단.

원인/수정:
- app335 이후 warm reload/route entry는 비용을 줄이기 위해 Cloudflare revision 확인을 막고 hidden→visible 때만 재검증했는데, 실제 공개 변경을 다른 기기에 알려주는 별도 change signal이 없어 warm cache가 오래 남을 수 있었음.
- 기존 사용자별 RTDB 동기화 채널에 **전용 `userSync/{uid}/explorePublication` 신호**를 additive로 추가.
- 공개/비공개가 canonical Explore에 성공한 뒤에만 작은 확정 상태를 1회 전달.
- 공개는 Worker 응답의 compact `snapshotItem`을 같이 전달하여 다른 기기가 Feed/공개프로필/뮤직노트 공개상태 캐시를 **기기에서 직접 변경**.
- 비공개는 해당 곡만 로컬 Feed/프로필 캐시에서 제거.
- 신호 수신/재생만으로 Cloudflare Worker를 호출하지 않음.
- 신호 실패는 이미 성공한 canonical 공개/비공개 동작을 실패 처리하지 않으며 기존 R2 revision 복구 경로를 유지.
- 다른 기존 Music Note / Recent / Like RTDB 신호는 변경하지 않음.

변경 파일:
- `src/services/userDomainSyncService.ts`
- `database.rules.json`
- `src/services/explorePublicationService.ts`
- `src/pages/FavoritesPage.tsx`
- `src/pages/ExplorePage.tsx`
- `public/app-version.json`
- `.deploy/preview-app-release.trigger`

검증/배포:
- immutable preflight Run `37364316058`: **SUCCESS**.
  - TypeScript / Build / release static checks / Worker dry-run / shared D1 read-only preflight PASS.
  - 실제 배포 없음.
- PREVIEW App Release Run `37365134850`: **SUCCESS**.
  - deployed exact commit: `6a6c05981e3945d6e67cd7623c35680cd1c0abd4`.
  - TypeScript PASS.
  - Build PASS.
  - shared RTDB Rules OAuth/PUT + exact source match PASS.
  - `NO_USER_DATA_MIGRATION=true`.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` app **355** / exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
- Cloudflare Worker code/deploy 변경 0.
- Functions / Firestore Rules / D1 schema·trigger / 사용자 원본 데이터 변경 0.
- shared RTDB Rules는 기존 규칙을 유지한 채 `explorePublication` owner-only bounded node만 추가.

환경 상태:
- PREVIEW: app355 fix 배포 완료.
- TEST: 직전 중단 요청 전에 이미 app354 승격 Run `37362260739`가 완료되어 **TEST_VERIFIED** 상태. app355는 아직 TEST에 올리지 않음.
- PRODUCTION: **비변경**. app355 또는 app354의 추가 PRODUCTION 승격 없음.

현재 실사용 게이트:
1. 기기 A에서 등록된 곡 공개 → 기존 D1 **R4/W2** 기능/비용 유지 확인.
2. 같은 계정 기기 B의 Music Note/Explore에 공개 상태/곡이 자동 반영되는지 확인.
3. 변경 없는 warm 새로고침에서 CACHE LIVE **Cloudflare Worker 0** 확인.
4. 기기 A 비공개 → 기기 B에서 해당 곡 자동 제거 확인.
5. 위 기능 PASS 전 source R6/W3 추가 절감 및 TEST/PRODUCTION 추가 승격 금지.

주의:
- app355의 "Worker 0"은 **정상 캐시가 있는 변경 없는 warm reload** 기준. 새 기기/캐시 없음은 필요한 최초 동기화를 할 수 있음.
- 실제 PC↔모바일 실사용 결과는 아직 **사용자 검증 전**.

## 0PZ. 동일 세션 연속 3단계 재확인 — R4/W2 → R6/W3 → R3/W2 (2026-10-06 KST)

사용자 확인 테스트를 같은 흐름에서 연속 실행:
1. 순수 공개: **R4/W2**.
2. 이어서 다른곡 source 전환: **R6/W3**.
3. 이어서 비공개: **R3/W2**.

공통:
- 각 동작 Worker 1.
- Firestore hot path R0/W0.
- 공개/비공개 정상 경로 비용이 source 전환 전후에도 흔들리지 않음.

판정:
- 364 적용 후 세 경로의 현재 제품 기준을 **공개 R4/W2 / source 전환 R6/W3 / 비공개 R3/W2**로 고정.
- 직전 공개 R6/W3 단발 캡처는 재현되지 않았으며 현재 기준값에서 제외.
- 공개/비공개는 추가 수정 금지.
- 남은 최적화 대상은 source 전환 R6/W3의 read만.
- shared D1 rollback 불필요, TEST/PRODUCTION 승격은 별도 승인 전 금지.

## 0PY. 순수 공개 실기기 재확인 — R4/W2 정상, 공개 회귀 해제 (2026-10-06 KST)

사용자 재테스트:
- 비공개 상태에서 공개 설정을 열고 곡 선택/옵션을 전혀 건드리지 않은 채 즉시 `공개` 실행.
- CACHE LIVE 결과:
  - Worker 1.
  - D1 query R1/W1.
  - D1 physical **R4/W2**.
  - Firestore hot path **R0/W0**.
  - R2 Class A 15 / Class B 10.
- 공개 모달을 연 시점에는 서버 사용 0, 실제 공개 버튼 실행에서만 위 비용 발생.

판정:
- 364 적용 후 **순수 공개 경로는 기존 기준 R4/W2로 정상 유지**.
- 직전 R6/W3 캡처는 순수 공개의 고정 회귀가 아님. 해당 실행에서 media/source 관련 조건이 함께 섞였을 가능성이 있으나 정확한 조건은 미확정.
- 따라서 `공개 R6/W3 media-path 오진입`을 현재 blocker로 보지 않는다.
- 현재 남은 비용 이슈는 source 1->2 **R6/W3**.
- 비공개는 **R3/W2** 정상 유지.
- 364 rollback 불필요.
- TEST/PRODUCTION 승격 판단은 source/media 기능 parity 확인 후 별도.

## 0PX. 364 실기기 재측정 — source 개선 / 공개 회귀로 현재 게이트 FAIL (2026-10-06 KST)

사용자 실기기 CACHE LIVE 순서:
- 공개: D1 **행읽기 R6 / 행쓰기 W3**.
- source 1->2: D1 **행읽기 R6 / 행쓰기 W3**.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**.
- Firestore hot path R0/W0, Worker 1회씩.

판정:
- source 1->2는 직전 **R10/W3 -> R6/W3**로 유의미하게 감소.
- 비공개는 기존 **R3/W2 유지**.
- 공개는 직전 **R4/W2 -> R6/W3**로 회귀했으므로 현재 릴리스 게이트는 **FAIL**.
- TEST/PRODUCTION 승격 금지. 좋아요/저장하트/UI/thumbnail은 건드리지 않음.

원인 분리용 격리 Cloudflare D1 재측정:
- Run `37356891372` — ephemeral D1 only, cleanup PASS.
- 364 candidate 순수 registered 공개: **R3/W2**.
- 364 candidate 순수 registered 비공개: **R3/W2**.
- 364 candidate 공개 + media field 변경: **R4/W3**.
- 364 source/media 전환: **R4/W3**.
- verifier PASS / shared-user D1 touched 0.
- 기존 364 검증의 `REGISTERED_VISIBILITY_W2_GUARD`는 pre-364/current trigger를 검사하고 있어 candidate 자체 visibility 보장이 아니었던 coverage gap을 수정함.

현재 결론:
- 364 trigger 자체의 **순수 visibility 공개는 W2**로 재증명됨.
- 사용자 공개 R6/W3의 쓰기 형태는 순수 공개가 아니라 **media-capable path가 함께 깨어난 경우와 같은 W3 signature**임.
- 따라서 지금 즉시 364를 rollback하면 source read 개선만 잃고 공개 원인을 못 고칠 가능성이 높아 rollback은 실행하지 않음.
- 다음은 실제 제품 공개 batch가 왜 media path를 깨우는지 `registered / selectionChanged / refreshSourceMedia / sourceMedia` 경계를 정확히 추적하고, 순수 공개가 media update를 절대 포함하지 않도록 원인 지점만 수정한다.
- 추가 shared D1 trigger 변경/rollback은 사용자 승인 전 실행 금지.

## 0PW. 사용자 승인 364 shared D1 trigger cutover 완료 (2026-10-06 KST)

사용자 승인 범위:
- source 1->2 D1 행읽기 절감용 364 shared-D1 trigger 2개 교체.
- 다른 기능/좋아요/저장하트/UI/thumbnail/사용자 데이터는 변경 금지.

적용 결과:
- 첫 적용 Run `37352653590`: postflight exact-text 비교가 Cloudflare D1의 trigger SQL 정규화와 달라 **FAIL**, 즉시 자동 rollback 실행.
  - `364_EXACT_ROLLBACK_VERIFIED=PASS`.
  - 사용자 row 변경 0.
- postflight를 exact text가 아닌 고정된 trigger semantic invariant + unrelated trigger exact comparison으로 보강.
- 재적용 Run `37352860772`: **SUCCESS**.
  - `364_LIVE_BASELINE_MATCH_ROLLBACK=PASS`.
  - `364_TARGET_TRIGGER_SEMANTICS=PASS`.
  - `364_ONLY_TWO_APPROVED_TRIGGERS_CHANGED=PASS`.
  - `364_SHARED_REVISION_UNCHANGED=PASS`.
  - `364_USER_ROWS_TOUCHED=0_BY_DDL_CONTRACT`.
  - PREVIEW / TEST / PRODUCTION feed smoke PASS.
  - Worker versions unchanged PASS:
    - PREVIEW `0badfdf8-597d-4f69-9a05-b6fb32612f01`
    - TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`
    - PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`
  - main / production refs unchanged PASS.
- post-cutover Release System Audit Run `37352997906`: **SUCCESS**.
- 완료된 TEMP 364 apply workflow는 삭제하여 비의도 재실행 경로 제거.
- exact rollback SQL 및 guarded runner는 저장소에 유지.
- migration/backfill/delete/user-row rewrite 0.
- Firebase Hosting/Functions/Rules 추가 변경 0.
- TEST/PRODUCTION Worker code 변경 0.

현재 비용 목표:
- 직전 실기기 source 1->2: **D1 행읽기 R10 / 행쓰기 W3**.
- 364 격리 증명: trigger 부분 R9 -> R4, 따라서 현재 제품 source 전환 예상 **약 R5/W3**.
- 공개 **R4/W2**, 비공개 **R3/W2** 경로는 이번 trigger가 media/source change에만 작동하도록 보호.
- 다음은 같은 A곡 source 1->2 실기기 CACHE LIVE 재측정. 기능 차이 또는 비용 목표 미달이면 rollback 기준으로 원인 재분해.

## 0PV. app354 PREVIEW UI warning removal + 365 live measurement confirmed (2026-10-06 KST)

사용자 실기기 CACHE LIVE 재측정:
- 공개: D1 **행읽기 R4 / 행쓰기 W2**.
- source 1->2: D1 **행읽기 R10 / 행쓰기 W3**.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**.
- 365 예상값과 정확히 일치. 같은 request의 중복 canonical like read 1회를 제거한 효과가 실제 제품에서 확인됨.

source 1->2만 R10/W3인 이유:
- 공개/비공개는 visibility 상태만 바꾸므로 heavy legacy media projection trigger를 깨우지 않음.
- source/media 전환은 cover/duration/Suno URL 등 media field를 바꾸므로 old TEST/PRODUCTION 호환용 legacy derived mirror trigger가 실행됨.
- 현재 source 전환 physical writes:
  1. canonical `tracks` W1.
  2. legacy `explore_derived_tracks` media mirror W1.
  3. shared revision W1.
  = **W3**.
- current trigger chain의 격리 UPDATE RETURNING 비용 R9에 publication 후 canonical like 확인 R1이 더해져 실제 product **R10**.
- 364 compatibility candidate는 old TEST/PRODUCTION 호환을 유지하면서 trigger read를 줄이는 후보이며 isolated target은 source 전환 약 **R5/W3** product 수준.
- legacy mirror를 제거하는 357은 모든 환경이 새 R2 authority로 승격된 뒤 별도 승인 시 최종 **R4/W2** 수준 재검증 후보.

사용자 UI 요청:
- 비공개 확인 모달의 경고 문구
  `비공개로 전환하면 Explore와 공개 프로필에서 즉시 숨겨집니다. D1 기록은 삭제하지 않습니다.`
  를 제거.
- 확인 버튼/비공개 동작/배치 로직/데이터 처리는 변경하지 않음.
- 변경 파일: `src/pages/FavoritesPage.tsx`.
- app version: **354**.
- Firebase PREVIEW Hosting Run `37350776803`: **SUCCESS**.
- TypeScript PASS / Build PASS / PREVIEW exact build PASS / TEST-PRODUCTION unchanged PASS.
- Worker/Functions/Rules/shared D1/user data 변경 0.

## 0PU. 사용자 실기기 R5/R11/R3 분석 후 365 PREVIEW 배포 완료 (2026-10-06 KST)

사용자 동일 A곡 실기기 CACHE LIVE 결과:
- 공개: D1 **행읽기 R5 / 행쓰기 W2**, D1 쿼리 읽기 2 / 쓰기 1.
- source 1->2: D1 **행읽기 R11 / 행쓰기 W3**, D1 쿼리 읽기 2 / 쓰기 1.
- 비공개: D1 **행읽기 R3 / 행쓰기 W2**, D1 쿼리 읽기 0 / 쓰기 1.

원인 확정:
- 공개/source 전환에서 남은 D1 읽기 쿼리 2개는 publication 후 Feed R2와 Public Profile R2를 갱신할 때
  같은 곡의 canonical like_count를 `readCanonicalPublicationLike071`로 각각 한 번씩 중복 확인하는 경로.
- source 전환 R11은 current trigger chain UPDATE RETURNING 기준 격리 R9 + canonical like 확인 R1 + R1과 일치.
- 비공개는 item 제거 경로라 canonical like 재확인이 없어 D1 query read 0.

365 수정:
- `readCanonicalPublicationLike071`의 정확한 D1 canonical authority는 그대로 유지.
- 같은 Worker request / 같은 trackId 안에서 첫 canonical like read Promise만 request-local WeakMap으로 공유.
- 두 번째 Feed/Profile 확인만 제거. 다른 request 간 cache 공유 없음.
- 좋아요 쓰기 경로, like_count 의미, 하트, UI, 저장하트 변경 0.
- patch: `095-publication-canonical-like-request-cache.mjs`.
- verifier: `verify-365-publication-canonical-like-request-cache.mjs`.
- 첫 Audit Run `37349153504` FAIL은 기존 follow strict-audit가 365의 의도된 publication helper 변경을 unrelated change로 판단한 검사식 문제였고, 제품 기능 실패 아님.
- follow audit normalization 보강 후 Release System Audit Run `37349479060`: **SUCCESS**.
- PREVIEW Worker Release Run `37349747533`: **SUCCESS**.
- active PREVIEW Worker:
  - before `368d64ac-6b66-4023-88ec-a3ed85068844`
  - after `0badfdf8-597d-4f69-9a05-b6fb32612f01`
- 배포 후 smoke:
  - Feed PASS.
  - Profile PASS.
  - changed-card D1 R0/W0 PASS.
  - warm revision R0/W0 PASS.
  - TEST/PRODUCTION Workers unchanged PASS.
- shared D1 schema/trigger, user data, Firebase Hosting, Functions, Rules 변경 0.
- 364 shared-D1 candidate는 여전히 미적용.

다음 실기기 목표:
- 동일 순서 재측정:
  1. 공개: 기존 R5/W2에서 **R4/W2 예상**.
  2. source 1->2: 기존 R11/W3에서 **R10/W3 예상**.
  3. 비공개: 기존 **R3/W2 유지 예상**.
- 이후 source R10의 대부분은 shared D1 legacy trigger fanout이므로, 사용자 승인 시 364 shared-D1 trigger 적용으로 isolated 기준 추가 절감 후보 **R5/W3**.
- TEST/PRODUCTION이 새 authority로 승격된 뒤 legacy mirror 제거 357 후보는 최종 **R4/W2 수준**을 목표로 재검증.

## 0PT. PREVIEW 361 사용자 실기기 CACHE LIVE 결과 — 공개 개선, source 전환 미해결 (2026-10-06 KST)

사용자 동일 A곡 순서 실측:
1. 공개: D1 **행읽기 R5 / 행쓰기 W2**, D1 쿼리 읽기 2 / 쓰기 1.
2. source 1->2 전환: D1 **행읽기 R11 / 행쓰기 W3**, D1 쿼리 읽기 2 / 쓰기 1.
3. 비공개: D1 **행읽기 R3 / 행쓰기 W2**, D1 쿼리 읽기 0 / 쓰기 1.

판정:
- 361 PREVIEW Worker 배포 효과는 공개 경로에서 확인됨: 직전 사용자 실기기 공개 R11 계열 -> 현재 **R5/W2**.
- 비공개는 **R3/W2 유지**, 회귀 없음.
- source 전환은 **R11/W3로 여전히 FAIL**. 361의 inline media preselect 제거만으로 실제 product source-swap의 두 D1 read query 및 legacy trigger fanout이 해소되지 않았음.
- 따라서 다음 작업은 source 전환 R11/W3만 집중. 공개/비공개/좋아요/저장하트/UI/thumbnail은 변경 금지.
- 364 shared-D1 candidate는 isolated R4/W3까지 증명됐지만 아직 shared trigger 미적용. 사용자 승인 전 적용 금지.
- TEST/PRODUCTION unchanged.

## 0PS. 361 PREVIEW live 완료 / 364 rollback·최종 감사 PASS (2026-10-06 KST)

- PREVIEW Worker 361 실제 배포:
  - source lock: `ed2458cff29b978960d1169141ca16f076243272`.
  - deploy trigger: `7031afcb713bf3ba21d83317600e36e871c85e30`.
  - Worker Release Run `37344481780`: **SUCCESS**.
  - active PREVIEW Worker: `368d64ac-6b66-4023-88ec-a3ed85068844`.
  - Feed/Profile smoke PASS.
  - public-like changed-card D1 **R0/W0**.
  - warm revision D1 **R0/W0**.
  - TEST/PRODUCTION Workers unchanged PASS.
- 364 compatibility candidate safety:
  - target: normal source 1->2 D1 **행읽기 R4 / 행쓰기 W3**.
  - legacy media mirror 유지.
  - shared revision 유지.
  - missing-derived repair / content rebuild 유지.
  - exact rollback SQL 추가:
    `cloudflare/explore-worker/candidates/364-publication-read-compaction-compat-rollback.sql`.
  - rollback verifier 추가 및 Release System Audit Run `37344906830`: **SUCCESS**.
  - shared/user D1 write 0, migration/backfill/delete/rewrite 0.
- 완료된 임시 진단 workflow 3개는 삭제함. 재현용 측정 script/verifier/candidate/rollback은 저장소에 유지.
- 현재 실제 blocker:
  - 364는 **shared D1 trigger 변경**이므로 사용자 명시 승인 전 적용 금지.
  - 지금 사용자 실기기에서 먼저 A 공개 / source 1->2 / 비공개의 D1 행읽기 R / 행쓰기 W를 다시 측정하면 361 live 효과를 확인할 수 있음.
  - TEST/PRODUCTION이 새 R2 authority로 승격된 뒤에는 legacy mirror 제거 357 후보로 **R3/W2** 추가 절감 가능.

## 0PR. PREVIEW publication Rows Read 361 배포 완료 + 364 shared-D1 후보 준비 (2026-10-06 KST)

- 사용자 기준: 모든 R/W 보고는 Cloudflare D1 **물리 행 기준**으로 표기.
- 실제 원인 분해:
  - source 1->2 현재 trigger chain 격리 실측: UPDATE RETURNING 포함 **R9 / W3**.
  - current legacy track projection + Music Note derived trigger가 불필요한 read 대부분을 차지함.
  - 357 구환경 호환 제거 후보는 **R3 / W2**까지 가능하지만 TEST/PRODUCTION old reader 보호 때문에 아직 shared D1에 미적용.
- 호환 유지형 364 후보:
  - legacy media mirror와 shared revision을 유지한 채 trigger 내부 redundant read만 줄이는 방식.
  - 격리 Cloudflare D1 Run `37335417591`: **R9/W3 -> R4/W3 PASS**.
  - missing-derived repair / content rebuild / registered public-private W2 guard PASS.
  - shared/user D1 touched 0.
  - candidate: `cloudflare/explore-worker/candidates/364-publication-read-compaction-compat.sql`.
  - verifier: `scripts/verify-364-publication-read-compaction-compat.mjs`.
  - 자동 적용 wiring 없음.
- Worker-only 361:
  - first-public R2 precheck + inline source/media authority 사용으로 불필요 canonical pre-read 제거.
  - Release System Audit Run `37344089981`: **SUCCESS**.
  - PREVIEW Worker Release Run `37344481780`: **SUCCESS**.
  - active PREVIEW Worker before `afbb5d00-a489-4c48-8b02-9ad6f1795bb0`.
  - active PREVIEW Worker after `368d64ac-6b66-4023-88ec-a3ed85068844`.
  - Feed/Profile/R2-only smoke PASS, changed-card D1 R0/W0, warm revision R0/W0.
  - TEST/PRODUCTION Workers unchanged PASS.
- 변경하지 않은 것:
  - Firebase Hosting 0.
  - Functions/Rules 0.
  - shared D1 schema/trigger 0.
  - user data migration/backfill/delete/rewrite 0.
  - UI/CSS/좋아요/저장하트/thumbnail 변경 0.
- 현재 다음 게이트:
  1. PREVIEW 실기기에서 A 공개 / source 1->2 / 비공개 D1 **행읽기 R / 행쓰기 W** 재측정.
  2. 364 shared-D1 trigger 적용은 shared DB 변경이므로 사용자 명시 승인 전 실행 금지.
  3. TEST/PRODUCTION 승격 후 legacy mirror 제거가 가능해지면 357로 최종 **R3/W2 후보**를 별도 승인 후 적용.

## 0PQ. 사용자 비용 우선순위 재고정 — Rows Read 1순위, Rows Written 2순위 (2026-10-05 KST)

- 사용자 재지시:
  1. **D1 physical Rows Read 최소화가 1순위**.
  2. D1 physical Rows Written W1~W2가 2순위.
  3. mutation Worker 요청 1 이하.
  4. 기능/UI/좋아요/저장하트/thumbnail 보존.
- 최신 실기기 CACHE LIVE 캡처에는 A 한 곡 mutation에서 행읽기 **R11 / R8 / R3**가 관측됨.
- 직전 360 isolated proof는 W3->W2 가능성 확인 목적이라 synthetic rows_read 2/3/2만 확인했으며, 실제 product R11/R8/R3를 설명/감축한 검증은 아니었음.
- 따라서 현재 작업은 쓰기 W2 cutover보다 먼저:
  - A 공개 / source 1->2 / 비공개 각각의 product D1 Rows Read를 query/trigger 단위로 분해.
  - exact PK lookup 외 불필요한 profile/stats/legacy-derived/revision read를 제거 또는 R2/local payload로 대체 가능한지 검증.
  - whole table/owner collection scan은 즉시 FAIL.
- TEST/PRODUCTION 미승격 자체가 추가 읽기/쓰기를 직접 발생시키는 것은 아님.
  - 다만 shared D1이 구 TEST/PRODUCTION 코드와 동시에 호환되어야 해서 legacy mirror/revision을 아직 유지하고 있고, 그 호환용 trigger/projection이 PREVIEW mutation의 추가 비용에 포함됨.
- shared D1 / user data mutation은 사용자 승인 전 계속 금지.

## 0PP. A 한 곡 publication 비용 후보 실측 PASS — W2/W2/W2, 아직 shared D1 미적용 (2026-10-05 KST)

- 사용자 현재 목표를 A 한 곡의 세 동작으로 한정:
  1. 공개.
  2. 생성 1번곡 -> 2번곡 source/media 전환.
  3. 비공개.
- 사용자 CACHE LIVE 캡처의 현재 product 비용은 physical D1 **W3 1건 + W2 2건**이며, 변화가 없다는 지적이 맞음.
  - 직전 app358은 read authority 전환이어서 이 mutation fanout을 직접 줄이지 않았음.
- 범위 고정 verifier:
  - `scripts/verify-360-publication-a-track-cost-target.mjs`
  - commit `09d78fa6f6c583771d18e5827c30aa11d846daac`.
  - release audit hard gate commit `f63bbe94ef52c52d3ab48277b492617871d770bb`.
- 실제 Cloudflare 원격 **격리 D1** 비용 실측:
  - script `scripts/measure-360-isolated-publication-d1.mjs`
  - commit `e66413faba1b3941eceefc51bfc5d7722c408ac7`.
  - audit wiring commit `6db6da363637b5b32c08956cb1eb885a32b640cf`.
  - audit Run `37301210759`: **SUCCESS**.
- Run 37301210759 정확한 결과:
  - A 공개: `rows_written=2`, `rows_read=2`.
  - 현재 A 1->2 source 전환: `rows_written=3`, `rows_read=3`.
  - 357 candidate 적용 상태 A 1->2 source 전환: `rows_written=2`, `rows_read=2`.
  - A 비공개: `rows_written=2`, `rows_read=2`.
  - 최종 isolated sequence: **W2 / W2 / W2 PASS**.
  - temporary D1는 완료 후 삭제 PASS.
  - shared/user D1 touched = 0.
- W3 원인과 제거 지점:
  1. canonical `tracks` media UPDATE W1 — 유지.
  2. legacy `explore_derived_tracks` media mirror W1 — **media-only일 때 제거 후보**.
  3. `soridraw_shared_rev_tracks_au_051` shared revision W1 — 현재 유지.
  - 따라서 357 candidate는 기능을 없애지 않고 legacy media-only mirror만 생략해 W3 -> W2로 줄임.
- 현재 제품에는 아직 미적용:
  - `PRODUCT_SHARED_D1_CUTOVER=NOT_APPLIED`.
  - 따라서 지금 PREVIEW 실기기에서 다시 누르면 source 전환은 여전히 W3가 나오는 것이 정상.
- 적용 차단 이유:
  - shared D1은 PREVIEW/TEST/PRODUCTION 공용.
  - 현재 main/TEST/PRODUCTION old Worker는 336/341/358 R2-only compatibility가 없고 legacy derived/revision 경로를 계속 사용.
  - shared trigger만 먼저 바꾸면 구환경 공개곡 media freshness를 깨뜨릴 수 있음.
  - 사용자 승인 없이 shared D1 trigger 변경, main/TEST 승격, PRODUCTION 승격 금지.
- 검증:
  - TypeScript PASS.
  - Build PASS.
  - static audit PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight read-only PASS.
  - branch refs unchanged PASS.
- 절대 보호:
  - 좋아요/저장하트 즉시동기화.
  - +30초 canonical save.
  - app353 thumbnail.
  - UI/CSS.
  - 사용자 데이터 delete/backfill/rewrite 없음.

## 0PO. 사용자 범위 재고정 — A 한 곡의 공개/2번곡 전환/비공개 비용만 최적화 (2026-10-05 KST)

- 사용자 지시로 현재 우선순위를 다시 고정:
  1. A 한 곡 공개.
  2. 같은 A에서 생성 1번곡 -> 2번곡 source 전환.
  3. A 비공개.
- 최신 실기기 CACHE LIVE 캡처에서 mutation 3회는:
  - Worker는 각 요청 1회.
  - physical D1 writes는 **W3 한 건 + W2 두 건**.
  - 관측 예: R11/W3, R8/W2, R3/W2.
- 판정:
  - W2 두 경로는 현재 합격선 안이므로 정상 기능 보호를 우선하고 불필요하게 다시 건드리지 않음.
  - 남은 HARD FAIL은 **source/media 전환 W3 -> W2 이하**.
  - 직전 358 R2-only 작업은 read prerequisite였고, 이 mutation physical-write 숫자를 직접 줄이지 않으므로 사용자 체감상 "변화 없음"이 맞음.
- W3 원인 재확정:
  1. canonical tracks media UPDATE W1.
  2. legacy explore_derived_tracks media mirror W1.
  3. shared revision W1.
- 이미 준비된 357 candidate는 media-only legacy mirror만 제거하여 **W2**를 목표로 함.
- 이번 범위를 코드/감사에서 다시 잠그기 위해:
  - `scripts/verify-360-publication-a-track-cost-target.mjs`
  - commit `09d78fa6f6c583771d18e5827c30aa11d846daac`
  - Release System Audit hard gate 추가 commit `f63bbe94ef52c52d3ab48277b492617871d770bb`.
- 중요한 안전 제한:
  - shared D1은 PREVIEW/TEST/PRODUCTION 공용.
  - 현재 TEST/PRODUCTION old Worker는 legacy derived/revision read path를 아직 사용하므로, W3->W2 trigger cutover를 PREVIEW만 위해 shared D1에 적용하면 구환경 카드/media freshness를 깨뜨릴 수 있음.
  - 따라서 **사용자 승인 없는 shared D1 trigger 변경/PRODUCTION 승격은 금지**.
- 현재 실제 다음 목표:
  - A-track W2 candidate를 Release Audit + 격리 비용 검증으로 확정.
  - 필요한 cross-env compatibility 승격 범위를 최소화.
  - 실제 shared D1 cutover 전에는 사용자에게 정확한 영향/승인 필요 지점을 한 번만 보고.
- 절대 보호:
  - 좋아요/저장하트 즉시 동기화.
  - +30초 canonical save.
  - app353 thumbnail.
  - UI/CSS/반응형.
  - 사용자 원본 데이터 delete/backfill/rewrite 금지.

## 0PN. PREVIEW R2-only publication read 실제 배포/실API 검증 PASS — 사용자 실사용 확인 대기 (2026-10-05 KST)

- 목적: dormant app358을 PREVIEW에서만 실제 활성화하고 Feed/Profile/Genre/Search가 shared D1 없이 동작하는지 live Worker에서 확인.
- 활성화:
  - `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1=1`
  - activation commit `5f5085689549c456056fd9d0d373c1e86d7f6532`.
- verifier/release guard:
  - active-flag verifier commit `d97351407d42d83e28ec36c0f6f3d8b88bd6fb86`.
  - live smoke guard commit `c572b7c5611fb4de2e9617b84cdcb771fc99df9b`.
  - propagation-safe smoke fix `4d162ea6587f0355af89a12a97731e0fbe2884aa`.
  - temporary remote-dev diagnostic은 완료 후 삭제 commit `7c4af5e4131490fe95c120c43cf2ac36bacef2da`.
- Release System Audit:
  - Run `37292378308`: SUCCESS — active flag / TypeScript / Build / Phase-B / TEST·PROD dry-run PASS.
  - propagation fix 후 Run `37293416600`: SUCCESS.
- 첫 PREVIEW Worker deploy Run `37292714110`:
  - candidate Worker version `59181b26-26c3-4041-9676-77b2dd3fc62c` 업로드/배포까지 성공.
  - 배포 직후 첫 edge request가 아직 구 Worker를 응답하여 358 authority header가 없어서 smoke FAIL.
  - 자동 rollback이 즉시 동작하여 기존 정상 version `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`로 100% 복구 SUCCESS.
  - shared D1/R2/user data rollback 작업은 없었음.
- 원인 분리:
  - read-only remote-dev Run `37293014067`: R2-only latest/popular HTTP 200, `R2-ONLY-358`, D1 R0/W0 확인.
  - full first-page read Run `37293243993`: latest limit40 HTTP 200 / D1 R0W0, popular limit20 HTTP 200 / D1 R0W0.
  - 따라서 source/runtime 오류가 아니라 **Cloudflare deploy 완료 직후 edge propagation 시간차**로 확정.
  - 재배포 smoke는 cheap limit1 probe로 새 authority가 실제 edge에 도달할 때까지 bounded wait 후 full test하도록 수정.
- 최종 PREVIEW deploy:
  - trigger commit `a7573ea1b15541158e6f8c8a2e5b9e7b2f68ec53`.
  - Run `37293663953`: **SUCCESS**.
  - before `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`.
  - active after `afbb5d00-a489-4c48-8b02-9ad6f1795bb0`.
  - propagation attempt 1: HTTP 200 / authority missing = old edge.
  - attempt 2: HTTP 200 / `R2-ONLY-358` = new edge active.
- 최종 live API PASS:
  - latest Feed: R2-only / D1 **R0 W0**.
  - popular Feed: R2-only / D1 **R0 W0**.
  - public profile tracks: R2-only / D1 **R0 W0**.
  - genre tracks: R2-only / D1 **R0 W0**.
  - title Search app341: R2-only / D1 **R0 W0**.
  - public-like changed-card: D1 **R0 W0**.
  - warm feed revision: D1 **R0 W0**.
  - `TEST_PRODUCTION_WORKERS_UNCHANGED=PASS`.
- 변경 범위:
  - Firebase Hosting 변경 0.
  - Functions/Rules 변경 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - TEST/PRODUCTION deploy 0.
- 현재 판정:
  - PREVIEW backend read cutover는 실제 live Worker 검증까지 PASS.
  - PC/모바일 UI 실사용 및 사용자가 직접 수행하는 공개/비공개/source-swap/좋아요 조작은 **실사용 검증 전**.
  - shared D1 first-public W12→W2 fanout cutover는 아직 적용 금지.
  - TEST 승격은 사용자 PREVIEW 실사용 확인 후에만 진행.

## 0PM. dormant R2-only publication read integration hard-gate PASS (2026-10-05 KST)

- 목표: 358 정적 source guard만 통과시키지 않고, 기존 R2 catalog Phase-B 기능 검증을 Release System Audit의 **hard gate**로 연결.
- audit workflow 변경:
  - `.github/workflows/soridraw-release-system-audit.yml`
  - commit `b5174d4ec055aef29affb331f2fcfed8af306a49`
  - hard `Static release-system verification` 단계에
    `scripts/verify-publication-w2-r2-catalog-phase-b.mjs` 추가.
- audit trigger HEAD:
  - `ac65599e705a1fe8f6dae2f31c470c251513d92a`
- Release System Audit Run `37247619845`: **SUCCESS**.
- hard integration 확인:
  - `PUBLICATION_R2_ONLY_358_SOURCE=PASS`
  - `PUBLICATION_R2_ONLY_358_FLAG_DEFAULT_OFF=PASS`
  - `W2_PHASE_B_R2_INTEGRATION=PASS`
  - latest deep paging PASS
  - popular deep paging PASS
  - public profile deep paging PASS
  - title search PASS
  - genre search PASS
  - artist search PASS
  - private/republish catalog marker PASS
  - first-publisher retry idempotency PASS
  - TEST Worker dry-run PASS
  - PRODUCTION Worker dry-run PASS
- 안전 상태:
  - 358 flag는 계속 OFF.
  - Worker deploy 0 / Firebase deploy 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - main/TEST/PRODUCTION branch 변경 0.
- 현재 남은 blocker:
  - main/TEST/production source는 아직 336/341/358 compatibility를 포함하지 않는 구 기준.
  - 따라서 shared D1 secondary-index/derived/revision fanout 제거와 358 flag ON은 계속 금지.
  - 다음 단계는 사용자 TEST 승격 승인 전까지 cross-env promotion readiness를 read-only로 유지하는 것.
- 비차단 노트:
  - `diagnose-069-live-like.yml`은 push마다 job 생성 없이 failure 상태를 남기는 오래된 진단 workflow 문제가 계속 보임.
  - 이번 358 release-system audit와 hard integration gate는 별도 SUCCESS이며 제품/358 검증 결과에는 영향 없음.

## 0PL. dormant R2-only publication read cutover 구현/감사 PASS — 아직 OFF, 배포/공유 D1 변경 없음 (2026-10-05 KST)

- 기준 preview implementation:
  - gate/runtime commit: `cec2411dc1afdf11a4ca37104089bc065aef1818`
  - composer/verifier commits: `63ada6c2be3053b409b6d0624c00606e8ed9f217`, `1c4f21e995e17577aadd1759a67425a468b5af2a`
  - canonical composed Worker: `38f56add6d5c1091b247a2b0838d2402f5439ca0`
  - canonical checksum pin: `792271da150fa21219cd6f62a5e67fccb7096e98`
  - final audit trigger HEAD: `35526001248414ec2b2cec76dbf22e12203a9df6`
- Release System Audit Run `37233167868`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - TEST Worker dry-run PASS.
  - PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight는 read-only PASS.
  - branch refs unchanged PASS.
- 신규 dormant flag:
  - `SORIDRAW_PUBLICATION_R2_ONLY_READ_V1`
  - PREVIEW wrangler에는 **아직 값이 없으므로 default OFF**.
  - gate는 catalog + hybrid + R2-only 세 조건이 모두 1일 때만 켜짐.
- ON 경로 계약:
  - Feed / Public Profile tracks / Genre는 R2 ordered catalog + shared track-card만 authority로 사용.
  - legacy derived row와 merge하지 않음.
  - Search는 기존 app341 R2-only authority를 그대로 보호.
  - 정상 R2-only path D1 read/write = **R0/W0** 정적 검증 PASS.
  - source swap은 shared track-card media authority를 사용.
  - private 이후 stale legacy row가 R2-only list를 되살리는 경로 없음.
- OFF 경로 계약:
  - 현재 app336 hybrid behavior를 core358로 그대로 보존.
  - flag OFF이면 기존 PREVIEW 실제 동작 변경 없음.
- 공유 데이터/배포:
  - Worker 배포 0.
  - Firebase Hosting 배포 0.
  - shared D1 migration/schema write 0.
  - user data migration/backfill/delete/rewrite 0.
  - TEST/PRODUCTION 변경 0.
- 아직 CUTOVER READY 아님:
  - audit 출력 `PUBLICATION_R2_ONLY_358_CUTOVER_READY=false`.
  - main/TEST/PRODUCTION에는 app336/app341/358 read authority가 아직 승격되지 않음.
  - default branch search에서도 336/341/358 markers 미탐지.
  - shared D1 fanout 축소는 이 cross-env blocker가 해소되기 전 실행 금지.
- 참고:
  - 같은 HEAD의 오래된 `diagnose-069-live-like.yml` 자동 workflow는 job 생성 없이 failure로 남지만, 이번 release-system audit와 358 verifier는 별도로 SUCCESS이며 358 작업의 합격 판정에는 사용하지 않는다.

## 0PK. never-published first publication W12 live schema exact fanout 확정 — read-only (2026-10-05 KST)

- 목적: first-public W12를 추측이 아니라 **현재 shared D1 실제 schema**로 정확히 분해.
- 임시 read-only 진단 workflow:
  - Run `37232092133`: SUCCESS.
  - 보강 Run `37232155889`: SUCCESS.
  - `REMOTE_D1_WRITES=0`.
  - `USER_DATA_MUTATION=0`.
  - 진단 완료 후 temp workflow 삭제 commit `4a3d32914e95553ec7fc6004085f2281856a27b9`.
- 현재 live `tracks`:
  - row count 70.
  - music_note 70.
  - public music_note 46.
  - `id TEXT PRIMARY KEY`이며 `sqlite_autoindex_tracks_1` 존재.
  - 명시 index 5개:
    1. `idx_tracks_latest_order`
    2. `idx_tracks_owner_latest`
    3. `idx_tracks_owner_source` UNIQUE
    4. `idx_tracks_primary_genre_latest`
    5. `idx_tracks_legacy_global_nonempty` partial
  - Music Note는 `legacy_global_id`가 비어 있으므로 5번 partial index에는 정상 first publish에서 entry를 만들지 않음.
- **현재 사용자 실측 W12와 live schema가 정확히 맞음**:
  1. canonical `tracks` INSERT:
     - table row W1
     - PK autoindex W1
     - latest_order W1
     - owner_latest W1
     - owner_source W1
     - primary_genre_latest W1
     - subtotal **W6**
  2. `explore032_track_insert` → `explore_derived_tracks`:
     - derived table row W1
     - derived PK autoindex W1
     - rank_latest W1
     - rank_popular W1
     - rank_profile W1
     - subtotal **W5**
  3. `soridraw_shared_rev_tracks_ai_051` → `explore_shared_revision` W1
  4. total **W6 + W5 + W1 = W12**
- 따라서 first-public W12는 Worker 중복 호출이 아니라 **단일 Worker 1회 안에서 D1 table/index/trigger fanout**으로 설명됨.
- 현재 Worker count:
  - user 실측 first publication Worker 1.
  - Worker 요청 중복이 W12의 원인이 아님.
- 이론적 post-cutover 최저선:
  - 현재 `tracks` table + TEXT PK 구조를 유지하면 canonical row W1 + PK autoindex W1 = **W2**가 현실적 floor.
  - W2를 위해 Music Note first publish가 나머지 4 secondary index / legacy derived insert / shared revision D1 write를 더 이상 정상 hot path에서 만들지 않아야 함.
- 그러나 현재 app336은 **hybrid**이며 Feed/Profile에서 아직 legacy path를 함께 읽음.
  - Search는 app341에서 R2-only이나 Feed/Profile은 R2 + legacy merge.
  - 따라서 first-public W2를 지금 shared D1에 적용하면 TEST/PRODUCTION 및 legacy recovery/query path를 깨뜨릴 위험.
- 안전한 다음 구조:
  1. 모든 환경에 R2 catalog/hybrid compatibility 승격.
  2. Feed/Profile/Genre도 검증된 **R2-only cutover mode**를 dormant flag로 먼저 구현/감사.
  3. R2-only가 실제 정확성을 보장한 뒤 Music Note 전용 secondary-index fanout과 derived/revision fanout을 단계적으로 종료.
  4. shared D1 구조변경은 별도 사용자 승인 전 적용 금지.
- 좋아요/저장하트 즉시동기화와 app353 Music Note thumbnail 경로는 이 작업과 완전히 분리/동결.

## 0PJ. publication source-swap W3→W2 후보 준비/감사 PASS — 적용은 cross-env hybrid 승격 전 차단 (2026-10-05 KST)

- 사용자 지시 기준:
  - D1 **physical Rows Written 최우선**.
  - mutation마다 Worker 요청 수를 함께 확인.
  - 정상 기능/좋아요 즉시동기화를 비용 때문에 변경 금지.
- 현재 실기기 source swap baseline:
  - Worker **1**.
  - D1 physical **R11 / W3**.
  - Firestore **R0 / W0**.
- W3 구성 확정:
  1. canonical `tracks` media UPDATE W1 — 유지.
  2. `explore032_track_update` → legacy `explore_derived_tracks` media mirror W1.
  3. `soridraw_shared_rev_tracks_au_051` → shared revision W1 — 구환경 freshness 보호.
- 안전한 W2 후보:
  - canonical tracks W1 유지.
  - shared revision W1 유지.
  - **media-only legacy derived mirror만 W0**.
  - non-media/content 변경은 기존 derived cold-recovery projection 유지.
  - 예상 normal source swap = physical **W2**, Worker 요청 수는 기존 **1회 유지**.
- PREVIEW 준비 파일:
  - candidate migration:
    `cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid.sql`
    - commit `efad094f8452463503e839d72faa404deb171e77`.
  - rollback:
    `cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid_rollback.sql`
    - commit `ef631e132255b4f1fa1768d32ba21979586dd100`.
  - readiness verifier:
    `scripts/verify-357-publication-source-swap-w2-readiness.mjs`
    - initial commit `e55a5241773963b0990d435a6e5ecefd37b77331`.
    - verifier comment false-positive fix `eed2d860495446c9709c5a1df16155244a443a6d`.
  - Release System Audit에 readiness guard 포함:
    `8bbaffeaae93d9cc79b1258451c436b79346681e`.
- 첫 audit `37231601335`:
  - TypeScript/Build 및 diagnostic groups는 PASS였으나 verifier가 SQL 주석의 `UPDATE ... shared trigger name` 문구를 실제 DDL로 오인해 FAIL.
  - 제품/후보 구조 오류가 아니라 verifier regex false-positive로 판정하고 수정.
- 최종 rerun Release System Audit `37231798452`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - app336 R2 hybrid read regression PASS.
  - publication W2 readiness verifier PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - live shared D1 preflight는 read-only PASS.
  - branch refs unchanged PASS.
- **공유 D1 migration은 실행하지 않음.**
  - D1 row/schema 실제 변경 0.
  - Worker 배포 0.
  - Firebase 배포 0.
  - Functions/Rules 변경 0.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 현재 차단 이유:
  - PREVIEW source에는 app336 `SORIDRAW_R2_HYBRID_READ_V1` compatibility가 존재하고 preview wrangler에서 활성.
  - 현재 `main` Worker source/config에는 hybrid-read marker/flag가 없음.
  - 구 TEST/PRODUCTION Worker는 legacy derived row + shared revision freshness에 아직 의존.
  - shared D1 trigger는 3환경 공용이므로 지금 derived media mirror를 제거하면 TEST/PRODUCTION에 stale 공개 media 위험.
- 결론:
  - **W3→W2 구현 후보 자체는 준비/정적감사 PASS**.
  - 그러나 안전 적용은 TEST/PRODUCTION도 hybrid-read authority를 지원한 이후에만 가능.
  - 이 차단을 우회해 PREVIEW 단독 shared-D1 migration을 적용하지 않는다.

## 0PI. 비용 최적화 우선순위 재확정 — D1 physical Rows Written 최우선 + Worker 매 테스트 계측 (2026-10-05 KST)

사용자 재지시:
- 행 읽기/쓰기가 비용에 직접 영향을 주므로 **특히 physical Rows Written을 최우선 절감 지표**로 사용.
- Cloudflare Worker 요청 수도 매 테스트마다 반드시 함께 확인.
- 비용 절감을 이유로 정상 기능을 제거/지연하지 않음.

현재 실기기 기준:
- registered public→private: Worker 1 / D1 R3 W2 / Firestore W0 = PASS.
- same-source private→public: Worker 1 / D1 R5 W2 / Firestore W0 = PASS.
- Suno source/media swap: Worker 1 / D1 R11 W3 / Firestore W0 = HARD FAIL.
- never-published first publication: Worker 1 / D1 R7 W12 / Firestore는 별도 동시 batch 분리 필요 = HARD FAIL.
- idle/revisit/page sync는 Worker 0 / D1 R0 W0 목표 유지.

매 작업 합격선:
1. **D1 physical Rows Written**
   - W0~W2만 PASS.
   - W3+는 HARD FAIL.
   - query-level W1만 보고 통과 금지. 반드시 request/physical rows written을 기준으로 판정.
2. D1 physical Rows Read
   - 전체 곡/사용자 수에 비례하는 scan 금지.
   - changed-item O(1) 우선.
3. Cloudflare Worker
   - 실제 mutation 1회당 Worker 1을 현재 정상 상한으로 추적.
   - 같은 action에서 Worker 2+가 나오면 fanout/중복 호출 감사.
   - 변경 없는 재진입/reload는 Worker 0 목표.
4. Firestore Browser SDK
   - publication hot path Firestore R0/W0 보호.
5. 기능 보호
   - app348/app349 PC↔모바일 즉시 저장하트 동기화 및 +30초 canonical W0/W1 변경 금지.
   - registered private/public W2 정상 경로 변경 금지.

현재 source-swap W3의 physical write map:
- canonical `tracks` media UPDATE = W1.
- `explore032_track_update` trigger → `explore_derived_tracks` mirror UPDATE = W1.
- `soridraw_shared_rev_tracks_au_051` trigger → shared revision UPDATE = W1.
- 합계 W3.
Worker는 mutation 1회에 요청 1회이며 현재 중복 Worker fanout은 실기기에서 보이지 않음.

## 0PH. app353 공개/비공개/source-swap 실기기 비용 분리 PASS/FAIL 확정 (2026-10-05 KST)

사용자 영상은 각 동작 사이 CACHE LIVE 초기화를 수행한 상태로 판정.

### 실측
1. **registered public → private**
   - Worker 1
   - D1 query R0 / W1
   - D1 physical/request rows **R3 / W2**
   - Browser SDK R0/W0
   - 판정: **PASS**. hard gate W1~W2 충족.
   - app335 과거 baseline R5/W2보다 read rows는 2 감소, write floor W2 동일.

2. **같은 source private → public 재공개**
   - Worker 1
   - D1 query R2 / W1
   - D1 physical/request rows **R5 / W2**
   - Browser SDK R0/W0
   - 판정: **PASS**. hard gate W1~W2 충족.
   - app334/app335 동일-source 재공개 목표 W2와 일치.

3. **공개 상태에서 Suno 1↔2 source/media 전환**
   - Worker 1
   - D1 query R3 / W1
   - D1 physical/request rows **R11 / W3**
   - Browser SDK R0/W0
   - 판정: **HARD FAIL**. app335 known source-swap baseline R11/W3와 동일, app353 신규 회귀는 아님.
   - 기존 read-only audit에서 W3 원인은:
     1) canonical tracks media UPDATE W1
     2) explore032_track_update → explore_derived_tracks W1
     3) soridraw_shared_rev_tracks_au_051 → explore_shared_revision W1
     = physical W3.

### 결론
- 비용 숫자가 매번 랜덤하게 달라지는 것이 아니라 **동작 종류가 달라서 경로가 다름**.
- private / same-source public은 W2로 현재 합격.
- source swap은 기능은 정상이나 W3라 비용 기준 FAIL.
- never-published 최초 공개는 별도 known baseline R7/W12로 여전히 HARD FAIL.
- 이번 registered 테스트 3개 모두 Firestore/Browser SDK W0이므로 직전 first-publication에서 보였던 `users:write 1`은 항상 publication mutation에 붙는 write가 아님. delayed users batch 등 동시 이벤트 가능성이 높으며 publication 공통 regression으로 보지 않음.
- 좋아요/저장하트 app348/app349 즉시 PC↔모바일 동기화는 보호 기준 그대로 동결. publication 비용 작업에서 변경 금지.

## 0PG. 좋아요 동기화 재확정 동결 + app353 공개/비공개 실기기 비용 확인 (2026-10-05 KST)

### 좋아요/저장하트 — 사용자 재확정 보호 기준
- 사용자 명시: **현재 PC↔모바일 즉시 좋아요/저장하트 동기화 동작을 그대로 유지. 비용 최적화를 이유로 기능을 임의 변경하지 말 것.**
- 과거 변경 원인 확인:
  - app302 제품 commit `24447627c2222d5cedc6fe96dcaccbfb26c0593a`에서 비용 절감을 위해 pre-canonical `publishMusicNoteHeartPreviewDelta` RTDB preview를 제거.
  - 당시 의도는 initiating device만 즉시 표시하고 상대 기기는 마지막 클릭 +30초 canonical 성공 뒤에만 반영하여 **pre-canonical RTDB write 0**을 만드는 것.
  - 이 변경 때문에 기존 사용자 요구였던 PC↔모바일 즉시 동기화가 지연되는 기능 회귀가 발생.
  - app348 제품 commit `441a256106d95427bfc5926f5a0c83d4bf4151d5`에서 RTDB changed-item preview를 복구하여 **상대 기기 즉시 반영 + canonical +30초 W0/W1**을 동시에 유지하도록 정상화.
- 현재 하드 보호:
  - same-device Recent heart + Music Note membership 즉시.
  - same-account other-device heart + membership 즉시.
  - 페이지/탭 이동/새로고침 불필요.
  - canonical favorite는 마지막 클릭 +30초 final-state: net-zero W0 / changed W1.
  - receiver Firestore/D1 추가 IO 0 목표.
  - **향후 비용 최적화가 이 visible behavior를 제거/지연하면 FAIL. 사용자 승인 없이는 변경 금지.**

### 공개 테스트 — never-published 최초 공개 1곡
사용자 CACHE LIVE 스크린샷:
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request rows: **R7 / W12**.
- Browser SDK: R0 / W1, source `users:write = 1`.
- PAGE SYNC: D1 R0/W0, Firestore R0/W0.
판정:
- D1 **R7/W12는 app335에서 이미 기록된 never-published 최초 공개 baseline과 동일**. 새 app353 회귀로 증가한 수치는 아님.
- 하지만 SORIDRAW hard gate W1~W2 기준에는 여전히 **HARD FAIL**이며, first-publication fanout 최적화 미완료 상태.
- Browser SDK `users:write 1`은 app335 문서의 publication Firestore W0 기대와 다름. 이 한 장만으로 publication 자체가 만든 write라고 단정하지 않고, 30/60초 delayed users batch 등 동시 write 가능성을 분리 실측해야 함.

### 바로 이어진 비공개 테스트
사용자 스크린샷:
- Browser SDK R0/W0.
- Cloudflare LOCAL 0 / Worker 0.
- D1 R0/W0.
- R2 Class A/B 0.
판정:
- Music Note/Explore publication UI는 app331/app346부터 **optimistic local-first**라 화면에서는 서버 응답 전 즉시 private로 보일 수 있음.
- 현재 실제 서비스 코드는 `setExploreTrackVisibility() -> flushPendingExplorePublicationsForPageExit() -> /v1/me/music-note-publications/batch`를 호출하므로, **서버까지 확정된 registered public→private mutation이라면 Worker/D1 mutation이 존재해야 함**.
- 기존 app335 실측 baseline은 동일 source public→private **D1 R5/W2 / Firestore W0**.
- 따라서 이번 R0/W0/Worker0 캡처는 성공 settlement 완료 후 수치인지, optimistic 화면 직후 수치인지 추가 1회 격리 확인 필요. 완료 PASS로 오판하지 않음.

### 다음 공개 비용 확인
1. 같은 registered 곡을 public 상태로 만든 뒤 CACHE LIVE 초기화.
2. private 클릭 후 성공 토스트까지 기다리고 2~3초 뒤 캡처.
   - 기대 baseline: Worker 1 / D1 W2 / Firestore W0.
3. 다시 같은 source로 public.
   - registered 재공개 기대: Worker 1 / D1 W2 / Firestore W0.
   - W12가 다시 나오면 first-publication 오분기 회귀.
4. 이 두 동작에서도 `users:write 1`이 반복되면 publication 경로의 새 Firestore write regression으로 분리 감사.
5. 새 never-published 곡 최초 공개 W12는 이미 known HARD FAIL이므로 별도 저비용 구조 작업 대상.

## 0PF. app353 PC Music Note 썸네일 실기기 PASS / 보호 기준 동결 (2026-10-05 KST)

- 사용자 실기기 확인: **"일단 수정은 됐어."**
- 따라서 app353에서 확인한 PC Music Note 썸네일 문제는 실사용 기준 PASS 처리.
- 확정 보호 범위:
  - Detail에서 확인된 Suno media가 Music Note 목록에 반영되는 경로.
  - Explore 이동 후 Music Note 재진입 시 stale V4 Catalog가 썸네일을 다시 지우지 않는 media overlay 우선순위.
  - `firestoreId || id` canonical document identity 기준의 local row/cache writeback.
  - app349 heart/Music Note membership 즉시 동기화 및 마지막 클릭 +30초 canonical settlement.
- 현재 PREVIEW Hosting: app **353**.
- Firebase PREVIEW App Release Run: `37228706933` SUCCESS / exact build PASS.
- Release System Audit: `37228542810` SUCCESS.
- TEST / PRODUCTION unchanged.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향: 추가 Firestore/D1/R2/RTDB read/write 0.
- 다음 큰 작업은 썸네일 경로를 더 건드리지 않고 follow 저비용 Worker 독립 감사로 복귀.
- 썸네일 관련 새 수정은 별도의 실사용 회귀가 확인된 경우에만 진행.

## 0PE. app353 PC Music Note 썸네일 우선순위/Catalog 재진입 원인 확정 + PREVIEW 배포 (2026-10-05 KST)

- 사용자 app352 실기기 영상 결과:
  - Music Note 목록 최초 상태는 `빛속의 오답`, `무거운 발걸음` 모두 음표 placeholder.
  - 같은 PC에서 Detail & Edit를 열면 해당 곡의 Suno URL 1/2 + cover image가 정상 존재.
  - Detail을 연 직후 목록 thumbnail은 정상 표시됨.
  - Explore로 이동했다가 Music Note로 돌아오면 다시 placeholder로 사라짐.
- **정확한 원인 / 우선순위**
  - 맞음. 목록의 임시 media patch보다 **V4 full Music Note Catalog가 상위 authority**였음.
  - Detail open의 `syncFavoriteSunoCardMedia()`는 `favoritesStore` + 일반 favorites localStorage만 갱신했지만, Music Note 재진입 시 `subscribeListBundle -> readPreviewAdaptiveListIndexV2 -> readCatalogSnapshotCacheFirst`가 full Catalog를 다시 전달함.
  - App의 full Catalog `onData`는 schema 1001 Catalog를 authoritative row로 채택하므로, media-only 변경이 dedicated Catalog overlay에 남지 않은 PC에서는 thumbnail이 다시 지워졌음.
  - 즉 이미지 렌더 실패/다운로드 실패가 아니라 **Detail media → 임시 list state → Catalog authority 재적용** 순서의 우선순위 오류였음.
- 추가로 확인된 canonical-id 원인:
  - 일부 legacy/Catalog row는 내부 `id`와 실제 Music Note 문서 `firestoreId`가 다를 수 있음.
  - `App.updateFavorite`, 즉시 cache patch 일부가 `item.id === documentId`만 사용해 실제 canonical row를 놓칠 수 있었음.
  - 이 경우 Firestore Detail 저장은 성공해도 local list row / Catalog delta source가 갱신되지 않아 stale Catalog가 계속 남을 수 있었음.
- app353 수정:
  - `src/pages/FavoritesPage.tsx`
    - Detail에서 이미 확인된 exact Suno media와 새 URL 저장 결과를 **기존 bounded Music Note media overlay**에 즉시 기록.
    - stale Catalog가 다시 와도 overlay가 해당 media만 위에 유지.
    - 서버 read/write 추가 없음.
  - `src/App.tsx`
    - `updateFavorite`, immediate cache patch, local row update/remove를 `firestoreId || id` canonical document identity 기준으로 통일.
    - Detail media 저장이 실제 list row와 이후 Catalog delta source에도 반영될 수 있게 수정.
  - generic `updatedAt`를 억지로 올려 우선순위를 속이는 방식, 전체 Music Note 재조회, cache reset은 사용하지 않음.
- commits:
  - Detail/save media durable overlay: `7c0d3cc83bab747ff202d801ab648c5ff14eeaa1`.
  - canonical App local writeback: `b39e7f052ea92034bbf685aa822de8115fad89e6`.
  - app353 version: `921ee914ce51a025325504623c59994ef595b702`.
- Release System Audit Run `37228542810`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups A~D / syntax / final guards / regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 preflight 및 진단은 read-only PASS.
- Firebase PREVIEW App Release Run `37228706933`: **SUCCESS**.
  - release trigger: `0b71f526c214733bc016b09b672b2216b9f40322`.
  - PREVIEW Hosting app **353** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy 요청 없음.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 추가 Firestore read/write 0.
  - 추가 D1/R2 read/write 0.
  - 추가 RTDB read/write 0.
  - 기존 exact Detail data와 기존 local overlay/cache만 사용.
- 실기기 다음 확인:
  1. PC app353 로드.
  2. 과거 overlay가 없던 기존 곡은 Detail을 **한 번 열었다 닫아** 정확한 media를 로컬 overlay에 심은 뒤 확인.
  3. Explore 이동 → Music Note 복귀 후 thumbnail 유지.
  4. 새로고침 후 유지.
  5. 브라우저 완전 종료/재실행 후 유지.
  6. app353 이후 새 Suno URL/media 저장은 저장 순간 overlay가 같이 생성되므로 다음 재진입부터 별도 Detail 재오픈 없이 유지되어야 함.
- 보호:
  - 정상 모바일 경로, app349 하트/Music Note membership 즉시 동기화, 마지막 클릭 +30초 canonical settlement는 변경하지 않음.
  - 전체 Music Note reread/cache reset 금지 유지.

## 0PD. app352 PC Music Note 목록 썸네일 canonical-ID 매칭 수정 PREVIEW 배포 (2026-10-05 KST)

- 사용자 app351 실기기 결과:
  - PC Music Note 목록: 여전히 음표 placeholder 표시 FAIL.
  - 같은 PC에서 Detail & Edit를 열면 동일 곡의 Suno URL 1/2와 cover image가 정상 표시.
  - 즉 **미디어 데이터 자체는 PC에 존재하지만 목록 summary row와 Detail row의 식별자 매칭이 실패**한 증상으로 좁혀짐.
- 확인된 코드 원인:
  - Music Note canonical document id는 `firestoreId` 우선인데, 일부 media list/cache 경로가 `id || firestoreId` 순서로 비교.
  - PC Catalog row에서 `id`와 `firestoreId`가 다를 수 있는 경우, Detail hydration은 `firestoreId`로 정상 문서를 열지만 목록 media patch/overlay는 다른 `id`를 보고 건너뜀.
  - 그래서 Detail에는 cover가 보이지만 배경 목록은 계속 placeholder였음.
- app352 수정:
  - `src/pages/FavoritesPage.tsx`
    - Suno card media patch 대상을 `getFavoriteDocumentId(song)` 기준으로 통일.
    - Detail flush 후 latest row lookup, RTDB media preview source lookup, durable draft lookup도 canonical favorite document id 기준으로 통일.
  - `src/lib/userDataEngine.ts`
    - Music Note media overlay key/match에서 `firestoreId || id` 우선으로 통일.
  - 전체 Catalog id 구조/사용자 데이터는 변경하지 않고, media overlay/card patch의 식별자 비교만 최소 수정.
- commits:
  - FavoritesPage canonical id fix: `86144a3bde69f437edd0e42f2f7fbd12e5510b5c`.
  - userDataEngine overlay id fix: `51b23dc5440c46e278f76f03a773782d7ce71b42`.
  - app352 version: `91cd69db0fd7a30ac6d82741cee711493dd3ad11`.
- Release System Audit Run `37227306745`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups, existing regression, TEST/PRODUCTION Worker dry-run, shared D1 read-only checks PASS.
- Firebase PREVIEW App Release Run `37227428264`: **SUCCESS**.
  - release trigger commit: `d0c5546a200ec7e05d3c767e3fbb645b1acfbbdc`.
  - PREVIEW Hosting app **352** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 추가 Firestore/D1/R2/RTDB read/write 0.
  - 기존 local card media patch와 device-local overlay가 정확한 문서 id를 찾도록 수정한 것뿐.
- 실기기 확인:
  1. PC app352 새로고침.
  2. 현재 스크린샷의 `빛속의 오답`, `무거운 발걸음`처럼 Detail에서 cover가 이미 보이는 곡의 목록 썸네일 확인.
  3. 목록에 cover가 보이면 PC 새로고침 → 브라우저 완전 종료/재실행 후도 유지 확인.
  4. 하트/Music Note membership +30초 canonical behavior는 변경 금지/비변경.

## 0PC. app351 PC Music Note Suno 썸네일 재실행 지속성 보강 PREVIEW 배포 (2026-10-05 KST)

- 사용자 app349 실기기 결과:
  - 모바일: 새로고침/앱 재실행 후에도 Music Note 목록 썸네일 유지 PASS.
  - PC: 새로고침/재실행 뒤 썸네일이 다시 사라지는 잔여 오류 확인.
- 원인:
  - Suno media RTDB changed-item preview는 PC 화면/일반 favorites cache까지는 도착했지만, 수신 PC에는 편집 기기의 Detail draft가 없음.
  - 이후 PC가 서버 Catalog를 다시 적용하면 아직 media를 포함하지 않은 Catalog가 수신 캐시를 덮을 수 있었음.
  - source 모바일은 자기 Detail draft가 다시 media를 덮어주므로 증상이 보이지 않았음.
- 수정:
  - `src/lib/userDataEngine.ts`: UID + favorite-id별 bounded device-local Music Note media overlay 추가. Suno/card media 필드만 저장.
  - `src/services/userDomainSyncService.ts`: 기존 RTDB signal 수신 시 화면 event 전에 media overlay를 로컬 저장.
  - overlay는 Firestore/D1/RTDB write intent가 아니며 서버 write를 추가하지 않음.
  - 서버 Catalog가 아직 media를 반영하지 못해도 PC 새로고침/재실행 때 overlay를 다시 적용.
  - app351 보강: 현재 화면/로컬 Catalog가 overlay와 같다는 이유만으로 overlay를 지우지 않음. **더 최신 canonical media version**이 들어올 때만 오래된 overlay를 폐기하여 반복 stale Catalog GET에서도 썸네일 재소실 방지.
  - bounded max 256 changed media items; 전체 Music Note reread/cache reset 없음.
- 제품 commits:
  - app350 기반: `30b9fc809f59f20707e5e479c891aee424bfdd4f`, `e8d6ac90f22a92c730e8b9f8b285b46433dc671a`.
  - app351 stale-Catalog guard: `46079ef2d7aa29e9b4967d689fbf817d4f3e70d9`.
  - app351 version: `357b0ed91504de646c0132ce6e4a469e97b4d284`.
- Release System Audit Run `37226502953`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - release static groups A~D, syntax/guards, TEST/PRODUCTION Worker dry-run, shared D1 read-only preflight PASS.
- Firebase PREVIEW App Release Run `37226652526`: **SUCCESS**.
  - release trigger: `6949fc69d36b5cdfa66d6b18b993ca3012143757`.
  - PREVIEW Hosting app **351** / exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules 변경 요청 없음.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 비용 영향:
  - 수신기 추가 Firestore read/write 0.
  - D1 read/write 0.
  - 추가 RTDB write 0; 이미 존재하는 changed-item signal을 수신해 기기 localStorage/Catalog cache만 보강.
  - 앱 진입/재실행 때문에 사용자 데이터 서버 write를 만들지 않음.
- 실기기 최종 확인 필요:
  1. app351을 PC/모바일 모두 로드.
  2. **새 테스트 곡 또는 Suno URL을 한 번 새로 저장/수정해 새 media signal을 만든 뒤** PC 목록에 썸네일 즉시 표시 확인.
  3. PC 새로고침 → 썸네일 유지.
  4. PC 브라우저 완전 종료/재실행 → 썸네일 유지.
  5. 같은 과정에서 하트/Music Note membership +30초 canonical 동작은 app349 기준 그대로 유지.
- 참고: 이미 app349에서 PC 로컬 media가 사라진 과거 곡은 새 signal이 전혀 없으면 기기에 복구할 원본이 없으므로, 전체 서버 재조회 없이 과거 상태를 억지 복원하지 않음. 실기기 검증은 새 media signal로 확인한다.
- PREVIEW live Worker는 계속 Worker341 rollback본 유지. follow cutover OFF. follow 저비용 candidate는 이 실기기 확인과 별도 작업.

## 0PB. app349 Studio 저장하트 settlement / Music Note 즉시 membership / Suno 목록 미디어 안정화 PREVIEW 배포 + 기준 동결 (2026-10-05 KST)

- branch: `preview`.
- 제품 commit: `53646fce918060f5bcb376af9a31a5e0acd05e6c`.
- focused implementation/verification Run `37224717803`: **SUCCESS**.
  - +30초 canonical settlement 시 저장된 Music Note row가 순간 사라지지 않는 회귀검사 PASS.
  - 상대 기기 RTDB preview 수신 즉시 Music Note membership/cache 반영 PASS.
  - Suno URL/thumbnail/list media 로컬 캐시 지속성 PASS.
  - media-specific revision이 generic favorite updatedAt에 잘못 밀리지 않는 보호 PASS.
  - 추가 Firestore/D1 IO 정적 목표 0.
  - 보호 회귀(app302/app347/app289/app031/app032/app291), TypeScript, Build PASS.
- Release System Audit Run `37224853496`: **SUCCESS**.
- Firebase PREVIEW App Release Run `37224986893`: **SUCCESS**.
  - app version **349** / exact PREVIEW build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- 현재 보호 기준: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`.
- app349 visible contract:
  - 같은 기기 Recent 하트 + Music Note membership 즉시.
  - 같은 계정 다른 기기 Recent 하트 + Music Note membership 즉시.
  - canonical favorite는 곡별 마지막 클릭 +30초 final-state W0/W1 계약 유지.
  - settlement 순간 저장 row가 사라졌다가 재등장하는 전환 금지.
  - Detail에 저장된 Suno media/thumbnail이 목록/재실행에서 사라지는 회귀 금지.
- 남은 실기기 최종 확인:
  1. PC → 모바일 save/unsave 즉시 반영.
  2. 모바일 → PC save/unsave 즉시 반영.
  3. 마지막 클릭 +30초 뒤 양쪽 하트 + Music Note membership이 그대로 유지.
  4. Detail Suno URL/media가 Music Note 목록 thumbnail/media에 즉시 보이고 새로고침/재실행 후 유지.
- 별도 다음 백엔드 작업: PREVIEW live Worker는 계속 Worker341 rollback본 유지, follow cutover OFF. 저비용 follow candidate는 legacy Worker341 parity + 실제 D1/R2 비용 독립 검증 전 재배포 금지.

## 0PA. app348 Studio 저장하트 즉시 PC↔모바일 동기화 복구 + Skill 재동결 (2026-10-05 KST)

- 사용자 명시 기준으로 app302에서 제거됐던 pre-canonical Studio-heart cross-device preview를 복구.
- **현재 보호 동작**
  - 같은 기기: Recent 하트 즉시 + Music Note membership 즉시.
  - 같은 계정 다른 기기: RTDB changed-item preview로 하트 + Music Note membership 즉시.
  - 페이지 이동 / 탭 이동 / 새로고침 불필요.
  - canonical Firestore favorite: 곡별 마지막 클릭 +30초 뒤 최종 상태만 저장.
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
  - 다른 곡은 독립 30초 timer.
- app347 stale-overwrite / media 보호 유지:
  - remote preview는 non-canonical overlay로 분리.
  - generic favorites updater 전 local pending + remote preview layer를 canonical input에서 제거.
  - canonical save/unsave가 오면 matching preview layer 정리.
  - 최신 Detail/Suno media가 오래된 heart-click snapshot에 덮이지 않음.
- RTDB preview payload:
  - bounded Music Note summary를 사용하며 thumbnail/cover/Suno media 필드를 포함.
  - receiver Firestore R0/W0, D1 R0/W0 정적 guard.
  - preview는 canonical Music Note catalog/document version을 올리지 않음.
- 제품 commit: `441a256106d95427bfc5926f5a0c83d4bf4151d5`.
- focused apply/verify Run `37222138737`: **SUCCESS**.
  - immediate PC/mobile preview PASS.
  - canonical 30s final-state PASS.
  - remote Music Note no-Firestore-IO PASS.
  - app347 stale-overwrite guard PASS.
  - TypeScript PASS / Build PASS.
- Release System Audit Run `37222258188`: **SUCCESS**.
- Firebase PREVIEW App Release Run `37222387192`: **SUCCESS**.
  - locked release commit: `da1be338d2007e287c33400b5e9e5d78719e68f6`.
  - `preview.soridraw.com` app **348** exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- Skill / guardrail 갱신:
  - 신규 기준: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app348-studio-heart-immediate-cross-device-baseline.md`.
  - `song-save-edit-sync-cost/SKILL.md`, `local-first-like-sync/SKILL.md`, `AGENTS.md`를 app348 즉시 동기화 기준으로 갱신.
  - app302 delayed-remote 기준은 historical/superseded로 명시.
  - 향후 비용 최적화를 이유로 cross-device 즉시 동기화를 사용자 승인 없이 제거/지연 금지.
- 남은 실기기 최종 확인:
  1. PC → 모바일 save/unsave 즉시 반영.
  2. 모바일 → PC save/unsave 즉시 반영.
  3. 30초 canonical settlement 뒤 양쪽 상태 유지.
  4. Detail/Suno media가 Music Note 목록 thumbnail에서 사라지지 않음.
- 팔로우 저비용 Worker candidate/cutover는 별도 작업이며 현재 Worker341 유지.

## 0P9. app347 Studio 저장하트 / Music Note canonical 재정합 복구 (2026-10-05 KST)

- 사용자 실기기에서 app346 이후 별도 신규 오류 확인:
  - 같은 계정인데 PC / 모바일의 Recent 저장하트 상태가 서로 다름.
  - PC의 하트 표시와 실제 Music Note 목록 membership도 불일치.
  - 방금 저장한 곡에서 Detail에 Suno URL/두 곡 정보가 보이는데 Music Note 목록 썸네일/미디어가 비어 보이는 사례.
- app302/app302b 동결 스킬 기준으로 재감사한 결과, app346 follow UX 작업 자체가 Music Note 저장 경로를 수정한 것은 아님.
- 확인된 구조적 취약점:
  1. Studio-heart pending optimistic layer가 canonical/changed-item row와 같은 곡을 덮을 때, 하트 클릭 시점의 오래된 `intent.song` snapshot이 더 최신인 list/media row를 다시 가릴 수 있었음.
  2. PC/모바일 중 한 기기의 canonical save/unsave가 이미 로컬 pending의 원하는 최종 상태를 달성했어도, 해당 pending intent를 정리하지 않아 optimistic membership이 canonical 상태 위에 계속 남을 수 있었음.
  3. 이 조합이 하트↔Music Note membership 불일치와 Detail media↔목록 thumbnail 불일치를 동시에 만들 수 있음.
- app347 수정:
  - pending layer는 이제 **membership만 제어**. 같은 document의 더 최신 canonical/local row가 있으면 title/media/thumbnail/Suno fields는 그 최신 row를 보존.
  - canonical `save/restore/shared-note-save/unsave/remove` signal이 로컬 pending과 같은 document ID 또는 같은 stable song identity이고 최종 saved 상태도 같으면 해당 pending intent를 즉시 제거.
  - Detail/Suno preview signal은 canonical settlement로 취급하지 않음.
  - 추가 Firestore/D1/Worker read/write 0. shared RTDB schema/rules 변경 없음.
- product commit: `976037b932b6ee1606206939494b5a660cd5659c`.
- focused Apply/Verify Run `37219963501`: **SUCCESS**.
  - app347 focused regression PASS.
  - app302 protected regression PASS.
  - app289 compact heart sync PASS.
  - app291 Recent lyrics live-preview PASS.
  - TypeScript PASS / Build PASS.
  - 기존 verify-290은 pre-app302 heart-preview 송신을 요구하는 stale historical assertion이라 app302 현재 계약의 release gate로 사용하지 않음.
- Release System Audit Run `37220098629`: **SUCCESS**.
- Firebase PREVIEW Hosting Run `37220292148`: **SUCCESS**.
  - locked release commit: `a8894bdd3826116e5efde992e176403652db1e30`.
  - remote `preview.soridraw.com` app version **347** / exact build PASS.
  - shared RTDB Rules SKIPPED.
  - TEST / PRODUCTION unchanged PASS.
  - Worker / Functions / D1 / Firestore Rules 변경 없음.
  - 사용자 데이터 migration/backfill/delete/rewrite 0.
- PREVIEW Worker는 계속 rollback된 Worker341 유지. follow low-cost candidate/cutover와 이번 Music Note 복구는 분리.
- **실사용 검증 필요**:
  1. PC와 모바일을 둘 다 app347로 새로고침.
  2. 같은 A곡 저장/해제를 한 방향에서 실행하고 30초 canonical settlement 뒤 상대 기기가 새로고침/탭 이동 없이 같은 하트 + 같은 Music Note membership으로 수렴하는지.
  3. 반대 방향도 동일 확인.
  4. 저장 직후 Detail에서 Suno URL/두 곡 media를 넣은 경우 목록 thumbnail/media가 pending layer 때문에 사라지지 않는지.
  5. 이미 app346에서 꼬여 있던 A/B가 최신 canonical signal replay만으로 모두 정리되는지는 실기기 확인 전. 남으면 전체 스캔 없이 해당 곡만 bounded recovery 설계.

## 0P8. app346 immediate social UX PREVIEW 배포 + mandatory follow gate PASS (2026-10-05 KST)

- branch: `preview`.
- 현재 PREVIEW Hosting: **app346**.
  - 제품 UX commit: `faf0b69faf017603311e92cd645a76c6b0034743`.
  - Worker341 legacy parity candidate commit: `e312cfdea8b4c047aa8309506e8ebc78d9ed1bf2`.
  - app version commit: `85e6c0dbc2f62e01ecb6499eb2e2a7193e339a77`.
  - mandatory full follow gate source: `b711f1dba68aed2b97df92636c40d22bc7577767`.
- Release System Audit Run `37217745269`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - follow 347~355 chain + 356 Worker341 legacy parity PASS.
  - app356 immediate follow/publication rollback + server cost calls unchanged PASS.
  - 이전 diagnostic-only false-green 위험을 막기 위해 verify-347에서 348 전체 체인을 mandatory import하도록 변경했고, 의도적으로 Worker341로 되돌린 legacy 함수/347 sync 제거를 verify-354가 명시적으로 허용하도록 정리함.
- Firebase PREVIEW Hosting Run `37217908194`: **SUCCESS**.
  - release trigger commit: `93c5826a126bc61c61daf14cb61b404a9b305cd6`.
  - remote `preview.soridraw.com` app version **346** / exact build PASS.
  - TEST / PRODUCTION code+HTML unchanged PASS.
  - shared RTDB rules deploy SKIPPED, Functions unchanged.
- UX 변경:
  - Explore 공개프로필 follow/unfollow는 클릭 즉시 버튼/카운트/Following 로컬 목록에 반영하고 서버는 뒤에서 settle.
  - 실패 시 직전 follow 상태와 카운트를 정확 rollback + 기존 오류 notice.
  - Explore publication settings save/private도 가능한 화면 상태는 즉시 반영하고 실패 시 exact rollback.
  - Music Note app330/331 publication path는 변경하지 않음.
  - focused verifier 기준 추가 backend call/read/write **0**.
- **PREVIEW Worker는 배포하지 않음.** 현재 active Worker는 rollback된 Worker341 코드 source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`, version `35a0bb0a-f547-4f4a-84ab-d55ba075ba13` 유지.
- shared follow cutover OFF. `explore_follow_overrides_348` migration/backfill/cutover 실행 0. 사용자 데이터 write/delete/migration 0.
- 다음 gate:
  1. 사용자 PREVIEW PC/mobile에서 5~7초 체감 대기가 사라지고 즉시 follow/public-private 화면 반응이 보이는지 실사용 확인.
  2. candidate Worker 재배포 전 Astra 독립 재감사 + Worker341 대비 legacy physical D1/R2 parity 근거 확보.
  3. 그 전까지 candidate Worker deploy, shared cutover, main/TEST/PRODUCTION 승격 금지.

## 0P7. Worker341 rollback 실사용 확인 + 5~7초 UX 지연 확인 (2026-10-05 KST)

- 사용자 동일 조건 재측정으로 rollback 정상 확인:
  - follow sample 1: D1 query R0/W3, physical Rows Read18 / Rows Written14.
  - follow sample 2: D1 query R0/W3, physical Rows Read19 / Rows Written17.
- 이는 기존 문서화된 legacy baseline R18~19 / W14~17과 일치한다. candidate355 배포 때 관찰된 R23/W14 증가는 rollback으로 제거됨.
- 따라서 현재 PREVIEW Worker는 비용 관점에서 **예전 기준으로 복구**됐지만, 그 예전 기준 자체가 최종 합격선은 아니다. 목표는 여전히 overlay authority에서 physical W1~W2.
- 사용자 추가 확인: 팔로우 및 공개/비공개 액션에서 클릭 후 화면 확정까지 약 **5~7초 로딩 체감**.
- 코드 확인:
  - Explore 공개프로필 `toggleFollow`은 서버 `setExploreFollow` 응답을 await한 뒤에 버튼/카운트를 바꾸므로 Worker 지연이 그대로 UI 로딩으로 노출됨.
  - Explore 공개프로필의 publication settings private/save 경로도 서버 settlement를 기다리는 경로가 있어 같은 체감 지연 가능.
  - Music Note의 app330/331 publication path는 이미 local-first optimistic이므로 그 정상 동작은 보호.
- 합격 UX: 사용자 클릭 즉시 로컬 상태 반영, 서버는 뒤에서 settle, 실패 시 정확 rollback. 비용을 숨기기 위한 가짜 성공이 아니라 server failure/ordering 보호 유지.
- 이 UX 수정은 follow low-cost backend 구조와 분리해 검증하며, 좋아요/UI 레이아웃/색상은 변경하지 않는다.

## 0P6. app345 live follow cost regression — PREVIEW Worker rolled back to Worker341 code (2026-10-05 KST)

- User real-device CACHE LIVE after candidate355 compatibility deploy showed legacy follow physical amplification still high and one direction worse than prior baseline:
  - sample A: D1 query R0/W2, physical Rows Read23 / Rows Written14.
  - sample B: D1 query R0/W2, physical Rows Read17 / Rows Written17.
- Prior documented legacy baseline was roughly physical R18~19 / W14~17. Therefore compatibility deployment did **not** satisfy “legacy behavior/cost unchanged”; low-cost overlay was not active.
- Root cause confirmed in deployed source comparison:
  - Worker341 legacy path used original 246 three-query counter mutation.
  - candidate355 legacy branch also carried undeployed `SORIDRAW_FOLLOW_COMBINED_COUNTERS_345` W2 counter compaction + `syncExactSharedFollowing347` compatibility work.
  - `readFollowCutoverState348` correctly left overlay OFF, so user was measuring this altered legacy path, not the W1~W2 overlay.
- Safety action: PREVIEW Worker rolled back to exact Worker341 product source `9c11b95cf4c95210011b1425cea23f3e51cbf34f`.
- Rollback Run `37214678869`: **SUCCESS**.
  - canonical SHA256 `627c86f5499f754169ae43dec9062a621d94bd549e2c9c5fb2c48c75d8f07bbb`
  - active PREVIEW Worker version after rollback: `35a0bb0a-f547-4f4a-84ab-d55ba075ba13`
  - feed/profile smoke PASS; warm revision D1 R0/W0 PASS; TEST/PRODUCTION Workers unchanged PASS.
- Hosting remains app345 for now. The app345 client compatibility/cache fix is backward-compatible with Worker341 and is not the source of physical D1 row amplification observed in the Worker mutation.
- Shared follow cutover remains OFF; no migration/backfill/user-data mutation.
- Next release blocker: candidate Worker must preserve the Worker341 legacy mutation path byte/behavior-equivalently while keeping overlay readers/writers dormant behind the cutover manifest. Re-audit + PREVIEW live cost comparison required before redeploying candidate Worker.

## 0P5. PREVIEW app345 + candidate355 compatibility Worker deployed — cutover OFF (2026-10-05 KST)

- User approved PREVIEW deployment after Astra independent audit PASS.
- Branch release sequence:
  - app version bump: `736645d999edc09518a88dca8d7564ede9929819`
  - Worker release trigger: `c968035c74975b69dd00252b6bc6b1caa8f5e051`
  - Hosting release trigger / deployed source HEAD: `051247aad2b8127aae01475880c549caceb37968`
- Cloudflare PREVIEW Worker Run `37213658493`: **SUCCESS**.
  - canonical Worker SHA256 `ff824b1818ef00b685ceb8ccfcdb1db876ca1d780970fc828f4b2bd41d62dd01`
  - active PREVIEW Worker version `2e544865-0392-4dbe-8cc0-28e1b8a01fb6`
  - feed smoke PASS / profile smoke PASS / warm revision D1 R0 W0 PASS.
  - TEST/PRODUCTION Workers unchanged PASS.
  - D1 schema migration 0. No follow schema/cutover activation.
- Firebase PREVIEW Hosting Run `37213744061`: **SUCCESS**.
  - TypeScript PASS / Build PASS / Firebase PREVIEW deploy PASS.
  - remote app version **345** / exact build PASS.
  - shared RTDB rules SKIPPED.
  - TEST/PRODUCTION unchanged PASS.
- Shared follow cutover manifest remains unarmed/absent by this release path; candidate355 code is deployed in compatibility/legacy mode only.
- Firebase Functions unchanged. Shared/user data migration/backfill/delete 0.
- Existing like/public-private/search/creator/UI protected paths were not intentionally changed.
- Two unrelated `diagnose-069-live-like.yml` push runs were reported as failure with zero jobs on the release-trigger commits; they were not part of either successful deploy workflow and were not modified in this release. Track separately; do not treat them as candidate355 validation.
- **Next gate:** PREVIEW real-device PC/mobile + actual Worker/R2 behavior/cost. No TEST/main or PRODUCTION promotion until live verification passes.

## 0P4. candidate355 Astra 재감사 PASS — 코드 감사 완료, PREVIEW 배포 전 (2026-10-05 KST)

- Branch/code: `preview` / `f8e2d1830f237a94abd064795c5be325171746ff`.
- 독립 Astra 재감사: **PASS**.
- 마지막 남은 legacy schema2 5,000-cap cache 문제는 해결 확인:
  - 누락 target은 false로 확정하지 않고 targeted `follow-state` recovery.
  - 정상 complete cache는 서버 read 0 유지.
  - explicit false 항목은 cap 계산에 포함되지 않음.
  - recovery 실패 시 false negative 저장 없음.
  - cache/version reset 없음.
- 따라서 candidate355의 코드 감사 단계는 통과.
- 실제 서비스는 여전히 app344 / PREVIEW Worker341. 아직 배포 없음.
- shared migration/cutover manifest 활성화, 사용자 데이터 변경, main/TEST/PRODUCTION 변경 없음.
- 다음 단계는 **PREVIEW 코드-only 호환층 배포** 후 legacy mode 비변경 확인. shared schema/cutover는 계속 금지.
- PREVIEW 배포 후 실제 PC/모바일, Worker/R2 요청·비용, no-op/복구 실측을 진행해야 하며, 그 결과 전까지 TEST/PRODUCTION 승격 금지.

## 0P3. candidate355 legacy schema2 follow cache blocker repaired — independent re-audit pending (2026-10-05 KST)

- Branch/base: preview / a6a3053d440245cd91f9f71a6c45c0a153d81800. Scope is only the remaining capped schema2 follow-cache blocker; Worker code and protected features are unchanged.
- Existing cache with 5,000 or more true memberships is conservatively incomplete even if its old complete flag is true. Known true/false states are preserved. Schema2, cache keys and cache contents are not reset or globally invalidated.
- An unknown target in an existing nonempty incomplete cache goes directly to the single-target follow-state endpoint, bypassing list/snapshot hydration. Successful recovery remembers only that target while keeping the cache incomplete. Failure rejects without storing a false negative.
- Healthy complete caches below the membership cap retain positive/absent-target server reads0 and local writes0. Known targets in capped caches also retain reads0. True-membership counting excludes explicit negative entries.
- Regression is integrated into verify355: persisted legacy schema2 capped cache, known positive/negative, missing positive/negative, repeat reads0, failed lookup/retry, healthy complete cache with many explicit negatives, and current partial-cache recovery.
- TypeScript PASS; Build PASS (existing dynamic-import/chunk-size warnings; output isolated under ignored node_modules, tracked dist unchanged). Verify347/348/349(includes353)/350/351/352/354/355 PASS, including the new legacy-cache regression. No remote billing rerun: Worker/SQL unchanged; local HTTP conditional fixtures retain prior cost samples. Real PC/mobile and live billing are unverified in this client-only task.
- No deployment, Firebase/Functions/Cloudflare resource change, shared migration, manifest activation, shared/user data write or main/TEST/PRODUCTION change. Live baseline remains app344 / PREVIEW Worker341. No new branch/workflow. Independent Astra re-audit and later live-device/release gates remain pending; RELEASE BLOCKED.

## 0P2. candidate355 Astra 재감사 FAIL — legacy schema2 follow cache 1건 잔존 (2026-10-05 KST)

- 감사 기준: `preview` / `46d21590ceea908353cec2e2a4235e8348404c20`; 실제 코드 `634589b2af0aa8041fe394402aa6f3a7a7abdc99`.
- 독립 재감사 판정: **FAIL 1건**. 이전 8건 중 7건은 재감사에서 추가 차단점이 확인되지 않았고, 기존 4번의 pre-cutover cache 사례가 남음.
- 남은 문제: `src/services/exploreSocialService.ts`의 `normalizeExploreFollowCache` / `readCachedExploreFollowState` / `loadExploreFollowingBundle`이 과거 schema2 캐시의 `complete:true`를 신뢰함. 예전 5,000 cap 캐시에 빠진 target도 서버 확인 없이 `false`로 확정 가능.
- 재현: 누락 target -> false, server/social snapshot/follow-state 확인 0회.
- 최소 수정 원칙: 전체 캐시 초기화 금지. 기존 제한 캐시를 불완전으로 판별하고, 불완전 cache miss는 개별 `follow-state` 확인으로 복구. 새 서버 completeness/truncated metadata를 존중하며 정상 complete cache fast-path는 유지.
- Run `37210263354`는 지정 코드와 일치하지만 이 legacy cache fixture는 검증에서 빠졌으므로 candidate355 release gate는 아직 FAIL.
- 실제 서비스는 app344 / PREVIEW Worker341 유지. 배포/shared migration/cutover/main/TEST/PRODUCTION/user data 변경 금지.

합격 조건:
1. legacy schema2 capped cache fixture에서 누락 target이 false로 확정되지 않고 targeted follow-state recovery.
2. 정상 complete cache hit은 서버 read 0 유지.
3. new incomplete/truncated cache도 targeted recovery 유지.
4. TypeScript/Build + 관련 follow verifier + 새 legacy-cache regression PASS.
5. Astra 재감사 PASS 전 PREVIEW 배포 금지.

## 0P1. protocol354 audit repairs355 — implementation candidate, deployment blocked (2026-10-04 KST)

- Branch/base: preview / 57acc664f59d9e3c4c110f5a2b6797525dce010e. Fixes the eight independent audit failures at c47f6c6d. Current service remains app344 / PREVIEW Worker341.
- Shared profile patch/mirror writers use a fresh conditional merge in overlay mode, preserving current follower/following counts and followSync354 pending/exact/order records. Missing shared profiles fail closed rather than importing frozen legacy counters.
- Overlay public profile, connection, first-view and permission readers repair pending work or fail closed. First-view validates shared R2 revision before returning a cached response/304; mutation and request-driven recovery invalidate UID + actual handle keys. Legacy follow writer/client branches remain unchanged.
- Social snapshot and following-bundle use effective overlay pages with completeness/truncation/cursor metadata. Client absence on an incomplete list uses a targeted state lookup. Existing cache schema/like behavior/UI are preserved; no app-version cache reset.
- Certified same-state/new-ID requests persist only the pair ordering receipt (one R2 write), without profile markers/history SUM. Duplicate IDs make no relation/count writes. The normal rate guard adds one necessary R2 CAS per request.
- Overlay request limiting keeps the original RATE_LIMITS.follow / RATE_LIMIT_WINDOW_MS through bounded R2 CAS and uses the existing native limiter with a separate follow key. RATE_DB is untouched; no binding/resource configuration change. Existing legacy rate path remains intact.
- Local TypeScript and Build PASS (existing chunk/import warnings); verify347/348/349(includes353)/350/351/352/354/355 PASS. Also 345 functional/creator, 346 metadata, 197 likes, 198 snapshot diagnostics, 202 action bounds, 114 parity PASS. 345 continues to expose unchanged legacy trigger amplification, not an overlay billing claim.
- verify355 executes actual consumer functions: stale profile edit/mirror and concurrent CAS conflict, relation-saved/R2-failed readers, dirty profile edit, missing-profile fail-closed, social snapshot with missing-like fallback, 5002 memberships over two pages, follower save allow/deny, handle cache revision/recovery, no-op receipt, client missing-target recovery, and rate rejection. Existing 354 stale/reverse/concurrent/crash tests remain intact.
- Initial remote Run [37209848937](https://github.com/andrawing1212/soridraw-music/actions/runs/37209848937) SUCCESS on c28a6eb8: relation W2/W1/W2/W1, duplicates/stale W0; HTTP new follow R2/W2, unfollow R6/W1, duplicate R1/W0, same-state R4/W0, stale R1/W0, relation-saved failure R5/W1, recovery R16/W0. RATE_DB W0 throughout; owned DB deletion PASS. R2/native limiter are memory fixtures, not real billing/live-device proof. Final code 634589b2af0aa8041fe394402aa6f3a7a7abdc99 additionally fences malformed/future rate windows; final Run [37210263354](https://github.com/andrawing1212/soridraw-music/actions/runs/37210263354) SUCCESS with identical measured costs and owned D1 deletion PASS. The final follow-up changes documentation only; no code/billing sample mismatch.
- No deployment, shared migration/manifest activation, shared/user data write, backfill or TEST/PRODUCTION/main change. Final audit main/production refs remain f7fc25d5452b3313efa3cca53c180c5494cc9837 / e994340f3c4f6ac97f444f1ddf13053d3faffa71; preview/main/production protection was confirmed enabled. No new branch or workflow. Remaining gates: independent Astra re-audit, live R2/Worker contention and PC/mobile, all-environment cutover compatibility and missing-profile baseline policy. RELEASE BLOCKED.

## 0P0. protocol354 Astra 독립감사 FAIL — 배포 차단 8건 (2026-10-04 KST)

- 기준 branch/commit: `preview` / `c47f6c6dbca385787b1cd5cd0f5c61585f7a27a7`.
- 독립 감사 판정: **FAIL**. 현재 후보는 PREVIEW 배포/활성화 금지.
- 관계 SQL 자체의 isolated D1 physical W1~W2 증거는 유효하지만, 실제 HTTP 전체 경로 비용과 모든 reader/cache 호환성은 아직 미통과.

확인된 차단 항목:
1. `patchPublicProfileBundle245` 및 `writeExploreSharedProfile060`이 오래된 profile bundle을 무조건 저장해 정확한 follower/following count와 pending/exact 복구 기록을 되감을 수 있음. 공유 프로필 writer는 최신 객체 CAS 병합 + follow count/recovery metadata 보존 필요.
2. `readSharedProfileConnection348`, public profile, first-view 경로가 pending/exact 미완료 상태를 복구하지 않고 동결된 legacy D1 count를 정상값처럼 반환할 수 있음. overlay reader에서 복구/fail-closed 필요.
3. `handleMySocialSnapshot042`이 overlay 대신 legacy R2/legacy follows를 사용하여 다른 PC/모바일에서 새 팔로우를 누락할 수 있음. snapshot follow authority를 overlay/effective reader로 전환하고 client complete 판정 수정 필요.
4. `handleMyFollowingR2Bundle` 353 경로가 5,000 제한 잘림을 complete 목록처럼 반환 가능. completeness/pagination 신호와 incomplete cache의 개별 relation 확인 필요.
5. `handleFollowerSaveAccess`가 legacy `follows`만 검사해 overlay 신규 팔로우/해제와 권한이 어긋남. cutover 이후 effective membership 사용, legacy 분기 유지.
6. follow mutation/recovery가 UID cache만 무효화하고 실제 handle first-view cache를 남길 수 있음. UID+handle 캐시 무효화가 mutation과 recovery 양쪽에 필요.
7. relation 변화 없는 동일 상태 요청도 `completeFollowIntent354 -> repairFollowProfile354`에서 exact recovery/R2 writes를 반복. 정상 no-op과 장애 recovery를 분리해 불필요한 R2/overlay history 합산 금지.
8. Run `37206991230`의 W1~W2는 relation SQL 단독 증거이며 `enforceUserRateLimit`의 RATE_DB write 등 실제 HTTP 총비용은 제외. 실제 Worker HTTP 경로에서 DB + RATE_DB + R2 비용을 분리 측정해야 함.

보호 범위:
- 좋아요 / 공개·비공개 / 검색 / 크리에이터 추천 / UI 정상 경로 변경 금지.
- shared migration, cutover manifest 활성화, 사용자 데이터 write/backfill/delete, TEST/PRODUCTION/main 변경 금지.
- 실제 서비스는 여전히 app344 / PREVIEW Worker341.

다음 합격 조건:
- 위 8건 수정 후 TypeScript/Build 및 347~354 + 새 verifier PASS.
- stale/duplicate/reverse/crash/no-op/profile-edit/social-snapshot/5001-follow/follower-save-access/handle-cache recovery 재현 PASS.
- isolated relation SQL W1~W2 유지 + 실제 HTTP 경로 DB/RATE_DB/R2 비용 계측 분리.
- Astra 독립 재감사 PASS 전 PREVIEW 배포 금지.

## 0OZ. Follow candidate354 — crash-consistent orchestration implemented, NOT activated (2026-10-04 KST)

- Branch: preview. Exact starting HEAD: `9709c6f2ef06d40d6c780f07ec856c4a917449f6`. App344 / deployed PREVIEW Worker341 remain the documented live baseline; no release requested or executed.
- Actual overlay HTTP writer now delegates to durable R2 pair intent + both endpoint dirty markers + fenced 350 relation writer + 352 conditional delta / 351 indexed exact count read + CAS settlement. Overlay wrapper skips legacy following/profile sync. Missing manifest still uses the original legacy path.
- Naturally touched overlay edges retain ordering tombstones on return to baseline. Removing the fence permits a suspended old request to resurrect an older relation. No backfill, new columns, indexes or shared migration. This supersedes the earlier candidate's delete-to-baseline writer for protocol354 only; unfenced 350 remains a historical dormant fixture path, not a runtime caller.
- Pending intents survive Worker termination and R2 save/response failure. Follow-state GET and the next follow request replay safely and repair exact counts. Count snapshots capture the profile etag BEFORE replay/read; new registrations or profile edits invalidate stale snapshots. Pending work is bounded to 32 per profile and CAS retries to 6; exhaustion fails closed with 503.
- Ordered client contract: explicit server `FOLLOW_ORDER_REQUIRED` response negotiates protocol354/revision through follow-state. Stable operation id survives uncertain retries in the page; same-pair overlay requests are serialized. Revision conflicts are not automatically rebased. Legacy keeps the original one request/no extra body/read. No UI/CSS change.
- Shared manifest additionally requires `crashConsistentWriter354=true` and `orderedClientRequests354=true`. Neither manifest nor shared schema was written. TEST/PRODUCTION must understand the contract and profile fence preservation before a separately approved cutover.
- Local TypeScript / final Build PASS (existing size/import warnings). Verify347/348/349(includes353)/350/351/352/354 PASS; 345 functional, 346 creator metadata/recommendation, 197 likes, 202 action bounds, 114 parity and deployment preflight PASS. Verify345 continues to report the unchanged legacy physical amplification as unresolved; it does not certify overlay billing.
- Verify354 executes actual functions with SQLite + conditional R2 fixtures: crash after each durable write/response loss, half-registration failure, duplicate/conflicting ids, reverse arrivals, baseline refollow, resumed old writer, concurrent same pair / shared target, actual HTTP delegation, ordered client negotiation/queue/retry, and unchanged unrelated functions/legacy statements.
- Implementation source: `c911ae4d86159d55335f02a0df155904e8fcae6f`. Audited source including corrected measurement: `3b7a27e5d558b4bec2d2a8614aafd5c32ffbc26c`. Final follow-up commit changes documentation only.
- Isolated remote billing / full Release System Audit Run [37206991230](https://github.com/andrawing1212/soridraw-music/actions/runs/37206991230): SUCCESS. Actual 350 protocol354 SQL: new follow Rows Written2/Read1; new unfollow W1/R3; legacy unfollow W2/R3; legacy refollow W1/R5; all duplicates W0; suspended stale request W0/R1. Forward/reverse indexed list fixture Rows Read9/9; pair PK lookup PASS. Owned synthetic D1 deletion PASS. Shared canonical DB writes0. TS/build/static regression/TEST-PRODUCTION dry-run/read-only shared preflight PASS. This is isolated D1 evidence, NOT live end-to-end R2/Worker/PC-mobile certification. Initial failed measurement expectation and successful correction are retained in the audit document.
- No Firebase / Functions / Cloudflare deployment or resource configuration change; no shared/user DB mutation, migration, seed, backfill or data copy. Main/production refs fixed before work: `f7fc25d5452b3313efa3cca53c180c5494cc9837` / `e994340f3c4f6ac97f444f1ddf13053d3faffa71`.
- Remaining gates: real R2/Worker end-to-end cost, live contention/PC-mobile behavior, all-environment protocol compatibility/profile writer fence preservation, baseline integrity/missing-profile recovery policy, and the separate shared migration/cutover approvals. RELEASE BLOCKED. Detailed correctness and cost limits: FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md continuation354.

## 0OY. 팔로우 W2 물리비용 경로 실증 + app347 호환 1단계 PASS (2026-10-04 KST)

**중요: 아직 배포 완료가 아니다. 실제 앱은 app344 / PREVIEW Worker341 유지.**

### app347 호환 1단계
- 현재 D1을 canonical authority로 유지한 채, R2 following summary에 정확한 following count + monotonic revision을 추가하는 후보 구현.
- 기존 5,000명 membership cap과 정확한 count를 분리해, capped list를 완전한 목록으로 오인하지 않음.
- 오래된 mutation이 최신 count/list를 되감지 못하도록 R2 conditional write/CAS + revision guard 추가.
- 기존 v114 writer가 새 exact-count object를 덮지 못하도록 fence 추가.
- follow 후 R2 local/shared 동기화의 중복 read/write loop를 shared fast-path로 축소.
- D1 physical write/read는 **이 단계에서 일부러 변경하지 않음**. 현재 비용 문제를 해결했다고 보고하지 않는다.

Release System Audit:
- Run `37175153805`: **SUCCESS**.
- TypeScript PASS / Build PASS / hard static release gate PASS.
- `verify-347-follow-authority.mjs` hard gate PASS.
- canonical Worker SHA lock PASS: `498c939d1a45dd67017167e4b333bac59a3ae990cc6f9b90a5317d7d6d32df27`.
- TEST/PRODUCTION dry-run PASS / shared D1 preflight SELECT-only PASS.
- 배포/사용자 데이터 변경 0.

### 실제 shared D1 팔로우 원인 감사
Read-only Run `37175284793`: SUCCESS / remote D1 writes 0.

live `follows`:
- rowid table + composite PK autoindex.
- `idx_follows_follower_created`.
- `idx_follows_following_created`.
- follow INSERT/DELETE마다 global shared revision trigger 존재.

live `profile_stats`:
- PK index.
- update마다 shared revision trigger.
- update → `explore_derived_profiles` counter update.
- derived counter update → seq 증가 + profile journal write.

따라서 현재 follows 관계 1건 자체도 여러 physical row를 쓰며, 양쪽 profile_stats/derived trigger가 더 붙는다. 현재 구조를 query W2로 묶는 것만으로 Rows Written W1~W2는 불가능하다는 원인을 live schema로 확인.

### W2 후보를 실제 Cloudflare 원격 D1에서 실증
격리 synthetic D1 Run `37175419175`: SUCCESS. shared/user DB 미사용, 종료 후 DB 삭제 PASS.

후보:
- legacy `follows`는 immutable baseline.
- post-cutover 변경만 `explore_follow_overrides_348` sparse overlay에 기록.
- overlay는 `WITHOUT ROWID` PK(follower_uid,following_uid).
- 신규 active follower reverse 탐색용 partial index 1개만 사용.
- legacy data backfill 0.

실제 Cloudflare D1 billing:
- 새 관계 follow: **Rows Written 2 / Rows Read 0**.
- 같은 follow 재요청: **W0**.
- 새 관계 unfollow(원래 baseline 미존재로 복귀): **Rows Written 1 / Rows Read 1**.
- legacy 관계 unfollow: **Rows Written 1 / Rows Read 0**.
- legacy 관계 refollow(원래 baseline으로 복귀): **Rows Written 1 / Rows Read 1**.
- 중복 unfollow/refollow: **W0**.
- forward 목록 test Rows Read 9 / reverse 목록 test Rows Read 8, 둘 다 index search이며 whole-table scan 없음.
- targeted pair lookup PK/index search PASS.
- legacy follows row 3개 그대로 유지, backfill/rewrite 0.

**결론**
- 사용자 비용 합격선 W1~W2를 실제 D1에서 만족하는 저장 구조를 찾음.
- 하지만 shared cutover는 아직 실행 금지.
- 이유: TEST/PRODUCTION 현재 Worker가 legacy follows/profile_stats/derived counters를 읽고 쓰므로, 먼저 3환경 reader/writer compatibility를 배포해야 shared canonical을 overlay authority로 전환할 수 있음.
- 지금 shared schema, trigger, user data는 변경하지 않았다.

## 0OX. 9d10970 candidate continued — physical follow / cold-device release BLOCKED (2026-10-04)

- Branch preview; basis 9d10970b44c072d16c4355fc868ea25f083d4eeb. app344 / deployed Worker341 unchanged. Candidate not deployed.
- Prior W3-to-W2 compaction preserved. Synthetic total_changes remains9. Actual original Rows Read18–19 / Rows Written14–17 = FAIL. Candidate physical metrics unavailable; never declare completion from queryW2.
- Runtime reader audit confirms current main/production consume both D1/derived counters. R2 membership has truncation/concurrency/failure holes. Shared authority/trigger cutover NOT executed; two-stage prerequisites and outstanding implementation recorded in FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md.
- Feed existing bounded joins/publication/derived generation now carry ownerProfileGenres. Existing authenticated cold snapshot carries self profile genres from one direct R2 GET, no extra Worker/D1. Client caches/reranks without candidate N+1. Existing legacy R2 Feed coverage remains unresolved, so cold-device completion NOT declared.
- TypeScript/Build/relevant functional verifiers PASS. Actual physical release gate FAIL; PC/mobile and live cold coverage unverified. Independent Work audit corrections applied; no release.
- No migration/backfill/delete/data copy, main edit, TEST/PRODUCTION deployment, Firebase/Functions deployment or resource/config change.
- Next: prepare safe exact/ordered per-actor following authority and all reader cutovers, live read-only index/trigger evidence, approved compatible stage2, bounded legacy Feed genre coverage; then six actual PREVIEW measurements and PC/mobile. Deploy neither service before both gates pass.

## 0OV. 비용 검증 기준 보강 — query W뿐 아니라 D1 Rows Read/Written 동시 합격 필수 (2026-10-04 KST)

사용자 지적 반영.

팔로우/좋아요/공개·비공개/프로필 수정 등 비용 검증에서 이제 아래를 항상 한 세트로 본다.

- D1 query read/write
- D1 Rows Read
- D1 Rows Written
- Worker 요청 수
- R2 Class A/B
- Firestore read/write

특히 logical `D1 W3`만 낮아 보여도 실제 `Rows Read/Written`이 크게 증가하면 비용 최적화 PASS로 보지 않는다.

2026-10-04 팔로우 해제 실사용 캡처:
- 한 실행에서 `D1 query R0/W3`인데 실제 `Rows Read 18 / Rows Written 14`
- 이어진 실행에서는 `Rows Read 19 / Rows Written 17`
- 따라서 현재 팔로우 경로는 비용 기준 FAIL로 취급.

다음 팔로우 수정의 합격 조건:
- 관계 1개 변경만 처리
- 전체 follows/profile/feed scan 금지
- Rows Read/Written이 변경량에 비례하는 O(1)이어야 함
- query W 수치와 physical row 수치를 둘 다 기록
- PREVIEW 실사용에서 같은 동작을 3회 이상 반복해 수치가 안정적으로 낮은지 확인
- 비용 원인을 모르면 다음 기능 작업으로 넘어가지 않음

## 0OU. app344 실사용 발견 — 팔로우 변경 실제 D1 row 증폭 + 크리에이터 추천 범위 확장 필요 (2026-10-04 KST)

**사용자 실사용 발견**
- 공개프로필에서 팔로우 해제를 1회 수행했을 때 CACHE LIVE의 팔로우 변경은 D1 W3로 보이지만 Cloudflare 실제 D1 rows read/written 증가가 더 큼.
- "좋아할 만한 크리에이터"는 최신 공개곡 40개에 등장한 owner만 후보가 되는 현재 구조라 추천 범위가 너무 좁음.

**코드 감사 결과 — 팔로우**
- 현재 canonical Worker는 app245/246 최적화가 이미 들어 있어 follow 후 불필요한 profile 전체 재조회와 R2 counter D1 post-read는 제거된 상태이며, `adjustExploreFollowCountersDelta`도 `RETURNING` 기반 no-postread guard를 갖고 있음.
- 그러나 실제 canonical mutation은 여전히 follows 1행 + 양쪽 `profile_stats` counter 2행을 변경하는 W3 구조.
- `profile_stats` 두 변경은 shared D1의 `explore032_profile_stats_update` → `explore_derived_profiles` → `explore032_derived_profile_update` 경로를 깨우므로 Cloudflare 물리 row-write/read는 CACHE LIVE의 논리 W3보다 커질 수 있음.
- PREVIEW wrangler는 shared canonical `DB=soridraw-explore-db`와 별도 `RATE_DB=soridraw-explore-preview-db`를 사용하므로 실제 계기판 감사 시 두 DB를 구분해야 함.
- 결론: 사용자 관찰은 정상적인 "W3만 발생"으로 볼 수 없으며 physical row amplification까지 합격선에 포함해야 함.

**다음 비용 목표**
- 우선 non-destructive verifier에서 팔로우 1회 logical W와 physical row changes를 분리 계측.
- follow canonical edge를 가능한 W1에 가깝게 만들되 follower/following 수 정확도, PC↔모바일, 공유 PREVIEW/TEST/PRODUCTION 데이터 호환성 보호.
- shared D1 trigger 변경이 필요하면 코드만 먼저 준비/검증하고 실제 shared schema 변경은 별도 안전 확인 후 진행.

**크리에이터 추천 확정 방향**
1. 내 공개프로필 대표 장르와 비슷한 크리에이터 최우선.
2. 부족하면 SORIDRAW 추천곡 owner.
3. 다음 최신 공개곡 owner.
4. 다음 인기곡 owner.
5. 내 계정 제외 + creator UID 중복 제거.
- 후보의 대표 장르 때문에 프로필을 N개씩 개별 서버 조회하는 구조 금지. R2/로컬 파생 요약을 사용해 D1 0 목표.

**현재 배포 상태**
- app344 PREVIEW는 그대로 유지.
- 이 감사 기록만 추가. Worker/Firebase/Functions/Cloudflare/D1/user data 변경 없음.

## 0OT. PREVIEW app344 — Explore 필터 버튼 가독성 확대 (2026-10-04 KST)

**변경**
- 장르별 추천의 대분류/세부장르 칩과 최신 공개곡의 전체/팔로잉 등 동일 계열 필터 버튼을 조금 확대.
- PC: 높이 30→34px, 좌우 여백 11→13px, 글자 11→12px.
- 모바일: 높이 28→32px, 좌우 여백 10→12px, 글자 10→11px.
- 버튼 기능/배치/색/테마/장르 분류 로직 변경 없음.

**배포**
- app344.
- PREVIEW release commit: `d3a132f5a2cfbde4503ac4211b57723c4830952a`.
- Firebase PREVIEW Run `37169322007`: **SUCCESS**.
- TypeScript PASS / Build PASS / Hosting PASS / exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore / 사용자 데이터 변경 없음.

## 0OS. PREVIEW app343 — 장르별 추천 대분류/세부장르 2줄 구조 (2026-10-04 KST)

**사용자 확정 기준**
- 첫째 줄은 포괄적인 대분류 장르.
- 둘째 줄은 세부 장르.
- 첫째 줄 클릭으로 둘째 줄이 펼쳐지거나 교체되는 구조 금지. 두 줄은 독립.
- `소울 / 펑크`, `포크 / 어쿠스틱`, `클래식 / 시네마틱`처럼 서로 다른 대분류를 한 칩으로 묶지 않음.
- K-Pop / J-Pop은 대분류로 허용.
- K-록 / K-발라드 / K-뉴잭스윙 / 얼터너티브 R&B 등은 세부장르 줄.

**app343 변경**
- 첫째 줄: 현재 Feed에 존재하는 곡을 broad family로 로컬 집계.
  - 팝, K-Pop, J-Pop, 힙합, R&B, 소울, 펑크, 록, 메탈, EDM, 재즈, 포크, 어쿠스틱, 컨트리, 월드뮤직, 레게, 라틴, 아프로, 트로트, 7080 가요, 클래식, 시네마틱, 연주곡 중 해당되는 대분류만 고정 순서로 표시.
- 둘째 줄: 현재 Feed의 실제 세부 장르를 canonical label로 독립 표시.
- 대분류 클릭은 해당 broad family의 곡만 표시. 세부장르 줄 내용은 그 클릭 때문에 펼쳐지거나 교체되지 않음.
- 세부장르 클릭은 해당 세부 장르 곡만 표시.
- 기존 app342의 두 줄 독립 좌우 스크롤 유지.
- 이미 로드된 Feed 40곡만 사용. Worker/D1/Firestore 추가 읽기 없음.

**배포/검증**
- product source `460f817da0bc7d9ecfa54c83c3275e4cfb6e87aa`.
- release commit `fb31fd1faf0751e2ad39d2e92231c28bbace5391`.
- Firebase PREVIEW Run `37168925936`: **SUCCESS**.
- TypeScript PASS / Build PASS / PREVIEW Hosting PASS / exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules / 사용자 데이터 변경 없음.

**남은 확인**
- 실제 PREVIEW에서 첫줄 대분류 / 둘째줄 세부장르가 의도대로 보이는지 실사용 확인 전.

## 0OR. PREVIEW app342 — 장르별 추천 정리 + 2줄 분리 + 가로 스크롤 복구 (2026-10-04 KST)

**사용자 요청**
- 장르별 추천에서 같은 장르의 ID/영문 표기 중복을 정리.
- 첫 줄은 한글 장르명, 둘째 줄은 한글 표기가 없는 장르를 영문으로 표시.
- 장르가 화면 폭을 넘을 때 잘리지 않고 좌우로 이동 가능하게 수정.

**app342 변경**
- 이미 로드된 Explore Feed 40곡만 사용. 새 Worker/D1/Firestore 조회 없음.
- `GENRES + GENRE_HIERARCHY`의 id/영문명/한글명을 기기에서만 대조해 canonical 장르로 합침.
  - 예: `neo_soul / Neo Soul → 네오 소울`
  - `k_new_jack_swing / K-New Jack Swing → K-뉴잭스윙`
  - `underground_hiphop / Underground Hip-Hop` 같은 중복도 한 항목으로 합침.
- 한글 표시명이 있는 장르는 첫 줄, 한글 표시명이 없는 장르는 둘째 영문 줄.
- 두 줄 각각 독립 horizontal overflow.
- 마우스 휠/트랙패드의 세로 delta도 해당 줄이 실제로 더 이동할 수 있을 때만 좌우 이동으로 사용.
- 장르 선택은 기존 로컬 추천 카드 필터만 변경하며 추가 서버 요청 없음.
- 좋아요/저장하트/폴더/Split/Music Note/검색 Worker 변경 없음.

**변경 파일**
- `src/pages/ExplorePage.tsx`
- `src/components/explore/explore.css`
- `public/app-version.json`
- `.deploy/preview-app-release.trigger`

**검증/배포**
- product source: `735b01b428d04e3577bb6bfe4ca7cda0b1f60e8c`
- PREVIEW release commit: `566d10cac7dbf0387404d5d3ca597c665ee49195`
- Firebase PREVIEW Run `37167991654`: **SUCCESS**
- TypeScript PASS / Build PASS.
- Firebase PREVIEW Hosting PASS.
- `preview.soridraw.com` exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 변경 없음.

**남은 확인**
- 실제 화면에서 한글/영문 두 줄 분리와 중복 제거, PC/모바일 좌우 스크롤 체감 확인 전.

## 0OQ. PREVIEW Worker 341 — Explore 검색 D1 완전 차단 + 승인된 R2 검색 카탈로그 1회 백필 (2026-10-04 KST)

**사용자 승인 목표**
- 처음 보는 검색어도 D1 read/write 0.
- 오타/랜덤 문자열도 D1 read/write 0.
- 같은 검색어 재검색은 app340 기기 캐시로 Worker 0 / D1 0.
- 기존 공개곡 제목/장르/아티스트 검색 기능은 R2 검색 카탈로그로 유지.

**실행한 1회 파생 카탈로그 백필**
- 사용자 승인 후 기존 공개곡을 shared R2 검색 카탈로그에 1회 채움.
- 대상 공개곡: **45곡**.
- Run `37163637669`: **SUCCESS**.
- 45/45 R2 marker + shared track-card 검증 PASS.
- D1은 SELECT/read-only만 사용.
- D1 write 0 / schema change 0.
- 사용자 원본 데이터 write/delete/rewrite 0.
- 임시 backfill Worker는 작업 완료 후 삭제.
- product commit: `9c11b95cf4c95210011b1425cea23f3e51cbf34f`.

**Worker 341 검색 구조**
- PREVIEW hybrid mode의 `/v1/search` 일반 사용자 경로에서 legacy D1 search fallback 제거.
- 검색 authority를 R2 catalog로 고정.
- 제목 / 장르 / 아티스트 nickname·handle 검색은 R2 catalog prefix + shared R2 track-card/profile을 사용.
- 없는 검색어/오타/랜덤 문자열도 빈 R2 결과만 반환하며 D1 query를 실행하지 않음.
- 검색 Edge Cache 5분 유지.
- app340의 동일 검색어 기기 로컬 캐시 2분 경로는 그대로 유지.
- likes / save heart / folders / Split / Music Note batching 변경 없음.

**검증**
- app341 verifier:
  - `APP341_SEARCH_R2_ONLY=PASS`
  - `APP341_SEARCH_D1_R0_W0_CONTRACT=PASS`
  - `APP341_RANDOM_QUERY_D1_R0_W0=PASS`
  - TypeScript PASS / Build PASS.
- Final Release System Audit Run `37164010278`: **SUCCESS**.

**PREVIEW 배포**
- PREVIEW Worker Release Run `37166719557`: **SUCCESS**.
- active Worker version: `59ed42ea-f29a-4837-a9a7-20e70648e59c`.
- PREVIEW release preflight PASS.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- Firebase Hosting은 변경 없음 — 앱 UI는 계속 **app340**.

**실기기 최종 확인**
1. CACHE LIVE 초기화.
2. 처음 입력하는 정상 제목/ID/아티스트 검색 1회:
   - Worker 1 가능 / D1 query R0 W0 / rows R0 W0.
3. `힙합` 등 한글 장르 첫 검색:
   - Worker 1 가능 / D1 R0 W0.
4. 랜덤/오타 검색 예: `ㅁㄴㅇㄹ341`:
   - Worker 1 가능 / D1 R0 W0.
5. 같은 검색어를 2분 안에 재검색:
   - app340 local cache hit이면 Worker 증가 0 / D1 증가 0.

## 0OP. PREVIEW app340 — 동일 검색 재실행 Worker 0 / D1 R0 로컬 캐시 (2026-10-04 KST)

**사용자 요구**
- 첫 검색은 서버 1회 허용.
- 같은 검색어의 두 번째 검색부터는 서버 호출 0, D1 R0 목표.

**app340 변경**
- Explore exact search 결과를 기기에 2분간 저장.
- 같은 request URL(검색어 + 장르 alias 조합)이 2분 안에 다시 검색되면:
  - Worker 호출 0.
  - D1 R0/W0.
  - 기기 로컬 캐시에서 즉시 결과 표시.
- 첫 검색은 기존 app339 R2-first + indexed genre path 사용.
- 검색 결과가 없거나 오류인 경우 정상 서버 fallback 유지.
- Feed / 공개프로필 / 좋아요 / 저장하트 / 폴더 / Split / Music Note 구조 변경 없음.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.

**검증**
- TEMP app340 Verify Run `37161309234`: SUCCESS.
- TypeScript PASS / Build PASS.
- app340 repeat-search Worker-zero contract PASS.
- Music Note batching regression PASS.
- Final Release System Audit Run `37161393974`: SUCCESS.

**배포**
- Firebase PREVIEW App Release Run `37161506204`: SUCCESS.
- PREVIEW app version **340**.
- `preview.soridraw.com` exact build PASS.
- shared RTDB Rules SKIPPED.
- TEST / PRODUCTION Hosting unchanged PASS.
- Worker는 app339 active `aedd8111-b2f4-407f-9e3f-ba062a82ed16` 그대로 유지.
- approved source: `5dfe5b0b9183c27b946136dc8d25bca11303606b`.

**실기기 최종 확인**
1. `힙합` 첫 검색: Worker 1회 허용.
2. 2분 안에 같은 `힙합` 재검색:
   - Browser/local cache hit.
   - Worker 증가 0.
   - D1 query/read 증가 0.
3. 실패하면 app340 검색 캐시 경로 FAIL로 처리하고 다음 승격 중단.

## 0OO. PREVIEW Worker app339 hotfix — 한글 장르 검색 alias 폭증 제한 + 90초 Edge Cache (2026-10-04 KST)

**사용자 실기기 관찰**
- app338 이후 한글 `힙합` 검색 1회:
  - D1 query R16 / W0
  - rows_read R250 / W0
- 전체 스캔은 제거됐지만 alias 하나의 검색이 여러 영문 장르로 fan-out되며 indexed query가 반복되는 비용이 남음.

**원인**
- 클라이언트가 `힙합` 한 번에 Hip-hop 계열 여러 alias를 전달.
- Worker가 alias마다 `primary_genre` + legacy `track_tags` 두 indexed query를 각각 수행.
- 그래서 한 번의 사용자 검색이 다수의 작은 indexed query로 증폭.

**app339 수정**
- 정확한 한국어 메인 장르:
  - `힙합 → Hip-hop`
  - `재즈 → Jazz`
  - `트로트 → Trot`
  - `록/락 → Rock`
  - `메탈 → Metal`
  - `하우스 → House`
  - `테크노 → Techno`
  - `트랜스 → Trance`
  - `클래식 → Classical`
  - `팝 → Pop`
  로 **alias 1개만** 사용.
- `발라드`, `시티팝` 같은 family 검색도 최대 alias 3개로 제한.
- 한글 장르 fallback 결과는 Cloudflare Edge Cache에 **90초** 저장.
  - 같은 Edge에서 같은 검색어 재검색 시 D1 **R0 목표**.
- R2-first 검색 유지.
- app338 indexed primary_genre / track_tags fallback 유지.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.
- 앱 Hosting 변경 없음, app337 유지.

**검증**
- app339 apply/verify Run `37160726661`: SUCCESS.
- TypeScript PASS / Build PASS.
- app336 hybrid regression PASS.
- app197/app210 like regression PASS.
- Final Release System Audit Run `37160817225`: SUCCESS.

**배포**
- PREVIEW Worker Release Run `37160937090`: SUCCESS.
- active PREVIEW Worker version: `aedd8111-b2f4-407f-9e3f-ba062a82ed16`.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- product source commit: `9ede46e248847d9fc8b11508dcda432c8f763c41`.

**다음 실기기 확인**
1. 같은 `힙합` 검색 1회.
2. 바로 같은 `힙합` 검색을 한 번 더.
3. 기대:
   - 첫 검색: app338의 R16/R250보다 크게 낮아야 함.
   - 두 번째 검색: Edge Cache hit이면 D1 R0/W0 목표.
4. 두 번째도 D1이 남거나 첫 검색이 여전히 과도하면 FAIL 처리.

## 0ON. PREVIEW Worker app338 hotfix — 한글 장르 검색 D1 R500~600 폭증 제거 (2026-10-04 KST)

**사용자 실기기 관찰**
- ID/제목 검색: 정상.
- 한글 장르 검색: `/v1/search` 1회마다 D1 rows_read 약 **R584** 관찰.

**원인 확정**
- app337의 한글 장르 legacy fallback이 기존 `handleGenreTracksCore066` 쿼리를 재사용.
- 해당 쿼리는 `primary_genre = ? OR (... EXISTS track_tags ...)` 구조라 SQLite planner가 장르 인덱스를 사용하지 못하고:
  - `SCAN t USING INDEX idx_tracks_latest_order`
  - 각 행마다 tag lookup
  로 동작.
- read-only live query-plan audit Run `37159126328`에서 원인 재현 PASS.
- 같은 라이브 DB에는 이미 다음 인덱스가 존재:
  - `idx_tracks_primary_genre_latest`
  - `idx_track_tags_kind_value_track`
  - `idx_track_tags_lookup`
- 즉 새 schema/index 생성은 필요 없음.

**app338 수정**
- R2-first 검색은 그대로 유지.
- R2 결과가 없는 한글 장르 fallback만 별도 indexed path로 교체.
- `primary_genre` branch:
  - `INDEXED BY idx_tracks_primary_genre_latest`
- legacy `track_tags` branch:
  - `INDEXED BY idx_track_tags_kind_value_track`
- 두 결과만 합쳐 반환.
- 기존 scan-prone `handleGenreTracksCore066` 호출 제거.
- broad legacy title/artist search fallback은 마지막 호환층으로 그대로 유지.

**검증**
- app338 apply/verify Run `37159304152`: **SUCCESS**.
- live query plan:
  - primary genre: `SEARCH t USING INDEX idx_tracks_primary_genre_latest (primary_genre=?)` PASS.
  - legacy tag: `SEARCH tt USING COVERING INDEX idx_track_tags_kind_value_track (kind=? AND value=?)` + track PK lookup PASS.
- app336 hybrid regression PASS.
- app197 / app210 like regressions PASS.
- shared D1 schema change **0**.
- user data migration/backfill/delete/rewrite **0**.
- Final Release System Audit Run `37159372696`: **SUCCESS**.

**배포**
- PREVIEW Worker Release Run `37159504049`: **SUCCESS**.
- active PREVIEW Worker version: `4929b0b7-3d6b-448a-8fae-1b0ffe7b5941`.
- FEED smoke PASS / PROFILE smoke PASS.
- public-like-card D1 R0/W0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- Firebase Hosting 재배포 없음 — app은 계속 **337**.
- product source commit: `7e5f6b9c1cdd0f0ad0d24611568aa2117495c3b9`.

**다음 실기기 확인**
1. 동일한 한글 장르 검색어를 다시 1회 검색.
2. 기대값:
   - 이전 R584 같은 전체 스캔은 없어야 함.
   - R2에 장르 marker가 있으면 R0 가능.
   - legacy fallback이어도 matching rows 중심의 소량 read만 허용.
3. 여전히 수백 read면 즉시 FAIL 처리하고 다음 단계 중단.

## 0OM. PREVIEW app337 배포 완료 — 검색 D1 폭증 완화 + 한글 장르 검색 (2026-10-04 KST)

**사용자 app336 실기기 결과**
- 공개/비공개, Explore, 공개 프로필 등은 정상.
- 검색 1회에서 legacy D1 search가 먼저 실행되며 rows_read가 크게 증가하는 문제 확인.
- 한글 장르명(예: 발라드/힙합/재즈/트로트 등)을 그대로 검색하면 저장된 영문 장르와 연결되지 않는 사용성 문제 확인.

**app337 변경**
- 검색 first page를 **R2 catalog 우선**으로 변경.
  - R2에서 곡/아티스트 결과가 있으면 legacy D1 search를 호출하지 않음.
  - legacy D1 broad search는 R2에 결과가 전혀 없는 기존 legacy-only 검색어의 최종 호환 fallback으로만 유지.
- 한글 장르 검색:
  - 앱의 기존 `GENRES.labelKo → label` 데이터를 사용해 한글 입력을 같은 1회 검색 요청의 genre alias로 전달.
  - 발라드/시티팝/힙합/R&B/재즈/트로트/록/메탈/하우스/테크노/트랜스/앰비언트/로파이/포크/컨트리/소울/펑크/클래식 등의 broad alias 보강.
  - R2 marker가 없는 legacy 곡은 broad search가 아니라 기존 indexed genre route로 bounded fallback.
- 검색 UI/레이아웃/기존 공개/좋아요/저장/폴더/Split/Music Note 저장 구조 변경 없음.
- shared D1 schema/index/trigger 변경 0.
- 사용자 데이터 migration/backfill/delete/rewrite 0.

**검증/배포**
- app337 apply/verify Workflow Run `37154967808`: **SUCCESS** (attempt 3).
  - app337 R2-first verifier PASS.
  - Korean genre alias verifier PASS.
  - app336 hybrid regression PASS.
  - like/publication/Music Note focused regression PASS.
  - TypeScript PASS / Build PASS.
- Final Release System Audit Run `37155219113`: **SUCCESS**.
- PREVIEW Worker Release Run `37155369295`: **SUCCESS**.
  - active Worker version: `4b3e02c8-f906-4c22-bbc1-36cd963babee`.
  - FEED smoke PASS / PROFILE smoke PASS.
  - public-like-card D1 R0/W0 PASS.
  - TEST / PRODUCTION Worker unchanged PASS.
- Firebase PREVIEW App Release Run `37155428848`: **SUCCESS**.
  - `preview.soridraw.com` app **337** exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
  - shared RTDB Rules SKIPPED.
- approved product source commit: `7465cce1f14d418059946651d9b05d19229ccea2`.

**남은 제한**
- catalog에 아직 marker가 전혀 없는 오래된 legacy-only 제목/아티스트 검색은 최종 호환 fallback으로 D1 search를 1회 사용할 수 있음.
- 이를 완전히 0으로 만들려면 기존 공개곡의 R2 catalog를 한 번 채우는 derived-cache backfill 또는 3환경 cutover가 필요하며, 현재는 실행하지 않음.

**다음 실기기 확인 — 이것만**
1. 이전 영상에서 rows_read가 크게 오른 동일 검색어를 다시 1회 검색.
   - R2 catalog에 존재하는 검색어라면 D1 **R0/W0 목표**.
2. 한글 장르 검색 3개 정도:
   - 예: `발라드`, `힙합`, `재즈` 또는 실제 공개곡 장르의 한글명.
   - 결과가 정상 표시되어야 함.
3. 위 2개가 PASS하면 app337 검색 수정 종료.
4. legacy-only 검색어에서 여전히 D1 fallback이 확인되면 별도 derived R2 catalog backfill 승인 여부를 판단.

## 0OL. PREVIEW app336 배포 완료 — R2 + legacy hybrid read 호환층 활성 (2026-10-04 KST)

**실제 배포 상태**
- preview HEAD: `be3ce04652ae6c3604aba872e857c19a703a1876`.
- Final Release System Audit Run `37152439362`: **SUCCESS**.
- PREVIEW Worker Release Run `37152582192`: **SUCCESS**.
  - active Worker version: `903c72d5-a569-45e7-a196-947b74ddd6e2`.
  - `SORIDRAW_R2_HYBRID_READ_V1=1` 활성.
  - FEED smoke PASS / PROFILE smoke PASS.
  - public-like-card smoke D1 **R0/W0 PASS**.
  - TEST / PRODUCTION Worker unchanged PASS.
- Firebase PREVIEW App Release Run `37152665528`: **SUCCESS**.
  - remote app version **336**.
  - `preview.soridraw.com` exact build PASS.
  - TEST / PRODUCTION Hosting unchanged PASS.
  - shared RTDB Rules deploy SKIPPED.
- Functions / Firestore Rules / shared D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete / rewrite 없음.

**app336 목적**
- 기존 legacy-only 공개곡과 R2 catalog-only 공개곡을 동시에 읽는 호환층.
- 같은 track id가 양쪽에 있으면 R2/shared card를 최신 authority로 사용.
- stale legacy 공개행이 private R2 상태를 다시 노출하지 않도록 차단.
- latest / popular / public-profile / genre / title / artist nickname·handle 검색 호환 유지.
- warm client cache Worker-zero(app335) 경로 유지.

**중요**
- 이번 배포는 **read compatibility 선행 단계**다.
- first-publication W12→W2 후보 cutover migration은 아직 실행하지 않았다.
- shared D1 cutover는 사용자 실기기 app336 검증과 3환경 호환층 승격 전까지 금지.
- app164 likes / app302 save heart / app301 folders / app303 Split / Music Note 60초 local-first 정상 기준은 동결 유지.

**다음**
1. 사용자 실기기에서 app336 기능 회귀 확인.
2. Explore/공개프로필 warm 재진입 Worker 0 유지 확인.
3. legacy 곡 + 최근 R2 곡 latest/popular/profile/search 누락·중복 여부 확인.
4. 기존 좋아요/저장하트/폴더/분할/Music Note 동작 확인.
5. 실기기 PASS 뒤에만 TEST/PRODUCTION에 hybrid read 호환층 승격 계획 수립.
6. 세 환경이 hybrid read를 지원한 뒤 별도 명시 승인으로 shared D1 W2 cutover migration 검토.

## 0OK. app336 구현 후보 완료 — R2 + legacy hybrid read 코드/검증 PASS, PREVIEW 배포 전 감사 단계 (2026-10-04 KST)

**구현**
- app336 Worker 호환층을 `preview`에 구현.
- generated canonical Worker commit: `e935d52fa6a63ef9f115ef2c07471f77bd9e726a`.
- PREVIEW-only `SORIDRAW_R2_HYBRID_READ_V1=1` 활성.
- app version source = **336**.
- TEST / PRODUCTION config/code 배포 변경 없음.

**동작 원칙**
- legacy-only 곡은 기존 경로에서 계속 읽음.
- catalog-only 곡은 R2 catalog + shared track-card에서 읽음.
- 같은 track id가 양쪽에 있으면 R2/shared card가 최신 authority.
- catalog meta가 private인 곡은 stale legacy 공개행을 화면에 재노출하지 않음.
- latest / popular / public-profile deep / genre는 hybrid cursor로 legacy + R2를 합성.
- title / artist nickname·handle search first page는 legacy + R2 검색 결과를 합성.
- public-profile first-view의 기존 shared-R2/Edge warm 경로는 유지.
- 호환 단계의 legacy 보충 scan은 최대 4 page로 bounded; 무제한 전체 scan 금지.
- warm client cache Worker-zero(app335) 경로는 변경하지 않음.

**검증**
- Apply/verify Run `37151610954`: **SUCCESS**.
  - isolated Worker composition PASS.
  - legacy-only PASS.
  - catalog-only PASS.
  - mixed dedupe PASS.
  - stale legacy media/count가 R2 authority를 덮지 않음 PASS.
  - hybrid cursor state PASS.
  - search merge PASS.
  - targeted publication/like regression PASS.
  - TypeScript PASS.
  - Build PASS.
  - canonical worker SHA lock PASS: `0367c086772996c21cbf9ae84db3ac5c9796bee19153dbc15b57ee4cd03bc140`.
- shared D1 schema/index/trigger change **0**.
- user data migration/backfill/delete/rewrite **0**.
- Firebase / Worker 실배포는 아직 **0**.

**안전**
- 실제 W2 D1 cutover migration은 이번 app336에 포함하지 않음.
- app336은 세 환경이 향후 같은 read contract를 지원할 수 있게 만드는 선행 호환층.
- app164 likes / app302 save heart / app301 folders / app303 Split / Music Note 60초 local-first / app331~335 publication UI 보호.
- one-shot app336 implementation workflow와 완료된 W2 diagnostic workflow는 정리 완료.

**다음**
1. Final Release System Audit.
2. PASS 시 PREVIEW Worker만 app336 source로 배포.
3. Firebase PREVIEW app336 배포.
4. 실제 `preview.soridraw.com` 및 Worker smoke 확인.
5. TEST / PRODUCTION 비변경 확인.
6. 사용자 실기기 검증 전 shared D1 W2 cutover migration 금지.

## 0OJ. app336 설계 기준 확정 — first-publication W12 원인 완전 분해 + W2 격리모델 PASS (2026-10-04 KST)

**현재 배포 상태**
- 실제 PREVIEW 배포본은 계속 **app335**.
- Firebase / Worker / Functions / Rules 추가 배포 없음.
- TEST / PRODUCTION 변경 없음.
- shared canonical D1 사용자 데이터 변경 없음.

**실제 W12 원인 확정**
- Live schema/runtime read-only audit Run `37149706339`: **SUCCESS**.
- never-published Music Note 첫 공개의 실기기 W12는 현재 구조에서 정확히 다음으로 분해됨.
  1. canonical `tracks` insert: **W6**
     - table row W1
     - PK autoindex W1
     - Music Note에도 적용되는 4개 secondary index W4
  2. `explore_derived_tracks` insert: **W5**
     - table row W1
     - PK autoindex W1
     - latest / popular / profile rank index W3
  3. `explore_shared_revision` update: **W1**
  - 합계 **W12**.
- Music Note derived insert의 generic change-log/state trigger는 이미 `source_type <> 'music_note'` 조건으로 제외되어 있어 W12 원인이 아님.
- 기존 owner의 derived-profile repair도 실제 정상 owner에서는 추가 write 원인이 아님.

**3환경 호환성 감사**
- Run `37149380218`: **SUCCESS**.
- PREVIEW Worker:
  - R2 ordered catalog runtime 포함.
  - `SORIDRAW_R2_CATALOG_V1=1` write/preparation mode 활성.
  - catalog read / first-publisher cutover flag는 아직 비활성.
- TEST / PRODUCTION Worker:
  - 현재 R2 catalog runtime/flag 없음.
  - 기존 shared revision + derived recovery 경로를 계속 사용.
- 세 환경은 같은 canonical D1 / shared profile media를 사용.
- 따라서 지금 shared D1에서 Music Note derived/shared-revision을 바로 끊으면 TEST/PRODUCTION 호환성이 깨질 수 있으므로 **즉시 migration 금지**.

**post-migration hotpath 감사**
- stale audit가 제거된 index `idx_tracks_source_type_latest`를 강제해 실패한 진단은 audit-script 문제였고 제품 실패가 아님.
- 수정 후 Run `37149635235`: **SUCCESS**.
- current Music Note rows 68, non-empty legacy_global_id 0.
- current query-plan:
  - owner/source = `idx_tracks_owner_source`
  - profile fallback = `idx_tracks_owner_latest` + bounded temp sort
  - title fallback = `idx_tracks_latest_order`
  - genre = `idx_tracks_primary_genre_latest`.

**격리 diagnostic W2 모델**
- PREVIEW 전용 RATE_DB `soridraw-explore-preview-db`에 `w2p336_*` 임시 객체만 만들어 측정.
- shared canonical D1 `soridraw-explore-db`와 다른 DB ID임을 hard guard로 확인.
- 최종 Run `37150337923`: **SUCCESS**.
- 측정:
  - first publication: **W12 → W2**
  - actual source-media swap: **W3 → W1**
  - visibility change: **W2 → W1**
- 후보 구조:
  - cutover 이후 새 Music Note row를 legacy secondary indexes에서 제외.
  - cutover 이후 새 Music Note row는 legacy `explore_derived_tracks` mirror에서 제외.
  - cutover 이후 Music Note mutation은 legacy global shared-revision trigger에서 제외.
  - canonical `tracks` row/PK는 유지.
  - 기존 legacy Music Note rows는 그대로 두며 row rewrite/backfill/delete 없음.
- 진단 종료 시 임시 객체 cleanup.
- `SHARED_USER_DATA_WRITES=0`, `USER_DATA_MIGRATION=0`.

**판정**
- W1~W2가 물리적으로 불가능한 문제가 아님. **새 구조에서는 first publication W2 / source swap W1까지 가능함을 격리 D1에서 증명**.
- 그러나 live 적용 선행조건은 PREVIEW/TEST/PRODUCTION 모두가 **R2 catalog + legacy derived hybrid read**를 이해하는 것.
- 기존 사용자 row를 backfill/rewrite하지 않고, legacy row는 그대로 읽고 cutover 이후 row는 R2 catalog를 우선 읽는 방식으로 전환해야 함.

**다음 구현 — app336**
1. Worker에 R2 catalog + legacy-derived **hybrid read path** 추가.
2. 같은 track이 양쪽에 있으면 R2 catalog/card를 최신 authority로 우선.
3. catalog에 없는 기존 legacy row는 현재 derived/D1 recovery로 계속 읽음.
4. first page / deep page / public profile / title·genre·artist search 모두 결과 누락/중복 없음 verifier 추가.
5. app336 단계에서는 shared D1 schema/trigger/index migration **금지**.
6. read path가 3환경 승격 가능한 수준으로 검증된 뒤에만 별도 cutover migration을 설계하고 사용자 승인 요청.
7. 기존 app164/160 likes, app302 save heart, app301 folders, app303 Split, Music Note 60초/local-first, app331~335 publication UI/media 보호.

## 0OI. PREVIEW app335 배포 완료 — warm entry/reload Worker-zero 후보 + 공개 비용 실측 정정 (2026-10-04 KST)

**사용자 실기기 app334 결과 재판독**
- Explore/프로필 새로고침: D1 rows는 R0/W0이지만 Worker가 시간기반 revision 확인으로 누적되어 FAIL.
- 공개 비용:
  - 단순 public→private: billable **R5/W2**, Firestore W0 = PASS.
  - 동일 source private→public: app334 visibility-only 경로로 W2 보호.
  - 영상 후반 **사용자가 실제 두 번째 Suno 카드를 선택한 source swap**: billable **R11/W3**, Firestore W0 = HARD FAIL.
- 따라서 후반 W3는 같은-source 오분기가 아니라 **실제 source-media 변경의 현재 D1 fanout**이다.

**app335 변경**
- Explore Feed:
  - cached entry/reload에서 나이(age)만으로 `/v1/feed-revision`을 부르지 않음.
  - focus/pageshow/일반 pointer click은 revision Worker trigger가 아님.
  - 일반 Feed revision은 실제 hidden→visible tab resume 또는 기존 targeted mutation signal에만 묶음.
- SORIDRAW 추천:
  - healthy curated local cache는 route entry/reload에서 그대로 사용.
  - `curated-revision` 시간만료 Worker 확인을 entry에서 제거.
- Explore 관리권한 UI hint:
  - UID + local role signature cache가 일치하면 시간만료만으로 `explore-management-access`를 재호출하지 않음.
  - 실제 관리 mutation의 서버 authorization은 그대로 유지.
- 공개 프로필:
  - warm profile route entry/reload는 persistent first-view를 즉시 사용하고 Worker 0.
  - bounded shared-R2 revalidation은 real tab resume에서만 수행.
- Music Note 공개상태:
  - healthy persistent publication state는 entry/reload에서 Worker 0.
  - bounded publication revision revalidation은 real tab resume에서만 수행.
  - pending outbox / mutation safety path는 유지.
- 좋아요:
  - reload와 같이 발생할 수 있는 focus 이벤트를 private-like revision trigger에서 제거.
  - 기존 RTDB/public-like targeted signal, local-first heart, mutation settlement 보호.
- 일반 클릭/진단 초기화 자체가 Worker 비용을 만들지 않도록 pointer 기반 general revision check 제거.
- UI/레이아웃 변경 없음.

**검증**
- Final Release System Audit Run `37148217453`: **SUCCESS**.
  - audited product source: `ce43f5b835555ba9db8a52973023a61f1f3303cb`.
  - TypeScript PASS.
  - Build PASS.
  - static release verification PASS.
  - app164 like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight read-only PASS.
- PREVIEW App Release Run `37148368369`: **SUCCESS**.
  - deployed release commit: `cb89c9e161597c685917ea0d524c4a7192b7eb9c`.
  - audited source→release commit 차이는 `.deploy/release-system-audit.trigger`, `.deploy/preview-app-release.trigger` 두 배포 메타 파일뿐이며 제품 소스 차이 없음.
  - Firebase PREVIEW Hosting PASS.
  - `preview.soridraw.com` app **335** exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
  - Worker / Functions / Firestore Rules / D1 schema 배포 없음.
  - 사용자 데이터 migration/backfill/delete 없음.
- Live read-only runtime audit Run `37148012532`: SUCCESS.
  - PREVIEW/TEST/PRODUCTION 모두 shared canonical D1 `217ef5b1-5d80-4f7c-afc7-9e07eb05c06b` 및 shared `soridraw-profile-media` 사용 확인.
  - 현재 source swap W3의 D1 원인을 정확히 분해:
    1. canonical `tracks` media UPDATE = W1
    2. `explore032_track_update` media delta → `explore_derived_tracks` = W1
    3. `soridraw_shared_rev_tracks_au_051` → `explore_shared_revision` = W1
    → 합계 W3.
  - TEST/PRODUCTION의 현재 구 Worker도 shared revision/derived 구조를 참조하므로, 둘 중 하나를 검증 없이 제거하면 shared-data 하위호환 위험. 이번 app335에서는 D1 trigger/schema를 추가 변경하지 않음.

**현재 비용 판정**
- 단순 공개↔비공개: W2 목표/기존 실측 PASS 유지.
- 실제 Suno source swap: **W3 HARD FAIL 유지**. 현재 shared TEST/PRODUCTION 하위호환 의존성 때문에 무검증 제거 금지.
- never-published 최초 공개: **R7/W12 HARD FAIL 유지** (이전 W18→W12).
- warm entry/reload Worker 0: app335 코드/CI PASS, **사용자 실기기 검증 전**.

**실기기 app335 합격선**
1. Explore 정상 캐시 상태 → CACHE LIVE 초기화 → 같은 탭 browser reload:
   - Worker **0**, D1 **R0/W0**, Firestore R0/W0.
2. 공개 프로필 동일 방식:
   - Worker **0**, D1 R0/W0.
3. Music Note 동일 방식:
   - publication revision Worker **0**, D1 R0/W0.
4. CACHE LIVE 초기화 버튼/일반 화면 클릭만으로 Worker가 증가하지 않아야 함.
5. 탭을 실제로 다른 곳에 두었다가 다시 보이면 bounded freshness 확인 Worker는 허용.
6. 동일 source private↔public: W2.
7. 실제 Suno 1↔2 source swap: 현재 W3 known FAIL로 기록, 다음 compatibility 설계 대상.

**릴리스 안전**
- obsolete `preview-033-explore-feed-revision.yml`의 preview auto-deploy job을 비활성화. 옛 preview-only D1/R2 binding으로 우회 배포하지 못하게 함.
- TEST/main 승격 없음.
- PRODUCTION 변경 없음.

## 0OH. PREVIEW app334 배포 완료 — 변경 없는 새로고침 Worker 반복 호출 차단 + 동일 source 재공개 W3 오분기 수정 (2026-10-04 KST)

**사용자 실기기 문제**
- Explore 새로고침, 공개 프로필 새로고침, Music Note 새로고침에서 D1은 R0/W0인데 Cloudflare Worker 요청이 매번 증가.
- 동일 Suno source 그대로 private→public 재공개에서도 source 변경으로 오판되어 D1 billable W3가 발생.
- never-published 첫 공개는 migration 후 W18→W12로 감소했지만 여전히 hard gate FAIL.

**app334 변경**
- Explore Feed:
  - 기존 2분 revision check 시각을 localStorage에 유지하여 browser reload가 check window를 초기화하지 않음.
  - 1분 feed-revision response cache를 reload에서도 그대로 존중; app211의 reload 강제 bypass 제거.
- Explore 개인 좋아요:
  - 기존 5분 `/v1/me/likes-revision` check 시각을 UID별 persistent timestamp로 유지.
  - 실패 30초 retry 의미는 유지.
  - 좋아요 mutation/하트/공개 숫자 authority는 변경 없음.
- 공개 프로필:
  - browser reload라는 이유만으로 60초 `validatedAt` window를 무시하던 app211 forced revalidation 제거.
  - 기존 profile mutation/invalidation 및 정상 background revalidation 유지.
- Music Note 공개상태:
  - `/v1/me/music-note-publications-revision` 검증 시각을 UID별 persistent timestamp로 유지.
  - healthy cached reload는 60초 window 안에서 Worker 재호출하지 않음.
  - pending publication outbox는 기존 safety path 유지.
- Explore 관리권한:
  - `/v1/me/explore-management-access` 결과를 UID + local role signature 기준 5분 durable cache.
  - 서버 authorization 자체는 변경 없음.
- 동일 source 재공개:
  - `selectionChanged`를 background Music Note snapshot 비교가 아니라 **공개 dialog를 연 뒤 사용자가 실제 1↔2 선택을 바꿨는지**로 판정.
  - 같은 source private→public은 visibility-only 경로로 고정 목표 W2.
  - 실제 1↔2 변경 기능은 그대로 유지.

**변경 파일**
- `src/pages/ExplorePage.tsx`
- `src/pages/FavoritesPage.tsx`
- `src/services/exploreRevisionRequestCache.ts`
- `src/services/exploreProfileFirstViewService.ts`
- `src/services/exploreLikeService.ts`
- `src/services/explorePublicationService.ts`
- `src/services/exploreCurationService.ts`
- `scripts/verify-110-explore-liked-public-count.mjs`
- `scripts/verify-127-atomic-personal-like.mjs`
- `scripts/verify-154-cross-account-like-sync.mjs`
- `scripts/verify-203-explore-action-visual-publication.mjs`
- `scripts/verify-211-cross-device-publication-refresh.mjs`
- `public/app-version.json`
- release trigger files.

**검증**
- 최종 Release System Audit Run `37145212030`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static groups / syntax / final guards PASS.
  - release-system verification PASS.
  - app164 like candidate regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 preflight / diagnostics read-only PASS.
- 이전 audit Runs `37144785554`, `37144962795`, `37145090204`는 제품 TypeScript/Build 오류가 아니라 app334 의도 변경을 아직 옛 형태로 검사하던 legacy verifier assertion을 순차 정렬하는 과정에서 FAIL. 최종 verifier와 전체 audit은 PASS.

**PREVIEW 배포**
- Firebase PREVIEW Release Run `37145418195`: **SUCCESS**.
- locked PREVIEW source: `e9fd3d537cf477e393c9cb0a7e038917dc02b6a0`.
- `preview.soridraw.com` app **334**.
- PREVIEW exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker 재배포 없음.
- Functions / Firestore Rules / D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**실기기 검증 전 목표**
- 정상 캐시 + 변경 없음 Explore reload: Worker 0 / D1 R0 W0.
- 정상 캐시 + 변경 없음 공개 프로필 reload: Worker 0 / D1 R0 W0.
- 정상 캐시 + 변경 없음 Music Note reload: publication revision Worker 0 / D1 R0 W0.
- 동일 source registered private→public: D1 billable W2 / Firestore W0.
- 실제 Suno source 1↔2 변경: 기능 유지. 현재 D1 W3 하위호환 floor는 별도 비용 최적화 대상.
- never-published first publication: 현재 실측 W12 HARD FAIL 유지. 이번 app334 client pass에서는 schema/trigger 추가 변경 안 함.

**주의**
- app334로 처음 진입한 직후에는 각 persistent validation timestamp를 처음 seed하기 위한 기존 bounded Worker validation이 1회 있을 수 있음.
- 그 뒤 freshness window 안의 단순 reload가 Worker를 다시 증가시키지 않는지가 이번 실기기 핵심 합격선.
- Worker 0을 위해 PC↔모바일 동기화/좋아요/공개상태 freshness 기능을 제거하지 않음.

## 0OG. Refresh Worker fanout confirmed across Explore / public profile / Music Note (2026-10-04 KST)

**사용자 실기기 영상**
- Explore 새로고침/재진입:
  - D1 rows는 R0/W0 유지.
  - 그러나 Worker 요청이 누적됨.
  - CACHE LIVE에서 반복 확인된 주요 경로:
    - `/v1/me/explore-management-access`
    - `/v1/me/likes-revision`
    - feed/public-profile revision 계열 conditional 요청.
- 공개 프로필:
  - warm cache가 있어도 browser reload에서 conditional profile validation Worker 1회가 발생.
  - 현재 코드 `src/services/exploreProfileFirstViewService.ts`의 app211 계약이 reload이면 60초 window 안에서도 강제 revalidation하도록 되어 있음.
- Music Note 새로고침:
  - `/v1/me/music-note-publications-revision`이 reload마다 다시 Worker를 호출.
  - 사용자 영상에서 Worker 1 → refresh 후 Worker 2, D1 R0/W0.
  - 원인: `publicationServerValidatedUids`가 메모리 Set이라 브라우저 reload 때 초기화되고, persistent cache가 있어도 다시 revision route를 호출.

**판정**
- 현재 구조는 D1 read/write 0 최적화에는 성공했지만 **브라우저 새로고침을 Worker 호출과 분리하지 못함**.
- 데이터 변경 없는 reload가 반복될 때 Worker 요청 수가 사용자 reload 횟수에 비례하므로 SORIDRAW 장기 비용 목표에는 미달.
- 이 문제는 D1 rows 비용과 별도인 Cloudflare Worker 요청 비용 문제로 기록.
- 다만 cross-device freshness를 잃기 위해 revision 검사를 무조건 삭제하는 수정은 금지. refresh 자체가 아니라 실제 sync cadence / change signal에 묶어야 함.

**수정 방향**
1. Explore management access는 매 reload auth Worker 조회 대신 durable local permission snapshot + 명시 invalidation/TTL 사용.
2. likes revision은 in-memory check timestamp를 reload-persistent timestamp로 바꾸어 반복 reload가 5분 window를 리셋하지 않게 함.
3. Music Note publication revision도 persistent validation timestamp/revision을 사용해 reload가 검증 상태를 잃지 않게 함.
4. public profile의 app211 forced reload revalidation 제거 또는 persistent validation window로 대체.
5. 정상 cached reload 목표: Worker 0 / D1 R0 W0.
6. cross-device 변경 감지는 기존 요구 시간 안에서 유지하며, 페이지 reload 자체를 change-check trigger로 사용하지 않음.

## 0OF. never-published 첫 공개 실기기 비용 W12 — migration 후 감소했지만 HARD FAIL (2026-10-04 KST)

**사용자 실기기 CACHE LIVE**
- 완전히 새로운 Music Note 곡 최초 공개 1회.
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request rows: **R7 / W12**.
- Browser SDK: R0 / W0.
- Firestore: R0 / W0.
- PAGE SYNC: D1 R0 / W0.

**판정**
- migration 전 사용자 실측 W18 대비 **W18 → W12**로 6 rows 감소.
- 하지만 SORIDRAW hard gate는 사용자 action 1회 W1~W2이므로 **W12는 명확한 FAIL**.
- 사전 예상 W10 전후보다도 2 rows 높음. 추정으로 다음 migration을 밀어붙이지 않고 post-migration live Insights/read-only schema audit로 남은 fanout을 정확히 분해해야 함.
- R7은 전체곡 수에 비례한 폭주 수치는 아니지만 first-publication 1회에서 W12가 남아 있으므로 비용 최적화 미완료.

**현재 우선순위**
1. 동일 source private→public false source-refresh W3 버그 수정.
2. first publication W12의 남은 write fanout을 read-only로 분해.
3. canonical tracks insert에 꼭 필요한 index와 TEST/PRODUCTION 호환 derived/revision write를 구분.
4. 기능/검색/하위호환을 깨지 않는 범위에서 두 번째 schema/trigger compaction 후보를 설계.
5. 사용자 row 삭제/backfill/rewrite 없이 진행.

## 0OE. CORRECTION — same-source private→public W3 is FAIL, not ignorable (2026-10-04 KST)

**사용자 영상 재판독**
- 같은 곡/같은 선택 Suno source로 시작.
- 1차 public→private 완료: CACHE LIVE D1 query R0/W1, billable rows **R3/W2**, Firestore W0 → **PASS**.
- 진단 초기화 후 같은 곡을 다시 공개. 영상에서 공개 모달의 선택 source는 이전과 동일했으며 별도 source 변경 없음.
- 2차 private→public 완료: CACHE LIVE D1 query R3/W1, billable rows **R11/W3**, Firestore W0 → **FAIL**.
- 완료 토스트가 `선택한 곡으로 Explore에 다시 공개했습니다.`로 표시되어, 같은 source 재공개가 visibility-only가 아니라 `selectionChanged`/source refresh 분기로 잘못 들어간 정황과 일치.

**판정 정정**
- `행 R11 / W3`는 무시 대상이 아니다. D1 비용 판단에서 billable row read/write가 핵심 계측값이다.
- SORIDRAW hard gate는 사용자 동작 1회 **W1~W2만 PASS**. 같은-source 재공개 W3는 불합격.
- 직전 0OD의 “source-swap W3 PASS” 표현은 최종 비용 합격 의미로 사용하지 않는다. 실제 source swap W3는 하위호환 구조의 현재 관측 floor일 뿐이며 최종 hard gate 기준으로는 여전히 승격 불가.
- 이번 영상의 W3는 실제 source swap도 아니므로 더 명확한 회귀/오분기다.

**다음 수정 범위**
- 정상 public→private W2 경로는 건드리지 않는다.
- registered private→public에서 사용자가 source를 바꾸지 않았으면 반드시 visibility-only 경로로 고정하여 W2 복구.
- app332의 최신 media identity guard가 local-first draft보다 늦은/stale favoritesStore snapshot에 의해 다시 뒤집히는지 우선 확인.
- 실제 source 변경과 동일-source 재공개를 분리한 회귀 테스트 추가.
- 좋아요/저장 하트/폴더/Split/프로필/Music Note 60초 저장은 변경 금지.
- TEST / PRODUCTION 승격 금지.

## 0OD. app333 + shared D1 migration 실기기 source-swap 비용 검증 PASS (2026-10-04 KST)

**사용자 실기기 영상/CACHE LIVE**
- 공개 설정에서 실제 선택 Suno 곡을 변경한 뒤 Explore에 다시 공개.
- Cloudflare: LOCAL 0 / Worker 1.
- D1 query: R3 / W1.
- D1 billable/request total: R11 / **W3**.
- Browser SDK: R0 / W0.
- Firestore: R0 / **W0**.
- PAGE SYNC: D1 R0 / W0.
- 완료 토스트 정상 확인.

**판정**
- app333 목표였던 **실제 source swap = Worker 1회 + 즉시 Firestore favorites W0 + D1 W3**를 실기기에서 확인: **PASS**.
- migration 전 source media UPDATE W4 기준에서 W3으로 감소 확인.
- 현재 W3는 TEST/PRODUCTION 하위호환을 위한 canonical tracks + derived media + shared revision 구조의 안전 floor로 유지.
- 영상 중 요청 완료 전에 CACHE LIVE 초기화를 눌렀으나, 완료 후 W3가 초기화 이후 독립 실행으로 기록되어 source-swap 최종값 판정에는 영향 없음.

**남은 비용 검증**
- registered public→private W2.
- registered private→public W2.
- allow_next_song_apply W2.
- allow_follower_save W2.
- profile_pinned W2.
- never-published first publication W10 전후 목표 exact 실측.

**변경 없음**
- 코드 / Hosting / Worker / Functions / Rules / D1 schema 추가 변경 없음.
- 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.

## 0OC. Shared D1 publication write-fanout compaction applied — user-approved migration (2026-10-04 KST)

**사용자 승인**
- 공유 D1 인덱스/구조 변경 migration을 명확히 승인.
- 목표: 공개/비공개, 공개 source 변경, 공개 설정 옵션, 최초 공개의 D1 rows_written을 가능한 안전 최저선까지 축소.
- 사용자 row 삭제/백필/변환/덮어쓰기 금지 유지.

**사전 read-only 감사**
- Run `37141297366`: **SUCCESS**.
- 현재 Music Note first-publication track UPSERT D1 Insights: 평균 `rows_written=16`.
- source media UPDATE: 평균 `rows_written=4`.
- `profile_pinned` UPDATE: `rows_written=3`.
- `allow_next_song_apply` / `allow_follower_save`: `rows_written=2`.
- public/private visibility: `rows_written=2`.
- owner별 tracks: 최대 **42**, 평균 **22**.
- public profile fallback은 `idx_tracks_owner_latest` + 임시 정렬로 정확히 처리 가능.
- owner + source_type 조회는 이미 `idx_tracks_owner_source` 사용.
- 실제 title fallback 검색은 `idx_tracks_latest_order`를 사용하며 `idx_tracks_title`을 사용하지 않음.
- Music Note 66 rows 중 non-empty `legacy_global_id` = **0**.
- PREVIEW/main/production Worker 모두 제거 대상 index를 `INDEXED BY`로 강제하지 않음.

**적용한 shared D1 변경**
Migration:
- `cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_compaction.sql`
- rollback:
  `cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_rollback.sql`

제거:
- `idx_tracks_owner_suno_url`
- `idx_tracks_source_type_latest`
- `idx_tracks_owner_profile_order`
- `idx_tracks_title`
- full `idx_tracks_legacy_global`

대체:
- `idx_tracks_legacy_global_nonempty`
  - non-empty legacy id에 대해서만 UNIQUE 유지.
  - Music Note의 null legacy id는 더 이상 index row를 만들지 않음.

Music Note derived insert:
- `explore079_music_note_derived_track_insert`는 missing derived profile 복구 기능은 유지.
- obsolete `track_count = track_count + NEW.active` write 제거.
- PREVIEW/TEST/PRODUCTION의 `derivedProfile032`가 이미 canonical `COUNT(*) FROM tracks`를 사용하므로 표시 의미 변경 없음.

**실제 migration 결과**
- Apply Run `37141622358`: **SUCCESS**.
- static migration verifier PASS.
- guarded live read-only preflight PASS.
- migration PASS.
- postflight D1 `PRAGMA quick_check` PASS.
- tracks / explore_derived_tracks / explore_derived_profiles row count 전후 동일 PASS.
- TEST/PRODUCTION query compatibility PASS.
- rollback 실행되지 않음.
- 사용자 데이터 row 삭제 / backfill / rewrite: **0**.
- Worker / Hosting / Functions / Firebase Rules / RTDB Rules 변경 없음.
- 현재 PREVIEW 앱은 계속 **app333**이며, 이번 변경은 shared D1 schema/trigger만 적용됨.

**예상 정상 mutation 비용 — 다음 실기기 검증 대상**
- 동일곡 public↔private: **W2 유지**.
- 다음곡 적용 허용: **W2 유지**.
- 팔로워 곡 저장 허용: **W2 유지**.
- 공개 프로필 고정: **W3 → W2 목표**.
- 실제 Suno source swap: **W4 → W3 목표**.
  - tracks canonical 1 + derived media row 1 + shared revision 1이 하위호환 최소 구조.
- never-published 첫 공개: current Insights W16 기준 **약 W10 목표**.
  - 이전 사용자 실측 W18 기준이면 약 W12 수준 가능.
  - exact 실측 필요.

**현재 하위호환 한계**
- source swap을 W2 이하로 만들려면 media-only `explore_derived_tracks` 갱신 또는 shared revision 중 하나를 제거해야 함.
- 그러나 현재 TEST/PRODUCTION cold recovery가 shared revision + derived row를 사용하므로 지금 제거하면 다른 환경이 오래된 공개 미디어를 볼 수 있음. **현재 안전 floor는 W3**.
- first publication W1~W2는 현재 shared `tracks` + feed/profile recovery index 구조와 동시에 달성 불가.
- W10 아래로 크게 내리려면 TEST/PRODUCTION까지 새 canonical 구조를 읽도록 코드 승격한 뒤 legacy index/derived compatibility layer를 단계적으로 종료해야 함.

## 0OB. PREVIEW app333 배포 완료 — 공개 source 변경 1회 Worker + 즉시 Firestore write 제거 (2026-10-04 KST)

**목표**
- 기존 정상 공개/비공개 W2 경로는 보호.
- 공개된 곡에서 Suno 1↔2 선택 변경 시 app332에서 관측된 `favorites:write 1` + Worker 2회 누적 D1 W6 경로를 축소.
- 공개 설정 3개 옵션의 현재 최소비용 경로를 보호하고, 첫 공개 W18은 호환성/스키마 문제와 분리.

**app333 변경**
- Suno 공개곡 선택 변경 시 더 이상 `updateFavorite(...)`로 Firestore favorites 문서를 즉시 쓰지 않음.
- 선택 변경은 기존 Music Note local-first draft에 합류하며 canonical Firestore 저장은 기존 묶음/page-exit 경로가 담당.
- PC↔모바일 즉시 미디어 미리보기는 기존 bounded RTDB delta를 유지.
- 선택된 Suno media(cover/duration/primary/secondary URL)를 Explore Worker 요청에 직접 포함.
- Worker는 새 app333 요청에서는 media 확인을 위한 Firestore favorites 재읽기를 생략하고, 구버전 요청에만 기존 Firestore fallback을 유지.
- 기등록 source swap과 never-published 첫 공개 모두 선택한 media를 동일 Worker 요청에서 사용하도록 정합화.
- 좋아요 / 저장 하트 / 폴더 / Split / 프로필 / 공개 옵션 UI 변경 없음.

**검증 / 배포**
- 제품/Worker audited source: `be803b450e14c3d356aab905620c2712461566b5`.
- canonical Worker SHA256: `fbcc7a525393078f762965853d2b4cbc92a5b3ede16c314a3e6348a45a69aae3`.
- Release System Audit `37140228404`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - app333 publication cost guards PASS.
  - existing publication / like / profile / cache regressions PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 checks read-only PASS.
- Cloudflare PREVIEW Worker Release `37140381356`: **SUCCESS**.
  - locked source `be803b450e14c3d356aab905620c2712461566b5`.
  - deployed version `0f4e7ac6-2baa-442c-87cc-dbb6e640206b`.
  - TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
  - PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase PREVIEW Release `37140463309`: **SUCCESS**.
  - locked source `8364a888340b33791fa8c1989b260da6c0946b58`.
  - `preview.soridraw.com` app **333**, exact build PASS.
  - shared RTDB Rules SKIPPED.
  - TEST / PRODUCTION unchanged PASS.
- Functions / Firestore Rules / RTDB Rules / D1 schema 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**현재 비용 판정**
- 동일곡 registered public↔private: 실측 D1 billable W2 / Firestore W0 — 현재 하위호환 구조의 합격 경로, 보호.
- 공개 설정에서 값 변경 없음: local/outbox net-zero로 server write 0 유지.
- `다음곡에 적용 허용` / `팔로워 곡 저장 허용`: canonical tracks + 구 TEST/PRODUCTION 호환 shared revision 때문에 D1 W2가 현재 안전 최저선.
- `공개 프로필에 고정`: `profile_pinned`이 `idx_tracks_owner_profile_order`에 포함되어 실측 W3. **hard gate FAIL**이며 코드만으로 W2 이하 보장 불가.
- 실제 Suno source swap: app333은 즉시 Firestore W1과 두 번째 Worker 원인을 제거했지만 D1 media UPDATE 자체는 `idx_tracks_owner_suno_url` 유지비 때문에 기존 Insights 기준 W4 가능. **실기기 재측정 전**.
- never-published 첫 공개: `tracks` 9개 secondary index + trigger/구환경 호환 구조로 실제 W18. **이번 코드 수정으로 D1 W18 자체는 감소하지 않음 / hard gate FAIL**.

**다음 비용 단계 — D1 schema 변경 전 승인 필요**
- `idx_tracks_owner_suno_url (owner_uid, suno_url_primary)`는 현재 PREVIEW/main/production Worker 코드 검색에서 조회 조건으로 사용되는 경로를 찾지 못했으며 source swap W4의 유력한 추가 row-write 원인.
- `idx_tracks_owner_profile_order (owner_uid, profile_pinned, published_at, id)`는 pin W3의 추가 write 원인.
- 두 index의 제거/대체는 비용 절감 가능성이 있으나 shared D1 schema migration이므로 별도 guarded preflight + TEST/PRODUCTION query-plan 호환성 확인 + 사용자 승인 없이 실행 금지.
- first publication W18→W1~W2는 단순 UI/Worker 수정으로 불가능. 기존 TEST/PRODUCTION이 같은 canonical `tracks`를 읽는 동안에는 index/trigger fanout을 유지해야 하므로 하위호환 canonical 구조 재설계가 필요.

## 0OA. PREVIEW app332 배포 완료 — 동일곡 공개/비공개 stale media 판정 차단 (2026-10-04 KST)

**사용자 지시**
- app331 실기기에서 동일곡 공개/비공개인데도 간헐적으로 Firestore `favorites:write 1` + D1 W4가 발생하는 비용 분기만 수정.
- 좋아요 / 저장 하트 / 폴더 / Split / 프로필 / Worker / D1 schema 등 다른 정상 기능은 변경 금지.

**원인 / 수정**
- 공개 설정 dialog가 오래된 Music Note row 객체를 들고 있으면 `mainSunoIndex`가 현재 로컬 최신 선택과 달라져, 실제로 곡을 바꾸지 않아도 `selectionChanged=true`가 될 수 있었음.
- app332는 dialog open과 submit에서 `favoritesStore`의 최신 Music Note snapshot을 우선 사용.
- 선택 변경 판정은 stale 숫자 index 비교가 아니라 **실제 선택 Suno URL vs 최신 main Suno URL** 비교로 변경.
- 같은 URL이면 source-media refresh를 타지 않고 기존 visibility-only 공개/비공개 경로 유지.
- 실제 다른 Suno URL을 선택한 경우에만 기존 `updateFavorite + refreshExploreMusicNotePublicationSource` 경로 유지.
- backend / Worker / D1 trigger / schema / Firestore 구조 변경 없음.

**변경 파일**
- `src/pages/FavoritesPage.tsx`
- `scripts/verify-203-explore-action-visual-publication.mjs`
- `public/app-version.json`
- release trigger files only.

**기준 / 검증 / 배포**
- 제품 수정 commit: `7085b03c3013c60fdbebb441901832e5ba2b1255`.
- verifier commit: `3d9da23bef8bc20288788d3e42c5f81ea056207c`.
- audited app332 source: `083d4310059ee27cb225ddf1578340ec3219278a`.
- Release System Audit Run `37138323981`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static groups / release verification PASS.
  - existing like regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 checks read-only PASS.
- Firebase PREVIEW Release Run `37138464737`: **SUCCESS**.
  - PREVIEW Hosting PASS.
  - exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules release not requested.
- PREVIEW app version: **332**.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration / backfill / delete 없음.

**실사용 합격선**
1. 같은 Suno 곡 그대로 private→public: Firestore W0, D1 W1~W2.
2. 같은 Suno 곡 그대로 public→private: Firestore W0, D1 W1~W2.
3. 위 동작 반복에서도 `favorites:write 1`이 나타나면 FAIL.
4. 실제 다른 Suno 곡으로 변경: 기존 source-media swap 경로 유지. 현재 W4는 별도 비용 최적화 대상이며 이번 수정 범위 아님.
5. never-published 첫 공개 W18도 별도 문제로 이번 수정에서 건드리지 않음.

## 0NZ. app331 실기기 공개 비용 분기 확인 — W2/W4가 랜덤이 아님 (2026-10-04 KST)

**사용자 실기기 CACHE LIVE 결과**
- 비공개 전환: Cloudflare D1 query `R3 / W1`, billable row `R3 / W2`, Browser SDK `R0 / W0`.
- 공개 실행 중 Firestore `favorites:write 1`이 동반된 케이스: D1 billable row `R11 / W4`.
- 공개 상태에서 다른 Suno 곡으로 전환: Firestore `favorites:write 1` + D1 billable row `R11 / W4`.
- 같은 공개/비공개 동작 중 media/main 선택 변경이 없는 저비용 케이스: Browser SDK `R0 / W0`, D1 billable row `R5 / W2`.

**코드 대조 결과**
- app331 `FavoritesPage.tsx`는 `selectionChanged`일 때 먼저 `updateFavorite(...)`로 Music Note 메인 Suno 선택을 Firestore에 기록한 뒤 `refreshExploreMusicNotePublicationSource(...)`를 호출한다.
- 이 경로가 실기기에서 `favorites:write 1` + D1 `W4`와 정확히 일치한다.
- 선택곡 변경이 없는 기등록 private→public / public→private는 `setExploreTrackVisibility(...)`의 좁은 visibility 경로를 사용하며 W2 실측과 일치한다.
- 따라서 W2/W4 차이는 무작위 변동이 아니라 **source-media 선택 변경 여부에 따른 서로 다른 mutation 경로**다.
- 단, 사용자가 실제로 곡을 바꾸지 않았는데도 `favorites:write 1 / W4`가 발생한다면 `selectionChanged`가 stale Music Note row를 보고 잘못 true가 되는 별도 클라이언트 버그로 판정한다.

**현재 판정**
- 기등록 곡의 순수 공개/비공개 W2: PASS.
- 실제 다른 Suno 곡 source-media swap W4: hard gate FAIL.
- never-published 첫 공개 W18: 기존과 동일하게 FAIL.
- 다음 비용 수정은 UI가 아니라 W4 media swap과 W18 first-publication write/index fanout을 분리해 줄여야 한다.
- 좋아요 app164/160, 저장 하트 app302, 폴더 app301, Split app303, 프로필 정상 경로는 변경 금지.

## 0NY. app330 실기기 공개 비용 재진단 — 첫 공개 W18 원인 고정 (2026-10-04 KST)

**사용자 실기기**
- 사용자가 비공개 Music Note에서 `공개`를 누른 실제 영상 기준, 기존 app329 UI는 서버 완료까지 공개 모달이 약 16~18초 동안 busy 상태로 남았음.
- 같은 실행의 CACHE LIVE: D1 query `R3 / W1`, billable row `R8 / W18`.
- app330은 이 대기 UX를 서버 처리와 분리해 공개 클릭 즉시 로컬 공개 상태 반영 + 모달 닫힘으로 수정/배포 완료.

**W18 read-only 실DB 진단**
- Read-only shared D1 schema inspection Run `37135568537`: SUCCESS, `REMOTE_D1_WRITES=0`.
- Read-only D1 Insights Run `37135908156`: SUCCESS, `REMOTE_D1_INSIGHTS_READONLY=PASS`.
- 현재 `tracks`에는 secondary index 9개가 존재하며, D1 `rows_written`은 table row뿐 아니라 index row 유지비까지 포함한다.
- 지난 1일 actual D1 Insights:
  - 첫 공개/full publication UPSERT: **avgRowsWritten 16** (`numberOfTimesRun=10`, total 162).
  - app329 media-only source refresh: **avgRowsWritten 4** (1회 측정).
  - 등록된 Music Note 공개/비공개 visibility narrow UPDATE: **avgRowsWritten 2** (1회 측정).
- 즉 CACHE LIVE의 W18은 “W1 쿼리 하나가 공짜에 가까운 1행”이라는 뜻이 아니라, 첫 공개 full UPSERT + index/trigger fanout이 실제 row-write 비용을 만든 결과다.
- app329 media trigger 최적화는 동작하고 있으나, 첫 공개 full canonical registration 비용에는 적용되지 않는다.

**판정**
- 공개/비공개 **기등록 곡 visibility 전환 W2는 합격선**.
- media-only source swap **W4는 W1~W2 hard gate 미달**.
- 첫 공개 **W18은 불합격**.
- 첫 공개를 현재 `tracks` + 기존 검색/소유자/feed용 index 구조 그대로 유지하면서 W1~W2라고 보고해서는 안 됨.
- 다음 비용 작업은 UI나 계측값을 숨기는 수정이 아니라, first-publication canonical write/index 구조를 하위호환 방식으로 재설계해야 함. TEST/PRODUCTION 기존 코드가 shared canonical data를 계속 읽을 수 있어야 하므로 무검증 index drop 또는 PREVIEW-only canonical table 전환 금지.

## 0NX. PREVIEW app330 배포 완료 — Music Note 공개/저장 즉시 UI 반응 (2026-10-04 KST)

**현재 기준**
- 작업 branch: `preview`.
- 제품 수정 기준: `7af56bc0398017baccc74d729738df471b4e67c5`.
- app330 버전 기준: `57d6ccfa7f3d65557f03267754d5e4d944ab9a42`.
- Firebase PREVIEW 배포 locked source: `0399644d0cddcc7097abdccb2f639c9234013961`.
- 앱 버전: **330**.
- TEST / PRODUCTION은 비변경.

**사용자 실기기 문제**
- app329에서 공개/설정 저장 버튼을 누른 뒤 서버 반영이 끝날 때까지 팝업이 오래 남아 있어 공개 동작이 느리게 보임.
- 사용자 영상에서는 저장 후 화면 닫힘까지 긴 대기 구간이 확인됨.

**app330 수정**
- Music Note 공개/설정 저장 시 서버 완료를 기다리기 전에 즉시 로컬 공개 상태를 반영하고 팝업을 닫음.
- 기존 Firestore / Explore Worker 반영은 동일한 기존 경로로 뒤에서 계속 수행.
- 서버 반영 실패 시 화면의 공개 상태를 정확한 이전 상태로 되돌리고 기존 오류 안내를 표시.
- 중복 클릭 방지 busy guard는 서버 완료까지 유지.
- 공개곡 Suno 1/2 선택, app329 media-only refresh, 기존 공개 옵션 3개와 비공개 전환은 구조 변경 없음.

**검증 / 배포**
- Release System Audit `37135125184`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 기존 publication / like 등 Release regression PASS.
  - app330 즉시 UI 반응 verifier 추가 및 PASS.
- Firebase PREVIEW Release `37135265146`: **SUCCESS**.
  - `preview.soridraw.com` app **330**.
  - exact build PASS.
  - shared RTDB Rules **SKIPPED**.
  - TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.

**비용 / 데이터**
- 이 수정은 UI 반응 순서만 바꾼 것으로 기존 공개 서버 호출 수와 D1 mutation 경로를 늘리지 않음.
- 사용자 데이터 migration / backfill / delete 없음.
- app329의 실제 source-media swap D1 W1~W2 hard gate는 그대로 유지하며, 실기기 비용 재측정은 아직 필요.

**실사용 확인 필요**
1. 공개 또는 공개 설정 저장을 누르는 즉시 팝업이 닫히고 공개 상태가 바로 보이는지.
2. Suno 1/2 선택 변경 후에도 즉시 닫히는지.
3. 서버 반영 후 같은 곡의 실제 공개 미디어가 정확한 선택곡인지.
4. 실패 상황에서 거짓 공개 상태가 남지 않고 이전 상태로 복구되는지.
5. CACHE LIVE에서 실제 source swap 1회 D1 `rows_written` W1~W2인지.
6. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 회귀 없음.

## 0NW. PREVIEW app329 배포 완료 — Explore 공개 설정 수노곡 선택 + 선택곡 미디어 저비용 갱신 (2026-10-04 KST)

**현재 기준**
- 작업 branch: `preview`.
- 앱 PREVIEW 배포 기준: `fa54c6d37ba002654998ac05af72c6e4d781d3f5`.
- Worker 감사/배포 기준 source: `1e6b2011e77933db3b4e44f8b55dffdd00374a12`.
- 앱 버전: **329**.
- TEST / PRODUCTION은 비변경.

**사용자 요청 반영**
- Explore에서 본인 공개곡의 `공개 설정`을 열었을 때, 원본 Music Note에 Suno URL 2곡이 있으면 두 곡을 좌/우 카드로 표시.
- 1번/2번 중 실제 공개에 사용할 곡을 선택 가능.
- 카드 선택만 바꿀 때는 로컬 UI만 변경하고 서버 요청 없음.
- 이미 공개된 동일 track에서 선택곡을 바꾸고 저장하면 새 공개곡을 복제하지 않고 **기존 동일 공개 track의 미디어 원본만 갱신**.
- 기존 공개 옵션 3개 / 비공개 전환 / 좋아요 / 폴더 / Split / 프로필 UI는 보호.

**검증**
- 최종 Release System Audit `37133838966`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Static release verification PASS.
  - 기존 Like regression PASS.
  - TEST / PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- canonical PREVIEW Worker hash: `81609d11c7de425cbb496b964a0f2e5e43673a3019d9be6d94d64c56fe130730`.

**공유 D1 안전 변경**
- app329 전용 trigger migration: `20261004_01_publication_media_source_cost.sql`.
- Guarded D1 migration Run `37133356419`: **SUCCESS**.
  - 기존 app080 trigger 상태에서 app329 trigger로 정상 승격.
  - canonical `tracks` 사용자 행 변경 없음.
  - `explore_derived_tracks` 기존 행 변경 없음.
  - `USER_ROW_MUTATION=0`.
  - shared revision trigger 비변경.
  - PREVIEW / TEST / PRODUCTION Worker 버전은 migration 중 비변경.
  - main / production refs 비변경.
- 작업 완료 후 일회성 migration workflow/trigger 파일은 제거함.

**Cloudflare PREVIEW Worker**
- PREVIEW Worker Release `37133979250`: **SUCCESS**.
- locked source: `1e6b2011e77933db3b4e44f8b55dffdd00374a12`.
- deployed Worker version: `c0ff8eeb-5d61-4496-9806-714b2037fb99`.
- publication / like / cache regression 및 one-shot preflight PASS.
- TEST / PRODUCTION Workers unchanged PASS.
- Functions 변경 없음.

**Firebase PREVIEW**
- Firebase PREVIEW App Release `37134047300`: **SUCCESS**.
- locked source: `fa54c6d37ba002654998ac05af72c6e4d781d3f5`.
- `preview.soridraw.com` app **329**, exact build PASS.
- shared RTDB Rules: **SKIPPED**.
- Firestore Rules / RTDB Rules / Functions 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**비용 구조**
- 2곡 카드 표시/선택 자체: 추가 서버 read/write 없음.
- 실제 선택곡 변경 저장 시 전체 Feed/공개프로필 scan/rebuild 없이 해당 Music Note/해당 공개 track만 처리하는 bounded O(1) 경로.
- Worker는 `refreshSourceMedia`에서 해당 Music Note 원본을 정확히 읽고 cover/duration/Suno URL 필드만 좁게 갱신.
- D1 trigger는 media-only 변경이면 해당 `explore_derived_tracks` 1행의 `row_json`만 patch하고, 넓은 콘텐츠 변경일 때만 기존 호환 full upsert 경로를 유지.
- **실제 사용자 선택 변경 1회의 live D1 `rows_written` W1~W2는 아직 실사용 측정 전. 미검증 상태이며 hard gate 유지.**

**사용자 데이터 변경**
- migration/backfill/delete 없음.
- trigger DDL만 변경.
- trigger 변경 당시 canonical / derived 사용자 행 변경 0 확인.

**실사용 확인 필요**
1. Explore에서 본인 공개곡 → 공개 설정 → Suno 2곡 카드가 정확히 표시되는지.
2. 1번/2번 선택 표시 및 미리보기 정보가 맞는지.
3. 이미 공개된 곡에서 다른 Suno 곡 선택 후 저장 → 동일 공개 track의 커버/재생 URL/길이가 새 선택곡으로 갱신되는지.
4. 기존 공개 옵션 3개와 비공개 전환 회귀 없음.
5. 좋아요 / 저장 하트 / 폴더 / Split / 프로필 정상.
6. PC / 모바일 팝업 잘림·겹침 없음.
7. 실제 source swap 1회 D1 `rows_written` W1~W2 확인.

## 0NV. PREVIEW app328 배포 완료 — 공개할 수노 곡 선택 + 디테일 지구본 아이콘 (2026-10-03 KST)

**사용자 요청 반영**
- Music Note에 수노 URL 2곡이 연결된 경우, Explore `공개 설정` 팝업 상단에 두 곡을 **좌/우 카드로 표시**.
- 두 카드 중 실제 공개할 곡을 먼저 선택한 뒤 공개/설정 저장 가능.
- 선택만 바꿀 때는 로컬 UI만 변경하며 서버 요청 없음.
- 공개 실행 시 선택한 곡이 기존 Music Note의 메인/1순위 Suno 기준과 일치하도록 `mainSunoIndex` 및 메인 URL/커버/제목/길이 필드를 함께 정합화한 뒤 기존 단일 공개곡 경로로 반영.
- 이미 공개된 곡도 다른 수노 곡을 선택해 저장하면 기존 동일 공개 track을 source-refresh하여 새 선택곡으로 갱신. 별도 공개곡 복제/새 track 생성 없음.
- Music Note Detail에서 삭제 버튼 오른쪽 Explore 공개 버튼의 잠금/해제 아이콘을 **지구본(`Globe2`) 아이콘**으로 교체.
- 기존 공개 옵션 3개, 비공개 전환, 좋아요, 폴더, Split, 프로필 UI는 비변경.

**변경 / 검증 / 배포**
- 제품 구현 commit: `384938dfd40794d4bde1dc94619aa467339eef62`.
- Release System Audit trigger/source: `f7d1de9927be691d844df5949aba4044ad88de80`.
- Final Release System Audit `37106027818`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 기존 Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37106162581`: **SUCCESS**.
  - locked source / release commit: `239d12318d8c980c15b5aa9c80bf3a0b5b4464d9`.
  - `preview.soridraw.com` app **328**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.

**비용**
- 공개 팝업의 2곡 표시/선택은 기존 Music Note 로컬 `sunoLinks`만 사용하므로 선택 UI 자체 추가 DB read/write 없음.
- 선택곡이 기존 1순위와 같으면 기존 공개 비용 경로 그대로.
- 선택곡이 달라 실제 공개하면 Music Note 메인 선택 canonical 변경 W1 + 기존 Explore 단일 publication upsert 경로를 사용.
- D1은 기존 단일 track O(1) 경로를 재사용하며 전체 Feed/프로필 scan/rebuild 추가 없음.
- 실제 선택 변경 후 live D1 `rows_written`은 사용자 실사용 전이라 **미검증**. W1~W2 hard gate는 그대로 유지.

**실사용 확인**
1. 수노 URL 2곡 연결 Music Note에서 공개 설정 → 상단에 두 커버가 좌/우로 보이는지.
2. 1번/2번 곡 선택 표시가 정확히 바뀌는지.
3. 2번 곡 선택 후 공개 → Explore에서 실제 2번 곡이 공개되는지.
4. 이미 공개된 곡에서 다른 곡 선택 후 저장 → 같은 공개곡이 새 선택곡으로 갱신되는지.
5. Detail의 삭제 버튼 오른쪽 아이콘이 지구본인지.
6. PC/모바일 팝업 레이아웃 및 기존 공개 옵션 회귀 없음.
7. live mutation D1 rows_written W1~W2인지.

## 0NU. PREVIEW app327 배포 완료 — 뒤로가기 단독 / 소셜 2배 / 소개 반응형 글자 크기 (2026-10-03 KST)

**적용**
- 프로필 상단 툴바에서 `MY 프로필` 텍스트 제거.
  - 자기/다른 사용자 프로필 모두 뒤로가기 화살표 버튼만 표시.
- 소셜 링크 버튼 확대.
  - PC: 30x30 → **60x60**, 아이콘 16 → **32px**.
  - Mobile: 26x26 → **52x52**, 아이콘 14 → **28px**.
  - 위치는 승인된 대표장르 아래 유지.
- 소개글은 현재 PC 모양을 기준으로 유지하고 화면이 좁아질 때 단계적으로 축소.
  - 1200px 이상: **13px**.
  - 901~1199px: **12px**.
  - 721~900px: **11px**.
  - 481~720px: **10px**.
  - 480px 이하: **9px**.
- 소개 위치는 프로필 사진 아래 왼쪽 열 전용 유지.
- app323 입력 크래시 수정, app322 줄 수 제한 제거, 150자 제한 유지.
- 프로필 저장 API / 미디어 / 좋아요 / 공개·비공개 / 폴더 / Split / 사용자 데이터 비변경.

**검증 / 배포**
- toolbar product: `8306f90beae93d8dbaa4b28a21f4af2c67ccddca`.
- social 2x: `1599647dc67233667abc1cf5664fa5f60dd9932d`.
- responsive bio + historical verifier 정합화: `3ed2451ad4daa01aec0daa49a95bca4477bb5019`, `46e1174cd9c11b859b7ccebed65cf7a5a655054a`.
- app325/app326 중간 Audit은 기존 verifier가 이전 툴바/소셜 크기를 계속 요구해 FAIL했고 제품 TypeScript/Build는 PASS.
- 최종 app327 Release System Audit `37104517413`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Static verification PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37104633865`: **SUCCESS**.
  - locked source / release commit: `86bb1f4b01fe00fd13b33c07391dfcfefd9ab182`.
  - `preview.soridraw.com` app **327**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 상단에 뒤로가기 버튼만 있고 `MY 프로필` 문구가 없는지.
2. 소셜 버튼이 PC/모바일 모두 확실히 커졌는지.
3. PC 소개글 모양은 유지되는지.
4. 화면 축소 시 13→12→11→10→9px로 자연스럽게 줄어 모바일에서도 PC와 비슷한 줄바꿈 밀도를 보이는지.
5. 소개 위치/배경 높이/프로필 저장/입력 크래시 회귀 없음.

## 0NT. PREVIEW app324 배포 완료 — 프로필 공통 높이 / 소개 왼쪽열 / MY 프로필 통일 (2026-10-03 KST)

**사용자 실사용 피드백 반영**
- app323 소개 입력 크래시 수정은 유지.
- 소개글은 더 이상 전체 하단 폭을 사용하지 않음.
  - **프로필 사진 바로 아래 왼쪽 열 내부**에만 배치.
  - 오른쪽 이름/핸들/통계/대표장르/소셜 영역 침범 금지.
  - 줄바꿈은 유지하고 긴 문자열은 왼쪽 열 안에서 줄바꿈.
- 소셜 링크는 사용자가 통과시킨 **대표장르 아래 위치 그대로 유지**.
- 상단 프로필 배경 높이를 자기 프로필뿐 아니라 **다른 사용자 프로필에도 동일 적용**.
  - Tablet 721~1599px: 270px.
  - PC 1600px+: 335px.
  - Mobile: 기존 190px 유지.
- 프로필 상단 툴바 명칭을 자기/타 사용자 구분 없이 **MY 프로필**로 통일.
- 프로필 저장 API / 미디어 업로드 / 좋아요 / 공개·비공개 / 폴더 / Split / 사용자 데이터 구조 비변경.

**변경 / 검증 / 배포**
- 주요 UI commits:
  - page: `60502405d239e14470808eb90a017956c2a5d2bb`.
  - hero CSS: `75c0d12a0c70b46b3d745d3fa6a5d26385d911f2`.
  - bio CSS: `379d7e6b3c680746a70fed60d677c085f75b8d22`.
  - verifier: `c796de08d27484bce0dc2327fa1727e00d9105c3`.
- app324 version commit: `efca071e534a50bac787336279af38ec4179af0d`.
- Final Release System Audit `37103755979`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37103853836`: **SUCCESS**.
  - release commit / locked PREVIEW source: `3dbd9f774c8cef0d39240d4f0a3f7988dc689573`.
  - `preview.soridraw.com` app **324**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 자기/다른 사용자 프로필 모두 같은 상단 배경 높이인지.
2. 상단 툴바가 모두 `MY 프로필`인지.
3. 소개가 프로필 사진 바로 아래 왼쪽 폭에만 존재하고 오른쪽 영역을 침범하지 않는지.
4. 소셜 링크는 대표장르 아래 그대로인지.
5. 소개 입력 크래시 재발 없음 / 줄 수 제한 없음 / 150자 제한 유지.
6. PC/태블릿/모바일 레이아웃 및 기존 이미지 편집/저장 회귀 없음.

## 0NS. PREVIEW app323 배포 완료 — 프로필 소개 입력 크래시 긴급 수정 (2026-10-03 KST)

**문제**
- app322에서 소개 줄 수 제한을 제거하면서 `onChange`의 state updater 내부에서 `event.currentTarget.value`를 읽도록 바뀜.
- React 이벤트 핸들러가 끝난 뒤 updater가 실행될 때 `currentTarget`이 `null`이 되어 `Cannot read properties of null (reading 'value')` 전체 오류 화면 발생.

**수정**
- textarea 값을 이벤트 핸들러 안에서 먼저 일반 문자열 `nextBio`로 캡처한 뒤 state updater에는 문자열만 전달.
- app322의 **줄 수 제한 제거**는 그대로 유지.
- 소개 최대 150자, 입력창 높이/스크롤 방식, 저장 API는 그대로 유지.
- 다른 프로필 기능 / 좋아요 / 공개·비공개 / 폴더 / Split / 서버 구조 비변경.

**검증 / 배포**
- 제품 commit: `2f414d9a55dadcf9778dbaa7765708222b930034`.
- verifier commit: `7b539c25a2dcf7b931d65ff65f6e999739cf5f7d`.
- app323 version: `9c3b89df72b816dede58f4380df1af6fb6108148`.
- Final Release System Audit `37103230539`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression / Worker dry-run / shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37103325505`: **SUCCESS**.
  - locked source / release commit: `4356e3635070a4fb7fe0fc956ea6ef688b5ef634`.
  - `preview.soridraw.com` app323 exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 migration 없음.

**남은 프로필 레이아웃 실사용 수정**
- 소개 위치는 현재 전체 하단 폭을 사용 중 → 사용자가 요구한 **프로필 사진 아래 왼쪽 열 전용 영역**으로 옮겨야 함.
- app313/314 높이 조정이 `is-own-profile-313` 범위라 다른 사용자 공개 프로필에는 미적용 상태 → 사용자 요구에 맞춰 동일 높이 적용 범위 재조정 필요.
- 상단 툴바 명칭은 현재 자기 프로필 `MY 프로필` / 타 사용자 `공개 프로필`로 분기 중이며, 사용자 실사용 피드백상 명칭 통일 요구 확인 필요.

## 0NR. PREVIEW app321 배포 완료 — 프로필 소개 4줄/핸들 경고/상단 배치 정리 (2026-10-03 KST)

**적용**
- 고유 핸들 저장 오류 문구를 짧게 변경:
  - `영문 소문자, 숫자, 밑줄만 사용할 수 있으며 3~24자로 입력해주세요.`
- 핸들 오류 표시를 기존 붉은 안쪽 그림자/양끝 표시 대신 **입력창 전체 실제 빨간 테두리**로 변경.
- app320의 자유 입력 방식은 유지: 입력 중에는 대문자/특수문자/한글 등을 강제로 지우지 않고, 저장 시 기존 유효성 검사를 수행.
- 소개는 최대 150자 유지.
- 기존처럼 5번째 Enter에서 뒤쪽 문장을 잘라내지 않도록 **파괴적 줄 자르기 제거**.
- 편집창의 실제 4줄 높이를 넘기는 입력만 그 입력 동작을 받지 않도록 변경하여, Enter 줄바꿈과 자동 줄바꿈을 같은 4줄 화면 기준으로 처리.
- 공개 프로필 상단 배치를 위쪽 정렬로 변경.
- 프로필 사진/핵심 정보는 상단으로 이동.
- 소개는 프로필 사진 아래쪽에서 시작하는 하단 행으로 이동.
- 소셜 링크는 대표 장르 아래로 이동.
- 배경 이미지 높이/크롭/프로필 저장 API/미디어 업로드 구조는 비변경.

**변경 / 검증 / 배포**
- 제품 + verifier commit: `cbf6e3c7fb8176e3cfc636ce75ceed0809d4225e`.
- app321 version commit: `aaaf1521075de38033e7ba74821cc6ead6136baf`.
- 최초 Audit `37098941263`: FAIL — 제품 TypeScript/Build는 PASS였고, 기존 app317 정적 verifier가 예전 explicit-line/scroll 규칙을 계속 요구해 final static 단계에서 실패.
- verifier 정합화: `db4103039197a54598511d98eeb17dd52a899267`.
- 재감사 trigger: `57f6f839810f5037f32c988e8043e1864ba5cc46`.
- Final Release System Audit `37099055378`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37099154060`: **SUCCESS**.
  - release commit / locked PREVIEW source: `a530a84f4c05f2e8c632fba46d0b0851b632e4e3`.
  - `preview.soridraw.com` app **321**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 잘못된 핸들로 저장 시 새 짧은 문구와 입력창 전체 빨간 테두리 표시.
2. 입력 중 문자를 강제로 제거하지 않는 app320 동작 유지.
3. 소개에서 Enter로 5번째 줄을 시도해도 기존 문장이 사라지지 않는지.
4. Enter 없이 길게 입력해 자동 줄바꿈되는 경우에도 4줄 화면을 넘지 않는지.
5. 저장 후 소개 줄바꿈/호흡이 편집창 의도와 일치하는지.
6. 프로필 사진/이름·핸들·통계·대표장르가 상단으로 올라갔는지.
7. 소개가 프로필 사진 아래 공간, 소셜 링크가 대표장르 아래에 배치되는지.
8. PC/모바일에서 배경/이미지 크롭/저장/좋아요/폴더/Split 회귀 없음.

## 0NR. PREVIEW app320 배포 완료 — 소개 줄바꿈 보존 + 핸들 자유 입력/저장 시 검증 (2026-10-03 KST)

**적용**
- app319에서 프로필 소개의 **엔터 줄바꿈을 공개 프로필에서도 그대로 표시**하도록 수정.
  - 편집창에서 Enter로 나눈 줄은 저장 후 공개 프로필에서도 같은 줄바꿈으로 보임.
  - 긴 한 줄 텍스트는 기존처럼 영역 안에서 자동 줄바꿈.
- app320에서 고유 핸들 입력 중의 강제 필터링을 제거.
  - 대문자/소문자/특수문자/한글 등 다른 언어/길이 초과 문자열도 **입력 자체는 막지 않음**.
  - 입력 중 자동 소문자 변환/문자 삭제 없음.
  - 최대 길이 입력 차단도 제거.
- 핸들 저장 조건은 기존 계약 그대로 유지.
  - 영문 소문자, 숫자, 점(.), 밑줄(_)만 허용.
  - 3~24자.
  - 점(.)은 처음/끝/연속 사용 불가.
- 위 조건에 맞지 않는 상태에서 **저장 버튼을 눌렀을 때만** 입력칸 경고 스타일 + 안내문 노출.
- 올바른 값으로 수정하면 경고는 즉시 해제.
- 대표 장르 최대 5개, 소개 150자/4줄, 프로필 사진/배경 크롭 동작은 그대로 유지.

**변경 / 검증 / 배포**
- 소개 줄바꿈 제품 commit: `d9726e9a416e6635658625abf998e19bcd512276`.
- 소개 줄바꿈 verifier: `fc898f0c2fea5acc313b09dfb1dd60f189268952`.
- app319 audit `37096474003`: **SUCCESS**.
- app319 PREVIEW release `37096558530`: **SUCCESS**, app319 exact build PASS.
- 핸들 자유 입력 제품 commit: `84480f57794ff5dd3b7cbad91310cf317f16939f`.
- app320 verifier: `02019b3de5ffc58796f367f4681acdf4a8cb9754`.
- 최초 app320 audit `37096694758`: FAIL — 제품 코드가 아니라 verifier가 unrelated 기존 문자열을 넓게 잡은 정규식 문제.
- verifier fix: `2a027f6c8e7aef1ae0e5eaf5f1ffef525c19e0e8`.
- 최종 audit trigger: `c9f0de49a4aca1c67aa7356dc05dc8fee42f9fe9`.
- Final Release System Audit `37096804790`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37096905327`: **SUCCESS**.
  - locked source `fa23583413a207c716a13333343c6149622917ce`.
  - `preview.soridraw.com` app **320**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 소개 편집창에서 Enter로 2~4줄 작성 후 저장 → 공개 프로필에서 동일 줄바꿈 표시.
2. 핸들에 대문자, 한글, 특수문자를 입력해도 입력 중 삭제/변환되지 않는지.
3. 24자를 넘겨도 입력 자체는 가능한지.
4. 잘못된 핸들 상태에서 저장할 때만 경고문과 붉은 입력 상태가 보이는지.
5. 올바른 영문 소문자/숫자/점/밑줄 3~24자로 고치면 경고가 사라지고 저장되는지.
6. 대표 장르 5개 / 소개 150자·4줄 / 이미지 편집에 회귀가 없는지.

## 0NQ. PREVIEW app318 배포 완료 — 대표 장르 5개 + 소개 150자/4줄 + 핸들 저장 시 경고 (2026-10-03 KST)

**적용**
- 대표 장르 최대 개수를 **4개 → 5개**로 복원.
- 수동 추가 / 최근 10곡 자동 추천 / 저장 / 변경 비교 모두 최대 5개로 통일.
- 소개 글자 수를 **최대 150자**로 제한.
- 소개는 **최대 4줄**까지만 입력/붙여넣기 허용.
- 소개 입력창은 세로 크기 고정, 사용자가 임의로 늘리지 못하게 유지.
- 고유 핸들 제한은 기존 계약 유지:
  - 영문 소문자, 숫자, 점(.), 밑줄(_).
  - 3~24자.
  - 점(.)은 처음/끝/연속 사용 불가.
- 핸들 경고는 평소에는 노출하지 않고 **저장 버튼을 눌렀을 때 조건에 맞지 않는 경우에만** 입력칸 경고 스타일 + 안내문을 표시.
- 핸들이 올바르게 수정되면 경고는 즉시 해제.
- app316 프로필 사진 초기 줌(avatar 1~2 / 기본 1.5)과 배경 편집(1~3 / 기본 2)은 그대로 유지.

**변경 / 검증 / 배포**
- 대표 장르 5개 + 소개 제한: `abbfc04f493fc38313701679c61e86ec06bb7634`.
- 소개 4줄 UI 고정: `341229ea4ba1a5c88ddd0cf4a7a76cab753f8a5b`.
- app317 verifier: `fda9377fb9cf539508342b81a2d44aeeebb8ab43`.
- app317 Release System Audit `37095789989`: **SUCCESS**.
- 핸들 저장 시 경고: `c179ff83a8f117741a3ee65e9aed8ccdb2e2b8e9`.
- 핸들 경고 스타일: `f98d4c6509293905dc84b957fbdd5a0a391e9935`.
- app318 verifier: `ef5d707320ad27babf9f0ce848196ecb583d87ac`.
- app318 version commit: `b90dcca7586a8597e8129c7ece25eb5d08583ad3`.
- final audit trigger: `8a95b50ddf2654e6ba4cf8aea679c03a68e91a19`.
- Final Release System Audit `37095952402`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37096051261`: **SUCCESS**.
  - locked source `6f2bf80bde951eeea8736bce25fa1f4be612e22d`.
  - `preview.soridraw.com` app **318**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 대표 장르가 최대 5개까지 추가/자동추천/저장되는지.
2. 소개가 150자에서 더 입력되지 않는지.
3. 줄바꿈 기준 4줄을 넘기면 5번째 줄이 들어가지 않는지.
4. 소개 입력창이 4줄 범위에서 고정되어 세로 resize 되지 않는지.
5. 정상 핸들 상태에서는 경고가 보이지 않는지.
6. 잘못된 핸들 상태로 저장을 누르면 해당 입력칸 바로 아래에 경고가 나타나는지.
7. 핸들을 정상 조건으로 고치면 경고가 즉시 사라지는지.
8. app316 프로필 사진/배경 이미지 편집 동작 회귀 없음.

## 0NP. PREVIEW app316 배포 완료 — 프로필 사진 초기 확대 축소 (2026-10-03 KST)

**적용**
- 사용자 실사용 피드백에 따라 **프로필 사진 편집창의 최초 확대 상태만 완화**.
- 프로필 사진(avatar) 확대 범위: **1~2**, 기본값 **1.5**.
- 따라서 최초 진입 시 슬라이더 손잡이는 계속 **중앙 위치**에서 시작하지만, 실제 이미지는 app315의 zoom 2보다 덜 확대되어 보임.
- 배경 이미지 편집은 app315 동작 그대로 유지: 확대 범위 **1~3**, 기본값 **2**.
- 프로필 사진/배경 이미지 모두 드래그 이동, 확대/축소, 초기화, 적용/취소, 저장 경로 비변경.
- 대표 장르 최대 4개 제한도 그대로 유지.

**변경 / 검증 / 배포**
- 제품 commit: `36fb6bb39b1aba3fe40275782e007b5062aa038b`.
- verifier commit: `ba3ffe1992ae7a86cc32a79bb9de942f6063f23f`.
- app316 version commit: `4bd7393a63c031a16160b0667324eef3b2e21210`.
- audit trigger: `1c952a7f393c3372067687f7db7ff071d603874b`.
- Release System Audit `37094788361`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37094882121`: **SUCCESS**.
  - locked source `6399e8516acdfb274579d1e157cf5f7110205c4d`.
  - `preview.soridraw.com` app **316**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 변경 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 이미지가 app315보다 덜 확대되어 보이는지.
2. 프로필 사진 슬라이더 손잡이는 중앙에서 시작하는지.
3. 중앙에서 왼쪽 축소 / 오른쪽 확대 모두 자연스러운지.
4. 초기화 시 프로필 사진은 zoom 1.5 중앙 위치로 복귀하는지.
5. 배경 이미지 편집은 기존 zoom 2 / 1~3 동작 그대로인지.
6. 적용/취소/드래그/저장/대표 장르 4개 기능에 회귀가 없는지.

## 0NO. PREVIEW app315 배포 완료 — 프로필 이미지 기본 줌 중앙 + 대표 장르 4개 제한 (2026-10-03 KST)

**적용**
- 프로필 사진/배경 이미지 편집의 확대·축소 게이지 기본값을 기존 최소값(zoom 1)에서 중앙값 **zoom 2**로 변경.
- 게이지 범위는 기존 **1~3** 그대로 유지하여, 처음 사진을 불러온 직후부터 축소와 확대를 모두 할 수 있음.
- 초기화 버튼도 새 기본값인 zoom 2 + 중앙 위치로 복귀.
- 프로필 편집의 대표 장르 최대 개수를 **5개 → 4개**로 조정.
- 기존 프로필에 5개가 있어도 편집창에서는 최대 4개까지만 유지.
- 수동 추가, 자동 새로고침 결과, 저장/변경 비교 모두 4개 제한으로 통일.
- 이미지 크롭 비율/저장 해상도/드래그 이동/프로필 저장 경로는 변경 없음.

**변경 / 검증 / 배포**
- crop default commit: `db7f0866b0d05403f96799c3b6636aceb8cc4848`.
- genre limit commit: `39e4694fba0cb5884b32d47f7fbf0c9c2bd8d555`.
- verifier commit: `f2240838b209b22778ebe502af78b7d2c90ca4c5`.
- 최초 Audit `37093499122`: FAIL — 제품 코드가 아니라 verifier 정규식 문법 오류. TypeScript 단계에서 verifier 파일 파싱 실패.
- verifier fix: `48ea5579496b04856d1942bedbf9f698015c2bc0`.
- 후보 Audit `37093694247`: **SUCCESS**.
- app315 version commit: `f93a372e8f13c6f8af2f81ed25f126e584bbf177`.
- Final Release System Audit `37093821640`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37093928424`: **SUCCESS**.
  - locked source `118d15bcaac051fe524b7a14a2671abec5177a1b`.
  - `preview.soridraw.com` app **315**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 줌 손잡이가 중앙에서 시작하는지.
2. 배경 이미지 선택 직후 줌 손잡이가 중앙에서 시작하는지.
3. 중앙에서 왼쪽으로 축소, 오른쪽으로 확대 모두 가능한지.
4. 초기화 버튼이 다시 중앙 줌으로 복귀하는지.
5. 대표 장르 카운터가 `0/4 ~ 4/4`인지.
6. 4개 상태에서 추가 버튼 비활성, 자동 추천도 최대 4개인지.
7. 저장 후 공개 프로필에 최대 4개만 표시되는지.

## 0NN. PREVIEW app314 배포 완료 — MY 프로필 배경 높이 335/270px (2026-10-03 KST)

**적용**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): **335px**.
- 태블릿(721~1599px): **270px**.
- 모바일(720px 이하): 기존 **190px 그대로**.
- 다른 사용자 공개 프로필 높이 비변경.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- app314 version commit: `1b8bfab06ae57096e7601b91fe44563527382b0f`.
- final audit trigger: `806ed75a5577068f0cb4e5713a65d76958bb300f`.
- Final Release System Audit `37092786220`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092878119`: **SUCCESS**.
  - locked source `e3005b1f5b6ad43c3cea0b6f9bea1da0e37874e3`.
  - `preview.soridraw.com` app **314**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**사용자 작업 규칙 갱신**
- 앞으로 사용자의 **수정 요청은 PREVIEW 수정 + 검증 + PREVIEW 배포까지 완료**하는 것으로 진행.
- 사용자가 별도로 배포 제외를 지시한 경우만 PREVIEW 배포를 생략.
- TEST 승격은 사용자의 `테스트배포` 요청 시에만.
- PRODUCTION은 별도의 명확한 정식배포 승인 시에만.

## 0NM. PREVIEW app314 후보 — MY 프로필 배경 높이 미세 조정 (2026-10-03 KST)

**변경**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): 315px → **335px**.
- 태블릿(721~1599px): 252px → **270px**.
- 모바일(720px 이하): 기존 190px 그대로.
- 다른 사용자 공개 프로필 높이 그대로.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**commit / 검증**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- audit trigger: `259100d5f303198f52406163c4ef367e8e5cff04`.
- Release System Audit `37092580600`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- 서버/데이터/Worker/Functions/Rules 변경 없음.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app313 유지.
- `public/app-version.json`도 313 유지.
- TEST / PRODUCTION 변경 없음.

## 0NL. PREVIEW app313 배포 완료 — MY 프로필 배경 높이만 확대 (2026-10-03 KST)

**적용 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC(1600px 이상): 기존 210px → 315px(1.5배).
- 태블릿(721~1599px): 기존 210px → 252px(1.2배).
- 모바일(720px 이하): 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- profile scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier fix 포함 최종 후보: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- app313 version commit: `b2ce36f03cea10b7545150b6ef0fb5a5c8a52dac`.
- final audit trigger: `f2b0399bb0b83709eece67956e9ee5fdaff0c912`.
- Final Release System Audit `37092012879`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092136757`: **SUCCESS**.
  - locked source `8def3f847ea8735bfbf14a934b020c6a91f0d180`.
  - `preview.soridraw.com` app **313**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**실사용 확인**
1. PC MY 프로필 배경 높이 315px 체감 확인.
2. 태블릿 MY 프로필 배경 높이 252px 확인.
3. 모바일은 기존 높이/레이아웃 그대로인지 확인.
4. 다른 사용자 공개 프로필 높이 비변경 확인.
5. 높이 외 위치/간격/텍스트/아바타/크롭 회귀 없음.
6. 위 항목은 **실사용 검증 전**.

## 0NK. PREVIEW app313 후보 — MY 프로필 배경 높이만 반응형 확대 (2026-10-03 KST)

**요청 / 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC: 기존 210px 기준 1.5배 → 315px.
- 태블릿: 기존 210px 기준 1.2배 → 252px.
- 모바일: 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/간격/텍스트/아바타/이미지 필터/크롭/레이아웃 변경 없음.

**구현**
- 자기 프로필에만 `is-own-profile-313` scope 추가.
- 721~1599px: min-height 252px.
- 1600px 이상: min-height 315px.
- 720px 이하: 기존 mobile rule 190px 그대로.
- 서버/데이터/캐시/비용 관련 변경 없음.

**commit / 검증**
- scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier commit: `84c9efde7531bfdae98d170b050ee6621ceb9973`.
- 1차 Audit `37091267340`: FAIL — 제품 코드가 아니라 verifier가 CSS 대신 TSX 파일을 검사한 테스트 오류. TypeScript/Build는 PASS.
- verifier fix: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- 재검증 Audit `37091395204`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app312 유지.
- `public/app-version.json`도 app312 유지.
- Worker / Functions / Rules / 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.

## 0NJ. PREVIEW app312 배포 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**기능**
- Explore `최신` 섹션명을 `최신 공개곡`으로 변경.
- 장르별 추천 toolbar와 같은 위치/스타일로 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 기존 latest Feed에서 내가 팔로우한 크리에이터의 곡만 시간 순서 그대로 필터.
- 동일 기기에서 팔로우/해제 시 팔로잉 필터 membership도 즉시 반영.
- 계정 전환 시 이전 계정의 팔로잉 state를 즉시 폐기.

**비용 구조**
- 새 latest/following Feed API 추가 없음.
- `전체 ↔ 팔로잉` 버튼 전환은 기존 `tracks` 배열의 로컬 필터이므로 D1 R0/W0.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 공개곡 수가 늘어도 버튼 전환 때문에 별도 전체 조회/Firestore read/D1 scan 없음.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

**변경 commit**
- following bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI/필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- app312 version: `aa04f734f852f4d253d5c062165a02f9e857d7dc`.
- final audit trigger: `3a3e0cbccf069d9a6b34ed1da1b90c47e3ebe090`.
- PREVIEW release trigger / locked release source: `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.

**검증 / 배포**
- 후보 Audit `37090109213`: SUCCESS.
- 최종 Release System Audit `37090441432`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore feed/layout verifier PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight PASS.
- Firebase PREVIEW Release `37090519862`: **SUCCESS**.
  - locked source `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **312**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker / Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실사용 확인 필요**
1. PC/모바일에서 `최신 공개곡` 제목 및 `전체 / 팔로잉` 버튼 위치가 장르별 추천과 동일한지.
2. `전체`: 기존 최신 공개곡 순서/카드 수/스크롤 동작 그대로인지.
3. `팔로잉`: 팔로우한 크리에이터 곡만 시간 순서대로 노출되는지.
4. 팔로우 0명일 때 빈 상태가 어색하지 않은지.
5. CACHE LIVE에서 warm `전체 ↔ 팔로잉` 전환 D1 R0/W0인지.
6. 다른 정상 Explore 섹션/좋아요/승격/공개·비공개 회귀 없음.
7. 위 실기기 항목은 **실사용 검증 전**.

## 0NI. PREVIEW app312 후보 구현 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**사용자 요청**
- Explore `최신` 제목을 `최신 공개곡`으로 변경.
- 장르별 추천과 같은 위치/스타일의 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 사용자가 팔로우한 크리에이터의 곡만 기존 최신 Feed에서 시간 순서 그대로 필터.

**구현**
- 기존 `tracks` latest Feed를 그대로 재사용. 새 Feed API / D1 목록 쿼리 추가 없음.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 팔로잉 버튼을 처음 눌렀을 때 계정의 기존 follow bundle을 한 번 해석하고 이후 기기 캐시 사용.
- 같은 기기에서 팔로우/해제하면 팔로잉 필터 목록도 즉시 반영.
- 계정 전환 시 이전 계정 팔로잉 목록을 로컬 state에서 즉시 폐기.
- 카드 크기/레일/모바일 3열/인기/추천/장르/좋아요/공개·비공개 경로 변경 없음.

**변경 commit**
- follow bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI / 필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- audit trigger: `1fe077326460208d33a0289786f2988af0d399b0`.

**검증**
- Release System Audit Run `37090109213`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- Explore feed layout verifier PASS.
- Like regression PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- shared D1 read-only preflight PASS.
- 데이터 migration/backfill 없음.
- Worker / Functions / Firebase Rules / Cloudflare 배포 없음.

**배포 상태**
- 이 작업은 **PREVIEW 코드 수정만 완료, 아직 배포 전**.
- `public/app-version.json`은 여전히 **311**.
- 실제 `preview.soridraw.com`도 현재 app311 유지.
- 사용자 명시적 프리뷰배포 요청 전 Firebase Hosting/Worker 배포 금지.

**비용 판단**
- `전체 ↔ 팔로잉` 전환 자체는 기존 latest Feed 배열 필터이므로 D1 R0/W0.
- 팔로잉 목록이 이미 기기에 있으면 추가 서버 읽기 0.
- 팔로잉 목록 캐시가 없는 새 기기/복구 상황에서는 기존 social snapshot R2 경로를 사용하며 별도 D1 following-feed를 만들지 않음.
- 공개곡 전체 수가 늘어도 버튼 전환 때문에 별도 전체 조회가 생기지 않음.

## 0NH. PREVIEW app311 배포 완료 — 승격관리와 SORIDRAW 추천 피드 상태 일치 (2026-10-03 KST)

**사용자 실측 문제**
- 다른 기기에서 승격 변화는 `승격 곡 관리` 화면에는 반영되지만, 일반 SORIDRAW 추천 피드는 이전 목록을 계속 표시.
- 원인은 관리 목록 캐시/state와 공개 추천 피드 캐시/state가 별도로 유지되어, 관리 화면이 최신 R2 snapshot을 받은 뒤에도 일반 피드가 오래된 로컬 목록을 계속 사용하는 것.

**app311 수정**
- 승격관리에서 최신 curated snapshot을 받으면 동일 revision/items를 일반 SORIDRAW 추천 로컬 캐시에도 즉시 반영.
- Explore 화면 state도 함께 갱신하여 승격관리 화면을 닫았을 때 별도 서버 재조회 없이 같은 최신 목록을 바로 표시.
- 추가 D1 read/write 없음. 기존 R2/local-first 구조 재사용.
- app310의 승격관리 최초 D1 R0 구조 유지.
- 승격/해제 mutation 비용 구조 변경 없음.
- Worker / Functions / D1 schema / Rules 변경 없음.

**변경 / 검증 / 배포**
- service commit: `39e6f4c687b366effae5da031cc51356259a68ea`.
- Explore state commit: `73401ebb786be767e771ef4b0fe52ccc2db2473a`.
- verifier commit: `7d134f0ee0b6853fd9e310fa46452dbb937be065`.
- verifier typo fix: `85a7dfe6ba05c0a0308a03ccd4c84e4618f78595`.
- app311 version commit: `b21a677ea8053abf6dc148fbe6536ce7ebb68b22`.
- 최초 Audit `37088680852`: FAIL — 제품 코드가 아니라 verifier 변수명 오타(`page` → `explore`)로 실패, TypeScript/Build는 PASS.
- 재검증 Audit `37088793832`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37088927776`: **SUCCESS**.
  - locked source `580805847292d03ca2120c7e659d8c9e37ba90c6`.
  - `preview.soridraw.com` app **311**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker는 app310 배포본 그대로. Functions/Rules/사용자 데이터 변경 없음.

**실기기 확인**
1. 기기 A에서 곡 승격/해제.
2. 기기 B에서 승격관리 화면을 열어 최신 목록 확인.
3. 기기 B에서 승격관리 화면을 닫고 일반 SORIDRAW 추천 피드로 복귀.
4. 별도 새로고침/추가 D1 read 없이 일반 피드도 동일 목록을 표시해야 함.
5. app310의 승격관리 최초 진입 D1 R0도 계속 유지되어야 함.
6. 완전히 열린 다른 기기의 일반 피드를 실시간 push로 자동 갱신하는 기능은 이번 범위에 포함하지 않음.

## 0NG. PREVIEW app310 배포 완료 — 승격관리 최초 D1 목록읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- app309에서 재진입 반복 읽기는 해결됐지만, 앱 업데이트 후 승격 곡 관리 첫 진입에서 현재 9곡을 표시하는데 D1 rows read가 약 43 발생.
- 원인은 관리 전용 `/v1/manage/curated`가 기존 R2 추천 스냅샷을 재사용하지 않고 D1-backed curated 목록 경로를 다시 호출한 것.

**app310 수정**
- 승격관리 목록을 기존 curated R2 snapshot에서 직접 읽도록 변경.
- 일반 Explore가 사용하는 추천 스냅샷과 같은 R2 원본을 재사용하므로 앱 버전 변경 때문에 관리 목록을 D1에서 다시 구성하지 않음.
- 기존 app309 브라우저 local-first cache는 그대로 유지하여 warm 재진입은 계속 LOCAL/CACHE 우선.
- R2 snapshot 자체가 유실된 예외 복구 시에만 기존 bootstrap 경로가 D1을 사용할 수 있음. 앱 업데이트 자체는 R2를 지우지 않음.
- 승격/해제 mutation은 변경하지 않음:
  - 승격: 기존 R1/W1 계약 유지.
  - 해제: 추가 R0/W1 계약 유지.
- 일반 Explore `/v1/curated`, 좋아요, 공개/비공개, Studio 저장 하트, Music Note/Library 폴더, Split 경로 변경 없음.

**변경 / 검증 / 배포**
- Worker 제품 commit: `5581a4d4954be9d4c6dffe9961a8beb09e2b1e0e`.
- verifier commit: `0ba7fc06938603865a7629ebec5c6ed5734fb212`.
- app310 version commit: `6f679bf89a390783e51729cd4f27986014661393`.
- Release System Audit Run `37087850076`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Cloudflare PREVIEW Worker Release Run `37087979937`: **SUCCESS**.
  - PREVIEW Worker version: `191554c0-f3d2-4731-999f-f57a57a07994`.
  - TEST / PRODUCTION Workers unchanged PASS.
  - D1 schema write/migration/backfill 없음.
- Firebase PREVIEW Release Run `37088038676`: **SUCCESS**.
  - locked source `d8890e22060ee884c7e070463608f1f7576a0f67`.
  - `preview.soridraw.com` app **310**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 비용 확인**
1. app310 업데이트 직후 CACHE LIVE 초기화.
2. 승격 곡 관리 첫 진입.
   - `/v1/manage/curated` D1 R0 / W0 목표.
   - R2/Worker 또는 LOCAL/CACHE 표시는 허용.
3. 나갔다 재진입.
   - D1 R0 / W0 목표.
4. 60초 이후 재진입.
   - revision 확인이 있더라도 D1 R0 / W0 목표.
5. 실제 승격/해제 비용은 기존 계약 그대로.
6. 위 최초 진입 D1 R0 수치는 사용자 실기기 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

## 0NF. PREVIEW app309 배포 완료 — 승격관리 재진입 D1 반복 읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- 승격 곡 관리 페이지 진입 때마다 `/v1/manage/curated`가 D1 R1을 반복해 행읽기가 누적됨.
- 승격 자체 R1/W1, 승격 해제 추가 R0/W1은 이번 수정 대상에서 제외하고 기존 정상 동작 유지.

**app309 수정**
- 승격관리 전용 목록을 계정별 local-first cache로 보존.
- 첫 정상 조회 뒤 60초 이내 재진입은 서버 목록 요청 없이 로컬 캐시 사용.
- 60초 이후에도 기존 `/v1/curated-revision`으로 변경 여부만 확인하며 이 경로는 D1 R0.
- revision이 같으면 기존 관리 목록을 그대로 사용하여 `/v1/manage/curated` D1 재조회 없음.
- 실제 승격/해제처럼 추천 목록이 변경되면 해당 계정의 관리 캐시만 무효화하고 다음 필요 시 목록을 다시 받음.
- 일반 Explore `/v1/curated`, 승격/해제 mutation, 좋아요/공개·비공개/Studio 저장 하트/폴더/Split 경로는 변경하지 않음.

**변경 / 검증 / 배포**
- 제품 commit: `30e2474b1477e4958dd368f3aa7e51ed399467f9`.
- verifier commit: `f01aa545e6f2f1cdb047ca3bc6066bdcc77f0639`.
- app309 version commit: `37cf4ad227c99890053370747bf094b384ff0f6e`.
- 1차 Release System Audit Run `37086609323`: SUCCESS.
- 최종 Release System Audit Run `37086773217`: SUCCESS.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37086923105`: SUCCESS.
  - locked source `2236b051451d6e71884a3ee1be125359124602ae`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **309**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**비용 기대값 / 실기기 확인 필요**
1. app309 최초 승격관리 진입: 관리 캐시가 없으면 기존처럼 D1 R1 가능 — 최초 1회 seed.
2. 변경 없이 바로 나갔다 재진입: `/v1/manage/curated` 추가 호출 없음, D1 R0/W0 목표.
3. 60초 이후 변경 없이 재진입: revision 확인만 수행, D1 R0/W0 목표.
4. 실제 승격/해제 뒤에는 관리 캐시가 무효화되므로 다음 필요 조회에서 D1 R1은 허용.
5. 승격 R1/W1, 해제 추가 R0/W1 기존 계약 유지.
6. 위 비용 숫자는 사용자 CACHE LIVE 실기기 재측정 전까지 **실사용 검증 전**.

## 0NE. PREVIEW app306 배포 완료 — Explore 섹션 순서 조정 + PC 좌우 스크롤 버튼 상시 노출 (2026-10-03 KST)

**사용자 요청**
1. 현재 Explore 기준으로 `최신 / 인기`를 장르별 추천보다 위로 이동.
2. `장르별 추천`을 `좋아할 만한 크리에이터` 아래로 이동.
3. Explore와 MY 프로필의 곡 가로레일 좌/우 버튼을 **PC에서만 항상 노출**.
4. 모바일/태블릿의 기존 버튼 표시/숨김 동작은 그대로 유지.

**최종 Explore 홈 순서**
1. SORIDRAW 추천
2. 최신 — 최대 20곡
3. 인기 — 최대 20곡
4. 좋아할 만한 크리에이터
5. 장르별 추천

**PC 버튼 동작**
- PC 기준 `1600px+`에서 ExploreRecommendationRail 좌/우 버튼을 idle/hover 상태와 무관하게 항상 표시.
- 레일 시작/끝에서 사용할 수 없는 버튼도 위치는 계속 보이되 비활성 표시.
- `<1600px` 태블릿/모바일에는 기존 hover/tap/idle 숨김 로직을 변경하지 않음.
- MY 프로필의 고정곡 가로레일도 같은 공용 rail을 사용하므로 PC에서 양쪽 버튼 상시 노출.
- 카드 크기/간격/가로 스크롤/스냅/좋아요/액션 로직 변경 없음.

**변경 / 검증**
- 제품 commit: `811c15803339effefb05a0a47b0878c6128d5964`.
- Release System Audit source: `465a39e7d12cc92ece5c9f9f4eff44b2d4e10465`.
- Release System Audit Run `37076540406`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37076722003`: **SUCCESS**.
  - locked source `decf246958b596f4345c8012fe680cf4afde8d5b`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **306**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인**
- PC: Explore 모든 가로 레일에서 좌/우 버튼이 항상 보이는지.
- PC: MY 프로필 고정곡 레일에서도 양쪽 버튼이 항상 보이는지.
- 태블릿/모바일: 기존처럼 필요할 때만 버튼이 나타나고 자동으로 숨는지.
- Explore 순서가 `SORIDRAW 추천 → 최신 → 인기 → 좋아할 만한 크리에이터 → 장르별 추천`인지.

## 0ND. PREVIEW app305 배포 완료 — 기존 Explore 추천 3종 복구 + 최신/인기 추가 유지 (2026-10-03 KST)

**사용자 실기기 피드백**
- app304에서 `최신 / 인기`를 추가하면서 기존 `SORIDRAW 추천 / 장르별 추천 / 좋아할 만한 크리에이터`가 사라진 것은 사용자 의도와 다름.
- 정확한 요구는 **기존 기능을 그대로 유지하고 최신/인기를 추가**하는 것.
- app304의 "기존 추천 UI 숨김" 해석은 잘못된 작업으로 판정하고 app305에서 즉시 복구.

**app305 수정**
- 기존 추천 3종을 app303 이전과 같은 로컬 추천 모델로 복구:
  1. `SORIDRAW 추천`
  2. `장르별 추천`
  3. `좋아할 만한 크리에이터`
- 그 아래에 app304에서 추가한:
  4. `최신` 최대 20곡
  5. `인기` 최대 20곡
  을 그대로 유지.
- 기존 `추천 / 최신 / 인기` 페이지 탭은 다시 만들지 않음.
- 상단 `MY 프로필` 버튼과 계정 메뉴의 `MY 프로필` 명칭은 유지.
- 추천 모델은 기존처럼 이미 로드된 latest Feed를 로컬에서 분류하므로 추가 D1 read/write 없음.
- 인기 섹션은 기존 app304의 R2 first-page `limit=40` 계약 + UI 20곡 노출을 그대로 사용.
- 카드 디자인 / 좋아요 / 공개·비공개 / 저장 하트 / Music Note·Library 폴더 / Split history는 변경하지 않음.

**변경 / 검증**
- 제품 수정 commit: `decf7ed1b34aee39256b3ad42d69d29fceefb732`.
- audit source: `5b0fc905da93cc54d22ea61e3fcefe01f9b35c21`.
- Release System Audit Run `37075540135`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static A~D + syntax guards PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37075730053`: **SUCCESS**.
  - locked source `647bfe2b21a2195ac281462b6464da84c10b9364`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **305**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**현재 실기기 확인 포인트**
1. 상단 MY 프로필 아래 기존 `SORIDRAW 추천`이 다시 보이는지.
2. `장르별 추천`과 장르 버튼이 기존처럼 보이고 동작하는지.
3. `좋아할 만한 크리에이터`가 다시 보이는지.
4. 그 아래에 `최신`, `인기`가 추가로 보이는지.
5. PC/모바일 기존 카드·가로 스크롤·화살표·좋아요/액션 회귀 없음.

## 0NC. PREVIEW app304 배포 완료 — Explore 최신/인기 동시 홈 + MY 프로필 명칭 (2026-10-03 KST)

- 사용자 요청대로 Explore의 기존 `추천 / 최신 / 인기` 탭형 페이지 구분을 제거하고, 한 화면에서 **최신 / 인기** 두 가로 레일을 함께 표시.
- 최신: 화면에 최대 20곡.
- 인기: 화면에 최대 20곡.
- 기존 Worker의 R2 first-page 계약이 `limit=40` 고정이므로 서버 계약은 변경하지 않고, latest/popular R2 snapshot 40개를 기존 local-first 캐시에 보관한 뒤 UI에서 각각 20개만 노출.
- canonical D1 Feed 전체조회/새 Worker 경로/새 migration 없음.
- 기존 추천/장르별추천/크리에이터 추천 UI는 이번 홈 화면에서 숨기고 추가 확장은 보류.
- 기존 탭 위치에는 **MY 프로필** 버튼을 배치하여 현재 로그인 사용자의 `/explore?profile={uid}`로 이동.
- 계정 메뉴와 Studio left-rail의 자기 프로필 명칭을 `공개 프로필` → `MY 프로필`로 변경.
- 프로필 상단은 자기 프로필일 때 `MY 프로필`, 다른 사용자의 프로필은 기존 `공개 프로필` 유지.
- 카드 디자인 / 좋아요 mutation / 공개·비공개 / 저장 하트 / app301 폴더 / app303 Split history 동작은 변경하지 않음.

**변경 commit**
- 제품/UI: `fe9b7d7c8b07b98a9e16294852818fc08e25f054`.
- MY 프로필 rail label + verifier 정합화: `ebe7c70cb643150420f21f7cb0409c824b27a557`.
- 최종 audit source: `746e635e8fd8ef3c50938fa38a08177a599b0b24`.
- PREVIEW locked release source: `e2547cf7d3a7bc6e90df052aa474f15e42df6f05`.

**검증 / 배포**
- 첫 audit Run `37074532330`: FAIL.
  - 제품 TypeScript / Build는 PASS.
  - 실패 원인은 UI 명칭/레이아웃 변경 뒤 기존 verifier의 `공개 프로필` 및 예전 Latest/Popular grid 계약 assertion이 남아 있던 것.
  - 제품 런타임 오류가 아니라 verifier 기준 정합화 문제로 확인.
- verifier/left-rail 명칭 정리 후 Release System Audit Run `37074868844`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - static A~D PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch-ref guard PASS.
- Firebase PREVIEW Release Run `37075062146`: **SUCCESS**.
  - Firebase Hosting PASS.
  - remote `preview.soridraw.com`: app **304**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인 포인트**
1. Explore 상단에서 기존 추천/최신/인기 탭이 사라지고 MY 프로필 버튼이 보이는지.
2. 최신 레일 최대 20곡, 인기 레일 최대 20곡이 같은 Explore 홈에 연속 표시되는지.
3. PC/모바일에서 기존 카드 디자인과 액션 위치가 유지되는지.
4. MY 프로필 버튼, 계정 메뉴, Studio left-rail에서 자기 프로필 진입이 정상인지.
5. 자기 프로필 상단은 MY 프로필, 다른 사용자 프로필은 공개 프로필로 보이는지.
6. 좋아요/해제 및 공개/비공개 기존 정상 기능 회귀가 없는지.

## 0NB. PREVIEW app303 배포 완료 — Split 작업화면 브라우저 Back/Forward 복원 (2026-10-03 KST)

- 제품 commit: `cc84fba18b8ccbec6b83b983f6a3a1217046516c`.
- Split의 곡 만들기 / 최근 생성곡 / Music Note / Library 이동을 `/studio?view=...` history에 기록하고 브라우저 Back/Forward 및 마우스 뒤로/앞으로로 복원.
- app303 version JSON 복구 commit: `df1978d56012d73265509165d3ba0d92faea32b7`.
- focused Verify Run `37070391369`: SUCCESS.
- Release System Audit Run `37070574836`: SUCCESS.
- Firebase PREVIEW Release Run `37070784375`: SUCCESS.
- app303 exact build PASS / TEST·PRODUCTION unchanged PASS.
- app302/app302b 저장 하트, app301 폴더, 기존 Split Pure Pane 보호 기준 변경 없음.

## 0NA. app302/app302b 사용자 실기기 정상 확인 + 좋아요/저장하트 스킬 동결 (2026-10-03 KST)

**사용자 확인**
- PREVIEW app302 배포 후 사용자 피드백: **"정상 적용됐어."**
- 따라서 app302/app302b의 사용자-visible Studio 저장 하트 동작을 실기기 정상 기준으로 동결.
- 단 이번 피드백은 화면/동기화 동작 정상 확인이며, 별도 계측하지 않은 Firestore/D1 비용 숫자까지 실측 PASS로 확대 해석하지 않음.

**이번 문서/Skill 업데이트**
- `.agents/skills/local-first-like-sync/SKILL.md`
  - Explore 공개 좋아요와 Studio Recent 저장 하트를 서로 다른 상태기로 명시.
  - app302 30초 final-state + delayed-remote 규칙 추가.
  - app302b pending local layer strip / baseline restore / settlement cleanup을 하드 invariant로 추가.
  - save→unsave net-zero 뒤 optimistic Music Note row가 남지 않아야 하는 회귀 항목 추가.
- `.agents/skills/song-save-edit-sync-cost/SKILL.md`
  - Recent text edit RTDB preview와 Studio save-heart delayed remote를 명확히 분리.
  - generic favorites updater는 pending overlay를 제거한 canonical base를 입력으로 사용하도록 보호 규칙 추가.
  - pending intent 제거 직후 local Music Note layer 정리 규칙 추가.
- `.agents/skills/song-save-edit-sync-cost/references/soridraw-app302-studio-heart-local-first-baseline.md`
  - PREVIEW 실기기 상태를 **USER CONFIRMED NORMAL**로 갱신.
  - app302b 보강까지 현재 동결 기준으로 기록.
- `AGENTS.md`
  - app302/app302b 사용자 정상 확인 기준 및 Explore like / Studio save-heart 구분 라우팅 추가.

**보호 기준**
- runtime correction commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- PREVIEW Release Run: `37066438604` SUCCESS.
- app302 exact build PASS.
- TEST / PRODUCTION 변경 없음.
- 이 작업은 문서/Skill 갱신만 수행. 앱 코드/Backend/사용자 데이터/배포 변경 없음.

## 0MZ. PREVIEW app302 배포 완료 — Recent 저장 하트 local-first 최종 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37066438604`: **SUCCESS**.
- locked PREVIEW source: `bfe9893405ac50a314e1d4b8ab9eeafdedce3136`.
- remote `preview.soridraw.com`: app **302**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**최종 app302 동작**
- Recent 저장/해제를 누른 기기에서는 Music Note가 즉시 로컬 반영.
- 다른 기기에는 30초 전 임시 heart 상태를 보내지 않음.
- 같은 곡 30초 반복 토글은 마지막 상태만 canonical 반영:
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
- canonical 성공 뒤 기존 RTDB save/unsave signal로 다른 기기 반영.
- 서로 다른 곡은 곡별 독립 30초 timer.
- Recent 제목/프롬프트/가사 즉시 cross-device preview는 그대로 유지.

**app302b 배포 전 보강**
- 제품 보강 commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- optimistic pending row가 canonical updater 입력으로 다시 섞여 settlement/net-zero 뒤 남을 수 있는 경로를 차단:
  - canonical updater 전에 pending local layer 제거.
  - baseline favorite가 있던 pending row는 원래 canonical row로 복원.
  - settlement/net-zero에서 pending intent 제거 직후 Music Note local layer도 즉시 정리.
- verifier 보강 commit: `a853ea930434da7be661de1f7ff6ddf4db198fe1`.
- stale `verify-221-explore-feed-layout.mjs` assertion은 현재 legacy shared-note hydration 계약에 맞춰 보정:
  - verifier fix commit `31e02bf55868716f41566e204d20de353f01ccc1`.
- 임시 app302b workflow/script/trigger 제거 완료.

**검증**
- app302b apply Run `37065777855`: focused verifier PASS / TypeScript PASS / Build PASS.
- 최종 Release System Audit Run `37065967160`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - diagnose static A~D + syntax E1~E3 PASS.
  - static release-system verification PASS.
  - app302 like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch refs unchanged PASS.
- PREVIEW Release Run `37066438604`: **SUCCESS**.
- 상태: **PREVIEW 배포 완료 / PC↔모바일 실기기 최종 확인 대기**.

## 0MY. PREVIEW app302 후보 — Recent 저장 하트: 저장한 기기 즉시 / 다른 기기 30초 확정 후 (2026-10-03 KST)

**사용자 확정 동작**
- 최근 생성곡에서 저장/해제를 누른 기기는 **뮤직노트에 즉시 로컬 표시**한다.
- 다른 기기에는 저장 버튼 클릭 순간의 임시 상태를 보내지 않는다.
- 같은 곡에서 30초 안 저장↔저장해제를 여러 번 눌러도 기존 규칙 유지:
  - 마지막 클릭마다 그 곡의 30초 타이머 재시작.
  - 최초 canonical 기준과 최종 상태가 같으면 favorite W0.
  - 최종 상태가 다르면 마지막 클릭 +30초 뒤 favorite W1.
- canonical favorite 저장/해제가 성공한 뒤 기존 RTDB changed-item 신호가 전송되고, 다른 기기는 그때 로컬 캐시를 갱신한다.
- 서로 다른 곡은 기존처럼 곡별 독립 30초 타이머.

**app302 구현**
- `src/App.tsx`
  - Studio heart pending intent를 Music Note 목록 위에 initiating-device-only optimistic layer로 적용.
  - pending save는 즉시 Music Note에 추가, pending unsave는 즉시 제거.
  - pending row는 `__studioHeartPendingLocal` 표시로 catalog canonical-newer 판단에서 제외.
  - reload/navigation 시 durable `studioHeartBatch` pending intent를 다시 overlay.
  - app302 Studio heart initiating path에서 `publishMusicNoteHeartPreviewDelta` 호출 제거.
  - 30초 final-state / net-zero W0 / retry 구조는 그대로 유지.
- 다른 기기 반영은 canonical mutation 성공 뒤 `runV1MutationBoundary`의 기존 정상 save/unsave RTDB signal만 사용.
- Recent 제목/프롬프트/가사 즉시 RTDB preview는 변경 없음.
- Library/Music Note 폴더 app301 기준 변경 없음.

**비용**
- initiating-device 즉시 Music Note 표시: Firestore R0/W0.
- pre-canonical Studio-heart RTDB write: 0.
- final changed song: favorite W1/곡.
- final == baseline: favorite W0.
- receiver: Firestore R0/W0 목표, D1 R0/W0.
- `users.favoriteCount` 기존 UID 30초 derived batch 유지.

**검증**
- 제품 commit: `24447627c2222d5cedc6fe96dcaccbfb26c0593a`.
- app302 apply/verify Run `37064864663`: **SUCCESS**.
  - focused app302 verifier PASS.
  - TypeScript PASS.
  - Build PASS.
- 임시 apply workflow/script/trigger 제거 완료.
- 전용 Skill 갱신 + app302 baseline 추가.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules / 사용자 데이터 migration 변경 없음.
- 상태: **PREVIEW 배포 전 최종 release audit 대기**.

## 0MX. app301 폴더 기준 동결 + 전용 Skill 저장 (2026-10-03 KST)

**최신 사용자 실기기 영상 판정**
- app301 PREVIEW 영상 길이 약 53.23초.
- Library warm 빈 폴더 삭제 2회 구간 최종 Browser SDK: **읽기 0 / 쓰기 2**.
- SDK write source: **`user_playlists:batch = 2`**.
- 영상 안에서는 `users:batch` 즉시 write 없음.
- D1 R0/W0 / Worker 0.
- 따라서 영상이 직접 증명하는 **warm delete R0 + folder당 canonical W1 + users 즉시 W0** 기준은 PASS.
- 단 영상이 60초 trailing settlement 전에 끝나므로, 마지막 `users.syncVersions.playlists W1` 60초 지연 write는 이 영상에서 실측된 것으로 표기하지 않음. 코드/CI 계약으로 유지.

**생성/삭제/이동 재정리**
- Library create는 app301에서도 기존 정상 경로 유지: R0 / 새 playlist W1 / users 즉시 W0 / empty item cache seed / RTDB 즉시.
- Library delete: warm R0 / 실제 items + playlist만 canonical / users revision 60초 UID batch.
- Library reorder: local+RTDB 즉시 / per-drag Firestore 0 / 60초 final-state.
- Music Note create/rename/reorder: aggregate `user_structures` 60초 final-state.
- Music Note delete: 구조 즉시 확정 + 삭제 폴더 소속 곡만 기본 폴더로 이동하여 데이터 일관성 보호.

**Skill**
- 신규: `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`
- 기준: `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`
- `AGENTS.md`에 폴더 작업 전 필수 Skill로 등록.
- app301 폴더 정상 경로를 보호 기준으로 동결.
- 앱 런타임 코드 변경 없음 / 재배포 없음.
- TEST / PRODUCTION 변경 없음.

## 0MW. PREVIEW app301 배포 완료 — Library 폴더 생성/삭제 비용 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37058559063`: **SUCCESS**.
- locked PREVIEW source: `3b1a24a3a28c212c128a171efed7401ac58de0b7`.
- remote `preview.soridraw.com`: app **301**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**이번 결론**
- 사용자 app299 영상은 생성과 삭제를 모두 포함했고 종료 진단 `user_playlists W7 / users W3 / getDocs R3`을 재분해하면:
  - 폴더 생성 4회 = playlist W4 / Firestore R0 / users 즉시 W0.
  - 빈 폴더 삭제 3회 = playlist W3 / users W3 / getDocs R3.
- 따라서 Library folder create는 이미 정상 저비용 경로였고 변경하지 않음.
- app301은 delete만 create/reorder/rename과 같은 compatibility revision 정책으로 통일:
  - warm active delete R0 경로(app300) 유지.
  - 실제 playlist/item canonical delete만 즉시.
  - `users.syncVersions.playlists`는 delete마다 즉시 W1 하지 않고 60초 UID batch.
  - RTDB `playlist-delete` 즉시 동기화는 유지.
- 빈 create/delete 예상:
  - create: R0 / playlist W1 / users 즉시 W0.
  - warm delete: R0 / playlist W1 / users 즉시 W0.
  - 60초 안 여러 create/delete/reorder: users revision 전체 W1 목표.
- 곡이 든 folder delete는 실제 item 문서 삭제 수 + folder 1 write가 정상 canonical cost이며 전체 조회/전체 rewrite는 금지.

**검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- Backend Safety Run `37058078858`: SUCCESS.
- Release Audit Run `37058260455`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- PREVIEW Release Run `37058559063`: SUCCESS / app301 exact build PASS / TEST-PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / create 3회 + delete 3회 CACHE LIVE 및 PC↔모바일 실기기 검증 대기**.

## 0MV. PREVIEW app301 후보 — Library 폴더 생성/삭제 비용 재감사 + delete users revision batch (2026-10-03 KST)

**사용자 app299 영상 전체 재분석 — 생성과 삭제를 분리해서 판정**
- 영상 종료 진단 누적값: `user_playlists:batch W7`, `users:batch W3`, `user_playlists:getDocs R3`.
- 영상 동작과 현재 코드 경로를 대조하면:
  - **폴더 생성 4회** = `user_playlists W4`, Firestore read **R0**, users 즉시 write **W0**.
  - **빈 폴더 삭제 3회** = `user_playlists W3 + users W3 + getDocs R3`.
- 따라서 이전 분석에서 삭제만 강조했지만, 영상에는 생성도 포함되어 있었고 **생성은 이미 정상 저비용 경로**, 삭제가 비용 차이의 원인이었음.

**Music Note와 구조 비교**
- Music Note folder create/rename/reorder는 하나의 `user_structures/{uid}` 구조 문서 final-state를 60초 묶음 저장하므로 여러 folder metadata 변경을 W1로 합칠 수 있음.
- Library는 folder마다 별도 canonical playlist document이므로 살아남는 새 폴더 1개당 playlist W1은 현재 데이터 구조상 정상/최소 O(1).
- Library create는 이미:
  - Firestore read R0.
  - 새 playlist document W1.
  - 새 빈 items cache 즉시 seed.
  - `users.syncVersions.playlists`는 즉시 쓰지 않고 UID-wide 60초 batch.
  - RTDB로 같은 계정 PC↔모바일 즉시 반영.
- 따라서 create의 playlist W1까지 없애려면 canonical folder 생성 자체를 지연시키는 더 큰 구조 변경이 필요하며, 현재 정상 동작/구버전 호환 위험 대비 비용 이득이 작아 **변경하지 않음**.

**app301 수정 — delete를 create/reorder/rename과 같은 revision 정책으로 통일**
- app300의 warm active folder exact item-ID snapshot + pre-commit local cache fence는 그대로 유지.
- folder/item canonical delete는 즉시 수행.
- 삭제 때마다 즉시 붙던 `users/{uid}.syncVersions.playlists W1`을 canonical delete batch에서 제거.
- 대신 기존 `queueLibraryPlaylistRevisionBatch()`에 합류:
  - 마지막 playlist metadata 변경 후 60초에 users revision **W1**.
  - 60초 안 create/delete/reorder가 여러 번이면 users compatibility write는 최종 revision 1회로 합쳐짐.
- `playlist-delete` RTDB signal 수신 자체가 delayed revision을 "이미 Firestore commit 됨"으로 잘못 지우지 않도록 committed-operation 목록에서 delete를 제외.
- 현재 앱의 PC↔모바일 delete 즉시 반영은 기존 RTDB delta 그대로 유지.
- 구버전/legacy compatibility fallback만 최대 60초 뒤 users revision으로 수렴하며, 이는 이미 create/reorder/rename에 사용 중인 동일 정책.
- non-empty folder delete는 실제 item 문서도 지워야 하므로 canonical write는 **item 수 + folder 1**이 정상. 전체 collection 재조회/전체 rewrite는 하지 않음.

**app301 목표**
- 빈 folder create 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- warm 빈 folder delete 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- create/delete 여러 번을 60초 안 수행: playlist는 실제 생성/삭제된 folder 각각 W1, users revision은 전체 window **W1** 목표.
- cross-device receiver Firestore R0/W0, D1 R0/W0, Worker 0.

**변경 / 검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier 보정 commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-301-library-folder-create-delete-cost.mjs`
  - `public/app-version.json` → app301
- focused source contract: create R0/W1 + delayed users revision / warm delete R0 path + delayed users revision / RTDB receiver guard **PASS**.
- Backend V2 Step 2-A Safety Run `37058078858`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37058260455`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건만 동일.
  - Library create/delete 변경과 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.
- 상태: **PREVIEW app301 배포 후보 / 배포 후 create+delete CACHE LIVE 실기기 확인 필요**.

## 0MU. PREVIEW app300 배포 완료 — Library warm delete redundant R1 보강 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37055366260`: **SUCCESS**.
- locked PREVIEW source: `0c56140c95de7e24b67bf402fee32efb54c37705`.
- remote `preview.soridraw.com`: app **300**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 사용자 app299 영상에서 확인된 상태:
  - Library reorder 반복 구간은 Firestore R0/W0 → app299 개선 유지.
  - warm empty folder delete마다 `user_playlists:getDocs +1`이 반복되어 delete R0는 FAIL.
- app300은 warm delete를 두 군데 보강:
  - 완료된 active playlist exact item IDs를 playlistId별 snapshot으로 고정하여 빈 폴더도 warm snapshot으로 확실히 구분.
  - canonical delete 전에 local playlist-list cache를 같은 syncVersion으로 먼저 반영하여 users revision 때문에 같은 list를 다시 읽는 race를 차단.
  - commit 실패 시 local playlist metadata를 안전하게 복구.
- Backend Safety Run `37054867155`: SUCCESS.
- Release Audit Run `37055069258`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE warm delete R0 재검증 대기**.

## 0MT. PREVIEW app300 후보 — Library warm delete 실기기 R1 제거 보강 (2026-10-03 KST)

**app299 사용자 영상 판정**
- 영상 초반 약 18초 동안 Library 폴더 reorder를 반복했지만 Firestore SDK write가 **R0/W0 유지** → app299의 즉시 reorder + 60초 canonical 지연은 의도대로 작동.
- 이후 비기본 빈 폴더 삭제 때마다:
  - 1차 삭제: `user_playlists:batch W1 + users:batch W1 + user_playlists:getDocs R1`.
  - 2차 삭제 후 누적: W2/W2/R2.
  - 뒤쪽 추가 삭제 후 누적 read가 R3까지 증가.
- 즉 reorder 비용 회귀는 해결됐지만, **warm active folder delete에서 R1이 아직 반복되어 app298/app299 삭제 R0 목표는 FAIL**.
- 영상에서 기본 폴더는 삭제 전 이미 열어 곡 목록이 보였으므로 단순한 "다음 폴더 최초 cold read"로만 설명할 수 없음.

**app300 최소 보강**
- 삭제 대상 active playlist의 item snapshot을 `playlistId + exact itemIds`로 완료 시점에 별도 ref에 고정.
  - 빈 폴더도 `itemIds=[]`인 **완료된 snapshot**으로 구분.
  - React의 일시적인 `loadingPlaylistItems/playlistItems` 상태 타이밍에 기대지 않음.
- warm delete service는 해당 exact IDs가 전달되면 item `getDocs`를 절대 선행하지 않음.
- canonical delete에서 `users.syncVersions.playlists`가 먼저 관측되어 playlist list cache를 stale로 오판하는 경로를 막기 위해:
  - canonical batch commit 전에 **로컬 list cache만** 같은 syncVersion으로 먼저 삭제 반영.
  - 서버 write/read 추가 없음.
  - canonical commit 실패 시 삭제한 playlist metadata를 최신 local cache와 merge하여 복구; 더 최신 cross-device cache version은 덮어쓰지 않음.
- canonical delete 자체 의미/비용은 그대로:
  - playlist/item 실제 삭제 + `users.syncVersions.playlists` 즉시 compatibility write 유지.
  - RTDB `playlist-delete` 즉시 동기화 유지.
- app299 reorder, create/rename, item 기능, Music Note, UI/CSS는 변경하지 않음.
- cold/stale caller에 item snapshot 자체가 없을 때의 bounded Firestore fallback은 데이터 정확성 보호를 위해 유지.

**변경 / 검증**
- 코드 commit: `837d6ce5d3f3d8d2c45bb0f8a170e6be57a6eab9`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-300-library-delete-no-redundant-read.mjs`
  - `public/app-version.json` → app300
- Backend V2 Step 2-A Safety Run `37054867155`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37055069258`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note assertion 한 건만 동일.
  - app300 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / 배포 후 같은 영상 패턴으로 warm delete R0 재확인 필요**.

## 0MR. PREVIEW app299 배포 완료 — Library reorder 60초 final-state batch (2026-10-02 KST)

- Firebase PREVIEW Release Run `37022415990`: **SUCCESS**.
- locked PREVIEW source: `522420c7d9801e98537b6994979959b94e3dd131`.
- remote `preview.soridraw.com`: app **299**, exact build PASS.
- Release job TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules: **SKIPPED** (rules source 변경 없음).
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app299 핵심:
  - Library My/Shared folder reorder는 local/cache + RTDB로 즉시 반영.
  - 같은 폴더 반복 reorder canonical write는 마지막 변경 후 60초 final-state로 축소.
  - 같은 폴더가 원래 canonical order로 돌아오면 canonical reorder W0 목표.
  - 서로 다른 폴더는 변경된 unique playlist 문서만 settlement.
  - settlement users revision은 batch 전체 W1.
  - 상대 기기에는 `playlist-order-batch`로 canonical revision까지 Firestore read 없이 수렴.
  - 삭제된 폴더의 pending order는 취소.
- app298 delete warm R0 보호 유지:
  - active folder loaded snapshot 삭제 전 재조회 없음.
  - 삭제 후 다음 folder item cache가 정상 존재하면 R0.
  - cache가 실제로 없는 cold/stale next folder는 정확성 보호용 bounded R1 fallback 유지.
- 사전 검증:
  - Backend Safety Run `37021658904` SUCCESS.
  - Release Audit Run `37021945536`: TypeScript/Build/diagnose PASS; overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE + PC↔모바일 실기기 검증 대기**.

## 0MQ. PREVIEW app299 후보 — Library 폴더 순서 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 실기기 비교**
- app298 Library 영상은 같은 폴더 순서 변경 반복에서 Firestore `user_playlists:batch`가 드래그마다 증가했고, Music Note는 같은 조작 구간에서 canonical write를 60초 최종상태로 묶어 큰 차이가 확인됨.
- Library 삭제 연속 테스트에서 보인 `user_playlists:getDocs`는 app298이 제거한 "삭제 직전 같은 active folder 재조회"와 별개로, 삭제 후 자동 선택된 다음 폴더의 item cache가 없는 cold/stale 경우의 bounded load일 수 있음.

**app299 최소 수정**
- Library My/Shared 폴더 reorder는 화면 state + persistent list cache + 기존 RTDB `playlist-order` signal로 즉시 반영.
- canonical `user_playlists/{uid}/lists/{playlistId}.order` 저장은 **마지막 reorder 후 60초** final-state batch로 이동.
- 같은 폴더를 60초 안 여러 번 움직이면 마지막 order만 canonical W1.
- 같은 폴더가 원래 canonical 위치로 돌아오면 pending을 제거하여 reorder canonical W0 목표.
- 서로 다른 폴더를 움직인 경우에는 변경된 unique playlist document만 각각 W1이며, legacy 호환 `users.syncVersions.playlists`는 batch 전체 W1.
- settlement 뒤 `playlist-order-batch` RTDB signal로 상대 기기 cache revision도 올려 Firestore reread를 피함.
- 반대 기기의 더 최신 order signal 또는 folder delete가 오면 오래된 local pending order를 취소.
- folder delete 시 해당 playlist의 pending rename/order도 취소하여 삭제된 문서에 지연 write가 재시도되지 않게 함.
- app298 delete warm path는 그대로 보호: active folder item snapshot이 있으면 삭제 전 `getDocs` R0. 다음 폴더도 정상 item cache가 있으면 R0.
- **cache가 실제로 없는 다음 폴더는 정확성 보호를 위해 최초 bounded R1 fallback을 유지**. 빈 것으로 추정해 R0을 꾸미는 방식은 사용하지 않음.

**변경 / 검증**
- 코드 commit: `114b3095745356f949bac7a323056dd6759ce85b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-299-library-reorder-final-state-batch.mjs`
  - `public/app-version.json` → app299
- Backend V2 Step 2-A Safety Run `37021658904`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37021945536`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app298과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app299 Library reorder 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules source 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / Firebase PREVIEW 배포 후 reorder CACHE LIVE + PC↔모바일 실기기 검증 필요**.

## 0MP. PREVIEW app298 배포 완료 — Library warm 폴더 삭제 사전 read 제거 (2026-10-02 KST)

- Firebase PREVIEW Release Run `37015147954`: **SUCCESS**.
- locked PREVIEW source: `e16183ae37b6c34d509f065afd63b5f3c120a99a`.
- remote `preview.soridraw.com`: app **298**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app298 변경은 Library 활성 폴더 삭제 경로 하나:
  - 이미 로딩 완료된 active playlist의 item IDs를 재사용.
  - 같은 items collection의 중복 `getDocs` 제거.
  - cold/stale 상태에서 item snapshot이 없는 경우 기존 안전 fallback read 유지.
- Backend Safety Run `37014662854`: SUCCESS.
- Release Audit Run `37014825981`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE에서 warm folder delete R0 확인 대기**.

## 0MO. PREVIEW app298 후보 — Library 폴더 삭제 warm R0 (2026-10-02 KST)

**사용자 실기기 발견**
- app297 Library 폴더 삭제에서 정상 쓰기 `user_playlists:batch W1 + users:batch W1` 외에 `user_playlists:getDocs R1`이 추가로 관측됨.
- 사용자는 다른 정상 기능을 건드리지 않고 이 삭제 전 read만 제거해서 PREVIEW 배포하도록 지시.

**원인 / 최소 수정**
- Library 화면은 삭제 대상 활성 playlist의 item 목록을 이미 로컬 cache/state로 보유하고 있는데, `deletePlaylist()`가 서비스 내부의 전역 playlist cache freshness 조건 때문에 같은 items subcollection을 다시 `getDocs()` 할 수 있었음.
- app298은 활성 playlist가 로딩 완료된 경우 화면이 이미 가진 **정확한 item document ID 목록**을 delete service에 전달.
- service는 그 목록이 제공되면 추가 Firestore read 없이 해당 item 문서 + playlist 문서를 기존 batch로 삭제.
- 활성 playlist snapshot이 없거나 아직 로딩 중인 cold/stale 호출은 기존 `getDocs` fallback을 그대로 유지하여 삭제 정확성을 비용 때문에 약화하지 않음.
- UI/CSS, Library create/rename/reorder, Music Note, Recent, heart, Explore, RTDB 구조는 변경하지 않음.

**비용 목표**
- 정상 warm Library folder delete: 사전 Firestore **R0**.
- 쓰기 의미는 그대로: 실제 item delete 개수 + playlist delete W1 + users revision W1.
- 빈 warm folder의 사용자 실측 목표: `user_playlists:getDocs 0`, `user_playlists:batch W1`, `users:batch W1`.
- D1 R0/W0 / Worker 0 유지.

**변경 / 검증**
- 코드 commit: `c0dfac2fa45536692db7eda4ac8602c22067accd`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-298-library-delete-warm-zero-read.mjs`
  - `public/app-version.json` → app298
- Backend V2 Step 2-A Safety Run `37014662854`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37014825981`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app297과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app298 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 전 / Firebase PREVIEW 배포 후 warm folder delete CACHE LIVE 재검증 필요**.

## 0MN. PREVIEW app297 배포 완료 — Library 폴더 reorder 비용/실시간 수정 (2026-10-02 KST)

- Firebase PREVIEW Release Run `36953630146`: **SUCCESS**.
- locked PREVIEW source: `080fa7e98f10c892ec06401c05f824a7b509b61c`.
- remote `preview.soridraw.com`: app **297**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- shared RTDB Rules: **SKIPPED** (rules 변경 없음).
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app297 핵심:
  - Library 마이/공유 폴더 순서 변경 시 전체 폴더 rewrite 제거.
  - 실제 이동한 playlist 문서 하나만 W1.
  - users playlist revision은 기존 60초 UID batch 사용.
  - RTDB `playlist-order` signal로 동일계정 PC↔모바일 즉시 반영.
- app296 사용자 확인:
  - Music Note 폴더 batch에서 마지막 변경 후 60초 `user_structures` W1 추가 확인.
  - 당시 수치는 폴더 삭제까지 포함.
- 남은 실기기 확인:
  - app297 Library reorder 1회가 `user_playlists +1`인지.
  - 상대 기기에 route/refresh 없이 즉시 같은 순서가 보이는지.
  - 60초 내 여러 reorder 후 users revision이 1회로 묶이는지.
  - 영상에서 별도 관측된 Library delete warm-cache miss `getDocs R1`은 reorder PASS 후 별도 확인.
- 상태: **PREVIEW 배포 완료 / Library reorder PC↔모바일 + CACHE LIVE 사용자 재검증 대기**.

## 0MM. PREVIEW app297 후보 — Library 폴더 순서 O(1) 저장 + PC↔모바일 즉시 동기화 (2026-10-02 KST)

**사용자 실기기 발견**
- app296 Music Note 폴더 테스트에서 사용자가 마지막 변경 후 60초에 `user_structures` write 1회가 추가되는 것을 확인. 테스트 숫자는 폴더 삭제까지 포함.
- Library 영상에서는 폴더 순서 변경 1회마다 현재 섹션의 모든 playlist 문서를 다시 쓰고 `users.syncVersions.playlists`까지 즉시 쓰는 비용 회귀가 확인됨.
  - 마이 리스트 6개 기준: 순서 변경 1회당 `user_playlists +6` + `users +1`.
  - 공유 리스트 5개 기준: 순서 변경 1회당 `user_playlists +5` + `users +1`.
- Library 폴더 순서 변경은 RTDB changed-item signal이 없어서 같은 계정 PC↔모바일에 즉시 반영되지 않음.
- 영상 중 Library 폴더 삭제에서는 warm item cache를 사용하지 못한 경우 `user_playlists:getDocs R1`도 관측됨. 삭제 read는 이번 순서변경 수정 범위 밖의 별도 확인 항목으로 남김.

**원인**
- `SunoLibraryPage.tsx`의 기존 `persistPlaylistOrder`가 drag 종료 시 섹션 전체를 1..N으로 다시 번호 매기고 모든 `user_playlists/{uid}/lists/*` 문서를 batch update.
- 같은 batch에서 `users/{uid}.syncVersions.playlists`도 매 drag 즉시 update.
- 순서 변경용 `playlist-order` RTDB operation/receiver가 존재하지 않았음.

**app297 수정**
- 화면 드래그 동작/디자인은 그대로 유지.
- drag 시작 시 기존 canonical order를 snapshot.
- drag 종료 시 화면용 임시 재번호는 제거하고, **실제로 이동한 폴더 하나만** 앞/뒤 이웃 사이의 numeric fractional order로 저장.
- 기존 TEST/PRODUCTION도 numeric `order` 정렬을 그대로 읽을 수 있어 shared data 하위호환 유지.
- 새 `reorderPlaylist` 경로:
  - 이동한 playlist document canonical **W1**.
  - `users.syncVersions.playlists`는 기존 UID 60초 revision batch에 합류하여 반복 drag마다 쓰지 않음.
  - 현재 기기 persistent cache 즉시 patch.
  - RTDB `playlist-order` changed-item signal 즉시 발행.
- 수신 기기:
  - `playlist-order` 하나만 local playlist cache에 patch + sort.
  - Firestore read/write 없이 화면 갱신.
- create/rename/delete/item add/delete/move/color/swap, Music Note, Explore 좋아요, UI/CSS는 변경하지 않음.

**비용 목표**
- 폴더 순서 변경 1회: 기존 `playlist W=N + users W1` → **moved playlist W1**.
- 60초 안 여러 번 reorder: 각 실제 이동당 moved playlist W1, `users` revision은 window 전체 **W1** 목표.
- 수신 기기: Firestore **R0/W0**, D1 **R0/W0**, Worker **0**.
- 같은 폴더를 여러 번 움직이는 canonical order 자체의 60초 final-state collapse는 이번 최소 수정에 포함하지 않음. 먼저 전체폴더 재쓰기와 실시간 동기화 결함을 제거함.

**변경 / 검증**
- 코드 commit: `bc4da91e042a8fbc065971acbd9e4e445f84615b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
- Backend V2 Step 2-A Safety Run `36953291017`: **SUCCESS**.
- Release System Audit Run `36953307140`:
  - TypeScript PASS.
  - Build PASS.
  - 진단 static A~D / syntax E1~E3 PASS.
  - overall FAIL은 기존과 동일한 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 1건.
  - app297 Library reorder 경로와 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW app297 배포 전 후보 / Firebase PREVIEW 배포 후 실기기 재검증 필요**.

## 0ML. PREVIEW app296 — Music Note + Library My/Shared 폴더 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 범위 확정**
- "마이 / 공유"는 Music Note의 마이 노트/공유 노트와 Library의 마이/공유 플레이리스트를 모두 뜻함.
- 공통 원칙: 화면/동일계정 PC↔모바일 반영은 RTDB/local cache로 즉시, canonical Firestore는 안전한 범위에서 **마지막 변경 후 60초 final-state**로 묶음.

**Music Note My/Shared**
- 대상: 폴더 생성 / 이름변경 / 순서변경.
- 변경 즉시:
  - 현재 기기 state + persistent structure cache 반영.
  - 기존 UID-scoped Music Note RTDB structure delta 전송.
  - 반대 기기는 Firestore read 없이 structure patch를 적용.
- canonical:
  - `user_structures/{uid}` 폴더 구조 pending을 UID 단위 localStorage + memory에 보관.
  - 마지막 폴더 구조 변경 후 60초에 My/Shared 최신 구조를 **한 문서 W1**로 저장.
  - 60초 안 같은/다른 My/Shared 폴더 구조 변경이 여러 번 있어도 마지막 구조만 canonical.
  - 기존 `syncMusicNoteStructureVersion` Function은 canonical `user_structures` 변경 때만 실행되므로 반복 UI 변경 횟수만큼 호출되지 않고 batch canonical 횟수로 축소.
- 안전:
  - pending은 RTDB 요청 전에 먼저 durable 저장하여 background/reload 중 canonical intent 유실 방지.
  - RTDB UID monotonic signal version을 받아 local cache/pending version floor로 사용.
  - 실제 곡 membership이 바뀌는 **폴더 삭제는 batch 대상에서 제외하고 즉시 canonical**. 삭제 후 affected favorites의 default 이동도 기존 changed-song-only 경로 유지.
  - 곡을 폴더에 넣기/빼기 역시 실제 favorite membership write이므로 이번 구조 batch와 분리.

**Library My/Shared**
- app295 compatibility revision window를 30초 → **60초**로 통일.
- 일반 탭 숨김/SPA route 이동만으로 조기 flush하지 않음. pending은 durable하게 남고 실제 page unload에서만 best-effort flush.
- 폴더 생성:
  - 새 playlist document W1은 즉시 유지. 새 ID를 즉시 사용하고 TEST/PRODUCTION 구버전과 shared data 호환을 지켜야 하기 때문.
  - `users.syncVersions.playlists`는 60초 UID batch W1.
  - app294 empty-items cache seed 유지 → 생성 직후 items Firestore read R0 목표.
- 폴더 이름변경:
  - 현재 기기 cache + 반대 기기 RTDB `playlist-rename`은 즉시.
  - canonical playlist title은 60초 final-state batch.
  - 같은 폴더를 여러 번 rename하면 마지막 title만 W1.
  - 여러 폴더를 같은 window에서 rename하면 변경된 unique playlist document당 W1 + users revision W1.
  - canonical settlement 뒤 `playlist-rename-batch` RTDB signal로 current app cache version도 같은 revision으로 맞춰 불필요한 Firestore reread를 방지.
  - 더 최신 반대기기 rename/delete signal이 오면 오래된 local pending rename을 취소하여 stale final-state overwrite 방지.
- Library item add/delete/move/color/swap, playlist delete는 실제 membership/데이터 변경이므로 기존 즉시 canonical 경로 유지.
- Library folder reorder는 현재 legacy per-playlist order 문서 구조를 유지. aggregate cutover 전에는 임의로 W1 구조로 바꾸지 않음.

**Library aggregate 구조 판단**
- Music Note처럼 Library 폴더 ID/title/order를 한 aggregate document에 모으는 구조는 가능하고 장기 목표로 유지.
- 하지만 현재 TEST/PRODUCTION 구버전은 `user_playlists/{uid}/lists/*`를 직접 읽으며 사용자 원본 DB를 PREVIEW와 공유함.
- PREVIEW만 aggregate writer를 추가하면 legacy list write + aggregate write가 동시에 필요해 **오히려 비용이 늘어남**.
- 따라서 app296에서는 새 aggregate server write를 만들지 않음.
- 안전한 cutover 순서: 새 코드가 aggregate read/fallback을 지원 → PREVIEW 검증 → TEST/PRODUCTION 동일 코드 승격 → 모든 환경이 새 구조를 읽을 수 있는 시점에 legacy per-folder metadata write 제거.
- 그 cutover 이후 Library 폴더 생성/이름/순서 구조도 Music Note처럼 N회 변경 → aggregate W1 목표가 가능함. 데이터 migration/backfill은 별도 사용자 승인 없이는 실행하지 않음.

**비용 목표**
- Music Note 폴더 구조 7회 연속 변경: Browser canonical `user_structures` **W7 → W1 목표**. Function 후속도 canonical 1회 기준으로 축소.
- Library 동일 폴더 rename 7회: playlist title W1 + users revision W1 = **W2 목표**.
- Library 서로 다른 기존 폴더 5개 rename: playlist W5 + users W1 = **W6 목표**.
- Library 새 폴더 5개 생성: playlist W5 + users revision W1 = **W6 목표**, items read R0.
- private folder test D1 R0/W0 / Worker 0 유지 목표.
- 위 수치는 code-path 목표이며 사용자 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

**변경 / 검증**
- 신규 `src/services/musicNoteFolderStructureBatch.ts`: 60초 durable Music Note structure outbox.
- `src/pages/FavoritesPage.tsx`: Music Note folder local/RTDB-first + canonical 60초 batch, delete immediate safety.
- `src/services/userDomainSyncService.ts`: Music Note structure RTDB monotonic version 반환.
- `src/services/libraryPlaylistRevisionBatch.ts`: 60초 window.
- `src/services/playlistService.ts`: Library rename final-state 60초 durable batch + cross-device stale pending fence.
- `src/pages/SunoLibraryPage.tsx`: 60초 batch resume/pagehide serialized safety.
- app296 verifier: `scripts/verify-296-folder-final-state-batch.mjs`.
- app version: **296**.
- Backend V2 Step 2-A Safety:
  - Run `36950337897` SUCCESS.
  - Run `36950358483` SUCCESS.
- Release System Audit Run `36950546019`:
  - TypeScript PASS.
  - Build PASS.
  - static groups A~D / syntax guards PASS.
  - overall FAIL은 app294/app295와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건. app296 folder batch 경로와 무관.
- focused source inspection: app296 60초 Music Note batch / Library revision 60초 / Library rename final-state / app294 new-folder R0 보호 조건 PASS.
- Worker / Functions source / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- Firebase PREVIEW Release Run `36950877406`: **SUCCESS**.
- locked PREVIEW source: `2c230b9dd0fe47bff31f83412919d335fb98a2ff`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **296**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / 사용자 PC↔모바일 + CACHE LIVE 비용 실측 대기**.

## 0MK. PREVIEW app295 — Library My/Shared 폴더 공통 revision 30초 묶음 저장 (2026-10-02 KST)

**목표**
- 사용자 요청: My / Shared playlist 폴더의 불필요 Firestore write를 기능 손상 없이 가능한 선에서 축소.
- app294의 새 폴더 생성 직후 R0 개선과 기존 changed-item RTDB 즉시 동기화는 그대로 보호.

**app295 구조**
- 폴더 자체 canonical 변경은 지연하지 않음:
  - playlist create: `user_playlists/.../lists/{id}` W1 즉시.
  - playlist rename: 해당 list document W1 즉시.
- 기존 매 create/rename마다 붙던 `users/{uid}.syncVersions.playlists` W1은 UID 단위 **30초 trailing batch**로 분리.
- 같은 UID에서 30초 안 create/rename이 N번이면 목표 canonical write는 기존 `W2 x N` → **folder WN + users revision W1 = W(N+1)**.
  - 1회 작업은 총 W2로 기존과 동일.
  - 2회 연속은 W4 → W3.
  - 5회 연속은 W10 → W6.
- 현재 app PC↔mobile 화면 반영은 기존 RTDB `userSync/{uid}/libraryPlaylist` changed-item signal을 그대로 즉시 사용하므로 30초를 기다리지 않음.
- TEST/PRODUCTION 구버전 호환용 Firestore revision만 묶으며, Library 페이지를 숨기거나 이탈하면 pending revision을 조기 flush해 호환 지연을 줄임.

**안전 장치**
- pending revision은 localStorage + memory fallback에 보관. 일반 reload/navigation으로 의도가 사라지지 않음.
- 현재 세션에서 이미 관측한 RTDB latest syncVersion을 monotonic floor로 재사용하여 정상 batch flush에 추가 RTDB read를 붙이지 않음.
- 세션 재시작 등 floor가 없을 때만 shared RTDB latest signal을 1회 확인. 확인 실패 시 낮은 revision을 쓰지 않고 fail-closed로 pending 유지.
- item add/delete/move/color/order-swap, playlist delete, playlist reorder처럼 기존 users revision을 즉시 쓰는 경로가 더 높은 version을 확정하면 오래된 folder pending batch를 제거하여 중복 delayed write 방지.
- USER_PROFILE_CACHE_EVENT에서 더 높은 remote playlist revision을 받는 경우에도 오래된 local pending을 제거.
- 기존 app294 empty-folder items cache seed 유지: create 직후 Firestore item read R0 목표.
- folder delete / item mutation / playlist reorder canonical write 구조는 이번 범위에서 변경하지 않음.
- 사용자 데이터 migration/backfill/delete 없음. schema 의미 변경 없음.

**변경 파일 / commits**
- 신규 `src/services/libraryPlaylistRevisionBatch.ts`: `bcc346c0aa2499ea06937c230d94e73de13645c8` 이후 안전 보강 `516e9e74b9ae6b0c3e3e13bdd6476b9fc51b19c3`, `e465146bac3651da652269f4a34ade5691ed4fba`.
- `src/services/playlistService.ts`: create/rename users revision batch 분리 + immediate mutation pending retire. 핵심 commits `bde6b4528c3bd9b380685d4a5b50865c011d78a1`, `77aa75f73dc6459af82ca96811270ba42ec2c480`.
- `src/pages/SunoLibraryPage.tsx`: durable batch resume / visibility-pagehide flush / remote newer revision retire. commits `4cd2700b460b4297186f7cb815289d01e6049f3c`, `3c1af755a9cda7cee1ef08e774500bfd7ff4de12`.
- app294 verifier forward-compatible: `d4345c43eadfbf3d336a98aab06e4a47512b656a`.
- app version 295: `fa9dc0d2693bb2bc9a42a5ad04a9b67c5307f746`.
- 신규 focused verifier: `scripts/verify-295-library-folder-revision-batch.mjs`, latest `69902bce0a216341b5872c5eb1d2f724d72731f6`.

**검증 상태**
- Backend V2 Step 2-A Safety Run `36942643704`: SUCCESS (초기 playlistService batching 적용).
- Backend V2 Step 2-A Safety Run `36943137531`: latest playlistService signal-floor 보강 기준 SUCCESS.
- Release System Audit Run `36943212496`: TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 audit는 app294 때와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` assertion 때문에 FAIL; app295 Library 경로와 무관.
- 최종 Release System Audit Run `36943416655`: latest memory fallback 포함 TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 static 단계는 동일한 기존 `verify-221` stale assertion만 반복 FAIL.
- Firebase PREVIEW Release Run `36943574387`: **SUCCESS**.
- locked PREVIEW source: `b3ce248ee41ac075a8713b37d6aaa77755fac028`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **295**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**실기기 비용 확인 목표**
- 새 folder 1회: Firestore R0 목표, 즉시 folder W1 + 30초 후 users revision W1 = 총 W2.
- folder create/rename 5회 연속 후 30초 대기: 기존 W10 대신 목표 **W6**.
- 같은 구간 D1 R0/W0, Worker 0 유지.
- 반대 기기에서는 폴더 생성/이름 변경이 30초 대기 없이 즉시 보이는지 확인.

## 0MJ. PREVIEW app294 — Library 새 폴더 생성 직후 불필요 read 제거 (2026-10-02 KST)

**사용자 실기기 app293 비용 확인**
- 영상 누적 Browser SDK: Firestore read 3 / write 15.
- Cloudflare / Worker / D1: R0/W0.
- Music Note folder rename은 곡 수와 무관하게 structure W1 / favorites W0로 동작 확인.
- Library My/Shared playlist create/rename은 현재 하위호환 canonical 계약대로 W2 유지.
- 남은 read 3은 새 Library playlist 3개 생성 직후, UI가 방금 생성된 빈 폴더를 선택하면서 items cache가 없어 `user_playlists/.../items getDocs`를 각 1회 실행한 경로로 확인.

**app294 수정**
- `src/services/playlistService.ts`의 `createPlaylist()` canonical commit 성공 직후:
  - playlist list cache patch와 함께
  - 새 playlist ID의 items cache를 같은 `syncVersion`의 빈 배열로 즉시 seed.
- 방금 생성된 폴더는 canonical로 빈 폴더임이 이미 확정돼 있으므로, 선택 직후 `SunoLibraryPage`의 items loader가 이 로컬 cache를 current로 인정하고 Firestore `getDocs`를 생략.
- My / Shared 양쪽 모두 같은 `createPlaylist()` 경로를 사용하므로 공통 적용.
- create canonical write 계약은 **W2 그대로**. RTDB changed-item signal, 기존 playlist list/items revision 구조, UI는 변경 없음.
- create-and-save 경로도 먼저 빈 current items cache를 갖게 되어 후속 첫 item insert의 warm R0 판단을 그대로 사용할 수 있음.

**폴더 30/60초 묶음 저장 판단**
- 이번 app294에서는 적용하지 않음.
- 서로 다른 폴더 create/rename은 각각 별도 canonical playlist 문서이므로 단순 writeBatch로 네트워크 요청을 묶어도 Firestore 과금 write 수 자체는 줄지 않음.
- 같은 폴더 이름을 짧은 시간 여러 번 바꾸는 경우 final-intent batching은 기술적으로 가능하지만, 현재 PREVIEW가 TEST/PRODUCTION 구버전과 shared data를 동시에 사용하고 `users.syncVersions.playlists` 하위호환 신호도 유지해야 해 즉시 canonical W2 계약을 우선 보호.
- 향후 별도 최적화 시 가장 현실적인 후보는 여러 playlist 변경의 공통 `users.syncVersions.playlists` revision write를 UID 단위로 묶는 방식이며, old-client convergence와 crash/reload durability를 먼저 설계해야 함.

**변경 commit**
- product fix: `7decc68c80114eae11129894135346992054b7cb`.
- focused verifier: `be1ee8cc091f4150510ba16abdc485b44e4689cf`.
- app version 294: `42ea54fc1284d46e8030240d51633bae64d661cf`.

**검증/배포 상태**
- `scripts/verify-294-library-new-folder-r0.mjs` 추가: create 경로에 server `getDocs`가 없고 canonical 성공 후 새 playlist의 빈 items cache를 같은 syncVersion으로 seed하는 계약 고정.
- Release System Audit Run `36941393567`: **FAIL**. 단, 이번 수정과 직접 관련된 TypeScript / Build 및 진단 그룹 A~D는 PASS. 최종 static 단계에서 기존 `verify-221-explore-feed-layout.mjs`가 현재 Music Note detail hydrate 구현 형태를 옛 정규식으로 검사해 assertion FAIL. app294 Library 변경 경로와 무관하며 이 작업에서는 제품/검사 범위를 넓혀 수정하지 않음.
- Firebase PREVIEW Release Run `36941526371`: **SUCCESS**.
- locked PREVIEW source: `3c9f1d67a72aaf9b94408f0d050752f8b47e439f`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **294**, exact build PASS.
- shared RTDB Rules: SKIPPED (변경 없음).
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: 없음.
- Worker / Functions / D1 / Firestore Rules 변경: 없음.
- 실기기 다음 확인: My/Shared에서 새 폴더 생성 시 `user_playlists:getDocs`가 더 이상 증가하지 않아 **create 직후 R0**인지 확인.

## 0MI. PREVIEW app293 배포 완료 — Library changed-item sync + Music Note folder rename 비용 절감 (2026-10-02 KST)

**배포/검증 기준**
- 기준 branch: `preview`.
- 제품 구현 시작: `b3f4443ecb873006eb93f4dd6e3a4df05556470e`.
- missed-delta 안전 보강: `c86a9ae7b86349ddb3ef39f4d059434441f8cba4`.
- RTDB continuity rules: `f49ca39ba717dc62afbecba0c2ab5184c63081bf`.
- focused verifier 최종: `35986cee25f6dcf128fa9c61b37a5bcbc4661783`.
- runtime cleanup: `e7b0c172dd2a9763911263c46924fc098980b537`.
- app version 293: `dfc094b13ef4c0a98378c22dc740766319489275`.
- PREVIEW release/locked source: `d0a0fd540e7104c7a70be82489758a14e30e48c9`.
- 최종 focused Audit Run `36938832665`: **SUCCESS**.
- Backend V2 Safety Run `36938820471`: **SUCCESS**.
- Firebase PREVIEW Release Run `36939049573`: **SUCCESS**.
- remote `preview.soridraw.com`: app **293**, exact build PASS.
- shared RTDB rules: exact source match + deploy PASS.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: **없음**.
- Worker / Functions / D1 / Firestore Rules 변경: **없음**.

**Library My/Shared Playlist**
- 기존 canonical Firestore 구조와 `users.syncVersions.playlists` / `itemsRevision`을 유지하여 app292 이하 TEST/PRODUCTION과 하위호환.
- 변경 성공 후 UID-scoped RTDB `userSync/{uid}/libraryPlaylist`에 최대 24KB changed-item delta 1개를 게시.
- 정상 cache + 연속 signal이면 반대 기기는 Firestore를 다시 읽지 않고 IndexedDB list/item cache를 직접 patch.
- signal은 `previousSyncVersion` continuity token을 포함. 기기가 offline 중 중간 delta를 놓쳤거나 payload가 oversized/truncated이면 cache revision을 거짓으로 앞당기지 않고 기존 Firestore fallback 1회로 복구.
- warm add/move에서 destination item cache가 current이면 duplicate + max-order 계산을 로컬에서 처리하여 사전 Firestore read **R0 경로**.
- warm playlist delete는 current item cache의 IDs를 사용하여 삭제 대상 탐색 Firestore read **R0 경로**. 실제 item canonical delete write는 데이터 삭제이므로 그대로 유지.
- canonical write 수는 이번 단계에서 의도적으로 유지:
  - playlist create/rename: W2.
  - item add/delete: W3.
  - item move: W5.
  - item order swap: W4.
  - 이유: TEST/PRODUCTION 구버전도 shared canonical data 변화를 계속 감지해야 하므로 parent/items revision + users revision을 아직 제거할 수 없음.
- Library social like `toggleTrackLike`의 R2/W2 transaction은 **이번 app293 범위 밖, 미변경**. 별도 후속 최적화 대상.

**Music Note**
- folder rename은 `user_structures/{uid}`의 folder structure만 canonical로 갱신.
- 기존 song의 `noteFolderTitle/sharedNoteFolderTitle` legacy copy는 읽기 호환용으로 그대로 두고 더 이상 rename 때 N곡을 재작성하지 않음.
- folder membership/filter는 기존처럼 stable folder ID를 사용.
- 코드상 rename 비용 목표: 기존 `structure W1 + favorites WN` → **structure W1 / favorites W0**.
- folder delete는 곡들의 folderId를 default로 실제 변경해야 하므로 현재 WN을 유지. 구버전 호환을 깨지 않고 제거할 수 없어 이번에는 건드리지 않음.

**보호된 기존 기능**
- app292 Recent 150초 UID-wide canonical batch 유지.
- Studio heart 30초 per-song final-intent batch 유지.
- favoriteCount 30초 UID-wide batch 유지.
- Music Note Detail draft/batch/RTDB preview 유지.
- Library workspace warm cache/re-entry R0 경로 유지.
- Explore / public like / 공개·비공개 / split UI 미변경.

**검증**
- TypeScript PASS.
- Build PASS.
- `APP293_LIBRARY_PLAYLIST_DELTA_SYNC=PASS`.
- `APP293_LIBRARY_WARM_INSERT_SERVER_R0_PATH=PASS`.
- `APP293_LIBRARY_WARM_DELETE_DISCOVERY_R0_PATH=PASS`.
- `APP293_MUSIC_NOTE_FOLDER_RENAME_W1_ONLY=PASS`.
- Library 101 / 030 / 116 warm-cost regressions PASS.
- Music Note Detail 031 PASS.
- app289 heart / app290 Recent / app290 Studio heart / app291 lyrics regressions PASS.
- 첫 Audit Run `36938199952`의 FAIL은 제품 코드가 아니라 app196 이후 변경된 Recent sync gate를 옛 문자열로 검사하던 `verify-116`의 stale assertion 때문. 현재 pure `needsRecentSongsServerRead()` 의미 기준으로 verifier를 갱신한 뒤 final Audit SUCCESS.

**실기기 확인 전 비용 판정**
- 위 수치는 code/static guard 기준.
- PC↔모바일 실제 즉시 반영과 CACHE LIVE Firestore R/W는 사용자 실기기 검증 전까지 **실사용 검증 전**.
- 사용자 `테스트배포` 지시 전 main/TEST 승격 금지.

## 0MH. Music Note / Library 저장·동기화 비용 구조 감사 (2026-10-02 KST)

**범위 / 상태**
- 코드 수정/배포 없이 현재 PREVIEW app292 구조를 정적 감사.
- Music Note 목록 버튼, Detail 편집, My/Shared Note 폴더, Library Workspace, My/Shared Playlist 폴더·아이템, 기기간 동기화 경로 확인.
- 아래 비용은 코드 경로 기준이며 별도 실기기 CACHE LIVE 재측정 전에는 운영 실측값으로 단정하지 않음.

**Music Note — 현재 좋은 구조**
- 목록 개인 좋아요/잠금:
  - 로컬 + localStorage 즉시 반영.
  - UID-scoped RTDB `musicNoteCardStateDelta`로 반대 기기 즉시 반영.
  - 페이지 안 반복 클릭은 Firestore W0.
  - dirty state를 페이지 이탈 시 `user_structures/{uid}.musicNoteCardState` 한 번 W1로 저장.
- Detail 제목/프롬프트/가사 등:
  - 필드 저장은 local durable draft에 합산하며 field-save마다 Firestore write 없음.
  - title/detail/Suno media preview는 compact RTDB preview로 반대 기기 반영.
  - canonical flush 시 해당 `favorites/{id}` W1.
  - 현재 실제 `scheduleFavoriteDetailFlush()`는 no-op이므로 오래된 60초 설명과 달리 자동 60초 flush는 없음; page-exit/manual/recovery 중심.
- Detail open:
  - 목록은 compact catalog summary.
  - 필요한 경우에만 exact `favorites/{sourceId}` 1건 hydrate; detail cache 재사용.
- My/Shared Note 폴더 구조:
  - folder metadata는 `user_structures/{uid}` aggregate + local cache/session.
  - folder add/reorder는 structure W1.
  - structure RTDB changed patch로 반대 기기 갱신; persistent Firestore structure listener 없음.
  - 기존 폴더에 1곡 배치/제거는 해당 favorite W1; N곡 선택은 changed-song-only WN.

**Music Note — 개선 필요 지점**
- 폴더 이름 변경:
  - structure W1 이후 해당 폴더의 모든 favorite에 중복 저장된 `noteFolderTitle/sharedNoteFolderTitle`을 다시 써서 **W1 + W(폴더곡수)**.
- 폴더 삭제:
  - structure W1 이후 해당 폴더 모든 곡을 default folder로 옮겨 **W1 + W(폴더곡수)**.
- 원인: song 문서에 folderId뿐 아니라 folderTitle을 중복 저장.
- 향후 개선 방향: folderId를 canonical membership으로 유지하고 화면 title은 structure에서 resolve, legacy title은 fallback만 사용하도록 하위호환 전환하면 rename fan-out을 W1로 줄일 수 있음. 사용자 승인 전 schema 의미 변경/백필 금지.
- 공개(globe) 경로는 Explore Worker/R2/D1 별도 보호 경로. warm publication-state read는 revision/R2 cache 중심이며 D1 R0/W0 경로가 있으나, 이번 감사에서 Worker mutation rows_written을 재실측하지 않았으므로 기존 동결 기준을 임의 수정하지 않음.

**Library Workspace — 현재 좋은 구조**
- authenticated session 동안 workspace snapshot/listener를 한 번 유지하고 page re-entry는 in-memory/IndexedDB cache 재사용.
- 정상 재진입은 server read 0 목표 경로.
- 더보기는 full local catalog의 UI pagination만 수행하여 추가 server read 없음.
- 색상 변경은 화면/로컬 먼저 변경하고 page exit에 changed keys만 저장.

**Library My / Shared Playlist — 비용 개선 필요**
- playlist list는 IndexedDB cache + `users.syncVersions.playlists` revision gate를 사용해 warm entry R0 가능.
- 하지만 cross-device 변경은 Music Note/Recent처럼 changed-item RTDB payload로 직접 patch하지 않고 revision 상승 후 collection refresh:
  - list revision이 바뀌면 playlist list collection 재조회.
  - active playlist의 `itemsRevision`이 바뀌면 그 playlist의 **전체 items collection 재조회**.
- mutation canonical 비용:
  - 폴더 생성/이름변경: list doc W1 + users revision W1 = **W2**.
  - 곡 추가: duplicate/order 확인 bounded read(최대 source query 8 + tail 1) + item W1 + parent itemsRevision W1 + users revision W1 = **W3**.
  - 곡 삭제: item W1 + parent revision W1 + users revision W1 = **W3**.
  - 곡 이동: new item W1 + old item delete W1 + source parent W1 + target parent W1 + users revision W1 = **W5**, plus bounded duplicate/order reads.
  - 순서 swap: two item W2 + parent W1 + users W1 = **W4**.
  - folder delete: 먼저 folder items 전체 `getDocs` 후 item 수만큼 delete + folder delete W1 + users revision W1 → **R/W가 폴더 곡 수에 비례**.
  - playlist color sync: changed item마다 item + parent revision + users revision = **W3/item**.
- Library playlist social like `toggleTrackLike`:
  - 클릭마다 canonical relation + count 2건 transaction read, 변화 시 relation + count 2건 write.
  - local optimistic UI는 있으나 Recent/Studio heart 같은 trailing batch/RTDB cross-device final-intent 구조는 아님.
- 따라서 **Library My/Shared Playlist는 app292 Recent/Music Note 수준의 비용 최적화라고 판정할 수 없음**.

**안전한 다음 최적화 후보 — 아직 미실행**
1. Library playlist changed-item RTDB signal + local cache patch로 cross-device one-item change 시 전체 playlist items reread 제거.
2. playlist item mutation의 parent revision/users revision 중복 write 축소 또는 UID aggregate/batched revision 설계.
3. playlist folder delete의 full items read/delete fan-out 재설계.
4. Library social like를 local-first + final-intent batch 방식으로 전환 가능한지 별도 설계.
5. Music Note folder title duplication 제거를 backward-compatible 방식으로 설계해 rename fan-out 제거.
6. Music Note Detail의 실제 no-idle-flush 동작과 오래된 60초 문서 설명을 정리하되, 사용자 승인 없이 정상 동작 변경 금지.

## 0MG. Song Save / Edit / Sync Cost 스킬 저장 (2026-10-02 KST)

- 신규 스킬: `.agents/skills/song-save-edit-sync-cost/SKILL.md`
- 기준 문서: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app292-save-edit-sync-cost-baseline.md`
- 범위:
  - Studio 저장/해제 하트 30초 per-song canonical batch
  - Recent Song 제목/프롬프트/가사 150초 UID-wide aggregate batch
  - PC↔모바일 RTDB 즉시 changed-item preview
  - preview receiver Firestore R0/W0 원칙
  - `users.favoriteCount` UID-wide 30초 derived-delta batch
  - net-zero W0 / changed-item-only / durable pending / stale overwrite 방지
  - app289~292 회귀검사와 실기기 비용 확인 기준
- `AGENTS.md`에 관련 작업 전 신규 스킬 필수 확인 규칙 추가.
- 코드/백엔드/사용자 데이터 변경 없음.
- PREVIEW/TEST/PRODUCTION 배포 변경 없음.

## 0MF. Music Note 저장곡 수 통계 batch 구조 유지 확정 (2026-10-02 KST)

**사용자 결정**
- 실제 저장/해제 곡 문서는 곡별 정확한 canonical 상태를 유지.
- `users/{uid}.favoriteCount`는 파생 통계이므로 클릭마다 쓰지 않고 UID 단위 30초 delta batch를 유지.
- 같은 30초 안 여러 곡 저장/해제는 `+1/-1` 변화량을 합산해 `users.favoriteCount`를 한 번만 갱신.
- 합산 결과가 0이면 통계 write 0.
- 이 통계값을 저장 제한/권한/결제 판정의 canonical 기준으로 사용하지 않음.

**현재 실제 코드 확인**
- `src/services/musicNoteFavoriteCountBatch.ts`에 이미 위 구조가 구현되어 있음.
- UID별 단일 pending delta + 30초 trailing timer + localStorage 복구 구조.
- 실제 canonical favorite 변경이 성공한 경우에만 `queueMusicNoteFavoriteCountDelta(uid, ±1)`를 호출.
- 따라서 추가 기능 수정은 불필요하며 현재 구조를 정상 기준으로 동결.
- UI/백엔드/데이터 구조 변경 없음. 배포 불필요.

## 0ME. PREVIEW app292 배포 완료 — Recent canonical batch 150초 + 다중곡 동작 확인 (2026-10-02 KST)

**사용자 결정**
- Recent Song 제목/프롬프트/가사 canonical Firestore trailing batch를 60초 → **150초**로 연장.
- PC↔모바일 즉시 화면 반영 RTDB preview는 그대로 유지.
- Studio Music Note heart의 30초 per-song batch는 변경하지 않음.

**동작 기준**
- Recent Song 편집:
  - 같은 UID의 Recent 목록 전체가 하나의 aggregate document이므로 pending snapshot/timer도 UID당 1개.
  - 150초 안에 A곡 제목 → B곡 프롬프트 → C곡 가사처럼 서로 다른 곡을 수정해도 매 수정마다 같은 150초 timer가 다시 시작됨.
  - 마지막 수정 후 150초가 지나면 그 시점의 Recent 목록 최종 상태를 canonical 1회 저장.
  - 현재 구조 기준 canonical 비용은 곡 수가 아니라 aggregate 1회 기준 `user_recent_songs W1 + users.syncVersions W1 = W2`.
  - 즉시 RTDB preview는 변경된 각 곡만 보내며 Firestore R0/W0.
- Studio heart:
  - **Recent 편집과 다름.**
  - heart pending/timer는 favorite document ID(곡)별 Map으로 관리.
  - A곡 heart 후 B곡 heart를 눌러도 A곡 30초 timer는 B곡 때문에 다시 시작되지 않음.
  - 같은 곡을 다시 누를 때만 그 곡 timer가 reset되고 final state로 collapse.
  - 여러 곡의 final heart 상태가 각각 달라지면 canonical favorite write도 각 곡 W1씩 필요.
  - 다만 `users.favoriteCount` 파생 통계 delta는 UID 단위 30초 batch로 합쳐질 수 있음.

**수정 / 검증**
- verified source commit: `34127904db7bb158ebcae28000fa65745fe56c8b`.
- release request commit: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- apply/audit Run `36932805247`: **SUCCESS**.
- `APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS`.
- `APP292_RECENT_MULTI_SONG_AGGREGATE_BATCH=PASS`.
- app290 Studio heart batching regression PASS.
- app291 lyrics live preview regression PASS.
- app289 Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- TypeScript PASS / Build PASS.
- 임시 apply workflow는 verified source commit에서 제거됨.

**PREVIEW 배포**
- Firebase PREVIEW Run `36933026848`: **SUCCESS**.
- locked deploy source: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- `preview.soridraw.com` app **292** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

## 0MD. PREVIEW app291 배포 완료 — Recent 가사 편집도 PC↔모바일 즉시 반영 + app290 실기기 비용 확인 (2026-10-02 KST)

**app290 사용자 실기기 / CACHE LIVE 비용 확인**
- 사용자 영상(약 2분 10초) 기준 브라우저 SDK server read **0** 유지.
- D1 **R0 / W0**, Cloudflare Worker **0**.
- 최종 관측 write:
  - `favorites:write 1`
  - `user_recent_songs:write 1`
  - `users:write 2`
  - 합계 Firestore SDK write **4**.
- 의미:
  - Studio heart 실제 최종 변경 1회 = canonical favorite W1 + 30초 묶음 `users.favoriteCount` W1 → **총 W2**.
  - Recent 제목/프롬프트/가사 연속 편집 = `user_recent_songs` W1 + `users.syncVersions.recentSongs` W1 → **총 W2**.
  - 편집 3종이 각각 W2로 반복되던 기존 W6은 재현되지 않고 최종 1묶음 W2로 collapse.
  - 읽기는 0이므로 app290 비용 hard gate(W1~W2/action) 기준 통과.
- CACHE LIVE에서 Music Note/Recent cache hit은 증가했지만 원본 Firestore read 증가 없음.

**사용자 실기기 기능 확인**
- 제목 수정 후 저장 → 반대 기기 즉시 반영.
- Studio 저장 하트 → 반대 기기 즉시 반영.
- 프롬프트 수정 → 반대 기기 즉시 반영.
- 가사만 즉시 반영되지 않고 약 60초 canonical batch 뒤 반영되는 증상 발견.

**가사 지연 ROOT CAUSE**
- Recent edit RTDB preview에는 최신 top-level `lyrics.korean/english`가 이미 포함되어 있었음.
- 그러나 Studio 가사 렌더는 `appliedKeywords.lyricsByLanguage`를 우선 사용.
- 수신기에서 top-level lyrics는 갱신했지만 기존 `lyricsByLanguage` map은 그대로 남겨서 화면이 오래된 가사를 계속 표시.
- 60초 후 canonical aggregate가 full `lyricsByLanguage`를 가져오면서 그때 화면이 바뀌어 "1분 뒤 반영"처럼 보였음.
- 서버 전송 지연이 아니라 **수신 기기 로컬 merge 누락**이 원인.

**app291 최소 수정**
- `src/App.tsx` Recent edit preview 수신 시:
  - 기존 RTDB payload의 최신 `lyrics.korean/english`를
  - 수신 기기의 `appliedKeywords.lyricsByLanguage`에도 즉시 local merge.
  - secondaryLanguage를 보존하여 영어 외 일본어/중국어 등 기존 2차 언어 위치도 유지.
- **추가 RTDB write 0**.
- **추가 Firestore R0/W0**.
- canonical 60초 batch와 비용 구조는 app290 그대로.
- 제목/프롬프트/하트/Music Note app289 경로 비변경.

**검증**
- 제품 수정 commit: `9ca5c6707dcd1b2b0380d88d5b28e5b32813a5d3`.
- historical app289 verifier version pin 보정 commit: `65fcdf2a6d5e4e7fa31ad5348580761643b356a3`.
- app291 Audit Run `36929318487`: **SUCCESS**.
- TypeScript PASS / Build PASS.
- `APP291_RECENT_LYRICS_PREVIEW_LOCAL_LANGUAGE_MAP=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_EXTRA_RTDB_WRITE_ZERO=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_FIRESTORE_R0_W0=PASS`.
- app290 Recent cost batching regression PASS.
- app290 Studio heart batching regression PASS.
- app289 oversized Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- 임시 app291 audit workflow 제거 완료.

**PREVIEW 배포**
- release commit: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- Firebase PREVIEW Run `36929528762`: **SUCCESS**.
- locked source: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- `preview.soridraw.com` app **291** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

**다음 실기기 확인**
1. PC/모바일 모두 app291 확인.
2. 같은 Recent Song의 한글/2차언어 가사를 수정 저장 → 반대 기기에서 **1분 대기 없이 즉시** 변경되는지 확인.
3. 제목/프롬프트/하트 즉시 반영 회귀 없음 확인.
4. 비용은 app290과 동일하게 Recent 편집 최종 W2, heart 실제 최종 변경 W2 이하 유지 확인.
5. 실기기 PASS 전 TEST 승격 금지.

## 0OW. 팔로우·크리에이터 추천 구현 후보 — 릴리스 BLOCKED, app344 유지 (2026-10-04 KST)

**작업 기준**
- branch `preview`, 시작 HEAD `2817327ee17f04fe248df237a3daefa3cf5bf3c5`.
- 이 항목을 포함한 preview commit은 구현 후보이며, app345 배포 완료본이 아니다.
- PREVIEW만 작업. main/TEST/PRODUCTION 변경 및 배포 0.

**작업 A — 구현 및 원인 재현**
- 관계 INSERT + 양쪽 counter를 단일 UPSERT로 묶음. 해제도 양쪽 counter를 단일 UPDATE + 관계 DELETE로 묶음.
- 동일 atomic D1 batch, RETURNING/no-postread, R2 target guard/counter patch 보호.
- 정상 경로 logical query R0/W3 → R0/W2.
- 관계 INSERT 직후 `changes() = 1`로 counter를 보호하여 같은 millisecond의 중복 follow가 counter를 중복 증가시키지 않음. 실제 D1 batch에서 changes() 연속성은 미검증.
- canonical `profile_stats`, derived profile counter 및 변경 신호는 기존 코드와 호환되도록 유지. schema/trigger 실제 변경 0.
- 관계 1행 + 양쪽 canonical counter 2행 = 최소 3개 canonical 행 변경. 이를 W1/W2 physical로 보이게 하려고 counter를 R2만으로 옮기면 기존 TEST/PRODUCTION 숫자 authority가 깨지므로 실행하지 않음.
- 현재 trigger 경로의 synthetic SQLite 재현: 관계 1 + canonical counter 2 + derived profile 2 + seq 2 + profile journal 2 = **total_changes 9**.
- follow/unfollow 3회씩: baseline도 9, 후보도 9. **physical amplification 미해결**. 쿼리를 묶었다는 이유로 비용 정상화 PASS 처리 금지.
- SQLite total_changes는 D1 index 비용 포함 Rows Read/Written이 아니다.
- 사용자 실제 baseline: query R0/W3, Rows Read 18~19, Rows Written 14~17. 수정 후 실제 D1 Rows Read/Written, Worker, R2 A/B는 **미검증**.
- `scripts/verify-345-follow-cost.mjs`: production 함수 자체를 추출해 기존 schema/032/249 trigger fixture에서 3 cycle, 양쪽 canonical/derived 수치, duplicate no-op, indexed UPDATE, Feed journal 불변, rollback을 검사. `--release`는 실제 PREVIEW 6 sample evidence 없이 실패한다. 비용 gate를 완화하지 않음.

**작업 B — 구현 범위와 미완료**
- latest 40 owner-only 후보를 curated 40 + latest 40 + popular 40의 bounded owner pool로 확대.
- 우선순위: 대표 프로필 장르 exact > 같은 broad family > curated > latest > popular. 곡 장르는 같은 source 안의 보조 신호.
- 본인 제외, UID 중복 제거, 20명 카드 제한. UI/CSS/레이아웃 변경 0.
- 기존 first-view 기기 캐시의 공개프로필 대표장르만 읽음. 프로필마다 GET/서버 조회, 전체 사용자 scan, 새 D1/Firestore/Worker/R2 요청 0.
- profile cache 추출은 useMemo로 묶어 단순 UI 렌더마다 최대 120개 envelope를 반복 파싱하지 않음.
- **미완료:** 기기에 없는 로그인 사용자/후보의 대표장르는 알 수 없음. 이 경우 곡 장르를 대표 프로필 장르로 위장하지 않고 source fallback만 사용. 최초 기기에서도 대표장르 1순위가 보장되는 R2 일괄 요약 공급은 아직 구현되지 않음.
- 현재 R2 artist metadata는 uid/marker keys/signature 중심이며 프로필 대표장르 전체를 한 번에 제공하는 기존 bundle을 확인하지 못함. 후보별 R2 profile GET으로 우회하지 않음.

**검증**
- TypeScript PASS, Build PASS (로컬 Node 24.15.0; 릴리스 Node 20 검증은 미실행).
- follow 3-cycle functional/duplicate/rollback verifier PASS; physical cost gate **BLOCKED**.
- creator 대표장르 순위/실제 한국어·영어 catalog alias/curated-latest-popular fallback/self/dedupe/local IO verifier PASS; cold-profile 장르 공급은 미완료.
- existing `verify-explore-deploy-preflight.mjs`, `verify-202-explore-action-cost-bounds.mjs` PASS.
- Work 독립 read-only diff 검토: 정상행 atomicity/순위 회귀 없음. D1 changes() 실제 연속성, cold-profile 장르 공급, PC/모바일은 미검증.
- 기존 missing profile_stats unfollow에서는 일부 counter/관계만 변경되고 delta=0이 반환될 수 있는 cold-repair 제한이 남음. 이번에 전체 scan/backfill로 복구하지 않음.
- npm 11 ci는 기존 잠금 파일 누락으로 실패. npm 10.8.2 ci + 잠금 버전 Windows native package 3개만 별도 압축 해제로 검증. package.json/package-lock 변경 0. Build 산출물은 원래 tracked dist로 복원.

**배포/데이터**
- Firebase Hosting/Functions/Rules/설정 변경 0. Cloudflare Worker/R2/D1/schema/trigger 실제 변경 0.
- 사용자 원본 데이터 write/delete/copy/migration/backfill 0. synthetic in-memory fixture만 사용.
- PREVIEW release trigger/app-version 변경 0, 배포 Run 없음. app344/Worker341 유지.
- PC/모바일 실제 확인 및 PREVIEW live cost 계측 미실행. TEST/PRODUCTION live unchanged 감사 미실행; 이 작업에서는 해당 branch/service 변경 명령을 실행하지 않음.
- 새 branch/workflow 생성·삭제 0. 임시 workflow 0.

**[이번 작업 변경 파일] / [누적 변경 파일] — 시작 기준점 이후 동일 8개**
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `src/pages/ExplorePage.tsx`
- `src/services/exploreProfileFirstViewService.ts`
- `src/services/exploreCreatorRecommendations.ts`
- `scripts/verify-345-follow-cost.mjs`
- `scripts/verify-345-creator-recommendations.mjs`
- `DOCS/CURRENT_RELEASE_STATE.md`
- `DOCS/NEXT_CODEX_TASK.md`

**다음 작업**
- 이 구현 후보를 완료/배포본으로 취급하지 않는다.
- shared legacy counter/derived-reader 동시 호환 조건에서 physical 행 증폭을 실제로 낮출 설계를 먼저 확정. trigger 교체/authority cutover가 필요하면 별도 안전 검증 및 사용자 범위 확인 전 실제 shared DB 적용 금지.
- 후보별 GET 없이 cold 기기에도 대표장르를 공급하는 bounded R2 summary 계약을 설계. 읽기/쓰기/초기 공급 비용과 기존 사용자 호환성을 명시. 무단 backfill 금지.
- 실제 D1 batch 및 PC↔모바일을 검증한 뒤, 비용 원인 해결 + 실제 3-cycle 계측이 통과할 때만 같은 릴리스의 PREVIEW 배포를 진행.

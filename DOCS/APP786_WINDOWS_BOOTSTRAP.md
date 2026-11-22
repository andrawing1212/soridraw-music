# APP786 — Windows 관리자 1회 설정

**지금 할 일은 PowerShell에서 한 번 실행하는 것입니다.** Cloud Shell 및 Codex 클라우드 로그인은 필요하지 않습니다.

## 실행 방법

1. 일반 Windows PowerShell에서 아래 두 줄을 순서대로 실행:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/andrawing1212/soridraw-music/main/scripts/app786-qa-windows-bootstrap.ps1 -OutFile .\app786-qa-windows-bootstrap.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\app786-qa-windows-bootstrap.ps1 -Apply
```

2. Google Cloud CLI가 설치되지 않았다면 [Google Cloud 공식 Windows 설치](https://cloud.google.com/sdk/docs/install)를 이용하고 PowerShell을 새로 열어 두 번째 줄부터 재실행. `winget install --exact --id Google.CloudSDK`도 가능하다.
3. 브라우저에서 Google 관리자 계정 로그인. 스크립트가 QA 프로젝트 번호 `1083981050742`, 기존 WIF의 정확 GitHub 신뢰 조건, Firestore 목록 및 Cloud Build 빌드 계정, QA 결제 계정/예산 조회에 성공할 때만 **`SORIDRAW-QA`를 한 번 입력**해 적용한다.
4. `APP786_QA_BOOTSTRAP_PASS`가 나오면 채팅에 `QA 초기설정 완료`라고 한 줄 전송. 그러면 GitHub에서 미리 준비한 QA deployer 인증·Firestore 읽기 테스트를 실행할 수 있다.

## 적용 범위

- 오직 QA 프로젝트 `soridraw-app`; 운영 `soridraw-app-866a5`, 기존 QA 팔로우, 공유 사용자 원본 및 다른 프로젝트 불변.
- QA 결제 통화가 **KRW면 월 5,000원**, USD면 **월 $5** 예산 알림(50%/90%/100%)이 없을 때만 생성. KRW 5,000원은 기존 $5 목표보다 보수적인 조기 알림 기준이다. 반드시 **`projects/soridraw-app` 한 프로젝트에만** 적용. 예산 알림은 지출 상한이 아니다.
- Firestore `(default)`가 없는 것이 실제 목록 조회로 확인될 때만 `asia-northeast3` / Standard / Native + 삭제 보호로 생성. 기존 DB가 다른 리전이면 중단. **Firebase 클라이언트 규칙은 별도 검증 전까지 승인하지 않음.**
- QA-only runtime/deployer 서비스 계정 생성 또는 재사용. 기존 GitHub reader에 쓰기 권한 추가 없음. GitHub WIF 제공자는 읽기/정확 조건 확인만 하며 변경하지 않음.
- QA deployer 임시 역할은 2026-12-02 00:00 KST 자동 만료 조건을 붙이고 종료 직후 별도 회수. 서비스 계정 actAs는 QA 실행 계정과 실제 확인된 QA Cloud Build 서비스 계정에만.
- QA HMAC Secret 1개를 기존 값 손대지 않고 최초 버전만 무작위 생성. 키 원문은 GitHub/채팅에 출력하지 않음. 서비스 계정 JSON 키도 생성하지 않음.
- **앱/Functions/Cloudflare 배포, Firestore 합성 사용자 데이터 쓰기, R2/D1 변경은 이 스크립트에서 하지 않음.** 다음 단계 GitHub QA 자동 검사 통과 후 별도 진행.
- `gcloud billing accounts describe`에서 실제 계정 통화를 조회한 뒤 그 통화로만 예산을 생성한다. 기존 같은 이름 예산이 잘못된 프로젝트·금액이면 임의 중복 생성하지 않고 HOLD한다.
- 중간 오류가 나면 안전 중단한다. 일부 QA 초기 리소스만 생성됐을 수 있으므로, 성공했다고 말하지 않고 오류 한 줄을 근거로 재개한다.

## 검사

- 원본 Windows PowerShell 문법 및 QA 프로젝트·권한·만료·금지 명령 정적 검사: [Actions #45065471539](https://github.com/andrawing1212/soridraw-music/actions/runs/45065471539) PASS. 이후 디렉터 Windows 실실행에서 **KRW 계정에 `5USD` 예산 생성** 및 `projects/{projectNumber}` 필터가 잘못된 문제 확인, 생성 요청 `INVALID_ARGUMENT`으로 중단. **QA 예산·Firestore·서비스 계정 생성 0**, 새 코드 실제 실행은 아직 미검증. 수정본을 `main`에서 다시 받아야 한다.
- 다음 자동 검사: `.github/workflows/app782-app518-qa-firebase-wif-readonly.yml`의 `qa_deployer_admission`. 저장소 소유자의 PR #528 정확 명령 `/app518-qa-deployer-admission 864f796da24413309567198c9de502b13cdedd50`만 허용.

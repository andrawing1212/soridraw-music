# APP777 — 격리 Firebase 서명 인증과 공통 팔로우 진입점 연결 (2026-11-22)

## 실제 검증 목표와 안전 제한

사용자 YES 승인: **기존 격리 QA Firebase 프로젝트에서 발급된 실제 서명 ID Token과 App Check Token**으로 구형·신형 팔로우 요청이 APP775 공통 진입 검사에 도달하는지를 확인한다. QA 프로젝트: `soridraw-app`, Project Number `1083981050742`. 운영 Firebase 프로젝트 `soridraw-app-866a5` 또는 실제 사용자 계정 사용은 금지한다.

관련 기 검증 재사용: APP747은 기존 QA 합성 두 계정과 App Check 공식 Firebase Admin 검증 코드, APP749는 실제 QA 토큰과 QA Worker 서명 인증 게이트 코드 및 QA Cloud Shell 전용 비공개 파일, APP775는 기본 OFF인 공통 진입 증거 shape 검사, APP776은 테스트 증거를 입력한 Cloudflare 임시 QA Worker의 실제 HTTP R2+D1 통합 검사(검증 PASS, 원본 Worker/합성 데이터 정리 완료).

## 실제 확인된 차단점

APP747/749의 기존 private QA 자격증명은 **QA Cloud Shell 홈 디렉터리의 0600 권한 파일**에 보관하는 방식이다. `~/.soridraw-qa-583-worker-config.json`와 `~/.soridraw-qa-749-auth.json`. GitHub repository, Actions secret, 일반 채팅으로 원본 서명 JWT를 보내지 않으며, 현재 GitHub connector에는 QA Cloud Shell 파일을 직접 읽거나 해당 실행 환경에서 명령을 수행할 수 있는 세션이 없다. 따라서 **새로 만든 테스트가 GitHub Actions에서 PASS했더라도 실제 Firebase가 발행한 토큰 사용 PASS는 아니다.**

## APP777 최소 수정

- `scripts/app775-unified-follow-ingress.mjs`의 QA 전용 **읽기 전용 scope** `APP777_ISOLATED_QA_SIGNED_READ_ONLY`에서만 Firebase QA 프로젝트 `soridraw-app`를 인정한다. 기존 OFF 기본값, 원래 오프라인 scope의 Production Firebase 프로젝트 ID 검증, 모든 재저장/Writer/DO/R2 권한=false를 유지한다. QA 프로젝트를 운영 Firebase로 위장하거나 Auth UID를 신뢰하지 않는다.
- `scripts/app777-qa-signed-ingress.mjs`에서 이미 존재하는 `cloudflare/explore-worker/experiments/owner-follow-qa-real-auth-749.mjs`의 **RS256 JWT + Google 공개 JWKS 검증기**를 재사용. QA issuer/audience, Firebase Auth UID, App Check issuer/audience, 서명·만료·kid 검증을 통과한 경우만 기존 APP775 공통 진입점에 전달한다. 모든 라우트/HTTP 메서드/QA 원본 두 계정 UIDs를 제한한다. 읽기 전용 결과만 반환, 실제 token bytes / 인증 헤더 / 비공개 로컬 파일 내용은 반환하거나 기록하지 않는다.
- `scripts/verify-777-qa-signed-ingress-offline.mjs`: Node 22에서 **오프라인에서만 생성한 일회성 RSA 서명 키**로 signature + App Check + QA/PROD 프로젝트 구분, 누락·변조·만료 JWT, wrong actor, 구형/신형 공통 진입, Auth epoch/Writer cutover/pending fence의 불확실성 `HOLD`, 네트워크 0을 확인한다. 이 로컬 RSA 키로 만든 JWT를 **실제 Firebase 토큰으로 보고하지 않는다.**
- `scripts/app777-qa-real-cloudshell-readonly.mjs`: 기존 QA Cloud Shell에서만 실행 가능한 읽기 전용 진단. 시작 전에 `gcloud` 프로젝트 ID/번호와 기존 파일 권한 0600을 검사하고 기존 APP747 공식 Firebase Admin SDK로 실제 actor/owner ID 토큰을 **폐기·취소 여부까지** 확인, App Check 검증. 이어서 Google 공개키를 이용하는 APP777 진입 검사로 동일 토큰이 구형 형식의 APP775 판정을 통과하는지 검증한다. **Auth epoch/모든 Writer cutover/pending fence 증거는 테스트 fixture이고 운영상 검증되지 않는다.** 서버 쓰기·사용자 추가·Worker 배포 및 공유 데이터 변경 없음.

## 실제 서버 실검증 절차 — 사용자 Cloud Shell에서만

기존 QA Cloud Shell이 로그인된 상태에서, 기존 비공개 파일과 현재 토큰이 그대로 존재하고 만료되지 않았다면, 해당 Cloud Shell에서 다음 하나의 명령만 실행한다.

`node scripts/app777-qa-real-cloudshell-readonly.mjs --read-only`

이 명령은 저장소 최신 승인된 소스를 QA Cloud Shell 작업 디렉터리에서 사용하며 **토큰이나 UID를 출력하지 않는다**. 필요하면 승인된 실행 결과의 PASS/HOLD 문자열만 공유할 수 있다. 현재 이 채팅에서 해당 Cloud Shell 명령을 실제 실행한 증거가 없으면 `APP777_REAL_FIREBASE_SIGNED_GATE=NOT_TESTED/HOLD`다.

주의: 실제 QA HTTP Worker에 서명 토큰을 직접 전송하고 D1/R2 쓰기를 수행하는 APP776+APP777 end-to-end 연동은 **아직 배포되지 않은 별개 단계**다. APP777 읽기 전용 검증을 통과해도 Firebase 인증이 APP775의 신뢰할 수 있는 Auth epoch·독립 pending fence·전 활성/구형 Writer cutover를 완성했다는 뜻은 아니다. 기존 QA Worker 원본 활성 버전, APP768/769/774/776 PASS 및 PREVIEW/TEST/PRODUCTION 데이터·서비스 보호 유지.

## 비용·배포 및 결론 기준

- 이번 PR에서는 신규 Cloudflare Worker, D1/R2/Firebase 자원, GitHub credential, 환경변수, 앱 기능·Hosting, RTDB/Functions 변경 0. 기존 PR 오프라인 검사만 재사용하고 live QA job은 `if:false`.
- QA Cloud Shell 읽기 전용 실행을 실제 사용한다면 공식 Firebase Admin의 서명 검증 호출 및 Google 공개키 조회만 수행하며 기존 실사용 데이터 쓰기는 없다. 실제 API 과금은 해당 프로젝트의 사용량 조건을 따르며 이 채팅에서는 측정 불가.
- **출시 차단:** APP775/APP777 소스 코드는 기본 OFF, active Worker import 0. 실제 QA 서명 Token 실검증, 모든 Writer 공통 진입, 정본 W1~W2, DO PITR/독립 operation ledger/삭제 정책, PC↔모바일 정상 작동은 별도 검증할 때까지 HOLD. 자동 복구 기능 및 PRODUCTION 배포 금지.

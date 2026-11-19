# SORIDRAW — PREVIEW → PRODUCTION 직접 승격 계약 (APP737)

**최종 제품 원칙:** PREVIEW에서 검증된 모든 일반 사용자 기능은 정식앱에서도 같은 동작·결과·보존 데이터·PC↔모바일 동기화를 제공한다. 특정 환경 전용 QA/진단 기능은 명시적으로 문서화한 경우에만 예외다. `test.soridraw.com`은 이 릴리스 경로에서 사용·변경·삭제하지 않는다.

## 검증된 버전 그대로 승격

1. PREVIEW의 **실제 활성 Hosting 버전, 정확한 GitHub SHA, 빌드 파일 전체 해시**를 고정한다. 단순히 `preview` 브랜치 최신 코드를 다시 빌드해 정식앱에 올리는 것은 **동일 릴리스** 증거가 아니다.
2. 정상 기능 전체를 목록화하고 프롬프트·가사·Suno 연동·Studio·Library·Music Note·Recent·Explore·좋아요·팔로우·공개·프로필·로그인·관리자·미디어·PC/모바일·업데이트/기존 사용자 데이터의 실제 결과가 정식 환경과 호환되는지 확인한다. 검사 범위를 임의로 축소해 기능 일부를 누락하지 않는다.
3. Cloudflare Explore/Media Worker **코드, 활성 버전, 비밀키 바인딩 이름/유형, DO, D1/R2, 배치/트리거/캐시, Functions, RTDB Rules, Firebase Auth/AppCheck**를 매 릴리스 비교한다. 사용자 기능과 직접 연관된 PREVIEW 바인딩이 정식에 없으면 HOLD. 독립 QA/진단용 연결은 근거를 확인하고 제외할 수 있다. 정식 Worker의 기존 **레거시 바인딩을 임의로 삭제하지 않는다.**
4. 환경별 허용 차이: `SORIDRAW_ENVIRONMENT` 값, 적절한 도메인/허용 오리진, 인프라별 분리된 캐시·제한·비밀값·배포 사이트 등. 이 차이는 **같은 기능을 보장해야 하며** PREVIEW만 ON/PRODUCTION은 OFF인 사용자 기능 플래그는 합격 불가. PREVIEW/PROD에서 공유하는 D1 원본·R2 미디어·Firebase 사용자 데이터는 복제나 마이그레이션 대상이 아니다.
5. **정확히 활성 중인 버전**의 연결을 상속한다. 최신 비활성 Worker 업로드의 바인딩을 현재 활성 버전으로 착각하지 않는다. 신규 DO migration, Secrets/Rules/Functions/보안/데이터 변경은 일반 배포에 포함하지 않으며 별도 승인과 QA·롤백 검증이 필요하다.
6. PREVIEW↔PRODUCTION 기능·비용·보안·기존 사용자 캐시 승계·복구가 검증된 경우에만 **디렉터의 명확한 정식 배포 지시 후** PROD를 승격한다. 실행은 Worker/Functions 등 승인된 변경부터, 최종 Hosting은 `firebase hosting:clone soridraw-preview:live soridraw:live`처럼 **실제 검증된 Hosting 버전을 재빌드 없이 복제**한다. 해당 CLI 명령은 배포를 수행하므로 사전 승인/환경 계약·사이트별 Headers/Cache-Control 차이 검토 없이 실행하면 안 된다.
7. 최종 배포 뒤에는 **문제가 발생한 원래 기능부터** PC·모바일·기존 계정에서 확인하고 실제 서버 버전/Cloudflare 요청·비용을 점검한다. 실패 시 미리 고정한 PROD Hosting·Worker 버전으로 복구하며 공유 데이터를 지우거나 초기화하지 않는다.

## 기존 릴리스 컨트롤러와의 관계

`.github/workflows/soridraw-release-promotion.yml`은 역사적 `TEST_VERIFIED` / `soridraw-test-v...` 태그를 요구한다. 현재 TEST 미사용 정책과 충돌하므로 그 검증을 억지로 제거하거나 기존 컨트롤러를 호출하지 않는다.

`scripts/app737-direct-promotion-contract.mjs`는 **서버 접근이 없는 순수 승인 전 게이트**, `scripts/app737-live-readiness.mjs`와 `.github/workflows/app737-direct-promotion-readiness.yml`은 **읽기 전용 환경 차이 진단**이다. 출력을 `READY_FOR_DIRECTOR_APPROVAL`로 바꾸려면 PREVIEW 전체 기능 목록·실사용 PC/모바일·QA·동일 바이너리·롤백 증거가 모두 필요하다. **어떤 경우에도 APP737 코드는 정식 서버를 배포하지 않는다.** 준비 전에는 HOLD.

## 현행 미해결 차이 (실제 환경 기준, 새 자동 승인 아님)

- 최근 Cloudflare GET 검사: Explore Worker 바인딩 PREVIEW 41개, PROD 12개. 구형 PROD service binding 2개와 PREVIEW 전용 owner-follow/Functions 플래그·저장소·부트스트랩 연결을 무차별 복사하지 않는다. 어떤 기능이 정식에서도 필요한지, 어느 항목이 QA/진단용인지 코드·실제 동작으로 구분해야 한다.
- APP730은 독립 QA Worker 비활성 업로드·버전 지정 403 실호출과 기존 100% 복구까지 PASS했지만, **합성 A↔B의 내구성 있는 확정→Functions→RTDB 실제 전송/PC·모바일 검증은 미완료**다. 이전 APP583 PASS를 새 버전 PASS로 재분류하지 않는다.
- PROD Worker 코드/DO migration 및 Functions·Rules 버전·새 코드 번들 동일성, 실제 Hosting 자산 동등성, 복구 리허설이 확인되지 않아 **현재 정식 배포 HOLD**다.
- 사용자 데이터 원본·Local First·뮤직노트·라이브러리·최근곡·로그인/좋아요 동기화 및 무변경 방문 W0 보호는 항상 우선한다.

## APP738 — 실제 Hosting 승격·복구 실행 코드

- `scripts/app738-firebase-hosting-runtime.mjs`: Firebase Hosting REST API GET으로 PREVIEW와 정식앱의 정확한 활성 버전·서버측 파일 SHA256 목록·ServingConfig를 수집한다. 버전 파일 목록은 페이지를 모두 읽고 동일 경로 중복/미업로드/미완료 상태를 차단한다.
- `scripts/app738-production-hosting-transaction.mjs`: APP737 검증 결과와 **Studio·가사·Suno·Music Note·Library·Recent·Explore·좋아요·팔로우·공유·프로필·로그인·미디어·관리자·PC/모바일 동기화** 필수 기능의 PREVIEW/PRODUCTION 동등성, 독립 QA 증거, 디렉터 승인, PREVIEW SHA와 활성 Hosting 버전 고정을 확인한다. 미검증이면 복제 API 호출도 불가.
- 정식 배포를 승인받은 뒤에만 원본 PREVIEW 버전으로 **신규 정식 Hosting 버전을 비활성 복제**하고, 모든 파일 해시와 Hosting 설정이 원본과 정확히 일치하는지 검사한다. 기존 정식앱의 릴리스 ID가 변경되면 활성화하지 않는다. 그 후에만 새 릴리스로 활성화하고 실제 정식 도메인의 앱 버전·접속을 확인한다.
- 활성화가 성공해도 실검증이 실패하면 활성 버전이 방금 배포한 버전일 경우에만 **기존 정식 Hosting 버전으로 자동 복구**한다. 다른 관리자 또는 릴리스가 중간에 개입했다면 기존 버전으로 무조건 덮어쓰지 않고 수동 HOLD한다. 이 자동 복구는 **Hosting에만 적용**되며 Worker·Functions·Rules·D1·R2의 복구를 대신하지 않는다.
- `.github/workflows/app738-direct-hosting-promotion.yml`: `inventory`는 독립된 Firebase GET-only 실서버 검사이며 정식배포 변경 0. `deploy`는 저장소 소유자의 명시적인 `DEPLOY_PRODUCTION`, 현재 PREVIEW SHA와 정확한 검증 증거 해시, 검토·독립 QA를 통과한 `DOCS/APP738_APPROVED_DIRECT_RELEASE_EVIDENCE.json`이 모두 일치할 때만 실행한다. **현재 해당 승인 증거 파일이 없어 정식 배포는 자동 차단된다.** 검증된 환경 준비가 되기 전 미리 PASS로 적거나 임의로 증거 파일을 만들지 않는다.
- 이 배포기는 PRODUCTION **Hosting만** 승격한다. 정식 Explore/Media Worker와 Firebase Functions/RTDB Rules의 호환·기능 동등성 및 안전한 릴리스는 **APP737 독립 사전검증 단계에서 별도 합격**해야 한다. 현재 Explore Worker 41/12 연결 차이와 APP730 실전송 미검증 때문에 전체 직접 승격은 여전히 HOLD다. 구형 TEST 기반 컨트롤러와 TEST 앱은 변경하지 않는다.

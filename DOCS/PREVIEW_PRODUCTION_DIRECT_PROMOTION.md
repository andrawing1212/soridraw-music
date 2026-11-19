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

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
- APP730/741 독립 합성 QA: 기존 QA 프로젝트 `soridraw-app`에서 실제 합성 B→A 팔로우 확정 revision 7 / count 1 → Functions → RTDB 및 취소 revision 8 / count 0 **실전송 PASS**(Cloud Shell 결과, [APP741 Actions #44646956397](https://github.com/andrawing1212/soridraw-music/actions/runs/44646956397)). 이 합성 경로는 QA probe token 인증이며 **실제 Firebase Auth/AppCheck 인증·강제 503 장애 주입·일반 PC/모바일 실사용 PASS가 아니다.** APP583 합격을 재표기한 것이 아니라 APP730 자체의 신호 실증이며 PROD 승격은 HOLD.
- PROD Worker 코드/DO migration 및 Functions·Rules 버전·새 코드 번들 동일성, 실제 Hosting 자산 동등성, 복구 리허설이 확인되지 않아 **현재 정식 배포 HOLD**다.
- 사용자 데이터 원본·Local First·뮤직노트·라이브러리·최근곡·로그인/좋아요 동기화 및 무변경 방문 W0 보호는 항상 우선한다.

## APP749 독립 QA PASS 재사용 — 정식 서버 동등성은 아직 HOLD (2026-11-21)

- 현장 PC A/B Firebase Auth·App Check 검증 및 A PC/모바일 RTDB 팔로우 **0명/버전10 → 1명/버전11 → 0명/버전12** 수신, PC 팔로우·취소 1회씩 PASS. APP749 QA Worker/QA584/QA Firebase `soridraw-app`에 한정한 실기기 증거를 `DOCS/CURRENT_RELEASE_STATE.md` 최상단 체크포인트로 고정한다. 관련 코드·서버 상태가 같으면 이 합격 검사를 다시 수행하지 않는다.
- 이 성공은 **정식 Worker·Auth/AppCheck/Functions/RTDB·다른 로그인 사용자의 활성화**나 강제 장애 503 복구를 입증하지 않는다. APP737 실제 서버 바인딩 41 대 12(차이 31 + 운영 레거시 2), PRODUCTION 사용자 기능 ON·비용/보호·실제 릴리스·롤백 호환은 여전히 독립 확인 대상이고 APP738 승인 증거 파일도 미생성. 직행 PRODUCTION은 HOLD.
- 릴리스 시간 단축은 기존 계약의 **최초 백엔드 호환성 1회 확인 → 이후 환경 고정·변경 범위만 검사 → 검증된 PREVIEW Hosting 활성 버전 그대로 복제**를 사용한다. TEST 컨트롤러 호출/기능 OFF/임의 제외/반복 QA/전체 회귀를 속도 확보 수단으로 쓰지 않는다.

## 반복 배포 최적화 계약 — 최초 검증과 일상 승격 분리 (2026-11-20)

- **최초 1회 검증:** PREVIEW/PRODUCTION 실제 코드·Worker 바인딩/DO·Functions·RTDB Rules·Auth/AppCheck·구버전 사용자 데이터·비용·롤백의 동등성을 실제 증거로 확립한다. 아직 완료되지 않았으며 RELEASE HOLD. 증거 없이 EXCLUDE/QA_ONLY로 기능을 제거하거나 모두 복사하지 않는다.
- **이후 일반 Hosting 업데이트:** 기존 백엔드 활성 버전 UUID, 정확한 바인딩 대상·정책/Rules/Functions 버전, 사용자 API 계약 및 비용 경로가 마지막 **독립적으로 승인된 기준과 동일한지 읽기 전용으로 비교**한다. 모두 동일하고 신규 서버 기능이 없으면 그 기준에서 이미 PASS한 백엔드 독립 QA/롤백 훈련을 재수행하지 않는다. 대신 바뀐 프런트엔드 기능·PREVIEW 실제 활성 Hosting 파일 전체 SHA·현재 PROD 롤백 버전/설정·PC/모바일 영향 경로만 재검증한다.
- **재검증 경계:** Worker 코드/버전·바인딩 대상·Functions/RTDB Rules/Auth/AppCheck·요청 API 계약·데이터 저장/동기화/캐시 비용이 바뀌면 변경된 계층의 추가 검증·승인이 필요하다. 단순 UI 변경이라도 새 서버 호출이나 저장 동작이 있으면 'Hosting만 변경'으로 처리하지 않는다.
- **목표 속도:** 일반 Hosting-only 변경은 PREVIEW 사전검사 완료 및 정식 승격 승인 후 **1~5분 내 배포·기본 확인을 목표**로 한다. 아직 운영환경 실측 보장 시간은 아니며, 검사 실패·실사용 이상·고위험 변경 시 강행하지 않는다. 매번 새 QA 프로젝트·전체 회귀·중복 독립 감사·TEST 컨트롤러를 만들지 않는다. 모든 필수 기능의 정상 동작과 저장 원본 보호는 여전히 합격 조건이다.
- **배포 게이트 유지:** APP737/738의 `READY_FOR_DIRECTOR_APPROVAL` / 정확한 SHA/증거 파일/최종 디렉터 승인·자동 복구 조건을 우회하지 않는다. 현재 해당 승인 증거 파일은 아직 없으며 운영 배포를 수행하지 않는다.
- **QA Worker 복구 재사용:** APP741은 Wrangler 원본 `4ed70845...` 단일 100% 복구 명령 **SUCCESS**였으나 직후 Cloudflare API read는 일시적 `ACTIVE_TRAFFIC_DRIFT`로 실패. 외부 재배포 없이 [APP735 최종 GET-only #44650441200](https://github.com/andrawing1212/soridraw-music/actions/runs/44650441200) **PASS**. 같은 정상 조회 지연 때문에 매번 18분의 QA를 반복하지 않는다. 기존 원본 응답·고정 바인딩 조회를 제한적으로 재확인하고, 미일치 시 HOLD. 실사용 합격 범위는 별도.

## APP752 — 팔로우 18개 실제 차이의 소스 대조 및 최소 수정 우선순위 (2026-11-21, READ-ONLY)

**확인 기준:** GitHub `preview` HEAD `4363820117100cb03bcbc44a01e127aeb5de3cf4`와 `production` 브랜치 HEAD `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`의 `cloudflare/explore-worker/canonical/preview-entry.js`를 직접 대조. 해당 파일의 Git blob은 서로 다르고(PROD 소스에는 아래 PREVIEW owner-follow 실행 표식이 없음), PREVIEW의 owner-follow 관련 런타임 `OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN`, `APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN`, `APP557_OWNER_PRECOMMIT_COMPILED_OPEN`이 모두 `false`. main의 `scripts/app729-production-follow-adapter.mjs`와 `scripts/app743-production-follow-bridge.mjs`도 배포하지 않는 소스 후보이며 `APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN=false`, `APP743_PRODUCTION_FOLLOW_COMPILED_OPEN=false`. **Git 브랜치 소스 비교는 Cloudflare 활성 버전의 코드 해시와 동일하다는 증거가 아니다.** 기존 APP737 GET-only 보고의 실제 PREVIEW/PROD Explore 바인딩 41/12 차이(18개 follow)는 재사용하되 배포 직전에 활성 버전 해시와 대상은 별도 고정한다.

**18개 이름별 필요한 증거를 세 작업으로 통합(설정값/비밀키 복사 금지):**

- **① 정본→내구성 예약/중복 방지 (8개):** `OWNER_FOLLOW_RESERVATION_SERVICE_600`, `SORIDRAW_OWNER_DO_BRIDGE_SECRET_600`, `SORIDRAW_OWNER_DO_STANDALONE_600`, `SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547`, `SORIDRAW_OWNER_FOLLOW_BIND_544`, `SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607`, `SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544`, `SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653`. 필요한 실증은 PROD Auth+AppCheck 주체 확인, 정본 D1 확정과 stable receipt/DO alarm, 재전송·순서·중복 차단, 실제 활성 Worker 연결과 비용·복구. APP743 후보는 여전히 source-only/OFF.
- **② 서명된 Functions→소유자 RTDB 전달 (4개):** `SORIDRAW_OWNER_FOLLOW_ENDPOINT_539`, `SORIDRAW_OWNER_FOLLOW_HMAC_539`, `SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607`, `SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669`. QA APP749는 **격리 QA 두 계정**에 한해 A↔B Firebase 실인증과 PC/모바일 수신 0→1→0 PASS. PROD 실제 Functions 수신점·서명 비밀·오래된 버전 거절·사용자별 Rules·복구·호환은 별도 미증명.
- **③ 사용자 활성화·범위·카나리 보호 (6개):** `SORIDRAW_OWNER_FOLLOW_CANARY_UID_574`, `SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653`, `SORIDRAW_OWNER_FOLLOW_W2_PUSH_555`, `SORIDRAW_PUBLIC_FOLLOW_READY_669`, `SORIDRAW_PUBLIC_FOLLOW_SCOPE_669`, `SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680`. 일반 사용자 전체 동작을 특정 카나리 계정이나 PREVIEW 도메인에 묶지 않고, 구형 클라이언트와 기존 정상 팔로우/좋아요 경로를 보호하는 방식으로 실제 사용자 활성화 계약 증명 필요. 단순 플래그 ON 또는 PREVIEW 값을 PROD에 복사해 통과 처리 금지.

**우선 조치:** (1) 기존 APP728의 Cloudflare **활성 버전 코드 해시/출처 증거**를 확인하여 브랜치 소스와의 차이 및 18개 필요 연결을 확정, (2) APP729/743의 OFF 생산 후보에 실제 PROD용 Firebase principal/DO durable receipt/Functions RTDB 연결과 승인된 보안·비용 증거를 마련, (3) 배포 이전 독립 QA의 장애 재전송·빠른 반대 클릭·기존 캐시/구버전 호환·복구만 영향 범위 검사. **APP749 통과한 QA A/B 단순 팔로우 0→1→0은 반복하지 않는다.** 이 세 작업은 18회의 반복 실기기 검사도, 18개 자원 자동 생성도 의미하지 않는다.

**현재 결론:** APP749 PASS를 일반 PREVIEW/PRODUCTION 계정 PASS로 확대할 수 없다. 배포를 막는 핵심은 단순 바인딩 수량이 아니라 **정식 활성 코드의 기능 연결 및 정본↔RTDB 전체 처리·복구 증거 부재**다. 새 Worker/Functions/RTDB/Rules/Secrets·데이터 변경은 별도 승인이 필요하며 이 소스 대조에서는 수행하지 않았다. APP737/738 PRODUCTION 릴리스 HOLD, TEST 미사용, 운영 기존 레거시 service 바인딩 2개 보존.

## APP751 — 31개 연결의 최소 검증 순서 (읽기 전용, 릴리스 HOLD)

APP737의 기존 GET-only 실행 결과에 `releaseBlockerPlan`을 추가했다. 기존 APP742의 31개 목록을 새로 검사하지 않고 재사용하며 **25개 사용자 기능 관련 연결은 기능별 3묶음**, **6개 비용·환경 연결은 설정 동등성 2묶음**으로 한 번에 검토한다. 모든 연결의 원본 코드·실제 활성 대상 확인은 유지한다. 버전이나 설정이 달라진 부분만 후속 검사한다.

1. **팔로우 18개:** APP749 독립 QA A↔B 실제 Firebase Auth/AppCheck·PC/모바일 0→1→0 PASS 재사용. 다만 PREVIEW/PRODUCTION의 실제 활성 코드, 정식 사용자 전체 활성화, DO/Functions→RTDB/장애 복구·비용·기존 기능 보호는 아직 별도 증거 필요. 신규 백엔드 활성화는 별도 승인 전 금지.
2. **좋아요/공개 확정 4개:** 기존 정본 기록·서명·R2/캐시·구버전 호환 자료를 재사용하고, 활성 PROD 경로가 같은 결과를 보장하는지만 확인.
3. **알림 3개:** 공개/개인정보 접근 권한·소유자 수신·보관 비용 등 실제 정식 사용자 경로를 확인. UI 표시만으로 PASS 주장하지 않음.
4. **비용/캐시 2개:** 환경별 대체 연결의 실제 대상·W0/읽기/쓰기가 기존과 같은지 확인; 공유 원본 DB/R2를 캐시 대체로 임의 사용 금지.
5. **환경값 4개:** 도메인/오리진/부트스트랩과 실제 활성 버전 차이를 대조. 이름에 PREVIEW 또는 CANARY가 포함돼도 근거 없는 일괄 제외 금지.

이 5묶음은 **31개 서버 항목을 자동 복사하거나 31회 실기기 QA를 요구한다는 뜻이 아니다.** 앱 동작과 활성 코드·연결별 출처는 전부 확인하되, 같은 기능의 현장 검증은 검증된 기존 증거와 필요한 대표 경로를 재사용한다. 31개 외 새 항목이나 운영 레거시 2개가 달라지면 즉시 HOLD한다. APP737/738 승인 증거가 갖춰지기 전까지 PRODUCTION은 배포 금지이며 TEST 및 공유 서버 변경 없음.

## APP742 — 최초 Explore Worker 차이 검증의 작업 단위

APP737 실제 활성 Worker 검사(`preview 43638201...`)는 PREVIEW 전용 바인딩 **31개**, 운영 전용 레거시 service **2개**를 확인했다. APP728에 이미 있는 이름별 분류 함수를 **APP737 실제 GET-only 준비 보고에 연결**한다. 분류는 활성화 증거나 제외 승인이 아니다.

- **팔로우 관련 18개:** 정본 변경, actor/owner 인증, 예약·재전송, Functions→RTDB 버전 순서 및 PC/모바일을 확인해야 한다. 기존 APP730 합성 QA PASS는 부분 재사용하지만, 실제 Firebase Auth/AppCheck·강제 503·모든 로그인 사용자 기능 PASS는 아님.
- **알림 3개:** 읽기 전용 inbox와 인증·오리진·보관 규칙의 실제 사용자 기능 여부를 검증한다.
- **좋아요·공개 확정 처리 4개:** 기존 Stage416/431 신호·서명·수신점·하위 호환성 보호.
- **비용·파생 캐시 2개:** 별도 R2/D1 또는 기존 정식 환경의 대체 연결이 같은 기능·비용을 보장하는지 확인한다.
- **환경 식별 설정 4개:** 정식 도메인·오리진·부트스트랩 설정을 현재 활성 버전과 대조한다. 사용자 기능에 영향이 없다는 근거 없이는 제외할 수 없다.

운영 전용 `EXPLORE_MIRROR_PREVIEW`/`EXPLORE_MIRROR_TEST` service 연결을 임의로 제거하거나 호출하지 않는다. **PREVIEW 바인딩 31개 무조건 복제 금지.** APP737/738의 실물 기능·데이터 안전·롤백·승인 게이트는 모두 유지한다.

## APP738 — 실제 Hosting 승격·복구 실행 코드

- `scripts/app738-firebase-hosting-runtime.mjs`: Firebase Hosting REST API GET으로 PREVIEW와 정식앱의 정확한 활성 버전·서버측 파일 SHA256 목록·ServingConfig를 수집한다. 버전 파일 목록은 페이지를 모두 읽고 동일 경로 중복/미업로드/미완료 상태를 차단한다.
- `scripts/app738-production-hosting-transaction.mjs`: APP737 검증 결과와 **Studio·가사·Suno·Music Note·Library·Recent·Explore·좋아요·팔로우·공유·프로필·로그인·미디어·관리자·PC/모바일 동기화** 필수 기능의 PREVIEW/PRODUCTION 동등성, 독립 QA 증거, 디렉터 승인, PREVIEW SHA와 활성 Hosting 버전 고정을 확인한다. 미검증이면 복제 API 호출도 불가.
- 정식 배포를 승인받은 뒤에만 원본 PREVIEW 버전으로 **신규 정식 Hosting 버전을 비활성 복제**하고, 모든 파일 해시와 Hosting 설정이 원본과 정확히 일치하는지 검사한다. 기존 정식앱의 릴리스 ID가 변경되면 활성화하지 않는다. 그 후에만 새 릴리스로 활성화하고 실제 정식 도메인의 앱 버전·접속을 확인한다.
- 활성화가 성공해도 실검증이 실패하면 활성 버전이 방금 배포한 버전일 경우에만 **기존 정식 Hosting 버전으로 자동 복구**한다. 다른 관리자 또는 릴리스가 중간에 개입했다면 기존 버전으로 무조건 덮어쓰지 않고 수동 HOLD한다. 이 자동 복구는 **Hosting에만 적용**되며 Worker·Functions·Rules·D1·R2의 복구를 대신하지 않는다.
- `.github/workflows/app738-direct-hosting-promotion.yml`: `inventory`는 독립된 Firebase GET-only 실서버 검사이며 정식배포 변경 0. `deploy`는 저장소 소유자의 명시적인 `DEPLOY_PRODUCTION`, 현재 PREVIEW SHA와 정확한 검증 증거 해시, 검토·독립 QA를 통과한 `DOCS/APP738_APPROVED_DIRECT_RELEASE_EVIDENCE.json`이 모두 일치할 때만 실행한다. **현재 해당 승인 증거 파일이 없어 정식 배포는 자동 차단된다.** 검증된 환경 준비가 되기 전 미리 PASS로 적거나 임의로 증거 파일을 만들지 않는다.
- 이 배포기는 PRODUCTION **Hosting만** 승격한다. 정식 Explore/Media Worker와 Firebase Functions/RTDB Rules의 호환·기능 동등성 및 안전한 릴리스는 **APP737 독립 사전검증 단계에서 별도 합격**해야 한다. 현재 Explore Worker 41/12 연결 차이와 APP730 실전송 미검증 때문에 전체 직접 승격은 여전히 HOLD다. 구형 TEST 기반 컨트롤러와 TEST 앱은 변경하지 않는다.

# SORIDRAW RELEASE CONTROLLER SPEC

최종 갱신: 2026-09-17 KST

## 목적

배포를 매번 사람이 조합하는 작업이 아니라 **고정된 하나의 릴리스 프로그램**으로 운영한다.

사용자가 선택하는 것은 원칙적으로 두 가지뿐이다.

- `TEST 승격`
- `PRODUCTION 승격`

실제 배포 전에 실패 가능한 항목을 최대한 차단하고, TEST에서 검증한 결과를 PRODUCTION에서 다시 임의로 만들지 않는다.

## 절대 원칙

1. PREVIEW / TEST / PRODUCTION의 사용자 원본 데이터는 공유한다. 승격 중 데이터 복사/백필/대량변환/삭제 금지.
2. 앱 업데이트만으로 Firestore/D1 전체 조회 또는 Feed/Profile 전체 재생성 금지.
3. PREVIEW에서 검증된 정확한 source SHA/tree만 TEST 후보가 된다.
4. TEST에서 검증된 정확한 tree와 실제 결과만 PRODUCTION 후보가 된다.
5. 설정/권한/binding/build 문제가 있으면 실제 배포 전에 `BLOCKED`로 끝낸다.
6. 배포 중 실패는 정상 흐름이 아니라 최후 예외다. 자동 rollback은 보험이며 반복 재배포를 정상 운영 방식으로 사용하지 않는다.
7. 배포 Workflow/Controller를 릴리스마다 수정하지 않는다.
8. TEST 안정화 기간 뒤 PRODUCTION으로 갈 때 TEST를 다시 배포하지 않는다.

## Controller 상태

고정 상태 머신:

`READY -> PREFLIGHT -> TEST_DEPLOY -> TEST_VERIFY -> TEST_VERIFIED -> PROD_PREFLIGHT -> PROD_DEPLOY -> PROD_VERIFY -> RELEASED`

차단 상태:

`READY/PREFLIGHT -> BLOCKED`

실제 배포 후 예외 상태:

`*_DEPLOY/*_VERIFY -> ROLLBACK -> FAILED`

## 실행 모드

### 1. `preflight_only`

실제 배포 없음.

검사:
- exact PREVIEW SHA/tree
- TypeScript
- Build
- release static guard
- TEST/PRODUCTION live Firebase 대상 확인
- TEST/PRODUCTION Cloudflare Worker live config/binding read
- shared canonical D1/R2 resource identity
- D1 SELECT-only preflight
- CORS/route prerequisites
- 배포 권한/secret 존재 여부
- 현재 main/production baseline 잠금
- TEST/PRODUCTION 비변경 확인

PASS하지 못하면 실제 배포를 시작하지 않는다.

### 2. `test`

전제: 동일 release identity로 `preflight_only` PASS.

동작:
- exact PREVIEW tree를 main forward commit으로 승격
- TEST Worker 새 version 생성/검증 후 traffic 전환
- PREVIEW <-> TEST revision/shared snapshot/direct feed/public profile parity gate
- parity PASS 뒤 Firebase TEST Hosting 배포
- `test.soridraw.com` exact index/app-version/CORS 확인
- PRODUCTION 비변경 확인
- TEST 검증본 Release Manifest 생성
- 상태를 `TEST_VERIFIED`로 고정

중요: TEST 검증이 끝난 뒤 사용자가 며칠간 TEST를 사용해도 PRODUCTION 승격을 위해 TEST를 다시 배포하지 않는다.

### 3. `production`

입력은 PREVIEW SHA가 아니라 **검증된 TEST Release Manifest**다.

배포 전 다시 확인:
- manifest가 TEST_VERIFIED 상태인지
- manifest의 main SHA/tree가 현재 검증 대상과 같은지
- TEST 실제 주소가 여전히 manifest app-version/index hash와 같은지
- TEST Worker 공개 projection/parity가 정상인지
- PRODUCTION live binding/resource preflight PASS인지

그 뒤:
- 검증된 TEST tree를 production forward commit으로 승격
- Firebase Hosting은 가능하면 TEST에서 검증한 Hosting version/content를 `hosting:clone`으로 PRODUCTION에 승격해 재빌드 차이를 제거한다.
- Worker는 TEST에서 검증한 exact source/bundle hash를 기준으로 PRODUCTION script용 version을 생성하고, bundle hash가 다르면 traffic 전환 전에 BLOCK한다.
- PRODUCTION Worker는 TEST와 revision/shared snapshot/direct feed/public profile parity를 통과한 뒤 성공 처리한다.
- `soridraw.com` exact app-version/index/CORS 확인

PRODUCTION 승격은 사용자 명확한 `정식배포` 승인 없이는 실행하지 않는다.

## Release Identity / Manifest

TEST 검증 완료 시 다음 값을 고정한다.

- app version
- PREVIEW source commit SHA
- PREVIEW source tree SHA
- TEST main promoted commit SHA
- TEST main tree SHA
- `dist/index.html` SHA-256
- 필요 시 전체 dist manifest/hash
- TEST Hosting site/channel 및 검증 시점
- TEST Worker source/bundle SHA-256
- TEST Worker deployed version id
- canonical DB name
- canonical PROFILE_MEDIA bucket name
- parity 검증 결과
- GitHub Actions run id
- verified timestamp

Manifest는 제품 source tree에 섞지 않는다. 장기 보관 가능한 GitHub Release/annotated tag 같은 별도 릴리스 메타데이터로 보존한다.

## Hosting 승격

Firebase 공식 Hosting clone 기능을 사용하면 TEST에서 실제 검증한 Hosting content/config를 다른 Hosting site의 live channel로 복제할 수 있다.

따라서 PRODUCTION에서 같은 source를 다시 build해서 비슷한 결과를 만드는 것보다, TEST 검증본을 clone하는 것을 우선한다.

clone 후에도 `soridraw.com`의 index/app-version을 TEST manifest와 다시 확인한다.

## Worker 승격

Cloudflare Worker는 코드와 config/binding을 version으로 분리/관리할 수 있는 현재 Versions/Deployments 방식을 우선 검토한다.

목표:
- 새 version 생성 자체는 live traffic을 바꾸지 않음
- exact source/bundle hash 검증
- environment-specific binding은 기존 live shape를 보존하면서 canonical shared DB/R2 강제
- 검증 뒤에만 100% traffic 전환
- 실패 시 직전 active version으로 즉시 복귀

TEST Worker version id를 PRODUCTION script에서 그대로 재사용한다고 가정하지 않는다. script별 version 차이를 인정하되 **배포되는 코드 bundle의 hash와 source tree는 동일**해야 한다.

## 비용 보호

릴리스 검증은 bounded probe만 허용한다.

금지:
- 전체 Feed scan
- 전체 user/profile scan
- 전체 cache rebuild
- 배포용 backfill
- 앱 버전 변경 때문에 D1/Firestore 전체 읽기

검증 경로의 shared revision/snapshot/public profile은 기존 D1 read/write 0 계약을 유지한다.

## 기존 시스템에서 반드시 해결할 현재 구조적 문제

현재 고정 promotion workflow는 `test_only` 또는 같은 실행에서 `test_then_production` 중심이다.

사용자가 TEST를 실사용으로 안정화한 뒤 나중에 PRODUCTION으로 승격하려면 **검증된 TEST만 독립적으로 PRODUCTION으로 올리는 고정 경로**가 필요하다.

새 Controller는 이를 `production` 모드로 제공하며, 이때 TEST를 다시 배포하지 않는다.

## 구현 범위

제품 React/UI/Explore 기능은 수정하지 않는다.

수정 대상은 원칙적으로:
- `.github/workflows/soridraw-release-promotion.yml` 또는 이를 대체하는 단일 고정 Controller workflow
- `.deploy/release-worker-runtime.mjs`
- 새 release controller/manifest helper
- `scripts/verify-release-promotion-system.mjs`
- release system audit workflow
- 관련 DOCS

DB migration/seed/Functions/Rules/사용자 데이터 변경 없음.

## 검증 순서

1. 코드 구현
2. static verification
3. TypeScript / Build
4. TEST/PRODUCTION Worker dry-run
5. shared D1 SELECT-only preflight
6. Controller `preflight_only` 실제 실행 — 배포 없음
7. Work 독립 감사
8. 사용자 승인 뒤 TEST 1회 실제 승격
9. TEST 실사용 안정화
10. 사용자 명확한 승인 뒤 `production` 모드로 검증된 TEST를 PRODUCTION에 승격

## 완료 기준

Release Controller 완성은 Workflow 파일이 존재하는 것으로 끝나지 않는다.

- 평소 릴리스에서 Workflow 수정이 필요 없어야 함
- PREVIEW -> TEST는 한 번의 승인/실행으로 끝나야 함
- TEST 안정화 뒤 TEST 재배포 없이 PRODUCTION으로 갈 수 있어야 함
- 실제 배포 전 오류는 BLOCKED되어야 함
- TEST/PRODUCTION 실제 결과 불일치는 성공 처리되지 않아야 함
- 사용자 원본 데이터는 비변경이어야 함
- 정상 캐시/변경 없음 비용 원칙을 훼손하지 않아야 함

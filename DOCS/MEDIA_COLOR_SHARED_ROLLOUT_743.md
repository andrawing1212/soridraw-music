# PR #743 — 공유 Media Worker 색상 호환 승격·롤백 계약 (배포 금지)

## 판단 (2026-11-04 KST)
- 정확 후보: `920b15bd0280c81ee1ca764ab08eeaca7f20c0e1` 기준의 Draft PR #743. 이 문서와 검사는 **코드 준비**이며 실제 Worker 적용이나 사용자 색상 복구가 아니다.
- PREVIEW, TEST, PRODUCTION은 모두 `soridraw-user-catalog`의 같은 R2 버킷에 delta를 기록한다. TEST 앱 사용을 중단했더라도 활성 TEST Worker가 남아 있고 호출 가능하면 Writer 호환 검증에서 제외할 수 없다.
- 2026-11-03 21:21 KST Cloudflare 공식 API capture [41635057757](https://github.com/andrawing1212/soridraw-music/actions/runs/41635057757): preview `83175bcc-fe25-4d17-86c0-1592e47d358e` (source SHA256 `e52948ff2b49ddcf1343b499147fd0d0b5d3242a02b895b539d83aa4a99b49ea`), test `f0a86688-5ffc-42ed-aecd-c01f8c17c636`, production `2c2e3236-d9a6-4771-b2ba-7baff496145c` (두 환경 source SHA256 `c7591d0329521e321c28b5155673b1c606318367cca72849e44343816220e5aa`). 당시 3개 모두 shared flag `1`, CATALOG 버킷 일치. 재배포 직전 최신 버전/바인딩 재확인이 필요하다.
- 다운로드한 활성 모듈의 `projectCatalogFields`·`applyCatalogDelta`를 합성 데이터로 실행하는 **읽기 전용 검사**에서 현재 세 환경 모두 구형 클라이언트 색상 유지에 실패. TEST·PRODUCTION은 Music Note 색상 projection 단계에서도 실패. 이미 배포된 구형 Worker를 롤백 대상으로 삼으면 색상 누락을 재발시킨다.

## 코드 검증 도구
- `node scripts/verify-743-media-color-rollout-readiness.mjs --self-test` : 세 후보·세 롤백 번들 증거, 혼합 Writer, 운영 버전 드리프트, 안전한 Writer 중단 증거, 승인 누락을 HOLD로 판정하는 순수 테스트.
- 과거 read-only capture를 다운로드·압축해제한 로컬 경로에서 `node scripts/verify-743-media-color-rollout-readiness.mjs --capture <디렉터리>` : `summary.json` + `preview.js`/`test.js`/`production.js` SHA256·바인딩 정체성 일치를 확인하고, *실제 번들 함수*를 네트워크 없는 VM에서 실행한다. 누락된 capture는 fail-closed. 출력의 `HOLD`는 정상적인 위험 탐지 결과. 민감한 사용자 원본은 열지 않는다.
- 기존 `verify-library-catalog-color-projection.mjs`는 후보 Worker의 Music Note/Library 투영·기존 R2 base+journal·구형 브라우저·명시적 gray/null·삭제·CAS 재시도·추가 I/O 0 경로를 검증하며 위 순수 rollout self-test를 호출한다.
- **이 gate의 성공은 배포 승인이 아니다.** 이 모듈은 Worker API/Cloudflare 계정에 접근하거나 배포를 실행하지 않는다.

## 실제 배포를 고려하기 전 필요한 증거와 안전선
1. **운영 현재 상태 고정:** Cloudflare 공식 계정에서 세 Worker의 100% 활성 버전·원본 bundle SHA256·MEDIA/CATALOG binding·shared flag를 배포 직전 한 번 재확인한다. 부분 트래픽, 혼합 버전, drift면 HOLD. 해당 환경의 다른 색상 Writer/클라이언트 경로도 확인한다.
2. **3개 환경 동일 보호 코드:** 미리 정확한 후보 SHA와 세 환경별 설정을 고정하고 빌드 번들 정체성·권한·서비스별 MEDIA 버킷·서명키 보존·실제 코드 경로를 검증한다. CI의 소스 PASS만으로 활성 Worker 호환 PASS라 판정하지 않는다.
3. **혼합 Writer 구간 보호:** 활성 구형 Worker를 하나씩 교체하는 동안 공유 CATALOG 변경이 발생하면 색상 필드가 잘릴 수 있다. 따라서 무손실·재시도 가능한 **검증된 Catalog 쓰기 정지/배리어**와 pending 영속화/복구가 먼저 필요하다. 이것은 현재 구현/승인되지 않았으며 새 사용자 기능 변경·서비스 중단 없이 안전하게 가능한지도 미확정. 단지 임시로 클라이언트 버튼을 막거나 서버 데이터를 복구/초기화해서 해결하지 않는다. 증거 없으면 전환 시작 자체가 NO-GO.
4. **검증된 호환 롤백:** 구형 활성 Worker 버전으로 자동/수동 rollback 금지. 색상 보호가 포함된 **별도 exact rollback bundle/version**을 세 환경별로 미리 준비하고 실행형 검증해야 한다. 같은 R2 원본이 보존되는 것을 확인한 후에만 전환을 고려한다. old-worker rollback은 R2 복원이 아니며 이미 잘린 필드를 복구하지 못한다.
5. **승격 검증:** 변경분 1건, null(회색), 오래된 클라이언트 누락, 같은 ID의 두 기기 경쟁, 삭제→재추가, 미디어·Library·Music Note 저장, 신구 롤백 경로를 합성 데이터와 제한된 인증 테스트로 검증. 기존 사용자 데이터 전체 스캔·819건 반복 읽기·R2 rebuild·대량 backfill·캐시 강제 초기화 금지. 실제 PC↔모바일은 미검증.
6. **배포 승인:** 공유 Worker는 Hosting 자동 배포 범위가 아니며, 현재 디렉터는 Worker 배포·TEST/PRODUCTION 변경·PR 병합을 금지했다. 이 조건이 모두 충족돼도 별도 명시 승인이 필요하다.

## 현재 결론
**SOURCE READY FOR FURTHER REVIEW / LIVE ROLLOUT NO-GO.** 3개 구형 Writer·안전한 rollback artifact 미확보·쓰기 배리어 미구현·실사용 미확인. 제품 원본 보호 때문에 이번 PR에서 Worker 배포 workflow를 활성화/변경하지 않으며 PR은 Draft·미병합 유지한다.

## 2026-11-04: 공유 Writer 전환의 영속 pending 후보 (코드만, 기본 OFF)
- `cloudflare/media-worker/src/catalogCutoverOutbox.js`: **이미 인증된** changed-item Catalog delta만 owner+kind별 R2 독립 outbox에 CAS 기록하는 코드. mutationId와 원본 delta를 보존하고 중복 재시도에는 별도 쓰기를 하지 않는다. 변조/동일 mutationId 다른 payload/부피·개수 초과/CAS 실패는 fail-closed. bounded owner-kind 객체 **최대 32 mutation / 512KiB**이며 페이지 방문 비용은 0. R2의 일반 Catalog HEAD·base·journal을 변경하지 않는다.
- `SORIDRAW_CATALOG_CUTOVER_HOLD_V1=1` **명시적 신규 환경변수**를 완전히 배포·활성화한 경우에만 Worker의 인증된 delta는 R2 outbox에 먼저 기록되고 응답은 **503 retryable**(성공 ACK 불가). GET/Bootstrap의 시드 쓰기도 막지만 그동안 cold Catalog 읽기 지연이 발생하므로 **현재 기능과 동기화 요구를 완전히 충족하지 않는다**. 정상 runtime은 flag absent/OFF이며 추가 서버 IO 0. PRODUCTION/TEST/PREVIEW 모두 현재 이 flag를 추가하거나 변경하지 않음.
- `replayCatalogCutoverPending`: **HTTP 라우트 연결 없음**. 운영자 증거(구형 3 Worker 외부 ingress 차단/동일 버전 고정/안전 롤백 사전확보/별도 수동 승인)가 모두 있어야 호출 가능한 주입형 재처리. 정확한 원 mutationId를 재사용하고 **Catalog journal의 durable receipt를 다시 검증한 후에만** outbox entry를 committed 처리. 성공한 entry도 자동 삭제하지 않는다. 재조회 실패/충돌/상충한 수정/락 CAS 실패면 pending 보존. 버전 재기반(rebase)·전체 리스트 재생성·R2 LIST·Firestore 스캔·자동 백필 없음.
- 기존 브라우저 `CATALOG_PENDING_KEY_519` 로컬 outbox는 유지. HTTP 503은 실패로 판정하므로 정상 ACK가 아니라 retry pending을 남긴다. 그러나 로컬 저장소 quota 실패나 구버전 브라우저·인터넷 단절까지 무조건 무손실이라고 보장하지 않는다. 전환 때 필요한 **공유 ingress 전역 쓰기 배리어는 아직 미구현**: 이전 활성 Worker는 이 flag를 보지 못하고 계속 쓸 수 있다. 안정적인 전면 배리어 없이 이 기능만 켜서는 안전하지 않다.
- 검증: `scripts/verify-743-catalog-cutover-pending.mjs` (실제 module + in-memory R2 fixture: 성공 저장/중복/변조/명시적 null/저장 실패/동시 CAS/할당량/로그 미확인/재처리/중복 처리). 기존 Catalog 색상 검사의 끝에서 실행한다.
- **현재 판정:** 코드는 배포 준비의 구성요소만 확보했으며 '무손실 전환 완료'가 아니다. 실제 서비스에서 3개 Writer를 가로지르는 배리어·결정적 모든 UID pending 회수·안전한 실기기 검증 및 정확한 rollback artifact가 확보되기 전까지 **LIVE NO-GO**. 이 PR은 Draft·미병합 유지, 모든 사용자 데이터/배포 금지.

## 2026-11-04 — 이전 Worker 격리·전환·복구의 실행형 오프라인 판정

- 과거 Cloudflare 2026-11-03 21:21 KST 캡처 #41635057757의 PREVIEW/TEST/PRODUCTION 실행 번들에서는 신규 SORIDRAW_CATALOG_CUTOVER_HOLD_V1 분기와 outbox를 찾을 수 없다. 3개 모두 공유 CATALOG Writer가 될 수 있어, 최신 Worker 한 곳에서만 hold를 켜도 이전 Worker 직접 URL/기존 호출 경로가 우회한다. 기존 CORS와 새 Worker flag만으로 전역 격리를 주장하지 않는다.
- PR #743 현재 단계에는 구형 Worker 전체 수신 차단의 검증 가능한 운영 장치가 없다. 어떤 기존 접근 경로도 우회할 수 없다는 증거가 나올 때까지 NO-GO. 현재의 활성 버전·경로는 캡처 시점 이후 drift 가능성이 있다.
- 실제 catalogJournal.js append로 baseRevision=100인 pending A, B를 순차 실행: A revision 101 커밋 후 B는 CONFLICT. replayCatalogCutoverPending은 B를 HOLD/pending으로 보존하지만 완료/정상복구는 하지 못한다. 새 자동 rebase나 묵시적 최신 덮어쓰기는 금지한다.
- 현재 outbox의 정확 UID/kind 키만 아는 조회 방식은 전 사용자 pending 결정적 수집을 보장하지 않는다. 32개 한도·committed 자동 미삭제로 큐 포화가 가능하다.
- Hold 활성 때 GET/bootstrap은 503이므로 신규 기기/PC↔모바일 읽기 정상성은 미확인. 구형 활성 Worker로 rollback하면 색상 손실 가능성이 남는다.
- 기존 검사 스크립트에 두 건 이상의 동시 base pending 충돌 재현을 추가하고 rollout gate는 외부 ingress 격리, ordered replay, 모든 pending 키 확인, 읽기 가용성 검증 네 조건을 명시적으로 요구하도록 수정했다.
- 조건부 검증 순서: 세 환경의 모든 Worker 진입점과 고정된 활성 버전 확인 → 외부 격리/기존 사용자 pending 보존 증명 → 3개 color-safe candidate 및 rollback artifact 검증 → 순서/충돌/색상 null/삭제 동시변경 재처리 → 모든 UID pending 확인 → 최소 인증된 PC↔모바일 실사용과 복구 검증. 실패 시 전환 중단. TEST 앱은 사용하지 않되 살아 있는 TEST Worker는 격리 확인 대상이다.
- 이 작업은 코드·오프라인 검사만 수행한다. 병합, Cloudflare/Firebase 배포·변경, R2/Firestore 사용자 원본 접근 또는 대량 작업 금지. 결론은 LIVE NO-GO.

## 2026-11-04 — 안전한 순차 재처리와 격리 증거 (코드 검증만)
- 기존 클라이언트가 503 응답 뒤 새 mutationId를 생성해도 내용이 동일한 pending은 새 R2 쓰기를 만들지 않도록 막는다. 별도의 실제 회색 변경과 서로 다른 곡 변경은 보존한다.
- 영속 pending 재처리는 현재 HEAD의 완전한 journal 기록으로 변경 내역이 서로 다른 곡 ID임이 증명될 때만 안전하게 baseRevision 및 itemCount를 갱신한다. 같은 곡 전체 행 편집, 삭제·재추가, 압축으로 확인할 수 없는 기록은 HOLD 및 pending 유지. 임의 최신 덮어쓰기 금지.
- 재처리는 외부에서 승인, 구형 Writer 격리, 단독 재처리자 임대, 모든 pending 회수 증거, 롤백 버전을 제공한 경우만 가능하다. 해당 증거는 이 코드가 Cloudflare에서 직접 조회·서명한 것이 아니다. 운영 전환 GO를 의미하지 않는다.
- 보류 모드에서 이미 저장된 공유 CATALOG는 strict R2 GET로 읽기만 한다. 기존 seed 함수를 호출하지 않아 보류 중 데이터 오염을 차단한다. 누락·손상·리비전 부족은 503이며 bootstrap 쓰기는 금지.
- 구형 PREVIEW/TEST/PRODUCTION 직접 URL, route, custom domain, service binding을 실제로 차단하는 장치는 미구현/미적용이다. 코드의 ingress 증거 형식 검사는 실제 Cloudflare 제어 권한을 대신하지 않는다. 안전한 전역 격리가 입증될 때까지 LIVE NO-GO.

## 2026-11-04 — 디렉터 승인 범위: 전역 Writer 전환용 코드 보호 강화, 배포 금지
- **실제 화면 증거:** PREVIEW `83175bcc`, TEST `f0a86688`, PRODUCTION `2c2e3236` 유지. 세 환경 모두 Workers.dev/Version preview URL 스위치 ON, 사용자 지정 도메인·라우트 없음. 인증되지 않은 제3 Worker의 Service Binding 호출과 in-flight write는 화면만으로 입증하지 못한다. 구형 Worker를 안전하게 막는 Cloudflare 제어는 **이번 PR에서 수행/구현된 것이 아니며 LIVE NO-GO**.
- **마지막 클릭 보존:** R2 pending 내용 전체를 무작위로 중복 제거하면 보라→회색→보라 세 번째 색상 클릭이 지워지는 위험을 수정. **오직 마지막 pending과 현재 요청이 연속·동일할 때**만 HTTP 503 반복시도 중복을 줄인다. 같은 mutationId 다른 payload는 여전히 오류, 서로 다른 실제 클릭 순서는 모두 남긴다.
- **한정 R2 회수 도구:** `listCatalogCutoverPendingScopes`는 앱 HTTP에 연결되지 않은 **operator-only 코드**. 명시적 외부 Writer 격리 증거를 호출자가 제공해야 하며, 일반 전체 R2 스캔 없이 `catalog/cutover/v1/` prefix만 bounded pagination으로 **두 번** 나열하여 stable 목록을 확인한다. 사용자 원본 Catalog 읽기/쓰기와 평시 호출 R0/W0. drift·손상·페이지 미완성·한도 초과·증거 부족이면 fail-closed. 해당 결과는 **R2 outbox 범위만** 증명하며 브라우저 로컬 pending 및 Cloudflare 인입 격리까지 증명하지 않는다.
- **배포 차단:** `assessLegacyIngressEvidence`에 old Worker 버전 미리보기 URL 격리 확인 조건 추가. 화면의 버전 URL은 아직 켜짐이므로 배포 가능 판정 불가. CORS와 직접 Workers.dev 도메인 미차단 상태에서 '안전'하다고 표시하지 않는다.
- 이 작업으로 구형 Worker에 대한 전역 쓰기 권한을 제거하거나 무중단 전환을 **완성한 것은 아니다**. 서버 설정·권한 변경 없이 이전에 배포된 코드를 바꿀 수 없으며, 같은 곡 충돌 해결·전역 클라이언트 pending 가시화·안전한 rollback artifact·실기기 동기화가 미완료. PR #743 Draft, 미병합·미배포 유지.

## 2026-11-04 — 실제 적용 최소화 후보 및 단일 통합 배포 경로
- **배포될 Worker 코드:** 기존 GET/Bootstrap/Delta 경로 유지, PR #743 색상 gray/null 보존 수정만 적용. catalogCutoverOutbox.js는 오프라인 테스트용으로만 남고 index.js에서 전혀 import하지 않음. 보류 503/R2 추가 쓰기/읽기는 배포 후보에서 제거.
- **실제 배포 경로:** `.github/workflows/cloudflare-media-color-compat-rollout.yml`은 workflow_dispatch 수동 실행 전용. preview의 정확한 SHA와 별도 `DEPLOY_ALL_SHARED_MEDIA_WORKERS` 승인이 필요. 이미 공유 CATALOG=1인 세 Worker 버전과 바인딩을 Cloudflare API에서 검증하고, 3개를 트래픽 변경 없이 업로드한 뒤 순차 활성화/검증. 자동 push 배포 아님.
- **위험:** 순차 활성화 사이에 잠시 구형 Writer가 공존할 수 있고, 기존 버전의 미리보기 URL도 계속 켜질 수 있음. 이전 구형 Worker로의 긴급 복귀는 가용성 복구이지 색상 안전 롤백이 아님. 따라서 이 경로의 존재만으로 무손실 보장을 선언할 수 없으며, 실제 실행 전 해당 공유 리스크와 PRODUCTION 변경의 **명시적 승인**이 필요하다.
- 서버 설정·사용자 데이터·호스팅은 실제로 변경하지 않음. 배포 후 인증된 PC/모바일 색상 저장·해제·재접속 실사용 확인 전 완료 선언 불가.

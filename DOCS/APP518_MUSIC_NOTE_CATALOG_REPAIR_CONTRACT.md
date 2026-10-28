# app518 Music Note 원본 → 공유 Catalog 재발 방지 및 단건 복구 계약

2026-10-28 KST. 이 PR은 **안전 판단 기반 후보이며 실제 복구 완료 아님**. 사용자 원본/캐시/Rules/Functions/R2 배포 변경 0.

## 실제 확인된 사항
- 로그인한 소유자의 정확한 Firestore favorites 문서가 존재하고 저장 활성: 예.
- 인증된 공유 R2 Catalog는 존재하나 정확한 item.id가 누락: 예. 보고된 revision: 1792973560426.
- 원본 PC Music Note 행은 있으나 PC 로컬 Catalog도 같은 ID 누락.
- 과거 누락의 단일 원인 미확정. 실제 소스에서 App.tsx의 writeFavoritesCache → scheduleCatalogSnapshotPublishIfDirty는 메모리 변경을 기록할 뿐 서버 POST를 즉시 보장하지 않음. pageSyncCoordinator.ts에서 페이지 종료·명시적 동기화 시 handlers.flush 이후 flushPendingCatalogPublishes를 호출하는 구조. scripts/verify-081-page-exit-batch.mjs는 의도적으로 Catalog 전송 타이머 금지를 검사함. 앱 종료/전송 실패 뒤 미반영 상태를 서버에서 재시도한다는 보장은 없음. 이 기존 동작을 단순 타이머 추가로 바꾸면 구형 스냅샷 역전 위험이 있으므로 금지.

## 구현한 부분
- cloudflare/media-worker/src/catalogCanonicalFence518.js: Firestore 검증된 updateTime 나노초 비교, owner UID/문서 ID 확인, 영속 tombstone 전제, 오래된 save 이벤트/중복/동일 버전 충돌 fail-closed.
- scripts/verify-518-canonical-fence.mjs: save A → remove B → 늦은 save A, 중복 이벤트, 더 최신 save C, 다른 UID/ID, 기록 없는 늦은 이벤트 등 회귀검사.
- 안전을 위해 활성 R2 delta endpoint 및 기존 UI·클라이언트 쓰기 경로와 연결하지 않음. **병합하더라도 사용자 곡은 복구되지 않음.**

## 후속 필수 구현·검사
1. 브라우저 Date.now / R2 revision 아닌 실제 Firestore source updateTime만 이용. 원본 소유자·정확 ID·저장/해제 상태를 서버에서 증명.
2. 서버에 지속되는 per-document version + delete tombstone + 실패 재시도. Firestore와 R2는 서로 다른 시스템이므로 단순 GET→PUT 또는 두 번의 R2 PUT를 원자적이라고 주장하지 말 것.
3. 기존 앱의 /v1/catalog/musicNote/delta는 브라우저 스냅샷을 보낼 수 있으므로 기존/신규 PC·모바일 writer가 공통 버전 보호를 우회하지 않도록 호환 전략 필요. 구형 정상 기능을 무단 중지하지 않을 것.
4. 확인한 곡 1건만 본인 인증 서버 정본을 **복구 직전 다시** 확인하고, 위 순서 보호를 통과한 경우에만 서버 변경 허용. 다른 곡 조회/전체 목록 재생성/강제 하트/캐시 삭제 금지.
5. 기존 Studio 30초 canonical W1/W0, 즉시 RTDB 보임, pending/미디어·Library·Explore 정상 동작 유지. 변경 없는 방문 R0/W0, 한 곡 변경만 O(1).
6. 탭 종료·오프라인·서버 실패·동시에 저장/해제/재저장·구형 브라우저·로그인 변경·비용·TEST/PRODUCTION 호환을 코드와 CI로 검증.
7. 공유 서버·실제 데이터 변경/배포는 별도 승인. app515 V2 폴더 PR #512 HOLD 유지.

## 완료 기준
- [x] 원본/R2 실측 누락 증거
- [x] 정확한 서버 버전 비교·삭제 tombstone의 fail-closed 순수 안전 기반
- [ ] 서버 durable outbox 및 공통 구형 writer 보호, 재시도
- [ ] 소유자 승인 후 정확한 곡 1건만 복구할 서버 실행 경로
- [ ] PC A/모바일 B/새 PC C 일치, 비용 실측
- [ ] 최종 독립 감사·PREVIEW 배포

기술적으로 어려운 남은 항목도 원래 합격 기준에서 제외하지 않는다.

## 2026-10-28 비용 최소 우선안 — 연결 전 검증 설계

### 기존 기능을 그대로 두는 변경 감지 경계
- 최근 생성곡→Studio 하트: 기기 즉시 보임, 같은 계정 다른 기기 RTDB 즉시 보임, 마지막 클릭 뒤 30초 per-song Firestore canonical 최종 저장 W0/W1 **그대로**. page entry / navigation / new browser load는 새 Functions/R2 요청이 발생하지 않아야 함.
- 공개·비공개: 기존 Explore publication 서비스·Worker·권한·revision 구조 변경 금지. 다만 Music Note Favorites 문서의 `isPublic` 등 Catalog 포함 필드가 바뀐 경우 그 목록 변경은 필터 대상에서 빠뜨리지 않음.
- 다음곡에 적용: ExplorePage/GlobalPlayer/Studio handoff/가사·프롬프트 키워드 서비스 변경 금지. Favorites의 `appliedKeywords` 같은 목록 포함 필드가 실제 바뀌었을 때만 파생 목록에서 반영.
- Media/Suno·색상·폴더·잠금: Worker 실제 `MUSIC_NOTE_CATALOG_FIELDS` allowlist와 이벤트 비교 대상이 같아야 하며 누락/불필요한 전송을 막는 단위 테스트 필수.
- 이미 존재하는 `pageSyncCoordinator`의 전송 실패·pagehide 보장만으로 canonical→R2 delivery가 보장된다고 해석하지 않음. 새 비동기 워크플로가 실패해도 기존 저장 W1을 실패로 보이게 하거나 UI를 뒤로 되돌리지 않는다.

### 서버 작업 제안 및 수량(확정 전 목표, 실측 아님)
1. 공유 Firebase Firestore `favorites/{id}` **이미 발생한** 실제 canonical write에만 반응하는 단일 변경 이벤트. 하트 클릭 자체가 아니라 30초 묶음 저장 결과에만 이벤트 발생. Functions 이벤트 호출은 변경된 모든 관련 문서 write마다 발생할 수 있으므로 **단순 UI/메타데이터 업데이트도 호출 0이라고 주장하지 않는다**.
2. 기존 Catalog `projectCatalogFields`의 목록 표현이 전후 동일한 이벤트는 **후속 Firestore 읽기 R0, R2 W0**, Function이 종료. UI/다음곡 임시 데이터로 Catalog를 생성하지 않음.
3. 목록이 실제 바뀐 경우, 늦은 이벤트 after-image를 그대로 게시하지 않고 **소유자·정확 ID의 현재 Firestore 문서 R1 단건 읽기**로 재확인; 최신 source updateTime과 삭제/숨김 상태를 확정하고 순서 기록 검사.
4. 기존 공유 R2 per-user journal/head ETag CAS 경로 재사용 검토. 목표: 변경당 R2 GET 1~3 / PUT 1, 충돌·컴팩션 때만 추가 읽기·쓰기. 새로운 상시 실행 서비스/전체 목록 스캔/두 번째 Firestore 기록을 처음부터 추가하지 않는다.
5. 단, R2 Journal에 sourceVersion·영구 tombstone을 원자적으로 함께 보존하는 구조와 구형 Worker/browser writer 차단 없이는 이 경로를 **절대 배포하지 않음**. 현재 pure helper는 이 조건의 검증 일부일 뿐이다. R2 head 크기 상한·compaction 후 tombstone 지속성·기존 legacy writer 호환에서 안전한 O(1) 방법이 실패하면 별도 영속 기록(추가 R2 PUT 또는 Firestore W1) 비용을 비교하고 디렉터 승인 후 설계 변경.
6. Failure injection: Function 적어도 한 번 호출, 중복·역순, Cloudflare 409/5xx, 네트워크 지연, Firestore delete, 기존 Client delta overwrite, 30초 save→unsave→save, R2 compaction, HOSTING/Workers 간 구버전 혼재. 무한 재시도/전체 조회로 비용·데이터 위험을 키우지 않고 P1이면 FAIL.

### 공식 단위 요금에 따른 추가 과금 민감도
- Cloudflare R2 Standard: Class A PUT **$4.50/100만**, Class B GET **$0.36/100만**; 한 변경 R2 PUT1+GET1~3이면 R2 사용량 총액 **$4.86~$5.58/100만 변경**(무료 티어와 다른 트래픽은 별개). PUT2라면 **$9.36~$10.08/100만**.
- Firestore 추가 정확한 단건 읽기 R1: 미국 중부 Standard 표기 **$0.30/100만**(현재 문서 기준); 실제 Seoul/asia-northeast3, 계약·DB Edition 청구요금은 별도 확인. 추가 W0 목표이므로 canonical 원본 W1 기존 비용은 *증분에서 제외*. 신규 영속 로그 W1이 필요하면 Firestore 추가 요금 및 인덱스 저장을 다시 산출해야 함.
- Functions 이벤트·Worker requests/CPU·R2 저장 용량·에러 재시도/충돌·네트워크는 위 R2+Firestore subtotal에 포함되지 않음. 사용자 전체 계정수보다 **월 실제 확정 변경건수**가 결정요소.
- 10만 사용자가 1일 1번 *최종 저장 상태*를 변경하여 월 300만 건이면 R2 PUT1, GET1~3 가정 사용량 gross **$14.58~$16.74/월 + Firestore R1 미국중부 표준표 가정 $0.90 + 함수/Worker/저장·재시도**. 무작정 클릭당 배포하면 이보다 비싸짐. 실제 청구금액은 무료 한도/동일 서비스 트래픽/지역/실패율에 따라 달라짐.
- 비교 시 A: 기존 client-only(추가비용 최소·실제 사용자 누락 재현) / B: Firestore event → 현재 R2 journal CAS + 최소 펜스(우선) / C: Firestore outbox 문서 W1 + 별도 원장(추가비용/운영 증가, **B가 안전하지 않을 때만**)을 같은 부하에서 비교. A는 기능 불합격이므로 비용이 적다고 복귀하지 않음.
- 공식 출처 확인 2026-10-28: https://developers.cloudflare.com/r2/pricing/ , https://firebase.google.com/docs/firestore/pricing , https://firebase.google.com/docs/firestore/standard-edition

### 실제 수정 단계 및 상태 구분
- **지금 완료:** 소스-only 버전 펜스, 의미 있는 field-change/no-op 판별 helper, 비용 목표 및 기존 기능 회귀검사. 실제 기존 애플리케이션 호출과 연결하지 않았음.
- **남음:** Function 트리거·Worker 최종 단건 read/ETag CAS+영구 tombstone·server→server 인증·모든 환경 legacy writer 호환/순서 보호, 반복 실패 복구 및 월 청구 실측.
- **배포 허용 조건:** 독립 감사 PASS와 공유 Firebase 기능·Worker 별도 배포 승인. PR #528을 단독 병합해도 Music Note 누락곡은 복구되지 않음. 사전 실사용 PASS나 비용 실측으로 보고 금지.

## 2026-10-28 추가 구현 — single journal-head CAS 시뮬레이션 (프로토타입)

- `catalogJournalReconcile518.js`: 기존 R2 journal HEAD 조건부 PUT(ETag)의 하나의 객체 안에 **Catalog delta + per-document Firestore sourceVersion/tombstone**을 함께 저장하는 순수 의존성 주입형 백엔드 프로토타입. 새 Firestore 원장 문서 W1을 기본설계에 추가하지 않음. 실 Worker에서 import하지 않음.
- `verify-518-journal-cas-simulator.mjs`: 가짜 base/journal/ETag/Firestore R1로 저장→삭제→구형 save 재전송, 중복 삭제, compaction 후 tombstone 유지, 공개 전환, CAS 충돌 후 원본 재조회, 타 계정 거절을 검증. **실제 Firebase/R2 네트워크 요청 없음.**
- 원장 용량: 현재 Journal HEAD 바이트 한도 768KiB는 곡별 기록이 매우 많은 계정에서 포화될 수 있음. 프로토타입은 한도에서 **안전 거절**하므로 아직 모든 사용자에게 정상작동하는 해법이 아님. base/journal 컴팩션 후 버전·tombstone 보존 및 기록 규모 테스트가 먼저 필요. 삭제곡을 몰래 살리는 자동 재생성/오래된 클라이언트 fallback 금지.
- 실제 업데이트 경로에서 과거 앱/Worker가 `sourceLedger518` 검사 없이 같은 HEAD에 delta를 넣으면 보호를 우회할 수 있음. **PREVIEW, TEST, PRODUCTION의 shared Catalog writer 전체**, 앱 버전 혼합 및 release rollback을 감사하기 전 사용 금지.
- 매번 Firestore를 읽는 방식이 가장 싸다는 뜻도 아님. source snapshot과 event 버전만으로 안전하게 공통 순서를 보증할 수 있으면 R1 절약 후보이지만, 초기 원장 없는 경우와 역순/동시 이벤트에서 잘못된 곡이 되살아날 위험이 없어야 함. 지금은 기능을 우선해 변경된 곡의 정확한 서버 R1을 가정.
- 실제 함수 트리거, 서버 간 인증, 영속적인 실패 재시도, PR #528 재사용, 주간 비용/악성 반복 제한, 실기기 혼합 호환 등은 **여전히 미완료**. 확인된 누락곡 1건에 대해서도 현재 쓰기 0건.

## 2026-10-28 독립 감사 FAIL 후 실제 위험 격리 / 변경 승인 대기

**기준:** 감사 SHA 1cd2d9e5 FAIL (P1-1 legacy delta bypass, P1-2 rebuild reset, P1-3 768KiB head saturation, P1-4 retry not durable, P2-1 O(N) materialization). CI PASS는 실제 서버 연결 합격이 아님.

### 수정 후보: 서버 경로 보호 (실서비스 OFF)
- `catalogAuthorityPolicy518.js`: head 권한 상태 판별. migrated HEAD는 구형 browser delta, legacy MEDIA seed, canonical 전체 재구성 모두 fail-closed. 현재 Migration 전 HEAD는 이전 동작 허용.
- `cloudflare/media-worker/src/index.js`에 실제 legacy /delta 및 /bootstrap 재구성 경로의 안전검사를 **후보 브랜치에만** 연결. `SORIDRAW_CANONICAL_CATALOG_518=ENABLED_AFTER_SHARED_ROLLOUT`가 있어야 신규 동작을 차단하되, 플래그 없어도 이미 펜스된 HEAD는 구형 delta/rebuild로 덮어쓰지 못하게 설계. `wrangler.jsonc`의 PREVIEW/TEST/PRODUCTION에는 **플래그가 없고** 기존 Worker는 미배포.
- 3개 서버 Worker가 같은 **공유** R2 Catalog를 쓰므로, PR 병합만으로 플래그를 켜면 안 된다. 반드시 테스트·정식 환경의 구형 Writer까지 모두 업데이트한 다음, canonical delivery/retry 활성 상태와 혼합 환경 정합성 검증이 필요하다.
- 위험 차단 정책은 **동기화 경로를 제공하지 않으므로 완성/배포 금지**. 오래된 클라이언트에 409만 주는 활성화는 사용자 저장은 Firestore에 되더라도 Catalog 동기화 실패를 일으킴.

### 현재 R2 HEAD 방식은 P1-3/P2-1 기능 합격 불가
- `sourceLedger518`를 한 HEAD 안에 무한히 늘리면 768KiB 도달 시 정상 저장을 거절한다. 영구 삭제 tombstone을 무단 제거하는 크기 절감은 기능 위반.
- 현재 `catalogJournalReconcile518.js`는 `materializeCatalogJournal`로 전체 base+delta를 읽고 목록 Map을 구성하므로 곡 1건당 처리 비용이 사용자 총 곡 수에 비례함.
- 이 모델은 삭제곡 부활 방지의 순서 실험용으로만 유지. **프로덕션 채택 후보에서 제외**. `verify-518-head-capacity-redteam.mjs`에서 실제 saturation 수치 표시.

### 권장 구조 변경안: 작은 D1 행 + 기존 R2 Journal (아직 미승인)
- **기존 Firestore favorites canonical W0/W1 및 30초 배치, RTDB 즉시 UI, 앱·Explore·Library·공개·다음곡 경로는 수정하지 않는다.**
- 서버 Firestore 변경 이벤트는 목록 투영에 실제 차이가 있을 때만 R1 정확 조회 후 진행; 이벤트 함수 호출 자체는 빈 변화에서도 발생할 수 있다.
- **전용 Cloudflare D1**에 `(uid,exactDocumentId)`별 최신 Firestore source version, saved/removed tombstone, 마지막 R2 ACK, retry state를 행 하나에 저장. 변경 감지 이벤트·outbox가 한 DB 트랜잭션 안에서 durable 해져야 한다. D1은 원본 Firestore 대체물이 아니라 Catalog 파생 복구용.
- R2 Journal은 서버가 확인한 **변경곡 하나**만 delta/CAS. 기존 HEAD 전체 목록 materialize를 hot path에서 제거하고 D1 item membership으로 itemCount를 갱신. 충돌 시 항상 D1 최신 버전 + Firestore 원본 정본을 확인.
- R2 성공 후 DB ACK 실패하면 pending을 유지하고 다시 처리; 중복이면 같은 mutationId/버전으로 안전하게 ACK. 인증 불명·다른 계정·서버 장애는 task 폐기 금지, 재시도/관리자 관찰 필요. 원본 없는 삭제 역시 tombstone 유지.
- 정상 페이지 열기/탭 이동은 신규 DB read/write 0. 실제 canonical 변경 시 D1 행 쓰기 **예상 W1 접수 + W1 확인(2행/변경)**, 현행 Firestore favorites W1 외 **추가 Firestore W0 목표**. 함수를 쓴다는 이유만으로 기능당 0달러라고 단정하지 말 것.
- 최종 복구 전에 계정 소유자의 기존 `먼 길을 돌아온 밤` Firestore exact 단건을 새로 확인한 뒤, D1 최신 버전/원장과 비교하여 해당 ID만 처리. 전체 favorites 스캔/캐시 초기화 금지.
- 실제 운영 전 D1 DB 생성, Cloudflare Worker binding, 서버 인증·예약 재시도 및 shared 3환경 rollout은 **별도 명시 승인**. 기존 Explore D1과 무턱대고 합치지 않고 격리·마이그레이션 비용 비교.

### 공식 단가/비용 비교 (확인 2026-10-28)
- 공식: https://developers.cloudflare.com/d1/platform/pricing/ 와 https://developers.cloudflare.com/queues/platform/pricing/
- Workers Paid D1: 월 5,000만 rows written, 250억 rows read, 5GB storage 포함. 초과시 $1/100만 rows written; $0.001/100만 rows read, $0.75/GB-month. Workers Free는 10만 rows written/일 등 일일 한도가 있으며 초과시 정상 처리 차단 가능. 실제 플랜·기존 사용량·저장 용량은 **미확인**.
- 가정: 10만 사용자 × 일 1회 변경 × 30일=월 300만 확정 변경. D1 W2/변경은 약 600만 rows written; 유료 포함량 안일 가능성이 높지만 **사용량 전체를 합산해야** 하므로 추가 청구 0달러는 미확인. R2/Functions/Worker/Cloudflare Queues, 재시도, 계정 데이터 저장 비용 별도.
- R2 단독 HEAD는 추가 D1 비용이 0이어도 기록 포화+O(N)+구형 Writer 복원 위험이 남아 **기능 기준 불합격**. 이 설계로 배포하지 않는다.
- 더 싼 기존 D1 재사용이 실제 격리·권한·용량·트랜잭션 기준을 통과하는지 별도 평가. 신규 D1이라도 기록/용량/작동 비용을 재검증하고 변경 승인 필요.

### 단계별 남은 합격 기준
- [x] 구형 Writer/재구성 덮어쓰기 방지용 서버 후보의 기본 OFF 스위치와 검사
- [x] 현재 HEAD 단독 방식 비용·용량 위험 노출 검사
- [ ] **D1 기반 O(1) 행 원장+영속 outbox** 구현·실패/재시도·동시성 검증 (설계 변경 승인 필요)
- [ ] 실제 shared PREVIEW/TEST/PROD 구형 Worker 경로 정리 및 구형 앱 호환
- [ ] 관리자 정확한 곡 1건 복구, PC·모바일·새 PC 확인, 실비용 계측
- [ ] 독립 감사 PASS, 코드 병합 및 별도 명시 배포 승인

## 2026-10-28 디렉터 승인: D1 소규모 영속 원장 구현 — 코드 단계

**승인 범위:** 기존 R2 HEAD 무제한 원장 방식에서 D1 곡별 행으로 전환. 코드/검사/GitHub PR까지, **Cloudflare D1 생성·마이그레이션 실행·Worker/Functions 배포·실제 사용자 곡 쓰기는 별도 승인**. 현 배포는 이전 app517 그대로.

### 실제 추가된 코드 (미연결, inactive)
- `cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql`: (owner_uid, favorite_id) PK의 단건 D1 행. 고정 21자리 Firestore UTC nanosecond version, saved/removed 상태, ACK version, 횟수/다음 재시도 시각. due 인덱스는 미완료 행만 포함. 개인 곡 제목·프롬프트·가사·미디어·본문 저장하지 않음. 실제 DB에 **한 번도 적용하지 않았음**.
- `cloudflare/media-worker/src/catalogD1Outbox518.js`: 확인된 버전만 조건부 upsert, 오래된/동일 버전 W0, ACK은 동일 R2 verified source version에서만 확정, 실패는 백오프(5초~1시간)·시도횟수 조건으로 중복 재예약 W0, 배치 due 1~256, 관리자 단건 확인. 저장 상태가 변하지 않은 UI 조회에는 호출하지 않음.
- `cloudflare/media-worker/src/catalogDelivery518.js`: D1 미완료 곡의 **Firestore 정확 단건 원본 재확인 → 구형 정보면 현재 버전 D1 재접수 → R2 CAS·소유·버전 증명 필요 → D1 ACK** 절차. 실패는 D1 retry_at에 보존. 이전 버전 응답의 ACK은 최신 미완료 변경을 지우지 못함. 이 코드는 아직 실제 Firestore Admin/R2 호출 공급자, 예약 실행, API에 연결되지 않았음.
- `scripts/verify-518-d1-outbox-sql.py`: SQL을 직접 추출해 SQLite 메모리 DB에서 실제 UPSERT, 삭제 tombstone·늦은 저장·중복 ACK/재시도/소유자 격리/부분 인덱스 실행.
- `scripts/verify-518-d1-outbox-adapter.mjs`, `verify-518-d1-delivery-drain.mjs`: 인증되지 않은 삭제/다른 사용자/뒤늦은 이벤트/불명확한 R2 응답/서버 재시도·중복 상황 검사. 기존 app204 다음곡, app203/356 공개 상태, app349 하트·Suno, app280 부활, app031 묶음 저장 회귀 유지.

### 비용 목표 (실환경 비용 실측 아님)
- 한 번 확정된 의미 있는 변경에 D1 **접수 W1 + R2 확인 후 ACK W1**, R2 CAS GET/PUT, Firestore 정본 R1, 서버 함수 실행 1회+후속 처리 요청. 실패시에만 추가 D1 재예약 W1. 동일/오래된 확정 변경 W0.
- 미변경 앱 진입·탭 이동은 신규 D1 R0/W0. 그러나 기존 favorites 문서가 변경되기만 해도 Firestore 이벤트 Function 호출비가 생길 수 있으므로 호출비까지 0이라고 주장하지 않음.
- 10만 계정 × 매일 1회 최종 변경 × 30일 = 월 300만 건 → **D1 정상성공 행 쓰기 약 600만**. 다른 D1 사용량과 포함 티어, R2·Firestore·Functions·Worker·재시도·저장량 비용 별도. 실제 10만 명 시 장애·파동 부하까지 미측정.

### 독립 감사 FAIL 중 미해결 / 절대 배포 금지
1. **DELETE의 정본 순서:** 문서가 완전히 삭제된 경우 Firestore exact read는 `updateTime`을 제공하지 않음. 삭제 이벤트의 실제 서버 커밋 순서를 인증할 수 있는 설계 또는 구형 앱과 호환되는 서버 soft tombstone 보증이 필요. 원본 없는 상황에 현재 시간이나 오래된 이벤트의 timestamp를 임의로 붙여 살려내면 FAIL. 현재 모듈은 안전하게 거부·재시도하지만 모든 구형 삭제에 대한 정상 동기화는 **아직 불완전**.
2. **R2 단건 CAS provider:** 실제 shared R2 HEAD는 구형 source fence를 모르는 클라이언트와 여러 Worker가 기록 중. 배포용 공통 writer 검사·구형 단말 호환·수정된 단건 변화의 인덱스 기반 itemCount를 입증하지 못하면 서버 연결하지 않는다. 기존 R2 whole-base materialize O(N)도 아직 제거 안 됨.
3. **영속 예약 실행:** D1 pending/next_attempt 기록은 구현했지만 scheduler/Function→Worker 인증·검증된 R2 적용자 미연결. 데이터 동기화 완료라고 보고하지 않음.
4. **용량/마이그레이션:** 초기 기존 R2 Catalog 목록을 D1 membership에 어떤 비용/권한으로 인덱싱할지 결정 필요. 전 사용자 전체 favorites 조회·백필, 데이터 일괄 수정 금지. 기존 D1 Explore와 공용 사용 승인 없음.
5. **실행형 검증:** Firestore hard-delete, 버전 충돌/중복·동시 서버 실행, D1 transaction 실패, Cloudflare Worker 요청 상한, 10만 사용자 성능/비용, PC·Android·새 PC 기존 캐시, TEST/PROD 구형 배포 검증이 필요.
6. PR #528 Draft HOLD. **현재 성공한 테스트는 로컬/CI 모의 검사로 실제 운영 장애가 해결된 것이 아님.** P1 미완료 시 어떠한 DB 생성·공유 API 배포·실제 곡 재저장도 금지.

### 남은 구현 순서
- [x] D1 정확 행 원장/SQL, pending 재시도·버전·ACK 계약 및 자동검사
- [ ] 서버 측 hard-delete와 soft-delete 최신 순서의 공통 인증 규칙
- [ ] 기존 shared Catalog에서 1곡만 갱신하는 영속 R2 writer와 중복/구형 호환
- [ ] 실제 변경 이벤트→서버 인증→D1→R2→ACK, 실패 시 예약 재실행 연결
- [ ] 단건 복구를 위한 현재 원본 재확인/실사용 인증 흐름, 비용·PC/모바일 QA
- [ ] PR 독립 재감사 PASS 후 디렉터 별도 인프라·배포·원본 1건 복구 승인

## 2026-10-28 첫 저장 변경 시 R2→D1 색인 후보 — 코드/검사 승인 범위

- 디렉터 승인 범위: 기존 R2 Catalog를 **계정의 첫 실제 확정 변경 시 한 번만** 읽어 D1 exact-song membership을 만든다는 방식의 소스·검사. 가입/진입/탭 이동/새로고침/전체 계정 배치 백필 금지. D1 생성·SQL 실제 적용·Firestore/R2 실제 쓰기·배포 모두 금지.
- `cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql` (미적용): `owner_uid`별 `building/ready`, 처음 본 R2 HEAD revision/ETag/expectedCount, 곡별 `(uid,generation,favoriteId)` 색인. 곡 본문·가사·프롬프트·미디어는 D1에 복사 안 함.
- `catalogFirstChangeIndex518.js`: **서버가 인증한 의미 있는 저장곡 변경**에서만 정확한 사용자의 R2 materialized Catalog 1회 + 최종 HEAD ETag·revision 재확인 1회. ID 누락/중복/용량 초과/다른 사용자/미완전 Catalog는 색인하지 않음. D1 128행씩 batch의 원자적 stage, 모든 행 개수가 일치하고 R2 HEAD가 변하지 않았을 때만 ready로 변경. 도중 충돌/탭 종료/프로세스 종료는 building 유지, 동일 HEAD 재시도로 idempotent 수렴. 다르게 바뀐 HEAD는 임의 초기화하지 않고 fail-closed.
- 비용: 최초 성공한 실제 변경 1회에만 D1 기존 outbox 외 **색인 N곡 + metadata 2행 쓰기 (W=N+2)**. 예: N=301이면 약 W303, N=10,000이면 약 W10,002. R2 full snapshot GET 1, HEAD 검사 GET 1 및 D1 batch·결과 확인 추가. N이 20,000 초과인 계정은 **FAIL-CLOSED**(운영 전 페이지 단위 스트리밍/연속성 대안 필요). 실패/경합에서 재읽기·재시도 비용이 추가될 수 있으며 운영 실측 아님. 매 변경마다 O(N)이란 뜻은 아님.
- `readIndexedMembership518`: D1 점 조회는 동일 R2 HEAD revision·ETag·itemCount와 일치할 때만 허용. 그 HEAD를 실제 R2 conditional CAS의 **그 순간**에 재확인하는 공통 서버 Writer는 **아직 없음**. D1 ready 이전 일부 stage를 membership false로 해석 금지.
- **중요 미완료:** R2 성공 후 D1 membership/metadata 갱신을 서로 다른 저장소에서 원자적이라고 주장하면 안 됨. 이 재수렴·실패 복구 경로를 구현하지 않으면 첫 변경 이후 HEAD가 움직여 색인이 낡고 다음 변경이 막힐 수 있음. 구형 Writer 전체 차단·mixed-preview/test/prod·compaction 안전성도 남아 있음. 실제 배포 불가.
- `catalogRemovalAuthority518.js`: 현재 Firestore exact 문서의 서버 updateTime이 있는 **soft-delete만** 원본 버전으로 허용. 구형 `deleteDoc`은 문서와 updateTime을 없애므로, event.before.updateTime이나 브라우저 시각을 삭제 커밋으로 위조하지 않음. **HOLD_HARD_DELETE_NO_COMMIT_VERSION**로 보호하며, 구형 영구 삭제를 끝까지 동기화하는 기능은 아직 미완료.
- 검사: JS mock D1 batch/중단/다른 UID/HEAD 이동/정상 첫 색인/재진입 R0/W0 + Python SQLite 실제 D1 SQL 인덱스/중복/상태 전환/계정 격리 + soft/hard delete 권한. 기존 다음곡·공개·하트·Music Note·Library 제품 회귀/TypeScript 검사는 별개로 지속.

**합격 상태:** 최초 색인 코드·가상 테스트 후보만 구현. D1 실제 연결, 구형 hard-delete 안전 처리, 증분 membership 동기화, 원장 재시도 스케줄러·R2 실제 정확 CAS, 배포·실사용·원본 1건 복구/확정 비용 **모두 미완료**. 기존 PR #528 Draft HOLD.

## 2026-10-28 곡별 증분 반영 + R2 성공 후 D1 실패 복구 — 코드/검사 단계

- `music_note_catalog_index_meta_518`에 변경 가능한 `indexed_revision` 열 추가. 처음 색인한 `generation`은 고정하므로 한 곡 변경마다 기존 곡 N개의 D1 색인을 복사하지 않음. 첫 색인 SQL/test도 함께 수정. **기존 실제 D1에는 이 SQL을 실행한 적 없음**.
- `catalogIndexAdvance518.js`: owner·R2 HEAD·공유 3환경 writer fence를 서버가 검증한 경우에만 최신 R2 HEAD의 **아직 D1에 반영되지 않은 제한된 delta 구간**을 재생. 각 변경의 `canonical518:<exactId>:<21자리 sourceVersion>`가 정확한 D1 source outbox 버전/상태와 일치하는지 확인, 각 delta의 itemCount·revision 연속성을 검사. 기존 D1 member 한 곡 조회 + 메타 갱신, D1 batch 트랜잭션 내부 이전 HEAD revision/ETag/count 검증; 충돌 시 오래된 index를 쓰지 않음.
- `catalogIndexedWriter518.js`: Firestore exact 원본·D1 pending 버전·소유자 검증 → 일치하는 R2 HEAD에서 해당 곡 delta만 구성 → ETag 조건부 PUT → journal tail로 D1 index 복구 → 최신 R2 HEAD에서 같은 mutation이 실제 확인되고 D1 membership 상태까지 같아야 완료 신호. R2 성공 뒤 D1 batch 실패 시 **ACK 금지**, 다음 재실행은 과거 R2 PUT를 반복하지 않고 journal tail로 D1만 복구. R2 PUT 충돌은 최대 3번 최신 Firestore/D1/R2 재조회 후 재시도.
- `verify-518-index-delta-recovery.mjs` / `verify-518-indexed-writer.mjs`: R2 성공/D1 실패→중단→재실행, idempotent W0, 3환경 구형 writer 미차단, compaction으로 필요한 delta가 지워짐, 다른 버전/사용자, D1 동시 충돌, itemCount 불일치, R2 CAS 충돌을 실제 순수 코드와 mock D1로 재현. 기존 app204 다음곡/203 공개/356 실패 복원/349 하트/280 삭제 부활/031 묶음저장 회귀 보호 유지.
- **증분 비용 목표 수정:** 정상 변경 1건에서 기존 outbox D1 W1 접수 + W1 ACK 외에, 인덱스 메타 `indexed_revision/ETag/count` W1, membership가 실제 추가/삭제되는 경우 곡별 행 W1. 즉 **D1 W3(기존 곡 내용 변경) 또는 W4(실제 곡 추가/삭제)**가 목표. 재시도/동시 충돌은 추가 D1/R2 읽기·쓰기가 발생할 수 있음. R2 HEAD GET/CAS PUT, Firestore 정확 R1, Functions/Worker 실행 비용 별도. 앱 진입/페이지 전환 신규 R0/W0 유지. 한 번만 실시하는 첫 색인 W=N+2는 별도.
- **남은 배포 차단 사유:** (1) 공유 PREVIEW/TEST/PRODUCTION 모든 구형 Writer가 canonical source fence를 적용한다는 근거 없음, (2) 기존 hard-delete 문서의 최신 삭제 커밋 버전 보장 없음, (3) 전체 journal compaction 후 이전 D1 색인에서 이어지는 delta가 사라진 경우 자동 재색인/복구 경로 미완성, (4) 실제 Firebase 변경 이벤트·서버 인증·R2 HEAD ETag provider·D1 예약 재시도 미연결, (5) >20k 곡 색인·대량 동시 변경 실측 안 됨. source helper만 PASS이며 실제 동기화 기능 완료 아님.
- **운영 및 데이터 상태:** 기존 app517 PREVIEW 앱·Worker 유지, PR #528 Draft·미병합, D1 생성·SQL 마이그레이션 실행/공유 Rules·Functions·Worker 배포 없음, 사용자 데이터 0건 변경. 독립 재감사 미실시.

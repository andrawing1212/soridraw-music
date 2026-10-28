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

## 2026-10-28 R2 압축 복구·구형 영구 삭제 순서 보호 — 개발 범위

**디렉터 승인:** 두 P1 위험의 코드·검사만 개발. 공유 D1/Firestore/Worker/Rules 실제 적용·기존곡 수정은 허가되지 않음.

### P1: R2 delta 압축 후 D1 색인 누락

- `catalogCompactionRecovery518.js`는 pending 변경이 있으면서 실제 서버가 **D1 색인의 indexed_revision보다 R2 baseRevision이 커졌음**을 확인한 경우에만 실행하는 비활성 보조 코드. **정확 UID·완전한 R2 BASE+HEAD·모든 환경 구형 Writer 차단 사실이 서버에서 증명돼야** 한다.
- 현재 색인 generation은 유지하면서 새로운 generation에 해당 사용자 곡 ID만 128개씩 분리해서 기록. 현재 세대는 계속 보존; **모든 ID·카운트와 최신 R2 HEAD ETag가 확인돼야** 조건부 D1 메타 교체. 중단 시 옛 색인은 원형 보존, 새 색인은 보이지 않으며 동일 R2 HEAD일 때만 재시작 가능. R2 HEAD가 중간에 바뀌면 안전 차단. 이 부분의 실제 provider/스케줄러/정확한 R2 배포 아직 없음.
- `catalogIndexedWriter518.js`에서는 일반 작은 delta 재생이 compaction gap을 명확히 보고하는 경우에만 복구를 요청. 복구 뒤에도 기존 exact Firestore → R2 조건부 쓰기 → D1 membership 확인 → ACK의 원칙을 지킴.
- 비용: 정상 곡 1건 변경은 **D1 W3~W4 목표 유지**. *압축 복구가 필요할 때만* 해당 계정 곡 N개 색인 재생성 W=N+2, R2 전체 materialized GET 1 및 HEAD 재확인, D1 bounded batch. 이 비용은 0이 아니며 장기 운영에서는 기존 journal compaction을 D1 ACK/색인보다 먼저 진행하지 않도록 조정해야 함. 이전 세대의 오래된 D1 행도 남으므로 안전한 순차 정리 방식은 남은 과제.
- 2만 곡 초과, 이미 복구 시도 중 R2 HEAD가 다른 세대로 바뀐 상태, 다른 환경의 구형 Worker가 HEAD를 수정하는 경우는 **안전 차단** 상태. 이것만으로 모든 사용자 복구가 완료된 것은 아님.

### P1: 구형 브라우저의 영구 삭제

- 확인된 제약: Firestore favorites 문서의 `deleteDoc` 후에는 최신 updateTime이 존재하지 않는다. 삭제 이벤트의 before.updateTime이나 함수 접수 시각을 삭제 커밋 버전으로 사용하는 것은 금지.
- `catalogHardDeleteReceipt518.js`·`catalogHardDeleteSource518.js`: **서버에서 실제 문서 삭제 이벤트와 이전 소유권을 확인**했을 때만 실행할 수 있는 보조 코드. Firestore Admin transaction이 본인 exact favorites 문서 부재 + 기존 receipt 이벤트 중복을 확인하고, **별도 개인용 삭제 receipt 문서에 서버가 발급하는 timestamp**를 기록하는 방식. 현재 favorites 문서를 재생성하지 않음. transaction 충돌 또는 더 최신 저장곡 존재 시 삭제 거부. transaction 후 소유자 exact favorites/receipt 상태를 다시 읽고, **receipt의 실제 Firestore updateTime**만 D1 원장의 삭제 버전으로 접수. R2 변경은 이후 별도 정확 버전 CAS에서만 수행.
- 정상 저장 및 soft-delete는 기존 updateTime을 재사용하고 추가 receipt W0. 구형 영구 삭제에 한해 **Firestore receipt W1(이벤트 중복 시 W0)** + 거래 내부 exact read·최종 확인 read·D1 처리 비용이 발생. 이 비용은 D1 W3/4와 별도이며 기존 사용자 개인정보를 receipt에 복사하지 않는다.
- 현재 코드는 의존성 주입/가상 Firebase provider 검증뿐. Firestore Admin transactional provider 실제 구현, 인증, Rules, 서버 배포, sidecar collection 정책/보관량·비용, 과거 삭제 이벤트 백필과 구형 앱 버전 혼재 검증은 여전히 **미완료**. 이벤트 도착이 여러 번/역순일 수 있으므로 이벤트 ID와 현재 exact 문서 상태 검증이 필수. 별도 승인 전 개인정보 포함된 원본/실사용자 Firestore에 기록 절대 금지.

### 실행형 검사 및 배포 차단

- 신규 `verify-518-compaction-recovery.mjs`, `verify-518-compaction-recovery-sql.py`: N=301 실제 D1 W303 모델, 중단·재시도 W0, 다른 계정/HEAD 경합, 기존 generation 무변경 및 조건부 교체, R2 전체 조회는 compaction gap일 때만.
- 신규 `verify-518-hard-delete-receipt.mjs`, `verify-518-hard-delete-source.mjs`: 삭제 이벤트 위조/중복·영구삭제 후 재저장, receipt 발급 시각과 이전 updateTime 구분, 새 저장이 나중에 오면 old delete 미적용, 개인정보 무기록.
- 기존 다음곡 적용/공개·비공개/하트·Recent/Library·app517 및 전체 제품 검사를 계속 적용. 실제 PC↔모바일 테스트, 10만 사용자 peak와 실제 서버 요금 검증은 별도.
- CI PASS라도 전체 app518 서버 동기화·확정 누락곡 단건 복구는 **미완료**. 특히 모든 환경 구형 Writer fencing, >20K/다른 HEAD 세대 복구, old index 안전 정리, 실제 Cloudflare/Firebase 서버 연결 및 독립 감사 PASS가 남아 있으면 PR #528은 Draft HOLD.

## 2026-10-28 Firebase Admin + Cloudflare 서버 연결 후보 (런타임 미연결)

### 작성·저장된 경로
- `functions/src/app518CanonicalSourceProvider.ts`: 실제 Firebase Admin SDK의 `favorites/{exactDocId}` 서버 정본 조회 R1. 서버 `updateTime`을 nanosecond 문자열로 보존. 구형 hard-delete는 트랜잭션 내 exact favorite 부재 확인 후 서버 전용 `server_music_note_delete_receipts_518`에 1건 기록; 중복 eventId W0, 재저장 감지 시 거절. `functions/src/index.ts` 또는 배포 엔트리에는 import/trigger 추가 **없음**.
- `functions/src/app518ServerTransport.ts`: Node HMAC SHA-256 서비스 요청 서명과 정확한 Firestore 단건 조회용 수신기 함수. 5분 서명 유효기간, HTTPS 요청은 실제 서버의 라우팅 계층에서만 허용. 아직 `onRequest` export, Functions Secret 설정 및 배포 없음.
- `cloudflare/media-worker/src/catalogServerAuth518.js`: 서명 원문·타임스탬프·크기·요청 형식 검증. Firebase user token이나 브라우저 입력을 서버 권한으로 대체하지 않음. 5분 내 재전송은 **서명만으로 완전히 차단할 수 없으므로** 뒤의 D1 단건 버전 멱등성 W0가 필요.
- `cloudflare/media-worker/src/catalogFirebaseFetcher518.js`: 설정된 정확 HTTPS 호스트 1개에 서버 키 서명 후 Firebase 단건 조회만 수행. URL 사용자가 지정하거나 HTTP/redirect로 전송하지 않음.
- `cloudflare/media-worker/src/catalogR2Provider518.js`: 기존 공유 `CATALOG` 버킷의 실제 Music Note `catalog/v5/<uid>/musicNote/journal.json` 키·메타데이터·ETag만 사용. 전체 환경 구형 Writer 차단에 대한 별도 서버 증거와 `SORIDRAW_CANONICAL_CATALOG_518=ENABLED_AFTER_SHARED_ROLLOUT`가 **동시에 충족**돼야 GET/ETag 조건부 PUT 허용. 인증된 1계정 Compaction 재색인은 정확한 HEAD→base→HEAD 재검증, 기타 페이지 전환 시 실행 금지.
- `cloudflare/media-worker/src/catalogServerBridge518.js`: 서명된 enqueue 요청에도 최신 Firebase 정본 버전/소유자를 재검증한 후 D1 접수; 별도 서버 호출의 pending 배치 처리 시 최초 1회 색인 → 실제 R2 CAS → D1 증분 반영/완료를 시도하는 **비활성 조립 코드**. D1 신규 binding `CATALOG_OUTBOX_518`과 HMAC Secret은 모든 환경에서 미설정.
- 신규 `verify-518-server-transport.mjs`, `verify-518-r2-binding.mjs`, `verify-518-server-bridge.mjs`: HMAC 서명 변조/만료/위조 차단, URL host pinning, R2 object 소유·ETag/조건부 PUT, 구형 Worker release gate OFF, D1 enqueue 전에 exact Firestore 판정. GitHub 검사에는 기존 Functions 패키지 의존성 설치를 명시해 신규 TS provider 컴파일 검증.

### 새 코드의 동작 비용 / 미완성
- 일반 앱 사용·진입 시 이 경로는 **호출 0, 신규 R0/W0**. 이벤트가 실제 변경을 확정해 서버에 들어올 때 Firestore exact R1, D1 변화 접수 W1, 이후 조건부 R2 HEAD·D1 증분·ACK 작업. D1 W3~W4 및 특별 hard-delete Firestore receipt W1은 전 단계의 목표치이며 실제 Billing/트래픽 미실측. 단, 회원 10만 명을 대상으로 실행 이벤트가 많아지면 Firebase Function 호출비와 R2 ETag 경합/조회비가 추가 발생할 수 있음.
- 새 사설 receipt 컬렉션은 **Firestore Rules 명시적인 client write 금지 확인, Firebase Admin 트리거 이벤트 ID·소유자 검증, 중복/역순 hard delete 처리 보완** 전까지 접근 불가. 저장 후 다시 삭제한 두 번째 영구 삭제 이벤트가 과거 receipt와 충돌하는 경우 현재 Provider는 `HOLD_OTHER_EVENT_RECEIPT`로 안전 차단한다. 정상 작동 완료라고 주장 금지.
- Firebase `onDocumentWritten/onDelete` 실행 export, Firebase↔Worker 실제 HTTP 경로, Firebase·Cloudflare Secret/환경 변수, Cloudflare D1 생성/마이그레이션, Worker cron/queue, 모든 PREVIEW·TEST·PRODUCTION 구형 shared R2 Writer 공통 fencing은 **아직 모두 미연결/미승인**. 현재 환경에 이 소스가 자동으로 활성화되는 경로 0개.
- Cloudflare R2 provider는 기존 `catalogJournal.js` 실제 스키마를 사용하지만 전체 서버 검증 전 shared 캐시/HEAD에 write 금지. 특히 D1에 ACK만 쓰고 클라이언트 표시가 자동으로 최신이 된다고 가정하지 않는다. PC↔모바일 실인증, 캐시 freshness, 삭제곡 복구·누락곡 1건도 QA 미실시.
- 사용자 승인 범위는 **코드·GitHub 검사만**. 다음은 이 정확 SHA의 독립 감사 FAIL/PASS와 배포 전 구형 Writer·인증된 실제 Firebase 이벤트 순서·실제 D1/원본 데이터 분리 등 보류 항목 검증.

## 2026-10-28 P1 두 건 집중 수정 — ① 두 번째 영구 삭제 ② R2 v1 / D1 v2 복구

**배경:** 소스 사전감사에서 발견한 P1: (1) 한 문서의 `delete→save→delete`에서 두 번째 이벤트를 이전 receipt 때문에 차단, (2) R2의 이전 확정 v1에 대한 D1 반영이 실패하고 최신 D1 outbox v2가 생기면 재생을 무조건 차단.

### 변경 코드
- `functions/src/app518CanonicalSourceProvider.ts`: Firestore 서버가 제공한 delete 이벤트의 **삭제 직전 문서 updateTime**을 `beforeSourceVersionNs`라는 **세대 구별 표식**으로만 사용. 삭제 완료 시각·최종 D1 버전으로는 사용 금지. 같은 uid+문서 receipt를 Firestore Admin transaction에서 정확 읽기 후, 첫 이벤트 W1 create, **더 새로운 실제 문서 세대의 두 번째 삭제 W1 update**, 동일 eventId 중복 W0, 이전 세대 지연 이벤트 W0, 같은 세대 다른 eventId 또는 구형 무버전 receipt는 안전 보류. 현재 favorites 문서가 있으면 W0. **receipt의 서버 updateTime만** 삭제 D1 정본 버전으로 사용. 실제 Firebase 이벤트 export는 아직 없음.
- `catalogHardDeleteReceipt518.js`, `catalogHardDeleteSource518.js`: beforeUpdateTime 전달 및 receipt.beforeSourceVersionNs의 서버 검증·단조 증가 확인 후에만 D1 접수. 기존 저장곡 문서 복원/재생성 불가. Cloudflare 종속 후보에는 실기기/실서버 호출 없음.
- `catalogIndexAdvance518.js`: R2 HEAD는 모든 공유 Writer 차단이 확인된 서버 확정 journal이라는 전제 아래, D1 최신 pending source v2보다 **이전의 확정 v1**도 delta 연속성·멤버십 수량·계정·버전 단조성 확인 후 D1 index로 재생. D1 outbox 행의 버전이 R2보다 더 오래된 경우 또는 **같은 source 버전에 다른 상태**인 경우는 차단. 이후 v2는 여전히 pending이고 최신 Firestore exact 재확인 후 R2 CAS·D1 index 업데이트·ACK로 수렴. 과거 R2 v1을 최신 D1 v2로 잘못 ACK하는 일은 없음.
- `scripts/verify-518-index-delta-recovery.mjs`: R2 v1 저장 성공→D1 실패→동일 곡의 pending v2 삭제 시 과거 journal 재생→v2 삭제까지 완성 및 역순 v0 검증. `verify-518-hard-delete-receipt.mjs`·`verify-518-hard-delete-source.mjs`: 이전/더 새로운 삭제 세대, 소유권 위조/receipt 누락 W0/실제 이벤트 시각이 아닌 receipt 서버 시각. `functions/scripts/test-app518-delete-event-epochs.cjs`: 실제 컴파일한 Firebase Admin provider를 가상 Firestore transaction으로 실행, delete→save→delete 및 역순/중복 저장 W1/W0 직접 검증. 신규 검사도 app518 GitHub 집중 워크플로에 포함.

### 유지하는 위험·보호
- 신규 receipt는 구형 영구 삭제(문서가 완전 삭제된 경우)에만 Firestore W1/최신 세대당 추가 W1. 일반 저장/soft-delete Firestore 추가 receipt W0. 인덱스 회복은 필요할 때만 해당 UID의 제한된 R2 journal tail을 읽고 D1 변경. 새 page-open/polling 불필요한 비용 0.
- 독립적인 타 작업자 재감사, 실제 서비스 이벤트 인증·HMAC secrets 설정/Worker endpoint/Queue/Cron, 공유 PREVIEW·TEST·PRODUCTION 모든 구형 Writer 차단, >2만곡, 사용자 원본 1건 복구, PC/모바일 및 비용 실측은 **미완료**. 합격된 소스 테스트를 배포 PASS라고 표현 금지.
- 승인 범위: **PR #528 Draft 후보의 코드 수정·검사·GitHub 저장만**. D1 생성·마이그레이션, Firebase Rules/Functions, Worker/Hosting 배포 및 실데이터 처리 **없음**.

## 2026-10-28 독립 감사 `bf92a50c` P1/P2 최소 수정 — 배포 금지

**독립 감사:** P0 없음, P1 1건(오래된 저장 v1이 최신 삭제 v2 뒤 HEAD를 읽고 되살림), P2 1건(영구 HOLD도 매시간 D1/R2 재시도). 둘 다 아직 활성화되지 않은 app518 후보 소스의 발견사항.

- **P1** `catalogIndexedWriter518.js`: 이제 한 번의 시도마다 **R2 HEAD+ETag 취득 → 정확 Firestore sourceVersion 및 D1 outbox 확인 → 그 HEAD의 membership 확인 → 그 ETag에만 R2 CAS** 순서. CAS 충돌은 처음부터 HEAD/정본/원장 전부 재검증, 최대 3회. 새 `verify-518-stale-save-delete-race.mjs`는 실제 Writer 두 개가 `v1 저장 중단→v2 삭제 CAS+색인 업데이트→v1 재개`하는 타이밍을 HEAD 앞·R2 PUT 앞 두 방식으로 재현하고, 최신 삭제 membership 0·원장 v2 ACK·R2 PUT 1만 허용. 이전 `verify-518-index-delta-recovery.mjs`의 R2 v1 성공→D1 장애→v2 삭제 복구 검사를 함께 유지.
- **P2** 미적용 D1 schema에 `hold_reason` nullable 열 추가, 부분 due-index와 `SELECT_DUE_518`에서 HOLD 제외. `holdExactFavorite518`는 정확 `(uid, favoriteId, sourceVersion)`의 미ACK·미HOLD 행에 고정 사유만 W1 기록(중복 W0). source로부터 증명된 새로운 version이 접수되면 UPSERT로 HOLD 초기화. `catalogDelivery518.js`는 source/index 권한 및 고정 계약 실패만 즉시 HOLD하고, 일시적 통신 실패는 기존 backoff를 쓰되 최대 8회 후 HOLD. 원장 row/원본·ACK는 **삭제하지 않음**. 수동 재개는 별도 서버 관리자 승인·정본 재검증이 필요하며 일반 페이지 방문으로 재개하면 안 됨.
- **비용:** 정상 변경 경로 추가 D1 W0, R2 PUT/GET 증가 없음(단 재시도 ETag 충돌 시 원본 재확인). HOLD 최초 단건 시 D1 W1, 동일 HOLD 이후 자동 due/R2/Firestore 재호출 W0; 전역 스케줄러가 존재한다면 빈 due 확인의 기본 D1 R은 별도. 신규 sourceVersion은 정상 W1 enqueue와 함께 재개. 일반 Music Note local-first batch 및 좋아요/공개·비공개·다음곡·Library UI 변경 없음.
- 검사: `verify-518-stale-save-delete-race.mjs` 실제 두 Writer 동시 실행, `verify-518-d1-outbox-sql.py` 실제 SQLite HOLD 재조회·새 버전 재개·STALE ACK W0, `verify-518-d1-delivery-drain.mjs` 원장/스케줄 비용, `verify-518-d1-outbox-adapter.mjs` 최대 재시도 및 고정 사유.
- 이 검사는 작성자가 수행한 source+offline CI일 뿐 독립 재감사 PASS가 아님. PR Draft 유지, D1 실 적용·배포·실기기·실데이터 복구 금지. 공유 3환경 구형 Writer 차단·실서버 Firebase/Cloudflare 인증·추적·2만곡 초과/실비용 검증은 여전히 릴리스 HOLD.


## 2026-10-28 독립 재감사 FAIL 인계와 첫 색인 변경 HEAD 복구 후보

- 독립 감사 고정 SHA `65c91f488e04fdeecb9efa5d1797e20fc9fde950`: 기존 P1 삭제곡 부활과 D1 복구, 기존 P2 HOLD 반복 호출은 **소스/모의 시험 PASS**. 전체 **FAIL**: 구형 3환경 Writer 차단, 실제 서버 트리거/HMAC/D1/cron, >2만곡 처리, PC↔모바일 실측·비용이 남음. GitHub PR #528 감사 기록 참조. 이 PASS를 실제 서비스 정상으로 해석 금지.
- 첫 색인 `building` 상태에서 HEAD가 변했을 때 예전에는 무조건 중단하여 이후 같은 사용자 복구가 막힐 수 있었음. 이번 비활성 후보는 **정확 UID·완전한 서버 검증 R2 snapshot**, **더 큰 HEAD revision**(동일 revision/다른 ETag 불가), **이전 generation 미완료**, **60초 간격**, **최대 3번**을 모두 충족할 때만 D1의 `building` 메타를 1행 조건부 갱신해 새로운 generation으로 스테이징을 재시작함.
- READY 세대는 재시작·삭제하지 않고, 이전 불완전 generation의 ID들은 **보이지 않는 상태로 남겨** 향후 별도 감사된 소유자별 제한적 청소로 처리함. 이 복구 시도는 변경이 검증된 단일 owner의 실제 pending 처리에만 허용. 다른 계정/페이지 방문/권한 불명/동일 revision ETag 교체/동시 충돌은 FAIL-CLOSED.
- **비용 위험을 숨기지 않음:** 처음 색인 W=N+2 외에 안전한 HEAD 변경 재시작 1회는 **추가 메타 W1 + 새 세대 N개 ID 쓰기**가 들 수 있음. 최악 3번 제한이므로 이번 소스 후보 자동 복구는 최대 3세대 추가 전체 작성, 기존 세대의 보관 용량은 별도. 재시도 횟수 소진 후 운영자 승인 없는 반복 전체조회/쓰기 금지. 기존 일반 확정 변경 D1 W3~W4 목표와는 **다른 예외 비용**.
- 검사: JS 실제 첫 색인 실행형 mock + Python 실제 SQLite 구조 및 조건부 SQL. 기존 2만곡 초과 제한은 **해결 전까지 유지**, compaction 복구 자체의 다른 HEAD 세대 HOLD는 **아직 미해결**. 실제 3환경 D1 생성·migration·Worker/Functions/Hosting 배포·실데이터 복구 없음. 새 SHA GitHub Actions 확인 및 후속 독립 감사 필요.

## 2026-10-28 P1 압축 복구 중 R2 HEAD 이동 대응 — 비활성 소스 후보

- **원인:** `catalogCompactionRecovery518.js`는 이전 R2 HEAD 대상의 불완전 `recovery_generation`이 있으면 새 HEAD를 무조건 `HOLD_RECOVERY_TARGET_MOVED`로 끝냈다. 따라서 정상 R2 compaction/변경이 겹치면 다음 복구가 멈출 수 있었다.
- **수정 범위:** `catalogCompactionRecovery518.js`, `catalogFirstChangeIndex518.js`의 owner meta 읽기, **아직 실행되지 않은** D1 SQL, 해당 Node/SQLite 검사만 수정. 이전 정상 READY generation·곡 원본/기존 클라이언트·다른 계정·배포 파일 불변.
- **안전한 재시작:** 중단된 압축 복구가 있으면 먼저 인증된 R2 HEAD만 조회한다. 동일 HEAD/ETag이면 기존 staging을 이어 쓰고, 더 높은 HEAD revision이면 60초 이후 `recovery_restart_count < 3`에 한해 D1 `recovery_generation`을 정확 owner/기존 generation/ETag/CAS 조건으로 변경할 수 있다. 동일 revision의 ETag 교체, 구형/알 수 없는 버전, 권한 미검증·동시경쟁은 실패를 숨기지 않고 HOLD/RETRY. 새 staging 전체가 확인되고 실제 HEAD가 같을 때만 조건부 D1 READY 교체; 과거 세대는 삭제/노출하지 않는다.
- **비용과 제한:** 새 압축 복구 첫 회 `D1 W=N+2`, 이후 HEAD 이동에 따른 회전 한 번에 최대 추가 `메타 W1+새 세대 회원 ID N건`. 자동 회전은 3회 초과 금지; 이동한 HEAD가 쿨다운 중이면 **HEAD 단건 읽기만, 전체 R2 materialization 0**. 정상 곡 변경 W3~W4 목표/앱 진입 R0/W0와 구분. 옛 staging/구 READY 세대의 장기 D1 보관·안전한 bounded GC 및 실제 비용 검증은 별도 미완료 항목이다.
- **소스 검증:** `verify-518-compaction-recovery.mjs`(중단·HEAD 변경·같은 버전 변조·3회 한도·기존 세대 보호), `verify-518-compaction-recovery-sql.py`(정확한 SQL 소유권·쿨다운·회전 예산·동시 조건·READY 교체). 실제 GitHub Actions exact-SHA 결과를 별도로 확인한 후에만 코드 검사 PASS 보고.
- **남은 P1:** >20,000곡 계정 처리, 공유 PREVIEW/TEST/PRODUCTION 구형 Writer 전체 fence, Firebase↔Cloudflare 실제 Functions/HMAC/D1/Worker/cron 연동, D1 미완성 세대 정리, 실제 사용자 1곡 단건 복구·PC/모바일 일치/월 비용 측정. **기존 독립 감사 전체 FAIL·RELEASE HOLD 유지**. PR #528 Draft, migration 실행·실데이터 변경·병합·배포 금지.

## 2026-10-29 P1 전달 경로 영구 HOLD 오분류 수정 — 무배포

- 직전 소스 검토에서 발견한 두 P1은 `catalogServerBridge518.js`에서 **모든 첫 색인 실패를 `HOLD_INDEX_*`로 감싼 문제**, `catalogDelivery518.js`에서 **`RETRYABLE_INDEX_RECOVERY_HOLD_RECOVERY_HEAD_MOVED`를 영구 HOLD로 분류한 문제**. 단일 원본 버전이 유지되면 D1 outbox `hold_reason`에 고정돼 이후 R2 HEAD가 안정되어도 자동 처리에서 제외되는 위험이었다.
- 수정은 **서버 진입 브리지의 첫 색인 실패 표시를 `RETRYABLE_INDEX_*`로 변경**하고, delivery 분류에서 **정확한 `RETRYABLE_INDEX_RECOVERY_HOLD_RECOVERY_HEAD_MOVED` 한 가지만 일시적 오류로 취급**한다. 기존 `RETRYABLE_INDEX_DENY_*`, `RETRYABLE_INDEX_HOLD_*`, `RETRYABLE_INDEX_RECOVERY_HOLD_NON_MONOTONIC_RECOVERY_HEAD` 등의 영구 계약 위반은 계속 즉시 HOLD. 광범위한 HOLD 해제나 과거 outbox 자동 초기화/데이터 수정 없음.
- 실제 큐에서는 기존 `scheduleFailedFavorite518`의 **최대 8회·지수 백오프·초과 시 영구 HOLD W1**을 그대로 사용. 처음 1회 재시도 예약 외 R2 영구 실패 호출을 무제한 허용하지 않음. 정상 원본이 없거나 이전 삭제 세대가 다른 경우 R2 mutation 및 ACK 금지.
- 새 테스트는 첫 색인 HEAD 변경과 압축 HEAD 변경 오류가 **ACK 금지→예약 재시도→정확 원본 재확인→ACK** 되는지 확인한다. 진짜 불가한 원본/HEAD/예산 오류가 즉시 HOLD하고 반복 호출 0인지도 검증한다. 서버 브리지 실제 모듈 → D1 due → 첫 색인 예외 → 예약 재시도 경로도 실행형 mock으로 확인한다.
- 이 코드는 여전히 **미연결 후보**. 실제 D1 생성·마이그레이션·Firebase↔Cloudflare Secret/HTTPS/Cron/3환경 Worker 차단·기기 실제 검증 미완료. 사용자 원본·기존 PC↔모바일 동기화·캐시·PREVIEW/TEST/PRODUCTION 배포는 건드리지 않는다. **PR #528 Draft / 전체 RELEASE HOLD 유지**, 새 SHA의 CI 및 독립 감사가 별도로 필요하다.

## 2026-10-29 2만 곡 초과 계정 색인 제한 제거 후보 — 정확 R2 원본 보호

**이번 승인 범위:** PR #528 비활성 서버 후보에서 첫 색인·압축 복구의 20,000개 고정 상한 제거와 필요한 D1 원자적 페이지 기록·오프라인 실행 검사. 실제 Worker·D1·R2·Firestore 배포/원본 데이터 변경 0.

- 기존 제한은 `catalogFirstChangeIndex518.js`, `catalogR2Provider518.js`, `catalogCompactionRecovery518.js`, 아직 미적용된 `518_music_note_catalog_first_change_index.sql`의 `expected_count/recovery_count`에 분산돼 있었음. 하나만 바꾸면 20,001번째 계정이 다른 경로에서 거절됨. 이제 인증된 HEAD의 안전한 정수 count와 **완전한 R2 목록 개수 일치**를 유지하되 인위적인 개수 상한으로 거절하지 않음.
- 첫 색인·압축 복구에서 ID 전체의 유효성/중복 및 소유자 검증 후 `json_each(?)`와 **512개 이하 ID 페이지당 하나의 SQLite 문장**으로 D1 membership을 원자적·멱등 기록. 한 행씩 SQL 쿼리하는 방식보다 호출 수를 줄이고, 변경 없는 계정·앱 진입 시 작업하지 않음.
- D1 상태는 기존 `building` 또는 복구용 보이지 않는 generation에서만 진행. **모든 ID 수량과 최신 R2 HEAD revision·ETag가 일치해야 READY 승격**; 도중 실패/HEAD 이동/경합에서 이전 READY 원본은 보존. 같은 정확 HEAD 재시도에서 이미 기록된 ID는 쓰기 W0.
- 소스 실행형 모의 검사: 20,001·50,001 ID 온전한 완료, 재시도 후 기록 중복 W0, 512개 단위 SQL query, 기존 READY 보호. 실제 SQLite JSON1로 20,001 ID 삽입·HEAD CAS·다른 소유자 격리. R2 실제 어댑터에서 >20k BASE 읽기/HEAD 재확인과 미PUT 검증.
- **비용 계약:** 첫 색인/압축 복구 성공 1회는 여전히 **D1 논리 행 쓰기 N+2**; 쿼리 수는 `ceil(N/512)`개의 bulk membership 문장 + 메타/검증용 조회·갱신. 이것은 공짜가 아니며 기존의 전체 R2 materialization 1회가 필요한 초기/압축 복구 작업만 해당. 일반 단건 변경 D1 W3~W4 목표/페이지 진입 R0/W0 변경 없음.
- **중요한 미검증:** 기존 공유 R2 BASE는 JSON 전체 자료화 구조라 실제 20,001곡 이상의 payload 크기·Cloudflare Worker 메모리/CPU/시간 한도에서 **무한 규모를 보장하지 않음**. 이 단계의 >20k는 계정 개수에 의한 소스 차단을 제거한 것이며 실서버 부하 시험·실제 비용과 모든 크기의 라이브 Catalog 정상 복구는 검증되지 않음. 적합하지 않은 매우 큰 BASE를 임의로 자르거나 원본을 덮어쓰는 우회 금지. 필요 시 스트리밍 기반 자료화는 별도 설계 검증 후 승인.
- 기존 미해결 릴리스 P1 두 건(공유 PREVIEW/TEST/PRODUCTION 구형 Writer 전면 차단, Firebase↔Cloudflare 실연결)과 D1 이전 세대 안전 정리, 실기기/실청구 비용 검증, 본 SHA의 **Work 독립 감사 미실시**. **전체 RELEASE HOLD / NO-GO 유지**.


## 2026-10-29 Workers Free 대량 계정 안전한 분할·재개 후보 (병합·배포 금지)

**승인 범위:** PR #528 비활성 서버 후보의 소스/검사/GitHub 저장만. 실제 공유 R2/Firestore/D1/Workers·요금제 변경 0.

- **Cloudflare 공식 D1 한도 확인 정정:** Workers Free는 실행당 **D1 API 50회**. D1 `db.batch([...])` 안의 여러 SQL 문장은 **배치 전체가 한 번의 D1 호출**로 계산된다. 기존 50,001곡 `98개 SQL`이 그 자체로 Free 실행당 50회 초과라는 판단은 틀렸으며, 기존 코드는 반복 `run()`을 사용하므로 별도 호출 수 위험이 남았음. D1 논리 **쓴 행 N+2** 및 SQL 처리 CPU·시간과 청구량은 호출 수와 다름.
- **새 비활성 R2 `catalogR2BasePages518.js`:** 기존 R2 v5 JSON BASE의 `items` 영역을 **64KiB 이하 R2 range GET**으로 순차 읽기. 한 곡당 최대 128KiB, BASE 상한 기존 24MiB, UTF-8·중첩 객체·JSON 구문·UID·kind·ETag·BASE itemCount/생성시각·완료 상태 검증. 전체 JSON `object.text()` 및 50,001곡 일괄 배열/Map 생성 대신 **한 페이지에 최대 256곡 ID·소스 128KiB(큰 단일 곡 128KiB까지 허용)**만 메모리에 올려 색인. JSON suffix/base metadata까지 완전히 검증되기 전에는 READY 승격 불가. HEAD delta는 기존 인증된 768KiB 이하 Journal만 재생.
- **새 비활성 D1 `catalogOwnerPagedIndex518.js`:** 첫 색인과 compaction recovery 양쪽에 **한 번의 실행당 최대 4페이지(각 256곡), 3개 delta**로 제한. 미적용 518 SQL에 소유자·세대·HEAD ETag·BASE ETag/크기·byte-offset·완료한 곡 수·delta 위치 저장 테이블 추가. 한 페이지당 `INSERT OR IGNORE json_each(?)` + 진행 위치 갱신을 **D1 batch 원자적 트랜잭션**으로 기록. 실패/동시 실행 시 같은 버전 재시작, 이미 기록된 ID 중복 쓰기 W0. 초기/복구 세대는 검증 완료 전 보이지 않으며 기존 READY 보존. HEAD 이동은 60초 cooldown·최대 3회 더 최신 세대 전환과 동일한 보호 규칙을 유지.
- **비활성 서버 Bridge/Writer/Delivery 연결:** Workers Free에서 배치 16개를 한 호출에 처리하면 총 D1/R2 한도를 넘을 수 있어 **대기열 호출당 최대 1곡의 pending 변경**으로 제한. 2만 곡 초과 첫 색인과 compaction gap이 증명된 대량 계정만 paged path, 정상 소규모 계정은 기존 구현. `PAGING_IN_PROGRESS`는 새 코드가 D1 진행을 실제 기록한 경우에만 발생하며, outbox의 실패 재시도 8회 카운트 대신 **다음 기회로 10초 이상 defer(새 outbox W1)**. 실제 연결된 scheduler/cron은 아직 없으므로 소스-only 테스트가 실운영의 자동 처리 완료 증거는 아니다.
- **실행형 모의 검사:** `verify-518-large-paging.mjs`이 Cloudflare R2 range-only 가짜 provider와 D1 영속 커서 모형으로 20,001·50,001곡 여러 Worker 실행에 걸친 완료, Free 한 실행 D1 API 50회 이하, 이전 READY 무변경, BASE ETag 변조 HOLD, 중간 D1 실패 후 재개, 변경 journal delta 삭제곡 부활 방지, 실제 R2 PUT 0을 검증. 기존 실제 SQLite JSON1 20,001곡 및 전 제품 테스트는 별도.
- **운영 위험 및 중단 조건:** 실제 Workers Free의 요청당 CPU 10ms, 메모리 128MB, R2 range subrequests/지연, 크기가 큰 개별 곡 JSON, D1 단일 DB 처리시간·행 수·일일 quota, scheduler cadence·실제로 처리 완료되는 시간은 **아직 미실측**. 특히 CPU Free 10ms 내 256곡 파싱+2문장 batch의 완료는 보장되지 않는다. 실행·비용 최적화는 실제 안전한 별도 QA 이후에만. 비정상·손상된 BASE가 존재하면 원본을 자르거나 READY를 강제하지 않고 HOLD.
- **배포 차단 상태:** 공유 PREVIEW/TEST/PRODUCTION 구형 R2 writer fencing, 실제 Firebase↔Worker 인증·트리거/Secret/D1/예약 실행, Workers Free 실행 한도 실측, 소스 수정의 Work 독립 감사, 구형 클라이언트 혼합 실기기 QA·이전 D1 generation 안전 GC가 모두 미완료. **PR Draft / RELEASE HOLD / NO-GO 유지.**


## 2026-10-29 독립 감사 FAIL 3건 최소 수정 (P1 1, P2 2)

**감사 대상:** PR #528 `163e15c9a7dd836687fac336e2ddddbbbfa18761`. 기존 CI 3/3 PASS에도 불구하고 별도 감사방의 **실제 SQLite 경쟁 재현으로 신규 P1(삭제곡 부활·최신곡 소실)** 및 P2 2건(손상 JSON 마지막 쉼표 허용, 128KiB 제한 초과) 판정. 이번 수정 전의 코드에서 발견된 결함이며 PASS로 소급 표시하지 않음.

- **P1 동시 실행 조건부 회원 변경:** `catalogOwnerPagedIndex518.js`의 BASE INSERT 및 delta INSERT/DELETE SQL *자체*가 기존 페이지 커서(소유자·세대·모드·phase·head ETag·BASE offset/seen 또는 delta index·BASE ETag)와 D1 메타의 미공개 generation 상태를 `EXISTS`로 증명해야 실행됨. 후행 커서 UPDATE에도 동일 D1 메타 조건 추가. 따라서 늦게 온 이전 작업은 DB 배치 안에서 **membership W0와 cursor W0**, READY 승격 이후에는 해당 세대 쓰기 W0. `db.batch()`의 원자성만으로 선행 SQL을 되돌릴 수 있다고 가정하지 않음.
- **P2 malformed BASE:** R2 range JSON items 파싱에서 쉼표 뒤 즉시 `]`를 만나면 `APP518_PAGED_TRAILING_COMMA` 계약 오류로 거절. JSON 후미를 재구성할 때 구분자를 빠뜨려 오류를 숨기지 않음. 손상된 R2는 새 색인 READY/ACK/R2 PUT 금지.
- **P2 엄격 소스 페이지:** `byte()`가 페이지당 원본 입력 소스 **128KiB 바이트 소비 전에 중단**하고, 다음 곡이 중간에서 잘리면 마지막으로 온전히 검증한 곡 경계까지 진행 커서를 롤백. 첫 페이지의 검증된 JSON prefix만 먼저 저장하는 0곡 단계도 허용하고, 큰 유효한 단일 곡은 다음 페이지에서 읽음. 개별 곡마저 128KiB를 초과하면 계약 오류로 HOLD(원본을 자르지 않음). R2의 64KiB 이하 range GET 및 후미 메타 prefix 확인 재읽기는 별도 요청이며 실제 Worker CPU/subrequest 실측은 여전히 없음.
- **새 CI 근거:** `verify-518-large-paging-concurrency-sql.py`는 실제 SQLite 파일에 두 연결을 열어 stale BASE 재삽입 → 삭제곡 부활, stale delta 삭제 → 최신 저장곡 누락, READY 승격 후 회원 SQL, recovery promotion 후 늦은 쓰기를 모두 **변경 행 0**으로 검증. `verify-518-r2-page-contract.mjs`는 가짜 R2 range에서 80KiB 곡 2개, 큰 UTF-8 단일 곡, trailing comma malformed JSON, 다른 UID 소스를 검사. 기존 첫 색인·복구·서버 Bridge·앱 회귀는 원래 CI에서 별도 재실행.
- **미완료/릴리스 차단:** 새 수정 SHA의 별도 **Work 독립 재감사 미완료**. Cloudflare Free 실제 10ms CPU·128MB 메모리/D1·R2 실비용, PC↔모바일 검증, 공유 구형 Writer fencing, Firebase↔Cloudflare 서버 인증·trigger/Secret/D1/cron 실연결 미완료. **전체 RELEASE HOLD / NO-GO**, PR Draft 미병합·미배포·실데이터 변경 없음.


## 2026-10-29 구형 Worker 공유 R2 쓰기 P1 — 3환경 사전보호 후보 (배포 금지)

**현장 읽기 전용 확인:** Cloudflare UI에서 현재 3개 Media Worker는 모두 동일한 `CATALOG=soridraw-user-catalog`, `SORIDRAW_SHARED_CATALOG_V1=1`, `SORIDRAW_CANONICAL_CATALOG_518` 미표시. PREVIEW active prefix `83175bcc`, TEST `f0a86688`, PRODUCTION `2c2e3236`, 각각 트래픽 100%. **활성 소스의 518 fenced writer 포함 여부·구형 in-flight 완료는 입증되지 않음.** 이 8자리 접두어는 불변 전체 version ID/감사 출처를 대신하지 않음.

**확인된 4개 구형 쓰기 경로:** 기존 Media Worker `index.js`의 `POST /v1/catalog/musicNote/delta`, `POST .../bootstrap`, 공유 Catalog 없을 때 legacy MEDIA seed, `compactCatalogJournal`의 BASE/HEAD 변경. 구형 Worker는 app518 canonical/tombstone을 이해하지 못하므로 신형 Worker의 HEAD 보호·R2 ETag만으로 오래된 Worker가 최신 상태를 덮어쓰는 사고를 막을 수 없음. **현존 서비스/버킷/권한을 즉시 중지하거나 플래그를 OFF로 바꾸는 것은 해결책이 아니며 사용자 동기화를 망가뜨릴 수 있음.**

**기존 PR #528 보호 코드 재사용:** `catalogAuthorityPolicy518.js`의 protected HEAD 구형 delta/seed/rebuild 거부 및 `index.js`의 source-verified HEAD check, `SORIDRAW_CANONICAL_CATALOG_518` 기본 OFF 유지. 추가적인 별도 R2 저장 키, 계정 전체 조회, Firestore/D1 폴링, 사용자 데이터 마이그레이션 없음.

**이번 최소 소스 보강 (후보 브랜치 ONLY):**
- `catalogSharedWriterRolloutGate518.js`: 반드시 **PREVIEW·TEST·PRODUCTION 3개**의 동일 공유 버킷/정확 worker·MEDIA 이름·플래그 OFF·단일 활성 버전 100%·감사로 확인한 **전체** 버전 ID·보호 코드 health identity·서로 최소 10분 간격의 두 Cloudflare live 관측이 일치해야 소스-호환 사전 점검 가능. 이전 in-flight 종료를 별도 독립 감사로 증명하고, 자동 rollback 대상도 감사된 fenced 버전으로 고정해야 함. 어느 하나라도 없으면 HOLD. 100% 라우팅만으로 오래된 실행 종료를 추정하지 않음. `pass:true`여도 `canEnableCanonical:false`: 정본/Function/D1 연동·별도 배포 승인은 독립 조건임.
- 후보 `cloudflare/media-worker/src/index.js`의 GET `/health`에 **비밀정보 없는 코드 설치 마커** `catalogWriterFence518` 추가. 마커는 Worker 코드가 가진 기능만 말하며 실제 다른 두 Worker의 호환, 실데이터·이전 비행 종료, 정본 활성화를 보증하지 않음. 구형 Worker에는 마커가 없어 자동 FAIL.
- `scripts/verify-518-live-media-writer-readonly.mjs --live`는 계정 권한이 있을 때만 Cloudflare **GET deployments/settings**와 Worker **GET /health** 각각 3개를 단발 수집하며, R2/D1/Firestore 객체·시크릿 값·전체 사용자 데이터 불조회. `--self-test`는 Cloudflare 연결 없이 mock GET만 검증. 수집 결과는 **관측 증거**일 뿐 자동 배포 허가가 아니고, 이를 승인된 immutable version 및 실제 구형 실행 종료 증거와 대조해야 함. 실행 시 GitHub 로그에 계정 토큰·개인정보 노출 금지.
- `scripts/verify-518-shared-writer-rollout.mjs`: 단일 PREVIEW만 업그레이드, 구형 TEST/PROD, 100% 미달/분할 트래픽, R2 이름·플래그 불일치, 복수 버전, 불확실한 HEAD 마커, 구형 롤백, 관측 10분 미달/오래된 관측, in-flight 미증명, 변조된 버전 attestation 모두 FAIL. 아직 migration 없는 구형 브라우저의 정상 delta는 보호, protected owner의 구형 delta/seed/rebuild는 거부하는 소스 정책 회귀 포함.

**중요한 해결 범위 한계:** 이 코드는 실제 Cloudflare Worker를 바꾸지 않음. `catalogSharedWriterRolloutGate518`는 **독립 사전 점검을 위한 소스 후보**이며 현재 기존 배포 워크플로에 자동 연결하지 않았음. 특히 과거 자동 rollback 명령이 이전 구형 version을 복원할 수 있으므로 **서버 전환 전에** 배포·롤백 제어를 별도 승인 범위에서 수정/검증하지 않으면 NO-GO. 위 코드만으로 현재 live 3환경 보호 P1이 해결됐다고 표현하지 말 것. 구형 브라우저의 canonical 전환 **이후** 저장·삭제는 서버 정본 전달·재시도가 실제 작동하고 실기기에서 보존될 때까지 중단 가능성이 있어, 사전 호환성 합격 전 전환 금지.

**다음 단계 / 명확한 차단:** 새 SHA CI+별도 Work 독립 감사 → 인증된 Cloudflare 정확 version/바인딩/GET health read-only 증거 수집 → 세 Worker fenced-source 코드를 모두 먼저 설치(별도 명시 배포 승인 전 금지), 기존 정상 delta 사용 유지 → in-flight 종료/old rollback 차단 검증 → Firebase↔D1↔R2 정본 전달/구형 브라우저 보존 실검증 → 별도 사용자 승인을 받은 후에만 canonical 518 활성화. TEST·PRODUCTION 승격, 병합, 실데이터 수정, 버킷 변경 모두 현재 금지. **전체 RELEASE HOLD / NO-GO 유지.**

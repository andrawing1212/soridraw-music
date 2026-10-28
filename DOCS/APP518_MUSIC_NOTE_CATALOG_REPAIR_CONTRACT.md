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

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

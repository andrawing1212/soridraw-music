# app517 Music Note 일치성 — 재발 방지 기준 / 현재 근거

> 기록: 2026-10-28 KST. 이 문서는 새로운 공유 데이터 마이그레이션이나 서버 배포를 승인하지 않는다.

## 실증 및 미확정

- **실증:** 같은 사용자의 `먼 길을 돌아온 밤`은 로그인 소유 Firestore `favorites` 문서로 존재·활성. 기존 PC Chrome에서는 보이지만 모바일/새 PC에서는 안 보임. 기존 PC **로컬 Catalog**에 정확한 ID가 없었음. 이전 진단의 `firestoreId` 별칭 우선 비교에는 false-negative 가능성이 있었으므로 app516에서 `item.id` 우선으로 보정.
- **미확정:** 공유 R2 Catalog가 정확한 `item.id`를 갖고 있는지, 현재 모바일의 IndexedDB와 profile revision 중 어떤 단계가 오래됐는지. 이 두 상태를 구분하지 않은 복구/전면 정리는 금지.
- **P1 재현:** 클라이언트가 Firestore 최신 상태를 읽어 R2에 델타 POST해도 다른 기기의 저장 해제 사이에 들어가면 오래된 곡을 부활시킴. app516 복구 쓰기와 RTDB save replay는 안전 감사 PASS 후 제거됨.

## 소스에서 확인되는 재발 가능 구조

1. `src/App.tsx`의 정상 저장 후 `writeFavoritesCache(...)` → `schedulePreviewAdaptiveListIndexPublishIfDirty`가 R2 게시를 **별도 지연 단계**로 예약한다.
2. `src/lib/firestoreMeasured.ts`의 `adaptiveListIndexDirtyRevisions`, `src/lib/userDataEngine.ts`의 `catalogPendingPublishes`/publish timer는 현재 **브라우저 런타임 메모리**다. R2 delta 실패나 Canonical 저장 직후 탭 종료 시 브라우저가 종료되면 이 예약 자체는 복구가 보장되지 않는다.
3. 정상 RTDB 수신 경로 `src/App.tsx`는 `writeFavoritesCache(...,{publishDerived:false})`로 파생 R2에 재게시하지 않는다. 무분별한 오래된 상태의 게시를 막는 정상 보호이므로 제거 금지.
4. Music Note 진입은 `src/lib/adaptiveListIndexV2.ts`의 Catalog → `src/lib/userDataEngine.ts` warm cache/서버를 따른다. `src/lib/catalogWarmCachePolicy.ts`의 사용자 profile revision이 이전 상태라면 오래된 로컬 Catalog가 최신으로 취급될 수 있다. 실제 어떤 분기가 이번 곡에 적용됐는지는 미확정.

**결론:** 단건 복구가 아니라 **원본 Firestore 저장·해제의 최종 순서가 공유 Catalog에 누락/역전 없이 도착하는 보장**과 **다른 기기가 이를 인지할 버전 신호**가 필요하다. 브라우저에서 추가 R2 쓰기/전체 스캔/일괄 초기화로 해결하지 않는다.

## 현재 작업 — 안전한 원인 분리

- PR #525는 기존 사용자의 관리자 진단에서만 실행되는 공유 R2 단건 포함 검사 추가.
- 새 Worker 경로는 사용자 Firebase ID 토큰 + App Check 인증, 본인 UID의 공유 `CATALOG` bucket만 읽음.
- **절대** `getCatalogState`, `seedSharedCatalogFromCurrentLegacy`, `bootstrap`, `put`, `Firestore collection scan`, 클라이언트 캐시 교체, RTDB save replay를 실행하지 않음.
- 결과는 `materialized/membership/revision/itemCount`만 반환. 서버 자료가 없다면 `membership=null`; 오류 시 누락으로 오판 금지.
- 페이지 진입/갱신 시 자동 API 호출 없음. 실제 Worker 새 엔드포인트 미배포. 개인 곡·계정 데이터 실조회 없음.

## 다음 수정의 합격 계약 (아직 구현·승인되지 않음)

1. 실제 공유 Catalog `item.id` 유무와 PC/모바일 캐시 버전 대조로 누락 경로 하나를 확정한다.
2. canonical `favorites` 변경의 **서버 확정 버전**에 따라 save/unsave에 같은 정렬 규칙을 적용한다. 업데이트/삭제 및 실패·재시도/오프라인 순서 역전, 이후 탭 종료도 증명해야 한다. Catalog 삭제(또는 tombstone)는 오래된 save가 다시 붙지 않도록 **버전 보존**이 필요하다. 단순 Cloud Function POST 이동만으로는 원자성이 생기지 않는다.
3. 한 곡 변경은 O(1) 원본/파생 변경분만 처리하고, 공유 R2/Firestore/RTDB 읽기·쓰기 비용을 실제 측정한다. 평상시 화면 진입·변경 없음은 새 쓰기 0, 사용자 전체 곡 스캔/마이그레이션 0.
4. PC A 저장/해제 → 모바일 B 즉시 반영 → A 탭 종료/오프라인/30초 배치/재시도 → 새 PC C 신규 로그인 → 재접속까지 동일한 곡·하트·목록. 다른 곡·Library·Explore·기존 로컬 데이터 보존.
5. CI PASS, 독립 P1/P2 감사 PASS, 별도 승인 PREVIEW 배포, 실제 PC·모바일 비교를 각각 구분하여 완료 표시. PR #512 V2 폴더 기능은 별도 HOLD.

위 결과 전에는 누락곡과 재발 방지 전체 작업을 완료로 표현하지 않는다.

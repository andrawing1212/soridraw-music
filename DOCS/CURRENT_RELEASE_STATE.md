## CURRENT — app403 PC↔모바일 좋아요 실시간 일치 후 reload 회귀 재현/코드 원인 경로 확인 (2026-10-12 KST)

- **제품 FAIL:** 사용자 제공 모바일/PC 비교 화면에서 같은 계정의 실시간 좋아요/해제는 반영되지만 각 기기 새로고침 후 수신했던 최신 하트·잠정 숫자가 이전 캐시 상태로 돌아감. 예시 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」. 하트와 계정 내 잠정 숫자 0/1이 뒤바뀜. 5분 정산 및 reload 보존 정상 기능 보장 미달.
- **코드로 확인한 수신 복원 단절:** `src/services/exploreLikeIntent416.ts`은 remote intent를 `localIntentByUid416` 메모리에만 유지, cold reload 첫 `onValue` snapshot을 무조건 건너뜀, 반면 `seenVersion416`은 UID-scoped localStorage에 남김. `src/services/exploreLikeService.ts`은 수신 메모리 힌트가 없으면 기존 outbox/accepted/R2/cache로 fallback. `ExplorePage.tsx`는 active remote-intent 개인 잠정 하트·숫자 UI만 repaint하므로 reload 후 과거 값 표시는 소스상 충분히 설명됨. 이는 서버 D1 final 실패와 구분되는 별도 결함이며, 해당 곡의 정확한 최종 D1 저장/Task 실패 지점은 여전히 미확정.
- **안전 지침:** 첫 RTDB client-writable 임시 신호를 cold reload 때 무조건 재생하거나 60분 영구 canonical로 사용하는 단순 패치 금지. pending/operationId/version과 server-only `privateLikeFinal416` 증거를 구분하고 이전 opposite click/최종 ACK/기존 개인 캐시 보호. D1/Firestore 읽기·쓰기/전체 Feed scan/페이지 재진입 mutation 금지. 세부 Codex 작업은 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션 기준.
- **현재 실행 상태:** 코드 수정 0, commit은 상태문서 기록만, PREVIEW Hosting app403 및 이전 `recordPrivateLike416` 단일 Function 배포 유지. TEST/PRODUCTION 변경 없음, 실사용 PASS 아님. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 개인 좋아요 5분 3/4·75%.

---

## POSTDEPLOY READONLY — app403 Stage416 Callable 복구 배포 직후 기준 상태 (2026-10-12 10:43 UTC)

- 신규 코드 배포 [38237388824](https://github.com/andrawing1212/soridraw-music/actions/runs/38237388824) SUCCESS 이후 서버 익명 감사 [38238069865](https://github.com/andrawing1212/soridraw-music/actions/runs/38238069865) SUCCESS: `recordPrivateLike416`, Schedule, Settle 동일 runtime identity; Cloud Tasks queue RUNNING; Master private/public 각 5분. 새 클릭이 없는 시점의 공개 버스 마지막 갱신 2026-10-10 03:46:49 UTC, D1 416 acceptance / 069 pending 각 bounded SELECT 존재 NO, 검사 결과 D1 write 0.
- **의미:** 변경된 Callable 함수의 배포/운영계정/예약대기열은 정상이나 **이전 사용자의 미완료 좋아요가 자동 복구됐다는 뜻이 아님**. 다음 새 인증 클릭에서 기존 만료 서버 창을 발견하면 서버 복구 Task 생성 → 정확한 원본 클릭 재전송 → 5분 후 최종 정산을 실사용으로 추적해야 함. 이 시점에서 실사용 기능 FAIL/미검증이며 TEST 승격 보류.
- 세 진행률 변경 없음: Stage416 1/4·25%, 앱 속도 5/5·100%, 개인 5분 정산 3/4·75%. Preview app403, TEST/PRODUCTION 비변경.

---


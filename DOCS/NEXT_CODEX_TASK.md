# NEXT CODEX TASK

상태: **PREVIEW 067 배포 PASS / 사용자 재검증 + like-only Feed 재확인 비용 분석 필요**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `067`
- App Run `34616138225` — PASS
- release checkout `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- PREVIEW Worker는 066 그대로: Run `34597109785`, active `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Shared D1 066 Run `34597025382` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 067 수정
1. PC→모바일 same-account 좋아요 숫자
   - 066에서 하트는 바뀌지만 숫자가 stale Worker count로 남는 재현이 있음.
   - 067은 성공 batch의 same-account signal에 현재 UI의 `optimisticLikeCount`를 전달.
   - 새 listener / D1 query 없음.
2. CACHE LIVE 진단 초기화
   - reset 버튼 pointerdown이 Explore global activity revalidation으로 전달되지 않게 차단.

## 사용자 재검증 필수
- 067 업데이트 적용.
- PC에서 좋아요 1~2곡 → 약 1분 뒤 모바일 하트 + 숫자 함께 증가.
- 모바일에서 해제 → PC 하트 + 숫자 함께 감소.
- 진단 초기화 버튼을 누른 것 자체로 Worker/D1 증가 없음.
- 066 W2 비용 개선은 유지되어야 함.

## 추가 비용 이슈
사용자 캡처에서 2곡 unlike batch 자체는 Worker 1 / rows `R6/W2`로 정상.
그 뒤 브라우저 재활성/복귀 시점에 별도로:
- `/v1/feed-revision` Worker 1 / D1 `R1/W0`
- `/v1/feed` Worker 1 / D1 rows `R15/W0`
가 관찰됨.

코드상 ExplorePage에 1분 자동 timer는 없음. revision trigger는 focus/pageshow/pointerdown/visibilitychange이다.
따라서 다음 구현 전 먼저 **복귀 이벤트 + own like aggregate revision change** 조합인지 재현을 고정한다.

## 다음 구현 방향 — 필요 시 Codex High
현재 032 구조에는 이미 `explore_derived_changes(scope,kind,id,seq)`가 있고 changed track ID를 bounded delta로 처리한다.
따라서 새 전체 구조를 만들지 말고 이 기존 delta 구조를 재사용하는 방향만 검토한다.

목표:
- like-only revision 때문에 클라이언트가 `/v1/feed` 전체 payload를 다시 요청하는 경로 제거 또는 최소화.
- 변경 track만 반영.
- publish/unpublish/profile 등 구조 변경은 계속 정확히 반영.
- popular 정렬 정확성 보호.
- 정상 캐시/변경 없음 복귀 Worker/D1 0 우선.
- 좋아요 batch W2 유지.

금지:
- 전체 Feed scan/rebuild 추가.
- 새 Firestore listener.
- 사용자 데이터 migration/backfill/delete.
- UI 변경.
- TEST/PRODUCTION 배포.

## TEST 승격
현재 TEST 승격 금지.
067 사용자 cross-device count + diagnostics reset 재검증을 먼저 완료하고, like 처리 뒤 Feed 재확인 비용의 조건/범위를 확정한다.

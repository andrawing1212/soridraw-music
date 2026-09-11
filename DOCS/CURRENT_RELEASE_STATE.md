# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 067**
- PREVIEW 067 app release checkout: `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- PREVIEW 067 App Run: `34616138225` — **PASS**
- 067 same-account visible count fix: `973eb306447e4ec636302a63d04db561ab101bc1`
- 067 app version commit: `f3d8e7951174dcb619f82435d7e56cff66c508cd`
- 067 diagnostics reset propagation fix: `92fa248eae33e29b2e520cb69bd1e46c856e2d50`
- PREVIEW Worker는 066 그대로: Run `34597109785`, active Version ID `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Shared D1 066 additive schema Run: `34597025382` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active

## 2. 066에서 확정된 비용 개선
- 1곡 like: D1 `R2/W2` 실사용 PASS.
- 1곡 unlike: D1 `R2/W2` 실사용 PASS.
- 2곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R6/W2`.
- 3곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R9/W2`.
- 여러 곡을 묶어도 queue write는 `W2/batch`로 고정됨.
- 065의 W3 대비 write 약 33% 감소는 유지.

## 3. 066 기능 판정 취소 / 067 수정 이유
066에서 PC→모바일 좋아요 동기화 시:
- 모바일 하트 색은 바뀌지만 숫자가 그대로인 재현이 확인됨.
- 원인은 deferred public aggregate가 아직 반영되지 않은 Worker `result.likeCount`를 same-account signal 숫자로 다시 사용한 것.
- 따라서 066의 `same-account 숫자 동기화 최종 PASS` 판정은 취소.

067 수정:
- same-account signal에는 현재 화면에서 이미 확정적으로 보이던 `optimisticLikeCount`를 전달.
- 하트 상태와 숫자가 동일한 pending mutation 기준으로 같이 전달되도록 수정.
- 기존 root `users/{uid}` listener 재사용.
- 새 Firestore listener / D1 query / Worker route 없음.

## 4. CACHE LIVE 진단 초기화 오염 수정
- `진단 초기화` 버튼 pointerdown이 Explore 전역 activity revalidation까지 전달되는 경로를 차단.
- 버튼 자체를 눌렀다는 이유로 feed revision check가 발생하는 진단 오염을 제거.
- UI 모양/위치 변경 없음.

## 5. 067 배포 자동검증
Run `34616138225`:
- checkout `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- npm install PASS
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=067` PASS
- TEST/PRODUCTION branch + actual HTML unchanged PASS
- Worker / D1 / Functions / Rules 변경 없음
- 사용자 원본 데이터 변경 없음

## 6. 추가 발견 — 좋아요 처리 뒤 Feed 재확인 비용
사용자 066 실사용 캡처:
- 2곡 unlike batch 직후: likes batch `R6/W2`.
- 이후 브라우저가 다시 활성화/복귀한 시점의 캡처에서 추가로:
  - `/v1/feed-revision`: Worker 1, D1 row `R1/W0`
  - `/v1/feed`: Worker 1, D1 rows `R15/W0`
  - SDK `users:onSnapshot`도 3→4 증가
- ExplorePage에는 1분 주기 timer는 없음. revalidation trigger는 focus/pageshow/pointerdown/visibilitychange임.
- 따라서 단순 1분 timer 자동 read로 보지 않는다. 좋아요가 실제 서버에 반영된 뒤 탭 활성/복귀 신호에서 revision 변화가 감지되어 Feed 동기화가 실행된 경로로 본다.
- 하지만 SORIDRAW 비용 목표상 좋아요 몇 개 때문에 전체 Feed 성격의 재확인이 생기는 것은 추가 최적화 대상으로 유지한다.
- 현재 Worker의 032 derived change cache는 changed track ID만 추적하는 delta 구조를 이미 갖고 있으므로, 다음 단계에서는 이 기존 구조를 재사용해 full feed 재요청을 더 줄일 수 있는지 좁게 검토한다.

## 7. 현재 보호 기준
- PREVIEW 좋아요 1분 batch.
- 10분 deferred public aggregate.
- compact queue `W2/batch`.
- PC↔모바일 same-account 하트 + 숫자 동기화.
- 기존 Firestore root user listener 재사용, 새 listener 금지.
- Explore resume LOCAL revision cache.
- Music Note/Library Local First.
- UI/CSS/반응형 변경 금지.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.

## 8. 현재 판정
- PREVIEW 067 App 배포 자동검증: PASS.
- 067 cross-device 숫자 수정: **사용자 실사용 재검증 전**.
- 067 진단 초기화 pointer 오염 수정: **사용자 실사용 재검증 전**.
- 066/067 좋아요 W2 비용 개선: PASS 유지.
- TEST 승격: **불가 — 067 사용자 확인 및 Feed 재확인 비용 원인/범위 확인 전**.
- TEST/PRODUCTION 변경 없음.

## 9. 다음 단계
1. 사용자 PREVIEW 067 업데이트 적용 확인.
2. PC에서 1~2곡 좋아요/해제 → 약 1분 뒤 모바일에서 **하트와 숫자가 함께 변경**되는지 확인.
3. CACHE LIVE `진단 초기화` 직후 버튼 자체 때문에 Worker/D1이 증가하지 않는지 확인.
4. 좋아요 batch 뒤 앱을 그대로 두거나 복귀했을 때 `/v1/feed-revision` + `/v1/feed`가 다시 발생하는 조건을 분리 계측.
5. 필요하면 기존 032 changed-track delta를 이용해 like-only revision에서 full feed 재요청을 제거/축소하는 PREVIEW 작업 진행.
6. 위 항목 PASS 전 TEST 승격 금지.

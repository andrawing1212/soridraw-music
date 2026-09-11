# NEXT CODEX TASK

상태: **PREVIEW app 063 배포 PASS — 업데이트 완료 알림 + 062 복귀 zero-read 실사용 검증 대기**

## 현재 기준
- branch: `preview`
- PREVIEW app: `063`
- 063 기능 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`
- 063 release trigger/deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`
- PREVIEW app Run: `34568279072` — PASS
- 062 zero-read source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- PREVIEW Worker: 035 deferred like aggregate + 037 one-row revision head 유지
- Worker active Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 schema Run: `34511788949` — PASS
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- 실제 URL: `https://preview.soridraw.com/`

## 063 변경
- 실행 중 구버전은 기존 `새 업데이트 · 적용` 유지.
- 새 버전으로 앱/브라우저를 새로 시작하면 `업데이트 완료 · 063`을 같은 우측 상단 위치에 한 번 표시.
- 완료 알림은 약 8초 후 자동 닫힘, 클릭 시 즉시 닫힘.
- 마지막 실행 버전과 완료 표시 버전은 PREVIEW localStorage에만 저장.
- 063 첫 도입 전환에서는 기존 SORIDRAW 로컬 상태가 있는 기기도 완료 알림을 한 번 받을 수 있음.
- Firestore/D1/Worker/Functions 호출 추가 없음.

## 다음 실제 검증
1. 062가 열려 있으면 새로고침 없이 `새 업데이트 · 적용`이 뜨는지 확인.
2. 적용 버튼 클릭 또는 창 완전 종료 후 다시 열어 063 시작 시 `업데이트 완료 · 063`이 보이는지 확인.
3. 같은 063을 다시 완전 종료/재실행했을 때 완료 알림이 반복되지 않는지 확인.
4. CACHE LIVE 진단 초기화 후 Explore에서 PC 창 내림/복귀 3~5회.
5. 10분 안 `/v1/feed-revision` Worker/D1 증가 0, `LOCAL REVISION CACHE`만 증가하는지 확인.
6. 모바일 전원/홈 → 앱/Explore 복귀도 같은 방식으로 확인.
7. 10분 경과 후 첫 서버 revision 확인 1회는 허용. 이후 다시 10분 동안 반복 복귀 0인지 확인.
8. PC↔모바일 좋아요/해제 개인 하트 동기화 회귀 확인.

## 합격선
- 기존 열린 구버전: `새 업데이트 · 적용` 자동 표시.
- 새 버전 첫 실행: `업데이트 완료 · 버전` 1회 표시, 같은 버전 재실행 시 반복 표시 없음.
- 완료 알림 때문에 Firestore/D1/Worker 비용 추가 없음.
- 정상 캐시 freshness window 안 단순 창복귀/앱복귀/Explore 재진입 Worker/D1/R2 증가 없음.
- Feed 전체 재조회/재생성 없음.
- 좋아요 batch/PC↔모바일 동기화 회귀 없음.
- Music Note 약 60초 묶음 저장 / Library Local First / UI 변화 없음.
- TEST/PRODUCTION 영향 없음.

## 현재 판정
- TypeScript: PASS.
- Build: PASS.
- Firebase PREVIEW Hosting: PASS.
- exact build/version 063: PASS.
- TEST/PRODUCTION unchanged: PASS.
- 063 update-completed notice: **코드/배포 PASS, 사용자 실사용 확인 전**.
- 062 zero-read behavior: **코드/배포 PASS, 사용자 PC/모바일 진단 전**.
- TEST promotion: **아직 금지**.

## 운영 위험
- GitHub `preview`, `main`, `production` branch protection이 실제로 비활성 상태. 이번 063과 별개인 기존 운영 위험.
- 작업 branch `preview-062-explore-resume-zero-read`, `preview-063-update-complete-notice`는 preview에 포함됐지만 현재 연결 도구에서 branch 삭제 기능이 없어 남아 있음.

# NEXT CODEX TASK

상태: **PREVIEW app 062 배포 PASS — PC/모바일 복귀 zero-read 실사용 검증 대기**

## 현재 기준
- branch: `preview`
- PREVIEW app: `062`
- 기능 source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- release trigger/deploy checkout: `b2fdda12efbe6906efcedad031464abea508c677`
- PREVIEW app Run: `34566926350` — PASS
- PREVIEW Worker: 035 deferred like aggregate + 037 one-row revision head 유지
- Worker active Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 schema Run: `34511788949` — PASS
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- 실제 URL: `https://preview.soridraw.com/`

## 062 변경
문제:
- Explore 정상 캐시가 있어도 PC focus/pageshow/visibility 복귀, 모바일 백그라운드 복귀 때 `/v1/feed-revision`을 다시 확인했다.
- Worker edge cache가 cold이면 단순 복귀만으로 D1 head row R1이 생길 수 있었다.

수정:
- PREVIEW에서만 `GET /v1/feed-revision` 정상 응답을 기기 로컬에 10분 캐시.
- 첫 revision 확인 후 10분 동안 반복 복귀/재진입은 네트워크 없이 로컬 응답 사용.
- 로컬 HIT는 진단판에 `LOCAL REVISION CACHE`로 기록하고 Worker/D1/R2 비용으로 계산하지 않는다.
- UI/Explore 카드/정렬/좋아요 로직은 변경하지 않았다.
- Worker/D1/R2/Functions/Rules/사용자 데이터 변경 없음.

## 다음 실제 검증
1. PREVIEW 062 적용.
2. CACHE LIVE 진단 초기화.
3. Explore 진입 후 같은 화면에서 PC 창 내림/복귀 3~5회.
4. 10분 안에 `/v1/feed-revision` Worker/D1 증가 0, LOCAL cache만 증가하는지 확인.
5. 모바일 전원/홈 → 앱/Explore 복귀도 같은 방식으로 반복 확인.
6. 10분 경과 후 다음 revision 서버 확인 1회는 허용. 이후 다시 10분 동안 반복 복귀 0인지 확인.
7. PC↔모바일 좋아요/해제 개인 하트 동기화가 유지되는지 회귀 확인.
8. 그 다음 별도 작업으로 likes batch 자체 `R3/W3`와 Firestore `users:onSnapshot` 비용을 분석.

## 합격선
- 정상 캐시가 있고 10분 freshness window 안이면 단순 창복귀/앱복귀/Explore 재진입 때문에 Worker/D1/R2가 증가하지 않음.
- Feed 전체 재조회/재생성 없음.
- 좋아요 batch/PC↔모바일 동기화 회귀 없음.
- Music Note 약 60초 묶음 저장 / Library Local First / UI 변화 없음.
- TEST/PRODUCTION 영향 없음.

## 현재 판정
- TypeScript: PASS.
- Build: PASS.
- Firebase PREVIEW Hosting: PASS.
- exact build/version 062: PASS.
- TEST/PRODUCTION unchanged: PASS.
- 062 zero-read behavior: **코드/배포 PASS, 사용자 PC/모바일 진단 전**.
- TEST promotion: **아직 금지**.

## 운영 위험
- GitHub `preview`, `main`, `production` branch protection이 실제로 비활성 상태. 062와 별개인 기존 운영 위험.
- 작업 branch `preview-062-explore-resume-zero-read`는 preview에 포함 완료됐지만 현재 연결 도구에서 branch 삭제 기능이 없어 남아 있음.

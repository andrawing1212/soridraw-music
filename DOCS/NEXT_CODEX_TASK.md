# NEXT CODEX TASK

상태: **PREVIEW app 053 + 037 one-minute like test window 배포 PASS — 053 새 세션에서 036 진입 비용 + 035 좋아요 비용 재실측**

## 현재 기준
- branch: `preview`
- PREVIEW app: `053`
- PREVIEW app Run: `34525268095` — PASS
- PREVIEW app source/checkout: `a08fba52c2f6ae64a1cc338dc29da3def624bffd`
- PREVIEW client: 034 user-level batch + **037 PREVIEW 전용 1분 window**
- TEST/PRODUCTION client 기본값: 4분 유지, 이번 작업에서 미배포
- PREVIEW Worker: 035 deferred aggregate + 036 revision head-only
- PREVIEW Worker 036 Run: `34521740340` — PASS
- PREVIEW Worker active Version: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- Shared D1 035 schema Run: `34511788949` — PASS
- 실제 URL: `https://preview.soridraw.com/`
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 037 테스트 환경 변경
사용자 요청에 따라 PREVIEW에서 좋아요 batch 대기시간을 4분 → **1분**으로 단축했다.

구현:
- `src/services/exploreLikeService.ts`
- `EXPLORE_ENVIRONMENT === 'preview'`일 때 `60_000ms`.
- 그 외 환경 기본값은 `4 * 60_000ms` 유지.
- 첫 pending 시점부터 고정 1분이며 이후 클릭이 타이머를 계속 연장하지 않는다.
- outbox / 최대 50곡 / same-track 최종상태 collapse / retry 구조는 그대로다.
- 035 Worker의 10분 public aggregate cron은 변경하지 않았다.
- 앱 버전을 052 → 053으로 올려 오래 열린 052 실행본이 새 client 변경을 놓치지 않도록 했다.

배포:
- PREVIEW app Run `34525268095` PASS.
- TypeScript PASS.
- Build PASS.
- Firebase Hosting PASS.
- exact `preview.soridraw.com` build/version PASS.
- TEST/PRODUCTION unchanged PASS.
- Worker/D1/Functions/Rules 변경 없음.

## 036 revision 상태
- `/v1/feed-revision`은 head-only.
- Worker smoke: cold `R2/W0`, warm `R0/W0` PASS.
- 오래 열린 052 사용자 세션에서 이후 높은 누적 R/W가 관찰됐지만 053 새 실행본 기준 측정이 아니므로 최종 판정에 사용하지 않는다.

## 다음 실제 작업
1. PREVIEW 앱 `053` 적용 확인 후 새로고침.
2. CACHE LIVE 진단 초기화.
3. 앱 실행 → Explore 첫 진입.
4. `/v1/feed-revision` rows read 확인. cold 작은 head read만 허용, warm `R0/W0` 목표.
5. 서로 다른 곡 3개 이상 좋아요.
6. **1분 전** `/v1/me/likes/batch` server mutation 0 확인.
7. **1분 후** `/v1/me/likes/batch` 1 request인지 확인하고 D1 rows/query + R2 A/B 기록.
8. 10분 scheduled aggregate 후 canonical likes / public count / Feed / Profile 수렴과 aggregate 비용 확인.
9. PC↔모바일 canonical like state 확인.
10. 실제 값으로 100,000 DAU × 30 likes/day 월비용 재계산.

## 합격선
- 좋아요 UI 즉시 반응.
- PREVIEW 1분 전 좋아요 batch 요청 0.
- N곡 변경 → 1분 후 HTTP batch 1회.
- batch intake가 곡별 canonical/stat write를 즉시 반복하지 않음.
- public count/derived는 scheduled changed-track aggregate.
- unchanged cached Explore 진입 때문에 changed-ID journal replay 금지.
- revision cold 작은 head query만, warm R0/W0.
- full scan/rebuild 없음.
- TEST/PRODUCTION 영향 없음.

## 절대 금지
- canonical user data 삭제/백필/덮어쓰기.
- shared D1 추가 migration 임의 실행.
- Music Note 약 60초 묶음 저장 변경.
- Library Local First 변경.
- UI/반응형 임의 변경.
- 사용자 `테스트배포` 요청 전 main 변경.
- 명확한 승인 없는 PRODUCTION 변경/배포.

## 현재 판정
- PREVIEW app 053 / 037 one-minute test window: **PASS — Run `34525268095`**.
- PREVIEW Worker 035 + 036: 이전 배포 PASS 유지.
- 053 실제 사용자 first-entry / authenticated batch cost: **재실측 전**.
- TEST promotion: **아직 금지 — PREVIEW 비용 검증 전**.
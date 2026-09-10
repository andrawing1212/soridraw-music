# NEXT CODEX TASK

상태: **PREVIEW Worker 036 revision head-only 배포 PASS — 사용자 CACHE LIVE 첫 Explore 진입 재실측 + 035 좋아요 비용 측정**

## 현재 기준
- branch: `preview`
- PREVIEW app: 052 + 034 client 4분 user-level batch
- PREVIEW app Run: `34506474866` — PASS
- PREVIEW Worker: 035 deferred aggregate + 036 revision head-only
- PREVIEW Worker 036 Run: `34521740340` — PASS
- PREVIEW Worker active Version: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- 036 source target: `f2b277266f11d02af1a91d52de8a92fe67f1d16a`
- Shared D1 035 schema Run: `34511788949` — PASS
- 실제 URL: `https://preview.soridraw.com/`
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 036 문제와 수정
사용자 실측:
- 앱 실행 후 Explore 첫 진입 `/v1/feed-revision` 약 `R448/W0`.

원인:
- revision endpoint가 버전만 확인하지 않고 `syncDerivedCache032`까지 실행.
- cold/stale feed cursor일 때 changed-ID journal replay + item/rank/profile delta 적용이 revision 요청에 같이 붙음.

수정:
- `cloudflare/explore-worker/canonical/preview-entry.js`가 `/v1/feed-revision`만 head-only로 처리.
- cold: derived state + feed latest seq 작은 SELECT 1회.
- warm 10초 Edge head cache: D1 R0/W0.
- 실제 revision이 달라진 경우에만 클라이언트가 `/v1/feed`를 받아 기존 bounded delta sync를 수행.
- 모든 다른 API와 035 scheduled aggregate는 기존 complete Worker에 그대로 위임.

실제 배포 smoke:
- first revision: `R2/W0`, mode `HEAD-ONLY-036`.
- next warm revision: `R0/W0`, mode `HEAD-ONLY-036`.
- Feed/Profile/batch route/10-min cron PASS.
- TEST/PRODUCTION Worker unchanged PASS.

## 배포 파이프라인 주의
- 첫 036 Run `34521580233`은 실제 배포 전에 preflight FAIL; Worker 비변경.
- 원인은 최초 035 활성화 때만 필요한 `pending queue=0` gate가 일반 후속 Worker release에도 남아 있던 것.
- 035 운영 중 10분 aggregate 사이 pending row 존재는 정상.
- workflow `7cd70bc5d4d9082b8582804f62587493cb693b8e`에서 schema/processor 존재는 계속 검사하되 pending count는 정보로만 기록하도록 수정.
- 성공 Run `34521740340`에서 live pending=1 상태로 one-shot preflight + deploy + smoke 전체 PASS.
- 이후 일반 PREVIEW Worker release는 이 정상 pending 때문에 막히면 안 됨.

## 현재 Worker 배포 계약
`canonical Worker/entry → one-shot preflight → deploy once → live smoke`

금지:
- live source 다운로드 + patch replay
- 031→032→033→034→035 누적 patch 배포
- Worker release 내부 migration
- 원인을 모른 채 반복 retry

## 다음 실제 작업
새 구조 수정부터 하지 않는다. 사용자 실측으로 036과 035를 확인한다.

1. CACHE LIVE 진단 초기화.
2. 앱 실행 → Explore 첫 진입.
3. `/v1/feed-revision` rows read 확인. 기존 R448 journal replay가 없어야 한다. cold 작은 head read만 허용.
4. Explore 재진입/warm revision은 `R0/W0` 목표.
5. 서로 다른 곡 3개 이상 좋아요.
6. 첫 좋아요 후 4분 전 server mutation 0 확인.
7. 4분 마감 `/v1/me/likes/batch` 1 request의 D1 R/W + R2 A/B 기록.
8. 10분 aggregate 후 public count/Feed/Profile 수렴과 aggregate 비용 확인.
9. PC↔모바일 canonical like state 확인.
10. 실제 값으로 100,000 DAU × 30 likes/day 월비용 재계산.

## 합격선
- unchanged cached Explore 진입 때문에 changed-ID journal replay 금지.
- revision cold는 작은 head query만; warm은 R0/W0.
- 실제 변경이 있을 때만 `/v1/feed` bounded delta sync.
- 좋아요 UI 즉시 반응.
- 4분 전 좋아요 canonical mutation 0.
- N곡 user change → HTTP batch 1회.
- public count/derived는 changed-track aggregate.
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
- 036 source/preflight: PASS.
- PREVIEW Worker 036 deploy: PASS — Run `34521740340`.
- active Version: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`.
- revision live smoke cold `R2/W0`, warm `R0/W0`: PASS.
- user CACHE LIVE first-entry identical-condition retest: **미검증**.
- 035 authenticated like intake/aggregate cost: **실측 전**.
- TEST promotion: **아직 금지 — PREVIEW 비용 검증 전**.

# NEXT CODEX TASK

상태: **PREVIEW Worker 035 배포 PASS + Worker 배포 구조 43초로 정상화 — 다음은 실제 035 비용 측정**

## 현재 기준
- branch: `preview`
- PREVIEW app: 052 + 034 client 4분 user-level batch
- PREVIEW app Run: `34506474866` — PASS
- PREVIEW Worker: 035 deferred aggregate
- PREVIEW Worker Run: `34519328112` — PASS
- PREVIEW Worker active Version: `8fe58486-91c6-43dc-af7c-eb7945448054`
- 035 release target: `e6ae6a17933d25c3ae3db1475d8c5bfabbc78ed0`
- Shared D1 035 schema Run: `34511788949` — PASS
- 실제 URL: `https://preview.soridraw.com/`
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 새 PREVIEW Worker 배포 계약
일반 기능 release에서는 아래 순서만 사용한다.

`complete canonical Worker → one-shot preflight → deploy once → live smoke`

금지:
- live Worker source 재다운로드 후 patch replay
- 031→032→033→034→035 누적 patch 배포
- 배포 때 config 동적 재조립
- 기능 작업 중 workflow 즉흥 수정/반복 재시도
- Worker release 안에서 D1 migration 실행

현재 canonical files:
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
- `cloudflare/explore-worker/canonical/source-sha256.txt`

Run `34519328112` 실제 end-to-end: 약 **43초**.
이 시간을 현재 PREVIEW Worker release 기준점으로 사용한다.

## 035 기능 계약
- client는 클릭 즉시 optimistic UI.
- 사용자당 첫 pending부터 고정 4분 window.
- user batch 최대 50 final track states.
- 4분 내 원상복귀 toggle은 server 0 mutation 가능.
- Worker 035는 public like count/Feed/Profile derived work를 user batch마다 반복하지 않고 deferred aggregate로 모음.
- scheduled processor: `*/10 * * * *`.
- canonical `(uid,track)` like 관계는 정확하게 유지.
- full Feed/Profile scan/rebuild 금지.
- fixture 100 same-track likes → public count/derived update 1회 PASS.
- net-zero aggregate → public count/derived update 0회 PASS.

## 사용자 확정 비용 스트레스 기준
- 100,000 DAU
- 1인 하루 30 likes
- 하루 3,000,000 logical likes
- 월 90,000,000 logical likes

034 실제 user test:
- 3 likes / 1 batch: D1 `R45/W51` → 비용 FAIL.

035 최종 비용은 반드시 실제 PREVIEW 계측값으로 다시 계산한다.

## 다음 실제 작업
새 구조 수정부터 하지 않는다. 먼저 035 live measurement만 한다.

1. PREVIEW에서 같은 사용자로 서로 다른 3곡 이상 좋아요.
2. 4분 전에 server mutation이 발생하지 않는지 확인.
3. 4분 마감에서 `/v1/me/likes/batch` 1 request 확인.
4. 그 intake request의 D1 rows read/write + R2 A/B 기록.
5. scheduled aggregate가 실행된 뒤 public count/Feed/Profile 수렴 확인.
6. aggregate 실행 자체의 D1 rows read/write를 가능한 진단 경로로 기록.
7. 같은 곡 like→unlike 원상복귀는 server 0 mutation 확인.
8. PC↔모바일 canonical like state 일치 확인.
9. 실제 수치로 100k×30/day 월비용 재계산.

## 합격선
- UI 즉시 반응.
- 4분 전 mutation 0.
- N곡 user change → HTTP batch 1회.
- public count/derived updates는 user별 반복이 아니라 changed-track aggregate.
- full scan/rebuild 없음.
- unchanged warm revisit R0/W0 유지.
- PC/모바일 canonical state 수렴.
- 실제 월비용이 목표에 못 미치면 남아 있는 **physical D1 writes만** 원인별로 줄인다.

## 절대 금지
- canonical user data 삭제/백필/덮어쓰기.
- 기능 release와 deployment-pipeline refactor 동시 진행.
- Music Note 약 60초 묶음 저장 변경.
- Library Local First 변경.
- UI/반응형 임의 변경.
- 사용자 `테스트배포` 요청 전 main 변경.
- 명확한 승인 없는 PRODUCTION 변경/배포.

## 현재 판정
- 035 source/fixture: PASS.
- shared D1 035 additive prerequisite: PASS.
- PREVIEW Worker 035 deploy: PASS.
- Worker release architecture simplification: PASS, 실제 약 43초.
- live Feed/Profile/route/warm revision: PASS.
- TEST/PRODUCTION Workers: unchanged PASS.
- authenticated 035 like intake/aggregate cost: **실측 전**.
- PC↔mobile final convergence: **미검증**.
- TEST promotion: **아직 금지 — PREVIEW 실사용 비용 검증 전**.

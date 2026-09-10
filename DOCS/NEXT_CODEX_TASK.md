# NEXT CODEX TASK

상태: **Explore 좋아요 034 사용자 4분 multi-track batch PREVIEW 배포 PASS — 실사용 비용/수렴 검증만 남음**

## 현재 기준
- branch: `preview`
- 034 코드 기준: `a2277ff258ab02223187e7f075d9d60d21a141ed`
- PREVIEW Worker 034 Run: `34506266106` — PASS
- PREVIEW Worker active Version: `27cc6139-a59c-41d1-9674-4c710d687050`
- PREVIEW app 052 + 034 client Run: `34506474866` — PASS
- PREVIEW app checkout: `2c069c7a20ad82bb21380f05f282f5ac4cc6cfee`
- 실제 URL: `https://preview.soridraw.com/`
- shared D1 low-write trigger `20260910_03` 적용 상태 유지
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- main / production / TEST / PRODUCTION 배포 비변경 PASS

## 034 현재 배포 검증
- Client 전체 TypeScript: PASS.
- Vite Build: PASS.
- Firebase PREVIEW Hosting: PASS.
- `preview.soridraw.com` exact build: PASS.
- app-version `052`: PASS.
- Worker release patch chain 031→032→033→034: PASS.
- generated Worker 034 verifier: PASS.
- Feed HTTP 200: PASS.
- Public Profile first-view HTTP 200: PASS.
- warm feed revision: 첫 검사 `R2/W0`, 다음 검사 `R0/W0`로 수렴 PASS.
- TEST / PRODUCTION Workers unchanged: PASS.
- TEST / PRODUCTION branch + Hosting HTML unchanged: PASS.
- 새 D1 migration/seed/schema: 없음.
- canonical 사용자 데이터 migration/backfill/delete: 없음.

## 034 기능 계약
- 좋아요 UI 즉시 optimistic.
- Explore와 공개프로필 동일 사용자 공통 persistent outbox.
- 곡별 5초 debounce 폐기.
- 사용자당 첫 pending 시점 기준 고정 4분 window.
- 연속 다른 곡 클릭이 4분 마감을 무한 연장하지 않음.
- 최대 50 unique tracks / batch.
- `POST /v1/me/likes/batch` 1회로 여러 곡 최종 상태 전송.
- 같은 곡이 4분 안에 원상태로 돌아오면 서버 mutation 0 가능.
- Worker 인증/App Check batch당 1회.
- user liked-state R2 sync batch당 1회.
- Feed/Profile eager rebuild 없음; 032 changed-ID journal/revision으로 지연 수렴.
- 기존 single-track endpoint 유지.

## 사용자 확정 비용 스트레스 기준
- 100,000 DAU
- 1인 하루 30 likes
- 하루 3,000,000 logical likes
- 30일 90,000,000 logical likes

기존 033 실제 baseline:
- like `R16/W17`
- unlike 증분 `R17/W13`

034의 목적:
- Worker/auth/R2 요청을 사용자 4분 batch로 크게 축소.
- 4분 내 상쇄 토글을 서버 0 mutation으로 제거.
- 단, 각 최종 변경곡의 canonical likes/stat/derived D1 write는 아직 곡별이므로 034만으로 최종 비용 PASS 선언 금지.

## 다음 실제 작업
새 코드 수정부터 시작하지 않는다. 먼저 PREVIEW 실사용 측정만 한다.

1. CACHE LIVE reset.
2. 한 곡을 좋아요하고 4분 전까지 `좋아요 변경` Worker/D1 mutation이 0인지 확인.
3. 같은 4분 window에서 서로 다른 여러 곡을 좋아요하고 4분 마감 시 Worker 요청이 1 batch인지 확인.
4. 별도 테스트에서 같은 곡 좋아요→해제를 4분 안에 원상복귀시켜 server mutation 0인지 확인.
5. batch당 R2 user liked-state read/write가 1회인지 확인.
6. batch 전체 D1 rows R/W와 변경곡당 평균을 기록.
7. Explore latest/popular likeCount와 공개프로필 likeCount 최종 수렴 확인.
8. 같은 계정 PC↔모바일 최종 좋아요 상태 일치 확인.
9. 실제 034 계측값으로 100,000×30/day 월 비용 재계산.

## 합격선
- UI는 즉시 반응해야 함.
- 첫 4분 전 canonical mutation 0.
- N개 서로 다른 곡이 4분 안에 모이면 Worker 요청 N회가 아니라 1 batch.
- 원상복귀 toggle은 서버 0 mutation 가능해야 함.
- user liked-state R2는 per-track이 아니라 batch당 1 sync.
- mutation 비용은 공개곡/사용자 전체 수에 비례하지 않는 O(1) per changed track.
- Feed/Profile 전체 scan/rebuild 없음.
- warm unchanged revisit `R0/W0` 유지.
- PC/모바일 최종 상태 수렴.
- 이 실측 후에만 비용 최종 PASS/FAIL 판정.

## 후속 비용 단계 — 034 실측 후 필요할 때만
- 공개 likeCount 5~10분 집계.
- 공개프로필 derived 반영 5~10분 집계.
- Explore popular 순위 10~30분 집계.
- shared D1 trigger/aggregation 의미 변경이 필요하면 034와 분리해 별도 설계·감사·승인한다.

## 절대 금지
- 추가 shared D1 migration/seed 임의 실행 금지.
- canonical 사용자 rows 삭제/백필/덮어쓰기 금지.
- Music Note 60초 묶음 저장 변경 금지.
- Library Local First 변경 금지.
- UI/반응형 변경 금지.
- 사용자 `테스트배포` 요청 전 main 변경 금지.
- 명확한 승인 없는 PRODUCTION 변경/배포 금지.

## 현재 판정
- 034 source implementation: **PASS**.
- PREVIEW Worker deploy: **PASS**.
- PREVIEW app deploy: **PASS**.
- TypeScript / Build / Hosting / live exact build: **PASS**.
- Feed/Profile/warm revision smoke: **PASS**.
- shared D1 추가 변경: **없음**.
- live authenticated 4-minute batch cost: **미검증**.
- PC↔모바일 final convergence: **미검증**.
- TEST 승격: **아직 불가 — PREVIEW 실사용 비용/수렴 검증 전**.

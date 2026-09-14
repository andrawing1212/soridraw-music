# NEXT CODEX TASK

상태: **PREVIEW 082 배포 완료 / 실사용 비용 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **082**
- 082 제품 source: `9de67ec57eec1a9fa6c69d81a47c3924a7442398`
- PREVIEW Worker Run `34794135736` — PASS
- PREVIEW Worker active Version: `4b46d3f4-4c4b-4dd2-9584-1b9f0d74ffd5`
- PREVIEW App Run `34794189198` — PASS
- actual `preview.soridraw.com` app version: **082**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 082에서 완료된 것
- 081 page-exit final-state batching 유지.
- Worker 049에서 이미 등록된 여러 publication 변경을 shared canonical read + D1 batch update로 압축.
- 최초 등록은 기존 검증된 단일 publication path 유지.
- mutation hot path의 owner 전체 scan 금지.
- missing publication R2 snapshot을 stale local cache로 오판하지 않고 canonical self-heal 1회 수행.
- healthy warm cache는 revision-first 유지.
- Shared D1 migration/schema 변경 0.
- 사용자 원본 데이터 변경/백필/복제 0.
- UI/CSS/레이아웃 변경 0.
- 082 permanent verifier를 PREVIEW Worker release gate에 포함.

## 자동검증/배포 결과
Preparation Run `34792337510` attempt 2 — PASS.
- TypeScript PASS.
- Build PASS.
- 082 publication-batch regression PASS.
- Explore like/derived-cache/080 publication regression PASS.
- deploy preflight PASS.
- shared D1 schema change 0.

Worker Run `34794135736` — PASS.
- locked source `9de67ec57eec1a9fa6c69d81a47c3924a7442398`.
- Worker 049 active `4b46d3f4-4c4b-4dd2-9584-1b9f0d74ffd5`.
- Feed/Profile smoke PASS.
- warm feed revision actual D1 `R0/W0`, `HEAD-ONLY-036` PASS.
- TEST/PRODUCTION Worker unchanged PASS.

App Run `34794189198` — PASS.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- actual PREVIEW exact build PASS.
- remote `app-version.json = 082` PASS.
- TEST/PRODUCTION page + branch unchanged PASS.

## 다음 작업 — 코드 수정 전에 사용자 PREVIEW 실사용 계측
현재 다음 작업은 새 구현이 아니라 **082가 실제 계정에서도 비용 목표를 만족하는지 측정하는 것**이다.

1. 진단 초기화 후 아무 변경 없이 Explore → Music Note → Library 이동.
   - 합격선: PAGE SYNC NOOP, Worker 0, D1 R0/W0, Firestore R0/W0.
2. 이미 등록된 여러 곡을 공개/비공개로 여러 번 변경 후 페이지를 한 번 나감.
   - 페이지 안 중간 서버 요청 0.
   - page exit publication batch 외부 요청 1회.
   - 실제 D1 rows_read/rows_written이 곡 수만큼 반복 조회되는 구조가 아닌지 확인.
3. 같은 곡 공개→비공개→공개 반복.
   - 최종 상태만 반영되는지 확인.
4. R2 missing/장기 미접속 또는 새 기기 복구.
   - canonical self-heal 1회 후 이후 warm cache에서 반복 전체 읽기가 사라지는지 확인.
5. Explore 좋아요 여러 번 변경 후 페이지 이동.
   - 기존 081 final-state batch 1회 유지.
6. Music Note 상세 여러 필드 수정 후 page exit.
   - idle/detail-close write 0, 최종 변경분만 flush.
7. PC ↔ 모바일 same-account 공개상태/좋아요 수렴 확인.
8. Firestore usage에서 `user_structures` 불필요 write 의심 확인.

## 실패 시에만 다음 PREVIEW 수정
- publication batch 실제 D1 read/write가 곡 수만큼 과도하게 증가하면 083 비용 수정.
- missing R2 self-heal이 정상 warm 사용자에게 반복되면 R2 생성/유지 경로 수정.
- `user_structures` 불필요 write가 확인되면 발생 경로를 분리해 실제 변경 때만 쓰도록 수정.
- 원인을 모른 채 TEST로 승격하지 않는다.

## 승격 기준
- zero-dirty navigation server R/W 0.
- 정상 warm cache 재진입 server read 0 목표.
- 여러 공개/비공개 변경의 외부 batch 1회 + 내부 반복 canonical read 제거가 실제 계정에서도 확인.
- 공개/비공개 상태 정확성 유지.
- 좋아요/Music Note/Library 최종 상태 정확성 유지.
- PC/모바일 수렴 유지.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

TEST: **082 실사용 correctness + 비용 검증 PASS 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.

# NEXT CODEX TASK

상태: **Explore 좋아요 096 코드 PREVIEW 반영 완료 / 자동검증 PASS / 미배포 / 실제 PREVIEW 앱 095 유지 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **095**
- 095 배포 source SHA: `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- 095 App Release Run: `34980745687` — PASS
- 096 제품 commit: `832a5de9e5069f89ed4cd3d0cb2ade99a508965d`
- 096 검증 Run: `34985181700` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 새로 확인된 모바일 문제
PC는 정상인데 모바일에서 일부 곡만 하트는 빨간색이고 숫자가 0 또는 PC보다 1 낮게 남았다.

원인:
- RTDB `userSync/{uid}/exploreLike`는 마지막 signal 하나만 보존.
- 095까지는 각 boundary batch의 현재 결과만 signal `results`에 넣음.
- PC에서 여러 batch가 연속 발생한 뒤 모바일이 늦게 복귀하면 마지막 batch만 남고 앞선 batch의 승인 숫자 delta가 소실됨.
- 그래서 일부 트랙은 하트 membership은 맞지만 승인 count overlay를 놓쳐 부분적으로 0/1 오차가 남음.

## 096 수정
- 현재 batch 결과 + 기존 short-lived account patch cache의 최근 승인 결과를 합쳐 RTDB signal에 replay.
- unique track 기준 최신 상태만 유지.
- 기존 Rules 한도 그대로 최대 50개.
- current batch 결과 우선.
- D1 read 추가 0.
- Firestore read/write 추가 0.
- RTDB Rules 변경 없음.
- Worker/Functions/D1 schema 변경 없음.
- UI/CSS 변경 없음.

변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-096-explore-like-cross-device-replay.mjs`

## 검증
Run `34985181700` PASS:
- TypeScript PASS
- Build PASS
- 094 session batching PASS
- 095 zero-read display PASS
- 096 cross-device replay PASS
- like-cost/D1 fixture PASS
- 085 liked-profile PASS
- 086 liked-sync-repair PASS

## 다음 작업
사용자가 PREVIEW 배포를 승인하면:
1. app version을 다음 PREVIEW 번호로 올림.
2. TypeScript / Build / 094 / 095 / 096 / like-cost 필수 검사 PASS.
3. Firebase PREVIEW Hosting만 배포.
4. Worker 056 / Media Worker / Functions / Rules / D1은 변경이 없으므로 재배포 금지.
5. `preview.soridraw.com` exact build + app version 확인.
6. TEST / PRODUCTION 비변경 확인.

배포 후 실측:
1. PC에서 3~5곡을 한 번에 다 보내지 말고 여러 boundary batch로 나눠 좋아요 확정.
2. 그동안 모바일을 background/미접속 상태로 둠.
3. 모바일 복귀 후 PC와 하트+숫자 비교.
4. `PC 1 / 모바일 0`, `PC 2 / 모바일 1`이 없어야 함.
5. normal Explore 재진입 `내 좋아요 곡 확인` D1 row read 0 유지.
6. 변경 없는 같은 공개프로필 2회 재진입 D1 row read 0 확인.
7. 마지막으로 Cloudflare Analytics/D1 수치를 CACHE LIVE와 대조.

## 승격 금지
- 096 PREVIEW 실제 배포 + PC↔모바일 숫자 수렴 PASS 전 TEST 승격 금지.
- 변경 없는 공개프로필 재진입 0-read 확인 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.

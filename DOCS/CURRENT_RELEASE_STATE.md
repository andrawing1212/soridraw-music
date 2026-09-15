# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **097** — `https://preview.soridraw.com`
- PREVIEW 097 제품 commit: `ae5748298eb612a6d592d58293898a58f8c99872`
- 임시 097 검증 workflow 정리 commit: `d4610414c9d856df101a7d6588dbc61966f8ae18`
- PREVIEW 097 version bump commit: `8951b6d49c5f07e967fa040e2b13f373014b245e`
- PREVIEW 097 배포 source SHA: `c86ed90107ad153255cdb05f38dcfb2426d4c304`
- 097 구현/회귀 검증 Run: `34990998142` — **PASS**
- 097 App Release Run: `34991311092` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 097에서 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. Explore 좋아요 현재 구조
목표:
`좋아요 여러 번 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch 1회 → D1 변경분만 처리 → RTDB는 같은 계정 기기 간 작은 변경 신호만 전달 → 이후 정상 재진입은 로컬/캐시 → D1/Firestore 추가 읽기 0 목표`

유지하는 정상 구조:
- 추천/최신/인기 탭 이동만으로 like flush 없음.
- durable local outbox에 실제 변경을 쌓음.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50에서 batch.
- D1이 실제 좋아요 관계/숫자 처리의 기준.
- RTDB `userSync/{uid}/exploreLike`는 같은 계정 다른 기기에 승인 결과를 전달하는 신호 채널.
- Firestore `users/{uid}`를 Explore-like 동기화용으로 쓰지 않음.
- normal Explore 재진입에서 `/v1/me/liked-tracks` 숫자 복구 read 없음.
- 승인된 display count는 canonical aggregate가 따라올 때까지 로컬에 보존.
- RTDB 마지막 signal에는 최근 승인 track을 unique 기준 최대 50개 replay.

## 3. 096 실사용 FAIL과 097 원인
096 배포 후 PC에서 보이는 좋아요 숫자보다 모바일 숫자가 대부분 정확히 1 낮게 남는 문제가 재현됐다.
예: `PC 1 / 모바일 0`, `PC 2 / 모바일 1`. 빨간 하트 자체는 맞는 경우가 많았다.

실제 원인:
- 모바일 기기에 이전 동작에서 남은 durable pending outbox 항목이 존재할 수 있음.
- 096 코드까지는 pending 항목이 **존재하기만 하면** RTDB에서 온 승인 결과보다 로컬 pending 하트를 우선 보호함.
- pending의 `desiredLiked`가 이미 RTDB의 승인 `liked`와 같은 상태여도 pending을 계속 유지함.
- 그 결과 하트는 빨간색으로 맞지만 `preservePending=true`가 되어 RTDB의 확정 `displayLikeCount` 반영이 차단됨.
- 앱 캐시 삭제로 증상을 숨길 문제가 아니라, 같은 상태의 오래된 pending 자체를 정상적으로 승인/정리해야 하는 문제였음.

## 4. 097 수정
`src/services/exploreLikeService.ts`에서 원격 승인 결과와 durable pending을 다음처럼 처리한다.

- pending 없음 → RTDB 승인 상태/숫자 그대로 적용.
- `pending.desiredLiked === RTDB result.liked` → 이미 서버에서 같은 상태로 승인된 것으로 판단, 해당 pending 삭제/저장 후 RTDB 확정 하트+숫자 적용.
- `pending.desiredLiked !== RTDB result.liked` → 이 기기에서 더 새롭게 누른 반대 의도로 보고 기존 local pending 보호.

따라서 오래된 같은-state pending 때문에 확정 숫자가 막히는 문제만 제거하고, 실제로 더 새로운 사용자 입력은 그대로 보호한다.

097 제품 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-097-explore-like-pending-ack.mjs`

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 5. 097 자동검증
최종 검증 Run `34990998142` — **PASS**:
- TypeScript PASS
- Build PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 회귀 PASS
- 096 cross-device replay 회귀 PASS
- 097 matching-pending acknowledgement 검증 PASS
- like-cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS
- 변경 범위 guard PASS
- 추가 D1/Firestore recovery read 없음
- 전체 Feed/Profile/tracks scan 없음

참고:
- 앞선 Run `34990747696`은 제품/TypeScript/Build/094~097/비용/085/086 검증 자체는 모두 PASS였으나 Build가 만든 tracked `dist` 산출물이 scope guard에 잡혀 마지막 housekeeping guard만 FAIL.
- source 수정 범위가 아닌 검증 절차 문제였고, `dist`를 검증 전 원복하도록 guard를 수정한 Run `34990998142`에서 전체 PASS 후 제품 commit을 생성했다.
- FAIL Run에서는 제품 commit/push/deploy가 실행되지 않았다.

## 6. PREVIEW 097 배포 결과
사용자 명확한 수정+배포 승인 후 canonical PREVIEW App Release 경로로 **Firebase PREVIEW Hosting만** 배포했다.

Run `34991311092` — **PASS**:
- locked source SHA: `c86ed90107ad153255cdb05f38dcfb2426d4c304`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 `app-version.json = 097` PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

097에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 7. 사용자 데이터 / 비용 영향
- 사용자 원본 데이터 변경 없음.
- migration/backfill/delete/overwrite 없음.
- 좋아요 실제 저장은 기존 D1 batch 구조 유지.
- 097 fix 자체는 기존 RTDB 승인 신호를 받아 로컬 pending을 정리하는 클라이언트 처리이며 **추가 D1 read 0 / 추가 Firestore read·write 0 목표**.
- 같은 상태 pending 정리 때문에 새 서버 요청을 만들지 않음.
- 정상 Explore 재진입의 liked-tracks recovery read를 재도입하지 않음.

## 8. PREVIEW 097 실사용 합격선
1. 모바일 앱 캐시를 지우지 않은 상태 그대로 097 진입.
2. 096에서 틀렸던 같은 곡들의 PC/모바일 빨간 하트 + 숫자 비교.
3. `PC 1 / 모바일 0`, `PC 2 / 모바일 1`이 사라지고 동일 숫자로 수렴해야 함.
4. PC에서 여러 곡 좋아요를 서로 다른 boundary batch로 확정하고 모바일을 잠시 background/미접속 상태로 둔 뒤 복귀하여 동일 상태 확인.
5. 모바일에서 PC 승인 이후 반대 상태를 새로 누른 경우 그 최신 모바일 입력은 덮어쓰지 않아야 함.
6. Explore 내부 탐색만으로 server like request/write 0 유지.
7. 의미 있는 경계에서만 `/v1/me/likes/batch` batch 처리.
8. normal Explore 재진입 `내 좋아요 곡 확인` D1 row read 0 유지.
9. Firestore Explore-like users write/listener read 연쇄 0 유지.
10. CACHE LIVE 초기화 후 변경 없이 같은 공개프로필 2회 재진입에서 원본 D1 read 0 확인.
11. Cloudflare Analytics/D1 실제 Rows read/written 증가분을 CACHE LIVE와 최종 대조.

FAIL 조건:
- 빨간 하트 + 숫자 0/1 부족 재현.
- 097 때문에 D1/Firestore read 추가.
- Explore 내부 탐색만으로 batch 발생.
- normal re-entry에서 liked-tracks row read 재발.

## 9. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- Explore: durable like outbox + boundary/max-50 batch + RTDB recent replay 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 10. TEST / PRODUCTION 승격
- TEST: **097 PREVIEW PC↔모바일 숫자 수렴 + 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 알려진 위험
- RTDB replay window는 기존 Rules 한도에 맞춰 최대 50개 최근 승인 track이다.
- 매우 오래 오프라인이거나 50개를 넘는 서로 다른 변경을 놓친 예외는 별도 recovery 정책 검토 대상이며, 이를 이유로 평상시 D1 전체 좋아요 조회를 재도입하지 않는다.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.
- `preview`, `main`, `production` 보호 API 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.

## 12. 다음 작업
- PREVIEW 097에서 **캐시 삭제 없이** PC↔모바일 좋아요 숫자 수렴 실측.
- 변경 없는 동일 공개프로필 2회 재진입 D1 read 0 실측.
- Firestore Explore-like read/write 0 유지 확인.
- Cloudflare Analytics/D1 수치를 CACHE LIVE와 최종 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.

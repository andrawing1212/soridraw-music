# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **096** — `https://preview.soridraw.com`
- PREVIEW 096 제품 commit: `832a5de9e5069f89ed4cd3d0cb2ade99a508965d`
- PREVIEW 096 version bump commit: `5de141a4f957da9e73827a65c9921cd9c9175372`
- PREVIEW 096 배포 source SHA: `5a432fcb83f0edc4d05f7309e32ffd5df80ce7a0`
- 096 구현/회귀 검증 Run: `34985181700` — **PASS**
- 096 App Release Run: `34987925158` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 096에서 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. Explore 좋아요 현재 구조
목표:
`좋아요 여러 번 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch 1회 → D1 변경분만 처리 → 이후 정상 재진입은 로컬/캐시 → D1 추가 읽기 0 목표`

095에서:
- 5초 자동 like batch 제거.
- 추천/최신/인기 탭 이동만으로 flush 없음.
- durable local outbox + Explore 이탈/공개프로필 진입·복귀/app hidden/max50 batch 유지.
- normal display/re-entry의 `/v1/me/liked-tracks` zero-count 복구 fetch 제거.
- 실제 승인된 acknowledged 숫자는 canonical aggregate가 따라올 때까지 보존.
- Firestore Explore-like sync write 없음.
- 데스크톱 실사용에서 좋아요 저장 D1 row read 0, `내 좋아요 곡 확인` 정상 재진입 D1 row read 0 확인.

## 3. 096에서 수정한 PC↔모바일 숫자 불일치
095 실사용에서 PC는 정상 숫자인데 모바일이 일부 곡에서 빨간 하트 + 0, 또는 PC보다 1 낮은 숫자를 보였다.

원인:
- RTDB `userSync/{uid}/exploreLike`는 마지막 signal 객체 1개만 유지.
- 095까지는 현재 boundary batch 결과만 `results`에 기록.
- PC가 여러 boundary batch를 보낸 뒤 모바일이 늦게 붙으면 앞선 batch의 승인 count overlay가 RTDB에서 덮어써져 사라짐.
- membership/하트는 맞아도 놓친 이전 batch의 `displayLikeCount`가 모바일에 재생되지 않아 부분 0/1 오차 발생.

096 수정:
- 현재 batch 결과를 가장 먼저 포함.
- 기존 short-lived account patch cache의 최근 승인 결과를 unique track 기준으로 합쳐 RTDB signal에 replay.
- 기존 Rules 한도 그대로 최대 50곡.
- 같은 track은 최신 상태 1개만 유지.
- current batch 우선.
- 추가 D1 read 0.
- 추가 Firestore read/write 0.
- RTDB Rules 변경 없음.
- Worker/Functions/D1 schema/UI/CSS 변경 없음.

096 제품 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-096-explore-like-cross-device-replay.mjs`

## 4. 096 자동검증
Run `34985181700` — **PASS**:
- TypeScript PASS
- Build PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 회귀 PASS
- 096 cross-device replay PASS
- like-cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS
- D1/Firestore 추가 read 없음
- 전체 Feed/Profile/tracks scan 없음
- 사용자 데이터 migration/backfill/delete/overwrite 없음

## 5. PREVIEW 096 배포 결과
사용자 승인 후 canonical PREVIEW App Release 경로로 **Firebase PREVIEW Hosting만** 배포했다.

Run `34987925158` — **PASS**:
- locked source SHA: `5a432fcb83f0edc4d05f7309e32ffd5df80ce7a0`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 `app-version.json = 096` PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

096에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 6. 사용자 데이터 / 구조 영향
- 사용자 원본 데이터 변경 없음
- migration/backfill/delete/overwrite 없음
- Firestore schema/rules 변경 없음
- D1 schema/migration/seed 변경 없음
- Firebase Functions 변경 없음
- Cloudflare Worker 변경 없음
- TEST / PRODUCTION 코드·Hosting·Worker 변경 없음

## 7. 096 실사용 합격선
1. PC에서 3~5곡 좋아요를 서로 다른 boundary batch로 나눠 확정.
2. 그동안 모바일을 background/미접속 상태로 둠.
3. 모바일 복귀 후 PC/모바일 빨간 하트 + 숫자가 동일하게 수렴.
4. `PC 1 / 모바일 0`, `PC 2 / 모바일 1` 재현 없음.
5. Explore 내부 탐색 중 서버 like request/write 0 유지.
6. 의미 있는 경계에서만 `/v1/me/likes/batch` batch 처리.
7. normal Explore 재진입에서 `내 좋아요 곡 확인` D1 row read 0 유지.
8. Firestore Explore-like users write/listener read 연쇄 0 유지.
9. CACHE LIVE 초기화 후 **변경 없이 같은 공개프로필 2회 재진입**에서 원본 D1 read 0 확인.
10. 마지막으로 Cloudflare Analytics/D1 실제 rows read/written 증가분을 CACHE LIVE와 대조.

FAIL 조건:
- 부분적인 빨간 하트 + 0 또는 PC/모바일 숫자 1차이 재현.
- 096 때문에 D1/Firestore read 추가.
- Explore 내부 탐색만으로 batch 발생.
- normal re-entry에서 liked-tracks row read 재발.

## 8. Cloudflare 비용 최종 대조 방법
- Cloudflare Dashboard → **D1** → PREVIEW DB `soridraw-explore-preview-db` → Metrics/Analytics에서 테스트 시간대의 **Rows read / Rows written** 증가분 확인.
- PREVIEW D1 ID 기준: `aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f`.
- Workers & Pages → PREVIEW Explore Worker `soridraw-explore-preview` → Observability/Analytics에서 같은 시간대 요청 수와 예기치 않은 background 호출 확인.
- 테스트 직전 CACHE LIVE 초기화 및 D1 Metrics 기준값 캡처 → 좋아요 여러 개 → Explore 내부 이동 → 한 번 이탈 → 재진입 → 종료 후 증가분 비교.
- CACHE LIVE가 like D1 row read 0인데 Cloudflare 실제 Rows read가 크게 증가하면 foreground 패널 밖의 background/scheduled/query 경로를 별도 추적한다.

## 9. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- Explore: durable like outbox + boundary/max-50 batch 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 10. TEST / PRODUCTION 승격
- TEST: **096 PREVIEW PC↔모바일 숫자 수렴 + 변경 없는 공개프로필 0-read 확인 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 알려진 위험
- 096 replay window는 기존 RTDB Rules 한도에 맞춰 최대 50개 최근 승인 track이다.
- 매우 오래 오프라인이거나 50개를 넘는 서로 다른 변경을 놓친 예외는 별도 recovery 정책 검토 대상이다. 이를 이유로 평상시 D1 전체 좋아요 조회를 재도입하지 않는다.
- `preview`, `main`, `production` 보호 API 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.

## 12. 다음 작업
- PREVIEW 096에서 PC↔모바일 replay 수렴 실측.
- 변경 없는 동일 공개프로필 2회 재진입 D1 read 0 실측.
- Cloudflare Analytics/D1 수치를 CACHE LIVE와 최종 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **095** — `https://preview.soridraw.com`
- PREVIEW 095 제품 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0`
- PREVIEW 095 version bump commit: `4c665280176759ffb792369068bc3b5ace747447`
- PREVIEW 095 배포 source SHA: `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- PREVIEW 095 구현/회귀 검증 Run: `34979498452` — PASS
- PREVIEW 095 App Release Run: `34980745687` — PASS
- **현재 PREVIEW 코드 096 후보 commit: `832a5de9e5069f89ed4cd3d0cb2ade99a508965d` — 검증 완료 / 미배포**
- 096 구현/회귀 검증 Run: `34985181700` — PASS
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. 095에서 해결된 것
목표:
`좋아요 여러 번 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 페이지/의미 있는 경계에서 batch 1회 → D1 변경분만 처리 → 이후 정상 재진입은 로컬/캐시 → D1 추가 읽기 0 목표`

095에서:
- 5초 자동 like batch 제거.
- 추천/최신/인기 탭 이동만으로 flush 없음.
- durable local outbox + Explore 이탈/공개프로필 진입·복귀/app hidden/max50 batch 유지.
- 일반 like display/re-entry의 `/v1/me/liked-tracks` zero-count 복구 fetch 제거.
- 실제 승인된 acknowledged 숫자는 canonical aggregate가 실제 따라올 때까지 보존.
- refresh 시간만 지났다는 이유로 승인 숫자를 삭제하던 경로 제거.
- Firestore Explore-like sync write 없음.

데스크톱 실사용 영상에서는:
- `좋아요 변경 묶음 저장`: Worker 4 / D1 query R0 W4 / cumulative rows R0 W4.
- `내 좋아요 곡 확인`: LOCAL 3 / Worker 0 / D1 R0 W0 / cumulative rows R0 W0.
- Firestore Browser SDK R0/W0.
- `빨간 하트 + 0` 재현 없음.
- 094의 정상 재진입 R28 재발 없음.

## 3. 모바일에서 남은 0/1 불일치 — 2026-09-15
사용자 PC/모바일 같은 계정 비교에서 다음이 확인됨.
- PC는 정상 숫자: 예) Hold the line 1, Secret Code in Dreams 1, 소스록 2.
- 모바일은 하트는 빨간색인데 일부 숫자가 이전 값으로 남음: 예) Hold the line 0, Secret Code in Dreams 0, 소스록 1.
- 일부 곡(Through the Night, Nu Jazz)은 1로 정상 수렴.

정확한 원인:
- RTDB `userSync/{uid}/exploreLike`는 **마지막 signal 객체 1개만 유지**한다.
- 095까지는 각 boundary batch가 성공할 때 그 **현재 batch 결과만** `results`로 덮어썼다.
- PC에서 여러 boundary batch가 연속 발생한 뒤 모바일이 늦게 붙으면, RTDB에는 마지막 batch만 남아 앞선 batch의 `displayLikeCount` 변화가 사라진다.
- 모바일은 membership/하트 상태는 다른 캐시/신호로 수렴할 수 있지만, 놓친 이전 batch의 승인 숫자 delta는 못 받아 `빨간 하트 + 0` 또는 PC보다 1 낮은 숫자가 부분적으로 남는다.
- 즉 이번 모바일 오류는 D1 aggregate 문제가 아니라 **단일 RTDB signal 덮어쓰기 때문에 여러 batch 중 일부 승인 숫자가 다른 기기에 재생되지 않는 문제**다.

## 4. Explore 좋아요 096 — 코드 반영 완료 / 미배포
096은 RTDB 구조/Rules/D1을 새로 늘리지 않고 기존 신호를 보강한다.

핵심:
- 현재 batch 결과를 가장 먼저 포함.
- 기존 short-lived account patch cache의 최근 승인 결과를 unique track 기준으로 합침.
- RTDB `results`를 **최근 승인 트랙 replay 묶음**으로 보냄.
- 기존 RTDB Rules 한도 그대로 **최대 50곡**.
- 같은 트랙은 최신 결과 1개만 유지.
- 현재 batch 결과가 cache/storage 실패 때문에 빠지지 않도록 current 결과 우선.
- 추가 D1 read 0.
- 추가 Firestore read/write 0.
- RTDB Rules 변경 없음.
- Worker/Functions/D1 schema 변경 없음.

의도한 효과:
- PC에서 여러 boundary batch가 연속 발생해도 모바일이 나중에 붙었을 때 마지막 batch 하나만 받는 것이 아니라 최근 승인 트랙들을 한 번에 재생.
- 모바일의 `빨간 하트 + 0`, `PC 2 / 모바일 1` 같은 부분 누락을 제거.
- 095의 Explore 내부 0-write / 경계 batch / normal re-entry D1 read 0 구조는 그대로 보호.

096 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-096-explore-like-cross-device-replay.mjs`

제품 diff는 위 2개 파일뿐. 임시 검증 workflow는 검증 후 삭제 완료.

## 5. 096 검증 결과
Run `34985181700` — **PASS**:
- TypeScript PASS
- Build PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 회귀 PASS
- 096 cross-device replay verifier PASS
- like-cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS

비용/안전:
- D1 read 추가 없음.
- Firestore API 추가 없음.
- RTDB Rules 확장 없음.
- 전체 Feed/Profile/tracks scan 없음.
- 사용자 원본 데이터 변경/migration/backfill 없음.
- UI/CSS 변경 없음.

## 6. 배포 상태
- **실제 PREVIEW는 아직 095.**
- 096은 GitHub `preview` 코드에만 반영되어 있고 미배포.
- Explore Worker 056 / Media Worker / Functions / RTDB Rules / Firestore Rules / D1은 변경·재배포 없음.
- TEST / PRODUCTION 변경 없음.
- 사용자 데이터 변경 없음.

## 7. 096 배포 후 실사용 합격선
1. PC에서 서로 다른 곡 좋아요를 여러 boundary batch로 나눠 확정.
2. 모바일을 나중에 열거나 복귀.
3. PC/모바일의 빨간 하트 + 숫자가 동일하게 수렴.
4. `PC 1 / 모바일 0`, `PC 2 / 모바일 1` 재현 없음.
5. Explore 내부 탐색 중 server like request/write 0 유지.
6. 의미 있는 경계에서만 `/v1/me/likes/batch` 묶음 처리.
7. 일반 Explore 재진입에서 `내 좋아요 곡 확인` D1 row read 0 유지.
8. Firestore Explore-like users write/listener read 연쇄 0 유지.
9. 변경 없는 동일 공개프로필 재진입 D1 read 0 확인.
10. Cloudflare Analytics/D1에서 background processor row read/write를 CACHE LIVE와 대조.

FAIL 조건:
- 부분적인 빨간 하트 + 0 또는 PC/모바일 숫자 1차이 재현.
- 096 때문에 D1/Firestore read가 추가됨.
- Explore 내부 탐색만으로 batch 발생.
- normal re-entry에서 liked-tracks row read 재발.

## 8. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- Explore: durable like outbox + boundary/max-50 batch 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 9. TEST / PRODUCTION 승격
- TEST: **096 PREVIEW 배포 + PC↔모바일 숫자 수렴 + 변경 없는 공개프로필 0-read 확인 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 10. 알려진 위험
- 096 replay window는 기존 RTDB Rules 한도에 맞춰 최대 50개 최근 승인 트랙이다. 일반 사용의 여러 boundary batch 누락 복구가 목적이다.
- 매우 오래 오프라인이거나 50개를 넘는 서로 다른 변경을 놓친 예외는 별도 recovery 정책 검토 대상이다. 이를 이유로 평상시 D1 전체 좋아요 조회를 재도입하지 않는다.
- `preview`, `main`, `production` 보호 API의 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.

## 11. 다음 작업
- 사용자 승인 시 096을 다음 PREVIEW 앱 버전으로 Firebase PREVIEW Hosting만 배포.
- 배포 후 PC에서 3~5곡을 여러 boundary batch로 나눠 좋아요 → 모바일 복귀 순서로 숫자 수렴 확인.
- CACHE LIVE 초기화 후 변경 없는 공개프로필 재진입 2회 D1 read 0 확인.
- 마지막으로 Cloudflare Analytics/D1 계정 수치를 CACHE LIVE와 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.

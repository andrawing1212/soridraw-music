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
- PREVIEW 095 구현/회귀 검증 Run: `34979498452` — **PASS**
- PREVIEW 095 App Release Run: `34980745687` — **PASS**
- 현재 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 이번 배포 비변경
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 이번 배포 비변경
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. 094 실사용에서 확인된 문제
094에서는 Explore 내부 여러 좋아요가 5초마다 서버로 나가지 않고, 공개프로필 진입 등 의미 있는 경계에서 `/v1/me/likes/batch` 한 번으로 묶이는 구조는 정상에 가까웠다. Firestore Browser SDK read/write도 해당 좋아요 테스트에서 0을 유지했다.

하지만 일부 곡에서 서버 승인된 좋아요 숫자를 보존하던 local `accepted` 표시 상태가 10분 refresh deadline 이후 너무 일찍 제거될 수 있었다.

결과:
`빨간 하트 유지 → 숫자만 0으로 fallback → zero-count recovery → /v1/me/liked-tracks → D1 row read R28`

즉 **숫자 0 역행과 D1 R28은 같은 원인 사슬**이었다.

## 3. Explore 좋아요 095 — PREVIEW 배포 완료
목표:

`좋아요 여러 번 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 페이지/의미 있는 경계에서 batch 1회 → D1 변경분만 처리 → 이후 정상 재진입은 로컬/캐시 → D1 추가 읽기 0 목표`

095 수정:
- 일반 like display/re-entry에서 `/v1/me/liked-tracks` zero-count recovery 호출 제거.
- display-state 서비스에서 숫자 복구를 위한 fetch/AppCheck/Cloudflare network 의존 제거.
- 서버에서 실제 승인된 local acknowledged count는 canonical aggregate가 **실제 숫자까지 따라온 경우에만** 해제.
- refresh 시간만 지났다는 이유로 숫자를 버리던 `confirmAccepted` 경로 제거.
- 승인된 local count 상태를 7일 안전창으로 보존. 가짜 0→1 보정이 아니라 실제 승인된 `base + delta`만 유지.
- 094 durable outbox / Explore 경계 batch / max 50 / RTDB 승인 변경 신호 구조 유지.
- `/v1/me/liked-tracks`는 좋아요 곡 상세가 로컬에 실제로 없을 때의 bounded missing-detail 용도만 유지.
- CACHE LIVE 주요 경로 한글화:
  - `/v1/me/liked-tracks` → `내 좋아요 곡 확인`
  - `/v1/me/likes/batch` → `좋아요 변경 묶음 저장`
  - `/v1/me/likes` → `좋아요 상태 확인`

095 제품/검증 변경 파일:
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/lib/cloudflareDiagnostics.ts`
- `scripts/verify-093-explore-like-rtdb-zero-count.mjs`
- `scripts/verify-095-explore-like-zero-read-display.mjs`

UI/CSS 변경 없음.

## 4. 095 자동검증
최종 구현/회귀 Run `34979498452` — **PASS**:
- TypeScript PASS
- Build PASS
- RTDB/Firestore-zero-write 계약 PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 계약 PASS
- like-cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS
- same-track 100 likes fixture: count/derived update 1회로 수렴 PASS
- net-zero cohort: count/derived write 0 PASS
- 전체 Feed/Profile/Firestore full scan 재도입 없음

## 5. PREVIEW 095 실제 배포 결과
사용자 배포 승인 후 canonical PREVIEW app release path로 Firebase Hosting만 배포했다.

Run `34980745687` — **PASS**:
- locked source SHA: `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html`이 로컬 build와 exact hash match — PASS
- 실제 `app-version.json = 095` — PASS
- TEST branch/Hosting 비변경 — PASS
- PRODUCTION branch/Hosting 비변경 — PASS

이번 배포에서 재배포하지 않은 것:
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

PREVIEW/TEST/PRODUCTION 사용자 원본 데이터 공유 원칙 유지. 이번 배포는 기능 코드/Hosting 승격만 수행했다.

## 7. 095 데스크톱 실사용 영상 감사 — 2026-09-15
사용자 제공 약 141초 PREVIEW 095 영상 기준으로 다음을 확인했다.

PASS:
- 시작 시 CACHE LIVE 초기화 상태에서 좋아요 관련 D1 read/write 0.
- Explore 내부 탐색/추천·최신·인기 이동 중 5초 자동 like batch 재발 없음.
- 실제 pending 변경이 있는 경계에서만 `좋아요 변경 묶음 저장` Worker 호출이 증가함.
- 영상 중 여러 번 Explore 밖 이동이 있었지만 pending 변경이 없던 이동에서는 batch가 추가 증가하지 않는 구간 확인.
- 최종 `좋아요 변경 묶음 저장`: Worker 4 / D1 query R0 W4 / cumulative row R0 W4. 즉 영상에서 좋아요 저장 자체는 **D1 row read 0**.
- `내 좋아요 곡 확인`: 최종 LOCAL 3 / Worker 0 / D1 R0 W0 / cumulative row R0 W0. 094에서 발생했던 정상 재진입용 `/v1/me/liked-tracks` R28 재발 없음.
- Firestore Browser SDK 최종 read 0 / write 0 유지.
- `PAGE SYNC`: D1 R0 W0 / Firestore R0 W0.
- 하트/숫자 사례가 Explore ↔ 공개프로필 ↔ Studio 이동 후에도 유지됨. 영상에서 `빨간 하트 + 0` 역행 재현되지 않음.
- 예: `소스록` 좋아요 숫자 2가 공개프로필과 Explore 재진입 후에도 2로 유지되는 장면 확인.

영상 종료 시 CACHE LIVE 총계:
- Cloudflare 앱: LOCAL 15 / Worker 9
- D1 query: R3 / W6
- cumulative rows: R12 / W8
- 이 중 좋아요 batch는 R0/W4, 좋아요 곡 확인은 R0/W0.
- 남은 D1 read는 주로 실제 변경 뒤 공개프로필 조회 및 공개상태 변경 경로에 해당하며, 이번 영상에서는 좋아요 read 회귀로 보이지 않음.

관찰상 큰 오점은 없음. 다만 아래는 **아직 미검증**:
- 같은 계정 PC↔모바일에서 RTDB boundary sync 후 하트+숫자 수렴.
- 장시간/7일 acknowledged 안전창 이후 canonical aggregate 수렴.
- CACHE LIVE에 잡히지 않는 background/scheduled D1 processor의 실제 Cloudflare 계정 단위 비용은 별도 Cloudflare Analytics/D1 실측이 필요.
- 공개프로필 D1 read는 이번 영상에서 실제 좋아요/공개 상태 변경 뒤 발생했으므로 정상 변경 비용으로 보이나, **변경 없는 동일 공개프로필 재진입 D1 read 0**은 별도 한 번 더 확인 필요.

## 8. 095 남은 실사용 합격선
1. PC↔모바일 같은 계정에서 boundary sync 후 하트와 승인 숫자가 같은 상태로 수렴.
2. 변경 없는 동일 공개프로필 재진입에서 원본 D1 read 0.
3. 장시간 뒤에도 승인 숫자가 0/옛 값으로 역행하지 않음.
4. Cloudflare Analytics/D1에서 background processor가 사용자 행동 규모 대비 예상 밖 row read/write를 만들지 않음.
5. Music Note / Recent Songs RTDB 회귀 없음.
6. Catalog 092 Firestore full-scan 재발 없음.

FAIL 조건:
- 빨간 하트 + 0 재현
- 일반 Explore 재진입만으로 liked-tracks D1 row read 발생
- Explore 내부 탐색/탭 전환만으로 batch 발생
- 좋아요 1회가 전체 Feed/Profile/tracks scan 유발
- Firestore Explore-like sync write 재발

## 9. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- Explore: durable like outbox + boundary/max-50 batch 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 10. TEST / PRODUCTION 승격
- TEST: **PC↔모바일 수렴 + 변경 없는 공개프로필 재진입 0-read 확인 전 승격 보류.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 알려진 위험
- 095 데스크톱 단일기기 영상에서는 핵심 좋아요 비용/정확성 목표가 PASS에 가까움.
- 7일 acknowledged local 상태는 실제 승인된 delta만 보존하며 canonical aggregate가 따라오면 해제된다. 장기 재진입에서 이를 확인해야 한다.
- `preview`, `main`, `production` 보호 API의 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.

## 12. 다음 작업
- 같은 계정 PC↔모바일에서 좋아요 boundary sync 후 하트/숫자 수렴 확인.
- CACHE LIVE 초기화 후 **아무 변경 없이 같은 공개프로필 재진입 2회** 하여 D1 row read 0 확인.
- 필요 시 Cloudflare Analytics/D1에서 background processor 비용을 실제 수치로 대조.
- 위 항목까지 PASS 후 TEST 승격 검토.

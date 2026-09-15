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

## 7. 095 실사용 비용/정확성 합격선 — 사용자 검증 전
다음은 실제 계정에서 확인해야 한다.
1. Explore에서 좋아요 2~10개 연속 클릭 중 서버 like request/write 0.
2. 추천/최신/인기 탭 전환만으로 batch 없음.
3. 공개프로필 진입 또는 Explore 밖 이동 시 변경분이 `/v1/me/likes/batch` 1회로 묶임.
4. 서버 승인 뒤 숫자가 0/옛 숫자로 역행하지 않음.
5. 일반 Explore 재진입/재방문만으로 `내 좋아요 곡 확인` 호출 및 D1 row read 0.
6. 정상 local/cache 상태에서 좋아요 관련 D1 추가 read 0 목표.
7. Firestore `users:write` 및 listener read 연쇄 증가 없음.
8. PC↔모바일 boundary sync 후 하트와 승인 숫자가 같은 상태로 수렴.
9. Music Note / Recent Songs RTDB 회귀 없음.
10. Catalog 092 Firestore full-scan 재발 없음.

FAIL 조건:
- 빨간 하트 + 0 재현
- 일반 재진입만으로 liked-tracks D1 row read 발생
- Explore 내부 탐색/탭 전환만으로 batch 발생
- 좋아요 1회가 전체 Feed/Profile/tracks scan 유발
- Firestore Explore-like sync write 재발

## 8. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- Explore: durable like outbox + boundary/max-50 batch 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 9. TEST / PRODUCTION 승격
- TEST: **095 PREVIEW 실사용 비용/정확성 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 10. 알려진 위험
- 095 자동검증과 PREVIEW Hosting 배포는 PASS지만, 실제 사용자 계정의 장기 재진입/PC↔모바일 숫자 수렴은 아직 실사용 검증 전.
- 7일 acknowledged local 상태는 실제 승인된 delta만 보존하며 canonical aggregate가 따라오면 해제된다. 장기 재진입에서 이를 확인해야 한다.
- `preview`, `main`, `production` 보호 API의 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.

## 11. 다음 작업
- PREVIEW 095에서 CACHE LIVE 초기화 후 사용자 실측 진행.
- 좋아요 연속 클릭 → Explore 내부 탐색/대기 → 공개프로필 또는 Explore 이탈 → Explore 재진입 순으로 확인.
- 특히 `내 좋아요 곡 확인`이 일반 재진입에서 0회인지와 숫자 0 역행 재발 여부를 본다.
- 모두 PASS 후에만 TEST 승격을 검토한다.

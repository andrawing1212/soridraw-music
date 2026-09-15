# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **094** — `https://preview.soridraw.com`
- PREVIEW 094 배포 source SHA: `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- PREVIEW 094 App Release Run: `34974907217` — **PASS**
- PREVIEW 094 제품 구현 commit: `bb32b8fd004f6091303d74ad89532b6f87863cd9`
- **현재 PREVIEW 코드 095 후보 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0` — 검증 완료 / 미배포**
- 095 최종 구현/회귀 검증 Run: `34979498452` — **PASS**
- 현재 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 핵심 구현 commit: `87cfb18ed1dd7e1c793550a32c820509ce7ed4a2`
- Worker 056 배포 Run: `34964765640` — PASS
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. 094 실사용에서 확인된 것
PASS에 가까운 항목:
- Explore 안에서 여러 좋아요를 눌러도 5초 자동 batch가 발생하지 않음.
- 추천/최신/인기 탐색 중 좋아요 서버 쓰기 0.
- 공개프로필 진입 등 의미 있는 경계에서 `/v1/me/likes/batch` 1회로 묶임.
- Firestore Browser SDK read/write는 해당 좋아요 테스트에서 0 유지.

FAIL로 확인된 항목:
- 일부 좋아요 곡에서 **빨간 하트인데 숫자가 다시 0으로 역행**.
- 이 모순이 생기면 093의 zero-count 복구 경로가 `/v1/me/liked-tracks`를 호출했고, 실제 CACHE LIVE에서 Worker 1회 / D1 query 1회 / **누적 row read 28**이 관측됨.
- SORIDRAW 비용 기준에서 이 R28 정상경로 반복 가능성은 FAIL.

## 3. 숫자가 0으로 역행한 정확한 원인
094에는 서버 집계가 늦게 따라오는 동안 실제 승인된 좋아요 숫자를 로컬에 유지하는 `accepted` 표시 상태가 있다.

문제는 10분 후 aggregate refresh 시점에 `ExplorePage.tsx`가 `confirmAccepted=true` 성격의 값을 전달했고, `exploreLikeDisplayStateService.ts`가:
- 실제 `track_stats`가 아직 0이어도
- refresh 시간이 지났다는 이유만으로
- local acknowledged count를 강제로 삭제할 수 있었다.

그 결과:
1. 하트 membership은 true라 빨간색 유지
2. 숫자 overlay만 삭제
3. 아직 늦은 canonical `track_stats=0`으로 fallback
4. 화면은 `빨간 하트 + 0`
5. 기존 zero-count recovery가 `/v1/me/liked-tracks`를 호출
6. D1 requested track detail/profile/stats row read가 발생

즉 **숫자 0 역행과 D1 R28은 같은 원인 사슬**이었다.

## 4. Explore 좋아요 095 — 코드 반영 완료 / 미배포
사용자 지시에 따라 최종 목표를 다음으로 고정했다.

`좋아요 여러 번 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 페이지/의미 있는 경계에서 batch 1회 → D1 변경분만 처리 → 이후 정상 재진입은 로컬/캐시 → D1 추가 읽기 0 목표`

095 수정:
- normal like display/re-entry에서 `/v1/me/liked-tracks` zero-count recovery 호출 **완전 제거**.
- display-state 서비스에서 fetch/AppCheck/Cloudflare diagnostic/persistent liked membership recovery 의존 제거.
- 서버에서 실제 승인된 local acknowledged count는 canonical aggregate가 **실제 숫자까지 따라온 경우에만** 해제.
- 단순히 refresh deadline이 지났다는 이유로 accepted 숫자를 삭제하는 `confirmAccepted` 경로 제거.
- local acknowledged 표시 상태 보존 기간을 7일 안전창으로 확대. 가짜 숫자가 아니라 실제 승인된 상태 변화(`base + delta`)만 보존.
- 094의 durable outbox / Explore 경계 batch / max 50 / RTDB 승인 변경 신호 구조는 그대로 보호.
- `/v1/me/liked-tracks`는 공개프로필의 좋아요 곡 상세가 로컬에 실제로 없을 때의 bounded missing-detail 용도로만 남김. warm local liked-song cache는 request-free 유지.
- CACHE LIVE 주요 경로 한글화:
  - `/v1/me/liked-tracks` → `내 좋아요 곡 확인`
  - `/v1/me/likes/batch` → `좋아요 변경 묶음 저장`
  - `/v1/me/likes` → `좋아요 상태 확인`

095 제품/검증 변경 파일 — 정확히 5개:
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/lib/cloudflareDiagnostics.ts`
- `scripts/verify-093-explore-like-rtdb-zero-count.mjs`
- `scripts/verify-095-explore-like-zero-read-display.mjs`

## 5. 095 검증 결과
최종 Run `34979498452` — **PASS**:
- Node 20 Install PASS
- TypeScript PASS
- Build PASS
- 093 RTDB/Firestore-zero-write 계약 PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 계약 PASS
- Node 24 sqlite like-cost fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS

비용 verifier 결과:
- client: 094 boundary batch + acknowledged count convergence PASS
- same-track 100 likes fixture: count/derived update 1회로 수렴 PASS
- net-zero cohort: count/derived write 0 PASS
- 전체 Feed/Profile/Firestore full scan 재도입 없음

095 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0`
- 5 files changed
- UI/CSS 변경 없음
- Worker 변경 없음
- Functions 변경 없음
- RTDB/Firestore Rules 변경 없음
- D1 schema/migration/seed 변경 없음
- 사용자 원본 데이터 변경 없음

작업용 `.github/workflows/temp-095-explore-like-zero-read-count-fix.yml`은 검증 후 삭제 완료.

## 6. 배포 상태
- **실제 PREVIEW Hosting은 아직 094.**
- 095 코드는 GitHub `preview`에만 반영되어 있고 **미배포**.
- Explore Worker 056 변경/재배포 없음.
- Media Worker 변경/재배포 없음.
- Firebase Functions 변경/재배포 없음.
- RTDB Rules / Firestore Rules 변경 없음.
- TEST / PRODUCTION 변경 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

사용자가 PREVIEW 배포를 명확히 지시하기 전에는 095를 배포하지 않는다.

## 7. 095 배포 후 실사용 합격선
1. 좋아요 여러 개 클릭 중 Explore 내부에서는 서버 request/write 0.
2. 추천/최신/인기 탭 전환만으로 batch 없음.
3. 공개프로필 진입 또는 Explore 밖 이동 시 변경분이 `/v1/me/likes/batch` 1회로 묶임.
4. 서버 승인 후 숫자가 0/옛 숫자로 역행하지 않음.
5. 일반 Explore 재진입/재방문만으로 `내 좋아요 곡 확인` D1 read가 발생하지 않음.
6. 정상 local/cache 상태에서 좋아요 관련 D1 추가 read 0 목표.
7. 실제 좋아요 곡 탭의 missing-detail 예외 외에는 `/v1/me/liked-tracks` 사용 없음.
8. Firestore `users:write` 및 listener read 연쇄 증가 없음.
9. PC↔모바일 boundary sync 후 하트와 승인 숫자가 같은 상태로 수렴.
10. Music Note / Recent Songs RTDB, Catalog 092 no-fullscan 회귀 없음.

FAIL 조건:
- 빨간 하트 + 0 재현
- 일반 재진입만으로 liked-tracks row read 발생
- Explore 탭 탐색만으로 batch 발생
- 좋아요 1회가 전체 Feed/Profile/tracks scan 유발
- Firestore Explore-like sync write 재발

## 8. 기존 정상 구조 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 약 60초 묶음 저장 보호.
- 094/095: durable like outbox + boundary/max-50 batch 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 9. TEST / PRODUCTION 승격
- TEST: **095 PREVIEW 실제 배포 + 비용/정확성 실사용 PASS 전 승격 금지.**
- 사용자 데이터는 복사하지 않는다.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 10. 알려진 위험
- 095는 자동검증 PASS지만 실제 PREVIEW 실사용은 아직 미배포/미검증.
- 7일 acknowledged local 상태는 실제 승인된 delta만 보관하며 canonical aggregate가 따라오면 즉시 해제되지만, 실사용에서 PC↔모바일 수렴과 장기 재진입을 확인해야 함.
- `preview`, `main`, `production` 보호 API 응답의 세부 `enabled=false` 표시는 별도 저장소 운영 위험으로 남음.
- 기존 Build chunk-size/mixed import 경고는 이번 기능과 무관하며 미해결.

## 11. 다음 작업
- 사용자 승인 시 095를 다음 PREVIEW 앱 버전으로 Firebase PREVIEW Hosting만 배포.
- Worker/Functions/Rules/D1은 변경이 없으므로 재배포하지 않음.
- 배포 후 CACHE LIVE를 초기화하고 좋아요 클릭 → Explore 내부 탐색 → 공개프로필 경계 → Explore 재진입 순서로 측정.
- 특히 `내 좋아요 곡 확인` row read가 일반 재진입에서 0인지 확인.
- 모두 PASS 후에만 TEST 승격 검토.

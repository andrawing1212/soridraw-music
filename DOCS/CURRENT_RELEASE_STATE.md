# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **091** — `preview.soridraw.com`
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- 091 제품 commit: `22d11a7ce22a5a0ce154b6230278c14b7bdc199f`
- 091 App Run: `34921079977` — **PASS**
- 055 PREVIEW 배포 Run: `34937881843` — **PASS**
- 055 제품 commit: `2a4d7ec35e82448b60d1c5edffa106082017c210`
- Catalog full-scan 차단 기준 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- Catalog 수정 검증 Run: `34946586905` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 배포 없음
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 배포 없음

## 2. 2026-09-15 Catalog Firestore 전체조회 차단 — 코드 반영 완료 / 배포 전
- 문제: 새 기기/오래된 로컬 Catalog에서 profile revision이 R2보다 앞서면 `X-Soridraw-Require-Revision`이 Worker의 `buildCanonicalCatalog()`를 호출해 Music Note `favorites` 전체 + Library `suno_tracks/{uid}/tracks` 전체를 Firestore REST로 다시 읽을 수 있었음.
- 조치: 일반 Catalog GET은 **R2 only**. profile revision은 invalidation hint로만 사용하며 일반 앱 경로에서 hard revision rebuild를 요구하지 않음.
- Worker `getCatalogState()`는 R2 journal/base만 읽고, R2 Catalog가 없으면 `CATALOG_NOT_MATERIALIZED`로 fail-closed. 일반 GET/delta 경로에서 Firestore collection traversal 금지.
- 새 기기 + 기존 R2: Catalog 1회 수신 후 IndexedDB/local cache 사용. Firestore 전체 collection read 0 목표.
- R2 자체가 없는 예외 계정: 자동 전체 스캔 금지. 기존 bounded `user_list_caches` 1문서 fallback만 허용하고 별도 bootstrap/repair로 분리.
- 변경 발행: partial UI list의 누락은 삭제로 간주하지 않고 explicit tombstone만 삭제. delta conflict/count mismatch도 R2 soft refresh만 수행하며 full rebuild 금지.
- 검증: Run `34946586905`에서 TypeScript / Build / Worker syntax / `verify-046-catalog-stale-revision-rebuild.mjs` / diff check **PASS**.
- 변경 파일: `src/lib/userDataEngine.ts`, `cloudflare/media-worker/src/index.js`, `scripts/verify-046-catalog-stale-revision-rebuild.mjs`.
- 사용자 데이터/Firestore schema/Functions/Firebase/Cloudflare live 변경 없음. **아직 PREVIEW Hosting/Media Worker 미배포**.
- TEST `main`과 PRODUCTION에는 기존 Catalog 구조가 남아 있으므로 PREVIEW 실사용 비용 검증 전 승격 금지. 안정화 후 exact PREVIEW tree를 TEST로 승격해 TEST에서도 동일 비용 구조를 맞춘다. PRODUCTION은 명확한 정식배포 승인 전 금지.

## 4. 091 좋아요 표시 구조
090의 페이지별 숫자 불일치 문제를 091에서 수정했다.

원칙:
- Feed/Profile/Liked persistent cache에는 서버/캐시 원본 숫자만 유지.
- 사용자가 방금 누른 좋아요/해제의 화면용 임시 숫자는 별도 로컬 display ledger로 관리.
- Explore / 공개프로필 / 좋아요 곡은 동일 곡에 대해 같은 display ledger 결과를 렌더.
- optimistic 숫자를 persistent card cache에 canonical 값처럼 저장하지 않음.
- 090의 `liked이면 0→1` 임시 floor 제거.
- 5초 batch ACK는 aggregate 완료로 보지 않음.
- aggregate 이후 fresh Feed의 변경된 곡만 관련 raw Profile/Liked cache에 targeted patch.
- 전체 Feed/Profile/Liked scan이나 새 서버 조회를 추가하지 않음.

사용자 실사용 영상에서 091은 이전의 페이지별 숫자 분리 증상이 사라진 것으로 확인됐으며, TEST 승격 전 PC↔모바일 최종 확인은 계속 필요하다.

## 4. Worker 054 — 정상 좋아요 D1 W2 → W1 비용 최적화
### 목적
정상 좋아요 batch마다 D1 `api_rate_limits`에 쓰던 보안 카운터 1행을 hot path에서 제거한다.

### 변경
- 기존 동일 계정+동일 곡 중복 좋아요 방지는 canonical `likes(track_id,user_uid)` 고유 관계/idempotency 구조를 그대로 유지.
- 정상 좋아요 batch의 D1 `api_rate_limits` write 제거.
- API 폭주 방어는 Cloudflare Rate Limiting binding `LIKE_RATE_LIMITER`로 대체.
- PREVIEW 설정: **60 requests / 60s**, user uid key 기준.
- Rate Limiting binding이 없으면 fail-open 하지 않고 `503 RATE_LIMIT_UNAVAILABLE`로 차단.
- 제한 초과는 `429 RATE_LIMITED` + `Retry-After: 60`.
- 기존 5초 batch, max 50, durable outbox, page-exit fallback, account sync, deferred aggregate는 유지.
- UI/CSS 변경 없음.

### 기대 비용
정상 좋아요 1 batch 즉시 D1 write:
- 이전: `api_rate_limits W1 + like queue W1 = W2`
- 054: `like queue W1 = W1`
- `api_rate_limits` hot-path D1 write = **0**

자동 fixture:
- `NORMAL_LIKE_BATCH_EXPECTED_D1_WRITE_ROWS=1`
- `NORMAL_LIKE_BATCH_RATE_LIMIT_D1_WRITE_ROWS=0`
- 100 same-track likes → count/derived update 1회
- net-zero cohort → aggregate/derived write 0

실제 사용자 좋아요 1회에서 Dashboard D1 W1 확인은 배포 후 실사용 검증 항목으로 남는다.

## 5. 054 검증
최종 검증 Run `34924497426` — **PASS**:
- 054 edge rate limiter PASS
- 기존 Explore like cost contract PASS
- W1 queue / deferred aggregate PASS
- 085~091 좋아요 회귀 PASS
- 081 page-exit batching PASS
- 084 publication regression PASS
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Wrangler PREVIEW config dry-run PASS
- validated canonical Worker source 고정 PASS

검증 과정에서 오래된 039/066 전용 verifier가 현재 051/069 구조를 고정값으로 오판하던 부분만 현재 구조에 맞춰 정렬했다. 기능 보호 조건 자체를 완화하지 않았다.

## 6. PREVIEW Worker 054 배포
사용자 승인으로 PREVIEW Worker만 배포 완료.

- 배포 Run: `34929734785` — **PASS**
- 배포 대상: `soridraw-explore-preview`
- Current Version ID: `40d84c03-2aa9-4aaa-8539-676b48c96d6d`
- source SHA256: `86bcfa28512712e4e2c8e221da06ed788abb21aa3177134a98e1f0160d5ba9e4`
- D1 read-only preflight PASS 후에만 deploy 수행
- required derived tables / `seeded=1` / `explore032_*` triggers / like queue processor preflight 통과
- 배포 바인딩 확인:
  - `DB` shared Explore D1
  - `RATE_DB` PREVIEW D1
  - `PROFILE_MEDIA`
  - `EXPLORE_CACHE`
  - `LIKE_RATE_LIMITER` **60 requests/60s**
- 실제 Worker URL `https://soridraw-explore-preview.andrawing1212.workers.dev`
- `/v1/feed-revision?sort=latest` HTTP 200 PASS
- 진단 header `X-SORIDRAW-CF-Worker: 1` PASS
- 해당 revision check D1 R0/W0 PASS
- cron `*/10 * * * *` 유지
- Firebase 앱 재배포 없음 — 앱 091 그대로
- Functions 변경 없음
- D1 schema/migration/user data 변경 없음
- TEST/PRODUCTION Worker 배포 없음

배포에 사용한 `temp-deploy-054-*` Workflow/trigger는 성공 후 제거했다.

## 7. 비용/안전 원칙
계속 보호:
- 좋아요 클릭은 local-first.
- 실제 변경만 기존 **5초 batch + page-exit fallback**으로 서버 전송.
- 변경 없는 페이지 이동/재진입 server R/W 0 목표.
- 앱 업데이트 이유의 전체 cache wipe 금지.
- 전체 Feed/Profile 재조회 금지.
- user Firestore에 liked ID 전체 배열 저장 금지.
- 사용자 데이터 migration/backfill/delete/overwrite 금지.
- 084 공개/비공개 비용 구조 보호.

## 8. 다음 실사용 검증
PREVIEW에서 우선 확인:
1. 좋아요 1곡 → 약 5초 후 Dashboard 즉시 D1 write가 **W1**인지.
2. 같은 곡 빠른 좋아요→해제 → 최종 상태만 반영되고 불필요 aggregate write가 없는지.
3. 여러 곡을 5초 안에 눌렀을 때 한 batch로 묶이는지.
4. Explore / 내 공개곡 / 좋아요 곡의 하트·숫자가 계속 동일한지.
5. PC↔모바일 같은 계정에서 하트/membership/display 숫자 수렴.
6. warm Explore/좋아요곡 재진입 + 변경 없음 server R/W 0 목표.

## 9. 084 공개/비공개 비용 보호
기존 PREVIEW 실측 기준:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`

보호 유지:
- 081 page-exit publication final-state batch
- 082 missing-R2 canonical self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 10. 승격/위험 상태
- PREVIEW 실제: **앱 091 / Worker 054**
- 091: 사용자 영상상 표시 일관성 개선 확인, PC↔모바일 최종 검증 필요
- 054: 검증/배포 PASS, 실제 좋아요 Dashboard W1 실측 필요
- TEST 승격: **실사용 정확성 + 비용 W1 확인 전 금지**
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- GitHub preview branch protection enforcement 비활성 조회 이력은 운영 위험으로 유지 기록

## 11. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- 091 like display ledger
- 084 publication 비용 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

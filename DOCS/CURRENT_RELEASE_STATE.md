# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **092** — `https://preview.soridraw.com`
- PREVIEW 앱 배포 SHA: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- PREVIEW App Run: `34948206737` — **PASS**
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- Explore 055 제품 commit: `2a4d7ec35e82448b60d1c5edffa106082017c210`
- Explore 055 배포 Run: `34937881843` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker 배포 Run: `34946799113` — **PASS**
- Catalog full-scan 차단 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- Catalog 수정 검증 Run: `34946586905` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## 2. 앱 092 — Catalog Firestore 전체조회 차단
문제:
- 새 기기/오래된 로컬 Catalog에서 profile revision이 R2보다 앞서면 과거 경로가 `X-Soridraw-Require-Revision`을 통해 Worker의 `buildCanonicalCatalog()`를 호출할 수 있었고, Music Note `favorites` 전체 + Library `suno_tracks/{uid}/tracks` 전체를 Firestore REST로 다시 읽을 위험이 있었음.

현재 구조:
- 일반 Music Note/Library Catalog GET은 **R2 only**.
- profile revision은 invalidation hint로만 사용하고 일반 앱 경로에서 hard revision rebuild를 요구하지 않음.
- Worker `getCatalogState()`는 R2 journal/base만 읽음.
- R2 Catalog가 없으면 `CATALOG_NOT_MATERIALIZED`로 fail-closed하며 일반 GET/delta 경로에서 Firestore collection traversal 금지.
- 새 기기 + 기존 R2 Catalog: R2 Catalog 1회 수신 → IndexedDB/local cache 저장 → 이후 로컬 우선.
- R2 자체가 없는 예외 계정: 자동 전체 스캔 금지. bounded legacy `user_list_caches` 1문서 fallback만 허용하고 별도 bootstrap/repair 대상으로 분리.
- partial UI list의 누락은 삭제로 해석하지 않음. explicit tombstone만 삭제 권한을 가짐.
- delta conflict/count mismatch도 R2 soft refresh만 수행하며 full rebuild 금지.
- 더 최신인 로컬 Catalog를 더 오래된 R2 응답으로 덮어쓰지 않음.

검증:
- Run `34946586905`: TypeScript PASS / Build PASS / Media Worker syntax PASS / `verify-046-catalog-stale-revision-rebuild.mjs` PASS / diff check PASS.
- 변경 파일: `src/lib/userDataEngine.ts`, `cloudflare/media-worker/src/index.js`, `scripts/verify-046-catalog-stale-revision-rebuild.mjs`.

## 3. PREVIEW 배포 092
사용자 승인으로 PREVIEW 앱 배포 완료.

### Firebase PREVIEW Hosting
- Run `34948206737` — **PASS**
- locked source: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- Node 20 TypeScript PASS
- Build PASS
- Firebase Hosting `soridraw-preview` 배포 PASS
- 실제 `preview.soridraw.com`의 `index.html`이 로컬 build와 SHA 일치 PASS
- 실제 `app-version.json` = **092** PASS
- TEST/PRODUCTION branch + 실제 HTML 비변경 PASS

### PREVIEW Media Worker
Catalog Worker 변경은 preview 반영 시 기존 고정 Workflow로 이미 배포되어 현재 배포 상태를 확인함.
- Run `34946799113` — **PASS**
- checkout source: `9f6db6d34bc2887485da6ab0f945b0e4c4452a08` (Catalog 구현 포함)
- Worker dry-run PASS
- R2 bucket `soridraw-media-preview` 존재/Standard 확인
- Worker deploy PASS
- Current Version ID: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- R2 remote write/read smoke PASS
- Worker health PASS
- PREVIEW CORS PASS
- Firestore write 없음
- Firebase Functions/Hosting 추가 배포 없음
- TEST/PRODUCTION Media Worker 배포 없음

## 4. Explore 좋아요 현재 보호 기준
- Explore / 내 공개곡 / 좋아요 곡의 같은 곡 숫자는 공통 display ledger 기준.
- persistent Feed/Profile/Liked cache에는 raw/canonical 숫자만 유지.
- pending/accepted 화면 숫자는 로컬 overlay로 분리.
- 090의 `0→1` floor 금지.
- Worker batch ACK를 aggregate 완료로 간주하지 않음.
- 5초 batch + page-exit fallback 유지.
- PC↔모바일 account sync signal 유지.

Explore Worker 055:
- 정상 좋아요 신규 intake D1 즉시 write 목표 W1.
- `LIKE_RATE_LIMITER` 60 requests / 60s, uid key.
- canonical `likes(track_id,user_uid)` idempotency 유지.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- 실제 정상 좋아요 Dashboard W1 실측은 계속 필요.

## 5. 사용자 데이터 / 백엔드 변경 여부
- 사용자 원본 데이터 변경: **없음**
- Firestore schema 변경: **없음**
- D1 schema/migration/seed 변경: **없음**
- Firebase Functions 변경: **없음**
- 공유 사용자 데이터 복사/백필/삭제/덮어쓰기: **없음**
- UI/CSS 변경: **없음**
- 변경된 실행환경: Firebase PREVIEW Hosting + PREVIEW Media Worker만.

## 6. 비용 합격선 — 지금 실사용 검증할 것
Catalog 092는 자동검증 PASS지만 **실제 Firestore 비용 검증 전**이다.

우선 확인:
1. 새 브라우저/새 프로필/캐시 없는 기기에서 같은 계정 로그인.
2. Music Note 첫 진입 시 Firestore read가 곡 개수에 비례하지 않는지.
3. Library 첫 진입도 동일하게 확인.
4. Music Note/Library 재진입 + 변경 없음에서 Firestore data read 0 목표.
5. PC↔모바일 한쪽에서 실제 변경 후 다른 기기에서 변경분만 수렴하는지.
6. 앱 092 업데이트 자체만으로 전체 Catalog/Firestore 재구성이 발생하지 않는지.
7. 좋아요 1 batch 즉시 D1 W1 실측.
8. Explore/공개프로필 warm 재진입 + 변경 없음 D1 data read 0 목표.

판정:
- 새 기기에서 곡 30개/300개/10만 개에 비례하는 Firestore read가 발생하면 FAIL.
- Catalog R2 1회 전송은 허용하지만 Firestore 전체 collection 재조회는 금지.
- 원인을 모르는 read/write 증가가 보이면 TEST 승격 중단.

## 7. TEST / PRODUCTION 상태
- TEST와 PRODUCTION은 아직 092 Catalog 비용 구조로 승격하지 않음.
- 따라서 현재 TEST/정식앱에서 관찰되는 기존 읽기 패턴은 PREVIEW 092 안정화 후 **동일 exact tree 전체 승격**으로 맞출 예정.
- 승격은 사용자 데이터 복사가 아니라 코드/Worker 기능 승격.
- TEST: PREVIEW 실사용 정확성 + Catalog 비용 검증 + 좋아요 W1 확인 전 금지.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.

## 8. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- like display ledger
- 공개/비공개 변경분 처리 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

## 9. 다음 작업
- 사용자가 PREVIEW 092에서 새 기기/캐시 삭제 조건으로 Firestore 읽기 수치를 실측.
- 읽기가 곡 수에 비례하지 않으면 Catalog 구조 PASS 후보.
- 이상 read가 남으면 해당 경로만 진단하고 전체 구조를 다시 읽거나 백필하지 않음.
- PREVIEW가 안정화되면 TEST 승격을 검토해 TEST의 구버전 읽기 구조를 092와 맞춤.

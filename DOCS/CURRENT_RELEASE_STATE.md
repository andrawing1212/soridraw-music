# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-10 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- 현재 PREVIEW 앱 배포 기준 commit: `873764137fbf5347ccb148789a2eed600d933ba2`
- 현재 PREVIEW Worker 033 배포 소스 commit: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- Worker 033 배포 trigger commit: `fa8de1415c9071b121918ec56d0c461903fe6726`
- Shared D1 trigger release workflow commit: `9a097afabb23f15ffcb4439f6e4fc6a2b1edc95f`
- Shared D1 trigger release trigger commit: `4f7ea21c9f0e32fd65742227b695b50fc3c72a3c`
- TEST 앱 branch 기준: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch 기준: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- PRODUCTION 코드/Worker는 이번 작업에서 변경하지 않았다.

## 2. 실제 PREVIEW 배포 상태
### Firebase PREVIEW Hosting
- 현재 앱 버전: `052`
- 배포 Workflow run: `34436451189`
- 실행 checkout SHA: `873764137fbf5347ccb148789a2eed600d933ba2`
- TypeScript: PASS
- Build: PASS
- Firebase Hosting deploy: PASS
- `https://preview.soridraw.com/` exact build hash: PASS
- `https://preview.soridraw.com/app-version.json`: `052` PASS
- TEST / PRODUCTION branch 및 Hosting 비의도 변경 없음 PASS.
- 현재 PREVIEW 앱에는 Explore 좋아요 즉시 optimistic 표시 + 곡별 5초 idle 묶음 + persistent outbox/retry가 반영돼 있다.

### Cloudflare PREVIEW Worker
- Worker: `soridraw-explore-preview`
- 현재 활성 Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- 배포 Workflow: `SORIDRAW PREVIEW Explore Worker Release`
- 성공 run: `34492208967`
- 배포 소스 SHA: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- 적용 patch: 031 shared canonical + 032 derived-change cache + 033 Explore like deferred derived sync.
- 033 핵심: 좋아요 mutation 요청 안에서 Feed/Profile derived R2를 즉시 재읽기/재작성하지 않고, 기존 032 journal을 다음 정상 revision/first-view 경로가 소비하도록 미룬다.
- 실제 배포 후 smoke:
  - Explore feed HTTP 200 PASS
  - Public Profile first-view HTTP 200 PASS
  - 두 번째 `/v1/feed-revision`: D1 rows read `0`, rows written `0` PASS
  - `PREVIEW_WORKER_DEPLOY=PASS`
- Shared D1 trigger 변경 후에도 PREVIEW Worker Version ID는 동일함을 재확인 PASS.
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` 동일 PASS.
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` 동일 PASS.

## 3. 공유 D1 상태 — 20260910_03 적용 완료
- canonical D1: `soridraw-explore-db`
- 기존 additive derived schema/seed 유지.
- 적용 migration: `cloudflare/explore-worker/migrations/20260910_03_explore_like_write_optimization.sql`
- migration blob: `e96c8ed00529d512163101f0d60ea63babdff7df`
- 전용 고정 Workflow: `.github/workflows/cloudflare-explore-shared-d1-release.yml`
- release run: `34496512024` — **PASS**.
- 적용 전 read-only preflight: 필수 derived tables/triggers + `seeded=1` PASS.
- 적용 전 live trigger가 승인된 기존 `legacy032`와 정확히 일치함을 확인 후 진행.
- PREVIEW/TEST/PRODUCTION 활성 Worker source 호환성 검사 PASS.
  - PREVIEW는 032 per-scope cursor 사용 확인.
  - TEST/PRODUCTION은 032 derived runtime 비사용이라 canonical 호환 유지.
- migration은 `explore032_derived_track_update` trigger 하나만 교체.
- 변경 내용:
  - derived global seq 증가 3회 → 1회
  - feed journal 1회 유지
  - 현재 owner profile journal 1회 유지
  - old owner journal은 owner 변경 시에만
  - track_count 보조 write는 owner/active 실제 변경 시에만
- migration 실행 자체의 Cloudflare 계측: 2 queries / rows read `283` / rows written `1`; 이 write는 trigger schema 교체 과정이며 canonical 사용자 row DML은 없음.
- 적용 후 18개 필수 trigger/readiness 재검사 PASS.
- 적용 후 live trigger가 승인된 optimized 033 정의와 정확히 일치 PASS.
- PREVIEW / TEST / PRODUCTION feed HTTP 200 PASS.
- PREVIEW warm `/feed-revision` 적용 후 `R0/W0` PASS.
- 모든 Worker Version ID 적용 전후 동일 PASS.
- `main` / `production` refs 적용 전후 동일 PASS.
- canonical 사용자 데이터 삭제/백필/대량변환/덮어쓰기 없음.

## 4. 현재 좋아요 비용 구조 및 실제 PREVIEW 계측
- Client: 클릭 즉시 표시, 동일 곡은 5초 idle 후 최종 상태만 서버 전송, pending 상태는 persistent outbox로 보존.
- Worker 033: 좋아요 요청에서 eager Feed/Profile derived cache 동기화 제거.
- 032 changed-ID journal/revision 구조 유지.
- warm `/feed-revision` D1 `0/0` 유지.
- **trigger 최적화 적용 전 실제 baseline**:
  - 첫 좋아요 server mutation: `R19 / W20`
  - 같은 곡 해제 server mutation 증분: `R19 / W17`
  - 2회 누적: `R38 / W37`
- 이전 `약 172 read / 20 write`는 여러 동작이 섞인 누적값이므로 단일 좋아요 baseline에서 제외.
- 20260910_03 trigger 최적화는 적용 완료됐지만, **적용 후 인증된 실제 좋아요 1회 CACHE LIVE 비용은 아직 미측정**.
- 따라서 현재 비용 판정은 `개선 적용 완료 / 최종 수치 검증 전`이며, 예상 수치를 완료값으로 주장하지 않는다.

## 5. 고정 배포/변경 경로
### 앱 PREVIEW
- canonical Workflow: `.github/workflows/firebase-hosting-custom-preview.yml`
- `.deploy/preview-app-release.trigger` 명시 변경 때만 배포.

### Explore Worker PREVIEW
- canonical Workflow: `.github/workflows/cloudflare-explore-preview-release.yml`
- `.deploy/preview-worker-release.trigger` 명시 변경 때만 배포.

### Shared D1 구조 변경
- canonical Workflow: `.github/workflows/cloudflare-explore-shared-d1-release.yml`
- `.deploy/shared-d1-release.trigger` 명시 변경 때만 실행.
- 일반 코드 push로 D1 변경하지 않는다.
- exact target SHA + 승인 migration filename + blob SHA를 고정한다.
- 적용 전 live trigger/Worker 호환/readiness 확인 후에만 실행한다.
- 적용 후 postflight/API/warm revision/Worker·branch 비변경 검증이 실패하면 이전 trigger 복구를 시도하도록 rollback guard를 둔다.

## 6. 데이터 운영 고정 원칙
- PREVIEW / TEST / PRODUCTION은 기능 코드와 실행 환경을 분리한다.
- 사용자 원본 데이터는 세 앱이 공유한다.
- 공유 원본: Auth/계정, Music Note, Library, Explore 공개곡, 공개프로필, 좋아요/팔로우/통계, 사용자 미디어.
- 환경별 분리: Hosting, Worker/Functions 코드, Edge/R2 derived cache, Rate Limit/진단 상태.
- 승격은 데이터 복사가 아니라 코드 승격이다.
- destructive migration/backfill/대량삭제/필드 의미 변경은 승인 없이 금지.

## 7. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 승인 없는 main/production 승격
- 승인 없는 PRODUCTION 배포
- FCM/WebSocket/새 외부 실시간 인프라

## 8. 저장소 운영 위험
- `.github/workflows`에 과거 Workflow가 매우 많이 남아 있어 Actions UI가 혼잡하다. 이름만 보고 무차별 삭제하지 않고 별도 유지보수 감사가 필요하다.
- `preview`, `main`, `production` branch protection이 현재 꺼져 있어 별도 운영 위험으로 남아 있다.

## 9. 다음 작업
1. PREVIEW CACHE LIVE에서 같은 절차로 좋아요 1회 → 5초 idle → 비용 기록.
2. 같은 곡 좋아요 해제 1회 → 5초 idle → 증분 비용 기록.
3. Feed 최신/인기 및 공개프로필 likeCount 최종 수렴 확인.
4. 같은 계정 PC/모바일 최종 상태 일치 확인.
5. 비용이 O(1)이고 W20/W17 대비 명확히 감소했는지 판정.
6. PREVIEW 기능·비용 검증 완료 후 사용자 요청이 있을 때만 TEST 승격.
7. PRODUCTION은 별도 명확한 승인 전 변경하지 않는다.

## 10. 현재 완료 판정
- Firebase PREVIEW 앱 052: **PASS** — Run `34436451189`.
- Explore Worker 033 PREVIEW: **PASS** — Run `34492208967`.
- Shared D1 low-write trigger migration 20260910_03: **PASS** — Run `34496512024`.
- migration source/readiness/active Worker compatibility/live baseline/postflight: **PASS**.
- PREVIEW/TEST/PRODUCTION feed after D1 change: **PASS**.
- warm `/feed-revision` after D1 change: **R0/W0 PASS**.
- Worker versions / main / production refs 비변경: **PASS**.
- 사용자 canonical row 변경: **없음**.
- Functions / Firestore Rules / Hosting 변경: **없음**.
- 좋아요 5초 debounce: **실사용 PASS**.
- trigger 최적화 전 비용 baseline: 좋아요 `R19/W20`, 해제 `R19/W17`.
- trigger 최적화 후 실제 좋아요 1회 비용: **실사용 계측 전**.

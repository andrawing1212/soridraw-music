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
- TEST 앱 branch 기준: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch 기준: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- PRODUCTION은 이번 작업에서 변경하지 않았다.

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
- TEST Worker는 `0b9cfe5c-1e29-4485-ac97-36f87832b41e` 그대로 PASS.
- PRODUCTION Worker는 `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` 그대로 PASS.
- `main` / `production` refs도 Worker 배포 전후 동일 PASS.

## 3. 공유 D1 상태
- canonical D1: `soridraw-explore-db`
- 기존 additive derived schema/seed는 준비된 상태.
- Worker 033 배포 전 실제 D1 preflight는 read-only SELECT로 schema/seed readiness를 확인한 뒤에만 deploy를 허용했다.
- 이번 033 Worker 배포에서 새 migration/seed/backfill/사용자 데이터 write는 실행하지 않았다.
- `20260910_03_explore_like_write_optimization.sql`은 verifier/fixture에는 존재하지만 공유 D1에 실제 적용하지 않았다.
- canonical 사용자 원본 삭제/대량변환/덮어쓰기 없음.

## 4. 현재 좋아요 비용 구조
- Client: 클릭 즉시 표시, 동일 곡은 5초 idle 후 최종 상태만 서버 전송, pending 상태는 persistent outbox로 보존.
- Worker 033: 좋아요 요청에서 eager Feed/Profile derived cache 동기화 제거.
- 032 changed-ID journal/revision 구조는 유지.
- warm `/feed-revision` 두 번째 호출 실제 D1 read/write 0 유지.
- verifier PASS:
  - client optimistic + durable 5s outbox
  - generated Worker에서 Feed/Profile eager derived I/O 없음
  - local D1 fixture에서 like-only update는 global derived seq +1, feed + owner journal 유지, logical track_count 불변
  - derived-cache regression suite PASS
- **아직 미확정:** 인증된 실제 좋아요 1회 CACHE LIVE의 최종 D1 rows read/write 수치. 기존 약 `172 read / 20 write` 대비 개선량은 PREVIEW 실사용 계측 후 확정한다.
- 공유 D1 trigger write 최적화는 위 실제 계측에서 write가 여전히 높을 때만 별도 승인/감사 후 판단한다.

## 5. PREVIEW 배포 경로
### 앱
- canonical Workflow: `.github/workflows/firebase-hosting-custom-preview.yml`
- 일반 코드 push로 배포하지 않는다.
- `.deploy/preview-app-release.trigger`가 바뀔 때만 PREVIEW 앱 배포가 자동 시작되거나, 수동 `workflow_dispatch`를 사용할 수 있다.

### Explore Worker
- canonical Workflow: `.github/workflows/cloudflare-explore-preview-release.yml`
- 일반 코드 push로 Worker를 배포하지 않는다.
- `.deploy/preview-worker-release.trigger`가 바뀔 때만 PREVIEW Worker 배포가 자동 시작되거나, 수동 `workflow_dispatch`를 사용할 수 있다.
- trigger에는 배포할 exact `product_code_target` SHA를 기록한다.
- 따라서 사용자가 Actions의 긴 Workflow 목록을 찾아 직접 실행할 필요가 없다.
- 배포 전: active Worker/bindings 고정 → repository-owned patches/verifier → D1 read-only preflight.
- 배포 후: feed/profile API smoke → warm revision 0/0 → TEST/PRODUCTION Worker/ref 비변경 검증.

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
- `.github/workflows`에 과거 Workflow가 매우 많이 남아 있어 Actions UI가 혼잡하다. 이번 033 배포는 새 임시 Workflow를 만들지 않고 canonical Workflow 하나를 고쳐 재사용했다.
- 전체 Workflow 정리는 별도 repository maintenance 작업으로 해야 하며, 이름만 보고 무차별 삭제하지 않는다.
- `preview`, `main`, `production` branch protection이 현재 꺼져 있어 별도 운영 위험으로 남아 있다.

## 9. 다음 작업
1. PREVIEW에서 인증된 좋아요 1회를 CACHE LIVE 동일 조건으로 실측한다.
2. 033 적용 후 D1 rows read/write를 기존 약 172/20과 비교한다.
3. read가 충분히 감소하고 write만 높으면 공유 D1 trigger 최적화를 별도 고위험 작업으로 감사/승인 후 진행한다.
4. PREVIEW 기능·비용 검증 완료 후 사용자 요청이 있을 때만 TEST 승격한다.
5. PRODUCTION은 별도 명확한 승인 전 변경하지 않는다.

## 10. 현재 완료 판정
- Firebase PREVIEW 앱 052: **PASS** — Run `34436451189`.
- Explore Worker 033 PREVIEW 배포: **PASS** — Run `34492208967`.
- PREVIEW Worker Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`.
- Feed / Public Profile smoke: **PASS**.
- warm `/feed-revision` second call D1 read/write: **0 / 0 PASS**.
- Worker release trigger 자동 경로: **PASS**.
- TEST/PRODUCTION Worker/ref 비변경: **PASS**.
- 새 D1 migration/seed: **미실행**.
- 사용자 원본 데이터 변경: **없음**.
- Functions / Firestore Rules 변경: **없음**.
- 실제 좋아요 1회 CACHE LIVE 비용: **실사용 계측 전**.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- PREVIEW 앱: 034 client 4분 user-level like batch 배포 상태 유지
- PREVIEW 앱 Run: `34506474866` — PASS
- PREVIEW Worker: **035 deferred aggregate 활성**
- PREVIEW Worker Run: `34519328112` — PASS
- PREVIEW Worker 활성 Version ID: `8fe58486-91c6-43dc-af7c-eb7945448054`
- PREVIEW Worker release target: `e6ae6a17933d25c3ae3db1475d8c5bfabbc78ed0`
- release trigger commit: `b16306f409fa4115e58ca353cd264efb8f6c4f6d`
- canonical complete Worker SHA256: `5e05eba6dde4886553bd1923a3da2caa78bcfb22378221f8b25eb44abde64fe3`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `052`
- Run: `34506474866` — PASS
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version: PASS
- 034 client 4분 user-level multi-track persistent outbox 포함.
- 035 Worker 작업에서 앱 Hosting은 재배포하지 않았다.

### Cloudflare PREVIEW Worker 035
- Worker: `soridraw-explore-preview`
- Run: `34519328112` — **PASS**
- 활성 Version: `8fe58486-91c6-43dc-af7c-eb7945448054`
- 이전 034 Version: `27cc6139-a59c-41d1-9674-4c710d687050`
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- `POST /v1/me/likes/batch` route: 인증 없는 smoke에서 HTTP 401, route 존재 PASS
- warm `/v1/feed-revision`: 1차 `R2/W0` → 2차 `R0/W0`, 최종 PASS
- 035 scheduled aggregate cron: `*/10 * * * *` — PASS
- TEST Worker / PRODUCTION Worker 비변경: PASS

## 3. PREVIEW Worker 배포 구조 정상화

### 폐기한 방식
일반 PREVIEW Worker 배포에서 아래 경로를 더 이상 사용하지 않는다.
- Cloudflare의 현재 Worker source를 매번 다시 다운로드
- `031 → 032 → 033 → 034 → 035` patch 누적 재적용
- 배포 때마다 config를 동적으로 재조립
- 기능 배포 도중 release workflow를 즉흥 수정하며 재시도

### 현재 고정 방식
- 완성 Worker source: `cloudflare/explore-worker/canonical/preview-worker.js`
- 고정 PREVIEW config: `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
- source hash: `cloudflare/explore-worker/canonical/source-sha256.txt`
- 일반 PREVIEW release workflow: `.github/workflows/cloudflare-explore-preview-release.yml`
- trigger: `.deploy/preview-worker-release.trigger`
- 흐름: **완성 source 1개 → one-shot preflight → PREVIEW deploy 1회 → live smoke**
- Worker release에는 D1 migration을 섞지 않는다. D1 schema가 필요한 release는 read-only preflight에서 먼저 차단한다.
- smoke 실패 시 직전 PREVIEW Worker Version으로 rollback하도록 고정.
- TEST/PRODUCTION Worker는 release 전후 Version을 비교해 비변경을 강제한다.

### 실제 속도 검증
Run `34519328112`:
- Action 생성: `19:15:34Z`
- 전체 완료: `19:16:17Z`
- **총 약 43초**
- runner 시작 후 실제 release 작업: 약 34초
- npm tooling 설치: 약 6초
- one-shot preflight(035 verifier + D1 read-only check + dry-run): 약 4초
- Cloudflare Worker upload: 약 4.27초
- trigger deploy: 약 1.05초
- live smoke/warm/보호환경 확인까지 포함해 1분 미만 PASS

이 43초를 PREVIEW Worker 배포 속도의 현재 실제 기준점으로 사용한다. 기능 수정 때문에 이 경로를 다시 복잡하게 만들지 않는다.

## 4. 공유 D1 035 상태
- canonical D1: `soridraw-explore-db`
- 033 low-write trigger 구조 유지.
- 035 additive migration: `20260911_01_explore_like_deferred_batches.sql`
- Shared D1 release Run `34511788949`: PASS
- 035 필수 objects live preflight: PASS
  - `explore_like_batches_035`
  - `idx_explore_like_batches_035_created`
  - `explore_like_processor_035`
  - processor seed row `id=1`
- Worker 035 활성 직전 pending queue `0`: PASS
- 기존 canonical 사용자 row 삭제/백필/대량변환/덮어쓰기 없음.
- 기존 034/single-track 호환 경로는 구버전/TEST/PRODUCTION 호환을 위해 유지.

## 5. 현재 좋아요 동작 구조

### 사용자 기기 / Client 034
- 좋아요 UI는 클릭 즉시 optimistic 반영.
- Explore와 공개프로필이 동일 persistent like outbox 사용.
- 사용자당 첫 pending 시점 기준 고정 4분 window.
- 여러 곡을 눌러도 4분 마감을 계속 뒤로 밀지 않음.
- 한 user batch 최대 50곡 최종 상태.
- 같은 곡 좋아요→해제가 원상태로 돌아오면 서버 전송 전에 제거 가능.
- 앱/탭 종료 시 pending은 로컬에 남고 다음 실행에서 이어서 처리.

### Worker 035
- 4분마다 들어온 사용자 batch를 곡별 공개 집계까지 즉시 반복 처리하지 않고 deferred batch로 받는다.
- canonical `(uid, track)` 관계 정확성은 유지한다.
- 여러 사용자/여러 변경을 scheduled processor가 묶어서 곡별 delta로 계산한다.
- 같은 곡에 많은 변화가 몰리면 public like count / derived Feed/Profile 갱신을 여러 사용자별이 아니라 변경곡 단위로 합친다.
- net-zero aggregate는 불필요한 공개 count/derived 갱신을 만들지 않는다.
- scheduled processor 주기: 10분.
- 로컬 fixture: 100 same-track likes → 공개 count/derived update 1회 PASS.
- net-zero cohort → 공개 count/derived update 0회 PASS.
- 한 aggregate wave 최대 50,000 logical mutations, bounded waves.

## 6. 비용 기준과 현재 판정
사용자 스트레스 기준:
- 100,000 DAU
- 1인 하루 좋아요 30곡
- 하루 3,000,000 logical likes
- 30일 90,000,000 logical likes

034 실제 user test:
- 3곡 user batch 1 request: D1 `R45/W51`
- 즉 HTTP/R2 묶기는 됐지만 기존 per-track D1 write amplification이 그대로여서 비용 FAIL.

035 목적:
- user batch network/auth/R2 절감 유지.
- D1의 public count / Feed/Profile derived bookkeeping을 user-like마다 반복하지 않고 aggregate 단위로 합친다.
- full Feed/Profile scan/rebuild 금지.

현재 비용 판정:
- 035 코드/fixture: PASS.
- Shared D1 additive prerequisite: PASS.
- PREVIEW Worker 035 deployment/smoke: PASS.
- unchanged warm revision `R0/W0`: PASS.
- **실제 인증 사용자 4분 batch의 D1 R/W + 10분 aggregate R/W는 아직 실측 전.**
- 따라서 100,000×30/day 최종 월비용 PASS는 아직 선언하지 않는다.

## 7. 개발/배포 운영 기준
- PREVIEW 기능 개발 기본 루프: `수정 → 사전검사 1회 → PREVIEW 배포 1회 → 실제 확인 → 수정`.
- 첫 deploy 실패 시 같은 release를 무작정 재시도하지 않는다. 전체 경로를 먼저 진단한다.
- 일반 기능 작업 중 deployment workflow 수정 금지. 인프라 작업으로 분리한다.
- PREVIEW Worker 기준 속도: 현재 end-to-end 약 43초. 명확한 이유 없이 수분대로 회귀하면 원인 분석 대상.
- Firebase PREVIEW app 기존 정상 deploy workflow는 현재 유지. Worker 구조 정상화 때문에 앱 pipeline까지 동시에 뜯지 않는다.
- D1 migration은 Worker deployment와 분리한다.
- TEST 승격은 사용자 `테스트배포` 요청 전 금지.
- PRODUCTION은 명확한 정식배포 승인 전 금지.

## 8. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 기존 TEST/PRODUCTION 호환성
- 승인 없는 main/production 변경
- 앱 업데이트/페이지 이동 때문에 데이터 전체 읽기/재생성 금지

## 9. 다음 실제 작업
1. PREVIEW에서 실제 사용자로 3개 이상 서로 다른 곡 좋아요.
2. 4분 전 server mutation 0 확인.
3. 4분 후 `/v1/me/likes/batch` 1회와 intake D1 R/W 측정.
4. 다음 10분 aggregate 이후 public count/Feed/Profile 수렴과 aggregate D1 R/W 측정.
5. 같은 곡 상쇄 케이스 server 0 mutation 확인.
6. PC↔모바일 최종 canonical like 상태 일치 확인.
7. 실제 035 수치로 100,000 DAU × 30 likes/day 월비용 재계산.
8. 비용이 합격선에 못 미치면 **요청 횟수가 아니라 남은 physical D1 writes만** 다음 최적화 대상으로 잡는다.

## 10. 현재 완료 판정
- PREVIEW app 052 + 034 client: **배포 PASS**.
- Shared D1 035 additive schema: **PASS** — Run `34511788949`.
- PREVIEW Worker 035: **배포 PASS** — Run `34519328112`, Version `8fe58486-91c6-43dc-af7c-eb7945448054`.
- Worker canonical one-file release 구조: **실제 배포 43초 PASS**.
- Feed/Profile/like route/warm revision: **PASS**.
- TEST / PRODUCTION Workers: **비변경 PASS**.
- Firebase/Functions/Rules: 035 Worker release에서 **변경 없음**.
- 사용자 canonical 데이터 migration/backfill/delete: **없음**.
- UI 변경: **없음**.
- PC/모바일: **035 실사용 검증 전**.
- 100k×30 최종 비용: **실측 전 / 아직 PASS 아님**.

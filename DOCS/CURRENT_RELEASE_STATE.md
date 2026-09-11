# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 065**
- PREVIEW 065 기능 기준 source: `3f73a1de19709a547891541436bcb6dcce348a51`
- PREVIEW 065 App Release trigger checkout: `77ecdb2e5bf101f0ad02d0965eca064485f2c6b0`
- PREVIEW 065 App Run: `34583313251` — **PASS**
- PREVIEW 065 Worker Run: `34583286386` — **PASS**
- PREVIEW Worker active Version ID: `f9c0f80d-b0af-4550-b59c-dec637f5e638`
- Worker: 035 deferred aggregate + 036 derived intake + 037 revision head-only + 064 release-origin parity
- Shared D1 035 additive schema Run: `34511788949` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active
- 고정 TEST→PRODUCTION Workflow: `.github/workflows/soridraw-release-promotion.yml`

## 2. PREVIEW 065 변경
### 같은 계정 PC ↔ 모바일 좋아요 숫자 동기화 수정
사용자 발견 오류:
- PC에서 좋아요 후 약 1분 뒤 모바일 하트/숫자 색은 좋아요 상태로 바뀌지만 숫자 값은 그대로인 경우가 있었음.

원인/수정:
- 같은 계정 signal은 개인 liked 상태를 저장했지만, Explore 화면이 signal 순간에 받지 못하면 숫자 패치는 남지 않을 수 있었음.
- flush 중 추가 변경이 있는 경우 원본 브라우저가 보는 숫자와 account signal이 보내는 숫자가 달라질 수 있는 경로도 있었음.
- 이제 성공 batch의 **실제 화면용 liked + likeCount 결과를 같은 계정 signal에 사용**한다.
- 다른 기기가 signal을 Explore 화면 밖에서 받아도 최근 결과를 짧은 로컬 account patch cache에 저장하고, 해당 곡이 다시 화면에 보일 때 숫자까지 재적용한다.
- 새 Firestore listener 없음. 기존 `users/{uid}` listener와 기존 signal 1회 쓰기를 재사용.
- UI/CSS 변경 없음.

### 좋아요 intake D1 read 최적화
기존 035 intake:
- 공개곡 검증/현재 숫자/개인 상태를 위해 `tracks + public_profiles + track_stats + likes` 조합.

065 Worker 036:
- 이미 유지 중인 `explore_derived_tracks + explore_derived_profiles`에서 공개상태와 현재 like count를 읽음.
- 개인 좋아요 관계만 canonical `likes`를 계속 authoritative source로 사용.
- 원본 `tracks/public_profiles/track_stats` 중복 read를 intake hot path에서 제거.
- 새 table/index/migration/backfill 없음.
- canonical user/content 데이터 변경 없음.

## 3. 검증 결과
### 준비 CI
TEMP 065 Prepare Worker Run `34582976624` — PASS.
- TypeScript PASS
- Build PASS
- same-account visible count replay verifier PASS
- public/private track/profile intake fixture PASS
- canonical personal-like relation fixture PASS
- 100 same-track likes → public count/derived update 1회 PASS
- net-zero cohort → public count/derived write 0 PASS
- generated Worker verifier PASS
- Wrangler dry-run PASS
- 임시 workflow/trigger는 준비 후 저장소에서 제거함.

### PREVIEW Worker 배포
Run `34583286386` — PASS.
- exact Worker source `3f73a1de...` 고정
- D1 prerequisite SELECT/read-only preflight PASS
- shared 035 schema/state PASS, 배포 직전 pending=0
- Feed PASS / Public Profile PASS / likes batch route 존재 PASS
- revision warm `R0/W0`, `HEAD-ONLY-036` PASS
- 10분 aggregate cron PASS
- TEST/PRODUCTION Worker unchanged PASS
- active PREVIEW Worker: `f9c0f80d-b0af-4550-b59c-dec637f5e638`

### PREVIEW App 배포
Run `34583313251` — PASS.
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=065` PASS
- TEST/PRODUCTION branch + 실제 HTML unchanged PASS

## 4. 비용 판정
- 064 이전 실측: 1곡 likes batch 약 D1 `R3/W3`, 3곡 약 `R9/W3`.
- 065은 intake 원본 3종(`tracks/profile/stats`)을 파생 2종(`derived track/profile`)으로 줄이고 canonical personal `likes`만 유지했다.
- SQLite/구조 검증은 PASS했지만 **실제 인증된 PREVIEW 좋아요 요청의 D1 rows_read 최종 숫자(R2 등)는 사용자 실사용 계측 전**이다. 숫자를 추정값으로 완료 처리하지 않는다.
- `W3`를 줄이는 변경은 이번 릴리스에 넣지 않았다. write 증가 없음이 설계 기준이며 실제 PREVIEW 계측으로 재확인한다.
- Explore 재진입/resume 10분 LOCAL revision cache zero-read 원리는 그대로 유지.

## 5. 데이터/환경 안전
- D1 migration/seed: 없음.
- Firestore Rules 변경: 없음.
- Firebase Functions 변경: 없음.
- 사용자 데이터 copy/backfill/delete/overwrite: 없음.
- TEST 배포: 없음.
- PRODUCTION 배포: 없음.
- UI/반응형/간격/색상 변경: 없음.

## 6. 기능 승격 원칙
- 별도 환경 전용 지시가 없는 PREVIEW 검증 기능은 TEST/PRODUCTION까지 동일하게 승격한다.
- 승격은 코드/기능 승격이며 사용자 원본 데이터는 복사하지 않는다.
- PRODUCTION은 사용자 명확한 승인 후에만 승격한다.

## 7. 보호 기준
- Music Note Local First + 약 60초 묶음 저장.
- Library Local First.
- Explore/공개프로필 cache first + resume zero-read.
- 035 deferred like aggregate + 10분 cron.
- 058/065 같은 계정 PC↔모바일 개인 하트 + 숫자 동기화.
- 새 listener/전체 Feed/Profile 재조회 금지.
- UI 변경 금지.

## 8. 현재 판정
- **PREVIEW 065 App 배포: PASS.**
- **PREVIEW 065 Worker 배포: PASS.**
- **자동 회귀/비용 구조 테스트: PASS.**
- **PC→모바일 실제 숫자 동기화: 사용자 실사용 검증 전.**
- **실제 authenticated D1 R/W 개선 수치: 사용자 실사용 계측 전.**
- TEST/PRODUCTION: unchanged.

## 9. 다음 단계
1. PREVIEW 065에서 PC 좋아요 → 약 1분 뒤 모바일에서 하트 상태와 숫자가 함께 `+1` 되는지 확인.
2. 반대로 모바일 좋아요 해제 → PC에서 하트와 숫자가 함께 `-1` 되는지 확인.
3. CACHE LIVE에서 1곡/3곡 batch D1 R/W를 확인하여 065 비용 개선의 실제 수치를 고정.
4. 위 항목 PASS 후 사용자가 `테스트배포`를 요청하면 고정 TEST 승격 경로로 진행.
5. PRODUCTION은 별도 명확한 승인 후 진행.

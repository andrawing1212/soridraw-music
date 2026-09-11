# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 071**
- 071 실제 코드 commit: `cdf6d480917bd0d5cd262187ae728c44a2245e1d`
- PREVIEW 071 release trigger/locked build commit: `9723f35ef2b59cca60050f80bd8915a6d41fd9b2`
- PREVIEW 071 App Run: `34636434718` — PASS
- 071 targeted apply Run: `34636302973` — PASS
- PREVIEW Worker는 069 서버 런타임 그대로 유지
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- PREVIEW Worker canonical SHA256: `2030a64bf8cc56e18ca0a2f05fb5832ea68ceb0e14fd9ae064248db35721ae6e`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- 069 implementation/verifier Run: `34630148363` — PASS
- 071 feed revision read-only diagnostic Run: `34635626979` — PASS
- 071 live like read-only diagnostic Run: `34635749312` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 069 서버 좋아요 구조 — 유지
- 하트 상태는 즉시 로컬 반영.
- PREVIEW 좋아요 outbox는 1분 단위 batch.
- 공개 좋아요 숫자는 기기에서 임의 `+1/-1`하지 않음.
- 공개 숫자는 Worker `*/10 * * * *` scheduled aggregate가 확정할 때만 canonical/derived 값이 변경.
- 069 queue `explore_like_batches_069`는 단일 PK / secondary index 없음으로 queue write `W1/batch` 목표.
- retry는 안정적인 `mutationAt` 유지.
- `baseLiked`로 aggregate 전 like↔unlike 역전 의도를 보존.
- 071은 Worker/D1 구조를 변경하지 않는 client-only 복구.

## 3. 실사용에서 확인된 문제
070에서 다음 10분 aggregate 경계 + 70초 후 revision revalidation 1회를 예약했지만, 사용자가 테스트한 두 곡 모두 서버 숫자는 1로 확정된 뒤에도 열린 화면 숫자가 0으로 남는 사례가 발생.

읽기 전용 진단 결과:
- queue 035/066/069 모두 0.
- processor lease 0 / owner empty.
- 사용자 테스트 곡 `track_stats.like_count = 1`.
- `explore_derived_tracks.likes = 1`.
- 실제 PREVIEW `/v1/feed` payload도 `like_count = 1`.
- PREVIEW Worker cron `*/10 * * * *` 정상.
- revision 진단: `GLOBAL_SEQ=210`, `FEED_SEQ=210`, `LIVE_REVISION=210` 일치.

판정:
- 069 서버 batch/aggregate/canonical/derived/feed는 정상.
- 문제는 열린 브라우저가 서버에서 이미 확정된 공개 숫자를 확실히 다시 받아 화면/session cache에 적용하는 마지막 단계.

## 4. 071 수정
071 코드 commit `cdf6d480917bd0d5cd262187ae728c44a2245e1d`.

변경:
- 실제 좋아요 batch가 발생했을 때만 다음 aggregate 확인 예약.
- 예약 시각을 사용자별 `localStorage`에 저장해 새로고침/페이지 이동이 있어도 예약이 사라지지 않도록 변경.
- 예약 시각 이후 화면이 보이는 상태라면 revision 확인을 실행.
- 070처럼 cached revision 값이 같아 보이더라도, **실제 좋아요로 예약된 확인은 Feed를 1회 강제 재확인**하여 session cache가 숫자 0에 고착되지 않게 함.
- 서버에서 받은 Feed의 확정 `likeCount`를 현재 Explore 목록과 공개 프로필의 같은 곡에 같이 반영.
- 공개 프로필 first-view 로컬 캐시도 서버 확정 숫자로만 갱신.
- polling 없음.
- optimistic 숫자 `+1/-1` 없음.
- 실패 시 저장된 예약은 남겨 다음 focus/visibility 복귀 때 다시 확인 가능.
- UI/CSS/위치/간격/반응형 변경 없음.

비용 판단:
- 앱을 열었다는 이유로 반복 조회하지 않음.
- 실제 좋아요 batch가 있었을 때만 aggregate 이후 1회 확인.
- 정상 캐시 + 데이터 변경 없음 재진입 0-read 목표 유지.
- Worker/D1/Functions/Rules 재배포 없음.

## 5. 071 자동 검증 / 배포
Targeted Apply Run `34636302973` — PASS:
- 071 targeted apply PASS.
- 071 static contract PASS.
- 기존 069 W1 / reversal runtime 보존 확인.
- `npm ci` PASS.
- TypeScript PASS.
- Build PASS.
- change boundary PASS.
- 변경 source: `src/pages/ExplorePage.tsx`, `public/app-version.json`.
- Worker runtime 변경 없음.
- D1 schema 변경 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- 사용자 데이터 변경 없음.
- UI/CSS 변경 없음.

PREVIEW App Run `34636434718` — PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=071` PASS.
- TEST / PRODUCTION branch 및 실제 HTML unchanged PASS.

## 6. 데이터 / 인프라 상태
- Shared 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- 069에서 추가한 `explore_like_batches_069` table만 유지.
- 071에서 D1/Worker/Functions/Rules 변경 없음.
- PREVIEW Hosting만 071로 갱신.
- TEST / PRODUCTION 코드 승격 없음.
- PREVIEW Worker는 검증된 069 정상 서버 버전 그대로.

## 7. 현재 판정
- 1곡 batch W1 실사용: **PASS**.
- PC 즉시 하트: **PASS**.
- PC→모바일 하트 동기화: **PASS**.
- 모바일 정상 캐시 Worker/D1 0: **PASS**.
- 069 scheduled aggregate / canonical count / derived count / Feed count: **PASS**.
- 070 열린 화면 숫자 자동 반영: **FAIL 실사용 재현**.
- 071 persistent + forced one-shot count refresh: **코드/TS/Build/PREVIEW 배포 PASS, 사용자 실사용 검증 전**.
- 3곡 1분 batch W1 실사용: 아직 미검증.
- aggregate 전 reversal 실제 최종 수렴: 아직 미검증.
- TEST 승격: 아직 금지.

## 8. 다음 작업
사용자 071 확인은 최소로 진행:
1. PREVIEW가 071인지 확인.
2. 새 0-like 곡 하나에 좋아요.
3. 하트는 즉시 ON, 숫자는 aggregate 전 0 유지.
4. 다음 scheduled aggregate 완료 후 열린 PC/모바일 화면 숫자가 서버 확정값 `1`로 자동 반영되는지 확인.

071이 통과하면 개발 측에서 별도로:
- 3곡 1분 batch `W1` 비용 확인.
- reversal 2방향 최종 수렴 확인.
- TEST 승격 가능 여부 판정.

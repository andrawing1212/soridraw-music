# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 070**
- 070 실제 코드 commit: `b24b7eaa2dfe461b0d4db34dec3983f045534e29`
- PREVIEW 070 release snapshot/trigger commit: `dce9448281cfbeedbc65e55bbf81cfc8f737b8ca`
- PREVIEW 070 App Run: `34634448854` — PASS
- PREVIEW Worker는 069 서버 런타임 그대로 유지
- PREVIEW Worker Run: `34631083178` — PASS
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- PREVIEW Worker canonical SHA256: `2030a64bf8cc56e18ca0a2f05fb5832ea68ceb0e14fd9ae064248db35721ae6e`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- 069 implementation/verifier Run: `34630148363` — PASS
- 070 targeted apply Run: `34634327688` — PASS
- 069 live read-only diagnostic final Run: `34634078292` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 069/070 좋아요 구조
- 하트 상태는 즉시 로컬 반영.
- PREVIEW 좋아요 outbox는 1분 단위 batch.
- 공개 좋아요 숫자는 기기에서 임의 `+1/-1`하지 않음.
- 공개 숫자는 Worker `*/10 * * * *` scheduled aggregate가 확정할 때만 canonical/derived 값이 변경.
- 069 queue `explore_like_batches_069`는 단일 PK / secondary index 없음으로 queue write `W1/batch` 목표.
- retry는 안정적인 `mutationAt` 유지.
- `baseLiked`로 aggregate 전 like↔unlike 역전 의도를 보존.
- 070은 서버 구조를 바꾸지 않고 **aggregate 완료 후 열린 화면의 공개 숫자를 자동 재확인하는 client-only 보정**.

## 3. 첫 PREVIEW 실사용 결과
사용자가 좋아요 0인 곡에 최초 like 테스트.

PASS:
- PC 하트 즉시 ON.
- 약 1분 뒤 batch 전송.
- `/v1/me/likes/batch` Worker 1회.
- D1 query `R1/W1`, 실제 queue row write `W1` 확인.
- 모바일은 약 1분 뒤 같은 계정 하트 ON.
- 모바일 정상 캐시 상태에서 Explore Worker `0`, D1 `0`으로 하트 동기화.
- aggregate 전 PC/모바일 공개 숫자는 0 유지.

발견 문제:
- 사용자가 약 10분 이상 화면을 그대로 열어 둔 상태에서 공개 숫자가 계속 0으로 보였음.
- 처음에는 aggregate 실패 가능성을 의심했으나 서버 read-only 진단으로 원인이 client refresh 타이밍임을 확인.

## 4. 069 서버 진단 결과 — aggregate 정상
읽기 전용 진단 workflow `.github/workflows/diagnose-069-live-like.yml` 추가 후 확인.

최종 Run `34634078292` PASS:
- `explore_like_batches_035 = 0`
- `explore_like_batches_066 = 0`
- `explore_like_batches_069 = 0`
- processor lease `0`, owner empty
- 즉 069 queue는 scheduled aggregate에서 정상 소비됨.

사용자 테스트 곡:
- `track_stats.like_count = 1`
- `explore_derived_tracks.likes = 1`
- canonical `likes` relation 존재
- current PREVIEW `/v1/feed` 직접 probe 결과 `like_count = 1`
- PREVIEW Worker cron `*/10 * * * *` 정상

판정:
- 10분 aggregate 자체는 정상.
- canonical/derived/public Feed 값도 정상 1로 확정.
- 화면에 0이 남았던 원인은 **열려 있던 브라우저 session cache가 aggregate 이후 스스로 revision revalidation을 한 번 더 실행하지 않았기 때문**.

## 5. 070 수정 — 공개 숫자 자동 갱신
070 코드 commit `b24b7eaa2dfe461b0d4db34dec3983f045534e29`.

변경:
- `src/pages/ExplorePage.tsx`만 동작 수정.
- 같은 계정 `EXPLORE_LIKE_SYNC_EVENT`를 받은 실제 좋아요 batch에 대해서만 자동 갱신 예약.
- 다음 10분 aggregate 경계 + revision cache 안전 여유 70초 후 **revision revalidation 1회만** 실행.
- polling 없음.
- 공개 숫자 optimistic `+1/-1` 없음.
- 여러 like sync가 같은 창 안에서 오면 기존 timer를 재사용/재예약해 반복 요청 최소화.
- 탭이 숨겨져 있으면 서버 요청하지 않고, 사용자가 돌아왔을 때 기존 visibility/focus 경로가 확인.
- Worker/D1 구조 변경 없음.
- UI/CSS/반응형 변경 없음.

비용 판단:
- 앱을 열었다는 이유로 추가 polling하지 않음.
- 실제 좋아요 batch가 발생한 경우에만 1회 revision 확인.
- 변경이 없는 정상 캐시 재진입 0-read 원칙 유지.
- 서버 데이터가 실제 바뀐 경우에만 필요한 공개 숫자 patch/feed 갱신 허용.

## 6. 070 자동 검증 / 배포
Apply Run `34634327688` — PASS:
- targeted apply PASS.
- 070 static contract PASS.
- 기존 069 W1 / reversal runtime 보존 확인.
- `npm ci` PASS.
- TypeScript PASS.
- Build PASS.
- change boundary PASS.
- Worker runtime 변경 없음.
- D1 schema 변경 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- UI/CSS 변경 없음.
- 사용자 데이터 변경 없음.

PREVIEW App Run `34634448854` — PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=070` PASS.
- TEST / PRODUCTION unchanged PASS.

## 7. 데이터 / 인프라 상태
- Shared D1 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- 069에서 추가한 `explore_like_batches_069` table만 유지.
- 070에서 D1/Worker/Functions/Rules 변경 없음.
- TEST / PRODUCTION 코드 승격 없음.
- PREVIEW Worker는 069 정상 서버 버전 그대로.

## 8. 현재 판정
- 1곡 batch W1 실사용: **PASS**.
- PC 즉시 하트: **PASS**.
- PC→모바일 하트 동기화: **PASS**.
- 모바일 정상 캐시 Worker/D1 0: **PASS**.
- 069 scheduled aggregate / canonical count / derived count / Feed count: **PASS**.
- 069 열린 화면 자동 숫자 갱신: **FAIL 원인 확인 완료**.
- 070 client auto-refresh 보정: **코드/빌드/배포 PASS, 사용자 실사용 검증 전**.
- 3곡 1분 batch W1 실사용: 아직 미검증.
- aggregate 전 reversal 실제 최종 수렴: 아직 미검증.
- TEST 승격: 아직 금지.

## 9. 다음 작업
사용자는 복잡한 진단 테스트를 반복할 필요 없음.

070 사용자 확인 최소 항목:
1. PC/모바일 PREVIEW가 070으로 업데이트됐는지 확인.
2. 좋아요 0인 새 곡 하나에 like.
3. PC 하트 즉시 ON / 약 1분 뒤 모바일 하트 ON 확인.
4. 화면을 건드리지 않고 두어 다음 scheduled aggregate 경계 + 약 70초 이후 PC/모바일 숫자가 자동으로 `0 → 1` 되는지 확인.

통과 후 개발 측에서 별도로:
- 3곡 1분 batch `W1` 비용 확인.
- reversal 2방향 최종 수렴 확인.
- TEST 승격 가능 여부 판정.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 072**
- 072 실제 코드 commit: `d9863e48b353493b4a32e9ba913f11d30e31bbb9`
- PREVIEW 072 release trigger/locked build commit: `87ce8df39c525aeeb83a8437f794701e1c06686a`
- PREVIEW 072 App Run: `34637365382` — PASS
- 072 targeted apply Run: `34637256916` — PASS
- PREVIEW Worker는 069 서버 런타임 그대로 유지
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 069 서버 좋아요 구조 — 정상 / 유지
- 하트 상태는 즉시 로컬 반영.
- PREVIEW 좋아요 outbox는 1분 batch.
- 공개 숫자는 optimistic `+1/-1` 금지.
- Worker `*/10 * * * *` scheduled aggregate가 canonical 공개 숫자를 확정.
- 069 queue `explore_like_batches_069`는 queue write `W1/batch` 목표.
- `baseLiked` + 안정적인 `mutationAt`으로 aggregate 전 like↔unlike 역전 의도 보존.

실사용/읽기전용 진단 PASS:
- 1곡 batch: Worker 1 / D1 R1 W1 / queue row W1.
- PC 즉시 하트 ON.
- 약 1분 뒤 모바일 same-account 하트 ON.
- 모바일 정상 캐시 Explore Worker 0 / D1 0.
- queue 035/066/069 정상 소비.
- 테스트 곡 `track_stats.like_count=1`, `explore_derived_tracks.likes=1`.
- 직접 PREVIEW Feed fresh probe도 `like_count=1`.
- 즉 서버 batch/aggregate/canonical/derived는 정상.

## 3. 070/071 실사용 실패와 실제 원인
사용자가 서버에서 이미 숫자 1로 확정된 두 곡을 PC 화면에서 계속 `0`으로 확인.

070:
- aggregate 뒤 revision revalidation을 예약했지만 화면 0 유지 — FAIL.

071:
- 예약을 localStorage에 보존하고 cached revision이 같아도 Feed 재확인을 강제했지만, 사용자가 071 배포 뒤 기존 두 곡이 여전히 0임을 확인 — FAIL.

추가 코드 대조 결과:
- 071의 강제 확인도 결국 일반 `__soridraw_revision=<revision>` Feed URL을 재사용함.
- 이 URL의 HTTP edge 응답이 이전 숫자 0인 상태로 남으면, 서버 D1/R2가 이미 1이어도 브라우저가 같은 오래된 Feed payload를 다시 받을 수 있음.
- 반면 기존 읽기전용 진단에서 **고유 `__diag` query가 붙은 fresh Feed 요청은 즉시 `like_count=1`을 반환**했음.

판정:
- 숫자 0 고착의 마지막 원인은 10분 aggregate가 아니라 **좋아요 복구 요청에서도 같은 HTTP Feed cache key를 재사용한 것**.

## 4. 072 수정 — 실제 변경이 있을 때만 fresh Feed 1회
072 코드 commit `d9863e48b353493b4a32e9ba913f11d30e31bbb9`.

변경:
- 좋아요 숫자 복구가 필요한 경우 일반 revision URL을 다시 쓰지 않고 고유 `__soridraw_like_refresh=<timestamp>` query로 **HTTP edge cache key만 1회 우회**.
- Worker 아래쪽의 기존 derived R2/D1 경로는 그대로 사용.
- 현재 화면에서 `내 하트=ON`인데 공개 숫자 `0`인 기존 stale 행도 072 진입 후 1회 자동 복구 시도.
- 따라서 069/070/071 때 이미 서버 숫자 1로 확정됐지만 화면만 0인 기존 두 곡도 새 좋아요 테스트 없이 회복 가능하게 함.
- 새 좋아요가 aggregate 전 잠시 `하트 ON / 숫자 0`인 경우 immediate repair가 먼저 실행돼도, 10분 aggregate 후 최종 확인 deadline은 지우지 않고 유지.
- polling 없음.
- 반복 전면조회 없음.
- UI/CSS/반응형 변경 없음.

비용 판단:
- 정상 캐시 + 데이터 변경 없음에는 새 반복 요청 없음.
- `하트 ON / 숫자 0`처럼 실제 좋아요 관련 복구 후보 또는 저장된 aggregate deadline이 있는 경우에만 fresh Feed 1회.
- 앱 업데이트 자체를 이유로 전체 Feed를 반복 재생성하지 않음.
- Worker/D1 스키마/Functions/Rules 변경 없음.

## 5. 072 자동 검증 / 배포
Apply Run `34637256916` — PASS:
- targeted apply PASS.
- 072 static contract PASS.
- 기존 069 W1/reversal contract 보존.
- TypeScript PASS.
- Build PASS.
- change boundary PASS.
- 실제 동작 변경 source: `src/pages/ExplorePage.tsx`, `public/app-version.json`.
- Worker/D1/Functions/Rules/UI CSS/사용자 데이터 변경 없음.

PREVIEW App Run `34637365382` — PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=072` PASS.
- TEST / PRODUCTION branch 및 실제 HTML unchanged PASS.

## 6. 데이터 / 인프라 상태
- Shared 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- 069 `explore_like_batches_069` table 유지.
- 072에서 D1/Worker/Functions/Rules 변경 없음.
- PREVIEW Hosting만 072로 갱신.
- TEST / PRODUCTION 승격 없음.

## 7. 현재 판정
- 1곡 batch W1 실사용: **PASS**.
- PC 즉시 하트: **PASS**.
- PC→모바일 하트 동기화: **PASS**.
- 모바일 정상 캐시 Worker/D1 0: **PASS**.
- scheduled aggregate / canonical / derived / fresh Feed count: **PASS**.
- 070 자동 화면 반영: **FAIL**.
- 071 persistent forced refresh: **FAIL 실사용 재현**.
- 072 fresh Feed cache-key recovery: **코드/TS/Build/PREVIEW 배포 PASS, 사용자 화면 확인 전**.
- 3곡 1분 batch W1 실사용: 미검증.
- reversal 양방향 실제 최종 수렴: 미검증.
- TEST 승격: 금지.

## 8. 다음 작업
사용자는 복잡한 테스트를 다시 할 필요 없음.

072 최소 확인:
1. PC PREVIEW를 072로 업데이트.
2. 새 좋아요를 누르지 말고, 기존에 하트가 켜져 있는데 숫자 0이던 두 곡을 그대로 확인.
3. 두 곡 숫자가 서버 확정값 `1`로 자동 회복되는지 확인.

통과 후 개발 측에서 별도로 3곡 W1 비용과 reversal 실제 수렴을 검증하고 TEST 승격 가능 여부를 판단한다.

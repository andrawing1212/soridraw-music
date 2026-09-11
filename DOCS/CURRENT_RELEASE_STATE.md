# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 073**
- 073 실제 코드 commit: `6b85f64e8fabd7b84aa87e043cabbc1d010afa0a`
- PREVIEW 073 release trigger/locked build commit: `5455866878996a9c76cfd2f097d909c1e0f67abe`
- 073 targeted Apply Run: `34638932996` — PASS
- PREVIEW 073 App Run: `34639048578` — PASS
- 072 visible-track read-only diagnostic Run: `34638806229` — PASS
- PREVIEW Worker는 검증된 069 서버 런타임 그대로 유지
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 069 서버 좋아요 구조 — 정상 / 유지
- 하트 상태는 즉시 로컬 반영.
- PREVIEW 좋아요 outbox는 1분 batch.
- 공개 숫자의 canonical 값은 Worker `*/10 * * * *` scheduled aggregate에서 확정.
- 069 queue `explore_like_batches_069`는 queue write `W1/batch` 목표.
- `baseLiked` + 안정적인 `mutationAt`으로 aggregate 전 like↔unlike 역전 의도 보존.

실사용/읽기전용 진단 PASS:
- 1곡 batch: Worker 1 / D1 R1 W1 / queue row W1.
- PC 즉시 하트 ON.
- 약 1분 뒤 모바일 same-account 하트 ON.
- 모바일 정상 캐시 Explore Worker 0 / D1 0.
- queue 035/066/069 정상 소비.
- scheduled aggregate 정상.

## 3. 사용자가 확인한 072 문제
사용자가 PREVIEW 072에서 두 테스트 곡을 확인:
- `[Dubstep] '너라는 밤의 크기' | 'The Weight of Your Night'`는 화면 숫자 `1`로 회복.
- `[Breakbeat] '혼자만의 밤'`은 04:24 KST까지 화면 숫자 `0` 유지 — **072 실사용 FAIL**.

중요: 이것은 기다림/aggregate 문제로 판정하지 않는다.

Run `34638806229`에서 두 곡을 실제 Shared D1 + fresh PREVIEW Feed로 직접 확인한 결과:
- `너라는 밤의 크기`: canonical=1 / derived=1 / derived JSON=1 / relation=1 / fresh Feed `stats.likeCount=1`.
- `혼자만의 밤`: canonical=1 / derived=1 / derived JSON=1 / relation=1 / fresh Feed `stats.likeCount=1`.

따라서 두 번째 곡도 서버에는 이미 완전히 `1`로 확정되어 있었다. 문제는 client 표시 경로뿐이다.

## 4. 072의 실제 누락 원인
072의 fresh Feed 우회는 **브라우저 session Feed cache가 이미 있는 경로**에서는 정상 작동했다.

하지만 앱 업데이트 직후처럼 session Feed cache가 비어 있는 bootstrap 경로에서는 `forceLikeCountRefresh`가 있어도 일반 revision/versioned Feed URL로 다시 진입했다.

결과:
- 서버 canonical/derived/fresh Feed는 이미 1.
- 그런데 cache-empty bootstrap에서 이전 versioned HTTP Feed 응답을 다시 받으면 화면 숫자 0이 복원될 수 있었다.
- 한 번 repair key가 잡히면 동일 화면에서 재시도도 제한될 수 있었다.

이 구멍이 왼쪽은 1, 오른쪽은 0으로 남은 실사용 결과와 일치한다.

## 5. 073 수정
073 코드 commit `6b85f64e8fabd7b84aa87e043cabbc1d010afa0a`.

변경:
- 좋아요 숫자 강제 복구 시 session Feed cache가 있든 없든 **항상 고유 fresh Feed URL**을 1회 사용.
- cache-empty bootstrap에서도 일반 versioned Feed로 빠지지 않음.
- forced refresh가 실패하면 repair key를 해제해 다음 정상 기회에 다시 복구 가능.
- polling 없음.
- 반복 전면조회 없음.
- Worker/D1/Functions/Rules 변경 없음.
- UI/CSS/위치/간격/반응형 변경 없음.
- 사용자 원본 데이터 변경 없음.

## 6. 073 자동 검증 / 배포
Apply Run `34638932996` — PASS:
- 073 targeted apply PASS.
- static contract PASS.
- 기존 069 W1/reversal contract 보존.
- TypeScript PASS.
- Build PASS.
- change boundary PASS.

PREVIEW App Run `34639048578` — PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=073` PASS.
- TEST / PRODUCTION branch 및 실제 HTML unchanged PASS.

## 7. 데이터 / 인프라 상태
- Shared 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- D1 schema 변경 없음.
- PREVIEW Worker 재배포 없음.
- Firebase Functions / Firestore Rules 변경 없음.
- PREVIEW Hosting만 073으로 갱신.
- TEST / PRODUCTION 승격 없음.

## 8. 현재 판정
- 1곡 batch W1 실사용: **PASS**.
- PC 즉시 하트: **PASS**.
- PC→모바일 하트 동기화: **PASS**.
- 모바일 정상 캐시 Worker/D1 0: **PASS**.
- scheduled aggregate / canonical / derived / fresh Feed count: **PASS**.
- 070 자동 화면 반영: **FAIL**.
- 071 persistent forced refresh: **FAIL**.
- 072 cached-path fresh Feed recovery: 왼쪽 곡은 회복했지만 cache-empty bootstrap 누락으로 **전체 FAIL**.
- 073 cached + cache-empty forced fresh recovery: **코드/TS/Build/PREVIEW 배포 PASS, 사용자 화면 최종 확인 전**.
- 3곡 1분 batch W1 실사용: 미검증.
- reversal 양방향 실제 최종 수렴: 미검증.
- TEST 승격: 금지.

## 9. 다음 작업
사용자는 새 좋아요나 10분 대기 테스트를 다시 할 필요 없음.

최소 확인:
1. PC PREVIEW를 073으로 업데이트.
2. 기존 오른쪽 곡 `[Breakbeat] '혼자만의 밤'`을 그대로 확인.
3. 서버가 이미 `1`이므로 새 좋아요/새 aggregate 없이 화면 숫자가 `1`로 회복되어야 함.

073에서도 0이면 더 이상 서버/aggregate를 기다리지 않는다. 그 경우 문제를 client state 적용/render 단계로 한정해 바로 진단한다.

073 표시 복구가 통과한 뒤에만:
- 사용자가 제안한 UX 개선(본인이 좋아요를 누르는 순간 화면 숫자는 즉시 +1/-1, 서버 canonical은 기존 10분 aggregate 유지)을 별도 적용 검토.
- 개발 측에서 3곡 W1 비용과 reversal 실제 수렴 검증.
- 이후 TEST 승격 가능 여부 판단.

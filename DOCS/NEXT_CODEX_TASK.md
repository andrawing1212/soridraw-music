# NEXT CODEX TASK

상태: **102 Explore 공개 좋아요 교차계정 수렴 코드 완료 / 자동검증 PASS / 미배포 / PREVIEW 실사용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 102 제품 commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`
- 102 source apply Run: `35046615434` — PASS
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: 기존 **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 102에서 해결한 구조
### 공개 총 좋아요 숫자
- 새 069 W1 좋아요 intake/묶음 구조 유지.
- canonical aggregate에서 실제 public count가 변했을 때만 public projection 수렴 실행.
- `latest` / `popular` Feed 첫 40곡을 기존 derived index 기반 bounded 방식으로 정확히 재구성.
- 전체 tracks/likes/track_stats scan 금지.
- Feed R2가 canonical 결과와 달라지면 R2 ETag가 변경되어 다른 계정 revision check가 변경을 감지.
- 첫 화면에서 보이는 changed track의 Public Profile R2도 owner별로 묶어 갱신.
- derived cache patch 실패가 이미 성공한 canonical D1 mutation을 rollback하지 않음.

### 공개 revision blind window
- 기존 client revision cache 최대 10분은 유지.
- 다음 10분 aggregate 경계 + 70초를 넘어 stale revision을 가리지 않도록 만료시각을 더 이른 쪽으로 제한.
- server polling 확대나 D1 revision read를 추가하지 않음.

### 유지한 비용 원칙
- cron `*/10 * * * *` 유지.
- idle aggregate W0 보호.
- page-entry/update/revisit 때문에 D1 full read/write 금지.
- UI/CSS/반응형 변경 없음.
- D1 schema/migration/backfill 없음.
- 사용자 원본 데이터 변경 없음.

## 자동검증
Run `35046615434` PASS:
- 102 public-like parity verifier PASS
- existing Explore like cost verifier PASS
- derived cache regression verifier PASS
- TypeScript PASS
- Production Build PASS
- git diff/check boundary PASS

핵심 계약:
- `PUBLIC_FEED_RECONCILE=BOUNDED_TOP40`
- `PUBLIC_PROFILE_PATCH=VISIBLE_CHANGED_ONLY`
- `REVISION_CACHE=10MIN_CEILING_BOUNDARY_SHORTEN_ONLY`
- unchanged cursor item/rank/write 0 유지
- warm revision D1 R0 유지
- 100 same-track likes → derived count update 1회 구조 유지
- net-zero count cohort → public derived write 0 유지

## 다음 작업
**코드 수정부터 추가로 하지 않는다. 사용자가 PREVIEW 배포를 요청하면 102를 배포하고 실제 교차계정 검증부터 한다.**

배포 대상:
1. 고정된 102 app source.
2. 새 public-like parity가 포함된 canonical PREVIEW Explore Worker.
3. D1 migration 없음.
4. Firebase Functions / Firestore Rules / RTDB Rules / Media Worker 변경 없음.

PREVIEW 배포 완료 기준:
- TypeScript / Build / verifier 재PASS.
- Worker preflight PASS.
- PREVIEW Worker만 변경되고 TEST/PRODUCTION Worker 비변경.
- Firebase PREVIEW Hosting만 변경되고 TEST/PRODUCTION Hosting 비변경.
- 실제 `preview.soridraw.com` app-version 102 확인.
- `/v1/feed`, 공개 profile, `/v1/feed-revision` smoke PASS.

## PREVIEW 실사용 검증 매트릭스
1. Master에서 곡 A 좋아요 후 실제 boundary flush/aggregate 반영 확인.
2. Master PC↔Master 모바일: 개인 heart + 공개 숫자 수렴.
3. Admin A: 자기 heart membership은 독립, 공개 숫자는 Master와 동일.
4. Admin B: 자기 heart membership은 독립, 공개 숫자는 Master와 동일.
5. 곡 A 좋아요 해제 후 세 계정 공개 숫자 동일하게 감소.
6. 최신 Feed / 인기 Feed / 해당 공개프로필 숫자 동일.
7. 기존 오래된 캐시가 있는 기기도 aggregate 이후 재접속/활동으로 새 공개 숫자 수렴.
8. 변경 없는 warm 재진입에서 D1 data read/write 0 목표 확인.
9. 실제 좋아요 변경시에만 queue/aggregate/R2 bounded 작업 발생 확인.
10. 앱 업데이트만으로 전체 Feed/Profile 재생성 없음 확인.

## 판정 주의
- 공개 숫자는 현재 비용 구조상 scheduled aggregate 경계까지 최대 약 10분 지연 가능.
- 이 지연 자체는 현재 설계상 허용 범위이며, **aggregate 이후에도 계정별 숫자가 다르게 남는 것은 FAIL**.
- 다른 계정의 빨간 heart를 같게 만드는 것은 오답. heart는 각 계정의 개인 membership.

## 추가 문제 발생 시
- public Feed/Profile 숫자가 aggregate 후에도 다르면 canonical D1 → derived row → R2 → revision → local cache 순서로만 추적.
- 전체 Feed 재조회, 전체 Profile 재생성, 사용자별 polling으로 우회 금지.
- 개인 heart stale가 별도로 재현되면 public 숫자와 섞지 말고 UID별 작은 revision/cursor 방식으로 후속 해결.
- D1 schema 변경/backfill/delete가 필요하면 실행 전 사용자 승인 필요.

## 승격 금지
- 102 Master/Admin A/Admin B 교차계정 검증 PASS 전 TEST 승격 금지.
- 100 liked-card zero-read와 101 Library 비용/정확성 실측도 TEST 전 완료.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.

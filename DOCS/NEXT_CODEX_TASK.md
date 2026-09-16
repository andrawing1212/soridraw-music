# NEXT CODEX TASK

## 우선 작업 — 107 공개 좋아요 실제 대조 후 남은 확인

- 2026-09-16 read-only Run [35065130889](https://github.com/andrawing1212/soridraw-music/actions/runs/35065130889) SUCCESS.
- 지정 곡 `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q`는 likes membership → track_stats → derived row → PREVIEW R2 latest/popular/profile → API까지 **모두 1**. 전체 표/비용은 CURRENT_RELEASE_STATE 0F 참조.
- 이번 증거에서는 서버에서 0으로 끊기는 구간을 재현하지 못했다. 원인 확정 전 제품 코드 수정/배포 금지 유지.
- 실제 0을 표시하는 앱107 화면 및 해당 브라우저의 API/기존 캐시 값을 확인해 최초 불일치 지점을 찾아야 한다. 서버 projection 문제라고 미리 가정하거나 클라이언트 숫자 보정을 추가하지 않는다.
- 기존 1분 event-driven aggregate, 개인 membership, local outbox, same-account RTDB 유지. D1/schema/backfill/사용자 데이터 변경 없음.
- 임시 진단 Workflow/script는 제거. 제품 변경이 없으므로 TypeScript/Build/회귀 테스트 재실행 및 PREVIEW 재배포 없음.
- TEST/PRODUCTION 접근·변경·승격 금지. 아래 107/106 배포 기록은 이 진단 이전 이력이다.


상태: **107 PREVIEW 앱 배포 완료 / 자동·배포 검증 PASS / 교차계정 좋아요·공개프로필 warm 비용 실사용 검증 전 / TEST 승격 금지**

## 107 PREVIEW 배포 결과
- 107 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`.
- clean head: `cac2fd2cfea0b5f22a053cff4a106b1f93c02230`.
- PREVIEW 배포 source: `998bcce8ef1d0beb906ba5f7dd7d81f735030263`.
- 구현·검증 Run `35061505658` PASS / 정리 Run `35061772251` PASS / App Release Run `35061844172` PASS.
- 실제 PREVIEW 앱: **107** — `https://preview.soridraw.com` / exact build PASS.
- 공개 숫자: 계정별 display overlay 제거, shared Feed/Profile `track.likeCount` 직접 표시.
- 공개프로필: 10초 시간기반 재확인 제거, 정상 warm cache 재진입은 서버 D1 read 0 목표.
- Explore Worker는 기존 `961084b2-28e0-4d04-8577-56d8944f4916` 유지. 1분 event-driven, fixed cron 없음.
- UI/CSS / Functions / Rules / RTDB Rules / D1 schema / 사용자 원본 데이터 변경 없음.
- TEST/PRODUCTION 비변경.
- 다음은 실사용에서 공개 숫자 수렴과 warm 공개프로필 D1 0을 확인한다. PASS 전 TEST 승격 금지.

## 106 PREVIEW 배포 결과
- PREVIEW App Release Run: `35059625879` — **SUCCESS**.
- 배포 source/trigger commit: `caf6f458096f876ae93bfb07c60f9445d6a14c76`.
- 당시 실제 PREVIEW 앱: **106** — `https://preview.soridraw.com`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS / exact build PASS.
- TEST / PRODUCTION branch와 실제 Hosting 비변경 PASS.
- Explore Worker는 기존 `961084b2-28e0-4d04-8577-56d8944f4916` 유지. 재배포 없음.
- Functions/Rules/RTDB Rules/D1/Media Worker/사용자 데이터/UI-CSS 변경 없음.
- 다음 단계는 Master/Admin 교차계정 좋아요·해제 실사용 확인. PASS 전 TEST 승격 금지.

## 현재 기준
- branch: `preview`
- 107 최종 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`
- 107 구현·검증 Run: `35061505658` — PASS
- 107 PREVIEW App Release Run: `35061844172` — PASS
- 실제 PREVIEW 앱: **107** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: **105 1분 event scheduler** / `961084b2-28e0-4d04-8577-56d8944f4916`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 105 실사용 FAIL에서 확인한 문제
- Master/Admin이 같은 공개곡을 보고 있는데 공개 총 좋아요 숫자가 서로 달라짐.
- 숫자가 잠시 바뀌었다가 옛 값으로 돌아오거나 계정별 다른 숫자가 유지됨.
- 원인은 shared public aggregate 위에 계정별 로컬 display state / same-account RTDB 숫자 replay가 덮일 수 있었던 것.

## 106 최종 구조
- **개인 하트와 공개 숫자를 완전히 분리한다.**
- 빨간/빈 하트는 로그인 계정의 membership만 담당하며 클릭 즉시 로컬 반영.
- 하트 옆 공개 숫자는 shared Feed/Profile canonical projection만 담당.
- 공개 숫자에 계정 로컬 `+1/-1` 보정을 하지 않는다.
- same-account RTDB는 개인 membership 동기화에만 사용하고 106 클라이언트는 RTDB의 count 필드를 공개 숫자에 적용하지 않는다.
- 구버전 호환을 위해 기존 RTDB payload 필드는 제거하지 않는다.
- 오래된 091 local display overlay는 106 namespace 전환 시 로컬 파생 캐시만 무효화.
- 사용자 원본 데이터, likes canonical 의미, D1 schema는 변경하지 않는다.

## 서버/비용 구조 — 105 유지
- 첫 실제 like batch가 들어오면 shared Durable Object alarm을 1분 뒤 한 번 예약.
- 같은 1분 창의 추가 변경은 묶음 처리.
- 고정 1분 Cron 없음. 좋아요가 없으면 aggregate 반복 실행 0.
- 102 public Feed/Profile R2 canonical 수렴 유지.
- warm unchanged `/v1/feed-revision` D1 R0/W0 기준 유지.
- 106에서는 Worker 코드 변경 없음.

## 자동검증
Run `35058485482` PASS:
- `106_EXPLORE_PUBLIC_COUNT_SEPARATION=PASS`
- `PUBLIC_COUNT_SOURCE=SHARED_CANONICAL_FEED_PROFILE`
- `ACCOUNT_SIGNAL=MEMBERSHIP_ONLY`
- `PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE`
- 105 one-minute contract PASS
- 103 event scheduler compatibility PASS
- 102 public-like parity PASS
- existing Explore like cost verifier PASS
- TypeScript PASS
- Build PASS
- change boundary PASS
- Worker / D1 schema / user data / UI-CSS change 없음

## 다음 작업
107 PREVIEW Hosting 배포는 완료되었다. 다음은 **Master/Admin 교차계정 공개 숫자 + 공개프로필 warm 0-read 실사용 검증**이다.
- Explore Worker는 105의 1분 event scheduler를 그대로 사용하므로 불필요한 재배포 금지.
- Functions/Rules/RTDB Rules/D1/Media Worker 배포 금지.
- TEST/PRODUCTION 변경 금지.

배포 후 실사용 확인:
1. Master/Admin 모두 앱 106 적용 확인.
2. 같은 공개곡의 **공개 숫자**가 초기부터 동일한지 확인.
3. Master가 좋아요를 눌렀을 때 하트는 즉시 빨간색으로 바뀌되, 공개 숫자는 공식 aggregate 전까지 이전 공용 숫자를 유지해도 정상.
4. 약 1분~1분 10초 후 Admin 재진입/포커스/상호작용 시 Master/Admin 공개 숫자가 반드시 동일해야 함.
5. 좋아요 해제도 동일하게 수렴해야 함.
6. 여러 계정이 같은 1분 안에 좋아요/해제를 섞어도 최종 공개 숫자가 모든 계정에서 같아야 함.
7. 공개 숫자가 계정마다 따로 튀거나 옛 값으로 되돌아가면 FAIL.
8. 추천/최신/인기/공개프로필의 같은 곡 숫자가 최종적으로 동일해야 함.
9. 유휴 상태 고정 aggregate 0, warm unchanged revision D1 R0/W0 유지 확인.

## 주의
- 106에서는 **빨간 하트 + 아직 0인 공개 숫자**가 최대 약 1분 동안 보일 수 있다. 개인 하트는 즉시 상태이고 공개 숫자는 공식 묶음 처리 후 바뀌기 때문에 의도된 동작이다.
- 이 분리를 통해 사용자별 가짜 공개 숫자와 되돌림을 제거한다.
- TEST 승격은 106 PREVIEW 교차계정 좋아요/해제 + 비용 실측 PASS 이후에만 검토.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.

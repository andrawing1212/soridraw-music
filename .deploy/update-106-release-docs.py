from pathlib import Path

current = Path('DOCS/CURRENT_RELEASE_STATE.md')
s = current.read_text(encoding='utf-8')
intro = '> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.\n\n'
marker = '## 0C. PREVIEW 106 — 공개 좋아요 숫자와 개인 하트 완전 분리 / 코드 완료·미배포\n'
block = '''## 0C. PREVIEW 106 — 공개 좋아요 숫자와 개인 하트 완전 분리 / 코드 완료·미배포
- 105 PREVIEW 실사용 영상에서 같은 공개곡의 숫자가 Master/Admin 사이에서 달라지고, 숫자가 되돌아가거나 계정별로 서로 다른 값이 남는 현상을 확인해 **105 실사용 FAIL**로 판정.
- 확정 원인: 공개 총 좋아요 숫자 위에 계정별 로컬 display state와 same-account RTDB replay 숫자가 덮여, 하나여야 할 공개 숫자가 계정/기기별 파생값을 가질 수 있었음.
- **106 최종 규칙: 하트는 개인 상태, 숫자는 공용 상태로 완전히 분리.**
  - 빨간/빈 하트: 로그인 계정의 개인 membership만 즉시 표시.
  - 하트 옆 공개 숫자: shared Feed/Profile canonical projection 값만 표시.
  - 계정 로컬 `+1/-1` 숫자 보정도 제거. 개인 클릭이 공개 숫자를 임의로 덮지 못함.
  - same-account RTDB는 106에서 공개 숫자 변경에 사용하지 않고 개인 membership 동기화에만 사용. 기존 필드는 구버전 호환을 위해 파싱 가능 상태로 유지.
  - 기존 `091` 로컬 display overlay는 새 `106` namespace로 전환하면서 기기 로컬 파생 캐시만 무효화. 사용자 원본 데이터 삭제/변환 없음.
- 1분 event-driven server aggregate 구조는 그대로 유지. **고정 1분 Cron 없음.** 실제 좋아요가 있을 때만 1분 alarm 1회.
- 106 초기 separation commit: `31b91b02b0aa6692401b457e6286ffad250c7b03`.
- 106 최종 canonical-only 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`.
- 최종 검증 Run `35058485482` PASS: 106/105/103/102 like verifiers, 기존 like cost verifier, TypeScript, Build, change-boundary 모두 PASS.
- 최종 검증 결과: `PUBLIC_COUNT_SOURCE=SHARED_CANONICAL_FEED_PROFILE`, `ACCOUNT_SIGNAL=MEMBERSHIP_ONLY`, `PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE`, `IDLE_PERIODIC_CRON=0`.
- 106은 클라이언트 표시/동기화 경계 수정만 포함. Cloudflare Worker, Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, UI/CSS, 사용자 원본 데이터 변경 없음.
- **현재 실제 PREVIEW 런타임은 앱 105 + Explore Worker `961084b2-28e0-4d04-8577-56d8944f4916`. 106은 아직 배포하지 않음.**
- 106 배포 시 Worker 재배포 불필요. PREVIEW Firebase Hosting만 106으로 올리고 실제 `preview.soridraw.com` exact build 확인.
- 106 의도된 UX: 하트는 즉시 바뀌지만 공개 숫자는 공식 1분 aggregate 전까지 이전 공용 숫자를 유지할 수 있음. 따라서 잠깐 `빨간 하트 + 공개숫자 0`이 가능하지만, 이는 계정별 가짜 숫자를 만들지 않기 위한 의도된 분리이며 aggregate 후 모든 계정의 숫자가 동일해야 함.
- TEST/PRODUCTION 비변경. 106 PREVIEW 교차계정 실사용 검증 전까지 TEST 승격 금지.

'''
if marker not in s:
    if intro not in s:
        raise SystemExit('intro anchor missing')
    s = s.replace(intro, intro + block, 1)

# Correct the stale summary section so new chats do not treat 104 as current.
s = s.replace('- 현재 `preview` 제품 코드 후보: **104**', '- 현재 `preview` 제품 코드 후보: **106**')
s = s.replace('- 실제 PREVIEW 앱: **104** — `https://preview.soridraw.com` — Run `35052825886` PASS', '- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com` — Run `35055877861` PASS')
s = s.replace('- 실제 PREVIEW Explore Worker: **103 event scheduler** / `0287b2ef-6445-47a4-afd9-6058f02706cc` — 고정 10분 cron 제거 완료', '- 실제 PREVIEW Explore Worker: **105 1분 event scheduler** / `961084b2-28e0-4d04-8577-56d8944f4916` — 고정 cron 없음')
s = s.replace('- **릴리스 상태: 104 PREVIEW 배포 완료, 교차계정 공개 좋아요 재검증 전. TEST 승격 금지.**', '- **릴리스 상태: 106 코드 완료·미배포. 실제 PREVIEW는 105이며, 106 PREVIEW 교차계정 재검증 전까지 TEST 승격 금지.**')
anchor = '- 104 first-like 5분 창 수정 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`\n'
if anchor in s and '106 canonical-only 공개 숫자 분리 제품 commit' not in s:
    s = s.replace(anchor, anchor + '- 105 1분 event 테스트 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`\n- 106 canonical-only 공개 숫자 분리 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`\n', 1)
current.write_text(s, encoding='utf-8')

next_doc = Path('DOCS/NEXT_CODEX_TASK.md')
next_doc.write_text('''# NEXT CODEX TASK

상태: **106 공개 좋아요 숫자/개인 하트 분리 코드 완료 / 자동검증 PASS / 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 106 최종 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`
- 106 초기 separation commit: `31b91b02b0aa6692401b457e6286ffad250c7b03`
- 106 최종 검증 Run: `35058485482` — PASS
- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com`
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
사용자가 명확하게 PREVIEW 배포를 요청하면 **Firebase PREVIEW Hosting만 앱 106으로 배포**한다.
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
''', encoding='utf-8')

print('UPDATE_106_DOCS=PASS')

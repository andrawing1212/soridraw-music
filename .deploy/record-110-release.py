from pathlib import Path
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit('usage: record-110-release.py <product_sha> <run_id>')
product_sha, run_id = sys.argv[1:]

current_path = Path('DOCS/CURRENT_RELEASE_STATE.md')
current = current_path.read_text(encoding='utf-8')
current = re.sub(r'최종 갱신: .*', '최종 갱신: 2026-09-16 KST — PREVIEW 110 배포 완료', current, count=1)
marker = '> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.\n'
if marker not in current:
    raise SystemExit('release-state marker missing')
if '## 0I. PREVIEW 110' not in current:
    section = f'''

## 0I. PREVIEW 110 — 개인 좋아요곡 공개 숫자 로컬 정합성 복구 + 109 실사용 PASS

- **109 사용자 실사용 확인:** PC Master/Admin 공개 숫자 `1` 보존 PASS, 모바일 Master/Admin도 `1` 복구 PASS. 반복 hard refresh의 Firestore `users:onSnapshot` 증가 현상도 사용자 확인상 해소. 두 번째 관리자 계정의 `users:getDocs 12`는 관리자 목록 cold cache 최초 1회에서 문서 12개를 받은 값이며 요청 12회가 아님; 목록은 최대 20개 페이지 단위 + 관리자 UID/정렬별 persistent cache 구조.
- **남은 FAIL:** 자기 공개프로필의 `좋아요 곡` 탭에서는 heart membership은 빨간색으로 맞지만 카드 공개 `likeCount`가 과거 liked-card persistent cache의 `0`으로 표시됨. Explore 메인 공용 Feed는 같은 곡 `1`이므로 서버 canonical 문제가 아님.
- **110 제품 commit:** `{product_sha}`. PREVIEW Release Run `{run_id}`. 실제 `https://preview.soridraw.com` 앱 버전 **110**, exact index PASS, TEST/PRODUCTION app-version 비변경 PASS.
- **110 수정:** shared Feed/Profile payload에서 이미 확인된 public `likeCount`를 개인 liked-card 장기 cache와 현재 열려 있는 `좋아요 곡` state에 로컬로 동기화한다. warm persistent Feed cache도 즉시 source로 사용하므로 기존 stale `0` 카드는 서버 재조회 없이 `1`로 복구할 수 있다.
- liked-track cache schema는 `1` 그대로 유지한다. 앱 업데이트 때문에 좋아요곡 cache를 폐기하거나 전체 liked tracks를 서버에서 재수집하지 않는다. 새 polling/fetch 없음. public 숫자는 shared payload가 authority이고 membership/outbox는 기존 계정별 구조를 유지한다.
- TypeScript PASS / Build PASS / 110 verifier PASS / 109·108·107·105·103·102 관련 verifier PASS.
- PREVIEW Explore Worker는 **재배포하지 않음**. 기존 `d8eae38a-09a9-4f37-9500-57f217ee1d8c` 유지. 1분 event-driven aggregate 및 fixed cron 0 유지.
- Firebase Functions/Rules/RTDB Rules 변경 없음. D1 schema/migration/backfill 없음. 사용자 원본 데이터 변경 없음. UI/CSS 변경 없음.
- 비용: 110 liked-card 복구 자체는 이미 기기에 있는 shared Feed/Profile payload → local cache patch이며 Firestore/D1 추가 read/write **0 계약**.
- TEST/PRODUCTION 승격 없음. formal Work 독립 감사는 미실행.
- **실사용 검증 필요:** 모바일/PC 자기 `좋아요 곡` 탭의 기존 0이 1로 복구되는지, 재진입/새로고침에도 유지되는지, like/unlike 후 약 1분 뒤 Feed/Profile/좋아요곡 숫자가 동일하게 수렴하는지 확인 전 TEST 승격 금지.
'''
    current = current.replace(marker, marker + section, 1)
current_path.write_text(current, encoding='utf-8')

Path('DOCS/NEXT_CODEX_TASK.md').write_text(f'''# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST

## 현재 기준

- branch: `preview`
- PREVIEW app: **110**, `https://preview.soridraw.com`
- 110 product commit: `{product_sha}`
- PREVIEW release Run: `{run_id}` SUCCESS
- PREVIEW Explore Worker: `d8eae38a-09a9-4f37-9500-57f217ee1d8c` (110에서 재배포 없음)
- TEST/PRODUCTION: 비변경

## 109 사용자 실사용 결과

- PC Master/Admin public count 1 PASS.
- Mobile Master/Admin public count 1 PASS.
- repeated hard refresh Firestore runaway: 사용자 확인상 PASS.
- second Admin cold `users:getDocs 12`: 1 query가 12 documents를 받은 진단값; admin user list는 max 20/page persistent cache.

## 110 수정

- 자기 `좋아요 곡` 탭의 red heart + stale public count 0 문제 수정.
- shared Feed/Profile의 public likeCount를 open liked-tab state + `explore-liked-track-collection-085` local cache에 로컬 반영.
- warm Feed cache도 repair source로 사용. 추가 Firestore/D1 read 없음.
- liked-track schema reset 없음, app-version coupling 없음, polling 없음.
- Worker/Functions/Rules/D1/user source data/UI/CSS 변경 없음.

## 다음 작업 — 실사용 검증만

1. PC/모바일 자기 공개프로필 → `좋아요 곡`에서 기존 0이 shared public count 1로 복구되는지 확인.
2. 페이지 이동/재진입/새로고침 후에도 1 유지.
3. Master/Admin 각 계정에서 자신의 heart membership은 계정별로 맞고 public count는 동일한지 확인.
4. like/unlike 후 개인 heart 즉시, 약 1분~1분10초 뒤 Explore Feed/Public Profile/좋아요곡 public count가 같은 최종값으로 수렴.
5. warm 재진입 D1 R0/W0 및 repeated refresh Firestore R0 목표 재확인.

위 검증 전 TEST 승격 금지. `테스트배포` 명시 승인 전 main 변경 금지. PRODUCTION은 별도 명확 승인 전 금지.

주의: 103 Durable Object migration v1 유지. pre-103 Worker 직접 rollback은 피하고 migration을 유지한 forward-compatible rollback 사용. formal Work 독립 감사 미실행.
''', encoding='utf-8')

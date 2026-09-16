from pathlib import Path

current = Path('DOCS/CURRENT_RELEASE_STATE.md')
text = current.read_text(encoding='utf-8')
marker = '## 0E. PREVIEW 107 — Explore 구조 정리 / 공개 숫자 직접 표시 / 공개프로필 warm 0-read 배포 완료'
section = '''## 0E. PREVIEW 107 — Explore 구조 정리 / 공개 숫자 직접 표시 / 공개프로필 warm 0-read 배포 완료
- 사용자 지시대로 새 보정을 더 쌓지 않고 **과거 불필요한 좋아요 숫자 중간 계층을 제거하면서 구조를 단순화**했다.
- 107 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`.
- 생성물/임시 작업 파일 정리 후 clean head: `cac2fd2cfea0b5f22a053cff4a106b1f93c02230`.
- PREVIEW 배포 trigger/source commit: `998bcce8ef1d0beb906ba5f7dd7d81f735030263`.
- 107 구현·검증 Run `35061505658` — **SUCCESS**.
- 임시/생성물 정리 Run `35061772251` — **SUCCESS**.
- PREVIEW App Release Run `35061844172` — **SUCCESS**.
- 실제 `https://preview.soridraw.com` 앱 버전 **107**, exact build hash PASS.
- TypeScript PASS / Build PASS / 기존 105 1분 event contract PASS / 103 event scheduler compatibility PASS / 102 public-like parity PASS.
- **공개 좋아요 숫자 표시 구조 단순화:** 카드 숫자는 shared Feed/Profile payload의 `track.likeCount`를 직접 표시한다. 계정별 로컬 숫자 overlay/canonical 중간 map을 제거했다.
- `src/services/exploreLikeDisplayStateService.ts` 삭제. 과거 pending/accepted 숫자 보정 계층과 106 전용 verifier도 제거했다.
- 개인 heart membership / local outbox / same-account RTDB membership sync는 유지하되 공개 숫자를 덮어쓰지 않는다.
- **공개프로필 warm 재진입 비용 수정:** 기존 `10초` 시간 경과만으로 `/first-view` 서버 재확인하던 경로를 제거했다. 정상 로컬 캐시가 있으면 warm 재진입은 서버 요청 없이 캐시를 사용하며 D1 read 0을 목표로 한다.
- Explore Worker는 재배포하지 않음. 기존 105 1분 event-driven Worker `961084b2-28e0-4d04-8577-56d8944f4916` 유지. 고정 1분 Cron 없음.
- UI/CSS 변경 없음. Firebase Functions/Rules/RTDB Rules, D1 schema/migration/backfill, 사용자 원본 데이터 변경 없음.
- TEST/PRODUCTION branch 및 실제 Hosting 비변경 PASS.
- **현재 상태: 107 PREVIEW 배포 완료 / 교차계정 공개 좋아요 숫자 + 공개프로필 warm D1 0 실사용 검증 전 / TEST 승격 금지.**
- 실사용 기준: 앱 107을 받은 뒤 기존 공개 숫자가 Feed/Profile 값 그대로 보여야 한다. 좋아요/해제는 개인 heart 즉시 반영, 공개 숫자는 약 `1분~1분 10초` 후 모든 계정에서 동일하게 수렴해야 한다.
- 비용 기준: 진단 초기화 후 공개프로필 첫 진입은 필요 시 서버를 사용할 수 있으나, 같은 프로필 warm 재진입은 10초가 지나도 반복 D1 read가 생기면 FAIL.
- 주의: 공개프로필 cache는 이제 단순 시간 경과로 재확인하지 않는다. 다른 기기에서 프로필을 바꾼 경우 변경 신호/무효화 경로가 제대로 갱신하는지는 별도 교차기기 실사용 검증이 필요하다.

'''
if marker not in text:
    anchor = '## 0D. PREVIEW 106'
    if anchor not in text:
        raise RuntimeError('CURRENT release insertion anchor missing')
    text = text.replace(anchor, section + anchor, 1)
current.write_text(text, encoding='utf-8')

nxt = Path('DOCS/NEXT_CODEX_TASK.md')
text = nxt.read_text(encoding='utf-8')
lines = text.splitlines()
for i, line in enumerate(lines):
    if line.startswith('상태: **'):
        lines[i] = '상태: **107 PREVIEW 앱 배포 완료 / 자동·배포 검증 PASS / 교차계정 좋아요·공개프로필 warm 비용 실사용 검증 전 / TEST 승격 금지**'
        break
text = '\n'.join(lines) + '\n'
section2 = '''## 107 PREVIEW 배포 결과
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

'''
if '## 107 PREVIEW 배포 결과' not in text:
    anchor = '## 106 PREVIEW 배포 결과'
    if anchor not in text:
        anchor = '## 현재 기준'
    if anchor not in text:
        raise RuntimeError('NEXT insertion anchor missing')
    text = text.replace(anchor, section2 + anchor, 1)

text = text.replace('- 실제 PREVIEW 앱: **106** — `https://preview.soridraw.com`', '- 실제 PREVIEW 앱: **107** — `https://preview.soridraw.com`', 1)
text = text.replace('- 106 최종 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`', '- 107 최종 제품 commit: `2fc858003b96d59a9e29961d60e4a4cf04181905`', 1)
text = text.replace('106 PREVIEW Hosting 배포는 완료되었다. 다음은 **Master/Admin 교차계정 실사용 검증**이다.', '107 PREVIEW Hosting 배포는 완료되었다. 다음은 **Master/Admin 교차계정 공개 숫자 + 공개프로필 warm 0-read 실사용 검증**이다.', 1)
nxt.write_text(text, encoding='utf-8')

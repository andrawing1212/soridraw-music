from pathlib import Path
import re

current_path = Path('DOCS/CURRENT_RELEASE_STATE.md')
current = current_path.read_text(encoding='utf-8')
current = re.sub(r'최종 갱신: .*', '최종 갱신: 2026-09-16 KST — PREVIEW 110 Explore 전체 서버 누수 감사', current, count=1)
marker = '> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.\n'
section = '''

## 0J. PREVIEW 110 — Explore 전체 서버 누수 read-only 감사

- 사용자 요청으로 **공개프로필 / 추천 / 최신 / 인기 / 좋아요 관련 warm 경로**를 코드 + 실제 PREVIEW Worker read-only 요청으로 점검했다. 제품/Worker/Firebase 배포 및 사용자 데이터 변경은 하지 않았다.
- 감사 Run: `35097131910`(전체 계약/Feed/Profile), `35097437487`(공개프로필 반복), `35097777687`(정상/존재하지 않는 프로필), `35098115430`(직접 Feed canonical/cache-buster 경계).
- TypeScript PASS / Build PASS / 110·109·108·107·105·103·102 verifier PASS. ExplorePage 고정 polling 없음, Worker 고정 cron 0, Explore 정상 읽기 경로의 Firestore 직접 사용 없음.
- **추천/최신:** 현재 추천은 별도 서버 랭킹이 아니라 `latest` backend source를 공유한다. 따라서 추천↔최신 전환 때문에 별도 서버 Feed가 하나 더 생기지 않는다.
- **Feed revision:** latest/popular 모두 실제 D1 `R0/W0`. 첫 edge에서 R2 HEAD 1회, 같은 edge 반복은 R2도 0. 클라이언트 revision cache는 1분이며 고정 timer polling은 없다.
- **앱 첫 페이지 Feed:** latest/popular R2 snapshot 모두 실제 D1 `R0/W0`. 감사 시 각 38곡, 첫 edge R2 GET 1회 후 같은 edge 반복은 R2 0. 앱의 정상 cold/warm 첫 페이지는 이 경로를 사용한다.
- **직접 Feed fallback:** 새 감사 POP에서 canonical latest 직접 API 첫 요청은 D1 read 2, 이후 동일 요청은 R0. popular는 이미 warm이라 R0. 임의 `noise` query 반복도 감사 시 R0. 이 직접 fallback은 앱의 정상 첫 페이지 경로가 아니며 읽기는 bounded지만, 앱 경로보다 비용이 높다.
- **정상 공개프로필:** 새 edge/POP의 첫 직접 요청에서 D1 read 2, 같은 edge 반복은 R0/W0. 실제 앱 warm 재진입은 브라우저 persistent profile cache가 먼저 반환하므로 Worker 요청 자체가 없다. profile rebuild는 최대 first-page 50/51 범위로 제한되고 owner 전체곡 scan/COUNT는 금지되어 있다.
- **발견된 서버 누수 1건:** 존재하지 않는 공개프로필 ref를 직접 반복 요청하면 `404`인데도 매번 **D1 read 1**이 발생했다 (`INVALID_1/2/3 = D1R1/W0`). 404 negative cache/edge 차단이 없어 악의적으로 서로 다른/존재하지 않는 프로필 URL을 반복 호출하면 D1 read가 요청 수만큼 증가할 수 있다. 정상 앱의 유효 프로필 새로고침 문제와는 별도지만, 엄격한 서버 누수 기준에서는 **FAIL**이다.
- 좋아요는 1분 event-driven batch 유지, idle fixed cron 0. 110 liked-card 숫자 복구는 shared local payload → local cache patch이므로 추가 D1/Firestore read 없음.
- **판정:** 추천/최신/인기 정상 앱 경로는 서버 데이터 누수 PASS. 정상 공개프로필 warm도 PASS. 단, 공개프로필 **존재하지 않는 ref 반복 공격 경로는 FAIL**이므로 이를 막기 전에는 Explore 전체를 완전 PASS로 보지 않는다.
- 감사 과정 write/migration/backfill 없음. D1 관측 write 전부 0. TEST/PRODUCTION 변경 없음. PREVIEW 앱 110 / Worker `d8eae38a-09a9-4f37-9500-57f217ee1d8c` 유지.
- 다음 수정 원칙: UI/데이터 구조를 건드리지 않고 Worker edge에서 404 negative cache 또는 동등한 bounded 방어를 추가해 같은 invalid ref 반복이 D1 R0이 되도록 한다. 전체 프로필/Feed scan, 새 고정 cron, polling 추가 금지.
'''
if '## 0J. PREVIEW 110 — Explore 전체 서버 누수 read-only 감사' not in current:
    if marker not in current:
        raise SystemExit('CURRENT_RELEASE_STATE marker missing')
    current = current.replace(marker, marker + section, 1)
current_path.write_text(current, encoding='utf-8')

Path('DOCS/NEXT_CODEX_TASK.md').write_text('''# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST

## 현재 기준

- branch: `preview`
- PREVIEW app: **110**, `https://preview.soridraw.com`
- 110 product commit: `4723fe9450869dd80b0e684309681535a8512dcd`
- PREVIEW Explore Worker: `d8eae38a-09a9-4f37-9500-57f217ee1d8c`
- 110 좋아요곡 stale 0 문제: 사용자 실사용 PASS
- TEST/PRODUCTION: 비변경

## Explore 110 전체 누수 감사 결과

PASS:
- 추천/최신 정상 앱 첫 페이지: shared latest source + R2 snapshot, D1 R0/W0.
- 인기 정상 앱 첫 페이지: R2 snapshot, D1 R0/W0.
- Feed revision latest/popular: R2 HEAD only, D1 R0/W0, 클라이언트 1분 cache, 고정 polling 없음.
- 정상 공개프로필: 앱 warm은 persistent local cache로 서버 요청 0. 새 edge 직접 cold는 bounded D1R2, 같은 edge 반복 R0.
- 좋아요: 1분 event-driven, idle fixed cron 0.
- TypeScript/Build + 110/109/108/107/105/103/102 검증 PASS.

FAIL / 다음 작업:
- 존재하지 않는 `/v1/profiles/{ref}/first-view`를 반복 직접 요청하면 404마다 D1 read 1이 반복된다.
- 감사 Run `35097777687`: INVALID_1/2/3 모두 HTTP404 + D1R1/W0.
- 이는 정상 UI 재진입 누수는 아니지만 외부에서 invalid profile ref를 반복 호출하면 D1 비용을 요청 수만큼 만들 수 있는 abuse gap이다.

## 다음 작업 — invalid public-profile negative-cache 방어

목표:
1. 존재하지 않는 동일 profile ref 첫 판정 뒤 반복 요청은 D1 R0/W0.
2. 가능한 경우 서로 다른 무작위 invalid ref 난사도 edge에서 과도한 D1을 만들지 않도록 bounded rate/negative-cache 방어 검토.
3. 정상 valid profile cold/warm, UID/handle alias, profile revision, 공개곡 50페이지, 좋아요/팔로우 정합성은 깨지지 않아야 한다.
4. UI/CSS/클라이언트 데이터 schema 변경 금지.
5. D1 schema/migration/backfill 금지. 사용자 데이터 변경 금지.
6. 새 fixed cron/polling 금지.
7. 수정 후 PREVIEW에서 valid profile, invalid profile 반복, Feed latest/popular/revision D1 R0 계약을 재감사한다.

이 FAIL을 해결하기 전 TEST 승격 금지. `테스트배포` 명시 승인 전 main 변경 금지. PRODUCTION은 별도 명확 승인 전 금지.
''', encoding='utf-8')

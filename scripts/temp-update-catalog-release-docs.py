from pathlib import Path

state = Path('DOCS/CURRENT_RELEASE_STATE.md')
text = state.read_text()
text = text.replace('- 실제 PREVIEW Worker: **054** / `40d84c03-2aa9-4aaa-8539-676b48c96d6d`', '- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`')
text = text.replace('- 054 검증 Run: `34924497426` — **PASS**\n- 054 PREVIEW 배포 Run: `34929734785` — **PASS**\n- 054 validated candidate commit: `a9d2a0d0bfa616f85086419dc3ca081c945e1842`', '- 055 PREVIEW 배포 Run: `34937881843` — **PASS**\n- 055 제품 commit: `2a4d7ec35e82448b60d1c5edffa106082017c210`\n- Catalog full-scan 차단 기준 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`\n- Catalog 수정 검증 Run: `34946586905` — **PASS**')
marker = '## 2. 091 좋아요 표시 구조\n'
block = '''## 2. 2026-09-15 Catalog Firestore 전체조회 차단 — 코드 반영 완료 / 배포 전\n- 문제: 새 기기/오래된 로컬 Catalog에서 profile revision이 R2보다 앞서면 `X-Soridraw-Require-Revision`이 Worker의 `buildCanonicalCatalog()`를 호출해 Music Note `favorites` 전체 + Library `suno_tracks/{uid}/tracks` 전체를 Firestore REST로 다시 읽을 수 있었음.\n- 조치: 일반 Catalog GET은 **R2 only**. profile revision은 invalidation hint로만 사용하며 일반 앱 경로에서 hard revision rebuild를 요구하지 않음.\n- Worker `getCatalogState()`는 R2 journal/base만 읽고, R2 Catalog가 없으면 `CATALOG_NOT_MATERIALIZED`로 fail-closed. 일반 GET/delta 경로에서 Firestore collection traversal 금지.\n- 새 기기 + 기존 R2: Catalog 1회 수신 후 IndexedDB/local cache 사용. Firestore 전체 collection read 0 목표.\n- R2 자체가 없는 예외 계정: 자동 전체 스캔 금지. 기존 bounded `user_list_caches` 1문서 fallback만 허용하고 별도 bootstrap/repair로 분리.\n- 변경 발행: partial UI list의 누락은 삭제로 간주하지 않고 explicit tombstone만 삭제. delta conflict/count mismatch도 R2 soft refresh만 수행하며 full rebuild 금지.\n- 검증: Run `34946586905`에서 TypeScript / Build / Worker syntax / `verify-046-catalog-stale-revision-rebuild.mjs` / diff check **PASS**.\n- 변경 파일: `src/lib/userDataEngine.ts`, `cloudflare/media-worker/src/index.js`, `scripts/verify-046-catalog-stale-revision-rebuild.mjs`.\n- 사용자 데이터/Firestore schema/Functions/Firebase/Cloudflare live 변경 없음. **아직 PREVIEW Hosting/Media Worker 미배포**.\n- TEST `main`과 PRODUCTION에는 기존 Catalog 구조가 남아 있으므로 PREVIEW 실사용 비용 검증 전 승격 금지. 안정화 후 exact PREVIEW tree를 TEST로 승격해 TEST에서도 동일 비용 구조를 맞춘다. PRODUCTION은 명확한 정식배포 승인 전 금지.\n\n'''
if block.splitlines()[0] not in text:
    text = text.replace(marker, block + '## 3. 091 좋아요 표시 구조\n', 1)
    # Shift existing top-level numbered sections 3..10 by +1 after inserted section.
    for n in range(10, 2, -1):
        text = text.replace(f'## {n}. ', f'## {n+1}. ')
state.write_text(text)

next_task = Path('DOCS/NEXT_CODEX_TASK.md')
nt = next_task.read_text()
header = '# NEXT CODEX TASK\n\n'
new = '''상태: **PREVIEW Catalog 전체 Firestore 재구성 차단 코드 반영 / CI PASS / 실환경 배포·비용 측정 전 / TEST 승격 금지**\n\n## 2026-09-15 최우선 다음 작업\n- 기준 branch: `preview`\n- Catalog 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`\n- 검증 Run: `34946586905` — TypeScript / Build / Worker syntax / no-fullscan verifier PASS\n- 일반 Music Note/Library Catalog GET 및 delta 충돌 복구에서 Firestore 전체 collection rebuild를 호출하지 않는다.\n- 새 기기는 이미 존재하는 R2 Catalog를 1회 받고 로컬 캐시를 만든다. R2가 없으면 fail-closed + bounded legacy bundle fallback이며 자동 full scan 금지.\n- 다음은 사용자 요청 시 PREVIEW에 필요한 앱/Media Worker만 배포하고, 새 기기/캐시 삭제 상태에서 Firestore read가 곡 수에 비례하지 않는지 실측한다.\n- 실측 합격 전 `main` TEST 승격 금지. TEST/PRODUCTION의 기존 읽기 구조는 PREVIEW 안정화 후 동일 exact tree 승격으로 맞춘다.\n- PRODUCTION은 명확한 정식배포 승인 전 금지.\n\n'''
if 'Catalog 전체 Firestore 재구성 차단 코드 반영' not in nt:
    nt = nt.replace(header, header + new, 1)
next_task.write_text(nt)

# PR #743 — 공유 Media Worker 색상 호환 승격·롤백 계약 (배포 금지)

## 판단 (2026-11-04 KST)
- 정확 후보: `920b15bd0280c81ee1ca764ab08eeaca7f20c0e1` 기준의 Draft PR #743. 이 문서와 검사는 **코드 준비**이며 실제 Worker 적용이나 사용자 색상 복구가 아니다.
- PREVIEW, TEST, PRODUCTION은 모두 `soridraw-user-catalog`의 같은 R2 버킷에 delta를 기록한다. TEST 앱 사용을 중단했더라도 활성 TEST Worker가 남아 있고 호출 가능하면 Writer 호환 검증에서 제외할 수 없다.
- 2026-11-03 21:21 KST Cloudflare 공식 API capture [41635057757](https://github.com/andrawing1212/soridraw-music/actions/runs/41635057757): preview `83175bcc-fe25-4d17-86c0-1592e47d358e` (source SHA256 `e52948ff2b49ddcf1343b499147fd0d0b5d3242a02b895b539d83aa4a99b49ea`), test `f0a86688-5ffc-42ed-aecd-c01f8c17c636`, production `2c2e3236-d9a6-4771-b2ba-7baff496145c` (두 환경 source SHA256 `c7591d0329521e321c28b5155673b1c606318367cca72849e44343816220e5aa`). 당시 3개 모두 shared flag `1`, CATALOG 버킷 일치. 재배포 직전 최신 버전/바인딩 재확인이 필요하다.
- 다운로드한 활성 모듈의 `projectCatalogFields`·`applyCatalogDelta`를 합성 데이터로 실행하는 **읽기 전용 검사**에서 현재 세 환경 모두 구형 클라이언트 색상 유지에 실패. TEST·PRODUCTION은 Music Note 색상 projection 단계에서도 실패. 이미 배포된 구형 Worker를 롤백 대상으로 삼으면 색상 누락을 재발시킨다.

## 코드 검증 도구
- `node scripts/verify-743-media-color-rollout-readiness.mjs --self-test` : 세 후보·세 롤백 번들 증거, 혼합 Writer, 운영 버전 드리프트, 안전한 Writer 중단 증거, 승인 누락을 HOLD로 판정하는 순수 테스트.
- 과거 read-only capture를 다운로드·압축해제한 로컬 경로에서 `node scripts/verify-743-media-color-rollout-readiness.mjs --capture <디렉터리>` : `summary.json` + `preview.js`/`test.js`/`production.js` SHA256·바인딩 정체성 일치를 확인하고, *실제 번들 함수*를 네트워크 없는 VM에서 실행한다. 누락된 capture는 fail-closed. 출력의 `HOLD`는 정상적인 위험 탐지 결과. 민감한 사용자 원본은 열지 않는다.
- 기존 `verify-library-catalog-color-projection.mjs`는 후보 Worker의 Music Note/Library 투영·기존 R2 base+journal·구형 브라우저·명시적 gray/null·삭제·CAS 재시도·추가 I/O 0 경로를 검증하며 위 순수 rollout self-test를 호출한다.
- **이 gate의 성공은 배포 승인이 아니다.** 이 모듈은 Worker API/Cloudflare 계정에 접근하거나 배포를 실행하지 않는다.

## 실제 배포를 고려하기 전 필요한 증거와 안전선
1. **운영 현재 상태 고정:** Cloudflare 공식 계정에서 세 Worker의 100% 활성 버전·원본 bundle SHA256·MEDIA/CATALOG binding·shared flag를 배포 직전 한 번 재확인한다. 부분 트래픽, 혼합 버전, drift면 HOLD. 해당 환경의 다른 색상 Writer/클라이언트 경로도 확인한다.
2. **3개 환경 동일 보호 코드:** 미리 정확한 후보 SHA와 세 환경별 설정을 고정하고 빌드 번들 정체성·권한·서비스별 MEDIA 버킷·서명키 보존·실제 코드 경로를 검증한다. CI의 소스 PASS만으로 활성 Worker 호환 PASS라 판정하지 않는다.
3. **혼합 Writer 구간 보호:** 활성 구형 Worker를 하나씩 교체하는 동안 공유 CATALOG 변경이 발생하면 색상 필드가 잘릴 수 있다. 따라서 무손실·재시도 가능한 **검증된 Catalog 쓰기 정지/배리어**와 pending 영속화/복구가 먼저 필요하다. 이것은 현재 구현/승인되지 않았으며 새 사용자 기능 변경·서비스 중단 없이 안전하게 가능한지도 미확정. 단지 임시로 클라이언트 버튼을 막거나 서버 데이터를 복구/초기화해서 해결하지 않는다. 증거 없으면 전환 시작 자체가 NO-GO.
4. **검증된 호환 롤백:** 구형 활성 Worker 버전으로 자동/수동 rollback 금지. 색상 보호가 포함된 **별도 exact rollback bundle/version**을 세 환경별로 미리 준비하고 실행형 검증해야 한다. 같은 R2 원본이 보존되는 것을 확인한 후에만 전환을 고려한다. old-worker rollback은 R2 복원이 아니며 이미 잘린 필드를 복구하지 못한다.
5. **승격 검증:** 변경분 1건, null(회색), 오래된 클라이언트 누락, 같은 ID의 두 기기 경쟁, 삭제→재추가, 미디어·Library·Music Note 저장, 신구 롤백 경로를 합성 데이터와 제한된 인증 테스트로 검증. 기존 사용자 데이터 전체 스캔·819건 반복 읽기·R2 rebuild·대량 backfill·캐시 강제 초기화 금지. 실제 PC↔모바일은 미검증.
6. **배포 승인:** 공유 Worker는 Hosting 자동 배포 범위가 아니며, 현재 디렉터는 Worker 배포·TEST/PRODUCTION 변경·PR 병합을 금지했다. 이 조건이 모두 충족돼도 별도 명시 승인이 필요하다.

## 현재 결론
**SOURCE READY FOR FURTHER REVIEW / LIVE ROLLOUT NO-GO.** 3개 구형 Writer·안전한 rollback artifact 미확보·쓰기 배리어 미구현·실사용 미확인. 제품 원본 보호 때문에 이번 PR에서 Worker 배포 workflow를 활성화/변경하지 않으며 PR은 Draft·미병합 유지한다.

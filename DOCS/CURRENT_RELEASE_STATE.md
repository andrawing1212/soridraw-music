# SORIDRAW CURRENT RELEASE STATE

## 0P. Release Controller post-merge workflow validation 복구 PR 준비

- PR #75는 `preview` merge commit `c4faf8f417b0b142b3e67c87697db7c7e6e4f9aa`에 포함됐지만, merge push의 Actions run `35257875949`는 workflow validation 단계에서 job 생성 전 실패했다.
- 원인은 job-level `env`에서 runner가 배정된 뒤에만 사용할 수 있는 `${{ runner.temp }}` context를 평가한 것이다. `RELEASE_STATUS_FILE`을 첫 controller step에서 `$RUNNER_TEMP`로 설정하고 이후 step용 `$GITHUB_ENV`에 전달하도록 최소 수정한다.
- Release Controller의 승인, source lock, read-only preflight, TEST/PRODUCTION 격리, manifest identity, component mutation/rollback 불변조건과 제품 코드는 변경하지 않는다.
- 이번 복구 작업에서는 TEST/PRODUCTION 배포, Worker traffic/Hosting 변경, D1 write/migration/seed/backfill/delete, Functions/Rules 배포를 수행하지 않는다.

## 0O. Release Controller final static-audit blockers — 수정 완료/미배포

- 실행 중인 controller checkout인 `GITHUB_WORKSPACE`를 기준으로 controller identity를 생성·비교하며, 과거 release source worktree의 파일로 drift 검사를 우회할 수 없게 했다.
- Issue #76 명령은 재사용 가능한 parser가 댓글 본문 전체를 정확히 한 줄 명령으로 검증한다. multiline, 인용, 설명이 붙은 댓글은 dispatch하지 않는다.
- live branch/Worker/Hosting 변경 전에 Firebase Hosting create/release/delete 권한을 `testIamPermissions`로 안전하게 증명하며, `preflight_only` 종료 시 정규화한 TEST/PRODUCTION Worker schedules까지 시작 snapshot과 비교한다.
- static verifier는 단계별 실행 블록과 순서를 검사하고, authorization/명령 parsing/controller identity/권한 선검사/schedule 불변/rollback 결함을 주입한 mutation simulation이 반드시 실패하는지 확인한다.
- PREVIEW/TEST/PRODUCTION workflow 실행, Worker upload/traffic 변경, Hosting 변경, branch 승격, D1 또는 사용자 데이터 write는 수행하지 않았다.

## 0N. Release Controller PR #75 blocking correctness fixes — 구현 완료/정적 검증 대기

- schema-2 manifest의 `controllerIdentity` 객체를 scalar로 거부하던 검사를 제거하고 세 개의 SHA-256 필드를 각각 검증하도록 수정했다.
- TEST Hosting release/version 비교는 `printf`로 실제 TSV 값을 만들며, PRODUCTION Hosting clone은 mutable `soridraw-test:live`가 아니라 manifest에 고정된 exact TEST Hosting version ID를 source로 사용한다.
- 제품/UI/Functions/Rules/D1/user data는 변경하지 않았고 PREVIEW/TEST/PRODUCTION 배포나 live preflight를 실행하지 않았다.

## 0M. Release Controller Issue #76 live pipeline status — 구현 완료/PR 검증 대기

- PR #75 안전 보강 commit `d81d8fc8aa4437990433a7d612473c18d3f769f9`이 GitHub remote branch에 실제 존재하고 필수 정적 검증이 PASS한 뒤 2단계 작업을 시작했다.
- 고정 Controller가 Issue #76의 `/soridraw preflight <preview_sha>`, `/soridraw test <preview_sha>`, `/soridraw production <manifest_tag> DEPLOY_PRODUCTION` 명령을 받을 수 있게 했다.
- Issue #76만 허용하며 PR 댓글은 거부한다. repository owner 또는 repository variable `SORIDRAW_RELEASE_ACTORS`의 명시적 allowlist actor만 명령할 수 있다.
- 실행마다 Issue #76에 상태 댓글 하나를 만들고 같은 댓글을 `REQUESTED`, `SOURCE_LOCKED`, `STATIC_CHECKS`, `PREFLIGHT`, 배포/검증 상태, 최종 `TEST_VERIFIED`/`RELEASED` 또는 `BLOCKED`/`ROLLED_BACK`/`FAILED`로 갱신한다.
- 정상 릴리스 경로는 GitHub Actions와 기존 Controller만 사용하며 Codex 호출은 없다. 제품 app 116/UI/Explore, D1, Functions/Rules는 변경하지 않았다.
- 이번 구현 중 TEST/PRODUCTION 배포, Worker traffic 변경, Hosting 변경, branch 승격, 사용자 데이터 write/migration/seed/backfill/delete는 실행하지 않았다.
- GitHub의 `issue_comment` trigger는 default branch의 workflow 정의만 사용하므로 실제 Issue comment end-to-end는 이 고정 Controller가 default branch에 안전하게 승격된 뒤 read-only `preflight_only` 명령으로 별도 확인해야 한다.

## 0L. Release Controller 12개 안전 보강 — PR 검증 대기

- PR #75의 1차 Release Controller를 기준으로 release-bot commit identity, read-only Firebase/GitHub capability preflight, 시작/종료 branch·Worker·exact Hosting release/version 불변 검사를 추가했다.
- TEST manifest를 schema 2로 올려 exact TEST Hosting release/version, Worker version/bundle, workflow/runtime/verifier controller identity를 고정하고 PRODUCTION에서 live TEST 및 controller drift를 차단한다.
- Worker candidate는 branch/traffic/Hosting 변경 전에 upload 및 결정적 outdir identity 검사를 마친다. outdir hash는 모든 파일의 상대경로, byte length, contents를 포함한다.
- Worker rollback은 parity smoke와 분리된 `restore` action으로 이전 version 100%와 schedules를 복구하고 active identity를 확인한다. component별 mutation flag가 실제 변경된 부분만 rollback한다.
- TEST tag/Release collision과 GitHub Release capability를 live mutation 전에 검사한다. TEST verify 및 PRODUCTION preflight/verify에 두 Firebase Function의 read-only OPTIONS/CORS 검사를 복구했다.
- 제품 app 116/UI/Explore, Functions/Rules, D1 schema/data는 변경하지 않았다. TEST/PRODUCTION 배포는 실행하지 않았다. Issue #76 live pipeline status 연결은 위 0M 후속 commit에서 구현했다.


최종 갱신: 2026-09-17 KST — Release Controller 구현 완료(로컬 검증, 미배포)

## 0. Release Controller 구현 상태

- 구현 기준 commit: `0355a66c79c409a85042807d53baec1461a60838`
- 단일 수동 Controller 모드는 `preflight_only`, `test`, 독립 `production`이다.
- `preflight_only`는 build/static/live read-only preflight와 시작/종료 ref 및 live Worker/Hosting identity 확인만 수행하며 branch/Worker traffic/Hosting/사용자 데이터에 변경을 만들지 않는다.
- `test` 성공 시 GitHub Release asset `soridraw-release-manifest.json`을 `TEST_VERIFIED` 상태로 고정한다. manifest에는 source/main tree, index hash, TEST Hosting, Worker bundle/version, canonical resource, parity 결과가 포함된다.
- 독립 `production`은 manifest tag만 입력받고 PREVIEW app을 다시 build하거나 TEST를 재배포하지 않는다. TEST 실제 identity를 다시 확인한 뒤 TEST Hosting live release를 Firebase `hosting:clone`하고, 동일 Worker bundle hash의 PRODUCTION version을 traffic 전환 전에 upload/검증한다.
- canonical shared D1/R2, bounded public parity, D1 zero-read/write 진단, forward branch rollback 및 Worker/Hosting rollback 보호를 유지한다.
- 제품 React/UI/Explore, Functions/Rules, D1 schema 및 사용자 원본 데이터는 변경하지 않았다.
- 로컬 TypeScript, Build, static release verifier, Controller state-machine verifier, workflow YAML 검사는 PASS했다.
- Cloudflare credential이 이 작업 컨테이너에 없고 GitHub remote/auth가 제공되지 않아 live Worker dry-run, Actions `preflight_only`, push/PR은 아직 미실행이다. 실제 TEST/PRODUCTION 배포도 실행하지 않았다.

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태를 우선한다.

## 1. 현재 기준

- 개발 branch: `preview`
- PREVIEW 제품 앱: **116**
- PREVIEW 앱 116 배포 기준 commit: `5df12009e46ab65ab7c3f95cb686926907c4c0d8`
- PREVIEW 앱 배포 Run: `35206162725` SUCCESS
- PREVIEW Explore Worker 배포 Run: `35206061412` SUCCESS
- PREVIEW Explore Worker version: `7002605d-8129-42f7-bf8e-9243de0c7c8c`
- 3단계 승격 불변조건 감사 기준 commit: `ea9d20e8dfbba189e678ce1ae9433e5471f85ad5`
- Release System Audit Run: `35211720327` SUCCESS
- TEST `main`: `bb1305660ca694dd057f3ed4184bdafea60f5b18` — 기존 앱 110, 이번 작업에서 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 이번 작업에서 비변경

## 2. PREVIEW 116 실사용 결과

사용자가 `preview.soridraw.com`에서 앱 116을 직접 확인했고 이번 좋아요 숫자 불일치는 **정상으로 확인**했다.

116에서 보호하는 핵심:
- 추천 / 최신 / 인기 / 공개프로필의 동일 곡 공개 좋아요 숫자가 한 기기 안에서 서로 다른 오래된 캐시에 의해 다시 갈라지지 않게 한다.
- 서버/공유 기준으로 확인된 숫자만 authoritative 값으로 사용한다.
- 이미 열려 있는 Feed/Profile/Liked 로컬 캐시도 같은 trackId 기준으로 함께 맞춘다.
- 다른 환경에서 발생한 변경을 PREVIEW Worker가 뒤늦게 따라잡은 경우에도 실제 Feed가 바뀌었을 때만 shared Feed R2를 갱신한다.
- 변경이 없으면 shared R2 불필요 write를 하지 않고, 이 catch-up 경로에서 D1을 직접 추가 조회하지 않는다.

PREVIEW 116 배포 검증:
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting exact build PASS
- PREVIEW Worker smoke PASS
- warm `/v1/feed-revision` D1 R0/W0 PASS
- TEST/PRODUCTION 비의도 변경 없음 PASS
- Firebase Functions 변경 없음
- Firestore/RTDB Rules 변경 없음
- D1 schema migration/seed/backfill 없음
- 사용자 원본 데이터 복사/삭제/덮어쓰기 없음

## 3. 3단계 배포의 새 절대 불변조건

사용자 지시로 2026-09-17부터 **배포 시간 단축보다 `오류 없이 그대로 이동`을 상위 조건**으로 고정한다.

승격 성공의 의미:

`PREVIEW에서 검증된 정확한 tree + 같은 공유 사용자 원본 + 같은 실제 공개 결과`
→ TEST
→ `TEST에서 검증된 정확한 tree + 같은 공유 사용자 원본 + 같은 실제 공개 결과`
→ 사용자의 명확한 승인 후 PRODUCTION

단순히 GitHub commit / Build / Hosting이 성공했다고 승격 성공으로 처리하지 않는다.

### TEST 승격 시 자동 불변검사

TEST Worker 배포 직후 자동으로 PREVIEW와 다음을 비교한다.
- latest revision
- popular revision
- latest shared first-page snapshot
- popular shared first-page snapshot
- latest 직접 Feed projection
- popular 직접 Feed projection
- Feed에서 잡은 실제 owner의 공개프로필 projection

조건:
- revision은 shared authority에서 와야 한다. 환경별 local R2 fallback 상태를 정상 승격으로 인정하지 않는다.
- shared snapshot revision이 PREVIEW와 TEST에서 같아야 한다.
- 곡 id / owner / 제목 / likeCount / pinned 등 공개 projection이 같아야 한다.
- 공개프로필의 uid / handle / 공개곡 수 / 팔로워·팔로잉 수 / 곡 projection이 같아야 한다.
- revision/shared snapshot/public-profile 검증 경로에서 D1 read/write 0 계약을 확인한다.

환경별 Edge/R2 캐시가 이전 상태를 잠시 들고 있으면 5초 간격으로 자동 재확인한다. 최대 대기 창은 약 **60초**다. 이 안에 이전 단계와 동일 결과로 수렴하지 못하면 승격을 성공 처리하지 않는다.

### PRODUCTION 승격 시 자동 불변검사

PRODUCTION은 PREVIEW를 임의로 다시 해석하지 않는다.

**PRODUCTION Worker는 방금 검증된 TEST를 기준으로 같은 검사를 통과해야 한다.**

즉:
- TEST = PREVIEW 검증본
- PRODUCTION = 검증된 TEST와 동일

중간 환경의 오래된 캐시나 잘못된 연결이 결과를 바꾸면 배포 성공이 아니다.

## 4. 공유 사용자 원본 연결 자체도 배포 전 강제검사

새 Release Runtime은 단순히 `DB`, `PROFILE_MEDIA`라는 이름의 binding이 존재하는지만 보지 않는다.

반드시 아래 실제 공유 원본이어야 한다.
- canonical D1: `soridraw-explore-db`
- shared PROFILE_MEDIA R2: `soridraw-profile-media`

Release System Audit `35211720327`에서 실제 live binding을 read-only로 확인했다.

TEST:
- `DB:soridraw-explore-db` PASS
- `RATE_DB:soridraw-explore-test-db` — 환경별 분리 유지
- `PROFILE_MEDIA:soridraw-profile-media` PASS
- `EXPLORE_CACHE:soridraw-profile-media-test` — 환경별 파생 캐시 분리 유지

PRODUCTION:
- `DB:soridraw-explore-db` PASS
- `PROFILE_MEDIA:soridraw-profile-media` PASS
- PRODUCTION의 현재 binding shape를 그대로 보존한 Worker dry-run PASS

따라서 사용자 원본은 공유하고, 환경별 파생 캐시/Rate DB만 분리한다는 운영 원칙과 일치한다.

## 5. 실패 시 처리 — 몇 시간 수동 복구 금지

승격 중 실제 결과 불일치가 발견되면 다음 환경으로 계속 밀어붙이지 않는다.

Worker 단계:
- 새 Worker 배포
- 최대 약 60초 자동 수렴/동일성 검사
- PASS면 계속
- FAIL이면 해당 Worker의 이전 active version으로 자동 rollback 시도
- 다음 Hosting/PRODUCTION 승격 중단

기존 Release Workflow의 보호도 유지한다.
- exact PREVIEW tree를 main의 새 forward commit으로 고정
- force-push 금지
- TEST exact index/app-version 검증
- PRODUCTION은 TEST PASS 전 실행 금지
- Hosting/branch 단계 실패 시 forward rollback
- 정상 릴리스에 D1 migration/seed/user-data copy를 끼워 넣지 않음

목표는 `실패를 몇 시간 고치는 배포`가 아니라 **짧은 자동검사 안에 동일성이 확인되거나, 아니면 즉시 실패·복구하는 배포**다.

## 6. Release System Audit 결과

Run `35211720327` — SUCCESS

PASS:
- TypeScript
- Build
- release promotion static guard
- 새 environment parity invariant static guard
- shared canonical binding static guard
- TEST Worker dry-run
- PRODUCTION Worker dry-run
- TEST live shared D1 SELECT-only preflight: tables=6 / explore032 triggers=18
- PRODUCTION live shared D1 SELECT-only preflight: tables=6 / explore032 triggers=18
- D1 write/migration/seed 없음
- audit 중 TEST/PRODUCTION 배포 없음
- audit 종료 시 branch 확인:
  - preview `ea9d20e8dfbba189e678ce1ae9433e5471f85ad5`
  - main `bb1305660ca694dd057f3ed4184bdafea60f5b18`
  - production `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 7. 비용/데이터 불변조건

계속 유지:
- 앱 버전 업데이트만으로 Firestore/D1 전체 읽기 금지
- 페이지 이동/재진입만으로 사용자 데이터 write 금지
- 정상 캐시 + 변경 없음이면 서버 data read 0 최우선 목표
- Explore/Public Profile 변경은 바뀐 항목만 처리
- 좋아요 1개 때문에 전체 Feed 재생성 금지
- 공개/비공개 1곡 때문에 전체 사용자/곡 scan 금지
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장 보호
- Library Local First 보호
- PREVIEW/TEST/PRODUCTION 사용자 원본 데이터 복제 금지

새 승격 동일성 검사는 릴리스 1회에 한정된 bounded first-page/profile probe이며 전체 Feed/전체 사용자 scan을 하지 않는다.

## 8. UI / 기존 정상 기능

이번 3단계 승격 불변조건 작업은 Release Runtime / verifier만 수정했다.
- UI/CSS 변경 없음
- Music Note 동작 변경 없음
- Library 동작 변경 없음
- Explore 제품 동작 변경 없음
- PREVIEW 앱/Worker 재배포 없음
- TEST/PRODUCTION 배포 없음

## 9. 현재 남은 검증

새 불변조건의 **정적검사 + 실제 live binding dry-run은 PASS**했다.

아직 실행하지 않은 것은 실제 TEST 승격이다. 따라서 TEST Worker를 실제 116으로 올린 뒤 새 parity gate가 실제 배포 직후 PREVIEW=TEST를 PASS시키는 end-to-end 결과는 **테스트배포 전**이다.

사용자가 `테스트배포`를 명확히 요청하면:
1. 그 시점의 검증된 PREVIEW exact SHA를 고정
2. 기존 고정 Release Promotion Workflow 1회 실행
3. TEST Worker가 PREVIEW와 revision/Feed/public-profile parity를 자동 확인
4. PASS한 경우에만 Firebase TEST Hosting 배포/검증
5. TEST 실제 주소 확인
6. PRODUCTION은 변경하지 않음

이 단계가 실패하면 PRODUCTION 승격은 자동 차단되고 TEST를 성공으로 보고하지 않는다.

## 10. 알려진 위험

- GitHub API상 `preview/main`은 protected 표시는 있으나 protection 상세가 `enabled=false`로 보인다. force-push/삭제 방지 정책이 실제 GitHub 규칙에서 충분히 강제되는지는 별도 저장소 유지보수 감사 항목으로 남긴다.
- 실제 TEST 배포 후 parity gate end-to-end 실행은 아직 안 했으므로 그 결과 전에는 `3단계 실배포 최종 검증 완료`라고 표현하지 않는다.
- 기존 Build의 chunk-size/mixed-import 경고는 기존 경고이며 이번 승격 불변조건 변경과 무관하다.

## 11. 다음 안전 작업

현재 다음 작업은 **추가 기능 수정이 아니라 실제 TEST 승격으로 새 불변조건을 1회 실전 검증하는 것**이다.

단, TEST 배포는 사용자의 명확한 요청 전에는 실행하지 않는다.

TEST가 새 gate를 통과하고 사용자가 실사용까지 확인한 뒤에만 PRODUCTION 승격을 검토한다. PRODUCTION은 사용자의 별도 명확한 정식배포 승인 전 절대 변경하지 않는다.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST — PREVIEW 111 공개프로필 invalid-ref 서버 누수 방어 배포/실측 완료

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.


## 0K. PREVIEW 111 — 공개프로필 invalid-ref 서버 누수 방어 배포/실측 완료

- 사용자 요청으로 PREVIEW 110 Explore 전체 누수 감사에서 발견된 **존재하지 않는 공개프로필 ref 반복 404 → 매 요청 D1R1** abuse gap만 최소 수정했다. 앱 UI/Hosting은 변경하지 않았고 PREVIEW 앱은 **110** 유지.
- **111 Worker 제품 candidate:** `c81ff2cf5e6aea820b6da45779b7d207f839257c`. 핵심 patch는 `057-public-profile-negative-cache-guard.mjs` + `058-public-profile-negative-cache-shape-compat.mjs`.
- **PREVIEW Worker Release Run:** `35108113433` SUCCESS. 실제 PREVIEW Explore Worker version은 **`c638d60f-8724-4d4a-bb05-0766d50a8dae`**. 이전 `d8eae38a-09a9-4f37-9500-57f217ee1d8c`에서 승격. TEST/PRODUCTION Worker는 비변경 PASS.
- 동작: 존재하지 않는 동일 profile ref의 404를 Cloudflare `caches.default`에 **60초 negative cache**로 보관한다. 정상 valid profile의 기존 positive edge cache는 cold-ref 방어 예산보다 먼저 사용한다. 서로 다른 cold invalid ref 난사는 기존 Cloudflare limiter를 독립 key prefix `profile-cold:`로 재사용해 현재 계약상 **client key당 분당 60회**로 bounded 한다.
- live legacy 404 body `{ok:false,error:"Profile not found"}` 및 `NOT_FOUND` code/Korean equivalent를 negative-cache 대상으로 인식한다. D1 schema/data 변경 없음.
- **배포 후 실제 감사 Run `35108725305` SUCCESS:** 동일 Cloudflare `SEA` edge에서 같은 invalid ref 5회 연속: `R1/W0 MISS → R0/W0 HIT → R0/W0 HIT → R0/W0 HIT → R0/W0 HIT`. 따라서 일반적인 동일 사용자의 반복 새로고침은 첫 판정 뒤 TTL 동안 D1로 재진입하지 않는다.
- 같은 live 감사에서 **latest Feed warm R0/W0 / popular Feed warm R0/W0 / 정상 public-profile warm R0/W0 / latest revision warm R0/W0 / popular revision warm R0/W0** 모두 PASS. 사용자 데이터 write 0.
- **Cloudflare edge 특성:** Cache API negative entry는 POP/colo 지역 캐시다. 다른 edge가 같은 invalid ref를 처음 받으면 그 edge에서 최초 D1R1이 생길 수 있다. 이를 전세계 단일 negative store처럼 해석하지 않는다. 무작위 unique ref는 limiter로 별도 bounded 한다.
- 1분 event-driven like aggregate 유지, fixed cron 0. Firebase Functions/Firestore Rules/RTDB Rules 변경 없음. D1 migration/backfill 없음. 사용자 원본 데이터 변경 없음. UI/CSS 변경 없음.
- 표준 PREVIEW Worker release gate에서 이미 삭제된 과거 display-overlay 구조를 요구하던 stale verifier 호출을 현재 111 계약에 맞게 정리했다. 제품 기능 수정이 아니라 릴리스 검사기 유지보수다.
- 111 작업용 임시 prepare/audit/tooling/postdeploy workflow는 최종 실측 후 모두 삭제했다. formal Work 독립 감사는 미실행; 자동 계약검사 + 실제 PREVIEW 배포 smoke + live cost audit PASS.
- **판정:** 이번에 감사한 Explore 추천/최신/인기/revision/정상 공개프로필 warm + 동일 invalid-ref 반복 누수 경로는 PASS. TEST 승격은 사용자의 명시적 `테스트배포` 승인 전 금지.


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


## 0I. PREVIEW 110 — 개인 좋아요곡 공개 숫자 로컬 정합성 복구 + 109 실사용 PASS

- **109 사용자 실사용 확인:** PC Master/Admin 공개 숫자 `1` 보존 PASS, 모바일 Master/Admin도 `1` 복구 PASS. 반복 hard refresh의 Firestore `users:onSnapshot` 증가 현상도 사용자 확인상 해소. 두 번째 관리자 계정의 `users:getDocs 12`는 관리자 목록 cold cache 최초 1회에서 문서 12개를 받은 값이며 요청 12회가 아님; 목록은 최대 20개 페이지 단위 + 관리자 UID/정렬별 persistent cache 구조.
- **남은 FAIL:** 자기 공개프로필의 `좋아요 곡` 탭에서는 heart membership은 빨간색으로 맞지만 카드 공개 `likeCount`가 과거 liked-card persistent cache의 `0`으로 표시됨. Explore 메인 공용 Feed는 같은 곡 `1`이므로 서버 canonical 문제가 아님.
- **110 제품 commit:** `4723fe9450869dd80b0e684309681535a8512dcd`. PREVIEW Release Run `35095168722`. 실제 `https://preview.soridraw.com` 앱 버전 **110**, exact index PASS, TEST/PRODUCTION app-version 비변경 PASS.
- **110 수정:** shared Feed/Profile payload에서 이미 확인된 public `likeCount`를 개인 liked-card 장기 cache와 현재 열려 있는 `좋아요 곡` state에 로컬로 동기화한다. warm persistent Feed cache도 즉시 source로 사용하므로 기존 stale `0` 카드는 서버 재조회 없이 `1`로 복구할 수 있다.
- liked-track cache schema는 `1` 그대로 유지한다. 앱 업데이트 때문에 좋아요곡 cache를 폐기하거나 전체 liked tracks를 서버에서 재수집하지 않는다. 새 polling/fetch 없음. public 숫자는 shared payload가 authority이고 membership/outbox는 기존 계정별 구조를 유지한다.
- TypeScript PASS / Build PASS / 110 verifier PASS / 109·108·107·105·103·102 관련 verifier PASS.
- PREVIEW Explore Worker는 **재배포하지 않음**. 기존 `d8eae38a-09a9-4f37-9500-57f217ee1d8c` 유지. 1분 event-driven aggregate 및 fixed cron 0 유지.
- Firebase Functions/Rules/RTDB Rules 변경 없음. D1 schema/migration/backfill 없음. 사용자 원본 데이터 변경 없음. UI/CSS 변경 없음.
- 비용: 110 liked-card 복구 자체는 이미 기기에 있는 shared Feed/Profile payload → local cache patch이며 Firestore/D1 추가 read/write **0 계약**.
- TEST/PRODUCTION 승격 없음. formal Work 독립 감사는 미실행.
- **실사용 검증 필요:** 모바일/PC 자기 `좋아요 곡` 탭의 기존 0이 1로 복구되는지, 재진입/새로고침에도 유지되는지, like/unlike 후 약 1분 뒤 Feed/Profile/좋아요곡 숫자가 동일하게 수렴하는지 확인 전 TEST 승격 금지.

## 0G. PREVIEW 108 — 오래된 Explore Feed 캐시 1회 복구 + D1 0 R2 snapshot 배포 완료

- **현재 제품 기준 commit:** `933388f5775782fc29b2586e745b3238820bb8c6`. 108 기능 차이는 `d2901829bab8ee8ad85791ac96bac457c2c2bc9c` 대비 의도한 8개 파일만 남긴 clean candidate로 확정했다.
- 108 최종 clean 검증 Run `35072117799` — **SUCCESS**. 108/107/105/103/102, TypeScript, Build, dist baseline 복구, exact change boundary 모두 PASS.
- PREVIEW Explore Worker Release Run `35072908682` — **SUCCESS**. 실제 Worker version `d8eae38a-09a9-4f37-9500-57f217ee1d8c`. 이전 PREVIEW Worker는 `961084b2-28e0-4d04-8577-56d8944f4916`.
- Worker 실측 smoke: Feed PASS / Public Profile PASS / `__soridraw_r2_only=108` HTTP 200 / **R2 snapshot D1 read 0, write 0** / warm `/v1/feed-revision` D1 read 0, write 0 / 고정 like cron 0 / TEST·PRODUCTION Worker 비변경 PASS.
- PREVIEW App Release Run `35073054850` — **SUCCESS**. release source `3f47d76f5267e0048e786de8b4004b368b80d736`, 실제 `https://preview.soridraw.com` 앱 버전 **108**, exact build hash PASS. TEST/PRODUCTION branch 및 실제 Hosting 비변경 PASS.
- **108 동작:** 기존 schema-1 Explore Feed 로컬 캐시는 108에서 한 번만 호환 불가로 버리고, 새 schema-2 캐시는 앱 버전과 독립적으로 장기 유지한다. 앱 업데이트 자체로 이후 캐시를 반복 폐기하지 않는다.
- schema-1을 처음 교체할 때 일반 Feed D1 경로를 타지 않고, 이미 만들어진 PREVIEW R2 first-page snapshot을 직접 사용한다. 이 cold recovery route는 D1을 열지 않는 계약이며 실제 PREVIEW smoke에서도 R0/W0 확인.
- 공개 좋아요 숫자는 107 원칙 그대로 Feed/Profile 공용 payload를 직접 표시한다. 개인 heart membership, local outbox, same-account RTDB membership sync, 105의 1분 event-driven aggregate는 유지. 고정 polling/cron 추가 없음.
- UI/CSS 변경 없음. Firebase Functions/Rules/RTDB Rules 변경 없음. D1 schema/migration/backfill 없음. 사용자 원본 데이터 복사/삭제/덮어쓰기 없음.
- PREVIEW Hosting만 108로 배포. TEST `main` / PRODUCTION은 승격하지 않음.
- **실사용 검증 전:** PC/모바일에서 업데이트 직후 기존 0 stale 숫자가 서버/R2의 1로 교체되는지, 이후 warm 재진입이 다시 오래된 숫자로 돌아가지 않는지, Master/Admin 교차계정 like/unlike가 약 1분~1분10초 뒤 같은 공개 숫자로 수렴하는지 사용자 확인 필요. 이 검증 전 TEST 승격 금지.
- 릴리스 도구 주의: 기존 표준 PREVIEW Worker release workflow의 과거 094/086 검사 일부는 107에서 제거된 display overlay 구조를 전제로 해 현재 코드에 stale 상태다. 이번 108은 현재 105/107/108 계약 + derived/publication/102/103 + live D1 read-only preflight를 통과한 일회성 release workflow로 배포했고, 해당 임시 workflow/trigger는 배포 직후 제거했다. 다음 Worker 릴리스 전에 표준 verifier 정리가 필요하다.
- 103에서 추가된 Durable Object migration `v1`은 계속 유지한다. pre-103 Worker 직접 rollback은 호환되지 않을 수 있으므로 향후 rollback도 migration을 유지한 forward-compatible build를 사용한다.
- formal Work 독립 감사: **미실행**. 자동 검증과 실제 PREVIEW Worker/Hosting smoke는 PASS.

## 0F. 107 공개 좋아요 1곡 실제 read-only 대조 — 서버 불일치 미재현

- 기준 preview commit: `a59d1f109bfba0180bf4cc7dbce945cd0acd349f`.
- 사용자 승인으로 Actions의 기존 Cloudflare 인증을 사용한 일회성 read-only 진단 실행. 제품 코드 수정/배포 전에 실제 값부터 확인했다.
- 성공 Run: [35065130889](https://github.com/andrawing1212/soridraw-music/actions/runs/35065130889), 진단 source `5df136ea8591474493b4f5ac4ee25c98b6f0e4c6`, 측정 2026-09-16 06:45:03~06:45:10 UTC.
- 대상: **[Nu Jazz] 한 걸음 비워둔 채로 / Leaving One Step Open**. 동일 trackId 결과:

| 단계 | trackId | likeCount |
|---|---|---:|
| likes membership COUNT (해당 track만) | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| track_stats.like_count | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| derived row_json.like_count (rank likes도 1) | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW R2 latest feed | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW R2 popular feed | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW R2 public profile | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW /v1/feed latest | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW /v1/feed popular | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |
| PREVIEW /v1/profiles/{ownerUid}/first-view | `music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q` | 1 |

- **이 시점/대상에서는 1→0 또는 stale 최초 구간이 존재하지 않았다. 서버 projection 오류로 단정하거나 수정할 근거 없음. UI에서 0이라는 현상 자체가 해결됐다는 뜻은 아니다.**
- 실제 PREVIEW Worker `961084b2-28e0-4d04-8577-56d8944f4916` 확인. PREVIEW의 현재 DB binding(공유 canonical)과 PREVIEW EXPLORE_CACHE만 사용; TEST/PRODUCTION Worker·R2·앱에 접근하지 않음.
- 실제 `explore032_stats_update`는 해당 track의 `track_stats.like_count`를 derived `row_json.like_count`에 반영하도록 존재함. SQL 정의를 SELECT로 읽었으며 실행하지 않음. camelCase `row_json.likeCount`는 원래 없는 필드다.
- Feed R2/API는 `stats.likeCount=1`이며 top-level likeCount는 없음. Profile R2/API는 두 값 모두 1. 현재 `ExplorePage.readNestedCount`는 top-level이 없으면 `stats.likeCount`를 읽으므로 이 형태를 0의 원인으로 볼 수 없음.
- `patchExploreFeedR2LikeCount`의 deferred는 033에서 즉시 중복 R2 I/O를 없애기 위해 도입됨. legacy 단건 handleLike에서 호출되며, batch aggregate는 056 reconciliation 경로를 사용함. 이번에 수정/삭제하지 않음.
- 직접 D1 진단: 해당 track 조회 rows_read=5, trigger 메타데이터 조회 rows_read=302, 두 SELECT 모두 rows_written=0. 전체 tracks/likes scan 없음. PREVIEW R2 객체 GET 3회, PUT/DELETE 없음.
- 실제 API D1: latest R2/W0, popular R0/W0, profile R2/W0(여기서 R은 읽은 row 수). 세 응답 모두 R2 Class A=0/B=0. 브라우저 warm 재진입 전체 계약을 이 결과만으로 PASS 처리하지 않음.
- 인증 값 출력 없음. 첫 Run 35065011456은 ACCOUNT_ID Secret이 비어 서버 조회 전에 실패; 이후 기존 PREVIEW release에 고정된 동일 계정 식별자를 재사용. 토큰은 기존 Actions Secret만 사용. 인증/Secrets 설정 변경 없음.
- **제품 변경/배포 없음:** Worker, UI, Firebase, schema, membership/outbox/RTDB, 사용자 원본 데이터 모두 비변경. 원인 미확정 상태에서 임의 server/client 보정 없음.
- 진단 문법 검사 및 Actions read-only trace PASS. 제품 수정이 없어 TypeScript/Build/102·103·105·107 회귀 테스트는 이번 진단에서 실행하지 않음. Like/unlike 실데이터 쓰기 실험 없음.
- 다음 증거: 실제 0을 표시하는 앱107 화면의 해당 track, browser cached payload 및 수신 API 응답 대조. Master/Admin 실사용·집계 후 ±1·idle/warm 검증은 미완료.
- 진단용 임시 Workflow/script는 결과 기록 후 제거. TEST 승격 금지 유지.

## 0E. PREVIEW 107 — Explore 구조 정리 / 공개 숫자 직접 표시 / 공개프로필 warm 0-read 배포 완료
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

## 0D. PREVIEW 106 — 공개 좋아요 숫자/개인 하트 분리 배포 완료
- 사용자 승인으로 106을 **Firebase PREVIEW Hosting에 배포 완료**.
- 106 최종 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`.
- PREVIEW 배포 source/trigger commit: `caf6f458096f876ae93bfb07c60f9445d6a14c76`.
- PREVIEW App Release Run `35059625879` — **SUCCESS**.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- 실제 `https://preview.soridraw.com`의 `app-version.json` = **106**, exact build hash PASS.
- Explore Worker는 재배포하지 않음. 기존 105 event-driven 1분 Worker `961084b2-28e0-4d04-8577-56d8944f4916` 유지.
- Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, Media Worker, UI/CSS, 사용자 원본 데이터 변경 없음.
- TEST `main` / PRODUCTION branch 및 실제 TEST/PRODUCTION Hosting 결과 비변경 PASS.
- **현재 상태: 106 PREVIEW 배포 완료 / Master·Admin 교차계정 실사용 검증 전 / TEST 승격 금지.**
- 실사용 기준: 개인 heart는 즉시 바뀌고 공개 숫자는 공식 1분 aggregate 전까지 이전 공용 숫자를 유지할 수 있다. 약 `1분~1분 10초` 뒤 재진입/포커스/상호작용 시 Master/Admin의 공개 숫자가 반드시 동일해야 하며, 좋아요 해제도 같은 기준으로 수렴해야 한다.
- 고정 1분 Cron은 없음. 실제 좋아요 batch가 있을 때만 alarm 1회가 예약되며 유휴 aggregate 반복 실행 0 목표 유지.

## 0C. PREVIEW 106 — 공개 좋아요 숫자와 개인 하트 완전 분리 / 코드 완료·미배포
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

## 0B. PREVIEW 105 — 1분 이벤트 좋아요 PREVIEW 배포 완료
- 사용자 요청에 따라 PREVIEW 검증용 공개 좋아요 묶음 시간을 5분에서 **1분**으로 단축하고 실제 배포까지 완료.
- **고정 1분 Cron은 없음.** 실제 non-empty like batch가 들어올 때만 shared Durable Object alarm 1개를 1분 뒤 예약한다. 좋아요가 없으면 주기 aggregate 실행 0.
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`.
- Worker release source lock: `8a26b5018dccfb3171d6cb4270a490309ccee704`.
- PREVIEW Worker Release Run `35055367492` 최종 재실행 PASS.
- 실제 PREVIEW Explore Worker: `961084b2-28e0-4d04-8577-56d8944f4916`.
- Worker 배포 전 live queue: `pending035=0`, `pending069=0`; warm `/v1/feed-revision` D1 R0/W0 + `HEAD-ONLY-036` PASS.
- Feed smoke / 공개프로필 smoke / like batch route 존재 / fixed cron 0 / TEST·PRODUCTION Worker 비변경 모두 PASS.
- PREVIEW App Release Run `35055877861` PASS. 실제 `https://preview.soridraw.com` 앱 버전 **105**, exact build PASS.
- App TypeScript / Build / Firebase PREVIEW Hosting PASS. TEST·PRODUCTION Hosting 비변경 PASS.
- 배포 중 기존 069 queue 1건이 남아 있을 때 transition guard가 정상적으로 배포를 중단했다. 데이터 삭제/강제처리 없이 기존 스케줄러가 자연 배출할 때까지 기다렸고, read-only 진단 Run `35055702601`에서 `pending069=0`, `rows_written=0` 확인 후 배포했다.
- 임시 read-only 진단 Workflow/trigger는 배포 후 삭제 완료.
- 변경 없음: Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, Media Worker, UI/CSS, 사용자 원본 데이터.
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` 비변경. PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` 비변경.
- **현재 상태: 105 PREVIEW 배포 완료 / Master·Admin 교차계정 좋아요·해제 실사용 검증 전 / TEST 승격 금지.**
- 다음 실사용 기준: Master 좋아요 후 약 `1분~1분 10초` 뒤 Admin이 Explore 재진입/포커스/상호작용하면 공개 총 좋아요 숫자가 수렴해야 한다. 개인 빨간 heart는 계정별로 달라도 정상.
- 아래 0A/0/102/103의 당시 “미배포” 문구는 과거 기록이며 이 0B 항목이 최신 실제 상태다.

## 0A. PREVIEW 105 — 테스트용 1분 좋아요 창 코드 완료
- 사용자 요청으로 5분 실사용 대기 시간을 PREVIEW 검증 동안 1분으로 단축.
- **고정 1분 Cron은 추가하지 않음.** 좋아요가 실제로 들어올 때만 shared Durable Object alarm 1개를 1분 뒤 예약하는 기존 이벤트 기반 구조를 유지.
- 같은 1분 창의 추가 batch는 deadline을 뒤로 미루지 않음. 후속 로컬 변경은 마감 약 15초 전에 최종 상태를 한 번 더 flush.
- actor fresh Feed refresh는 `1분 + 10초`; `/v1/feed-revision` client cache도 1분, namespace v3로 변경해 기존 5분 cache를 차단.
- Durable Object class/binding `ExploreLikeBatchScheduler103`은 유지해 새 DO migration 없음.
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`.
- 105 apply/verification Run `35054646104` PASS: verifier, Worker syntax, TypeScript, Build, Wrangler PREVIEW dry-run, change-boundary 모두 PASS.
- 변경 파일: `cloudflare/explore-worker/canonical/preview-entry.js`, `src/services/exploreLikeService.ts`, `src/services/exploreRevisionRequestCache.ts`, `src/pages/ExplorePage.tsx`, `public/app-version.json`.
- UI/CSS, Firebase Functions/Rules, RTDB Rules, D1 schema/migration, 사용자 원본 데이터 변경 없음.
- **현재 실제 PREVIEW 런타임은 아직 앱 104 + Worker 103의 5분 설정. 105는 미배포.** 사용자 배포 요청 전에는 실제 환경을 변경하지 않음.
- TEST/PRODUCTION 비변경. TEST 승격 금지.

## 0. PREVIEW 104 — 103 실사용 실패 후 즉시 수정/재배포
- 2026-09-16 실사용에서 Master는 공개 좋아요 1, 다른 Admin은 5분 후에도 0으로 남는 현상 확인.
- 원인 1: 103 클라이언트가 일반 Explore 체류 중에는 좋아요 outbox를 서버로 보내지 않아, 페이지 경계/50개 전에는 서버의 5분 타이머 자체가 시작되지 않았음.
- 원인 2: `ExplorePage.tsx`에 이전 10분 wall-clock aggregate refresh 기준이 남아 있었음.
- 104 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`.
- 104 수정: 첫 실제 좋아요 변경에서 서버 5분 aggregate 창을 1회 시작하고, 같은 창의 후속 클릭은 로컬에 모은 뒤 마감 15초 전에 최종 상태만 한 번 더 flush. 50개 ceiling/page boundary는 기존 안전장치 유지.
- 104 수정: actor 강제 fresh Feed refresh를 `5분 + 10초` 기준으로 변경하고 이전 10분 wall-clock 계산 제거.
- 104 source apply Run `35052705770` PASS: verifier / TypeScript / Build / change boundary PASS.
- PREVIEW Hosting 104 배포 Run `35052825886` PASS. 실제 `preview.soridraw.com` 앱 버전 104.
- PREVIEW Explore Worker는 103 event scheduler 배포본 `0287b2ef-6445-47a4-afd9-6058f02706cc` 유지. 고정 10분 cron 없음.
- TEST/PRODUCTION 비변경. Firebase Functions/Rules, D1 schema/migration, RTDB Rules, 사용자 원본 데이터 변경 없음.
- 주의: 다른 계정의 **완전히 가만히 있는 열린 탭**은 비용 0 원칙 때문에 주기 polling하지 않는다. 5분 이후 해당 계정이 Explore 재진입/포커스/실제 상호작용하면 zero-D1 revision 경로로 최신 공개 숫자를 확인해야 한다.
- 상태: **104 PREVIEW 배포 완료, Master/Admin 교차계정 재검증 필요. TEST 승격 금지.**
- 아래 102/103의 “미배포” 문구는 당시 기록이며 이 0번 항목이 최신 실제 상태다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 `preview` 제품 코드 후보: **106**
- 102 Explore public-like parity 제품 commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`
- 103 Explore event-driven 5분 좋아요 묶음 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 104 first-like 5분 창 수정 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`
- 105 1분 event 테스트 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`
- 106 canonical-only 공개 숫자 분리 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`
- 102 source apply Workflow Run: `35046615434` — **PASS**
- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com` — Run `35055877861` PASS
- 실제 PREVIEW Explore Worker: **105 1분 event scheduler** / `961084b2-28e0-4d04-8577-56d8944f4916` — 고정 cron 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- **릴리스 상태: 106 코드 완료·미배포. 실제 PREVIEW는 105이며, 106 PREVIEW 교차계정 재검증 전까지 TEST 승격 금지.**

## 2. 102 목표 — 공개 좋아요 숫자 교차계정 일치
2026-09-16 Master / Admin A / Admin B 실사용 비교에서 다음 문제를 확인했다.

- 빨간/채운 하트는 로그인 계정별 개인 membership이므로 계정마다 달라도 정상.
- 하트 옆 총 좋아요 숫자는 공개 공용 aggregate이므로 모든 계정/기기에서 수렴해야 함.
- 기존 구조에서는 같은 계정 PC↔모바일은 RTDB/local signal로 수렴했지만, 다른 계정은 오래된 공개 숫자를 계속 볼 수 있었음.

확정 원인:
1. 새 좋아요 intake는 `055-explore-like-intake-w1-hotpath.mjs` 이후 069 W1 queue를 사용.
2. scheduled aggregate가 canonical D1 `likes` / `track_stats`는 갱신하지만 069 경로에서 public Feed/Profile R2 projection이 누락됨.
3. `/v1/feed-revision`은 public Feed R2 ETag를 revision으로 사용하므로 R2가 그대로면 다른 계정은 local cache를 최신값으로 오인.
4. 클라이언트 revision 응답 10분 cache가 aggregate 직전 생성되면 public R2가 갱신된 뒤에도 추가로 오래된 revision을 가릴 수 있었음.

## 3. 102 수정 구조
### A. canonical aggregate 후 public Feed R2 수렴
새 patch:
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- marker: `SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916`

동작:
- 기존 `processExploreLikeBatches035` canonical 처리 자체는 유지.
- 실제 public count가 변한 aggregate(`changedTracks > 0`) 뒤에만 public projection 수렴 실행.
- `derivedHead032` + `derivedRank032` + `derivedItems032`를 사용해 `latest` / `popular`의 **첫 40곡만 bounded/indexed 방식으로** 정확히 재구성.
- 전체 `tracks` / `likes` / `track_stats` scan 금지.
- Feed R2가 실제 canonical 결과와 달라졌을 때 R2 객체가 갱신되어 ETag도 변경됨.
- public Profile R2는 첫 화면에 실제 노출되는 changed track만 owner별로 묶어 수정.
- 한 profile cache 문제가 canonical D1 또는 shared Feed 성공을 실패로 되돌리지 않음.
- concurrent 공개/비공개 변경으로 bounded snapshot이 완전하지 않으면 거짓 cursor를 기록하지 않고 다음 repair 경로로 넘김.

### B. 다른 계정 revision blind window 축소
변경:
- `src/services/exploreRevisionRequestCache.ts`
- marker: `SORIDRAW_EXPLORE_PUBLIC_LIKE_REVISION_BOUNDARY_102_20260916`

원칙:
- 기존 최대 local revision cache 10분은 유지.
- 단, 10분 aggregate 경계를 넘어 오래된 revision을 추가 10분 가리는 경우를 막기 위해:
  - 일반 만료: `now + 10분`
  - aggregate 경계 만료: `다음 10분 경계 + 70초`
  - 둘 중 더 이른 시각을 선택.
- 즉 기존보다 cache를 더 오래 유지하지 않으며, 경계 직전 만들어진 stale revision만 조기에 재확인.
- 페이지 진입마다 D1 조회를 추가하지 않음. revision path는 기존 R2/Edge HEAD 기반 유지.

### C. intentionally 유지한 비용 구조
- 069 W1 queue 유지.
- 좋아요 클릭 즉시 canonical D1 write로 되돌리지 않음.
- cron `*/10 * * * *` 유지. 1분 cron으로 비용을 늘리지 않음.
- unchanged page-entry / update / revisit 때문에 D1 full read/write를 만들지 않음.
- UI / CSS / 반응형 변경 없음.

## 4. 102 변경 파일
제품 commit `00fa785598b5b326800fc1ece0404a3dc9241fd8`:
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `cloudflare/explore-worker/release-patches.json`
- `src/services/exploreRevisionRequestCache.ts`
- `public/app-version.json` → `102`

지원/검증 파일:
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- `scripts/verify-102-explore-public-like-parity.mjs`
- `.deploy/apply-102-explore-public-like-parity.py`
- `.github/workflows/apply-102-explore-public-like-parity.yml`
- `.deploy/apply-102-explore-public-like-parity.trigger`

변경하지 않은 것:
- Firebase Functions
- Firestore Rules
- RTDB Rules
- D1 schema / migration / seed
- Media Worker
- Music Note / Library 데이터 구조
- UI / CSS / 위치 / 크기 / 테마 / 반응형
- 사용자 원본 데이터

## 5. 102 자동검증
Source apply Run `35046615434` — **PASS**.

PASS 항목:
- Worker 056 patch syntax / canonical Worker syntax
- `verify-102-explore-public-like-parity.mjs`
- `verify-explore-like-cost-optimization.mjs`
- `verify-explore-derived-cache.mjs`
- TypeScript `npx tsc --noEmit`
- Production Build `npm run build`
- `git diff --check`
- change boundary 확인

핵심 검증 결과:
- `102_EXPLORE_PUBLIC_LIKE_PARITY=PASS`
- `PUBLIC_FEED_RECONCILE=BOUNDED_TOP40`
- `PUBLIC_PROFILE_PATCH=VISIBLE_CHANGED_ONLY`
- `REVISION_CACHE=10MIN_CEILING_BOUNDARY_SHORTEN_ONLY`
- 100 same-track likes fixture → canonical count/derived update 1회 구조 유지
- net-zero public count cohort → 불필요한 public derived write 0 구조 유지
- unchanged cursor → item/rank/write 0 구조 유지
- warm revision → D1 read 0 구조 유지
- no user data migration / no UI CSS change

참고:
- 첫 Apply Run `35046459652`는 모든 코드/TypeScript/Build/검증까지 PASS했지만, 마지막 push에서 GitHub App이 다른 workflow 파일을 수정할 권한이 없어 실패.
- 제품 문제가 아니라 CI 권한 경계였고, 다른 workflow를 수정하지 않는 방식으로 정리 후 Run `35046615434`가 전체 PASS 및 제품 commit 생성.

## 6. 배포 상태 — 중요
**103은 아직 배포하지 않았다. 102 공개 좋아요 수렴 수정도 103에 포함된다.**

현재 실제 서비스:
- PREVIEW Hosting: 앱 101
- PREVIEW Explore Worker: 기존 배포본 056
- TEST: 변경 없음
- PRODUCTION: 변경 없음

따라서 `preview.soridraw.com`에서 지금 102 교차계정 수정 결과를 테스트하면 안 된다. 사용자 PREVIEW 배포 요청 후 앱 102 + 새 canonical Explore Worker를 함께 검증 배포한다.

## 7. 사용자 데이터 / 안전
- PREVIEW / TEST / PRODUCTION 사용자 원본 데이터 이동·복제 없음.
- D1 migration/backfill 없음.
- 대량삭제/대량변환 없음.
- 기존 likes / track_stats canonical 의미 변경 없음.
- 공개 총 좋아요 숫자는 canonical D1을 기준으로 public cache가 따라가는 구조.
- 개인 heart membership은 계정별 상태이며 다른 사용자에게 공유하지 않음.

## 8. 비용 기준
정상 변경 없음:
- app update 때문에 public data 전체 재생성 금지.
- Explore warm revisit D1 read 0 목표 유지.
- revision check는 Edge/R2 HEAD 기반, D1 R0/W0 유지 목표.
- scheduled aggregate에 처리할 좋아요가 없으면 기존 idle W0 유지.

실제 좋아요 변경 있음:
- client → local outbox / boundary batch 기존 구조 유지.
- 069 W1 queue 유지.
- scheduled canonical aggregate는 변경분만 처리.
- public cache 수렴은 aggregate 뒤 bounded first 40 + visible changed profile 범위만 처리.
- 1개 좋아요 때문에 전체 사용자/전체 곡/public profile 전체 재생성 금지.

## 9. 기존 101 Library 상태
101 Library Local First 개선은 그대로 보호한다.
- playlist header/item IndexedDB cache
- warm cache + 동일 `syncVersions.playlists` 재진입 read 0 목표
- playlist/item page-entry `onSnapshot` 제거
- 곡별 likes/share 자동 fan-out 제거
- 실제 변경 때만 해당 revision/write

101 Rules Run `35039874658` PASS, PREVIEW App Run `35039951005` PASS.
Library 101 실제 비용/PC↔모바일 수렴 실측은 계속 필요하다.

## 10. TEST / PRODUCTION 승격 금지 조건
TEST는 아래 전부 PASS 전 승격 금지:
1. 103 PREVIEW 앱 + Explore Worker 배포 검증.
2. Master / Admin A / Admin B 교차계정 공개 총 좋아요 숫자 수렴.
3. 좋아요/좋아요 해제 모두 수렴.
4. 최신/인기 Feed 및 공개프로필 숫자 일치.
5. 같은 계정 PC↔모바일 개인 heart 유지.
6. warm unchanged Explore 비용 회귀 없음.
7. 100 liked-card zero-read 검증.
8. 101 Library 비용/정확성 실측.

PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.

## 11. PREVIEW 103 배포 후 필수 실사용 검증
- Master에서 공개곡 좋아요 → boundary flush → canonical aggregate 이후 Admin A/B 공개 숫자 일치.
- Master에서 좋아요 해제 → 동일하게 모든 계정 공개 숫자 감소 일치.
- Admin A/B 자신의 빨간 heart는 각 계정 membership대로 독립 유지.
- `추천/최신/인기` 전환 후 공개 숫자 동일.
- 해당 곡 공개프로필에서도 같은 총 숫자 확인.
- PC/모바일 같은 계정 heart/count 수렴 확인.
- CACHE LIVE에서 변경 없는 재진입 D1 R0/W0 목표 확인.
- 실제 aggregate 변경 시에만 bounded public R2 갱신되는지 확인.
- 앱 업데이트만으로 전체 Feed/Profile 재생성 또는 D1 폭증 없는지 확인.

## 12. 알려진 위험 / 다음 작업
- 102은 코드/자동검증 PASS지만 **실제 Cloudflare PREVIEW 배포 후 rows_read/R2 동작은 미검증**.
- 103은 고정 10분 Cron을 제거하고, 실제 서버 like batch가 생긴 경우에만 공유 Durable Object가 5분 뒤 aggregate 1회를 예약한다. 같은 5분 창의 추가 batch는 마감시각을 뒤로 미루지 않는다.
- 사용자 요구가 ‘모든 다른 사용자에게 즉시 실시간 숫자’로 바뀌면 별도 비용 설계가 필요하며 현재 구조를 무조건 1분 polling으로 바꾸지 않는다.
- 개인 heart missed-signal의 장기 stale cache 문제는 public 숫자와 분리된 영역이다. 102 PREVIEW 실측에서 재현되면 작은 per-account revision 방식으로 후속 수정한다.
- Build chunk-size/mixed import 경고는 기존 경고로 남음.

다음 안전 순서:
1. 사용자가 `프리뷰배포` 요청 시 103 고정 commit 기준으로 PREVIEW Worker + Hosting 검증 배포.
2. 실제 Master/Admin A/Admin B 교차검증.
3. 비용 계측.
4. 문제 없을 때만 TEST 승격 검토.


## 13. 103 이벤트 기반 5분 좋아요 묶음 — 2026-09-16
- 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 목적: 고정 `*/10` Cron을 없애고 **실제 like batch가 서버에 들어왔을 때만** 5분 뒤 aggregate를 1회 실행.
- Cloudflare Durable Object `ExploreLikeBatchScheduler103` 1개를 shared scheduler로 사용.
- 첫 non-empty `/v1/me/likes/batch`가 alarm을 만들고, 같은 창의 후속 batch는 기존 alarm 시각을 유지해 5분을 계속 연장하지 않음.
- 좋아요 변경이 없으면 alarm 0, aggregate 실행 0.
- alarm은 Cloudflare at-least-once retry를 사용하고 기존 D1 aggregate lease/set semantics를 그대로 보호.
- 아주 큰 burst로 069 queue가 남은 경우에만 처리 후 `LIMIT 1` 확인 1회 후 다음 5분 alarm을 추가. 평상시 반복 polling 없음.
- 102에서 복구한 canonical D1 → public Feed/Profile R2 수렴 경로는 그대로 사용.
- 다른 계정의 revision 확인은 event aggregate 시각이 고정 wall-clock이 아니므로 local revision cache를 10분 → 5분으로 축소. 이 경로는 Edge/R2 HEAD이며 D1 R0/W0 유지.
- 기존 10분 revision response가 103 첫 수렴을 가리지 않도록 **revision response cache만** v2 namespace로 변경. Feed/사용자 데이터 cache는 무효화하지 않음.
- D1 schema/migration/backfill 없음. Firebase/Functions/RTDB Rules/UI/CSS 변경 없음.
- 실제 PREVIEW 배포 전 상태. Durable Object namespace는 PREVIEW Worker 첫 배포 때 Cloudflare가 additive 생성하며 사용자 원본 데이터와 무관.

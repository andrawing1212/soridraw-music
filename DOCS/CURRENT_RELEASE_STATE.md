# SORIDRAW CURRENT RELEASE STATE

## 0FZ. 사용자 실기기 확인 — app163 휴대폰 최근 생성곡 표시 PASS (2026-09-25 KST)

**사용자 확인**: PREVIEW app163 배포 후 사용자가 "지금은 휴대폰에 최근 생성곡이 보여"라고 직접 보고. 기존 PC→휴대폰 누락 증상 중 **휴대폰 최근 생성곡 표시**는 실사용 관측 PASS로 갱신한다. PC 원본에 대한 삭제·재생성·캐시 초기화 없이 현재 표시된다는 관찰 결과이며, 실데이터 원본의 문서별 비교를 수행한 것은 아니다.

**아직 미검증**: 새 곡 생성 직후 다른 페이지 왕복/새로고침 없이 자동 표시되는지, 이후 추가 곡·동시 편집, 업데이트/재진입의 실제 Firestore R0/W0 및 구형 신호 1회 조회 영향은 별도 확인 필요. 이번 성공을 전체 실시간 동기화·대규모 비용 PASS로 확대하지 않는다. app163 소스/배포 유지, 추가 동기화 패치·사용자 데이터 복구·TEST/PRODUCTION 승격 불필요/미승인. 다음은 불필요한 API 생성 없이 기존 화면/정상 캐시 기준 비용을 살피고, 별도 확인된 영어 가사 추가 카드 영어 제목 누락·생성 시간(0FU)을 독립 작업으로 다룬다. 좋아요 app160/Worker195와 Gemini app162 생성 성공 경로는 동결 보호.

## 0FY. PREVIEW app163 Hosting 배포 완료 — 최근 생성곡 PC↔모바일 신호 보호, 실데이터 검증 전 (2026-09-25 KST)

**실제 제품 상태**: app163 Firebase PREVIEW Hosting Run `36037269105` SUCCESS / exact release SHA `8e285966975d410e2e3797d77ff031945b7cbf7a` / `PREVIEW_APP_VERSION=163` / `PREVIEW_EXACT_BUILD=PASS`. 고정 제품 소스/최종 감사 기준 `fe74f006bd3c90793f45830a0f4ee019d738cfe8`, 최종 Release System Audit Run `36036971353` SUCCESS (TypeScript/Build, `RECENT_SONGS_196_*` 모의/정적 회귀, 기존 좋아요·Gemini 감사, Worker TEST/PROD dry-run, shared D1 read-only). 이전 후보 Audit `36036423431` SUCCESS 후 pre-163 PC 로컬 미저장 안전 가드를 추가하여 재감사함.

**수정 적용**: UID별 recentSongs RTDB 신호 버전과 Firestore 원본 문서 버전을 구별, 신규 저장 신호는 가능한 원본 `syncVersion` 사용, 수신 pending/ack를 페이지 밖에서도 보존. 프로필 캐시 버전이 뒤처져도 변경 신호가 들어오면 원본 1문서를 bounded 조회하며 **실제 최신 서버 결과의 로컬 캐시 저장 후에만 신호 확인**. 조회 중 새 신호 재확인, 로컬 미저장 편집·진행 중 생성 저장 보호. 새 곡은 PC UID별 로컬에 먼저 보관하며 서버 저장 실패 시 알림. 원본보다 새로 만들어진 pre-163 로컬 곡과 163 이후 unconfirmed song ID는 오래된 서버 응답에 덮어쓰지 않는다. 전체 사용자/컬렉션 조회·전체 백필·반복 polling 없음.

**배포 영향**: Hosting only, shared RTDB rules deploy SKIPPED. Gemini PREVIEW Function `36026587156`, Cloudflare Worker195 `11d8455c-c266-4e88-9cf6-7549d3f5be92`, 좋아요 실행 코드/RTDB 규칙/Firestore schema/Functions 비변경. TEST/PRODUCTION Hosting 및 branch unchanged PASS. 사용자 원본 데이터의 직접 읽기/쓰기/대량변환/복사 없음.

**실사용 게이트 (PASS 아님)**: 해당 기존 PC 생성곡의 실제 `user_recent_songs/{uid}.songs[]` 포함 여부를 읽지 못했다. 이 곡이 서버에 있었다면 모바일에서 새로운 신호 확인/원본 fetch로 표시되어야 하나, 실제 스마트폰 확인 전이며 **기존 곡 자동 복구 완료를 보장하지 않는다**. 원본에 없으면 모바일 코드만으로 데이터를 만들어낼 수 없다. PC 원본 로컬 곡과 캐시 유지, 동일 UID·PREVIEW 모바일 확인 후 문제가 남으면 안전한 계정별 원본 1문서 / 프로필 1문서 / RTDB 신호 1개만 읽기 전용 비교. 사용자 재생성/전체 캐시 초기화 금지.

**비용 경계**: unit gate에서 정상 캐시/확인된 신호 재진입 판정 R0/W0, 새 신호 R1/W0. 기존 timestamp 기반 구형 신호가 도착한 일부 기기는 최초 한 번 읽을 가능성이 있어 실제 비용/대규모 영향은 미검증. 이번 작업 완료는 **배포 완료**, PC↔모바일 실사용/실비용 완료가 아니다. TEST/PRODUCTION 승격 금지.

## 0FX. 최근 생성곡 PC↔모바일 동기화 PREVIEW app163 후보 — 신호·로컬 안전 수정, 실기기/원본 미검증 (2026-09-25 KST)

**사용자 시간 제보**: 2026-09-25 KST 01시 이후부터 이번 누락이 나타난 것으로 보임. GitHub `src/App.tsx`의 이전 마지막 제품 코드 변경은 2026-09-16, `app162` Hosting Run `36026936663` 완료 2026-09-25 약 01:24 KST, 첫 V1 생성 성공 기록 약 01:31 KST. **기존 recent sync 코드가 app162 배포에서 직접 바뀐 증거는 없음**. 실제로 그때 새 곡을 생성하며 기존 저장·수신 결함이 처음 드러났을 수 있다. 그 시각의 실제 Firestore user doc/RTDB trace는 미확인.

**수정 대상 (PREVIEW 소스 후보, 앱 코드만)**:
- `src/services/userDomainSyncService.ts`: recentSongs만 원본 write가 반환한 `syncVersion`을 RTDB signal version으로 우선 사용(기존 Date.now timestamp는 구형 신호 호환). UID별 RTDB 신호의 pending/ack를 기기 로컬에 각각 저장하여 /studio 밖에서 받은 변경도 보존한다. 본인 기기의 저장된 최신 신호는 local ack. null (mutation epoch skip)일 때 recent signal 발행 금지. Music Note/좋아요 경로 변경 없음.
- `src/App.tsx`: 최근곡 진입 시 로컬 캐시와 프로필 버전뿐 아니라 **확인되지 않은 RTDB 신호**를 확인. 서버 최근곡 문서 **한 번만** 읽고 현재 로컬 미저장 편집/생성 중인 서버 저장을 보호하며, 실제 Firestore 결과를 로컬 캐시에 저장한 다음에만 수신 token 확인 처리. 조회 중 더 새 신호가 오면 완료 후 bounded 후속 확인. 페이지를 떠나도 신호 보존. 오래된 원본 조회가 PC의 아직 저장 미확인 새 곡을 덮지 않도록 신규 생성 ID는 로컬에 보관하고 성공적으로 canonical 문서에 포함된 뒤만 해제.
- 새 곡 생성 완료 직후 서버 저장 전에 현재 UID 로컬 캐시를 먼저 보관. `saveRecentSongsBatch` 오류는 더 이상 정상 resolve하지 않으며 PC 화면에서 서버 저장 실패를 알린다. 새 곡 재생성/원본 강제 backfill 없음. 저장 실패 자동 반복 재시도 없음.
- `src/lib/recentSongsSyncGate.ts`의 순수 버전 판정 및 `scripts/verify-196-recent-song-sync.ts`의 100/100/200, in-flight 200→300, 동일 signal R0 테스트 추가. `public/app-version.json=163` 후보. Audit-only workflow에 해당 verifier 1줄 등록.

**배포 전 추가 안전 보정**: 기존 app162 PC 생성곡에는 새 미저장 ID marker가 없을 수 있으므로, 로컬 최신 곡의 `createdAt`이 장치의 마지막 확인 문서 버전 및 서버 문서 버전보다 명백히 새롭고 그 곡 ID가 서버에 없으면 **PC 원본 로컬을 유지하고 수신 ACK를 미룸**. 이는 누락 곡을 강제 서버 저장하거나 삭제된 곡을 자동 복원하지 않으며, 실제 서버 상태 확인 전 무작정 덮어쓰지 않기 위한 제한된 보호책이다. 후보 `236f7cfc93ce8bd5569ce5f8c6008b5c5787123e`에서 추가. 앞선 Release System Audit `36036423431`은 이전 후보 PASS였으므로 이 추가 변경의 최종 Audit을 재실행한다.

**한계/안전 게이트**:
- 현재 실제 사용자 계정 원본 `user_recent_songs/{uid}`의 기존 누락 곡은 **조회하지 못함**. 이 수정이 그 곡의 자동 복구를 보장한다고 보고하지 않는다. PC 원본 로컬 캐시/기존 곡 ID 유지, 사용자 데이터 migration/delete/백필 없음.
- 구형 RTDB timestamp가 원본 문서 버전과 약간 달라 업데이트 직후 일부 계정에서는 **최초 한 번** 원본 문서 읽기가 추가될 가능성. 변경 없는 재진입 및 이미 확인된 신호는 R0/W0 목표. 이 비용/대량 업데이트 위험을 사전 감사에서 평가하고 무의미한 전체 조회로 확장하지 않는다.
- app163 배포 전 TypeScript/Build/새 verifier/전체 감사 PASS 필요. 현재 **코드 후보이며 PREVIEW 실기기/PC↔모바일 미검증**, TEST/PRODUCTION 승격 금지. 좋아요 app160/Worker195 및 Gemini app162 정상 생성 경로/Functions/Worker 완전 비변경.

## 0FW. Astra 독립분석 + GitHub 재대조: 최근곡 신호 누락 경로 확인, 실제 곡 원본은 미확인 (2026-09-25 KST)

**입력**: 사용자가 Astra의 commit `b90ec19b7a84045c22b1552aa639d2e541901cb8` 정밀 분석 및 모의 실행 결과를 전달했다. ChatGPT가 동일 preview GitHub 소스의 `App.tsx` / `userDomainSyncService.ts` / `v1MutationBoundary.ts`를 재검토했다. 코드 결함이 확인된 것과 **사용자 해당 곡이 서버에 있는지**는 별개다. 해당 계정의 실제 Firestore/RTDB는 아직 읽지 못했다.

**확인된 코드 결함**:
1. `App.tsx:11074-11079`는 RTDB detail.version을 로컬 버전과 비교하지만 `runRecentSongsServerSyncIfNeeded`에 전달하지 않는다. 함수 내부 `11025-11029`는 오래된 profile cache의 remoteVersion만 사용하므로 `local=profile 100`, RTDB 200 상황에서 변경된 서버 문서를 0회 읽는 결함. `9202-9298` 캐시 우선 루트 프로필 재검증은 최대 24h일 수 있어 결함이 지속될 수 있다.
2. 읽기 중 추가 RTDB 버전이 와도 `recentSongsSessionReadInFlightUids`에서 무시하고, 응답 완료 시 마지막 pending 버전 재확인이 없다. 원격 변경 300 누락 가능.
3. `App.tsx:12729-12754`: Gemini 완료를 화면에 먼저 보여주고 최근곡 저장은 background fire-and-forget. `11896-11898` 저장 실패 catch가 오류를 삼켜 save chain이 resolve할 수 있어 **생성 성공 표시만으로 서버 원본을 증명할 수 없다**.
4. `persistRecentSongsDocument:369-390`은 최근곡 원본과 프로필 syncVersion을 별도 쓰기로 처리하며 프로필 발행 실패는 경고만 기록한다. RTDB `userDomainSyncService.ts`는 저장 결과 version 대신 새 `Date.now()`를 사용하고 `v1MutationBoundary.ts`의 post-success hook은 비동기로 실패를 삼킨다. 서로 다른 clock/version domain을 그대로 섞거나 신호 버전을 문서에 직접 확인 완료로 기록하면 **영구 누락 위험**.

**최소 복구 설계 게이트**:
- 실제 동일 UID 기준 `user_recent_songs/{uid}` 문서 1개, `users/{uid}` 1개, 해당 `userSync/{uid}/recentSongs` 1개만 안전한 읽기 전용 확인. 곡 ID/createdAt 존재, 문서 syncVersion, 프로필 syncVersion, RTDB version 비교. UID/API key/가사 원문을 채팅/CI/로그에 노출하거나 전체 컬렉션 scan 금지. 현재 connector로 실데이터 직접 조회 불가: 데이터 존재를 추정으로 채우지 않는다.
- 원본 존재 시 `App.tsx`에 신호 최신 버전의 pending 상태를 보관하고, root profile cache보다 선도착한 신호도 1회 bounded remote verify로 처리. **실제 문서/캐시 반영과 로컬 미저장 mutation epoch 확인 성공 후에만 해당 문서 버전 확인 완료**. 조회 중 추가 신호가 도착했다면 완료 후 재확인. RTDB 시각과 document syncVersion이 다를 수 있으므로 수신 시각을 곧바로 로컬 확인 완료 버전으로 쓰지 않는다. `/studio` 이탈 중에도 최신 신호를 보존. 변경 없음 재진입 Firestore R0/W0.
- 원본 부재면 PC 생성 저장 실패/스킵/경합을 구분해 기존 PC 로컬 곡을 보호하고 서버 저장의 실패를 삼키지 않도록 별도 검토. Gemini 재생성/원본 덮어쓰기 금지. 프리뷰에서 생성 완료의 UI와 저장 성공은 서로 다른 상태임을 유지할 수 있다.
- 버전 발행을 한 기준으로 통일하거나 원본+프로필 쓰기 배치화는 데이터·비용 영향 확인 후 별도 단계로 검토. 원본 전체 교체·백필·강제 migration 금지.
- **좋아요 app160/Worker195 완전 동결**; Gemini app162 SSE 성공 경로, Music Note 60초 저장 및 UI 보호. TEST/PRODUCTION 승격 불가. 이번 커밋은 문서만 갱신했고 사용자 데이터/실제 배포/제품 코드 변경 없음.

## 0FV. PREVIEW app162 최근 생성곡 PC → 모바일 누락 — 저장/변경신호/수신 캐시 미분리, 릴리스 차단 (2026-09-25 KST)

**사용자 직접 제보**: PC에서 새 곡을 생성한 뒤 휴대폰의 최근 생성곡을 확인했지만 해당 곡이 없다. 아직 동일 계정·동일 PREVIEW 주소 확인, Firestore 원본 `user_recent_songs/{uid}.songs[]` 해당 곡 포함 여부, PC 로컬 캐시/모바일 로컬 캐시, `users/{uid}.syncVersions.recentSongs` 및 RTDB `userSync/{uid}/recentSongs` 발행 상태, 모바일 최종 수신 시각은 실제로 검사되지 않았다. **서버 저장 실패/변경 신호 누락/모바일 수신 게이트/환경·계정 차이를 현재 확정 불가**. 사용자 원본을 캐시라고 가정해 지우지 않는다.

**읽기 전용 코드상 위험 후보**:
- 기존 `.deploy/apply-935-recent-version-sync-only.py`가 구성한 `runRecentSongsServerSyncIfNeeded`는 저장된 프로필의 `syncVersions.recentSongs`와 휴대폰 로컬 버전을 비교해 `remoteVersion > localVersion`일 때만 `getDocFromServer(user_recent_songs/{uid})` 수행. 이 방식은 변경 없는 재진입 서버 읽기 0을 위해 필요.
- `src/services/userDomainSyncService.ts`는 uid별 RTDB `userSync/{uid}/recentSongs`의 version을 앱 이벤트로 전달. 935의 소비자는 이벤트 `detail.version`을 로컬 버전과 비교하지만 실제 fetch 판단은 *별도* `readUserProfileCache(uid)`의 remoteVersion에서 다시 계산한다. RTDB 신호가 프로필 캐시 반영보다 먼저 오거나 프로필 신호가 실패/누락된 경우, **새 이벤트가 있어도 이전 프로필 값으로 읽기를 건너뛸 가능성**이 있다. 이것이 이번 사용자 케이스의 원인인지는 실시간 증거 전 확정하지 않는다.
- `persistRecentSongsDocument`는 원본 최근곡 문서를 먼저 저장하고 users 버전 신호를 나중에 쓰며, 그 signal 실패는 경고 후 계속 진행한다. 원본 저장 자체가 실패했는지 먼저 분리해야 한다. 편집/확인의 경우 일부 경로는 PC 로컬 캐시만 업데이트할 수 있으므로 새 곡 생성과 후속 텍스트 편집을 혼동하지 않는다.

**안전 검사 순서**:
1. 동일 uid/preview 앱 주소 판정(비밀값 기록 금지). PC에서 새 곡 존재 유지, 로컬 저장소/캐시 삭제·로그아웃·곡 재생성 금지.
2. Firestore **해당 uid의 최근곡 문서 1개만** 읽기 전용 확인: 새 곡 ID/생성시간의 존재, 문서 `syncVersion` 및 `users/{uid}.syncVersions.recentSongs`의 숫자 비교. 전체 favorites/Feed/사용자 컬렉션 조회 금지.
3. 원본 존재 시 모바일 저장된 recentSongs local version, 프로필 캐시 version, RTDB 마지막 신호 version 및 이벤트 전달 여부를 비교. 버전이 변경된 경우에만 한 번 읽어 해당 새 곡을 기존 목록과 안전하게 병합하는 최소 수정. 원본 부재라면 PC 실제 생성 저장(또는 retry/outbox) 단계만 조사하여 정상 저장 보호; 앱 재진입 write/강제 백필 금지.
4. 서로 다른 환경(Hosting 코드)은 구분하되 공유 원본을 복사하지 않는다. PC·모바일 결과 일치 후에만 PASS.

**현재 상태**: app162 Hosting Run `36026936663`, PREVIEW Gemini Function `36026587156` 배포 완료 상태 유지. 실사용 최근곡 cross-device FAIL로 기능 전체 완료 및 TEST 승격 차단. 좋아요 app160/Worker195 사용자 확인 동결 유지. 이번에는 문서 기록만; 코드/배포/사용자 데이터 변경 없음.

## 0FU. app162 후속 ‘가사 언어 추가’ 실사용 — 영어 카드 제목 미번역 / 약 1분 이상 소요 (2026-09-25 KST)

**사용자 추가 피드백**: 기존 한국어 제목 곡의 ‘가사 언어 추가’에서 영어를 선택했다. 추가 가사 생성에 1분 조금 넘게 걸렸고, 영어용 결과에 **영어 제목이 나오지 않았다**. ‘처음 곡 생성’은 0FT의 1곡 성공을 유지하나 **후속 언어 추가의 제목·속도까지 PASS라고 처리하면 안 된다**.

**현재 UI 안내의 의미**: ‘현재 곡의 제목과 가사를 기준으로 추가 언어 가사를 생성합니다’는 원곡 제목과 가사를 입력 맥락으로 사용한다고 설명한다. 이 문구만으로 원곡 제목 자체가 영어로 변경되도록 설계됐다고 단정하지 않는다. 사용자 기대는 원곡 한국어 제목 보존 + 추가한 영어 가사 카드의 영어 제목 제공이므로, 두 제목의 역할/데이터 흐름을 구분해서 확인한다.

**다음 초점**: 읽기 전용으로 (a) 추가 영어 가사 Gemini 요청이 영어 제목도 요구하는지, (b) 응답에 영어 제목이 왔지만 카드/로컬 저장이 기존 원제만 표시하는지, (c) 별도 제목 변환이 빠진 것인지, (d) 후속 추가 가사 요청의 모델별 시간/호출 및 토큰 비용을 조사한다. 같은 영어 가사 요청에 제목 출력을 함께 담을 수 있으면 추가 API 호출 없이 해당 영어 카드에만 적용하고 원본 한글 제목·원본 가사·기존 좋아요·다른 카드/섹션/음악 API를 보호한다. 새 별도 Gemini 요청을 무단 추가하지 않는다. 실제 원인 확인 전 임의 수정·재배포 금지. 이 문서 업데이트는 기록일 뿐 앱·Function/사용자 데이터 변경 없음.

## 0FT. 사용자 app162 첫 V1 실사용 **곡 생성 완료 PASS** — 3.5 Flash-Lite 성공, 3.6/3.5 실패 잔존 (2026-09-25 KST)

**사용자 제공 관리자 Gemini 호출 기록 스크린샷 (09.25 오전 01:31:43 KST 세션)**: `[Classic City Pop] 어린 새벽에 닿을 때`, 작업 상태 **완료**, 전체 **1분 17초**, 물리 호출 **3회**(추가 2회), 성공 모델 **gemini-3.5-flash-lite** 46.6초. 성공 응답 감사 사용량: 입력 **25,946**, 출력 **2,891**, 추론 **2,344**, 전체 **31,181** token. 생성 전 모델 목록 5개 모두 `목록에 있음`을 사용자가 관리자 화면에서 직접 확인(생성 요청 없이 수행). 기존 app161 3분49초 / 5모델 전부 실패와 달리 **곡 결과가 처음으로 실사용 완료**.

**같은 세션의 실패 (지우거나 성공으로 합산 금지)**:
1. `gemini-3.6-flash`: 4.1초, `Gemini stream reported an error`, usage 0으로 표시. 정확한 provider error code/원인 미확인.
2. `gemini-3.5-flash`: 20.9초, `Gemini interaction failed (503)`, usage 0으로 표시. 원격 503 원인 미확인.
3. `gemini-3.5-flash-lite`: 46.6초, 정상 완성. 위 성공 usage는 해당 응답의 관리자 수치이며 실패 2회가 과금되지 않았다는 증거는 아님.

**판정**: app162 `store:false + stream:true` 경로가 **실제 계정 1곡에서 완성 응답을 반환**했고, 기존 전체 실패를 재현하지 않은 유의미한 개선. 그러나 스트리밍 도입이 앞의 3.6/3.5 provider 오류를 제거한 것은 아니며, **모든 모델의 안정화 / 반복 성공 / 비용 안정성은 미검증**. 관리자 작업 상태 `완료` 및 제목은 확인되지만 최종 가사의 실제 언어·금지어·섹션·5단 productionPrompt 각 항목 및 1,000자 제한을 스크린샷만으로 개별 감사한 것은 아님. 성공 모델을 1순위로 자동 재배치하거나 기존 프롬프트/후처리 정책을 바꾸지 않는다.

**운영 결정**: 정상 성공 경로 보존. 사용자의 추가 오류 제보가 없다면 Gemini 모델 순서/timeout/SSE parser를 즉시 다시 수정하지 않는다. 만약 다음 곡에서 오류가 재현되면 해당 1세션 provider/stream error만 안전하게 추적. API 키·프롬프트·가사 원문을 CI/로그에 남기지 않는다. 최종 품질 수용 후에만 TEST 승격을 검토하며 TEST 배포와 PRODUCTION은 별도 사용자 승인 필요. **좋아요 app160/Worker195 동결 유지**. 이번 갱신은 문서뿐이며 새 앱·Function·Worker 배포/데이터 변환 없음.

## 0FS. Gemini app162 / store=false SSE + 인증 모델 목록 진단 PREVIEW 배포 완료 — 실제 사용자 확인 전 (2026-09-25 KST)

**목표와 사용자 승인**: app161에서 최초 Gemini V1 1곡이 3분49초/5회/0 usage로 실패했고, 사용자 2026-09-25 00:57 KST 승인에 따라 기존 동기 Interactions 60s 연결 회귀 후보를 검증/수정. 좋아요 기능 전체 동결 유지. API 키·프롬프트 원문 로그 없음.

**소스 후보 및 결과**:
- `functions/src/index.ts`: 원래 `POST /v1beta/interactions` 동기 JSON의 `store:false`를 **그대로 보존**하며 `stream:true` SSE로 변경. Google 공식 event 계약에 맞춘 `functions/src/geminiInteractionSse.ts` 수신기에서 model_output text delta만 연결하고 `interaction.completed` 확인 후에만 결과와 최종 usage를 반환. 중간 단절/오류/빈 본문/과도한 길이는 성공으로 처리하지 않는다. `background:true` 미사용.
- `functions/scripts/apply-gemini-latency.cjs`: 기존 Function hard timeout 330s 아래에서 300s 총 요청 budget + 10s headroom과 모델별 남은 budget clamp 적용. 5 physical call ceiling 유지. 3.6/3.5/Lite 기존 승인값 120/90/75s, 후처리 품질/가사/언어/섹션/5단 규칙 변화 없음.
- `functions/src/index.ts`에 기존 Auth/AppCheck 및 admin/master 확인을 거쳐, 사용자의 서버 저장 API 키로 Google `models.list`만 GET하는 **읽기 전용** diagnostic branch 추가. 기존 `src/pages/AdminGeminiAuditPage.tsx` 헤더에 ‘모델 목록 확인’ 버튼 1개 추가, `geminiProxyClient.ts`는 해당 버튼 동작에서만 PREVIEW Function 호출. key/uid/raw provider 목록·프롬프트 응답 출력 금지, 고정된 5모델의 목록 등재 여부만 반환. 모델 목록에 있어도 실시간 가용성·일일 한도·생성 성공은 보장되지 않음.
- `public/app-version.json=162`. 기존 좋아요 서비스/Worker195/RTDB/Rules/D1/R2/Music Note/UI 일반 영역은 비변경. 관리자 Gemini 감사 페이지 버튼만 요청 범위 내 추가.

**자동 검증**: Gemini SSE 한국어 UTF8 분할·완전 종료·usage·중간 오류·미완료·스트림 단절·잘못된 JSON·대형 프레임·store=false/background 불변 모의 9/9 PASS (`36025274261`). Gemini Function Source Audit `36026405886` SUCCESS (Functions TypeScript/build 및 모델 진단 경로). Release System Audit `36026316178` SUCCESS (app TypeScript/Build, 기존 Gemini 규칙·좋아요 등 회귀, TEST/PROD read-only·dry-run). 첫 소스 Audit 실패는 TS unused helper 및 잘못된 regex와 진단 verifier 변수 중복을 각 최소 수정하고 최종 PASS.

**실제 PREVIEW 배포**:
- PREVIEW Gemini Function 릴리스 `36026587156` SUCCESS: store=false SSE/300s budget/readonly models.list source checks/모의 9 PASS, active Function updated PASS, nodejs22, CORS PASS, shared `generateGeminiContent` unchanged PASS. 중간 SSE 단독 선행 PREVIEW Function 배포 `36025630447` SUCCESS.
- app162 Firebase PREVIEW Hosting `36026936663` SUCCESS: exact SHA `b0454c28ba12ad3b233292c3e467b52037d11383`, TypeScript/Build, `PREVIEW_APP_VERSION=162`, exact build PASS, TEST/PRODUCTION unchanged PASS, shared RTDB rules deploy SKIPPED.
- 최종 제품 source는 `9755c7b62cb01e60696d2542b6495084f575ec0d` (이후 release-trigger SHA와 문서 SHA 구별). Cloudflare Worker195 `11d8455c-c266-4e88-9cf6-7549d3f5be92` 불변. 사용자 원본 migration/backfill/데이터 변경 없음.

**남은 최종 게이트**:
1. **아직 사용자의 인증 모델 목록 조회 실행 기록 없음**: 기존 관리자 Gemini 호출 기록 화면 → ‘모델 목록 확인’ **한 번** 클릭 → 표시되는 모델 5개의 ‘목록에 있음/없음/확인 보류’ 또는 오류 코드 확인. 이 요청은 생성 토큰 0, Auth/AppCheck·서버 키 보호. 계정의 실제 모델 가용성 조회를 수행했다고 보고하지 않는다.
2. 그 결과를 보고 이용 가능 모델이 적절할 경우에만 PREVIEW 일반 V1 1곡을 1회 검증. 최초 본문→금지어/언어/섹션→최종 5단 작곡 명령 및 1000자 제한 PASS 전까지 **곡 생성 해결 완료라고 말하지 않는다**. 실제 60초대 503이 streaming으로 사라지는지도 미확인. 추가 호출 반복 금지.
3. TEST/PRODUCTION 승격·좋아요 수정 금지. 진단 workflow의 별도 push 실패는 기존 maintenance debt; 릴리스 감사와 분리.

공식 근거: https://ai.google.dev/gemini-api/docs/streaming 및 https://ai.google.dev/api/models 및 https://ai.google.dev/gemini-api/docs/background-execution .

## 0FR. app161 V1 실사용 FAIL — 3분49초·전 모델 실패, 60초 연결 마감과 데이터 보관 선택지 발견 (2026-09-25 KST)

**사용자 보고 (09.25 오전 12:16:26 KST 세션)**: PREVIEW app161 초기 곡 생성 총 3분49초 / 5 physical attempts / 관리자 화면 usage input/output/thought/total 전부 0 / 최종 HTTP 503 GEMINI_UPSTREAM_UNAVAILABLE. 3.6=1분02초 “일시 unavailable”, 3.5=1분30초 “시간 초과 중단”, 3.5-lite=1분06초 “일시 unavailable”, 3.7=1.0초 unavailable, 3.8=1.1초 unavailable. **사용자에게 재생성 요청 금지**. 초기 곡 생성 미완료, 후처리 미도달. app161 장시간 확대는 실사용에서 FAIL. 자동 테스트 PASS와 실생성 PASS를 혼동하지 않는다.

**기존 수정 평가**: 3.5의 90초는 로컬 제한과 일치. 3.6·lite의 약 60초대는 120/75초 로컬 제한 전에 provider가 503을 보낸 케이스로, 시간만 늘린 수정은 유효한 해결책이 아님. 최초 3.6의 40.2초 과거 성공은 전체 성공의 증거가 아니었다. 3.8/3.7은 현재 해당 키/세션에서 1초 503. 모델 ID 자체는 공식 Gemini model catalog에 존재하지만 **사용자의 해당 API 프로젝트에서 실제 이용 가능한지 검증되지 않음**.

**공식 문서로 새로 찾은 원인 후보**:
- Google Gemini Interactions 표준 HTTP는 일반적으로 약 60초에 닫힐 수 있고, 장시간 요청은 `background=true` + interaction ID 상태 조회를 안내한다. 현재 SORIDRAW `functions/src/index.ts`의 `callGeminiInteraction`은 `store:false`로 단일 동기 `POST /v1beta/interactions`만 호출한다. 3.6·lite 약 60초의 503이 이 연결 마감과 관련 있는지 *강력한 후보*이나, 사용자 요청의 원시 provider status/headers가 없으므로 100% 단정 금지.
- **중요 데이터 보관 충돌**: Google 공식 Interactions overview에 따르면 `store=false`는 `background=true`와 호환 불가. background로 바꾸면 모델 요청/응답의 Google 서버 보관 (무료 1일 / 유료 55일; 유료 설정에서 7/14/28/55일 단축 가능) 동작이 변한다. 현 `store:false`를 몰래 제거하거나 `background:true`를 켜지 말 것. 사용자 승인과 정보보호·비용 검토 필요.
- `503`은 provider 일시 과부하/불가, `429`는 quota 별도. background로 바꿔도 실제 용량 부족/계정 접근 불가까지 해결되는 것은 아니다.

**다음 개발**: 추가 실사용 생성 전에 한 번의 **비생성·읽기전용** 진단으로 (a) 실제 Gemini 응답 status/details·timeout vs HTTP 연결 마감, (b) 사용자 키 소속 프로젝트의 모델 이용권한과 한도, (c) `store:false` 보존 가능한 스트리밍/기존 `generateContent` 장시간 대응과 background 저장 동의 모델을 비교. 프롬프트/개인 API 키/UID의 공개 로깅 금지. 유효한 모델+보관 정책을 확정하고 최소 코드를 새 후보로 감사→PREVIEW 1곡 검증. **현재 Gemini 수정·배포 없음**. 좋아요 app160/Worker195 동결, TEST/PROD 변경 금지.

공식 근거: https://ai.google.dev/gemini-api/docs/background-execution 및 https://ai.google.dev/gemini-api/docs/interactions-overview 및 https://ai.google.dev/gemini-api/docs/troubleshooting .
## 0FQ. Gemini app161 + PREVIEW Function 배포 완료 — 최초 생성 우선순위/시간 변경, 실사용 검증 대기 (2026-09-25 KST)

**실제 기준**: `preview` 기능 소스 `3587d81e957bb18702037811668c5d83c6c7c17c`, 최종 verifier `576963c772198068964c863d37c1c2251c950fff`, PREVIEW Function 릴리스 트리거 `78bb600ecc5246b115189556190adff061aae7a4`, Hosting 트리거 `0e5bdac4792954cb194b19907c063c702bf71e79`. 이 섹션의 문서 저장 commit은 제품 코드와 다른 기록용 SHA이다.

**사용자 승인 적용**: 초기 일반 V1 곡 생성 모델 순서를 `3.6→3.5→3.5-lite→3.7→3.8`로 변경하고, 초기 `3.6=120초, 3.5=90초, 3.5-lite=75초`로 늘림. 3.7=55초, 3.8=35초, Function 전체 330초, 총 5 physical calls, daily quota, low-thinking, fast repair의 별도 제한, 5단·가사·금지어·언어·섹션 규칙 변경 없음. `public/app-version.json=161` 외 UI/좋아요 실행 코드/Worker/RTDB/D1/R2/Rules 비변경. `scripts/verify-192-cross-account-public-like-live.mjs`의 정확히 160 버전 고정 검사만 161 이후에도 검증하도록 완화; 실제 좋아요 경로 수정 없음.

**감사·배포**:
- Gemini Function Source Audit `36017422013` SUCCESS (Functions Build / 새 initial model order / timeout / Interactions route / 5회 상한).
- Release System Audit `36017538500` SUCCESS (TypeScript, Build, Gemini prompt/cue·hard-ban, 좋아요·Music Note 등 회귀, TEST/PRODUCTION Worker dry-run, shared D1 read-only). 초기 Audit 2건은 앱 버전 161을 `160`으로만 확인하는 과거 좋아요 테스트 문구 때문에 static 단계 FAIL했으나 좋아요 실행 코드는 비변경이고 테스트 버전 조건 정정 후 최종 PASS.
- Firebase PREVIEW Gemini Function Tune `36017885707` SUCCESS: 변경 Function 업데이트, nodejs22, CORS PASS, shared TEST/PRODUCTION `generateGeminiContent` unchanged PASS. Firebase artifact cleanup policy 경고는 존재했으나 Function ACTIVE/업데이트 검증 완료.
- Firebase PREVIEW app161 Hosting Run `36018252541` SUCCESS: TypeScript, Build, `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=161`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`; shared RTDB rules deploy SKIPPED.
- Cloudflare Worker195 active `11d8455c-c266-4e88-9cf6-7549d3f5be92` 유지. Functions 중 PREVIEW Gemini만 변경. 사용자 원본 마이그레이션/복사/재작성 없음.

**실사용 게이트**: 1회 일반 V1 곡 생성의 초기 본문 → 후처리 → 최종 작곡 명령/가사 완전 성공은 **미검증**. 기존 3.6 약 60s 실패는 provider deadline인지 과거 실제 deployment 차이인지 확정 안 됐으며, Google 503 가용성 문제는 앱 설정만으로 해결 보장 불가. 총 이론적 개별 timeout 합계 375s가 Function 330s를 넘으므로 후순위 모델 시간 확보가 보장되지 않는다. 먼저 app161 실제 1곡 결과/관리자 Gemini 기록으로만 판단; 반복 생성 금지. 좋아요 기능 동결 유지. TEST/PRODUCTION 승격 금지.

## 0FP. Gemini initial V1 모델 순서·응답 시간 PREVIEW 후보 app161 (2026-09-25 KST)

**사용자 승인**: 2026-09-24 제공된 5-call, 전부 0 usage 실패를 바탕으로 제안한 두 설정 변경을 적용해 PREVIEW에서 검증. 다른 기능/좋아요 완전 동결. `preview` 기능 기준 시작 `5b95b2095123e7b513fdd74eb7230e2fa42be899`.

**후보 최소 diff**:
- `src/services/geminiProxyClient.ts` initial song 체인만 `3.6 → 3.5 → 3.5-lite → 3.7 → 3.8`로 순서 변경. languageMix / fast repair / 기존 5 physical call ceiling/쿨다운 그대로.
- `functions/scripts/build-secured-index.cjs` initial timeout만 `3.6=120s / 3.5=90s / 3.5-lite=75s`. `3.7=55s, 3.8=35s`, 별도 fast repair timeout, Function 전체 330s 동일.
- `public/app-version.json` app161. 기존 `verify-preview-gemini-function-source.yml` assertion 변경된 값에 맞게 정정.

**제약**: 사용자의 실제 3.6 60초 timeout은 기존 설정 90초와 다르므로 provider deadline 여부가 확정되지 않았고, 503 overload는 앱 설정만으로 보장해 해결할 수 없다. 최악 5개 시도 상한 합계(120+90+75+55+35=375s)는 Function 330s보다 크므로 후순위 모델이 전체 실행 제한에 못 미칠 수 있다. 실제 1곡 성공 전 “해결” 선언 금지. quota, 프롬프트/5단/금지어 품질 기준/개인 좋아요 로직 비변경.

**진행 게이트**: 새 verifier + TypeScript/Build + Function source audit + Release System Audit PASS 후 PREVIEW Function/Hosting만 고정 배포. 실제 원격 revision/app161 및 TEST/PROD 비변경 확인. 지금은 **코드 후보만**, 배포/실기기 미검증.

## 0FO. Gemini PREVIEW V1 실제 1곡 재현 FAIL — 최초 생성 전부 0 token, provider 503 및 60초 timeout (2026-09-24 KST)

**사용자 제공 관리자 화면 / 실행시각**: 2026-09-24 23:38:53 KST, 일반 V1 곡 생성, 총 2분 53초, 추가 호출 4회 / 총 5 physical attempts. **입력 0, 출력 0, 추론 0, 전체 0** 표시는 현재 감사 화면이 수집한 usage 기준이며 실제 미청구를 뜻하지는 않음. 최초 생성 5회 모두 FAIL, 후처리·금지어 판정 단계까지 가지 못함.

| 순서 | 모델 | 관리자 화면 시간 | 결과 |
|---|---|---:|---|
| 1 | gemini-3.8-flash | 1.2초 | “현재 요청이 몰려 일시적으로 사용할 수 없습니다” (503 계열) |
| 2 | gemini-3.7-flash | 1.0초 | 동일 임시 unavailable |
| 3 | gemini-3.6-flash | 1분 0초 | “응답 시간이 초과되어 요청이 중단되었습니다” |
| 4 | gemini-3.5-flash | 1분 0초 | 동일 timeout |
| 5 | gemini-3.5-flash-lite | 10.7초 | 임시 unavailable, 최종 HTTP 503 `GEMINI_UPSTREAM_UNAVAILABLE` |

**중요 원인 구분**: 이것은 가사·5단·금지어 품질 기준에 걸린 게 아니다. **모델로부터 생성 본문을 한 번도 받지 못했다.** Google 공식 2026-09 현재 Interactions API는 위 5개 모델 ID를 지원. 공식 API 에러 문서의 503은 용량 부족/일시 장애, 504는 마감시간 초과이며 429는 quota 별도. 이 화면의 마지막 503을 일일 한도라고 단정하지 말 것. 기존 사용 기록에 3.7 quota exhaustion이 있었으나 이번 세션 첫 두 건은 ‘일시 unavailable’ 화면임.

**정밀 추가 확인 필요**: GitHub 현재 `functions/scripts/build-secured-index.cjs`가 생성하는 PREVIEW Function policy는 `3.6=90_000` / `3.5=60_000` / `3.5-lite=60_000`, Function `timeoutSeconds=330`. 그런데 실사용 3.6의 표시 시간이 약 **60초**이므로, 이것이 Google provider 60s deadline인지, 실행된 Functions revision의 실제 timeout 정책과 코드가 다른지, 감사 UI 시간 반올림인지 **아직 확인 불가**. 3.5=60초는 현재 자체 timeout과 일치. `functions/src/index.ts`는 생성기 이전 원본이므로 timeout 상수를 포함하지 않으며, `securedIndex.ts`는 build-time 생성. 해당 파일만 보고 “제한 없음”이라고 오판 금지.

**다음 수정 조건**: 먼저 기존 인증 세션의 원본 statusCode/code/errorName/retryAfterMs/attempt duration 및 Function active revision을 안전하게 대조. 사용자 API 키·UID·프롬프트를 로그에 공개하지 않는다. 실제 실패가 Google 503이면 대기·과도하지 않은 bounded retry와 사용 가능한 모델 선택을, self-abort면 해당 최소 제한만 조정. 프롬프트·품질·언어·섹션·금지어 계약 약화는 이번 오류 해결책 아님. 5 attempts/Function 330s/정상 좋아요 동결 보호. 같은 곡 무작정 재생성 금지. **이번에는 진단 기록만, 코드·Function 배포 없음**.

## 0FN. Gemini V1 곡 생성 미완료 작업 재개 — 좋아요 동결 유지 (2026-09-24 KST)

**사용자 최신 지시**: 좋아요 app160/Worker195 전체 정상 실기기 PASS 이후 좋아요 코드/서비스 동결 유지. 중단됐던 Gemini 곡 생성 장애를 다시 우선 작업으로 재개. 좋아요 관련 코드/Worker/RTDB/D1/R2/UI/Rules 수정 금지. 이 항목은 조사·실사용 검증 재개 기록이며 Gemini 코드 변경/배포 승인이 아니다.

**확인된 마지막 실제 Gemini 릴리스**: app153에서 금지어 후처리의 `gemini-3.5-flash-lite` 단일 모델 강제를 원복하여 shared fallback 복구, Hosting Run `35887028650` SUCCESS. PREVIEW Function Tune Run `35888544983` SUCCESS / `PREVIEW_GEMINI_FUNCTION_UPDATED` PASS / `SHARED_GEMINI_FUNCTION_UNCHANGED` PASS / PREVIEW CORS PASS. 현재 PREVIEW Hosting app160은 이후 좋아요 작업으로 배포됐으나 Gemini 기능이 실사용 완전 성공했다는 근거는 없다.

**마지막 확정 실패**: 처음 Gemini V1 본문이 3.6에서 40.2초 만에 생성된 적은 있지만 금지어 후처리가 lite 모델 20초 timeout으로 실패했다. 다른 세션에서는 3.8/3.7 daily quota cooldown skip, 3.6 약 66초 뒤 provider unavailable, 3.5/3.5-lite 각각 20초 앱 자체 timeout으로 실패. 따라서 최초 성공 ≠ 전체 생성 성공. 이때 3.5 계열 20초 self-abort를 보완한 PREVIEW Function 최신 설정은 3.6=90s, 3.5=60s, 3.5-lite=60s, Function=330s. 모델 순서/총 5 physical attempts/low-thinking/daily quota cooldown/5단 prompt/가사·금지어·언어·섹션 규칙은 그대로.

**다음 정확한 검증 1단위**: 사용자의 인증된 PREVIEW 계정에서 **일반 V1 1곡만** 생성. 관리자 기존 Gemini 기록으로 (1) initial model/실제 provider status/초 단위 elapsed/input-output token, (2) hard-ban/언어/섹션 후처리 결과, (3) 최종 5단 productionPrompt·가사·section cue 정상 여부, (4) 진짜 완전 성공 여부를 대조한다. 성공이면 별도 수정 없이 안정화 기준 기록. 실패면 해당 한 세션의 실제 provider quota/unavailable vs 앱 timeout vs 후처리 실패 구간만 읽기전용 진단. 반복 생성·timeout 무작정 확대·모델 순서/프롬프트 임의 변경·좋아요 재수정 금지. TEST/PRODUCTION 미승격 유지.

## 0FM. 사용자 실기기 PASS — 좋아요 기능 보호·수정 동결 (2026-09-24 KST)

**현재 최우선 사용자 지시**: app160 + Worker195 PREVIEW에서 같은 계정 PC↔모바일 및 서로 다른 계정 A↔B의 좋아요/해제, 공개 숫자, 계정별 하트가 **모두 정상 동작함을 사용자가 직접 확인했다.** “이젠 이상이 없다면 절대 좋아요 기능에 손을 대지마.” 따라서 **좋아요 기능은 동결(FROZEN)**. 별도 실제 오류 재현·보안 사고·사용자의 명확한 수정 지시가 없으면 좋아요 관련 클라이언트·Worker·RTDB·D1·R2·캐시·리비전·동기화·배치·타이머·UI를 수정하거나 배포하지 않는다. 다른 기능의 리팩터링/비용 최적화 명목으로 좋아요 경로를 변경하는 것도 금지. 우연히 공통 파일이 변경되어도 좋아요 동작 동일성을 검증하고, 영향이 있으면 중단한다.

**고정된 PREVIEW 릴리스**: app160 Hosting Run `36004777915` SUCCESS / exact build PASS. Worker195 Run `36010156194` SUCCESS, active version `11d8455c-c266-4e88-9cf6-7549d3f5be92`; 최종 Audit `36009942860` SUCCESS. 제품 코드 핵심 커밋: app160 `2dfc167668a7640a16e97fe582960d224aab5d25`, Worker194 `071d82bbad1c9b0bc35ca459a15965b103a84c5c`, Worker195 `29f0def57c0fca962596d9be2d3d46f9d4b2d061` + verifier `90701f73f22736ec4bd12faa0921d39e091abc11`. 이 기록 이후 문서-only 커밋이 있을 수 있으니 앱 기준과 GitHub HEAD를 혼동하지 않는다.

**반드시 보호할 실제 동작**: 클릭 즉시 자기 하트 표시, 30초 trailing batch, 로컬 outbox, 본인 PC↔모바일 동기화 및 내 좋아요 일치, A의 변경에 따른 B의 공개 숫자 자동 갱신(페이지 이동/새로고침 불필요), B 개인 하트 독립, 좋아요/해제 양방향, 변경된 곡만 재확인. 이벤트가 이미 접수된 뒤 Worker가 약 5초 window에서 처리하며 오래된 alarm/timing race 복구. 정상 재진입 원본 D1 R0 목표 / public changed-card 3곡 route 실제 D1 R0/W0 PASS. 일반 업데이트/이동으로 전체 데이터 재조회·전체 Feed 재생성 금지.

**검증 경계**: 위 전체 실기기 PASS는 사용자의 직접 확인이며 자동화된 다계정 E2E로 대체·증명된 것은 아니다. 실제 신규 W1~W2 mutation 물리 비용 계측은 마지막 Audit에서 SKIPPED였으므로 수치 PASS라고 쓰지 않는다. TEST/PRODUCTION 릴리스는 아직 자동 승격되지 않았고 **별도 요청**이 있어야 하며, 승격 시 검증된 좋아요 코드/Worker/Rules의 동일 동작을 포함해야 한다. 사용자 데이터 원본 복사·변환 없음.

**영구 재사용 기준**: `.agents/skills/local-first-like-sync/SKILL.md`와 `references/soridraw-app160-worker195-frozen.md` (app141은 같은 계정 개인 동기화의 역사적 검증 기준). 동결 해제는 오류의 구체적 증거 + 사용자 승인 + 범위 고정 + 독립 회귀 + PREVIEW 실기기 재검증 순서로만 가능. 이 스킬은 보존 문서이지 자동 배포 명령이 아니다.

## 0FL. app160 + Worker195 PREVIEW — stale queue + 교차계정 전달 race 방어까지 배포 완료 (2026-09-24 KST)

**현재 실제 PREVIEW**: app160 Hosting Run `36004777915` SUCCESS / exact build PASS. Worker195 Release Run `36010156194` SUCCESS / active version `11d8455c-c266-4e88-9cf6-7549d3f5be92`. Worker195 최종 Audit `36009942860` SUCCESS. URL `https://preview.soridraw.com/`. TEST/PRODUCTION Worker unchanged PASS. Functions/Firestore rules/D1 schema/user-data migration 없음.

**Worker194 이후 추가로 막은 race**:
- Worker194는 stale Durable Object alarm이 새 좋아요 batch를 영구 대기시키는 실제 문제를 수정했다.
- 그 후 코드 검토에서, aggregate가 끝난 직후 `pending=false`를 확인한 다음 active marker를 지우는 아주 짧은 구간에 새 batch가 합류하면 그 batch가 다음 window를 예약하지 못할 수 있는 join race가 남아 있음을 확인했다.
- Worker195는 현재 window의 active marker를 먼저 해제한 뒤 indexed `069 LIMIT 1` pending 확인을 수행한다. marker 해제 전 들어온 batch는 최종 pending query에 포함되고, marker 해제 후 들어온 batch는 스스로 다음 active owner가 된다. 이미 새 owner가 잡혔으면 기존 window가 그 deadline을 덮어쓰지 않는다.
- 이 수정은 fixed polling/전체 Feed 재조회/사용자 데이터 재작성 없이 event-driven changed-data 경로만 건드린다.

**실제 릴리스 결과**:
- 첫 Worker195 배포 시도 Run `36009834733`은 오래된 verifier 문구가 새 scheduler 구조를 못 알아봐 **preflight에서만 FAIL**, Worker 배포 자체는 시작되지 않음. verifier만 현재 구조에 맞춘 뒤 Audit `36009942860` SUCCESS.
- 최종 Worker195 release predeploy `pending069=0`.
- Feed smoke PASS / Profile smoke PASS.
- public changed-card 실제 3곡 PASS / D1 R0 W0.
- warm revision D1 R0 W0.
- fixed cron clear PASS / event scheduler deploy PASS.
- TEST/PRODUCTION Worker unchanged PASS.
- 최종 active PREVIEW Worker version `11d8455c-c266-4e88-9cf6-7549d3f5be92`.

**현재 사용자 실사용 기대**:
- 같은 계정 PC↔모바일 개인 하트는 기존 개인 동기화 경로.
- 다른 계정은 개인 하트를 공유하지 않고 **공개 숫자만** 변경.
- 마지막 클릭 후 기존 30초 client 묶음 + 약 5초 Worker window를 거쳐, 페이지 이동/새로고침 없이 다른 계정 열린 Explore에서 같은 곡 공개 숫자가 수렴해야 한다.
- app160의 server-clock invalidation, RTDB array/object decode, merged bus row 보존과 Worker195 queue scheduler가 함께 적용된 상태다.

**남은 최종 게이트**: 실제 A/B 다른 계정 PC·모바일에서 좋아요→해제→역방향 좋아요를 반복하여 숫자가 자동 수렴하고 각 계정 하트는 독립인지 사용자 실기기 확인이 필요하다. 이 결과 전에는 “전체 해결 완료” 또는 TEST 승격으로 처리하지 않는다.

## 0FK. app160 + Worker194 PREVIEW 배포 — 교차 계정 좋아요 실시간 전달의 실제 대기열 정체 원인 수정 (2026-09-24 KST)

**현재 실제 PREVIEW**: app160 Firebase Hosting Run `36004777915` SUCCESS / `PREVIEW_APP_VERSION=160` / exact build PASS. Cloudflare Worker194 Run `36009078881` SUCCESS / active version `554dbf4d-aa0b-4c2e-b3f2-a120d3019fda`. Worker194 source audit Run `36006077948` SUCCESS. URL `https://preview.soridraw.com/`. TEST/PRODUCTION Hosting/Worker unchanged PASS. Functions/Firestore rules/shared D1 schema/user-data migration 없음.

**이번 실증에서 확인된 실제 문제**:
- app159/Worker192 소스의 정적 검증은 PASS였지만, 후속 Worker193 release Run `36004778161`에서 배포 직전 `explore_like_batches_069`에 실제 pending 3건이 남아 있었다.
- 새 Worker 배포 뒤 임시 1분 cron으로 기존 queue를 깨웠을 때 1~23회 확인 동안 계속 3건이었고, 24번째 확인에서야 0이 됐다. 즉 사용자 클릭이 W1 queue에 접수된 뒤 event-driven Durable Object가 실제로 제때 drain하지 못하는 경우가 있었고, 이는 “다른 계정이 서로 반응하지 않는다”는 실사용 증상과 직접 연결되는 서버 측 증거다.
- Worker194는 기존 alarm이 남아 있다는 이유만으로 새 batch가 영구적으로 그 alarm을 신뢰하지 않도록 했다. 실제 새 batch 요청이 들어오면 짧은 active marker만 인정하고, 오래된 marker/alarm은 정리한 뒤 5초 coalescing window를 현재 Durable Object 요청이 직접 실행한다. fallback alarm은 실패 시에만 남으며, 이후 실제 새 batch가 다시 takeover할 수 있다. fixed periodic cron은 여전히 0.
- app160은 공개 like invalidation의 시각을 브라우저 `Date.now()`가 아니라 Worker가 batch를 정상 접수한 서버 시각으로 전달한다. 따라서 PC/모바일 기기 시계 오차 때문에 receiver가 R2 card를 “아직 오래된 값”으로 오판해 최대 retry 후 포기하는 경로를 제거했다.
- RTDB `publicSync/exploreLike`의 `rows`는 SDK가 array 또는 numeric-key object로 복원해도 둘 다 읽는다. 또한 하나의 merged public bus에서 마지막 writer의 `actorUid`가 현재 계정과 같더라도 다른 계정의 row가 함께 남아 있을 수 있으므로 payload 전체를 버리지 않고 track별 accepted-at token으로 중복만 제거한다. 이 공개 신호는 개인 filled-heart를 변경하지 않는다.

**배포 검증**:
- Worker194 release predeploy pending069=0.
- Feed smoke PASS / Profile smoke PASS.
- `/v1/public-like-cards` 실제 3곡 반환 PASS, D1 R0/W0 PASS.
- warm `feed-revision` D1 R0/W0 PASS.
- event scheduler 배포 PASS, fixed cron clear PASS.
- TEST/PRODUCTION Worker unchanged PASS.
- app160 TypeScript/Build/Hosting exact build PASS, TEST/PRODUCTION unchanged PASS.
- 이전 Worker193 배포에서 stale queue 3건은 canonical scheduled path로 drain되어 0이 된 상태이며 사용자 원본을 강제 재작성하지 않았다.

**현재 최종 게이트**: 서버에서 확인 가능한 두 개의 구체적 실패 원인(대기열 stale alarm, 기기간 clock-domain freshness)과 merged RTDB row 유실 가능성을 수정·배포했다. 그러나 실제 A/B 다른 계정 PC·모바일에서 새 좋아요/해제 후 페이지 이동 없이 공개 숫자가 수렴하는지는 **사용자 실기기 검증 전**이다. 정상 기대 시간은 마지막 클릭 후 기존 client 30초 idle batch + Worker active 5초 window 정도다. B의 개인 하트는 B가 직접 누르지 않았다면 변하면 안 된다. 이 검증 전 TEST 승격 금지.

## 0FJ. app159 + Worker192 PREVIEW 배포 — 교차 계정 공개 좋아요 숫자 변경분 동기화 (2026-09-24 KST)

**현재 실제 PREVIEW**: 앱 app159, Hosting/RTDB Run `36001464002` SUCCESS / `PREVIEW_APP_VERSION=159` / exact build PASS / shared RTDB rules exact match PASS. Cloudflare Worker192 Run `36000021648` SUCCESS / active version `d6c6e3db-207f-4d60-969f-eae6a0fd2126`. 최종 Release System Audit `36001252527` SUCCESS. URL `https://preview.soridraw.com/`. TEST/PRODUCTION code/Hosting/Worker 비변경 PASS. Functions/Firestore rules/D1 schema/user-data migration 없음.

**이번에 해결한 범위**:
- A가 좋아요/해제를 하면 A 화면의 개인 filled-heart는 기존 local-first/같은 UID 신호를 유지한다. 다른 계정 B/C의 개인 하트는 절대 A 상태를 상속하지 않는다.
- 30초 client batch가 W1 queue에 정상 접수된 뒤, Worker192의 event-driven DO가 약 5초 후 변경분을 처리한다. 공개 Feed/latest/popular/profile/track-card는 **변경된 곡만** shared R2에 맞춘다.
- A의 batch ACK 후 RTDB `publicSync/exploreLike`에는 count가 아니라 **변경된 trackId/ownerUid/시각만** 최대 50개까지 신호로 보낸다. B/C는 현재 화면에 보이는 변경 곡만 `/v1/public-like-cards`에서 shared R2 카드로 확인하고 public `likeCount`만 갱신한다. endpoint는 D1 R0/W0, retry 최대 4회, idle polling 0.
- RTDB rules는 인증 사용자만 read, writer의 `actorUid===auth.uid`, row key 0~49, 허용 필드만 검증. Firebase CLI의 shared-instance metadata 제약을 피하고 기존 093에서 검증된 official RTDB REST rules PUT 경로로 배포했으며 실제 remote rules와 `database.rules.json` exact match 확인.
- Worker192 배포 과정에서 기존 canonical generated Worker에 남아 있던 escaped newline 때문에 scheduled aggregate의 `owner` 선언이 주석 처리되는 latent bug를 실제 `ReferenceError: owner is not defined`로 확인하여 수정/repin/regression 추가. 최종 배포 전 pending069=0 확인 후 Worker192 유지.

**실제 서버 검증**: Audit `36001252527`에서 latest 37곡 overlap `COUNT_MISMATCH=0`, popular 37곡 overlap `COUNT_MISMATCH=0`, D1 canonical↔derived mismatch `0`, shared R2 canonical mismatch `0/74`. Worker release smoke에서 public changed-card 3개 반환 PASS, 해당 route D1 R0/W0, Feed/Profile smoke, warm revision R0/W0, TEST/PRODUCTION Worker unchanged PASS.

**현재 합격선 / 남은 실사용**: 서버 공개 숫자 원본/공유 R2는 일치하고 cross-account 변경 전달 코드는 PREVIEW 배포 완료. 최종 사용자 합격은 실제 기기에서 A PC↔모바일 개인 하트/내 좋아요가 같고, A가 누른 뒤 B/C PC↔모바일의 **공개 숫자만** 같은 값으로 수렴하며 B/C 개인 하트는 본인 행동대로 유지되는지 확인해야 한다. 정상 설계상 타계정 공개 숫자는 클릭 즉시가 아니라 기존 30초 묶음 저장 + 약 5초 shared settle 이후 변경 곡만 반영된다. 좋아요/해제 양방향, 장시간 열린 화면, 페이지 이동 없이 수렴, 재접속까지 실사용 전 TEST 승격 금지. `.github/workflows/diagnose-069-live-like.yml` push별 FAILURE는 기존 별도 진단 workflow 이슈이며 Release Audit/Worker/App gate와 분리한다.


## 0FI. 좋아요 공유 숫자 6곡 실데이터 수복 + Worker191/app158 PREVIEW 배포 완료 (2026-09-24 KST)

**현재 실제 PREVIEW**: 앱 app158 Hosting Run `35987409727` SUCCESS / exact build PASS / `PREVIEW_APP_VERSION=158`; Cloudflare Worker191 Run `35987221833` SUCCESS / active version `5bacea12-59a2-41ce-91ed-9fc7cb2e36bb`. URL `https://preview.soridraw.com/`. TEST/PRODUCTION Worker/Hosting 비변경 PASS.

**실제 서버에서 확인·수정된 문제**: read-only 진단에서 canonical D1↔derived mismatch는 0이었지만 shared R2 latest 37 overlap 중 6곡, popular 37 overlap 중 동일 6곡의 공개 likeCount가 canonical과 달랐다. Worker191은 기존 075 경로의 파생 R2 쓰기 실패가 queue cursor 소비 뒤 영구 잔류할 수 있는 문제를 방어하기 위해 actual changed-data Durable Object alarm 뒤 bounded first-page canonical 검증/수복을 수행한다. 과거 6곡은 one-time remote scheduled 실행으로 **marker changed=6**, 실제 latest `MISMATCH=0`, popular `MISMATCH=0` 확인 후 release 성공. canonical user D1 쓰기/스키마 변경/백필/전체 likes scan 없음; 수정 대상은 shared R2 파생 snapshot/card/profile뿐이다.

**개인 좋아요 클라이언트 보완도 배포**: `src/services/exploreLikeService.ts`의 revision 변경 직후 baseline marker가 먼저 지워져 stale `snapshotPending=false` 해제용 fresh proof가 시작되지 않던 순서 버그를 수정한 후보가 이번 app158 Hosting에 포함됨. 관찰된 개인 R2 revision + unresolved guard가 있을 때 해당 revision당 최대 1회 fresh canonical proof만 허용하며 현재 outbox 우선, 정상 캐시 D1 R0 유지. 합성 5→10 및 warm 재진입 추가 read 0 회귀 PASS.

**남은 검증**: 실제 동일 UID PC↔모바일 개인 filled-heart/내 좋아요 목록과 신규 좋아요·해제 실시간 수렴은 사용자 실기기 최종 검증 전. B/C 다른 계정의 공개 숫자는 현재 shared R2 canonical parity 0까지 서버에서 확인했지만, 장시간 열린 화면의 2분 activity/revision 전달 UX는 별도 실사용 확인 필요. 이 검증 전 TEST/PRODUCTION 승격 금지. `.github/workflows/diagnose-069-live-like.yml`의 push별 진단 실패는 별도 미해결 진단 workflow 이슈이며 이번 release gate(Audit/Worker/App)는 SUCCESS.


## 0FH. Worker191 배포 시도 자동 롤백 / 실제 공유 좋아요 불일치 6곡 유지 (2026-09-24 KST)

**현재 실제 PREVIEW**: 앱 app158, Worker189 `e23e73a1-89af-40f6-ae66-dc4ae2458c30`. Worker191 release Run `35982523348`은 새 Worker 배포와 기본 Feed/Profile smoke까지 PASS했지만, PREVIEW 임시 cron으로 실행하려던 one-time 191 repair가 24회 대기 동안 실행되지 않아 release gate FAIL. Workflow가 즉시 Worker189로 자동 rollback했고 임시 cron도 원상복구. TEST/PRODUCTION 비변경.

**현재 실제 데이터 진단**: 최신 감사 Run `35984604276` SUCCESS. bounded read-only 비교 결과 D1 canonical vs derived mismatch `0`; shared R2는 latest 37 overlap 중 6 mismatch, popular 37 overlap 중 6 mismatch (동일 6곡의 두 projection). 191 합성 실행 검증은 6/40 수복, latest/popular/profile/card CAS, transient retry, warm D1 R0/R2 W0 전부 PASS했지만 **실제 R2 one-time repair marker는 ABSENT**이고 실제 공유 R2 불일치는 그대로. 따라서 문제 해결/배포 완료로 취급 금지.

**다음 작업**: cron 전파 지연에 의존하지 않는 안전한 PREVIEW 전용 191 one-time 실행 경로를 사용/구현하고, 실행 직후 같은 read-only parity 검사에서 latest/popular mismatch 0 확인 후에만 Worker191을 유지. 개인 stale-baseline 후보 수정도 아직 미배포. 사용자 원본 D1 변경/백필/전체 likes scan 금지, TEST/PRODUCTION 승격 금지.


## 0FG. app158 이후 독립 원인 재현 — stale personal baseline invalidation (2026-09-24 KST)

**배포 상태: 후보만 수정 / 미배포.** `preview` 기준 `b84484dd5b81aa9a55eda08efddd65a98dc633cb`; 수정 `45857de98cd21fe7e468661b13c685119942d87a` (`exploreLikeService.ts`), 실행형 regression `a9a6c8e79bbe4e4bf1047b75bcbdbba03dd011bc` 및 가드 `16c9f3925652fac08986d25133064cb06a437033`. Audit `35979633390` SUCCESS (TypeScript/Build/실제 production 함수 실행 검증/현재 배포 경로 무변경). 이번 변경은 app158 후보 내부 수정으로, 아직 Hosting/Worker에 적용되지 않았다.

**확정 원인**: 개인 R2 revision이 바뀌면 `checkExplorePersonalLikeRevision127`가 먼저 `invalidateExplorePersonalLikeBaseline127`에서 이전 complete/partial marker를 지우고 `ensurePersonalLikeBaseline127(user, revision)`을 부른다. app158의 `verifySettlement189` 조건은 *이미 지워진* marker를 요구해, 오래된 `snapshotPending=false`가 있어도 신선한 canonical proof가 생략되었다. 새 조건은 실제 관찰된 R2 revision이 주어졌고 unresolved guard가 남은 UID에만 **해당 revision별 최대 1회** 확인을 허용한다. 정상 캐시 D1 R0, 현재 outbox 우선, pending/mismatch/race 시 보호. 새 데이터 구조/백필/반복 타이머 없음.

**현재 구분**: 특정 guard 경로의 합성 5→10 테스트 통과 != 사용자 실제 D1/R2·PC/mobile 10 일치. 다른 계정 공유 숫자 경로도 미해결: 현재 Worker189의 075 처리에서는 D1 성공 후 R2 projection에 `Promise.allSettled`/catch가 존재하고 실패해도 queue 진행이 완료되며, 재시도용 작업은 별도로 보장되지 않는다. 1분 aggregate + 클라이언트의 활동 기반 2분 revision gate로 다른 계정 열린 화면의 즉시 전달도 보장되지 않는다. 사용자 원본 검증 없는 무분별한 재배포를 막고, 작은 서버-side bounded proof/재시도 설계 및 교차 계정 실증이 확인되기 전 전체 완료 선언 금지. TEST/PRODUCTION 변경 금지.


## 0FF. app158 PREVIEW 배포 — 개인 좋아요 stale-guard 재확인 간소화 (2026-09-24 KST)

**배포 상태: PREVIEW 완료.** 기준 `b5a54bcee693c5282b5ff04e6e7b5e3c1ed4ca1f`; 변경 `src/services/exploreLikeService.ts` `7fff2ffe702d92d19356f1b107d08a793b6380ff`, 실행 검증 `scripts/verify-189-personal-like-settled-guard-release.mjs` `a5bb6dbf3a4f3e1c0f21215f4393daee22578a2d`, `src/pages/ExplorePage.tsx` `561f7fd2f4beedaf31c9591e135d01eb51d1cc30`, `public/app-version.json` `539a0af86239c1a9309590c76c40986b7ef29999`. 최종 감사 소스/Run `1fdd191325a87dac47adc07bab3d94f84c5d8f28` / `35978411056` SUCCESS; 배포 trigger `d14259c31f9bb36f38a9d0412fc95994decb3455`, Hosting Run `35978612769` SUCCESS, app-version 158, exact PREVIEW build PASS, TEST/PRODUCTION 불변 PASS. Worker189 유지. URL `https://preview.soridraw.com/`.

**수정한 실제 경로**: 과거 app189 글로벌 복구 시도 마커 `'1'`가 실패 후 영원히 재확인을 막던 부분을, 유효한 개인 R2 revision별 최대 1회 fresh canonical proof로 바꾼다. 우선순위는 현재 outbox→인증된 fresh canonical proof→이미 받은 개인 R2. queue pending/경합/ID mismatch에서 fail closed, 무작정 guard 삭제 금지. 정상 캐시는 추가 D1 확인 0. 공유 Feed 일회성 수복 marker에서 앱 버전 결합 제거하여 향후 버전 변경만으로 R2 Feed 재읽지 않는다. 기존 실시간 app141, 30초 묶음, W1-W2, Functions/Rules/UI/공유 사용자 데이터 변경 없음.

**확인**: TypeScript/Build/static tests/개인 좋아요 5→10 합성/재방문 읽기 제한 PASS. **실제 A 계정 서버 canonical/R2 및 PC·모바일 개인 10곡 일치는 미검증. B/C의 공개 숫자 실시간 통지도 여전히 미구현/미검증**이므로 전체 좋아요 정상화 완료로 선언 금지. 다음 작업은 공유 likeCount 변경 1곡 publication/revision과 다른 계정 실기기 검증, 근거 확인 후 최소 수정. 사용자 원본 강제수정·전체 조회·TEST/PRODUCTION 승격 금지.


## 0FE. app157 개인 좋아요 카드 일치 보완 PREVIEW Hosting 배포 완료 (2026-09-24 KST)

**배포**: 사용자의 수정→PREVIEW 배포 한 묶음 지시에 따라 소스 변경/감사/Hosting 배포를 완료했다. Audit `35975707446` SUCCESS, 코드 감사 기준 `86eb3e4a176f27fc7ad5534fcc518260967197c0`, 앱 릴리스 trigger `c1a6d885c362c0cee7b21a36df8733eebfd36e8b`, Firebase Hosting-only Run `35976334811` **SUCCESS**. 릴리스 안의 TypeScript, Build, `PREVIEW_EXACT_BUILD`, `TEST_PRODUCTION_UNCHANGED` 전부 PASS. URL `https://preview.soridraw.com/`; 앱 버전은 157 그대로이며 변경 코드는 개인 좋아요 카드 색인 190이다.

**변경/비변경**: `src/services/exploreLikeService.ts` 수신한 유효한 개인 좋아요 신호의 카드 색인을 하트와 일치. `src/services/exploreLikedTracksService.ts` 인증된 완전한 개인 목록 수신 시 오래된 카드 없음 힌트 제거, 누락 카드만 요청. 신규 regression `scripts/verify-190-like-card-authority.mjs` PASS. Worker189 유지, Functions/Rules/D1/R2 원본/UI/CSS/30초 묶음/W1 intake/TEST/PRODUCTION 불변. 사용자 데이터 이동/덮어쓰기 없음.

**남은 미검증**: 인증된 사용자 실제 PC/모바일 5↔10 원본 일치 및 B/C 교차계정 공개 likeCount 전파 실사용 미검증. 원격 합성 D1 mutation W1~W2 비용 계측 이번 감사에서 skipped. 사용자 계정 불일치가 남아있으면 원본과 현재 기기별 outbox 읽기전용 확인 후 특정 경로만 수정한다. 전체 해결·TEST/PRODUCTION 승격 금지.


## 0FD. app157 소스 보완 — 개인 좋아요 곡 카드 일치 최소 수정 (2026-09-24 KST)

**작업 branch / 기준**: `preview`, 기준 `0339c3a99dba78c7ad5b97746c1146a6634cf11d`. 수정 commit `2f32cf68cb59f55606766b611cff09939cd1e25d` / `debefe4fd6c4fd3661bd46bcbb07ced9cad7183b`. Audit 고정 후보 HEAD `86eb3e4a176f27fc7ad5534fcc518260967197c0`, Release System Audit Run `35975707446` **SUCCESS** (TypeScript/Build/static like regression/190 실행형 회귀 PASS, isolated remote synthetic billing skipped). app 버전은 여전히 157이고 **이번 변경은 소스에만 반영, 미배포**.

**정확한 수정**: `src/services/exploreLikeService.ts`에서 수신한 계정별 좋아요 신호의 하트 값이 이미 같더라도 로컬 '내 좋아요' 카드 색인을 같은 membership으로 맞춘다. `src/services/exploreLikedTracksService.ts`는 인증된 완전한 개인 목록으로 정합화할 때 과거의 '카드 없음' 힌트를 지워, 다시 확인된 좋아요 ID의 누락된 카드만 요청할 수 있게 한다. `scripts/verify-190-like-card-authority.mjs` 실행 검증: 5곡 카드+10곡 검증된 ID → 빠진 5곡만 수신→10곡 표시, 따뜻한 재진입 추가 요청 0, 로컬 미전송 해제 우선 보호. 감사 Workflow에 실행형 검증 추가. 다른 기능의 UI/CSS·30초 묶음·Worker/W1·Functions/Rules·D1/R2 schema·사용자 원본 변경 없음.

**남은 게이트**: 사용자의 실제 동일 UID PC 5↔모바일 10 및 현재 미전송 outbox/서버 canonical의 합치 여부는 실사용 **미검증**. 다른 계정 B/C의 공개 likeCount 실시간 변경 전달은 본 수정 범위 밖이며 여전히 별도 검증/수정 필요. **PREVIEW 배포 전**, TEST/PRODUCTION 승격 금지. W1~W2 신규 실제 mutation 계측 미실시(회귀 감사의 isolated remote synthetic billing도 skipped). 기존 app157/Worker189 배포 상태는 유지하며 사용자 데이터 강제 덮어쓰기·전체 백필 금지. 다음 작업은 개인 실기기 결과 및 타계정 public changed-track end-to-end 검증으로 분리한다.


## 0FC. app157 / Worker189 PREVIEW 배포 완료 — 개인 좋아요 과거 guard 복구 후보 (2026-09-24 KST)

**승인·범위**: 사용자 지시에 따라 PR #111 `294036e963704a1007cfde36108a3f4640a57c7f`을 `preview`에 merge `50ad5fab1b7516cc6ba7102cd1832ba0790885be`. 이미 앱156에 남은 개인 unresolved false guard가 서버 최신 좋아요를 가리는 경로만 한정 수정. 코드 병합 후 audit 필수 항목에 실행형 `verify-189-personal-like-settled-guard-release.mjs` 추가(커밋 `50cc95feae38d101e4f84a054fff91a69a1fecaf`). `preview` 전체 감사 `35972104509` SUCCESS / 고정 소스 `ffd16793b9c81f4f13dbd0762f76d73ffa7a735d`.

**PREVIEW Worker**: release `35972368855` job `107544798097` SUCCESS, active version `e23e73a1-89af-40f6-ae66-dc4ae2458c30`. `CANONICAL_WORKER_SHA256=2ce64ffad58c9bb18aebc54b8a54533dbf109ecf460df57210387623025774df`, predeploy pending069=0, schema/seed/preflight/Feed/Profile smoke PASS, warm revision D1 R0/W0 PASS, fixed cron disabled, TEST/PRODUCTION Worker unchanged PASS. Worker 변경은 계정별 인증 요청의 **읽기전용 fresh settlement 판정**뿐이며 D1 원본·R2 개인 ID 쓰기·Functions/Rules 변경 없음. `156` 임시 cron 미사용.

**PREVIEW 앱**: Firebase Hosting-only release `35972504441` job `107545244491` SUCCESS / release triggering commit `ad92825feff014f02bc76010287ead765ffdfb7e`; `PREVIEW_APP_VERSION=157`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`; `https://preview.soridraw.com/`. TypeScript/Build, 필수 like/Music Note 회귀 및 189 실제 baseline 모의 테스트는 감사에서 PASS. UI/CSS·30초 묶음·기존 W1 intake/W1~W2 mutation route 변경 없음. 원격 신규 좋아요 행동의 실제 W1~W2 요금 계측은 **미실시**.

**중요 미검증**: 실제 사용자 PC 5 ↔ 모바일 10의 서버 정답, 기존 미전송 outbox 및 각 기기 로컬 상태는 본인 기기 인증 대조 **미실시**. 189는 동일 UID R2 exact 및 D1 canonical ID 완전 일치, queue empty, ETag 불변일 때만 오래된 guard를 제거한다. 서버 ID mismatch/pending/경합/일시 오류 시 fail-closed이며, UID별 1회 시도 후 자동 반복 D1 read를 하지 않아 추가 진단이 필요할 수 있다. 타계정 PC/모바일의 **새 좋아요·해제** 공개 수치 전달 및 오래 열린 탭 자동 갱신은 수정/검증하지 않았다. 4곡 과거 count 복구를 향후 전체 정합성 증거로 사용하지 말 것. **사용자가 지정한 모든 계정×PC/모바일 최종 합격은 여전히 미검증; TEST/PRODUCTION 승격 금지**. 다음 단위는 app157 실사용 PC/모바일 확인 후, 타계정 공개 likeCount 변경분 전달 경로를 독립 점검. 사용자 원본 데이터 삭제/덮어쓰기/전체 백필 금지.


## 0FB. PR #111 app157 보완 — fresh canonical settlement만 과거 guard 해제 (2026-09-24 KST)

리뷰 P1 2건/P2 1건만 보완했다. app156에서 이미 `BASELINE=1`이거나 `PARTIAL=1 + REPAIR_ATTEMPTED_182=1`인 기기도 UID별 unresolved guard가 실제 존재할 때에만 189 복구 경로에 1회 진입한다. 189 시도 marker는 요청 전에 기록하므로 실패·재방문·앱 업데이트가 canonical 재읽기 loop를 만들지 않으며, unresolved guard가 없는 정상 캐시는 기존 조기 종료를 유지해 D1 R0이다.

R2에 지속되는 `likesSnapshotSource`/`canonicalSource156`는 더 이상 guard 삭제 권한이 없다. 인증된 현재 189 요청에서만 Worker가 (1) 069/075 queue empty, (2) 최대 2001 bounded canonical 공개 likes와 exact R2 ID set 완전 일치, (3) queue 재확인, (4) R2 ETag 불변을 모두 확인하고 `freshCanonicalSettlement=true`를 반환한다. mismatch/pending/초과/corrupt/ETag race는 false로 닫히며 R2/D1 원본을 쓰지 않는다. 클라이언트도 현재 signal/repair target이 바뀌면 결과 적용 전에 중단하고, 현재 outbox track의 guard와 미전송 의도를 보존한다.

`verify-189`는 production `requestPersonalLikeBaseline127`/`ensurePersonalLikeBaseline127` 구현을 직접 compile·실행하여 app156 두 marker 상태의 5→10 cache 반영, UID 1회 진입, persistent provenance/accepted-pre-aggregate 거부, live outbox 보존, signal race fail-closed, healthy cache D1 R0를 검사한다. Worker canonical owner와 SHA manifest만 함께 갱신했다. UI/CSS, 타계정 공용 숫자, mutation W1/W1-W2 경로, schema, 사용자 데이터는 변경하지 않았다. 배포/merge/TEST/PRODUCTION 승격은 하지 않으며 PREVIEW 실제 기기 5→10은 여전히 미검증이다.

## 0FA. app157 source 후보 — canonical-settled 개인 좋아요가 과거 pending guard에 가려지는 원인 수정 (2026-09-24 KST)

**이번 1단계에서 재현·확정한 원인 1개**: 개인 shared R2/D1이 10곡으로 정확히 일치해 app182가 `verified-single-user-d1-182` complete snapshot을 반환해도, PC 로컬의 과거 `explore-like-snapshot-pending:127` false 5개가 exact catalog보다 우선했다. 이 guard는 기존 코드에서 해제 경로가 없어 서버/R2 10곡과 모바일 10곡인 상태에서도 PC는 5곡을 계속 표시할 수 있었다. 합성 회귀검사에서 canonical 10 + stale false guard 5 → visible 5를 재현했다. 실제 사용자 UID·곡 ID·원본 데이터는 읽거나 출력하지 않았다.

**최소 수정**:
- `src/services/exploreLikeService.ts`: queue가 비어 있고 canonical D1/R2 ID가 완전 일치할 때만 app182가 기록하는 source를 `canonicalSettled` 증거로 인식한다. 이 증거를 받은 exact baseline에서 현재 outbox가 없는 과거 accepted-but-unsettled guard만 제거하고 canonical catalog로 수렴한다.
- 아직 전송되지 않은 현재 outbox는 계속 최우선이며 그 track의 guard도 보존한다. 일반 exact/pre-aggregate R2는 guard 해제 권한이 없다.
- `scripts/verify-189-personal-like-settled-guard-release.mjs`: 10→5 재현, canonical-settled 10 복구, live outbox 보호, 일반 exact R2 보호를 자동 검증한다.
- app version source는 **157**. UI/CSS, Worker, Firebase Functions/Rules, D1/R2 schema 및 사용자 원본 데이터는 변경하지 않았다. 배포하지 않았고 TEST/PRODUCTION도 변경하지 않았다.

**아직 미검증/승격 제한**: 실제 동일 UID의 PC/모바일에서 5→10 수렴은 PREVIEW 배포 전이므로 미검증이다. 이 수정은 타계정 public likeCount 문제나 전체 구조를 다루지 않는다. 전체 Issue 합격으로 간주하지 않으며 TEST/PRODUCTION 승격 금지.


## 0EZ. PREVIEW app156 / Worker182 — 기존 불완전 개인 좋아요 목록 안전 확인 (2026-09-24 KST)

**배경**: 동일 계정 PC 5곡 vs 모바일 10곡. 기존 181 수정은 *앞으로* accepted 개인 R2 목록을 CAS 갱신할 때 exactLikeCount156를 함께 변경하지만, **과거에 이미 mismatch된 개인 R2 기록을 고치지는 못함**. 어느 숫자가 원본 정답인지는 실사용 기기 및 인증 계정의 canonical 직접 대조 전에는 알 수 없음.

**182 수정** (`preview`, 기능 commit `0598cb9e7fbe4a3e3de0164bbe7b2539310cf8df`, CORS-safe query follow-up `107424064ddacb88e37ce5c71f4ea27e74e71485`):
- `src/services/exploreLikeService.ts`: 오래된 partial marker를 가진 계정은 기존 조기 종료 대신 **계정별 1회만** 기존 social snapshot을 재요청하며 인증된 복구 query 적용. 완전한 건강 캐시 재방문은 기존 local-first 경로 유지. 미전송 outbox/accepted pending이 원본보다 우선, 덮어쓰지 않음.
- Worker `repairPartialPersonalLikeMetadata182`: 계정별 인증 요청에서만 실행. 이미 완전한 catalog면 D1 R0. partial인 경우 해당 UID의 069/075 queue pending 여부 확인 후 canonical `likes` 공개곡 최대 2001 제한 조회; **R2 곡 ID와 canonical 곡 ID가 정확히 동일**하고 최대 2000 이하일 때만 기존 R2의 `canonicalComplete156` 및 `exactLikeCount156` 메타데이터를 ETag CAS로 교정. 곡 IDs, D1 관계, 원본 사용자 데이터 미변경. 다르면 `canonical-mismatch`로 수정 중단 — PC 5/mobile 10 중 임의 숫자로 통합 금지.
- `X-...` 새 헤더는 CORS preflight 위험으로 배제, 기존 인증만 쓰는 URL의 한정 query `?__soridraw_personal_repair=182` 사용. 기존 Worker/Functions/Rules/UI/CSS/TEST/PRODUCTION 미변경.
- `scripts/verify-182-account-partial-like-repair.mjs`: canonical IDs 일치 시 metadata-only, 불일치/queue pending/CAS race에서 no overwrite, healthy D1 R0, client 1회 요청 검사.

**검증**: Release System Audit Run `35913406306` SUCCESS (TypeScript/Build/static/like regression/Worker SHA + 182 executable mock; remote synthetic billing skipped). PREVIEW Worker release Run `35913674952` / job `107359598187` SUCCESS: pinned source `1765909757aa64b1036bc85cc0689965335cd13e`, active `e426448c-ce5a-4a75-a798-97e3f9f52a81`, preflight pending069=0, Feed/Profile PASS, warm revision D1 R0/W0 PASS, fixed cron disabled, TEST/PRODUCTION Worker unchanged. Firebase PREVIEW app156 Hosting-only Run `35913791497` / job `107360004721` SUCCESS: exact build app156 PASS, TEST/PRODUCTION unchanged PASS.

**반드시 아직 FAIL/미검증**: 사용자의 실제 PC 5/mobile 10이 동일 UID이고 어떤 곡이 로컬 미전송/서버 canonical인지 **본인 기기/인증 서버 실측 없음**. 그 5곡의 R2와 canonical이 불일치하면 안전 장치가 그대로 멈추므로 app156으로 무조건 10으로 수렴한다고 주장 불가. 타계정 모든 PC/모바일에서 신규 좋아요·해제 변경분이 활성 화면에 실시간 전달되는지 역시 미검증, 전역 push는 여전히 없음. **사용자 요청의 전체 합격선 미달**: TEST/PRODUCTION 승격 금지, 완료 보고 금지. 다음은 사용자의 실제 기기와 서버에서 동의된 변경 항목만 비교하고 새 변경을 양방향 실사용 검증. 안전하게 확인할 수 없는 것은 덮어쓰지 않는다.


## 0EY. app181 개인 좋아요 5↔10 exact catalog metadata 수정 PREVIEW 후보 배포 — 전체 실사용 게이트 미통과 (2026-09-24 KST)

**사용자 직접 지정 합격 기준**: 동일 계정 본인 PC/모바일의 좋아요 하트 및 내 좋아요 곡 목록 일치. 모든 계정의 PC/모바일에는 같은 공개곡 공용 likeCount가 같아야 하며, 각자의 개인 하트는 실제 본인 membership대로 표시. A/B 각자 좋아요↔해제↔재좋아요 반복, 추천/최신/인기/프로필/내 좋아요, 재접속/업데이트/장시간 열려 있는 기기까지 확인. 모바일 10 vs PC 5의 **실제 canonical 정답 아직 미확인**; 사용자 원본/개인 캐시 임의 덮어쓰기·초기화 금지. 특정 4곡 R2 복구는 전체 합격 아님.

**추가 발견·소스 수정**: Worker `syncExploreLikeR2AfterBatch074`가 이미 완전 검증된 개인 R2 목록의 `likedTrackIds`를 CAS로 변경할 때 `exactLikeCount156`는 이전 숫자에 남김. 5→10이면 다른 기기 reader `normalizeSharedLikesState161`가 exact 불일치로 해당 catalog를 partial 취급할 수 있음. 완전 검증된 기존 catalog(`canonicalComplete156=true`, provenance, 정확한 count/중복 없음)에서만 새 exact count를 `liked.size`로 같은 CAS에 반영. legacy partial/corrupt는 **절대 exact로 승격 안 함**, older ACK 우선순위 및 W1 queue 그대로. Worker 원본, 074 patch, canonical SHA256 및 회귀 검사 `scripts/verify-181-personal-r2-exact-mutation.mjs` 변경. source commit `153aaccdcd758a65db7312ae5e85db60c140f38b`.

**검증/배포**: Audit Run `35911382038` SUCCESS: TypeScript, Build, like/Music Note regression, executable 181 5→10→5 + partial + stale ACK PASS, Worker canonical SHA256 PASS, read-only D1 preflight PASS. Worker-only PREVIEW release Run `35911669741` / job `107352762668` SUCCESS, active `5008c2a4-17fa-4f3d-a745-04897ee79ba3`; Feed/Profile smoke PASS, warm revision D1 R0/W0 PASS, TEST/PRODUCTION Worker unchanged PASS. Firebase Hosting app155 변경 없음. 실제 사용자 원본/D1 schema 변경 없음.

**릴리스 가드 후속 수정**: `35911669741`의 pinned source trigger에는 예전 `repair_shared_like_snapshot_156=true`가 남아서 일회성 cron이 재활성화되었으나, 기존 marker PASS 후 cron 원복 PASS; 공유 R2 latest/popular 역시 PASS, 사용자 원본 변경 없음. 원인은 Worker release workflow가 triggering commit이 아닌 pinned product source의 오래된 trigger flag를 읽기 때문. 실제 triggering commit의 trigger 내용만 읽도록 workflow 소스 수정 `75965bb7993ba2b3d9d2fa9c3eab2ae59710017e`; 향후 릴리스에서 156 cron 비의도 반복 금지.

**남은 필수 게이트 (FAIL/미검증)**: 사용자의 실제 모바일 10 vs PC 5 각각에 남은 pending outbox / accepted R2 / D1 canonical과 특정 곡 차집합의 일치 **미검증**. 개인 R2 exact metadata의 미래 변경 회귀가 고쳐졌다는 것은 실사용 동기화 완성의 충분조건이 아님. 타계정 공유 R2 publication의 새 좋아요/해제 자동 수렴 및 active idle 타계정 즉시 반영도 **미검증**. 실제 사용자 PC·모바일 및 타계정 테스트 전 해결 완료 판단 금지. TEST/PRODUCTION 승격 금지.


## 0EX. PREVIEW 공유 좋아요 0 표시 실제 원인 규명 및 app156 R2 복구 배포 (2026-09-24 KST)

**원인 확정**: 앱 155의 두 브라우저 숫자 0 증상은 개인 하트 문제와 달리, PREVIEW canonical D1 + 일반 `/v1/feed`는 확인 4곡 모두 likeCount=1인데 **실제 클라이언트가 읽는 first-page shared R2 snapshot (direct / revision-keyed latest, popular)에는 모두 0이 남아 있었기 때문**. 기존 069 queue=0이고 canonical relation=1, derived=1. 읽기전용 Diagnose Run `35905492085`에서 source discrepancy 재현. 클라이언트 캐시만 반복 초기화해도 고칠 수 없는 서버 파생 스냅샷 문제.

**복구 구현**: canonical Worker entry의 `repairVerifiedSharedLikeSnapshots156`: 이미 확인된 4개 제목을 shared latest R2에서 정확히 각 1곡으로 식별 → 공유 D1의 실제 `track_stats.like_count`를 ID 4개만 단일 SELECT → shared latest/popular에 해당 곡의 likeCount / stats.likeCount만 conditional ETag(CAS)로 갱신 → 양쪽 성공 시 1회 marker. 다른 트랙/프로필/개인 카탈로그/원본 사용자 데이터 변경 없음. marker 완료 후 재실행은 1회 R2 HEAD로 빠르게 종료. 일반 좋아요 aggregate DO alarm은 cron과 구별하여 기존 예약 기능 보존.

**첫 배포 실패와 원인**: Run `35904914811`은 임시 cron 3×75초 대기 내 marker가 나오지 않아 기존 Worker `e35bcc57-e29a-4575-99cc-ee64b83cb46d`로 자동 롤백함. Cloudflare cron 설정 전파까지 최대 약 15분을 고려해 PREVIEW 전용 기존 Worker Release의 최대 대기만 24×45초(18분), timeout 25분으로 수정; 정적 검사 `verify-156-shared-like-snapshot-repair.mjs`를 실제 scheduled return 형태에 맞춰 재검증.

**최종 감사**: `preview` source `de15974b127f31dd5d277f05a205ca9eeca86504`, Release System Audit Run `35908413058` SUCCESS. TypeScript/Build/Like+Music Note/156 bounded CAS regression/read-only D1 preflight PASS. 원격 synthetic 비용 측정 SKIPPED.

**PREVIEW Worker 배포**: Run `35908607512` / job `107342469022` SUCCESS. pinned Worker source `de15974b127f31dd5d277f05a205ca9eeca86504`, active Worker version `e4c8d394-a5c5-43b9-bf52-fc9513184089`; old `e35bcc57-e29a-4575-99cc-ee64b83cb46d`. `156_R2_REPAIR_MARKER=PASS`, `156_PREVIEW_CRON_RESTORED=PASS`, `156_PUBLIC_SHARED_R2_LATEST=PASS`, `156_PUBLIC_SHARED_R2_POPULAR=PASS`, `WARM_REVISION_R0_W0=PASS`, `TEST_PRODUCTION_WORKERS_UNCHANGED=PASS`. Fixed cron is again disabled; existing DO event scheduler remains active. Hosting app155 unchanged; Firebase/Functions/Rules/TEST/PRODUCTION/canonical user data unchanged.

**배포 후 독립 읽기전용 실측**: Run `35909223575` SUCCESS: 4곡 D1 canonical/relation/derived 모두 1, 069 queue=0, standard latest/popular Feed 모두 1, **client direct shared R2 latest/popular 및 revision-keyed shared R2 latest/popular 모두 1 (match=true)**. 기존 에지/기기에서 오래된 데이터를 보유했다면 변경된 R2 ETag에 대한 정상 client revision 확인 후 수렴 예정.

**남은 검증/제약**: PREVIEW PC Chrome/Edge와 모바일의 각 계정으로 신규 좋아요→30초 batch→1분 aggregate→공용 R2 숫자→해제 역방향 반복의 실사용 테스트는 미실시. 한 번의 4곡 복구와 백엔드 읽기전용 parity를 **미래 모든 좋아요 실시간 보장**으로 확대 주장 금지. 타계정 오래 열린 비활성 탭에 새 실시간 push는 없음(현재 focus/visibility/interaction 제한된 revision 재확인). 추후 불일치 시 069 queue/ D1 canonical/ R2 direct + keyed 4단계의 동일 곡 비교 후 변경 항목만 수정. TEST/PRODUCTION 승격 금지.


## 0EW. PREVIEW app155 source — 개인 좋아요 숫자의 공용 캐시 오염 경로 차단 (2026-09-24 KST)

**실사용 증상**: 같은 공개곡의 public likeCount가 PC Edge / 모바일 다른 계정 / PC Chrome에서 각각 달라 보임. 기존 069 queue는 앞선 작업에서 drain되어 shared latest/popular 확인 4곡은 1로 복구된 상태이나, 장래 좋아요/해제 후 다시 불일치할 위험은 별도로 존재.

**코드에서 확인한 원인**: `src/pages/ExplorePage.tsx`에서 로컬 optimistic click, 동일 UID RTDB changed-track 수신, shared Feed revalidation의 account overlay가 공용 Feed / 공개프로필 persistent cache에 provisional likeCount를 덮어쓰는 경로가 있었음. 계정 전환 후 이 공용 캐시를 다른 사용자가 재사용할 수 있어, 공개 수치의 권위가 공유 R2가 아닌 특정 계정의 임시 값으로 흔들릴 수 있었음.

**이번 수정** (`preview`, 최종 소스 commit `9ec45d026be84b6bd17124553ac881e02cfb1930`):
- 공용 Feed / 공개프로필 persistent cache는 서버에서 받은 `sharedTracks`의 원래 likeCount만 저장.
- local optimistic click과 동일 계정 remote notification은 active UI / 개인 liked-card cache만 갱신하고 공용 persistent cache를 덮어쓰지 않음.
- 기존 개인 membership, 30초 batch, RTDB same-UID signal, 1분 shared aggregate, Worker/D1/W1 queue와 UI/CSS는 비변경.
- `scripts/verify-117-explore-public-count-cache-separation.mjs` 기존 회귀 검사에 이 3개 경로에 대한 guard 추가.
- `public/app-version.json` 154→155: 기존 버전별 1회 bounded first-page shared R2 recovery 경로를 이용하여 이전에 오염된 154 캐시를 복구. D1 전체 읽기/전체 데이터 재생성은 추가하지 않음.

**검증**: 기존 117 verifier의 App155 공용/개인 캐시 분리 검사 및 현재 atomic card assertion PASS. Release System Audit Run `35901617762` SUCCESS: TypeScript / Build / Static release verification(117 + 154 포함) / Like candidate regression / Music Note / read-only shared D1 preflight PASS. 격리 synthetic 원격 D1 과금 측정은 해당 audit에서 SKIPPED. PC·모바일 서로 다른 계정의 좋아요/해제 반복 실사용 검증은 **미실시**. 테스트 정리 commit `a66e812bd161b84442ce288392b4b78b183a5681`. Push 직후 기존 `diagnose-069-live-like.yml` 자동 workflow는 이전 HEAD에서도 동일하게 실패해 왔으며 이번 수정의 빌드 PASS 증거로 쓰지 않음.

**배포 상태**: Firebase PREVIEW app155 Hosting-only release Run `35901871632` / job `107319825956` SUCCESS. locked source `f400203bf8205adc7f2a3d53c7d632537e9acd4e`; `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=155`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`. `https://preview.soridraw.com/` 실배포 155. PREVIEW Worker 기존 `33b4de33-73c5-44b2-bf87-e550545fa13a` 유지. TEST / PRODUCTION / Functions / Rules / D1 / 사용자 데이터 비변경.

**다음 게이트**: 고정 commit 대상으로 기존 117 + 154 + like/Music Note regression, TypeScript/Build, independent audit를 먼저 실행. 그 후 Firebase PREVIEW Hosting app155만 배포하고 exact build 확인. 서로 다른 계정·브라우저/PC·모바일에서 1곡 좋아요→server shared aggregate→해제 반복, 추천/최신/인기/프로필 숫자 확인. **타계정 active idle에 자동 즉시 전달은 현재 event push가 없으므로 보장하지 않음**; entry/focus/interaction에서 bounded shared revision revalidation. 이 요건을 즉시 delivery로 해석해야 하면 10만 명 규모 fanout 비용/운영 결정을 먼저 별도 보고해야 함. TEST/PRODUCTION 승격 금지.


## 0EV. PREVIEW 좋아요 타계정 동기화 — stale 069 queue 정리 + Worker 복구 완료 (2026-09-24 KST)

**사용자 실사용 증상**
- 본계정 Explore에서는 공개곡 likeCount=1.
- 타계정 Explore에서는 같은 공개곡 likeCount=0.
- app154 클라이언트의 계정 전환 revision 재검증만으로는 해결되지 않았음.

**읽기전용 서버 진단**
- Diagnose 155 Shared Like Readonly Run `35895291030` SUCCESS.
- shared latest/popular Feed에는 확인 대상 4곡 모두 public likeCount=1이 이미 존재.
- D1 canonical은 일부 트랙만 settled 상태였고, `explore_like_batches_069`에 오래된 pending queue가 남아 있었음.
- Worker release transition guard에서 pending069=8을 감지하여 PREVIEW Worker 교체를 자동 중단함. 데이터 유실 방지 guard 정상 작동.

**bounded queue settlement**
- Repair PREVIEW 069 Like Queue Run `35897425530` SUCCESS.
- preflight: pending batches=8 / mutations=26 / affected users=1.
- 기존 accepted desired-state mutations만 canonical D1에 원자적으로 settlement.
- `QUEUE_069_DRAINED=PASS`, post pending069=0.
- affected user 1명의 personal shared R2 like catalog만 canonical exact 상태로 재생성.
- 전체 사용자 백필/전체 데이터 변환 없음.

**PREVIEW Worker 복구 배포**
- SORIDRAW PREVIEW Explore Worker Release Run `35897572807` / job `107305217200` SUCCESS.
- pre-deploy pending069=0.
- PREVIEW Worker version: `33b4de33-73c5-44b2-bf87-e550545fa13a`.
- Feed smoke PASS / Profile smoke PASS.
- like batch route 존재 확인(unauthenticated smoke 401 정상), like revision route 존재 확인(401 정상).
- revision HEAD-only PASS / warm revision D1 R0/W0 PASS.
- fixed cron disabled PASS / Durable Object event scheduler deploy PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- Firebase Hosting은 app154 그대로. Functions / Firestore / Rules 비변경.

**배포 후 읽기전용 확인**
- Diagnose 155 Run `35897701370` SUCCESS.
- q069 rows=0 / mutations=0.
- shared latest/popular Feed에서 확인 대상 4곡 모두 public likeCount=1 확인.
- 기존 Diagnose 155의 `ACTIVE_EQUALS_REPO_CANONICAL` 및 marker NO 출력은 Cloudflare active version의 main module 하나만 검사하는 진단 방식 한계가 있으므로 Worker 배포 성공 판정에 사용하지 않는다. 실제 release Run의 exact source/preflight/smoke와 public Feed 결과를 기준으로 판단.

**다음 실사용 게이트**
1. 타계정에서 Explore를 다른 페이지로 갔다가 다시 진입하거나 앱을 새로 열어 app154 account-aware revision check를 한 번 실행.
2. 확인 대상 공개곡의 public likeCount가 1로 보이는지 확인.
3. filled heart는 계정별 개인 membership이므로 타계정에서는 비어 있는 것이 정상.
4. 숫자가 여전히 0이면 새 좋아요를 누르지 말고 해당 화면만 캡처. 다음은 클라이언트 session cache/revision 적용 경로만 추적.
- Gemini 작업은 동결.
- TEST / PRODUCTION 승격 금지.

## 0EU. PREVIEW app154 — 타계정 공용 좋아요 revision 재검증 수정 배포 완료 (2026-09-24 KST)

**사용자 증상**
- 같은 계정의 개인 좋아요 상태는 정상.
- 다른 계정에서 같은 공개곡의 공용 좋아요 숫자가 최신 상태로 보이지 않는 증상.
- 타계정의 꽉 찬 하트는 계정별 개인 상태이므로 공유 대상이 아니며, 공유 대상은 공개 likeCount.

**원인**
- Explore Feed의 마지막 revision 확인 시간이 requestUrl만 기준으로 저장되어 계정 A의 최근 확인 시간이 계정 B에도 재사용될 수 있었음.
- Feed 로드/revalidation effect도 `user?.uid` 변경을 dependency로 보지 않아 같은 브라우저/탭에서 계정 전환 시 공용 캐시가 그대로 남을 수 있었음.
- 개인 RTDB 좋아요 signal은 의도대로 같은 UID 전용이며, 타계정 공용 숫자는 shared R2 Feed/Profile projection이 권위 소스.

**수정**
- source commit `6c759b3a216b40bcca01cbd8c59fc26d97502dcd`.
- revision gate key를 `uid + requestUrl` 기준으로 분리.
- Feed effect dependency에 `user?.uid` 추가.
- 계정 전환 시 기존 shared Feed cache는 즉시 표시하되, 새 계정 기준으로 작은 shared revision만 다시 확인.
- revision이 같으면 Feed data 재조회 없음.
- revision이 다르면 현재 shared R2 first-page snapshot만 갱신.
- D1 Feed read/write 추가 없음. polling/새 실시간 listener/Worker/Functions/Rules/사용자 데이터 변경 없음.

**검증 / 배포**
- Release System Audit Run `35891693207` SUCCESS.
- `CROSS_ACCOUNT_SHARED_FEED_REVALIDATION=PASS`.
- `ACCOUNT_SWITCH_REUSES_SHARED_FEED_BUT_RECHECKS_REVISION=PASS`.
- `NO_D1_FEED_READ_ADDED=PASS`.
- TypeScript PASS / Build PASS / 기존 like regression PASS / Music Note regression PASS / Gemini verifier PASS.
- Firebase PREVIEW App Release Run `35892105284` / job `107286832733` SUCCESS.
- locked source `3ea7a0ca5a31c32b17c4b0474bac239ba9b5ae3e`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=154`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- Hosting only. Worker / Functions / Cloudflare / D1 / Firestore / Rules / 사용자 데이터 변경 없음.

**실사용 확인**
1. A계정에서 공개곡 좋아요.
2. 기존 30초 actor batch + 1분 shared aggregate가 지나 shared public count가 확정될 시간을 둔다.
3. B계정으로 전환 후 Explore 진입.
4. B계정에서는 꽉 찬 하트가 아니라 공용 좋아요 숫자가 +1 반영되는지 확인.
5. B계정이 직접 좋아요하면 그때 B계정 하트가 채워져야 함.
- TEST / PRODUCTION 승격 금지.

## 0ET. app153 최초 생성 fallback 시간 복구 + PREVIEW Function 배포 완료 (2026-09-24 KST)

**사용자 실사용 실패 근거**
- app153 첫 생성 실패 세션에서 3.8/3.7은 daily quota cooldown skip.
- 3.6은 약 1분 6초 뒤 provider unavailable로 실패했으며 90~120s local timeout 경계가 아니었음.
- 뒤 3.5 / 3.5-lite가 각각 정확히 20.0s에서 `GEMINI_ATTEMPT_TIMEOUT`으로 종료.
- 다음 세션에서는 이 timeout들이 `model_response_timeout` cooldown으로 남아 fallback 실효성이 사라짐.
- 따라서 app153 hard-ban 복구와 별개로, 최초 곡 생성 fallback 3.5/3.5-lite의 20s bounded timeout이 정상 대형 곡 생성의 백업 역할을 막는 별도 문제로 확정.

**최소 수정**
- source commit `07a2832b351949489fa701369ff89d765ce02988`.
- initial song bounded timeouts:
  - 3.6: 120s → 90s
  - 3.5: 20s → 60s
  - 3.5-lite: 20s → 60s
- Gemini Function request timeout: 180s → 330s.
- 모델 순서 / 5 physical attempts / low-thinking / daily quota skip / prompt / lyric / 5단 / hard-ban / language mix 규칙 변경 없음.
- 목적은 실제 성공이 40.2s였던 대형 곡 요청에서 20s fallback 자가중단을 제거하면서 전체 체인이 Function 상한 안에서 완료될 시간을 확보하는 것.

**검증 / 배포**
- Source Audit Run `35888411533` SUCCESS.
- 최초 deploy Run `35888411519`은 제품 코드가 아니라 배포 workflow에 남은 구형 `3.5=20s` assertion 때문에 배포 전 자동 중단. PREVIEW runtime 비변경.
- verifier 갱신 후 PREVIEW Gemini Function Tune Run `35888544983` / job `107274857366` SUCCESS.
- `PREVIEW_GEMINI_FALLBACK_TIMEOUTS=PASS`.
- `PREVIEW_GEMINI_CHAIN_ORDER_UNCHANGED=PASS`.
- `PREVIEW_GEMINI_DAILY_QUOTA_SKIP=PASS`.
- `PREVIEW_GEMINI_FUNCTION_UPDATED=PASS`.
- `SHARED_GEMINI_FUNCTION_UNCHANGED=PASS`.
- `PREVIEW_GEMINI_CORS=PASS`.
- Hosting app은 app153 유지. Worker / D1 / Firestore / Rules / 사용자 데이터 변경 없음.

**다음**
- 사용자는 현재 cooldown이 만료된 뒤 PREVIEW V1 곡 1곡만 생성.
- 완전 성공 판정은 최초 생성 + 후처리 전체 성공일 때만 인정.
- 3.6 transient unavailable 시 3.5/3.5-lite가 20초에 잘리지 않고 실제 fallback으로 동작하는지 확인.
- 실패 시 이번 한 세션만 분석하고 추가 구조 변경 금지.
- TEST / PRODUCTION 승격 금지.

## 0ES. PREVIEW app153 — 금지어 통합 교정 fallback 퇴행 원복 배포 완료 (2026-09-24 KST)

**문제**
- app152 실사용에서 최초 곡 생성 자체는 gemini-3.6-flash 40.2s / input 24,734 / output 3,115 / total 27,849 tokens로 성공.
- 그러나 후처리 `rewriteLyricHardBanCards`가 gemini-3.5-flash-lite 단일 모델에서 정확히 20.0s timeout으로 실패하여 전체 생성 파이프라인 기준 완전 성공이 아니었음.
- commit `2e14663ac57703c3def3a856ca2c5110aab36105`에서 금지어 줄/카드 교정을 `gemini-3.5-flash-lite` 단일 1회로 강제한 2줄 변경이 퇴행 원인으로 확인됨.
- 저장소의 기존 정상 기준(840차)과 달리 shared fallback이 사라진 상태였음.

**최소 복구**
- commit `e3310809525c6d2f8f88494c2a0c601be3b56354`.
- `rewriteLyricHardBanLines/SecondPass`: 단일 lite 고정을 제거하고 shared Gemini fallback 진입 모델로 복원.
- `rewriteLyricHardBanCards`: explicit `['gemini-3.5-flash-lite']` override 제거하여 기존 shared fallback chain 복원.
- 금지어 판정, 수정 대상 줄, 5 physical calls 상한, 최초 곡 생성 모델 순서, 5단 productionPrompt, 가사/언어/섹션 규칙은 변경하지 않음.
- Function 코드는 이번 app153에서 추가 변경/재배포하지 않음. app152에서 배포한 PREVIEW Gemini Function(3.6 initial timeout 120s)은 그대로 유지.

**검증**
- Release System Audit Run `35886284795` SUCCESS.
- `HARD_BAN_SHARED_FALLBACK=PASS`.
- TypeScript PASS / Build PASS.
- `APP147_GEMINI_PROMPT_AND_CUE_AUDIT=PASS`.
- `VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS`.
- `LIKE_SOURCE_AND_ISOLATED_REGRESSION=PASS`.
- TEST/PRODUCTION Worker dry-run / shared D1 read-only audit PASS.

**PREVIEW 배포**
- Firebase PREVIEW App Release Run `35887028650` / job `107269682225` SUCCESS.
- locked source `3f8d5a0f4fa432b7b29076494602d0c0749de6e9`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`.
- `PREVIEW_APP_VERSION=153`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Hosting only. Worker / Functions / Rules / Firestore / D1 / 사용자 데이터 변경 없음.

**다음 실사용 게이트**
- PREVIEW app153에서 일반 V1 곡 1곡만 생성.
- 완전 성공 판정은 최초 곡 생성 성공 + 금지어/언어/섹션 후처리까지 모두 성공했을 때만 인정.
- 금지어가 실제로 없는 곡이면 추가 호출이 없어도 정상.
- 금지어 교정이 발생한 곡에서는 한 모델 timeout 후 shared fallback으로 이어지는지 확인.
- 반복 생성으로 provider quota를 소모하지 않는다.
- TEST / PRODUCTION 승격 금지.

## 0ER. app152 0-token 실패 원인 확정 — 3.6 강제 timeout 복구 및 PREVIEW Function 배포 (2026-09-24 KST)

**실사용 근거**
- 최신 실패 세션에서 3.8은 free-tier daily quota 20회 초과로 1.8s 즉시 실패, 3.7은 daily quota cooldown으로 skip.
- 이어진 3.6/3.5/3.5-lite는 각각 정확히 45.0s / 20.0s / 20.0s에 종료.
- 코드의 `GEMINI_BOUNDED_ATTEMPT_TIMEOUT_MS` 값과 정확히 일치하므로 세 fallback은 provider 명시 실패가 아니라 SORIDRAW 자체 AbortSignal timeout으로 종료된 것임을 확정.
- 역사 commit 848에서 약 34K 대형 곡 요청의 latency waste를 줄이기 위해 3.6=45s 등 bounded timeout을 도입했고, 이후 큰 곡 생성에도 이 제한이 남아 있었음.

**최소 복구**
- 복잡한 구조 변경 없이 최초 곡 생성용 3.6 timeout만 **45s → 120s**로 확대.
- 3.8/3.7 quota handling, 3.5=20s, 3.5-lite=20s, 5 physical attempts 상한, Interactions fallback route, prompt/lyrics/5단 계약은 그대로 유지.
- Firebase Function 전체 timeout 180s이므로 3.6에 충분한 완료 시간을 주면서 뒤 fallback 여유도 남김.

**검증 / 배포**
- source commit `d910ab98fd56a38cddd01fc2a57075eb4bb8f3c5`.
- Source Audit Run `35885073940` SUCCESS: Functions build + 3.6=120s + fallback route + 5-attempt ceiling PASS.
- PREVIEW Gemini Function Tune Run `35885073991` SUCCESS.
- PREVIEW Function update / shared TEST·PRODUCTION Function unchanged / runtime / CORS 검증 PASS.
- Hosting app은 app152 그대로. Worker / D1 / Firestore / Rules / 사용자 데이터 변경 없음.

**다음**
- PREVIEW 일반 V1 1곡만 재생성.
- 3.6가 45.0s에 잘리는 현상이 사라지고 45s 이후 계속 처리되거나 성공하면 원인/복구 검증 PASS.
- 성공 시 provider promptTokens/처리시간/출력 품질 확인.
- 실패 시 반복 생성 금지; 이번에는 3.6 실제 provider status 또는 120s 경계만 기준으로 다음 원인 분리.
- TEST / PRODUCTION 승격 금지.

## 0EQ. app152 실사용 3곡 실패 → PREVIEW Gemini Function fallback API 통일 배포 (2026-09-24 KST)

**사용자 실사용**
- app152 PREVIEW에서 일반 V1 곡 3곡 생성 시도, 3곡 모두 실패.
- 첫 곡 세션: 총 4 physical attempts / 33.0s / provider usage 0 tokens.
  - gemini-3.8-flash: 약 0.85s 후 upstream unavailable.
  - gemini-3.7-flash: 무료 등급 일일 요청 한도 소진 cooldown으로 사전 skip.
  - gemini-3.6-flash: 약 0.23s 후 upstream unavailable.
  - gemini-3.5-flash: 약 2.7s 후 upstream unavailable.
  - gemini-3.5-flash-lite: 20s bounded timeout.
- 뒤의 두 곡도 1-call 세션으로 각각 약 22.0s / 2.5s에 실패. 기존 cooldown 때문에 앞선 실패 모델들이 반복 호출되지 않은 결과로 판단.
- 모든 실패가 input/output/thought total 0 tokens이므로 app152의 24.7k source compaction 자체의 provider 처리 결과는 아직 측정할 수 없음.

**원인 분리**
- Google 현재 공식 문서 기준 gemini-3.8/3.7/3.6/3.5/3.5-lite는 지원 모델이며 Interactions API 지원 대상.
- 사용자 세션에서 3.7은 실제 free-tier daily quota exhaustion으로 확인됨.
- 기존 PREVIEW Function은 3.8/3.7만 Interactions API, 3.6/3.5/3.5-lite fallback은 legacy generateContent API를 사용하고 있었음.
- 한 모델 quota만으로 전체 실패를 단정하지 않고, 0-token unavailable fallback 경로를 줄이기 위해 initial five-model chain을 동일 Interactions API로 통일.

**구현 / 검증**
- source commit `04c68097c91a9cd9f7d1a5a96ded731cfb98e84b`.
- 변경:
  - `functions/src/index.ts`: initial chain 3.8/3.7/3.6/3.5/3.5-lite 모두 `callGeminiInteraction`.
  - `functions/scripts/build-secured-index.cjs`: generated runtime에도 동일 route + 기존 per-model bounded timeout 보존.
  - 새 no-deploy source audit workflow 추가.
- Source Audit Run `35882653272` SUCCESS: Functions Build / unified Interactions route / 5-attempt ceiling / daily quota guard / bounded timeout PASS.
- 모델 순서, physical call max 5, prompt/lyrics/5단 구조, Firestore schema/user data 변경 없음.

**PREVIEW Function 배포**
- deployment commit `b94684a49fb410994c1bf8ea2e3f54fd1e76123f`.
- PREVIEW Gemini Function Tune Run `35882735701` / job `107255022564` SUCCESS.
- `PREVIEW_GEMINI_FUNCTION_UPDATED=PASS`.
- `SHARED_GEMINI_FUNCTION_UNCHANGED=PASS` — TEST/PRODUCTION shared Gemini Function 비변경.
- `PREVIEW_RUNTIME=nodejs22`, `PREVIEW_GEMINI_CORS=PASS`.
- Firebase deploy artifact cleanup policy warning은 기존 알려진 warning이며 Function update 자체는 성공.
- Hosting app은 app152 그대로. Worker / D1 / Firestore / Rules / 사용자 데이터 변경 없음.

**다음**
- provider free-tier daily quota/capacity 영향이 남아 있을 수 있으므로, 사용자에게 반복 생성 요구 금지.
- PREVIEW에서 일반 V1 1곡만 재검증. 성공 시 provider promptTokens와 처리시간을 app150 33k 사례와 비교.
- 동일 0-token 실패면 prompt를 더 줄이지 말고 quota/reset/account tier 및 provider availability를 원인으로 분리.
- TEST / PRODUCTION 승격 금지.

## 0EP. PREVIEW app152 — Gemini 메인 V1 systemInstruction 중복 압축 배포 완료 (2026-09-24 KST)

**배경**
- app150 실사용에서 최초 생성 요청이 전체 약 150,872~152,355 chars, 그중 systemInstruction 약 146,458~147,941 chars로 확인됐고 3회 연속 생성 실패가 발생했다.
- app151에서 app149 Gemini runtime으로 즉시 복구한 뒤, 사용자 추가 실사용을 반복시키지 않고 코드측 owner 분석으로 진행했다.

**app152 변경**
- 메인 V1 systemInstruction의 장문 중복 설명을 압축했다. 전용 owner가 이미 책임지는 Story Context / Hook Blueprint / Section Performance Plan / Section Slot Contract / Section Blueprint / lyric density / Arrangement Plan / section cue / language mix / multi-vocal identity 규칙 자체는 제거하지 않았다.
- 제목 장문 예시, 반복되는 멀티보컬 파트분배 예시, 중복된 5단 productionPrompt 설명, 반복 가사 문체 설명을 간결한 계약으로 축약.
- 메인 systemInstruction TypeScript initializer source 크기: **59,918 → 24,771 chars (-35,147 / -58.7%)**.
- 이 수치는 source initializer 기준이다. 실제 provider promptTokens/runtime payload 감소량은 다음 PREVIEW 실사용 1회 전까지 확정 주장하지 않는다.
- app version 152.

**검증**
- 정확한 메인 systemInstruction을 잡도록 verifier를 수정한 뒤 Release System Audit Run `35878475721` **SUCCESS**.
- audit log: beforeSystemInstructionSourceChars=59,918 / after=24,771 / `APP147_GEMINI_PROMPT_AND_CUE_AUDIT=PASS`.
- TypeScript PASS / Build PASS / `VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS` / like regression PASS.
- TEST/PRODUCTION Worker dry-run PASS / shared D1 read-only preflight PASS.
- Firebase Functions / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 변경 없음.

**PREVIEW 배포**
- Firebase PREVIEW Hosting Run `35878798592` / job `107241573504`: 모든 release steps SUCCESS.
- locked source `3260ea781702d9c73ba0e3f4fb1126e084991e46`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=152`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- 실제 PREVIEW는 app152.
- Worker / Functions 재배포 없음.

**다음 실사용 게이트**
- PREVIEW 업데이트 후 일반 V1 곡 **1곡만 먼저 생성**한다.
- 1차 합격: 생성 성공 + 기존 5단 productionPrompt / 가사 / section performance cue 정상.
- 속도와 provider prompt token은 성공 결과가 나온 뒤 비교한다.
- 실패 시 무작정 재시도하지 않고 해당 1회 audit/error만 기준으로 다음 원인을 분리한다.
- TEST / PRODUCTION 승격 금지.

## 0EO. app150 실사용 전곡 생성 실패 → app151 즉시 복구 (2026-09-23 KST)

**app150 실사용 결과**
- 사용자 연속 생성 3회 모두 실패. 최초 생성 logical request가 각 2~5 physical attempts까지 갔으나 성공 0.
- 확인된 요청크기 예: 전체 약 **150,872~152,355 chars**, 그중 **systemInstruction 약 146,458~147,941 chars**. contents 220 chars, responseSchema 3,374 chars, 기타 config 39 chars, fallback 781 chars.
- 3.8/3.7은 다수 요청에서 즉시 일시적 unavailable/overload, 3.5/3.5-lite는 20초 timeout 또는 unavailable, 3.6도 장시간 후 실패 사례 확인.
- app150은 진단 계측만 추가했지만, 사용자 관점에서 업데이트 직후 생성 전부 실패했으므로 해당 PREVIEW 상태를 유지하지 않는다.

**원인 분리 확인**
- app149 → app150의 `geminiProxyClient.ts` exact diff를 재검사한 결과, 실제 Firebase Function에 보내는 `requestParams`/model chain/timeout 문자열은 변경하지 않았고 요청크기 계산과 응답 usageMetadata 로컬 표시만 추가했다.
- `productionCueOwnership.ts` 변경도 missing section을 같은 판정식으로 계산한 뒤 localStorage 진단을 기록하는 추가였으며 최초 생성 요청 경로를 바꾸지 않았다.
- 따라서 app150 진단 코드가 150k 요청을 새로 만든 것은 아니며, 기존 생성 프롬프트가 실전에서 약 146~148k chars의 systemInstruction을 만들고 있었다는 사실이 이번 측정으로 확인됨.
- 다만 provider 혼잡과 큰 입력이 동시에 존재할 수 있으므로, 단일 원인으로 단정하지 않고 이후 코드 측 owner 분석 후 축소한다.

**app151 복구**
- 정상 기능 우선 원칙에 따라 app150 진단 runtime/UI를 제거하고, app149의 Gemini 생성 runtime을 현재 preview에 forward recovery로 복원.
- 복구 commit `4d2c20e1f346a8f875899edfdb845859f235ec67`.
- Firebase PREVIEW App Release Run `35875369499` / job `107229769497` **SUCCESS**.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=151`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- app149 Music Note Suno 썸네일 수정은 유지. Firebase Functions / Worker / Rules / Firestore / D1 / 사용자 데이터 변경 없음.

**다음**
- 사용자를 반복 생성 테스트에 투입하지 않는다.
- 확보한 150~152k / system 146~148k 측정값을 기준으로 코드에서 systemInstruction owner block의 중복/과잉을 먼저 분석한다.
- 5단 프롬프트, 가사 밀도, 언어혼합, section performance cue, 모델 fallback 등 정상 품질 기능을 임의 삭제하지 않는다.
- 실제 축소안은 기존 출력 품질/요청 의미 parity verifier를 만든 뒤 별도 PREVIEW 후보로 검증한다.
- TEST / PRODUCTION 승격 금지.

## 0EN. PREVIEW app150 — Gemini 요청크기/섹션 보완 진단 Hosting 배포 완료 (2026-09-23 KST)

**배포**
- 사용자 작업 이어가기 지시에 따라 app150 PREVIEW Hosting 배포 진행.
- Firebase PREVIEW App Release Run `35873749101` / job `107224216398` **SUCCESS**.
- locked source commit `001861da3c1d1bd919ae15018ef431c574b84998`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=150`, `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`. main / production 및 TEST / PRODUCTION Hosting 비변경.
- 배포 전 Release System Audit Run `35871794547` SUCCESS: TypeScript / Build / Gemini 진단 verifier / Music Note / like regression PASS.
- Firebase Functions / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 변경 없음.

**이번 app150의 성격**
- 일반 사용자 생성 규칙, 5단 프롬프트, 모델 fallback 순서, 가사 품질, 언어혼합, 섹션 태그 판정 자체는 변경하지 않음.
- 관리자 로컬 Gemini 기록에 실제 전송 직전 요청크기 breakdown(contents / systemInstruction / responseSchema / 기타 config / fallback / total chars)만 추가.
- production cue 보완이 발생할 때 sectionName과 required ownership reason(canonical-plan / custom-production / production-only)만 추가 기록.
- raw prompt / 가사 / 사용자 입력은 저장하지 않음. 서버 read/write 추가 없음.

**다음 실사용 측정**
1. PREVIEW에서 일반 V1 곡 1~3개 생성.
2. 관리자 Gemini 기록의 최초 호출 `요청크기` 항목에서 가장 큰 구성요소 확인.
3. `섹션 지시문 보완` 호출이 생기면 같은 기록의 section / ownership reason 확인.
4. 실제 측정값을 확보한 뒤에만 33k 입력 축소 또는 production-cue 조건 수정. 정상 품질 규칙 추측 삭제 금지.
5. TEST / PRODUCTION 승격 금지. 현재 단계는 PREVIEW 실사용 진단.

## 0EM. app149 사용자 실사용 PASS + app150 Gemini 진단 후보 완료 (2026-09-23 KST)

**app149 실사용**
- 사용자 확인: Music Note Suno URL 목록 썸네일 / 저장 / 앱 재접속 유지 문제 **PASS**.
- app149 PREVIEW Hosting 상태 유지. Music Note 썸네일 작업은 종료하고 Gemini 지연/33k 입력 진단으로 복귀.

**app150 source-only 진단 변경**
- 목표는 생성 품질이나 모델 정책을 바로 바꾸지 않고, app147 실사용에서 남은 두 질문을 실제 다음 생성 1회로 판별하는 것:
  1. 최초 호출 입력 약 33k token의 실제 큰 구성요소가 무엇인지.
  2. `repairV1FinalProductionCues`가 발생할 때 어떤 section이 어떤 소유권 근거 때문에 required로 판정됐는지.
- `src/services/geminiProxyClient.ts`: 실제 Function 전송 직전 요청에서 **contents / systemInstruction / responseSchema / 기타 config / fallback instruction / 총 문자수**를 계산한다. 원문은 저장하지 않는다.
- `src/services/geminiAuditLog.ts`: 위 문자수만 기존 로컬 Gemini audit usage에 저장한다. prompt/가사 원문 저장 없음.
- `src/pages/AdminGeminiAuditPage.tsx`: 기존 관리자 Gemini 호출 카드에 요청크기 문자수 breakdown 표시. normal user UI 비변경.
- `src/services/generation/v1/sections/productionCueOwnership.ts`: 실제 missing required production cue가 있을 때 sectionName + `canonical-plan / custom-production / production-only` 소유 근거만 로컬 audit에 기록. 가사/프롬프트/사용자 원문 저장 없음.
- 관리자 화면에 최근 섹션 지시문 보완 판정을 표시해, 다음 Folk/일반 곡에서 보완 호출이 정당한지 판별 가능.
- generation prompt, response schema, 모델 5단 chain, timeout/cooldown, section cue 판정 자체, hard-ban, 언어혼합, 가사 밀도, UI 생성 결과는 **변경하지 않음**.
- `public/app-version.json`: 후보 150.

**검증**
- 첫 audit에서 신규 usage 필드가 session summary reducer에 빠진 TypeScript 오류를 발견했고 즉시 수정. 해당 실패 후보는 배포하지 않음.
- 최종 Release System Audit Run `35871794547` / job `107217464842` SUCCESS.
- TypeScript PASS / Build PASS / `APP147_GEMINI_PROMPT_AND_CUE_AUDIT=PASS` / `VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS` / like regression PASS / TEST+PRODUCTION Worker dry-run PASS / shared D1 read-only preflight PASS.
- Firebase Functions / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 변경 없음.
- **app150 미배포**. 실제 PREVIEW는 app149. 사용자 배포 요청 전 Hosting 변경 금지.

**다음 실사용 목적**
- app150 PREVIEW 배포 후 일반 V1 곡 1~3개 생성.
- 관리자 Gemini 기록에서 최초 호출의 `요청크기: 내용 / 시스템 / 응답스키마 / 기타설정 / fallback`을 확인해 33k token의 주 원인을 확정.
- `섹션 지시문 보완`이 발생하면 같은 화면의 최근 소유권 판정에서 section과 required 이유를 확인.
- 측정 결과가 나온 뒤에만 실제 prompt/schema 축소 또는 production-cue 조건 수정. 품질 규칙 추측 삭제 금지.


## 0EM. app149 사용자 실사용 PASS → Gemini 33k/섹션 보완 진단 재개 (2026-09-23 KST)

**사용자 확인**
- app149 Music Note Suno URL 썸네일: 저장 후 목록 표시 + 앱 재접속 후 유지까지 사용자 실사용 PASS.
- 따라서 Music Note 썸네일 이슈를 종료하고 보류한 Gemini 생성 비용/지연 작업으로 복귀한다.
- app149 PREVIEW 배포 Run `35864856848` SUCCESS / exact build 149 PASS / TEST·PRODUCTION 비변경 상태 유지.

**다음 Gemini 작업을 위한 현재 코드 확인**
- 현재 `src/services/geminiService.ts`의 V1 최초 생성 `systemInstruction` 템플릿 자체가 source 기준 약 **59,945 chars**이며, 여기에 다수의 동적 instruction block이 실제 런타임 문자열로 확장된다.
- app147 사용자 실사용 최초 성공 입력은 약 32.9k~33.8k tokens. 기존 app147 source initializer audit 15,761 chars만으로는 실제 provider 입력을 설명할 수 없었다.
- 최초 생성 요청은 `systemInstruction + contents + responseSchema`를 함께 전송하므로, 실제 전송 직전 각 구성요소의 런타임 길이를 계측해야 안전한 축소 판단이 가능하다.
- 현재 관리자 Gemini 기록은 provider의 prompt/output/thought/total token과 호출 시간/모델은 보이지만, 어떤 instruction block이 입력량을 차지했는지는 기록하지 않는다.
- `repairV1FinalProductionCues`도 unresolved section 이름은 내부에서 계산하지만, 왜 그 section이 required였는지(`planOwnsAudibleEvent / customOwnsAudibleEvent / explicitlyProductionOnly`)가 관리자 기록에 남지 않아 Folk Rock 1건의 보완 호출 정당성을 화면만으로 판단할 수 없다.

**다음 단계 원칙**
- 먼저 진단 가능성을 만든다. 품질 규칙 삭제/모델 순서/timeout/5회 상한 변경은 이번 단계 금지.
- 관리자 전용 로컬 audit에 **길이/구성 통계만** 기록하고 raw prompt/가사/사용자 입력을 저장하지 않는다.
- 실제 Gemini 호출 추가 없음, Firebase/Firestore/D1/R2 read/write 추가 없음.
- 이 진단 결과로 가장 큰 중복/과잉 block을 확인한 다음 별도 commit에서 실제 prompt 축소를 한다.
- 구현은 Codex Medium/High 범위. 배포는 구현·독립 감사 후 별도 판단.


## 0EL. PREVIEW app149 — Music Note 재접속 썸네일 보완 Hosting 배포 완료 (2026-09-23 KST)

**배포**
- app148 사용자 영상 재검증 FAIL을 바로잡는 app149 PREVIEW Hosting 배포.
- Firebase Hosting Run `35864856848` / job `107193751360` SUCCESS.
- locked source `337c2b0e6e9ca72d518607310ee90e75dc3dc225`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=149`, `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`. main 및 production 분리 유지.
- URL `https://preview.soridraw.com/`.
- Audit Run `35864420171` SUCCESS: TypeScript/Build/verify-031/like regression PASS. Hosting TypeScript/Build도 PASS.
- Functions / Worker / Rules / Firestore / D1 / 사용자 데이터 삭제·변환·migration 없음. 서버 read/write 호출 종류 증가 없음.

**app149 수정 내용**
- IndexedDB 상세 draft를 목록에 다시 반영하여 stale catalog가 신규 Suno 썸네일을 덮어쓰는 문제 완화.
- Music Note 상세 저장 성공 후 catalog delta를 직렬 발행하여 기존 snapshot이 먼저 발행되는 순서 문제 수정. 정상 묶음 저장과 성능/UI 보호.
- 실제 모바일 및 PC 재접속 시나리오 **사용자 실사용 검증 전**. app149 배포 SUCCESS와 실제 버그 해결 PASS는 별개.

**다음**
- 사용자 모바일에서 기존 URL 연결 곡 열기 → Suno URL 저장 → 목록 커버 → 앱 완전 종료/재접속 → 목록 커버 지속 확인. 2개 URL 우선순위 교체/삭제와 PC도 확인.
- 기존 app148에서 이미 서버 저장되고 R2 catalog 갱신이 누락된 곡은 app149에서 다시 저장해 새 delta가 발행되는지 확인. 재저장 없이 복구가 필요하면 추가 설계·검증; 전체 재생성·백필 금지.
- 썸네일 문제 검증 후 Gemini 33k/후속 섹션 보완 문제로 복귀.


## 0EK. app148 영상 재검증 FAIL → app149 원인 보완 (2026-09-23 KST)

**사용자 모바일 64초 영상**
- 수노 URL 1/2 아트워크가 디테일 화면에서 보여도 해당 Music Note 목록은 음표로 표시된다.
- 디테일 URL 저장을 누르면 목록에 커버가 보이나 앱을 종료/재접속하면 사라진다.
- 따라서 app148의 카드 메모리 미러링만으로는 미완료. app148 실사용 FAIL로 판정.

**코드에서 추가 확인한 두 개의 별도 원인**
1. R2 Music Note catalog의 기존 summary가 나중에 도착하거나 앱 재시작 시 기존 로컬 목록을 덮을 수 있다. app148의 카드 미러링은 `favoritesStore` 메모리만 갱신하고, 미전송된 IndexedDB 상세 draft를 목록 부트스트랩에 합성하지 않았다.
2. `pageSyncCoordinator`가 catalog delta publish를 Music Note 상세 Firestore 배치 flush와 동시에 시작했다. catalog dirty가 실제 저장 후 표시될 때는 처음 pending count가 0일 수 있으며, 먼저 전송할 경우 이전 커버 상태가 R2에 남는 타이밍 문제가 있었다.

**app149 PREVIEW 변경**
- `src/pages/FavoritesPage.tsx`: 기존 IndexedDB 상세 draft를 UID·곡 ID 단위로 읽어, R2 catalog와 동일 기기 화면이 새로 갱신될 때 미전송 Suno 미디어를 카드에 복원한다. 서버 버전이 draft보다 최신이면 덮어쓰지 않는다. 기존 상세·목록·정상 묶음 저장 유지.
- `src/lib/pageSyncCoordinator.ts`: 기존 페이지 종료 batch에서 관련 mutation handler 성공을 확인한 **이후에만** 최신 dirty catalog delta를 계산해 발행. 잘못된 사전 카탈로그를 배포하거나 성공 전 dirty를 지우지 않는다. 실제 저장 없음 상태에는 catalog write 없음.
- `scripts/verify-031-music-note-detail-batched-draft.mjs`: draft 재적용, 버전 충돌 보호, batch→catalog 순서 검사 추가.
- `public/app-version.json`: 149 후보. Firestore/R2/D1 스키마, 사용자 데이터, Functions, Worker, Rules 변경 없음. TEST/PRODUCTION 변경 없음.

**검증**
- Release System Audit Run `35864420171` / job `107192283722` SUCCESS.
- TypeScript PASS, Build PASS, `VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS`, 기존 like regression PASS, TEST/PRODUCTION Worker dry-run PASS, shared D1 read-only preflight PASS.
- isolated synthetic D1 billing 단계 SKIPPED.
- 실제 모바일/PC 앱149 실사용 검증 전이며 재접속 문제 해결을 아직 PASS로 주장하지 않는다.
- app147 Gemini 작업은 보류 유지.


## 0EJ. PREVIEW app148 — Music Note Suno 썸네일 수정 Hosting 배포 완료 (2026-09-23 KST)

**사용자 승인/배포 결과**
- 사용자 명시적 요청 `배포까지 해줘`에 따라 PREVIEW Hosting만 배포.
- app148 최종 Hosting Run `35857460912` / job `107169269013` SUCCESS.
- locked source commit `6fab9fc859304049ee832ab2889c37c0dadcde16`.
- `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=148`, `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS` (main/production refs와 test.soridraw.com, soridraw.com index unchanged).
- URL: `https://preview.soridraw.com/`.
- Release Audit Run `35850755112` SUCCESS; TypeScript/Build/verify-031 PASS. Hosting Run TypeScript/Build도 재통과.
- 변경 내용은 섹션 `0EI` 기록: 디테일 Suno URL 저장/삭제/메인 선택 후 Music Note 목록 카드의 Suno 이미지 메타데이터만 즉시 갱신. 상세 hydration 값도 재사용.
- Firebase Functions / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 이동·변환·일괄수정 없음. 서버 읽기/쓰기 경로 추가 없음.

**실사용 미검증**
- 사용자 모바일/PC 실사용 확인 전. 등록 직후 목록 이미지, 상세 닫기, 1/2순위 교체, URL 제거, 페이지 재진입, 다른 기기 동기화의 실제 화면 결과는 아직 PASS로 보고하지 않는다.
- 다음 단계: 사용자가 PREVIEW에서 기존 사례와 새 URL 하나를 시험하여 화면을 확인한다. 문제가 남으면 R2/catalog delta를 진단하되 전체 상세읽기/캐시 세대 초기화 없이 원인 분리.
- 뮤직노트 실사용 확인 이후 보류된 app147 Gemini Folk Rock의 section-repair 추가 호출/33k 입력 토큰 문제로 복귀.


## 0EI. app148 PREVIEW 후보 — Music Note Suno URL 연결 뒤 목록 썸네일 누락 수정 (2026-09-23 KST)

**사용자 제보와 확인**
- 27.49초 모바일 영상: Music Note 곡 목록의 `[Microhouse] 선 넘어 달리기 | Step Beyond` 카드에는 기본 음표만 나타남. 같은 곡의 Detail & Edit에는 Suno URL 1/2 커버 이미지가 정상 표시. 디테일 종료 후 목록도 기존 음표로 남음.
- 코드 원인: Detail URL 저장은 `queueFavoriteDetailPatch`에서 `selectedSong`과 IndexedDB draft만 즉시 바꾸고, 목록의 `favoritesStore`에는 최신 `sunoLinks / mainSunoIndex / sunoCoverUrl` 등이 전달되지 않음. 목록은 기존 summary 캐시를 렌더링.
- 정상 로컬 우선 IndexedDB draft + 기존 페이지 이탈/명시적 동기화 묶음 서버 저장을 유지하며 화면 정보만 동기화한다.

**변경**
- `src/pages/FavoritesPage.tsx`: URL 추가/제거/1순위 교체가 IndexedDB draft에 반영되면 카드의 최소 Suno media 필드만 기존 `favoritesStore`에서 즉시 갱신한다. URL 편집 되돌림 시 기준 카드 미디어를 복구한다. 기존 상세 열기에서 이미 로드한 cover URL도 목록에 재사용해 오래된 summary로 인한 음표 표시를 줄인다.
- 새 서버 read/write, 전체 목록 재조회, 전체 이미지 프리패치, 새로운 캐시 세대, Firestore/R2/D1 구조 변경 없음. 정상 목록 UI 크기·위치·스타일·좋아요/잠금/공개·1순위 재생·2개 URL 지원 비변경.
- `scripts/verify-031-music-note-detail-batched-draft.mjs`에 URL 저장/되돌림/상세 hydration의 카드 갱신 검사 추가.
- `.github/workflows/soridraw-release-system-audit.yml`의 기존 isolated regression 단계에서 verify-031 실행 추가. 별도 새 워크플로 없음.
- `public/app-version.json` 후보 버전 148.
- 실제 코드 commit `bc7b0a3d198938c846d33b20e708ccb0c83fd02a`. 기존 기준 HEAD `f81e63997b21992994a232589753dd9818bb728e`. audit request HEAD `dd687354e59d4ad8de0342cde121dc605bf1d2a4`.

**검증**
- Release System Audit Run `35850755112`, job `107147594457` SUCCESS.
- TypeScript PASS, Build PASS, verify-031 `VERIFY_031_MUSIC_NOTE_DETAIL_BATCHED_DRAFT=PASS`.
- 기존 static audit / like regression / TEST+PRODUCTION Worker dry-run / shared D1 read-only preflight PASS. isolated synthetic D1 billing SKIPPED.
- 실제 PREVIEW Hosting **아직 app147**. app148은 **코드/검사 완료, 미배포, 모바일 실사용 검증 전**.
- Firebase Functions / Worker / Rules / Firestore / D1 / 사용자 데이터 / TEST / PRODUCTION 변경 없음.

**다음**
1. 명시적 PREVIEW 배포 지시 시 검증된 app148 `preview` HEAD 고정 후 Firebase Hosting만 배포하고 exact build 확인.
2. 등록 → 목록에서 즉시 썸네일, 상세 닫기, 2개 URL 1순위 교체, URL 제거, 페이지 이동/재진입, PC/모바일를 실제 확인한다.
3. 목록에 새로 추가된 미디어가 없는 다른 기기에서도 등록 이후 서버 동기화 때 동일하게 보이는지 확인한다. 실패하면 R2 catalog delta 정합성을 별도 감사한다. 목록 진입 시 전곡 Firestore 조회 금지.
4. 이 항목이 실사용에서 통과하면 보류된 app147 Gemini Folk Rock 후속 보완/33k prompt 원인 진단으로 복귀한다.


## 0EH. app147 사용자 PREVIEW 3곡 생성 진단 수신 — 보완 호출 1/3, 최초 입력 33k 유지 (2026-09-23 KST)

**사용자 제공 화면 (2026-09-23 오후 07:33~07:35 KST 표시)**
1. Melodic Rap `아직 그대로 남아`: 완료, 호출 2회, 35,591 tokens(입력 32,931/출력 2,660), 전체 1분 16초. `gemini-3.8-flash` 최초 생성 35.0초 timeout 실패 → `gemini-3.7-flash` 33.9초 성공. 섹션 지시문 보완 호출 없음.
2. Folk Rock `거울을 볼 때마다`: 완료, 호출 5회, 36,590 tokens(입력 33,804/출력 2,671/추론 115), 전체 1분 1초. 3.8 in-flight skip, 3.7 8.7초 busy 실패, 3.6 5.6초 busy 실패, 3.5 20.0초 timeout 실패, 3.5-lite 8.7초 최초 생성 성공 → `섹션 지시문 보완` 3.5 10.6초 성공(입력 374/출력 42/추론 115, 531 total).
3. Heavy Metal `발걸음마다 남아`: 완료, 호출 4회, 38,063 tokens(입력 34,810/출력 3,253), 전체 45.8초. 3.8 timeout cooldown skip, 3.6 busy cooldown skip, 3.7 14.3초 실패, 3.5 15.2초 실패, 3.5-lite 9.9초 최초 생성 성공 → `금지어 통합 교정` 3.5-lite 961ms 성공(입력 1,047/출력 127, 1,174 total). 섹션 지시문 보완 호출 없음.

**판정 및 범위**
- 해당 3곡에서는 섹션 production-cue 보완 호출이 1/3곡에서 남았다. 이는 app147이 모든 보완을 제거한 것이 아니라 `required audible production event`만 보완하도록 바꾼 설계와 양립한다. Folk Rock 결과의 실제 섹션/plan ownership이 보이지 않아 이번 호출이 정당한지 또는 오분류인지 판정 불가.
- 3곡 모두 생성 완료. 그러나 처리시간 45.8~76초로 여전히 길다. 주요 지연은 최초 생성 모델의 실패/timeout 및 재시도; Folk 보완 10.6초도 추가 지연.
- 최초 성공 입력은 32,931 / 33,430 / 33,763 tokens로 약 33k이며, 원래 목표인 34k 컨텍스트 감소는 아직 달성하지 못했다. prompt 자체는 app147에서 변경하지 않았으므로 예상 범위.
- Heavy Metal의 금지어 교정은 기존 app146 계약대로 3.5-lite 단일 호출/961ms로 정상 동작.
- 해당 화면만으로 후속 Gemini 보완 호출의 `missingSections`, canonical plan `soundCue`, 실제 렌더링 cue 품질은 보이지 않는다. 합격/불합격 단정 금지.

**다음 작업**
- 먼저 Folk Rock 1건에서 실제 required section 및 canonical/renderer/sibling cue 미충족 근거를 진단으로 확인한다. 보완 호출을 무조건 삭제하지 않는다.
- 최초 요청 payload 구성별 **실제 전송 직전 문자열 크기**와 provider 사용량을 상관 비교해 33k 원인을 좁힌다. 정적 initializer 문자수만으로 실제 prompt-size 증명 금지.
- 품질/가창 cue/언어 혼합/5단 prompt/모델 5단 fallback/사용자 원본 및 정상 UI 보호.
- 변경이 필요하면 Codex High preview → 독립 감사 → PREVIEW 실사용의 새 작업으로 분리한다. 이번 기록은 문서만 변경하며 배포 없음.


## 0EG. PREVIEW app147 — production-cue ownership 정합화 배포 완료 / 실사용 확인 대기 (2026-09-23 KST)

**코드/감사**
- Codex 구현 commit: `718c9b5b00d90ab0a1509c19df9038621fdce182`.
- 최종 production-cue 판정은 모든 section 강제가 아니라 실제 audible production event 소유 section만 required로 본다.
- ordinary sung section에 local production event가 없으면 standalone production cue blank를 정상 허용한다.
- sung / vocal-ad-lib section의 mandatory performance cue 계약은 그대로 유지한다.
- canonical sectionPerformancePlan 또는 sibling card에 유효 production cue가 있으면 재사용하고, 실제 required event가 끝까지 없는 경우에만 `repairV1FinalProductionCues` fallback을 남겼다.
- prompt-size source audit은 품질 규칙을 삭제하지 않았으며 source-character 기준 측정값은 before/after 동일했다. 실제 provider 입력 token 감소는 아직 주장하지 않는다.
- Release System Audit Run `35783411655` / job `106934224450` SUCCESS.
- TypeScript PASS / Build PASS / static release verification PASS / like regression PASS / TEST+PRODUCTION Worker dry-run PASS / shared D1 read-only preflight PASS.
- isolated synthetic D1 billing 단계는 이번 audit에서 SKIPPED였으며, 이번 app147은 D1/Worker 변경이 없어 배포 합격 판단에 필요한 경로는 아님.

**PREVIEW 배포**
- Firebase PREVIEW Hosting Run `35783654947` / job `106935052147` SUCCESS.
- locked release source: `c277be333fd1ed5e9e7efa11d66271ef5153fc0a`.
- `PREVIEW_APP_VERSION=147` PASS.
- `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Functions / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 변경 없음.

**실사용 확인**
1. app147에서 일반 V1 곡 1~3개 생성.
2. 관리자 Gemini 호출 기록에서 ordinary sung section의 optional production cue 때문에 `섹션 지시문 보완(repairV1FinalProductionCues)`이 추가 호출되지 않는지 확인.
3. 실제 Instrumental / Interlude / Break / Stop 또는 사용자가 지정한 production event가 누락되는 경우에는 필요한 보완 경로가 여전히 작동하는지 확인.
4. sung section의 performance cue가 빠지거나 bare section tag가 생기지 않는지 확인.
5. 최초 생성 입력 token을 계속 기록해 33.8k~34.4k 상태를 비교한다. app147은 prompt 자체를 줄이지 않았으므로 입력 token이 비슷해도 이상이 아니다.
6. 직전 app146 화면의 3.5-lite 섹션 보완 성공시간은 **9.5초가 아니라 0.951초**가 정확한 값이다.


## 0EF. app147 source-only — production-cue ownership 정합화 + prompt-size source audit 완료 (2026-09-23 KST)

**구현**
- 최종 section integrity가 instrument cue 옵션만으로 모든 section의 standalone production cue를 강제하던 판정을 제거했다.
- 이제 canonical `sectionPerformancePlan.soundCue / arrangementAction`, custom section의 실제 audible event, 또는 lyric-free Instrumental/Interlude/Break/Stop/Solo 계약이 있는 section만 production cue required 대상으로 계산한다.
- ordinary sung section의 optional production-cue blank는 정상으로 인정한다. 반면 sung section tag의 기존 performance-cue 필수 계약은 변경하지 않았다.
- sibling/canonical cue 재사용은 유지하고, 실제 required event가 누락된 경우에만 `repairV1FinalProductionCues` fallback을 유지했다.

**prompt-size source audit**
- 기준 `d3d8d87157dec499d7b51293034700531f6efea3`과 동일한 TypeScript initializer source-character 방식으로 owner block을 측정했다.
- 측정 owner 합계 before/after `15,761 / 15,761 chars`, `systemInstruction` initializer source before/after `1,817 / 1,817 chars`로 동일하다.
- 가장 큰 계측 블록은 Japanese first-pass contract `6,031 chars`, sectionPerformancePlan output instruction `5,933 chars`였다.
- prompt owner 블록 사이에서 안전하게 제거할 완전 동일 중복은 확인되지 않았다. 품질 계약을 추측으로 삭제하지 않았으므로 최초 실사용 입력 약 33.8k~34.4k token은 이번 source-only 후보에서도 감소를 주장하지 않는다.
- 신규 verifier가 optional sung blank, canonical required/present cue, custom vocal-only, instrumental transition 및 prompt owner size/중복 후보를 deterministic하게 검사한다.

**상태/보호**
- app version 후보를 147로 올렸지만 **미배포**다. 실제 PREVIEW는 app146 그대로다.
- Firebase Functions / shared Function / Cloudflare Worker / Rules / Firestore / D1 / 사용자 데이터 / TEST / PRODUCTION 변경 없음.
- 모델 5단 chain, quota/cooldown/in-flight, hard-ban 3.5-lite 단일 교정, UI/좋아요/Music Note/Library/Explore 비변경.
- 남은 위험: source audit은 실제 provider tokenizer 측정이 아니며, app147 실사용 입력 token과 required production event의 실제 추가 호출 여부는 배포 후 별도 확인이 필요하다.

## 0EE. app146 실사용 1분 4초 병목 확인 + app147 Codex 작업 기준 고정 (2026-09-23 KST)

**사용자 실사용 결과**
- app146 곡 생성 총 약 1분 4초.
- 3.8/3.7은 Free Tier 일일 quota로 skip, 3.6은 cooldown/최초 시도 실패, 3.5는 20초 timeout, 3.5-lite가 12.7초에 최초 생성 성공.
- 최초 성공 호출 입력 33,853 / 출력 4,068.
- 이후 `repairV1FinalProductionCues`(관리자 표시: 섹션 지시문 보완)가 추가 실행되어 3.5 15초 timeout + 3.5-lite 0.951초 성공. 보완 payload 자체는 입력 576 / 출력 117로 작지만 전체 지연을 크게 늘림.

**코드 감사에서 확인한 핵심**
- 후속 “섹션 지시문 보완”은 sung section의 performance cue 보완이 아니라, section별 standalone **production/sound cue** 누락을 채우는 경로다.
- `collectV1MissingProductionCueSections()`가 instrument cue 옵션 ON일 때 blueprint의 모든 section을 production-cue 필수 대상으로 잡는다.
- 반면 최초 `sectionPerformancePlan` 계약은 sung section의 performance cue는 필수로 두면서, `soundCue`는 해당 section에 실제 audible production event가 있을 때만 요구한다.
- 즉 최종 integrity가 최초 생성 계약보다 더 엄격해 optional production-cue blank를 추가 Gemini 호출로 보완할 가능성이 확인됐다.
- sung section performance cue 필수 규칙은 그대로 보호한다.

**다음 작업**
- `DOCS/NEXT_CODEX_TASK.md`에 app147 Codex 작업을 고정.
- 목표 1: optional production cue 때문에 `repairV1FinalProductionCues`가 발생하지 않게 필수/선택 판정을 canonical sectionPerformancePlan과 정합화.
- 목표 2: 33~34k 최초 입력을 블록별로 계측하고 **완전 중복만** 축소. 품질 규칙 삭제 금지.
- 모델 5단 chain, quota/cooldown/in-flight, hard-ban 3.5-lite 단일 교정, UI/사용자 데이터/TEST/PRODUCTION은 보호.
- Codex는 구현/테스트/commit까지만 수행하고 **배포하지 않는다**. 이후 Work/ChatGPT 독립 검증 후 PREVIEW 배포 판단.

**현재 상태**
- 런타임 코드 변경 없음.
- PREVIEW app146 배포 상태 그대로.
- Firebase / Functions / Worker / Rules / 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.


## 0ED. PREVIEW app146 — Gemini 후속 교정 호출 축소 + quota 문구 한글화 완료 (2026-09-23 KST)

**app145 사용자 3곡 실사용 결과**
- 곡 1: `gemini-3.8-flash` 최초 생성 18.3초 SUCCESS, 호출 1회. 입력 34,383 / 출력 3,533 / 전체 37,916.
- 곡 2: 3.8 Free Tier 일일 20회 한도 FAIL → 3.7 10.3초 SUCCESS. 이후 금지어 통합 교정이 3.7 rate limit → 3.6 high-demand → 3.5 high-demand로 추가 호출을 소모. 전체 47.1초.
- 곡 3: 3.8 daily quota, 3.7 in-flight, 3.6/3.5 cooldown을 실제 호출 없이 건너뜀 → 3.5-lite 13.1초 SUCCESS. 금지어 통합 교정도 3.5-lite 0.682초 SUCCESS. 전체 18.4초.
- 판정: app145 daily quota / cooldown / in-flight skip은 실제 작동 PASS. 최초 생성 5단 chain 유지가 타당.
- 입력 토큰은 여전히 약 33.8k~34.4k로, 145의 creative/story 중복 제거만으로는 유의미하게 줄지 않음. 품질 규칙을 증거 없이 추가 삭제하지 않는다.

**app146 최소 수정**
- 최초 곡 생성의 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 5단 chain은 그대로 보호.
- 단순 최종 금지어 교정(`rewriteLyricHardBanCards`, `rewriteLyricHardBanLines*`)은 `gemini-3.5-flash-lite` **단일 1회**만 사용.
- 3.5-lite 교정 실패 시 상위 `applySharedLyricHardBanGuard`의 기존 local fail-open 정리가 작동하므로 3.8/3.7/3.6/3.5를 교정 때문에 추가 소모하지 않음.
- 관리자 audit의 Free Tier rate-limit 번역 정규식 수정. `requests per day on Free Tier`, `Please retry later`, provider URL이 영어 조각으로 남던 현상 제거.
- 모델 ID / HTTP code / 진단 code는 식별자로 유지.
- app version 146.

**검증/배포**
- 정적 코드 계약: hard-ban line/card 모두 3.5-lite single model PASS.
- Release Audit Run `35779322021` / job `106920447942` SUCCESS.
- TypeScript PASS / Build PASS / like regression PASS / TEST+PRODUCTION dry-run unchanged.
- PREVIEW Hosting Run `35779541715` / job `106921223017` SUCCESS.
- locked source `9db0470cf5186266dbca49e2426565e4a6339e68`.
- remote `PREVIEW_APP_VERSION=146`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- Functions/Worker/Rules/user data 변경 없음. PREVIEW Gemini Function은 app145의 daily quota skip / 3.5 20s / low-thinking 상태 그대로.

**다음 실사용 합격선**
1. app146에서 최초 생성 1~3곡. 3.8 성공 가능 여부/시간은 provider 상태에 따라 변동 가능.
2. 금지어 통합 교정이 발생하면 모델 호출은 3.5-lite 1회만 보여야 함. 3.7/3.6/3.5 추가 교정 fallback 금지.
3. 3.8/3.7 daily quota 상태면 다음 곡에서 실제 호출 없이 skip 표시 확인.
4. 관리자 오류 설명에 Free Tier/requests per day/Please retry/URL 영어 문장이 남지 않아야 함.
5. 최초 입력 34k 자체는 별도 prompt-size 감사 항목으로 유지. 이번 app146에서 품질 규칙 추가 삭제 없음.


## 0EC. PREVIEW app145 — Gemini 2차 최적화 및 Hosting 배포 완료 (2026-09-23 KST)

**적용 내용**
- lyric story brief에서 COMMON SONG CREATIVE BRIEF와 중복되던 raw source/mood payload 제거. 품질 규칙/우선순위/분리 규칙은 유지.
- Gemini Free Tier 일일 요청 한도(`requests per day`)가 명시된 429는 `daily_quota_exhausted`로 분리하고, 태평양 시간 자정 리셋까지 해당 모델을 건너뜀. 일반 429/503은 기존 짧은 cooldown 유지.
- 초기 fallback의 `gemini-3.5-flash` bounded timeout 30초 → 20초.
- 모델 우선순위 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite` 유지.
- 관리자 화면에서 daily quota cooldown 사유 한국어 표시.
- app version 145.

**PREVIEW Function 검증/배포**
- Function Tune Run `35773813273` / job `106901814634` SUCCESS.
- `PREVIEW_GEMINI_35_TIMEOUT_20S=PASS`
- `PREVIEW_GEMINI_DAILY_QUOTA_SKIP=PASS`
- `PREVIEW_GEMINI_PROMPT_DUPLICATE_REMOVAL=PASS`
- `PREVIEW_GEMINI_CHAIN_ORDER_UNCHANGED=PASS`
- PREVIEW Gemini Function updated PASS / CORS PASS.
- shared `generateGeminiContent` unchanged PASS → TEST/PRODUCTION 공용 Function 비변경.

**전체 Audit / Hosting**
- Release Audit Run `35774060137` / job `106902650471` SUCCESS.
- TypeScript PASS / Build PASS / static release verification PASS.
- PREVIEW Hosting Run `35777003931` / job `106912643575` SUCCESS.
- locked source `4cd2fd0263e97c746a5d75f913cf42d0ef571988`.
- remote `PREVIEW_APP_VERSION=145`.
- `PREVIEW_EXACT_BUILD=PASS`.
- `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker/Rules/user data/좋아요 구조 변경 없음.

**실사용 다음 확인**
- app145에서 동일 조건 3곡 생성.
- 3.8 첫 성공률/시간, 3.7 daily quota skip, 3.5 실패 시 최대 약 20초 ceiling, 최초 입력 token 감소폭 비교.
- 실사용 결과 확인 전 Gemini 2차 최적화를 기능 완료로 최종 판정하지 않음.


## 0EB. PREVIEW app144 — Gemini 관리자 오류 설명 전체 한글화 + 3곡 실사용 결과 기록 (2026-09-23 KST)

**사용자 3곡 실사용 결과:**
1. 곡 A: 최초 생성 `gemini-3.8-flash` 14.5초 SUCCESS. 이후 섹션 지시문 보완에서 3.5 high-demand 실패 후 3.5-lite 성공. 전체 약 23.9초.
2. 곡 B: 3.8 high-demand 약 19.1초 FAIL → 3.7 약 24.8초 SUCCESS. 이후 금지어 교정에서 3.7 Free Tier 일일 20회 rate limit, 3.6/3.5 high-demand 실패. 전체 약 1분 10초.
3. 곡 C: 3.8 high-demand 약 17.4초 FAIL → 3.7 Free Tier rate limit(약 280ms) → 3.6은 기존 overload cooldown으로 건너뜀 → 3.5 30초 timeout → 3.5-lite 약 13.8초 SUCCESS. 이후 금지어 교정 3.5-lite SUCCESS. 전체 약 1분 9초.

**판정:**
- low-thinking 적용 후 3.8은 실제 14.5초 성공 사례가 확인되어 모델/API 경로 자체는 정상.
- 3.8 반복 실패는 품질 검증 탈락이 아니라 provider high-demand.
- 3.7은 별도로 Free Tier 일일 20회 한도에 실제 도달한 사례가 있어 이후 같은 날 요청에서는 fallback 성공률/속도에 불리함.
- 3.5의 30초 timeout은 실패 시 전체 대기시간을 크게 늘리는 병목.
- 최초 생성 입력은 약 33k~34k 토큰 범위. 다음 성능 작업은 품질 규칙 삭제보다 prompt 중복/정적 규칙 압축 가능성 감사가 우선.

**app144 한글화:**
- `src/pages/AdminGeminiAuditPage.tsx`의 표시 변환을 확대.
- high demand 문장, Free Tier rate-limit 문장, retry seconds, timeout, resource exhausted, too many requests, `model_unavailable_or_overloaded`, `quota_or_rate_limit`, `model_not_found_or_rollout` 등을 한국어 표시.
- 모델 ID/HTTP 코드/진단 code는 식별자이므로 유지.
- 기존 local audit 기록도 데이터 migration 없이 렌더링 시 한국어로 표시.

**검증/배포:**
- app version 144.
- Release Audit Run `35771102156` / job `106892733469` SUCCESS.
- PREVIEW Hosting Run `35771330552` / job `106893498936` SUCCESS.
- remote `PREVIEW_APP_VERSION=144`, exact build PASS, TEST/PRODUCTION unchanged PASS.
- 이번 app144 Hosting 작업에서 Functions/Worker/Rules/user data 변경 없음.
- PREVIEW 전용 Gemini Function low-thinking 튜닝은 이전 Run `35768064306` SUCCESS 상태 그대로 유지.


## 0EA. PREVIEW app143 — 초기 Gemini Flash low-thinking 최적화 Function 배포 완료 (2026-09-23 KST)

**직전 사용자 실사용:** 5단 체인 `3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite`가 실제 순서대로 작동했고, 3.8/3.7/3.6/3.5는 provider high-demand로 실패한 뒤 3.5-lite가 성공. 총 5회, 약 1분 20초. 성공 호출 입력 토큰은 33,812로 확인.

**판정:** 앞 모델 실패는 SORIDRAW 품질 검증 탈락이 아니라 upstream high-demand 응답. 따라서 가사 기준/프롬프트 규칙을 느슨하게 삭제하는 방식은 사용하지 않음.

**최소 최적화:**
- PREVIEW 전용 `generateGeminiContentPreview`에서 최초 곡 생성의 `gemini-3.8-flash / 3.7 / 3.6 / 3.5` 요청을 `thinking_level=low`로 통일.
- 3.8/3.7 Interactions API가 기존 hard-coded medium이 아니라 request `thinkingConfig.thinkingLevel`을 존중하도록 수정.
- 3.5-lite는 기존 최소 사고 특성/정책 그대로.
- 모델 순서, 최대 물리 호출 5회, 프롬프트/가사 규칙, fallback, Auth/App Check/API key 보안은 변경하지 않음.
- Google 공식 문서상 3.8/3.7은 low/medium/high를 지원하며 low는 latency-critical 작업의 시간/토큰 감소 용도.

**검증/배포:**
- Workflow Run `35768064306` / job `106882520565` SUCCESS.
- Functions build + generated runtime contract: `PREVIEW_GEMINI_INITIAL_FLASH_LOW_THINKING=PASS`, `PREVIEW_GEMINI_CHAIN_ORDER_UNCHANGED=PASS`.
- PREVIEW Function update: PASS / CORS PASS.
- shared `generateGeminiContent` updateTime/source 비변경 PASS → TEST/PRODUCTION 경로 영향 없음.
- Firebase CLI artifact cleanup-policy 경고는 기존처럼 발생했지만 Function update 자체는 성공했고 Workflow가 실제 ACTIVE/updateTime/shared isolation을 별도로 확인해 SUCCESS 처리.
- Hosting/app version은 app143 그대로. Worker/Rules/user data/UI/좋아요 기능 변경 없음.

**남은 확인:** 실제 곡 생성 1회에서 3.8 응답시간/성공 여부 및 fallback 총시간 재측정. provider 503 자체는 클라이언트 설정으로 성공을 보장할 수 없음. 3.8이 계속 high-demand라면 다음 단계에서 33k 입력의 중복/정적 규칙을 품질 손실 없이 줄일 수 있는지 별도 감사한다. 프롬프트 규칙 삭제는 증거 없이 금지.


## 0DZ. PREVIEW app143 — Gemini 관리자 오류 설명 한글화 배포 완료 (2026-09-23 KST)

- 사용자 요청에 따라 관리자 `Gemini 호출 기록`의 provider 오류 설명 문장을 한국어 표시로 변경.
- 진단에 필요한 `HTTP 500/503`, `GEMINI_UPSTREAM_UNAVAILABLE`, 모델명/오류 코드는 그대로 유지.
- 기존 local audit 기록도 저장 데이터 변환 없이 화면 렌더링 시 한국어로 표시.
- 현재 번역 대상: 모델 고수요(high demand), timeout, 재시도 안내, resource exhausted.
- 변경 파일: `src/pages/AdminGeminiAuditPage.tsx`, `public/app-version.json=143`.
- Release Audit Run `35766331164` / job `106876689754` SUCCESS.
- PREVIEW Hosting Run `35766616101` / job `106877650804` SUCCESS. exact build PASS, TEST/PRODUCTION unchanged PASS.
- Firebase Functions/Worker/Rules/user data 변경 없음. app142의 PREVIEW 전용 `generateGeminiContentPreview` 및 5단 모델 체인은 그대로 유지.
- Gemini 503 resilience/backoff 추가 최적화는 이번 한글화 작업과 분리되어 아직 미적용.


## 0DY. 곡 생성 Gemini 503 연속 실패 원인 확정 — 모델 폐기 아님, provider overload + 초기 fallback 체인 노후화 (2026-09-23 KST)

**사용자 실사용 증상:** 곡 생성이 약 27초 후 실패. 관리자 Gemini 호출 기록에서 물리 호출 3회 모두 실패:
1. `gemini-3.6-flash`
2. `gemini-3.5-flash-lite`
3. `gemini-3.1-flash-lite`
공통 응답: HTTP 503 / `GEMINI_UPSTREAM_UNAVAILABLE` / "This model is currently experiencing high demand."

**현재 코드와 정확히 일치하는 원인:**
- `src/services/geminiProxyClient.ts`의 `INITIAL_SONG_MODEL_CHAIN`은 현재 위 3개 모델만 포함.
- 이 구조는 887 latency fastpath에서 초기 3.7 probe를 의도적으로 제거해 속도를 우선하도록 변경된 결과.
- Functions `GEMINI_ALLOWED_MODELS`에는 3.7/3.6/3.5/3.5-lite/3.1-lite 등이 남아 있지만, 최초 곡 생성 클라이언트가 3.5와 3.7을 server modelChain에 보내지 않아 실제 초기 생성에서는 사용되지 않음.
- Function 내부 fallback loop는 503 시 다음 모델로 즉시 이동하고, 실패한 모델 cooldown은 후속 호출을 위한 보호다. 같은 logical request 안에서 provider 권장 exponential backoff 대기는 하지 않는다.
- 따라서 여러 Gemini 모델이 같은 시간대에 capacity 503을 반환하면 현재 초기 생성은 3회 연속 실패 후 종료한다.

**모델 버전 판정:**
- Google 공식 최신 모델 문서 기준 `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`는 현재 유효한 모델. 즉 404/deprecation 문제가 아님.
- Google은 2026-09-02 `gemini-3.8-flash`를 GA로 출시했으나 현재 SORIDRAW client chain과 Function allowlist/route에는 아직 3.8이 없음.
- 현재 Function의 Interactions API 전용 분기는 `gemini-3.7-flash`에만 적용되어 있어 3.8을 쓰려면 client+Function 최소 변경과 Function 재배포가 필요.

**수정 방향(아직 미적용):**
- 정상 UI/프롬프트/가사 엔진/사용자 데이터는 건드리지 않는다.
- 최신 stable 3.8을 초기 생성 후보에 추가하고, 현재 빠른 체인의 누락된 3.5 full fallback을 복구하는 방향을 우선 검토.
- transient 5xx에서 Retry-After 또는 짧은 bounded exponential backoff/jitter를 같은 Function fallback 안에 추가해 순간 capacity spike를 3연속 즉시 실패로 소진하지 않도록 검증.
- 물리 호출 절대 상한 5회, API Key 보안, Auth/App Check, 기존 cooldown, 품질 보정 상한은 보호.
- Functions 변경이므로 PREVIEW에서 Function만 필요한 경우에 한해 재배포 후 실제 생성 검증. TEST/PRODUCTION은 사용자 승인 전 변경 금지.


## 0DX. app141 좋아요/비용 구조를 재사용 가능한 Agent Skill로 고정 (2026-09-23 KST)

검증된 app141 좋아요 구조와 비용 합격선을 저장소 범위 Agent Skill로 추가했다. 런타임 앱 코드/배포/사용자 데이터에는 영향이 없다.

- Skill: `.agents/skills/local-first-like-sync/SKILL.md`
- SORIDRAW 검증 기준: `.agents/skills/local-first-like-sync/references/soridraw-app141-baseline.md`
- 비용/회귀 체크리스트: `.agents/skills/local-first-like-sync/references/cost-regression-checklist.md`
- `AGENTS.md`에 Explore 좋아요/카탈로그/양방향 동기화/비용 작업 전 필수 참조로 연결.
- 스킬은 다른 앱에서도 재사용할 수 있도록 portable mode를 포함한다. 다른 앱에서는 Firebase/D1/RTDB/30초 규칙을 무조건 강제하지 않고, local-first·changed-item-only·persist-before-UI-notify·O(1) 비용·기능보존 원칙을 해당 스택에 맞춰 적용한다.
- SORIDRAW mode에서는 app141의 W1 30초 묶음쓰기, R0 재진입, local catalog, RTDB changed-track 양방향 동기화, persist-before-UI-notify, D1 W1-W2 합격선을 보호한다.
- 앱 버전 141 / PREVIEW Hosting / Worker / Functions / Rules / D1 schema / TEST / PRODUCTION 변경 없음.


## 0DW. PREVIEW app141 실사용 기능 PASS — PC↔모바일 양방향 좋아요 자동 반영 정상 (2026-09-23 KST)

**사용자 실기기 최종 확인:** app141에서 업데이트 후 첫 Explore 진입의 기존 좋아요 하트가 즉시 정상 표시되고, PC→모바일 및 모바일→PC 모두 페이지/탭 이동·새로고침 없이 좋아요/해제 변경이 정상 자동 반영됨. app140까지 남았던 실시간 UI 전달 결함은 app141 수정으로 해소된 것으로 판정. 이 정상 동작을 다음 작업의 보호 기준점으로 고정한다.

- 기능 판정: **PASS** — 첫 화면 cached heart + 양방향 changed-track UI 자동 반영.
- 기존 W1 30초 묶음쓰기 / R0 정상 재진입 / local personal catalog / Worker `45afab7c-1da2-45b6-b34d-cb3943cec559` 변경 없음.
- UI/CSS/레이아웃, Functions, Rules, D1 schema, 공유 사용자 원본 데이터 변경 없음.
- 이번 사용자 확인은 기능 동기화 PASS이며, 별도의 90초 무동작 비용 숫자/페이지 왕복 비용 수치는 이번 확인에서 새로 재측정했다고 기록하지 않는다.
- TEST/PRODUCTION은 비변경. 승격은 별도 사용자 지시 전 진행하지 않는다.

## 0DV. PREVIEW app141 — RTDB 원격 좋아요 UI 전달 순서 수정 및 Hosting 배포 완료 (2026-09-23 KST)

**원인 (코드에서 재현된 결정적 순서 오류):** app140의 `applyRemoteLikeSignal127`는 RTDB changed-track을 받은 뒤, 새 membership을 memory cache와 local `snapshotPending` 객체에 반영하지만 **기기 영구 저장소에 `snapshotPending`을 쓰기 전에** `dispatchLikeSync`를 호출했다. ExplorePage subscriber는 안전장치로 `readExploreTrackLikeMembership127`을 다시 읽는다. 이 함수는 memory cache보다 영구 저장된 이전 `snapshotPending`을 우선하므로, 과거 pending 상태와 새 RTDB 상태가 다른 곡의 UI 갱신을 거절했다. 페이지/탭 이동 시 별도 hydration으로 회복되는 실사용 현상과 일치한다.

**app141 최소 수정:**
- `src/services/exploreLikeService.ts`: 원격 changed-track을 최대 기존 50개만 `acceptedForUi141`에 모으고, 기존 membership cache / `snapshotPending` / display lock 영구 저장 및 signal watermark 기록을 마친 후 `dispatchLikeSync`로 화면에 알림. pending local click 및 stale signal 보호, R2 gap-repair 순서, 30초 W1 queue / Worker 구조 그대로.
- `scripts/verify-180-like-live-signal-and-cached-paint.mjs`: 과거 `snapshotPending=false`, 새로운 RTDB like=true 조건에서 실제 receiver를 TypeScript transpile + VM mock으로 실행해 UI가 최종 상태를 받는지 확인. duplicate/stale signal 및 newer local outbox 보호 검사. 서버 추가 IO 없는 receiver 경로.
- `scripts/verify-127-atomic-personal-like.mjs`: 과거 즉시 dispatch 코드 형태만 기대한 정적 검사를 persist-before-dispatch 불변조건으로 갱신.
- `public/app-version.json`: 141.
- UI/CSS/배치·테마·공유 사용자 데이터 / Functions / Rules / Cloudflare Worker / D1 schema 변경 없음.

**검증 및 배포:**
- 첫 감사 Run `35756053383` FAIL: 구버전 verifier가 즉시 dispatch 형태를 강제 → 새 저장 후 전달 계약을 검증하도록 수정.
- 두 번째 감사 Run `35756277341` FAIL: 실행형 test fixture에 `clampLikeCount`/display-lock 상수 누락 → fixture만 수정.
- **최종 감사 Run `35756483569` / job `106843437339` SUCCESS**. TypeScript, Build, Static release-system, like candidate regression, Worker dry-run, shared D1 preflight read-only, current D1 like fanout SELECT-only, refs unchanged PASS.
- 회귀 출력: `APP141_REMOTE_PERSIST_BEFORE_UI_REPLAY=PASS`, `APP141_LOCAL_OUTBOX_AND_STALE_SIGNAL_PROTECTED=PASS`, `APP141_RECEIVER_ADDITIONAL_SERVER_IO=0`.
- Firebase PREVIEW Hosting Run `35756677133` / job `106844080762` SUCCESS. 배포 source `3032247b531b213999c235baca5ce413fda65187`. remote `preview.soridraw.com/app-version.json=141`; `PREVIEW_EXACT_BUILD=PASS`; `TEST_PRODUCTION_UNCHANGED=PASS`.
- Worker 재배포 없음. PREVIEW Worker 유지 `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- 사용자 원본 데이터 migration/backfill/delete/write 없음. 정상 비용 경로 W1 / R0 구조 변경 없음. 실제 신규 클릭 시 D1 비용, PC↔모바일 자동 화면 전파는 아직 실기기 미검증.

**실기기 합격선 (별도):**
1. 같은 계정 PC/모바일 모두 app141 확인, 캐시 삭제 금지. app140에서 통과한 업데이트 첫 하트 표시가 유지되는지.
2. 모바일 추천 화면 그대로, PC에서 1~3곡 좋아요/해제 → 마지막 클릭 35초 후 모바일이 탭/페이지 이동·새로고침 없이 하트/숫자 변경.
3. 반대로 모바일→PC 동일 확인.
4. 90초 무동작 추가 like R/W 0, 페이지 왕복 write 0, 정상 catalog membership D1 R0 확인.
5. FAIL이면 141에서 수정한 receiver 경계 또는 남은 auth/listener/old-outbox 가드만 read-only 계측. W1/Worker/카탈로그 전체 변경 금지. 실기기 PASS 전 TEST 승격 금지.


## 0DU. PREVIEW app140 실사용 FAIL — RTDB 발송은 복구, 상대 기기 화면 동기화는 미해결 (2026-09-23 KST)

**사용자 실제 확인:** app140 첫 Explore 진입의 기존 하트 spinner는 PASS. PC↔모바일 이동·새로고침 없는 양방향 자동 하트 반영은 여전히 FAIL. 따라서 app140 기능 완료 / TEST 승격 선언 금지.

**신규 live read-only 서버 증거:**
- 임시 read-only RTDB probe Run `35754369030` / job `106836295199` SUCCESS, 2026-09-22 16:28:55 UTC (KST 2026-09-23 01:28:55).
- 최신 `userSync/*/exploreLike` version `1790094204064` = 2026-09-22 16:23:24 UTC. probe 당시 age 331초, changed-track 2개, valid version chain.
- follow-up Run `35754457146` / job `106836588260`: 해당 계정 previousVersion `1790092268601`; 다른 계정의 latest는 약 6.45일 전. 개인 uid/trackId는 로그에 출력하지 않음.
- probe는 인증 read-only GET만 실행, 사용자 데이터 write 0. 임시 probe workflow는 진단 직후 삭제. 실제 PREVIEW Hosting/Worker 배포 없음.
- app139 probe의 624초 signal age와 달리, app140 직후 새 RTDB signal이 실제 서버에 기록된 것은 증명. 단, 변경 2곡이 사용자 실험과 동일한지, 상대 기기가 수신했는지까지 서버 기록만으로 확정하지는 못함.

**정적 코드 확인 및 차단 후보:**
- `src/services/exploreLikeService.ts`: RTDB `onValue` callback은 현재 auth uid 일치 검사 후 `normalizeLikeSignal127`→`applyRemoteLikeSignal127` 호출. `version <= lastSeen`이면 전체 신호 무시; 대상 track이 local outbox에 남아 있으면 해당 track 무시.
- `src/pages/ExplorePage.tsx`: UI subscriber도 현재 service membership과 event liked 값이 다르면 화면 patch를 거절. 이는 정상 동시수정 보호 조건이나 실제 수신/거절 계측 없이는 어떤 조건에서 멈췄는지 미확정.
- navigation/focus는 별도 `likes-revision`/R2 catalog 경로로 정상화될 수 있어 **탭 이동 후 일치는 RTDB 실시간 수신 성공의 근거가 아님**.
- app140 verifier `verify-180-like-live-signal-and-cached-paint.mjs`는 `setRealtimeValue` 코드 존재를 확인했을 뿐 실제 RTDB 수신 및 UI patch까지 실행 검증하지 않음.
- app140 `set()` version은 송신 기기의 local seen + `Date.now()`에서 생성하며 서버 원자적 버전 증가가 아님. 동시 송신/기기 시계차의 stale overwrite 위험을 별도 점검해야 하나 이번 실패의 원인으로 단정 금지.

**다음 작업:** 기존 관리 진단 경로에서 동일 uid/track의 publish ACK, RTDB subscribe/error, received version/lastSeen, outbox skip, UI membership guard 결과를 **개인 식별자 노출 없이**, 변경곡 최대 3개로 단계별 확인. 각 단계 PASS/FAIL로 막힌 지점만 최소 수정. 전체 Worker/W1 queue/catalog/DB schema/UI/CSS 변경 금지. UI 실사용 재검증 전 배포 성공을 기능 성공으로 표현 금지.


## 0DT. PREVIEW app140 — 양방향 changed-track 실시간 동기화 + 업데이트 직후 하트 스피너 수정 (2026-09-23 KST)

**범위:** app138의 W1 queue 쓰기 / local catalog / R0 재진입 / Worker 구조는 그대로 보호. app139 실사용에서 남은 두 현상만 수정:
1. PC→모바일, 모바일→PC 모두 다른 페이지/탭 이동 전에는 하트가 즉시 바뀌지 않음.
2. 앱 업데이트 직후 기존 좋아요가 있는 곡도 하트 자리에서 spinner가 돌고, 페이지를 한 번 이동해야 정상 표시.

### 실서버 진단으로 확정한 원인
app139 실사용 직후 read-only RTDB 진단 Run `35751292862` / job `106825800549`:
- live RTDB rules/source 일치 상태에서 userSync Explore like signal 계정 2개 확인.
- 최신 `userSync/*/exploreLike` signal age가 **624초**.
- `RTDB_LATEST_SIGNAL_WITHIN_5_MIN=FALSE`.
- 진단 사용자 데이터 write **0**.

즉 app139에서 추정했던 “모바일 React가 signal은 받았지만 repaint만 놓침”이 주원인이 아니었음.
최근 PC/모바일 좋아요 변경 자체가 **RTDB changed-track live signal에 새로 publish되지 않고 있었음**.
그래서 다른 탭/페이지 이동 때 `likes-revision + personal R2 catalog` 재검증이 실행된 뒤에야 양쪽 화면이 맞아졌음.
양방향에서 동일하게 재현된 이유도 이 live publish 경로 때문.

### app140 수정 — 정상 구조는 유지
- `src/services/exploreLikeService.ts`
  - like live signal publisher를 기존 `runTransaction` transport에서 **RTDB `set()` changed-track signal**로 단순화.
  - Music Note/recent-song domain sync에서 이미 사용하는 RTDB set transport와 같은 방향.
  - payload는 현재 batch의 changed-track 최대 50개만 포함.
  - `version / previousVersion` 유지.
  - concurrent/stale signal gap은 수신 측 기존 `previousVersion` mismatch + personal R2 catalog repair로 처리.
  - live signal 자체에서 D1 / Firestore read/write 없음.
  - W1 Cloudflare batch request / 30초 묶음 / outbox 구조 변경 없음.
- `src/pages/ExplorePage.tsx`
  - visible track이 mount되면 이미 device local catalog에서 알고 있는 membership을 **동기적으로 먼저 paint**.
  - 그 뒤 기존 tiny revision/baseline check는 background에서 그대로 실행.
  - 정상 cache가 있는 업데이트/재진입에서 하트 spinner를 기다릴 이유 제거.
  - 정말 새 기기/catalog 부재 ID만 기존 loader 유지.

### 검증
- 임시 read-only live-signal probe는 원인 확인 후 삭제 완료.
- 첫 app140 audit `35751997323`은 제품 코드가 아니라 verifier가 주석의 "D1" 문자열까지 금지해 FAIL → verifier만 수정.
- app140 audit r2 Run `35752228649` / job `106829023461` SUCCESS:
  - TypeScript PASS
  - Build PASS
  - Static verification PASS
  - Like candidate regression PASS
  - app140 live-signal / cached-paint regression PASS
  - TEST/PRODUCTION Worker dry-run PASS
  - shared D1 preflight SELECT-only PASS
  - refs unchanged PASS
- version 140 exact audit Run `35752471675` / job `106829852900` SUCCESS.
- Firebase PREVIEW Hosting Run `35752721030` / job `106830699375` SUCCESS.
- remote `preview.soridraw.com/app-version.json = 140`.
- PREVIEW exact build PASS.
- TEST / PRODUCTION unchanged PASS.

### 배포 영향
- Worker 재배포 없음. PREVIEW Worker 계속 `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- Functions 변경 없음.
- Firebase Rules 변경 없음.
- D1 schema/migration 변경 없음.
- 공유 사용자 데이터 migration/backfill/delete 없음.
- UI/CSS/레이아웃 변경 없음.
- W1 final architecture 문서 `DOCS/EXPLORE_LIKE_FINAL_ARCHITECTURE.md` 기준 유지.

### app140 실기기 합격선
1. PC/모바일 모두 app140 확인, cache 삭제 금지.
2. 업데이트 직후 Explore 첫 화면에서 정상 local catalog 곡의 하트가 spinner 없이 즉시 보여야 함.
3. PC에서 1~3곡 변경 → 30초 batch 완료 후 모바일은 **탭/페이지 이동/새로고침 없이** 변경곡 하트 자동 반영.
4. 모바일→PC도 동일.
5. 90초 무동작 후 D1 like R/W 추가 증가 0.
6. 페이지/탭 이동만으로 추가 like write 0.
7. 재진입 membership D1 R0 유지.
8. 실패 시 W1/Worker/catalog 구조를 바꾸지 말고 RTDB changed-track publish/receive 한 구간만 재조사.


## 0DS. PREVIEW app139 — 모바일 changed-track 실시간 화면 갱신 보강 (2026-09-23 KST)

**범위:** app138의 정상 W1 쓰기 / local catalog / R0 재진입 / Worker 구조는 그대로 보호하고, 모바일에서 changed-track 데이터가 이미 도착했는데 현재 추천 화면 하트가 탭 전환 전까지 다시 그려지지 않는 UI 전달 구간만 수정.

### 원인
- RTDB account signal은 서비스 레이어에서 받아 local personal-like catalog/display lock까지 정상 반영됨.
- 하지만 ExplorePage는 one-shot `window CustomEvent`를 정확한 시점에 잡아야 현재 React 화면을 갱신하는 구조였음.
- 모바일 resume/PWA lifecycle에서 retained/remote signal이 Explore React effect보다 먼저 처리되면 이벤트는 소실될 수 있음.
- 이후 인기/최신 탭 전환 시 visible-track hydration이 이미 갱신된 local catalog를 다시 읽기 때문에 그때서야 하트가 정상화됨.
- 즉 서버/카탈로그 문제는 아니고 **현재 화면 repaint 전달 race**.

### app139 수정
- `src/services/exploreLikeService.ts`
  - remote changed-track UI 전용 **replayable in-memory subscriber** 추가.
  - 최근 remote changed-track 최대 50개만 메모리에 유지.
  - Explore UI가 늦게 mount되어도 이미 수신된 changed-track을 즉시 replay.
  - 이 subscriber는 fetch / D1 / Firestore / R2 / RTDB 추가 요청을 전혀 하지 않음.
  - 기존 window event는 호환성 때문에 유지하지만 ExplorePage는 더 이상 one-shot event 포착에 의존하지 않음.
- `src/pages/ExplorePage.tsx`
  - 현재 Explore 화면이 service subscriber에 직접 연결.
  - remote signal 수신 또는 late-mount replay 즉시 해당 track 하트/숫자 React state patch.
  - cleanup unsubscribe 추가.
- 신규 회귀: `scripts/verify-179-like-live-ui-replay.mjs`.

### 보호 확인
- W1 30초 묶음 쓰기 경로 변경 없음.
- Worker 변경 없음. PREVIEW Worker version 그대로 `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- 페이지 이동 server read/write 경로 변경 없음.
- local catalog / revision / changed-track 데이터 계약 변경 없음.
- UI/CSS/레이아웃 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- Functions / Rules / D1 schema 변경 없음.
- TEST / PRODUCTION 비변경.

### 검증 / 배포
- 첫 audit Run `35748162313`은 TypeScript signature 오류로 FAIL → 코드 타입만 수정.
- 재감사 Run `35748373032` SUCCESS:
  - TypeScript PASS
  - Build PASS
  - Static verification PASS
  - Like candidate regression PASS
  - app139 UI replay regression PASS
  - TEST/PRODUCTION Worker dry-run PASS
  - shared D1 read-only checks PASS
- version 139 exact audit Run `35748628236` / job `106816605112` SUCCESS.
- Firebase PREVIEW Hosting Run `35748877001` / job `106817450432` SUCCESS.
- remote `preview.soridraw.com/app-version.json = 139`.
- PREVIEW exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker 재배포 없음.

### 실기기 다음 확인 — 딱 1개
- PC에서 새 좋아요/해제 1~3곡 → 30초 batch 완료 후,
- 모바일은 **추천 탭에 그대로 둔 상태 / 새로고침 없음 / 인기·최신 이동 없음**으로 changed-track 하트/숫자가 자동 갱신되는지 확인.
- CACHE LIVE 비용은 app138과 동일해야 하며, 이 UI replay 자체는 서버 read/write 0.
- 이 항목 PASS 시 app138에서 남은 마지막 모바일 즉시 화면 갱신 결함 해결로 판단.


## 0DR. FINAL LIKE ARCHITECTURE LOCK + PREVIEW app138 배포 완료 (2026-09-22 KST)

**최종 고정 구조:** `DOCS/EXPLORE_LIKE_FINAL_ARCHITECTURE.md`  
**핵심:** **쓰기 = app121~124 검증 W1 queue intake / 읽기·동기화 = local personal catalog + changed-track signal**.  
이 네 조건은 변경 금지: **기능 보존 + W1 interactive queue intake + R0 normal re-entry + changed-track cross-device sync**.

### 현재 PREVIEW 배포
- 앱: **138**
- Firebase PREVIEW Hosting Run `35744548706` / job `106802636922` SUCCESS.
- remote `preview.soridraw.com/app-version.json = 138`, exact build PASS.
- PREVIEW Worker release Run `35744224208` / job `106802080992` SUCCESS.
- 현재 PREVIEW Worker version: `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- Worker locked product source: `5d5e7d5f53655115d378b0b52c3095da2c06cfc4`.
- Final exact Release System Audit: Run `35743962351` / job `106800609321` SUCCESS.
- isolated D1 measurement: Run `35743171196` SUCCESS.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- TEST / PRODUCTION 앱 비변경 PASS.

### 쓰기 경로 — 최종
- 클릭 즉시 local UI/cache/outbox 반영.
- 마지막 클릭 기준 30초 trailing batch 유지.
- `/v1/me/likes/batch` interactive Worker는 더 이상 곡별 likes/track_stats direct settlement를 하지 않음.
- 정상 interactive path는 `explore_like_batches_069`에 **묶음 1 row** enqueue.
- background processor가 canonical relation/count 및 파생 상태를 **변경된 곡만** 처리.
- R2 changed-track publication failure가 성공한 queue acceptance를 HTTP 실패/재쓰기 루프로 되돌리지 않음.
- failed/ambiguous outbox는 idle/navigation만으로 자동 write retry하지 않음.

### 실제 원격 D1 비용 증명
격리된 임시 Cloudflare D1에서 production `explore_like_batches_069`와 같은 WITHOUT ROWID queue shape로 6곡 mutation 묶음을 측정:
- **첫 queue intake: rows_written = 1**
- mutation_count = 6
- 동일 batch_id duplicate: rows_written = 0
- 로그: `188_REMOTE_D1_W1_QUEUE_INTAKE=PASS rows_written=1 mutations=6 duplicate_rows_written=0`
- 임시 D1은 검사 후 삭제 PASS.
비교용 legacy direct shape는 동일 검사에서 like W8 / unlike W4 lower bound가 다시 확인됨. 따라서 interactive path를 direct settlement에서 W1 queue로 되돌린 결정은 실제 D1 billing 기준으로도 타당함.

### 읽기/동기화 경로 — 유지
- 정상 device personal-like catalog 우선.
- Explore 진입/재진입에서 정상 catalog가 있으면 membership D1 R0 계약.
- `/v1/me/likes` visible-track scan은 정상 경로 금지.
- 앱 버전 변경만으로 전체 개인 좋아요 재조회 금지.
- RTDB `userSync/{uid}/exploreLike`는 account 당 1 listener.
- queue ACK 뒤 **변경된 trackId + final desired liked + 현재 local count pair**만 다른 기기에 전달.
- 다른 기기는 해당 changed-track만 local catalog/display lock에 merge.
- gap/revision 변화 때문에 정상 device catalog 전체를 폐기하지 않음.

### 최종 감사
- TypeScript PASS
- Build PASS
- Static release verification PASS
- Like candidate regression PASS
- `FINAL_LIKE_W1_QUEUE_INTAKE=PASS`
- `FINAL_LIKE_INTERACTIVE_DIRECT_D1_SETTLEMENT=0`
- `FINAL_LIKE_NORMAL_LOCAL_CATALOG_REENTRY_D1_MEMBERSHIP=0_CONTRACT`
- `FINAL_LIKE_CHANGED_TRACK_ACCOUNT_SIGNAL=PASS`
- TEST/PRODUCTION Worker dry-run PASS
- shared D1 preflight read-only PASS
- shared D1 like fanout audit SELECT-only PASS
- PREVIEW Worker Feed/Profile smoke PASS
- warm revision R0/W0 PASS
- fixed cron disabled PASS

### 데이터/백엔드 안전
- 공유 사용자 데이터 migration/backfill/delete 없음.
- 기존 likes 강제 재생성 없음.
- Firebase Rules / Functions 변경 없음.
- D1 schema migration 없음.
- PREVIEW 코드/Worker만 변경.
- TEST / PRODUCTION 비변경.

### 아직 남은 최종 실기기 검증
코드/CI/격리 D1는 PASS했지만 **실제 계정 PC↔모바일 검증 전**이므로 기능 완료 선언은 아직 금지.
1. 양쪽 app138 확인, 캐시 삭제 금지.
2. 진단 초기화.
3. PC에서 3~6곡 변경 → 30초 후 interactive intake가 한 묶음으로 처리되는지.
4. 이후 90초 무동작 시 추가 like write 0.
5. 다른 페이지 왕복만으로 추가 like write 0.
6. 모바일이 새로고침/페이지 이동 없이 changed-track heart를 자동 반영.
7. 모바일→PC도 동일.
8. 재진입 membership D1 R0.
9. public likeCount가 background aggregate 뒤 최종 일치.
10. FAIL 시 전체 구조를 다시 바꾸지 말고 W1 intake / local catalog / changed-track signal 세 구간 중 실패 구간만 수정.


## 0DQ. PREVIEW app137 배포 완료 — 좋아요 자동 재시도 폭증 + D1 trigger receipt 오판 수정 (2026-09-22 KST)

**현재 PREVIEW live app:** 137  
**PREVIEW Hosting Run:** `35734551788` / job `106768328033` SUCCESS. remote `app-version.json=137`, exact build PASS, TEST/PRODUCTION unchanged PASS.  
**PREVIEW Worker Run:** `35734337978` / job `106767585369` SUCCESS. 현재 Worker version `91f2b33b-7f62-4776-b363-33e729912e8f`.  
**최종 Release System Audit:** `35732623427` / job `106761752048` SUCCESS. TypeScript / Build / like regression / TEST·PRODUCTION Worker dry-run / shared D1 read-only preflight PASS.

app136 실기기 FAIL 증거:
- 좋아요 해제 뒤 CACHE LIVE에서 D1 누적이 시간 경과만으로 `R12/W12 → R18/W18` 식으로 증가.
- 다른 페이지 이동/Explore 재진입 뒤에도 추가 증가.
- 즉 사용자가 추가 동작을 하지 않았는데 실패 outbox가 idle timer / navigation 경로에서 다시 전송되어 서버 비용이 계속 증가.
- 모바일의 stale 개인 좋아요는 페이지 재진입 시 D1 membership read 0으로 복구되는 것은 확인됐지만, mutation retry 비용이 비정상이라 app136 전체 FAIL.

확정 원인:
- 실제 Cloudflare D1 isolated remote 측정에서 fenced direct like batch의 첫 relation statement가 정상 1건 변경에도 **AFTER trigger side effect를 포함해 `meta.changes=2`**를 반환함.
- app136 Worker의 174 receipt 검증은 `changes > 1`을 실패로 판단하여, canonical D1 변경이 이미 반영된 뒤에도 요청을 실패로 오인.
- 클라이언트 outbox는 실패 상태를 남기고 30초 idle timer / 페이지 진입·이동에서 자동 재시도하여 같은 동작의 D1 read/write 비용을 반복 발생시킴.
- isolated D1에서 기존 legacy physical shape 자체도 like W8 / unlike W4 lower bound가 확인되어 현재 legacy likes 물리구조는 W1~W2 최종 목표를 아직 만족하지 않음. 기능 정상화 후 별도 구조 최적화 필요.

app137 수정:
- Worker 174 direct receipt에서 Cloudflare의 trigger-inclusive `meta.changes=2`를 정상 receipt로 허용. relation 변경 여부는 SQL `changes()`가 후속 track_stats gate로 계속 사용.
- failed/ambiguous outbox(`retryCount>0`)는 **idle timer, rerender, page navigation, Explore 재진입으로 자동 재전송하지 않음**.
- page exit 자체는 server read/write 0: 기존 30초 timer는 실제 새 클릭에만 유지.
- 새 클릭은 retryCount를 0으로 재설정해 정상 30초 묶음 저장은 그대로 유지.
- 신규 회귀 `scripts/verify-177-like-idle-retry-guard.mjs` 및 retry-safe batching 회귀 추가.
- 실제 isolated D1 측정으로 trigger-inclusive sequence `2/0/2/0` 검증.

배포/안전:
- PREVIEW Worker preflight: pending035=0 / pending069=0, Feed/Profile smoke PASS, warm revision R0/W0, fixed cron disabled.
- 사용자 데이터 migration/backfill/delete 없음.
- Functions / Rules 변경 없음.
- TEST / PRODUCTION 앱·Worker 비변경 PASS.
- 현재 사용자 실기기 app137 비용/동기화 검증 전이므로 TEST 승격 금지.

실기기 다음 합격선:
1. app137 확인 후 CACHE LIVE 진단 초기화.
2. PC에서 새 좋아요 1~3곡 변경, 35초 대기.
3. HTTP 500 없어야 하고, 이후 **아무 동작 없이 1~2분 기다려도 D1 R/W가 추가 증가하지 않아야 함**.
4. 다른 페이지 → Explore 복귀해도 D1 R/W가 추가 증가하지 않아야 함.
5. 모바일이 새로고침/페이지 이동 없이 동일 하트/숫자로 수렴해야 함.
6. 반대 방향 모바일→PC도 동일.
7. 기능 정상화 후 실제 mutation 비용은 현재 legacy physical lower bound 때문에 W1~W2 달성 여부를 별도 구조 작업으로 판단. 기능을 깨서 숫자만 낮추는 변경 금지.


## 0DP. PREVIEW app136 — 좋아요 D1 확정 후 HTTP 500 재시도/모바일 미동기화 복구 배포 완료 (2026-09-22 KST)

**현재 PREVIEW live app:** 136  
**PREVIEW Hosting Run:** `35729271895` / job `106750503334` SUCCESS. locked source `dc43f30372b71fc4b5570756bf7441130d2eeb4c`, remote `app-version.json=136`, exact build PASS.  
**PREVIEW Worker Run:** `35729148720` / job `106750087137` SUCCESS. 현재 Worker version `314608e3-1490-4eab-ade5-f5909bc2af96`.  
**최종 Release System Audit:** `35728910481` / job `106749307465` SUCCESS. TypeScript / Build / like regression / TEST·PRODUCTION Worker dry-run / shared D1 read-only preflight / refs unchanged PASS.  
**canonical materialize:** Run `35728218642` / job `106746999636` SUCCESS, commit `addb280c87149c00cea9c0b2ff7ba386ba9c24f1`.

app135 실기기 최종 FAIL:
- PC에서 좋아요 3곡 변경 후 CACHE LIVE가 `좋아요 변경 묶음 저장` 마지막 **HTTP 500**, 누적 D1 `R12 / W11`을 표시.
- 모바일은 같은 시간 동안 하트/숫자 변화가 전혀 없어 PC→모바일 동기화 FAIL.
- 별도 **read-only RTDB 실서버 진단** Run `35727265636` / job `106743856843`에서 live RTDB rules는 source와 일치했지만, 최신 `userSync/*/exploreLike` 신호는 약 47분 전 상태였고 최근 15분 신호가 없음을 확인. 진단 중 사용자 데이터 write 0.
- 즉 모바일 수신 문제가 아니라 **PC 서버 처리 이후 새 cross-device signal 자체가 발행되지 않은 상태**였음.

확정 원인:
- app135 Worker의 direct like 경로는 먼저 canonical D1 좋아요 관계/숫자를 저장한 뒤 개인 R2 카탈로그 후처리를 수행.
- **D1 저장은 이미 성공했는데 후속 R2 카탈로그 갱신/복구가 실패하면 HTTP 5xx를 반환**하는 구조였음.
- 클라이언트는 전체 요청 실패로 판단해 outbox를 남기고 RTDB changed-track signal을 발행하지 않음.
- 결과적으로 다른 기기는 변화를 못 받고, 재시도 시 같은 사용자 동작이 다시 서버 경로를 타며 D1 write 비용도 증폭될 수 있었음.
- 또한 이 후처리 경로에 조건부 **개인 좋아요 전체 D1 목록 조회**가 남아 있어 실제 변경 hotpath 비용 원칙에도 어긋났음.

app136 수정:
- canonical D1 저장 성공을 사용자의 최종 좋아요 상태로 확정. 그 뒤 R2/cache 갱신 실패가 **성공한 D1 변경을 HTTP 5xx로 되돌리지 못하도록** 수정.
- 개인 R2는 변경곡 기반 incremental/best-effort 처리. 실패 시 `repair-needed`만 남기고 canonical 성공을 재실행하지 않음.
- like mutation hotpath의 개인 좋아요 전체 D1 scan 및 synchronous full catalog rebuild 제거.
- 클라이언트도 `canonicalD1='settled'`를 최종 ACK로 인정해 outbox를 정리하고 해당 변경곡만 RTDB account signal로 다른 기기에 전달.
- app135에서 넣은 local-first 개인 카탈로그 / page-return D1 membership R0 보호는 그대로 유지.
- 신규 회귀 `scripts/verify-176-like-postwrite-ack.mjs` + 기존 127/128/135 회귀 업데이트.
- Worker canonical marker `SORIDRAW_LEGACY_LIKE_POSTWRITE_ACK_186_20260922`.

비용/데이터:
- 코드상 변경 hotpath의 **개인 전체 좋아요 D1 scan 제거** PASS.
- canonical 성공 후 R2 실패 때문에 같은 좋아요를 재시도하여 쓰기 증폭하는 경로 제거 PASS.
- Worker 배포 직전 `pending035=0 / pending069=0`; warm revision `R0/W0`; Feed/Profile smoke PASS.
- 공유 사용자 데이터 migration/backfill/delete 없음. 사용자 원본 강제수정 없음.
- Functions / Rules 변경 없음.
- TEST / PRODUCTION Worker·앱 비변경 PASS.
- app135에서 이미 남은 실패 outbox가 app136 첫 실행에서 1회 정리될 수 있으므로 **첫 회복 batch 비용은 새 동작의 정상 비용으로 판정하지 않는다**.
- 정상화 후 새 1~3곡 변경 cycle에서 실제 D1 write는 W1~W2/행동 목표로 재실측. 아직 실기기 비용 PASS 선언 금지.

실기기 합격선:
1. app136 진입 후 기존 실패 outbox가 있다면 한 번 정리될 시간을 준다.
2. 그 뒤 CACHE LIVE 진단 초기화.
3. PC에서 새 좋아요 1~3곡 변경 → 약 35초 후 모바일이 페이지 이동/새로고침 없이 자동 수렴.
4. 반대 방향 모바일→PC도 동일.
5. 정상 새 cycle에서 HTTP 500 없어야 함.
6. Explore 다른 페이지 왕복 후 개인 좋아요 membership D1 rows read 0 유지.
7. 새 cycle mutation D1 rows written W1~W2/실제 변경곡 목표. 기능이 정상이어도 W3+ / 행동이면 비용 FAIL로 계속 수정.
8. 위 실기기 PASS 전 TEST/PRODUCTION 승격 금지.

임시 read-only RTDB 진단 workflow/trigger는 원인 확인 후 preview에서 제거 완료. 진단 자체는 사용자 데이터 write 0.


## 0DO. PREVIEW app135 배포 완료 — app134 페이지복귀 R46/모바일 비동기 결함 수정, 실기기 재검증 대기 (2026-09-22 KST)

**현재 PREVIEW live app:** 135  
**PREVIEW Hosting Run:** `35723863422` / job `106732740826` SUCCESS. locked source `790f8113dde0346020eff97773bbfe6f95d70822`, 실제 `preview.soridraw.com/app-version.json=135`, exact build PASS.  
**최종 Release System Audit:** Run `35723609001` / job `106731917567` SUCCESS. TypeScript / Build / static release checks / like regression / TEST·PRODUCTION Worker dry-run / live shared D1 read-only preflight PASS.  
**PREVIEW Worker:** 재배포 없음. 기존 version `4a145c23-adf0-4f41-8426-6de8cbebda66` 유지.  
**TEST / PRODUCTION:** 코드·실제 주소 비변경 PASS.

app134 실사용 최종 FAIL 증거:
- 정상 캐시 첫 진입·즉시 재진입은 PC/모바일 모두 개인 좋아요 D1 membership R0.
- PC에서 좋아요 6곡을 30초 묶음으로 해제한 뒤 모바일은 기존 하트를 계속 표시하여 PC↔모바일 동기화 FAIL.
- 이후 다른 페이지 이동 → Explore 복귀에서 `/v1/me/likes` **좋아요 상태 확인 D1 행 읽기 46** 재발.
- 같은 누적 CACHE LIVE에서 D1 행 읽기 약 103 / 쓰기 8까지 증가. 따라서 app134는 비용·동기화 전체 PASS가 아님.
- 6곡 변경 당시 묶음 저장 자체는 D1 누적 R13/W8 수준이었으나 기능 동기화가 실패했으므로 비용만 따로 합격 처리하지 않음.

app135 수정:
- RTDB retained like signal에 이전 신호 gap이 있어도 **현재 신호가 가진 변경곡 최종 상태를 먼저 로컬 개인 카탈로그/하트에 반영**하고, 누락 가능 구간만 뒤에서 R2 repair.
- revision/gap repair 때문에 정상 기기의 개인 좋아요 카탈로그/검증 근거를 통째로 폐기하지 않도록 변경.
- 정상 기기는 페이지 이동·복귀·개인 revision 변경 때문에 visible track `/v1/me/likes` D1 membership scan으로 되돌아가지 않도록 durable local catalog marker 추가.
- 정말 새 기기/카탈로그 부재 상태에서만 1회 bounded bootstrap 허용. 1회 bootstrap 후에는 정상 local-first 경로로 승격.
- 전체조회 fallback 복구 없음. 공개 숫자만으로 개인 하트를 추론하지 않음.

변경/검증:
- 제품 수정: `src/services/exploreLikeService.ts` — commit `8f5b3db711b08be4f97a918225a77bde451a9971`.
- 신규 회귀: `scripts/verify-175-explore-like-catalog-reentry.mjs`.
- 기존 atomic-like 회귀를 app135 동작 기준으로 갱신.
- 최종 감사 source `daa9916c2c1956861da17622712756b1cee24cbc` 기준 전체 감사 SUCCESS.
- 앱 버전 135 commit `e4b2ac866425a9efbd2e165fc397e43339e44736`.
- PREVIEW 배포 locked source `790f8113dde0346020eff97773bbfe6f95d70822`.

환경/데이터:
- Firebase PREVIEW Hosting만 app135로 갱신.
- Cloudflare Worker / Functions / Rules 변경 없음.
- 공유 D1/R2 사용자 원본 migration/backfill/delete/write 없음.
- app135 수정·배포로 사용자 원본 데이터 변경 없음.
- TEST / PRODUCTION 비변경.

실기기 합격선 — 아직 미검증:
1. PC에서 좋아요 OFF/ON 묶음 확정 후 35초 내 모바일이 **페이지 이동/새로고침 없이** 같은 하트·숫자로 수렴.
2. 그 뒤 모바일에서 다른 페이지 → Explore 복귀해도 `좋아요 상태 확인 (/v1/me/likes)`가 나타나지 않고 개인 membership D1 rows read 0.
3. 반대 방향 모바일→PC도 동일.
4. 하트 / 공개 likeCount / 내 좋아요가 두 기기에서 동일.
5. 실제 변경 D1 write는 기능 정상 상태에서 W1~W2/행동 목표로 다시 실측. W3+면 TEST 승격 금지.

위 실기기 검증 전 app135를 기능 PASS로 선언하지 않으며 TEST/PRODUCTION 승격 금지.



## 0DN. app134 실사용 FAIL — 페이지 복귀 시 좋아요 D1 R46 재발 + 모바일 동기화 누락, app135 수정 착수 (2026-09-22 KST)

사용자 실기기 재검증에서 app134는 **최종 FAIL**. 첫 진입/즉시 재진입은 PC·모바일 모두 좋아요 membership D1 R0였으나, PC에서 좋아요 6곡을 30초 묶음으로 해제한 뒤 모바일은 기존 하트를 유지했고, 다른 페이지 이동 후 Explore 복귀에서 `/v1/me/likes`가 다시 실행되어 **좋아요 상태 확인 D1 행 읽기 46**이 재발했다. 같은 누적 진단 화면은 D1 행 읽기 103 / 쓰기 8까지 증가. 따라서 0DM의 실기기 합격은 취소하며 TEST/PRODUCTION 승격 금지.

확인된 클라이언트 결함:
- RTDB retained like signal의 `previousVersion`이 기기 `lastSeen`과 다르면 app134 `applyRemoteLikeSignal127`이 현재 신호에 포함된 정확한 변경곡 결과도 적용하지 않고 곧바로 repair로 return함. 이 경로가 PC 해제 후 모바일 하트 미반영을 만들 수 있음.
- repair/revision invalidation이 baseline/targeted proof를 지우고, 이후 정상 페이지 복귀에서 local catalog authority가 사라지면 visible track `/v1/me/likes` fallback이 다시 열릴 수 있음. 실사용에서 R46으로 재현됨.
- revision 변경은 “전체 개인 membership을 잊는 사건”이 아니라 “기존 로컬 카탈로그에 변경분을 반영하는 사건”이어야 함.

즉시 수정 commit `8f5b3db711b08be4f97a918225a77bde451a9971`:
- signal gap이 있어도 현재 retained signal 안의 track-level 최종 상태는 먼저 로컬 카탈로그/하트에 반영하고, 누락 가능 구간만 R2 repair로 후속 처리.
- revision/gap repair 때 정상 device catalog/targeted 상태를 통째로 버리지 않음.
- durable local personal-like catalog marker를 추가해 정상 기기는 페이지 이동/복귀/개인 revision 변경 때문에 `/v1/me/likes` visible-track D1 scan으로 되돌아가지 않도록 함.
- 정말 새 기기/카탈로그 부재 상태의 1회 bounded bootstrap만 fallback 허용.
- 변경 파일: `src/services/exploreLikeService.ts`.
- 아직 **미배포 / TypeScript·Build·회귀 검증 전**. 현재 PREVIEW live는 계속 app134이며 사용자에게 추가 테스트 요구 금지. 먼저 app135 후보 검증 후 PREVIEW 배포할 것.


## 0DM. PREVIEW app134 — Explore 좋아요 개인 카탈로그 정상화 + 직접 확정 저장 배포 완료 (2026-09-22)

**현재 PREVIEW live app:** 134  
**PREVIEW Hosting Run:** `35720055123` / job `106720597230` SUCCESS. 실제 `preview.soridraw.com/app-version.json=134`, exact build PASS.  
**PREVIEW Worker Run:** `35719972386` / job `106720327350` SUCCESS. 현재 Worker version `4a145c23-adf0-4f41-8426-6de8cbebda66`.  
**최종 전체 감사:** Run `35719747351` / job `106719597910` SUCCESS. TypeScript / Build / like candidate regression / live shared D1 read-only preflight / TEST·PRODUCTION dry-run PASS.  
**배포 앱 source:** Hosting workflow가 배포 시점 preview HEAD `319ce44bacd165d6996b37fb3f2650a3d5c7b393`를 고정하여 build/deploy했고, 그 HEAD는 감사된 제품 source `634cc69c6ded43c52b46c9bf0c1aa36b2c453422` 이후 release trigger만 추가된 상태.

정상화 내용:
- Explore 개인 좋아요는 Music Note식 **local-first 개인 카탈로그 + 작은 개인 revision**을 정상 경로로 사용.
- 정상 기기 캐시가 있으면 Explore 진입/재진입/포커스복귀/앱 업데이트 자체로 `/v1/me/likes` 대상곡 D1 membership 재확인을 하지 않도록 변경. 앱 버전 변경은 개인 카탈로그 재생성 사유가 아님.
- private R2 revision이 동일하면 기존 개인 카탈로그/검증 결과를 유지. 포커스 복귀는 tiny revision check만 수행.
- legacy partial R2는 known-liked positive hint로만 합치고, partial이라는 이유만으로 매번 visible tracks 46행/92행을 다시 읽는 경로 제거.
- 새 좋아요/해제는 기존 069 deferred intake를 새로 만들지 않고 canonical D1 관계/카운트를 직접 확정한 뒤 개인 R2 카탈로그와 공개 R2 숫자를 갱신하는 185 경로로 전환.
- 서버에서 장기 정체되어 있던 기존 `explore_like_batches_069` 7 batches / 14 accepted mutations는 repair Run `35709706139` SUCCESS로 **이미 접수된 최종 의도만** canonical D1에 반영했고, 영향 계정 1개의 개인 R2 좋아요 카탈로그만 canonical D1 기준 exact로 재생성. 전체 백필/전체 사용자 재생성/삭제 없음.
- Worker 배포 직전 실제 공유 D1에서 `pending035=0 / pending069=0` 확인. 배포 후 warm feed revision `R0/W0`, Feed/Profile smoke PASS, fixed like cron 0, TEST/PRODUCTION Worker unchanged PASS.

비용/기능 합격 상태:
- **코드/배포 검증:** 정상 캐시 개인 좋아요 entry path D1 membership read 0 설계 + 회귀 PASS.
- **실기기 CACHE LIVE:** 사용자 PC/모바일에서 app134 배포 후 아직 재측정 전. 이전 app133의 `46행 × 2 = 92행`은 FAIL 기록이며 app134 결과로 간주하지 않는다.
- **PC↔모바일 하트/숫자/내 좋아요 실사용 일치:** 사용자 실기기 재검증 전. 아직 기능 PASS로 선언 금지.
- 실제 좋아요 변경 write fanout은 별도 W1~W2 최종 실측 전이며, 기능을 희생해 W1을 강제하지 않는다.

환경/데이터:
- Firebase PREVIEW Hosting만 app134로 갱신.
- Cloudflare PREVIEW Worker만 새 version으로 갱신.
- Functions / Rules 변경 없음.
- TEST / PRODUCTION 코드·Worker·실제 HTML 비변경 PASS.
- 파괴적 migration/대량삭제/전체 backfill 없음.
- 사용자 원본 변경은 위 repair Run에서 **이미 서버가 접수했던 14개 좋아요 의도 반영 + 해당 1계정 exact 개인 카탈로그 재생성**으로 제한.

다음 실사용 합격선:
1. Cache Live 초기화 후 Explore 첫 진입: 좋아요 상태 D1 membership 행 읽기 **0 목표**. tiny revision/공용 R2/Worker 요청은 D1 membership scan과 구분.
2. 같은 화면 재진입/앱 포커스복귀/앱 새로고침: 개인 좋아요 D1 rows read 0.
3. PC/모바일 동일 계정 첫 화면 하트 + 공개 숫자 + 내 좋아요 동일.
4. PC에서 좋아요 OFF/ON 후 30초 묶음 확정 → 모바일 수렴, 반대 방향도 동일.
5. 실패 시 app134를 PASS 처리하지 말고 해당 track의 catalog revision/delta/direct settlement만 진단. 전체조회 fallback 복구 금지.


## 0DL. 사용자 확정 — Explore 좋아요도 Music Note식 개인 카탈로그 구조로 고정 (2026-09-22 KST)

사용자 실사용 CACHE LIVE에서 `좋아요 상태 확인`이 1회당 약 46 D1 rows read, 동일 진입 흐름에서 2회 실행되어 누적 92 rows read가 관측됨. 이는 전체 공개곡 Feed를 92곡 읽은 것이 아니라 **현재 개인 좋아요 membership을 D1에서 대상곡 단위로 재확인한 비용**이다. 그러나 정상 캐시 재진입에서 D1 read 0이라는 SORIDRAW 절대 기준에는 FAIL.

사용자 확정 구조:
- Explore 공개곡과 별도로 **계정별 좋아요 카탈로그**를 기기 캐시 + 공유 R2에 유지한다.
- 앱/페이지 진입: 기기 카탈로그를 즉시 사용하고 작은 개인 revision만 확인한다.
- revision 동일: 좋아요 상태 D1 read **0**, 전체/가시곡 membership 재조회 금지.
- revision 변경: D1 membership을 다시 훑지 않고 계정 R2 좋아요 카탈로그만 갱신한다.
- 새 기기/카탈로그 손상/정확한 카탈로그 자체가 없는 경우에만 1회 복구/bootstrap 허용. 앱 버전 업데이트 자체는 bootstrap 사유가 아님.
- 실제 좋아요/해제: 변경된 곡만 canonical relation/count 처리하고 해당 계정 카탈로그 + revision과 해당 공개곡 숫자만 갱신한다.
- 정상 진입 경로의 `/v1/me/likes` D1 membership 확인은 제거 대상. 예외 repair 전용으로만 제한한다.
- 수천/수만 공개곡 수에 비례하는 개인 좋아요 확인 금지. 사용자가 Explore를 열었다는 이유만으로 서버 데이터비용이 늘지 않아야 한다.

현재 source `0afd303a6ea3ac850747c31b920197b76ab13df8` + `6dd49e5079530058e512b182627425a91d499f1f`는 중복 재확인 방지의 일부일 뿐, 위 카탈로그 구조 완성본이 아니며 **아직 배포 금지**. 기존 PREVIEW live는 app133. PC/모바일 좋아요 비대칭과 069 queue 정체도 함께 정상화되어야 완료.

합격선: 정상 캐시가 있는 PC/모바일 Explore 첫 진입·재진입·포커스복귀·앱 업데이트에서 좋아요 상태 D1 rows read 0, 하트/숫자/내 좋아요 일치. 실제 좋아요 변경 때만 변경곡 단위 서버 사용. TEST/PRODUCTION 승격 금지 유지.


## 0DK. 실서버 읽기 전용 증거 — 069 좋아요 처리 대기열 장기 정체 / 복구 미확정 (2026-09-22 KST)

PREVIEW app133 사용자 스크린샷 PC 하트 ON/1 vs 모바일 OFF/0, CACHE LIVE 좋아요 상태 확인 D1 1쿼리 / 46행. 같은 곡 개인 관계가 불일치하며 정상 캐시 재진입 R0 불합격.

기존 GitHub `.github/workflows/diagnose-069-live-like.yml`의 공유 D1 **SELECT만 수행한 실서버 검사**에서 `explore_like_batches_069 = 7 batches / 14 mutations`, 가장 오래된 대기 약 **8,827초**, 가장 최근 약 **2,676초**, `035/066 = 0`, processor lease 활성 0을 확인. 정상 1분 후처리 대기와 맞지 않는다. 실제 데이터가 확정되지 않은 상태에서 PC의 큐 접수 ACK/R2와 모바일의 canonical D1이 다를 수 있는 직접적인 서버측 원인이다. **이 데이터는 조회 당시 스냅샷이며, 현재 큐가 0인지는 별도 후속 증명 필요.**

같은 실서버 EXPLAIN에서 현재 `/v1/me/likes` bounded 조회는 `tracks(id)` 및 `likes(track_id,user_uid)` 기본키 인덱스를 사용. R46을 46회의 HTTP 호출이나 무조건 전체 테이블 스캔이라고 설명하지 말 것. app133이 partial 개인 캐시를 재검증하며 읽는 비용과 실제 DB 조회 계획을 구분할 것.

특정 공개곡 제목 `끝내 돌아온 계절처럼`으로 canonical `tracks.title` 조회 결과 0건이어서 **이 곡의 개별 회원 관계를 식별한 것은 아님**. 0/0/0 반환은 일치 증명이나 무좋아요 판정 근거가 아니다.

기존 canonical scheduled 처리기로 제한된 069 대기열 복구를 시도하도록 PREVIEW GitHub trigger `5badc17d3b62299ab5cf821b4fd5ff9bff8462bb`를 push했고, 최종 읽기/cron 복귀 확인 trigger `6220e6b1eb15a6fc5987b5bf0653c363b721531e`도 push. **후처리 성공 / 현재 queue=0 / 임시 cron 복귀 / 실기기 좋아요 일치 / 추가 앱 배포는 모두 아직 미확인이다.** 로그가 확인되지 않으면 성공으로 보고하지 말고 추가 위험 조작을 중단할 것. 기 사용자 원본 강제수정·migration 없음. TEST/PRODUCTION 변경 금지.


## 0DJ. app133 실제 사용 FAIL — PC/모바일 좋아요 불일치 및 D1 행 읽기 46 (2026-09-22 KST)

사용자 제공 app133 PC·모바일·CACHE LIVE 실사용 증거: 첫 일부 곡은 양쪽 하트/숫자 1로 맞지만 `[Underground Hip-Hop] 끝내 돌아온 계절처럼`은 PC 하트 ON/1, 모바일 OFF/0. 따라서 **좋아요 기능 전체 PASS 금지**. CACHE LIVE `좋아요 상태 확인`은 Worker 요청 1, D1 쿼리 읽기 1, 누적 읽기 행 46, 쓰기 0. `/v1/me/likes-revision`은 D1 읽기 0. R46은 해당 좋아요 확인 요청의 관측치이며 46개의 API 호출이라는 뜻은 아님. 정상 재진입 read 0 비용 목표 **FAIL**.

원인 미확정: 서버 개인 canonical `likes`, 069/075 대기 중인 변경, 계정 R2 객체, PC `snapshotPending`, 모바일 확인 결과를 **같은 uid/trackId 기준으로 실제 대조하지 않았음**. PC 하트 ON을 서버 확정으로 가정하거나 공용 숫자만으로 본인 좋아요를 추론하지 말 것. 이전 app131~133의 정적/모의 테스트 PASS는 이 실제 오류를 검출하지 못했음.

**현재 운영 중단 지점:** PREVIEW app133 배포됨, 실사용 기능·비용 FAIL. 임의 추가 캐시 패치/배포/TEST·PRODUCTION 승격 보류. 공유 사용자 데이터 삭제·변환 금지. 먼저 실제 상태의 read-only 증거를 확보하고, 기능 보호를 선행할 것. 1~2 W 비용 목표를 위해 정상 기능을 제거하거나 사용자 데이터를 덮어쓰지 않는다.


## 0DI. PREVIEW app133 — partial legacy 좋아요 D1 재검증 수정 배포 완료 (2026-09-22 KST)

**배포 exact commit:** `587e60ff451ce64d9d24be5ae943f5a32d71825d`.
**사전 감사:** Release System Audit run `35650903841`, job `106514569533` (rerun) SUCCESS. exact audit HEAD `2034cb930a80913e161f6967228839b307d48dfa`.
**Firebase PREVIEW Hosting:** run `35651254609`, job `106515752564` (rerun) SUCCESS. locked source `587e60ff451ce64d9d24be5ae943f5a32d71825d`.

검증:
- TypeScript PASS / Build PASS / 실행형 partial R2 stale verified regression PASS / 전체 source & isolated like regression PASS.
- Firebase PREVIEW Hosting PASS; remote `app-version.json=133` / exact index build PASS.
- TEST / PRODUCTION code·실제 HTML 비변경 PASS.
- Worker / Functions / Rules 배포 없음. D1 schema 및 실제 사용자 데이터 migration/write/backfill/delete 없음.

수정: old partial R2 HEAD revision은 deferred 069/075 canonical D1 완료를 증명하지 못하므로 과거 세션의 targeted verification을 캐시 영구 정답으로 복원하지 않는다. partial 계정의 현재 보이는 50개 이하 곡만 session당 기존 targeted membership 경로로 재검증하고, 활성 사용 중 5분 이후 동일 R2 revision이어도 기존 targeted 검증만 만료한다. complete exact R2의 D1 R0 재진입, 현재 미전송 클릭, 30초 묶음, 기존 UI 보존.

**주의:** app133 코드 경로/배포 검증 PASS는 실제 동일 계정의 PC↔모바일 기능 PASS가 아니다. 현재 스크린샷의 5곡 canonical D1 개인 membership과 미확정 PC `snapshotPending`을 원격에서 인증 상태로 직접 대조하지 못했다. 해당 relation이 아직 queued거나 실패했다면 PC와 모바일이 계속 달라질 수 있다. 공개 숫자 1만으로 개인 하트 1을 강제하지 말 것. 사용자의 app133 실사용 검증 전 추가 비용 최적화/171 cutover/TEST/PRODUCTION 금지. 기존 W1~W2 gate 미통과 유지.


## 0DH. app133 소스 후보 — partial R2 동일 revision 아래 D1 최종상태 재검증 (2026-09-22 KST)

**사용자 app132 실사용: FAIL.** 사진에서 같은 곡의 PC 하트 ON + 숫자 1과 모바일 하트 OFF + 숫자 1이 동시에 관찰됨. 서버 전체 좋아요 수가 1이라는 사실만으로 어느 계정의 하트인지는 알 수 없음.

**코드에서 재현 가능한 경로:** PREVIEW Worker는 069 큐에 좋아요를 접수한 뒤 별도 scheduled 단계에서 canonical D1 `likes` 관계를 갱신한다. legacy personal R2가 partial인 계정에서는 `/v1/me/likes`가 canonical D1을 조회한다. 기존 모바일 `EXPLORE_LIKE_TARGETED_VERIFIED_130`은 조회한 0/1 값을 R2 HEAD revision에 묶어 기기에 영구 보관하지만, D1 큐가 나중에 처리되어도 그 R2 HEAD는 반드시 변하지 않는다. 같은 revision이라는 이유로 오래된 mobile 0/1을 다시 확인하지 않는 결함이다. 또 app131~132는 큐 ACK를 확정으로 전달해, PC가 실제 D1 완료 전 받은 좋아요를 로컬 `snapshotPending`으로 보존할 수 있다. 따라서 **PC 표시가 곧 최종 D1 상태라는 전제는 성립하지 않는다.**

이번 클라이언트 수정 `1d1ece060ce4bac7d0bc0a4e6c565bf6b85c1613`:
- partial R2 계정에 한해 이전 앱 세션의 revision-keyed exact membership 검증을 복원하지 않음. 최초 현재 화면의 곡만 기존 최대 50개 bounded canonical endpoint로 확인. complete exact R2 계정과 기기 캐시의 일반 진입은 변경 없음.
- partial account의 R2 revision이 5분 뒤에도 같으면 targeted 검증만 만료해 다음 활성 Explore 입장에서 visible IDs만 다시 확인. 이전 표시값은 확인 결과 전까지 보존.
- 실행형 회귀 `74214aa93598e3537c1e63b97d1261bf5e620ef5`: R2 HEAD 동일 + D1 later materialized 상황에서 partial verified stale 복원 금지, complete 동일 revision 캐시 복원 보호.
- 앱 버전 133 candidate `7ecd7fd1ec919c5924660d703331b7e88ed748b2`.

**검증 한계:** 특정 사용자 5곡에 대한 실제 인증 canonical D1/R2/RTDB 상태를 이 정적 감사만으로 조회한 것은 아님. 서버 큐가 미완료/실패했다면 PC의 미확정 ACK와 모바일 canonical 값이 여전히 달라질 수 있다. 그런 경우 실제 상태 계측과 queue drain 원인 확인 없이는 다른 기기 하트를 강제 ON으로 조작하지 않는다. 수정 이후 완전 해결 여부는 실사용 미검증.

**배포:** TypeScript/Build/like regression/Release Audit PASS 전 배포 보류. 범위는 preview 앱·테스트·문서만. Worker/Functions/Rules/shared D1/R2 사용자 원본 비변경. W1~W2 별도 비용 gate FAIL 유지. TEST/PRODUCTION 승격 금지.


## 0DG. PREVIEW app132 — PC/모바일 개인 좋아요 캐시 일치 hotfix 배포 완료 (2026-09-22 KST)

**배포 고정 commit:** `ffff163783c3103a9594903132480ce356846ad2`.
**코드 후보:** `164c9f77fe3540df9e721bdc4c1e2f868c0918f0`; `src/services/exploreLikeService.ts` 핵심 수정 `e5b6ff64cd649577411c3208c7970b97c8f61499`.
**감사:** Release System Audit Run `35650903841` job `106508627342` rerun SUCCESS; checkout exact preview `b4377a1529df90a1ebff64c62c9a915321d2ca0b`.
**Hosting:** PREVIEW App Release Run `35651254609` job `106509860243` rerun SUCCESS; checkout exact source `ffff163783c3103a9594903132480ce356846ad2`.

검증 로그:
- TypeScript PASS / Build PASS / like regression PASS / release-system audit PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `https://preview.soridraw.com/app-version.json` **132** 확인, remote exact `index.html` build PASS.
- TEST / PRODUCTION git ref 및 실제 주소 변경 없음 PASS.
- Worker/Functions/Rules 재배포 0. 공유 사용자 D1/R2 migration/backfill/delete/write 0. 기존 사용자 원본 구조 그대로 유지.
- W1~W2 제품 합격선은 **이번 앱 수정으로 새롭게 달성한 것이 아니다**. 기존 source 비용 gate에는 알려진 FAIL이 있으며, 비용 최적화 및 TEST/PRODUCTION 승격은 계속 보류한다.

app132 변경 내용: 첫 retained RTDB 신호, 오래된 partial-R2 개인 캐시 및 기기별 이전 snapshotPending이 다른 기기에서 승인된 새 좋아요/해제 상태를 막지 않도록 정리. 하트 bool이 같더라도 전달된 숫자가 변경되면 Feed/프로필/내 좋아요에 전파하고, Explore가 마운트되기 전에도 받은 값을 로컬 display lock에 보존. 기존 30초 sliding batch, UI/CSS 유지.

**현재 마지막 상태: PREVIEW app132 배포·서버 exact build 확인 완료. PC/모바일 실사용 상호 일치는 사용자 재검증 전이다.** 같은 계정 4곡의 하트·숫자·내 좋아요가 첫 진입에서 동일한지 확인하고, ON→OFF→ON 후 30초 ACK 뒤 다른 기기에서 새로고침/탭 왕복 없이 수렴해야 합격. 실패 시 추가 비용 최적화/171 cutover/TEST/PRODUCTION 진행 금지.


## 0DF. app132 PREVIEW source 후보 — 최신 계정 좋아요 신호와 기기 캐시 일치 복구 (2026-09-22 KST)

**기준 PREVIEW app131 live:** Hosting Run `35651254609` SUCCESS. **현재 app132는 아직 배포되지 않았다.**
**이번 소스 후보:** `164c9f77fe3540df9e721bdc4c1e2f868c0918f0` (서비스 수정 `e5b6ff64cd649577411c3208c7970b97c8f61499`; 회귀 검사 `8941b412b1f970df5f2346f93b60f070da979db2`).

사용자 실사용 PC/모바일 사진: PC의 기존 찬 하트 여러 개가 모바일 첫 추천 화면에서 빈 하트/0으로 표시. 사용자의 요구는 최신 계정 상태를 캐시·서버 어느 경로든 일관되게 표시하는 것. **app131 실사용 FAIL**.

이번 좁은 수정:
- 첫 RTDB retained signal이 오는데 기기 자체 signal watermark가 0이라는 이유만으로 이전 R2 baseline 복구 분기로 돌려 현재 signal을 버리던 조건 제거. 실제 놓친 signal 구간은 기존 repair 유지.
- 다른 기기의 새 ACK가 왔을 때 이전 `snapshotPending`이 최신 개인 상태를 영구 차단하지 않게 변경. 아직 전송하지 않은 해당 기기 로컬 클릭은 기존대로 보호.
- partial R2 계정에서도 이미 서버 ACK된 개인 0/1 상태는 기존 원격 signal을 `snapshotPending`에 보관, 느린 targeted legacy D1 응답이 다시 덮지 않게 한다.
- 같은 하트 상태라도 서버가 보내온 좋아요 숫자가 달라졌다면 이를 생략하지 않고 Feed/프로필/내 좋아요 및 기기 저장 display lock에 반영. 이벤트가 Explore 마운트 전에 도착해도 보호.
- 30초 묶음 저장·기존 Worker/공유 D1·UI/CSS/Functions/Rules는 변경하지 않음.

**검증 단계:** TypeScript / Build / 관련 회귀 / Release Audit는 아직 실행 결과 확인 전. GitHub push는 배포가 아니다. 사전검사 PASS 시에만 고정 PREVIEW Hosting 릴리스 트리거를 사용하며, 실패하면 배포 보류.
**실사용 합격:** PC와 모바일의 동일한 곡 하트 + 공개 숫자 + 내 좋아요가 첫 화면부터 일치하고, 마지막 클릭 후 30초 ACK 후에는 탭 왕복·새로고침 없이 수렴해야 한다. 불일치면 비용 최적화/TEST/PRODUCTION 금지.
**알려진 제약:** 공유 공개 집계가 Worker에서 후처리되는 동안 서버 자체 공개 숫자는 지연될 수 있다. 개인 계정 승인 상태를 보호하는 이번 수정만으로 공개 집계의 즉시 확정까지 증명된 것은 아님.


## 0DE. PREVIEW app131 — PC↔모바일 좋아요 자동 동기화 복구 배포 완료 (2026-09-22 KST)

**PREVIEW 배포 고정 commit:** `32117f1a81b8b2741fe616b15420201c00d05c05`.
**제품 수정 기준:** `f6dbf81592bc64956525e4ac257ed944d50d9d41`.
**최종 Audit:** Run `35650903841` SUCCESS.
**PREVIEW Hosting:** Run `35651254609` SUCCESS.

배포 결과:
- remote app version **131**
- PREVIEW exact build PASS
- TypeScript PASS / Build PASS
- Firebase PREVIEW Hosting PASS
- TEST / PRODUCTION unchanged PASS
- Worker 재배포 0
- D1 schema/migration/user-data change 0
- Functions / Rules 변경 0

app131 핵심:
- 같은 계정의 좋아요 변경은 30초 sliding batch 저장 후 서버 ACK가 성공하면 UID 전용 RTDB 신호로 다른 기기에 전파.
- 다른 기기는 새로고침/탭 왕복 없이 해당 곡의 하트·숫자·내 좋아요를 같은 변경으로 반영.
- public aggregate 정산이 늦어도 계정 개인 좋아요 동기화는 더 이상 `settled` 플래그를 기다리지 않음.
- partial baseline marker도 원격 변경 gap 복구 시 무효화하여 오래된 모바일 캐시가 계정 최신 상태를 가로막지 않게 함.
- UI/CSS/반응형 변경 없음.

새 운영 지시:
- 사용자가 수정 작업을 지시했고 사전검사 PASS로 PREVIEW 배포가 안전한 경우, 별도 배포 승인 질문 없이 **수정 → PREVIEW 배포까지 자동 진행**.
- 이 규칙은 PREVIEW에만 적용. TEST/PRODUCTION 승격 규칙은 기존대로 유지.

실사용 검증:
1. A기기에서 좋아요/해제.
2. 마지막 클릭 후 30초 batch 저장 성공 뒤 B기기에서 자동으로 같은 상태가 되는지.
3. B기기에서 하트 + 숫자 + 내 좋아요가 함께 바뀌는지.
4. 새로고침이나 인기/추천 탭 왕복이 필요하면 FAIL.
5. 위 통과 전 추가 비용 최적화/171 cutover/TEST/PRODUCTION 승격 금지.


## 0DD. app131 — PC↔모바일 좋아요 계정 동기화 정상 경로 복구 source 감사 PASS (2026-09-22 KST)

**현재 preview HEAD 기준:** `c4097dab6b6fb7b7a87d37652491429178631b9a`.
**제품 수정 기준:** `f6dbf81592bc64956525e4ac257ed944d50d9d41`.
**최종 Release System Audit:** Run `35650903841` SUCCESS.

실제 원인:
- app119~120 비용 최적화 과정에서 기존 RTDB 계정 좋아요 동기화 경로가 비활성화됨.
- 이후 app127~130에서는 서버 batch ACK 뒤에도 `settled` 상태를 받아야만 다른 기기에 좋아요를 알리도록 막혀 있었음.
- 현재 PREVIEW Worker는 그 `settled` 값을 발행하지 않아, 한 기기에서 좋아요를 바꿔도 다른 기기는 자동으로 최신 상태를 받지 못할 수 있었음.

app131 수정:
- 30초 묶음 저장은 그대로 유지.
- 서버 batch ACK가 성공한 계정 좋아요 0/1 상태는 public aggregate 정산을 기다리지 않고 UID 전용 RTDB 신호로 다른 기기에 전파.
- 다른 기기는 해당 곡의 하트 + 숫자 + 내 좋아요를 같은 account state 이벤트로 반영.
- canonical aggregate가 아직 늦게 반영되는 동안에는 기존 local display lock/snapshot pending 보호를 유지.
- revision-conflict / ineligible 응답은 기존대로 최신 canonical 상태를 수용하며 잘못된 사용자 의도를 재전파하지 않음.
- 원격 signal gap 복구 시 complete baseline뿐 아니라 partial baseline marker도 같이 무효화하여, partial legacy 계정에서도 다른 기기 변경을 다시 확인할 수 있게 수정.
- 알림 실패 시 성공한 D1 batch를 다시 전송하지 않고 기존 RTDB retry 경로만 유지.
- UI/CSS/반응형 변경 없음.

검증:
- TypeScript PASS
- Build PASS
- Static release verification PASS
- Like candidate regression PASS
- TEST / PRODUCTION Worker dry-run PASS
- live shared D1 preflight read-only PASS
- branch refs unchanged PASS
- Audit Run `35650903841` SUCCESS

비용/데이터:
- 30초 sliding batch 유지.
- Worker 제품 코드 변경 0.
- D1 schema/migration/write 구조 변경 0.
- 사용자 데이터 migration/backfill/delete 0.
- Firebase Functions/Rules 변경 0.
- TEST / PRODUCTION 변경 0.

**실제 PREVIEW live는 아직 app130. app131은 배포 전이다.**


## 0DC. PREVIEW app130 — 모바일 최초 진입 좋아요 최신계정 revision 동기화 배포 완료 (2026-09-22 KST)

**PREVIEW 배포 고정 commit:** `a045c7e5b12db22cc8153c29aee44d0ae3e296c2`.
**제품 코드 기준:** `1c850beed0a4b4409b96acbb636176ea2cfe4bac`.
**사전 Audit:** Run `35648185770` SUCCESS.
**PREVIEW Hosting:** Run `35648709408` SUCCESS.

실사용 사진에서 확인된 모바일 최초 진입 불일치 대응:
- 개인 좋아요 exact 검증 캐시를 계정 개인 R2 revision과 함께 저장.
- app129 이하의 revision 없는 track-ID-only verified cache는 app130 첫 진입에서 신뢰하지 않음.
- 저장 revision과 현재 계정 revision이 다르면 과거 검증 캐시를 무효화하고 현재 화면의 곡만 bounded exact 검증.
- revision이 같으면 캐시 재사용하여 변경 없는 재진입 서버 읽기 증가를 막음.
- 목표: 인기 탭 왕복 없이 모바일 첫 추천/최신 화면부터 PC 최신 하트 상태와 일치.

배포 검증:
- TypeScript PASS / Build PASS
- Firebase PREVIEW Hosting PASS
- remote app version **130**
- PREVIEW exact build PASS
- TEST / PRODUCTION unchanged PASS
- Worker 재배포 0 / Functions 0 / Rules 0
- D1 schema·migration·사용자 데이터 write/backfill/delete 0

현재 상태:
- 실제 PREVIEW live = app130.
- 모바일 실사용 첫 진입 결과는 사용자 확인 전.
- app130 확인 전 171 D1-only cutover / TEST / PRODUCTION 승격 금지.


## 0DB. app130 모바일 최초 진입 오래된 좋아요 캐시 차단 — source 감사 PASS (2026-09-22 KST)

**현재 preview HEAD 코드:** `1c850beed0a4b4409b96acbb636176ea2cfe4bac`.
**Release System Audit:** Run `35648185770` SUCCESS.

실사용 사진에서 확인된 증상:
- PC는 최신 좋아요 4곡인데 모바일 앱 업데이트 직후 첫 화면은 일부 곡이 0/빈 하트로 표시.
- 인기 탭에 갔다가 추천/최신으로 돌아오면 일부 값이 뒤늦게 바뀜.
- 즉 서버 최종값 자체보다 모바일 첫 화면이 과거 기기 캐시를 먼저 확정값처럼 쓰는 문제가 남아 있었음.

이번 수정:
- 모바일/PC 공통 개인 좋아요 exact 검증 캐시를 **계정 개인 R2 revision과 한 세트**로 저장.
- 예전 app129 이하의 track ID-only verified cache는 app130 첫 진입에서 신뢰하지 않음.
- 저장된 revision과 현재 계정 revision이 다르면 이전 verified membership을 무효화하고 현재 보이는 곡만 bounded exact 확인.
- revision이 같으면 기존 검증 캐시를 그대로 사용해 재진입 서버 조회를 반복하지 않음.
- revision이 아직 없으면 exact 검증을 세션 밖에 영구 저장하지 않아 오래된 모바일 상태가 다음 앱 시작까지 살아남지 않게 함.

검증:
- TypeScript PASS
- Build PASS
- Static release verification PASS
- Like regression PASS
- TEST / PRODUCTION Worker dry-run PASS
- live shared D1 preflight read-only PASS
- branch refs unchanged PASS

변경하지 않은 것:
- Worker 제품 코드 0
- Firebase / Functions / Rules 변경 0
- D1 schema / migration / 사용자 데이터 write 0
- UI/CSS 변경 0
- TEST / PRODUCTION 변경 0

**실제 PREVIEW live는 아직 app129. app130은 배포 전이다.**


## 0DA. PREVIEW app129 — 하트·숫자·내 좋아요 단일 좋아요 원자 배포 완료 (2026-09-22 KST)

**PREVIEW 배포 고정 commit:** `0a8b1d6820493c82d8cc2924446153c967fa3798`.
**제품 코드 기준:** `2c9745487517b86f1f910c651497be6a0003bca8`.
**PREVIEW Hosting Run:** `35646734214` SUCCESS.

배포된 기준:
- 한 계정 + 한 곡 = 좋아요 0 또는 1.
- OFF→ON = 하트 ON + 공개 숫자 +1 + 내 좋아요 포함.
- ON→OFF = 하트 OFF + 공개 숫자 -1 + 내 좋아요 제거.
- 동일 상태 중복 요청은 숫자/하트 변화 없음.
- 꽉 찬 하트 + 숫자 0은 불가능한 표시로 간주하고, 현재 계정의 최소 1개 기여분만 보정.
- 원격 canonical likeCount가 오면 Feed / 공개프로필 / 내 좋아요 카드에 하트·숫자를 같은 이벤트로 반영.
- 내 좋아요는 별도 판정 기준이 아니라 개인 하트 membership의 카드 표시 캐시.

배포/검증:
- 사전 Release System Audit `35645617094` SUCCESS.
- TypeScript PASS / Build PASS / Like regression PASS.
- Firebase PREVIEW Hosting deploy PASS.
- remote `app-version.json=129` PASS.
- PREVIEW exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker 재배포 0. active PREVIEW Worker `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- Functions / Rules / D1 migration / 사용자 데이터 migration·backfill·delete 0.

현재 실사용 검증:
1. 같은 곡 OFF→ON에서 하트 ON + 숫자 +1 + 내 좋아요 포함이 함께 보이는지.
2. ON→OFF에서 하트 OFF + 숫자 -1 + 내 좋아요 제거가 함께 보이는지.
3. 같은 상태 반복/재시도에서 숫자가 두 번 변하지 않는지.
4. 같은 계정 PC↔모바일에서 30초 배치 후 최종 하트·숫자·내 좋아요가 같은 결과로 수렴하는지.

위 실사용 통과 전 171 D1-only cutover / TEST / PRODUCTION 승격 금지.


## 0CZ. app129 좋아요 단일 원자 규칙 source 수정 + 감사 PASS (2026-09-22 KST)

**현재 preview HEAD 기준 코드 commit:** `2c9745487517b86f1f910c651497be6a0003bca8`.
**Release System Audit:** Run `35645617094` SUCCESS.

이번 수정의 기준은 하나다.

- 한 계정 + 한 곡 = 좋아요 상태 0 또는 1만 존재.
- OFF→ON 한 번은 **하트 ON + 공개 숫자 정확히 +1 + 내 좋아요 포함**을 하나의 변경으로 취급.
- ON→OFF 한 번은 **하트 OFF + 공개 숫자 정확히 -1 + 내 좋아요 제거**를 하나의 변경으로 취급.
- 이미 같은 상태를 다시 적용하면 숫자와 하트 모두 변화 없음.
- 꽉 찬 하트인데 공개 숫자 0인 화면 상태는 불가능한 상태로 취급. 현재 계정 자신의 1개 기여분까지만 최소 보정하며 다른 사용자 수는 임의 변경하지 않음.
- 원격에서 canonical likeCount가 함께 도착하면 Feed / 공개프로필 / 내 좋아요 카드의 하트·숫자를 같은 이벤트에서 함께 갱신.
- 내 좋아요 목록은 별도 좋아요 판정 기준이 아니라, 동일 개인 하트 membership의 표시용 카드 캐시로 유지.

변경 파일:
- `src/services/exploreLikeService.ts`
- `src/pages/ExplorePage.tsx`
- `scripts/verify-127-atomic-personal-like.mjs`

검증:
- TypeScript PASS
- Build PASS
- Static release verification PASS
- Like regression PASS
- TEST / PRODUCTION Worker dry-run PASS
- live shared D1 preflight read-only PASS
- branch refs unchanged PASS

변경하지 않은 것:
- Worker 제품 코드 변경 0
- Firebase / Functions 변경 0
- D1 migration / schema apply 0
- 사용자 데이터 write / backfill / delete 0
- TEST / PRODUCTION 배포 0
- UI/CSS 변경 0

**실제 PREVIEW 배포 상태:** 아직 app128이 live. app129 단일 좋아요 원자 수정은 source 감사 완료 상태이며 PREVIEW Hosting 배포 전이다.


## 0CY. PREVIEW app128 — partial R2 상태에서도 좋아요 클릭 잠금 해제 배포 완료 (2026-09-22 KST)

사용자 두 번째 실사용 영상에서 중요한 사실을 다시 확인했다.
- `/v1/me/likes-revision`: **FULL 200**
- `/v1/me/social-snapshot`: **FULL 200**
- 그런데 화면은 계속 **“좋아요 상태를 확인하고 있어요”**로 클릭을 차단했다.

실제 원인:
- legacy 개인 좋아요 R2 snapshot이 `likesComplete=false`인 사용자에서 app127은 안전을 위해 전역 baseline을 완료 처리하지 않는다.
- 동시에 visible track의 기존 local cache 값이 이미 존재하면 `getExploreLikedTrackIds`가 그 곡을 “missing 아님”으로 판단해 bounded exact `/v1/me/likes?trackIds=...` 검증을 생략했다.
- 결과적으로 화면에는 하트가 보이지만 mutation gate는 영원히 `undefined` 상태가 되어 클릭이 막혔다.

수정:
- partial account snapshot에서는 기존 cache 유무와 상관없이, 아직 exact-targeted 검증되지 않은 visible track만 최대 50개 단위로 `/v1/me/likes`에서 확인.
- 확인된 track ID만 별도 local verified set으로 저장해 mutation 허용.
- account R2 revision 변경 / repair 요청 시 verified set을 즉시 무효화하여 오래된 상태가 새 변경을 덮지 못하게 유지.
- complete snapshot 사용자는 기존처럼 추가 targeted read 없이 사용.
- UI/CSS 변경 없음.

검증/배포:
- source audit Run `35636601460` SUCCESS.
- app128 final audit Run `35636890502` SUCCESS.
- PREVIEW Hosting Run `35637112915` SUCCESS.
- remote app version: **128**
- `preview.soridraw.com` exact build PASS.
- active PREVIEW Worker는 기존 hotfix `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- TEST / PRODUCTION unchanged PASS.
- D1 migration 0 / final cutover 0 / user-data migration 0.

현재 사용자 확인:
- 업데이트 후 Explore 진입.
- 기존 하트 상태가 표시되는지.
- 빈 하트/찬 하트가 즉시 클릭되는지.
- “좋아요 상태를 확인하고 있어요” 반복 차단이 사라졌는지.
- 이후 30초 배치 및 PC↔모바일 최종 수렴 확인.


## 0CX. 앱127 PREVIEW 좋아요 클릭 차단 hotfix 완료 (2026-09-22 KST)

사용자 실사용 영상에서 `/v1/me/likes-revision` **HTTP 404**를 확인했고, 이 때문에 app127 개인 좋아요 상태 확인이 끝나지 않아 카드 클릭이 **“좋아요 상태를 확인하고 있어요”**로 차단되는 실제 배포 오류를 확인했다.

원인:
- app127은 private personal-like revision route(072)를 호출하지만,
- 당시 배포 canonical Worker 173/174에는 072/073/074가 materialize되지 않아 route가 실제 Worker에 없었다.
- 기존 Worker release smoke가 batch route만 확인해 이 조합 불일치를 놓쳤다.

수정/검증:
- canonical Worker에 072 personal revision route + 073 server-order queue + 074 personal R2 CAS/precommit guard materialize.
- materialize Run `35634804179` SUCCESS.
- final audit Run `35635080613` SUCCESS.
- PREVIEW Worker hotfix Run `35635316035` SUCCESS.
- canonical SHA256 `bee426ca157957c83c658370658e41b7bde68ae650c68c9e13a3c49a7fa83d1d`.
- active PREVIEW Worker `733c3981-4095-4c69-bf33-9abb5de7a450`.
- smoke: like batch HTTP 401, **like revision HTTP 401 (404 아님)**.
- Feed/Profile smoke PASS.
- TEST/PRODUCTION Worker unchanged PASS.
- D1 migration 0 / cutover activation 0 / user-data migration 0.

현재 사용자 확인:
- PREVIEW 새로고침 후 기존 하트 표시.
- 빈/찬 하트 모두 즉시 클릭 가능.
- “좋아요 상태를 확인하고 있어요” 반복 차단이 사라졌는지.
- PC↔모바일 최종 좋아요 상태 수렴.


## 0CW. PREVIEW 앱127 + Worker173/174 배포 완료 — 실사용 검증 단계 (2026-09-22 KST)

**현재 PREVIEW HEAD:** `f677bccbc2111ce51ba983cc88fc23690ae37882`.

### 실제 PREVIEW 배포 완료
- **앱 127** Firebase PREVIEW Hosting Run `35632767964` — **SUCCESS**.
  - 배포 고정 SHA: `f677bccbc2111ce51ba983cc88fc23690ae37882`
  - TypeScript PASS / Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - `preview.soridraw.com` exact build PASS
  - remote `app-version.json=127` PASS
  - TEST / PRODUCTION branch + Hosting unchanged PASS
- **Explore Worker 173/174 canonical** Run `35631742053` — **SUCCESS**.
  - active PREVIEW Worker version: `f3c66d58-8e24-4eaa-923c-f61fe369e36f`
  - canonical Worker SHA256: `49f15336ae91af13f75c45f6d349645b336520426d8bfdc9ee9b8c95b7d27047`
  - Feed smoke PASS / Profile smoke PASS / revision HEAD-only PASS
  - warm revision D1 R0/W0 PASS
  - TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
  - PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged

### 배포 전 최종 감사
- 앱127/Worker173~174 최종 감사 Run `35632451095` — **SUCCESS**.
- TypeScript / Build / static release verification / like regression / TEST+PRODUCTION Worker dry-run / live shared D1 read-only audit PASS.
- 기존 구형 검사식이 173/174의 정상 승격 상태를 구형 기준으로 오판하던 부분만 갱신했고, 제품 동작을 검사에 맞추기 위해 되돌리지는 않았다.

### 이번 PREVIEW에서 실제 확인할 핵심
- 동일 계정 PC↔모바일에서 하트 상태가 오래된 요청에 의해 역행하지 않는지.
- 좋아요/해제 후 공개 숫자가 늦게 도착한 오래된 Feed/Profile/Card 응답으로 되돌아가지 않는지.
- 30초 묶음 처리 후 다른 기기에서 개인 하트가 최신 상태로 수렴하는지.
- 업데이트 후 기존 좋아요 상태가 유지되는지.

### 아직 활성화하지 않은 것
- 171 shared D1 additive migration: **미적용**.
- D1-only 최종 cutover marker: **미활성**.
- drain/cutover R2 marker write: **0**.
- 사용자 원본 데이터 migration / 대량변환 / backfill: **0**.
- TEST / PRODUCTION 승격: **0**.

즉 현재 PREVIEW에는 173/174 안전장치와 앱127 클라이언트가 실제 배포되어 테스트 가능하지만, **W2 D1-only 최종 전환 자체는 아직 dormant**다. 사용자 PREVIEW 실사용 확인 후 다음 단계에서 171 schema + cutover 절차를 별도 승인/검증한다.


## 0CV. 170~172 실제 D1 비용 실측 + D1-only W2 구조 + dormant 제품 route — 감사 PASS / 전환 미활성 (2026-09-21 KST)

**현재 코드 감사 기준:** `preview` exact commit `32795d33710a8f0f3bec6d280a2fd3f740232bb4`, GitHub Actions [35616444369](https://github.com/andrawing1212/soridraw-music/actions/runs/35616444369) **SUCCESS**. canonical Worker exact SHA256 `f215f3d49a4259183c829d3d73d0055013eb199c8d33637730c48ec07d906750`. TypeScript / Build / static release verification / isolated like regression / TEST Worker dry-run / PRODUCTION Worker dry-run / live shared D1 read-only audit PASS, `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`.

### 실제 격리 원격 D1 비용 결론

실 사용자 DB가 아닌 실행 중 생성 후 삭제하는 **ephemeral Cloudflare D1**에서 측정했다.

- 기존 168 legacy 물리 구조 하한:
  - 새 좋아요: `statement_writes 5/3/0 = W8`
  - 해제: `2/2/0 = W4`
  - 동일 상태 재요청: `W0`
  - 따라서 168은 relation/count 원자성 안전장치로는 유효하지만 SORIDRAW 절대 비용 합격선 W1~W2는 **FAIL**.
- 157 sparse overlay 단독 relation 후보: 원격 D1에서 W2/W1/W0 검증.
- 새 171 **D1-only relation + count-delta** 후보:
  - 실제 상태 변경 1회: user/track override W1 + track count-delta W1 = **W2**
  - 동일 상태/중복: **W0**
  - 신규 baseline-unliked / 기존 baseline-liked 양쪽 like→unlike→like 복귀 모두 W2/W0 유지.
  - relation `revision`과 track `generation`은 실제 변경 때만 정확히 +1, 중복 때 증가 없음.
  - 원격 측정 run [35601590772](https://github.com/andrawing1212/soridraw-music/actions/runs/35601590772), ephemeral DB 삭제 PASS.
- 171은 Durable Object 없이 공유 D1 두 hot rows만 변경한다. 기존 `likes`와 `track_stats.like_count`는 **전환 순간의 immutable baseline**으로 두고 post-cutover 변경만 저장하는 no-backfill 방향이다.

### 171/172 source-only 구현

- `cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql`
  - **UNAPPLIED** additive candidate.
  - `explore_like_overrides_171`: `WITHOUT ROWID`, PK(user_uid, track_id), liked/revision/last_operation_id.
  - `explore_like_count_deltas_171`: `WITHOUT ROWID`, PK(track_id), delta/generation.
  - hot mutation table secondary index 0, seed/backfill/destructive DDL 0.
- `runtime/like-d1only-171.mjs`
  - shared cutover가 객관적으로 verified일 때만 생성 가능한 dormant adapter.
  - expectedRevision + stable operationId 기반.
  - applied는 exact W2/revision/generation 계약만 허용, no-op/duplicate/conflict는 W0, asymmetric/W3+ receipt는 fail closed.
- PC↔mobile 격리 모델:
  - 오래된 revision 요청이 최신 상태를 덮지 못함 PASS.
  - 같은 desired 동시 요청 중 두 번째는 W0 PASS.
  - 명시적으로 최신 revision으로 rebase된 새 사용자 의도만 다음 canonical 변경이 됨.
  - 기존 baseline row backfill 없이 동일 규칙 적용 PASS.
- `src/services/exploreLikeService.ts`
  - 기존 30초 sliding idle batch 및 로컬 즉시 하트 동작을 유지하면서 per-track canonical revision을 별도 작은 로컬 cache에 저장.
  - 기존 outbox의 stable operationId와 함께 `expectedRevision`을 batch payload에 보냄.
  - legacy Worker 응답은 revision 없이도 기존 방식으로 동작하여 하위호환.
  - 172 canonical revision-conflict 응답은 오래된 로컬 의도를 자동으로 재실행하지 않고 canonical 최신 상태를 수용하도록 source-only 준비.
- `patches/082-like-d1only-route.mjs` + canonical Worker:
  - shared cutover manifest **schemaVersion 2 + relationMode=d1only171 + preCutoverProof172**가 완전히 armed일 때만 batch가 171 adapter를 사용.
  - source 변경만으로는 절대 활성화되지 않음.
  - d1only171 모드에서는 legacy 069/035/066/075 queue를 사용하지 않음.
  - bodyless old direct PUT/DELETE는 d1only171 이후 revision을 임의 생성하지 않고 refresh-required 409로 fail closed.
  - legacy mode에서는 기존 165 drain/legacy queue가 유지됨.
  - final non-legacy 상태는 legacy scheduled/direct writer를 차단.
- replay: 169→172 patch 적용 PASS, 082 idempotency PASS.

### 172 감사 PASS 근거

run `35616444369`:
- `171_UNAPPLIED_SCHEMA_TWO_HOT_ROWS_NO_SECONDARY_INDEX=PASS`
- `171_SCHEMA_NO_BACKFILL_NO_SEED_NO_DESTRUCTIVE_DDL=PASS`
- `172_171_ADAPTER_APPLIED_W2_DUPLICATE_W0=PASS`
- `172_171_ADAPTER_STALE_REVISION_CONFLICT_W0=PASS`
- `172_171_ADAPTER_ASYMMETRIC_OR_W3_FAIL_CLOSED=PASS`
- `172_DORMANT_ROUTE_REQUIRES_SCHEMA2_SHARED_PROOF=PASS`
- `172_BATCH_W2_ROUTE_PRECEDES_LEGACY_QUEUE=PASS`
- `172_DIRECT_BODYLESS_ROUTE_FAILS_CLOSED_AFTER_CUTOVER=PASS`
- `172_CLIENT_EXPECTED_REVISION_BACKWARD_COMPATIBLE=PASS`
- `172_ROUTE_NOT_ARMED_BY_SOURCE_CHANGE=PASS`
- `171_PC_MOBILE_STALE_REVISION_CANNOT_OVERWRITE=PASS`
- `082_DEPLOYED_169_TO_172_REPLAY=PASS`
- TEST/PRODUCTION dry-run PASS, no deploy PASS.

### 아직 남은 blocker — 완료라고 보고 금지

1. **171 schema는 실제 shared D1에 미적용**. 사용자 승인 없는 migration 금지 유지.
2. **preCutoverProof172 생성/검증 controller 미완료.** 현재 164 read-only preflight는 기존 157 기준이며 `READY=NO` (legacy intake open, 157 schema absent). 172는 별도의 exact schema / all-environment Worker SHA / processor idle / queue drain / legacy in-flight 종료 증명이 필요하다.
3. **R2 publication 미완료.** 172 D1 result의 `generation`을 사용해 shared track card / latest+popular Feed / public profile count가 늦게 도착한 과거 값으로 덮이지 않도록 monotonic publication guard가 필요하다. 개인 shared likes R2도 per-track revision/CAS로 PC↔mobile에 최종 상태를 정확히 전파해야 한다.
4. 기존 실제 배포 PREVIEW/TEST/PRODUCTION Worker가 모두 172 fence-aware 버전으로 교체되고 이전 in-flight가 사라졌다는 증명 전 final marker arm 금지.
5. 069 자동 Apply workflow는 patch manifest 변경에 반응하는 오래된 별도 경로가 남아 있으며 service marker mismatch로 deploy 전에 FAIL한다. release-system과 혼합/우회 금지.
6. Work 독립 감사, PREVIEW 실제 배포 후 PC↔mobile 실사용 및 실제 사용자 경로 비용 측정 미완료.

**실데이터/배포 영향:** shared 사용자 D1 row write 0, 171 migration apply 0, R2 cutover/drain marker arm 0, backfill/delete/overwrite 0. Worker/Hosting/Firebase/Functions 배포 없음. main/PRODUCTION 비변경. UI 변경 없음. Music Note 60초 묶음 저장 비변경.


## 0CU. 168 직접 좋아요 원자적 D1 batch + 169 최종 batch 재진입 차단 — 코드 감사 PASS / 제품 전환 BLOCKED (2026-09-21 KST)

**고정 검사:** `preview` code-audit commit `784568e785c203978c2b2fc36e1d50d67579955e`, GitHub Actions [35596351769](https://github.com/andrawing1212/soridraw-music/actions/runs/35596351769) **SUCCESS**. 이전 direct 168 단독 감사 [35595813905](https://github.com/andrawing1212/soridraw-music/actions/runs/35595813905)도 SUCCESS. 중간 첫 실행 두 건의 static FAIL은 새 canonical Worker SHA256 고정값이 아직 옛 값인 상태에서 실행된 것이며 새 해시 pin 후 exact 코드 감사를 통과했다. 제품 앱/Worker 배포가 아닌 source-only 및 격리 SQLite 검증이다.

**이번 코드 변경:**
- `runtime/like-direct-atomic-168.txt`, `patches/080-direct-like-atomic-batch.mjs`, `canonical/preview-worker.js`: 구형 direct `adjustExploreLikeCounterDelta`의 분리된 relation 저장 및 counter 변경을 하나의 `env.DB.batch([...])` 안에 넣었다. 첫 statement의 실제 변경이 `changes()=1`인 경우에만 `track_stats`를 변경하며, 마지막 SELECT에서 실제 likeCount를 읽는다. 새 좋아요·해제에서 relation/count 둘 중 하나만 commit되지 않도록 하는 후보. 같은 상태 재요청은 relation/counter W0이 되도록 격리 모델 검증. 기존 direct 인증/edge rate limit/165 drain/163 final cutover guard는 유지.
- `patches/081-batch-like-final-freeze.mjs`, canonical: batch `handleLikeBatch034`에도 final 162 marker를 확인하는 `assertLegacyLikeWriterOpen163(env, 'batch-like-intake')`를 기존 165 drain guard 직후·queue write 이전에 추가. final marker가 활성화된 후 drain marker가 없거나 사라져도 구형 batch queue를 새로 받지 않도록 한다. 새 검사는 **실제 좋아요 batch 요청**에만 추가되고 페이지 재진입 hot path에는 추가하지 않음.
- `release-patches.json` 080→081 순서, `canonical/source-sha256.txt` exact SHA256 `bcace09703b7e8cb93df9535897adcab402f3b4c3d7ef670506d073753792bc9`, `scripts/verify-168-direct-atomic.py`, `scripts/verify-135-like-fenced-protocol.mjs`, 공용 audit workflow 관련 실행형 test/replay와 중복 적용 검증 보강.

**검증 근거:** TS PASS / Build PASS / 168 direct 신규·중복·해제·다른 계정 격리 SQLite PASS / 두 번째 statement 실패 시 relation rollback PASS / 169 batch final marker guard PASS / 080·081 160→078→079→080→081 replay & idempotency PASS / TEST·PRODUCTION Worker **dry-run** PASS / shared D1 read-only PASS / `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`. isolated **remote** D1 `meta.rows_written`는 이번 감사에서 SKIPPED; 비용 W1~W2 실측 완료라고 주장 금지.

**남은 release blocker:** 이미 실제 배포된 구형 direct Worker는 `likes`와 `track_stats`를 두 D1 호출로 처리할 수 있다. 167 queue DB fence는 격리 fixture에만 있으며 공유 D1에 실제 적용되지 않았다. final 162 marker와 old Worker·이전 in-flight를 함께 안전하게 종료했다는 **전 환경 확인 및 원자적 proof 미완료**. 157 table/index 및 157/158 owner 실제 wiring 미완료. 051 변경 신호, R2/RTDB final settlement, 실제 W1~W2/중복 W0 총비용, PC↔mobile 개인 하트·공개숫자 수렴, Work 독립검증 미완료. `164_CUTOVER_PREFLIGHT_READY=NO` (intake OPEN / 157 table,index 없음). 이전 135/139/153/159 product gates 또한 계속 FAIL이며 원인을 해소하기 전에는 PREVIEW 제품 배포 및 TEST/PRODUCTION 승격 차단.

**부가 CI 이력:** 이전 069 자동 Apply workflow [35595449862](https://github.com/andrawing1212/soridraw-music/actions/runs/35595449862), [35596085726](https://github.com/andrawing1212/soridraw-music/actions/runs/35596085726)은 이번 patch-manifest 변경에 반응했으나 오래된 069 service marker가 없어 `[069] service marker: expected one target, got 0`으로 첫 수정 단계에서 실패했다. 이 두 run은 **배포 단계까지 진행하지 않았다**. 재실행 우회하거나 현재 release-system에 혼합하지 말 것; 별도 정리 필요.

**실데이터/배포:** shared D1 사용자 row write 0, R2 marker arm/delete/write 0, 157·167 migration apply 0, 사용자 데이터 backfill/delete 0. Hosting/Worker/Functions/Firebase 배포 없음, main/PRODUCTION 비변경. 기존 UI·Music Note 60초 묶음 동작 코드 변경 없음. PC/모바일 실사용은 배포 전 미검증.


## 0CT. 167 shared D1 원자적 queue fence — 격리 SQLite PASS, direct 2단계 쓰기 위험 잔존 (2026-09-21 KST)

**고정 코드 감사:** `preview` commit `37d7d654d6110194d73f358bdb2e659e40197a0c`, GitHub Actions [35590066055](https://github.com/andrawing1212/soridraw-music/actions/runs/35590066055) **SUCCESS**. TS/Build, 정적검사, 좋아요 관련 regression, TEST/PRODUCTION Worker dry-run, live shared D1 read-only audit PASS. 격리 원격 D1 billing 단계는 이번 자동감사에서 SKIPPED. 이 단계는 **실 사용자 DB migration / Worker 배포가 아닌 격리 실험**이다.

추가 파일:
- `scripts/fixtures/167-like-atomic-fence-isolated.sql`: shared D1 최종 migration이 아닌 **로컬 전용 실험용 SQL**. 단일 control row (open / draining / frozen)와 035/066/069/075 queue INSERT·075 UPDATE의 BEFORE trigger, frozen 시 legacy likes 변경 방지 trigger를 독립 SQLite fixture에만 구성. 배포 대상 `migrations/`에 넣지 않았다.
- `scripts/verify-167-like-atomic-fence.py`: 임시 독립 SQLite DB에서 old Worker INSERT/UPDATE, guard를 통과한 뒤 멈춘 요청, 종료 직전 수락된 queue, direct 두 문장 쓰기를 시뮬레이션.
- `.github/workflows/soridraw-release-system-audit.yml`: 기존 공용 감사에 해당 fixture test 연결. 신규 임시 Workflow 없음.

실행 결과:
- `167_OLD_WORKER_QUEUE_INSERT_UPDATE_FENCED=PASS`
- `167_INFLIGHT_OLD_QUEUE_AFTER_CLOSURE_BLOCKED=PASS`
- `167_ACCEPTED_BEFORE_CLOSE_IS_DRAINABLE=PASS`
- `167_DIRECT_TWO_STATEMENT_INFLIGHT_STILL_UNFENCED=FAIL_EXPECTED`
- `167_PRODUCT_CUTOVER_REMAINS_BLOCKED=PASS`

**핵심:** queue에 대한 DB-level trigger는 오래된 Worker의 R2 marker 무시와 166 in-flight 경쟁을 막을 수 있음을 격리 SQLite에서 확인했다. 그러나 구형 direct `handleLikeD1Core → adjustExploreLikeCounterDelta`는 현재 `likes` INSERT/DELETE 후 `track_stats` UPDATE를 *별개의 요청*으로 처리한다. direct 첫 문장이 drain/freeze 사이 완료되고 숫자 변경이 freeze 뒤 도착하는 경우, queue=0 검사에는 드러나지 않는다. 따라서 167 fixture의 좋아요 relation freeze만으로 전체 안전 전환을 선언할 수 없다. DB trigger 실험 PASS를 D1 원격 / 제품 W1~W2 PASS로 확장해서는 안 된다.

**다음:** direct 경로를 한 원자적 D1 batch/단일 owner 경계로 바꾸고 구형 배포본과 이미 진행 중인 요청까지 막을 수 있는지 격리·원격 비용 테스트. 그 다음에만 전체 관계·카운터 owner 통합 검토. 157/158 writer wiring, cross-environment readiness, 051 invalidation, personal R2/RTDB final settlement, PC↔mobile convergence, 전체 비용·배포 감사가 남아 있어 제품 릴리스 gate는 FAIL 유지.

**변경 없음:** UI/앱 버전/제품 Worker/canonical hash `316fc57b2a0ed6ff30a26b5a26e0309b9667db95bb164289de422f6132899f08` 유지. shared D1/R2 사용자 데이터 read-only audit 외 mutation 없음; 157/167 schema migration 미적용; drain/cutover marker 미작성; Hosting/Worker/Firebase/Functions 배포 없음; TEST/PRODUCTION 비변경. PC/모바일 실사용 미검증.


## 0CS. 166 in-flight 좋아요 경쟁 재현 + 허위 전환 증거 차단 — 코드 감사 PASS / 실제 전환 BLOCKED (2026-09-21 KST)

**기준:** `preview` code-audit commit `5ed766f92c31cda2407efd25c0324b167b2f84bc`, GitHub Actions [35588084201](https://github.com/andrawing1212/soridraw-music/actions/runs/35588084201) **SUCCESS**. source-only + live shared D1 read-only 감사이며 배포가 아니다.

165의 R2 drain guard를 통과한 좋아요 요청이 서버에서 일시 정지할 수 있고, 그 사이 release controller가 drain marker를 켠 뒤 queue=0을 관찰하더라도 기존 요청이 **나중에 다시 실행되어 구형 D1 queue에 쓸 수 있는** 시간차 오류를 실행형 test로 재현했다. 따라서 `legacyIntakeClosed=true` 플래그와 한 번의 queue=0 관측만으로 final 162 marker를 arm하는 절차는 안전하지 않다.

**이번에 실제 바꾼 것:**
- `cloudflare/explore-worker/scripts/like-cutover-preflight-164.mjs`: `--legacy-intake-closed` CLI 옵션을 명시적으로 거부한다. 호출자가 `inspectLikeCutoverPreflight164(...,{ legacyIntakeClosed:true })`를 직접 호출해도 166 BLOCKED 오류를 내고 DB query 전에 중단. 현재 CLI는 오직 intake open을 전제로 한 읽기 전용 관측만 가능하며 완성 cutover proof를 출력할 수 없다.
- `scripts/verify-shared-d1-release-system.mjs`: guard 통과 → request 정지 → drain 시작 → queue=0 관측 → 기존 request가 재개되어 queue write하는 경쟁 재현. 순수 논리 모형만 임의로 `true`가 될 수 있음을 확인하고 실제 CLI와 exported inspection API가 허위 proof를 막는지 검증.
- 제품 Worker/canonical/source hash 및 앱 UI는 **변경하지 않음**. 불완전한 in-flight 해결책을 제품 경로에 추가하지 않았다.

**검증:** `166_INFLIGHT_AFTER_EMPTY_QUEUE_RACE_REPRODUCED=PASS`, `166_SELF_ATTESTED_CUTOVER_PROOF_FAILS_CLOSED=PASS`, `166_SHARED_ATOMIC_FENCE_NOT_IMPLEMENTED_PRODUCT_RELEASE_BLOCKED=PASS`; TypeScript PASS, Build PASS, 이전 164/165 source·replay PASS, TEST/PRODUCTION Worker dry-run PASS, shared D1 read-only PASS, `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`. 실제 D1 query 관측: 035/066/069/075=0/0/0/0, legacy intake open, 157 table/index 없음, `164_CUTOVER_PREFLIGHT_READY=NO`.

**남은 근본 해결:** 세 환경에서 구형 좋아요 쓰기 직전과 컷오버 전환이 **동일 공유 D1의 원자적 fence**로 직렬화되어야 한다. 단순 R2 재조회, 고정 대기 시간, queue=0 반복 조회, 선언형 boolean만으로는 이 증명을 만들 수 없다. 현재 165는 신규 요청 접수 제한 및 기존 queue drain용 하위호환 구조로 보존하지만 final arm의 충분한 안전 조건이 아니다. 157/158 owner 실제 wiring, old Worker 병존, 051 변경 신호, 개인 R2/RTDB final settlement, W1~W2 총비용, PC↔모바일 실측과 Work 독립감사는 남아 있다.

**운영 상태:** Worker/Hosting/Functions/Firebase 배포 없음. 실제 shared D1/R2 사용자 원본 mutation 없음. 157 migration 및 drain/cutover marker 미적용. 전체/파괴적 데이터 이전 없음. 사용자 실사용 검증 전이며 제품 승격 금지.


## 0CR. 165 좋아요 drain barrier + 164 실제 대기열 판정 정정 — exact 감사 PASS (2026-09-21 KST)

**기준:** `preview` code-audit commit `9eafb865114456139cdd8b51882537b6ca11eec7`, GitHub Actions [35586848857](https://github.com/andrawing1212/soridraw-music/actions/runs/35586848857) **SUCCESS**. 실제 앱/Worker 배포가 아니라 GitHub source-only / 공유 D1 read-only 감사다.

**중요 정정: 앞선 0CQ의 “075 pending=1 이상” 결론은 잘못된 대기열 판정이었다.** 075는 처리한 행도 테이블에 보존하고 별도 `explore_like_user_queue_state_075` cursor로 이미 처리한 범위를 구분한다. 0CQ에서는 `SELECT 1 FROM explore_like_user_queue_075 LIMIT 1`만 사용하여 존재하는 처리완료 행을 미처리로 오판했다. 이번 수정은 075의 `processed_at/processed_uid`를 함께 읽고 **cursor보다 뒤에 있는 작업만** `LIMIT 1`로 탐지한다. cursor가 없거나 형식이 잘못되면 proof 생성 전에 fail-closed 한다. 사용자 데이터는 바뀌지 않았다.

수정 후 실제 read-only 관측:
- 구형 신규 intake: **OPEN** (`legacyIntakeClosed=false`)
- 035/066/069/075: 실제 미처리 각각 **0/0/0/0**
- 157 새 table/index: **아직 없음**
- 결론: `164_CUTOVER_PREFLIGHT_READY=NO` — 현재 미충족은 intake 미동결 + 157 schema/owner 미준비. 075 대기 작업 때문이 아니다.

**165 source-only 구현:**
- `runtime/like-fenced-139.mjs`: 별도의 shared R2 drain marker `internal/explore/like-cutover-drain-v165/active.json` reader와 신규 intake guard 추가. missing=open, fully armed=draining, partial/corrupt=fail-closed. 제품 Worker는 marker를 만들거나 삭제하지 않는다.
- `patches/079-like-intake-drain-barrier.mjs`, `release-patches.json`, `canonical/preview-worker.js`: batch 및 direct 좋아요 진입에서 신규 접수 전 drain 상태 검사. draining일 때 D1 mutation 전에 재시도 가능한 503, Retry-After 30 반환. 기존 035/066/069/075 scheduled processor는 guard를 통과하지 않으므로 대기열을 계속 처리할 수 있다. reader와 일반 페이지는 변경하지 않았다.
- `scripts/verify-135-like-fenced-protocol.mjs`: absent/armed/corrupt 상태, 진입 경로, scheduled 유지, 사용자 기기의 durable outbox 재시도 보존 검증.
- `scripts/verify-shared-d1-release-system.mjs`, `scripts/like-cutover-preflight-164.mjs`, 감사 Workflow: 075 cursor 판정 검증 및 078→079 replay + idempotency 검증.
- pinned canonical SHA256: `316fc57b2a0ed6ff30a26b5a26e0309b9667db95bb164289de422f6132899f08`.

**감사 결과:** TypeScript PASS / Build PASS / 관련 source·isolated tests PASS / `164_075_PROCESSED_ROWS_NOT_PENDING_CURSOR_REQUIRED=PASS` / `165_DRAIN_MARKER_ABSENT_OPEN_ARMED_PAUSED_CORRUPT_CLOSED=PASS` / `165_BATCH_DIRECT_INTAKE_GUARDED_CRON_DRAIN_REMAINS_OPEN=PASS` / `079_DEPLOYED_164_TO_165_REPLAY=PASS` / TEST·PRODUCTION Worker dry-run PASS / shared D1 read-only PASS / `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`.

**절대 혼동 금지:** 이 감사 SUCCESS는 165 코드 검사의 성공이다. 제품 릴리스 gate는 계속 FAIL. 157/158 owner 실제 연결, 051 후속 변경 신호, R2/RTDB final settlement, 전 환경 최신 Worker 준비, 최종 W1~W2/중복 W0 총비용, PC↔모바일 실제 수렴 검증 전에는 배포 불가.

**남은 안전 문제:** 165의 R2 drain marker를 본 후에도 이전 요청이 guard를 이미 지나 D1 queue write 직전일 수 있다. queue 0을 단 한 번 확인했다고 구형 쓰기가 완전히 멎은 증거는 아니다. 현재 164 CLI의 `--legacy-intake-closed`도 호출자 주장이지 전 환경의 실제 intake 종료 증빙이 아니다. 전 환경 취합 + in-flight quiescence/atomic barrier 증빙 + 최종 재조회 없이 marker arm 금지. marker arm 이후 구형 baseline으로 단순 롤백 금지.

**실사용 영향:** 이번 작업에서 Worker/Firebase/Functions/Hosting 배포 0, 실제 shared D1/R2 데이터 write 0, 157 migration 0, 사용자 데이터 backfill/delete/transform 0, UI 변경 0, PC/모바일 실사용 검증 전. 격리 원격 D1 write billing은 이번 read-only 감사에서 재실행하지 않았으며 기존 157 W2/W1/W0 측정은 격리 기준만 유지한다.


## 0CQ. 164 실제 shared D1 read-only preflight — 현재 전환 차단 조건 실측 PASS (2026-09-21 KST)

164 proof를 실제 shared D1 상태에서 **쓰기 없이** 생성 가능한지 검증하는 preflight를 구현했다. exact audit commit `caf4950095e8288868c738b2e22c6ca98967b30f`, GitHub Actions run `35584354578` SUCCESS.

실제 read-only 관측:
- legacy intake: **OPEN** (`legacyIntakeClosed=false`)
- 035 queue pending: 0
- 066 queue pending: 0
- 069 queue pending: 0
- 075 queue pending: **당시 원시 테이블 행 존재=1 (실제 pending 증거 아님)** — 0CR에서 cursor 기준 재측정 결과 실제 미처리는 0으로 정정
- `explore_like_overrides_157` table: 아직 없음
- `idx_explore_like_overrides_157_user_recent` index: 아직 없음
- 따라서 `164_CUTOVER_PREFLIGHT_READY=NO`

당시에는 075 잔여 변경 가능성을 경고했으나, 0CR에서 처리완료 행을 잘못 센 것으로 정정했다. 전환은 여전히 intake 미동결 및 157 schema 미준비 때문에 차단된다.

추가 source:
- `cloudflare/explore-worker/scripts/like-cutover-preflight-164.mjs`
- `scripts/verify-shared-d1-release-system.mjs`
- `.github/workflows/soridraw-release-system-audit.yml`

검증:
- TypeScript PASS / Build PASS
- `164_READONLY_CUTOVER_PREFLIGHT_MODEL=PASS`
- live shared D1 preflight read-only PASS
- TEST/PRODUCTION Worker dry-run PASS
- canonical Worker SHA256 `ea884a1bf2c6acd1bf951d6cfac1fef774242c8736bab3330df05c0194dcb2f1` exact
- `078_DEPLOYED_160_TO_164_REPLAY=PASS`
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`

직전 run `35584199084`의 FAIL은 새 preflight의 D1 query helper **함수 정의까지 호출 수로 잘못 센 정적 검사 오류**였고, 실제 D1/Worker 변경 전 단계에서 실패했다. verifier를 수정해 재실행한 `35584354578`은 전체 SUCCESS.

**실서비스/데이터 변경:** 없음. 157 migration 미적용, cutover marker 미작성, Worker/Firebase/Functions 배포 없음, shared D1 사용자 row 쓰기 없음, R2 사용자 object 변경 없음.

**다음 단계:** 실제 전환 실행이 아니라 **legacy intake를 잠시 닫아도 사용자 마지막 클릭이 사라지지 않는 drain barrier + 157/158 shared owner writer를 dormant/source-only로 준비**한다. marker arm 전에는 언제든 legacy로 복귀 가능해야 하고, marker arm 후 단순 legacy writer 재개는 금지한다.


## 0CP. 162/163/164 좋아요 전환 안전장치 — 공유 전환 신호·구형 writer 동결·대기열/스키마 증명 PASS (2026-09-21 KST)

161의 partial reader가 157 writer cutover 이후에도 구형 `likes`만 보게 되는 문제를 막기 위해, **전환 자체를 한 번에 안전하게 제어하는 162→163→164 경계**를 코드와 실행형 감사에 추가했다. 기준 코드 감사 commit은 `2157efdcb7ee5c3c2e4b437489c8e856cd99918d`.

**162 — 하나의 공유 전환 신호**
- PREVIEW/TEST/PRODUCTION이 공유하는 R2 키 `internal/explore/like-cutover-v162/active.json` 하나로 reader 의미를 전환한다.
- 신호가 없으면 기존 `likes`가 canonical이고, fully armed 신호일 때만 `likes`를 frozen baseline으로 보고 `explore_like_overrides_157`을 우선하는 effective membership을 사용한다.
- 불완전/손상 신호는 fail-closed. 제품 Worker 자체에는 이 신호를 생성/삭제하는 경로가 없다.
- targeted reader는 최대 200곡만 보고 전체 사용자 likes scan/COUNT/OFFSET을 하지 않는다.

**163 — 구형 relation/count writer 물리 차단**
- 신호가 실제 overlay157 상태가 된 뒤에는 구형 direct like writer, scheduled aggregate writer, `refreshLikeCount`가 모두 중단된다.
- scheduled 경로는 먼저 read-only queue preflight를 하고 **실제 대기 작업이 있을 때만** shared marker를 읽는다. 변경 없는 idle cron은 추가 R2 read 0 순서를 유지한다.
- 구형 writer 호출 수 inventory를 고정해 새 우회 경로가 생기면 verifier가 실패하도록 했다.

**164 — 전환 전에 반드시 증명해야 하는 조건 추가**
162의 boolean들만으로는 “대기 중인 구형 좋아요가 남아 있는데 writer를 닫는” 사고를 막기에 부족하므로 `preCutoverProof164`를 필수로 만들었다. 아래가 모두 맞아야만 overlay157 전환을 인정한다.
- `legacyIntakeClosed === true`
- `legacyQueueRows['035'/'066'/'069'/'075'] === 0` — 네 구형 대기열이 모두 완전히 비어 있음
- `overlay157SchemaOwnerReady === true`
- `overlay157SchemaOwner === 'shared-d1'`
- `overlay157RelationTable === 'explore_like_overrides_157'`
- `ownerProtocol === 'uid143-track147-158'`

하나라도 누락/비정상/queue 1건 이상이면 전환 신호를 거부한다. 즉 **구형 접수 종료 → 기존 대기열 완전 배출 → 157 스키마/owner 준비 확인 → 그 다음에만 공유 전환 신호** 순서를 코드가 강제한다.

**078 replay 호환:** `cloudflare/explore-worker/patches/078-shared-like-reader-cutover.mjs` 하나가 과거 160 Worker를 161/162/163/164 상태까지 올릴 수 있고, 이미 163까지 적용된 Worker도 164 proof gate만 추가할 수 있게 보강했다. 두 번째 실행은 변화가 없어야 한다.

**변경 source**
- `cloudflare/explore-worker/runtime/like-fenced-139.mjs`
- `cloudflare/explore-worker/patches/078-shared-like-reader-cutover.mjs`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `scripts/verify-135-like-fenced-protocol.mjs`
- `.github/workflows/soridraw-release-system-audit.yml`
- canonical Worker SHA256: `ea884a1bf2c6acd1bf951d6cfac1fef774242c8736bab3330df05c0194dcb2f1`

최종 GitHub Actions [35583684236](https://github.com/andrawing1212/soridraw-music/actions/runs/35583684236), exact code-audit commit `2157efdcb7ee5c3c2e4b437489c8e856cd99918d` **SUCCESS**:
- TypeScript PASS / Build PASS
- canonical expected/actual SHA256 일치
- `164_CUTOVER_REQUIRES_INTAKE_CLOSED_QUEUE_DRAIN_SCHEMA_OWNER=PASS`
- `162_PARTIAL_OR_CORRUPT_SHARED_CUTOVER_FAILS_CLOSED=PASS`
- `163_SHARED_MARKER_ARMED_BLOCKS_LEGACY_WRITERS=PASS`
- `163_DIRECT_SCHEDULED_REFRESH_WRITER_ENTRY_GUARDS=PASS`
- `163_IDLE_CRON_MARKER_R2_READ_ZERO_BY_ORDER=PASS`
- `078_DEPLOYED_160_TO_164_REPLAY=PASS`
- TEST/PRODUCTION Worker dry-run PASS
- TEST/PRODUCTION shared D1 preflight read-only PASS
- 158 track_stats keyed plan / 161 targeted membership indexed plan PASS
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`

이번 164는 **전환 허용 조건을 강화하는 코드 변경**이라 새 mutation billing은 실행하지 않았다. 157의 격리 원격 D1 실측 W2/W1/W0(run 35568696258)을 그대로 비용 기준으로 유지한다.

**실서비스 상태:** 배포 없음. 157 migration 미적용. shared D1/R2 사용자 데이터, Firebase, Functions, 실제 PREVIEW/TEST/PRODUCTION Worker 변경 없음. backfill/delete/transform 없음. UI 변경 없음.

**다음 안전 경계:** 아직 실제 전환을 실행하면 안 된다. 다음은 release controller 쪽에서 164 proof를 **실제 상태에서 읽기 전용으로 생성·검증하는 절차**를 준비해야 한다. 세 환경의 legacy intake를 안전하게 닫고, 035/066/069/075가 0인지 확인하고, shared D1에 157 schema/owner가 준비됐음을 검증한 뒤에만 단일 shared marker를 arm할 수 있다. marker가 arm된 뒤에는 legacy baseline을 다시 쓰는 단순 롤백을 금지한다. 실제 migration/marker write/deploy는 별도 승인 전 실행 금지.


## 0CO. 161 reader-first exact/partial 분리 — 2천 한도 오판 제거·visible bounded 복구 PASS (2026-09-21 KST)

159/160 완료 후 다음 비용·무손실 단계로 **기존 개인 좋아요 R2 snapshot이 완전본인지 불완전본인지 명시적으로 구분하는 161 reader-first 경로**를 구현했다.

**발견한 실제 오류 가능성:** 기존 앱은 `likedTrackIds.length >= 2000`이면 불완전 snapshot으로 보고, 2000 미만이면 사실상 완전본처럼 받아들였다. 그러나 과거 2,000개에서 잘린 사용자가 이후 여러 곡을 해제하면 배열 길이가 2,000 미만으로 내려가도 이미 누락된 좋아요가 남아 있을 수 있다. 반대로 156의 정확한 신규 snapshot은 2,000개를 넘을 수 있으므로 단순 길이 기준은 정상 exact snapshot까지 거부한다.

**161 기준:** shared v114 R2 object는 아래 조건을 모두 만족할 때만 exact로 인정한다.
- `canonicalComplete156 === true`
- `canonicalSource156` 존재
- `exactLikeCount156`이 안전한 음이 아닌 정수
- `exactLikeCount156 === unique likedTrackIds 수`
- 원본 배열 길이와 unique 수가 같아 중복으로 개수가 위장되지 않음

이 증명이 없으면 **1,999개든 정확히 2,000개든 모두 partial**로 취급한다. partial 목록은 기존 하트를 보존하기 위한 cache hint로만 사용하고, 목록에 곡이 없다는 사실을 unlike 증거로 사용하지 않는다.

**reader-first 동작:**
- exact shared R2: 기존 빠른 경로 유지, 개인 membership 확인에 원본 D1 read 0.
- partial shared R2: 기존 기기 local heart/outbox/unsettled state를 지우지 않는다.
- 화면에서 실제 확인이 필요한 누락 곡만 `/v1/me/likes`의 최대 50개 targeted lookup으로 확인.
- 좋아요 곡 collection도 요청된 최대 200개 범위만 canonical membership을 확인하며 전체 사용자 likes scan 금지.
- social snapshot 응답 shape의 기존 `likedTrackIds`는 유지하고 `likesComplete / exactLikeCount / likesSnapshotSource`만 additive로 추가.
- 앱은 partial snapshot을 받아도 그 배열로 전체 local cache를 reconcile하지 않고 partial marker만 저장하여 **같은 R2 revision에서 반복 전체 snapshot GET을 하지 않음**.
- R2 revision이 실제 바뀌면 기존 invalidation이 full/partial marker 둘 다 지우고 다시 확인.

관련 source:
- `cloudflare/explore-worker/patches/061-shared-social-r2-parity.mjs` — exact 상태 판정 + targeted membership reader
- `cloudflare/explore-worker/patches/062-shared-track-card-r2.mjs` — partial liked collection bounded recovery
- `cloudflare/explore-worker/canonical/preview-worker.js` — 실제 repository canonical Worker에 동일 161 reader-first 반영
- `src/services/exploreLikeService.ts` — 2천 길이 heuristic 제거, partial local-preserve 계약 반영
- 기존 verifier 114/127/135를 재사용해 161 검증 추가. 새 일회성 verifier 파일은 만들지 않음.

canonical Worker SHA256: `fabe274fde6d2ed1099f14f54852c06e12e4e37a5799708bbf8e1176fb85cc45`.

최종 GitHub Actions [35577973005](https://github.com/andrawing1212/soridraw-music/actions/runs/35577973005), exact `8bcc02e69f1f548f094dc2f90b44c8cfacea3767` **SUCCESS**:
- TypeScript PASS / Build PASS / static release audit PASS
- `161_LEGACY_1999_2000_PARTIAL_AND_EXACT_2053=PASS`
- `161_PARTIAL_VISIBLE_MEMBERSHIP_BOUNDED_D1=PASS`
- `EXACT_156_SHARED_LIKE_LEGACY_OVERWRITE_GUARD=PASS`
- 159 reader-first inventory가 targeted `handleMyLikeStates` 포함 **5개**로 고정
- 160 direct RATE_DB 제거/replay PASS 유지
- TEST/PRODUCTION Worker dry-run PASS
- TEST/PRODUCTION shared D1 preflight read-only PASS
- shared D1에 사용자 행을 읽지 않는 `EXPLAIN QUERY PLAN`으로 161 targeted lookup이 `tracks PK + likes PK` indexed SEARCH임을 확인:
  `SEARCH t USING INDEX sqlite_autoindex_tracks_1 (id=?) | SEARCH l USING COVERING INDEX sqlite_autoindex_likes_1 (track_id=? AND user_uid=?)`
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`
- 161은 read 경로 변경이므로 isolated mutation billing은 의도적으로 재측정하지 않음. 157 W2/W1/W0 실측은 run 35568696258 기준 유지.

**중요한 전환 경계:** 현재 partial targeted fallback은 아직 운영 중인 legacy `likes`가 canonical이기 때문에 legacy `likes`를 조회한다. 향후 157 writer cutover 순간에는 legacy `likes`가 frozen baseline이 되므로, **157 활성화 전에 이 targeted fallback도 반드시 baseline+override effective membership으로 전환/게이트해야 한다.** 이 순서를 어기면 post-cutover 변경을 partial 기기가 못 본다.

**실서비스 상태:** 이번 161도 GitHub `preview` 소스·검증만 변경. PREVIEW 실주소 Worker에는 미배포. 157 migration 미적용, shared D1/R2 사용자 데이터/Firebase/Functions/TEST/PRODUCTION 실제 서비스 비변경. 사용자 원본 backfill/delete/transform 없음. UI 변경 없음. 제품 release는 계속 BLOCKED: 157/158 실제 owner wiring, 세 환경 writer 동시 cutover, 051 대체 신호, public generation, RTDB final settlement, 전체 DO/R2/RTDB 비용, Work 독립감사 및 PC↔모바일 실사용이 남아 있다.


## 0CN. 159/160 구형 좋아요 경로 고정 + direct RATE_DB write 제거 — exact CI PASS (2026-09-21 KST)

사용자의 "니가 해볼래?" 요청으로 Codex/Work 없이 ChatGPT가 좁은 범위의 비용 절감 마무리를 직접 진행. 기준은 157/158 무백필 구조 이후 `preview`.

**159 경로 고정:** repository-owned canonical Worker에서 현재 legacy 좋아요 쓰기/읽기 경로를 실행형 verifier로 고정했다. legacy `likes` INSERT/DELETE writer는 `adjustExploreLikeCounterDelta`, `processExploreLikeAggregateWave035`, `processExploreLikeUserQueueWave075` **3개**, legacy count 재계산 writer `refreshLikeCount` **1개**, reader-first 전환 대상 `readSharedLikes061`, `rebuildExploreLikeR2Bundle`, `handleMySocialSnapshot042`, `handleMyLikedTracks052` **4개**. direct PUT/DELETE like route와 069/055 batch route는 아직 157/158 single-owner cutover 전이므로 제품 release gate는 계속 FAIL로 유지.

**160 숨은 비용 제거:** 구형 direct `PUT/DELETE /v1/tracks/:id/like` 호환 경로의 `handleLikeD1Core`가 좋아요 본체 처리 전에 `enforceUserRateLimit`를 통해 `RATE_DB.api_rate_limits`에 별도 D1 write를 하던 것을 제거했다. batch path와 동일한 Cloudflare `LIKE_RATE_LIMITER` binding을 사용하도록 `054-explore-like-edge-rate-limit.mjs`와 canonical PREVIEW Worker를 함께 수정. 현재 앱의 `setExploreTrackLike`는 클릭 시 즉시 서버 호출하지 않고 local outbox에 쌓은 뒤 `/v1/me/likes/batch`로 묶음 전송하므로, 160은 **구형/호환 direct route에 남아 있던 추가 D1 write를 제거한 것**이며 현재 batch relation/count 전체 비용 완료를 뜻하지 않는다.

기존 054 patch는 이미 054가 적용된 Worker에서는 조기 종료하여 direct route 160을 추가하지 못하는 replay 오류가 있었다. 이를 `has054/has160` 별도 판정으로 수정하고, 055 W1 intake가 활성인 현재 Worker에서 `enqueueExploreLikeBatch035`만 남아도 정상 replay하도록 보강. 감사 Workflow에서 **054 적용됨 + 160 미적용** fixture를 실제로 만들어 같은 patch를 실행하고 direct route만 160으로 승격되는지 검증.

canonical Worker SHA256을 새 소스에 맞춰 `c517ac6193cfe1bd12234a8158e9abcc89fd081fe0ab35b5a319b464fb553081`로 재고정.

최종 GitHub Actions [35576793526](https://github.com/andrawing1212/soridraw-music/actions/runs/35576793526), exact `7bcd28f909eda4544ee9919351d8dfd6ec7853bf` **SUCCESS**:
- TypeScript PASS / Build PASS
- canonical Worker expected/actual SHA256 일치 PASS
- `EXACT_156_SHARED_LIKE_LEGACY_OVERWRITE_GUARD=PASS`
- 156/157/158 기존 격리 회귀 PASS
- `159_LEGACY_RELATION_WRITERS_FIXED_INVENTORY=3`
- `159_LEGACY_LIKE_COUNT_REBUILD_WRITER_FIXED_INVENTORY=1`
- `159_READER_FIRST_CUTOVER_PATHS_FIXED_INVENTORY=4`
- `160_DIRECT_LIKE_RATE_DB_WRITE_RETIRED=PASS`
- `160_054_TO_160_PATCH_REPLAY_GUARD=PASS`
- 실제 replay fixture `160_054_EXISTING_WORKER_REPLAY=PASS`
- TEST/PRODUCTION Worker dry-run PASS
- TEST/PRODUCTION 공유 D1 preflight read-only PASS
- 158 track_stats PK plan PASS
- `RELEASE_SYSTEM_AUDIT_NO_DEPLOY=PASS`

첫 두 audit 실패(run 35576474162/35576633560)는 제품 코드 실패가 아니라 새 verifier가 설명 comment의 `RATE_DB` 문자열까지 금지한 검사 오류와, replay 검사가 055 batch intake를 인식하지 못한 검사 오류를 각각 드러냈고 수정 후 최종 run이 PASS. 최종 run은 160이 D1 relation schema를 바꾸지 않으므로 원격 synthetic D1 billing 재측정은 의도적으로 skip; 157의 실제 W2/W1/W0 실측 run 35568696258을 그대로 기준으로 유지.

**실서비스 상태:** 이번 턴은 GitHub `preview` 소스/검증만 변경. PREVIEW Worker 실주소에는 **미배포**, Firebase/Functions/shared D1/R2 사용자 데이터/TEST/PRODUCTION 실제 서비스 변경 없음. 157 migration도 계속 **미적용**. 제품 전체 release는 여전히 BLOCKED: 세 환경 legacy writer를 동시에 freeze/cutover하지 않았고, 157/158 owner, 051 대체 신호, public feed/profile generation, RTDB final settlement, PC↔모바일 실사용 및 전체 DO/R2/RTDB 비용 검증이 남아 있음.


## 0CM. 157/158 무백필 sparse override 실제 W2/W1/W0 + 곡 count lazy baseline PASS (2026-09-21 KST)

사용자의 비용 절감 계속 요청. 153의 신형 relation 테이블은 격리 D1 W2/W1을 달성했지만 기존 모든 좋아요를 새 테이블로 옮기는 baseline/backfill 위험이 남아 있었음. 이를 제거하는 **157 sparse override**와 **158 lazy track baseline**을 실제 코드·격리 원격 D1로 검증.

**157 핵심:** 기존 `likes`를 전환경 writer 컷오버 순간의 불변 baseline으로 보존하고, 신규 미적용 테이블 `explore_like_overrides_157`에는 baseline과 현재 의도가 다른 관계만 저장. 상태가 baseline으로 돌아오면 override/tombstone을 DELETE. 사용자 전체 relation 복사/백필 없음. effective membership은 override 우선, 없으면 legacy baseline. cold recovery는 legacy user-recent index + override PK/recent index를 합치는 bounded keyset union이며 정상 재진입/앱 업데이트에서는 호출하지 않는 계약. `cloudflare/explore-worker/migrations/20260921_02_explore_like_overrides_v157_additive.sql`은 **작성만 했고 공유 D1 미적용**.

**실 Cloudflare 임시 D1:** GitHub Actions [35568696258](https://github.com/andrawing1212/soridraw-music/actions/runs/35568696258), exact `a47f54b112d6fd732cde394fe360891f86d3de68` **SUCCESS**. synthetic 전용 임시 DB 생성→측정→삭제 PASS. 신규 unliked→like **W2**, 같은 like **W0**, baseline으로 unlike **W1**, 중복 **W0**. 기존 liked→unlike tombstone **W2**, 중복 **W0**, 다시 baseline like **W1**, 중복 **W0**. legacy baseline 불변 PASS. cold union query plan은 legacy/override 양쪽 indexed SEARCH. 즉 **모든 실제 관계 변경 W1~W2, 중복 W0이며 기존 사용자 전체 backfill 0**.

**156 연결:** exact shared R2 rebuild는 157 pager를 통해 2,054 effective likes를 무손실 구성하는 모의 통합 PASS. 기존 061 shared writer가 `canonicalComplete156` exact object를 2,000개로 다시 자르지 못하도록 repository patch와 **canonical PREVIEW Worker 실제 소스** 둘 다 guard 반영. canonical Worker SHA256 `47488036b5958d82410d7e7e2207a4898cf1c4d94bd625b1034e3a6196d4e9ba` 고정/감사 PASS. exact rebuild 자체는 모든 legacy writer 컷오버 확인 없이는 실행을 거부.

**158 핵심:** 전곡 `track_stats` count 백필도 하지 않음. 실제 좋아요 변경이 처음 생긴 곡만 frozen `track_stats.like_count`를 read-only PK 조회 1회하여 shared track owner baseline으로 저장하고 이후 147 durable delta 사용. cutover token을 영속 total에 보존하며 restart 후 baseline 재읽기 없음. live shared D1에 사용자 행 조회 없이 EXPLAIN만 실행: `SEARCH track_stats USING INDEX sqlite_autoindex_track_stats_1 (track_id=?)` PASS. `158_LAZY_TRACK_STATS_BASELINE_ONE_READ_PER_CHANGED_TRACK=PASS`, `158_NO_GLOBAL_TRACK_COUNT_BACKFILL=PASS`.

최종 exact run에서 TypeScript, Build, release static, canonical Worker hash/114 exact guard, 127/128/135~158 격리 회귀, TEST/PRODUCTION Worker dry-run, 공유 D1 read-only preflight/schema/158 planner, 원격 isolated D1 153/155/157 측정, 임시 D1 cleanup, branch refs 비변경 모두 PASS.

**중요한 현재 상태:** 제품 릴리스는 여전히 BLOCKED. 157/158은 실제 Worker/Auth/공통 UID·곡 owner/RTDB/feed-popular-profile 게시에 미연결. PREVIEW/TEST/PRODUCTION 구형 writer가 공유 legacy `likes`/track_stats를 계속 바꿀 수 있으므로 한 환경만 157 writer를 켜면 baseline이 깨진다. 실제 schema apply/writer freeze/old trigger 변경/사용자 데이터 변환/배포는 실행하지 않음. PREVIEW 현장 앱126/Worker071 유지(이번 작업 실주소 미배포), TEST/PRODUCTION/user data/Firebase/Functions/R2 실서비스 비변경. 다음은 **세 환경 reader 먼저 호환 → 모든 legacy writer의 단일 owner 컷오버 계획 및 실행형 source 통합 → 051 대체 신호/public projection/RTDB → 총비용/Work/PC↔모바일** 순서.


## 0CL. 155 실제 격리 D1 W2/W1 유지 + 2,053개 좋아요 무손실 페이지 조회 후보 (2026-09-21 KST)

사용자의 비용 절감 작업 계속 요청. 시작 `preview` `171f96507db9bda15e2da4be2fc078a142365aef`. **추가 발견:** 153 최근 좋아요 보조 인덱스가 `(user_uid,created_at DESC)`만 정렬하여 같은 밀리초에 생성한 여러 곡을 시간 단독 커서로 페이지 조회할 때 누락할 수 있음. **미적용 migration**의 단일 보조 인덱스를 `(user_uid,created_at DESC,track_id DESC)`로 교정(`3b5be3271a62084636ba6a49cb199c5f96339d55`). 후보 runtime `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 `createLikeRecentPager155` 추가(`9c060bc54b405c11558f175b70a01c9e4a577a9d`): UID 전용, 1~128행 제한, `created_at + track_id` 복합 keyset cursor, 누락/중복/이상 순서 fail-closed, read-only. 정상 캐시 재방문/업데이트 호출 금지; cold 복구용이며 실제 Worker에 **미연결**. `scripts/verify-135-like-fenced-protocol.mjs`에서 2,053개 synthetic 곡·동일 ms 다중 곡 전부 회복, 기존 2천개 한도에서 잘리지 않는 페이지 조회 **PASS**(`bce8624dac1248da9139c8cdad848e60a627af9e`). 이는 **R2 기존 2천개 snapshot writer 확장 완료가 아님**.

기존 `scripts/measure-153-isolated-d1.mjs`에 신규 키 구성 variant와 실제 같은-ms SQL 페이지, 조회계획·비용 검사를 추가(`09bcb7bc9625148cbd31cf69f9dd20ee633693e3`). [실제 GitHub Actions run 35566094717](https://github.com/andrawing1212/soridraw-music/actions/runs/35566094717), exact `1d6571eead45326f1dc6d746567640e15c85648c` **SUCCESS**. 원격 Cloudflare 고유 임시 D1에서 새 인덱스 **좋아요 W2, 중복 W0, 해제 W1, 중복 해제 W0** 실측. 합성 동일 ms 곡 페이지 **첫 2건/다음 1건 정확**, `meta.rows_read` 첫 페이지 2, 다음 페이지 3; 인덱스 순서 조회계획 PASS. `153_EPHEMERAL_D1_DELETED=PASS`로 임시 DB 삭제. TypeScript/Build/127·128·135~155 회귀, release static, 공유 D1 read-only 감사, TEST/PRODUCTION Worker dry-run, branch refs 확인 모두 PASS.

**정확한 현재 상태:** 비용 합격은 신형 스키마와 합성 데이터의 격리 원격 D1에 한정. 새로운 테이블·인덱스 실제 공유 DB 미적용. 155 cold pager는 실제 서비스 R2 캐시·구형 reader/writer와 연결되지 않았고, 2천개 R2 snapshot 한도·정확한 기존 count baseline·공유 3환경 writer 전환·feed/popular/profile 부분 게시·RTDB·전체 DO/R2 비용·Work 및 PC/모바일 검증 미완료. PREVIEW 앱126/Worker071 현장 기준(실주소 재검증 전), 이번 코드 미배포; 사용자 데이터/TEST/PRODUCTION 변경 없음. 실제 제품 릴리스 **BLOCKED**, 기존 154 제한 및 `W3+` 차단 유지.


## 0CK. 154 D1 청구 영수증 누락·위조 W0 차단 — 소스/CI PASS, 제품 릴리스 차단 (2026-09-21 KST)

사용자 이전 채팅 153 후속 실행. 기준 `preview` `49d5b596d2713c86d9b41d30fd65526b76b96246`; 153의 `explore_likes_153` user-first WITHOUT ROWID W2/W1/W0 후보는 유지. 실제 코드 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`의 146/153 D1 adapter가 누락된 `meta.rows_written`을 `0`으로 합산해 **청구 영수증 없이 좋아요 확정/곡별 집계로 진행할 수 있는 오류** 수정. batch의 3개 응답과 모든 rows_written을 안전한 음이 아닌 정수로 검사하고, 153 관계 1행 변경에 청구 W0가 나오면 fail-closed. 청구 W3+ 기존 차단 유지. `scripts/verify-135-like-fenced-protocol.mjs`에 missing/NaN/negative/허위 W0 회귀를 추가해 각 경우 곡별 집계 0회 확정 확인. `preview` 커밋: 코드 `92c7063a734aa14dd5b3b414b9a79bd500799bfa`, 테스트 `053bac42a415b4861da6ac07e6e5401f08c3b902`, 실 CI 실행용 `4bf4fcf1dce9ad31e6d734a57f8d794f67a08a10`.

실제 [GitHub Actions run 35565617344](https://github.com/andrawing1212/soridraw-music/actions/runs/35565617344), exact `4bf4fcf1dce9ad31e6d734a57f8d794f67a08a10` **SUCCESS**: TypeScript, Build, release static, 127/128/135~154 격리 회귀, 132/133/134 비용 모형, TEST/PRODUCTION Worker dry-run, 공유 D1 read-only preflight/schema, branch refs 비변경. 이번 CI는 **격리 원격 D1 측정 재실행 없음**(153 실측 35563388506/35563565716 참조). 실제 PREVIEW 앱126/Worker071 비변경; 새 v153 migration 미적용, 공유 사용자 데이터·Firebase/Cloudflare/Functions/R2 비변경. main/production 승격 없음. PC/모바일 실사용 미검증.

**남은 제품 FAIL:** 기존 좋아요를 v153으로 무손실 넘길 승인된 baseline/복구, 세 환경 구형 writer/readers와 051 변경신호 동시 컷오버, 각 곡 147 집계 seed와 feed/popular/profile 세대 부분 게시, 사용자 개인 2천+ 스냅샷 확장, 공통 UID/곡 owner·RTDB, 실제 전체 DO/R2/RTDB 비용/PC·모바일/Work 감사. 현행 릴리스 차단 유지. 이 코드는 누락된 비용 증거를 PASS로 오인하지 못하게 하는 국소 수정이며 실제 좋아요 기능 완성 또는 배포 완료가 아님.


## 0CJ. 153 실 Cloudflare 격리 D1 비용 W1/W2 측정, user-first 추가형 스키마·연결 코드 (2026-09-21 KST)

사용자 "니가 말한대로 작업해줘. 말만 하지말고" 요청. `preview` 기준 `9dfa6a578afb1a86f14c97d4082793e89bc14da5`에서 단순 계산/SQLite가 아니라 **실제 Cloudflare 원격 임시 D1**을 두 번 생성해 순수 테스트 UID/곡만 넣고 `meta.rows_written` 실측. 실제 run [35563388506](https://github.com/andrawing1212/soridraw-music/actions/runs/35563388506), [35563565716](https://github.com/andrawing1212/soridraw-music/actions/runs/35563565716) 전체 SUCCESS, 시험 DB는 각각 삭제 확인 `153_EPHEMERAL_D1_DELETED=PASS`. **공유 사용자 DB/R2/Firebase/Worker·실사용 계정은 읽기 전용 기존 schema 감사 이외 접근하지 않았음.**

실측 새 좋아요/해제/동일 상태 중복:
- 기존 likes에 대응하는 rowid PK+최근/기간 인덱스2+051 global revision trigger: **W5/W2/W0**. 146 관계 단독 SQL이어도 현 스키마상 W2 불가.
- 기존 인덱스2만 유지하고 051 제거: **W4/W1/W0**. 최근 인덱스 하나만 유지: **W3/W1/W0**.
- rowid PK만 남긴 track-first: **W2/W1/W0**, 다만 UID 목록 조회가 전체 인덱스 scan.
- user-first `PRIMARY KEY(user_uid,track_id)` rowid PK: **W2/W1/W0**, UID 조회 인덱스 이용.
- **user-first `WITHOUT ROWID` PK만**: **W1/W1/W0**, UID 조회 PK 검색.
- **user-first WITHOUT ROWID + 최근 인덱스 하나 `(user_uid,created_at DESC)`**: **W2/W1/W0**, UID 최근 목록 인덱스 검색. 선택한 품질/비용 후보.
- track-first WITHOUT ROWID PK: W1/W1이나 UID 목록은 scan. PK만+051은 W3/W2.

신규 `scripts/measure-153-isolated-d1.mjs`는 고유 이름 test DB 생성, 각 SQL별 meta.rows_written/changes 및 EXPLAIN QUERY PLAN 조회, finally 및 GitHub always() 별도 cleanup; 기존 `.github/workflows/soridraw-release-system-audit.yml`에서 명시된 measurement-trigger/수동 감사에만 실행(일반 push에는 임시 D1 생성하지 않음). 신규 `cloudflare/explore-worker/migrations/20260921_01_explore_likes_v153_additive.sql`에 `explore_likes_153` user-first WITHOUT ROWID+recent index 추가형 SQL을 작성하되 **적용하지 않음**. 기존 146 adapter에 `relationTable:'explore_likes_153'` 분기·명시적 `cutoverVerified` gate, UID-first SQL, 응답 rows_written W3+ 확정 차단 추가(실 Worker 연결 없음). 135 mock에 gate·W2/W1·중복 W0·W3 차단 테스트 추가해 실제 GitHub 소스 V8 격리 PASS. 상세 표 및 실행/승격 경계: `DOCS/LIKE_WRITE_REDESIGN_133.md` §153.

**정확한 현재 상태:** 새 테이블 및 직접 저장 방식의 비용 합격은 **격리 원격 D1 한정**. 실제 공유 DB에 v153은 없고 기존 개인 좋아요가 이동하지 않았음. old TEST/PRODUCTION Worker의 기존 likes+051 unconditional writer/readers, 147곡별 count의 검증 시드와 복구, R2 feed/popular/profile 동기화, 사용자 개인 2천곡 한도, UID owner 서비스 바인딩, RTDB 및 전체 PC/모바일 검증, Work 감사 미완료. 승인되지 않은 공유 DB migration/백필/기존 필드 제거/실사용 데이터 변환, TEST/PRODUCTION 승격 없음. PREVIEW 실제 앱126/Worker071 기준(새 실주소 확인 전), 이번 작업 미배포. 153 신형 table만 활성화하면 구형 앱에서 기존 하트가 소실된 것처럼 보이므로 단독 배포 금지. 공유 데이터 전환과 PRODUCTION 코드 변경은 별도 영향/복구/비용 범위와 명확한 승인 필요. 마무리 **실제 GitHub Actions run [35564018308](https://github.com/andrawing1212/soridraw-music/actions/runs/35564018308), exact `3314d6f9557e0fcd53baf741170220500a371783` SUCCESS**: TypeScript, Build, 127/128/135~153 회귀 및 132/133/134/148 비용 모형, TEST/PRODUCTION Worker dry-run, 공유 D1 read-only preflight/schema, 브랜치 refs 비변경 모두 PASS. `153_EXPLICIT_CUTOVER_USER_FIRST_D1_ADAPTER=PASS`, `153_W2_RELATION_AND_W3_FAIL_CLOSED_MOCK=PASS`; 하지만 `153_SHARED_BASELINE_AND_LEGACY_WORKERS_RELEASE_GATE=FAIL`은 의도적으로 남김. 이 최종 소스 감사에서는 원격 D1 새 DB 측정은 재실행하지 않았으며, 바로 앞의 실측 35563388506/35563565716 결과를 참조. 이번 release-state 문서 보완은 CI 이후 문서 전용 commit임.

## 0CI. GitHub Actions 실제 검증 PASS + 운영 공유 D1 W2 불가능 원인 확인 (2026-09-21 KST)

사용자가 반복된 후보/모의 보고 대신 실제 결과와 완성 요구. `preview` 시작 HEAD `cbc8a4cf004066b145076beda21a7b14efe2cb0d`. GitHub Actions Release System Audit 실제 run `35561196390` 실패 원인 `verify-127`의 TypeScript 단위 테스트 JS 추출에서 144 export가 섞이며 `exports is not defined` 발생; `scripts/verify-127-atomic-personal-like.mjs`의 clock/helper 경계와 전역 `export const` 제거를 최소 수정. 재실행 run `35561894019` commit `9001e19c1658475b181ae7571324f537ed76133d` **SUCCESS**: 실제 TypeScript, Build, release static, 127/128/135~152 격리 검증, 132/133/134/148 비용 모형, TEST/PRODUCTION Worker dry-run, 공유 D1 read-only preflight, 실 schema read-only audit 전부 PASS. audit의 모델 로그 `LEGACY_WRITER_BYPASS_RELEASE_GATE=FAIL`, `PRODUCT_RELEASE_READINESS=FAIL`, `REAL_D1_ROWS_WRITTEN=NOT_MEASURED`는 의도한 **제품 릴리스 차단**이며 audit의 SUCCESS와 다름.

추가 READ-ONLY audit run `35562080167`, commit `c2dfd3bc69c3eabd0f165b3e49c6418ff7da7c13` **SUCCESS**, `likes` 실제 공유 D1 인덱스/트리거 DDL 직접 확인:
- `sqlite_autoindex_likes_1` 자동 PK + `idx_likes_period_rank(created_at DESC,track_id,user_uid)` + `idx_likes_user_recent(user_uid,created_at DESC)` = 관계 테이블 인덱스 3개.
- `soridraw_shared_rev_likes_ai_051` / `_ad_051` / `_au_051`는 INSERT/DELETE/UPDATE 각각 `explore_shared_revision`의 `global` 행 revision+1.
- 기존 `track_stats`의 032 stats insert/update/delete 및 051 shared revision 트리거도 별도로 활성. Derived tracks 인기/최신/프로필 인덱스·changes seq 인덱스 활성. TEST와 PRODUCTION의 read-only 공유 DB preflight PASS tables6/triggers18.
- 따라서 146 relation-only의 격리 SQLite 논리 '1행'을 실제 운영 D1 W1~W2로 일반화하는 것은 **틀림**. 실제 관계 자체+051 공유 버전 추가 UPDATE 및 활성 인덱스 쓰기가 수반됨. 정확한 D1 `meta.rows_written` 청구 실측은 아직 없으므로 구체 청구 수치 추정 금지. 현행 공유 schema 아래 새 146도 비용 gate 미충족, 구형 TEST/PRODUCTION reader에 숫자를 전달하지 못해 기능도 미완료. **제품 배포 BLOCKED.**

이번 대화에서 수정 파일: `scripts/verify-127-atomic-personal-like.mjs`, `.github/workflows/soridraw-release-system-audit.yml`(READ-ONLY DDL 로그), `.deploy/release-system-audit.trigger`, DOCS. 앱/Worker 요청 처리 경로에 139~152 미연결이고 사용자 원본/DB 트리거/인덱스/Cloudflare/Firebase/TEST/PRODUCTION 실배포 변화 없음. 마지막 문서 기준 현장 앱126/Worker071이며 이번 run에서 실주소는 재검증하지 않음. **정식 데이터 schema 변경·기존 production Writer 컷오버는 승인 없이 실행 금지.** 새 설계·승격 전 실제 isolated D1 `meta.rows_written`, 구형 reader/Writer 호환·세 환경 수렴·2천 좋아요 캐시 확장·실기기·Work 감사 필요.

## 0CH. 150~152 곡별 숫자 결손 차단·공유 카드 CAS·전체 표시 확정 조건 (2026-09-21 KST)

사용자 "더 수정해줘"에 따라 `preview` 기준 `e901bc1d849b3ec68ae4d33c5bf2b95b1cdd3584`에서 실제 코드 수정:
- `cloudflare/explore-worker/runtime/like-fenced-139.mjs`의 147 영속 곡별 카운터에서 UID/곡 이전 확정 revision이 있으면 정확히 다음 revision만 허용하고, UID/곡 기록이 없는 경우 revision=1만 허용. 중간 수정 이력 유실, 비정상 첫 revision, 이전 상태 불일치 시 숫자 변경 없이 오류 및 감사 복구 요구(150). 기존 데이터나 DB 재생성 없음.
- 같은 runtime에 **`createLikeSharedTrackCardPublisher151(bucket)`** 추가. 실제 Worker071에 존재하는 공유 R2 카드 `internal/explore/shared-track-card-v115/<trackId>.json` / schemaVersion 1 / card.likeCount+stats.likeCount를 사용. R2 ETag 조건부 PUT, 최대 12회 CAS 충돌 재시도, card의 기존 제목/미디어/통계 기타 필드 보존, 상승하는 `lastLikeGeneration151`만 반영. 동일 세대 중복은 R2 W0, 더 오래된 세대는 superseded; 캐시 부재·파손·기초 숫자 불일치·신규 세대 누락(구형 writer가 토큰 제거했을 가능성)은 덮어쓰기 없이 fail-closed. 이 연결부는 **공개곡 카드 한 개만** 담당하고 Feed/인기/공개프로필을 완료했다고 표시하지 않는다.
- 147의 공개 게시 확정은 카드·Feed·프로필에서 각각 영속 버전 이상의 `surfaceGenerations`를 확인해야 함(152). 카드만 성공/프로필 누락이면 개인 R2/다른 기기 `settled` 금지. 실제 연결되지 않은 프로필/Feed 경로는 의도적으로 fail-closed.

`scripts/verify-135-like-fenced-protocol.mjs`의 기존 실행형 mock에 150 결손 순번, 151 ETag 충돌·재시도·이전 세대·동일 세대·기초 데이터 부재/충돌, 152 카드만 확인된 미완료 공개 갱신의 보류/재시도 검사 추가. 실제 GitHub runtime + verifier를 재조회해 V8 격리 전체 실행 **PASS**(135/139~143/146/147/149/150~152 포함). 기존 릴리스 차단 메시지 `LEGACY_WRITER_BYPASS_RELEASE_GATE=FAIL`, `REAL_D1...=NOT_MEASURED`, `PRODUCT_RELEASE_READINESS=FAIL` 유지. 이는 모의 스토리지·가상 R2 기반 실행 결과이며 실제 Worker/D1/RTDB/PC·모바일 합격 아님.

**남은 필수:** 실제 공유 세 환경 Writer 공존/인증 UID별·곡별 owner 배포, Feed·인기 재정렬·공개프로필용 152 세대 부여 및 부분 갱신, R2 개인 2천 곡 확장, 기존 track_stats/derived reader 컷오버, 기존곡 초기 count의 감사 기반 시드, 운영 D1 인덱스 포함 `meta.rows_written` W1~W2 및 DO/R2 총비용 측정, TS/Build/전체 CI/Work/실기기 검사. 151만 연결해 152를 우회하거나 구형 Worker를 방치한 채 PREVIEW 배포 금지. 실제 앱126/Worker071 및 TEST/PRODUCTION/공유 사용자 데이터·Cloudflare/Firebase/Functions/R2 실서비스 비변경; 이번 작업은 preview 코드·검증·문서만 변경.

## 0CG. 146/147/149 좋아요 D1 관계 단독 저장 + 영속 곡별 숫자 모델 실제 코드·격리 검증 (2026-09-21 KST)

사용자가 신속한 실제 수정을 요청. 기준 `preview` `9b77a68ea170bdd222dbba62dc985e148d0f3618`. 새 파일/Workflow 추가 없이 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 **`createLikeRelationOnly146` / `createLikeTrackAggregator147` 실제 후보 코드 추가**. 139의 기존 영속 pending에서 이전 membership·operation ID·revision·UID 전역 seq를 canonical adapter에 전달한다. 146은 D1 단일 batch 안에서 공개곡 유효성→해당 UID/곡 likes 관계 INSERT/DELETE **한 행만**→최종 membership 확인; track_stats·derived/journal을 쓰지 않음. D1이 먼저 확정된 뒤 해당 곡 전용 영속 집계 147에 **이전 상태 기준 delta**를 전달. 147은 곡별 정확한 초기 total이 이미 확인·설정되어 있지 않으면 fail-closed, 트랜잭션 안에서 count+UID별 마지막 operation을 함께 기록, 같은 ID 재시도 W0, 다른 사용자 동일 곡 직렬 합산, 실패 후 중복 가산 없이 공개 R2 세대(generation) 검증을 요구한다. 147 공개 캐시 게시와 141 개인 캐시 게시까지 성공하기 전 139은 `settled` 반환 금지. DO↔D1은 *서로 원자 트랜잭션이 아님*; 영속 pending + idempotent 재시도로 복구하는 후보이며 모두 실제 Cloudflare에 미연결.

기존 `scripts/verify-135-like-fenced-protocol.mjs`에 146/147 실제 코드 실행형 모의검사 및 149 **UID owner→relation-only D1→track aggregate→public R2→personal state 전체 결합검사** 추가. GitHub 최신 코드 재조회 후 V8 실행: 135/139~143/146/147/149 격리 시나리오 PASS(같은 ID 재시도/오래된 요청/동시 2계정·동일곡/집계 게시 장애/재시작/다른 상태 충돌/비공개 fail-closed). `scripts/verify-134-like-write-amplification.py`에 148 격리 DB 검증 추가: 기존 대표 032/033 트리거와 함께 직접 likes+stats는 논리 6, likes 관계 단독은 좋아요1·동일 재요청0·해제1, **구형 track_stats/derived는 갱신되지 않으므로 릴리스 FAIL**. 동일 원리를 별도 in-memory Python SQLite 실험에서 6/6 대 1/0/1로 재확인; 이는 실제 Cloudflare 청구 rows_written 아님. 기존 135 legacy writer release FAIL 및 146/149 실제 Worker 미연결·공유 초기값·live cost 미검증 표시 유지.

**중요 실제 차단:** 146은 현재 운영 공유 D1의 좋아요 트리거/인덱스 구성으로 실제 W1~W2를 측정하기 전 비용 통과가 아니다. 별도 영속 곡별 집계로 인해 DO transaction(계정별 카운터+곡별 마지막 UID 상태) 및 R2 읽기·쓰기도 추가되므로 10만명 총비용 합산 필요. 구형 TEST/PRODUCTION은 track_stats·explore_derived_tracks.likes를 읽고 쓰므로 현재 구조만 배포하면 표시 숫자가 어긋난다. **사용자 원본/트리거를 임의로 삭제하거나 예전 숫자를 무시하지 않는다.** 세 환경의 공유 reader/writer 컷오버·정확한 곡별 초기 총수 확인·R2 2천곡 확장·인증된 실제 service binding/RTDB·실 D1 비용·PC/모바일 및 독립 Work 검사까지 릴리스 FAIL. PREVIEW 앱126/Worker071 기존 배포 유지(실주소 재검증 전), 사용자 원본/TEST/PRODUCTION/Firebase/Cloudflare 실서비스 비변경. 이번 작업은 preview runtime/test/docs만 수정, 사용자 배포 승인 없는 배포 없음.

## 0CF. 좋아요 D1 쓰기 2행 초과 원인 검증 및 해법 조사 — 145 (2026-09-21 KST)

사용자가 "세계 전체를 다 뒤져서라도 정확한 원인/방법" 지시. 기준 preview 2a597445b83f7e7ce0e802b0ec1d97135ca2d5aa. GitHub Worker071 canonical 소스·069 큐·032/033 SQL 트리거와 Cloudflare D1/SQLite 공식 과금 문서를 대조하여 원인 분해. 핵심: 069 INSERT+DELETE 논리 2, canonical likes+track_stats 논리 2, track_stats→derived_tracks→global seq + Feed/프로필 journal 추가 논리 4. 134 격리 모형에서는 큐 제거 직접 경로 좋아요/해제 논리 6; 기존 069을 이 모형과 합성하면 논리 8. 이것은 실제 D1 청구 수치가 아니고 인덱스 변경·라이브 운영 SQL 차이는 미측정. Cloudflare 공식 D1 과금은 테이블뿐 아니라 인덱스 쓰기도 meta.rows_written에 포함한다. 기존 indexed derived popular/indexed journal 때문에 2원본 SQL로 W2 보장 불가능. 자세한 근거·외부 문헌·후보 비교 및 승인 전 실행 규칙은 DOCS/LIKE_WRITE_REDESIGN_133.md 145 참조.

변경 내용: scripts/verify-134-like-write-amplification.py에 테이블별 6개 논리 변경과 069 추가 2개 원인 기록. 기존 배포 없는 .github/workflows/soridraw-release-system-audit.yml의 기존 검증에 132/133/134 격리 비용 검사 및 실제 공유 D1 sqlite_schema table/trigger/index SELECT 전용 검사 추가(실사용 계정/곡 SELECT나 DML 없음). 새 read-only schema query는 활성 live SQL을 hash로 표시해 032/033 실제 설치 여부·인덱스 수량을 대조하도록 구성. 기존 앱/Worker/실사용 원본 변경/배포 없음. 이번 대화 중 별도 메모리 SQLite 재현에서는 032/033 대표 trigger·popular/changes 인덱스를 설정하여 첫 좋아요 6, 중복 0, 해제 6, 중복 해제 0의 **논리 행 변경** 확인. 이는 GitHub 134와 같은 방향의 격리 실험이며 신규 145 전체 CI 실행 완료를 뜻하지 않음. Read-only audit trigger commit 6778b35ddfdb477544359eef33bd38a5e7fc0e60 생성; GitHub connector의 push Actions 실행 목록/상태 조회 불가. CI run/TS/Build/실 Cloudflare meta.rows_written 아직 미확인. 보고 시 source 분석 확정과 운영 계량 미확정을 혼동하지 않는다.

구조 판단: 현행 069과 실시간 D1 count/derived/journal을 모두 유지하는 조건에서는 W1~W2 합격 불가. 비용 목표를 지키는 **격리 검증 후보**는 D1에 개인 likes 관계 1행만 변경하고 곡별 숫자/인기/Feed/프로필 신호는 별도 영속 집계와 작은 R2 변경분으로 전환. 이 경우 likes 활성 인덱스 청구가 D1 W1~W2인지 격리 D1 실측 후 확정; DO/R2 자체 비용·복구·동일 곡 여러 사용자 경쟁·구형 TEST/PRODUCTION reader/writer 하위호환·전체 UX 보존을 증명해야 한다. 별도 집계만 도입해도 총비용이 반드시 감소한다는 결론은 아님. 트리거 제거·원본 사용자 데이터 변환·새 인프라·환경 승격은 명시적 승인 전 실행 금지. 138 pending-only 앱127/Worker 후보 배포 금지 유지.

## 0CE. 앱127 좋아요 요청 고유 ID 144 — 재전송 시 동일 ID·신규 클릭 새 ID (2026-09-21 KST)

기존 `src/services/exploreLikeService.ts`에 `createExploreLikeOperationId144` 추가: secure-origin `crypto.randomUUID()`로 **신규 클릭마다 고유 operationId** 생성·사용자별 outbox에 영속 저장. 30초 flush 시 같은 ID 그대로 전달하고 응답이 모호해 재시도해도 바꾸지 않음. 과거 앱 outbox는 flush 이전 UID별 한 번만 UUID 채워 로컬에 저장(기존 데이터 삭제/전역 강제 재생성 없음). `normalizePendingMutation`이 operationId를 보존하고 0BW rebase는 latest 객체를 spread해 최신 클릭의 ID를 유지. 실제 배포 Worker071은 추가 JSON 필드를 무시하므로 기존 batch 경로 동작·D1 쓰기 구조 변경 없음. 새 139/143 서버가 사용하는 별도 `baseRevision`의 안전한 전달은 아직 미구현; 현재 단지 **고유 ID의 보존을 준비한 단계**임.

기존 `scripts/verify-127-atomic-personal-like.mjs`에 ID 생성·신규 클릭·legacy 복구·persist-before-request·같은 ID로 재전송 source+순수 helper 검증 추가. GitHub 실제 서비스 소스에서 위 연결 가드 전부 존재 PASS; 신규 127 전체 CI/TypeScript/Build 실행 결과는 아직 미확인. 0CD의 256곡 전역 seq 격리 PASS와 별도.

**기존 릴리스 FAIL:** D1 운영 trigger/index W1~W2 실제 충족 미검증(격리 모형 논리 6), 141 shared snapshot 2천 곡 제한, 세 환경 구형 Writer 우회, 실제 UID owner/auth/RTDB/Work/PC↔모바일 및 139-144 Worker 연결 전. 앱126/Worker071 현장 유지(이번 턴 실주소 재검증 전), 공유 사용자 데이터·TEST/PRODUCTION 비변경. 신규 변경은 preview 소스와 검사/문서만, 배포 없음.

## 0CD. 좋아요 128 변경 기록 한도 제거 후보 + 사용자별 영속 소유자 + 배포 전 실제 CI 연결 (2026-09-21 KST)

사용자의 "보고만 하지 말고 배포 전까지 계속 진행" 지시. 기준 `preview` `482087ad10ae9c288d4ac371f7dcc01019359bf0` 이후 **실제 소스 변경**:
- `cloudflare/explore-worker/runtime/like-fenced-139.mjs`: 기존 `lastLikeRevisions141` 무제한 증가·128곡 차단 대신 사용자별 `lastPublishedSeq141` 단일 단조 순번 및 마지막 게시 ID·곡·상태만 shared v114 R2에 추가(기존 likedTrackIds/074 필드 보존). 139 영속 pending에도 seq를 저장·복구. 새 `createLikeDurableOwner143({uid,storage,canonical,publish})`은 **한 UID당 하나의 DO 인스턴스**를 가정한 호출 직렬화·트랜잭션 seq 발급 및 UID 일치 검사를 포함. 서로 다른 곡 동시 클릭에도 seq 1,2,3... 순서 발급.
- 기존 `scripts/verify-135-like-fenced-protocol.mjs`에 256곡 새 좋아요 후 R2 기록 한도 초과 없이 목록 유지, 늦은 과거 seq 차단, 임의 seq 위조 충돌, 동시 3곡 직렬화·owner 재시작 후 seq 보존·다른 UID 거부 검사 추가. 실제 GitHub 139/140/141/143 + 135 소스 재조회 격리 실행 전체 PASS. 135 기존 `LEGACY_WRITER_BYPASS_RELEASE_GATE=FAIL`, 140 `REAL_D1_ROWS_WRITTEN=NOT_MEASURED`, product release FAIL 의도대로 유지.
- 기존 `.github/workflows/soridraw-release-system-audit.yml`에 **배포 없는** 127/135 검사 및 실제 071 Worker 복사본에 072→073→074 생성 후 128 검사를 포함. 기존 TypeScript/Build, Worker dry-run, 공유 D1 SELECT 전용 감사와 동일 워크플로. 128 한도에 대한 074 내부 기록은 여전히 존재하지만 `138` 후보에서 intake 호출이 차단돼 있고 신형 141은 143 단일 owner global seq를 사용한다. 전체 워크플로 실행 결과는 별도로 확인해야 하며 통과했다고 기록 금지.

**제품/배포 차단 조건 유지:** 143은 아직 실제 Cloudflare 공통 service binding/DO 인스턴스/인증된 HTTP routing에 연결되지 않았고 TEST/PRODUCTION 구형 Worker는 이를 우회할 수 있다. 앱127의 30초 outbox 역시 새 seq/baseRevision 프로토콜로 전환 전. 141 공유 개인 R2의 **기존 2천 likedTrackIds 한도는 미해결**(초과 시 덮어쓰기 없이 중단)이며 구형 061 writer는 2천 잘라 저장. D1 기존 derived trigger/index 비용이 격리 논리 6변경으로 W1~W2 미달; 실 Cloudflare `meta.rows_written` 미검증. 신형 139/140/141/143은 실제 Worker 요청 경로와 미연결, 후단 RTDB 인증 게시 미연결. TS/Build/전체 CI/Work/실기기 미검증. 기존 **실배포 PREVIEW 앱126/Worker071 유지**, main/production/공유 사용자 데이터/Cloudflare/Firebase/R2 실서비스 미변경. 138 pending-only 코드만 배포하면 기기 수렴이 멈추므로 배포 금지. 현재 변경은 preview 소스·테스트·감사 워크플로·문서만 대상.

## 0CC. 141 공유 개인 R2 최종 게시 연결부 + 142 전체 연결 모의 검사 (2026-09-21 KST)

사용자가 "최대한 하나씩이라도 집중해서 해결" 지시. 기준 preview `a16c0ffaee06567fa178446a6807b66a71987d63`에서 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 **`createLikeSharedR2Publisher141(bucket,notify)` 실제 코드 후보**를 추가. 139가 D1 확정 후에만 호출하는 게시 콜백으로, 기존 공유 키 `internal/explore/shared-social-v114/likes/<UID>.json` / `schemaVersion:1` / `likedTrackIds`를 유지하며 별도의 곡별 `lastLikeRevisions141`에 operation ID·revision·liked를 기록한다. ETag 조건부 R2 PUT 최대 12회, 최신 revision만 쓰고 오래된 revision이나 같은 revision의 불일치 payload 차단, 동일 ID/상태 중복 알림 재시도에는 R2 재쓰기 0. 성공한 조건부 PUT 뒤 `notify` 성공까지 확인해야 settled. 공유 R2가 없거나 손상됐거나 목록 중복/2천 초과, 신규 좋아요에서 2천 용량 초과, 신규 곡 revision 128 한도 도달 시 **기존 상태를 덮어쓰지 않고 오류**. 기존 074 order/그 외 필드는 보존함.

기존 `scripts/verify-135-like-fenced-protocol.mjs`에 141 단독 및 139+141 결합(142) **실제 GitHub 소스 V8 격리 실행형 검사**를 추가. PASS: 원본 리스트/074 필드 보호, CAS 충돌 재시도, 과거 요청이 최신 하트 무효화 금지, ID·revision 충돌, 알림 실패 뒤 R2 중복 쓰기 없이 복구, cold/2000/128 fail-closed, D1 실패 전 개인 R2 0, D1 성공 후 R2·알림, 오래된 요청 stale. 테스트 결과 135 원래 `LEGACY_WRITER_BYPASS_RELEASE_GATE=FAIL` 및 139/140 실 D1/DO 비용 미측정·제품 릴리스 FAIL은 **그대로 유지**. 이번 검사에서는 공유 실사용 R2/실 D1/RTDB 호출 없음.

**중요 미완료:** 새 141도 기존 개인 snapshot **2천 곡 / revision 128곡 한도**를 넘어 사용자 전체 좋아요를 표시할 방법을 제공하지 못함. 128 한도 도달 시 pending이 영구화될 수 있으므로 분할/복구 설계 필요. 기존 TEST/PRODUCTION Worker의 unconditional shared R2 writer는 `lastLikeRevisions141`을 지울 수 있어 신규 CAS를 우회함. `notify`는 실제 인증된 RTDB 통지에 아직 연결되지 않았고, UID별 공유 durable owner/HTTP/Auth/실 D1 140/구형 writer 컷오버도 미연결. 운영 D1 trigger/index 포함 W1~W2 미검증(격리 논리 변경 6). **앱127/Worker 후보 배포 금지**, 기존 앱126/Worker071 현장 유지(이번 턴의 실주소 재검사는 미실시), main/production·사용자 원본·Hosting/Worker/Functions/Rules/DB/R2 실서비스 비변경. TS/Build/전체 CI/Work/PC↔모바일 실검증 전.

## 0CB. 140 실제 D1 batch 좋아요/해제 어댑터 구현 및 격리 SQL 검사 — W1~W2 릴리스 차단 (2026-09-21 KST)

사용자가 수일간 반복된 미완료 상황을 지적하고 조속한 PREVIEW 완성·배포 요청. 최신 기준 `preview` `0fc1fb01b5f33b70c7421a0853a662d5205dbdce`. **실제 코드 수정:** 기존 `cloudflare/explore-worker/runtime/like-fenced-139.mjs`에 `createLikeD1Canonical140(db)` 추가. `readMembership`은 해당 UID/곡의 관계만 읽음. `applyAtomically`는 기존 tracks/public_profiles/track_stats의 공개·원본 조건 확인 → 조건부 likes INSERT OR IGNORE/DELETE → 직전 `changes()=1`일 때만 track_stats ±1 → 트랜잭션 안의 최종 관계 상태 재확인을 `db.batch([...])` 하나로 묶음. 요청 실패/곡 미공개/통계 누락 시 `canonicalCommitted` 반환 금지. R2는 이 함수에서 갱신하지 않음. 실제 Cloudflare 공식 D1 API의 `batch()`는 오류 시 묶음 롤백을 명시함. **아직 배포 및 실 D1 실행 없음.**

기존 `scripts/verify-135-like-fenced-protocol.mjs`에 **140 SQL 순서·조건·중복 no-op·비공개 fail-closed** D1 모의 테스트 추가. GitHub 실제 139/140 코드 및 135 전체 모의 테스트를 V8 실행: 135/139/140 로직 PASS, 135의 구형 writer 우회 FAIL과 release FAIL 표기 유지. 격리 Python sqlite3에서 SQL 구조를 적용한 결과: 트리거가 없는 모형 좋아요 2 / 동일 좋아요 0 / 해제 2 / 동일 해제 0, 비공개 계정 적용 0; 기존 derived fanout을 포함한 격리 모형에서는 좋아요·해제 **각 논리 행 6개**, 실제 Cloudflare `meta.rows_written` 청구 측정 아님(인덱스 청구 등 제외). 이 검사를 **실 D1 W1~W2 합격으로 처리 금지.**

**여전히 배포 중단:** 139/140은 실제 Worker/Auth/UID별 영속 단일 소유자/공유 D1에 연결되지 않은 코드 후보. 138 intake pending-only도 finalizer가 없어 앱127과 함께 배포하면 자동 기기 수렴이 멈춤. 구형 TEST/PRODUCTION writer 우회, 실제 W1~W2 (derived trigger/index 포함) 비용, 2천/128 한도·실기기·full TS/Build·독립 감사·실주소 확인 미완료. shared migration/실사용 데이터 수정 없이 새 구조를 TEST/PRODUCTION과 함께 전환할 방법이 검증되기 전 배포 불가. 새 PRODUCTION 승인 없이는 변경 금지. 이번 작업은 preview의 기존 runtime 139·verifier 135·문서만 변경, Hosting/Cloudflare/Firebase/Functions/Rules/D1/R2 실서비스 배포·실사용 데이터 변경 0. 마지막 확인 문서 기준 실제 앱126/Worker071; 현재 라이브 버전 별도 새 조회는 미실시.

## 0CA. 139 좋아요 영속 순서·D1 확정 후 게시 코어 후보 구현, 격리 회귀 PASS / 실제 Worker 미연결 (2026-09-21 KST)

기준 `preview` 138 단계에서 실제 코드 `cloudflare/explore-worker/runtime/like-fenced-139.mjs` 신규 추가. `LikeFencedProcessor139`는 인증된 UID/곡·stable operation ID·서버 발급 baseRevision 기반의 단일 영속 소유자를 전제로, **영속 pending 우선 기록 → 원자 D1 adapter 확정 증명 → 영속 revision/마지막 ID → 공유 개인 캐시 monotonic publish 확정** 순서로만 `settled` 반환. 같은 ID는 중복 적용하지 않고, 오래된 revision은 stale이며, D1 전·후 크래시나 게시 실패 시 pending을 유지해 같은 의도를 먼저 복구한 다음 새 주문을 받음. 이 코어에는 실 DB·Auth·HTTP·R2 호출이 없고 기존 Worker 경로와 아직 연결하지 않았으므로 기능 배포 완료를 뜻하지 않음.

기존 `scripts/verify-135-like-fenced-protocol.mjs`에 신규 코어를 실제 import하는 모의 영속 ledger·원자적 canonical adapter·monotonic publisher 실행형 회귀 추가(별도 일회성 verifier 누적 금지). 실제 GitHub `like-fenced-139.mjs` blob SHA `12e2a9523868fdc334217f9895602db07ad5fff2`와 로컬에서 직접 실행한 동일 코드 SHA 일치. Node 로컬 실행 139 중복/stale, 크래시 복구, D1 후 게시, 게시 실패 새 순서 차단, 곡 독립 PASS. GitHub에서 재조회한 실제 코어와 135 verifier를 V8 격리 실행하여 135/139 테스트 PASS 재확인. 135 원래 검사의 legacy writer bypass=FAIL, 실 D1/DO billing=NOT_MEASURED, product readiness=FAIL 표시는 의도한 릴리스 차단이며 기능 PASS로 바꾸지 않음.

**아직 필요:** 139 코어를 실제 **모든 환경이 공유하는 단일 UID별 영속 owner**에 안전하게 연결하고 기존 069/035/066/075 및 직접 단일곡 writer가 우회하지 않도록 호환 전환해야 함. 현재 각 환경의 별도 DO scheduler는 이 조건을 만족하지 않음. 실제 `canonical.applyAtomically`를 구현하려면 D1 likes 관계·count 원자 트랜잭션, 인덱스/derived trigger를 포함한 W1~W2 실측 및 재설계가 선행. `publish`도 D1 확정 후 공유 R2 conditional revision CAS 및 타 기기 알림이 필요. 구형 Worker 공존/데이터 하위호환/비용·복구 정책이 확인되지 않은 상태에서 139를 실제 handler로 연결하거나 사용자 원본을 변환하지 않음. 138 pending-only 단계는 최종 R2 갱신이 없으므로 **절대 배포하지 않음**. TypeScript/Build/전체 CI/독립 Work/실기기/실 D1 미검증, 앱126/Worker071 실제 배포·main/production·공유 사용자 데이터 비변경.

## 0BZ. 서버 접수 전 개인 R2 쓰기 차단: 074/138 후보 실제 구현·격리 생성 검사 PASS, 최종 수렴 미완료 (2026-09-21 KST)

사용자의 "니가 말한대로 진행" 지시로 `preview` 기준 `975f94cae4301b3bcc98004217d8ba77238c640e` 이후 **실제 Worker 후보 patch 코드를 수정**함. 기존 `cloudflare/explore-worker/patches/074-personal-like-r2-cas.mjs`에서 `handleLikeBatch034`의 `syncExploreLikeR2AfterBatch034` 조기 실행을 **실제 canonical D1 최종 적용 전에 호출하지 않도록 교체**, `personalLikeSnapshot: 'pending'`만 반환. `SORIDRAW_LIKE_PRECOMMIT_R2_BLOCK_138_20260921` 마커. 기존 074 R2 CAS helper 자체는 격리 검증 대상으로 보존하지만 batch intake에서는 호출하지 않음. 현재 Worker071 배포본은 그대로, R2/D1 사용자 데이터 원본 수정 없음.

`scripts/verify-128-like-concurrency.mjs`의 기존 074 실행형 mock을 유지하면서 **generated Worker의 batch 핸들러에 R2 선행 갱신 호출 0, pending 응답, D1 enqueue 유지** 검사를 추가·기존 조기 갱신을 전제로 한 assertion을 교체. 연결된 GitHub의 실제 `preview-worker.js` blob `9e0048ac0d2e3540707930786d531b9bca3bccb7`에서 073→수정된 074 patch를 격리 메모리 생성한 뒤 128 전체 mock을 실행하여 PASS: 138 R2 선행 갱신 차단·pending 응답, 074 CAS 단위 경쟁·다른 곡 독립·동일 토큰 중복·2000/128 예외 fail-closed. 고정 TEST blob `04586a5f203227d5cb02581d13f78a43b95053ce` 및 PRODUCTION blob `14b3e4f3211ee7dfe1fcf9fcf10c935b6ce000f6`에도 073→074 패치 **소스 적용 및 선행 write 금지 검사 PASS**(실제로 두 환경에 변경/배포한 것은 아님). 실제 032/033 SQL 소스 fanout·인기 인덱스가 그대로 존재함도 GitHub 원문 확인. Node 전체 repo CI·TypeScript·Build·실 D1 meta 비용·독립 Work·실기기 PC↔모바일는 미검증.

**미완료·릴리스 차단:** 074/138은 잘못된 빠른 R2 게시를 멈춘 대신, 아직 D1 처리 완료 후 *해당 UID/곡만* 확인해 R2를 갱신하는 finalizer가 없다. 이를 배포하면 다른 기기는 새 좋아요를 자동 반영하지 못하고 127 pending이 오래 남을 수 있으므로 **앱127/Worker 후보 배포 금지**. 069 batch ID 재시도 변경·처리 후 dedupe 소실, 구형 TEST/PRODUCTION shared writer 우회, D1 W1~W2 vs triggers/index 비용 충돌도 여전히 미해결. `personalLikeSnapshot='settled'` 허위 발행 금지. 이번 작업은 074 patch/128 verifier 및 DOCS만 변경. Firebase/Functions/Cloudflare 실제 Worker·Rules·DB schema·공유 사용자 데이터·main/production 비변경, 실제 PREVIEW 앱126/Worker071 유지.

## 0BY. 공유 환경 Writer + D1 트리거 공존 하드 차단 — 기존 구조를 단순 패치로 승격 금지 (2026-09-21 KST)

사용자 "수정해봐" 후 GitHub 기준 `preview` `3f865b2e2bd43276dbc736888fa97efe7aa7c02e`를 다시 점검. 먼저 보고해야 하는 비호환성 확인: PREVIEW/TEST/PRODUCTION은 사용자 원본 D1 및 공유 개인 R2를 함께 사용하지만, TEST/PRODUCTION의 구형 Worker는 신규 UID/곡 순서 토큰과 영속 중복 방지 규칙을 통과하지 않고 `syncExploreLikeR2AfterBatch034` 계열로 값을 갱신한다. 따라서 preview Worker만 순서 관리자나 `settled` 신호로 바꿔도 동일 계정의 과거 요청/구형 writer가 최신 값을 덮어쓸 수 있다. 세 환경을 동시에 무단 승격하거나 기존 원본을 바꾸는 우회는 금지.

또한 `20260910_01_explore_derived_state.sql`과 `20260910_03_explore_like_write_optimization.sql`의 `track_stats→explore_derived_tracks→derived seq/feed/profile journal` 트리거·인기 인덱스, 기존 069 큐 INSERT + likes/stats + 큐 DELETE는 사용자 행동당 D1 W1~W2 하드 게이트와 충돌한다. 133의 기본 SQLite 2행 실험은 **운영 트리거를 제외한 모형**이다. 단일 SQL `batch()`, 로컬 캐시 덮어쓰기 방지, 073/074 R2 CAS만으로 운영 전체 비용과 canonical 순서를 해결했다고 주장할 수 없다.

**실제 서버 변경 전 필수 작업:** (1) 모든 환경 구형 writer 공존을 차단하거나 선행 호환 단계로 안전히 전환할 하위호환 롤아웃 설계, (2) 현재 트리거·인덱스를 포함한 격리 D1 실제 `rows_written` 실측 및 W1~W2용 파생 비용 재설계, (3) 안정적 operation ID·영속 UID/곡 순서·원자적 likes/stats 변경·장애 복구·D1 final 뒤 R2 게시를 단일 후보로 검증. 공유 데이터 구조가 기존 코드를 못 읽게 만들거나 새 인프라와 환경별 Worker 동시 전환이 선행되어야 하면 사용자에게 먼저 구체적인 변경·비용·복구 방안을 보고한 뒤 승인에 따라 적용. 구형과 공존 불가능한 migration/서버 변경을 preview 한쪽만 적용하지 않는다.

이번 확인에서는 이미 반영한 클라이언트127 후보·현재 Worker071·공유 원본 데이터·Firebase·Cloudflare·main/production을 변경하지 않았다. 앱127/Worker072~077 미배포, 실제 D1 실측·전체 CI/Work 감사·PC↔모바일 최종 수렴 미검증. **릴리스 FAIL 유지.** 코드 검증 환경은 GitHub connector에서 최신 CI 결과를 가져오지 못해 통과라고 보고하지 않는다. 작업은 코드 수정 전 호환성 게이트에서 멈췄으며, 완료를 주장하지 않는다.

## 0BX. 잘못된 좋아요 접수 응답이 최신 로컬 하트를 지우는 경로 차단 (2026-09-21 KST)

기준 preview `0feccae05f04fec3f2cc6232d6dce19c3061d8fb`. 서버 069 중복/순서·비용의 근본 해결은 아직 미완료이므로 범위를 정확히 구분해 `src/services/exploreLikeService.ts`의 `flushPendingLikes`에 fail-closed 검증을 추가. `normalizeBatchResults`로 모든 곡 ID/boolean을 확인한 후, **이번 요청에서 실제 전송한 각 곡의 desiredLiked와 서버가 반환한 liked가 하나라도 다르면** `readLikeOutbox(uid)`·개인 cache·snapshotPending·displayLocks에 접수 성공 변경을 하기 전에 오류 발생. 기존 catch가 마지막 로컬 의도를 보관하므로 잘못된/오래된 batch 응답이 유저의 하트를 확정하거나 삭제하지 않음. 정상 071 Worker의 응답은 전송한 값을 그대로 반환하므로 기존 성공 경로·30초 묶음·UI 디자인·D1 mutation 미변경. 이 검사는 서버 **접수 응답 검증**일 뿐 최종 D1 완료 증명이 아니다.

기존 `scripts/verify-127-atomic-personal-like.mjs`에 sent-by-track 불일치와 보존 순서 회귀 추가. 실제 GitHub 수정 service 소스 내 검사 구문 위치 및 true/false 응답 모형 V8 격리 검증 PASS. 전체 127/128~136 실행, TypeScript, Build, 실 D1 billed rows, PC↔모바일 실사용은 **미검증**. 이전 read-only audit 요청 `f951e797...` 상태를 다시 조회했으나 GitHub connector statuses/runs 모두 빈 결과(검사 미확인). `src/services/exploreLikeService.ts` 및 127 verifier만 수정, 원본 사용자 데이터·Worker071·실제 앱126·main/production·Firebase/Cloudflare 배포 없음.

**릴리스 차단 계속:** 071 069 큐 ID 재생성/처리 후 dedupe 삭제/구형 shared R2 unconditional writer, 파생 trigger/index 실제 W3+ 비용, 최종 canonical 이후 R2·기기 자동 수렴은 해결되지 않음. ACK 불확실 상태의 outbox 재전송은 069이 새로운 batch ID를 만들 수 있어 여전히 위험. 구형 혼합 Writer와 0BS·0BW를 모두 해결하고 full CI+격리 D1 실측 전 앱127/Worker078 배포 금지.

## 0BW. 좋아요 첫 요청 중 재클릭의 최종 의도 유실 수정 (2026-09-21 KST)

사용자 "진행해" 지시. 기준 `preview` `c0fc2ba5cc88d36a3f59f266281d38c87702bd48` 이후 실제 `src/services/exploreLikeService.ts`의 로컬 30초 묶음 경로 확인.

**실제 발견한 버그:** 기존 baseLiked=false에서 첫 좋아요(true)가 이미 서버에 전송 중인데 사용자가 해제(false)를 다시 누르면 새 outbox는 `baseLiked=false,desiredLiked=false`. 첫 요청 ACK가 돌아오면 `hasNewerPending` 때문에 이전 true를 건너뛰고, 다음 flush에서는 해당 해제를 `desiredLiked===baseLiked`로 판정해 **서버 전송 없이 삭제**할 수 있었다. 첫 true가 나중에 서버에 반영되면 사용자의 최종 해제가 사라지고 PC·모바일 상태가 틀어질 수 있음.

**국소 수정:** `rebaseExploreLikeAfterInFlight127(latest,prior)`가 앞서 보낸 batch의 desiredLiked 및 optimisticLikeCount를 최신 outbox의 새 기준으로 반영. `flushPendingLikes` 성공 ACK에서 더 최근 outbox가 발견되면 `latest[trackId]`를 재기준화하고 다음 30초 묶음으로 전송; 네트워크 실패/ACK 불확실 시에도 동일 재기준화를 수행해 최신 해제 요청을 구식 baseline 기준의 no-op으로 버리지 않음. 최신 `updatedAt`과 `desiredLiked`는 보존하며 다른 사용자의 public count를 이전 사용자 전환량만큼만 조정. 화면 레이아웃/기존 30초 window/미확정 저장 보호/Worker 변경 없음.

`scripts/verify-127-atomic-personal-like.mjs` 기존 회귀 파일에 성공·실패 모두 재기준화 가드, 좋아요→해제, 좋아요→해제→재좋아요, 타인 공개 좋아요 보존 순수 helper 검증 추가. GitHub의 실제 수정된 service 소스에서 helper를 추출하여 V8 격리 실행: 최종 해제 보존·재좋아요 no-op·타인 count 보호 및 성공/실패 두 경로 연결 PASS; verifier 본문 JS 문법 검사 PASS. **전체 127 회귀/TypeScript/Build/GitHub Actions/실서비스 D1 및 실기기 PC·모바일는 미검증.** 배포 금지.

한계: 069 HTTP retry ID 재생성·처리 후 큐 삭제, 파생 trigger/index W3+ 비용, 구형 Worker R2 충돌과 최종 canonical→R2 자동 수렴 미해결. 모호한 ACK 뒤 서버 순서가 바뀌는 최악의 사례는 신형 서버의 영속 idempotency 없이는 완전 보장 불가. 기존 0BV 차단 유지. `public/app-version.json=126`, 실제 PREVIEW 앱126/Worker071, main/production, 공유 사용자 원본 비변경. 이번 작업은 preview 후보 클라이언트 1개·기존 127 검사 1개·상태 문서만 수정, 배포 없음.

## 0BV. 069 중복 요청 ID가 재전송 시 변하는 구조 확인 (2026-09-21 KST)

Worker071 canonical SHA `9e0048ac0d2e3540707930786d531b9bca3bccb7` 원문에서 `exploreLikeW1Batch040` 확인: `batchAt = Math.max(fallbackAt, ...mutationAt)`, `fallbackAt = now`(매번 새 서버 접수 시각). 동일 UID·곡·원하는 하트·고정 클라이언트 mutationAt이라도 수초 뒤 재전송하면 `l069_<batchAt>_<digest>`가 달라지는 구체 반례 확인. 처리 후 `explore_like_batches_069` DELETE되어 이미 처리한 ID의 영구 재접수 차단도 없음. `scripts/verify-132-like-d1-write-budget.py`에 소스 가드와 136 재시도 모델 추가; **모델/실제 소스 조건 확인**이며 전체 Python CI 또는 라이브 Cloudflare 테스트 결과는 미확인. 원본 Worker/DB 변경 없음.

이 문제는 0BU/0BS의 별도 D1 W1~W2·trigger 증폭·R2 이전 갱신과 독립된 **최종 상태 정확성 FAIL**이다. 애매한 네트워크 실패 후 PC·모바일에서 나중에 재전송한 옛 주문이 최종 하트와 공개 숫자를 반전시킬 수 있으므로 안정적인 idempotency ID + 삭제 이후 유지되는 순서 기록·최종 확정 복구 전에는 PREVIEW 배포 금지. 이번 변경은 검사·문서만이며 사용자 원본 및 TEST/PRODUCTION 미변경. 리드온리 감사 요청 `f951e797...`의 실행 결과는 여전히 미확인; 해당 요청 이전 코드가 아닌 최신 candidate로 검증되었는지 추가 확인 필요.

## 0BU. 좋아요 배포 전 검증 요청 및 실제 서버 재검토 — 릴리스 차단 유지 (2026-09-21 KST)

사용자가 "찔끔찔끔 하지 말고 배포 전단계까지" 지시. 기존 `preview` 앱127 클라이언트 후보 수정 0BT를 기준으로 **배포 없는 기존 GitHub 감사** `.github/workflows/soridraw-release-system-audit.yml`을 실행 요청하기 위해 `.deploy/release-system-audit.trigger`만 갱신. 요청 commit `f951e797b8b0210042cd7bc39168d449c2b06e7d`. 이 워크플로는 TypeScript/Build/Worker test·production dry-run과 SELECT만 하는 D1 preflight를 포함하며 앱/Worker/D1 변경·배포 경로가 없다. 다만 연결된 GitHub의 `get_commit_combined_status`는 빈 statuses, `fetch_commit_workflow_runs`도 PR 필터로 빈 결과라 **실제 workflow 시작·실행 결과를 조회하지 못함**. Run ID/TypeScript/Build/D1 preflight를 PASS로 주장 금지. 해당 워크플로에는 127 좋아요 실행형 회귀가 포함되지 않으므로 성공하더라도 별도 확인 필수.

확인한 실제 Worker071 canonical source SHA `9e0048ac0d2e3540707930786d531b9bca3bccb7`: `enqueueExploreLikeBatch035`가 069 큐에 INSERT OR IGNORE, `processExploreLikeAggregateWave035`가 `track_stats`/ `likes`를 변경하고 처리한 `explore_like_batches_069`를 DELETE. 같은 요청이 **처리·삭제 이후 재전송**되면 원래 batch ID를 더 이상 저장하지 않으므로 요청 ID만으로 영구 중복을 식별할 수 없음. 처리 CTE는 현재 eligible 큐 안에서만 최신 `uid+track`을 선택하며 완료된 주문 전체의 순서 이력을 유지하지 않음. 클라이언트 127 `settled` 신호는 여전히 발행 불가. 이전 0BS의 trigger/index 비용 및 구형 Worker shared R2 무조건 덮어쓰기 미해결.

**배포 직전 조건 불충족:** ① 라이브 D1 행 쓰기 W1~W2 및 변경 없음 R0 검증 없음, ② 오래된 batch 재접수·PC↔모바일 순서·D1 최종 확정→R2→타기기 자동 수렴 검증 없음, ③ 127 실행형 회귀·최신 TypeScript/Build·독립 Work 실측 결과 확인 불가. 이번 작업은 `preview` audit trigger와 문서만 추가. 실제 사용자 데이터·Worker canonical·Firebase·TEST/PRODUCTION·배포 변경 없음. 위 조건 충족 전 배포 승인 불가이며, 사용자의 명시적 새 배포 승인 없이는 배포하지 않는다.

## 0BT. 화면 즉시 반영·미확정 보호·오래된 캐시 방지: 127 클라이언트 국소 수정 (2026-09-21 KST)

사용자의 직접 지시 "화면을 먼저 반영하되, 서버 확정과 캐시 갱신을 구분하고 오래된 상태의 덮어쓰기를 방지"에 따라 기준 `preview` `5d29b198d2c5773da6c828101d3f5059c64bbcaf`에서 **앱127 후보의 개인 좋아요 클라이언트 경로만** 최소 수정. 앱 버전 및 Worker canonical은 변경하지 않음.

- `src/services/exploreLikeService.ts`: 지연된 `/v1/me/likes` 조회가 반환된 직후 **그 시점의 UID별 outbox/accepted-but-unsettled snapshot을 다시 읽음**. 해당 곡이 보호 중이면 조회 응답을 캐시로 반영하지 않으며, 다른 경로가 이미 채운 캐시 항목도 덮어쓰지 않음. 신규 토글의 이전 하트 상태는 기존 낙관적/미확정 통합 판정 `readExploreTrackLikeMembership127`을 사용. `nextExploreLikeMutationAt127`을 추가해 같은 밀리초의 빠른 연속 클릭에도 각 `updatedAt`이 이전보다 커지도록 함(오래된 ACK가 다음 클릭과 같은 시각으로 보이는 회귀 방지). 기존 30초 묶음 저장·공용 좋아요 숫자 계산·소유자별 원본 변경 로직은 유지.
- `src/pages/ExplorePage.tsx`: 타 기기 알림이 실제 React 반영 시점의 개인 유효 상태와 다르면 화면에 적용하지 않음. 조회된 좋아요 배열의 과거 값보다 **각 곡별 현재 outbox/미확정/로컬 유효 상태**를 우선하여 화면을 계산. 디자인·배치 변경 없음.
- `scripts/verify-127-atomic-personal-like.mjs`: 지연 hydration 차단/원격 이벤트 재검사/동일 ms 클릭 순서 회귀 가드와 단순 clock 실행형 예 추가. V8 격리 점검에서 clock 3가지 및 outbox/미확정 3가지, 페이지·settled 가드 소스 확인 PASS. 기존 verifier의 JS 문법 파싱 PASS. **실제 TypeScript·Vite Build·전체 GitHub Actions 실행 및 실기기 테스트는 미실시.**
- 기능 제한: 기존 Worker071의 ACK는 큐 접수이며 개인 하트/공개 숫자 최종 D1 확정 증거가 아님. `updated`는 확정 알림 금지, 미확정 local guard 유지. 069 W4 이상 쓰기/실 인덱스·trigger 비용, 구형 Worker 공유 R2 무조건 쓰기, 최종 자동 수렴, 2천/128 한도는 **여전히 FAIL 또는 미검증**. 따라서 제품·PREVIEW 배포·TEST/PRODUCTION 승격 PASS 아님.
- 이번 작업은 GitHub `preview`의 React 후보 코드·기존 127 verifier·상태 문서만 변경. `public/app-version.json=126`, 실제 앱126/Worker071 유지; Firebase/Functions/Cloudflare/Rules/user canonical data 및 main/production 미변경. 실제 호스트/Cloudflare 계량은 이번 단계 미확인. 사용자 별도 배포 승인 전 배포 금지.

## 0BS. 134 파생 트리거 비용 감사 + 135 사용자별 순서 프로토콜 격리 검증 (2026-09-21 KST)

사용자 "반드시 좋아요 문제를 해결" 요청으로 글로벌 idempotency/consistency 원칙을 SORIDRAW에 맞춰 재검토. 133의 "W2"는 최소 두 원본 테이블만 가진 SQLite 모델임을 명시적으로 정정. 운영 D1과 혼동 금지.

- **새 비용 차단 근거:** `cloudflare/explore-worker/migrations/20260910_01_explore_derived_state.sql`의 `explore032_stats_update`, `20260910_03_explore_like_write_optimization.sql`의 `explore032_derived_track_update`, `idx_explore_rank_popular` 소스 확인. 원본 `likes` 변경→`track_stats` 변경→파생 공개곡→변경 seq→Feed journal→프로필 journal 경로. 신규 `scripts/verify-134-like-write-amplification.py`의 **보수적 격리 SQLite 모형**은 첫 좋아요/해제 각각 논리 행 6개, 동일 상태 재시도 0개 재현. 로컬 실행 때 소스 문자열 검사 입력은 GitHub에서 확인한 핵심 구문만 재현한 **fixture**; 정확한 실서비스 D1 스키마/전체 trigger 재현, D1의 index/trigger 포함 `meta.rows_written` 측정은 미실시. Cloudflare 공식 문서상 인덱스 수정도 별도 billed row가 될 수 있으므로 W2 원본 행 모델은 최종 비용 PASS 아님. 132 W4도 전체 실제 D1 청구 하한으로 확정하지 않음.
- **동시성 실험:** `scripts/verify-135-like-fenced-protocol.mjs`의 메모리 D1 + 재시작 후에도 유지되는 모의 영속 상태 기반 사용자별 곡 revision·operation ID·pending-first recovery. 격리 Node 실행에서 같은 요청 중복 W0, 오래된 좋아요 재전송 차단, 서로 다른 곡 독립, D1 전/후 실패·재시작 재개 시 숫자 이중 증가 방지 PASS. **반례:** 구형 Worker가 영속 순서 경로를 우회해 shared D1/R2를 쓰면 상태 불일치가 다시 발생하므로 승격 FAIL. 이는 실제 Cloudflare DO나 D1 실행이 아님. DO↔D1 원자성·DO 및 RTDB/R2 청구·구형 Worker 배포 호환·기기 동기화는 미검증.
- 133 문서 후속 정정 반영. 새 검증 스크립트 134/135는 `preview`에 저장. 071 canonical / 앱126 / app-version 126 / main / production 및 사용자 원본 비변경. 배포 없음. 실제 TEST/PRODUCTION 배포 상태 이번 작업에서 신규 확인하지 않았고 이전 기록 유지. 이번 작업 CI TypeScript/Build/Work 독립 감사 미실시.
- **다음 필수 순서:** (1) 실제 공유 D1은 SELECT/read-only schema/trigger/index 조회부터 하고 별도 격리 D1에서 각 SQL `meta.rows_written`·rollback 실측, (2) W1~W2를 요구하면 파생 자동 쓰기를 함께 재설계해야 하므로 검색/추천/최신/인기/프로필 최신성·구형 코드 호환 비교, (3) 사용자별 영속 순서 관리자(DO 등)의 운영비·장애 복구를 격리 구현/검증, (4) 각 환경의 모든 구형 writer가 동일 프로토콜에 진입하는 배포 경로 승인/검증. 이 조건 이전에는 Worker078, 개인 `settled` 허위 활성화, schema 변경, PREVIEW/TEST/PRODUCTION 배포 금지. 기존 0BQ/0BP 기능·비용 FAIL 유지.

## 0BR. 글로벌 사례 조사 + 직접 2행 좋아요 격리검증 PASS / 역순 요청 FAIL (2026-09-21 KST)

사용자 요청에 따라 Meta/Stripe/Cloudflare/Google 공식 문서를 검토하고 `DOCS/LIKE_WRITE_REDESIGN_133.md`에 실제로 공개된 원리와 SORIDRAW 적용 후보를 분리 기록. `scripts/verify-133-like-direct-two-row.py`를 추가해 격리 SQLite에서 관계 INSERT/DELETE + 직전 `changes()`에 따른 통계 갱신의 2행 모델 검증. 로컬 Python 실행: 신규 좋아요 2행, 중복 좋아요 0행, 타인 좋아요 숫자 보존, 중복 해제 0행, 누락 통계 fail-closed PASS. 반면 `true→false→늦은 과거 true`는 최종 상태를 재반전시켜 **순서 영속 기록 없이 직접 W2만 적용하는 방식은 FAIL**. 외부 DO/Queue 등은 아직 채택·생성하지 않음. SQL `changes()`의 실제 D1 batch 동작 및 live `rows_written` 미측정.

- 작업 시작 SHA `ec69a1391d2ea8c9d11d4ce35e9a71311e26e5c2`; 133 문서/격리 verifier는 preview commit으로 저장. 실제 Worker071 canonical, React 앱126, `public/app-version.json`, main/production 미변경. Hosting/Worker/Functions/Rules/D1/R2/RTDB 실제 배포 및 사용자 데이터 mutation 없음. 기존 0BQ W4 비용 FAIL과 0BP 개인 하트 최종 수렴 FAIL 유지.
- 테스트 범위는 **로컬 격리 Python 모형**. 이 변경 자체의 TypeScript/Build/전체 GitHub Actions/실제 PC·모바일/Work 감사는 미실시. 제품 완료 또는 PREVIEW 배포 PASS로 보고 금지.
- 다음: 1) 격리 D1로 `batch()`/직전 `changes()`/rollback/실제 D1 meter 확인, 2) DO 기반 사용자별 영속 순서 조정 vs 외부 Queue의 100k 사용량·장애 복구 비용 비교, 3) 구형 TEST/PRODUCTION의 공유 R2 writer 공존 해결 순서 설계. 어느 하나라도 W3+·과거 ACK 반전·중복 과금·원본 데이터 손실 위험이면 릴리스 차단. 새 Worker078/클라이언트 `settled` 임의 활성화 및 무단 배포 금지.

## 0BQ. 좋아요/해제 1회 D1 최소 행 변경 4 검증 — W1~W2 하드 게이트 FAIL, 구조 재설계 필요 (2026-09-21 KST)

사용자의 "다음 작업으로 이어가" 지시에 따라 새 개인 동기화 패치를 추가하기 전에 **기존 앱126/Worker071의 실제 069 좋아요 쓰기 비용 구조**를 코드와 격리 SQLite로 검증했다. `preview` Worker071 canonical은 바꾸지 않았고 실제 배포/사용자 데이터 변경 0.

### 확정한 소스 구조와 격리 감사
- Worker071 `enqueueExploreLikeBatch035`: 좋아요/해제 한 번의 신규 batch를 `explore_like_batches_069`에 INSERT OR IGNORE → **행 변경 1**.
- `processExploreLikeAggregateWave035`: 기존 통계가 있는 곡의 변경 때 `track_stats` UPDATE/UPSERT → **1**, 같은 사용자+곡 `likes` INSERT 또는 DELETE → **1**, 처리된 `explore_like_batches_069` DELETE → **1**.
- 서로 다른 사용자 행동이 묶이지 않은 **새로운 단일 좋아요 / 단일 해제** 각각 **최소 4개 행 변경**이라는 구조상 결과. 작업을 한 `env.DB.batch`에 묶어도 행 변경 수가 1이 되는 것은 아니다. 이 수치는 이 코드 경로의 구조적 모델로, 인덱스·추가 트리거·실제 R2/RTDB 운영량까지 측정한 **라이브 Cloudflare 청구값은 아니다**.
- 신규 `scripts/verify-132-like-d1-write-budget.py`: canonical 069 enqueue/집계 각 SQL 구문 존재 확인, 별도 인메모리 SQLite에서 좋아요와 해제 시 동일 행 변경 재현. 최종 GitHub Actions Run `35538319528` SUCCESS: `132_SQLITE_SINGLE_LIKE_ROW_CHANGES=4`, `132_SQLITE_SINGLE_UNLIKE_ROW_CHANGES=4`, `132_D1_W1_W2_RELEASE_GATE=FAIL_BY_SOURCE_LEVEL_LOWER_BOUND`, `132_D1_ROWS_WRITTEN_LIVE_METER=NOT_MEASURED`. 검사 PASS는 **비용 게이트 위반을 제대로 감지했다는 뜻**이며 릴리스 PASS 아님. 임시 Workflow 165 제거.
- 이 비용 구조는 074의 R2 CAS, 127 개인 pending, 075~077 원본 확인 기능을 더 붙여도 줄지 않는다. 승인 없는 실제 사용자 mutation이나 실데이터 D1 조회는 실행하지 않았다.

### 다음 작업·승격 차단
1. **추가 자동 복구/알림 패치 전에** 단일 행동 D1 W1~W2를 만족할 별도 백엔드 구조를 결정. 후보는 기존 durable D1 069 큐와 집계 4행 경로를 제거하고 사용자별 좋아요 관계 및 곡 통계를 실제 원본 2행 안에서 **원자적으로** 처리하는 방식. 이 경로의 동시 기기 순서·재시도·중복·정합성부터 실행형 설계·비용 비교해야 하며 아직 구현 승인이 난 완성안이 아니다.
2. 다른 후보(큐를 D1 밖으로 옮기는 방식 등)는 별도 Cloudflare 사용량·장애 복구·운영비가 있으므로 W1~W2만 보고 무조건 도입하지 않음. 장기 공유 데이터 유지·기존 구형 Writer 공존과 전체 릴리스 승격 방식을 함께 검증.
3. 실제 계정 테스트 때 D1 **rows_written**(좋아요/해제 각각)과 D1 **rows_read**(재방문 변경 없음 0), R2 HEAD/GET/PUT, RTDB 다운로드/transaction을 명확히 분리 실측. W3+이면 사용자가 성공하더라도 TEST/PRODUCTION 승격 차단.
4. 이전 0BP의 개인 하트 최종 D1 미확정/자동 수렴 FAIL도 유지. 구형 Worker 공유 R2 덮어쓰기, 2천/128 예외·PC↔모바일 실기기 검증 미완료. `public/app-version.json=126`, 실제 PREVIEW 앱126 + Worker071 유지. 후보 앱127/Worker072~077 미배포, main/production 및 사용자 원본 비변경. 명시적 프리뷰배포 승인 전 배포 금지.

## 0BP. 앱127 Worker 개인 R2 갱신과 최종 D1 확정 분리 — 잘못된 RTDB 하트 전파 차단 PASS, 최종 수렴 FAIL (2026-09-20 KST)

사용자 "계속 진행해" 지시에 따라 기존 0BO의 **개인 좋아요 R2가 성공적으로 갱신돼도 D1 canonical 집계는 뒤에 완료될 수 있다는 미해결 경계**를 수정했다. 현재 PREVIEW 실서비스는 앱126 + Worker071 그대로다. 후보 앱127/Worker072~077 미배포.

- `src/services/exploreLikeService.ts`: `canBroadcastExploreLikeSnapshot127('updated')`를 **false**로 변경. 074 intake의 `data.personalLikeSnapshot='updated'`는 R2 쓰기 성공일 뿐, 069/075 큐 최종 D1 적용 및 다른 구형 writer와의 경합이 끝났다는 증거가 아니다. 이 단계에서는 다른 기기에 `confirmed` RTDB 좋아요 변경을 게시하지 않고, 로컬 좋아요 의도를 `EXPLORE_LIKE_SNAPSHOT_PENDING_127`에 보존한다. 함수의 `'settled'`는 향후 독립 검증된 canonical 완료 증거를 위한 예약값이며 **현재 Worker는 발행하지 않음**. 변수명을 `canonicalLikeSettled127`로 정리.
- `scripts/verify-127-atomic-personal-like.mjs`에서 `updated=false`, `pending=false`, 구형 응답 필드 없음=false, 예약 `settled=true` 실행형 검증. 기존 로컬 pending 우선·서버 batch 재전송 방지·늦은 RTDB 보호 및 모든 과거 좋아요 회귀 유지.
- 최종 GitHub Actions Run `35518647451` SUCCESS: 기존 Worker071 SHA 고정, 072~077 격리 후보 생성·문법 검사, 128~131 실행형 mock, 127/126/125/124/123/110 회귀, TypeScript, Build PASS. 임시 Workflow 164 제거. 실제 D1/R2/RTDB/Firebase 사용자 원본 read/write, 앱/Worker 배포, main/production 변경 없음.

**릴리스 차단 유지:** 이 수정은 **잘못된 개인 좋아요 확정 신호 차단**이고 자동 동기화 완료가 아니다. 신규 변경의 로컬 pending이 최종 canonical 완료 확인 없이 계속 유지될 수 있다. `075~077` 예외용 D1 조회의 전역 구형 큐 검사 기아·동시 접수 fence 미비, `074` 선행 R2 write와 실제 D1 집계 순서, 구형 unconditional writer, cold/2000/128 보호에서의 복구 미완료, 실제 W1~W2 및 10만 사용자 비용, PC·모바일 실사용/Work 독립 감사 모두 미검증. 클라이언트가 R2 HEAD·개인 snapshot을 canonical 확정으로 오인하지 않게 최종 판정 경로를 설계할 때까지 앱127 PREVIEW 배포 금지.

**다음:** 기존 큐의 final canonical 조건을 실제 소스·비용으로 검증하고, 바뀐 UID+곡만 검증된 상태로 복구하는 최소 경로를 설계. 검증되지 않은 `'settled'` 응답을 단순 추가하여 신호를 재개하는 우회 금지.

## 0BO. 074 뒤늦은 ACK가 개인 좋아요 확정으로 전파되는 경로 차단 PASS / 자동 최종 수렴은 미완료 (2026-09-20 KST)

사용자의 "계속 진행해" 지시 이후 0BN 후보에서 다른 기기의 **더 최근 서버 수락 요청이 이미 개인 공유 R2에 반영된 뒤**, 과거 batch ACK가 늦게 도착했을 때 `syncExploreLikeR2AfterBatch074`의 `unchanged: true`를 개인 캐시 갱신 성공으로 판단할 수 있는 경로를 수정했다. 변경은 `preview` 후보 코드·테스트만 대상. 실배포 앱126/Worker071 유지, 사용자 데이터/TEST/PRODUCTION 비변경.

- `cloudflare/explore-worker/patches/074-personal-like-r2-cas.mjs`: 기존 곡별 server order와 들어온 batch 순서를 비교한다. 더 나중 순서가 이미 저장된 곡의 과거 요청은 **`superseded_like_batch`**로 fail-closed, 개인 snapshot `updated` 응답 및 타 기기 확정 RTDB 재생 금지. 서로 다른 곡이 같은 batch에 포함됐다면 새 곡은 CAS 저장하지만 전체 응답은 **`partially_superseded_like_batch`** (`ok:false`)로 처리하여 과거 곡의 잘못된 하트 확정을 막는다. 정확히 같은 토큰/같은 값의 재시도만 `unchanged: true` 유지. D1 mutation/큐/사용자 데이터 구조 변화 없음.
- `scripts/verify-128-like-concurrency.mjs`: ① 최신 좋아요 true(200)가 먼저 확정된 후 오래된 false(100)가 나중 도착해도 개인 R2 유지·새 write 0·pending 판정, ② 오래된 같은 곡+별도 새 곡 혼합 batch에서 새 곡만 CAS 처리하고 전체 확정 알림 금지 실행형 mock 추가.
- GitHub Actions Run `35518204038` **SUCCESS**: Worker071 고정본에 072~077 순차 patch 적용·syntax, 128~131 및 127/126/125/124/123/110 회귀, TypeScript, Build. 임시 Workflow 163 삭제. 배포 0, 실제 D1/R2/RTDB/사용자 데이터 write 0.
- **합격 범위:** 늦은 ACK에 따른 잘못된 개인 하트 확정 *차단*만 확인. 혼합 batch의 일부 곡이 실제 반영됐어도 전체 pending으로 처리하므로 로컬 보호값이 남을 수 있다. 사용자별 최종 D1 canonical 확정→해당 곡만 R2 조건부 복구→PC·모바일 상태 수렴은 미구현. `074`은 여전히 최종 D1 적용 전에 개인 R2 갱신을 시도하고, 069/075 처리 순서와 구형 unconditional writer 공존 위험·2000/128/cold 복구·10만 사용자 비용·실사용 W1~W2 모두 미검증. 서비스 릴리스 PASS 금지.
- 사용자 명시적 프리뷰배포 승인 없이 앱127/Worker 후보 배포 금지. main/production 브랜치 및 TEST/PRODUCTION 변경 금지.

다음: 자동 복구를 보장할 확정 근거가 없는 동안 패치 누적을 멈추고, 기존 069/075 처리 + 공유 R2 업데이트의 최종 원본 기준·구형 writer 선행 호환 정책을 **작은 범위로 독립 재검토**. 예외 원본 확인의 D1 read와 정상 재방문 D1 R0를 구별, 변경 1회 W1~W2 실측과 비용 측정 없이 승격 금지.

## 0BN. 074 접수 ACK와 개인 R2 성공 분리 / 127 불확정 하트 보호 코딩 PASS — 최종 자동 복구 미완료 (2026-09-20 KST)

사용자의 "계속 진행해" 요청에 따라 Worker074 fail-closed 시에도 API가 일반 성공만 반환하여 클라이언트127이 이를 다른 기기에 잘못 확정 알림으로 발송하던 연결 버그를 preview 후보에서 보완했다. **실제 PREVIEW는 여전히 앱126 + Worker071. 앱127과 Worker072~077 모두 미배포, TEST/PRODUCTION 및 원본 사용자 데이터 비변경.**

### 수정과 검증
- `cloudflare/explore-worker/patches/074-personal-like-r2-cas.mjs`: batch 접수 응답 `data.personalLikeSnapshot`에 실제 개인 R2 CAS 결과를 `updated` 또는 `pending`으로 **명시**. D1 큐 접수 ACK만으로 R2 갱신 성공을 주장하지 않음. 추가 D1 read/write 없음. 071/구형 코드가 이 필드를 보내지 않는 경우도 갱신 성공으로 간주하지 않도록 클라이언트에서 보호.
- `src/services/exploreLikeService.ts`: `canBroadcastExploreLikeSnapshot127`는 정확히 `updated`만 게시 허용. `pending`/응답 필드 없음일 때 서버 batch 재전송은 하지 않고, 사용자별 `EXPLORE_LIKE_SNAPSHOT_PENDING_127`에 접수된 곡의 최신 로컬 의도만 영속 기록한다. 이를 **기존 120 outbox 삭제 전에 저장**, 과거 개인 R2 baseline/개인 좋아요 목록 재동기화/늦은 RTDB 이벤트가 해당 곡을 과거 값으로 덮지 못하게 한다. 실패 대상은 다른 기기에 확정 RTDB 신호를 보내지 않고 같은 기기 이벤트를 `local`로 분류하며, UI에 "좋아요 저장은 접수됐지만 다른 기기 동기화는 확인 중" 오류 알림을 전달한다. 특정 ID에 대해 다음 성공한 개인 R2 CAS 결과가 실제로 왔을 때만 pending 보호값 삭제. 화면/색상/CSS·30초 묶음 저장 비변경.
- `scripts/verify-127-atomic-personal-like.mjs`: 응답 `updated`/ `pending`/필드 없음 구별하는 **실행형 순수 판단 함수 테스트**와 pending UID 보존·원격 미전파·R2 baseline 우선권·기존 outbox 선저장 순서 정적 가드 추가. `scripts/verify-128-like-concurrency.mjs`는 Worker 후보의 batch 응답 필드와 실제 074 성공 여부의 연결 검사.
- Run `35517860556` **SUCCESS**: 071 canonical 보호, 072~077 격리 Worker 생성·문법 검사, 128~131 및 127/126/125/124/123/110 회귀, TypeScript/Build. 선행 Run `35517703214`도 PASS였으나 최종 버전의 local/confirmed 이벤트 분류 수정 후 재검사. 임시 Workflow 162 삭제. 실제 데이터 read/write 및 배포 0.

### 남은 명시적 FAIL
- **아직 최종 자동 복구가 아니다.** 클라이언트의 accepted-but-unmaterialized UID/곡 상태는 다음 R2 CAS 성공이나 검증된 canonical 최종 상태 복구가 구현되기 전까지 local 보호값으로 남을 수 있다. 이미 보낸 오래된 RTDB 신호, 구형 Writer의 shared R2 무조건 덮어쓰기, 069/075 큐 ACK→최종 D1 적용 순서, 2000/128 한도 계정의 캐시 재구축은 여전히 해결 전. 075~077은 읽기 전용 가드로 앱 자동 호출·공유 R2 재구축 미연결이며 077 전역 구형 큐 가드는 상시 트래픽에서 기아 가능.
- 첫 R2 baseline 및 R2 revision과 사용자 로컬 pending 최종값의 충돌은 보호하지만 **그 값이 최종 D1 canonical과 동일하다는 보장은 없음**. 따라서 PC·모바일 하트의 실제 수렴 PASS 금지. 구형 Worker 호환 선행 승격·각 환경 실제 배포 바인딩·D1 W1~W2·10만 사용자 R2/RTDB 비용, 실기기·Work 독립 검증 미완료.
- 앱 버전 파일 126, 실제 Worker071 소스 비변경. main/production branch 비변경. 사용자 명시적 프리뷰배포 승인 전 배포 금지.

다음: 기존 patch 증식 대신 `repairNeeded`를 *정확한 해당 UID/곡*의 canonical 후처리 완료 신호와 연결할 수 있는지 검증하고, 원본 D1 W1~W2/추가 R2 읽기·쓰기·RTDB 비용을 실제 계정에서 먼저 측정. 구형 Writer가 공존하는 기간에 불변 최종 판정이 불가능하면 혼용 버전을 릴리스하지 않고 단계별 호환 승격부터 설계.

## 0BM. 074 개인 좋아요 R2 cold/2천 ID/128 순서 한도 데이터 보존 보완 PASS — 자동 수렴은 아직 FAIL (2026-09-20 KST)

사용자 "계속 진행해" 지시에 따라 0BL의 남은 공유 likes R2 결손/한도 처리 위험을 `preview` 후보 코드에서 보완했다. **실제 PREVIEW 앱126 + Worker071, TEST/PRODUCTION 변경 없음. 새 앱127/Worker072~077 미배포.**

### 수정 파일 및 실제 동작
- `cloudflare/explore-worker/patches/074-personal-like-r2-cas.mjs`의 **공유 개인 R2 부재** 시 기존 `syncExploreLikeR2AfterBatch034` unconditional write fallback **금지**. 이미 수락된 사용자별 D1 좋아요 큐는 유지하되, `{ok:false, repairNeeded:true, reason:'shared_r2_cold_requires_canonical_rebuild'}` 반환. 신규 원본을 모르는 상태에서 전체 개인 캐시를 만들어 쓰지 않는다.
- 같은 패치에서 `likedTrackIds.length >= 2000`이면 missing ID를 미좋아요라고 판정할 수 없어 덮어쓰기 금지; 개인 목록 `slice(0,2000)`으로 기존 좋아요 ID가 조용히 사라질 수 있던 저장 부분 제거. 변경 후 2천 초과도 보호한다.
- 기존 `lastLikeOrders074` 최근 128곡의 오래된 기록을 자동 삭제하면 지워진 곡에 뒤늦게 도착한 구요청이 새 상태를 뒤집을 수 있다. 새 ID 추가로 128개를 초과하면 토큰 eviction 대신 `shared_r2_order_capacity_requires_canonical_rebuild`를 반환하고 기존 R2와 순서 기록을 보존. 이미 기록된 ID는 정상 CAS 처리를 이어갈 수 있다.
- `scripts/verify-128-like-concurrency.mjs`에 ① cold R2 write 0, ② 기존 2000 좋아요 ID 비삭제, ③ 128개 순서 기록 비삭제 실행형 mock 추가. 기존 두 기기 충돌/기기 시계/서로 다른 곡/idempotency도 그대로 검사.

### 검사 및 릴리스 차단
- GitHub Actions Run `35517114646` **SUCCESS**: Worker071 source SHA 보호 + 072~077 후보 생성·문법 검사, 128~131 및 127/126/125/124/123/110 회귀, TypeScript/Build. 테스트 전용 Workflow 161 정리. 사용자 D1/R2/RTDB 원본 write, 앱/Worker 배포, main/production 변경 0.
- 이 PASS는 **데이터 유실 방지·fail-closed의 모의 테스트 PASS**다. cold/2000/128 경계에서는 personal R2 최신화를 완료하지 않고 `repairNeeded`로 멈춘다. 최종 D1 canonical 처리 완료 확인 및 조건부 개인 R2 재구축/부분 복구는 미구현. 좋아요 서버 큐 ACK가 최종 canonical 확정이라는 뜻도 아니다. 해당 사용자의 다른 기기 하트가 여전히 stale일 수 있으므로 자동 수렴 PASS 금지.
- 남은 위험: 오래된 Worker unconditional shared R2 writer가 하나라도 활동하면 CAS 토큰이 덮일 수 있음; 075/076/077 복구 경로는 클라이언트 자동 연결·큐 atomic fence 및 10만 명 운영비 미합격. 실사용 D1 W1~W2/RTDB/R2 비용, TEST/PRODUCTION 실제 바이너리, PC↔모바일 검증, 별도 Work 감사 미실시.

**다음 단계**는 unsafe fallback을 복구 완료로 오인하지 않고, compatible writer 선행 승격 정책과 read-only canonical 확인 후 안전한 repair 종료 조건을 확정하는 것. 그 전 배포·데이터 수정 금지.

## 0BL. 동일 좋아요 Writer 세 환경 고정 소스 호환 검증 PASS / 운영 배포 전 (2026-09-20 KST)

사용자의 "작업 진행해" 지시로 0BK에서 남은 구형 Worker writer 공존 문제를 실제 GitHub `preview`/`main`/`production` 고정 canonical Worker 소스로 대조했다. **이번 작업은 preview 패치와 검사용 CI만 수정했다. 실제 PREVIEW 앱126/Worker071 및 TEST/PRODUCTION 서비스·사용자 데이터 비변경.**

### 확인한 사실과 변경
- `preview` canonical Worker blob `9e0048ac0d2e3540707930786d531b9bca3bccb7`, `main` app124 Worker blob `04586a5f203227d5cb02581d13f78a43b95053ce` (고정 main SHA `f7fc25d5452b3313efa3cca53c180c5494cc9837`), `production` app117 Worker blob `14b3e4f3211ee7dfe1fcf9fcf10c935b6ce000f6` (고정 production SHA `e994340f3c4f6ac97f444f1ddf13053d3faffa71`) 대조. 세 소스 모두 구형 `syncExploreLikeR2AfterBatch034`이 개인 로컬 R2 읽기/쓰기 후 **공유 개인 R2에 조건 없이 덮어쓰는 경로**이고, `handleLikeBatch034`에 `receivedAt`, `queued.batchId`가 있다. 단, GitHub 소스가 현재 원격 배포 바이너리와 같다는 별도 실측은 아님.
- `cloudflare/explore-worker/patches/073-server-like-queue-order.mjs`, `074-personal-like-r2-cas.mjs`: 관련 없는 PREVIEW 전용 071/072 marker 의존성만 제거. 기존 실제 수정 로직/함수명/공유 R2 계약은 보존했다. `073` 기기 시계 대신 서버 접수 시각, `074` 같은 UID 공유 R2의 ETag conditional PUT + 곡별 수락 순서 기반 상태를 **구형 TEST/PRODUCTION Worker 복사본에도 동일 적용 가능**하도록 만들었다. 실제 main/production 파일은 손대지 않음.
- `scripts/verify-128-like-concurrency.mjs`의 `SORIDRAW_VERIFY_PORTABLE=1`은 각 구형 복사본의 072 revision 신규 API 유무만 제외하고 기존 074 실제 함수의 동시/역순/서로 다른 곡/동일 token 검증을 재사용한다. 기존 PREVIEW 전체 후보는 072~077 생성 순서 그대로 별도 검증.
- 최종 GitHub Actions Run `35516684243` **SUCCESS**: 정확한 고정 세 Worker 소스 blob 검사, old TEST/PRODUCTION Worker 복사본에 073/074 적용 및 `node --check`, 동일 실행형 128 모의 테스트 PASS; PREVIEW 072~077 모의검증 128~131 및 앱127/126/125/124/123/110 회귀, TypeScript, Build PASS. 선행 Run `35516547581`은 테스트용 다른 branch를 전체 checkout하면서 PREVIEW TypeScript 경로에 구형 Functions가 섞여 FAIL; Worker 파일만 sparse checkout하도록 격리 후 최종 성공. 검사 전용 Workflow 160 삭제, 배포/데이터 write 0.

### 릴리스 순서 및 남은 FAIL
- **지금 앱127 단독 PREVIEW 배포 금지.** 공유 R2의 구형 unconditional writer가 남아 있으면 신규 074 CAS/순서 필드를 지울 수 있음. 호환 Writer가 `preview`·`main`·`production` 각각에 적용되기 전에는 새 구조가 전 환경의 개인 하트 정합성을 보장할 수 없다.
- 가능한 릴리스 단계는 (1) 기존 좋아요 API/하트 UI를 유지한 writer-only 호환 변경을 환경마다 별도 검증하고 사용자 승인으로 PREVIEW→TEST→PRODUCTION 순서로 검증·승격, (2) 실제 배포 Worker 소스와 R2 conditional-write 동작을 재확인, (3) 기존 Writer 공존 기간의 데이터 정합성·복구를 따로 검증, (4) 이후 앱127 출시 여부 판단. **TEST 배포는 사용자 `테스트배포` 승인, PRODUCTION은 명확한 `정식배포` 승인 전 진행하지 않는다.** 현재 프로젝트의 완성 버전 전체 승격 규칙 때문에 writer-only 배포를 계획할 때에도 어떤 앱/Worker tree를 승격하는지 명시·별도 승인 필요.
- **이번 PASS는 세 고정 소스에 동일 패치를 적용할 수 있고 mock이 통과한 것만 보장.** 074 cold-R2 fallback, 최신 128곡 order cap, 다른 Worker가 그 사이 074 이전 코드를 실행하는 구간, 큐 최종 D1 commit vs ACK, 075 큐의 독립 timestamp 처리, 앱127 로컬/RTDB 최신성, R2 2천 ID, 10만 사용자 R2·RTDB 전송 비용, 실제 W1~W2·기기 검증은 남아 있다. 임의 사용자 데이터 재생성/대량 복구로 해결 금지.
- 이 단계에서 source SHA/hash 고정까지 마친 **릴리스 후보**는 아직 없음. 앱 버전 파일은 126이고 PREVIEW Worker071 source canonical 및 main/production branch 미변경. 비용 수치 미측정/실사용 검증 전. Work 독립 실행 감사 미실시.

다음: 실제 old/new writer가 동일한 입력에 대해 예상한 D1 집계 결과와 공유 R2가 맞는지 추가 모의/제한된 테스트 계정 검증, 074 cold-start/128 cap과 호환 승격 경계를 별도 설계. 사용자 승인 전 배포/데이터 변경 금지.

## 0BK. Worker077 구형 069/066/035 큐 보호 후보 PASS / 운영 복구 합격 아님 (2026-09-20 KST)

사용자의 "진행해" 지시로 0BJ의 미해결 구형 좋아요 큐 문제를 추가 분석하고 `preview` 전용 patch·실행형 mock에 반영했다. **실제 PREVIEW 앱126 + Worker071 유지. 앱127/Worker072~077 미배포.**

- `cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql`의 069은 `batch_id` 단일 PRIMARY KEY, `user_uid` secondary index가 없다. 066은 batch_id PK+created index, 035도 batch_id PK+created index이며 UID 전용 index가 없다. 구형 요청을 UID별로 찾기 위해 `WHERE user_uid = ?` 전체 큐 scan 실행 금지. 승인 없는 인덱스 추가 migration도 진행하지 않는다.
- 신규 `cloudflare/explore-worker/patches/077-legacy-like-queue-guard.mjs`: **일반 진입과 무관한 예외 075/076 원본 조회 경로**에서 활성 UID별 075 큐 검사 다음 069→066→035 구형 큐를 각각 `SELECT 1 … LIMIT 1`로 최대 3회 검사. 어느 하나라도 미처리면 409, 큐 조회 오류면 503 fail-closed. 모두 비었을 때만 기존 본인 최대20곡 D1 canonical membership 조회. 각 구형 큐는 최대 첫 행만 읽으므로 전체/UID scan 없음. DB/사용자 데이터 쓰기 0.
- 신규 `scripts/verify-131-legacy-like-queue-guard.mjs`: 구형 각 큐 pending/error 차단, 3개 전부 비었을 때 조회, 075 UID 선검사 후 구형 검사 순서, UID scan 없음 실행형 mock. `verify-129`·`verify-130`는 077 helper를 주입하여 과거 075/076 개별 기능도 유지.
- 최종 Run `35515730947` **SUCCESS**: Worker071 SHA 고정 복사본+072~077 순차 적용·`node --check`, 128/129/130/131 실행형 mock, 127/126/125/124/123/110 기존 회귀, TypeScript, Build PASS. 초기 159 검사 Run `35515426960`, `35515499702`, `35515648324`은 신규 검증 스크립트의 marker/주석 정규식/075 mock 범위 문제로 FAIL, 검증 코드 수정 후 성공. 임시 Workflow 159 제거. 실제 D1/R2/RTDB/Firebase write·Hosting/Worker 배포 0.
- **절대 한계:** 077은 전역 구형 큐에 1행만 남아 있어도 무관한 계정의 예외 복구를 409로 막을 수 있다. 구형 Worker가 계속 active면 높은 트래픽에서 복구 지연/기아가 발생한다. 또한 075 UID 및 3개 구형 큐 검사 직후 들어오는 새 요청까지 하나의 원자적 fence로 막지는 못한다. 구형 Worker의 공유 R2 무조건 덮어쓰기, 앱에서 canonical API 호출·R2 CAS 자동 복구 미구현, 과거 2000 ID 제한도 그대로이다. **운영용 자동 수렴 PASS 아님.**
- 비용: 077은 정상 재방문에 사용하지 않으며 예외 복구 1회마다 활성 075 UID 조회와 최대 3개의 구형 큐 첫 행 조회 + 최대 20곡 원본 확인이 추가된다. W1~W2 mutation 실제 수치 및 R2/RTDB 10만 사용자 비용 미측정. 단순 mock 테스트로 비용 PASS 금지. 구형 코드가 활동 중인 동안 안전하고 효율적인 최종 복구를 보장하려면 구형 writer 호환 선행 승격 또는 별도 사용자별 확정 신호 구조가 필요. 사용자 승인 없이 TEST/PRODUCTION 변경 금지.

다음: 077을 전체 해결로 승격하지 않고 **구형 Worker와 신규 Worker의 공유 원본 writer를 어떻게 동일 규칙으로 만들지** release sequencing을 설계. 공개 숫자/개인 하트/좋아요 D1 W1~W2 동시 측정 가능해진 후에만 PREVIEW 릴리스 판단. 사용자 원본 대량변경·전체 재생성 금지.

## 0BJ. Worker076 활성 075 큐의 원본 확인 안전장치 코드 PASS — 이전 큐·자동 복구는 미완료 (2026-09-20 KST)

사용자의 "계속 진행해줘" 지시로 0BI의 예외 복구용 D1 membership 확인을 **큐 접수 ACK와 실제 적용 완료를 혼동하지 않도록** 보완했다. 현재 실제 앱126/Worker071 유지. 후보 앱127 및 Worker072~076은 미배포.

### 이번 소스 변경
- 신규 `cloudflare/explore-worker/patches/076-like-canonical-settlement-gate.mjs`: 기존 인증된 `/v1/me/likes-confirmed` 075 handler가 호출되면 20곡 입력 검증 다음, 같은 사용자의 `explore_like_user_queue_075` 단일 UID 행과 `explore_like_user_queue_state_075` 처리 커서를 비교한다. 현재 활성 075 큐에 미처리분이 있으면 `PERSONAL_LIKE_STILL_PROCESSING` HTTP 409로 원본 판정 보류. 큐 확인 자체 실패 시 `PERSONAL_LIKE_SETTLEMENT_UNAVAILABLE` HTTP 503으로 fail-closed. 해당 사용자 큐가 처리됐을 때만 기존 최대20곡 읽기 전용 canonical D1 조회 실시.
- 신규 `scripts/verify-130-like-settlement-gate.mjs`: pending→409/원본 조회0, 오류→503/원본 조회0, settled→정해진 곡 원본 1회 조회, 과도한 입력→큐 조회 전400, 인증된 UID만 조회 모의 실행. 기존 129 검증을 076의 보호 조회와 호환되도록 수정.
- 최종 Run `35514904414` **SUCCESS**: Worker071 복사본에 072~076 패치 순서대로 생성·문법 검사; 128 동시 CAS/129 구형 overwrite 재현/130 큐 안전장치 및 127/126/125/124/123/110 회귀, TypeScript, Build PASS. Worker071 canonical SHA 보호, 실사용 데이터 write/배포 0. 임시 Workflow 158 삭제.

### 여전히 릴리스 차단
- 큐 확인은 현재 075 경로의 미처리 사용자 행만 확인한다. TEST/PRODUCTION 구형 069 및 기타 legacy 큐나 조회 도중 동시 접수되는 새 요청에 대한 전역 atomic fence가 아니다. 원본 조회 결과를 곧바로 클라이언트/공유 R2의 최종 확정값으로 취급하면 위험.
- `075/076`은 **읽기 전용 검증용 후보**일 뿐 자동 개인 R2 CAS 복구·클라이언트 호출 조건/성공 이후 데이터 반영이 아직 구현되지 않았다. 구형 Worker가 새 개인 R2의 메타데이터를 덮는 위험 지속.
- 075 확인 호출 시 사용자의 큐 상태 확인 D1 읽기 + 최대 20곡 canonical D1 읽기 발생. **변경 없는 일반 앱 업데이트·페이지 진입에는 연결하지 않았고 D1 data read 0 목표 유지**. 개인 R2/RTDB 추가비용, 실제 좋아요 W1~W2, 2000 ID, PC↔모바일 실사용·독립 Work 감사 미측정.
- 현재 app-version126, PREVIEW 앱126/Worker071 실배포 상태. Worker072~076은 canonical source/hash 및 라이브에 미반영. main/TEST/production/PRODUCTION, Rules/Functions/UI/사용자 원본 비변경. 사용자 명시적 프리뷰배포 승인 없이는 배포 금지.

다음: 구형 writer와 현재 075 큐가 공존하는 동안 최종 D1 원본을 언제 확정할지 안전한 fence·캐시 복구 종료 조건을 정하고 제한된 테스트 계정으로 실측. W3+ 또는 전체 원본 조회·무단 데이터 write 금지. 확정 가능성이 입증되지 않으면 해당 릴리스 차단 유지.

## 0BI. Worker075 제한된 원본 좋아요 확인 API 후보 추가 / 모의검사 PASS·자동 복구 미구현 (2026-09-20 KST)

사용자 "작업 진행해" 이후 0BH의 구형 Worker 공유 R2 덮어쓰기 문제를 별도로 재현하고 **원본을 확인하는 읽기 전용 경로**를 `preview`에 추가. 실제 서비스는 **PREVIEW 앱126 + Worker071 그대로**, 앱127 및 Worker072~075는 미배포. 사용자 원본/환경 변경 없음.

- 신규 `cloudflare/explore-worker/patches/075-targeted-canonical-like-read.mjs`: 071 복사본에 072~074를 적용한 후보에 인증 `GET /v1/me/likes-confirmed?trackIds=...` 추가. 기존 `handleMyLikeStatesD1Core` 재사용으로 **본인 UID + 최대 서로 다른 20곡**의 공개·발행된 곡 D1 canonical membership만 읽고, 목록 전체/R2 값에서 추정하지 않음. 빈 요청·20곡 초과·과도한 ID는 D1 조회 전에 400. D1 WRITE 0, 공유 Edge 캐싱 없음. 이 API는 평상시 진입과 앱 업데이트에 연결하지 않은 **이벤트 발생 시 예외 복구용 기반 경로**다. 실행 시 대상 곡 수만큼 D1 rows_read는 발생하며 비용 검증 없이 상시 조회 금지.
- 신규 `scripts/verify-129-like-legacy-repair-gate.mjs`: 인증 D1 core 경로·20곡 상한·잘못된 입력 선차단 검사와, 구형 Worker가 074의 ETag/정렬 필드를 무시하고 shared R2를 덮으면 **R2 하트 상태가 canonical D1과 달라지는 상황**을 실행형 mock으로 재현. `075_AUTOMATIC_LEGACY_REPAIR=NOT_IMPLEMENTED`를 명시. 이 테스트는 충돌 해결 PASS가 아니라 아직 남은 차단 원인의 재현이다.
- Run `35514355534` **SUCCESS**: Worker071 고정 복사본에 072~075 패치 순서대로 생성·문법 검사; 128 동시 CAS 모의검사·129 원본 제한 조회·127/126/125/124/123/110 회귀, TypeScript, Build 성공. 임시 Workflow 157 검사 후 제거. 실제 DB·R2·Firebase 변경 및 배포 0. Worker075는 아직 canonical worker.js/ checksum에 포함되지 않았다.
- **잔여 FAIL:** old TEST/PRODUCTION Worker가 shared R2를 덮으면 074 메타데이터가 사라질 수 있다. 075 원본 확인은 아직 앱의 자동 복구 과정에 연결되지 않았고, 큐 ACK→최종 canonical 확정 타이밍 판단·개인 R2 자체의 충돌 후 복구도 없다. 바로 앱127/Worker 후보 배포하면 안 된다. R2 2천 ID, 실제 D1 W1~W2, RTDB/R2 비용 및 PC↔모바일 실측 미검증.

다음: 구형 writer가 덮어쓴 경우 *어떤 대상 ID를 언제 canonical에서 확인할지*를 이벤트별로 제한하고, 075 조회 이전의 큐 미완료 상태와 최종 D1 적용을 구별할 수 있는지 설계·검증. 필요하면 구형 코드가 동시에 쓸 수 있는 기간 동안 자동 복구를 안전하게 보장할 수 없는 사실을 보고하고 릴리스 차단 유지. 기존 UI/뮤직노트/전체 캐시 비변경.

## 0BH. 앱127 + Worker072~074 동시 변경 코드·실행형 모의검사 PASS / PREVIEW 미배포·최종 원본 실측 전 (2026-09-20 KST)

사용자 지시: PC·모바일이 같은 계정/같은 곡을 거의 동시에 좋아요·해제해도 합리적으로 수렴하도록 수정. 0BG 후보 위에 preview 전용으로 다음 내용을 구현. **실제 PREVIEW 앱126 + Worker071은 유지**. Worker072~074는 Worker071 소스의 임시 복사본에만 적용했고 canonical 파일·checksum 및 live 배포는 변경하지 않음.

### 순서 및 R2 충돌 방지
- `cloudflare/explore-worker/patches/072-personal-like-r2-revision.mjs`: 잘못된 환경 로컬 개인 likes R2 HEAD를 **공유 원본 `exploreSharedLikesKey061(uid)`** HEAD로 정정. 인증 사용자 본인 UID만 조회, 데이터 GET/원본 D1 read 0. 과거 TEST/PRODUCTION writer도 공유 경로를 갱신할 수 있다는 전제의 하위호환 신호.
- `073-server-like-queue-order.mjs`: 기존 040 큐의 `batchAt=max(serverReceivedAt, clientMutationAt)`를 **서버 접수 시각 `receivedAt`만 사용**하도록 수정. 변경 내용 digest는 그대로 유지해 재시도 동일성 정보를 보존. 같은 millisecond는 기존 SHA batch_id 정렬로 결정적 순서 사용. 기존 069 W1 큐와 aggregate SELECT/삽입/삭제 SQL, D1 스키마·쓰기 수 변경 없음.
- `074-personal-like-r2-cas.mjs`: 신규 Worker가 같은 UID의 공유 좋아요 R2 오브젝트를 동시 변경하면 읽은 ETag 기반 `onlyIf:etagMatches` PUT으로 경쟁을 감지하고 최다 12회 **그 UID 오브젝트만** 재읽어 재시도. 최대 128곡의 최근 수락된 서버 시각+batch ID 순서를 저장해 **같은 곡에 더 늦게 접수된 상태**를 먼저 처리된 뒤 과거 요청이 뒤집지 못하도록 함. 서로 다른 곡 변경은 합침. 기존 `schemaVersion=1`과 `likedTrackIds` 유지하여 이전 앱은 새 필드를 무시할 수 있음. 초기 공유 R2 부재 시 기존 cold fallback 유지(별도 경합 검증 미완료).
- 개인 R2 GET/PUT 에러는 별도로 잡아 이미 D1 큐에 들어간 좋아요 응답을 5xx로 바꾸지 않고 **기존 DO 예약이 실행될 수 있도록** 유지하며 repair-needed 경고 기록. 단, 이 실패 경로는 최종 개인 R2 자동 복구를 보장하지 않으므로 실배포 전 별도 보호 필요.
- 127 UI의 하트/로컬 outbox 우선·30초 묶음 및 전체 공용 숫자 분리, 072 개인 revision의 최소 5분 체크, 사용자 데이터 공유 기본 원칙 그대로.

### 코드 검사 및 제한
- 새 `scripts/verify-128-like-concurrency.mjs`는 Worker071 복사본+072/073/074 생성본의 실제 `syncExploreLikeR2AfterBatch074`을 분리 실행. 동일 곡 상반 상태의 두 동시 요청(양방향), 서로 다른 곡 동시 요청, ETag CAS 충돌 및 retry, 동일 token 멱등성, 서버 시각 기반 069 순서 검사를 모의 실행. R2 데이터/실사용자 정보는 쓰지 않는다.
- 최종 Run `35506583191` **SUCCESS**: 128 실행형 모의 테스트, 127/126/125/124/123/110 회귀, TypeScript, Build, 생성 Worker `node --check`, 071 SHA 보호 PASS. 이전 Run `35506283554`은 074 패치 파일의 불완전한 소스로, `35506389871`은 이전 127 검사식의 잘못된 로컬 R2 HEAD 기대값으로 FAIL. `35506444633` PASS 뒤 R2 예외 보호를 더하고 최종 재검증. 검사 완료 후 임시 Workflow 156 제거.
- **독립 Work 감사/실제 Cloudflare 동시 R2 conditional write/실제 D1 W1~W2/PC·모바일 동일계정/RTDB 예외·비용 미검증.** 이 PASS는 코드+모의 테스트 범위에만 해당하며 릴리스 허가가 아님.
- **잔여 근본 위험:** 아직 구형 TEST/PRODUCTION Worker는 공유 R2에 CAS·순서 필드를 쓰지 않아 같은 시점의 구형 writer가 새 CAS 결과를 덮어쓸 수 있음. 오래된 writer가 추가 필드를 유실시키거나 cold-R2/12회 충돌 실패 시 canonical 최종 상태와 개인 R2가 어긋나더라도 후속 repair 보장이 없음. RTDB ACK는 최종 D1 aggregate 확정이 아님. 전체 버전 공존·queue 최종 처리 후 대상 사용자/곡만 신뢰할 수 있게 복구하는 구조 및 비용 검증 전 **TEST 승격·프리뷰배포 중단**.
- 사용자 원본 대량변경, D1 migration/seed, Functions/Rules, UI/반응형, Music Note 60초 저장, main/TEST/production/PRODUCTION 미변경. 앱 버전 파일은 126 그대로. 임시 워크플로만 삭제.

### 다음 작업
1. 구형 Worker와 공존하는 동안 074 metadata를 보존하거나 최종 D1 적용 후 변경된 UID/track의 개인 공유 R2를 신뢰 가능한 순서로 복구할 안전 경로 결정. 정상 재진입 D1 R0, 행동당 W1~W2를 깨지 않을 것.
2. 실제 R2 conditional PUT 실패·기기 반대 클릭·이전 버전의 공유 R2 overwrite·aggregate queue 최종상태/RTDB 알림 순서·R2 2천 ID 한도에 대한 독립 실행검사. 비용 10만 명 및 읽기/쓰기 실측.
3. Worker072~074 실제 canonical source/SHA와 app127 버전 정식 고정 및 복합 출시 사전검증. 사용자 별도 프리뷰배포 승인 전 어떤 서비스도 배포하지 않음. TEST/PRODUCTION 승격 금지.

## 0BG. 앱127 구형 호환·실패 복구 보완 코드 및 Worker072 패치 후보 PASS / 동시성·실사용 미검증 (2026-09-20 KST)

사용자의 계속 수정 지시에 따라 0BF의 세 가지 차단 문제 가운데 구형 앱 변동 감지와 실패 복구 경로를 preview 코드에서 보완했다. **완료된 릴리스가 아니다. 앱126 + Worker071 실배포 유지.**

- exploreLikeService.ts: RTDB 신호 gap 발생 시 먼저 완료 처리하던 동작 제거. UID별 영속 repair target 보존, 인증된 사용자 R2 snapshot이 정상 반영된 후에만 신호 버전 완료 기록. R2/네트워크 실패 시 이전 캐시와 미완료 작업 보존, 온라인/포커스/재진입 시 제한 재시도. pending outbox 우선.
- ExplorePage.tsx: 복구 성공 이벤트에서 방금 확인한 개인 좋아요 기준을 다시 무효화하던 동작 제거. 성공한 개인 상태를 화면에 다시 반영.
- 072-personal-like-r2-revision.mjs: 기존 Worker071에 적용하는 코드 패치 후보. 신규 인증 GET /v1/me/likes-revision에서 같은 계정의 R2 좋아요 bundle을 UID별 HEAD 한 번으로 확인하고 ETag 반환. 공개 Edge 캐시에 사적 데이터를 저장하지 않고 원본 D1 read/write 0. 기존 앱126·구형 환경의 동일 공유 R2 bundle 변경을 감지하기 위한 하위호환 경로.
- 앱은 Explore 최초/재개 및 자기 좋아요 목록에서 사용자별 마지막 검증 시각을 기준으로 최소 5분 간격의 변경번호 확인. 변경 없으면 전체 개인 목록 데이터 GET 0; 변경되면 기존 인증 R2 snapshot을 로컬 pending 최종값과 합침. 주기 타이머 없음. 변경 없는 확인에도 R2 Class B HEAD 비용 1회가 발생하므로 전체 네트워크 read 0으로 보고하면 안 됨.
- GitHub Actions Run 35505242919 SUCCESS: 127/126/125/124/123/110 검사, TypeScript, Build, Worker071 SHA 보호, 071 복사본+072 패치 적용 및 node --check/인증·HEAD/D1 미조회 정적 검증. 최초 Run 35505175645은 검사식이 테스트 파일 안의 금지 문자열을 실제 구현으로 오인해 FAIL, 검사식 수정 후 통과. 임시 Workflow 155 제거.
- **중요:** 072는 patch 파일과 dry-run 후보일 뿐 canonical preview-worker.js 및 source-sha256.txt에 아직 반영되지 않았으며 실제 Worker071 unchanged. 앱 버전 파일 126, 앱127 미배포. Rules/Functions/사용자 원본 데이터/main/TEST/PRODUCTION 비변경.
- 남은 FAIL3 (근거 구체화): 040 큐 batchAt이 server receivedAt과 기기 mutationAt의 최대값이며 aggregate는 created_at DESC로 우선순위를 정한다. 서로 다른 기기 시계 때문에 최종 작업 순서가 역전될 수 있고, 034 사용자 R2 read/put은 두 요청에서 경쟁해 canonical 최종값을 오래된 개인 R2가 덮을 수 있다. 단순 R2 HEAD 변경 감지만으로 해결되지 않음. 서로 다른 두 기기가 같은 곡을 반대로 변경할 때 Worker 큐 접수 ACK, 사용자 R2, 최종 D1 canonical 적용 순서 검증 필요. 역순·동시 변경 실행형 검증과 실제 두 기기 하트 수렴, 좋아요/해제 D1 W1~W2 및 RTDB/R2 비용 측정 미완료. R2 bundle 2천 ID 한도도 미해결.
- 다음: 최종 원본 동시성 검증·비용 감사 후 Worker072 canonical 고정 및 앱127을 하나의 릴리스로 검증. 명시적 프리뷰배포 승인 없이는 배포 금지; TEST/PRODUCTION 승격 중단.

## 0BF. 앱127 독립 정적 감사 FAIL — 3개 릴리스 차단 문제 (2026-09-20 KST)

고정 감사 대상 `7f744f7cf8d93148368d1c926ee5dc61703a6887`. 별도 ChatGPT 독립 정적 검토이며 **Work 도구로 수행한 독립 실행 감사가 아님**. 전문 근거·재현·수정 범위는 `DOCS/APP127_INDEPENDENT_AUDIT_2026-09-20.md` 참조.

- FAIL 1 구형 앱 공존: 127은 배치 접수 ACK 후 사용자별 RTDB 신호를 보낸다. 현재 라이브 126 및 구형 TEST/PRODUCTION은 이 신호를 발송하지 않으므로, 127의 최초 1회 R2 복구 이후 구형 앱에서 실제 좋아요를 바꾸면 127도 개인 하트를 무기한 오래된 상태로 유지할 수 있다. 이번 사용자 PC↔모바일 재발 방지 충족 실패.
- FAIL 2 실패 복구: RTDB 이벤트 gap에서 `markSeenLikeSignal127`을 먼저 실행하고 단일 snapshot 복구 이벤트를 보낸다. R2 요청 실패 후 같은 RTDB 값은 재처리되지 않으며 페이지에 머물면 retry 보장 없음.
- FAIL 3 두 기기 경합: ACK(큐 접수) 직후 RTDB 신호와 최종 D1 집계·R2 순서 일치 증거가 없고, 동일 곡 반대 클릭 시 검증 없이 cache 확정. 동시성 실행형 테스트 부재.
- 비용: 기존 RTDB 계정 listener 추가/수정 batch당 transaction, 최초 1회 전체 2천 ID 한도의 R2 조회 및 복구 실패 반복 수치 미측정. 공식 Firebase는 다운로드 바이트와 연결/암호화 오버헤드를 과금하므로 D1 R0/W0만으로 합격 불가.
- 이전 Run `35498983342`의 TypeScript/Build·정적 회귀 PASS는 **유효하나 위 시나리오를 검사하지 않음**. 이번 감사에서 실제 사용자 좋아요를 조작하거나 Firebase/D1 원본을 변경하지 않음. PREVIEW에 추가 배포 없음.

**현재 게이트:** 127 후보 FAIL, 앱126/Worker071 라이브 유지. 보완 구현 후 실행형 경합·복구·구형 앱 공존 검증 및 10만 명 비용·D1 W1~W2 실제 검사 전 프리뷰배포 보류. TEST/PRODUCTION 승격 금지. 본 감사 결과를 하위 0BE의 '코드 PASS'보다 우선한다.

## 0BE. 앱127 통합 개인 좋아요 수정 후보 PREVIEW 코드 PASS / 실배포·기기실측·비용감사 전

2026-09-20 KST 사용자 요청: 빈/채운 하트, 실제 좋아요·해제, 공개 숫자를 서로 무관한 값으로 봉합하지 말고 **한 곡의 한 사용자 동작으로 처리**할 것. 앱126 실사용에서 PC 첫 네 곡 하트 채움·모바일 앞 두 곡 비움, 숫자는 양쪽 1로 일치하는 0BD FAIL을 기준으로 `preview`만 수정했다. **현재 실제 서비스는 여전히 앱126 + Worker071**, 앱127은 후보 기능 코드이며 `public/app-version.json=126`. 사용자의 별도 명시적인 프리뷰배포 지시 전 Hosting/Worker 배포 금지.

### 수정 코드 및 실제 의미
- `src/services/exploreLikeService.ts`: `computeExploreLikeAction127(baseLiked, desiredLiked, publicCount)` 하나로 로컬 하트와 본인 변화량만 반영한 임시 표시 숫자를 함께 계산한다. 공개 전체 수에는 다른 사용자의 좋아요가 포함되므로 개인 하트에서 전역 숫자를 역산·강제하지 않는다. `readExploreTrackLikeMembership127`는 로컬 pending final-state → 검증된 개인 캐시 순으로 결정을 내리며 불명확한 과거 캐시로 신규 변경을 시작하지 않음. 기존 30초 최종 묶음 전송·90초 숫자 보호 유지.
- 계정별 과거 120 로컬 liked-state의 **최초 1회** 복구는 기존 `/v1/me/social-snapshot`의 사용자별 R2 좋아요 스냅샷을 활용. 정상 R2 cache에서 D1 데이터 읽기 0, 다른 사용자의 데이터를 복제하지 않음. 유효한 응답에서만 완료 marker 기록, 실패 시 기존 로컬 데이터 보존·재시도, 로컬 outbox 최우선. R2 좋아요 원본은 2,000 ID 제한이므로 한도에 도달한 응답은 전체 목록으로 믿지 않고 캐시를 보존하며 안전 차단한다(한도 초과 사용자 지원은 미완료).
- 기존 RTDB `userSync/{uid}/exploreLike` 규칙·경로를 재사용해 **좋아요 서버 batch 접수 ACK 이후 1회** UID별 최대 50개 변경 결과만 transaction으로 게시한다. 가입자 기기는 자기가 아직 미전송한 변경을 절대 덮어쓰지 않고 해당 ID의 하트·개인 좋아요 목록 캐시만 갱신한다. 메시지 누락/50개 초과 시 불완전한 replay를 먼저 적용하지 않고 R2 사용자 스냅샷 재검증. 알림 실패는 좋아요 서버 요청을 중복 전송하지 않고 작은 로컬 재시도 큐에 유지(재접속·온라인·포커스 시 시도).
- **주의**: Worker의 batch ACK는 최종 D1 canonical 집계 완료가 아니라 큐 접수 완료다. 기존 1분 집계 이후 공개 숫자 갱신은 별도 서버 흐름으로 유지. 본인 클릭과 실제 모든 사용자의 집계가 완전히 동시에 확정됐다고 주장하지 않는다. 서버 장애·PC/모바일 경합·구형 TEST/PRODUCTION 코드의 추가 좋아요는 독립 실측 및 설계 감사 전.
- `src/pages/ExplorePage.tsx`: 하트 클릭 시 React 표시값만 반전하지 않고 서비스가 보유한 하나의 유효한 개인 상태를 확인. 다른 기기의 대상별 변화 신호가 오면 추천/최신/인기/프로필의 동일한 개인 상태를 반영. 미검증 상태의 좋아요 조작을 잠시 차단. 사용자 UI 외곽선/위치/크기/색상 등 비변경.
- `src/services/exploreLikedTracksService.ts`: 개인 R2 snapshot 수신 때 canonicalLikedTrackIds를 원본과 pending 최종값으로 합치되 기존 캐시 곡카드는 보존하고, 실제 좋아요 곡 화면에 필요한 누락된 카드만 조회. `scripts/verify-127-atomic-personal-like.mjs` 신규 고정 테스트(실제 함수 optimistic transition 실행 포함).

### 코드 검증 및 범위
- 최종 read-only/코드 테스트 Run `35498983342` SUCCESS: 신규 127 회귀, 기존 126/125/124/123/110 회귀, TypeScript, Build, Worker071 원본 SHA `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813` 비변경. 이전 임시 검사 Run `35498532876`, `35498941046`는 신규 테스트 파일 문자열·실행문 구문 오류로 FAIL, 검사 코드 정정 후 재실행 통과. 중간 `35498597502`은 이전 후보의 사전검증 PASS로 최종 고정 기준이 아님. 임시 Workflow 154 제거, 배포/원본 사용자 데이터 쓰기 0.
- **독립 Work 감사, 실제 Firebase/RTDB 신호 송수신, PC↔모바일 UI 검증, 실사용 사용자 mutation 비용은 미검증.** 새 사용자별 RTDB listener 1개/서버 접수 batch당 RTDB transaction 1회와 재시도 비용을 추가하므로 10만 명 기준 비용 실측·감사 없이 릴리스 PASS/TEST 승격 선언 금지.
- 서버 코드·Worker071·Functions·Rules·UI CSS·Music Note 저장 구조·공유 원본 D1/Firestore 변경 없음. main/TEST/production/PRODUCTION 코드·배포 변경 없음. 사용자 본인의 15:31 공개 전환은 의도한 정상 작업으로 이전 0BD에서 이미 확인.

### 다음 게이트
1. Work가 현재 127 코드 변경의 경쟁 조건, batch ACK vs canonical, RTDB Rule 실제 허용, 오래된 TEST/PRODUCTION writer와의 공존, 구형/신규 계정 처음 진입과 R2 2천개 안전 처리 및 RTDB 요금을 독립 감사. RTDB 사용량 증가가 비용 합격선을 훼손하면 미배포 상태에서 다른 저비용 경로로 다시 설계.
2. 변경 없는 재방문 D1/Firestore data read=0, 최초 계정 R2 1회, 좋아요/해제 D1 rows_written W1~W2, 추가 RTDB read/write/연결 비용을 별도 측정. 50곡 초과 신호 누락, 인증 오류, 오프라인→복귀, 다른 사용자 좋아요, 반대 기기 동시 클릭 테스트 필수.
3. 독립 검증 후 사용자 `프리뷰배포` 승인 시에만 버전127 고정·PREVIEW Hosting 배포. TEST/PRODUCTION 승격 절대 금지. 원본 대량 변경·캐시 전체 삭제·비공개 원복 금지.

## 0BD. 앱126 실사용 FAIL: PC↔모바일 개인 좋아요 하트 소유 상태 불일치 (사용자 확인 2026-09-20 KST)

사용자 최신 사진: 동일 계정으로 보이는 PC·모바일 PREVIEW 추천에서 첫 네 곡의 공개 좋아요 수는 양쪽 모두 1. 모바일은 앞 두 곡 **빈 하트+1**, 세 번째·네 번째는 **채운 하트+1**. PC는 첫 네 곡 전부 **채운 하트+1**. 따라서 0BC의 38곡 canonical↔R2 **공개 숫자 정합성 PASS는 유지**하되, **개인 하트 PC↔모바일 실사용 정합성은 FAIL**. 사진만으로 현재 해당 사용자의 canonical likes 관계를 확정할 수 없어 어떤 기기가 stale인지는 아직 미확정. 공개 수 1에서 사용자 하트 소유를 역산하면 안 됨.

사용자 확인: 이전 비공개 곡 SHA10 `1319e4479e`는 **본인이 2026-09-20 15:31경 직접 공개 전환**. 0BC의 '의도된 재공개인지 불명'은 해소. 사용자 직접 공개이므로 보안 사고/오류로 분류하지 않으며 임의로 비공개 원복하지 않는다.

### 정적 경로 조사
- `src/services/exploreLikeService.ts`: `getExploreLikedTrackIds()`는 사용자 UID별 영구 liked-state 120 캐시에 누락된 ID만 `/v1/me/likes`에 요청. 이미 true/false가 들어 있으면 타 기기의 변경 후에도 서버 재검증이 없다. `observeExploreLikeAccountSyncSignal`은 빈 함수로, 과거 RTDB replay는 명시적으로 비활성화됐다.
- `src/pages/ExplorePage.tsx`: `likeHydrationKeyRef`는 동일 사용자/표시 ID 조합을 한 번 hydration한 뒤 반복 조회하지 않고, `likeAccountSyncSignal`도 현재 타 기기의 likes 변경으로 증가시키는 유효 구독 경로가 없다. 126 warm-entry revision은 **공유 Feed count 전용**이므로 하트 소유 상태를 고치지 않는다.
- `src/services/exploreLikedTracksService.ts`: 개인 좋아요 곡 컬렉션도 `canonicalLikedTrackIds` 캐시가 있으면 네트워크 재검증하지 않는 경로. 페이지 이동/재방문 시 원본 전체 조회를 막는 기존 정상 캐시는 보호하되, 실제 다른 기기에서 변경됐다는 신호가 들어오면 해당 곡만 정확하게 갱신해야 한다.
- 현재 사진은 양측 하트 소유 관계 모순 증거이나 **실제 account UID 대상 authenticated membership/canonical 상태는 미측정**. 강제 값 덮어쓰기/새 좋아요 조작으로 진단 금지.

### 다음 작업 범위: 127 개인 like signal 설계·구현 전 안전 게이트
1. 기존 099/098 RTDB replay를 무작정 복구하거나 매 진입 40곡 D1 membership 재조회 금지. 신규 버전 marker나 공유 카운트로 사용자 소유 여부를 결정하지 않음.
2. 같은 사용자의 실제 **확정된 좋아요 변화**를 1회 작고 안전한 UID-scoped revision/변경 항목 신호로 전달할 수 있는지, Worker 큐 ACK vs canonical commit 시점, 기존 사용자 소유 스냅샷·RTDB 비용·환경간 구형 코드와의 호환성을 먼저 검증한다. 신규 서버 신호가 필요한 경우 좋아요/해제 D1 W1~W2 및 변경 없는 앱 업데이트 D1 R0 목표 유지.
3. 변경이 없는 재진입에는 기존 기기 하트 캐시 유지. 실제 다른 기기 좋아요/해제에만 영향을 받은 ID의 개인 membership 및 liked-card cache 갱신. 공개 수는 항상 shared canonical-derived 별도 값, optimistic outbox는 로컬 최신 사용자 의도 우선. 동시 PC↔모바일/배치 실패/역순 이벤트/비공개 곡/타 사용자 likes 테스트 필수.
4. 개인 좋아요 authoritative 확인 실패 시 기존 값 임의 false/true로 변경하지 않고 재시도 가능하게 유지. 기존 정상 뮤직노트/라이브러리/UI/Worker071 공개 수 경로 무변경 우선.
5. 사용자 별도 프리뷰배포 승인 전 배포 금지. 126 실제 앱 유지. 본 FAIL이 해결되고 독립 감사·실사용·mutation W1~W2가 PASS되기 전 TEST/PRODUCTION 승격 차단.

## 0BC. 앱126 Firebase PREVIEW Hosting 배포 PASS / 38곡 현재 정합성 PASS / 모바일 실사용·과거 비공개 재공개 출처 확인 전

2026-09-20 KST, 사용자의 "그래 다음 진행하자. 승인"에 따라 0BB의 모바일 추천·최신 stale 좋아요 1 표시 수정본을 **PREVIEW 앱126**으로 배포했다. 범위는 React/Firebase PREVIEW Hosting만. TEST/PRODUCTION, Worker071, Functions/Rules, 사용자 원본 D1/Firebase 데이터는 이 릴리스 작업에서 변경하지 않았다.

### 고정 소스와 배포·검증 기록
- 제품 준비 기준 `f88ba1f1ef644208acf938a18122f8651ed6c68a`; Firebase PREVIEW 앱 배포 트리거/실제 릴리스 source `2c62108e2ad7b3c54ce41baf811dc45e603a8a01`.
- `public/app-version.json=126`, `src/pages/ExplorePage.tsx`의 126 warm-entry revision 확인 수정. 기존 125 회귀 verifier는 버전 >=125 호환으로, 110 verifier는 126 캐시 조건부 revision을 확인하도록 보완. 기본 30초 좋아요 묶음·공유 1분 반영·Music Note 60초 저장·UI 유지.
- 첫 preflight Run `35495034377` FAILURE: 이전 110 검사식이 126 stale-entry 로직을 인식하지 못해 배포 전 중단. 110 검사 수정 후 Run `35495097116` **SUCCESS**: 126/125/124/123/110/070 회귀, TypeScript, Build, Worker071 SHA 그대로 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`, D1/R2/Firebase 원격 write 0.
- Firebase Hosting PREVIEW Run `35495184909` **SUCCESS**: source `2c62108e2ad7b3c54ce41baf811dc45e603a8a01` 고정, TypeScript/Build/Hosting/exact index PASS, `https://preview.soridraw.com/app-version.json=126` PASS, TEST/PRODUCTION 정적 index·main/production refs 비변경 PASS.
- Cloudflare PREVIEW Worker071 실제 버전 `a6fda48f-ec20-48b3-a08d-ef43128c2e43`, TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` — 배포 후 read-only 확인, 변경 없음.

### 실제 배포 후 결과와 예상과 다른 상태
- 배포 후 read-only Run `35495431978` **SUCCESS (현재 상태 정합성)**: 원본 현재 공개곡 **38곡**의 canonical like count, likes relation, derived likes/row_json 전수 일치. PREVIEW API/latest+popular, PREVIEW local/latest+popular, shared/latest+popular 총 6목록 각각 38곡 전부 원본 카운트 일치. LIVE R2-only latest/popular D1 `R0/W0`; 진단 중 D1/R2/Firebase write 0.
- 이전 0BA/0BB 당시 **37곡**, 과거 비공개 target SHA10 `1319e4479e` D1 is_public=0. 새 read-only 원본 확인에서 이 곡이 **is_public=1/status=published/updated_at=1789885898014 (2026-09-20 15:31:38 KST)** 으로 변경된 것을 확인. 앱126 배포(15:49 KST) 이전 시점이다. 현재 38곡 목록에는 해당 곡이 원본 공개 상태에 맞춰 노출된다. **의도된 사용자 재공개인지, 다른 코드의 변경인지 원인·승인 미확정**. "기존 비공개 그대로" PASS로 보고하지 않는다. 원본을 무단으로 비공개 원복하거나 덮어쓰지 않는다.
- 최초 postflight `35495288121`은 기존 37곡 고정검사로 FAIL. `35495331318`은 과거 private `updated_at` 식별값이 변해 FAIL, `35495379834`는 실제 기존 private가 공개된 사실을 분리 확인하며 경고 후 중단. 현재 원본 visibility와 R2 6목록 정합성을 분리한 `35495431978`은 PASS하되 위 출처 미확정 위험 유지.
- 검사 전용 임시 Workflow 152·153은 검증 후 제거, 상시 126 verifier 보존. 테스트용 신규 좋아요/공개/비공개 mutation은 실행하지 않았다.

### 현재 게이트·다음 작업
1. **PREVIEW 앱126은 실배포 완료.** 하지만 사용자가 동일 PC/모바일에서 추천·최신의 빈 하트+숫자0을 인기 탭 왕복 없이 확인하는 실사용은 아직 미검증. 정상 재방문 Feed 데이터 추가 read 0(작은 edge revision 체크는 stale일 때 가능), 실제 변경 시 bounded R2와 D1 R0W0도 기기에서 최종 확인 필요.
2. 과거 비공개 target 재공개가 의도된 작업인지 확인하고, 사용자 행동/로그 없이 app126 버그 또는 임의 공개로 단정 금지. 현재 사용자 데이터를 수정하지 않는다.
3. 좋아요/해제·공개/비공개 실제 사용자 행동 1회당 D1 rows_written `W1~W2` 실측 미완료. W3+ 또는 PC/모바일 FAIL 시 TEST 승격 금지. Work 독립 감사 미수행.
4. 구형 TEST/PRODUCTION 059/064 shared full writer 공존 위험은 미해결. catalog WRITE ON/READ OFF/FIRST_PUBLISHER OFF 유지. 사용자 별도 `테스트배포` 승인 전 main/TEST, 명확한 `정식배포` 승인 전 PRODUCTION 변경 금지.

## 0BB. PREVIEW 앱125 사용자 실사용 FAIL: 모바일 추천/최신의 해제 후 좋아요 숫자 stale / 126 warm-entry 수정 코드 PASS·미배포

2026-09-20 KST, 동일 계정 PC에서 원래 좋아요 1인 첫 두 곡을 해제하고 시간이 지난 뒤 모바일 PREVIEW 추천 탭에서 빈 하트·숫자 1을 확인했다. PC는 빈 하트·숫자 0. 모바일 인기 탭에서는 0이며 다시 추천/최신으로 돌아오면 숫자가 0으로 수렴한다. 이는 이전 0BA의 배포 시점 37곡 PASS 이후 **새 사용자 변경에 대한 실사용 회귀**이며, app125 화면 동기화는 FAIL이다. 기존 0BA PASS는 당시 시점의 서버 결과에 한정한다.

### 원본/파생/API 실측 원인 분리
- 2026-09-20 read-only GitHub Actions Run `35494118924` SUCCESS: 두 대상 track SHA10 `9fef3a2199`, `abd7763bc1` 모두 canonical D1 count=0, likes relation=0, derived likes/row_json=0. LIVE PREVIEW API, PREVIEW local R2, shared R2 각각 latest/popular **6개 경로 전부 두 곡 0**. 최신·인기 각각 37곡. 두 API 요청 D1 R0/W0, 진단 중 D1/R2/Firebase write 0. 즉 이번 1 잔존은 서버 latest/popular 숫자의 불일치가 아니라 **모바일 이전 latest Feed 캐시**에 한정된다.
- `src/pages/ExplorePage.tsx`의 recommended/latest는 동일 latest URL·기기 캐시, popular는 별도 URL·캐시. app125의 update-marker는 최초 1회 이후 유지. 이후 cachedRows 재진입 때 `feedRevisionEventAtRef`를 현재 시각으로 재설정해 포커스/터치 revision 확인까지 120초 차단; 첫 진입을 발생시킨 내비게이션 이벤트는 Explore listener 장착 이전일 수 있다. 그래서 오래된 latest 수치가 남고 popular에서 새 0을 불러온 후 `syncSharedPublicCountsToLocal110`이 다른 로드된 카드·캐시를 곡별로 수정하면 정상화되는 구조다.
- 개인의 하트 소유 여부와 공용 좋아요 숫자는 별개 데이터이며 **숫자를 하트 모양에서 역산해 고정하는 보정 금지**. 이번 증거는 빈 하트/숫자 1 불일치이며 PC↔모바일 모든 하트 소유 수렴을 입증한 것은 아니다.

### PREVIEW 소스 수정 (릴리스 예정 app126, 현재 app-version.json 및 라이브는 125)
- `src/pages/ExplorePage.tsx`: 같은 탭 내 요청 URL별 **마지막 성공 revision 확인 시각**을 유지. 캐시 표시만으로 검사 시각을 갱신하지 않음. stale warm Explore 진입(120초 경과 또는 탭 내 첫 진입)은 작은 edge-cache revision 확인; 같으면 Feed 데이터 읽기 0, 달라졌으면 기존 R2-only first-page를 받고 곡별 캐시 및 표시 수렴. 추천/최신 공통 경로, 인기 탭 경유 불필요. 앱125 최초 1회 direct shared R2 확인/실패 시 캐시 보존·재시도 및 현행 30초 좋아요 묶음 처리 보호. D1 origin read 추가 없음.
- `scripts/verify-126-explore-entry-like-count.mjs` 신규; `scripts/verify-123-shared-like-cache-repair.mjs`는 기존 검사식의 explicit-only 조건을 126의 stale-entry/명시 이벤트 양립 조건으로 보강. UI·반응형·Worker·Functions·Rules·원본 데이터 미수정.
- 최초 Run `35494196072` FAIL: 126/125 테스트 PASS 후 과거 123 verifier가 새 코드 구문을 인식하지 못해 TypeScript/Build 실행 전 중단. 검사식 호환 최소 수정 뒤 Run `35494247124` **SUCCESS**: 126/125/123/124 회귀, TypeScript, Vite Build PASS. **코드·정적 회귀 기준 PASS일 뿐 PC/모바일 새 빌드 실사용·독립 Work 감사는 미검증**.
- 임시 read-only/코드 테스트 Workflow 150·151은 검사 후 삭제, 상시 126 verifier 보존. 코드는 preview만 commit; 125 라이브 Hosting·Worker071 및 main/production 변경 없음. 배포 트리거/사용자 데이터 변경 없음.

### 다음 릴리스 게이트
1. 배포 승인 전 preview 코드 기반 126 후보 버전·기존 125 verifier 호환성을 고정하고 필요 회귀 재검사; 독립 Work 감사가 가능하면 별도 실시. 사용자 별도 프리뷰배포 지시 전 Hosting/Worker 배포하지 않음.
2. 배포 시 Firebase PREVIEW Hosting만(Worker 071 불필요 재배포 금지), exact build·앱 버전 확인. 기존 두 곡의 모바일 추천/최신 초기 진입 0+빈 하트, 인기 왕복, PC↔모바일, 실제 신규 좋아요/해제 후 다시 진입, 변경 없음 재진입과 D1 R0/W0 검증. revision의 작은 캐시 신호와 실제 목록 data read는 분리 측정.
3. 실제 사용자 mutation별 D1 rows_written W1~W2는 여전히 미검증; W3+면 FAIL. TEST/PRODUCTION의 기존 059/064 구형 writer 위험과 Work 독립 감사도 미해결이므로 TEST/PRODUCTION 승격 중단.
4. 데이터 대량수정/Feed rebuild/전체 캐시 삭제/기존 비공개 곡 재공개/자동 production 승격 금지.

## 0BA. PREVIEW 앱125 + Worker071 전체 배포 PASS — 공개 37곡 좋아요 정합성 / 비공개 유지 / D1 R0W0

2026-09-20 KST, 사용자의 명시적 배포 요청으로 **PREVIEW만** 앱125와 Worker071을 승격했다. 변경된 실제 실행 서비스는 Firebase PREVIEW Hosting과 Cloudflare PREVIEW Worker이며, TEST/PRODUCTION 코드는 그대로다. 이 절은 하단 0AZ의 "app125/Worker071 미배포" 상태를 대체하는 최신 기준이다.

### 배포 소스·실행 버전
- 최종 배포 전 검증 Run `35490609131` SUCCESS: app125 최초 유효한 shared R2 snapshot 반영 뒤 완료 marker, 과거 app123/124 회귀, Worker071 canonical like count=1 보호/정상 unlike 0 허용/canonical 누락시 안전 중단, 070 private+like CAS, TypeScript, Build, Worker dry-run PASS.
- 기존 release preflight가 신규 app125의 유효 snapshot 블록을 옛 단일행 문자열로 검사해 Worker Run `35491096749`에서 **배포 전 FAIL**. 런타임 실패가 아니라 `scripts/verify-110-explore-liked-public-count.mjs` 검사식 문제 확인 및 최소 수정. 재검증 Run `35491232039` PASS; 첫 실패 Run은 실제 Worker 배포/데이터 변경 없음.
- Worker 배포 고정 source commit `e9ccd5d4092f24ae34457b81479eded73af59b87`. canonical SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- Cloudflare PREVIEW Worker Release Run `35491281571` **SUCCESS**. Worker `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf` → **`a6fda48f-ec20-48b3-a08d-ef43128c2e43`**. prereq D1 035/069 pending=0; SHA/preflight, Feed/Profile smoke, head-only warm revision R0/W0 PASS.
- Firebase PREVIEW Hosting Run `35491378862` **SUCCESS**. 앱 source/trigger commit `e2bc5ee3e1845e6abb6c573e468a711f40f41fd3`; TypeScript PASS, Build PASS, Firebase Hosting 배포 PASS, `https://preview.soridraw.com/` exact index build PASS, `app-version.json=125` PASS, TEST/PRODUCTION 비변경 PASS.
- Firebase Functions/Rules, Cloudflare TEST/PRODUCTION Worker, 원본 D1/Firebase 사용자 데이터는 변경하지 않았다. TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 유지.

### 배포 후 실제 좋아요·비공개·비용 정합성
- 일회성 전체 공개곡 진단 0AZ: 37곡 중 4곡의 R2 파생 숫자가 1→0으로 어긋났고, 변경 대상 4곡만 ETag CAS로 PREVIEW local/shared 최신·인기 총 4개 snapshot에 반영(Run `35489878431`). 사용자 원본 D1 write 0, 다른 곡 변경 없음.
- 독립 read-only postflight Run `35491493263` **SUCCESS** (배포된 app125/Worker071 시점):
  - 실제 PREVIEW 앱 125, Worker `a6fda48f-ec20-48b3-a08d-ef43128c2e43` 확인.
  - Canonical D1 like_count / likes 관계 / derived likes / derived row_json **37곡 전체 일치**.
  - PREVIEW API latest/popular **각 37곡 전부 canonical 좋아요 수와 일치**.
  - PREVIEW local/latest+popular, shared v112/latest+popular 각 37곡, 모두 canonical 좋아요 일치.
  - 기존 비공개 target SHA10 `1319e4479e`는 D1 `is_public=0` 유지하며 위 6개 first-page 결과에서 모두 미노출.
  - 실제 PREVIEW latest/popular R2-only Feed의 D1 `R0/W0` PASS. postflight에서 원본 D1/R2 write 0.
  - TEST/PRODUCTION Worker 비변경 PASS.
- 앱125은 기기의 이전 Feed·하트 상태를 먼저 표시하고, **앱 업데이트 후 각 정렬별 최초 1회** 현재 shared R2 first-page를 직접 읽어 정상적으로 반영한 뒤에만 완료 marker를 기록한다. 실패 시 기존 기기 캐시 보존·다음 방문 재시도. 정상 재방문은 추가 데이터 읽기 0 목표. 최초 1회에는 **R2 읽기 발생 가능**, D1 원본 조회는 Feed R2-only 경로에서 0. 하트의 실제 계정별 PC↔모바일 동기화는 사용자 실사용 검증 전.
- Worker071은 실제 공개/재공개 mutation에서 해당 곡의 canonical 좋아요를 PK로 확인하여 과거 0이 local/shared Feed·공개프로필에 덮어쓰이지 않도록 한다. **실제 좋아요·해제·공개·비공개 요청별 D1 W1~W2는 아직 미측정**. 릴리스 과정에서 원본 사용자 데이터를 쓰지 않았음과 사용자 mutation 비용 합격은 별개.

### 남은 위험 / 다음 단계
- 해당 시점의 37곡 결과는 PASS지만 **과거 4곡 1→0을 마지막으로 쓴 Worker/요청의 타임라인 원인은 미확정**. 071은 알려진 publication 경로 보호이며 영구 무재발의 증명은 아니다.
- TEST/PRODUCTION의 구형 059/064 shared snapshot 전체 덮어쓰기 경로가 여전히 존재. 보호 환경에 무단 코드 배포 금지. catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF 유지.
- PC/모바일 실제 동일 계정 하트·숫자 확인, 사용자 mutation별 W1~W2 비용, 공개/비공개 실사용, Work 독립 감사는 **미검증**. 위 항목 중 FAIL이면 TEST 승격 금지.
- 사용자의 별도 `테스트배포` 승인 전 main/TEST 변경 금지. `정식배포` 명시 승인 전 PRODUCTION 변경 금지. 데이터 일괄 재생성/migration 금지.

## 0AZ. 공개 좋아요 37곡 전수 대조·4곡 표적 복구 PASS / app125 + Worker071 코드 준비·미배포

2026-09-20 KST, 사용자 요청에 따라 app124 좋아요 0/1 불일치를 네 곡 임시 표시 보정으로 끝내지 않고, **전체 공개곡 원본·좋아요 관계·파생 행과 R2 목록을 대조하고 변경 경로를 방어**했다. 별도 명시적 배포 요청은 없으므로 app125/Worker071은 아직 실제 PREVIEW에 배포하지 않았다.

### 전수 진단 및 제한 복구
- TEMP 144 Run `35489084396`, 확장 Run `35489176377` SUCCESS: 실제 공개곡 **37곡 전체** 대조. canonical `track_stats.like_count`, 실제 `likes` 관계, `explore_derived_tracks.likes` 및 `row_json.like_count` 37/37 일치. 4곡만 PREVIEW local + shared latest/popular가 원본 1을 0으로 보유(나머지 33곡 일치). 이 네 곡은 9/18과 동일 대상. 전체 조회는 일회성 진단으로만 실행, 정상 페이지·앱 업데이트 경로에 포함하지 않음.
- TEMP 146 Run `35489878431` SUCCESS: canonical/관계/파생이 계속 1인 동일 네 곡만 식별자 검사 후 ETag CAS로 PREVIEW local latest/popular와 shared latest/popular **각각 4개 값만 0→1** 수정. 37곡 및 비공개 곡 제외 유지, 나머지 곡 byte 동등성 postflight PASS. D1 사용자 원본 write 0; R2 파생 snapshot 네 객체만 쓰기. Firebase 및 Worker 배포 0.
- TEMP 147 Run `35489951050` SUCCESS: 실제 PREVIEW Feed API latest/popular **37곡 모두 canonical 좋아요와 일치**, canonical/관계/파생 37/37 PASS. 검사 당시 라이브 app124·PREVIEW Worker070과 TEST/PRODUCTION Worker 버전 불변. 이것은 복구 직후의 시점 검사이며 영구 재오염 불가능성의 증명은 아님.

### app125 클라이언트 변경
- `src/pages/ExplorePage.tsx`, `public/app-version.json`: 기존 기기 캐시의 Feed·하트 상태를 먼저 사용. 릴리스 버전과 정렬(latest/popular)로 구분한 marker가 없으면 **최초 한 번 해당 공유 R2 first-page snapshot을 직접 확인**(D1 R0/W0 계약). 업데이트마다 모든 공개곡·전체 사용자 데이터·D1 원본 재조회 금지. 정상 재방문은 기존 R0/W0 유지.
- HTTP 오류/유효하지 않은 payload이면 기존 캐시를 보존하고 marker를 쓰지 않아 다음 진입에 재시도. 유효한 snapshot을 로컬 Feed/공유 공개 숫자에 반영한 뒤에만 완료 기록. PC/모바일 공통 경로. *한 번은 정렬별 최대 한 번*이며 최초 요청은 R2 읽기가 발생할 수 있다. 이것을 업데이트 이후 모든 서버 읽기 0이라고 보고하면 안 됨.
- 앱 버전 변경 자체로 기존 사용자 원본·좋아요 관계·Music Note 60초 묶음 저장·UI를 초기화하지 않음.

### Worker071 변경
- `cloudflare/explore-worker/patches/071-publication-canonical-like-parity.mjs` 및 canonical Worker: 공개·재공개 mutation에서 대상 곡 PK로 canonical like count를 확인해 PREVIEW local/shared Feed 및 공개프로필에 반영. 이전 stale 0 우선 병합을 제거하고 실제 해제 1→0도 허용. canonical 읽기 실패 시 잘못된 0으로 파생 캐시를 쓰지 않고 보류. 앱 업데이트/재방문 호출 경로에는 D1 읽기 없음.
- `cloudflare/explore-worker/release-patches.json`에 069→070→071 순서 보존. canonical SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`을 `canonical/source-sha256.txt`에 고정.
- source patch exact replay와 071 canonical byte parity PASS. 좋아요 aggregate 065는 별도 곡별 CAS 유지, 059/064 legacy full shared writer는 PREVIEW 070에서 차단 유지.
- 주의: 071은 공개·재공개 경로 방어이며, 과거 1→0을 **어떤 라이브 writer가 마지막으로 발생시켰는지** 시점 로그로 확정하지 못함. 구형 TEST/PRODUCTION Worker의 shared writer 위험은 여전히 별도 승격 게이트.

### 검증 / 현재 배포
- 최종 TEMP 145 Run `35490609131` **SUCCESS**: 123·124 선행 회귀, 125 최초 공유 refresh 유효성·실패 후 재시도, 071 canonical count=1 보존/정상 unlike=0/원본 부재 시 쓰기 차단, 070 private+like CAS, TypeScript lint, 앱 Build, Worker dry-run. 실제 Worker 배포 0.
- 최종 테스트 시점의 고정 제품 코드는 app125/Worker071 후보이나 **라이브는 app124 / Worker070 `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf` 그대로**. TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 변경 없음. Firebase Hosting/Functions/Rules 배포 없음.
- Work 독립 감사, 앱125 PC/모바일 실사용, 신규 mutation D1 W1~W2 실측은 **미검증**. 071은 공개·재공개에 대상별 D1 조회가 추가되므로 요청당 읽기 비용은 별도 검증 필요.
- 기존 비공개 곡은 비공개 유지. TEST/PRODUCTION 승격 중단. 이후 PREVIEW 실배포는 사용자 명시적 프리뷰배포 지시를 받아 별도 진행.

## 0AY. 사용자 app124 업데이트 후 좋아요 0/1 회귀 — live D1↔R2 4곡 FAIL / 배포·승격 중단

2026-09-20 KST 사용자 제공 약 69초 PC 영상에서 Explore 추천·최신·인기 탭 전환 시 같은 곡의 숫자가 일부 0↔1로 달라지고, 채워진 하트와 숫자가 서로 맞지 않는 실사용 증상 확인. 이번 확인은 read-only이며 사용자 좋아요를 임의로 누르거나 해제하지 않음.

### live read-only audit
- TEMP 143 Run `35488556374` SUCCESS (진단 실행 성공, **서비스 정합성 FAIL**).
  - shared v112 latest/popular 37곡 각각: nonzero 18, 같은 곡끼리 숫자 mismatch 0.
  - PREVIEW local latest/popular 37곡 각각: nonzero 18, 정렬 간 mismatch 0.
  - 실제 PREVIEW R2-only Feed latest/popular: 각각 37, shared와 숫자 mismatch 0.
  - canonical D1 `tracks + track_stats.like_count` 대조 37곡 중 **네 곡이 canonical=1, latest=0, popular=0**. SHA10 `9fef3a2199`, `abd7763bc1`, `ab0e6f139f`, `0e5cd08e2a`.
- 확장 TEMP 143 Run `35488673580` SUCCESS:
  - 동일 4곡에 대해 TEST local latest/popular와 PRODUCTION local latest/popular는 **모두 1**.
  - 해당 곡별 shared track-card R2 v115도 **모두 1**.
  - PREVIEW local 및 shared v112 latest/popular만 0.
  - 모든 감사에서 D1/R2 write 0, deploy 0, Firebase 비변경.
- 2026-09-18 `0AB/0AD`에서 동일한 상단 4곡의 canonical=1/shared=0을 진단하고 Run `35345067282`로 shared latest 4곡을 0→1 복구한 기록이 있다. **이번 관측은 동일 오류의 재발**이며 이전 일회성 R2 복구가 영구 해결책이 아님을 보여준다.

### 원인 범위 / 확정하지 않은 부분
- **입증:** 사용자 원본 카운트는 정상 1이고, PREVIEW local+shared first-page Feed의 파생 카운트만 0. TEST/PRODUCTION local과 shared track-card는 정상 1.
- 영상의 인기 1과 추천·최신 0은 **기기별/정렬별 last-known Feed 캐시가 서로 다른 값**을 계속 표시할 수 있는 app124 설계와 부합. app124의 one-time repair marker는 이미 완료되면 다음 업데이트에 같은 snapshot 재읽기를 강제하지 않는다. 원본 shared가 0이므로 단순 앱 재조회로 정상화될 수 없음.
- **미입증:** 어느 요청/Worker가 공용 Feed의 1을 마지막으로 0으로 되돌렸는지. TEST/PRODUCTION local은 모두 1이므로 구형 full-mirror가 0으로 덮었다고 단정 금지. PREVIEW 043/069/070 경로, 056/065 aggregate, 064 및 다른 writer의 실제 실행 순서/metadata 추가 감사 필요.
- 070 배포의 기존 검증은 단순 Feed smoke, revision R0/W0, private-track absent만 확인했고 canonical vs shared **좋아요 숫자 parity를 검사하지 않았음**. 배포 자체 PASS와 별개로 현재 좋아요 품질은 FAIL이다.

### 즉시 게이트
- PREVIEW 추가 배포 및 TEST/PRODUCTION 승격 **중단**. 기존 비공개 곡은 계속 비공개. 불명확한 원인 상태에서 cache 전체 rebuild/앱 버전 증가/원본 D1 수정/old Worker rollback 금지.
- 네 곡만의 shared R2 복구를 반복하기 전에 **1→0 역전의 쓰기 경로**부터 증명하고 O(1) 보호를 구현/독립 감사한다. 복구 실행은 이후 bounded trackId + canonical guard + ETag CAS로 별도 승인/검증.
- 좋아요 1회 D1 rows_written W1~W2는 여전히 실측 미검증. 신규 LIKE mutation 테스트는 현 단계에서 하지 않음.
- 정상 캐시 0-read 목표와 기존 UI 유지. 점검 도구는 가능한 기존 관리자 진단/기존 verifier 재사용. 사용자에게 불필요한 조작 요구 금지.

## 0AX. PREVIEW 069/070 Worker 배포 완료 — live f0a910a4 / app 124 / R0W0 / private 37 유지

2026-09-20 KST, 사용자의 명시적 **프리뷰 배포** 승인으로 고정된 069/070 canonical Worker를 PREVIEW에 배포했다.

### 배포
- release source target: `dc95856ad8299b3ed8746b2fd4d2dbdd574cda4b`.
- release trigger commit: `fc451c5d160d945005da9fb9985a15e52cb614cf`.
- canonical Worker SHA256: `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- PREVIEW Worker Release Run `35457463038` — **SUCCESS**.
- previous PREVIEW Worker: `4f8471e3-576f-49de-9f2c-c3863021bf3d`.
- current PREVIEW Worker: `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase Hosting/Functions/Rules 재배포 없음. 앱 버전 124 유지.

### release preflight / smoke
- LIVE like D1 schema PASS, pending035=0, pending069=0.
- publication PK index plan PASS.
- canonical hash exact PASS.
- pre-deploy pending 069=0.
- Feed smoke PASS, Profile smoke PASS.
- warm revision D1 `R0/W0`, mode `HEAD-ONLY-036` PASS.
- fixed like cron disabled / Durable Object event scheduler PASS.
- TEST/PRODUCTION Worker non-mutation PASS.

### postflight — TEMP 142 Run `35457550389` SUCCESS
- `https://preview.soridraw.com/` HTTP 200.
- `app-version.json=124`.
- live PREVIEW latest/popular R2 snapshot requests: D1 `R0/W0` PASS.
- live Worker exact version `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`.
- known private target SHA10 `1319e4479e` remains D1 private.
- PREVIEW local latest/popular = 37/37, private target absent.
- shared v112 latest/popular = 37/37, private target absent.
- postflight D1 write 0, R2 write 0, Firebase write 0.
- TEMP 142 workflow는 검증 후 삭제 완료.

### 남은 게이트
- PREVIEW 069/070 배포 자체는 완료.
- TEST/PRODUCTION은 아직 구형 059/064 전체 snapshot writer를 포함한 Worker 버전 유지. 현재 known private 곡의 local stale cache는 0AW에서 37/37로 수리했지만, 장기 구조 보호는 TEST→PRODUCTION 승격 전까지 완전하지 않다.
- 사용자의 **테스트배포** 승인 전 main/TEST 승격 금지.
- PRODUCTION은 TEST 전체 검증 후 사용자의 명확한 정식배포 승인 전까지 금지.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF 유지.
- 실제 사용자 mutation 요청당 D1 `W1~W2`는 아직 미검증. W3+면 FAIL.
- 기존 private 곡은 계속 비공개 유지.

## 0AW. cross-env 실상 확인 + 현재 비공개 1곡 stale local cache 수리 PASS / 장기 재오염 차단은 코드 승격 필요

2026-09-19 KST, 070 승격 전 실제 TEST/PRODUCTION Cloudflare 설정과 환경별 first-page R2 캐시를 읽기 전용으로 감사하고, 확인된 **현재 비공개 1곡만** 파생 캐시에서 조건부 수리했다.

### 실제 환경 설정 — TEMP 139 Run `35452733928` SUCCESS
- 070 canonical SHA `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000` pin PASS.
- TEST live bindings:
  - `DB:soridraw-explore-db` 공유 canonical.
  - `RATE_DB:soridraw-explore-test-db`.
  - `PROFILE_MEDIA:soridraw-profile-media` 공유 canonical.
  - `EXPLORE_CACHE:soridraw-profile-media-test` 환경별 캐시.
- PRODUCTION live bindings:
  - `DB:soridraw-explore-db`.
  - `PROFILE_MEDIA:soridraw-profile-media`.
  - **별도 EXPLORE_CACHE 없음 → PROFILE_MEDIA fallback**.
- 동일 070 canonical Worker를 현재 TEST/PRODUCTION live binding으로 재구성한 `release-worker-runtime.mjs <env> dry-run`이 둘 다 PASS. TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`는 전후 불변. D1/R2/Firebase write 0.
- 따라서 070 코드 자체는 현재 TEST/PRODUCTION 바인딩과 배포 형식상 호환되지만, **dry-run은 승격 승인 또는 실배포가 아니다**.

### stale cache 실측 — TEMP 140 Run `35452779963` SUCCESS (read-only)
대상은 D1 `is_public=0`, catalog `public=false`, 식별 SHA10 `1319e4479e`로 재확인.
- PREVIEW local latest/popular: 37/37, 대상 없음.
- TEST local latest/popular: **38/38, 대상 private 곡 존재**.
- PRODUCTION local latest/popular: **38/38, 대상 private 곡 존재**.
- shared v112 latest/popular: 37/37, 대상 없음.
- 즉 0AT의 재오염 위험은 이론이 아니라 **실제 TEST/PRODUCTION stale local snapshot 존재로 확인**됨.
- read-only 감사에서 D1/R2 write 0, deploy 0.

### 현재 비공개 1곡만 local cache 수리 — TEMP 141 Run `35452879050` SUCCESS
canonical D1 private 및 catalog private guard를 매 CAS 재시도 전에 확인하고, 다른 곡/원본 데이터 변경 금지 조건으로 실행.
- TEST local latest: **38→37**, target-only remove.
- TEST local popular: **38→37**, target-only remove.
- PRODUCTION local latest: **38→37**, target-only remove.
- PRODUCTION local popular: **38→37**, target-only remove.
- PREVIEW local latest/popular 및 shared v112는 이미 37이므로 변경 없음.
- postflight: PREVIEW / TEST / PRODUCTION local + shared latest/popular **8개 모두 37곡, private target absent PASS**.
- canonical D1 write 0, user-origin write 0. 실제 변경은 환경별 파생 first-page R2 4개에서 private ID 한 건 제거뿐.
- 이는 대량변환/Feed rebuild가 아니라 이미 확인된 single private target에 대한 bounded derived cache repair.

### 남은 차단 조건
- **현재 곡의 즉시 재오염 재료는 제거했지만 구조적 문제는 남음.** 라이브 TEST/PRODUCTION Worker는 아직 구형 059/064 전체 snapshot writer를 실행할 수 있다.
- 다음에 PREVIEW에서 다른 곡을 private로 바꾸면 TEST/PRODUCTION local cache는 다시 stale이 될 수 있고, 구형 Worker가 shared v112를 덮어쓸 수 있다.
- 따라서 070을 PREVIEW에 배포하고 새 private/republish 실사용 검증으로 넘어가기 전에, 정상 릴리스 순서상 TEST 및 최종 PRODUCTION까지 070 writer guard가 승격되어야 장기 재오염 방지를 보장할 수 있다.
- TEST 승격은 사용자의 명시적 테스트배포 승인 필요. PRODUCTION은 그 후 TEST 검증 완료 + 사용자의 명확한 정식배포 승인 전에는 절대 배포하지 않는다.
- catalog READ / FIRST_PUBLISHER OFF 유지. 실제 mutation D1 W1~W2는 아직 미검증.

## 0AV. 070 PREVIEW 코드: 구형 shared Feed 전체 덮어쓰기 차단 + 좋아요 CAS 검증 PASS / 환경 간 보안 게이트 유지

2026-09-19 KST, 사용자 지시로 0AT 재오염 원인의 PREVIEW 코드 측면을 수정했다. **변경 범위는 GitHub preview만이며 실제 Worker 배포, 사용자 원본/파생 R2 원격 수정, TEST/PRODUCTION 코드 변경은 하지 않았다.**

### 070 변경 및 고정
- 추가 `cloudflare/explore-worker/patches/070-shared-feed-legacy-writer-guard.mjs`: 069 통합을 전제하고 `mirrorExploreSharedFeeds059`와 `mirrorExploreSharedFeedAfterDerivedSync064`의 옛 전체 snapshot put을 명시적으로 비활성화. snapshot 신규 bootstrap은 별도 승인된 복구 경로로 제한한다.
- 동일 070에서 `patchSharedFeedLikeCounts065`의 shared latest/popular 쓰기를 ETag 조건부 CAS, 최대 8회 재시도로 변경. 비공개 처리와 좋아요 집계가 동시에 발생해도 오래된 전체 body로 비공개 곡을 되살리지 않도록 충돌 이후 새 snapshot 재조회. 기존 shared track-card like patch 유지. 신규 D1 read/write 없음.
- canonical `cloudflare/explore-worker/canonical/preview-worker.js`에 정확히 반영: product commit `2720607faa9ede08221e4b9a15c5a30967c622bc`.
- 신규 Worker SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`. `canonical/source-sha256.txt` pin commit `ffb97fe94e80ca28ccf64548677a94eae5c01e18`.
- 신규 `scripts/verify-070-shared-feed-guard.mjs`: 옛 두 함수 내 put 부재와 concurrent private/like CAS 재시도·card path/무 D1 확인.

### 검증
- TEMP 138 Run `35451832456` — PASS: 070 patch, legacy mirror disable, concurrent private/like race, track-card patch, no D1 (offline).
- TEMP 138 최종 Run `35451900664` — **SUCCESS**:
  - 070 소스 패치 결과와 canonical Worker byte-for-byte 일치 PASS.
  - Worker SHA256 exact PASS.
  - 070 관련 회귀 테스트 PASS.
  - TypeScript `npm run lint` PASS, Vite `npm run build` PASS, Wrangler PREVIEW Worker `--dry-run` PASS.
  - 원격 D1/R2 원본 또는 파생 데이터 쓰기 0, 배포 0.
- 이전 069 회귀 PASS Run `35450819828` 유지. 070은 069 active targeted helper 자체를 변경하지 않음.

### **중요: 모든 환경 재오염 방지 보장 = 여전히 FAIL**
- PREVIEW **코드만** 059/064 전체 덮어쓰기를 차단했다. 실제 라이브 PREVIEW Worker는 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`로, 069/070 미배포.
- 실제 TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` Worker에는 059/064 무조건 덮어쓰기 경로가 남아 있다. PREVIEW만 배포해도 다른 환경이 기존 shared v112 데이터를 되오염시킬 위험은 제거되지 않는다.
- 전체 환경의 공용 캐시에 대해 즉시 완전한 보호가 필요하다면, 안전한 순서로 TEST/PRODUCTION 구형 writer까지 차단하는 승격 계획을 제시하고 사용자의 명확한 PRODUCTION 승인 이후 처리해야 한다. PRODUCTION 무단 배포 금지.
- TEST/PRODUCTION과 원본 사용자 데이터는 그대로. shared latest/popular 비공개 곡 37/37 부재 Run `35451509693`는 단일 시점만 PASS.
- catalog READ / FIRST_PUBLISHER OFF 유지. D1 mutation W1~W2 실제 행 쓰기 미검증. PC/모바일 실사용 검증 전. 라이브 캐시 cold 최초 진입/복구 회귀 별도 검증 필요.
- 이전 배포 보류 게이트 유지. 신규 070을 완료된 서비스 수정으로 보고하지 않는다.

## 0AU. 단일 비공개 곡 shared R2 점검 PASS — 자동 수렴 관측 / 재오염 위험 유지

2026-09-19 KST, 사용자 요청에 따라 TEMP 137 Run `35451509693`에서 **실제 비공개 1곡에 한정**한 remote shared R2 조건부 복구를 진행했다. 고정 D1 timestamp `1789829348623`와 식별 해시 `1319e4479e`를 사전/사후로 검증했다.

- D1 해당 곡 `is_public=0`·`updated_at` 불변 PASS.
- R2 catalog `public=false`·marker 0 guard PASS.
- shared latest/popular 각각 **37→37**, 해당 곡 부재: PASS. 이미 37곡으로 수렴해 있어 **이번 검사에서 실제 shared R2 put 0회** (`changed=false` 두 번). 이전 38곡을 누가 언제 37곡으로 수렴시켰는지는 증명되지 않으며, 064의 catch-up 등은 가능한 설명일 뿐이다.
- 대상 외 곡 변경 0, canonical D1 write 0, 배포 0, Firebase 변경 0. 다른 환경 실사용/캐시 재방문 검증 전.
- 이 결과는 **특정 시점의 shared 캐시 정합성**만 나타낸다. 0AT 감사 FAIL인 구형 059/064 전체 overwrite 경로가 계속 있으므로 재오염 방지 구조는 해결되지 않았다.
- 069 PREVIEW 제품 소스와 sha pin은 유지하며 미배포. READ/FIRST_PUBLISHER 계속 OFF, TEST/PRODUCTION 배포 금지. 별도 승인 없는 데이터 원본 수정을 하지 않는다.

## 0AT. 069 배포 전 독립 코드 감사 — FAIL, PREVIEW 배포 보류

2026-09-19 KST, 069 코드/리그레션 감사를 실제 `preview`, `main`, `production` canonical Worker 소스와 대조했다. 069 개별 동작 테스트 PASS는 유지되나 **환경 간 shared R2 재오염 방지 조건은 FAIL**.

- `preview`의 `059-shared-feed-r2-parity.mjs` 내 `mirrorExploreSharedFeeds059`는 environment-local latest/popular snapshot 전체를 shared R2 v112에 무조건 덮어쓴다. `064-shared-feed-catchup-convergence.mjs` 또한 local/shared body가 다르면 전체 body를 무조건 덮어쓴다.
- 현재 `main` canonical Worker와 `production` canonical Worker에도 059/064가 포함되어 있고 069는 없다(각 protected branch 확인). 환경별 과거 local snapshot에 비공개 곡이 남아 있을 경우 이들 경로가 shared snapshot에 재삽입할 수 있다.
- PREVIEW 069의 해당 곡 조건부 R2 제거는 **자체 호출만 보호**하므로 구버전 059/064의 무조건 overwrite를 막지 못한다. `catalogAllowsSharedMutation069`도 구버전에는 없다.
- 이전 TEMP 136 offline PASS, source SHA pin은 변경하지 않았다. 이는 제품이 모든 환경에서 안전하다는 판정이 아니다.
- **배포 보류:** READ cutover, TEST/PRODUCTION 승격뿐 아니라 PREVIEW 069 배포도 구버전 shared writers 무력화/환경 분리/안전한 계층 정리 전까지 중단한다. PRODUCTION 무단 코드 변경 금지.
- 사용자 원본 D1에는 조치하지 않는다. 기존 노출 위험에 대한 피해 축소는 별도 bounded derived R2 private-track-only repair + 후속 reappearance 감시로 제한한다. 다른 환경 재오염 위험을 제거했다고 보고하지 않는다.

## 0AS. PREVIEW 069 shared Feed targeted parity 코드 반영 + 오프라인 검증 PASS / 배포·기존 stale 복구 전

2026-09-19 KST, 사용자 요청으로 비공개 실사용 실패 `0AR`을 보수적으로 코드 수정했다. **이 항목은 GitHub 코드·오프라인 검증 완료일 뿐 PREVIEW 배포 또는 실사용 복구 완료가 아니다.** 사용자의 기존 비공개 곡은 그대로 유지한다.

### 원인과 수정
- 원인: 실제 Music Note 경로는 `043`의 `syncExploreFeedR2Private043` 등을 사용하지만 `059`는 구형 `017` 경로만 shared Feed에 mirror함. 따라서 canonical D1 및 catalog가 private를 반영해도 shared latest/popular v112 스냅샷에 곡이 남았다.
- 새 `cloudflare/explore-worker/runtime/shared-feed-targeted-069.js`: shared latest/popular 두 개에서 **대상 trackId만** 제거·복구·옵션 수정. R2 ETag 조건부 쓰기, 충돌 시 최대 8회 재시도, 무변경 시 쓰기 0, catalog 활성 시 meta public/private 상태 guard, D1 read/write 0. 다른 곡을 포함한 전체 Feed 재생성·사용자 원본 수정 금지.
- 새 `cloudflare/explore-worker/patches/069-shared-feed-targeted-parity.mjs`: 구형 017이 아닌 **실사용 043 publish/private/options** 세 경로에 연동. 기존 canonical mutation 성공 여부와 R2 실패를 분리하여 사용자 원본 저장 결과는 보존하고 derived 실패는 경고로 남김.
- `cloudflare/explore-worker/canonical/preview-worker.js`: 위 069 patch를 실제 릴리스가 사용하는 canonical 파일에도 정확히 반영. 기존 068 제품 기반에서만 새 동작 추가.
- `cloudflare/explore-worker/canonical/source-sha256.txt`: 새 코드 SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`.
- `scripts/verify-069-shared-feed-targeted.mjs`: private 단일 항목 제거/재요청 무쓰기, republish, 늦게 도착한 private 차단, option patch, 동시 쓰기 충돌 시 타 항목 보존, malformed catalog fail-closed 검증.

### 검증
- 처음 TEMP 136 Run `35450515141` FAILURE는 테스트 fixture의 잘못된 sort 인자 오류. 수정 후 Run `35450556280`에서 069 unit/integration, TypeScript/Build PASS; 마지막 `git status`가 빌드 생성 파일을 변경으로 처리하여 전체 실패. 제품 로직 실패 아님.
- 최종 TEMP 136 Run `35450819828` **SUCCESS**:
  - 069 unit test 7 checks PASS (private/republish/options/late-private/CAS/malformed/no D1).
  - 기존 068 canonical 파일에 공식 069 patch를 적용한 결과와 신규 canonical 릴리스 파일이 byte-for-byte 동일 `cmp PASS`.
  - Worker source `node --check` PASS.
  - TypeScript `npm run lint` PASS.
  - Vite `npm run build` PASS.
  - Wrangler PREVIEW Worker `--dry-run` PASS. 실제 deploy **없음**.
  - source hash `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f` 확인.
  - 변경된 원본 데이터 0, D1/R2 read/write 0 (오프라인 검증에 한함).
- product source commit `62c5741d773183d3064bcd53dc70a74179aad535`; SHA pin commit `9e66770ab01e4028a49188f2a9b13ecb1c299a26`. 이후 상태 문서/임시 Workflow 정리 commit은 별도.
- Worker 실사용/API/PC·모바일 후속 검증 = **미수행**, 독립 Work 감사 = **미수행**.

### 아직 남은 위험 / 배포 경계
1. 라이브 PREVIEW Worker는 기존 `4f8471e3-576f-49de-9f2c-c3863021bf3d` 기준이며 이 069 수정은 아직 미배포. `main`/PRODUCTION 미승격, Firebase/Functions/Rules 변경 없음.
2. 이미 비공개로 저장된 곡은 **shared latest/popular v112 각 38곡에 남아 있던 기존 stale 상태**가 자동으로 지워지지 않는다. 새 코드의 다음 mutation만으로 기존 곡을 복구하겠다고 단정하지 않는다.
3. PREVIEW 배포는 사용자 별도 승인 후 고정 릴리스 절차에서 exact product SHA 및 source-sha256 검증, preflight, Worker 배포, 실제 endpoint 확인이 필요하다. TEST/PRODUCTION 승격 금지.
4. 기존 stale 객체 복구는 **비공개 해당 1곡**만 대상으로 최신 canonical is_public=0·catalog public=false·shared snapshot의 ID 존재를 read-only preflight 후, shared latest/popular에서 ID만 CAS로 제거하는 별도 승인된 bounded repair. D1 쓰기/전체 재구축 금지. 실행 후 모든 환경의 공개 응답 확인.
5. 실제 사용자 비공개·재공개·좋아요 요청당 D1 `rows_written` W1~W2는 아직 입증 안 됨. `W3+` 관측 시 FAIL. catalog READ 및 FIRST_PUBLISHER OFF 유지.
6. 기존 `059`/ `064` 등 다른 공유 snapshot 갱신 경로가 stale snapshot을 되돌리지 않는지 별도 독립 감사 필요.

## 0AR. 단일 실사용 비공개 원본 반영 PASS / 공유 Feed R2 stale FAIL — READ 전환·TEST 승격 중단

2026-09-19 KST 사용자가 PREVIEW의 기존 공개곡 1개를 비공개로 변경하고 Music Note 페이지를 이탈한 후 read-only postflight를 진행했다. 이번에는 실제로 **D1 원본 비공개 1건이 검출**되었다. 그러나 새 catalog는 비공개 반영에 성공한 반면 공유 Feed R2의 latest/popular 스냅샷에 이전 곡이 남는 **파생 캐시 불일치**가 검출됐다.

### TEMP 134 Run `35449942592` — FAIL (실제 parity 실패, 테스트 절차 성공)
- 2026-09-19T14:45:00Z 이후 D1 `tracks.updated_at` 변경: **1건**.
- 변경된 곡은 `is_public=0`, `updated_at=1789829348623` (2026-09-19T14:49:08.623Z).
- 대상 식별 로그는 SHA-256의 앞 10자리 `1319e4479e`로만 표기; 원본 ID 노출 없음.
- 해당 곡 R2 catalog meta: `public=false`, markerKeys 0 — **PASS**.
- shared latest v112 snapshot: 38곡, 해당 private 곡을 여전히 포함 — **FAIL**.
- 최근 좋아요 stats 변경 0.
- `LIVE_PARITY_MISMATCHES=1`이므로 top-level audit 실패 처리.

### TEMP 135 Run `35450000210` — FAIL (shared snapshots stale 지속)
- 실제 PREVIEW `/v1/feed?sort=latest&limit=40`: 37곡, private 곡 미노출; 최초 확인 D1 read 2/write 0.
- PREVIEW latest 진단용 R2 warm 경로: 37곡, private 곡 미노출; D1 R0/W0.
- 실제 PREVIEW 인기 피드와 진단용 인기 피드: 37곡, private 곡 미노출; D1 R0/W0.
- shared R2 `internal/explore/shared-feed-v112/latest-40.json`: 38곡, private 곡 포함 — **FAIL**.
- shared R2 `internal/explore/shared-feed-v112/popular-40.json`: 38곡, private 곡 포함 — **FAIL**.
- 따라서 현재 PREVIEW 첫 화면의 공개 응답은 private 곡 미노출이나, 다른 공유 캐시 소비자의 노출 안전성은 보장할 수 없음.

### 원인 추적 — 코드 근거
- `cloudflare/explore-worker/patches/043-publication-targeted-r2-hotpath.mjs`에서 Music Note 비공개 경로는 `syncExploreFeedR2Private043`를 호출한다.
- `cloudflare/explore-worker/patches/059-shared-feed-r2-parity.mjs`는 구형 `syncExploreFeedR2Private017`만 감싸서 `mirrorExploreSharedFeeds059`를 실행한다.
- 043 비공개 hotpath를 타면 059의 shared mirror가 직접 연결되지 않는다. 064 catch-up은 별도의 `syncDerivedCache032` 실행 시에만 작동한다.
- 043→059 연결 누락이 이번 live 불일치와 부합한다. 해당 호출/동시성 보호를 범위 최소 수정으로 감사해야 한다.

### 즉시 처리 경계
- 실사용 해당 곡은 **비공개 유지**. 사용자에게 재공개를 요구하지 않는다.
- 지금까지 이번 점검은 read-only: 데이터 강제 재생성/대량변환/D1 write/배포 없음.
- `SORIDRAW_R2_CATALOG_V1` WRITE ON, `SORIDRAW_R2_CATALOG_READ_V1` OFF, `SORIDRAW_R2_FIRST_PUBLISHER_V1` OFF 유지.
- **READ cutover·TEST·PRODUCTION 승격 모두 중단**.
- 우선 targeted shared latest/popular R2 동기화 누락 원인을 고치고 대상 private 곡에 한정한 안전한 파생 캐시 복구/검증 방식을 별도로 수립한다. D1 원본 덮어쓰기·전체 catalog/Feed 재생성 금지.
- 요청당 과거 D1 rows_written은 사후 DB 결과만으로 측정 불가. `W1~W2` 비용 합격은 미검증이며 관리자 요청별 계측 필요.
- GitHub `preview` 제품/Worker 코드는 이 실사용 점검에서 수정·배포하지 않았다.

## 0AQ. 실사용 mutation read-only 사후 점검 — 전송된 변경 미검출 / W1~W2 검증 보류

2026-09-19 KST, 사용자가 PREVIEW의 비공개→재공개 및 좋아요→해제를 수행했다고 알려준 뒤 독립 사후 점검을 실행했다. **검증 결과는 실사용 D1 쓰기 합격이 아니라, 관측 가능한 최근 원본 변경이 없었다는 것**이다. 해당 동작이 한 묶음에서 최종 원상복귀했거나 앱의 페이지 이탈 저장/좋아요 지연 처리가 아직 전송되지 않았을 가능성이 있으며, 현재 서버 결과만으로 어느 경우인지 단정하지 않는다.

- TEMP 132 Run `35449664860` — SUCCESS (점검 절차 자체 정상).
  - 2026-09-19T14:23:00Z 이후 tracks.updated_at 변경 기록: **0개**.
  - 같은 구간 track_stats.updated_at 변경 기록: **0개**.
  - like batch pending 035/066/069: **모두 0** (2026-09-19T14:44:55Z).
  - shared latest R2 항목: **38곡**.
  - mutation 대상 후보 0개여서 catalog/D1 실사용 변경분 대조는 **수행 불가**. `LIVE_PARITY_MISMATCHES=0`은 비교 후보 0건인 결과이지 실사용 PASS 증거가 아님.
  - PREVIEW latest/popular first page HTTP 200 / D1 R0/W0 유지.
  - 이번 점검에서 D1/R2 write 0, 배포 0.
- TEMP 133 Run `35449712958` — SUCCESS (D1 timestamp 형식 교차확인).
  - tracks 최근 `updated_at` 최대 = `1789736525205` → 2026-09-18T13:02:05.205Z.
  - track_stats 최근 `updated_at` 최대 = `1789728568148` → 2026-09-18T10:49:28.148Z.
  - likes 최근 `created_at` 최대 = `1789728550782` (이전 날짜).
  - timestamp는 밀리초이며 9월 19일 실사용 해당 변경을 나타내는 D1 기록 없음.
- 앱은 공개/비공개를 페이지 이탈 시 최종 상태로 묶고 좋아요도 지연/최종 상태로 묶으므로, 두 동작을 각각 전송되기 전에 반대로 변경하면 원본 D1 write=0이 정상일 수 있다. 이는 코드 기반 가능한 설명이며 사용자 브라우저 outbox 상태는 미확인.

### 다음 검증 방식 (실사용 작업 분리)
1. 사용자에게 PREVIEW에서 기존 공개곡 1개를 **비공개만** 누르고 Music Note 페이지를 벗어난 뒤 알려달라고 안내. 이때 해당 곡의 실제 D1 상태 전환/해당 catalog marker 삭제와 요청당 W1~W2를 점검.
2. 이후 별도로 **재공개만** 진행하고 페이지를 벗어나 저장 확인. 비공개와 재공개를 같은 outbox 묶음에서 처리하지 않는다.
3. 좋아요 1회는 30초 idle 묶음 전송과 Worker의 지연 합산(최대 약 10분)까지 기다려 확인한 뒤 해제 테스트를 별도로 수행.
4. 필요하면 사용자의 관리자 내부 진단 요청별 D1 쓰기 수 화면/기록을 받아 W1~W2 확인. 지금 사후 원본 상태만으로 과거 요청당 rows_written을 복원할 수 없음.
5. catalog READ/FIRST_PUBLISHER OFF 유지, TEST/PRODUCTION 승격 금지.

## 0AP. PREVIEW catalog WRITE staged ON + targeted R2 delta 검증 PASS / READ·FIRST_PUBLISHER OFF 유지

2026-09-19 KST, 사용자 승인으로 PREVIEW에서 `SORIDRAW_R2_CATALOG_V1=1`만 활성화하고 staged write 검증을 완료했다. catalog READ와 first-publisher는 계속 OFF이며, TEST/PRODUCTION/Firebase는 변경하지 않았다.

### PREVIEW staged WRITE 배포
- config commit: `ba723fb817aa2de99cf28821d85c48b4261455b8`.
- release trigger commit: `380b147125ee1cebc4f897fd7b4588784e69801c`.
- PREVIEW Worker Release Run `35448197594` — **SUCCESS**.
- previous PREVIEW Worker: `3678c1da-1bb5-4cfc-881f-6d1ad85a7fe0`.
- current PREVIEW Worker: `4f8471e3-576f-49de-9f2c-c3863021bf3d`.
- canonical Worker product SHA256 remains `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`.
- live binding: `SORIDRAW_R2_CATALOG_V1=1`.
- `SORIDRAW_R2_CATALOG_READ_V1` = OFF/absent.
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` = OFF/absent.
- PRE_DEPLOY_PENDING_069=0.
- warm revision D1 R0/W0 PASS.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase Hosting/Functions/Rules 재배포 없음.
- app version 124 unchanged.

### TEMP 131 — catalog targeted delta 검증
첫 Run `35448428321`:
- live WRITE ON / READ OFF / FIRST_PUBLISHER OFF PASS.
- 066/068 mutation integration contract PASS.
- 실제 shared derived R2 catalog에서 synthetic bounded mutation matrix 자체는 전부 PASS.
- postflight에서 신규 진단 query token을 사용한 첫-page probe가 실패하여 전체 Run은 failure.
- 제품 mutation 로직 실패가 아니라 postflight probe 조건 문제였고 synthetic object는 모두 cleanup되어 catalog baseline 432 복귀.

수정 후 Run `35448560216` — **SUCCESS**:
- catalog mutation integration contract PASS.
- 시작 catalog = 432, 종료 catalog = **432**.
- synthetic publish:
  - 해당 test track marker **8개만 추가** + meta.
- 동일 상태 republish:
  - `changed=false`; 추가 변경 0.
- synthetic like:
  - popular rank marker **1개 제거 + 1개 추가**.
  - 전체 catalog rebuild 없음.
- synthetic private:
  - 해당 track marker **8개만 제거**.
  - private tombstone meta만 유지.
- synthetic republish:
  - 해당 track marker **8개만 복구**.
- synthetic artist create:
  - name/handle marker 2개 + artist meta.
- synthetic profile nickname/handle edit:
  - 기존 marker **2개 제거 + 새 marker 2개 추가**.
- synthetic test object cleanup 후 catalog baseline **정확히 432** 복구.
- live latest first page = HTTP 200 / D1 R0/W0.
- live popular first page = HTTP 200 / D1 R0/W0.
- canonical D1 write = 0.
- D1 schema change = false.
- user origin data change = false.
- Firebase change = false.
- TEST/PRODUCTION change = false.
- protected Worker versions unchanged PASS.

### 현재 실제 상태
- PREVIEW catalog WRITE = **ON**.
- catalog READ = **OFF**.
- first-publisher = **OFF**.
- derived R2 catalog = **432 exact**.
- 전체 catalog rebuild 없이 changed track/profile marker만 움직이는 R2 delta contract = **PASS**.
- existing first-page latest/popular D1 R0/W0 = **PASS**.
- canonical shared D1 / user origin data = 비변경.
- TEST/PRODUCTION/Firebase = 비변경.
- 실제 로그인 사용자의 publish/private/like/profile edit에서 D1 W1~W2와 동일 delta가 함께 성립하는지는 **실사용 mutation 검증 전**.

### 다음 경계
1. PREVIEW 실제 로그인 계정에서 작은 실사용 mutation 세트를 확인:
   - 기존 공개곡 1개 private → republish.
   - 좋아요 1회 → 해제 1회.
   - 프로필은 실제 값 의미를 바꾸지 않는 범위에서 수정/복구가 가능할 때만 검증.
2. 각 행동의 D1 rows_written = W1~W2 hard gate 확인.
3. catalog 전체 432 rebuild 없음 + 해당 marker만 delta인지 확인.
4. 위 live authenticated mutation parity까지 PASS한 뒤에만 catalog READ ON을 별도 승인 대상으로 검토.
5. READ 전환 전까지 검색/deep-page는 기존 legacy 경로 유지.
6. FIRST_PUBLISHER와 shared canonical D1 partial-index/trigger Phase D는 계속 별도 승인 대상.

## 0AO. PREVIEW 068 배포 + derived R2 catalog 432 초기 구축 완료 / READ·WRITE flags OFF 유지

2026-09-19 KST, 사용자가 승인한 범위인 PREVIEW 068 Worker code-only 배포와 현재 공개곡 38곡 기준 derived R2 catalog 초기 구축을 완료했다. 사용자 원본 데이터나 canonical D1 schema/index/trigger는 변경하지 않았고, catalog READ/WRITE/first-publisher flags는 모두 OFF로 유지했다.

### PREVIEW 068 Worker 배포
- product target: `b07458d9d7db30a9c1a67c9f8e0beea8c3bdb78b`.
- release trigger commit: `2f60ef25878d6d669d5772413d0d9bb3f2987500`.
- PREVIEW Worker Release Run `35446460693` — **SUCCESS**.
- canonical Worker SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`.
- previous PREVIEW Worker: `32428130-3cc0-47d8-867c-787064943ce4`.
- current PREVIEW Worker: `3678c1da-1bb5-4cfc-881f-6d1ad85a7fe0`.
- PRE_DEPLOY_PENDING_069=0.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase Hosting/Functions/Rules 변경 없음.
- app version 124 unchanged.

### TEMP 130 — approved bounded catalog bootstrap
첫 실행 Run `35446868090`:
- missing shared profile 1개 bounded derived repair **PASS**.
- repaired profile의 canonical `public_profiles` row unchanged PASS.
- catalog preflight에서 shared track-card 누락을 발견해 중단.
- catalog object write 0.

두 번째 실행 Run `35447005464`:
- shared profiles 3/3 확인.
- shared track-card 실제 상태: **10 found / 28 missing**.
- 당시 guard가 최대 1개 repair만 허용해 bootstrap 전에 중단.
- catalog object write 0.

세 번째 실행 Run `35447123476` — **SUCCESS**:
- shared latest source = 38 tracks / 3 owners.
- shared profiles = 3/3.
- missing shared track-card 28개는 **shared latest만 source로 bounded derived repair**.
- repair 후 shared track-card = **38/38**.
- canonical D1 write = 0.
- user origin data change = false.
- catalog preflight:
  - existing catalog namespace = 0.
  - tracks = 38.
  - owners = 3.
  - expected objects = 432.
- 실제 catalog 구축 결과 = **정확히 432 objects**:
  - meta 38.
  - latest 38.
  - popular 38.
  - profile 38.
  - genre 21.
  - title 250.
  - artist meta 3.
  - artist name 3.
  - artist handle 3.
- catalog shared track-card coverage = 38/38.
- remote bootstrap dev process 종료 PASS.
- postflight:
  - `SORIDRAW_R2_CATALOG_V1` = OFF.
  - `SORIDRAW_R2_CATALOG_READ_V1` = OFF.
  - `SORIDRAW_R2_FIRST_PUBLISHER_V1` = OFF.
  - latest first page = D1 R0/W0.
  - popular first page = D1 R0/W0.
  - protected PREVIEW/TEST/PRODUCTION Worker versions unchanged during bootstrap.
  - D1 schema change = false.
  - canonical D1 write = 0.
  - Firebase change = false.
  - TEST/PRODUCTION change = false.

### 현재 실제 상태
- PREVIEW 068 Worker 배포 완료.
- derived R2 catalog 432 초기 구축 완료.
- shared profile coverage 3/3.
- shared track-card coverage 38/38.
- catalog READ/WRITE/first-publisher flags 전부 OFF.
- legacy latest/popular first page D1 R0/W0 유지.
- canonical shared D1 user rows/schema/index/trigger 변경 없음.
- Firebase 변경 없음.
- TEST/PRODUCTION 승격 없음.

### 다음 승인 경계
다음 단계는 자동 진행하지 않는다. 별도 사용자 승인 후 PREVIEW에서만:
1. `SORIDRAW_R2_CATALOG_V1=1` **write flag만** 켠다.
2. READ / FIRST_PUBLISHER flags는 OFF 유지한다.
3. 새 publish / private / republish / like / profile edit가 전체 rebuild 없이 changed item marker만 갱신하는지 검증한다.
4. D1 rows_written W1~W2 hard gate 유지.
5. catalog 432 전체 재생성 금지.
6. mutation parity와 비용 PASS 후에만 별도 단계에서 READ flag ON을 검토한다.
7. shared canonical D1 partial-index/trigger Phase D는 계속 별도 승인 대상이다.

## 0AN. Phase C catalog 실제상태 감사 + 068 artist parity 코드 준비 완료 / 배포·bootstrap 전

2026-09-19 KST, 067 좋아요 parity 복구 이후 원래 W2 publication Phase C 검증으로 복귀했다. 새 R2 catalog/search/deep-page 구조를 켜기 전에 실제 PREVIEW Cloudflare 설정, catalog 준비율, 현재 공개곡 전체 bootstrap 가능성을 read-only로 감사했고, catalog write 단독 ON 시 신규 publisher artist marker가 빠질 수 있는 경로를 068로 보강했다.

### TEMP 128 — live flag/binding/catalog read-only audit
- Run `35445222323` — **SUCCESS**.
- active PREVIEW Worker: `32428130-3cc0-47d8-867c-787064943ce4`.
- `DB` = shared canonical D1 PASS.
- `RATE_DB` = PREVIEW-only D1 PASS.
- `PROFILE_MEDIA` = shared R2 PASS.
- `EXPLORE_CACHE` = PREVIEW-only R2 PASS.
- `SORIDRAW_R2_CATALOG_V1` = OFF/absent.
- `SORIDRAW_R2_CATALOG_READ_V1` = OFF/absent.
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` = OFF/absent.
- canonical public tracks = **38**.
- public owners = **3**.
- latest 8곡 sample catalog meta = **0/8 present** → catalog incomplete.
- 기존 first-page shared R2 latest/popular = D1 R0/W0 PASS.
- D1/R2 write 0, deployment 0, user data change 0.
- TEMP 128 Workflow 완료 후 삭제.

### TEMP 129 — catalog bootstrap dry-run
첫 Run `35445359154`은 3 owner 중 shared profile v113 1개가 없어서 profile read 단계에서 중단했다. 쓰기/배포는 0.

보완 dry-run Run `35445458799` — **SUCCESS**:
- shared latest items = **38**.
- shared latest unique track IDs = **38**.
- canonical public track count = **38**.
- 따라서 현재 공개곡 38곡은 shared latest R2 하나로 전부 bootstrap source 확보 가능.
- current owners = 3.
- canonical public_profiles = 3.
- shared profile v113: **2 found / 1 missing**.
- critical track field:
  - missing owner UID = 0.
  - missing title = 0.
  - missing publishedAt = 0.
  - missing genre = **17**.
- genre가 없는 17곡은 현재 shared card에도 genre source가 없어 임의 추론하지 않음.
- 예상 catalog:
  - meta 38.
  - latest 38.
  - popular 38.
  - profile 38.
  - genre 21.
  - title 250.
  - artist meta 3.
  - artist name 3.
  - artist handle 3.
  - **총 unique R2 objects = 432**.
- track bootstrap에 전체 D1 track scan은 필요 없음. shared latest R2를 source로 사용 가능.
- creator search 완전성을 위해 missing shared profile 1개는 read cutover 전에 bounded derived-profile repair가 필요.
- 실제 catalog write 0 / D1 write 0 / user data change 0 / deployment 0.
- TEMP 129 Workflow 완료 후 삭제.

### 068 — catalog publication artist parity
발견한 위험:
- 066은 explicit profile edit와 first-publisher bootstrap에서는 artist marker를 갱신한다.
- 하지만 `catalog write=ON`, `first-publisher=OFF` 상태에서 established user의 local profile R2가 비어 있으면 shared profile을 재사용하지 못하고 profile D1 ensure 쪽으로 내려갈 수 있었다.
- 또한 brand-new catalog track 생성 시 이미 확보한 profile nickname/handle을 artist marker에 확실히 연결하는 보강이 필요했다.

068 수정:
- branch: `work/catalog-first-publisher-artist-parity`.
- patch: `068-catalog-publication-artist-parity.mjs`.
- catalog write mode가 ON이면 publication profile lookup이 local R2 실패 후 shared profile R2까지 확인.
- 새 track이고 dedicated first-publisher bootstrap이 아닌 경우, 이미 resolve된 `uid/nickname/handle`로 artist marker를 targeted sync.
- first-publisher 기존 artist sync와 explicit profile-edit artist sync는 그대로 유지.
- 새 D1 query/write/FTS 없음.
- D1 schema/UI/Firebase 변경 없음.

검증:
- 첫 validation Run `35445836603`: 068 자체 PASS 후 오래된 066 verifier의 “066 must be last patch” 조건 때문에 중단. 제품 로직 실패 아님.
- verifier 유지보수 후 최종 Run `35445896054` — **SUCCESS**.
- 068 contract PASS.
- 066/067/068 matrix PASS.
- Phase B in-memory catalog integration PASS.
- Music Note trackId stability PASS.
- shared Feed/profile/track-card/count convergence regressions PASS.
- TypeScript PASS.
- Build PASS.
- app version 124 unchanged.
- `EXTRA_D1_READ_WRITE_068=0`.
- canonical 068 SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`.
- materialized canonical commit: `aacf8b1f4b8c7774ffeb93635da36002076c1d3d`.
- validation Workflow 완료 후 삭제.
- PR #109 merge commit: `b07458d9d7db30a9c1a67c9f8e0beea8c3bdb78b`.

### 현재 실제 상태
- GitHub PREVIEW code에는 068 포함 완료.
- **068 Worker는 아직 PREVIEW에 재배포하지 않음.**
- live PREVIEW Worker는 계속 `32428130-3cc0-47d8-867c-787064943ce4` (067) 기준.
- catalog 432개는 아직 생성하지 않음.
- missing shared profile 1개도 아직 repair하지 않음.
- catalog write/read/first-publisher flags 전부 OFF 유지.
- shared canonical D1 schema/index/trigger/user rows 변경 없음.
- Firebase Hosting/Functions/Rules 변경 없음.
- main `f7fc25d5452b3313efa3cca53c180c5494cc9837` unchanged.
- production `e994340f3c4f6ac97f444f1ddf13053d3faffa71` unchanged.
- TEST/PRODUCTION 배포/승격 없음.

### 다음 승인 경계
다음 실제 단계부터는 사용자 승인 없이는 실행하지 않는다.
1. 068 canonical Worker를 PREVIEW에 code-only 배포.
2. read flag는 OFF 상태로 유지.
3. missing shared profile 1개만 bounded derived R2 repair.
4. 현재 38 public tracks를 shared latest R2 source로 catalog **432 derived R2 objects 초기 구축**.
5. 정확히 38 meta/latest/popular/profile, 21 genre, 250 title, 3 artist-meta/name/handle인지 검증.
6. bootstrap 완료 후에도 catalog READ flag는 자동 ON 금지.
7. 이후 write flag만 먼저 ON하여 새 publish/private/like/profile edit의 targeted delta를 PREVIEW에서 검증.
8. catalog completeness + mutation parity PASS 후 별도 단계에서 READ flag ON 검토.
9. first-publisher flag와 shared D1 partial-index/trigger Phase D는 계속 별도 승인 대상.

## 0AM. PREVIEW 067 좋아요 shared parity 배포 + stale latest 4곡 제한 복구 완료

2026-09-19 KST 사용자 승인으로 067 Worker PREVIEW 재배포와 기존 stale shared R2 likeCount 4곡의 제한 복구를 완료했다.

067 PREVIEW 재배포:
- approved product code target: `81c414de9983eeda2f2bd31f77810038b6a19387`.
- release trigger commit: `78b5f236ff0fa46afe5ad8603458c3de3bffa293`.
- PREVIEW Worker Release Run: `35438675995` — **SUCCESS**.
- canonical Worker SHA256: `35faf34dd9b8e564176cc88ee6ed149463de6275459e9f558067f234502474af`.
- previous PREVIEW Worker: `c177104b-be57-4e0b-9d41-3b8b817fdfb4`.
- current PREVIEW Worker: `32428130-3cc0-47d8-867c-787064943ce4`.
- Feed smoke PASS.
- public profile smoke PASS.
- warm revision D1 R0/W0 PASS.
- PRE_DEPLOY_PENDING_069=0.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase Hosting/Functions/Rules 재배포 없음.
- app version 124 unchanged.

기존 stale cache 제한 복구:
- 대상:
  - 한 걸음 비워둔 채로
  - Left Unsaid
  - Through the Night
  - 여기 잠시만
- canonical 기준은 복구 전/후 모두 relation=1, track_stats=1, derived=1.
- 초기 복구 시도 Run `35438823099`, `35438932946`, `35438982617`, `35439041268`, `35439118300`, `35439243737`는 **authorized repair 요청 전에 preflight/transport/readiness에서 중단**되어 D1/R2 write 0.
- 최종 TEMP 127 Run `35439421372` — **SUCCESS**.
- 실제 R2 object write: **1개**.
- shared latest: 4곡 `0 → 1` 수정.
- shared popular: 이미 1이라 write 0.
- shared track-card 4개: 이미 1이라 write 0.
- 전체 Feed rebuild/backfill 없음.
- canonical D1 write 0.
- D1 schema 변경 없음.
- 사용자 원본 데이터 변경 없음.
- Firebase 변경 없음.
- repair 중 PREVIEW/TEST/PRODUCTION Worker version 비변경 PASS.
- temporary remote dev repair process 종료 PASS.
- TEMP 127 Workflow 완료 후 삭제 commit: `fbc8cb7fe73f1633f8f66109a0899ff33b46f20a`.

복구 후 live 검증:
- latest R2-only API: 4곡 모두 likeCount=1, **D1 R0/W0**.
- popular R2-only API: 4곡 모두 likeCount=1, **D1 R0/W0**.
- canonical D1은 4곡 모두 relation/stat/derived=1 유지.
- 따라서 서버 원본 기준 추천/최신/인기 첫 페이지의 해당 4곡 likeCount 불일치는 해소됨.

현재 상태:
- 서버 측 likeCount parity: **PASS**.
- 067 active 075 targeted propagation이 이후 새 좋아요 변경에도 shared latest + popular + track-card를 변경된 곡만 패치하도록 배포됨.
- 사용자 PREVIEW PC/모바일 화면에서 추천/최신/인기 숫자 일관성은 **실사용 재확인 전**.
- main `f7fc25d5452b3313efa3cca53c180c5494cc9837` unchanged.
- production branch `e994340f3c4f6ac97f444f1ddf13053d3faffa71` unchanged.
- TEST/PRODUCTION 승격 없음.

다음:
1. 사용자가 PREVIEW에서 추천 → 최신 → 인기 → 다시 추천 순서로 확인.
2. 4곡 모두 하트 상태와 숫자 1이 탭 이동 전후 동일한지 확인.
3. 새 좋아요/해제 1회 테스트 시 약 1분 aggregate 이후 latest/popular가 같은 count로 수렴하는지 확인.
4. 위 PASS 후 원래 Phase C W2 publication 검증으로 복귀.
5. shared canonical D1 partial-index/trigger cutover는 Phase D이며 별도 사용자 승인 전 금지.

## 0AL. PREVIEW 좋아요 숫자 latest/popular 불일치 원인 확정 / 067 코드 수정 완료·재배포 전

2026-09-19 KST 사용자 PREVIEW 실사용 중 다음 버그를 확인했다.
- 추천/최신: 좋아요 하트는 채워져 있으나 4곡의 숫자가 0.
- 인기: 동일 4곡의 숫자가 1.
- 인기 탭에 갔다가 추천/최신으로 복귀하면 로컬 화면 숫자가 1로 보정됨.
- 정상 동작 아님.

읽기 전용 실제 데이터 감사:
- TEMP 126 Run `35437572116` SUCCESS.
- shared R2 latest:
  - 한 걸음 비워둔 채로 = 0
  - Left Unsaid = 0
  - Through the Night = 0
  - 여기 잠시만 = 0
- shared R2 popular: 동일 4곡 모두 1.
- live R2-only latest/popular API 모두 D1 R0/W0.
- canonical shared D1:
  - 위 4곡 relation_count = 1
  - track_stats.like_count = 1
  - explore_derived_tracks.likes = 1
- 따라서 canonical 정답은 1이고, shared latest R2만 stale 0이었다.
- 진단은 D1/R2 write 0, 사용자 데이터 변경 0, 배포 0.

원인:
- 현재 실제 좋아요 aggregate는 075 user queue + Durable Object event 경로를 사용.
- 075는 canonical D1 확정 후 environment R2 latest/popular/profile을 targeted patch.
- shared latest/popular/card를 targeted patch하는 065 helper는 legacy 035 aggregate 경계에만 연결되어 있었음.
- 따라서 active 075 경로에서 shared first-page Feed 숫자 전파가 누락될 수 있었고 실제로 latest=0 / popular=1 불일치가 발생.
- 앱의 하트 상태는 사용자 liked-state에서, 숫자는 shared Feed likeCount에서 오므로 하트=true / 숫자=0 조합이 가능했다.
- popular=1을 읽으면 app116의 same-track local convergence가 추천/최신 session cache도 1로 보정하여 탭 복귀 후 숫자가 1로 바뀌는 현상이 설명됨.

067 수정:
- branch: `work/like-075-shared-count-parity`.
- patch: `067-like-075-shared-count-parity.mjs`.
- active `processExploreLikeUserQueueWave075`가 이미 계산한 changedRows만 사용.
- 기존 local R2 feed/profile targeted patch 뒤에 기존 `patchSharedFeedLikeCounts065` 호출.
- shared latest + popular + shared track-card의 **변경된 곡만** 같은 likeCount로 패치.
- 전체 Feed rebuild/mirror 없음.
- 추가 D1 read/write 0.
- D1 schema/user row/Firebase/UI 변경 없음.

검증:
- Run `35437786780` SUCCESS.
- 067 contract PASS.
- shared latest targeted PASS.
- shared popular targeted PASS.
- shared track-card targeted PASS.
- EXTRA_D1_READ_WRITE=0.
- like/shared-cache regression matrix PASS.
- TypeScript PASS.
- Build PASS.
- app124 unchanged.
- canonical 067 SHA256: `35faf34dd9b8e564176cc88ee6ed149463de6275459e9f558067f234502474af`.
- materialized canonical commit: `82c2f45192bfcb0ea3ba3f5635b087c70244f880`.
- PR #108 merge commit: `81c414de9983eeda2f2bd31f77810038b6a19387`.

현재 상태:
- GitHub PREVIEW 코드에는 067 반영 완료.
- **067 Worker 재배포는 아직 하지 않음.**
- 현재 PREVIEW 실서비스 Worker는 이전 066 version `c177104b-be57-4e0b-9d41-3b8b817fdfb4` 유지.
- 따라서 사용자 화면의 stale latest=0은 재배포/derived-cache repair 전까지 남을 수 있음.
- TEST/PRODUCTION 비변경.

다음:
1. 사용자 명확한 PREVIEW 재배포 승인 후 067 canonical Worker만 배포.
2. 배포 후 새 좋아요 mutation에서 latest/popular/card targeted parity 확인.
3. 이미 stale인 위 4곡은 canonical D1을 원본으로 **해당 4곡만** shared derived R2에 bounded repair. 전체 Feed backfill/rebuild 금지.
4. repair 후 latest/popular R2 및 live API가 4곡 모두 1, D1 R0/W0인지 재검증.
5. 그 후에만 원래 Phase C/W2 검증으로 복귀.

## 0AK. PREVIEW Phase C 066 Worker code-only 배포 완료 / 실제 W2 cutover 전

2026-09-19 KST, 사용자의 명시적 '프리뷰 배포 진행' 요청으로 066 R2 ordered catalog/search/deep-page 코드를 PREVIEW Worker에 배포했다. 공유 canonical D1 index/trigger 변경은 이번 배포에 포함하지 않았다.

GitHub 및 배포 고정:
- Phase A+B PREVIEW merge: `a7c048b0fa68907f459500fe1b547bb4126e8813`.
- 066 canonical Worker generation validation Run: `35428253735` SUCCESS.
- canonical materialization commit: `7052f7e0239bbaf22908c8f1c7d29fffe759d277`.
- one-off 066 generator workflow cleanup commit: `0efb188573aca81c28897746c7dfcf273328cd03`.
- PR #107 merge: `7461200c559b2de306121924a13d82175fb4d77a`.
- locked deployment target: `7461200c559b2de306121924a13d82175fb4d77a`.
- release trigger commit: `7532e4d53c8cb02a8d07608379f4bca10da5d1ed`.
- canonical Worker SHA256: `47b13090e7515325b3bf190ffa1cc1685c10125d4726568930f5120e407cb23c`.
- PREVIEW Worker release Run: `35428391780` SUCCESS.
- before Worker version: `02561c62-5f1c-4449-b2e6-4253faddd099`.
- current PREVIEW Worker version: `c177104b-be57-4e0b-9d41-3b8b817fdfb4`.

Run 검증:
- exact target lock / canonical SHA / Worker syntax / existing Explore regression preflight PASS.
- live shared D1 like prerequisite schema/state SELECT preflight PASS; pending035=0 / pending069=0.
- publication PK lookup plan PASS.
- Worker deploy PASS; Feed smoke PASS; public profile smoke PASS.
- protected likes batch route unauthenticated 401 PASS.
- revision HEAD-only PASS; warm revision D1 R0/W0 PASS.
- fixed cron disabled / Durable Object event scheduler PASS.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged PASS.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged PASS.
- main `f7fc25d5452b3313efa3cca53c180c5494cc9837` unchanged.
- production branch `e994340f3c4f6ac97f444f1ddf13053d3faffa71` unchanged.
- Firebase Hosting/Functions/Rules, UI/CSS, app version **124** unchanged.
- Shared canonical D1 schema/index/trigger, user rows, actual PROFILE_MEDIA catalog backfill unchanged.
- No data migration/seed/backfill.

중요한 비용 상태:
- Phase B의 R0/W2 first-public, R1/W1 private, R1/W1 republish, R1/W0 noop는 RATE_DB 진단 후보 실측이며 아직 live shared canonical D1 수치가 아니다.
- 실제 shared D1 index/trigger는 아직 기존 구조이므로 live Music Note 첫 공개 W18 문제를 해결했다고 보고하지 않는다.
- 066의 catalog write/read/first-publisher 기능은 코드상 각각 별도 flag로 보호되며 기본 OFF. Cloudflare 기존 persisted vars의 실제 값과 실사용 mutation 경로는 별도로 확인 전이다.
- R2 catalog completeness를 증명하기 전 read flag 활성화 금지. 사용자 승인 없는 전체 catalog backfill 금지.
- 사용자 PREVIEW 실사용 PC/모바일 검증 전. `preview.soridraw.com` Hosting은 이전 app124 배포본을 유지했고 이번 Worker Release는 PREVIEW_ORIGIN 헤더로 Worker API를 검사했다. 별도 웹 도구로 Hosting URL 직접 fetch는 실패했으므로 이번 턴의 독립 Hosting 확인은 미검증.

다음 단계:
1. PREVIEW에 배포된 066의 runtime flag/binding 및 read-only route를 확인한다.
2. 사용자 테스트 계정으로 기존 기능을 보호한 채 search/deep-page/catalog completeness 및 first-publisher 위험을 단계별 검증한다. shared user data 대량 변경 금지.
3. 실제 shared D1 cutover는 Phase D, 사용자 별도 승인 전 금지. W3+이면 승격 중단.
4. TEST 승격 / PRODUCTION 승격은 각각 별도 사용자 승인과 검증 후 수행.

## 0AJ. W2 publication Phase B PASS / Phase A+B PREVIEW 코드 승격 완료

2026-09-19 KST 기준, Music Note publication D1 W1~W2 구조의 Phase A 구현 + Phase B 진단을 완료하고 검증본을 PREVIEW 코드 기준으로 승격했다.

GitHub:
- Phase A+B work branch: `work/publication-w2-r2-catalog-phase-a`
- Phase A product final before diagnostics: `1198c314000909a0fb5f954b7c3a9edcb8c6f13d`
- Phase B final diagnostics head: `39dbd86c313db3a8438083f0d6240d13e7a8511c`
- temporary diagnostic workflow cleanup commit: `3e35442b2e4aa3b86af414a3bcb4ed5a55708dbd`
- PR #106 merge commit: `a7c048b0fa68907f459500fe1b547bb4126e8813`
- PREVIEW app version: **124 unchanged**

Phase A 검증:
- Run `35410052082` — SUCCESS.
- R2 ordered catalog/search/deep paging guarded path PASS.
- first-publisher shared/local R2 bootstrap + retry-safe finalize PASS.
- latest/popular/profile 동일 rank/timestamp에서 기존 D1과 같은 `id DESC` ordering PASS.
- 112 shared Feed parity PASS.
- 113 shared profile parity PASS.
- 115 shared track-card R2 PASS.
- 116 public count convergence PASS.
- 063 public-profile warm Edge D1 R0/W0 PASS.
- derived-cache/cost regression PASS.
- TypeScript / Build PASS.

Phase B 최종 Run:
- Run `35427048164` — **SUCCESS**.
- R2 integration:
  - latest deep paging PASS.
  - popular deep paging PASS.
  - profile deep paging + pinned ordering PASS.
  - title search PASS.
  - genre search PASS.
  - artist nickname/handle search PASS.
  - like -> popular marker only PASS.
  - pin -> profile marker only PASS.
  - private/republish targeted marker PASS.
  - first-publisher retry idempotency PASS.
- Music Note trackId stability PASS:
  - client/Worker `music_note_${uid}_${sourceId}` deterministic.
  - retry/device/app-version independent.
  - outbox/cache same trackId preserved.
  - random/time/device input 없음.

RATE_DB production-shape candidate 실측:
- **FIRST PUBLIC: R0 / W2**
- **PRIVATE: R1 / W1**
- **REPUBLISH: R1 / W1**
- **NOOP: R1 / W0**
- legacy control: R2 / W15 — non-Music-Note 기존 index/trigger 비용 유지 확인.
- FTS INSERT: R0 / W1.
- FTS DELETE: R1 / W1.
- 따라서 publication hot path에 D1 FTS write를 붙이면 first public W3가 되어 hard gate 실패하므로 계속 금지.

안전:
- Phase B는 PREVIEW 전용 RATE_DB diagnostic tables/triggers만 생성 후 cleanup.
- shared canonical D1 write 0.
- 실제 사용자 데이터 write 0.
- PROFILE_MEDIA 실제 user catalog backfill 0.
- Firebase / Functions / Rules 변경 없음.
- UI/CSS 변경 없음.
- Worker/Hosting **배포 없음**.
- TEST/PRODUCTION 변경 없음.
- catalog write/read/first-publisher flags 기본 OFF 유지.
- temporary Phase B Workflow는 완료 후 제거됨.

독립 감사 결론:
- 기능 회귀: PASS.
- 비용 회귀: PASS.
- mutation O(1) / 전체 Feed-profile-search rebuild 없음.
- 기존 Music Note 60초 묶음 저장/UI/반응형 비변경.
- shared 사용자 데이터 하위호환 유지.
- Phase C 코드 기준으로 진행 가능.
- 단, 실제 shared D1 partial-index/trigger cutover는 **Phase D**이며 사용자 별도 승인 전 금지.
- 배포 요청이 없으므로 PREVIEW Worker/Firebase 배포는 아직 하지 않는다.

다음:
- `DOCS/NEXT_CODEX_TASK.md`의 Phase C 기준으로 PREVIEW 배포 전 검증 준비.
- 실제 PREVIEW Worker 배포는 사용자의 명확한 프리뷰배포 요청 후 진행.
- TEST 승격은 PREVIEW 실제 검증 완료 후 별도 승인.
- PRODUCTION은 명확한 정식배포 승인 전 금지.

## 0AI. W2 publication Phase A PASS / Phase B 진단 시작

2026-09-19 KST 기준, Music Note publication D1 W1~W2 구조의 **Phase A code-only 구현과 독립 재검토를 완료**했다.

고정 기준:
- 제품 PREVIEW baseline: `434696ac8fbb551c31e3af985273ded6a635e68a`
- Phase A 작업 branch: `work/publication-w2-r2-catalog-phase-a`
- Phase A 최종 commit: `1198c314000909a0fb5f954b7c3a9edcb8c6f13d`
- 최종 validation Run: `35410052082` — **SUCCESS**
- app version: **124 unchanged**

Phase A 구현:
- shared PROFILE_MEDIA R2에 ordered catalog v1 코드 추가.
- per-track meta + latest/popular/profile/genre/title marker.
- title marker는 normalized full title + bounded token, 최대 8개.
- artist nickname/handle marker.
- 기존 Explore 첫 페이지 shared R2 snapshot 보호.
- Explore 2페이지 이후 catalog 경로 + legacy D1 cursor fallback 유지.
- 공개프로필 첫 페이지 063 warm-edge 경로는 그대로 보호하고, 2페이지 요청에서 legacy cursor를 R2 profile catalog cursor로 해석.
- 검색 API `/v1/search?q=...` shape 유지:
  - 제목 token/prefix
  - 장르
  - artist nickname/handle -> uid -> 공개곡
- publication D1 FTS write는 새 catalog 경로에 추가하지 않음.
- 좋아요 변경은 해당 곡 popular marker만 이동.
- pin 변경은 해당 곡 profile marker만 이동.
- private는 해당 곡의 현재 marker만 제거.
- R2 catalog write 준비 flag / read cutover flag / first-publisher flag를 분리해 불완전 catalog가 사용자에게 노출되지 않도록 보호.
- 신규 first publisher는 D1 `public_profiles` 자동 INSERT 대신 최소 shared/local R2 profile bootstrap을 사용할 수 있는 guarded 경로 추가.
- 첫 공개가 D1 저장 뒤 R2 profile 반영 전에 끊겨 재시도돼도 bootstrap marker를 보존하고 첫 곡/trackCount를 정확히 복구한 뒤 shared profile을 finalize하도록 보강.
- ordered catalog 동점 tie-break도 기존 D1과 동일한 `id DESC`가 되도록 descending id sort segment 사용.
- 사용하지 않는 first-profile cursor helper 제거.

검증:
- `W2_R2_CATALOG_PHASE_A=PASS`
- 기존 112 shared Feed parity PASS.
- 기존 113 shared profile parity PASS.
- 기존 115 shared track-card R2 PASS.
- 기존 116 public count convergence PASS.
- 기존 063 public-profile warm Edge D1 R0/W0 보호 PASS.
- existing derived-cache/cost regression PASS.
- TypeScript PASS.
- Build PASS.
- UI/CSS 변경 없음.
- shared D1 schema/index/trigger 변경 없음.
- migration/backfill/user row rewrite 없음.
- Firebase/Functions/Rules 변경 없음.
- Worker/Hosting 배포 없음.
- TEST/PRODUCTION 변경 없음.
- feature flags 기본 OFF.

독립 재검토에서 수정한 항목:
- first-publisher helper가 실제 publication 본체에 연결되지 않았던 점을 발견해 retry-safe wiring 추가.
- first-publisher local R2 bootstrap marker가 기존 reader에서 소실될 수 있던 점을 보완.
- R2 ordered key의 동일 timestamp/rank tie에서 `id ASC`가 되던 문제를 발견해 기존 D1과 같은 `id DESC`로 수정.
- generic shared-profile write마다 artist marker를 확인하지 않고 첫 프로필 생성/명시적 프로필 편집에만 artist index를 갱신하도록 제한.
- catalog build와 read cutover를 별도 flag로 분리.

현재 상태:
- Phase A 코드는 아직 PREVIEW 제품 branch에 merge하지 않음.
- 현재 PREVIEW/TEST/PRODUCTION 실제 서비스 동작은 변경되지 않음.
- 배포 요청 없음 / 배포 없음.
- 다음 작업은 Phase B 진단이며 shared canonical D1 migration은 여전히 금지.

Phase B 합격선:
- RATE_DB/진단 schema에서 first public **W1~W2**, private **W1~W2**, republish **W1~W2**, noop **W0**.
- R2 title/genre/artist search + Explore/profile deep paging + like/private marker integration PASS.
- Music Note track id 안정성 verifier PASS.
- shared canonical D1 user row write 0.
- Work 기준 독립 감사 PASS.
- Phase B PASS 전 PREVIEW Worker 배포/TEST 승격/shared D1 cutover 금지.


## 0AH. W2 publication 구조설계 확정 / Phase A code-only 준비

2026-09-19 KST 기준, Music Note 첫 공개의 D1 `W18`을 절대 합격선 `W1~W2`로 내리기 위한 구조설계를 확정했다.

기준:
- 설계 시작 PREVIEW HEAD: `405cc43631d79db5d3cd7f36f4f8f32cb12b9140`
- 설계 문서: `DOCS/PUBLICATION_W2_R2_CATALOG_DESIGN.md`
- 설계 문서 commit: `1baadfecf5c26930ee6740eeb85ca18b17549e06`
- Phase A 작업지시 갱신 commit: `200f0bcd2e55bfa86b550dfbc2d0beffec47eaa9`

실측 근거:
- Run `35357007850` SUCCESS:
  - 현재와 같은 rowid `tracks` 형태에서 9개 explicit secondary index를 Music Note에서 제외한 진단 구조:
    - first insert `W2`
    - private `W1`
    - republish `W1`
    - noop `W0`
  - `WITHOUT ROWID` insert는 `W1`이었으나 목표 달성에 필수는 아님.
- Run `35357864011` SUCCESS:
  - FTS INSERT `W1`
  - FTS DELETE `W1`
  - 따라서 canonical first insert `W2` + D1 FTS `W1` = `W3`이므로 publication hot path에서 D1 FTS write 금지.
- Run `35356844574` SUCCESS:
  - live `tracks`는 9 explicit indexes + PK autoindex.
  - `track_search_fts`, `profile_search_fts` 별도 존재.
  - active runtime에서 `INDEXED BY idx_tracks_...` 강제 의존은 확인되지 않음.

확정 구조:
1. `tracks` 테이블/컬럼 계약은 그대로 유지한다. 공유 사용자 row를 새 테이블로 옮기지 않는다.
2. 최종 shared D1 cutover 후보는 Music Note만 9개 explicit secondary index 대상에서 제외하는 partial-index 구조다. Suno Library/legacy row는 기존 동작 유지.
3. Music Note publication에서 D1 `explore_derived_tracks` mirror 및 shared-revision write를 hot path에서 제외한다.
4. Explore latest/popular, public profile, track-card는 현재 shared R2 구조를 계속 사용한다.
5. 2페이지 이후 rank/pagination은 새 shared R2 ordered catalog로 옮긴다. 전체 Feed/profile 재생성 금지.
6. 검색 UI 계약 `/v1/search?q=...`는 유지하고 Worker 내부 source만 R2 catalog로 교체한다.
   - 제목 token/prefix
   - 장르
   - 아티스트 nickname/handle
   - publication 시 D1 FTS INSERT/DELETE 0
7. per-track R2 meta에 현재 marker key를 보관해 public/private/title/genre/pin/like 변경 시 해당 곡 marker만 이동한다.
8. 신규 사용자의 첫 공개에서 자동 `public_profiles` D1 INSERT가 hard gate를 넘기지 않도록, auth nickname/avatar 기반 최소 shared profile v113 bundle을 R2에 먼저 만드는 경로를 준비한다. 이후 사용자가 프로필을 직접 편집하면 기존 canonical profile edit가 D1에 materialize/update하고 shared R2를 교체한다.
9. 현재 first-public이 `ON CONFLICT(id)`를 사용해 PK idempotency를 제공하는 것은 확인했다. 다만 Music Note `source.id`의 기기/재시도 간 안정성은 partial unique-index cutover 전에 별도 verifier로 증명해야 한다.
10. `WITHOUT ROWID` 재구축은 현재 목표에 불필요하므로 채택하지 않는다.

R2 ordered catalog 초안:
- `internal/explore/catalog-v1/meta/<trackId>.json`
- `.../latest/<inversePublishedAt>/<trackId>.json`
- `.../popular/<inverseLikeCount>/<inversePublishedAt>/<trackId>.json`
- `.../profile/<uid>/<pinOrder>/<inversePublishedAt>/<trackId>.json`
- `.../genre/<normalizedGenre>/<inversePublishedAt>/<trackId>.json`
- `.../title/<normalizedToken>/<inversePublishedAt>/<trackId>.json`
- `.../artist/name/<normalizedNickname>/<uid>.json`
- `.../artist/handle/<normalizedHandle>/<uid>.json`

호환성:
- PREVIEW/main은 shared R2 043~065 구조 보유.
- PRODUCTION app117도 shared R2 043~064 구조 보유.
- shared profile v113은 UID direct read + handle alias read를 이미 지원한다.
- first page current shared R2 path는 보호하고, deep-page/search만 새 path를 병행 추가한다.
- legacy cursor/D1 fallback은 final cutover 전까지 제거하지 않는다.

진행 단계:
- Phase A: code-only R2 catalog/search/deep paging/first-publisher R2 profile/verifier 구현. **shared D1 변경/배포 없음.**
- Phase B: RATE_DB/진단 환경에서 production-shape partial index + trigger exclusion 실측, R2 integration test, Work 독립 감사.
- Phase C: 새 read path를 이해하는 코드를 PREVIEW → TEST → 명시적 승인 후 PRODUCTION까지 먼저 승격.
- Phase D: 사용자 별도 승인 후에만 shared D1 index/trigger cutover. user row delete/backfill/rewrite 금지.

현재 환경:
- PREVIEW app **124**
- TEST app **124 / TEST_VERIFIED**
- PRODUCTION app **117**
- 이 구조설계 작업에서 Firebase/Functions/Cloudflare Worker/shared D1/user data 배포·변경 없음.
- PRODUCTION 비변경.

다음 작업:
- `DOCS/NEXT_CODEX_TASK.md`의 Phase A code-only 범위대로 구현.
- Phase A 완료 전 shared D1 migration/index drop/create/trigger change 금지.
- Phase A/Phase B/Work 감사 전 TEST/PRODUCTION 승격 금지.


## 0AG. D1 mutation hard gate + publication W18 root cause confirmed

- User directive: D1 mutation `rows_written` must be **W1~W2** per one user action. `W3+` is unconditional FAIL, including first registration.
- TEST app124 remains deployed for testing but is **not PRODUCTION-eligible** until this gate is met.
- Read-only live shared-D1 audit Run `35352259068` — SUCCESS, `REMOTE_D1_WRITES=0`.
- Live `tracks` has 10 indexes total: 9 explicit + `sqlite_autoindex_tracks_1` primary-key index.
- First Music Note public registration observed `PAGE SYNC D1 R6/W18`.
- W18 exact write amplification:
  - canonical `tracks` INSERT: table 1 + 10 indexes = **W11**.
  - `explore032_track_insert` derived mirror INSERT into `explore_derived_tracks`: table 1 + PK index 1 + 3 rank indexes = **W5**.
  - `explore079_music_note_derived_track_insert` increments existing derived profile `track_count`: **W1**.
  - `soridraw_shared_rev_tracks_ai_051` increments `explore_shared_revision`: **W1**.
  - total **11 + 5 + 1 + 1 = W18**.
- Registered private transition observed `R3/W2`.
- W2 exact write path:
  - canonical `tracks` UPDATE of `is_public/updated_at`: **W1**; those columns are not in current tracks indexes.
  - `soridraw_shared_rev_tracks_au_051` revision UPDATE: **W1**.
  - visibility-only hot transition does not fire heavy `explore032_track_update` because `is_public/updated_at` are excluded from its UPDATE OF list.
- First-public R6 comes from the explicit publication-state/profile/stat pre-read plus row lookups inside the INSERT triggers; registered private has no standalone SELECT query but its write query still reads rows to locate/guard target/revision rows.
- Root cause is not repeated background polling. It is **write amplification caused by canonical indexes + automatic D1 derived mirror + shared revision trigger**.
- Current first-public architecture therefore fails the new absolute cost gate even though feature behavior is correct.
- Production promotion blocked until redesigned and live-verified at W1~W2.

## 0AF. TEST app 124 — PC+모바일 통과본 승격 완료 / PAGE SYNC 비용 감사

사용자가 PREVIEW app124를 PC·모바일 모두 정상 적용으로 통과 처리하고 TEST 배포를 승인했다.

TEST 승격:
- source PREVIEW SHA: `3010dd0609bdfab6d19bd52add604fa8ce57a1b0`
- preflight Run `35347397424` — **SUCCESS**
- TEST promotion Run `35347566331` — **SUCCESS / TEST_VERIFIED**
- promoted main SHA: `f7fc25d5452b3313efa3cca53c180c5494cc9837`
- TEST app version: **124**
- TEST Worker version: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`
- TEST manifest/tag: `soridraw-test-v124-3010dd0609bd`
- latest shared Feed parity PASS.
- popular shared Feed parity PASS.
- public profile parity PASS.
- TEST release environment parity PASS on attempt 1.
- PRODUCTION branch/Worker/Hosting 비변경.

PAGE SYNC 비용 감사:
- `src/lib/pageSyncCoordinator.ts`의 PAGE SYNC는 sync 시작 전/후 Cloudflare/Firestore 진단값의 차이만 기록한다.
- 따라서 `PAGE SYNC D1 R6 W18`, `R3 W2`는 가짜 숫자가 아니라 해당 sync 1회에서 실제 계측된 D1 billable row 수다.
- `Sync 3`, `Sync 4`는 누적 sync 횟수지만 D1 R/W 값은 마지막 sync의 delta다.
- pending change가 0이면 PAGE SYNC는 즉시 noop 처리하며 worker/D1/Firestore를 모두 0으로 기록한다. 페이지 이동 자체의 반복 누수 구조는 아님.
- publication flush는 local outbox의 최종 상태를 `/v1/me/music-note-publications/batch` 한 요청으로 묶는다.
- D1 diagnostics는 query count와 billable row count를 분리한다. 따라서 `D1 query R0/W1`이어도 하나의 UPDATE가 대상 row/index를 처리하면서 `행 R3/W2` 같은 값이 나올 수 있다.
- warm registered publication 변경은 guarded `UPDATE ... RETURNING`을 사용하고 canonical pre-read를 제거했다.
- unresolved/cold fallback에서만 bounded SELECT를 허용한다.
- public track_stats preflight는 제거되어 있다.
- `profile_pinned` indexed column은 실제 값이 변할 때만 UPDATE에 포함되어 불필요 index rewrite를 차단한다.
- visibility/options/updated_at-only hot transition은 heavy `explore_derived_tracks` mirror trigger 대상에서 제외되어 있다.
- 따라서 현재 관측값은 실제 변경에 따른 비용이며, 동일 요청 반복/전체 scan/페이지 이동 누수 증거는 확인되지 않았다.
- 비용을 더 낮출 수 있는 여지는 별도 최적화 주제로 감사할 수 있으나 현재 TEST 승격 차단 사유는 아님.

현재 환경:
- PREVIEW: app **124**
- TEST: app **124 / TEST_VERIFIED**
- PRODUCTION: app **117** 유지
- PRODUCTION 승격 승인 없음.

## 0AE. PREVIEW app 124 — PC/모바일 legacy mixed-count cache 1회 공통 복구 / 배포 완료

사용자 모바일 실사용에서 PC는 정상인데 모바일이 같은 4곡을 `0 / 1 / 0 / 0`으로 표시하는 현상을 확인했다.

확인된 구조:
- app123 서버 shared Feed 자체는 이미 4곡 모두 1로 복구된 상태.
- 모바일은 app122 시절 저장된 mixed-count 로컬 Feed 캐시를 보유.
- app123의 '마지막 정상 캐시 우선' 규칙이 그 오래된 모바일 캐시도 그대로 유지했기 때문에 PC/모바일 표시가 달라짐.
- 모바일 전용 UI 문제가 아니라 동일 코드에서 기기별 local cache 상태 차이 문제.

app124 수정:
- `src/pages/ExplorePage.tsx`에 `SORIDRAW_EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_20260918` 추가.
- legacy mixed-count Feed cache를 가진 기기에서 sort별 정확히 1회 current shared R2 snapshot을 직접 읽어 캐시를 교체.
- 이 1회 복구는 revision edge cache를 거치지 않고 current shared R2 first-page를 사용.
- route contract상 D1 read/write 0.
- 성공 후 localStorage marker를 남겨 이후 앱 업데이트/재진입에서는 같은 복구 read를 반복하지 않음.
- PC/모바일 분기 없음. 동일 ExplorePage 공통 경로.
- app123 last-known immediate render 규칙 유지.
- 30초 actor batch / 1분 shared aggregate / 2분 viewer activity gate 유지.
- UI/CSS/Worker runtime/Functions/Rules/D1 schema/user canonical data 변경 없음.

GitHub / 검증:
- 작업 branch: `work/app124-one-time-feed-cache-repair`
- 기준 PREVIEW: `6e63a491f2a4983b348c37d051c3882002e97a49`
- PR #105 merge commit: `929c02f8a235a8ef629ce85a8f0e28bfbaa04dfe`
- app version: **124**
- validation Run `35346359130` — **SUCCESS**
  - app124 common cache repair verifier PASS
  - TypeScript PASS
  - Build PASS
- 첫 validation Run `35346282776` 실패는 제품 코드가 아니라 verifier가 주석의 'mobile/PC' 단어를 device fork로 오인한 검사식 문제였고, 검사식 수정 후 최종 PASS.

PREVIEW 배포:
- deploy trigger commit: `ca05329c6004c2a47d05d1958915c1730436e1c2`
- Firebase PREVIEW Hosting Run `35346588474` — **SUCCESS**
- locked PREVIEW SHA: `ca05329c6004c2a47d05d1958915c1730436e1c2`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting deploy PASS
- `preview.soridraw.com` exact build PASS
- remote app version **124** PASS
- TEST / PRODUCTION unchanged PASS
- PREVIEW Worker는 app123 배포본 `02561c62-5f1c-4449-b2e6-4253faddd099` 그대로.

현재 환경:
- PREVIEW: app **124**
- TEST: app **122** 유지
- PRODUCTION: app **117** 유지

필수 다음 검증:
- 모바일에서 app124 업데이트 후 Explore 첫 화면이 4곡 모두 PC와 같은 `1`로 수렴하는지.
- 복구 완료 후 재진입에서는 같은 repair R2 read가 반복되지 않는지.
- 이후 새 좋아요/해제도 PC/모바일 공통 30초 batch → 1분 shared → 2분 viewer gate 구조로 동일하게 보이는지.
- 앞으로 Explore 변경은 PC + 모바일을 항상 같은 공통 검증 범위로 확인.

## 0AD. PREVIEW app 123 — Worker + shared R2 제한복구 + Firebase Hosting 배포 완료 / 실사용 검증 대기

2026-09-18 사용자 승인으로 app123 수정본을 PREVIEW까지 배포 완료했다.

배포 기준:
- app123 제품 merge: `edf80e7729323327802af205e42c5a462d049f0a`
- 최종 PREVIEW verifier 정렬 merge: `ad3b9e0fc19229fd34b7b94a8c38a796c3bfc3a7`
- PREVIEW Worker release trigger commit: `a3942176b84fbbaf8a4477b54708e8f106a54409`
- PREVIEW Hosting release commit: `bb6bd713f8ba2b942473ad7af56bf0861718204b`
- app version: **123**

Worker:
- Release Run `35344504551` — **SUCCESS**
- PREVIEW Worker version: `02561c62-5f1c-4449-b2e6-4253faddd099`
- canonical Worker SHA256: `312c28fe67af5c0bbd5639fa1a6230b53bd5cf12e165ca1f117e0e6552cbbfc3`
- Feed smoke PASS / Profile smoke PASS.
- revision HEAD-only D1 `R0/W0` PASS.
- like queue preflight: pending035=0 / pending069=0.
- fixed cron disabled PASS / Durable Object event scheduler PASS.
- TEST Worker `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0` 비변경.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 비변경.

기존 stale 4곡 shared 파생 캐시 제한 복구:
- Repair Run `35345067282` — **SUCCESS**.
- exact diagnosed 4 track IDs만 대상으로 canonical/relation/derived가 모두 1인지 재확인 후 실행.
- shared latest Feed: 4곡 `0 → 1` 수정.
- shared popular Feed: 4곡 모두 이미 1, write 0.
- shared track-card: 4곡 수정.
- shared public profile: 해당 owner 프로필 1개에서 4곡 수정.
- 실제 PREVIEW shared Feed API: 4곡 모두 1, source `SHARED-R2-GET-112`, D1 read 0.
- 실제 공개프로필 API: 4곡 모두 1, source `SHARED-R2-113`.
- D1 operation은 SELECT only, 사용자 canonical data write 0.
- migration/seed/backfill/delete 없음.
- 임시 repair Workflow/script는 작업 branch에서 삭제 완료; preview에는 추가하지 않음.

Firebase PREVIEW Hosting:
- Release Run `35345235634` — **SUCCESS**.
- locked source SHA: `bb6bd713f8ba2b942473ad7af56bf0861718204b`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting deploy PASS.
- `preview.soridraw.com` exact build PASS.
- remote `app-version.json` = **123** PASS.
- TEST / PRODUCTION Hosting 및 protected refs 비변경 PASS.

현재 기능 기준:
- 앱 업데이트/첫 진입 + 정상 Explore Feed 로컬 캐시 존재 시 last-known 좋아요 숫자를 즉시 표시.
- 앱 업데이트 자체로 revision/server read를 강제하지 않음.
- 실제 사용자 활동 + 2분 viewer gate에서만 revision 확인.
- actor 좋아요 UI 즉시 반영, 현재 app121 기준 30초 trailing batch 유지.
- server shared aggregate 1분 유지.
- aggregate 후 변경된 track만 shared latest/popular Feed + track-card R2 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- UI/CSS 변경 없음.
- Firebase Functions/Rules 변경 없음.

남은 검증:
- 코드/배포 검증은 완료.
- 사용자 PREVIEW 실사용 검증 전.
- PC/모바일에서 앱 업데이트 직후 숫자 유지, 좋아요/해제, 30초 batch, 약 1분 shared 반영, 다른 사용자 2분 activity gate, 공개프로필/Explore 일치 확인 필요.
- PREVIEW 실사용 통과 전 TEST 재승격 금지.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.

## 0AC. PREVIEW app 123 — 업데이트 캐시 유지 + shared 좋아요 숫자 targeted R2 repair / 검증 완료 / 배포 전

사용자 지시로 두 문제를 함께 수정했다.

1. 앱 업데이트 직후 좋아요 숫자 보존
- 정상 Explore Feed 로컬 캐시가 있으면 앱 버전 변경/첫 진입만으로 revision 확인을 강제하지 않는다.
- 업데이트 전 마지막 정상 좋아요 숫자를 즉시 그대로 표시한다.
- 첫 진입/재진입은 server read 0 목표를 유지한다.
- 실제 사용자 활동이 있고 기존 2분 activity gate가 열린 경우에만 revision을 확인한다.
- revision이 동일하면 로컬 캐시 유지.
- revision이 달라진 경우에만 shared Feed snapshot으로 교체.
- 새 기기/캐시 손상처럼 정상 로컬 캐시가 없는 경우만 최초 shared snapshot을 1회 받는다.
- Explore Feed persistent cache schema는 기존 3을 유지하며 app version과 분리.

2. shared Feed 좋아요 숫자 stale 문제
- 기존 진단에서 canonical/derived가 1인데 shared Feed v112만 0으로 남은 것이 확인됨.
- 056 public-like reconciliation이 실제 변경 row를 `changedItems`로 다음 단계에 전달하도록 보강.
- 새 release patch `065-shared-like-count-targeted.mjs` 추가.
- 좋아요 aggregate 완료 후 변경된 track ID + 최종 likeCount만 shared latest/popular Feed R2 bundle에서 패치.
- shared track-card R2도 같은 track만 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- 기존 059 full mirror, 060 shared profile parity, 064 catch-up은 유지.
- canonical Worker에 065 실제 생성 반영 및 source SHA 재고정.
- app version: **123**.

변경 파일:
- `src/pages/ExplorePage.tsx`
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- `cloudflare/explore-worker/patches/065-shared-like-count-targeted.mjs`
- `cloudflare/explore-worker/release-patches.json`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `public/app-version.json`
- `scripts/verify-123-shared-like-cache-repair.mjs`
- `scripts/verify-116-explore-public-count-convergence.mjs`
- `scripts/verify-112-shared-feed-parity.mjs`
- docs only.
- UI/CSS 변경 없음.

검증:
- 최종 validation Run `35342677962` — **SUCCESS**
  - canonical Worker 065 generation PASS
  - app123 verifier PASS
  - app116 public-count convergence regression PASS
  - app115 shared track-card PASS
  - app114 shared social PASS
  - app113 shared profile PASS
  - app112 shared Feed PASS
  - app102 public like parity PASS
  - derived cache verifier PASS
  - TypeScript PASS
  - Build PASS
  - generated change boundary PASS
- 앞선 실패 Run들은 제품 코드 실패가 아니라 기존 verifier가 새 wrapper/guard 구조를 문자열 기준으로 오인한 검사 문제였고, 검사 범위를 실제 동작 계약으로 수정한 뒤 최종 PASS.

안전:
- D1 schema/migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- Firebase Functions/Rules 변경 없음.
- 30초 actor batch 유지.
- 1분 shared aggregate 유지.
- 2분 viewer activity gate 유지.
- app120 actor count lock 유지.
- TEST/PRODUCTION 비변경.

현재 상태:
- 작업 branch: `work/app123-shared-like-cache-repair`
- 기준 PREVIEW: `174714c5c91e4ce406d36f1cdbf11779e53491e4`
- PREVIEW 실제 배포: app **122**
- TEST 실제 배포: app **122**
- PRODUCTION: app **117**
- app123 코드/Worker 검증 완료, PREVIEW 병합·배포 전.
- 배포 후 이미 stale인 4곡은 shared derived cache만 제한적으로 복구하고 canonical user data는 변경하지 않는다.
- PRODUCTION 변경 금지.

## 0AB. TEST app 122 — Explore 공개 좋아요 숫자 stale shared Feed 확인 / 수정 전

TEST 승격 직후 사용자 실사용에서 Explore 카드 숫자가 예상값으로 갱신되지 않는 현상을 확인했다. 이 문제는 "최초 업데이트 후 2분을 기다려야 보이는 정상 지연"이 아니다.

2026-09-18 읽기 전용 진단:
- Run `35339798457`: 069 queue/read-only 확인.
  - Q035/Q066/Q069 pending batch = 0.
  - 최근 30분 canonical like 변경 없음.
  - 큐 적체 때문에 숫자가 늦는 상태 아님.
- Run `35339874817`, `35340012778`: D1 canonical/derived와 PREVIEW/TEST shared Feed snapshot 대조.
- 화면 상단 첫 4곡:
  - `Leaving One Step Open`
  - `Left Unsaid`
  - `Through the Night`
  - `Just Stay Here Awhile`
- 위 4곡 모두:
  - canonical `track_stats.like_count = 1`
  - relation `likes COUNT = 1`
  - derived `explore_derived_tracks.likes = 1`
  - PREVIEW shared Feed v112 = **0**
  - TEST shared Feed v112 = **0**
- 반면 다른 공개곡(예: `스스륵`)은 canonical/derived/shared 모두 1로 일치.
- TEST shared snapshot는 `SHARED-R2-GET-112`, D1 read 0으로 정상적으로 공용 R2를 읽고 있으나 해당 4개 row 자체가 stale.

현재 판단:
- actor 30초 batch, canonical D1 relation/count, derived row까지는 정상 반영된 기록이 존재한다.
- 실패 구간은 canonical/derived 이후 **공용 Feed R2 shared-feed-v112 갱신/미러 경로**다.
- 따라서 클라이언트 2분 activity gate를 기다려도 source shared snapshot 자체가 0이면 1로 바뀌지 않는다.
- 2분 gate는 "다른 사용자가 revision을 얼마나 자주 확인할지"의 비용 제한일 뿐, 최초 업데이트 후 반드시 기다리는 시간 규칙이 아니다.
- PREVIEW와 TEST가 같은 shared snapshot 0을 읽으므로 TEST 환경 분리/승격 문제도 아니다.

보호:
- 진단은 SELECT/read-only + 공개 snapshot GET만 사용.
- D1 write/migration/seed/backfill/delete 없음.
- 사용자 데이터 변경 없음.
- 임시 진단 Workflow 삭제 완료.
- PRODUCTION 비변경.

다음 작업:
- 수정은 `preview`에서만 시작.
- `056-explore-public-like-parity` → 환경 R2 Feed materialization → `059-shared-feed-r2-parity` shared mirror 순서를 실제 runtime 기준으로 감사.
- canonical/derived가 1일 때 shared v112도 해당 track 하나만 1로 패치되는지 검증.
- 전체 Feed 재생성/전체 D1 scan 없이 변경 track만 반영하는 구조 유지.
- 수정 전 TEST 재승격/PRODUCTION 승격 금지.

## 0AA. TEST app 122 — PREVIEW 검증본 승격 / TEST_VERIFIED 완료

사용자가 PREVIEW app 122를 통과 처리하고 TEST 배포를 승인했다. 검증된 PREVIEW 제품과 공유 사용자 데이터를 그대로 사용하며, 데이터 복사/마이그레이션 없이 코드/Worker/Hosting만 TEST로 승격했다.

최종 TEST 승격 기준:
- source PREVIEW SHA: `9be18f49b91d47f068b77c056e2611eb5a3c4d06`
- source app version: **122**
- promoted main SHA: `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker version: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- TEST manifest/tag: `soridraw-test-v122-9be18f49b91d`
- TEST URL: `https://test.soridraw.com`
- Firebase TEST fallback URL: `https://soridraw-test.web.app`
- final TEST Release Controller Run: `35337836322` — **SUCCESS / TEST_VERIFIED**
- final preflight Run: `35337724687` — **SUCCESS**

최종 검증:
- source SHA/tree 잠금 PASS.
- TypeScript / Build / release static verification PASS.
- Firebase Hosting write permission preflight PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- shared D1 SELECT-only preflight PASS.
- TEST Worker upload → exact version activation PASS.
- TEST latest shared Feed parity PASS.
- TEST popular shared Feed parity PASS.
- TEST public profile parity PASS.
- TEST Worker smoke/verify PASS.
- Firebase TEST Hosting deploy PASS.
- `test.soridraw.com` + `soridraw-test.web.app` app-version/index exact verification PASS.
- TEST_VERIFIED durable manifest 생성 PASS.
- PRODUCTION branch / Worker / Hosting 비변경 PASS.

첫 TEST 시도와 자동 복구:
- 최초 preflight Run `35336675035` — SUCCESS.
- 최초 TEST Run `35336817221` — TEST_DEPLOY parity 단계 FAIL.
- 당시 제품/권한/Build 실패가 아니라 Release Controller가 PREVIEW/TEST 각각의 독립 60초 revision edge cache와 legacy direct Feed를 같은 순간 완전 동일해야 한다고 검사해, 실제 shared R2가 정상이어도 revision 세대가 교차하며 실패한 것이 로그/코드로 확인됐다.
- 실패 직후 Controller 자동 rollback 성공:
  - TEST Worker → 기존 `2d3f887d-8730-497f-a35c-d60452c532c4` 복구.
  - main → app117 tree 복구.
  - Firebase TEST Hosting은 실패 지점상 새 app122 배포 전에 중단되어 기존 app117 유지.
  - PRODUCTION 비변경.
- Release parity 검사 수정:
  - PR #100 → preview merge `9be18f49b91d47f068b77c056e2611eb5a3c4d06`.
  - 검증 Run `35337334681` — TypeScript / Build / promotion verifier / controller verifier / runtime syntax PASS.
  - PREVIEW/TEST revision endpoint는 각자 SHARED authority + D1 R0/W0를 계속 검사.
  - 환경별 edge revision 문자열의 순간 동일성 대신 현재 shared R2 revision + 실제 Feed projection의 완전 동일성을 검사.
  - 공개프로필 parity 및 rollback/binding/bundle 안전검사는 유지.
  - TEST 기준 main에도 동일 릴리스 도구만 PR #101로 동기화; merge `71d7cae35153291d77a27eda6cbf6674c236007a`.
  - 앱/Hosting/Worker 제품 기능 변경 없음.

현재 환경:
- PREVIEW 제품: app **122** — source 기준 `9be18f49b91d47f068b77c056e2611eb5a3c4d06`.
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`, **TEST_VERIFIED**.
- PRODUCTION: app **117**, `e994340f3c4f6ac97f444f1ddf13053d3faffa71` 유지.
- PRODUCTION 승격은 사용자 명확한 정식배포 승인 전 금지.

데이터/비용 안전:
- 사용자 원본 데이터 복사 없음.
- D1 migration/seed/backfill/delete 없음.
- Firebase Functions/Rules 변경/배포 없음.
- 공유 canonical D1: `soridraw-explore-db` 유지.
- 공유 PROFILE_MEDIA: `soridraw-profile-media` 유지.
- 좋아요 30초 actor batch / 다른 사용자 활동 gate 2분 / shared 1분 aggregate / app120 actor count lock 유지.
- TEST 실사용 검증 전. 다음 단계는 사용자가 `test.soridraw.com`에서 실제 PC/모바일 기능·비용을 확인하는 것.

## 0Z. PREVIEW app 122 — Explore 좋아요 흰색 filled heart + 짧은 클릭 모션 / 배포 완료

사용자 요청으로 좋아요 버튼의 시각 표현만 변경했다.

변경:
- 좋아요 ON 상태의 기존 빨간색 제거.
- ON 상태 하트 아이콘을 흰색 filled heart로 표시.
- 클릭 순간 하트가 살짝 눌렸다가 톡 올라오는 짧은 모션 추가.
- Classic Light의 빨간 liked override도 제거하고 흰색 filled heart가 유지되도록 조정.
- 버튼 크기/위치/간격/기능/좋아요 로직은 변경하지 않음.
- app version: **122**.

검증:
- 작업 branch: `work/app122-like-white-heart-motion`
- 기준 PREVIEW: `577d8a162c7839615ebbfaad4beae3e418a5121b` — app 121.
- PR #99 merge 완료.
- PREVIEW 제품 merge commit: `cc2a55ad7d7deb25b971c39464c12f7a9981a8aa`.
- 검증 Run `35332970861` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app122 white-heart regression PASS
  - red liked override 제거 PASS
  - white filled heart PASS
  - click motion PASS
  - layout/size/spacing unchanged guard PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `9cb35cebfd9bdfb47537a0587b11d9add595c23c`.
- Firebase PREVIEW Hosting Run `35333985793` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- 실제 대상: `https://preview.soridraw.com`.

변경 파일:
- `src/components/explore/exploreSocial.css`
- `src/styles/classicLightVisualFixes.css`
- `public/app-version.json`
- `scripts/verify-122-explore-like-white-heart.mjs`

비변경:
- Explore 좋아요 동작/30초 batch/2분 revision gate/1분 shared aggregate 모두 그대로.
- Worker / D1 / Firebase Functions / Rules / 사용자 데이터 변경 없음.
- TEST app 117 유지.
- PRODUCTION app 117 유지.
- PRODUCTION 변경 금지.

## 0Y. PREVIEW app 121 — Explore 좋아요 timing-only 조정 / 배포 완료

사용자 지시로 app 120 동작은 그대로 유지하고 시간값 두 개만 변경했다.

변경:
- 좋아요 sliding idle batch: 마지막 클릭 후 **20초 → 30초**.
- 다른 사용자 Feed revision 활동 판정 최소 간격: **60초 → 120초(2분)**.
- app version: **121**.

그대로 유지:
- 하트/숫자 즉시 반영.
- actor 최신 숫자 display lock.
- app 120 개인 좋아요 캐시 namespace 및 outbox 구조.
- 서버 warm batch intake: 069 queue D1 W1.
- 서버 shared aggregate: **1분 event alarm 그대로**.
- shared revision endpoint의 D1 R0/W0 계약.
- UI/CSS, Worker 제품 코드, Firebase Functions/Rules, D1 schema/data, 사용자 원본 데이터 모두 비변경.

GitHub / 검증:
- 기준 PREVIEW: `046fda0b746a912d8926cc2d09348d812aed7060` — app 120.
- 작업 branch: `work/app121-like-30s-2m-timing`.
- PR #98 `App 121: change Explore like timing to 30s / 2m`.
- 제품 merge commit: `6934deb10d55ceb77a21ad09ca1d6436ded6d313`.
- 검증 Run `35331912691` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app121 timing-only regression PASS
  - actor batch idle 30초 PASS
  - 다른 사용자 활동 gate 120초 PASS
  - 서버 1분 shared aggregate 비변경 PASS
  - app120 cache/count-lock 비변경 PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `ce150de9a3fc39d626511b42fedfe73a08091263`.
- Firebase PREVIEW Hosting Run `35332096766` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- 실제 대상: `https://preview.soridraw.com`.

현재 상태:
- PREVIEW 앱: **121 배포 완료**.
- TEST: app **117 유지**.
- PRODUCTION: app **117 유지**.
- Cloudflare Worker 재배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- PRODUCTION 변경 금지.

## 0X. PREVIEW app 120 — Explore 좋아요 actor count lock / 배포 완료

사용자 실사용 영상에서 app 119의 서버 1분 공용 집계는 정상적으로 수렴했지만, 누른 사용자 본인의 숫자가 20초 대기 구간 동안 올라갔다 내려갔다 반복되는 현상을 확인했다.

확인된 원인:
- app 119는 하트와 숫자를 즉시 로컬 반영했지만, 같은 시간에 이미 진행 중이던 Feed / 공개프로필 / 좋아요곡 재검증 응답이 과거 shared likeCount를 다시 적용할 수 있었다.
- cached Feed revision revalidation, profile first-view revalidation, load-more/shared-count convergence 경로가 actor의 최신 optimistic count보다 우선할 수 있었다.
- 서버 1분 aggregate 자체의 실패가 아니라, actor-local 최신 숫자와 shared/public payload의 우선순위 문제였다.

app 120 수정:
- 개인 좋아요 캐시는 app 120 namespace만 사용:
  - `explore-liked-state-120`
  - `explore-like-outbox-120`
  - `explore-like-display-lock-120`
- app 119 및 이전 개인 좋아요 캐시는 app 120 판단에서 사용하지 않는다.
- 20초 sliding idle batch 유지.
- outbox pending 중에는 해당 곡의 최신 optimisticLikeCount가 Feed/Profile payload보다 우선한다.
- batch ACK 뒤에도 shared publication이 따라오기 전까지 actor 최신 숫자를 display lock으로 보호한다.
- shared 숫자가 actor 최신 숫자와 같아지는 순간 lock을 해제한다.
- 영구 고정을 막기 위한 보호 상한은 90초다.
- Feed 첫 로딩, session cache, revision revalidation, 공개프로필, 좋아요곡 목록, 더보기 응답 모두 actor overlay를 먼저 적용한다.
- 기존 서버 경로는 유지:
  - warm batch intake: 069 queue D1 W1
  - shared aggregate: 1분 event alarm
  - 다른 사용자는 shared publication 뒤 다음 실제 활동 시 revision 확인.

GitHub / 검증:
- 기준 PREVIEW: `0f811dc93894976da5f21ee941755eac98077b07`
- 작업 PR: #97 `App 120: keep actor like count stable during shared revalidation`
- 제품 merge commit: `d9263f94cb153da8d2f7d67a6e6695bb4d491c85`
- 검증 Run `35330327699` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app120 actor-count regression PASS
  - 20초 sliding idle batch 유지 PASS
  - stale Feed/Profile overwrite 차단 PASS
  - old like cache namespace 비사용 PASS
  - W1 intake + one-minute shared publication 유지 PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `d4c301a61c5d84cb7592c177592967525fce00db`
- Firebase PREVIEW Hosting Run `35330543893` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- app version: **120**
- 실제 대상: `https://preview.soridraw.com`

비변경:
- Cloudflare Worker 제품 코드/배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- UI/CSS 변경 없음.
- TEST app 117 유지.
- PRODUCTION app 117 유지.

실사용:
- 사용자 1차 확인에서 app 120은 좋아요 숫자 흔들림이 사라지고 정상 동작하는 것으로 확인 중.
- 최종 사용자 확인 기준:
  1. 하트 클릭 즉시 빨강 + 숫자 +1.
  2. 다시 클릭 즉시 해제 + 숫자 -1.
  3. 20초 대기 중 actor 숫자 흔들림 없음.
  4. 다른 사용자는 shared publication 후 다음 활동 시 최신 숫자 확인.
- PRODUCTION 변경 금지.

## 0W. PREVIEW app 119 — Explore 좋아요 최신 캐시 + 20초 슬라이딩 묶음쓰기 / 배포 완료

사용자 지시로 좋아요 경로를 다시 단순화했다. 기준은 "누르는 사용자는 하트/숫자 즉시, 마지막 클릭 후 20초 동안 변경을 모아 한 번의 batch, 다른 사용자는 공용 결과를 최대 1분 안에 확인"이다.

app 119 제품 변경:
- 개인 좋아요 캐시는 새 `explore-liked-state-119`만 읽는다. 과거 Explore 좋아요 캐시는 app 119 판단 근거로 사용하지 않는다.
- durable outbox도 새 `explore-like-outbox-119` 하나만 사용한다.
- Explore 좋아요용 과거 RTDB replay subscriber를 중단했다.
- 069/071 계열의 클라이언트 강제 좋아요 숫자 refresh/recovery 경로를 제거했다.
- 하트 클릭 즉시 개인 하트 상태와 표시 숫자를 함께 ±1 한다.
- 마지막 클릭 기준 20초 sliding idle window를 사용한다. 19초에 다른 하트를 누르면 그 클릭부터 다시 20초다.
- 20초 안의 여러 곡 변경은 `/v1/me/likes/batch` 한 요청으로 보낸다.
- 같은 곡을 여러 번 눌렀으면 최초 base 상태와 마지막 desired 상태만 서버에 보낸다. 결과가 원래 상태로 돌아오면 서버 mutation은 생략한다.
- 페이지/프로필 이동은 20초 window를 강제 flush하지 않는다. 최신 outbox가 남아 다시 이어진다.
- 다른 사용자의 shared Feed revision revalidation은 클라이언트 기준 최대 1분 간격으로 제한한다.
- 기존 서버 hot path는 유지한다: warm batch intake는 D1 W1 069 queue, shared aggregate는 1분 event alarm이다.
- app version: **119**.

GitHub / 검증:
- 작업 branch: `work/app119-like-20s-latest-cache`
- 기준 PREVIEW: `e15c5de462b73cc3f557fa5ee02ebb868318a022`
- PR #96 `App 119: simplify Explore likes to latest-cache 20s batch`
- PREVIEW 제품 merge commit: `1b1f4664e39a5e0aecc9f4ba910cb4beba2c7f5e`
- 최종 제품 검증 Run `35328311634` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app119 regression PASS
  - 20초 sliding idle batch 계약 PASS
  - immediate heart/count 계약 PASS
  - old RTDB/071 replay disabled PASS
  - W1 queue intake + one-minute shared aggregate 계약 PASS
- 이전 Run `35326266088`의 회귀검사 FAIL은 055 패치 파일의 검사용 문자열을 실제 호출로 오인한 테스트식 문제였다. TypeScript/Build는 PASS였고 제품 코드 실패가 아니었다.
- 검사 범위를 실제 hot-path replacement block으로 수정 후 최종 PASS.
- 임시 검증 Workflow는 merge 전 삭제 완료.

PREVIEW 배포:
- 배포 trigger commit: `2487b74a44c00e458d7c42a72ba90284cd56d808`
- Firebase PREVIEW Hosting Run `35328558283` — **SUCCESS**
  - locked product source `1b1f4664e39a5e0aecc9f4ba910cb4beba2c7f5e`
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - `preview.soridraw.com` exact build PASS
  - remote app-version **119** PASS
  - TEST / PRODUCTION branch + Hosting unchanged PASS
- 실제 대상: `https://preview.soridraw.com`

변경 범위 / 안전:
- UI/CSS 변경 없음.
- Explore Worker 제품 코드 변경 없음 / Worker 재배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 구조/내용 변경 없음.
- main(TEST) 유지: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1` — app 117.
- production 유지: `e994340f3c4f6ac97f444f1ddf13053d3faffa71` — app 117.

현재 상태:
- PREVIEW 앱: **119 배포 완료**.
- TEST 앱: **117 유지**.
- PRODUCTION 앱: **117 유지**.
- 사용자 실사용 확인 항목:
  1. 하트 0 → 클릭 즉시 빨강 + 숫자 1.
  2. 다시 클릭 즉시 회색 + 숫자 0.
  3. 여러 곡을 연속 클릭하고 마지막 클릭 후 20초 전에는 서버 batch가 나가지 않는지.
  4. 19초 시점에 다른 하트를 누르면 다시 20초로 연장되는지.
  5. 20초 종료 후 여러 곡 최종 상태가 한 batch로 반영되는지.
  6. 같은 곡을 여러 번 토글하면 최초 상태→최종 상태만 반영되는지.
  7. 다른 사용자/기기에서 최대 1분 후 공용 숫자가 수렴하는지.
- PRODUCTION 변경 금지.

## 0V. PREVIEW app 118 — Explore 좋아요 의도 snap-back 수정 / 배포 완료

사용자 실사용 영상에서 좋아요 해제를 누르면 회색 하트로 잠시 바뀐 뒤 약 1초 안에 다시 빨간 하트로 돌아오는 현상을 기준으로 개인 좋아요 상태 머신을 수정했다.

근본 원인:
- 기기 로컬의 과거 `baseLiked`를 현재 서버 정답처럼 사용해, 명시적 사용자 클릭이 `desiredLiked === baseLiked`이면 outbox에서 제거될 수 있었다.
- 같은 조건을 pending count / flush 직전 정리에서도 다시 적용해 서버 요청 자체가 사라질 수 있었다.
- 직접 HTTP ACK 전에 오래된 RTDB 계정 replay 신호가 들어오면 방금 누른 해제 상태를 다시 덮을 수 있었다.
- 읽기/쓰기 횟수 부족이 아니라, 비용 최적화용 local batch 상태와 cross-device replay 신호의 우선순위 오류였다.

app 118 수정:
- 사용자가 실제로 누른 heart intent는 direct `/v1/me/likes/batch` ACK 전까지 무조건 pending으로 유지한다.
- `baseLiked`와 값이 같다는 이유로 명시적 클릭을 삭제하지 않는다.
- RTDB는 cross-device replay 용도로만 사용하고, 이 브라우저의 pending intent보다 우선하지 못하게 했다.
- direct batch ACK/RTDB publish 처리 뒤에만 local pending을 정리한다.
- 요청 진행 중 같은 곡을 다시 누르면 첫 ACK 뒤 남은 최신 intent를 즉시 후속 flush한다.
- 공개 좋아요 숫자는 기존처럼 shared/server authority를 유지하며 client optimistic numeric delta를 추가하지 않는다.
- 페이지 진입/재진입/업데이트만으로 추가 서버 요청을 만들지 않는다. 실제 heart mutation일 때만 direct batch 요청이 발생한다.

검증:
- 작업 PR: #95 `Fix Explore like intent snap-back in app 118`
- 제품 코드 merge commit: `5c8ef2f809fd0f230980706116cb3f25be5dc087`
- 최종 branch 검증 Run `35318905850` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app 118 stale-base / stale-RTDB snap-back regression PASS
  - app 117 public-count separation regression PASS
  - app 116 public-count convergence regression PASS
  - Worker desired-state queue regression PASS
- 일회성 검증 Workflow는 merge 전 삭제 완료.

PREVIEW 배포:
- release trigger / 현재 preview HEAD: `65951004bc5e034b085915302643d419290859d7`
- PREVIEW Hosting Run `35319195214` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - exact PREVIEW build PASS
  - remote `app-version.json=118` PASS
  - TEST/PRODUCTION branch + Hosting unchanged PASS
- 실제 대상: `https://preview.soridraw.com`

비변경:
- Explore Worker 코드/배포 없음.
- D1 migration/seed/backfill/write 없음.
- Firebase Functions / Rules 변경 없음.
- 사용자 원본 데이터 변경 없음.
- UI/CSS 변경 없음.
- main(TEST) 유지: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1` — app 117
- production 유지: `e994340f3c4f6ac97f444f1ddf13053d3faffa71` — app 117

알려진 저장소 위험:
- preview push 직후 legacy `Apply 069 Explore Like W1 Delayed Count` Workflow Run `35319169595`가 자동 실행됐으나, 오래된 app 069 검증 조건에서 실패했다.
- 실패 지점은 commit/deploy 단계 전이므로 source push, Worker deploy, D1 write는 발생하지 않았다.
- 이 legacy auto-run은 현재 app 118 배포 성공과 무관하지만 후속 저장소 정리 대상이다.
- GitHub branch protection API 응답은 preview/main/production 모두 `protected=true`이면서 세부 enforcement가 off로 보이므로 저장소 보호 설정은 별도 감사 대상이다.

현재 상태:
- PREVIEW 앱: **118**
- TEST 앱: **117**
- PRODUCTION 앱: **117**
- 사용자 실사용 다음 확인: 기존에 좋아요된 곡 1개를 해제했을 때 회색 하트가 다시 빨간색으로 되돌아오지 않는지, 다시 좋아요했을 때 PC/모바일이 같은 개인 heart 상태로 수렴하는지 확인.

## 0U. Explore 좋아요 해제 503 — TEST/PRODUCTION Worker 복구 완료

사용자 정식복구 승인에 따라, app 117 이후 발견된 Explore 좋아요 해제 503의 Worker 필수 바인딩 유실을 TEST와 PRODUCTION에 복구했다.

근본 원인:
- TEST/PRODUCTION Worker 승격 과정에서 `LIKE_RATE_LIMITER`와 `EXPLORE_LIKE_BATCH_SCHEDULER`가 live config에서 유실됐다.
- 앱의 `좋아요 보호 기능을 확인할 수 없습니다` 토스트는 Worker가 `LIKE_RATE_LIMITER`를 사용할 수 없을 때 발생한 503 `RATE_LIMIT_UNAVAILABLE` 경로였다.
- release runtime은 PR #94에서 필수 Rate Limiter / Durable Object 바인딩을 보존하도록 수정됐다.

실제 복구:
- 최초 versioned upload는 Cloudflare 제한(code 10211)으로 차단됐다. Durable Object migration은 처음 한 번 non-versioned deploy가 필요했다.
- TEST Worker에 1회 Durable Object migration + 필수 바인딩 적용 완료.
- TEST의 오래된 환경별 파생 Feed R2 2개(latest/popular)는 shared canonical R2 snapshot으로만 복구했다.
  - 사용자 원본 데이터가 아니라 environment-specific derived cache만 수정했다.
- TEST edge revision cache 70초 만료 후 release parity 재검증 PASS.
- PRODUCTION derived Feed cache도 shared canonical snapshot으로 준비한 뒤 동일 1회 migration + 바인딩 적용.
- PRODUCTION edge revision cache 70초 만료 후 TEST 기준 release parity PASS.

최종 Run:
- GitHub Actions `35314376142` — **SUCCESS**
- TEST active Worker: `2d3f887d-8730-497f-a35c-d60452c532c4`
- TEST release parity: PASS (reference PREVIEW, attempt 1)
- TEST like batch unauth smoke: HTTP 401 — expected auth rejection, **5xx 없음**
- PRODUCTION Worker before: `0bc9f998-f5d4-4fe3-a63c-13f7a4f13f58`
- PRODUCTION Worker after: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`
- PRODUCTION release parity: PASS (reference TEST, attempt 1)
- PRODUCTION like batch unauth smoke: HTTP 401 — expected auth rejection, **5xx 없음**

3환경 live 최종감사:
- PREVIEW `soridraw-explore-preview`: required like bindings PASS
- TEST `soridraw-explore-test`: required like bindings PASS
- PRODUCTION `soridraw-explore-api`: required like bindings PASS
- `THREE_ENV_REQUIRED_LIKE_BINDINGS=PASS`

비변경:
- Firebase Hosting 변경 없음.
- D1 write / migration / seed / backfill 없음.
- Firebase Functions / Rules 변경 없음.
- 사용자 원본 데이터 변경 없음.
- 앱 UI/CSS 변경 없음.
- 수정된 것은 Worker runtime binding/migration bootstrap과 environment-specific derived Feed R2 cache뿐이다.

현재 상태:
- PREVIEW / TEST / PRODUCTION 앱: **117**
- TEST / PRODUCTION Worker: 좋아요 Rate Limiter + shared like batch Durable Object 바인딩 복구 완료
- 좋아요 batch 보호 경로는 503이 아닌 정상 auth 401 smoke까지 확인 완료.
- 다음 실사용 확인: 각 앱에서 기존에 좋아요된 곡의 좋아요 해제 → 다시 좋아요 1회씩 확인.


## 0T. Explore 좋아요 해제 503 — Worker 필수 바인딩 유실 원인 확정 / 코드 수정 완료 / live 복구배포 전

사용자 실사용에서 PREVIEW/TEST/PRODUCTION 좋아요 해제가 실패하고 일부 환경에서 `좋아요 보호 기능을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.` 토스트가 발생했다.

원인 확인:
- 해당 토스트는 Worker의 `enforceExploreLikeBatchEdgeRateLimit054()`에서 `env.LIKE_RATE_LIMITER`가 없거나 `.limit()`을 제공하지 않을 때만 발생하는 503 `RATE_LIMIT_UNAVAILABLE` 메시지다.
- live Cloudflare settings read-only 진단 Run `35311707087`:
  - PREVIEW `soridraw-explore-preview`: `LIKE_RATE_LIMITER` 1개 존재, `EXPLORE_LIKE_BATCH_SCHEDULER` 존재.
  - TEST `soridraw-explore-test`: `LIKE_RATE_LIMITER` 없음, `EXPLORE_LIKE_BATCH_SCHEDULER` 없음.
  - PRODUCTION `soridraw-explore-api`: `LIKE_RATE_LIMITER` 없음, `EXPLORE_LIKE_BATCH_SCHEDULER` 없음.
- `.deploy/release-worker-runtime.mjs`가 TEST/PRODUCTION Worker config를 재구성할 때 D1/R2/service만 보존하고 `ratelimit` 및 `durable_object_namespace`를 누락해, Worker 승격 시 좋아요 필수 바인딩이 제거될 수 있었다.

근본 수정:
- PR #94 `Fix Worker release binding loss that blocks Explore likes` merge 완료.
- preview merge commit: `606a71cca5fb2cc3c3405c0c07b4fb7999403951`.
- release runtime이 canonical PREVIEW wrangler의 필수 `LIKE_RATE_LIMITER`, `EXPLORE_LIKE_BATCH_SCHEDULER`, Durable Object migration을 TEST/PRODUCTION release config에 반드시 포함한다.
- live ratelimit/DO binding drift를 검사하고, release static verifier가 필수 바인딩 보존을 강제한다.
- dry-run 검증 Run `35312061720` SUCCESS:
  - release static verifier PASS
  - TEST generated config: Rate Limiter + scheduler + migration PASS
  - PRODUCTION generated config: Rate Limiter + scheduler + migration PASS
- 검증 과정에서 Worker deploy/traffic 변경, D1 write, 사용자 데이터 변경은 수행하지 않았다.

현재 live 상태:
- PREVIEW Worker는 필수 바인딩이 존재한다.
- TEST/PRODUCTION Worker는 아직 필수 바인딩이 빠진 live version이므로 좋아요 batch mutation이 503으로 차단될 수 있다.
- 사용자 승인 전이므로 TEST/PRODUCTION Worker 복구 배포는 아직 실행하지 않았다.

다음 단계:
- 사용자 배포 승인 시 수정된 release runtime으로 TEST Worker를 먼저 upload/activate/verify하고 live binding settings를 확인한다.
- TEST PASS 후 동일 source로 PRODUCTION Worker를 upload/activate/verify한다.
- D1 migration/schema/user-data migration은 실행하지 않으며, Durable Object migration은 canonical Worker binding class를 연결하기 위한 Worker runtime migration만 사용한다.
- 최종적으로 세 Worker의 `LIKE_RATE_LIMITER` + `EXPLORE_LIKE_BATCH_SCHEDULER` 존재 여부와 Explore smoke/parity를 확인한다.


## 0S. app 117 TEST → PRODUCTION 앱 전용 정식 승격 — 완료

사용자 명확한 정식배포 승인에 따라 app 117을 PREVIEW 검증본에서 TEST를 거쳐 PRODUCTION으로 승격했다.

기준:
- release source PREVIEW: `ff4963e8261c96f6ab5186a7b872d8bc2817dfcd`
- app version: **117**
- 핵심 제품 수정 merge: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`
- PREVIEW Hosting 검증 Run: `35310263271` SUCCESS
- PREVIEW `preview.soridraw.com` exact build / app-version 117 PASS

정식 승격:
- 앱 전용 TEST→PRODUCTION Run: `35311139826` — **SUCCESS**
- TypeScript PASS
- Build PASS
- `verify-117-explore-public-count-cache-separation.mjs` PASS
- `verify-116-explore-public-count-convergence.mjs` PASS
- TEST Firebase Hosting deploy 완료
- `test.soridraw.com` 및 `soridraw-test.web.app` exact index hash / app-version 117 PASS
- TEST `main`: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1`
- PRODUCTION Hosting은 검증된 `soridraw-test:live`를 `soridraw:live`로 clone
- `soridraw.com` 및 `soridraw.web.app` exact index hash / app-version 117 PASS
- PRODUCTION branch: `e994340f3c4f6ac97f444f1ddf13053d3faffa71`
- TEST/PRODUCTION 모두 동일 source tree `a567717dc6cbfb86c75cf9aa80078d6ccd657d25`
- TEST/PRODUCTION rollback Hosting channel은 성공 후 삭제 완료

변경 범위:
- 이번 117 release는 클라이언트 앱 전용 승격이다.
- Cloudflare Worker 재배포/traffic 변경 없음.
- D1 read/write/migration/seed/backfill 없음.
- Firebase Functions/Rules 변경 없음.
- 사용자 원본 Firestore/D1/R2 데이터 변경 없음.
- UI/CSS 변경 없음.
- 실제 해결 대상은 Explore 공개 좋아요 숫자를 계정별 stale cache가 덮어쓰던 client 경로 제거 및 개인 하트 상태와 공개 숫자 authority 분리다.

현재 상태:
- PREVIEW: app **117**
- TEST: app **117**
- PRODUCTION: app **117**
- 정식 주소: `https://soridraw.com`
- 다음 실사용 확인: 기존 정식앱 브라우저 캐시를 그대로 둔 상태에서 Explore 공개 좋아요 숫자가 TEST와 동일하게 유지되는지 확인.


## 0R. app 117 PREVIEW Hosting 배포 — 완료

- 사용자 요청으로 app 117을 Firebase PREVIEW Hosting에 배포했다.
- 배포 source commit: `328ae89287550d746d9a51f8ffdc168bd785e03c`.
  - 제품 코드 핵심 merge: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`.
  - 상태 문서 반영 후 deploy trigger commit까지 포함한 PREVIEW 최신본이다.
- GitHub Actions Run: `35310263271` — **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting deploy PASS.
- `preview.soridraw.com` exact build hash PASS.
- 실제 remote app version: **117**.
- TEST/PRODUCTION branch 및 Hosting content unchanged PASS.
- Worker/D1/Functions/Rules 배포 없음.
- 사용자 데이터 migration/seed/backfill/delete/overwrite 없음.
- 비용 관점: 앱 Hosting 배포만 수행했으며 데이터 서버 전체 읽기/재생성 작업 없음.

현재 상태:
- PREVIEW: app **117** 배포 완료.
- TEST: app **116** 유지.
- PRODUCTION: app **116** 유지.
- 다음 확인 항목: PREVIEW Explore에서 기존 PROD형 브라우저 캐시가 남아 있어도 공개 좋아요 숫자 `1`이 개인 캐시 `0`으로 덮이지 않는지 실사용 검증.


## 0Q. Explore 공개 좋아요 숫자 개인 캐시 오염 근본 수정 — app 117 / PREVIEW 코드 반영 완료 / 배포 전

사용자 실사용 비교에서 동일 곡과 동일 공개 데이터가 TEST에서는 `1`, PRODUCTION에서는 여러 로그인 계정에서 `0`으로 표시되는 현상을 확인했다. 서버-side TEST/PRODUCTION parity가 PASS해도 브라우저에서 값이 갈릴 수 있는 client 경로를 추적했다.

근본 원인:
- `src/services/exploreLikeAccountOverlay.ts`의 과거 068 경로가 로그인 계정별 `likeCount`를 persistent cache에 보관했다.
- 이 모듈은 `explore-like-account-patches`를 schema **1**로 사용했지만 `src/services/exploreLikeService.ts`는 같은 cache key/source를 schema **2**로 사용했다.
- `src/services/exploreRevisionRequestCache.ts`가 정상 서버 Feed 응답을 받은 뒤 `overlayExploreAccountLikeCounts()`를 다시 적용해, 오래된 계정 캐시의 `0`이 shared/server의 정상 `1`을 덮을 수 있었다.
- 따라서 서버 parity 검사는 정상이어도 오래 사용한 PRODUCTION 브라우저와 깨끗한 TEST origin이 서로 다른 숫자를 표시할 수 있었다.

app 117 수정:
- 공개 `likeCount`는 shared/server Feed/Profile payload만 authority로 사용한다.
- 계정별 persistent cache가 공개 숫자를 덮어쓰는 `overlayExploreAccountLikeCounts`와 server response overlay를 제거했다.
- 과거 overlay helper는 별도 `sessionStorage` key에 revision grace timestamp만 보관하며 숫자는 저장하지 않는다.
- 개인 빨간 하트 membership은 기존 계정별 경로를 유지하고 공개 숫자와 분리한다.
- 현재 Explore 카드 render는 `track={track}` shared 숫자를 직접 사용하며 `getExploreLikeDisplayCount091` 같은 개인 display ledger를 public count source로 사용하지 않는 것을 117 verifier에 고정했다.
- 기존 116 public-count convergence verifier는 app 116 이상에서 계속 적용되도록 보강했다.

GitHub:
- PR #93 `Fix Explore public like count stale personal-cache overwrite` merge 완료.
- app 117 코드 merge commit: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`.
- 최종 검증 Run `35308672890` SUCCESS.
  - TypeScript PASS
  - Build PASS
  - `verify-117-explore-public-count-cache-separation.mjs` PASS
  - `verify-116-explore-public-count-convergence.mjs` PASS
- UI/CSS 변경 없음.
- Worker/D1/Functions/Rules 변경 없음.
- 사용자 데이터 migration/seed/backfill/delete/overwrite 없음.
- TEST/PRODUCTION 변경 없음.

배포 상태:
- PREVIEW branch 코드에는 app 117이 반영됐지만 **Firebase PREVIEW에는 아직 배포하지 않았다**.
- 현재 TEST/PRODUCTION은 계속 app 116 상태다.
- 다음 단계는 사용자의 배포 요청이 있을 때 app 117을 PREVIEW에 먼저 배포하여, 오래된 PRODUCTION형 브라우저 캐시가 존재하는 상태에서도 shared/server `1`이 더 이상 account-local `0`으로 덮이지 않는지 실사용 확인하는 것이다.


## 0P. 2026-09-18 TEST → PRODUCTION v116 정식 승격 — 완료

이 섹션이 아래의 이전 release-state 기록보다 우선한다.

- 제품 release source PREVIEW: `fc389588435617a02c9c3fc76ab5f739a3033e9c` — app **116**.
- TEST `main`: `3c5bcef32650ee2e3b6de5e205071d705de8c6a3`.
- TEST Release Controller Run `35303654387` attempt 2 — **SUCCESS / TEST_VERIFIED**.
- 고정 TEST manifest: `soridraw-test-v116-fc3895884356`.
- TEST Worker: `2bed883b-2c43-4cc0-bffc-ab71263538dc`.
- TEST Hosting: `soridraw-test:live` 배포 및 `test.soridraw.com` exact index 검증 PASS.
- TEST latest/popular shared Feed parity PASS, public profile parity PASS, Worker smoke/verify PASS.

정식배포:
- 사용자가 2026-09-18 정식배포를 명확히 승인했다.
- 1차 Release Controller production Run `35306241583`은 **배포 전** Worker raw outdir hash 재생성 불일치로 차단. PRODUCTION 미변경.
- 1차 controlled production Run `35306461837`은 Worker/branch까지 진행 후 Firebase CLI의 `soridraw-test:@VERSION` clone 해석 오류로 중단. Worker는 이전 version으로 즉시 복구했고 Hosting은 변경 전이었다. production branch는 후속 rollback commit으로 기존 tree를 복구했다.
- Firebase 공식 channel clone 방식으로 `soridraw-test:live -> soridraw:live`를 사용한 controlled production Run `35306640261` — **SUCCESS**.
- 현재 PRODUCTION branch: `3323f5610bb2acca98da9b4aa08b6aa9f766a29b`.
- 현재 PRODUCTION Worker: `0bc9f998-f5d4-4fe3-a63c-13f7a4f13f58`.
- PRODUCTION Worker latest/popular shared Feed parity PASS, public profile parity PASS, TEST reference parity PASS, Worker smoke/verify PASS.
- Firebase PRODUCTION Hosting은 검증된 TEST live를 `soridraw:live`로 clone 완료. `soridraw.web.app` 및 `soridraw.com` exact index hash 검증 PASS.
- 임시 Hosting rollback channel은 전체 검증 성공 후 삭제 완료.
- PRODUCTION D1 preflight는 SELECT-only PASS. D1 migration/seed/backfill/user-data copy/delete 없음.
- Functions/Rules 변경 없음. 사용자 원본 Firestore/D1/R2 데이터 구조 변경 없음.
- main/TEST identity는 정식배포 후에도 변경되지 않음.

### 이번 릴리스에서 확인된 Release Controller 후속 수정 필요

다음 릴리스 전에 `.github/workflows/soridraw-release-promotion.yml`의 production 경로를 수정해야 한다.

1. Wrangler `--dry-run --outdir` 전체 파일 raw hash는 같은 source에서도 실행마다 값이 달라질 수 있어 TEST manifest의 Worker bundle identity로 사용할 수 없다.
   - 다음 Controller는 exact source SHA/tree + TEST active Worker version + canonical binding/parity를 불변조건으로 사용하고, 비결정적 raw outdir hash를 production gate로 사용하지 않도록 수정해야 한다.
2. Firebase Hosting production clone은 검증된 TEST live identity를 재확인한 뒤 `soridraw-test:live -> soridraw:live` channel clone을 사용한다.
3. rollback은 branch/Worker/Hosting 각각 exact 이전 상태를 독립 snapshot하고, Hosting은 임시 rollback channel 또는 REST exact version 방식으로 복구 가능해야 한다.

현재 제품 배포는 **PRODUCTION v116 완료** 상태다. 위 항목은 다음 릴리스 자동화 개선 과제이며 현재 배포된 사용자 데이터/UI의 미완료를 의미하지 않는다.


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

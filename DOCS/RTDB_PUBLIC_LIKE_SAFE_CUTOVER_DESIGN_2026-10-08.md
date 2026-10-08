# SORIDRAW 공개 좋아요 RTDB 비용·남용 차단: 안전한 4단 전환 설계 (2026-10-08)

상태: **설계 확정 후보 / 제품 코드 미구현 / 서버 인증·비용 실측 게이트 열림 / 배포 승인 아님**
기준: `preview` HEAD `7fec9f6cb8fe3646edaa63af102fc8a40e813844`, PREVIEW app382(실제 배포 앱 코드는 이전 SHA). 본 문서는 신규 서버/스키마 즉시 배포 지시가 아니다.

## 확인한 실제 구조와 사용자 제공 LIVE Rules

- `src/services/exploreLikeService.ts`: 클릭은 로컬 즉시, trailing 30초 뒤 `/v1/me/likes/batch` 전송. canonical ACK 성공 후 **클라이언트**가 개인 신호를 보내고 이어서 `publicSync/exploreLike`를 RTDB에 게시한다.
- `src/services/explorePublicLikeSyncService.ts`: `runTransaction`으로 한 개의 전역 노드에 최근 3분·최대 50곡 변경 알림을 합친다. 브라우저 RTDB `onValue`는 변경 시 전역 묶음을 받는다.
- `src/pages/ExplorePage.tsx` 2158~2255행: 로그인한 Explore 화면에서 전역 구독을 하나 설치하고, 받은 이후 화면에서 로드 중인 곡들만 `/v1/public-like-cards`(R2)로 한정 조회한다. 화면에 없던 곡도 **다운로드 자체는 이미 발생**했다. 앱382의 settled watermark는 중복 Worker 요청만 차단한다.
- 사용자가 **Firebase Console에서 복사해 올린 활성 규칙**과 `database.rules.json`에서 `publicSync/exploreLike/.write = "auth != null && newData.child('actorUid').val() === auth.uid"` 일치 확인. 신호 발행이 정당한 canonical W1/D1 ACK인지 검증하지 못한다. 전체 LIVE rules 파일의 바이트 단위 exact equality까지 확인한 것은 아님. 과거 private read-only API GET은 401 FAIL; 무리한 추가 IAM 권한 금지.
- 기존 `functions/src/index.ts`는 `admin.database().ref(...).set`로 관리자 메뉴의 공통 RTDB 신호를 기록하는 **실제 서버 전용 발행 선례**가 있다. 새로운 서비스나 유료 스트리밍 시스템을 먼저 도입하지 않는다.
- `cloudflare/explore-worker/canonical/preview-entry.js`는 기존 W1 배치 접수 및 약 5초 R2 정착·변경곡 처리 흐름을 관리한다. 원본 D1 외 불필요한 D1 write/read를 추가하지 않는다.
- RTDB 현재 운영 사용량 최초 READ-ONLY PASS: private `andrawing1212/soridraw-ops-private/reports/2026-10-08-rtdb-baseline.md`; 10만 명 스트레스 계산은 아직 가정이고 실제 청구액이 아니다.

## 추가 코드 현장 확인: 알림을 연결하면 안 되는 위치 (2026-10-08)

- `cloudflare/explore-worker/canonical/preview-entry.js` 1106~1133행의 `ExploreLikeBatchScheduler103.runAggregate194()`는 기존 canonical scheduled batch를 실행한 다음 `repairSharedPublicLikeCounts191()`를 호출한다.
- **해당 repair는 변화된 모든 곡 목록이 아니다.** `repairSharedPublicLikeCounts191()`는 최신/인기 Feed의 각각 최대 40곡(합집합 최대 80곡)을 읽어 기존 R2 카드와 canonical 좋아요 집계를 고치는 bounded recovery 경로다. 이를 공개 신호의 유일한 이벤트 출처로 사용하면 첫 40곡 밖의 변경이 누락될 수 있다.
- `preview-entry.js` 2105~2107행의 `publicSignalAcceptedAt`는 현재 W1 POST의 ACK 시간 메타데이터일 뿐, **개별 곡의 정착 완료·최종 공개 count를 증명하지 않는다**. 시간이 기록됐다고 신뢰할 수 있는 서버 발행 증명으로 쓰면 안 된다.
- 단계 A에서 반드시 확인할 것: canonical queue/aggregation에서 **모든 실제 변경 trackId + ownerUid + 확정 event/op ID + 서버 기준 acceptedAt**를 기존 비용 계약 안에서 직접 얻을 수 있는가? GitHub의 `canonical/preview-worker.js` 원본이 빈 상태로 반환되어 이를 확인하지 못했으므로 Worker 실제 생성/patch pipeline과 069 writer 경로를 확인하기 전 구현 금지.
- 추가 D1 전체/곡별 스캔, 모든 사용자 좋아요 재조회, bounded Feed repair를 이벤트 검출기로 대체, 브라우저의 임의 Track ID를 신뢰하는 우회 중 하나라도 필요하면 설계 **FAIL**로 되돌려 대안 검토.

## 단계 A 착수 결과: 실제 변경곡 ID 검출 SQL 프로토타입 (2026-10-08)

- GitHub `preview` 코드 신규: `scripts/verify-rtdb-public-like-returning-prototype.mjs`, commit `8caedb742ed0a5812fde0b44d8544a78d80b772f`. 외부 네트워크·실 DB·Firebase 없음. Node.js 22 `node:sqlite` in-memory만 실행. **Worker / Functions / Rules 어디에도 연결되지 않음**.
- 현재 Worker의 `cloudflare/explore-worker/patches/040-explore-like-w1-delayed-count.mjs` `processExploreLikeAggregateWave035`는 현재 SQL에 `INSERT OR IGNORE INTO likes` / `DELETE FROM likes` 문장이 이미 포함됨(기존 D1 batch). 각각의 기존 쓰기에 SQL `RETURNING track_id`를 결합하는 후보를 개발자 PC의 격리 SQLite에서 테스트함.
- 실제 Node22 실행 출력: `RETURNING_INSERT_ONLY_REAL_CHANGE=PASS`, `RETURNING_DELETE_ONLY_EXISTING=PASS`, `RETURNING_BOUNDED_CHANGED_TRACKS_NOT_FIRST_PAGE=PASS`, `RETURNING_NO_EXTRA_SELECT_SQL=PASS`. 전체 4/4 PASS. 목록 밖의 곡도 이벤트 대상, 중복 쓰기·없는 좋아요 해제는 결과 0 확인.
- **증명의 정확한 한계:** 기존 스케줄러/069 병합 쿼리·Cloudflare D1 batch `RETURNING` 호환성·성능·기존 R1/W1~W2 물리계측은 확인하지 않음. Node `sqlite`의 mock SQL은 실제 Worker aggregate에서 쓰는 CTE·트랜잭션 전체 복제가 아님. 결과가 있을 때 `rows_read`가 0이란 뜻 아님. 새 source code는 runtime에 import/실행되지 않으므로 서비스 개선이 배포된 것도 아님.
- 특히 현행 aggregate는 `positiveTracks/negativeTracks/insertedLikes/deletedLikes/processedBatches` **숫자만 반환**하고 확정 `trackId`, 서버 eventId 및 ownerUid를 모든 곡에 대해 노출하지 않음. Worker scheduled processing이 여러 전송을 합치므로 사용자 ACK 시각에 있는 정보만 서버 신뢰 이벤트로 서명하면 안 됨.
- **다음 게이트:** (1) 기존 aggregate CTE가 모든 변경곡 ID를 바로 결과로 반환할 때의 정합성/실제 D1 meta 비용을 *격리* 런타임에서 확인; (2) 마지막 canonical 정착과 R2 공개 숫자 생성 시점 보장; (3) Worker→Firebase Functions 서버 인증, 자동 재시도 및 idempotent 수신 경로를 추가 D1 W 없이 설계·검증. (1) 불합격이면 `RETURNING`을 현행 운영 코드에 도입하지 않음.
- 운영 공유 RTDB 규칙·원본 데이터·Worker·Functions·Hosting·TEST·PRODUCTION 전부 그대로 둠. 이 프로토타입을 배포 기능으로 오해하지 않는다.

## 단계 A 추가 구현: 배치 결과 검증기 (2026-10-08)

- `cloudflare/explore-worker/runtime/like-confirmed-event-397.mjs` **신규 순수 함수** `extractChangedLikeTrackIds397(batchResults, maxTracks=50)`. Worker/Functions에서 **아직 import하지 않으며**, 런타임 코드/배포 변화 없음. GitHub commit `216fdb1202f4d533761c10abf929850cacb2a738`.
- 실제 patch040의 `env.DB.batch` 배열 인덱스 2(좋아요 INSERT), 3(좋아요 DELETE)에서 SQL `RETURNING track_id`가 결과를 반환했다는 것을 전제로 **정확한 changed track IDs**만 합친다. `meta.changes !== results.length`, 결과 누락, 비정상 ID, 50개 초과면 명시적으로 FAIL. 변경 0이면 빈 목록.
- `scripts/verify-rtdb-public-like-aggregate-extract-397.mjs` 신규. Node22 순수 검사: 정확한 변경 1/2, 중복, W0, RETURNING 누락, null 결과, 비정상 ID, 초과 건수, metadata 누락 등 **8/8 PASS**. 앞선 인메모리 SQLite `RETURNING` 검증 **4/4 PASS**, 합계 **12/12 PASS**. Node22 `--check` 문법 확인 PASS.
- **엄격한 한계:** 인메모리 단위 테스트와 실제 D1 메타는 별개. 본 모듈은 쓸 수 있는 신호만 판별할 뿐 RTDB 발행·서버 인증·중복 수신 방지·실제 Cloudflare Worker D1 통합은 아직 없다. W1/W2 물리 비용·PC↔모바일 변경 수렴·10만명 팬아웃 해결은 미검증. 불완전 결과는 알림을 발행하지 않고 정지해야 하며, 실제 retry/복구 구현 전에 운영 경로에 연결 금지.

## 디렉터 승인 목표 — 정상 기능 전부 보존

1. 기존 공개 좋아요·해제, 공개 likeCount, 내 꽉찬 하트, 같은 계정 PC↔모바일, 서로 다른 계정의 공개 숫자 갱신, 30초 마지막 클릭 묶음, W1 queue, 5초 R2 정착 경로 보호. Studio 저장 하트·Music Note·Library·팔로우는 이 작업에서 변경 금지.
2. 공개 숫자는 반드시 R2/서버 확정으로만 갱신, RTDB 알림은 절대 숫자나 개인 membership의 권위가 되지 않음.
3. 공개 알림은 실제 canonical ACK를 증명한 **신뢰 가능한 서버**만 쓰기, 일반 로그인 계정은 최종적으로 public node 쓰기 0.
4. 관계없는 곡을 보고 있는 사용자에게 반복 전달하지 않음. 전송량은 전체 회원 수보다 **실제 필요 곡의 활성 시청자 수**와 신호 수에 비례.
5. 정상 캐시 페이지 재방문/앱 업데이트/방치: 원본 D1/Firestore R0/W0 목표. 수신 알림의 R2 only·bounded retry; D1 W1~W2 hard gate, W3+ FAIL.
6. PREVIEW·TEST·PRODUCTION의 공유 사용자 원본 변경·복제·backfill·삭제 없음; 구형 앱과 새 앱 동시 사용 시 좋아요·숫자 불일치 금지.

## 고정 작업 순서 — 절대로 규칙부터 잠그지 않는다

### 단계 A. 서버 발행 신뢰 경로 프로토타입 (기능 플래그 OFF, 배포 금지)

- Cloudflare에서 **실제 성공·변경된** canonical 좋아요 이벤트만 뽑아, 서버 간 인증된 작은 변경 ID/정착 시각을 전달한다. 단순 브라우저 전달값, uid, trackId, client timestamp만으로 발행 권한을 주지 않는다.
- 기존 Firebase Functions의 Admin RTDB SDK 사용을 우선 검토한다. Worker ↔ Function 서버 간 인증은 양측에만 저장한 전용 비밀/서명(HMAC 등), 짧은 유효기간, UID/곡/acceptedAt/operationId 결합, 재전송 보호. 비밀을 브라우저에 포함하거나 공개 GitHub에 기록하지 않는다. 인증 없는 HTTP Function은 절대 배포 불가.
- 사용자 1회 액션 → accepted batch → canonical 정착 → 송신해야 함. 백그라운드 사용자나 브라우저 종료에 알림 전송을 의존하지 않는다. 전송 실패 시 canon mutation을 다시 수행하지 않으며 durable bounded notification-only 재시도 설계 필요. 기존 DO 이벤트/재시도 저장 경로를 재사용할 수 있는지 코드 수준 검증 우선.
- `functions/src/index.ts`에서 Admin RTDB 게시 선례만 재사용한다. 새로운 공개 함수가 비용/잠재 남용을 유발하지 않도록 rate limit, idempotency, 요청당 변경곡 cap, 메모리·시간·인증 실패 경계 필요.
- 미확정 기술 조건: 현재 Worker 배치 정착 흐름에서 새 D1 reads/writes 없이 확정 `changedRows`를 얻을 수 있는지, 실현 가능한 Worker→Functions 인증/비밀 배포 경계. **둘 중 하나라도 증명 실패하면 구현 중단**, alternative/비용 보고.

### 단계 B. 무해한 새 RTDB V2 채널 + 수신 범위 실험 (기존 기능 동결)

- 현재 `publicSync/exploreLike`의 읽기·쓰기·payload는 그대로 둔다. 새 서버 전용 `publicSync/exploreLikeV2/{scope}/{trackOrBucket}`를 **추가만** 검토. 초기에는 선택된 테스트 계정/테스트 곡에서만 사용하고 전체 사용자 원본·Feed를 복사하거나 scan하지 않는다.
- **두 방식 병렬 비용 비교**:
  (1) 실제 화면에 보이는 개별 곡에만 소량 RTDB 구독,
  (2) 고정 개수 해시 bucket을 필요한 화면 곡에 맞춰 제한 구독.
  50~100곡의 로드된 비가시 목록을 모두 구독하지 않는다. 스크롤 시 구독 흔들림, 첫 진입 읽기, 브라우저 복귀, RTDB 연결 재사용, active listener 수·payload 및 Worker R2 재확인 빈도를 함께 실측.
- 기존의 `tracks/popular/curated/profile/liked` 모두 반영. **현재 화면에 진입해 있는 실제 곡만** bounded 구독하면, 이전에 offscreen에서 바뀐 곡을 나중에 볼 때 최초 수신 또는 기존 R2 갱신으로 반드시 정산되어야 한다. 억지로 전체 곡/전체 카드 refresh 시키면 FAIL.
- 샤드 64/256/1024는 **비교 후보**이지 확정된 값이 아니다. 곡 수가 적거나 인기곡 편중일 때도 합리적인 수신·구독 비용인지 계측 후 선택한다. 한 핫곡을 실제로 보고 있는 사용자들에 대한 알림은 보존한다. 10만 가입자 수는 실시간 동시 구독자 수와 다르다.
- 동일 곡의 좋아요→해제, 동시 서로 다른 계정, 최신/인기/추천/공개프로필, PC/모바일, 마지막 acceptedAt, timestamp skew 및 older-watermark 반영 여부를 검증한다.
- 버전 변경만으로 캐시 삭제, 기기별 전체 재조회 및 숨은 RTDB write 금지.

### 단계 C. 구형 앱 신호 보호 및 관리자 경로 차단

- 새 서버 발행이 **모든 버전의 canonical batch**를 빠짐없이 포착하고, 필요하면 기존 `publicSync/exploreLike` 신호까지 서버가 대신 발행하도록 한다. 서버↔구형 앱 공개 숫자 수렴 실제 A/B 검증 전에는 구형 전역 신호를 제거하면 안 된다.
- 구형 클라이언트도 직접 전역 신호를 계속 시도할 수 있다. 기존 브라우저 발행과 서버 중복 게시로 RTDB 트래픽이 늘지 않게 **전환 단계별 플래그·이벤트 중복제거·측정** 필수.
- 서버가 기존 신호를 대체하는 것까지 확인한 다음, live `database.rules.json`의 전역 신호에 대한 **일반 클라이언트 `.write=false`**를 마지막에 적용한다. 구버전 수신 경로는 서버가 유지하므로 기존 공개 숫자를 잃지 않도록 한다. Admin SDK는 규칙에서 거절된 일반 쓰기와 다른 서버 전용 경로.
- 이 RTDB는 PREVIEW·TEST·PRODUCTION과 공유할 수 있으므로 **Rules 변경만 PREVIEW 단독으로 안전 적용된다고 볼 수 없음**. 구버전 호환 검증과 모든 환경 영향 서명 승인 게이트 선행.
- 장기적으로 신규 앱은 V2만 구독. **구버전 앱이 남아 있는 동안 기존 전역 서버 방송 비용은 완전히 사라지지 않는다**. 100% 비용 절감과 구버전 실시간 호환을 동시에 보장할 수 없는 구간의 기간·실측 비용을 별도 보고. PRODUCTION 승격은 명확한 사용자 승인 필수.

### 단계 D. 독립 감사·실사용·승격

- Test matrix: 거짓 uid/trackId/중복·재전송 인증 실패, 일반 클라이언트 전역/V2 쓰기 거부, 정당한 accepted 이벤트만 방송, 누락/역전/서버 R2 지연·실패 후 bounded 복구, 여러 동시 좋아요/해제, 영구 캐시 복귀, 구형 앱, PC↔모바일/타계정.
- 10만 가입/활성 10/100/1000/10000 기준 **RTDB sent_bytes 실제 단위 측정**, 초기 구독 바이트와 변경당 fanout, Functions 호출·Worker/DO CPU·R2 요청, D1 R/W, 서버 저장. 단순히 global broadcast 제거하고 함수 호출·R2/D1 비용이 더 커지면 FAIL.
- TypeScript, Build, scripts/verify-192, verify-396, verify-197 및 기존 127/175/178/192 좋아요, Worker/W1·팔로우/Studio 보호 회귀 PASS. Codex commit 고정 후 Work 독립 감사. 사용자 PREVIEW 실사용 확인 전에 TEST 승격 불가.
- 긴급 rollback은 구형 공개 알림 수신을 보존한 상태에서 서버 발행을 원래 확정 경로로 돌릴 수 있게 설계하고, **규칙만 원복해 무단 발행을 영구 허용하는 것을 정상 롤백으로 간주하지 않는다**.
- 단계 3 별도 작업: PC에서 클릭하고 1~3초 내 완전 종료→10분 후 모바일 접속 문제. 지금 작업은 그 개인 intent/미전송 canonical 문제를 해결했다고 주장하지 않는다.

## 실측 전에 사용할 가정 모델 — 가격이 아니라 전송 범위 비교

- 전역 알림: `1회 × 그 순간의 모든 활성 Explore 수신자 × 그 순간 전체 묶음 크기`.
- 선택 구독: `1회 × 실제 해당 track/bucket을 듣는 활성 수신자 × 해당 신호 크기`; **추가 구독/초기 다운로드 비용**과 서버 발행 비용을 별도 더한다.
- 예: 동시 Explore 10,000기기 중 보이는 곡 12개, 균일하게 256 버킷에 분포한다는 매우 제한적인 가정 → 임의의 1개 버킷 수신확률은 `1-(255/256)^12 ≈ 4.6%`. 현실의 인기곡/카드 편중은 더 높으므로 이 수치는 실제 절감률을 보장하지 않는다. 개별 곡 직접 구독은 수신량을 더 줄일 수 있지만 리스너 개수는 늘 수 있다.
- 실측이 없는 상태에서 월 1억 원 등 과장된 단일 비용을 확정치로 보고하지 않는다.

## 다음 Codex High 작업 (독립 감사 이전, 기본 배포 없음)

**제일 먼저 단계 A를 대상으로 읽기 전용 구현 가능성 검사/설계 보강을 한 흐름으로 완료**. 파일 소유 `cloudflare/explore-worker/canonical/preview-entry.js`, canonical Worker W1 배치/DO 경로, `functions/src/index.ts`, `src/services/exploreLikeService.ts`, `database.rules.json`. 기존 함수/인증/비밀 바인딩/배포 Workflow를 확인하고, 변경곡 기반 W1~W2 및 서명 신뢰 경계의 실제 가능한 최소 패치를 제시한다.

결과물: 안전한 인증 방식, 정확한 publish 시점/데이터, 재전송/중복 처리, LIVE Rules 컷오버 영향, Functions/Worker/RTDB 추가 비용, 별도 배포/비밀 설정 범위, 사용자 권한 작업, 테스트 및 rollback. Stage A가 구현 가능한 것이 증명되기 전 Stage B~C를 한꺼번에 수정하거나 현재 정상 앱382 기능을 건드리지 않는다.

**이번 설계 문서 커밋 자체는 배포/서버·브라우저 코드 변경 0.**

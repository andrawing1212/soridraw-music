# SORIDRAW CURRENT RELEASE STATE

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

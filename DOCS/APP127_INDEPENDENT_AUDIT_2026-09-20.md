# 앱127 좋아요 독립 코드 감사 — 2026-09-20 KST

대상 고정 `preview` commit: `7f744f7cf8d93148368d1c926ee5dc61703a6887`

판정: **FAIL — PREVIEW 배포 및 TEST 승격 중단**. 이 감사는 GitHub 고정 코드와 현재 문서, 127 검증 기록에 대한 ChatGPT 독립 정적 검토다. 별도 Work 실행·실제 기기·원격 데이터 조작을 수행한 것으로 표시하지 않는다.

## 확인한 PASS 범위

- Run [35498983342](https://github.com/andrawing1212/soridraw-music/actions/runs/35498983342): 127 optimistic 전이, 126/125/124/123/110 정적 회귀, TypeScript, Build, Worker071 코드 SHA 검사 PASS. 단, 이 검사는 서로 다른 앱 버전, 실제 RTDB 알림 누락, 장기 네트워크 오류를 실행 검증하지 않는다.
- 한 곡의 로컬 클릭에서 본인 membership과 임시 표시 숫자를 동일 계산으로 만들고, 타 사용자 좋아요가 포함된 공개 숫자를 개인 하트에서 역산하지 않음.
- 30초 묶음 저장, 원본 D1 스키마, 앱126 라이브, Worker071 및 보호 환경은 이 코드 작업에서 변경되지 않음.

## BLOCKER 1 — 구형 앱과 공존하면 하트 stale 재발

- `exploreLikeService.ts`의 `publishConfirmedLikeSignal127`은 앱127의 ACK 뒤에만 RTDB `userSync/{uid}/exploreLike`를 갱신한다. 사용자 데이터 원본을 공유하는 **실제 라이브 앱126 및 TEST/PRODUCTION 구형 코드에는 이 게시자가 없다.**
- `ensurePersonalLikeBaseline127`은 UID별 localStorage marker가 1이 되면 해당 기기에서 추가 검사를 하지 않는다. `getExploreLikedTrackIds`는 캐시에 이미 있는 곡 ID를 `/v1/me/likes`로 다시 확인하지 않는다.
- 재현: 모바일 127 최초 R2 개인 상태 검사 완료 → PC 126에서 같은 곡 좋아요 해제, Worker 정상 반영 → 모바일 127의 RTDB 알림 없음 → 모바일의 개인 하트는 이전 true를 무기한 보유 가능. 공개 숫자 갱신은 개인 소유 상태를 증명하지 못한다.
- 이 문제만으로 사용자 사진의 재발 방지 합격 불가. **구형 앱에서 발생하는 변경도 한 계정의 개인 변경으로 확인할 수 있어야 함.**

## BLOCKER 2 — 알림 유실 후 복구 실패가 고착

- `applyRemoteLikeSignal127`의 gap 처리에서 `markSeenLikeSignal127(uid, signal.version)`을 먼저 호출하고 단 한 번 `EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT`를 보낸다.
- `ExplorePage.tsx`의 `onGap`은 baseline marker를 지운 다음 현재 페이지 hydrate를 다시 시도한다. `ensurePersonalLikeBaseline127`은 오류 시 기존 값을 남기지만 성공할 때까지 자동 반복되지 않는다.
- 재현: 알림 gap → R2 요청 한 차례 503/네트워크 실패 → 기존 stale 하트 유지, signal version은 이미 완료 처리 → 같은 RTDB 값이 재전달되어도 `signal.version <= lastSeen`으로 무시 → 화면에 머물러 있으면 복구 재시도 트리거 없음. 다시 클릭해도 membership이 확인되지 않아 차단될 수 있음.
- 성공 후에만 완료 처리하거나 별도 durable pending-repair를 유지하고 재접속·포커스·다음 진입에서 제한된 재시도가 필요하다. 실패를 단순히 `false`로 취급해서는 안 된다.

## BLOCKER 3 — 반대 기기 동시 변경의 최종 원본과 신호 순서 분리

- `flushPendingLikes`는 Worker의 큐 접수 ACK 직후 RTDB 알림을 게시한다. 이 시점은 최종 `likes` 관계/D1 집계 완료와 같지 않다.
- 서로 다른 기기가 같은 곡을 반대로 누르거나, R2/queue 갱신과 RTDB transaction이 실패·재시도되는 경우: RTDB 버전 순서와 canonical 최종 적용 순서가 반드시 같다는 증거가 없다. 소비자는 RTDB 결과를 검증 없이 개인 cache에 확정한다.
- 한 계정·한 곡·두 기기 동시 변경에 대해 최종 원본이 정하는 규칙(최신 client intent 또는 마지막 server apply)을 정하고, 같은 ID의 순서 역전·중복 ACK·늦게 도착한 신호를 실행형 검사해야 한다.

## 비용 위험 — 수치 PASS 아님

- 앱127은 로그인 중 `onValue` 계정별 listener 한 개를 추가하고, 변경이 있는 batch마다 RTDB transaction을 하나 추가한다. RTDB는 D1 read/write와 별도 비용이며, Firebase 문서상 내려받는 바이트와 네트워크·세션 오버헤드가 과금된다. 기존 RTDB 연결을 재사용할 수 있으므로 listener 1개가 무조건 새 물리 연결 1개라고 단정할 수는 없다.
- 최초 R2 baseline은 캐시 보유 127 기기마다 1회이고, `likedTrackIds` 전체(최대 2,000 ID)를 전송한다. R2 없는 예외는 Worker에서 D1 복구를 실행할 수 있다. 최초 10만 명 로그인 비용과 실패 반복에 대한 실제 측정 없음.
- RTDB payload는 변경당 최장 50개 retained row, 데이터 사용량은 가입자 기기 수·로그인 수·연결 오버헤드에 영향을 받는다. 단순한 'D1 R0/W0'만으로 비용 합격 아님.
- 공식 가격 참조: https://firebase.google.com/docs/database/usage/billing ; https://firebase.google.com/pricing ; https://developers.cloudflare.com/r2/pricing/
- D1 mutation 당 실사용 `rows_written` W1~W2, RTDB 다운로드 및 추가 transaction, R2 읽기·쓰기 수는 미측정.

## 다음 수정 명령 (기본 Codex High; 공유 데이터 migration 금지)

1. **구형 앱 공존을 먼저 설계**: 앱126/TEST/PRODUCTION이 실제로 쓰는 기존 사용자별 R2 좋아요 bundle의 작은 변경 신호(ETag/updatedAt 등)를 인증된 경로에서 bounded 확인하거나, 무조건적인 50곡 D1 읽기 없이 실제 변경된 대상만 재검증. 현재 Worker071만으로 모든 writer가 신호를 남길 수 있는지 확인하고, 불가능하면 먼저 하위호환되는 Worker 변경의 배포 범위를 따로 보고한다. 개인 소유를 공개 count에서 추정하지 말 것.
2. gap repair는 영구 미완료 상태에서 신호 완료로 표시하지 않고 성공할 때만 확정; R2 장애 후 제한된 재시도/포커스/재진입, pending local outbox 우선 보장.
3. RTDB ACK vs 최종 canonical 순서를 검증·해결. 서로 다른 두 기기 동시·역순, 반대 클릭, offline/batch 실패/네트워크 회복 실행형 검사 추가. 2천 ID 한도는 무기한 좋아요 불가 상태를 만들지 않도록 설계하되 기존 데이터 파괴·전체 조회 금지.
4. 10만 명 기준 비용 경로 비교(추가 listener와 R2 revision polling 포함); 실제 사용자 데이터를 쓰지 않는 mock/제한된 테스트 계정으로 W1~W2 및 PC↔모바일 검사. PASS 확인 후 새 commit, TypeScript, Build, Test 재실행 및 별도 독립 감사.
5. 사용자 명시적 프리뷰배포 승인 전 Hosting/Worker 변경 금지. app-version 126 그대로 유지. main/TEST 및 production/PRODUCTION 변경 금지.

**최종 상태:** 제품 127 소스는 `preview`에 있으나 안전성 미확인. 라이브 PREVIEW 앱126 + Worker071 유지. 이 감사 자체는 사용자 데이터 read/write 및 배포를 실행하지 않았다.

# Stage416 ③ — 개인 좋아요 마지막 클릭 +5분 저장 / Master 관리자 독립 설정: ChatGPT 직접 개발 기준
날짜: 2026-10-10 KST

## 1. 출발선과 현재 상태
- **진행 1/5 완료**: ① 사용자 요청 보류·미해결, ② PC↔모바일 개인 하트 거의 즉시 변경 **사용자 실사용 PASS**(2026-10-10 12:47 KST), ③ 구현 전 코드 경로 분석 진행, ④ 공동공개 기본5분·Master 별도 설정 대기, ⑤ 독립/비용 감사 대기.
- **현재 사용자 검증 정상 서비스**: PREVIEW app392, exact release `dc1b96d05e4abb9a673f0b5ac508237afd0573d1`, Firebase shared RTDB 신규 private child 단일 additive 배포 완료. TEST/PRODUCTION Hosting/Worker는 변경하지 않았음.
- **개발 주체**: 사용자 지시에 따라 Codex 미사용, ChatGPT 직접. 작업은 `preview`에서만. 실제 검증 통과와 사용자 지시 없이는 TEST/PRODUCTION 승격 없음.
- **③ 계약**: Master 선택 1·3·5·10·20분(기본5분), 개인별 **마지막 클릭** 이후 최종 의도만 묶어서 canonical 서버 접수. 정책 변경은 이미 시작된 개인 창에는 영향 없고 다음 창부터. ② 즉시 개인 RTDB 알림/하트와 서버 원본 ACK는 별개. ④ 서버 접수 후 공개 공동집계 +5분은 **미구현**이며 ③과 혼동 금지.

## 2. 실제 코드에서 확인한 함정 — 수정 전 STOP 게이트
1. `src/services/exploreLikeService.ts` `EXPLORE_LIKE_IDLE_FLUSH_MS_120=5_000`와 `schedulePendingFlush`는 `latestEligibleUpdatedAt + 5초`를 계산한다. **이 상수만 300_000으로 치환하면 요구를 충족하지 못한다**.
2. `installExitFlush413`은 **`visibilitychange: hidden`에서도 `flushOnExit413`을 실행**하고 `pagehide`에서도 실행한다. 백그라운드/앱 전환은 반드시 종료가 아니다. ③ 5분 대기 도중 잠깐 다른 앱으로 전환하면 5분보다 일찍 서버 원본 저장될 위험이 있음. 실제 close/onExit best-effort 시도와 보통 background/minimize를 분리해야 한다.
3. 기존 `readLikeOutbox`는 곡별 `updatedAt/queuedAt/operationId/expectedRevision/retryCount`를 영속 저장하지만, **UID별 정책 revision + 현재 창의 선택된 1/3/5/10/20분 snapshot/deadline은 별도로 영속 저장되지 않는다**. Master가 변경해도 현재 창이 유지되도록 별도 안정된 snapshot 계약이 필요.
4. `flushPendingLikes`의 `inflightByUid`와 `rebaseExploreLikeAfterInFlight127` 및 `exitFlushArmed413`를 보호. 새 클릭이 전송 중이면 옛 ACK가 최신 intent를 제거하지 않으며, 모호한 실패는 무한 retry하지 않아야 함.
5. `setExploreTrackLike`는 ② private `publishExploreLikeIntent416`을 현재 클릭마다 곧바로 호출한 다음 `schedulePendingFlush`를 호출한다. 이 개인 private signal은 ③ 5분으로 느려져서는 안 됨. 본인 하트·동일 계정 타기기·내 좋아요 목록 최신 반영과 server write를 강제로 연결 금지.
6. 앱 재실행에서 영속 outbox를 우선하고, 최초 앱 업데이트/정상 페이지 재진입에서 전체 R2/D1/Firestore 좋아요 재조회 금지. 5분 중 앱이 완전히 종료되면 JS 타이머 보장이 불가능하므로 **성공한 조기전송 또는 다음 실행 시 재개·기한 초과 bounded flush**로 정확성 보존. 모바일 OS 강제종료에서 보장 불가를 실사용 설명에 명확히 기록.
7. 개인 원본 ③ 5분 접수와 공개 ④ 5분 공동집계는 두 별도 시계. 지금 Worker의 공개 집계 방식은 변경되지 않았음. ③에서 개인 ACK가 지연된 만큼 공개 변화도 일찍 게시될 수 없지만, **서버 ACK 후 공개 숫자도 추가로 꼭 5분 늦어진다는 주장은 아직 불가**.

## 3. Master 관리자 설정 보안 및 비용
- 관리자 UI 현재 소유: `src/pages/AdminAppSettingsPage.tsx`, 기존 `/admin/app-settings` 탭. 일반 Admin도 접근할 수 있으므로 새로운 **개인 좋아요 서버 저장 대기** 설정은 Master에게만 노출/수정. 계획된 별도 **공개 좋아요 공동집계** 설정은 ④에서 같은 화면에 독립 배치.
- 현재 `src/constants/adminPermissions.ts`의 `hasAdminPermission('appSettings')`는 Master 전용이 아님. **UI 숨김만으로 보호했다고 주장 금지.**
- Functions `functions/src/index.ts`에 이미 `requireMasterCaller(request)`이 구현되어 있음. 새 정책 저장은 이 서버 권한 검증 또는 동등한 Master-only API 사용. 변경자 UID·시각·previous/new/적용 policy revision 감사 기록. 일반 Admin·공개 이용자가 Firestore `app_settings` raw setDoc으로 우회하는 길도 금지.
- `firestore.rules`는 현재 `app_settings/{docId}`에 `hasAdminPermission('appSettings')` 전체 쓰기 허용. 신규 설정 문서를 만들 때 **그 문서만 Master-only로 좁힌 additive 분기**를 검토. 기존 app_settings 문서 권한은 수정하지 않는다. 실사용 공유 Rules이므로 PREVIEW/TEST/PRODUCTION 구형 호환 preflight 필요.
- 기기마다 클릭 시 설정 전체 Firestore GET / 재진입 시 GET 금지. 기본5분은 로컬 fallback; Master 서버 정책 변경 신호는 작고 캐시 가능해야 함. 설정 revision은 앱 버전과 분리. **기존 창이 열려 있다면 새 정책이 다운로드되더라도 해당 창 deadline은 절대 변경되지 않음.**

## 4. 구현 순서
1. 실제 source 계약을 실행형 테스트로 고정: ② app392 빠른 UI 전송 / 127/175/180/191/192/197/390/417/follow 동결 PASS, 기존 `visibilitychange` 조기저장 반례 재현.
2. 순수 정책 모듈(1/3/5/10/20 유효값+기본5분; 각 창의 `revision/selectedMinutes/firstStartedAt/latestClickAt/dueAt` 보존; 이전 창 안정성), 동일 UID 여러 곡 마지막 클릭 trailing 및 net-zero 합치기 테스트.
3. 영속 outbox/scheduler 변경: 프로그램 내부 timer는 1개 per UID, 첫 클릭에서 개인 창 정책 snapshot; 새 클릭은 동일 정책 유지하며 dueAt만 연장; UID 서로 분리. 서버 accepted 및 재전송 부분은 건드리지 않는다.
4. background/minimize vs 실제 종료/페이지 종료 best-effort 분리. 필요하면 명시적 exit 정책 상충 사항 먼저 보고. 앱 재실행·오프라인 5분 초과 재연결·충돌 스케줄 테스트.
5. Master 설정의 단일 server-authority endpoint/Rules/작은 revision 신호, UI 및 감사 로그. 앱 UPDATE만으로 Firestore GET/RTDB 전체조회 증가 없어야 한다.
6. 새 기능 + 기존 회귀 TypeScript/Build/QA/Work 독립 읽기 전용 검증. Cloudflare Worker/Functions/RTDB/Firestore shared 변경이 필요한 경우 실제 세 환경 호환 확인. PREVIEW 안전 통과 시에만 앱 다음 버전 배포.
7. 사용자에게는 배포 후 ③ 전용 확인 항목만 안내: 1분 테스트 환경(정말 설정이 정상 저장·적용된 경우), 5분 기본/마지막 클릭 리셋/여러 곡·원상복구/타기기 즉시 유지. ④ 5분 공개 공동집계를 당장 기대하지 않도록 고지.

## 5. 릴리스 중단 조건
- ② 사용자 확인 양방향 즉시 하트, 기존 liked/canonical state, 신규곡 첫 좋아요, 팔로우, Music Note/Library가 약화되면 FAIL.
- Master 아닌 계정이 정책을 바꿀 수 있거나, 기존 shared Firestore/RTDB rules가 무단으로 변경되거나, 기존 pending outbox 업그레이드에서 intent가 사라지면 FAIL.
- 5분 타이머만 바꾸고 minimize가 즉시 flush되면 FAIL.
- page entry/update/재방문 서버 write/전체 조회 발생 또는 R2/Worker/DO/D1 사용량 증분을 확인하지 못하면 배포 HOLD.
- 별도 사용자 명시 승인 없는 TEST/PRODUCTION 및 공유 사용자 원본 파괴적 작업 금지.

**현재 결론:** Stage② 실기기 PASS, Stage③는 코드 경로/권한/호환성 선행 분석 중. `app392` 실제 동작 유지, Stage③ 기능 코드/Functions/Firestore Rules 아직 수정·배포하지 않음.

# app382 RTDB 10만 회원 비용·남용·동기화 복구 감사와 실행 순서

작성: 2026-10-08 KST / 상태: **1차 GitHub 정적 감사 완료, LIVE 비용/배포 규칙 미검증, 수정 전**
영구 기준: repository andrawing1212/soridraw-music, branch preview, 기준 HEAD 95a87755d68d28f33003e72dc7e5fdfe2392c2f0
현재 실제 PREVIEW: Hosting app382, source 6c5fa3fdb3f898b62fffacbba54e7bd63013f95a, deploy trigger 178e72c51effbd867ea6f6e45f5df9370723a31f, Firebase Run 37722012753 SUCCESS, Worker c4c51b19-818a-4eaf-8be1-aca0b241d50a. TEST/PRODUCTION은 이 작업에서 변경하지 않는다.

## 1. 감독 목표와 작업 순서 — 새 채팅에서도 순서 고정

목표: 10만 회원에서도 앱 업데이트/재진입/대기만으로 원본 D1·Firestore 읽기 증가 0 목표. RTDB도 데이터가 변한 항목만 필요한 수신자에게 전달. 모든 비용 절감은 기존 좋아요·팔로우·Music Note·Library의 정상 기능과 정확성을 보존한다.

**순서 1 — RTDB 비용·보안 집중 감사 (현재 단계).**
- GitHub RTDB 구독/기록 경로 전수 확인, 공통 신호의 수신자 수, 메시지 크기, 호출 빈도, 과거 신호 재전달, 동시 수정 및 악의적 반복 요청 위험 분석.
- Firebase Console RTDB Usage 실측: 24시간/30일 다운로드 GB, 동시 연결, 저장 GB, load, 1회 세션의 연결/재연결. 안전한 read-only profiler로 상위 read/write/broadcast 경로와 payload 측정. profiler는 통신/SSL overhead를 포함하지 않으므로 과금액은 Console Usage 기준.
- GitHub database.rules.json의 규칙과 실제 배포된 RTDB rules 비교(현재 라이브 규칙 미확인); Firebase 앱 3환경이 공유하는 데이터/RTDB 프로젝트 경계도 실확인.
- 감사 산출물: 경로별 트래픽 매트릭스, 실측 근거, 비용 모델(10만 가입·DAU/동시 접속/활동 빈도 변화), 악용 시나리오, 차단 권고. 코드·Rules 배포는 이 단계에서 하지 않는다.

**순서 2 — 공개 좋아요 알림의 무제한 확산·남용 차단.**
- 공개 숫자의 다른 계정 실시간 반영을 없애지 않는다. 정상 캐시 사용자에게 D1 전체 조회나 주기적 Firestore 읽기를 전가하지 않는다.
- publicSync/exploreLike 하나를 모든 Explore 시청자가 구독하는 현재 설계의 fanout, 최대 50개 retained rows, runTransaction 경합을 줄이는 대안을 검토한다. 후보: 필요한 곡/영역만 제한 구독, 작은 변경 신호+정착 카드 캐시, 안전한 합계 재동기화 및 사용자별 수신 범위 축소. 선택은 실측/최소 기능 보존 테스트 후 결정.
- 현재 인증 클라이언트가 전역 신호를 쓸 수 있는 규칙을 인증된 서버 확정과 남용 제한이 보장되는 구조로 변경할지 설계한다. 규칙만 먼저 닫아 현재 앱 신호를 끊는 반쪽 적용은 금지. 데이터 하위호환과 전체 릴리스 묶음을 확인한다.
- 합격: 다른 계정 공개 좋아요 숫자 수렴, 같은 계정 채운 하트 일치, 한 번 클릭이 모든 무관한 가입자에게 O(N) 신호를 전달하지 않음, 변경 없음 재진입 원본 D1 R0/W0, Worker/R2 추가 비용 추적, 악성 반복 쓰기로 공개 전역 트래픽 증폭 불가능. PREVIEW 한정 검증 후 사용자 실기기 확인.

**순서 3 — 30초 이전 창 종료·기기 간 미전송 일관성 복구.**
- 재현: A(PC) 좋아요/해제 또는 팔로우/해제 후 1~3초에 완전 종료, 10분 뒤 A는 여전히 종료된 상태로 B(모바일) 접속, 최종 상태가 유지·수렴하는지 확인. A 재접속 후 미전송 outbox 복구와 별도로 검증.
- 현재 좋아요 30초 outbox는 송신 기기 로컬 저장, 다른 기기 RTDB 확정 알림은 D1 ACK 후 전송. 팔로우 역시 30초 확정 후 RTDB 알림. 따라서 A가 종료되고 서버 접수가 없으면 B가 A 로컬 변경을 알 수 없음: 기능/설계 갭.
- 해결은 개인별 작고 순서 있는 변경 의도 신호/안전한 서버 접수/최종 30초 확정/손상·오프라인 복구 계약을 하나로 설계. 즉시 UI preview를 승인된 canonical 저장으로 오인하지 않는다. 기기가 네트워크 ACK 전에 강제 종료되는 경우의 보장 한계도 명시.
- 기존 좋아요 app164/app160 freeze, app379 W1, 팔로우 app380 W1/30초 최종상태, Studio 저장 하트 app349의 별도 경로를 보존. 타임스탬프 역전·동시 클릭·오래된 신호 덮어쓰기·멱등성·실패 재시도 상한·RTDB 비용 테스트 필수.

**순서 4 — 최종 PC/모바일 및 비용 통합 감사 → PREVIEW 실사용 → 별도 TEST 승인.**
- 중요 회귀: 창 열림/숨김/다시 활성화/강제 종료/재접속/업데이트, 새 기기/기존 캐시, PC↔모바일 교차 좋아요·해제·팔로우·해제, 하트와 공개 숫자·My Likes/Following 1:1 일치.
- D1 실제 rows_written W1~W2 초과하면 FAIL, 정상 재진입/업데이트 data read 0 목표, 반복 social-snapshot 189 D1 행읽기 차단 또는 구체적인 예외 비용/근거 확인.
- 무변경 진입과 알림 재소비 때 Worker/R2/RTDB 불필요한 반복 요청이 없는지 확인. 앱/Worker/RTDB Rules가 연동돼야 할 경우 같은 PREVIEW 검증 단위로 다루되 shared user data migration/복제/파괴적 변경 금지.
- TypeScript/Build/관련 테스트, 독립 감사, 목표 도메인 실검증 완료 전 PASS/TEST 승격 금지. TEST는 사용자 테스트배포 승인 시, PRODUCTION은 명시적인 정식배포 승인 시에만.

## 2. 1차 정적 감사 결과 — 확인된 사실 (실서비스 계측은 아님)

| 경로/기능 | 현재 코드와 호출 | 위험/비고 |
|---|---|---|
| publicSync/exploreLike | src/services/explorePublicLikeSyncService.ts: RTDB onValue 공용 신호, 최신 3분/최대 50곡, canon 좋아요 ACK 후 runTransaction, ExplorePage 구독 | P0. 전역 fanout: 무관한 Explore 수신자도 RTDB 업데이트 다운로드. 클라이언트가 화면 관련 곡만 골라 R2 카드 조회하지만 수신 트래픽은 이미 발생. 50곡 전체 신호 재전달 가능 |
| database.rules.json publicSync/exploreLike | auth!=null 및 actorUid==auth.uid면 공용 위치에 쓰기 허용. rows 항목 형식 제한은 있으나 canonical D1 접수·사용자별 게시 속도 검증 없음 | P0. 로그인 사용자 악용 시 전역 쓰기/팬아웃 트래픽 위험. 실제 배포된 Rules와 일치 여부 미검증 |
| userSync/{uid}/exploreLike | src/services/exploreLikeService.ts: canonical 30초 배치 ACK 후 개인 결과 신호. uid-scoped onValue 수신 | 정상 계정별 제한. 창 종료 이전에는 전송되지 않는 구조적 갭 |
| userSync/{uid}/exploreFollow | src/services/exploreFollowSyncService.ts, ExplorePage: 30초 최종 확정 후 송신 | 정상 계정별 제한. 창 종료 이전 갭 |
| userSync/{uid}/musicNote 및 recentSongs | src/services/userDomainSyncService.ts: 계정별 RTDB signal/preview, 일부 JSON 최대 24,000자, 구독은 UID별 | 중간. 24KB급 payload가 발생하는지/모바일 2~3대 전송 비용 측정. Studio 저장하트 별도 동결 |
| userSync/{uid}/libraryPlaylist | src/services/playlistService.ts: 폴더/플레이리스트 동기화, payload 최대 24,000자 | 낮음~중간. UI/Firestore 중복 읽기 회귀 주의 |
| userSync/{uid}/explorePublication | 공개/비공개 변경에 계정별 전파, snapshot JSON 최대 24,000자 | 중간. 구체 payload 측정 |
| presence/{uid}/connections | src/services/presenceService.ts: 활동 동기화 최소 5분, 상태 유지 10분, 30초 check(매번 write는 아님), background/visibility/연결 끊김 기록 | 중간. 실제 연결 유지·복귀 전송량 검증. DEVICE_HISTORY_SYNC_ENABLED=false |
| publicSync/navigationVisibility / userControls/{uid} | 관리자 메뉴 공용 소형 신호, 개인 관리 권한 소형 신호 | 일반적으로 낮음. 메뉴 변경이 빈번하면 global broadcast 발생 가능 |
| 개인 social-snapshot | Cloudflare Worker GET /v1/me/social-snapshot; PERSONAL SETTLEMENT 189는 캐시 보정보다 무거운 D1 검증 가능 | 별도 P1. 업데이트/백그라운드 복귀/미확정 보정 반복 읽기 재현과 D1 R0 기준 감사 |

## 3. 비용 모델과 확인되지 않은 부분

RTDB 공식 Blaze 기준: 다운로드 무료 약 360MB/일(월 약 10GB 상당), 이후 $1/GB, 저장 1GB 무료 이후 $5/GB/월. 공식 가격 https://firebase.google.com/pricing
RTDB 청구는 데이터 다운로드뿐 아니라 세션 연결/SSL/프로토콜 트래픽을 포함한다: https://firebase.google.com/docs/database/usage/billing
Profiler는 패킷 오버헤드가 빠지므로 요금 측정 대용 아님: https://firebase.google.com/docs/database/usage/profile

공통 전역 신호 유발 다운로드의 1차 근삿값:
  월 GB = (일일 실제 확정 public-like 신호 수) x (발송 시점 평균 공통 신호 구독 기기 수) x (실측 평균 전송 KB) x 30 / 1,000,000
평균 동시 구독자는 전체 회원 10만과 다르고 시간대 집중도, 백그라운드 연결 상태, 반복 전송, 메시지 오버헤드도 검증 필요.
2026-10-08 대화의 low/normal/high 및 월 수천~수만 달러 추정은 **스트레스 가정**이며 실제 청구서/미래 매출 추정치가 아니다. 실측 없이는 확정 비용으로 사용 금지.
하나의 좋아요가 현재 읽기 0 Worker/W1이어도 RTDB 배포 비용이 자동 0이 되는 것은 아니다.

## 4. 단계별 체크포인트·중단 조건

순서1 PASS 요구:
- [x] GitHub 경로/Rules 정적 인벤토리 확보(위 경로)
- [x] 실제 fanout 위험 및 writable public signal 확인(GitHub source 기준)
- [ ] Firebase LIVE RTDB Usage 최근 24h/30일 다운로드, 동시 연결, Load, 저장 크기 확인
- [ ] 실제 PREVIEW/TEST/PRODUCTION RTDB Rules/프로젝트 경계 확인(READ-ONLY)
- [ ] 실제 가벼운 정상 세션 vs. 좋아요 1회 vs. 동일 신호 재구독의 다운로드/연결 오버헤드 계측
- [ ] 10만 명용 비용 상한/전송 범위 설계, 보안 악용 테스트 계획 검토
- [ ] 30초 종료 재현에서 좋아요/팔로우 outbox/캐시/개인 신호 상태 확인(사용자 공유 데이터 수정/대량 실험 금지)

순서2~4 구현 전 반드시 설계 검토: 기존 기능 보존, RTDB Rules 같이 배포해야 하는지, Worker/Firestore/D1 비용 전가 여부, 기존 앱 구버전과 동시 작동 가능한지, rollback, TEST/PRODUCTION 영향, 최소 변경 범위. 원본 공유 데이터 변환/삭제/백필은 승인 없이 금지.

실제 Live 계측 접근이 없을 경우 '**LIVE 측정 미검증**'을 명시하고 넘기지 않는다. 앱382 정상 공통 기능을 이유 없이 재작성하지 않는다.

## 5. 다음 담당자에게 정확한 실행 지시

1. AGENTS.md → DOCS/CURRENT_RELEASE_STATE.md → DOCS/NEXT_CODEX_TASK.md → DOCS/WORK_AUDIT_CHECKLIST.md → 이 문서 → preview HEAD를 다시 확인.
2. 코드 수정·배포 없이 순서1의 미완료 실측/RTDB active security 비교를 우선. 가능하면 Firebase 사용량 대시보드/읽기 전용 계측 연결로 확인.
3. 실측 확보 뒤 전역 RTDB 공개 좋아요 팬아웃/악의적 클라이언트 쓰기를 최소 수정으로 제한하는 대안 비교. 공개 숫자 반영 자체를 없애거나 모든 사용자의 D1 반복 조회로 대체하지 않는다.
4. 결정된 범위만 preview에서 구현/테스트/독립감사 후 안전하면 사용자 최신 배포 운영 지시에 따라 PREVIEW 배포. TEST/PRODUCTION은 명시 승격 승인 필요.
5. 단계마다 CURRENT_RELEASE_STATE.md, NEXT_CODEX_TASK.md 및 이 문서의 상태/검증 실측/최종 SHA를 업데이트. 지난 채팅을 사용자에게 설명하게 하지 않는다.

이 문서만 작성한 작업은 DOCS ONLY이며 앱 코드·RTDB Rules·Worker·Functions·Firebase Hosting·공유 사용자 데이터·D1 변경 0.

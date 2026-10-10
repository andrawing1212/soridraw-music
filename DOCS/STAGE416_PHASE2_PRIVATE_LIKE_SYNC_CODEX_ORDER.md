> **2026-10-10 실행 주체 변경:** 사용자가 Codex 대신 ChatGPT의 직접 구현을 지시했다. 이 문서의 'Codex High' 표현은 작성 당시의 역사적 작업 계약이며, 실제 제품 소스 후보는 ChatGPT가 `preview`에 구현·push했다. 최신 `DOCS/CURRENT_RELEASE_STATE.md 0S72`와 `DOCS/NEXT_CODEX_TASK.md`가 실제 상태다. **소스 작성은 끝났지만 TypeScript/Build/실제 RTDB rules/PC·모바일 동기화 검증은 미완료**, ②/5 PASS 아님, PREVIEW 배포 없음. 기존 app391 실서비스 유지.

# Stage416 ② — 개인 좋아요 5~10초 동기화 구현 명령 (2026-10-10 KST)

## 지위 / 고정 기준
- **Codex High 구현용 작업 문서. 제품 구현 완료가 아니다.**
- 브랜치 `preview`, 시작 확인 HEAD `953da3355cde32cb90ed021550b3a4b97d45c9a6`. 실제 착수 시 HEAD 재확인하고 추가 변경이 있으면 해당 diff를 먼저 검토한다.
- PREVIEW Firebase 앱 **391** 및 공유 RTDB 규칙의 optional `canonicalSettled417`는 사용자 실사용 정상 확인 기준. 정상 좋아요·해제·하트·내 좋아요·팔로우를 보호.
- 제품 목표: 클릭한 기기의 하트 즉시 / 같은 계정 다른 기기의 개인 하트 **5~10초 안에 자동 반영**. 서버 원본 확정과 공개 숫자 게시와는 반드시 분리. ③ 개인 최종 클릭 후 5분 저장, ④ 공개 공동집계 5분 및 두 Master 설정은 **별개 후속 단계**, 이번 단계에서 구현/타이머 전환 금지.
- ① '개인 소셜 스냅샷 반복 읽기'는 사용자 지시로 보류. PASS로 바꾸거나 임의 제거하지 않는다.
- 최종 기준은 `DOCS/LIKE_PRIVATE_IMMEDIATE_PUBLIC_5MIN_STAGE416.md`의 2026-10-10 사용자 확정 절과 `CURRENT_RELEASE_STATE.md` 최상단, `AGENTS.md` 및 좋아요 스킬의 동결 기준.

## 소스에서 확인한 현재 실제 원인
1. `src/services/exploreLikeService.ts` 현재 `EXPLORE_LIKE_IDLE_FLUSH_MS_120=5_000`; `schedulePendingFlush`가 마지막 조작에서 5초 기다린 뒤 Worker `/v1/me/likes/batch` 송신.
2. `flushPendingLikes`는 서버 ACK 및 개인 pending/cache 저장 후 `publishConfirmedLikeSignal127`를 호출하여 `userSync/$uid/exploreLike`로 RTDB 변경 ID/개인 하트+현재 likeCount 발행. 따라서 개인 알림은 서버 송신/ACK 처리 지연을 피할 수 없다.
3. `database.rules.json`의 기존 `userSync/$uid/exploreLike`는 `version/previousVersion/results`를 가지는 **확정 신호**. 기존 app391/구버전 수신기는 `normalizeLikeSignal127`/`applyRemoteLikeSignal127`로 이를 적용하며, 조건에 따라 `canonicalSettled417`를 확정 근거로 사용. 이 동일 노드에 미확정 신호를 섞으면 **구버전 호환성 위험**.
4. `src/pages/ExplorePage.tsx` 원격 UI 구독은 `source='remote'`만 처리하고 `readExploreTrackLikeMembership127`를 다시 검사한다. 로컬 저장/보호보다 먼저 UI 알림을 보내면 app140 이전의 '다른 페이지 다녀와야 보이는' 회귀 위험.
5. `normalizeExploreLikeDisplayPair129`는 채운 하트에서 `likeCount>=1`로 보정한다. **임시 개인 하트가 공개 숫자를 조기 게시한 것처럼 보이지 않게** 개인/공개 표시 계약을 정확히 검증할 것. 단, 이번 단계에 대규모 카운트/UI 재설계는 금지.

## Codex의 딱 하나의 구현 과제
**서버 확정 ACK 이전에 같은 UID의 다른 기기로 작은 개인 좋아요/해제 최종 의도를 안전하게 전달한다.**

- 기존 확정 RTDB `userSync/$uid/exploreLike`와 구버전 동작은 **그대로 유지**한다. 확정 전 개인 preview 전용 **별도 UID-private 노드**(예: `userSync/$uid/exploreLikeIntent416`)를 우선 검토. Firebase RTDB 외 새로운 서비스/별도 DB/FCM/WebSocket/폴링 도입 금지.
- 새 노드가 필요하면 `database.rules.json`에 **이 노드만** append-only/additive 형식으로 설계. 기존 규칙/권한/다른 노드를 교체·축소하지 않는다. 인증 `auth.uid==$uid`, 스키마/행수/문자열 길이 유효성, private-only 읽기, 구버전 무시 가능성을 증명. 공유 RTDB rules의 실제 배포는 별도 exact 비교·승격 영향 검증 후 단계화한다. **Codex는 배포하지 않는다.**
- 전송은 사용자의 실제 click/unlike에서만, 변경 곡 ID·원하는 개인 boolean·검증 가능한 ordering ID를 최대한 작게 묶어 보낸다. 클릭이 없으면 private preview write 0, 재방문/버전 업데이트/앱 페이지 이동은 신호 발행 0.
- 같은 UID 두 기기의 순서 경쟁은 기기 시계가 정확히 같다는 가정 금지. `RTDB transaction` 등 검증 가능한 순서/버전 계약과 안정된 operation ID를 설계·증명. 재전송/중복/역순/수신 지연/오프라인에서도 더 새로운 클릭을 오래된 신호가 덮지 않아야 한다.
- 전송하는 preview는 **서버 확정 사실이 아님**. 기존 `canonicalSettled417`, 개인 R2 원본, Worker ACK, 공개 좋아요 `publicSync/exploreLike`/공개 D1·R2 projection과 섞지 않는다. 받은 기기의 화면은 기존 local-first 캐시에 안전하게 적용하고, 기존 accepted-signal 도착 시 올바르게 승격·만료·교정될 수 있게 한다.
- 수신 저장 순서는 `remote intent → 개인 유효상태/guard 저장 → watermark 저장 → UI notify`; 새 listener는 계정당 제한된 하나이며 페이지 재진입마다 재설치/중복 구독하지 않는다. 수신 측 추가 D1/Firestore R/W=0, 전체 개인 좋아요/Feed 재조회 0.
- `src/pages/ExplorePage.tsx`의 `readExploreTrackLikeMembership127` 효과값과 `getExploreLikedTrackIds` hydration 경쟁까지 검사. 낙관적 하트가 지워지는 회귀 및 개인 preview에 의한 타계정 공개 likeCount 조기 변경은 FAIL.
- 새 임시 알림 실패/권한 거부/예전 앱은 현재 app391의 정상 5초 저장+확정 알림 경로로 안전하게 수렴해야 한다. 기존 기능보다 나빠지면 배포 불가.
- 기존 Local-First outbox / `operationId` / conflict receipt / app391 `canonicalSettled417` / RTDB 기존 rules / 팔로우 / Music Note save heart / UI 레이아웃 / Worker / D1 원본 구조 보호. 이번 단계에서 5초→5분 타이머 전환 금지.

## 작업 중 선행 STOP/의사결정
- 신호가 확정 상태로 오인되거나 타기기 최신 클릭 순서를 보장하지 못하면 단순 시간 단축 코드를 밀어 넣지 말고 **FAIL+최소 대안** 보고.
- 한 가지 개인 preview 알림의 added RTDB write가 10만 사용자 전체 비용에서 과도하면 대안 비용 비교 보고. 현재 W1/W2를 기계적 단일 합격선으로 삼지 않고 2026-10-09 총비용 지침 우선.
- 기존 RTDB live rules가 새 필드를 거부할 수 있으므로, 단순 코드 QA PASS만으로 실기기 PASS 선언 금지.
- 공유 D1/Firestore 사용자 데이터 삭제, 대량변환, migration, 기존 필드 의미 변경 금지. main/TEST/PRODUCTION 코드 배포 금지.

## 실제 검증 (추정 PASS 금지)
1. 기존 app391 좋아요/해제 로컬 즉시, 기존 개인 확정 RTDB, 새 공개곡 첫 좋아요, `canonicalSettled417` 회귀.
2. A(PC)→B(모바일) 및 B→A 변경/해제 각각 페이지 전환 없이 5~10초 내 개인 하트 변경; `내 좋아요` membership도 일치.
3. A/B 같은 곡 짧은 간격 서로 다른 클릭, 오래된 preview/기존 accepted 신호 역순, 브라우저 재실행, 통신 두절/RTDB permission denied, 구버전 앱 수신.
4. 네트워크 지연 중 가사/Feed hydration이 개인 하트를 되돌리지 않는지; 캐시 healthy 재진입/새 기기/앱 업데이트.
5. 새 개인 preview 신호만으로 공유 공개 숫자, 다른 계정 하트, canonical D1/Firestore, Worker batch에 **영향 0**. 개인 신호 수신 시 D1 R0/W0/Worker 추가 0 확인. RTDB 실제 전송량/쓰기 비용 별도 측정.
6. 기존 `verify-127`, `verify-175`, `verify-178`, `verify-180`, `verify-191`, `verify-192`, `verify-197`, `verify-390`, `verify-391` 해당 파일 실제 존재 확인 후 실행; 필요한 Stage416② 실행형 신규 regression 추가.
7. `node scripts/soridraw-qa-engine.mjs focus like` → 최종 `npm ci`/TypeScript/Build 및 기존 408 관련 검사 → Work **독립 read-only 감사**. Codex는 branch/시작 SHA/최종 SHA/변경 파일/검증/위험 보고; **배포하지 않는다**.

## 진행 상황 (사용자에게 항상 동일 표로 보고)
- ① 반복 읽기: 사용자 요청 보류 (실사용 관찰 문제 기록).
- ② 개인 5~10초: **원인과 구현 안전계약 파악, Codex 구현 전**.
- ③ 개인 5분 저장 + Master 독립 설정: 설계 확정, 미구현.
- ④ 공개 공동 5분 + Master 독립 설정: 설계 확정, 미구현.
- ⑤ 독립·실기기·비용 검증: 대기.
- **전체 0/5 완료.** 391 정상 앱 보호. 이 문서 저장은 코드 수정·배포 완료가 아니다.

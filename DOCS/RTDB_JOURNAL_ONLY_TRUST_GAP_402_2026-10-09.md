# Stage 402 — 기존 변경 기록 단독 사용의 알림 신뢰성 차단 (2026-10-09 KST)

## 판정

**테스트 PASS, journal-only server publisher RELEASE GATE FAIL.**
GitHub PREVIEW `preview`의 Stage 401 후속. 격리 CI [Run 37824899801](https://github.com/andrawing1212/soridraw-music/actions/runs/37824899801) `SUCCESS`; Stage 398 4/4, Stage 399 8/8, Stage 400 5/5, Stage 401 6/6과 Stage 402 신뢰성/누락 위험 검출 10/10 PASS.

추가 `scripts/verify-402-like-notification-trust-recovery.mjs`, 기존 `.github/workflows/verify-398-isolated-d1.yml`에 Node22 --check와 테스트만 연결. Miniflare **LOCAL D1** + 일부 순수 자바스크립트 crash/retry 모형이며, LIVE D1·Worker·RTDB·R2·Functions 검증이 아니다.

## 확정된 최소 위험 설명

- 현재 저장소 원본 `migrations/20260910_01_explore_derived_state.sql`의 `explore_derived_changes(scope,kind,id,seq)`는 `PRIMARY KEY(scope,kind,id)` 구조이고 `kind='track'`는 곡 정보 변경과 좋아요 파생 통계 변경 모두 사용.
- 격리 D1의 두 이력: **A** 좋아요 수 0→1, **B** 좋아요 수는 이미 1인데 제목만 변경. 최종 `tracks`와 `journal`의 관찰 가능 행(`id, like_count, title, seq, kind`)이 완전히 같았다. 변경 원인 또는 이전 발행 숫자의 *영속 저장값*이 없다면 저널의 현재 행만 보고 좋아요 여부를 정확히 증명할 수 없다. 이 모형의 불가능성 사례이지 운영에서 반드시 동일한 상황이 발생했다는 주장은 아니다.
- 한 곡의 두 변경은 같은 `PRIMARY KEY` journal 행의 seq를 갱신하여 앞선 이벤트 출처를 지운다. 최종 공개 숫자를 재확인하는 데 사용할 수는 있지만 원래 각 canonical membership commit의 이력을 복원할 수는 없다.
- D1 likeCount가 최신이어도 R2 공개 카드/프로필이 뒤늦게 업데이트되거나 실패할 수 있으므로, 저널 존재만으로 **R2 settle 완료**를 선언하면 안 된다.
- 실패 처리 순서 위험: 먼저 cursor/완료를 기록한 뒤 RTDB 전송이 실패하면 알림이 누락된다. 먼저 전송 후 완료 기록 전 중단되면 재시도 시 중복된다. 안전한 방법은 **영속 notification-only pending + at-least-once retry + receiver idempotency**, 그리고 R2 정착까지 기다리는 경계다. Stage402의 재시도 모형은 메모리만 사용하며 실제 Durable Object/Functions 저장 검증은 아니다.

## 구체 검사 PASS (위험 검출)

1. 소스 schema/069/075/scheduler lock PASS
2. 좋아요 변화와 곡 제목 수정의 같은 최종 저널·숫자 사례 PASS
3. 변경 전 기준 숫자가 없는 경우 서버 발행을 중단하는 후보 판단 PASS
4. 기존 숫자가 같으면 업데이트 필요성 없음 판별 PASS
5. 숫자가 달라도 R2 확정 없이 발행하지 않는 후보 판단 PASS
6. 이전 변경 seq가 최신 곡 수정에 덮이는 현상 PASS
7. canonical↔R2 불일치 가능성 격리 모형 PASS
8. cursor-first/send-fail 알림 누락 현상 PASS
9. send-first/checkpoint-crash 중복 시도 현상 PASS
10. 통신 실패 시 pending을 남기고 성공 후 제거하는 in-memory 모형 2가지 PASS

이는 새 알림 기능이 동작한다는 검사가 **아니라**, 기존 journal만 붙이는 구현을 차단해야 한다는 근거다.

## 비용 및 제품 안전

- Stage402는 live/원격 DB 접근 없이 격리 모형만 수행. 사용자 행동 069 intake W1 유지, 새 서버 발행·추가 D1 W·RTDB 신호 발행·Worker 변경·Schema 변경·배포 **전혀 없음**.
- 현재 RTDB 전역 수신/클라이언트 발행의 비용·보안 문제는 여전히 미해결. LIVE D1 R/W, Cloudflare Worker bundle parity, Functions 비용, 10만명 fanout, PC↔모바일는 미검증. TypeScript/Build는 제품 코드 변경 없으므로 이번 별도 검사 미실행.
- `.github/workflows/diagnose-069-live-like.yml`가 변경마다 실패하는 기존 별도 자동 작업은 정상 상태로 간주하지 않는다. Stage402 격리 PASS와 다름.

## 제품용 최소 방향 — 기존 journal-only 채택 중단

**필수 조건을 추가하지 않고 저널만으로 '좋아요만' 정확히 발행 + 실패 후 누락 0 + 쓰기 0을 동시에 주장하지 않는다.** 다음 구현 선택지는 다음 순서를 따른다.

1. 069/075 양쪽에서 실제 D1 commit으로 반영된 membership 변경 ID를 확보한다. 기존 399/400 LOCAL 실험의 `RETURNING`은 D1 새 쓰기는 0이지만 배경 aggregate에서 읽기 +3~+7 / +3~+5 증가했다. **이는 1회 클릭 W1 청구액과 분리해 실제 전체 LIVE 비용 검증 필요**.
2. 원자적으로 보장할 수 없는 `D1 commit → DO/RTDB notification` 실패 구간을 반드시 해결한다. DO durable pending/커서 및 기존 derived journal의 최종상태 복구를 결합할 수 있을지 살피되, 무관 곡 업데이트로 인한 오발행·과도한 비용/구형 클라이언트 영향을 측정한다. `RETURNING` 단독으로 누락 0 선언 불가.
3. canonical + R2 settle barrier 이후 검증된 서버 인증(HMAC), bounded durable retry, 전송 중복 억제, 마지막 시각/버전 단조성을 검증한다. 먼저 공유 RTDB Rules를 막지 않는다.
4. 배포 경로와 실용 D1 W1~W2, 반복 R0, Functions/RTDB fanout, 10만 규모 계산, 과거 앱의 좋아요·하트·팔로우 수렴 **모두 PASS 이전에는 기능 플래그 OFF, 실서비스 배포 금지**.

이번 조사에서 `journal-only` 방법은 재시도하지 않는다. 신규 D1 outbox/trigger W 증가가 필요하다고 판단되면 **사용자에게 비용 차이와 정상 기능 보호 대안을 사전 보고**하고 공유 D1 migration을 임의 실행하지 않는다.

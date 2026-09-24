# SORIDRAW app160 + Worker195 — 사용자 실기기 검증 완료·좋아요 동결

## 문서의 지위
- 날짜: 2026-09-24 KST.
- GitHub 기준 저장소: `andrawing1212/soridraw-music`, 개발 브랜치 `preview`.
- 우선순위: 최신 사용자 지시 → `DOCS/CURRENT_RELEASE_STATE.md` → 실제 GitHub/배포 확인 → 이 참조.
- 사용자의 최종 피드백: “전부 다 제대로 작동하고 있어. 이젠 이상이 없다면 절대 좋아요 기능에 손을 대지마.”
- **의미**: 현재 정상 좋아요 기능은 수정 동결. 이 문서는 새 기능 제안·재설계·자동 배포 지시가 아니다. 예전 app141 문서는 같은 UID 수신 저장 순서의 역사적 기준으로 함께 유지한다.

## 고정 릴리스 증거
| 대상 | 확인된 상태 |
|---|---|
| PREVIEW app | app160 / Firebase Hosting release Run `36004777915` / exact build PASS |
| PREVIEW Worker | Worker195 / release Run `36010156194` / active `11d8455c-c266-4e88-9cf6-7549d3f5be92` |
| Worker195 감사 | Run `36009942860` SUCCESS / TypeScript·Build·관련 회귀 PASS |
| 이전 서버 오류 증거 | Worker193 release `36004778161`: 대기열 069 pending 3건, 점검 23회 동안 유지, 24회에 0 |
| Worker 배포 검사 | 배포 전 pending069=0, changed-card 실제 3곡 PASS / D1 R0·W0, Feed/Profile PASS, warm revision D1 R0·W0, fixed cron clear, TEST/PROD Worker unchanged |
| 제품 코드 주요 커밋 | app160 `2dfc167668a7640a16e97fe582960d224aab5d25`, Worker194 `071d82bbad1c9b0bc35ca459a15965b103a84c5c`, Worker195 `29f0def57c0fca962596d9be2d3d46f9d4b2d061` |
| 최종 검증 정정 | verifier alignment `90701f73f22736ec4bd12faa0921d39e091abc11`. 첫 Worker195 릴리스 `36009834733`은 preflight 문구 불일치로 배포 없이 FAIL, 최종 릴리스는 SUCCESS |
| 실제 사용자 | PREVIEW 서로 다른 계정 + PC/모바일 및 좋아요·해제 양방향 정상 동작을 직접 확인했다고 보고. 자동화된 다계정 실기기 테스트 결과를 꾸며내지 않는다 |
| 미측정 | 신규 실사용 행동의 실제 원격 mutation W1~W2 물리 행쓰기: 이번 최종 감사의 isolated synthetic billing SKIPPED. 수치 확정 금지 |
| 환경 | TEST·PRODUCTION은 현재 수정 작업에서 승격하지 않음. 사용자 원본 데이터 migration/복사/강제 재생성 없음 |

## 보호하는 기능 계약

### 개인 하트와 내 좋아요
- 클릭 즉시 내 하트의 채움/비움이 로컬에 반영된다.
- 로컬에서 저장한 미전송 의도(outbox)를 최신 상태보다 오래된 서버 응답으로 덮어쓰지 않는다.
- 같은 UID PC↔모바일에서 좋아요/해제와 내 좋아요 카드 목록이 페이지 이동·새로고침 없이 수렴한다.
- app141 수신 저장 순서: 원격 변경 수신 → 로컬 membership merge → pending/표시 보호 저장 → watermark 저장 → UI notify. notify가 저장보다 먼저 와서는 안 된다.
- 업데이트나 정상 재방문만으로 개인 카탈로그 전체 조회/재생성 금지.

### 다른 계정 공개 숫자
- A가 눌러도 B의 개인 하트는 바뀌지 않는다. B의 공개 likeCount만 서버의 변경 후 숫자로 수렴한다.
- A→B, B→A, 좋아요→해제 모두 같은 원칙. 기존 30초 trailing local batch 이후 Worker 이벤트 창 약 5초를 허용하며 클릭 순간 모든 계정에 즉시 숫자 보장을 약속하지 않는다.
- RTDB `publicSync/exploreLike`는 최대 50개 변경된 trackId·ownerUid·시각으로 알리고, 개인 membership 또는 전체 Feed를 방송하지 않는다.
- 신호 rows는 array와 numeric-key object 양쪽을 읽는다. merged bus의 최신 actorUid가 나와 같더라도 다른 계정의 변경 row를 통째로 버리지 않는다. 서버가 접수한 시각을 사용해 기기 시각 오차로 새로운 카드를 거절하지 않는다.
- 현재 화면에서 영향을 받는 변경 곡만 `/v1/public-like-cards` shared R2에서 확인, public likeCount만 갱신한다. 해당 조회는 D1 R0/W0 목표·실제 배포 smoke PASS, 재시도는 bounded. 캐시가 정상인 방문에서 D1 원본 읽기 0 목표.

### 서버 처리·비용
- 기존 W1 queue-intake, 30초 묶음 저장, Durable Object 약 5초 event window 유지. page/idle 타이머 polling으로 바꾸지 않는다.
- 오래된 alarm/active marker가 들어온 새 batch를 무기한 막지 못하도록 Worker194 recovery를 유지한다.
- Worker195은 window 완료 시 active marker를 먼저 지우고 indexed pending069 LIMIT 1을 확인하며, 새 owner가 있으면 그 예약을 덮어쓰지 않는다. 뒤늦게 합류한 새 batch의 orphan 방지.
- 진짜로 변경된 곡에만 canonical→shared R2 snapshot/card/profile 갱신, 전체 공개곡·전체 좋아요·전체 사용자 scan/rebuild 금지.
- D1 mutation 비용 합격선 W1~W2, W3+ FAIL (이번 최종 변경의 새 원격 물리계측 결과를 가정하지 않는다).
- 변경 없는 재진입/앱 업데이트/페이지 이동으로 DB write 금지, 정상 캐시 D1 read 0 목표.

## 보호 파일·경로 (자동 파일 삭제/수정 명령이 아님)
- `src/services/exploreLikeService.ts` — 개인 상태, outbox, 서버 ACK 시각·신호.
- `src/services/explorePublicLikeSyncService.ts` — 타계정 공개 changed-track 신호.
- `src/services/exploreLikedTracksService.ts` — 내 좋아요 카드와 개인 membership 정합성.
- `src/pages/ExplorePage.tsx` — 화면에서 개인 하트와 공개 숫자 분리 및 갱신.
- `cloudflare/explore-worker/canonical/preview-entry.js` — batch ACK / changed-card / Worker194/195 DO scheduler.
- `database.rules.json` 및 관련 RTDB 규칙·캐시·feed/profile 경로 — 안전한 계정별 신호와 공유 숫자.
- `scripts/verify-105-explore-like-1min.mjs`, `scripts/verify-192-cross-account-public-like-live.mjs` 및 기존 like 회귀 — 회귀 방지 도구.
- 이 목록은 소유 영향 범위의 예시. 공통 Worker/Rules/서비스 파일을 다른 기능 때문에 수정할 때에도 해당 like 경로 diff를 확인한다.

## 변경 거부·예외 절차
1. 좋아요가 정상이고 사용자가 좋아요 변경을 요청하지 않았다면 수정하지 않는다. 이름 정리, 비용 절감, 최신화, 리팩터링, 다른 기능 편의로 우회 변경 금지.
2. 실제 오류가 확인되거나 보안/데이터 보존 문제 등이 있으면 먼저 읽기전용으로 해당 곡·계정의 `outbox → 069 queue → canonical D1 → shared R2 → RTDB → 수신 UI` 중 한 구간을 특정한다. 개인정보·UID·좋아요 목록을 공개 CI에 출력하지 않는다.
3. 원인이 명확하더라도 사용자 승인 없이 정상 구조를 재작성하거나 데이터 변경하지 않는다. 수정해야 한다면 정확한 최소 diff와 기존 기능·비용 영향, 롤백 방법을 보고해 승인을 받는다.
4. 승인 시 `preview`에서만 구현 → TS/Build/적용 가능한 회귀/Work 독립감사 → PREVIEW 확인 → A/B PC·모바일 좋아요·해제 양방향 실사용 PASS. PRODUCTION 승격은 별도 명확 승인.
5. 테스트 중 W3+, 전체 조회, 계정별 하트 혼합, 페이지 이동 없이는 갱신 불가, queue pending 고착, 사용자 데이터 손실 위험 중 하나라도 있으면 FAIL. 정상 기능 삭제로 비용을 맞추지 않는다.

## 주의
- 본 스킬은 이미 설치된 SORIDRAW 실행 코드나 사용자 데이터의 백업이 아니다. 정확한 코드 기준은 GitHub commit / 실제 배포 버전이다.
- 문서 기록을 위한 GitHub commit과 제품 코드/Worker 배포 SHA를 구별한다.
- `.github/workflows/diagnose-069-live-like.yml`의 별도 push 실패는 릴리스 감사 SUCCESS와 혼동하지 않는다. 진단 고치겠다고 정상 좋아요 경로를 다시 열지 않는다.

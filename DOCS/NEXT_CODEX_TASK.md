# NEXT CODEX TASK — Explore/Public Profile 초저비용 구조 마무리

상태: **D1 실스키마 감사 완료 / 사용자 additive 파생구조 승인 / 구현 단계 진입**
권장 모델/추론: **GPT-6 Astra Medium**
작업 브랜치: **preview only**
배포: **하지 않음**

## 현재 기준
- 현재 preview HEAD: 작업 시작 시 반드시 다시 확인
- 1차 앱/Worker 코드 기준: `63d26bf472700cfe639d033715eeea49f6453c83`
- 1차 완료:
  - R2 cache mutation 동시 덮어쓰기 보호
  - like/public/private/options/profile delta 충돌 보호
  - 변경 곡 popular 외부 후보 진입 보강
  - 048/049/051 verifier 052 기준 정리
  - TypeScript / Build / 관련 verifier PASS
- 실제 공유 D1 읽기전용 감사 완료:
  - `explore_shared_revision` 존재
  - global revision 증가 trigger 존재
  - 변경 ID journal/change-event table은 없음
  - `public_profile_first_views` snapshot table 존재
  - 실제 count 당시 public_profiles 3 / tracks 34 / follows 4 / likes 26
  - 감사 D1 write 0 / Worker deploy 0

## 사용자 승인 — 2026-09-10 KST
사용자는 다음 범위를 승인했다.
- 사용자 원본 데이터 삭제/덮어쓰기 없이 **additive 파생 D1 구조** 추가
- 작은 change-state/journal/ranking 구조가 필요하면 추가 가능
- 기존 canonical 테이블/필드 의미 유지
- 현재 소규모 기존 데이터를 기반으로 파생 상태 1회 초기화 가능
- 초기화는 원본 곡/프로필 삭제/재생성이 아니라 새 파생 상태를 현재 원본에서 채우는 작업만 허용

승인 범위를 넘는 destructive migration/backfill/기존 필드 변경은 금지하며 다시 보고한다.

## 이번 Codex 구현 목표 — 이 두 묶음만 끝낸다

### A. Explore feed revision 전체 rebuild 제거
1. `/feed-revision`에서 revision mismatch만으로 `latest + popular` 전체 `buildExploreFeedR2Payload()`를 호출하는 경로를 제거한다.
2. 기존 051 global revision은 그대로 유지한다.
3. 실제 D1에 변경 ID journal이 없으므로 additive 파생 구조로 변경된 track/profile을 누락 없이 추적한다.
4. TEST/PRODUCTION의 오래된 Worker가 shared canonical을 변경해도 D1 trigger가 변경 ID를 남기도록 한다. 옛 Worker 수정에 의존하지 않는다.
5. 환경별 소비 cursor/state는 환경별 R2 파생 캐시에 둔다.
6. 변경이 없으면 원본 D1 data read 0 목표. Edge/R2 상태만 사용한다.
7. 변경이 있으면 변경 ID만 exact lookup하여 latest/popular/profile snapshot을 patch한다.
8. 좋아요/좋아요 해제/공개/비공개/프로필 수정/팔로우에서 전체 feed/profile scan 금지.
9. popular 하락/삭제 후 top40 refill도 전체 tracks scan 없이 정확하게 처리한다. 필요하면 승인된 additive 작은 ranking 파생 구조/index를 사용한다.
10. 파생 상태의 최초 seed는 현재 canonical 상태를 1회 읽어 채우되 원본 데이터 write/삭제/변환은 하지 않는다. 이후 재방문/업데이트 때문에 다시 seed하지 않는다.

### B. Public Profile cold materialize 제거
1. 클라이언트 cold request의 `__soridraw_shared_profile=51` 강제 repair 의존을 제거한다.
2. 정상 browser cache/R2/Edge/public_profile_first_views snapshot을 우선 사용한다.
3. snapshot missing/corrupt일 때만 기존 bounded repair 경로를 허용한다.
4. 앱 버전 변경만으로 전체 profile rematerialize 금지.
5. 변경 ID 신호가 있으면 해당 profile/track만 snapshot patch한다.
6. 정상 캐시 재진입은 D1 data read 0 목표.

## 설계 제약
- 기존 TEST/PRODUCTION Worker가 새 구조를 몰라도 계속 동작해야 한다.
- canonical 데이터와 기존 필드 의미 변경 금지.
- FCM/WebSocket/새 외부 서비스 금지.
- Music Note/Library 동기화 구조 수정 금지.
- UI/반응형/색상/간격 수정 금지.
- main/production 변경 금지.
- Firebase/Cloudflare 배포 금지.
- 사용자 데이터 삭제/대량변환 금지.

## 구현 방식
- 저장소 전체 재분석 금지. 아래 문서와 필요한 소유 파일만 읽는다.
  1. `AGENTS.md`
  2. `DOCS/CURRENT_RELEASE_STATE.md`
  3. 이 파일
  4. `DOCS/WORK_AUDIT_CHECKLIST.md`
  5. `DOCS/CODEX_USAGE_BUDGET.md`
- 현재 preview HEAD를 기준으로 시작하되 63d26bf의 cache mutation safety를 절대 되돌리지 않는다.
- 먼저 실제 D1 감사 결과와 현재 migration/schema 관리 위치를 찾아 additive SQL/patch를 최소 범위로 설계한다.
- 구현 중 focused verifier를 사용하고, 최종 후보에서만 TypeScript/Build/전체 관련 verifier를 한 번 수행한다.
- 같은 접근을 반복 실패하면 사용량을 소모하며 밀어붙이지 않는다.

## 반드시 추가할 비용 회귀 검증
정적/fixture 테스트로 최소 확인:
- `/feed-revision`은 full feed builder를 호출할 수 없음
- unchanged revision/cursor → canonical D1 item query 0
- one like → changed track lookup만, full feed scan 0
- unlike/popular drop → 정확한 refill, full tracks scan 0
- public/private → changed track/profile만, full feed/profile scan 0
- profile edit/follow → 해당 profile delta만
- old-env canonical mutation을 trigger journal이 포착
- journal cursor 재처리/중복 안전
- 동시 mutation에서 63d CAS 보호 유지
- cold profile 정상 snapshot 존재 시 materialize 호출 0
- missing/corrupt snapshot만 bounded repair
- 최초 seed 후 재시작/재진입 때문에 전체 seed가 반복되지 않음

실제 Cloudflare D1 rows_read는 배포 전 live runtime에서 완전 검증할 수 없으면 `미검증`으로 명확히 남기되, fixture/query-call count와 SQL 형태를 기록한다.

## 최종 합격선
- TypeScript PASS
- Build PASS
- 관련 기존 verifier PASS
- 새 cost regression verifier PASS
- generated Worker syntax PASS
- app update + healthy cache → D1 data read 0 설계
- Explore unchanged revisit → D1 0 설계
- Public Profile unchanged revisit → D1 0 설계
- one like/public/private/profile mutation → 전체 scan/rebuild 0
- 기존 TEST/PRODUCTION 하위호환 유지
- 사용자 원본 데이터 변경 없음

## 완료 시
- `DOCS/CURRENT_RELEASE_STATE.md` 갱신
- commit 1개 또는 논리적으로 최소한의 commit으로 고정
- 가능하면 `origin/preview` fast-forward push
- force/rebase/merge 금지
- 배포 금지

## 종료 보고
반드시 남긴다:
- 기준 preview SHA
- 최종 commit SHA
- 변경 파일
- 추가한 D1 additive 구조와 최초 seed 방식
- 제거한 full-read/rebuild 경로
- TypeScript / Build / Test
- 비용 검증 결과
- 사용자 원본 데이터 변경 여부
- 남은 위험/미검증

# NEXT CODEX TASK — Explore/Public Profile 초저비용 구조 마무리

상태: **1차 Codex 구현 완료 / 전체 과제 미완료 / 다음 구현 전 D1 읽기전용 감사 필요**
권장 모델/추론: **GPT-6 Astra Medium**
작업 브랜치: **preview only**
배포: **하지 않음**

## 현재 기준
- 1차 Codex 최종 코드 commit: `63d26bf472700cfe639d033715eeea49f6453c83`
- 1차 범위는 완료됨:
  - R2 cache mutation 동시 덮어쓰기 보호
  - like/public/private/options/profile delta 충돌 보호
  - 변경 곡의 popular 외부 후보 진입 보강
  - 048/049/051 verifier를 현재 앱 052 기준으로 정리
  - TypeScript / Build / 관련 verifier PASS
- **아직 완료되지 않은 원래 과제**:
  - `/feed-revision`의 latest + popular 전체 재구축 제거
  - 환경 간 공유 canonical 변경 ID 전달 계약
  - 공개프로필 cold materialize 비용 제거
  - popular 하락/삭제 후 정확한 refill
  - 실제 D1 rows_read 검증

따라서 `63d26bf`는 안전한 중간 기준점이며 전체 초저비용 구조 완료본이 아니다.

## 지금 바로 다음 순서
1. 실제 공유 D1의 table / index / trigger / 기존 변경 journal 유무를 **읽기전용**으로 확인한다.
2. 기존 구조에 안전한 변경 ID 전달 수단이 있으면 그것을 재사용한다.
3. 기존 구조에 없다면 새 additive change journal이 정말 필요한지 구조/비용/하위호환을 먼저 보고한다.
4. 사용자 승인 없이 schema 추가/migration/backfill을 실행하지 않는다.
5. 구조가 확정된 뒤에만 Codex가 남은 `/feed-revision` + 공개프로필 비용 경로를 구현한다.
6. 구현 후 Work 독립 감사 → ChatGPT 최종 확인 → 사용자 PREVIEW 배포 승인 순서로 진행한다.

## 현재 D1 감사 차단점
GitHub Action의 기존 Cloudflare 인증으로 D1 schema 조회를 시도했으나 `7403 unauthorized`로 실패했다.
D1 write는 발생하지 않았다.

현재 Workflow는 다음처럼 수정됨:
- `Cost Zero Stage 2A Live Readonly` → `CLOUDFLARE_READONLY_TOKEN` 전용
- `Cost Zero Stage 2A D1 Readonly Probe` → `CLOUDFLARE_READONLY_TOKEN` 전용
- D1 schema 조회 실패 시 전체 Action도 실패
- 자동 push 실행 제거, 수동 `workflow_dispatch` 전용

따라서 다음 실제 진행 조건은 GitHub Secret `CLOUDFLARE_READONLY_TOKEN` 준비다.
권한은 가능한 최소 범위의 D1 Read + Worker Read만 사용한다.

## 사용자 목표 — 고정
- 앱을 열었다고 서버 데이터를 읽지 않는다.
- 앱을 업데이트했다고 서버 데이터를 다시 읽지 않는다.
- Explore/공개프로필 재방문 + 변경 없음 → 원본 D1 read 0 목표
- 좋아요/공개/비공개 1회 → 전체 Feed/프로필 scan/rebuild 0
- mutation 비용은 전체 곡 수/사용자 수에 비례하지 않는다.
- 실제 데이터가 바뀌었을 때 바뀐 항목만 처리한다.

## 보호 범위
이번 작업에서 건드리지 않는다:
- Music Note 로컬 즉시 반영 + 약 60초 묶음 서버 저장
- Library 정상 캐시 경로
- UI/레이아웃/반응형/색상/간격
- PRODUCTION
- 사용자 데이터 대량수정/삭제
- migration/backfill
- FCM/WebSocket/새 외부 실시간 인프라

## 구현 중단 조건
아래가 나오면 Codex가 구현을 밀어붙이지 않고 중단/보고한다.
- destructive migration/backfill 필요
- 기존 TEST/PRODUCTION과 하위호환 불가능
- 사용자 데이터 손실 가능성
- 새 인프라가 필수
- 동일 접근 반복 실패
- 실제 D1 구조를 확인하지 않고 추정만으로 schema 변경해야 하는 상황

## 최종 합격선
남은 구현이 끝났을 때 반드시 확인:
- TypeScript PASS
- Build PASS
- 관련 Explore/Public Profile verifier PASS
- Worker patch/syntax PASS
- 앱 업데이트 정상 캐시 → D1/Firestore data read 0 목표
- Explore 재진입 변경 없음 → D1 0 목표
- 공개프로필 재진입 변경 없음 → D1 0 목표
- 좋아요 1회 → 전체 Feed scan/rebuild 0
- 공개/비공개 1곡 → 전체 Feed/프로필 scan 0
- PREVIEW/TEST/PRODUCTION 환경 선택 코드 비의도 변경 없음
- 공유 canonical 사용자 데이터 구조 보호

## 종료 보고
Codex는 배포하지 않는다.
반드시 남긴다:
- 기준 preview SHA
- 최종 commit SHA
- 변경 파일
- 변경 내용
- TypeScript / Build / Test
- 실제 비용 검증 결과 또는 미검증 항목
- 데이터 구조 변경 여부
- 남은 위험
- `DOCS/CURRENT_RELEASE_STATE.md` 갱신

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-10 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- 현재 `preview` 기준 HEAD(정상화 작업 시작 전): `beee2578b46eece01648ca6dc7d4881c99370e10`
- 현재 앱/Worker 제품 코드 기준: `6bd01324493c7c3d048aed825c5b8604f755d2cf`
  - 이후 `preview` commit들은 이번 배포 진단/Workflow 정리 성격이며 앱 제품 코드는 동일하다.
- TEST 앱 기준: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION은 이번 작업에서 변경하지 않는다.

## 2. 실제 PREVIEW 배포 상태
### Firebase PREVIEW Hosting
- 현재 앱 버전: `052`
- 현재 Hosting은 Explore 032 최종 앱 코드 반영 전 상태다.
- 기존 PREVIEW Hosting 기준 commit: `2819dcf57904a8db7222a89c18965c28b94da60a`
- `6bd013...` 앱은 아직 Firebase PREVIEW Hosting에 최종 배포하지 않았다.

### Cloudflare PREVIEW Worker
- Worker: `soridraw-explore-preview`
- 현재 활성 Version ID: `d4b22d15-02c5-42d2-be73-8b2383710fc6`
- 032 derived-change runtime 배포 성공.
- 실제 검증:
  - Explore feed HTTP 200
  - Public Profile first-view HTTP 200
  - `/v1/feed-revision` 첫 호출 당시 D1 rows read 2 / write 0
  - 두 번째 즉시 호출 D1 rows read 0 / write 0
  - 032 semantic marker PASS
- TEST Worker는 `0b9cfe5c-1e29-4485-ac97-36f87832b41e`에서 변경 없음.
- PRODUCTION Worker는 `07c11e5e-47a6-458b-a3a0-6e47b6c331e6`에서 변경 없음.

## 3. 공유 D1 상태
- canonical D1: `soridraw-explore-db`
- additive derived schema 적용 완료.
- one-time derived seed 적용 완료.
- 마지막 실제 readiness 확인:
  - `seeded=1`
  - `seq=107`
  - derived tracks=35
  - derived profiles=3
- seed는 canonical 사용자 원본을 삭제/덮어쓰기하지 않았다.
- 이번 배포 시스템 정상화 작업에서는 D1 migration/seed/write를 실행하지 않는다.

## 4. 현재 비용 구조
- `/feed-revision` 전체 latest+popular rebuild 경로는 032 changed-ID 소비 구조로 교체됐다.
- 정상 warm revisit의 두 번째 `/feed-revision` 실제 D1 read/write 0 확인.
- Public Profile 앱 버전 변경에 따른 강제 materialize flag 제거.
- 좋아요/공개/비공개/프로필 변경은 변경 항목 중심 처리 구조.
- Music Note 60초 묶음 저장과 Library 정상 Local First 경로는 이번 작업에서 건드리지 않는다.

## 5. 배포 시스템 정상화 — 2026-09-10 승인
사용자 지시:
- 글로벌 서비스 운영의 기본 뼈대를 기준으로 한다.
- 배포 파이프라인을 앱 수정과 섞어서 매번 바꾸지 않는다.
- 배포 실패를 Workflow 즉흥 수정 → 재배포 반복으로 처리하지 않는다.
- 확실히 실행/검증 가능한 것만 완료로 보고한다.

정상화 기준:
- PREVIEW 앱 배포: 고정된 `.github/workflows/firebase-hosting-custom-preview.yml`
- PREVIEW Explore Worker 배포: 고정된 `.github/workflows/cloudflare-explore-preview-release.yml`
- D1 migration/seed: 평상시 배포 경로에서 제외. 스키마 변경 릴리스에만 별도 승인.
- Workflow는 `workflow_dispatch` 수동 실행 전용. 코드 push만으로 자동 배포하지 않는다.
- 앱 배포는 앱만, Worker 변경은 Worker만 배포한다.
- 배포 도중 Workflow 수정 금지.
- 같은 실패가 반복되면 릴리스를 계속 재시도하지 않고 배포 시스템 문제로 분리한다.
- 일회성 `v2/final/diagnostic/stage` 배포 Workflow를 새로 쌓지 않는다.

## 6. 데이터 운영 고정 원칙
- PREVIEW / TEST / PRODUCTION은 기능 코드와 실행 환경을 분리한다.
- 사용자 원본 데이터는 세 앱이 공유한다.
- 공유 원본:
  - Auth/계정
  - Music Note
  - Library
  - Explore 공개곡
  - 공개프로필
  - 좋아요/팔로우/통계
  - 사용자 미디어
- 환경별 분리:
  - Hosting
  - Worker/Functions 코드
  - Edge/R2 derived cache
  - Rate Limit/진단 상태
- 승격은 데이터 복사가 아니라 코드 승격이다.
- destructive migration/backfill/대량삭제/필드 의미 변경은 사용자 승인 없이 금지.

## 7. 배포 완료 기준
PREVIEW 완료 보고 전:
- 대상 commit 고정
- TypeScript PASS
- Build PASS
- 필요한 Test PASS
- 필요한 서비스만 배포 성공
- 실제 `preview.soridraw.com` 확인
- 필요한 경우 Worker 실제 API 확인
- TEST / PRODUCTION 비의도 변경 없음 확인
- 검증 실패 시 완료라고 보고하지 않음

## 8. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 승인 없는 main/production 승격
- 승인 없는 PRODUCTION 배포
- FCM/WebSocket/새 외부 실시간 인프라

## 9. 다음 작업
1. 배포 시스템 정상화 commit 고정 및 Workflow 등록 상태 확인.
2. 정상화 완료 후 별도 승인 시 **Firebase PREVIEW 앱만** `6bd013...` 제품 코드와 동일한 현재 preview 소스에서 배포.
3. Worker 032는 이미 PREVIEW에 정상 활성화되어 있으므로 앱 배포 때문에 재배포하지 않는다.
4. PREVIEW 실사용 검증 후에만 TEST 승격 여부를 판단한다.

## 10. 현재 완료 판정
- Explore 032 Worker: PREVIEW 배포/비용 smoke PASS.
- Shared D1 derived schema/seed: 준비 완료.
- Firebase PREVIEW 앱 최종 반영: 아직 안 함.
- TEST/PRODUCTION: 변경 없음.
- 배포 시스템 정상화: 현재 작업 중. 정상화 commit 및 Workflow 등록 확인 후 완료로 갱신한다.

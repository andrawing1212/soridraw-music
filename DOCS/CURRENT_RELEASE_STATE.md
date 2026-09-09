# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-10 KST

> **새 채팅의 현재 기준 문서. 과거 채팅 설명보다 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 우선한다.**

## 1. 현재 소스 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION 기준 branch: `production`
- 앱 버전: `052`
- 앱 버전 원본: `public/app-version.json` 단일 기준
- PREVIEW 마지막 앱/Explore Worker 코드 변경 기준 commit: `63d26bf472700cfe639d033715eeea49f6453c83`
  - 내용: Explore cache mutation 동시성 보호, 제한된 popular 외부 후보 진입, 048/049/051 verifier 현재 052 기준 정리
  - 상태: **코드 반영/검증 완료, 배포 전**
- PREVIEW 실제 배포 런타임 기준 commit: `2819dcf57904a8db7222a89c18965c28b94da60a`
- TEST 앱 코드 기준 commit: `3b574c05589230f077eceff98190edd4b5195f75`
- `63d26bf` 이후 `preview`에는 GitHub 저장소 유지보수, Workflow 안전화, 문서 정리 commit만 추가되어 있다. 작업 시작 시 실제 `preview` HEAD를 다시 확인한다.

## 2. 실제 배포 상태
- PREVIEW 052: Firebase 배포/검증 완료 — 단, `63d26bf` 이후 코드는 아직 배포하지 않음
- TEST 052: Firebase 배포/실제 번들 검증 완료
- TEST 브랜딩/아이콘: 승인된 TEST 042 기준 유지
- Explore PREVIEW/TEST: 마지막 배포 검증 당시 최신 Feed 30곡 결과 일치
- PRODUCTION: 현재 Explore 비용 작업으로 앱/Hosting/Worker를 승격하지 않음
- Functions / Firestore Rules: 현재 유지보수 및 `63d26bf` 작업에서 변경/배포 없음
- 사용자 데이터: 이번 유지보수에서 변경 없음

## 3. 데이터 운영 구조 — 고정
SORIDRAW는 **사용자 원본 데이터 공유 + 기능 코드 단계별 승격**이 기준이다.

공유 원본:
- 계정/Auth
- Music Note
- Library
- Explore 공개곡
- 공개프로필
- 좋아요/팔로우/통계
- 사용자 미디어

환경별 분리 가능:
- Hosting
- Worker/Functions 코드 버전
- 환경 설정
- Edge/R2 파생 Cache
- 진단/Rate Limit 상태

PREVIEW → TEST → PRODUCTION 승격은 데이터 복사가 아니라 코드/기능 승격이다.
공유 원본의 파괴적 migration/backfill/대량수정/필드 의미 변경은 사용자 승인 없이 금지한다.

## 4. 현재 Explore/Public Profile 비용 작업
목표: 앱을 열거나 업데이트하거나 페이지를 다시 방문했다는 이유로 원본 데이터 서버 비용이 생기지 않게 한다.

### 확인된 기존 문제
- `/feed-revision`에서 공유 revision과 환경별 Feed Cache revision이 다르면 031 경로가 latest + popular Feed를 D1에서 다시 생성할 수 있음.
- 실제 CACHE LIVE 관찰 예에서 전체 D1 rows read 약 449 중 `/v1/feed-revision` 관련 약 421이 발생한 적이 있음.
- 공개프로필 cold 경로는 `__soridraw_shared_profile=51`을 통해 원본 D1 materialize를 유도할 수 있음.
- global revision 하나만으로는 **무엇이 바뀌었는지 ID를 알 수 없음**.

### `63d26bf`에서 완료
- 서로 다른 mutation이 같은 R2 bundle을 덮어쓰는 문제를 ETag/CAS 재시도로 보호
- like/publication/private/options/profile delta 계열의 동시 변경 보호
- 변경 곡이 현재 popular 40곡 밖에 있어도 해당 ID만 제한 조회해 진입 가능하도록 보강
- 오래된 mutation 응답이 최신 canonical 상태를 되돌리는 경로 보호
- 현재 052 구조에 맞게 048/049/051 verifier 정리
- TypeScript: PASS
- Build: PASS
- 관련 033/045/048/049/051 verifier: PASS
- 새 cache mutation 회귀 verifier: PASS
- 배포: 없음

### 아직 미완료
- `/feed-revision`의 전체 latest+popular 재구축 제거
- TEST/PRODUCTION 등 다른 환경에서 발생한 공유 canonical 변경 ID를 PREVIEW가 누락 없이 받는 계약
- popular 하락/삭제 후 목록 밖 후보의 정확한 refill
- 공개프로필 앱 업데이트/cold materialize 비용 제거
- 실제 Cloudflare D1 rows_read 실행계획/실서버 비용 검증

따라서 `63d26bf`는 **안전한 중간 기준점**이며 초저비용 구조 전체 완료본이 아니다.

## 5. 변경 ID 추적 설계 중단 판단
기존 구조만으로 global revision 변경을 특정 track/profile ID에 안전하게 연결할 수 없음을 확인했다.

확인된 이유:
- 현재 shared revision은 전역 숫자만 제공
- `updated_at` 단독 cursor는 늦게 완료된 쓰기에서 누락 가능
- 기존 mirror 전달 경로는 031 이후 변경 ID 전달 수단으로 사용할 수 없음

후보 최소안:
- 단조 증가 `seq`
- 대상 종류 / 대상 ID / owner ID / 변경 종류
- canonical 변경과 함께 기록되는 작은 change journal
- 환경별 소비 cursor는 파생 캐시에 저장

단, **실제 공유 D1에 이미 유사 table/index/trigger가 존재하는지 확인하기 전에는 구현하지 않는다.** additive schema가 필요하면 사용자 승인 전 적용 금지.

## 6. Cloudflare D1 읽기전용 감사 상태
2026-09-10 GitHub Action `Cost Zero Stage 2A Live Readonly` 실행에서:
- Worker 소스 준비: 성공
- D1 schema 조회: 실패
- Cloudflare 오류: `7403` / account not valid or not authorized
- `D1_SCHEMA_QUERY_UNAVAILABLE=true`
- D1 write: 없음

기존 Workflow는 이 내부 실패에도 최상위가 `Success`가 되는 false-green 문제가 있었다.
현재 수정 완료:
- `Cost Zero Stage 2A Live Readonly`는 `CLOUDFLARE_READONLY_TOKEN` 전용 사용
- D1 schema 조회 실패 시 Action 전체 실패
- schema 검사에 table/index뿐 아니라 trigger 포함
- `Cost Zero Stage 2A D1 Readonly Probe`도 같은 read-only token 사용
- 두 감사 Workflow 모두 수동 실행 전용

남은 작업:
- GitHub Secret `CLOUDFLARE_READONLY_TOKEN`을 실제 Cloudflare의 D1 Read + Worker Read 최소 권한으로 준비
- 그 뒤 실제 D1 schema를 다시 읽기전용 확인

## 7. 비용 합격선 — 고정
- 앱 업데이트 + 정상 캐시: D1 data read 0 / Firestore data read 0 목표
- Explore 재진입 + 변경 없음: D1 data read 0 목표
- 공개프로필 재진입 + 변경 없음: D1 data read 0 목표
- 좋아요 1회: 전체 Feed scan/rebuild 0
- 공개/비공개 1곡: 전체 Feed/프로필 scan 0
- mutation 비용은 전체 곡 수/사용자 수에 비례하면 실패
- 한 항목 변경 때문에 전체 목록/프로필을 다시 생성하지 않음
- 실제 비용이 예상보다 크면 원인을 확정하기 전 다음 승격 금지

## 8. Music Note / UI 보호 기준
이번 Explore 작업과 분리한다.

Music Note:
- 로컬 즉시 반영
- 여러 수정 약 60초 묶음 서버 저장
- 종료/백그라운드 시 남은 변경 안전 마무리
- 페이지 이동/재진입만으로 write 금지

UI:
- 사용자 요청 없이 외곽선/위치/크기/간격/반응형/테마/색상 변경 금지

## 9. GitHub 저장소 유지보수 상태
2026-09-10 사용자 승인으로 저장소 정리를 수행했다.

### 브랜치
- 정리 전: 200개
- 현재: 85개
- 기존 브랜치 삭제: 115개
- 삭제 조건: branch tip이 이미 `preview` 또는 `main` history에 포함된 경우만
- 고유 미병합 작업 브랜치: 53개 — **자동 삭제하지 않고 보존**
- `main`, `preview`, `production`, release/backup/history 기준은 보존

### Workflow
- `.github/workflows/temp-*` 일회성 Workflow 실제 실행 기준 82개 삭제
- 현재 `.github/workflows/temp-*`: 0개 확인
- `Repository Maintenance` Workflow는 수동 `workflow_dispatch` 전용
- 유지보수 Workflow는 병합된 임시 브랜치만 삭제하고 미병합 branch는 `KEEP_UNMERGED` 처리

### 아직 남은 운영 위험
- `preview`, `main`, `production`의 GitHub branch protection이 현재 `protected:false`
- force-push/branch 삭제 방지 설정은 아직 실제 적용되지 않음
- 이 항목은 GitHub 관리자 설정 단계가 필요하며 완료로 보고하지 않는다.

## 10. AI 작업/검증 순서
현재 원칙:
1. ChatGPT 설계/범위/데이터 위험 판단
2. Codex 구현 — `preview`, 배포 금지
3. Codex TypeScript/Build/Test 후 commit 고정
4. Work 독립 감사 — 기본 수정 금지
5. ChatGPT GitHub/실제 환경 최종 확인
6. 사용자 PREVIEW 배포 승인
7. PREVIEW 실사용 검증
8. 사용자 요청 시 TEST 승격
9. 명확한 승인 후에만 PRODUCTION

현재 대형 백엔드 구현 권장 모델: GPT-6 Astra Medium.
사용량 절약은 `DOCS/CODEX_USAGE_BUDGET.md` 기준을 따른다.

## 11. 다음 작업 — 순서 고정
1. `CLOUDFLARE_READONLY_TOKEN` 준비
2. `Cost Zero Stage 2A Live Readonly` 실행
3. 실제 D1 table/index/trigger 및 기존 변경 journal 유무 확인
4. 기존 구조 재사용 가능 여부 판단
5. 새 additive journal이 정말 필요하면 구조/비용/하위호환을 사용자에게 보고하고 승인 후 구현
6. Codex가 남은 `/feed-revision` + 공개프로필 초저비용 구조 구현
7. Work 감사
8. 사용자 승인 후 PREVIEW 배포/실사용 비용 검증

## 12. 이번 단계에서 절대 건드리지 않는 것
- Music Note 60초 묶음 저장 정상 경로
- Library 정상 캐시 경로
- 기존 UI/반응형/간격/색상
- 공유 canonical 사용자 데이터 삭제/대량변환
- 승인 없는 D1 migration/backfill
- `main` TEST 승격
- PRODUCTION 앱/Hosting/Worker/Data
- FCM/WebSocket/새 외부 실시간 인프라

## 13. 완료 판정
현재 상태는:
- `63d26bf`: **코드 반영 완료 · 배포 전 · 전체 비용 과제 미완료**
- GitHub 브랜치/temp Workflow 정리: **완료**
- branch protection: **미완료**
- Cloudflare D1 read-only 인증: **미완료**
- 실제 D1 schema/journal 감사: **미검증**
- PREVIEW/TEST/PRODUCTION 사용자 데이터 변경: **없음**
- Firebase/Cloudflare 런타임 배포: **없음**

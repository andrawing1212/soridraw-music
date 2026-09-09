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
- `63d26bf` 이후 `preview`에는 GitHub 저장소 유지보수, 읽기전용 감사 Workflow, 문서 정리 commit만 추가되어 있다. 작업 시작 시 실제 `preview` HEAD를 다시 확인한다.

## 2. 실제 배포 상태
- PREVIEW 052: Firebase 배포/검증 완료 — 단, `63d26bf` 이후 코드는 아직 배포하지 않음
- TEST 052: Firebase 배포/실제 번들 검증 완료
- TEST 브랜딩/아이콘: 승인된 TEST 042 기준 유지
- PRODUCTION: 현재 Explore 비용 작업으로 앱/Hosting/Worker를 승격하지 않음
- Functions / Firestore Rules: 현재 작업에서 변경/배포 없음
- 사용자 데이터: 현재 작업에서 변경 없음

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
- 실제 변경 후 D1 rows_read 비용 검증

따라서 `63d26bf`는 **안전한 중간 기준점**이며 초저비용 구조 전체 완료본이 아니다.

## 5. 2026-09-10 실제 공유 D1 읽기전용 감사 — 성공
전용 GitHub Secret `CLOUDFLARE_READONLY_TOKEN`으로 `Cost Zero Stage 2A Live Readonly #5`를 실행했다.

검증 결과:
- Workflow: SUCCESS
- Worker 소스 조회: 성공
- 실제 공유 D1 sqlite schema 조회: 성공
- schema query rows_read: 506 / rows_written: 0
- 구조 count query rows_read: 67 / rows_written: 0
- `D1_SCHEMA_QUERY_UNAVAILABLE=false`
- `NO_WORKER_DEPLOY=true`
- `NO_D1_WRITE=true`

현재 실제 데이터 규모(읽기전용 count):
- `public_profiles`: 3
- `tracks`: 34
- `follows`: 4
- `likes`: 26

### 실제 D1에서 확인한 핵심 구조
`explore_shared_revision`은 실제 존재한다.
```sql
CREATE TABLE explore_shared_revision (
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
)
```

051 shared-revision trigger도 실제 존재한다. `tracks`, `track_stats`, `likes`, `public_profiles`, `profile_stats`, `follows`, `comments`, `track_tags`, `public_folders`, `public_folder_tracks` 등 관련 canonical 변경 시 global revision을 +1 한다.

그러나 이 trigger들은 **변경된 track/profile ID를 기록하지 않는다.** 실제 schema에는 변경 ID journal/change event table이 확인되지 않았다.

따라서 Codex의 안전 중단 판단이 실DB에서도 확인됐다:
- 기존 global revision만으로는 어느 항목이 바뀌었는지 알 수 없음
- `/feed-revision`의 전체 rebuild만 제거하면 다른 환경 변경을 놓칠 수 있음
- 변경 ID를 durable하게 남기는 **추가형 구조가 필요**함

## 6. 실제 D1 확인으로 좁혀진 최소 설계 방향
기존 051 global revision과 기존 TEST/PRODUCTION Worker는 그대로 유지한다.

필요한 추가 구조는 사용자 원본 데이터 테이블을 바꾸는 방식이 아니라 **파생 변경 신호용 작은 additive 구조**다.

우선 설계 방향:
- 변경 ID를 단조 증가 순서와 함께 기록
- track/profile 종류 + ID + 삭제/갱신 상태를 기록
- DB trigger가 canonical 변경과 같은 transaction 안에서 자동 기록
- old TEST/PRODUCTION Worker가 변경해도 DB trigger가 기록하므로 PREVIEW가 변경을 놓치지 않음
- 환경별 cursor는 환경별 R2 파생 캐시에 저장
- 변경이 없을 때 `/feed-revision`은 Edge/R2 작은 상태만 사용하고 전체 Feed builder를 호출하지 않음
- 변경이 있을 때 변경 ID만 exact lookup하여 R2 Feed/Profile snapshot을 부분 수정

추가 검토가 필요한 한 항목:
- 현재 popular 정렬은 `like_count DESC, published_at DESC, id DESC`이며 canonical D1에 이를 완전히 만족하는 ranking index가 없음.
- 하락/삭제 후 top40을 정확히 refill하면서 전체 scan을 피하려면 작은 추가 ranking index/파생 구조가 필요한지 구현 전 확정해야 한다.

**새 D1 table/index/trigger는 공유 D1 schema 변경이므로 사용자 명확한 승인 전 적용하지 않는다.**

## 7. 공개프로필 비용 경로 — 실제 코드 확인
브라우저 로컬 캐시가 있으면 즉시 로컬 데이터를 반환하지만 현재 10초 이후 background revision request를 보낸다.

cold request에는 `__soridraw_shared_profile=51`이 붙고, 031은 이를 받으면 `materializePublicProfileFirstView()`를 강제로 호출한다.

실제 D1에는 이미 `public_profile_first_views` snapshot table과 handle/updated index가 존재한다. 기존 Worker에도 R2/Edge first-view bundle 경로가 있다.

따라서 다음 구현에서는:
- 앱 버전/cold 여부 때문에 강제 materialize하는 051 repair flag 제거
- 정상 R2/Edge snapshot 우선
- 실제 snapshot missing/corrupt일 때만 bounded repair
- 변경 ID 신호가 들어오면 해당 profile/track만 snapshot patch
방향으로 좁힌다.

## 8. 비용 합격선 — 고정
- 앱 업데이트 + 정상 캐시: D1 data read 0 / Firestore data read 0 목표
- Explore 재진입 + 변경 없음: D1 data read 0 목표
- 공개프로필 재진입 + 변경 없음: D1 data read 0 목표
- 좋아요 1회: 전체 Feed scan/rebuild 0
- 공개/비공개 1곡: 전체 Feed/프로필 scan 0
- mutation 비용은 전체 곡 수/사용자 수에 비례하면 실패
- 한 항목 변경 때문에 전체 목록/프로필을 다시 생성하지 않음
- 실제 비용이 예상보다 크면 원인을 확정하기 전 다음 승격 금지

## 9. Music Note / UI 보호 기준
이번 Explore 작업과 분리한다.

Music Note:
- 로컬 즉시 반영
- 여러 수정 약 60초 묶음 서버 저장
- 종료/백그라운드 시 남은 변경 안전 마무리
- 페이지 이동/재진입만으로 write 금지

UI:
- 사용자 요청 없이 외곽선/위치/크기/간격/반응형/테마/색상 변경 금지

## 10. GitHub 저장소 유지보수 상태
- 브랜치: 200개 → 85개
- 기존 branch 115개는 `preview/main` 포함 확인 후 삭제
- 고유 미병합 branch 53개는 자동 삭제하지 않고 보존
- `.github/workflows/temp-*` 82개 삭제, 현재 0개 확인
- `Repository Maintenance`와 D1 read-only 감사 Workflow는 수동 실행 전용
- `preview`, `main`, `production` branch protection은 아직 미완료이며 현재 원래 Explore 비용 작업보다 우선하지 않는다.

## 11. AI 작업/검증 순서
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

## 12. 다음 작업 — 원래 목표로 복귀
1. 사용자에게 **additive D1 변경 ID 구조 + 필요 시 popular ranking 보조 구조 추가 승인**을 받는다.
2. 승인 후 Codex가 `63d26bf` 안전성 개선을 유지한 채 `/feed-revision` 전체 rebuild 제거 + 변경 ID 소비 + 공개프로필 cold 강제 materialize 제거를 구현한다.
3. TypeScript / Build / 관련 verifier / 새 비용 회귀 테스트.
4. Work 독립 감사.
5. 사용자 승인 후에만 PREVIEW 배포.
6. CACHE LIVE에서 update/revisit/like/public/private/profile 비용을 실제 검증한다.

## 13. 이번 단계에서 절대 건드리지 않는 것
- Music Note 60초 묶음 저장 정상 경로
- Library 정상 캐시 경로
- 기존 UI/반응형/간격/색상
- 공유 canonical 사용자 데이터 삭제/대량변환
- 승인 없는 D1 schema 변경/backfill
- `main` TEST 승격
- PRODUCTION 앱/Hosting/Worker/Data
- FCM/WebSocket/새 외부 실시간 인프라

## 14. 현재 완료 판정
- `63d26bf`: **코드 반영 완료 · 배포 전 · 전체 비용 과제 미완료**
- 실제 D1 read-only schema 감사: **완료**
- 기존 changed-ID journal 존재 여부: **없음 확인**
- 다음 blocker: **additive D1 변경 신호 구조 승인**
- PREVIEW/TEST/PRODUCTION 사용자 데이터 변경: **없음**
- Firebase/Cloudflare 런타임 배포: **없음**

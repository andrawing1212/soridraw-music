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
- 이번 구현 기준 commit: `14d6ef904b9163e2f46658e96fa5cf0beff1ebb1`
- 최신 코드: 이 문서를 포함한 preview commit (`git log -1`로 최종 SHA 확인)
  - 내용: trigger 파생 상태 + 환경별 cursor/CAS, bounded ranking refill, cold profile 강제 materialize 제거
  - 상태: **코드 검증 완료 · SQL/seed 실행 전 · 배포 전**
- PREVIEW 실제 배포 런타임 기준 commit: `2819dcf57904a8db7222a89c18965c28b94da60a`
- TEST 앱 코드 기준 commit: `3b574c05589230f077eceff98190edd4b5195f75`
- `63d26bf`의 CAS 안전성은 유지한다. 이번 구현은 `14d6ef9` 이후 변경이며 main/production에 반영하지 않았다.

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

### 이번 구현에서 완료 — 배포 전
- /feed-revision의 030/031 전체 latest+popular builder 경로를 032 변경 ID 소비기로 교체.
- canonical tracks/track_stats/public_profiles/profile_stats 변경을 같은 DB transaction의 additive trigger로 포착. 기존 Worker 수정에 의존하지 않음.
- 환경별 R2 payload와 journal cursor를 기존 63d CAS로 함께 갱신. 중복 이벤트/동시 소비 보호.
- popular 하락/삭제 및 profile pinned 변경 시 covering index에서 최대 41/51개 ID만 읽고 변경/진입 item만 조회.
- 최초 R2 bootstrap은 읽기 전 확보한 scope max seq를 cursor에 저장. seed 이벤트 재소비 방지.
- 무변경 재진입 focused 검사: 예상 item 조회 0 / 실제 0.
- 공개프로필 cold 강제 materialize flag 제거. 브라우저 schema 6, 앱 052, UI, Music Note/Library 유지.
- TypeScript / build / 033·045·048·049·051 / 기존 CAS / 새 비용 회귀 / 실제 생성 Worker syntax: PASS.
- 남은 작업: 배포 승인, additive SQL/seed 실제 적용, 실제 Cloudflare rows_read 및 실사용 검증.

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

## 6. 승인된 additive D1 구조 — 파일 작성 완료, 실제 적용 안 함
사용자가 additive 구조와 최초 파생 seed를 승인했다. 기존 051 global revision 및 canonical 테이블/필드는 변경하지 않는다.

- explore_derived_state: 단조 증가 seq 및 seeded 표식.
- explore_derived_changes: scope/kind/ID별 마지막 seq. 삭제 ID 신호를 유지해 오랫동안 방문하지 않은 환경도 catch-up 가능.
- explore_derived_tracks: 표시 projection 및 latest/popular/profile 정렬 키.
- explore_derived_profiles: 공개 프로필 projection, 통계, 증분 공개 곡 수.
- 변경 순서/handle/세 정렬용 index, canonical 및 파생 trigger. 이들은 사용자 원본을 쓰지 않는다.
- 환경별 소비 cursor는 각 환경 R2 bundle 안에 저장. 기존 TEST/PRODUCTION은 기존 canonical 쓰기를 그대로 사용한다.

적용 순서(이번 작업에서는 실행하지 않음):
1. shared D1에 migrations/20260910_01_explore_derived_state.sql 적용.
2. migrations/20260910_02_explore_derived_seed.sql의 3개 문장을 단일 transactional D1 batch로 실행.
3. seeded=1 확인 후에만 PREVIEW Worker 활성화. 런타임 요청은 seed를 실행하지 않으며, 미준비 상태에서 전체조회로 fallback하지 않는다.

seed는 현재 profile/track을 읽어 새 파생 테이블만 채운다. 두 번째 실행은 seeded guard로 no-op이다. 기존 사용자 원본, public_profile_first_views, 051 trigger는 수정하지 않는다. D1 batch transaction 계약: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

## 7. 비용 및 검증의 정확한 범위
- 정상 캐시, 같은 cursor: canonical data 조회 0 / item 조회 0 / rank 조회 0 / cache write 0.
- Edge head가 정상인 10초 구간의 unchanged 재진입: fixture에서 모든 D1 query 0.
- Edge miss/만료: 오래된 타 환경 Worker 변경 감지를 위한 작은 readiness/scope head 조회는 필요. 모든 재방문에서 D1 전체 read가 무조건 0이라는 뜻은 아니다.
- 실제 변경: 최대 64개 journal ID batch, 변경 ID exact projection 조회. 정렬/진입 자격이 그대로이면 rank 조회도 생략.
- 순위 하락/삭제/경계 변경: covering index 최대 41개 Feed / 51개 Profile ID 조회 후 필요한 item만 조회. 20개를 넘는 부분은 이 제한된 index ID window이며 전체 canonical scan이나 전체 payload 재구축이 아니다.
- profile edit/follow는 해당 profile projection delta. 공개/비공개/owner 변경의 곡 수는 trigger에서 증분 관리한다.
- 정상 R2 profile 재진입은 materialize 0. missing/corrupt 또는 최초 cursor 계약 도입 시에만 bounded derived window 초기화.
- seed 비용은 최초 canonical profile/track 읽기와 파생 상태 write. 이후 원본 전체 seed 반복 없음.
- SQL EXPLAIN: ranking covering index 사용, canonical tracks scan 및 임시 정렬 없음.
- SQLite fixture 및 실제 감사 Worker에 031/032를 적용한 생성본으로 rollback/seed 재실행/독립 환경 catch-up/CAS/정확한 top40/pinned cursor 검증 PASS.
- 실제 Cloudflare rows_read/rows_written 및 SQL 적용/배포 후 사용자 흐름은 미검증. Node 24 SQLite fixture 사용; root TypeScript/build는 기존 임시 NTFS 작업공간에 최종 소스를 복사하고 Node 20으로 검증.
- build는 성공했으며 기존 chunk 크기 및 혼합 dynamic/static import 경고가 남음.

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

## 12. 다음 작업
1. 이 preview commit에 대한 Work 독립 감사.
2. 사용자 승인 후 shared additive SQL/단일 seed batch 및 PREVIEW Worker 적용 순서 확인.
3. 승인된 PREVIEW 배포 후 CACHE LIVE에서 update/revisit/like/public/private/profile 실제 비용 확인.
4. TEST/PRODUCTION 승격은 별도 승인. force/rebase/merge 및 이번 작업 중 배포 없음.

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
- 코드/검증: 완료. 이번 문서를 포함하는 commit을 preview에 fast-forward push하는 단계.
- 무변경 재진입 item 조회: **예상 0 / 실제 0 PASS**.
- Root TypeScript / Build / 관련 기존 verifier / CAS / 새 비용 회귀: **PASS**.
- 실제 DB SQL/seed 실행, 사용자 데이터 변경, Firebase/Cloudflare 배포: **없음**.
- 남은 위험: 실D1 비용 미측정, SQL 적용 전 새 runtime 활성화 금지, 이벤트 backlog는 64개씩 catch-up, 기존 branch protection 미완료.

이번/누적 변경 파일(기준 14d6ef9 이후):
- DOCS/CURRENT_RELEASE_STATE.md
- cloudflare/explore-worker/migrations/20260910_01_explore_derived_state.sql
- cloudflare/explore-worker/migrations/20260910_02_explore_derived_seed.sql
- cloudflare/explore-worker/patches/030-explore-feed-integrity-self-heal.mjs
- cloudflare/explore-worker/patches/031-explore-shared-canonical-data.mjs
- cloudflare/explore-worker/patches/032-derived-change-cache.mjs
- cloudflare/explore-worker/runtime/derived-cache.js
- cloudflare/explore-worker/scripts/cache-mutation-safety.mjs
- cloudflare/explore-worker/scripts/fixtures/canonical-schema.sql
- scripts/verify-048-explore-public-profile-parity.mjs
- scripts/verify-049-explore-feed-integrity.mjs
- scripts/verify-051-explore-shared-canonical-data.mjs
- scripts/verify-explore-derived-cache.mjs
- src/services/exploreProfileFirstViewService.ts

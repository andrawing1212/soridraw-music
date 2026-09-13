# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 실제 배포 상태가 문서와 다르면 실제 상태를 우선한다.

## 1. 실제 배포 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 기준 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **실제 PREVIEW 앱: 074**
- PREVIEW 074 코드 commit: `835dd2cb0b5c206696a7e94dc18e9041155cbe23`
- PREVIEW 074 release trigger/locked build: `1d5ecf841ae8335d21b992d3e7f4c160add75839`
- PREVIEW 074 Apply Run `34639807460` — PASS
- PREVIEW 074 App Run `34639940311` — PASS
- PREVIEW Worker: 069 / Version ID `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- Shared D1 069 additive schema Run `34630980764` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- `preview` HEAD at 075/076 work start: `d9923a2394afb4c29e345f2d7d0506312a0af29c`

## 2. 현재 진행 중인 작업 — 075 / 076
작업 branch: `work/social-snapshot-075-v2`

목표:
- 개인 좋아요/팔로우는 사용자별 Social Snapshot으로 묶어 읽기.
- 좋아요 입력은 사용자별 대기행 1개로 압축.
- 변경 없는 10분 aggregate는 D1 write 0.
- 공개/비공개 시 기기 Feed/공개프로필 전체 캐시 삭제 금지, 변경곡만 패치.
- 개인 좋아요 표시가 다른 계정의 공용 Feed/Profile cache에 섞이지 않게 분리.
- 기존 파생 Feed/Profile trigger의 불필요한 write fan-out 축소.

075 실제 클라이언트/계정전환 보호 최종 코드 commit:
- `e3ac6ad3f4fa9d23f15a600269cba09c8551c80c`
- message: `fix: scope like sync events to active uid`

075 전체 자동검증 Run:
- Run `34733171828` — PASS
- UID-scoped sync event guard PASS
- Worker 042 static PASS
- additive 075 D1 schema PASS
- reversal/cost verifier PASS
- client contract PASS
- TypeScript PASS
- Build PASS
- change boundary PASS
- UI/CSS 변경 없음
- 사용자 데이터 변경 없음

## 3. 075 구조 — 검증 완료, 미배포
### 개인 Social Snapshot
- `/v1/me/social-snapshot`
- 좋아요 track IDs + following UIDs를 한 개인 snapshot으로 읽음.
- 정상 snapshot은 R2 우선, D1은 recovery 전용.
- 기기 persistent cache는 UID별로 분리.

### 좋아요 대기 구조
- additive candidate table: `explore_like_user_queue_075`
- 사용자별 대기행 1개.
- 같은 사용자가 여러 곡을 바꿔도 같은 행의 JSON patch로 최종 상태만 유지.
- 처리 후 행 삭제/재생성 대신 같은 사용자 행 재사용.
- like→unlike→like 최종 ON 보존 PASS.
- 처리된 사용자 행 재사용 PASS.
- legacy 035/066/069 queue와 동시 호환 fallback 유지.

### idle 비용
- 10분 scheduled aggregate에서 처리할 queue가 없으면 lease write 전 return.
- 구조 검증상 idle D1 row write = 0.

### 계정전환 안전
- 좋아요 sync/sync-error browser event에 UID 포함.
- 현재 로그인 UID와 다른 늦은 event는 Explore 화면에서 무시.
- A→B 직접 계정전환 시 기존 `likedTrackIds` 즉시 초기화 후 B 계정 상태 hydrate.
- 개인 optimistic count/heart를 공용 Feed/Profile persistent cache에 사용자 구분 없이 쓰지 않음.

### 공개/비공개 local cache
- Music Note 공개 시 Worker response의 `snapshotItem`으로 현재 기기 Feed/Profile cache의 해당 곡만 upsert.
- 비공개 시 해당 곡만 remove.
- 공개 옵션 수정 시 해당 곡만 patch.
- 전체 Feed/Profile local cache invalidate 금지.

## 4. 기존 파생 trigger write 증폭 — 확인됨
`20260910_01_explore_derived_state.sql`을 canonical fixture에 그대로 재현한 SQLite 구조 테스트 기준:
- like count 1회 update → **8 row changes**
- 공개/비공개 1회 update → **12 row changes**
- bio 등 profile row 1회 update → **6 row changes**

중요:
- 위 숫자는 SQLite `total_changes`로 측정한 **구조상 row 변경 수**다.
- Cloudflare D1 실제 청구 `rows_written`은 index write까지 포함할 수 있으므로 이 숫자를 청구량으로 단정하지 않는다.
- 실제 billed rows는 PREVIEW 안전 적용 후 D1 query `meta.rows_written` telemetry로 별도 확인해야 한다.

## 5. 076 파생 trigger 압축 후보 — 오프라인 검증 완료 / 공유 D1 미적용
후보:
- `cloudflare/explore-worker/candidates/076-derived-trigger-compaction.sql`
- **TEST/OFFLINE ONLY** 표시 유지.
- 현재 additive-only shared-D1 release workflow로 실행 금지.

변경 원칙:
- 기존 `explore_derived_*` table/column/scope/kind contract 유지.
- 5개 trigger 정의만 교체 후보.
- 같은 mutation의 Feed scope + Profile scope sibling event는 같은 global seq 재사용.
- 각 소비 cursor는 scope별이므로 같은 scope 안에서 같은 seq가 겹치지 않도록 보장.
- owner가 안 바뀐 track update의 old-owner 중복 event 제거.
- 같은 owner의 active 변화 시 track_count를 subtract+add 두 번 하지 않고 1회 update.
- track scope event가 profile projection을 다시 읽기 때문에 track_count-only profile event 제거.
- bio/background/SNS/genre처럼 Feed 카드가 사용하지 않는 profile 필드는 Feed wake-up 제거.
- nickname/avatar/active는 Feed 카드가 사용하므로 기존 갱신 유지.

076 비용/의미 검증 Run `34732991095` — PASS:
- 기존 baseline: like 8 / visibility 12 / profile 6 확인.
- 076 candidate:
  - like count update: **8 → 5 row changes**
  - 공개/비공개: **12 → 6 row changes**
  - bio/background/SNS 계열 profile update: **6 → 4 row changes**
  - nickname/avatar 같이 Feed가 실제 사용하는 profile update: **6 유지**
- Feed track 갱신 PASS.
- Public profile track 갱신 PASS.
- track_count 갱신 PASS.
- profile scope 갱신 PASS.
- 같은 scope 내부 seq collision 없음 PASS.

## 6. 076 데이터 순도 / rollback 검증
Read-only verification workflow:
- `.github/workflows/verify-076-trigger-maintenance.yml`
- Run `34733413924` — PASS

확정:
- 교체 대상 trigger 정확히 5개 PASS.
- table DDL 0 PASS.
- direct data DELETE 0 PASS.
- trigger DDL 적용 직후 저장 데이터 **0행 변경** PASS.
- index 변경 없음 PASS.
- 관계없는 trigger 변경 없음 PASS.
- 기존 5개 trigger 정의를 캡처해 rollback한 뒤 **원래 trigger SQL 정확히 복구** PASS.
- rollback 전/후 저장 데이터 동일 PASS.
- 이 검증 workflow는 `contents: read`이고 Shared D1/Worker/Firebase 실행 기능 없음.

## 7. TEST / PRODUCTION 호환 판단
- `main` 현재 repository Worker tree에는 PREVIEW의 새 `runtime/derived-cache.js`가 없음.
- 076은 canonical `tracks`, `track_stats`, `public_profiles`, `profile_stats`의 schema/의미를 바꾸지 않음.
- 파생 table 이름/column/scope/kind 형식도 유지.
- 따라서 현재 TEST/PRODUCTION 코드가 읽는 원본 데이터 계약을 변경하지 않는 방향으로 설계됨.
- 그래도 실제 shared D1 trigger 교체는 모든 환경이 공유하는 DB 동작을 바꾸므로 사용자 승인 없는 실행 금지.

## 8. 배포 / 데이터 상태
현재까지 075/076 작업은 **코드 및 오프라인 검증만 완료**.

변경하지 않은 것:
- `preview` branch 미변경.
- PREVIEW Hosting 미배포 — 실제 앱 074 유지.
- PREVIEW Worker 미배포 — 실제 Worker 069 유지.
- Shared D1 075 table 미적용.
- Shared D1 076 trigger 미적용.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- TEST 변경 없음.
- PRODUCTION 변경 없음.
- 실사용자 원본 데이터 변경 없음.

## 9. 절대 보호
- 사용자 Music Note / Library / 공개곡 / 좋아요 / 팔로우 / 프로필 원본 데이터 삭제/백필/덮어쓰기 금지.
- UI/CSS/위치/간격/반응형 변경 금지.
- 074에서 확인된 즉시 좋아요 UX 유지.
- 1분 client like batch + 10분 canonical aggregate 원칙 유지.
- 정상 cache 재진입 Worker/D1 0 목표 유지.
- preview/main/production 임의 혼합 금지.

## 10. 남은 위험 / 승인 경계
### 아직 실환경에서 검증하지 않은 것
- 075 Worker 042 실제 PREVIEW 동작.
- 075 shared D1 queue 실제 `meta.rows_written`.
- 076 trigger 교체 후 실제 Cloudflare billed `rows_written`.
- 3곡 같은 1분 window 실환경 1-user-row 동작.
- ON→OFF→ON / OFF→ON→OFF 실제 aggregate 최종 수렴.
- PC↔mobile same-account.
- 동일 브라우저 A↔B account switch 실사용 화면 순도.

### 승인 경계
076은 데이터 행을 바꾸지 않지만 **공유 D1의 기존 trigger 정의를 교체**한다.
현재 고정 shared-D1 workflow는 additive-only이므로 임의 우회 실행 금지.

다음 실제 단계는 사용자 승인 후에만:
1. 075/076 기준 commit 고정.
2. shared D1 현재 5개 trigger SQL read-only 캡처/preflight.
3. 별도 수동 maintenance 경로로 076 trigger 5개만 교체.
4. 즉시 postflight + 데이터 row count/hash + trigger SQL 확인.
5. 실패 시 캡처한 기존 5개 trigger 즉시 rollback.
6. 075 additive queue schema 적용.
7. PREVIEW Worker 042 배포.
8. PREVIEW App 075 배포.
9. 실제 좋아요/공개/프로필/PC↔mobile/계정전환/비용 telemetry 검증.
10. 하나라도 실패하면 TEST 승격 중단.

## 11. 현재 판정
- 075 코드/자동검증: **PASS / 미배포**.
- 075 계정전환 event isolation: **PASS / 실사용 검증 전**.
- 076 비용 구조: **PASS / 오프라인 후보**.
- 076 data purity + rollback: **PASS / 공유 D1 미적용**.
- PREVIEW 실제 서비스: **074 + Worker 069 그대로**.
- TEST 승격: **금지**.
- PRODUCTION 승격: **금지**.

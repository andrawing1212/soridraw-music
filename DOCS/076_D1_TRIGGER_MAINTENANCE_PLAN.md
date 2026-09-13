# SORIDRAW 076 SHARED D1 TRIGGER MAINTENANCE PLAN

상태: **준비 완료 / 실행 승인 전 / 공유 D1 미변경**

## 목적
기존 canonical 사용자 데이터와 `explore_derived_*` 데이터 형식을 유지하면서, 파생 trigger의 불필요한 write fan-out만 줄인다.

후보 SQL:
- `cloudflare/explore-worker/candidates/076-derived-trigger-compaction.sql`

교체 대상은 아래 5개 trigger뿐이다.
- `explore032_derived_track_insert`
- `explore032_derived_track_update`
- `explore032_derived_track_delete`
- `explore032_derived_profile_update`
- `explore032_derived_profile_feed`

## 절대 금지
- 사용자 데이터 DELETE/UPDATE/backfill
- table DROP/ALTER
- index 변경
- 전체 derived 데이터 재생성
- migration seed
- PREVIEW 검증 전 TEST/PRODUCTION 승격
- 기존 additive-only shared-D1 workflow를 수정해서 우회 실행

## 실행 전 preflight — read-only
실제 적용 직전 반드시 Shared D1에서 SELECT/read-only로 확인한다.

1. 필수 canonical tables 존재 확인.
2. `explore_derived_state`, `explore_derived_changes`, `explore_derived_profiles`, `explore_derived_tracks` 존재 확인.
3. `seeded=1` 확인.
4. 현재 5개 target trigger 이름/SQL 전체 캡처.
5. 현재 `explore032_*` trigger 전체 목록 캡처.
6. canonical 핵심 table row counts 캡처.
7. derived 핵심 table row counts 캡처.
8. 조회 실패 또는 예상 trigger 누락 시 즉시 중단.

## 적용
- 명시적으로 승인된 고정 commit의 076 candidate만 사용.
- 5개 target trigger만 DROP/CREATE.
- table/index/data row 변경 명령 실행 금지.
- 적용 중 다른 migration/seed/Worker/App 배포 혼합 금지.

## 즉시 postflight
1. target trigger 5개 존재 확인.
2. target trigger SQL이 승인된 candidate와 일치 확인.
3. target 외 `explore032_*` trigger 정의가 preflight와 동일한지 확인.
4. table/index schema unchanged 확인.
5. canonical row counts unchanged 확인.
6. derived row counts unchanged 확인.
7. 하나라도 실패하면 다음 단계 중단.

## rollback
preflight에서 캡처한 원본 5개 trigger SQL이 유일한 rollback 기준이다.

실패 시:
1. candidate target 5개 trigger 삭제.
2. preflight에서 캡처한 원본 5개 trigger SQL 복구.
3. trigger 목록/SQL 재확인.
4. canonical/derived row counts 재확인.
5. Worker/App 배포 금지.

오프라인 rollback verifier:
- `scripts/verify-076-trigger-maintenance.py`
- Run `34733413924` — PASS
- trigger 교체 DDL 자체 저장 데이터 0행 변경 PASS
- index 변경 없음 PASS
- unrelated trigger 변경 없음 PASS
- 원본 trigger SQL exact restore PASS

## 076 적용 후 PREVIEW 검증
076만 성공해도 바로 TEST로 가지 않는다.
075 additive queue + Worker 042 + App 075를 PREVIEW에 맞춘 뒤 다음을 실측한다.

- idle 10분 cron
- 1 like
- 1 unlike
- ON→OFF→ON
- OFF→ON→OFF
- 3곡 같은 1분 window
- 한 사용자 여러 곡
- 여러 사용자 같은 곡
- public / private
- profile bio/background
- profile nickname/avatar
- PC↔mobile same-account
- 같은 브라우저 A↔B account switch

D1 비용은 SQLite 구조 row changes가 아니라 실제 query metadata의 `rows_read` / `rows_written`으로 확정한다.

## 현재 구조 테스트 결과
- like count: `8 → 5` structural row changes
- public/private: `12 → 6`
- bio/background/SNS profile: `6 → 4`
- nickname/avatar: `6 유지` — Feed가 실제 소비하므로 유지

이 숫자는 Cloudflare 청구량이 아니라 SQLite `total_changes` 기준 구조 지표다.

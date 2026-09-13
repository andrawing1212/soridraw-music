# NEXT CODEX TASK

상태: **075 코드/검증 PASS + 076 비용/rollback 후보 PASS / 실제 PREVIEW는 074 + Worker 069 유지 / 공유 D1 변경 승인 전 대기 / TEST 승격 금지**

## 현재 기준
- repository: `andrawing1212/soridraw-music`
- deployed PREVIEW branch: `preview`
- 실제 PREVIEW 앱: `074`
- 실제 PREVIEW Worker: `069` / `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- 작업 branch: `work/social-snapshot-075-v2`
- 075 client/account-isolation final source commit: `e3ac6ad3f4fa9d23f15a600269cba09c8551c80c`
- 076 maintenance verifier Run `34733413924` — PASS

## 완료된 작업
- 개인 좋아요 + 팔로우 Social Snapshot.
- UID-scoped persistent cache.
- UID-scoped browser sync/sync-error event.
- A→B 계정전환 시 old liked state 즉시 초기화.
- 사용자별 like pending row 1개 압축.
- like↔unlike reversal 최종 상태 보존.
- idle 10분 aggregate D1 row write 0 구조.
- 공개/비공개 local Feed/Profile 전체 invalidate 제거, changed track only patch.
- 076 trigger candidate로 구조 row changes 감소:
  - like `8 → 5`
  - visibility `12 → 6`
  - bio/background/SNS profile `6 → 4`
  - avatar/nickname은 Feed 반영 필요로 `6 유지`
- 076 trigger DDL data purity PASS.
- 076 rollback exact original trigger SQL restore PASS.

## 절대 실행 금지 — 승인 전
- Shared D1 076 trigger replacement.
- Shared D1 075 additive queue apply.
- PREVIEW Worker 042 deploy.
- PREVIEW App 075 deploy.
- main/TEST promotion.
- production promotion.
- 사용자 데이터 backfill/migration/delete/overwrite.

## 다음 작업 — 사용자 승인 전 가능한 범위
실제 배포는 하지 말고 아래 준비만 한다.

1. 075/076 final candidate commit을 하나로 고정한다.
2. 076 manual maintenance 절차 문서를 확정한다.
3. preflight는 SELECT/read-only만 사용하도록 설계한다.
4. live trigger 5개 SQL을 적용 직전 read-only 캡처하는 rollback contract를 준비한다.
5. postflight에서 trigger name/SQL, canonical row count, derived row count를 확인하도록 준비한다.
6. Cloudflare D1 query `meta.rows_read` / `meta.rows_written`을 PREVIEW에서 측정할 telemetry 계획을 고정한다.
7. 실환경 검증 matrix를 고정한다:
   - idle 10분 cron
   - 1 like / unlike
   - ON→OFF→ON
   - OFF→ON→OFF
   - 3곡 같은 1분 window
   - 한 사용자 여러 곡
   - 여러 사용자 같은 곡
   - public / private
   - profile bio/background/avatar
   - PC↔mobile same-account
   - 같은 브라우저 A↔B account switch
8. 하나라도 실패하면 TEST 승격 금지.

## 실제 적용 순서 — 사용자 승인 후에만
1. 기준 commit lock.
2. shared D1 live trigger read-only preflight + 5개 원본 SQL 캡처.
3. 076 trigger 5개만 수동 maintenance 경로로 교체.
4. 즉시 postflight.
5. 실패 시 원본 SQL로 즉시 rollback.
6. 075 additive queue schema 적용.
7. PREVIEW Worker 042 배포.
8. PREVIEW App 075 배포.
9. 실제 `preview.soridraw.com` 검증.
10. D1 billed `meta.rows_written` 실측.

## 비용 숫자 해석 주의
현재 `8→5`, `12→6`, `6→4`는 SQLite `total_changes` 기반 **구조상 row 변경 수**다.
Cloudflare D1의 실제 청구 rows_written은 index write가 추가될 수 있으므로 같은 숫자라고 단정하지 않는다.
실제 비용 판단은 PREVIEW 적용 후 D1 metadata 실측으로 확정한다.

## 보호할 정상 기능
- 즉시 하트 + 본인 로컬 숫자 UX.
- 1분 client batch.
- 10분 canonical aggregate.
- 기존 same-account signal.
- 정상 캐시 재진입 서버 read 0 목표.
- 공개프로필/Feed 기존 데이터 형식.
- UI/CSS/반응형.
- TEST/PRODUCTION 코드와 공유 사용자 원본 데이터.

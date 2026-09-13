# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 075**
- 075 제품 코드 commit: `15dcc55e84ad280f79ba48bed4d28dd908243531`
- PREVIEW Worker release trigger commit: `18ff22eac39a2c69411d56947a53f51677d2b4ed`
- PREVIEW App release trigger / locked build commit: `ac0bafe9bf545e80fd7f4050221ff187ea528913`
- PREVIEW Worker Release Run: `34734423534` — PASS
- PREVIEW App Release Run: `34734501063` — PASS
- PREVIEW active Worker Version ID: `5680557a-e732-449a-81f5-4bfdc42991ba`
- Shared D1 075/076 apply Run: `34734208590` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 075 핵심 구조
075는 074의 즉시 Local First UX를 유지하면서 개인 Social 상태와 좋아요 대기구조를 비용 중심으로 정리했다.

- 본인 좋아요/취소는 하트와 숫자가 즉시 로컬 반영.
- 개인 Social Snapshot이 `likedTrackIds + followingUids`를 한 번에 보관해 같은 계정의 반복 개인상태 읽기를 줄임.
- 좋아요 대기열은 `explore_like_user_queue_075` 한 행을 사용자별로 재사용한다.
- 같은 사용자가 여러 곡을 수정하거나 같은 곡을 반복 ON/OFF해도 최종 의도를 JSON patch로 합친다.
- 처리 완료된 사용자 행은 다음 변경 때 새 transient row를 만들지 않고 재사용한다.
- aggregate 할 일이 없으면 lease를 잡기 전에 종료하여 **idle aggregate D1 write 0** 구조로 변경.
- 공개 숫자는 기존 10분 canonical aggregate 원칙 유지.
- same-account 표시 숫자 replay 유지.
- 좋아요 sync / sync-error 이벤트에 `uid`를 포함하고 현재 로그인 UID와 일치할 때만 화면 반영.
- 계정 A→B 전환 순간 기존 하트 화면을 비워 A의 늦은 완료 이벤트가 B 화면에 섞이지 않게 함.
- 공개/비공개 후 Feed와 public-profile cache는 전체 갱신이 아니라 해당 곡만 patch/remove/upsert.
- UI/CSS/위치/간격/반응형 변경 없음.

## 3. 076 Shared D1 파생 트리거 최적화
중요: Shared D1의 `explore032_derived_track_update`는 이미 033에서 좋아요 비용 최적화가 적용돼 있었다. 따라서 076은 이를 덮어쓰지 않았다.

실제 live 033 기준으로 076이 교체한 것은 정확히 4개뿐:
- `explore032_derived_track_insert`
- `explore032_derived_track_delete`
- `explore032_derived_profile_update`
- `explore032_derived_profile_feed`

보호:
- `explore032_derived_track_update` 033 정의 그대로 유지.
- table/index 기존 구조 변경 없음.
- canonical 사용자 데이터 migration/delete/backfill 없음.
- 기존 저장 파생 데이터 변경 없이 trigger 정의만 교체.
- rollback 검증에서 기존 4개 trigger SQL 정확 복원 PASS.

효과 검증:
- bio/background/social URL처럼 Feed 카드에 쓰지 않는 프로필 수정은 불필요한 Feed wake-up 제거.
- avatar/nickname처럼 Feed에 실제 쓰이는 값은 Feed invalidation 유지.
- track insert/delete는 Feed + public profile cursor 의미와 track_count를 유지하면서 중복 seq/write를 줄임.
- 이미 033에서 최적화된 좋아요 track-update 경로는 그대로 보호.

## 4. Shared D1 실제 적용 결과
Run `34734208590` — PASS.

실제 Cloudflare one-time maintenance 수치:
- 076 trigger 4개 교체: `rows_written=4`, `rows_read=1160`.
- 075 additive queue/state/index 추가: `rows_written=7`, `rows_read=5`.
- 위 수치는 **이번 한 번의 배포 작업 수치**이며 좋아요 1회당 비용 수치가 아니다.

075 추가 객체:
- `explore_like_user_queue_075`
- `idx_explore_like_user_queue_075_updated`
- `explore_like_user_queue_state_075`

적용 직후:
- queue pending `0`.
- state clean.
- PREVIEW / TEST / PRODUCTION Feed·public profile read smoke PASS.
- 당시 PREVIEW / TEST / PRODUCTION Worker Version은 모두 변경 없음 확인 후 PREVIEW Worker만 별도 공식 배포함.
- 실사용자 원본 데이터 이동/삭제/백필/덮어쓰기 없음.

## 5. PREVIEW Worker 042 배포
Run `34734423534` — PASS.

배포 기준:
- locked product SHA: `15dcc55e84ad280f79ba48bed4d28dd908243531`
- canonical Worker SHA256: `bd9d087d7cd59bdd742d751c4da254daeed0ee44214848fa730dadb86cecbaeb`
- PREVIEW Worker before: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- PREVIEW Worker after: `5680557a-e732-449a-81f5-4bfdc42991ba`

실제 확인:
- Feed smoke PASS.
- public profile smoke PASS.
- `/v1/me/likes/batch` route 존재 확인, 비인증 요청 `401` 정상.
- warm Feed revision: **D1 R0 / W0**, `HEAD-ONLY-036` PASS.
- aggregate cron 정확히 `*/10 * * * *` PASS.
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` unchanged.
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` unchanged.

## 6. PREVIEW App 075 배포
Run `34734501063` — PASS.

- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `https://preview.soridraw.com/` exact build PASS.
- 실제 `app-version.json = 075` PASS.
- TEST / PRODUCTION branch unchanged PASS.
- TEST / PRODUCTION 실제 HTML unchanged PASS.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.

## 7. 비용 판정 — 현재 확정 범위
확정:
- 앱 업데이트/페이지 재진입 자체 때문에 좋아요 전체를 다시 읽는 구조를 만들지 않음.
- warm Feed revision은 실제 Worker 배포 후 D1 `R0/W0` 확인.
- idle scheduled aggregate는 코드/fixture 검증상 W0.
- 사용자별 pending queue는 한 사용자당 한 행 재사용 구조.
- Feed/public-profile 파생 갱신은 전체 재생성이 아니라 변경분 중심.

아직 **실제 Cloudflare billed rows_written per like**는 확정하지 않음.
- SQLite logical row change와 Cloudflare billed rows_written은 다를 수 있다.
- 인덱스/트리거/실제 cohort에 따라 달라질 수 있으므로 PREVIEW 실사용 batch에서 별도 측정해야 한다.

## 8. 기존 정상 기능 — 절대 보호
- 074 Local First 즉시 하트/숫자 UX.
- 좋아요 PREVIEW 1분 묶음 전송.
- canonical 공개 숫자 10분 aggregate.
- `baseLiked` + stable `mutationAt` reversal 의도 보존.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- Music Note / Library 기존 local-first 및 묶음저장.
- UI/CSS/반응형/분할 구조 비변경.
- 공유 사용자 원본 데이터 비파괴.

## 9. 현재 미완료 / TEST 승격 차단
자동검증과 PREVIEW 배포는 완료됐지만 아래 실제 사용 검증 전에는 TEST 승격 금지.

- 같은 계정에서 곡 3개를 한 PREVIEW 1분 window 안에 변경했을 때 사용자 queue가 한 행으로 유지되고 최종상태가 맞는지 실제 확인.
- aggregate 전 `like → unlike` 최종 OFF 실제 수렴.
- aggregate 전 `unlike → like` 최종 ON 실제 수렴.
- PC ↔ 모바일 same-account 하트/표시 숫자 전달 실제 확인.
- 같은 브라우저 계정 A ↔ B 전환 시 하트/표시 숫자 혼입이 없는지 실제 확인.
- 위 실제 시나리오의 Cloudflare `rows_read / rows_written` 측정.

## 10. 다음 작업
1. 사용자는 PREVIEW 075에서 평소처럼 좋아요/취소와 PC↔모바일 상태를 확인한다.
2. 개발 측은 3곡 batch / reversal / account-switch / Cloudflare 실제 비용을 계측한다.
3. 이상이 있으면 PREVIEW에서만 수정한다.
4. 모든 항목 PASS 후에만 TEST 승격 가능 여부를 판단한다.
5. PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 변경하지 않는다.

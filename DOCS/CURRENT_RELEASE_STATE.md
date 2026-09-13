# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW app-version 표시는 075 유지**
- **현재 PREVIEW에는 076 publication-state/cost hotfix가 반영됨**
- 076 hotfix product source commit: `9893590b526137a2528dfca8a50da87e20bcc056`
- PREVIEW Worker release trigger commit: `0034164facbe7bde4432e8a9737c447cb5aca56e`
- PREVIEW App release trigger commit: `b92babf1f53b24bc7663e2ca1566b9411154a1d9`
- PREVIEW Worker Release Run: `34737493945` — PASS
- PREVIEW App Release Run: `34737501029` — PASS
- Shared D1 075/076 apply Run: `34734208590` — PASS, 이번 076 hotfix 배포에서는 추가 D1 migration 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged 확인
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged 확인

## 2. 075 핵심 구조 — 계속 보호
075는 074의 즉시 Local First UX를 유지하면서 개인 Social 상태와 좋아요 대기구조를 비용 중심으로 정리했다.

- 본인 좋아요/취소는 하트와 숫자가 즉시 로컬 반영.
- 개인 Social Snapshot이 `likedTrackIds + followingUids`를 한 번에 보관해 같은 계정의 반복 개인상태 읽기를 줄임.
- 좋아요 대기열은 `explore_like_user_queue_075` 한 행을 사용자별로 재사용한다.
- 같은 사용자가 여러 곡을 수정하거나 같은 곡을 반복 ON/OFF해도 최종 의도를 JSON patch로 합친다.
- 처리 완료된 사용자 행은 다음 변경 때 새 transient row를 만들지 않고 재사용한다.
- aggregate 할 일이 없으면 lease를 잡기 전에 종료하여 **idle aggregate D1 write 0** 구조.
- 공개 숫자는 기존 10분 canonical aggregate 원칙 유지.
- same-account 표시 숫자 replay 유지.
- 좋아요 sync / sync-error 이벤트에 `uid`를 포함하고 현재 로그인 UID와 일치할 때만 화면 반영.
- 계정 A→B 전환 순간 기존 하트 화면을 비워 A의 늦은 완료 이벤트가 B 화면에 섞이지 않게 함.
- UI/CSS/위치/간격/반응형 변경 없음.

## 3. 기존 Shared D1 076 파생 트리거 최적화
Shared D1의 `explore032_derived_track_update`는 이미 033에서 좋아요 비용 최적화가 적용되어 있어 덮어쓰지 않았다.

교체된 4개 trigger:
- `explore032_derived_track_insert`
- `explore032_derived_track_delete`
- `explore032_derived_profile_update`
- `explore032_derived_profile_feed`

보호:
- `explore032_derived_track_update` 033 정의 유지.
- table/index 기존 구조 변경 없음.
- canonical 사용자 데이터 migration/delete/backfill 없음.
- 기존 저장 파생 데이터 변경 없이 trigger 정의만 교체.

Run `34734208590` — PASS.
- 076 trigger 4개 교체: `rows_written=4`, `rows_read=1160`.
- 075 additive queue/state/index 추가: `rows_written=7`, `rows_read=5`.
- 위 수치는 배포 작업 1회의 수치이며 좋아요 1회당 비용이 아니다.

## 4. 076 publication-state/cost hotfix
목표:
- Music Note의 실제 공개곡이 첫 진입부터 공개 상태로 정확히 보이게 한다.
- 공개/비공개 변경 후 Explore / public profile 결과가 즉시 맞게 이어지게 한다.
- 공개상태 확인 때문에 예전처럼 불필요한 D1 읽기를 반복하는 경로를 줄인다.

클라이언트:
- publication state session validation 추가.
- 서버 검증이 필요한 시점과 이미 검증된 UID 상태를 구분.
- 기존 UI/CSS/레이아웃 변경 없음.

Worker 043:
- patch: `043-publication-targeted-r2-hotpath.mjs`
- marker: `SORIDRAW_PUBLICATION_TARGETED_R2_HOTPATH_043_20260913`
- 공개/비공개/옵션 변경 시 Feed 및 public-profile R2 cache를 전체 재생성하지 않고 해당 곡만 patch/remove/upsert.
- release patch 마지막에 043 적용 확인.
- D1 schema migration 없음.
- 실사용자 원본 데이터 변환/삭제/백필 없음.

## 5. PREVIEW Worker 043 배포 결과
Run `34737493945` — PASS.

- locked product SHA: `9893590b526137a2528dfca8a50da87e20bcc056`
- One-shot preflight PASS.
- canonical PREVIEW Worker deploy PASS.
- Feed smoke PASS.
- public profile smoke PASS.
- like batch route 존재 확인 PASS.
- warm Feed revision **D1 R0 / W0** PASS.
- `HEAD-ONLY-036` PASS.
- aggregate cron `*/10 * * * *` PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- smoke 실패 시 자동 rollback 보호 유지.

## 6. PREVIEW App hotfix 배포 결과
Run `34737501029` — PASS.

- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json`은 **075 유지** PASS.
- TEST / PRODUCTION branch unchanged PASS.
- TEST / PRODUCTION 실제 HTML unchanged PASS.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.

## 7. 사용자 데이터 / 백엔드 변경 여부
이번 076 publication hotfix 배포:
- 사용자 원본 데이터 변경 없음.
- D1 table/index/schema migration 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- TEST / PRODUCTION 코드/Worker 비변경.
- PREVIEW App + PREVIEW Worker만 변경.

## 8. 비용 판정 — 현재 확정 범위
확정:
- warm Feed revision은 실제 Worker 배포 후 D1 `R0/W0` 확인.
- idle scheduled aggregate는 기존 코드/fixture 검증상 W0 구조 유지.
- 사용자별 pending like queue는 한 사용자당 한 행 재사용 구조 유지.
- Feed/public-profile 파생 갱신은 전체 재생성이 아니라 변경분 중심.
- 043 publication R2 mutation도 해당 곡만 대상으로 변경.

아직 **공개/비공개 1회 실사용 조작의 실제 D1 rows_read/rows_written 수치**는 미측정.
실제 PREVIEW 조작 후 계측해서 이전 R14 증상이 사라졌는지 최종 판정한다.

## 9. 기존 정상 기능 — 절대 보호
- 074 Local First 즉시 하트/숫자 UX.
- 좋아요 PREVIEW 1분 묶음 전송.
- canonical 공개 숫자 10분 aggregate.
- `baseLiked` + stable `mutationAt` reversal 의도 보존.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- Music Note / Library 기존 local-first 및 묶음저장.
- UI/CSS/반응형/분할 구조 비변경.
- 공유 사용자 원본 데이터 비파괴.

## 10. 현재 PREVIEW 실사용 검증 / TEST 승격 차단
이번 076 hotfix는 배포 완료됐지만 아래 실사용 확인 전 TEST 승격 금지.

- 기존 공개곡이 Music Note 첫 진입부터 공개 상태로 맞게 표시되는지.
- 공개 → 비공개 전환 후 Explore에서 해당 곡이 사라지는지.
- 공개 → 비공개 전환 후 public profile에서도 해당 곡이 사라지는지.
- 비공개 → 공개 재전환 시 Explore / public profile에 정상 복귀하는지.
- 위 조작의 D1 `rows_read / rows_written` 실제 측정, 특히 기존 R14 반복 여부.
- 기존 075 검증 항목: 3곡 batch, like↔unlike reversal, PC↔mobile same-account, A↔B account switch.

## 11. 다음 작업
1. 사용자가 PREVIEW에서 공개/비공개를 실제로 조작해 화면 결과를 확인한다.
2. 개발 측은 같은 조작의 D1 실제 비용을 확인한다.
3. 이상이 있으면 PREVIEW에서만 수정한다.
4. 모든 항목 PASS 후 TEST 승격 가능 여부를 판단한다.
5. PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 변경하지 않는다.

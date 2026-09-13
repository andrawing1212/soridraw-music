# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-13 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW app-version 표시는 075 유지**
- **현재 PREVIEW Worker에는 077 Local First 비용 hotpath가 배포됨**
- 077 product source commit: `d45e619232ffc30f825c12ffdf94a2b02b7ef151`
- PREVIEW Worker release trigger commit: `6ed87f94bddd14b4a95886c02686780a0ec23658`
- PREVIEW Worker Release Run: `34742021120` — PASS
- PREVIEW Worker active version: `729795f9-98f8-4938-b28d-2590f466e4f2`
- 이전 PREVIEW Worker version: `ec373b78-cf8f-4342-92af-a77eb5727a29`
- PREVIEW App / Firebase Hosting: **077에서는 변경 없음**. 기존 075 앱 그대로 사용.
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged 확인
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged 확인
- TEST Worker version: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged 확인
- PRODUCTION Worker version: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged 확인

## 2. 075 핵심 구조 — 계속 보호
075는 074의 즉시 Local First UX를 유지하면서 개인 Social 상태와 좋아요 대기구조를 비용 중심으로 정리했다.

- 본인 좋아요/취소는 하트와 숫자가 즉시 로컬 반영.
- 개인 Social Snapshot이 `likedTrackIds + followingUids`를 한 번에 보관해 같은 계정의 반복 개인상태 읽기를 줄임.
- 좋아요 대기열은 사용자별 최종 의도를 합치는 구조 유지.
- PREVIEW 좋아요 전송은 1분 묶음, TEST/PRODUCTION 기본값은 별도 승격 전까지 4분 유지.
- 공개 숫자는 기존 10분 canonical aggregate 원칙 유지.
- same-account 표시 숫자 replay 유지.
- 좋아요 sync / sync-error 이벤트에 `uid`를 포함하고 현재 로그인 UID와 일치할 때만 화면 반영.
- UI/CSS/위치/간격/반응형 변경 없음.

## 3. 기존 Shared D1 076 파생 트리거 최적화 — 계속 보호
Shared D1의 `explore032_derived_track_update`는 033의 좋아요 비용 최적화 정의를 유지한다.

076에서 최적화된 trigger:
- `explore032_derived_track_insert`
- `explore032_derived_track_delete`
- `explore032_derived_profile_update`
- `explore032_derived_profile_feed`

보호:
- table/index 기존 구조 변경 없음.
- canonical 사용자 데이터 migration/delete/backfill 없음.
- 077에서도 추가 D1 schema migration 없음.

## 4. 077 목표
이번 077은 사용자가 실제로 관찰한 다음 문제를 비용 구조까지 포함해 해결하는 작업이다.

- 좋아요 2곡 처리에서 불필요하게 발생하던 `R14/W2` 형태의 즉시 D1 재확인 제거.
- PC/모바일처럼 같은 계정의 다른 기기에서 상태가 늦게 맞거나, 오래된 기기가 자기 `baseLiked`만 믿고 사용자의 최종 의도를 버리는 위험 제거.
- 공개/비공개 실제 변경은 성공했는데 파생 R2 갱신 실패 때문에 요청 전체가 HTTP 500이 되는 구조 분리.
- publication-state R2가 비어 있을 때 매번 사용자 곡 전체를 다시 읽는 복구 반복 방지.
- Explore 재접속/변경없음 revision 확인을 D1이 아니라 파생 R2 head/ETag 중심으로 처리.
- UI/CSS/레이아웃은 변경하지 않음.

## 5. Worker 044 — Local First 비용 hotpath
파일:
- `cloudflare/explore-worker/patches/044-local-first-cost-hotpath.mjs`
- marker: `SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913`

좋아요:
- 클릭 묶음 intake 단계에서 `tracks / profile / stats / likes`를 다시 읽어 화면이 이미 알고 있는 상태를 재검증하는 경로 제거.
- 최종 사용자 의도는 `baseLiked`가 같아 보여도 버리지 않고 사용자별 queue에 전달.
- 다른 기기가 canonical 상태를 먼저 바꿨더라도 10분 aggregate에서 실제 canonical `likes`와 비교해 최종 의도로 수렴.
- aggregate는 queue에 들어온 **변경된 ID만** canonical 상태와 비교하며 전체 Feed/Profile을 스캔하지 않음.
- canonical 숫자/관계가 실제로 바뀐 곡만 Feed/Profile R2의 해당 곡을 targeted patch.
- 개인 좋아요 R2가 cold/missing이면 한 번 복구 후 다시 읽어 현재 클릭 의도를 반영하고 저장.

공개/비공개:
- canonical 공개/비공개 변경과 파생 R2 갱신 실패를 분리.
- 파생 R2 patch 실패가 실제 사용자 변경을 HTTP 500으로 되돌리지 않도록 보호.
- publication-state R2 patch가 실패하면 해당 사용자 파생 publication-state key만 제거해 다음 읽기에서 **한 번의 bounded recovery**가 일어나도록 함.
- 사용자 원본 곡/계정 데이터 삭제가 아니라 파생 캐시 복구 표시만 수행.
- 043의 targeted R2 hotpath를 먼저 적용한 뒤 044를 고정 canonical Worker에 합침.

## 6. Explore revision 077
`canonical/preview-entry.js`는 Feed 변경 여부 확인을 파생 R2 object head/ETag 중심으로 처리한다.

- 정상 warm revision 확인에서 D1 `R0/W0` 목표.
- 변경 없음이면 Feed 전체를 다시 읽지 않는 구조.
- 기존 release smoke 호환을 위해 진단 mode 표시는 `HEAD-ONLY-036` 유지.

## 7. 077 사전 검증 결과
최종 preparation Run `34741963353` — PASS.

- 043 → 044 순서로 실제 canonical Worker 조립 PASS.
- `node --check` Worker/entry PASS.
- 좋아요 비용 검증 PASS.
- 100명 같은 곡 좋아요 fixture: count/derived update 1회로 묶임 PASS.
- net-zero cohort: count/derived write 0 PASS.
- stale-device 최종 의도 보존 PASS.
- cold 개인 like R2 복구 후 현재 의도 반영 PASS.
- publication R2 실패 시 bounded recovery 보호 PASS.
- derived cache regression suite PASS.
- deploy preflight suite PASS.
- TypeScript `npx tsc --noEmit` PASS.
- `npm run build` PASS.
- 사용자 원본 데이터 migration/rewrite/delete 없음.
- 임시 077 진단/조립 workflow 4개 모두 제거 확인.

## 8. PREVIEW Worker 077 실제 배포 결과
Run `34742021120` — PASS.

- locked product SHA: `d45e619232ffc30f825c12ffdf94a2b02b7ef151`
- canonical Worker SHA256: `9998d63d0bfff7090dea5888cc6fdf08017e6c3dd9f441789128ab451bc5b1fb`
- live 035 D1 prerequisite schema PASS.
- live 035 processor state PASS, 배포 직전 pending `0`.
- dry-run PASS.
- PREVIEW Worker deploy PASS.
- PREVIEW Worker version: `ec373b78-cf8f-4342-92af-a77eb5727a29` → `729795f9-98f8-4938-b28d-2590f466e4f2`.
- Feed smoke PASS.
- public profile smoke PASS.
- like batch route 존재 확인: unauthenticated `HTTP 401` — 정상 보호 응답, 404/5xx 아님.
- warm Feed revision 실제 측정: **D1 R0 / W0** PASS.
- revision mode `HEAD-ONLY-036` PASS.
- aggregate cron `*/10 * * * *` PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- smoke 실패 시 자동 rollback 보호는 그대로 유지.

## 9. Firebase / 사용자 데이터 변경 여부
077에서는 Worker와 Worker 고정 소스만 변경했다.

- Firebase PREVIEW Hosting 재배포 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- Shared D1 schema migration 없음.
- canonical 사용자 데이터 대량변환/삭제/백필 없음.
- TEST / PRODUCTION 코드 및 Worker 변경 없음.
- UI/CSS/반응형 변경 없음.

## 10. 비용 판정 — 현재 확정 범위
확정:
- 변경 없는 warm Feed revision: 실제 배포 Worker에서 **D1 R0/W0**.
- 좋아요 HTTP intake는 코드/fixture 검증상 per-track canonical D1 재확인 경로 제거.
- 실제 canonical 비교는 10분 aggregate에서 queue의 변경 ID에 한정.
- 같은 곡 다수 사용자의 변경은 set 기반 집계로 묶여 파생 숫자 update 증폭 억제.
- publication 파생 R2 갱신은 전체 재생성이 아니라 targeted patch/remove/upsert 유지.
- 파생 publication-state cache가 깨지면 해당 사용자 cache만 bounded recovery.

아직 실사용 계정으로 실제 클릭한 뒤의 인증된 D1 `rows_read / rows_written` 숫자는 미측정이다. 배포 smoke는 인증 없이 실제 사용자 데이터를 변경하지 않는 안전 검증만 수행했다.

## 11. 기존 정상 기능 — 절대 보호
- 074 Local First 즉시 하트/숫자 UX.
- 좋아요 PREVIEW 1분 묶음 전송.
- canonical 공개 숫자 10분 aggregate.
- 같은 계정 PC↔모바일 최종 상태 수렴.
- 계정별 이벤트/캐시 분리.
- 정상 캐시 변경 없음 시 서버 read 0 목표.
- Music Note / Library 기존 local-first 및 묶음저장.
- UI/CSS/반응형/분할 구조 비변경.
- 공유 사용자 원본 데이터 비파괴.

## 12. 현재 PREVIEW 실사용 검증 / TEST 승격 차단
077 코드/배포 검증은 완료됐지만 아래 **실사용 계정 확인 전 TEST 승격 금지**.

- PC에서 좋아요 → 모바일에서 같은 계정 하트가 정상 수렴하는지.
- 모바일에서 좋아요/취소 → PC에서도 최종 의도가 뒤집히지 않는지.
- 좋아요 2~3곡 묶음 후 실제 D1 `rows_read / rows_written`이 기존 R14 패턴에서 사라졌는지.
- 공개 → 비공개 전환이 HTTP 500 없이 성공하고 Explore/public profile에서 빠지는지.
- 비공개 → 공개 재전환이 정상 복귀하는지.
- 위 공개/비공개 실제 D1 비용 확인.
- like↔unlike reversal과 A↔B 계정 전환 회귀 확인.

## 13. 다음 작업
1. 사용자가 `preview.soridraw.com`에서 같은 계정 PC/모바일 좋아요와 공개/비공개를 실제 조작한다.
2. 개발 측은 그 실제 조작의 D1 비용을 확인한다.
3. 이상이 있으면 PREVIEW에서만 수정한다.
4. 모든 실사용 항목 PASS 후 TEST 승격 가능 여부를 판단한다.
5. PRODUCTION은 사용자의 명확한 정식배포 승인 없이는 변경하지 않는다.

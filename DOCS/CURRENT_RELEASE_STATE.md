# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 074**
- 074 실제 코드 commit: `835dd2cb0b5c206696a7e94dc18e9041155cbe23`
- PREVIEW 074 release trigger/locked build commit: `1d5ecf841ae8335d21b992d3e7f4c160add75839`
- 074 targeted Apply Run: `34639807460` — PASS
- PREVIEW 074 App Run: `34639940311` — PASS
- visible-track read-only diagnostic Run: `34638806229` — PASS
- PREVIEW Worker는 검증된 069 서버 런타임 그대로 유지
- PREVIEW active Worker Version ID: `caffa9f8-5b50-4a4a-a2db-578c0fe49b83`
- Shared D1 069 additive schema Run: `34630980764` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 2. 서버 좋아요 구조 — 정상 / 유지
- PREVIEW 좋아요 outbox는 1분 batch.
- Worker `*/10 * * * *` scheduled aggregate가 canonical 공개 숫자를 확정.
- 069 queue `explore_like_batches_069`는 queue write `W1/batch` 목표.
- `baseLiked` + 안정적인 `mutationAt`으로 aggregate 전 like↔unlike 역전 의도 보존.

확정 PASS:
- 1곡 batch: Worker 1 / D1 R1 W1 / queue row W1.
- PC 즉시 하트 ON.
- 약 1분 뒤 모바일 same-account 하트 ON.
- 모바일 정상 캐시 Explore Worker 0 / D1 0.
- queue 035/066/069 정상 소비.
- scheduled aggregate 정상.
- 테스트한 두 곡 모두 canonical=1 / derived=1 / relation=1 / fresh Feed `stats.likeCount=1`.

## 3. 070~073 실사용 결과
- 070 자동 화면 반영: FAIL.
- 071 persistent forced refresh: FAIL.
- 072 fresh Feed recovery: 한 곡은 회복했지만 다른 곡은 0 유지 — FAIL.
- 073 cached + cache-empty forced fresh recovery: 서버와 fresh Feed는 이미 1인데 사용자가 화면 0 유지 확인 — FAIL.

판정:
- 더 이상 서버 집계나 D1 문제가 아님.
- fresh Feed도 1이므로 사용자 체감 문제는 client 표시 경로에 한정.
- 반복적으로 Feed를 다시 읽어 고치기보다, 사용자가 제안한 UX대로 본인 좋아요 숫자는 Local First로 즉시 반응시키는 편이 더 자연스럽고 비용도 낮음.

## 4. 074 수정 — 본인에게 숫자 즉시 반영
074 코드 commit `835dd2cb0b5c206696a7e94dc18e9041155cbe23`.

변경:
- 본인이 좋아요를 누르면 하트와 함께 화면 숫자도 즉시 `+1`.
- 좋아요 취소 시 화면 숫자 즉시 `-1`.
- 이 숫자는 **로컬 표시값**이며 서버 canonical 집계 구조는 기존 10분 aggregate 그대로 유지.
- 클릭 즉시 Feed local cache와 공개프로필 first-view cache에도 같은 표시값을 반영해 페이지 이동/재진입에서 되돌아가지 않게 함.
- 1분 batch 후 same-account signal에 선택적 `displayLikeCount`를 추가해 다른 기기에도 로컬 표시 숫자를 전달 가능.
- legacy signal에는 `displayLikeCount`가 없으므로 기존 신호는 하트만 반영하고 숫자를 덮어쓰지 않음.
- 이미 `내 하트=ON / 숫자=0`인 stale 곡은 서버를 다시 읽지 않고 **최소 1**로 로컬 회복. 사용자가 좋아요한 곡 총합은 최소 1이라는 UX 불변식 사용.
- 기존 aggregate 후 fresh refresh는 유지되어 canonical 서버 숫자로 최종 수렴.
- polling 없음.
- UI/CSS/위치/간격/반응형 변경 없음.

비용:
- 즉시 숫자 변경 자체는 서버 read/write 0.
- 기존 1분 batch / 10분 aggregate 구조 유지.
- same-account Firestore signal은 기존 경로 재사용, 별도 listener 추가 없음.
- stale `하트 ON / 0` 복구도 로컬 처리라 추가 Worker/D1 read 0.

## 5. 074 자동 검증 / 배포
Apply Run `34639807460` — PASS:
- targeted apply PASS.
- 074 static contract PASS.
- 기존 069 W1/reversal contract 보존.
- TypeScript PASS.
- Build PASS.
- change boundary PASS.
- 변경 파일: `src/pages/ExplorePage.tsx`, `src/services/exploreLikeService.ts`, `public/app-version.json`.
- Worker/D1/Functions/Rules/UI CSS 변경 없음.

PREVIEW App Run `34639940311` — PASS:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=074` PASS.
- TEST / PRODUCTION branch 및 실제 HTML unchanged PASS.

## 6. 데이터 / 인프라 상태
- Shared 사용자 원본 데이터 삭제/백필/덮어쓰기 없음.
- D1 schema 변경 없음.
- PREVIEW Worker 재배포 없음.
- Firebase Functions / Firestore Rules 변경 없음.
- PREVIEW Hosting만 074로 갱신.
- TEST / PRODUCTION 승격 없음.

## 7. 현재 판정
- 서버 batch / W1 / aggregate / canonical / derived / fresh Feed: **PASS**.
- PC→모바일 하트 sync: **PASS**.
- 모바일 정상 캐시 Worker/D1 0: **PASS**.
- 073 화면 숫자 복구: **FAIL 실사용 확인**.
- 074 즉시 로컬 숫자 UX: **코드/TS/Build/PREVIEW 배포 PASS, 사용자 화면 확인 전**.
- 3곡 1분 batch W1 실사용: 미검증.
- reversal 양방향 실제 최종 수렴: 미검증.
- TEST 승격: 금지.

## 8. 다음 작업
사용자는 복잡한 서버 테스트를 할 필요 없음.

074 최소 확인:
1. PREVIEW를 074로 업데이트.
2. 기존 `[Breakbeat] '혼자만의 밤'`은 하트가 켜져 있으므로 숫자가 바로 `1`로 보이는지 확인.
3. 좋아요 0인 새 곡 1개를 눌렀을 때 하트와 숫자가 동시에 `0 → 1` 되는지 확인.
4. 다시 취소하면 동시에 `1 → 0` 되는지 확인.

통과 후 개발 측에서 3곡 W1 비용과 reversal 실제 수렴을 검증하고 TEST 승격 가능 여부를 판단한다.

## 9. 2026-09-12 synthetic 044 Probe 잔여계정 정리
관리자 사용자 목록에 남아 있던 `SORIDRAW 044 preview Probe` 3건을 실제 공유 데이터 기준으로 점검하고 정리함.

확인 결과:
- 정확히 3건의 Firestore `users/{uid}` 문서만 존재.
- 이메일은 모두 `soridraw044-preview-...@example.invalid`, displayName은 `SORIDRAW 044 preview Probe`.
- Firebase Auth 계정은 3건 모두 이미 없음.
- role `free`, 생성곡 0, 즐겨찾기 0.
- Music Note / playlist / settings / Suno track / list cache / share / permission audit 연결 데이터 없음.
- Shared D1 UID 계열 38개 컬럼 경로 점검 결과 참조 0건.
- D1 read-only audit Run `34670829830` — PASS.

정리:
- Cleanup Run `34670885055` — PASS.
- 위 조건을 재확인한 뒤 **해당 3개의 synthetic Firestore 사용자 문서만 삭제**.
- 삭제 후 동일 UID 문서 0건, Auth 0건, 동일 Probe marker 잔여 0건 재확인 PASS.
- `REAL_USER_DATA_CHANGED=0`, `D1_ROWS_DELETED=0`.
- 실제 사용자 곡/좋아요/공개곡/프로필/플레이리스트 데이터 변경 없음.
- Hosting / Worker / Functions / Rules 배포 없음.
- PREVIEW 실제 앱은 계속 074, Worker 069 유지. TEST / PRODUCTION 변경 없음.
- 점검/정리용 임시 GitHub Actions workflow는 작업 완료 후 제거함.

# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **085** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **052** / `7cf6d7ce-b363-4cb2-b06a-58ae98d1770d`
- 085 Worker Run `34806641814` — PASS
- 085 App Run `34806688392` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- 086 수정 제품 commit: `a27b5ddbe0c6928ac210987e72a46bd553b80e8d`
- 086 준비 Run `34811241648` — PASS
- GitHub app-version: **086 준비본**
- **086은 아직 PREVIEW에 배포하지 않음.**

## 2. 084 공개/비공개 비용 — PASS 후보 유지
사용자 PREVIEW 실측:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`
- 10개 상태변경 누적 `D1 rows R30/W20`
- 최종 4곡 비공개 PAGE SYNC `D1 R12/W8`, Firestore `R0/W0`

보호:
- 081 page-exit final-state batch
- 082 missing-R2 self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 3. 085 좋아요 곡 실사용 결과 — FAIL
사용자가 085 PREVIEW 배포 후 영상으로 확인.

실제 증상:
- 내 공개 프로필의 `[공개곡] [좋아요 곡]` UI는 표시됨.
- `좋아요 곡` 진입 시 **`좋아요 곡을 불러오지 못했습니다.`** 표시.
- 진단에서 `POST /v1/me/liked-tracks`가 **HTTP 500**.
- 해당 실패 요청은 `D1 R0/W0`으로, 쿼리 실행 전 실패한 형태.
- 동시에 사용자는 업데이트 전에는 PC↔모바일 좋아요 하트가 수렴했지만, 기기 상태가 달랐던 시점의 변경이 업데이트 과정에서 일부 누락된 듯한 현상을 보고.

확정 원인 1 — Worker 052 liked-track SQL:
- 052가 `tracks` 테이블에서 `t.owner_nickname`, `t.owner_avatar_url`을 직접 조회.
- 실제 기존 구조는 owner 표시정보를 `profiles`에서 가져오는 구조.
- 따라서 새 liked-track endpoint가 잘못된 컬럼 참조로 500을 낼 수 있는 코드였음.

확정 원인 2 — missed account signal 복구:
- PC/모바일이 한 번 이상 좋아요 batch 신호를 놓친 경우 기존 코드는 개인 liked-state cache만 비움.
- 하지만 `explore-social-snapshot-075` 캐시는 그대로 남아, 재진입 시 오래된 liked ID가 다시 개인 상태를 채울 수 있었음.
- 이 경로가 사용자 표현의 "중간에 씹힌 느낌"과 일치.

판정:
- **085 좋아요 곡/기기간 좋아요 정확성 FAIL.**
- TEST 승격 금지.

## 4. 086 수정 — 코드 완료 / 미배포
086 목표는 새 기능 확대가 아니라 085 회귀 복구만 한다.

### Worker 053
- patch: `053-liked-track-schema-repair.mjs`
- 잘못된 `t.owner_nickname / t.owner_avatar_url` 제거.
- `LEFT JOIN profiles p ON p.uid = t.owner_uid`로 기존 공개곡 구조와 동일하게 owner 표시정보 조회.
- `/v1/me/liked-tracks`는 사용자별 R2 liked bundle을 기준으로 canonical liked ID를 반환.
- 빈 검증 요청은 **R2 liked ID만 확인하고 D1 track detail read 0** 경로.
- 실제 카드 상세가 없는 곡만 기존처럼 최대 200개 PK-bounded 조회.
- owner-wide scan 없음.
- D1 schema/migration/table/index/trigger 변경 없음.

### 앱 086
`src/services/exploreLikedTracksService.ts`:
- 기존 085 카드 상세 local cache는 버리지 않음.
- `canonicalLikedTrackIds`를 같은 persistent cache에 추가. schema version 강제 증가/전체 캐시 폐기 없음.
- 이 기기에서 `좋아요 곡`을 **처음 명시적으로 열 때만** canonical R2 liked ID를 한 번 확인.
- 085에서 이미 저장된 카드 상세가 있으면 재사용하므로 불필요한 D1 재조회 방지.
- 이후 정상 warm 탭 재진입은 local-only / 서버 요청 0 목표.
- 새 좋아요/해제는 canonical liked membership local cache도 즉시 patch.

`src/services/exploreLikeService.ts`:
- missed PC↔모바일 account signal 감지 시 liked-state cache뿐 아니라 stale personal social snapshot + liked collection canonical membership도 함께 invalidate.
- 그 다음 현재 보이는 곡만 targeted rehydrate.
- 일반 앱 업데이트만으로 캐시 전체 초기화하지 않음.
- 정상 signal은 해당 track membership만 변경.

## 5. 086 자동검증
PREVIEW 준비 Run `34811241648` — **PASS**.
- TypeScript PASS
- Build PASS
- Explore like 비용 회귀검사 PASS
- Explore derived-cache 회귀검사 PASS
- 082 publication PASS
- 083 PK-read PASS
- 084 publication write-returning PASS
- 085 liked-profile 기능 보호 PASS
- **086 liked-sync repair PASS**
- deploy preflight PASS
- 실제 D1 실행/migration/deploy 없음

086 최종 제품 commit:
- `a27b5ddbe0c6928ac210987e72a46bd553b80e8d`
- canonical Worker SHA256: `bd9ff9afda7fa4e6193ff3f0e4c1e295ef56124ad6ab28eab328dee086489037`

임시 086 workflow/trigger는 준비 완료 후 삭제함.

## 6. 비용/데이터 안전
086:
- 사용자 데이터 삭제/백필/복제/덮어쓰기 없음
- D1 schema 변경 없음
- Firestore schema/rules 변경 없음
- Functions 변경 없음
- UI/CSS/레이아웃 추가 변경 없음
- 앱 업데이트 자체를 이유로 전체 like/social cache 무효화하지 않음
- liked tab 첫 명시 진입의 canonical 확인은 R2 기준이며 빈 확인 요청에서 D1 0 목표
- warm liked tab은 local-only 0 request 목표

## 7. 다음 순서
1. **사용자 승인 시 086을 PREVIEW에만 배포.**
2. Worker 053 → 앱 086 순서로 배포.
3. 실제 `preview.soridraw.com`에서 `좋아요 곡` HTTP 500 제거 확인.
4. 첫 liked tab 진입: canonical ID 확인 + 누락 카드만 D1 조회되는지 측정.
5. 두 번째 liked tab 진입: D1/Firestore 0, 가능하면 네트워크 0 확인.
6. PC↔모바일에서 한쪽 좋아요/해제 → page exit → 반대 기기 하트와 `좋아요 곡`이 같은 상태로 수렴하는지 확인.
7. 좋아요 1/2/4곡 batch 비용 및 Firestore account sync signal batch당 1회 확인.
8. 086 통과 후에만 공개곡 카드 `... → 다음곡에도 적용 / 공유노트 저장` 작업으로 이동.

## 8. 승격 상태
- PREVIEW 실제: **085 FAIL 상태**
- 086: **코드 수정 완료 / 자동검증 PASS / 배포 전 / 실사용 검증 전**
- TEST 승격: 금지
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지

## 9. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 081 page-exit final-state batching
- 082 missing-R2 canonical self-heal + revision-first
- 084 publication cost 구조
- Explore Feed/public profile R2 cache
- 좋아요 delayed canonical aggregate + account sync signal
- 공유 사용자 원본 데이터

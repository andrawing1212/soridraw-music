# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 GitHub PREVIEW 코드: **085 준비 완료 / 미배포**
- 085 핵심 제품 commit: `048190e1b5aa0d4f35a5f0dd04a1298fe5060617`
- 085 준비 Run: `34805096095` — PASS
- 085 임시 workflow/trigger: 준비 완료 후 삭제
- 실제 `preview.soridraw.com` 앱 버전: **082** — 085 아직 미배포
- 실제 PREVIEW Worker: **051** / `353327be-ac54-4c09-ad9c-b036f763f44e` — 052 아직 미배포
- 기존 PREVIEW Worker Run `34800196216` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 084 공개/비공개 비용 — 실사용 PASS 후보
사용자 PREVIEW 실측:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`
- 10개 상태변경 누적 `D1 rows R30/W20`
- 최종 4곡 비공개 PAGE SYNC `D1 R12/W8`, Firestore `R0/W0`

판정:
- 정상 warm mutation의 명시적 D1 SELECT 0.
- 공개/비공개 모두 곡당 `R3/W2`로 선형 고정.
- 082의 3곡 `R36/R30` owner-scan/fan-out 폭증 제거 완료.
- 곡당 W2는 canonical track 변경 + shared revision 보호 trigger 계약이므로 무리하게 제거하지 않는다.

보호할 구조:
- 081 page-exit final-state batch
- 082 missing-R2 self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 3. 현재 좋아요 비용 / 정확성 상태
사용자 진단에서 좋아요 2곡 page-sync 결과:
- D1 `R8/W2` → 현재 관측상 곡당 약 `R4/W1`
- Firestore `R1/W1`, `users:write 1`

Firestore W1은 현재 코드상 `users/{uid}.exploreLikeSyncSignal` 한 번으로, 같은 계정 PC↔모바일에 좋아요 최종 상태/표시를 전달하기 위한 **batch 단위 동기화 신호**다. 새 liked-list 데이터 저장용 write가 아니다.

기존 개인 좋아요 원본:
- 개인 liked ID는 기존 `explore-social-snapshot-075`의 `likedTrackIds`를 재사용.
- Worker는 사용자별 R2 like bundle `internal/explore/likes-v1/{uid}.json`을 이미 유지.
- 새 Firestore 좋아요 목록/곡 복제 금지.

남은 좋아요 검증:
- 1/2/4곡 batch 비용 선형성
- PC↔모바일에서 숫자뿐 아니라 **내가 누른 하트 상태**가 정확히 수렴하는지
- Firestore sync signal이 batch당 1회만 발생하는지

## 4. 085 — 내 공개 프로필 `공개곡 / 좋아요 곡` 1단계
사용자 확정 UI:
- 내 공개 프로필의 프로필 정보와 곡 목록 사이에 `[공개곡] [좋아요 곡]` 전환 버튼.
- 내 프로필에서만 `좋아요 곡` 표시.
- 다른 사용자 프로필은 기존 공개곡만 유지.
- 기존 Explore 카드 디자인/탭 스타일을 재사용하고 새 CSS는 추가하지 않음.

구현:
- `src/pages/ExplorePage.tsx`
  - 내 프로필에서 공개곡/좋아요 곡 전환.
  - 좋아요 곡 loading/error/empty/grid 처리.
  - 좋아요/해제 시 현재 기기의 liked detail cache와 화면을 즉시 반영.
- `src/services/exploreLikedTracksService.ts`
  - 기존 personal social snapshot의 liked ID를 기준으로 사용.
  - liked 곡 카드 상세는 기기에 persistent cache.
  - warm 재진입/탭 재전환에서 전체 상세가 있으면 서버 요청 0 목표.
  - 처음 필요한 곡/새 기기에서 **없는 곡 상세만** 최대 200개씩 요청.
  - Firestore read/write 추가 없음.
- Worker patch `052-liked-track-collection.mjs`
  - 인증된 `POST /v1/me/liked-tracks` 추가 준비.
  - viewer의 R2 liked ID와 교집합인 요청만 허용.
  - 공개+published 곡만 반환.
  - 요청된 ID를 PK로 bounded lookup하며 owner-wide scan 없음.
  - D1 schema/migration/table/index/trigger 변경 없음.
- `scripts/verify-085-liked-profile.mjs`
  - own-profile guard, local cache, Firestore 미사용, bounded Worker lookup을 고정 검증.

085 준비 Run `34805096095`:
- TypeScript PASS
- Build PASS
- 085 verifier PASS
- 기존 Explore like 비용 회귀검사 PASS
- 084 publication 회귀검사 PASS
- product commit `048190e1b5aa0d4f35a5f0dd04a1298fe5060617`
- 제품 commit 자체 변경: 4 files, +151/-4
- 준비 중 첫 Run은 새 052 patch가 기존 release-order 검사의 마지막 위치 가정을 깨서 실패했으나, 052를 042 social snapshot 직후로 올바르게 배치해 재실행 PASS. 제품 로직 실패가 아니었음.

## 5. 085 비용 설계
목표:
- `좋아요 곡` 탭을 누를 때마다 전체 서버조회 금지.
- 기기에 social snapshot + liked track detail cache가 정상이라면 **재진입 D1 0 / Firestore 0**.
- 좋아요 변경은 기존 like outbox/page-exit 경로를 그대로 사용.
- 좋아요 탭 때문에 추가 write 없음.
- 새 기기/캐시 누락 시에만 liked ID 중 없는 카드 상세를 bounded PK query로 1회 복구 후 local cache.

주의:
- 실제 PREVIEW Worker 052/앱 085는 아직 배포하지 않았으므로 위 비용은 코드 검증 완료·실사용 검증 전.
- 새 endpoint 첫 복구의 실제 D1 rows_read는 PREVIEW 배포 후 계측해야 함.
- 기존 R2 liked bundle은 최대 2000 ID 제한을 가진 기존 계약이며 085에서 임의 확대하지 않음.

## 6. 다음 확정 기능 — 아직 미구현
사용자가 공개곡 카드에 `...` 버튼 추가를 요청했다.
메뉴 예정:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 현재 My Note의 **폴더 저장 팝업 디자인을 그대로 재사용**하고 이름/문구만 공유노트용으로 변경하는 방향으로 확정.
사용자 요청대로 하나씩 진행하므로 085 좋아요 곡 1단계 안정화 전에는 이 기능을 섞어 구현하지 않는다.

## 7. Firebase / Functions / 사용자 데이터
085 코드 준비:
- Firebase Hosting: 변경/배포 없음
- Functions: 변경 없음
- Firestore Rules/schema: 변경 없음
- D1 schema/migration: 변경 없음
- 사용자 데이터 대량삭제/백필/복제/덮어쓰기: 없음
- 새 Firestore 좋아요 데이터 구조: 없음
- CSS 신규 변경: 없음
- TEST/PRODUCTION: 변경 없음

## 8. 다음 순서
1. 085 permanent PREVIEW Worker release gate에 085 verifier를 포함시킨 뒤, 사용자 배포 지시가 있을 때 앱 085 + Worker 052를 PREVIEW에만 배포.
2. 내 프로필 `공개곡 / 좋아요 곡` PC/모바일 실사용 확인.
3. 좋아요 곡 첫 진입 비용과 두 번째 warm 진입 `R0/W0` 확인.
4. 좋아요 1/2/4곡 batch 및 PC↔모바일 liked 하트 수렴 확인.
5. 085 통과 후 공개곡 `...` 메뉴 작업으로 이동.
6. 이후 Music Note/Library warm 비용, `user_structures` 불필요 write 의심 계속 검증.

## 9. 승격 상태
- PREVIEW 085: **코드 반영 완료·배포 전·실사용 검증 전**
- TEST 승격: 금지
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- 승격 시 사용자 원본 데이터 복제/덮어쓰기 금지

## 10. 정상 기능 보호
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

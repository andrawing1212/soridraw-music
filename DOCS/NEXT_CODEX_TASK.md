# NEXT CODEX TASK

상태: **085 내 공개 프로필 `공개곡 / 좋아요 곡` 코드 준비 완료 / PREVIEW 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 085 핵심 제품 commit: `048190e1b5aa0d4f35a5f0dd04a1298fe5060617`
- 085 준비 Run `34805096095` — PASS
- GitHub app-version: **085 준비본**
- 실제 `preview.soridraw.com`: **082** — 085 미배포
- 실제 PREVIEW Worker: **051** / `353327be-ac54-4c09-ad9c-b036f763f44e`
- Worker 052 canonical code: 준비 완료·미배포
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 084 보호 기준
- 공개/비공개 실측: 곡당 `D1 R3/W2`
- 1곡 `R3/W2`, 4곡 `R12/W8`
- warm mutation 명시적 D1 SELECT 0
- page-exit final-state batch 유지
- Firestore publication `R0/W0`
- owner scan/fan-out 재도입 금지

## 현재 좋아요 관측
사용자 진단의 2곡 batch:
- D1 `R8/W2` → 약 곡당 `R4/W1`
- Firestore `R1/W1`

Firestore W1은 `users/{uid}.exploreLikeSyncSignal` batch 신호로 PC↔모바일 같은 계정 수렴에 사용됨. 새 liked 목록 저장이 아니다.

## 085 구현 완료 범위
내 공개 프로필에서만:
- `[공개곡] [좋아요 곡]` 전환 버튼
- 다른 사용자 공개 프로필은 기존 공개곡만
- 새 CSS 없이 기존 Explore tab/card UI 재사용
- 좋아요 곡 loading/error/empty/grid

데이터:
- 기존 personal social snapshot `likedTrackIds` 재사용
- liked track 카드 상세 persistent local cache
- 좋아요/해제 시 현재 기기 detail cache 즉시 patch
- warm 상세 cache가 완전하면 좋아요 탭 서버 요청 0 목표
- 새 기기/누락 detail만 최대 200 ID bounded 요청
- Worker 052 `POST /v1/me/liked-tracks`
- viewer R2 liked IDs로 권한 확인
- 공개+published track만 반환
- requested ID PK lookup, owner-wide scan 없음
- Firestore read/write 추가 없음
- D1 schema/migration 없음

자동검증:
- TypeScript PASS
- Build PASS
- `verify-085-liked-profile` PASS
- 기존 Explore like cost regression PASS
- 084 publication regression PASS

## 다음 작업 — 배포 승인 전에는 배포하지 않음
사용자가 PREVIEW 배포를 요청하면:
1. permanent PREVIEW Worker release workflow에 085 verifier 추가.
2. 085 제품 source 고정.
3. TypeScript / Build / 085 + 기존 비용 회귀검사.
4. Worker 052 PREVIEW 배포 + 기존 Feed/Profile/warm R0 smoke.
5. App 085 PREVIEW Hosting 배포.
6. `preview.soridraw.com` exact build/version 확인.
7. TEST/PRODUCTION unchanged 확인.

실사용 검증:
- 내 프로필에 `공개곡 / 좋아요 곡` 위치/모양 확인 PC/모바일
- 좋아요 곡이 실제 liked 관계와 일치하는지
- 첫 진입 missing-detail 비용 계측
- 같은 기기 두 번째 진입 `D1 R0/W0`, Firestore `R0/W0`
- 좋아요 해제 시 목록에서 즉시 제거
- 다른 기기에서 좋아요 후 account signal 수신 시 liked 상태/목록 수렴
- 다른 사용자 프로필에는 `좋아요 곡` 비노출

## 그 다음 기능 — 아직 시작 금지
085 검증 후 공개곡 카드 `...` 메뉴:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note의 기존 폴더 저장 팝업 디자인을 그대로 재사용하고 이름/문구만 변경한다. 사용자 요청대로 하나씩 진행한다.

## 비용/안전 합격선
- unchanged warm tab/page revisit server R/W 0 우선
- 좋아요 변경분만 처리
- 전체 liked 목록 D1 반복 scan 금지
- user Firestore에 liked ID 배열 저장 금지
- 페이지 이동/탭 전환 때문에 write 발생 금지
- UI 비요청 변경 금지
- 사용자 데이터 migration/backfill/delete 금지

TEST: **085 PREVIEW 실사용 비용·정확성 검증 완료 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.

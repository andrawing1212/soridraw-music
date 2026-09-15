# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **090** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 090 제품 commit: `91c61627822b822457ed10eaf9001da5242d5e62`
- 090 배포 고정 commit: `ae293be3fda450da8ff46186078224544a9f8d05`
- 090 최종 검증 Run: `34918483653` — **PASS**
- 090 App Run: `34918600650` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 089 실사용 판정 — FAIL
사용자 영상 2개에서 089 잔여 오류 확인:
- `좋아요 곡` 탭에서 빨간 하트인데 공개 좋아요 숫자가 `0`인 카드가 존재.
- 좋아요/좋아요 해제 시 하트와 숫자가 함께 움직이지 않음. 예: 하트는 회색으로 바뀌었는데 숫자 `1`이 남음.
- 비동기 liked-state hydration 또는 다른 기기의 account sync signal이 현재 기기의 더 최신 local pending 하트보다 늦게 도착할 경우 색 상태를 덮을 수 있는 경로도 코드에서 확인.

원인:
- 089가 기기별 숫자 과대계산을 막기 위해 로컬 숫자 즉시 변경을 완전히 제거함.
- `좋아요 곡`의 persistent card cache에 저장된 오래된 `likeCount: 0`이 그대로 표시될 수 있었음.
- account sync signal과 hydration 완료값이 현재 기기의 더 최신 pending 클릭을 항상 우선하지 않았음.

089는 자동검사 PASS였지만 사용자 실사용 기준 FAIL로 기록한다. TEST 승격 금지 유지.

## 3. 090 수정
### 하트 + 숫자 즉시 일치
- 실제 현재 기기의 pending 전환 1건에만 숫자 `+1/-1` 임시 표시 허용.
- 계산은 고정 baseline 기준 `baselineLikeCount + desired - baselineLiked`로 처리해 빠른 좋아요→해제에서 숫자가 누적되지 않고 원래 값으로 돌아오게 함.
- 클릭마다 서버 요청하는 구조는 추가하지 않음. 기존 5초 batch + page-exit fallback 유지.

### `좋아요 곡` 숫자 0 방지
- 현재 계정이 실제 좋아요 membership을 가진 카드는 총 좋아요가 논리상 0일 수 없으므로 로컬 표시에서 안전한 최소값 `0 → 1` 적용.
- Feed / 공개프로필 / 좋아요곡 로컬 카드 소스에 동일 원칙 적용.
- 새 서버 read 없이 로컬 상태만 보정.

### 색 상태 덮어쓰기 방지
- account sync signal 도착 시 이 기기에 더 최신 pending outbox가 있으면 pending 하트가 우선.
- like hydration 중 사용자가 클릭했으면 오래된 hydration 결과를 화면에 적용하지 않고 현재 cache/outbox 기준으로 다시 계산.
- PC↔모바일 canonical 수렴 경로 자체는 유지.

### 같은 세션 카드 일치
- 좋아요 클릭 시 업데이트된 `likeCount`를 가진 카드로 liked-card cache 및 `좋아요 곡` 목록을 즉시 갱신.
- 해제 시 목록과 하트/숫자가 같은 상태로 이동하도록 통일.

## 4. 090 비용/안전
변경 없음:
- Worker 053 유지
- Functions 변경 없음
- D1 schema/migration 변경 없음
- 사용자 원본 데이터 변경/백필/삭제/복제/덮어쓰기 없음
- UI/CSS/위치/간격 변경 없음
- user Firestore liked ID 배열 저장 없음
- 전체 Feed/profile scan 없음

비용 구조:
- 좋아요 클릭 자체는 local-first.
- 실제 변경은 기존 **5초 batch**.
- 현재 pending 1건의 화면 숫자만 로컬 임시 반영하며 서버 R/W를 추가하지 않음.
- warm liked tab/page revisit 원본 server R/W 0 목표 유지.

## 5. 090 자동검증
최종 Run `34918483653` — **PASS**:
- TypeScript PASS
- Build PASS
- 085 liked-profile PASS
- 086 liked-sync repair PASS
- 087 liked-card consistency PASS — liked card 0 금지
- 088 same-session heart PASS
- 089/090 cross-device batching PASS
- 090 live heart/count PASS
- Explore like cost optimization PASS
- 100 same-track likes → count/derived update 1회 PASS
- net-zero cohort → aggregate/derived write 0 PASS
- 081/089 5초 batch + page-exit fallback PASS
- 084 publication regression PASS

중간 실패 Run들은 제품 실패가 아니며 product commit 전에 차단됨:
- `34918135113`: 089용 옛 verifier 정렬 단계 불일치
- `34918391286`: Node 20에 `node:sqlite`가 없어 비용 fixture 실행 불가
- 두 Run 모두 제품 commit/배포 없음.

## 6. PREVIEW 090 배포
- 제품 commit: `91c61627822b822457ed10eaf9001da5242d5e62`
- Release trigger / locked commit: `ae293be3fda450da8ff46186078224544a9f8d05`
- App Run: `34918600650` — **PASS**
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=090`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` 090 exact build 확인
- Worker 재배포 없음 — 053 유지

## 7. 다음 실사용 검증
PREVIEW에서 바로 확인:
- `좋아요 곡`에 빨간 하트 + 숫자 0 카드가 더 이상 없는지.
- 숫자 1인 곡 좋아요 해제 시 **회색 하트 + 0**으로 즉시 함께 움직이는지.
- 좋아요 시 하트와 숫자가 즉시 함께 증가하는지.
- 빠른 좋아요→해제에서 숫자가 중복 누적되지 않고 원래 값으로 돌아오는지.
- 5초 전/후 PC↔모바일 하트와 membership이 수렴하는지.
- 다른 기기 signal이 와도 현재 기기의 아직 전송 전 pending 하트를 되돌리지 않는지.
- 1곡/여러 곡 좋아요의 D1/Firestore 비용이 기존 batch 기준을 유지하는지.
- warm Explore/좋아요곡 재진입 + 변경 없음 원본 server R/W 0 목표.

실사용 PASS 전에는 TEST 승격 금지.

## 8. 084 공개/비공개 비용 보호
기존 사용자 PREVIEW 실측 PASS 후보:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`

보호 유지:
- 081 page-exit publication final-state batch
- 082 missing-R2 canonical self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 9. 승격 상태
- PREVIEW 실제: **090 / Worker 053**
- 090: **배포 완료 / 자동검증 PASS / 사용자 실사용 검증 전**
- TEST 승격: **금지**
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- 090 관련 기존 `temp-*` Workflow/스크립트는 실사용 통과 뒤 정리 예정.

## 10. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- 084 publication 비용 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

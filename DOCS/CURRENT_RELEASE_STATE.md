# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **089** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 089 제품 commit: `0d31dc19366fd4403896e01142236e4fe7fa164f`
- 089 배포 고정 commit: `79f73877a894cf8f7d2d014c19848a739c4b16b5`
- 089 최종 검증 Run: `34916331795` — **PASS**
- 089 App Run: `34916494353` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 089 작업 목표
사용자 PREVIEW 실사용에서 같은 계정의 PC/모바일 좋아요 상태와 숫자가 서로 달라지는 문제가 확인됨.

문제 증상:
- 한 기기에서 좋아요를 눌러도 다른 기기 하트가 늦게 따라오거나 회색으로 남음.
- 회색 하트를 본 다른 기기에서 같은 계정으로 다시 좋아요를 누를 수 있음.
- 실제 서버 canonical 좋아요 수는 2인데 특정 기기 화면에서 3으로 보이는 등 숫자가 출렁임.

확정 원인:
- 088까지 좋아요 변경이 페이지를 나갈 때까지 local outbox에 남을 수 있어 같은 계정 다른 기기로 전달이 늦을 수 있었음.
- 클라이언트가 오래된 하트 상태를 기준으로 공개 좋아요 숫자에 로컬 `+1/-1`을 만들어 보여줄 수 있었음.
- 그 결과 서버 canonical 숫자와 기기별 표시 숫자가 분리될 수 있었음.

## 3. 089 수정
### 하트 상태
- 좋아요/해제는 누른 기기에서 즉시 local-first 반영.
- 실제 변경분은 **5초 단위 한 묶음**으로 서버에 전송.
- 클릭마다 개별 서버 요청을 보내는 구조는 사용하지 않음.
- 페이지 이탈 flush는 최종 fallback으로 유지.
- 앱 재시작 뒤 pending outbox가 남아 있으면 묶음 전송을 재개.
- 같은 계정의 다른 기기는 기존 account sync signal 경로로 수렴.

### 공개 좋아요 숫자
- 공개 숫자는 공유 서버 값만 기준으로 사용.
- 기기별 `+1/-1` 숫자 조작 제거.
- 오래된 로컬 하트 때문에 PC 2 / 모바일 3처럼 숫자가 갈라지는 경로 제거.
- 개인 하트 상태와 공개 숫자의 역할을 분리.

### 캐시
- 088의 잘못된 like-state/account-patch 캐시를 089 schema로 한 번 교체.
- 전체 Explore Feed/Music Note/Library 캐시를 앱 버전 때문에 지우지 않음.
- 앱 업데이트를 이유로 전체 데이터 재조회하지 않음.

## 4. 비용 검증
089 비용 원칙:
- 좋아요 클릭마다 직접 서버 요청하지 않음.
- 5초 안의 여러 실제 변경은 한 batch로 묶음.
- 변경 없음 페이지 이동/재진입은 서버 요청 0 목표 유지.
- 전체 Feed scan/rebuild 없음.
- user Firestore에 liked ID 배열 신규 저장 없음.
- Worker/D1 schema 변경 없음.

자동 비용 fixture PASS:
- **100개의 같은 곡 좋아요 → count/derived update 1회**
- **좋아요/해제 net-zero cohort → count/derived write 0**
- 클라이언트 공개 숫자 임의 `+1/-1` 제거 확인
- 081/089 검증: zero-dirty navigation 요청 0, 좋아요만 5초 batch + page-exit fallback

주의:
- 088의 page-exit-only보다 서버 반영 시점은 빨라졌지만, per-click이 아니라 5초 묶음 방식이다.
- 실제 PC/모바일 실사용에서 1곡/연속 여러 곡 좋아요 비용은 아직 최종 실측 전이다.
- 실측 비용이 예상보다 크면 TEST 승격하지 않고 원인부터 수정한다.

## 5. 자동검증
최종 Run `34916331795` — **PASS**:
- TypeScript PASS
- Build PASS
- 085 liked-profile regression PASS
- 086 liked-sync repair PASS
- 087 liked-card consistency PASS
- 088 same-session heart PASS
- 089 cross-device consistency PASS
- Explore like cost optimization PASS
- 081/089 batching regression PASS
- 084 publication regression PASS
- D1 aggregate fixture PASS

## 6. PREVIEW 배포
사용자 승인으로 **앱 089 PREVIEW 배포 완료**.

- Release trigger/locked commit: `79f73877a894cf8f7d2d014c19848a739c4b16b5`
- App Run: `34916494353` — **PASS**
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=089`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` exact build/version 089 확인
- Worker 재배포 없음 — PREVIEW Worker 053 유지
- Functions 변경 없음
- D1/schema 변경 없음
- 사용자 데이터 migration/backfill/delete/복제/덮어쓰기 없음

## 7. 다음 실사용 검증
PREVIEW에서 반드시 확인:
- PC에서 좋아요 → 약 5초 이후 모바일 같은 계정 하트가 빨간색으로 수렴하는지.
- 모바일에서 먼저 좋아요해도 PC가 같은 상태로 수렴하는지.
- 같은 계정이 다른 기기에서 같은 곡을 중복 좋아요할 수 없는지.
- 좋아요 해제도 PC↔모바일 동일하게 수렴하는지.
- 공개 좋아요 숫자가 기기마다 출렁이지 않고 실제 고유 사용자 수와 맞는지.
- 1곡 좋아요와 여러 곡 연속 좋아요의 D1/Firestore 비용.
- `좋아요 곡` 목록/하트가 PC↔모바일에서 일치하는지.
- warm Explore/좋아요곡 재진입 시 변경 없음 원본 server R/W 0 목표 유지 여부.

실사용 PASS 전에는 TEST 승격 금지.

## 8. 이후 기능
089 실사용 정확성/비용 통과 후 공개곡 카드 `...` 메뉴 작업:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note의 기존 폴더 저장 팝업 디자인을 그대로 재사용하고 이름/문구만 변경한다.

## 9. 084 공개/비공개 비용 보호
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

## 10. 승격/정리 상태
- PREVIEW 실제: **089 / Worker 053**
- 089: **배포 완료 / 자동검증 PASS / 사용자 PC↔모바일 실사용·비용 검증 전**
- TEST 승격: **금지**
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- 089용 일회성 `temp-*` 검증 Workflow/스크립트는 실사용 검증 완료 후 정리 예정.

## 11. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 084 publication 비용 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

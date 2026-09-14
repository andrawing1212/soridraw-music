# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- PREVIEW 앱 버전: **082** — 083/084는 Worker 비용 수정만 수행, 프론트 변경 없음
- 084 Worker 제품 source: `3380b2ae9242743f96fc73307da322d1508f5d19`
- 084 permanent release gate: `309816bce8952f09eeaa6a86a1d7b6e2c66fc2cf`
- 084 Worker release trigger: `8d3b5541819d7d36fd9e3d208464ea7782f795ca`
- PREVIEW Worker Run `34800196216` — PASS
- PREVIEW Worker active version: `353327be-ac54-4c09-ad9c-b036f763f44e`
- PREVIEW App Run `34794189198` — PASS / 앱은 082 그대로
- `preview.soridraw.com` app version: **082**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 공개/비공개 비용 개선 이력
082 실사용:
- 3곡 공개 `R36/W6`
- 3곡 비공개 `R30/W6`
- 원인: `owner_uid + id IN` 조회가 owner index scan을 선택

083 Worker 050:
- track PK exact lookup으로 변경
- 3곡 공개 `R18/W6`
- 3곡 비공개 `R12/W6`
- owner scan 제거는 성공했지만 중복 canonical pre-read가 남아 TEST 승격 보류

084 Worker 051:
- healthy/warm publication R2 snapshot을 이전 상태 판단에 사용
- canonical pre-read 대신 guarded `UPDATE ... RETURNING *`
- public hot path의 `track_stats` preflight 제거
- R2 missing/stale/incomplete 또는 unresolved 시에만 track PK SELECT fallback
- owner/source_type authorization guard 유지
- 081 page-exit final-state batch, 082 missing-R2 self-heal, revision-first, Feed/Profile R2 cache 유지
- D1 schema/migration 변경 0

## 3. 084 자동검증 / 배포
Materialization Run `34799978499` — PASS.
- TypeScript PASS
- Build PASS
- Explore like/derived-cache regression PASS
- 082 publication batch PASS
- 083 PK-read PASS
- 084 write-returning PASS
- deploy preflight PASS
- shared D1 schema change 0

Worker Run `34800196216` — PASS.
- locked source `3380b2ae9242743f96fc73307da322d1508f5d19`
- canonical SHA256 `020105ef24dd95af10d27d9d13e52c3eca95dd9a80a17bdec212225f9447c77c`
- active Worker `353327be-ac54-4c09-ad9c-b036f763f44e`
- live PK plan `sqlite_autoindex_tracks_1 (id=?)` PASS
- Feed/Profile smoke PASS
- warm Feed revision `D1 R0/W0`, `HEAD-ONLY-036` PASS
- like cron `*/10 * * * *` PASS
- TEST/PRODUCTION Worker unchanged PASS

## 4. 084 실제 사용자 재계측 — PASS
사용자가 PREVIEW에서 다음 순서로 실측했다.
- 등록된 1곡 공개
- 같은 1곡 비공개
- 등록된 4곡 공개
- 같은 4곡 비공개

실측:
- 1곡 공개: publication sync `D1 rows R3/W2`
- 1곡 비공개: publication sync `D1 rows R3/W2`
- 4곡 공개: publication sync `D1 rows R12/W8`
- 4곡 비공개: publication sync `D1 rows R12/W8`
- 전체 10곡 상태변경 누적: D1 query `R0/W10`, D1 rows `R30/W20`
- 최종 4곡 비공개 PAGE SYNC: `D1 R12/W8`, Firestore `R0/W0`

판정:
- 084에서 **명시적 D1 SELECT는 정상 warm mutation 경로에서 0**으로 내려감.
- rows_read는 공개/비공개 모두 정확히 **곡당 R3**, rows_written은 기존 계약대로 **곡당 W2**로 선형 고정.
- 083 대비 공개는 곡당 R6→R3, 비공개는 R4→R3으로 추가 감소.
- 082의 3곡 R36/R30 같은 fan-out/owner scan 폭증은 제거됨.
- 변경 수에 비례하는 작은 고정 비용으로 수렴했으므로 **공개/비공개 비용 항목은 PASS 후보**로 처리.
- PAGE SYNC는 페이지 이탈 시 묶음 전송을 유지했고 공개/비공개 중 Firestore `R0/W0` 유지.

## 5. 남은 비용 해석
현재 곡당 W2는:
1. canonical `tracks` row 실제 변경
2. `explore_shared_revision` 보호 trigger 갱신

현재 rows R3/W2는 더 이상 중복 SELECT/owner scan 형태가 아니다. 더 줄이려면 공유 revision/trigger 계약 자체를 다시 설계해야 하므로 공개/비공개 핫패스만 보고 무리하게 제거하지 않는다.

## 6. Firebase / Functions / 사용자 데이터
084 변경:
- Firebase Hosting 변경 없음
- Functions 변경 없음
- Firestore Rules/schema 변경 없음
- Shared D1 migration 없음
- 테이블/인덱스/trigger 추가·삭제 없음
- 사용자 데이터 대량삭제/백필/복제/덮어쓰기 없음
- UI/CSS/레이아웃 변경 없음

## 7. 다음 검증
공개/비공개 비용은 통과 후보로 두고 다음 비용/정확성 검증으로 이동한다.

우선순위:
1. 좋아요 여러 곡 → page-exit/10분 aggregate 비용 및 내 계정 liked 상태 정확성
2. Music Note 상세편집 → 로컬 즉시 반영, 최종 delta write만 발생하는지
3. Library 재진입 → unchanged warm cache server read 0
4. 새 기기/장기 미접속 → 1회 복구 후 warm 재진입 read 0
5. PC ↔ 모바일 같은 계정 공개상태/좋아요 수렴
6. Firestore `user_structures` 불필요 write가 다른 Music Note 동작에서 발생하는지 확인

engagement 숫자(좋아요/재생/댓글)가 공개/비공개 후 보존되는지는 다음 정확성 확인에서 계속 보호한다.

## 8. 승격 상태
- TEST 승격: **아직 금지** — 공개/비공개 비용은 PASS 후보지만 좋아요/Music Note/Library/PC↔모바일 핵심 검증 전
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- PREVIEW→TEST→PRODUCTION 승격 시 사용자 원본 데이터 복제/덮어쓰기 금지

## 9. 정상 기능 보호
임의 변경 금지:
- UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 081 page-exit final-state batching
- 082 missing-R2 canonical self-heal + revision-first
- Explore Feed/public profile R2 cache
- 좋아요 10분 canonical aggregate
- 공유 revision 호환 구조
- 공유 사용자 원본 데이터

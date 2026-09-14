# NEXT CODEX TASK

상태: **PREVIEW Worker 051 / 084 공개·비공개 비용 실사용 PASS 후보 / 다음은 좋아요·Music Note·Library 비용 검증 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- PREVIEW 앱: **082** — 프론트 변경 없음
- 084 Worker locked source: `3380b2ae9242743f96fc73307da322d1508f5d19`
- PREVIEW Worker Run `34800196216` — PASS
- PREVIEW Worker active Version: `353327be-ac54-4c09-ad9c-b036f763f44e`
- PREVIEW App Run `34794189198` — 기존 082 PASS
- `preview.soridraw.com` app version: **082**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 084 사용자 실측 결과
사용자가 PREVIEW에서 1곡 공개/비공개 후 4곡 공개/비공개를 연속 측정했다.

- 1곡 공개: `D1 rows R3/W2`
- 1곡 비공개: `D1 rows R3/W2`
- 4곡 공개: `D1 rows R12/W8`
- 4곡 비공개: `D1 rows R12/W8`
- 10개 상태변경 누적: D1 query `R0/W10`, rows `R30/W20`
- 최종 4곡 비공개 PAGE SYNC: `D1 R12/W8`, Firestore `R0/W0`

판정:
- 정상 warm mutation 경로의 명시적 D1 SELECT는 0.
- 공개/비공개 모두 rows_read가 곡당 R3, rows_written이 곡당 W2로 선형 고정.
- 083 대비 공개 R6→R3/곡, 비공개 R4→R3/곡.
- 082의 owner-scan/fan-out 폭증은 제거됨.
- page-exit 묶음 처리 유지.
- 공개/비공개 비용은 PASS 후보로 두고 더 이상 무리한 trigger 제거 최적화는 하지 않는다.

## 현재 Worker 051 구조 보호
- warm publication R2 snapshot으로 이전 상태 판단
- guarded `UPDATE ... RETURNING *`
- owner/source_type 권한 가드 유지
- public `track_stats` preflight 없음
- R2 missing/stale/incomplete/unresolved일 때만 정확한 PK SELECT fallback
- 최초 등록 publication 경로 유지
- 081 page-exit final-state batch 유지
- 082 missing-R2 self-heal + revision-first 유지
- Feed/Profile R2 cache 유지
- Shared D1 schema/migration 변경 0
- 사용자 데이터 백필/삭제/복제 0
- UI/CSS/레이아웃 변경 0

## 다음 작업
새로운 구조 수정 전에 실제 비용/정확성 검증을 계속한다.

우선순위:
1. 좋아요 여러 곡: 즉시 UI 반영, 내 계정 liked 표시, page-exit/10분 aggregate 비용
2. PC ↔ 모바일: 좋아요 수와 내가 누른 liked 상태가 같은 계정에서 정확히 수렴하는지
3. Music Note 상세편집: 로컬 즉시 반영 + 마지막 delta write만 발생하는지
4. Library 재진입: unchanged warm cache에서 server read 0인지
5. 새 기기/장기 미접속: 1회 복구 후 재진입 read 0인지
6. Firestore `user_structures` 불필요 write 확인
7. 공개/비공개 후 기존 좋아요/재생/댓글 숫자 보존 확인

비용 기준:
- 변경 없음 재진입 R/W 0 목표.
- 실제 변경만 변경된 항목 수에 비례.
- 전체 목록/owner 범위 scan 재도입 금지.
- 페이지 이동 자체 때문에 write 발생 금지.

## 승격 기준
- 공개/비공개: 현재 084 실측 비용 수준 유지 + correctness 유지
- 좋아요: 내 liked 상태/공개 count 수렴 + 과도한 D1/Firestore read/write 없음
- Music Note/Library: warm 재진입 read 0 우선
- PC/모바일 수렴 유지
- UI/CSS/반응형 변화 0
- TEST/PRODUCTION 비의도 변경 0

TEST: **핵심 비용/정확성 검증 완료 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.

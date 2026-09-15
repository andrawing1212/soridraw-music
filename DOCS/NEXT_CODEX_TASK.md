# NEXT CODEX TASK

상태: **PREVIEW 앱 092 + Catalog no-fullscan 구조 배포 완료 / 자동검증 PASS / 사용자 Firestore 비용 실측 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **092**
- PREVIEW App Run: `34948206737` — PASS
- 앱 배포 SHA: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- Catalog 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- Catalog 검증 Run: `34946586905` — PASS
- 실제 PREVIEW Media Worker Version ID: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker Run: `34946799113` — PASS
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## Catalog 092 보호 기준
- 일반 Music Note/Library Catalog GET은 R2 only.
- profile revision은 invalidation hint이며 Firestore full rebuild 권한이 아님.
- 새 기기는 기존 R2 Catalog를 1회 받고 로컬 IndexedDB/cache를 만든다.
- R2 Catalog가 없으면 `CATALOG_NOT_MATERIALIZED` fail-closed + bounded legacy bundle fallback.
- 일반 GET/delta/conflict 복구에서 Firestore collection traversal 금지.
- partial UI list의 누락은 삭제로 해석하지 않음. explicit tombstone만 삭제.
- local newer revision을 old R2 응답으로 덮어쓰지 않음.
- 앱 업데이트 이유의 전체 Catalog rebuild/cache wipe 금지.

## 지금 할 일 — 사용자 PREVIEW 실측
1. 새 브라우저 프로필 또는 캐시 없는 기기에서 같은 계정 로그인.
2. Firestore Dashboard 수치를 초기 상태에서 확인.
3. Music Note 첫 진입 후 read 증가량 확인.
4. Library 첫 진입 후 read 증가량 확인.
5. Music Note/Library 재진입 + 변경 없음에서 data read 0 목표 확인.
6. PC↔모바일 한쪽에서 곡 1개 수정 후 다른 기기에서 변경분만 수렴하는지 확인.
7. 앱 092 업데이트 자체만으로 Firestore 전체 collection read가 발생하지 않는지 확인.
8. 좋아요 1 batch의 D1 즉시 write가 W1인지 확인.
9. Explore/공개프로필 warm 재진입 + 변경 없음 D1 read 0 목표 확인.

### Catalog 판정
- Firestore read가 Music Note/Library 곡 개수에 비례하면 FAIL.
- 새 기기 Catalog R2 1회 수신은 허용.
- Firestore favorites 또는 suno_tracks 전체 collection 재조회는 금지.
- 원인을 모르는 read 증가가 있으면 TEST 승격 중단.

### 좋아요 판정
- 정상 좋아요 1 batch 즉시 D1 write W1이면 055 비용 목표 PASS 후보.
- W2 이상이면 추가 write 원인을 찾기 전 TEST 승격 금지.

## 금지
- 사용자 데이터 migration/backfill/delete/overwrite
- Firestore/D1 destructive schema change
- 새 기기 bootstrap을 이유로 전체 collection scan
- 클릭별 서버 요청
- 전체 Feed/Profile scan
- 앱 업데이트 이유의 전체 cache wipe
- user Firestore liked-ID 배열 저장
- UI/CSS 비요청 변경

## 승격
- TEST: **Catalog 새 기기 비용 실측 + 092 정확성 + Explore 좋아요 W1 실측 PASS 전 금지**.
- TEST 승격 시 PREVIEW exact tree 전체를 main으로 승격하고 사용자 데이터는 복사하지 않는다.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.

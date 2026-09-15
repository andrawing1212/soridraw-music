# NEXT CODEX TASK

상태: **PREVIEW 앱 092 배포 중 / Explore 좋아요 093 비용수정 source 완료·자동검증 PASS·배포 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **092**
- PREVIEW App Run: `34948206737` — PASS
- 앱 배포 SHA: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- Catalog 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- Catalog 검증 Run: `34946586905` — PASS
- 실제 PREVIEW Media Worker Version ID: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- Explore 좋아요 RTDB source commit: `7326168067141e01c32e54c932f23b5a32d91661`
- RTDB payload rules fix: `f0d54cdff0dab2514c8c3afacba2608e505fee48`
- 093 verifier fix: `3c9f5e00331ed08ae6fc2873a7e49646ebbdf89d`
- 최종 093 validation workflow commit: `3ab57b90a09bb9dfbc3621d6170308c77be04311`
- 최종 093 validation Run: `34954374540` — **PASS**
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 보호 기준
### Catalog 092
- 일반 Music Note/Library Catalog GET은 R2 only.
- 새 기기는 기존 R2 Catalog 1회 → 로컬 cache.
- 일반 GET/delta/conflict 복구에서 Firestore 전체 collection traversal 금지.
- 앱 업데이트 이유의 전체 Catalog rebuild/cache wipe 금지.

### Explore 좋아요 093 후보
- D1 = 실제 좋아요 원본/처리.
- RTDB = 같은 계정 다른 기기에 작은 변경 신호만 전달.
- Explore 좋아요 동기화 목적 Firestore `users/{uid}` write = **0 목표**.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- `liked=true + count=0` 모순만 `/v1/me/liked-tracks` targeted batch로 확인.
- targeted recovery 최대 50, polling 없음, Feed/Profile 전체조회 없음, Firestore 조회 없음.
- 실제 서버 count가 0이면 가짜 `0→1` 보정 금지.
- Music Note/Recent Songs RTDB 기존 publisher payload와 Rules가 정확히 일치해야 함.

## 자동검증 완료
Run `34954374540`:
- source contract PASS
- TypeScript PASS
- Build PASS
- RTDB Database Emulator Rules compile PASS
- no source side effects PASS
- no deploy / no Worker / no Functions / no D1 schema / no user-data change

## 다음 작업
사용자가 PREVIEW 배포를 승인하면:
1. 현재 preview HEAD를 고정.
2. 앱 버전을 다음 PREVIEW 버전으로 올림.
3. TypeScript / Build / 관련 tests 재확인.
4. Firebase PREVIEW Hosting 배포.
5. **Firebase Realtime Database Rules도 같은 source로 PREVIEW 적용.**
6. Explore Worker/Media Worker/Functions는 변경이 없으므로 불필요 재배포 금지.
7. `preview.soridraw.com` 실제 build/version 확인.
8. TEST/PRODUCTION 비변경 확인.

배포 후 사용자 실측:
1. PC/모바일 같은 계정에서 좋아요 1개.
2. 좋아요 해제 1개.
3. 2~10개 연속 좋아요 후 5초 batch.
4. CACHE LIVE에 Explore 좋아요발 `users:write`가 없어야 함.
5. Firestore Console도 Explore 좋아요 때문에 write/read 연쇄증가가 없어야 함.
6. D1 batch는 정상 처리되어 실제 좋아요가 유지되어야 함.
7. 다른 기기 하트 상태가 변경분만 수렴해야 함.
8. `빨간 하트 + 0` 곡은 해당 곡만 targeted recovery 후 실제 숫자로 수렴해야 함.
9. 실제 canonical count=0이면 임의 1 표시 금지.
10. Music Note/Recent Songs RTDB 기존 동기화 회귀 없음 확인.

## 금지
- 사용자 데이터 migration/backfill/delete/overwrite
- Firestore/D1 destructive schema change
- 새 기기 bootstrap 전체 scan
- 클릭별 서버 요청
- 전체 Feed/Profile scan
- 앱 업데이트 이유의 cache wipe
- user Firestore liked-ID 배열 저장
- UI/CSS 비요청 변경
- 배포 승인 전 PREVIEW 배포

## 승격
- TEST: **Catalog 비용 + Explore 좋아요 Firestore R/W 0 목표 + PC↔모바일 정확성 + 기존 RTDB 동기화 회귀 없음** 실사용 PASS 전 금지.
- TEST 승격 시 PREVIEW exact tree 전체를 main으로 승격, 사용자 데이터 복사 금지.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.

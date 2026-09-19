# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — 067 좋아요 shared parity 수정 완료 / PREVIEW 재배포 전

## 현재 고정 기준
- PREVIEW code HEAD before this doc update: `81c414de9983eeda2f2bd31f77810038b6a19387`
- PR #108 merge: `81c414de9983eeda2f2bd31f77810038b6a19387`
- 067 validation Run: `35437786780` SUCCESS
- canonical 067 SHA256: `35faf34dd9b8e564176cc88ee6ed149463de6275459e9f558067f234502474af`
- app version: 124
- current deployed PREVIEW Worker is still 066 version `c177104b-be57-4e0b-9d41-3b8b817fdfb4`
- TEST/PRODUCTION unchanged

## 확인된 live bug
Read-only Run `35437572116`:
- shared latest R2: four visible liked tracks = 0
- shared popular R2: same four tracks = 1
- canonical D1 relation/stat/derived = 1
- R2-only API D1 R0/W0
Root cause: active 075 aggregate did not call shared 065 targeted propagation.

## 다음 작업
사용자의 명확한 PREVIEW 재배포 승인 전에는 배포 금지.

승인 후:
1. exact preview target 고정.
2. 067 canonical hash/syntax/regression preflight.
3. PREVIEW Worker만 배포. Firebase Hosting/Functions/Rules 재배포 금지.
4. TEST/PRODUCTION Worker 비변경 확인.
5. 새 like/unlike test mutation에서 shared latest/popular/card가 동일 count로 targeted patch되는지 확인.
6. 기존 stale 4곡은 전체 rebuild 없이 해당 track IDs만 canonical D1 count를 읽어 shared derived R2 latest/popular/card에 bounded repair.
7. repair 뒤:
   - latest = 1
   - popular = 1
   - canonical = 1
   - live R2-only D1 R0/W0
   를 확인.
8. 사용자 PC/모바일에서 추천/최신/인기 탭 숫자 일관성 확인.

## 금지
- 전체 Feed rebuild/backfill.
- shared canonical D1 row 수정/재생성.
- D1 schema/index/trigger 변경.
- 사용자 데이터 대량변경.
- 기능 flag 임의 ON.
- Firebase 재배포.
- TEST/PRODUCTION 승격.

## 이후
좋아요 parity가 PREVIEW에서 PASS한 뒤 원래 Phase C W2 publication 검증으로 복귀.

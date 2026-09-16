# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST — TEST 승격 완료 / 정식배포 전 실사용 검증

## 현재 기준

- PREVIEW branch: `preview`
- TEST branch: `main` = `bb1305660ca694dd057f3ed4184bdafea60f5b18`
- TEST release source PREVIEW: `a3ba265357fa672cd4c9f6f58204003bb61d9ab0`
- PREVIEW/TEST app: **110**
- TEST URL: `https://test.soridraw.com`
- TEST Explore Worker: `498f6180-f199-4d3d-b9c5-2744fe7889e0`
- TEST promotion Run: `35109891755` SUCCESS
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` (비변경)
- Release trigger: disabled

## TEST 자동 검증 결과

PASS:
- TypeScript / Build / release static guard
- TEST/PRODUCTION Worker dry-run
- shared canonical D1 SELECT-only prerequisite check
- TEST main exact PREVIEW tree promotion
- TEST Worker deploy + smoke
- Firebase TEST Hosting deploy
- `soridraw-test.web.app` + `test.soridraw.com` exact build/app-version 110
- TEST Feed/CORS + revision HEAD-ONLY-036
- TEST Functions CORS
- PRODUCTION branch/Hosting 비변경
- 사용자 데이터 migration/backfill/delete 0
- Firestore Rules/Functions deploy 0

## 다음 작업 — 사용자 TEST 실사용 검증

정식배포 전 다음을 TEST에서 확인한다.
1. PC/모바일 업데이트 후 기존 Music Note/Library/Explore 데이터가 그대로 보이는지.
2. Music Note 편집이 로컬 즉시 반영되고 약 60초 묶음 저장이 유지되는지.
3. Library warm 재진입이 불필요한 Firestore 전체 read를 만들지 않는지.
4. Explore 최신/인기/추천 warm 재진입과 공개프로필 재진입이 정상이고 불필요한 D1 read/write가 없는지.
5. Master/Admin 등 교차계정 좋아요 숫자가 약 1분 event batch 후 동일하게 수렴하는지.
6. 같은 계정 PC↔모바일 heart membership 동기화 및 공개숫자 정합성.
7. 공개/비공개/팔로우/프로필 수정이 변경된 항목만 반영되고 기존 데이터가 손상되지 않는지.
8. PC/모바일 UI/반응형이 PREVIEW와 동일한지.

실사용 FAIL이 나오면 PRODUCTION 승격 금지, 원인 수정은 다시 preview에서 시작한다.

## PRODUCTION

- 아직 승인 없음.
- 사용자가 명확히 `정식배포`를 승인한 경우에만 현재 검증된 TEST tree를 PRODUCTION으로 승격한다.
- 사용자 데이터는 이동/복제하지 않는다.

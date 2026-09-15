# NEXT CODEX TASK

상태: **PREVIEW 094 배포 완료 / 자동검증 PASS / 사용자 실사용 비용·PC↔모바일 수렴 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **094**
- PREVIEW 094 배포 source SHA: `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- PREVIEW 094 version bump commit: `702ae885e8ae1afa361532c310343d39eb3d428d`
- PREVIEW 094 제품 구현 commit: `bb32b8fd004f6091303d74ad89532b6f87863cd9`
- 094 구현/회귀 검증 Run: `34973859090` — **PASS**
- 094 PREVIEW 승격 검증 Run: `34974143205` — **PASS**
- 094 App Release Run: `34974907217` — **PASS**
- 실제 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 094 현재 동작
- 좋아요/해제 즉시 로컬 하트/숫자 반영.
- 5초 자동 서버 batch 제거.
- 추천/최신/인기 탭 전환만으로 서버 flush 없음.
- durable local outbox에 변경 누적.
- 서버 전송은 Explore 이탈, 공개프로필 진입/복귀, 앱 hidden, pending 50개 도달 시에만 묶음 처리.
- 실패 시 timer retry 없이 로컬 보관 후 다음 경계에서 재시도.
- RTDB에는 서버 승인 변경만 전달.
- Firestore `users/{uid}` Explore like sync write 재도입 없음.
- 숫자는 서버 승인 뒤 0/옛 값으로 역행하지 않도록 acknowledged count 상태를 유지하고 aggregate 수렴 후 canonical로 복귀.

## 배포 결과
Run `34974907217`에서:
- locked source SHA `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting only 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json = 094` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS

Worker 056 / Media Worker / Functions / Rules / D1은 094에서 변경이 없어 재배포하지 않았다.

## 다음 작업 — 사용자 실측 우선
1. PREVIEW에서 좋아요 2~10개를 연속으로 누른다.
2. 5초가 지나도 좋아요 서버 요청이 자동으로 발생하지 않는지 확인한다.
3. 추천/최신/인기 탭만 전환할 때 서버 flush가 없는지 본다.
4. 공개프로필 진입 또는 Explore 밖 이동 시 그동안 변경이 한 batch로 반영되는지 확인한다.
5. 하트/숫자가 클릭 즉시 반영되고 서버 승인 뒤 역행하지 않는지 본다.
6. PC↔모바일 같은 계정에서 boundary sync 뒤 변경분만 수렴하는지 확인한다.
7. CACHE LIVE / Firestore Console에서 Explore 좋아요발 `users:write`와 listener read 연쇄 증가가 없는지 본다.
8. D1이 클릭별 개별 요청으로 증가하지 않는지 확인한다.
9. `/v1/me/liked-tracks` 500 재발 없음 + 좋아요 곡 카드 정상 표시를 확인한다.
10. Music Note/Recent Songs RTDB 회귀와 Catalog full-scan 재발이 없는지 확인한다.

## 합격선
- ordinary browsing / Explore 탭 전환 = 좋아요 server flush 0.
- 실제 변경은 의미 있는 경계 또는 max 50에서만 batch.
- Explore like Firestore sync write 0.
- 전체 Feed/Profile/tracks scan 없음.
- 숫자 0 역행/가짜 1 보정 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 승격 금지
- PREVIEW 094 실사용 비용/정확성 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.

문제가 발견되면 TEST에 올리지 않고 PREVIEW에서 해당 경로만 최소 수정한다.

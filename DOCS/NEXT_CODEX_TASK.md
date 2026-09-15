# NEXT CODEX TASK

상태: **Explore 좋아요 097 PREVIEW 배포 완료 / 자동검증 PASS / 캐시 삭제 없는 PC↔모바일 숫자 수렴·비용 실측 남음 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **097**
- 097 제품 commit: `ae5748298eb612a6d592d58293898a58f8c99872`
- 097 version bump commit: `8951b6d49c5f07e967fa040e2b13f373014b245e`
- 097 배포 source SHA: `c86ed90107ad153255cdb05f38dcfb2426d4c304`
- 097 검증 Run: `34990998142` — **PASS**
- 097 App Release Run: `34991311092` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 097에서 해결한 대상
096 실사용에서 PC 숫자보다 모바일이 대부분 정확히 1 낮게 남았다.
예: `PC 1 / 모바일 0`, `PC 2 / 모바일 1`. 하트 색은 맞는 경우가 많았다.

원인은 모바일 durable like outbox에 남아 있는 오래된 pending이었다.
- RTDB 승인 liked 상태와 pending desiredLiked가 이미 같은데도 pending 존재만으로 `preservePending` 처리.
- 하트는 로컬 pending으로 맞지만 RTDB 확정 `displayLikeCount` import가 막힘.

097 처리:
- pending 없음 → 원격 승인값 적용.
- pending desiredLiked와 RTDB liked가 같음 → pending을 이미 승인된 항목으로 정리하고 원격 확정 숫자까지 적용.
- 서로 다름 → 이 기기의 더 새로운 입력으로 보고 local pending 보호.
- 앱 캐시 삭제 필요 없음.
- 추가 D1 read 없음.
- 추가 Firestore read/write 없음.
- RTDB Rules/Worker/Functions/D1 schema/UI 변경 없음.

## 배포 결과
Run `34991311092` PASS:
- locked source `c86ed90107ad153255cdb05f38dcfb2426d4c304`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json = 097` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS

## 다음 실측
1. **모바일 캐시를 지우지 말고** PREVIEW 097에 진입.
2. 096에서 숫자가 1 부족했던 동일 곡들을 PC와 모바일에서 비교.
3. 빨간 하트와 숫자가 동일하게 수렴해야 함.
4. PC에서 3~5곡 좋아요를 여러 boundary batch로 나눠 확정하고 모바일을 잠시 background/미접속 상태로 둔 뒤 복귀하여 다시 비교.
5. 모바일에서 그 이후 새로 반대 상태를 누르면 그 최신 입력은 원격 replay가 덮어쓰지 않아야 함.
6. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0 확인.
7. normal Explore 재진입 `내 좋아요 곡 확인` D1 row read 0 유지 확인.
8. Firestore Explore-like users write/listener read 연쇄 0 확인.
9. CACHE LIVE 초기화 후 아무 변경 없이 같은 공개프로필 2회 재진입하여 원본 D1 read 0 확인.
10. Cloudflare Dashboard PREVIEW D1 `soridraw-explore-preview-db`의 Rows read / Rows written 증가분을 CACHE LIVE와 대조.
11. Workers & Pages `soridraw-explore-preview` Observability에서 같은 시간대 예상 밖 background 요청 확인.

## 합격선
- PC↔모바일 빨간 하트와 숫자가 동일 상태로 수렴.
- ordinary Explore browsing/tab switch = like server request/write 0.
- 실제 변경은 의미 있는 경계 또는 max50에서만 batch.
- normal Explore 재진입 = 좋아요 관련 D1 row read 0.
- 변경 없는 공개프로필 재진입 = 원본 D1 read 0 목표.
- Firestore Explore-like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.

## 승격 금지
- 위 PREVIEW 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 문제 발견 시 PREVIEW에서 해당 경로만 최소 수정.

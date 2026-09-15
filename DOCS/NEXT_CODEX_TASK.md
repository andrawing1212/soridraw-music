# NEXT CODEX TASK

상태: **Explore 좋아요 098 PREVIEW 배포 완료 / 자동검증 PASS / PC↔모바일 실사용 하트+숫자 수렴·비용 실측 남음 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **098**
- 098 제품 commit: `dc525ab96d516b294eef2e0453ed80d36b7b9fd1`
- 098 version bump commit: `984403df52ddfecadc61c6231a769bf635e8b4ec`
- 098 배포 source SHA: `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- 098 검증 Run: `34998964205` — **PASS**
- 098 App Release Run: `34999220694` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 098에서 해결한 대상
097 실사용에서도 모바일에 **빨간 하트 + 숫자 0**이 남았다. PC에서는 같은 곡이 1이었고 일부 모바일 곡만 1이었다.

최종 원인:
- 093~097은 RTDB `userSync/{uid}/exploreLike` 한 객체 전체를 `set()`으로 교체.
- replay 목록은 각 브라우저의 로컬 account patch cache로 조립.
- 다른 기기의 최신 승인 결과를 아직 보지 못한 기기가 새 batch를 publish하면, 그 기기의 불완전한 replay가 RTDB 전체를 덮어쓰며 다른 기기의 retained count row를 지울 수 있었음.
- 하트 membership은 별도 cache에 남을 수 있어 결과가 빨간 하트인데 숫자만 0으로 갈라짐.

098 처리:
- blind `set()` 제거.
- RTDB `runTransaction()`으로 서버의 실제 최신 retained signal과 방금 D1에서 승인된 batch를 원자적으로 merge.
- 현재 승인 batch가 같은 track 중복 시 우선.
- 다른 track의 기존 RTDB retained row는 보존.
- max 50 제한 유지.
- 추가 D1 recovery read 없음.
- Firestore read/write 없음.
- RTDB path/rules/listener 구조 변경 없음.
- Worker/Functions/D1 schema/UI/사용자 데이터 변경 없음.

## 배포 결과
Run `34999220694` PASS:
- locked source `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json = 098` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS

## 다음 실측
1. PC와 모바일 모두 **캐시 삭제 없이** PREVIEW 098 진입.
2. 기존 빨간 하트+0 곡들을 다시 확인.
3. PC에서 3~5곡 좋아요 → 정상 batch 경계 후 모바일에서 하트와 숫자 모두 동일하게 수렴 확인.
4. 그 상태에서 모바일이 다른 곡을 좋아요 → PC에서 앞선 PC 곡 숫자가 0으로 사라지지 않는지 확인.
5. 모바일→PC 방향도 반대로 반복.
6. 2~10곡 빠른 좋아요 후 동일 결과 확인.
7. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0 확인.
8. normal Explore 재진입 좋아요 관련 D1 row read 0 확인.
9. Firestore Explore-like `users` write/listener read 연쇄 0 확인.
10. CACHE LIVE와 Cloudflare PREVIEW D1 Rows read/written 증가분 대조.

## 합격선
- PC↔모바일 빨간 하트와 숫자가 동일 상태로 수렴.
- 한 기기 새 변경이 다른 기기의 기존 승인 숫자를 지우지 않음.
- ordinary Explore browsing/tab switch = like server request/write 0.
- 실제 변경은 의미 있는 경계 또는 max50에서만 batch.
- normal Explore 재진입 = 좋아요 관련 D1 row read 0.
- Firestore Explore-like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.

## 승격 금지
- 위 PREVIEW 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 문제 발견 시 PREVIEW에서 해당 경로만 최소 수정.

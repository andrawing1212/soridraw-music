# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **098** — `https://preview.soridraw.com`
- 098 제품 commit: `dc525ab96d516b294eef2e0453ed80d36b7b9fd1`
- 098 version bump commit: `984403df52ddfecadc61c6231a769bf635e8b4ec`
- 098 배포 source SHA: `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- 098 구현/회귀 검증 Run: `34998964205` — **PASS**
- 098 PREVIEW App Release Run: `34999220694` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 098에서 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. 현재 Explore 좋아요 구조
목표:
`여러 좋아요 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch → D1 변경분만 처리 → RTDB는 같은 계정 기기 간 작은 승인 신호만 전달 → 정상 재진입은 로컬/캐시 → D1/Firestore 추가 읽기 0 목표`

유지해야 하는 정상 구조:
- 추천/최신/인기 탭 이동만으로 like flush 없음.
- durable local outbox에 실제 변경만 저장.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50 같은 의미 있는 경계에서 batch.
- D1이 실제 좋아요 관계와 숫자 처리의 기준.
- RTDB `userSync/{uid}/exploreLike`는 같은 계정의 다른 기기에 승인된 결과를 전달하는 작은 신호 채널.
- Firestore `users/{uid}`를 Explore-like 동기화용으로 쓰지 않음.
- normal Explore 재진입에서 숫자 복구를 위해 `/v1/me/liked-tracks`를 반복 호출하지 않음.
- 승인된 display count는 canonical aggregate가 따라올 때까지 로컬에 보존.
- RTDB retained signal은 unique track 기준 최대 50개로 제한.

## 3. 097 실사용 FAIL과 최종 원인
097 배포 후에도 실제 모바일에서 여러 곡이 **빨간 하트인데 숫자 0**으로 남았고, PC에서는 같은 곡이 1로 보였다. 일부 곡만 모바일에서도 1이어서 단순 렌더링 오류나 전체 D1 저장 실패로 볼 수 없었다.

최종 원인:
- 093~097은 RTDB 한 경로 `userSync/{uid}/exploreLike`에 signal 전체를 `set()`으로 덮어썼다.
- signal의 replay 목록은 **그 브라우저가 가진 로컬 account patch cache**를 기반으로 조립했다.
- PC가 A/B/C 곡의 승인 숫자를 RTDB에 올린 뒤, 모바일이 그 최신 signal을 아직 충분히 반영하지 못한 상태에서 D 곡을 새로 저장하면 모바일은 자기 로컬 replay 기준으로 signal 전체를 다시 만들 수 있었다.
- 이때 PC가 넣어 둔 A/B/C의 승인 숫자 row가 새 signal에서 빠지면서 RTDB의 retained result가 사라질 수 있었다.
- 하트 membership은 별도 로컬/social cache에 남아 빨간색을 유지할 수 있으므로 결과가 **빨간 하트 + 숫자 0**으로 갈라졌다.

즉 문제는 D1의 실제 좋아요 저장 실패가 아니라, **여러 기기가 같은 RTDB 한 칸 전체를 각자의 부분 캐시로 덮어쓰는 lost-update 구조**였다.

## 4. 098 수정 — 전체 덮어쓰기 제거
`src/services/exploreLikeService.ts`의 RTDB publisher를 blind `set()`에서 **RTDB transaction merge**로 변경했다.

동작:
- 현재 기기에서 D1이 방금 승인한 batch 결과를 fresh 결과로 사용.
- RTDB transaction 안에서 서버의 실제 최신 retained signal을 읽음.
- fresh 결과를 먼저 넣어 같은 track 중복 시 현재 승인 batch가 우선.
- 그 외 track은 RTDB 최신 retained 결과를 합침.
- unique track 최대 50개 제한 유지.
- `previousVersion`은 transaction 시점의 실제 RTDB 최신 version을 사용.
- PC/모바일이 거의 동시에 저장해도 Firebase transaction 재시도로 서로의 다른 track을 조용히 지우지 않도록 함.

중요:
- RTDB schema/path 변경 없음.
- RTDB Rules 변경 없음.
- page entry나 일반 browsing에서 transaction/write를 발생시키지 않음. 실제 D1 like batch가 승인된 뒤 signal publish에만 사용.
- 추가 D1 recovery read 없음.
- 추가 Firestore read/write 없음.
- D1 canonical 좋아요 처리 방식은 변경하지 않음.

098 제품 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-096-explore-like-cross-device-replay.mjs`
- `scripts/verify-098-explore-like-atomic-signal.mjs`

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기
- `src/services/userDomainSyncService.ts`
- `database.rules.json`
- Explore Worker 056
- Media Worker
- Firebase Functions
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 5. 098 자동검증
최종 구현/회귀 검증 Run `34998964205` — **PASS**:
- Install PASS
- TypeScript PASS
- Build PASS
- 094 session-boundary batching 회귀 PASS
- 095 zero-read display/re-entry 회귀 PASS
- 096 cross-device retained replay 회귀 PASS
- 097 matching-pending acknowledgement 회귀 PASS
- 098 atomic RTDB merge 검증 PASS
- like-cost/D1 fixture PASS
- 085 liked-profile regression PASS
- 086 liked-sync-repair regression PASS
- 변경 범위 guard PASS

098 verifier가 확인하는 핵심:
- publisher가 `runTransaction()` 사용.
- RTDB 실제 최신 `currentValue`와 현재 D1 승인 batch를 merge.
- 현재 batch가 같은 track의 오래된 retained row보다 우선.
- 서로 다른 PC/mobile track 결과는 함께 보존.
- 최대 50 제한 유지.
- publisher 안에서 D1 recovery request/fetch 없음.
- Firestore import/read 없음.
- 기존 RTDB listener/rules path 그대로 유지.

참고: 098 준비 중 앞선 workflow-only 실패들은 Python/YAML 검증 스크립트 문법 문제였으며 제품 commit/push/deploy 전에 중단됐다. 제품 코드는 최종 PASS Run에서만 commit됐다.

## 6. PREVIEW 098 배포 결과
사용자 명확한 수정+배포 승인 후 canonical PREVIEW App Release 경로로 **Firebase PREVIEW Hosting만** 배포했다.

Run `34999220694` — **PASS**:
- locked source SHA: `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 `app-version.json = 098` PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

098에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 7. 사용자 데이터 / 비용 영향
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.
- 좋아요 실제 저장은 기존 D1 batch 구조 유지.
- 098은 **RTDB signal을 안전하게 합치는 방식만 변경**.
- 추가 D1 read 0 목표.
- 추가 Firestore read/write 0 목표.
- 일반 Explore 진입/재진입/탭 이동 때문에 새 RTDB write를 만들지 않음.
- 실제 like batch가 생긴 경우에만 RTDB transaction signal write가 발생.
- 정상 Explore 재진입 liked-tracks recovery read를 재도입하지 않음.

## 8. PREVIEW 098 실사용 합격선
1. PC와 모바일 같은 계정, 기존 앱 캐시를 지우지 않고 098 진입.
2. 기존 빨간 하트+0이 재현되던 곡 확인.
3. PC에서 여러 곡을 좋아요하고 정상 batch 경계 후 모바일에서 **하트와 숫자가 모두 동일**하게 수렴하는지 확인.
4. 모바일에서 다른 곡을 좋아요한 뒤 PC에서 앞선 PC 곡 숫자가 사라지거나 0으로 돌아가지 않는지 확인.
5. PC↔모바일 방향을 반대로도 반복.
6. 2~10곡 빠른 좋아요 후 동일 결과 확인.
7. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0 유지.
8. normal Explore 재진입에서 좋아요 관련 D1 row read 0 유지.
9. Firestore Explore-like users write/listener read 연쇄 0 유지.
10. CACHE LIVE와 Cloudflare D1 Rows read/written 증가분 대조.

FAIL 조건:
- 빨간 하트 + 숫자 0/1 부족 재현.
- 한 기기의 새 좋아요가 다른 기기에서 이미 승인된 곡 숫자를 없앰.
- 098 때문에 normal browsing/re-entry D1 또는 Firestore read가 추가됨.
- Explore 내부 탐색만으로 batch/write가 발생.

## 9. 정상 기능 보호
- Catalog 092: 일반 Music Note/Library catalog R2-only, Firestore full scan 금지.
- Worker 056: liked-track requested IDs만 PK/index lookup, 전체 tracks scan 금지.
- Music Note: Local First + 묶음 저장 보호.
- Explore: durable outbox + boundary/max50 batch + RTDB bounded retained signal 보호.
- 공개/비공개 변경분 처리 구조 보호.
- UI 위치/크기/간격/테마/반응형 비요청 변경 금지.

## 10. TEST / PRODUCTION 승격
- TEST: **098 PREVIEW PC↔모바일 하트+숫자 수렴 및 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 알려진 위험
- RTDB retained replay window는 기존 Rules 한도에 맞춰 최대 50 unique track이다.
- 매우 오래 오프라인이고 50개를 넘는 서로 다른 승인 변경을 놓친 예외는 별도 recovery 정책 검토 대상이다. 이 예외 때문에 정상 사용자에게 D1 전체 좋아요 조회를 재도입하지 않는다.
- Build의 기존 chunk-size/mixed import 경고는 이번 수정과 무관하며 남아 있다.
- 저장소 branch 보호 API 세부 `enabled=false` 표시는 별도 운영 위험으로 남아 있다.
- 098 자동검증과 실제 PREVIEW 배포는 PASS지만, **실제 PC↔모바일에서 사용자가 재현 시나리오를 통과하기 전에는 실사용 최종 PASS로 판정하지 않는다.**

## 12. 다음 작업
- PREVIEW 098에서 캐시 삭제 없이 PC↔모바일 좋아요 하트+숫자 수렴 실측.
- 특히 PC 여러 곡 확정 후 모바일에서 별도 곡을 변경해도 PC 곡의 숫자 retained row가 보존되는지 확인.
- 변경 없는 Explore 재진입 D1 read 0 및 Firestore Explore-like read/write 0 확인.
- Cloudflare Analytics/D1 수치를 CACHE LIVE와 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.

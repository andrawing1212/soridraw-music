# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **093** — `https://preview.soridraw.com`
- PREVIEW 093 배포 source SHA: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- PREVIEW 093 Release Run: `34957675828` attempt 2 — **PASS**
- PREVIEW 093 좋아요 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- PREVIEW 093 최종 자동검증 Run: `34954374540` — PASS
- 현재 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 product tree: `84d9613f47e12d274df2a263590f29ae713caab4`
- Worker 056 핵심 구현 commit: `87cfb18ed1dd7e1c793550a32c820509ce7ed4a2`
- Worker 056 배포 trigger commit: `674013e78fa88ce48b956ceb8a3a09b8dd008620`
- Worker 056 검증 Run: `34964499103` — **PASS**
- Worker 056 배포 Run: `34964765640` — **PASS**
- Worker 056 실제 live-source 검증 Run: `34965070145` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker deploy Run: `34946799113` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Explore Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Explore Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## 2. Worker 056 — 좋아요 곡 500 / 빈 목록 수정
사용자 실사용에서 공개프로필 `좋아요 곡`이 비어 있고 `/v1/me/liked-tracks`가 500이던 문제를 PREVIEW에서 수정/배포했다.

원인:
- liked-track 상세 조회가 존재하지 않는 `profiles` 테이블을 JOIN하고 있었음.
- 실제 공유 Explore D1의 정상 프로필 테이블은 `public_profiles`.
- 좋아요 관계/하트 상태는 남아 있어도 상세 카드 조회가 500으로 끊겨 좋아요 곡 목록과 숫자 복구가 실패할 수 있었음.

수정:
- `handleMyLikedTracks052`의 `LEFT JOIN profiles ...`를 `LEFT JOIN public_profiles ...`로 변경.
- 기존 좋아요 5초 batch, R2 canonical liked IDs, RTDB 변경 신호, UI/CSS는 변경하지 않음.
- verifier 085/086도 실제 `public_profiles` 계약으로 수정하고 옛 `profiles` JOIN 재발을 금지.

검증:
- TypeScript PASS.
- Build PASS.
- Worker syntax PASS.
- liked-profile 085 PASS.
- liked-sync 086 PASS.
- like cost verifier PASS.
- 실제 PREVIEW D1 schema에서 `public_profiles(uid,nickname,avatar_url)` 존재 확인 PASS.
- 실제 corrected SQL query plan: `tracks.id`, `public_profiles.uid`, `track_stats.track_id` index lookup PASS.
- `SCAN tracks` 없음. 요청된 liked IDs만 PK 기반 조회.
- Live Worker `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` source에서 `public_profiles` JOIN 존재 + 옛 `profiles` JOIN 부재 확인 PASS.
- `preview.soridraw.com` HTTP 200 PASS.
- PREVIEW feed HTTP 200 PASS.
- unauthenticated `/v1/me/liked-tracks` HTTP 401 — route 존재/500 아님 PASS.

배포 영향:
- PREVIEW Explore Worker만 변경.
- Firebase Hosting 변경 없음.
- Firebase Functions 변경 없음.
- Media Worker 변경 없음.
- D1 schema/migration/seed/write 없음.
- 사용자 원본 데이터 변경 없음.
- RTDB 구조/Rules 변경 없음.
- UI/CSS 변경 없음.
- TEST/PRODUCTION Worker 변경 없음.

남은 확인:
- 인증된 실제 사용자 계정의 `좋아요 곡` 카드가 화면에 다시 표시되는지 사용자 실사용 확인 필요.
- PC↔모바일 숫자/하트 최종 수렴도 사용자 실사용 확인 전.

## 3. Catalog 092 — Firestore 전체조회 차단
완료/배포됨.
- 일반 Music Note/Library Catalog GET은 R2 only.
- 새 기기 + 기존 R2 Catalog: R2 1회 수신 → 로컬 cache → 이후 로컬 우선.
- profile revision 불일치가 일반 앱 경로에서 `buildCanonicalCatalog()` Firestore full scan 권한이 되지 않음.
- R2 Catalog가 없으면 일반 GET/delta에서 Firestore collection traversal 금지.
- partial UI list 누락은 삭제로 해석하지 않음. explicit tombstone만 삭제.
- delta conflict/count mismatch도 R2 soft refresh만 수행.
- 앱 업데이트 자체로 전체 Catalog rebuild/cache wipe 금지.
- 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- 검증 Run: `34946586905` — PASS.

실사용 결과:
- 과거 약 618 read처럼 곡 수에 비례하는 대량 Firestore read 폭증은 PREVIEW 092 업데이트 후 재현되지 않음.
- 다음 비용 확인은 Explore 좋아요 093의 Firestore users write/read 제거 효과를 실측한다.

## 4. Explore 좋아요 093 — PREVIEW 배포 완료
목표/구현:
- **D1**: 실제 좋아요 원본/처리 유지.
- **RTDB**: 같은 계정 다른 기기에 작은 변경 신호만 전달.
- Explore 좋아요 동기화 목적 Firestore `users/{uid}` write **0 목표**.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- `src/services/exploreLikeService.ts`: Firestore `exploreLikeSyncSignal` write 제거, `userSync/{uid}/exploreLike` RTDB signal로 교체.
- `src/services/userDomainSyncService.ts`: UID-scoped Explore like RTDB subscriber 추가.
- `src/services/exploreLikeDisplayStateService.ts`: `liked=true + count=0` 모순만 `/v1/me/liked-tracks` targeted batch로 복구. 최대 50곡, cooldown 적용.
- 전체 Feed/Profile 재조회 없음, polling 없음, Firestore collection 조회 없음.
- 실제 canonical count가 0이면 가짜 `0→1` 보정 금지.

RTDB Rules:
- 기존 source의 unsupported `numChildren()` 제거.
- Music Note/Recent Songs rules는 실제 publisher payload(`version`, `at`, `originDeviceId`, `operation`, `affectedCount`, `truncated`, optional `documentIds`)와 정합.
- `documentIds`는 index `0..9`만 허용.
- Explore Like는 `version`, `previousVersion`, `results`, results index `0..49`만 허용.
- 사용자별 `userSync/{uid}` read/write는 같은 인증 uid만 허용.

## 5. PREVIEW 093 배포 결과
사용자 승인 후 GitHub 배포 서비스 계정에 `Firebase Realtime Database Admin` 역할을 추가했고, 기존 실패 Run `34957675828`을 재실행했다.

Run `34957675828` attempt 2 — **PASS**:
- source SHA 고정: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- source contract PASS
- TypeScript PASS
- Build PASS
- Firebase RTDB Emulator Rules compile PASS
- Firebase service account auth PASS
- RTDB OAuth token 발급 PASS
- shared RTDB Rules 배포 PASS
- 원격 RTDB Rules exact-source match PASS
- Firebase PREVIEW Hosting 093 배포 PASS
- 실제 `preview.soridraw.com` exact build 확인 PASS
- 실제 `app-version.json = 093` 확인 PASS
- TEST / PRODUCTION branch + Hosting 비변경 확인 PASS

이전 IAM blocker는 해결됨.

## 6. 실제 변경 여부
- 실제 PREVIEW Hosting: **093 유지 / 이번 056 작업에서 재배포 없음**
- 실제 shared RTDB Rules: **093 유지 / 이번 056 작업에서 변경 없음**
- 실제 PREVIEW Explore Worker: **056 배포 완료**
- TEST code/Hosting: 변경 없음
- PRODUCTION code/Hosting: 변경 없음
- TEST/PRODUCTION Explore Worker: 변경 없음
- Media Worker: 변경 없음
- Firebase Functions: 변경 없음
- Firestore Rules: 변경 없음
- D1 schema/migration/seed: 변경 없음
- 사용자 원본 데이터: 변경 없음
- 사용자 데이터 migration/backfill/delete/overwrite: 없음
- UI/CSS 변경: 없음

## 7. 093 + Worker 056 실사용 비용/정확성 합격선
다음 사용자 검증 항목:
1. 공개프로필 `좋아요 곡` 탭에 실제 좋아요 곡 카드가 다시 표시되는지 확인.
2. PC/모바일 같은 계정에서 좋아요 1개 / 해제 1개.
3. 2~10개 연속 좋아요 후 5초 batch.
4. CACHE LIVE에서 Explore 좋아요발 Firestore `users:write` 증가 없음.
5. Firestore Console에서도 Explore 좋아요 때문에 write/read 연쇄 증가 없음.
6. D1은 기존 batch actual like source 유지.
7. 다른 기기 하트 상태는 RTDB 변경분만 수렴.
8. `빨간 하트 + 0` 모순은 `/v1/me/liked-tracks` targeted recovery 후 실제 숫자로 수렴.
9. 서버 count=0이면 임의 1 표시 금지.
10. Music Note/Recent Songs 기존 RTDB 동기화 회귀 없음.
11. Catalog 새 기기/재진입 Firestore full-scan 재발 없음.

판정:
- 인증된 `/v1/me/liked-tracks`가 다시 500이면 FAIL.
- Explore 좋아요 하나 때문에 Firestore `users` write + listener read가 생기면 FAIL.
- RTDB는 신호용이고 D1 actual like 원본은 유지되어야 함.
- Music Note/Recent Songs RTDB 기존 동기화가 깨지면 TEST 승격 금지.

## 8. TEST / PRODUCTION 승격
- TEST: PREVIEW 093 + Worker 056 비용/정확성 실사용 PASS 전 승격 금지.
- 승격 시 PREVIEW exact tree 전체를 `main`으로 승격. 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 9. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- like display ledger
- 공개/비공개 변경분 처리 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

## 10. 다음 작업
- 사용자 계정으로 PREVIEW 공개프로필 `좋아요 곡`을 즉시 재확인한다.
- 카드가 정상 표시되면 좋아요 숫자, 좋아요/해제, PC↔모바일 수렴, Firestore 0-write 목표를 이어서 실측한다.
- Worker 056은 전체 tracks scan 없이 requested liked IDs만 PK/index 조회하는 현재 구조를 보호한다.
- 모두 PASS 후에만 TEST 승격을 검토한다.

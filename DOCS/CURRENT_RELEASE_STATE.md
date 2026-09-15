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
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- Explore Worker deploy Run: `34937881843` — PASS
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker deploy Run: `34946799113` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 2. Catalog 092 — Firestore 전체조회 차단
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

## 3. Explore 좋아요 093 — PREVIEW 배포 완료
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

## 4. PREVIEW 093 배포 결과
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

## 5. 실제 변경 여부
- 실제 PREVIEW Hosting: **093 배포 완료**
- 실제 shared RTDB Rules: **093 rules 배포 완료**
- TEST code/Hosting: 변경 없음
- PRODUCTION code/Hosting: 변경 없음
- Explore Worker: 변경 없음
- Media Worker: 변경 없음
- Firebase Functions: 변경 없음
- Firestore Rules: 변경 없음
- D1 schema/migration/seed: 변경 없음
- 사용자 원본 데이터: 변경 없음
- 사용자 데이터 migration/backfill/delete/overwrite: 없음
- UI/CSS 변경: 없음

## 6. 093 실사용 비용/정확성 합격선
다음 사용자 검증 항목:
1. PC/모바일 같은 계정에서 좋아요 1개 / 해제 1개.
2. 2~10개 연속 좋아요 후 5초 batch.
3. CACHE LIVE에서 Explore 좋아요발 Firestore `users:write` 증가 없음.
4. Firestore Console에서도 Explore 좋아요 때문에 write/read 연쇄 증가 없음.
5. D1은 기존 batch actual like source 유지.
6. 다른 기기 하트 상태는 RTDB 변경분만 수렴.
7. `[Teen Pop] 루프탑 아래서 | Drive This Fear Away` 같은 `빨간 하트 + 0` 모순은 해당 곡 targeted recovery로 실제 숫자 수렴.
8. 서버 count=0이면 임의 1 표시 금지.
9. Music Note/Recent Songs 기존 RTDB 동기화 회귀 없음.
10. Catalog 새 기기/재진입 Firestore full-scan 재발 없음.

판정:
- Explore 좋아요 하나 때문에 Firestore `users` write + listener read가 생기면 FAIL.
- RTDB는 신호용이고 D1 actual like 원본은 유지되어야 함.
- Music Note/Recent Songs RTDB 기존 동기화가 깨지면 TEST 승격 금지.

## 7. TEST / PRODUCTION 승격
- TEST: PREVIEW 093 비용/정확성 실사용 PASS 전 승격 금지.
- 승격 시 PREVIEW exact tree 전체를 `main`으로 승격. 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 8. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- like display ledger
- 공개/비공개 변경분 처리 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터

## 9. 다음 작업
- PREVIEW 093에서 Explore 좋아요 비용/정확성을 실제 사용으로 검증한다.
- 특히 Firestore `users:write` 및 listener read 연쇄 증가가 0인지 확인한다.
- PC↔모바일 변경분 동기화, liked+0 targeted recovery, 기존 Music Note/Recent Songs RTDB 회귀 여부를 확인한다.
- 모두 PASS 후에만 TEST 승격을 검토한다.

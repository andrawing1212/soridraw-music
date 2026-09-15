# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **092** — `https://preview.soridraw.com`
- PREVIEW 앱 배포 SHA: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- PREVIEW App Run: `34948206737` — **PASS**
- 실제 PREVIEW Explore Worker: **055** / `7191acce-fb21-48d6-867f-f237b1f32979`
- Explore 055 제품 commit: `2a4d7ec35e82448b60d1c5edffa106082017c210`
- Explore 055 배포 Run: `34937881843` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- Media Worker 배포 Run: `34946799113` — **PASS**
- Catalog full-scan 차단 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- Catalog 수정 검증 Run: `34946586905` — **PASS**
- Explore 좋아요 Firestore 신호 제거 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- RTDB live payload rules 정합 수정: `f0d54cdff0dab2514c8c3afacba2608e505fee48`
- 093 verifier 정합 수정: `3c9f5e00331ed08ae6fc2873a7e49646ebbdf89d`
- 093 최종 검증 workflow commit: `3ab57b90a09bb9dfbc3621d6170308c77be04311`
- 093 최종 검증 Run: `34954374540` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## 2. 앱 092 — Catalog Firestore 전체조회 차단
문제:
- 새 기기/오래된 로컬 Catalog에서 profile revision이 R2보다 앞서면 과거 경로가 Worker `buildCanonicalCatalog()`를 호출해 Music Note `favorites` 전체 + Library `suno_tracks/{uid}/tracks` 전체를 Firestore REST로 다시 읽을 위험이 있었음.

현재 배포 구조:
- 일반 Music Note/Library Catalog GET은 **R2 only**.
- profile revision은 invalidation hint이며 일반 앱 경로에서 hard revision rebuild를 요구하지 않음.
- R2 Catalog가 없으면 일반 GET/delta 경로에서 Firestore collection traversal 금지.
- 새 기기 + 기존 R2 Catalog: R2 Catalog 1회 수신 → 로컬 cache 저장 → 이후 로컬 우선.
- R2 자체가 없는 예외 계정: 자동 전체 스캔 금지. bounded legacy 1문서 fallback만 허용.
- partial UI list 누락은 삭제로 해석하지 않고 explicit tombstone만 삭제 권한을 가짐.
- delta conflict/count mismatch도 R2 soft refresh만 수행.
- local newer revision을 old R2 응답으로 덮어쓰지 않음.

검증:
- Run `34946586905`: TypeScript PASS / Build PASS / Media Worker syntax PASS / Catalog full-scan 차단 verifier PASS / diff check PASS.

## 3. PREVIEW 배포 092
### Firebase PREVIEW Hosting
- Run `34948206737` — **PASS**
- locked source: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- TypeScript PASS / Build PASS / Firebase Hosting PASS
- 실제 `preview.soridraw.com` build 일치 PASS
- 실제 `app-version.json` = **092** PASS
- TEST/PRODUCTION 비변경 PASS

### PREVIEW Media Worker
- Run `34946799113` — **PASS**
- Current Version ID: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- R2 smoke / health / CORS PASS
- TEST/PRODUCTION Media Worker 비변경.

## 4. Explore 좋아요 093 후보 — 아직 미배포
사용자 실측에서 앱 업데이트 + PC/모바일 확인 중 Firestore 사용량이 증가했고, 영상 진단에서 Explore 좋아요 batch 뒤 `users:write`와 `users:onSnapshot`이 연결되는 구조를 확인했다.

### 목표 구조
- **D1**: 실제 좋아요 원본/처리 유지.
- **RTDB**: 같은 계정 다른 기기에 “좋아요 변경됨”을 전달하는 작은 신호만 담당.
- **Firestore**: Explore 좋아요 동기화 신호 write **0 목표**.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- UI 즉시 반응은 로컬 유지.

### 구현
- `src/services/exploreLikeService.ts`
  - `users/{uid}.exploreLikeSyncSignal` Firestore `updateDoc()` 제거.
  - 성공한 좋아요 batch 뒤 `userSync/{uid}/exploreLike` RTDB 신호만 기록.
  - D1/R2 canonical 역할은 그대로 유지.
- `src/services/userDomainSyncService.ts`
  - UID-scoped `exploreLike` RTDB subscriber 추가.
  - 다른 기기는 신호의 변경 항목만 기존 account-like cache/display state에 반영.
- `src/services/exploreLikeDisplayStateService.ts`
  - `liked=true`인데 표시 숫자가 `0`인 모순 상태만 `/v1/me/liked-tracks`로 targeted batch 확인.
  - 최대 50곡, 곡별 12분 재조회 cooldown, 실패 1분 cooldown.
  - 전체 Feed/Profile 재조회 없음, polling 없음, Firestore collection 조회 없음.
  - 서버 canonical count가 실제 0이면 **0→1 가짜 보정 금지**.

### RTDB Rules 안전 수정
첫 검증 과정에서 기존 `database.rules.json`의 `numChildren()`가 RTDB emulator에서 지원되지 않는 것을 발견했다.
또한 초기 compile-safe 수정이 기존 Music Note/Recent Songs 실제 publisher payload와 다른 필드(`previousVersion/sourceId`)를 요구하는 문제를 발견해 배포 전에 바로잡았다.

현재 rules source:
- Music Note / Recent Songs: 실제 publisher의 `version`, `at`, `originDeviceId`, `operation`, `affectedCount`, `truncated`, optional `documentIds`와 일치.
- `documentIds`는 index `0..9`만 허용해 최대 10개를 유지.
- Explore Like는 `version`, `previousVersion`, `results`만 허용하고 results index `0..49`로 최대 50개 제한.
- destructive data/schema migration 없음.

### 최종 자동검증
Run `34954374540` — **PASS**:
- source contract PASS
- TypeScript PASS
- Build PASS
- Java 21 setup PASS
- RTDB Database Emulator rules compile PASS
- no source side effects PASS
- NO DEPLOY
- NO Worker change
- NO Functions change
- NO Firestore Rules change
- NO D1 schema change
- NO user data change

## 5. 사용자 데이터 / 백엔드 변경 여부
현재 093 후보는 **source 반영 완료 / 배포 전**.
- 사용자 원본 데이터 변경: **없음**
- Firestore schema 변경: **없음**
- D1 schema/migration/seed 변경: **없음**
- Firebase Functions 변경: **없음**
- Cloudflare Worker 변경: **없음**
- UI/CSS 변경: **없음**
- RTDB rules source 변경: **있음, 아직 실제 PREVIEW rules 배포 전**
- TEST/PRODUCTION 변경: **없음**

## 6. 비용 합격선 — 다음 PREVIEW 배포 후 실측
Catalog 092 대량 전체조회는 현재 실측상 618 read 폭증이 재발하지 않았고, 다음에는 093 좋아요 비용을 분리 확인한다.

필수 확인:
1. PREVIEW 093 후보 앱 + RTDB Rules 배포.
2. PC와 모바일 같은 계정 로그인 후 안정 상태 확인.
3. 좋아요 1개 / 좋아요 해제 1개 / 2~10개 연속 클릭.
4. CACHE LIVE에서 Explore 좋아요 때문에 `users:write`가 증가하지 않는지.
5. Firestore Console에서 좋아요 batch 때문에 Firestore write/read가 연쇄 증가하지 않는지.
6. D1은 기존 5초 batch 처리 유지, 즉시 click별 요청 금지.
7. 다른 기기에서 하트 상태가 변경분만 수렴하는지.
8. `[Teen Pop] 루프탑 아래서 | Drive This Fear Away`와 같은 `빨간 하트 + 0` 모순이 targeted recovery 뒤 실제 canonical 숫자로 수렴하는지.
9. 서버 실제 count가 0인 경우 임의 1 표시가 생기지 않는지.
10. Music Note/Recent Songs RTDB 기존 동기화가 rules 변경 뒤 정상 유지되는지.

판정:
- Explore 좋아요 하나 때문에 Firestore `users` write + listener read가 생기면 FAIL.
- RTDB는 신호용이고 D1 좋아요 원본은 그대로 유지되어야 함.
- RTDB rules 때문에 기존 Music Note/Recent Songs 동기화가 깨지면 즉시 롤백/수정 후 TEST 승격 금지.

## 7. TEST / PRODUCTION 상태
- TEST와 PRODUCTION은 아직 Catalog 092 및 Explore 093 후보 구조로 승격하지 않음.
- PREVIEW 실사용 정확성 + 비용 PASS 후 exact tree 전체를 TEST로 승격 검토.
- 사용자 데이터는 복사/이동하지 않음.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.

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
- 사용자 배포 승인 전에는 093 후보를 실제 PREVIEW에 배포하지 않는다.
- 다음 PREVIEW 배포 시 **앱 + Firebase Realtime Database Rules**를 같은 고정 source로 적용한다.
- 배포 후 좋아요 Firestore R/W 0 목표, PC↔모바일 변경분 동기화, liked+0 targeted recovery를 실제 수치로 검증한다.
- PREVIEW 안정화 후 TEST 승격을 검토한다.

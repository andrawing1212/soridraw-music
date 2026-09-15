# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 PREVIEW source 후보 앱 버전: **093**
- 실제 배포된 PREVIEW 앱: **092** — `https://preview.soridraw.com`
- 실제 PREVIEW 092 배포 SHA: `db4fda7c6ecaf7e8df22625bfc93f85263f38c19`
- PREVIEW 092 App Run: `34948206737` — PASS
- PREVIEW 093 좋아요 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- PREVIEW 093 최종 자동검증 Run: `34954374540` — PASS
- PREVIEW 093 마지막 배포 시도 trigger SHA: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
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
- 다만 PC/모바일/Explore 좋아요 확인 과정에서 소량 Firestore read/write가 남아 Explore 좋아요 동기화 경로를 별도 수정 중.

## 3. Explore 좋아요 093 — source 완료 / 배포 차단 상태
사용자 실측에서 Explore 좋아요 batch 뒤 Firestore `users/{uid}` sync signal write와 `users:onSnapshot` read가 연쇄 발생하는 구조를 확인함.

093 목표/구현:
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

최종 source 자동검증 Run `34954374540` — PASS:
- source contract PASS
- TypeScript PASS
- Build PASS
- Java 21 PASS
- Firebase RTDB Emulator rules compile PASS
- no source side effects PASS

## 4. PREVIEW 093 배포 시도 결과 — 현재 BLOCKED
사용자가 2026-09-15 PREVIEW 배포를 승인함.
배포 원칙상 **앱 + 공유 RTDB Rules를 같은 릴리스로 적용**하도록 구성했고, Rules 실패 시 Hosting을 진행하지 않는 fail-closed 구조로 실행함.

### 배포 시도 1
- Run `34956697699`
- TypeScript / Build / RTDB Emulator compile PASS.
- Firebase CLI `--only database --project soridraw-app-866a5` 단계에서 RTDB instance details 조회 권한 실패.
- PREVIEW Hosting은 의도적으로 SKIPPED.

### 배포 시도 2
- Run `34957087819`
- GitHub auth action에서 access token 생성을 시도했으나 IAM Service Account Credentials API 비활성으로 token-format 경로 실패.
- PREVIEW Hosting SKIPPED.

### 배포 시도 3
- Run `34957348523`
- 서비스 계정 key로 RTDB OAuth token 로컬 발급 PASS.
- 공식 RTDB `/.settings/rules.json` REST GET이 HTTP 401 Permission denied.
- PREVIEW Hosting SKIPPED.

### 배포 시도 4
- Run `34957675828`
- source contract PASS / TypeScript PASS / Build PASS / RTDB Emulator compile PASS / OAuth token local mint PASS.
- 공식 RTDB Rules REST의 `?access_token=` 방식도 `HTTP 401 Permission denied`.
- PREVIEW Hosting SKIPPED.

판정:
- 인증 토큰 생성 방식 문제가 아니라 GitHub 배포 서비스 계정의 **Realtime Database IAM 권한 부족**으로 확정.
- Firebase 공식 IAM 기준 Rules 수정에는 `firebasedatabase.instances.update` 권한이 필요하며, 최소 목적 역할은 `Firebase Realtime Database Admin (roles/firebasedatabase.admin)`.
- 현재 GitHub 배포 서비스 계정은 Firestore/Hosting 관련 배포는 가능하지만 shared project `soridraw-app-866a5`의 RTDB Rules read/update 권한이 없음.
- 권한이 보강되기 전 앱 093만 단독 배포하면 cross-device RTDB signal이 rules에서 거부될 수 있으므로 **반쪽 배포 금지** 원칙에 따라 PREVIEW 실제 앱은 092로 유지.

## 5. 실제 변경 여부
- 실제 PREVIEW Hosting: **092 유지 / 093 미배포**
- 실제 RTDB Rules: **093 source 미배포**
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

## 6. 배포 재개 조건
shared Firebase project `soridraw-app-866a5`에서 GitHub 배포 서비스 계정에 다음 역할 추가 필요:
- `Firebase Realtime Database Admin` (`roles/firebasedatabase.admin`)

권한 추가 후:
1. PREVIEW 093 release workflow 재실행.
2. source contract / TypeScript / Build / RTDB Emulator compile 재확인.
3. shared RTDB Rules exact-source 배포 + 원격 rules exact match 확인.
4. Firebase PREVIEW Hosting 093 배포.
5. 실제 `preview.soridraw.com` exact build + `app-version.json=093` 확인.
6. TEST/PRODUCTION branch/Hosting 비변경 확인.

## 7. 093 배포 후 실사용 비용/정확성 합격선
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

## 8. TEST / PRODUCTION 승격
- TEST: PREVIEW 093 실제 배포 + 위 비용/정확성 실사용 PASS 전 승격 금지.
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
- 우선 RTDB IAM 권한 1건을 해결한다.
- 권한 해결 전 093 Hosting 단독 배포 금지.
- 권한 해결 즉시 동일 source로 PREVIEW 093 앱 + shared RTDB Rules를 배포하고 실제 비용 검증으로 이어간다.

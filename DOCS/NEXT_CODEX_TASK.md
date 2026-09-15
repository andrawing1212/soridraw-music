# NEXT CODEX TASK

상태: **PREVIEW 실제 앱 092 유지 / 093 source 자동검증 PASS / RTDB IAM 권한 부족으로 실제 배포 차단 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **092**
- PREVIEW 092 App Run: `34948206737` — PASS
- PREVIEW 093 source: `public/app-version.json = 093`
- Explore 좋아요 RTDB 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- 최종 093 validation Run: `34954374540` — PASS
- 마지막 093 release attempt Run: `34957675828` — FAIL at shared RTDB Rules IAM
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 093 보호 기준
- D1 = 실제 Explore 좋아요 원본/처리.
- RTDB = 같은 계정 다른 기기의 작은 좋아요 변경 신호.
- Explore 좋아요 동기화 목적 Firestore `users/{uid}` write = 0 목표.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- `liked=true + count=0` 모순만 `/v1/me/liked-tracks` targeted batch 확인.
- 전체 Feed/Profile scan 없음, polling 없음, Firestore collection 조회 없음.
- canonical count=0이면 가짜 `0→1` 금지.
- Catalog 092 no-fullscan 구조 보호.

## 현재 배포 blocker
PREVIEW 093 release workflow는 앱보다 RTDB Rules를 먼저 배포하고, Rules 실패 시 Hosting을 중단한다.

실패 확인:
- Run `34956697699`: Firebase CLI가 RTDB instance details 권한 부족으로 실패.
- Run `34957087819`: IAM Credentials API 기반 token-format 경로 사용 불가.
- Run `34957348523`: 로컬 OAuth token 발급 PASS, RTDB rules REST 401.
- Run `34957675828`: 로컬 OAuth token PASS, 공식 `?access_token=` rules REST도 `HTTP 401 Permission denied`.

결론:
- token 방식 문제가 아니라 shared project `soridraw-app-866a5`에서 GitHub 배포 서비스 계정의 RTDB IAM 권한 부족.
- 필요한 최소 목적 역할: `Firebase Realtime Database Admin` (`roles/firebasedatabase.admin`).
- 이 역할은 `firebasedatabase.instances.update`를 포함하며 기존 DB rules 조회/수정 권한을 제공.

## 다음 작업
사용자가 IAM 역할을 추가한 뒤 바로:
1. PREVIEW 093 release workflow 재실행.
2. source contract / TypeScript / Build / RTDB Emulator compile PASS 확인.
3. shared RTDB Rules exact-source 배포 및 remote exact match 확인.
4. PREVIEW Hosting 093 배포.
5. `preview.soridraw.com` exact build + version 093 확인.
6. TEST/PRODUCTION branch + Hosting 비변경 확인.
7. 사용자 PC/모바일 좋아요 비용/정확성 실측.

## 배포 후 합격선
- 좋아요/해제 때문에 Firestore `users:write`가 발생하지 않음.
- Firestore listener read 연쇄 증가 없음.
- D1 actual like 처리 유지.
- RTDB 신호로 다른 기기 변경분 수렴.
- `빨간 하트 + 0`은 targeted recovery로 실제 count 수렴.
- 서버 count=0이면 임의 1 금지.
- Music Note/Recent Songs RTDB 회귀 없음.
- Catalog full Firestore scan 재발 없음.

## 금지
- RTDB Rules 없이 093 Hosting만 단독 배포
- 사용자 데이터 migration/backfill/delete/overwrite
- Firestore/D1 destructive schema change
- 전체 Feed/Profile scan
- 클릭별 서버 요청
- UI/CSS 비요청 변경
- TEST/PRODUCTION 승격

## 승격
- TEST: PREVIEW 093 실제 배포 + 비용/정확성 실사용 PASS 전 금지.
- TEST 승격 시 PREVIEW exact tree 전체를 main으로 승격하고 사용자 데이터는 복사하지 않는다.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.

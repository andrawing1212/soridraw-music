# SORIDRAW Vercel → Firebase Hosting 전환 트래커

기준일: 2026-08-29
작업 기준 브랜치: `preview`
현재 preview HEAD 기준: `919fc378ad6302b26407cad1d3652bcdfc7fe797`

## 목표

Vercel 의존을 제거하고 SORIDRAW 웹앱 배포를 Firebase Hosting 중심으로 단순화한다.

최종 구조:
- `preview` 브랜치 → Firebase Hosting Preview Channel
- `main` 브랜치 → Firebase 별도 테스트 Hosting site
- 명시적 정식배포 승인 → 기존 `https://soridraw.web.app/`
- Cloudflare Worker/API → 기존 GitHub 자동배포 유지
- Auth / Firestore / Functions / Rules / 데이터 구조 → 이번 마이그레이션에서 변경하지 않음

## 절대 안전 규칙

- Firebase 정식앱 `soridraw.web.app`에는 사용자의 명시적 `정식배포` 승인 전 배포 금지.
- Firestore/Auth/Functions/Rules/저장 구조는 이번 전환 작업에서 변경 금지.
- 새 Firebase Hosting 주소마다 Auth Authorized Domains / App Check(reCAPTCHA Enterprise) / 환경변수 / Functions 호출 정상 여부를 확인.
- 테스트 Hosting은 기존 Firebase 백엔드를 그대로 사용하는 현재 Vercel 테스트앱 동작과 호환되도록 구성.
- 기존 Vercel 프로젝트는 즉시 삭제하지 않고 자동배포만 중지하여 롤백 수단을 남긴다.
- Cloudflare Worker `soridraw-explore-api` Git 자동배포 구조는 유지한다.

## 현재 확인된 코드 상태

- Firebase 프로젝트 ID: `soridraw-app-866a5`
- 기존 정식 Hosting: `soridraw.web.app`
- `firebase.json`은 현재 단일 Hosting 설정(`dist`, SPA rewrite)을 사용.
- `.firebaserc`는 저장소에 현재 없음. 따라서 실제 Hosting target/site ID는 추측하지 않고 Firebase에서 확인 후 기록한다.
- `src/firebase.js`는 현재 Vercel preview/test hostname과 기존 Firebase production hostname만 App Check 대상 호스트로 인식한다. 새 Firebase preview/test hostname 추가가 필요하다.
- Vercel `vercel.json`에는 현재 Cloudflare-only 커밋 skip용 ignoreCommand가 있다.

## 진행 단계

### Phase 0 — 기준 고정 / 기록
- [x] preview 최신 기준 확인
- [x] Firebase/Vercel 관련 저장소 설정 확인
- [x] 본 마이그레이션 트래커 생성
- [ ] Firebase 실제 Hosting site 목록/프로젝트 연결 상태 확인

### Phase 1 — Firebase 배포 골격 준비 (정식앱 무변경)
- [ ] 기존 production Hosting site ID 정확히 확인
- [ ] 테스트용 Firebase Hosting site 신규 생성 또는 기존 사용 가능 site 확인
- [ ] `preview`, `test`, `production` deploy target 설계
- [ ] `.firebaserc` / `firebase.json`을 target 기반으로 안전하게 구성
- [ ] GitHub Actions/배포 스크립트 초안 구성
- [ ] 로컬/CI build만 검증, Hosting 실제 배포는 아직 하지 않음

승인 게이트: Phase 1 완료 보고 후 Firebase Preview 실제 배포 승인 받기.

### Phase 2 — preview → Firebase Preview Channel 전환
- [ ] `src/firebase.js`에 Firebase preview/test hostname App Check 인식 추가
- [ ] preview channel 생성/배포
- [ ] 생성된 preview URL 기록
- [ ] Auth Authorized Domain 확인/추가
- [ ] reCAPTCHA Enterprise / App Check 도메인 확인
- [ ] Google 로그인 / Firestore 읽기 / Functions / Explore Worker / D1-R2 연동 확인
- [ ] 기존 사용자 데이터 저장 구조 무변경 확인

승인 게이트: Preview 실사용 확인 후 main 테스트 Hosting 전환 승인 받기.

### Phase 3 — main → Firebase 테스트앱 전환
- [ ] 검증된 preview 내용을 main에 반영
- [ ] main 전용 Firebase 테스트 Hosting site에 배포
- [ ] 테스트앱 URL 확정/기록
- [ ] Auth/App Check/Firestore/Functions/Cloudflare 통합 확인
- [ ] `배포/테스트배포` 의미를 Firebase 테스트 Hosting 기준으로 전환

승인 게이트: 테스트앱 검증 후 Vercel 자동배포 중지 승인 받기.

### Phase 4 — Vercel 자동배포 중지 / 롤백 보존
- [ ] `soridraw-music` Vercel Git 자동배포 중지
- [ ] Vercel 프로젝트/기존 READY deployment는 즉시 삭제하지 않음
- [ ] Firebase preview/test 주소가 완전히 대체 가능한지 재확인
- [ ] Vercel 제거 후 GitHub push가 불필요한 Vercel deployment를 만들지 않는지 확인

### Phase 5 — 정식배포 경로 고정 (실제 정식배포 금지)
- [ ] production target이 기존 `soridraw.web.app`만 가리키는지 확인
- [ ] `정식배포` 명령만 production Hosting을 갱신하도록 보호
- [ ] Functions/Rules/Firestore가 Hosting 배포에 섞이지 않도록 `--only hosting:<target>` 사용
- [ ] 정식배포 명령 및 롤백 절차 문서화
- [ ] 실제 Firebase 정식배포는 사용자 별도 승인 전까지 실행하지 않음

### Phase 6 — 마이그레이션 완료 / 8-E 복귀
- [ ] preview/test 배포 모두 정상
- [ ] Vercel 자동배포 중지 확인
- [ ] Firebase 설정 안전점검 완료
- [ ] 이 문서의 최종 SHA/주소/상태 업데이트
- [ ] 기존 8-E 작업(CACHE LIVE 모바일 축소 및 Explore/Public Profile 후속)으로 복귀

## 새 채팅 인계 기준

새 채팅에서 반드시 이 파일을 먼저 읽고 `preview` 브랜치 최신 HEAD를 확인한다.
완료된 Phase는 다시 실행하지 않는다.
`현재 단계`의 미완료 체크박스부터 이어간다.
정식앱은 사용자가 명확히 `정식배포`라고 승인하기 전 절대 배포하지 않는다.

## 현재 단계

**Phase 0 완료 직전 / Phase 1 사용자 승인 대기**

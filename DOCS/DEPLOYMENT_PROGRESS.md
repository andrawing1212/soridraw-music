# SORIDRAW Hosting Migration Progress

## 전체 목표
Vercel 정상 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현하고, Preview/Test/Production을 동일한 단순 배포 구조로 통일한다.

## 현재 진척도
- 현재 단계: **2/7 Vercel ↔ Firebase 기능 1:1 복구 — COMPLETE**
- 2단계 진척도: **100%**
- 전체 7단계 진척도: **2/7 완료 (약 29%)**
- 다음 단계: **3/7 뮤직노트·라이브러리 페이지네이션 정상화**

## 단계별 상태
| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | Preview 빌드·배포 구조 단순화 | **COMPLETE** |
| 2 | Vercel ↔ Firebase 기능 1:1 복구 | **COMPLETE** |
| 3 | 뮤직노트·라이브러리 페이지네이션 정상화 | **NEXT** |
| 4 | Firebase 테스트 환경 구조 통일 | 대기 |
| 5 | Auth / App Check / CORS 주소 최종 정리 | 일부 완료 / 대기 |
| 6 | 정식 Firebase 배포 구조 통일 | 대기 |
| 7 | Vercel 제거 여부 결정 | 대기 |

## 1단계 완료 내용
- `DOCS/WORKFLOW_GUARDRAILS.md` + 루트 `AGENTS.md`로 고정 지침 저장
- legacy 빌드 전 Python 소스변형 체인 확인
- legacy 패치를 1회 실행해 실제 배포용 frontend `src/**` 34개 파일을 실제 소스로 동결
- `predev`, `prebuild`, `prelint` 자동 소스변형 lifecycle 제거
- TypeScript 검사 PASS
- 자동 소스변형 없는 Vite build PASS
- 2회 연속 build 후 소스 추가 변형 없음 PASS
- legacy 생성 `src/**` ↔ 동결 `src/**` 완전 동일 PASS
- legacy `dist` ↔ 동결 `dist` 바이트 단위 완전 동일 PASS
- Firebase Preview Hosting build/typecheck/deploy/smoke PASS
- Auth preview host 등록 PASS
- backend origin boundary 진단 PASS
- 정식 Firebase Hosting 불변 확인 PASS
- Functions 생성 변경은 이번 단계에서 의도적으로 제외, Functions/Rules/Firestore 배포 없음

## 2단계 완료 내용
- Firebase Preview custom/site의 실제 JS/CSS가 현재 동결 소스 build와 바이트 단위 동일함을 확인
- Vercel runtime 기준은 1단계의 `Vercel READY -> docs-only commit -> legacy dist == frozen dist` 검증으로 고정
- Vercel Preview Origin / Firebase Preview Origin 모두 Functions CORS PASS
- Vercel Preview Origin / Firebase Preview Origin 모두 Explore Cloudflare Worker CORS PASS
- Firebase Auth authorized domains에 Vercel Preview와 Firebase Preview 주소가 모두 등록되어 있음 확인
- Firebase Preview에서 실제 `Google로 계속하기` 클릭 후 `accounts.google.com` 팝업 시작 PASS
- 실제 Google OAuth redirect handler는 기존 backend Auth 프로젝트 `soridraw-app-866a5.firebaseapp.com/__/auth/handler` 사용 확인
- `src/constants/emailVerification.ts`에 Firebase Preview 반환 주소 3개 추가
  - `https://preview.soridraw.com`
  - `https://soridraw-preview.web.app`
  - `https://soridraw-preview.firebaseapp.com`
- 이메일 인증 반환 주소 수정 후 TypeScript/build PASS
- 수정본 Firebase Preview Hosting 실제 배포/smoke/backend boundary/정식앱 불변 확인 PASS
- Firestore/Rules/Functions/사용자 데이터 변경 없음
- `src/data/v2PreviewShadowMirror.ts`의 Vercel Preview 전용 Backend V2 shadow 경로는 실험/진단 범위이므로 Hosting 이관과 섞지 않고 그대로 유지

## 현재 배포 기준
프론트 Preview는 더 이상 `predev/prebuild/prelint` Python 체인으로 `src/**`를 재작성하지 않는다.

`실제 소스 -> TypeScript 검사 -> Vite build -> Firebase Preview Hosting -> smoke test`

## 다음 작업
3단계에서는 Hosting/Auth 구조를 더 변경하지 않고 뮤직노트와 라이브러리의 페이지네이션만 분리해서 정상화한다.
- 뮤직노트: 캐시 표시와 서버 페이지 체인이 충돌해 전체 수/연속 목록이 깨지는 문제를 하나의 읽기 경로로 정리
- 라이브러리: 서버에 다음 데이터가 있어도 `hasMore=false`가 되어 더보기 버튼이 사라지는 문제 수정
- 기존 사용자 데이터 삭제/덮어쓰기/백필 없이 호환성 우선
- Explore는 정상 상태이므로 건드리지 않음

## 배포 상태
- Firebase Preview: **2단계 수정본 배포 성공** — https://preview.soridraw.com/
- Vercel Preview: 비교 기준 유지 — https://soridraw-music-git-preview-andrawing1212.vercel.app/
- Test(main): 변경 없음
- Production(Firebase): 변경 없음 — https://soridraw.web.app/

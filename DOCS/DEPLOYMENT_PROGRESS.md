# SORIDRAW Hosting Migration Progress

## 전체 목표
Vercel 정상 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현하고, Preview/Test/Production을 동일한 단순 배포 구조로 통일한다.

## 현재 진척도
- 현재 단계: **1/7 Preview 빌드·배포 구조 단순화 — COMPLETE**
- 1단계 진척도: **100%**
- 전체 7단계 진척도: **1/7 완료 (약 14%)**
- 다음 단계: **2/7 Vercel ↔ Firebase 기능 1:1 복구**

## 단계별 상태
| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | Preview 빌드·배포 구조 단순화 | **COMPLETE** |
| 2 | Vercel ↔ Firebase 기능 1:1 복구 | 다음 작업 |
| 3 | 뮤직노트·라이브러리 페이지네이션 정상화 | 원인 확인 / 대기 |
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

## 현재 배포 기준
프론트 Preview는 더 이상 `predev/prebuild/prelint` Python 체인으로 `src/**`를 재작성하지 않는다.

`실제 소스 -> TypeScript 검사 -> Vite build -> Firebase Preview Hosting -> smoke test`

## 다음 작업
2단계에서는 새 설계를 추가하지 않고 Vercel 기준 앱과 Firebase Preview의 실제 기능 차이만 1:1로 확인·복구한다. 뮤직노트/라이브러리 페이지네이션 수정은 3단계에서 별도로 처리한다.

## 배포 상태
- Firebase Preview: **배포 성공** — https://preview.soridraw.com/
- Vercel Preview: 비교 기준 유지 — https://soridraw-music-git-preview-andrawing1212.vercel.app/
- Test(main): 변경 없음
- Production(Firebase): 변경 없음 — https://soridraw.web.app/

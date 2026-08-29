# SORIDRAW Hosting Migration Progress

## 전체 목표
Vercel 정상 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현하고, Preview/Test/Production을 동일한 단순 배포 구조로 통일한다.

## 현재 진척도
- 현재 단계: **1/7 Preview 빌드·배포 구조 단순화**
- 단계 진척도: **90%**
- 상태: 검증 완료 / preview 반영·실제 Hosting 배포 확인 전

## 단계별 상태
| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | Preview 빌드·배포 구조 단순화 | 90% / 최종 반영 전 |
| 2 | Vercel ↔ Firebase 기능 1:1 복구 | 대기 |
| 3 | 뮤직노트·라이브러리 페이지네이션 정상화 | 원인 확인 / 대기 |
| 4 | Firebase 테스트 환경 구조 통일 | 대기 |
| 5 | Auth / App Check / CORS 주소 최종 정리 | 일부 완료 / 대기 |
| 6 | 정식 Firebase 배포 구조 통일 | 대기 |
| 7 | Vercel 제거 여부 결정 | 대기 |

## 1단계 완료된 검증
- `DOCS/WORKFLOW_GUARDRAILS.md` + 루트 `AGENTS.md`로 고정 지침 저장
- 빌드 전 Python 소스변형 체인 확인
- legacy 패치를 1회 실행해 실제 배포용 frontend `src/**` 34개 파일을 실제 소스로 동결
- `predev`, `prebuild`, `prelint` 자동 소스변형 lifecycle 제거
- TypeScript 검사 PASS
- 자동 소스변형 없는 Vite build PASS
- 2회 연속 build 후 소스 추가 변형 없음 PASS
- legacy 생성 `src/**` ↔ 동결 `src/**` 완전 동일 PASS
- legacy `dist` ↔ 동결 `dist` 바이트 단위 완전 동일 PASS
- Functions 생성 변경은 이번 단계에서 의도적으로 제외, Functions 배포 없음

## 다음 작업
검증된 동결 트리를 `preview`에 fast-forward 반영한 뒤 Firebase Preview Hosting 빌드/배포/smoke test를 확인한다.

## 배포 상태
- Preview: 기존 상태 유지 / 최종 동결 트리 반영 직전
- Test(main): 변경 없음
- Production(Firebase): 변경 없음

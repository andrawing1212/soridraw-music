# SORIDRAW Hosting Migration Progress

## 전체 목표
Vercel 정상 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현하고, Preview/Test/Production을 동일한 단순 배포 구조로 통일한다.

## 현재 진척도
- 현재 단계: **1/7 Preview 빌드·배포 구조 단순화**
- 단계 진척도: **20%**
- 상태: 진행 중

## 단계별 상태
| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | Preview 빌드·배포 구조 단순화 | 진행 중 |
| 2 | Vercel ↔ Firebase 기능 1:1 복구 | 대기 |
| 3 | 뮤직노트·라이브러리 페이지네이션 정상화 | 원인 확인 / 대기 |
| 4 | Firebase 테스트 환경 구조 통일 | 대기 |
| 5 | Auth / App Check / CORS 주소 최종 정리 | 일부 완료 / 대기 |
| 6 | 정식 Firebase 배포 구조 통일 | 대기 |
| 7 | Vercel 제거 여부 결정 | 대기 |

## 이번 작업 기록
- `DOCS/WORKFLOW_GUARDRAILS.md` 추가
- `AGENTS.md` 추가
- package.json에서 빌드 전 수십 개 Python 소스변형 체인 확인
- 다음: 기존 패치 체인을 1회 적용한 최종 소스를 실제 소스로 고정하고 자동 소스변형 제거 검증

## 배포 상태
- Preview: 기존 상태 유지 / 1단계 정리본 미배포
- Test(main): 변경 없음
- Production(Firebase): 변경 없음

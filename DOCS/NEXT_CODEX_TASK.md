# NEXT CODEX TASK

상태: **현재 신규 Codex 구현 작업 없음**

## 현재 기준
- branch: `preview`
- 앱 버전: `052`
- Explore/Public Profile 032 제품 코드 기준: `6bd01324493c7c3d048aed825c5b8604f755d2cf`
- PREVIEW Explore Worker: 032 배포 완료, warm `/feed-revision` D1 read/write 0 smoke PASS
- shared D1 additive derived schema/seed: 적용 완료
- Firebase PREVIEW 앱 최종 032 반영: 아직 안 함
- 현재 작업: 배포 시스템 정상화

## 지금 하지 않는 것
- 새 기능 구현
- Music Note/Library 구조 변경
- UI 변경
- 추가 D1 migration/seed
- main/production 승격
- 배포 Workflow 일회성 추가

## 다음 Codex 작업 생성 조건
사용자가 새 기능/버그/비용 작업을 지시하면 그때 이 문서를 새 범위로 갱신한다.

새 Codex 작업은 항상:
- `preview`에서 시작
- 배포 금지
- 필요한 파일만 수정
- TypeScript / Build / 관련 Test
- commit SHA 고정
- 고위험 백엔드/데이터 작업은 필요 시 Work 독립 감사

현재 배포 자체는 Codex 작업이 아니다.

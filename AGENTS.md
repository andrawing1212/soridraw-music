# SORIDRAW 작업 시작 지침

이 저장소에서 코드를 수정하거나 배포하기 전에 반드시 먼저 읽는다:

- [`DOCS/WORKFLOW_GUARDRAILS.md`](DOCS/WORKFLOW_GUARDRAILS.md)

핵심 규칙:
1. 현재 최우선 작업은 `Preview 빌드·배포 구조 단순화`다.
2. 한 번에 여러 단계/버그를 섞지 않는다.
3. 모든 작업 보고에는 현재 단계, 진척도 %, 이번 수정, 다음 작업, Preview/Test/Production 배포 상태를 반드시 표시한다.
4. 정식 Firebase Hosting은 사용자의 명확한 `정식배포` 승인 없이는 절대 배포하지 않는다.
5. Firestore/Auth/Functions 저장·읽기 구조 변경은 기존 데이터 호환성 확인 전 배포하지 않는다.
6. 빌드 시 Python 패치로 `src/**`를 다시 만드는 구조를 제거하고 실제 소스를 단일 기준으로 만든다.

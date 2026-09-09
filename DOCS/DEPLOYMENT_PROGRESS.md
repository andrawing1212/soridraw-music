# SORIDRAW Deployment Progress

> 상세 현재 상태의 단일 기준은 `DOCS/CURRENT_RELEASE_STATE.md`다. 이 파일은 배포 관점 요약이다.

최종 갱신: 2026-09-10 KST

## 현재 릴리스
- PREVIEW 실제 배포본: 052 배포/검증 완료 — 배포된 앱 기준 `preview@2819dcf57904a8db7222a89c18965c28b94da60a`.
- PREVIEW 저장소 최신 미배포 앱/Worker 코드 변경 기준: `63d26bf472700cfe639d033715eeea49f6453c83` — Explore cache mutation 안전성 보강. **배포하지 않음.**
- `63d26bf` 이후 `preview`에는 GitHub 유지보수/문서/읽기전용 감사 Workflow 변경만 추가되었다. 작업 시작 시 실제 `preview` HEAD를 다시 고정한다.
- TEST: 052 배포/검증 완료 — 앱 코드 기준 `main@3b574c05589230f077eceff98190edd4b5195f75`.
- PRODUCTION: 051/052 및 현재 Explore 비용 작업으로 앱/Hosting/Worker를 승격하지 않음. 정식배포 승인 없음.

## 최근 완료
- Explore 사용자 원본 데이터 공유 구조 전환
- PREVIEW/TEST Explore Feed 30곡 일치 검증
- 공개프로필 기기별 오래된 캐시 문제 완화용 051 복구 반영
- 앱 업데이트 버전 소스를 `public/app-version.json` 하나로 통일
- `63d26bf`: 동시 cache mutation 덮어쓰기 보호 + 제한된 popular 외부 후보 진입 + 현재 052 verifier 정리 — 배포 전
- GitHub 저장소 유지보수: 기존 200개 브랜치에서 현재 85개로 축소. 기존 브랜치 115개를 `preview/main` 포함 확인 후 삭제했고, 고유 미병합 53개는 자동 삭제하지 않고 보존.
- 일회성 `.github/workflows/temp-*` 82개 삭제, 현재 해당 패턴 0개 확인.
- `Repository Maintenance`는 자동 push 실행을 제거하고 수동 `workflow_dispatch` 전용으로 변경.
- D1 읽기전용 감사 Workflow는 전용 `CLOUDFLARE_READONLY_TOKEN`을 사용하고 필수 D1 조회 실패 시 전체 Action도 실패하도록 fail-closed로 수정.

## 현재 최우선 문제
배포보다 **Explore/Public Profile 초저비용 구조**가 우선이다.

- `/feed-revision`이 revision 변경 후 latest+popular 전체 Feed 재생성을 유발할 수 있음.
- 현재 global revision만으로는 어떤 track/profile ID가 바뀌었는지 누락 없이 알 수 없음.
- 공개프로필 cold 복구가 원본 D1 materialize를 유도하는 경로가 남아 있음.
- 10만 사용자 기준 업데이트/첫 진입이 원본 DB read 폭증으로 이어질 수 있으므로 현 구조를 장기 운영 기준으로 승인하지 않음.
- 실제 공유 D1 schema/trigger/journal 존재 여부를 확인하려 했지만 GitHub Actions Cloudflare 인증이 `7403 unauthorized`로 막힘. D1 write는 발생하지 않았음.

## 다음 단계
1. GitHub Secrets에 배포용 토큰과 분리된 `CLOUDFLARE_READONLY_TOKEN`을 준비한다. 필요한 범위는 D1 읽기 + Worker 읽기만 허용한다.
2. `Cost Zero Stage 2A Live Readonly`를 다시 실행해 실제 공유 D1의 table/index/trigger 구조를 읽기전용으로 확인한다.
3. 기존 구조만으로 변경 ID 전달이 가능한지 확정한다. 불가능하면 작은 additive change journal 구조의 필요성/호환성/비용을 먼저 승인받는다.
4. 그 뒤 Codex가 PREVIEW에서 남은 Explore/Public Profile 초저비용 구조를 구현하며 배포하지 않는다.
5. Work 독립 감사 → ChatGPT 최종 확인 → 사용자 PREVIEW 배포 승인 → PREVIEW 실사용 검증 순서로 진행한다.
6. TEST 승격은 PREVIEW 검증 후 사용자 요청으로만 진행하고, PRODUCTION은 별도 명확한 승인 전 금지한다.

## 저장소 유지보수 남은 위험
- `preview`, `main`, `production` GitHub branch protection이 현재 꺼져 있다. force-push/삭제 방지 규칙 설정 전까지 저장소 운영 위험으로 기록한다.
- 85개 브랜치 중 고유 미병합 작업 브랜치 53개는 데이터 손실 방지를 위해 보존했다. 이름만 보고 지우지 않고 별도 이력 감사 대상으로 둔다.

## 이번 단계 배포 정책
- 이번 GitHub 유지보수는 소스/Workflow/문서 정리이며 앱, Firebase Hosting, Worker, Functions, Rules, D1/R2 사용자 데이터 배포/변경을 하지 않았다.
- `63d26bf` 및 이후 변경은 사용자 `프리뷰배포` 승인 전 실제 PREVIEW 런타임에 배포하지 않는다.
- TEST는 Work + PREVIEW 실사용 검증 전 승격 금지.
- PRODUCTION 변경 금지.

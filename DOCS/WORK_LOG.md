# SORIDRAW 누적 작업 일지

> 모든 의미 있는 진단·수정·검증·배포 작업은 삭제하지 않고 아래에 계속 append한다.

## 2026-08-30 — 작업 메모 체계 고정
- 브랜치: `preview-stage3-pagination`
- 작업: 사용자 요청에 따라 모든 작업의 누적 메모 규칙을 저장소에 고정.
- 변경: `DOCS/WORKFLOW_GUARDRAILS.md`에 `DEPLOYMENT_PROGRESS.md` + `WORK_LOG.md` 이중 기록 원칙 추가.
- 결과: 이후 진단/수정/테스트/배포/보류 판단을 모두 이 파일에 누적 기록.
- 다음: 3단계 뮤직노트·라이브러리 페이지네이션 최소 수정 진행.

## 2026-08-30 — Stage 3 원인 진단
- 브랜치: `preview-stage3-pagination`
- 작업: 동결된 실제 소스에서 Music Note / Suno Library 페이지네이션 소유권 재분석.
- 라이브러리 원인: 로컬 곡 캐시는 유지되지만 재진입 시 페이지 메타 `hasMore`/다음 cursor가 초기값으로 돌아가 서버에 다음 곡이 있어도 더보기 버튼이 사라질 수 있음.
- 뮤직노트 원인: UI `visibleCount`와 서버 cursor/`hasMoreFavorites`가 별도 소유되고, first-page bundle 갱신이 더 깊게 진행한 pagination cursor를 앞쪽으로 되돌릴 수 있음. 또한 `filteredFavorites.length >= 20` 조건 때문에 서버에 다음 페이지가 있어도 현재 보이는 필터 결과가 20 미만이면 더보기 요청 자체가 막힐 수 있음.
- 데이터 안전: Firestore 문서 수정/삭제/백필/Rules/Functions 변경 없이 클라이언트 읽기·캐시 메타만 수정하는 방향으로 확정.
- 다음: 페이지 메타 단일 소유 + 레거시 `createdAt` 누락 문서 호환 읽기 최소 패치 후 build/typecheck 검증.

## 2026-08-30 — Stage 3 소스 수정 1차 검증 실패
- 브랜치: `preview-stage3-pagination`
- 실행: GitHub Actions `Stage3 Pagination Fix` run `33267799384`.
- 결과: 소스 패치 PASS, 정적 assertions PASS, `npm ci` PASS, TypeScript FAIL.
- 에러: `src/App.tsx`의 `MUSIC_NOTE_PAGINATION_COMPLETE_STORAGE_BASE`가 모듈 helper보다 안쪽 React component scope에 선언되어 helper에서 참조할 수 없었음.
- 안전조치: TypeScript 실패 즉시 build·소스 commit·배포를 자동 중단. Stage 3 앱 소스는 아직 브랜치에 반영되지 않았고 Firestore/Functions/Rules/Hosting/Auth/사용자 데이터 변경도 없음.
- 다음: 완료 마커 상수만 기존 pagination storage 상수와 같은 module scope로 이동한 뒤 동일 수정안을 재검증.

## 2026-08-30 — Stage 3 페이지네이션 소스 수정 2차 검증 PASS
- 브랜치: `preview-stage3-pagination`
- 변경 파일: `src/App.tsx`, `src/pages/FavoritesPage.tsx`, `src/pages/SunoLibraryPage.tsx`.
- 라이브러리: 로컬 track cache와 별도로 `hasMore/cursor/fallback` 페이지 메타를 저장·복원. 10개 표시를 위해 11개 lookahead 조회로 다음 페이지를 정확히 판정. ordered pagination 끝에서만 최대 2,000건의 읽기 전용 호환 스캔으로 `createdAt` 없는 레거시 문서를 로컬 캐시에 병합.
- 뮤직노트: 20개 표시를 위해 21개 lookahead 조회. 기존 캐시의 깊은 pagination state를 first-page bundle이 덮지 않게 분리. 페이지 끝에서만 최대 2,000건 읽기 전용 호환 스캔으로 레거시 문서를 로컬 캐시에 병합하고 완료 마커를 저장.
- UI: 캐시 잔량 전체를 `남음`으로 표시하지 않고 다음에 실제 표시할 개수만 안내. 서버 `hasMore`가 true면 현재 필터 결과가 20개 미만이어도 더보기 요청 가능.
- 1차 실패 보정: 완료 마커 storage 상수를 module scope로 이동. 다른 수정 로직은 1차 패치를 그대로 재사용.
- 데이터 안전: favorites/suno_tracks 원본 문서 쓰기·삭제·백필 없음. Functions/Rules/Hosting/Auth 변경 없음.
- 검증: 정적 assertions PASS, TypeScript PASS, Vite build PASS.
- 다음: 임시 workflow 제거 후 diff 감사 → `preview` 반영 및 Firebase Preview 배포 → Music Note 493개/Library 더보기 실사용 확인.

## 2026-08-30 — Stage 3 Preview 반영 전 최종 diff 감사
- 브랜치: `preview-stage3-pagination`
- 작업: 임시 진단/수정 GitHub Actions 4개 삭제 후 `preview` 기준 net diff 재확인.
- 최종 net diff: `src/App.tsx`, `src/pages/FavoritesPage.tsx`, `src/pages/SunoLibraryPage.tsx`, `DOCS/WORKFLOW_GUARDRAILS.md`, `DOCS/WORK_LOG.md` 5개만 남음.
- 결과: 임시 workflow/진단 파일 0개, Functions/Rules/Firestore/Auth/Hosting 설정 파일 변경 0개.
- 다음: 검증된 branch HEAD를 `preview`에 fast-forward하고 Firebase Preview 배포·smoke·production 불변 확인.

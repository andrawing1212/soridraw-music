# SORIDRAW PREVIEW app164 + Worker195 — 신규 공개곡 최초 좋아요 수정 실사용 확인·보호 기준

## 현재 지위 (2026-09-25 KST)
- 사용자 명시 피드백: app164 배포 후 새 공개곡의 좋아요 차단에 대해 "좋아. 이건 해결했어. 마찬가지 스킬로 다시 업데이트 해줘."
- 이 확인은 **해당 신규 공개곡의 첫 좋아요 문제 해결**에 관한 사용자 실사용 확인이다. 새 기기/모든 신규곡, 양방향 모든 PC↔모바일 경우, 물리 D1 W1~W2 계측을 이번 피드백으로 PASS 처리하지 않는다.
- 기존 app160 + Worker195의 개인 하트·내 좋아요·PC↔모바일 양방향·타계정 공개 숫자는 이전 사용자 확인 기준 그대로 **보호**한다. 역사적 기준: `soridraw-app160-worker195-frozen.md`; 원격 신호 처리 순서: `soridraw-app141-baseline.md`.
- **이 문서는 신규 수정 또는 재배포 지시가 아니다.** 현재 사용자 요청은 스킬/문서 기준 갱신이며 제품 코드는 그대로 둔다.

## 고정 배포 증거
| 대상 | 확인 |
|---|---|
| 제품 수정 | `src/services/exploreLikeService.ts` 신규 보이는 곡 ID의 초기 좋아요 상태만 처리, commit `467ba77241555dbe24e6648900268c0a03427026` |
| 앱 버전 | 164, version commit `e151d033e59a5959c0bc876c86dab577ab3847dc` |
| 최종 Audit | Run `36040506539` SUCCESS (TypeScript, Build, 신규 APP197 + 기존 좋아요 회귀, D1 read-only preflight) |
| PREVIEW Hosting | Run `36040776352` SUCCESS, exact release SHA `c6d580b65349071d67d17c11fa7fd83afc5b98f9`, version 164/exact build PASS |
| Worker | 기존 195, active `11d8455c-c266-4e88-9cf6-7549d3f5be92` 유지·재배포 없음 |
| RTDB/Functions/원본 데이터 | RTDB rules SKIPPED; Functions, 공유 Firestore/D1/R2 사용자 원본·스키마 변경 없음 |
| TEST / PRODUCTION | Hosting/branch 비변경 PASS, 승격 승인 없음 |
| 실사용 | 사용자가 신규 공개곡 문제 해결 확인; 정밀 비용·다른 환경의 전체 실사용 사례는 미측정 |

## app164에서 보호할 신규곡 경계
- 재현됐던 사례: `[Melodic Rap] 한 정거장 일찍(한 단어 훅)`을 새로 공개한 뒤 하트 클릭 시 `좋아요 상태를 확인하고 있어요. 잠시 후 다시 시도해주세요.` 알림.
- 원인 경로: 화면은 로컬에 없는 새 ID를 빈 하트처럼 표시하지만, 클릭 권한의 실제 개인 membership은 `undefined`; 이전에는 로컬 카탈로그가 있다는 이유로 새 ID의 초기 판정을 건너뛰었다.
- **검증된 complete 개인 snapshot**이 있으면 기존 ID·좋아요(true/false)·미전송 outbox·수신 미정산 guard를 먼저 보호하고, 캐시에 없는 *새 표시 곡 ID만* 최초 미좋아요(false)를 로컬에 한 번 기록. 원본 DB에 전체 조회/쓰기하지 않는다.
- **partial 또는 미확인 snapshot**이면 ID 미포함을 곧바로 false라고 추측하지 않는다. 해당 화면의 *알 수 없는 ID만* 기존 bounded `/v1/me/likes?trackIds=...` 경로로 확인 후 캐시에 기록한다. 해당 ID의 재진입은 캐시 우선.
- 개인 membership과 공용 `likeCount`는 다른 기준이다. 하트 상태를 공용 숫자로 추측하지 않고, 신규곡 때문에 기존 하트·숫자를 초기화하지 않는다.

## 수정 금지·릴리스 게이트
- 사용자 새 오류 및 범위 지정 없이는 이 초기 판정 코드를 포함한 정상 좋아요 기능을 다시 최적화/리팩터링/재배포하지 않는다.
- 기존 trailing 30초 배치, W1 queue, Worker195 event recovery, RTDB 계정별/공용 신호, 개인 캐시·outbox·watermark, Explore 카드/프로필 UI 및 공용 숫자 경로 보호.
- 신규곡 하나 때문에 개인 좋아요 전체/Feed/공개프로필 전체 읽기·재생성 금지. 정상 캐시 재방문 D1 R0/W0 목표. 신규 mutation의 실제 D1 물리 `rows_written` W1~W2는 **미측정**이며 W3+이면 승격 차단.
- 관련 회귀: `scripts/verify-197-new-public-track-like.mjs` + 기존 `verify-127`, `verify-175`, `verify-178`, `verify-192` 등. 정적 검사와 실기기 검증을 혼동하지 않는다.
- TEST/PRODUCTION은 각각 명시적 승격 요청과 게이트 확인 전 변경 금지; 사용자 원본 데이터 복사/삭제/대량변환 금지.

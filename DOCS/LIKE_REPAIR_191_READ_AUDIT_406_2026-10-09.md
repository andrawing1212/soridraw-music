# Stage406 — 기존 191 안전복구 기능의 불필요한 읽기 가능성 검사 (2026-10-09 KST)

## 현행 소스 확인 — 동작 보호 우선

- 기준 `preview` commit `747412a311a252c9655423007d056aacc1a6ae96`.
- 실제 `cloudflare/explore-worker/canonical/preview-entry.js`의 `ExploreLikeBatchScheduler103.runAggregate194()`는 `baseWorker.scheduled(...)` 뒤 **항상** `repairSharedPublicLikeCounts191(env)`를 호출한다. 이 호출은 사용자 페이지 진입마다가 아니라 **좋아요 배치 정산 시**이다.
- 실제 생성 Worker `canonical/preview-worker.js`의 `worker_default.scheduled()`는 `await processExploreLikeBatches035(...)`만 하고 정산 결과를 반환하지 않는다. 정산 `totals.changedTracks`를 이미 계산하지만 scheduler까지 전달되지 않는다.
- 191 복구는 최신·인기 각각 공개 목록 첫 40곡씩 최대 80개 ID를 R2에서 모아, canonical D1 `tracks` + `track_stats` SELECT 한 번으로 숫자를 확인한다. 맞지 않는 숫자는 R2 공유카드·프로필까지 보정하므로 **현재 정상 동기화 복구의 안전망**이다.
- 변경이 없는 중복 queue라도 `scheduled` 실행 성공 후 191이 호출될 수 있다. 다만 실제 069 배치 분기에서 `scheduled`가 빈 큐였는지·R2 실패 복구 대기 중이었는지 구분되지 않으므로, 단순히 `changedTracks=0`이라서 복구를 건너뛰면 과거 실패 후 남은 잘못된 숫자를 못 고칠 수 있다. **191 제거 또는 무조건 생략 금지**.

## 검사 완료 — 격리 Local D1 계측

GitHub Actions [Run 37831877230](https://github.com/andrawing1212/soridraw-music/actions/runs/37831877230), 대상 검사 commit `9656af17e9650d676e15dddd45ed7eaa791e9572`: **SUCCESS**. 기존 398~405 관련 검사와 신규 Stage406 모두 성공.

| 복구 대상으로 모은 공개곡 | 동일 SQL Miniflare `rows_read` | `rows_written` |
|---|---:|---:|
| 0곡 | 0 | 0 |
| 1곡 | 2 | 0 |
| 40곡 | 120 | 0 |
| 80곡 | 240 | 0 |

**조건:** 테스트용 DB의 공개곡 전부 likeCount=1, 이미 R2 공개 카드도 정확하다고 가정(읽을 데이터가 달라질 이유 없음). 그래도 canonical SELECT는 지정된 ID만큼 D1 read가 발생한다. 수치는 실제 제품 Worker의 R2 동작이나 live D1 청구 측정이 아닌 **원래 SQL 문자열과 같은 조회 조건에 대한 격리 계측**이다.

**설계 결론:** 191은 최대 80곡의 bounded 복구 안전망이다. 구형 R2가 이전 정산 오류 때문에 잘못된 상태일 수 있으므로 단순히 `changedTracks=0` 또는 현재 변경곡 1개라는 이유만으로 나머지 복구를 중단해서는 안 된다. 현재 실제 코드의 `worker_default.scheduled`는 정산 `totals`를 돌려주지도 않는다. 원본 제품 코드 파일 변경 0.

다음 Stage407은 **복구 부채 없이 안전한 경우가 이미 보장되는지**를 우선 읽기 전용으로 추적. 이를 증명하지 못하면 191 유지가 우선이며, 관련 코드 변경·배포를 하지 않는다. 실제 관심 대상은 **사용자 재방문**이 아닌 **변경이 있었던 배치 정산**의 read 비용이고, 사용자 10만 명당 반복 전송/읽기 비용은 따로 검증해야 한다.

---

## Stage406 실측 범위

새 `scripts/verify-406-existing-repair-read-audit.mjs`와 기존 격리 Workflow만 추가한다. **실서비스 코드는 수정하지 않고** 현재 191이 쓰는 SELECT 문장과 동일한 조회 조건을 격리 Miniflare D1에 재현한다. 0/1/40/80개 공개곡을 조회해 SQL의 D1 rows_read / rows_written 계측. 좋아요 숫자가 이미 정확한 상태에서도 SELECT 자체 읽기는 발생함을 확인한다. 수치와 GitHub Actions URL은 실행 로그 기준.

이 시험은 R2 이미지/바이트, Worker 라이브 연결, 캐시/실사용 분포, 운영 D1 집계/과금을 재현하지 않는다. 따라서 격리 SELECT 읽기 절감 기대값을 곧바로 전체 서비스 실비용 개선이라고 주장하지 않는다.

## 바로 건드리면 안 되는 부분

- 191 조건 없는 삭제·skip 변경 금지: 과거 batch R2 쓰기 실패/한 번의 전송 누락을 이전대로 복구하지 못할 수 있다.
- 069/075 정산 결과를 `worker_default.scheduled`에서 return 하도록 바꾸는 것조차 기존 `scheduled` 호출자와 보호된 복구 흐름/Worker bundle 영향을 검증하기 전에는 제품에 적용하지 않는다.
- 일단 기존 캐시와 DO/RTDB/R2 경로를 살리면서, **안전복구 부채가 0임을 증명할 수 있는 작은 신호**가 이미 존재하는지 확인하고, 하나도 없다면 기존 191을 유지하고 새 outbox 실험을 적용하지 않는다.

## Stage407의 최소 수정 후보 검토 순서

1. 정상 191/Worker/DO의 목적과 예외 복구 지점을 유지한다.
2. 읽기 증가가 어디에서 발생하는지 프로파일링한다(실제 현재 191, Stage405 후보 CTE 재계산, 각 구분).
3. 안전한 실패-복구 근거가 없으면 최적화하려고 191을 생략하지 않는다.
4. 작은 변경 하나에 대해서만 현재/후 D1 R/W + R2 오브젝트 수 + 이전 좋아요·해제·타계정 숫자·PC↔모바일·구형 앱 회귀 증명.
5. 기존 구조보다 비용이 늘거나 회복력이 줄면 STOP, 데이터/RTDB/Functions 배포하지 않음.

## 안전

최신 `preview`의 제품 app382 및 Worker, Rules, Functions, 공유 D1/Firestore/R2 데이터, Hosting, main/TEST/PRODUCTION **변경하지 않음**. 진단 test/Workflow/문서만 commit하고, 실제 운영 비용은 미검증이다.

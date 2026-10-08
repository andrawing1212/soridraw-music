# Stage 407 — 현행 191 복구함수 부분 실패 시 재시도 누락 재현 (2026-10-09 KST)

## 결론: 격리 복구 시험 PASS / 제품 변경·배포 BLOCKED

- Branch `preview`, 작업 시작 기준 `b51392255e5f9b390bf6598b328faba6a7a421ec`.
- `cloudflare/explore-worker/canonical/preview-entry.js`에서 **실제 `repairSharedPublicLikeCounts191` 함수 소스를 추출**하여 VM에서 실행했다. canonical 조회는 LOCAL Miniflare D1, 공유 R2는 ETAG/CAS·데이터형이 동일한 **메모리 모형**으로 구성했다. 제품 Worker/Cloudflare R2 실제 바인딩 실행은 아니며 실제 사용자 데이터나 remote DB를 읽거나 쓰지 않았다.
- 검사 `scripts/verify-407-exact-191-replay-recovery.mjs`, 기존 `.github/workflows/verify-398-isolated-d1.yml`에 연동.
- GitHub Actions [Run 37832572556](https://github.com/andrawing1212/soridraw-music/actions/runs/37832572556): **SUCCESS**, Stage407 7/7 PASS, Stage398~406 기존 회귀검사 PASS. **검사 PASS는 191의 불완전한 회복 경로를 성공적으로 재현했다는 뜻**이며 제품 수정 PASS 아님.

## 현재 복구 함수가 하는 일

1. R2 최신·인기 Feed 상위 최대 80곡의 ID를 모으고 D1 canonical `tracks`/`track_stats`에서 현재 likeCount를 조회한다.
2. 두 Feed에 오래된 likeCount가 보이면 `shared.put(...etagMatches...)`로 해당 Feed를 갱신하면서 `changed` 맵에 트랙 ID를 기록한다.
3. **Feed가 어긋났던 `changed` 곡에 한해서만** 공유 개별 곡 카드와 공개프로필을 갱신한다.
4. 2 단계에서 Feed 저장이 이미 성공하고 3 단계 카드·프로필 R2 저장이 실패했다면, DO alarm이 함수를 다시 호출해도 Feed는 이제 정상 숫자이므로 `changed`가 비게 된다. 이전의 잘못된 카드·프로필을 더 이상 복구 대상으로 선정하지 못한다.

## 실제 함수 격리 실행 7/7

| 시나리오 | 검증 |
|---|---|
| 이미 최신인 Feed/카드/프로필 | R2 쓰기 0, 추가 D1 canonical 조회는 수행 |
| Feed/카드/프로필 모두 구형 숫자 | 성공적으로 4개 R2 object 갱신 |
| 성공 후 재실행 | 추가 R2 쓰기 0 |
| Feed 2개, 카드 갱신 성공 후 **프로필 put 1회 장애** | 일부만 최신, 프로필 구형 상태 남음 |
| 그 후 alarm과 동일한 **재시도** | 함수 완료처럼 반환하지만 프로필 숫자는 여전히 구형 — **실질 복구 실패 재현** |
| Feed 정확, 카드·프로필만 구형 | `changedTracks:0` 반환, 해당 카드·프로필 미복구 |
| 기존 소스의 가드/데이터 조회 | 원본 함수 코드 추출·D1 변경 없음 검증 |

재현은 **구체적 복구 취약 조건**이며 기존 앱의 모든 곡이 이런 상태라는 뜻이 아니다. 클라이언트나 별도의 반영 경로가 나중에 R2를 바로잡을 가능성도 배제하지 않는다. 그러나 191 그 자체의 단독 회복 보장은 불충분하다는 정적·동적 근거다.

## 수정/비용 판단

**하지 말아야 할 것:** 191을 삭제, 정산 결과 `changedTracks===0`인 경우 skip, 전체 Feed 반복 재생성, R2 오브젝트 80개×카드·프로필 전부 재검증, 데이터 초기화, 신규 outbox 우선 적용. 이는 안정성 또는 비용 악화를 초래할 수 있다.

**Stage408 단일 후보 검증 필요:**

1. 191이 **현재부터 갱신하려는 몇 곡**의 card/profile 복구를 확인하기 전 Feed만 먼저 완료 처리하지 않도록, ETAG/동시성에 안전한 처리 순서 또는 현재 DO/R2에 기록돼 있는 재시도 정보가 재사용 가능한지 확인.
2. 같은 함수 정확한 단위 테스트에서 `Feed 성공→card/profile 실패→재시도`와 `Feed는 정확·카드만 오래됨` 사례 둘 다 해결되어야 한다. 성공 재시도에서는 R2 쓰기 중복 0, 변경된 곡 외 per-track 대량 R2 read 금지.
3. 원본 D1 R/W, R2 GET/PUT, DO storage/alarm, 069/075 정상 정산 및 PC↔모바일 기존 좋아요·팔로우·캐시 수렴과 구형 앱 동작을 합쳐 **기존 대비 총비용** 측정. 80곡이 정상일 때 불필요한 카드/프로필 160회 조회가 붙는 해결책은 비용 불합격.
4. 제품 소스의 소규모 수정안과 독립 감사/실사용 테스트에서 모두 합격할 때만 사용자에게 배포 범위를 보고한다. **기존 기능 보호가 우선**이므로 현재는 Runtime 파일 수정·배포 금지.

## 배포/데이터 안전

Stage407은 `preview` 격리 시험 1개+기존 Workflow 연결+상태 문서만. app382, Worker195 기존 기능, Firebase Functions/RTDB Rules, 실제 Cloudflare D1/R2, 공유 사용자 Firestore·데이터, Hosting, main/TEST/PRODUCTION **모두 수정·배포 0**. TypeScript/Build·실기기·운영 D1 과금 검증 전. 별도 `diagnose-069-live-like.yml` 자동 실패는 기존 미해결 상태.

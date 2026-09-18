# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — publication first-public W18 hard FAIL / redesign required

## 절대 합격선

- D1 사용자 mutation 1회 `rows_written` **W1~W2만 PASS**.
- 좋아요/해제, 공개/비공개, 팔로우/해제 등 모두 동일.
- 최초 등록도 예외 없음.
- `W3+`면 기능이 정상이어도 TEST/PRODUCTION 승격 금지.

## 현재 확인된 실패

- 첫 Music Note 공개: `PAGE SYNC D1 R6/W18` → **FAIL**.
- 등록된 곡 비공개: `R3/W2` → write gate PASS.
- 첫 공개 W18 = tracks W11 + derived-track mirror W5 + derived-profile count W1 + shared revision W1.
- live shared-D1 read-only audit Run `35352259068` SUCCESS, remote writes 0.

## 공개 검색/탐색 제품 범위 — 2026-09-18 확정


- 공개곡에서 반드시 필요한 검색/탐색:
  - 곡 제목 검색
  - 장르 탐색/검색
  - 아티스트(공개 프로필 닉네임/handle) 검색
- Suno URL 역검색, source type별 최신순, legacy id 검색 등은 사용자 기능으로 유지할 필요 없음.
- 단, PK/중복방지/하위호환처럼 사용자 검색과 무관한 무결성 인덱스는 삭제 후보로 간주하지 말고 실제 의존성 확인 후 판단.
- 제목 검색은 tracks의 일반 title index 유지가 아니라 검색 전용 구조가 더 싼지 우선 비교.
- 아티스트 검색은 tracks 인덱스를 추가하지 말고 public profile 검색 경로를 사용.
- 장르는 primary_genre 기반 최소 인덱스/검색 구조를 우선.

## 다음 구현 목표

1. 첫 공개 경로를 구조적으로 재설계해 실제 live D1 `rows_written <=2`.
2. 단순히 write를 늦추거나 다른 background job으로 옮겨 총량을 숨기는 방식 금지.
3. Music Note에 불필요한 tracks indexes / derived D1 mirror / D1 revision write 의존성을 각각 감사.
4. shared R2 Feed/Profile/current client cache 구조를 우선 재사용.
5. 기존 TEST/PRODUCTION이 shared canonical data를 계속 읽을 수 있는 하위호환 유지.
6. destructive migration/index drop/backfill은 사용자 별도 승인 없이 실행 금지.
7. PREVIEW에서 공개·비공개·재공개 각각 실제 PAGE SYNC와 per-path D1 row meter 확인.
8. PC+모바일 공통 검증.
9. W3+ 하나라도 나오면 FAIL.
10. PRODUCTION은 명확한 정식배포 승인 전 변경 금지.

## 외부 대규모 서비스 조사 결론 — 2026-09-18


- Discord: 검색을 원본 저장 hot path에 강결합하지 않고, 검색 수요가 있는 메시지를 lazy indexing하며 queue + chunk/bulk indexing으로 분리.
- Uber CacheFront: 원본 DB를 source of truth로 두고 cache는 분리. DB change stream/CDC로 cache invalidation/upsert, version으로 중복 cache write 방지.
- Uber Search: search serving과 indexing ingestion을 분리. 데이터 변경은 ingestion layer가 검색 인덱스로 전달하며 검색용 구조를 원본 DB hot path와 분리.
- Meta TAO: persistent MySQL과 분산 cache tier를 분리하고 cache layer가 read를 흡수. 저장소와 읽기 가속 계층을 독립 확장.
- Cloudflare D1 공식: index는 rows_read를 줄이지만 indexed-column write마다 rows_written을 추가한다. 자주 실행되는 read가 saved rows를 정당화할 때만 index가 이득이며 EXPLAIN/meta로 확인해야 함.

### SORIDRAW 적용 원칙

- `batch()`나 한 SQL 요청으로 W18을 묶는 것은 비용 절감으로 인정하지 않음. 총 `rows_written`이 그대로면 FAIL.
- Music Note 첫 공개는 D1 canonical mutation **1개**를 목표로 하고, PK/무결성 외 secondary index와 D1 derived mirror/trigger를 hot path에서 제거하는 방향 우선.
- Feed/latest/popular/profile/public-card는 이미 있는 R2/cache-first 구조를 우선 사용하고 같은 publication payload로 patch; D1 재조회/재생성 금지.
- 검색(제목/장르/아티스트)은 원본 `tracks`에 다수 secondary index를 추가하는 대신 별도 검색 계층으로 분리. lazy/batch 가능한 구조 우선.
- 검색용 파생 작업을 나중에 D1에 몰래 수행해 total D1 writes를 숨기는 방식 금지. 사용자 mutation에 귀속되는 총 D1 writes 기준 유지.
- Cloudflare Queue batching은 consumer invocation은 줄일 수 있지만 메시지별 operation 과금은 줄지 않으므로 단순히 'batch라 싸다'고 판단하지 않음.
- 최종 목표: public/private/republish 각각 D1 W1~W2, no-change W0. 불가능하면 최소 물리비용과 이유를 증명 후 사용자 승인.

## 현재 환경

- PREVIEW app124
- TEST app124 / TEST_VERIFIED 배포본은 존재하지만 신규 hard gate 기준으로 production 승격 불가.
- PRODUCTION app117 유지.

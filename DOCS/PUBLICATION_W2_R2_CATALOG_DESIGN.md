# SORIDRAW Music Note publication W1~W2 redesign

기준: preview `405cc43631d79db5d3cd7f36f4f8f32cb12b9140`
작성: 2026-09-19 KST

## 1. 절대 목표

- 첫 공개 / 비공개 / 재공개: D1 `rows_written <= 2`
- no-change: D1 W0
- 검색 때문에 publication D1 write를 추가하지 않는다.
- 제목 검색 / 장르 탐색 / 아티스트 닉네임·handle 검색을 유지한다.
- Explore 2페이지 이후 / 공개프로필 2페이지 이후도 전체 scan 없이 동작한다.
- 신규 사용자의 첫 공개에서 자동 공개프로필 표시 때문에 D1 profile write를 추가하지 않는다.
- UI/CSS/Music Note 60초 묶음 저장/좋아요 현재 동작을 바꾸지 않는다.
- TEST/PRODUCTION 코드가 읽는 canonical `tracks` 컬럼/테이블 계약은 유지한다.

## 2. 이미 실측으로 확인된 사실

Run `35357007850`:
- 현재와 같은 rowid `tracks` 형태 + 9개 secondary index를 Music Note에서 제외한 진단 구조:
  - first insert W2
  - private W1
  - republish W1
  - noop W0
- WITHOUT ROWID는 W1이지만 목표 달성에 필수 아님.

Run `35357864011`:
- FTS INSERT W1
- FTS DELETE W1
- 따라서 first canonical W2 + D1 FTS W1 = W3 이므로 금지.

Live schema audit `35356844574`:
- tracks = 9 explicit indexes + PK autoindex
- Music Note first insert에 derived mirror / profile count / shared revision trigger가 붙어 W18 발생
- `track_search_fts`, `profile_search_fts`는 이미 별도 구조
- active worker code에서 `INDEXED BY idx_tracks_...` 강제 의존은 확인되지 않음.

현재 배포 코드:
- PREVIEW/main은 shared R2 publication/feed/profile/track-card 경로 043~065 보유.
- PRODUCTION app117도 043~064 보유.
- shared public profile v113은 UID direct read + handle alias read 가능.

## 3. 최종 구조

### 3.1 Canonical D1

`tracks` 테이블과 컬럼은 그대로 유지한다.

Music Note row는:
- PK `id`를 canonical identity로 사용
- 현재 `ON CONFLICT(id)` idempotency 유지
- 기존 9개 explicit secondary index는 최종 cutover에서 `source_type <> 'music_note'` partial 형태로 재생성 후보
- Music Note INSERT/UPDATE에서 D1 derived mirror / shared revision trigger를 실행하지 않도록 분리

Suno Library / legacy non-Music-Note는 현재 index/trigger 동작을 유지한다.

중요:
- index drop/recreate 및 trigger 변경은 shared D1 migration이므로 별도 사용자 승인 전 실행 금지.
- 실제 migration 전에 동일 source의 track `id` 안정성/중복방지 verifier를 반드시 통과시킨다.

### 3.2 R2 ordered catalog — D1 derived rank 대체

기존 shared PROFILE_MEDIA R2를 재사용한다. 새 외부 서비스 추가 금지.

개념 key:
- `internal/explore/catalog-v1/meta/<trackId>.json`
- `.../latest/<inversePublishedAt>/<trackId>.json`
- `.../popular/<inverseLikeCount>/<inversePublishedAt>/<trackId>.json`
- `.../profile/<uid>/<pinOrder>/<inversePublishedAt>/<trackId>.json`
- `.../genre/<normalizedGenre>/<inversePublishedAt>/<trackId>.json`
- `.../title/<normalizedToken>/<inversePublishedAt>/<trackId>.json`
- `.../artist/name/<normalizedNickname>/<uid>.json`
- `.../artist/handle/<normalizedHandle>/<uid>.json`

원칙:
- 한 곡 변경은 그 곡의 marker만 PUT/DELETE.
- 전체 Feed/page 재작성 금지.
- `meta/<trackId>`에 현재 marker key 집합을 보관해 private/genre/title/like 변경 시 이전 marker를 정확히 제거.
- R2 key 정렬 + cursor를 사용해 2페이지 이후를 읽는다.
- 검색/페이지 응답은 Worker edge cache로 묶어 warm 재방문 비용을 흡수.
- track payload는 기존 shared track-card R2를 재사용하며, catalog는 ranking/lookup identity만 담당.

### 3.3 Explore pagination

첫 페이지:
- 현재 shared latest/popular R2 snapshot 유지.

2페이지 이후:
- 현재 D1 core/derived rank 대신 R2 ordered catalog 사용.
- API shape와 cursor contract는 기존 UI가 바뀌지 않도록 유지.
- 새 catalog cursor와 legacy cursor를 구분하고, cutover 전에는 legacy fallback을 유지.

좋아요:
- 기존 aggregate에서 final likeCount가 바뀐 track만 popular marker를 이동.
- D1 like W1~W2 gate를 깨는 추가 D1 ranking write 금지.

### 3.4 Public profile pagination + trackCount

- 첫 페이지 shared profile v113 유지.
- `trackCount`는 현재 profile R2 delta +1/-1 사용. D1 COUNT 재집계 금지.
- 2페이지 이후는 `catalog-v1/profile/<uid>/...`에서 읽는다.
- pin 변경도 해당 track profile marker만 이동.

### 3.5 신규 사용자의 첫 공개프로필

현재 first publish에서 `public_profiles` D1 INSERT가 발생하면 hard gate를 넘을 수 있으므로 자동 프로필은 D1에 만들지 않는다.

첫 공개 시:
- auth displayName/avatar 기반 최소 profile bundle을 shared profile v113에 생성
- UID direct key로 즉시 공개프로필 표시
- handle이 존재할 때만 기존 alias key 생성
- artist nickname/handle R2 index 갱신
- trackCount=1 반영

사용자가 나중에 공개프로필을 직접 편집할 때:
- 기존 profile edit canonical 경로로 `public_profiles`를 materialize/update
- shared profile v113이 canonical edit 결과로 교체
- 자동 R2 profile과 사용자 편집 profile 충돌 금지

### 3.6 검색 3종

앱 UI는 현재와 같이 `/v1/search?q=...` 하나를 사용한다.

Worker 내부만 변경:
1. 제목: normalized title token/prefix catalog
2. 장르: normalized genre catalog
3. 아티스트: nickname/handle -> uid -> profile catalog tracks

결과:
- track ids를 merge/dedupe
- 기존 shared track-card로 hydrate
- 기존 Explore track item shape로 반환
- 검색 때문에 D1 FTS INSERT/DELETE 금지

Title token:
- 공백 기반 unique token + normalized full title
- 과도한 marker 생성을 막기 위해 bounded token 수를 사용
- prefix search 지원
- 전체 substring/trigram 폭증 구조 금지

## 4. rollout 순서

### Phase A — 코드만
- R2 catalog helper
- feed/profile deep paging wrapper
- search wrapper
- first-publisher shared R2 profile builder
- like/profile mutation catalog patch
- legacy fallback
- verifier
- TypeScript / Build / 관련 tests
- shared D1 migration 없음
- deploy 없음

### Phase B — 진단 환경 검증
- RATE_DB/진단 table에서 실제 production-shape partial index + Music Note trigger exclusion 후보 측정
- public/private/republish/noop row meter
- R2 catalog 기능/검색/2페이지 테스트
- shared canonical D1 사용자 row write 0
- Work 독립 감사

### Phase C — 코드 선배포 준비
- PREVIEW -> TEST -> PRODUCTION 모두 새 R2 read path를 이해하는 코드로 승격한 뒤에만 shared D1 cutover 검토
- PRODUCTION은 사용자 명확한 승인 필수
- 이 단계까지 write path는 기존 상태 유지 가능

### Phase D — shared D1 cutover
사용자 별도 승인 후에만:
- tracks secondary indexes partial 전환
- Music Note derived/revision trigger exclusion
- migration 전/후 schema + query plan + parity 확인
- user data row delete/backfill/rewrite 금지
- 즉시 W1~W2 live meter 확인
- 실패 시 다음 승격 중단

## 5. 합격선

필수:
- first public W1~W2
- private W1~W2
- republish W1~W2
- noop W0
- 신규 사용자 first public 포함 동일
- publication action에서 D1 FTS write 0
- Explore first/second page 정상
- latest/popular 정상
- public profile first/second page + trackCount 정상
- title/genre/artist search 정상
- like/unlike 후 popular catalog 정상
- 기존 TEST/PRODUCTION projection parity
- PC/mobile 동일
- TypeScript / Build / relevant tests PASS
- shared user data delete/backfill 없음

## 6. 중단 조건

다음 중 하나면 구현/승격 중단:
- W3+
- 한 곡 변경이 전체 Feed/profile/search index rebuild 유발
- first publisher가 D1 public_profiles write를 추가
- title search가 무제한 token/trigram marker 생성
- old app/API shape가 깨짐
- shared D1 migration이 user row rewrite/backfill을 요구
- PRODUCTION 승인 없이 production code/schema 변경 필요

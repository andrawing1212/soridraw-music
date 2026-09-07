# SORIDRAW Explore 공개 데이터 정리 v1

기준 브랜치: `preview`
기준 목표: **1 / 0 / Cache**

- 실제 변경(mutation)은 가능한 한 D1 1행 쓰기.
- 정상 페이지 진입/새로고침은 D1 write 0.
- 정상 캐시가 최신이면 D1 read 0.
- 태그/키워드 개수, 사용자의 공개곡 개수, 전체 Explore 곡 개수에 따라 공개 1회의 비용이 커지지 않게 한다.
- `tracks`를 공개 상태의 canonical source of truth로 유지한다.
- R2/FTS/Feed/Profile snapshot은 파생 캐시다. 파생 캐시 실패가 canonical 공개 성공을 HTTP 500으로 뒤집지 못하게 한다.

## 현재 확인된 구조 문제

1. `music_note_publication_bundles`를 갱신하는 D1 trigger가 `tracks` 변경 때마다 해당 owner의 music_note 전체를 다시 `json_group_object`/`COUNT(*)`로 재구축한다.
2. 동일한 `/v1/me/music-note-publications-bundle` 경로가 D1 bundle(007)과 R2 bundle(008) 두 체계로 존재한다.
3. R2 bundle이 없을 때 publication mutation 내부에서 owner 전체 music_note를 D1 scan해 재생성하는 fallback이 있다.
4. 공개 mutation에 Feed/Profile/FTS/R2 파생 작업이 동기적으로 결합되어 있어, canonical write 뒤의 파생 실패가 HTTP 500 또는 과도한 비용으로 이어질 수 있다.

## 단계

### 1단계 — 파생 bundle 단일화 / 전체 재스캔 제거

- 읽기 캐시는 R2 bundle 하나로 통일한다.
- 기존 D1 `music_note_publication_bundles` 테이블은 즉시 삭제하지 않고 rollback/검증용으로 보존한다.
- owner 전체를 다시 만드는 4개 trigger는 제거한다.
- publication mutation 중 R2 cache miss가 발생해도 owner 전체 D1 scan을 하지 않는다.
- R2 bundle seed/repair는 배포/관리자 복구 경로에서만 수행한다.

배포 순서:
1. 기존 canonical `tracks`에서 R2 bundle을 1회 seed/repair.
2. R2 bundle parity 검증.
3. Worker가 `/v1/me/music-note-publications-bundle`을 R2로 읽도록 전환.
4. D1 전체 재구축 trigger 제거.
5. 실제 로그인 계정으로 공개/비공개/옵션 변경 비용 확인.

### 2단계 — 공유용 데이터 한 상자화

공유에 필요한 곡 정보, 선택 키워드, 다음곡 적용 옵션 등을 canonical track의 단일 payload로 정규화한다.

예시 개념:

- `share_payload_json`: 제목/가사/음원/이미지/선택 키워드/공개 옵션/다음곡 적용 정보
- `share_hash`: 동일 내용 재저장 방지
- `share_revision`: 변경분 동기화

기존 데이터는 삭제/migration하지 않고 additive + fallback 읽기로 호환한다.

### 3단계 — 공개 hot path를 1행 mutation으로 축소

목표:

- 첫 공개: D1 read 0~1 / canonical D1 write 1
- 동일 내용 재공개: D1 read 0~1 / canonical D1 write 0
- 키워드 수가 많아져도 공개 비용 증가 없음

`track_tags` 대량 DELETE/INSERT, profile 전체 rebuild, feed 전체 rebuild, owner 전체 bundle rebuild는 공개 hot path에서 금지한다.

### 4단계 — Delta + Cache

- 공개 성공 응답으로 클라이언트 Music Note/Explore/Profile cache를 즉시 patch.
- Explore 진입은 Local persistent cache -> Cloudflare Edge/R2 -> D1 순서.
- 정상 cache 최신이면 D1 read 0 / write 0.
- 공개/비공개/좋아요/저장/다음곡 적용처럼 실제 변경만 delta 처리.

### 5단계 — 사용자 간 정보 교환 최적화

공개곡에서 교환해야 하는 정보는 한 track payload/revision을 기준으로 한다.

- 곡 기본 정보
- 사용자가 선택한 장르/스타일/사운드/분위기/주제/키워드
- 다음곡에 적용 가능한 정보
- 저장/적용 허용 정책
- 공개 상태/수정 revision

상대 사용자는 전체 원본을 반복 조회하지 않고 revision/ETag로 변경 여부를 확인한다.

### 6단계 — 비용 합격 게이트

관리자 진단에 실제 수치를 남기고 다음을 통과해야 다음 단계/TEST 승격을 허용한다.

- 공개 1회: HTTP 200, owner-wide scan 0, full-feed rebuild 0
- 정상 Explore 진입: D1 write 0
- 정상 캐시 최신: D1 read 0
- 새로고침: server write 0
- 동일 공개 재시도: canonical write 0 목표
- 파생 캐시 실패: 공개 상태 유지, HTTP 성공을 500으로 뒤집지 않음

## 데이터 안전

- 기존 `tracks` 데이터 삭제 없음.
- 기존 `music_note_publication_bundles` 테이블 즉시 삭제 없음.
- Production 데이터 migration 없음.
- 모든 구조 변경은 preview에서 실측 검증 후 main 승격.

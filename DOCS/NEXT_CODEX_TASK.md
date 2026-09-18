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

## 현재 환경

- PREVIEW app124
- TEST app124 / TEST_VERIFIED 배포본은 존재하지만 신규 hard gate 기준으로 production 승격 불가.
- PRODUCTION app117 유지.

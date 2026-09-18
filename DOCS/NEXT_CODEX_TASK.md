# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — app125 W2 staged candidate static PASS / live shared-D1 apply blocked

## 절대 합격선

- D1 사용자 mutation 1회 `rows_written` **W1~W2만 PASS**.
- 최초 Music Note 공개도 예외 없음.
- 공개/비공개/재공개 중 하나라도 W3+면 FAIL.
- 비용을 background/queue로 옮겨 숨기는 방식 금지.
- 사용자 승인 전 shared D1 migration 실행 금지.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.

## 현재 app125 후보 상태

- branch: `work/app125-publication-w2`
- base PREVIEW: `405cc43631d79db5d3cd7f36f4f8f32cb12b9140`
- validation Run `35363942705`: SUCCESS.
- additive compatibility flag `publication_storage_version=0` 후보 설계 완료.
- 기존 rows / old TEST / old PRODUCTION Worker는 version 0 legacy path 유지.
- new 066 Worker의 brand-new Music Note INSERT만 version 1 opt-in.
- version 1은 9 secondary tracks indexes + D1 derived mirror + legacy shared revision write 제외.
- shared R2 Feed/Profile/card mutation authority 연결 PASS.
- TypeScript / Build PASS.
- live shared D1 migration/apply/deploy는 아직 0건.

## 다음 구현/감사 순서

1. **Feed 2페이지 이후 read 비용 감사**
   - version=1 Music Note가 secondary D1 index에서 빠져도 cursor pagination이 전체 table scan으로 폭증하지 않게 한다.
   - 이미 생성 중인 shared R2 W2 rank object를 우선 사용.
   - existing version=0 legacy rows는 현재 D1 인덱스 경로를 유지.
   - full Feed rebuild/backfill 금지.

2. **검색 최소 구조 감사**
   - 유지 기능은 곡 제목 / 장르 / 아티스트 닉네임·handle.
   - 아티스트는 public profile 검색 경로 재사용.
   - title/genre를 D1 publication hot path에 새 FTS/index write로 붙이면 W3가 되므로 금지.
   - explicit search에서 bounded read가 더 싼지, R2 lightweight index가 더 싼지 실제 계산 후 선택.
   - Suno URL/legacy/source-type 검색용 secondary index는 신규 Music Note W2 row에 유지하지 않는다.

3. **공개프로필 pagination/track count 감사**
   - 첫 화면 shared R2는 유지.
   - version=1 새 공개가 profile 2페이지 이후에도 빠지지 않는지 확인.
   - 변경 한 곡 때문에 owner 전체 목록 rebuild 금지.

4. **독립 회귀검증**
   - app115 shared track-card.
   - app123 persistent Feed/shared-like.
   - 공개/비공개/재공개 state.
   - 좋아요/해제, 공개프로필, Explore latest/popular.
   - UI/CSS 변경 0.

5. 위 감사 PASS 후에만 shared D1 migration 실행 여부를 사용자에게 보고.
   - 실행 전 old TEST/PRODUCTION correctness 영향 확인.
   - migration 실행 자체는 별도 승인 없이는 금지.
   - 실행 후 PREVIEW Worker 066 배포 → 실제 PAGE SYNC first-public W1~W2 측정.
   - W3+면 즉시 중단/rollback 판단.

## 현재 환경

- PREVIEW app124
- TEST app124 / TEST_VERIFIED
- PRODUCTION app117
- app125: work branch static candidate only, 미배포

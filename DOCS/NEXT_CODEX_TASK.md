# NEXT CODEX TASK

상태: **Explore 좋아요 비용 최적화 구현 대기**

## 현재 기준
- branch: `preview`
- 앱 버전: `052`
- 작업 시작 기준: `f6312d1554fd5609855ed1991e19a3ce791ca0e2` 이후 최신 preview HEAD 확인
- PREVIEW Explore Worker: 032 활성화
- 사용자 실측: 좋아요 1회 CACHE LIVE에서 대략 D1 rows read 172 / rows written 20 수준 확인
- `/feed-revision` warm path는 D1 read/write 0 확인

## 작업 목표
사용자 체감은 즉시 유지하면서 좋아요 1회의 서버 비용을 줄인다.

우선 목표:
- 좋아요 버튼: 즉시 로컬 반영
- 동일 곡 연속 토글: 5초 idle 후 최종 상태만 서버 반영
- 정상 좋아요 1회에서 eager Feed/Profile cache 동기화 제거
- 좋아요 mutation이 전체 Feed/Profile 재조회 없이 끝나도록 유지
- D1 rows read를 현재 실측 172에서 대폭 감소
- D1 rows written 20의 정확한 구성요소를 verifier로 분해하고 안전하게 줄임
- 숫자 목표는 실제 PREVIEW 계측으로 확정하며 검증 전 수치를 완료로 주장하지 않음

## 설계 고정
### A. Client — 5초 optimistic debounce
- `src/services/exploreLikeService.ts`와 최소 호출부만 수정.
- 클릭 즉시 heart 상태와 표시 카운트를 로컬에서 바꾼다.
- 같은 track의 후속 토글은 5초 idle timer를 다시 시작한다.
- 5초 후 마지막 상태만 서버로 보낸다.
- 좋아요 → 5초 안에 취소면 서버 mutation 0이 가능해야 한다.
- 서로 다른 track은 서로 timer를 막지 않는다.
- 서버 실패 시 사용자에게 실패를 알리고 서버 기준으로 수렴 가능한 상태를 유지한다.
- 페이지 이동/탭 종료 때문에 pending 상태가 조용히 유실되지 않도록 작은 durable pending/outbox를 기존 persistent-cache 원칙에 맞게 사용한다. 새 외부 서비스 금지.
- 정상 Music Note 60초 저장과 Library는 수정 금지.

### B. Worker — eager derived cache refresh 제거
현재 032 runtime에서 좋아요 mutation 후 다음 함수들이 즉시 bounded Feed/Profile cache sync를 실행한다.
- `patchExploreFeedR2LikeCount(...) -> syncDerivedFeeds032(...)`
- `patchExploreProfileR2Like020(...) -> syncDerivedCache032(...)`

DB trigger journal이 이미 변경 ID를 기록하므로, 좋아요 요청 자체에서 latest/popular/profile 캐시를 다시 읽어 동기화하지 않는다.
- mutation 요청은 canonical like/stat + derived change signal까지만 처리.
- Feed/Profile cache는 다음 정상 revision/first-view 경로가 journal을 소비하여 갱신.
- 현재 사용자 UI는 optimistic patch로 즉시 보임.
- 다른 사용자는 기존 032 revision 흐름으로 eventual consistency.
- 전체 Feed scan/rebuild 금지.
- 필요하면 Cache API head invalidation만 허용하되 D1/R2 전체 rebuild 금지.

### C. D1 write amplification 감사 후 최소화
현재 `explore032_derived_track_update`는 단순 like_count 변화에도:
- global seq를 여러 번 증가
- feed track change 기록
- `profile:NEW.owner_uid` 기록
- owner가 안 바뀌어도 `profile:OLD.owner_uid`를 다시 기록
- owner/active가 안 바뀐 경우에도 track_count 보조 구문을 거침

Codex는 먼저 현재 20 rows written을 항목별로 설명하는 fixture/verifier를 만든 뒤 최소 수정한다.
안전한 우선 수정 방향:
- 한 derived-track update에서 필요한 global seq 증가는 가능한 한 1회로 축소
- NEW/OLD owner가 동일하면 profile change 중복 기록 금지
- owner/active 불변이면 track_count 보정 write 금지
- feed와 해당 owner profile에는 변경 신호가 각각 정확히 남아야 함
- concurrent mutations에서 cursor 누락/역행 금지

D1 trigger 변경은 shared canonical D1에 영향을 주므로 **코드/테스트/Work 감사 전 실제 migration 실행 금지**.
기존 TEST/PRODUCTION Worker가 공유 canonical 원본을 계속 읽을 수 있어야 함.

## 구현 범위
우선 확인/수정 후보:
- `src/services/exploreLikeService.ts`
- `src/pages/ExplorePage.tsx`
- `cloudflare/explore-worker/runtime/derived-cache.js`
- 필요 시 좋아요 관련 Worker patch/verifier
- trigger 최적화가 필요하면 새 migration 파일 + verifier (기존 적용 migration 파일을 과거 기록처럼 덮어쓰지 않음)
- `scripts/verify-explore-derived-cache.mjs`
- 좋아요 비용 전용 verifier/fixture는 기존 테스트 구조에 최소 추가

범위 밖:
- Music Note
- Library
- UI 레이아웃/색상/크기
- 공개/비공개/팔로우 구조 변경
- 전체 Feed 구조 재설계
- FCM/WebSocket/Queue 등 새 외부 인프라
- main/production

## 필수 테스트
1. 좋아요 1회: UI 즉시 + 5초 후 서버 1회
2. 좋아요 후 5초 안에 취소: 최종 상태만 반영, 가능하면 서버 mutation 0
3. 좋아요→취소→좋아요 연속: 마지막 상태 1회만 서버 반영
4. 서로 다른 곡 연속 좋아요: 각 최종 상태 누락 없음
5. 페이지 이동/새로고침/재접속: pending mutation 유실 없음
6. 네트워크 실패 후 재시도/수렴
7. 같은 계정 PC/모바일 최종 상태 일치
8. Feed 최신/인기와 공개프로필 likeCount가 다음 revision에서 정상 반영
9. warm `/feed-revision`: D1 read/write 0 유지
10. 좋아요 mutation 중 full feed/profile rebuild 0
11. TypeScript PASS
12. Build PASS
13. 기존 Explore verifier PASS
14. shared canonical 사용자 데이터 삭제/대량변환 0

## 비용 합격선
- CACHE LIVE에서 같은 초기화 절차로 전/후 비교.
- 좋아요 mutation D1 rows read는 현재 172 대비 명확히 감소해야 함.
- rows written 20은 원인을 분해하고 안전하게 감소해야 함.
- 최종 숫자는 PREVIEW 실제 계측값으로 기록.
- 전체 곡 수/사용자 수에 비례하는 비용이면 FAIL.

## 중단 조건
- 기존 TEST/PRODUCTION 코드와 공유 D1 호환이 깨질 가능성
- trigger 변경에서 concurrency/cursor 누락 가능성을 증명하지 못함
- pending like 유실 가능성을 해결하지 못함
- 좋아요 하나 때문에 전체 Feed/Profile rebuild가 다시 필요해짐

## Codex 완료 보고
- 기준 commit
- 최종 commit SHA
- 변경 파일
- 5초 debounce/outbox 동작
- Worker eager sync 제거 결과
- D1 write 20 구성 분석
- TypeScript / Build / 관련 Test
- migration 파일 유무
- 실제 migration/deploy는 실행하지 않았는지
- 남은 위험

완료 commit은 배포하지 않는다. 고위험 backend/D1 작업이므로 Work 독립 감사 후 ChatGPT가 PREVIEW 배포 여부를 판단한다.

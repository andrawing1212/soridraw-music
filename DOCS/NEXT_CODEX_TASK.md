# NEXT CODEX TASK

상태: **Explore 좋아요 033 PREVIEW 배포 완료 — 실제 CACHE LIVE 비용 계측 대기**

## 현재 기준
- branch: `preview`
- 앱 버전: `052`
- PREVIEW 앱 배포: Run `34436451189`, source `873764137fbf5347ccb148789a2eed600d933ba2`, PASS
- PREVIEW Explore Worker: 033 활성화
- Worker release source: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- Worker release run: `34492208967`, PASS
- PREVIEW Worker Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- 기존 사용자 실측 baseline: 좋아요 1회 CACHE LIVE 약 D1 rows read 172 / rows written 20
- 현재 warm `/feed-revision` 두 번째 호출: D1 read/write `0 / 0` 실제 PASS

## 이번 단계 완료
### Client
- 좋아요 클릭 즉시 optimistic 표시.
- 동일 곡 연속 토글은 5초 idle 후 최종 상태만 서버로 보냄.
- persistent outbox + retry로 페이지 이동/재접속 중 pending 상태 유실을 방지.
- 서로 다른 곡은 독립 처리.

### Worker 033
- 좋아요 mutation 내부의 eager Feed/Profile derived R2 refresh 제거.
- canonical like/stat 변경과 032 derived-change journal은 유지.
- 다음 정상 revision/first-view가 journal을 소비해 derived cache를 갱신.
- generated Worker verifier에서 Feed/Profile eager derived I/O 없음 PASS.

### 배포 경로
- canonical `.github/workflows/cloudflare-explore-preview-release.yml`을 재사용.
- `.deploy/preview-worker-release.trigger` 변경에만 Worker release가 실행됨.
- 일반 코드 push는 Worker를 배포하지 않음.
- 사용자가 Actions의 긴 Workflow 목록에서 수동 실행할 필요 없음.
- 배포 전 read-only D1 preflight, 배포 후 feed/profile smoke + warm revision 0/0 + TEST/PRODUCTION 비변경 검증 PASS.

## 공유 D1 관련 현재 상태
- `20260910_03_explore_like_write_optimization.sql`은 source/verifier fixture에만 존재.
- 실제 shared D1에는 이번 033 릴리스에서 적용하지 않음.
- 새 migration/seed/backfill/사용자 원본 write 없음.
- D1 trigger 최적화는 실제 033 비용 계측에서 rows written이 여전히 높을 때만 별도 고위험 작업으로 진행.

## 다음 실제 작업
1. PREVIEW CACHE LIVE를 같은 초기화 조건으로 시작.
2. 실제 로그인 계정에서 좋아요 1회를 수행.
3. 5초 idle 이후 서버 mutation이 1회인지 확인.
4. D1 rows read / rows written을 기록.
5. 기존 172 / 20 baseline과 비교.
6. Feed 최신/인기 및 공개프로필 likeCount가 다음 revision에서 정상 수렴하는지 확인.
7. 같은 계정 PC/모바일 최종 상태 일치 확인.

## 다음 판단
- D1 read가 크게 감소하고 write도 충분히 낮으면 033을 PREVIEW 비용 합격 후보로 유지.
- read가 감소했지만 write만 높으면 `20260910_03_explore_like_write_optimization.sql` 방향을 별도 Work 감사 후 실제 shared D1 적용 여부 판단.
- 비용이 전체 공개곡/사용자 수에 비례하거나 기능 수렴이 깨지면 FAIL, TEST 승격 금지.

## 절대 금지
- 실제 비용 결과를 측정하기 전에 개선 수치를 완료로 주장하지 않음.
- shared D1 migration/seed 자동 실행 금지.
- Music Note 60초 묶음 저장 변경 금지.
- Library Local First 변경 금지.
- UI/반응형 변경 금지.
- main/production 변경 금지.
- PRODUCTION 승인 없는 배포 금지.

## 현재 검증 결과
- App TypeScript: PASS
- App Build: PASS
- Worker 031/032/033 patch verifier: PASS
- Like client/outbox verifier: PASS
- Derived cache regression suite: PASS
- Worker deploy preflight fixture: PASS
- 실제 PREVIEW Worker deploy: PASS
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- warm `/feed-revision` D1 read/write 0/0: PASS
- TEST/PRODUCTION Worker unchanged: PASS
- main/production refs unchanged: PASS
- 실제 좋아요 1회 CACHE LIVE 비용: **미측정**

# NEXT CODEX TASK

상태: **PREVIEW 065 App + Worker 배포 PASS / 사용자 실사용 검증 전**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `065`
- 기능 기준 source: `3f73a1de19709a547891541436bcb6dcce348a51`
- App Run `34583313251` — PASS
- Worker Run `34583286386` — PASS
- active PREVIEW Worker: `f9c0f80d-b0af-4550-b59c-dec637f5e638`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 065 완료 내용
- 같은 계정 PC↔모바일 좋아요에서 하트 상태만 바뀌고 숫자가 남는 경로 수정.
- account signal에 원본 브라우저가 실제로 표시하는 liked + likeCount를 함께 전달.
- signal을 Explore 화면 밖에서 받아도 최근 숫자 패치를 로컬에 잠깐 보관하고 해당 곡 표시 시 재적용.
- 새 Firestore listener 없음.
- Worker intake는 `tracks + public_profiles + track_stats + likes` 대신 `explore_derived_tracks + explore_derived_profiles + likes` 사용.
- D1 schema/migration/backfill 없음.
- 035 10분 aggregate 유지.
- UI 변경 없음.

## 자동 검증
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` app version 065 / exact build PASS
- generated Worker + Wrangler dry-run PASS
- public/private track/profile fixture PASS
- canonical personal-like relation PASS
- 100 same-track aggregate PASS
- net-zero aggregate PASS
- Worker Feed/Profile/likes route smoke PASS
- revision warm D1 R0/W0 PASS
- TEST/PRODUCTION unchanged PASS

## 지금 필요한 사용자 실사용 확인
1. PC에서 좋아요 1개.
2. 약 1분 뒤 모바일에서 **하트/숫자 색뿐 아니라 숫자 값도 +1**인지 확인.
3. 모바일에서 좋아요 해제 후 약 1분 뒤 PC에서 숫자가 -1 되는지 확인.
4. 가능하면 CACHE LIVE에서 해당 likes batch의 D1 R/W 확인.

## 비용 판정
- 이전 실제 기준: 1곡 약 R3/W3, 3곡 약 R9/W3.
- 065 구조상 public state/count 원본 read 3종을 derived read 2종으로 줄였음.
- 실제 authenticated PREVIEW D1 수치는 아직 사용자 계측 전이므로 R2/R6를 확정값으로 기록하지 않는다.
- W3 감소 작업은 이번 릴리스에 포함하지 않았고 write 증가도 의도하지 않았다.

## 다음 단계
- 사용자 065 PC↔모바일 숫자 sync + CACHE LIVE 비용 PASS → 다음 승격 후보 확정.
- 사용자가 `테스트배포`를 요청하면 고정 `test_only` 파이프라인 사용.
- 사용자가 처음부터 `테스트 후 이상 없으면 정식까지`라고 명확히 승인하면 `test_then_production` 사용.
- PRODUCTION 단독/연속 승격은 명확한 승인 없이는 실행하지 않는다.

## 절대 보호
- 035 deferred aggregate + 10분 cron.
- Explore resume LOCAL zero-read.
- Music Note Local First + 묶음 저장.
- Library Local First.
- 사용자 원본 shared data.
- UI/반응형/간격/색상.
- 전체 Feed/Profile 재조회 및 추가 listener 금지.

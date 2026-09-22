# SORIDRAW Explore Like Final Architecture Lock

Status: **LOCKED**
Date: 2026-09-22
Branch: preview

이 문서는 app137 이후 Explore 좋아요 구조의 최종 기준이다.
앞으로 이 기능은 아래 계약에서 벗어나는 방향으로 임의 확장하지 않는다.

## 1. 최종 목표
- 하트/숫자는 클릭 즉시 local 반영.
- 마지막 클릭 후 30초 동안 여러 곡 변경을 한 묶음으로 저장.
- PC↔모바일은 변경된 곡만 동기화.
- 정상 캐시가 있으면 Explore 진입/재진입/앱 업데이트 때문에 개인 좋아요 전체를 다시 읽지 않음.
- 페이지 이동만으로 read/write가 발생하지 않음.

## 2. 비용 합격선
- 정상 캐시 + 데이터 변경 없음: Explore 진입 D1 membership R0.
- 정상 캐시 + 데이터 변경 없음: Explore 재진입 D1 membership R0.
- 앱 업데이트 때문에 개인 좋아요 전체 read 0.
- 페이지 이동 때문에 like write 0.
- 실제 좋아요 변경: 30초 묶음 1회 → interactive server intake W1 queue row 목표.
- 한 묶음에 여러 곡이 있어도 interactive intake는 queue row 1개.
- background 처리에서는 변경된 곡만 canonical/derived 갱신.
- 전체 좋아요/전체 Feed/전체 공개프로필 재생성 금지.

## 3. 쓰기 경로 — app121~124 검증 구조를 기준으로 고정
1. 사용자가 좋아요/해제를 누르면 UI/local cache/outbox 즉시 반영.
2. 마지막 클릭 기준 30초 trailing window.
3. 같은 곡 반복 클릭은 최종 desired state만 남김.
4. 30초 후 /v1/me/likes/batch 1회 전송.
5. Worker interactive hot path는 곡별 likes/track_stats direct settlement를 하지 않음.
6. Worker는 explore_like_batches_069에 묶음 1 row enqueue.
7. enqueue 성공이 durable acceptance.
8. background aggregate가 canonical likes + count를 변경된 곡만 처리.
9. shared Feed/profile/card도 변경된 곡만 targeted patch.

### 쓰기 금지
- interactive 요청에서 곡마다 relation/stat 직접 write.
- 좋아요 1묶음 때문에 개인 좋아요 전체 D1 scan.
- R2 실패 때문에 성공한 queue intake를 다시 D1 write.
- idle timer / rerender / navigation / focus 복귀가 실패 mutation을 자동 write retry.
- 페이지 이동 시 강제 flush.

## 4. 읽기 경로 — 이번 작업에서 검증된 local-first 장점만 유지
- 정상 device catalog가 있으면 화면 표시를 local에서 즉시 결정.
- Explore 진입/재진입은 D1 membership R0.
- /v1/me/likes visible-track scan은 정상 경로에서 금지.
- 새 기기/캐시 손상/catalog 부재 때만 1회 bootstrap.
- 앱 버전 변경 자체는 cache invalidation 사유가 아님.
- revision 변경은 전체 상태 폐기가 아니라 변경분 적용 신호.

## 5. PC↔모바일
- queue acceptance 후 same-account signal에는 변경된 track IDs + 최종 liked 상태만 포함.
- 다른 기기는 전체 목록 재조회 없이 해당 곡만 local catalog에 반영.
- 공개 likeCount는 shared targeted publication과 수렴.
- gap repair 때문에 정상 device catalog를 통째로 폐기하지 않음.

## 6. 실패/재시도
- queue intake 성공 후 notification/R2 실패는 acceptance를 실패로 되돌리지 않음.
- queue intake 자체가 불명확하게 실패하면 durable outbox는 보존.
- 시간 경과/페이지 이동만으로 자동 write retry하지 않음.
- 다음 명시적 사용자 변경 또는 read-only reconciliation에서 정리.

## 7. 보호 범위
- 공개/비공개, Explore Feed/검색/장르/아티스트 검색, 공개프로필, 팔로우, Music Note, Library 보호.
- UI/CSS/반응형/배치 변경 금지.
- TEST/PRODUCTION 비변경.
- 공유 사용자 원본 데이터 migration/backfill/delete 금지.

## 8. 실사용 합격 테스트
1. 정상 캐시 Explore 진입 → membership D1 R0.
2. Explore 재진입 → membership D1 R0.
3. PC 1곡 변경 → 30초 후 interactive queue intake W1 목표.
4. PC 3~6곡 연속 변경 → 30초 후 한 queue intake.
5. 처리 후 90초 무동작 → 추가 like write 0.
6. 다른 페이지 왕복만으로 추가 like write 0.
7. PC→모바일 변경곡 자동 반영.
8. 모바일→PC 변경곡 자동 반영.
9. 앱 업데이트 후 정상 local catalog 유지, 전체 membership 재조회 0.
10. 하트/공개 likeCount/내 좋아요 최종 일치.

## 9. 구현 순서
- Phase A: app137 direct settlement 제거 → 069 W1 queue intake 복구 → queue acceptance 뒤 changed-track signal.
- Phase B: local catalog/revision/changed-track merge만 남기고 direct-settlement 보정 상태 제거.
- Phase C: TypeScript/Build/회귀/isolated D1/PREVIEW PC·모바일 검증.

## 10. 변경 불가 기준
기능 보존 + W1 queue intake + R0 normal re-entry + changed-track sync 네 조건을 동시에 만족하지 못하는 새 비용 절감 구조는 채택하지 않는다.
더 좋은 아이디어가 생겨도 이 네 조건을 깨면 먼저 사용자에게 보고하고 중단한다.

# SORIDRAW NEXT CODEX TASK

## 최종 기준 — 2026-09-20 KST: 앱127 통합 하트/좋아요 코딩 검증 PASS·미배포

상세 기준은 `DOCS/CURRENT_RELEASE_STATE.md` 0BE. 이 절이 아래 127 진단·설계 단계의 미구현 상태를 대체한다.

- 사용자 기준: 빈/채운 하트, 실제 좋아요/해제, 숫자를 한 사용자 동작으로 취급해야 한다. 다만 전체 숫자에는 타인의 좋아요도 있으므로 하트에서 전체 수를 역산하지 않는다.
- PREVIEW 후보 변경: `src/services/exploreLikeService.ts` 단일 로컬 상태 계산, UID별 첫 R2 개인 좋아요 스냅샷 복구, 기존 RTDB 규칙을 이용한 batch 접수 후 대상별 최대50 변경 신호, 유실/중첩 알림 로컬 retry·gap 복구, 미검증 값 클릭 차단. `src/pages/ExplorePage.tsx`는 서비스 유효 상태로 토글 및 다른 기기 변화 반영. `src/services/exploreLikedTracksService.ts`는 개인 좋아요 리스트 캐시를 해당 상태에 합침. 새 `scripts/verify-127-atomic-personal-like.mjs`.
- 최종 Run `35498983342` PASS: 실행형 like transition + 127/126/125/124/123/110 회귀 + TypeScript + Build + Worker071 SHA 고정. 임시 154 테스트 Workflow 정리. GitHub preview 전용 commit; 현재 라이브 app126/Worker071 유지, app-version 126 유지. 원본 사용자 데이터/Worker/Rules 변경 및 배포 없음.
- 주의: 현재 ACK는 canonical commit 완료가 아니라 Cloudflare 큐 접수. 공유 숫자는 1분 집계 후 반영. RTDB 구독 + transaction 새 사용량/10만 사용자 운영비, 전용 PC↔모바일 실기기, 로그인/오프라인/오래된 TEST/PRODUCTION 코드 공존, likes R2 2000 ID 한도 처리(캐시 보존·클릭 차단)는 독립 감사 전. **아직 제품 실사용 PASS가 아님.**

### 다음 작업 (독립 Work 검증 우선)
1. `DOCS/WORK_AUDIT_CHECKLIST.md`와 0BE에 따라 고정 commit에서 read-only 코드/데이터/비용 독립 감사. 127 알림이 batch ACK보다 앞서 발송되지 않는지, 실패로 mutation을 중복 전송하지 않는지, pending outbox·역순 RTDB 결과·최대50 간격 유실 시 원본 R2 재검증이 정확한지 확인. RTDB 규칙/프로덕션 이전 코드 호환성/추가 비용 미검증은 PASS 선언 금지.
2. 필요하면 preview 코드만 재수정하고 새 commit+TypeScript/Build/127+과거 회귀 재검사. 워커·파이어베이스 원본 변경/데이터 전체 재생성/기기 캐시 전체 삭제 금지.
3. 사용자 별도 `프리뷰배포` 승인 후에만 app-version 127 고정하고 Firebase PREVIEW에 정확 버전 배포. 사용자 사진의 네 곡 개인 하트 PC·모바일 일치 및 변경 없음 재진입, 좋아요/해제, 검색/추천/최신/인기/프로필을 실측.
4. 좋아요/해제 D1 W1~W2 절대 합격선 및 R2/RTDB 사용량 기준 실패 시 TEST 승격 중단. main/TEST 및 production/PRODUCTION 변경 금지.

## 최종 기준 — 2026-09-20 KST: 앱126 개인 좋아요 하트 PC↔모바일 실사용 FAIL / 127 진단·설계

상세 `DOCS/CURRENT_RELEASE_STATE.md` 0BD 참조. 이전 비공개 SHA10 `1319e4479e`는 사용자가 직접 공개한 정상 작업으로 확인. 해당 경고 닫음; 임의 재비공개 금지.

- 모바일 추천 첫 두 곡 빈 하트+1, 세 번째·네 번째 채운 하트+1; PC 첫 네 곡 채운 하트+1. 공유 공개 수는 일치하지만 **개인 좋아요 소유 상태는 서로 다름**. 사진만으로 canonical membership 또는 어느 기기가 stale인지 단정 불가.
- `getExploreLikedTrackIds()`는 개인 liked-state 120 캐시에 ID가 이미 존재하면 `/v1/me/likes` 재확인하지 않는다. `observeExploreLikeAccountSyncSignal`은 의도적으로 no-op. `likeHydrationKeyRef`도 반복 재확인을 억제하며, 앱126 revision은 공용 Feed 숫자 전용. 따라서 하트만 영구적으로 예전 상태를 유지할 수 있다.

### Codex High 설계 우선, 별도 사용자 배포 승인 전 배포 금지
1. 119/120이 개인 RTDB replay를 없앤 비용 이유와 Worker likes batch ACK·canonical commit·기존 per-user R2 liked bundle 갱신 시점을 확인. 무조건 RTDB replay 복구/모든 진입 40 ID canonical D1 조회/좋아요 수에서 하트 역산 금지.
2. 실제 사용자 변경 때만 작고 UID-scoped된 변경 신호를 보내는 최소 구조 또는 이미 존재하는 저비용 확정 신호를 평가. 추가 구독·read/write 비용 및 10만 사용자 확장성, preview ↔ older TEST/PRODUCTION writer 호환성 확인 후 구현. 변경 없음 D1/Firestore 원본 read 0, 좋아요/해제 W1~W2 절대 보호.
3. 새 이벤트는 confirmed membership과 로컬 pending outbox를 구별. 다른 기기의 최신 confirmed 변화가 특정 track IDs에만 반영되며 로컬 미확정 클릭을 덮지 않음. 서로 다른 PC/모바일 로그인 세션, 30초 batch+1분 aggregate, 역순/누락/동시 이벤트, 잘못된 응답, 개인 좋아요 목록·추천·최신·인기·공개프로필 모두 검사.
4. 코드 + targeted verifier + TypeScript/Build + Worker dry run → commit 고정 → Work 독립 감사. 실제 계정 canonical membership 읽기는 사용자 인증 범위 내 최소 대상에 한정하고 사용자 원본 write/migration 금지.
5. PREVIEW 앱126 / Worker071 유지. 별도 프리뷰배포 승인 전 배포 금지, TEST/PRODUCTION 미변경. W1~W2 실측과 PC↔모바일 실사용 PASS 전 승격 금지.

## 최종 기준 — 2026-09-20 KST: PREVIEW 앱126 배포 PASS / 기기 실사용·이전 비공개 재공개 출처 확인 전

이 절이 아래 0BB의 126 미배포 상태를 대체한다. 상세 기준은 `DOCS/CURRENT_RELEASE_STATE.md` 0BC.

- 사용자 승인 범위: app126 PREVIEW Firebase Hosting만 배포. source/trigger commit `2c62108e2ad7b3c54ce41baf811dc45e603a8a01`; PREVIEW Hosting Run `35495184909` SUCCESS, exact build + app-version 126 PASS, TEST/PRODUCTION 비변경 PASS.
- preflight Run `35495097116` SUCCESS: 126/125/124/123/110/070 회귀, TypeScript/Build, Worker071 hash 고정. 앞선 Run `35495034377`은 이전 110 verifier의 app126 인식 실패로 배포 전 FAIL했고 검사 보완 후 재검증.
- PREVIEW Worker071 `a6fda48f-ec20-48b3-a08d-ef43128c2e43` 그대로, TEST/PRODUCTION Worker/Hosting 및 Firebase Functions/Rules 비변경. 이 작업의 사용자 원본 write 0.
- read-only postflight Run `35495431978` SUCCESS: 현재 canonical 공개곡 38곡, D1 likes 관계/derived, PREVIEW API/local/shared latest+popular 6목록 전부 좋아요 수 일치, Feed R2-only D1 R0/W0. **기존 비공개 SHA10 `1319e4479e`가 앱126 배포 이전 2026-09-20 15:31:38 KST에 원본 D1 공개 상태로 전환**된 사실 확인. 의도된 재공개인지 불명. 과거 private 미노출 PASS를 현재 상태에 적용 금지. 무단 원복/유저 원본 수정 금지.
- 임시 postflight는 처음 37곡 고정 및 예전 updated_at 검색으로 FAIL했으나 현행 상태와 원본 visibility를 구분해 재검증 후 PASS. 임시 Workflow 152/153 정리. 독립 Work, 사용자 PC/모바일 화면, 실제 mutation W1~W2는 미검증.

### 이어서 진행할 작업
1. 사용자 실제 모바일·PC에서 **인기 탭 방문 없이** 추천/최신 기존 두 곡(해제 상태) 빈 하트+숫자0 확인; 두 기기 동일 계정 소유 상태 및 30초 묶음 후 정상 수렴 검사. 상태 변경을 위한 무단 좋아요·공개 조작은 하지 않는다.
2. 과거 비공개 SHA10 `1319e4479e`의 현재 공개가 사용자 의도인지 확인. 사용자 승인 없이는 비공개로 재전환/원본 데이터 수정 금지. `updated_at`이 앱126 배포 전임을 보존하고 릴리스 때문에 공개됐다고 단정 금지.
3. 실제 사용자 요청별 D1 W1~W2, 변경 없는 재진입 Feed-data R0·원본 D1 R0/W0 확인. 작은 edge revision 요청과 full Feed-data read 구분. 비용·시각 FAIL 시 TEST 승격 차단.
4. TEST/PRODUCTION 구형 shared writer 위험과 Work 독립 감사 미해결. 명시적 별도 `테스트배포` 승인 전 main/TEST, 별도 `정식배포` 승인 전 PRODUCTION 코드 승격 금지. catalog flags 유지.

## 최종 기준 — 2026-09-20 KST: 앱125 실사용 stale count FAIL / PREVIEW 126 후보 코드 검증 PASS·미배포

이 절이 아래 앱125 `사용자 실사용 전` 기록을 대체한다. GitHub 상태 문서 `DOCS/CURRENT_RELEASE_STATE.md`의 0BB 참조.

- 사용자 PC에서 두 곡을 1→0 해제한 뒤 모바일 추천/최신의 빈 하트·숫자 1, PC/모바일 인기 숫자 0; 인기 왕복 뒤 모바일 최신도 0. **실사용 화면 정합성 FAIL**.
- read-only Run `35494118924` SUCCESS: 대상 SHA10 `9fef3a2199`, `abd7763bc1`의 canonical/relation/derived 및 PREVIEW API/local/shared 최신·인기 전부 0; 두 API D1 R0/W0. 서버 최신·인기는 정상이고 원인은 모바일의 이전 latest 캐시를 갱신하지 않는 앱125 경로로 확인. 데이터 write 0.
- 코드 수정: `src/pages/ExplorePage.tsx`에서 마지막 성공 revision 검사 시각을 요청 URL별로 보존. 캐시 렌더링만으로 120초 검증창을 리셋하지 않음. 오래된 추천/최신 첫 진입에서 작은 revision 확인 후 변경 때만 기존 R2 first-page를 가져와 수렴. 추천·최신 공통 최신 URL 유지, 인기 경유 불필요.
- 신규 `scripts/verify-126-explore-entry-like-count.mjs`; 기존 123 verifier를 새 진입 검사식과 호환되도록 최소 수정. 최종 Run `35494247124` SUCCESS: 126/125/123/124 회귀, TypeScript, Build PASS. 최초 Run `35494196072`은 이전 123 검사식의 구문 불일치로 FAIL했고 테스트 보완 후 재실행. 임시 검사 Workflow 150·151 삭제.
- 현재 실제 서비스는 **Firebase PREVIEW 앱125 + Worker071** 그대로. `public/app-version.json`도 아직 125. 수정 코드는 preview에만 있고 미배포. main/TEST/production/PRODUCTION 및 원본 데이터 변화 없음. 독립 Work, PC/모바일 신규 빌드 실사용, 요청별 D1 W1~W2 미검증.

### 다음 실행 (Codex High + 독립 Work 가능 시)
1. 고정된 최신 preview HEAD에서 126 후보의 작은 revision 조회가 origin D1/R2 전체 재조회 없이 동작하는지 추가 감사. `verify-125`는 app-version 125를 요구하므로 126 bump 시 테스트 버전 조건도 하위호환되도록 업데이트한 뒤 전체 합격선 재검증. app version을 사용자 데이터 초기화 근거로 사용하지 않는다.
2. 사용자 명시적 `프리뷰배포` 후에만 126 Firebase PREVIEW Hosting 정확 버전으로 배포. Worker071/Functions/Rules 재배포 불필요. 배포된 PC/모바일에서 두 곡 초기 숫자 0·빈 하트 확인 및 신규 1→0 좋아요 해제 뒤 인기 탭을 거치지 않은 최신/추천 수렴 확인.
3. 정상 캐시 재진입 Feed-data read 0 / 변경 시 작은 revision + bounded R2; D1 R0/W0. 사용자 좋아요·해제·공개·비공개 각각 D1 W1~W2 미측정 상태 유지, W3+면 FAIL.
4. 개인 하트 소유 상태와 공용 숫자를 혼동하거나 `liked ? 1 : 0` 식으로 숫자를 덮는 임시 보정 금지. 타 사용자 좋아요도 존재할 수 있으므로 사용자 실제 소유 상태는 별도로 검증.
5. TEST/PRODUCTION 구형 shared writer 위험 및 독립 감사 미해결. 별도 `테스트배포`/`정식배포` 승인 없이는 승격 금지. 기존 비공개/사용자 데이터/기존 UI/Music Note 60초 묶음 저장 보호.

## 최종 기준 — 2026-09-20 KST: PREVIEW app125 + Worker071 **배포 PASS / 사용자 실사용 전**

이 절이 아래 기록의 `미배포`·`배포 승인 대기` 상태를 대체한다.

- Worker source `e9ccd5d4092f24ae34457b81479eded73af59b87`, canonical SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- Worker PREVIEW Run `35491281571` SUCCESS, live `a6fda48f-ec20-48b3-a08d-ef43128c2e43`.
- Firebase PREVIEW Hosting app125 Run `35491378862` SUCCESS, locked source `e2bc5ee3e1845e6abb6c573e468a711f40f41fd3`; TypeScript/Build/exact deployed index/app-version 125 PASS.
- Postflight Run `35491493263` SUCCESS: 실제 PREVIEW API + local R2 + shared R2 latest/popular 37곡 전체 canonical D1 like 정합성 PASS; 기존 private 곡 미노출, D1 R0/W0, 원본 write 0, TEST/PRODUCTION 비변경.
- 이전 4곡 파생 R2 제한 복구 Run `35489878431` PASS; 9/18 동일 오류의 최초 writer 원인 미확정.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 기존 상태. catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF 유지.

### 다음 작업: 데이터 변경 없이 먼저 검증
1. 사용자 PREVIEW 실사용: **앱 125 최초 업데이트 후** 최근/추천/인기 전환시 동일 37곡 좋아요와 계정별 빨간 하트; PC ↔ 모바일 하트 소유·수치 수렴. 정상 캐시 재진입시 중복 R2/D1 읽기 여부. 실제 브라우저 실사용은 아직 미검증.
2. 관리자 진단으로 사용자 mutation별 실제 D1 `rows_written` 측정: 좋아요/해제, 공개/비공개 각각 W1~W2 PASS만 허용. W3+면 다음 승격 FAIL. 비용 원인 미확정 시 무한 재배포 금지.
3. 가능하면 독립 Work 감사: 071이 기존 070 경합/비공개 보호를 깨지 않는지, 125 업데이트 marker가 실패한 요청에서는 저장되지 않는지, 전체 재조회/데이터 덮어쓰기/시각 변경이 없는지.
4. 실제 캐시가 다시 0으로 회귀한다면 원본/관계/derived/card/local/shared의 한 곡별 타임라인으로 writer를 식별하고 **원인 우선 수정**. 전체 Feed 재생성·사용자 데이터 수정 금지.
5. TEST와 PRODUCTION 구형 059/064 shared snapshot writer 영향 해결과 전체 기능 검증까지 마친 후, 사용자 `테스트배포` 승인 시 main/TEST 승격. PRODUCTION은 별도 명확한 `정식배포` 승인 이후.
6. 정상 작동 기능, Music Note 60초 묶음 저장, UI/반응형, 사용자 공유 원본 D1/Firebase, PREVIEW와 protected 버전 분리 유지.

최종 갱신: 2026-09-20 KST — app125/Worker071 후보 소스 검증 PASS, PREVIEW 미배포

## 현재 기준
- 사용자 요구: 업데이트 후 기존 좋아요·하트 유지, 업데이트 첫 1회 공유 상태 반영, 재방문시 원본 D1 data read 0. 전체 공개곡 검사 필요.
- 전수 read-only Run `35489084396`·`35489176377`: 전체 공개곡 37, 원본/관계/파생 37/37 일치, 4곡만 PREVIEW local/shared Feed count=0·원본=1.
- 대상만 R2 복구 Run `35489878431`: 4곡만 PREVIEW local/shared latest/popular 0→1, 무관 곡 불변, D1 write 0.
- 실제 PREVIEW live Feed 전곡 parity Run `35489951050`: latest/popular 각각 37/37 PASS, 테스트 당시 LIVE app124·Worker070 유지.
- 후보: app125 `src/pages/ExplorePage.tsx`와 `public/app-version.json`; Worker071 source `cloudflare/explore-worker/canonical/preview-worker.js` SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- 최종 코드/회귀/TypeScript/Build/Worker dry-run Run `35490609131` SUCCESS. 125 최초 refresh는 정렬별 release marker로, 유효한 shared R2 first-page snapshot 반영 후만 완료. 오류 시 로컬 캐시 보존 및 재시도. 071은 공개·재공개시 대상 PK canonical count=1 보존, 진짜 unlike=0 허용, 원본 부재 시 파생 쓰기 차단.
- **현재 라이브는 app124 / PREVIEW Worker070 `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf` 그대로.** TEST·PRODUCTION 변경 없음, Firebase 배포 없음.

## 다음 실행
1. 이 후보의 독립 Work 감사: `DOCS/WORK_AUDIT_CHECKLIST.md` 기준, GitHub 고정 commit·canonical SHA 확인, app125 first-refresh 오류/중복·다른 기기, 071 publication profile/Feed read/write, 기존 070 private/like CAS, 구형 TEST/PROD shared writers 영향. 감사자가 없으면 Work PASS를 자칭하지 말고 미검증 표기.
2. 실제 좋아요 1회 D1 W1~W2 및 신규 공개/비공개도 W1~W2 비용 미검증. 071 대상별 D1 조회 비용·중복 조회를 확인하되 전체 Feed scan 금지.
3. 사용자의 명시적 `프리뷰배포` 요청을 받으면 고정 app125 + Worker071을 한 버전으로 PREVIEW 배포, Firebase app·Worker 각각 성공 확인 및 app125 exact build/Worker SHA, 37곡 latest/popular D1 parity, private target absent, R2 first update/재진입 R0/W0, PC/모바일 동기화 실사용. 하나라도 FAIL면 다음 승격 금지.
4. PREVIEW 검증 완료 후 사용자 `테스트배포` 승인 시 main/TEST 전체 승격. PRODUCTION은 명확한 별도 정식배포 승인 후에만.
5. 공유 원본 D1, Firebase 데이터, 반응형/UI, Music Note 60초 묶음 저장 변경 금지. catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF 유지.

## 남은 위험
- 과거 4곡 1→0 마지막 writer의 실제 타임라인 증거 부족. 071은 publication에서 stale 0 우선 병합을 제거했지만 다른 라이브 writer/구형 TEST·PRODUCTION까지 영구 안전을 보장하지 않음.
- 기존 private 곡은 계속 비공개. 무단 full Feed rebuild/backfill/migration/TEST/PRODUCTION 배포 금지.
- 신규 사용자 mutation 비용 W1~W2/PC·모바일 실사용 아직 미검증.

최종 갱신: 2026-09-20 KST — 동일 4곡 canonical like 1 / PREVIEW local+shared 0 재발 FAIL

## 최우선 작업: 공개 좋아요 숫자 재하락(write provenance) 규명 후 targeted 방지
- 사용자가 업로드한 69초 PREVIEW PC 영상은 추천/최신/인기 간 같은 곡 0↔1 및 채워진 하트와 수치 불일치.
- Run `35488556374` (read-only): canonical D1 `track_stats.like_count=1`이나 PREVIEW local+shared latest/popular 및 실제 Feed R2-only=0인 4곡 확인. latest↔popular 현재 shared 내부 mismatch=0, 영상 인기 1은 local per-sort 이전 캐시일 수 있음.
- Run `35488673580` (read-only): TEST/PRODUCTION local latest/popular와 shared track-card는 해당 4곡 모두 1. 기존 9/18 동일 4곡 shared targeted repair Run `35345067282` 이후 같은 문제가 재발.
- 070 PREVIEW 배포 Run `35457463038`은 성공했으나 **좋아요 정합성 검사가 없었음**. 실제 오류 지속, TEST/PRODUCTION 승격 차단.

### Codex High / Work 경계
1. `cloudflare/explore-worker/canonical/preview-worker.js` 내 043/056/059/064/065/069/070과 active reader, shared track-card 062, session-cache 124의 실제 write 순서/조건을 집중 추적. 먼저 어떤 경로가 기존 shared 1을 0으로 덮었는지 **관측/정적 근거**로 좁힐 것. TEST/PRODUCTION local은 1이므로 구형 writer가 0을 썼다고 가정 금지.
2. 네 곡 canonical ↔ local ↔ shared Feed ↔ card/프로필의 소스 일치성 가드를 설계. 사용자 행동이 없는 재진입/업데이트에서 D1 원본 읽기 0; 실제 변경된 track ID만 R2 CAS 갱신; 전체 Feed/전체 profile scan 금지.
3. app124의 1회 marker/actor 좋아요 overlay가 더 오래된 탭 로컬 캐시를 영구 권위로 사용하지 않도록 **데이터 revision 기반** 수렴 검사. 앱 버전 변경만으로 강제 서버 읽기 금지. 같은 곡 모든 탭·프로필의 숫자와 하트 소유 상태가 독립적으로 올바른지 테스트.
4. 기존 `scripts/verify-123-shared-like-cache-repair.mjs`, `scripts/verify-116-explore-public-count-convergence.mjs`, `scripts/verify-070-shared-feed-guard.mjs`를 가능한 재사용. `D1=1 / PREVIEW local+shared=0 / TEST·PRODUCTION local=1 / card=1` 회귀 fixture 필수.
5. 구현 → 관련 test → 최종 TypeScript/Build/Worker dry-run → commit 고정 → Work 독립 감사. 실배포·D1/R2 원격 write 금지.
6. 감사 PASS 후에만 **정확히 진단된 4곡**을 canonical state/updated_at 확인 + CAS로 derived R2 제한 복구하고 user approval 후 PREVIEW 배포·실제 API parity를 확인. 기존 비공개 곡은 유지.
7. 좋아요 1회 rows_written W1~W2는 별도 요청 측정. 신규 좋아요·해제 사용성 테스트는 데이터 정합성 수정 전 중단.

## 보호
- 현재 live PREVIEW `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`, app124.
- TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 불변.
- catalog WRITE ON / READ OFF / FIRST_PUBLISHER OFF, 배포·승격 중단.
- canonical D1/Firebase data write/migration/backfill/사용자 전체 데이터 복사 금지.
- UI/반응형/정상 60초 Music Note 묶음 저장 비변경.

최종 갱신: 2026-09-20 KST — PREVIEW 069/070 배포 PASS / TEST 승격 전 사용자·비용 검증 대기

## 현재 고정 기준
- PREVIEW release source: `dc95856ad8299b3ed8746b2fd4d2dbdd574cda4b`.
- PREVIEW Worker Release Run `35457463038` SUCCESS.
- live PREVIEW Worker `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`.
- canonical Worker SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- postflight Run `35457550389` SUCCESS: preview.soridraw.com HTTP 200, app 124, latest/popular R0/W0, private target absent from PREVIEW local/shared 37/37.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged.
- Firebase unchanged.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.

## 다음 작업
1. PREVIEW 사용자 실사용에서 기존 private 상태 유지/Explore 노출 없음/PC·모바일 일관성 확인.
2. 새 private→republish 검증은 아직 TEST/PRODUCTION 구형 shared writer가 살아 있으므로 범위를 좁혀 신중히 진행. 기존 known private 곡은 임의 재공개 금지.
3. 요청당 D1 rows_written 실측: private/public/like/unlike 각각 W1~W2만 PASS. W3+면 즉시 실패 처리.
4. 사용자가 **테스트배포**를 명시 승인하면 검증된 PREVIEW exact tree를 main/TEST로 승격하여 TEST Worker에 069/070 적용 후 shared/local parity와 비용 재검증.
5. PRODUCTION은 TEST 전체 PASS + 사용자의 명확한 정식배포 승인 후에만 승격.
6. catalog READ/FIRST_PUBLISHER 전환은 별도 승인/검증 작업으로 유지.

## 금지
- 사용자 원본 D1/Firebase migration/backfill/전체 Feed rebuild.
- generic 계속 진행을 TEST 또는 PRODUCTION 승인으로 해석.
- W1~W2 미검증 상태에서 TEST/PRODUCTION 비용 합격 선언.

최종 갱신: 2026-09-19 KST — 070 cross-env dry-run PASS / 실제 stale cache 4개 수리 PASS / 승격 승인 대기

## 현재 고정 사실
- 070 product canonical commit `2720607faa9ede08221e4b9a15c5a30967c622bc`, Worker SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- Run `35451900664`: 070 코드/TS/Build/PREVIEW Worker dry-run PASS.
- Run `35452733928`: 동일 070 Worker가 현재 TEST/PRODUCTION live bindings으로 **dry-run PASS**, 실제 Worker versions 불변.
- Run `35452779963`: TEST/PRODUCTION local latest/popular가 실제 38곡 + private target 포함, PREVIEW/shared는 37곡 + target 없음으로 stale 위험 실증.
- Run `35452879050`: TEST/PRODUCTION local 4 snapshots에서 대상 private ID만 CAS 제거하여 38→37; postflight PREVIEW/TEST/PRODUCTION local + shared 8 snapshots 모두 37 / target absent. canonical D1/user-origin write 0.
- 라이브 PREVIEW는 아직 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`. TEST `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`도 070 미배포.
- 현재 곡은 비공개 유지. catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.

## 다음 실행 게이트
1. 더 이상의 private/republish 실사용 mutation은 **구형 TEST/PRODUCTION writer가 살아 있는 동안 중단**. 현재 곡의 stale local cache는 수리됐지만 다음 곡은 다시 stale될 수 있음.
2. 사용자가 **테스트배포**를 명시 승인하면 정상 릴리스 순서로:
   - 먼저 PREVIEW 070 exact SHA 배포 및 smoke/R0W0 확인.
   - 070이 적용된 PREVIEW를 사용자 검증.
   - 검증 완료본 exact tree를 main/TEST로 승격하여 TEST Worker의 059/064 bulk writer 차단 확인.
   - shared/local snapshot parity, 기존 private target 부재, like/private CAS, D1 W1~W2를 TEST에서 재검증.
3. PRODUCTION은 TEST 전체 PASS 후 사용자의 **명확한 정식배포 승인** 전에는 코드/설정 변경 금지.
4. PRODUCTION 승격 후에만 세 활성 Worker 모두 070 guard 보유를 확인하고 새 private→republish 실사용 검증을 재개.
5. READ/FIRST_PUBLISHER ON은 별도 작업. W3+ mutation이면 승격 중단.

## 안전 기준
- 원본 D1/Firebase 사용자 데이터 이동/대량수정/전체 Feed rebuild 금지.
- 기존 private 곡을 테스트 편의상 임의 재공개 금지.
- cache repair는 현재처럼 canonical private guard + 대상 ID 1개 + ETag CAS + unrelated item byte equality 검증이 없는 경우 실행 금지.
- generic “계속 진행”은 PRODUCTION 승인으로 해석하지 않는다.

최종 갱신: 2026-09-19 KST — 070 PREVIEW 소스 검사 PASS, 실배포 및 cross-env 보안 게이트 미해결

## 최우선 배포 전 경계
- 070 code commit `2720607faa9ede08221e4b9a15c5a30967c622bc`, canonical source SHA256 `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`, SHA pin `ffb97fe94e80ca28ccf64548677a94eae5c01e18`.
- Run `35451900664` SUCCESS: 069+070 patch parity, old full mirror 059/064 disabled in **070 source only**, targeted like CAS conflict against private, TS/Build, Worker --dry-run.
- 069 shared private/publish/options target helper는 그대로 유지. Catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- 라이브 PREVIEW Worker는 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`; 070 아직 미배포. main/PRODUCTION Worker는 이전 versions와 059/064 전체 shared snapshot writer를 유지한다.
- Run `35451509693`: 특정 곡의 shared latest/popular 각 37, 비공개 유지, 실제 복구 put 0. 지속 안전 보장 아님.

## 다음 단계 — PRODUCTION 승인 전까지 코드/설계/검증만
1. 현재 TEST/PRODUCTION 구형 059/064 전체 writer 호출 가능성을 고정 source/API로 재검증. 오래된 환경의 **원본과 캐시의 역할을 분리**하고 새 targeted writer와 cold recovery의 호환 조건 명시.
2. 올바른 전체 승격 절차를 설계: 전체 snapshot 무조건 덮어쓰기를 차단한 코드가 **공유 v112를 쓰는 모든 활성 Worker**에 설치되기 전에는 비공개 곡의 재노출 위험을 0으로 판정하지 않는다. 검증되지 않은 PRODUCTION hotfix 자동 적용 금지.
3. 불가피하게 PRODUCTION 코드 변경이 포함된다면 **사용자 명확한 PRODUCTION 승인 선행**. preview→TEST 검증 후 production, 이전 환경 기능 유지, 배포 실패 시 롤백과 shared cache 방어 계획 제시.
4. 공유 스냅샷 신규 bootstrap/cold 회복은 정상 페이지마다 전체 DB 읽기를 일으키지 않도록 별도 제한된 절차. 070의 059/064 no-op로 초기화 불가 시 안전한 fallback/알림 확인. 정상 cache 재진입 R0/W0.
5. 필요 시 사용자 계정에서 기존 곡 private→republish 단독 실사용 및 D1 W1~W2 요청별 측정. W3+면 FAIL.
6. READ/FIRST_PUBLISHER ON 및 TEST/PRODUCTION 승격은 자동 진행 금지.

## 변경 불가 기준
- 원본 D1/Firebase 사용자 데이터 이동·대량 수정/전체 Feed 재생성 금지.
- 070 PREVIEW 수정본이 자체 테스트 PASS였다는 이유로 모든 환경 보호 PASS로 보고 금지.
- 사용자 기존 곡은 비공개 유지.

최종 갱신: 2026-09-19 KST — 069 재오염 방지 독립 감사 FAIL, 단일 비공개 캐시 37/37 수렴 확인

## 최우선: shared Feed 환경 간 재오염 방지 구조
1. 069 자체 동작/TypeScript/Build/Worker dry-run PASS (`35450819828`), 하지만 059/064 구형 shared Feed 전체 mirror가 `preview`·`main`·`production` canonical Worker에 남아 있어 PREVIEW 069만 배포해도 stale local snapshot이 private 곡을 shared latest/popular에 재삽입할 수 있다. 069 PREVIEW 배포 **중단**.
2. 사용자 비공개 곡의 현재 D1/catelog/shared R2: TEMP 137 Run `35451509693` PASS, shared latest/popular 37/37, target absent. **이번 repair write 0**(이미 수렴). 단, 구버전 writer 재오염 위험 미해결.
3. Codex High에서 059/064/065 전체 snapshot 미러, 각 환경의 shared read/write, 069 targeted mutation, 구형 TEST/PRODUCTION 배포 상태를 대상으로 **환경별 코드 승격 없이도 공유 사용자 데이터가 재노출되지 않는 보호 설계**를 먼저 제시. 기존 shared R2의 무조건 overwrite 구조를 통제하거나 환경별 파생 캐시를 분리해야 한다. 장기적으로 전체 Feed 반복 read/rebuild 비용 금지.
4. 안전한 공존 방안이 없으면 사용자에게 먼저 보고하여 TEST/PRODUCTION 호환 배포 순서의 명시적 승인을 요청한다. 사용자 승인 없이 main/PRODUCTION/원본 D1 변경 금지.
5. 재오염 방지까지 독립 감사 PASS → 정확한 SHA로 PREVIEW Worker만 승인 배포 → 실제 API/PC·모바일 및 D1 W1~W2 검증. READ 및 FIRST_PUBLISHER OFF 유지.
6. 현재 해당 곡은 비공개 유지. 별도 재공개 검증 전까지 사용자에게 원복 요구 금지.

## 고정 소스 및 이전 결과
- product source commit `62c5741d773183d3064bcd53dc70a74179aad535`, sha pin commit `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- source SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`; live PREVIEW Worker 기존 `4f8471e3-576f-49de-9f2c-c3863021bf3d`.
- PREVIEW code 069 미배포, TEST/PRODUCTION/Firebase 미변경. 비용 W1~W2 미검증.

최종 갱신: 2026-09-19 KST — 069 targeted shared Feed parity 코드 PASS / PREVIEW 배포 및 기존 stale 복구 전

## 고정 기준
- preview product canonical 069 source commit `62c5741d773183d3064bcd53dc70a74179aad535`; source SHA pin `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- canonical Worker SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`.
- Run `35450819828` PASS: 069 unit, official patch byte-for-byte parity, TypeScript, Build, Worker dry-run. No deploy.
- PREVIEW active Worker still 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`; catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- main/production not promoted. No Firebase change.

## 다음 작업 순서
1. 가능한 경우 Work 독립 감사: 069 diff, active 043 private/publish/options connection, catalog fail-closed guard, R2 CAS race, 059/064 mirror와의 간섭, D1 read/write 0, UI 비변경. 감사 중 제품 수정/배포하지 않음.
2. 별도 사용자 PREVIEW 배포 승인 후 source SHA 고정 → 기존 canonical release Workflow로 PREVIEW Worker만 배포 → live version/flags/latest/popular R0/W0/protected environments 확인. Firebase 불필요 배포 금지.
3. 사용자 승인된 **대상 비공개 1곡만** 읽기 전용으로 D1 `is_public=0`, catalog `public=false`, shared latest/popular stale 여부를 확인한 다음, shared 두 객체에서 해당 ID만 조건부 제거하는 bounded derived R2 repair 실시. 원본 D1/Firebase write 0; catalog/Feed 전체 rebuild 금지. 보호 환경 공유 데이터임을 고려.
4. PREVIEW/TEST/PRODUCTION 공개 경로에서 비공개 곡 미노출 확인; 뒤늦은 059/064 catch-up으로 재노출 없는지 확인. 38→37 shared first-page convergence 합격.
5. 사용자 별도 재공개 검증 → shared/catalog 재삽입, 요청당 D1 W1~W2 실측; 좋아요도 단독 테스트. W3+면 FAIL.
6. live parity 및 비용 PASS 후에만 catalog READ ON 별도 승인 대상으로 검토. FIRST_PUBLISHER, canonical D1 schema/index/trigger도 각각 별도 승인.

## 금지
- 배포 요청 없는 자동 배포, 공유 user origin migration/overwrite.
- private된 곡을 테스트용으로 무단 재공개.
- 전체 Feed/catalog 백필 또는 모든 shared cache 재복사.
- 검증되지 않은 W1~W2 PASS 선언, TEST/PRODUCTION 승격.

최종 갱신: 2026-09-19 KST — live private D1 PASS / catalog PASS / shared R2 latest+popular stale FAIL

## 최우선 차단 이슈 — 실제 PRIVATE 공유 Feed 파생 캐시 누락
- TEMP 134 Run `35449942592`: D1 private 1건 `updated_at=1789829348623` 검출, 해당 catalog meta `public=false`, marker 0 PASS. shared latest는 여전히 private 곡 포함 FAIL.
- TEMP 135 Run `35450000210`: PREVIEW 최신/인기 공개 API는 37곡으로 private 곡 미노출. 그러나 shared R2 latest/popular v112 각각 38곡에 private 곡 잔존 FAIL. PREVIEW 일반 latest 첫 접근은 D1 R2/W0 관측; warm 진단 latest와 popular는 R0/W0.
- 코드 원인 후보: `043-publication-targeted-r2-hotpath.mjs`의 실제 `syncExploreFeedR2Private043` 호출 경로에 `059-shared-feed-r2-parity.mjs`가 감싼 구형 `syncExploreFeedR2Private017` 공유 mirror가 연결되지 않음. 064 catch-up은 `syncDerivedCache032` 실행 시에만 동작.
- **이번 곡은 비공개 유지. 테스트를 위해 다시 공개시키지 않는다.** 배포/원본 데이터 수정/전체 feed 또는 catalog 재생성 금지.

### Codex 다음 구현 명령(High, preview 코드만)
1. 043 비공개 경로에서 local Feed R2 targeted mutation 이후 shared latest/popular v112까지 동일 곡이 제거되도록 단일 변경 연결을 설계한다. 가능한 기존 `mirrorExploreSharedFeeds059` 및 CAS/동시성 보호를 재사용하며 새로운 전체 D1 조회·전체 Feed rebuild를 넣지 않는다.
2. 이미 private가 된 곡의 shared snapshots만 대상으로 하는 idempotent bounded repair 경로를 설계하고, 실사용 원본 데이터 변경 없이 복구 전후 값 비교/안전 중단 조건을 정의한다. 복구 실행은 별도 검증·승인 경계로 둔다.
3. 043/059/064 연동과 TEST/PRODUCTION 공유 소비자 호환성을 감사한다. 공개/비공개/옵션 등 실제 호출마다 누락 경로가 없는지 확인한다.
4. 현재 PREVIEW 첫 latest 요청 D1 R2의 원인이 캐시 cold/invalidation인지 확인한다. 정상 재진입 R0 유지가 조건이다.
5. 검증: 특정 private 곡이 local, shared latest/popular, catalog에서 모두 미노출; 같은 곡 재공개 시에만 복원; 공개/비공개 요청당 D1 W1~W2 실제 측정; unrelated objects unchanged. 38 전체 rebuild 금지.
6. TypeScript/Build/관련 Test 성공 → commit → Work 독립 감사. 배포는 사용자 요청 없이는 실행하지 않는다.
7. 감사 PASS 뒤에만 PREVIEW 배포 요청/진행. READ/FIRST_PUBLISHER flags OFF 유지. TEST/PRODUCTION 승격 불가.

## 현재 게이트
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- live private D1/R2 catalog PASS, shared Feed FAIL.
- W1~W2 요청당 증명 아직 불가.
- 과거 완료 synthetic test PASS가 이번 실사용 FAIL을 덮어쓰지 않음.

최종 갱신: 2026-09-19 KST — 사용자의 양방향 동작 이후 D1 변경 기록 0개 관측, 실사용 W1~W2 검증 보류

## 최우선 다음 작업
- TEMP 132 Run `35449664860`: 14:23Z 이후 tracks/stats 변경 0개, like queue 0, shared latest 38, first-page R0/W0. 실사용 mutation 후보 0개로 W1~W2/실제 catalog delta 미검증.
- TEMP 133 Run `35449712958`: 마지막 tracks 변경 2026-09-18T13:02:05.205Z, 마지막 stats 변경 2026-09-18T10:49:28.148Z. 밀리초 timestamp 확인.
- 실제 비공개→공개를 동일 페이지에서 원복하면 page-exit outbox가 원상태로 합쳐질 수 있음. 좋아요→해제도 30초 idle 안에서는 net-zero 가능.
- 다음은 **비공개 단일 동작 → Music Note 페이지 이탈 → D1/R2 사후 점검**. 그 결과를 확인한 뒤 별도 재공개. 좋아요도 별도 동작/전송/지연 처리 후 해제.
- 요청별 D1 W1~W2는 사후 DB만으로 입증 불가능하므로 관리자 진단의 해당 요청 메트릭 또는 실제 응답 헤더 확인 필요.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF 유지. 무단 배포/재구축/사용자 원본 변환 금지.

최종 갱신: 2026-09-19 KST — PREVIEW catalog WRITE staged ON + synthetic targeted delta PASS / live authenticated mutation 검증 전

## 현재 고정 기준
- PREVIEW product baseline: `ba723fb817aa2de99cf28821d85c48b4261455b8`
- staged WRITE release trigger: `380b147125ee1cebc4f897fd7b4588784e69801c`
- PREVIEW Worker Release Run: `35448197594` SUCCESS
- active PREVIEW Worker: `4f8471e3-576f-49de-9f2c-c3863021bf3d`
- canonical 068 Worker SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`
- catalog bootstrap Run: `35447123476` SUCCESS
- staged delta validation Run: `35448560216` SUCCESS
- app version: 124
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged
- Firebase unchanged

## 현재 derived R2 / flags 상태
- public tracks baseline: 38
- owners: 3
- shared profiles: 3/3
- shared track-card: 38/38
- exact catalog objects: **432**
  - meta 38
  - latest 38
  - popular 38
  - profile 38
  - genre 21
  - title 250
  - artistMeta 3
  - artistName 3
  - artistHandle 3
- `SORIDRAW_R2_CATALOG_V1`: **ON**
- `SORIDRAW_R2_CATALOG_READ_V1`: OFF
- `SORIDRAW_R2_FIRST_PUBLISHER_V1`: OFF
- latest/popular first page: D1 R0/W0

## staged write 검증 결과
Run `35448560216`:
- 066/068 live integration contract PASS.
- synthetic publish: 해당 track marker 8개 + meta만 추가.
- same-state republish: changed=false.
- like count change: popular marker 1 remove + 1 add.
- private: 해당 track marker 8개만 제거, tombstone meta 유지.
- republish: 해당 track marker 8개만 복구.
- artist create: name/handle 2 + meta.
- artist nickname/handle edit: 2 remove + 2 add.
- cleanup 후 catalog exact baseline **432**.
- latest/popular first page D1 R0/W0.
- canonical D1 write 0.
- user origin data change false.
- TEST/PRODUCTION/Firebase unchanged.

## 다음 실제 작업

### A. live authenticated mutation parity — PREVIEW only
현재 남은 핵심 검증이다. 실제 로그인 사용자 행동을 통해 Worker의 canonical D1 mutation과 catalog delta가 함께 맞는지 확인한다.

권장 최소 세트:
1. 기존 공개곡 1개를 private.
2. 같은 곡을 republish.
3. 기존 공개곡 좋아요 1회.
4. 같은 곡 좋아요 해제 1회.
5. 프로필 nickname/handle edit는 실제 값 훼손 없이 안전하게 원복할 수 있을 때만 수행.

각 행동마다:
- D1 rows_written = **W1~W2만 PASS**.
- W3+ 즉시 FAIL.
- 전체 Feed/profile/catalog scan/rebuild 0.
- catalog 전체 432 재생성 금지.
- 변경된 track/profile marker만 이동.
- latest/popular first page R0/W0 보호.
- PC/모바일 공유 결과 수렴 확인.

### B. live mutation postflight
- private 후 해당 곡 catalog public marker 제거 확인.
- republish 후 해당 곡 marker 복구 확인.
- like/unlike 후 popular marker만 필요한 순위 위치로 이동 확인.
- profile edit 후 artist name/handle marker만 이동 확인.
- canonical D1과 shared R2/card/feed count parity 확인.
- 사용자 원본 데이터 의미 변경 없음 또는 테스트 전 상태로 정확히 원복.

### C. catalog READ cutover
A/B가 PASS해도 자동 진행 금지. 별도 사용자 승인 필요.
- `SORIDRAW_R2_CATALOG_READ_V1=1` 검토.
- title search / genre browse / artist nickname / handle search.
- Explore/profile deep-page.
- first page는 기존 안정 경로 보호.
- warm revisit D1 R0/W0.
- legacy fallback/rollback 유지.

### D. 이후 별도 승인
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` ON.
- shared canonical D1 partial-index/trigger Phase D.
- 둘 다 별도 승인 없이는 실행 금지.

## 금지
- catalog READ flag 조기 ON.
- first-publisher flag 조기 ON.
- 432 catalog 전체 rebuild.
- shared canonical D1 migration/index/trigger/user-row rewrite.
- 무단 사용자 데이터 변경.
- Firebase 재배포.
- TEST 승격.
- PRODUCTION 승격.

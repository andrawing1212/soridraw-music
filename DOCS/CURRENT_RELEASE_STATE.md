## 0MK. PREVIEW app295 — Library My/Shared 폴더 공통 revision 30초 묶음 저장 (2026-10-02 KST)

**목표**
- 사용자 요청: My / Shared playlist 폴더의 불필요 Firestore write를 기능 손상 없이 가능한 선에서 축소.
- app294의 새 폴더 생성 직후 R0 개선과 기존 changed-item RTDB 즉시 동기화는 그대로 보호.

**app295 구조**
- 폴더 자체 canonical 변경은 지연하지 않음:
  - playlist create: `user_playlists/.../lists/{id}` W1 즉시.
  - playlist rename: 해당 list document W1 즉시.
- 기존 매 create/rename마다 붙던 `users/{uid}.syncVersions.playlists` W1은 UID 단위 **30초 trailing batch**로 분리.
- 같은 UID에서 30초 안 create/rename이 N번이면 목표 canonical write는 기존 `W2 x N` → **folder WN + users revision W1 = W(N+1)**.
  - 1회 작업은 총 W2로 기존과 동일.
  - 2회 연속은 W4 → W3.
  - 5회 연속은 W10 → W6.
- 현재 app PC↔mobile 화면 반영은 기존 RTDB `userSync/{uid}/libraryPlaylist` changed-item signal을 그대로 즉시 사용하므로 30초를 기다리지 않음.
- TEST/PRODUCTION 구버전 호환용 Firestore revision만 묶으며, Library 페이지를 숨기거나 이탈하면 pending revision을 조기 flush해 호환 지연을 줄임.

**안전 장치**
- pending revision은 localStorage + memory fallback에 보관. 일반 reload/navigation으로 의도가 사라지지 않음.
- 현재 세션에서 이미 관측한 RTDB latest syncVersion을 monotonic floor로 재사용하여 정상 batch flush에 추가 RTDB read를 붙이지 않음.
- 세션 재시작 등 floor가 없을 때만 shared RTDB latest signal을 1회 확인. 확인 실패 시 낮은 revision을 쓰지 않고 fail-closed로 pending 유지.
- item add/delete/move/color/order-swap, playlist delete, playlist reorder처럼 기존 users revision을 즉시 쓰는 경로가 더 높은 version을 확정하면 오래된 folder pending batch를 제거하여 중복 delayed write 방지.
- USER_PROFILE_CACHE_EVENT에서 더 높은 remote playlist revision을 받는 경우에도 오래된 local pending을 제거.
- 기존 app294 empty-folder items cache seed 유지: create 직후 Firestore item read R0 목표.
- folder delete / item mutation / playlist reorder canonical write 구조는 이번 범위에서 변경하지 않음.
- 사용자 데이터 migration/backfill/delete 없음. schema 의미 변경 없음.

**변경 파일 / commits**
- 신규 `src/services/libraryPlaylistRevisionBatch.ts`: `bcc346c0aa2499ea06937c230d94e73de13645c8` 이후 안전 보강 `516e9e74b9ae6b0c3e3e13bdd6476b9fc51b19c3`, `e465146bac3651da652269f4a34ade5691ed4fba`.
- `src/services/playlistService.ts`: create/rename users revision batch 분리 + immediate mutation pending retire. 핵심 commits `bde6b4528c3bd9b380685d4a5b50865c011d78a1`, `77aa75f73dc6459af82ca96811270ba42ec2c480`.
- `src/pages/SunoLibraryPage.tsx`: durable batch resume / visibility-pagehide flush / remote newer revision retire. commits `4cd2700b460b4297186f7cb815289d01e6049f3c`, `3c1af755a9cda7cee1ef08e774500bfd7ff4de12`.
- app294 verifier forward-compatible: `d4345c43eadfbf3d336a98aab06e4a47512b656a`.
- app version 295: `fa9dc0d2693bb2bc9a42a5ad04a9b67c5307f746`.
- 신규 focused verifier: `scripts/verify-295-library-folder-revision-batch.mjs`, latest `69902bce0a216341b5872c5eb1d2f724d72731f6`.

**검증 상태**
- Backend V2 Step 2-A Safety Run `36942643704`: SUCCESS (초기 playlistService batching 적용).
- Backend V2 Step 2-A Safety Run `36943137531`: latest playlistService signal-floor 보강 기준 SUCCESS.
- Release System Audit Run `36943212496`: TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 audit는 app294 때와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` assertion 때문에 FAIL; app295 Library 경로와 무관.
- 최종 Release System Audit Run `36943416655`: latest memory fallback 포함 TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 static 단계는 동일한 기존 `verify-221` stale assertion만 반복 FAIL.
- Firebase PREVIEW Release Run `36943574387`: **SUCCESS**.
- locked PREVIEW source: `b3ce248ee41ac075a8713b37d6aaa77755fac028`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **295**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**실기기 비용 확인 목표**
- 새 folder 1회: Firestore R0 목표, 즉시 folder W1 + 30초 후 users revision W1 = 총 W2.
- folder create/rename 5회 연속 후 30초 대기: 기존 W10 대신 목표 **W6**.
- 같은 구간 D1 R0/W0, Worker 0 유지.
- 반대 기기에서는 폴더 생성/이름 변경이 30초 대기 없이 즉시 보이는지 확인.

## 0MJ. PREVIEW app294 — Library 새 폴더 생성 직후 불필요 read 제거 (2026-10-02 KST)

**사용자 실기기 app293 비용 확인**
- 영상 누적 Browser SDK: Firestore read 3 / write 15.
- Cloudflare / Worker / D1: R0/W0.
- Music Note folder rename은 곡 수와 무관하게 structure W1 / favorites W0로 동작 확인.
- Library My/Shared playlist create/rename은 현재 하위호환 canonical 계약대로 W2 유지.
- 남은 read 3은 새 Library playlist 3개 생성 직후, UI가 방금 생성된 빈 폴더를 선택하면서 items cache가 없어 `user_playlists/.../items getDocs`를 각 1회 실행한 경로로 확인.

**app294 수정**
- `src/services/playlistService.ts`의 `createPlaylist()` canonical commit 성공 직후:
  - playlist list cache patch와 함께
  - 새 playlist ID의 items cache를 같은 `syncVersion`의 빈 배열로 즉시 seed.
- 방금 생성된 폴더는 canonical로 빈 폴더임이 이미 확정돼 있으므로, 선택 직후 `SunoLibraryPage`의 items loader가 이 로컬 cache를 current로 인정하고 Firestore `getDocs`를 생략.
- My / Shared 양쪽 모두 같은 `createPlaylist()` 경로를 사용하므로 공통 적용.
- create canonical write 계약은 **W2 그대로**. RTDB changed-item signal, 기존 playlist list/items revision 구조, UI는 변경 없음.
- create-and-save 경로도 먼저 빈 current items cache를 갖게 되어 후속 첫 item insert의 warm R0 판단을 그대로 사용할 수 있음.

**폴더 30/60초 묶음 저장 판단**
- 이번 app294에서는 적용하지 않음.
- 서로 다른 폴더 create/rename은 각각 별도 canonical playlist 문서이므로 단순 writeBatch로 네트워크 요청을 묶어도 Firestore 과금 write 수 자체는 줄지 않음.
- 같은 폴더 이름을 짧은 시간 여러 번 바꾸는 경우 final-intent batching은 기술적으로 가능하지만, 현재 PREVIEW가 TEST/PRODUCTION 구버전과 shared data를 동시에 사용하고 `users.syncVersions.playlists` 하위호환 신호도 유지해야 해 즉시 canonical W2 계약을 우선 보호.
- 향후 별도 최적화 시 가장 현실적인 후보는 여러 playlist 변경의 공통 `users.syncVersions.playlists` revision write를 UID 단위로 묶는 방식이며, old-client convergence와 crash/reload durability를 먼저 설계해야 함.

**변경 commit**
- product fix: `7decc68c80114eae11129894135346992054b7cb`.
- focused verifier: `be1ee8cc091f4150510ba16abdc485b44e4689cf`.
- app version 294: `42ea54fc1284d46e8030240d51633bae64d661cf`.

**검증/배포 상태**
- `scripts/verify-294-library-new-folder-r0.mjs` 추가: create 경로에 server `getDocs`가 없고 canonical 성공 후 새 playlist의 빈 items cache를 같은 syncVersion으로 seed하는 계약 고정.
- Release System Audit Run `36941393567`: **FAIL**. 단, 이번 수정과 직접 관련된 TypeScript / Build 및 진단 그룹 A~D는 PASS. 최종 static 단계에서 기존 `verify-221-explore-feed-layout.mjs`가 현재 Music Note detail hydrate 구현 형태를 옛 정규식으로 검사해 assertion FAIL. app294 Library 변경 경로와 무관하며 이 작업에서는 제품/검사 범위를 넓혀 수정하지 않음.
- Firebase PREVIEW Release Run `36941526371`: **SUCCESS**.
- locked PREVIEW source: `3c9f1d67a72aaf9b94408f0d050752f8b47e439f`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **294**, exact build PASS.
- shared RTDB Rules: SKIPPED (변경 없음).
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: 없음.
- Worker / Functions / D1 / Firestore Rules 변경: 없음.
- 실기기 다음 확인: My/Shared에서 새 폴더 생성 시 `user_playlists:getDocs`가 더 이상 증가하지 않아 **create 직후 R0**인지 확인.

## 0MI. PREVIEW app293 배포 완료 — Library changed-item sync + Music Note folder rename 비용 절감 (2026-10-02 KST)

**배포/검증 기준**
- 기준 branch: `preview`.
- 제품 구현 시작: `b3f4443ecb873006eb93f4dd6e3a4df05556470e`.
- missed-delta 안전 보강: `c86a9ae7b86349ddb3ef39f4d059434441f8cba4`.
- RTDB continuity rules: `f49ca39ba717dc62afbecba0c2ab5184c63081bf`.
- focused verifier 최종: `35986cee25f6dcf128fa9c61b37a5bcbc4661783`.
- runtime cleanup: `e7b0c172dd2a9763911263c46924fc098980b537`.
- app version 293: `dfc094b13ef4c0a98378c22dc740766319489275`.
- PREVIEW release/locked source: `d0a0fd540e7104c7a70be82489758a14e30e48c9`.
- 최종 focused Audit Run `36938832665`: **SUCCESS**.
- Backend V2 Safety Run `36938820471`: **SUCCESS**.
- Firebase PREVIEW Release Run `36939049573`: **SUCCESS**.
- remote `preview.soridraw.com`: app **293**, exact build PASS.
- shared RTDB rules: exact source match + deploy PASS.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: **없음**.
- Worker / Functions / D1 / Firestore Rules 변경: **없음**.

**Library My/Shared Playlist**
- 기존 canonical Firestore 구조와 `users.syncVersions.playlists` / `itemsRevision`을 유지하여 app292 이하 TEST/PRODUCTION과 하위호환.
- 변경 성공 후 UID-scoped RTDB `userSync/{uid}/libraryPlaylist`에 최대 24KB changed-item delta 1개를 게시.
- 정상 cache + 연속 signal이면 반대 기기는 Firestore를 다시 읽지 않고 IndexedDB list/item cache를 직접 patch.
- signal은 `previousSyncVersion` continuity token을 포함. 기기가 offline 중 중간 delta를 놓쳤거나 payload가 oversized/truncated이면 cache revision을 거짓으로 앞당기지 않고 기존 Firestore fallback 1회로 복구.
- warm add/move에서 destination item cache가 current이면 duplicate + max-order 계산을 로컬에서 처리하여 사전 Firestore read **R0 경로**.
- warm playlist delete는 current item cache의 IDs를 사용하여 삭제 대상 탐색 Firestore read **R0 경로**. 실제 item canonical delete write는 데이터 삭제이므로 그대로 유지.
- canonical write 수는 이번 단계에서 의도적으로 유지:
  - playlist create/rename: W2.
  - item add/delete: W3.
  - item move: W5.
  - item order swap: W4.
  - 이유: TEST/PRODUCTION 구버전도 shared canonical data 변화를 계속 감지해야 하므로 parent/items revision + users revision을 아직 제거할 수 없음.
- Library social like `toggleTrackLike`의 R2/W2 transaction은 **이번 app293 범위 밖, 미변경**. 별도 후속 최적화 대상.

**Music Note**
- folder rename은 `user_structures/{uid}`의 folder structure만 canonical로 갱신.
- 기존 song의 `noteFolderTitle/sharedNoteFolderTitle` legacy copy는 읽기 호환용으로 그대로 두고 더 이상 rename 때 N곡을 재작성하지 않음.
- folder membership/filter는 기존처럼 stable folder ID를 사용.
- 코드상 rename 비용 목표: 기존 `structure W1 + favorites WN` → **structure W1 / favorites W0**.
- folder delete는 곡들의 folderId를 default로 실제 변경해야 하므로 현재 WN을 유지. 구버전 호환을 깨지 않고 제거할 수 없어 이번에는 건드리지 않음.

**보호된 기존 기능**
- app292 Recent 150초 UID-wide canonical batch 유지.
- Studio heart 30초 per-song final-intent batch 유지.
- favoriteCount 30초 UID-wide batch 유지.
- Music Note Detail draft/batch/RTDB preview 유지.
- Library workspace warm cache/re-entry R0 경로 유지.
- Explore / public like / 공개·비공개 / split UI 미변경.

**검증**
- TypeScript PASS.
- Build PASS.
- `APP293_LIBRARY_PLAYLIST_DELTA_SYNC=PASS`.
- `APP293_LIBRARY_WARM_INSERT_SERVER_R0_PATH=PASS`.
- `APP293_LIBRARY_WARM_DELETE_DISCOVERY_R0_PATH=PASS`.
- `APP293_MUSIC_NOTE_FOLDER_RENAME_W1_ONLY=PASS`.
- Library 101 / 030 / 116 warm-cost regressions PASS.
- Music Note Detail 031 PASS.
- app289 heart / app290 Recent / app290 Studio heart / app291 lyrics regressions PASS.
- 첫 Audit Run `36938199952`의 FAIL은 제품 코드가 아니라 app196 이후 변경된 Recent sync gate를 옛 문자열로 검사하던 `verify-116`의 stale assertion 때문. 현재 pure `needsRecentSongsServerRead()` 의미 기준으로 verifier를 갱신한 뒤 final Audit SUCCESS.

**실기기 확인 전 비용 판정**
- 위 수치는 code/static guard 기준.
- PC↔모바일 실제 즉시 반영과 CACHE LIVE Firestore R/W는 사용자 실기기 검증 전까지 **실사용 검증 전**.
- 사용자 `테스트배포` 지시 전 main/TEST 승격 금지.

## 0MH. Music Note / Library 저장·동기화 비용 구조 감사 (2026-10-02 KST)

**범위 / 상태**
- 코드 수정/배포 없이 현재 PREVIEW app292 구조를 정적 감사.
- Music Note 목록 버튼, Detail 편집, My/Shared Note 폴더, Library Workspace, My/Shared Playlist 폴더·아이템, 기기간 동기화 경로 확인.
- 아래 비용은 코드 경로 기준이며 별도 실기기 CACHE LIVE 재측정 전에는 운영 실측값으로 단정하지 않음.

**Music Note — 현재 좋은 구조**
- 목록 개인 좋아요/잠금:
  - 로컬 + localStorage 즉시 반영.
  - UID-scoped RTDB `musicNoteCardStateDelta`로 반대 기기 즉시 반영.
  - 페이지 안 반복 클릭은 Firestore W0.
  - dirty state를 페이지 이탈 시 `user_structures/{uid}.musicNoteCardState` 한 번 W1로 저장.
- Detail 제목/프롬프트/가사 등:
  - 필드 저장은 local durable draft에 합산하며 field-save마다 Firestore write 없음.
  - title/detail/Suno media preview는 compact RTDB preview로 반대 기기 반영.
  - canonical flush 시 해당 `favorites/{id}` W1.
  - 현재 실제 `scheduleFavoriteDetailFlush()`는 no-op이므로 오래된 60초 설명과 달리 자동 60초 flush는 없음; page-exit/manual/recovery 중심.
- Detail open:
  - 목록은 compact catalog summary.
  - 필요한 경우에만 exact `favorites/{sourceId}` 1건 hydrate; detail cache 재사용.
- My/Shared Note 폴더 구조:
  - folder metadata는 `user_structures/{uid}` aggregate + local cache/session.
  - folder add/reorder는 structure W1.
  - structure RTDB changed patch로 반대 기기 갱신; persistent Firestore structure listener 없음.
  - 기존 폴더에 1곡 배치/제거는 해당 favorite W1; N곡 선택은 changed-song-only WN.

**Music Note — 개선 필요 지점**
- 폴더 이름 변경:
  - structure W1 이후 해당 폴더의 모든 favorite에 중복 저장된 `noteFolderTitle/sharedNoteFolderTitle`을 다시 써서 **W1 + W(폴더곡수)**.
- 폴더 삭제:
  - structure W1 이후 해당 폴더 모든 곡을 default folder로 옮겨 **W1 + W(폴더곡수)**.
- 원인: song 문서에 folderId뿐 아니라 folderTitle을 중복 저장.
- 향후 개선 방향: folderId를 canonical membership으로 유지하고 화면 title은 structure에서 resolve, legacy title은 fallback만 사용하도록 하위호환 전환하면 rename fan-out을 W1로 줄일 수 있음. 사용자 승인 전 schema 의미 변경/백필 금지.
- 공개(globe) 경로는 Explore Worker/R2/D1 별도 보호 경로. warm publication-state read는 revision/R2 cache 중심이며 D1 R0/W0 경로가 있으나, 이번 감사에서 Worker mutation rows_written을 재실측하지 않았으므로 기존 동결 기준을 임의 수정하지 않음.

**Library Workspace — 현재 좋은 구조**
- authenticated session 동안 workspace snapshot/listener를 한 번 유지하고 page re-entry는 in-memory/IndexedDB cache 재사용.
- 정상 재진입은 server read 0 목표 경로.
- 더보기는 full local catalog의 UI pagination만 수행하여 추가 server read 없음.
- 색상 변경은 화면/로컬 먼저 변경하고 page exit에 changed keys만 저장.

**Library My / Shared Playlist — 비용 개선 필요**
- playlist list는 IndexedDB cache + `users.syncVersions.playlists` revision gate를 사용해 warm entry R0 가능.
- 하지만 cross-device 변경은 Music Note/Recent처럼 changed-item RTDB payload로 직접 patch하지 않고 revision 상승 후 collection refresh:
  - list revision이 바뀌면 playlist list collection 재조회.
  - active playlist의 `itemsRevision`이 바뀌면 그 playlist의 **전체 items collection 재조회**.
- mutation canonical 비용:
  - 폴더 생성/이름변경: list doc W1 + users revision W1 = **W2**.
  - 곡 추가: duplicate/order 확인 bounded read(최대 source query 8 + tail 1) + item W1 + parent itemsRevision W1 + users revision W1 = **W3**.
  - 곡 삭제: item W1 + parent revision W1 + users revision W1 = **W3**.
  - 곡 이동: new item W1 + old item delete W1 + source parent W1 + target parent W1 + users revision W1 = **W5**, plus bounded duplicate/order reads.
  - 순서 swap: two item W2 + parent W1 + users W1 = **W4**.
  - folder delete: 먼저 folder items 전체 `getDocs` 후 item 수만큼 delete + folder delete W1 + users revision W1 → **R/W가 폴더 곡 수에 비례**.
  - playlist color sync: changed item마다 item + parent revision + users revision = **W3/item**.
- Library playlist social like `toggleTrackLike`:
  - 클릭마다 canonical relation + count 2건 transaction read, 변화 시 relation + count 2건 write.
  - local optimistic UI는 있으나 Recent/Studio heart 같은 trailing batch/RTDB cross-device final-intent 구조는 아님.
- 따라서 **Library My/Shared Playlist는 app292 Recent/Music Note 수준의 비용 최적화라고 판정할 수 없음**.

**안전한 다음 최적화 후보 — 아직 미실행**
1. Library playlist changed-item RTDB signal + local cache patch로 cross-device one-item change 시 전체 playlist items reread 제거.
2. playlist item mutation의 parent revision/users revision 중복 write 축소 또는 UID aggregate/batched revision 설계.
3. playlist folder delete의 full items read/delete fan-out 재설계.
4. Library social like를 local-first + final-intent batch 방식으로 전환 가능한지 별도 설계.
5. Music Note folder title duplication 제거를 backward-compatible 방식으로 설계해 rename fan-out 제거.
6. Music Note Detail의 실제 no-idle-flush 동작과 오래된 60초 문서 설명을 정리하되, 사용자 승인 없이 정상 동작 변경 금지.

## 0MG. Song Save / Edit / Sync Cost 스킬 저장 (2026-10-02 KST)

- 신규 스킬: `.agents/skills/song-save-edit-sync-cost/SKILL.md`
- 기준 문서: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app292-save-edit-sync-cost-baseline.md`
- 범위:
  - Studio 저장/해제 하트 30초 per-song canonical batch
  - Recent Song 제목/프롬프트/가사 150초 UID-wide aggregate batch
  - PC↔모바일 RTDB 즉시 changed-item preview
  - preview receiver Firestore R0/W0 원칙
  - `users.favoriteCount` UID-wide 30초 derived-delta batch
  - net-zero W0 / changed-item-only / durable pending / stale overwrite 방지
  - app289~292 회귀검사와 실기기 비용 확인 기준
- `AGENTS.md`에 관련 작업 전 신규 스킬 필수 확인 규칙 추가.
- 코드/백엔드/사용자 데이터 변경 없음.
- PREVIEW/TEST/PRODUCTION 배포 변경 없음.

## 0MF. Music Note 저장곡 수 통계 batch 구조 유지 확정 (2026-10-02 KST)

**사용자 결정**
- 실제 저장/해제 곡 문서는 곡별 정확한 canonical 상태를 유지.
- `users/{uid}.favoriteCount`는 파생 통계이므로 클릭마다 쓰지 않고 UID 단위 30초 delta batch를 유지.
- 같은 30초 안 여러 곡 저장/해제는 `+1/-1` 변화량을 합산해 `users.favoriteCount`를 한 번만 갱신.
- 합산 결과가 0이면 통계 write 0.
- 이 통계값을 저장 제한/권한/결제 판정의 canonical 기준으로 사용하지 않음.

**현재 실제 코드 확인**
- `src/services/musicNoteFavoriteCountBatch.ts`에 이미 위 구조가 구현되어 있음.
- UID별 단일 pending delta + 30초 trailing timer + localStorage 복구 구조.
- 실제 canonical favorite 변경이 성공한 경우에만 `queueMusicNoteFavoriteCountDelta(uid, ±1)`를 호출.
- 따라서 추가 기능 수정은 불필요하며 현재 구조를 정상 기준으로 동결.
- UI/백엔드/데이터 구조 변경 없음. 배포 불필요.

## 0ME. PREVIEW app292 배포 완료 — Recent canonical batch 150초 + 다중곡 동작 확인 (2026-10-02 KST)

**사용자 결정**
- Recent Song 제목/프롬프트/가사 canonical Firestore trailing batch를 60초 → **150초**로 연장.
- PC↔모바일 즉시 화면 반영 RTDB preview는 그대로 유지.
- Studio Music Note heart의 30초 per-song batch는 변경하지 않음.

**동작 기준**
- Recent Song 편집:
  - 같은 UID의 Recent 목록 전체가 하나의 aggregate document이므로 pending snapshot/timer도 UID당 1개.
  - 150초 안에 A곡 제목 → B곡 프롬프트 → C곡 가사처럼 서로 다른 곡을 수정해도 매 수정마다 같은 150초 timer가 다시 시작됨.
  - 마지막 수정 후 150초가 지나면 그 시점의 Recent 목록 최종 상태를 canonical 1회 저장.
  - 현재 구조 기준 canonical 비용은 곡 수가 아니라 aggregate 1회 기준 `user_recent_songs W1 + users.syncVersions W1 = W2`.
  - 즉시 RTDB preview는 변경된 각 곡만 보내며 Firestore R0/W0.
- Studio heart:
  - **Recent 편집과 다름.**
  - heart pending/timer는 favorite document ID(곡)별 Map으로 관리.
  - A곡 heart 후 B곡 heart를 눌러도 A곡 30초 timer는 B곡 때문에 다시 시작되지 않음.
  - 같은 곡을 다시 누를 때만 그 곡 timer가 reset되고 final state로 collapse.
  - 여러 곡의 final heart 상태가 각각 달라지면 canonical favorite write도 각 곡 W1씩 필요.
  - 다만 `users.favoriteCount` 파생 통계 delta는 UID 단위 30초 batch로 합쳐질 수 있음.

**수정 / 검증**
- verified source commit: `34127904db7bb158ebcae28000fa65745fe56c8b`.
- release request commit: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- apply/audit Run `36932805247`: **SUCCESS**.
- `APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS`.
- `APP292_RECENT_MULTI_SONG_AGGREGATE_BATCH=PASS`.
- app290 Studio heart batching regression PASS.
- app291 lyrics live preview regression PASS.
- app289 Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- TypeScript PASS / Build PASS.
- 임시 apply workflow는 verified source commit에서 제거됨.

**PREVIEW 배포**
- Firebase PREVIEW Run `36933026848`: **SUCCESS**.
- locked deploy source: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- `preview.soridraw.com` app **292** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

## 0MD. PREVIEW app291 배포 완료 — Recent 가사 편집도 PC↔모바일 즉시 반영 + app290 실기기 비용 확인 (2026-10-02 KST)

**app290 사용자 실기기 / CACHE LIVE 비용 확인**
- 사용자 영상(약 2분 10초) 기준 브라우저 SDK server read **0** 유지.
- D1 **R0 / W0**, Cloudflare Worker **0**.
- 최종 관측 write:
  - `favorites:write 1`
  - `user_recent_songs:write 1`
  - `users:write 2`
  - 합계 Firestore SDK write **4**.
- 의미:
  - Studio heart 실제 최종 변경 1회 = canonical favorite W1 + 30초 묶음 `users.favoriteCount` W1 → **총 W2**.
  - Recent 제목/프롬프트/가사 연속 편집 = `user_recent_songs` W1 + `users.syncVersions.recentSongs` W1 → **총 W2**.
  - 편집 3종이 각각 W2로 반복되던 기존 W6은 재현되지 않고 최종 1묶음 W2로 collapse.
  - 읽기는 0이므로 app290 비용 hard gate(W1~W2/action) 기준 통과.
- CACHE LIVE에서 Music Note/Recent cache hit은 증가했지만 원본 Firestore read 증가 없음.

**사용자 실기기 기능 확인**
- 제목 수정 후 저장 → 반대 기기 즉시 반영.
- Studio 저장 하트 → 반대 기기 즉시 반영.
- 프롬프트 수정 → 반대 기기 즉시 반영.
- 가사만 즉시 반영되지 않고 약 60초 canonical batch 뒤 반영되는 증상 발견.

**가사 지연 ROOT CAUSE**
- Recent edit RTDB preview에는 최신 top-level `lyrics.korean/english`가 이미 포함되어 있었음.
- 그러나 Studio 가사 렌더는 `appliedKeywords.lyricsByLanguage`를 우선 사용.
- 수신기에서 top-level lyrics는 갱신했지만 기존 `lyricsByLanguage` map은 그대로 남겨서 화면이 오래된 가사를 계속 표시.
- 60초 후 canonical aggregate가 full `lyricsByLanguage`를 가져오면서 그때 화면이 바뀌어 "1분 뒤 반영"처럼 보였음.
- 서버 전송 지연이 아니라 **수신 기기 로컬 merge 누락**이 원인.

**app291 최소 수정**
- `src/App.tsx` Recent edit preview 수신 시:
  - 기존 RTDB payload의 최신 `lyrics.korean/english`를
  - 수신 기기의 `appliedKeywords.lyricsByLanguage`에도 즉시 local merge.
  - secondaryLanguage를 보존하여 영어 외 일본어/중국어 등 기존 2차 언어 위치도 유지.
- **추가 RTDB write 0**.
- **추가 Firestore R0/W0**.
- canonical 60초 batch와 비용 구조는 app290 그대로.
- 제목/프롬프트/하트/Music Note app289 경로 비변경.

**검증**
- 제품 수정 commit: `9ca5c6707dcd1b2b0380d88d5b28e5b32813a5d3`.
- historical app289 verifier version pin 보정 commit: `65fcdf2a6d5e4e7fa31ad5348580761643b356a3`.
- app291 Audit Run `36929318487`: **SUCCESS**.
- TypeScript PASS / Build PASS.
- `APP291_RECENT_LYRICS_PREVIEW_LOCAL_LANGUAGE_MAP=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_EXTRA_RTDB_WRITE_ZERO=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_FIRESTORE_R0_W0=PASS`.
- app290 Recent cost batching regression PASS.
- app290 Studio heart batching regression PASS.
- app289 oversized Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- 임시 app291 audit workflow 제거 완료.

**PREVIEW 배포**
- release commit: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- Firebase PREVIEW Run `36929528762`: **SUCCESS**.
- locked source: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- `preview.soridraw.com` app **291** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

**다음 실기기 확인**
1. PC/모바일 모두 app291 확인.
2. 같은 Recent Song의 한글/2차언어 가사를 수정 저장 → 반대 기기에서 **1분 대기 없이 즉시** 변경되는지 확인.
3. 제목/프롬프트/하트 즉시 반영 회귀 없음 확인.
4. 비용은 app290과 동일하게 Recent 편집 최종 W2, heart 실제 최종 변경 W2 이하 유지 확인.
5. 실기기 PASS 전 TEST 승격 금지.


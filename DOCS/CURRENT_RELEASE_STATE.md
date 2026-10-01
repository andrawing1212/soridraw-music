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


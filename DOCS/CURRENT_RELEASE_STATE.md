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


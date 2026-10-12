## CURRENT — PREVIEW app404 새로고침 후 개인 좋아요 이전값 복귀 수정 배포 SUCCESS / 실제 PC·모바일 검증 전 (2026-10-12 KST)

- **사용자 재현:** 같은 UID PC·모바일 간 실시간 좋아요·해제는 바르게 수신되지만 새로고침 시 이전 하트/숫자로 되돌아가는 app403 결함. 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」 사진 비교. 이 결함은 server 5분 정산 실사용 실패와 **별도**로 관리.
- **원인/수정:** `src/services/exploreLikeIntent416.ts` 수신 힌트는 이전에 모듈 메모리 전용, 재실행 첫 RTDB snapshot은 보안상 skip하므로 기존 canonical cache가 복귀. app404는 **실시간으로 실제 받은 동일 UID의 pending/accepted 잠정 변경만** 기기 localStorage에 UID-scoped 최대 50건·Master 최대 20분+30초 한도로 저장/복원. 무검증 cold RTDB 최초 snapshot replay는 계속 금지. rejected/정확한 accepted 또는 signed final receipt 시 같은 operationId overlay 제거, 계정 전환 시 삭제, 손상/만료/다른 계정 자료 무시. `exploreLikeService.ts`는 서버에 변화 없는 새로고침 시 viewer 전용 낙관적 하트-숫자 쌍만 복원. Canonical D1/R2/public cache 변경 없음.
- **코드:** `src/services/exploreLikeIntent416.ts`, `src/services/exploreLikeService.ts`, `scripts/verify-416-private-like-intent.mjs`, `.github/workflows/verify-408-like-repair-code.yml`, `public/app-version.json` (403→404). 구현 `3f86f10bd839f29312e547ed8d195c2bc0b2dae8`, QA 포함 `6428ab036ca097b5e7d77df13e4e1a859bd99833`, app404 버전 `d4a083b5155e396beb99f36d1752741ffee155ac`.
- **검사:** 408 Targeted Like Repair Quality [38240513420](https://github.com/andrawing1212/soridraw-music/actions/runs/38240513420) SUCCESS, **app404 exact** 408 QA [38240795296](https://github.com/andrawing1212/soridraw-music/actions/runs/38240795296) SUCCESS. Stage416 두 기기 시뮬레이션·동일 기기 refresh·거절·정확 최종 수신·다른 UID/손상/20m 만료·서버 추가 쓰기 0 재현 PASS. TypeScript, Build, 기존 좋아요/팔로우·Rules read-only PASS. 실제 브라우저 PC↔모바일 촬영 재검증 전.
- **PREVIEW 배포:** `preview` app404 Hosting only, 트리거 commit `5a6a0c52f467ac565d81ae25cd01c1187fa0b05a`, [Release Run 38241014684](https://github.com/andrawing1212/soridraw-music/actions/runs/38241014684) **SUCCESS**. `preview.soridraw.com` `PREVIEW_APP_VERSION=404`, exact `index.html` build SHA PASS, TEST/PRODUCTION Hosting 및 branch 비변경 PASS. RTDB Rules Deploy=SKIPPED, Firebase Functions/Cloudflare Worker/D1/R2/공유 원본 사용자 데이터 변경/마이그레이션/백필 0.
- **남은 위험:** 앱404는 **이미 그 기기에 수신된 잠정 상태**만 새로고침 때 보호하며, 다른 기기에서 앱을 꺼둔 동안 놓친 신호를 전계정 강제 동기화하지 않음. 임시 hint는 **canonical 확정이 아니므로** 만료 뒤 또는 서버 final 실패 시 다시 이전 값이 보일 수 있음. 앞선 5분 최종 D1 접수 미확인/공개 B 카운트 미반영은 별도 FAIL로 지속; 신뢰할 만한 실제 Task→D1→final 증거 전 Stage416 완료 판정 불가.
- **다음 한 작업:** 사용자 A계정/모바일↔PC에서 변경 직후 각자 refresh, 반대 클릭/다시 refresh, 마지막 클릭 +5분+30초 뒤 canonical·공개 B 숫자 확인. 실사용 FAIL이면 source 기록과 정확한 server receipt 확인 후 단일 단계 보완. 새 버전만으로 전체 Explore read/write 발생 금지. TEST/PRODUCTION 승격 금지.
- **진행률:** Stage416 1/4·25%, 앱 속도 5/5·100%(기존 합격 세부 작업), 개인 5분 정산 3/4·75%(실기기 FAIL 보류). app404 복원 소스+QA+Hosting 배포 PASS, 실기기 QA 전.

---

## CURRENT — app403 PC↔모바일 좋아요 실시간 일치 후 reload 회귀 재현/코드 원인 경로 확인 (2026-10-12 KST)

- **제품 FAIL:** 사용자 제공 모바일/PC 비교 화면에서 같은 계정의 실시간 좋아요/해제는 반영되지만 각 기기 새로고침 후 수신했던 최신 하트·잠정 숫자가 이전 캐시 상태로 돌아감. 예시 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」. 하트와 계정 내 잠정 숫자 0/1이 뒤바뀜. 5분 정산 및 reload 보존 정상 기능 보장 미달.
- **코드로 확인한 수신 복원 단절:** `src/services/exploreLikeIntent416.ts`은 remote intent를 `localIntentByUid416` 메모리에만 유지, cold reload 첫 `onValue` snapshot을 무조건 건너뜀, 반면 `seenVersion416`은 UID-scoped localStorage에 남김. `src/services/exploreLikeService.ts`은 수신 메모리 힌트가 없으면 기존 outbox/accepted/R2/cache로 fallback. `ExplorePage.tsx`는 active remote-intent 개인 잠정 하트·숫자 UI만 repaint하므로 reload 후 과거 값 표시는 소스상 충분히 설명됨. 이는 서버 D1 final 실패와 구분되는 별도 결함이며, 해당 곡의 정확한 최종 D1 저장/Task 실패 지점은 여전히 미확정.
- **안전 지침:** 첫 RTDB client-writable 임시 신호를 cold reload 때 무조건 재생하거나 60분 영구 canonical로 사용하는 단순 패치 금지. pending/operationId/version과 server-only `privateLikeFinal416` 증거를 구분하고 이전 opposite click/최종 ACK/기존 개인 캐시 보호. D1/Firestore 읽기·쓰기/전체 Feed scan/페이지 재진입 mutation 금지. 세부 Codex 작업은 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션 기준.
- **현재 실행 상태:** 코드 수정 0, commit은 상태문서 기록만, PREVIEW Hosting app403 및 이전 `recordPrivateLike416` 단일 Function 배포 유지. TEST/PRODUCTION 변경 없음, 실사용 PASS 아님. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 개인 좋아요 5분 3/4·75%.

---

## POSTDEPLOY READONLY — app403 Stage416 Callable 복구 배포 직후 기준 상태 (2026-10-12 10:43 UTC)

- 신규 코드 배포 [38237388824](https://github.com/andrawing1212/soridraw-music/actions/runs/38237388824) SUCCESS 이후 서버 익명 감사 [38238069865](https://github.com/andrawing1212/soridraw-music/actions/runs/38238069865) SUCCESS: `recordPrivateLike416`, Schedule, Settle 동일 runtime identity; Cloud Tasks queue RUNNING; Master private/public 각 5분. 새 클릭이 없는 시점의 공개 버스 마지막 갱신 2026-10-10 03:46:49 UTC, D1 416 acceptance / 069 pending 각 bounded SELECT 존재 NO, 검사 결과 D1 write 0.
- **의미:** 변경된 Callable 함수의 배포/운영계정/예약대기열은 정상이나 **이전 사용자의 미완료 좋아요가 자동 복구됐다는 뜻이 아님**. 다음 새 인증 클릭에서 기존 만료 서버 창을 발견하면 서버 복구 Task 생성 → 정확한 원본 클릭 재전송 → 5분 후 최종 정산을 실사용으로 추적해야 함. 이 시점에서 실사용 기능 FAIL/미검증이며 TEST 승격 보류.
- 세 진행률 변경 없음: Stage416 1/4·25%, 앱 속도 5/5·100%, 개인 5분 정산 3/4·75%. Preview app403, TEST/PRODUCTION 비변경.

---


# app500 — Auth 영구 저장 quota 안정화 (2026-10-25)

## 범위
- 작업 기준: `preview` `5a2c29efb0b2101729ab63d7de533c009d83fa77`
- 코드 후보: Draft PR #488 (`fix/app500-durable-auth-quota-recovery`), **미병합·미배포**
- 별도 중단된 app497 배포 승인 게이트 PR #485 및 #469 수정/병합/승격 금지.
- 사용자의 핵심 우려: 모바일 Chrome Web Storage 부족 때문에 `로그인 유지 ON`이 session/memory로 강등되는 상황을 가능한 한 줄임.
- Firebase 공식 참고: https://firebase.google.com/docs/auth/web/custom-dependencies 및 https://firebase.google.com/docs/auth/web/auth-state-persistence

## 변경 전
- `getAuth(app)`가 브라우저 기본 영구 저장들을 지원하지만 `src/firebase.js`가 앱 시작 시 `setPersistence(auth, browserLocalPersistence / browserSessionPersistence)`를 별도로 호출했음.
- preference `rememberLogin` localStorage read/write 실패가 로그인 유지 판단/저장 선택에 영향을 줌.
- 새 로그인 처리: localStorage 4KB probe → local / session / memory. localStorage full이면 IndexedDB 시도 없이 임시 로그인.
- popup 이후 자격 증명 기록이 실패해도 재시도 전 memory로 직접 강등.

## 후보 수정
1. SDK `getAuth(app)`가 시작 단계에서 기존 IndexedDB/localStorage/sessionStorage Firebase 사용자 인증을 복원하도록 맡기고, startup `setPersistence()` 강제 이동을 제거.
2. 새로운 로그인에서 `로그인 유지 ON`인 경우 **IndexedDB LOCAL → WebStorage LOCAL → SESSION → MEMORY** 순서로 지원되는 Firebase 지속성 적용. `rememberLogin` localStorage 설정 쓰기 실패 시에도 IndexedDB를 먼저 시도하며, localStorage 저장 공간과 IndexedDB 저장 용량을 혼동하지 않음.
3. OAuth popup의 늦은 quota 실패에 기존 계정이 확인되면 절대 signOut/migration 하지 않음. 기존 계정이 없으면 실패한 저장 방식 다음 대안을 검토한 뒤 사용자 클릭으로 다시 로그인.
   - 이메일 로그인도 실제 자격 증명 기록 단계에서 quota가 실패하면 남은 영구 방식을 확인하고 사용자가 다시 클릭하도록 함. 자동 비밀번호 재전송/재로그인 금지.
   - 이메일 신규가입 도중의 quota 오류는 서버 가입이 이미 완료되었을 수 있으므로 **회원가입 재요청을 자동 반복하지 않음**. 기존 계정이 있다면 보존하고, 상태가 불확실하면 이메일 로그인으로 확인하도록 안내.
4. `로그인 유지 OFF`는 새로운 로그인에서 session→memory로 유지. 이미 로그인된 사용자는 새 진입만으로 저장소를 강제로 바꾸지 않음. **로그인 유지 체크박스를 변경하면 이전 선택에서 발생한 임시 fallback을 잊고 새 정책을 적용**(계정 강제 로그아웃 없음).
5. 임시 저장 로그인만 가능할 때는 영구 로그인 PASS로 주장하지 않음.

## 절대 보호
- 기존 Firebase 계정 UID, signed-in state, Google popup/redirect resolver
- AppCheck, Firestore in-memory cache, Music Note/Library 로컬 초안, 사용자 원본, Stage416/Reader OFF
- `localStorage.clear`, `sessionStorage.clear`, IndexedDB 삭제, 사이트 데이터 전체 삭제, 사용자 데이터 migration/backfill 금지
- 새 서버, 리프레시 토큰 수동 저장, 민감 토큰 직접 localStorage 복제 금지
- 사용자 로그인 동작만 수정; 앱 재방문 때문에 D1/Firestore 전체 읽기/쓰기 추가 없음

## 검사
- 기존 `scripts/verify-498-auth-storage-recovery.mjs` 확장:
  IndexedDB 성공 / IndexedDB unavailable → local 성공 / 둘 다 가득 참 → session / 모든 영구 실패 → memory / localStorage 설정 저장실패에서도 IndexedDB / popup·이메일 로그인 뒤늦은 저장실패 / 불확실한 신규가입 안전 안내 / 비관련 Auth 에러 전파 / 초안 비삭제.
- `.github/workflows/verify-408-like-repair-code.yml`에서 검사 + TypeScript + Build + 제품 회귀 (PR 체크).
- **아직 미검증**: 같은 모바일 Chrome 실제 login ON + 브라우저 종료/재실행, 기존 legacy local/session/IndexedDB 회원 유지, 두 탭·동일 계정, Safari private/storage 완전 거부 등.
- 본 코드가 브라우저 또는 OS의 모든 영구 저장이 차단된 환경까지 로그인 유지 100%를 보장하지는 않음.

## app500 감사 FAIL 대응 — 재구현 v2 (2026-10-25 KST)
- 원본 코드 후보 `f2c807007b1e4d678a5f7a8e4a8f3767b91f7789`의 공식 SDK 동작 대조에서 `getAuth` 자동 SESSION→IndexedDB 승격 위험 및 ON 선택값 localStorage quota 소실을 확인했음. 소스 감사 결과 FAIL, 임의 배포하지 않음.
- 수정: `src/firebase.js`에 **Firebase `initializeAuth`와 명시적 `browserPopupRedirectResolver`**를 사용. ON이면 `[IndexedDB LOCAL, Web LOCAL, SESSION]`, OFF이면 **`[SESSION, IndexedDB LOCAL, Web LOCAL]`** 순으로 기존 계정 복원 우선순위를 정함. 기본값은 전과 같이 OFF, 기존 ON 상태와 OFF 의도 구별. Auth SDK 기본 `getAuth`가 무조건 IndexedDB로 SESSION 자격 증명을 이동시키는 경로를 방지.
- 로그인 유지 선택값은 Firebase 토큰과 분리하여 **자사 호스트 전용 `soridraw_remember_login_v1` 기능성 쿠키**에 작은 `1/0`만 저장, `localStorage` 보조 병행. 쿠키가 있으면 기존 localStorage stale 값보다 우선. 쿠키/웹 저장 접근 모두 차단되면 장기 로그인 100% 불가; `localStorage` 읽기 실패를 사용자 명시 OFF로 오인하지 않고 보존 우선.
- 사용자가 ON으로 새 로그인 시 IndexedDB→Web LOCAL→SESSION→MEMORY 유지, session/memory fallback 성공은 **장기 로그인 아님**을 기존 토스트로 알림 (Google/이메일). 다른 UI 속성 및 기존 음악 화면 변경 금지.
- 위험: Firebase는 여러 저장소의 기존 계정을 첫 사용 가능한 우선순위로 옮길 수 있고, 다른 탭 사용자에게 영향을 줄 수 있음. 기존 PC·모바일 인증과 Google popup 포함한 실제 브라우저 통합테스트 및 Work 독립 감사 전에는 계속 HOLD.
- 테스트 확장: `verify-498-auth-storage-recovery.mjs`에 Auth startup preference-first 스토어 선택, stale localStorage와 쿠키 충돌, quota blocked ON, 기본 OFF, popup resolver, 로그인 토큰 쿠키 미저장 검사. exact CI 최종 HEAD 검증 대기.
- PREVIEW 앱 버전, Hosting, Firebase Functions, Cloudflare, 공유 원본 DB 변경 없음. CODEX source candidate만 갱신.

## 배포 게이트
- PR 소스 CI 전체 PASS, 정확한 최종 SHA 고정, 독립 Work 감사, 필요한 PREVIEW 배포 승인/정책 검증까지 HOLD.
- 실제 배포는 release trigger를 통해 exact SHA로만, 사용자 원본/Functions/Worker/Rules/TEST/main/PROD 변경 없이 Hosting-only.
- PREVIEW 배포 후 모바일 Chrome 기존 캐시/새 캐시/저장공간 부족 모드 실측. 실패하면 TEST 승격 금지.

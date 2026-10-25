# app499 — 모바일 Chrome 로그인 유지 추가 점검 (2026-10-25 KST)

**기준:** GitHub PREVIEW `e4b232118e0623486528e52d952787eaede7dcce`; 실제 Firebase PREVIEW Hosting app468 release `d4c2c39af3aec6f895bdfff33afdb6f8f2c37805`, run #40176769887 PASS.

## 지금 확인 가능한 결론
- 사용자 모바일 Chrome에서 app466 Google 로그인 성공을 스크린샷으로 확인. 당시 “로그인 유지 대신 탭 단위로 로그인됩니다” 토스트가 표시돼 Auth 영구 저장(local) 대신 session fallback이 실제로 선택됐다는 **브라우저의 간접 증거**가 있음. app467에서 안내 토스트만 제거, persistence 로직은 그대로.
- 현재 코드 `src/firebase.js`: `readRememberLoginPreference()`가 `localStorage.getItem('rememberLogin')`을 읽고 오류 시 false; `getAuth(app)` 후 `setPersistence(auth, initialAuthPersistence)` 비동기 실행. 로그인 시 `src/App.tsx`의 `prepareAuthAttempt()`는 rememberLogin=true면 local→session→memory를 시도하고 4KB 임시 probe와 quota 회복 경로가 있음. `auth.currentUser`가 이미 있으면 persistence 강등을 건너뛰는 보호가 있음. popup 완료 뒤 기존 인증된 세션을 강등하지 않음.
- **결함/제한:** rememberLogin=true여도 localStorage quota가 가득 차면 session 또는 memory로 로그인할 수 있다. 이때 브라우저를 완전히 닫고 다시 열어도 인증이 유지된다는 보장은 없음. session/memory fallback은 사용자 설정을 영구 충족한 것이 아니다. Startup의 비동기 `setPersistence` 호출과 Auth hydration 간 결과도 실기기/실제 저장 공간 제한에서 재검증 필요. 소스 회귀 테스트 PASS는 장치 보존 PASS가 아니다.
- **조치:** 사용자 원본/기기 초안/Browser Storage/Firestore 캐시/IndexedDB를 자동 삭제하지 않는다. 영구 저장이 불가능하면 로그인 세션 성공과 자동로그인 유지 합격을 구분한다. 현재 공용 운영 데이터 변경, 재배포, 계정 강제 로그아웃 실행 **0**.
- **실사용 합격선 (미실시):** ① 문제가 있었던 모바일 Chrome 로그인 유지 ON으로 로그인 ② 새로고침 및 탭 이동 시 UID/작업 내용 유지 ③ 미저장 작업 저장 완료를 확인한 뒤 Chrome 전체 종료→재실행→PREVIEW 재진입에도 자동로그인 유지 ④ 모바일/PC 동일 계정·기존 캐시/빈 캐시 일관성 ⑤ 저장 공간 부족·정상 여유 공간 두 경우를 구별. 브라우저를 종료하기 전 **기기 내 미저장 문구를 반드시 안전하게 보관**. 사용자 실기기 승인이 오기 전 AUTOLOGIN_PERSISTENCE=UNVERIFIED/AT_RISK.
- **비용:** 이번 감사 자체의 서버 D1/Firestore read·write=0 (소스만 조회). 기기별 실제 로그인 갱신 read/write 비용은 측정하지 않았음.
- **별개 릴리스 엔진 영향:** 사용자 실기기 로그인 유지 확인이 없는 TEST_VERIFIED는 금지. app497 소스 보류 PR #469 및 후보 Draft PR #485의 실기기 모바일 승인 증빙에 포함. `TEST_AUTO_CHECKED`만으로 PRODUCTION 승격 불가. app497 코드는 preview로 병합/배포되지 않음.

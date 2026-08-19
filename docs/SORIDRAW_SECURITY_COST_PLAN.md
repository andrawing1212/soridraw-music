# SORIDRAW Security & Cost Plan

## 101차까지 적용 상태

### 적용 완료

- Gemini 개인 API 키를 브라우저에 반환하지 않는다.
- 브라우저는 Firebase ID Token과 선택적 App Check 토큰을 Functions에 보낸다.
- Functions가 `user_api_keys/{uid}`에서 현재 개인 키를 읽고 Gemini REST API를 호출한다.
- 개인 키는 warm Functions 인스턴스 메모리에 캐시하지 않는다. 키 변경·삭제가 모든 인스턴스에 즉시 반영되도록 실제 Gemini 호출마다 서버 전용 문서를 다시 읽는다.
- 이전 빌드가 브라우저에 남겼을 수 있는 Gemini 원문 키 localStorage 항목을 시작 시 제거한다.
- 사용자별 Gemini 보호 한도:
  - 동시 요청 최대 2개
  - 분당 요청 최대 12개
  - 생성 세션당 실제 API 요청 최대 3개
- 429/개인 프로젝트 할당량 오류에서는 다른 모델을 자동 호출하지 않는다.
- 500/502/503/504 및 일시적 UNAVAILABLE만 대체 모델 1회를 허용한다.
- 서버 Gemini 프록시는 텍스트 생성만 허용하며 파일·미디어·도구 호출을 차단한다.
- 허용 Origin을 Preview/Test/Firebase/localhost/AI Studio Preview로 제한한다.
- 사용자 문서의 role, plan, payment, account status는 일반 사용자가 수정할 수 없다.
- Gemini 요청 원문과 API 키는 감사용 Firestore 문서에 저장하지 않는다.
- Firebase Hosting/Vercel에 기본 보안 헤더와 App Check용 reCAPTCHA CSP 허용값을 추가한다.
- Gemini 응답 스키마에서 지원되지 않는 `additionalProperties`를 서버 프록시가 제거해 구조화 출력 호환 오류를 막는다.
- AI Studio의 동적 `ais-dev-...run.app` Origin을 제한된 패턴으로 허용한다.
- AI Studio와 Vercel 테스트앱에서 실제 Gemini 생성, 키 삭제·재등록, 503 대체 모델 호출까지 확인했다.

## 100차 App Check 모니터링

- 강제 차단은 아직 켜지 않는다. `ENFORCE_APP_CHECK=false`를 유지한다.
- 서버는 App Check 상태를 `valid`, `missing`, `invalid`로만 기록한다.
- 로그에는 토큰, 사용자 UID, API 키, 프롬프트를 남기지 않는다.
- 응답 헤더 `X-SORIDRAW-App-Check-Status`로 `valid`, `missing-accepted`, `invalid-accepted` 상태를 확인할 수 있다.
- 브라우저 콘솔에는 클라이언트 토큰 발급 상태와 서버 검증 상태만 표시한다.

### 콘솔 설정 후 활성화

1. Firebase Console > App Check에서 Web 앱을 reCAPTCHA Enterprise로 등록한다.
2. Firebase App Check에 등록한 공개 사이트 키와 `src/firebase.js`의 고정 사이트 키가 일치하는지 확인한다.
3. 먼저 `ENFORCE_APP_CHECK=false`로 정상 토큰 비율을 확인한다.
4. 이상이 없으면 Functions 환경변수를 `ENFORCE_APP_CHECK=true`로 변경한다.

App Check 사이트 키는 공개 키이며 Gemini 개인 API 키가 아니다. Vercel/AI Studio 환경변수로 덮어쓰지 않는다.

## 질문 1: 곡마다 서버에서 키를 읽으면 비용이 큰가?

현재 안전형 구조는 실제 Gemini 호출마다 Functions가 `user_api_keys/{uid}`를 한 번 읽는다. 브라우저에는 키를 내려주지 않는다.

초기 1,000명 규모에서는 이 읽기 비용이 핵심 비용이 아니다. 예를 들어 하루 실제 Gemini 호출이 6,500회여도 키 읽기만 보면 Firestore 무료 읽기 50,000회/일보다 낮다. 실제 서버비용은 Gemini 응답을 기다리는 동안의 Functions 실행시간이 더 큰 비중을 차지한다.

키를 5분 캐시하면 Firestore 읽기는 줄지만 삭제한 키가 다른 warm 인스턴스에서 잠시 살아남을 수 있다. SORIDRAW는 개인 키 보안을 우선해 캐시하지 않는다.

## 1,000명 초기 운영 비용 시뮬레이션

아래는 512 MiB, 1 vCPU, Gemini 응답 대기 평균 45초, 동시성 절감 없음이라는 보수적 가정이다. 사용자의 Gemini 토큰 비용은 포함하지 않는다.

| 사용 강도 | 가정 | 월 Gemini 프록시 호출 | Functions 계산비 추정 |
|---|---:|---:|---:|
| 낮음 | DAU 100명 × 하루 3곡 × 곡당 1.2회 | 10,800회 | 약 US$7~20 |
| 보통 | DAU 200명 × 하루 5곡 × 곡당 1.3회 | 39,000회 | 약 US$40~80 |
| 매우 높음 | DAU 500명 × 하루 10곡 × 곡당 1.3회 | 195,000회 | 약 US$220~350 |

실제 금액은 요청 겹침, Function 동시성, 평균 생성시간, 지역, Firestore/Hosting 사용량에 따라 달라진다. 동시 요청이 겹치면 한 인스턴스가 여러 요청을 처리해 실제 금액은 표보다 낮아질 수 있다.

## 멤버십 권장 가격

개인 Gemini API를 쓰므로 가격은 Gemini 토큰 재판매가 아니라 SORIDRAW의 편집·저장·관리 가치로 정한다.

- Free: 0원
- Basic: 월 6,900원
- Pro: 월 14,900원
- 향후 Studio/Creator: 월 24,900~29,000원

초기 1,000명 중 유료 전환이 5~8%라면 정상 사용 구간의 Firebase 비용과 결제 수수료를 감당할 여지가 생긴다. 최종 가격은 저장 공간, 지원 비용, Suno 관련 기능 범위와 실제 한 달 사용량을 확인한 뒤 확정한다.

## 개인 API인데 멤버십별 생성 제한이 꼭 필요한가?

Gemini 토큰비 보호만을 목적으로 Free/Basic/Pro에 강한 일일 생성 횟수 차이를 둘 필요는 없다. 사용자는 자신의 프로젝트 한도와 비용을 사용한다.

하지만 모든 플랜에 다음 공통 제한은 필요하다.

- 동시 생성 제한
- 분당 요청 제한
- 곡당 Gemini 호출 상한
- 동일 작업 중복 차단
- 비정상 자동화·봇 차단

이 제한은 사용자 Gemini 비용이 아니라 SORIDRAW의 Functions, Firestore, 네트워크 비용과 서비스 안정성을 지키기 위한 것이다. 멤버십 차이는 저장량, 커스텀 구조, 보컬 캐릭터, 스토리보드, 이력·관리 기능에 두는 편이 적합하다.

## 후속 단계

### 100차: App Check 모니터링 및 검증

- Vercel 테스트앱과 정식 도메인은 reCAPTCHA Enterprise로 토큰 발급 상태 확인
- reCAPTCHA Enterprise 허용 도메인에 `soridraw-music.vercel.app`, `soridraw.web.app`, `soridraw.firebaseapp.com`, `soridraw-app-866a5.web.app`, `soridraw-app-866a5.firebaseapp.com`을 등록
- AI Studio 프리뷰는 `ais-dev-...run.app` 호스트에서만 Firebase 공식 디버그 제공자를 사용
- AI Studio에서 출력된 디버그 토큰은 Firebase App Check의 `디버그 토큰 관리`에 직접 등록
- 서버 검증 결과가 두 환경 모두 `valid`인지 확인
- 강제 적용은 아직 하지 않음

### 101차: 새 Gemini 승인 키 호환 — 적용 완료

- 기존 Standard 키(`AIza...`)와 새 승인 키(`AQ....`)를 모두 입력·저장 가능하게 유지
- 새 승인 키의 점(`.`) 문자를 허용하고, 미래 형식 변경에 대비해 특정 접두사만 강제하지 않음
- Gemini REST 요청은 URL 쿼리 `?key=` 대신 공식 `x-goog-api-key` 헤더로 전달
- 기존 `user_api_keys/{uid}` 문서와 `googleGeminiApiKey` 필드를 그대로 유지해 데이터 마이그레이션 불필요
- API 키가 오류 메시지에 섞여도 Standard/승인 키 모두 서버 응답에서 마스킹
- Google 측 승인 키 활성화 문제(`ACCESS_TOKEN_TYPE_UNSUPPORTED`)를 별도 오류 코드로 구분
- Google 공식 안내에 따라 2026년 9월 전에 Standard 키를 승인 키로 교체하도록 UI 안내 추가

### 102차: 콘솔 로그 경량화

- ForceLogout/Auth/선택값/전체 프롬프트 반복 로그 제거
- API 키·사용자 문서·프롬프트 원문이 콘솔에 남지 않도록 정리
- 실제 오류와 보안 검증 상태 로그만 최소 유지

### 103차: Gemini App Check 강제 적용

- `generateGeminiContent`부터 `ENFORCE_APP_CHECK=true` 적용
- 토큰 없는 직접 요청이 401로 차단되는지 확인
- AI Studio와 테스트앱 생성 성공을 다시 확인한 뒤 키 관리 함수로 확대

### 104차: 개인 키 저장 강화

- Cloud KMS 키 리소스 생성 후 개인 API 키 envelope encryption 적용
- 기존 평문 키를 읽어 암호화 문서로 안전하게 마이그레이션
- 마이그레이션 완료 전 기존 필드 삭제 금지

### 105차 이후: 런타임·전체 보호·비용 관제

- Node.js 지원 런타임과 Firebase Functions SDK를 안전하게 업데이트
- Suno 키 저장/삭제/생성/크레딧 확인에도 동일한 보호 적용
- 동일 작업 ID 중복 요청 방지
- Cloud Billing 예산 알림과 Functions/Firestore 사용량 대시보드 구성

## 831차 Gemini fallback 상한 변경 메모
- Gemini 3.7 Flash 도입과 함께 자동 fallback 후보가 5개로 늘어 곡당 물리 호출 절대 상한도 3회 → 5회로 변경되었다.
- 정상 상태에서는 첫 모델 1회 성공이 기본이므로 평상시 평균 호출 수가 자동으로 5회가 되는 구조는 아니다.
- 추가 호출은 자동 전환 ON + 명시적 upstream 429 또는 일시적 500/502/503/504, 모델 rollout 404 상황에서만 발생한다.
- 자동 품질 보정은 기존 최대 1회 제한을 유지한다.
- 따라서 비용 추정 시 평상시 평균 호출률과 별도로 장애/쿼터 소진 시 최악 5회 물리 호출 가능성을 비상 상한으로 계산한다.

### 836 — 모델 실패 쿨다운을 브라우저에 두는 이유
- Gemini 3.7이 429/일시 5xx 상태일 때 매 보정/다음 곡마다 먼저 같은 실패를 기다리면 지연과 Firebase Function 호출이 동시에 늘어난다.
- 따라서 실패 상태 자체만 로컬에 짧게 캐시하고, 살아 있는 다음 모델부터 바로 시작한다.
- 저장 항목은 모델명/만료시각/실패종류뿐이며 사용자 API 키, 프롬프트, 생성 결과는 저장하지 않는다.
- 서버 warm-memory에 API 키를 캐시하는 방식은 키 삭제/교체 즉시성 및 보안 경계를 흐릴 수 있으므로 사용하지 않는다.
- 장기 방향: 반복 fallback을 서버 한 invocation 안으로 합치는 것은 별도 성능 검증 후 진행한다. 현재 단계에서는 기존 보안/감사 구조를 유지하면서 불필요한 invocation부터 제거한다.

### 837 — latency-first model cooldown continuity
- A confirmed upstream 429/temporary unavailable model is suppressed across every browser generation pass for the active cooldown window.
- Session memory is authoritative for immediate continuity; localStorage only preserves the short-lived model name/reason/expiry across refreshes.
- No API key, prompt, lyric, generated result, token, or user content is cached by this optimization.

### 838 — fallback Function invocation consolidation
- Known cooldown models are still removed in the browser before any Function call.
- When an unknown upstream failure requires fallback, the browser no longer repeats Auth/App Check + full guard/API-key Firestore reads for every model. One Function invocation owns the bounded fallback chain.
- Every additional upstream Gemini attempt still increments the existing per-minute/session physical request guard using only the single guard document, preserving the 5-request ceiling without repeating user/API-key reads.
- No API key or user prompt/result is cached in Function memory. Security and key-rotation immediacy are unchanged.

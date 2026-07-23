# SORIDRAW Music Studio

## Development

Use Node.js 20.x. The root `.nvmrc` and `package.json` engine field keep the web app aligned with Firebase Functions.

1. Copy `.env.example` to the environment used by the web build.
2. Register the Firebase web app with App Check and keep the reCAPTCHA Enterprise key domains aligned with the deployed app domains.
3. Install dependencies and start the app.

```bash
npm ci
npm run dev
```

Before deployment, verify both the web app and Functions. These commands do not deploy anything.

```bash
npm run lint
npm run build
cd functions
npm ci
npm run build
```

## Personal Gemini API key security

- Users register their own Gemini API key from the API settings screen.
- The key is stored in the server-only Firestore document `user_api_keys/{uid}`.
- The browser never receives the key and never calls Gemini directly.
- The authenticated Firebase Function `generateGeminiContent` reads the current key and calls Gemini server-side.
- The proxy sends Gemini credentials with the official `x-goog-api-key` request header and accepts both legacy Standard keys and new authorization keys issued by AI Studio.
- Google states that Standard keys will be rejected starting September 2026, so users should migrate to a new authorization key before then.
- Do not configure `VITE_GEMINI_API_KEY`; private Gemini keys must never be included in a Vite client build.

See `docs/SORIDRAW_SECURITY_COST_PLAN.md` for App Check activation, server limits, remaining console work, and the staged KMS migration plan.

The public App Check site key is bound in `src/firebase.js`; deployment environments must not override it with a stale Vite variable.

## App Check host routing

- AI Studio preview hosts use the registered App Check debug-provider path.
- The Vercel test host and Firebase Hosting domains initialize the real reCAPTCHA Enterprise provider with the site key registered to the Firebase web app.
- App Check enforcement must remain disabled until the Vercel test host reports both `token status: available` and `server status: valid` during real generation tests.

The V1 song generator now fails open after temporary Gemini correction failures: banned-term lines are removed locally as a last resort, missing required slots receive a minimal structural completion, and an otherwise usable song is no longer discarded solely because an Outro/Bridge body repair failed.

## Gemini production availability routing

## 107차 Gemini 안정 모델 3단계 교체

- 곡 생성 기본 우선순위를 `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite`로 고정합니다.
- 503/504/네트워크 오류가 난 모델만 2분간 후순위로 보내고, 시간이 지나면 원래 우선순위로 자동 복귀합니다.
- 더 이상 제공되지 않는 `gemini-2.5-flash`와 Preview 모델을 곡 생성 안전망에서 제거했습니다.
- Gemini 3.6 Flash와 3.5 Flash-Lite 요청에서는 더 이상 지원되지 않는 sampling 필드(`temperature`, `topP`, `topK`)를 전송 전에 제거합니다.
- Functions 모델 허용 목록에도 3.6 Flash와 3.5 Flash-Lite를 추가했으므로, 이 버전은 관련 Functions 재배포가 필요합니다.
- 한 생성 세션의 최대 모델 호출은 기존과 동일하게 3회입니다.
- Vercel 테스트앱의 App Check는 별도 문제로 계속 임시 비활성 상태이며, 이번 모델 교체와 분리합니다.


## 109차 App Check 사이트 키 문자 오타 수정

- Firebase App Check에 등록된 reCAPTCHA Enterprise 사이트 키와 앱 코드의 키가 대소문자/숫자 3자리에서 달랐던 문제를 수정했습니다.
- 잘못된 키는 Vercel 테스트앱에서 `recaptcha-error`와 `enterprise/clr 400`을 만들었습니다.
- Vercel 테스트앱과 Firebase Hosting은 실제 reCAPTCHA Enterprise 제공자를 계속 사용합니다.
- AI Studio 디버그 제공자, Gemini 모델, 생성 엔진, Functions, Firestore/Auth 저장 구조는 변경하지 않았습니다.


## 110차 App Check 올바른 프로젝트 사이트 키 적용

- reCAPTCHA Enterprise 키를 Firebase 프로젝트 `soridraw-app-866a5`에서 새로 만든 사이트 키로 교체했습니다.
- Vercel 테스트앱 도메인 `soridraw-music.vercel.app`을 포함한 올바른 프로젝트 소속 키를 사용합니다.
- AI Studio 디버그 제공자, Gemini 3.6 모델 라우팅, Functions, Firestore/Auth 저장 구조는 변경하지 않았습니다.
- App Check 강제 차단은 테스트앱에서 `token status: available` 및 `server status: valid`가 확인될 때까지 유지하지 않습니다.

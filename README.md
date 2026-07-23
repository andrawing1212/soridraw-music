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

## Temporary test-app App Check mode

The Vercel test host currently skips client App Check initialization because its reCAPTCHA Enterprise token exchange returns HTTP 400. Enforcement must remain disabled until the Cloud Console website-key domains and Firebase App Check registration are corrected and the test host reports `valid`. AI Studio debug App Check and Firebase-hosted App Check paths remain in the code.

The V1 song generator now fails open after temporary Gemini correction failures: banned-term lines are removed locally as a last resort, missing required slots receive a minimal structural completion, and an otherwise usable song is no longer discarded solely because an Outro/Bridge body repair failed.

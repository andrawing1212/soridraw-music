import { randomUUID, sign as cryptoSign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const mode = String(process.argv[2] || 'create').trim();
const statePath = String(process.env.SORIDRAW_APPCHECK_DEBUG_STATE || 'release-044-appcheck-debug-state.json');
const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const firebaseProjectId = 'soridraw-app-866a5';
const firebaseApiKey = 'AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA';
const firebaseAppId = '1:91309780603:web:cde703895e2cf31ecffcde';

if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.');
const serviceAccount = JSON.parse(serviceAccountJson);
if (!serviceAccount?.client_email || !serviceAccount?.private_key) throw new Error('Service-account signing fields are missing.');

const safeJson = async (response) => {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
};
const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const signJwt = (payload) => {
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}`;
  const signature = cryptoSign('RSA-SHA256', Buffer.from(unsigned), serviceAccount.private_key).toString('base64url');
  return `${unsigned}.${signature}`;
};
const createGoogleAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const payload = await safeJson(response);
  if (!response.ok || !payload?.access_token) throw new Error(`Google OAuth exchange failed: ${response.status} ${JSON.stringify(payload).slice(0, 600)}`);
  return String(payload.access_token);
};

if (mode === 'create') {
  const accessToken = await createGoogleAccessToken();
  const debugToken = randomUUID();
  const collection = `projects/${firebaseProjectId}/apps/${firebaseAppId}/debugTokens`;
  const createResponse = await fetch(`https://firebaseappcheck.googleapis.com/v1/${collection}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': firebaseProjectId,
    },
    body: JSON.stringify({ displayName: `SORIDRAW 044 PREVIEW CI ${Date.now()}`, token: debugToken }),
  });
  const created = await safeJson(createResponse);
  if (!createResponse.ok || !created?.name) throw new Error(`App Check debug-token registration failed: ${createResponse.status} ${JSON.stringify(created).slice(0, 800)}`);

  try {
    const exchangeResponse = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${firebaseProjectId}/apps/${firebaseAppId}:exchangeDebugToken?key=${encodeURIComponent(firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debugToken, limitedUse: false }),
    });
    const exchanged = await safeJson(exchangeResponse);
    if (!exchangeResponse.ok || !exchanged?.token) throw new Error(`App Check debug-token exchange failed: ${exchangeResponse.status} ${JSON.stringify(exchanged).slice(0, 800)}`);
    await writeFile(statePath, `${JSON.stringify({ name: String(created.name), appCheckToken: String(exchanged.token) }, null, 2)}\n`, 'utf8');
    console.log('SORIDRAW_044_APPCHECK_DEBUG_CREATE=PASS');
  } catch (error) {
    await fetch(`https://firebaseappcheck.googleapis.com/v1/${created.name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}`, 'x-goog-user-project': firebaseProjectId },
    }).catch(() => {});
    throw error;
  }
} else if (mode === 'delete') {
  let state;
  try { state = JSON.parse(await readFile(statePath, 'utf8')); } catch { state = null; }
  if (!state?.name) {
    console.log('SORIDRAW_044_APPCHECK_DEBUG_DELETE=NOOP');
    process.exit(0);
  }
  const accessToken = await createGoogleAccessToken();
  const response = await fetch(`https://firebaseappcheck.googleapis.com/v1/${state.name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'x-goog-user-project': firebaseProjectId },
  });
  if (!response.ok && response.status !== 404) {
    const payload = await safeJson(response);
    throw new Error(`App Check debug-token deletion failed: ${response.status} ${JSON.stringify(payload).slice(0, 700)}`);
  }
  console.log('SORIDRAW_044_APPCHECK_DEBUG_DELETE=PASS');
} else {
  throw new Error(`Unknown mode: ${mode}`);
}

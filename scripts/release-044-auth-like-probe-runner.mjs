import { spawnSync } from 'node:child_process';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const accessTokenResult = await client.getAccessToken();
const accessToken = typeof accessTokenResult === 'string'
  ? accessTokenResult
  : String(accessTokenResult?.token || '');
if (!accessToken) throw new Error('Unable to mint Google OAuth access token from application-default service-account credentials.');

const result = spawnSync(process.execPath, ['scripts/release-044-auth-like-probe.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GOOGLE_OAUTH_ACCESS_TOKEN: accessToken,
  },
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`044 like probe terminated by signal ${result.signal}`);
process.exitCode = Number(result.status || 0);

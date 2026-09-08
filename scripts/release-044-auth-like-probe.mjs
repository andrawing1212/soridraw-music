import { writeFile } from 'node:fs/promises';
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';

const envName = String(process.env.SORIDRAW_PROBE_ENV || '').trim();
const origin = String(process.env.SORIDRAW_PROBE_ORIGIN || '').replace(/\/+$/, '');
const workerBase = String(process.env.SORIDRAW_PROBE_WORKER || '').replace(/\/+$/, '');
const outputPath = String(process.env.SORIDRAW_PROBE_OUTPUT || `release044-probe-${envName || 'unknown'}.json`);
const statePath = String(process.env.SORIDRAW_PROBE_STATE || `release044-probe-${envName || 'unknown'}-state.json`);
const firebaseProjectId = 'soridraw-app-866a5';
const firebaseConfig = {
  apiKey: 'AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA',
  authDomain: 'soridraw-app-866a5.firebaseapp.com',
  projectId: firebaseProjectId,
  storageBucket: 'soridraw-app-866a5.firebasestorage.app',
  messagingSenderId: '91309780603',
  appId: '1:91309780603:web:cde703895e2cf31ecffcde',
};
const appCheckSiteKey = '6Le6bGEtAAAAAOVROhuXew0lxJcpVNVwPZN0ZWKO';

if (!envName || !origin || !workerBase) throw new Error('SORIDRAW probe environment/origin/worker are required.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const numberHeader = (headers, key) => {
  const value = headers[String(key).toLowerCase()];
  if (value === undefined) return Number.NaN;
  return Number(value);
};
const extractItems = (payload) => {
  const candidates = [payload?.data?.items, payload?.items, payload?.data?.tracks, payload?.tracks];
  return candidates.find(Array.isArray) || [];
};
const trackIdOf = (item) => String(item?.id || item?.trackId || item?.track_id || '').trim();
const likeCountOf = (item) => {
  const value = item?.likeCount ?? item?.like_count ?? item?.stats?.likeCount ?? item?.stats?.like_count;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
};

const runNonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const uid = `soridraw044_${envName}_${runNonce}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
const email = `soridraw044-${envName}-${runNonce.replace(/_/g, '-')}@example.invalid`;
const password = `Sd044!${Math.random().toString(36).slice(2)}A9#`;
const adminApp = initializeApp({ credential: applicationDefault(), projectId: firebaseProjectId }, `soridraw044-${envName}-${Date.now()}`);
let browser;
let page;
let idToken = '';
let appCheckToken = '';
let targetTrackId = '';
let likedActive = false;
let userCreated = false;

await writeFile(statePath, `${JSON.stringify({ uid, email, environment: envName, targetTrackId: '', likedActive: false }, null, 2)}\n`, 'utf8');

const persistState = async () => {
  await writeFile(statePath, `${JSON.stringify({ uid, email, environment: envName, targetTrackId, likedActive }, null, 2)}\n`, 'utf8');
};

const browserFetch = async (method, path, { auth = false, cacheBust = false } = {}) => {
  const suffix = cacheBust ? `${path.includes('?') ? '&' : '?'}__soridraw044=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  const url = `${workerBase}${path}${suffix}`;
  const wait = page.waitForResponse((response) => response.url() === url && response.request().method() === method, { timeout: 30_000 });
  const client = await page.evaluate(async ({ url, method, idToken, appCheckToken, auth }) => {
    const headers = {};
    if (auth) {
      headers.Authorization = `Bearer ${idToken}`;
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }
    const response = await fetch(url, { method, headers, cache: 'no-store' });
    const text = await response.text();
    return { status: response.status, text };
  }, { url, method, idToken, appCheckToken, auth });
  const network = await wait;
  const headers = await network.allHeaders();
  let payload = null;
  try { payload = JSON.parse(client.text); } catch { payload = client.text; }
  return { status: client.status, payload, headers, url };
};

const pollFeedCount = async (expected, label) => {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const response = await browserFetch('GET', '/v1/feed?sort=latest&limit=40', { cacheBust: true });
    if (response.status !== 200 || response.payload?.ok !== true) throw new Error(`${label} feed read failed: ${response.status}`);
    const item = extractItems(response.payload).find((candidate) => trackIdOf(candidate) === targetTrackId);
    if (item && likeCountOf(item) === expected) return { attempt, headers: response.headers };
    await sleep(800);
  }
  throw new Error(`${label} feed/R2 likeCount did not converge to ${expected}`);
};

const performLikeCycle = async (cycle) => {
  const put = await browserFetch('PUT', `/v1/tracks/${encodeURIComponent(targetTrackId)}/like`, { auth: true });
  if (put.status < 200 || put.status >= 300 || put.payload?.ok !== true) throw new Error(`PUT like failed: ${put.status} ${JSON.stringify(put.payload).slice(0, 500)}`);
  likedActive = true;
  await persistState();
  const putCount = Number(put.payload?.data?.likeCount);
  if (!Number.isFinite(putCount)) throw new Error('PUT likeCount missing.');
  const putReads = numberHeader(put.headers, 'x-soridraw-d1-read-queries');
  const putWrites = numberHeader(put.headers, 'x-soridraw-d1-write-queries');
  if (!Number.isFinite(putReads) || !Number.isFinite(putWrites)) throw new Error(`D1 query diagnostics headers missing: ${JSON.stringify(put.headers)}`);
  if (putReads !== 1) throw new Error(`Like D1 reads expected 1, got ${putReads}`);
  if (![3, 4].includes(putWrites)) throw new Error(`Like D1 writes expected 3 (or rare bounded cleanup 4), got ${putWrites}`);
  const putFeed = await pollFeedCount(putCount, `cycle ${cycle} PUT`);

  const del = await browserFetch('DELETE', `/v1/tracks/${encodeURIComponent(targetTrackId)}/like`, { auth: true });
  if (del.status < 200 || del.status >= 300 || del.payload?.ok !== true) throw new Error(`DELETE like failed: ${del.status} ${JSON.stringify(del.payload).slice(0, 500)}`);
  likedActive = false;
  await persistState();
  const delCount = Number(del.payload?.data?.likeCount);
  if (!Number.isFinite(delCount)) throw new Error('DELETE likeCount missing.');
  if (delCount !== Math.max(0, putCount - 1)) throw new Error(`Like/unlike count roundtrip mismatch: PUT=${putCount} DELETE=${delCount}`);
  const delReads = numberHeader(del.headers, 'x-soridraw-d1-read-queries');
  const delWrites = numberHeader(del.headers, 'x-soridraw-d1-write-queries');
  if (delReads !== 1) throw new Error(`Unlike D1 reads expected 1, got ${delReads}`);
  if (![3, 4].includes(delWrites)) throw new Error(`Unlike D1 writes expected 3 (or rare bounded cleanup 4), got ${delWrites}`);
  const delFeed = await pollFeedCount(delCount, `cycle ${cycle} DELETE`);

  return {
    cycle,
    put: { reads: putReads, writes: putWrites, likeCount: putCount, feedAttempts: putFeed.attempt },
    delete: { reads: delReads, writes: delWrites, likeCount: delCount, feedAttempts: delFeed.attempt },
  };
};

try {
  const adminAuth = getAuth(adminApp);
  await adminAuth.createUser({ uid, email, password, displayName: `SORIDRAW 044 ${envName} Probe`, emailVerified: true, disabled: false });
  userCreated = true;
  await persistState();

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).origin !== new URL(origin).origin) throw new Error(`Unexpected probe origin: ${page.url()}`);

  const tokenBundle = await page.evaluate(async ({ config, siteKey, email, password, nonce }) => {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');
    const appCheckMod = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-check.js');
    const app = appMod.initializeApp(config, `soridraw044-probe-${nonce}`);
    const auth = authMod.getAuth(app);
    const appCheck = appCheckMod.initializeAppCheck(app, {
      provider: new appCheckMod.ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: false,
    });
    const credential = await authMod.signInWithEmailAndPassword(auth, email, password);
    const [idToken, appCheckResult] = await Promise.all([
      credential.user.getIdToken(true),
      appCheckMod.getToken(appCheck, true),
    ]);
    return { idToken, appCheckToken: appCheckResult?.token || '' };
  }, { config: firebaseConfig, siteKey: appCheckSiteKey, email, password, nonce: runNonce });

  idToken = String(tokenBundle?.idToken || '');
  appCheckToken = String(tokenBundle?.appCheckToken || '');
  if (!idToken) throw new Error('Browser Firebase ID token missing.');
  if (!appCheckToken) throw new Error('Browser Firebase App Check token missing.');

  const initialFeed = await browserFetch('GET', '/v1/feed?sort=latest&limit=40', { cacheBust: true });
  if (initialFeed.status !== 200 || initialFeed.payload?.ok !== true) throw new Error(`Initial feed failed: ${initialFeed.status}`);
  const target = extractItems(initialFeed.payload).find((item) => trackIdOf(item));
  if (!target) throw new Error('No public Explore track available for authenticated like probe.');
  targetTrackId = trackIdOf(target);
  await persistState();
  const initialCount = likeCountOf(target);

  const cycles = [];
  cycles.push(await performLikeCycle(1));
  if (cycles[0].put.writes === 4) cycles.push(await performLikeCycle(2));
  const normal = cycles.find((entry) => entry.put.reads === 1 && entry.put.writes === 3);
  if (!normal) throw new Error(`No normal 1-read/3-write like cycle observed: ${JSON.stringify(cycles)}`);

  const finalResult = {
    ok: true,
    environment: envName,
    origin,
    workerBase,
    uid,
    targetTrackId,
    initialLikeCount: initialCount,
    cycles,
    measuredNormalLike: normal.put,
    feedR2RoundTrip: true,
    restoredToUnliked: true,
    firebaseAuth: true,
    appCheck: true,
    measuredAt: new Date().toISOString(),
  };
  await writeFile(outputPath, `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
  console.log(`SORIDRAW_044_${envName.toUpperCase()}_LIKE_MEASUREMENT=PASS`);
  console.log(`SORIDRAW_044_${envName.toUpperCase()}_LIKE_D1_READS=${normal.put.reads}`);
  console.log(`SORIDRAW_044_${envName.toUpperCase()}_LIKE_D1_WRITES=${normal.put.writes}`);
  console.log(`SORIDRAW_044_${envName.toUpperCase()}_FEED_R2_ROUNDTRIP=PASS`);
} finally {
  if (page && likedActive && targetTrackId && idToken && appCheckToken) {
    try {
      const cleanup = await browserFetch('DELETE', `/v1/tracks/${encodeURIComponent(targetTrackId)}/like`, { auth: true });
      if (cleanup.status >= 200 && cleanup.status < 300 && cleanup.payload?.ok === true) {
        likedActive = false;
        await persistState();
      }
    } catch (error) {
      console.error('Emergency unlike cleanup failed:', error);
    }
  }
  if (browser) await browser.close().catch(() => {});
  if (userCreated) {
    try { await getAuth(adminApp).deleteUser(uid); } catch (error) { console.error('Temporary Firebase user cleanup failed:', error); }
  }
  await deleteApp(adminApp).catch(() => {});
  await persistState().catch(() => {});
  if (likedActive) throw new Error('Diagnostic like cleanup did not complete; promotion must stop.');
}

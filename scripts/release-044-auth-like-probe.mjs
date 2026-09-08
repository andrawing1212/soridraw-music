import { writeFile } from 'node:fs/promises';
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { chromium } from 'playwright';

const envName = String(process.env.SORIDRAW_PROBE_ENV || '').trim();
const origin = String(process.env.SORIDRAW_PROBE_ORIGIN || '').replace(/\/+$/, '');
const workerBase = String(process.env.SORIDRAW_PROBE_WORKER || '').replace(/\/+$/, '');
const outputPath = String(process.env.SORIDRAW_PROBE_OUTPUT || `release044-probe-${envName || 'unknown'}.json`);
const firebaseProjectId = 'soridraw-app-866a5';
const firebaseApiKey = 'AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA';
const firebaseAppId = '1:91309780603:web:cde703895e2cf31ecffcde';

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

const uid = `soridraw044_${envName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
const adminApp = initializeApp({ credential: applicationDefault(), projectId: firebaseProjectId }, `soridraw044-${envName}-${Date.now()}`);
let browser;
let page;
let idToken = '';
let appCheckToken = '';
let targetTrackId = '';
let likedActive = false;
let finalResult = null;

const exchangeCustomToken = async (customToken) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.idToken) throw new Error(`Firebase custom-token exchange failed: ${response.status} ${JSON.stringify(payload).slice(0, 600)}`);
  return String(payload.idToken);
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
  await adminAuth.createUser({ uid, displayName: `SORIDRAW 044 ${envName} Probe`, disabled: false });
  const customToken = await adminAuth.createCustomToken(uid);
  idToken = await exchangeCustomToken(customToken);
  const appCheck = await getAppCheck(adminApp).createToken(firebaseAppId, { ttlMillis: 30 * 60 * 1000 });
  appCheckToken = String(appCheck?.token || '');
  if (!appCheckToken) throw new Error('Firebase Admin App Check token creation failed.');

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (new URL(page.url()).origin !== new URL(origin).origin) throw new Error(`Unexpected probe origin: ${page.url()}`);

  const initialFeed = await browserFetch('GET', '/v1/feed?sort=latest&limit=40', { cacheBust: true });
  if (initialFeed.status !== 200 || initialFeed.payload?.ok !== true) throw new Error(`Initial feed failed: ${initialFeed.status}`);
  const target = extractItems(initialFeed.payload).find((item) => trackIdOf(item));
  if (!target) throw new Error('No public Explore track available for authenticated like probe.');
  targetTrackId = trackIdOf(target);
  const initialCount = likeCountOf(target);

  const cycles = [];
  cycles.push(await performLikeCycle(1));
  // The rate-limit maintenance cleanup is intentionally rare. If it happened on
  // the first fresh diagnostic UID, run one additional restored cycle so the
  // ordinary steady-state PUT cost is measured directly as 1 read / 3 writes.
  if (cycles[0].put.writes === 4) cycles.push(await performLikeCycle(2));
  const normal = cycles.find((entry) => entry.put.reads === 1 && entry.put.writes === 3);
  if (!normal) throw new Error(`No normal 1-read/3-write like cycle observed: ${JSON.stringify(cycles)}`);

  finalResult = {
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
      if (cleanup.status >= 200 && cleanup.status < 300) likedActive = false;
    } catch (error) {
      console.error('Emergency unlike cleanup failed:', error);
    }
  }
  if (browser) await browser.close().catch(() => {});
  try { await getAuth(adminApp).deleteUser(uid); } catch (error) { console.error('Temporary Firebase user cleanup failed:', error); }
  await deleteApp(adminApp).catch(() => {});
  if (likedActive) throw new Error('Diagnostic like cleanup did not complete; promotion must stop.');
}

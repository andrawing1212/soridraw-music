// App393 remote browser probe: guest only, no sign-in, clicks, writes, or account data.
// Designed for existing targeted PREVIEW QA, not a release or device-equivalence claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = 'https://preview.soridraw.com';
const expectedVersion = Number(JSON.parse(readFileSync('public/app-version.json', 'utf8')).version);
const response = await fetch(base + '/app-version.json', {
  headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000),
});
assert.equal(response.status, 200, 'PREVIEW app-version endpoint must be reachable');
const release = await response.json();
assert.equal(Number(release.version), expectedVersion, 'PREVIEW version differs from pinned app393');
console.log('PREVIEW_APP_PREVIEW_HTTP_VERSION=PASS version=' + expectedVersion);

const chromePaths = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = chromePaths.find(path => existsSync(path));
assert.ok(executablePath, 'Hosted runner lacks Chrome/Chromium; do not pretend browser test passed');
const browser = await chromium.launch({
  headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const rows = [];
try {
  for (const config of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: 'mobile-emulated', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({
      viewport: config.viewport, isMobile: config.isMobile,
      hasTouch: config.hasTouch, deviceScaleFactor: config.isMobile ? 2 : 1,
      serviceWorkers: 'block', locale: 'ko-KR',
    });
    const page = await context.newPage();
    const assetFailures = [];
    const runtimeErrors = [];
    page.on('response', response => {
      if (response.url().startsWith(base + '/assets/') &&
          /\.(?:m?js|css)(?:\?|$)/.test(response.url()) && response.status() >= 400) {
        assetFailures.push({ status: response.status(), url: response.url().split('/').pop() });
      }
    });
    page.on('requestfailed', request => {
      if (request.url().startsWith(base + '/assets/')) {
        assetFailures.push({ failed: request.failure()?.errorText, url: request.url().split('/').pop() });
      }
    });
    page.on('pageerror', error => runtimeErrors.push(String(error.message || error).slice(0, 200)));
    await page.addInitScript(() => {
      window.__soridrawBrowserProbe = { longTasks: [] };
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__soridrawBrowserProbe.longTasks.push(Math.round(entry.duration));
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch { /* unsupported: report count=0 without claiming long-task parity */ }
    });
    const started = Date.now();
    const navigation = await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert.equal(navigation?.status(), 200, config.name + ' root document HTTP failure');
    await page.waitForFunction(() => {
      const root = document.querySelector('#root');
      return root && (root.innerText || root.textContent || '').trim().length > 15;
    }, { timeout: 22000 });
    await page.waitForTimeout(3500);
    const measurements = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const lazy = resources.map(entry => entry.name.split('/').pop()).filter(name =>
        /^geminiService-|^MusicApiGenerateModal-/.test(name || ''));
      const longTasks = window.__soridrawBrowserProbe?.longTasks || [];
      const sorted = [...longTasks].sort((a, b) => a - b);
      const nav = performance.getEntriesByType('navigation')[0];
      const sameOriginAssets = resources.filter(entry =>
        entry.name.startsWith(location.origin + '/assets/'));
      return {
        title: document.title, rootChars: document.querySelector('#root')?.innerText?.trim().length || 0,
        rootPreview: document.querySelector('#root')?.innerText?.trim().slice(0, 150) || '',
        domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd || 0),
        assetCount: sameOriginAssets.length,
        assetTransferredBytes: sameOriginAssets.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        lazyChunksFetchedBeforeAction: lazy,
        longTaskCount: longTasks.length,
        longTaskP95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0,
      };
    });
    const row = { device: config.name, elapsedMs: Date.now() - started, ...measurements,
      assetFailures, runtimeErrors };
    console.log('PREVIEW_APP_GUEST_BROWSER_METRICS=' + JSON.stringify(row));
    assert.ok(measurements.rootChars > 15, config.name + ' blank React root');
    assert.equal(assetFailures.length, 0, config.name + ' first-load JS/CSS asset failure');
    assert.equal(measurements.lazyChunksFetchedBeforeAction.length, 0,
      config.name + ' loaded Gemini/modal chunk without an explicit action');
    // Non-fatal errors from external Auth/AppCheck endpoints are reported for review.
    rows.push(row);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('PREVIEW_APP_GUEST_BROWSER=PASS deviceProfiles=' + rows.length);
console.log('PREVIEW_APP_ACCOUNT_GENERATION_BACK_FORWARD_SPLITTER_AND_REAL_MOBILE=NOT_TESTED');
console.log('PREVIEW_APP_BROWSER_PROBE_NO_AUTH_NO_MUTATION=true');

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
    { name: 'desktop-wide', viewport: { width: 1800, height: 940 }, isMobile: false, hasTouch: false },
    { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { name: 'tablet-emulated', viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: true },
    { name: 'tablet-split-edge', viewport: { width: 1100, height: 840 }, isMobile: false, hasTouch: true },
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
    // Same guest device, same site; second visit checks for accidental blank
    // roots, repeat lazy downloads and crashed JS. No account or DB access.
    const warmNavigation = await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    assert.equal(warmNavigation?.status(), 200, config.name + ' warm revisit HTTP failure');
    await page.waitForFunction(() => {
      const root = document.querySelector('#root');
      return root && (root.innerText || root.textContent || '').trim().length > 15;
    }, { timeout: 22000 });
    await page.waitForTimeout(1100);
    const warm = await page.evaluate(() => ({
      rootChars: document.querySelector('#root')?.innerText?.trim().length || 0,
      domContentLoadedMs: Math.round(
        performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0,
      ),
      lazyChunksFetchedWithoutAction: performance.getEntriesByType('resource')
        .map(entry => entry.name.split('/').pop())
        .filter(name => /^geminiService-|^MusicApiGenerateModal-/.test(name || '')),
    }));
    assert.ok(warm.rootChars > 15, config.name + ' guest warm revisit blank');
    assert.deepEqual(warm.lazyChunksFetchedWithoutAction, [],
      config.name + ' warm visit downloaded generation chunk with no action');
    assert.equal(assetFailures.length, 0, config.name + ' guest cold/warm asset failures');
    row.warmRevisit = warm;
    console.log('PREVIEW_APP_GUEST_BROWSER_WARM_METRICS=' + JSON.stringify({
      device: config.name, ...warm,
    }));
    // Non-fatal errors from external Auth/AppCheck endpoints are reported for review.
    rows.push(row);
    await context.close();
  }
  // Repeat both desktop widths in interleaved order after the browser
  // has already reached the origin. Every sample uses an empty browser
  // context (fresh HTTP/cache state). A single early 1800px sample can be
  // affected by DNS/TLS / cold runner startup rather than viewport layout.
  // Measure root-ready as well as DOMContentLoaded, not only network timing.
  const repeated = [];
  const permutations = [
    [{name:'pc1800',width:1800,height:940},{name:'pc1440',width:1440,height:900}],
    [{name:'pc1440',width:1440,height:900},{name:'pc1800',width:1800,height:940}],
    [{name:'pc1800',width:1800,height:940},{name:'pc1440',width:1440,height:900}],
  ];
  for (const [round, pair] of permutations.entries()) {
    for (const config of pair) {
      const context = await browser.newContext({
        viewport:{width:config.width,height:config.height},
        serviceWorkers:'block',locale:'ko-KR',
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error.message || error)));
        await page.addInitScript(() => {
          window.__soridrawRepeatLongTasks = [];
          try {
            new PerformanceObserver(list => {
              for(const entry of list.getEntries()) {
                window.__soridrawRepeatLongTasks.push(Math.round(entry.duration));
              }
            }).observe({type:'longtask',buffered:true});
          } catch { /* unsupported observer, recorded as an empty sample */ }
        });
        const start = Date.now();
        const navigation = await page.goto(base+'/',{
          waitUntil:'domcontentloaded',timeout:45000,
        });
        assert.equal(navigation?.status(),200,config.name+' repeated HTTP failure');
        await page.waitForFunction(() => {
          const root = document.querySelector('#root');
          return root && (root.innerText || root.textContent || '').trim().length > 15;
        },{timeout:22000});
        const rootReadyMs = Date.now()-start;
        await page.waitForTimeout(900);
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          const tasks = window.__soridrawRepeatLongTasks || [];
          const sorted = [...tasks].sort((a,b)=>a-b);
          return {
            domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),
            documentResponseMs:Math.round(nav?.responseEnd||0),
            domAfterResponseMs:Math.round((nav?.domContentLoadedEventEnd||0)-
              (nav?.responseEnd||0)),
            assetCount:resources.filter(x=>x.name.startsWith(
              location.origin+'/assets/')).length,
            longTaskCount:tasks.length,
            longestTaskMs:sorted.length?sorted.at(-1):0,
            rootChars:document.querySelector('#root')?.innerText?.trim().length||0,
          };
        });
        assert.ok(metrics.rootChars>15,config.name+' repeated root blank');
        assert.deepEqual(errors,[],config.name+' repeated JS errors');
        const row={round:round+1,device:config.name,rootReadyMs,...metrics};
        repeated.push(row);
        console.log('PREVIEW_APP_DESKTOP_REPEATED_COLD='+JSON.stringify(row));
      } finally {
        await context.close();
      }
    }
  }
  const median = numbers => [...numbers].sort((a,b)=>a-b)[Math.floor(numbers.length/2)];
  const desktopSummary = Object.fromEntries(['pc1800','pc1440'].map(name => {
    const selected=repeated.filter(r=>r.device===name);
    assert.equal(selected.length,3,name+' missing repeated samples');
    return [name,{
      samples: selected.length,
      medianDclMs:median(selected.map(x=>x.domContentLoadedMs)),
      medianRootReadyMs:median(selected.map(x=>x.rootReadyMs)),
      medianDocumentResponseMs:median(selected.map(x=>x.documentResponseMs)),
      medianDomAfterResponseMs:median(selected.map(x=>x.domAfterResponseMs)),
      maxLongTaskMs:Math.max(...selected.map(x=>x.longestTaskMs)),
    }];
  }));
  const dclDeltaMs=desktopSummary.pc1800.medianDclMs-desktopSummary.pc1440.medianDclMs;
  const rootDeltaMs=desktopSummary.pc1800.medianRootReadyMs-
    desktopSummary.pc1440.medianRootReadyMs;
  const desktopRepeatReport={...desktopSummary,dclDeltaMs,rootDeltaMs,
    sustainedWideSlowdown:dclDeltaMs>750&&rootDeltaMs>750};
  console.log('PREVIEW_APP_DESKTOP_REPEATED_SUMMARY='+JSON.stringify(desktopRepeatReport));
  console.log('PREVIEW_APP_DESKTOP_COLD_REPEATED_3X_PER_WIDTH=PASS');
} finally {
  await browser.close();
}
console.log('PREVIEW_APP_GUEST_BROWSER=PASS deviceProfiles=' + rows.length);
console.log('PREVIEW_APP_PC_TABLET_MOBILE_COLD_WARM_NO_MUTATION=PASS');
console.log('PREVIEW_APP_ACCOUNT_GENERATION_BACK_FORWARD_SPLITTER_AND_REAL_MOBILE=NOT_TESTED');
console.log('PREVIEW_APP_BROWSER_PROBE_NO_AUTH_NO_MUTATION=true');

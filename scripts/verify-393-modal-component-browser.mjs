// Isolated real Chrome test of the unchanged app393 lazy modal components.
// No authenticated SORIDRAW profile, generation, Firebase, Workers, or D1.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const baseDir = await mkdtemp(join(tmpdir(), 'soridraw393-modal-'));
let server = null;
let browser = null;
try {
  await build({
    entryPoints: ['scripts/fixtures/393-modal-entry.tsx'], bundle: true,
    format: 'esm', platform: 'browser', splitting: true,
    outdir: baseDir, entryNames: 'entry', chunkNames: 'chunks/[name]-[hash]',
    jsx: 'automatic', target: 'es2020', logLevel: 'error',
  });
  await writeFile(join(baseDir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"/></head><body>' +
    '<div id="root"></div><script type="module" src="/entry.js"></script>' +
    '</body></html>', 'utf8');
  server = createServer(async (req, res) => {
    const name = (req.url || '/').split('?')[0].replace(/^\/+/, '') || 'index.html';
    const filename = resolve(baseDir, name);
    if (!filename.startsWith(baseDir + '/') && filename !== join(baseDir, 'index.html')) {
      res.writeHead(403); res.end(); return;
    }
    try {
      const bytes = await readFile(filename);
      res.writeHead(200, { 'Content-Type': extname(filename) === '.js'
        ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const executablePath = [process.env.CHROME_BIN,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium'].filter(Boolean).find(path => existsSync(path));
  assert.ok(executablePath, 'Chrome binary missing; browser validation not completed');
  browser = await chromium.launch({ headless: true, executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const profile of [
    { device: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
    { device: 'mobile-emulated', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({
      viewport: profile.viewport, isMobile: profile.isMobile, hasTouch: profile.hasTouch,
    });
    const page = await context.newPage();
    const chunks = [];
    const errors = [];
    page.on('request', request => {
      if (request.url().includes('/chunks/') && request.url().includes('MusicApiGenerateModal')) {
        chunks.push(request.url());
      }
    });
    page.on('pageerror', error => errors.push(String(error.message || error)));
    await page.route(/\/chunks\/MusicApiGenerateModal-[\w-]+\.js/, async route => {
      // Deliberately slow only the first modal fetch to reproduce a real loading gap.
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#open-main').waitFor();
    assert.equal(chunks.length, 0, profile.device + ' eagerly loaded modal chunk');
    const begin = Date.now();
    await page.locator('#open-main').click();
    await page.getByText('생성 옵션 선택', { exact: true }).waitFor({ timeout: 15000 });
    const openMs = Date.now() - begin;
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByText('생성 준비 완료', { exact: true }).waitFor({ timeout: 5000 });
    await page.evaluate(() => history.back());
    await page.getByText('생성 옵션 선택', { exact: true }).waitFor({ timeout: 5000 });
    await page.locator('button[title="닫기"]').click();
    await page.locator('.music-api-generate-modal').waitFor({ state: 'detached' });
    await page.locator('#open-main').click();
    await page.getByText('생성 옵션 선택', { exact: true }).waitFor({ timeout: 5000 });
    await page.locator('button[title="닫기"]').click();
    await page.locator('.music-api-generate-modal').waitFor({ state: 'detached' });
    await page.locator('#open-musicapi').click();
    await page.getByText('Music API로 보낼 대상과 가사를 선택합니다.',
      { exact: true }).waitFor({ timeout: 5000 });
    assert.ok(chunks.length >= 1, 'missing lazy chunk request');
    assert.deepEqual(errors, [], profile.device + ' runtime page errors');
    const row = { device: profile.device, firstOpenMs: openMs,
      firstOpenArtificialNetworkDelayMs: 1000,
      modalChunksRequested: chunks.length,
      mainStepForwardBack: 'PASS', reopen: 'PASS', musicApiVariant: 'PASS',
      jsRuntimeErrors: errors.length };
    console.log('APP393_MODAL_CHROME=' + JSON.stringify(row));
    await context.close();
  }
  console.log('APP393_MODAL_ISOLATED=PASS profiles=2');
  console.log('APP393_MODAL_LIVE_AUTH_SUNO_GENERATION_AND_DEVICE=NOT_TESTED');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(baseDir, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function assertAppVersionSource() {
  const { version } = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
  assert.match(String(version), /^\d+$/, 'app version must be numeric');
  const config = readFileSync('vite.config.ts', 'utf8');
  assert.ok(config.includes("'public/app-version.json'"));
  assert.ok(config.includes('__SORIDRAW_APP_VERSION__: JSON.stringify(appVersion)'));
  const notice = readFileSync('src/services/appUpdateNotice.ts', 'utf8');
  assert.ok(notice.includes('const CURRENT_APP_VERSION = __SORIDRAW_APP_VERSION__;'));
  assert.doesNotMatch(notice, /CURRENT_APP_VERSION\s*=\s*['"\d]/);
  return String(version);
}

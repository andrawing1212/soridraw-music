import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const marker = 'SORIDRAW_EXPLORE_ACTIVE_REVALIDATION_045_20260908';
const required = [
  marker,
  'EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 30_000',
  "window.addEventListener('pageshow', requestRevisionCheck)",
  "window.addEventListener('pointerdown', requestActivityRevisionCheck, { passive: true })",
  "window.removeEventListener('pointerdown', requestActivityRevisionCheck)",
  'fetchRevision()',
  '/v1/feed-revision',
];
for (const token of required) {
  if (!page.includes(token)) throw new Error(`045 missing: ${token}`);
}
if (/setInterval\s*\(/.test(page)) throw new Error('045 must not add polling');
if ((page.match(/SORIDRAW_EXPLORE_ACTIVE_REVALIDATION_045_20260908/g) || []).length !== 1) {
  throw new Error('045 marker count mismatch');
}
console.log('VERIFY_045_EXPLORE_ACTIVE_REVALIDATION=PASS');
console.log('ACTIVITY_REVISION_ONLY=PASS');
console.log('NO_POLLING=PASS');

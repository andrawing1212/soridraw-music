import { readFileSync } from 'node:fs';

const failures = [];
const app = readFileSync('src/App.tsx', 'utf8');
const library = readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');

function functionBody(source, signature, label) {
  const start = source.indexOf(signature);
  if (start < 0) {
    failures.push(`${label}: anchor missing`);
    return '';
  }
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  failures.push(`${label}: unterminated`);
  return '';
}

const musicRecovery = functionBody(app, 'const runFavoritesFullCacheRecoveryOnce = async () =>', 'Music Note recovery');
for (const forbidden of ['getDocs(', "collection(db, 'favorites')", 'collection(db, "favorites")']) {
  if (musicRecovery.includes(forbidden)) failures.push(`Music Note recovery contains forbidden unbounded read: ${forbidden}`);
}

// The historical cache-parity migration is not allowed to become an executable
// path again. It used to turn cache/schema loss into an owner-wide read.
for (const forbidden of [
  'Cacheless Music Note full bootstrap failed',
  "const fullSnapshot = await getDocs(query(\n              collection(db, 'favorites')",
]) {
  if (app.includes(forbidden)) failures.push(`App still contains retired whole-owner bootstrap: ${forbidden}`);
}

// Library cold/bootstrap fetches must always be explicitly bounded. This guard
// catches the retired exact getDocs(tracksRef) path if it is ever reintroduced.
if (/const\s+snapshot\s*=\s*await\s+getDocs\(tracksRef\)\s*;/.test(library)) {
  failures.push('Library contains forbidden unbounded getDocs(tracksRef) cold read');
}

// Public/shared discovery queries are allowed only with an explicit bounded limit.
const publicGroupQuery = library.match(/const\s+q\s*=\s*query\([\s\S]{0,500}?collectionGroup\(db,\s*['"]tracks['"]\)[\s\S]{0,500}?\);/);
if (publicGroupQuery && !/limit\s*\(/.test(publicGroupQuery[0])) {
  failures.push('Library public collectionGroup fallback is missing an explicit limit');
}

if (failures.length) {
  console.error('SORIDRAW NO-FULL-SONG-READ GUARD: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SORIDRAW NO-FULL-SONG-READ GUARD: PASS');
console.log('Invariant: new device / cleared cache / schema change may load only bounded pages, never the owner\'s whole song collection.');

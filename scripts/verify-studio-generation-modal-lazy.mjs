// App-start performance boundary. No Firebase, user data or network calls.
// Preserve both modal variants and lyric-writing preference behavior.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync('src/App.tsx','utf8');
const modal = readFileSync('src/components/MusicApiGenerateModal.tsx','utf8');
const lazy = readFileSync('src/components/MusicApiGenerateModalLazy.tsx','utf8');
const preference = readFileSync('src/components/musicApiLyricWritingPreference.ts','utf8');

assert.match(app,/import MusicApiGenerateModal from ['"]\.\/components\/MusicApiGenerateModalLazy['"]/);
assert.doesNotMatch(app,/^import (?!type\b).*from ['"]\.\/components\/MusicApiGenerateModal['"]/m,
  'App startup must not import the 63KB settings UI at runtime');
assert.match(app,/import type \{[^}]*LanguageCode[^}]*\} from ['"]\.\/components\/MusicApiGenerateModal['"]/);
assert.match(app,/import \{ readStoredV1LyricWritingStyle, writeStoredV1LyricWritingStyle \} from ['"]\.\/components\/musicApiLyricWritingPreference['"]/);
assert.match(lazy,/lazy\(\(\) => import\(['"]\.\/MusicApiGenerateModal['"]\)\)/);
assert.match(lazy,/<MusicApiGenerateModalImpl \{\.\.\.props\} \/>/,
  'the lazy wrapper must forward every prop without remount transforms');
assert.match(lazy,/<Suspense fallback=\{\(/, 'lazy modal must show a loading state');
assert.match(lazy,/role="status"/, 'first modal download must report loading accessibly');
assert.match(lazy,/aria-live="polite"/);
assert.match(lazy,/aria-label="생성 설정 불러오는 중…"/, 'status needs an accessible name');
assert.match(lazy,/생성 설정 불러오는 중/, 'avoid an apparently unresponsive first click');
assert.match(modal,/export default function MusicApiGenerateModal\(/);
assert.match(modal,/export \{ readStoredV1LyricWritingStyle, writeStoredV1LyricWritingStyle \} from/);
assert.match(modal,/import \{ readStoredV1LyricWritingStyle \} from/);
for (const key of ['soridraw.main.v1LyricWritingStyle','__soridrawV1LyricWritingStyle','default','kimEana']) {
  assert.ok(preference.includes(key),'preserve preference '+key);
}
assert.match(preference,/window\.localStorage\.getItem\(/);
assert.match(preference,/window\.localStorage\.setItem\(/);
assert.equal((app.match(/<MusicApiGenerateModal\b/g)||[]).length,2,
  'both the main and the Music API generation dialogs must remain available');
console.log('STUDIO_MODAL_EAGER_IMPORT_REMOVED=PASS');
console.log('STUDIO_MODAL_MAIN_AND_SUNO_VARIANTS_PRESERVED=PASS');
console.log('STUDIO_MODAL_LYRIC_WRITING_PREFERENCE_PRESERVED=PASS');
console.log('STUDIO_MODAL_SUSPENSE_LOADING_FALLBACK=PASS');
console.log('STUDIO_MODAL_REAL_FIRST_OPEN_BROWSER_LATENCY=NOT_TESTED');

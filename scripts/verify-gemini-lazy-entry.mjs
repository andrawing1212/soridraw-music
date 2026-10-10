// Source-only regression: rendering/navigating the app must not import the
// 1.8MB Gemini generation engine. The unchanged engine loads on first action.
// No real Gemini calls, network, Firebase reads, or user data changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const loader = readFileSync('src/services/geminiServiceLazy.ts', 'utf8');
const engine = readFileSync('src/services/geminiService.ts', 'utf8');
assert.match(app,
  /from ['"]\.\/services\/geminiServiceLazy['"]/,
  'App must use the asynchronous facade');
assert.doesNotMatch(app,
  /from ['"]\.\/services\/geminiService['"]/,
  'App startup must not directly load heavy generation engine');
assert.match(loader,
  /enginePromise = import\(['"]\.\/geminiService['"]\)\.catch/,
  'a shared dynamic import must load engine on demand');
assert.match(loader,
  /enginePromise = null;\s*throw error;/,
  'failed chunk download must be retryable and never swallowed');
assert.ok(engine.length > 100_000,
  'verify the original full-generation engine remains in place');
for(const name of [
  'generateSong',
  'translateTitleAndLyrics',
  'translateLyrics',
  'generateCustomSectionMetadata',
  'regenerateLyricsOnly',
]){
  assert.match(loader,new RegExp('export const '+name+': GeminiEngine\\[\\\''+name+'\\\'\\]'),
    name+' must preserve the original TypeScript contract');
  assert.match(engine,new RegExp('export async function '+name+'\\('),
    name+' must still be implemented in original engine');
  assert.match(loader,new RegExp('loadGeminiEngine\\(\\)\\.then\\(\\(mod\\) => mod\\.'+name+'\\('),
    name+' must not run until the user invokes it');
}
console.log('GEMINI_GENERATION_ENTRY_NOT_EAGER=PASS');
console.log('GEMINI_FIVE_PUBLIC_ASYNC_ACTIONS_PRESERVED=PASS');
console.log('GEMINI_CHUNK_FAILURE_RETRYABLE=PASS');
console.log('GEMINI_AI_REQUESTS_EMULATOR_AND_BROWSER_CLICK=NOT_TESTED');

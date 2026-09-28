import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const page = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');

assert.match(page, /SORIDRAW_EXPLORE_TITLE_DISPLAY_218_20260928/);
assert.match(page, /\.split\(\/\\s\*\[\|│\]\\s\*\/\)/);
assert.match(page, /\.map\(stripExploreTitleWrapperQuotes218\)/);
assert.match(page, /\.join\(' \\| '\)/);
assert.match(page, /const title = normalizeExploreDisplayTitle218\(titleSource\) \|\| '제목 없는 곡'/);

const stripStart = page.indexOf('const stripExploreTitleWrapperQuotes218 =');
const titleStart = page.indexOf('const normalizeExploreDisplayTitle218 =', stripStart);
const titleEnd = page.indexOf('\n\nconst getExploreCardDisplayTitle', titleStart);
assert.ok(stripStart >= 0 && titleStart > stripStart && titleEnd > titleStart);

const helperSource = page.slice(stripStart, titleEnd);
const js = ts.transpileModule(
  helperSource + '\nreturn normalizeExploreDisplayTitle218;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
).outputText;
const normalizeTitle = new Function(js)();

assert.equal(normalizeTitle("'한글제목' | 'Foreign Title'"), '한글제목 | Foreign Title');
assert.equal(normalizeTitle("'제목'"), '제목');
assert.equal(normalizeTitle('“한글 제목” │ “English Title”'), '한글 제목 | English Title');
assert.equal(normalizeTitle("Don't Stop"), "Don't Stop");
assert.equal(normalizeTitle('제목'), '제목');

console.log('218_EXPLORE_BILINGUAL_TITLE_QUOTES_REMOVED=PASS');
console.log('218_EXPLORE_TITLE_SEPARATOR_SPACED=PASS');
console.log('218_EXPLORE_SINGLE_TITLE_QUOTES_REMOVED=PASS');
console.log('218_EXPLORE_RAW_TITLE_DATA_UNCHANGED=PASS');

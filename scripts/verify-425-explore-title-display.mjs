import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/exploreTitleDisplay.ts', 'utf8');
const js = ts.transpileModule(source + '\n(globalThis).__formatExploreDisplayTitle = formatExploreDisplayTitle;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const context = { globalThis: {} };
vm.runInNewContext(js, context);
const format = context.globalThis.__formatExploreDisplayTitle;

assert.equal(format("[Nu Metal] '무거운 발걸음' | 'Heavy Footsteps'"), '[Nu Metal] 무거운 발걸음 | Heavy Footsteps');
assert.equal(format("[Dream Pop] '그날의 나에게' │ 'To Me That Day'"), '[Dream Pop] 그날의 나에게 | To Me That Day');
assert.equal(format("[Dance] Ain's Sweet Garden"), "[Dance] Ain's Sweet Garden");
assert.equal(format("[Pop] “Hello” | ‘안녕’"), '[Pop] Hello | 안녕');
assert.equal(format("'Single Title'"), 'Single Title');

const modal = fs.readFileSync('src/components/explore/ExplorePublicationSettingsModal.tsx', 'utf8');
const page = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');
assert.match(modal, /formatExploreDisplayTitle\(title\)/);
assert.match(modal, /formatExploreDisplayTitle\(choice\.title\)/);
assert.match(page, /<strong>\{formatExploreDisplayTitle\(moreTrack\.title\)\}<\/strong>/);
assert.doesNotMatch(source, /updateDoc|setDoc|fetch\(|trackId|likeCount/, 'display formatter must stay data-side-effect free');

console.log('APP425_EXPLORE_TITLE_DISPLAY_NORMALIZATION=PASS');
console.log('APP425_CANONICAL_TITLE_UNCHANGED=PASS');

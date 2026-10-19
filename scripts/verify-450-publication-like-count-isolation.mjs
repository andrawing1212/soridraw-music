import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execution test of the real source helper, not a duplicate implementation.
const policySource = fs.readFileSync('src/services/explorePublicationLivePolicy433.ts', 'utf8');
const compiled = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox);
const merge = sandbox.exports.mergeExplorePublicationCardPreservingLikeCount435;
assert.equal(typeof merge, 'function', 'app435 source merge must be executable');

const existing = { id: 'song', title: 'old', likeCount: 4, ownerUid: 'author' };
const incoming = { id: 'song', title: 'new', likeCount: 0, ownerUid: 'author' };
const merged = merge(existing, incoming);
assert.equal(merged.likeCount, 4, 'late publication projection cannot erase published like count');
assert.equal(merged.title, 'new', 'publication metadata must still refresh');
assert.equal(existing.likeCount, 4, 'input must remain immutable');
assert.equal(incoming.likeCount, 0, 'input must remain immutable');
assert.equal(merge({ id: 's', likeCount: 0 }, { likeCount: 9 }).likeCount, 0,
  'valid zero cannot be overwritten by a stale publication card');
assert.equal(merge({ id: 's', likeCount: 8 }, { likeCount: 1 }).likeCount, 8,
  'the per-UID provisional number must survive publication refresh');
assert.equal(merge({ id: 's' }, { likeCount: 1 }).likeCount, 1,
  'brand-new cards may use first published count');
assert.equal(merge({ id: 's', title: 'old', likeCount: 5 }, { title: 'private?' }).title,
  'private?', 'other fields must continue to update');

const ui = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const feedCache = fs.readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const profileCache = fs.readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const uiUses = (ui.match(/mergeExplorePublicationCardPreservingLikeCount435\(/g) || []).length;
assert.ok(uiUses >= 6, 'both same-UID and cross-account UI publication paths must guard existing counts');
assert.match(feedCache, /next\[index\] = mergeExplorePublicationCardPreservingLikeCount435\(next\[index\], row\)/);
assert.match(profileCache,
  /existing \? mergeExplorePublicationCardPreservingLikeCount435\(existing, row\)/);
assert.match(ui, /const next432 = \[existing432[\s\S]{0,140}mergeExplorePublicationCardPreservingLikeCount435/);
assert.match(ui, /const next = \[existing[\s\S]{0,130}mergeExplorePublicationCardPreservingLikeCount435/);

// Isolation: do not couple the new publication path to an additional Worker,
// Firestore, per-card listener, timer, or modified personal like algorithm.
const helper = policySource.split('export const mergeExplorePublicationCardPreservingLikeCount435 =')[1];
assert.ok(helper && !/\bfetch\(|\bgetDocs\(|\bonValue\(|\bsetTimeout\(/.test(helper));
const likeSource = fs.readFileSync('src/services/exploreLikeService.ts', 'utf8');
assert.match(likeSource, /const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(likeSource, /export const EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/);
console.log('APP435_PUBLICATION_METADATA_PRESERVES_LIKE_COUNT=PASS');
console.log('APP435_EXISTING_UID_AND_CROSS_ACCOUNT_UI_AND_CACHE_GUARDS=PASS');
console.log('APP435_ZERO_SERVER_IO_AND_STAGE416_OFF=PASS');

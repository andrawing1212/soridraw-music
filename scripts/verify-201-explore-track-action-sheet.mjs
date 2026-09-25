import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const actionService = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const socialCss = readFileSync('src/components/explore/exploreSocial.css', 'utf8');

assert.match(page, /className="soridraw-explore-more-button"/, 'Explore cards must expose the compact more button');
assert.match(page, /<MoreHorizontal aria-hidden="true" \/>/, 'more button must use the ellipsis icon');
assert.match(page, /const renderMoreSheet = \(\) =>/, 'Explore must render the bottom action sheet');
assert.match(page, /onPointerDown=\{\(\) => \{\s*if \(!actionBusy\) closeMoreSheet\(\);/s, 'backdrop close must be pointer-safe and blocked while an action is busy');
assert.match(page, /document\.body\.style\.overflow = 'hidden'/, 'open action sheet must lock background scrolling');
assert.match(page, /event\.key !== 'Escape' \|\| moreActionBusy !== null/, 'Escape must not dismiss the sheet while an action is busy');
assert.match(page, /aria-pressed=\{liked\}/, 'sheet like action must expose its active state');
assert.match(page, />폴더에 추가</, 'folder action must remain in the sheet');
assert.match(page, />좋아요</, 'like action must remain in the sheet');
assert.match(page, />공유</, 'share action must remain in the sheet');
assert.match(page, /<strong>다음곡에 적용<\/strong>/, 'next-song apply action must remain in the sheet');
assert.match(page, /<strong>싫어요<\/strong>/, 'dislike action must remain in the sheet');

assert.match(page, /sessionStorage\.setItem\('pendingAppliedKeywords'/, 'next-song apply must reuse the existing pending keyword handoff');
assert.match(page, /localStorage\.setItem\('pendingAppliedKeywordsBackup'/, 'next-song apply backup handoff must remain');
assert.match(page, /navigate\('\/studio\?applyPending=1'\)/, 'next-song apply must route through the existing studio apply path');
assert.match(page, /await addPlaylistItem\(/, 'folder action must reuse existing playlist storage');
assert.match(page, /await toggleLike\(moreTrack\)/, 'sheet like action must reuse existing like behavior');
assert.match(page, /className="soridraw-explore-cover-button"/, 'existing cover open path must remain available after replacing the card-side icon');
assert.match(page, /onClick=\{openSuno\}/, 'existing cover click must still open the public audio target');
assert.match(page, /navigator\.share/, 'share action must reuse the browser share path');

assert.match(page, /markExploreTrackDisliked\(user\.uid, track\.id\)/, 'dislike must persist as a user-scoped local preference');
assert.match(page, /sort === 'recommended' && !submittedQuery/, 'dislike filtering must stay limited to the recommendation feed');
assert.match(page, /tracks\.filter\(\(track\) => !dislikedTrackIds\.has\(track\.id\)\)/, 'disliked tracks must be removed from recommendation rendering');
assert.match(actionService, /soridraw:explore:disliked:v1:/, 'dislike storage key must stay account scoped');
assert.match(actionService, /window\.localStorage\.setItem/, 'dislike must remain local-first without a new server mutation');

for (const className of [
  'soridraw-explore-more-backdrop',
  'soridraw-explore-more-sheet',
  'soridraw-explore-more-primary',
  'soridraw-explore-more-rows',
  'soridraw-explore-more-folder-list',
]) {
  assert.ok(socialCss.includes('.' + className), className + ' styling must exist');
}

assert.match(socialCss, /soridraw-explore-more-primary button\.is-active/, 'liked state must be visible inside the action sheet');

console.log('APP201_EXPLORE_MORE_ACTION_SHEET=PASS');
console.log('APP201_EXPLORE_EXISTING_ACTION_REUSE=PASS');
console.log('APP201_EXPLORE_DISLIKE_LOCAL_RECOMMENDATION_ONLY=PASS');

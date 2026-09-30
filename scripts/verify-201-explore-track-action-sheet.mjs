import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const actionService = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const socialCss = readFileSync('src/components/explore/exploreSocial.css', 'utf8');

assert.match(page, /className="soridraw-explore-more-button"/, 'Explore cards must expose the compact more button');
assert.match(page, /<EllipsisVertical aria-hidden="true" \/>/, 'more button must use the vertical ellipsis icon');
assert.match(page, /className="soridraw-explore-card-quick-actions"/, 'cards must keep compact quick actions under the song');
assert.match(page, /onApplyNext=\{applyExploreTrackToNextSong\}/, 'card next-song icon must reuse the same apply action');
assert.match(page, /onShare=\{shareExploreTrack\}/, 'card share icon must reuse the same share action');
assert.match(page, /const renderMoreSheet = \(\) =>/, 'Explore must render the bottom action sheet');
assert.match(page, /className="soridraw-explore-more-backdrop"[\s\S]*?onPointerDown=\{\(event\) => \{[\s\S]*?event\.target === event\.currentTarget[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onClick=\{\(event\) => \{[\s\S]*?event\.target !== event\.currentTarget[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?!actionBusy[\s\S]*?closeMoreSheet\(\)[\s\S]*?className="soridraw-explore-more-sheet"[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}[\s\S]*?onClick=\{\(event\) => event\.stopPropagation\(\)\}/, 'backdrop must absorb the full pointer/click sequence and close only after click completion so underlying buttons cannot be activated');
assert.match(page, /document\.body\.style\.overflow = 'hidden'/, 'open action sheet must lock background scrolling');
assert.match(page, /event\.key !== 'Escape' \|\| moreActionBusyRef257\.current !== null/, 'Escape must not dismiss the sheet while an action is busy');
assert.match(page, /onOpenMore=\{\(selectedTrack\) => \{[\s\S]*?window\.history\.pushState\([\s\S]*?soridrawExploreMore259: true[\s\S]*?setMoreTrack\(selectedTrack\)/, 'More must reserve its history entry synchronously before the sheet opens');
assert.match(page, /window\.addEventListener\('popstate', handlePopState257\)/, 'system/browser back must be captured while More is open on PC and mobile');
assert.match(page, /const handlePopState257 = \(\) => \{[\s\S]*?dismissMoreFromHistory257\(\)/, 'system/browser back must close More before leaving Explore');
assert.match(page, /aria-pressed=\{liked\}/, 'sheet like action must expose its active state');
assert.match(page, />공유 노트에 추가</, 'shared-note action must remain in the sheet');
assert.match(page, />좋아요</, 'like action must remain in the sheet');
assert.match(page, />공유</, 'share action must remain in the sheet');
assert.match(page, /<strong>다음곡에 적용<\/strong>/, 'next-song apply action must remain in the sheet');
assert.match(page, /<strong>싫어요<\/strong>/, 'dislike action must remain in the sheet');

assert.match(page, /sessionStorage\.setItem\('pendingAppliedKeywords'/, 'next-song apply must reuse the existing pending keyword handoff');
assert.match(page, /localStorage\.setItem\('pendingAppliedKeywordsBackup'/, 'next-song apply backup handoff must remain');
assert.match(page, /navigate\('\/studio\?applyPending=1'\)/, 'next-song apply must route through the existing studio apply path');
assert.match(page, /await saveExploreTrackToSharedNote\(user, track, folder\)/, 'shared-note action must use the Music Note shared-note path');
assert.doesNotMatch(page, /addPlaylistItem|getPlaylistsByType|ensureDefaultPlaylists/, 'Explore action sheet must not use Library playlist storage');
assert.match(page, /await toggleLike\(moreTrack\)/, 'sheet like action must reuse existing like behavior');
assert.match(page, /className="soridraw-explore-cover-button"/, 'cover artwork surface must remain available after the play-link refinement');
assert.doesNotMatch(page, /className="soridraw-explore-cover-button"[\s\S]{0,220}?onClick=/, 'cover artwork must remain non-interactive in app225');
assert.match(page, /className="soridraw-explore-preview-trigger"[\s\S]*?openSuno\(\)/, 'center play control must own the public Suno-link action');
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
assert.match(socialCss, /soridraw-explore-quick-apply\.is-available/, 'available next-song quick action must be visually emphasized');
assert.match(socialCss, /soridraw-explore-more-rows button\.is-available/, 'available next-song sheet action must be visually emphasized');
assert.match(socialCss, /soridraw-explore-more-button\{[^}]*border-radius:50%/s, 'vertical more button must have a visible circular control');

console.log('APP201_EXPLORE_MORE_ACTION_SHEET=PASS');
console.log('APP201_EXPLORE_EXISTING_ACTION_REUSE=PASS');
console.log('APP201_EXPLORE_DISLIKE_LOCAL_RECOMMENDATION_ONLY=PASS');
console.log('APP201_EXPLORE_QUICK_ACTION_GUIDE_PARITY=PASS');
console.log('APP201_EXPLORE_SHARED_NOTE_LABEL=PASS');

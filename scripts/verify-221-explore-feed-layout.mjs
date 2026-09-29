import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const css = readFileSync('src/components/explore/explore.css', 'utf8');
const social = readFileSync('src/components/explore/exploreSocial.css', 'utf8');
const globalPlayer = readFileSync('src/components/GlobalPlayer.tsx', 'utf8');

assert.match(page, /buildExploreRecommendationModel221/);
assert.match(page, /picks: source\.slice\(0, 20\)/);
assert.match(page, /tracks: bucket\.tracks\.slice\(0, 20\)/);
assert.match(page, /creators: \[\.\.\.creatorBuckets\.values\(\)\]\.slice\(0, 20\)/);
assert.match(page, /title="SORIDRAW 추천"/);
assert.match(page, /title="장르별 추천"/);
assert.match(page, /recommendationModel221\.genres\.map/);
assert.match(page, /setRecommendationGenreId221\(genre\.id\)/);
assert.match(page, /title="좋아할 만한 크리에이터"/);
assert.match(page, /ExploreCreatorCard221/);
assert.match(page, /sort === 'recommended' && !submittedQuery/);
assert.match(page, /ExploreRecommendationRail/);
assert.match(page, /ChevronLeft/);
assert.match(page, /ChevronRight/);
assert.match(page, /scrollBy\(\{[\s\S]*?behavior: 'smooth'/);
assert.doesNotMatch(
  page.slice(page.indexOf('const buildExploreRecommendationModel221'), page.indexOf('function ExploreTrackCard')),
  /fetch\(|getDocs\(|onSnapshot\(|setDoc\(|updateDoc\(/,
  'recommendation builder must remain local-only',
);

assert.match(
  css,
  /@media \(min-width:1800px\)\{[\s\S]*?\.soridraw-explore-grid--latest\{grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/,
  'latest feed must show 8 columns only on the largest PC band',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-track\{[\s\S]*?grid-auto-columns:calc\(\(100% - 84px\)\/7\)/,
  'recommendation rail must show 7 cards on the largest PC band',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-stage\{position:relative/,
  'recommendation rail must provide an overlay stage for edge arrows',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-edge--left\{left:8px\}/,
  'left arrow must overlay the left edge of the card rail',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-edge--right\{right:8px\}/,
  'right arrow must overlay the right edge of the card rail',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-keywords\{[\s\S]*?overflow-x:auto/,
  'genre folder buttons must stay inside one horizontally safe category toolbar',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-creator-avatar\{[\s\S]*?border-radius:50%/,
  'creator recommendations must use circular profile artwork',
);
assert.match(
  css,
  /@media \(min-width:1600px\) and \(max-width:1799px\)\{[\s\S]*?grid-auto-columns:calc\(\(100% - 72px\)\/5\)/,
  'recommendation rail must return to the existing 5-card density below the max-screen band',
);
assert.match(
  css,
  /@media \(min-width:1100px\) and \(max-width:1599px\)\{[\s\S]*?\.soridraw-explore-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
  'existing 4-column desktop/tablet behavior must stay intact',
);
assert.match(
  css,
  /@media \(max-width:1099px\)\{[\s\S]*?\.soridraw-explore-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  'existing 3-column narrow behavior must stay intact',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'existing 2-column mobile behavior must stay intact',
);

assert.match(
  social,
  /@media \(min-width:1100px\)\{[\s\S]*?\.soridraw-explore-like-button\{height:32px;gap:5px;font-size:12px\}/,
  'PC like action must be slightly larger',
);
assert.match(
  social,
  /\.soridraw-explore-quick-action,\.soridraw-explore-more-button\{width:32px;height:32px\}/,
  'PC apply/share/more actions must be slightly larger',
);

console.log('APP221_EXPLORE_LATEST_EIGHT_COLUMN_MAX_SCREEN=PASS');
console.log('APP221_EXPLORE_RECOMMENDED_SEVEN_CARD_RAIL=PASS');
console.log('APP221_EXPLORE_RAIL_EDGE_ARROWS=PASS');
console.log('APP221_EXPLORE_GENRES_ONE_CATEGORY_SWITCHER=PASS');
console.log('APP221_EXPLORE_GENRE_CAP_20=PASS');
console.log('APP221_EXPLORE_CREATOR_RECOMMENDATIONS_CAP_20=PASS');
console.log('APP221_EXPLORE_EXISTING_SHRINK_BREAKPOINTS_PRESERVED=PASS');
console.log('APP221_EXPLORE_PC_ACTION_BUTTONS_LARGER=PASS');
console.log('APP221_EXPLORE_RECOMMENDATIONS_LOCAL_ONLY=PASS');


assert.match(page, /EXPLORE_PREVIEW_MAX_MS_222\s*=\s*120_000/);
assert.match(page, /EXPLORE_EQ_BAR_COUNT_222\s*=\s*24/);
assert.match(page, /resolveExplorePreviewAudioUrl222/);
assert.match(page, /https:\/\/cdn1\.suno\.ai\/\$\{clipId\}\.mp3/);
assert.match(page, /useGlobalPlayerControls\(\)/);
assert.match(page, /__exploreCardPreview:\s*true/);
assert.match(page, /sourceType:\s*'shared_track'/);
assert.match(page, /scheduleExplorePreviewTimeout222\(track\.id\)/);
assert.match(page, /toggleGlobalPlayPause\(\)/);
assert.match(page, /isPreviewing=\{activeExplorePreviewTrackId222 === track\.id\}/);
assert.match(page, /soridraw-explore-preview-trigger/);
assert.match(page, /soridraw-explore-preview-eq-bars/);
assert.match(page, /<Play aria-hidden="true" \/>/);
assert.match(page, /<Pause aria-hidden="true" \/>/);

const previewHandlerStart = page.indexOf('const toggleExplorePreview222 =');
const previewHandlerEnd = page.indexOf('\n\n  useEffect(() => {', previewHandlerStart);
assert.ok(previewHandlerStart >= 0 && previewHandlerEnd > previewHandlerStart, 'Explore preview handler must remain discoverable');
const previewHandler = page.slice(previewHandlerStart, previewHandlerEnd);
assert.doesNotMatch(
  previewHandler,
  /fetch\(|getDocs\(|onSnapshot\(|setDoc\(|updateDoc\(|EXPLORE_API_BASE/,
  'Explore preview click must not add feed/D1/Firestore requests',
);

assert.match(
  css,
  /\.soridraw-explore-preview-trigger\{[\s\S]*?opacity:0[\s\S]*?transform:translate\(-50%,-50%\) scale\(\.86\)/,
  'preview play control must be hidden until hover/focus/active',
);
assert.match(
  css,
  /\.soridraw-explore-cover-wrap:hover \.soridraw-explore-preview-trigger[\s\S]*?opacity:1/,
  'hovering a cover must reveal the preview play button',
);
assert.match(
  css,
  /\.soridraw-explore-preview-eq\{position:absolute;[\s\S]*?inset:0/,
  'playing equalizer must cover the full thumbnail',
);
assert.match(
  css,
  /\.soridraw-explore-preview-eq-bars i\{[\s\S]*?animation:soridraw-explore-preview-bar-222/,
  'equalizer bars must animate only with compositor-friendly transforms',
);
assert.match(
  css,
  /@keyframes soridraw-explore-preview-bar-222\{[\s\S]*?transform:scaleY/,
  'equalizer animation must use transform scaleY instead of layout-height animation',
);
assert.match(
  css,
  /\.soridraw-explore-card\.is-previewing \.soridraw-explore-card-copy h3\{color:/,
  'playing card title must change color',
);
assert.match(
  globalPlayer,
  /if \(!currentTrack \|\| currentTrack\.parent\?\.__exploreCardPreview\) return null;/,
  'Explore card preview must reuse the shared audio engine without showing floating GlobalPlayer chrome',
);

console.log('APP222_EXPLORE_HOVER_PLAY_BUTTON=PASS');
console.log('APP222_EXPLORE_ACTIVE_TITLE_COLOR=PASS');
console.log('APP222_EXPLORE_FULL_COVER_EQUALIZER=PASS');
console.log('APP222_EXPLORE_SINGLE_SHARED_AUDIO_ENGINE=PASS');
console.log('APP222_EXPLORE_TWO_MINUTE_AUTO_STOP=PASS');
console.log('APP222_EXPLORE_PREVIEW_NO_FEED_SERVER_READ_WRITE=PASS');

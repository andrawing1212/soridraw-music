import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const css = readFileSync('src/components/explore/explore.css', 'utf8');
const social = readFileSync('src/components/explore/exploreSocial.css', 'utf8');

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
  'non-feed Explore grids must keep the existing 2-column mobile behavior',
);
assert.match(
  page,
  /className=\{\`soridraw-explore-grid\$\{feed \? ' soridraw-explore-grid--feed' : ''\}/,
  'main feed density must be scoped separately from public-profile grids',
);
assert.match(
  page,
  /renderTrackGrid\([\s\S]*?visibleFeedTracks[\s\S]*?sort === 'latest' && !submittedQuery \? 'latest' : 'default',[\s\S]*?true,[\s\S]*?\)/,
  'Latest and Popular main feeds must opt into the mobile feed density class',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-grid--feed\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:17px 8px\}/,
  'Latest and Popular mobile feeds must show three song cards per row',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-recommend-track:not\(\.soridraw-explore-recommend-track--creators\)\{grid-auto-columns:calc\(\(100% - 16px\)\/3\);gap:8px\}/,
  'Recommended mobile song rails must show three song cards in the viewport',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-recommend-track\{grid-auto-columns:calc\(\(100% - 10px\)\/2\);gap:10px\}/,
  'creator recommendation rail must retain its existing two-card mobile density',
);

assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-grid--feed \.soridraw-explore-card-copy h3,[\s\S]*?font-size:13\.5px/,
  'three-card mobile song surfaces must use the smaller title font',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-grid--feed \.soridraw-explore-creator,[\s\S]*?font-size:11\.5px/,
  'three-card mobile song surfaces must use the smaller creator font',
);
assert.match(
  page,
  /EXPLORE_MOBILE_RAIL_ALIGN_DELAY_MS_228\s*=\s*3_000/,
  'mobile recommendation rail alignment must wait three seconds after scrolling stops',
);
assert.match(
  page,
  /filter\(\(_,[\s\S]*?index\) => index % 3 === 0\)/,
  'mobile song rail alignment must use three-song group boundaries',
);
assert.match(
  page,
  /onPointerDown=\{clearMobileAlignTimer228\}[\s\S]*?onPointerUp=\{scheduleMobileSongRailAlign228\}[\s\S]*?onScroll=\{\(\) => \{[\s\S]*?scheduleMobileSongRailAlign228\(\)/,
  'touch interaction and native momentum scrolls must debounce the delayed alignment',
);
assert.match(
  page,
  /scroller\.scrollTo\(\{ left: target, behavior: 'smooth' \}\)/,
  'delayed mobile alignment must settle smoothly onto the nearest three-song group',
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
assert.match(page, /EXPLORE_EQ_BUTTON_BAR_COUNT_225\s*=\s*5/);
assert.match(page, /activeExplorePreviewTrackId224/);
assert.match(page, /showExploreLinkVisual224/);
assert.match(page, /setActiveExplorePreviewTrackId224\(track\.id\)/);
assert.match(page, /window\.setTimeout\([\s\S]*?EXPLORE_PREVIEW_MAX_MS_222/);
assert.match(page, /isPreviewing=\{activeExplorePreviewTrackId224 === track\.id\}/);
assert.match(page, /onTogglePreview=\{showExploreLinkVisual224\}/);
assert.match(page, /soridraw-explore-preview-trigger/);
assert.match(page, /soridraw-explore-preview-button-eq/);
assert.match(page, /<Play aria-hidden="true" \/>/);

const cardStart = page.indexOf('function ExploreTrackCard');
const pageStart = page.indexOf('export default function ExplorePage', cardStart);
assert.ok(cardStart >= 0 && pageStart > cardStart, 'Explore card must remain discoverable');
const card = page.slice(cardStart, pageStart);
assert.match(card, /const openSuno = \(\) => \{[\s\S]*?window\.open\(openUrl, '_blank', 'noopener,noreferrer'\)/);
assert.match(
  card,
  /<div className="soridraw-explore-cover-button">[\s\S]*?<span className="soridraw-explore-cover-shell">/,
  'cover artwork must remain a non-interactive visual surface',
);
assert.doesNotMatch(
  card,
  /className="soridraw-explore-cover-button"[\s\S]{0,220}?onClick=/,
  'cover artwork itself must not open Suno',
);
assert.match(
  card,
  /className="soridraw-explore-preview-trigger"[\s\S]*?openSuno\(\);[\s\S]*?onTogglePreview\(track\);/,
  'only the center play control must open the Suno link and then paint local visual feedback',
);
assert.match(
  card,
  /className="soridraw-explore-preview-trigger"[\s\S]*?disabled=\{!openUrl\}/,
  'play-link control must be disabled when no external Suno URL exists',
);
assert.match(
  card,
  /isPreviewing \? \([\s\S]*?soridraw-explore-preview-button-eq[\s\S]*?EXPLORE_EQ_BUTTON_BAR_COUNT_225[\s\S]*?\) : \([\s\S]*?<Play aria-hidden="true" \/>/,
  'active feedback must replace the play glyph with a button-local equalizer instead of a pause icon',
);
assert.doesNotMatch(card, /<Pause|lucide-pause|soridraw-explore-preview-eq|soridraw-explore-cover-open/,
  'card must not expose pause semantics, full-cover equalizer, or a separate background-link affordance');
assert.doesNotMatch(page, /useGlobalPlayerControls\(\)|playGlobalTrack|toggleGlobalPlayPause|resolveExplorePreviewAudioUrl222|__exploreCardPreview/,
  'Explore link button must not invoke the in-app audio engine or resolve third-party media');
assert.doesNotMatch(
  page.slice(page.indexOf('const showExploreLinkVisual224 ='), page.indexOf('useEffect(() => onAuthStateChanged')),
  /fetch\(|getDocs\(|onSnapshot\(|setDoc\(|updateDoc\(|EXPLORE_API_BASE/,
  'Explore visual feedback must not add feed/D1/Firestore requests',
);

assert.match(
  css,
  /\.soridraw-explore-cover-button\{[\s\S]*?cursor:default;pointer-events:none/,
  'cover background must be non-interactive',
);
assert.doesNotMatch(
  css,
  /\.soridraw-explore-cover-button:hover \.soridraw-explore-cover-shell>img/,
  'non-interactive cover must not retain click-like hover zoom',
);
assert.match(
  css,
  /\.soridraw-explore-preview-trigger\{[\s\S]*?width:clamp\(56px,30%,76px\)/,
  'play-link control must be larger than app224',
);
assert.match(
  css,
  /\.soridraw-explore-cover-wrap:hover \.soridraw-explore-preview-trigger[\s\S]*?opacity:1/,
  'hovering a cover must reveal the play-link control',
);
assert.match(
  css,
  /\.soridraw-explore-preview-button-eq\{[\s\S]*?width:48%;height:48%/,
  'equalizer feedback must be confined inside the play control',
);
assert.match(
  css,
  /\.soridraw-explore-preview-button-eq i\{[\s\S]*?animation:soridraw-explore-preview-bar-222 calc\(\.92s \+ \(var\(--eq-index\) \* \.05s\)\)/,
  'button equalizer must keep compositor-friendly animation at the slower app226 pace',
);
assert.match(
  css,
  /\.soridraw-explore-card\.is-previewing \.soridraw-explore-card-copy h3\{color:#ffbf24/,
  'active play-link feedback must restore the title accent without restoring full-cover animation',
);
assert.doesNotMatch(css, /\.soridraw-explore-preview-eq\{|\.soridraw-explore-preview-eq-bars/,
  'full-cover equalizer must stay removed',
);
assert.match(
  css,
  /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?\.soridraw-explore-recommend-scroll\{scroll-snap-type:none;scroll-behavior:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y\}/,
  'coarse-pointer/mobile rails must use native free momentum instead of card snapping',
);
assert.match(
  css,
  /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?\.soridraw-explore-recommend-track>\.soridraw-explore-card,\.soridraw-explore-recommend-creator-card\{scroll-snap-align:none\}/,
  'mobile track items must not force two-card snap stops',
);

console.log('APP221_EXPLORE_EXISTING_LAYOUT_PRESERVED=PASS');
console.log('APP224_EXPLORE_VISUAL_ONLY_NO_AUDIO_ENGINE=PASS');
console.log('APP225_EXPLORE_COVER_BACKGROUND_NONINTERACTIVE=PASS');
console.log('APP225_EXPLORE_PLAY_BUTTON_ONLY_LINK=PASS');
console.log('APP225_EXPLORE_PLAY_BUTTON_LARGER=PASS');
console.log('APP225_EXPLORE_BUTTON_ONLY_EQUALIZER=PASS');
console.log('APP225_EXPLORE_NO_PAUSE_SEMANTICS=PASS');
console.log('APP225_EXPLORE_TWO_MINUTE_VISUAL_TIMEOUT=PASS');
console.log('APP225_EXPLORE_LINK_VISUAL_NO_FEED_SERVER_READ_WRITE=PASS');
console.log('APP226_EXPLORE_ACTIVE_TITLE_ACCENT_RESTORED=PASS');
console.log('APP226_EXPLORE_BUTTON_EQUALIZER_SLOWER=PASS');
console.log('APP226_EXPLORE_MOBILE_NATIVE_MOMENTUM_SCROLL=PASS');
console.log('APP226_EXPLORE_MOBILE_SCROLL_SNAP_DISABLED=PASS');
console.log('APP227_EXPLORE_MOBILE_RECOMMENDED_THREE_SONGS=PASS');
console.log('APP227_EXPLORE_MOBILE_LATEST_THREE_COLUMNS=PASS');
console.log('APP227_EXPLORE_MOBILE_POPULAR_THREE_COLUMNS=PASS');
console.log('APP227_EXPLORE_PROFILE_GRID_DENSITY_PROTECTED=PASS');
console.log('APP228_EXPLORE_MOBILE_TITLE_CREATOR_FONT_REDUCED=PASS');
console.log('APP228_EXPLORE_MOBILE_THREE_SECOND_GROUP_ALIGNMENT=PASS');
console.log('APP228_EXPLORE_MOBILE_NATIVE_MOMENTUM_BEFORE_ALIGNMENT=PASS');

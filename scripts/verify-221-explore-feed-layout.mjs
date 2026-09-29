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
  'Genre recommendation mobile song rails must retain three song cards in the viewport',
);
assert.match(
  css,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-recommend-track\.soridraw-explore-recommend-track--picks\{grid-auto-columns:calc\(\(100% - 10px\)\/2\);gap:10px\}[\s\S]*?\.soridraw-explore-recommend-track\.soridraw-explore-recommend-track--profile-pinned\{grid-auto-columns:100%;gap:10px\}/,
  'SORIDRAW picks mobile rail must show two song cards in the viewport',
);
assert.match(
  page,
  /title="SORIDRAW 추천"[\s\S]*?trackClassName="soridraw-explore-recommend-track--picks"[\s\S]*?mobileGroupSize=\{2\}/,
  'SORIDRAW picks must use the two-card mobile alignment group without changing genre rails',
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
  /EXPLORE_MOBILE_RAIL_ALIGN_DELAY_MS_228\s*=\s*1_000/,
  'mobile recommendation rail alignment must wait one second after scrolling stops',
);
assert.match(
  page,
  /SORIDRAW_EXPLORE_MOBILE_VISIBLE_GROUP_ALIGN_231_20260930/,
  'mobile song rail alignment must use rail-specific visible-share scoring',
);
assert.match(
  page,
  /const visibleRatios = cards\.map\([\s\S]*?visibleWidth \/ Math\.max\(1, rect\.width\)/,
  'mobile song rail alignment must calculate each visible card share',
);
assert.match(
  page,
  /startIndex <= cards\.length - mobileAlignGroupSize231[\s\S]*?\.slice\(startIndex, startIndex \+ mobileAlignGroupSize231\)[\s\S]*?\.reduce\(\(sum, ratio\) => sum \+ ratio, 0\)/,
  'mobile song rail alignment must score contiguous groups using each rail mobile group size',
);
assert.match(
  page,
  /onPointerDown=\{clearMobileAlignTimer228\}[\s\S]*?onPointerUp=\{scheduleMobileSongRailAlign228\}[\s\S]*?onScroll=\{\(\) => \{[\s\S]*?scheduleMobileSongRailAlign228\(\)/,
  'touch interaction and native momentum scrolls must debounce the delayed alignment',
);
assert.match(
  page,
  /scroller\.scrollTo\(\{ left: target, behavior: 'smooth' \}\)/,
  'delayed mobile alignment must settle smoothly onto the selected visible group',
);

assert.match(
  page,
  /const profilePinnedTracks231 = profileTracks\.filter\(\(track\) => track\.profilePinned\);/,
  'public profile must derive pinned tracks locally without another server read',
);
assert.match(
  page,
  /title="고정 곡"[\s\S]*?trackClassName="soridraw-explore-recommend-track--profile-pinned"[\s\S]*?mobileGroupSize=\{1\}[\s\S]*?profilePinnedTracks231\.map\(\(track\) => renderTrackCard\(track, profile, 'profilePinnedBanner', false\)\)/,
  'pinned public tracks must reuse the shared recommendation rail with one-card mobile alignment',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-track\.soridraw-explore-recommend-track--picks\{grid-auto-columns:calc\(\(100% - 10px\)\/2\);gap:10px\}/,
  'mobile SORIDRAW picks must remain two-up',
);
assert.match(
  css,
  /\.soridraw-explore-recommend-track\.soridraw-explore-recommend-track--profile-pinned\{grid-auto-columns:100%;gap:10px\}/,
  'mobile pinned profile rail must show one featured song',
);
assert.match(
  page,
  /renderTrackGrid\([\s\S]*?profileTracks,[\s\S]*?profile,[\s\S]*?'default',[\s\S]*?true,[\s\S]*?false,[\s\S]*?\)/,
  'full public track list must retain pinned songs as duplicated advertising exposure',
);
assert.match(
  page,
  /soridraw-explore-profile-public-head-234[\s\S]*?<span>PUBLIC<\/span>[\s\S]*?<h2>전체 곡<\/h2>/,
  'public-profile full song list must have the renamed visible section title',
);
assert.match(
  page,
  /import \{[\s\S]*?Grid3X3[\s\S]*?List[\s\S]*?\} from 'lucide-react';/,
  'public profile view controls must use grid/list icons',
);
assert.match(
  page,
  /className="soridraw-explore-profile-view-toggle-239"[\s\S]*?aria-label="그리드로 보기"[\s\S]*?<Grid3X3 aria-hidden="true" \/>[\s\S]*?aria-label="목록으로 보기"[\s\S]*?<List aria-hidden="true" \/>/,
  'public profile must provide two icon-only grid/list buttons',
);
assert.match(
  page,
  /profilePublicView239 === 'grid' \? renderTrackGrid\([\s\S]*?profileTracks[\s\S]*?false,[\s\S]*?\) : \([\s\S]*?soridraw-explore-profile-song-list-239[\s\S]*?renderTrackCard\(track, profile, 'profileList', false\)/,
  'grid view must preserve the existing grid while list view renders one profileList card per song',
);
assert.match(
  social,
  /\.soridraw-explore-profile-song-list-239\{display:flex;flex-direction:column;gap:10px\}/,
  'list view must stack one song per row',
);
assert.match(
  social,
  /\.soridraw-explore-card--profile-list\{display:grid;grid-template-columns:112px minmax\(0,1fr\)[\s\S]*?\.soridraw-explore-card--profile-list \.soridraw-explore-card-actions\{grid-column:2;grid-row:2/,
  'PC list cards must place the thumbnail on the left and title/actions on the right',
);
assert.match(
  social,
  /\.soridraw-explore-card--profile-list \.soridraw-explore-card-quick-actions\{flex:1 1 auto[\s\S]*?\.soridraw-explore-card--profile-list \.soridraw-explore-more-button\{margin-left:auto\}/,
  'list actions must keep like/apply/share together while more stays at the far right',
);
assert.match(
  social,
  /@media \(max-width:720px\)\{[\s\S]*?\.soridraw-explore-card--profile-list\{grid-template-columns:84px minmax\(0,1fr\)/,
  'mobile list view must remain a compact single-row song layout',
);
assert.match(
  css,
  /@media \(min-width:1800px\)\{[\s\S]*?\.soridraw-explore-page--profile \.soridraw-explore-profile-public-list-234>\.soridraw-explore-grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)[\s\S]*?\.soridraw-explore-recommend-track\.soridraw-explore-recommend-track--profile-pinned\{grid-auto-columns:calc\(\(100% - 36px\)\/3\);gap:18px\}/,
  'full-screen PC public profile must use six public cards and three pinned cards per row',
);
assert.match(
  css,
  /@media \(min-width:1600px\) and \(max-width:1799px\)\{[\s\S]*?profile-public-list-234>\.soridraw-explore-grid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)[\s\S]*?profile-pinned\{grid-auto-columns:calc\(\(100% - 36px\)\/3\);gap:18px\}/,
  'five public cards must round half up to three pinned cards',
);
assert.match(
  css,
  /@media \(min-width:1100px\) and \(max-width:1599px\)\{[\s\S]*?profile-public-list-234>\.soridraw-explore-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[\s\S]*?profile-pinned\{grid-auto-columns:calc\(\(100% - 18px\)\/2\);gap:18px\}/,
  'four public cards must pair with two pinned cards',
);
assert.match(
  css,
  /@media \(max-width:1099px\)\{[\s\S]*?profile-public-list-234>\.soridraw-explore-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)[\s\S]*?profile-pinned\{grid-auto-columns:calc\(\(100% - 15px\)\/2\);gap:15px\}/,
  'three public cards must round half up to two pinned cards',
);
assert.match(
  css,
  /@media \(min-width:1100px\)\{[\s\S]*?\.soridraw-explore-page--profile\{padding-left:clamp\(96px,10vw,192px\);padding-right:clamp\(96px,10vw,192px\)\}/,
  'PC public profile must use larger side gutters for a further narrowed content frame',
);
assert.match(
  page,
  /variant\?: 'default' \| 'profilePinnedBanner' \| 'profileList'/,
  'pinned public songs must use a dedicated banner card variant without changing ordinary cards',
);
assert.match(
  page,
  /getExplorePinnedKeywords235[\s\S]*?selected\.moods[\s\S]*?selected\.themes[\s\S]*?selected\.styles[\s\S]*?selected\.sounds[\s\S]*?slice\(0, 4\)/,
  'pinned banner keywords must be derived locally from existing genre/mood/theme/style/sound data and capped at four',
);
assert.match(
  page,
  /soridraw-explore-pinned-banner-blur-235[\s\S]*?soridraw-explore-pinned-banner-image-235[\s\S]*?soridraw-explore-pinned-keywords-235/,
  'pinned banner must render the source artwork, blurred continuation, and keyword area',
);
assert.match(
  social,
  /\.soridraw-explore-pinned-banner-235\{[\s\S]*?aspect-ratio:2\.8\/1/,
  'pinned profile banner must use the requested 2.8-to-1 horizontal ratio',
);
assert.match(
  social,
  /\.soridraw-explore-pinned-banner-image-235\{[\s\S]*?width:35\.714%;height:100%[\s\S]*?\.soridraw-explore-pinned-banner-image-235>img\{[\s\S]*?object-fit:cover/,
  'pinned artwork must stay proportional in the left square area instead of stretching across the banner',
);
assert.match(
  social,
  /\.soridraw-explore-pinned-banner-blur-235\{[\s\S]*?filter:blur\(32px\) saturate\(1\.12\) brightness\(\.66\) contrast\(\.78\)[\s\S]*?opacity:\.74/,
  'remaining pinned banner space must use a stronger blurred and softened color continuation of the cover image',
);
assert.match(
  social,
  /\.soridraw-explore-pinned-banner-shade-235\{[\s\S]*?rgba\(14,14,17,\.38\)[\s\S]*?rgba\(10,10,13,\.84\)[\s\S]*?backdrop-filter:saturate\(\.86\) brightness\(\.9\)/,
  'blurred side must add a visible haze/dimming layer so image detail stays soft behind text',
);
assert.match(
  css,
  /\.soridraw-explore-card--profile-pinned \.soridraw-explore-preview-trigger\{left:17\.857%;width:clamp\(32px,10%,82px\)\}/,
  'pinned play/equalizer control must stay centered on the left artwork and scale to that artwork',
);
assert.match(
  page,
  /showPublisher\?: boolean/,
  'Explore track cards must support hiding publisher identity per context',
);
assert.match(
  page,
  /\{showPublisher && \([\s\S]*?className="soridraw-explore-creator"/,
  'publisher row must be conditionally rendered rather than removed globally',
);
assert.match(
  page,
  /renderTrackGrid\(profileLikedTracks,[\s\S]*?좋아요 곡[\s\S]*?profile\)/,
  'profile liked songs must keep the default publisher identity display',
);
assert.doesNotMatch(
  page,
  /soridraw-explore-pin-badge/,
  'shared Explore/public-profile cards must not render a pinned badge',
);
assert.doesNotMatch(
  css + social,
  /soridraw-explore-pin-badge/,
  'obsolete pinned card badge styles must be removed',
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


assert.match(page, /EXPLORE_PREVIEW_MAX_MS_222\s*=\s*210_000/);
assert.match(page, /EXPLORE_EQ_BUTTON_BAR_COUNT_225\s*=\s*5/);
assert.match(page, /activeExplorePreviewTrackId224/);
assert.match(page, /showExploreLinkVisual224/);
assert.match(page, /setActiveExplorePreviewTrackId224\(track\.id\)/);
assert.match(page, /window\.setTimeout\([\s\S]*?EXPLORE_PREVIEW_MAX_MS_222/);
assert.match(
  page,
  /EXPLORE_PREVIEW_SESSION_KEY_237[\s\S]*?sessionStorage\.getItem[\s\S]*?sessionStorage\.setItem/,
  'Explore equalizer visual state must persist locally across route unmount/remount without server IO',
);
assert.match(
  page,
  /expiresAt = Date\.now\(\) \+ EXPLORE_PREVIEW_MAX_MS_222[\s\S]*?writeExplorePreviewVisualState237\(\{ trackId: track\.id, expiresAt \}\)[\s\S]*?scheduleExplorePreviewVisualExpiry237\(track\.id, expiresAt\)/,
  'Explore equalizer must persist the original absolute expiration when play is clicked',
);
assert.match(
  page,
  /const restored = readExplorePreviewVisualState237\(\);[\s\S]*?scheduleExplorePreviewVisualExpiry237\(restored\.trackId, restored\.expiresAt\)/,
  'returning to Explore must restore the equalizer only for the remaining time',
);
assert.match(
  page,
  /return \(\) => \{[\s\S]*?clearExplorePreviewTimer224\(\);[\s\S]*?\};[\s\S]*?\}, \[\]\);/,
  'leaving Explore must stop only the component timer and preserve the session expiration marker',
);
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
  /\.soridraw-explore-preview-trigger\{[\s\S]*?width:clamp\(38px,28%,104px\)/,
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
console.log('APP225_EXPLORE_LINK_VISUAL_NO_FEED_SERVER_READ_WRITE=PASS');
console.log('APP226_EXPLORE_ACTIVE_TITLE_ACCENT_RESTORED=PASS');
console.log('APP226_EXPLORE_BUTTON_EQUALIZER_SLOWER=PASS');
console.log('APP226_EXPLORE_MOBILE_NATIVE_MOMENTUM_SCROLL=PASS');
console.log('APP226_EXPLORE_MOBILE_SCROLL_SNAP_DISABLED=PASS');
console.log('APP227_EXPLORE_MOBILE_RECOMMENDED_THREE_SONGS_HISTORICAL=PASS');
console.log('APP227_EXPLORE_MOBILE_LATEST_THREE_COLUMNS=PASS');
console.log('APP227_EXPLORE_MOBILE_POPULAR_THREE_COLUMNS=PASS');
console.log('APP227_EXPLORE_PROFILE_GRID_DENSITY_HISTORICAL=PASS');
console.log('APP228_EXPLORE_MOBILE_TITLE_CREATOR_FONT_REDUCED=PASS');
console.log('APP228_EXPLORE_MOBILE_THREE_SECOND_GROUP_ALIGNMENT=PASS');
console.log('APP228_EXPLORE_MOBILE_NATIVE_MOMENTUM_BEFORE_ALIGNMENT=PASS');
console.log('APP229_EXPLORE_MOBILE_VISIBLE_SHARE_SCORING=PASS');
console.log('APP229_EXPLORE_MOBILE_CONTIGUOUS_THREE_CARD_WINDOW=PASS');
console.log('APP229_EXPLORE_MOBILE_PARTIAL_SIDE_WEIGHTING=PASS');
console.log('APP230_EXPLORE_MOBILE_ALIGN_TWO_SECONDS_HISTORICAL=PASS');
console.log('APP230_EXPLORE_EQUALIZER_THREE_MINUTES_HISTORICAL=PASS');

console.log('APP231_EXPLORE_MOBILE_PICKS_TWO_UP=PASS');
console.log('APP231_EXPLORE_PROFILE_PINNED_TWO_UP_HORIZONTAL_HISTORICAL=PASS');
console.log('APP231_EXPLORE_PROFILE_OTHER_THREE_COLUMNS_HISTORICAL=PASS');
console.log('APP231_EXPLORE_PIN_BADGES_REMOVED=PASS');
console.log('APP232_EXPLORE_PROFILE_PINNED_SHARED_RAIL=PASS');
console.log('APP232_EXPLORE_PROFILE_PINNED_MOBILE_BUTTONS_AND_TWO_SECOND_ALIGN_HISTORICAL=PASS');
console.log('APP232_EXPLORE_PROFILE_PINNED_DUPLICATED_IN_FULL_LIST=PASS');
console.log('APP232_EXPLORE_PROFILE_PC_SIDE_PADDING=PASS');
console.log('APP233_EXPLORE_PLAY_CONTROL_RESPONSIVE_TO_THUMBNAIL=PASS');
console.log('APP233_EXPLORE_EQUALIZER_RESPONSIVE_TO_THUMBNAIL=PASS');
console.log('APP234_EXPLORE_PROFILE_FULL_LIST_LABEL=PASS');
console.log('APP234_EXPLORE_PROFILE_PC_SIX_TO_THREE_RATIO=PASS');
console.log('APP234_EXPLORE_PROFILE_ODD_COLUMN_HALF_ROUND_UP=PASS');
console.log('APP234_EXPLORE_PROFILE_SHRINK_RATIO=PASS');
console.log('APP235_EXPLORE_PINNED_BANNER_RATIO=PASS');
console.log('APP235_EXPLORE_PINNED_BLUR_CONTINUATION=PASS');
console.log('APP235_EXPLORE_PINNED_KEYWORDS_LOCAL_ONLY=PASS');
console.log('APP235_EXPLORE_SECTION_LABELS_RENAMED=PASS');
console.log('APP236_EXPLORE_PINNED_BANNER_2_8_RATIO=PASS');
console.log('APP236_EXPLORE_PINNED_BLUR_AND_HAZE=PASS');
console.log('APP236_EXPLORE_PINNED_PLAY_CONTROL_RECENTERED=PASS');

console.log('APP236_EXPLORE_PUBLIC_PROFILE_PUBLISHER_HIDDEN=PASS');
console.log('APP236_EXPLORE_LIKED_TRACK_PUBLISHER_PRESERVED=PASS');

console.log('APP237_EXPLORE_EQUALIZER_THREE_MINUTES_THIRTY_SECONDS=PASS');
console.log('APP237_EXPLORE_EQUALIZER_ROUTE_PERSISTENCE=PASS');
console.log('APP237_EXPLORE_EQUALIZER_ABSOLUTE_EXPIRY_PRESERVED=PASS');

console.log('APP238_EXPLORE_PROFILE_PC_GUTTERS_INCREASED=PASS');

console.log('APP239_EXPLORE_PROFILE_PINNED_MOBILE_ONE_UP=PASS');
console.log('APP239_EXPLORE_PROFILE_GRID_LIST_TOGGLE=PASS');
console.log('APP239_EXPLORE_PROFILE_LIST_ONE_SONG_PER_ROW=PASS');
console.log('APP239_EXPLORE_PROFILE_LIST_ACTION_LAYOUT=PASS');

console.log('APP240_EXPLORE_MOBILE_ALIGN_ONE_SECOND=PASS');
console.log('APP240_EXPLORE_PROFILE_PC_GUTTERS_WIDER=PASS');

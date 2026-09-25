import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const css = readFileSync('src/components/explore/exploreSocial.css', 'utf8');
const modal = readFileSync('src/components/explore/ExplorePublicationSettingsModal.tsx', 'utf8');

assert.match(page, /<RefreshCw aria-hidden="true" \/>/, 'next-song actions must use the Studio-style refresh arrows');
assert.doesNotMatch(page, /WandSparkles|<Forward\b/, 'old quick action icons must be removed');
assert.match(page, /<Reply className="soridraw-explore-share-icon" aria-hidden="true" \/>/, 'share must use the curved reply/share glyph');
assert.match(css, /\.soridraw-explore-share-icon\{[^}]*scaleX\(-1\)/s, 'share glyph must face outward like the reference');
assert.match(css, /\.soridraw-explore-quick-action\{[^}]*background:rgba\(255,255,255,\.07\)!important/s, 'quick action circles must share one neutral button background');
assert.match(css, /\.soridraw-explore-quick-apply\.is-available\{[^}]*background:rgba\(255,255,255,\.07\)!important;[^}]*color:#ff7a9d/s, 'available next-song action must keep the neutral circle and emphasize only the pink icon');
assert.match(css, /\.soridraw-explore-more-rows button\.is-available\{[^}]*background:transparent!important/s, 'large next-song row must not receive a colored button background');
assert.match(css, /\.soridraw-explore-more-rows button\.is-available strong\{color:#ff7a9d\}/, 'large next-song row must emphasize its text in pink');

assert.match(page, /<strong>공개 설정<\/strong>/, 'Explore more sheet must include publication settings');
assert.match(page, /disabled=\{actionBusy \|\| !user \|\| user\.uid !== moreTrack\.ownerUid\}/, 'publication settings must be disabled for non-owner tracks');
assert.match(page, /const openExplorePublicationSettings = \(track: ExploreTrack\) => \{\s*if \(!user \|\| user\.uid !== track\.ownerUid\) return;/s, 'publication settings open path must be owner-only');
assert.match(page, /setExploreTrackPublicationOptions\(user, publicationSettings\.track\.id, publicationSettings\.options\)/, 'publication option save must reuse the existing local-first publication service');
assert.match(page, /setExploreTrackVisibility\(user, track\.id, false, publicationSettings\.options\)/, 'private conversion must reuse the existing publication visibility service');
assert.doesNotMatch(page, /getExploreMusicNotePublicationState/, 'opening publication settings from an already-rendered own Explore track must not add a server read');

for (const label of ['다음곡에 적용 허용', '팔로워 곡 저장 허용', '공개 프로필에 고정']) {
  assert.ok(modal.includes(label), `publication modal must preserve ${label}`);
}
assert.ok(modal.includes('저장'), 'public Explore track settings must save in the same modal');
assert.match(modal, /비공개로 전환/, 'public Explore track settings must retain the private conversion control');
assert.match(modal, /bg-\[#FF7A72\]/, 'publication modal must preserve the existing coral/pink control family');

console.log('APP203_EXPLORE_STUDIO_APPLY_ICON=PASS');
console.log('APP203_EXPLORE_NEUTRAL_CIRCLE_ACTIONS=PASS');
console.log('APP203_EXPLORE_PINK_TEXT_ONLY_GUIDE=PASS');
console.log('APP203_EXPLORE_OWNER_PUBLICATION_SETTINGS=PASS');
console.log('APP203_EXPLORE_PUBLICATION_OPEN_R0=PASS');

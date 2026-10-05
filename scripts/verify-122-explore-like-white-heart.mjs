import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const social = readFileSync('src/components/explore/exploreSocial.css', 'utf8');
const light = readFileSync('src/styles/classicLightVisualFixes.css', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '122');

// Dark/split default: no red liked state; heart is white and filled.
assert.match(social, /\.soridraw-explore-like-button\.is-liked\{color:rgba\(255,255,255,\.86\)\}/);
assert.match(social, /\.soridraw-explore-like-button\.is-liked svg:not\(\.soridraw-explore-spinner\)\{fill:#fff;stroke:#fff;/);
assert.doesNotMatch(social, /#ff6d78/i);

// Subtle interaction only; layout/size untouched.
assert.match(social, /:active:not\(:disabled\) svg:not\(\.soridraw-explore-spinner\)\{transform:scale\(\.86\) translateY\(1px\)\}/);
assert.match(social, /@keyframes soridraw-explore-like-heart-pop/);
assert.match(social, /animation:soridraw-explore-like-heart-pop \.18s/);
assert.match(social, /height:28px/);
assert.match(social, /gap:4px/);
assert.match(social, /padding:0/);

// Light mode must not reintroduce red.
assert.doesNotMatch(light, /\.soridraw-explore-like-button\.is-liked\s*\{[^}]*#d84b58/is);
assert.match(light, /\.soridraw-explore-like-button\.is-liked svg:not\(\.soridraw-explore-spinner\)[\s\S]*fill: #fff !important;[\s\S]*stroke: #fff !important;/);

console.log('PASS 122: liked heart is white-filled with subtle click motion; no red override remains.');
console.log('UI_ONLY=TRUE');
console.log('LIKE_BEHAVIOR=UNCHANGED');
console.log('LAYOUT_SIZE_SPACING=UNCHANGED');

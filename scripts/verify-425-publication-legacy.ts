import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeExplorePublicTitle425 } from '../src/lib/explorePublicTitle';
import { resolveMusicNoteNextSongRecipe425 } from '../src/services/musicNoteNextSongRecipe';

assert.equal(
  normalizeExplorePublicTitle425("[Nu Metal] '무거운 발걸음' | 'Heavy Footsteps'"),
  '[Nu Metal] 무거운 발걸음 | Heavy Footsteps',
);
assert.equal(
  normalizeExplorePublicTitle425("[Pop] 'Don't Go' | “가지 마”"),
  "[Pop] Don't Go | 가지 마",
);
assert.equal(
  normalizeExplorePublicTitle425("[Indie] O'Clock | It's Fine"),
  "[Indie] O'Clock | It's Fine",
);

const recent = resolveMusicNoteNextSongRecipe425({
  appliedKeywords: {
    genre: ['pop'],
    mood: ['warm'],
    userInput: 'modern command',
    tempo: '100 BPM',
  },
  requestPayload: {
    appliedKeywords: { mood: ['sad'], userInput: 'stale command', vocalTone: 'soft' },
  },
});
assert.deepEqual(recent.genre, ['pop']);
assert.deepEqual(recent.mood, ['warm']);
assert.equal(recent.userInput, 'modern command');
assert.equal(recent.vocalTone, 'soft');

const requestApplied = resolveMusicNoteNextSongRecipe425({
  requestPayload: {
    appliedKeywords: {
      subGenre: ['dream-pop'],
      style: ['minimal'],
      userInput: 'legacy stored command',
      languageMixRatio: 30,
    },
  },
});
assert.deepEqual(requestApplied.subGenre, ['dream-pop']);
assert.deepEqual(requestApplied.style, ['minimal']);
assert.equal(requestApplied.userInput, 'legacy stored command');
assert.equal(requestApplied.languageMixRatio, 30);

const directPayload = resolveMusicNoteNextSongRecipe425({
  requestPayload: {
    genre: ['dance'],
    theme: ['love'],
    commandInput: 'direct legacy command',
    maleCount: 1,
  },
});
assert.deepEqual(directPayload.genre, ['dance']);
assert.deepEqual(directPayload.theme, ['love']);
assert.equal(directPayload.userInput, 'direct legacy command');
assert.equal(directPayload.maleCount, 1);

const explicitEmptyModern = resolveMusicNoteNextSongRecipe425({
  appliedKeywords: { genre: ['pop'], userInput: '' },
  requestPayload: { appliedKeywords: { userInput: 'must not revive' } },
});
assert.equal(explicitEmptyModern.userInput, '');

const absent = resolveMusicNoteNextSongRecipe425({
  appliedKeywords: { genre: ['rock'] },
  prompt: 'generated music prompt that is not the original command',
  style: 'generated style',
});
assert.equal(Object.prototype.hasOwnProperty.call(absent, 'userInput'), false);
assert.equal(JSON.stringify(absent).includes('generated music prompt'), false);

const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const modal = readFileSync('src/components/explore/ExplorePublicationSettingsModal.tsx', 'utf8');
const explore = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const workerPatch = readFileSync('cloudflare/explore-worker/patches/100-publication-legacy-next-song-recipe.mjs', 'utf8');

assert.match(publication, /pending\/retry intent is not confirmed publication state/);
assert.match(publication, /next\[pending\.sourceId\] = \{ \.\.\.pending\.baseState \}/);
assert.doesNotMatch(
  publication.slice(publication.indexOf('const queuePublicationMutation'), publication.indexOf('export const getPendingExplorePublicationMutationCount')),
  /patchPublicationStateBySourceId\(uid, sourceId, desiredState\)/,
);
assert.match(publication, /states\[pending\.sourceId\] = \{ \.\.\.pending\.baseState \}/);
assert.match(publication, /states\[pending\.sourceId\] = \{ \.\.\.confirmed \}/);

const flushStart = favorites.indexOf('const flushFavoriteDetailPendingPatch');
const flushEnd = favorites.indexOf('const queueFavoriteDetailPatch', flushStart);
assert.ok(flushStart >= 0 && flushEnd > flushStart, 'detail flush range missing');
const flush = favorites.slice(flushStart, flushEnd);
assert.ok(
  flush.indexOf('await updateFavorite(pending.songId, pending.updates)') <
  flush.indexOf('await refreshExploreMusicNotePublicationContent425'),
  'public projection must run only after canonical Music Note save',
);
assert.match(flush, /catch \(publicationError\)/, 'derived publication failure must be isolated');
assert.doesNotMatch(flush, /setInterval|setTimeout\([^)]*refreshExploreMusicNotePublicationContent425/);

assert.match(modal, /normalizeExplorePublicTitle425\(title/);
assert.match(modal, /normalizeExplorePublicTitle425\(choice\.title/);
assert.match(explore, /title: normalizeExplorePublicTitle425\(row\.title/);

for (const required of [
  'requestPayload?.appliedKeywords',
  "'userInput', 'commandInput', 'directInput', 'customPrompt'",
  'SORIDRAW_PUBLIC_LEGACY_NEXT_SONG_425_20261018',
]) assert.ok(workerPatch.includes(required), 'worker legacy contract missing: ' + required);
assert.equal(workerPatch.includes('note?.prompt'), false);
assert.equal(workerPatch.includes('note?.style'), false);

const normalizerSource = readFileSync('src/services/musicNoteNextSongRecipe.ts', 'utf8');
const actionSource = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
assert.equal(/firebase|firestore|getDoc|getDocs|fetch\(/.test(normalizerSource), false, 'legacy normalizer must remain pure/read-time only');
const ownRecoveryStart = actionSource.indexOf('export const getExploreOwnMusicNoteApplyKeywords');
const ownRecoveryEnd = actionSource.indexOf('const buildAuthHeaders', ownRecoveryStart);
const ownRecovery = actionSource.slice(ownRecoveryStart, ownRecoveryEnd);
assert.match(ownRecovery, /getDoc\(doc\(db, 'favorites', normalizedSourceId\)\)/, 'own recovery must stay one exact Music Note read');
assert.doesNotMatch(ownRecovery, /getDocs\(|collection\(|collectionGroup\(/, 'own recovery must never scan favorites');
assert.equal(publication.includes('setInterval('), false, 'publication service must not add polling');

console.log('APP425_PUBLIC_TITLE_NORMALIZATION=PASS');
console.log('APP425_PUBLICATION_CONFIRMED_PENDING_SEPARATION=PASS');
console.log('APP425_PUBLIC_METADATA_AFTER_CANONICAL_SAVE=PASS');
console.log('APP425_LEGACY_NEXT_SONG_NORMALIZER=PASS');
console.log('APP425_NO_PROMPT_AS_HISTORICAL_COMMAND=PASS');

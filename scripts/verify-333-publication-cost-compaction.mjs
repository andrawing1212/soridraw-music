import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const service = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');

const submitStart = favorites.indexOf('const submitFavoriteExplorePublicationDialog = async () => {');
const submitEnd = favorites.indexOf('const makeFavoriteExplorePublicationPrivate = async () => {', submitStart);
assert.ok(submitStart >= 0 && submitEnd > submitStart, 'publication submit handler missing');
const submit = favorites.slice(submitStart, submitEnd);

assert.doesNotMatch(
  submit,
  /updateFavorite\(sourceId,\s*primaryUpdates\)/,
  'source selection must not force an immediate Firestore favorites write',
);
assert.match(
  submit,
  /queueFavoriteDetailPatch\(sourceId, primaryUpdates\)/,
  'source selection must use the existing Music Note 60s\/page-exit batch',
);
assert.match(
  submit,
  /publishFavoriteSunoMediaDraft\(sourceId, primaryUpdates\)/,
  'source selection must retain bounded cross-device preview publication',
);
assert.match(
  submit,
  /refreshExploreMusicNotePublicationSource\([\s\S]*selectedPublicationMedia[\s\S]*\)/,
  'Explore source refresh must carry the selected media in the same mutation',
);

assert.match(
  service,
  /export type ExplorePublicationSourceMedia = \{/,
  'publication source media type missing',
);
assert.match(
  service,
  /refreshExploreMusicNotePublicationSource = async \([\s\S]*sourceMedia\?: ExplorePublicationSourceMedia \| null/,
  'publication source refresh signature missing inline media',
);
assert.match(
  service,
  /refreshSourceMedia: true,[\s\S]*sourceMedia: \{/,
  'publication source refresh request does not include inline media',
);

assert.match(worker, /SORIDRAW_PUBLICATION_MEDIA_INLINE_SOURCE_333_20261004/, 'app333 Worker marker missing');
assert.match(worker, /function normalizePublicationSourceMedia093\(/, 'inline media normalizer missing');
assert.match(worker, /sourceMedia: normalizePublicationSourceMedia093\(value\?\.sourceMedia\)/, 'batch parser does not accept inline media');
assert.match(
  worker,
  /const inlineMedia = mutation\.refreshSourceMedia \? mutation\.sourceMedia : null;[\s\S]*mutation\.refreshSourceMedia && !inlineMedia[\s\S]*fetchFirestoreDocument/,
  'Worker must read Firestore only as backward-compatible fallback when inline media is absent',
);
assert.match(
  worker,
  /if \(media\?\.sunoUrlPrimary\) refreshedMediaBySource\.set\(mutation\.sourceId, media\)/,
  'inline media is not forwarded to the existing narrow canonical media update',
);

console.log('APP333_PUBLIC_SOURCE_FIRESTORE_IMMEDIATE_W0=PASS');
console.log('APP333_PUBLIC_SOURCE_SINGLE_WORKER_PAYLOAD=PASS');
console.log('APP333_PUBLIC_OPTIONS_EXISTING_PATH_UNCHANGED=PASS');

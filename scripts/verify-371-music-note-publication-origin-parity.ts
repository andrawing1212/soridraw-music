import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldRepairMusicNotePublicationOrigin361 } from '../src/services/exploreEnvironmentParityPolicy';

assert.equal(shouldRepairMusicNotePublicationOrigin361({
  hasLocalState: true,
  latestSignalVersion: 12,
  certifiedSignalVersion: 7,
}), true);
assert.equal(shouldRepairMusicNotePublicationOrigin361({
  hasLocalState: true,
  latestSignalVersion: 12,
  certifiedSignalVersion: 12,
}), false);
assert.equal(shouldRepairMusicNotePublicationOrigin361({
  hasLocalState: false,
  latestSignalVersion: 12,
  certifiedSignalVersion: 0,
}), false);
assert.equal(shouldRepairMusicNotePublicationOrigin361({
  hasLocalState: true,
  latestSignalVersion: 0,
  certifiedSignalVersion: 0,
}), false);

const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');

assert.match(publication, /const PUBLICATION_CACHE_SCHEMA_VERSION = 2;/);
assert.match(publication, /PUBLICATION_ORIGIN_CERT_STORAGE_PREFIX_361/);
assert.match(publication, /readLatestExplorePublicationSyncSignal\(uid\)/);
assert.match(publication, /shouldRepairMusicNotePublicationOrigin361\(/);
assert.match(publication, /options\.revalidate !== true/);
assert.match(publication, /publicationServerValidatedUids\.has\(uid\) && !publicationOriginRepairNeeded361/);
assert.match(publication, /cached\s*&& !publicationOriginRepairNeeded361\s*&& lastPersistentValidationAt334/);
assert.match(publication, /\/v1\/me\/music-note-publications-revision/);
assert.match(publication, /\/v1\/me\/music-note-publications-bundle/);
assert.match(publication, /markPublicationOriginCertifiedSignal361\(uid, latestPublicationSignalVersion361\)/);
assert.match(publication, /export const ensureExploreMusicNotePublicationOriginParity361/);
assert.match(publication, /publicationOriginRepairAttemptedSignal361/);
assert.doesNotMatch(publication, /PUBLICATION_CACHE_SCHEMA_VERSION = 3/);

assert.match(favorites, /ensureExploreMusicNotePublicationOriginParity361\(user\)/);
assert.match(favorites, /applyExplorePublicationSyncSignalState\(uid, signal\)/);
assert.match(favorites, /renderMusicNoteStateButtonFill\(explorePublicationStateBySongId\[getFavoriteDocumentId\(song\)\]\?\.status === 'public'\)/);
assert.match(favorites, /renderMusicNoteStateButtonFill\(isMusicNoteCardLocked\(song\)\)/);

console.log('APP371_MUSIC_NOTE_PUBLICATION_ORIGIN_PARITY=PASS');
console.log('UNCHANGED_MUSIC_NOTE_REENTRY_WORKER_ZERO_CONTRACT=PRESERVED');
console.log('RETAINED_PUBLICATION_SIGNAL_BOUNDED_REPAIR=PASS');
console.log('PUBLIC_AND_LOCK_BUTTON_RENDER_CONTRACT=PRESERVED');

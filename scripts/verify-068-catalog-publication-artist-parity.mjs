import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER;
if (!workerPath) throw new Error('SORIDRAW_GENERATED_WORKER is required');

const worker = readFileSync(workerPath, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error('[068] ' + message);
};

const profileStart = worker.indexOf('async function publicationReadProfileR2024(');
const profileEnd = worker.indexOf('// SORIDRAW_PUBLICATION_TARGETED_R2_HOTPATH_043_20260913', profileStart);
assert(profileStart >= 0 && profileEnd > profileStart, 'publication profile function boundary missing');
const profile = worker.slice(profileStart, profileEnd);

assert(profile.includes('SORIDRAW_CATALOG_PUBLICATION_ARTIST_PARITY_068_20260919'), '068 profile marker missing');
assert(profile.includes('if (!isExploreR2CatalogEnabled066(env))'), 'catalog-enabled shared fallback guard missing');
assert(profile.includes('readExploreSharedProfile060(env, uid)'), 'shared profile fallback missing');
assert(profile.includes('publicationReadProfileR2024Core066(env, authContext)'), 'local profile core fallback missing');

const pubStart = worker.indexOf('async function handleMusicNotePublicationSingleWrite016(');
const pubEnd = worker.indexOf('function handlePublicationR2Core(', pubStart);
assert(pubStart >= 0 && pubEnd > pubStart, 'publication function boundary missing');
const publication = worker.slice(pubStart, pubEnd);

const markerAt = publication.indexOf('SORIDRAW_CATALOG_PUBLICATION_ARTIST_PARITY_068_20260919');
const unchangedAt = publication.indexOf('const unchanged = publicationCanonicalUnchanged016', markerAt);
assert(markerAt >= 0 && unchangedAt > markerAt, 'artist parity block ordering wrong');
const added = publication.slice(markerAt, unchangedAt);

assert(added.includes("isExploreR2CatalogEnabled066(env) && !previous?.id && !profile?.r2FirstPublisher066"), 'new-track artist guard missing');
assert(added.includes('syncExploreCatalogArtist066(env, {'), 'artist sync call missing');
assert(added.includes("uid: String(authContext?.uid || '').trim()"), 'artist uid source missing');
assert(added.includes("nickname: String(profile?.nickname || authContext?.displayName || '').trim()"), 'artist nickname source missing');
assert(added.includes("handle: String(profile?.handle || '').trim().replace(/^@+/, '')"), 'artist handle source missing');
assert(!/env\.DB|\.prepare\s*\(|\.batch\s*\(/.test(added), '068 adds D1 work');
assert(!/track_search_fts|profile_search_fts/.test(added), '068 adds D1 FTS work');

const firstPublisher = worker.slice(
  worker.indexOf('async function ensureFirstPublisherSharedProfile066('),
  worker.indexOf('async function firstPublisherProfileTrackDelta066(', worker.indexOf('async function ensureFirstPublisherSharedProfile066(')),
);
assert(firstPublisher.includes('syncExploreCatalogArtist066(env, bundle.body.data.profile)'), 'existing first-publisher artist sync removed');

const profileEditStart = worker.indexOf('async function handleMyProfileUpdate(');
const profileEditEnd = worker.indexOf('function ', profileEditStart + 20);
const profileEdit = profileEditStart >= 0 ? worker.slice(profileEditStart, profileEditEnd > profileEditStart ? profileEditEnd : profileEditStart + 12000) : '';
assert(profileEdit.includes('syncExploreCatalogArtist066(env, profile)'), 'profile-edit artist sync removed');

const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
assert(manifest.patches.at(-1) === '068-catalog-publication-artist-parity.mjs', '068 is not final release patch');

console.log('CATALOG_PUBLICATION_ARTIST_PARITY_068=PASS');
console.log('SHARED_PROFILE_FALLBACK_WHEN_CATALOG_ON=PASS');
console.log('NEW_TRACK_ARTIST_MARKER=PASS');
console.log('FIRST_PUBLISHER_EXISTING_SYNC=PASS');
console.log('PROFILE_EDIT_EXISTING_SYNC=PASS');
console.log('EXTRA_D1_READ_WRITE_068=0');

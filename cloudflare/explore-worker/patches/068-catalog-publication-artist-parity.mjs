import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_CATALOG_PUBLICATION_ARTIST_PARITY_068_20260919';
if (source.includes(marker)) {
  console.log('[068] catalog publication artist parity already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919',
  'SORIDRAW_LIKE_075_SHARED_COUNT_PARITY_067_20260919',
  'publicationReadProfileR2024Core066',
  'publicationReadProfileR2024',
  'handleMusicNotePublicationSingleWrite016',
  'syncExploreCatalogArtist066',
  'isExploreR2CatalogEnabled066',
  'readExploreSharedProfile060',
]) {
  if (!source.includes(required)) throw new Error('[068] required runtime missing: ' + required);
}

const oldGuard = [
  '  if (!isExploreR2FirstPublisherEnabled066(env)) {',
  '    return await publicationReadProfileR2024Core066(env, authContext);',
  '  }',
].join('\n');
const newGuard = [
  '  // ' + marker,
  '  // Catalog write mode may use the shared R2 profile as a zero-D1 fallback.',
  '  // First-publisher mode remains a stricter subset of catalog mode.',
  '  if (!isExploreR2CatalogEnabled066(env)) {',
  '    return await publicationReadProfileR2024Core066(env, authContext);',
  '  }',
].join('\n');
const guardCount = source.split(oldGuard).length - 1;
if (guardCount !== 1) throw new Error('[068] publication profile guard count=' + guardCount);
source = source.replace(oldGuard, newGuard);

const unchangedAnchor = '  const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);';
const unchangedCount = source.split(unchangedAnchor).length - 1;
if (unchangedCount !== 1) throw new Error('[068] publication unchanged anchor count=' + unchangedCount);
const artistBlock = [
  '  // ' + marker,
  '  // A brand-new catalog track must also make its creator searchable. Reuse the',
  '  // already-resolved profile; never add a D1 query/write for this derived index.',
  '  // The dedicated first-publisher bootstrap already writes its own artist marker.',
  '  if (isExploreR2CatalogEnabled066(env) && !previous?.id && !profile?.r2FirstPublisher066) {',
  '    try {',
  '      await syncExploreCatalogArtist066(env, {',
  "        uid: String(authContext?.uid || '').trim(),",
  "        nickname: String(profile?.nickname || authContext?.displayName || '').trim(),",
  "        handle: String(profile?.handle || '').trim().replace(/^@+/, ''),",
  '      });',
  '    } catch (error) {',
  "      console.warn('[SORIDRAW 068] publication artist catalog sync deferred:', String(error?.message || error || 'unknown'));",
  '    }',
  '  }',
  '',
  unchangedAnchor,
].join('\n');
if (/env\.DB|\.prepare\s*\(|\.batch\s*\(/.test(artistBlock.replace(unchangedAnchor, ''))) {
  throw new Error('[068] artist parity block must not add D1 work');
}
source = source.replace(unchangedAnchor, artistBlock);

const profileStart = source.indexOf('async function publicationReadProfileR2024(');
const profileEnd = source.indexOf('// SORIDRAW_PUBLICATION_TARGETED_R2_HOTPATH_043_20260913', profileStart);
const profileSection = profileStart >= 0 && profileEnd > profileStart ? source.slice(profileStart, profileEnd) : '';
for (const required of [
  marker,
  'if (!isExploreR2CatalogEnabled066(env))',
  'readExploreSharedProfile060(env, uid)',
  'publicationReadProfileR2024Core066(env, authContext)',
]) {
  if (!profileSection.includes(required)) throw new Error('[068] profile runtime missing: ' + required);
}

const publicationStart = source.indexOf('async function handleMusicNotePublicationSingleWrite016(');
const publicationEnd = source.indexOf('function handlePublicationR2Core(', publicationStart);
const publicationSection = publicationStart >= 0 && publicationEnd > publicationStart ? source.slice(publicationStart, publicationEnd) : '';
for (const required of [
  marker,
  "isExploreR2CatalogEnabled066(env) && !previous?.id && !profile?.r2FirstPublisher066",
  'syncExploreCatalogArtist066(env, {',
  "uid: String(authContext?.uid || '').trim()",
  "nickname: String(profile?.nickname || authContext?.displayName || '').trim()",
  "handle: String(profile?.handle || '').trim().replace(/^@+/, '')",
]) {
  if (!publicationSection.includes(required)) throw new Error('[068] publication runtime missing: ' + required);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[068] Catalog publication profile fallback + artist marker parity applied with zero added D1 work.');

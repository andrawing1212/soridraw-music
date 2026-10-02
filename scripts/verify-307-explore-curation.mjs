import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`[app307] ${message}`);
};

const explore = read('src/pages/ExplorePage.tsx');
const master = read('src/pages/MasterPermissionsPage.tsx');
const service = read('src/services/exploreCurationService.ts');
const worker = read('cloudflare/explore-worker/canonical/preview-entry.js');

assert(explore.includes("'추천곡 승격'") || explore.includes('추천곡 승격'), 'Explore More must expose the promotion action.');
assert(explore.includes('승격 곡 관리'), 'Explore must expose the promoted-track manager entry.');
assert(explore.includes('curationAccess307.canCurate &&'), 'Curation controls must be permission-gated.');
assert(explore.includes('title="SORIDRAW 추천"'), 'SORIDRAW recommendation rail is missing.');
const railAt = explore.indexOf('title="SORIDRAW 추천"');
const railSlice = explore.slice(Math.max(0, railAt - 500), railAt + 1800);
assert(railSlice.includes('curatedTracks307'), 'SORIDRAW recommendation rail must use curated tracks.');
assert(!railSlice.includes('recommendationModel221.picks'), 'SORIDRAW recommendation rail must not fall back to automatic latest picks.');

assert(master.includes('익스플로어 관리'), 'Master permission UI must contain Explore management permission.');
assert(master.includes('setExploreManagerPermission307'), 'Master permission UI must persist Explore manager grants.');
assert(master.includes('explore-management-permission'), 'Explore permission changes must signal the target account.');

assert(service.includes('soridraw_explore_curated_soridraw_v307'), 'Curated local cache key is missing.');
assert(service.includes('SORIDRAW_CURATED_RECHECK_MS_307'), 'Curated local-first recheck guard is missing.');
assert(service.includes('/v1/curated-revision'), 'Curated revision check is missing.');
assert(!service.includes("from 'firebase/firestore'"), 'Curated public reads must not add Firestore page-entry reads.');

assert(worker.includes('SORIDRAW_EXPLICIT_CURATED_MANAGEMENT_307_20261003'), 'Worker curation marker is missing.');
assert(worker.includes('SORIDRAW_CURATED_R2_LOCAL_FIRST_307_20261003'), 'Worker R2 local-first marker is missing.');
assert(worker.includes('curatedStableBodyEdgeKey307'), 'Shared edge body cache is missing.');
assert(worker.includes('EDGE-CURATED-BODY-307'), 'Edge curated response path is missing.');
assert(worker.includes('SORIDRAW_CURATED_PUBLICATION_TARGETED_SYNC_307_20261003'), 'Targeted publication/privacy sync is missing.');
assert(worker.includes("url.pathname === '/v1/me/music-note-publications/batch'"), 'Current Music Note publication batch path must sync curated privacy.');
assert(worker.includes('memberIds'), 'Curated R2 must preserve promoted membership while a song is private.');
assert(worker.includes('syncCuratedPublicationResults307(request, env, results307)'), 'Publication results must patch curated R2.');
assert(worker.includes('DELETE FROM curated_picks WHERE collection_key=? AND track_id=?'), 'Explicit recommendation removal must stay single-row targeted.');
assert(worker.includes('INSERT INTO curated_picks(collection_key,track_id'), 'Explicit recommendation promotion must stay single-row targeted.');
assert(!worker.includes("if (isTrackVisibilityMutation307 && response.ok) {\n      try { await curatedBucket307(env)?.delete(SORIDRAW_CURATED_R2_KEY_307)"), 'Visibility changes must not invalidate the whole curated snapshot.');

console.log('APP307_EXPLORE_CURATION_VERIFY=PASS');
console.log('CURATED_PUBLIC_READ=LOCAL_FIRST_PLUS_EDGE_R2');
console.log('CURATION_MUTATION=D1_TARGETED_W1');
console.log('PUBLICATION_PRIVACY_SYNC=TARGETED_R2_NO_D1_REBUILD');
console.log('EXPLORE_MANAGER_PERMISSION=EXPLICIT_MASTER_GRANT');

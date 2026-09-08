import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const service = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/029-explore-public-profile-r2-mirror-parity.mjs', 'utf8');

const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`${label} missing: ${needle}`);
};

requireText(page, 'SORIDRAW_EXPLORE_PUBLIC_PROFILE_PARITY_048', 'page marker');
requireText(page, 'publishedAt: number;', 'published timestamp type');
requireText(page, 'publishedAt: safeCount(row.publishedAt ?? row.published_at)', 'published timestamp normalization');
requireText(page, 'const comparePublicProfileTracks', 'profile comparator');
requireText(page, 'Number(b.profilePinned) - Number(a.profilePinned)', 'pin ordering');
requireText(page, 'b.publishedAt - a.publishedAt', 'published ordering');
requireText(page, 'b.id.localeCompare(a.id)', 'stable id ordering');
requireText(page, 'normalizedTracks.sort(comparePublicProfileTracks)', 'profile sort use');

requireText(service, 'PROFILE_FIRST_VIEW_SCHEMA_VERSION = 5', 'cache schema bump');
requireText(service, "url.searchParams.set('__soridraw_profile_parity', '48')", 'cold parity flag');
requireText(service, "if (revision) {", 'warm revision branch');

requireText(patch, 'SORIDRAW_EXPLORE_PUBLIC_PROFILE_R2_MIRROR_PARITY_029_20260909', 'worker marker');
requireText(patch, 'syncMirroredProfileR2029', 'mirror R2 sync');
requireText(patch, 'repairPublicProfileParityOnColdRead029', 'cold repair');
requireText(patch, 'profileParityVersion', 'repair version marker');
requireText(patch, 'readPublicProfileFirstViewRow', 'bounded D1 repair');
requireText(patch, 'applyExploreMirrorPayload020Core029', 'mirror wrapper');
requireText(patch, 'handlePublicProfileFirstViewWithEdgeCacheCore029', 'profile wrapper');
if (patch.includes('setInterval(') || patch.includes('setTimeout(')) throw new Error('048 must not add polling/timers');

console.log('VERIFY_048_EXPLORE_PUBLIC_PROFILE_PARITY=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const css = readFileSync('src/components/explore/exploreSocial.css', 'utf8');

assert.match(service, /SORIDRAW_EXPLORE_PROFILE_CONNECTIONS_376_20261007/);
assert.match(service, /export const getExploreProfileConnections/);
assert.match(service, /new URLSearchParams\(\{ limit: '30' \}\)/);
assert.match(service, /\/v1\/profiles\/\$\{encodeURIComponent\(normalizedRef\)\}\/\$\{normalizedDirection\}/);
assert.match(service, /rows\.map\([\s\S]*?normalizeProfile/);
assert.doesNotMatch(
  service.slice(service.indexOf('export const getExploreProfileConnections'), service.indexOf('export const getExplorePublicProfileTracks')),
  /getExplorePublicProfile\(/,
  'connection cards must not fetch one profile per row',
);

assert.match(page, /profileConnectionsOpen376/);
assert.match(page, /openProfileConnections376\('followers'\)/);
assert.match(page, /openProfileConnections376\('following'\)/);
assert.match(page, /soridraw-explore-connections-modal-376/);
assert.match(page, /profileConnectionsCache376Ref/);
assert.match(page, /getExploreProfileConnections\(targetUid, direction/);
assert.match(page, /profileConnectionsCache376Ref\.current\.delete\(\`\$\{activeUid\}:followers\`\)/);
assert.match(page, /profileConnectionsCache376Ref\.current\.delete\(\`\$\{user\.uid\}:following\`\)/);

const statsAt = page.indexOf('className="soridraw-explore-profile-stats"');
const modalAt = page.indexOf('const renderProfileConnectionsModal376');
assert.ok(statsAt >= 0 && modalAt >= 0);
const stats = page.slice(statsAt, statsAt + 2200);
assert.match(stats, /soridraw-explore-profile-stat-button-376/);
assert.match(stats, /팔로워/);
assert.match(stats, /팔로잉/);

assert.match(css, /SORIDRAW_EXPLORE_PROFILE_CONNECTIONS_376_20261007/);
assert.match(css, /\.soridraw-explore-connections-backdrop-376/);
assert.match(css, /@media \(max-width:600px\)/);

console.log('APP376_PROFILE_CONNECTIONS_CLICK_ONLY_FETCH=PASS');
console.log('APP376_PROFILE_CONNECTIONS_BOUNDED_PAGE_30=PASS');
console.log('APP376_PROFILE_CONNECTIONS_NO_N_PLUS_ONE=PASS');
console.log('APP376_PROFILE_CONNECTIONS_PC_MOBILE_MODAL=PASS');

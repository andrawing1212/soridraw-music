import { assertAppVersionSource } from './assert-app-version-source.mjs';
assertAppVersionSource();
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const service = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');

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

requireText(service, 'PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6', 'cache schema bump');
requireText(service, "url.searchParams.set('__soridraw_shared_profile', '51')", 'cold parity flag');
requireText(service, "if (revision) {", 'warm revision branch');


console.log('VERIFY_048_EXPLORE_PUBLIC_PROFILE_PARITY=PASS');

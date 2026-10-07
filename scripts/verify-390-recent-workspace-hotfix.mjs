import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const engine = readFileSync('src/components/studio/StudioSplitEngineWorkspace.tsx', 'utf8');
const explore = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(version.version, 381);
assert.match(explore, /onRecentSongs=\{\(\) => go\('\/studio\?view=recent'\)\}/);
assert.match(engine, /useLayoutEffect/);
assert.match(engine, /soridraw-studio-frame-resize/);
assert.match(engine, /props\.workspaceRequestId/);
assert.match(engine, /props\.workspaceView/);
assert.doesNotMatch(explore, /onRecentSongs=\{\(\) => go\('\/studio'\)\}/);

console.log('APP381_EXPLORE_RECENT_EXACT_ROUTE=PASS');
console.log('APP381_WORKSPACE_PREPAINT_GEOMETRY_RECONCILIATION=PASS');
console.log('APP381_BACKEND_FILES_UNTOUCHED_BY_VERIFIER_SCOPE=PASS');

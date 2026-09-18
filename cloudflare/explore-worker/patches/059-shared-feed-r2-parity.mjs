import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917';
if (source.includes(marker)) {
  console.log('[059] shared Feed R2 parity already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916',
  'processExploreLikeBatches035',
  'syncExploreFeedR2Publication012',
  'syncExploreFeedR2OptionPatch017',
  'syncExploreFeedR2Private017',
  'exploreCacheBucket031',
  'exploreFeedR2Key',
]) {
  if (!source.includes(required)) throw new Error(`[059] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[059] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[059] function body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[059] unterminated function: ${name}`);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(
    new RegExp(`^async\\s+function\\s+${name}\\(`),
    `async function ${coreName}(`,
  );
  if (renamed === range.text) throw new Error(`[059] could not wrap ${name}`);
  const wrapper = wrapperBuilder(coreName);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapper + source.slice(range.end);
};

const helperAnchor = functionRange('processExploreLikeBatches035').start;
const helpers = `// ${marker}\nconst EXPLORE_SHARED_FEED_MIRROR_VERSION_059 = 112;\nconst exploreSharedFeedR2Key059 = (sort) => \`internal/explore/shared-feed-v112/\${sort === 'popular' ? 'popular' : 'latest'}-40.json\`;\n\nasync function mirrorExploreSharedFeeds059(env) {\n  const shared = env?.PROFILE_MEDIA || null;\n  const local = exploreCacheBucket031(env);\n  if (!shared || !local) return { mirrored: 0, skipped: true };\n  let mirrored = 0;\n  for (const sort of ['latest', 'popular']) {\n    const object = await local.get(exploreFeedR2Key(sort));\n    if (!object) continue;\n    const body = await object.text();\n    if (!body) continue;\n    await shared.put(exploreSharedFeedR2Key059(sort), body, {\n      httpMetadata: { contentType: 'application/json; charset=utf-8' },\n      customMetadata: {\n        soridrawSharedFeed: '112',\n        sourceUpdatedAt: String(object.customMetadata?.updatedAt || Date.now()),\n        mirroredAt: String(Date.now()),\n      },\n    });\n    mirrored += 1;\n  }\n  return { mirrored, skipped: false };\n}\n`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('processExploreLikeBatches035', 'Core059', (coreName) => `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {\n  const totals = await ${coreName}(env, scheduledTime);\n  if (Number(totals?.changedTracks || 0) > 0) {\n    try {\n      totals.sharedFeedMirror059 = await mirrorExploreSharedFeeds059(env);\n    } catch (error) {\n      console.warn('[SORIDRAW 059] shared Feed mirror after like aggregate deferred:', String(error?.message || error || 'unknown'));\n      totals.sharedFeedMirror059 = { mirrored: 0, deferred: true };\n    }\n  }\n  return totals;\n}`);

for (const name of [
  'syncExploreFeedR2Publication012',
  'syncExploreFeedR2OptionPatch017',
  'syncExploreFeedR2Private017',
]) {
  wrapAsyncFunction(name, 'Core059', (coreName) => `async function ${name}(...args) {\n  const result = await ${coreName}(...args);\n  const env = args[0];\n  try {\n    await mirrorExploreSharedFeeds059(env);\n  } catch (error) {\n    console.warn('[SORIDRAW 059] shared Feed mirror after ${name} deferred:', String(error?.message || error || 'unknown'));\n  }\n  return result;\n}`);
}

const finalAggregate = functionRange('processExploreLikeBatches035').text;
for (const required of [
  marker,
  'exploreSharedFeedR2Key059',
  'mirrorExploreSharedFeeds059',
  'sharedFeedMirror059',
  'syncExploreFeedR2Publication012Core059',
  'syncExploreFeedR2OptionPatch017Core059',
  'syncExploreFeedR2Private017Core059',
]) {
  if (!source.includes(required)) throw new Error(`[059] final runtime missing: ${required}`);
}
if (!finalAggregate.includes('changedTracks') || !finalAggregate.includes('mirrorExploreSharedFeeds059')) {
  throw new Error('[059] like aggregate mirror boundary missing');
}
if (helpers.includes('env.DB.') || helpers.includes('.prepare(')) {
  throw new Error('[059] shared Feed mirror must not read D1');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[059] Feed mutations now mirror the already-materialized environment R2 snapshots into a shared R2 namespace; page reads remain D1-free.');

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_SHARED_FEED_TARGETED_PARITY_069_20260919';
if (source.includes(marker)) {
  console.log('[069] targeted shared Feed parity already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_CATALOG_PUBLICATION_ARTIST_PARITY_068_20260919',
  'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917',
  'syncExploreFeedR2Publication043', 'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043', 'exploreSharedFeedR2Key059',
  'catalogMetaKey066', 'isExploreR2CatalogEnabled066',
  'sortExploreFeedItems012', 'buildExploreFeedCursor012', 'EXPLORE_R2_FEED_LIMIT',
]) if (!source.includes(required)) throw new Error('[069] missing dependency: ' + required);

function functionRange(name) {
  const needle = 'async function ' + name + '(';
  const start = source.indexOf(needle);
  if (start < 0) throw new Error('[069] function missing: ' + name);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('[069] function brace missing: ' + name);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i += 1; comment = ''; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[069] unterminated function: ' + name);
}
let runtime = readFileSync(new URL('../runtime/shared-feed-targeted-069.js', import.meta.url), 'utf8');
runtime = runtime.replace(/^export\s+/gm, '');
if (!runtime.includes(marker)) throw new Error('[069] runtime marker missing');
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(runtime)) throw new Error('[069] shared Feed runtime accesses D1');
const anchor = functionRange('syncExploreFeedR2Publication043').start;
source = source.slice(0, anchor) + runtime + '\n\n' + source.slice(anchor);

const wrappers = [
  { name: 'syncExploreFeedR2Publication043', args: 'env, incomingItem',
    operation: "{ kind: 'publish', trackId: String(incomingItem?.id || incomingItem?.trackId || '').trim(), item: incomingItem }" },
  { name: 'syncExploreFeedR2Private043', args: 'env, trackId',
    operation: "{ kind: 'private', trackId: String(trackId || '').trim() }" },
  { name: 'syncExploreFeedR2OptionPatch043', args: 'env, trackId, patch',
    operation: "{ kind: 'options', trackId: String(trackId || '').trim(), patch }" },
];
for (const entry of wrappers) {
  const range = functionRange(entry.name);
  const coreName = entry.name + 'Core069';
  const renamed = range.text.replace('async function ' + entry.name + '(', 'async function ' + coreName + '(');
  if (renamed === range.text) throw new Error('[069] failed to wrap: ' + entry.name);
  const wrapper = [
    'async function ' + entry.name + '(' + entry.args + ') {',
    '  const result = await ' + coreName + '(' + entry.args + ');',
    '  try {',
    '    const shared = await syncExploreSharedFeedTargeted069(env, ' + entry.operation + ');',
    '    if (!shared.ok) console.warn(' + JSON.stringify('[SORIDRAW 069] targeted shared Feed repair needed:') + ', ' + JSON.stringify(entry.name) + ', JSON.stringify(shared.results || []));',
    '  } catch (error) {',
    '    console.warn(' + JSON.stringify('[SORIDRAW 069] targeted shared Feed deferred:') + ', ' + JSON.stringify(entry.name) + ', String(error?.message || error || "unknown"));',
    '  }',
    '  return result;',
    '}',
  ].join('\n');
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapper + source.slice(range.end);
}
for (const entry of wrappers) {
  const check = functionRange(entry.name).text;
  if (!check.includes('syncExploreSharedFeedTargeted069(env,') || !check.includes(entry.name + 'Core069')) {
    throw new Error('[069] live wrapper missing: ' + entry.name);
  }
}
writeFileSync(workerPath, source, 'utf8');
console.log('[069] active publication/private/options paths patch shared first-page Feed with targeted CAS, no D1.');

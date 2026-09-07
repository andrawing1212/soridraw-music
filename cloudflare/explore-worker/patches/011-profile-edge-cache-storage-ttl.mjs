import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PROFILE_EDGE_STORAGE_TTL_011_20260904';
if (source.includes(marker)) {
  console.log('[011] profile edge storage TTL already applied.');
  process.exit(0);
}
if (!source.includes('readExploreProfileR2Bundle')) {
  throw new Error('011 requires the active R2 public-profile path.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`011 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
    }
  }
  throw new Error(`011 unterminated function: ${name}`);
};

const range = functionRange('handlePublicProfileFirstViewWithEdgeCache');
let fn = range.text;
const cachePut = '    await cache.put(key, response.clone());';
if (!fn.includes(cachePut)) throw new Error('011 expected R2 cache.put anchor missing.');
fn = fn.replace(
  cachePut,
  "    const edgeStoredHeaders = new Headers(response.headers);\n    edgeStoredHeaders.set('Cache-Control', 'public, max-age=' + PUBLIC_PROFILE_FIRST_VIEW_EDGE_TTL_SECONDS + ', s-maxage=' + PUBLIC_PROFILE_FIRST_VIEW_EDGE_TTL_SECONDS);\n    const edgeStored = new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers: edgeStoredHeaders });\n    await cache.put(key, edgeStored);"
);
source = source.slice(0, range.start) + fn + source.slice(range.end);

const helperAnchor = 'async function handlePublicProfileFirstViewWithEdgeCache(';
source = source.replace(helperAnchor, `// ${marker}\n${helperAnchor}`);

writeFileSync(workerPath, source);
console.log('[011] profile edge storage TTL applied.');

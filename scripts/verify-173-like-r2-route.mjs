import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER;
if (!workerPath) throw new Error('SORIDRAW_GENERATED_WORKER is required');
const source = readFileSync(workerPath, 'utf8');
const fail = (message) => { throw new Error('[173-route] ' + message); };

function functionText(name) {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) { start = source.indexOf(needle); if (start >= 0) break; }
  if (start < 0) fail('function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { i += 1; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  fail('unterminated: ' + name);
}

for (const marker of [
  'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922',
  'SORIDRAW_LIKE_R2_REVISION_SAFE_173_20260922',
  'applyGenerationGuard173',
  'applyPersonalLikeRevision173',
  'createLikeR2RevisionPublisher173',
]) if (!source.includes(marker)) fail('missing marker: ' + marker);

const batch = functionText('handleLikeBatch034');
for (const needle of [
  'canonical171.applyAtomically',
  'publisher173.publish',
  'publicationFailures173',
  'LIKE_PUBLICATION_RETRY_REQUIRED',
  "'Retry-After': '2'",
  "personalLikeSnapshot: 'revision-safe-173'",
  "publicLikePublication: 'generation-safe-173'",
]) if (!batch.includes(needle)) fail('batch route missing: ' + needle);
if (batch.indexOf('publisher173.publish') < batch.indexOf('canonical171.applyAtomically')) {
  fail('publication occurs before canonical D1 settlement');
}

const legacy = functionText('writeSharedLikes061');
if (!legacy.includes("revisionProtocol173 === 'd1only171'")) fail('legacy full-list overwrite guard missing');

const publisherStart = source.indexOf('function createLikeR2RevisionPublisher173(');
const publisherEnd = source.indexOf('// SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922', publisherStart);
const runtime = source.slice(Math.max(0, source.lastIndexOf('// SORIDRAW_LIKE_R2_REVISION_SAFE_173_20260922', publisherStart)), publisherEnd);
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(runtime)) fail('173 R2 runtime accesses D1');
if (!runtime.includes('etagMatches') || !runtime.includes("etagDoesNotMatch: '*'")) fail('R2 CAS missing');
if (!runtime.includes('same-generation-count-conflict')) fail('generation conflict guard missing');
if (!runtime.includes('same-revision-personal-conflict')) fail('personal revision conflict guard missing');
if (runtime.includes('.slice(0, 2000)')) fail('2,000 truncation reintroduced');

console.log('173_ROUTE_CANONICAL_THEN_R2=PASS');
console.log('173_R2_RUNTIME_D1_WRITE_READ=0_BY_STATIC_CONTRACT');
console.log('173_R2_CAS_REQUIRED=PASS');
console.log('173_LEGACY_FULL_LIST_OVERWRITE_BLOCKED=PASS');

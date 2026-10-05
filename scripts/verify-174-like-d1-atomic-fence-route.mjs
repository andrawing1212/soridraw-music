import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER;
if (!workerPath) throw new Error('SORIDRAW_GENERATED_WORKER is required');
const source = readFileSync(workerPath, 'utf8');

const functionText = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, 'missing function ' + name);
  const openParen = source.indexOf('(', start);
  assert.ok(openParen >= 0, 'missing function signature ' + name);
  let signatureEnd = -1;
  let parenDepth = 0, signatureQuote = '', signatureEscaped = false, signatureComment = '';
  for (let i = openParen; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (signatureComment === 'line') { if (c === '\n') signatureComment = ''; continue; }
    if (signatureComment === 'block') { if (c === '*' && n === '/') { signatureComment = ''; i += 1; } continue; }
    if (signatureQuote) {
      if (signatureEscaped) signatureEscaped = false;
      else if (c === '\\') signatureEscaped = true;
      else if (c === signatureQuote) signatureQuote = '';
      continue;
    }
    if (c === '/' && n === '/') { signatureComment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { signatureComment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { signatureQuote = c; continue; }
    if (c === '(') parenDepth += 1;
    if (c === ')' && --parenDepth === 0) { signatureEnd = i; break; }
  }
  assert.ok(signatureEnd >= 0, 'unterminated function signature ' + name);
  const brace = source.indexOf('{', signatureEnd);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
};

assert.match(source, /SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922/);
assert.match(source, /EXPLORE_LIKE_CUTOVER_CONTROL_TABLE_174/);

const direct = functionText('adjustExploreLikeCounterDelta');
assert.match(direct, /env\.DB\.batch\(\[/);
assert.match(direct, /explore_like_cutover_control_174/);
assert.match(direct, /phase = 'open'/);
assert.match(direct, /WHERE changes\(\) = 1/);
assert.match(direct, /adjustExploreLikeCounterDeltaCore174/);
assert.match(direct, /isMissingLikeCutoverControl174/);

const enqueue = functionText('enqueueExploreLikeBatch035');
assert.match(enqueue, /env\.DB\.batch\(\[/);
assert.match(enqueue, /INSERT OR IGNORE INTO explore_like_batches_069/);
assert.match(enqueue, /phase = 'open'/);
assert.match(enqueue, /enqueueExploreLikeBatch035Core174/);
assert.match(enqueue, /isMissingLikeCutoverControl174/);

const acquire = functionText('acquireExploreLikeProcessor035');
assert.match(acquire, /phase IN \('open', 'draining'\)/);
assert.match(acquire, /acquireExploreLikeProcessor035Core174/);
assert.match(acquire, /isMissingLikeCutoverControl174/);

const canonical = functionText('createLikeD1OnlyCanonical171');
assert.match(canonical, /explore_like_cutover_control_174/);
assert.match(canonical, /phase = 'frozen'/);
assert.ok(
  canonical.indexOf("phase = 'frozen'") < canonical.indexOf('AND ${effectiveLiked171} != ?'),
  'frozen condition must be part of 171 relation mutation predicate',
);

const batch = functionText('handleLikeBatch034');
if (batch.includes('SORIDRAW_FINAL_LIKE_W1_HYBRID_188_20260922')) {
  assert.match(batch, /enqueueExploreLikeBatch035\(env, authContext\.uid, mutations, receivedAt\)/);
  assert.match(batch, /canonicalD1: 'queued'/);
  assert.doesNotMatch(batch, /createLikeD1OnlyCanonical171\(/);
  assert.doesNotMatch(batch, /adjustExploreLikeCounterDelta\(/);
} else {
  const modeAt = batch.indexOf("cutover172.mode === 'd1only171'");
  const frozenAt = batch.indexOf('await assertD1OnlyFrozen174(env)');
  const canonicalAt = batch.indexOf('createLikeD1OnlyCanonical171(env.DB');
  assert.ok(modeAt >= 0 && frozenAt > modeAt && canonicalAt > frozenAt);
  assert.match(batch, /personalLikeSnapshot: 'settled'/);
}

// Product Worker may read/condition on the fence, but it must never arm,
// reopen, or freeze the cutover control row itself.
for (const forbidden of [
  'UPDATE explore_like_cutover_control_174 SET phase',
  'INSERT INTO explore_like_cutover_control_174',
  'DELETE FROM explore_like_cutover_control_174',
]) {
  assert.equal(source.includes(forbidden), false, 'product Worker must not own cutover state: ' + forbidden);
}

const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
assert.equal(manifest.patches.includes('084-like-d1-atomic-cutover-fence.mjs'), false,
  '174 remains source-only until explicit deployment preparation');

console.log('174_DIRECT_WRITE_FENCED_IN_SAME_D1_BATCH=PASS');
console.log('174_QUEUE_INTAKE_FENCED_IN_SAME_D1_BATCH=PASS');
console.log('174_PROCESSOR_ALLOWED_OPEN_DRAINING_BLOCKED_FROZEN=PASS');
console.log('174_171_WRITE_REQUIRES_D1_FROZEN_OR_FINAL_W1_QUEUE=PASS');
console.log('174_PRODUCT_WORKER_CANNOT_SELF_ARM_CONTROL=PASS');
console.log('174_RELEASE_MANIFEST_DORMANT=PASS');

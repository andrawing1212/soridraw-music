import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SORIDRAW_SERVER_ORDER_LIKE_QUEUE_073_20260920
// Only the server acceptance clock orders independently clocked devices.
// Preserve payload digest/client timestamps for idempotency identity; do not
// allow a device with a future clock to advance the canonical aggregation order.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[073] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_SERVER_ORDER_LIKE_QUEUE_073_20260920';
if (source.includes(marker)) { console.log('[073] already applied'); process.exit(0); }

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_040_20260912',
  'SORIDRAW_PUBLICATION_CANONICAL_LIKE_PARITY_071_20260920',
  'async function exploreLikeW1Batch040(uid, mutations, now) {',
  'ORDER BY created_at DESC, batch_id DESC, queue_kind DESC'
]) if (!source.includes(required)) throw new Error('[073] missing prerequisite ' + required);

const first = source.indexOf('async function exploreLikeW1Batch040(');
const end = source.indexOf('\n}', first);
if (first < 0 || end < 0) throw new Error('[073] function not found');
const block = source.slice(first, end + 2);
const oldLine = 'const batchAt = Math.max(fallbackAt, ...canonical.map((row) => row.mutationAt));';
if (block.split(oldLine).length !== 2) throw new Error('[073] queue timestamp contract changed');
const nextBlock = block.replace(oldLine, [
  '/* ' + marker + ' */',
  '// Queue order is a server-provided receive timestamp; never max with a',
  '// user-device clock. Same-ms batches remain deterministically ordered by',
  '// their stable SHA batch id in the existing aggregate CTE.',
  'const batchAt = fallbackAt;'
].join('\n  '));
source = source.slice(0, first) + nextBlock + source.slice(end + 2);
if (!source.includes(marker) || source.includes(oldLine)) throw new Error('[073] final guard failed');
writeFileSync(path, source, 'utf8');
console.log('[073] server receive order fixed, W1 queue schema and aggregate unchanged.');
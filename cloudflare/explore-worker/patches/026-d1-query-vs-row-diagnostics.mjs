import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_D1_QUERY_VS_ROW_DIAGNOSTICS_026_20260907';
if (source.includes(marker)) {
  console.log('[026] D1 query-vs-row diagnostics already applied.');
  process.exit(0);
}
for (const required of ['createMeteredD1', 'attachCloudflareUsageHeaders', 'addD1UsageMeta']) {
  if (!source.includes(required)) throw new Error(`[026] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[026] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[026] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[026] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

function classifyD1Query026(sql) {
  const text = String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*--.*$/gm, ' ')
    .trim()
    .toUpperCase();
  if (!text) return 'other';
  if (/^(SELECT|PRAGMA|EXPLAIN)\b/.test(text)) return 'read';
  if (/^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ANALYZE)\b/.test(text)) return 'write';
  if (/^WITH\b/.test(text)) return /\b(INSERT|UPDATE|DELETE|REPLACE)\b/.test(text) ? 'write' : 'read';
  return 'other';
}

function addD1QueryCount026(usage, kind, amount = 1) {
  if (!usage || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
  const count = Math.max(1, Math.floor(Number(amount)));
  if (kind === 'read') usage.d1ReadQueries = Number(usage.d1ReadQueries || 0) + count;
  else if (kind === 'write') usage.d1WriteQueries = Number(usage.d1WriteQueries || 0) + count;
  else usage.d1OtherQueries = Number(usage.d1OtherQueries || 0) + count;
}

function createMeteredD1026(db, usage) {
  if (!db) return db;
  const rawByProxy = new WeakMap();
  const kindByProxy = new WeakMap();
  const wrapPrepared = (statement, kind = 'other') => {
    if (!statement || typeof statement !== 'object') return statement;
    const proxy = new Proxy(statement, {
      get(target, prop) {
        if (prop === 'bind') return (...args) => wrapPrepared(target.bind(...args), kind);
        if (prop === 'all') {
          return async (...args) => {
            const result = await target.all(...args);
            addD1QueryCount026(usage, kind);
            addD1UsageMeta(usage, result);
            return result;
          };
        }
        if (prop === 'run') {
          return async (...args) => {
            const result = await target.run(...args);
            addD1QueryCount026(usage, kind);
            addD1UsageMeta(usage, result);
            return result;
          };
        }
        if (prop === 'first') {
          return async (columnName) => {
            const result = await target.all();
            addD1QueryCount026(usage, kind);
            addD1UsageMeta(usage, result);
            const row = Array.isArray(result?.results) ? result.results[0] ?? null : null;
            return columnName ? (row ? row[columnName] : null) : row;
          };
        }
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    rawByProxy.set(proxy, statement);
    kindByProxy.set(proxy, kind);
    return proxy;
  };
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql) => wrapPrepared(target.prepare(sql), classifyD1Query026(sql));
      if (prop === 'batch') {
        return async (statements) => {
          const list = Array.isArray(statements) ? statements : [];
          const kinds = list.map((statement) => kindByProxy.get(statement) || 'other');
          const rawStatements = list.map((statement) => rawByProxy.get(statement) || statement);
          const results = await target.batch(rawStatements);
          if (Array.isArray(results)) {
            results.forEach((result, index) => {
              addD1QueryCount026(usage, kinds[index] || 'other');
              addD1UsageMeta(usage, result);
            });
          }
          return results;
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function attachCloudflareUsageHeaders026(response, usage) {
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-CF-Diagnostics', SORIDRAW_CF_DIAGNOSTICS_VERSION);
  headers.set('X-SORIDRAW-CF-Worker', String(usage.workerRequests || 1));
  headers.set('X-SORIDRAW-D1-Read', String(usage.d1RowsRead || 0));
  headers.set('X-SORIDRAW-D1-Write', String(usage.d1RowsWritten || 0));
  headers.set('X-SORIDRAW-D1-Read-Queries', String(usage.d1ReadQueries || 0));
  headers.set('X-SORIDRAW-D1-Write-Queries', String(usage.d1WriteQueries || 0));
  headers.set('X-SORIDRAW-D1-Other-Queries', String(usage.d1OtherQueries || 0));
  headers.set('X-SORIDRAW-R2-A', String(usage.r2ClassA || 0));
  headers.set('X-SORIDRAW-R2-B', String(usage.r2ClassB || 0));
  const expose = new Set(
    String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean),
  );
  [
    'X-SORIDRAW-CF-Diagnostics',
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
  ].forEach((name) => expose.add(name));
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const oldMeter = functionRange('createMeteredD1').text;
if (!oldMeter.includes('addD1UsageMeta(usage, result)')) throw new Error('[026] old D1 row meter shape changed');
const meterReplacement = `// ${marker}\n${classifyD1Query026.toString()}\n\n${addD1QueryCount026.toString()}\n\n${createMeteredD1026.toString().replace('createMeteredD1026', 'createMeteredD1')}`;
replaceFunction('createMeteredD1', meterReplacement);

const oldHeaders = functionRange('attachCloudflareUsageHeaders').text;
if (!oldHeaders.includes('X-SORIDRAW-D1-Read') || !oldHeaders.includes('X-SORIDRAW-D1-Write')) {
  throw new Error('[026] usage header shape changed');
}
replaceFunction(
  'attachCloudflareUsageHeaders',
  attachCloudflareUsageHeaders026.toString().replace('attachCloudflareUsageHeaders026', 'attachCloudflareUsageHeaders'),
);

const edgeRange = functionRange('withExploreEdgeCacheHeader');
let edgeNext = edgeRange.text;
if (edgeNext.includes('headers.set("X-SORIDRAW-D1-Read", "0");') && !edgeNext.includes('X-SORIDRAW-D1-Read-Queries')) {
  edgeNext = edgeNext.replace(
    'headers.set("X-SORIDRAW-D1-Read", "0");',
    'headers.set("X-SORIDRAW-D1-Read", "0");\n    headers.set("X-SORIDRAW-D1-Read-Queries", "0");\n    headers.set("X-SORIDRAW-D1-Write-Queries", "0");\n    headers.set("X-SORIDRAW-D1-Other-Queries", "0");',
  );
  edgeNext = edgeNext.replace(
    '"X-SORIDRAW-D1-Read", "X-SORIDRAW-D1-Write", "X-SORIDRAW-R2-A", "X-SORIDRAW-R2-B"',
    '"X-SORIDRAW-D1-Read", "X-SORIDRAW-D1-Write", "X-SORIDRAW-D1-Read-Queries", "X-SORIDRAW-D1-Write-Queries", "X-SORIDRAW-D1-Other-Queries", "X-SORIDRAW-R2-A", "X-SORIDRAW-R2-B"',
  );
  replaceFunction('withExploreEdgeCacheHeader', edgeNext);
}

const finalMeter = functionRange('createMeteredD1').text;
const finalHeaders = functionRange('attachCloudflareUsageHeaders').text;
for (const required of ['classifyD1Query026(', 'addD1QueryCount026(usage, kind)', 'kindByProxy', "prop === 'batch'"]) {
  if (!source.includes(required)) throw new Error(`[026] final query meter missing: ${required}`);
}
for (const required of ['X-SORIDRAW-D1-Read-Queries', 'X-SORIDRAW-D1-Write-Queries', 'X-SORIDRAW-D1-Other-Queries']) {
  if (!finalHeaders.includes(required)) throw new Error(`[026] final header missing: ${required}`);
}
if (!finalMeter.includes('addD1UsageMeta(usage, result)')) throw new Error('[026] row metering was lost');

writeFileSync(workerPath, source, 'utf8');
console.log('[026] D1 query counts and billable row counts are now reported separately; publication behavior is unchanged.');

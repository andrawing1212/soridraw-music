import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_PK_READ_005';
if (source.includes(marker) || source.includes('readPublicProfileFirstViewRowByPrimaryKey')) {
  console.log('[SORIDRAW Worker] Cost-Zero profile first-view PK read already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`005 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`005 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`005 unterminated function: ${name}`);
};

const range = functionRange('readPublicProfileFirstViewRow');
const replacement = `// ${marker}\nasync function readPublicProfileFirstViewRowByPrimaryKey(env, normalized) {\n  return await env.DB.prepare(\`\n    SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at\n    FROM public_profile_first_views\n    WHERE uid = ?\n    LIMIT 1\n  \`).bind(normalized).first();\n}\n\nasync function readPublicProfileFirstViewRowByHandle(env, normalized) {\n  return await env.DB.prepare(\`\n    SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at\n    FROM public_profile_first_views\n    WHERE handle = ? COLLATE NOCASE\n    LIMIT 1\n  \`).bind(normalized).first();\n}\n\nasync function readPublicProfileFirstViewRow(env, ref) {\n  const normalized = String(ref || '').trim().replace(/^@+/, '');\n  if (!normalized) return null;\n\n  // Normal in-app navigation uses owner UID. Keep that hot path to exactly one\n  // primary-key lookup. Handle lookup is compatibility fallback only.\n  const byUid = await readPublicProfileFirstViewRowByPrimaryKey(env, normalized);\n  if (byUid) return byUid;\n  return await readPublicProfileFirstViewRowByHandle(env, normalized);\n}`;

source = source.slice(0, range.start) + replacement + source.slice(range.end);

const required = [
  marker,
  'readPublicProfileFirstViewRowByPrimaryKey',
  'WHERE uid = ?',
  'readPublicProfileFirstViewRowByHandle',
  'WHERE handle = ? COLLATE NOCASE',
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`005 verification failed: ${needle}`);
}

const nextRange = functionRange('readPublicProfileFirstViewRow');
const nextFunction = source.slice(nextRange.start, nextRange.end);
if (nextFunction.includes('WHERE uid = ? OR handle = ?')) {
  throw new Error('005 legacy OR lookup still present in active row reader');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero profile first-view UID primary-key read prepared.');

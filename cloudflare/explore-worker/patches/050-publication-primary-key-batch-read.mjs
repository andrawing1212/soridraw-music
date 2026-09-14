import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const MARKER = 'SORIDRAW_PUBLICATION_PK_BATCH_READ_050_20260914';
if (source.includes(MARKER)) {
  console.log('[050] publication primary-key batch read already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_PUBLICATION_INTERNAL_BATCH_049_20260914')) {
  throw new Error('[050] Worker 049 prerequisite missing.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[050] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`[050] unterminated function: ${name}`);
};

const current = functionRange('handleMusicNotePublicationBatch048');
let batch = current.text;
const ownerScan = 'WHERE owner_uid=? AND id IN (';
if ((batch.match(/WHERE owner_uid=\? AND id IN \(/g) || []).length !== 1) {
  throw new Error('[050] expected exactly one owner+id batch read anchor.');
}
batch = batch.replace(ownerScan, 'WHERE id IN (');

const oldBind = `.bind(\n        authContext.uid,\n        ...trackIds,\n      ).all();\n      canonicalRows = rows.results || [];`;
const newBind = `.bind(\n        ...trackIds,\n      ).all();\n      canonicalRows = (rows.results || []).filter(\n        (row) => String(row?.owner_uid || '') === authContext.uid,\n      );`;
if (!batch.includes(oldBind)) throw new Error('[050] canonical batch bind anchor missing.');
batch = batch.replace(oldBind, newBind);

if (!batch.includes("WHERE id=? AND owner_uid=? AND source_type='music_note'")) {
  throw new Error('[050] write ownership guard must remain intact.');
}

source = source.slice(0, current.start) + batch + source.slice(current.end);
source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[050] registered publication batch canonical read now uses track primary keys; owner authorization is validated after read and remains in every UPDATE guard.');

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_REVISION_METADATA_045_20260913';
if (source.includes(MARKER)) {
  console.log('[045] publication revision metadata already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913')) {
  throw new Error('[045] 044 prerequisite missing.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[045] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let line = false;
  let block = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i += 1; continue; }
    if (c === '/' && n === '*') { block = true; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[045] unterminated function: ${name}`);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

replaceFunction('handleMusicNotePublicationRevision044', `async function handleMusicNotePublicationRevision044(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  try {
    if (!env?.PROFILE_MEDIA) {
      return json({ ok: true, data: { revision: null, exists: false, updatedAt: 0 } }, 200, cors);
    }
    const object = await env.PROFILE_MEDIA.head(musicNotePublicationR2Key(authContext.uid));
    if (!object) {
      return json({ ok: true, data: { revision: null, exists: false, updatedAt: 0 } }, 200, cors);
    }
    const revision = String(
      object.httpEtag
      || object.etag
      || object.customMetadata?.updatedAt
      || (object.uploaded && typeof object.uploaded.getTime === 'function' ? object.uploaded.getTime() : '')
      || '',
    );
    const metadataUpdatedAt = Number(object.customMetadata?.updatedAt || 0);
    const uploadedAt = object.uploaded && typeof object.uploaded.getTime === 'function'
      ? Number(object.uploaded.getTime())
      : 0;
    const updatedAt = Math.max(
      Number.isFinite(metadataUpdatedAt) ? metadataUpdatedAt : 0,
      Number.isFinite(uploadedAt) ? uploadedAt : 0,
    );
    return json({ ok: true, data: { revision: revision || null, exists: true, updatedAt } }, 200, cors);
  } catch (error) {
    console.warn('[SORIDRAW 045] publication revision head failed:', String(error?.message || error || 'unknown'));
    return json({ ok: true, data: { revision: null, exists: false, updatedAt: 0 } }, 200, cors);
  }
}`);

// Preserve the exact server-side reason if a canonical visibility mutation fails.
// This does not add retries or alter user data; it only makes future PREVIEW 500s diagnosable.
const privateRange = functionRange('handleMusicNotePrivate017');
const privateCore = 'handleMusicNotePrivate017Core045';
const renamedPrivate = privateRange.text.replace(
  /^async\s+function\s+handleMusicNotePrivate017\(/,
  `async function ${privateCore}(`,
);
if (renamedPrivate === privateRange.text) throw new Error('[045] private handler wrap failed');
const privateWrapper = `async function handleMusicNotePrivate017(...args) {
  try {
    return await ${privateCore}(...args);
  } catch (error) {
    console.error('[SORIDRAW 045] publication visibility mutation failed:', String(error?.message || error || 'unknown'), String(error?.stack || ''));
    throw error;
  }
}`;
source = source.slice(0, privateRange.start) + renamedPrivate + '\n\n' + privateWrapper + source.slice(privateRange.end);

source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[045] publication revision metadata and visibility diagnostics applied.');

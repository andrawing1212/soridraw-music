import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_WRITE_COMPACTION_046_20260913';
if (source.includes(MARKER)) {
  console.log('[046] publication write compaction already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_REVISION_METADATA_045_20260913',
  'handleMusicNotePublicationSingleWrite016',
  'publicationCanonicalUnchanged016',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreProfileR2Publication043',
  'deleteExploreFeedR2Bundles',
  'exploreCacheBucket031',
  'exploreProfileR2Key',
]) {
  if (!source.includes(required)) throw new Error(`[046] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[046] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[046] function body missing: ${name}`);
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
  throw new Error(`[046] unterminated function: ${name}`);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

const wrapAsyncFunction = (name, wrapperTextBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}Core046`;
  const renamed = range.text.replace(
    new RegExp(`^async\\s+function\\s+${name}\\(`),
    `async function ${coreName}(`,
  );
  if (renamed === range.text) throw new Error(`[046] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperTextBuilder(coreName) + source.slice(range.end);
};

const blockRange = (text, start) => {
  const brace = text.indexOf('{', start);
  if (brace < 0) throw new Error('[046] block brace missing');
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
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
    if (char === '}' && --depth === 0) return { start, end: index + 1 };
  }
  throw new Error('[046] unterminated block');
};

// Existing private Music Note rows already contain the full canonical payload.
// Republishing must only touch visibility/ranking timestamps when the payload itself
// has not changed. This avoids rewriting every track column and all related indexes.
{
  const range = functionRange('handleMusicNotePublicationSingleWrite016');
  let text = range.text;
  const unchangedAnchor = 'const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);';
  if (text.split(unchangedAnchor).length - 1 !== 1) throw new Error('[046] unchanged anchor mismatch');
  text = text.replace(
    unchangedAnchor,
    `${unchangedAnchor}\n  const visibilityOnly = Boolean(previous?.id) && publicationCanonicalUnchanged016(\n    { ...previous, is_public: 1, status: 'published' },\n    source,\n    resolvedOptions,\n    primaryGenre,\n  );`,
  );

  const match = /if\s*\(!unchanged\)\s*\{/.exec(text);
  if (!match) throw new Error('[046] publication write block start missing');
  const bounds = blockRange(text, match.index);
  const block = text.slice(bounds.start, bounds.end);
  if (!block.includes('INSERT INTO tracks')) throw new Error('[046] full canonical upsert missing');
  const upsertStart = block.indexOf('await env.DB.prepare(`');
  const runEndToken = ').run();';
  const upsertEnd = block.lastIndexOf(runEndToken);
  if (upsertStart < 0 || upsertEnd < 0) throw new Error('[046] full upsert block parse failed');
  const fullUpsertRaw = block.slice(upsertStart, upsertEnd + runEndToken.length);
  const fullUpsert = fullUpsertRaw
    .split('\n')
    .map((line) => line.replace(/^\s{4}/, ''))
    .join('\n')
    .replace(/^/gm, '      ');
  const compactBlock = `if (!unchanged) {\n    if (visibilityOnly) {\n      await env.DB.prepare(\`\n        UPDATE tracks\n        SET is_public = 1,\n            status = 'published',\n            published_at = ?,\n            updated_at = ?\n        WHERE id = ? AND owner_uid = ?\n      \`).bind(publishedAt, now, source.id, authContext.uid).run();\n    } else {\n${fullUpsert}\n    }\n  }`;
  text = text.slice(0, bounds.start) + compactBlock + text.slice(bounds.end);
  source = source.slice(0, range.start) + text + source.slice(range.end);
}

// 079 removes D1 change-journal fanout for a Music Note visibility transition.
// If the direct R2 patch ever reports a failure, delete only the affected derived
// object so the next request bootstraps from the still-current derived projection.
for (const name of [
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
]) {
  wrapAsyncFunction(name, (coreName) => `async function ${name}(...args) {\n  const result = await ${coreName}(...args);\n  if (result?.ok === false || result?.repairNeeded) {\n    try { await deleteExploreFeedR2Bundles(args[0]); } catch (error) {\n      console.warn('[SORIDRAW 046] feed R2 repair marker failed:', String(error?.message || error || 'unknown'));\n    }\n  }\n  return result;\n}`);
}

wrapAsyncFunction('patchExploreProfileR2Publication043', (coreName) => `async function patchExploreProfileR2Publication043(...args) {\n  const [env, uid] = args;\n  const result = await ${coreName}(...args);\n  if (result?.ok === false || result?.repairNeeded) {\n    try {\n      const bucket = exploreCacheBucket031(env);\n      if (bucket && uid) await bucket.delete(exploreProfileR2Key(String(uid)));\n    } catch (error) {\n      console.warn('[SORIDRAW 046] profile R2 repair marker failed:', String(error?.message || error || 'unknown'));\n    }\n  }\n  return result;\n}`);

const publishText = functionRange('handleMusicNotePublicationSingleWrite016').text;
for (const token of [
  'const visibilityOnly = Boolean(previous?.id)',
  'UPDATE tracks',
  "status = 'published'",
  'INSERT INTO tracks',
]) {
  if (!publishText.includes(token)) throw new Error(`[046] publication compact path missing: ${token}`);
}
if ((publishText.match(/UPDATE tracks/g) || []).length < 1) throw new Error('[046] minimal visibility UPDATE missing');

source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[046] existing-row republish uses a minimal canonical UPDATE and R2 failures self-heal without D1 journal fanout.');

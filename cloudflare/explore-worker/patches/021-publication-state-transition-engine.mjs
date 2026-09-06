import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_STATE_TRANSITION_ENGINE_021_20260907';
if (source.includes(marker)) {
  console.log('[021] publication state transition engine already applied.');
  process.exit(0);
}

// Validate the active runtime shape rather than historical patch comments. Cloudflare
// may preserve the functions while dropping old marker comments during later rebuilds.
for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'handleMusicNotePrivate017',
  'publicationCanonicalUnchanged016',
  'publicationReadState016',
  'patchExploreProfileR2Mutation019',
  'Promise.allSettled',
]) {
  if (!source.includes(required)) throw new Error(`[021] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[021] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[021] function body missing: ${name}`);
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
      const end = source.indexOf('\n', index);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`[021] unterminated function: ${name}`);
};

const replaceFunctionText = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[021] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

async function applyPublicationVisibilityTransition021(env, uid, trackId, isPublic, publishedAt, now, currentStatus) {
  if (isPublic) {
    if (String(currentStatus || '') === 'published') {
      await env.DB.prepare(`
        UPDATE tracks
        SET is_public = 1, published_at = ?, updated_at = ?
        WHERE id = ? AND owner_uid = ?
      `).bind(publishedAt, now, trackId, uid).run();
      return;
    }
    await env.DB.prepare(`
      UPDATE tracks
      SET is_public = 1, status = 'published', published_at = ?, updated_at = ?
      WHERE id = ? AND owner_uid = ?
    `).bind(publishedAt, now, trackId, uid).run();
    return;
  }

  await env.DB.prepare(`
    UPDATE tracks
    SET is_public = 0, updated_at = ?
    WHERE id = ? AND owner_uid = ?
  `).bind(now, trackId, uid).run();
}

const publicationHelperAnchor = 'async function handleMusicNotePublicationSingleWrite016(';
if (!source.includes(publicationHelperAnchor)) throw new Error('[021] publication helper anchor missing');
source = source.replace(
  publicationHelperAnchor,
  `// ${marker}\n${applyPublicationVisibilityTransition021.toString()}\n\n${publicationHelperAnchor}`,
);

replaceFunctionText('handleMusicNotePublicationSingleWrite016', (text) => {
  const unchangedAnchor = '  const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);';
  if (!text.includes(unchangedAnchor)) throw new Error('[021] publish unchanged anchor missing');
  const transitionProbe = `${unchangedAnchor}\n  const visibilityTransitionOnly021 = Boolean(previous?.id)\n    && !unchanged\n    && publicationCanonicalUnchanged016(\n      { ...previous, is_public: 1, status: 'published' },\n      source,\n      resolvedOptions,\n      primaryGenre\n    );`;
  let next = text.replace(unchangedAnchor, transitionProbe);

  const upsertAnchor = '  if (!unchanged) {\n    await env.DB.prepare(`\n      INSERT INTO tracks (';
  if (!next.includes(upsertAnchor)) throw new Error('[021] publish UPSERT anchor missing');
  next = next.replace(
    upsertAnchor,
    `  if (visibilityTransitionOnly021) {\n    await applyPublicationVisibilityTransition021(\n      env,\n      authContext.uid,\n      source.id,\n      true,\n      publishedAt,\n      now,\n      previous?.status\n    );\n  } else if (!unchanged) {\n    await env.DB.prepare(\`\n      INSERT INTO tracks (`,
  );
  return next;
});

replaceFunctionText('handleMusicNotePrivate017', (text) => {
  const directPrivate = `  if (changed) {\n    await env.DB.prepare(\`\n      UPDATE tracks SET is_public = 0, updated_at = ?\n      WHERE id = ? AND owner_uid = ?\n    \`).bind(now, row.id, authContext.uid).run();\n  }`;
  if (!text.includes(directPrivate)) throw new Error('[021] private direct update anchor missing');
  return text.replace(
    directPrivate,
    `  if (changed) {\n    await applyPublicationVisibilityTransition021(\n      env,\n      authContext.uid,\n      row.id,\n      false,\n      null,\n      now,\n      row.status\n    );\n  }`,
  );
});

const publish = functionRange('handleMusicNotePublicationSingleWrite016').text;
const privateHandler = functionRange('handleMusicNotePrivate017').text;
const transition = functionRange('applyPublicationVisibilityTransition021').text;

for (const required of [
  'visibilityTransitionOnly021',
  'publicationCanonicalUnchanged016(',
  'applyPublicationVisibilityTransition021(',
]) {
  if (!publish.includes(required)) throw new Error(`[021] publish invariant missing: ${required}`);
}
if ((publish.match(/INSERT INTO tracks/g) || []).length !== 1) {
  throw new Error('[021] publish full-create UPSERT count changed');
}
if (!privateHandler.includes('applyPublicationVisibilityTransition021(')) {
  throw new Error('[021] private path does not use shared transition engine');
}
if (privateHandler.includes('UPDATE tracks SET is_public = 0')) {
  throw new Error('[021] legacy private direct UPDATE remains');
}
if ((transition.match(/UPDATE tracks/g) || []).length !== 3) {
  throw new Error('[021] transition engine statement branches changed unexpectedly');
}
for (const forbidden of ['SELECT ', 'track_tags', 'track_stats', 'DELETE FROM', 'INSERT INTO']) {
  if (transition.includes(forbidden)) throw new Error(`[021] transition engine forbidden token: ${forbidden}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[021] Public/private Music Note mutations now share one bounded visibility transition engine; re-publication of unchanged payload skips the full UPSERT.');

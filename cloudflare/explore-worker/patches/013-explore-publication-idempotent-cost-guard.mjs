import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PUBLICATION_COST_GUARD_013_20260904';
if (source.includes(marker)) {
  console.log('[013] Explore publication cost guard already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_EXPLORE_PUBLICATION_INCREMENTAL_FEED_SYNC_012_20260904')) {
  throw new Error('[013] patch 012 must be active first.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[013] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[013] unterminated function: ${name}`);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[013] ${label} anchor count=${count}`);
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

const coreAnchor = 'async function handlePublicationR2Core(request, env, cors) {';
if (!source.includes(coreAnchor)) throw new Error('[013] publication core anchor missing');

const helpers = `// ${marker}
async function getOrEnsurePublicationOwnerProfile013(env, authContext, now) {
  const existing = await env.DB.prepare(\`
    SELECT uid, nickname, avatar_url, is_public
    FROM public_profiles
    WHERE uid = ?
    LIMIT 1
  \`).bind(authContext.uid).first();
  if (existing && Number(existing.is_public || 0) === 1) {
    return {
      uid: authContext.uid,
      nickname: existing.nickname || authContext.displayName || "",
      avatarUrl: existing.avatar_url || authContext.picture || ""
    };
  }
  return await upsertPublicProfileFromFirebase(env, authContext, now);
}

function publicationSearchChanged013(previous, source) {
  if (!previous) return true;
  if (Number(previous.is_public || 0) !== 1 || String(previous.status || "") !== "published") return true;
  return String(previous.search_text || "") !== String(source.searchText || "")
    || String(previous.title || "") !== String(source.title || "");
}

async function refreshPublicationTrackSearchIndex013(env, source) {
  const tags = Array.isArray(source?.tags) ? source.tags : [];
  const values = (kind) => tags
    .filter((tag) => String(tag?.kind || "") === kind)
    .map((tag) => String(tag?.value || "").trim())
    .filter(Boolean)
    .join(" ");
  const allTags = tags.map((tag) => String(tag?.value || "").trim()).filter(Boolean).join(" ");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM track_search_fts WHERE track_id = ?").bind(source.id),
    env.DB.prepare(\`
      INSERT INTO track_search_fts (track_id, title, genre, style, mood, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    \`).bind(
      source.id,
      String(source.title || ""),
      values("genre"),
      values("style"),
      values("mood"),
      allTags
    )
  ]);
}

`;
source = source.replace(coreAnchor, helpers + coreAnchor);

replaceOnceInFunction(
  'handlePublicationR2Core',
  '    SELECT is_public, status FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
  '    SELECT is_public, status, search_text, title FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
  'previous publication search metadata',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  '  await upsertPublicProfileFromFirebase(env, authContext, now);',
  '  await getOrEnsurePublicationOwnerProfile013(env, authContext, now);',
  'avoid redundant profile upsert/index rebuild',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  `    env.DB.prepare(\`\n      INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)\n      VALUES (?, 0, 0, 0, ?)\n      ON CONFLICT(track_id) DO NOTHING\n    \`).bind(source.id, now),\n    env.DB.prepare("DELETE FROM track_tags WHERE track_id = ?").bind(source.id)\n  ];\n  for (const tag of source.tags) {\n    statements.push(\n      env.DB.prepare(\`\n        INSERT OR IGNORE INTO track_tags (track_id, kind, value, created_at)\n        VALUES (?, ?, ?, ?)\n      \`).bind(source.id, tag.kind, tag.value, now)\n    );\n  }`,
  `    env.DB.prepare(\`\n      INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)\n      VALUES (?, 0, 0, 0, ?)\n      ON CONFLICT(track_id) DO NOTHING\n    \`).bind(source.id, now)\n  ];\n  const publicationSearchChanged = publicationSearchChanged013(previousFirstViewTrack, source);\n  if (publicationSearchChanged) {\n    statements.push(env.DB.prepare("DELETE FROM track_tags WHERE track_id = ?").bind(source.id));\n    for (const tag of source.tags) {\n      statements.push(\n        env.DB.prepare(\`\n          INSERT OR IGNORE INTO track_tags (track_id, kind, value, created_at)\n          VALUES (?, ?, ?, ?)\n        \`).bind(source.id, tag.kind, tag.value, now)\n      );\n    }\n  }`,
  'skip identical tag rewrites',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  '  await refreshTrackSearchIndex(env, source.id);',
  '  // Search indexing is performed after the publication-visible R2 state is committed.\n  // It is also guarded so an FTS problem can never turn an already-written publication into HTTP 500.',
  'remove blocking FTS refresh',
);

const returnAnchor = `  return json(\n    {\n      ok: true,`;
const safeIndexBlock = `  if (publicationSearchChanged) {\n    try {\n      await refreshPublicationTrackSearchIndex013(env, source);\n    } catch (error) {\n      console.warn("[SORIDRAW publication search] FTS refresh skipped after successful publication:", String(error?.message || error || "unknown"));\n    }\n  }\n\n${returnAnchor}`;
replaceOnceInFunction(
  'handlePublicationR2Core',
  returnAnchor,
  safeIndexBlock,
  'safe post-publication search refresh',
);

const finalCore = functionRange('handlePublicationR2Core').text;
for (const required of [
  'getOrEnsurePublicationOwnerProfile013',
  'publicationSearchChanged013',
  'refreshPublicationTrackSearchIndex013',
  'await syncExploreFeedR2Publication012(env, publicationFeedItem);',
  'FTS refresh skipped after successful publication',
]) {
  if (!source.includes(required)) throw new Error(`[013] missing required patch token: ${required}`);
}
if (finalCore.includes('await refreshTrackSearchIndex(env, source.id);')) throw new Error('[013] blocking legacy FTS refresh still present');

writeFileSync(workerPath, source, 'utf8');
console.log('[013] Publication hot path now reuses existing profile state, skips identical tag rewrites, publishes R2 before search indexing, and prevents FTS failures from returning HTTP 500.');

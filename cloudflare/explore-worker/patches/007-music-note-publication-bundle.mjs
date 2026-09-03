import fs from 'node:fs';

const path = '.remote-worker/worker.js';
let src = fs.readFileSync(path, 'utf8');
const MARKER = 'SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_20260904';
const migrationSql = fs.readFileSync('migrations/20260904_music_note_publication_bundle.sql', 'utf8');

if (src.includes(MARKER)) {
  console.log('[007] music-note publication bundle patch already applied');
  process.exit(0);
}

const handlerRegex = /(?:async\s+)?function\s+handleMyPublications\s*\([^)]*\)\s*\{/;
const handlerMatch = src.match(handlerRegex);
if (!handlerMatch) throw new Error('[007] handleMyPublications function anchor not found');

const handler = `// ${MARKER}\nconst SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_SQL = ${JSON.stringify(migrationSql)};\n\nasync function bootstrapMusicNotePublicationBundles(request, env, cors) {\n  const provided = String(request.headers.get('X-SORIDRAW-Bootstrap-Token') || '').trim();\n  const expected = String(env.BOOTSTRAP_TOKEN || '').trim();\n  if (!expected || !provided || provided !== expected) {\n    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403, cors);\n  }\n  await env.DB.exec(SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_SQL);\n  const parity = await env.DB.prepare(\`\n    SELECT\n      (SELECT COUNT(DISTINCT owner_uid) FROM tracks WHERE owner_uid IS NOT NULL AND owner_uid <> '') AS canonical_owners,\n      (SELECT COUNT(*) FROM music_note_publication_bundles) AS bundle_owners,\n      (SELECT COUNT(*) FROM tracks WHERE source_type='music_note' AND source_id IS NOT NULL AND source_id <> '') AS canonical_music_notes,\n      (SELECT COALESCE(SUM(item_count),0) FROM music_note_publication_bundles) AS bundled_music_notes,\n      (SELECT COUNT(*) FROM music_note_publication_bundles b WHERE json_valid(b.states_json)=0 OR b.item_count<>(SELECT COUNT(*) FROM json_each(b.states_json))) AS invalid_bundles\n  \`).first();\n  return json({ ok: true, data: parity || {} }, 200, cors);\n}\n\nasync function handleMusicNotePublicationBundle(request, env, cors) {\n  const authContext = await requireExploreAuth(request);\n  const row = await env.DB.prepare(\`\n    SELECT schema_version, states_json, item_count, updated_at\n    FROM music_note_publication_bundles\n    WHERE owner_uid = ?\n    LIMIT 1\n  \`).bind(authContext.uid).first();\n\n  if (!row) {\n    return json({ ok: true, data: { schemaVersion: 1, states: {}, itemCount: 0, updatedAt: 0 } }, 200, cors);\n  }\n\n  let states = null;\n  try { states = JSON.parse(String(row.states_json || '{}')); } catch {}\n  const isValid = Number(row.schema_version || 0) === 1\n    && states && typeof states === 'object' && !Array.isArray(states)\n    && Number(row.item_count || 0) === Object.keys(states).length;\n  if (!isValid) {\n    return json({ ok: false, error: { code: 'MUSIC_NOTE_PUBLICATION_BUNDLE_INVALID', message: 'Publication bundle is invalid.' } }, 503, cors);\n  }\n  return json({ ok: true, data: { schemaVersion: 1, states, itemCount: Number(row.item_count || 0), updatedAt: Number(row.updated_at || 0) } }, 200, cors);\n}\n\n`;

src = src.replace(handlerRegex, handler + handlerMatch[0]);

const routeStartRegex = /if\s*\(\s*url\.pathname\s*===\s*['"]\/v1\/me\/publications['"]\s*&&\s*request\.method\s*===\s*['"]GET['"]\s*\)\s*\{/;
const routeMatch = src.match(routeStartRegex);
if (!routeMatch) throw new Error('[007] /v1/me/publications route start not found');

const route = `if (url.pathname === "/v1/internal/bootstrap-music-note-publication-bundles" && request.method === "POST") {\n      return await bootstrapMusicNotePublicationBundles(request, env, cors);\n    }\n    if (url.pathname === "/v1/me/music-note-publications-bundle" && request.method === "GET") {\n      return await handleMusicNotePublicationBundle(request, env, cors);\n    }\n    `;
src = src.replace(routeStartRegex, route + routeMatch[0]);

if (!src.includes('/v1/me/music-note-publications-bundle')) throw new Error('[007] bundle route missing after patch');
if (!src.includes('/v1/internal/bootstrap-music-note-publication-bundles')) throw new Error('[007] bootstrap route missing after patch');
if ((src.match(new RegExp(MARKER, 'g')) || []).length !== 1) throw new Error('[007] marker count mismatch');

fs.writeFileSync(path, src, 'utf8');
console.log('[007] one-row publication bundle + protected bootstrap endpoint applied');

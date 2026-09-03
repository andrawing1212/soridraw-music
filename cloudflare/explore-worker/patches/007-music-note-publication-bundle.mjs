import fs from 'node:fs';

const path = '.remote-worker/worker.js';
let src = fs.readFileSync(path, 'utf8');
const MARKER = 'SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_20260904';

if (src.includes(MARKER)) {
  console.log('[007] music-note publication bundle patch already applied');
  process.exit(0);
}

const handlerRegex = /(?:async\s+)?function\s+handleMyPublications\s*\([^)]*\)\s*\{/;
const handlerMatch = src.match(handlerRegex);
if (!handlerMatch) throw new Error('[007] handleMyPublications function anchor not found');

const handler = `// ${MARKER}\nasync function handleMusicNotePublicationBundle(request, env, cors) {\n  const authContext = await requireExploreAuth(request);\n  const row = await env.DB.prepare(\`\n    SELECT schema_version, states_json, item_count, updated_at\n    FROM music_note_publication_bundles\n    WHERE owner_uid = ?\n    LIMIT 1\n  \`).bind(authContext.uid).first();\n\n  // The deployment migration seeds every existing track owner. A missing row after\n  // that point means this user has no canonical Explore tracks yet, so an empty\n  // bundle is authoritative and avoids a legacy owner-wide scan.\n  if (!row) {\n    return json({ ok: true, data: { schemaVersion: 1, states: {}, itemCount: 0, updatedAt: 0 } }, 200, cors);\n  }\n\n  let states = null;\n  try {\n    states = JSON.parse(String(row.states_json || '{}'));\n  } catch {}\n\n  const isValid = Number(row.schema_version || 0) === 1\n    && states\n    && typeof states === 'object'\n    && !Array.isArray(states)\n    && Number(row.item_count || 0) === Object.keys(states).length;\n\n  if (!isValid) {\n    return json({ ok: false, error: { code: 'MUSIC_NOTE_PUBLICATION_BUNDLE_INVALID', message: 'Publication bundle is invalid.' } }, 503, cors);\n  }\n\n  return json({\n    ok: true,\n    data: {\n      schemaVersion: 1,\n      states,\n      itemCount: Number(row.item_count || 0),\n      updatedAt: Number(row.updated_at || 0),\n    },\n  }, 200, cors);\n}\n\n`;

src = src.replace(handlerRegex, handler + handlerMatch[0]);

const routeStartRegex = /if\s*\(\s*url\.pathname\s*===\s*['"]\/v1\/me\/publications['"]\s*&&\s*request\.method\s*===\s*['"]GET['"]\s*\)\s*\{/;
const routeMatch = src.match(routeStartRegex);
if (!routeMatch) throw new Error('[007] /v1/me/publications route start not found');

const route = `if (url.pathname === "/v1/me/music-note-publications-bundle" && request.method === "GET") {\n      return await handleMusicNotePublicationBundle(request, env, cors);\n    }\n    `;
src = src.replace(routeStartRegex, route + routeMatch[0]);

if (!src.includes('/v1/me/music-note-publications-bundle')) throw new Error('[007] bundle route missing after patch');
if ((src.match(new RegExp(MARKER, 'g')) || []).length !== 1) throw new Error('[007] marker count mismatch');

fs.writeFileSync(path, src, 'utf8');
console.log('[007] one-row music-note publication bundle endpoint applied');

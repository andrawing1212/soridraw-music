import fs from 'node:fs';

const path = '.remote-worker/worker.js';
let src = fs.readFileSync(path, 'utf8');
const MARKER = 'SORIDRAW_MUSIC_NOTE_PUBLICATION_R2_BUNDLE_20260904';
const seedPath = String(process.env.SORIDRAW_PUBLICATION_SEED_PATH || '').trim();

if (src.includes(MARKER)) {
  console.log('[008] publication R2 bundle patch already applied');
  process.exit(0);
}

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`[008] ${label} anchor count=${count}`);
  return text.replace(before, after);
}

function functionRange(text, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(text);
  if (!m) throw new Error(`[008] function missing: ${name}`);
  let i = m.index + m[0].length;
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && n === '/') { const e = text.indexOf('\n', i); i = e < 0 ? text.length : e; continue; }
    if (c === '/' && n === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 1; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start: m.index, end: i + 1, text: text.slice(m.index, i + 1) };
  }
  throw new Error(`[008] unterminated function: ${name}`);
}

function transformFunction(text, name, transform) {
  const r = functionRange(text, name);
  const next = transform(r.text);
  if (next === r.text) throw new Error(`[008] ${name} transform made no change`);
  return text.slice(0, r.start) + next + text.slice(r.end);
}

const helperAnchor = /async function handleMyPublications\s*\(request,\s*url,\s*env,\s*cors\)\s*\{/;
const helperMatch = src.match(helperAnchor);
if (!helperMatch) throw new Error('[008] handleMyPublications anchor missing');

const seedHandler = seedPath ? `\nasync function seedMusicNotePublicationR2Bundles(env, cors) {\n  const ownersResult = await env.DB.prepare(\`\n    SELECT DISTINCT owner_uid\n    FROM tracks\n    WHERE source_type = 'music_note' AND owner_uid IS NOT NULL AND owner_uid <> ''\n  \`).all();\n  const owners = (ownersResult.results || []).map((row) => String(row.owner_uid || '').trim()).filter(Boolean);\n  let seeded = 0;\n  for (const uid of owners) {\n    await writeMusicNotePublicationR2Payload(env, uid, await buildMusicNotePublicationR2Payload(env, uid));\n    seeded += 1;\n  }\n  return json({ ok: true, data: { seededOwners: seeded } }, 200, cors);\n}\n` : '';

const helpers = `// ${MARKER}\nconst MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION = 1;\n\nfunction musicNotePublicationR2Key(uid) {\n  return \`derived/music-note-publications/v1/\${encodeURIComponent(String(uid || ''))}.json\`;\n}\n\nfunction normalizeMusicNotePublicationR2Payload(value) {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;\n  const states = value.states;\n  if (!states || typeof states !== 'object' || Array.isArray(states)) return null;\n  const entries = Object.entries(states);\n  if (Number(value.schemaVersion || 0) !== MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION) return null;\n  if (Number(value.itemCount ?? -1) !== entries.length) return null;\n  for (const [sourceId, state] of entries) {\n    if (!String(sourceId || '').trim() || !state || typeof state !== 'object' || Array.isArray(state) || !String(state.trackId || '').trim()) return null;\n  }\n  return { schemaVersion: MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION, states, itemCount: entries.length, updatedAt: Number(value.updatedAt || 0) };\n}\n\nasync function readMusicNotePublicationR2Payload(env, uid) {\n  try {\n    const object = await env.PROFILE_MEDIA.get(musicNotePublicationR2Key(uid));\n    if (!object) return null;\n    return normalizeMusicNotePublicationR2Payload(JSON.parse(await object.text()));\n  } catch (error) {\n    console.error('music-note publication R2 read failed', error);\n    return null;\n  }\n}\n\nasync function buildMusicNotePublicationR2Payload(env, uid) {\n  const result = await env.DB.prepare(\`\n    SELECT id, source_id, is_public, allow_next_song_apply, allow_follower_save, profile_pinned\n    FROM tracks\n    WHERE owner_uid = ?\n      AND source_type = 'music_note'\n      AND source_id IS NOT NULL\n      AND source_id <> ''\n  \`).bind(uid).all();\n  const states = {};\n  for (const row of result.results || []) {\n    const sourceId = String(row.source_id || '').trim();\n    const trackId = String(row.id || '').trim();\n    if (!sourceId || !trackId) continue;\n    states[sourceId] = {\n      status: Number(row.is_public || 0) === 1 ? 'public' : 'private',\n      trackId,\n      allowNextSongApply: Number(row.allow_next_song_apply || 0) === 1,\n      allowFollowerSave: Number(row.allow_follower_save || 0) === 1,\n      profilePinned: Number(row.profile_pinned || 0) === 1\n    };\n  }\n  return { schemaVersion: MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION, states, itemCount: Object.keys(states).length, updatedAt: Date.now() };\n}\n\nasync function writeMusicNotePublicationR2Payload(env, uid, payload) {\n  await env.PROFILE_MEDIA.put(musicNotePublicationR2Key(uid), JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });\n  return payload;\n}\n\nasync function syncMusicNotePublicationR2AfterMutation(env, uid, sourceId, nextState) {\n  try {\n    const normalizedSourceId = String(sourceId || '').trim();\n    if (!normalizedSourceId || !nextState || !String(nextState.trackId || '').trim()) return;\n    let payload = await readMusicNotePublicationR2Payload(env, uid);\n    if (!payload) payload = await buildMusicNotePublicationR2Payload(env, uid);\n    const states = { ...payload.states, [normalizedSourceId]: nextState };\n    await writeMusicNotePublicationR2Payload(env, uid, {\n      schemaVersion: MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION,\n      states,\n      itemCount: Object.keys(states).length,\n      updatedAt: Date.now()\n    });\n  } catch (error) {\n    console.error('music-note publication R2 sync failed', error);\n  }\n}\n\nasync function handleMusicNotePublicationR2Bundle(request, env, cors) {\n  const authContext = await requireExploreAuth(request);\n  const cached = await readMusicNotePublicationR2Payload(env, authContext.uid);\n  if (cached) return json({ ok: true, data: cached }, 200, cors);\n  // Read-only recovery: page entry never writes. Existing owners are seeded at deploy,\n  // and later real mutations repair a missing/corrupt derived object.\n  const recovered = await buildMusicNotePublicationR2Payload(env, authContext.uid);\n  return json({ ok: true, data: recovered, recovery: true }, 200, cors);\n}\n${seedHandler}\n`;

src = src.replace(helperAnchor, helpers + helperMatch[0]);

src = transformFunction(src, 'handlePublication', (text) => replaceOnce(
  text,
  '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(',
  '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  if (source.sourceType === "music_note") {\n    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, source.sourceId, {\n      status: "public",\n      trackId: source.id,\n      allowNextSongApply: Number(storedOptions?.allow_next_song_apply || 0) === 1,\n      allowFollowerSave: Number(storedOptions?.allow_follower_save || 0) === 1,\n      profilePinned: Number(storedOptions?.profile_pinned || 0) === 1\n    });\n  }\n  return json(',
  'handlePublication sync',
));

src = transformFunction(src, 'handleVisibility', (text) => {
  let next = replaceOnce(
    text,
    '    SELECT is_public, status FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
    '    SELECT source_type, source_id, is_public, status, allow_next_song_apply, allow_follower_save, profile_pinned FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
    'handleVisibility source select',
  );
  next = replaceOnce(
    next,
    '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(',
    '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  if (String(previousFirstViewTrack?.source_type || "") === "music_note") {\n    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, previousFirstViewTrack?.source_id, {\n      status: body.isPublic ? "public" : "private",\n      trackId,\n      allowNextSongApply: Number(previousFirstViewTrack?.allow_next_song_apply || 0) === 1,\n      allowFollowerSave: Number(previousFirstViewTrack?.allow_follower_save || 0) === 1,\n      profilePinned: Number(previousFirstViewTrack?.profile_pinned || 0) === 1\n    });\n  }\n  return json(',
    'handleVisibility sync',
  );
  return next;
});

src = transformFunction(src, 'handlePublicationOptions', (text) => {
  let next = replaceOnce(
    text,
    '    SELECT allow_next_song_apply, allow_follower_save, profile_pinned',
    '    SELECT source_type, source_id, is_public, allow_next_song_apply, allow_follower_save, profile_pinned',
    'handlePublicationOptions source select',
  );
  next = replaceOnce(
    next,
    '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(',
    '  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  if (String(row?.source_type || "") === "music_note") {\n    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row?.source_id, {\n      status: Number(row?.is_public || 0) === 1 ? "public" : "private",\n      trackId,\n      allowNextSongApply: Number(row?.allow_next_song_apply || 0) === 1,\n      allowFollowerSave: Number(row?.allow_follower_save || 0) === 1,\n      profilePinned: Number(row?.profile_pinned || 0) === 1\n    });\n  }\n  return json(',
    'handlePublicationOptions sync',
  );
  return next;
});

const routeAnchor = '    if (url.pathname === "/v1/me/publications" && request.method === "GET") {';
if (!src.includes(routeAnchor)) throw new Error('[008] /v1/me/publications route anchor missing');
const seedRoute = seedPath ? `    if (url.pathname === ${JSON.stringify(seedPath)} && request.method === "POST") {\n      return await seedMusicNotePublicationR2Bundles(env, cors);\n    }\n` : '';
const bundleRoute = `    if (url.pathname === "/v1/me/music-note-publications-bundle" && request.method === "GET") {\n      return await handleMusicNotePublicationR2Bundle(request, env, cors);\n    }\n`;
src = src.replace(routeAnchor, seedRoute + bundleRoute + routeAnchor);

if (!src.includes('/v1/me/music-note-publications-bundle')) throw new Error('[008] bundle route missing after patch');
if (seedPath && !src.includes(seedPath)) throw new Error('[008] seed route missing');
if (!seedPath && src.includes('seedMusicNotePublicationR2Bundles(env, cors)')) throw new Error('[008] seed route leaked into final Worker');
if ((src.match(new RegExp(MARKER, 'g')) || []).length !== 1) throw new Error('[008] marker count mismatch');

fs.writeFileSync(path, src, 'utf8');
console.log(`[008] music-note publication R2 bundle applied mode=${seedPath ? 'seed' : 'final'}`);

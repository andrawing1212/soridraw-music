import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_SINGLE_R2_BUNDLE_014_20260905';
if (source.includes(marker)) {
  console.log('[014] publication single R2 bundle cleanup already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[014] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[014] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`[014] unterminated function: ${name}`);
};

const hasFunction = (name) => source.includes(`async function ${name}(`) || source.includes(`function ${name}(`);
const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'handleMusicNotePublicationR2Bundle',
  'syncMusicNotePublicationR2AfterMutation',
  'readMusicNotePublicationR2Payload',
  'writeMusicNotePublicationR2Payload',
  'buildMusicNotePublicationR2Payload',
]) {
  if (!source.includes(required)) throw new Error(`[014] required publication bundle helper missing: ${required}`);
}

// Some historical Worker versions also contain the older D1 bundle helper/route.
// If present, collapse it into the R2 implementation. Current PREVIEW may already
// have only the R2 route, which is the desired state and must remain supported.
if (hasFunction('handleMusicNotePublicationBundle')) {
  replaceFunction('handleMusicNotePublicationBundle', `async function handleMusicNotePublicationBundle(request, env, cors) {
  return await handleMusicNotePublicationR2Bundle(request, env, cors);
}`);

  const legacyRoutePattern = /\n\s*if\s*\(url\.pathname\s*===\s*["']\/v1\/me\/music-note-publications-bundle["']\s*&&\s*request\.method\s*===\s*["']GET["']\s*\)\s*\{\s*return\s+await\s+handleMusicNotePublicationBundle\(request,\s*env,\s*cors\);\s*\}/g;
  const legacyRouteMatches = source.match(legacyRoutePattern) || [];
  if (legacyRouteMatches.length > 1) {
    throw new Error(`[014] duplicate legacy D1 publication bundle routes count=${legacyRouteMatches.length}`);
  }
  if (legacyRouteMatches.length === 1) source = source.replace(legacyRoutePattern, '');
}

// Mutation hot path must never rebuild every music-note row for the owner.
// A missing R2 object is a repair condition, not permission to issue an owner-wide
// D1 scan from a user's publish/visibility/options request.
replaceFunction('syncMusicNotePublicationR2AfterMutation', `async function syncMusicNotePublicationR2AfterMutation(env, uid, sourceId, nextState) {
  try {
    const normalizedUid = String(uid || "").trim();
    const normalizedSourceId = String(sourceId || "").trim();
    const trackId = String(nextState?.trackId || "").trim();
    if (!normalizedUid || !normalizedSourceId || !trackId) return { ok: false, skipped: true };

    const payload = await readMusicNotePublicationR2Payload(env, normalizedUid);
    if (!payload) {
      console.warn("[SORIDRAW publication bundle] R2 bundle missing during mutation; owner-wide D1 rebuild blocked. Run seed/repair outside the mutation path.", normalizedUid);
      return { ok: false, repairNeeded: true };
    }

    const states = { ...payload.states, [normalizedSourceId]: nextState };
    await writeMusicNotePublicationR2Payload(env, normalizedUid, {
      schemaVersion: MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION,
      states,
      itemCount: Object.keys(states).length,
      updatedAt: Date.now()
    });
    return { ok: true, repairNeeded: false };
  } catch (error) {
    console.warn("[SORIDRAW publication bundle] delta sync failed after canonical mutation:", String(error?.message || error || "unknown"));
    return { ok: false, repairNeeded: true };
  }
}`);

const finalMutationSync = functionRange('syncMusicNotePublicationR2AfterMutation').text;
if (finalMutationSync.includes('buildMusicNotePublicationR2Payload')) {
  throw new Error('[014] owner-wide D1 bundle rebuild still exists in mutation sync');
}
const publicRouteCount = (source.match(/url\.pathname\s*===\s*["']\/v1\/me\/music-note-publications-bundle["']/g) || []).length;
if (publicRouteCount !== 1) {
  throw new Error(`[014] publication bundle public route count=${publicRouteCount}`);
}
if (!source.includes('handleMusicNotePublicationR2Bundle(request, env, cors)')) {
  throw new Error('[014] R2 publication bundle route is not active');
}

const markerAnchor = functionRange('syncMusicNotePublicationR2AfterMutation').start;
source = source.slice(0, markerAnchor) + `// ${marker}\n` + source.slice(markerAnchor);

writeFileSync(workerPath, source, 'utf8');
console.log('[014] Publication bundle has one R2-backed route, and mutation cache misses cannot trigger owner-wide D1 rebuilds.');

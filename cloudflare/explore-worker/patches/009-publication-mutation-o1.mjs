import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_PUBLICATION_MUTATION_O1_009';
if (source.includes(marker)) {
  console.log('[009] already applied');
  process.exit(0);
}

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`009 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
    }
  }
  throw new Error(`009 unterminated: ${name}`);
};

const replaceFunction = (name, text) => {
  const r = functionRange(name);
  source = source.slice(0, r.start) + text + source.slice(r.end);
};

const helperAnchor = 'async function refreshPublicProfileFirstViewTrackWindow(env, uid, trackCountDelta = 0) {';
if (!source.includes(helperAnchor)) throw new Error('009 first-view helper missing');
const helper = `// ${marker}\nasync function readLatestOwnerTrackForFirstViewMutation(env, uid) {\n  return await env.DB.prepare(\`\n    SELECT t.*, p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,\n      COALESCE(s.like_count,0) AS like_count,\n      COALESCE(s.comment_count,0) AS comment_count,\n      COALESCE(s.play_count,0) AS play_count\n    FROM tracks t\n    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1\n    LEFT JOIN track_stats s ON s.track_id = t.id\n    WHERE t.owner_uid = ?\n    ORDER BY COALESCE(t.updated_at, t.published_at, t.created_at, 0) DESC, t.id DESC\n    LIMIT 1\n  \`).bind(uid).first();\n}\n\nasync function syncExploreFeedR2PublicVisibility1028(env, trackId) {\n  try {\n    const row = await env.DB.prepare(\`\n      SELECT t.*, p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,\n        COALESCE(s.like_count,0) AS like_count,\n        COALESCE(s.comment_count,0) AS comment_count,\n        COALESCE(s.play_count,0) AS play_count\n      FROM tracks t\n      LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1\n      LEFT JOIN track_stats s ON s.track_id = t.id\n      WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published'\n      LIMIT 1\n    \`).bind(trackId).first();\n    if (!row) {\n      await syncExploreFeedR2Private017(env, trackId);\n      return;\n    }\n    await syncExploreFeedR2Publication012(env, mapTrackRow(row));\n  } catch (error) {\n    console.warn('[SORIDRAW visibility] bounded feed delta skipped:', String(error?.message || error || 'unknown'));\n  }\n}\n\nfunction sortPublicProfileFirstViewMutationItems(items) {\n  return [...items].sort((a, b) => {\n    const pin = Number(b?.profilePinned || 0) - Number(a?.profilePinned || 0);\n    if (pin) return pin;\n    const published = Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0);\n    if (published) return published;\n    return String(b?.id || '').localeCompare(String(a?.id || ''));\n  });\n}\n\n`;
source = source.replace(helperAnchor, helper + helperAnchor, 1);

// A visibility write must patch the already-materialized first-view snapshot from
// one changed/latest track, never rebuild a 51-row window.
replaceFunction('refreshPublicProfileFirstViewTrackWindow', `async function refreshPublicProfileFirstViewTrackWindow(env, uid, trackCountDelta = 0) {
  try {
    const stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));
    if (!stored) return [];
    const latest = await readLatestOwnerTrackForFirstViewMutation(env, uid);
    let items = Array.isArray(stored.items) ? stored.items : [];
    if (latest?.id) {
      const changedId = String(latest.id);
      items = items.filter((item) => String(item?.id || '') !== changedId);
      if (Number(latest.is_public || 0) === 1 && String(latest.status || '') === 'published') {
        items.push(mapTrackRow(latest));
      }
    }
    const sorted = sortPublicProfileFirstViewMutationItems(items);
    const visible = sorted.slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);
    const nextTrackCount = Math.max(0, Number(stored.profile?.trackCount || 0) + Number(trackCountDelta || 0));
    const last = visible[visible.length - 1];
    const nextCursor = (stored.nextCursor || sorted.length > PUBLIC_PROFILE_FIRST_VIEW_LIMIT) && last
      ? encodeCursor({
          profilePinned: Number(last.profilePinned || 0),
          publishedAt: Number(last.publishedAt || 0),
          id: String(last.id || '')
        })
      : null;
    await writePublicProfileFirstViewSnapshot(
      env,
      uid,
      stored.row.handle,
      { ...stored.snapshot, profile: { ...stored.profile, trackCount: nextTrackCount }, items: visible },
      nextCursor,
      Date.now()
    );
    return [uid, stored.row.handle].filter(Boolean);
  } catch (error) {
    console.warn('[SORIDRAW first-view] O(1) mutation patch skipped:', String(error?.message || error || 'unknown'));
    return [];
  }
}`);

replaceFunction('refreshOrPrebuildPublicProfileTrackWindow', `async function refreshOrPrebuildPublicProfileTrackWindow(env, uid, trackCountDelta = 0) {
  const stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));
  if (!stored) return [];
  return await refreshPublicProfileFirstViewTrackWindow(env, uid, trackCountDelta);
}`);

// The current Music Note private path already patches feed/profile/publication R2
// incrementally. The old outer wrapper then rebuilt latest+popular from D1 anyway;
// remove that redundant full-feed rebuild.
replaceFunction('handleVisibility', `async function handleVisibility(request, env, cors, ...args) {
  return await handleVisibilityR2Core(request, env, cors, ...args);
}`);

// Public/non-Music-Note visibility still uses the legacy core. Patch its feed
// bundle incrementally from one exact track row; private removes by id from R2.
{
  const r = functionRange('handleVisibilityR2CoreLegacy017');
  const anchor = '  await refreshTrackSearchIndex(env, trackId);';
  if (!r.text.includes(anchor)) throw new Error('009 legacy visibility search-index anchor missing');
  const patched = r.text.replace(
    anchor,
    `${anchor}\n  if (body.isPublic) await syncExploreFeedR2PublicVisibility1028(env, trackId);\n  else await syncExploreFeedR2Private017(env, trackId);`,
  );
  source = source.slice(0, r.start) + patched + source.slice(r.end);
}

// Static cost contracts.
const wrapper = functionRange('handleVisibility').text;
if (wrapper.includes('safelyRefreshExploreFeedR2Bundles')) throw new Error('009 visibility still rebuilds whole feed');
const legacy = functionRange('handleVisibilityR2CoreLegacy017').text;
if (!legacy.includes('syncExploreFeedR2PublicVisibility1028') || !legacy.includes('syncExploreFeedR2Private017')) {
  throw new Error('009 bounded visibility feed delta missing');
}
const refreshText = functionRange('refreshPublicProfileFirstViewTrackWindow').text;
if (refreshText.includes('readPublicProfileFirstViewTrackWindow')) throw new Error('009 full 51-row refresh remains');
const prebuildText = functionRange('refreshOrPrebuildPublicProfileTrackWindow').text;
if (prebuildText.includes('readOrMaterializePublicProfileFirstView') || prebuildText.includes('prebuildPublicProfileFirstViewIfMissing')) {
  throw new Error('009 mutation can still materialize full first-view snapshot');
}
const publicationSync = functionRange('syncMusicNotePublicationR2AfterMutation').text;
if (publicationSync.includes('buildMusicNotePublicationR2Payload')) throw new Error('009 publication mutation can full-scan tracks');

writeFileSync(workerPath, source, 'utf8');
console.log('PUBLICATION_MUTATION_O1_009=PASS');

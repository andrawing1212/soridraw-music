import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_SOCIAL_R2_PARITY_061_20260917';
if (source.includes(marker)) {
  console.log('[061] shared personal social parity already applied.');
  process.exit(0);
}

for (const required of [
  'readExploreLikeR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'syncExploreLikeR2AfterBatch034',
  'readExploreFollowingR2Bundle',
  'rebuildExploreFollowingR2Bundle',
  'syncExploreFollowingR2AfterMutation',
  'exploreLikeR2Key',
  'exploreFollowingR2Key',
  'writeExploreR2Json',
  'handleMySocialSnapshot042',
  'handleMyLikedTracks052',
  'handleMyLikeStates',
  'handleMyLikeStatesD1Core',
]) {
  if (!source.includes(required)) throw new Error(`[061] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[061] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[061] function body missing: ${name}`);
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
  throw new Error(`[061] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^async\\s+function\\s+${name}\\(`), `async function ${coreName}(`);
  if (renamed === range.text) throw new Error(`[061] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const helperAnchor = functionRange('readExploreLikeR2Bundle').start;
const helpers = `// ${marker}\nconst EXPLORE_SHARED_SOCIAL_VERSION_061 = 114;\nconst exploreSharedLikesKey061 = (uid) => \`internal/explore/shared-social-v114/likes/\${encodeURIComponent(String(uid || '').trim())}.json\`;\nconst exploreSharedFollowingKey061 = (uid) => \`internal/explore/shared-social-v114/following/\${encodeURIComponent(String(uid || '').trim())}.json\`;\n\nfunction exploreSharedSocialEnvironment061(env) {\n  return String(env?.SORIDRAW_ENVIRONMENT || env?.ENV_NAME || '').trim().toLowerCase();\n}\n\nasync function readSharedSocialJson061(env, key) {\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!bucket) return null;\n  const object = await bucket.get(key);\n  if (!object) return null;\n  try { return JSON.parse(await object.text()); } catch { return null; }\n}\n\nasync function writeSharedLikes061(env, uid, likedIds) {\n  const normalized = String(uid || '').trim();\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!normalized || !bucket || !likedIds) return false;\n  // 156 exact snapshots are owned by the post-canonical publisher. Legacy\n  // 061/034/044 mirror paths are capped at 2,000 and must never truncate an\n  // exact >2,000 canonical snapshot after cutover. New exact writes bypass\n  // this helper and use the fenced 139/141/156 path.\n  const existing = await readSharedSocialJson061(env, exploreSharedLikesKey061(normalized));\n  if (existing?.canonicalComplete156 === true) return false;\n  const ids = [...new Set([...likedIds].map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 2000);\n  await bucket.put(exploreSharedLikesKey061(normalized), JSON.stringify({\n    schemaVersion: 1,\n    uid: normalized,\n    updatedAt: Date.now(),\n    likedTrackIds: ids,\n  }), {\n    httpMetadata: { contentType: 'application/json; charset=utf-8' },\n    customMetadata: { soridrawSharedLikes: '114', updatedAt: String(Date.now()) },\n  });\n  return true;\n}\n\nconst EXPLORE_SHARED_LIKE_EXACT_MARKER_161 = 'SORIDRAW_SHARED_LIKE_EXACT_STATE_161_20260921';\n\nfunction normalizeSharedLikesState161(bundle, uid) {\n  const normalized = String(uid || '').trim();\n  if (!normalized || !bundle || Number(bundle.schemaVersion) !== 1 ||\n      String(bundle.uid || '').trim() !== normalized || !Array.isArray(bundle.likedTrackIds)) return null;\n  const values = bundle.likedTrackIds.map((value) => String(value || '').trim()).filter(Boolean);\n  const likedIds = new Set(values);\n  const exactLikeCount = Number(bundle.exactLikeCount156);\n  const canonicalSource = String(bundle.canonicalSource156 || '').trim();\n  const exact = bundle.canonicalComplete156 === true &&\n    Boolean(canonicalSource) &&\n    Number.isSafeInteger(exactLikeCount) && exactLikeCount >= 0 &&\n    exactLikeCount === likedIds.size && values.length === likedIds.size;\n  return {\n    likedIds,\n    exact,\n    exactLikeCount: exact ? exactLikeCount : null,\n    source: exact ? canonicalSource : 'legacy-v114-partial',\n  };\n}\n\nasync function readSharedLikesState161(env, uid) {\n  const normalized = String(uid || '').trim();\n  if (!normalized) return null;\n  const bundle = await readSharedSocialJson061(env, exploreSharedLikesKey061(normalized));\n  return normalizeSharedLikesState161(bundle, normalized);\n}\n\nasync function readSharedLikes061(env, uid) {\n  const state = await readSharedLikesState161(env, uid);\n  return state?.likedIds || null;\n}\n\nasync function readBoundedLegacyLikeMemberships161(env, uid, trackIds) {\n  const normalized = String(uid || '').trim();\n  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 200);\n  if (!normalized || !ids.length || !env?.DB) return new Set();\n  const placeholders = ids.map(() => '?').join(',');\n  const result = await env.DB.prepare(\n    'SELECT l.track_id FROM likes l JOIN tracks t ON t.id = l.track_id ' +\n    'WHERE l.user_uid = ? AND l.track_id IN (' + placeholders + ') ' +\n    "AND t.is_public = 1 AND t.status = 'published'"\n  ).bind(normalized, ...ids).all();\n  return new Set((result?.results || []).map((row) => String(row?.track_id || '').trim()).filter(Boolean));\n}\n\nconst EXPLORE_LIKE_CUTOVER_MARKER_162 = 'SORIDRAW_SHARED_LIKE_CUTOVER_GATE_162_20260921';\nconst exploreLikeCutoverKey162 = 'internal/explore/like-cutover-v162/active.json';\n\nasync function readLikeCutoverState162(env) {\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!bucket) return { mode: 'legacy', cutoverToken: null };\n  const object = await bucket.get(exploreLikeCutoverKey162);\n  if (!object) return { mode: 'legacy', cutoverToken: null };\n  let value = null;\n  try { value = JSON.parse(await object.text()); }\n  catch { throw new Error('162 cutover manifest unreadable'); }\n  const token = String(value?.cutoverToken || '').trim();\n  const armed = Number(value?.schemaVersion) === 1 &&\n    value?.relationMode === 'overlay157' &&\n    value?.legacyRelationWritersFrozen === true &&\n    value?.legacyCountWritersFrozen === true &&\n    value?.allEnvironmentReadersReady === true &&\n    value?.allEnvironmentWritersReady === true &&\n    value?.ownerProtocol === 'uid143-track147-158' &&\n    token.length > 0 && token.length <= 128;\n  if (!armed) throw new Error('162 cutover manifest present but not fully armed');\n  return { mode: 'overlay157', cutoverToken: token };\n}\n\nasync function readBoundedEffectiveLikeMemberships162(env, uid, trackIds) {\n  const normalized = String(uid || '').trim();\n  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 200);\n  if (!normalized || !ids.length || !env?.DB) return { likedIds: new Set(), mode: 'legacy', cutoverToken: null };\n  const cutover = await readLikeCutoverState162(env);\n  if (cutover.mode !== 'overlay157') {\n    return {\n      likedIds: await readBoundedLegacyLikeMemberships161(env, normalized, ids),\n      mode: 'legacy',\n      cutoverToken: null,\n    };\n  }\n  const values = ids.map(() => '(?)').join(',');\n  const result = await env.DB.prepare(\n    'WITH requested(track_id) AS (VALUES ' + values + ') ' +\n    'SELECT r.track_id FROM requested r ' +\n    'JOIN tracks t ON t.id = r.track_id ' +\n    'LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ? ' +\n    'LEFT JOIN explore_like_overrides_157 o ON o.user_uid = ? AND o.track_id = r.track_id ' +\n    "WHERE t.is_public = 1 AND t.status = 'published' " +\n    'AND COALESCE(o.liked, CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END) = 1'\n  ).bind(...ids, normalized, normalized).all();\n  if (!Array.isArray(result?.results)) throw new Error('162 effective membership unavailable');\n  const liked = result.results.map((row) => String(row?.track_id || '').trim()).filter(Boolean);\n  if (liked.some((id) => !ids.includes(id)) || new Set(liked).size !== liked.length) {\n    throw new Error('162 effective membership invalid');\n  }\n  return { likedIds: new Set(liked), mode: 'overlay157', cutoverToken: cutover.cutoverToken };\n}\n\nasync function writeSharedFollowing061(env, uid, followingUids) {\n  const normalized = String(uid || '').trim();\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!normalized || !bucket || !followingUids) return false;\n  const ids = [...new Set([...followingUids].map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 5000);\n  await bucket.put(exploreSharedFollowingKey061(normalized), JSON.stringify({\n    schemaVersion: 1,\n    uid: normalized,\n    updatedAt: Date.now(),\n    followingUids: ids,\n  }), {\n    httpMetadata: { contentType: 'application/json; charset=utf-8' },\n    customMetadata: { soridrawSharedFollowing: '114', updatedAt: String(Date.now()) },\n  });\n  return true;\n}\n\nasync function readSharedFollowing061(env, uid) {\n  const normalized = String(uid || '').trim();\n  if (!normalized) return null;\n  const bundle = await readSharedSocialJson061(env, exploreSharedFollowingKey061(normalized));\n  if (!bundle || Number(bundle.schemaVersion) !== 1 || !Array.isArray(bundle.followingUids)) return null;\n  return [...new Set(bundle.followingUids.map((value) => String(value || '').trim()).filter(Boolean))];\n}\n\nasync function seedSharedLikesFromPreviewLocal061(env, uid, localReader) {\n  if (exploreSharedSocialEnvironment061(env) !== 'preview') return null;\n  const local = await localReader(env, uid);\n  if (!local) return null;\n  await writeSharedLikes061(env, uid, local);\n  return local;\n}\n\nasync function seedSharedFollowingFromPreviewLocal061(env, uid, localReader) {\n  if (exploreSharedSocialEnvironment061(env) !== 'preview') return null;\n  const local = await localReader(env, uid);\n  if (!local) return null;\n  await writeSharedFollowing061(env, uid, local);\n  return local;\n}\n`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('readExploreLikeR2Bundle', 'Core061', (coreName) => `async function readExploreLikeR2Bundle(env, uid) {\n  const shared = await readSharedLikes061(env, uid);\n  if (shared) return shared;\n  return await seedSharedLikesFromPreviewLocal061(env, uid, ${coreName});\n}`);

replaceFunction('handleMyLikeStates', `async function handleMyLikeStates(request, url, env, cors) {
  const authContext = await requireExploreAuth(request);
  const raw = safeString(url.searchParams.get("trackIds"));
  const trackIds = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 50);
  if (!trackIds.length) return json({ ok: true, data: { likedTrackIds: [], likesComplete: false, exactLikeCount: null } }, 200, cors);
  if (trackIds.some((trackId) => trackId.length > 512)) {
    throwApi("INVALID_TRACK_ID", "\\uACE1 ID\\uAC00 \\uC62C\\uBC14\\uB974\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4.", 400);
  }
  const sharedState = await readSharedLikesState161(env, authContext.uid);
  if (sharedState?.exact) {
    return json({ ok: true, data: {
      likedTrackIds: trackIds.filter((trackId) => sharedState.likedIds.has(trackId)),
      likesComplete: true,
      exactLikeCount: sharedState.exactLikeCount,
      likesSnapshotSource: sharedState.source,
    } }, 200, cors);
  }
  const targeted162 = await readBoundedEffectiveLikeMemberships162(env, authContext.uid, trackIds);
  return json({ ok: true, data: {
    likedTrackIds: trackIds.filter((trackId) => targeted162.likedIds.has(trackId)),
    likesComplete: false,
    exactLikeCount: null,
    likesSnapshotSource: targeted162.mode === 'overlay157' ? 'overlay157-targeted-162' : 'legacy-targeted-161',
  } }, 200, cors);
}`);

replaceFunction('handleMySocialSnapshot042', `async function handleMySocialSnapshot042(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let [likeState, followingUids] = await Promise.all([
    readSharedLikesState161(env, authContext.uid),
    readExploreFollowingR2Bundle(env, authContext.uid),
  ]);
  if (!likeState || !followingUids) {
    await Promise.all([
      likeState ? Promise.resolve() : rebuildExploreLikeR2Bundle(env, authContext.uid),
      followingUids ? Promise.resolve() : rebuildExploreFollowingR2Bundle(env, authContext.uid),
    ]);
    [likeState, followingUids] = await Promise.all([
      readSharedLikesState161(env, authContext.uid),
      readExploreFollowingR2Bundle(env, authContext.uid),
    ]);
  }
  if (!likeState || !followingUids) {
    return json({ ok: false, error: 'SOCIAL_SNAPSHOT_UNAVAILABLE' }, 503, cors);
  }
  return json({
    ok: true,
    data: {
      schemaVersion: 1,
      likedTrackIds: [...likeState.likedIds],
      likesComplete: likeState.exact,
      exactLikeCount: likeState.exact ? likeState.exactLikeCount : null,
      likesSnapshotSource: likeState.source,
      followingUids: [...followingUids],
      source: 'r2-social-042',
      updatedAt: Date.now(),
    },
  }, 200, cors);
}`);

wrapAsyncFunction('rebuildExploreLikeR2Bundle', 'Core061', (coreName) => `async function rebuildExploreLikeR2Bundle(env, uid) {\n  const result = await ${coreName}(env, uid);\n  const local = await readExploreLikeR2BundleCore061(env, uid);\n  if (local) await writeSharedLikes061(env, uid, local);\n  return result;\n}`);

wrapAsyncFunction('syncExploreLikeR2AfterBatch034', 'Core061', (coreName) => `async function syncExploreLikeR2AfterBatch034(env, uid, results) {\n  const shared = await readSharedLikes061(env, uid);\n  if (shared) {\n    await writeExploreR2Json(env, exploreLikeR2Key(uid), {\n      schemaVersion: EXPLORE_R2_LIKE_SCHEMA_VERSION,\n      uid: String(uid || ''),\n      updatedAt: Date.now(),\n      likedTrackIds: [...shared].slice(0, 2000),\n    });\n  }\n  const result = await ${coreName}(env, uid, results);\n  const local = await readExploreLikeR2BundleCore061(env, uid);\n  if (local) await writeSharedLikes061(env, uid, local);\n  return result;\n}`);

wrapAsyncFunction('readExploreFollowingR2Bundle', 'Core061', (coreName) => `async function readExploreFollowingR2Bundle(env, uid) {\n  const shared = await readSharedFollowing061(env, uid);\n  if (shared) return shared;\n  return await seedSharedFollowingFromPreviewLocal061(env, uid, ${coreName});\n}`);

wrapAsyncFunction('rebuildExploreFollowingR2Bundle', 'Core061', (coreName) => `async function rebuildExploreFollowingR2Bundle(env, uid) {\n  const result = await ${coreName}(env, uid);\n  const local = await readExploreFollowingR2BundleCore061(env, uid);\n  if (local) await writeSharedFollowing061(env, uid, local);\n  return result;\n}`);

wrapAsyncFunction('syncExploreFollowingR2AfterMutation', 'Core061', (coreName) => `async function syncExploreFollowingR2AfterMutation(env, uid, targetUid, following) {\n  const shared = await readSharedFollowing061(env, uid);\n  if (shared) {\n    await writeExploreR2Json(env, exploreFollowingR2Key(uid), {\n      schemaVersion: EXPLORE_R2_FOLLOW_SCHEMA_VERSION,\n      uid: String(uid || ''),\n      updatedAt: Date.now(),\n      followingUids: shared.slice(0, 5000),\n    });\n  }\n  const result = await ${coreName}(env, uid, targetUid, following);\n  const local = await readExploreFollowingR2BundleCore061(env, uid);\n  if (local) await writeSharedFollowing061(env, uid, local);\n  return result;\n}`);

for (const required of [
  marker,
  'exploreSharedLikesKey061',
  'exploreSharedFollowingKey061',
  'readSharedLikes061',
  'readSharedLikesState161',
  'readBoundedLegacyLikeMemberships161',
  'readBoundedEffectiveLikeMemberships162',
  'SORIDRAW_SHARED_LIKE_EXACT_STATE_161_20260921',
  'SORIDRAW_SHARED_LIKE_CUTOVER_GATE_162_20260921',
  'writeSharedLikes061',
  'readSharedFollowing061',
  'writeSharedFollowing061',
  'readExploreLikeR2BundleCore061',
  'rebuildExploreLikeR2BundleCore061',
  'syncExploreLikeR2AfterBatch034Core061',
  'readExploreFollowingR2BundleCore061',
  'rebuildExploreFollowingR2BundleCore061',
  'syncExploreFollowingR2AfterMutationCore061',
]) {
  if (!source.includes(required)) throw new Error(`[061] final runtime missing: ${required}`);
}

const likeReader = functionRange('readExploreLikeR2Bundle').text;
const followingReader = functionRange('readExploreFollowingR2Bundle').text;
for (const reader of [likeReader, followingReader]) {
  if (reader.includes('env.DB') || reader.includes('.prepare(')) throw new Error('[061] shared social read path must not query D1');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[061] Personal likes/following now use shared R2 across PREVIEW/TEST/PRODUCTION; PREVIEW may seed existing local derived state, and any one-time D1 recovery is promoted into the shared snapshot.');

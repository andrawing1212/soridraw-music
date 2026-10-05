import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919';
if (source.includes(marker)) {
  console.log('[066] phase-a R2 ordered catalog already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_LIKE_COUNT_TARGETED_065_20260918',
  'publicationReadProfileR2024',
  'publicationEnsureProfile016',
  'handleMusicNotePublicationSingleWrite016',
  'publicationBuildFeedItem016',
  'syncMusicNotePublicationR2AfterMutation',
  'writeExploreSharedProfile060',
  'readExploreSharedProfile060',
  'validExploreProfileR2Bundle020',
  'readSharedTrackCard062',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreVisibleProfiles056',
  'handleFeedWithEdgeCache',
  'handleProfileTracks',
  'handleGenreTracks',
  'handleSearch',
  'handlePublicProfileFirstViewWithEdgeCache',
  'handleMyProfileUpdate',
  'encodeCursor',
  'decodeCursor',
  'getPageSize',
  'json',
]) {
  if (!source.includes(required)) throw new Error(`[066] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[066] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[066] function body missing: ${name}`);
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
  throw new Error(`[066] unterminated function: ${name}`);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(
    new RegExp(`^async\\s+function\\s+${name}\\(`),
    `async function ${coreName}(`,
  );
  if (renamed === range.text) throw new Error(`[066] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const appendBeforeResult066 = (name, block) => {
  const range = functionRange(name);
  const anchor = '  return result;\n}';
  const count = range.text.split(anchor).length - 1;
  if (count !== 1) throw new Error(`[066] ${name} final result anchor count=${count}`);
  const next = range.text.replace(anchor, `${block}\n  return result;\n}`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

let runtime = readFileSync(new URL('../runtime/r2-catalog-v1.js', import.meta.url), 'utf8');
runtime = runtime.replace(/^export\s+/gm, '');
if (!runtime.includes(marker)) throw new Error('[066] runtime marker missing');
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(runtime)) {
  throw new Error('[066] R2 catalog runtime must not access D1');
}
if (/track_search_fts|profile_search_fts/.test(runtime)) {
  throw new Error('[066] R2 catalog runtime must not use D1 FTS');
}

const anchor = functionRange('publicationReadProfileR2024').start;
source = source.slice(0, anchor) + runtime + '\n\n' + source.slice(anchor);

wrapAsyncFunction('publicationReadProfileR2024', 'Core066', (coreName) => `async function publicationReadProfileR2024(env, authContext) {
  if (!isExploreR2FirstPublisherEnabled066(env)) {
    return await ${coreName}(env, authContext);
  }
  try {
    const uid = String(authContext?.uid || '').trim();
    if (!uid) return null;
    let bundle = await readExploreR2Json(env, exploreProfileR2Key(uid));
    if (!validExploreProfileR2Bundle020(bundle)) {
      bundle = await readExploreSharedProfile060(env, uid);
    }
    if (validExploreProfileR2Bundle020(bundle)) {
      const profile = bundle.body.data.profile || {};
      return {
        nickname: String(profile.nickname || profile.displayName || authContext?.displayName || ''),
        avatarUrl: String(profile.avatarUrl || profile.avatar_url || authContext?.picture || ''),
        handle: String(profile.handle || bundle.handle || '').trim().replace(/^@+/, ''),
        r2FirstPublisher066: Boolean(bundle?.firstPublisherBootstrap066),
      };
    }
  } catch {}
  return await ${coreName}(env, authContext);
}`);

wrapAsyncFunction('publicationEnsureProfile016', 'Core066', (coreName) => `async function publicationEnsureProfile016(env, authContext, row, now) {
  if (isExploreR2FirstPublisherEnabled066(env)) {
    try {
      const shared = await ensureFirstPublisherSharedProfile066(env, authContext, now);
      if (shared) return shared;
    } catch (error) {
      console.warn('[SORIDRAW 066] first-publisher shared profile deferred:', String(error?.message || error || 'unknown'));
    }
  }
  return await ${coreName}(env, authContext, row, now);
}`);

{
  const range = functionRange('handleMusicNotePublicationSingleWrite016');
  let next = range.text;

  const unchangedAnchor = '  if (unchanged) {\n    return json({';
  const unchangedCount = next.split(unchangedAnchor).length - 1;
  if (unchangedCount !== 1) throw new Error(`[066] unchanged first-publisher repair anchor count=${unchangedCount}`);
  next = next.replace(unchangedAnchor, `  if (unchanged) {
    if (isExploreR2FirstPublisherEnabled066(env) && profile?.r2FirstPublisher066) {
      try {
        const retryDelta066 = await firstPublisherProfileTrackDelta066(env, authContext.uid, source.id);
        if (retryDelta066 > 0) {
          const retryFeedItem066 = publicationBuildFeedItem016(
            source,
            authContext,
            profile,
            previous,
            resolvedOptions,
            primaryGenre,
            publishedAt,
            now
          );
          await syncExploreFeedR2Publication043(env, retryFeedItem066);
          try {
            await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, source.sourceId, {
              status: 'public',
              trackId: source.id,
              allowNextSongApply: resolvedOptions.allowNextSongApply === 1,
              allowFollowerSave: resolvedOptions.allowFollowerSave === 1,
              profilePinned: resolvedOptions.profilePinned === 1
            });
          } catch (error) {
            console.warn('[SORIDRAW 066] first-publisher publication-state retry deferred:', String(error?.message || error || 'unknown'));
          }
          await patchExploreProfileR2Publication043(env, authContext.uid, {
            trackId: source.id,
            item: retryFeedItem066,
            remove: false,
            trackCountDelta: retryDelta066
          });
        }
        await finalizeFirstPublisherProfile066(env, authContext.uid);
      } catch (error) {
        console.warn('[SORIDRAW 066] first-publisher idempotent repair deferred:', String(error?.message || error || 'unknown'));
      }
    }
    return json({`);

  const profilePatchAnchor = `  await patchExploreProfileR2Publication043(env, authContext.uid, {
    trackId: source.id,
    item: feedItem,
    remove: false,
    trackCountDelta: wasPublic ? 0 : 1
  });
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || "");`;
  const profilePatchCount = next.split(profilePatchAnchor).length - 1;
  if (profilePatchCount !== 1) throw new Error(`[066] first-publisher profile patch anchor count=${profilePatchCount}`);
  next = next.replace(profilePatchAnchor, `  let profileTrackCountDelta066 = wasPublic ? 0 : 1;
  if (isExploreR2FirstPublisherEnabled066(env) && profile?.r2FirstPublisher066) {
    try {
      profileTrackCountDelta066 = await firstPublisherProfileTrackDelta066(env, authContext.uid, source.id);
    } catch (error) {
      console.warn('[SORIDRAW 066] first-publisher track delta fallback:', String(error?.message || error || 'unknown'));
    }
  }
  await patchExploreProfileR2Publication043(env, authContext.uid, {
    trackId: source.id,
    item: feedItem,
    remove: false,
    trackCountDelta: profileTrackCountDelta066
  });
  if (isExploreR2FirstPublisherEnabled066(env) && profile?.r2FirstPublisher066) {
    try {
      await finalizeFirstPublisherProfile066(env, authContext.uid);
    } catch (error) {
      console.warn('[SORIDRAW 066] first-publisher finalize deferred:', String(error?.message || error || 'unknown'));
    }
  }
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || "");`);

  source = source.slice(0, range.start) + next + source.slice(range.end);
}

appendBeforeResult066('syncExploreFeedR2Publication043', `  if (isExploreR2CatalogEnabled066(env)) {
    try { await syncExploreCatalogTrack066(env, incomingItem, { isPublic: true }); }
    catch (error) { console.warn('[SORIDRAW 066] publish catalog sync deferred:', String(error?.message || error || 'unknown')); }
  }`);

appendBeforeResult066('syncExploreFeedR2Private043', `  if (isExploreR2CatalogEnabled066(env)) {
    try { await removeExploreCatalogTrack066(env, trackId); }
    catch (error) { console.warn('[SORIDRAW 066] private catalog delete deferred:', String(error?.message || error || 'unknown')); }
  }`);

appendBeforeResult066('syncExploreFeedR2OptionPatch043', `  if (isExploreR2CatalogEnabled066(env)) {
    try {
      const card = await readSharedTrackCard062(env, trackId);
      if (card) await syncExploreCatalogTrack066(env, { ...card, ...patch }, {
        isPublic: true,
        profilePinned: Object.prototype.hasOwnProperty.call(patch || {}, 'profilePinned')
          ? Boolean(patch.profilePinned)
          : Boolean(card.profilePinned),
      });
    } catch (error) {
      console.warn('[SORIDRAW 066] option catalog patch deferred:', String(error?.message || error || 'unknown'));
    }
  }`);

appendBeforeResult066('patchExploreVisibleProfiles056', `  if (isExploreR2CatalogEnabled066(env)) {
    for (const row of changedItems || []) {
      const trackId = String(row?.trackId || '').trim();
      if (!trackId) continue;
      try { await patchExploreCatalogLike066(env, trackId, Math.max(0, Number(row?.likeCount || 0))); }
      catch (error) { console.warn('[SORIDRAW 066] popular catalog like move deferred:', trackId, String(error?.message || error || 'unknown')); }
    }
  }`);

wrapAsyncFunction('handleFeedWithEdgeCache', 'Core066', (coreName) => `async function handleFeedWithEdgeCache(request, url, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await ${coreName}(request, url, env, cors);
  const cursorValue = url.searchParams.get('cursor');
  if (cursorValue) {
    try {
      const catalog = await handleCatalogFeed066(url, env, cors);
      if (catalog) return catalog;
    } catch (error) {
      console.warn('[SORIDRAW 066] catalog feed fallback:', String(error?.message || error || 'unknown'));
    }
    const decoded = decodeCursor(cursorValue);
    if (decoded?.legacy) {
      const fallbackUrl = new URL(url.toString());
      fallbackUrl.searchParams.set('cursor', String(decoded.legacy));
      return await ${coreName}(request, fallbackUrl, env, cors);
    }
    return await ${coreName}(request, url, env, cors);
  }
  const response = await ${coreName}(request, url, env, cors);
  try { return await rewriteFirstFeedCursor066(response, url, env); }
  catch { return response; }
}`);

wrapAsyncFunction('handleProfileTracks', 'Core066', (coreName) => `async function handleProfileTracks(url, profileRef, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await ${coreName}(url, profileRef, env, cors);
  const cursorValue = url.searchParams.get('cursor');
  if (cursorValue) {
    try {
      const catalog = await handleCatalogProfileTracks066(url, profileRef, env, cors);
      if (catalog) return catalog;
    } catch (error) {
      console.warn('[SORIDRAW 066] catalog profile fallback:', String(error?.message || error || 'unknown'));
    }
    const decoded = decodeCursor(cursorValue);
    if (decoded?.legacy) {
      const fallbackUrl = new URL(url.toString());
      fallbackUrl.searchParams.set('cursor', String(decoded.legacy));
      return await ${coreName}(fallbackUrl, profileRef, env, cors);
    }
  }
  return await ${coreName}(url, profileRef, env, cors);
}`);

wrapAsyncFunction('handleGenreTracks', 'Core066', (coreName) => `async function handleGenreTracks(url, genreValue, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await ${coreName}(url, genreValue, env, cors);
  try {
    const catalog = await handleCatalogGenre066(url, genreValue, env, cors);
    if (catalog) return catalog;
  } catch (error) {
    console.warn('[SORIDRAW 066] catalog genre fallback:', String(error?.message || error || 'unknown'));
  }
  return await ${coreName}(url, genreValue, env, cors);
}`);

wrapAsyncFunction('handleSearch', 'Core066', (coreName) => `async function handleSearch(url, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await ${coreName}(url, env, cors);
  try {
    const catalog = await handleCatalogSearch066(url, env, cors);
    if (catalog) return catalog;
  } catch (error) {
    console.warn('[SORIDRAW 066] catalog search fallback:', String(error?.message || error || 'unknown'));
  }
  return await ${coreName}(url, env, cors);
}`);



{
  const range = functionRange('handleMyProfileUpdate');
  const before = "  return json({ ok: true, data: { profile } }, 200, cors);\n}";
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[066] profile-edit return anchor count=${count}`);
  const after = `  if (isExploreR2CatalogEnabled066(env)) {
    try { await syncExploreCatalogArtist066(env, profile); }
    catch (error) { console.warn('[SORIDRAW 066] explicit profile artist sync deferred:', String(error?.message || error || 'unknown')); }
  }
  return json({ ok: true, data: { profile } }, 200, cors);
}`;
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
}

for (const required of [
  marker,
  'isExploreR2CatalogEnabled066',
  'isExploreR2CatalogReadEnabled066',
  'isExploreR2FirstPublisherEnabled066',
  'syncExploreCatalogTrack066',
  'removeExploreCatalogTrack066',
  'patchExploreCatalogLike066',
  'ensureFirstPublisherSharedProfile066',
  'firstPublisherProfileTrackDelta066',
  'finalizeFirstPublisherProfile066',
  'first-publisher idempotent repair deferred',
  'handleCatalogFeed066',
  'handleCatalogProfileTracks066',
  'handleCatalogGenre066',
  'handleCatalogSearch066',
  'explicit profile artist sync deferred',
  'publicationEnsureProfile016Core066',
  'handleSearchCore066',
  'handleFeedWithEdgeCacheCore066',
]) {
  if (!source.includes(required)) throw new Error(`[066] final runtime missing: ${required}`);
}

const injectedStart = source.indexOf(marker);
const injectedEnd = source.indexOf('async function publicationReadProfileR2024Core066', injectedStart);
const injected = injectedEnd > injectedStart ? source.slice(injectedStart, injectedEnd) : '';
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(injected)) {
  throw new Error('[066] injected R2 catalog helper unexpectedly accesses D1');
}
if (/track_search_fts|profile_search_fts/.test(injected)) {
  throw new Error('[066] injected R2 catalog helper unexpectedly uses FTS');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[066] Dormant Phase A R2 ordered catalog/search/deep-page runtime added; existing behavior remains unchanged until SORIDRAW_R2_CATALOG_V1=1.');

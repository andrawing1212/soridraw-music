from pathlib import Path
import hashlib

ROOT = Path('.')
WORKER = ROOT / 'cloudflare/explore-worker/canonical/preview-worker.js'
LOCK = ROOT / 'cloudflare/explore-worker/canonical/source-sha256.txt'
VERIFY = ROOT / 'scripts/verify-explore-deploy-preflight.mjs'

worker = WORKER.read_text(encoding='utf-8')
verify = VERIFY.read_text(encoding='utf-8')

if 'SORIDRAW_PROFILE_INDEXED_WRITE_COMPACTION_251_20260930' in worker:
    raise SystemExit('251 already applied')

def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, got {count}')
    return source.replace(old, new, 1)

old_profile = '''    const writeProfile247 = async () => await env.DB.prepare(`
      UPDATE public_profiles
      SET nickname = ?, bio = ?, handle = ?, genre_override = ?,
          spotify_url = ?, instagram_url = ?, tiktok_url = ?,
          profile_customized = 1, is_public = 1, updated_at = ?
      WHERE uid = ?
    `).bind(
      nickname,
      bio,
      handle,
      nextGenres,
      spotifyUrl,
      instagramUrl,
      tiktokUrl,
      now,
      authContext.uid
    ).run();

    let updated = await writeProfile247();
    if (Number(updated?.meta?.changes || 0) === 0) {
      await upsertPublicProfileFromFirebase(env, authContext, now);
      updated = await writeProfile247();
    }
'''
new_profile = '''    // SORIDRAW_PROFILE_INDEXED_WRITE_COMPACTION_251_20260930
    // Only changed columns belong in the warm UPDATE. D1 bills index maintenance
    // when an indexed column is included in a write, even if the value is unchanged.
    // Keep the old full writer only as a cold recovery after a missing/raced row.
    const set251 = [];
    const bind251 = [];
    if (nicknameChanged) { set251.push("nickname = ?"); bind251.push(nickname); }
    if (bioChanged) { set251.push("bio = ?"); bind251.push(bio); }
    if (handleChanged) { set251.push("handle = ?"); bind251.push(handle); }
    if (previousGenres !== nextGenres) { set251.push("genre_override = ?"); bind251.push(nextGenres); }
    if (String(existing.spotify_url || "") !== spotifyUrl) { set251.push("spotify_url = ?"); bind251.push(spotifyUrl); }
    if (String(existing.instagram_url || "") !== instagramUrl) { set251.push("instagram_url = ?"); bind251.push(instagramUrl); }
    if (String(existing.tiktok_url || "") !== tiktokUrl) { set251.push("tiktok_url = ?"); bind251.push(tiktokUrl); }
    if (Number(existing.profile_customized || 0) !== 1) set251.push("profile_customized = 1");
    if (Number(existing.is_public || 0) !== 1) set251.push("is_public = 1");
    set251.push("updated_at = ?");
    bind251.push(now);

    const writeProfile247 = async () => await env.DB.prepare(
      `UPDATE public_profiles SET ${set251.join(", ")} WHERE uid = ?`
    ).bind(...bind251, authContext.uid).run();

    const writeProfileRecovery251 = async () => await env.DB.prepare(`
      UPDATE public_profiles
      SET nickname = ?, bio = ?, handle = ?, genre_override = ?,
          spotify_url = ?, instagram_url = ?, tiktok_url = ?,
          profile_customized = 1, is_public = 1, updated_at = ?
      WHERE uid = ?
    `).bind(
      nickname,
      bio,
      handle,
      nextGenres,
      spotifyUrl,
      instagramUrl,
      tiktokUrl,
      now,
      authContext.uid
    ).run();

    let updated = await writeProfile247();
    if (Number(updated?.meta?.changes || 0) === 0) {
      await upsertPublicProfileFromFirebase(env, authContext, now);
      updated = await writeProfileRecovery251();
    }
'''
worker = replace_once(worker, old_profile, new_profile, 'profile warm writer')

old_media = '''  let updated = await env.DB.prepare(`
    UPDATE public_profiles
    SET ${column} = ?, profile_customized = 1, is_public = 1, updated_at = ?
    WHERE uid = ?
  `).bind(publicUrl, now, authContext.uid).run();

  if (Number(updated?.meta?.changes || 0) === 0) {
    await upsertPublicProfileFromFirebase(env, authContext, now);
    updated = await env.DB.prepare(`
      UPDATE public_profiles
      SET ${column} = ?, profile_customized = 1, is_public = 1, updated_at = ?
      WHERE uid = ?
    `).bind(publicUrl, now, authContext.uid).run();
  }

  const profilePatch = kind === "avatar"
'''
new_media = '''  let baseline251 = null;
  try { baseline251 = await readExploreSharedProfileByUid247(env, authContext.uid); } catch {}
  const knownPublic251 = validExploreProfileR2Bundle020(baseline251);

  const writeMediaWarm251 = async () => await env.DB.prepare(`
    UPDATE public_profiles
    SET ${column} = ?, profile_customized = 1, updated_at = ?
    WHERE uid = ?
  `).bind(publicUrl, now, authContext.uid).run();
  const writeMediaRecovery251 = async () => await env.DB.prepare(`
    UPDATE public_profiles
    SET ${column} = ?, profile_customized = 1, is_public = 1, updated_at = ?
    WHERE uid = ?
  `).bind(publicUrl, now, authContext.uid).run();

  let updated = knownPublic251 ? await writeMediaWarm251() : await writeMediaRecovery251();
  if (Number(updated?.meta?.changes || 0) === 0) {
    await upsertPublicProfileFromFirebase(env, authContext, now);
    updated = await writeMediaRecovery251();
  }

  const profilePatch = kind === "avatar"
'''
worker = replace_once(worker, old_media, new_media, 'single media writer')
worker = replace_once(
    worker,
    '  const patchedBundle = await patchPublicProfileBundle245(env, authContext.uid, profilePatch);',
    '  const patchedBundle = await patchPublicProfileBundle245(env, authContext.uid, profilePatch, "", baseline251);',
    'single media baseline reuse',
)

old_batch = '''  const writeProfile248 = async () => await env.DB.prepare(`
    UPDATE public_profiles
    SET avatar_url = ?, background_url = ?, profile_customized = 1, is_public = 1, updated_at = ?
    WHERE uid = ?
  `).bind(avatarUrl, backgroundUrl, now, authContext.uid).run();

  let updated = await writeProfile248();
  if (Number(updated?.meta?.changes || 0) === 0) {
    await upsertPublicProfileFromFirebase(env, authContext, now);
    updated = await writeProfile248();
  }
'''
new_batch = '''  let baselineBatch251 = null;
  try { baselineBatch251 = await readExploreSharedProfileByUid247(env, authContext.uid); } catch {}
  const knownPublicBatch251 = validExploreProfileR2Bundle020(baselineBatch251);

  const writeProfile248 = async () => await env.DB.prepare(`
    UPDATE public_profiles
    SET avatar_url = ?, background_url = ?, profile_customized = 1, updated_at = ?
    WHERE uid = ?
  `).bind(avatarUrl, backgroundUrl, now, authContext.uid).run();
  const writeProfileRecovery251 = async () => await env.DB.prepare(`
    UPDATE public_profiles
    SET avatar_url = ?, background_url = ?, profile_customized = 1, is_public = 1, updated_at = ?
    WHERE uid = ?
  `).bind(avatarUrl, backgroundUrl, now, authContext.uid).run();

  let updated = knownPublicBatch251 ? await writeProfile248() : await writeProfileRecovery251();
  if (Number(updated?.meta?.changes || 0) === 0) {
    await upsertPublicProfileFromFirebase(env, authContext, now);
    updated = await writeProfileRecovery251();
  }
'''
worker = replace_once(worker, old_batch, new_batch, 'batch media writer')
worker = replace_once(
    worker,
    '''  const patchedBundle = await patchPublicProfileBundle245(env, authContext.uid, {
    avatarUrl,
    backgroundUrl,
    updatedAt: now,
  });''',
    '''  const patchedBundle = await patchPublicProfileBundle245(env, authContext.uid, {
    avatarUrl,
    backgroundUrl,
    updatedAt: now,
  }, "", baselineBatch251);''',
    'batch media baseline reuse',
)

verify = replace_once(
    verify,
    'assert.match(media246, /patchPublicProfileBundle245\\(env, authContext\\.uid, profilePatch\\)/);',
    'assert.match(media246, /patchPublicProfileBundle245\\(env, authContext\\.uid, profilePatch, "", baseline251\\)/);',
    'media verifier baseline',
)

insert_anchor = '''assert.match(profileEdit246, /backgroundBlob && avatarBlob[\\s\\S]*?uploadExploreProfileMediaBatch/);


if (process.argv.includes('--connections')) {'''
insert_block = '''assert.match(profileEdit246, /backgroundBlob && avatarBlob[\\s\\S]*?uploadExploreProfileMediaBatch/);

// app248 Worker-only physical write compaction, internal change 251.
assert.match(profile247, /SORIDRAW_PROFILE_INDEXED_WRITE_COMPACTION_251_20260930/);
assert.match(profile247, /if \\(bioChanged\\) \\{ set251\\.push\\("bio = \\?"\\)/);
assert.match(profile247, /if \\(handleChanged\\) \\{ set251\\.push\\("handle = \\?"\\)/);
assert.match(profile247, /writeProfileRecovery251/);
assert.doesNotMatch(
  profile247,
  /const writeProfile247 = async \\(\\) => await env\\.DB\\.prepare\\(`[\\s\\S]*?SET nickname = \\?, bio = \\?, handle = \\?/,
  '251 warm profile save must not rewrite unchanged indexed handle/is_public columns',
);
assert.match(media246, /const knownPublic251 = validExploreProfileR2Bundle020\\(baseline251\\)/);
assert.match(media246, /writeMediaWarm251[\\s\\S]*?profile_customized = 1, updated_at = \\?[\\s\\S]*?WHERE uid = \\?/);
assert.doesNotMatch(
  media246.slice(media246.indexOf('const writeMediaWarm251'), media246.indexOf('const writeMediaRecovery251')),
  /is_public/,
  '251 warm single-media save must not touch indexed is_public',
);
assert.match(media248, /const knownPublicBatch251 = validExploreProfileR2Bundle020\\(baselineBatch251\\)/);
assert.doesNotMatch(
  media248.slice(media248.indexOf('const writeProfile248'), media248.indexOf('const writeProfileRecovery251')),
  /is_public/,
  '251 warm dual-media save must not touch indexed is_public',
);
assert.match(media248, /baselineBatch251\\);/);


if (process.argv.includes('--connections')) {'''
verify = replace_once(verify, insert_anchor, insert_block, 'verifier insert')

WORKER.write_text(worker, encoding='utf-8')
VERIFY.write_text(verify, encoding='utf-8')
LOCK.write_text(hashlib.sha256(worker.encode('utf-8')).hexdigest() + '\n', encoding='utf-8')

print('APPLY_251_PROFILE_INDEXED_WRITE_COMPACTION=PASS')
print('APP_VERSION_UNCHANGED=248')
print('D1_SCHEMA_CHANGE=0')
print('USER_DATA_MUTATION=0')

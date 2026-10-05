import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const MARKER = 'SORIDRAW_PUBLICATION_D1_READ_COMPACTION_361_20261005';
if (source.includes(MARKER)) {
  console.log('[094] publication D1 read compaction already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_WRITE_RETURNING_051_20260914',
  'SORIDRAW_PUBLICATION_MEDIA_SOURCE_COST_329_20261003',
  'SORIDRAW_PUBLICATION_MEDIA_INLINE_SOURCE_333_20261004',
  'readMusicNotePublicationR2Payload',
  'readExploreProfileCanonicalR2Bundle020',
]) {
  if (!source.includes(required)) throw new Error(`[094] prerequisite missing: ${required}`);
}

const replaceOnce = (before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`[094] ${label} anchor count=${count}`);
  source = source.replace(before, after);
};

// First registration already has two non-D1 authorities on a normal warm account:
// the per-user publication R2 bundle and the public-profile R2 bundle. When both
// prove this source is not registered and the public profile exists, do not pay the
// old tracks+stats+profile D1 join merely to rediscover "new track + existing profile".
// Any missing/ambiguous R2 state falls back to the exact previous D1 read unchanged.
replaceOnce(
`  const now = Date.now();
  const previous = await publicationReadState016(env, authContext.uid, source.id);
  const resolvedOptions = {`,
`  const now = Date.now();
  let previous = null;
  let publicationR2ProvedNew361 = false;
  try {
    const [publicationPayload, profileBundle] = await Promise.all([
      readMusicNotePublicationR2Payload(env, authContext.uid),
      readExploreProfileCanonicalR2Bundle020(env, authContext.uid),
    ]);
    const states = publicationPayload?.states && typeof publicationPayload.states === 'object'
      ? publicationPayload.states
      : null;
    const existingState = states ? states[source.sourceId] : null;
    const r2Profile = profileBundle?.body?.data?.profile || null;
    if (states && !existingState && r2Profile && String(r2Profile.uid || authContext.uid) === authContext.uid) {
      previous = {
        profile_uid: authContext.uid,
        profile_nickname: String(r2Profile.nickname || authContext.displayName || ''),
        profile_avatar_url: String(r2Profile.avatarUrl || r2Profile.avatar_url || authContext.picture || ''),
        profile_is_public: 1,
      };
      publicationR2ProvedNew361 = true;
    }
  } catch (error) {
    console.warn('[SORIDRAW 361] first-public R2 preflight unavailable; using canonical D1 fallback:', String(error?.message || error || 'unknown'));
  }
  if (!publicationR2ProvedNew361) {
    previous = await publicationReadState016(env, authContext.uid, source.id);
  }
  const resolvedOptions = {`,
  'first-public R2 proof',
);

// app333 already sends the selected source media in the same request. The old 329
// compatibility patch still forced that mutation through a canonical SELECT before
// UPDATE. Keep that fallback only when inline media is absent (legacy clients).
replaceOnce(
`          if (mutation.refreshSourceContent || mutation.refreshSourceMedia) {
            unresolvedTrackIds.add(mutation.trackId);
            continue;
          }`,
`          const inlineMediaFast361 = mutation.refreshSourceMedia && mutation.sourceMedia
            ? mutation.sourceMedia
            : null;
          if (mutation.refreshSourceContent || (mutation.refreshSourceMedia && !inlineMediaFast361)) {
            unresolvedTrackIds.add(mutation.trackId);
            continue;
          }`,
  'inline media warm preupdate gate',
);

// Feed the already-normalized inline media directly into the existing UPDATE ..
// RETURNING statement. SQL guards preserve idempotence; legacy/no-inline requests
// still use the previous exact-row fallback. This changes no UI or other mutation.
replaceOnce(
`          for (const column of ['is_public', 'allow_next_song_apply', 'allow_follower_save', 'profile_pinned']) {
            if (previousValues[column] === nextValues[column]) continue;
            sets.push(\`\${column}=?\`);
            values.push(nextValues[column]);
            guards.push(\`\${column}<>?\`);
            guardValues.push(nextValues[column]);
          }
          if (!sets.length) {`,
`          for (const column of ['is_public', 'allow_next_song_apply', 'allow_follower_save', 'profile_pinned']) {
            if (previousValues[column] === nextValues[column]) continue;
            sets.push(\`\${column}=?\`);
            values.push(nextValues[column]);
            guards.push(\`\${column}<>?\`);
            guardValues.push(nextValues[column]);
          }
          if (inlineMediaFast361) {
            const mediaColumns = [
              ['cover_url', String(inlineMediaFast361.coverUrl || '')],
              ['duration_seconds', inlineMediaFast361.durationSeconds == null ? null : Number(inlineMediaFast361.durationSeconds)],
              ['suno_url_primary', String(inlineMediaFast361.sunoUrlPrimary || '')],
              ['suno_url_secondary', inlineMediaFast361.sunoUrlSecondary ? String(inlineMediaFast361.sunoUrlSecondary) : null],
            ];
            for (const [column, value] of mediaColumns) {
              sets.push(\`\${column}=?\`);
              values.push(value);
              guards.push(\`\${column} IS NOT ?\`);
              guardValues.push(value);
            }
          }
          if (!sets.length) {`,
  'inline media update-returning fields',
);

source += '\n// ' + MARKER + '\n';
writeFileSync(workerPath, source, 'utf8');
console.log('[094] first-public and inline source-swap D1 pre-reads are removed when existing R2/request authority is sufficient.');

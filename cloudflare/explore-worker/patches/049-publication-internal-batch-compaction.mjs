import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_INTERNAL_BATCH_049_20260914';
if (source.includes(MARKER)) {
  console.log('[049] publication internal batch compaction already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PAGE_EXIT_PUBLICATION_BATCH_048_20260914',
  'handleMusicNotePublicationBatch048',
  'pageSyncPublicationRequest048',
  'readMusicNotePublicationR2Payload',
  'writeMusicNotePublicationR2Payload',
  'musicNotePublicationR2Key',
  'readExploreProfileCanonicalR2Bundle020',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'patchExploreProfileR2Publication043',
  'invalidatePublicationProfileCaches017',
]) {
  if (!source.includes(required)) throw new Error(`[049] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[049] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[049] function body missing: ${name}`);
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
  throw new Error(`[049] unterminated function: ${name}`);
};

async function syncMusicNotePublicationR2Batch049(env, uid, transitions) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || !Array.isArray(transitions) || !transitions.length) {
    return { ok: true, changed: false, repairNeeded: false };
  }
  try {
    const payload = await readMusicNotePublicationR2Payload(env, normalizedUid);
    if (!payload) {
      console.warn('[SORIDRAW 049] publication R2 bundle missing; mutation-side owner scan remains blocked.', normalizedUid);
      return { ok: false, changed: false, repairNeeded: true };
    }
    const states = { ...(payload.states || {}) };
    let changed = false;
    for (const transition of transitions) {
      const sourceId = String(transition?.sourceId || '').trim();
      const trackId = String(transition?.trackId || '').trim();
      if (!sourceId || !trackId) continue;
      const nextState = {
        status: transition?.status === 'public' ? 'public' : 'private',
        trackId,
        allowNextSongApply: Boolean(transition?.allowNextSongApply),
        allowFollowerSave: Boolean(transition?.allowFollowerSave),
        profilePinned: Boolean(transition?.profilePinned),
      };
      const previous = states[sourceId];
      const same = previous
        && String(previous.trackId || '') === nextState.trackId
        && (previous.status === 'public' ? 'public' : 'private') === nextState.status
        && Boolean(previous.allowNextSongApply) === nextState.allowNextSongApply
        && Boolean(previous.allowFollowerSave) === nextState.allowFollowerSave
        && Boolean(previous.profilePinned) === nextState.profilePinned;
      if (!same) {
        states[sourceId] = nextState;
        changed = true;
      }
    }
    if (!changed) return { ok: true, changed: false, repairNeeded: false };
    await writeMusicNotePublicationR2Payload(env, normalizedUid, {
      schemaVersion: MUSIC_NOTE_PUBLICATION_R2_SCHEMA_VERSION,
      states,
      itemCount: Object.keys(states).length,
      updatedAt: Date.now(),
    });
    return { ok: true, changed: true, repairNeeded: false };
  } catch (error) {
    console.warn('[SORIDRAW 049] publication R2 batch sync failed:', String(error?.message || error || 'unknown'));
    try {
      if (env?.PROFILE_MEDIA) await env.PROFILE_MEDIA.delete(musicNotePublicationR2Key(normalizedUid));
    } catch (repairError) {
      console.warn('[SORIDRAW 049] publication R2 repair marker failed:', String(repairError?.message || repairError || 'unknown'));
    }
    return { ok: false, changed: false, repairNeeded: true };
  }
}

async function handleMusicNotePublicationBatch049(request, env, cors) {
  const authContext = await requireExploreAuth(request.clone());
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '공개상태 묶음 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.mutations) ? body.mutations : [];
  if (!raw.length) return json({ ok: true, data: { results: [], revision: null } }, 200, cors);
  if (raw.length > 50) throwApi('TOO_MANY_PUBLICATIONS', '한 번에 처리할 수 있는 공개상태 변경 수를 초과했습니다.', 400);

  const bySource = new Map();
  for (const value of raw) {
    const sourceId = String(value?.sourceId || '').trim();
    const trackId = String(value?.trackId || '').trim();
    const status = value?.status === 'public' ? 'public' : 'private';
    const registered = value?.registered === true;
    const mutationAt = Math.max(0, Math.floor(Number(value?.mutationAt || 0)));
    if (!sourceId || !trackId) throwApi('INVALID_PUBLICATION', '공개상태 변경 대상이 올바르지 않습니다.', 400);
    bySource.set(sourceId, {
      sourceId,
      trackId,
      status,
      registered,
      mutationAt,
      options: pageSyncPublicationOptions048(value?.options),
    });
  }

  const ordered = [...bySource.values()];
  const resultsBySource = new Map();
  let changedAny = false;

  // First registrations stay on the proven single-publication path. Existing rows,
  // which are the frequent public/private hot path, are compacted below.
  for (const mutation of ordered) {
    if (mutation.registered) continue;
    if (mutation.status === 'private') {
      resultsBySource.set(mutation.sourceId, {
        ok: true,
        sourceId: mutation.sourceId,
        trackId: mutation.trackId,
        status: 'private',
        registered: false,
        ...mutation.options,
        mutation: 'net-zero',
      });
      continue;
    }
    try {
      const response = await handlePublication(
        pageSyncPublicationRequest048(request, 'POST', {
          sourceType: 'music_note',
          sourceId: mutation.sourceId,
          ...mutation.options,
        }),
        env,
        cors,
      );
      const payload = await response.clone().json().catch(() => null);
      if (!response.ok) {
        resultsBySource.set(mutation.sourceId, {
          ok: false,
          sourceId: mutation.sourceId,
          trackId: mutation.trackId,
          status: mutation.status,
          registered: false,
          error: String(payload?.message || payload?.error?.message || payload?.error || ('HTTP_' + response.status)),
        });
        continue;
      }
      const data = payload?.data || {};
      resultsBySource.set(mutation.sourceId, {
        ok: true,
        sourceId: mutation.sourceId,
        trackId: String(data?.trackId || mutation.trackId),
        status: 'public',
        registered: true,
        allowNextSongApply: Boolean(data?.allowNextSongApply ?? mutation.options.allowNextSongApply),
        allowFollowerSave: Boolean(data?.allowFollowerSave ?? mutation.options.allowFollowerSave),
        profilePinned: Boolean(data?.profilePinned ?? mutation.options.profilePinned),
        snapshotItem: data?.snapshotItem || null,
        mutation: String(data?.mutation || 'written'),
      });
      changedAny = changedAny || String(data?.mutation || 'written') !== 'idempotent';
    } catch (error) {
      resultsBySource.set(mutation.sourceId, {
        ok: false,
        sourceId: mutation.sourceId,
        trackId: mutation.trackId,
        status: mutation.status,
        registered: false,
        error: String(error?.message || error || 'PUBLICATION_BATCH_FAILED'),
      });
    }
  }

  const registeredMutations = ordered.filter((mutation) => mutation.registered);
  if (registeredMutations.length) {
    let canonicalRows = [];
    let canonicalReadOk = true;
    try {
      const trackIds = [...new Set(registeredMutations.map((mutation) => mutation.trackId))];
      const rows = await env.DB.prepare(`SELECT * FROM tracks
        WHERE owner_uid=? AND id IN (${trackIds.map(() => '?').join(',')})`).bind(
        authContext.uid,
        ...trackIds,
      ).all();
      canonicalRows = rows.results || [];
    } catch (error) {
      canonicalReadOk = false;
      for (const mutation of registeredMutations) {
        resultsBySource.set(mutation.sourceId, {
          ok: false,
          sourceId: mutation.sourceId,
          trackId: mutation.trackId,
          status: mutation.status,
          registered: true,
          error: String(error?.message || error || 'PUBLICATION_BATCH_READ_FAILED'),
        });
      }
    }

    if (canonicalReadOk) {
      const rowById = new Map(canonicalRows.map((row) => [String(row.id || ''), row]));
      const direct = [];
      const fallback = [];
      for (const mutation of registeredMutations) {
        if (resultsBySource.has(mutation.sourceId)) continue;
        const row = rowById.get(mutation.trackId);
        if (!row) {
          resultsBySource.set(mutation.sourceId, {
            ok: false,
            sourceId: mutation.sourceId,
            trackId: mutation.trackId,
            status: mutation.status,
            registered: true,
            error: '곡을 찾을 수 없습니다.',
          });
          continue;
        }
        if (String(row.source_type || '') !== 'music_note'
          || (mutation.status === 'public' && String(row.status || '') !== 'published')) {
          fallback.push({ mutation, row });
          continue;
        }
        const next = {
          isPublic: mutation.status === 'public',
          allowNextSongApply: Boolean(mutation.options.allowNextSongApply),
          allowFollowerSave: Boolean(mutation.options.allowFollowerSave),
          profilePinned: Boolean(mutation.options.profilePinned),
        };
        const wasPublic = Number(row.is_public || 0) === 1 && String(row.status || '') === 'published';
        const changed = Number(row.is_public || 0) !== (next.isPublic ? 1 : 0)
          || Number(row.allow_next_song_apply || 0) !== (next.allowNextSongApply ? 1 : 0)
          || Number(row.allow_follower_save || 0) !== (next.allowFollowerSave ? 1 : 0)
          || Number(row.profile_pinned || 0) !== (next.profilePinned ? 1 : 0);
        direct.push({ mutation, row, next, wasPublic, changed });
      }

      // Rare legacy/non-Music-Note rows retain the previous proven behavior.
      for (const item of fallback) {
        const { mutation } = item;
        try {
          const response = await handleVisibility(
            pageSyncPublicationRequest048(request, 'PATCH', {
              isPublic: mutation.status === 'public',
              ...mutation.options,
            }),
            env,
            cors,
            mutation.trackId,
          );
          const payload = await response.clone().json().catch(() => null);
          if (!response.ok) {
            resultsBySource.set(mutation.sourceId, {
              ok: false,
              sourceId: mutation.sourceId,
              trackId: mutation.trackId,
              status: mutation.status,
              registered: true,
              error: String(payload?.message || payload?.error?.message || payload?.error || ('HTTP_' + response.status)),
            });
            continue;
          }
          const data = payload?.data || {};
          const status = Boolean(data?.isPublic) ? 'public' : 'private';
          resultsBySource.set(mutation.sourceId, {
            ok: true,
            sourceId: mutation.sourceId,
            trackId: String(data?.trackId || mutation.trackId),
            status,
            registered: true,
            allowNextSongApply: Boolean(data?.allowNextSongApply ?? mutation.options.allowNextSongApply),
            allowFollowerSave: Boolean(data?.allowFollowerSave ?? mutation.options.allowFollowerSave),
            profilePinned: Boolean(data?.profilePinned ?? mutation.options.profilePinned),
            snapshotItem: data?.snapshotItem || null,
            mutation: String(data?.mutation || 'written'),
          });
          changedAny = changedAny || String(data?.mutation || 'written') !== 'idempotent';
        } catch (error) {
          resultsBySource.set(mutation.sourceId, {
            ok: false,
            sourceId: mutation.sourceId,
            trackId: mutation.trackId,
            status: mutation.status,
            registered: true,
            error: String(error?.message || error || 'PUBLICATION_BATCH_FALLBACK_FAILED'),
          });
        }
      }

      if (direct.length) {
        const publicIds = [...new Set(direct.filter((item) => item.next.isPublic).map((item) => item.mutation.trackId))];
        const statsById = new Map();
        let statsReady = true;
        if (publicIds.length) {
          try {
            const stats = await env.DB.prepare(`SELECT track_id,like_count,comment_count,play_count
              FROM track_stats WHERE track_id IN (${publicIds.map(() => '?').join(',')})`).bind(...publicIds).all();
            for (const row of stats.results || []) statsById.set(String(row.track_id || ''), row);
          } catch (error) {
            statsReady = false;
            console.warn('[SORIDRAW 049] batch stats preflight failed; using proven per-track fallback:', String(error?.message || error || 'unknown'));
          }
        }

        if (!statsReady) {
          for (const item of direct) {
            resultsBySource.set(item.mutation.sourceId, {
              ok: false,
              sourceId: item.mutation.sourceId,
              trackId: item.mutation.trackId,
              status: item.mutation.status,
              registered: true,
              error: 'PUBLICATION_BATCH_STATS_PREFLIGHT_FAILED',
            });
          }
        } else {
          let profile = null;
          try {
            const profileBundle = await readExploreProfileCanonicalR2Bundle020(env, authContext.uid);
            profile = profileBundle?.body?.data?.profile || null;
          } catch (error) {
            console.warn('[SORIDRAW 049] profile R2 read skipped:', String(error?.message || error || 'unknown'));
          }

          const now = Date.now();
          const statements = [];
          for (const item of direct) {
            if (!item.changed) continue;
            const sets = [];
            const values = [];
            const nextPublicInt = item.next.isPublic ? 1 : 0;
            const nextApply = item.next.allowNextSongApply ? 1 : 0;
            const nextSave = item.next.allowFollowerSave ? 1 : 0;
            const nextPinned = item.next.profilePinned ? 1 : 0;
            if (Number(item.row.is_public || 0) !== nextPublicInt) { sets.push('is_public=?'); values.push(nextPublicInt); }
            if (Number(item.row.allow_next_song_apply || 0) !== nextApply) { sets.push('allow_next_song_apply=?'); values.push(nextApply); }
            if (Number(item.row.allow_follower_save || 0) !== nextSave) { sets.push('allow_follower_save=?'); values.push(nextSave); }
            // profile_pinned is indexed. Mention it only when it truly changes, otherwise
            // SQLite rewrites idx_tracks_owner_profile_order for no semantic reason.
            if (Number(item.row.profile_pinned || 0) !== nextPinned) { sets.push('profile_pinned=?'); values.push(nextPinned); }
            sets.push('updated_at=?');
            values.push(now);
            statements.push(env.DB.prepare(`UPDATE tracks SET ${sets.join(',')}
              WHERE id=? AND owner_uid=? AND source_type='music_note'`).bind(
              ...values,
              item.row.id,
              authContext.uid,
            ));
          }

          let batchCommitted = true;
          if (statements.length) {
            try {
              await env.DB.batch(statements);
            } catch (error) {
              batchCommitted = false;
              for (const item of direct.filter((candidate) => candidate.changed)) {
                resultsBySource.set(item.mutation.sourceId, {
                  ok: false,
                  sourceId: item.mutation.sourceId,
                  trackId: item.mutation.trackId,
                  status: item.mutation.status,
                  registered: true,
                  error: String(error?.message || error || 'PUBLICATION_BATCH_WRITE_FAILED'),
                });
              }
            }
          }

          const successfulDirect = direct.filter((item) => !item.changed || batchCommitted);
          const publicationTransitions = [];
          for (const item of successfulDirect) {
            const { mutation, row, next, wasPublic, changed } = item;
            const stat = statsById.get(mutation.trackId) || {};
            const nextRow = {
              ...row,
              is_public: next.isPublic ? 1 : 0,
              allow_next_song_apply: next.allowNextSongApply ? 1 : 0,
              allow_follower_save: next.allowFollowerSave ? 1 : 0,
              profile_pinned: next.profilePinned ? 1 : 0,
              updated_at: changed ? now : Number(row.updated_at || now),
            };
            const snapshotItem = next.isPublic ? mapTrackRow({
              ...nextRow,
              owner_nickname: String(profile?.nickname || authContext.displayName || ''),
              owner_avatar_url: String(profile?.avatarUrl || profile?.avatar_url || authContext.picture || ''),
              like_count: Number(stat.like_count || 0),
              comment_count: Number(stat.comment_count || 0),
              play_count: Number(stat.play_count || 0),
            }) : null;

            try {
              if (next.isPublic) {
                await syncExploreFeedR2Publication043(env, snapshotItem);
                await patchExploreProfileR2Publication043(env, authContext.uid, {
                  trackId: row.id,
                  item: snapshotItem,
                  trackCountDelta: wasPublic ? 0 : 1,
                });
              } else {
                await syncExploreFeedR2Private043(env, row.id);
                await patchExploreProfileR2Publication043(env, authContext.uid, {
                  trackId: row.id,
                  remove: true,
                  trackCountDelta: wasPublic ? -1 : 0,
                });
              }
            } catch (error) {
              console.warn('[SORIDRAW 049] derived R2 patch deferred to self-heal:', String(error?.message || error || 'unknown'));
            }

            publicationTransitions.push({
              sourceId: mutation.sourceId,
              trackId: row.id,
              status: next.isPublic ? 'public' : 'private',
              allowNextSongApply: next.allowNextSongApply,
              allowFollowerSave: next.allowFollowerSave,
              profilePinned: next.profilePinned,
            });
            resultsBySource.set(mutation.sourceId, {
              ok: true,
              sourceId: mutation.sourceId,
              trackId: row.id,
              status: next.isPublic ? 'public' : 'private',
              registered: true,
              allowNextSongApply: next.allowNextSongApply,
              allowFollowerSave: next.allowFollowerSave,
              profilePinned: next.profilePinned,
              snapshotItem,
              mutation: changed ? 'written' : 'idempotent',
            });
            changedAny = changedAny || changed;
          }

          if (publicationTransitions.length) {
            await syncMusicNotePublicationR2Batch049(env, authContext.uid, publicationTransitions);
          }
          if (successfulDirect.some((item) => item.changed)) {
            try {
              await invalidatePublicationProfileCaches017(request, env, authContext.uid, String(profile?.handle || ''));
            } catch (error) {
              console.warn('[SORIDRAW 049] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));
            }
          }
        }
      }
    }
  }

  if (changedAny) {
    try { await invalidateExploreFeedEdgeCache(request); } catch (error) {
      console.warn('[SORIDRAW 049] feed edge invalidation skipped:', String(error?.message || error || 'unknown'));
    }
  }

  let revision = null;
  try {
    if (env?.PROFILE_MEDIA) {
      const object = await env.PROFILE_MEDIA.head(musicNotePublicationR2Key(authContext.uid));
      revision = object
        ? String(object.httpEtag || object.etag || object.customMetadata?.updatedAt || '') || null
        : null;
    }
  } catch (error) {
    console.warn('[SORIDRAW 049] publication revision head skipped:', String(error?.message || error || 'unknown'));
  }

  const results = ordered.map((mutation) => resultsBySource.get(mutation.sourceId) || ({
    ok: false,
    sourceId: mutation.sourceId,
    trackId: mutation.trackId,
    status: mutation.status,
    registered: mutation.registered,
    error: 'PUBLICATION_BATCH_RESULT_MISSING',
  }));
  return json({ ok: true, data: { results, revision } }, 200, cors);
}

const currentBatch = functionRange('handleMusicNotePublicationBatch048');
source = source.slice(0, currentBatch.start)
  + syncMusicNotePublicationR2Batch049.toString()
  + '\n\n'
  + handleMusicNotePublicationBatch049.toString().replace('handleMusicNotePublicationBatch049', 'handleMusicNotePublicationBatch048')
  + source.slice(currentBatch.end);

const finalBatch = functionRange('handleMusicNotePublicationBatch048').text;
for (const token of [
  'SELECT * FROM tracks',
  'env.DB.batch(statements)',
  "sets.push('profile_pinned=?')",
  'syncMusicNotePublicationR2Batch049',
  'track_stats WHERE track_id IN',
]) {
  if (!finalBatch.includes(token)) throw new Error(`[049] final batch missing: ${token}`);
}
if (!source.includes("profile_pinned is indexed")) throw new Error('[049] indexed-column guard missing');
const coldBundle = functionRange('handleMusicNotePublicationR2Bundle').text;
if (!coldBundle.includes('buildMusicNotePublicationR2Payload')) {
  throw new Error('[049] cold publication bundle must retain canonical D1 self-heal');
}
const mutationSync = functionRange('syncMusicNotePublicationR2AfterMutation').text;
if (mutationSync.includes('buildMusicNotePublicationR2Payload')) {
  throw new Error('[049] mutation hot path must not owner-scan D1');
}

source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[049] registered publication changes share one canonical read + one D1 batch; unchanged indexed profile_pinned is no longer rewritten; publication R2 is committed once and cold self-heal remains canonical.');

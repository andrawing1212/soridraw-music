import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_WRITE_RETURNING_051_20260914';
if (source.includes(MARKER)) {
  console.log('[051] publication write-returning compaction already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_PK_BATCH_READ_050_20260914',
  'handleMusicNotePublicationBatch048',
  'readMusicNotePublicationR2Payload',
  'syncMusicNotePublicationR2Batch049',
  'patchExploreProfileR2Publication043',
]) {
  if (!source.includes(required)) throw new Error(`[051] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[051] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
  throw new Error(`[051] unterminated function: ${name}`);
};

const transformFunction = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`[051] ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

const replaceOnce = (text, before, after, label) => {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`[051] ${label} anchor count=${count}`);
  return text.replace(before, after);
};

transformFunction('handleMusicNotePublicationBatch048', (input) => {
  let text = input;
  const oldRead = `    let canonicalRows = [];
    let canonicalReadOk = true;
    try {
      const trackIds = [...new Set(registeredMutations.map((mutation) => mutation.trackId))];
      const rows = await env.DB.prepare(\`SELECT * FROM tracks
        WHERE id IN (\${trackIds.map(() => '?').join(',')})\`).bind(
        ...trackIds,
      ).all();
      canonicalRows = (rows.results || []).filter(
        (row) => String(row?.owner_uid || '') === authContext.uid,
      );
    } catch (error) {`;

  const newRead = `    let canonicalRows = [];
    let canonicalReadOk = true;
    const preUpdatedTrackIds = new Set();
    const previousPublicBySource = new Map();
    let publicationStates = null;
    let publicationStateWarm = false;
    try {
      const publicationPayload = await readMusicNotePublicationR2Payload(env, authContext.uid);
      const candidateStates = publicationPayload?.states && typeof publicationPayload.states === 'object'
        ? publicationPayload.states
        : null;
      if (candidateStates && registeredMutations.every((mutation) => {
        const state = candidateStates[mutation.sourceId];
        return state && String(state.trackId || '') === mutation.trackId;
      })) {
        publicationStates = candidateStates;
        publicationStateWarm = true;
        for (const mutation of registeredMutations) {
          previousPublicBySource.set(
            mutation.sourceId,
            candidateStates[mutation.sourceId]?.status === 'public',
          );
        }
      }
    } catch (error) {
      console.warn('[SORIDRAW 051] publication R2 pre-state unavailable; using canonical read fallback:', String(error?.message || error || 'unknown'));
    }

    try {
      const trackIds = [...new Set(registeredMutations.map((mutation) => mutation.trackId))];
      if (publicationStateWarm) {
        const mutationNow = Date.now();
        const updateStatements = [];
        const updateMutations = [];
        const unresolvedTrackIds = new Set();

        for (const mutation of registeredMutations) {
          const previousState = publicationStates[mutation.sourceId];
          const nextValues = {
            is_public: mutation.status === 'public' ? 1 : 0,
            allow_next_song_apply: mutation.options.allowNextSongApply ? 1 : 0,
            allow_follower_save: mutation.options.allowFollowerSave ? 1 : 0,
            profile_pinned: mutation.options.profilePinned ? 1 : 0,
          };
          const previousValues = {
            is_public: previousState?.status === 'public' ? 1 : 0,
            allow_next_song_apply: previousState?.allowNextSongApply ? 1 : 0,
            allow_follower_save: previousState?.allowFollowerSave ? 1 : 0,
            profile_pinned: previousState?.profilePinned ? 1 : 0,
          };
          const sets = [];
          const values = [];
          const guards = [];
          const guardValues = [];
          for (const column of ['is_public', 'allow_next_song_apply', 'allow_follower_save', 'profile_pinned']) {
            if (previousValues[column] === nextValues[column]) continue;
            sets.push(\`\${column}=?\`);
            values.push(nextValues[column]);
            guards.push(\`\${column}<>?\`);
            guardValues.push(nextValues[column]);
          }
          if (!sets.length) {
            unresolvedTrackIds.add(mutation.trackId);
            continue;
          }
          sets.push('updated_at=?');
          values.push(mutationNow);
          const requirePublished = mutation.status === 'public' ? 1 : 0;
          updateStatements.push(env.DB.prepare(\`UPDATE tracks SET \${sets.join(',')}
            WHERE id=? AND owner_uid=? AND source_type='music_note'
              AND (?=0 OR status='published')
              AND (\${guards.join(' OR ')})
            RETURNING *\`).bind(
            ...values,
            mutation.trackId,
            authContext.uid,
            requirePublished,
            ...guardValues,
          ));
          updateMutations.push(mutation);
        }

        const rowById = new Map();
        if (updateStatements.length) {
          const updateResults = await env.DB.batch(updateStatements);
          for (let index = 0; index < updateMutations.length; index += 1) {
            const mutation = updateMutations[index];
            const row = updateResults?.[index]?.results?.[0] || null;
            if (row && String(row.owner_uid || '') === authContext.uid) {
              rowById.set(String(row.id || ''), row);
              preUpdatedTrackIds.add(mutation.trackId);
            } else {
              unresolvedTrackIds.add(mutation.trackId);
            }
          }
        }

        if (unresolvedTrackIds.size) {
          const unresolved = [...unresolvedTrackIds];
          const rows = await env.DB.prepare(\`SELECT * FROM tracks
            WHERE id IN (\${unresolved.map(() => '?').join(',')})\`).bind(...unresolved).all();
          for (const row of rows.results || []) {
            if (String(row?.owner_uid || '') !== authContext.uid) continue;
            rowById.set(String(row.id || ''), row);
          }
        }
        canonicalRows = [...rowById.values()];
      } else {
        const rows = await env.DB.prepare(\`SELECT * FROM tracks
          WHERE id IN (\${trackIds.map(() => '?').join(',')})\`).bind(...trackIds).all();
        canonicalRows = (rows.results || []).filter(
          (row) => String(row?.owner_uid || '') === authContext.uid,
        );
        const fallbackRowById = new Map(canonicalRows.map((row) => [String(row.id || ''), row]));
        for (const mutation of registeredMutations) {
          const row = fallbackRowById.get(mutation.trackId);
          if (!row) continue;
          previousPublicBySource.set(
            mutation.sourceId,
            Number(row.is_public || 0) === 1 && String(row.status || '') === 'published',
          );
        }
      }
    } catch (error) {`;

  text = replaceOnce(text, oldRead, newRead, 'canonical warm write-returning preflight');

  const oldState = `        const wasPublic = Number(row.is_public || 0) === 1 && String(row.status || '') === 'published';
        const changed = Number(row.is_public || 0) !== (next.isPublic ? 1 : 0)
          || Number(row.allow_next_song_apply || 0) !== (next.allowNextSongApply ? 1 : 0)
          || Number(row.allow_follower_save || 0) !== (next.allowFollowerSave ? 1 : 0)
          || Number(row.profile_pinned || 0) !== (next.profilePinned ? 1 : 0);`;
  const newState = `        const wasPublic = previousPublicBySource.has(mutation.sourceId)
          ? Boolean(previousPublicBySource.get(mutation.sourceId))
          : (Number(row.is_public || 0) === 1 && String(row.status || '') === 'published');
        const changed = preUpdatedTrackIds.has(mutation.trackId)
          || Number(row.is_public || 0) !== (next.isPublic ? 1 : 0)
          || Number(row.allow_next_song_apply || 0) !== (next.allowNextSongApply ? 1 : 0)
          || Number(row.allow_follower_save || 0) !== (next.allowFollowerSave ? 1 : 0)
          || Number(row.profile_pinned || 0) !== (next.profilePinned ? 1 : 0);`;
  text = replaceOnce(text, oldState, newState, 'pre-state and changed detection');

  text = replaceOnce(
    text,
    '            if (!item.changed) continue;',
    '            if (!item.changed || preUpdatedTrackIds.has(item.mutation.trackId)) continue;',
    'skip duplicate canonical update',
  );

  const statsStart = text.indexOf('        const publicIds = [...new Set(direct.filter((item) => item.next.isPublic).map((item) => item.mutation.trackId))];');
  const statsEndNeedle = '\n\n        if (!statsReady) {';
  const statsEnd = text.indexOf(statsEndNeedle, statsStart);
  if (statsStart < 0 || statsEnd < 0) throw new Error('[051] stats preflight range missing');
  const statsReplacement = `        // Publication state changes do not need engagement D1 reads. R2 feed/profile
        // mutations preserve already-materialized counters, matching the proven 024 contract.
        const statsById = new Map();
        const statsReady = true;`;
  text = text.slice(0, statsStart) + statsReplacement + text.slice(statsEnd);

  return text;
});

source += `\n\n// ${MARKER}\n`;

const finalBatch = functionRange('handleMusicNotePublicationBatch048').text;
for (const required of [
  'readMusicNotePublicationR2Payload(env, authContext.uid)',
  'publicationStateWarm',
  'env.DB.batch(updateStatements)',
  'RETURNING *',
  'preUpdatedTrackIds',
  "WHERE id=? AND owner_uid=? AND source_type='music_note'",
  'syncMusicNotePublicationR2Batch049',
]) {
  if (!finalBatch.includes(required)) throw new Error(`[051] final batch missing: ${required}`);
}
if (finalBatch.includes('FROM track_stats WHERE track_id IN')) {
  throw new Error('[051] public mutation hot path still reads track_stats');
}
if (/SELECT \* FROM tracks\s+WHERE owner_uid=\? AND id IN/.test(finalBatch)) {
  throw new Error('[051] owner-wide canonical read reintroduced');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[051] warm registered publication mutations now write with RETURNING, read D1 only for unresolved/cold fallback, and skip track_stats preflight.');

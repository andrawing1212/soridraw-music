import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const MARKER = 'SORIDRAW_PUBLICATION_MEDIA_INLINE_SOURCE_333_20261004';
if (source.includes(MARKER)) {
  console.log('[093] publication inline media source patch already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_PUBLICATION_MEDIA_SOURCE_COST_329_20261003')) {
  throw new Error('[093] app329 publication media source patch missing');
}

const replaceOnce = (before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`[093] ${label} anchor count=${count}`);
  source = source.replace(before, after);
};

const batchAnchor = 'async function handleMusicNotePublicationBatch048(request, env, cors) {';
if (!source.includes(batchAnchor)) throw new Error('[093] publication batch anchor missing');
const helper = `function normalizePublicationSourceMedia093(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sunoUrlPrimary = String(value.sunoUrlPrimary || '').trim().slice(0, 4096);
  if (!sunoUrlPrimary || !/^https?:\\/\\//i.test(sunoUrlPrimary)) return null;
  const rawDuration = value.durationSeconds;
  const parsedDuration = rawDuration == null || rawDuration === '' ? null : Number(rawDuration);
  return {
    coverUrl: String(value.coverUrl || '').trim().slice(0, 4096),
    durationSeconds: parsedDuration == null || !Number.isFinite(parsedDuration)
      ? null
      : Math.max(0, parsedDuration),
    sunoUrlPrimary,
    sunoUrlSecondary: String(value.sunoUrlSecondary || '').trim().slice(0, 4096) || null,
  };
}

`;
source = source.replace(batchAnchor, helper + batchAnchor);

replaceOnce(
  "      refreshSourceContent: value?.refreshSourceContent === true,\n      refreshSourceMedia: value?.refreshSourceMedia === true,\n      options: pageSyncPublicationOptions048(value?.options),",
  "      refreshSourceContent: value?.refreshSourceContent === true,\n      refreshSourceMedia: value?.refreshSourceMedia === true,\n      sourceMedia: normalizePublicationSourceMedia093(value?.sourceMedia),\n      options: pageSyncPublicationOptions048(value?.options),",
  'parse inline sourceMedia',
);

replaceOnce(
`        try {
          const note = await fetchFirestoreDocument(['favorites', mutation.sourceId], authContext);
          if (mutation.refreshSourceContent) {
            const encodedLyrics = note ? encodeTrackLyrics270(note) : '';
            if (encodedLyrics) refreshedLyricsBySource.set(mutation.sourceId, encodedLyrics.slice(0, 3e4));
          }
          if (mutation.refreshSourceMedia && note) {
            const media = buildMusicNoteExploreSource(note, authContext.uid, mutation.sourceId);
            refreshedMediaBySource.set(mutation.sourceId, {
              coverUrl: String(media.coverUrl || ''),
              durationSeconds: media.durationSeconds == null ? null : Number(media.durationSeconds),
              sunoUrlPrimary: String(media.sunoUrlPrimary || ''),
              sunoUrlSecondary: media.sunoUrlSecondary ? String(media.sunoUrlSecondary) : null,
            });
          }
        } catch (error) {
          console.warn('[SORIDRAW 329] publication source refresh skipped:', String(error?.message || error || 'unknown'));
        }`,
`        try {
          let note = null;
          const inlineMedia = mutation.refreshSourceMedia ? mutation.sourceMedia : null;
          if (mutation.refreshSourceContent || (mutation.refreshSourceMedia && !inlineMedia)) {
            note = await fetchFirestoreDocument(['favorites', mutation.sourceId], authContext);
          }
          if (mutation.refreshSourceContent) {
            const encodedLyrics = note ? encodeTrackLyrics270(note) : '';
            if (encodedLyrics) refreshedLyricsBySource.set(mutation.sourceId, encodedLyrics.slice(0, 3e4));
          }
          if (mutation.refreshSourceMedia) {
            let media = inlineMedia;
            if (!media && note) {
              const built = buildMusicNoteExploreSource(note, authContext.uid, mutation.sourceId);
              media = {
                coverUrl: String(built.coverUrl || ''),
                durationSeconds: built.durationSeconds == null ? null : Number(built.durationSeconds),
                sunoUrlPrimary: String(built.sunoUrlPrimary || ''),
                sunoUrlSecondary: built.sunoUrlSecondary ? String(built.sunoUrlSecondary) : null,
              };
            }
            if (media?.sunoUrlPrimary) refreshedMediaBySource.set(mutation.sourceId, media);
          }
        } catch (error) {
          console.warn('[SORIDRAW 333] publication source refresh skipped:', String(error?.message || error || 'unknown'));
        }`,
  'prefer inline media over Firestore read',
);

replaceOnce(
  `    const source = await resolvePublicationSource(body, authContext);
    const publicationOptions = normalizePublicationOptions(body);
    return await handleMusicNotePublicationSingleWrite016(request, env, cors, authContext, source, publicationOptions);`,
  `    const resolvedSource = await resolvePublicationSource(body, authContext);
    const inlineMedia = normalizePublicationSourceMedia093(body?.sourceMedia);
    const source = inlineMedia ? {
      ...resolvedSource,
      coverUrl: inlineMedia.coverUrl,
      durationSeconds: inlineMedia.durationSeconds,
      sunoUrlPrimary: inlineMedia.sunoUrlPrimary,
      sunoUrlSecondary: inlineMedia.sunoUrlSecondary,
    } : resolvedSource;
    const publicationOptions = normalizePublicationOptions(body);
    return await handleMusicNotePublicationSingleWrite016(request, env, cors, authContext, source, publicationOptions);`,
  'apply inline media to first publication source',
);

source += '\n// ' + MARKER + '\n';
writeFileSync(workerPath, source, 'utf8');
console.log('[093] selected publication media can settle in the same Worker request without an immediate Firestore read.');

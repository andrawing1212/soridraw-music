import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const MARKER = 'SORIDRAW_PUBLICATION_MEDIA_SOURCE_COST_329_20261003';
if (source.includes(MARKER)) {
  console.log('[092] publication media source cost patch already applied.');
  process.exit(0);
}

const replaceOnce = (before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`[092] ${label} anchor count=${count}`);
  source = source.replace(before, after);
};

replaceOnce(
  "      refreshSourceContent: value?.refreshSourceContent === true,\n      options: pageSyncPublicationOptions048(value?.options),",
  "      refreshSourceContent: value?.refreshSourceContent === true,\n      refreshSourceMedia: value?.refreshSourceMedia === true,\n      options: pageSyncPublicationOptions048(value?.options),",
  'parse refreshSourceMedia',
);
replaceOnce(
  "          if (mutation.refreshSourceContent) {\n            unresolvedTrackIds.add(mutation.trackId);\n            continue;\n          }",
  "          if (mutation.refreshSourceContent || mutation.refreshSourceMedia) {\n            unresolvedTrackIds.add(mutation.trackId);\n            continue;\n          }",
  'skip warm preupdate',
);

const oldRefresh = `      const refreshedLyricsBySource = new Map();
      for (const mutation of registeredMutations) {
        if (!mutation.refreshSourceContent) continue;
        const row = rowById.get(mutation.trackId);
        if (!row || String(row.source_type || '') !== 'music_note') continue;
        try {
          const note = await fetchFirestoreDocument(['favorites', mutation.sourceId], authContext);
          const encodedLyrics = note ? encodeTrackLyrics270(note) : '';
          if (encodedLyrics) refreshedLyricsBySource.set(mutation.sourceId, encodedLyrics.slice(0, 3e4));
        } catch (error) {
          console.warn('[SORIDRAW 271] legacy publication lyrics refresh skipped:', String(error?.message || error || 'unknown'));
        }
      }`;
const newRefresh = `      const refreshedLyricsBySource = new Map();
      const refreshedMediaBySource = new Map();
      for (const mutation of registeredMutations) {
        if (!mutation.refreshSourceContent && !mutation.refreshSourceMedia) continue;
        const row = rowById.get(mutation.trackId);
        if (!row || String(row.source_type || '') !== 'music_note') continue;
        try {
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
        }
      }`;
replaceOnce(oldRefresh, newRefresh, 'fetch media source');

const oldChanged = `        const refreshedLyrics = String(refreshedLyricsBySource.get(mutation.sourceId) || '');
        const changed = preUpdatedTrackIds.has(mutation.trackId)
          || Number(row.is_public || 0) !== (next.isPublic ? 1 : 0)
          || Number(row.allow_next_song_apply || 0) !== (next.allowNextSongApply ? 1 : 0)
          || Number(row.allow_follower_save || 0) !== (next.allowFollowerSave ? 1 : 0)
          || Number(row.profile_pinned || 0) !== (next.profilePinned ? 1 : 0)
          || Boolean(refreshedLyrics && String(row.lyrics || '') !== refreshedLyrics);
        direct.push({ mutation, row, next, wasPublic, changed, refreshedLyrics });`;
const newChanged = `        const refreshedLyrics = String(refreshedLyricsBySource.get(mutation.sourceId) || '');
        const refreshedMedia = refreshedMediaBySource.get(mutation.sourceId) || null;
        const currentDuration = row.duration_seconds == null ? null : Number(row.duration_seconds);
        const mediaChanged = Boolean(refreshedMedia && (
          String(row.cover_url || '') !== String(refreshedMedia.coverUrl || '')
          || currentDuration !== refreshedMedia.durationSeconds
          || String(row.suno_url_primary || '') !== String(refreshedMedia.sunoUrlPrimary || '')
          || String(row.suno_url_secondary || '') !== String(refreshedMedia.sunoUrlSecondary || '')
        ));
        const changed = preUpdatedTrackIds.has(mutation.trackId)
          || Number(row.is_public || 0) !== (next.isPublic ? 1 : 0)
          || Number(row.allow_next_song_apply || 0) !== (next.allowNextSongApply ? 1 : 0)
          || Number(row.allow_follower_save || 0) !== (next.allowFollowerSave ? 1 : 0)
          || Number(row.profile_pinned || 0) !== (next.profilePinned ? 1 : 0)
          || Boolean(refreshedLyrics && String(row.lyrics || '') !== refreshedLyrics)
          || mediaChanged;
        direct.push({ mutation, row, next, wasPublic, changed, refreshedLyrics, refreshedMedia });`;
replaceOnce(oldChanged, newChanged, 'detect media');

replaceOnce(
  "            if (item.refreshedLyrics && String(item.row.lyrics || '') !== item.refreshedLyrics) {\n              sets.push('lyrics=?');\n              values.push(item.refreshedLyrics);\n            }\n            sets.push('updated_at=?');",
  "            if (item.refreshedLyrics && String(item.row.lyrics || '') !== item.refreshedLyrics) {\n              sets.push('lyrics=?');\n              values.push(item.refreshedLyrics);\n            }\n            if (item.refreshedMedia) {\n              const nextMedia = item.refreshedMedia;\n              const currentDuration = item.row.duration_seconds == null ? null : Number(item.row.duration_seconds);\n              if (String(item.row.cover_url || '') !== String(nextMedia.coverUrl || '')) { sets.push('cover_url=?'); values.push(nextMedia.coverUrl || ''); }\n              if (currentDuration !== nextMedia.durationSeconds) { sets.push('duration_seconds=?'); values.push(nextMedia.durationSeconds); }\n              if (String(item.row.suno_url_primary || '') !== String(nextMedia.sunoUrlPrimary || '')) { sets.push('suno_url_primary=?'); values.push(nextMedia.sunoUrlPrimary); }\n              if (String(item.row.suno_url_secondary || '') !== String(nextMedia.sunoUrlSecondary || '')) { sets.push('suno_url_secondary=?'); values.push(nextMedia.sunoUrlSecondary); }\n            }\n            sets.push('updated_at=?');",
  'narrow media update',
);
replaceOnce(
  "              lyrics: item.refreshedLyrics || row.lyrics,\n              updated_at: changed ? now : Number(row.updated_at || now),",
  "              lyrics: item.refreshedLyrics || row.lyrics,\n              ...(item.refreshedMedia ? { cover_url: item.refreshedMedia.coverUrl || '', duration_seconds: item.refreshedMedia.durationSeconds, suno_url_primary: item.refreshedMedia.sunoUrlPrimary, suno_url_secondary: item.refreshedMedia.sunoUrlSecondary } : {}),\n              updated_at: changed ? now : Number(row.updated_at || now),",
  'R2 snapshot media',
);
source += '\n// ' + MARKER + '\n';
writeFileSync(workerPath, source, 'utf8');
console.log('[092] registered Music Note source swaps use a narrow canonical media update.');

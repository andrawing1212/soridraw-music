#!/usr/bin/env node
'use strict';

/**
 * Read-only diagnostic for recent Music API / Suno generation records.
 *
 * SAFETY:
 * - Firestore reads only.
 * - No set/create/update/delete/batch/transaction calls.
 * - Never prints document IDs, UIDs, titles, lyrics, prompts, API keys, request payload values, or audio URLs.
 * - Intended only to distinguish: no Firestore record vs submitted/processing/failed/completed record.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const projectId = String(readArg('project', process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '')).trim();
const minutes = Math.max(5, Math.min(180, Number(readArg('minutes', '90')) || 90));

if (projectId !== 'soridraw-app-866a5') {
  console.error(`Refusing to run against unexpected project: ${projectId || '(empty)'}`);
  process.exit(2);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const timestampToMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
};

const hasString = (value) => typeof value === 'string' && value.trim().length > 0;
const firstNumber = (...values) => values.find((value) => typeof value === 'number' && Number.isFinite(value));

(async () => {
  const startedAt = Date.now();
  const cutoff = startedAt - minutes * 60 * 1000;

  // Current production inventory has a small tracks collection group. Reading it all avoids
  // adding a new composite-index dependency just for this diagnostic.
  const snapshot = await db.collectionGroup('tracks').get();
  const recent = [];
  let sunoTrackDocumentsScanned = 0;

  for (const entry of snapshot.docs) {
    const path = entry.ref.path || '';
    if (!path.startsWith('suno_tracks/')) continue;
    sunoTrackDocumentsScanned += 1;

    const data = entry.data() || {};
    const createdAtMs = timestampToMs(data.createdAt);
    const updatedAtMs = timestampToMs(data.updatedAt);
    const activityAtMs = Math.max(createdAtMs, updatedAtMs);
    if (!activityAtMs || activityAtMs < cutoff) continue;

    const status = String(data.status || '').trim().toLowerCase() || 'missing';
    const sunoDataItems = Array.isArray(data.sunoData) ? data.sunoData.length : 0;
    const audioUrlsItems = Array.isArray(data.audioUrls) ? data.audioUrls.length : 0;
    const hasAudio = hasString(data.audioUrl)
      || hasString(data.streamAudioUrl)
      || hasString(data.audio_url)
      || audioUrlsItems > 0
      || (Array.isArray(data.sunoData) && data.sunoData.some((item) => hasString(item?.audio_url) || hasString(item?.audioUrl) || hasString(item?.streamAudioUrl)));

    const apiResponseCode = firstNumber(
      data.apiResponse?.code,
      data.apiResponse?.status,
      data.apiResponse?.data?.code,
      data.apiStatusResponse?.code,
      data.apiStatusResponse?.status,
      data.apiStatusResponse?.data?.code,
    );

    const taskId = hasString(data.taskId) ? data.taskId.trim() : '';
    const providerTaskIdPresent = hasString(data.apiResponse?.data?.taskId) || hasString(data.apiResponse?.taskId);

    recent.push({
      createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
      updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
      status,
      taskIdPresent: Boolean(taskId && taskId !== 'unknown'),
      taskIdUnknown: taskId === 'unknown',
      providerTaskIdPresent,
      apiResponseCode: apiResponseCode ?? null,
      apiResponsePresent: Boolean(data.apiResponse),
      apiStatusResponsePresent: Boolean(data.apiStatusResponse),
      requestPayloadPresent: Boolean(data.requestPayload),
      hasAudio,
      sunoDataItems,
      audioUrlsItems,
      failureMarkerPresent: Boolean(data.failureReason || data.errorMessage || ['failed', 'cancelled', 'canceled'].includes(status)),
      provider: hasString(data.provider) ? String(data.provider) : null,
    });
  }

  recent.sort((a, b) => Date.parse(b.updatedAt || b.createdAt || '1970-01-01') - Date.parse(a.updatedAt || a.createdAt || '1970-01-01'));

  const statusCounts = {};
  for (const row of recent) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;

  const report = {
    tool: 'diagnose-recent-suno-tracks-readonly',
    projectId,
    generatedAt: new Date().toISOString(),
    lookbackMinutes: minutes,
    safety: {
      databaseWrites: 0,
      databaseDeletes: 0,
      documentIdsPrinted: false,
      userIdsPrinted: false,
      contentValuesPrinted: false,
      apiKeysPrinted: false,
    },
    scan: {
      collectionGroupDocumentsRead: snapshot.size,
      sunoTrackDocumentsScanned,
      recentSunoTrackRecords: recent.length,
      statusCounts,
    },
    recent: recent.slice(0, 20),
    elapsedMs: Date.now() - startedAt,
  };

  process.stdout.write(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error('read-only Suno diagnostic failed:', error?.message || String(error));
  process.exit(1);
});

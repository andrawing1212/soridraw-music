#!/usr/bin/env node
'use strict';

/**
 * Read-only health probe for the newest completed Music API/Suno audio endpoints.
 *
 * SAFETY
 * - Firestore reads only.
 * - Never writes/deletes Firestore or RTDB data.
 * - Never prints document IDs, UIDs, titles, lyrics, prompts, API keys, request payloads, or full audio URLs.
 * - External audio URLs are held in memory only. Output is limited to redacted field name + host + HTTP metadata + sampled byte count.
 * - GET probes request only bytes 0-1023 and cancel after the first received chunk.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const projectId = String(readArg('project', process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '')).trim();
const minutes = Math.max(5, Math.min(180, Number(readArg('minutes', '120')) || 120));

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

const AUDIO_URL_KEYS = new Set([
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url',
  'sourceAudioUrl', 'source_audio_url', 'sourceStreamAudioUrl', 'source_stream_audio_url',
  'musicUrl', 'music_url', 'downloadUrl', 'download_url', 'playUrl', 'play_url',
  'mediaUrl', 'media_url', 'mp3Url', 'mp3_url', 'url',
]);

const collectAudioCandidates = (data) => {
  const candidates = [];
  const seenPairs = new Set();
  const add = (key, value, source) => {
    if (!hasString(value)) return;
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const pairKey = `${key}\n${url}`;
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    candidates.push({ key, url, source });
  };

  add('audioUrl', data.audioUrl, 'stored-root');
  add('streamAudioUrl', data.streamAudioUrl, 'stored-root');
  add('audio_url', data.audio_url, 'stored-root');
  if (Array.isArray(data.audioUrls)) data.audioUrls.forEach((value) => add('audioUrls[]', value, 'stored-root'));

  const walk = (value, source, depth = 0) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, source, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (AUDIO_URL_KEYS.has(key) && hasString(child)) add(key, child, source);
      if (child && typeof child === 'object') walk(child, source, depth + 1);
    }
  };

  walk(data.sunoData, 'stored-sunoData');
  walk(data.apiStatusResponse, 'apiStatusResponse');
  walk(data.apiResponse, 'apiResponse');
  return candidates;
};

const getHeader = (headers, name) => {
  try { return headers.get(name) || null; } catch { return null; }
};

const classifyContentType = (contentType) => {
  const normalized = String(contentType || '').toLowerCase();
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.includes('octet-stream')) return 'binary';
  if (!normalized) return 'unknown';
  return 'non_audio';
};

const probeOne = async (candidate) => {
  const rawUrl = candidate.url;
  let sourceHost = 'invalid';
  try { sourceHost = new URL(rawUrl).host || 'invalid'; } catch {}

  const result = {
    candidateKey: candidate.key,
    candidateSource: candidate.source,
    sourceHost,
    headStatus: null,
    headContentLength: null,
    headContentType: null,
    headAcceptRanges: null,
    headCors: null,
    rangeStatus: null,
    rangeContentLength: null,
    rangeContentRange: null,
    rangeContentType: null,
    rangeCors: null,
    sampledBytes: 0,
    finalHost: null,
    classification: 'unknown',
    errorType: null,
  };

  const headController = new AbortController();
  const headTimer = setTimeout(() => headController.abort(), 10000);
  try {
    const head = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: headController.signal,
      headers: { 'User-Agent': 'SORIDRAW-readonly-audio-health/1.0' },
    });
    result.headStatus = head.status;
    result.headContentLength = getHeader(head.headers, 'content-length');
    result.headContentType = getHeader(head.headers, 'content-type');
    result.headAcceptRanges = getHeader(head.headers, 'accept-ranges');
    result.headCors = getHeader(head.headers, 'access-control-allow-origin');
    try { result.finalHost = new URL(head.url).host || null; } catch {}
  } catch (error) {
    result.errorType = error?.name || 'HEAD_ERROR';
  } finally {
    clearTimeout(headTimer);
  }

  const rangeController = new AbortController();
  const rangeTimer = setTimeout(() => rangeController.abort(), 12000);
  try {
    const response = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: rangeController.signal,
      headers: {
        Range: 'bytes=0-1023',
        'User-Agent': 'SORIDRAW-readonly-audio-health/1.0',
      },
    });
    result.rangeStatus = response.status;
    result.rangeContentLength = getHeader(response.headers, 'content-length');
    result.rangeContentRange = getHeader(response.headers, 'content-range');
    result.rangeContentType = getHeader(response.headers, 'content-type');
    result.rangeCors = getHeader(response.headers, 'access-control-allow-origin');
    try { result.finalHost = new URL(response.url).host || result.finalHost; } catch {}

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const first = await reader.read();
      if (!first.done && first.value) result.sampledBytes = first.value.byteLength || first.value.length || 0;
      try { await reader.cancel(); } catch {}
    } else {
      const body = await response.arrayBuffer();
      result.sampledBytes = Math.min(body.byteLength || 0, 1024);
    }

    const contentClass = classifyContentType(result.rangeContentType);
    if ((response.status === 200 || response.status === 206) && result.sampledBytes > 0 && (contentClass === 'audio' || contentClass === 'binary' || contentClass === 'unknown')) {
      result.classification = 'healthy_audio_bytes';
    } else if ((response.status === 200 || response.status === 206) && result.sampledBytes > 0) {
      result.classification = 'non_audio_bytes';
    } else if ((response.status === 200 || response.status === 206) && result.sampledBytes === 0) {
      result.classification = 'success_but_empty_body';
    } else if (response.status >= 400) {
      result.classification = 'http_error';
    } else {
      result.classification = 'unexpected_response';
    }
  } catch (error) {
    result.errorType = result.errorType || error?.name || 'GET_ERROR';
    result.classification = 'request_error';
  } finally {
    clearTimeout(rangeTimer);
  }

  return result;
};

(async () => {
  const startedAt = Date.now();
  const cutoff = startedAt - minutes * 60 * 1000;
  const snapshot = await db.collectionGroup('tracks').get();

  let newest = null;
  let scannedSunoTrackDocs = 0;
  for (const entry of snapshot.docs) {
    const path = entry.ref.path || '';
    if (!path.startsWith('suno_tracks/')) continue;
    scannedSunoTrackDocs += 1;
    const data = entry.data() || {};
    const createdAtMs = timestampToMs(data.createdAt);
    const updatedAtMs = timestampToMs(data.updatedAt);
    const activityAtMs = Math.max(createdAtMs, updatedAtMs);
    if (!activityAtMs || activityAtMs < cutoff) continue;
    if (String(data.status || '').trim().toLowerCase() !== 'completed') continue;
    const candidates = collectAudioCandidates(data);
    if (candidates.length === 0) continue;
    if (!newest || activityAtMs > newest.activityAtMs) {
      newest = { data, createdAtMs, updatedAtMs, activityAtMs, candidates };
    }
  }

  const uniqueCandidates = [];
  const seenUrls = new Map();
  if (newest) {
    for (const candidate of newest.candidates) {
      const existing = seenUrls.get(candidate.url);
      if (existing) {
        existing.keys.add(candidate.key);
        existing.sources.add(candidate.source);
        continue;
      }
      const grouped = {
        ...candidate,
        keys: new Set([candidate.key]),
        sources: new Set([candidate.source]),
      };
      seenUrls.set(candidate.url, grouped);
      uniqueCandidates.push(grouped);
    }
  }

  const probes = [];
  for (const candidate of uniqueCandidates.slice(0, 12)) {
    const probe = await probeOne(candidate);
    probe.candidateKeys = Array.from(candidate.keys).sort();
    probe.candidateSources = Array.from(candidate.sources).sort();
    delete probe.candidateKey;
    delete probe.candidateSource;
    probes.push(probe);
  }

  const classificationCounts = {};
  for (const probe of probes) classificationCounts[probe.classification] = (classificationCounts[probe.classification] || 0) + 1;

  const discoveredFieldCounts = {};
  if (newest) {
    for (const candidate of newest.candidates) {
      discoveredFieldCounts[candidate.key] = (discoveredFieldCounts[candidate.key] || 0) + 1;
    }
  }

  const report = {
    tool: 'diagnose-recent-audio-endpoints-readonly',
    projectId,
    generatedAt: new Date().toISOString(),
    lookbackMinutes: minutes,
    safety: {
      databaseWrites: 0,
      databaseDeletes: 0,
      rtdbReads: 0,
      rtdbWrites: 0,
      documentIdsPrinted: false,
      userIdsPrinted: false,
      contentValuesPrinted: false,
      apiKeysPrinted: false,
      audioUrlsPrinted: false,
      externalProbeRangeMaxBytes: 1024,
    },
    firestoreReads: {
      collectionGroupDocumentsRead: snapshot.size,
      sunoTrackDocumentsScanned: scannedSunoTrackDocs,
    },
    newestCompletedTrack: newest ? {
      createdAt: newest.createdAtMs ? new Date(newest.createdAtMs).toISOString() : null,
      updatedAt: newest.updatedAtMs ? new Date(newest.updatedAtMs).toISOString() : null,
      status: String(newest.data.status || '').trim().toLowerCase(),
      provider: hasString(newest.data.provider) ? String(newest.data.provider) : null,
      candidateOccurrences: newest.candidates.length,
      uniqueEndpointCount: uniqueCandidates.length,
      discoveredFieldCounts,
    } : null,
    probeSummary: {
      endpointCount: probes.length,
      classificationCounts,
      healthyEndpointPresent: probes.some((probe) => probe.classification === 'healthy_audio_bytes'),
    },
    probes,
    elapsedMs: Date.now() - startedAt,
  };

  process.stdout.write(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error('read-only audio endpoint diagnostic failed:', error?.message || String(error));
  process.exit(1);
});

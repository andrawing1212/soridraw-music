#!/usr/bin/env node
'use strict';

/**
 * SORIDRAW Backend V2 read-only Realtime Database usage snapshot.
 *
 * SAFETY CONTRACT
 * - Does not read RTDB application data.
 * - Does not write/delete RTDB, Firestore, Auth, Storage, or Functions.
 * - Reads only aggregate Cloud Monitoring metrics for the explicit target project.
 * - Does not print Firebase namespace / instance identifiers.
 */

const admin = require('firebase-admin');
const https = require('https');
const { URLSearchParams } = require('url');

const args = process.argv.slice(2);
const projectArg = args.find((value) => value.startsWith('--project='));
const hoursArg = args.find((value) => value.startsWith('--hours='));
const projectId = String(projectArg?.slice('--project='.length) || '').trim();
const hours = Math.max(1, Math.min(48, Number(hoursArg?.slice('--hours='.length) || 24) || 24));

if (!projectId) {
  console.error('[rtdb-usage-readonly] --project is required');
  process.exit(1);
}

const requestJson = (url, accessToken) => new Promise((resolve, reject) => {
  const req = https.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy(new Error('Monitoring response too large'));
    });
    res.on('end', () => {
      const status = Number(res.statusCode || 0);
      if (status < 200 || status >= 300) {
        reject(new Error(`Cloud Monitoring API ${status}: ${body.slice(0, 400)}`));
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
  req.setTimeout(10_000, () => req.destroy(new Error('Cloud Monitoring API timeout')));
  req.on('error', reject);
});

const pointValue = (point) => {
  const raw = point?.value?.int64Value ?? point?.value?.doubleValue ?? null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const queryMetric = async (metricType, startMs, endMs, accessToken) => {
  const params = new URLSearchParams({
    filter: `metric.type = "${metricType}"`,
    'interval.startTime': new Date(startMs).toISOString(),
    'interval.endTime': new Date(endMs).toISOString(),
    view: 'FULL',
    pageSize: '1000',
  });
  const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${params.toString()}`;
  const payload = await requestJson(url, accessToken);
  const series = Array.isArray(payload.timeSeries) ? payload.timeSeries : [];
  const points = [];
  for (const item of series) {
    for (const point of Array.isArray(item.points) ? item.points : []) {
      const value = pointValue(point);
      if (value === null) continue;
      const endTime = Date.parse(String(point?.interval?.endTime || ''));
      points.push({ value, endTime: Number.isFinite(endTime) ? endTime : 0 });
    }
  }
  return { seriesCount: series.length, points };
};

const latestGauge = (result) => {
  if (!result.points.length) return null;
  return [...result.points].sort((a, b) => b.endTime - a.endTime)[0].value;
};

const maxGauge = (result) => result.points.length
  ? Math.max(...result.points.map((point) => point.value))
  : null;

const sumDelta = (result) => result.points.reduce((sum, point) => sum + Math.max(0, point.value), 0);

const main = async () => {
  if (admin.apps.length === 0) admin.initializeApp({ projectId });

  const access = await admin.credential.applicationDefault().getAccessToken();
  const accessToken = String(access?.access_token || '');
  if (!accessToken) throw new Error('Google Cloud access token unavailable');

  const endMs = Date.now();
  const startMs = endMs - (hours * 60 * 60 * 1000);
  const metricTypes = {
    sentBytes: 'firebasedatabase.googleapis.com/network/sent_bytes_count',
    activeConnections: 'firebasedatabase.googleapis.com/network/active_connections',
    storageBytes: 'firebasedatabase.googleapis.com/storage/total_bytes',
    databaseLoad: 'firebasedatabase.googleapis.com/io/database_load',
  };

  const [sentBytes, activeConnections, storageBytes, databaseLoad] = await Promise.all([
    queryMetric(metricTypes.sentBytes, startMs, endMs, accessToken),
    queryMetric(metricTypes.activeConnections, startMs, endMs, accessToken),
    queryMetric(metricTypes.storageBytes, startMs, endMs, accessToken),
    queryMetric(metricTypes.databaseLoad, startMs, endMs, accessToken),
  ]);

  const report = {
    tool: 'SORIDRAW Backend V2 RTDB Cloud Monitoring read-only snapshot',
    safety: {
      rtdbApplicationReads: 0,
      databaseWrites: 0,
      databaseDeletes: 0,
      namespaceIdentifiersPrinted: false,
    },
    projectId,
    generatedAt: new Date(endMs).toISOString(),
    windowHours: hours,
    metrics: {
      sentBytesTotal: Math.round(sumDelta(sentBytes)),
      activeConnectionsLatest: latestGauge(activeConnections),
      activeConnectionsMax: maxGauge(activeConnections),
      storageBytesLatest: latestGauge(storageBytes),
      databaseLoadMax: maxGauge(databaseLoad),
    },
    pointAvailability: {
      sentBytes: sentBytes.points.length,
      activeConnections: activeConnections.points.length,
      storageBytes: storageBytes.points.length,
      databaseLoad: databaseLoad.points.length,
    },
    metricTypes,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main().catch((error) => {
  console.error('[rtdb-usage-readonly] failed:', error?.message || error);
  process.exitCode = 1;
});

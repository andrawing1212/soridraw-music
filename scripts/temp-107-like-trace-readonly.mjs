import { appendFileSync, readFileSync } from 'node:fs';

// One-shot diagnostic only. No runtime code, write SQL, object mutation or deploy.
const trackId = 'music_note_rcZ2GZrBndOZzT8C635eiNBjYIJ2_rs_sd_6ca2115f1b474aa7a60f1a2bdabd6317_k4e95q';
const ownerUid = 'rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const worker = 'soridraw-explore-preview';
const bucket = 'soridraw-profile-media-preview';
const api = 'https://soridraw-explore-preview.andrawing1212.workers.dev';
// The repository's existing release uses a fixed account identifier (not a credential).
// Reuse that exact PREVIEW setting when the optional account Secret is absent.
const releaseWorkflow = readFileSync('.github/workflows/cloudflare-explore-preview-release.yml', 'utf8');
const account = process.env.CLOUDFLARE_ACCOUNT_ID || releaseWorkflow.match(/^\s+CLOUDFLARE_ACCOUNT_ID:\s+([a-f0-9]{32})\s*$/m)?.[1];
const token = process.env.CLOUDFLARE_API_TOKEN;
const rows = [];
function emit(stage, likeCount, extra = {}) {
  const row = { stage, trackId, likeCount, ...extra };
  rows.push(row);
  console.log(JSON.stringify(row));
}
async function cf(path, sql) {
  if (!account || !token) throw new Error('Required Cloudflare Actions secret unavailable');
  if (sql && (!/^SELECT\b/i.test(sql.sql) || /;|\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|ATTACH)\b/i.test(sql.sql))) {
    throw new Error('Read-only SQL guard rejected query');
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    method: sql ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(sql ? { body: JSON.stringify(sql) } : {}),
  });
  // Never print request URLs, headers, credentials, full settings or raw API errors.
  if (!response.ok) throw new Error(`Cloudflare read failed: HTTP ${response.status}`);
  const data = await response.json();
  if (data.success === false) throw new Error('Cloudflare read returned unsuccessful result');
  return { data: data.result ?? data, etag: response.headers.get('etag') };
}
function findItem(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.id === trackId || value.trackId === trackId) return value;
  for (const child of Object.values(value)) {
    const match = findItem(child);
    if (match) return match;
  }
  return null;
}
function itemCount(item) {
  return item?.likeCount ?? item?.stats?.likeCount ?? item?.like_count ?? null;
}
try {
  const { data: settings } = await cf(`workers/scripts/${worker}/settings`);
  const { data: deployments } = await cf(`workers/scripts/${worker}/deployments`);
  const active = deployments.deployments?.[0]?.versions;
  if (active?.length !== 1 || Number(active[0].percentage) !== 100) throw new Error('PREVIEW must have one active version');
  console.log(`PREVIEW_WORKER_VERSION=${active[0].version_id}`);
  const binding = settings.bindings?.find(b => b.type === 'd1' && b.name === 'DB');
  const cache = settings.bindings?.find(b => b.type === 'r2_bucket' && b.name === 'EXPLORE_CACHE');
  const db = binding?.id ?? binding?.database_id;
  const expected = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));
  if (!db || db !== expected.d1_databases.find(b => b.binding === 'DB').database_id) throw new Error('Unexpected PREVIEW DB binding');
  if (cache?.bucket_name !== bucket) throw new Error('PREVIEW-only cache binding mismatch');
  console.log('RESOURCE_SCOPE=active PREVIEW DB binding and PREVIEW EXPLORE_CACHE only');
  const query = async (sql, params = []) => {
    const { data } = await cf(`d1/database/${db}/query`, { sql, params });
    for (const result of data) {
      if (result.success === false || Number(result.meta?.rows_written ?? 0) !== 0) throw new Error('D1 SELECT verification failed');
      console.log(JSON.stringify({ diagnosticD1Read: result.meta?.rows_read, diagnosticD1Write: result.meta?.rows_written }));
    }
    return data.flatMap(result => result.results ?? []);
  };
  const [row] = await query(`SELECT t.id,t.owner_uid,t.title,
    (SELECT COUNT(*) FROM likes l WHERE l.track_id=t.id) AS membership_count,
    s.like_count AS stat_count,d.likes AS derived_rank_count,
    json_extract(d.row_json,'$.like_count') AS derived_snake_count,
    json_extract(d.row_json,'$.likeCount') AS derived_camel_count
    FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
    LEFT JOIN explore_derived_tracks d ON d.id=t.id WHERE t.id=?`, [trackId]);
  if (!row || row.owner_uid !== ownerUid) throw new Error('Expected public track missing');
  emit('likes membership', row.membership_count);
  emit('track_stats.like_count', row.stat_count);
  emit('derived row_json.like_count', row.derived_snake_count, { camelCase: row.derived_camel_count, rankCount: row.derived_rank_count });
  const triggers = await query("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='track_stats' ORDER BY name");
  for (const trigger of triggers) console.log(JSON.stringify({ statsTrigger: trigger.name, definition: trigger.sql }));
  for (const [name, key] of [
    ['R2 latest', 'internal/explore/feed-v1/latest-40.json'],
    ['R2 popular', 'internal/explore/feed-v1/popular-40.json'],
    ['R2 public profile', `internal/explore/profile-first-view-v1/${ownerUid}.json`],
  ]) {
    const { data, etag } = await cf(`r2/buckets/${bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`);
    const item = findItem(data);
    emit(name, itemCount(item), { found: Boolean(item), etag, topLevel: item?.likeCount ?? null, nested: item?.stats?.likeCount ?? null });
    if (!item) throw new Error('Target item absent from existing R2 cache; stopping before runtime recovery');
  }
  for (const [name, path] of [
    ['API latest', '/v1/feed?sort=latest&limit=40'],
    ['API popular', '/v1/feed?sort=popular&limit=40'],
    ['API public profile', `/v1/profiles/${ownerUid}/first-view?limit=50`],
  ]) {
    const response = await fetch(api + path, { headers: { Origin: 'https://preview.soridraw.com' } });
    if (!response.ok) throw new Error(`PREVIEW API read failed: HTTP ${response.status}`);
    const item = findItem(await response.json());
    const diagnostics = Object.fromEntries([...response.headers].filter(([key]) => /soridraw.*(d1|r2|revision)/.test(key)));
    emit(name, itemCount(item), { found: Boolean(item), diagnostics });
  }
  console.log('READONLY_TRACE_COMPLETE=true');
} catch (error) {
  // Only our controlled messages are logged; never serialize third-party errors.
  const message = String(error?.message ?? 'Unknown diagnostic failure');
  console.error((token && message.includes(token)) || (account && message.includes(account)) ? 'Read-only diagnostic failed' : message);
  process.exitCode = 1;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '| Stage | trackId | likeCount |\n|---|---|---|\n' + rows.map(row => `| ${row.stage} | ${row.trackId} | ${row.likeCount ?? 'missing'} |`).join('\n') + '\n');
}

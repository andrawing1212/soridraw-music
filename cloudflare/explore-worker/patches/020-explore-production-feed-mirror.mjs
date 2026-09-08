import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908';
if (source.includes(marker)) {
  console.log('[020] production Explore feed mirror already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[020] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[020] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[020] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'readExploreR2Json',
  'writeExploreR2Json',
  'exploreFeedR2Key',
  'invalidateExploreFeedEdgeCache',
  'handleFeedWithEdgeCache',
]) {
  if (!source.includes(required)) throw new Error(`[020] required runtime helper missing: ${required}`);
}

const helperRange = functionRange('handleFeedWithEdgeCache');

const helpers = `// ${marker}
const EXPLORE_MIRROR_ROUTE_020 = "/__soridraw_explore_feed_mirror_020";
const EXPLORE_MIRROR_SYNC_ROUTE_020 = "/__soridraw_explore_feed_sync_020";
const EXPLORE_MIRROR_TARGETS_020 = [
  { environment: "preview", url: "https://soridraw-explore-preview.andrawing1212.workers.dev" + EXPLORE_MIRROR_ROUTE_020, origin: "https://preview.soridraw.com" },
  { environment: "test", url: "https://soridraw-explore-test.andrawing1212.workers.dev" + EXPLORE_MIRROR_ROUTE_020, origin: "https://test.soridraw.com" }
];
const EXPLORE_MIRROR_ALLOWED_TABLES_020 = new Map([
  ["public_profiles", "uid"],
  ["tracks", "id"],
  ["track_stats", "track_id"],
  ["public_profile_first_views", "uid"]
]);

function exploreMirrorEnvironment020(env) {
  return String(env?.SORIDRAW_ENVIRONMENT || "").trim().toLowerCase();
}

function exploreMirrorToken020(env) {
  return String(env?.EXPLORE_MIRROR_TOKEN || "").trim();
}

function exploreMirrorSafeIdentifier020(value) {
  const text = String(value || "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) throw new Error("invalid SQL identifier");
  return '"' + text.replace(/"/g, '""') + '"';
}

function exploreMirrorUniqueText020(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

async function exploreMirrorTableColumns020(env, table) {
  const safeTable = exploreMirrorSafeIdentifier020(table);
  const result = await env.DB.prepare("PRAGMA table_xinfo(" + safeTable + ")").all();
  return (result.results || [])
    .filter((row) => Number(row.hidden || 0) === 0)
    .map((row) => String(row.name || "").trim())
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
}

async function exploreMirrorSelectRows020(env, table, keyColumn, ids) {
  const wanted = exploreMirrorUniqueText020(ids);
  if (!wanted.length) return { columns: [], rows: [] };
  const columns = await exploreMirrorTableColumns020(env, table);
  if (!columns.length) return { columns: [], rows: [] };
  const safeTable = exploreMirrorSafeIdentifier020(table);
  const safeKey = exploreMirrorSafeIdentifier020(keyColumn);
  const safeColumns = columns.map(exploreMirrorSafeIdentifier020).join(', ');
  const placeholders = wanted.map(() => '?').join(',');
  const result = await env.DB.prepare(
    "SELECT " + safeColumns + " FROM " + safeTable + " WHERE " + safeKey + " IN (" + placeholders + ")"
  ).bind(...wanted).all();
  return { columns, rows: result.results || [] };
}

async function exploreMirrorSelectTrackTags020(env, trackIds) {
  const wanted = exploreMirrorUniqueText020(trackIds);
  if (!wanted.length) return { columns: [], rows: [], trackIds: [] };
  const columns = await exploreMirrorTableColumns020(env, "track_tags");
  if (!columns.length) return { columns: [], rows: [], trackIds: wanted };
  const placeholders = wanted.map(() => '?').join(',');
  const result = await env.DB.prepare(
    "SELECT " + columns.map(exploreMirrorSafeIdentifier020).join(', ') + " FROM track_tags WHERE track_id IN (" + placeholders + ")"
  ).bind(...wanted).all();
  return { columns, rows: result.results || [], trackIds: wanted };
}

function exploreMirrorFeedItems020(bundle) {
  const items = bundle?.payload?.data?.items;
  return Array.isArray(items) ? items : [];
}

async function buildExploreMirrorPayload020(env, changedTrackId, fullSnapshot) {
  let latest = await readExploreR2Json(env, exploreFeedR2Key("latest"));
  let popular = await readExploreR2Json(env, exploreFeedR2Key("popular"));
  if (!latest?.payload?.data?.items || !popular?.payload?.data?.items) {
    try { await safelyRefreshExploreFeedR2Bundles(env, "production feed mirror"); } catch {}
    latest = await readExploreR2Json(env, exploreFeedR2Key("latest"));
    popular = await readExploreR2Json(env, exploreFeedR2Key("popular"));
  }
  if (!latest?.payload?.data?.items || !popular?.payload?.data?.items) {
    throw new Error("canonical Explore R2 feed bundles unavailable");
  }

  const feedItems = [...exploreMirrorFeedItems020(latest), ...exploreMirrorFeedItems020(popular)];
  const feedTrackIds = exploreMirrorUniqueText020(feedItems.map((item) => item?.id || item?.trackId));
  const selectedTrackIds = fullSnapshot
    ? feedTrackIds
    : exploreMirrorUniqueText020([changedTrackId]);
  const tracks = await exploreMirrorSelectRows020(env, "tracks", "id", selectedTrackIds);
  const ownerUids = exploreMirrorUniqueText020([
    ...feedItems.map((item) => item?.ownerUid || item?.owner_uid),
    ...tracks.rows.map((row) => row?.owner_uid)
  ]);
  const selectedOwnerUids = fullSnapshot
    ? ownerUids
    : exploreMirrorUniqueText020(tracks.rows.map((row) => row?.owner_uid));

  const [profiles, stats, firstViews, tags] = await Promise.all([
    exploreMirrorSelectRows020(env, "public_profiles", "uid", selectedOwnerUids),
    exploreMirrorSelectRows020(env, "track_stats", "track_id", selectedTrackIds),
    exploreMirrorSelectRows020(env, "public_profile_first_views", "uid", selectedOwnerUids),
    exploreMirrorSelectTrackTags020(env, selectedTrackIds)
  ]);

  return {
    schemaVersion: 1,
    sourceEnvironment: "production",
    mirroredAt: Date.now(),
    changedTrackId: String(changedTrackId || ""),
    fullSnapshot: Boolean(fullSnapshot),
    feedBundles: { latest, popular },
    tables: {
      public_profiles: profiles,
      tracks,
      track_stats: stats,
      public_profile_first_views: firstViews,
      track_tags: tags
    }
  };
}

async function applyExploreMirrorUpsert020(env, table, payload) {
  const conflictKey = EXPLORE_MIRROR_ALLOWED_TABLES_020.get(table);
  if (!conflictKey) throw new Error("unsupported mirror table: " + table);
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const columns = Array.isArray(payload?.columns) ? payload.columns.map((value) => String(value || "")).filter(Boolean) : [];
  if (!rows.length || !columns.length) return 0;

  const targetColumns = new Set(await exploreMirrorTableColumns020(env, table));
  const usable = columns.filter((name) => targetColumns.has(name) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
  if (!usable.includes(conflictKey)) throw new Error("mirror conflict key missing: " + table + "." + conflictKey);
  const updateColumns = usable.filter((name) => name !== conflictKey);
  const safeTable = exploreMirrorSafeIdentifier020(table);
  const columnSql = usable.map(exploreMirrorSafeIdentifier020).join(', ');
  const placeholders = usable.map(() => '?').join(',');
  const updateSql = updateColumns.length
    ? " DO UPDATE SET " + updateColumns.map((name) => exploreMirrorSafeIdentifier020(name) + "=excluded." + exploreMirrorSafeIdentifier020(name)).join(', ')
    : " DO NOTHING";
  const sql = "INSERT INTO " + safeTable + " (" + columnSql + ") VALUES (" + placeholders + ") ON CONFLICT(" + exploreMirrorSafeIdentifier020(conflictKey) + ")" + updateSql;

  let applied = 0;
  for (let start = 0; start < rows.length; start += 20) {
    const page = rows.slice(start, start + 20);
    const statements = page.map((row) => env.DB.prepare(sql).bind(...usable.map((name) => row?.[name] ?? null)));
    if (statements.length) {
      await env.DB.batch(statements);
      applied += statements.length;
    }
  }
  return applied;
}

async function applyExploreMirrorTags020(env, payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const columns = Array.isArray(payload?.columns) ? payload.columns.map((value) => String(value || "")).filter(Boolean) : [];
  const trackIds = exploreMirrorUniqueText020([...(Array.isArray(payload?.trackIds) ? payload.trackIds : []), ...rows.map((row) => row?.track_id)]);
  if (!trackIds.length || !columns.length) return 0;
  const targetColumns = new Set(await exploreMirrorTableColumns020(env, "track_tags"));
  const usable = columns.filter((name) => targetColumns.has(name) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
  if (!usable.includes("track_id")) throw new Error("mirror track_tags.track_id missing");

  for (let start = 0; start < trackIds.length; start += 25) {
    const page = trackIds.slice(start, start + 25);
    const placeholders = page.map(() => '?').join(',');
    await env.DB.prepare("DELETE FROM track_tags WHERE track_id IN (" + placeholders + ")").bind(...page).run();
  }

  if (!rows.length) return 0;
  const sql = "INSERT INTO track_tags (" + usable.map(exploreMirrorSafeIdentifier020).join(', ') + ") VALUES (" + usable.map(() => '?').join(',') + ")";
  let applied = 0;
  for (let start = 0; start < rows.length; start += 20) {
    const page = rows.slice(start, start + 20);
    const statements = page.map((row) => env.DB.prepare(sql).bind(...usable.map((name) => row?.[name] ?? null)));
    if (statements.length) {
      await env.DB.batch(statements);
      applied += statements.length;
    }
  }
  return applied;
}

async function applyExploreMirrorPayload020(request, env, payload) {
  if (exploreMirrorEnvironment020(env) === "production") throw new Error("production cannot accept mirrored feed payloads");
  const tables = payload?.tables && typeof payload.tables === "object" ? payload.tables : {};
  const applied = {};
  applied.public_profiles = await applyExploreMirrorUpsert020(env, "public_profiles", tables.public_profiles || {});
  applied.tracks = await applyExploreMirrorUpsert020(env, "tracks", tables.tracks || {});
  applied.track_stats = await applyExploreMirrorUpsert020(env, "track_stats", tables.track_stats || {});
  applied.public_profile_first_views = await applyExploreMirrorUpsert020(env, "public_profile_first_views", tables.public_profile_first_views || {});
  applied.track_tags = await applyExploreMirrorTags020(env, tables.track_tags || {});

  const latest = payload?.feedBundles?.latest;
  const popular = payload?.feedBundles?.popular;
  if (!latest?.payload?.data?.items || !popular?.payload?.data?.items) throw new Error("mirrored feed bundles invalid");
  await Promise.all([
    writeExploreR2Json(env, exploreFeedR2Key("latest"), latest),
    writeExploreR2Json(env, exploreFeedR2Key("popular"), popular)
  ]);
  try { await invalidateExploreFeedEdgeCache(request); } catch (error) {
    console.warn("[SORIDRAW 020] target feed edge invalidation skipped:", String(error?.message || error || "unknown"));
  }
  return applied;
}

async function fanoutExploreMirror020(env, changedTrackId, fullSnapshot) {
  if (exploreMirrorEnvironment020(env) !== "production") return { skipped: true };
  const token = exploreMirrorToken020(env);
  if (!token) throw new Error("EXPLORE_MIRROR_TOKEN missing on production Worker");
  const payload = await buildExploreMirrorPayload020(env, changedTrackId, fullSnapshot);
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(EXPLORE_MIRROR_TARGETS_020.map(async (target) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SORIDRAW-Explore-Mirror": token,
          "Origin": target.origin
        },
        body,
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) throw new Error(target.environment + " mirror HTTP " + response.status + ": " + text.slice(0, 300));
      return { environment: target.environment, ok: true };
    } finally {
      clearTimeout(timeout);
    }
  }));
  for (const result of results) {
    if (result.status === "rejected") console.warn("[SORIDRAW 020] Explore mirror target failed:", String(result.reason?.message || result.reason || "unknown"));
  }
  return { skipped: false, payload, results };
}

async function handleExploreMirrorRoute020(request, env) {
  const token = exploreMirrorToken020(env);
  if (!token || request.headers.get("X-SORIDRAW-Explore-Mirror") !== token) return new Response("not found", { status: 404 });
  try {
    const payload = await request.json();
    const applied = await applyExploreMirrorPayload020(request, env, payload);
    return Response.json({ ok: true, environment: exploreMirrorEnvironment020(env), applied }, { status: 200 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error || "unknown") }, { status: 500 });
  }
}

async function handleExploreMirrorSyncRoute020(request, env) {
  const token = exploreMirrorToken020(env);
  if (!token || request.headers.get("X-SORIDRAW-Explore-Mirror") !== token) return new Response("not found", { status: 404 });
  if (exploreMirrorEnvironment020(env) !== "production") return Response.json({ ok: false, error: "production only" }, { status: 403 });
  try {
    const result = await fanoutExploreMirror020(env, "", true);
    return Response.json({ ok: true, mirrored: !result.skipped }, { status: 200 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error || "unknown") }, { status: 500 });
  }
}

`;
source = source.slice(0, helperRange.start) + helpers + source.slice(helperRange.start);

const insertBeforeLastJsonReturn020 = (name, block) => {
  const range = functionRange(name);
  const matches = [...range.text.matchAll(/return\s+json\s*\(/g)];
  const match = matches[matches.length - 1];
  if (!match) throw new Error(`[020] json return missing in ${name}`);
  const index = match.index;
  const nextText = range.text.slice(0, index) + block + range.text.slice(index);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

insertBeforeLastJsonReturn020(
  'handleMusicNotePublicationSingleWrite016',
  `if (exploreMirrorEnvironment020(env) === "production" && !unchanged) {\n    try {\n      await fanoutExploreMirror020(env, source.id, false);\n    } catch (error) {\n      console.warn("[SORIDRAW 020] production Explore mirror skipped:", String(error?.message || error || "unknown"));\n    }\n  }\n\n  `,
);

for (const [name, idExpr] of [
  ['handleMusicNotePrivate017', 'row.id'],
  ['handleMusicNotePublicationOptions017', 'row.id'],
]) {
  if (!source.includes(`function ${name}(`)) continue;
  insertBeforeLastJsonReturn020(
    name,
    `if (exploreMirrorEnvironment020(env) === "production" && changed) {\n    try {\n      await fanoutExploreMirror020(env, ${idExpr}, false);\n    } catch (error) {\n      console.warn("[SORIDRAW 020] production Explore mirror skipped:", String(error?.message || error || "unknown"));\n    }\n  }\n\n  `,
  );
}

const routePattern020 = /if\s*\(\s*url\.pathname\s*===\s*["']\/v1\/publications["']\s*&&\s*request\.method\s*===\s*["']POST["']\s*\)\s*\{/;
const routeMatch020 = source.match(routePattern020);
if (!routeMatch020 || routeMatch020.index === undefined) throw new Error('[020] route anchor missing');
const mirrorRoutes = `if (url.pathname === EXPLORE_MIRROR_ROUTE_020 && request.method === "POST") {\n      return await handleExploreMirrorRoute020(request, env);\n    }\n    if (url.pathname === EXPLORE_MIRROR_SYNC_ROUTE_020 && request.method === "POST") {\n      return await handleExploreMirrorSyncRoute020(request, env);\n    }\n    `;
source = source.slice(0, routeMatch020.index) + mirrorRoutes + source.slice(routeMatch020.index);

for (const required of [
  marker,
  'fanoutExploreMirror020(env, source.id, false)',
  'EXPLORE_MIRROR_ROUTE_020',
  'EXPLORE_MIRROR_SYNC_ROUTE_020',
  'X-SORIDRAW-Explore-Mirror',
]) {
  if (!source.includes(required)) throw new Error(`[020] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[020] production public Explore feed now mirrors to isolated Preview/Test on real publication mutations; one-time full feed sync route enabled.');

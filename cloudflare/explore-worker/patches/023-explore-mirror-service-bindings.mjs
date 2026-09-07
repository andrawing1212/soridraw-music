import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_MIRROR_SERVICE_BINDINGS_023_20260908';
if (source.includes(marker)) {
  console.log('[023] Explore mirror service bindings already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908',
  'SORIDRAW_EXPLORE_MIRROR_STRICT_SYNC_022_20260908',
  'EXPLORE_MIRROR_ROUTE_020',
  'EXPLORE_MIRROR_TARGETS_020',
]) {
  if (!source.includes(required)) throw new Error(`[023] missing prerequisite ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[023] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
    else if (c === '}' && --depth === 0) return { start, end: i + 1 };
  }
  throw new Error(`[023] unterminated function: ${name}`);
};

async function fanoutExploreMirror023(env, changedTrackId, fullSnapshot) {
  if (exploreMirrorEnvironment020(env) !== "production") return { skipped: true };
  const token = exploreMirrorToken020(env);
  if (!token) throw new Error("EXPLORE_MIRROR_TOKEN missing on production Worker");
  const payload = await buildExploreMirrorPayload020(env, changedTrackId, fullSnapshot);
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(EXPLORE_MIRROR_TARGETS_020.map(async (target) => {
    const service = target.environment === "preview" ? env?.EXPLORE_MIRROR_PREVIEW : env?.EXPLORE_MIRROR_TEST;
    if (!service || typeof service.fetch !== "function") {
      throw new Error(target.environment + " Explore mirror service binding missing");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const request = new Request("https://soridraw-mirror.internal" + EXPLORE_MIRROR_ROUTE_020, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SORIDRAW-Explore-Mirror": token,
          "Origin": target.origin
        },
        body,
        signal: controller.signal
      });
      const response = await service.fetch(request);
      const text = await response.text();
      if (!response.ok) throw new Error(target.environment + " mirror HTTP " + response.status + ": " + text.slice(0, 300));
      return { environment: target.environment, ok: true };
    } finally {
      clearTimeout(timeout);
    }
  }));
  for (const result of results) {
    if (result.status === "rejected") console.warn("[SORIDRAW 023] Explore mirror target failed:", String(result.reason?.message || result.reason || "unknown"));
  }
  return { skipped: false, payload, results };
}

const range = functionRange('fanoutExploreMirror020');
const replacement = `// ${marker}\n${fanoutExploreMirror023.toString().replace('fanoutExploreMirror023', 'fanoutExploreMirror020')}`;
source = source.slice(0, range.start) + replacement + source.slice(range.end);

for (const required of [marker, 'EXPLORE_MIRROR_PREVIEW', 'EXPLORE_MIRROR_TEST', 'service.fetch(request)']) {
  if (!source.includes(required)) throw new Error(`[023] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[023] production Explore mirror fanout now uses Cloudflare Service Bindings instead of same-zone workers.dev fetch.');

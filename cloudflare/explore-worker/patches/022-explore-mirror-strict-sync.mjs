import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_MIRROR_STRICT_SYNC_022_20260908';
if (source.includes(marker)) {
  console.log('[022] strict Explore mirror sync already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908')) {
  throw new Error('[022] patch 020 must be applied first.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[022] function missing: ${name}`);
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
  throw new Error(`[022] unterminated function: ${name}`);
};

async function handleExploreMirrorSyncRoute022(request, env) {
  const token = exploreMirrorToken020(env);
  if (!token || request.headers.get("X-SORIDRAW-Explore-Mirror") !== token) return new Response("not found", { status: 404 });
  if (exploreMirrorEnvironment020(env) !== "production") return Response.json({ ok: false, error: "production only" }, { status: 403 });
  try {
    const result = await fanoutExploreMirror020(env, "", true);
    const settled = Array.isArray(result?.results) ? result.results : [];
    const failures = settled.filter((entry) => entry?.status !== "fulfilled");
    if (result?.skipped || settled.length !== EXPLORE_MIRROR_TARGETS_020.length || failures.length) {
      const errors = failures.map((entry) => String(entry?.reason?.message || entry?.reason || "mirror target failed"));
      return Response.json({ ok: false, error: "mirror targets incomplete", targetCount: settled.length, errors }, { status: 502 });
    }
    return Response.json({
      ok: true,
      mirrored: true,
      targetCount: settled.length,
      targets: settled.map((entry) => entry?.value?.environment || "unknown")
    }, { status: 200 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error || "unknown") }, { status: 500 });
  }
}

const range = functionRange('handleExploreMirrorSyncRoute020');
const replacement = `// ${marker}\n${handleExploreMirrorSyncRoute022.toString().replace('handleExploreMirrorSyncRoute022', 'handleExploreMirrorSyncRoute020')}`;
source = source.slice(0, range.start) + replacement + source.slice(range.end);

for (const required of [marker, 'targetCount: settled.length', 'failures.length']) {
  if (!source.includes(required)) throw new Error(`[022] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[022] one-time production Explore mirror now passes only when both isolated targets complete D1/R2 apply successfully.');

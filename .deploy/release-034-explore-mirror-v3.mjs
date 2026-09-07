import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.cwd());
const sourcePath = join(ROOT, '.deploy', 'release-034-explore-mirror-v2.mjs');
const runtimePath = join(ROOT, '.deploy', '.release-034-explore-mirror-v3-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`[034-v3] function missing: ${name}`);
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
  throw new Error(`[034-v3] unterminated function: ${name}`);
};

const range = functionRange('d1Count');
const replacement = `async function d1Count(target, sql, configPath) {
  void configPath;
  const response = await fetch(
    \`https://api.cloudflare.com/client/v4/accounts/\${ACCOUNT_ID}/d1/database/\${target.dbId}/query\`,
    {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    },
  );
  const envelope = await response.json();
  if (!response.ok || envelope?.success === false) {
    throw new Error(\`D1 read-only query failed for \${target.env}: \${response.status} \${JSON.stringify(envelope).slice(0, 800)}\`);
  }
  const result = Array.isArray(envelope?.result) ? envelope.result[0] : envelope?.result;
  return Number(result?.results?.[0]?.n || 0);
}`;
source = source.slice(0, range.start) + replacement + source.slice(range.end);
source = source.replace("const RELEASE_DIR = join(WORKER_DIR, '.release034v2');", "const RELEASE_DIR = join(WORKER_DIR, '.release034v3');");
writeFileSync(runtimePath, source, 'utf8');

console.log('[034-v3] D1 validation switched from Wrangler CLI to Cloudflare read-only query API.');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);

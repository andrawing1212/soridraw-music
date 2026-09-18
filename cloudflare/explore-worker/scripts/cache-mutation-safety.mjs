import { readFileSync } from 'node:fs';

// This is an upgrade of 031, including Workers which already contain its old marker.
// Keep runtime source separate from string-replacement mechanics so tests execute it.
export function applyCacheMutationSafety(source) {
  const marker = 'SORIDRAW_CACHE_MUTATION_CAS_052';
  if (source.includes(marker) || source.includes('async function mutateExploreR2Cache052(')) return source;
  source = source.replaceAll('\r\n', '\n');
  for (const name of ['buildExploreFeedR2Payload', 'writeExploreR2Json']) {
    if (!source.includes('async function ' + name + '(')) throw new Error('Missing snapshot writer: ' + name);
    source = source.replace('async function ' + name + '(', 'async function ' + name + 'Core052(');
  }
  const profileAnchor = 'async function rebuildExploreProfileR2Bounded020(env, profileRef, knownBundle = null) {';
  if (source.includes(profileAnchor)) {
    source = source.replace(profileAnchor, profileAnchor + '\n  let cacheBaseline052 = null;');
    // Dashboard bundles remove comments. Locate the executable guard inside this function.
    const bodyStart = source.indexOf(profileAnchor);
    const guard = '  if (!uid) return null;';
    const at = source.indexOf(guard, bodyStart);
    if (at < 0) throw new Error('Profile repair UID guard missing');
    source = source.slice(0, at + guard.length) + '\n  cacheBaseline052 = await exploreCacheBucket031(env).get(exploreProfileR2Key(uid));\n  if (cacheBaseline052) { try { knownBundle = JSON.parse(await cacheBaseline052.text()); } catch {} }' + source.slice(at + guard.length);
    const write = '  await writeExploreR2Json(env, exploreProfileR2Key(uid), bundle);';
    if (!source.includes(write)) throw new Error('Profile repair write anchor missing');
    source = source.replace(write, '  bundle[EXPLORE_CACHE_SNAPSHOT_052] = { etag: cacheBaseline052?.etag };\n' + write);
  }
  source = source.replace("console.warn('[SORIDRAW R2 feed] refresh failed:', reason,", "if (error?.code === 'CACHE_SNAPSHOT_CONFLICT') throw error;\n    console.warn('[SORIDRAW R2 feed] refresh failed:', reason,");
  const stateWrite = '    writeExploreR2Json(env, EXPLORE_SHARED_CACHE_STATE_KEY_031, {';
  if (source.includes(stateWrite)) {
    source = source.replace('writeExploreR2Json(env, exploreFeedR2Key("popular"), popular),\n' + stateWrite,
      'writeExploreR2Json(env, exploreFeedR2Key("popular"), popular)\n  ]);\n  await writeExploreR2Json(env, EXPLORE_SHARED_CACHE_STATE_KEY_031, {');
    source = source.replace('      rebuiltAt: Date.now()\n    })\n  ]);', '      rebuiltAt: Date.now()\n    });');
  }
  const runtime = readFileSync(new URL('../runtime/cache-mutations.js', import.meta.url), 'utf8');
  const names = [...runtime.matchAll(/^async function (\w+)\(/gm)].map(match => match[1]);
  for (const name of names) {
    const start = source.indexOf(`async function ${name}(`);
    if (start < 0) continue;
    let depth = 0, quote = '', escaped = false, end = -1;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === quote) quote = '';
      } else if ('"\'`'.includes(c)) quote = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) throw new Error(`Unterminated cache function: ${name}`);
    source = source.slice(0, start) + source.slice(end);
  }
  for (const name of ['sortExploreFeedItems012', 'buildExploreFeedCursor012', 'sortProfileTracks019', 'exploreCacheBucket031']) {
    if (!source.includes(`function ${name}(`)) throw new Error(`Missing cache prerequisite: ${name}`);
  }
  return `${source}\n// ${marker}\n${runtime}\n`;
}

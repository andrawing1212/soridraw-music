// Read-only release input capture. No Cloudflare/Firebase data API or mutation.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

export const TARGETS = [
  { stage: 'preview', name: 'soridraw-media-preview', media: 'soridraw-media-preview' },
  { stage: 'test', name: 'soridraw-media-test', media: 'soridraw-media-test' },
  { stage: 'production', name: 'soridraw-media', media: 'soridraw-media' },
];
export function activeId(payload) {
  const deployment = (payload?.deployments || payload || [])[0];
  const versions = deployment?.versions || [];
  if (versions.length !== 1 || Number(versions[0].percentage) !== 100
    || !/^[a-f0-9-]{36}$/i.test(versions[0].version_id || '')) throw Error('SINGLE_ACTIVE_VERSION_REQUIRED');
  return versions[0].version_id;
}
export function safeBindings(settings, target) {
  const bindings = settings?.bindings || [];
  const one = name => {
    const matches = bindings.filter(b => b.name === name);
    if (matches.length !== 1) throw Error('BINDING_MISSING_OR_DUPLICATE:' + name);
    return matches[0];
  };
  for (const [name, expected] of [['MEDIA', target.media], ['CATALOG', 'soridraw-user-catalog']]) {
    const b = one(name);
    if (b.type !== 'r2_bucket' || (b.bucket_name || b.bucket) !== expected) throw Error('BINDING_DRIFT:' + name);
  }
  const flag = one('SORIDRAW_SHARED_CATALOG_V1');
  if (flag.type !== 'plain_text' || String(flag.text ?? flag.value) !== '1') throw Error('SHARED_FLAG_DRIFT');
  // Never archive values of secrets or unrelated runtime variables.
  return { media: target.media, catalog: 'soridraw-user-catalog', sharedFlag: '1',
    bindingNames: bindings.map(b => ({ name: String(b.name), type: String(b.type) })).sort((a,b)=>a.name.localeCompare(b.name)) };
}
export function decodeModule(version) {
  const modules = version?.modules;
  if (!Array.isArray(modules) || modules.length !== 1 || !modules[0].content_base64) throw Error('EXACT_SINGLE_MODULE_REQUIRED');
  const source = Buffer.from(modules[0].content_base64, 'base64');
  if (source.length < 5000) throw Error('ACTIVE_SOURCE_TOO_SMALL');
  return source;
}
export async function capture(get, target, account) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${target.name}`;
  const before = activeId(await get(base + '/deployments'));
  const settings = await get(base + '/settings');
  const safe = safeBindings(settings, target);
  const version = await get(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/workers/${target.name}/versions/${before}?include=modules`);
  const source = decodeModule(version);
  if (activeId(await get(base + '/deployments')) !== before) throw Error('ACTIVE_CHANGED_DURING_CAPTURE');
  const text = source.toString('utf8');
  return { source, summary: { stage: target.stage, worker: target.name, activeVersion: before,
    sourceSha256: createHash('sha256').update(source).digest('hex'), sourceBytes: source.length,
    ...safe, markersOnlyNotRuntimeProof: {
      musicNoteField: text.includes('favoriteColorTag'), libraryField: text.includes('favoriteColorTags'),
      notePreservationHelper: text.includes('preserveExistingCatalogColors'),
      libraryPreservationHelper: text.includes('preserveExistingLibrarySwatches') || text.includes('preserveExistingCatalogColors'),
    } } };
}
async function selfTest() {
  const id = '83175bcc-fe25-4d17-86c0-1592e47d358e';
  const deployment = { deployments: [{ versions: [{ version_id: id, percentage: 100 }] }] };
  const settings = { bindings: [
    { name: 'MEDIA', type: 'r2_bucket', bucket_name: TARGETS[0].media },
    { name: 'CATALOG', type: 'r2_bucket', bucket_name: 'soridraw-user-catalog' },
    { name: 'SORIDRAW_SHARED_CATALOG_V1', type: 'plain_text', text: '1' },
    { name: 'SECRET', type: 'secret_text', text: 'must-not-be-output' },
  ] };
  assert.equal(activeId(deployment), id);
  assert.throws(() => activeId({ deployments: [{ versions: [{ version_id: id, percentage: 50 }] }] }));
  assert.throws(() => safeBindings({ bindings: settings.bindings.filter(x=>x.name!=='CATALOG') }, TARGETS[0]));
  assert.throws(() => safeBindings(settings, TARGETS[1]));
  assert.equal(JSON.stringify(safeBindings(settings, TARGETS[0])).includes('must-not-be-output'), false);
  let calls = [];
  const mock = async url => { calls.push(url); return url.includes('/settings') ? settings : url.includes('?include=modules')
    ? { modules: [{ content_base64: Buffer.from('fixture'.repeat(1000)).toString('base64') }] } : deployment; };
  const result = await capture(mock, TARGETS[0], 'fixture-account');
  assert.equal(calls.length, 4);
  assert.equal(result.summary.activeVersion, id);
  assert.equal(calls.every(url=>url.startsWith('https://api.cloudflare.com/') && /\/(deployments|settings)$|\?include=modules$/.test(url)), true);
  let deploymentReads=0;
  await assert.rejects(capture(async url=>{
    if(url.endsWith('/deployments') && ++deploymentReads===2) return { deployments:[{versions:[{version_id:'f0a86688-5ffc-42ed-aecd-c01f8c17c636',percentage:100}]}] };
    return mock(url);
  }, TARGETS[0], 'fixture-account'), /ACTIVE_CHANGED/);
  console.log('MEDIA_COLOR_PREFLIGHT_READONLY_BINDINGS_SECRET_REDACTION_AND_DRIFT=PASS');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) throw Error('CONFIGURED_CLOUDFLARE_ACCESS_REQUIRED');
  const out = resolve('.media-color-preflight');
  mkdirSync(out, { recursive: true });
  const get = async url => {
    const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!response.ok) throw Error('CLOUDFLARE_READ_HTTP_' + response.status);
    const body = await response.json();
    if (body.success === false) throw Error('CLOUDFLARE_READ_REJECTED');
    return body.result ?? body;
  };
  const results=[];
  for (const target of TARGETS) {
    const {source,summary}=await capture(get,target,account);
    writeFileSync(resolve(out,target.stage+'.js'),source);
    results.push(summary);
    console.log(JSON.stringify(summary));
  }
  writeFileSync(resolve(out,'summary.json'),JSON.stringify(results,null,2)+'\n');
  console.log('MEDIA_COLOR_PREFLIGHT_REMOTE_WRITES=0; DEPLOYMENTS=0; USER_DATA_READS=0');
}
await main();

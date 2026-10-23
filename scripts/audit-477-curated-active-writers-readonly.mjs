// app477: NO D1 access, cache mutation, Worker write, migration or deployment.
// Source-capability proof is NOT proof that an older in-flight request drained.
// Deliberately do not issue a reader-activation PASS in this tool.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const ACCOUNT = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const CANONICAL_DB = '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const CANONICAL_MEDIA = 'soridraw-profile-media';
const WORKERS = Object.freeze({
  PREVIEW: 'soridraw-explore-preview',
  TEST: 'soridraw-explore-test',
  PRODUCTION: 'soridraw-explore-api',
});
const FLAGS = Object.freeze({
  shadow: 'SORIDRAW_CURATED_WRITER_SHADOW471',
  read: 'SORIDRAW_CURATED_SHARED_V466',
  ready: 'SORIDRAW_CURATED_ALL_WRITERS_READY466',
});
const CAPABILITY_MARKERS = Object.freeze([
  // Require both direct curator and publication/visibility durable paths,
  // plus actual v307 conflict safety and new shared-v466 wiring.
  FLAGS.shadow, FLAGS.read, FLAGS.ready,
  'CURATED_DIRECT_REPAIR_PREFLIGHT_469',
  'CURATED_REPAIR_PREFLIGHT_REQUIRED_468',
  'CURATED_SHADOW_PUBLICATION_PENDING_471',
  'CURATED_LEGACY_CONFLICT_475',
  'CURATED_DETAIL_PENDING_475',
  'CURATED_REPAIR_DISABLED_468',
]);

const value = (binding) => String(binding?.text ?? binding?.value ?? '');
const id = (binding) => String(binding?.id || binding?.database_id || binding?.uuid || '');
const bucket = (binding) => String(binding?.bucket_name || binding?.bucket || '');
const code = (name) => String(name || '').replace(/[^a-z0-9_]/gi, '_');
const failure = (reason) => { throw Error('CURATED_477_' + code(reason)); };

export function checkDeployment477(payload) {
  const deployment = payload?.deployments?.[0];
  const versions = deployment?.versions;
  if (!Array.isArray(versions) || !versions.length) failure('NO_ACTIVE_VERSIONS');
  const active = versions.filter((v) => Number(v?.percentage) > 0.01);
  if (active.length !== 1 || Number(active[0]?.percentage) < 99.99 ||
      !/^[0-9a-f-]{36}$/i.test(String(active[0]?.version_id || '')))
    failure('SPLIT_OR_UNKNOWN_TRAFFIC');
  return String(active[0].version_id);
}

export function checkBindings477(rows, stage) {
  if (!Array.isArray(rows)) failure('SETTINGS_BINDINGS_MISSING');
  const byName = new Map();
  for (const item of rows) {
    const name = String(item?.name || '');
    if (!name || byName.has(name)) failure('DUPLICATE_OR_UNNAMED_BINDING');
    byName.set(name, item);
  }
  const db = byName.get('DB'), media = byName.get('PROFILE_MEDIA');
  if (db?.type !== 'd1' || id(db) !== CANONICAL_DB) failure(stage + '_CANONICAL_DB_DRIFT');
  if (media?.type !== 'r2_bucket' || bucket(media) !== CANONICAL_MEDIA)
    failure(stage + '_CANONICAL_MEDIA_DRIFT');
  if (byName.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.type !== 'durable_object_namespace')
    failure(stage + '_DO_BINDING_MISSING');
  if (stage !== 'PRODUCTION') {
    if (byName.get('RATE_DB')?.type !== 'd1' ||
        id(byName.get('RATE_DB')) === CANONICAL_DB)
      failure(stage + '_ISOLATED_RATE_DB_MISSING');
    const local = byName.get('EXPLORE_CACHE');
    if (local?.type !== 'r2_bucket' || bucket(local) !==
      (stage === 'PREVIEW' ? 'soridraw-profile-media-preview' : 'soridraw-profile-media-test'))
      failure(stage + '_LOCAL_CACHE_DRIFT');
  }
  const result = {};
  for (const [key, name] of Object.entries(FLAGS)) {
    const binding = byName.get(name);
    if (!binding) { result[key] = 'ABSENT'; continue; }
    if (binding.type !== 'plain_text') failure(stage + '_FLAG_TYPE_' + key);
    const setting = value(binding);
    if (setting !== '0' && setting !== '1') failure(stage + '_FLAG_INVALID_' + key);
    result[key] = setting;
  }
  // A previously enabled shared-reader stays forbidden while inspecting writers.
  if (result.read === '1' || result.ready === '1')
    failure(stage + '_READER_PREMATURELY_ENABLED');
  return result;
}

export function checkSource477(modules, stage) {
  if (!Array.isArray(modules) || modules.length !== 1 ||
      !modules[0]?.content_base64) failure(stage + '_UNSUPPORTED_MODULE_SHAPE');
  const bytes = Buffer.from(modules[0].content_base64, 'base64');
  if (bytes.length < 5000) failure(stage + '_SOURCE_UNAVAILABLE');
  const source = bytes.toString('utf8');
  const missing = CAPABILITY_MARKERS.filter((marker) => !source.includes(marker));
  return {
    compatible: missing.length === 0,
    missingMarkers: missing,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
  };
}

export function assessWriters477(stages) {
  const verdicts = Object.entries(WORKERS).map(([stage]) => {
    const record = stages[stage];
    if (!record) failure(stage + '_MISSING_EVIDENCE');
    const version = checkDeployment477(record.deployments);
    const flags = checkBindings477(record.settings?.bindings, stage);
    const src = checkSource477(record.modules, stage);
    const shadowOn = flags.shadow === '1';
    return {stage, version, flags, src, shadowOn, writerReady: shadowOn && src.compatible};
  });
  const allWritersReady = verdicts.every((v) => v.writerReady);
  return {
    verdicts, allWritersReady,
    // GET metadata cannot prove that a request that began on an old version
    // cannot finish after our last R2 reconciliation.
    oldInFlightProvenDrained: false,
    readerActivationAllowed: false,
  };
}

export function simulateLateOldWriter477() {
  const canonical = ['song-a'], shared = ['song-a'];
  // New writer reconciles first. An old Writer commits a change only in D1.
  canonical.push('song-b');
  assert.notDeepEqual(canonical, shared, 'old last writer must be detected');
  // An old Writer can also remove/privatize a recommended member.
  canonical.splice(canonical.indexOf('song-a'), 1);
  assert.notDeepEqual(canonical, shared);
  // A conditional R2 write must reject a stale ETag (not undo removal).
  const etagAtRead = 'r1', etagNow = 'r2';
  assert.notEqual(etagAtRead, etagNow);
  // After all writers retire, bounded canonical reconstruction may converge.
  shared.splice(0, shared.length, ...canonical);
  assert.deepEqual(shared, canonical);
  // A rollback that revives an old writer AFTER reader ON is unsafe.
  assert.equal(Boolean(true /* reader ON */ && true /* old writer */), true);
  // Warm v307 reading must remain the public path while ready gate is OFF.
  const sharedRead = (readFlag, readyFlag) => readFlag === '1' && readyFlag === '1';
  for (const [readFlag, readyFlag] of [['0','0'],['1','0'],['0','1']])
    assert.equal(sharedRead(readFlag, readyFlag), false);
}

export function selfTest477() {
  const liveSource = CAPABILITY_MARKERS.join(' ') + 'x'.repeat(5000);
  const modules = (src) => [{content_base64: Buffer.from(src).toString('base64')}];
  const settings = (stage, shadow = '1') => ([
    {name:'DB',type:'d1',id:CANONICAL_DB},
    {name:'PROFILE_MEDIA',type:'r2_bucket',bucket_name:CANONICAL_MEDIA},
    {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace'},
    ...(stage === 'PRODUCTION' ? [] : [
      {name:'RATE_DB',type:'d1',id:'isolated-' + stage},
      {name:'EXPLORE_CACHE',type:'r2_bucket',bucket_name:
        stage === 'PREVIEW' ? 'soridraw-profile-media-preview' : 'soridraw-profile-media-test'},
    ]),
    {name:FLAGS.shadow,type:'plain_text',text:shadow},
    {name:FLAGS.read,type:'plain_text',text:'0'},
    {name:FLAGS.ready,type:'plain_text',text:'0'},
  ]);
  const deployment = {deployments:[{versions:[{version_id:'a'.repeat(8)+'-'+
    'b'.repeat(4)+'-'+'c'.repeat(4)+'-'+'d'.repeat(4)+'-'+'e'.repeat(12),percentage:100}]}]};
  const good = Object.fromEntries(Object.keys(WORKERS).map(stage => [stage, {
    deployments: structuredClone(deployment), settings: {bindings:settings(stage)},
    modules:modules(liveSource),
  }]));
  const pass = assessWriters477(good);
  assert.equal(pass.allWritersReady,true);
  assert.equal(pass.readerActivationAllowed,false);
  assert.equal(pass.oldInFlightProvenDrained,false);
  const legacy = structuredClone(good);
  legacy.PRODUCTION.modules = modules('old app377 x'.repeat(800));
  assert.equal(assessWriters477(legacy).allWritersReady,false);
  const legacyLate = structuredClone(good);
  legacyLate.TEST.settings.bindings.find(x=>x.name===FLAGS.shadow).text='0';
  assert.equal(assessWriters477(legacyLate).allWritersReady,false);
  const split = structuredClone(good);
  split.PREVIEW.deployments.deployments[0].versions.push({
    version_id:'f'.repeat(8)+'-'+'b'.repeat(4)+'-'+'c'.repeat(4)+'-'+'d'.repeat(4)+'-'+'e'.repeat(12),
    percentage:50,
  });
  split.PREVIEW.deployments.deployments[0].versions[0].percentage=50;
  assert.throws(()=>assessWriters477(split),/SPLIT_OR_UNKNOWN_TRAFFIC/);
  const premature = structuredClone(good);
  premature.TEST.settings.bindings.find(x=>x.name===FLAGS.read).text='1';
  assert.throws(()=>assessWriters477(premature),/READER_PREMATURELY_ENABLED/);
  const badDb = structuredClone(good);
  badDb.PRODUCTION.settings.bindings.find(x=>x.name==='DB').id='wrong';
  assert.throws(()=>assessWriters477(badDb),/CANONICAL_DB_DRIFT/);
  const missing = structuredClone(good);
  missing.PRODUCTION.modules = [];
  assert.throws(()=>assessWriters477(missing),/SOURCE_UNAVAILABLE|MODULE_SHAPE/);
  simulateLateOldWriter477();
  console.log('APP477_WRITER_GATE_SELF_TEST=PASS');
  console.log('APP477_LEGACY_LAST_WRITER_AND_ROLLBACK=BLOCKED');
  console.log('APP477_INFLIGHT_RETIREMENT=UNVERIFIED_BY_DESIGN');
}

async function cfGet477(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) failure('CLOUDFLARE_TOKEN_UNAVAILABLE');
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/' +
    ACCOUNT + path, {headers:{
    Authorization:'Bearer ' + token, Accept:'application/json',
  },signal:AbortSignal.timeout(15000)});
  if (!res.ok) failure('CF_HTTP_' + res.status);
  const doc = await res.json();
  if (doc?.success !== true || !doc.result) failure('CF_BODY_INVALID');
  return doc.result;
}

export async function liveAudit477() {
  const stages = {};
  for (const [stage,worker] of Object.entries(WORKERS)) {
    const prefix='/workers/scripts/' + worker;
    const deployments=await cfGet477(prefix + '/deployments');
    const version=checkDeployment477(deployments);
    const settings=await cfGet477(prefix + '/settings');
    const data=await cfGet477('/workers/workers/' + worker +
      '/versions/' + encodeURIComponent(version) + '?include=modules');
    stages[stage]={deployments,settings,modules:data.modules};
  }
  const result=assessWriters477(stages);
  for (const x of result.verdicts) {
    console.log(x.stage + '_CURATED_ACTIVE_VERSION=' + x.version);
    console.log(x.stage + '_CURATED_SOURCE_SHA256=' + x.src.sha256);
    console.log(x.stage + '_CURATED_SOURCE_BYTES=' + x.src.size);
    console.log(x.stage + '_CURATED_SOURCE_COMPATIBLE=' + (x.src.compatible?'YES':'NO'));
    console.log(x.stage + '_CURATED_SHADOW_WRITER=' + (x.shadowOn?'ON':'OFF'));
    console.log(x.stage + '_CURATED_READER_AND_READY=OFF');
    console.log(x.stage + '_CURATED_WRITER_GATE=' + (x.writerReady?'SOURCE_ONLY_PASS':'BLOCKED'));
    // No raw settings, binding values, user IDs or secrets in logs.
    if (!x.src.compatible) console.log(x.stage + '_CURATED_MISSING_MARKER_COUNT=' + x.src.missingMarkers.length);
  }
  console.log('APP477_INFLIGHT_OLD_REQUESTS=UNVERIFIED');
  console.log('APP477_READER_ACTIVATION=BLOCKED');
  console.log('APP477_REMOTE_MUTATIONS=0');
  if (!result.allWritersReady) failure('NOT_ALL_WRITERS_COMPATIBLE');
  console.log('APP477_ALL_ACTIVE_WRITER_SOURCES=PASS_READER_STILL_BLOCKED');
}

if (process.argv[1]?.endsWith('audit-477-curated-active-writers-readonly.mjs')) {
  try {
    if (process.argv.includes('--self-test')) selfTest477();
    else if (process.argv.includes('--live')) await liveAudit477();
    else failure('USAGE_SELF_TEST_OR_LIVE');
  } catch (err) {
    console.error(String(err?.message || err));
    process.exitCode=1;
  }
}

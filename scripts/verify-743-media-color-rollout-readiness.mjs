// Offline, no-deploy gate for the three Workers writing a shared private R2 Catalog.
// This file never calls a network API or mutates user data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const STAGES = ['preview', 'test', 'production'];
const NAMES = ['soridraw-media-preview', 'soridraw-media-test', 'soridraw-media'];
const HASH = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sha256 = source => createHash('sha256').update(source).digest('hex');
const slice = (source, start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw new Error(`WORKER_SHAPE_UNRECOGNIZED:${start}`);
  return source.slice(first, last);
};

// Exercise the REAL bundled code from the captured active Worker in a sandbox.
// Do not accept static field-name or marker presence as compatibility proof.
export async function probeActiveBundle(source) {
  try {
    const fields = slice(source, 'var MUSIC_NOTE_CATALOG_FIELDS =', 'var MUSIC_NOTE_MEDIA_FIELDS =');
    const projector = slice(source, 'var projectCatalogFields =', 'var sortCatalogItems =');
    const delta = slice(source, 'var applyCatalogDelta =', 'var handleCatalog =');
    let state;
    let committed;
    let reads = 0;
    let writes = 0;
    const context = {
      __name: fn => fn,
      text2: v => typeof v === 'string' ? v.trim() : '',
      catalogCreatedAtMs: () => 1,
      isActiveMusicNoteCatalogItem: item => item?.saved !== false && item?.favoriteRemoved !== true,
      getCatalogState: async () => { reads += 1; return state; },
      appendCatalogJournalDelta: ({ delta: next }) => {
        committed = next;
        return { ok: true, duplicate: false, revision: 101, itemCount: 1,
          head: { deltas: [{ upserts: next.upserts, deletedIds: next.deletedIds }] } };
      },
      putCatalogJournalHead: async () => { writes += 1; return true; },
      shouldCompactCatalogJournal: () => false,
    };
    const compiled = fields + '\n' +
      'var catalogFieldList = kind => kind === "musicNote" ? MUSIC_NOTE_CATALOG_FIELDS : LIBRARY_CATALOG_FIELDS;\n' +
      projector + '\n' + delta + '\n({projectCatalogFields,applyCatalogDelta});';
    const { projectCatalogFields, applyCatalogDelta } = vm.runInNewContext(compiled, context, {timeout:1000});
    for (const kind of ['musicNote', 'library']) {
      const swatches = kind === 'musicNote'
        ? { favoriteColorTag:'purple', colorTag:'purple' }
        : { colorTags:{ '0':'purple' }, favoriteColorTags:{'0':'blue'} };
      const original = {id:kind, uid:'fixture-owner', saved:true, createdAtMs:1, ...swatches};
      const compact = projectCatalogFields(kind, original, kind);
      for (const key of Object.keys(swatches)) {
        if (JSON.stringify(compact?.[key]) !== JSON.stringify(swatches[key])) {
          throw Error('COLOR_PROJECTION_LOST:' + kind + ':' + key);
        }
      }
      state = {base:{items:[original]}, head:{headRevision:100,itemCount:1,deltas:[],recentMutations:[]}, journalObject:{etag:'fixture'}};
      committed = null; reads = 0; writes = 0;
      await applyCatalogDelta({uid:'fixture-owner'},kind,{
        mutationId:'fixture-legacy',baseRevision:100,revision:101,
        baseItemCount:1,nextItemCount:1,deletedIds:[],
        upserts:[{id:kind,uid:'fixture-owner',saved:true,createdAtMs:1,title:'old client'}]
      },{});
      const row = committed?.upserts?.[0];
      for (const key of Object.keys(swatches)) {
        if (JSON.stringify(row?.[key]) !== JSON.stringify(swatches[key])) {
          throw Error('OLD_CLIENT_ERASED_COLOR:' + kind + ':' + key);
        }
      }
      if (reads !== 1 || writes !== 1) throw Error('EXTRA_IO_ON_OLD_CLIENT:' + kind);
      committed = null;
      const reset = kind === 'musicNote'
        ? {favoriteColorTag:null} : {colorTags:{'0':null},favoriteColorTags:null};
      await applyCatalogDelta({uid:'fixture-owner'},kind,{
        mutationId:'fixture-gray',baseRevision:100,revision:101,
        baseItemCount:1,nextItemCount:1,deletedIds:[],
        upserts:[{id:kind,uid:'fixture-owner',saved:true,createdAtMs:1,...reset}]
      },{});
      const cleared = committed?.upserts?.[0];
      for (const key of Object.keys(reset)) {
        if (JSON.stringify(cleared?.[key]) !== JSON.stringify(reset[key])) {
          throw Error('GRAY_RESET_LOST:' + kind + ':' + key);
        }
      }
      if (kind === 'musicNote' && Object.hasOwn(cleared,'colorTag')) {
        throw Error('STALE_MUSIC_NOTE_ALIAS_REVIVED');
      }
    }
    return { safe: true, reason:'PROJECT_AND_OLD_CLIENT_AND_GRAY_RUNTIME_PASS' };
  } catch (error) {
    return { safe:false, reason:String(error.message || error) };
  }
}

export function validateCapture(summary, sources, expectedWorkers = NAMES) {
  const findings = [];
  for (let i=0; i<STAGES.length; i++) {
    const stage=STAGES[i]; const row=summary?.find(x=>x.stage===stage);
    const bytes=sources?.[stage];
    if (!row || !bytes || row.worker!==expectedWorkers[i] || !VERSION.test(row.activeVersion||'')
      || !HASH.test(row.sourceSha256||'') || sha256(bytes)!==row.sourceSha256
      || row.catalog!=='soridraw-user-catalog' || row.sharedFlag!=='1'
      || row.media!==expectedWorkers[i] || summary.filter(x=>x.stage===stage).length!==1) {
      findings.push(stage+':CAPTURE_MISSING_OR_MISMATCH'); continue;
    }
    findings.push(stage+':CAPTURE_PIN_VALID');
  }
  return findings;
}

// A decision about the *proposed transition*, not a deployment authorization.
// A passing source test alone is never permission to touch the shared bucket.
export function assessColorRollout({ activeSafe, candidateSafe, rollbackSafe, writerBarrierVerified,
  durableOutboxVerified, replayReceiptVerified, exactVersionsVerified, approvedDeployment, capturedAgeMinutes }) {
  const reasons=[];
  if (!Array.isArray(activeSafe) || activeSafe.length!==3) reasons.push('ACTIVE_PROOF_MISSING');
  if (!Array.isArray(candidateSafe) || candidateSafe.length!==3 || candidateSafe.some(x=>x!==true)) reasons.push('THREE_CANDIDATE_BUNDLES_NOT_PROVEN');
  if (!Array.isArray(rollbackSafe) || rollbackSafe.length!==3 || rollbackSafe.some(x=>x!==true)) reasons.push('THREE_SAFE_ROLLBACK_BUNDLES_NOT_PROVEN');
  if (activeSafe?.some(x=>x!==true)) reasons.push('OLD_WRITER_ON_SHARED_CATALOG');
  if (writerBarrierVerified!==true) reasons.push('WRITER_QUIESCENCE_NOT_VERIFIED');
  if (durableOutboxVerified!==true) reasons.push('DURABLE_OUTBOX_NOT_VERIFIED');
  if (replayReceiptVerified!==true) reasons.push('REPLAY_RECEIPT_NOT_VERIFIED');
  if (exactVersionsVerified!==true || !Number.isFinite(capturedAgeMinutes) || capturedAgeMinutes<0 || capturedAgeMinutes>10) reasons.push('LIVE_VERSION_DRIFT_UNVERIFIED');
  if (approvedDeployment!==true) reasons.push('DIRECTOR_DEPLOYMENT_APPROVAL_REQUIRED');
  return {status:reasons.length?'HOLD':'CONDITIONS_SATISFIED_NOT_DEPLOYED',reasons};
}

export async function runRolloutSelfTest() {
  const sample = { activeSafe:[true,true,true],candidateSafe:[true,true,true],rollbackSafe:[true,true,true],
    writerBarrierVerified:true,durableOutboxVerified:true,replayReceiptVerified:true,
    exactVersionsVerified:true,approvedDeployment:true,capturedAgeMinutes:1 };
  assert.equal(assessColorRollout(sample).status,'CONDITIONS_SATISFIED_NOT_DEPLOYED');
  for (let i=0;i<3;i++) {
    const active=[true,true,true];active[i]=false;
    assert.equal(assessColorRollout({...sample,activeSafe:active}).status,'HOLD');
    const rollback=[true,true,true];rollback[i]=false;
    assert.equal(assessColorRollout({...sample,rollbackSafe:rollback}).status,'HOLD');
    const candidate=[true,true,true];candidate[i]=false;
    assert.equal(assessColorRollout({...sample,candidateSafe:candidate}).status,'HOLD');
  }
  for (const field of ['writerBarrierVerified','durableOutboxVerified','replayReceiptVerified','exactVersionsVerified','approvedDeployment']) {
    assert.equal(assessColorRollout({...sample,[field]:false}).status,'HOLD');
  }
  assert.equal(assessColorRollout({...sample,capturedAgeMinutes:11}).status,'HOLD');
  assert.equal(assessColorRollout({}).status,'HOLD');
  const fakeSource=Buffer.from('test');
  const fakeSummary=STAGES.map((stage,i)=>({stage,worker:NAMES[i],media:NAMES[i],catalog:'soridraw-user-catalog',sharedFlag:'1',activeVersion:'83175bcc-fe25-4d17-86c0-1592e47d358e',sourceSha256:sha256(fakeSource)}));
  assert.deepEqual(validateCapture(fakeSummary,Object.fromEntries(STAGES.map(stage=>[stage,fakeSource]))),STAGES.map(stage=>stage+':CAPTURE_PIN_VALID'));
  assert.ok(validateCapture(fakeSummary,{...Object.fromEntries(STAGES.map(stage=>[stage,fakeSource])),preview:Buffer.from('wrong')})[0].includes('MISMATCH'));
  console.log('MEDIA_COLOR_ROLLOUT_MIXED_WRITER_GRAY_ROLLBACK_NO_GO=PASS');
  console.log('MEDIA_COLOR_ROLLOUT_VERSION_BINDING_WRITE_BARRIER_APPROVAL_FENCE=PASS');
  console.log('MEDIA_COLOR_ROLLOUT_OFFLINE_NO_DEPLOY=PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--self-test')) {
    await runRolloutSelfTest();
  } else if (process.argv.includes('--capture')) {
    const index=process.argv.indexOf('--capture');
    const dir=process.argv[index+1];
    if (!dir) throw Error('CAPTURE_DIR_REQUIRED');
    const summary=JSON.parse(readFileSync(dir+'/summary.json','utf8'));
    const sources=Object.fromEntries(STAGES.map(stage=>[stage,readFileSync(dir+'/'+stage+'.js')]));
    const validation=validateCapture(summary,sources);
    if (validation.some(x=>!x.endsWith('PIN_VALID'))) throw Error('CAPTURE_INVALID:'+validation.join(','));
    const results=[];
    for(const stage of STAGES) results.push(await probeActiveBundle(sources[stage].toString('utf8')));
    const verdict=assessColorRollout({ activeSafe:results.map(x=>x.safe) });
    console.log(JSON.stringify({capturedVersions:summary.map(x=>({stage:x.stage,activeVersion:x.activeVersion})),runtime:results,verdict},null,2));
    // HOLD is a correct test finding here; this is a no-deploy inspection.
  } else throw Error('USE_SELF_TEST_OR_CAPTURE_ONLY');
}

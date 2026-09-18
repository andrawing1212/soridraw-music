import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const client = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/049-publication-internal-batch-compaction.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const functionText = (source, name) => {
  const needles=[`async function ${name}(`,`function ${name}(`];
  let start=-1;
  for(const needle of needles){ start=source.indexOf(needle); if(start>=0) break; }
  assert.ok(start>=0,`missing function ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,comment='';
  for(let i=brace;i<source.length;i+=1){
    const c=source[i],n=source[i+1];
    if(comment==='line'){ if(c==='\n') comment=''; continue; }
    if(comment==='block'){ if(c==='*'&&n==='/'){comment='';i+=1;} continue; }
    if(quote){ if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c===quote) quote=''; continue; }
    if(c==='/'&&n==='/'){comment='line';i+=1;continue;}
    if(c==='/'&&n==='*'){comment='block';i+=1;continue;}
    if('"\'`'.includes(c)){quote=c;continue;}
    if(c==='{') depth+=1;
    if(c==='}'&&--depth===0) return source.slice(start,i+1);
  }
  throw new Error(`unterminated function ${name}`);
};

const appVersion = Number(version.version);
assert.ok(Number.isFinite(appVersion) && appVersion >= 82, `082 publication regression requires app version >=082, got ${String(version.version)}`);
const p49 = manifest.patches.indexOf('049-publication-internal-batch-compaction.mjs');
const p50 = manifest.patches.indexOf('050-publication-primary-key-batch-read.mjs');
const p51 = manifest.patches.indexOf('051-publication-write-returning.mjs');
assert.ok(p49 >= 0 && p50 >= 0 && p51 >= 0, 'publication patches 049/050/051 must remain in manifest');
assert.ok(p49 < p50 && p50 < p51, 'publication patch order 049 -> 050 -> 051 must remain intact');
assert.match(worker,/SORIDRAW_PUBLICATION_INTERNAL_BATCH_049_20260914/);
assert.match(worker,/SORIDRAW_PUBLICATION_PK_BATCH_READ_050_20260914/);
assert.match(client,/SORIDRAW_PUBLICATION_MISSING_R2_REPAIR_082_20260914/);
assert.match(client,/if \(!exists\) \{[\s\S]{0,500}knownRevision = '';/);
assert.doesNotMatch(client,/if \(!exists\) \{\s*publicationServerValidatedUids\.add\(uid\);\s*return clonePublicationStates\(cached\);/);
assert.match(client,/\/v1\/me\/music-note-publications-bundle/);

const batch=functionText(worker,'handleMusicNotePublicationBatch048');
assert.match(batch,/readMusicNotePublicationR2Payload\(env, authContext\.uid\)/);
assert.match(batch,/env\.DB\.batch\(updateStatements\)/);
assert.match(batch,/RETURNING \*/);
assert.match(batch,/unresolvedTrackIds/);
assert.match(batch,/env\.DB\.batch\(statements\)/);
assert.match(batch,/String\(row\?\.owner_uid \|\| ''\) !== authContext\.uid/);
assert.doesNotMatch(batch,/FROM track_stats WHERE track_id IN/);
assert.doesNotMatch(batch,/buildMusicNotePublicationR2Payload/);
const batchR2=functionText(worker,'syncMusicNotePublicationR2Batch049');
assert.match(batchR2,/readMusicNotePublicationR2Payload/);
assert.match(batchR2,/writeMusicNotePublicationR2Payload/);
assert.doesNotMatch(batchR2,/buildMusicNotePublicationR2Payload/);
const cold=functionText(worker,'handleMusicNotePublicationR2Bundle');
assert.match(cold,/buildMusicNotePublicationR2Payload/,'cold/missing R2 must still rebuild once from canonical D1');
const singleSync=functionText(worker,'syncMusicNotePublicationR2AfterMutation');
assert.doesNotMatch(singleSync,/buildMusicNotePublicationR2Payload/,'mutation hot path must never owner-scan D1');
assert.match(patch,/let canonicalReadOk = true;/);
assert.match(patch,/PUBLICATION_BATCH_STATS_PREFLIGHT_FAILED/);
console.log('PASS 082: publication batching and missing-R2 self-heal remain protected; 084 warm writes use RETURNING with bounded cold/unresolved reads.');

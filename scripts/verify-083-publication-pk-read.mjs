import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
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

assert.equal(manifest.patches.at(-2),'050-publication-primary-key-batch-read.mjs');
assert.equal(manifest.patches.at(-1),'051-publication-write-returning.mjs');
assert.match(worker,/SORIDRAW_PUBLICATION_PK_BATCH_READ_050_20260914/);
assert.match(worker,/SORIDRAW_PUBLICATION_WRITE_RETURNING_051_20260914/);
const batch=functionText(worker,'handleMusicNotePublicationBatch048');
assert.match(batch,/SELECT \* FROM tracks\s+WHERE id IN/);
assert.doesNotMatch(batch,/SELECT \* FROM tracks[\s\S]{0,120}WHERE owner_uid=\? AND id IN/);
assert.match(batch,/canonicalRows = \(rows\.results \|\| \[\]\)\.filter/);
assert.match(batch,/String\(row\?\.owner_uid \|\| ''\) === authContext\.uid/);
assert.match(batch,/WHERE id=\? AND owner_uid=\? AND source_type='music_note'/);
console.log('PASS 083: publication batch uses track primary-key lookup; owner authorization and guarded updates remain intact.');

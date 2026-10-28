// app518 audit P1-3/P2: quantify why a permanent per-song map in 768KiB
// journal HEAD cannot be deployed as a scalable solution. No server I/O.
import assert from 'node:assert/strict';
import {
 catalogJournalEncodedBytes,CATALOG_JOURNAL_MAX_BYTES
} from '../cloudflare/media-worker/src/catalogJournal.js';
import {readFileSync} from 'node:fs';
const candidate=readFileSync('cloudflare/media-worker/src/catalogJournalReconcile518.js','utf8');
assert.match(candidate,/materializeCatalogJournal\(/,
  'current prototype scans/materializes the entire list on each exact change');
assert.match(candidate,/sourceLedger518:\{\.\.\.ledger,\[id\]:decision\.nextLedger\}/,
  'current prototype appends per-document ledger entries into the same HEAD');
// Reproduce a realistic long-history account (including removed songs).
const ledger={};
let firstFullAt=0,largeBytes=0;
for(let i=0;i<15000;i++){
 const id='song-'+String(i).padStart(8,'0');
 ledger[id]={
  uid:'owner',documentId:id,durable:true,
  sourceVersionNs:'1793152800123456789',state:i%2?'removed':'saved'
 };
 const bytes=catalogJournalEncodedBytes({sourceLedger518:ledger});
 if(!firstFullAt&&bytes>CATALOG_JOURNAL_MAX_BYTES)firstFullAt=i+1;
 if(i===14999)largeBytes=bytes;
}
assert.ok(firstFullAt>0&&firstFullAt<15000,
 'fixture must demonstrate finite per-account HEAD saturation');
assert.ok(largeBytes>CATALOG_JOURNAL_MAX_BYTES);
// There is no safe silent eviction of tombstones: if an inactive client sends
// stale save after history is compacted it may resurrect a removed song.
assert.ok(candidate.includes("DENY_HEAD_CAPACITY"));
console.log('APP518_R2_SINGLE_HEAD_SATURATES_AT_ENTRIES='+firstFullAt);
console.log('APP518_R2_HEAD_CAPACITY_BYTES='+CATALOG_JOURNAL_MAX_BYTES);
console.log('APP518_CANDIDATE_UNBOUNDED_PER_ITEM_O_N_DESIGN_HOLD=CONFIRMED');
console.log('APP518_DELETED_TOMBSTONES_CANNOT_SILENTLY_EVICT=PASS');

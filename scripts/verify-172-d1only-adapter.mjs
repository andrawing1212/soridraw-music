import assert from 'node:assert/strict';
import { createLikeD1OnlyCanonical171 } from '../cloudflare/explore-worker/runtime/like-d1only-171.mjs';

class FakeStatement {
  constructor(sql) { this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() {
    if (!/SELECT\s+[\s\S]*eligible/i.test(this.sql)) throw new Error('unexpected first SQL');
    return {
      eligible: 1, liked: 0, revision: 0, operation_id: '',
      like_count: 7, generation: 0,
    };
  }
}

class FakeDb {
  constructor(batchResults = []) { this.batchResults = batchResults; this.lastBatch = null; }
  prepare(sql) { return new FakeStatement(sql); }
  async batch(statements) {
    this.lastBatch = statements;
    return this.batchResults.shift();
  }
}

const result = (rowsWritten, changes = 0, row = undefined) => ({
  success: true,
  meta: { rows_written: rowsWritten, changes },
  ...(row === undefined ? {} : { results: [row] }),
});

assert.throws(
  () => createLikeD1OnlyCanonical171(new FakeDb(), {}),
  /blocked until all legacy writers are frozen/i,
);

const appliedDb = new FakeDb([[
  result(0, 0, { eligible: 1, liked: 0, revision: 0, operation_id: '', like_count: 7, generation: 0 }),
  result(1, 1),
  result(1, 1),
  result(0, 0, { eligible: 1, liked: 1, revision: 1, operation_id: 'op-a', like_count: 8, generation: 1 }),
]]);
const applied = createLikeD1OnlyCanonical171(appliedDb, { cutoverVerified: true });
assert.deepEqual(await applied.applyAtomically('user uid','track/id',true,{
  expectedRevision:0, operationId:'op-a', now:123,
}), {
  status:'applied', liked:true, likeCount:8, revision:1,
  generation:1, operationId:'op-a', rowsWritten:2,
});
assert.equal(appliedDb.lastBatch.length, 4);
assert.match(appliedDb.lastBatch[1].sql, /explore_like_overrides_171/);
assert.match(appliedDb.lastBatch[1].sql, /revision = explore_like_overrides_171\.revision \+ 1/);
assert.match(appliedDb.lastBatch[2].sql, /explore_like_count_deltas_171/);
assert.match(appliedDb.lastBatch[2].sql, /WHERE changes\(\) = 1/);
assert.match(appliedDb.lastBatch[2].sql, /generation = explore_like_count_deltas_171\.generation \+ 1/);

const duplicateDb = new FakeDb([[
  result(0,0,{ eligible:1, liked:1, revision:1, operation_id:'op-a', like_count:8, generation:1 }),
  result(0,0), result(0,0),
  result(0,0,{ eligible:1, liked:1, revision:1, operation_id:'op-a', like_count:8, generation:1 }),
]]);
const duplicate = await createLikeD1OnlyCanonical171(duplicateDb,{cutoverVerified:true})
  .applyAtomically('u','t',true,{expectedRevision:0,operationId:'op-a',now:124});
assert.equal(duplicate.status,'duplicate');
assert.equal(duplicate.rowsWritten,0);

const alreadyDb = new FakeDb([[
  result(0,0,{ eligible:1, liked:1, revision:4, operation_id:'op-new', like_count:11, generation:9 }),
  result(0,0), result(0,0),
  result(0,0,{ eligible:1, liked:1, revision:4, operation_id:'op-new', like_count:11, generation:9 }),
]]);
const already = await createLikeD1OnlyCanonical171(alreadyDb,{cutoverVerified:true})
  .applyAtomically('u','t',true,{expectedRevision:1,operationId:'op-old',now:125});
assert.equal(already.status,'already-desired');
assert.equal(already.revision,4);
assert.equal(already.rowsWritten,0);

const conflictDb = new FakeDb([[
  result(0,0,{ eligible:1, liked:false, revision:5, operation_id:'op-newer', like_count:10, generation:10 }),
  result(0,0), result(0,0),
  result(0,0,{ eligible:1, liked:false, revision:5, operation_id:'op-newer', like_count:10, generation:10 }),
]]);
const conflict = await createLikeD1OnlyCanonical171(conflictDb,{cutoverVerified:true})
  .applyAtomically('u','t',true,{expectedRevision:2,operationId:'op-stale',now:126});
assert.equal(conflict.status,'revision-conflict');
assert.equal(conflict.revision,5);
assert.equal(conflict.rowsWritten,0);

const ineligibleDb = new FakeDb([[
  result(0,0,{ eligible:0, liked:false, revision:0, operation_id:'', like_count:0, generation:0 }),
  result(0,0), result(0,0),
  result(0,0,{ eligible:0, liked:false, revision:0, operation_id:'', like_count:0, generation:0 }),
]]);
const ineligible = await createLikeD1OnlyCanonical171(ineligibleDb,{cutoverVerified:true})
  .applyAtomically('u','t',true,{expectedRevision:0,operationId:'op-x',now:127});
assert.equal(ineligible.status,'ineligible');

const asymDb = new FakeDb([[
  result(0,0,{ eligible:1, liked:false, revision:0, operation_id:'', like_count:0, generation:0 }),
  result(1,1), result(0,0),
  result(0,0,{ eligible:1, liked:true, revision:1, operation_id:'op-x', like_count:0, generation:0 }),
]]);
await assert.rejects(
  () => createLikeD1OnlyCanonical171(asymDb,{cutoverVerified:true})
    .applyAtomically('u','t',true,{expectedRevision:0,operationId:'op-x',now:128}),
  /asymmetrically/i,
);

const w3Db = new FakeDb([[
  result(0,0,{ eligible:1, liked:false, revision:0, operation_id:'', like_count:0, generation:0 }),
  result(1,1), result(2,1),
  result(0,0,{ eligible:1, liked:true, revision:1, operation_id:'op-x', like_count:1, generation:1 }),
]]);
await assert.rejects(
  () => createLikeD1OnlyCanonical171(w3Db,{cutoverVerified:true})
    .applyAtomically('u','t',true,{expectedRevision:0,operationId:'op-x',now:129}),
  /W2\/revision\/generation contract/i,
);

const readDb = new FakeDb();
const snapshot = await createLikeD1OnlyCanonical171(readDb,{cutoverVerified:true})
  .readSnapshot('user uid','track/id');
assert.deepEqual(snapshot,{
  eligible:true, liked:false, revision:0, operationId:'', likeCount:7, generation:0,
});

console.log('172_171_ADAPTER_APPLIED_W2_DUPLICATE_W0=PASS');
console.log('172_171_ADAPTER_STALE_REVISION_CONFLICT_W0=PASS');
console.log('172_171_ADAPTER_ASYMMETRIC_OR_W3_FAIL_CLOSED=PASS');
console.log('172_171_ADAPTER_EXISTING_ID_RULE_COMPATIBILITY=PASS');

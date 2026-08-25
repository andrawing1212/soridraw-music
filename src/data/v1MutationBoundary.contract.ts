import assert from 'node:assert/strict';
import {
  BACKEND_V2_V1_MUTATION_MIRROR_ENABLED,
  runV1MutationBoundary,
  type V1MutationBoundaryContext,
} from './v1MutationBoundary';

assert.equal(BACKEND_V2_V1_MUTATION_MIRROR_ENABLED, false, 'Step 2-A4b must keep V2 mirror OFF');

const recentContext: V1MutationBoundaryContext = {
  domain: 'recent',
  operation: 'save-batch',
  uid: 'user-1',
  affectedCount: 2,
};

let successCalls = 0;
const result = await runV1MutationBoundary(recentContext, async () => {
  successCalls += 1;
  return { exact: 'v1-result', nested: { keep: true } };
});
assert.equal(successCalls, 1, 'V1 mutation must execute exactly once');
assert.deepEqual(result, { exact: 'v1-result', nested: { keep: true } }, 'V1 return value must pass through unchanged');

const originalError = new Error('original-v1-error');
let errorCalls = 0;
await assert.rejects(
  runV1MutationBoundary(
    { domain: 'musicNote', operation: 'update', uid: 'user-1', documentIds: ['fav-1'], affectedCount: 1 },
    async () => {
      errorCalls += 1;
      throw originalError;
    },
  ),
  (error: unknown) => error === originalError,
  'the exact V1 error object must propagate unchanged',
);
assert.equal(errorCalls, 1, 'failing V1 mutation must not be retried by the boundary');

let concurrentCalls = 0;
await Promise.all([
  runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: 'user-1' }, async () => { concurrentCalls += 1; }),
  runV1MutationBoundary({ domain: 'musicNote', operation: 'restore', uid: 'user-1' }, async () => { concurrentCalls += 1; }),
]);
assert.equal(concurrentCalls, 2, 'the boundary must not serialize or multiply existing mutations');

console.log('Backend V2 Step 2-A4b V1 mutation boundary contract PASS');

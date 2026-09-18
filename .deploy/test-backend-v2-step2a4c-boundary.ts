import { registerV1MutationPostSuccessHook, runV1MutationBoundary } from '../src/data/v1MutationBoundary.ts';

let seen = 0;
registerV1MutationPostSuccessHook(async () => { seen += 1; });
const value = await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: 'u' }, Promise.resolve(7));
await new Promise((resolve) => setTimeout(resolve, 0));
if (value !== 7 || seen !== 1) throw new Error('post-success hook failed');
seen = 0;
try {
  await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: 'u' }, Promise.reject(new Error('v1')));
} catch {}
await new Promise((resolve) => setTimeout(resolve, 0));
if (seen !== 0) throw new Error('mirror ran after V1 failure');
console.log('A4C_BOUNDARY_CONTRACT=PASS');

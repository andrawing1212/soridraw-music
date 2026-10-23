#!/usr/bin/env node
// SORIDRAW 1k/10k cost-sensitivity scenario. PURE arithmetic, no network,
// secrets, account IDs, Firebase/Cloudflare writes, or deployment operations.
// Assumptions are illustrative, NOT observed usage or actual invoices.
import assert from 'node:assert/strict';

export const DAYS = 30;
export const ASSUMPTIONS = Object.freeze({
  dauFraction: 0.20, // scenario only: not measured
  visitsPerDauDay: 2,
  publicLikeActionsPerDauDay: 2, // assumes each action sends 1 public signal; stress case
  newFavoriteSavesPerDauDay: 0.2,
  betaTesters: 10, // fixed illustrative small cohort, counted in production population
  betaExtraTestVisitsPerDay: 2, // only these extra TEST visits, NOT another canonical user
  previewAdministrators: 2,
  previewVisitsPerAdminDay: 2,
  dynamicWorkerRequestsPerSession: 4, // illustrative, may differ in real code
  dynamicWorkerRequestsPerPublicLike: 1, // upper case without mutation batching
  r2ClassBOperationsPerSession: 2, // illustrative, must be instrumented
  publicSignalPayloadKiB: [1, 5], // hypothetical transmitted full RTDB node
  subscribersByPopulation: { 1000: 5, 10000: 50 }, // hypothetical simultaneous listeners
});

export function scenario(registeredUsers, a = ASSUMPTIONS) {
  if (!Number.isInteger(registeredUsers) || registeredUsers < 1) throw Error('INVALID_USERS');
  const DAU = registeredUsers * a.dauFraction;
  const productionSessions30d = DAU * a.visitsPerDauDay * DAYS;
  const extraTestSessions30d = a.betaTesters * a.betaExtraTestVisitsPerDay * DAYS;
  const adminPreviewSessions30d = a.previewAdministrators * a.previewVisitsPerAdminDay * DAYS;
  const allSessions30d = productionSessions30d + extraTestSessions30d + adminPreviewSessions30d;
  const publicLikeActions30d = DAU * a.publicLikeActionsPerDauDay * DAYS;
  const favoriteSaves30d = DAU * a.newFavoriteSavesPerDauDay * DAYS;
  const workerRequests30d = allSessions30d * a.dynamicWorkerRequestsPerSession
    + publicLikeActions30d * a.dynamicWorkerRequestsPerPublicLike;
  const r2ClassBOperations30d = allSessions30d * a.r2ClassBOperationsPerSession;
  const listeners = a.subscribersByPopulation[registeredUsers];
  if (!Number.isFinite(listeners) || listeners < 0) throw Error('LISTENER_ASSUMPTION_MISSING');
  const publicSignalFanoutGiB = a.publicSignalPayloadKiB.map(payload =>
    Number((publicLikeActions30d * listeners * payload * 1024 / (1024 ** 3)).toFixed(3)));
  return {
    registeredUsers, DAU, productionSessions30d,
    extraTestSessions30d, adminPreviewSessions30d,
    allSessions30d, publicLikeActions30d, favoriteSaves30d,
    workerRequests30d, r2ClassBOperations30d,
    hypotheticalConcurrentListeners: listeners,
    hypotheticalPublicSignalFanoutGiB: publicSignalFanoutGiB,
    // This is an ARCHITECTURAL REQUIREMENT, not a measurement:
    canonicalMutationMultiplierTarget: 1,
  };
}

export function selfTest() {
  const s1=scenario(1000),s10=scenario(10000);
  assert.equal(s1.DAU,200);
  assert.equal(s1.productionSessions30d,12000);
  assert.equal(s10.productionSessions30d,120000);
  assert.equal(s1.extraTestSessions30d,600);
  assert.equal(s10.extraTestSessions30d,600);
  assert.equal(s1.adminPreviewSessions30d,120);
  assert.equal(s10.adminPreviewSessions30d,120);
  assert.equal(s1.publicLikeActions30d,12000);
  assert.equal(s10.publicLikeActions30d,120000);
  assert.equal(s10.favoriteSaves30d,12000);
  assert.equal(s1.workerRequests30d,62880);
  assert.equal(s10.workerRequests30d,602880);
  assert.equal(s1.r2ClassBOperations30d,25440);
  assert.equal(s10.r2ClassBOperations30d,241440);
  assert.deepEqual(s1.hypotheticalPublicSignalFanoutGiB,[0.057,0.286]);
  assert.deepEqual(s10.hypotheticalPublicSignalFanoutGiB,[5.722,28.61]);
  assert.equal(s10.canonicalMutationMultiplierTarget,1);
  assert.throws(()=>scenario(0),/INVALID_USERS/);
  assert.throws(()=>scenario(2000),/LISTENER_ASSUMPTION_MISSING/);
  console.log('COST_1K_10K_PURE_MODEL_SELF_TEST=PASS');
}

if (process.argv.includes('--self-test')) selfTest();
else console.log(JSON.stringify({
  kind:'SORIDRAW_ILLUSTRATIVE_1K_10K_COST',
  disclaimer:'Hypothetical volumes, NOT measured live traffic, NOT a billing invoice. Per-service account-wide allowances/shared use and RTDB protocol overhead excluded.',
  assumptions:ASSUMPTIONS,
  cases:[scenario(1000),scenario(10000)],
},null,2));

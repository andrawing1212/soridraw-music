// APP600: separate, source-only owner-follow Durable Object Worker.
// It is deliberately not imported or bound by the active Explore Worker.
import {createOwnerFollowRecovery556} from '../explore-worker/runtime/owner-follow-recovery-556.mjs';

export const APP600_OWNER_WORKER_COMPILED_OPEN = true;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const APPROVED_CANARY_SHA256_600 = '8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
// The synthetic override is passed ONLY by direct offline tests. Production
// entrypoints never pass it, and must match BOTH server configuration and
// the pinned approved Auth UID hash before any Durable Object access.
async function approvedOwner600(uid, env, syntheticOwnerUid) {
  if (!UID.test(String(uid || ''))) return false;
  if (syntheticOwnerUid !== undefined) return uid === syntheticOwnerUid;
  if (String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || '') !== uid) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return hash === APPROVED_CANARY_SHA256_600;
}
const MAX_BODY_BYTES = 1024;
const INTERNAL_RESERVE = '/internal/owner-follow/reserve600';
const INTERNAL_REPLAY = 'https://owner-follow.internal/owner-follow/replay557-internal';
const SECRET_HEADER = 'X-Soridraw-Owner-Bridge-600';
const reply = (status, body) => Response.json(body, {
  status, headers: {'Cache-Control': 'no-store'},
});
const active = (env, enabled) => enabled === true &&
  env?.SORIDRAW_ENVIRONMENT === 'preview' &&
  env?.SORIDRAW_OWNER_DO_STANDALONE_600 === '1';

// Simple constant-work ASCII comparison; never put the capability in code,
// config, query strings, logging or the durable ticket itself.
function capabilityValid(request, env) {
  const expected = env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
  const supplied = request.headers.get(SECRET_HEADER);
  if (typeof expected !== 'string' || expected.length < 32 ||
      expected.length > 256 || typeof supplied !== 'string') return false;
  let difference = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return difference === 0;
}
async function limitedTicket(request) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES))
    return {status: 413};
  let raw;
  try { raw = await request.text(); }
  catch { return {status: 400}; }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
    return {status: 413};
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        !UID.test(String(value.ownerUid || ''))) return {status: 400};
    return {ticket: value};
  } catch { return {status: 400}; }
}

// This callback is a future service binding to an *authenticated canonical
// replay endpoint on Explore*. It must verify the exact settled pair receipt,
// latest owner R2, D1 auth epoch, and signed Firebase ACK before success.
// It is not wired, so no network or data read occurs in this candidate.
export async function replayThroughService600({reservation, env} = {}) {
  const service = env?.OWNER_FOLLOW_CANONICAL_REPLAY_600;
  const secret = env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
  if (typeof service?.fetch !== 'function' ||
      typeof secret !== 'string' || secret.length < 32) return {status: 'relay-failed'};
  try {
    const response = await service.fetch(new Request(INTERNAL_REPLAY, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', [SECRET_HEADER]: secret,
      }, body: JSON.stringify(reservation),
    }));
    // Fail closed: a generic 2xx, timeout, invalid JSON, or 403 cannot ACK.
    const value = await response.json();
    if (response.status === 200 && value?.status === 'delivered' &&
        Number.isSafeInteger(value.deliveredRevision) &&
        value.deliveredRevision > reservation.priorR2Revision)
      return {status: 'delivered'};
    if (response.status === 409 && value?.status === 'rejected-generation')
      return {status: 'rejected-generation'};
  } catch { /* Durable alarm retry owns transient failures. */ }
  return {status: 'relay-failed'};
}

export function createOwnerDoService600({state, env, enabled = APP600_OWNER_WORKER_COMPILED_OPEN,
  now = Date.now, deliver = replayThroughService600, syntheticOwnerUid} = {}) {
  const engine = createOwnerFollowRecovery556({state, env, enabled, now, deliver});
  return {
    async fetch(request) {
      if (!active(env, enabled)) return reply(503, {ok: false, status: 'disabled'});
      if (request.method !== 'POST' || new URL(request.url).pathname !== INTERNAL_RESERVE)
        return reply(404, {ok: false});
      if (!capabilityValid(request, env)) return reply(403, {ok: false});
      const parsed = await limitedTicket(request);
      if (!parsed.ticket) return reply(parsed.status, {ok: false});
      if (!(await approvedOwner600(parsed.ticket.ownerUid, env, syntheticOwnerUid)))
        return reply(403, {ok: false, status: 'owner-not-approved'});
      const result = await engine.reserve(parsed.ticket).catch(() => ({ok: false, status: 'storage-unavailable'}));
      return reply(result.ok ? 200 : 503, result);
    },
    alarm: async () => {
      if (!active(env, enabled) ||
          !(await approvedOwner600(String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || ''), env, syntheticOwnerUid)))
        return {ok: false, status: 'disabled'};
      return engine.alarm();
    },
  };
}

export class OwnerFollowerStandalone600 {
  constructor(state, env) {
    this.service = createOwnerDoService600({state, env});
  }
  fetch(request) { return this.service.fetch(request); }
  alarm() { return this.service.alarm(); }
}

export async function handleOwnerWorker600(request, env, {
  enabled = APP600_OWNER_WORKER_COMPILED_OPEN, syntheticOwnerUid,
} = {}) {
  if (!active(env, enabled)) return reply(503, {ok: false, status: 'disabled'});
  if (request.method !== 'POST' || new URL(request.url).pathname !== INTERNAL_RESERVE)
    return reply(404, {ok: false});
  if (!capabilityValid(request, env)) return reply(403, {ok: false});
  const parsed = await limitedTicket(request);
  if (!parsed.ticket) return reply(parsed.status, {ok: false});
  if (!(await approvedOwner600(parsed.ticket.ownerUid, env, syntheticOwnerUid)))
    return reply(403, {ok: false, status: 'owner-not-approved'});
  const namespace = env?.OWNER_FOLLOW_DO_600;
  if (typeof namespace?.idFromName !== 'function' || typeof namespace?.get !== 'function')
    return reply(503, {ok: false, status: 'missing-do-binding'});
  try {
    const stub = namespace.get(namespace.idFromName(parsed.ticket.ownerUid));
    // Recreate a fresh bounded, single-use request; never forward arbitrary
    // caller headers, auth tokens or untrusted URLs to a durable object.
    const internal = new Request('https://owner-follow.internal' + INTERNAL_RESERVE, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', [SECRET_HEADER]: env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600,
      }, body: JSON.stringify(parsed.ticket),
    });
    if (new TextEncoder().encode(await internal.clone().text()).byteLength > MAX_BODY_BYTES)
      return reply(413, {ok: false});
    return await stub.fetch(internal);
  } catch { return reply(503, {ok: false, status: 'reservation-unavailable'}); }
}

export default {fetch(request, env) { return handleOwnerWorker600(request, env); }};

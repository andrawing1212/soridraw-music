// Stage420 Cloudflare canonical admission candidate; NOT IMPORTED BY LIVE WORKER.
// Authenticated Firebase UID comes from the Worker verifier, NEVER from the body.
// Verify BEFORE R2 preflight / D1 queue or canonical write. HMAC permits remove
// the need for per-batch Firebase reads (not a claim about Function click cost).
const AUDIENCE = 'soridraw:explore-like-canonical:420';
const TTL_MS = 15 * 60_000;
const EXPECTED_KEYS = 'aud,exp,iat,liked,operationId,trackId,uid,v';

const denied = () => Object.assign(new Error('420_GUARD_PERMIT_DENIED'), {
  code: '420_GUARD_PERMIT_DENIED', status: 403,
});
const decodeB64 = (s, limit) => {
  if (typeof s !== 'string' || !s || s.length > limit ||
      !/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) throw denied();
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  let plain;
  try { plain = atob(normalized + '='.repeat((4-normalized.length%4)%4)); }
  catch { throw denied(); }
  const bytes = Uint8Array.from(plain, c => c.charCodeAt(0));
  // Reject alternate noncanonical representations of a signature/payload.
  const roundTrip = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (roundTrip !== s) throw denied();
  return bytes;
};

// Canonical payload is signed by a server-only Firebase secret. No Worker
// direct request can mint one without that key. Each exact repeated operation
// uses the original permit; D1 receipt/idempotence remains the replay guard.
export const verifyLikeGuardPermit420 = async ({
  permit,
  authenticatedUid,
  mutation,
  secretBase64Url,
  nowMs = Date.now(),
  subtle = crypto.subtle,
}) => {
  if (typeof permit !== 'string' || permit.length > 2400 ||
      typeof authenticatedUid !== 'string' || !authenticatedUid ||
      !mutation || typeof mutation !== 'object' ||
      typeof secretBase64Url !== 'string' ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) throw denied();

  const parts = permit.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw denied();
  const key = decodeB64(secretBase64Url, 300);
  const payloadBytes = decodeB64(parts[1], 2200);
  const mac = decodeB64(parts[2], 80);
  if (key.length < 32 || mac.length !== 32) throw denied();

  let claims;
  try {
    const text = new TextDecoder('utf-8', {fatal:true}).decode(payloadBytes);
    claims = JSON.parse(text);
  } catch { throw denied(); }
  if (!claims || Array.isArray(claims) || typeof claims !== 'object' ||
      Object.keys(claims).sort().join(',') !== EXPECTED_KEYS ||
      claims.v !== 1 || claims.aud !== AUDIENCE ||
      claims.uid !== authenticatedUid ||
      claims.trackId !== mutation.trackId ||
      claims.liked !== mutation.liked ||
      claims.operationId !== mutation.operationId ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.iat <= 0 || claims.exp - claims.iat !== TTL_MS ||
      claims.iat > nowMs + 5_000 || claims.exp <= nowMs ||
      !/^[0-9a-f-]{36}$/i.test(claims.operationId)) throw denied();

  const hmacKey = await subtle.importKey(
    'raw', key, {name:'HMAC',hash:'SHA-256'}, false, ['verify'],
  );
  const signedBytes = new TextEncoder().encode(parts[0]+'.'+parts[1]);
  const valid = await subtle.verify('HMAC', hmacKey, mac, signedBytes);
  if (valid !== true) throw denied();
  return {uid: claims.uid, trackId: claims.trackId, liked: claims.liked,
    operationId: claims.operationId, issuedAt: claims.iat, expiresAt: claims.exp};
};

export const verifyGuardedLikeBatch420 = async ({
  authenticatedUid, body, secretBase64Url, nowMs = Date.now(),
  subtle = crypto.subtle,
}) => {
  if (!body || !Array.isArray(body.mutations) ||
      body.mutations.length < 1 || body.mutations.length > 50) throw denied();
  const unique = new Set();
  // Complete verification happens BEFORE calling any canonical mutator, even
  // for the last item of a 50-track batch. Never partially commit a batch
  // whose final row has a missing or tampered server approval.
  for (const mutation of body.mutations) {
    if (!mutation || typeof mutation.trackId !== 'string' ||
        unique.has(mutation.trackId)) throw denied();
    unique.add(mutation.trackId);
    await verifyLikeGuardPermit420({
      permit:mutation.guardPermit420,authenticatedUid,
      mutation,secretBase64Url,nowMs,subtle,
    });
  }
  return true;
};

export const acceptGuardedLikeBatch420 = async ({
  authenticatedUid, body, secretBase64Url, acceptCanonical,
  nowMs = Date.now(), subtle = crypto.subtle,
}) => {
  if (typeof acceptCanonical !== 'function') throw denied();
  await verifyGuardedLikeBatch420({authenticatedUid,body,secretBase64Url,nowMs,subtle});
  // Exactly one already-verified authenticated request enters the existing
  // canonical handler; no new D1/R2/RTDB requests added in this gate.
  return acceptCanonical(authenticatedUid,body);
};

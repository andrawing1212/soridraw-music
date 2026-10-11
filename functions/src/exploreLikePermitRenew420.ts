// Dormant Stage420: renew ONLY an exact earlier server-authorized operation.
// No rate transaction, user data read/write, or canonical intake. Not deployed.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { issueRenewedLikePermitV2420, LIKE_PERMIT_AUDIENCE_420, LIKE_PERMIT_TTL_MS_420, LIKE_PERMIT_MAX_RENEWAL_AGE_MS_420, type PermittedAction420 } from './exploreLikePermit420';

export const MAX_PERMIT_RENEWAL_AGE_MS_420 = LIKE_PERMIT_MAX_RENEWAL_AGE_MS_420;
const EXPECTED_CLAIMS_V1 = 'aud,exp,iat,liked,operationId,trackId,uid,v';
const EXPECTED_CLAIMS_V2 = 'aud,exp,iat,liked,operationId,orig,trackId,uid,v';
const deny = (): never => { throw new Error('420_GUARD_PERMIT_RENEW_DENIED'); };

const decodeCanonical = (part: unknown, limit: number): Buffer => {
  if (typeof part !== 'string' || !part || part.length > limit ||
      part.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(part)) return deny();
  const bytes = Buffer.from(part, 'base64url');
  if (bytes.toString('base64url') !== part) return deny();
  return bytes;
};

export const renewPreviouslyApprovedLikePermit420 = (
  action: PermittedAction420,
  previousPermit: string,
  nowMs: number,
  secretBase64Url: string,
): string => {
  if (!action || typeof action.uid !== 'string' || !action.uid ||
      typeof action.trackId !== 'string' || !action.trackId ||
      typeof action.liked !== 'boolean' ||
      typeof action.operationId !== 'string' ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      typeof previousPermit !== 'string' || previousPermit.length > 2400 ||
      typeof secretBase64Url !== 'string') return deny();
  const parts = previousPermit.split('.');
  if (parts.length !== 3 || !['v1', 'v2'].includes(parts[0])) return deny();
  const key = decodeCanonical(secretBase64Url, 300);
  const payload = decodeCanonical(parts[1], 2200);
  const signature = decodeCanonical(parts[2], 80);
  if (key.length < 32 || signature.length !== 32) return deny();
  const expected = createHmac('sha256', key)
    .update(parts[0] + '.' + parts[1], 'utf8').digest();
  if (!timingSafeEqual(expected, signature)) return deny();

  let claims: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return deny();
    claims = parsed as Record<string, unknown>;
  } catch { return deny(); }

  const legacy = parts[0] === 'v1';
  const originalIssuedAt = legacy ? claims.iat : claims.orig;
  if (Object.keys(claims).sort().join(',') !==
        (legacy ? EXPECTED_CLAIMS_V1 : EXPECTED_CLAIMS_V2) ||
      claims.v !== (legacy ? 1 : 2) ||
      claims.aud !== LIKE_PERMIT_AUDIENCE_420 ||
      claims.uid !== action.uid || claims.trackId !== action.trackId ||
      claims.liked !== action.liked || claims.operationId !== action.operationId ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      !Number.isSafeInteger(originalIssuedAt) ||
      (claims.iat as number) <= 0 || Number(originalIssuedAt) <= 0 ||
      Number(originalIssuedAt) > (claims.iat as number) ||
      (claims.exp as number) - (claims.iat as number) !== LIKE_PERMIT_TTL_MS_420 ||
      (claims.iat as number) > nowMs + 5_000 ||
      nowMs - (claims.iat as number) > MAX_PERMIT_RENEWAL_AGE_MS_420 ||
      nowMs - Number(originalIssuedAt) >= MAX_PERMIT_RENEWAL_AGE_MS_420) return deny();

  // The first v1 proof is accepted only as authenticated evidence of its
  // original iat. From then on the signed v2 'orig' survives every renewal.
  // No quota adjustment, no private signal or database read/write.
  return issueRenewedLikePermitV2420(action, nowMs, Number(originalIssuedAt),
    secretBase64Url);
};

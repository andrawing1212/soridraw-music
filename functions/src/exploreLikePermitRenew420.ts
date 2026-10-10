// Dormant Stage420: renew ONLY an exact earlier server-authorized operation.
// No rate transaction, user data read/write, or canonical intake. Not deployed.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { issueLikePermit420, LIKE_PERMIT_AUDIENCE_420, LIKE_PERMIT_TTL_MS_420, type PermittedAction420 } from './exploreLikePermit420';

export const MAX_PERMIT_RENEWAL_AGE_MS_420 = 24 * 60 * 60_000;
const EXPECTED_CLAIMS = 'aud,exp,iat,liked,operationId,trackId,uid,v';
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
  if (parts.length !== 3 || parts[0] !== 'v1') return deny();
  const key = decodeCanonical(secretBase64Url, 300);
  const payload = decodeCanonical(parts[1], 2200);
  const signature = decodeCanonical(parts[2], 80);
  if (key.length < 32 || signature.length !== 32) return deny();
  const expected = createHmac('sha256', key)
    .update('v1.' + parts[1], 'utf8').digest();
  if (!timingSafeEqual(expected, signature)) return deny();

  let claims: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return deny();
    claims = parsed as Record<string, unknown>;
  } catch { return deny(); }

  if (Object.keys(claims).sort().join(',') !== EXPECTED_CLAIMS ||
      claims.v !== 1 || claims.aud !== LIKE_PERMIT_AUDIENCE_420 ||
      claims.uid !== action.uid || claims.trackId !== action.trackId ||
      claims.liked !== action.liked || claims.operationId !== action.operationId ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      (claims.iat as number) <= 0 ||
      (claims.exp as number) - (claims.iat as number) !== LIKE_PERMIT_TTL_MS_420 ||
      (claims.iat as number) > nowMs + 5_000 ||
      nowMs - (claims.iat as number) > MAX_PERMIT_RENEWAL_AGE_MS_420) return deny();

  // No quota adjustment, no private signal. Canonical receipt171 remains the
  // separate same-operation replay guard once this candidate is enabled.
  return issueLikePermit420(action, nowMs, secretBase64Url);
};

// Stage420 HMAC permit ISSUER CANDIDATE — no deployment or key provisioning.
// Called only after the authenticated RTDB Admin gate allowed an exact action.
// The paired Cloudflare verifier validates the entire signed command BEFORE
// canonical/queue D1 work. Neither key nor signature is stored in shared D1.
import { createHmac } from "node:crypto";

export const LIKE_PERMIT_AUDIENCE_420 = "soridraw:explore-like-canonical:420";
export const LIKE_PERMIT_TTL_MS_420 = 15 * 60_000;
// Renewed proof may not outlive the FIRST authorized permit by chaining.
export const LIKE_PERMIT_MAX_RENEWAL_AGE_MS_420 = 24 * 60 * 60_000;

export type PermittedAction420 = {
  uid: string;
  trackId: string;
  liked: boolean;
  operationId: string;
};

export const issueLikePermit420 = (
  action: PermittedAction420,
  nowMs: number,
  secretBase64Url: string,
): string => {
  const key = Buffer.from(secretBase64Url, "base64url");
  if (key.length < 32 || !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      typeof action.uid !== "string" || !action.uid || action.uid.length > 128 ||
      /[.#$\[\]\/]/.test(action.uid) ||
      typeof action.trackId !== "string" || !action.trackId ||
      action.trackId.length > 512 ||
      typeof action.liked !== "boolean" ||
      typeof action.operationId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(action.operationId)) {
    throw new Error("420_GUARD_PERMIT_ISSUE_INVALID");
  }
  // Stable key order is shared by both server and Worker; these are the ONLY
  // fields authenticated by v1. 171 still enforces revision/base-state rules.
  const claims = {
    v: 1,
    aud: LIKE_PERMIT_AUDIENCE_420,
    uid: action.uid,
    trackId: action.trackId,
    liked: action.liked,
    operationId: action.operationId,
    iat: nowMs,
    exp: nowMs + LIKE_PERMIT_TTL_MS_420,
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signed = "v1." + payload;
  const signature = createHmac("sha256", key).update(signed, "utf8").digest("base64url");
  return signed + "." + signature;
};

// Dormant v2 renewal format. Keep the original v1 issuer unchanged for
// previously authorized pending operations. 'orig' is included in the HMAC
// on every subsequent renewal and can never be reset by a caller.
export const issueRenewedLikePermitV2420 = (
  action: PermittedAction420,
  issuedAtMs: number,
  originalIssuedAtMs: number,
  secretBase64Url: string,
): string => {
  const key = Buffer.from(secretBase64Url, "base64url");
  if (key.length < 32 || !Number.isSafeInteger(issuedAtMs) ||
      !Number.isSafeInteger(originalIssuedAtMs) ||
      originalIssuedAtMs <= 0 || issuedAtMs < originalIssuedAtMs ||
      issuedAtMs - originalIssuedAtMs >= LIKE_PERMIT_MAX_RENEWAL_AGE_MS_420 ||
      typeof action?.uid !== 'string' || !action.uid || action.uid.length > 128 ||
      /[.#$\[\]\/]/.test(action.uid) ||
      typeof action.trackId !== 'string' || !action.trackId ||
      action.trackId.length > 512 || typeof action.liked !== 'boolean' ||
      typeof action.operationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(action.operationId)) {
    throw new Error('420_GUARD_PERMIT_RENEW_DENIED');
  }
  const claims = {
    v: 2,
    aud: LIKE_PERMIT_AUDIENCE_420,
    uid: action.uid,
    trackId: action.trackId,
    liked: action.liked,
    operationId: action.operationId,
    orig: originalIssuedAtMs,
    iat: issuedAtMs,
    exp: issuedAtMs + LIKE_PERMIT_TTL_MS_420,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signed = 'v2.' + payload;
  return signed + '.' + createHmac('sha256', key)
    .update(signed, 'utf8').digest('base64url');
};

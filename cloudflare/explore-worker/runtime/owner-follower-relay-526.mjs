// APP526 source-only relay contract. NOT imported by a live Worker.
// Server-to-Firebase Admin delivery after canonical commit requires approval,
// authentication, durable retry and an owner-scoped monotonic RTDB transaction.
export const OWNER_FOLLOW_RELAY_526_ENABLED = false;

export const prepareOwnerFollowRelay526 = (receipt) => {
  if (!receipt || receipt.canonicalCommitted !== true ||
      receipt.materializedProfileReady !== true || receipt.changed !== true) return null;
  const actorUid = String(receipt.actorUid || '').trim();
  const ownerUid = String(receipt.targetUid || '').trim();
  const receiptId = String(receipt.receiptId || '').trim();
  if (!actorUid || !ownerUid || actorUid === ownerUid ||
      !receiptId || receiptId.length > 128) return null;
  return { ownerUid, receiptId };
};

// No client-supplied count is accepted as authority.
export const invokeOwnerFollowRelay526 = async (receipt, deliver) => {
  if (!OWNER_FOLLOW_RELAY_526_ENABLED) return { skipped: true };
  const payload = prepareOwnerFollowRelay526(receipt);
  if (!payload) return { skipped: true };
  await deliver(payload);
  return { skipped: false };
};

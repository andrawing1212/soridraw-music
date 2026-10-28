// app518: Pure safety gate for any future server-authoritative, exact-document
// Music Note -> shared Catalog reconciliation. No I/O, no repair or migration.
// Firestore updateTime must come from a server-verified document/event metadata,
// NEVER from the browser, Date.now(), a song field, or an R2 revision.
const text = (value) => typeof value === 'string' ? value.trim() : '';

export const parseFirestoreUpdateTimeNs518 = (value) => {
  // Firestore RFC3339 updateTime can carry 0/3/6/9 fractional digits.
  // Preserve nanoseconds to order rapid successive save/unsave mutations.
  const match = text(value).match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/);
  if (!match) return null;
  const wholeMs = Date.parse(match[1] + 'Z');
  if (!Number.isFinite(wholeMs) || wholeMs <= 0
    || new Date(wholeMs).toISOString().slice(0, 19) !== match[1]) return null;
  const nanos = (match[2] || '').padEnd(9, '0');
  return String(BigInt(wholeMs) * 1_000_000n + BigInt(nanos || '0')).padStart(21, '0');
};

const validId = (value) => Boolean(text(value)
  && text(value).length <= 240 && text(value) !== '.'
  && text(value) !== '..' && !/[\\/]/.test(text(value)));

const version = (value) => {
  const v = text(value);
  return /^\d{16,21}$/.test(v) ? BigInt(v) : null;
};

// An authoritative ledger entry MUST be stored durably, including tombstones.
// The caller must use a single ordered transactional authority for this entry
// and catalog mutation. Never assume two independent R2 puts are atomic.
export const decideCanonicalCatalogMutation518 = ({
  expectedUid, expectedDocumentId, canonical, ledger,
} = {}) => {
  const uid = text(expectedUid);
  const id = text(expectedDocumentId);
  if (!uid || !validId(id)) return { code: 'DENY_INVALID_ID' };
  if (!canonical || canonical.verifiedByServer !== true
    || canonical.uid !== uid || canonical.documentId !== id) {
    return { code: 'DENY_UNVERIFIED_SOURCE' };
  }
  if (canonical.state !== 'saved' && canonical.state !== 'removed') {
    return { code: 'DENY_UNKNOWN_STATE' };
  }
  const nextVersion = parseFirestoreUpdateTimeNs518(canonical.updateTime);
  if (!nextVersion) return { code: 'DENY_MISSING_SOURCE_VERSION' };
  // Full exact server read is mandatory before introducing a version baseline.
  // A late out-of-order trigger may never bootstrap its own authority.
  if (!ledger && canonical.origin !== 'server-exact-read') {
    return { code: 'DENY_UNFENCED_EVENT' };
  }
  if (ledger) {
    if (ledger.uid !== uid || ledger.documentId !== id || ledger.durable !== true
      || (ledger.state !== 'saved' && ledger.state !== 'removed')) {
      return { code: 'DENY_INVALID_LEDGER' };
    }
    const currentVersion = version(ledger.sourceVersionNs);
    if (!currentVersion) return { code: 'DENY_INVALID_LEDGER' };
    if (BigInt(nextVersion) < currentVersion) return { code: 'SKIP_STALE' };
    if (BigInt(nextVersion) === currentVersion) {
      return ledger.state === canonical.state
        ? { code: 'SKIP_DUPLICATE' }
        : { code: 'DENY_CONFLICTING_SAME_VERSION' };
    }
  }
  if (canonical.state === 'saved') {
    if (!canonical.item || typeof canonical.item !== 'object'
      || Array.isArray(canonical.item) || text(canonical.item.id) !== id) {
      return { code: 'DENY_INVALID_ITEM' };
    }
    if (canonical.item.uid && canonical.item.uid !== uid) {
      return { code: 'DENY_UNVERIFIED_SOURCE' };
    }
  }
  return {
    code: 'APPLY',
    nextLedger: {
      uid, documentId: id, durable: true,
      sourceVersionNs: nextVersion, state: canonical.state,
    },
    action: canonical.state === 'saved'
      ? { type: 'upsert', id, item: canonical.item }
      : { type: 'tombstone', id },
  };
};
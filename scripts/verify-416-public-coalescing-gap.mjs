import assert from 'node:assert/strict';

// Regression gate: an RTDB value subscriber may receive only the final value.
// The Stage416 batch publisher must not claim 50+ lossless public delivery
// until this delayed-observer case has a real, bounded reconciliation path.
const now = 1_760_000_000_000;
let signal = null;
for (let start = 0; start < 80; start += 50) {
  const incoming = Array.from(
    { length: Math.min(50, 80 - start) },
    (_, i) => ({ trackId: 'track-' + (start + i), ownerUid: 'owner', at: now - 1000 }),
  );
  const retained = new Map();
  for (const row of Object.values(signal?.rows || {})) {
    if (row.at >= now - 180_000) retained.set(row.trackId, row);
  }
  const changed = incoming.filter(row => (retained.get(row.trackId)?.at || 0) < row.at);
  const ids = new Set(changed.map(row => row.trackId));
  signal = {
    version: (signal?.version || now) + 1,
    at: now,
    actorUid: 'A',
    rows: [...changed, ...[...retained.values()]
      .filter(row => !ids.has(row.trackId))
      .sort((a, b) => b.at - a.at)].slice(0, 50),
  };
}
const seen = new Set(signal.rows.map(row => row.trackId));
const missing = Array.from({ length: 80 }, (_, i) => 'track-' + i)
  .filter(id => !seen.has(id));
assert.equal(seen.size, 50);
assert.equal(missing.length, 30);
console.log('KNOWN_RISK_STAGE416_80_TRACKS_DELAYED_OBSERVER_LOSES_30: CONFIRMED');
console.log('This is a negative reproduction, NOT a passing delivery guarantee.');

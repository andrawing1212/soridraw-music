// Display-only normalization for Explore/publication surfaces.
// Canonical title data is never rewritten here; this only removes legacy
// wrapping quotes around title segments and standardizes the visible separator.
const stripExploreWrappingQuotes = (value: string): string => {
  let next = String(value || '').trim();
  while (next.length >= 2) {
    const first = next[0];
    const last = next[next.length - 1];
    const paired = (
      (first === "'" && last === "'")
      || (first === '"' && last === '"')
      || (first === '‘' && last === '’')
      || (first === '“' && last === '”')
    );
    if (!paired) break;
    next = next.slice(1, -1).trim();
  }
  return next;
};

export const formatExploreDisplayTitle = (rawTitle: unknown): string => {
  const raw = String(rawTitle || '').trim();
  if (!raw) return '';

  const genreMatch = raw.match(/^\s*(\[[^\]]+\])\s*(.*)$/);
  const genrePrefix = genreMatch?.[1] || '';
  const body = String(genreMatch?.[2] ?? raw).trim();
  const parts = body
    .split(/[|│]/)
    .map((part) => stripExploreWrappingQuotes(part))
    .filter(Boolean);

  const normalizedBody = parts.length > 1
    ? parts.join(' | ')
    : stripExploreWrappingQuotes(body);

  return [genrePrefix, normalizedBody].filter(Boolean).join(' ').trim();
};

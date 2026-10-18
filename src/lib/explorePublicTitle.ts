const safeTitleText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const stripOuterPresentationQuotes = (value: string) => {
  const text = String(value || '').trim();
  if (text.length < 2) return text;
  const pairs: Array<[string, string]> = [["'", "'"], ['"', '"'], ['‘', '’'], ['“', '”']];
  const pair = pairs.find(([open, close]) => text.startsWith(open) && text.endsWith(close));
  return pair ? text.slice(pair[0].length, text.length - pair[1].length).trim() : text;
};

// app425 — Historical generated titles sometimes stored presentation quotes around
// the Korean/foreign title parts. Normalize only those enclosing quotes. Keep the
// [Genre] prefix, the language separator and meaningful quotes/apostrophes inside
// a real title intact.
export const normalizeExplorePublicTitle425 = (
  value: unknown,
  fallback = '제목 없는 곡',
): string => {
  const raw = safeTitleText(value, fallback);
  const genreMatch = raw.match(/^(\[[^\]]+\]\s*)/);
  const prefix = genreMatch?.[1] || '';
  const body = prefix ? raw.slice(prefix.length).trim() : raw;
  if (!body) return prefix.trim() || fallback;
  const parts = body.split(/\s*[|│]\s*/);
  const normalizedBody = parts
    .map(stripOuterPresentationQuotes)
    .filter(Boolean)
    .join(' | ');
  return `${prefix}${normalizedBody || fallback}`.trim();
};

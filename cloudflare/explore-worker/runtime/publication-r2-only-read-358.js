// SORIDRAW_PUBLICATION_R2_ONLY_READ_CUTOVER_358_20261005
// Pure gate helper. No D1/R2 I/O here.
// The cutover is deliberately triple-gated so merely shipping this code changes nothing.

export const EXPLORE_PUBLICATION_R2_ONLY_SCHEMA_358 = 1;

export function isExplorePublicationR2OnlyReadEnabled358(env) {
  return String(env?.SORIDRAW_R2_CATALOG_V1 || '').trim() === '1'
    && String(env?.SORIDRAW_R2_HYBRID_READ_V1 || '').trim() === '1'
    && String(env?.SORIDRAW_PUBLICATION_R2_ONLY_READ_V1 || '').trim() === '1';
}

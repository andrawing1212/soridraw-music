export type CatalogWarmCacheKind = 'musicNote' | 'library';

const positiveInt = (value: unknown): number => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

export const readCatalogProfileRevision = (
  kind: CatalogWarmCacheKind,
  profile: any,
): number => {
  if (!profile || typeof profile !== 'object') return 0;
  if (kind === 'library') return positiveInt(profile?.syncVersions?.library);
  return Math.max(
    positiveInt(profile?.syncVersions?.musicNote),
    positiveInt(profile?.favoriteSyncSignalUpdatedAt),
    positiveInt(profile?.favoriteSyncSignal?.at),
  );
};

export const canUseWarmCatalogWithoutRemote = ({
  localRevision,
  profileRevision,
  sessionValidated,
}: {
  localRevision: number;
  profileRevision: number;
  sessionValidated: boolean;
}): boolean => {
  const local = positiveInt(localRevision);
  const remote = positiveInt(profileRevision);
  if (local <= 0) return false;
  if (sessionValidated) return remote <= 0 || local >= remote;
  // Across app restarts, a server-authored IndexedDB Catalog may skip the
  // Worker only when the existing user-profile invalidation token proves
  // that the Catalog revision is current. Unknown profile state stays fail-safe.
  return remote > 0 && local >= remote;
};

export const shouldRefreshCatalogForProfile = ({
  catalogRevision,
  profileRevision,
}: {
  catalogRevision: number;
  profileRevision: number;
}): boolean => {
  const local = positiveInt(catalogRevision);
  const remote = positiveInt(profileRevision);
  return remote > 0 && (local <= 0 || remote > local);
};

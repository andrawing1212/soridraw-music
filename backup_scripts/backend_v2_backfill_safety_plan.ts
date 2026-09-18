import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STEP34_TARGET_PROJECT_ID = 'soridraw-app-866a5' as const;
export const STEP34_MAX_RUNTIME_WRITE_CAP = 1_000 as const;
export const STEP34_RECOMMENDED_BATCH_SIZE = 100 as const;
export const STEP34_CANARY_WRITE_CAP = 25 as const;

const REQUIRED_FILES = Object.freeze([
  'manifest.json',
  'user_structures.ndjson',
  'user_recent_songs.ndjson',
  'favorites.ndjson',
  'playlist_lists.ndjson',
  'playlist_items.ndjson',
] as const);

export type BackfillPlanSummary = {
  source: {
    manifestComplete: boolean;
    targetProjectId: string;
    backupDocuments: number;
    userStructures: number;
    recentBundleDocuments: number;
    recentSongItems: number;
    favorites: number;
    playlistHeaders: number;
    playlistItems: number;
  };
  identity: {
    favoritesWithUid: number;
    favoritesMissingUid: number;
    proposedStrongMatches: number;
    explicitIdMatches: number;
    providerTrackMatches: number;
    legacyKeyCorroboratedMatches: number;
    ambiguousMultipleRecentMatches: number;
    duplicateFavoriteTargetCollisions: number;
    standaloneFavorites: number;
  };
  projectedWrites: {
    settingsCreates: number;
    playlistHeaderCreates: number;
    playlistItemCreates: number;
    recentSongCreates: number;
    favoriteTrustedUpdates: number;
    favoriteStandaloneCreates: number;
    total: number;
  };
  safety: {
    firebaseImports: 0;
    networkCalls: 0;
    firestoreReads: 0;
    firestoreWrites: 0;
    firestoreDeletes: 0;
    noTouchDatasetsAccessed: 0;
    recommendedBatchSize: number;
    canaryWriteCap: number;
    maximumApprovedRuntimeWriteCap: number;
    actualBackfillExecutionAuthorized: false;
  };
};

type BackupRecord = {
  path: string;
  data: Record<string, unknown>;
};

type RecentSong = {
  uid: string;
  targetSongId: string;
  payload: Record<string, unknown>;
};

type FavoriteRecord = {
  uid: string | null;
  favoriteId: string;
  path: string;
  payload: Record<string, unknown>;
};

type MatchRule = 'explicit-id' | 'provider-track' | 'legacy-key-corroborated';

type MatchCandidate = {
  favorite: FavoriteRecord;
  recent: RecentSong;
  rule: MatchRule;
};

const asObject = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const nonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const firstString = (record: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = nonEmptyString(record[key]);
    if (value) return value;
  }
  return null;
};

const stableHash = (value: string): string => createHash('sha256').update(value).digest('hex');

export const deterministicRecentSongId = (uid: string, recentDocumentPath: string, index: number): string => (
  `v1r_${stableHash(`${uid}\n${recentDocumentPath}\n${index}`).slice(0, 32)}`
);

export const deterministicFavoriteSongId = (favoriteDocumentPath: string): string => (
  `v1f_${stableHash(favoriteDocumentPath).slice(0, 32)}`
);

const readJson = async (path: string): Promise<Record<string, unknown>> => {
  const parsed = JSON.parse(await readFile(path, 'utf-8')) as unknown;
  const object = asObject(parsed);
  if (!object) throw new Error('[Step 3-4] manifest must be an object');
  return object;
};

const loadNdjson = async (path: string): Promise<BackupRecord[]> => {
  const text = await readFile(path, 'utf-8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const records: BackupRecord[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = JSON.parse(lines[index]) as unknown;
    const record = asObject(parsed);
    const pathValue = nonEmptyString(record?.path);
    const data = asObject(record?.data);
    if (!pathValue || !data) {
      throw new Error(`[Step 3-4] invalid NDJSON record at line ${index + 1}`);
    }
    records.push({ path: pathValue, data });
  }
  return records;
};

const parseUidFromPath = (path: string, pattern: RegExp): string | null => {
  const match = pattern.exec(path);
  return match?.[1] ? String(match[1]) : null;
};

const parseFavoriteId = (path: string): string | null => {
  const match = /^favorites\/([^/]+)$/.exec(path);
  return match?.[1] ? String(match[1]) : null;
};

const getProviderTrackIdentity = (payload: Record<string, unknown>): { provider: string; trackId: string } | null => {
  const provider = firstString(payload, ['provider', 'audioProvider', 'sourceProvider', 'musicProvider']);
  const trackId = firstString(payload, ['trackId', 'sourceTrackId', 'providerTrackId', 'sunoId']);
  if (!provider || !trackId) return null;
  return { provider: provider.toLowerCase(), trackId };
};

const getAudioIdentity = (payload: Record<string, unknown>): string | null => (
  firstString(payload, ['audioUrl', 'audio_url', 'sourceAudioUrl', 'streamAudioUrl'])
);

const classifyPair = (
  favorite: Record<string, unknown>,
  recent: Record<string, unknown>,
): MatchRule | null => {
  const favoriteId = nonEmptyString(favorite.id);
  const recentId = nonEmptyString(recent.id);
  if (favoriteId && recentId && favoriteId === recentId) {
    return 'explicit-id';
  }

  const favoriteProvider = getProviderTrackIdentity(favorite);
  const recentProvider = getProviderTrackIdentity(recent);
  if (
    favoriteProvider
    && recentProvider
    && favoriteProvider.provider === recentProvider.provider
    && favoriteProvider.trackId === recentProvider.trackId
  ) {
    return 'provider-track';
  }

  const favoriteKey = nonEmptyString(favorite.favoriteKey);
  const recentKey = nonEmptyString(recent.favoriteKey);
  const favoriteAudio = getAudioIdentity(favorite);
  const recentAudio = getAudioIdentity(recent);
  if (
    favoriteKey
    && recentKey
    && favoriteKey === recentKey
    && favoriteAudio
    && recentAudio
    && favoriteAudio === recentAudio
  ) {
    return 'legacy-key-corroborated';
  }

  return null;
};

const ruleRank = (rule: MatchRule): number => {
  if (rule === 'explicit-id') return 3;
  if (rule === 'provider-track') return 2;
  return 1;
};

const bestMatchesForFavorite = (favorite: FavoriteRecord, recentSongs: RecentSong[]): MatchCandidate[] => {
  if (!favorite.uid) return [];
  const candidates = recentSongs
    .filter((recent) => recent.uid === favorite.uid)
    .map((recent) => ({ recent, rule: classifyPair(favorite.payload, recent.payload) }))
    .filter((entry): entry is { recent: RecentSong; rule: MatchRule } => Boolean(entry.rule));

  if (candidates.length === 0) return [];
  const highestRank = Math.max(...candidates.map((candidate) => ruleRank(candidate.rule)));
  return candidates
    .filter((candidate) => ruleRank(candidate.rule) === highestRank)
    .map((candidate) => ({ favorite, recent: candidate.recent, rule: candidate.rule }));
};

const assertExpectedSourcePaths = (
  structures: BackupRecord[],
  recentBundles: BackupRecord[],
  favorites: BackupRecord[],
  playlistHeaders: BackupRecord[],
  playlistItems: BackupRecord[],
): void => {
  const checks: Array<[BackupRecord[], RegExp, string]> = [
    [structures, /^user_structures\/[^/]+$/, 'user_structures'],
    [recentBundles, /^user_recent_songs\/[^/]+$/, 'user_recent_songs'],
    [favorites, /^favorites\/[^/]+$/, 'favorites'],
    [playlistHeaders, /^user_playlists\/[^/]+\/lists\/[^/]+$/, 'playlist_lists'],
    [playlistItems, /^user_playlists\/[^/]+\/lists\/[^/]+\/items\/[^/]+$/, 'playlist_items'],
  ];
  for (const [records, pattern, label] of checks) {
    if (records.some((record) => !pattern.test(record.path))) {
      throw new Error(`[Step 3-4] unexpected path in ${label}`);
    }
  }
};

export const buildBackfillSafetyPlan = async (directory: string): Promise<BackfillPlanSummary> => {
  const root = resolve(directory);
  const manifest = await readJson(resolve(root, 'manifest.json'));
  if (manifest.complete !== true) throw new Error('[Step 3-4] backup manifest is not complete');
  if (manifest.targetProjectId !== STEP34_TARGET_PROJECT_ID) {
    throw new Error('[Step 3-4] backup target project mismatch');
  }

  const manifestDatasets = Array.isArray(manifest.datasets) ? manifest.datasets : [];
  const manifestDocumentCount = manifestDatasets.reduce((total, dataset) => {
    const object = asObject(dataset);
    const count = Number(object?.documentCount || 0);
    return total + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);

  const [structures, recentBundles, favoritesRaw, playlistHeaders, playlistItems] = await Promise.all([
    loadNdjson(resolve(root, 'user_structures.ndjson')),
    loadNdjson(resolve(root, 'user_recent_songs.ndjson')),
    loadNdjson(resolve(root, 'favorites.ndjson')),
    loadNdjson(resolve(root, 'playlist_lists.ndjson')),
    loadNdjson(resolve(root, 'playlist_items.ndjson')),
  ]);

  assertExpectedSourcePaths(structures, recentBundles, favoritesRaw, playlistHeaders, playlistItems);

  const recentSongs: RecentSong[] = [];
  for (const bundle of recentBundles) {
    const uid = parseUidFromPath(bundle.path, /^user_recent_songs\/([^/]+)$/);
    if (!uid) throw new Error('[Step 3-4] recent bundle UID parse failed');
    const songs = Array.isArray(bundle.data.songs) ? bundle.data.songs : [];
    for (let index = 0; index < songs.length; index += 1) {
      const payload = asObject(songs[index]);
      if (!payload) throw new Error('[Step 3-4] recent song item must be an object');
      recentSongs.push({
        uid,
        targetSongId: deterministicRecentSongId(uid, bundle.path, index),
        payload,
      });
    }
  }

  const favorites: FavoriteRecord[] = favoritesRaw.map((record) => {
    const favoriteId = parseFavoriteId(record.path);
    if (!favoriteId) throw new Error('[Step 3-4] favorite document ID parse failed');
    return {
      uid: nonEmptyString(record.data.uid),
      favoriteId,
      path: record.path,
      payload: record.data,
    };
  });

  const provisional: MatchCandidate[] = [];
  let ambiguousMultipleRecentMatches = 0;
  for (const favorite of favorites) {
    const best = bestMatchesForFavorite(favorite, recentSongs);
    if (best.length === 1) provisional.push(best[0]);
    else if (best.length > 1) ambiguousMultipleRecentMatches += 1;
  }

  const byTarget = new Map<string, MatchCandidate[]>();
  for (const candidate of provisional) {
    const key = `${candidate.recent.uid}::${candidate.recent.targetSongId}`;
    const list = byTarget.get(key) || [];
    list.push(candidate);
    byTarget.set(key, list);
  }

  const duplicateFavoriteTargetCollisions = Array.from(byTarget.values())
    .filter((matches) => matches.length > 1)
    .reduce((total, matches) => total + matches.length, 0);

  const approvedStrongMatches = provisional.filter((candidate) => {
    const key = `${candidate.recent.uid}::${candidate.recent.targetSongId}`;
    return (byTarget.get(key)?.length || 0) === 1;
  });

  const explicitIdMatches = approvedStrongMatches.filter((match) => match.rule === 'explicit-id').length;
  const providerTrackMatches = approvedStrongMatches.filter((match) => match.rule === 'provider-track').length;
  const legacyKeyCorroboratedMatches = approvedStrongMatches.filter((match) => match.rule === 'legacy-key-corroborated').length;
  const favoritesMissingUid = favorites.filter((favorite) => !favorite.uid).length;
  const standaloneFavorites = favorites.length - approvedStrongMatches.length;

  const projectedWrites = {
    settingsCreates: structures.length,
    playlistHeaderCreates: playlistHeaders.length,
    playlistItemCreates: playlistItems.length,
    recentSongCreates: recentSongs.length,
    favoriteTrustedUpdates: approvedStrongMatches.length,
    favoriteStandaloneCreates: standaloneFavorites,
    total: 0,
  };
  projectedWrites.total = projectedWrites.settingsCreates
    + projectedWrites.playlistHeaderCreates
    + projectedWrites.playlistItemCreates
    + projectedWrites.recentSongCreates
    + projectedWrites.favoriteTrustedUpdates
    + projectedWrites.favoriteStandaloneCreates;

  return {
    source: {
      manifestComplete: true,
      targetProjectId: STEP34_TARGET_PROJECT_ID,
      backupDocuments: manifestDocumentCount,
      userStructures: structures.length,
      recentBundleDocuments: recentBundles.length,
      recentSongItems: recentSongs.length,
      favorites: favorites.length,
      playlistHeaders: playlistHeaders.length,
      playlistItems: playlistItems.length,
    },
    identity: {
      favoritesWithUid: favorites.length - favoritesMissingUid,
      favoritesMissingUid,
      proposedStrongMatches: approvedStrongMatches.length,
      explicitIdMatches,
      providerTrackMatches,
      legacyKeyCorroboratedMatches,
      ambiguousMultipleRecentMatches,
      duplicateFavoriteTargetCollisions,
      standaloneFavorites,
    },
    projectedWrites,
    safety: {
      firebaseImports: 0,
      networkCalls: 0,
      firestoreReads: 0,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      noTouchDatasetsAccessed: 0,
      recommendedBatchSize: STEP34_RECOMMENDED_BATCH_SIZE,
      canaryWriteCap: STEP34_CANARY_WRITE_CAP,
      maximumApprovedRuntimeWriteCap: STEP34_MAX_RUNTIME_WRITE_CAP,
      actualBackfillExecutionAuthorized: false,
    },
  };
};

const parseArgs = (argv: readonly string[]): { directory: string | null; output: string | null } => {
  let directory: string | null = null;
  let output: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--dir=')) directory = arg.slice('--dir='.length);
    if (arg.startsWith('--output=')) output = arg.slice('--output='.length);
  }
  return { directory, output };
};

const printSummary = (summary: BackfillPlanSummary): void => {
  console.log('SORIDRAW Backend V2 Step 3-4 offline safety plan');
  console.log(`backupDocuments=${summary.source.backupDocuments}`);
  console.log(`recentSongItems=${summary.source.recentSongItems}`);
  console.log(`favorites=${summary.source.favorites}`);
  console.log(`proposedStrongMatches=${summary.identity.proposedStrongMatches}`);
  console.log(`ambiguousMultipleRecentMatches=${summary.identity.ambiguousMultipleRecentMatches}`);
  console.log(`duplicateFavoriteTargetCollisions=${summary.identity.duplicateFavoriteTargetCollisions}`);
  console.log(`standaloneFavorites=${summary.identity.standaloneFavorites}`);
  console.log(`projectedWrites=${summary.projectedWrites.total}`);
  console.log('No Firebase connection was made; this is an offline plan only.');
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.directory) {
    throw new Error('[Step 3-4] --dir is required');
  }
  for (const file of REQUIRED_FILES) {
    await readFile(resolve(args.directory, file));
  }
  const summary = await buildBackfillSafetyPlan(args.directory);
  if (args.output) {
    await writeFile(resolve(args.output), `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
  }
  printSummary(summary);
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

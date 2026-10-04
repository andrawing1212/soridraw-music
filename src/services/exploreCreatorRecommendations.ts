export type CreatorGenreSignal = { key: string; family: string };

type CreatorTrack = { id: string; ownerUid: string; primaryGenre?: string | null };

// Compare representative profile genres before every song/source signal. No IO:
// callers supply the existing Feed, curated/popular caches and profile summaries.
export function rankExploreCreators<T extends CreatorTrack>(options: {
  currentUid: string;
  viewerGenres: string[];
  profileGenres: ReadonlyMap<string, string[]>;
  curated: T[];
  latest: T[];
  popular: T[];
  genreSignal: (genre: string) => CreatorGenreSignal;
  songGenre: (track: T) => string;
  limit?: number;
}): T[] {
  const viewer = options.viewerGenres.map(options.genreSignal).filter((g) => g.key);
  const similarity = (genres: string[]) => {
    const signals = genres.map(options.genreSignal).filter((g) => g.key);
    let best = 0;
    for (const a of viewer) for (const b of signals) {
      best = Math.max(best, a.key === b.key ? 2 : a.family && a.family === b.family ? 1 : 0);
    }
    return best;
  };
  const candidates = new Map<string, { track: T; profile: number; source: number; song: number; order: number }>();
  let order = 0;
  [options.curated, options.latest, options.popular].forEach((tracks, source) => {
    tracks.slice(0, 40).forEach((track) => {
      if (!track.ownerUid || track.ownerUid === options.currentUid) return;
      const profile = similarity(options.profileGenres.get(track.ownerUid) || []);
      const song = similarity([options.songGenre(track)]);
      const previous = candidates.get(track.ownerUid);
      if (!previous) candidates.set(track.ownerUid, { track, profile, source, song, order: order++ });
      // Keep the strongest auxiliary song within the creator's highest-priority source.
      else if (source === previous.source && song > previous.song) {
        previous.track = track;
        previous.song = song;
      }
    });
  });
  return [...candidates.values()]
    .sort((a, b) => b.profile - a.profile || a.source - b.source || b.song - a.song || a.order - b.order)
    .slice(0, options.limit ?? 20).map((candidate) => candidate.track);
}

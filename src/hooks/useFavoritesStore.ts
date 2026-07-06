import { useState, useEffect } from 'react';

// Pub/Sub store to keep the 400+ favorites out of App's main state
class FavoritesStore {
  private favorites: any[] = [];
  private statusMap = new Map<string, any>();
  private listeners = new Set<() => void>();

  getFavorites() {
    return this.favorites;
  }

  getStatusMap() {
    return this.statusMap;
  }

  setFavorites(list: any[]) {
    this.favorites = list;
    
    // Build O(1) status map
    const map = new Map<string, any>();
    list.forEach((fav) => {
      if (!this.isFavoriteHidden(fav)) {
        if (fav.id) map.set(fav.id, fav);
        const key = fav.favoriteKey || this.buildFavoriteIdentityKey(fav);
        if (key) map.set(key, fav);
      }
    });
    this.statusMap = map;

    this.notify();
  }

  private isFavoriteHidden(favorite: any) {
    if (!favorite) return true;
    return Boolean(
      favorite.favoriteRemoved === true
      || favorite.saved === false
      || favorite.favoriteRemovedAt
      || favorite.unlikedAt
      || favorite.unsavedAt
      || favorite.hidden === true
      || favorite.favoriteHidden === true
      || favorite.deletedAt
      || favorite.trashedAt
    );
  }

  private buildFavoriteIdentityKey(song: any) {
    if (!song) return '';
    if (song.favoriteKey) return song.favoriteKey;
    
    const normalize = (val: any) => String(val || '').replace(/[\s\r\n\t_.,\-!?]+/g, '').toLowerCase();
    const titlePart = normalize([song.title, song.koreanTitle, song.englishTitle].filter(Boolean).join(' '));
    const promptPart = normalize(song.prompt);
    const lyricPart = normalize(`${song.lyrics?.korean || ''} ${song.lyrics?.english || ''}`);
    const sourceText = [promptPart, lyricPart, titlePart].filter(Boolean).join('|').slice(0, 6000);
    if (!sourceText) return '';

    let hash = 2166136261;
    for (let index = 0; index < sourceText.length; index += 1) {
      hash ^= sourceText.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `song_${(hash >>> 0).toString(36)}`;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const favoritesStore = new FavoritesStore();

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => favoritesStore.getFavorites());

  useEffect(() => {
    return favoritesStore.subscribe(() => {
      setFavorites(favoritesStore.getFavorites());
    });
  }, []);

  return favorites;
}

export function useIsSongFavorited(song: any) {
  const [isFavorited, setIsFavorited] = useState(() => {
    if (!song) return false;
    const statusMap = favoritesStore.getStatusMap();
    if (song.id && statusMap.has(song.id)) return true;
    const key = song.favoriteKey || (song.title ? `${song.title}_${song.createdAtMs || ''}` : null);
    if (key && statusMap.has(key)) return true;
    return false;
  });

  useEffect(() => {
    const checkFavorite = () => {
      if (!song) return false;
      const statusMap = favoritesStore.getStatusMap();
      if (song.id && statusMap.has(song.id)) return true;
      const key = song.favoriteKey || (song.title ? `${song.title}_${song.createdAtMs || ''}` : null);
      if (key && statusMap.has(key)) return true;
      return false;
    };

    setIsFavorited(checkFavorite());

    return favoritesStore.subscribe(() => {
      setIsFavorited(checkFavorite());
    });
  }, [song]);

  return isFavorited;
}

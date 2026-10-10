// Tiny shared preference module: App reads this before the generation modal
// is opened, without importing the modal UI or its animation dependencies.
import type { V1LyricWritingStyle } from './MusicApiGenerateModal';

const V1_LYRIC_WRITING_STYLE_STORAGE_KEY = 'soridraw.main.v1LyricWritingStyle';
const isV1LyricWritingStyle = (value: unknown): value is V1LyricWritingStyle =>
  value === 'default' || value === 'kimEana';

export const readStoredV1LyricWritingStyle = (): V1LyricWritingStyle => {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = window.localStorage.getItem(V1_LYRIC_WRITING_STYLE_STORAGE_KEY);
    if (isV1LyricWritingStyle(stored)) return stored;
  } catch {
    // Keep the default when storage is unavailable.
  }
  return isV1LyricWritingStyle(window.__soridrawV1LyricWritingStyle)
    ? window.__soridrawV1LyricWritingStyle
    : 'default';
};

export const writeStoredV1LyricWritingStyle = (value: V1LyricWritingStyle) => {
  if (typeof window === 'undefined') return;
  window.__soridrawV1LyricWritingStyle = value;
  try {
    window.localStorage.setItem(V1_LYRIC_WRITING_STYLE_STORAGE_KEY, value);
  } catch {
    // Runtime copy keeps the selection for the current page session.
  }
};

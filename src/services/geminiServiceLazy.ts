// Stage perf candidate: keep the original Gemini engine and its side effects
// exactly intact. Load it only when a user explicitly starts generation,
// regeneration, translation, or custom-section metadata creation.
// This module performs ZERO network / Firebase reads on ordinary app entry.
type GeminiEngine = typeof import('./geminiService');
let enginePromise: Promise<GeminiEngine> | null = null;

const loadGeminiEngine = (): Promise<GeminiEngine> => {
  if (!enginePromise) {
    enginePromise = import('./geminiService').catch((error) => {
      // Chunk/network errors must remain retryable. Never swallow the error,
      // fabricate generated content or cause an eager module reload.
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
};

export const generateSong: GeminiEngine['generateSong'] =
  (...args) => loadGeminiEngine().then((mod) => mod.generateSong(...args));

export const translateTitleAndLyrics: GeminiEngine['translateTitleAndLyrics'] =
  (...args) => loadGeminiEngine().then((mod) => mod.translateTitleAndLyrics(...args));

export const translateLyrics: GeminiEngine['translateLyrics'] =
  (...args) => loadGeminiEngine().then((mod) => mod.translateLyrics(...args));

export const generateCustomSectionMetadata: GeminiEngine['generateCustomSectionMetadata'] =
  (...args) => loadGeminiEngine().then((mod) => mod.generateCustomSectionMetadata(...args));

export const regenerateLyricsOnly: GeminiEngine['regenerateLyricsOnly'] =
  (...args) => loadGeminiEngine().then((mod) => mod.regenerateLyricsOnly(...args));

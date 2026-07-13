/**
 * Stable engine route names used by the generation service boundary.
 *
 * `v1` maps to the current Classic engine. `v2` maps to the existing V2
 * implementation. `v3` is reserved for the isolated high-freedom engine and
 * is not connected to the UI yet.
 */
export type GenerationEngineRoute = 'v1' | 'v2' | 'v3';

export function resolveGenerationEngineRoute(version?: string | null): GenerationEngineRoute {
  if (version === 'v2') return 'v2';
  if (version === 'v3') return 'v3';
  return 'v1';
}

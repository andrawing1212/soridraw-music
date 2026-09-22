export interface V1ProductionCueOwnershipCandidate {
  sectionName: string;
  hasRenderedCue: boolean;
  planOwnsAudibleEvent: boolean;
  customOwnsAudibleEvent: boolean;
  explicitlyProductionOnly: boolean;
}

/**
 * Returns only sections whose current-song contract owns an audible production event and whose
 * rendered lyric card has not supplied it yet. Ordinary sung sections intentionally stay out of
 * this list: their mandatory performance cue is validated by the separate section-tag contract.
 */
export function selectV1MissingRequiredProductionCueSections(
  candidates: V1ProductionCueOwnershipCandidate[],
): string[] {
  return candidates
    .filter((candidate) => candidate.planOwnsAudibleEvent
      || candidate.customOwnsAudibleEvent
      || candidate.explicitlyProductionOnly)
    .filter((candidate) => !candidate.hasRenderedCue)
    .map((candidate) => candidate.sectionName);
}

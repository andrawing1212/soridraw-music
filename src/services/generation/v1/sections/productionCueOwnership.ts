export const V1_PRODUCTION_CUE_OWNERSHIP_AUDIT_EVENT = 'soridraw:v1-production-cue-ownership-audit';
const V1_PRODUCTION_CUE_OWNERSHIP_STORAGE_KEY = 'soridraw_v1_production_cue_ownership_audit_v1';
const V1_PRODUCTION_CUE_OWNERSHIP_MAX = 24;

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
  const missing = describeV1MissingRequiredProductionCueSections(candidates);
  recordV1ProductionCueOwnershipAudit(missing);
  return missing.map((candidate) => candidate.sectionName);
}


export interface V1ProductionCueOwnershipAuditItem {
  sectionName: string;
  ownerReasons: Array<'canonical-plan' | 'custom-production' | 'production-only'>;
  hasRenderedCue: boolean;
}

export interface V1ProductionCueOwnershipAuditEvent {
  createdAt: string;
  signature: string;
  repeatCount: number;
  missing: V1ProductionCueOwnershipAuditItem[];
}

export function describeV1MissingRequiredProductionCueSections(
  candidates: V1ProductionCueOwnershipCandidate[],
): V1ProductionCueOwnershipAuditItem[] {
  return candidates
    .filter((candidate) => candidate.planOwnsAudibleEvent
      || candidate.customOwnsAudibleEvent
      || candidate.explicitlyProductionOnly)
    .filter((candidate) => !candidate.hasRenderedCue)
    .map((candidate) => ({
      sectionName: candidate.sectionName,
      ownerReasons: [
        ...(candidate.planOwnsAudibleEvent ? ['canonical-plan' as const] : []),
        ...(candidate.customOwnsAudibleEvent ? ['custom-production' as const] : []),
        ...(candidate.explicitlyProductionOnly ? ['production-only' as const] : []),
      ],
      hasRenderedCue: candidate.hasRenderedCue,
    }));
}

function recordV1ProductionCueOwnershipAudit(items: V1ProductionCueOwnershipAuditItem[]): void {
  if (!items.length || typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    const signature = items
      .map((item) => `${item.sectionName}:${item.ownerReasons.join('+')}`)
      .sort()
      .join('|');
    const raw = JSON.parse(window.localStorage.getItem(V1_PRODUCTION_CUE_OWNERSHIP_STORAGE_KEY) || '[]');
    const current: V1ProductionCueOwnershipAuditEvent[] = Array.isArray(raw) ? raw : [];
    const now = Date.now();
    const previous = current[0];
    const previousAt = previous?.createdAt ? new Date(previous.createdAt).getTime() : 0;
    const next: V1ProductionCueOwnershipAuditEvent[] = previous
      && previous.signature === signature
      && Number.isFinite(previousAt)
      && now - previousAt <= 15_000
      ? [{
          ...previous,
          createdAt: new Date(now).toISOString(),
          repeatCount: Math.max(1, Number(previous.repeatCount || 1)) + 1,
          missing: items,
        }, ...current.slice(1)]
      : [{
          createdAt: new Date(now).toISOString(),
          signature,
          repeatCount: 1,
          missing: items,
        }, ...current];
    window.localStorage.setItem(
      V1_PRODUCTION_CUE_OWNERSHIP_STORAGE_KEY,
      JSON.stringify(next.slice(0, V1_PRODUCTION_CUE_OWNERSHIP_MAX)),
    );
    window.dispatchEvent(new CustomEvent(V1_PRODUCTION_CUE_OWNERSHIP_AUDIT_EVENT));
  } catch {
    // Admin-only local diagnostics must never affect generation.
  }
}

export function getV1ProductionCueOwnershipAudits(): V1ProductionCueOwnershipAuditEvent[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(V1_PRODUCTION_CUE_OWNERSHIP_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, V1_PRODUCTION_CUE_OWNERSHIP_MAX) : [];
  } catch {
    return [];
  }
}

// Pure release-parity decisions shared by runtime code and release verification.
// No Firebase/Cloudflare/browser dependency is allowed in this file.
export const normalizeEnvironmentParityVersion = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export const shouldReconcilePublicProfileOriginCache357 = (
  cachedPublicationSignalVersion: unknown,
  expectedPublicationSignalVersion: unknown,
): boolean => normalizeEnvironmentParityVersion(expectedPublicationSignalVersion)
  > normalizeEnvironmentParityVersion(cachedPublicationSignalVersion);

export const shouldRepairPersonalLikeOrigin357 = (input: {
  hasLocalState: boolean;
  latestSignalVersion: unknown;
  certifiedSignalVersion: unknown;
}): boolean => Boolean(input.hasLocalState)
  && normalizeEnvironmentParityVersion(input.latestSignalVersion) > 0
  && normalizeEnvironmentParityVersion(input.certifiedSignalVersion)
    < normalizeEnvironmentParityVersion(input.latestSignalVersion);

export const canAdvancePersonalLikeOriginCertificate357 = (input: {
  seenBefore: unknown;
  signalPreviousVersion: unknown;
  certifiedBefore: unknown;
  repairTargetAfter: unknown;
}): boolean => {
  const seen = normalizeEnvironmentParityVersion(input.seenBefore);
  const previous = normalizeEnvironmentParityVersion(input.signalPreviousVersion);
  const certified = normalizeEnvironmentParityVersion(input.certifiedBefore);
  const repair = normalizeEnvironmentParityVersion(input.repairTargetAfter);
  return seen > 0 && previous === seen && certified >= seen && repair === 0;
};


export const shouldAttemptPersonalLikeOriginRepair358 = (input: {
  latestSignalVersion: unknown;
  certifiedSignalVersion: unknown;
  attemptedSignalVersion: unknown;
}): boolean => {
  const latest = normalizeEnvironmentParityVersion(input.latestSignalVersion);
  const certified = normalizeEnvironmentParityVersion(input.certifiedSignalVersion);
  const attempted = normalizeEnvironmentParityVersion(input.attemptedSignalVersion);
  return latest > 0 && certified < latest && attempted < latest;
};


export const shouldAttemptPersonalLikeOriginSettlement359 = (input: {
  hasLocalState: boolean;
  latestSignalVersion: unknown;
  settledSignalVersion: unknown;
  attemptedSignalVersion: unknown;
}): boolean => {
  if (!input.hasLocalState) return false;
  const latest = normalizeEnvironmentParityVersion(input.latestSignalVersion);
  const settled = normalizeEnvironmentParityVersion(input.settledSignalVersion);
  const attempted = normalizeEnvironmentParityVersion(input.attemptedSignalVersion);
  return latest > 0 && settled < latest && attempted < latest;
};

// app361 incident recovery: a Music Note publication snapshot is origin-local.
// Reconcile only when the retained UID publication signal proves that this
// browser origin has not certified the newest publication generation.
export const shouldRepairMusicNotePublicationOrigin361 = (input: {
  hasLocalState: boolean;
  latestSignalVersion: unknown;
  certifiedSignalVersion: unknown;
}): boolean => Boolean(input.hasLocalState)
  && normalizeEnvironmentParityVersion(input.latestSignalVersion) > 0
  && normalizeEnvironmentParityVersion(input.certifiedSignalVersion)
    < normalizeEnvironmentParityVersion(input.latestSignalVersion);

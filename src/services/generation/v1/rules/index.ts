/** V1 engine-specific rules are kept in this folder. */
export {
  buildV1SharedSceneAlignmentInstruction,
  mergeV1ForcedVocalIdentityWithGeneratedPerformance,
} from './sharedSceneAlignment';
export type { V1SharedSceneAlignmentContext } from './sharedSceneAlignment';

export {
  buildV1ArrangementSectionPlanInstruction,
  buildV1ArrangementSectionSkeleton,
  buildV1CommonSectionRoleReference,
  compactV1SectionStructuredArrangement,
  ensureV1ArrangementSectionCoverage,
  extractV1ArrangementSections,
  isV1SectionStructuredArrangement,
  normalizeV1SectionStructuredArrangement,
} from './sectionArrangementRoles';

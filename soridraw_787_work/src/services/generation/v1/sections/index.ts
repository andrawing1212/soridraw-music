export {
  buildV1SectionBlueprintInstruction,
  buildV1SectionSlotContractInstruction,
  createV1SectionBlueprint,
  formatV1SectionBlueprintOrder,
  getV1SectionBlueprint,
} from './sectionBlueprint';
export type {
  V1SectionBlueprint,
  V1SectionBlueprintEntry,
  V1SectionEngineParams,
  V1SectionProfile,
} from './sectionBlueprint';

import * as v1SectionGuardModule from './sectionGuard';

export {
  applyV1SectionBlueprintGuard,
  filterV1SectionRoleIssuesForUserIntent,
  inspectV1SectionBlueprintFit,
} from './sectionGuard';
export type { V1SectionRoleIssue, V1SectionValidationIssue } from './sectionGuard';

// Compatibility bridge for dev/HMR environments that may temporarily load a previous
// sectionGuard module before the newly added role inspector export is refreshed.
// A namespace lookup avoids a fatal ESM named-export mismatch during app startup.
export const inspectV1LyricsForRoleIssues: typeof v1SectionGuardModule.inspectV1LyricsForRoleIssues = (...args) => {
  const inspector = v1SectionGuardModule.inspectV1LyricsForRoleIssues;
  return typeof inspector === 'function' ? inspector(...args) : [];
};

export { collapseV1WrappedBracketTags } from './sectionRenderer';

export {
  baseV1SectionName,
  cleanV1SectionCue,
  getV1CustomSectionNames,
  getV1SectionDefinition,
  isV1SoundOrProductionCue,
  isV1StandaloneCueLine,
  isV1StructuralSectionTag,
  normalizeV1SectionName,
  parseV1SectionTagLine,
} from './sectionRegistry';
export type {
  ParsedV1SectionTag,
  V1SectionDefinition,
  V1SectionKind,
} from './sectionRegistry';

export { buildV1AdaptiveLyricFlowInstruction } from './sectionLyricFlow';

export {
  resolveV1VocalAnchorDescriptors,
  resolveV1VocalTotal,
} from './vocalAnchors';
export type {
  V1VocalAnchorConfig,
  V1VocalAnchorDescriptor,
} from './vocalAnchors';

export {
  buildV1SectionRoleText,
  describeV1SectionMass,
  getV1SectionRolePolicy,
  resolveV1SectionRoleKey,
  v1SectionMassRank,
} from './sectionRoleEngine';
export type {
  V1SectionMassClass,
  V1SectionRepeatMode,
  V1SectionRoleFamily,
  V1SectionRolePolicy,
} from './sectionRoleEngine';


export {
  isV1CircularRoleSectionName,
  isV1EmbeddedDropRoleSectionName,
  isV1HookRoleSectionName,
  resolveV1HookRolePlan,
} from './hookRoleEngine';
export type {
  V1DropHookPlacementMode,
  V1HookRoleFamily,
  V1HookRolePlan,
} from './hookRoleEngine';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ts from 'typescript';
import {
  describeV1MissingRequiredProductionCueSections,
  selectV1MissingRequiredProductionCueSections,
} from '../src/services/generation/v1/sections/productionCueOwnership';

const SOURCE_PATH = 'src/services/geminiService.ts';
const BASELINE_SHA = process.env.APP147_BASELINE_SHA || 'd3d8d87157dec499d7b51293034700531f6efea3';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const optionalMissing = selectV1MissingRequiredProductionCueSections([
  { sectionName: 'Verse 1', hasRenderedCue: false, planOwnsAudibleEvent: false, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
  { sectionName: 'Chorus 1', hasRenderedCue: false, planOwnsAudibleEvent: false, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
]);
assert(optionalMissing.length === 0, `ordinary sung sections must not require production cues: ${optionalMissing.join(', ')}`);

const planOwnedMissing = selectV1MissingRequiredProductionCueSections([
  { sectionName: 'Chorus 1', hasRenderedCue: false, planOwnsAudibleEvent: true, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
]);
assert(planOwnedMissing.includes('Chorus 1'), 'a canonical plan-owned audible event must remain required');

assert(
  !selectV1MissingRequiredProductionCueSections([
    { sectionName: 'Chorus 1', hasRenderedCue: true, planOwnsAudibleEvent: true, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
  ]).includes('Chorus 1'),
  'an existing canonical cue must be reused instead of repaired',
);

const customMissing = selectV1MissingRequiredProductionCueSections([
  { sectionName: 'Verse 1', hasRenderedCue: false, planOwnsAudibleEvent: false, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
  { sectionName: 'Interlude', hasRenderedCue: false, planOwnsAudibleEvent: false, customOwnsAudibleEvent: true, explicitlyProductionOnly: true },
]);
assert(!customMissing.includes('Verse 1'), 'vocal-only custom instructions must not become production ownership');
assert(customMissing.includes('Interlude'), 'an instrumental transition with a missing cue must remain repairable');

const ownershipAudit = describeV1MissingRequiredProductionCueSections([
  { sectionName: 'Chorus 2', hasRenderedCue: false, planOwnsAudibleEvent: true, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
  { sectionName: 'Verse 2', hasRenderedCue: false, planOwnsAudibleEvent: false, customOwnsAudibleEvent: false, explicitlyProductionOnly: false },
]);
assert(ownershipAudit.length === 1 && ownershipAudit[0]?.sectionName === 'Chorus 2', 'ownership audit must expose only genuinely required missing cues');
assert(ownershipAudit[0]?.ownerReasons.includes('canonical-plan'), 'ownership audit must explain canonical-plan ownership');

function collectInitializerSizes(sourceText: string) {
  const source = ts.createSourceFile(SOURCE_PATH, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const wanted = new Set([
    'sectionPerformancePlanOutputInstruction',
    'sectionSlotContractInstruction',
    'exactStructureText',
    'selectedLanguageFirstPassInstruction',
    'languageMixInstruction',
    'japaneseFirstPassLanguageContract',
    'styleIntentSingleSourceInstruction',
    'arrangementSectionPlanInstruction',
    'sectionCueOutputInstruction',
    'globalMoodDistributionInstruction',
    'moodRoleTranslationInstruction',
    'recentTitleAntiRepeatInstruction',
    'recentLyricAntiRepeatInstruction',
    'storyContextInstruction',
    'systemInstruction',
    'generateParams',
  ]);
  const sizes: Record<string, number> = {};
  const exactInitializers = new Map<string, string[]>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      const text = node.initializer.getText(source);
      if (wanted.has(name) && sizes[name] === undefined) sizes[name] = text.length;
      if (wanted.has(name) && text.length >= 160) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        exactInitializers.set(normalized, [...(exactInitializers.get(normalized) || []), name]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const exactDuplicates = [...exactInitializers.entries()]
    .filter(([, names]) => new Set(names).size > 1)
    .map(([text, names]) => ({ chars: text.length, owners: [...new Set(names)].sort() }));
  return { sizes, exactDuplicates };
}

const currentSource = fs.readFileSync(SOURCE_PATH, 'utf8');
const proxySource = fs.readFileSync('src/services/geminiProxyClient.ts', 'utf8');
const auditSource = fs.readFileSync('src/services/geminiAuditLog.ts', 'utf8');
const adminAuditSource = fs.readFileSync('src/pages/AdminGeminiAuditPage.tsx', 'utf8');
assert(proxySource.includes('measureGeminiRequestShape(requestParams, meta.fallbackInstruction)'), 'runtime request-shape measurement missing');
assert(proxySource.includes('soridrawRequestResponseSchemaChars'), 'response-schema character measurement missing');
assert(auditSource.includes('requestResponseSchemaChars'), 'Gemini audit storage does not preserve request-shape measurement');
assert(adminAuditSource.includes('요청크기') && adminAuditSource.includes('응답스키마'), 'admin audit does not expose request-shape breakdown');
assert(adminAuditSource.includes('최근 섹션 지시문 보완 판정'), 'admin audit does not expose production-cue ownership reason');
assert(currentSource.includes('selectV1MissingRequiredProductionCueSections(candidates)'), 'runtime integration must use the ownership selector');
assert(currentSource.includes('getV1PlanProductionCueForSection('), 'canonical soundCue/arrangementAction reuse must remain connected');
assert(currentSource.includes("'repairV1FinalProductionCues'"), 'required-event Gemini fallback must remain available');
assert(currentSource.includes('Bare or anchor-only sung tags are invalid'), 'sung performance-cue contract must remain protected');
const baselineSource = execFileSync('git', ['show', `${BASELINE_SHA}:${SOURCE_PATH}`], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});
const before = collectInitializerSizes(baselineSource);
const after = collectInitializerSizes(currentSource);

const report = {
  baseline: BASELINE_SHA,
  measurement: 'TypeScript initializer source characters; approximate tokens = chars / 4',
  beforeTotalMeasuredChars: Object.values(before.sizes).reduce((sum, value) => sum + value, 0),
  afterTotalMeasuredChars: Object.values(after.sizes).reduce((sum, value) => sum + value, 0),
  beforeSystemInstructionSourceChars: before.sizes.systemInstruction,
  afterSystemInstructionSourceChars: after.sizes.systemInstruction,
  largestCurrentOwnerBlocks: Object.entries(after.sizes)
    .filter(([name]) => name !== 'systemInstruction' && name !== 'generateParams')
    .sort((a, b) => b[1] - a[1]),
  exactDuplicateCandidatesBefore: before.exactDuplicates,
  exactDuplicateCandidatesAfter: after.exactDuplicates,
};

console.log(JSON.stringify(report, null, 2));
console.log('APP147_GEMINI_PROMPT_AND_CUE_AUDIT=PASS');

export type V1LanguageMixLanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'ru' | 'th';
export type V1LanguageMixCardKey = 'korean' | 'secondary';

export interface V1LanguageMixLineVariant {
  targetLanguage: V1LanguageMixLanguageCode;
  line: string;
}

export interface V1LanguageMixRepairSlot {
  sectionIndex: number;
  sectionName: string;
  lineIndex: number;
  baseLine: string;
  targetVariants: V1LanguageMixLineVariant[];
}

export interface V1LanguageMixBlueprint {
  koreanSlots: V1LanguageMixRepairSlot[];
  secondarySlots: V1LanguageMixRepairSlot[];
}

export interface V1LanguageMixRepairSeed {
  sectionIndex: number;
  sectionName: string;
  sectionFamily: string;
  lineIndex: number;
  originalLine: string;
}

export interface V1LanguageMixAudit {
  active: boolean;
  card: V1LanguageMixCardKey;
  baseLanguage: V1LanguageMixLanguageCode;
  targetLanguages: V1LanguageMixLanguageCode[];
  requestedRatio: number;
  lowerBound: number;
  upperBound: number;
  actualMixRatio: number;
  actualBaseRatio: number;
  totalLexicalUnits: number;
  languageUnits: Partial<Record<V1LanguageMixLanguageCode, number>>;
  languageRatios: Partial<Record<V1LanguageMixLanguageCode, number>>;
  targetGoals: Partial<Record<V1LanguageMixLanguageCode, number>>;
  targetLowerBounds: Partial<Record<V1LanguageMixLanguageCode, number>>;
  targetUpperBounds: Partial<Record<V1LanguageMixLanguageCode, number>>;
  targetSectionFamilyCount: number;
  requiredSectionFamilyCount: number;
  uniqueTargetExpressionCount: number;
  requiredUniqueTargetExpressionCount: number;
  placementMode: 'accent' | 'hook-led' | 'distributed-blocks' | 'balanced-blocks' | 'target-dominant' | 'near-total';
  alternatingSequenceCount: number;
  maxAllowedAlternatingSequences: number;
  mirroredTranslationPairCount: number;
  maxAllowedMirroredPairs: number;
  isolatedTargetLineCount: number;
  targetBlockCount: number;
  averageTargetBlockLength: number;
  targetSectionCount: number;
  requiredTargetSectionCount: number;
  maxTargetSectionShare: number;
  maxAllowedTargetSectionShare: number;
  maxTargetSectionRatio: number;
  overloadedTargetSectionCount: number;
  duplicateTargetExpressionCount: number;
  placementPassed: boolean;
  repairApplied: boolean;
  replacedLineCount: number;
  status: 'inactive' | 'passed' | 'needs-review' | 'preserved';
  reasons: string[];
}

export interface EnforceV1LanguageMixCardInput {
  lyrics: string;
  card: V1LanguageMixCardKey;
  baseLanguage: V1LanguageMixLanguageCode;
  targetLanguages: V1LanguageMixLanguageCode[];
  requestedRatio: number;
  slots?: V1LanguageMixRepairSlot[];
  preserveMode?: boolean;
  protectedLines?: string[];
  allowLineAlternation?: boolean;
}

export interface EnforceV1LanguageMixCardResult {
  lyrics: string;
  audit: V1LanguageMixAudit;
}

const STRUCTURAL_SECTION_RE = /^(?:intro|verse|pre[\s-]*chorus|chorus|post[\s-]*chorus|hook|refrain|rap(?:\s+section)?|bridge|breakdown|drop|break|stop|instrumental|interlude|outro|final(?:\s+chorus|\s+hook)?|main\s+theme|theme|climax)\b/i;
const NON_LEXICAL_LATIN = new Set(['ah', 'aah', 'oh', 'ooh', 'woo', 'woah', 'yeah', 'yea', 'hey', 'huh', 'mm', 'mmm', 'hmm', 'uh', 'uhh']);

const LATIN_HINTS: Record<'en' | 'es' | 'fr' | 'de', Set<string>> = {
  en: new Set(['the','a','an','and','i','you','we','they','my','your','our','is','are','am','to','of','in','on','for','with','not','no','go','way','dream','tonight','light','love','heart','time','now','never','again','move','step','find','feel','can','will','want','this','that','me','it']),
  es: new Set(['el','la','los','las','de','del','que','y','en','un','una','mi','tu','no','más','para','con','por','soy','estoy','quiero','puedo','noche','corazón','camino','sueño','hoy','ahora','nunca','otra','vez','luz','vida','amor','vamos']),
  fr: new Set(['le','la','les','de','des','du','et','en','un','une','je','tu','nous','vous','pas','plus','pour','avec','mon','ma','mes','dans','suis','veux','peux','nuit','cœur','coeur','chemin','rêve','reve','aujourd’hui','aujourdhui','maintenant','jamais','encore','lumière','lumiere','vie','amour']),
  de: new Set(['der','die','das','den','dem','des','und','ich','du','wir','ihr','nicht','ein','eine','mein','meine','mit','für','fur','auf','im','in','zu','ist','bin','sind','will','kann','nacht','traum','weg','heute','jetzt','nie','wieder','licht','leben','liebe']),
};

function clampRatio(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const allowed = [0, 5, 10, 20, 30, 50, 70, 90];
  return allowed.reduce((best, candidate) => Math.abs(candidate - numeric) < Math.abs(best - numeric) ? candidate : best, 0);
}

function normalizeSpaces(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value: unknown): string {
  return normalizeSpaces(value)
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, '')
    .replace(/[.,!?。！？;:，、…]+$/g, '')
    .toLocaleLowerCase();
}

function cleanLyricLine(value: unknown): string {
  return String(value || '')
    .replace(/^\s*\[[^\]]+\]\s*$/gm, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 220);
}

function isBracketLine(line: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(String(line || ''));
}

function parseSectionName(line: string): string | null {
  const match = String(line || '').trim().match(/^\[([^\]]+)\]$/);
  if (!match) return null;
  const name = normalizeSpaces(match[1].split(':')[0]);
  return STRUCTURAL_SECTION_RE.test(name) ? name : null;
}

function sectionFamily(sectionName: string): string {
  const value = normalizeSpaces(sectionName).toLocaleLowerCase();
  if (/^pre[\s-]*chorus/.test(value)) return 'pre-chorus';
  if (/^(?:final\s+chorus|chorus)/.test(value)) return 'chorus';
  if (/^(?:final\s+hook|hook)/.test(value)) return 'hook';
  if (/^verse/.test(value)) return 'verse';
  if (/^rap/.test(value)) return 'rap';
  if (/^bridge/.test(value)) return 'bridge';
  if (/^intro/.test(value)) return 'intro';
  if (/^outro/.test(value)) return 'outro';
  if (/^refrain/.test(value)) return 'refrain';
  if (/^drop/.test(value)) return 'drop';
  if (/^(?:main\s+theme|theme|climax)/.test(value)) return 'theme';
  return value || 'unknown';
}

function isNonLexicalVocalLine(line: string): boolean {
  const stripped = normalizeSpaces(line)
    .replace(/[(){}\[\],.!?。！？…~\-–—_"'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
  if (!stripped) return true;
  const compactHangul = stripped.replace(/\s+/g, '');
  if (/^(?:음|으음|으으음|우|우우|아|아아|오|오오|에|예|허밍)+$/u.test(compactHangul)) return true;
  const latin = stripped.match(/[a-zà-öø-ÿß]+(?:['’-][a-zà-öø-ÿß]+)?/gi) || [];
  if (latin.length > 0 && latin.every((word) => NON_LEXICAL_LATIN.has(word.toLocaleLowerCase()))) return true;
  return false;
}

function isLyricBodyLine(line: string): boolean {
  const trimmed = normalizeSpaces(line);
  if (!trimmed || isBracketLine(trimmed) || isNonLexicalVocalLine(trimmed)) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
}

function ratioBounds(ratio: number): { lower: number; upper: number } {
  if (ratio <= 0) return { lower: 0, upper: 0 };
  if (ratio <= 5) return { lower: 2, upper: 8 };
  if (ratio <= 10) return { lower: 5, upper: 15 };
  if (ratio <= 20) return { lower: 15, upper: 25 };
  if (ratio <= 30) return { lower: 25, upper: 35 };
  if (ratio <= 50) return { lower: 43, upper: 57 };
  if (ratio <= 70) return { lower: 63, upper: 77 };
  return { lower: 84, upper: 95 };
}

function placementModeForRatio(ratio: number): V1LanguageMixAudit['placementMode'] {
  if (ratio <= 5) return 'accent';
  if (ratio <= 10) return 'hook-led';
  if (ratio <= 30) return 'distributed-blocks';
  if (ratio <= 50) return 'balanced-blocks';
  if (ratio <= 70) return 'target-dominant';
  return 'near-total';
}

function maxAllowedAlternatingSequences(ratio: number, allowLineAlternation = false): number {
  if (allowLineAlternation) return ratio >= 50 ? 2 : 1;
  return 0;
}

function preferredTargetBlockLength(ratio: number): { min: number; max: number } {
  if (ratio <= 5) return { min: 1, max: 1 };
  if (ratio <= 10) return { min: 1, max: 2 };
  if (ratio <= 20) return { min: 1, max: 2 };
  if (ratio <= 30) return { min: 2, max: 3 };
  if (ratio <= 50) return { min: 2, max: 4 };
  if (ratio <= 70) return { min: 3, max: 5 };
  return { min: 4, max: 8 };
}

function maxTargetSectionShareForRatio(ratio: number, availableSections: number): number {
  if (availableSections <= 1) return 100;
  if (ratio <= 5) return 100;
  if (ratio <= 10) return 70;
  if (ratio <= 20) return 35;
  if (ratio <= 30) return 42;
  if (ratio <= 50) return 36;
  if (ratio <= 70) return 34;
  return 32;
}

function maxTargetRatioInsideSection(ratio: number): number {
  if (ratio <= 5) return 45;
  if (ratio <= 10) return 50;
  if (ratio <= 20) return 52;
  if (ratio <= 30) return 66;
  if (ratio <= 50) return 78;
  if (ratio <= 70) return 92;
  return 100;
}

function requiredTargetSectionCount(ratio: number, availableSections: number): number {
  const desired = ratio <= 5 ? 1
    : ratio <= 10 ? 2
      : ratio <= 20 ? 4
        : ratio <= 30 ? 3
          : ratio <= 50 ? 5
            : ratio <= 70 ? 6
              : 7;
  return Math.max(1, Math.min(desired, Math.max(1, availableSections)));
}

function isHookFamily(family: string): boolean {
  return /^(?:chorus|hook|refrain|drop|theme)$/i.test(String(family || ''));
}

function sectionPlacementPriority(family: string, ratio: number): number {
  const low: Record<string, number> = { chorus: 40, hook: 40, refrain: 38, 'pre-chorus': 32, rap: 30, bridge: 24, outro: 20, intro: 18, verse: 14, theme: 24, drop: 26 };
  const balanced: Record<string, number> = { chorus: 34, hook: 34, refrain: 32, rap: 31, verse: 30, 'pre-chorus': 28, bridge: 26, theme: 26, outro: 20, intro: 18, drop: 24 };
  const dominant: Record<string, number> = { verse: 36, rap: 36, chorus: 34, hook: 34, refrain: 32, 'pre-chorus': 30, bridge: 28, theme: 28, outro: 22, intro: 20, drop: 24 };
  if (ratio <= 20) return low[family] || 10;
  if (ratio <= 50) return balanced[family] || 10;
  return dominant[family] || 10;
}

function requiredSectionCount(ratio: number, available: number): number {
  const desired = ratio <= 5 ? 1
    : ratio <= 10 ? 2
      : ratio <= 20 ? 3
        : ratio <= 30 ? 3
          : ratio <= 70 ? 4
            : 5;
  return Math.max(1, Math.min(desired, Math.max(1, available)));
}

function requiredUniqueExpressionCount(ratio: number, bodyLineCount: number): number {
  const desired = ratio <= 5 ? 1 : ratio <= 10 ? 2 : ratio <= 20 ? 3 : ratio <= 30 ? 4 : ratio <= 50 ? 6 : ratio <= 70 ? 8 : 10;
  return Math.max(1, Math.min(desired, Math.max(1, Math.round(bodyLineCount * 0.35))));
}

function splitWords(line: string): string[] {
  return String(line || '').match(/[A-Za-zÀ-ÖØ-öø-ÿß]+(?:[’'-][A-Za-zÀ-ÖØ-öø-ÿß]+)?/g) || [];
}

function latinWordLanguage(word: string, selectedLanguages: Set<V1LanguageMixLanguageCode>, trustedLanguage?: V1LanguageMixLanguageCode): V1LanguageMixLanguageCode | null {
  const lower = word.toLocaleLowerCase();
  if (NON_LEXICAL_LATIN.has(lower)) return null;
  if (trustedLanguage && ['en','es','fr','de'].includes(trustedLanguage)) return trustedLanguage;
  if (/[ñáéíóúü¿¡]/i.test(word) && selectedLanguages.has('es')) return 'es';
  if (/[çàâæéèêëîïôœùûüÿ]/i.test(word) && selectedLanguages.has('fr')) return 'fr';
  if (/[äöüß]/i.test(word) && selectedLanguages.has('de')) return 'de';
  const scores: Array<[V1LanguageMixLanguageCode, number]> = (['en','es','fr','de'] as V1LanguageMixLanguageCode[])
    .filter((language) => selectedLanguages.has(language))
    .map((language) => [language, LATIN_HINTS[language as 'en'|'es'|'fr'|'de'].has(lower) ? 2 : 0]);
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0]?.[1] > 0 && scores[0][1] > (scores[1]?.[1] || 0)) return scores[0][0];
  const latinSelected = (['en','es','fr','de'] as V1LanguageMixLanguageCode[]).filter((language) => selectedLanguages.has(language));
  return latinSelected.length === 1 ? latinSelected[0] : null;
}

function addUnits(target: Partial<Record<V1LanguageMixLanguageCode, number>>, language: V1LanguageMixLanguageCode, amount: number): void {
  if (amount <= 0) return;
  target[language] = (target[language] || 0) + amount;
}

function languageUnitCounts(
  line: string,
  selectedLanguages: Set<V1LanguageMixLanguageCode>,
  trustedLanguage?: V1LanguageMixLanguageCode,
): Partial<Record<V1LanguageMixLanguageCode, number>> {
  const counts: Partial<Record<V1LanguageMixLanguageCode, number>> = {};
  const value = String(line || '');

  const hangulWords = value.match(/[가-힣]+/g) || [];
  addUnits(counts, 'ko', hangulWords.length);

  const cyrillicWords = value.match(/[\u0400-\u04ff]+/g) || [];
  addUnits(counts, 'ru', cyrillicWords.length);

  const thaiRuns: string[] = value.match(/[\u0e00-\u0e7f]+/g) ?? [];
  addUnits(counts, 'th', thaiRuns.reduce((sum, run) => sum + Math.max(1, Math.round(Array.from(run).length / 3)), 0));

  const kanaChars = value.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || [];
  const hanChars = value.match(/[\u4e00-\u9fff]/g) || [];
  if (kanaChars.length > 0 || trustedLanguage === 'ja') {
    addUnits(counts, 'ja', Math.max(1, Math.round((kanaChars.length + hanChars.length) / 2)));
  } else if (hanChars.length > 0) {
    const hanLanguage: V1LanguageMixLanguageCode = trustedLanguage === 'zh' || selectedLanguages.has('zh') ? 'zh' : selectedLanguages.has('ja') ? 'ja' : 'zh';
    addUnits(counts, hanLanguage, Math.max(1, Math.round(hanChars.length / 2)));
  }

  splitWords(value).forEach((word) => {
    const language = latinWordLanguage(word, selectedLanguages, trustedLanguage);
    if (language) addUnits(counts, language, 1);
  });

  return counts;
}

interface ParsedLyricLine {
  absoluteIndex: number;
  sectionIndex: number;
  sectionName: string;
  family: string;
  bodyLineIndex: number;
  line: string;
}

interface ParsedSectionBlock {
  sectionIndex: number;
  sectionName: string;
  family: string;
  tagIndex: number;
  endIndex: number;
  bodyLines: ParsedLyricLine[];
}

function parseLyricStructure(lines: string[]): { bodyLines: ParsedLyricLine[]; blocks: ParsedSectionBlock[] } {
  const blocks: ParsedSectionBlock[] = [];
  const bodyLines: ParsedLyricLine[] = [];
  let current: ParsedSectionBlock | null = null;
  let sectionCounter = 0;
  lines.forEach((line, index) => {
    const sectionName = parseSectionName(line);
    if (sectionName) {
      if (current) current.endIndex = index - 1;
      sectionCounter += 1;
      current = {
        sectionIndex: sectionCounter,
        sectionName,
        family: sectionFamily(sectionName),
        tagIndex: index,
        endIndex: lines.length - 1,
        bodyLines: [],
      };
      blocks.push(current);
      return;
    }
    if (!current || !isLyricBodyLine(line)) return;
    const entry: ParsedLyricLine = {
      absoluteIndex: index,
      sectionIndex: current.sectionIndex,
      sectionName: current.sectionName,
      family: current.family,
      bodyLineIndex: current.bodyLines.length + 1,
      line,
    };
    current.bodyLines.push(entry);
    bodyLines.push(entry);
  });
  if (current) current.endIndex = lines.length - 1;
  return { bodyLines, blocks };
}

export function collectV1LanguageMixRepairSeeds(
  lyrics: string,
  options?: { maxSlots?: number; protectedLines?: string[]; spreadAcrossSections?: boolean },
): V1LanguageMixRepairSeed[] {
  const lines = String(lyrics || '').split('\n');
  const parsed = parseLyricStructure(lines);
  const maxSlots = Math.max(1, Math.min(48, Math.round(Number(options?.maxSlots || 48))));
  const protectedKeys = new Set((options?.protectedLines || []).map(normalizeComparable).filter(Boolean));
  const sectionQueues = parsed.blocks
    .map((block) => block.bodyLines
      .filter((entry) => !protectedKeys.has(normalizeComparable(entry.line)))
      .map((entry) => ({
        sectionIndex: entry.sectionIndex,
        sectionName: entry.sectionName,
        sectionFamily: entry.family,
        lineIndex: entry.bodyLineIndex,
        originalLine: cleanLyricLine(entry.line),
      }))
      .filter((seed) => Boolean(seed.originalLine)))
    .filter((queue) => queue.length > 0);

  if (options?.spreadAcrossSections === false) {
    return sectionQueues.flat().slice(0, maxSlots);
  }

  // Exact repair candidates must cover the whole song, not only the first Verse/Chorus.
  // Round-robin selection keeps later Verse 2, Bridge, Final Chorus, and Outro available
  // to the deterministic ratio solver, which is essential for section-level distribution.
  const seeds: V1LanguageMixRepairSeed[] = [];
  let depth = 0;
  while (seeds.length < maxSlots) {
    let added = false;
    for (const queue of sectionQueues) {
      const seed = queue[depth];
      if (!seed) continue;
      seeds.push(seed);
      added = true;
      if (seeds.length >= maxSlots) break;
    }
    if (!added) break;
    depth += 1;
  }
  return seeds;
}

export function mergeV1LanguageMixRepairSlots(
  preferredSlots: V1LanguageMixRepairSlot[],
  fallbackSlots: V1LanguageMixRepairSlot[],
): V1LanguageMixRepairSlot[] {
  const merged: V1LanguageMixRepairSlot[] = [];
  const seen = new Set<string>();
  [...preferredSlots, ...fallbackSlots].forEach((raw) => {
    const slot = normalizeSlot(raw);
    if (!slot) return;
    const key = `${slot.sectionIndex}|${slot.lineIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(slot);
  });
  return merged.slice(0, 48);
}

function normalizeSlot(raw: any): V1LanguageMixRepairSlot | null {
  const sectionIndex = Math.max(1, Math.round(Number(raw?.sectionIndex || 0)));
  const lineIndex = Math.max(1, Math.round(Number(raw?.lineIndex || 0)));
  const sectionName = cleanLyricLine(raw?.sectionName);
  const baseLine = cleanLyricLine(raw?.baseLine);
  const targetVariants = Array.isArray(raw?.targetVariants)
    ? raw.targetVariants.map((variant: any) => ({
        targetLanguage: String(variant?.targetLanguage || '') as V1LanguageMixLanguageCode,
        line: cleanLyricLine(variant?.line),
      })).filter((variant: V1LanguageMixLineVariant) => variant.line && ['ko','en','ja','zh','es','fr','de','ru','th'].includes(variant.targetLanguage))
    : [];
  if (!sectionIndex || !lineIndex || !baseLine || !targetVariants.length) return null;
  return { sectionIndex, sectionName, lineIndex, baseLine, targetVariants };
}

export function normalizeV1LanguageMixBlueprint(value: unknown): V1LanguageMixBlueprint {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalizeList = (raw: unknown): V1LanguageMixRepairSlot[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw.map(normalizeSlot).filter((slot): slot is V1LanguageMixRepairSlot => {
      if (!slot) return false;
      const key = `${slot.sectionIndex}|${slot.lineIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 48);
  };
  return {
    koreanSlots: normalizeList(source.koreanSlots),
    secondarySlots: normalizeList(source.secondarySlots),
  };
}

function targetGoals(ratio: number, targets: V1LanguageMixLanguageCode[]): Partial<Record<V1LanguageMixLanguageCode, number>> {
  const unique = Array.from(new Set(targets));
  if (!unique.length || ratio <= 0) return {};
  const each = ratio / unique.length;
  return Object.fromEntries(unique.map((language) => [language, Math.round(each * 10) / 10])) as Partial<Record<V1LanguageMixLanguageCode, number>>;
}

function targetBounds(goal: number, totalRatio: number, targetCount: number): { lower: number; upper: number } {
  if (totalRatio <= 5) return { lower: 0.5, upper: Math.max(5, goal + 3) };
  const tolerance = Math.max(3, Math.round((ratioBounds(totalRatio).upper - ratioBounds(totalRatio).lower) / Math.max(1, targetCount) / 2));
  return { lower: Math.max(0, goal - tolerance), upper: Math.min(100, goal + tolerance) };
}

type V1LanguageLineRole = 'base' | 'target' | 'mixed' | 'unknown';

type V1LanguageEquivalenceGroups = Map<string, string>;

interface V1LanguagePlacementAnalysis {
  alternatingSequenceCount: number;
  mirroredTranslationPairCount: number;
  isolatedTargetLineCount: number;
  targetBlockCount: number;
  averageTargetBlockLength: number;
  targetSectionCount: number;
  maxTargetSectionShare: number;
  maxTargetSectionRatio: number;
  overloadedTargetSectionCount: number;
  duplicateTargetExpressionCount: number;
}

function classifyLanguageLineRole(
  counts: Partial<Record<V1LanguageMixLanguageCode, number>>,
  baseLanguage: V1LanguageMixLanguageCode,
  targets: V1LanguageMixLanguageCode[],
): V1LanguageLineRole {
  const baseUnits = Number(counts[baseLanguage] || 0);
  const targetUnits = targets.reduce((sum, language) => sum + Number(counts[language] || 0), 0);
  if (baseUnits <= 0 && targetUnits <= 0) return 'unknown';
  if (baseUnits > 0 && targetUnits > 0) return 'mixed';
  return targetUnits > 0 ? 'target' : 'base';
}

function analyzeLanguagePlacement(
  parsed: ReturnType<typeof parseLyricStructure>,
  input: EnforceV1LanguageMixCardInput,
  trustedLines: Map<string, V1LanguageMixLanguageCode>,
  equivalenceGroups: V1LanguageEquivalenceGroups,
): V1LanguagePlacementAnalysis {
  const targets = Array.from(new Set((input.targetLanguages || []).filter((language) => language && language !== input.baseLanguage)));
  const selectedLanguages = new Set<V1LanguageMixLanguageCode>([input.baseLanguage, ...targets]);
  const protectedKeys = new Set((input.protectedLines || []).map(normalizeComparable).filter(Boolean));
  let alternatingSequenceCount = 0;
  let mirroredTranslationPairCount = 0;
  let isolatedTargetLineCount = 0;
  let targetBlockCount = 0;
  let totalTargetBlockLength = 0;
  let totalTargetUnits = 0;
  let maxTargetSectionRatio = 0;
  let overloadedTargetSectionCount = 0;
  let duplicateTargetExpressionCount = 0;
  const sectionTargetUnits: number[] = [];
  const duplicateCandidates = new Map<string, number>();
  const requestedRatio = clampRatio(input.requestedRatio);
  const sectionRatioLimit = maxTargetRatioInsideSection(requestedRatio);

  parsed.blocks.forEach((block) => {
    let sectionTargetUnitCount = 0;
    let sectionTotalUnitCount = 0;
    const rows = block.bodyLines.map((entry) => {
      const trusted = trustedLines.get(normalizeComparable(entry.line));
      const counts = languageUnitCounts(entry.line, selectedLanguages, trusted);
      const targetUnits = targets.reduce((sum, language) => sum + Number(counts[language] || 0), 0);
      const totalUnits = Object.values(counts).reduce((sum, amount) => sum + Number(amount || 0), 0);
      sectionTargetUnitCount += targetUnits;
      sectionTotalUnitCount += totalUnits;
      if (targetUnits > 0) {
        const key = normalizeComparable(entry.line);
        if (key && !protectedKeys.has(key) && !isHookFamily(block.family)) {
          duplicateCandidates.set(key, (duplicateCandidates.get(key) || 0) + 1);
        }
      }
      return {
        entry,
        role: classifyLanguageLineRole(counts, input.baseLanguage, targets),
        targetPresent: targetUnits > 0,
      };
    });

    let alternatingLength = 1;
    let alternatingRunCounted = false;
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1].role;
      const current = rows[index].role;
      const strictPair = (previous === 'base' || previous === 'target') && (current === 'base' || current === 'target');
      if (strictPair && previous !== current) {
        alternatingLength += 1;
        if (alternatingLength >= 4 && !alternatingRunCounted) {
          alternatingSequenceCount += 1;
          alternatingRunCounted = true;
        }
      } else {
        alternatingLength = 1;
        alternatingRunCounted = false;
      }

      const previousKey = equivalenceGroups.get(normalizeComparable(rows[index - 1].entry.line));
      const currentKey = equivalenceGroups.get(normalizeComparable(rows[index].entry.line));
      if (previousKey && currentKey && previousKey === currentKey
        && normalizeComparable(rows[index - 1].entry.line) !== normalizeComparable(rows[index].entry.line)) {
        mirroredTranslationPairCount += 1;
      }
    }

    let cursor = 0;
    while (cursor < rows.length) {
      if (!rows[cursor].targetPresent) {
        cursor += 1;
        continue;
      }
      let end = cursor + 1;
      while (end < rows.length && rows[end].targetPresent) end += 1;
      const length = end - cursor;
      targetBlockCount += 1;
      totalTargetBlockLength += length;
      if (length === 1) isolatedTargetLineCount += 1;
      cursor = end;
    }

    if (sectionTargetUnitCount > 0) {
      sectionTargetUnits.push(sectionTargetUnitCount);
      totalTargetUnits += sectionTargetUnitCount;
      const sectionRatio = sectionTotalUnitCount > 0 ? (sectionTargetUnitCount / sectionTotalUnitCount) * 100 : 0;
      maxTargetSectionRatio = Math.max(maxTargetSectionRatio, sectionRatio);
      if (requestedRatio <= 30 && rows.length >= 4 && sectionRatio > sectionRatioLimit) {
        overloadedTargetSectionCount += 1;
      }
    }
  });

  duplicateCandidates.forEach((count) => {
    if (count > 1) duplicateTargetExpressionCount += count - 1;
  });
  const maxTargetSectionShare = totalTargetUnits > 0 && sectionTargetUnits.length
    ? Math.max(...sectionTargetUnits) / totalTargetUnits * 100
    : 0;

  return {
    alternatingSequenceCount,
    mirroredTranslationPairCount,
    isolatedTargetLineCount,
    targetBlockCount,
    averageTargetBlockLength: targetBlockCount > 0
      ? Math.round((totalTargetBlockLength / targetBlockCount) * 10) / 10
      : 0,
    targetSectionCount: sectionTargetUnits.length,
    maxTargetSectionShare: Math.round(maxTargetSectionShare * 10) / 10,
    maxTargetSectionRatio: Math.round(maxTargetSectionRatio * 10) / 10,
    overloadedTargetSectionCount,
    duplicateTargetExpressionCount,
  };
}

function buildAudit(
  lyrics: string,
  input: EnforceV1LanguageMixCardInput,
  trustedLines: Map<string, V1LanguageMixLanguageCode>,
  equivalenceGroups: V1LanguageEquivalenceGroups,
  repairApplied: boolean,
  replacedLineCount: number,
): V1LanguageMixAudit {
  const requestedRatio = clampRatio(input.requestedRatio);
  const targets = Array.from(new Set((input.targetLanguages || []).filter((language) => language && language !== input.baseLanguage)));
  const selectedLanguages = new Set<V1LanguageMixLanguageCode>([input.baseLanguage, ...targets]);
  const lines = String(lyrics || '').split('\n');
  const parsed = parseLyricStructure(lines);
  const placement = analyzeLanguagePlacement(parsed, input, trustedLines, equivalenceGroups);
  const totals: Partial<Record<V1LanguageMixLanguageCode, number>> = {};
  const targetFamilies = new Set<string>();
  const uniqueExpressions = new Set<string>();

  parsed.bodyLines.forEach((entry) => {
    const trusted = trustedLines.get(normalizeComparable(entry.line));
    const counts = languageUnitCounts(entry.line, selectedLanguages, trusted);
    Object.entries(counts).forEach(([language, amount]) => addUnits(totals, language as V1LanguageMixLanguageCode, Number(amount || 0)));
    const targetUnits = targets.reduce((sum, language) => sum + Number(counts[language] || 0), 0);
    if (targetUnits > 0) {
      targetFamilies.add(entry.family);
      const signature = normalizeComparable(entry.line)
        .replace(/[가-힣]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (signature) uniqueExpressions.add(signature);
    }
  });

  const totalLexicalUnits = Object.values(totals).reduce((sum, amount) => sum + Number(amount || 0), 0);
  const languageRatios: Partial<Record<V1LanguageMixLanguageCode, number>> = {};
  Object.entries(totals).forEach(([language, amount]) => {
    languageRatios[language as V1LanguageMixLanguageCode] = totalLexicalUnits ? Math.round((Number(amount || 0) / totalLexicalUnits) * 1000) / 10 : 0;
  });
  const targetUnitTotal = targets.reduce((sum, language) => sum + Number(totals[language] || 0), 0);
  const actualMixRatio = totalLexicalUnits ? Math.round((targetUnitTotal / totalLexicalUnits) * 1000) / 10 : 0;
  const actualBaseRatio = totalLexicalUnits ? Math.round((Number(totals[input.baseLanguage] || 0) / totalLexicalUnits) * 1000) / 10 : 0;
  const bounds = ratioBounds(requestedRatio);
  const goals = targetGoals(requestedRatio, targets);
  const targetLowerBounds: Partial<Record<V1LanguageMixLanguageCode, number>> = {};
  const targetUpperBounds: Partial<Record<V1LanguageMixLanguageCode, number>> = {};
  targets.forEach((language) => {
    const targetBound = targetBounds(Number(goals[language] || 0), requestedRatio, targets.length);
    targetLowerBounds[language] = targetBound.lower;
    targetUpperBounds[language] = targetBound.upper;
  });
  const availableFamilies = new Set(parsed.bodyLines.map((entry) => entry.family));
  const availableSections = parsed.blocks.filter((block) => block.bodyLines.length > 0).length;
  const requiredSections = requiredSectionCount(requestedRatio, availableFamilies.size);
  const requiredTargetSections = requiredTargetSectionCount(requestedRatio, availableSections);
  const maxAllowedTargetSectionShare = maxTargetSectionShareForRatio(requestedRatio, availableSections);
  const requiredUnique = requiredUniqueExpressionCount(requestedRatio, parsed.bodyLines.length);
  const reasons: string[] = [];
  if (requestedRatio > 0 && actualMixRatio < bounds.lower) reasons.push(`실제 혼합 언어 분량이 ${bounds.lower}%보다 낮습니다.`);
  if (requestedRatio > 0 && actualMixRatio > bounds.upper) reasons.push(`실제 혼합 언어 분량이 ${bounds.upper}%보다 높습니다.`);
  targets.forEach((language) => {
    const actual = Number(languageRatios[language] || 0);
    const lower = Number(targetLowerBounds[language] || 0);
    const upper = Number(targetUpperBounds[language] || 100);
    if (actual < lower) reasons.push(`${language} 분량이 목표 배분보다 부족합니다.`);
    if (actual > upper) reasons.push(`${language} 분량이 목표 배분보다 많습니다.`);
  });
  if (requestedRatio >= 10 && targetFamilies.size < requiredSections) reasons.push(`혼합 언어가 ${requiredSections}개 이상의 섹션군에 분산되지 않았습니다.`);
  if (requestedRatio >= 10 && uniqueExpressions.size < requiredUnique) reasons.push(`반복 훅을 제외한 고유 혼합 표현이 ${requiredUnique}개보다 적습니다.`);
  if (requestedRatio >= 10 && placement.targetSectionCount < requiredTargetSections) {
    reasons.push(`혼합 언어가 ${requiredTargetSections}개 이상의 실제 섹션에 분산되지 않았습니다.`);
  }
  if (requestedRatio >= 10 && placement.maxTargetSectionShare > maxAllowedTargetSectionShare) {
    reasons.push(`혼합 언어 전체 분량의 ${placement.maxTargetSectionShare}%가 한 섹션에 몰려 있습니다. 한 섹션 최대 ${maxAllowedTargetSectionShare}% 이하여야 합니다.`);
  }
  if (placement.overloadedTargetSectionCount > 0) {
    reasons.push(`낮은 혼합 비율인데 ${placement.overloadedTargetSectionCount}개 섹션이 외국어 중심으로 과도하게 바뀌었습니다.`);
  }
  if (placement.duplicateTargetExpressionCount > 0) {
    reasons.push(`훅이 아닌 구간에서 동일한 외국어 문장이 ${placement.duplicateTargetExpressionCount}회 반복 복사되었습니다.`);
  }

  const maxAlternating = maxAllowedAlternatingSequences(requestedRatio, Boolean(input.allowLineAlternation));
  const maxMirroredPairs = input.allowLineAlternation ? 1 : 0;
  const preferredBlock = preferredTargetBlockLength(requestedRatio);
  if (placement.alternatingSequenceCount > maxAlternating) {
    reasons.push('기준 언어와 혼합 언어가 한 줄씩 번갈아 이어지는 교대 패턴이 과도합니다.');
  }
  if (placement.mirroredTranslationPairCount > maxMirroredPairs) {
    reasons.push('같은 의미를 두 언어로 바로 이어 쓰는 번역 대조형 줄이 감지되었습니다.');
  }
  const scatteredTargetBlocks = !input.allowLineAlternation && requestedRatio >= 50
    ? placement.targetBlockCount >= 8
      && placement.averageTargetBlockLength < 1.5
      && placement.isolatedTargetLineCount >= 6
    : requestedRatio >= 30
      ? placement.targetBlockCount >= 6
        && placement.averageTargetBlockLength < 1.5
        && placement.isolatedTargetLineCount >= 5
      : false;
  if (scatteredTargetBlocks) {
    reasons.push(`혼합 언어가 한 줄씩 흩어져 있습니다. ${preferredBlock.min}줄 이상의 자연스러운 언어 블록이 필요합니다.`);
  }
  const placementPassed = placement.alternatingSequenceCount <= maxAlternating
    && placement.mirroredTranslationPairCount <= maxMirroredPairs
    && !scatteredTargetBlocks
    && placement.targetSectionCount >= requiredTargetSections
    && placement.maxTargetSectionShare <= maxAllowedTargetSectionShare
    && placement.overloadedTargetSectionCount === 0
    && placement.duplicateTargetExpressionCount === 0;

  const active = requestedRatio > 0 && targets.length > 0;
  const status: V1LanguageMixAudit['status'] = !active
    ? 'inactive'
    : input.preserveMode
      ? 'preserved'
      : reasons.length === 0
        ? 'passed'
        : 'needs-review';

  return {
    active,
    card: input.card,
    baseLanguage: input.baseLanguage,
    targetLanguages: targets,
    requestedRatio,
    lowerBound: bounds.lower,
    upperBound: bounds.upper,
    actualMixRatio,
    actualBaseRatio,
    totalLexicalUnits,
    languageUnits: totals,
    languageRatios,
    targetGoals: goals,
    targetLowerBounds,
    targetUpperBounds,
    targetSectionFamilyCount: targetFamilies.size,
    requiredSectionFamilyCount: requiredSections,
    uniqueTargetExpressionCount: uniqueExpressions.size,
    requiredUniqueTargetExpressionCount: requiredUnique,
    placementMode: placementModeForRatio(requestedRatio),
    alternatingSequenceCount: placement.alternatingSequenceCount,
    maxAllowedAlternatingSequences: maxAlternating,
    mirroredTranslationPairCount: placement.mirroredTranslationPairCount,
    maxAllowedMirroredPairs: maxMirroredPairs,
    isolatedTargetLineCount: placement.isolatedTargetLineCount,
    targetBlockCount: placement.targetBlockCount,
    averageTargetBlockLength: placement.averageTargetBlockLength,
    targetSectionCount: placement.targetSectionCount,
    requiredTargetSectionCount: requiredTargetSections,
    maxTargetSectionShare: placement.maxTargetSectionShare,
    maxAllowedTargetSectionShare,
    maxTargetSectionRatio: placement.maxTargetSectionRatio,
    overloadedTargetSectionCount: placement.overloadedTargetSectionCount,
    duplicateTargetExpressionCount: placement.duplicateTargetExpressionCount,
    placementPassed,
    repairApplied,
    replacedLineCount,
    status,
    reasons,
  };
}

function findSlotEntry(
  parsed: ReturnType<typeof parseLyricStructure>,
  slot: V1LanguageMixRepairSlot,
  usedAbsoluteIndexes: Set<number>,
): ParsedLyricLine | null {
  const exactSection = parsed.blocks.find((block) => block.sectionIndex === slot.sectionIndex);
  if (exactSection) {
    const exactLine = exactSection.bodyLines.find((line) => line.bodyLineIndex === slot.lineIndex && !usedAbsoluteIndexes.has(line.absoluteIndex));
    if (exactLine) return exactLine;
  }
  const wantedFamily = sectionFamily(slot.sectionName);
  const familyBlocks = parsed.blocks.filter((block) => block.family === wantedFamily);
  const nearest = familyBlocks
    .flatMap((block) => block.bodyLines)
    .filter((line) => !usedAbsoluteIndexes.has(line.absoluteIndex))
    .sort((a, b) => Math.abs(a.bodyLineIndex - slot.lineIndex) - Math.abs(b.bodyLineIndex - slot.lineIndex));
  return nearest[0] || null;
}

function auditPenalty(audit: V1LanguageMixAudit): number {
  const ratioPenalty = audit.actualMixRatio < audit.lowerBound
    ? audit.lowerBound - audit.actualMixRatio
    : audit.actualMixRatio > audit.upperBound
      ? audit.actualMixRatio - audit.upperBound
      : 0;
  const targetPenalty = audit.targetLanguages.reduce((sum, language) => {
    const actual = Number(audit.languageRatios[language] || 0);
    const lower = Number(audit.targetLowerBounds[language] || 0);
    const upper = Number(audit.targetUpperBounds[language] || 100);
    if (actual < lower) return sum + (lower - actual);
    if (actual > upper) return sum + (actual - upper);
    return sum;
  }, 0);
  const sectionPenalty = Math.max(0, audit.requiredSectionFamilyCount - audit.targetSectionFamilyCount) * 8;
  const uniquePenalty = Math.max(0, audit.requiredUniqueTargetExpressionCount - audit.uniqueTargetExpressionCount) * 3;
  const alternatingPenalty = Math.max(0, audit.alternatingSequenceCount - audit.maxAllowedAlternatingSequences) * 14;
  const mirroredPenalty = Math.max(0, audit.mirroredTranslationPairCount - audit.maxAllowedMirroredPairs) * 16;
  const blockPenalty = audit.placementPassed ? 0 : Math.max(2, audit.isolatedTargetLineCount * 1.5);
  const exactSectionPenalty = Math.max(0, audit.requiredTargetSectionCount - audit.targetSectionCount) * 18;
  const distributionReady = audit.targetSectionCount >= audit.requiredTargetSectionCount || audit.actualMixRatio >= audit.lowerBound;
  const concentrationPenalty = distributionReady
    ? Math.max(0, audit.maxTargetSectionShare - audit.maxAllowedTargetSectionShare) * 4
    : 0;
  const overloadPenalty = distributionReady ? audit.overloadedTargetSectionCount * 24 : 0;
  const duplicatePenalty = audit.duplicateTargetExpressionCount * 28;
  return ratioPenalty * 5
    + targetPenalty * 7
    + sectionPenalty
    + uniquePenalty
    + alternatingPenalty
    + mirroredPenalty
    + blockPenalty
    + exactSectionPenalty
    + concentrationPenalty
    + overloadPenalty
    + duplicatePenalty;
}

function buildSlotLanguageMaps(
  slots: V1LanguageMixRepairSlot[],
  baseLanguage: V1LanguageMixLanguageCode,
): {
  trustedLines: Map<string, V1LanguageMixLanguageCode>;
  equivalenceGroups: V1LanguageEquivalenceGroups;
} {
  const trustedLines = new Map<string, V1LanguageMixLanguageCode>();
  const equivalenceGroups: V1LanguageEquivalenceGroups = new Map();
  slots.forEach((slot, slotIndex) => {
    const groupKey = `${slot.sectionIndex}|${slot.lineIndex}|${slotIndex}`;
    const baseKey = normalizeComparable(slot.baseLine);
    if (baseKey) {
      trustedLines.set(baseKey, baseLanguage);
      equivalenceGroups.set(baseKey, groupKey);
    }
    slot.targetVariants.forEach((variant) => {
      const variantKey = normalizeComparable(variant.line);
      if (!variantKey) return;
      trustedLines.set(variantKey, variant.targetLanguage);
      equivalenceGroups.set(variantKey, groupKey);
    });
  });
  return { trustedLines, equivalenceGroups };
}

interface V1TranslationMirrorPair {
  family: string;
  sectionIndex: number;
  pairOrder: number;
  baseAbsoluteIndex: number;
  targetAbsoluteIndex: number;
}

function resolveAdjacentTranslationMirrors(
  sourceLines: string[],
  input: EnforceV1LanguageMixCardInput,
  trustedLines: Map<string, V1LanguageMixLanguageCode>,
  equivalenceGroups: V1LanguageEquivalenceGroups,
  protectedKeys: Set<string>,
): { lines: string[]; removedLineCount: number; mirrorKeys: Set<string> } {
  const targets = Array.from(new Set((input.targetLanguages || []).filter((language) => language && language !== input.baseLanguage)));
  if (!targets.length) return { lines: sourceLines, removedLineCount: 0, mirrorKeys: new Set<string>() };
  const selectedLanguages = new Set<V1LanguageMixLanguageCode>([input.baseLanguage, ...targets]);
  const parsed = parseLyricStructure(sourceLines);
  const pairs: V1TranslationMirrorPair[] = [];

  parsed.blocks.forEach((block) => {
    let pairOrder = 0;
    for (let index = 1; index < block.bodyLines.length; index += 1) {
      const previous = block.bodyLines[index - 1];
      const current = block.bodyLines[index];
      const previousGroup = equivalenceGroups.get(normalizeComparable(previous.line));
      const currentGroup = equivalenceGroups.get(normalizeComparable(current.line));
      if (!previousGroup || previousGroup !== currentGroup) continue;
      const previousCounts = languageUnitCounts(previous.line, selectedLanguages, trustedLines.get(normalizeComparable(previous.line)));
      const currentCounts = languageUnitCounts(current.line, selectedLanguages, trustedLines.get(normalizeComparable(current.line)));
      const previousRole = classifyLanguageLineRole(previousCounts, input.baseLanguage, targets);
      const currentRole = classifyLanguageLineRole(currentCounts, input.baseLanguage, targets);
      if (!((previousRole === 'base' && currentRole === 'target') || (previousRole === 'target' && currentRole === 'base'))) continue;
      pairOrder += 1;
      pairs.push({
        family: block.family,
        sectionIndex: block.sectionIndex,
        pairOrder,
        baseAbsoluteIndex: previousRole === 'base' ? previous.absoluteIndex : current.absoluteIndex,
        targetAbsoluteIndex: previousRole === 'target' ? previous.absoluteIndex : current.absoluteIndex,
      });
      index += 1;
    }
  });

  if (!pairs.length) return { lines: sourceLines, removedLineCount: 0, mirrorKeys: new Set<string>() };

  const requestedRatio = clampRatio(input.requestedRatio);
  const targetKeepCount = Math.max(0, Math.min(pairs.length, Math.round((pairs.length * requestedRatio) / 100)));
  const selectedTargetPairKeys = new Set<string>();
  const grouped = new Map<string, V1TranslationMirrorPair[]>();
  pairs.forEach((pair) => {
    const key = `${pair.sectionIndex}|${pair.family}`;
    const list = grouped.get(key) || [];
    list.push(pair);
    grouped.set(key, list);
  });
  const groups = Array.from(grouped.values()).sort((a, b) => {
    const aFamily = a[0]?.family || 'unknown';
    const bFamily = b[0]?.family || 'unknown';
    return sectionPlacementPriority(bFamily, requestedRatio) - sectionPlacementPriority(aFamily, requestedRatio)
      || (a[0]?.sectionIndex || 0) - (b[0]?.sectionIndex || 0);
  });

  // Allocate the requested target-language share across section families first, then grow
  // contiguous blocks inside those sections. This prevents a 50% mix from consuming one
  // entire Chorus while leaving every other section in the matrix language.
  const desiredFamilyCount = Math.min(
    groups.length,
    targetKeepCount,
    requiredSectionCount(requestedRatio, groups.length),
  );
  const allocations = groups.map((_, index) => index < desiredFamilyCount ? 1 : 0);
  let remaining = Math.max(0, targetKeepCount - desiredFamilyCount);
  const preferred = preferredTargetBlockLength(requestedRatio);
  while (remaining > 0) {
    let advanced = false;
    for (let index = 0; index < groups.length && remaining > 0; index += 1) {
      if (allocations[index] <= 0) continue;
      const cap = Math.min(groups[index].length, preferred.max);
      if (allocations[index] >= cap) continue;
      allocations[index] += 1;
      remaining -= 1;
      advanced = true;
    }
    if (advanced) continue;
    for (let index = 0; index < groups.length && remaining > 0; index += 1) {
      if (allocations[index] >= groups[index].length) continue;
      allocations[index] += 1;
      remaining -= 1;
      advanced = true;
    }
    if (!advanced) break;
  }

  groups.forEach((group, index) => {
    const take = allocations[index] || 0;
    if (take <= 0) return;
    const family = group[0]?.family || 'unknown';
    const useFront = ['chorus', 'hook', 'refrain', 'drop', 'theme'].includes(family);
    const selected = useFront ? group.slice(0, take) : group.slice(Math.max(0, group.length - take));
    selected.forEach((pair) => selectedTargetPairKeys.add(`${pair.sectionIndex}|${pair.pairOrder}`));
  });

  const removeIndexes = new Set<number>();
  const mirrorKeys = new Set<string>();
  pairs.forEach((pair) => {
    const baseKey = normalizeComparable(sourceLines[pair.baseAbsoluteIndex]);
    const targetKey = normalizeComparable(sourceLines[pair.targetAbsoluteIndex]);
    if (baseKey) mirrorKeys.add(baseKey);
    if (targetKey) mirrorKeys.add(targetKey);
    const keepTarget = selectedTargetPairKeys.has(`${pair.sectionIndex}|${pair.pairOrder}`);
    const preferredRemoval = keepTarget ? pair.baseAbsoluteIndex : pair.targetAbsoluteIndex;
    const alternateRemoval = keepTarget ? pair.targetAbsoluteIndex : pair.baseAbsoluteIndex;
    if (!protectedKeys.has(normalizeComparable(sourceLines[preferredRemoval]))) {
      removeIndexes.add(preferredRemoval);
    } else if (!protectedKeys.has(normalizeComparable(sourceLines[alternateRemoval]))) {
      removeIndexes.add(alternateRemoval);
    }
  });

  if (!removeIndexes.size) return { lines: sourceLines, removedLineCount: 0, mirrorKeys };
  return {
    lines: sourceLines.filter((_, index) => !removeIndexes.has(index)),
    removedLineCount: removeIndexes.size,
    mirrorKeys,
  };
}

function collapseAdjacentUnprotectedRepairDuplicates(
  sourceLines: string[],
  protectedKeys: Set<string>,
  mirrorKeys: Set<string>,
): { lines: string[]; removedLineCount: number } {
  const output: string[] = [];
  let previousLyricKey = '';
  let removedLineCount = 0;
  sourceLines.forEach((line) => {
    if (parseSectionName(line)) {
      previousLyricKey = '';
      output.push(line);
      return;
    }
    if (!isLyricBodyLine(line)) {
      output.push(line);
      return;
    }
    const key = normalizeComparable(line);
    const mirrorRepairLine = mirrorKeys.has(key);
    if (key && key === previousLyricKey && mirrorRepairLine && !protectedKeys.has(key)) {
      removedLineCount += 1;
      return;
    }
    previousLyricKey = key;
    output.push(line);
  });
  return { lines: output, removedLineCount };
}

interface V1BoundRepairSlot {
  slot: V1LanguageMixRepairSlot;
  entry: ParsedLyricLine;
  exact: boolean;
}

function bindRepairSlots(
  parsed: ReturnType<typeof parseLyricStructure>,
  slots: V1LanguageMixRepairSlot[],
  usedAbsoluteIndexes: Set<number>,
): V1BoundRepairSlot[] {
  const boundIndexes = new Set<number>();
  const bindings: V1BoundRepairSlot[] = [];
  slots.forEach((slot) => {
    const exactSection = parsed.blocks.find((block) => block.sectionIndex === slot.sectionIndex);
    const alternativeKeys = new Set([
      normalizeComparable(slot.baseLine),
      ...slot.targetVariants.map((variant) => normalizeComparable(variant.line)),
    ].filter(Boolean));
    let entry = exactSection?.bodyLines.find((line) => alternativeKeys.has(normalizeComparable(line.line))
      && !usedAbsoluteIndexes.has(line.absoluteIndex)
      && !boundIndexes.has(line.absoluteIndex));
    let exact = Boolean(entry);
    if (!entry) {
      entry = exactSection?.bodyLines.find((line) => line.bodyLineIndex === slot.lineIndex
        && !usedAbsoluteIndexes.has(line.absoluteIndex)
        && !boundIndexes.has(line.absoluteIndex));
      exact = Boolean(entry);
    }
    if (!entry) {
      const wantedFamily = sectionFamily(slot.sectionName);
      const familyLines = parsed.blocks
        .filter((block) => block.family === wantedFamily)
        .flatMap((block) => block.bodyLines)
        .filter((line) => !usedAbsoluteIndexes.has(line.absoluteIndex) && !boundIndexes.has(line.absoluteIndex));
      entry = familyLines.find((line) => alternativeKeys.has(normalizeComparable(line.line)));
      if (!entry) {
        entry = familyLines.sort((a, b) => {
          const sectionDistance = Math.abs(a.sectionIndex - slot.sectionIndex);
          const otherSectionDistance = Math.abs(b.sectionIndex - slot.sectionIndex);
          return sectionDistance - otherSectionDistance
            || Math.abs(a.bodyLineIndex - slot.lineIndex) - Math.abs(b.bodyLineIndex - slot.lineIndex);
        })[0];
      }
      exact = false;
    }
    if (!entry) return;
    boundIndexes.add(entry.absoluteIndex);
    bindings.push({ slot, entry, exact });
  });
  return bindings;
}

function buildRepairWindows(
  bindings: V1BoundRepairSlot[],
  requestedRatio: number,
  protectedKeys: Set<string>,
): V1BoundRepairSlot[][] {
  const bySection = new Map<number, V1BoundRepairSlot[]>();
  bindings.forEach((binding) => {
    if (protectedKeys.has(normalizeComparable(binding.entry.line))) return;
    const list = bySection.get(binding.entry.sectionIndex) || [];
    list.push(binding);
    bySection.set(binding.entry.sectionIndex, list);
  });
  const preferred = preferredTargetBlockLength(requestedRatio);
  const maxLength = Math.max(1, preferred.max);
  const windows: V1BoundRepairSlot[][] = [];
  bySection.forEach((sectionBindings) => {
    const sorted = [...sectionBindings].sort((a, b) => a.entry.bodyLineIndex - b.entry.bodyLineIndex);
    for (let start = 0; start < sorted.length; start += 1) {
      for (let length = 1; length <= maxLength && start + length <= sorted.length; length += 1) {
        const window = sorted.slice(start, start + length);
        const consecutive = window.every((binding, index) => index === 0
          || binding.entry.bodyLineIndex === window[index - 1].entry.bodyLineIndex + 1);
        if (!consecutive) break;
        windows.push(window);
      }
    }
  });
  return windows;
}

function replacementForWindow(
  window: V1BoundRepairSlot[],
  language: V1LanguageMixLanguageCode,
  baseLanguage: V1LanguageMixLanguageCode,
): string[] | null {
  const replacements: string[] = [];
  for (const binding of window) {
    const raw = language === baseLanguage
      ? binding.slot.baseLine
      : binding.slot.targetVariants.find((variant) => variant.targetLanguage === language)?.line;
    const line = cleanLyricLine(raw);
    if (!line) return null;
    replacements.push(line);
  }
  return replacements;
}

function blockTieBreak(
  window: V1BoundRepairSlot[],
  language: V1LanguageMixLanguageCode,
  input: EnforceV1LanguageMixCardInput,
  audit: V1LanguageMixAudit,
  representedFamilies: Set<string>,
): number {
  const family = window[0]?.entry.family || 'unknown';
  const preferred = preferredTargetBlockLength(audit.requestedRatio);
  const targetLanguage = language !== input.baseLanguage;
  const desiredLength = audit.requestedRatio <= 10 ? 1 : Math.round((preferred.min + preferred.max) / 2);
  const blockLengthScore = Math.max(0, 24 - Math.abs(window.length - desiredLength) * 6);
  const exactScore = window.filter((binding) => binding.exact).length * 5;
  const spreadScore = targetLanguage && !representedFamilies.has(family) ? 180 : 0;
  const sectionScore = sectionPlacementPriority(family, audit.requestedRatio) * 2;
  const alternationRepairScore = !audit.placementPassed && window.length >= 2 ? 45 : 0;
  const languageActual = Number(audit.languageRatios[language] || 0);
  const languageGoal = language === input.baseLanguage
    ? 100 - audit.requestedRatio
    : Number(audit.targetGoals[language] || 0);
  const deficitScore = targetLanguage && languageActual < languageGoal ? Math.min(40, languageGoal - languageActual) : 0;
  return blockLengthScore + exactScore + spreadScore + sectionScore + alternationRepairScore + deficitScore;
}


function replacementWouldCreateUnprotectedDuplicate(
  lines: string[],
  window: V1BoundRepairSlot[],
  replacements: string[],
  language: V1LanguageMixLanguageCode,
  input: EnforceV1LanguageMixCardInput,
  protectedKeys: Set<string>,
): boolean {
  if (language === input.baseLanguage) return false;
  const family = window[0]?.entry.family || 'unknown';
  if (isHookFamily(family)) return false;
  const replacedIndexes = new Set(window.map((binding) => binding.entry.absoluteIndex));
  const existing = new Set(lines
    .map((line, index) => replacedIndexes.has(index) ? '' : normalizeComparable(line))
    .filter(Boolean));
  const local = new Set<string>();
  for (const replacement of replacements) {
    const key = normalizeComparable(replacement);
    if (!key || protectedKeys.has(key)) continue;
    if (existing.has(key) || local.has(key)) return true;
    local.add(key);
  }
  return false;
}

export function enforceV1LanguageMixCard(input: EnforceV1LanguageMixCardInput): EnforceV1LanguageMixCardResult {
  const source = String(input.lyrics || '').trim();
  const requestedRatio = clampRatio(input.requestedRatio);
  const targets = Array.from(new Set((input.targetLanguages || []).filter((language) => language && language !== input.baseLanguage)));
  const slots = (input.slots || []).map(normalizeSlot).filter((slot): slot is V1LanguageMixRepairSlot => Boolean(slot));
  const { trustedLines, equivalenceGroups } = buildSlotLanguageMaps(slots, input.baseLanguage);
  const normalizedInput = { ...input, requestedRatio, targetLanguages: targets };
  if (!source || requestedRatio <= 0 || !targets.length || input.preserveMode) {
    return { lyrics: source, audit: buildAudit(source, normalizedInput, trustedLines, equivalenceGroups, false, 0) };
  }

  let lines = source.split('\n');
  const protectedKeys = new Set((input.protectedLines || []).map(normalizeComparable).filter(Boolean));
  const mirrorResolution = resolveAdjacentTranslationMirrors(
    lines,
    normalizedInput,
    trustedLines,
    equivalenceGroups,
    protectedKeys,
  );
  lines = mirrorResolution.lines;
  const usedAbsoluteIndexes = new Set<number>();
  let replacedLineCount = mirrorResolution.removedLineCount;
  let audit = buildAudit(
    lines.join('\n'),
    normalizedInput,
    trustedLines,
    equivalenceGroups,
    mirrorResolution.removedLineCount > 0,
    mirrorResolution.removedLineCount,
  );

  const representedFamilies = (): Set<string> => {
    const selected = new Set<V1LanguageMixLanguageCode>([input.baseLanguage, ...targets]);
    const parsed = parseLyricStructure(lines);
    return new Set(parsed.bodyLines.filter((entry) => {
      const trusted = trustedLines.get(normalizeComparable(entry.line));
      const counts = languageUnitCounts(entry.line, selected, trusted);
      return targets.some((language) => Number(counts[language] || 0) > 0);
    }).map((entry) => entry.family));
  };

  // Seed one compact target-language block in distinct real sections/families before the greedy
  // fine-tuning pass. Without this stage, a local penalty minimum could satisfy the numeric ratio
  // by filling one Verse or one Chorus and then refuse to move content into a third section.
  if (requestedRatio >= 10 && slots.length) {
    const parsed = parseLyricStructure(lines);
    const bindings = bindRepairSlots(parsed, slots, new Set<number>());
    const preferred = preferredTargetBlockLength(requestedRatio);
    const bindingCountBySection = new Map<number, number>();
    bindings.forEach((binding) => bindingCountBySection.set(
      binding.entry.sectionIndex,
      (bindingCountBySection.get(binding.entry.sectionIndex) || 0) + 1,
    ));
    const windows = buildRepairWindows(bindings, requestedRatio, protectedKeys)
      .filter((window) => {
        const sectionIndex = window[0]?.entry.sectionIndex || 0;
        const coversWholeShortSection = window.length === Number(bindingCountBySection.get(sectionIndex) || 0);
        return window.length <= preferred.max && (window.length >= preferred.min || coversWholeShortSection);
      });
    const selectedLanguages = new Set<V1LanguageMixLanguageCode>([input.baseLanguage, ...targets]);
    const targetSectionIndexes = new Set<number>();
    const targetFamilies = new Set<string>();
    parsed.blocks.forEach((block) => {
      const ownsTarget = block.bodyLines.some((entry) => {
        const counts = languageUnitCounts(entry.line, selectedLanguages, trustedLines.get(normalizeComparable(entry.line)));
        return targets.some((language) => Number(counts[language] || 0) > 0);
      });
      if (ownsTarget) {
        targetSectionIndexes.add(block.sectionIndex);
        targetFamilies.add(block.family);
      }
    });
    const requiredSections = requiredTargetSectionCount(requestedRatio, parsed.blocks.filter((block) => block.bodyLines.length).length);
    const requiredFamilies = requiredSectionCount(requestedRatio, new Set(parsed.bodyLines.map((entry) => entry.family)).size);
    const bySection = new Map<number, V1BoundRepairSlot[][]>();
    windows.forEach((window) => {
      const sectionIndex = window[0]?.entry.sectionIndex || 0;
      if (!sectionIndex) return;
      const list = bySection.get(sectionIndex) || [];
      list.push(window);
      bySection.set(sectionIndex, list);
    });
    const sectionCandidates = Array.from(bySection.entries()).map(([sectionIndex, sectionWindows]) => {
      const bestWindow = [...sectionWindows].sort((a, b) => {
        const family = a[0]?.entry.family || 'unknown';
        const otherFamily = b[0]?.entry.family || 'unknown';
        return sectionPlacementPriority(otherFamily, requestedRatio) - sectionPlacementPriority(family, requestedRatio)
          || a.length - b.length
          || (a[0]?.entry.bodyLineIndex || 0) - (b[0]?.entry.bodyLineIndex || 0);
      })[0];
      return { sectionIndex, family: bestWindow?.[0]?.entry.family || 'unknown', window: bestWindow };
    }).filter((candidate) => Boolean(candidate.window));

    while ((targetSectionIndexes.size < requiredSections || targetFamilies.size < requiredFamilies) && sectionCandidates.length) {
      sectionCandidates.sort((a, b) => {
        const aNewFamily = targetFamilies.has(a.family) ? 0 : 1;
        const bNewFamily = targetFamilies.has(b.family) ? 0 : 1;
        const aNewSection = targetSectionIndexes.has(a.sectionIndex) ? 0 : 1;
        const bNewSection = targetSectionIndexes.has(b.sectionIndex) ? 0 : 1;
        return bNewFamily - aNewFamily
          || bNewSection - aNewSection
          || sectionPlacementPriority(b.family, requestedRatio) - sectionPlacementPriority(a.family, requestedRatio);
      });
      const candidate = sectionCandidates.shift()!;
      if (targetSectionIndexes.has(candidate.sectionIndex)) continue;
      const language = targets
        .slice()
        .sort((a, b) => Number(audit.languageRatios[a] || 0) - Number(audit.languageRatios[b] || 0))[0];
      const replacements = replacementForWindow(candidate.window, language, input.baseLanguage);
      if (!replacements || replacementWouldCreateUnprotectedDuplicate(lines, candidate.window, replacements, language, input, protectedKeys)) continue;
      let changed = 0;
      candidate.window.forEach((binding, index) => {
        if (normalizeComparable(lines[binding.entry.absoluteIndex]) === normalizeComparable(replacements[index])) return;
        lines[binding.entry.absoluteIndex] = replacements[index];
        trustedLines.set(normalizeComparable(replacements[index]), language);
        changed += 1;
      });
      if (!changed) continue;
      replacedLineCount += changed;
      targetSectionIndexes.add(candidate.sectionIndex);
      targetFamilies.add(candidate.family);
      audit = buildAudit(lines.join('\n'), normalizedInput, trustedLines, equivalenceGroups, true, replacedLineCount);
    }
  }

  const maxPasses = Math.min(64, Math.max(16, slots.length * 2));
  for (let pass = 0; pass < maxPasses; pass += 1) {
    if (audit.status === 'passed') break;
    const parsed = parseLyricStructure(lines);
    const bindings = bindRepairSlots(parsed, slots, usedAbsoluteIndexes);
    const windows = buildRepairWindows(bindings, requestedRatio, protectedKeys);
    if (!windows.length) break;
    const currentFamilies = representedFamilies();
    const currentPenalty = auditPenalty(audit);
    const candidateLanguages: V1LanguageMixLanguageCode[] = [input.baseLanguage, ...targets];

    let best: {
      window: V1BoundRepairSlot[];
      replacements: string[];
      language: V1LanguageMixLanguageCode;
      trialAudit: V1LanguageMixAudit;
      trialTrustedLines: Map<string, V1LanguageMixLanguageCode>;
      penalty: number;
      tieBreak: number;
      changedCount: number;
    } | null = null;

    windows.forEach((window) => {
      candidateLanguages.forEach((language) => {
        const replacements = replacementForWindow(window, language, input.baseLanguage);
        if (!replacements) return;
        const targetLanguage = language !== input.baseLanguage;
        const preferredBlock = preferredTargetBlockLength(requestedRatio);
        const sectionBindingCount = bindings.filter((binding) => binding.entry.sectionIndex === window[0]?.entry.sectionIndex).length;
        const coversWholeShortSection = window.length === sectionBindingCount;
        const targetBalanceNeedsFineAdjustment = targets.length > 1 && targets.some((target) => {
          const actual = Number(audit.languageRatios[target] || 0);
          return actual < Number(audit.targetLowerBounds[target] || 0) || actual > Number(audit.targetUpperBounds[target] || 100);
        });
        if (targetLanguage
          && requestedRatio >= 20
          && window.length < preferredBlock.min
          && !coversWholeShortSection
          && !targetBalanceNeedsFineAdjustment) return;
        if (replacementWouldCreateUnprotectedDuplicate(lines, window, replacements, language, input, protectedKeys)) return;
        const changedCount = window.reduce((sum, binding, index) => (
          normalizeComparable(binding.entry.line) === normalizeComparable(replacements[index]) ? sum : sum + 1
        ), 0);
        if (!changedCount) return;

        const trialLines = [...lines];
        const trialTrustedLines = new Map(trustedLines);
        window.forEach((binding, index) => {
          trialLines[binding.entry.absoluteIndex] = replacements[index];
          trialTrustedLines.set(normalizeComparable(replacements[index]), language);
        });
        const trialAudit = buildAudit(
          trialLines.join('\n'),
          normalizedInput,
          trialTrustedLines,
          equivalenceGroups,
          true,
          replacedLineCount + changedCount,
        );
        const penalty = auditPenalty(trialAudit);
        const tieBreak = blockTieBreak(window, language, input, audit, currentFamilies);
        if (!best || penalty < best.penalty - 0.001 || (Math.abs(penalty - best.penalty) < 0.001 && tieBreak > best.tieBreak)) {
          best = { window, replacements, language, trialAudit, trialTrustedLines, penalty, tieBreak, changedCount };
        }
      });
    });

    if (!best || best.penalty >= currentPenalty - 0.001) break;
    best.window.forEach((binding, index) => {
      lines[binding.entry.absoluteIndex] = best!.replacements[index];
      usedAbsoluteIndexes.add(binding.entry.absoluteIndex);
    });
    trustedLines.clear();
    best.trialTrustedLines.forEach((language, line) => trustedLines.set(line, language));
    replacedLineCount += best.changedCount;
    audit = best.trialAudit;
  }


  // Hard ratio convergence pass. The quality penalty solver above is intentionally conservative,
  // but a valid final repair pool must not leave 20% at 42% or 90% at 79% merely because a local
  // placement score is flat. Use the same exact-position alternatives to move monotonically toward
  // the requested range, while still rejecting copied non-hook text and protecting hook identities.
  const ratioDistance = (candidate: V1LanguageMixAudit): number => {
    const mixDistance = candidate.actualMixRatio < candidate.lowerBound
      ? candidate.lowerBound - candidate.actualMixRatio
      : candidate.actualMixRatio > candidate.upperBound
        ? candidate.actualMixRatio - candidate.upperBound
        : 0;
    const languageDistance = candidate.targetLanguages.reduce((sum, language) => {
      const actual = Number(candidate.languageRatios[language] || 0);
      const lower = Number(candidate.targetLowerBounds[language] || 0);
      const upper = Number(candidate.targetUpperBounds[language] || 100);
      return sum + (actual < lower ? lower - actual : actual > upper ? actual - upper : 0);
    }, 0);
    return mixDistance + languageDistance;
  };

  for (let hardPass = 0; hardPass < Math.min(64, Math.max(12, slots.length * 2)); hardPass += 1) {
    if (audit.status === 'passed') break;
    const currentDistance = ratioDistance(audit);
    if (currentDistance <= 0 && audit.placementPassed) break;

    let desiredLanguage: V1LanguageMixLanguageCode = input.baseLanguage;
    if (audit.actualMixRatio < audit.lowerBound) {
      desiredLanguage = targets.slice().sort((a, b) => {
        const aDeficit = Number(audit.targetLowerBounds[a] || 0) - Number(audit.languageRatios[a] || 0);
        const bDeficit = Number(audit.targetLowerBounds[b] || 0) - Number(audit.languageRatios[b] || 0);
        return bDeficit - aDeficit;
      })[0] || targets[0];
    } else if (audit.actualMixRatio <= audit.upperBound) {
      const deficient = targets.slice().sort((a, b) => {
        const aDeficit = Number(audit.targetLowerBounds[a] || 0) - Number(audit.languageRatios[a] || 0);
        const bDeficit = Number(audit.targetLowerBounds[b] || 0) - Number(audit.languageRatios[b] || 0);
        return bDeficit - aDeficit;
      })[0];
      const excessive = targets.slice().sort((a, b) => {
        const aExcess = Number(audit.languageRatios[a] || 0) - Number(audit.targetUpperBounds[a] || 100);
        const bExcess = Number(audit.languageRatios[b] || 0) - Number(audit.targetUpperBounds[b] || 100);
        return bExcess - aExcess;
      })[0];
      if (deficient && Number(audit.languageRatios[deficient] || 0) < Number(audit.targetLowerBounds[deficient] || 0)) {
        desiredLanguage = deficient;
      } else if (excessive && Number(audit.languageRatios[excessive] || 0) > Number(audit.targetUpperBounds[excessive] || 100)) {
        desiredLanguage = input.baseLanguage;
      } else if (!audit.placementPassed) {
        desiredLanguage = audit.maxTargetSectionShare > audit.maxAllowedTargetSectionShare
          ? input.baseLanguage
          : (targets[0] || input.baseLanguage);
      }
    }

    const parsed = parseLyricStructure(lines);
    const bindings = bindRepairSlots(parsed, slots, usedAbsoluteIndexes);
    if (!bindings.length) break;
    const preferred = preferredTargetBlockLength(requestedRatio);
    let windows = buildRepairWindows(bindings, requestedRatio, protectedKeys);
    if (desiredLanguage !== input.baseLanguage && requestedRatio >= 20) {
      const blockWindows = windows.filter((window) => window.length >= preferred.min);
      if (blockWindows.length) windows = blockWindows;
    }

    let bestHard: {
      window: V1BoundRepairSlot[];
      replacements: string[];
      trialAudit: V1LanguageMixAudit;
      trialTrusted: Map<string, V1LanguageMixLanguageCode>;
      distance: number;
      penalty: number;
      changedCount: number;
    } | null = null;

    windows.forEach((window) => {
      const replacements = replacementForWindow(window, desiredLanguage, input.baseLanguage);
      if (!replacements) return;
      if (replacementWouldCreateUnprotectedDuplicate(lines, window, replacements, desiredLanguage, input, protectedKeys)) return;
      const changedCount = window.reduce((sum, binding, index) => (
        normalizeComparable(binding.entry.line) === normalizeComparable(replacements[index]) ? sum : sum + 1
      ), 0);
      if (!changedCount) return;
      const trialLines = [...lines];
      const trialTrusted = new Map(trustedLines);
      window.forEach((binding, index) => {
        trialLines[binding.entry.absoluteIndex] = replacements[index];
        trialTrusted.set(normalizeComparable(replacements[index]), desiredLanguage);
      });
      const trialAudit = buildAudit(
        trialLines.join('\n'),
        normalizedInput,
        trialTrusted,
        equivalenceGroups,
        true,
        replacedLineCount + changedCount,
      );
      const distance = ratioDistance(trialAudit);
      const penalty = auditPenalty(trialAudit);
      const improvesDistance = distance < currentDistance - 0.001;
      const improvesPlacementAtEqualDistance = Math.abs(distance - currentDistance) < 0.001
        && auditPenalty(trialAudit) < auditPenalty(audit) - 0.001;
      if (!improvesDistance && !improvesPlacementAtEqualDistance) return;
      if (!bestHard || distance < bestHard.distance - 0.001
        || (Math.abs(distance - bestHard.distance) < 0.001 && penalty < bestHard.penalty)) {
        bestHard = { window, replacements, trialAudit, trialTrusted, distance, penalty, changedCount };
      }
    });

    if (!bestHard) break;
    bestHard.window.forEach((binding, index) => {
      lines[binding.entry.absoluteIndex] = bestHard!.replacements[index];
      usedAbsoluteIndexes.add(binding.entry.absoluteIndex);
    });
    trustedLines.clear();
    bestHard.trialTrusted.forEach((language, line) => trustedLines.set(line, language));
    replacedLineCount += bestHard.changedCount;
    audit = bestHard.trialAudit;
  }

  const duplicateCleanup = collapseAdjacentUnprotectedRepairDuplicates(lines, protectedKeys, mirrorResolution.mirrorKeys);
  lines = duplicateCleanup.lines;
  replacedLineCount += duplicateCleanup.removedLineCount;
  const output = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return {
    lyrics: output,
    audit: buildAudit(output, normalizedInput, trustedLines, equivalenceGroups, replacedLineCount > 0, replacedLineCount),
  };
}

export function auditV1LanguageMixCard(input: EnforceV1LanguageMixCardInput): V1LanguageMixAudit {
  const requestedRatio = clampRatio(input.requestedRatio);
  const targets = Array.from(new Set((input.targetLanguages || []).filter((language) => language && language !== input.baseLanguage)));
  const slots = (input.slots || []).map(normalizeSlot).filter((slot): slot is V1LanguageMixRepairSlot => Boolean(slot));
  const { trustedLines, equivalenceGroups } = buildSlotLanguageMaps(slots, input.baseLanguage);
  return buildAudit(
    String(input.lyrics || '').trim(),
    { ...input, requestedRatio, targetLanguages: targets },
    trustedLines,
    equivalenceGroups,
    false,
    0,
  );
}


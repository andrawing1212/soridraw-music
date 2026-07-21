export type V2RapMode = "auto" | "off" | "on" | string;

export interface V2LyricSanitizeOptions {
  language?: string;
  rapMode?: V2RapMode;
}

const KOREAN_SECTION_MAP: Record<string, string> = {
  "도입부": "Intro",
  "인트로": "Intro",
  "벌스": "Verse",
  "절": "Verse",
  "1절": "Verse",
  "2절": "Verse",
  "프리코러스": "Pre-Chorus",
  "프리 코러스": "Pre-Chorus",
  "후렴": "Chorus",
  "후렴구": "Chorus",
  "코러스": "Chorus",
  "훅": "Hook",
  "랩": "Rap Section",
  "랩파트": "Rap Section",
  "랩 파트": "Rap Section",
  "브릿지": "Bridge",
  "브리지": "Bridge",
  "빌드업": "Build-Up",
  "드롭": "Drop",
  "브레이크": "Break",
  "스탑": "Stop",
  "정지": "Stop",
  "간주": "Interlude",
  "연주": "Instrumental",
  "아웃트로": "Outro",
  "종주부": "Outro",
  "마무리": "Outro",
};

const SECTION_ALIASES: Array<[RegExp, string]> = [
  [/^intro$/i, "Intro"],
  [/^verse(?:\s+[a-z0-9]+)?$/i, "Verse"],
  [/^pre[-\s]?chorus(?:\s+[a-z0-9]+)?$/i, "Pre-Chorus"],
  [/^final\s+chorus$/i, "Final Chorus"],
  [/^chorus(?:\s+[a-z0-9]+)?$/i, "Chorus"],
  [/^hook(?:\s+[a-z0-9]+)?$/i, "Hook"],
  [/^refrain(?:\s+[a-z0-9]+)?$/i, "Refrain"],
  [/^rap(?:\s+section|\s+part)?(?:\s+[a-z0-9]+)?$/i, "Rap Section"],
  [/^bridge(?:\s+[a-z0-9]+)?$/i, "Bridge"],
  [/^build[-\s]?up$/i, "Build-Up"],
  [/^drop$/i, "Drop"],
  [/^break$/i, "Break"],
  [/^stop$/i, "Stop"],
  [/^interlude$/i, "Interlude"],
  [/^instrumental$/i, "Instrumental"],
  [/^outro$/i, "Outro"],
];

const LYRIC_FREE_SECTIONS = new Set(["Intro", "Interlude", "Instrumental", "Break", "Stop"]);
const PRODUCTION_LABELS = /^(Genre|Sound|Mood|Vocals|Production|Instruments|Atmosphere|Arrangement)$/i;

const NUMBERED_SECTION_FAMILIES = new Set(["Verse", "Pre-Chorus", "Chorus", "Hook", "Refrain", "Rap Section"]);

function numberChronologicalSections(text: string): string {
  const seen = new Map<string, number>();
  return cleanWhitespace(text)
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^\[([^:\]\n]+)(?::([^\]]*))?\]$/);
      if (!match) return line;
      const section = match[1].trim();
      if (!NUMBERED_SECTION_FAMILIES.has(section)) return line;
      const next = (seen.get(section) || 0) + 1;
      seen.set(section, next);
      const cue = String(match[2] || "").trim();
      return `[${section} ${next}${cue ? `: ${cue}` : ""}]`;
    })
    .join("\n");
}

export function buildV2LyricQualityInstruction(): string {
  return `V2 LYRIC ENGINE — ISOLATED QUALITY RULES
- Treat Version 2 lyrics as a separate lyric engine, not as Classic's repaired output.
- Before writing, silently decide: speaker, desire, flaw, situation, speech style, relationship distance, and one concrete Korean-life detail. Do not print that analysis.
- Write Korean lyrics like natural Korean speech: short singable phrases, believable dialogue, 생활감, 말맛, and emotional subtext.
- Do not use generic translated-poem language or abstract mood-word repetition.
- Do not expose production terms, prompt labels, or internal analysis in lyrics.
- Use English section tags only. Keep section tags on standalone lines, then put lyric lines below.
- Use mandatory chronological numbers for standard repeated families in every structure mode: [Verse 1: conversational], [Pre-Chorus 1: rising], [Chorus 1: simple hook], then Verse 2/Pre-Chorus 2/Chorus 2 as they return. Hook, Refrain, and Rap Section follow the same 1-based rule. Unique sections such as Intro, Bridge, Final Chorus, and Outro stay unnumbered.
- Keep Chorus/Hook short, repeatable, and memorable. Let Verse/Rap carry detail when needed.
- If rap is not explicitly active, do not force a Rap Section.`;
}

function cleanWhitespace(value: string): string {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSectionName(rawSection: string, options: V2LyricSanitizeOptions): string | null {
  let section = String(rawSection || "")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!section) return null;
  section = KOREAN_SECTION_MAP[section] || section;

  for (const [pattern, canonical] of SECTION_ALIASES) {
    if (pattern.test(section)) {
      if (canonical === "Rap Section" && String(options.rapMode || "auto") === "off") return "Verse";
      return canonical;
    }
  }

  const koreanMapped = KOREAN_SECTION_MAP[section.replace(/\s+/g, "")];
  if (koreanMapped) return koreanMapped;

  return null;
}

function normalizeCue(rawCue: string): string {
  return String(rawCue || "")
    .replace(/[\[\]]/g, "")
    .replace(/\b(Genre|Sound|Mood|Vocals|Production|Instruments|Atmosphere|Arrangement)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[:;,\-\s]+|[:;,\-\s]+$/g, "")
    .trim();
}

function normalizeTagLine(line: string, options: V2LyricSanitizeOptions): string | null {
  const match = String(line || "").trim().match(/^\[([^\]\n]+)\]$/);
  if (!match) return null;
  const inside = match[1].trim();
  const [rawSection, ...cueParts] = inside.split(":");
  if (PRODUCTION_LABELS.test(rawSection.trim())) return null;

  const section = normalizeSectionName(rawSection, options);
  if (!section) return null;
  const cue = normalizeCue(cueParts.join(":"));
  return cue ? `[${section}: ${cue}]` : `[${section}]`;
}

function splitInlineTagAndLyric(line: string): string[] {
  const trimmed = String(line || "").trim();
  const match = trimmed.match(/^(\[[^\]\n]+\])\s*(.+)$/);
  if (!match) return [line];
  return [match[1], match[2]].filter(Boolean);
}

function looksLikeAnalysisLeak(line: string): boolean {
  const value = String(line || "").trim();
  return /^(analysis|speaker|desire|flaw|situation|relationship|말투|화자|욕망|결함|상황|관계|분석)\s*[:：]/i.test(value);
}

function isBracketLine(line: string): boolean {
  return /^\[[^\]\n]+\]$/.test(String(line || "").trim());
}

function sectionNameFromTag(tag: string): string | null {
  const inside = String(tag || "").trim().match(/^\[([^:\]\n]+)(?::[^\]]*)?\]$/)?.[1]?.trim();
  return inside || null;
}

function removeEmptySungBlocks(text: string): string {
  const lines = cleanWhitespace(text).split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isBracketLine(line)) {
      out.push(line);
      continue;
    }

    const section = sectionNameFromTag(line);
    if (!section || LYRIC_FREE_SECTIONS.has(section)) {
      out.push(line);
      continue;
    }

    let hasLyricBeforeNextTag = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next) continue;
      if (isBracketLine(next)) break;
      hasLyricBeforeNextTag = true;
      break;
    }

    if (hasLyricBeforeNextTag) out.push(line);
  }

  return out.join("\n");
}

function mergeCueBodies(previousTag: string, currentTag: string): string {
  const prev = previousTag.match(/^\[([^:\]\n]+)(?::([^\]]*))?\]$/);
  const curr = currentTag.match(/^\[([^:\]\n]+)(?::([^\]]*))?\]$/);
  const section = curr?.[1]?.trim() || prev?.[1]?.trim() || '';
  const cues: string[] = [];
  [prev?.[2], curr?.[2]].forEach((body) => {
    String(body || '')
      .split(/[,，]/)
      .map(normalizeCue)
      .filter(Boolean)
      .forEach((cue) => {
        if (!cues.some((existing) => existing.toLowerCase() === cue.toLowerCase())) cues.push(cue);
      });
  });
  return `[${section}${cues.length ? `: ${cues.slice(0, 3).join(', ')}` : ''}]`;
}

function collapseAdjacentDuplicateSections(text: string): string {
  const lines = cleanWhitespace(text).split("\n");
  const out: string[] = [];
  let lastTagIndex = -1;
  let hasLyricSinceLastTag = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (isBracketLine(trimmed)) {
      const currentSection = sectionNameFromTag(trimmed);
      const previousSection = lastTagIndex >= 0 ? sectionNameFromTag(out[lastTagIndex]) : null;
      if (currentSection && previousSection && !hasLyricSinceLastTag && currentSection.toLowerCase() === previousSection.toLowerCase()) {
        out[lastTagIndex] = mergeCueBodies(out[lastTagIndex], trimmed);
        continue;
      }
      out.push(line);
      lastTagIndex = out.length - 1;
      hasLyricSinceLastTag = false;
      continue;
    }

    out.push(line);
    hasLyricSinceLastTag = true;
  }

  return cleanWhitespace(out.join("\n"));
}

export function sanitizeV2GeneratedLyrics(lyrics: string, options: V2LyricSanitizeOptions = {}): string {
  const source = cleanWhitespace(lyrics);
  if (!source) return "";

  const expandedLines = source
    .split("\n")
    .flatMap(splitInlineTagAndLyric)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !looksLikeAnalysisLeak(line));

  const normalizedLines: string[] = [];

  for (const line of expandedLines) {
    const tag = normalizeTagLine(line, options);
    if (tag) {
      normalizedLines.push(tag);
      continue;
    }

    if (isBracketLine(line)) {
      const inside = line.slice(1, -1).trim();
      if (PRODUCTION_LABELS.test(inside)) continue;
      normalizedLines.push(/[가-힣]/.test(inside) ? `(${inside})` : `[${normalizeCue(inside) || inside}]`);
      continue;
    }

    normalizedLines.push(
      line
        .replace(/\s+([,.!?])/g, "$1")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    );
  }

  let text = cleanWhitespace(normalizedLines.join("\n"));
  if (!/^\s*\[[^\]]+\]/.test(text)) {
    text = `[Verse: natural delivery]\n${text}`;
  }
  text = removeEmptySungBlocks(text);
  text = collapseAdjacentDuplicateSections(text);
  text = numberChronologicalSections(text);
  return cleanWhitespace(text);
}

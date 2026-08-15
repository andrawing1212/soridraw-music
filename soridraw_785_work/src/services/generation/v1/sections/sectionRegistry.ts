import type { CustomSectionItem } from '../../../../types';

export type V1SectionKind = 'sung' | 'hook' | 'instrumental' | 'transition' | 'build' | 'closing' | 'flex';

export interface V1SectionDefinition {
  canonical: string;
  aliases: RegExp[];
  kind: V1SectionKind;
  requiresLyrics: boolean;
  allowsLyrics: boolean;
  lyricRole: string;
}

const DEFINITIONS: V1SectionDefinition[] = [
  {
    canonical: 'Intro',
    aliases: [/^intro$/i, /^opening$/i],
    kind: 'flex',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Open the song world with atmosphere, a very short voice moment, or a lyric-free musical prologue. Do not spend the main story here.',
  },
  {
    canonical: 'Verse',
    aliases: [/^verse(?:\s*[a-z]|\s*\d+)?$/i],
    kind: 'sung',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Carry concrete scene, character, action, or relationship detail. A returning Verse must advance the situation instead of repeating the previous Verse.',
  },
  {
    canonical: 'Pre-Chorus',
    aliases: [/^pre[-\s]?chorus(?:\s*\d+)?$/i],
    kind: 'build',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Reduce explanatory detail, tighten breath and wording, and raise expectation toward the next hook section.',
  },
  {
    canonical: 'Chorus',
    aliases: [/^chorus(?:\s*\d+)?$/i, /^chorus\s+response$/i],
    kind: 'hook',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Deliver the central memorable emotion, desire, slogan, or melodic payoff. Keep it more repeatable and less explanatory than Verse.',
  },
  {
    canonical: 'Final Chorus',
    aliases: [/^final\s+chorus(?:\s*\d+)?$/i],
    kind: 'hook',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Return the central hook with a clear final change in perspective, vocal scale, harmony, intensity, or wording. It may repeat the core hook but must feel like the payoff.',
  },
  {
    canonical: 'Hook',
    aliases: [/^hook(?:\s*\d+)?$/i],
    kind: 'hook',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Use a short, highly repeatable phrase or rhythmic line. Do not turn it into a long explanatory Verse.',
  },
  {
    canonical: 'Final Hook',
    aliases: [/^final\s+hook(?:\s*\d+)?$/i],
    kind: 'hook',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Bring back the main Hook with a final musical or lyrical change and a definite payoff.',
  },
  {
    canonical: 'Refrain',
    aliases: [/^refrain(?:\s*\d+)?$/i],
    kind: 'hook',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Use a brief recurring phrase that returns recognizably. A Refrain should not appear only once.',
  },
  {
    canonical: 'Rap Section',
    aliases: [/^rap\s*(?:section|verse)(?:\s*[a-z]|\s*\d+)?$/i],
    kind: 'sung',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Carry denser rhythmic detail, attitude, dialogue, or narrative motion while remaining tied to the same Story Context.',
  },
  {
    canonical: 'Bridge',
    aliases: [/^bridge(?:\s*[a-z]|\s*\d+)?$/i],
    kind: 'sung',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Create a genuine contrast or shift in perspective, truth, relationship, or emotional meaning. Do not simply repeat the Chorus under a new label.',
  },
  {
    canonical: 'Build-Up',
    aliases: [/^build[-\s]?up(?:\s*\d+)?$/i, /^buildup(?:\s*\d+)?$/i],
    kind: 'build',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Shorten lines or use compact vocal fragments while energy, rhythm, or harmony rises toward a release.',
  },
  {
    canonical: 'Drop',
    aliases: [/^drop(?:\s*\d+)?$/i],
    kind: 'flex',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'In a lyric song, use a compact hook, chant, or vocal release when appropriate. Keep it lyric-free only when the selected structure explicitly makes it instrumental.',
  },
  {
    canonical: 'Breakdown',
    aliases: [/^breakdown(?:\s*\d+)?$/i],
    kind: 'flex',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Strip the arrangement or rhythm to create contrast. If lyrics remain, keep them sparse and functionally different from Verse or Chorus.',
  },
  {
    canonical: 'Break',
    aliases: [/^break(?:\s*\d+)?$/i],
    kind: 'transition',
    requiresLyrics: false,
    allowsLyrics: false,
    lyricRole: 'Use as a short lyric-free transition. It must not replace a required sung section.',
  },
  {
    canonical: 'Stop',
    aliases: [/^stop(?:\s*\d+)?$/i, /^pause$/i],
    kind: 'transition',
    requiresLyrics: false,
    allowsLyrics: false,
    lyricRole: 'Use as a very short lyric-free interruption before the next real section.',
  },
  {
    canonical: 'Instrumental',
    aliases: [/^instrumental(?:\s+opening|\s*\d+)?$/i, /^solo(?:\s*\d+)?$/i],
    kind: 'instrumental',
    requiresLyrics: false,
    allowsLyrics: false,
    lyricRole: 'Keep this section lyric-free and vocal-free. Develop the selected musical motif, instrument, or texture.',
  },
  {
    canonical: 'Interlude',
    aliases: [/^interlude(?:\s*\d+)?$/i],
    kind: 'instrumental',
    requiresLyrics: false,
    allowsLyrics: false,
    lyricRole: 'Keep this section lyric-free and vocal-free. Use it as a short breathing space or transition.',
  },
  {
    canonical: 'Theme A',
    aliases: [/^theme\s*a$/i],
    kind: 'flex',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Establish one distinct recurring melodic or lyrical identity. Keep it clearly different from Theme B.',
  },
  {
    canonical: 'Theme B',
    aliases: [/^theme\s*b$/i],
    kind: 'flex',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Introduce a contrasting second melodic, rhythmic, or lyrical identity that can later interact with Theme A.',
  },
  {
    canonical: 'Main Theme',
    aliases: [/^main\s+theme$/i],
    kind: 'hook',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'State the core musical or lyrical identity clearly. Keep it memorable and structurally central.',
  },
  {
    canonical: 'Climax',
    aliases: [/^climax$/i],
    kind: 'hook',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Deliver the highest point of intensity or meaning. Do not introduce an unrelated new story at the peak.',
  },
  {
    canonical: 'Outro',
    aliases: [/^outro(?:\s*\d+)?$/i, /^ending$/i],
    kind: 'closing',
    requiresLyrics: false,
    allowsLyrics: true,
    lyricRole: 'Close or leave a deliberate final afterimage with a short lexical line, a clearly justified vocal gesture, or a lyric-free musical tail. Do not restart the whole story and do not add generic humming as a placeholder.',
  },
];

const cleanSectionLabel = (value: string) => String(value || '')
  .replace(/[\[\]\n\r]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function baseV1SectionName(value: string): string {
  const normalized = normalizeV1SectionName(value);
  return normalized
    .replace(/\s+(?:\d+|[A-Z])$/i, '')
    .replace(/^Final\s+Chorus$/i, 'Chorus')
    .replace(/^Final\s+Hook$/i, 'Hook')
    .trim();
}

export function normalizeV1SectionName(value: string, customNames: string[] = []): string {
  const cleaned = cleanSectionLabel(value)
    .replace(/^rap\s+verse$/i, 'Rap Section')
    .replace(/^build\s*up$/i, 'Build-Up');
  if (!cleaned) return '';

  const customMatch = customNames.find((name) => cleanSectionLabel(name).toLowerCase() === cleaned.toLowerCase());
  if (customMatch) return cleanSectionLabel(customMatch);

  const definition = DEFINITIONS.find((item) => item.aliases.some((pattern) => pattern.test(cleaned)));
  if (!definition) return cleaned;

  const numberedRepeat = cleaned.match(/^(verse|pre[-\s]?chorus|chorus|hook|refrain|rap\s*(?:section|verse))\s*(\d+)$/i);
  if (numberedRepeat) {
    const rawBase = numberedRepeat[1];
    const number = numberedRepeat[2];
    const canonicalBase = /^verse$/i.test(rawBase)
      ? 'Verse'
      : /^pre/i.test(rawBase)
        ? 'Pre-Chorus'
        : /^chorus$/i.test(rawBase)
          ? 'Chorus'
          : /^hook$/i.test(rawBase)
            ? 'Hook'
            : /^refrain$/i.test(rawBase)
              ? 'Refrain'
              : 'Rap Section';
    return `${canonicalBase} ${number}`;
  }
  if (/^verse\s*[a-z]$/i.test(cleaned)) return cleaned.replace(/^verse/i, 'Verse').replace(/\s+/g, ' ').trim();
  if (/^bridge\s*[a-z0-9]+$/i.test(cleaned)) return cleaned.replace(/^bridge/i, 'Bridge').replace(/\s+/g, ' ').trim();
  return definition.canonical;
}

export function getV1SectionDefinition(value: string): V1SectionDefinition {
  const normalized = normalizeV1SectionName(value);
  const base = baseV1SectionName(normalized);
  const found = DEFINITIONS.find((item) => item.canonical.toLowerCase() === normalized.toLowerCase())
    || DEFINITIONS.find((item) => item.canonical.toLowerCase() === base.toLowerCase());
  return found || {
    canonical: normalized || 'Section',
    aliases: [],
    kind: 'flex',
    requiresLyrics: true,
    allowsLyrics: true,
    lyricRole: 'Follow the user-defined section name and tags while keeping a clear musical and lyrical function.',
  };
}

export function getV1CustomSectionNames(customStructure: CustomSectionItem[] = []): string[] {
  return customStructure
    .map((item) => cleanSectionLabel(String(item?.section || '')))
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);
}

export interface ParsedV1SectionTag {
  raw: string;
  name: string;
  cue: string;
}

export function parseV1SectionTagLine(line: string, customNames: string[] = []): ParsedV1SectionTag | null {
  const match = String(line || '').trim().match(/^\[([^\]\n]{1,220})\]$/);
  if (!match) return null;
  const inside = String(match[1] || '').trim();
  if (!inside) return null;

  const colonIndex = inside.search(/\s*[:：]\s*/);
  const rawName = colonIndex >= 0 ? inside.slice(0, colonIndex).trim() : inside;
  const cue = colonIndex >= 0 ? inside.slice(colonIndex).replace(/^\s*[:：]\s*/, '').trim() : '';
  const normalized = normalizeV1SectionName(rawName, customNames);
  const isCustom = customNames.some((name) => name.toLowerCase() === normalized.toLowerCase());
  const isKnown = DEFINITIONS.some((item) => item.canonical.toLowerCase() === normalized.toLowerCase())
    || DEFINITIONS.some((item) => item.aliases.some((pattern) => pattern.test(rawName)));
  if (!isCustom && !isKnown) return null;
  return { raw: match[0], name: normalized, cue };
}

export function isV1StructuralSectionTag(line: string, customNames: string[] = []): boolean {
  return Boolean(parseV1SectionTagLine(line, customNames));
}

export function isV1StandaloneCueLine(line: string, customNames: string[] = []): boolean {
  const trimmed = String(line || '').trim();
  return /^\[[^\]\n]{1,220}\]$/.test(trimmed) && !isV1StructuralSectionTag(trimmed, customNames);
}

export function isV1SoundOrProductionCue(value: string): boolean {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  return /\b(?:instrumental|drums?|percussion|kick|snare|hi[-\s]?hat|808|bass|bassline|guitar|piano|synth|pad|strings?|brass|horn|flute|recorder|shakuhachi|duduk|oboe|clarinet|sax(?:ophone)?|violin|viola|cello|harp|marimba|vibraphone|organ|trumpet|trombone|mandolin|banjo|sitar|erhu|guzheng|oud|gayageum|haegeum|janggu|accordion|orchestra|band|ensemble|backing|choir|foley|ambience|ambient|reverb|echo|delay|noise|hiss|crackle|filter|beat|groove|riff|motif|stabs?|sound|fx|drop|fade|mute|silence|handclap|clap|cowbell|sampler|texture|room|tunnel|full[-\s]?band|rock[-\s]?dancehall|dancehall|jangly)\b|가야금|해금|장구|피리|대금|태평소|꽹과리|리코더|샤쿠하치|두둑|드럼|퍼커션|베이스|기타|피아노|신스|브라스|현악|오케스트라|메아리|잔향|효과음|환경음|악기/i.test(text);
}

export function cleanV1SectionCue(value: string): string {
  return String(value || '')
    .replace(/[\[\]\n\r]/g, ' ')
    // Final-output spelling repair for recurrent model truncations observed in real songs.
    // These are format-safety corrections only; they do not replace the model's creative cue.
    .replace(/\belivery\b/gi, 'delivery')
    .replace(/\beflection\b/gi, 'reflection')
    .replace(/\bleads\s+voice\b/gi, 'lead voice')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[,;:]+|[,;:]+\s*$/g, '')
    .trim();
}

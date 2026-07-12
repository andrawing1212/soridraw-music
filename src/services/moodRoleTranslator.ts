import {
  buildMoodIdentity,
  type MoodIdentity,
  type MoodIdentitySource,
} from './moodIdentity';

export type MoodRole = 'genre' | 'atmosphere' | 'vocals' | 'arrangement' | 'lyrics';

export interface MoodRoleTranslation {
  role: MoodRole;
  identityKey: string;
  purpose: string;
  sourceFocus: string;
  translationDirective: string;
  outputContract: string;
  mustPreserve: string[];
  mustAvoid: string[];
}


export interface ResolvedMoodRoleValues {
  identity: MoodIdentity;
  identityKey: string;
  genreAccent: string;
  atmosphereCue: string;
  vocalCue: string;
  arrangementCue: string;
  lyricCue: string;
}
export interface MoodRoleTranslations {
  identity: MoodIdentity;
  genre: MoodRoleTranslation;
  atmosphere: MoodRoleTranslation;
  vocals: MoodRoleTranslation;
  arrangement: MoodRoleTranslation;
  lyrics: MoodRoleTranslation;
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sourceName(source: MoodIdentitySource): string {
  return source.labelKo ? `${source.labelKo} (${source.label})` : source.label;
}

function compactParts(values: unknown[], limit = 4): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = cleanText(value);
    if (!clean) continue;
    const key = clean
      .toLowerCase()
      .replace(/\b(?:the|a|an|and|with|of|to|for|in|on|by|as)\b/g, ' ')
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }

  return result;
}

function identityKey(identity: MoodIdentity): string {
  if (!identity.sources.length) return 'mood:none';
  return `mood:${identity.sources.map((source) => source.id).join('+')}:${identity.blendMode}`;
}

function identitySummary(identity: MoodIdentity): string {
  if (!identity.sources.length) return 'No selected mood identity.';

  const sourceNames = identity.sources.map(sourceName).join(' + ');
  const layers = compactParts([
    identity.coreEmotion,
    identity.supportingEmotion,
    identity.hiddenLayer,
  ], 3);

  return [
    `Selected identity: ${sourceNames}.`,
    layers.length ? `Resolved emotional layers: ${layers.join(' / ')}.` : '',
    identity.relationship,
  ]
    .filter(Boolean)
    .join(' ');
}

function preserveRules(identity: MoodIdentity): string[] {
  if (!identity.sources.length) {
    return ['Do not invent a decorative mood identity when no mood was selected.'];
  }

  const rules = [
    `Preserve the exact distinction between ${identity.sources.map(sourceName).join(' + ')}.`,
    identity.synthesisDirective,
  ];

  if (identity.blendMode === 'layered') {
    rules.push('Keep the first selected mood readable on the surface and retain the remaining moods as supporting tension, undertone, or aftertaste.');
  } else if (identity.blendMode === 'reinforcing') {
    rules.push('Fuse overlapping moods into one stronger identity without repeating synonyms.');
  }

  return compactParts(rules, 4);
}

function roleTranslation(
  identity: MoodIdentity,
  role: MoodRole,
  purpose: string,
  sourceFocus: string,
  translationDirective: string,
  outputContract: string,
  mustAvoid: string[],
): MoodRoleTranslation {
  return {
    role,
    identityKey: identityKey(identity),
    purpose,
    sourceFocus: `${identitySummary(identity)} ${sourceFocus}`.trim(),
    translationDirective,
    outputContract,
    mustPreserve: preserveRules(identity),
    mustAvoid,
  };
}

/**
 * Converts one shared MoodIdentity into five role-owned interpretations.
 *
 * This module deliberately does not generate final prompt text. It defines
 * semantic ownership so the same mood is not copied verbatim into every line.
 * Later prompt/lyric stages can consume these role briefs independently while
 * still sharing one identityKey and one resolved emotional source.
 */
export function buildMoodRoleTranslations(identity: MoodIdentity): MoodRoleTranslations {
  const empty = !identity.sources.length;
  const core = cleanText(identity.coreEmotion) || 'the selected emotional identity';
  const support = cleanText(identity.supportingEmotion);
  const hidden = cleanText(identity.hiddenLayer);
  const movement = cleanText(identity.movement);

  const genre = roleTranslation(
    identity,
    'genre',
    'Give the song an immediate musical doorway: the selected mood should be recognizable as genre color without replacing the chosen genre.',
    `Prioritize the core identity (${core})${support ? ` and only the most useful supporting shade (${support})` : ''}. Do not use scene, character, or vocal-performance wording here.`,
    empty
      ? 'Keep the chosen genre clean. Do not add a guessed mood adjective.'
      : 'Translate the mood into one compact musical identity accent or a short paired accent. Use genre-facing language such as tonal color, attitude, energy, polish, weight, or era-like character. Preserve precise differences between moods instead of collapsing them into a generic neighbor such as dreamy, emotional, or playful.',
    'A concise genre-facing accent, normally one phrase and at most two complementary mood concepts. It must read naturally before or after the genre name and must not become an adjective dump.',
    [
      'Do not describe a location, plot, weather, character action, singing technique, or arrangement sequence.',
      'Do not copy the raw mood catalogue sentence.',
      'Do not replace the selected genre with the mood.',
      'Do not flatten distinct moods into one vague umbrella adjective.',
    ],
  );

  const atmosphere = roleTranslation(
    identity,
    'atmosphere',
    'Turn the shared mood identity into a perceivable scene, air, emotional temperature, and tension.',
    `Use the core identity (${core}) as the visible atmosphere${hidden ? ` and the hidden layer (${hidden}) as subtext, friction, or aftertaste` : ''}. Use actual theme or Situation data for who, where, and what happens; mood alone must not invent a fixed room, road, office, rain, or other stock scene.`,
    empty
      ? 'Describe only the real theme or Situation scene. Do not manufacture a mood scene.'
      : 'Show the mood through what the moment feels like, how the space behaves, what remains unsaid, and where emotional pressure sits. Convert adjectives into scene behavior and atmosphere rather than repeating the Genre accent. If no concrete story exists, stay human and neutral instead of choosing a hardcoded location.',
    'One complete natural sentence containing scene/air plus emotional tension. The sentence must finish semantically, avoid catalogue labels, and contain each mood meaning only once.',
    [
      'Do not repeat the same mood phrase as “shaped by A with A”.',
      'Do not copy the Genre accent as the scene description.',
      'Do not infer a literal scene from Style, Sound, instrument, or production words.',
      'Do not output internal phrases such as user core idea, visible musical moment, central voice, or compact emotional space.',
    ],
  );

  const vocals = roleTranslation(
    identity,
    'vocals',
    'Make the singer cause the selected mood through delivery, phrasing, breath, emotional distance, and attitude.',
    `Preserve the user-selected vocal identity first. Let the core mood (${core}) shape the outward delivery${hidden ? ` while the hidden layer (${hidden}) shapes what the singer withholds, leaks, masks, or reveals` : ''}.`,
    empty
      ? 'Keep the selected vocal character and genre-appropriate singing behavior without adding a guessed emotion.'
      : 'Translate the mood into human performance behavior: how the singer enters a phrase, holds back or opens up, teases or confronts, places breath, bends timing, and reveals emotion. The singer should embody the mood; do not merely attach the same mood adjective used in Genre or Atmosphere.',
    'One natural vocal-performance description that keeps gender, role, technique, and manually selected character intact, then adds only the mood behavior needed to make the performance feel consistent.',
    [
      'Do not replace manual vocal selections.',
      'Do not describe scenery or arrangement structure.',
      'Do not copy raw mood labels as a comma list.',
      'Do not reduce different moods to the same generic delivery word.',
    ],
  );

  const arrangement = roleTranslation(
    identity,
    'arrangement',
    'Express the mood through time: pacing, density, contrast, section pressure, turn, payoff, and release.',
    `Use catalogue movement source (${movement || 'none supplied'}) as structural evidence. Let the core mood (${core}) determine the main movement${support ? ` and let supporting emotion (${support}) shape contrast or secondary motion` : ''}.`,
    empty
      ? 'Keep genre-appropriate structure and only include tempo when the user set it.'
      : 'Translate mood into progression behavior, not another adjective list. Resolve multiple mood movements into one coherent arc: decide what stays steady, what tightens, what lifts, what delays, and how the final release lands. Preserve explicit BPM or structural commands from the user.',
    'A concise arrangement path containing compatible pacing and payoff cues. It may include BPM only when explicitly set. Conflicting source movements must be synthesized into one arc rather than listed side by side.',
    [
      'Do not repeat Atmosphere wording.',
      'Do not list every catalogue arrangement phrase.',
      'Do not combine mutually conflicting motions without explaining their sequence or role.',
      'Do not add a tempo the user did not set.',
    ],
  );

  const lyrics = roleTranslation(
    identity,
    'lyrics',
    'Turn the mood into a character’s speech strategy, behavior, emotional concealment, desire, and aftertaste.',
    `Use the core mood (${core}) for the speaker’s readable attitude${hidden ? ` and the hidden layer (${hidden}) for the private motive, flaw, fear, or emotional contradiction beneath the words` : ''}. Theme and Situation decide the actual story.`,
    empty
      ? 'Write from the real character, theme, and Situation without inventing a decorative emotional persona.'
      : 'Do not write the mood word itself. Show it through what the character notices, avoids, jokes about, repeats, denies, asks for, or fails to say. Let the same MoodIdentity govern diction and behavior while lyric density still follows genre and section role.',
    'An internal lyric-behavior brief describing speaker attitude, speech pattern, emotional tactic, desire, and chorus aftertaste. It is not final lyric text and must not leak as instructions into the lyrics.',
    [
      'Do not copy prompt adjectives into lyric lines.',
      'Do not force a fixed stock scene from a mood keyword.',
      'Do not let mood override Situation, relationship, age, honorific direction, or user-written material.',
      'Do not expose internal planning language in the final lyrics.',
    ],
  );

  return {
    identity,
    genre,
    atmosphere,
    vocals,
    arrangement,
    lyrics,
  };
}

export function resolveMoodRoleTranslations(params: any): MoodRoleTranslations {
  return buildMoodRoleTranslations(buildMoodIdentity(params));
}

function formatRole(role: MoodRoleTranslation): string {
  return [
    `[${role.role.toUpperCase()} MOOD ROLE]`,
    `purpose: ${role.purpose}`,
    `source focus: ${role.sourceFocus}`,
    `translation rule: ${role.translationDirective}`,
    `output contract: ${role.outputContract}`,
    `must preserve: ${role.mustPreserve.join(' | ')}`,
    `must avoid: ${role.mustAvoid.join(' | ')}`,
  ].join('\n');
}

export function formatMoodRoleTranslationContext(translations: MoodRoleTranslations): string {
  return [
    'MOOD ROLE TRANSLATION BLUEPRINT (INTERNAL):',
    `shared identity key: ${identityKey(translations.identity)}`,
    'All roles come from the same MoodIdentity, but each role owns different semantics. Never paste one role\'s wording into another role.',
    formatRole(translations.genre),
    formatRole(translations.atmosphere),
    formatRole(translations.vocals),
    formatRole(translations.arrangement),
    formatRole(translations.lyrics),
  ].join('\n\n');
}


function titleGenreToken(value: string): string {
  return cleanText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.length <= 3 && /^[A-Z0-9&]+$/.test(word)
      ? word
      : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join('-');
}

function firstRoleDescriptor(source: MoodIdentitySource): string {
  const first = cleanText(source.emotionalCharacter)
    .split(/[,;/|]+/)[0]
    .replace(/[.]+$/g, '')
    .trim();
  const words = first.split(/\s+/).filter(Boolean);
  const awkwardGrammar = /\b(?:on|under|with|while|beneath|through|inside|outside|toward|into)\b/i.test(first);
  const abstractProductionFragment = /\b(?:body|surface|texture|motion|pocketed|fluid|quality|character)\b|-(?:led|driven|based)\b/i.test(first);
  const chosen = first && words.length <= 4 && !awkwardGrammar && !abstractProductionFragment
    ? first
    : source.label;
  return cleanText(chosen).toLowerCase();
}

function firstMovementPhrase(source: MoodIdentitySource): string {
  return cleanText(source.movement)
    .split(/[,;/|]+/)[0]
    .replace(/[.]+$/g, '')
    .trim();
}

function articleFor(value: string): string {
  return /^[aeiou]/i.test(cleanText(value)) ? 'an' : 'a';
}

function joinNatural(values: string[]): string {
  const items = values.map(cleanText).filter(Boolean);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function genreAccentTokens(value: string): Set<string> {
  return new Set(
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function isSubsetTokens(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size || a.size > b.size) return false;
  for (const token of a) {
    if (!b.has(token)) return false;
  }
  return true;
}

function dedupeGenreAccents(values: string[], limit = 5): string[] {
  const result: string[] = [];
  const tokenSets: Set<string>[] = [];

  for (const raw of values.map(cleanText).filter(Boolean)) {
    const tokens = genreAccentTokens(raw);
    if (!tokens.size) continue;

    let skip = false;
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const existing = tokenSets[index];
      if (isSubsetTokens(tokens, existing)) {
        skip = true;
        break;
      }
      if (isSubsetTokens(existing, tokens)) {
        result.splice(index, 1);
        tokenSets.splice(index, 1);
      }
    }
    if (skip) continue;

    result.push(raw);
    tokenSets.push(tokens);
    if (result.length >= limit) break;
  }

  return result;
}

function resolvedRoleValues(identity: MoodIdentity): ResolvedMoodRoleValues {
  const sources = identity.sources;
  const key = identityKey(identity);
  const roleSources = sources.filter((source) => {
    if (!source.isCustom) return true;
    const customText = cleanText(`${source.label} ${source.emotionalCharacter} ${source.movement}`);
    return Boolean(customText) && /^[\x00-\x7F]+$/.test(customText);
  });
  if (!roleSources.length) {
    return {
      identity,
      identityKey: key,
      genreAccent: '',
      atmosphereCue: '',
      vocalCue: '',
      arrangementCue: '',
      lyricCue: '',
    };
  }

  const descriptors = roleSources.map(firstRoleDescriptor).filter(Boolean);
  const movements = roleSources.map(firstMovementPhrase).filter(Boolean);
  const genreAccent = dedupeGenreAccents(
    roleSources.map((source) => titleGenreToken(source.label || source.emotionalCharacter || source.id)),
    5,
  ).join(' ');

  const primary = descriptors[0] || 'emotionally specific';
  const secondary = descriptors[1] || '';
  const quieterLayers = descriptors.slice(2, 5);
  const quieterLayerText = joinNatural(quieterLayers);

  let atmosphereCue = `${primary} atmosphere`;
  let vocalCue = `${primary} delivery`;
  let lyricCue = `${primary} outward attitude`;

  if (identity.blendMode === 'layered' && secondary) {
    atmosphereCue = `${primary} atmosphere over ${articleFor(secondary)} ${secondary} undercurrent${quieterLayerText ? `, with subtle ${quieterLayerText} undertones` : ''}`;
    vocalCue = `${primary} delivery over ${articleFor(secondary)} ${secondary} undertone${quieterLayerText ? `, with subtle ${quieterLayerText} inflections at phrase endings` : ''}`;
    lyricCue = `${primary} outward behavior masking ${articleFor(secondary)} ${secondary} inner state${quieterLayerText ? `, while ${quieterLayerText} remains in the aftertaste` : ''}`;
  } else if (identity.blendMode === 'reinforcing' && secondary) {
    atmosphereCue = `${primary} atmosphere deepened by ${secondary}`;
    vocalCue = `${primary} delivery intensified by ${secondary} phrasing`;
    lyricCue = `${primary} speech behavior reinforced by ${secondary} emotional pressure`;
  }

  let arrangementCue = movements[0] || '';
  if (movements[1]) {
    arrangementCue = identity.blendMode === 'layered'
      ? `${movements[0]} before ${movements[1]}`
      : `${movements[0]} with ${movements[1]}`;
  }
  if (movements[2]) arrangementCue = `${arrangementCue}, then ${movements[2]}`;

  return {
    identity,
    identityKey: key,
    genreAccent: cleanText(genreAccent),
    atmosphereCue: cleanText(atmosphereCue),
    vocalCue: cleanText(vocalCue),
    arrangementCue: cleanText(arrangementCue),
    lyricCue: cleanText(lyricCue),
  };
}

export function buildResolvedMoodRoleValues(identity: MoodIdentity): ResolvedMoodRoleValues {
  return resolvedRoleValues(identity);
}

export function resolveMoodRoleValues(params: any): ResolvedMoodRoleValues {
  return resolvedRoleValues(buildMoodIdentity(params));
}

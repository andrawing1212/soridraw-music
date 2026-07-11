function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function listValues(values: unknown, limit = 12): string {
  if (!Array.isArray(values)) return '';
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .slice(0, limit)
    .join(' / ');
}

function compact(value: unknown, fallback = 'none'): string {
  const text = cleanText(value);
  return text || fallback;
}

function summarizeSituation(situation: any): string {
  if (!situation || typeof situation !== 'object') return 'none';
  return [
    situation.description,
    situation.detailCustom,
    situation.relationship,
    situation.development,
    situation.speakerStyle,
    situation.attitude,
    situation.targetA,
    situation.targetB,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(' / ') || 'none';
}

export function buildMoodDirectorBrief(params: any): string {
  const selectedMood = listValues(params?.moods, 10) || compact(params?.mood, 'none');
  const selectedTheme = listValues(params?.themes, 8) || compact(params?.theme, 'none');
  const directorText = compact(params?.userInput, 'none');
  const situation = summarizeSituation(params?.situation);

  return `GLOBAL MOOD DIRECTIVE (MANDATORY, INTERNAL ONLY):
Selected mood keywords: ${selectedMood}
Related story signals: theme=${selectedTheme} / director=${directorText} / situation=${situation}

Treat Mood as a compressed global direction for the whole song, not as the [Atmosphere]/[Mood] line only.
Mood must influence every output lane indirectly and differently: Genre, Sound/Instruments, Atmosphere/Mood, Vocals, Production/Arrangement, title, and lyrics.
Do not copy mood labels or their obvious literal children into lyrics.

First silently resolve all selected moods into ONE short global directive:
- core song identity: the emotional flavor that seasons the whole track
- surface energy: bright, calm, playful, funky, vintage, breezy, heavy, dry, loose, etc.
- hidden layer: what emotional aftertaste remains under the surface
- relationship pressure: closeness, distance, awkwardness, avoidance, tension, release
- movement: still, dragging, bouncing, rushing, hesitating, opening up
- section curve: how verse, pre-chorus, chorus, bridge should move emotionally

Global routing rule:
- Genre: season the genre identity lightly. Example: vintage/funky/breezy/upbeat may color the genre phrase, but do not replace the selected genre.
- Sound/Instruments: translate mood into sound texture, weight, air, tightness, roughness, polish, dryness, bounce, openness, or density.
- Atmosphere/Mood: express the final emotional design directly, but keep it music-friendly and not object-heavy.
- Vocals: translate mood into delivery, distance, diction, restraint, confidence, looseness, breath, or emotional pressure.
- Production/Arrangement: translate mood into section motion, build, drop, hook lift, contrast, space, and pacing.
- Lyrics: translate mood only into speech attitude, sentence length, hesitation, joke, silence, directness, repetition, and emotional scale.

Compression rule:
- The hidden directive may be detailed, but final prompt lines must stay short and clear.
- Do not repeat the same mood adjective in every line. Each line should receive only the mood aspect that fits its role.
- If many moods conflict, blend them into one clear intent rather than listing every selected keyword.
- If mood is weak or absent, keep the song emotionally simple rather than inventing decorative atmosphere.

Leak guard:
- Prompt should not become a screenplay. Lyrics should not become a list of production words.
- Mood is a seasoning directive, not a pile of words to paste. Think bibimbap sesame oil: it touches the whole bowl, but it does not become every ingredient.`;
}

export function buildCreativeBriefSourceSummary(params: any): string {
  const storyInputs = [
    `director/free text: ${compact(params?.userInput, 'none')}`,
    `situation: ${summarizeSituation(params?.situation)}`,
    `lyric draft: ${compact(params?.lyricDraft, 'none')}`,
    `selected theme: ${listValues(params?.themes, 8) || compact(params?.theme, 'none')}`,
    `selected mood: ${listValues(params?.moods, 8) || 'none'}`,
  ];
  const musicInputs = [
    `genre: ${compact(params?.genre, 'none')}`,
    `sub genre: ${listValues(params?.subGenre, 8) || 'none'}`,
    `style: ${listValues(params?.styleValues ?? params?.styles, 8) || 'none'}`,
    `sound/instrument: ${listValues(params?.instrumentSounds, 12) || 'none'}`,
    `point sound: ${listValues(params?.pointSounds, 8) || 'none'}`,
    `vocal: ${compact(params?.vocal?.tonePrompt || params?.vocal?.mode, 'none')}`,
    `tempo: ${compact(params?.tempo, params?.isRandomTempo ? 'random' : 'none')}`,
    `structure: ${compact(params?.songStructure, 'default')}`,
  ];

  return `STORY INPUTS:\n- ${storyInputs.join('\n- ')}\n\nMUSIC INPUTS:\n- ${musicInputs.join('\n- ')}`;
}

export function buildSongCreativeBriefInstruction(params: any): string {
  return `COMMON SONG CREATIVE BRIEF (MANDATORY, INTERNAL ONLY):
Before writing productionPrompt, title, or lyrics, silently build ONE shared creative brief from the inputs below. Do NOT output the brief.

${buildCreativeBriefSourceSummary(params)}

${buildMoodDirectorBrief(params)}

Priority:
1. User director/free text and explicit Situation fields define the story world.
2. Lyric draft, selected Theme, and selected Mood support the story only when they do not conflict.
3. Genre, Style, Sound, instruments, tempo, structure, and production keywords define music/performance. They must not invent story objects, places, props, or title concepts.

Separate the brief into three lanes:
- STORY LANE: speaker, addressee, current situation, relationship, allowed scene boundary, and everyday Korean speech tone.
- MUSIC LANE: genre identity, sound palette, vocal direction, tempo/structure, and production movement.
- EXPRESSION BRIDGE: how music changes lyric delivery only: line length, repetition, hook directness, emotional size, section energy, breath, and phrasing.

Shared-brief rule:
- productionPrompt and lyrics must come from the same hidden brief so the song feels connected.
- Do NOT let productionPrompt wording become lyric objects. Lyrics must not copy [Genre], [Sound]/[Instruments], [Mood]/[Atmosphere], [Vocals], or [Production]/[Arrangement] phrases as story content.
- Do NOT let lyric props or random scene details pollute productionPrompt. Prompt should describe musical air and movement, not explain a screenplay.

Global mood routing rule:
- The selected Mood is a global seasoning directive for all five prompt lanes, not only Atmosphere/Mood.
- Genre receives only a small mood color; Sound receives texture/weight/air; Atmosphere receives emotional state; Vocals receive delivery/emotional pressure; Production receives section motion and density.
- If Vocal Character is selected, do not let the character become a disconnected preset. Treat Genre + Mood + Theme as the upper performance director: the character identity stays, but delivery, phrasing, emotional distance, hook focus, and pressure must melt into the selected song world.
- Prefer compact music-direction language over object-heavy imagery, and keep each final prompt line short.

Lyric rule:
- Title and lyrics use STORY LANE first.
- Music lane may affect delivery, rhythm, hook density, and emotional scale, but not lyric subject matter.
- If story source is weak, write a simpler human situation. Do not compensate by inventing genre-themed scenes.
- Korean lyric body must sound like contemporary Korean speech/thought, not translated AI prose or decorative metaphor stacking.`;
}

function collectMoodDirectiveText(params: any): string {
  return [
    ...(Array.isArray(params?.moods) ? params.moods : []),
    params?.mood,
    params?.customMoodInput,
    params?.customMoodText,
    params?.directMoodInput,
    params?.directMoodText,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type GlobalMoodLaneCues = {
  genre: string;
  sound: string;
  mood: string;
  vocals: string;
  production: string;
};

function joinCueParts(parts: string[], limit = 3): string {
  const seen = new Set<string>();
  return parts
    .map(cleanText)
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .join(', ');
}

export function buildGlobalMoodLaneCues(params: any): GlobalMoodLaneCues {
  const text = collectMoodDirectiveText(params);
  if (!text) return { genre: '', sound: '', mood: '', vocals: '', production: '' };

  const has = (pattern: RegExp) => pattern.test(text);
  const dreamy = has(/몽상|몽환|꿈결|dream|dreamy|hazy|floating|blurred/);
  const vintage = has(/빈티지|레트로|아날로그|빛바랜|낡은|vintage|retro|analog|dusty/);
  const warm = has(/따뜻|포근|다정|온화|warm|cozy|tender|intimate/);
  const hollow = has(/공허|허전|비어|empty|hollow|void|lonely|loneliness/);
  const funky = has(/펑키|그루브|groovy|funk|funky|bounce|bouncy/);
  const breezy = has(/시원|산뜻|청량|breezy|refreshing|open|cool/);
  const upbeat = has(/업비트|밝|경쾌|쾌활|upbeat|bright|lively|cheerful/);
  const calm = has(/차분|담담|고요|잔잔|calm|quiet|restrained|still/);
  const dark = has(/어두|불안|위태|긴장|dark|tense|anxious|moody/);
  const playful = has(/장난|유쾌|능청|코믹|playful|quirky|comic/);
  const spacious = has(/공간|넓|웅장|spatial|wide|cinematic|expansive/);

  const genreParts: string[] = [];
  const soundParts: string[] = [];
  const moodParts: string[] = [];
  const vocalParts: string[] = [];
  const productionParts: string[] = [];

  if (dreamy) {
    genreParts.push('dream-shaped color');
    soundParts.push('soft-focus haze');
    moodParts.push('dreamlike emotional drift');
    vocalParts.push('slightly distant phrasing');
    productionParts.push('floating section motion');
  }
  if (vintage) {
    genreParts.push('vintage-tinted identity');
    soundParts.push('dusty analog texture');
    moodParts.push('aged nostalgic aftertaste');
    productionParts.push('subtle retro flow');
  }
  if (warm) {
    genreParts.push('intimate color');
    soundParts.push('soft rounded texture');
    moodParts.push('gentle closeness');
    vocalParts.push('gentle restrained emotion');
    productionParts.push('soft intimate build');
  }
  if (hollow) {
    genreParts.push('hollow emotional shade');
    soundParts.push('sparse open resonance');
    moodParts.push('quiet emptiness under the surface');
    vocalParts.push('held-back hollow aftertone');
    productionParts.push('sparse break and return');
  }
  if (funky) {
    genreParts.push('funky rhythmic color');
    soundParts.push('tight groove texture');
    moodParts.push('light body-moving pulse');
    vocalParts.push('loose rhythmic delivery');
    productionParts.push('groove-led hook lift');
  }
  if (breezy) {
    genreParts.push('open breezy color');
    soundParts.push('light airy edges');
    moodParts.push('clear open feeling');
    vocalParts.push('unforced relaxed tone');
    productionParts.push('refreshing section lift');
  }
  if (upbeat) {
    genreParts.push('bright upbeat identity');
    soundParts.push('crisp forward motion');
    moodParts.push('bright surface energy');
    vocalParts.push('lively but controlled delivery');
    productionParts.push('clean upbeat momentum');
  }
  if (calm) {
    genreParts.push('restrained color');
    soundParts.push('dry controlled space');
    moodParts.push('calm emotional pressure');
    vocalParts.push('understated calm delivery');
    productionParts.push('measured section pacing');
  }
  if (dark) {
    genreParts.push('dark emotional edge');
    soundParts.push('heavier shadowed weight');
    moodParts.push('low tension undercurrent');
    vocalParts.push('guarded emotional pressure');
    productionParts.push('tension-and-release movement');
  }
  if (playful) {
    genreParts.push('playful edge');
    soundParts.push('small rhythmic sparks');
    moodParts.push('light teasing surface');
    vocalParts.push('playful conversational bounce');
    productionParts.push('playful hook turn');
  }
  if (spacious) {
    genreParts.push('wide spatial color');
    soundParts.push('wide air and depth');
    moodParts.push('expanded emotional space');
    vocalParts.push('distance-aware delivery');
    productionParts.push('wide cinematic section spread');
  }

  return {
    genre: joinCueParts(genreParts, 1),
    sound: joinCueParts(soundParts, 2),
    mood: joinCueParts(moodParts, 2),
    vocals: joinCueParts(vocalParts, 2),
    production: joinCueParts(productionParts, 2),
  };
}

export function buildGlobalMoodDistributionInstruction(params: any): string {
  const selectedMood = listValues(params?.moods, 10) || compact(params?.mood, 'none');
  const cues = buildGlobalMoodLaneCues(params);
  const hasCue = Object.values(cues).some(Boolean);

  return `GLOBAL MOOD 5-LANE DISTRIBUTION (MANDATORY):
Selected mood source: ${selectedMood}
${hasCue ? `Suggested lane translation:
- Genre lane: ${cues.genre || 'subtle mood color only'}
- Sound/Instruments lane: ${cues.sound || 'texture/weight/air only'}
- Atmosphere/Mood lane: ${cues.mood || 'main emotional design'}
- Vocals lane: ${cues.vocals || 'delivery/distance/emotional pressure only'}
- Arrangement/Production lane: ${cues.production || 'section motion/density/pacing only'}` : ''}

VOCAL CHARACTER INTEGRATION:
If a Vocal Character exists, keep its identity, but the selected Genre/Mood/Theme must direct how that character sings. The [Vocals] line should include one compact adaptation cue such as genre-shaped phrasing, mood-shaped distance, or story-aware pressure. Do not leave the character as a standalone preset voice.

Do not treat Mood as a short fixed prefix before the genre. Do not choose from a tiny fixed list of mood words.
First synthesize the selected mood combination into one global feeling, then distribute it across the five prompt lanes by role.
The selected genre/style/sound anchors must remain, but they should be seasoned by the global mood instead of blocking it.
Final production prompt lines must stay concise: each lane receives only the mood aspect that belongs there, not a repeated mood word list.`;
}

function parsePromptLines(prompt: string): { label: string; value: string; raw: string }[] {
  return String(prompt || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (!match) return { label: '', value: line, raw: line };
      return { label: match[1].trim(), value: match[2].trim(), raw: line };
    });
}

function normalizePromptPartKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(?:the|a|an|and|with|of|to|for|in|on|by)\b/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitPromptParts(value: string): string[] {
  return cleanText(value)
    .split(/[,，]/)
    .map((part) => part.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

function compactPromptLineValue(label: string, value: string): string {
  const clean = cleanText(value)
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parts = splitPromptParts(clean);
  if (parts.length <= 1) return clean;

  const maxPartsByLane: Record<string, number> = {
    genre: 3,
    instruments: 6,
    sound: 6,
    atmosphere: 4,
    mood: 4,
    vocals: 5,
    arrangement: 5,
    production: 5,
  };
  const maxParts = maxPartsByLane[label.toLowerCase()] || 5;
  const kept: string[] = [];

  for (const part of parts) {
    const key = normalizePromptPartKey(part);
    if (!key) continue;
    const duplicate = kept.some((existing) => {
      const existingKey = normalizePromptPartKey(existing);
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey);
    });
    if (duplicate) continue;
    kept.push(part);
    if (kept.length >= maxParts) break;
  }

  return (kept.length ? kept : parts.slice(0, maxParts)).join(', ').replace(/\s{2,}/g, ' ').trim();
}

function appendCue(value: string, cue: string, label = ''): string {
  const base = compactPromptLineValue(label, value);
  const cleanCue = cleanText(cue);
  if (!cleanCue) return base;
  const baseLower = base.toLowerCase();
  const cueParts = splitPromptParts(cleanCue);
  const missing = cueParts.filter((part) => {
    const key = normalizePromptPartKey(part);
    if (!key) return false;
    return !baseLower.includes(part.toLowerCase().slice(0, Math.min(part.length, 24)))
      && !normalizePromptPartKey(base).includes(key);
  });
  if (!missing.length) return base;
  return compactPromptLineValue(label, `${base}, ${missing.join(', ')}`.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim());
}

export function applyGlobalMoodDirectiveToProductionPrompt(prompt: string, params: any): string {
  const cues = buildGlobalMoodLaneCues(params);
  if (!Object.values(cues).some(Boolean)) return prompt;

  const lines = parsePromptLines(prompt);
  const mapped = lines.map((line) => {
    const label = line.label.toLowerCase();
    if (!line.label) return line.raw;
    if (label === 'genre') return `[${line.label}] ${appendCue(line.value, cues.genre, label)}`;
    if (label === 'instruments' || label === 'sound') return `[${line.label}] ${appendCue(line.value, cues.sound, label)}`;
    if (label === 'atmosphere' || label === 'mood') return `[${line.label}] ${appendCue(line.value, cues.mood, label)}`;
    if (label === 'vocals') return `[${line.label}] ${appendCue(line.value, cues.vocals, label)}`;
    if (label === 'arrangement' || label === 'production') return `[${line.label}] ${appendCue(line.value, cues.production, label)}`;
    return line.raw;
  });

  return mapped.join('\n');
}

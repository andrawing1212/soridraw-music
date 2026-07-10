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

  return `MOOD DIRECTOR BRIEF (MANDATORY, INTERNAL ONLY):
Selected mood keywords: ${selectedMood}
Related story signals: theme=${selectedTheme} / director=${directorText} / situation=${situation}

Treat Mood as the song's emotional director, not as a list of lyric words.
Do not copy mood labels or their obvious literal children into lyrics.

First silently resolve all selected moods into ONE final emotional design:
- core emotional axis: what feeling leads the song
- surface vs hidden layer: what is shown outside and what is held inside
- relationship pressure: closeness, distance, awkwardness, avoidance, tension, release
- speech temperature: dry, gentle, playful, blunt, careful, resigned, etc. without using temperature words as lyrics
- movement: still, dragging, bouncing, rushing, hesitating, opening up
- section curve: how verse, pre-chorus, chorus, bridge should emotionally move

Mood routing rule:
- Prompt Atmosphere/Mood may describe the final emotional design in music-friendly language.
- Lyrics must translate the final emotional design into ordinary Korean speech rhythm, silence, timing, sentence length, avoidance, hesitation, joke, or directness.
- Lyrics must not explain mood with literal labels such as warmth, cold air, color, season name, exact time, fog, shadow, streetlight, corner, window, or other default atmosphere props unless the user explicitly made them the story.
- If mood keywords conflict, blend them into a clear single intent. Do not list every selected mood in the output.
- If mood is weak or absent, keep the song emotionally simple rather than inventing decorative atmosphere.`;
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

Atmosphere/Mood rule:
- The prompt Atmosphere/Mood line should express the shared emotional state, relationship pressure, and performance air in music-friendly language.
- Avoid ambiguous concrete metaphors that lyrics can misread literally, such as line, shadow, clock, neon, maze, orbit, wave, door, streetlight, cold air, warmth, or color words unless the user directly made them the story.
- Prefer abstract-but-musical emotional direction over object-heavy imagery.

Lyric rule:
- Title and lyrics use STORY LANE first.
- Music lane may affect delivery, rhythm, hook density, and emotional scale, but not lyric subject matter.
- If story source is weak, write a simpler human situation. Do not compensate by inventing genre-themed scenes.
- Korean lyric body must sound like contemporary Korean speech/thought, not translated AI prose or decorative metaphor stacking.`;
}

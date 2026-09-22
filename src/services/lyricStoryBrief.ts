function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function listValues(values: unknown, limit = 10): string {
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

export function buildLyricStoryBriefInstruction(params: any): string {
  return `LYRIC STORY BRIEF FIRST (MANDATORY, INTERNAL ONLY):
Before writing title or lyrics, silently create a short lyric story brief from the COMMON SONG CREATIVE BRIEF. Do NOT output the brief.

Source and priority:
- Reuse the COMMON SONG CREATIVE BRIEF immediately above. Do not restate or reinterpret its raw inputs.
- Preserve its story priority: user director/free text and Situation first, then lyric draft, Theme, and Mood when non-conflicting.

Separation rule:
- Genre, Style, Sound, instrument, vocal technique, tempo, structure, and production keywords are music directions, not lyric story objects.
- These may shape lyric delivery, line length, hook repetition, emotional scale, and section energy.
- These must NOT create lyric content, props, places, instruments, genre imagery, game/story clichés, or title concepts unless the user directly wrote them as the story.

The hidden brief must decide only:
- speaker: who is speaking
- addressee: who or what they are speaking toward
- situation: what is happening now
- relationship: why it matters
- speech style: how a real Korean person would phrase it
- scene boundary: what concrete world is allowed, based only on story sources
- leak guard: which music keywords must stay out of lyric body and title

Lyric writing rule:
- Write freely from the hidden story brief, not by copying the final production prompt.
- Genre/Sound/Production may shape rhythm, line length, hook behavior, and emotional scale, but they must not become the lyric topic unless the user explicitly made them the topic.
- Korean lyrics must feel like contemporary Korean emotional speech: plain, specific, restrained, and not translated, overly poetic, or AI-poetic.
- Do not over-apply safety rules. Keep the Korean lyric natural, coherent, and human first.`;
}

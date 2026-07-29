import type {
  V1SectionBlueprint,
  V1SectionBlueprintEntry,
  V1SectionEngineParams,
} from './sectionBlueprint';
import { describeV1SectionMass } from './sectionRoleEngine';

function sectionLoadLines(blueprint: V1SectionBlueprint): string {
  return blueprint.entries.map((entry, index) => {
    const lyricPolicy = !entry.allowsLyrics
      ? 'no lyric body'
      : entry.requiresLyrics
        ? 'must carry role-appropriate lyric or vocal content'
        : 'may stay lyric-free or use only role-appropriate sparse vocal content';
    const substanceFloor = entry.massClass === 'expansive'
      ? 'minimum substance safety: carry several distinct lexical thought units and real progression; non-lexical parenthesized ad-libs do not satisfy development mass'
      : '';
    return `${index + 1}. ${entry.name} — ${describeV1SectionMass(entry.massClass)}; ${lyricPolicy}; ${entry.lyricRole}${substanceFloor ? `; ${substanceFloor}` : ''}`;
  }).join('\n');
}

function vocalOwnershipInstruction(vocalCount: number): string {
  if (vocalCount <= 1) {
    return `- Solo ownership: keep structural numbering independent from the singer. Every sung or vocal-ad-lib section tag must start with the exact section name and MUST include one short current-song performance cue. A bare sung tag such as [Verse 1] or [Chorus 1] is invalid. Derive the cue from that section's lyric body, role, neighbouring-section contrast, vocal character, and the whole-song [Arrangement] arc. Never output any group-member identity or a singer-first bracket tag. RAP MODE keeps the same solo singer and changes only that section's delivery.`;
  }
  return `- Multi-vocal ownership (${vocalCount} active voices): structural numbers show song chronology, never singer identity. Every tag must start with the exact section name. Use only the exact active anchors declared by the blueprint. [Vocals] and lyric tags must keep the same gender + letter + current role identity, for example [Verse 1 : Male A Main, conversational] or [Rap Section 1 : Male D Rap, tight flow]. Never reverse this into [Male A Main : Conversational Verse].
- Every declared A/B/C/D voice must own at least one meaningful lead, answer, overlap, or harmony moment outside an All Voices tag. Do not let one valid voice occupy the entire song while the other selected voices disappear.
- Put the singer anchor first and one short current-song performance cue second. Every sung or vocal-ad-lib section requires both a valid active anchor and a valid performance cue; an anchor-only or bare structural tag is invalid. Do not repeat the full character description from [Vocals] in every lyric tag.
- Do not create Verse A/B/C, Verse 1A/1B, Chorus 2A/2B, or similar singer-based section names in Recommended, Stable, or Experimental mode. Keep one structural tag and describe the interaction inside it. Custom mode keeps user-created nonstandard names, while standard chronological families remain numbered.
- A real instrument, ambience, foley, environmental sound, or effect must be a standalone square-bracket cue below the structural tag. A parenthesized non-lexical human sound is a vocal ad-lib/humming gesture, not a sound effect. It is optional and must not be inserted as a routine Intro/Outro filler.
- Never leak singer instructions into the lyric body as (Male A Main), (Female D Sub), or similar parenthetical text.`;
}

export function buildV1AdaptiveLyricFlowInstruction(
  blueprint: V1SectionBlueprint,
  params: V1SectionEngineParams,
): string {
  const lyricAllowed = blueprint.entries.filter((entry) => entry.allowsLyrics).length;
  const lyricRequired = blueprint.entries.filter((entry) => entry.requiresLyrics).length;
  const lyricFree = blueprint.entries.filter((entry) => !entry.allowsLyrics).length;
  const optional = Math.max(0, lyricAllowed - lyricRequired);
  const tempoText = String(params.tempo || '').trim() || 'not explicitly fixed';
  const lengthMode = String(params.lyricsLength || 'normal');

  return `V1 SECTION ROLE & ADAPTIVE LYRIC MASS PLAN (MANDATORY, DO NOT OUTPUT THIS LABEL):
- Selected overall length mode: ${lengthMode}. Tempo input: ${tempoText}. Blueprint contains ${lyricRequired} required sung sections, ${optional} optional/sparse vocal sections, and ${lyricFree} lyric-free sections.
- Do not use fixed line counts, syllable quotas, character quotas, or a genre-name lyric-density table. Judge every section relative to the other sections in this exact song.
- First decide the song's natural verbal density from tempo articulation, melodic sustain, rhythmic speech load, hook repetition, arrangement space, Story Context, and vocal formation. Then distribute that mass according to each section's structural role.
- The minimum-substance safety is not a fixed line quota. It only prevents an expansive development slot from collapsing into one non-lexical ad-lib plus one or two fragmentary lyric lines. Two long, meaningful lines may carry enough substance; several short but distinct lines may also carry enough substance.
- Parenthesized non-lexical humming or ad-libs may support performance when specifically justified, but they do not count as the concrete scene/action/desire progression required from Verse, Rap Section, or another expansive development slot.
- Tempo is a phrasing constraint, not a word-count multiplier. Fast music may use short rapid fragments or spacious chants; slow music may use sparse held notes or detailed storytelling.
- Verse and Rap Section are the main homes for new information. Pre-Chorus and Build-Up compress and raise pressure. Chorus and Hook preserve the memorable center. Refrain is a brief recurring phrase identity, not another Verse. Bridge changes viewpoint or meaning. Drop releases; Breakdown strips back; Outro closes.
- Structures with many Break, Stop, Instrumental, Interlude, Drop, Breakdown, or Theme spaces must not become accidentally incomplete. When the selected overall length calls for fuller storytelling, move genuine new substance into Verse, Rap Section, Bridge, Theme, or another development-capable role instead of padding every section.
- Do not compensate for lyric-free space by copying Chorus/Hook bodies, overfilling Intro or Outro, or converting production cues into lyrics.
- Repeated sections obey identity rules: later Verse/Rap advances; later Chorus/Hook returns the recognisable core with purposeful variation; later Refrain returns the same brief phrase identity.
${vocalOwnershipInstruction(blueprint.vocalCount)}
SECTION ROLE / RELATIVE MASS MAP:
${sectionLoadLines(blueprint)}`;
}

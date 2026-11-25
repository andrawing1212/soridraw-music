// Display-only projection. Never pass this value to generation, history or storage.
// The generated grammar treats standalone square-bracket lines as arrangement cues;
// known structural and singer labels remain, including translated structural labels.
const section = /^(?:(?:final\s+)?(?:chorus|hook)|verse|pre[-\s]?chorus|post[-\s]?chorus|refrain|rap(?:\s+(?:section|verse))?|bridge|intro|opening|outro|ending|build[-\s]?up|drop|break(?:down)?|stop|pause|instrumental(?:\s+opening)?|interlude|(?:guitar|drum|bass|piano|saxophone)\s+solo|drum\s+break|solo|theme\s+[ab]|main\s+theme|climax|couplet|pré[-\s]?refrain|refrain\s+final|pont|introduction|intermède|conclusion|estrofa|verso|pre[-\s]?coro|coro(?:\s+final)?|puente|introducción|interludio|final|strophe|refrain|vorrefrain|brücke|zwischenspiel|schluss|schlussrefrain|куплет|припев|предприпев|бридж|вступление|проигрыш|финальный припев|финал|主歌|副歌|预副歌|前副歌|橋段|桥段|前奏|间奏|間奏|尾奏|最终副歌|最終副歌|ヴァース|バース|サビ|プレコーラス|コーラス|ブリッジ|イントロ|アウトロ|間奏|ラストサビ|ท่อนร้อง|ท่อนฮุก|ท่อนก่อนฮุก|ท่อนเชื่อม|บทนำ|ท่อนจบ|ท่อนดนตรี|인트로|벌스|프리\s?코러스|코러스|후렴|브리지|아웃트로|간주|전주|절|후렴구)(?:\s*(?:\d+|[a-z]))?$/iu;
const singer = /^(?:(?:male|female|vocal)\s+[a-z](?:\s+(?:male|female))?(?:\s+(?:main|lead|sub|rap|rapper)(?:\/(?:main|lead|sub|rap|rapper))*)?|(?:male|female)\s+(?:main|lead|sub|rap|rapper)|(?:main|lead|sub|rap|rapper)\s+vocal|all(?:\s+(?:male|female))?\s+voices|together|duet|group|solo|voice\s+[a-z])$/i;

export function lyricCueCustomSectionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item?.section === 'string' ? [item.section] : []);
}

// Custom section names are accepted when explicitly supplied by the song.
export function projectLyricCues(value: string, showCues: boolean, customNames: readonly string[] = []): string {
  if (showCues) return value;
  const names = new Set(customNames.map(name => name.trim().toLowerCase()).filter(Boolean));
  return value.split(/\r?\n/).flatMap(line => {
    // Inline brackets and parenthesized sung ad-libs are never stripped.
    const tag = line.trim().match(/^\[([^\]\n]+)\]$/);
    if (!tag) return [line];
    const [rawName, ...cueParts] = tag[1].split(/[:：]/);
    const name = rawName.trim();
    if (section.test(name) || names.has(name.toLowerCase()) || names.has(name.toLowerCase().replace(/\s+\d+$/, ''))) {
      const owners = cueParts.join(':').split(/[,;＋+&]/).map(part => part.trim()).filter(part => singer.test(part));
      return ['[' + name + (owners.length ? ': ' + owners.join(', ') : '') + ']'];
    }
    if (singer.test(name)) return ['[' + name + ']'];
    // Unknown colon-bearing headers may be user-defined structural sections.
    // Preserve the label rather than hiding their section boundary.
    if (cueParts.length) {
      if (/^(?:sound effect|sfx|fx|instrument(?:al)? cue|production cue|vocal cue|효과음|악기 큐|보컬 큐|effet sonore|effets sonores|guitar|bass|drums?|synths?|piano|strings?|percussion|guitare|basse|batterie|synthétiseurs?|guitarra|batería|bajo|드럼|기타|베이스|신스|피아노)$/iu.test(name)) return [];
      return ['[' + name + ']'];
    }
    return [];
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

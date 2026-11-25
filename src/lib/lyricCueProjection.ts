// Display-only projection. Never pass this value to generation, history or storage.
// The generated grammar treats standalone square-bracket lines as arrangement cues;
// known structural and singer labels remain, including translated structural labels.
const section = /^(?:(?:final\s+)?(?:chorus|hook)|verse|pre[-\s]?chorus|post[-\s]?chorus|refrain|rap(?:\s+(?:section|verse))?|bridge|intro|opening|outro|ending|build[-\s]?up|drop|break(?:down)?|stop|pause|instrumental(?:\s+opening)?|interlude|(?:guitar|drum|bass|piano|saxophone)\s+solo|drum\s+break|solo|theme\s+[ab]|main\s+theme|climax|couplet|pré[-\s]?refrain|refrain\s+final|pont|introduction|intermède|conclusion|estrofa|verso|pre[-\s]?coro|coro(?:\s+final)?|puente|introducción|interludio|final|strophe|refrain|vorrefrain|brücke|zwischenspiel|schluss|schlussrefrain|куплет|припев|предприпев|бридж|вступление|проигрыш|финальный припев|финал|主歌|副歌|预副歌|前副歌|橋段|桥段|前奏|间奏|間奏|尾奏|最终副歌|最終副歌|ヴァース|バース|サビ|プレコーラス|コーラス|ブリッジ|イントロ|アウトロ|間奏|ラストサビ|ท่อนร้อง|ท่อนฮุก|ท่อนก่อนฮุก|ท่อนเชื่อม|บทนำ|ท่อนจบ|ท่อนดนตรี|인트로|벌스|프리\s?코러스|코러스|후렴|브리지|아웃트로|간주|전주|절|후렴구)(?:\s*(?:\d+|[a-z]))?$/iu;
const singer = /^(?:(?:male|female|vocal)\s+[a-z](?:\s+(?:male|female))?(?:\s+(?:main|lead|sub|rap|rapper)(?:\/(?:main|lead|sub|rap|rapper))*)?|(?:male|female)\s+(?:main|lead|sub|rap|rapper)|(?:main|lead|sub|rap|rapper)\s+vocal|all(?:\s+(?:male|female))?\s+voices|together|duet|group|solo|voice\s+[a-z])$/i;

export function lyricCueCustomSectionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item?.section === 'string' ? [item.section] : []);
}


// Standard structural labels only. Do not translate arbitrary brackets, lyrics,
// production cues, or user-created names. Number within each actual lyric card.
const sectionAliases: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Intro',['Intro','Opening','Introduction','Introducción','Einleitung','Вступление','前奏','イントロ','บทนำ','인트로','전주']],
  ['Verse',['Verse','Couplet','Estrofa','Verso','Strophe','Куплет','主歌','ヴァース','バース','Aメロ','ท่อนร้อง','벌스','절']],
  ['Pre-Chorus',['Pre-Chorus','Pre Chorus','Prechorus','Pré-refrain','Pre-refrain','Pré refrain','Pre-Coro','Precoro','Pre Coro','Vorrefrain','Предприпев','Пре-припев','预副歌','前副歌','預副歌','プレコーラス','Bメロ','ท่อนก่อนฮุก','프리코러스','프리 코러스']],
  ['Chorus',['Chorus','Chorus Response','Coro','Estribillo','Припев','副歌','サビ','コーラス','ท่อนฮุก','코러스','후렴','후렴구']],
  ['Final Chorus',['Final Chorus','Refrain final','Coro final','Estribillo final','Schlussrefrain','Финальный припев','Последний припев','最终副歌','最終副歌','ラストサビ','最後のサビ','마지막 후렴','최종 후렴']],
  ['Hook',['Hook','Gancho','Хук','フック','훅']],
  ['Final Hook',['Final Hook','Gancho final','Финальный хук','最後のフック','마지막 훅']],
  ['Refrain',['Refrain']],
  ['Rap Section',['Rap Section','Rap Verse','Rap','Partie rap','Sección de rap','Rap-Teil','Рэп','ラップ','랩','랩 섹션']],
  ['Bridge',['Bridge','Pont','Puente','Brücke','Бридж','橋段','桥段','ブリッジ','ท่อนเชื่อม','브리지']],
  ['Post-Chorus',['Post-Chorus','Post Chorus','Postchorus','Post-refrain','Post-coro','후렴 후']],
  ['Build-Up',['Build-Up','Build Up','Buildup','Montée','Subida','Aufbau','Нарастание','빌드업']],
  ['Drop',['Drop','ドロップ','드롭']],
  ['Breakdown',['Breakdown','ブレイクダウン','브레이크다운']],
  ['Break',['Break','Pause musicale','브레이크']],
  ['Stop',['Stop','Pause','정지']],
  ['Instrumental',['Instrumental','Instrumental Opening','Instrumental intro','Instrumental section','Instrumentalteil','Инструментал','纯音乐','純音楽','インスト','ท่อนดนตรี','연주','연주부']],
  ['Interlude',['Interlude','Intermède','Interludio','Zwischenspiel','Проигрыш','间奏','間奏','간주']],
  ['Theme A',['Theme A']],['Theme B',['Theme B']],['Main Theme',['Main Theme']],['Climax',['Climax']],
  ['Outro',['Outro','Ending','Conclusion','Final','Schluss','Coda','Finale','Финал','尾奏','アウトロ','ท่อนจบ','아웃트로','아웃로','마무리']],
];
const sectionKey = (name:string) => name.normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const canonicalSections = new Map(sectionAliases.flatMap(([canonical, aliases]) => aliases.map(alias => [sectionKey(alias),canonical] as const)));
const isFrenchOrGerman = (language:string) => /^(?:fr|french|français|de|german|deutsch)(?:$|[.\s])/i.test(language.trim());

function canonicalSectionLabel(name:string, language:string, names:ReadonlySet<string>): string | undefined {
  const key=sectionKey(name);
  const base=key.replace(/\s*\d+$/,'').trim();
  if ((names.has(key)||names.has(base)) && !canonicalSections.has(base)) return undefined;
  if (base==='refrain' && isFrenchOrGerman(language) && !names.has('refrain')) return 'Chorus';
  const exact=canonicalSections.get(base);
  if (exact) return exact;
  const letterBase=base.replace(/\s+[a-z]$/,'');
  const family=canonicalSections.get(letterBase);
  return family && /^(?:Verse|Pre-Chorus|Chorus|Hook|Refrain|Rap Section|Bridge|Post-Chorus)$/.test(family) ? family : undefined;
}

export function normalizeLyricSectionTags(value:string, customNames:readonly string[] = [], language=''):string {
  const names=new Set(customNames.map(sectionKey).filter(Boolean));
  const lines=value.split('\n');
  const parsed=lines.map(line=>{
    const match=line.match(/^(\s*)\[([^\]:：\n]+)((?:[:：][^\]\n]*)?)\](\s*)$/);
    if(!match)return undefined;
    const canonical=canonicalSectionLabel(match[2],language,names);
    return canonical ? {match,canonical} : undefined;
  });
  const total=new Map<string,number>();
  for(const tag of parsed)if(tag)total.set(tag.canonical,(total.get(tag.canonical)||0)+1);
  const seen=new Map<string,number>();
  return lines.map((line,index)=>{
    const tag=parsed[index];
    if(!tag)return line;
    const n=(seen.get(tag.canonical)||0)+1;
    seen.set(tag.canonical,n);
    const label=tag.canonical+((total.get(tag.canonical)||0)>1?' '+n:'');
    return tag.match[1]+'['+label+tag.match[3]+']'+tag.match[4];
  }).join('\n');
}

// Custom section names are accepted when explicitly supplied by the song.
export function projectLyricCues(value: string, showCues: boolean, customNames: readonly string[] = [], language = ''): string {
  value = normalizeLyricSectionTags(value,customNames,language);
  if (showCues) return value;
  const names = new Set(customNames.map(name => name.trim().toLowerCase()).filter(Boolean));
  return value.split(/\r?\n/).flatMap(line => {
    // Inline brackets and parenthesized sung ad-libs are never stripped.
    const tag = line.trim().match(/^\[([^\]\n]+)\]$/);
    if (!tag) return [line];
    const [rawName, ...cueParts] = tag[1].split(/[:：]/);
    const name = rawName.trim();
    if (canonicalSectionLabel(name,'',names) || section.test(name) || names.has(name.toLowerCase()) || names.has(name.toLowerCase().replace(/\s+\d+$/, ''))) {
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

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/App.tsx','utf8');
function section(from,to){
  const i=src.indexOf(from),j=src.indexOf(to,i+from.length);
  assert(i>=0&&j>i,from+' section not found');
  return src.slice(i,j);
}
function predicate(text,name){
  const prefix='const '+name+' =',i=text.indexOf(prefix);
  assert(i>=0,name+' predicate missing');
  const j=text.indexOf(';',i);
  assert(j>i);
  const expr=text.slice(i+prefix.length,j).trim();
  return vars=>Boolean(new Function(...Object.keys(vars),'return ('+expr+');')(...Object.values(vars)));
}
const global=predicate(src,'isGlobalClearable');
const defaults={
  selectedGenres:[],subGenre:[],selectedMoods:[],selectedThemes:[],selectedStyles:[],selectedInstrumentSounds:[],selectedPointSounds:[],
  userInput:'',lyricsLength:'normal',lyricWritingStyle:'default',songStructure:'1',customStructure:[],
  sectionVocalCueEnabled:true,sectionInstrumentCueEnabled:true,maleCount:0,femaleCount:0,vocalMode:'solo',
  selectedVocalToneId:undefined,hasNonDefaultStudioVocalMembers:()=>false,vocalMembers:[],rapMode:'auto',
  rapEnabled:false,tempoEnabled:true,minBPM:90,maxBPM:110,citypopMode:0,isGenreRandomized:false,isMoodRandomized:false,
  isThemeRandomized:false,isStyleRandomized:false,isSoundTextureRandomized:false,menuLocks:{}
};
assert.equal(global(defaults),false,'the untouched studio cannot enable global reset');
assert.equal(global({...defaults,rapMode:'off'}),true,'Rap OFF must activate global reset');
assert.equal(global({...defaults,rapMode:'on'}),true,'Rap ON must activate global reset');
assert.equal(global({...defaults,lyricWritingStyle:'kimEana'}),true,'Kim Eana must activate global reset');
const init=section('const RAP_MODE_STORAGE_KEY','const INSTRUMENTAL_BGM_GENRE_IDS');
assert.match(init,/if \(typeof window === 'undefined'\) return 'auto'/);
assert.match(init,/return 'auto';\s*};/);
assert.match(init,/stored === 'auto' \|\| stored === 'off' \|\| stored === 'on'/);
const clearAll=section('const clearAll = useCallback','const deleteHistoryItem');
for(const s of ["setRapMode('auto')","setRapEnabled(false)","setLyricWritingStyle('default')","writeStoredV1LyricWritingStyle('default')"]){
 assert(clearAll.includes(s),'global clear missing '+s);
}
const vocalProps=section('<VocalControl','<SongStructureIntegratedControl');
assert.match(vocalProps,/onClear=\{\(\) => \{[\s\S]*?setRapMode\('auto'\);[\s\S]*?setRapEnabled\(false\);/);
const lyricProps=section('<SongStructureIntegratedControl','<TempoControl');
assert.match(lyricProps,/onClear=\{\(\) => \{[\s\S]*?setLyricWritingStyle\('default'\);[\s\S]*?writeStoredV1LyricWritingStyle\('default'\);/);
const vocal=section('function VocalControlComponent','const VocalControl = React.memo');
const vocalActive=predicate(vocal,'isVocalResettable');
const vocalDefault={maleCount:0,femaleCount:0,vocalMode:'solo',rapMode:'auto',vocalMembers:[],hasNonDefaultStudioVocalMembers:()=>false};
assert.equal(vocalActive(vocalDefault),false);
assert.equal(vocalActive({...vocalDefault,rapMode:'off'}),true);
assert.equal(vocalActive({...vocalDefault,rapMode:'on'}),true);
assert.match(vocal,/isVocalResettable && "soridraw-active-reset-button"/);
const lyrics=section('function SongStructureIntegratedControlComponent','const SongStructureIntegratedControl = React.memo');
const lyricActive=predicate(lyrics,'isLyricsResettable');
const lyricDefault={lyricsLength:'normal',lyricWritingStyle:'default',songStructure:'1',customStructure:[],sectionVocalCueEnabled:true,sectionInstrumentCueEnabled:true};
assert.equal(lyricActive(lyricDefault),false);
assert.equal(lyricActive({...lyricDefault,lyricWritingStyle:'kimEana'}),true);
assert.equal(lyricActive({...lyricDefault,sectionVocalCueEnabled:false}),true);
assert.match(lyrics,/isLyricsResettable && "soridraw-active-reset-button"/);
console.log('STUDIO_RAP_AUTO_AND_KIM_EANA_ALL_MENU_RESETS=PASS');

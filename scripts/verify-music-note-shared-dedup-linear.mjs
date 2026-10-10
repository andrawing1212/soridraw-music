// Execute the real shared-note dedup expression from FavoritesPage.
// Its result must match the original first-occurrence semantics, with
// one key calculation per candidate instead of a quadratic nested scan.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/pages/FavoritesPage.tsx','utf8');
const start = source.indexOf('  const seenSharedNoteDuplicateKeys = new Set<string>();');
const end = source.indexOf('  const runFavoriteServerSearch = async () => {',start);
assert.ok(start>=0&&end>start,'live Music Note shared dedup region missing');
const fragment = source.slice(start,end);
assert.match(fragment,/filteredFavoriteBase\.filter\(\(song\) => \{/);
assert.doesNotMatch(fragment,/\.findIndex\(/,'shared-note duplicate scan is quadratic');
const js = ts.transpileModule(fragment+'\n globalThis.__dedupResult = dedupedFilteredFavorites;',{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None},
}).outputText;
const run = (songs,view,shared) => {
  let calls=0;
  const key = song => { calls++;return song.key; };
  const input=songs.slice();
  const context={
    filteredFavoriteBase:input,
    musicNoteViewMode:view,
    isMusicNoteSharedView:shared,
    getMusicNoteDuplicateKey:key,
    Set,
  };
  runInNewContext(js,context,{timeout:5000});
  return {ids:Array.from(context.__dedupResult,x=>x.id),
    calls,sameArray:context.__dedupResult===input};
};
const legacy = songs => songs.filter((song,index,list) =>
  list.findIndex(item=>item.key===song.key)===index).map(x=>x.id);
const tiny=[
  {id:'first-1',key:'alpha'},
  {id:'other',key:'beta'},
  {id:'later-1',key:'alpha'},
  {id:'blank-1',key:''},
  {id:'blank-2',key:''},
  {id:'other-2',key:'beta'},
  {id:'final',key:'omega'},
];
assert.deepEqual(run(tiny,'sharedNote',false).ids,legacy(tiny));
assert.deepEqual(run(tiny,'noteSpace',false).ids,tiny.map(x=>x.id));
assert.deepEqual(run(tiny,'sharedNote',true).ids,tiny.map(x=>x.id));
assert.equal(run(tiny,'noteSpace',false).sameArray,true,
  'non-shared view should preserve original filtered-array identity');
const many=Array.from({length:2400},(_,i)=>({
  id:'song-'+i,key:i%11===0?'repeat-'+(i%121):'unique-'+i,
}));
const actual=run(many,'sharedNote',false);
assert.deepEqual(actual.ids,legacy(many));
assert.equal(actual.calls,many.length,
  'the shared-note loop must compute one duplicate key per track (linear)');
console.log('MUSIC_NOTE_SHARED_DEDUP_FIRST_OCCURRENCE_IDENTICAL=PASS');
console.log('MUSIC_NOTE_SHARED_DEDUP_2400_ROWS_KEY_CALLS='+actual.calls);
console.log('MUSIC_NOTE_SHARED_DEDUP_NO_DB_READ_WRITE=PASS');

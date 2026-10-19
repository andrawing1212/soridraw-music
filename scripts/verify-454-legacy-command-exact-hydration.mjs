import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('src/lib/musicNoteNextSongRecipe.ts','utf8');
const transpiled=ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={exports:{}};
vm.runInNewContext(transpiled,ctx);
const resolve=ctx.exports.resolveMusicNoteNextSongRecipe;
const existingFullCard={id:'old-one',title:'Saved local song',appliedKeywords:{genre:['indie']}};
const exactHistoricalDocument={
  id:'old-one',title:'Old server title',
  appliedKeywords:{genre:['indie']},
  requestPayload:{appliedKeywords:{commandInput:'Recorded original manual command; do not invent.'},genre:['indie']},
};
const local=resolve(existingFullCard);
const remote=resolve(exactHistoricalDocument);
const merged={...remote,...local};
assert.equal(local.userInput,undefined,'the fully painted local card does not necessarily carry original command');
assert.equal(merged.userInput,'Recorded original manual command; do not invent.');
assert.equal(merged.genre[0],'indie');
assert.equal(resolve({appliedKeywords:{userInput:''},requestPayload:{commandInput:'older command'}}).userInput,'',
 'a deliberately blank newest command cannot be overwritten by an old value');
assert.equal(resolve({requestPayload:{directInput:'genuine direct instructions'}}).userInput,'genuine direct instructions');
assert.ok(!resolve({prompt:'Generated prompt only'}).userInput,'no hallucinated manual command from generated prompt');

const favorite=fs.readFileSync('src/pages/FavoritesPage.tsx','utf8');
assert.match(favorite,/const hydrateCatalogFavorite = async \(song: any, requireStoredRecipe = false\)/);
assert.match(favorite,/if \(requireStoredRecipe\) \{[\s\S]{0,1000}appliedKeywords: \{ \.\.\.sourceRecipe, \.\.\.localRecipe \}/);
assert.match(favorite,/getDoc\(doc\(db, 'favorites', sourceId\)\)/,'one-document exact user-owned hydration');
assert.match(favorite,/hydrateCatalogFavorite\(song, true\)\.then\(\(hydrated\) => applyKeywordsToNext\(hydrated\)\)/);
assert.match(favorite,/hydrateCatalogFavorite\(selectedSong, true\)\.then\(\(hydrated\) => applyKeywordsToNext\(hydrated\)\)/);
assert.doesNotMatch(favorite,/getDocs\(collection\(db, 'favorites'/,'no collection scan');
console.log('APP454_LEGACY_NEXT_SONG_COMMAND_AND_ID_EXACT_DOCUMENT=PASS');
console.log('APP454_OLD_LOCAL_SONG_CAN_FILL_MISSING_COMMAND=PASS');
console.log('APP454_NO_GENERATED_PROMPT_INVENTED=PASS');

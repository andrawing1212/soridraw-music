import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const page=fs.readFileSync('src/pages/ExplorePage.tsx','utf8');
const css=fs.readFileSync('src/components/explore/explore.css','utf8');
const row=page.slice(page.indexOf('function ExploreGenreScrollRow('),page.indexOf('const EXPLORE_RAIL_RELEASE_ALIGN_DELAY_MS_261'));
assert.match(row,/useFolderStripMouseScroll\(\(\) => \{\}, \(\) => false\)/);
assert.match(row,/scrollBy\(\{ left: direction \* 220, behavior: 'smooth' \}\)/);
assert.match(row,/onWheel=\{handleExploreGenreRowWheel342\} \{\.\.\.mouseScroll\}/);
assert.match(row,/moveGenreRow\(-1\)/);
assert.match(row,/moveGenreRow\(1\)/);
assert.match(page,/<ExploreGenreScrollRow label="대분류 장르">/);
assert.match(page,/<ExploreGenreScrollRow label="세부 장르">/);
assert.doesNotMatch(row,/fetch\(|getDoc|setDoc|localStorage/);
assert.match(css,/\.soridraw-explore-genre-scroll-arrow\{display:none[^}]*opacity:0;pointer-events:none/);
assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)\{\s*\.soridraw-explore-genre-scroll-arrow\{display:flex\}/);
assert.match(css,/\.soridraw-explore-genre-scroll-shell:hover>\.soridraw-explore-genre-scroll-arrow/);
assert.match(css,/data-soridraw-mouse-scrolling="true"\]\{scroll-behavior:auto/);
const source=fs.readFileSync('src/lib/folderStripMouseScroll.ts','utf8');
const listeners=new Map();
let timer=0;
const fakeWindow={
 addEventListener:(type,fn)=>listeners.set(type,fn),
 removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
 setTimeout:()=>++timer,clearTimeout:()=>{},
};
const sandbox={exports:{},window:fakeWindow,require:()=>({useEffect:()=>{},useRef:(current)=>({current})})};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const hook=sandbox.exports.useFolderStripMouseScroll(()=>{},()=>false);
const strip={scrollWidth:1000,clientWidth:400,scrollLeft:200,dataset:{}};
const pointer={pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:10,currentTarget:strip};
hook.onPointerDownCapture(pointer);
listeners.get('pointermove')({...pointer,clientX:60,cancelable:true,preventDefault(){}});
assert.equal(strip.scrollLeft,240);
assert.equal(strip.dataset.soridrawMouseScrolling,'true');
listeners.get('pointerup')(pointer);
assert.equal(strip.dataset.soridrawMouseScrolling,undefined);
let blocked=false;
hook.onClickCapture({preventDefault(){blocked=true},stopPropagation(){}});
assert.equal(blocked,true);
hook.onPointerDownCapture(pointer);
listeners.get('pointerup')(pointer);
blocked=false;
hook.onClickCapture({preventDefault(){blocked=true},stopPropagation(){}});
assert.equal(blocked,false);
hook.onPointerDownCapture({...pointer,pointerType:'touch'});
assert.equal(listeners.size,0);
console.log('EXPLORE_GENRE_HOVER_ARROWS_AND_MOUSE_DRAG_CLICK_GUARD=PASS');

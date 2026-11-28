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
assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)\{\s*\.soridraw-explore-genre-scroll-shell\[data-overflow="true"\]>\.soridraw-explore-genre-scroll-arrow\{display:flex\}/);
assert.match(css,/\.soridraw-explore-genre-scroll-shell\[data-overflow="true"\]:hover>\.soridraw-explore-genre-scroll-arrow/);
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

const holdSource=fs.readFileSync('src/lib/exploreArrowHoldScroll.ts','utf8');
assert.match(row,/bindGenreArrowHold\(-1\)/);
assert.match(row,/bindGenreArrowHold\(1\)/);
assert.match(page,/bindRailArrowHold\(-1\)[\s\S]*?onClick=\{\(\) => moveRail\(-1, 'viewport'\)\}/);
assert.match(page,/bindRailArrowHold\(1\)[\s\S]*?onClick=\{\(\) => moveRail\(1, 'viewport'\)\}/);
const timers=new Map(), frames=new Map(), events=new Map(), docEvents=new Map();
let seq=0, starts=0, ends=0;
const win={
 setTimeout(fn){timers.set(++seq,fn);return seq},clearTimeout(id){timers.delete(id)},
 requestAnimationFrame(fn){frames.set(++seq,fn);return seq},cancelAnimationFrame(id){frames.delete(id)},
 addEventListener(k,fn){events.set(k,fn)},removeEventListener(k,fn){if(events.get(k)===fn)events.delete(k)},
};
const doc={hidden:false,addEventListener(k,fn){docEvents.set(k,fn)},removeEventListener(k,fn){if(docEvents.get(k)===fn)docEvents.delete(k)}};
let cleanup;
const holdSandbox={exports:{},window:win,document:doc,require:()=>({useRef:current=>({current}),useEffect:fn=>{cleanup=fn()}})};
vm.runInNewContext(ts.transpileModule(holdSource,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,holdSandbox);
const scroll={scrollWidth:1500,clientWidth:500,scrollLeft:200,isConnected:true,style:{scrollBehavior:'smooth',scrollSnapType:'x proximity'}};
const bind=holdSandbox.exports.useExploreArrowHoldScroll({current:scroll},{onStart(){starts++},onEnd(){ends++}});
const right=bind(1),left=bind(-1);
const down={button:0,isPrimary:true,pointerId:1,currentTarget:{disabled:false}};
const up=()=>events.get('pointerup')?.({pointerId:1});
const fireTimer=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn()};
const fireFrame=t=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(t)};
const click=()=>{let blocked=false;right.onClickCapture({detail:1,preventDefault(){blocked=true},stopPropagation(){}});return blocked};
right.onPointerDown(down);up();assert.equal(timers.size,0);assert.equal(click(),false);assert.equal(starts,0);
right.onPointerDown(down);fireTimer();assert.equal(scroll.style.scrollSnapType,'none');fireFrame(0);fireFrame(20);fireFrame(40);assert.equal(scroll.scrollLeft,220.8);assert.equal(starts,1);up();assert.equal(frames.size,0);assert.equal(scroll.style.scrollBehavior,'smooth');assert.equal(scroll.style.scrollSnapType,'x proximity');assert.equal(ends,1);assert.equal(click(),true);
left.onPointerDown(down);fireTimer();fireFrame(0);fireFrame(20);assert.ok(Math.abs(scroll.scrollLeft-210.4)<.00001);events.get('pointercancel')({pointerId:1});assert.equal(frames.size,0);assert.equal(events.size,0);assert.equal(docEvents.size,0);
scroll.scrollLeft=999;right.onPointerDown(down);fireTimer();fireFrame(0);fireFrame(20);assert.equal(scroll.scrollLeft,1000);assert.equal(frames.size,0);up();assert.equal(click(),true);
right.onPointerDown(down);fireTimer();events.get('blur')();assert.equal(frames.size,0);assert.equal(events.size,0);
left.onPointerDown(down);fireTimer();cleanup();assert.equal(frames.size,0);assert.equal(events.size,0);assert.equal(scroll.style.scrollSnapType,'x proximity');
console.log('EXPLORE_ALL_ARROW_SINGLE_CLICK_AND_CONSTANT_HOLD_SCROLL=PASS');

assert.match(row,/data-overflow=\{hasOverflow \? 'true' : undefined\}/);
assert.match(row,/observer\.observe\(shell\)/);
assert.match(row,/observer\.observe\(row\)/);
assert.match(row,/Array\.from\(row\.children\)\.forEach\(chip => observer\.observe\(chip\)\)/);
assert.match(row,/return \(\) => observer\.disconnect\(\)/);
const layoutSource=row.slice(row.indexOf('  useLayoutEffect(() => {'),row.indexOf('  const moveGenreRow'));
const fakeShell={clientWidth:800};
const fakeRow={scrollWidth:500,clientWidth:800,children:[{},{}]};
const overflowStates=[],observed=[];
let resizeCallback,disconnected=false,overflowCleanup;
const overflowSandbox={
 shellRef:{current:fakeShell},rowRef:{current:fakeRow},
 setHasOverflow:value=>overflowStates.push(value),
 useLayoutEffect:fn=>{overflowCleanup=fn()},children:[],
 ResizeObserver:class {constructor(fn){resizeCallback=fn}observe(el){observed.push(el)}disconnect(){disconnected=true}},
};
vm.runInNewContext(layoutSource,overflowSandbox);
assert.equal(overflowStates.at(-1),false); // few chips, wide viewport
fakeRow.scrollWidth=900;resizeCallback();assert.equal(overflowStates.at(-1),true); // more chips
fakeRow.clientWidth=756;fakeRow.scrollWidth=780;resizeCallback();assert.equal(overflowStates.at(-1),false); // fits full width even though arrows reduce it
fakeShell.clientWidth=600;resizeCallback();assert.equal(overflowStates.at(-1),true); // narrower split
fakeShell.clientWidth=780;resizeCallback();assert.equal(overflowStates.at(-1),false); // exactly fits
fakeShell.clientWidth=1200;fakeRow.scrollWidth=1200;resizeCallback();assert.equal(overflowStates.at(-1),false);
assert.equal(observed.length,4);overflowCleanup();assert.equal(disconnected,true);
console.log('EXPLORE_GENRE_ARROWS_ONLY_WHEN_FULL_SHELL_OVERFLOWS=PASS');

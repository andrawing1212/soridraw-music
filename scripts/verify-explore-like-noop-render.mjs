// Execute the actual app's change-only functions instead of a copied
// algorithm. Ensures React sees stable references on unrelated heart signals.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/pages/ExplorePage.tsx','utf8');
function functionFromSource(begin,end,object){
 const start=source.indexOf(begin);
 assert(start>0,'source definition not found '+begin);
 const finish=source.indexOf(end,start);
 assert(finish>start,'source definition end not found '+end);
 const body=source.slice(start,finish);
 const code=ts.transpileModule(body+'\nglobalThis.extracted = '+begin.split(' = ')[0].replace('const ','').trim()+';',
   {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const ctx={...object};vm.runInNewContext(code,ctx,{timeout:2000});
 return ctx.extracted;
}
const unchanged=[{id:'a',ownerUid:'x',likeCount:3},{id:'b',ownerUid:'y',likeCount:0}];
let settled=new Map([['missing',1]]);
let patch=functionFromSource('const patchPublicCounts192 = ','\n            setTracks(',{settled});
assert.strictEqual(patch(unchanged),unchanged,'unknown signal must NOT re-render');
settled=new Map([['a',3]]);
patch=functionFromSource('const patchPublicCounts192 = ','\n            setTracks(',{settled});
assert.strictEqual(patch(unchanged),unchanged,'already applied count must NOT re-render');
settled=new Map([['a',4]]);
patch=functionFromSource('const patchPublicCounts192 = ','\n            setTracks(',{settled});
const changed=patch(unchanged);
assert.notStrictEqual(changed,unchanged);
assert.equal(changed[0].likeCount,4);assert.strictEqual(changed[1],unchanged[1]);
let remote=functionFromSource('const patchRemotePair129 = ','\n        setTracks(',{
 detail:{trackId:'missing'},pair129:{likeCount:5}});
assert.strictEqual(remote(unchanged),unchanged,'irrelevant remote like must preserve array');
remote=functionFromSource('const patchRemotePair129 = ','\n        setTracks(',{
 detail:{trackId:'a'},pair129:{likeCount:3}});
assert.strictEqual(remote(unchanged),unchanged,'same count must preserve array');
remote=functionFromSource('const patchRemotePair129 = ','\n        setTracks(',{
 detail:{trackId:'a'},pair129:{likeCount:0}});
assert.equal(remote(unchanged)[0].likeCount,0,'zero count remains valid');
const first=source.indexOf('const publicLikeVisibleTracksMap192 = useMemo(');
const last=source.indexOf('publicLikeVisibleTracksRef192.current = publicLikeVisibleTracksMap192;',first);
assert(first>0 && last>first,'memoized index source missing');
assert(!source.slice(first,last).includes('.filter('),'memo index should not allocate six-list filter');
const snippet=source.slice(first,last)+'globalThis.memoResult=publicLikeVisibleTracksMap192;';
let factoryRuns=0,priorInputs=null,priorResult=null;
const useMemo=(f,inputs)=>{
 if(priorInputs?.length===inputs.length&&priorInputs.every((v,i)=>v===inputs[i]))return priorResult;
 factoryRuns++;priorInputs=inputs;priorResult=f();return priorResult;
};
const lists=[[{id:'a',ownerUid:'x'}],[{id:'b',ownerUid:'y'}],[],[],[],[]];
const runMemo=()=>{
 const context={useMemo,tracks:lists[0],popularTracks:lists[1],
 curatedTracks307:lists[2],managedCuratedTracks307:lists[3],
 profileTracks:lists[4],profileLikedTracks:lists[5],Map};
 const transpiled=ts.transpileModule(snippet,{compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInNewContext(transpiled,context,{timeout:2000});
 return context.memoResult;
};
const value=runMemo();
for(let i=0;i<200;i++)assert.strictEqual(runMemo(),value);
assert.equal(factoryRuns,1,'200 unrelated renders must not rescan all loaded tracks');
lists[0]=[...lists[0],{id:'c',ownerUid:'z'}];
assert.equal(runMemo().get('c'),'z');
assert.equal(factoryRuns,2);
console.log('EXPLORE_MEMOIZED_VISIBLE_INDEX_200_UNRELATED_RENDERS=PASS');
console.log('EXPLORE_R2_REMOTE_LIKE_NOOP_RENDERS_AVOIDED=PASS');
console.log('EXPLORE_CHANGED_COUNT_AND_ZERO_COUNT_PRESERVED=PASS');

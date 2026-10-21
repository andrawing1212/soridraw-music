import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/services/versionSignalService.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const values=new Map(),remoteSources=new Set();
let fetches=0,observer=null,events=[];
const param='soridraw_split_frame_preview_v1';
const storage=new Map([['soridraw_stage5_rc_bootstrap_complete_v1','true']]);
const localStorage={
  getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),
};
const win={
  location:{hostname:'preview.soridraw.com'},
  dispatchEvent:e=>events.push(e),
};
class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
const rc={settings:{minimumFetchIntervalMillis:43200000,fetchTimeoutMillis:10000},defaultConfig:{}};
const firebase={
  activate:async()=>true,
  ensureInitialized:async()=>{},
  fetchAndActivate:async()=>{
    fetches++;
    assert.equal(rc.settings.minimumFetchIntervalMillis,0,'one-time Studio bootstrap bypasses stale 12h RC cache');
    values.set(param,'{"mode":"pure-pane","revision":5}');
    remoteSources.add(param);
    return true;
  },
  getRemoteConfig:()=>rc,
  getString:(_rc,key)=>values.get(key)??rc.defaultConfig[key]??'',
  getValue:(_rc,key)=>({getSource:()=>remoteSources.has(key)?'remote':'default'}),
  isSupported:async()=>true,
  onConfigUpdate:(_rc,callback)=>{observer=callback;return()=>{};},
};
const exported={};
vm.runInNewContext(compiled,{
 exports:exported,require:k=>{
  if(k==='../firebase')return{};
  if(k==='firebase/app')return{getApp:()=>({})};
  if(k==='firebase/remote-config')return firebase;
  throw Error('unexpected import '+k);
 },localStorage,window:win,CustomEvent,console,
});
await exported.startPreviewVersionSignal();
assert.equal(exported.readSplitFrameRemoteState().mode,'pure-pane-hybrid');
assert.equal(exported.readSplitFrameRemoteState().ready,false,
  'old app version bootstrap cannot be treated as server-confirmed new setting');
await exported.ensureSplitFrameRemoteBootstrap();
assert.equal(fetches,1);
assert.equal(exported.readSplitFrameRemoteState().mode,'pure-pane');
assert.equal(exported.readSplitFrameRemoteState().revision,5);
assert.equal(exported.readSplitFrameRemoteState().ready,true);
await exported.ensureSplitFrameRemoteBootstrap();
assert.equal(fetches,1,'Studio reentry must not refetch if RC holds actual server value');
exported.publishConfirmedSplitFrameRemote('local-responsive',6);
assert.equal(exported.readSplitFrameRemoteState().revision,6);
await exported.ensureSplitFrameRemoteBootstrap();
assert.equal(exported.readSplitFrameRemoteState().mode,'local-responsive');
assert.equal(exported.readSplitFrameRemoteState().revision,6,
  'local stale cached RC rev5 must never undo Master-confirmed rev6');
values.set(param,'{"mode":"pure-pane-hybrid","revision":7}');
observer.next({getUpdatedKeys:()=>new Set([param])});
for(let i=0;i<6;i++)await Promise.resolve();
assert.equal(exported.readSplitFrameRemoteState().revision,7);
assert.equal(exported.readSplitFrameRemoteState().mode,'pure-pane-hybrid');
assert.ok(events.some(e=>e.type===exported.SPLIT_FRAME_REMOTE_EVENT && e.detail.revision===7));
const panel=readFileSync('src/components/MasterSplitFramePanel.tsx','utf8');
assert.match(panel,/action: 'read'/);
assert.match(panel,/readSavedSetting/);
assert.match(panel,/setServerReady\(false\)/);
assert.match(panel,/publishConfirmedSplitFrameRemote\(result\.data\.mode, result\.data\.revision\)/);
assert.match(panel,/receiveConfirmed\(value\.mode, value\.revision\)/);
console.log('451_STALE_V1_BOOTSTRAP_GUEST_STUDIO_REENTRY_PERSISTENCE=PASS');
console.log('451_MASTER_SERVER_GET_CONFIRMS_READ_BEFORE_APPLY=PASS');
console.log('451_OLD_REMOTE_CONFIG_CACHE_CANNOT_UNDO_NEWER_APPLIED_REVISION=PASS');
console.log('451_STUDIO_REENTRY_WITH_UNCHANGED_REMOTE_CONFIG_FETCHES_0=PASS');

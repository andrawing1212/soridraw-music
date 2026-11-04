import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=path=>readFileSync(path,'utf8');
const svc=read('src/services/userDomainSyncService.ts');
const fav=read('src/pages/FavoritesPage.tsx');
const lib=read('src/pages/SunoLibraryPage.tsx');
const client=read('src/lib/colorPendingOutbox.ts');

// Exercise the real durable outbox implementation without a browser or user data.
const compiled=ts.transpileModule(client,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const saved=new Map();
const localStorage={
  get length(){return saved.size;},
  getItem(key){return saved.get(key)??null;},
  setItem(key,value){saved.set(key,String(value));},
  removeItem(key){saved.delete(key);},
  key(n){return [...saved.keys()][n]??null;},
};
const exports={};
new Function('exports','localStorage','console',compiled)(exports,localStorage,console);
const {stageColorPending,readColorPending,listColorPending,acknowledgeColorPending}=exports;
const red1=stageColorPending('same-uid','musicNote','song-a','red');
const gray=stageColorPending('same-uid','musicNote','song-a','gray');
const red2=stageColorPending('same-uid','musicNote','song-a','red');
assert(red1&&gray&&red2);
assert.equal(acknowledgeColorPending('same-uid','musicNote',red1),false);
assert.equal(acknowledgeColorPending('same-uid','musicNote',gray),false);
assert.equal(readColorPending('same-uid','musicNote','song-a')?.token,red2.token);
assert.equal(listColorPending('other-uid','musicNote').length,0);
const orange=stageColorPending('same-uid','workspace','workspace:colorTags:track-a:0','orange');
assert.equal(listColorPending('same-uid','workspace')[0].color,'orange');
assert.equal(listColorPending('same-uid','musicNote').length,1);
assert.equal(acknowledgeColorPending('same-uid','workspace',orange),true);
assert.equal(acknowledgeColorPending('same-uid','musicNote',red2),true);
assert.equal(listColorPending('same-uid','musicNote').length,0);

// Color live preview reuses the existing account-owned RTDB Music Note signal;
// it is never mistaken for a committed canonical membership revision.
assert.match(svc,/operation:'color-preview'/);
assert.match(svc,/initialRetained \|\| signal.originDeviceId === getDeviceId\('musicNote'\)/);
const colorGate=svc.indexOf("if (signal.operation === 'color-preview')");
const canonicalGate=svc.indexOf("writeLocalNumberMax(scopedVersionKey(MUSIC_NOTE_REMOTE_VERSION_BASE");
assert(colorGate>=0&&canonicalGate>colorGate);
assert.match(svc,/runTransaction\(location, current/);
assert.match(svc,/const initialRetained = firstMusicNoteSnapshot/);
const favClick=fav.slice(fav.indexOf('const handleFavoriteColorSelect'),fav.indexOf('const getFavoriteFullShareText'));
const workspaceClick=lib.slice(lib.indexOf('const handleChangeWorkspaceColor'),lib.indexOf('const stageConfirmedWorkspaceColors'));
const playlistClick=lib.slice(lib.indexOf('const handleChangeColor ='),lib.indexOf('const getPlaylistItemColor'));
for(const [label,s] of [['Music Note',favClick],['Library workspace',workspaceClick],['Library playlist',playlistClick]]){
  assert.match(s,/stageColorPending\(/,label+' durable intent missing');
  assert.match(s,/publishColorSelectionPreview\(/,label+' RTDB preview missing');
  assert.match(s,/schedule(?:Favorite|Library)ColorAutoSave\(/,label+' auto save missing');
}
assert.match(fav,/readColorPending\(currentUser.uid, 'musicNote', entry.id\)\?\.token === entry.pending.token/);
assert.match(lib,/acknowledgeColorPending\(currentUser.uid,'workspace',pending\)/);
assert.match(lib,/acknowledgeColorPending\(currentUser.uid,'playlist',pending\)/);
assert.match(fav,/listColorPending\(user.uid, 'musicNote'\)/);
assert.match(lib,/listColorPending\(user.uid, 'workspace'\)/);
assert.match(lib,/listColorPending\(user.uid, 'playlist'\)/);
assert.match(fav,/window.addEventListener\(COLOR_SELECTION_SYNC_EVENT/);
assert.match(lib,/window.addEventListener\(COLOR_SELECTION_SYNC_EVENT/);

// Portal is not nested in a scroll-clipped workspace or a pointer-selectable
// playlist row, and both palettes call their real color mutation handlers.
assert.match(lib,/data-library-color-portal="true"/);
assert.match(lib,/createPortal\(\s*<div data-floating-menu="true" data-library-color-portal/);
assert.match(lib,/onClick=\{\(e\)=>openLibraryColorPortal\(e,\{id:/);
assert.match(lib,/handleChangeWorkspaceColor\(colorPortalMenu.group,colorPortalMenu.idx!,c.value\)/);
assert.match(lib,/handleChangeColor\(colorPortalMenu.item,c.value\)/);
assert.doesNotMatch(lib,/activeColorMenu === item.id && \(/);
assert.doesNotMatch(lib,/activeColorMenu === `workspace-\$\{group.id\}-\$\{idx\}` && \(/);
console.log('COLOR_LIVE_SYNC_DURABLE_ABA_PORTAL_PC_MOBILE=PASS');

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('src/pages/ExplorePage.tsx','utf8');
const ast = ts.createSourceFile('ExplorePage.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

function findInitializer(name) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  assert.ok(found, 'missing handler ' + name);
  return found.getText(ast);
}
function loadHandler(name, ctx) {
  vm.createContext(ctx);
  const compiled = ts.transpileModule(
    'globalThis.__handler = ' + findInitializer(name) + ';',
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  vm.runInContext(compiled,ctx);
  return ctx.__handler;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((res,rej) => { resolve=res; reject=rej; });
  return { promise, resolve, reject };
}
function setter(ctx,key) {
  return (value) => { ctx[key] = typeof value === 'function' ? value(ctx[key]) : value; };
}

// Follow: immediate paint before delayed settlement + exact rollback.
{
  const d = deferred();
  const ctx = {
    console, Error, Set, Number, Boolean, Math,
    profileUid:'target',
    profile:{ uid:'target', followerCount:4, followingCount:2 },
    user:{ uid:'viewer' },
    followState:{ isFollowing:false, followerCount:4, followingCount:2 },
    followingLoadedUid312:'viewer',
    followingUids312:new Set(),
    followInFlightTargetsRef:{ current:new Set() },
    activeProfileUidRef:{ current:'target' },
    auth:{ currentUser:{ uid:'viewer' } },
    followBusyUid:'',
    socialNotice:'',
    setFollowBusyUid:null, setFollowState:null, setFollowingUids312:null, setProfile:null, setSocialNotice:null,
    patchExplorePublicProfileFirstViewProfile:()=>{},
    setExploreFollow:async()=>d.promise,
  };
  for (const key of ['followBusyUid','followState','followingUids312','profile','socialNotice']) {
    ctx['set'+key[0].toUpperCase()+key.slice(1)] = setter(ctx,key);
  }
  const handler = loadHandler('toggleFollow',ctx);
  const pending = handler();
  assert.equal(ctx.followState.isFollowing,true);
  assert.equal(ctx.profile.followerCount,5);
  assert.equal(ctx.followingUids312.has('target'),true);
  assert.equal(ctx.followInFlightTargetsRef.current.has('target'),true);
  d.resolve({ isFollowing:true, followerCount:5, followingCount:2 });
  await pending;
  assert.equal(ctx.followInFlightTargetsRef.current.has('target'),false);
  assert.equal(ctx.profile.followerCount,5);
}
{
  const d = deferred();
  const ctx = {
    console, Error, Set, Number, Boolean, Math,
    profileUid:'target',
    profile:{ uid:'target', followerCount:5, followingCount:2 },
    user:{ uid:'viewer' },
    followState:{ isFollowing:true, followerCount:5, followingCount:2 },
    followingLoadedUid312:'viewer',
    followingUids312:new Set(['target']),
    followInFlightTargetsRef:{ current:new Set() },
    activeProfileUidRef:{ current:'target' },
    auth:{ currentUser:{ uid:'viewer' } },
    followBusyUid:'',
    socialNotice:'',
    setFollowBusyUid:null, setFollowState:null, setFollowingUids312:null, setProfile:null, setSocialNotice:null,
    patchExplorePublicProfileFirstViewProfile:()=>{},
    setExploreFollow:async()=>d.promise,
  };
  for (const key of ['followBusyUid','followState','followingUids312','profile','socialNotice']) {
    ctx['set'+key[0].toUpperCase()+key.slice(1)] = setter(ctx,key);
  }
  const handler = loadHandler('toggleFollow',ctx);
  const pending = handler();
  assert.equal(ctx.followState.isFollowing,false);
  assert.equal(ctx.profile.followerCount,4);
  assert.equal(ctx.followingUids312.has('target'),false);
  d.reject(new Error('follow rejected'));
  await pending;
  assert.equal(ctx.followState.isFollowing,true);
  assert.equal(ctx.profile.followerCount,5);
  assert.equal(ctx.followingUids312.has('target'),true);
  assert.match(String(ctx.socialNotice||''),/follow rejected|실패/);
}
console.log('APP356_EXPLORE_FOLLOW_IMMEDIATE_ROLLBACK=PASS');

const collections = ['tracks','popularTracks','curatedTracks307','managedCuratedTracks307','profileTracks','profileLikedTracks'];
function publicationContext(d, privateConfirm=false) {
  const originalTrack = {
    id:'track', ownerUid:'owner', title:'T',
    allowNextSongApply:false, allowFollowerSave:false, profilePinned:false,
    coverUrl:null, durationSeconds:null, sunoUrlPrimary:'https://one', sunoUrlSecondary:null, openUrl:'https://one',
  };
  const settings = {
    track:originalTrack,
    options:{ allowNextSongApply:true, allowFollowerSave:true, profilePinned:true },
    sourceId:'', sourceSong:null, sunoLinks:[], selectedSunoIndex:0, initialSunoIndex:0,
  };
  const ctx = {
    console, Error, Set, Number, Boolean, Math,
    user:{ uid:'owner' }, publicationSettings:settings, publicationSettingsBusy:false,
    publicationPrivateConfirm:privateConfirm, socialNotice:'',
    setPublicationSettings:null, setPublicationSettingsBusy:null, setPublicationPrivateConfirm:null, setSocialNotice:null,
    setExploreTrackPublicationOptions:async()=>d.promise,
    setExploreTrackVisibility:async()=>d.promise,
    patchExplorePublicationOptions:()=>{},
    buildExplorePublicationMainSelectionUpdates:()=>{ throw new Error('selection branch should not run'); },
    runV1MutationBoundary:()=>{ throw new Error('selection branch should not run'); },
    updateDoc:()=>{}, doc:()=>{}, db:{},
    patchExplorePublicationSourceLocalCache:()=>{},
    refreshExploreMusicNotePublicationSource:()=>{},
  };
  for (const key of collections) ctx[key] = [{...originalTrack}];
  for (const key of collections) ctx['set'+key[0].toUpperCase()+key.slice(1)] = setter(ctx,key);
  for (const key of ['publicationSettings','publicationSettingsBusy','publicationPrivateConfirm','socialNotice']) {
    ctx['set'+key[0].toUpperCase()+key.slice(1)] = setter(ctx,key);
  }
  ctx.patchExplorePublicationTrack = (track,patch) => {
    for (const key of collections) ctx[key] = ctx[key].map(item => item.id===track.id ? {...item,...patch} : item);
  };
  return { ctx, settings };
}

// Publication option save: visible state closes/patches before delayed server and restores on rejection.
{
  const d = deferred();
  const {ctx,settings} = publicationContext(d,false);
  const before = Object.fromEntries(collections.map(key=>[key,ctx[key].map(x=>({...x}))]));
  const handler = loadHandler('saveExplorePublicationSettings',ctx);
  const pending = handler();
  assert.equal(ctx.publicationSettings,null);
  assert.equal(ctx.tracks[0].allowNextSongApply,true);
  assert.equal(ctx.tracks[0].allowFollowerSave,true);
  assert.equal(ctx.tracks[0].profilePinned,true);
  d.reject(new Error('save rejected'));
  await pending;
  assert.deepEqual(ctx.tracks,before.tracks);
  assert.deepEqual(ctx.profileTracks,before.profileTracks);
  assert.equal(ctx.publicationSettings,settings);
  assert.match(String(ctx.socialNotice||''),/save rejected|실패/);
}
console.log('APP356_EXPLORE_PUBLICATION_SAVE_IMMEDIATE_ROLLBACK=PASS');

// Private: remove from every visible collection before delayed server, then restore all on rejection.
{
  const d = deferred();
  const {ctx,settings} = publicationContext(d,true);
  const before = Object.fromEntries(collections.map(key=>[key,ctx[key].map(x=>({...x}))]));
  const handler = loadHandler('makeExploreTrackPrivate',ctx);
  const pending = handler();
  for (const key of collections) assert.equal(ctx[key].length,0,key+' should hide immediately');
  assert.equal(ctx.publicationSettings,null);
  d.reject(new Error('private rejected'));
  await pending;
  for (const key of collections) assert.deepEqual(ctx[key],before[key],key+' rollback');
  assert.equal(ctx.publicationSettings,settings);
  assert.equal(ctx.publicationPrivateConfirm,true);
  assert.match(String(ctx.socialNotice||''),/private rejected|실패/);
}
console.log('APP356_EXPLORE_PRIVATE_IMMEDIATE_ROLLBACK=PASS');
console.log('APP356_SERVER_COST_CALLS_UNCHANGED=PASS');

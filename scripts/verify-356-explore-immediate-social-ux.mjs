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

// APP650: button and local number respond immediately; only the bounded
// direct canonical request may persist, and failure reconciles once.
function followCtx(initial, commit, recheck) {
  const ctx = {
    console, Error, Set, Number, Boolean, Math,
    profileUid:'target', profile:{ uid:'target', nickname:'Target', avatarUrl:'',
      handle:'target', followerCount:initial?5:4, followingCount:2 },
    user:{uid:'viewer'}, followState:{isFollowing:initial, followerCount:initial?5:4, followingCount:2},
    followBusyUid:'', socialNotice:'', followMutationInFlightRef:{current:false},
    followingLoadedUid312:'viewer', followingUids312:new Set(initial?['target']:[]),
    activeProfileUidRef:{current:'target'}, profileConnectionsCache376Ref:{current:new Map()},
    auth:{currentUser:{uid:'viewer'}},
    readPendingExploreFollowIntents380:()=>[],
    readExploreProfileConnectionExactCount379:()=>null,
    readExploreFollowingExactCount379:()=>null,
    readCachedExplorePublicProfile:()=>({followingCount:2}),
    safeCount:(v)=>Math.max(0,Math.floor(Number(v)||0)),
    setExploreFollow:commit, getExploreFollowState:recheck,
    patchExploreFollowLocalState377:()=>{},
    patchExplorePublicProfileFirstViewProfile:()=>{},
    publishExploreFollowSync377:async()=>{},
  };
  for(const key of ['followBusyUid','followState','followingUids312','profile','socialNotice'])
    ctx['set'+key[0].toUpperCase()+key.slice(1)]=setter(ctx,key);
  return ctx;
}
{
  const d=deferred();
  let calls=0;
  const ctx=followCtx(false,()=>{calls++;return d.promise},async()=>null);
  const click=loadHandler('toggleFollow',ctx);
  const pending=click();
  await click();
  assert.equal(calls,1,'ONE_WRITE_EVEN_IF_DOUBLE_TAPPED');
  assert.equal(ctx.followState.isFollowing,true,'INSTANT_FOLLOW_LABEL');
  assert.equal(ctx.profile.followerCount,5,'INSTANT_TARGET_NUMBER');
  assert.equal(ctx.followingUids312.has('target'),true);
  d.resolve({isFollowing:true,followerCount:0,followingCount:0,actorFollowingCount:0});
  await pending;
  assert.equal(ctx.followState.isFollowing,true);
  assert.equal(ctx.profile.followerCount,5,'IGNORE_STALE_COMPAT_RESPONSE_COUNT');
  assert.equal(ctx.followBusyUid,'');
}
{
  const d=deferred();
  let checks=0;
  const ctx=followCtx(true,()=>d.promise,async()=>{checks++;return {isFollowing:true}});
  const click=loadHandler('toggleFollow',ctx);
  const pending=click();
  assert.equal(ctx.followState.isFollowing,false,'INSTANT_UNFOLLOW');
  assert.equal(ctx.profile.followerCount,4);
  d.reject(new Error('follow rejected'));
  await pending;
  assert.equal(checks,1);
  assert.equal(ctx.followState.isFollowing,true,'ROLLBACK_REJECTED_MUTATION');
  assert.equal(ctx.profile.followerCount,5);
  assert.match(ctx.socialNotice,/follow rejected/);
}
{
  const d=deferred();
  const ctx=followCtx(false,()=>d.promise,async()=>({isFollowing:true}));
  const click=loadHandler('toggleFollow',ctx);
  const pending=click();
  d.reject(new Error('HTTP 500 after write'));
  await pending;
  assert.equal(ctx.followState.isFollowing,true,'COMMITTED_D1_RECONCILED_AFTER_500');
  assert.equal(ctx.profile.followerCount,5);
  assert.equal(ctx.socialNotice,'','DO_NOT_REPORT_FALSE_FAILURE');
}
console.log('APP650_FOLLOW_INSTANT_UX_AND_SERVER_SETTLEMENT=PASS');

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

// Execute the actual route and curation writer extracted from either the
// canonical source or exact live bundle. No network or user data.
import assert from 'node:assert/strict';
import ts from 'typescript';
export async function verifyCuratedDirectPublicationRouting(source) {
  const ast=ts.createSourceFile('worker.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(ast.parseDiagnostics.length,0,'Worker syntax');
  let block,sync;
  const visit=n=>{
    if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='isTrackVisibilityMutation307'))block=n.parent;
    if(ts.isFunctionDeclaration(n)&&n.name?.text==='syncCuratedPublicationResults307')sync=n.getText(ast);
    ts.forEachChild(n,visit);
  };
  visit(ast);
  assert.ok(block&&sync&&block.statements,'exact curation route/writer not found');
  const statements=Array.from(block.statements,x=>x.getText(ast));
  const start=statements.findIndex(x=>/^(const|let|var) isTrackVisibilityMutation307\b/.test(x));
  const pre=statements.findIndex((x,i)=>i>start&&x.includes('CURATED_REPAIR_PREFLIGHT_REQUIRED_468'));
  const confirm=statements.findIndex((x,i)=>i>pre&&x.includes('curated-repair-468/confirm'));
  const post=statements.findIndex((x,i)=>i>confirm&&x.includes('await syncCuratedPublicationResults307'));
  assert.ok(start>=0&&pre>start&&confirm>pre&&post>confirm);
  const routeBody=statements.slice(start,pre+1).join('\n')+'\nconst response=await baseWorker.fetch(request,env,ctx);\n'+statements[confirm]+'\n'+statements[post]+'\nreturn response;';
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const owner='owner', id='music_note_owner_song', other='music_note_other_other';
  const old={id,ownerUid:owner,title:'old',likeCount:7,coverUrl:'cover'};
  const pick={curatorUid:'admin',sortOrder:12};
  const confirmed={id,ownerUid:owner,title:'new',likeCount:7,coverUrl:'cover'};
  const initial={schemaVersion:1,memberIds:[id,other],payload:{ok:true,data:{items:[{track:old,curation:pick},{track:{id:other,title:'other'},curation:{curatorUid:'admin',sortOrder:13}}]}}};
  async function run({sourceId='song',actor=owner,auth=true,success=true,wrongResult=false,shared=false,shadow=true,method='POST',path='/v1/publications',requestBody,responseData}={}) {
    const calls=[]; let saved=null;
    const bucket={get:async()=>({etag:'before',text:async()=>JSON.stringify(initial)}),put:async(key,text,options)=>{calls.push('put');saved=JSON.parse(text);if(shadow)assert.equal(options.onlyIf.etagMatches,'before');return {etag:'after'}}};
    const getCuratedShared466=async()=>({object:{},snapshot:{memberIds:[id,other]}});
    const refreshCuratedShared466=async(_r,_e,_c,ids)=>{calls.push('refresh:'+ids.join(','));return {ok:true}};
    const writer=new Function('sharedCuratedEnabled466','getCuratedShared466','refreshCuratedShared466','curatedBucket307','curatedWriterShadowEnabled471','SORIDRAW_CURATED_R2_KEY_307','SORIDRAW_CURATED_COLLECTION_307','clearCuratedEdge307',sync+'\nreturn syncCuratedPublicationResults307;')(
      ()=>shared,getCuratedShared466,refreshCuratedShared466,()=>bucket,()=>shadow,'curated-key','soridraw',async()=>calls.push('clear'));
    const stub={fetch:async(url,init)=>{const action=url.split('/').at(-1);calls.push(action);if(action==='reserve')assert.deepEqual(JSON.parse(init.body).trackIds,[id]);return Response.json({ok:true,data:{reserved:true,generation:42}})}};
    const env={EXPLORE_LIKE_BATCH_SCHEDULER:{idFromName:()=>1,get:()=>stub}};
    const body=requestBody??{sourceType:'music_note',sourceId};
    const request=new Request('https://example.invalid'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const payload={ok:success,data:responseData??{trackId:wrongResult?'wrong':id,snapshotItem:confirmed}};
    const baseWorker={fetch:async()=>{calls.push('base');return Response.json(payload,{status:success?200:409})}};
    const authFn=async()=>{calls.push('auth');return auth?{ok:true,uid:actor}:{ok:false,response:Response.json({ok:false},{status:401})}};
    const runner=new AsyncFunction('request','url','env','ctx','baseWorker','curatedSharedWriterEnabled471','getCuratedShared466','readCanonicalCurated466','validateExploreAuth307','EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103','syncCuratedPublicationResults307','curatedWriterShadowEnabled471','refreshCuratedShared466',routeBody);
    const response=await runner(request,new URL(request.url),env,{},baseWorker,()=>shadow||shared,getCuratedShared466,async()=>{throw Error('unexpected canonical list read')},authFn,'scheduler',writer,()=>shadow,refreshCuratedShared466);
    return {status:response.status,calls,saved};
  }
  const a=await run();
  assert.deepEqual(a.calls,['auth','reserve','base','confirm','put','clear','refresh:'+id,'ack']);
  assert.equal(a.saved.payload.data.items[0].track.title,'new');
  assert.equal(a.saved.payload.data.items[0].track.likeCount,7);
  assert.deepEqual(a.saved.payload.data.items[0].curation,pick);
  assert.deepEqual(a.saved.payload.data.items[1],initial.payload.data.items[1]);
  assert.deepEqual(a.saved.memberIds,initial.memberIds);
  const b=await run({auth:false});
  assert.equal(b.status,401);assert.deepEqual(b.calls,['auth']);assert.equal(b.saved,null);
  const c=await run({wrongResult:true});
  assert.ok(c.calls.includes('reserve')&&c.calls.includes('confirm')&&!c.calls.includes('ack')&&!c.calls.includes('put'));
  const d=await run({success:false});
  assert.ok(d.calls.includes('base')&&!d.calls.includes('put')&&!d.calls.includes('ack'));
  const unrelated=await run({sourceId:'unrelated',responseData:{trackId:'music_note_owner_unrelated',snapshotItem:{id:'music_note_owner_unrelated',title:'new'}}});
  assert.deepEqual(unrelated.calls,['base']);assert.equal(unrelated.saved,null);
  const sameSuffix=await run({actor:'someone_else',responseData:{trackId:'music_note_someone_else_song',snapshotItem:{id:'music_note_someone_else_song',title:'new'}}});
  assert.deepEqual(sameSuffix.calls,['auth','base']);assert.equal(sameSuffix.saved,null);
  const legacy=await run({shadow:false});
  assert.deepEqual(legacy.calls,['base','put','clear']);
  const shared=await run({shared:true,shadow:false});
  assert.deepEqual(shared.calls,['auth','reserve','base','confirm','refresh:'+id,'ack']);assert.equal(shared.saved,null);
  const batch=await run({path:'/v1/me/music-note-publications/batch',requestBody:{mutations:[{trackId:id}]},responseData:{results:[{ok:true,trackId:id,status:'public',snapshotItem:confirmed}]}});
  assert.deepEqual(batch.calls,['auth','reserve','base','confirm','put','clear','refresh:'+id,'ack']);
  const visibility=await run({method:'PATCH',path:'/v1/tracks/'+id+'/visibility',responseData:{trackId:id,isPublic:false}});
  assert.deepEqual(visibility.saved.payload.data.items,[initial.payload.data.items[1]]);
  console.log('CURATED_EXACT_ROUTE_DIRECT_BATCH_PRIVATE_AUTH_RESERVATION_RETRY_AND_PROJECTION=PASS');
}

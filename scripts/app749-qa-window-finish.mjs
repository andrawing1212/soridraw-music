// APP749 isolated QA: owner-confirmed browser PASS ends the window early.
// This polls only GitHub issue 1254. It NEVER cancels the workflow or restores
// resources itself: the original always() restore steps remain authoritative.
const OWNER='andrawing1212';
const REPO='soridraw-music';
const ISSUE=1254;
const MAX_MS=30*60*1000;
const POLL_MS=15000;
const ID=/^[1-9]\d{0,16}$/;
const SHA=/^[0-9a-f]{40}$/;
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function positive(value){
 const s=String(value??'');
 return ID.test(s)&&Number.isSafeInteger(Number(s));
}
function validInput(x){
 return x?.repository===OWNER+'/'+REPO&&
  positive(x?.runId)&&positive(x?.startCommentId)&&
  SHA.test(x?.sha||'')&&typeof x.token==='string'&&
  x.token.length>=15&&typeof x.startedAt==='string'&&
  Number.isFinite(Date.parse(x.startedAt));
}
export async function awaitApp749QaFinishSignal(input,{
 send=fetch,now=Date.now,sleep=nap,log=console.log,
 maxMs=MAX_MS,pollMs=POLL_MS,
}={}){
 if(!validInput(input)||!Number.isSafeInteger(maxMs)||maxMs<1||
  maxMs>MAX_MS||!Number.isSafeInteger(pollMs)||pollMs<1||pollMs>60000)
  throw Error('APP749_QA_FINISH_INVALID_SCOPE_HOLD');
 const expected='/app749-qa-finish '+input.runId+' '+input.sha;
 const startTime=Date.parse(input.startedAt);
 const deadline=now()+maxMs;
 const root='https://api.github.com/repos/'+OWNER+'/'+REPO+
  '/issues/'+ISSUE+'/comments?per_page=100&since='+
  encodeURIComponent(new Date(startTime).toISOString());
 let errors=0,checks=0;
 while(now()<deadline){
  try{
   let matched=false;
   for(let page=1;page<=3;page++){
    const response=await send(root+'&page='+page,{
     method:'GET',redirect:'error',
     headers:{Accept:'application/vnd.github+json',
      Authorization:'Bearer '+input.token,'Cache-Control':'no-store',
      'X-GitHub-Api-Version':'2022-11-28'},
     signal:AbortSignal.timeout(12000),
    });
    if(response?.status!==200)throw Error('COMMENTS_HTTP_HOLD');
    const comments=await response.json();
    if(!Array.isArray(comments)||comments.length>100)
     throw Error('COMMENTS_SHAPE_HOLD');
    for(const c of comments){
     if(Number.isSafeInteger(c?.id)&&c.id>Number(input.startCommentId)&&
      c?.user?.login===OWNER&&c.body===expected&&
      typeof c.created_at==='string'&&
      Date.parse(c.created_at)>=startTime)matched=true;
    }
    if(comments.length<100)break;
    if(page===3)throw Error('COMMENTS_PAGE_LIMIT_HOLD');
   }
   if(matched){
    log('APP749_QA_OWNER_CONFIRMED_EARLY_FINISH=PASS');
    log('APP749_QA_RESTORE_ALWAYS_STEPS=NEXT');
    return 'OWNER_CONFIRMED';
   }
   errors=0;checks++;
  }catch{
   errors++;
   if(errors>=3)throw Error('APP749_QA_FINISH_POLL_FAILURE_RESTORE_HOLD');
  }
  const remaining=deadline-now();
  if(remaining<=0)break;
  await sleep(Math.min(pollMs,remaining));
 }
 log('APP749_QA_MAX_30_MINUTES_NO_FINISH_SIGNAL=RESTORE_NEXT');
 return 'TIME_LIMIT';
}
const isDirect=process.argv[1]&&import.meta.url===
 new URL('file://'+process.argv[1]).href;
if(isDirect){
 const input={
  repository:process.env.GITHUB_REPOSITORY,
  runId:process.env.GITHUB_RUN_ID,
  startCommentId:process.env.QA_START_COMMENT_ID,
  sha:process.env.QA_TRIGGER_SHA,
  token:process.env.GITHUB_TOKEN,
  startedAt:process.env.QA_TRIGGER_CREATED_AT,
 };
 await awaitApp749QaFinishSignal(input).catch(e=>{
  console.error(String(e?.message||'APP749_QA_FINISH_HOLD'));
  process.exitCode=2;
 });
}

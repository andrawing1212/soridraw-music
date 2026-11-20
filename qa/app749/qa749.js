// QA749 only: Same-origin external module (Firebase Hosting CSP blocks inline scripts).
// Run the local diagnostic BEFORE loading external Firebase SDK modules, so errors
// can be explained on the page without changing QA Hosting CSP or exposing tokens.
const statusNode=document.getElementById('configStatus');
statusNode.textContent='QA JavaScript 연결됨 · Firebase SDK 확인 중…';
let initializeApp,initializeAppCheck,ReCaptchaEnterpriseProvider,getCheckToken,
    getAuth,inMemoryPersistence,setPersistence,signInWithEmailAndPassword,signOut,
    getDatabase,ref,onValue;
try{
  const [firebase,appCheck,auth,database]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js'),
  ]);
  ({initializeApp}=firebase);
  ({initializeAppCheck,ReCaptchaEnterpriseProvider,getToken:getCheckToken}=appCheck);
  ({getAuth,inMemoryPersistence,setPersistence,signInWithEmailAndPassword,signOut}=auth);
  ({getDatabase,ref,onValue}=database);
}catch{
  statusNode.textContent='Firebase SDK 불러오기 실패 · 외부 스크립트 차단 또는 네트워크 문제. 로그인/팔로우는 중단됨.';
  throw Error('QA749_QA_SDK_LOAD_HOLD_NO_AUTH_ATTEMPT');
}
const QA='soridraw-app',NUMBER='1083981050742',SITEKEY='6Lc77ykuAAAAAG4hEdVeX6H9Teh2w6iYc3Hy-x5B';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const WORKER='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const $=id=>document.getElementById(id);
let appA,appB,authA,authB,check,userA,userB,unsub=null,observed=null,seenEvents=0;
let verified=false,busy=false,afterFollow=null,originalVersion=null;
function log(value){
 const entry=document.createElement('div');
 const time=new Date().toLocaleTimeString('ko-KR',{hour12:false});
 entry.textContent=time+' · '+value;
 if(!seenEvents++)$('events').replaceChildren();
 $('events').prepend(entry);
 if($('events').childElementCount>15)$('events').lastElementChild.remove();
}
function fail(code){throw Error(code)}
function status(message,place='configStatus'){$(place).textContent=message}
function errorMessage(e){
 const code=typeof e?.code==='string'?e.code:'';
 if(code.startsWith('auth/'))return 'Firebase 로그인 실패 ('+code.replace(/[^a-zA-Z0-9/-]/g,'')+')';
 if(e?.message==='WORKER_NOT_ACTIVE')return 'QA749 서버 임시 활성화 전이거나 로그인 토큰 검증 실패 (HTTP 403)';
 if(e?.message==='QA_STATE_NOT_READY')return 'QA 상태가 0명이 아니거나 다른 작업이 남아 있어 중단';
 if(e?.message==='QA_RECEIVER_TIMEOUT')return '수신 지연/불일치: 자동 재전송하지 않았습니다';
 return '요청 실패. 새 요청 없이 검사 중단';
}
function safeConfig(x){
 return x&&typeof x==='object'&&x.projectId===QA&&
  String(x.messagingSenderId)===NUMBER&&
  /^1:1083981050742:web:[A-Za-z0-9]+$/.test(x.appId||'')&&
  typeof x.apiKey==='string'&&x.apiKey.length>20&&
  x.authDomain==='soridraw-app.firebaseapp.com'&&
  (x.databaseURL===DB||!x.databaseURL);
}
async function configure(raw){
 if(appA)return;
 const cfg={...raw,databaseURL:DB};
 if(!safeConfig(cfg))fail('WRONG_QA_FIREBASE_CONFIG');
 appA=initializeApp(cfg,'soridraw-app749-receiver');
 appB=initializeApp(cfg,'soridraw-app749-actor');
 check=initializeAppCheck(appA,{provider:new ReCaptchaEnterpriseProvider(SITEKEY),
   isTokenAutoRefreshEnabled:false});
 authA=getAuth(appA);authB=getAuth(appB);
 await Promise.all([setPersistence(authA,inMemoryPersistence),setPersistence(authB,inMemoryPersistence)]);
 $('loginA').disabled=false;$('loginB').disabled=false;
 status('기존 QA Firebase 연결 준비 완료 · 로그인 전');
 log('QA 프로젝트와 App Check 웹 앱 설정 확인');
}
async function automatic(){
 try{
  const response=await fetch('/__/firebase/init.json',{cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('NO_CONFIG');
  await configure(await response.json());
 }catch{
  status('공개 Firebase 설정 자동 조회 실패. 아래 입력칸에 기존 QA584의 공개 설정 JSON을 입력하세요.');
  $('manual').hidden=false;
 }
}
$('apply').onclick=async()=>{
 try{await configure(JSON.parse($('config').value));$('config').value='';$('manual').hidden=true}
 catch{status('QA 프로젝트 설정이 일치하지 않습니다. 저장하거나 진행하지 않았습니다.')}
};
async function signin(role){
 const isA=role==='A',pass=$(isA?'pwA':'pwB'),dest=isA?'aStatus':'bStatus';
 if(!appA)throw Error('FIREBASE_NOT_READY');
 if(!pass.value)throw Error('PASSWORD_MISSING');
 const value=pass.value;pass.value='';
 const auth=isA?authA:authB;
 const email=isA?'testa@example.com':'testb@example.com';
 const result=await signInWithEmailAndPassword(auth,email,value);
 if(isA){
  userA=result.user;
  if(unsub)unsub();
  const db=getDatabase(appA);
  unsub=onValue(ref(db,'ownerFollowerSync532/'+userA.uid),snap=>{
    const val=snap.val();
    if(!val||!Number.isSafeInteger(val.version)||![0,1].includes(val.followerCount)){
      status('RTDB 데이터 확인 불가. 테스트 중단.','aStatus');
      observed=null;verified=false;refresh();return;
    }
    observed={version:val.version,count:val.followerCount};
    $('count').textContent=String(val.followerCount);
    $('version').textContent=String(val.version);
    log('A 실시간 수신: '+val.followerCount+'명 / 버전 '+val.version);
    if(verified&&afterFollow!==null&&val.version>afterFollow+2){
      verified=false;refresh();log('예상 밖의 버전 변경: 테스트 중단');
    }
  },()=>{status('QA RTDB 수신 권한 또는 연결 실패','aStatus');verified=false;refresh()});
 }else userB=result.user;
 status('QA 계정 '+role+' 로그인 성공',''+(isA?'aStatus':'bStatus'));
 log('QA 계정 '+role+' 로그인 성공 (사용자 정보 출력 없음)');
 refresh();
}
$('loginA').onclick=async()=>{try{await signin('A')}catch(e){status(errorMessage(e),'aStatus');log('A 로그인 실패')}};
$('loginB').onclick=async()=>{try{await signin('B')}catch(e){status(errorMessage(e),'bStatus');log('B 로그인 실패')}};
function refresh(){
 $('verify').disabled=!(userA&&userB)||busy;
 $('follow').disabled=!verified||busy||afterFollow!==null;
 $('unfollow').disabled=!verified||busy||afterFollow===null;
}
async function qaRequest(method,path,user){
 if(!user)fail('QA_USER_MISSING');
 const [id,appToken]=await Promise.all([user.getIdToken(),getCheckToken(check,false)]);
 const r=await fetch(WORKER+'/qa730/verified/'+path,{
  method,mode:'cors',redirect:'error',cache:'no-store',
  headers:{Authorization:'Bearer '+id,'X-Firebase-AppCheck':appToken.token,
    Accept:'application/json','Cache-Control':'no-store'},
  signal:AbortSignal.timeout(12000)});
 const body=await r.json().catch(()=>null);
 if(r.status!==200||body?.ok!==true||body?.syntheticOnly!==true||
   body?.qaFirebaseAuthAppCheckVerified!==true){
  if(r.status===403)fail('WORKER_NOT_ACTIVE');
  fail('QA_WORKER_REJECTED');
 }
 return body;
}
function baseline(a,b){
 return Number.isSafeInteger(a.version)&&a.version===b.version&&
  observed?.version===a.version&&observed.count===0&&
  a.followerCount===0&&b.followerCount===0&&
  a.following===false&&b.following===false&&
  !a.pending&&!b.pending&&!a.hold&&!b.hold;
}
$('verify').onclick=async()=>{
 if(busy)return;busy=true;verified=false;afterFollow=null;refresh();
 try{
  if(!observed)fail('QA_STATE_NOT_READY');
  const [a,b]=await Promise.all([
    qaRequest('GET','status',userA),qaRequest('GET','status',userB)]);
  if(!baseline(a,b))fail('QA_STATE_NOT_READY');
  originalVersion=a.version;verified=true;
  log('실제 A·B Firebase 서명 검증 + RTDB 0명 기준 일치 PASS');
  status('실제 계정 A·B 인증 PASS · 팔로우 버튼 사용 가능','bStatus');
 }catch(e){status(errorMessage(e),'bStatus');log('서버 인증/기준 확인 HOLD')}
 finally{busy=false;refresh()}
};
async function observe(version,count){
 if(observed?.version===version&&observed.count===count)return;
 await new Promise((resolve,reject)=>{
  const started=Date.now(),t=setInterval(()=>{
   if(observed?.version===version&&observed.count===count){clearInterval(t);resolve()}
   else if(observed?.version>version||Date.now()-started>18000){
    clearInterval(t);reject(Error('QA_RECEIVER_TIMEOUT'))}
  },200);
 });
}
async function settle(expectedVersion,count){
 await observe(expectedVersion,count);
 for(let attempt=0;attempt<10;attempt++){
  const [a,b]=await Promise.all([
    qaRequest('GET','status',userA),qaRequest('GET','status',userB)]);
  if(a.version>expectedVersion||b.version>expectedVersion||
     a.hold||b.hold)fail('QA_STATE_NOT_READY');
  if(a.version===expectedVersion&&b.version===expectedVersion&&
     a.followerCount===count&&b.followerCount===count&&
     a.following===(count===1)&&b.following===(count===1)&&
     !a.pending&&!b.pending)return;
  await new Promise(r=>setTimeout(r,900));
 }
 fail('QA_RECEIVER_TIMEOUT');
}
async function change(method){
 if(busy||!verified)return;busy=true;refresh();
 const want=method==='PUT'?1:0;
 const expected=method==='PUT'?originalVersion+1:originalVersion+2;
 try{
  if(method==='PUT'&&(afterFollow!==null||observed?.count!==0))fail('QA_STATE_NOT_READY');
  if(method==='DELETE'&&(afterFollow!==originalVersion||observed?.count!==1))
    fail('QA_STATE_NOT_READY');
  const result=await qaRequest(method,'follow',userB);
  if(result.changed!==true||result.version!==expected)fail('QA_STATE_NOT_READY');
  await settle(expected,want);
  afterFollow=method==='PUT'?originalVersion:null;
  log(method==='PUT'?'팔로우 + A 실시간 수신 + 서버 최종 반영 PASS':
    '팔로우 취소 + A 실시간 수신 + 0명 복구 PASS');
  status(method==='PUT'?'팔로우 PASS · 이제 취소하세요':
    '팔로우·취소 검증 PASS · 최종 팔로워 0명','bStatus');
  if(method==='DELETE'){verified=false;log('더 이상 요청 없음. 재실행하려면 다시 인증 기준 확인')}
 }catch(e){verified=false;log('작업 실패 / HOLD · 자동 재시도 없음');
  status(errorMessage(e),'bStatus')}
 finally{busy=false;refresh()}
}
$('follow').onclick=()=>change('PUT');
$('unfollow').onclick=()=>change('DELETE');
window.addEventListener('pagehide',()=>{if(unsub)unsub()});
await automatic();

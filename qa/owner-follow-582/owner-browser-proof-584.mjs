// APP584: isolated QA Firebase Web SDK browser proof. NEVER import src/firebase.js.
// No canonical SORIDRAW backend or data writes. No synthetic secret sent to browser.
import {createQaOwnerClient582,assertQaOwnerClient582} from './owner-client.mjs';

const $ = id => document.getElementById(id);
const form = $('connectForm');
const connectButton = $('connect');
const disconnectButton = $('disconnect');
const status = $('state');
const result = $('events');
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const allowedHost = local || location.hostname.endsWith('.qa.soridraw.com') ||
 location.hostname.endsWith('.soridraw-qa.workers.dev');
const qaOrigin = allowedHost && (location.protocol === 'https:' ||
 (local && location.protocol === 'http:'));
let client = null;
let unsubscribe = null;
let generation = 0;
let lastVersion = 0;
let entries = [];

const setStatus = (value,detail) => {
 status.textContent = value;
 if(detail) $('detail').textContent = detail;
};
const log = message => {
 // Never log QA UID, config, password, token, claim or HMAC bytes.
 entries = [...entries.slice(-15),new Date().toLocaleTimeString()+' '+message];
 result.textContent = entries.join('\n');
};
const disconnect = async () => {
 generation += 1;
 if(unsubscribe) {unsubscribe();unsubscribe=null;}
 const closing=client;
 client=null;
 connectButton.disabled=!qaOrigin;
 disconnectButton.disabled=true;
 lastVersion=0;
 $('count').textContent='—';
 $('version').textContent='—';
 $('lastReceived').textContent='—';
 $('password').value='';
 if(closing)try{await closing.signOut();}catch{/* no retry */}
 setStatus('연결 해제','브라우저 세션 연결 해제. 서버 쓰기 없음.');
 log('연결 해제');
};

if(!qaOrigin){
 connectButton.disabled=true;
 setStatus('QA 출처 검증 실패','localhost 또는 독립 QA 도메인에서만 실행할 수 있습니다.');
}else{
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(client||connectButton.disabled)return;
  const run=++generation;
  connectButton.disabled=true;
  disconnectButton.disabled=true;
  let pending=null;
  try{
   const config=JSON.parse($('config').value);
   const ownerUid=$('ownerUid').value.trim();
   // Fail closed before SDK initialization or any network access.
   assertQaOwnerClient582(config,ownerUid);
   pending=await createQaOwnerClient582({config,ownerUid});
   if(run!==generation)return;
   // Synthetic credentials never persist across page reloads/browser sessions.
   const [{getApp},{getAuth,setPersistence,inMemoryPersistence}]=await Promise.all([
    import('firebase/app'),import('firebase/auth')]);
   await setPersistence(getAuth(getApp('soridraw-isolated-owner-qa582')),
    inMemoryPersistence);
   const password=$('password').value;
   $('password').value='';
   await pending.signInOwner('testa@example.com',password);
   if(run!==generation){await pending.signOut();return;}
   client=pending;
   $('config').value='';
   $('ownerUid').value='';
   setStatus('QA Auth 로그인 성공 · 첫 RTDB 수신 대기',
    '로그인 성공은 수신 PASS가 아닙니다. 별도 QA 서버 도구로 B의 팔로우/취소를 발생시켜 확인합니다.');
   const detach=await client.subscribeOwner(marker=>{
    if(generation!==run||client!==pending)return;
    if(!Number.isSafeInteger(marker.version)||marker.version<1||
       !Number.isSafeInteger(marker.followerCount)||marker.followerCount<0)return;
    if(marker.version<lastVersion){log('오래된 버전 수신 무시');return;}
    const changed=marker.version>lastVersion;
    lastVersion=marker.version;
    $('count').textContent=String(marker.followerCount);
    $('version').textContent=String(marker.version);
    $('lastReceived').textContent=new Date().toLocaleString();
    setStatus('QA Web SDK 수신 확인',
     '기기별 Web SDK 수신입니다. 두 기기의 같은 버전/숫자 확인 후에만 교차기기 PASS로 판단합니다.');
    if(changed)log('확정 수신: 버전 '+marker.version+', 수 '+marker.followerCount);
   });
   if(run!==generation){detach();return;}
   unsubscribe=detach;
   disconnectButton.disabled=false;
  }catch(error){
   if(run!==generation)return;
   // Provider errors can contain identifiers: show only a sanitized code.
   const code=typeof error?.code==='string' && /^auth\/[a-z-]+$/.test(error.code)
    ?error.code:'QA_CONFIG_OR_AUTH_HOLD';
   setStatus('QA 연결 실패','오류 코드: '+code+'. 설정·허용 도메인·QA 계정/클레임을 확인하세요.');
   log('연결 실패 (비밀정보 표시 안 함)');
   if(pending)try{await pending.signOut();}catch{/* no-op */}
   client=null;
   connectButton.disabled=false;
  }
 });
 disconnectButton.addEventListener('click',disconnect);
 window.addEventListener('pagehide',()=>{
  generation+=1;
  if(unsubscribe)unsubscribe();
  unsubscribe=null;
  // No unload writes or network cleanup calls.
 });
}

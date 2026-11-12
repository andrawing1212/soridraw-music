// APP584 QA-only Web SDK proof. Never import the normal SORIDRAW Firebase app.
// No Firebase database writes, Cloudflare secrets, or user data on this page.
import {createQaOwnerClient582,assertQaOwnerClient582} from './owner-client.mjs';

const $ = id => document.getElementById(id);
const connect = $('connect');
const disconnect = $('disconnect');
const arm = $('arm');
const proof = $('proof');
const state = $('state');
const logEl = $('events');
const local = ['localhost','127.0.0.1'].includes(location.hostname);
const site = /^soridraw-qa-owner-584(?:--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
const allowedOrigin = (local && location.protocol === 'http:') ||
 (site && location.protocol === 'https:');

let client = null;
let unsubscribe = null;
let session = 0;
let version = 0;
let count = null;
let armVersion = null;
let steps = 0;
let lines = [];
let initialTimer = null;

function status(label, detail) {
 state.textContent = label;
 $('detail').textContent = detail;
}
function log(message) {
 // Synthetic event metadata only. Never record UID, passwords, keys, claims or tokens.
 lines = [...lines.slice(-14),new Date().toLocaleTimeString()+' '+message];
 logEl.textContent = lines.join('\n');
}
function resetView() {
 if(initialTimer!==null){clearTimeout(initialTimer);initialTimer=null;}
 version = 0; count = null; armVersion = null; steps = 0;
 arm.disabled = true;
 proof.textContent = '미검증';
 $('count').textContent = '—';
 $('version').textContent = '—';
 $('lastReceived').textContent = '—';
 $('password').value = '';
}
async function disconnectOwner() {
 session++;
 if(unsubscribe) unsubscribe();
 unsubscribe = null;
 const old = client;
 client = null;
 resetView();
 disconnect.disabled = true;
 connect.disabled = !allowedOrigin;
 if(old) try { await old.signOut(); } catch { /* no retry */ }
 status('연결 해제','브라우저 메모리 세션만 종료했습니다. 서버에 쓰지 않습니다.');
 log('연결 해제');
}

if (!allowedOrigin) {
 connect.disabled = true;
 status('QA 출처 차단','독립 QA Firebase Hosting 주소 또는 localhost에서만 실행할 수 있습니다.');
} else {
 $('connectForm').addEventListener('submit',async event => {
  event.preventDefault();
  if(connect.disabled || client) return;
  const mySession = ++session;
  connect.disabled = true;
  disconnect.disabled = true;
  arm.disabled = true;
  const password = $('password').value;
  $('password').value = '';
  let pending = null;
  let stage = 'CONFIG_JSON';
  try {
   const config = JSON.parse($('config').value);
   const ownerUid = $('ownerUid').value.trim();
   // Fail closed before SDK initialization or network access.
   stage = 'CONFIG_IDENTITY';
   assertQaOwnerClient582(config,ownerUid);
   stage = 'SDK_INIT';
   pending = await createQaOwnerClient582({config,ownerUid});
   if(mySession !== session) return;
   stage = 'AUTH_PERSISTENCE';
   const [{getApp},{getAuth,setPersistence,inMemoryPersistence,getIdTokenResult}] =
    await Promise.all([import('firebase/app'),import('firebase/auth')]);
   const qaAuth = getAuth(getApp('soridraw-isolated-owner-qa582'));
   await setPersistence(qaAuth,inMemoryPersistence);
   stage = 'AUTH_SIGN_IN';
   await pending.signInOwner('testa@example.com',password);
   if(mySession !== session) { await pending.signOut(); return; }
   stage = 'OWNER_CLAIM';
   const identity = qaAuth.currentUser;
   const token = identity ? await getIdTokenResult(identity,true) : null;
   if(!token || !/^[0-9a-f]{32}$/.test(String(token.claims.soridrawFollowEpoch532||'')))
    throw Error('QA_OWNER_CLAIM_HOLD');
   client = pending;
   $('config').value = '';
   $('ownerUid').value = '';
   status('QA Auth 성공 · RTDB 기준값 대기','로그인만으로 실시간 수신이 통과한 것은 아닙니다.');
   stage = 'RTDB_SUBSCRIBE';
   let firstReceipt = false;
   const allowedDiagnostics = new Set([
    'QA_AUTH_SESSION_MISMATCH','QA_OWNER_TOKEN_FAILED',
    'QA_OWNER_CLAIM_MISSING','QA_AUTH_SESSION_CHANGED',
    'QA_RTDB_MARKER_ABSENT','QA_RTDB_MARKER_INVALID',
    'QA_RTDB_PERMISSION_DENIED','QA_RTDB_LISTENER_FAILURE'
   ]);
   const onDiagnostic = code => {
    if(mySession!==session || client!==pending ||
       !allowedDiagnostics.has(code))return;
    if(initialTimer!==null){clearTimeout(initialTimer);initialTimer=null;}
    status('QA RTDB 수신 문제','진단 코드: '+code+
     '. 비밀번호와 설정값은 표시하지 않습니다.');
    log('QA 수신 진단: '+code);
   };
   initialTimer=setTimeout(()=>{
    initialTimer=null;
    if(mySession===session && client===pending && !firstReceipt){
     status('QA RTDB 초기 수신 지연',
      '진단 코드: QA_RTDB_NO_INITIAL_EVENT_12S. 연결 상태 확인이 필요합니다.');
     log('QA 수신 진단: QA_RTDB_NO_INITIAL_EVENT_12S');
    }
   },12000);
   const detach = await pending.subscribeOwner(marker => {
    if(mySession !== session || client !== pending) return;
    firstReceipt=true;
    if(initialTimer!==null){clearTimeout(initialTimer);initialTimer=null;}
    if(!Number.isSafeInteger(marker.version) || marker.version < 1 ||
       !Number.isSafeInteger(marker.followerCount) || marker.followerCount < 0) return;
    if(marker.version < version) { log('이전 버전 수신 무시'); return; }
    const changed = marker.version > version;
    version = marker.version;
    count = marker.followerCount;
    $('count').textContent = String(count);
    $('version').textContent = String(version);
    $('lastReceived').textContent = new Date().toLocaleString();
    if(changed) log('확정 수신: 버전 '+version+', 팔로워 '+count);
    if(armVersion === null) {
     arm.disabled = (count !== 0);
     status('QA RTDB 기준값 수신','두 기기 모두 수신 검증 준비 후 합성 B의 팔로우·취소를 실행하세요.');
     return;
    }
    if(!changed) return;
    const expectedVersion = armVersion + steps + 1;
    const expectedCount = steps === 0 ? 1 : 0;
    if(version !== expectedVersion || count !== expectedCount) {
     proof.textContent = 'FAIL · 누락 또는 예상값 불일치';
     armVersion = null;
     arm.disabled = (count !== 0);
     status('QA 증거 불완전','변화 2건을 정확한 순서로 모두 수신해야 합니다.');
     log('수신 검증 실패: 버전/팔로워 수 불일치');
     return;
    }
    steps += 1;
    proof.textContent = steps+'/2 단계';
    if(steps === 2) {
     proof.textContent = '이 브라우저 PASS · 팔로우/취소 2/2';
     armVersion = null;
     arm.disabled = false;
     status('QA 단일 브라우저 수신 PASS',
      '두 기기 각각 PASS와 동일 버전을 확인한 뒤에만 PC↔모바일 PASS로 판단합니다.');
    } else {
     status('QA 팔로우 수신 1/2','취소 수신을 기다립니다.');
    }
   },onDiagnostic);
   if(mySession !== session) {detach();return;}
   unsubscribe = detach;
   disconnect.disabled = false;
  } catch(error) {
   if(mySession !== session) return;
   if(initialTimer!==null){clearTimeout(initialTimer);initialTimer=null;}
   // Explicitly classify only fixed known codes. Never display raw SDK error
   // messages, URLs, UID, passwords, tokens, or Firebase configuration fields.
   const codes = {
    'APP582_QA_CLIENT_IDENTITY_HOLD':'QA_APP_ID_OR_UID_MISMATCH',
    'APP577_QA_PROJECT_OR_ENTRY_MISMATCH_HOLD':'QA_PROJECT_OR_AUTH_DOMAIN_MISMATCH',
    'APP577_QA_DATABASE_URL_MISMATCH_HOLD':'QA_DATABASE_URL_MISMATCH',
    'APP577_QA_STORAGE_BUCKET_MISMATCH_HOLD':'QA_STORAGE_BUCKET_MISMATCH',
    'APP582_QA_OWNER_UID_MISMATCH':'QA_OWNER_UID_MISMATCH',
    'APP582_ONLY_QA_OWNER_A_EMAIL':'QA_PASSWORD_MISSING',
    'QA_OWNER_CLAIM_HOLD':'QA_OWNER_CLAIM_MISSING'
   };
   const safeAuthCodes = new Set([
    'auth/invalid-credential','auth/wrong-password','auth/user-not-found',
    'auth/unauthorized-domain','auth/invalid-api-key',
    'auth/network-request-failed','auth/operation-not-allowed',
    'auth/user-disabled','auth/too-many-requests'
   ]);
   const code = codes[String(error?.message||'')] ||
    (safeAuthCodes.has(error?.code) ? error.code :
    (stage==='CONFIG_JSON' && error instanceof SyntaxError
      ? 'QA_JSON_SYNTAX' : 'QA_'+stage+'_HOLD'));
   status('QA 연결 실패','단계: '+stage+' · 오류: '+code+
    '. 비밀번호는 자동 삭제됐으므로 재시도할 때 다시 입력하세요.');
   log('연결 실패: '+stage+' / '+code+' (비밀정보 미표시)');
   if(pending) try { await pending.signOut(); } catch { /* no retry */ }
   client = null;
   connect.disabled = false;
   arm.disabled = true;
  }
 });
 arm.addEventListener('click',() => {
  if(!client || count !== 0 || version < 1 || armVersion !== null) return;
  armVersion = version;
  steps = 0;
  proof.textContent = '준비됨 · 기준 버전 '+armVersion;
  arm.disabled = true;
  status('QA 수신 검증 준비됨','이제 QA 서버에서 합성 B의 팔로우·취소를 1회 실행하세요.');
  log('수신 검증 준비: 기준 버전 '+armVersion);
 });
 disconnect.addEventListener('click',disconnectOwner);
 window.addEventListener('pagehide',() => {
  session++;
  if(initialTimer!==null){clearTimeout(initialTimer);initialTimer=null;}
  if(unsubscribe)unsubscribe();
  unsubscribe = null;
  // No unload writes, network cleanup or persistent cache.
 });
}
// APP671 exact active PREVIEW Service-Binding module patch, OFF by default.
// Do not mutate the canonical Explore writer, owner DO or any binding here.
import {createHash} from 'node:crypto';
export const APP671_SERVICE_SHA='eab8798cf9be0e04297f8d89cf6838ffebc296fc20af9eac2fc2ea067fab480b';
const sha=s=>createHash('sha256').update(s).digest('hex');
const replaceOne=(source,from,to)=>{
 if(source.split(from).length!==2)throw Error('671_SERVICE_ANCHOR_DRIFT');
 return source.replace(from,to);
};
export const patchOwnerServiceDualAck671=(activeSource)=>{
 if(sha(activeSource)!==APP671_SERVICE_SHA)throw Error('671_ACTIVE_SERVICE_HASH_DRIFT');
 let x=replaceOne(activeSource,
  "import {replayOwnerFollowReservation556} from './owner-follow-postcommit-555.mjs';",
  "import {replayOwnerFollowReservation556} from './owner-follow-postcommit-555.mjs';\n"+
  "import {handleOwnerAndPublicFollowReplay671} from './public-follow-dual-ack-671.mjs';");
 x=replaceOne(x,
  "export async function handleOwnerFollowReplayService601({",
  "async function handleOwnerFollowReplayService601Base({");
 x+=`
// APP671: caller still enters through the same private named WorkerEntrypoint.
// The handler above performs ALL existing bridge HMAC and reservation checks.
// This wrapper is compiled OFF until the entire PREVIEW public path is proven.
export async function handleOwnerFollowReplayService601(args={}){
 return handleOwnerAndPublicFollowReplay671({
  request:args.request,env:args.env,
  ownerHandler:()=>handleOwnerFollowReplayService601Base(args),
 });
}
`;
 return x;
};

import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getDatabase} from 'firebase-admin/database';
import {publishPublicationRelease431} from './explorePublicationRelease431';

const secret431=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');

const makePublicationRelease431=()=>onRequest({
  region:'asia-northeast3',
  secrets:[secret431],
  timeoutSeconds:15,
  memory:'256MiB',
},async(req,res)=>{
  if(req.method!=='POST'){res.status(405).json({ok:false});return;}
  const rawBody=(req as typeof req & {rawBody?:Buffer}).rawBody;
  if(!Buffer.isBuffer(rawBody)){res.status(400).json({ok:false});return;}
  const signature=String(req.header('X-Soridraw-431-Publication-Signature')||'');
  try{
    const data=await publishPublicationRelease431(
      getDatabase(),rawBody.toString('utf8'),signature,secret431.value(),Date.now(),
      'publicSync/explorePublication',
    );
    res.status(200).json({ok:true,data});
  }catch(error){
    const code=String((error as Error)?.message||'431_PUBLICATION_RELEASE_ERROR');
    const status=code.includes('BAD_SIGNATURE')?403:
      code.includes('INVALID_AUTH')?403:
      code.includes('BAD_JSON')||code.includes('BAD_CLAIM')?400:503;
    res.status(status).json({ok:false,error:{code}});
  }
});

// Three isolated code identities share the same user-data RTDB, matching the
// PREVIEW -> TEST -> PRODUCTION code-promotion model. Only the approved target
// is deployed at each stage.
export const publicationRelease431Candidate=makePublicationRelease431();
export const publicationRelease431Test=makePublicationRelease431();
export const publicationRelease431Production=makePublicationRelease431();

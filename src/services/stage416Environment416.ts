export type Stage416ClientEnvironment416='preview'|'test'|'production';

export const resolveStage416Environment416=(hostname:string):Stage416ClientEnvironment416=>{
 const host=String(hostname||'').trim().toLowerCase();
 if(host==='soridraw.com'||host==='www.soridraw.com'||
    host==='soridraw.web.app'||host==='soridraw.firebaseapp.com')return 'production';
 if(host==='test.soridraw.com'||host==='soridraw-test.web.app'||
    host==='soridraw-test.firebaseapp.com'||host==='soridraw-music.vercel.app')return 'test';
 return 'preview';
};

export const getStage416CallableName416=(hostname:string):string=>{
 const environment=resolveStage416Environment416(hostname);
 if(environment==='production')return 'recordPrivateLikeProduction416';
 if(environment==='test')return 'recordPrivateLikeTest416';
 return 'recordPrivateLike416';
};

export const currentStage416CallableName416=()=>getStage416CallableName416(
 typeof window==='undefined'?'':window.location.hostname,
);

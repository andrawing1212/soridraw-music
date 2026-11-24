import assert from 'node:assert/strict';
import {composeProductionFollow797,productionFollowScope797} from './app797-production-follow-existing-writer.mjs';
const base={SORIDRAW_ENVIRONMENT:'production',SORIDRAW_OWNER_FOLLOW_PRODUCTION_797:'1',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:'1',SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:'1',SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680:'1',SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:'x'.repeat(32),OWNER_FOLLOW_RESERVATION_SERVICE_600:{fetch(){throw Error('unexpected direct call')}}};
let calls=0,pre=0,res=0;
const canonical={async fetch(r,e,c){calls++;assert.equal(e,expected);return new Response('canonical')},scheduled(){}};
let expected=base;
const wrapper=composeProductionFollow797(canonical,{authenticate:()=>({ok:true,uid:'actor'}),precommit:async x=>{pre++;assert.equal(x.env,expected);assert.equal(x.publicWithoutEpoch,true);await x.reserve({ownerUid:'owner'});return x.callCanonical()},reserve:async(t,e,o)=>{res++;assert.equal(e,expected);assert.equal(o.enabled,true);return {ok:true}}});
const request=(method='PUT',origin='https://soridraw.com',path='/v1/profiles/owner/follow')=>new Request('https://example.com'+path,{method,headers:{Origin:origin}});
assert.equal(wrapper.scheduled,canonical.scheduled);
assert(productionFollowScope797(base));
for(const method of ['PUT','DELETE'])assert.equal(await (await wrapper.fetch(request(method),base,{})).text(),'canonical');
assert.deepEqual([calls,pre,res],[2,2,2]);
for(const e of [{...base,SORIDRAW_ENVIRONMENT:'test'},{...base,SORIDRAW_ENVIRONMENT:'preview'},{...base,SORIDRAW_OWNER_FOLLOW_PRODUCTION_797:'0'}]){
 expected=e;assert.equal(await (await wrapper.fetch(request(),e,{})).text(),'canonical');
}
expected=base;
for(const r of [request('GET'),request('PUT','https://preview.soridraw.com'),request('PUT','https://soridraw.com','/owner-follow/replay557-internal')])await wrapper.fetch(r,base,{});
assert.deepEqual([pre,res],[2,2]);
for(const k of Object.keys(base).filter(x=>!['SORIDRAW_ENVIRONMENT','SORIDRAW_OWNER_FOLLOW_PRODUCTION_797'].includes(x))){
 const e={...base};delete e[k];assert.equal((await wrapper.fetch(request(),e,{})).status,503);
}
assert.deepEqual([pre,res],[2,2]);
console.log('APP797_PROD_ONLY_EXISTING_WRITER_AND_PRIVATE_RESERVATION=PASS');

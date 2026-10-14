import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materializePublicLikeProjection416}
 from '../cloudflare/explore-worker/runtime/public-like-projection-416.mjs';

const clone=v=>structuredClone(v);
const objects=new Map(),writes=[];
let etagSeq=1;
const seed=(key,value)=>objects.set(key,{
  body:JSON.stringify(value),etag:'e'+etagSeq++,customMetadata:{seed:'1'},
});
const makeObject=record=>record?{
  etag:record.etag,customMetadata:record.customMetadata,
  text:async()=>record.body,
}:null;
const r2={
  async get(key){return makeObject(objects.get(key));},
  async put(key,body,options={}){
    const before=objects.get(key);
    if(options?.onlyIf?.etagMatches&&before?.etag!==options.onlyIf.etagMatches)return null;
    const next={body:String(body),etag:'e'+etagSeq++,
      customMetadata:clone(options.customMetadata||{})};
    objects.set(key,next);writes.push(key);return {etag:next.etag};
  },
};
const cardKey=id=>'internal/explore/shared-track-card-v115/'+encodeURIComponent(id)+'.json';
const profileKey=uid=>'internal/explore/shared-profile-v113/'+encodeURIComponent(uid)+'.json';
const feedKey=sort=>'internal/explore/shared-feed-v112/'+sort+'-40.json';

const item=(id,ownerUid,likeCount,publishedAt)=>({
 id,trackId:id,ownerUid,likeCount,publishedAt,stats:{likeCount},
});
seed(cardKey('song-a'),{card:item('song-a','u1',4,90)});
seed(cardKey('song-b'),{card:item('song-b','u3',3,80)});
seed(cardKey('song-c'),{card:item('song-c','u2',6,100)});
seed(cardKey('song-x'),{card:item('song-x','ux',1,70)});
seed(profileKey('u1'),{revision:1,body:{data:{revision:1,items:[item('song-a','u1',4,90)]}}});
seed(profileKey('u2'),{revision:1,body:{data:{revision:1,items:[item('song-c','u2',6,100)]}}});
seed(profileKey('ux'),{revision:1,body:{data:{revision:1,items:[item('song-x','ux',1,70)]}}});
seed(feedKey('latest'),{payload:{data:{sort:'latest',items:[
 item('song-c','u2',6,100),item('song-a','u1',4,90),item('song-b','u3',3,80)
],nextCursor:null}}});
seed(feedKey('popular'),{payload:{data:{sort:'popular',items:[
 item('song-a','u1',4,90),item('song-b','u3',3,80)
],nextCursor:null}}});

let d1Reads=0;
const canonical=new Map([
 ['song-a',{id:'song-a',owner_uid:'u1',like_count:5}],
 ['song-c',{id:'song-c',owner_uid:'u2',like_count:7}],
 ['song-x',{id:'song-x',owner_uid:'ux',like_count:2}],
]);
const db={
 prepare(sql){
   return {
     bind(...args){
       return {async all(){
         d1Reads++;
         if(sql.includes('FROM tracks t LEFT JOIN track_stats')){
           return {results:args.map(id=>canonical.get(id)).filter(Boolean).map(clone)};
         }
         throw Error('unexpected bound SQL '+sql);
       }};
     },
     async all(){
       d1Reads++;
       if(sql.includes('INDEXED BY idx_explore_rank_popular')){
         return {results:[{id:'song-c'},{id:'song-a'},{id:'song-b'}]};
       }
       throw Error('unexpected SQL '+sql);
     },
   };
 },
};

const first=await materializePublicLikeProjection416({
 db,r2,trackIds:['song-x','song-c','song-a','song-a'],
});
assert.equal(first.changedTracks,3);
assert.deepEqual(first.missingIds,[]);
assert.equal(first.d1ReadQueries,2);
assert.equal(first.d1Writes,0);
assert.equal(d1Reads,2);
assert.equal(JSON.parse(objects.get(cardKey('song-x')).body).card.likeCount,2);
assert.equal(JSON.parse(objects.get(profileKey('u1')).body).body.data.items[0].likeCount,5);
assert.equal(JSON.parse(objects.get(feedKey('latest')).body).payload.data.items[1].likeCount,5);
const popular=JSON.parse(objects.get(feedKey('popular')).body).payload.data;
assert.deepEqual(popular.items.map(x=>x.id),['song-c','song-a','song-b']);
assert.deepEqual(popular.items.map(x=>x.likeCount),[7,5,3]);

const firstWrites=writes.length;
const second=await materializePublicLikeProjection416({
 db,r2,trackIds:['song-a','song-c','song-x'],
});
assert.equal(second.d1Writes,0);
assert.equal(writes.length,firstWrites,'projection replay must be R2 W0 once current');

const source=readFileSync('cloudflare/explore-worker/runtime/public-like-projection-416.mjs','utf8');
for(const forbidden of [
  'SELECT * FROM tracks','SELECT * FROM likes','SELECT * FROM track_stats',
  'DELETE FROM','INSERT INTO','UPDATE track_stats',
]) assert.equal(source.includes(forbidden),false,'forbidden public projection pattern '+forbidden);
assert.match(source,/LIMIT 41/);
assert.match(source,/PUBLIC_PROJECTION_CHUNK_416=50/);

console.log('STAGE416_PUBLIC_PROJECTION_EXACT_CHANGED_IDS_ONLY=PASS');
console.log('STAGE416_PUBLIC_PROJECTION_POPULAR_TOP41_BOUNDED=PASS');
console.log('STAGE416_PUBLIC_PROJECTION_OUTSIDE_FEED_CARD_PROFILE_PATCHED=PASS');
console.log('STAGE416_PUBLIC_PROJECTION_REPLAY_R2_W0=PASS');
console.log('STAGE416_PUBLIC_PROJECTION_D1_WRITES=0');
console.log('STAGE416_PUBLIC_PROJECTION_D1_READ_QUERIES=2');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
